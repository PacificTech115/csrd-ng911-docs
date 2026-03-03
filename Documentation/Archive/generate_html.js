const fs = require('fs');

// Function to convert files to Base64 to force download locally
function getBase64(filename) {
  try {
    const data = fs.readFileSync('c:\\\\Users\\\\solim\\\\Arcgis Notebooks\\\\DownloadFiles\\\\' + filename);
    let mime = 'application/octet-stream';
    if (filename.endsWith('.json')) mime = 'application/json';
    else if (filename.endsWith('.xml')) mime = 'application/xml';
    else if (filename.endsWith('.atbx')) mime = 'application/zip';
    return 'data:' + mime + ';base64,' + data.toString('base64');
  } catch (e) {
    return '../DownloadFiles/' + filename;
  }
}

const inLinks = fs.readFileSync('c:\\\\Users\\\\solim\\\\Arcgis Notebooks\\\\portal_links.txt', 'utf8').split('\\n');
const portalItems = [];

for (const line of inLinks) {
  if (!line.trim()) continue;
  const parts = line.split(' | ');
  if (parts.length === 4) {
    portalItems.push({
      title: parts[0].trim(),
      id: parts[1].trim(),
      url: parts[2].trim(),
      type: parts[3].trim()
    });
  }
}

// Function to get proper description context based on title/type
function getContext(item) {
  if (item.title === "1.NG911-Reconcile Municipal -QA- Reconcile Default") return "Nightly pipeline orchestrator script that runs the 5-stage nightly reconcile, QA, export, and sync operations.";
  if (item.title === "2.NG911-SalmonArmETL") return "Hosted-to-enterprise data pipeline sync taking Salmon Arm edits to the central database with insert/update/delete operations.";
  if (item.title === "QA") return "Server-side geoprocessing rule-engine executing Schema validation, NGUID checks, and geometric QA. Called by the Nightly Orchestrator.";
  if (item.title === "ExportSSAP") return "Server-side operation that exports the DEFAULT database to a zipped File Geodatabase output. Called by the Nightly Orchestrator.";
  if (item.title === "ReconcilePostTraditional") return "Server-side geoprocessing script for executing a batch traditional versioning Reconcile & Post cycle. Called by the Nightly Orchestrator.";
  if (item.title === "NG911 Central Database Hub") return "The primary administrative Hub interface for managing all operations, documentation, and data statistics.";
  if (item.title === "Sicamous Address Management") return "Web Experience interface customized for District of Sicamous mapping editors.";
  if (item.title === "Power Automate") return "Microsoft Power Automate automated workflows and connection webhooks triggered by the Database Hub.";
  if (item.title === "Salmon Arm") return "Dedicated enterprise portal Site Page for the City of Salmon Arm stakeholders.";
  if (item.title === "NG911 Address All Layers Webmap") return "Comprehensive internal Web Map displaying all central database editing and publication layers.";
  if (item.type === "Feature Service") return "REST Feature Service endpoint utilized for querying and transactional map feature editing.";
  if (item.type === "Map Service") return "REST Map Service endpoint utilized for high-performance visual display of spatial features.";
  if (item.type === "Data Store") return "Underlying ArcGIS Relational Data Store connection verifying database connectivity.";
  if (item.type === "File Geodatabase") return "Direct link to a downloadable exported File Geodatabase.";
  return `ArcGIS Portal Item.`;
}

// Function to generate HTML for a portal item
function generatePortalCard(item, isSubItem = false) {
  const typeClass = item.type.toLowerCase().replace(/\s+/g, '');
  let icon = "fa-file";
  if (item.type === "Feature Service" || item.type === "Feature Layer") icon = "fa-layer-group";
  else if (item.type === "Map Service") icon = "fa-map";
  else if (item.type === "Geoprocessing Service" || item.type === "Web Tool") icon = "fa-gears";
  else if (item.type === "Notebook") icon = "fa-book";
  else if (item.type === "Web Map") icon = "fa-map-location-dot";
  else if (item.type === "Data Store") icon = "fa-database";
  else if (item.type === "Application" || item.type === "Site Application" || item.type === "Site Page" || item.type === "Web Experience") icon = "fa-desktop";

  const desc = getContext(item);
  const subClass = isSubItem ? " sub-item" : "";

  let html = `            <li class="download-item${subClass}">\n`;
  html += `              <div class="download-info">\n`;
  html += `                <i class="fas ${icon} download-icon" style="color: #64748b;"></i>\n`;
  html += `                <div>\n`;
  html += `                  <div class="download-filename">${item.title} <span class="resource-type type-${typeClass}">${item.type}</span></div>\n`;
  html += `                  <div class="download-desc">${desc} <br><span style="font-size:0.8rem; color:var(--text-muted); font-family:'Fira Code', monospace; margin-top:4px; display:inline-block;">ID: ${item.id}</span></div>\n`;
  html += `                </div>\n`;
  html += `              </div>\n`;
  html += `              <div class="action-group">\n`;
  html += `                <a href="https://apps.csrd.bc.ca/hub/home/item.html?id=${item.id}" target="_blank" class="btn-resource btn-primary" title="View in Portal"><i class="fas fa-external-link-alt"></i> Portal</a>\n`;
  if (item.url) {
    html += `                <a href="${item.url}" target="_blank" class="btn-resource btn-secondary" title="REST Endpoint"><i class="fas fa-server"></i> REST</a>\n`;
  }
  html += `              </div>\n`;
  html += `            </li>\n`;
  return html;
}

// Groupings
const groups = {
  "schema": {
    title: "Schema & Configuration",
    icon: "fa-project-diagram",
    desc: "Foundational files defining the database structure, domains, and connection parameters.",
    items: [] // Hardcoded in HTML
  },
  // We explicitly handle specific items for automation to nest GP tools
  "automation": {
    title: "Database Automation & Scripts",
    icon: "fa-robot",
    desc: "Geoprocessing tools and Python Notebooks used for Reconcile, Post, QA, and Export data pipelines. These items interact directly with the Default version.",
    items: portalItems.filter(i => ["1.NG911-Reconcile Municipal -QA- Reconcile Default", "QA", "ExportSSAP", "ReconcilePostTraditional", "2.NG911-SalmonArmETL"].includes(i.title) || (i.type === "Notebook" && !["1.NG911-Reconcile Municipal -QA- Reconcile Default", "2.NG911-SalmonArmETL"].includes(i.title)))
  },
  "editing": {
    title: "Municipal Feature & Map Services",
    icon: "fa-layer-group",
    desc: "Feature services utilized by local municipal editors and the core Regional edit services.",
    items: portalItems.filter(i => i.title.includes("_Edit") || i.title.includes("QA") || i.title.includes("Overwrite") || i.type === "Feature Service" || i.type === "Map Service" || i.type === "File Geodatabase")
  },
  "apps": {
    title: "Web Applications & Hub",
    icon: "fa-desktop",
    desc: "End-user interfaces and portals for managing and viewing the NG911 database.",
    items: portalItems.filter(i => i.type === "Application" || i.type === "Site Application" || i.type === "Site Page" || i.type === "Web Experience" || i.type === "Web Map")
  },
  "datastores": {
    title: "Data Stores",
    icon: "fa-database",
    desc: "Underlying ArcGIS Data Store connections for regional databases.",
    items: portalItems.filter(i => i.type === "Data Store")
  }
};

// Filter out already caught items from 'editing' category to avoid duplicates
const autoTitles = groups.automation.items.map(i => i.title);
groups.editing.items = groups.editing.items.filter(i => !autoTitles.includes(i.title));


let finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSRD NG911 — System Resources</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="shared.css">
  <style>
    .resource-section { margin-bottom: 3.5rem; }
    .resource-section h3 { font-family: 'Poppins', sans-serif; color: var(--navy); border-bottom: 2px solid var(--accent); padding-bottom: 0.5rem; margin-bottom: 0.5rem; }
    .section-desc { color: var(--text-muted); margin-bottom: 1.5rem; font-size: 0.95rem; line-height: 1.5; }
    
    .download-section { padding: 0.5rem 0; margin-bottom: 1rem; }
    .download-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1rem; }
    .download-item { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.25rem; background: var(--bg-card); border-radius: var(--radius-sm); box-shadow: 0 2px 4px rgba(0,0,0,0.02); transition: transform 0.2s, box-shadow 0.2s; border: 1px solid var(--border); }
    .download-item:hover { transform: translateY(-3px); box-shadow: 0 6px 12px rgba(0,0,0,0.05); border-color: rgba(13, 148, 136, 0.3); }
    
    /* Styling for nested sub-items */
    .download-item.sub-item { margin-left: 2.5rem; position: relative; padding: 1rem; background: var(--bg-page); border-left: 3px solid var(--border-strong); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
    
    .download-info { display: flex; align-items: flex-start; gap: 1.25rem; flex: 1; }
    .download-icon { color: var(--teal); font-size: 1.5rem; margin-top: 0.25rem; width: 32px; text-align: center; }
    .download-filename { font-weight: 600; color: var(--text-primary); font-size: 1.05rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .download-desc { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5; padding-right: 1.5rem; }
    .download-path { font-family: 'Fira Code', monospace; font-size: 0.8rem; background: white; padding: 0.2rem 0.5rem; border-radius: 4px; color: var(--text-secondary); margin-top: 0.5rem; display: inline-block; word-break: break-all; border: 1px solid var(--border); }
    
    .resource-type { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; vertical-align: middle; }
    .type-featureservice { background: #dcfce7; color: #166534; }
    .type-mapservice { background: #fef9c3; color: #854d0e; }
    .type-geoprocessingservice { background: #f3e8ff; color: #6b21a8; }
    .type-notebook { background: #ffedd5; color: #9a3412; }
    .type-webmap { background: #e0e7ff; color: #3730a3; }
    .type-datastore { background: #f1f5f9; color: #475569; }
    .type-siteapplication, .type-sitepage, .type-webexperience, .type-application { background: #dbeafe; color: #1e40af; }
    .type-file { background: #e2e8f0; color: #334155; }
    .type-folder { background: #fef08a; color: #854d0e; }
    
    /* Button styles using proper shared css variables */
    .btn-resource { padding: 0.5rem 1rem; text-align: center; border-radius: 6px; font-size: 0.85rem; font-weight: 500; text-decoration: none; transition: all 0.2s; white-space: nowrap; cursor: pointer; border: none; font-family: inherit; display: inline-flex; align-items: center; gap: 0.5rem; justify-content: center; }
    .btn-primary { background: var(--teal); color: white; }
    .btn-primary:hover { background: #0f766c; color: white; }
    .btn-secondary { background: var(--white); color: var(--text-primary); border: 1px solid var(--border-strong); }
    .btn-secondary:hover { background: var(--bg-page); border-color: var(--teal); }
    
    .action-group { display: flex; gap: 0.5rem; flex-direction: column; align-items: stretch; min-width: 120px; flex-shrink: 0; }
    @media (min-width: 768px) {
      .action-group { flex-direction: row; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <!-- SIDEBAR (Standard) -->
  <button class="mobile-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open')" aria-label="Toggle navigation"><i class="fas fa-bars"></i></button>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <img src="../csrd-logo.png" alt="NG911 CSRD Logo">
      <h2>Docs &amp; Maintenance</h2>
    </div>
    <nav class="sidebar-nav">
      <a href="../Documentation.html"><i class="fas fa-home"></i> Hub Home</a>
      <a href="architecture.html"><i class="fas fa-sitemap"></i> Architecture</a>
      <div class="nav-group-label">1. Technical Documentation</div>
      <div class="nav-sub-label">Database</div>
      <a href="schema-guide.html" class="nav-indent"><i class="fas fa-table-columns"></i> Schema Guide</a>
      <a href="attribute-rules.html" class="nav-indent"><i class="fas fa-wand-magic-sparkles"></i> Attribute Rules</a>
      <a href="domains.html" class="nav-indent"><i class="fas fa-list-check"></i> Domains</a>
      <div class="nav-sub-label">Automations</div>
      <a href="automation-scripts.html" class="nav-indent"><i class="fas fa-robot"></i> ArcGIS Notebooks</a>
      <a href="gp-tools.html" class="nav-indent"><i class="fas fa-gears"></i> GP Tools</a>
      <a href="power-automate.html" class="nav-indent"><i class="fas fa-envelope"></i> Power Automate</a>
      <div class="nav-group-label">2. Maintenance &amp; History</div>
      <a href="maintenance.html"><i class="fas fa-wrench"></i> Maintenance</a>
      <a href="version-edits.html"><i class="fas fa-history"></i> Version Edits</a>
      <div class="nav-group-label">3. Resources</div>
      <a href="system-resources.html" class="active"><i class="fas fa-link"></i> System Resources</a>
      <a href="quick-reference.html"><i class="fas fa-bolt"></i> Quick Reference</a>
    </nav>
  </aside>

  <!-- MAIN AREA -->
  <div class="main">
    <header class="page-header">
      <h1>System Resources</h1>
      <p class="subtitle">Downloadable schemas, tools, and links to ArcGIS Portal items grouped by system function.</p>
    </header>

    <div class="content-wrap">
      
      <!-- SECTION: SCHEMA & CONFIGURATION -->
      <section class="resource-section" id="schema">
        <h3><i class="fas fa-project-diagram"></i> Schema &amp; Configuration</h3>
        <p class="section-desc">Foundational files defining the database structure, domains, and connection parameters.</p>
        <div class="download-section">
          <ul class="download-list">
            <li class="download-item">
              <div class="download-info">
                <i class="fas fa-file-code download-icon" style="color: #475569;"></i>
                <div>
                  <div class="download-filename">SSAP_Schema.json <span class="resource-type type-file">Esri JSON</span></div>
                  <div class="download-desc">Esri JSON representation of the central feature class schema and domains.</div>
                  <div class="download-path">\\\\GIS\\Scripts\\NG911\\NG911_Automation\\SSAP_Schema.json</div>
                </div>
              </div>
              <div class="action-group">
                <a href="${getBase64('SSAP_Schema.json')}" class="btn-resource btn-secondary" download="SSAP_Schema.json"><i class="fas fa-download"></i> Download</a>
              </div>
            </li>
            <li class="download-item">
              <div class="download-info">
                <i class="fas fa-database download-icon" style="color: #475569;"></i>
                <div>
                  <div class="download-filename">sde@regional.sde <span class="resource-type type-file">SDE Connection</span></div>
                  <div class="download-desc">SDE Connection File to the Regional database securely.</div>
                  <div class="download-path">\\\\GIS\\Scripts\\NG911\\NG911_Automation\\connections\\sde@regional.sde</div>
                </div>
              </div>
              <div class="action-group">
                <a href="${getBase64('sde@regional.sde')}" class="btn-resource btn-secondary" download="sde@regional.sde"><i class="fas fa-download"></i> Download</a>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <!-- SECTION: AUTOMATION -->
      <section class="resource-section" id="automation">
        <h3><i class="fas ${groups.automation.icon}"></i> ${groups.automation.title}</h3>
        <p class="section-desc">${groups.automation.desc}</p>
        <div class="download-section">
          <ul class="download-list">
            <li class="download-item" style="border-left: 4px solid #6b21a8;">
              <div class="download-info">
                <i class="fas fa-toolbox download-icon" style="color: #6b21a8;"></i>
                <div>
                  <div class="download-filename">SSAP_Automation.atbx <span class="resource-type type-file">Python Toolbox</span></div>
                  <div class="download-desc">ArcGIS Pro Python Toolbox containing QA, ETL, and synchronization scripts.</div>
                  <div class="download-path">\\\\GIS\\Scripts\\NG911\\NG911_Automation\\GPTools\\SSAP_Automation.atbx</div>
                </div>
              </div>
              <div class="action-group">
                <a href="${getBase64('SSAP_Automation.atbx')}" class="btn-resource btn-secondary" download="SSAP_Automation.atbx"><i class="fas fa-download"></i> Download</a>
              </div>
            </li>
            <li class="download-item" style="border-left: 4px solid #6b21a8;">
              <div class="download-info">
                <i class="fas fa-code download-icon" style="color: #6b21a8;"></i>
                <div>
                  <div class="download-filename">SSAP_Automation.Tool.pyt.xml <span class="resource-type type-file">XML Config</span></div>
                  <div class="download-desc">Python Toolbox XML configuration file.</div>
                  <div class="download-path">\\\\GIS\\Scripts\\NG911\\NG911_Automation\\GPTools\\SSAP_Automation.Tool.pyt.xml</div>
                </div>
              </div>
              <div class="action-group">
                <a href="${getBase64('SSAP_Automation.Tool.pyt.xml')}" class="btn-resource btn-secondary" download="SSAP_Automation.Tool.pyt.xml"><i class="fas fa-download"></i> Download</a>
              </div>
            </li>
            <li class="download-item" style="border-left: 4px solid #6b21a8;">
              <div class="download-info">
                <i class="fas fa-file-zipper download-icon" style="color: #6b21a8;"></i>
                <div>
                  <div class="download-filename">NG911 Exports Directory <span class="resource-type type-folder">Output Folder</span></div>
                  <div class="download-desc">Directory where the Export GP tool saves the zipped file geodatabases.</div>
                  <div class="download-path">\\\\GIS\\Scripts\\Geoshare\\NG911 Exports\\</div>
                </div>
              </div>
              <div class="action-group">
                <button class="btn-resource btn-secondary" onclick="navigator.clipboard.writeText('\\\\\\\\GIS\\\\Scripts\\\\Geoshare\\\\NG911 Exports\\\\')"><i class="fas fa-copy"></i> Copy Path</button>
              </div>
            </li>
`;

// Extract orchestrated items specifically to order them properly
const notebookItem = groups.automation.items.find(i => i.title === "1.NG911-Reconcile Municipal -QA- Reconcile Default");
const qaItem = groups.automation.items.find(i => i.title === "QA");
const exportItem = groups.automation.items.find(i => i.title === "ExportSSAP");
const reconcileItem = groups.automation.items.find(i => i.title === "ReconcilePostTraditional");

// Render main orchestrator notebook
if (notebookItem) {
  finalHtml += generatePortalCard(notebookItem, false);
}
// Render GP Tools as sub-items underneath it
if (qaItem) finalHtml += generatePortalCard(qaItem, true);
if (reconcileItem) finalHtml += generatePortalCard(reconcileItem, true);
if (exportItem) finalHtml += generatePortalCard(exportItem, true);

// Render the rest of the automation items (like SalmonArmETL)
for (const item of groups.automation.items) {
  if (!["1.NG911-Reconcile Municipal -QA- Reconcile Default", "QA", "ExportSSAP", "ReconcilePostTraditional"].includes(item.title)) {
    finalHtml += generatePortalCard(item, false);
  }
}

finalHtml += `          </ul>\n        </div>\n      </section>\n\n`;


// EDITING SECTION
finalHtml += `      <!-- SECTION: EDITING -->\n      <section class="resource-section" id="editing">\n        <h3><i class="fas ${groups.editing.icon}"></i> ${groups.editing.title}</h3>\n        <p class="section-desc">${groups.editing.desc}</p>\n        <div class="download-section">\n          <ul class="download-list">\n`;
finalHtml += `            <li class="download-item" style="border-left: 4px solid #047857;">
              <div class="download-info">
                <i class="fas fa-folder-open download-icon" style="color: #047857;"></i>
                <div>
                  <div class="download-filename">NG911_Services <span class="resource-type type-folder">Project Folder</span></div>
                  <div class="download-desc">Folder containing ArcGIS Pro projects (.aprx) for publishing municipal feature services.</div>
                  <div class="download-path">\\\\GIS\\Scripts\\NG911\\NG911_Services\\</div>
                </div>
              </div>
              <div class="action-group">
                <button class="btn-resource btn-secondary" onclick="navigator.clipboard.writeText('\\\\\\\\GIS\\\\Scripts\\\\NG911\\\\NG911_Services\\\\')"><i class="fas fa-copy"></i> Copy Path</button>
              </div>
            </li>\n`;

for (const item of groups.editing.items) {
  finalHtml += generatePortalCard(item, false);
}
finalHtml += `          </ul>\n        </div>\n      </section>\n\n`;

// APPS SECTION
finalHtml += `      <!-- SECTION: APPS -->\n      <section class="resource-section" id="apps">\n        <h3><i class="fas ${groups.apps.icon}"></i> ${groups.apps.title}</h3>\n        <p class="section-desc">${groups.apps.desc}</p>\n        <div class="download-section">\n          <ul class="download-list">\n`;
for (const item of groups.apps.items) {
  finalHtml += generatePortalCard(item, false);
}
finalHtml += `          </ul>\n        </div>\n      </section>\n\n`;


// DATASTORES SECTION
finalHtml += `      <!-- SECTION: DATASTORES -->\n      <section class="resource-section" id="datastores">\n        <h3><i class="fas ${groups.datastores.icon}"></i> ${groups.datastores.title}</h3>\n        <p class="section-desc">${groups.datastores.desc}</p>\n        <div class="download-section">\n          <ul class="download-list">\n`;
for (const item of groups.datastores.items) {
  finalHtml += generatePortalCard(item, false);
}
finalHtml += `          </ul>\n        </div>\n      </section>\n\n`;

finalHtml += `    </div><!-- /content-wrap -->
  </div><!-- /main -->

  <script src="search-data.js"></script>
  <script src="search-core.js"></script>
  <script src="editor-core.js"></script>
</body>
</html>`;

fs.writeFileSync('c:\\Users\\solim\\Arcgis Notebooks\\docs\\system-resources.html', finalHtml, 'utf8');
