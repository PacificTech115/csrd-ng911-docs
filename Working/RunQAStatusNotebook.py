"""
Notebook script to run the published QA GP tool and update QAStatus.
Matches the same notebook->webtool flow used by ReconcileMunicipalToQA.py.
"""

from arcgis.gis import GIS
from datetime import datetime
import json
import os
import re
import time
from typing import Optional

# -------------------------------------------------
# CONFIG — UPDATE FOR YOUR ENV
# -------------------------------------------------
# Published QA web tool URL (GPServer)
QA_GP_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Regional/QA/GPServer"
# Optional explicit task name. Leave blank to auto-detect the first task.
QA_TASK_NAME = "qa"

# GP inputs
SDE_CONN_UNC = r"\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde"
TARGET_DATASET = r"SDE.NG911\SDE.NG911_SiteAddress"
SCHEMA_JSON = r"\\GIS\Scripts\NG911\NG911_Automation\SSAP_Schema.json"
DATASET_NAME: Optional[str] = None
MODE = "all"  # "all" | "required" | "nonnullable"
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

# Notebook-local summary path
NB_RUN_DIR = "/arcgis/home/run_summaries"

# Optional mapping from server filesystem paths to web-accessible URLs.
# Update these to match your ArcGIS Server directories URL.
SERVER_PATH_URL_MAP = [
    (
        r"\\GIS\arcgisserver\directories\arcgissystem",
        "https://apps.csrd.bc.ca/arcgis/rest/directories/arcgissystem",
    ),
    (
        r"\\GIS\arcgisserver\directories\arcgisjobs",
        "https://apps.csrd.bc.ca/arcgis/rest/directories/arcgisjobs",
    ),
    (
        r"\\GIS\arcgisserver\directories\arcgisoutput",
        "https://apps.csrd.bc.ca/arcgis/rest/directories/arcgisoutput",
    ),
    (
        r"\\GIS\arcgisserver\directories\arcgisinput",
        "https://apps.csrd.bc.ca/arcgis/rest/directories/arcgisinput",
    ),
]
# -------------------------------------------------


def ensure_local_dir(path: str):
    os.makedirs(path, exist_ok=True)


def build_target_layer() -> str:
    return os.path.join(SDE_CONN_UNC, TARGET_DATASET)


def _to_file_url(path: str) -> str:
    p = (path or "").strip()
    if p.lower().startswith(("http://", "https://", "file://")):
        return p
    # For ArcGIS GPDataFile on Server, local/UNC paths should remain filesystem paths.
    if p.startswith("\\\\") or re.match(r"^[A-Za-z]:\\", p):
        return p
    return p


def _schema_json_param_value(path: str):
    # GPDataFile over REST expects a JSON object with url/itemID.
    return {"url": _to_file_url(path)}


def path_to_access_link(path: str) -> Optional[str]:
    p = (path or "").strip()
    if not p:
        return None
    if p.lower().startswith(("http://", "https://", "file://")):
        return p
    p_norm = p.replace("/", "\\")
    p_norm_low = p_norm.lower()
    for prefix, base_url in SERVER_PATH_URL_MAP:
        pref_norm = prefix.replace("/", "\\")
        pref_low = pref_norm.lower()
        if p_norm_low.startswith(pref_low):
            rel = p_norm[len(pref_norm):].lstrip("\\/")
            return base_url.rstrip("/") + "/" + rel.replace("\\", "/")
    # Fallback to file link for UNC paths.
    if p.startswith("\\\\"):
        return "file://" + p.lstrip("\\").replace("\\", "/")
    return None


def parse_result(payload):
    if payload is None:
        return {"success": False, "error": "Empty GP output (None)"}
    if isinstance(payload, dict) and ("success" in payload or "status" in payload):
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


def _resolve_gp_task_url(gis) -> str:
    base = QA_GP_URL.rstrip("/")
    if not base.lower().endswith("/gpserver"):
        return base
    meta = gis._con.post(base, {"f": "json"})
    tasks = (meta or {}).get("tasks") or []
    if not tasks:
        raise RuntimeError(f"No GP tasks found at service URL: {base}")

    wanted = (QA_TASK_NAME or "").strip()
    if wanted:
        lower_map = {str(t).lower(): str(t) for t in tasks}
        task_name = lower_map.get(wanted.lower())
        if not task_name:
            raise RuntimeError(f"Configured QA_TASK_NAME '{wanted}' not found. Available tasks: {tasks}")
    else:
        task_name = str(tasks[0])
    return f"{base}/{task_name}"


def _poll_job_result(gis, task_url: str, job_id: str, timeout_sec: int = 1800, interval_sec: int = 3):
    jobs_url = f"{task_url}/jobs/{job_id}"
    start = time.time()
    while True:
        job = gis._con.post(jobs_url, {"f": "json"})
        status = (job or {}).get("jobStatus", "")
        if status == "esriJobSucceeded":
            break
        if status in ("esriJobFailed", "esriJobCancelled", "esriJobTimedOut"):
            return {"success": False, "error": f"GP job failed: {status}", "job": job}
        if time.time() - start > timeout_sec:
            return {"success": False, "error": f"GP job timed out after {timeout_sec} sec", "job": job}
        time.sleep(interval_sec)

    result_name = "result_json"
    result_url = f"{jobs_url}/results/{result_name}"
    result = gis._con.post(result_url, {"f": "json"})
    value = (result or {}).get("value")
    if value is None:
        return {"success": False, "error": "GP job succeeded but result_json is missing", "raw_result": result}
    return parse_result(value)


def run_qa_stage(gis):
    mandatory_fields = ";".join(MANDATORY_FIELDS)
    target_layer = build_target_layer()
    task_url = _resolve_gp_task_url(gis)
    params = {
        "f": "json",
        "target_layer": target_layer,
        "schema_json": _schema_json_param_value(SCHEMA_JSON),
        "dataset_name": DATASET_NAME or "",
        "mode": MODE,
        "check_types": CHECK_TYPES,
        "check_lengths": CHECK_LENGTHS,
        "check_nguid_format": CHECK_NGUID_FORMAT,
        "normalize_nguid": NORMALIZE_NGUID,
        "mandatory_fields": mandatory_fields,
        "address_dup_field": ADDRESS_DUP_FIELD,
        "address_dup_max_rows": ADDRESS_DUP_MAX_ROWS,
        "qa_status_field": QA_STATUS_FIELD,
        "update_qa_status": UPDATE_QA_STATUS,
        "out_log_folder": OUT_LOG_FOLDER,
    }

    # Prefer execute when available; fall back to async submitJob.
    try:
        exec_url = f"{task_url}/execute"
        exec_res = gis._con.post(exec_url, params)
        if isinstance(exec_res, dict) and exec_res.get("results"):
            out_map = {r.get("paramName"): r.get("value") for r in exec_res.get("results", [])}
            return parse_result(out_map.get("result_json"))
        if isinstance(exec_res, dict) and exec_res.get("result_json"):
            return parse_result(exec_res.get("result_json"))
    except Exception:
        pass

    submit_url = f"{task_url}/submitJob"
    submit = gis._con.post(submit_url, params)
    job_id = (submit or {}).get("jobId")
    if not job_id:
        return {"success": False, "error": "submitJob did not return jobId", "raw": submit}
    return _poll_job_result(gis, task_url, job_id)


def finalize_run(summary: dict, run_id: str, status: str) -> str:
    summary["status"] = status
    summary["finished"] = datetime.now().isoformat(timespec="seconds")
    out_path = os.path.join(NB_RUN_DIR, f"qa_stage_run_{run_id}.json")
    summary["run_summary_path"] = out_path
    summary.setdefault("output_links", {})
    summary["output_links"]["run_summary"] = path_to_access_link(out_path)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print("Run summary saved:", out_path)
    return out_path


def print_email_friendly_summary(res_qa: dict):
    email_text = (res_qa or {}).get("email_summary_text")
    if email_text:
        print("\n--- QA Summary (Email Friendly) ---")
        print(email_text)

    qa_report = (res_qa or {}).get("qa_report") or {}
    print("\n--- Issue Samples (max 5) ---")
    null_fail = qa_report.get("mandatory_null_failures") or {}
    null_samples = null_fail.get("sample_failed_features") or []
    print("Null-failure samples:")
    print(json.dumps(null_samples[:5], indent=2))

    addr_samples = qa_report.get("address_duplicates_samples") or []
    print("Address-duplicate samples:")
    print(json.dumps(addr_samples[:5], indent=2))

    print("\n--- Output Files ---")
    addr_csv = qa_report.get("address_duplicates_csv")
    null_csv = qa_report.get("mandatory_null_failures_csv")
    log_path = (res_qa or {}).get("log_path")
    print("QA Log JSON:", log_path)
    print("QA Log JSON link:", path_to_access_link(log_path))
    print("Address duplicates CSV:", addr_csv)
    print("Address duplicates CSV link:", path_to_access_link(addr_csv))
    print("Mandatory null failures CSV:", null_csv)
    print("Mandatory null failures CSV link:", path_to_access_link(null_csv))


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
        "gp_urls": {"qa": QA_GP_URL},
        "inputs": {
            "sde_conn_unc": SDE_CONN_UNC,
            "target_dataset": TARGET_DATASET,
            "target_layer": build_target_layer(),
            "qa_task_url": _resolve_gp_task_url(gis),
            "schema_json": SCHEMA_JSON,
            "dataset_name": DATASET_NAME,
            "mode": MODE,
            "check_types": CHECK_TYPES,
            "check_lengths": CHECK_LENGTHS,
            "check_nguid_format": CHECK_NGUID_FORMAT,
            "normalize_nguid": NORMALIZE_NGUID,
            "mandatory_fields": MANDATORY_FIELDS,
            "address_dup_field": ADDRESS_DUP_FIELD,
            "address_dup_max_rows": ADDRESS_DUP_MAX_ROWS,
            "qa_status_field": QA_STATUS_FIELD,
            "update_qa_status": UPDATE_QA_STATUS,
            "out_log_folder": OUT_LOG_FOLDER,
        },
        "stages": {},
    }

    print("\n=== QA checks + QAStatus update ===")
    res_qa = run_qa_stage(gis)
    summary["stages"]["RUN_QA"] = res_qa
    if isinstance(res_qa, dict):
        qa_report = res_qa.get("qa_report") or {}
        summary["output_links"] = {
            "qa_log_json": path_to_access_link(res_qa.get("log_path")),
            "address_duplicates_csv": path_to_access_link(qa_report.get("address_duplicates_csv")),
            "mandatory_null_failures_csv": path_to_access_link(qa_report.get("mandatory_null_failures_csv")),
        }
    if isinstance(res_qa, dict):
        print_email_friendly_summary(res_qa)
    else:
        print(res_qa)

    status = "success" if (isinstance(res_qa, dict) and res_qa.get("success", False)) else "qa_failed"
    finalize_run(summary, run_id, status)
    if status != "success":
        print("\n❌ QA stage failed.")
    else:
        print("\n✅ QA stage completed successfully.")


if __name__ == "__main__":
    main()


