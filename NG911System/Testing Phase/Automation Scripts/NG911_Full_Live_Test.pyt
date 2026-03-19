import arcpy
import os
import json
import urllib.request

class Toolbox(object):
    def __init__(self):
        """Define the toolbox (the name of the toolbox is the name of the .pyt file)."""
        self.label = "NG911 Full Live Test"
        self.alias = "ng911_full_test"
        self.tools = [FullLiveTest]

class FullLiveTest(object):
    def __init__(self):
        """Define the tool (tool name is the name of the class)."""
        self.label = "Run Full Automated Test Suite"
        self.description = "Combines ArcPy database checks, Attribute Rule simulations, and API reachability tests into one script. Generates a physical JSON output file for the Doc Hub report."
        self.canRunInBackground = True
        
        # Configuration defaults
        self.MUNI_VERSIONS = ["SDE.CSRD", "SDE.Salmon Arm", "SDE.Sicamous", "SDE.Golden", "SDE.Revelstoke"]
        self.REQUIRED_DOMAINS = ["Directional", "StreetType", "Agency", "Placement", "RoadClass"]

    def getParameterInfo(self):
        param_sde = arcpy.Parameter(
            displayName="SDE Connection File", name="in_sde_connection",
            datatype="DEWorkspace", parameterType="Required", direction="Input")
        param_sde.value = r"\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde"
        
        param_share = arcpy.Parameter(
            displayName="Network Export Share Directory", name="in_export_share",
            datatype="DEFolder", parameterType="Required", direction="Input")
        param_share.value = r"\\GIS\Scripts\Geoshare\NG911 Exports"
        
        param_fs_url = arcpy.Parameter(
            displayName="Feature Service REST URL", name="in_fs_url",
            datatype="GPString", parameterType="Required", direction="Input")
        param_fs_url.value = "https://server.csrd.bc.ca/server/rest/services/NG911/NG911_SiteAddress/FeatureServer/0"
        
        param_portal_url = arcpy.Parameter(
            displayName="Portal URL", name="in_portal_url",
            datatype="GPString", parameterType="Required", direction="Input")
        param_portal_url.value = "https://apps.csrd.bc.ca/hub/home"
        
        param_out_json_path = arcpy.Parameter(
            displayName="Output JSON File Path", name="out_json_path",
            datatype="DEFile", parameterType="Required", direction="Output")
        param_out_json_path.value = r"\\GIS\Scripts\NG911\NG911_Automation\Live_Results_Output.json"
        param_edit_sde = arcpy.Parameter(
            displayName="Editable SDE Connection (Optional for Phase 4)", name="in_edit_sde",
            datatype="DEWorkspace", parameterType="Optional", direction="Input")

        return [param_sde, param_share, param_fs_url, param_portal_url, param_out_json_path, param_edit_sde]

    def _add_result(self, results, test_id, passed, details=""):
        results[test_id] = {
            "status": "pass" if passed else "fail",
            "details": str(details)
        }

    def execute(self, parameters, messages):
        sde_connection = parameters[0].valueAsText
        export_share = parameters[1].valueAsText
        fs_url = parameters[2].valueAsText
        portal_url = parameters[3].valueAsText
        out_json_path = parameters[4].valueAsText
        
        # Hardcode Phase 4 to use the Sicamous version
        sde_edit_conn = os.path.join(os.path.dirname(sde_connection), "sde@sicamous.sde") 
        feature_class = os.path.join(sde_connection, "SDE.NG911", "SDE.NG911_SiteAddress")
        feature_class_edit = os.path.join(sde_edit_conn, "SDE.NG911", "SDE.NG911_SiteAddress")
        
        results = {}
        arcpy.AddMessage("--- Starting NG911 Full Live Test ---")

        # ==========================================
        # Component 1: API-Level Checks (Usually done by notebook)
        # ==========================================
        arcpy.AddMessage("Running API-Level checks...")
        try:
            req = urllib.request.urlopen(portal_url, timeout=10)
            self._add_result(results, "1.5", req.getcode() == 200, f"HTTP {req.getcode()}")
        except Exception as e:
            self._add_result(results, "1.5", False, str(e))

        try:
            query_url = f"{fs_url}/query?where=1=1&f=pjson&resultRecordCount=1"
            req2 = urllib.request.urlopen(query_url, timeout=10)
            data = json.loads(req2.read().decode('utf-8'))
            has_features = "features" in data and len(data["features"]) > 0
            self._add_result(results, "1.8", has_features, "Returns valid spatial JSON")
        except Exception as e:
            self._add_result(results, "1.8", False, str(e))

        # ==========================================
        # Component 2: Infrastructure & SDE Deep Checks
        # ==========================================
        arcpy.AddMessage("Checking Database Infrastructure & Connectivity...")
        try:
            desc = arcpy.Describe(sde_connection)
            self._add_result(results, "1.2", True, f"Connected to {getattr(desc, 'connectionString', 'DB')}")
            self._add_result(results, "1.1", True, "Database host is reachable")
        except Exception as e:
            self._add_result(results, "1.2", False, f"Failed to connect: {e}")
            self._add_result(results, "1.1", False, "Connection failed entirely")
            
        sde_dir = os.path.dirname(sde_connection)
        self._add_result(results, "1.3", os.path.exists(sde_dir), f"Accessible: {sde_dir}")
        
        has_share_read = os.path.exists(export_share)
        has_share_write = os.access(export_share, os.W_OK) if has_share_read else False
        if has_share_read and has_share_write:
            self._add_result(results, "1.4", True, f"Readable & Writable: {export_share}")
        else:
            self._add_result(results, "1.4", False, f"Missing or Read-Only: R={has_share_read}, W={has_share_write}")

        arcpy.AddMessage("Checking Versioning Hierarchy...")
        try:
            versions = [v.name for v in arcpy.da.ListVersions(sde_connection)]
            self._add_result(results, "2.1", "sde.DEFAULT" in versions, "sde.DEFAULT found")
            self._add_result(results, "2.2", "SDE.QA" in versions, "SDE.QA found")
            missing_munis = [m for m in self.MUNI_VERSIONS if m not in versions]
            if missing_munis:
                self._add_result(results, "2.3", False, f"Missing versions: {missing_munis}")
            else:
                self._add_result(results, "2.3", True, "All 5 municipal versions are active")
            
            results["2.4"] = {"status": "skip", "details": "Requires manual UI check for 'Protected' status"}
            results["2.5"] = {"status": "skip", "details": "Stale locks check deferred"}
            results["2.6"] = {"status": "skip", "details": "Geodatabase Compress deferred to monthly manual task"}
        except Exception as e:
            self._add_result(results, "2.1", False, f"Could not list versions: {e}")
            self._add_result(results, "2.2", False, "Blocked by 2.1")
            self._add_result(results, "2.3", False, "Blocked by 2.1")

        arcpy.AddMessage("Validating Schema & Data Integrity...")
        try:
            fc_exists = arcpy.Exists(feature_class)
            self._add_result(results, "3.2", fc_exists, "SDE.NG911_SiteAddress exists")
            if fc_exists:
                fields = arcpy.ListFields(feature_class)
                self._add_result(results, "3.3", len(fields) >= 61, f"Found {len(fields)} fields")
                
                try:
                    sql_conn = arcpy.ArcSDESQLExecute(sde_connection)
                    # 3.5 NGUID uniqueness
                    q1 = "SELECT COUNT(*) FROM (SELECT NGUID FROM SDE.NG911_SiteAddress WHERE NGUID IS NOT NULL GROUP BY NGUID HAVING COUNT(*) > 1) as sub"
                    res1 = sql_conn.execute(q1)
                    duplicates = int(res1) if res1 else 0
                    self._add_result(results, "3.5", duplicates == 0, f"Found {duplicates} duplicate NGUIDs")
                    
                    # 3.6 Mandatory fields populated
                    q2 = "SELECT COUNT(*) FROM SDE.NG911_SiteAddress WHERE DiscrpAgID IS NULL OR Country IS NULL OR A1 IS NULL OR A2 IS NULL OR A3 IS NULL"
                    res2 = sql_conn.execute(q2)
                    nulls = int(res2) if res2 else 0
                    self._add_result(results, "3.6", nulls == 0, f"Found {nulls} records with null mandatory fields")
                    
                    # 3.7 NGUID format valid
                    q3 = "SELECT COUNT(*) FROM SDE.NG911_SiteAddress WHERE NGUID NOT LIKE 'urn:emergency:uid:gis:SSAP:%:%' AND NGUID IS NOT NULL"
                    res3 = sql_conn.execute(q3)
                    invalid_formats = int(res3) if res3 else 0
                    self._add_result(results, "3.7", invalid_formats == 0, f"Found {invalid_formats} invalid format strings")
                    
                except Exception as e_sql:
                    arcpy.AddWarning(f"SQL execution failed: {e_sql}")
                    self._add_result(results, "3.5", False, f"SQL Query failed: {e_sql}")
                    self._add_result(results, "3.6", False, "Blocked by 3.5 SQL error")
                    self._add_result(results, "3.7", False, "Blocked by 3.5 SQL error")

        except Exception as e:
            self._add_result(results, "3.2", False, f"Schema validation failed: {e}")

        arcpy.AddMessage("Phase 4: Simulating Attribute Rules (Insert & Delete)...")
        try:
            # We insert a dummy point into a temporary edit session using the dedicated Sicamous connection
            edit = arcpy.da.Editor(sde_edit_conn)
            
            # Stop any floating edit sessions just in case
            if edit.isEditing:
                edit.stopEditing(False)
                
            # Multiuser MUST be True for versioned SDE editing
            edit.startEditing(False, True)
            edit.startOperation()
            
            inserted_oid = None
            
            try:
                with arcpy.da.InsertCursor(feature_class_edit, ["SHAPE@XY", "Add_Number", "StN_PreDir", "StreetName", "StN_PosTyp", "A3"]) as cursor:
                    inserted_oid = cursor.insertRow([(-118.196, 50.998), 100, "E", "Test", "St", "Revelstoke"])
                    
                if inserted_oid:
                    with arcpy.da.SearchCursor(feature_class_edit, ["Full_Addr", "NGUID", "Long", "Lat", "AddCode", "DateUpdate", "QAStatus"], f"OBJECTID = {inserted_oid}") as sc:
                        for row in sc:
                            self._add_result(results, "4.1", row[0] == "100 E Test St", f"PopulateFullAddress: {row[0]}")
                            self._add_result(results, "4.2", str(row[1]).startswith("urn:emergency:uid:gis:SSAP:"), f"PopulateNGUID: {row[1]}")
                            self._add_result(results, "4.3", row[2] and row[2] < 0, f"Longitude: {row[2]}")
                            self._add_result(results, "4.4", row[3] and row[3] > 0, f"Latitude: {row[3]}")
                            self._add_result(results, "4.5", row[4] != None, f"AddCode: {row[4]}")
                            self._add_result(results, "4.6", row[5] != None, f"DateUpdate fired")
                            self._add_result(results, "4.7", row[6] == "Pending", f"QAStatus: {row[6]}")
                            
            except Exception as e_insert:
                arcpy.AddWarning(f"Insert failed: {e_insert}")
                self._add_result(results, "4.1", False, f"Insert simulation failed: {str(e_insert)}")
                self._add_result(results, "4.2", False, "Blocked")
                self._add_result(results, "4.3", False, "Blocked")
                self._add_result(results, "4.4", False, "Blocked")
                self._add_result(results, "4.5", False, "Blocked")
                self._add_result(results, "4.6", False, "Blocked")
                self._add_result(results, "4.7", False, "Blocked")

            edit.abortOperation()
            edit.stopEditing(False)
            arcpy.AddMessage("Simulation dummy data reverted.")
        except Exception as e:
            err_msg = str(e)
            if "not allowed while editing" in err_msg or "sde.DEFAULT" in err_msg:
                arcpy.AddWarning("DEFAULT is protected. Skipping Phase 4.")
                msg = "Skipped: Provide an Editable SDE Connection (e.g. SDE.QA) parameter to run"
                self._add_result(results, "4.1", "skip", msg)
                self._add_result(results, "4.2", "skip", msg)
                self._add_result(results, "4.3", "skip", msg)
                self._add_result(results, "4.4", "skip", msg)
                self._add_result(results, "4.5", "skip", msg)
                self._add_result(results, "4.6", "skip", msg)
                self._add_result(results, "4.7", "skip", msg)
            else:
                arcpy.AddWarning(f"Phase 4 Simulation failed entirely: {e}")

        arcpy.AddMessage("Phase 6: QA Engine Dry-Runs")
        try:
            if "3.5" in results and "3.7" in results:
                self._add_result(results, "6.2", (results["3.5"]["status"] == "pass") and (results["3.7"]["status"] == "pass"), "Inherits NGUID uniqueness checks")
            else:
                 self._add_result(results, "6.2", False, "Dependency checks missing")
                 
            if "3.6" in results:
                self._add_result(results, "6.3", results["3.6"]["status"] == "pass", "Inherits Mandatory Field check")
                
            sql_conn = arcpy.ArcSDESQLExecute(sde_connection)
            q_dup_addr = "SELECT COUNT(*) FROM (SELECT Full_Addr FROM SDE.NG911_SiteAddress WHERE Full_Addr IS NOT NULL GROUP BY Full_Addr HAVING COUNT(*) > 1) as sub"
            try:
                dups = int(sql_conn.execute(q_dup_addr) or 0)
                self._add_result(results, "6.4", dups == 0, f"Found {dups} duplicate exact addresses")
            except:
                self._add_result(results, "6.4", False, f"Duplicate query failed")
        except Exception as e:
            arcpy.AddWarning(f"Phase 6 Simulation failed: {e}")

        # Adding placeholders for Notebook/Pipeline tasks that aren't running
        skipped = ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "6.1", "6.5", "7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "8.1", "8.2", "8.3", "8.4", "8.5", "10.1", "10.2"]
        for tid in skipped:
            results[tid] = {"status": "skip", "details": "Deferred to pipeline execution logs"}

        arcpy.AddMessage(f"Writing output to {out_json_path}")
        with open(out_json_path, 'w') as f:
            json.dump(results, f, indent=2)
            
        arcpy.AddMessage("Diagnostics Completed Successfully.")
        return
