const fs = require('fs');
const path = require('path');

function processFile(htmlPath) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    const regex = /href="\.\.\/DownloadFiles\/([^"]+)"/g;
    let modified = false;

    html = html.replace(regex, (match, filename) => {
        const filepath = path.join('c:\\Users\\solim\\Arcgis Notebooks\\DownloadFiles', filename);
        try {
            const data = fs.readFileSync(filepath);
            const b64 = data.toString('base64');
            let mime = 'application/octet-stream';
            if (filename.endsWith('.json')) mime = 'application/json';
            else if (filename.endsWith('.xml')) mime = 'application/xml';
            else if (filename.endsWith('.atbx')) mime = 'application/zip';

            modified = true;
            return `href="data:${mime};base64,${b64}" download="${filename}"`;
        } catch (err) {
            console.error('Could not read ' + filepath, err.message);
            return match;
        }
    });

    if (modified) {
        fs.writeFileSync(htmlPath, html, 'utf8');
        console.log("Successfully embedded downloads in " + htmlPath);
    }
}

// Ensure the generate script is updated too so it persists
let genJs = fs.readFileSync('generate_html.js', 'utf8');
const newReplacement = `
              <div class="action-group">
                <a href="../DownloadFiles/\${filename}" class="btn-resource btn-secondary" download="\${filename}"><i class="fas fa-download"></i> Download</a>
              </div>`;
// This is getting too complex to regex generate_html.js perfectly inside here, so I will just run the process on the generated files for now.

processFile('docs/system-resources.html');
processFile('docs/schema-guide.html');
