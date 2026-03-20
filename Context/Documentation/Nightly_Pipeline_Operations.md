# Nightly Pipeline Operations

The nightly pipeline is a 5-stage automated process that promotes municipal address edits through the versioning hierarchy, validates data quality, exports a snapshot, and syncs status back to editors.

## Pipeline Overview

```
Stage 1: MUNI_TO_QA
  Municipal versions (CSRD, Revelstoke, Golden, Salmon Arm, Sicamous) --> SDE.QA

Stage 2: RUN_QA
  Validate SDE.QA contents (schema, NGUID, mandatory fields, duplicates)

Stage 3: QA_TO_DEFAULT
  SDE.QA --> sde.DEFAULT (production)

Stage 4: EXPORT_DEFAULT
  sde.DEFAULT --> File GDB ZIP --> network share

Stage 5: DEFAULT_TO_MUNI_SYNC
  sde.DEFAULT --> municipal versions (sync QAStatus back to editors, NO_POST)
```

## Orchestrator Script

**File:** `1.NG911-Reconcile Municipal-QA- Reconcile Default.py`
**GP Service:** `/Regional/Orchestrator/GPServer/Orchestrator`
**ArcGIS Notebook Item ID:** `811614c266a84b769c1fe9ffbedda058`
**Web app page:** `#script-orchestrator`

## Configuration

| Setting | Value |
|---------|-------|
| SDE Connection | `\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde` |
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
- **Checks:** Schema fields, NGUID duplicates/format, mandatory field nulls, address duplicates
- **Updates:** Writes QAStatus field on each record (Passed, Warning, or error message)
- **Blocking:** QA_BLOCKING=False means pipeline continues even if QA finds issues

### Stage 3: QA_TO_DEFAULT
- **Tool:** ReconcilePostTraditional (stage=QA_TO_DEFAULT)
- **Action:** Reconciles SDE.QA into sde.DEFAULT and posts changes
- **Conflict resolution:** Favors edit version (QA wins over DEFAULT)
- **Result:** Validated data is now in the authoritative production version

### Stage 4: EXPORT_DEFAULT
- **Tool:** ExportEnterpriseToFileGDB
- **Action:** Exports sde.DEFAULT to a File Geodatabase, zips it, copies to network share
- **Output:** `\\GIS\Scripts\Geoshare\NG911 Exports\SSAP_Default_{timestamp}.zip`
- **Result:** A timestamped snapshot of the production database is available for download

### Stage 5: DEFAULT_TO_MUNI_SYNC
- **Tool:** ReconcilePostTraditional (stage=DEFAULT_TO_MUNI_SYNC)
- **Action:** Reconciles sde.DEFAULT back into each municipal version (NO_POST)
- **Conflict resolution:** Favors target version (DEFAULT wins)
- **Result:** Updated QAStatus values and any changes are synced back to municipal editors

## Failure Handling

- If any stage fails, the pipeline halts at that stage (except QA when QA_BLOCKING=False)
- Final status values: `success`, `success_qa_warnings`, `stage1_failed`, `stage2_failed`, `stage3_failed`, `stage4_failed`, `stage5_failed`
- All stage results (success or failure) are captured in the run summary

## Notifications

On completion, the Orchestrator:
1. Sends a Power Automate webhook with the run summary payload
2. Updates the CMS Hosted Table with the latest run data (Base64-encoded JSON)
3. Writes a full run summary JSON to `/arcgis/home/run_summaries/nightly_orchestrator_{runId}.json`

The Power Automate flow sends an email notification to the team with:
- Overall status (success/failure)
- Per-stage results
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
1. **Force Run button** on the Automations Dashboard -- triggers the full 5-stage pipeline
2. **Individual GP tools** from their respective script pages -- runs a single stage independently
