"""
Nightly orchestrator for ArcGIS Notebook Server.

Pipeline:
1) Reconcile/Post MUNI -> QA
2) Run QA GP tool + update QAStatus
3) Reconcile/Post QA -> DEFAULT
4) Export DEFAULT feature class to FGDB ZIP
5) Sync DEFAULT back into municipal versions (QAStatus sync)

Sends one notification payload with stage-by-stage success/fail + summaries.
"""

from arcgis.gis import GIS
from datetime import datetime
import json
import os
import time
from typing import Optional
from urllib.parse import quote

# -------------------------------------------------
# CONFIG — UPDATE FOR YOUR ENV
# -------------------------------------------------
RECON_GP_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/ReconcilePostTraditional/GPServer"
RECON_TASK_NAME = "reconcile_post_traditional"
QA_GP_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Regional/QA/GPServer"
QA_TASK_NAME = "qa"  # leave as-is if this matches your published task
EXPORT_GP_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Landbase/ExportSSAP/GPServer"
EXPORT_TASK_NAME = "export_ssap"

# Reconcile inputs
SDE_CONN_UNC = r"\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde"
DEFAULT_VERSION = "sde.DEFAULT"
QA_VERSION = "SDE.QA"
EDITOR_VERSIONS = "SDE.CSRD;SDE.Revelstoke;SDE.Golden;SDE.Salmon Arm;SDE.Sicamous"
CONFLICT_POLICY = "NO_ABORT"
ACQUIRE_LOCKS = "LOCK_ACQUIRED"

# QA inputs
TARGET_DATASET = r"SDE.NG911\SDE.NG911_SiteAddress"
SCHEMA_JSON = r"\\GIS\Scripts\NG911\NG911_Automation\SSAP_Schema.json"
DATASET_NAME: Optional[str] = None
MODE = "all"
CHECK_TYPES = True
CHECK_LENGTHS = True
CHECK_NGUID_FORMAT = False
NORMALIZE_NGUID = True
MANDATORY_FIELDS = ["DiscrpAgID", "DateUpdate", "NGUID", "Country", "A3", "A2", "A1"]
ADDRESS_DUP_FIELD = "Full_Addr"
ADDRESS_DUP_MAX_ROWS = 5000
QA_STATUS_FIELD = "QAStatus"
UPDATE_QA_STATUS = True
OUT_LOG_FOLDER = "/arcgis/home/run_summaries"

# Export inputs
EXPORT_NAME_PREFIX = "SSAP_Default"

# Run summaries
NB_RUN_DIR = "/arcgis/home/run_summaries"

# Optional mapping from server file paths to browsable URLs.
SERVER_PATH_URL_MAP = {
    "/arcgis/home/run_summaries": "https://apps.csrd.bc.ca/notebook/notebooks/b4ea80afab8d433195aa7f195e4a832a/files/home/run_summaries",
}
NOTEBOOK_RUN_SUMMARIES_BASE_URL = "https://apps.csrd.bc.ca/notebook/notebooks/b4ea80afab8d433195aa7f195e4a832a/files/home/run_summaries"

# When True, QA failures are recorded but do NOT stop the pipeline.
QA_BLOCKING = False

# Notifications
EMAIL_ON_COMPLETE = True
POWER_AUTOMATE_FLOW_URL = "https://defaultdca3617080034b9ca1110db6ef334e.45.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/47cf6a8dbfd14435970ffecae51f9466/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=PdMLHf_sAfRjOZtg_cUdq-Y9W9zmtxxROs4407tcEew"
POWER_AUTOMATE_TIMEOUT_SEC = 20
# -------------------------------------------------


def ensure_local_dir(path: str):
    os.makedirs(path, exist_ok=True)


def parse_result(payload):
    if payload is None:
        return {"success": False, "error": "Empty GP output (None)"}
    if isinstance(payload, dict) and ("success" in payload or "status" in payload or "stage" in payload):
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


def _normalize_path(path_value: str) -> str:
    return str(path_value or "").strip().replace("\\", "/")


def path_to_access_link(path_value: str) -> str:
    path_norm = _normalize_path(path_value)
    if not path_norm:
        return ""

    for server_prefix, base_url in (SERVER_PATH_URL_MAP or {}).items():
        prefix_norm = _normalize_path(server_prefix).rstrip("/")
        if path_norm.lower().startswith(prefix_norm.lower()):
            rel = path_norm[len(prefix_norm):].lstrip("/")
            if rel:
                rel_encoded = "/".join(quote(part) for part in rel.split("/"))
                return f"{base_url.rstrip('/')}/{rel_encoded}"
            return base_url.rstrip("/")

    # Best-effort fallback: still provide a notebook-files style URL using filename.
    filename = path_norm.split("/")[-1]
    if filename:
        return f"{NOTEBOOK_RUN_SUMMARIES_BASE_URL.rstrip('/')}/{quote(filename)}"
    return NOTEBOOK_RUN_SUMMARIES_BASE_URL.rstrip("/")


def _collect_output_files(summary: dict) -> list:
    files = []

    def add_file(label: str, stage: str, path_value):
        if not path_value:
            return
        path_text = str(path_value).strip()
        if not path_text:
            return
        files.append(
            {
                "label": label,
                "stage": stage,
                "path": path_text,
                "access_link": path_to_access_link(path_text),
            }
        )

    # Keep email output list minimal: only the orchestrator run summary JSON.
    add_file("Nightly run summary JSON", "ORCHESTRATOR", (summary or {}).get("run_summary_path"))
    return files


def build_target_layer() -> str:
    return os.path.join(SDE_CONN_UNC, TARGET_DATASET)


def _schema_json_param_value(path: str):
    # GPDataFile over REST expects JSON object.
    return {"url": path}


def _sde_conn_param_value(path: str):
    # Reconcile GP service publishes sde_conn as a file parameter.
    return {"url": path}


def _resolve_gp_task_url(gis, gp_url: str, task_name: str) -> str:
    def _norm(s: str) -> str:
        return "".join(ch for ch in (s or "").lower() if ch.isalnum())

    base = gp_url.rstrip("/")
    meta = gis._con.post(base, {"f": "json"})
    tasks = (meta or {}).get("tasks") or []
    if not tasks:
        raise RuntimeError(f"No GP tasks found at service URL: {base}")
    wanted = (task_name or "").strip()
    if wanted:
        # Match task names robustly (case-insensitive and ignores underscores/spaces).
        resolved_task = None
        wanted_norm = _norm(wanted)
        for t in tasks:
            t_str = str(t)
            if t_str.lower() == wanted.lower() or _norm(t_str) == wanted_norm:
                resolved_task = t_str
                break
        if not resolved_task:
            # Keep behavior resilient like other notebook flows: fall back to first task.
            resolved_task = str(tasks[0])
            print(f"Task '{wanted}' not found; falling back to first task '{resolved_task}'")
        task_name = resolved_task
    else:
        task_name = str(tasks[0])
    return f"{base}/{task_name}"


def _poll_job_result(gis, task_url: str, job_id: str, timeout_sec: int = 1800, interval_sec: int = 3):
    jobs_url = f"{task_url}/jobs/{job_id}"
    start = time.time()
    last_status = None
    while True:
        job = gis._con.post(jobs_url, {"f": "json"})
        status = (job or {}).get("jobStatus", "")
        if status != last_status:
            print(f"GP job {job_id} status: {status}")
            last_status = status
        if status == "esriJobSucceeded":
            break
        if status in ("esriJobFailed", "esriJobCancelled", "esriJobTimedOut"):
            return {"success": False, "error": f"GP job failed: {status}", "job": job}
        if time.time() - start > timeout_sec:
            return {"success": False, "error": f"GP job timed out after {timeout_sec} sec", "job": job}
        time.sleep(interval_sec)

    result = gis._con.post(f"{jobs_url}/results/result_json", {"f": "json"})
    value = (result or {}).get("value")
    if value is None:
        return {"success": False, "error": "GP job succeeded but result_json is missing", "job": gis._con.post(jobs_url, {"f": "json"})}
    return parse_result(value)


def _reconcile_conflict_aborted(result: dict) -> bool:
    if not isinstance(result, dict):
        return False
    message_text = str(result.get("messages", "") or "").lower()
    conflict_indicators = [
        "warning 000084",
        "conflicts detected, aborting the reconcile",
        "aborting the reconcile",
    ]
    return any(indicator in message_text for indicator in conflict_indicators)


def _normalize_reconcile_result(result: dict) -> dict:
    if not isinstance(result, dict):
        return {"success": False, "error": "Invalid reconcile result payload", "raw": result}
    normalized = dict(result)
    if CONFLICT_POLICY == "ABORT_CONFLICTS" and _reconcile_conflict_aborted(normalized):
        normalized["success"] = False
        normalized.setdefault("status", "conflict_aborted")
        normalized.setdefault(
            "error",
            "Reconcile aborted due to conflicts (ABORT_CONFLICTS policy).",
        )
    return normalized


def run_reconcile_stage(stage: str, gis):
    task_url = _resolve_gp_task_url(gis, RECON_GP_URL, RECON_TASK_NAME)
    params = {
        "f": "json",
        "sde_conn": _sde_conn_param_value(SDE_CONN_UNC),
        "stage": stage,
        "qa_version": QA_VERSION,
        "default_version": DEFAULT_VERSION,
        "editor_versions": EDITOR_VERSIONS,
        "out_log_folder": OUT_LOG_FOLDER,
        "conflict_policy": CONFLICT_POLICY,
        "acquire_locks": ACQUIRE_LOCKS,
    }
    submit = gis._con.post(f"{task_url}/submitJob", params)
    job_id = (submit or {}).get("jobId")
    if not job_id:
        return {"success": False, "error": "submitJob did not return jobId", "raw": submit}
    result = _poll_job_result(gis, task_url, job_id)
    return _normalize_reconcile_result(result)


def run_qa_stage(gis):
    task_url = _resolve_gp_task_url(gis, QA_GP_URL, QA_TASK_NAME)
    params = {
        "f": "json",
        "target_layer": build_target_layer(),
        "schema_json": _schema_json_param_value(SCHEMA_JSON),
        "dataset_name": DATASET_NAME or "",
        "mode": MODE,
        "check_types": CHECK_TYPES,
        "check_lengths": CHECK_LENGTHS,
        "check_nguid_format": CHECK_NGUID_FORMAT,
        "normalize_nguid": NORMALIZE_NGUID,
        "mandatory_fields": ";".join(MANDATORY_FIELDS),
        "address_dup_field": ADDRESS_DUP_FIELD,
        "address_dup_max_rows": ADDRESS_DUP_MAX_ROWS,
        "qa_status_field": QA_STATUS_FIELD,
        "update_qa_status": UPDATE_QA_STATUS,
        "out_log_folder": OUT_LOG_FOLDER,
    }
    submit = gis._con.post(f"{task_url}/submitJob", params)
    job_id = (submit or {}).get("jobId")
    if not job_id:
        return {"success": False, "error": "submitJob did not return jobId", "raw": submit}
    return _poll_job_result(gis, task_url, job_id)


def run_export_stage(gis):
    task_url = _resolve_gp_task_url(gis, EXPORT_GP_URL, EXPORT_TASK_NAME)
    params = {
        "f": "json",
        # Republished export tool accepts target_fc as text path (no FeatureSet required).
        "sde_conn": _sde_conn_param_value(SDE_CONN_UNC),
        "target_fc": TARGET_DATASET,
        "name_prefix": EXPORT_NAME_PREFIX,
    }
    submit = gis._con.post(f"{task_url}/submitJob", params)
    job_id = (submit or {}).get("jobId")
    if not job_id:
        return {"success": False, "error": "submitJob did not return jobId", "raw": submit}
    return _poll_job_result(gis, task_url, job_id)


def stage_summary(stage_name: str, result: dict) -> dict:
    ok = bool(isinstance(result, dict) and result.get("success", False))
    summary = {"stage": stage_name, "success": ok}
    if stage_name == "MUNI_TO_QA":
        summary["summary"] = "Reconcile/Post municipal versions into QA completed." if ok else (result.get("error") or "Reconcile failed.")
    elif stage_name == "RUN_QA":
        qa = (result or {}).get("qa_report") or {}
        ng = qa.get("nguid_summary") or {}
        mandatory_null_fields = [r["field"] for r in (qa.get("mandatory_nulls") or []) if r.get("null_count", 0) > 0]
        summary["summary"] = (
            f"QA status={result.get('status')}; missing_fields={len(qa.get('missing_fields', []))}; "
            f"nguid_dupes={ng.get('duplicate_nguid_count', 0)}; mandatory_null_fields={mandatory_null_fields}"
        )
    elif stage_name == "QA_TO_DEFAULT":
        summary["summary"] = "Reconcile/Post QA into DEFAULT completed." if ok else (result.get("error") or "Reconcile failed.")
    elif stage_name == "EXPORT_DEFAULT":
        if ok:
            final_zip = (result or {}).get("final_zip")
            if final_zip:
                summary["summary"] = f"Default export completed. ZIP: {final_zip}"
            else:
                summary["summary"] = "Default export completed."
        else:
            summary["summary"] = result.get("error") or "Export failed."
    elif stage_name == "DEFAULT_TO_MUNI_SYNC":
        summary["summary"] = (
            "Reconciled DEFAULT into municipal versions (NO_POST) so editor versions receive updated QAStatus."
            if ok else (result.get("error") or "DEFAULT to municipal sync failed.")
        )
    return summary


def build_email_payload(summary: dict) -> dict:
    stages = summary.get("stage_summaries", [])
    lines = [f"Nightly Status: {summary.get('status')}"]
    for s in stages:
        lines.append(f"- {s.get('stage')}: {'SUCCESS' if s.get('success') else 'FAIL'} | {s.get('summary')}")
    return {
        "status": summary.get("status"),
        "run_id": summary.get("run_id"),
        "user": summary.get("user"),
        "started": summary.get("started"),
        "finished": summary.get("finished"),
        "stage_results": summary.get("stage_results", {}),
        "stage_summaries": stages,
        "output_files": summary.get("output_files", []),
        "email_summary_text": "\n".join(lines),
        "run_summary_path": summary.get("run_summary_path"),
    }


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


def finalize_run(summary: dict, run_id: str, status: str):
    summary["status"] = status
    summary["finished"] = datetime.now().isoformat(timespec="seconds")
    out_path = os.path.join(NB_RUN_DIR, f"nightly_orchestrator_{run_id}.json")
    summary["run_summary_path"] = out_path
    summary["output_files"] = _collect_output_files(summary)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print("Run summary saved:", out_path)
    payload = build_email_payload(summary)
    notify = send_power_automate_notification(payload)
    print("Notification:", notify)


def main():
    ensure_local_dir(NB_RUN_DIR)
    ensure_local_dir(OUT_LOG_FOLDER)
    gis = GIS("home")
    user = gis.users.me.username if gis.users.me else "unknown"
    print("Signed in as:", user)

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    summary = {
        "run_id": run_id,
        "user": user,
        "started": datetime.now().isoformat(timespec="seconds"),
        "stage_results": {},
        "stage_summaries": [],
    }

    print("\n=== Stage 1: MUNI -> QA ===")
    s1 = run_reconcile_stage("MUNI_TO_QA", gis)
    summary["stage_results"]["MUNI_TO_QA"] = s1
    summary["stage_summaries"].append(stage_summary("MUNI_TO_QA", s1))
    if not s1.get("success", False):
        finalize_run(summary, run_id, "stage1_failed")
        return

    print("\n=== Stage 2: QA checks + QAStatus ===")
    s2 = run_qa_stage(gis)
    summary["stage_results"]["RUN_QA"] = s2
    summary["stage_summaries"].append(stage_summary("RUN_QA", s2))
    if not s2.get("success", False):
        if QA_BLOCKING:
            finalize_run(summary, run_id, "stage2_failed")
            return
        print("QA stage reported failures but QA_BLOCKING is False — continuing pipeline.")

    print("\n=== Stage 3: QA -> DEFAULT ===")
    s3 = run_reconcile_stage("QA_TO_DEFAULT", gis)
    summary["stage_results"]["QA_TO_DEFAULT"] = s3
    summary["stage_summaries"].append(stage_summary("QA_TO_DEFAULT", s3))
    if not s3.get("success", False):
        finalize_run(summary, run_id, "stage3_failed")
        return

    print("\n=== Stage 4: Export DEFAULT to FGDB ZIP ===")
    s4 = run_export_stage(gis)
    summary["stage_results"]["EXPORT_DEFAULT"] = s4
    summary["stage_summaries"].append(stage_summary("EXPORT_DEFAULT", s4))
    if not s4.get("success", False):
        finalize_run(summary, run_id, "stage4_failed")
        return

    print("\n=== Stage 5: Sync DEFAULT back to municipal versions ===")
    s5 = run_reconcile_stage("DEFAULT_TO_MUNI_SYNC", gis)
    summary["stage_results"]["DEFAULT_TO_MUNI_SYNC"] = s5
    summary["stage_summaries"].append(stage_summary("DEFAULT_TO_MUNI_SYNC", s5))
    if not s5.get("success", False):
        finalize_run(summary, run_id, "stage5_failed")
        return

    qa_ok = s2.get("success", False)
    if qa_ok:
        finalize_run(summary, run_id, "success")
    else:
        finalize_run(summary, run_id, "success_qa_warnings")


if __name__ == "__main__":
    main()


