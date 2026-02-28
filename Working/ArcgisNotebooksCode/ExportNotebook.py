from arcgis.gis import GIS
from arcgis.geoprocessing import import_toolbox
from arcgis.features import FeatureSet
import json
import os
from datetime import datetime

# -----------------------------
# CONFIG
# -----------------------------
EXPORT_GP_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Landbase/ExportSSAP/GPServer"

SDE_CONN_DEFAULT = r"\\GIS\Scripts\NG911\NG911_Automation\connections\SSAP_Default.sde"

# FeatureServer layer URL for the feature class you want exported
TARGET_LAYER_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Landbase/SSAP_Testing/FeatureServer/1"  # <-- change this

NAME_PREFIX = "SSAP"

NB_RUN_DIR = "/arcgis/home/run_summaries"
os.makedirs(NB_RUN_DIR, exist_ok=True)
# -----------------------------

def parse_result(resp):
    # Many GP tools return a dict with result_json; some return the json string directly
    if isinstance(resp, dict) and "result_json" in resp and isinstance(resp["result_json"], str):
        try:
            return json.loads(resp["result_json"])
        except Exception:
            return {"result_json_raw": resp["result_json"]}
    if isinstance(resp, str):
        try:
            return json.loads(resp)
        except Exception:
            return {"raw_str": resp}
    return resp

gis = GIS("home")
user = gis.users.me.username if gis.users.me else "unknown"
print("Signed in as:", user)

tbx = import_toolbox(EXPORT_GP_URL, gis=gis)

target_fc_param = FeatureSet.from_dict({"url": TARGET_LAYER_URL})
print("Target layer URL:", TARGET_LAYER_URL)

# Signature:
# export_ssap(sde_conn, target_fc, name_prefix, gis=None, future=False, estimate=False) -> str
resp = tbx.export_ssap(
    sde_conn=SDE_CONN_DEFAULT,
    target_fc=target_fc_param,
    name_prefix=NAME_PREFIX,
    gis=gis
)

print("\n--- Raw response ---")
print(resp)

parsed = parse_result(resp)
print("\n--- Parsed ---")
print(json.dumps(parsed, indent=2))

run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
summary_path = os.path.join(NB_RUN_DIR, f"export_run_{run_id}.json")
with open(summary_path, "w", encoding="utf-8") as f:
    json.dump({
        "run_id": run_id,
        "user": user,
        "gp_url": EXPORT_GP_URL,
        "inputs": {
            "sde_conn": SDE_CONN_DEFAULT,
            "target_layer_url": TARGET_LAYER_URL,
            "name_prefix": NAME_PREFIX
        },
        "response_raw": resp,
        "response_parsed": parsed
    }, f, indent=2)

print("\n✅ Summary saved:", summary_path)

# If your GP script returns the final zip path in JSON, print it
final_zip = None
if isinstance(parsed, dict):
    final_zip = parsed.get("final_zip") or parsed.get("zip_path") or parsed.get("output_zip")

if final_zip:
    print("\n✅ Final ZIP path returned:", final_zip)
else:
    print("\nℹ️ No zip path returned. Ensure your GP script sets result_json with the final UNC path (\\\\GIS\\\\Scripts\\\\Geoshare\\...).")
