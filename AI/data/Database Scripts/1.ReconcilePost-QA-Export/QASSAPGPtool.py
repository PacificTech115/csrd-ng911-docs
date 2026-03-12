# QASSAPGPtool.py
# QA automation script tool for SSAP.
# Runs schema/NGUID/mandatory/null/duplicate checks and can update QAStatus.
#
# Expected Script Tool parameters (ORDER MATTERS):
#   0 target_layer          (String)  -> URL/itemid[:layer]/path
#   1 schema_json           (File)
#   2 dataset_name          (String, optional)
#   3 mode                  (String)  -> "all" | "required" | "nonnullable"
#   4 check_types           (Boolean)
#   5 check_lengths         (Boolean)
#   6 check_nguid_format    (Boolean)
#   7 normalize_nguid       (Boolean)
#   8 mandatory_fields      (String)  -> semicolon delimited
#   9 address_dup_field     (String)
#  10 address_dup_max_rows  (Long)
#  11 qa_status_field       (String)
#  12 update_qa_status      (Boolean)
#  13 out_log_folder        (Folder)
#  14 result_json           (String, OUTPUT/DERIVED)

import arcpy
import csv
import json
import os
import re
import traceback
from collections import Counter
from datetime import datetime, timedelta

# Missing fields listed here are warnings only (do not fail QA).
NON_BLOCKING_MISSING_FIELDS = {"shape"}
ISSUE_SAMPLE_LIMIT = 5
# Only newly created rows in this lookback window are included in QA scope.
NEW_FEATURE_LOOKBACK_HOURS = 24
CREATED_DATE_FIELD_CANDIDATES = ("created_date", "createdate")


def _msg(s: str):
    arcpy.AddMessage(s)


def _warn(s: str):
    arcpy.AddWarning(s)


def _err(s: str):
    arcpy.AddError(s)


def _ensure_dir(path: str):
    if not path:
        raise ValueError("out_log_folder is empty or None.")
    os.makedirs(path, exist_ok=True)


def _normalize_list(s: str) -> str:
    if not s:
        return ""
    parts = [p.strip() for p in s.split(";")]
    parts = [p for p in parts if p]
    return ";".join(parts)


def _normalize_type(t):
    if not t:
        return ""
    t_low = str(t).lower()
    mapping = {
        "esrifieldtypestring": "String",
        "esrifieldtypeinteger": "Integer",
        "esrifieldtypesmallinteger": "SmallInteger",
        "esrifieldtypedouble": "Double",
        "esrifieldtypesingle": "Single",
        "esrifieldtypedate": "Date",
        "esrifieldtypeoid": "OID",
        "esrifieldtypegeometry": "Geometry",
        "esrifieldtypeguid": "GUID",
        "esrifieldtypeglobalid": "GlobalID",
        "string": "String",
        "text": "String",
        "integer": "Integer",
        "smallinteger": "SmallInteger",
        "double": "Double",
        "single": "Single",
        "date": "Date",
        "oid": "OID",
        "geometry": "Geometry",
        "guid": "GUID",
        "globalid": "GlobalID",
    }
    return mapping.get(t_low, str(t))


def _load_expected_fields(schema_path, dataset_name=None, mode="all"):
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)
    datasets = schema.get("datasets", [])
    fcs = [d for d in datasets if d.get("datasetType") == "esriDTFeatureClass"]
    if not fcs:
        raise ValueError("No feature classes found in schema JSON.")
    if dataset_name:
        matches = [d for d in fcs if d.get("name", "").lower() == dataset_name.lower()]
        if not matches:
            available = ", ".join(d.get("name", "") for d in fcs)
            raise ValueError(f"Dataset '{dataset_name}' not found. Available: {available}")
        ds = matches[0]
    else:
        ds = fcs[0]
    fields = ds.get("fields", {}).get("fieldArray", [])
    expected = {}
    mode = (mode or "all").lower()
    for fld in fields:
        name = fld.get("name")
        if not name:
            continue
        fld_type_norm = _normalize_type(fld.get("type"))
        required = bool(fld.get("required", False))
        is_nullable = fld.get("isNullable", True)
        include = True
        if mode == "required":
            include = required
        elif mode == "nonnullable":
            include = required or (is_nullable is False)
        if include:
            expected[name.lower()] = {
                "name": name,
                "type": fld_type_norm,
                "length": fld.get("length"),
                "required": required,
                "isNullable": is_nullable,
            }
    return expected


def _get_actual_fields(target):
    if not arcpy.Exists(target):
        raise ValueError(f"Target does not exist or is not accessible: {target}")
    out = []
    for f in arcpy.ListFields(target):
        out.append({"name": f.name, "type": _normalize_type(f.type), "length": getattr(f, "length", None)})
    return out


def _compare_fields(expected, actual, check_types=True, check_lengths=True):
    actual_map = {f["name"].lower(): f for f in actual}
    expected_keys = set(expected.keys())
    actual_keys = set(actual_map.keys())
    missing = sorted(expected_keys - actual_keys)
    extra = sorted(actual_keys - expected_keys)
    details = []
    for key in sorted(expected_keys):
        exp = expected[key]
        act = actual_map.get(key)
        status = "OK" if act else "MISSING"
        act_type = _normalize_type(act["type"]) if act else ""
        act_len = act.get("length") if act else None
        type_ok = None
        len_ok = None
        if act and check_types:
            type_ok = (_normalize_type(exp["type"]) == act_type)
        if act and check_lengths:
            exp_len = exp.get("length")
            len_ok = (exp_len == act_len) if exp_len is not None and act_len is not None else None
        details.append({
            "Field": exp["name"],
            "Status": status,
            "ExpectedType": exp["type"],
            "ActualType": act_type,
            "TypeMatch": type_ok if check_types else None,
            "ExpectedLength": exp.get("length"),
            "ActualLength": act_len,
            "LengthMatch": len_ok if check_lengths else None,
            "Required": exp.get("required"),
            "Nullable": exp.get("isNullable"),
        })
    return missing, extra, details


def _norm_guid(val, normalize=True):
    if val is None:
        return None
    s = str(val).strip()
    if s == "":
        return ""
    return s.upper() if normalize else s


def _norm_text(val):
    if val is None:
        return None
    s = str(val).strip()
    if s == "":
        return ""
    return s.upper()


def _is_passed_status(val):
    if val is None:
        return False
    return str(val).strip().lower() == "passed"


def _is_newly_created(val, cutoff_dt):
    if val in (None, ""):
        return False
    dt_val = None
    if isinstance(val, datetime):
        dt_val = val
    else:
        # ArcPy date values are usually datetime; keep a defensive parse fallback.
        txt = str(val).strip()
        if txt:
            try:
                dt_val = datetime.fromisoformat(txt.replace("Z", "+00:00"))
            except Exception:
                return False
    if dt_val is None:
        return False
    # Handle timezone-aware datetimes safely by converting cutoff to same tz-awareness.
    if dt_val.tzinfo is not None and cutoff_dt.tzinfo is None:
        cutoff_dt = cutoff_dt.replace(tzinfo=dt_val.tzinfo)
    return dt_val >= cutoff_dt


def _resolve_check_scope(target, qa_status_field, lookback_hours=NEW_FEATURE_LOOKBACK_HOURS):
    oid_field = arcpy.Describe(target).OIDFieldName
    field_map = {f.name.lower(): f.name for f in arcpy.ListFields(target)}
    qa_status_actual = field_map.get((qa_status_field or "").lower())
    created_actual = None
    for c in CREATED_DATE_FIELD_CANDIDATES:
        if c.lower() in field_map:
            created_actual = field_map[c.lower()]
            break

    cursor_fields = [oid_field]
    if qa_status_actual:
        cursor_fields.append(qa_status_actual)
    if created_actual:
        cursor_fields.append(created_actual)

    cutoff_dt = datetime.now() - timedelta(hours=lookback_hours)
    scoped_oids = set()
    count_not_passed = 0
    count_new = 0
    total_rows = 0
    status_counts = Counter()

    with arcpy.da.SearchCursor(target, cursor_fields) as cur:
        for row in cur:
            total_rows += 1
            row_map = {cursor_fields[i]: row[i] for i in range(len(cursor_fields))}
            oid = row_map.get(oid_field)
            if oid is None:
                continue

            needs_check = False
            if qa_status_actual:
                status_val = row_map.get(qa_status_actual)
                status_key = str(status_val).strip() if status_val not in (None, "") else "(blank)"
                status_counts[status_key] += 1
                if not _is_passed_status(status_val):
                    needs_check = True
                    count_not_passed += 1
            else:
                # Without QAStatus field, fall back to checking all rows.
                needs_check = True

            if created_actual and _is_newly_created(row_map.get(created_actual), cutoff_dt):
                needs_check = True
                count_new += 1

            if needs_check:
                scoped_oids.add(oid)

    return {
        "oid_field": oid_field,
        "qa_status_field_actual": qa_status_actual,
        "created_date_field_actual": created_actual,
        "lookback_hours": lookback_hours,
        "total_rows": total_rows,
        "rows_in_scope": len(scoped_oids),
        "rows_not_passed": count_not_passed,
        "rows_newly_created": count_new,
        "status_counts": dict(status_counts.most_common(50)),
        "scoped_oids": scoped_oids,
    }


def _summarize(values, check_format=False):
    total = len(values)
    null_count = sum(v is None for v in values)
    empty_count = sum(v == "" for v in values if v is not None)
    candidates = [v for v in values if v not in (None, "")]
    counts = Counter(candidates)
    dupes = [(k, c) for k, c in counts.items() if c > 1]
    dupes.sort(key=lambda x: x[1], reverse=True)
    invalid = []
    if check_format:
        guid_re = re.compile(r"^[{(]?[0-9A-F]{8}(-[0-9A-F]{4}){3}-[0-9A-F]{12}[)}]?$", re.I)
        invalid = [v for v in candidates if not guid_re.match(str(v))]
    return {
        "total_records": total,
        "null_count": null_count,
        "empty_count": empty_count,
        "nonempty_count": len(candidates),
        "unique_nonempty_count": len(counts),
        "duplicate_count": len(dupes),
        "duplicate_examples": dupes,
        "invalid_format_count": len(invalid),
        "invalid_examples": invalid[:50],
    }


def _check_nguid(target, normalize=True, check_format=False, scoped_oids=None):
    values = []
    oid_field = arcpy.Describe(target).OIDFieldName
    with arcpy.da.SearchCursor(target, [oid_field, "NGUID"]) as cur:
        for oid, v in cur:
            if scoped_oids is not None and oid not in scoped_oids:
                continue
            values.append(_norm_guid(v, normalize))
    summary = _summarize(values, check_format=check_format)
    return {
        "total_records": summary["total_records"],
        "null_nguid": summary["null_count"],
        "empty_nguid": summary["empty_count"],
        "nonempty_nguid": summary["nonempty_count"],
        "unique_nonempty_nguid": summary["unique_nonempty_count"],
        "duplicate_nguid_count": summary["duplicate_count"],
        "duplicate_examples": summary["duplicate_examples"],
        "invalid_format_count": summary["invalid_format_count"],
        "invalid_examples": summary["invalid_examples"],
    }


def _check_mandatory_nulls(target, fields, scoped_oids=None):
    if not fields:
        return []
    oid_field = arcpy.Describe(target).OIDFieldName
    totals = {f: 0 for f in fields}
    nulls = {f: 0 for f in fields}
    cursor_fields = [oid_field] + fields
    with arcpy.da.SearchCursor(target, cursor_fields) as cur:
        for row in cur:
            oid = row[0]
            if scoped_oids is not None and oid not in scoped_oids:
                continue
            for idx, val in enumerate(row[1:]):
                fld = fields[idx]
                totals[fld] += 1
                if val in (None, ""):
                    nulls[fld] += 1
    return [{"field": f, "total": totals[f], "null_count": nulls[f], "non_null": totals[f] - nulls[f]} for f in fields]


def _collect_null_failures(target, mandatory_fields, max_rows=5000, sample_limit=ISSUE_SAMPLE_LIMIT, scoped_oids=None):
    if not mandatory_fields:
        return {"total_failed_features": 0, "sample_failed_features": [], "rows": []}
    all_fields = {f.name.lower(): f.name for f in arcpy.ListFields(target)}
    mandatory_present = [all_fields[f.lower()] for f in mandatory_fields if f.lower() in all_fields]
    oid_field = arcpy.Describe(target).OIDFieldName
    nguid_field = all_fields.get("nguid")
    cursor_fields = [oid_field] + mandatory_present
    if nguid_field and nguid_field not in cursor_fields:
        cursor_fields.append(nguid_field)

    rows = []
    samples = []
    with arcpy.da.SearchCursor(target, cursor_fields) as cur:
        for row in cur:
            row_map = {cursor_fields[i]: row[i] for i in range(len(cursor_fields))}
            if scoped_oids is not None and row_map.get(oid_field) not in scoped_oids:
                continue
            failing_fields = [f for f in mandatory_present if row_map.get(f) in (None, "")]
            if not failing_fields:
                continue
            item = {
                "object_id": row_map.get(oid_field),
                "nguid": row_map.get(nguid_field) if nguid_field else None,
                "failing_fields": failing_fields,
            }
            rows.append(item)
            if len(samples) < sample_limit:
                samples.append(item)
            if len(rows) >= max_rows:
                break

    return {
        "total_failed_features": len(rows),
        "sample_failed_features": samples,
        "rows": rows,
        "truncated": len(rows) >= max_rows,
    }


def _check_duplicates(target, field_name, scoped_oids=None):
    if not field_name:
        return {"skipped": True, "reason": "field_name not provided"}
    fields = [f.name.lower() for f in arcpy.ListFields(target)]
    if field_name.lower() not in fields:
        return {"skipped": True, "reason": f"field '{field_name}' not found"}
    fields_map = {f.name.lower(): f.name for f in arcpy.ListFields(target)}
    oid_field = arcpy.Describe(target).OIDFieldName
    nguid_field = fields_map.get("nguid")
    values = []
    value_rows = []
    cursor_fields = [oid_field, field_name]
    if nguid_field:
        cursor_fields.append(nguid_field)
    with arcpy.da.SearchCursor(target, cursor_fields) as cur:
        for row in cur:
            oid = row[0]
            if scoped_oids is not None and oid not in scoped_oids:
                continue
            v = row[1]
            nguid_val = row[2] if len(row) > 2 else None
            norm = _norm_text(v)
            values.append(norm)
            value_rows.append((norm, oid, nguid_val))
    summary = _summarize(values, check_format=False)
    dup_map = {}
    for val, oid, nguid_val in value_rows:
        if val in (None, ""):
            continue
        dup_map.setdefault(val, []).append({"object_id": oid, "nguid": nguid_val})
    dupes_detail = []
    for val, items in dup_map.items():
        if len(items) > 1:
            dupes_detail.append({
                "value": val,
                "count": len(items),
                "object_ids": [i["object_id"] for i in items],
                "nguids": [i["nguid"] for i in items],
            })
    return {
        "total_records": summary["total_records"],
        "null_value_count": summary["null_count"],
        "empty_value_count": summary["empty_count"],
        "duplicate_nguid_count": summary["duplicate_count"],
        "duplicate_examples": summary["duplicate_examples"],
        "duplicates_detailed": dupes_detail,
    }


def _write_address_dup_csv(dup_report, out_log_folder, ts, max_rows):
    dupes = dup_report.get("duplicates_detailed") or []
    if not dupes:
        return None
    csv_path = os.path.join(out_log_folder, f"address_duplicates_{ts}.csv")
    rows_written = 0
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["AddressValue", "ObjectID", "NGUID"])
        for d in dupes:
            val = d.get("value")
            oids = d.get("object_ids", [])
            nguids = d.get("nguids", [])
            for idx, oid in enumerate(oids):
                nguid = nguids[idx] if idx < len(nguids) else None
                writer.writerow([val, oid, nguid])
                rows_written += 1
                if rows_written >= max_rows:
                    writer.writerow(["TRUNCATED", "", f"Reached max rows {max_rows}"])
                    return csv_path
    return csv_path


def _write_null_failures_csv(null_report, out_log_folder, ts, max_rows):
    rows = null_report.get("rows") or []
    if not rows:
        return None
    csv_path = os.path.join(out_log_folder, f"mandatory_null_failures_{ts}.csv")
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["ObjectID", "NGUID", "FailingFields"])
        for idx, item in enumerate(rows):
            if idx >= max_rows:
                writer.writerow(["TRUNCATED", "", f"Reached max rows {max_rows}"])
                break
            writer.writerow([item.get("object_id"), item.get("nguid"), "; ".join(item.get("failing_fields", []))])
    return csv_path


def _build_email_summary(result, report):
    nguid = report.get("nguid_summary", {})
    null_fields = [r["field"] for r in (report.get("mandatory_nulls") or []) if r.get("null_count", 0) > 0]
    addr_count = (report.get("address_duplicates") or {}).get("duplicate_nguid_count", 0)
    issues_by_agency = report.get("issues_by_agency") or {}
    summary = {
        "status": result.get("status"),
        "qa_passed": result.get("qa_passed"),
        "missing_fields_count": len(report.get("missing_fields", [])),
        "missing_warnings_count": len(report.get("missing_warnings", [])),
        "nguid_duplicate_count": nguid.get("duplicate_nguid_count", 0),
        "nguid_invalid_count": nguid.get("invalid_format_count", 0),
        "mandatory_missing_count": len(report.get("mandatory_missing", [])),
        "mandatory_fields_with_nulls": null_fields,
        "failed_null_feature_count": (report.get("mandatory_null_failures") or {}).get("total_failed_features", 0),
        "address_duplicate_count": addr_count,
        "address_duplicates_warning_only": True,
        "scope_feature_count": issues_by_agency.get("scope_feature_count", 0),
        "passed_feature_count": issues_by_agency.get("passed_feature_count", 0),
        "issue_feature_count": issues_by_agency.get("issue_feature_count", 0),
        "warning_issue_feature_count": issues_by_agency.get("warning_issue_feature_count", 0),
        "blocking_issue_feature_count": issues_by_agency.get("blocking_issue_feature_count", 0),
    }
    lines = [
        f"QA Status: {result.get('status')}",
        f"QA Passed: {result.get('qa_passed')}",
        f"Scope: {summary['scope_feature_count']} | Passed: {summary['passed_feature_count']} | With issues: {summary['issue_feature_count']}",
        f"Missing fields: {summary['missing_fields_count']} (warnings: {summary['missing_warnings_count']})",
        f"NGUID duplicates: {summary['nguid_duplicate_count']} | NGUID invalid format: {summary['nguid_invalid_count']}",
        f"Mandatory missing fields: {summary['mandatory_missing_count']}",
        f"Mandatory-null failed features: {summary['failed_null_feature_count']}",
        f"Address duplicates (warning): {summary['address_duplicate_count']}",
    ]
    return summary, "\n".join(lines)


def _build_qastatus_updates(target, oid_field, qa_status_field, mandatory_fields, normalize_nguid, report, scoped_oids=None):
    dup_nguid_values = {v for v, c in (report.get("nguid_summary", {}).get("duplicate_examples") or []) if c > 1}
    dup_addr_values = set()
    for d in (report.get("address_duplicates") or {}).get("duplicates_detailed", []):
        val = _norm_text(d.get("value"))
        if val:
            dup_addr_values.add(val)

    fields_lower = {f.name.lower(): f.name for f in arcpy.ListFields(target)}
    mandatory_present = [fields_lower[f.lower()] for f in mandatory_fields if f.lower() in fields_lower]
    nguid_field = fields_lower.get("nguid")
    addr_field = None
    if report.get("address_duplicates") and report["address_duplicates"].get("field_name"):
        addr_field = fields_lower.get(report["address_duplicates"]["field_name"].lower())

    global_errors = []
    if report.get("missing_fields"):
        global_errors.append("Missing fields: " + ", ".join(report["missing_fields"]))
    if report.get("mandatory_missing"):
        global_errors.append("Mandatory fields missing: " + ", ".join(report["mandatory_missing"]))

    fields_to_read = [oid_field] + mandatory_present
    if nguid_field and nguid_field not in fields_to_read:
        fields_to_read.append(nguid_field)
    if addr_field and addr_field not in fields_to_read:
        fields_to_read.append(addr_field)

    updates = []
    with arcpy.da.SearchCursor(target, fields_to_read) as cur:
        for row in cur:
            row_map = {fields_to_read[i]: row[i] for i in range(len(fields_to_read))}
            oid = row_map.get(oid_field)
            if oid is None:
                continue
            if scoped_oids is not None and oid not in scoped_oids:
                continue
            errors = list(global_errors)
            warnings = []
            for f in mandatory_present:
                if row_map.get(f) in (None, ""):
                    errors.append(f"{f} is empty")
            if nguid_field:
                nguid_val = _norm_guid(row_map.get(nguid_field), normalize_nguid)
                if nguid_val in (None, ""):
                    errors.append(f"{nguid_field} is empty")
                elif nguid_val in dup_nguid_values:
                    errors.append("Duplicate NGUID")
            if addr_field:
                addr_val = _norm_text(row_map.get(addr_field))
                if addr_val in dup_addr_values:
                    warnings.append("Duplicate address")

            if errors:
                status = "; ".join(dict.fromkeys(errors))
            elif warnings:
                status = "Warning: " + "; ".join(dict.fromkeys(warnings))
            else:
                status = "Passed"
            updates.append((oid, status))
    return updates


def _apply_qastatus_updates(target, oid_field, qa_status_field, updates):
    def _run_updates():
        total_local = len(updates)
        successes_local = 0
        failures_local = 0
        error_samples_local = []
        upd_map = {oid: status for oid, status in updates}
        with arcpy.da.UpdateCursor(target, [oid_field, qa_status_field]) as cur:
            for row in cur:
                oid = row[0]
                if oid not in upd_map:
                    continue
                try:
                    row[1] = upd_map[oid]
                    cur.updateRow(row)
                    successes_local += 1
                except Exception as ex:
                    failures_local += 1
                    if len(error_samples_local) < 20:
                        error_samples_local.append(f"OID {oid}: {ex}")
        return {
            "total": total_local,
            "successes": successes_local,
            "failures": failures_local,
            "errors": error_samples_local,
        }

    try:
        return _run_updates()
    except RuntimeError as ex:
        # Enterprise/versioned data may require an explicit edit session.
        if "outside an edit session" not in str(ex).lower():
            raise

        target_path = str(target)
        sde_idx = target_path.lower().find(".sde")
        if sde_idx == -1:
            raise
        workspace = target_path[:sde_idx + 4]
        editor = arcpy.da.Editor(workspace)
        editor.startEditing(False, True)
        editor.startOperation()
        try:
            result = _run_updates()
            editor.stopOperation()
            editor.stopEditing(True)
            result["used_edit_session"] = True
            result["edit_workspace"] = workspace
            return result
        except Exception:
            editor.abortOperation()
            editor.stopEditing(False)
            raise


def _summarize_issues_by_agency(target, oid_field, updates, agency_field_actual):
    status_by_oid = {oid: status for oid, status in (updates or [])}
    if not status_by_oid:
        return {
            "agency_field": agency_field_actual or "Agency",
            "scope_feature_count": 0,
            "passed_feature_count": 0,
            "issue_feature_count": 0,
            "warning_issue_feature_count": 0,
            "blocking_issue_feature_count": 0,
            "agencies": [],
        }

    agency_by_oid = {}
    if agency_field_actual:
        with arcpy.da.SearchCursor(target, [oid_field, agency_field_actual]) as cur:
            for oid, agency in cur:
                if oid in status_by_oid:
                    agency_by_oid[oid] = agency

    totals = {
        "scope_feature_count": len(status_by_oid),
        "passed_feature_count": 0,
        "issue_feature_count": 0,
        "warning_issue_feature_count": 0,
        "blocking_issue_feature_count": 0,
    }
    buckets = {}
    for oid, status in status_by_oid.items():
        status_text = str(status or "").strip()
        status_low = status_text.lower()
        agency_val = agency_by_oid.get(oid)
        agency_key = str(agency_val).strip() if agency_val not in (None, "") else "(blank)"
        b = buckets.setdefault(
            agency_key,
            {
                "agency": agency_key,
                "scope_count": 0,
                "passed_count": 0,
                "issue_count": 0,
                "warning_issue_count": 0,
                "blocking_issue_count": 0,
            },
        )
        b["scope_count"] += 1

        is_passed = (status_low == "passed")
        is_warning = status_low.startswith("warning")
        if is_passed:
            totals["passed_feature_count"] += 1
            b["passed_count"] += 1
            continue

        totals["issue_feature_count"] += 1
        b["issue_count"] += 1
        if is_warning:
            totals["warning_issue_feature_count"] += 1
            b["warning_issue_count"] += 1
        else:
            totals["blocking_issue_feature_count"] += 1
            b["blocking_issue_count"] += 1

    agencies = list(buckets.values())
    agencies.sort(key=lambda x: (-x["issue_count"], x["agency"]))

    return {
        "agency_field": agency_field_actual or "Agency",
        "scope_feature_count": totals["scope_feature_count"],
        "passed_feature_count": totals["passed_feature_count"],
        "issue_feature_count": totals["issue_feature_count"],
        "warning_issue_feature_count": totals["warning_issue_feature_count"],
        "blocking_issue_feature_count": totals["blocking_issue_feature_count"],
        "agencies": agencies,
    }


def _qa_passed(report):
    no_missing = len(report.get("missing_fields", [])) == 0
    no_mandatory_missing = len(report.get("mandatory_missing", [])) == 0
    mandatory_nulls_ok = all(item.get("null_count", 0) == 0 for item in report.get("mandatory_nulls", []))
    no_nguid_dupes = report.get("nguid_summary", {}).get("duplicate_nguid_count", 0) == 0
    no_invalid_nguid = report.get("nguid_summary", {}).get("invalid_format_count", 0) == 0
    return no_missing and no_mandatory_missing and mandatory_nulls_ok and no_nguid_dupes and no_invalid_nguid


def _safe_int(val, default):
    if val in (None, ""):
        return default
    try:
        return int(val)
    except Exception:
        return default


def _set_result_output(result_json_text: str):
    # Support both current and earlier tool parameter layouts.
    for idx in (14, 13, 15):
        try:
            arcpy.SetParameterAsText(idx, result_json_text)
            return
        except Exception:
            continue


def main():
    target_layer = arcpy.GetParameterAsText(0)
    schema_json = arcpy.GetParameterAsText(1)
    dataset_name = arcpy.GetParameterAsText(2)
    mode = arcpy.GetParameterAsText(3) or "all"
    check_types = bool(arcpy.GetParameter(4))
    check_lengths = bool(arcpy.GetParameter(5))
    check_nguid_format = bool(arcpy.GetParameter(6))
    normalize_nguid = bool(arcpy.GetParameter(7))
    mandatory_fields_raw = arcpy.GetParameterAsText(8) or ""

    # Accept either:
    # A) [9 address_dup_field, 10 address_dup_max_rows, 11 qa_status_field, 12 update_qa_status, 13 out_log_folder]
    # B) [9 address_dup_max_rows, 10 qa_status_field, 11 update_qa_status, 12 out_log_folder] (older layout)
    p9 = arcpy.GetParameterAsText(9)
    p10 = arcpy.GetParameterAsText(10)
    p11 = arcpy.GetParameterAsText(11)
    p12 = arcpy.GetParameterAsText(12)
    p13 = arcpy.GetParameterAsText(13)

    parsed_p10_int = _safe_int(p10, None)
    if parsed_p10_int is not None:
        # Current layout A
        address_dup_field = p9 or ""
        address_dup_max_rows = parsed_p10_int
        qa_status_field = p11 or "QAStatus"
        update_qa_status = bool(arcpy.GetParameter(12))
        out_log_folder = p13
    else:
        # Fallback layout B
        address_dup_field = ""
        address_dup_max_rows = _safe_int(p9, 5000)
        qa_status_field = p10 or "QAStatus"
        update_qa_status = bool(arcpy.GetParameter(11))
        out_log_folder = p12

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    mandatory_fields = [f.strip() for f in _normalize_list(mandatory_fields_raw).split(";") if f.strip()] if mandatory_fields_raw else []

    if not target_layer:
        raise ValueError("target_layer is blank.")

    _ensure_dir(out_log_folder)
    log_path = os.path.join(out_log_folder, f"qa_run_{ts}.json")
    _msg(f"QA target resolved to: {target_layer}")

    scope_info = _resolve_check_scope(target_layer, qa_status_field, lookback_hours=NEW_FEATURE_LOOKBACK_HOURS)
    scoped_oids = scope_info.get("scoped_oids") or set()
    _msg(
        f"QA row scope: {scope_info.get('rows_in_scope')} / {scope_info.get('total_rows')} "
        f"(newly created: {scope_info.get('rows_newly_created')}, not Passed: {scope_info.get('rows_not_passed')})"
    )

    result = {
        "timestamp": ts,
        "success": False,
        "qa_passed": False,
        "status": "qa_failed",
        "log_path": log_path,
        "inputs": {
            "target_layer": target_layer,
            "schema_json": schema_json,
            "dataset_name": dataset_name,
            "mode": mode,
            "check_types": check_types,
            "check_lengths": check_lengths,
            "check_nguid_format": check_nguid_format,
            "normalize_nguid": normalize_nguid,
            "mandatory_fields": mandatory_fields,
            "address_dup_field": address_dup_field,
            "address_dup_max_rows": address_dup_max_rows,
            "qa_status_field": qa_status_field,
            "update_qa_status": update_qa_status,
            "out_log_folder": out_log_folder,
        },
    }

    expected = _load_expected_fields(schema_json, dataset_name=dataset_name, mode=mode)
    actual = _get_actual_fields(target_layer)
    missing, extra, details = _compare_fields(expected, actual, check_types, check_lengths)
    missing_names = [expected[k]["name"] for k in missing]
    missing_blocking = [n for n in missing_names if n.lower() not in NON_BLOCKING_MISSING_FIELDS]
    missing_warnings = [n for n in missing_names if n.lower() in NON_BLOCKING_MISSING_FIELDS]
    actual_map = {f["name"].lower(): f for f in actual}
    mandatory_missing = [f for f in mandatory_fields if f.lower() not in actual_map]
    mandatory_present = [f for f in mandatory_fields if f.lower() in actual_map]

    report = {
        "expected_field_count": len(expected),
        "actual_field_count": len(actual),
        "dataset_name": dataset_name,
        "scope": {
            "lookback_hours": scope_info.get("lookback_hours"),
            "total_rows": scope_info.get("total_rows"),
            "rows_in_scope": scope_info.get("rows_in_scope"),
            "rows_newly_created": scope_info.get("rows_newly_created"),
            "rows_not_passed": scope_info.get("rows_not_passed"),
            "qa_status_field": scope_info.get("qa_status_field_actual"),
            "created_date_field": scope_info.get("created_date_field_actual"),
        },
        "missing_fields": missing_blocking,
        "missing_warnings": missing_warnings,
        "extra_fields": extra,
        "details": details,
        "nguid_summary": _check_nguid(
            target_layer,
            normalize=normalize_nguid,
            check_format=check_nguid_format,
            scoped_oids=scoped_oids,
        ),
        "mandatory_missing": mandatory_missing,
        "mandatory_nulls": _check_mandatory_nulls(
            target_layer,
            mandatory_present,
            scoped_oids=scoped_oids,
        ) if mandatory_present else [],
    }
    null_failures = _collect_null_failures(
        target_layer,
        mandatory_present,
        max_rows=address_dup_max_rows,
        sample_limit=ISSUE_SAMPLE_LIMIT,
        scoped_oids=scoped_oids,
    )
    report["mandatory_null_failures"] = {
        "total_failed_features": null_failures.get("total_failed_features", 0),
        "sample_failed_features": null_failures.get("sample_failed_features", []),
        "truncated": null_failures.get("truncated", False),
    }
    null_csv = _write_null_failures_csv(null_failures, out_log_folder, ts, address_dup_max_rows)
    if null_csv:
        report["mandatory_null_failures_csv"] = null_csv

    if address_dup_field:
        address_dupes = _check_duplicates(target_layer, address_dup_field, scoped_oids=scoped_oids)
        address_dupes["field_name"] = address_dup_field
        if address_dupes.get("duplicates_detailed"):
            report["address_duplicates_samples"] = (address_dupes.get("duplicates_detailed") or [])[:ISSUE_SAMPLE_LIMIT]
        if address_dupes.get("duplicate_nguid_count", 0) > 0 and address_dupes.get("duplicates_detailed"):
            csv_path = _write_address_dup_csv(address_dupes, out_log_folder, ts, address_dup_max_rows)
            if csv_path:
                report["address_duplicates_csv"] = csv_path
    else:
        address_dupes = {"skipped": True, "reason": "ADDRESS_DUP_FIELD not set"}
    report["address_duplicates"] = address_dupes

    fields_lower = {f.name.lower(): f.name for f in arcpy.ListFields(target_layer)}
    oid_field = arcpy.Describe(target_layer).OIDFieldName
    qa_status_actual = fields_lower.get(qa_status_field.lower())
    agency_field_actual = fields_lower.get("agency")

    updates_for_scope = []
    if qa_status_actual:
        updates_for_scope = _build_qastatus_updates(
            target_layer,
            oid_field,
            qa_status_actual,
            mandatory_fields,
            normalize_nguid,
            report,
            scoped_oids=scoped_oids,
        )
    report["issues_by_agency"] = _summarize_issues_by_agency(
        target_layer,
        oid_field,
        updates_for_scope,
        agency_field_actual,
    )

    qa_status_update = {"skipped": True, "reason": "update disabled"}
    if update_qa_status:
        if not qa_status_actual:
            qa_status_update = {"skipped": True, "reason": f"{qa_status_field} not found on target"}
        else:
            if not updates_for_scope:
                qa_status_update = {
                    "skipped": True,
                    "reason": "No rows in QA scope to update.",
                    "rows_in_scope": len(scoped_oids),
                }
            else:
                qa_status_update = _apply_qastatus_updates(target_layer, oid_field, qa_status_actual, updates_for_scope)

    qa_passed = _qa_passed(report)
    result["qa_passed"] = qa_passed
    result["status"] = "qa_passed" if qa_passed else "qa_failed"
    result["success"] = qa_passed
    result["qa_report"] = report
    result["qa_status_update"] = qa_status_update
    email_summary, email_summary_text = _build_email_summary(result, report)
    result["email_summary"] = email_summary
    result["email_summary_text"] = email_summary_text

    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    _msg(json.dumps({
        "status": result["status"],
        "email_summary": email_summary,
        "missing_fields": report["missing_fields"],
        "missing_warnings": report["missing_warnings"],
        "duplicate_nguid_count": report["nguid_summary"]["duplicate_nguid_count"],
        "address_duplicate_count": report.get("address_duplicates", {}).get("duplicate_nguid_count", 0),
        "qa_status_update": qa_status_update,
        "log_path": log_path,
    }, indent=2))

    _set_result_output(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        tb = traceback.format_exc()
        _err(f"Tool failed: {ex}")
        _err(tb)
        fail_result = {
            "timestamp": datetime.now().strftime("%Y%m%d_%H%M%S"),
            "success": False,
            "qa_passed": False,
            "status": "error",
            "error": str(ex),
            "traceback": tb,
        }
        try:
            _set_result_output(json.dumps(fail_result))
        except Exception:
            pass
        raise

