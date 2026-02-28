const fs = require('fs');
const path = require('path');

const srcImagesDir = './Municipal User Guides\\Sicamous User Guid';
const destImagesDir = './docs\\assets\\sicamous';

if (!fs.existsSync(destImagesDir)) {
  fs.mkdirSync(destImagesDir, { recursive: true });
}

// Copy the essential screenshots
const imagesToCopy = [
  '1-CSRD Portal Home Page.png',
  '2-Portal Groups Sicamous.png',
  '3-Sicamous Group.png',
  '4-Sicamous edit layer Overview.png',
  '5-Confirm CSRD Portal Sign in in Arcgis Pro.png',
  '6-Sicamous ArcGIS pro.png',
  '7-Sicamous ArcGISPro Edit.png',
  '8-Sicamous ArcGISPro Save Edits.png',
  '3A- Sicamous Group.png',
  '4A- Sicamous Address Management Web App overview.png',
  '4B- Sicamous Address Management Web App Home page Create.png',
  '5A- Sicamous Web App feature point.png',
  '6A- Sicamous Web App Creation Form.png',
  '7A- Sicamous Web App Confirm Create.png',
  '8A- Sicamous Web AppHome Button.png',
  '9A- Sicamous Web App Edit Button.png',
  '10A-WebApp Search Bar.png',
  '11A-WebApp Search Results.png',
  '12A-WebApp Edit Form.png',
  '13A-WebApp Update Button.png'
];

imagesToCopy.forEach(img => {
  const srcPath = path.join(srcImagesDir, img);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(destImagesDir, img));
  } else {
    console.warn('Missing image: ', img);
  }
});

// Also copy the PDF
const pdfSrc = path.join(srcImagesDir, 'Sicamous_NG911_Central_Addressing_User_Guide.pdf');
const pdfDest = './DownloadFiles\\Sicamous_NG911_Central_Addressing_User_Guide.pdf';
if (fs.existsSync(pdfSrc)) {
  fs.copyFileSync(pdfSrc, pdfDest);
}

// Copy logo
const logoSrc = './Municipal User Guides/Sicamous.png';
const logoDest = path.join(destImagesDir, 'Sicamous.png');
if (fs.existsSync(logoSrc)) {
  fs.copyFileSync(logoSrc, logoDest);
}

const HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CSRD NG911 — Sicamous User Guide</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@600;700;800&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link rel="stylesheet" href="shared.css">
</head>
<body>
<div id="progress"></div>
<button class="mobile-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open')" aria-label="Toggle navigation">
  <i class="fas fa-bars"></i>
</button>`;

const SIDEBAR = `
<aside class="sidebar" id="sidebar">
  <div class="sidebar-brand">
    <img src="assets/sicamous/Sicamous.png" alt="Sicamous Logo">
    <h2>Docs &amp; Maintenance</h2>
  </div>
  <nav class="sidebar-nav">
    <a href="../Documentation.html"><i class="fas fa-home"></i> Home</a>
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
    <div class="nav-group-label">2. Maintenance Guide</div>
    <a href="maintenance.html"><i class="fas fa-wrench"></i> Maintenance</a>
    <div class="nav-group-label">3. Municipal Guides</div>
    <a href="guide-golden.html" class="nav-indent"><i class="fas fa-city"></i> Golden</a>
    <a href="guide-revelstoke.html" class="nav-indent"><i class="fas fa-city"></i> Revelstoke</a>
    <a href="guide-salmonarm.html" class="nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>
    <a href="guide-sicamous.html" class="active nav-indent"><i class="fas fa-city"></i> Sicamous</a>
    <div class="nav-group-label">4. Version Control</div>
    <a href="version-edits.html"><i class="fas fa-history"></i> Version Edits</a>
    <div class="nav-group-label">5. Quick Reference</div>
    <a href="quick-reference.html"><i class="fas fa-bolt"></i> Quick Reference</a>
  </nav>
  <div class="sidebar-footer">CSRD NG911 &copy; 2026 &middot; Pacific Tech Systems</div>
</aside>`;

const HEADER = `
<div class="main">

<div class="hero-wrapper" id="hero">
  <div class="hero-card">
    <div class="hero-card-inner">
      <div class="hero-text">
        <h1>District of Sicamous <span>NG9-1-1</span> Central<br>Addressing System</h1>
        <div class="subtitle">Editor User Guide &amp; Workflow Timeline</div>
        <div class="hero-actions" style="margin-top: 24px;">
          <a href="../DownloadFiles/Sicamous_NG911_Central_Addressing_User_Guide.pdf" download class="btn" style="background:var(--white);color:var(--navy);padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)">
            <i class="fas fa-download"></i> Download Original PDF
          </a>
        </div>
      </div>
      <div class="hero-graphic">
        <img src="hero-illustration.png" alt="GIS Documentation Illustration">
      </div>
    </div>
  </div>
</div>

<div class="content-wrap">

<section>
  <h2 class="reveal"><i class="fas fa-layer-group"></i>&nbsp; Pipeline Timeline</h2>
  <div class="pipeline reveal">
    <div class="pipeline-step s1" style="background:var(--teal)">Pro &amp; Web App<small>Direct Edits</small></div>
    <div class="pipeline-arrow"><div class="dot"></div></div>
    <div class="pipeline-step s2">Reconcile &amp; Post<small>MUNI_TO_QA</small></div>
    <div class="pipeline-arrow"><div class="dot"></div></div>
    <div class="pipeline-step s3">QA SDE<small>Validation</small></div>
    <div class="pipeline-arrow"><div class="dot"></div></div>
    <div class="pipeline-step s4">DEFAULT SDE<small>Production</small></div>
    <div class="pipeline-arrow"><div class="dot"></div></div>
    <div class="pipeline-step s5">Provincial Export<small>NextGen 911</small></div>
  </div>
</section>

<section>
  <h2 class="reveal"><i class="fas fa-video"></i>&nbsp; Workflow Walkthrough (Sicamous)</h2>
  <div class="video-container reveal" style="margin-top: 20px; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
      <iframe src="https://www.youtube.com/embed/9Gx9wv3nLe8?rel=0" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
  </div>
</section>`;

const SEC1 = `
<section>
  <h2 class="reveal"><i class="fas fa-bullseye"></i>&nbsp; Purpose and Scope</h2>
  <div class="card reveal">
    <p>This guide explains the standard Sicamous workflows for editing NG911 central addressing data using two supported methods:</p>
    
    <h4 style="margin-top: 15px;">Method 1: ArcGIS Pro</h4>
    <ol style="margin-top:5px; margin-left: 20px;">
      <li>Log in to the CSRD portal.</li>
      <li>Open the Sicamous NG911 group.</li>
      <li>Open the designated Sicamous editing feature layer item.</li>
      <li>Choose <strong>Open in ArcGIS Pro</strong>.</li>
      <li>Edit attributes/geometry and save edits.</li>
    </ol>
    
    <h4 style="margin-top: 15px;">Method 2: Experience Builder Web App</h4>
    <ol style="margin-top:5px; margin-left: 20px;">
      <li>Log in to the CSRD portal.</li>
      <li>Open the Sicamous NG911 group.</li>
      <li>Open the Web app Portal Item and click on View.</li>
      <li>Edit and search records directly in the web browser.</li>
    </ol>
  </div>
</section>

<section>
  <h2 class="reveal"><i class="fas fa-key"></i>&nbsp; System Access Details</h2>
  
  <div class="grid-2 reveal">
    <div class="card">
      <h4>Portal & Item URLs</h4>
      <table style="margin-top: 10px;">
        <tbody>
          <tr><td><strong>CSRD Portal Home</strong></td><td><a href="https://apps.csrd.bc.ca/hub/home" target="_blank" style="word-break: break-all;">https://apps.csrd.bc.ca/hub/home</a></td></tr>
          <tr><td><strong>Sicamous Group</strong></td><td><a href="https://apps.csrd.bc.ca/hub/home/group.html?id=d86ec2e6c271497eaf8983af5ce577e1#overview" target="_blank">Open Group</a></td></tr>
          <tr><td><strong>Editing Layer (Pro)</strong></td><td><a href="https://apps.csrd.bc.ca/hub/home/item.html?id=f820d1ba962846d1bd71fa0d3c975043" target="_blank">Open Edit Item</a></td></tr>
          <tr><td><strong>Web App Item</strong></td><td><a href="https://apps.csrd.bc.ca/hub/home/item.html?id=2a6307820c874d9bbfd7289a694408d4" target="_blank">Open Web App Item</a></td></tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h4>User Credentials</h4>
      <table style="margin-top: 10px;">
        <thead><tr><th>Role</th><th>Username</th><th>Password</th></tr></thead>
        <tbody>
          <tr>
            <td><span class="card-tag" style="background:rgba(14,165,233,.1);color:var(--blue)">Viewer</span></td>
            <td><code>Sicamous</code></td>
            <td><code>Sicamous_2024</code></td>
          </tr>
          <tr>
            <td><span class="card-tag" style="background:rgba(16,185,129,.1);color:var(--green)">Editor</span></td>
            <td><code>Sicamous_Editing</code></td>
            <td><code>SicamousEdit!@2026</code></td>
          </tr>
        </tbody>
      </table>
      <div class="alert info" style="margin-top:15px; margin-bottom:0;"><i class="fas fa-info-circle"></i><span>Use the <strong>Viewer</strong> account for read-only validation. Only use the <strong>Editor</strong> account for production edits directly to the Sicamous address layer.</span></div>
    </div>
  </div>
</section>`;

const SEC2 = `
<section>
  <h2 class="reveal"><i class="fas fa-laptop-code"></i>&nbsp; Method 1: ArcGIS Pro Workflow</h2>
  
  <div class="card reveal">
    <h4>Step 1: Log in to the CSRD portal</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Open a browser and go to the CSRD Portal Home URL.</li>
      <li>Click <strong>Sign In</strong> using your Editor account.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/sicamous/1-CSRD Portal Home Page.png" alt="CSRD Portal Home Page" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 2: Navigate to the Sicamous NG911 group</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>From the Groups tab, open the Sicamous group.</li>
    </ol>
    <div class="grid-2" style="margin-top: 15px;">
        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <img src="assets/sicamous/2-Portal Groups Sicamous.png" alt="Portal Groups" style="width: 100%; display: block;">
        </div>
        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <img src="assets/sicamous/3-Sicamous Group.png" alt="Sicamous Group" style="width: 100%; display: block;">
        </div>
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 3: Open the editing feature layer item</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>In the group content, click the editing feature layer item.</li>
      <li>Review the item details to confirm it is the correct editing layer.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/sicamous/4-Sicamous edit layer Overview.png" alt="Edit Feature Layer" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 4: Open in ArcGIS Pro</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>On the item page, click <strong>Open in ArcGIS Pro</strong>.</li>
      <li>Allow ArcGIS Pro to launch and sign in to the portal if prompted.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/sicamous/5-Confirm CSRD Portal Sign in in Arcgis Pro.png" alt="Open in Pro" style="width: 100%; display: block;">
    </div>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/sicamous/6-Sicamous ArcGIS pro.png" alt="Layer in Pro Context" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 5: Edit Records</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>In ArcGIS Pro, open the <strong>Edit</strong> tab and start an edit session if required.</li>
      <li>Use the <strong>Modify Features</strong> pane to select, update, or create an address point.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/sicamous/7-Sicamous ArcGISPro Edit.png" alt="Editing in ArcGIS Pro" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 6: Save edits</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Click <strong>Save</strong> in the ArcGIS Pro Edit tab to commit changes.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/sicamous/8-Sicamous ArcGISPro Save Edits.png" alt="Save Edits" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 7: Verification of changes</h4>
    <p style="margin-top: 10px;">Return to the CSRD Portal item page &rarr; Data tab to ensure your Pro edits were synchronized properly to the central server layer.</p>
  </div>
</section>`;

const SEC4 = `
<section>
  <h2 class="reveal"><i class="fas fa-globe"></i>&nbsp; Method 2: Experience Builder Web App</h2>
  <p class="reveal"><em>Note: Steps 1 and 2 (Logging in to the CSRD Portal and navigating to the Sicamous NG911 Group) are identical to Method 1.</em></p>
  
  <div class="card reveal" style="margin-top: 20px;">
    <h4>Step 3: Open the Web App</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Open the Web App Portal Item from the group page.</li>
      <li>Click on <strong>View</strong> to launch the web application.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/sicamous/3A- Sicamous Group.png" alt="Web App Portal Item" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 4: Create a new address</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>In the Web App interface, click on the <strong>Create</strong> button.</li>
    </ol>
    <div class="grid-2" style="margin-top: 15px;">
        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <img src="assets/sicamous/4A- Sicamous Address Management Web App overview.png" alt="App Interface Overview" style="width: 100%; display: block;">
        </div>
        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <img src="assets/sicamous/4B- Sicamous Address Management Web App Home page Create.png" alt="Create Button" style="width: 100%; display: block;">
        </div>
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 5: Place the address point</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Click on the <strong>Feature point Creation</strong> button on the right side panel.</li>
      <li>Click on the map to place the point exactly on the location of the new address.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/sicamous/5A- Sicamous Web App feature point.png" alt="Point Creation" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 6 &amp; 7: Fill out forms and Create</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Fill out all required fields in the creation form.</li>
      <li>After reviewing the details, click <strong>Create</strong> to save the new address.</li>
    </ol>
    <p style="margin-top:10px;font-size:0.9em;color:var(--text-light)">For more information on required fields and automatically calculated values, see the <a href="#appendix">Appendix: Web App Edit Form Guide</a>.</p>
    <div class="grid-2" style="margin-top: 15px;">
        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <img src="assets/sicamous/6A- Sicamous Web App Creation Form.png" alt="Form" style="width: 100%; display: block;">
        </div>
        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <img src="assets/sicamous/7A- Sicamous Web App Confirm Create.png" alt="Confirm Create" style="width: 100%; display: block;">
        </div>
    </div>
  </div>
  
  <div class="card reveal">
    <h4>Step 8 &amp; 9: Home and Edit Buttons</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>To edit an existing record instead, go back to the Home page by clicking the <strong>Home</strong> button.</li>
      <li>Click on the <strong>Edit</strong> button to access the editing mode.</li>
    </ol>
    <div class="grid-2" style="margin-top: 15px;">
        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <img src="assets/sicamous/8A- Sicamous Web AppHome Button.png" alt="Home Button" style="width: 100%; display: block;">
        </div>
        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <img src="assets/sicamous/9A- Sicamous Web App Edit Button.png" alt="Edit Button" style="width: 100%; display: block;">
        </div>
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 10, 11 &amp; 12: Search, Select, Edit</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Click on the search bar on the map and enter the Full Address or NGUID.</li>
      <li>Click on the correct address from the results.</li>
      <li>Modify the attributes in the edit form on the right side.</li>
    </ol>
    <div class="grid-2" style="margin-top: 15px;">
        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <img src="assets/sicamous/10A-WebApp Search Bar.png" alt="Search Bar" style="width: 100%; display: block;">
        </div>
        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <img src="assets/sicamous/11A-WebApp Search Results.png" alt="Search Results" style="width: 100%; display: block;">
        </div>
    </div>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/sicamous/12A-WebApp Edit Form.png" alt="Edit Form" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 13: Click Update</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Click <strong>Update</strong> to commit the changes to the central database feature layer.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/sicamous/13A-WebApp Update Button.png" alt="Update Button" style="width: 100%; display: block;">
    </div>
  </div>

</section>`;

const SEC_APPX = `
<section id="appendix">
  <div class="card reveal" style="border-left: 4px solid var(--navy);">
    <div class="card-header"><div class="card-icon navy"><i class="fas fa-book"></i></div><h4>Appendix: Web App Edit Form Guide</h4></div>
    
    <p style="margin-top: 15px;">This section describes the <strong>NG911_Address_Sicamous_Edit</strong> full form architecture within the Experience Builder Web App. The fields are grouped by section with user-friendly descriptions.</p>
    
    <div class="alert info" style="margin-top: 15px; font-size: 0.9em;">
      <strong>Legend:</strong><br/>
      <strong>EDIT</strong> = User enters/changes &nbsp;&middot;&nbsp; <strong>REQ</strong> = Required &nbsp;&middot;&nbsp; <strong>RO</strong> = Read-only &nbsp;&middot;&nbsp; <strong>CALC</strong> = Arcade-calculated &nbsp;&middot;&nbsp; <strong>SERVER</strong> = Server-calculated on create/update &nbsp;&middot;&nbsp; <strong>HIDDEN</strong> = Not shown
    </div>

    <div class="doc-section" style="margin-top:15px">
        <button class="doc-toggle" data-target="app1" aria-expanded="false" style="padding:10px; background:#f9fafb; font-weight:600; width:100%; text-align:left; border-radius:6px; border:1px solid var(--border);">
            <i class="fas fa-chevron-down" style="margin-right:8px; font-size:12px;"></i> 1. System Calculated Fields (No input needed)
        </button>
        <div id="app1" class="doc-body collapsed" style="padding:10px 15px;">
            <p><em>These are system outputs calculated server-side.</em></p>
            <ul style="margin-left: 15px; margin-top: 10px; line-height: 1.5;">
                <li><strong>Full Address:</strong> (RO + SERVER) Formatted address.</li>
                <li><strong>Agency:</strong> (RO + SERVER + CALC) Responsible jurisdiction.</li>
                <li><strong>NENA Globally Unique ID:</strong> (RO + SERVER) Unique identifier.</li>
                <li><strong>Quality Check Status:</strong> (RO + SERVER) QA pass/fail.</li>
                <li><strong>Date Updated:</strong> (RO + SERVER) Timestamp.</li>
                <li><strong>Additional Code:</strong> (RO + SERVER) Internal assigned code.</li>
                <li><strong>Latitude/Longitude/Elevation:</strong> (RO + SERVER) Geometry derivation.</li>
            </ul>
        </div>
    </div>
    
    <div class="doc-section" style="margin-top:8px">
        <button class="doc-toggle" data-target="app2" aria-expanded="false" style="padding:10px; background:#f9fafb; font-weight:600; width:100%; text-align:left; border-radius:6px; border:1px solid var(--border);">
            <i class="fas fa-chevron-down" style="margin-right:8px; font-size:12px;"></i> 2. Main Address &amp; Mandatory NENA Fields
        </button>
        <div id="app2" class="doc-body collapsed" style="padding:10px 15px;">
            <p><em>Core civic address components and administrative regions.</em></p>
            <ul style="margin-left: 15px; margin-top: 10px; line-height: 1.5;">
                <li><strong>Country/Province/Regional District/Locality:</strong> (RO + REQ + CALC) Hard locked macro areas.</li>
                <li><strong>Address Number:</strong> (EDIT + REQ) Main civic number (e.g., "123").</li>
                <li><strong>Street Name:</strong> (EDIT + REQ) Core street name (e.g., "Main").</li>
                <li><strong>Unit/Suffix/Directionals/Types:</strong> (EDIT) Variable components.</li>
            </ul>
        </div>
    </div>

    <div class="doc-section" style="margin-top:8px">
        <button class="doc-toggle" data-target="app3" aria-expanded="false" style="padding:10px; background:#f9fafb; font-weight:600; width:100%; text-align:left; border-radius:6px; border:1px solid var(--border);">
            <i class="fas fa-chevron-down" style="margin-right:8px; font-size:12px;"></i> 3. Internal System Reference &amp; Subproperties
        </button>
        <div id="app3" class="doc-body collapsed" style="padding:10px 15px;">
            <p><em>Extra sub-location identifiers and internal linking.</em></p>
            <ul style="margin-left: 15px; margin-top: 10px; line-height: 1.5;">
                <li><strong>Parcel ID / Roll:</strong> (EDIT) Integration fields.</li>
                <li><strong>Building/Floor/Room/Seat:</strong> (EDIT) Fine-grained location fields.</li>
                <li><strong>Place Type/Placement Method:</strong> (EDIT) Details on logic for point placement.</li>
                <li><strong>Address Notes:</strong> (EDIT) Free-text editor annotations.</li>
            </ul>
        </div>
    </div>

  </div>
</section>`;

const FOOTER = `
</div><!-- /content-wrap -->

<footer class="site-footer">
  <img src="assets/sicamous/Sicamous.png" alt="Sicamous Logo" style="max-height: 48px;">
  <p>CSRD NG911 Central Database System &mdash; Documentation &amp; Maintenance Guide</p>
  <p class="sub">Pacific Tech Systems &middot; Last updated February 2026</p>
</footer>
</div><!-- /main -->

<button class="back-to-top" id="backToTop" onclick="window.scrollTo({top:0,behavior:'smooth'})" aria-label="Back to top">
  <i class="fas fa-arrow-up"></i>
</button>

<script>
(function(){
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}});
  },{threshold:.08,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
})();

(function(){
  const bar=document.getElementById('progress');
  function update(){
    const st=window.scrollY,h=document.documentElement.scrollHeight-window.innerHeight;
    bar.style.width=(h>0?Math.min(st/h*100,100):0)+'%';
  }
  window.addEventListener('scroll',update,{passive:true});update();
})();

(function(){
  const btt=document.getElementById('backToTop');
  window.addEventListener('scroll',function(){
    btt.classList.toggle('visible',window.scrollY>400);
  },{passive:true});
})();

// Doc toggles
(function(){
  document.querySelectorAll('.doc-toggle').forEach(function(btn){
    btn.addEventListener('click',function(){
      var id=this.getAttribute('data-target');
      var body=id?document.getElementById(id):null;
      if(!body)return;
      var isCollapsed=body.classList.contains('collapsed');
      body.classList.toggle('collapsed',!isCollapsed);
      this.setAttribute('aria-expanded',isCollapsed?'true':'false');
      var icon=this.querySelector('i');
      if(icon){
         icon.className = isCollapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
      }
    });
  });
})();
</script>
<script src="editor-core.js"></script>
</body>
</html>`;

const finalHTML = HEAD + SIDEBAR + HEADER + SEC1 + SEC2 + SEC4 + SEC_APPX + FOOTER;
fs.writeFileSync('./docs\\guide-sicamous.html', finalHTML, 'utf8');
console.log('✓ Created guide-sicamous.html');

// Inject the Sicamous link into all existing HTML files.
const docsDir = './docs';
const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.html') && f !== 'guide-sicamous.html');

let count = 0;
for (const file of files) {
  const fPath = path.join(docsDir, file);
  let content = fs.readFileSync(fPath, 'utf8');

  if (content.includes('<a href="guide-salmonarm.html"') && !content.includes('guide-sicamous.html')) {
    content = content.replace('<a href="guide-salmonarm.html" class="nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>',
      '<a href="guide-salmonarm.html" class="nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>\\n    <a href="guide-sicamous.html" class="nav-indent"><i class="fas fa-city"></i> Sicamous</a>');

    // Handle active class
    content = content.replace('<a href="guide-salmonarm.html" class="active nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>',
      '<a href="guide-salmonarm.html" class="active nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>\\n    <a href="guide-sicamous.html" class="nav-indent"><i class="fas fa-city"></i> Sicamous</a>');

    fs.writeFileSync(fPath, content, 'utf8');
    count++;
  }
}

// Update Documentation.html separately since it's in the root
const rootDocPath = './Documentation.html';
if (fs.existsSync(rootDocPath)) {
  let content = fs.readFileSync(rootDocPath, 'utf8');

  // Add sidebar link
  if (content.includes('<a href="docs/guide-salmonarm.html"') && !content.includes('docs/guide-sicamous.html')) {
    content = content.replace('<a href="docs/guide-salmonarm.html" class="nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>',
      '<a href="docs/guide-salmonarm.html" class="nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>\\n    <a href="docs/guide-sicamous.html" class="nav-indent"><i class="fas fa-city"></i> Sicamous</a>');
    fs.writeFileSync(rootDocPath, content, 'utf8');
  }
}

console.log('✓ Updated sidebars in ' + count + ' HTML files.');
