---
description: Generate or update documentation for Arcade attribute rules on the NG911_SiteAddress feature class
---

# Attribute Rules Documentation Agent

This workflow generates or updates the **Attribute Rules** documentation pages for the CSRD NG911 system — both the summary page (`docs/attribute-rules.html`) and individual rule detail pages (`docs/rule-*.html`).

---

## Context

- **Feature class**: `SDE.NG911_SiteAddress`
- **Rule count**: 9 rules (8 calculation + 1 constraint)
- **Source files**: `Database Automation/0.Attribute Rules/`

### Rule Inventory

| # | File | Target Field | Type |
|---|------|-------------|------|
| 1 | `1.Full Address` | `Full_Addr` | Calculation |
| 2 | `2.NGUID` | `NGUID` | Calculation |
| 3 | `3.Longitude` | `Longitude` | Calculation |
| 4 | `4.Latitude` | `Latitude` | Calculation |
| 5 | `5.Addcode` | `AddCode` | Calculation |
| 6 | `6.DateUpdate` | `DateUpdate` | Calculation |
| 7 | `7.QAStatus` | `QAStatus` | Calculation |
| 8 | `8.defaultagency-inactive` | `Agency` defaults | Calculation |
| A | `A.Mandatory (constraint rule)` | Multiple | Constraint |

---

## Steps

### 1. Read Arcade Source Files

For each rule in `Database Automation/0.Attribute Rules/`:
- Parse the Arcade expression
- Identify the trigger events: Insert, Update, Delete (or combination)
- Identify the target field(s)
- Identify all input fields / dependencies
- Note any lookup table references (e.g., AddCode uses a FeatureSet lookup)

### 2. Generate the Summary Page

Create or update `docs/attribute-rules.html`:

#### Required Sections
1. **Overview** — Brief explanation of attribute rules in ArcGIS Enterprise (server-side Arcade)
2. **Rule Summary Table** — All 9 rules in a table with: #, Name, Type (Calculation/Constraint), Target Field, Trigger, link to detail page
3. **Execution Order** — Numbered pipeline diagram showing rule execution sequence using `.pipeline` classes
4. **Dependency Graph** — Which rules depend on which input fields, shown as cards

#### HTML Pattern
```html
<!-- Use the standard sub-page layout: -->
<!-- page-header with breadcrumb: Home > Technical Documentation > Attribute Rules -->
<!-- Sidebar nav: same as Documentation.html, active on attribute-rules.html -->
<!-- Content sections with .reveal animations -->
```

Each rule entry should link to its detail page:
```html
<a class="link-card reveal" href="docs/rule-{name}.html">
  <div class="card">
    <div class="card-header">
      <div class="card-icon lg teal"><i class="fas fa-wand-magic-sparkles"></i></div>
      <div><h4>Rule Name</h4><div class="card-sub">Target: FieldName</div></div>
      <i class="fas fa-arrow-right card-arrow"></i>
    </div>
    <p>Brief description of what the rule does</p>
  </div>
</a>
```

### 3. Generate Per-Rule Detail Pages

For each rule, create or update `docs/rule-{name}.html`:

#### Required Sections
1. **Header Banner** — Rule name, type badge, target field badge, trigger badge  
   Use `.detail-banner` with `.banner-tag` elements
2. **What It Does** — Plain-English explanation
3. **When It Fires** — Trigger events (Insert/Update/Delete) with explanations
4. **Input Fields** — Table of fields the rule reads from
5. **Output** — Target field with expected format/example  
6. **Arcade Code** — Full source in a `.code-block` with syntax highlighting:
   - `.kw` for keywords (`var`, `if`, `else`, `return`, `function`)
   - `.fn` for function names (`Concatenate`, `Geometry`, `FeatureSetByName`)
   - `.str` for string literals
   - `.cm` for comments
   - `.num` for numbers
   - `.op` for operators
7. **Code Breakdown** — Step-by-step walkthrough using `.breakdown-card` components, each with a "View Code" toggle that reveals the relevant Arcade snippet
8. **Maintenance Notes** — How to modify the rule, common gotchas, testing instructions

#### Code Breakdown Template
```html
<div class="breakdown-card reveal">
  <h4><span class="step-num">1</span> Step Title</h4>
  <div class="breakdown-meta">
    <span class="meta-tag">Lines 1-5</span>
    <span class="meta-tag">Input: FieldName</span>
  </div>
  <p>Explanation of what this code section does.</p>
  <div class="breakdown-detail">
    <strong>Key Logic</strong>
    <ul>
      <li>Detail about the logic</li>
    </ul>
  </div>
</div>
```

### 4. Syntax-Highlight the Arcade Code

When placing Arcade code in `.code-block pre`, wrap tokens in highlight spans:
```html
<span class="kw">var</span> <span class="var">streetName</span> = <span class="fn">Trim</span>($feature.<span class="var">St_Name</span>);
<span class="cm">// Build the full address string</span>
<span class="kw">if</span> (<span class="fn">IsEmpty</span>(<span class="var">streetName</span>)) {
  <span class="kw">return</span> <span class="str">""</span>;
}
```

### 5. Validate

- Each rule detail page loads correctly and links back to `attribute-rules.html`
- All 9 rules appear in the summary table
- Code blocks are readable and syntax-highlighted
- Arcade source matches the files in `Database Automation/0.Attribute Rules/`
- Responsive layout works (grid collapses to single column at 900px)

---

## Output

- **`docs/attribute-rules.html`** — Summary page with rule table and links
- **`docs/rule-full-address.html`** — Full Address rule detail
- **`docs/rule-nguid.html`** — NGUID rule detail
- **`docs/rule-longitude.html`** — Longitude rule detail
- **`docs/rule-latitude.html`** — Latitude rule detail
- **`docs/rule-addcode.html`** — AddCode rule detail
- **`docs/rule-dateupdate.html`** — DateUpdate rule detail
- **`docs/rule-qastatus.html`** — QAStatus rule detail
- **`docs/rule-defaultagency.html`** — Default Agency rule detail
- **`docs/rule-mandatory.html`** — Mandatory constraint rule detail
