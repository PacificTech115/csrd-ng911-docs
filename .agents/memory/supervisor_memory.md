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

