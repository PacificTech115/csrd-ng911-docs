import json
import os
import re
import csv
from typing import Dict, List, Optional, Tuple
from collections import Counter

# ---- INPUTS ----
SCHEMA_JSON = r"C:\arcgis\SSAP_SalmonArm.json"   # your schema report JSON
TARGET_LAYER = "https://apps.csrd.bc.ca/arcgis/rest/services/Landbase/SSAP_Salmon_Arm/FeatureServer/1"
DATASET_NAME = "SSAP_SalmonArm"  # dataset inside the JSON; set None to use first feature class

MODE = "all"          # "all" (recommended) | "required" | "nonnullable"
CHECK_TYPES = True    # compare expected vs actual field types
CHECK_LENGTHS = True  # compare expected vs actual string length (and numeric length where available)

EXPORT_CSV = True
CSV_OUT = "field_check_report.csv"

# ---- NGUID UNIQUENESS INPUTS ----
NGUID_FIELD = "NGUID"         # change if your field name differs
CHECK_NGUID_FORMAT = False    # True = basic GUID format validation
NORMALIZE_NGUID = True        # True = strip + uppercase for comparison
MAX_DUPES_TO_PRINT = 50       # limit console spam
EXPORT_NGUID_CSV = True
NGUID_CSV_OUT = "nguid_uniqueness_report.csv"


# ---- HELPERS ----
def normalize_type(t: Optional[str]) -> str:
    """Return a canonical ESRI-ish type string."""
    if not t:
        return ""
    t = str(t)
    t_low = t.lower()

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
    if t_low in mapping:
        return mapping[t_low]

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
    if t_low in arcpy_map:
        return arcpy_map[t_low]

    return t  # fallback


def load_expected_fields(schema_path: str, dataset_name: Optional[str] = None, mode: str = "all") -> Dict[str, dict]:
    """
    Returns dict keyed by lowercase field name -> schema properties.
    mode:
      - "all": include every field listed in schema report (best for schema conformance)
      - "required": only fields where schema 'required' == True
      - "nonnullable": fields where required==True OR isNullable==False
    """
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
                "aliasName": fld.get("aliasName", ""),
            }

    return expected


def get_actual_fields(target: str) -> List[dict]:
    """
    Gets fields from:
      - local dataset path readable by arcpy (feature class/table/layer)
      - feature layer REST URL
      - Portal item id with optional ':<layer_index>' suffix (e.g., 'abcd...1234:0')
    Returns list of dicts: name, type, length
    """
    # 1) Try arcpy first (local FC / SDE / layer)
    try:
        import arcpy
        if arcpy.Exists(target):
            out = []
            for f in arcpy.ListFields(target):
                out.append({
                    "name": f.name,
                    "type": normalize_type(f.type),
                    "length": getattr(f, "length", None),
                })
            return out
    except Exception:
        pass

    # 2) Try ArcGIS API for Python (URL or Item)
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


def compare_fields(expected: Dict[str, dict], actual: List[dict]) -> Tuple[List[str], List[str], List[dict]]:
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


# ---- NGUID UNIQUENESS HELPERS ----
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
        "duplicate_examples": dupes,  # list of (nguid, count)
        "invalid_format_count": len(invalid),
        "invalid_examples": invalid[:MAX_DUPES_TO_PRINT],
    }


def check_nguid_uniqueness(target: str, nguid_field: str) -> dict:
    """
    Checks null/empty and duplicate NGUIDs.
    Works for:
      - arcpy-readable layers/feature classes
      - FeatureServer URL
      - Portal item id (32-hex) with optional ':<layer_index>'
    """
    # 1) Try arcpy
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

    # 2) ArcGIS API for Python
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

    # Query all records (pagination)
    values = []
    offset = 0
    page_size = 2000

    while True:
        res = fl.query(
            where="1=1",
            out_fields=nguid_field,
            return_geometry=False,
            result_record_count=page_size,
            result_offset=offset
        )

        feats = res.features or []
        if not feats:
            break

        for feat in feats:
            v = (feat.attributes or {}).get(nguid_field)
            values.append(_norm_nguid(v, NORMALIZE_NGUID))

        # stop when service returns fewer than page_size
        if len(feats) < page_size:
            break

        offset += page_size

    return summarize_nguid_values(values)


# ---- RUN FIELD CHECKS ----
expected = load_expected_fields(SCHEMA_JSON, dataset_name=DATASET_NAME, mode=MODE)
actual = get_actual_fields(TARGET_LAYER)

missing, extra, details = compare_fields(expected, actual)

print(f"Schema JSON: {SCHEMA_JSON}")
print(f"Target: {TARGET_LAYER}")
print(f"Mode: {MODE} | Expected fields: {len(expected)} | Actual fields: {len(actual)}")
print("-" * 60)

if missing:
    print(f"❌ Missing fields ({len(missing)}):")
    for f in missing:
        print("  -", expected[f]["name"])
else:
    print("✅ No missing fields.")

if extra:
    print(f"\nℹ️ Extra fields in target (not in schema) ({len(extra)}):")
    for f in extra[:50]:
        print("  -", f)
    if len(extra) > 50:
        print(f"  ... ({len(extra)-50} more)")
print("-" * 60)

if EXPORT_CSV and details:
    with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(details[0].keys()))
        writer.writeheader()
        writer.writerows(details)
    print(f"CSV report written: {os.path.abspath(CSV_OUT)}")


# ---- RUN NGUID UNIQUENESS CHECK ----
print("\nNGUID uniqueness check")
print("-" * 60)

nguid_summary = check_nguid_uniqueness(TARGET_LAYER, NGUID_FIELD)

print(f"Total records: {nguid_summary['total_records']}")
print(f"Null NGUID: {nguid_summary['null_nguid']}")
print(f"Empty NGUID: {nguid_summary['empty_nguid']}")
print(f"Non-empty NGUID: {nguid_summary['nonempty_nguid']}")
print(f"Unique (non-empty) NGUID: {nguid_summary['unique_nonempty_nguid']}")
print(f"Duplicate NGUID values: {nguid_summary['duplicate_nguid_count']}")

if nguid_summary["duplicate_nguid_count"] > 0:
    print("\n❌ Duplicate NGUIDs (top):")
    for ng, ct in nguid_summary["duplicate_examples"][:MAX_DUPES_TO_PRINT]:
        print(f"  - {ng}: {ct} records")
else:
    print("✅ No duplicate NGUIDs found (among non-empty values).")

if CHECK_NGUID_FORMAT:
    print(f"\nInvalid-format NGUIDs: {nguid_summary['invalid_format_count']}")
    if nguid_summary["invalid_format_count"] > 0:
        for v in nguid_summary["invalid_examples"]:
            print("  -", v)

if EXPORT_NGUID_CSV:
    rows = [{"NGUID": ng, "Count": ct} for ng, ct in nguid_summary["duplicate_examples"]]
    with open(NGUID_CSV_OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["NGUID", "Count"])
        w.writeheader()
        w.writerows(rows)
    print(f"NGUID duplicate report written: {os.path.abspath(NGUID_CSV_OUT)}")
