# CSRD NG911 Project: File Index

This document maps all critical files in the `Context`, `NG911System`, `Web App`, and `AI` directories. It is designed to give AI agents and developers an exact dictionary of where logic, UI components, and automation scripts reside.

---

## 📁 1. Context `\Context\`
Reference data, master guides, and static deployment packages.

*   `Master_Context.md`: The overarching strategic and architectural blueprint detailing the 3 core pillars of the project.
*   `# Notebooks.txt`: REST API references and endpoint URLs for ArcGIS Notebook administration.
*   `Live_Results_Output.json`: Example generated payload representing an automated pipeline completion.
*   `csrd-docs-deployment.zip` / `csrd-ng911-deployment.zip`: Zipped deployment packages meant for manual distribution.
*   `Documentation\` (Directory):
    *   `Database_Schema_Summary.md`: Breakdown of the 61-field NENA SSAP SiteAddress feature class.
    *   `Golden_User_Portal.zip`, `Revelstoke_User_Portal.zip`, etc.: Pre-packaged UI deployments tailored to individual municipalities.

---

## 📁 2. NG911 Central System `\NG911System\`
Addressing system dependencies, validation rules, and ETL architectures deployed to the ArcGIS Enterprise Portal.

*   `test_cms_insert.py`: Python CLI utility script for injecting Base64-encoded strings directly into the ArcGIS Hosted Table CMS.
*   `Database Scripts\` (Directory):
    *   `0.Attribute Rules\`: `.txt` files containing Arcade Expressions executed within the ArcGIS Server (e.g., `2.NGUID.txt`, `QAStatus.txt`, `Full Address.txt`).
    *   `1.ReconcilePost-QA-Export\`: 
        *   `.py` files for the Nightly Orchestrator pipeline, GP tool definitions (`QASSAPGPtool.py`, `ExportGPtool.py`).
        *   `PowerautomateEmail-Reconcile-QA-Reconcile-Export.html`: Template for Power Automate POST webhooks.
    *   `2. Salmon Arm Sync\`: 
        *   `2.NG911-SalmonArmETL.py`: Custom cascading ID match and reverse sync script.
        *   `PowerautomateEmail-SalmonArmsync.html`: Webhook template for ETL completion.
*   `Testing Phase\` (Directory):
    *   `Automation Scripts\`: Diagnostics and heartbeat testing for live QA servers (`NG911_Diagnostics.pyt`, `heartbeat_orchestrator.py`).
    *   `index.html` / `app.js`: Sandbox UI for testing automation endpoints loosely.

---

## 📁 3. Web Application `\Web App\`
The Documentation Hub SPA and embedded municipal apps.

*   `deploy_to_iis.ps1`: Automated pull-based CI/CD PowerShell script scheduled on the CSRD IIS server (Mirrors the `Web App` directory).
*   `index.html` & `Documentation.html`: The HTML shell targets for the main SPA.
*   `docs\` (Directory):
    *   `config.js`: Central environment variables, ArcGIS App IDs, and Tool layer endpoint URLs.
    *   `router.js`: Custom client-side routing mapping URLs to HTML partials via ArcGIS Auth checks.
    *   `cms-core.js` & `editor-core.js`: ArcGIS Hosted Table logic (fetching, inline DOM editing, Base64 conversion).
    *   `sync-app.js`: Implementation of the **Municipal Data Sync App** (Arcade-based ID mapping and visual Map diffs).
    *   `automations-dashboard.js`: The real-time run monitoring system reading from the CMS cache array.
    *   `gp-runner.js`: The embedded execution layer for triggering AGS Geoprocessing Tools natively in the browser.
    *   `ai-client.js`: The floating chat UI widget for the LLM.
    *   `partials\`: Snippets of HTML injected dynamically by the router.

---

## 📁 4. Local AI Assistant `\AI\`
The FastAPI and LangGraph RAG backend running locally.

*   `api.py`: FastAPI server exposing `/api/chat` as a Server Sent Events (streaming endpoint).
*   `agent.py`: LangGraph ReAct agent defining model instructions, checkpointing, and tool layouts.
*   `tools\` (Directory): Python classes implementing localized codebase reading and vector search capabilities.
*   `core\`, `data\`, `ui\`: Internal Python logic for embeddings (`ChromaDB`), LLM connection logic (`Ollama Qwen 2.5 32B`), and token trimming.
*   `nssm.exe`: "Non-Sucking Service Manager" utility used to install and run the AI continuously as a background Windows Service.
