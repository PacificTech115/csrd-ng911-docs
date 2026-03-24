# Nightly Pipeline Operations

The nightly pipeline is a 6-stage automated process that promotes municipal address edits through the versioning hierarchy, validates data quality, compresses the geodatabase, recreates clean editor versions, and exports a snapshot.

## Pipeline Overview

```
Stage 1: MUNI_TO_QA
  Municipal versions (CSRD, Revelstoke, Golden, Salmon Arm, Sicamous) --> SDE.QA

Stage 2: RUN_QA
  Validate SDE.QA contents (schema, NGUID, mandatory fields, duplicates)
  Uses sde@regional_qa.sde connection to target the QA version

Stage 3: QA_TO_DEFAULT
  SDE.QA --> sde.DEFAULT (production)

Stage 4: COMPRESS (non-blocking)
  Compress geodatabase to push versioned deltas to base table

Stage 5: DELETE_RECREATE_VERSIONS
  Delete and recreate municipal editor versions as children of SDE.QA (PUBLIC access)

Stage 6: EXPORT_DEFAULT
  sde.DEFAULT --> File GDB ZIP --> network share
```

## Orchestrator Script

**File:** `1.NG911-Reconcile Municipal-QA- Reconcile Default.py`
**Notebook Server GP Service:** `https://apps.csrd.bc.ca/notebook/rest/services/{itemId}/GPServer/{taskName}`
**ArcGIS Notebook Item ID:** `811614c266a84b769c1fe9ffbedda058`
**Web app page:** `#script-orchestrator`

## Configuration

| Setting | Value |
|---------|-------|
| SDE Connection (DEFAULT) | `\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde` |
| SDE Connection (QA) | `\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional_qa.sde` |
| DEFAULT Version | `sde.DEFAULT` |
| QA Version | `SDE.QA` |
| Editor Versions | `SDE.CSRD;SDE.Revelstoke;SDE.Golden;SDE.Salmon Arm;SDE.Sicamous` |
| Conflict Policy | `NO_ABORT` (continues even if conflicts detected) |
| Lock Acquisition | `LOCK_ACQUIRED` |
| QA Blocking | `False` (pipeline continues even if QA finds issues) |
| Job Poll Interval | 3 seconds |
| Job Timeout | 30 minutes |

## Stage Details

### Stage 1: MUNI_TO_QA
- **Tool:** ReconcilePostTraditional (stage=MUNI_TO_QA)
- **Action:** Reconciles all 5 municipal editor versions into SDE.QA and posts changes
- **Conflict resolution:** Favors edit version (municipal edits win over QA)
- **Result:** All municipal edits are now in the QA staging version

### Stage 2: RUN_QA
- **Tool:** QAAutomationScriptTool
- **Action:** Validates the QA version contents against the schema
- **Target:** Uses `sde@regional_qa.sde` to check the SDE.QA version directly (not DEFAULT)
- **Checks:** Schema fields, NGUID duplicates/format, mandatory field nulls, address duplicates
- **Updates:** Writes QAStatus field on each record (Passed, Warning, or error message)
- **Blocking:** QA_BLOCKING=False means pipeline continues even if QA finds issues
- **Note:** Prior to March 2026, this stage incorrectly targeted sde.DEFAULT, causing QAStatus updates to take 2 pipeline cycles to take effect

### Stage 3: QA_TO_DEFAULT
- **Tool:** ReconcilePostTraditional (stage=QA_TO_DEFAULT)
- **Action:** Reconciles SDE.QA into sde.DEFAULT and posts changes
- **Conflict resolution:** Favors edit version (QA wins over DEFAULT)
- **Result:** Validated data is now in the authoritative production version

### Stage 4: COMPRESS (non-blocking)
- **Tool:** ReconcilePostTraditional (stage=COMPRESS)
- **Action:** Runs `arcpy.management.Compress` on the geodatabase
- **Purpose:** Pushes versioned deltas to the base table so SQL Server queries without `_evw` reflect the latest data
- **Non-blocking:** If compression fails (e.g., due to active locks), the pipeline logs a warning and continues
- **Result:** Base table is fully up to date with all reconciled data

### Stage 5: DELETE_RECREATE_VERSIONS
- **Tool:** ReconcilePostTraditional (stage=DELETE_RECREATE_VERSIONS)
- **Action:** Deletes all municipal editor versions and recreates them as children of SDE.QA with PUBLIC access
- **Purpose:** Ensures editors start each day from a clean, fully synced state with no stale delta rows
- **Placement:** After Compress so the recreated versions inherit the compressed base table
- **Result:** Fresh editor versions with the latest authoritative data

### Stage 6: EXPORT_DEFAULT
- **Tool:** ExportEnterpriseToFileGDB
- **Action:** Exports sde.DEFAULT to a File Geodatabase, zips it, copies to network share
- **Output:** `\\GIS\Scripts\Geoshare\NG911 Exports\SSAP_Default_{timestamp}.zip`
- **Result:** A timestamped snapshot of the production database is available for download

## Failure Handling

- If any stage fails, the pipeline halts at that stage (except QA when QA_BLOCKING=False, and COMPRESS which is non-blocking)
- Final status values: `success`, `success_qa_warnings`, `stage1_failed`, `stage2_failed`, `stage3_failed`, `stage4_failed`, `stage5_failed`, `stage6_failed`
- COMPRESS failures produce a warning status but do not halt the pipeline
- All stage results (success or failure) are captured in the run summary

## Notifications

On completion, the Orchestrator:
1. Sends a Power Automate webhook with the run summary payload
2. Updates the CMS Hosted Table with the latest run data (Base64-encoded JSON)
3. Writes a full run summary JSON to `/arcgis/home/run_summaries/nightly_orchestrator_{runId}.json`

The Power Automate flow sends an email notification (6-stage HTML template) to the team with:
- Overall status (success/failure)
- Per-stage results (COMPRESS shows WARNING in amber instead of red FAILED)
- QA summary (pass/fail counts, issues found)
- Link to the exported ZIP file

## Run Summary Structure

The run summary JSON includes:
- `run_id`: Timestamp-based identifier
- `user`: Account that triggered the run
- `started` / `finished`: ISO timestamps
- `status`: Overall result
- `stage_results`: Detailed output from each stage's GP tool
- `stage_summaries`: Human-readable summary per stage
- `output_files`: Paths to generated artifacts (ZIP, logs, CSVs)

## Monitoring

- **Automations Dashboard** (`#automations-dashboard`): Shows the latest run status with stage-by-stage breakdown
- **Run summary files**: Stored at `/arcgis/home/run_summaries/` on the ArcGIS Server
- **Power Automate email**: Sent to configured recipients on every run

## Running Manually

Admins can trigger the pipeline in two ways:
1. **Force Run button** on the Automations Dashboard -- triggers the full 6-stage pipeline via the Notebook Server GP service
2. **Individual GP tools** from their respective script pages -- runs a single stage independently
