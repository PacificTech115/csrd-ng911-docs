"""
Standalone ArcGIS Notebook script:
Sync hosted source layer -> enterprise published feature service layer.

Supports:
1) Inserts
2) Updates (attributes + geometry)
3) Deletes

Only schema-approved fields are transferred (from SCHEMA_JSON).
"""

from arcgis.gis import GIS
from arcgis.features import FeatureLayer
from datetime import datetime, timezone
import json
import os

# -------------------------------------------------
# CONFIG — UPDATE FOR YOUR ENV
# -------------------------------------------------
SOURCE_FEATURESERVER_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Hosted/SalmonArmOverwrite/FeatureServer"
TARGET_FEATURESERVER_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Regional/NG911_Address_SalmonArm_Edit/FeatureServer"
LAYER_INDEX = 0

SCHEMA_JSON = r"/arcgis/home/Automation/SSAP_Schema.json"
SCHEMA_DATASET_NAME = ""  # leave blank to use first feature class in schema json

PRIMARY_KEY_FIELD = "NGUID"
ENABLE_GLOBALID_FALLBACK = True
FALLBACK_KEY_FIELD = "GlobalID"
ENABLE_FEATUREID_FALLBACK = True
SECONDARY_FALLBACK_KEY_FIELD = "Featureid"
ENABLE_REVERSE_ID_SYNC = True
SOURCE_CENTRAL_GLOBALID_FIELD = "CentralGlobalID"
OVERWRITE_EXISTING_SOURCE_IDS = False
BATCH_SIZE = 200
DELETE_MISSING_FROM_TARGET = True
DRY_RUN = False

NB_RUN_DIR = "/arcgis/home/run_summaries"

# Power Automate notification
EMAIL_ON_COMPLETE = True
POWER_AUTOMATE_FLOW_URL = "https://defaultdca3617080034b9ca1110db6ef334e.45.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/4b0541c4c84f4d498ff40258943b8d54/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ipcxe4nKKdTi2gsKRh7yl9HBtzm-WhEYG54C5GgAvHc"
POWER_AUTOMATE_TIMEOUT_SEC = 20
# -------------------------------------------------


def ensure_local_dir(path: str):
    os.makedirs(path, exist_ok=True)


def normalize_key(val):
    if val is None:
        return None
    s = str(val).strip()
    return s.upper() if s else None


def normalize_guid_key(val):
    s = normalize_key(val)
    if not s:
        return None
    return s.strip("{}()")


def is_system_field(field_name_lower: str, field_type: str):
    if field_type in ("esriFieldTypeOID", "esriFieldTypeGlobalID"):
        return True
    return field_name_lower in {
        "objectid",
        "globalid",
        "shape",
        "shape_length",
        "shape_area",
        "created_user",
        "created_date",
        "last_edited_user",
        "last_edited_date",
    }


def resolve_layer(url: str, layer_index: int):
    base = url.rstrip("/")
    if base.lower().endswith("/featureserver"):
        return FeatureLayer(f"{base}/{layer_index}")
    return FeatureLayer(base)


def get_object_id_field(layer: FeatureLayer) -> str:
    oid = getattr(layer.properties, "objectIdField", None)
    if not oid:
        raise RuntimeError(f"Layer {layer.url} does not expose objectIdField.")
    return str(oid)


def load_schema_field_names(schema_path: str, dataset_name: str):
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    datasets = schema.get("datasets", [])
    fcs = [d for d in datasets if d.get("datasetType") == "esriDTFeatureClass"]
    if not fcs:
        raise RuntimeError("No feature class definition found in schema json.")

    if dataset_name:
        picks = [d for d in fcs if d.get("name", "").lower() == dataset_name.lower()]
        if not picks:
            names = [d.get("name", "") for d in fcs]
            raise RuntimeError(f"Dataset '{dataset_name}' not found in schema json. Available: {names}")
        fc = picks[0]
    else:
        fc = fcs[0]

    fields = fc.get("fields", {}).get("fieldArray", [])
    names = [f.get("name") for f in fields if f.get("name")]
    return names


def get_field_maps(layer: FeatureLayer):
    fields = list(layer.properties.fields)
    by_lower = {str(f["name"]).lower(): f for f in fields}
    return fields, by_lower


def resolve_actual_field_name(layer: FeatureLayer, wanted_name: str) -> str:
    _, by_lower = get_field_maps(layer)
    key = (wanted_name or "").lower()
    if key not in by_lower:
        available = sorted([str(f["name"]) for f in layer.properties.fields])
        raise RuntimeError(f"Field '{wanted_name}' not found in layer {layer.url}. Available fields: {available}")
    return str(by_lower[key]["name"])


def resolve_actual_field_name_optional(layer: FeatureLayer, wanted_name: str):
    _, by_lower = get_field_maps(layer)
    key = (wanted_name or "").lower()
    if key not in by_lower:
        return None
    return str(by_lower[key]["name"])


def derive_transfer_fields(source_layer: FeatureLayer, target_layer: FeatureLayer, schema_fields, key_field: str):
    source_fields, source_map = get_field_maps(source_layer)
    target_fields, target_map = get_field_maps(target_layer)
    schema_lowers = {f.lower() for f in schema_fields}

    key_lower = key_field.lower()
    if key_lower not in source_map:
        raise RuntimeError(f"Primary key '{key_field}' not found in source layer.")
    if key_lower not in target_map:
        raise RuntimeError(f"Primary key '{key_field}' not found in target layer.")

    transfer = []
    for tf in target_fields:
        t_name = str(tf["name"])
        t_lower = t_name.lower()
        t_type = str(tf.get("type"))

        if t_lower not in schema_lowers:
            continue
        if t_lower not in source_map:
            continue
        if is_system_field(t_lower, t_type):
            continue
        transfer.append((source_map[t_lower]["name"], t_name))

    # Guarantee key is present in transfer list for inserts.
    if key_lower not in {t.lower() for _, t in transfer}:
        transfer.append((source_map[key_lower]["name"], target_map[key_lower]["name"]))

    return transfer


def fetch_all_features(layer: FeatureLayer, out_fields: str, return_geometry=True):
    all_features = []
    offset = 0
    page_size = 2000
    oid_field = get_object_id_field(layer)
    while True:
        fs = layer.query(
            where="1=1",
            out_fields=out_fields,
            return_geometry=return_geometry,
            result_offset=offset,
            result_record_count=page_size,
            order_by_fields=oid_field,
        )
        page = fs.features if fs and fs.features else []
        if not page:
            break
        all_features.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return all_features


def _epoch_ms_to_iso_utc(value):
    if value in (None, ""):
        return None
    try:
        return datetime.fromtimestamp(float(value) / 1000.0, timezone.utc).isoformat(timespec="seconds")
    except Exception:
        return None


def get_layer_last_edited_info(layer: FeatureLayer):
    field_map = {str(f["name"]).lower(): str(f["name"]) for f in layer.properties.fields}
    candidates = ["last_edited_date", "lasteditdate", "editdate"]
    last_field = None
    for c in candidates:
        if c in field_map:
            last_field = field_map[c]
            break

    info = {
        "field_name": last_field,
        "last_edited_utc": None,
        "source": "unknown",
    }

    # Preferred: max statistic on edit date field.
    if last_field:
        try:
            fs = layer.query(
                where="1=1",
                out_statistics=[
                    {
                        "statisticType": "max",
                        "onStatisticField": last_field,
                        "outStatisticFieldName": "max_edit_date",
                    }
                ],
                return_geometry=False,
            )
            if fs and fs.features:
                max_val = (fs.features[0].attributes or {}).get("max_edit_date")
                iso_val = _epoch_ms_to_iso_utc(max_val)
                if iso_val:
                    info["last_edited_utc"] = iso_val
                    info["source"] = f"max({last_field})"
                    return info
        except Exception:
            pass

    # Fallback: service metadata editingInfo.lastEditDate
    try:
        meta_last = getattr(getattr(layer.properties, "editingInfo", None), "lastEditDate", None)
        iso_val = _epoch_ms_to_iso_utc(meta_last)
        if iso_val:
            info["last_edited_utc"] = iso_val
            info["source"] = "editingInfo.lastEditDate"
            return info
    except Exception:
        pass

    return info


def geometry_changed(src_geom, tgt_geom):
    if src_geom is None and tgt_geom is None:
        return False
    if src_geom is None or tgt_geom is None:
        return True
    return json.dumps(src_geom, sort_keys=True) != json.dumps(tgt_geom, sort_keys=True)


def build_index(features, key_field_actual, normalizer=normalize_key):
    by_key = {}
    skipped = 0
    duplicate_key_count = 0
    duplicate_key_samples = []
    for feat in features:
        key = normalizer(feat.attributes.get(key_field_actual))
        if not key:
            skipped += 1
            continue
        if key in by_key:
            duplicate_key_count += 1
            if len(duplicate_key_samples) < 20:
                duplicate_key_samples.append(key)
        by_key[key] = feat
    return by_key, skipped, duplicate_key_count, duplicate_key_samples


def build_add_feature(src_feat, field_map_pairs, source_key_field, target_key_field):
    attrs = {}
    for s_name, t_name in field_map_pairs:
        attrs[t_name] = src_feat.attributes.get(s_name)
    # Ensure key is present even if field mapping didn't include it.
    if target_key_field not in attrs:
        attrs[target_key_field] = src_feat.attributes.get(source_key_field)
    return {"attributes": attrs, "geometry": src_feat.geometry}


def build_update_feature(src_feat, tgt_feat, field_map_pairs, oid_field):
    attrs = {oid_field: tgt_feat.attributes.get(oid_field)}
    changed = False
    for s_name, t_name in field_map_pairs:
        src_val = src_feat.attributes.get(s_name)
        tgt_val = tgt_feat.attributes.get(t_name)
        if src_val != tgt_val:
            attrs[t_name] = src_val
            changed = True
    geom_changed = geometry_changed(src_feat.geometry, tgt_feat.geometry)
    if not changed and not geom_changed:
        return None
    out = {"attributes": attrs}
    if geom_changed:
        out["geometry"] = src_feat.geometry
    return out


def chunks(items, size):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def run_edits(target_layer: FeatureLayer, adds, updates, delete_oids, dry_run=False):
    counts = {"adds": 0, "updates": 0, "deletes": 0}
    failures = []

    if dry_run:
        counts["adds"] = len(adds)
        counts["updates"] = len(updates)
        counts["deletes"] = len(delete_oids)
        return counts, failures

    for part in chunks(adds, BATCH_SIZE):
        res = target_layer.edit_features(adds=part, rollback_on_failure=False)
        add_res = (res or {}).get("addResults") or []
        counts["adds"] += sum(1 for r in add_res if r.get("success"))
        failures.extend([r for r in add_res if not r.get("success")])

    for part in chunks(updates, BATCH_SIZE):
        res = target_layer.edit_features(updates=part, rollback_on_failure=False)
        upd_res = (res or {}).get("updateResults") or []
        counts["updates"] += sum(1 for r in upd_res if r.get("success"))
        failures.extend([r for r in upd_res if not r.get("success")])

    for part in chunks(delete_oids, BATCH_SIZE):
        delete_str = ",".join(str(x) for x in part)
        res = target_layer.edit_features(deletes=delete_str, rollback_on_failure=False)
        del_res = (res or {}).get("deleteResults") or []
        counts["deletes"] += sum(1 for r in del_res if r.get("success"))
        failures.extend([r for r in del_res if not r.get("success")])

    return counts, failures


def build_reverse_id_updates(
    update_pairs,
    source_oid_field,
    source_nguid_field,
    source_central_globalid_field,
    target_nguid_field,
    target_globalid_field,
    overwrite_existing=False,
):
    updates = []
    for src_feat, tgt_feat, _, _ in update_pairs:
        src_attrs = src_feat.attributes or {}
        tgt_attrs = tgt_feat.attributes or {}
        src_oid = src_attrs.get(source_oid_field)
        if src_oid is None:
            continue

        patch = {source_oid_field: src_oid}
        changed = False

        # Sync NGUID back if source missing (or overwrite enabled).
        src_nguid = src_attrs.get(source_nguid_field)
        tgt_nguid = tgt_attrs.get(target_nguid_field)
        src_nguid_empty = normalize_key(src_nguid) is None
        if tgt_nguid is not None and (overwrite_existing or src_nguid_empty):
            if src_nguid != tgt_nguid:
                patch[source_nguid_field] = tgt_nguid
                changed = True

        # Sync target GlobalID into source CentralGlobalID (editable custom field).
        if source_central_globalid_field and target_globalid_field:
            src_central_gid = src_attrs.get(source_central_globalid_field)
            tgt_globalid = tgt_attrs.get(target_globalid_field)
            src_gid_empty = normalize_key(src_central_gid) is None
            if tgt_globalid is not None and (overwrite_existing or src_gid_empty):
                if src_central_gid != tgt_globalid:
                    patch[source_central_globalid_field] = tgt_globalid
                    changed = True

        if changed:
            updates.append({"attributes": patch})

    return updates


def run_source_id_sync_edits(source_layer: FeatureLayer, updates, dry_run=False):
    count = 0
    failures = []
    if dry_run:
        return len(updates), failures
    for part in chunks(updates, BATCH_SIZE):
        res = source_layer.edit_features(updates=part, rollback_on_failure=False)
        upd_res = (res or {}).get("updateResults") or []
        count += sum(1 for r in upd_res if r.get("success"))
        failures.extend([r for r in upd_res if not r.get("success")])
    return count, failures


def build_email_payload(result: dict) -> dict:
    key_stats = result.get("key_match_stats", {}) if isinstance(result, dict) else {}
    planned = result.get("planned", {}) if isinstance(result, dict) else {}
    applied = result.get("applied", {}) if isinstance(result, dict) else {}
    fallback_fields = result.get("fallback_key_fields", []) if isinstance(result, dict) else []
    status = "success" if bool(result.get("success")) else "failed"
    lines = [
        f"Hosted -> Enterprise Sync Status: {status}",
        f"Run ID: {result.get('run_id')}",
        f"Source last edited (UTC): {(result.get('source_last_edited') or {}).get('last_edited_utc')}",
        f"Primary match key: {result.get('primary_key_field')} ({result.get('source_key_field_actual')} -> {result.get('target_key_field_actual')})",
        f"Fallback keys: {fallback_fields}",
        (
            "Ops planned/applied: "
            f"inserts {planned.get('inserts', 0)}/{applied.get('adds', 0)}, "
            f"updates {planned.get('updates', 0)}/{applied.get('updates', 0)}, "
            f"deletes {planned.get('deletes', 0)}/{applied.get('deletes', 0)}"
        ),
        (
            "Key match stats: "
            f"matched={key_stats.get('matching_keys', 0)}, "
            f"source_only_after_fallback={key_stats.get('source_only_keys_after_fallback', 0)}, "
            f"target_only_after_fallback={key_stats.get('target_only_keys_after_fallback', 0)}"
        ),
        f"Edit failure count: {result.get('failure_count', 0)}",
    ]

    payload = {
        "status": status,
        "run_id": result.get("run_id"),
        "started": result.get("timestamp"),
        "finished": datetime.now().isoformat(timespec="seconds"),
        "workflow": "HostedToEnterpriseSync_SalmonArm",
        "source_layer": result.get("source"),
        "source_last_edited": result.get("source_last_edited", {}),
        "target_layer": result.get("target"),
        "dry_run": result.get("dry_run"),
        "matching_key": {
            "primary_key_field": result.get("primary_key_field"),
            "source_primary_key_actual": result.get("source_key_field_actual"),
            "target_primary_key_actual": result.get("target_key_field_actual"),
            "fallback_key_fields": fallback_fields,
            "fallback_match_stats": result.get("fallback_match_stats", {}),
            "key_match_stats": key_stats,
        },
        "operations": {
            "planned": planned,
            "applied": applied,
            "failure_count": result.get("failure_count", 0),
            "failure_samples": result.get("failure_samples", []),
            "reverse_id_sync": result.get("reverse_id_sync", {}),
        },
        "run_summary_path": result.get("run_summary_path"),
        "email_summary_text": "\n".join(lines),
    }
    return payload


def send_power_automate_notification(payload: dict):
    if not EMAIL_ON_COMPLETE:
        return {"skipped": True, "reason": "EMAIL_ON_COMPLETE is False"}
    flow_url = (POWER_AUTOMATE_FLOW_URL or "").strip()
    if not flow_url:
        return {"skipped": True, "reason": "POWER_AUTOMATE_FLOW_URL is empty"}
    try:
        import requests
    except Exception as exc:
        return {"error": f"requests import failed: {exc}"}
    try:
        resp = requests.post(flow_url, json=payload, timeout=POWER_AUTOMATE_TIMEOUT_SEC)
        return {"status_code": resp.status_code, "text": resp.text[:500]}
    except Exception as exc:
        return {"error": str(exc)}


def main():
    ensure_local_dir(NB_RUN_DIR)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    gis = GIS("home")
    user = gis.users.me.username if gis.users.me else "unknown"
    print("Signed in as:", user)

    source_layer = resolve_layer(SOURCE_FEATURESERVER_URL, LAYER_INDEX)
    target_layer = resolve_layer(TARGET_FEATURESERVER_URL, LAYER_INDEX)
    source_last_edited = get_layer_last_edited_info(source_layer)
    source_oid_field = get_object_id_field(source_layer)
    target_oid_field = get_object_id_field(target_layer)
    source_key_field = resolve_actual_field_name(source_layer, PRIMARY_KEY_FIELD)
    target_key_field = resolve_actual_field_name(target_layer, PRIMARY_KEY_FIELD)
    source_central_gid_field = resolve_actual_field_name_optional(source_layer, SOURCE_CENTRAL_GLOBALID_FIELD)
    target_globalid_field = resolve_actual_field_name_optional(target_layer, "GlobalID")
    fallback_definitions = []
    if ENABLE_GLOBALID_FALLBACK:
        s_fb = resolve_actual_field_name_optional(source_layer, FALLBACK_KEY_FIELD)
        t_fb = resolve_actual_field_name_optional(target_layer, FALLBACK_KEY_FIELD)
        if s_fb and t_fb:
            fallback_definitions.append(
                {
                    "name": "globalid_fallback",
                    "field_name": FALLBACK_KEY_FIELD,
                    "source_field": s_fb,
                    "target_field": t_fb,
                    "normalizer": normalize_guid_key,
                }
            )
        else:
            print(f"GlobalID fallback disabled: source field={s_fb}, target field={t_fb}")

    if ENABLE_FEATUREID_FALLBACK:
        s_fb2 = resolve_actual_field_name_optional(source_layer, SECONDARY_FALLBACK_KEY_FIELD)
        t_fb2 = resolve_actual_field_name_optional(target_layer, SECONDARY_FALLBACK_KEY_FIELD)
        if s_fb2 and t_fb2:
            fallback_definitions.append(
                {
                    "name": "featureid_fallback",
                    "field_name": SECONDARY_FALLBACK_KEY_FIELD,
                    "source_field": s_fb2,
                    "target_field": t_fb2,
                    "normalizer": normalize_key,
                }
            )
        else:
            print(f"Featureid fallback disabled: source field={s_fb2}, target field={t_fb2}")

    schema_fields = load_schema_field_names(SCHEMA_JSON, SCHEMA_DATASET_NAME)
    field_pairs = derive_transfer_fields(source_layer, target_layer, schema_fields, PRIMARY_KEY_FIELD)

    source_out_fields_set = {s for s, _ in field_pairs} | {source_key_field, source_oid_field}
    target_out_fields_set = {t for _, t in field_pairs} | {target_key_field, target_oid_field}
    for fb in fallback_definitions:
        source_out_fields_set.add(fb["source_field"])
        target_out_fields_set.add(fb["target_field"])
    source_out_fields = ",".join(sorted(source_out_fields_set))
    target_out_fields = ",".join(sorted(target_out_fields_set))

    src_features = fetch_all_features(source_layer, source_out_fields, return_geometry=True)
    tgt_features = fetch_all_features(target_layer, target_out_fields, return_geometry=True)

    src_index, src_skipped, src_dup_count, src_dup_samples = build_index(src_features, source_key_field)
    tgt_index, tgt_skipped, tgt_dup_count, tgt_dup_samples = build_index(tgt_features, target_key_field)

    source_keys = set(src_index.keys())
    target_keys = set(tgt_index.keys())

    insert_keys = sorted(source_keys - target_keys)
    candidate_update_keys = sorted(source_keys & target_keys)
    delete_keys = sorted(target_keys - source_keys) if DELETE_MISSING_FROM_TARGET else []

    fallback_stats = {
        "enabled": bool(fallback_definitions),
        "methods": {},
        "total_matched_count": 0,
    }

    # Start with strict primary-key matches.
    update_pairs = [(src_index[k], tgt_index[k], "primary", k) for k in candidate_update_keys]

    # Optional fallback match for records that did not match by primary key.
    fallback_matched_source_keys = set()
    fallback_matched_target_keys = set()
    for fb in fallback_definitions:
        source_only_features = [src_index[k] for k in insert_keys if k not in fallback_matched_source_keys]
        target_only_features = [tgt_index[k] for k in delete_keys if k not in fallback_matched_target_keys]
        src_fb_map, _, _, _ = build_index(
            source_only_features, fb["source_field"], normalizer=fb["normalizer"]
        )
        tgt_fb_map, _, _, _ = build_index(
            target_only_features, fb["target_field"], normalizer=fb["normalizer"]
        )
        fallback_keys = sorted(set(src_fb_map.keys()) & set(tgt_fb_map.keys()))
        for fk in fallback_keys:
            src_feat = src_fb_map[fk]
            tgt_feat = tgt_fb_map[fk]
            update_pairs.append((src_feat, tgt_feat, fb["name"], fk))
            s_key = normalize_key(src_feat.attributes.get(source_key_field))
            t_key = normalize_key(tgt_feat.attributes.get(target_key_field))
            if s_key:
                fallback_matched_source_keys.add(s_key)
            if t_key:
                fallback_matched_target_keys.add(t_key)
        fallback_stats["methods"][fb["name"]] = {
            "field_name": fb["field_name"],
            "source_field": fb["source_field"],
            "target_field": fb["target_field"],
            "matched_count": len(fallback_keys),
            "matched_key_samples": fallback_keys[:25],
        }
        fallback_stats["total_matched_count"] += len(fallback_keys)

    # Remove fallback-resolved keys from inserts/deletes.
    final_insert_keys = [k for k in insert_keys if k not in fallback_matched_source_keys]
    final_delete_keys = [k for k in delete_keys if k not in fallback_matched_target_keys]

    # Build edit payloads
    adds = [build_add_feature(src_index[k], field_pairs, source_key_field, target_key_field) for k in final_insert_keys]

    updates = []
    update_match_method_counts = {"primary": 0}
    for fb in fallback_definitions:
        update_match_method_counts[fb["name"]] = 0
    for src_feat, tgt_feat, method, _ in update_pairs:
        update_match_method_counts[method] = update_match_method_counts.get(method, 0) + 1
        upd = build_update_feature(src_feat, tgt_feat, field_pairs, target_oid_field)
        if upd:
            updates.append(upd)

    delete_oids = [tgt_index[k].attributes.get(target_oid_field) for k in final_delete_keys]
    delete_oids = [oid for oid in delete_oids if oid is not None]

    edit_counts, edit_failures = run_edits(target_layer, adds, updates, delete_oids, dry_run=DRY_RUN)

    reverse_id_sync = {
        "enabled": ENABLE_REVERSE_ID_SYNC,
        "source_central_globalid_field_actual": source_central_gid_field,
        "target_globalid_field_actual": target_globalid_field,
        "planned_updates": 0,
        "applied_updates": 0,
        "failure_count": 0,
        "failure_samples": [],
        "skipped": False,
        "reason": "",
    }

    if ENABLE_REVERSE_ID_SYNC:
        if not source_central_gid_field:
            reverse_id_sync["skipped"] = True
            reverse_id_sync["reason"] = f"Source field '{SOURCE_CENTRAL_GLOBALID_FIELD}' not found."
        else:
            reverse_updates = build_reverse_id_updates(
                update_pairs=update_pairs,
                source_oid_field=source_oid_field,
                source_nguid_field=source_key_field,
                source_central_globalid_field=source_central_gid_field,
                target_nguid_field=target_key_field,
                target_globalid_field=target_globalid_field,
                overwrite_existing=OVERWRITE_EXISTING_SOURCE_IDS,
            )
            reverse_id_sync["planned_updates"] = len(reverse_updates)
            applied, rev_failures = run_source_id_sync_edits(source_layer, reverse_updates, dry_run=DRY_RUN)
            reverse_id_sync["applied_updates"] = applied
            reverse_id_sync["failure_count"] = len(rev_failures)
            reverse_id_sync["failure_samples"] = rev_failures[:20]

    result = {
        "run_id": run_id,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "success": len(edit_failures) == 0,
        "dry_run": DRY_RUN,
        "user": user,
        "source": SOURCE_FEATURESERVER_URL,
        "source_last_edited": source_last_edited,
        "target": TARGET_FEATURESERVER_URL,
        "layer_index": LAYER_INDEX,
        "primary_key_field": PRIMARY_KEY_FIELD,
        "source_key_field_actual": source_key_field,
        "target_key_field_actual": target_key_field,
        "schema_json": SCHEMA_JSON,
        "schema_dataset_name": SCHEMA_DATASET_NAME,
        "schema_field_count": len(schema_fields),
        "transfer_field_count": len(field_pairs),
        "transfer_fields": [{"source": s, "target": t} for s, t in field_pairs],
        "source_count": len(src_features),
        "target_count_before": len(tgt_features),
        "source_skipped_missing_key": src_skipped,
        "target_skipped_missing_key": tgt_skipped,
        "source_duplicate_key_count": src_dup_count,
        "target_duplicate_key_count": tgt_dup_count,
        "source_duplicate_key_samples": src_dup_samples,
        "target_duplicate_key_samples": tgt_dup_samples,
        "fallback_key_fields": [fb["field_name"] for fb in fallback_definitions],
        "fallback_field_mappings": [
            {
                "method": fb["name"],
                "field_name": fb["field_name"],
                "source_field": fb["source_field"],
                "target_field": fb["target_field"],
            }
            for fb in fallback_definitions
        ],
        "fallback_match_stats": fallback_stats,
        "key_match_stats": {
            "source_unique_keys": len(source_keys),
            "target_unique_keys": len(target_keys),
            "matching_keys": len(candidate_update_keys),
            "source_only_keys_before_fallback": len(insert_keys),
            "target_only_keys_before_fallback": len(delete_keys),
            "source_only_keys_after_fallback": len(final_insert_keys),
            "target_only_keys_after_fallback": len(final_delete_keys),
            "source_only_key_samples": final_insert_keys[:25],
            "target_only_key_samples": final_delete_keys[:25],
            "update_pair_match_methods": update_match_method_counts,
        },
        "planned": {
            "inserts": len(adds),
            "updates": len(updates),
            "deletes": len(delete_oids),
        },
        "applied": edit_counts,
        "failure_count": len(edit_failures),
        "failure_samples": edit_failures[:20],
        "reverse_id_sync": reverse_id_sync,
    }

    out_path = os.path.join(NB_RUN_DIR, f"hosted_to_enterprise_sync_{run_id}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    result["run_summary_path"] = out_path

    print(json.dumps(result, indent=2))
    print("Run summary saved:", out_path)
    notify_payload = build_email_payload(result)
    notify_res = send_power_automate_notification(notify_payload)
    print("Notification:", notify_res)

    if not result["success"]:
        raise RuntimeError(f"Sync completed with {len(edit_failures)} edit failures.")


if __name__ == "__main__":
    main()


