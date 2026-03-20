# Web App Pages Guide

The NG911 Documentation Hub is a Single Page Application (SPA) at `apps.csrd.bc.ca/ng911`. It uses hash-based routing to load HTML partials into the main content area. Pages are role-gated based on the logged-in user.

## All Pages

| Route | Page Name | Access | Description |
|-------|-----------|--------|-------------|
| `#` (home) | Home | All users | Dashboard with hero section, quick actions, navigation grid |
| `#architecture` | Architecture | All users | System architecture overview diagram and explanation |
| `#schema-guide` | Schema Guide | All users | Full 61-field database schema with collapsible field groups |
| `#attribute-rules` | Attribute Rules | All users | Overview of all 10 attribute rules with links to detail pages |
| `#rule-full-address` | Full Address Rule | All users | Arcade expression that builds Full_Addr from components |
| `#rule-nguid` | NGUID Rule | All users | NENA Globally Unique ID generation rule |
| `#rule-longitude` | Longitude Rule | All users | UTM to WGS84 longitude conversion |
| `#rule-latitude` | Latitude Rule | All users | UTM to WGS84 latitude conversion |
| `#rule-addcode` | AddCode Rule | All users | Municipality name to numeric code mapping |
| `#rule-dateupdate` | DateUpdate Rule | All users | Automatic last-modified timestamp |
| `#rule-qastatus` | QAStatus Rule | All users | QA workflow status tracking |
| `#rule-defaultagency` | Default Agency Rule | All users | Auto-populates agency by username (currently inactive) |
| `#rule-mandatory` | Mandatory Fields | All users | Constraint rule enforcing required fields |
| `#domains` | Domains | All users | Coded value domains and valid lookup values |
| `#automation-scripts` | Automation Scripts | Admin only | ArcGIS Notebooks documentation |
| `#automations-dashboard` | Automations Dashboard | Admin only | Live pipeline execution status and latest run results |
| `#gp-tools` | GP Tools | Admin only | Overview and links to all GP tool pages |
| `#power-automate` | Power Automate | Admin only | Webhook workflow documentation |
| `#script-orchestrator` | Orchestrator Script | Admin only | Nightly pipeline orchestrator docs + runner |
| `#script-etl` | ETL Script | Admin only | Salmon Arm ETL script documentation |
| `#script-qa` | QA Script | Admin only | QA validation docs + live execution UI |
| `#script-reconcile` | Reconcile Script | Admin only | Reconcile/Post docs + live execution UI |
| `#script-export` | Export Script | Admin only | Export SSAP docs + live execution UI |
| `#maintenance` | Maintenance | Admin only | System maintenance procedures guide |
| `#system-resources` | System Resources | Admin only | Direct links to Portal items and file downloads |
| `#version-edits` | Version Edits | Admin only | Version history and edit tracking |
| `#quick-reference` | Quick Reference | Admin only | Pipeline stages, version names, file paths, rules summary |
| `#revelstoke` | Revelstoke Guide | Revelstoke users + Admins | Municipal user guide with credentials and workflows |
| `#golden` | Golden Guide | Golden users + Admins | Municipal user guide with credentials and workflows |
| `#salmonarm` | Salmon Arm Guide | Salmon Arm users + Admins | Municipal user guide with credentials and workflows |
| `#sicamous` | Sicamous Guide | Sicamous users + Admins | Municipal user guide with credentials and workflows |
| `#sync-app` | Sync App | Municipal users + Admins | Data synchronization tool with map and diff engine |

## Access Rules

**All authenticated users** see: Home, Architecture, Schema Guide, Attribute Rules (all rule pages), Domains.

**Admin users** see everything above plus: all automation pages, GP tools, maintenance, system resources, version edits, quick reference, and all four municipal guides.

**Municipal users** (e.g., `revelstoke_editing`) see: all public pages, their own municipal guide, and the Sync App.

## Page Features

**Home page**: Hero banner with search, quick action buttons (download .pitemx files for each municipality), and navigation card grid linking to major sections. Quick actions are filtered by role.

**Schema Guide**: Interactive collapsible field groups showing all 61 fields with name, type, length, domain, nullable, and description. Each field row has an `id` attribute for direct linking.

**Script pages** (`#script-qa`, `#script-reconcile`, `#script-export`): Documentation text at top, followed by a live GP Runner execution UI (admin only) that lets you submit and monitor GP jobs directly from the browser.

**Municipal guides**: Branded hero, PDF download, .pitemx quick actions, pipeline timeline visualization, workflow video embed, system access credentials table, step-by-step addressing workflow.

**Automations Dashboard**: Real-time display of latest nightly pipeline run (stage-by-stage breakdown) and Salmon Arm ETL status. Fetches data from CMS hosted table.
