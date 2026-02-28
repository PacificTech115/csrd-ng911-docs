"""
Standalone ArcGIS Notebook script to reconcile/post municipal versions into QA.
Run this when you only need the reconcile/post step (no QA checks or export).
"""

from arcgis.gis import GIS
from arcgis.geoprocessing import import_toolbox
from datetime import datetime
import json
import os
import time
from typing import Optional

# -------------------------------------------------
# CONFIG — UPDATE FOR YOUR ENV
# -------------------------------------------------
# Web tool for reconcile/post
RECON_GP_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Landbase/ReconcilePostTraditional/GPServer"

# Inputs expected by the GP tool
SDE_CONN_UNC = r"\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde"
DEFAULT_VERSION = "sde.DEFAULT"
QA_VERSION = "SDE.QA"
EDITOR_VERSIONS = "SDE.CSRD;SDE.Revelstoke;SDE.Golden;SDE.Salmon Arm;SDE.Sicamous"
CONFLICT_POLICY = "NO_ABORT"             # ABORT_CONFLICTS | NO_ABORT
ACQUIRE_LOCKS = "LOCK_ACQUIRED"          # LOCK_ACQUIRED | NO_LOCK_ACQUIRED

# Notebook-local paths
NB_RUN_DIR = "/arcgis/home/run_summaries"
OUT_LOG_FOLDER = NB_RUN_DIR

# Notifications (Power Automate)
EMAIL_ON_COMPLETE = False  # Set to True to enable POST to your flow
POWER_AUTOMATE_FLOW_URL = ""  # HTTP POST trigger URL from your Power Automate flow
POWER_AUTOMATE_TIMEOUT_SEC = 15
# -------------------------------------------------


def ensure_local_dir(path: str):
    os.makedirs(path, exist_ok=True)


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
        sde_conn=SDE_CONN_UNC,
        stage=stage,
        qa_version=QA_VERSION,
        default_version=DEFAULT_VERSION,
        editor_versions=EDITOR_VERSIONS,
        out_log_folder=OUT_LOG_FOLDER,
        conflict_policy=CONFLICT_POLICY,
        acquire_locks=ACQUIRE_LOCKS,
        gis=gis
    )
    return parse_result(unwrap_gp_response(resp))


def send_power_automate_notification(summary: dict, status: str, run_summary_path: Optional[str] = None):
    """
    Posts the run summary to a Power Automate HTTP trigger so the flow can email it.
    Only runs when EMAIL_ON_COMPLETE is True.
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
    out_path = os.path.join(NB_RUN_DIR, f"reconcile_run_{run_id}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    summary["run_summary_path"] = out_path
    print("Run summary saved:", out_path)
    notify_res = send_power_automate_notification(summary, status, out_path)
    if notify_res:
        print("Power Automate notify:", notify_res)
    return out_path


def main():
    ensure_local_dir(NB_RUN_DIR)
    ensure_local_dir(OUT_LOG_FOLDER)
    gis = GIS("home")
    user = gis.users.me.username if gis.users.me else "unknown"
    print("Signed in as:", user)

    tbx_recon = import_toolbox(RECON_GP_URL, gis=gis)

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    summary = {
        "run_id": run_id,
        "user": user,
        "started": datetime.now().isoformat(timespec="seconds"),
        "gp_urls": {"reconcile": RECON_GP_URL},
        "inputs": {
            "sde_conn_unc": SDE_CONN_UNC,
            "default_version": DEFAULT_VERSION,
            "qa_version": QA_VERSION,
            "editor_versions": EDITOR_VERSIONS,
            "conflict_policy": CONFLICT_POLICY,
            "acquire_locks": ACQUIRE_LOCKS,
        },
        "stages": {},
    }

    print("\n=== Reconcile/Post: MUNI -> QA ===")
    res_recon = run_reconcile_stage(tbx_recon, "MUNI_TO_QA", gis)
    summary["stages"]["MUNI_TO_QA"] = res_recon
    print(json.dumps(res_recon, indent=2) if isinstance(res_recon, dict) else res_recon)

    status = "success" if (isinstance(res_recon, dict) and res_recon.get("success", False)) else "reconcile_failed"
    finalize_run(summary, run_id, status)
    if status != "success":
        print("\n❌ Reconcile stage failed.")
    else:
        print("\n✅ Reconcile stage completed successfully.")


if __name__ == "__main__":
    main()


