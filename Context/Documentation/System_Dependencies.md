# System Dependencies & Resource Index

## URL Quick Reference

| URL | Application | Purpose |
|-----|------------|---------|
| apps.csrd.bc.ca/ng911 | NG911 Documentation Hub | Web app with docs, GP tools, AI assistant, Sync App |
| apps.csrd.bc.ca/hub | CSRD ArcGIS Enterprise Portal | Maps, data management, ArcGIS Pro connections |
| ai.pacifictechsystems.ca | AI Backend | FastAPI + LangGraph RAG service (Cloudflare Tunnel to localhost:8000) |

**Important:** The Documentation Hub and the Portal are DIFFERENT applications on the same server. The Documentation Hub (`/ng911`) is the custom SPA built by Pacific Tech Systems. The Portal (`/hub`) is the standard ArcGIS Enterprise Portal.

## ArcGIS Enterprise Portal
- Portal URL: https://apps.csrd.bc.ca/hub
- Base URL: https://apps.csrd.bc.ca
- REST Services Base: https://apps.csrd.bc.ca/arcgis/rest/services
- App Client ID: vWXtjJtA7k006M4S
- Service Account: CSRD_Service

## Web Application
- Production (IIS): https://apps.csrd.bc.ca/ng911
- Staging (GitHub Pages): https://pacifictechsystems.ca/csrd-ng911-docs (or GitHub Pages URL)
- AI Backend: https://ai.pacifictechsystems.ca (Cloudflare Tunnel → localhost:8000 on PTS-01)

## CMS Hosted Table
- URL: https://apps.csrd.bc.ca/arcgis/rest/services/Hosted/NG911_Docs_CMS/FeatureServer/0
- Fields: cms_key (String), cms_value (String), OBJECTID
- Encoding: Content stored as Base64 for XSS safety

## Geoprocessing Services
| Tool | REST Endpoint |
|------|---------------|
| QA Validation | /Regional/QA/GPServer |
| Reconcile/Post Traditional | /ReconcilePostTraditional/GPServer |
| Export SSAP | /Landbase/ExportSSAP/GPServer |
| Orchestrator | /Regional/Orchestrator/GPServer/Orchestrator |

## ArcGIS Notebooks
| Notebook | Item ID |
|----------|---------|
| Nightly Orchestrator | 811614c266a84b769c1fe9ffbedda058 |
| Salmon Arm ETL | fb8fd369499b440c8ae3720c1bbe3b9f |

## Feature Services (Municipal Edit)
| Municipality | REST Endpoint |
|-------------|---------------|
| Revelstoke | /Regional/NG911_Address_Revelstoke_Edit/FeatureServer |
| Golden | /Regional/NG911_Address_Golden_Edit/FeatureServer |
| Sicamous | /Regional/NG911_Address_Sicamous_Edit/FeatureServer |

## Enterprise Geodatabase Versions
| Version | Role |
|---------|------|
| sde.DEFAULT | Authoritative (production) |
| SDE.QA | Staging / validation gate |
| SDE.CSRD | CSRD internal editing |
| SDE.Revelstoke | Revelstoke municipal editing |
| SDE.Golden | Golden municipal editing |
| SDE.Salmon Arm | Salmon Arm municipal editing (via ETL sync) |
| SDE.Sicamous | Sicamous municipal editing |

## Nightly Pipeline (5-Stage Sequential)
1. MUNI → QA: Reconcile/Post municipal editor versions into SDE.QA
2. Run QA: GP service validates schema, NGUID, mandatory fields, duplicates
3. QA → DEFAULT: Reconcile/Post approved data into sde.DEFAULT
4. Export FGDB: Snapshot DEFAULT → timestamped ZIP → network share
5. DEFAULT → MUNI: Reconcile back (NO_POST, FAVOR_TARGET) to push QAStatus to editors
