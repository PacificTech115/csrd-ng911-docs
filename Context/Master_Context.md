# CSRD NG911 Project: Master Context & Architecture Document

## Purpose
This document serves as the master technical blueprint and context reference for the **CSRD NG911 System**, developed by **Pacific Tech Systems** for the **Columbia Shuswap Regional District (CSRD)** and its participating municipalities (Revelstoke, Sicamous, Salmon Arm, and Golden). 

It is specifically designed for future AI agents and developers to understand, maintain, and redeploy the system. The project aggregates and automates municipal addressing data to comply with Canada's NG911 System.

The project is structured into three main pillars:
1. The NG911 Central Addressing System (ArcGIS Enterprise)
2. The Web Application (Documentation & Maintenance Hub)
3. The Local AI Assistant

---

## Part 1: The NG911 Central Addressing System
**Deployment:** CSRD ArcGIS Enterprise Portal (`apps.csrd.bc.ca/hub`)

This is the core GIS infrastructure for managing, validating, and exporting NG911 data.

### Architecture & Components
*   **Database Schema & Domains**: Built on a strict 61-field NENA SSAP SiteAddress feature class schema, complete with configured domains for standardized data entry.
*   **Versioning Hierarchy**: Utilizes traditional ArcGIS Enterprise Versioning.
    *   `sde.DEFAULT` (authoritative) &larr; `SDE.QA` (staging gate) &larr; Municipal Editors (`SDE.Revelstoke`, `SDE.Sicamous`, etc.)
*   **Attribute Rules (Arcade)**: Located in `Database Scripts/0.Attribute Rules/`. These rules automatically calculate `NGUID`, full string concatenation, Latitude/Longitude extraction, constraint blocks (mandatory checks), and DateUpdate triggers upon data entry.
*   **Automations & ETL (Nightly Pipeline)**: 
    *   A robust **5-stage sequential pipeline** implemented as ArcGIS Notebooks and ArcPy scripts (`Database Scripts/1.ReconcilePost-QA-Export/`).
    *   Stages: `MUNI -> QA` (Reconcile/Post) &rarr; `Run QA` (Geoprocessing validation) &rarr; `QA -> DEFAULT` &rarr; `Export FGDB` (Snapshot to network share) &rarr; `DEFAULT -> MUNI` (Push generated IDs/statuses back).
    *   **External Syncing**: Custom synchronization script (`Database Scripts/2. Salmon Arm Sync/`) utilizing a cascading matching strategy (NGUID &rarr; GlobalID &rarr; Featureid) combined with reverse ID syncing (Salmon Arm ETL).
*   **Power Automate Notifications**: Post-script execution HTML email reporting. JSON payloads are sent via HTTP requests to Power Automate flows, alerting stakeholders of pipeline successes, failures, or blockages.

---

## Part 2: The Web Application
**Deployment:** CSRD Web Apps Server (`apps.csrd.bc.ca/ng911`)

The web app complements the NG911 System, providing users with unified access to system documentation, end-user guides, and tools to maintain the system with ease.

### Architecture & Components
*   **Single Page Application (SPA)**: Built using vanilla HTML/CSS/JS (`Web App/docs/` routing logic via `router.js`).
*   **Integrated Web Applications**:
    *   **Municipal Data Sync App (`sync-app.js`)**: A modern interface allowing municipal users to securely sync their local data extracts to the CSRD target layers through an arcade-matching engine and visual map diffing.
    *   **Automations Dashboard (`automations-dashboard.js`)**: Real-time monitoring of nightly and ETL pipeline runs via dynamic caching, featuring direct trigger buttons for administrators.
    *   **GP Tools Runner (`gp-runner.js`)**: An embedded UI to securely execute complex ArcGIS Geoprocessing services (like QA Validation or Reconcile/Post) directly from the browser without opening ArcGIS Pro.
    *   **AI Assistant Client (`ai-client.js`)**: The floating frontend chat widget embedded globally across the SPA.
*   **ArcGIS Hosted Table CMS (`NG911_Docs_CMS`)**: Serves as the database for the dynamic CMS (`cms-core.js` & `editor-core.js`). This allows admins to edit text, links, and schema tables directly from the UI without modifying source code. Employs Base64 encoding to cleanly bypass restrictive ArcGIS XSS filters.
*   **Deployment CI/CD Pipeline**: 
    *   Because the CSRD IIS server is firewalled and cannot receive standard GitHub webhooks, a scheduled Windows Task runs `deploy_to_iis.ps1`.
    *   The script pulls the latest `main` branch from GitHub, copies files to the IIS web directory (e.g., `C:\inetpub\wwwroot\NG911`), manages permissions, and restarts the required application pools.

---

## Part 3: The Local AI Assistant
**Deployment:** Frontend integrated into the Web App (`apps.csrd.bc.ca/ng911`); Backend hosted locally on personal computer (`PTS-01`).

This is the built-in AI Assistant tailored specifically for the NG911 System and the Web App, acting as an expert on the schemas, attribute rules, and documentation.

### Architecture & Components
*   **Local RAG Backend (FastAPI & LangGraph)**:
    *   Runs in `AI/`.
    *   **LLM Model**: Powered by **Qwen 2.5 32B** running locally via Ollama on PTS-01.
    *   **Vector Database**: ChromaDB with `nomic-embed-text` embeddings.
    *   **Agent Design**: Implemented in LangGraph as a single ReAct agent (`agent.py`) equipped with tools for local codebase search, file reading, and knowledge base search.
    *   **Streaming API**: `api.py` (FastAPI) provides an SSE (Server-Sent Events) endpoint (`/api/chat`) to stream token-by-token responses and tool execution statuses directly to the web frontend.
*   **Networking & Accessibility**:
    *   The API is exposed securely via a permanent Cloudflare Tunnel (`https://ai.pacifictechsystems.ca`).
    *   ArcGIS Portal authentication has been removed from the frontend widget to allow unauthenticated public access.
    *   The backend runs persistently as a Windows Service managed by `nssm.exe`.

---

## Workspace & Repository Mapping
*   **Root Folder**: `c:\Users\solim\Arcgis Notebooks`
*   **Version Control**: Monorepo structured with `.git` and `.github` folders.
*   **Component Locations**:
    *   `Web App/` - Documentation Hub SPA code & CI/CD deployment script.
    *   `AI/` - Local AI Assistant backend code.
    *   `Database Scripts/` - Attribute rules, ETLs, Nightly Orchestrator, Power Automate templates.
    *   `Documentation/` - Database schemas, dependencies mapping, and pre-packaged municipal user portals.
