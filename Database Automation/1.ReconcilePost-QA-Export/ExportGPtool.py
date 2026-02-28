import arcpy, os, json, traceback, zipfile, shutil
from datetime import datetime

FINAL_DROP_DIR = r"\\GIS\Scripts\Geoshare\NG911 Exports"
DEFAULT_TARGET_FC = r"SDE.CSRD_SSAP_V3_VersionTesting"

def _msg(s): arcpy.AddMessage(s)
def _warn(s): arcpy.AddWarning(s)
def _err(s): arcpy.AddError(s)

def ensure_dir(p): os.makedirs(p, exist_ok=True)

def write_test(folder: str, label: str):
    ensure_dir(folder)
    p = os.path.join(folder, f"__write_test_{label}.txt")
    with open(p, "w", encoding="utf-8") as f:
        f.write("ok")
    ok = os.path.exists(p)
    try:
        os.remove(p)
    except Exception:
        pass
    return ok

def zip_folder_skip_locks(folder_path: str, zip_path: str):
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(folder_path):
            for fn in files:
                if fn.lower().endswith(".lock"):
                    continue
                full = os.path.join(root, fn)
                rel = os.path.relpath(full, os.path.dirname(folder_path))
                zf.write(full, rel)

def release_gdb_locks():
    try:
        arcpy.env.workspace = None
    except Exception:
        pass
    try:
        arcpy.ClearWorkspaceCache_management()
    except Exception:
        pass

def _resolve_target_fc_input(sde_conn: str, target_fc_param_text: str) -> str:
    """
    Accept target_fc as either:
    - dataset path text, or
    - JSON text with {"url": "..."}.
    Returns a path usable under arcpy.env.workspace = sde_conn.
    """
    raw = (target_fc_param_text or "").strip()
    if not raw:
        return ""

    if raw.startswith("{"):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict) and parsed.get("url"):
                raw = str(parsed["url"]).strip()
        except Exception:
            # Keep raw string if it is not valid JSON.
            pass

    raw_norm = raw.replace("/", "\\")
    sde_norm = (sde_conn or "").replace("/", "\\").rstrip("\\")
    prefix = sde_norm + "\\"
    if sde_norm and raw_norm.lower().startswith(prefix.lower()):
        # Convert full path to workspace-relative dataset path.
        return raw_norm[len(prefix):]
    return raw_norm

def export_feature_class_from_sde(sde_conn: str, target_fc_name: str, out_fgdb: str):
    arcpy.env.workspace = sde_conn

    if not arcpy.Exists(target_fc_name):
        sample = (arcpy.ListFeatureClasses() or [])[:25]
        raise RuntimeError(
            f"Feature class not found in SDE workspace: {target_fc_name}\n"
            f"Sample FCs visible: {sample}"
        )

    desc = arcpy.Describe(target_fc_name)
    dt = getattr(desc, "datasetType", None)
    if str(dt).lower() != "featureclass":
        raise RuntimeError(f"Target is not a FeatureClass. datasetType={dt}")

    out_name = os.path.basename(target_fc_name)
    _msg(f"Exporting Feature Class: {target_fc_name} -> {out_name}")
    arcpy.conversion.FeatureClassToFeatureClass(target_fc_name, out_fgdb, out_name)

    return {"feature_class": target_fc_name, "output_name": out_name}

def main():
    # Republish this as:
    #   0 sde_conn    (File / GPDataFile)
    #   1 target_fc   (String path, e.g. SDE.NG911\\SDE.NG911_SiteAddress
    #                  or full path under same SDE connection)
    #   2 name_prefix (String)
    #   3 result_json (Derived output String)
    sde_conn = arcpy.GetParameterAsText(0)
    target_fc_text = arcpy.GetParameterAsText(1)
    name_prefix = arcpy.GetParameterAsText(2)

    if not sde_conn:
        raise ValueError("sde_conn is required.")
    if not name_prefix:
        raise ValueError("name_prefix is required.")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    target_fc_name = _resolve_target_fc_input(sde_conn, target_fc_text)
    if not target_fc_name:
        _warn(f"target_fc was blank; falling back to DEFAULT_TARGET_FC='{DEFAULT_TARGET_FC}'")
        target_fc_name = DEFAULT_TARGET_FC

    # Use ArcGIS scratch (most reliable for GP execution)
    scratch_folder = arcpy.env.scratchFolder or arcpy.env.scratchWorkspace
    if not scratch_folder:
        raise RuntimeError("No scratchFolder/scratchWorkspace available in this GP runtime.")

    _msg(f"scratchFolder: {scratch_folder}")

    # Verify scratch is writable
    if not write_test(scratch_folder, ts):
        raise RuntimeError(f"Scratch folder is not writable: {scratch_folder}")

    ensure_dir(FINAL_DROP_DIR)

    fgdb_name = f"{name_prefix}_{ts}.gdb"
    fgdb_path = os.path.join(scratch_folder, fgdb_name)

    if os.path.exists(fgdb_path):
        _warn(f"Removing existing FGDB folder: {fgdb_path}")
        shutil.rmtree(fgdb_path, ignore_errors=True)

    _msg(f"Creating FGDB in scratch: {fgdb_path}")
    arcpy.management.CreateFileGDB(scratch_folder, fgdb_name)

    export_info = export_feature_class_from_sde(sde_conn, target_fc_name, fgdb_path)

    release_gdb_locks()

    zip_name = f"{name_prefix}_{ts}.zip"
    zip_path_local = os.path.join(scratch_folder, zip_name)

    _msg(f"Zipping (skipping .lock files): {zip_path_local}")
    zip_folder_skip_locks(fgdb_path, zip_path_local)

    zip_path_final = os.path.join(FINAL_DROP_DIR, zip_name)
    shutil.copy2(zip_path_local, zip_path_final)
    _msg(f"Copied ZIP to: {zip_path_final}")

    result = {
        "success": True,
        "timestamp": ts,
        "sde_conn": sde_conn,
        "target_feature_class": target_fc_name,
        "scratch_folder": scratch_folder,
        "local_fgdb": fgdb_path,
        "local_zip": zip_path_local,
        "final_zip": zip_path_final,
        "final_drop_dir": FINAL_DROP_DIR,
        "export": export_info
    }

    # result_json output param index (4th parameter / index 3)
    arcpy.SetParameterAsText(3, json.dumps(result))

if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        tb = traceback.format_exc()
        _err(str(ex))
        _err(tb)
        try:
            arcpy.SetParameterAsText(3, json.dumps({"success": False, "error": str(ex), "traceback": tb}))
        except Exception:
            pass
        raise
