# GP Tools Complete Guide

This guide covers the three Geoprocessing (GP) tools available in the NG911 Documentation Hub web app, including exact parameters, defaults, step-by-step instructions, and expected outputs.

## Important: Web App vs Portal

- **NG911 Documentation Hub** (`apps.csrd.bc.ca/ng911`): The web app where you run GP tools, view docs, and use the AI assistant.
- **CSRD ArcGIS Enterprise Portal** (`apps.csrd.bc.ca/hub`): The Portal for maps, data management, and ArcGIS Pro connections.
- These are different applications. GP tools are run from the Documentation Hub, not the Portal.

## How to Run GP Tools (Web App UI)

GP tools are admin-only. They are accessed from the Documentation Hub at specific routes:

1. Navigate to the tool page: `#script-export`, `#script-qa`, or `#script-reconcile`
2. The GP Runner UI appears below the documentation with a parameter form
3. Parameters are pre-populated with defaults (see below)
4. Modify parameters if needed, then click "Submit Job"
5. The UI polls the ArcGIS Server every 3 seconds for job status
6. Status displays: Submitted, Waiting, Running, Completed, or Failed
7. On success, output JSON is displayed in the console area

Alternatively, admins can access the GP Tools overview page at `#gp-tools` which links to all three tools.

---

## 1. Export Enterprise to File GDB

**Page route:** `#script-export`
**GP Service endpoint:** `/Landbase/ExportSSAP/GPServer`
**Script:** `ExportGPtool.py`

**Purpose:** Exports a feature class from the Enterprise SDE geodatabase to a File Geodatabase, zips it, and copies the ZIP to a network drop folder for distribution.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| sde_conn | File path | `\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde` | SDE connection file on the server |
| target_fc | String | `SDE.NG911\SDE.NG911_SiteAddress` | Feature class to export |
| name_prefix | String | `SSAP_Default` | Prefix for output ZIP filename |
| agency | String | (empty) | Optional filter: exports only records where `Agency = '{value}'` |

### Step-by-Step

1. Go to `#script-export` in the Documentation Hub
2. The form shows 3 editable fields (sde_conn, target_fc, name_prefix) pre-filled with defaults
3. To export the full database: leave defaults as-is and click Submit Job
4. To export a specific municipality: set `agency` to the municipality name (e.g., "Revelstoke")
5. Wait for job completion (typically 1-3 minutes)
6. Output: a timestamped ZIP file at `\\GIS\Scripts\Geoshare\NG911 Exports\{name_prefix}_{timestamp}.zip`

### Output

The tool produces:
- A File Geodatabase containing the exported feature class
- A ZIP archive of the FGDB
- The ZIP is copied to the network share: `\\GIS\Scripts\Geoshare\NG911 Exports`
- Filename format: `{name_prefix}_{YYYYMMDD_HHMMSS}.zip`

### Common Errors

- **sde_conn blank**: Connection file path is required
- **target_fc not found**: The feature class path doesn't exist in the SDE workspace
- **Network share inaccessible**: The drop folder `\\GIS\Scripts\Geoshare\NG911 Exports` is not reachable from the server

---

## 2. QA Validation (QA Automation Script Tool)

**Page route:** `#script-qa`
**GP Service endpoint:** `/Regional/QA/GPServer`
**Script:** `QASSAPGPtool.py`

**Purpose:** Performs comprehensive quality assurance checks on the NG911 SiteAddress feature class, including schema validation, NGUID integrity, mandatory field checking, and duplicate address detection. Optionally updates the QAStatus field on each record.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| target_layer | String | `SDE.NG911\SDE.NG911_SiteAddress` | Feature class to validate |
| schema_json | File path | `\\GIS\Scripts\NG911\NG911_Automation\SSAP_Schema.json` | JSON schema definition file |
| dataset_name | String | (empty) | Dataset name within schema; if blank, uses first feature class |
| mode | Choice | `all` | Scope: `all`, `required`, or `nonnullable` fields |
| check_types | Boolean | true | Validate field data types match schema |
| check_lengths | Boolean | true | Validate field lengths match schema |
| check_nguid_format | Boolean | false | Validate NGUID matches UUID regex format |
| normalize_nguid | Boolean | true | Convert NGUID values to uppercase |
| mandatory_fields | String | `DiscrpAgID;DateUpdate;NGUID;Country;A3;A2;A1` | Semicolon-separated list of fields that must not be null |
| address_dup_field | String | `Full_Addr` | Field to check for duplicate addresses |
| address_dup_max_rows | Integer | 5000 | Maximum rows to report in duplicate check |
| qa_status_field | String | `QAStatus` | Field name to read/write QA status |
| update_qa_status | Boolean | true | Whether to write QA results back to the feature class |
| out_log_folder | Folder | `/arcgis/home/run_summaries` | Where to write JSON log and CSV reports |

### Step-by-Step

1. Go to `#script-qa` in the Documentation Hub
2. Review the pre-filled parameters (defaults work for standard validation)
3. To run QA without updating records: set `update_qa_status` to false
4. Click Submit Job
5. Wait for completion (2-10 minutes depending on record count)
6. Review the output JSON showing pass/fail counts per check

### QA Checks Performed

1. **Schema validation**: Verifies all expected fields exist with correct types and lengths
2. **Mandatory field nulls**: Checks that DiscrpAgID, DateUpdate, NGUID, Country, A1, A2, A3 are not null
3. **NGUID integrity**: Detects duplicate NGUIDs and optionally validates UUID format
4. **Address duplicates**: Finds records with identical Full_Addr values
5. **Scope filtering**: Only checks records with QAStatus not "Passed" or created within the last 24 hours

### QAStatus Values Written (when update_qa_status=true)

- **"Passed"**: No issues found for the record
- **"Warning: ..."**: Only non-blocking issues (e.g., address duplicates)
- **Error message**: Concatenation of all blocking errors (missing fields, null mandatory values, duplicate NGUIDs)

### Output Files

- `qa_run_{timestamp}.json`: Full QA report with all check results
- `mandatory_null_failures_{timestamp}.csv`: Records with null mandatory fields (ObjectID, NGUID, FailingFields)
- `address_duplicates_{timestamp}.csv`: Duplicate address records (AddressValue, ObjectID, NGUID)

---

## 3. Reconcile/Post Traditional Versioning

**Page route:** `#script-reconcile`
**GP Service endpoint:** `/ReconcilePostTraditional/GPServer`
**Script:** `ReconcilePostGPtool.py`

**Purpose:** Reconciles and posts changes between version levels in the traditional versioned ArcGIS Enterprise geodatabase. Supports three stages of data promotion through the versioning hierarchy.

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| sde_conn | File path | `\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde` | SDE connection file |
| stage | Choice | (none) | `MUNI_TO_QA`, `QA_TO_DEFAULT`, or `DEFAULT_TO_MUNI_SYNC` |
| qa_version | String | `SDE.QA` | QA version name |
| default_version | String | `sde.DEFAULT` | DEFAULT version name |
| editor_versions | String | `SDE.CSRD;SDE.Revelstoke;SDE.Golden;SDE.Salmon Arm;SDE.Sicamous` | Semicolon-separated municipal version names |
| out_log_folder | Folder | `/arcgis/home/run_summaries` | Output folder for reconcile logs |
| conflict_policy | Choice | `NO_ABORT` | `ABORT_CONFLICTS` or `NO_ABORT` |
| acquire_locks | Choice | `LOCK_ACQUIRED` | `LOCK_ACQUIRED` or `NO_LOCK_ACQUIRED` |

### The Three Stages

**Stage 1: MUNI_TO_QA** (Municipal versions into QA)
- Reconciles all municipal editor versions (CSRD, Revelstoke, Golden, Salmon Arm, Sicamous) into the SDE.QA version
- Posts changes (commits them to QA)
- Conflict resolution: favors the edit version (municipal edits win)
- This promotes municipal work into the QA staging area

**Stage 2: QA_TO_DEFAULT** (QA into production)
- Reconciles SDE.QA into sde.DEFAULT
- Posts changes (commits them to DEFAULT)
- Conflict resolution: favors the edit version (QA wins)
- This promotes validated data into the authoritative production version

**Stage 3: DEFAULT_TO_MUNI_SYNC** (Sync back to editors)
- Reconciles sde.DEFAULT back into each municipal version
- Does NOT post (no commit) -- sync-down only
- Conflict resolution: favors the target version (DEFAULT wins)
- This pushes updated QAStatus values and other changes back to municipal editors

### Step-by-Step

1. Go to `#script-reconcile` in the Documentation Hub
2. Select the stage from the dropdown
3. Verify version names are correct
4. For MUNI_TO_QA or DEFAULT_TO_MUNI_SYNC, ensure editor_versions lists all active municipalities
5. Click Submit Job
6. Wait for completion (1-5 minutes per stage)

### Common Errors

- **editor_versions blank**: Required for MUNI_TO_QA and DEFAULT_TO_MUNI_SYNC stages
- **Conflicts detected with ABORT_CONFLICTS**: Reconciliation halted due to edit conflicts; use NO_ABORT to override
- **Lock acquisition failure**: Another user or process has locks on the version

---

## Nightly Pipeline vs Manual GP Tools

**Nightly Pipeline (automated):**
- The Orchestrator notebook (`#script-orchestrator`) runs all 5 stages in sequence automatically
- Stages: MUNI_TO_QA, RUN_QA, QA_TO_DEFAULT, EXPORT_DEFAULT, DEFAULT_TO_MUNI_SYNC
- Triggered on schedule or manually from Automations Dashboard
- Sends Power Automate notification email on completion
- View results at `#automations-dashboard`

**Manual GP Tools (on-demand):**
- Admins can run individual tools from their respective pages
- Useful for re-running a single stage (e.g., re-export after a fix)
- Same parameters as the pipeline but run independently
- Does NOT trigger notifications or update the dashboard

**Automations Dashboard (`#automations-dashboard`):**
- Shows the latest pipeline run status and stage results
- Displays ETL sync status for Salmon Arm
- View-only for monitoring; does NOT trigger exports or runs
- Has a "Force Run" button for admins to trigger the full pipeline
