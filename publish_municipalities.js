const fs = require('fs');
const path = require('path');

const srcDir = '.';
const distDir = path.join(srcDir, 'dist');

const municipalities = [
    {
        id: 'revelstoke',
        name: 'Revelstoke',
        guideFile: 'guide-revelstoke.html',
        pdfName: 'Revelstoke_NG911_Central_Addressing_User_Guide.pdf',
        assetsFolder: 'assets/revelstoke'
    },
    {
        id: 'golden',
        name: 'Golden',
        guideFile: 'guide-golden.html',
        pdfName: 'Golden_NG911_Central_Addressing_User_Guide.pdf',
        assetsFolder: 'assets/golden'
    },
    {
        id: 'salmonarm',
        name: 'Salmon Arm',
        guideFile: 'guide-salmonarm.html',
        pdfName: 'Salmon_Arm_NG911_Central_Addressing_User_Guide.pdf',
        assetsFolder: 'assets/salmonarm'
    },
    {
        id: 'sicamous',
        name: 'Sicamous',
        guideFile: 'guide-sicamous.html',
        pdfName: 'Sicamous_NG911_Central_Addressing_User_Guide.pdf',
        assetsFolder: 'assets/sicamous'
    }
];

const docsSourceDir = path.join(srcDir, 'docs');
const allRulePages = fs.readdirSync(docsSourceDir).filter(f => f.startsWith('rule-') && f.endsWith('.html'));

const sharedFiles = [
    'schema-guide.html',
    'attribute-rules.html',
    'domains.html',
    ...allRulePages
];

const dependencies = [
    { src: 'csrd-logo.png', dest: 'csrd-logo.png' },
    { src: 'docs/shared.css', dest: 'docs/shared.css' },
    { src: 'docs/hero-illustration.png', dest: 'docs/hero-illustration.png' },
    { src: 'docs/editor-core.js', dest: 'docs/editor-core.js' },
    { src: 'docs/search-core.js', dest: 'docs/search-core.js' },
    { src: 'docs/search-data.js', dest: 'docs/search-data.js' },
    { src: 'DownloadFiles/SSAP_Schema.json', dest: 'DownloadFiles/SSAP_Schema.json' }
];

function copyFileSync(source, target) {
    let targetFile = target;
    if (fs.existsSync(target)) {
        if (fs.lstatSync(target).isDirectory()) {
            targetFile = path.join(target, path.basename(source));
        }
    }
    fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync(source, target) {
    let files = [];
    let targetFolder = path.join(target, path.basename(source));
    if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });

    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(function (file) {
            var curSource = path.join(source, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, targetFolder);
            } else {
                copyFileSync(curSource, targetFolder);
            }
        });
    }
}

// Ensure base dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

municipalities.forEach(muni => {
    console.log(`Building isolated portal for ${muni.name}...`);

    const muniDir = path.join(distDir, muni.id);
    const muniDocsDir = path.join(muniDir, 'docs');
    const muniDownloadsDir = path.join(muniDir, 'DownloadFiles');

    // Create necessary folders
    [muniDir, muniDocsDir, muniDownloadsDir].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    // Create root index.html redirect
    const redirectHtml = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=docs/${muni.guideFile}" /><title>${muni.name} Portal Redirect</title></head><body>Redirecting to User Guide...</body></html>`;
    fs.writeFileSync(path.join(muniDir, 'index.html'), redirectHtml, 'utf8');

    // Copy general dependencies
    dependencies.forEach(dep => {
        const sPath = path.join(srcDir, dep.src);
        const dPath = path.join(muniDir, dep.dest);
        if (fs.existsSync(sPath)) {
            const dir = path.dirname(dPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            copyFileSync(sPath, dPath);
        }
    });

    // Copy specific assets folder and PDF
    const assetSource = path.join(srcDir, 'docs', muni.assetsFolder);
    if (fs.existsSync(assetSource)) {
        copyFolderRecursiveSync(assetSource, path.join(muniDocsDir, 'assets'));
    }
    const pdfSource = path.join(srcDir, 'DownloadFiles', muni.pdfName);
    if (fs.existsSync(pdfSource)) {
        copyFileSync(pdfSource, path.join(muniDownloadsDir, muni.pdfName));
    }

    // Read and override HTML files
    const allHtmlFiles = [muni.guideFile, ...sharedFiles];

    allHtmlFiles.forEach(file => {
        const srcPath = path.join(srcDir, 'docs', file);
        if (fs.existsSync(srcPath)) {
            let content = fs.readFileSync(srcPath, 'utf8');

            // Generate customized sidebar for this municipality
            const getActive = (target) => file === target ? "active nav-indent" : "nav-indent";

            const municipalSidebar = `
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <img src="../csrd-logo.png" alt="NG911 CSRD Logo">
      <h2>${muni.name} Portal</h2>
    </div>
    <nav class="sidebar-nav">
      <a href="${muni.guideFile}" class="${file === muni.guideFile ? 'active' : ''}"><i class="fas fa-home"></i> User Guide</a>
      <div class="nav-group-label" style="margin-top:20px;">Technical References</div>
      <a href="schema-guide.html" class="${getActive('schema-guide.html')}"><i class="fas fa-table-columns"></i> Schema Guide</a>
      <a href="attribute-rules.html" class="${getActive('attribute-rules.html')}"><i class="fas fa-wand-magic-sparkles"></i> Attribute Rules</a>
      <a href="domains.html" class="${getActive('domains.html')}"><i class="fas fa-list-check"></i> Domains</a>
    </nav>
    <div class="sidebar-footer">CSRD NG911 &copy; 2026 &middot; Pacific Tech Systems</div>
  </aside>`;

            // Replace existing sidebar using a simple regex
            content = content.replace(/<aside class="sidebar" id="sidebar">[\s\S]*?<\/aside>/, municipalSidebar);

            // Hide the breadcrumb section if they are on a shared page, so they don't see "Technical Documentation" parent links
            if (file !== muni.guideFile) {
                content = content.replace(/<div class="breadcrumb">[\s\S]*?<\/div>/, `<div class="breadcrumb"><span class="current">${muni.name} Reference</span></div>`);
            } else {
                content = content.replace(/<div class="breadcrumb">[\s\S]*?<\/div>/, `<div class="breadcrumb"><span class="current">${muni.name} User Guide</span></div>`);
            }

            fs.writeFileSync(path.join(muniDocsDir, file), content, 'utf8');
        }
    });

    console.log(`✓ ${muni.name} Portal isolated and built successfully in dist/${muni.id}`);
});
console.log('✓ All municipal distributions updated.');
