"""
Python toolbox: Server-side QA for SSAP layer.
Runs schema/NGUID/mandatory/null/duplicate checks and can update QAStatus.
"""

import arcpy
import json
import os
import re
from collections import Counter, defaultdict

# Optional hardcoded connection/target (for enterprise GDB paths).
# Provide either HARDCODED_TARGET, or both HARDCODED_CONN_FILE and HARDCODED_DATASET.
# Example:
# HARDCODED_CONN_FILE = r"\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde"
# HARDCODED_DATASET = r"SDE.NG911\SDE.NG911_SiteAddress"
HARDCODED_CONN_FILE = r"\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde"
HARDCODED_DATASET = r"SDE.NG911\SDE.NG911_SiteAddress"
# If you prefer to set the full path directly, set HARDCODED_TARGET and leave the two above blank.
HARDCODED_TARGET = r""


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
    for fld in fields:
        name = fld.get("name")
        if not name:
            continue
        fld_type_norm = _normalize_type(fld.get("type"))
        if fld_type_norm.lower() == "geometry" or name.lower() == "shape":
            continue
        required = bool(fld.get("required", False))
        is_nullable = fld.get("isNullable", True)
        include = True
        if str(mode).lower() == "required":
            include = required
        elif str(mode).lower() == "nonnullable":
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
    try:
        if arcpy.Exists(target):
            out = []
            for f in arcpy.ListFields(target):
                out.append({"name": f.name, "type": _normalize_type(f.type), "length": getattr(f, "length", None)})
            return out
    except Exception:
        pass
    from arcgis.gis import GIS
    from arcgis.features import FeatureLayer

    gis = GIS("home")
    m = re.match(r"^([0-9a-fA-F]{32})(?::(\d+))?$", target.strip())
    if m:
        item_id = m.group(1)
        layer_index = int(m.group(2) or 0)
        item = gis.content.get(item_id)
        layers = getattr(item, "layers", None) or []
        lyr = layers[layer_index]
        fields = lyr.properties.get("fields", [])
        return [{"name": f["name"], "type": _normalize_type(f.get("type")), "length": f.get("length")} for f in fields]
    fl = FeatureLayer(target, gis=gis)
    fields = fl.properties.get("fields", [])
    return [{"name": f["name"], "type": _normalize_type(f.get("type")), "length": f.get("length")} for f in fields]


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
        "null_nguid": null_count,
        "empty_nguid": empty_count,
        "nonempty_nguid": len(candidates),
        "unique_nonempty_nguid": len(counts),
        "duplicate_nguid_count": len(dupes),
        "duplicate_examples": dupes,
        "invalid_format_count": len(invalid),
        "invalid_examples": invalid[:50],
    }


def _resolve_feature_layer(target):
    from arcgis.gis import GIS
    from arcgis.features import FeatureLayer

    gis = GIS("home")
    m = re.match(r"^([0-9a-fA-F]{32})(?::(\d+))?$", str(target).strip())
    if m:
        item_id = m.group(1)
        layer_index = int(m.group(2) or 0)
        item = gis.content.get(item_id)
        layers = getattr(item, "layers", None) or []
        if layer_index >= len(layers):
            raise ValueError(f"Layer index {layer_index} out of range for item {item_id}")
        return layers[layer_index]
    return FeatureLayer(target, gis=gis)


def _collect_attrs(fl, fields, page_size=2000):
    rows = []
    offset = 0
    out_fields = ",".join(fields)
    while True:
        res = fl.query(
            where="1=1",
            out_fields=out_fields,
            return_geometry=False,
            result_record_count=page_size,
            result_offset=offset
        )
        feats = res.features or []
        if not feats:
            break
        for feat in feats:
            rows.append(feat.attributes or {})
        if len(feats) < page_size:
            break
        offset += page_size
    return rows


def _check_nguid(fl, normalize=True, check_format=False):
    values = []
    offset = 0
    page_size = 2000
    while True:
        res = fl.query(
            where="1=1",
            out_fields="NGUID",
            return_geometry=False,
            result_record_count=page_size,
            result_offset=offset
        )
        feats = res.features or []
        if not feats:
            break
        for feat in feats:
            v = (feat.attributes or {}).get("NGUID")
            values.append(_norm_guid(v, normalize))
        if len(feats) < page_size:
            break
        offset += page_size
    return _summarize(values, check_format=check_format)


def _check_mandatory_nulls(fl, fields):
    if not fields:
        return []
    totals = {f: 0 for f in fields}
    nulls = {f: 0 for f in fields}
    offset = 0
    page_size = 2000
    out_fields = ",".join(fields)
    while True:
        res = fl.query(
            where="1=1",
            out_fields=out_fields,
            return_geometry=False,
            result_record_count=page_size,
            result_offset=offset
        )
        feats = res.features or []
        if not feats:
            break
        for feat in feats:
            attrs = feat.attributes or {}
            for f in fields:
                totals[f] += 1
                if attrs.get(f) in (None, ""):
                    nulls[f] += 1
        if len(feats) < page_size:
            break
        offset += page_size
    return [{"field": f, "total": totals[f], "null_count": nulls[f], "non_null": totals[f] - nulls[f]} for f in fields]


def _check_duplicates(fl, field_name):
    if not field_name:
        return {"skipped": True, "reason": "field_name not provided"}
    props = fl.properties or {}
    fields = [f["name"].lower() for f in props.get("fields", [])]
    if field_name.lower() not in fields:
        return {"skipped": True, "reason": f"field '{field_name}' not found"}
    oid_field = props.get("objectIdField") or "OBJECTID"
    values = []
    value_oids = []
    offset = 0
    page_size = 2000
    while True:
        res = fl.query(
            where="1=1",
            out_fields=f"{oid_field},{field_name}",
            return_geometry=False,
            result_record_count=page_size,
            result_offset=offset
        )
        feats = res.features or []
        if not feats:
            break
        for feat in feats:
            attrs = feat.attributes or {}
            v = attrs.get(field_name)
            oid = attrs.get(oid_field)
            norm = _norm_text(v)
            values.append(norm)
            value_oids.append((norm, oid))
        if len(feats) < page_size:
            break
        offset += page_size
    summary = _summarize(values, check_format=False)
    dup_map = {}
    for val, oid in value_oids:
        if val in (None, ""):
            continue
        dup_map.setdefault(val, []).append(oid)
    dupes_detail = []
    for val, oids in dup_map.items():
        if len(oids) > 1:
            dupes_detail.append({
                "value": val,
                "count": len(oids),
                "object_ids": oids,
            })
    summary["duplicates_detailed"] = dupes_detail
    return summary


def _build_qastatus_updates(fl, qa_report, qa_status_field, mandatory_fields, normalize_nguid):
    props = fl.properties or {}
    fields = props.get("fields", []) or []
    oid_field = props.get("objectIdField") or "OBJECTID"
    field_map = {f["name"].lower(): f["name"] for f in fields if f.get("name")}
    if qa_status_field.lower() not in field_map:
        return {"skipped": True, "reason": f"{qa_status_field} not found on layer"}
    mandatory_present = []
    for f in mandatory_fields:
        actual = field_map.get(f.lower())
        if actual:
            mandatory_present.append(actual)
    nguid_actual = field_map.get("nguid")
    addr_actual = None
    addr_field = (qa_report.get("address_duplicates") or {}).get("field_name") or ""
    if addr_field:
        addr_actual = field_map.get(addr_field.lower())
    query_fields = [oid_field]
    for f in mandatory_present:
        if f not in query_fields:
            query_fields.append(f)
    if nguid_actual and nguid_actual not in query_fields:
        query_fields.append(nguid_actual)
    if addr_actual and addr_actual not in query_fields:
        query_fields.append(addr_actual)
    rows = _collect_attrs(fl, query_fields)
    dup_nguid_values = {v for v, oids in (qa_report.get("nguid_duplicates") or []) if len(oids) > 1}
    dup_addr_values = set()
    for d in (qa_report.get("address_duplicates") or {}).get("duplicates_detailed", []):
        val = _norm_text(d.get("value"))
        if val:
            dup_addr_values.add(val)
    global_issues = []
    missing_fields = qa_report.get("missing_fields") or []
    mandatory_missing = qa_report.get("mandatory_missing") or []
    if missing_fields:
        global_issues.append(f"Missing fields: {', '.join(missing_fields)}")
    if mandatory_missing:
        global_issues.append(f"Mandatory fields missing: {', '.join(mandatory_missing)}")
    updates = []
    for attrs in rows:
        oid = attrs.get(oid_field)
        issues = list(global_issues)
        for f in mandatory_present:
            val = attrs.get(f)
            if val in (None, ""):
                issues.append(f"{f} is empty")
        if nguid_actual:
            nguid_val = _norm_guid(attrs.get(nguid_actual), normalize_nguid)
            if nguid_val in (None, ""):
                issues.append(f"{nguid_actual} is empty")
            elif nguid_val in dup_nguid_values:
                issues.append("Duplicate NGUID")
        if addr_actual:
            addr_val = _norm_text(attrs.get(addr_actual))
            if addr_val in dup_addr_values:
                issues.append("Duplicate address")
        status = "Passed" if not issues else "; ".join(dict.fromkeys(issues))
        updates.append({"attributes": {oid_field: oid, qa_status_field: status}})
    return {"updates": updates, "oid_field": oid_field}


def _apply_qastatus_updates(fl, updates, batch_size=500):
    total = len(updates)
    successes = 0
    failures = 0
    errors = []
    for i in range(0, total, batch_size):
        batch = updates[i:i + batch_size]
        try:
            res = fl.edit_features(updates=batch)
        except Exception as exc:
            failures += len(batch)
            errors.append(str(exc))
            continue
        if isinstance(res, dict) and "updateResults" in res:
            for r in res["updateResults"]:
                if r.get("success"):
                    successes += 1
                else:
                    failures += 1
                    if r.get("error"):
                        errors.append(str(r["error"]))
        else:
            failures += len(batch)
            errors.append(f"Unexpected edit_features response: {res}")
    return {"total": total, "successes": successes, "failures": failures, "errors": errors}


class Toolbox(object):
    def __init__(self):
        self.label = "SSAP QA Toolbox"
        self.alias = "ssapqa"
        self.tools = [RunSSAPQA]


class RunSSAPQA(object):
    def __init__(self):
        self.label = "Run SSAP QA"
        self.description = "Runs schema/NGUID QA for SSAP and optionally updates QAStatus."
        self.canRunInBackground = True
        self.name = "run_ssap_qa"

    def getParameterInfo(self):
        params = []
        params.append(arcpy.Parameter("use_hardcoded_target", "Use hardcoded target (ignores target_layer)", "Optional", "Boolean", "Input", value=False))
        params.append(arcpy.Parameter("target_layer", "Target layer (URL, itemid[:layer], or path)", "Optional", "String", "Input"))
        params.append(arcpy.Parameter("schema_json", "Schema JSON path", "Required", "File", "Input"))
        params.append(arcpy.Parameter("dataset_name", "Dataset name (optional)", "Optional", "String", "Input"))
        mode = arcpy.Parameter("mode", "Mode (all/required/nonnullable)", "Required", "String", "Input")
        mode.filter.list = ["all", "required", "nonnullable"]
        mode.value = "all"
        params.append(mode)
        params.append(arcpy.Parameter("check_types", "Check field types", "Required", "Boolean", "Input", value=True))
        params.append(arcpy.Parameter("check_lengths", "Check field lengths", "Required", "Boolean", "Input", value=True))
        params.append(arcpy.Parameter("check_nguid_format", "Check NGUID format", "Required", "Boolean", "Input", value=False))
        params.append(arcpy.Parameter("normalize_nguid", "Normalize NGUID to upper", "Required", "Boolean", "Input", value=True))
        params.append(arcpy.Parameter("mandatory_fields", "Mandatory fields (; delimited)", "Optional", "String", "Input"))
        params.append(arcpy.Parameter("address_dup_field", "Address duplicate field", "Optional", "String", "Input", value="Full_Addr"))
        params.append(arcpy.Parameter("address_dup_max_rows", "Address dup max rows", "Optional", "Long", "Input", value=5000))
        params.append(arcpy.Parameter("qa_status_field", "QAStatus field name", "Optional", "String", "Input", value="QAStatus"))
        params.append(arcpy.Parameter("update_qa_status", "Update QAStatus", "Optional", "Boolean", "Input", value=True))
        out_json = arcpy.Parameter("qa_report", "QA report (JSON)", "Derived", "String", "Output")
        params.append(out_json)
        return params

    def isLicensed(self):
        return True

    def updateParameters(self, parameters):
        return

    def execute(self, parameters, messages):
        use_hardcoded_target = bool(parameters[0].value)
        target_layer = parameters[1].valueAsText
        schema_json = parameters[2].valueAsText
        dataset_name = parameters[3].valueAsText
        mode = parameters[4].valueAsText or "all"
        check_types = parameters[5].value
        check_lengths = parameters[6].value
        check_nguid_format = parameters[7].value
        normalize_nguid = parameters[8].value
        mandatory_fields_raw = parameters[9].valueAsText or ""
        address_dup_field = parameters[10].valueAsText or ""
        address_dup_max_rows = int(parameters[11].value) if parameters[11].value not in (None, "") else 5000
        qa_status_field = parameters[12].valueAsText or "QAStatus"
        update_qa_status = bool(parameters[13].value)

        if use_hardcoded_target:
            target_layer = HARDCODED_TARGET.strip()
            if not target_layer and HARDCODED_CONN_FILE and HARDCODED_DATASET:
                target_layer = os.path.join(HARDCODED_CONN_FILE, HARDCODED_DATASET)
            if not target_layer:
                raise ValueError("Hardcoded target not set. Populate HARDCODED_TARGET or HARDCODED_CONN_FILE + HARDCODED_DATASET, or disable 'use hardcoded target'.")
        if not target_layer:
            raise ValueError("target_layer is required (or enable 'use hardcoded target').")

        mandatory_fields = [f.strip() for f in mandatory_fields_raw.split(";") if f.strip()] if mandatory_fields_raw else []

        report = {
            "dataset_name": dataset_name,
            "target_layer": target_layer,
            "schema_json": schema_json,
        }

        expected = _load_expected_fields(schema_json, dataset_name=dataset_name, mode=mode)
        actual = _get_actual_fields(target_layer)
        missing, extra, details = _compare_fields(expected, actual, check_types, check_lengths)
        report["expected_field_count"] = len(expected)
        report["actual_field_count"] = len(actual)
        report["missing_fields"] = [expected[k]["name"] for k in missing]
        report["extra_fields"] = extra
        report["details"] = details

        fl = _resolve_feature_layer(target_layer)
        report["nguid_summary"] = _check_nguid(fl, normalize=normalize_nguid, check_format=check_nguid_format)
        actual_map = {f["name"].lower(): f for f in actual}
        mandatory_missing = [f for f in mandatory_fields if f.lower() not in actual_map]
        mandatory_present = [f for f in mandatory_fields if f.lower() in actual_map]
        report["mandatory_missing"] = mandatory_missing
        report["mandatory_nulls"] = _check_mandatory_nulls(fl, mandatory_present) if mandatory_present else []

        addr_dupes = {"skipped": True, "reason": "ADDRESS_DUP_FIELD not set"}
        if address_dup_field:
            addr_dupes = _check_duplicates(fl, address_dup_field)
            addr_dupes["field_name"] = address_dup_field
            # Write CSV if duplicates exist
            if addr_dupes.get("duplicate_nguid_count", 0) > 0 and addr_dupes.get("duplicates_detailed"):
                csv_path = os.path.join(arcpy.env.scratchFolder, f"address_duplicates.csv")
                rows_written = 0
                with open(csv_path, "w", encoding="utf-8", newline="") as f:
                    import csv as _csv
                    writer = _csv.writer(f)
                    writer.writerow(["FullAddress", "ObjectID"])
                    for d in addr_dupes.get("duplicates_detailed", []):
                        val = d.get("value")
                        for oid in d.get("object_ids", []):
                            writer.writerow([val, oid])
                            rows_written += 1
                            if rows_written >= address_dup_max_rows:
                                writer.writerow(["TRUNCATED", "", f"Reached max rows {address_dup_max_rows}"])
                                break
                        if rows_written >= address_dup_max_rows:
                            break
                addr_dupes["csv_path"] = csv_path
                report["address_duplicates_csv"] = csv_path
        report["address_duplicates"] = addr_dupes

        qa_status_update = {"skipped": True, "reason": "update disabled"}
        if update_qa_status:
            build = _build_qastatus_updates(fl, report, qa_status_field, mandatory_fields, normalize_nguid)
            if not build.get("skipped"):
                qa_status_update = _apply_qastatus_updates(fl, build.get("updates") or [])
            else:
                qa_status_update = build

        result = {
            "success": True,
            "qa_report": report,
            "qa_status_update": qa_status_update,
        }
        messages.addMessage(json.dumps(result, indent=2))
        parameters[-1].value = json.dumps(result)
        return result

