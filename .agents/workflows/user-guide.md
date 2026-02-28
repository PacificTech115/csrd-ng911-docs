---
description: Generate or update end-user guides and quick reference documentation for CSRD NG911 editors
---

# User Guide Agent

This workflow generates or updates end-user documentation for GIS technicians and municipal editors who interact with the CSRD NG911 Central Database through ArcGIS Pro or Experience Builder.

---

## Context

- **Audience**: Municipal GIS technicians, CSRD addressing staff, third-party contractors
- **Editing tools**: ArcGIS Pro (desktop), ArcGIS Experience Builder (web)
- **Versioning**: Each agency edits in their named SDE version (e.g., `SDE.Salmon Arm`)
- **Mandatory fields**: Agency, DiscrpAgID, Add_Number, St_Name, A3, Unit (if applicable)
- **Auto-filled fields**: Full_Addr, NGUID, AddCode, DateUpdate, Longitude, Latitude, QAStatus

---

## Steps

### 1. Gather User-Facing Information

Read these existing pages:
- `docs/schema-guide.html` — field definitions and entry conventions
- `docs/attribute-rules.html` — what gets auto-filled
- `docs/domains.html` — valid domain values
- `docs/quick-reference.html` — current reference cards

### 2. Generate the Quick Reference Page

Create or update `docs/quick-reference.html`:

#### Required Sections

**Section 1: Pipeline Stage Summary**
Visual pipeline using `.pipeline` classes with 5 steps showing data flow from editor version to production.

**Section 2: Version Naming Convention**
Table of SDE version names + their purpose:
| Version | Owner | Purpose |
|---------|-------|---------|
| sde.DEFAULT | System | Production / authoritative |
| SDE.QA | System | QA validation gate |
| SDE.CSRD | CSRD | CSRD editor |
| SDE.Salmon Arm | Salmon Arm | Salmon Arm editor |
| SDE.Sicamous | Sicamous | Sicamous editor |
| SDE.Golden | Golden | Golden editor |
| SDE.Revelstoke | Revelstoke | Revelstoke editor |

**Section 3: Key URLs & Endpoints**
Cards with GP service REST URLs, Portal URL, ArcGIS Server URL, Notebook Server URL.

**Section 4: SDE Connection Files**
Table of `.sde` connection file paths and their use.

**Section 5: Mandatory QA Fields**
Checklist of fields that must be populated before QA passes, using `.alert.info`.

**Section 6: Address Entry Cheat Sheet**
Side-by-side examples:
- Simple residential address
- Multi-unit address
- Highway address with pre-type
- Address with prefix/suffix modifiers

Use `.grid-2` with `.card` components for each example, showing input fields → resulting `Full_Addr`.

### 3. Write Data Entry Workflows

For each common task, create a step-by-step walkthrough:

**Workflow A: Adding a New Address Point**
1. Connect to your SDE version in ArcGIS Pro
2. Start an edit session
3. Place the point at the correct location
4. Fill mandatory fields (Agency, DiscrpAgID, Add_Number, St_Name, A3)
5. Fill optional fields as needed
6. Save — attribute rules auto-fill Full_Addr, NGUID, AddCode, etc.
7. Review QAStatus for any validation feedback
8. Fix any flagged issues

**Workflow B: Editing an Existing Address**
1. Select the feature
2. Modify fields as needed
3. Save — DateUpdate and QAStatus reset automatically
4. Verify Full_Addr regenerated correctly

**Workflow C: Retiring an Address**
1. Set the `Expire` field to the retirement date
2. Optionally add note in `Addressnotes`
3. Do NOT delete — maintain historical record

**Workflow D: Using Experience Builder (Web)**
1. Navigate to the web editing application
2. Log in with your agency credentials
3. Zoom to your jurisdiction
4. Use the Add/Edit tools
5. Same field requirements as ArcGIS Pro

### 4. HTML Conventions

Follow the same sub-page HTML patterns:
- `page-header` with breadcrumb for each page
- Sidebar with correct `active` class
- `.alert.info` for important tips
- `.alert.success` for auto-filled field reminders
- `.alert.warning` for cautions (e.g., no abbreviations in street types)
- `.grid-2` for before/after examples
- `.code-block` for any Arcade or Python snippets

### 5. Validate

- All mandatory fields listed match the constraint rule (`A.Mandatory`)
- Example addresses produce correct `Full_Addr` output
- Domain values in examples match `domains.html`
- Language is non-technical and accessible to GIS technicians
- No ArcPy or Arcade jargon in user-facing sections

---

## Output

- **`docs/quick-reference.html`** — Quick reference cards and cheat sheets
- Workflow content integrated into `docs/quick-reference.html` or as a separate `docs/user-workflows.html` if scope warrants
