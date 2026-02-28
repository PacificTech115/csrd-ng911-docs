"""
Nightly orchestration notebook for ArcGIS Notebook (Standard runtime):
1) Reconcile/Post municipal versions into QA (web tool).
2) Run QA checks (schema + NGUID uniqueness) against the QA layer.
3) If QA passes, export QA to FGDB/ZIP via export web tool.

Edit the CONFIG section to match your environment. Everything writes a run
summary JSON to NB_RUN_DIR so you can review later.
"""

from arcgis.gis import GIS
from arcgis.geoprocessing import import_toolbox
from arcgis.features import FeatureSet
from collections import Counter
from datetime import datetime
import csv
import json
import os
import re
import time
from typing import Dict, List, Optional, Tuple

# -------------------------------------------------
# CONFIG — UPDATE FOR YOUR ENV
# -------------------------------------------------
# Web tools
RECON_GP_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Landbase/ReconcilePostTraditional/GPServer"
EXPORT_GP_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Landbase/ExportSSAP/GPServer"

# Inputs expected by the GP tools
# Updated to the new connection file name in the same folder.
SDE_CONN_UNC = r"\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde"
DEFAULT_VERSION = "sde.DEFAULT"
QA_VERSION = "SDE.QA"
EDITOR_VERSIONS = "SDE.CSRD;SDE.Revelstoke;SDE.Golden;SDE.Salmon Arm;SDE.Sicamous"
CONFLICT_POLICY = "ABORT_CONFLICTS"      # ABORT_CONFLICTS | NO_ABORT
ACQUIRE_LOCKS = "LOCK_ACQUIRED"          # LOCK_ACQUIRED | NO_LOCK_ACQUIRED

# QA tests
SCHEMA_JSON = r"C:\arcgis\home\Automation\SSAP_Schema.json"   # schema report JSON
# Leave DATASET_NAME blank/None to auto-use the first feature class found in the schema JSON.
DATASET_NAME: Optional[str] = None
TARGET_LAYER_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Regional/NG911_Address_QA/FeatureServer/0"
MODE = "all"              # "all" | "required" | "nonnullable"
CHECK_TYPES = True
CHECK_LENGTHS = True
CHECK_NGUID_FORMAT = False
NORMALIZE_NGUID = True
MAX_DUPES_TO_PRINT = 50
# Mandatory field checks
MANDATORY_FIELDS = ["DiscrpAgID", "DateUpdate", "NGUID", "Country", "A3", "A2", "A1"]
# Field used to detect duplicate full addresses; set to "" to skip
ADDRESS_DUP_FIELD = "Full_Addr"
ADDRESS_DUP_MAX_ROWS = 5000  # max rows to write in address dup CSV to avoid huge files
# Fields that may be listed as missing but should not fail QA (case-insensitive)
NON_BLOCKING_MISSING_FIELDS = ["shape"]

# Export
EXPORT_NAME_PREFIX = "SSAP_QA"

# Notebook-local paths
NB_RUN_DIR = "/arcgis/home/run_summaries"
SLEEP_AFTER_RECON_SEC = 2

# Notifications (Power Automate)
EMAIL_ON_COMPLETE = False  # Set to True to enable POST to your flow
POWER_AUTOMATE_FLOW_URL = ""  # HTTP POST trigger URL from your Power Automate flow
POWER_AUTOMATE_TIMEOUT_SEC = 15
# -------------------------------------------------


def ensure_local_dir(path: str):
    os.makedirs(path, exist_ok=True)


# ---------------- Reconcile helpers ----------------
def parse_result(payload):
    if payload is None:
        return {"success": False, "error": "Empty GP output (None)"}
    if isinstance(payload, dict) and ("success" in payload or "stage" in payload):
        if "result_json" in payload and isinstance(payload["result_json"], str):
            try:
                return json.loads(payload["result_json"])
            except Exception:
                return {"success": False, "error": "Could not parse result_json", "raw": payload["result_json"]}
        return payload
    if isinstance(payload, str):
        try:
            return json.loads(payload)
        except Exception:
            return {"success": False, "error": "Unrecognized GP output string", "raw": payload}
    return {"success": False, "error": f"Unrecognized GP output type: {type(payload)}", "raw": payload}


def unwrap_gp_response(resp):
    if hasattr(resp, "result") and callable(resp.result):
        return resp.result()
    return resp


def run_reconcile_stage(tbx, stage: str, gis):
    resp = tbx.reconcile_post_traditional(
        SDE_CONN_UNC,
        stage,
        QA_VERSION,
        DEFAULT_VERSION,
        EDITOR_VERSIONS,
        CONFLICT_POLICY,
        ACQUIRE_LOCKS,
        gis=gis
    )
    return parse_result(unwrap_gp_response(resp))


# ---------------- QA helpers ----------------
def normalize_type(t: Optional[str]) -> str:
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
        "esrifieldtypeblob": "Blob",
        "esrifieldtyperaster": "Raster",
    }
    arcpy_map = {
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
        "blob": "Blob",
    }
    if t_low in mapping:
        return mapping[t_low]
    if t_low in arcpy_map:
        return arcpy_map[t_low]
    return str(t)


def load_expected_fields(schema_path: str, dataset_name: Optional[str] = None, mode: str = "all") -> Dict[str, dict]:
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
    expected: Dict[str, dict] = {}
    for fld in fields:
        name = fld.get("name")
        if not name:
            continue
        required = bool(fld.get("required", False))
        is_nullable = fld.get("isNullable", True)
        include = True
        if mode.lower() == "required":
            include = required
        elif mode.lower() == "nonnullable":
            include = required or (is_nullable is False)
        if include:
            expected[name.lower()] = {
                "name": name,
                "type": normalize_type(fld.get("type")),
                "length": fld.get("length"),
                "required": required,
                "isNullable": is_nullable,
            }
    return expected


def detect_dataset_name(schema_path: str) -> str:
    """
    Returns the first feature class name found in the schema report.
    Raises ValueError if none exist.
    """
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)
    datasets = schema.get("datasets", [])
    fcs = [d for d in datasets if d.get("datasetType") == "esriDTFeatureClass"]
    if not fcs:
        raise ValueError("No feature classes found in schema JSON.")
    name = fcs[0].get("name")
    if not name:
        raise ValueError("Feature class in schema JSON is missing a name.")
    return name


def get_actual_fields(target: str) -> List[dict]:
    try:
        import arcpy
        if arcpy.Exists(target):
            out = []
            for f in arcpy.ListFields(target):
                out.append({"name": f.name, "type": normalize_type(f.type), "length": getattr(f, "length", None)})
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
        if not item:
            raise ValueError(f"Portal item not found: {item_id}")
        layers = getattr(item, "layers", None) or []
        if not layers:
            raise ValueError(f"Item has no layers: {item_id}")
        if layer_index >= len(layers):
            raise ValueError(f"Layer index {layer_index} out of range. Item has {len(layers)} layer(s).")
        lyr = layers[layer_index]
        fields = lyr.properties.get("fields", [])
        return [{"name": f["name"], "type": normalize_type(f.get("type")), "length": f.get("length")} for f in fields]
    fl = FeatureLayer(target, gis=gis)
    fields = fl.properties.get("fields", [])
    return [{"name": f["name"], "type": normalize_type(f.get("type")), "length": f.get("length")} for f in fields]


def compare_fields(expected: Dict[str, dict], actual: List[dict]):
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
        type_ok = None
        len_ok = None
        act_type = normalize_type(act["type"]) if act else ""
        act_len = act.get("length") if act else None
        if act and CHECK_TYPES:
            type_ok = (normalize_type(exp["type"]) == act_type)
        if act and CHECK_LENGTHS:
            exp_len = exp.get("length")
            len_ok = (exp_len == act_len) if exp_len is not None and act_len is not None else None
        details.append({
            "Field": exp["name"],
            "Status": status,
            "ExpectedType": exp["type"],
            "ActualType": act_type,
            "TypeMatch": type_ok if CHECK_TYPES else None,
            "ExpectedLength": exp.get("length"),
            "ActualLength": act_len,
            "LengthMatch": len_ok if CHECK_LENGTHS else None,
            "Required": exp.get("required"),
            "Nullable": exp.get("isNullable"),
        })
    return missing, extra, details


def _norm_nguid(val, normalize=True):
    if val is None:
        return None
    s = str(val).strip()
    if s == "":
        return ""
    return s.upper() if normalize else s


def summarize_nguid_values(values: list) -> dict:
    total = len(values)
    null_count = sum(v is None for v in values)
    empty_count = sum(v == "" for v in values if v is not None)
    candidates = [v for v in values if v not in (None, "")]
    counts = Counter(candidates)
    dupes = [(k, c) for k, c in counts.items() if c > 1]
    dupes.sort(key=lambda x: x[1], reverse=True)
    invalid = []
    if CHECK_NGUID_FORMAT:
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
        "invalid_examples": invalid[:MAX_DUPES_TO_PRINT],
    }


def check_nguid_uniqueness(target: str, nguid_field: str) -> dict:
    try:
        import arcpy
        if arcpy.Exists(target):
            values = []
            with arcpy.da.SearchCursor(target, [nguid_field]) as cur:
                for (v,) in cur:
                    values.append(_norm_nguid(v, NORMALIZE_NGUID))
            return summarize_nguid_values(values)
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
        if not item:
            raise ValueError(f"Portal item not found: {item_id}")
        layers = getattr(item, "layers", None) or []
        if not layers:
            raise ValueError(f"Item has no layers: {item_id}")
        if layer_index >= len(layers):
            raise ValueError(f"Layer index {layer_index} out of range. Item has {len(layers)} layer(s).")
        fl = layers[layer_index]
    else:
        fl = FeatureLayer(target, gis=gis)
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
            values.append(_norm_nguid(v, NORMALIZE_NGUID))
        if len(feats) < page_size:
            break
        offset += page_size
    return summarize_nguid_values(values)


def check_field_nulls(target: str, fields: List[str]) -> List[dict]:
    if not fields:
        return []
    # Try arcpy first for local data
    try:
        import arcpy
        if arcpy.Exists(target):
            totals = {f: 0 for f in fields}
            nulls = {f: 0 for f in fields}
            with arcpy.da.SearchCursor(target, fields) as cur:
                for row in cur:
                    for idx, val in enumerate(row):
                        fld = fields[idx]
                        totals[fld] += 1
                        if val in (None, ""):
                            nulls[fld] += 1
            return [{"field": f, "total": totals[f], "null_count": nulls[f], "non_null": totals[f] - nulls[f]} for f in fields]
    except Exception:
        pass

    # Feature layer fallback
    from arcgis.gis import GIS
    from arcgis.features import FeatureLayer
    gis = GIS("home")
    m = re.match(r"^([0-9a-fA-F]{32})(?::(\d+))?$", target.strip())
    if m:
        item_id = m.group(1)
        layer_index = int(m.group(2) or 0)
        item = gis.content.get(item_id)
        if not item:
            raise ValueError(f"Portal item not found: {item_id}")
        layers = getattr(item, "layers", None) or []
        if not layers:
            raise ValueError(f"Item has no layers: {item_id}")
        if layer_index >= len(layers):
            raise ValueError(f"Layer index {layer_index} out of range. Item has {len(layers)} layer(s).")
        fl = layers[layer_index]
    else:
        fl = FeatureLayer(target, gis=gis)

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


def _norm_text(val):
    if val is None:
        return None
    s = str(val).strip()
    if s == "":
        return ""
    return s.upper()


def _build_feature_link(base_url: str, oid) -> str:
    if not base_url or not str(base_url).lower().startswith("http") or oid is None:
        return ""
    return f"{base_url.rstrip('/')}/{oid}"


def check_field_duplicates(target: str, field_name: str) -> dict:
    if not field_name:
        return {"skipped": True, "reason": "field_name not provided"}
    field_name = field_name.strip()
    # Try arcpy
    try:
        import arcpy
        if arcpy.Exists(target):
            oid_field = arcpy.Describe(target).OIDFieldName
            values = []
            value_oids = []
            with arcpy.da.SearchCursor(target, [oid_field, field_name]) as cur:
                for oid, v in cur:
                    values.append(_norm_text(v))
                    value_oids.append((_norm_text(v), oid))
            base_summary = summarize_nguid_values(values)
            dupe_map = {}
            for val, oid in value_oids:
                if val in (None, ""):
                    continue
                dupe_map.setdefault(val, []).append(oid)
            dupes_detail = []
            for val, oids in dupe_map.items():
                if len(oids) > 1:
                    dupes_detail.append({
                        "value": val,
                        "count": len(oids),
                        "object_ids": oids,
                        "links": []  # arcpy path—no direct link
                    })
            base_summary["duplicates_detailed"] = dupes_detail
            return base_summary
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
        if not item:
            raise ValueError(f"Portal item not found: {item_id}")
        layers = getattr(item, "layers", None) or []
        if not layers:
            raise ValueError(f"Item has no layers: {item_id}")
        if layer_index >= len(layers):
            raise ValueError(f"Layer index {layer_index} out of range. Item has {len(layers)} layer(s).")
        fl = layers[layer_index]
    else:
        fl = FeatureLayer(target, gis=gis)

    # Validate field exists
    fields = [f["name"].lower() for f in fl.properties.get("fields", [])]
    if field_name.lower() not in fields:
        return {"skipped": True, "reason": f"field '{field_name}' not found"}

    oid_field = fl.properties.get("objectIdField") or "OBJECTID"
    values = []
    value_oids = []
    offset = 0
    page_size = 2000
    while True:
        try:
            res = fl.query(
                where="1=1",
                out_fields=f"{oid_field},{field_name}",
                return_geometry=False,
                result_record_count=page_size,
                result_offset=offset
            )
        except Exception as exc:
            return {"error": f"query failed for field '{field_name}': {exc}"}
        feats = res.features or []
        if not feats:
            break
        for feat in feats:
            v = (feat.attributes or {}).get(field_name)
            oid = (feat.attributes or {}).get(oid_field)
            norm = _norm_text(v)
            values.append(norm)
            value_oids.append((norm, oid))
        if len(feats) < page_size:
            break
        offset += page_size
    base_summary = summarize_nguid_values(values)
    dupe_map = {}
    for val, oid in value_oids:
        if val in (None, ""):
            continue
        dupe_map.setdefault(val, []).append(oid)
    dupes_detail = []
    for val, oids in dupe_map.items():
        if len(oids) > 1:
            dupes_detail.append({
                "value": val,
                "count": len(oids),
                "object_ids": oids,
                "links": [_build_feature_link(target, o) for o in oids if o is not None]
            })
    base_summary["duplicates_detailed"] = dupes_detail
    return base_summary


def write_address_dup_csv(dup_report: dict, run_id: str, base_url: str) -> Optional[str]:
    dupes = dup_report.get("duplicates_detailed") or []
    if not dupes:
        return None
    out_path = os.path.join(NB_RUN_DIR, f"address_duplicates_{run_id}.csv")
    rows_written = 0
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["FullAddress", "ObjectID", "Link"])
        for d in dupes:
            val = d.get("value")
            oids = d.get("object_ids") or []
            links = d.get("links") or []
            for idx, oid in enumerate(oids):
                link = links[idx] if idx < len(links) else _build_feature_link(base_url, oid)
                writer.writerow([val, oid, link])
                rows_written += 1
                if rows_written >= ADDRESS_DUP_MAX_ROWS:
                    writer.writerow(["TRUNCATED", "", f"Reached max rows {ADDRESS_DUP_MAX_ROWS}"])
                    return out_path
    return out_path


def run_qa_checks(target_layer: str, dataset_name: Optional[str] = None):
    ds_name = dataset_name or detect_dataset_name(SCHEMA_JSON)
    expected = load_expected_fields(SCHEMA_JSON, dataset_name=ds_name, mode=MODE)
    actual = get_actual_fields(target_layer)
    missing, extra, details = compare_fields(expected, actual)
    missing_names = [expected[k]["name"] for k in missing]
    missing_blocking = [name for name in missing_names if name.lower() not in NON_BLOCKING_MISSING_FIELDS]
    missing_warnings = [name for name in missing_names if name.lower() in NON_BLOCKING_MISSING_FIELDS]
    nguid_summary = check_nguid_uniqueness(target_layer, "NGUID")
    actual_map = {f["name"].lower(): f for f in actual}
    mandatory_missing = [f for f in MANDATORY_FIELDS if f.lower() not in actual_map]
    mandatory_present = [f for f in MANDATORY_FIELDS if f.lower() in actual_map]
    mandatory_nulls = check_field_nulls(target_layer, mandatory_present) if mandatory_present else []
    if ADDRESS_DUP_FIELD and ADDRESS_DUP_FIELD.lower() in actual_map:
        address_dupes = check_field_duplicates(target_layer, ADDRESS_DUP_FIELD)
    elif ADDRESS_DUP_FIELD:
        address_dupes = {"skipped": True, "reason": f"ADDRESS_DUP_FIELD '{ADDRESS_DUP_FIELD}' not found"}
    else:
        address_dupes = {"skipped": True, "reason": "ADDRESS_DUP_FIELD not set"}
    return {
        "expected_field_count": len(expected),
        "actual_field_count": len(actual),
        "dataset_name": ds_name,
        "missing_fields": missing_blocking,
        "missing_warnings": missing_warnings,
        "extra_fields": extra,
        "details": details,
        "nguid_summary": nguid_summary,
        "mandatory_missing": mandatory_missing,
        "mandatory_nulls": mandatory_nulls,
        "address_duplicates": address_dupes,
    }


def qa_passed(report: dict) -> bool:
    no_missing = len(report.get("missing_fields", [])) == 0
    no_mandatory_missing = len(report.get("mandatory_missing", [])) == 0
    mandatory_nulls_ok = all(item.get("null_count", 0) == 0 for item in report.get("mandatory_nulls", []))
    dupes_ok = report.get("nguid_summary", {}).get("duplicate_nguid_count", 0) == 0
    invalid_ok = report.get("nguid_summary", {}).get("invalid_format_count", 0) == 0 if CHECK_NGUID_FORMAT else True
    # Address duplicates are treated as warnings; do not block QA pass on them.
    return no_missing and no_mandatory_missing and mandatory_nulls_ok and dupes_ok and invalid_ok


# ---------------- Export helper ----------------
def run_export(tbx_export, gis):
    target_fc_param = FeatureSet.from_dict({"url": TARGET_LAYER_URL})
    resp = tbx_export.export_ssap(
        sde_conn=SDE_CONN_UNC,
        target_fc=target_fc_param,
        name_prefix=EXPORT_NAME_PREFIX,
        gis=gis
    )
    return parse_result(resp)


def send_power_automate_notification(summary: dict, status: str, run_summary_path: Optional[str] = None):
    """
    Posts the run summary to a Power Automate HTTP trigger so the flow can email it.
    Expects the flow URL to accept a JSON body. Only runs when EMAIL_ON_COMPLETE is True.
    """
    if not EMAIL_ON_COMPLETE:
        return {"skipped": True, "reason": "EMAIL_ON_COMPLETE is False"}
    flow_url = (POWER_AUTOMATE_FLOW_URL or "").strip()
    if not flow_url:
        return {"skipped": True, "reason": "POWER_AUTOMATE_FLOW_URL is empty"}
    try:
        import requests
    except Exception as exc:
        return {"error": f"requests import failed: {exc}"}

    payload = {
        "status": status,
        "run_id": summary.get("run_id"),
        "user": summary.get("user"),
        "started": summary.get("started"),
        "finished": summary.get("finished"),
        "gp_urls": summary.get("gp_urls"),
        "inputs": summary.get("inputs"),
        "stages": summary.get("stages"),
        "qa_report": summary.get("qa_report"),
        "run_summary_path": run_summary_path,
    }
    try:
        resp = requests.post(flow_url, json=payload, timeout=POWER_AUTOMATE_TIMEOUT_SEC)
        return {"status_code": resp.status_code, "text": resp.text[:500]}
    except Exception as exc:
        return {"error": str(exc)}


def finalize_run(summary: dict, run_id: str, status: str) -> str:
    summary["status"] = status
    summary["finished"] = datetime.now().isoformat(timespec="seconds")
    out_path = os.path.join(NB_RUN_DIR, f"nightly_run_{run_id}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    summary["run_summary_path"] = out_path
    print("Run summary saved:", out_path)
    notify_res = send_power_automate_notification(summary, status, out_path)
    if notify_res:
        print("Power Automate notify:", notify_res)
    return out_path


# ---------------- MAIN ----------------
def main():
    ensure_local_dir(NB_RUN_DIR)
    gis = GIS("home")
    user = gis.users.me.username if gis.users.me else "unknown"
    print("Signed in as:", user)

    dataset_name = DATASET_NAME or detect_dataset_name(SCHEMA_JSON)

    tbx_recon = import_toolbox(RECON_GP_URL, gis=gis)
    tbx_export = import_toolbox(EXPORT_GP_URL, gis=gis)

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    summary = {
        "run_id": run_id,
        "user": user,
        "started": datetime.now().isoformat(timespec="seconds"),
        "gp_urls": {"reconcile": RECON_GP_URL, "export": EXPORT_GP_URL},
        "inputs": {
            "sde_conn_unc": SDE_CONN_UNC,
            "default_version": DEFAULT_VERSION,
            "qa_version": QA_VERSION,
            "editor_versions": EDITOR_VERSIONS,
            "conflict_policy": CONFLICT_POLICY,
            "acquire_locks": ACQUIRE_LOCKS,
            "target_layer": TARGET_LAYER_URL,
            "schema_json": SCHEMA_JSON,
            "dataset_name": dataset_name,
        },
        "stages": {},
    }

    print("\n=== Stage 1: MUNI -> QA (reconcile/post) ===")
    res_recon = run_reconcile_stage(tbx_recon, "MUNI_TO_QA", gis)
    summary["stages"]["MUNI_TO_QA"] = res_recon
    print(json.dumps(res_recon, indent=2) if isinstance(res_recon, dict) else res_recon)

    if not (isinstance(res_recon, dict) and res_recon.get("success", False)):
        print("\n❌ Reconcile stage failed. Stopping.")
        finalize_run(summary, run_id, "reconcile_failed")
        return

    time.sleep(SLEEP_AFTER_RECON_SEC)

    print("\n=== Stage 2: QA checks (schema + NGUID) ===")
    qa_report = run_qa_checks(TARGET_LAYER_URL, dataset_name=dataset_name)
    addr_dupes = qa_report.get("address_duplicates") or {}
    if addr_dupes.get("duplicate_nguid_count", 0) > 0 and addr_dupes.get("duplicates_detailed"):
        addr_dupe_csv = write_address_dup_csv(addr_dupes, run_id, TARGET_LAYER_URL)
        if addr_dupe_csv:
            qa_report["address_duplicates_csv"] = addr_dupe_csv
    summary["qa_report"] = qa_report
    print(json.dumps({
        "missing_fields": qa_report["missing_fields"],
        "missing_warnings": qa_report.get("missing_warnings", []),
        "extra_fields": qa_report["extra_fields"][:10],
        "duplicate_nguid_count": qa_report["nguid_summary"]["duplicate_nguid_count"],
        "invalid_nguid_count": qa_report["nguid_summary"]["invalid_format_count"],
        "mandatory_missing": qa_report["mandatory_missing"],
        "mandatory_null_counts": {item["field"]: item["null_count"] for item in qa_report.get("mandatory_nulls", [])},
        "address_duplicate_count": qa_report.get("address_duplicates", {}).get("duplicate_nguid_count"),
        "address_duplicates_csv": qa_report.get("address_duplicates_csv"),
    }, indent=2))

    if not qa_passed(qa_report):
        print("\n❌ QA checks failed. Not exporting.")
        finalize_run(summary, run_id, "qa_failed")
        return

    print("\n=== Stage 3: Export QA FGDB/ZIP ===")
    res_export = run_export(tbx_export, gis)
    summary["stages"]["EXPORT_QA"] = res_export
    print(json.dumps(res_export, indent=2) if isinstance(res_export, dict) else res_export)

    summary["finished"] = datetime.now().isoformat(timespec="seconds")
    final_zip = None
    if isinstance(res_export, dict):
        final_zip = res_export.get("final_zip") or res_export.get("zip_path") or res_export.get("output_zip")
    if final_zip:
        summary["final_zip"] = final_zip
    status = "success" if (isinstance(res_export, dict) and res_export.get("success", False)) else "export_failed"
    print()
    finalize_run(summary, run_id, status)
    if isinstance(res_export, dict):
        if final_zip:
            print("Final ZIP path:", final_zip)


if __name__ == "__main__":
    main()

