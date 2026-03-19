# CSRD NG911 Project Context

This is the master technical repository for the **CSRD NG911 System**, developed by Pacific Tech Systems for the Columbia Shuswap Regional District. The project aggregates and automates municipal addressing data to comply with Canada's NG911 System.

## Architecture Pillars (Tech Stack)
1. **NG911 Central System (ArcGIS Enterprise)**: Address schema, domains, Arcade attribute rules, Nightly ETL pipelines (Python/ArcPy), Power Automate webhooks. Located in `NG911System/Database Scripts/`.
2. **Web Application (Documentation Hub)**: Vanilla HTML/CSS/JS Single Page Application, ArcGIS Hosted Table CMS backend, JS Geoprocessing runners, IIS CI/CD via PowerShell. Located in `Web App/`.
3. **Local AI Assistant**: Local RAG backend (FastAPI, Server-Sent Events, LangGraph, ChromaDB, Qwen 2.5 32B). Located in `AI/`.

## Key Reference Files
- `Context/Master_Context.md`: The full architectural blueprint.
- `Context/File_Index.md`: Directory structure map to locate scripts.

## Custom Role Commands
This project utilizes custom slash commands to adopt specific agent personas and maintain persistent memory loops. Type these commands to switch context:
- `/supervisor`: Act as the Supervisor Agent (Lead Architect)
- `/ng911`: Act as the NG911 System Agent (ArcGIS/Python Expert)
- `/webapp`: Act as the Web App Agent (Frontend/IIS Expert)
- `/aiapp`: Act as the AI App Agent (FastAPI/LangGraph Expert)

## General Guidelines & Persistent Memory Constraints
Each persona has a strict persistent memory loop. If you modify architecture, deploy scripts, update UI, or change backend logic, you MUST:
1. Propose and write the implementation.
2. **STOP** and explicitly ask the user for approval.
3. Once approved by the user, append a detailed changelog to `.agents\memory\<persona>_memory.md`.
*Always read the relevant `_memory.md` file when adopting a persona to recall past decisions.*
