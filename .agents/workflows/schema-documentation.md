---
description: Generate or update the Schema Guide documentation page for the CSRD NG911 SiteAddress feature class
---

# Schema Documentation Agent

This workflow generates or updates the **Schema Guide** (`docs/schema-guide.html`) for the `SDE.NG911_SiteAddress` feature class in the CSRD NG911 Central Database System.

---

## Context

- **Feature class**: `SDE.NG911\SDE.NG911_SiteAddress` — point feature, NAD 1983 UTM Zone 11N (WKID 26911)
- **Standard**: NENA i3 Standard for NG9-1-1 GIS Data Model
- **Agencies**: CSRD, Revelstoke, Salmon Arm, Golden, Sicamous, Adams Lake, Skw'lax, Neskonlith, RDNO, Splatsin
- **Key fields (61 total)**: grouped into 12 logical groups (Quick Entry, Civic Number Components, Street Components, Jurisdiction & Communities, Postal/MSAG/ESN, Legacy Street, Unit/Interior, Place/Landmark/Placement, Effective Dates, References & Notes, Auto-Filled/Attribute Rules, System Fields)
- **Auto-filled fields**: `Full_Addr`, `NGUID`, `AddCode`, `DateUpdate`, `Longitude`, `Latitude`, `QAStatus`

---

## Steps

### 1. Gather Schema Information

Read the existing schema definition sources:
- Open `docs/schema-guide.html` to see the current field reference
- Check attribute rule files in `Database Automation/0.Attribute Rules/` for auto-filled field behavior
- Review `docs/domains.html` for domain assignments (Agency, DiscrpAgID, Locality)

### 2. Identify Field Changes

Compare the current `schema-guide.html` with the actual geodatabase schema:
- Verify field names, data types, lengths, and nullability
- Check if any new fields have been added or removed
- Confirm domain assignments are still current
- Verify the auto-filled field list matches current attribute rules

### 3. Generate the HTML Page

Produce `docs/schema-guide.html` following these conventions:

#### HTML Structure
```
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Use shared fonts: Inter, Poppins, Fira Code -->
  <!-- Use shared CSS: shared.css -->
  <!-- Page-specific styles for .field-group-header, .field-group-body -->
</head>
<body>
  <!-- Progress bar: <div id="progress"></div> -->
  <!-- Mobile toggle button -->
  <!-- Sidebar: copy exact nav from Documentation.html, set schema-guide.html as active -->
  <!-- Page header: breadcrumb → Home > Technical Documentation > Schema Guide -->
  <!-- Content sections:
       1. Scope
       2. Quick Start for Editors (mandatory fields alert + auto-filled fields alert)
       3. Multi-Agency Conventions (Agency → DiscrpAgID table)
       4. Field Reference (12 collapsible groups, each with <table>)
       5. Common Examples (Single-family, Multi-unit)
  -->
  <!-- Footer: CSRD NG911 © 2025 · Pacific Tech Systems -->
  <!-- Scripts: collapsible groups, scroll reveal, progress bar, back-to-top, copy code -->
</body>
```

#### CSS Classes to Use
| Element | Classes |
|---------|---------|
| Page header | `.page-header`, `.page-header-content`, `.breadcrumb` |
| Field groups | `.field-group-header` + `.field-group-body` |
| Info boxes | `.alert.info`, `.alert.success`, `.alert.warning` |
| Tables | Standard `<table>` with `<thead>`, `<tbody>` |
| Cards | `.card`, `.card-header`, `.card-icon.{color}` |
| Grids | `.grid-2`, `.grid-3` |
| Animations | `.reveal`, `.reveal-delay-1`, `.reveal-delay-2` |

#### Field Group Template
```html
<div class="reveal">
  <div class="field-group-header" data-group="N">
    <div class="group-icon" style="background:var(--teal)"><i class="fas fa-icon"></i></div>
    <h3>Group Name</h3>
    <span class="field-count">N fields</span>
    <i class="fas fa-chevron-down toggle-icon"></i>
  </div>
  <div class="field-group-body">
    <table>
      <thead><tr><th>Field Name</th><th>Type</th><th>Purpose</th><th>Example</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td><code>FieldName</code></td><td>Text(255)</td><td>Description</td><td>Example value</td><td>Notes</td></tr>
      </tbody>
    </table>
  </div>
</div>
```

### 4. Validate Consistency

- Ensure all 61 fields are documented
- Confirm field counts in each group header match the actual table rows
- Verify sidebar nav matches `Documentation.html` exactly (except `active` class on schema-guide)
- Test collapsible group JavaScript works
- Check responsive layout at 900px breakpoint

### 5. Cross-Link to Related Pages

Ensure the following internal links exist:
- Auto-filled fields → link to `attribute-rules.html` with specific rule anchors
- Domain fields → link to `domains.html`
- Agency/DiscrpAgID mapping → link to `domains.html#agency-domain`

---

## Output

- **File**: `docs/schema-guide.html`
- **Format**: Complete standalone HTML page using `shared.css`
- **Key sections**: Scope, Quick Start, Multi-Agency, Field Reference (12 groups), Examples
