# ArcGIS Notebook Server (Standard) - Traditional Versioning Automation Orchestrator
# Calls GP service (ArcPy) to reconcile/post MUNI -> QA, then (optionally) QA -> DEFAULT.
# Handles both sync (dict) and async (job with .result()) GP responses.
#
# ✅ Update ONLY:
#   1) GP_URL (your GPServer endpoint)
# Everything else uses your confirmed versions and UNC share.

from arcgis.gis import GIS
from arcgis.geoprocessing import import_toolbox
from datetime import datetime
import json
import os
import time
import inspect

# -------------------------------------------------
# CONFIG (EDIT THESE)
# -------------------------------------------------
GP_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Landbase/ReconcilePostTraditional/GPServer"

# GP service reads these UNC paths (Notebook should NOT try to create folders on \\GIS\...)
SDE_CONN_UNC = r"\\GIS\Scripts\NG911\NG911_Automation\connections\SSAP_Default.sde"

# Version names (from your screenshot)
DEFAULT_VERSION = "sde.DEFAULT"
QA_VERSION      = "SDE.QA"
EDITOR_VERSIONS = "SDE.CSRD;SDE.Revelstoke;SDE.Golden;SDE.Salmon Arm;SDE.Sicamous"

# Policies
CONFLICT_POLICY = "ABORT_CONFLICTS"      # ABORT_CONFLICTS | NO_ABORT
ACQUIRE_LOCKS   = "LOCK_ACQUIRED"        # LOCK_ACQUIRED | NO_LOCK_ACQUIRED

# Notebook-local folder (safe in Standard runtime)
NB_RUN_LOG_DIR = "/arcgis/home/run_summaries"

# Sleep between stages (optional)
SLEEP_BETWEEN_STAGES_SEC = 2
# -------------------------------------------------


def ensure_local_dir(path: str):
    os.makedirs(path, exist_ok=True)


def parse_result(payload):
    """
    Accepts output payload from GP call (either dict, or dict with result_json string).
    Returns a dict.
    """
    if payload is None:
        return {"success": False, "error": "Empty GP output (None)"}

    # Sometimes payload is already the final dict from your script
    if isinstance(payload, dict) and ("success" in payload or "stage" in payload):
        # If it contains result_json, prefer parsing it
        if "result_json" in payload and isinstance(payload["result_json"], str):
            try:
                return json.loads(payload["result_json"])
            except Exception:
                return {"success": False, "error": "Could not parse result_json", "raw": payload["result_json"]}
        return payload

    # If it's a string, maybe it's JSON
    if isinstance(payload, str):
        try:
            return json.loads(payload)
        except Exception:
            return {"success": False, "error": "Unrecognized GP output string", "raw": payload}

    # Fallback
    return {"success": False, "error": f"Unrecognized GP output type: {type(payload)}", "raw": payload}


def unwrap_gp_response(resp):
    """
    If resp is an async job, return resp.result().
    If resp is already a dict, return it.
    """
    if hasattr(resp, "result") and callable(resp.result):
        return resp.result()
    return resp


def run_stage(tbx, stage: str, gis):
    """
    Calls your published GP tool. Based on your observed signature, the GP tool takes:
      (sde_conn, stage, qa_version, default_version, editor_versions, conflict_policy, acquire_locks, gis=...)
    """
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
    out = unwrap_gp_response(resp)
    return parse_result(out)


# -------------------------
# MAIN
# -------------------------
gis = GIS("home")
user = gis.users.me.username if gis.users.me else "unknown"
print("Signed in as:", user)

ensure_local_dir(NB_RUN_LOG_DIR)

tbx = import_toolbox(GP_URL, gis=gis)

# Helpful debug: show tool signature once
try:
    print("\nTool signature:", inspect.signature(tbx.reconcile_post_traditional))
except Exception:
    pass

run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
summary = {
    "run_id": run_id,
    "user": user,
    "started": datetime.now().isoformat(timespec="seconds"),
    "gp_url": GP_URL,
    "inputs": {
        "sde_conn_unc": SDE_CONN_UNC,
        "default_version": DEFAULT_VERSION,
        "qa_version": QA_VERSION,
        "editor_versions": EDITOR_VERSIONS,
        "conflict_policy": CONFLICT_POLICY,
        "acquire_locks": ACQUIRE_LOCKS
    },
    "stages": {}
}

# 1) Municipal -> QA
print("\n=== Stage 1: MUNI -> QA ===")
res1 = run_stage(tbx, "MUNI_TO_QA", gis)
summary["stages"]["MUNI_TO_QA"] = res1
print("Stage 1 output:\n", json.dumps(res1, indent=2) if isinstance(res1, dict) else res1)

if not (isinstance(res1, dict) and res1.get("success", False)):
    print("\n❌ Stage 1 failed. Stopping pipeline.")
else:
    time.sleep(SLEEP_BETWEEN_STAGES_SEC)

    # 2) QA checks placeholder (replace with your real checks)
    # -------------------------------------------------
    qa_passed = True
    # -------------------------------------------------
    summary["qa_passed"] = qa_passed

    if not qa_passed:
        print("\n❌ QA checks failed. Not posting QA -> DEFAULT.")
    else:
        # 3) QA -> DEFAULT
        print("\n=== Stage 2: QA -> DEFAULT ===")
        res2 = run_stage(tbx, "QA_TO_DEFAULT", gis)
        summary["stages"]["QA_TO_DEFAULT"] = res2
        print("Stage 2 output:\n", json.dumps(res2, indent=2) if isinstance(res2, dict) else res2)

summary["finished"] = datetime.now().isoformat(timespec="seconds")

out_path = os.path.join(NB_RUN_LOG_DIR, f"run_{run_id}.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(summary, f, indent=2)

print("\n✅ Notebook run summary saved to:", out_path)
print("Note: GP reconcile logs are written by the GP service on the Windows server (not by this notebook).")
