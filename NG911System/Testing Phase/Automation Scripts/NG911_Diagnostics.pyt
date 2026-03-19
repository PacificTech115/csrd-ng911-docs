import arcpy
import os
import json

class Toolbox(object):
    def __init__(self):
        """Define the toolbox (the name of the toolbox is the name of the .pyt file)."""
        self.label = "NG911 System Diagnostics"
        self.alias = "ng911_diagnostics"
        self.tools = [SystemDiagnostics]

class SystemDiagnostics(object):
    def __init__(self):
        """Define the tool (tool name is the name of the class)."""
        self.label = "Run System Diagnostics"
        self.description = "Performs deep health checks on the NG911 SDE connection, UNC paths, schema rules, and version locks. Returns a JSON string of pass/fail results."
        self.canRunInBackground = True
        
        # Configuration defaults
        self.MUNI_VERSIONS = ["SDE.CSRD", "SDE.Salmon Arm", "SDE.Sicamous", "SDE.Golden", "SDE.Revelstoke"]
        self.REQUIRED_DOMAINS = ["Directional", "StreetType", "Agency", "Placement", "RoadClass"]

    def getParameterInfo(self):
        """Define parameter definitions"""
        
        # Input 0: SDE Connection String
        param_sde = arcpy.Parameter(
            displayName="SDE Connection File",
            name="in_sde_connection",
            datatype="DEWorkspace",
            parameterType="Required",
            direction="Input")
        param_sde.value = r"\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde"
        
        # Input 1: Export Network Share Path
        param_share = arcpy.Parameter(
            displayName="Network Export Share Directory",
            name="in_export_share",
            datatype="DEFolder",
            parameterType="Required",
            direction="Input")
        param_share.value = r"\\GIS\Scripts\Geoshare\NG911 Exports"
        
        param_out_json = arcpy.Parameter(
            displayName="Output Results (JSON String)",
            name="out_results",
            datatype="GPString",
            parameterType="Derived",
            direction="Output")

        return [param_sde, param_share, param_out_json]

    def isLicensed(self):
        """Set whether tool is licensed to execute."""
        return True

    def updateParameters(self, parameters):
        """Modify the values and properties of parameters before internal validation is performed."""
        return

    def updateMessages(self, parameters):
        """Modify the messages created by internal validation for each tool parameter."""
        return

    def _add_result(self, results_dict, test_id, passed, details=""):
        """Helper to standardize output format"""
        results_dict[test_id] = {
            "status": "pass" if passed else "fail",
            "details": str(details)
        }

    def execute(self, parameters, messages):
        """The source code of the tool."""
        
        sde_connection = parameters[0].valueAsText
        export_share = parameters[1].valueAsText
        
        # Hardcode Phase 4 to use the Sicamous version
        sde_edit_conn = os.path.join(os.path.dirname(sde_connection), "sde@sicamous.sde") 
        feature_class = os.path.join(sde_connection, "SDE.NG911", "SDE.NG911_SiteAddress")
        feature_class_edit = os.path.join(sde_edit_conn, "SDE.NG911", "SDE.NG911_SiteAddress")
        
        results = {}
        arcpy.AddMessage("Starting NG911 System Diagnostics...")

        # ==========================================
        # Phase 1: Infrastructure & Connectivity
        # ==========================================
        arcpy.AddMessage("Phase 1: Checking Infrastructure...")
        
        # 1.1 / 1.2 SQL Server Availability & SDE Connection
        try:
            desc = arcpy.Describe(sde_connection)
            self._add_result(results, "1.2", True, f"Connected to {getattr(desc, 'connectionString', 'DB')}")
            self._add_result(results, "1.1", True, "Database host is reachable")
        except Exception as e:
            self._add_result(results, "1.2", False, f"Failed to connect: {e}")
            self._add_result(results, "1.1", False, "Connection failed entirely")
            
        # 1.3 UNC Path Access
        sde_dir = os.path.dirname(sde_connection)
        self._add_result(results, "1.3", os.path.exists(sde_dir), f"Accessible: {sde_dir}")
        
        # 1.4 Network Share (Exports)
        has_share_read = os.path.exists(export_share)
        has_share_write = os.access(export_share, os.W_OK) if has_share_read else False
        if has_share_read and has_share_write:
            self._add_result(results, "1.4", True, f"Readable & Writable: {export_share}")
        else:
            self._add_result(results, "1.4", False, f"Missing or Read-Only: R={has_share_read}, W={has_share_write}")

        # ==========================================
        # Phase 2: Versioning Hierarchy
        # ==========================================
        arcpy.AddMessage("Phase 2: Checking Versioning Hierarchy...")
        try:
            versions = [v.name for v in arcpy.da.ListVersions(sde_connection)]
            
            # 2.1 DEFAULT exists
            self._add_result(results, "2.1", "sde.DEFAULT" in versions, "sde.DEFAULT found")
            
            # 2.2 QA exists
            self._add_result(results, "2.2", "SDE.QA" in versions, "SDE.QA found")
            
            # 2.3 Municipal versions exist
            missing_munis = [m for m in self.MUNI_VERSIONS if m not in versions]
            if missing_munis:
                self._add_result(results, "2.3", False, f"Missing versions: {missing_munis}")
            else:
                self._add_result(results, "2.3", True, "All 5 municipal versions are active")
            
            # 2.4 / 2.5 / 2.6 - Defer to manual interaction checks
            results["2.4"] = {"status": "skip", "details": "Requires manual UI check for 'Protected' status"}
            results["2.5"] = {"status": "skip", "details": "Stale locks check deferred"}
            results["2.6"] = {"status": "skip", "details": "Geodatabase Compress deferred to monthly manual task"}

        except Exception as e:
            self._add_result(results, "2.1", False, f"Could not list versions: {e}")
            self._add_result(results, "2.2", False, "Blocked by 2.1")
            self._add_result(results, "2.3", False, "Blocked by 2.1")

        # ==========================================
        # Phase 3: Schema & Data Integrity
        # ==========================================
        arcpy.AddMessage("Phase 3: Validating Schema & Data Integrity...")
        try:
            fc_exists = arcpy.Exists(feature_class)
            self._add_result(results, "3.2", fc_exists, "SDE.NG911_SiteAddress exists")
            
            if fc_exists:
                # 3.3 All 61+ fields present
                fields = arcpy.ListFields(feature_class)
                self._add_result(results, "3.3", len(fields) >= 61, f"Found {len(fields)} fields in Feature Class")
                
                # --- SQL Based Checks ---
                arcpy.AddMessage("Running Deep SQL Checks (NGUID & Nulls)...")
                try:
                    sql_conn = arcpy.ArcSDESQLExecute(sde_connection)
                    
                    # 3.5 NGUID uniqueness
                    q1 = """
                        SELECT COUNT(*) as duplicate_count FROM (
                            SELECT NGUID FROM SDE.NG911_SiteAddress
                            WHERE NGUID IS NOT NULL
                            GROUP BY NGUID
                            HAVING COUNT(*) > 1
                        ) as sub
                    """
                    res1 = sql_conn.execute(q1)
                    duplicates = int(res1) if res1 else 0
                    self._add_result(results, "3.5", duplicates == 0, f"Found {duplicates} duplicate NGUIDs")
                    
                    # 3.6 Mandatory fields populated
                    q2 = """
                        SELECT COUNT(*) FROM SDE.NG911_SiteAddress 
                        WHERE DiscrpAgID IS NULL 
                           OR Country IS NULL 
                           OR A1 IS NULL 
                           OR A2 IS NULL 
                           OR A3 IS NULL
                    """
                    res2 = sql_conn.execute(q2)
                    nulls = int(res2) if res2 else 0
                    self._add_result(results, "3.6", nulls == 0, f"Found {nulls} records with null mandatory fields")
                    
                    # 3.7 NGUID format valid
                    q3 = """
                        SELECT COUNT(*) FROM SDE.NG911_SiteAddress 
                        WHERE NGUID NOT LIKE 'urn:emergency:uid:gis:SSAP:%:%' 
                          AND NGUID IS NOT NULL
                    """
                    res3 = sql_conn.execute(q3)
                    invalid_formats = int(res3) if res3 else 0
                    self._add_result(results, "3.7", invalid_formats == 0, f"Found {invalid_formats} invalid NGUID format strings")
                    
                except Exception as e_sql:
                    arcpy.AddWarning(f"SQL execution failed: {e_sql}")
                    self._add_result(results, "3.5", False, f"SQL Query failed: {e_sql}")
                    self._add_result(results, "3.6", False, "Blocked by 3.5 SQL error")
                    self._add_result(results, "3.7", False, "Blocked by 3.5 SQL error")

        except Exception as e:
            self._add_result(results, "3.2", False, f"Schema validation failed: {e}")

        # ==========================================
        # Phase 4: Attribute Rules Simulation
        # ==========================================
        arcpy.AddMessage("Phase 4: Simulating Attribute Rules (Insert & Delete)...")
        try:
            # We insert a dummy point into a temporary edit session
            edit = arcpy.da.Editor(sde_edit_conn)
            if edit.isEditing:
                edit.stopEditing(False)
                
            # Multiuser MUST be True for versioned SDE editing
            edit.startEditing(False, True)
            edit.startOperation()
            
            inserted_oid = None
            
            # Fields: SHAPE@WKT (to get geometry for Lat/Long), Add_Number, StN_PreDir, StreetName, StN_PosTyp, A3
            # We insert via InsertCursor
            fields = ["SHAPE@XY", "Add_Number", "StN_PreDir", "StreetName", "StN_PosTyp", "A3"]
            
            try:
                with arcpy.da.InsertCursor(feature_class_edit, fields) as cursor:
                    # Insert at roughly Revelstoke coordinates
                    inserted_oid = cursor.insertRow([(-118.196, 50.998), 100, "E", "Test", "St", "Revelstoke"])
                    
                if inserted_oid:
                    # Now immediately read it back to see what Arcade calculated
                    check_fields = ["Full_Addr", "NGUID", "Long", "Lat", "AddCode", "DateUpdate", "QAStatus"]
                    with arcpy.da.SearchCursor(feature_class_edit, check_fields, f"OBJECTID = {inserted_oid}") as sc:
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

            # CRITICAL: Always undo the operation to prevent dummy data from remaining in the DB
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

        # ==========================================
        # Phase 6: QA Engine & Pipeline Dry-Runs
        # ==========================================
        arcpy.AddMessage("Phase 6: QA Engine Dry-Runs")
        try:
            # 6.2 NGUID Integrity (already checked in Phase 3.5 and 3.7) -> Copy result
            if "3.5" in results and "3.7" in results:
                passed_62 = (results["3.5"]["status"] == "pass") and (results["3.7"]["status"] == "pass")
                self._add_result(results, "6.2", passed_62, "Inherits NGUID uniqueness & format checks from Ph 3")
            else:
                 self._add_result(results, "6.2", False, "Dependency checks missing")
                 
            # 6.3 Mandatory Null Detection
            if "3.6" in results:
                self._add_result(results, "6.3", results["3.6"]["status"] == "pass", "Inherits Mandatory Field check from Ph 3")
                
            # 6.4 Address duplicate detection (Non-blocking warning)
            sql_conn = arcpy.ArcSDESQLExecute(sde_connection)
            q_dup_addr = """
                SELECT COUNT(*) FROM (
                    SELECT Full_Addr FROM SDE.NG911_SiteAddress WHERE Full_Addr IS NOT NULL
                    GROUP BY Full_Addr HAVING COUNT(*) > 1
                ) as sub
            """
            
            try:
                dups = int(sql_conn.execute(q_dup_addr) or 0)
                self._add_result(results, "6.4", dups == 0, f"Found {dups} duplicate exact addresses")
            except:
                self._add_result(results, "6.4", False, f"Duplicate query failed")
            
        except Exception as e:
            arcpy.AddWarning(f"Phase 6 Simulation failed: {e}")        # ==========================================
        # Complete
        # ==========================================
        # Produce the final formatted JSON string
        json_output = json.dumps(results, indent=2)
        
        # Set the derived output parameter (Index 2)
        parameters[2].value = json_output
        
        arcpy.AddMessage("Diagnostics Completed Successfully. Returning JSON block.")
        
        return
