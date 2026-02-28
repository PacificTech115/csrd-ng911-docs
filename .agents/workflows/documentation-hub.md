---
description: Assemble, audit, and update the central Documentation.html hub page and navigation
---

# Documentation Hub Agent

This workflow maintains the central **Documentation.html** hub page — the entry point for all CSRD NG911 technical documentation. It audits the existing sub-pages, updates navigation, refreshes stats, and ensures consistency.

---

## Context

- **Hub file**: `Documentation.html` (project root)
- **Sub-pages directory**: `docs/`
- **Shared CSS**: `docs/shared.css`
- **Logo**: `NG911logocsrd.png`
- **Author**: John Soliman · Pacific Tech Systems

### Current Navigation Structure

```
1. Technical Documentation
   ├── Database
   │   ├── Schema Guide (docs/schema-guide.html)
   │   ├── Attribute Rules (docs/attribute-rules.html)
   │   └── Domains (docs/domains.html)
   └── Automations
       ├── ArcGIS Notebooks (docs/automation-scripts.html)
       ├── GP Tools (docs/gp-tools.html)
       └── Power Automate (docs/power-automate.html)
2. Maintenance Guide
   └── Maintenance (docs/maintenance.html)
3. Quick Reference
   └── Quick Reference (docs/quick-reference.html)
```

---

## Steps

### 1. Audit Existing Sub-Pages

Scan the `docs/` directory and compare against the sidebar navigation:
- List all `.html` files (excluding `shared.css`)
- Check which ones are linked in the sidebar nav
- Identify any new pages not yet added to navigation
- Identify any nav links pointing to non-existent pages

### 2. Update the Sidebar Navigation

If new pages were added, update the sidebar `<nav class="sidebar-nav">` section:

```html
<nav class="sidebar-nav">
  <a href="#hero"><i class="fas fa-home"></i> Home</a>
  <a href="#architecture"><i class="fas fa-sitemap"></i> Architecture</a>
  <div class="nav-group-label">1. Technical Documentation</div>
  <div class="nav-sub-label">Database</div>
  <a href="docs/schema-guide.html" class="nav-indent"><i class="fas fa-table-columns"></i> Schema Guide</a>
  <!-- ... more links ... -->
</nav>
```

Use these Font Awesome icons for consistency:
| Page | Icon |
|------|------|
| Home | `fa-home` |
| Architecture | `fa-sitemap` |
| Schema Guide | `fa-table-columns` |
| Attribute Rules | `fa-wand-magic-sparkles` |
| Domains | `fa-list-check` |
| ArcGIS Notebooks | `fa-robot` |
| GP Tools | `fa-gears` |
| Power Automate | `fa-envelope` |
| Maintenance | `fa-wrench` |
| Quick Reference | `fa-bolt` |

### 3. Update Hero Section Stats

Recalculate and update the hero stats counter values:

```html
<div class="hero-stats">
  <div class="hero-stat"><span class="stat-num" data-count="N">0</span><span class="stat-label">Attribute Rules</span></div>
  <div class="hero-stat"><span class="stat-num" data-count="N">0</span><span class="stat-label">Automation Scripts</span></div>
  <div class="hero-stat"><span class="stat-num" data-count="N">0</span><span class="stat-label">Municipalities</span></div>
  <div class="hero-stat"><span class="stat-num" data-count="N">0</span><span class="stat-label">Pipeline Stages</span></div>
</div>
```

Count from source:
- **Attribute Rules**: Count files in `Database Automation/0.Attribute Rules/` (currently 9)
- **Automation Scripts**: Count notebook scripts (currently 5)
- **Municipalities**: Count unique agencies/versions (currently 5 municipal + CSRD)
- **Pipeline Stages**: Count stages in nightly pipeline (currently 5)

### 4. Update the Architecture Section

Verify the versioning hierarchy diagram matches current SDE versions:
- Check if any new municipal versions have been created
- Update the `.muni-row` div with current editor versions
- Confirm the technology stack cards are up to date

### 5. Update Quick Navigation Cards

For each sub-page, ensure the link card contains:
- Correct `href`
- Updated subtitle/description count (e.g., "50+ fields in 12 groups")
- Accurate one-line summary

```html
<a class="link-card reveal" href="docs/schema-guide.html">
  <div class="card">
    <div class="card-header">
      <div class="card-icon lg teal"><i class="fas fa-table-columns"></i></div>
      <div><h4>Schema Guide</h4><div class="card-sub">61 fields in 12 groups</div></div>
      <i class="fas fa-arrow-right card-arrow"></i>
    </div>
    <p>Field reference, data entry guide, multi-agency conventions</p>
  </div>
</a>
```

### 6. Update Footer

- Set copyright year to current year
- Confirm author and organization
- Update "Last updated" date to current month/year

### 7. Ensure Consistent Branding

Across all pages:
- Logo file: `NG911logocsrd.png` (root-relative: `../NG911logocsrd.png` from docs/)
- Color scheme: Navy/Teal gradient (defined in `shared.css`)
- Fonts: Inter (body), Poppins (headings), Fira Code (code)
- Copyright: `CSRD NG911 © {year} · Pacific Tech Systems`

### 8. Validate

- All sidebar links resolve to existing files
- Hero stat numbers match actual counts
- Architecture diagram matches real version hierarchy
- All link-cards point to valid pages
- Footer date is current
- JavaScript (particle canvas, stat counters, scroll reveal, scroll spy) functions correctly
- Mobile responsive layout works at 900px breakpoint

---

## Output

- **`Documentation.html`** — Updated hub page with current navigation, stats, and links

> **Important**: When updating `Documentation.html`, you must also update the sidebar `<nav>` in **every sub-page** under `docs/` to match. All pages share the same navigation structure (they just differ in which link has the `active` class).
