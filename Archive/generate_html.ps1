$html = @"
<!DOCTYPE html>
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
    .resource-section { margin-bottom: 3rem; }
    .resource-section h3 { font-family: 'Poppins', sans-serif; color: var(--csrd-primary); border-bottom: 2px solid var(--csrd-green); padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
    .resource-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
    .resource-card { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s; display: flex; flex-direction: column; }
    .resource-card:hover { transform: translateY(-5px); box-shadow: 0 10px 15px rgba(0,0,0,0.1); border-color: var(--csrd-primary); }
    .resource-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .resource-icon { width: 40px; height: 40px; border-radius: 8px; background: rgba(30, 61, 89, 0.1); color: var(--csrd-primary); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; }
    .resource-title { font-weight: 600; color: var(--text-main); font-size: 1.1rem; flex: 1; margin: 0; }
    .resource-type { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background: #e0f2fe; color: #0369a1; margin-bottom: 1rem; align-self: flex-start; }
    .type-featureservice { background: #dcfce7; color: #166534; }
    .type-mapservice { background: #fef9c3; color: #854d0e; }
    .type-geoprocessingservice { background: #f3e8ff; color: #6b21a8; }
    .type-notebook { background: #ffedd5; color: #9a3412; }
    .type-webmap { background: #e0e7ff; color: #3730a3; }
    .type-datastore { background: #f1f5f9; color: #475569; }
    .resource-meta { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem; font-family: 'Fira Code', monospace; word-break: break-all; }
    .resource-links { display: flex; gap: 0.75rem; margin-top: auto; }
    .btn-resource { flex: 1; padding: 0.5rem; text-align: center; border-radius: 6px; font-size: 0.875rem; font-weight: 500; text-decoration: none; transition: all 0.2s; }
    .btn-primary { background: var(--csrd-primary); color: white; }
    .btn-primary:hover { background: #152b40; color: white; }
    .btn-secondary { background: #f1f5f9; color: var(--text-main); border: 1px solid #e2e8f0; }
    .btn-secondary:hover { background: #e2e8f0; }
    .download-section { background: linear-gradient(135deg, rgba(30, 61, 89, 0.05), rgba(76, 175, 80, 0.05)); border: 1px solid rgba(30, 61, 89, 0.1); border-radius: 12px; padding: 2rem; margin-bottom: 3rem; }
    .download-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 1rem; }
    .download-item { display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
    .download-info { display: flex; align-items: center; gap: 1rem; }
    .download-icon { color: var(--csrd-green); font-size: 1.5rem; }
    .download-filename { font-weight: 600; color: var(--text-main); font-family: 'Fira Code', monospace; }
    .download-desc { font-size: 0.875rem; color: var(--text-muted); }
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
      <p class="subtitle">Downloadable schemas, tools, and links to ArcGIS Portal items.</p>
    </header>

    <div class="content-wrap">
      
      <!-- GIS SERVER RESOURCES SECTION -->
      <section class="resource-section" id="gis-server">
        <h3><i class="fas fa-server"></i> GIS Server Files &amp; Paths</h3>
        <div class="download-section">
          <p>Network paths and configuration files located on the GIS Server (<code>\\GIS\Scripts\</code>).</p>
          <ul class="download-list">
            <li class="download-item">
              <div class="download-info">
                <i class="fas fa-file-code download-icon"></i>
                <div>
                  <div class="download-filename">SSAP_Schema.json</div>
                  <div class="download-desc">Esri JSON representation of the central feature class schema and domains.<br><b>Path:</b> <code>\\GIS\Scripts\NG911\NG911_Automation\SSAP_Schema.json</code></div>
                </div>
              </div>
              <a href="../DownloadFiles/SSAP_Schema.json" class="btn-resource btn-primary" style="flex: 0 0 auto; padding: 0.5rem 1.5rem;" download><i class="fas fa-download"></i> Download (.json)</a>
            </li>
            
            <li class="download-item">
              <div class="download-info">
                <i class="fas fa-toolbox download-icon"></i>
                <div>
                  <div class="download-filename">SSAP_Automation.atbx</div>
                  <div class="download-desc">ArcGIS Pro Python Toolbox containing QA, ETL, and synchronization scripts.<br><b>Path:</b> <code>\\GIS\Scripts\NG911\NG911_Automation\GPTools\SSAP_Automation.atbx</code></div>
                </div>
              </div>
              <a href="../DownloadFiles/SSAP_Automation.atbx" class="btn-resource btn-primary" style="flex: 0 0 auto; padding: 0.5rem 1.5rem;" download><i class="fas fa-download"></i> Download (.atbx)</a>
            </li>

            <li class="download-item">
              <div class="download-info">
                <i class="fas fa-code download-icon"></i>
                <div>
                  <div class="download-filename">SSAP_Automation.Tool.pyt.xml</div>
                  <div class="download-desc">Python Toolbox XML configuration file.<br><b>Path:</b> <code>\\GIS\Scripts\NG911\NG911_Automation\GPTools\SSAP_Automation.Tool.pyt.xml</code></div>
                </div>
              </div>
              <a href="../DownloadFiles/SSAP_Automation.Tool.pyt.xml" class="btn-resource btn-primary" style="flex: 0 0 auto; padding: 0.5rem 1.5rem;" download><i class="fas fa-download"></i> Download (.xml)</a>
            </li>

            <li class="download-item">
              <div class="download-info">
                <i class="fas fa-database download-icon"></i>
                <div>
                  <div class="download-filename">sde@regional.sde</div>
                  <div class="download-desc">SDE Connection File to the Regional database.<br><b>Path:</b> <code>\\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde</code></div>
                </div>
              </div>
              <a href="../DownloadFiles/sde@regional.sde" class="btn-resource btn-primary" style="flex: 0 0 auto; padding: 0.5rem 1.5rem;" download><i class="fas fa-download"></i> Download (.sde)</a>
            </li>

            <li class="download-item">
              <div class="download-info">
                <i class="fas fa-folder-open download-icon"></i>
                <div>
                  <div class="download-filename">NG911_Services</div>
                  <div class="download-desc">Folder containing ArcGIS Pro projects (.aprx) for publishing municipal feature services.<br><b>Path:</b> <code>\\GIS\Scripts\NG911\NG911_Services\</code></div>
                </div>
              </div>
              <button class="btn-resource btn-secondary" style="flex: 0 0 auto; padding: 0.5rem 1.5rem;" onclick="navigator.clipboard.writeText('\\\\GIS\\Scripts\\NG911\\NG911_Services\\')"><i class="fas fa-copy"></i> Copy Path</button>
            </li>

            <li class="download-item">
              <div class="download-info">
                <i class="fas fa-file-zipper download-icon"></i>
                <div>
                  <div class="download-filename">NG911 Exports Directory</div>
                  <div class="download-desc">Directory where the Export GP tool saves the zipped file geodatabases of the exported Default version.<br><b>Path:</b> <code>\\GIS\Scripts\Geoshare\NG911 Exports\</code></div>
                </div>
              </div>
              <button class="btn-resource btn-secondary" style="flex: 0 0 auto; padding: 0.5rem 1.5rem;" onclick="navigator.clipboard.writeText('\\\\GIS\\Scripts\\Geoshare\\NG911 Exports\\')"><i class="fas fa-copy"></i> Copy Path</button>
            </li>

          </ul>
        </div>
      </section>

      <!-- PORTAL ITEMS SECTION -->
      <section class="resource-section" id="portal-items">
        <h3><i class="fas fa-cloud"></i> ArcGIS Portal Resources</h3>
        <p>Links directly to the items configured within the CSRD ArcGIS Enterprise portal.</p>
        
        <div class="resource-grid">
"@

$lines = Get-Content "c:\Users\solim\Arcgis Notebooks\portal_links.txt"
foreach ($line in $lines) {
    $parts = $line -split " \| "
    if ($parts.Length -eq 4) {
        $title = $parts[0]
        $id = $parts[1]
        $url = $parts[2]
        $type = $parts[3]
    
        $typeClass = $type.ToLower() -replace "\s+", ""
        $icon = "fa-file"
        if ($type -eq "Feature Service" -or $type -eq "Feature Layer") { $icon = "fa-layer-group" }
        elseif ($type -eq "Map Service") { $icon = "fa-map" }
        elseif ($type -eq "Geoprocessing Service" -or $type -eq "Web Tool") { $icon = "fa-gears" }
        elseif ($type -eq "Notebook") { $icon = "fa-book" }
        elseif ($type -eq "Web Map") { $icon = "fa-map-location-dot" }
        elseif ($type -eq "Data Store") { $icon = "fa-database" }
        elseif ($type -eq "Application" -or $type -eq "Site Application" -or $type -eq "Site Page" -or $type -eq "Web Experience") { $icon = "fa-desktop" }
    
        $html += "          <div class=`"resource-card reveal`">`n"
        $html += "            <div class=`"resource-header`">`n"
        $html += "              <div class=`"resource-icon`"><i class=`"fas $icon`"></i></div>`n"
        $html += "              <h4 class=`"resource-title`" title=`"$title`">$title</h4>`n"
        $html += "            </div>`n"
        $html += "            <span class=`"resource-type type-$typeClass`">$type</span>`n"
        $html += "            <div class=`"resource-meta`" title=`"$id`"><b>ID:</b> $id</div>`n"
        $html += "            <div class=`"resource-links`">`n"
        $html += "              <a href=`"https://apps.csrd.bc.ca/hub/home/item.html?id=$id`" target=`"_blank`" class=`"btn-resource btn-primary`"><i class=`"fas fa-external-link-alt`"></i> View in Portal</a>`n"
        if ($url) {
            $html += "              <a href=`"$url`" target=`"_blank`" class=`"btn-resource btn-secondary`"><i class=`"fas fa-server`"></i> REST Endpoint</a>`n"
        }
        $html += "            </div>`n"
        $html += "          </div>`n"
    }
}

$html += @"
        </div>
      </section>

    </div><!-- /content-wrap -->
  </div><!-- /main -->

  <script src="search-data.js"></script>
  <script src="search-core.js"></script>
  <script src="editor-core.js"></script>
  <script>
    // ── Scroll reveal ──
    (function () {
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('visible'); io.unobserve(e.target)
          }
        })
      }, {
        threshold: .08, rootMargin: '0px 0px -40px 0px'
      }); document.querySelectorAll('.reveal').forEach(el => io.observe(el))
    })();
  </script>
</body>
</html>
"@

$html | Out-File "c:\Users\solim\Arcgis Notebooks\docs\system-resources.html" -Encoding utf8
