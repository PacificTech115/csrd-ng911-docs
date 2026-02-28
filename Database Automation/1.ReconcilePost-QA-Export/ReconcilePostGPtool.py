# ReconcilePostTraditional.py
# Traditional versioning reconcile/post automation (ArcPy)
# Supports two stages:
#   - MUNI_TO_QA    : reconcile/post multiple municipal versions into QA
#   - QA_TO_DEFAULT : reconcile/post QA into DEFAULT
#   - DEFAULT_TO_MUNI_SYNC : reconcile DEFAULT into municipal versions (NO_POST)
#
# Expected Script Tool parameters (ORDER MATTERS):
#   0 sde_conn         (File)
#   1 stage            (String) -> "MUNI_TO_QA" | "QA_TO_DEFAULT" | "DEFAULT_TO_MUNI_SYNC"
#   2 qa_version       (String) -> e.g., "SDE.QA"
#   3 default_version  (String) -> e.g., "sde.DEFAULT"
#   4 editor_versions  (String) -> semicolon list: "SDE.CSRD;SDE.Sicamous;..."
#   5 out_log_folder   (Folder)
#   6 conflict_policy  (String) -> "ABORT_CONFLICTS" or "NO_ABORT"
#   7 acquire_locks    (String) -> "LOCK_ACQUIRED" or "NO_LOCK_ACQUIRED"
#   8 result_json      (String, OUTPUT/DERIVED)

import arcpy
import os
import json
import traceback
from datetime import datetime

# -----------------------------
# Helpers
# -----------------------------
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
    """
    Normalizes semicolon-separated version list:
    - strips whitespace around tokens
    - removes empty entries
    """
    if not s:
        return ""
    parts = [p.strip() for p in s.split(";")]
    parts = [p for p in parts if p]
    return ";".join(parts)

def _validate_choice(val: str, allowed: set, name: str):
    if val not in allowed:
        raise ValueError(f"Invalid {name}='{val}'. Allowed: {sorted(list(allowed))}")

def _write_log_stub(log_path: str, header: str):
    # Prove we reached the point where a log path exists
    with open(log_path, "w", encoding="utf-8") as f:
        f.write(header + "\n")

def _reconcile_versions(workspace: str,
                        target_version: str,
                        edit_versions: str,
                        acquire_locks: str,
                        abort_if_conflicts: str,
                        out_log: str,
                        conflict_definition: str = "BY_ATTRIBUTE",
                        conflict_resolution: str = "FAVOR_EDIT_VERSION",
                        with_post: str = "POST",
                        with_delete: str = "KEEP_VERSION"):
    """
    Runs ReconcileVersions for traditional versioning.
    NOTE: reconcile_mode must be ALL_VERSIONS or BLOCKING_VERSIONS.
    We'll use ALL_VERSIONS and pass edit_versions to control scope.
    """
    arcpy.management.ReconcileVersions(
        workspace,              # in_workspace
        "ALL_VERSIONS",         # reconcile_mode (MUST be ALL_VERSIONS | BLOCKING_VERSIONS)
        target_version,         # target_version
        edit_versions,          # edit_versions (semicolon-separated list OR single version)
        acquire_locks,          # LOCK_ACQUIRED | NO_LOCK_ACQUIRED
        abort_if_conflicts,     # ABORT_CONFLICTS | NO_ABORT
        conflict_definition,    # BY_OBJECT | BY_ATTRIBUTE
        conflict_resolution,    # FAVOR_TARGET_VERSION | FAVOR_EDIT_VERSION
        with_post,              # POST | NO_POST
        with_delete,            # DELETE_VERSION | KEEP_VERSION
        out_log                 # out_log
    )
    return arcpy.GetMessages()

# -----------------------------
# Main
# -----------------------------
def main():
    # Read parameters (ORDER MUST MATCH SCRIPT TOOL)
    sde_conn        = arcpy.GetParameterAsText(0)
    stage           = arcpy.GetParameterAsText(1)
    qa_version      = arcpy.GetParameterAsText(2)
    default_version = arcpy.GetParameterAsText(3)
    editor_versions = arcpy.GetParameterAsText(4)
    out_log_folder  = arcpy.GetParameterAsText(5)
    conflict_policy = arcpy.GetParameterAsText(6)
    acquire_locks   = arcpy.GetParameterAsText(7)

    # Normalize lists
    editor_versions_norm = _normalize_list(editor_versions)

    # Timestamp and base result
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    result = {
        "timestamp": ts,
        "stage": stage,
        "success": False,
        "log_path": None,
        "messages": None,
        "inputs": {
            "sde_conn": sde_conn,
            "qa_version": qa_version,
            "default_version": default_version,
            "editor_versions": editor_versions_norm,
            "out_log_folder": out_log_folder,
            "conflict_policy": conflict_policy,
            "acquire_locks": acquire_locks,
        }
    }

    # Debug print all params (so you see if Pro is passing them correctly)
    _msg("DEBUG PARAMS RECEIVED:")
    _msg(f"  sde_conn        = '{sde_conn}'")
    _msg(f"  stage           = '{stage}'")
    _msg(f"  qa_version      = '{qa_version}'")
    _msg(f"  default_version = '{default_version}'")
    _msg(f"  editor_versions = '{editor_versions_norm}'")
    _msg(f"  out_log_folder  = '{out_log_folder}'")
    _msg(f"  conflict_policy = '{conflict_policy}'")
    _msg(f"  acquire_locks   = '{acquire_locks}'")

    # Validate basic inputs
    if not sde_conn:
        raise ValueError("sde_conn is blank.")
    if not stage:
        raise ValueError("stage is blank.")
    if not qa_version:
        raise ValueError("qa_version is blank.")
    if not default_version:
        raise ValueError("default_version is blank.")

    # Validate choices (must match ArcPy accepted strings)
    _validate_choice(stage, {"MUNI_TO_QA", "QA_TO_DEFAULT", "DEFAULT_TO_MUNI_SYNC"}, "stage")
    _validate_choice(conflict_policy, {"ABORT_CONFLICTS", "NO_ABORT"}, "conflict_policy")
    _validate_choice(acquire_locks, {"LOCK_ACQUIRED", "NO_LOCK_ACQUIRED"}, "acquire_locks")

    # Ensure log folder exists
    _ensure_dir(out_log_folder)

    # Build log path and write stub immediately
    if stage == "MUNI_TO_QA":
        log_path = os.path.join(out_log_folder, f"reconcile_muni_to_QA_{ts}.txt")
    elif stage == "QA_TO_DEFAULT":
        log_path = os.path.join(out_log_folder, f"reconcile_QA_to_DEFAULT_{ts}.txt")
    else:
        log_path = os.path.join(out_log_folder, f"reconcile_DEFAULT_to_MUNI_sync_{ts}.txt")

    _write_log_stub(log_path, f"LOG START | {stage} | {ts}")
    result["log_path"] = log_path
    _msg(f"Log file created (stub): {log_path}")

    # Execute reconcile/post
    if stage == "MUNI_TO_QA":
        if not editor_versions_norm:
            raise ValueError("editor_versions is blank for MUNI_TO_QA stage.")

        _msg("Running ReconcileVersions: MUNICIPAL -> QA (POST enabled)")
        msgs = _reconcile_versions(
            workspace=sde_conn,
            target_version=qa_version,
            edit_versions=editor_versions_norm,
            acquire_locks=acquire_locks,
            abort_if_conflicts=conflict_policy,
            out_log=log_path,
            conflict_definition="BY_ATTRIBUTE",
            conflict_resolution="FAVOR_EDIT_VERSION",
            with_post="POST",
            with_delete="KEEP_VERSION"
        )
        result["messages"] = msgs
        result["success"] = True

    elif stage == "QA_TO_DEFAULT":
        _msg("Running ReconcileVersions: QA -> DEFAULT (POST enabled)")
        msgs = _reconcile_versions(
            workspace=sde_conn,
            target_version=default_version,
            edit_versions=qa_version,   # reconcile/post QA into DEFAULT
            acquire_locks=acquire_locks,
            abort_if_conflicts=conflict_policy,
            out_log=log_path,
            conflict_definition="BY_ATTRIBUTE",
            conflict_resolution="FAVOR_EDIT_VERSION",
            with_post="POST",
            with_delete="KEEP_VERSION"
        )
        result["messages"] = msgs
        result["success"] = True

    elif stage == "DEFAULT_TO_MUNI_SYNC":
        if not editor_versions_norm:
            raise ValueError("editor_versions is blank for DEFAULT_TO_MUNI_SYNC stage.")

        _msg("Running ReconcileVersions: DEFAULT -> MUNICIPAL (NO_POST, sync QAStatus back to editor versions)")
        msgs = _reconcile_versions(
            workspace=sde_conn,
            target_version=default_version,
            edit_versions=editor_versions_norm,
            acquire_locks=acquire_locks,
            abort_if_conflicts=conflict_policy,
            out_log=log_path,
            conflict_definition="BY_ATTRIBUTE",
            # For sync-down stage we want target(DEFAULT) values (including QAStatus)
            # to win when the same attribute conflicts.
            conflict_resolution="FAVOR_TARGET_VERSION",
            with_post="NO_POST",
            with_delete="KEEP_VERSION"
        )
        result["messages"] = msgs
        result["success"] = True

    # Return JSON output (Parameter 8 must be OUTPUT/DERIVED)
    arcpy.SetParameterAsText(8, json.dumps(result))
    _msg("result_json written to output parameter.")

# Entry point with robust error capture
if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        # Try to still write result_json if possible
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        tb = traceback.format_exc()

        try:
            # Attempt to read out_log_folder to write a failure stub if we can
            out_log_folder = arcpy.GetParameterAsText(5)
            if out_log_folder:
                os.makedirs(out_log_folder, exist_ok=True)
                fail_log = os.path.join(out_log_folder, f"FAILED_{ts}.txt")
                with open(fail_log, "w", encoding="utf-8") as f:
                    f.write(tb)
                _warn(f"Wrote failure traceback log: {fail_log}")
        except Exception:
            pass

        _err(f"Tool failed: {ex}")
        _err(tb)

        fail_result = {
            "timestamp": ts,
            "success": False,
            "error": str(ex),
            "traceback": tb
        }
        try:
            arcpy.SetParameterAsText(8, json.dumps(fail_result))
        except Exception:
            pass
        raise
