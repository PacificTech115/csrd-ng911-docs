import json
import base64
from arcgis.gis import GIS
from arcgis.features import FeatureLayer

def test_cms_insertion():
    print("Testing CMS Hosted Table Insertion...")
    
    # 1. Connect to GIS (uses active ArcGIS Pro login)
    try:
        gis_conn = GIS("home")
        username = gis_conn.users.me.username if gis_conn.users.me else "Unknown/Service Account"
        print(f"Connected to GIS as: {username}")
    except Exception as e:
        print(f"FAILED to connect to GIS: {e}")
        return

    # 2. Prepare Dummy Payload
    summary = {
        "run_id": "TEST_001",
        "user": username,
        "started": "2026-03-15T22:30:00",
        "finished": "2026-03-15T22:35:00",
        "status": "success",
        "stage_summaries": [
            {"stage": "Test Stage", "success": True, "summary": "This is a test insertion from local Pro."}
        ]
    }
    
    json_str = json.dumps(summary)
    encoded_b64 = base64.b64encode(json_str.encode('utf-8')).decode('utf-8')

    # 3. Target CMS Table
    CMS_URL = "https://apps.csrd.bc.ca/arcgis/rest/services/Hosted/NG911_Docs_CMS/FeatureServer/0"
    try:
        fl = FeatureLayer(CMS_URL, gis_conn)
        
        # 4. Check if we can read the properties of the table and if we have edit rights
        print(f"Targeting Feature Layer: {fl.properties.name}")
        
    except Exception as e:
        print(f"FAILED to connect to Feature Layer. Check permissions or URL: {e}")
        return

    # 5. Attempt Edit
    try:
        q = fl.query(where="KeyName = 'dashboard.orchestrator.latest_run'")
        if len(q.features) > 0:
            print("Found existing row. Attempting UPDATE...")
            feat = q.features[0]
            feat.attributes["ContentValue"] = encoded_b64
            feat.attributes["ContentType"] = "json"
            res = fl.edit_features(updates=[feat])
            print("Update Response:", res)
        else:
            print("Row not found. Attempting INSERT...")
            new_feat = {
                "attributes": {
                    "KeyName": "dashboard.orchestrator.latest_run",
                    "ContentValue": encoded_b64,
                    "ContentType": "json"
                }
            }
            res = fl.edit_features(adds=[new_feat])
            print("Insert Response:", res)
            
    except Exception as e:
        print(f"FAILED during attempt to edit features: {e}")

if __name__ == '__main__':
    test_cms_insertion()
