const fs = require('fs');
const path = require('path');

const srcImagesDir = 'c:\\Users\\solim\\Arcgis Notebooks\\Municipal User Guides\\Salmon Arm User Guide';
const destImagesDir = 'c:\\Users\\solim\\Arcgis Notebooks\\docs\\assets\\salmonarm';

if (!fs.existsSync(destImagesDir)) {
  fs.mkdirSync(destImagesDir, { recursive: true });
}

// Copy the essential screenshots
const imagesToCopy = [
  '1 portalhome.png',
  '2 portal content tab.png',
  '3 overwrite layer item.png',
  '4 update data menu.png',
  '5 Overwrite Option.png',
  '6 upload gdb.png',
  '7 proceed overwrite.png',
  '8 updating status.png',
  '9 data verification.png',
  '10 ETL Process Verification Email.png'
];

imagesToCopy.forEach(img => {
  const srcPath = path.join(srcImagesDir, img);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(destImagesDir, img));
  }
});

// Also copy the PDF
const pdfSrc = path.join(srcImagesDir, 'Salmon_Arm_NG911_Central_Addressing_User_Guide.pdf');
const pdfDest = 'c:\\Users\\solim\\Arcgis Notebooks\\DownloadFiles\\Salmon_Arm_NG911_Central_Addressing_User_Guide.pdf';
if (fs.existsSync(pdfSrc)) {
  fs.copyFileSync(pdfSrc, pdfDest);
}

const HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CSRD NG911 — Salmon Arm User Guide</title>
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
    <img src="assets/salmonarm/SalmonArm.png" alt="Salmon Arm Logo">
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
    <a href="guide-salmonarm.html" class="active nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>
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
        <h1>City of Salmon Arm <span>NG9-1-1</span> Central<br>Addressing System</h1>
        <div class="subtitle">Editor User Guide &amp; Workflow Timeline</div>
        <div class="hero-actions" style="margin-top: 24px;">
          <a href="../DownloadFiles/Salmon_Arm_NG911_Central_Addressing_User_Guide.pdf" download class="btn" style="background:var(--white);color:var(--navy);padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1)">
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
    <div class="pipeline-step s1">Local GDB<small>Zip Archive</small></div>
    <div class="pipeline-arrow"><div class="dot"></div></div>
    <div class="pipeline-step s2">Hosted Layer<small>Portal Overwrite</small></div>
    <div class="pipeline-arrow"><div class="dot"></div></div>
    <div class="pipeline-step s3">Automated ETL<small>Sync to SDE</small></div>
    <div class="pipeline-arrow"><div class="dot"></div></div>
    <div class="pipeline-step s4">DEFAULT SDE<small>Production</small></div>
    <div class="pipeline-arrow"><div class="dot"></div></div>
    <div class="pipeline-step s5">Provincial Export<small>NextGen 911</small></div>
  </div>
</section>

<section>
  <h2 class="reveal"><i class="fas fa-video"></i>&nbsp; Workflow Walkthrough (Salmon Arm)</h2>
  <div class="video-container reveal" style="margin-top: 20px; position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
      <iframe src="https://www.youtube.com/embed/eDtJPrff6-g?rel=0" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
  </div>
</section>`;

const SEC1 = `
<section>
  <h2 class="reveal"><i class="fas fa-bullseye"></i>&nbsp; Purpose and Scope</h2>
  <div class="card reveal">
    <p>This guide explains the standard Salmon Arm workflow for editing NG911 central addressing data via the <strong>Overwrite Hosted Feature Layer + ETL Reconcile</strong> process:</p>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Go to CSRD Portal Home and log in.</li>
      <li>Click on the Content tab.</li>
      <li>Open the <code>SalmonArmOverwrite</code> Hosted Feature layer.</li>
      <li>Click on Update Data &rarr; Overwrite Entire Feature Layer.</li>
      <li>Upload your zipped GDB file.</li>
      <li>Verify the updates on the Data tab.</li>
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
          <tr><td><strong>Salmon Arm Group</strong></td><td><a href="https://apps.csrd.bc.ca/hub/home/group.html?id=8bfe21794ce441a2af179df0abcda994#overview" target="_blank">Open Group</a></td></tr>
          <tr><td><strong>Central DB Layer</strong></td><td><a href="https://apps.csrd.bc.ca/hub/home/item.html?id=aa1e950efc324d809ad4e6d005706a3e" target="_blank">View External Item</a></td></tr>
          <tr><td><strong>Overwrite Layer</strong></td><td><a href="https://apps.csrd.bc.ca/hub/home/item.html?id=8cf1681215c540878625fdb4ec7434e4" target="_blank">Open Overwrite Item</a></td></tr>
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
            <td><code>SalmonArm</code></td>
            <td><code>SamlonArm@2024</code></td>
          </tr>
          <tr>
            <td><span class="card-tag" style="background:rgba(16,185,129,.1);color:var(--green)">Editor</span></td>
            <td><code>Salmon_Arm_Editing</code></td>
            <td><code>Salmonarm2026</code></td>
          </tr>
        </tbody>
      </table>
      <div class="alert info" style="margin-top:15px; margin-bottom:0;"><i class="fas fa-info-circle"></i><span>Use the <strong>Viewer</strong> account for read-only validation. Only use the <strong>Editor</strong> account for production edits and data overwrites.</span></div>
    </div>
  </div>
</section>`;

const SEC2 = `
<section>
  <h2 class="reveal"><i class="fas fa-list-ol"></i>&nbsp; Step-by-Step Overwrite Workflow</h2>
  
  <div class="card reveal">
    <h4>Step 1: Log in to the CSRD portal</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Go to the CSRD Portal Home.</li>
      <li>Log in with your Editor Credentials.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/salmonarm/1 portalhome.png" alt="CSRD Portal Home Page" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 2: Navigate to Content</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Click on the <strong>Content</strong> tab at the top of the page.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/salmonarm/2 portal content tab.png" alt="Portal Content Tab" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 3: Open the Overwrite Hosted Feature Layer</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Locate and click on the <code>SalmonArmOverwrite</code> Hosted Feature layer item.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/salmonarm/3 overwrite layer item.png" alt="Overwrite Item Overview" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 4: Click Update Data</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>On the Overview page, click on <strong>Update Data</strong>.</li>
    </ol>
    <div class="alert warning" style="margin-top:10px;margin-bottom:10px;"><i class="fas fa-exclamation-triangle"></i><span>Note: It may take a few seconds for the Update Data button to appear.</span></div>
    <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/salmonarm/4 update data menu.png" alt="Update Data Menu" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 5: Overwrite Entire Feature Layer</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Select <strong>Overwrite Entire Feature Layer</strong> from the dropdown menu.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/salmonarm/5 Overwrite Option.png" alt="Overwrite Option" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 6: Upload the updated Database</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Upload the zipped GDB file of your updated Salmon Arm Database.</li>
    </ol>
    <div class="alert warning" style="margin-top:10px;margin-bottom:10px;"><i class="fas fa-exclamation-triangle"></i><span><strong>Important:</strong> The Geodatabase name must be <code>Default.gdb.zip</code> and the Feature Class must be <code>NG911_AddressPoints_SalmonArm_Overwrite</code> for the overwrite to succeed.</span></div>
    <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/salmonarm/6 upload gdb.png" alt="Upload GDB" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 7: Proceed with Overwrite</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Click on <strong>Proceed</strong> to confirm the overwrite.</li>
    </ol>
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/salmonarm/7 proceed overwrite.png" alt="Proceed Overwrite" style="width: 100%; display: block;">
    </div>
  </div>

  <div class="card reveal">
    <h4>Step 8 &amp; 9: Wait and Verify Updates</h4>
    <ol style="margin-top:10px; margin-left: 20px;">
      <li>Wait for the hosted feature layer to finish updating (do not close the window).</li>
      <li>Once completed, go to the <strong>Data</strong> tab to ensure attributes were overwritten.</li>
    </ol>
    <div class="grid-2" style="margin-top: 15px;">
        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <img src="assets/salmonarm/8 updating status.png" alt="Updating Status" style="width: 100%; display: block;">
        </div>
        <div style="border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <img src="assets/salmonarm/9 data verification.png" alt="Data Verification" style="width: 100%; display: block;">
        </div>
    </div>
  </div>
</section>`;

const SEC3 = `
<section>
  <h2 class="reveal"><i class="fas fa-envelope-open-text"></i>&nbsp; ETL Process Verification</h2>
  <div class="card reveal">
    <p>The automated ETL script runs on a scheduled basis every Saturday at 12:00 AM to synchronize your overwrites from the hosted feature layer directly to the Central Database Feature Layer.</p>
    <p style="margin-top:10px;">After every scheduled run, the system automatically sends out a status email outlining the complete status of the ETL job, detailing all applied operations including Inserts, Updates, and Deletes.</p>
    
    <div style="margin-top: 15px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <img src="assets/salmonarm/10 ETL Process Verification Email.png" alt="ETL Verification Email" style="width: 100%; display: block;">
    </div>
  </div>
</section>`;

const FOOTER = `
</div><!-- /content-wrap -->

<footer class="site-footer">
  <img src="assets/salmonarm/SalmonArm.png" alt="Salmon Arm" style="max-height: 48px;">
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

const finalHTML = HEAD + SIDEBAR + HEADER + SEC1 + SEC2 + SEC3 + FOOTER;
fs.writeFileSync('c:\\Users\\solim\\Arcgis Notebooks\\docs\\guide-salmonarm.html', finalHTML, 'utf8');
console.log('✓ Created guide-salmonarm.html');

// Inject the Salmon Arm link into all existing HTML files.
const docsDir = 'c:\\Users\\solim\\Arcgis Notebooks\\docs';
const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.html') && f !== 'guide-salmonarm.html');

let count = 0;
for (const file of files) {
  const fPath = path.join(docsDir, file);
  let content = fs.readFileSync(fPath, 'utf8');

  if (content.includes('<a href="guide-revelstoke.html"') && !content.includes('guide-salmonarm.html')) {
    content = content.replace('<a href="guide-revelstoke.html" class="nav-indent"><i class="fas fa-city"></i> Revelstoke</a>',
      '<a href="guide-revelstoke.html" class="nav-indent"><i class="fas fa-city"></i> Revelstoke</a>\\n    <a href="guide-salmonarm.html" class="nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>');

    // Handle active class
    content = content.replace('<a href="guide-revelstoke.html" class="active nav-indent"><i class="fas fa-city"></i> Revelstoke</a>',
      '<a href="guide-revelstoke.html" class="active nav-indent"><i class="fas fa-city"></i> Revelstoke</a>\\n    <a href="guide-salmonarm.html" class="nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>');

    // Also check if golden was used to inject
    content = content.replace('<a href="guide-golden.html" class="active nav-indent"><i class="fas fa-city"></i> Golden</a>\\n    <a href="guide-revelstoke.html" class="nav-indent"><i class="fas fa-city"></i> Revelstoke</a>',
      '<a href="guide-golden.html" class="active nav-indent"><i class="fas fa-city"></i> Golden</a>\\n    <a href="guide-revelstoke.html" class="nav-indent"><i class="fas fa-city"></i> Revelstoke</a>\\n    <a href="guide-salmonarm.html" class="nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>');

    fs.writeFileSync(fPath, content, 'utf8');
    count++;
  }
}

// Update Documentation.html separately since it's in the root
const rootDocPath = 'c:\\Users\\solim\\Arcgis Notebooks\\Documentation.html';
if (fs.existsSync(rootDocPath)) {
  let content = fs.readFileSync(rootDocPath, 'utf8');

  // Add sidebar link
  if (content.includes('<a href="docs/guide-revelstoke.html"') && !content.includes('docs/guide-salmonarm.html')) {
    content = content.replace('<a href="docs/guide-revelstoke.html" class="nav-indent"><i class="fas fa-city"></i> Revelstoke</a>',
      '<a href="docs/guide-revelstoke.html" class="nav-indent"><i class="fas fa-city"></i> Revelstoke</a>\\n    <a href="docs/guide-salmonarm.html" class="nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>');
    fs.writeFileSync(rootDocPath, content, 'utf8');
  }
}

console.log('✓ Updated sidebars in ' + count + ' HTML files.');
