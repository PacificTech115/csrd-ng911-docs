/**
 * update_docs.js
 * 1. Fix Notebooks card layout (automation-scripts.html)
 * 2. Embed full GP source code (script-qa.html, script-reconcile.html, script-export.html)
 * 3. Embed Power Automate email templates (power-automate.html)
 */
const fs = require('fs');
const path = require('path');

const DOCS = 'c:\\Users\\solim\\Arcgis Notebooks\\docs';
const DB_AUTO = 'c:\\Users\\solim\\Arcgis Notebooks\\Database Automation';

// Helper: HTML-escape text for embedding in <pre> blocks
function esc(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ──────────────────────────────────────────────────────────────
// TASK 1: Fix the Notebooks card layout
// ──────────────────────────────────────────────────────────────
(function fixNotebooksLayout() {
    const file = path.join(DOCS, 'automation-scripts.html');
    let html = fs.readFileSync(file, 'utf8');

    // The cards are currently in a grid-2 which can cause overflow. 
    // Let's switch to a single-column stack for better readability of the dependency chips.
    html = html.replace(
        '<div class="grid-2" style="margin-top:16px">',
        '<div style="display:flex;flex-direction:column;gap:16px;margin-top:16px">'
    );

    fs.writeFileSync(file, html, 'utf8');
    console.log('✓ Fixed Notebooks card layout');
})();


// ──────────────────────────────────────────────────────────────
// TASK 2: Embed full GP source code
// ──────────────────────────────────────────────────────────────
const gpTools = [
    {
        htmlFile: 'script-qa.html',
        pyFile: path.join(DB_AUTO, '1.ReconcilePost-QA-Export', 'QASSAPGPtool.py'),
        label: 'QASSAPGPtool.py',
        lines: 870
    },
    {
        htmlFile: 'script-reconcile.html',
        pyFile: path.join(DB_AUTO, '1.ReconcilePost-QA-Export', 'ReconcilePostGPtool.py'),
        label: 'ReconcilePostGPtool.py',
        lines: 240
    },
    {
        htmlFile: 'script-export.html',
        pyFile: path.join(DB_AUTO, '1.ReconcilePost-QA-Export', 'ExportGPtool.py'),
        label: 'ExportGPtool.py',
        lines: 148
    }
];

gpTools.forEach(tool => {
    const htmlPath = path.join(DOCS, tool.htmlFile);
    let html = fs.readFileSync(htmlPath, 'utf8');
    const pySrc = fs.readFileSync(tool.pyFile, 'utf8');
    const lineCount = pySrc.split('\n').length;

    // Build the full source code section HTML
    const fullSourceSection = `
<!-- FULL SOURCE CODE (auto-embedded) -->
<section>
  <h2 class="reveal"><i class="fas fa-file-code"></i>&nbsp; Full Source Code</h2>
  <div class="doc-meta reveal">
    <span><i class="fas fa-ruler-horizontal"></i> ${lineCount} lines</span>
    <span><i class="fas fa-file"></i> ${tool.label}</span>
  </div>
  <button class="doc-toggle reveal" type="button" data-target="fullsrc-${tool.htmlFile.replace('.html', '')}" aria-expanded="false">
    <i class="fas fa-chevron-right"></i><span>Show full source (${lineCount} lines)</span>
  </button>
  <div id="fullsrc-${tool.htmlFile.replace('.html', '')}" class="doc-body collapsed">
    <div class="code-block">
      <div class="code-header"><span>Python — ${tool.label}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
      <pre>${esc(pySrc)}</pre>
    </div>
  </div>
</section>
`;

    // Strategy: Find the existing "Full Source Code" section and replace it,
    // OR find the section comment marker and replace it.
    // The pages have various structures. Let's look for any section containing "Full Source Code"

    // Try to find existing full source section boundary
    const existingStart = html.indexOf('<!-- FULL SOURCE CODE');
    if (existingStart !== -1) {
        // Find the end of this section  
        const afterStart = html.indexOf('</section>', existingStart);
        const endIdx = afterStart + '</section>'.length;
        html = html.substring(0, existingStart) + fullSourceSection + html.substring(endIdx);
        console.log(`✓ Replaced existing full source in ${tool.htmlFile}`);
    } else {
        // Look for `Full Source Code` in an h2 tag
        const h2Idx = html.indexOf('Full Source Code');
        if (h2Idx !== -1) {
            // Find the section wrapper - go back to find <section>
            let sectionStart = html.lastIndexOf('<section>', h2Idx);
            let sectionEnd = html.indexOf('</section>', h2Idx) + '</section>'.length;
            html = html.substring(0, sectionStart) + fullSourceSection + html.substring(sectionEnd);
            console.log(`✓ Replaced h2-based full source in ${tool.htmlFile}`);
        } else {
            // Insert before the closing </div><!-- /content-wrap --> 
            const insertPoint = html.indexOf('</div><!-- /content-wrap -->');
            if (insertPoint !== -1) {
                html = html.substring(0, insertPoint) + fullSourceSection + '\n' + html.substring(insertPoint);
                console.log(`✓ Appended full source to ${tool.htmlFile}`);
            } else {
                console.log(`⚠ Could not find insertion point in ${tool.htmlFile}`);
            }
        }
    }

    fs.writeFileSync(htmlPath, html, 'utf8');
});


// ──────────────────────────────────────────────────────────────
// TASK 3: Embed Power Automate email templates
// ──────────────────────────────────────────────────────────────
(function embedEmailTemplates() {
    const paFile = path.join(DOCS, 'power-automate.html');
    let html = fs.readFileSync(paFile, 'utf8');

    const template1 = fs.readFileSync(
        path.join(DB_AUTO, '1.ReconcilePost-QA-Export', 'PowerautomateEmail-Reconcile-QA-Reconcile-Export.html'), 'utf8'
    );
    const template2 = fs.readFileSync(
        path.join(DB_AUTO, '2. Salmon Arm Sync', 'PowerautomateEmail-SalmonArmsync.html'), 'utf8'
    );

    // Build the email template sections
    const emailSection = `
<!-- EMAIL BODY TEMPLATES -->
<section>
  <h3 class="reveal">Email Body Templates</h3>
  <p class="reveal" style="margin-bottom:16px;">These are the actual HTML email body templates used inside the Power Automate flows. They contain inline Power Automate expressions (<code>@{...}</code>) that dynamically populate values from the JSON payload at runtime.</p>

  <!-- Nightly Pipeline Template -->
  <div class="card reveal" style="margin-bottom:18px;">
    <div class="card-header">
      <div class="card-icon teal"><i class="fas fa-file-code"></i></div>
      <h4>Nightly Pipeline Email Template</h4>
    </div>
    <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:10px;">
      Used by: <strong>1.NG911-Reconcile Municipal -QA- Reconcile Default</strong> flow.<br>
      Contains status badge, QA counters, detail tables, blocking feature samples, issues-by-agency breakdown, pipeline stage results, and output file links.
    </p>
    <button class="doc-toggle" type="button" data-target="email-tpl-nightly" aria-expanded="false">
      <i class="fas fa-chevron-right"></i><span>Show template (${template1.split('\n').length} lines)</span>
    </button>
    <div id="email-tpl-nightly" class="doc-body collapsed">
      <div class="code-block">
        <div class="code-header"><span>HTML — Power Automate Body</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
        <pre>${esc(template1)}</pre>
      </div>
    </div>
  </div>

  <!-- Salmon Arm Sync Template -->
  <div class="card reveal">
    <div class="card-header">
      <div class="card-icon blue"><i class="fas fa-file-code"></i></div>
      <h4>Salmon Arm Sync Email Template</h4>
    </div>
    <p style="font-size:.85rem;color:var(--text-secondary);margin-bottom:10px;">
      Used by: <strong>2.NG911-SalmonArmETL</strong> flow.<br>
      Contains status badge, source/target layer info, record matching details, operations table (inserts/updates/deletes), failure count, reverse ID sync status, and a quick summary.
    </p>
    <button class="doc-toggle" type="button" data-target="email-tpl-salmon" aria-expanded="false">
      <i class="fas fa-chevron-right"></i><span>Show template (${template2.split('\n').length} lines)</span>
    </button>
    <div id="email-tpl-salmon" class="doc-body collapsed">
      <div class="code-block">
        <div class="code-header"><span>HTML — Power Automate Body</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
        <pre>${esc(template2)}</pre>
      </div>
    </div>
  </div>
</section>
`;

    // Insert before the HOW IT WORKS section
    const howItWorks = html.indexOf('<!-- HOW IT WORKS -->');
    if (howItWorks !== -1) {
        html = html.substring(0, howItWorks) + emailSection + '\n' + html.substring(howItWorks);
        console.log('✓ Embedded email templates in power-automate.html');
    } else {
        // Fallback: insert before closing content-wrap
        const insertPoint = html.indexOf('</div><!-- /content-wrap -->');
        if (insertPoint !== -1) {
            html = html.substring(0, insertPoint) + emailSection + '\n' + html.substring(insertPoint);
            console.log('✓ Embedded email templates (fallback) in power-automate.html');
        }
    }

    fs.writeFileSync(paFile, html, 'utf8');
})();

console.log('\n✅ All documentation updates complete!');
