---
description: Generate or update documentation for Python automation notebooks, GP tools, and Power Automate flows
---

# Automation Scripts Documentation Agent

This workflow generates or updates documentation pages for all automation components in the CSRD NG911 system: ArcGIS Notebook Server scripts, Geoprocessing tools, and Power Automate email flows.

---

## Context

### Source Files

#### ArcGIS Notebooks (`Working/ArcgisNotebooksCode/`)
| File | Purpose |
|------|---------|
| `1NightlyQAReconcileExportNotebook.py` | Nightly orchestrator — runs QA, reconcile, and export in sequence |
| `QAtestNotebook.py` | QA validation notebook |
| `ReconcilePostNotebook.py` | Reconcile & post notebook |
| `ExportNotebook.py` | Export to file geodatabase |
| `qa_ssap_toolbox.pyt` | Python toolbox for QA GP service |

#### GP Tools (`Database Automation/1.ReconcilePost-QA-Export/`)
| File | Purpose |
|------|---------|
| `QASSAPGPtool.py` | QA validation GP service (~38KB) |
| `ReconcilePostGPtool.py` | Reconcile/Post GP service |
| `ExportGPtool.py` | Export GP service |
| `1.NG911-Reconcile Municipal-QA- Reconcile Default.py` | Full pipeline script |

#### Power Automate
| File | Purpose |
|------|---------|
| `PowerautomateEmail-Reconcile-QA-Reconcile-Export.html` | Email template for pipeline results |

#### Working Scripts (`Working/`)
| File | Purpose |
|------|---------|
| `ReconcileMunicipalToQA.py` | Reconcile municipal versions → QA |
| `ReconcileQAToDefault.py` | Reconcile QA → DEFAULT |
| `RunQAStatusNotebook.py` | Run QA notebook programmatically |

---

## Steps

### 1. Read All Python Source Files

For each script:
- Parse imports, function definitions, and main execution flow
- Identify ArcPy operations (e.g., `arcpy.ReconcileVersions_management`, `arcpy.FeatureClassToFeatureClass_conversion`)
- Extract parameters, environment settings, and error handling patterns
- Note any REST API calls to ArcGIS Server
- Document scheduling configuration (if any)

### 2. Generate the ArcGIS Notebooks Page

Create or update `docs/automation-scripts.html`:

#### Required Sections
1. **Overview** — Role of ArcGIS Notebook Server in the system
2. **Nightly Pipeline Diagram** — Use `.pipeline` classes with 5 stages:
   - Stage 1: Municipal → QA Reconcile (`.s1`)
   - Stage 2: QA Validation (`.s2`)
   - Stage 3: QA → DEFAULT Reconcile (`.s3`)
   - Stage 4: Export to FGDB (`.s4`)
   - Stage 5: Email Notification (`.s5`)
3. **Script Cards** — One `.card` per script with:
   - Purpose description
   - Runtime / scheduling info
   - Input parameters
   - Key ArcPy operations used
   - Link to detail page

Each script should link to a detail page:
```html
<a class="link-card reveal" href="docs/script-{name}.html">
```

### 3. Generate Per-Script Detail Pages

For each script, create `docs/script-{name}.html`:

#### Required Sections
1. **Header** — Script name, runtime badge, scheduling badge
2. **Purpose** — What the script does in plain English
3. **Parameters** — Table of input parameters with types and defaults
4. **Execution Flow** — Numbered steps using `.breakdown-card` components
5. **Full Source Code** — In a `.code-block` with Python syntax highlighting:
   - `.kw` for keywords (`import`, `def`, `if`, `try`, `except`, `return`)
   - `.fn` for function calls (`arcpy.ReconcileVersions_management`)
   - `.str` for strings
   - `.cm` for comments
   - `.var` for variables
6. **Error Handling** — How errors are caught and reported
7. **Dependencies** — Other scripts/services this script calls, shown with `.dependency-chips`
8. **Maintenance Notes** — How to modify parameters, add new municipalities, troubleshoot

### 4. Generate the GP Tools Page

Create or update `docs/gp-tools.html`:

#### Required Sections
1. **Overview** — What GP services are and how they're published
2. **Service Inventory** — Table of GP services with:
   - Service name and URL
   - Input/output parameters
   - Execution type (sync/async)
3. **Per-Tool Details** — For each GP tool:
   - Parameter schema
   - REST endpoint URL format
   - Example request/response

### 5. Generate the Power Automate Page

Create or update `docs/power-automate.html`:

#### Required Sections
1. **Overview** — Role of Power Automate in the system
2. **Flow Diagram** — Trigger → conditions → email
3. **Email Template** — Preview of the HTML email report
4. **Configuration** — How to update recipients, modify conditions

### 6. Validate

- All scripts in `Working/` and `Database Automation/` are documented
- Pipeline diagram stages match actual execution order
- GP service URLs are accurate
- Internal links between pages work (e.g., orchestrator → QA detail, QA → GP tool)
- Code blocks have proper Python syntax highlighting

---

## Output

- **`docs/automation-scripts.html`** — ArcGIS Notebooks overview + links
- **`docs/script-orchestrator.html`** — Nightly orchestrator detail
- **`docs/script-qa.html`** — QA validation detail
- **`docs/script-reconcile.html`** — Reconcile/Post detail
- **`docs/script-etl.html`** — Salmon Arm ETL sync detail
- **`docs/script-export.html`** — Export detail
- **`docs/gp-tools.html`** — GP services overview + details
- **`docs/power-automate.html`** — Power Automate flow documentation
