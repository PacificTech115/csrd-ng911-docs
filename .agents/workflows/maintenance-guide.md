---
description: Generate or update the Maintenance Guide for the CSRD NG911 system operations and troubleshooting
---

# Maintenance Guide Agent

This workflow generates or updates the **Maintenance Guide** (`docs/maintenance.html`) — the operational procedures, troubleshooting playbook, and system health reference for administrators of the CSRD NG911 Central Database.

---

## Context

- **System**: ArcGIS Enterprise with SQL Server + ArcSDE, traditional versioning
- **Versions**: sde.DEFAULT (production) → SDE.QA (validation gate) → 5 municipal editor versions
- **Automation**: Nightly pipeline — Reconcile Municipal→QA → QA Validation → Reconcile QA→DEFAULT → Export → Email
- **Notifications**: Power Automate email reports

---

## Steps

### 1. Gather Operational Knowledge

Read the following source files:
- `docs/maintenance.html` (current maintenance page)
- All pipeline scripts in `Working/` and `Database Automation/1.ReconcilePost-QA-Export/`
- `docs/quick-reference.html` for server URLs, SDE connection paths, version names
- `docs/power-automate.html` for notification flow configuration

### 2. Generate the Maintenance Page

Create or update `docs/maintenance.html`:

#### Required Sections

**Section 1: Pipeline Monitoring**
- How to verify the nightly pipeline ran successfully
- Checking Notebook Server logs
- Reading Power Automate email reports
- Version state verification in ArcGIS Pro
- Use `.alert.info` for checklist items

**Section 2: Common Issues & Troubleshooting**
Document each issue using a `.card` with `.alert.warning` header:

| Issue | Likely Cause | Resolution |
|-------|-------------|------------|
| Reconcile fails with conflicts | Concurrent edits in same geography | Manual conflict resolution in ArcGIS Pro |
| QA validation returns errors | Missing mandatory fields | Fill required fields, re-run QA GP tool |
| Notebook Server job doesn't start | Scheduled task disabled or server restart | Check Notebook Server admin, re-enable task |
| Export FGDB is stale | Export step failed | Re-run export GP tool manually |
| Power Automate email not sent | Flow disabled or HTTP connector expired | Re-authorize connector in Power Automate portal |
| Version locks persist | Orphaned SDE connections | Kill locks via ArcSDE admin or SQL Server |

**Section 3: Adding a New Municipality**
Step-by-step guide using numbered `.breakdown-card` components:
1. Create SDE version (child of SDE.QA)
2. Add agency to `Agency` domain in ArcGIS Pro
3. Add `DiscrpAgID` value to the domain
4. Add locality entries to the AddCode lookup table
5. Update attribute rules if agency-specific logic needed
6. Create an ArcGIS Portal named user for the municipality
7. Share feature service with the new user
8. Update Power Automate flow to include new email recipients
9. Update `Documentation.html` hero stats and architecture diagram

**Section 4: Updating Attribute Rules**
- How to export an existing rule from the geodatabase
- Edit Arcade in ArcGIS Pro Attribute Rules view
- Test in a development environment
- Apply to production

**Section 5: Managing Domains**
- Adding/removing coded values
- Updating the AddCode lookup table
- Impact on existing data

**Section 6: Database Health Checks**
- Monthly tasks: compress geodatabase, rebuild indexes, update statistics
- Quarterly tasks: review version tree, archive old data, audit user permissions
- Annual tasks: review schema against NENA updates

#### HTML Pattern
```html
<!-- Standard sub-page layout -->
<!-- page-header breadcrumb: Home > Maintenance Guide -->
<!-- sidebar with maintenance.html active -->
<!-- Sections with .reveal animations -->
<!-- Troubleshooting cards using .card and .alert.warning -->
<!-- Step-by-step procedures using .breakdown-card -->
```

### 3. Validate

- All common issues documented from real pipeline failure scenarios
- Add-municipality procedure is complete (no missing steps)
- Server URLs and file paths match `quick-reference.html`
- Responsive layout works
- Links to related pages (GP tools, attribute rules, schemas) are correct

---

## Output

- **`docs/maintenance.html`** — Complete maintenance guide
