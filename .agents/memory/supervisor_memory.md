# Supervisor Persistent Memory

## Changelog

### 2026-03-19 — Centralize Web App Configuration
**Milestone:** Configuration Centralization (Web App Pillar)
**Status:** Approved & Implemented
**Rationale:** ArcGIS Portal URLs, REST service endpoints, CMS table URL, and GP tool URLs were hardcoded across 5 JS modules (cms-core.js, editor-core.js, automations-dashboard.js, router.js, sync-app.js). Any portal URL change required editing every file manually — fragile and error-prone.
**Changes:**
- `config.js` — Expanded to single source of truth. Added `ARCGIS_REST` derived constant, `arcgisBase`, `arcgisRestBase`, `cmsTableUrl`, `gpTools.orchestrator`, and `services` block (`regionalBase`, `municipalEdit` map). All URLs now derive from `PORTAL_URL`.
- `cms-core.js` — Lazy tableUrl resolution via dynamic `import('./config.js')` (same pattern as ai-client.js).
- `editor-core.js` — Dynamic import for portalUrl (line 466).
- `automations-dashboard.js` — Already imported config; replaced hardcoded orchestrator URL with `config.gpTools.orchestrator`.
- `router.js` — Added config import; replaced 3-entry serviceMap with `config.services.municipalEdit`; replaced hardcoded download URL with `config.portalUrl` template.
- `sync-app.js` — Made init async; dynamic import; replaced 3 hardcoded URLs.
**Impact:** Changing `PORTAL_URL` in config.js now propagates to all service endpoints across the entire SPA. HTML documentation links (partials, guides) remain static by design.
**Verification:** Grep confirms only `config.js` and auto-generated `search-data.js` contain `apps.csrd.bc.ca` in JS files.

### 2026-03-19 — AI Assistant: Dynamic Memory, Navigation Tools, User Recognition
**Milestone:** AI Pillar Enhancement (3 Features)
**Status:** Approved & Implemented
**Rationale:** The AI assistant had no awareness of who was asking questions, no ability to guide users through the web app, and its ChromaDB knowledge base required manual re-ingestion and relied on stale file copies.

**Changes (9 files, 2 new):**

*Batch 1 — Backend (AI/):*
- `api.py` — Added `UserContext` Pydantic model (username, is_admin, municipality, current_page). Expanded `ChatRequest` with `user_context` field (backward-compatible defaults). `stream_agent_events()` now injects a `[CURRENT USER]` SystemMessage. Added `/api/reingest` POST endpoint for CI/CD-triggered knowledge base refresh.
- `agent.py` — Expanded SYSTEM_PROMPT with: user-awareness instructions, navigation command syntax (`{{nav:route#element|Label}}`), full web app route map (30+ routes), schema field element IDs. `trim_messages()` now preserves injected user-context SystemMessages. Registered 2 new tools: `query_cms_content`, `get_navigation_target`.
- `tools/cms_tools.py` (NEW) — Live CMS query tool hitting ArcGIS REST API with service token auth. Handles Base64 decoding of CMS content.
- `tools/navigation_tools.py` (NEW) — Topic-to-route lookup tool with 80+ mappings covering schema fields, attribute rules, pages, scripts, domains, and municipal guides. Returns `{{nav:...}}` syntax for the agent.
- `.env` — Added `CMS_TABLE_URL` and `ARCGIS_SERVICE_TOKEN` placeholders.

*Batch 2 — Frontend (Web App/):*
- `docs/ai-client.js` — Added `getUserContext()` (reads from localStorage, mirrors auth.js admin logic), `detectMunicipality()`, `processNavigationCommands()` (regex parser for `{{nav:...}}` → clickable buttons), `handleAINavigation()` (hash navigation + scroll-to + expand collapsed groups + highlight). User context sent with every chat request.
- `docs/partials/schema-guide.html` — Added `id="field-{FieldName}"` to all 61 `<tr>` elements across Groups 1-12 for scroll-to targeting.
- `docs/shared.css` — Added `.ai-nav-btn` (teal pill button) and `.ai-highlight` (3s yellow-pulse keyframe animation).

*Batch 3 — Dynamic Knowledge Base:*
- `database/ingest.py` — Changed source paths from stale `AI/data/` copies to read directly from repo root (`NG911System/`, `Context/`, `Web App/`).
- `deploy_to_iis.ps1` — After successful Robocopy, triggers `POST /api/reingest` to keep AI knowledge current on every deploy.

**Impact:** The AI now recognizes users by role (admin vs municipal editor + municipality), tailors responses accordingly, can navigate users to specific pages/fields via clickable buttons, queries live CMS content, and automatically refreshes its knowledge base on deploy.
**Dependencies:** `CMS_TABLE_URL` and `ARCGIS_SERVICE_TOKEN` must be set in `AI/.env` for the live CMS query tool to work.

### 2026-03-20 — AI Knowledge Base: 10 Documentation Guides + Documentation-First Retrieval
**Milestone:** Knowledge Gap Closure (AI Pillar)
**Status:** Approved & Implemented
**Rationale:** AI was reading Python/JS source code and fabricating user-facing parameters (e.g., "Municipality" and "Output_GDB" for the Export tool instead of the real `sde_conn`, `target_fc`, `name_prefix`, `agency`). Root cause: no plain-language documentation existed for the AI to reference.
**Changes:**
- Created 10 MD files in `Context/Documentation/`: GP_Tools_Complete_Guide, Web_App_Pages_Guide, Sync_App_User_Guide, CMS_Admin_Guide, Authentication_RBAC_Guide, Nightly_Pipeline_Operations, Attribute_Rules_Reference, Domains_Reference, Municipal_Operations_Handbook, System_Troubleshooting_Guide.
- Updated `System_Dependencies.md` with URL Quick Reference (Documentation Hub vs Portal distinction).
- Updated `agent.py`: Rule 19 instructs AI to read documentation guides FIRST before source code. Dynamic file map now scans `Context/Documentation/*.md`.
- Re-ingested ChromaDB: 942 → 988 chunks.
**Impact:** AI now gives correct GP tool parameters, distinguishes web app from Portal, and can explain any system component from plain-language docs instead of interpreting raw code.

### 2026-03-20 — AI: Inline Navigation, Page State Awareness, Screenshot Vision, Thinking Toggle
**Milestone:** AI Contextual Intelligence (4 Features)
**Status:** Approved & Implemented
**Rationale:** AI was outputting "Navigate to #script-export" as plain text instead of clickable buttons. It couldn't see the user's form state (said "keep defaults" when fields were empty). No screenshot support despite Qwen 3.5 35B having native vision. No way to toggle thinking mode.
**Changes (5 files):**
- `agent.py` — NAVIGATION section rewritten to instruct agent to use `{{nav:route|Label}}` syntax inline in steps. Added Rules 21 (page state awareness) and 22 (screenshot analysis).
- `api.py` — Added `PageState` model (form_fields, gp_status, errors). Expanded `UserContext` with page_state. Added `screenshot` (base64 PNG) and `thinking` (bool) to `ChatRequest`. Multimodal HumanMessage construction for vision. `/no_think` prefix when thinking disabled.
- `ai-client.js` — `capturePageState()` reads GP Runner form values. Screenshot button (html2canvas capture) + Ctrl+V paste. Thinking toggle (brain icon). `<think>` blocks rendered as collapsible "View reasoning" disclosures.
- `shared.css` — Styles for input action buttons, thinking toggle, screenshot active state, thinking block/stream display.
- `index.html` — Added html2canvas CDN, screenshot button, thinking toggle button.
**Model:** Qwen 3.5 35B via Ollama (MoE: 35B total / 3B active, ~24GB VRAM, native vision + thinking).
**Impact:** AI can now (1) render clickable navigation buttons inline in answers, (2) see actual form field values and report empty fields, (3) analyze screenshots of the user's screen, (4) toggle between fast mode and deep reasoning mode.

### 2026-03-23 — Nightly Pipeline: 6-Stage Upgrade, QA Version Fix, Version Hygiene
**Milestone:** Pipeline Architecture Overhaul (Automation Pillar)
**Status:** Approved & Deployed
**Rationale:** Client (David) requested geodatabase compression and version delete/recreate to improve base table freshness for SQL Server queries and ensure clean editor version state. Additionally, duplicate NGUIDs in Revelstoke were blocking QA, and QAStatus updates took 2 pipeline cycles due to the QA tool targeting the wrong version.

**Changes (10+ files):**

*Pipeline Code:*
- `ReconcilePostGPtool.py` — Added `COMPRESS` stage (runs `arcpy.management.Compress`) and `DELETE_RECREATE_VERSIONS` stage (deletes and recreates municipal editor versions as children of `SDE.QA` with `PUBLIC` access). Updated `_validate_choice` allowed set.
- `1.NG911-Reconcile Municipal-QA- Reconcile Default.py` — Restructured from 5-stage to 6-stage pipeline: MUNI_TO_QA, RUN_QA, QA_TO_DEFAULT, COMPRESS (non-blocking), DELETE_RECREATE_VERSIONS, EXPORT_DEFAULT. Removed `DEFAULT_TO_MUNI_SYNC` stage. Added `QA_SDE_CONN` (`sde@regional_qa.sde`) so QA validation targets the QA version instead of DEFAULT. Removed `arcpy` dependency from CMS dashboard update block.

*Web App:*
- `config.js` — Orchestrator URL updated to Notebook Server GP service endpoint.
- `partials/script-orchestrator.html` — Purpose, stage table, error handling updated to 6 stages.
- `partials/script-reconcile.html` — GP tool stages, source code, parameters, breakdown updated (5 stage modes).
- `partials/automation-scripts.html` — Pipeline visual updated from 5 to 6 stages.
- `partials/maintenance.html` — Stage breakdown table, badge text, version permissions (PUBLIC).
- `system-resources.html` — Orchestrator description updated.

*Notifications:*
- `PowerautomateEmail-Reconcile-QA-Reconcile-Export.html` — 6-stage HTML template. COMPRESS shows amber "WARNING" on failure instead of red "FAILED".

**Key Design Decisions:**
- Compress is non-blocking (won't halt pipeline for lock failures).
- Delete/Recreate placed AFTER Compress so recreated versions inherit the compressed base table.
- QA validates `SDE.QA` version (via `sde@regional_qa.sde`) so fixes resolve in 1 cycle.
- `DEFAULT_TO_MUNI_SYNC` removed since Delete/Recreate achieves the same goal more cleanly.

**Impact:** QAStatus updates now resolve in a single pipeline cycle. Base table always reflects latest data for SQL queries. Municipal editor versions start each day clean. Nightly email shows 6-stage results.
