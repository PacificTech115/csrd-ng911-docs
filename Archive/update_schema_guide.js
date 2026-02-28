const fs = require('fs');

let html = fs.readFileSync('docs/schema-guide.html', 'utf8');

const target = `<h2 class="reveal">Scope</h2>`;
const replacement = `<div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:12px;" class="reveal">
    <h2 style="margin:0;">Scope</h2>
    <a href="../DownloadFiles/SSAP_Schema.json" class="btn-resource btn-primary" download style="display:inline-flex; align-items:center; gap:8px; padding:6px 14px; border-radius:6px; background:var(--teal); color:white; text-decoration:none; font-size:0.85rem; font-weight:600; transition:all 0.2s; box-shadow:var(--shadow-sm);"><i class="fas fa-download"></i> Download JSON</a>
  </div>`;

if (html.includes(target)) {
    html = html.replace(target, replacement);
    fs.writeFileSync('docs/schema-guide.html', html, 'utf8');
    console.log("Replaced successfully!");
} else {
    console.log("Target not found!");
}
