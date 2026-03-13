// docs/sync-app.js

window.initSyncAppModule = function() {
    console.log("Sync App initializing...");

    let targetLayerUrl = "";
    let sourceFeatures = [];
    let targetFeatures = [];
    let adds = [];
    let updates = [];
    let targetSchemaFields = [];
    let sourceSchemaFields = [];
    let sourceSpatialReference = null;
    
    // The base URL for the CSRD Hosted services
    // Using the same base from router.js: 'https://apps.csrd.bc.ca/arcgis/rest/services/Regional/NG911_Address_...'
    const csrdBaseUrl = "https://apps.csrd.bc.ca/arcgis/rest/services/Regional";

    function getTargetLayerName() {
        if (!window.csrdAuth || !window.csrdAuth.getUser()) return null;
        const userLower = window.csrdAuth.getUser().username.toLowerCase();
        
        if (userLower.includes('revelstoke')) return "NG911_Address_Revelstoke_Edit";
        if (userLower.includes('golden')) return "NG911_Address_Golden_Edit";
        if (userLower.includes('salmonarm')) return "NG911_Address_SalmonArm_Edit";
        if (userLower.includes('sicamous')) return "NG911_Address_Sicamous_Edit";
        if (window.csrdAuth.isAdmin()) return "NG911_Address_SalmonArm_Edit"; // default for admin testing
        return null;
    }

    function initUI() {
        const targetName = getTargetLayerName();
        if (targetName) {
            document.getElementById('sync-target-name').textContent = targetName;
            targetLayerUrl = `${csrdBaseUrl}/${targetName}/FeatureServer/0`;
        } else {
            document.getElementById('sync-target-name').textContent = "Unauthorized or Unknown Layer";
        }
    }

    // Require ArcGIS Modules
    require([
        "esri/Map",
        "esri/views/MapView",
        "esri/Graphic",
        "esri/layers/GraphicsLayer",
        "esri/request",
        "esri/identity/IdentityManager"
    ], function(Map, MapView, Graphic, GraphicsLayer, esriRequest, esriId) {

        initUI();

        // Register the existing auth.js token into the esri IdentityManager natively
        // This ensures esriRequest doesn't fail or prompt unnecessarily if the user pastes a CSRD URL.
        const csrdToken = window.csrdAuth.getToken();
        const expiresStr = localStorage.getItem('csrd_arcgis_expires');
        const userStr = localStorage.getItem('csrd_arcgis_user');

        if (csrdToken && expiresStr) {
            // Register for both standard root and REST root to be safe
            const expireTime = parseInt(expiresStr);
            esriId.registerToken({
                server: "https://apps.csrd.bc.ca/arcgis/rest/services",
                token: csrdToken,
                expires: expireTime
            });
            esriId.registerToken({
                server: "https://apps.csrd.bc.ca",
                token: csrdToken,
                expires: expireTime
            });
        }

        // 1. Initialize Map
        const map = new Map({
            basemap: "streets-vector"
        });

        const view = new MapView({
            container: "sync-map-view",
            map: map,
            center: [-118.196, 50.998], // default CSRD area (Revelstoke roughly)
            zoom: 8
        });

        const graphicsLayer = new GraphicsLayer();
        map.add(graphicsLayer);

        view.when(() => {
            console.log("Map View ready.");
        });

        // UI Elements
        const confirmBtn = document.getElementById('btn-sync-confirm');
        const analyzeBtn = document.getElementById('btn-sync-analyze');
        const executeBtn = document.getElementById('btn-sync-execute');
        const sourceInput = document.getElementById('sync-source-url');
        const overlay = document.getElementById('sync-map-overlay');
        const resultsPanel = document.getElementById('sync-results-panel');
        const logPanel = document.getElementById('sync-progress-log');

        function appendLog(msg, type = "info") {
            const p = document.createElement('div');
            p.className = `log-${type}`;
            p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            logPanel.appendChild(p);
            logPanel.scrollTop = logPanel.scrollHeight;
        }

        async function fetchAllFeatures(baseUrl, token = null, isSource = false) {
            let objIdUrl = `${baseUrl}/query?where=1=1&returnIdsOnly=true&f=json`;
            if (token) objIdUrl += `&token=${token}`;

            let objectIds = [];
            if (isSource) {
                try {
                    const res = await esriRequest(objIdUrl, { responseType: "json" });
                    objectIds = res.data.objectIds || [];
                } catch (reqErr) {
                    if (reqErr.message === "Failed to fetch") throw new Error("Network Error blocking the request via CORS or URL is unreachable.");
                    else if (reqErr.name === "identity-manager:not-authorized") throw new Error("Authentication failed for the municipal server.");
                    else throw reqErr;
                }
            } else {
                const res = await fetch(objIdUrl);
                const data = await res.json();
                if (data.error) throw new Error(data.error.message);
                objectIds = data.objectIds || [];
            }

            if (!objectIds.length) return [];

            const chunkSize = 1000;
            const features = [];
            
            for (let i = 0; i < objectIds.length; i += chunkSize) {
                const chunk = objectIds.slice(i, i + chunkSize);
                const whereClause = `OBJECTID IN (${chunk.join(',')})`;
                let dataUrl = `${baseUrl}/query`;
                
                if (isSource) {
                    const res = await esriRequest(dataUrl, {
                        query: { where: whereClause, outFields: "*", returnGeometry: "true", f: "json" },
                        responseType: "json"
                    });
                    sourceSpatialReference = res.data.spatialReference;
                    features.push(...(res.data.features || []));
                } else {
                    const formData = new URLSearchParams();
                    formData.append('where', whereClause);
                    formData.append('outFields', '*');
                    formData.append('returnGeometry', 'true');
                    formData.append('f', 'json');
                    if (token) formData.append('token', token);

                    const res = await fetch(dataUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: formData.toString()
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error.message);
                    features.push(...(data.features || []));
                }
            }
            return features;
        }

        const srcSelect = document.getElementById('sync-source-field');
        const tgtSelect = document.getElementById('sync-target-field');

        srcSelect.addEventListener('change', () => { if(sourceFeatures.length) runDiffEngine(); });
        tgtSelect.addEventListener('change', () => { if(targetFeatures.length) runDiffEngine(); });

        // Step 1: Verify URL & Fetch Schemas
        confirmBtn.addEventListener('click', async () => {
            let sourceUrl = sourceInput.value.trim();
            if (!sourceUrl) { alert("Please enter a valid Source Feature Service REST URL."); return; }
            if (sourceUrl.endsWith('/')) sourceUrl = sourceUrl.slice(0, -1);
            if (!targetLayerUrl) { alert("Target CSRD layer is unknown. Cannot proceed."); return; }

            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
            
            logPanel.innerHTML = '';
            resultsPanel.style.display = 'block';
            document.getElementById('sync-diff-table-container').style.display = 'none';

            try {
                // Fetch Target Schema
                appendLog(`Fetching Target schema from ${targetLayerUrl}...`, "info");
                const csrdToken = window.csrdAuth.getToken();
                const schemaResp = await fetch(`${targetLayerUrl}?f=json&token=${csrdToken}`);
                const schemaData = await schemaResp.json();
                if (schemaData.error) throw new Error(schemaData.error.message);
                targetSchemaFields = schemaData.fields.map(f => f.name);

                // Fetch Source Schema
                appendLog(`Fetching Source schema...`, "info");
                const srcSchemaResp = await esriRequest(`${sourceUrl}?f=json`, { responseType: "json" });
                sourceSchemaFields = srcSchemaResp.data.fields.map(f => f.name);

                // Populate Dropdowns
                srcSelect.innerHTML = ''; tgtSelect.innerHTML = '';
                sourceSchemaFields.forEach(f => { const o = document.createElement('option'); o.value = o.textContent = f; srcSelect.appendChild(o); });
                targetSchemaFields.forEach(f => { const o = document.createElement('option'); o.value = o.textContent = f; tgtSelect.appendChild(o); });
                
                const srcDefault = sourceSchemaFields.find(f => f.toLowerCase() === 'globalid' || f.toLowerCase() === 'site_nguid');
                if (srcDefault) srcSelect.value = srcDefault;
                const tgtDefault = targetSchemaFields.find(f => f.toLowerCase() === 'featureid');
                if (tgtDefault) tgtSelect.value = tgtDefault;

                srcSelect.disabled = false;
                tgtSelect.disabled = false;

                appendLog(`Schemas successfully linked. Ready to Extract Data.`, "success");
                analyzeBtn.disabled = false;

            } catch (err) {
                appendLog(`Verification Error: ${err.message}`, "error");
                console.error("Verification Error:", err);
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-check-circle"></i> Verify URL';
            }
        });

        // Step 2: Analyze & Compare (Fetch Data)
        analyzeBtn.addEventListener('click', async () => {
            let sourceUrl = sourceInput.value.trim();
            if (sourceUrl.endsWith('/')) sourceUrl = sourceUrl.slice(0, -1);
            const csrdToken = window.csrdAuth.getToken();

            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Data...';
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 300);
            
            try {

                // Paginated Fetch Target Data
                appendLog(`Fetching Target records (Paginated)...`, "info");
                targetFeatures = await fetchAllFeatures(targetLayerUrl, csrdToken, false);
                appendLog(`Loaded ${targetFeatures.length} Target records.`, "success");

                // Paginated Fetch Source Data via IdentityManager
                appendLog(`Fetching Source records (Paginated)...`, "info");
                sourceFeatures = await fetchAllFeatures(sourceUrl, null, true);
                appendLog(`Loaded ${sourceFeatures.length} Source records.`, "success");

                document.getElementById('sync-diff-table-container').style.display = 'block';
                runDiffEngine();

            } catch (err) {
                appendLog(`Error: ${err.message}`, "error");
                console.error("Analysis Error:", err);
            } finally {
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = '<i class="fas fa-magnifying-glass-chart"></i> Refresh Data';
            }
        });

        function runDiffEngine() {
            appendLog(`Running Cascading Match Engine...`, "info");
            adds = [];
            updates = [];
            let unchanged = 0;

            const targetMatchField = tgtSelect.value;
            const sourceMatchField = srcSelect.value;

            if (!targetMatchField || !sourceMatchField) {
                appendLog("Error: Match fields not selected.", "error");
                return;
            }

            const targetDict = {};
            targetFeatures.forEach(tf => {
                const fidKey = Object.keys(tf.attributes).find(k => k.toLowerCase() === targetMatchField.toLowerCase());
                if (fidKey && tf.attributes[fidKey]) {
                    targetDict[String(tf.attributes[fidKey]).toLowerCase()] = tf;
                }
            });

            const tbody = document.querySelector('#sync-diff-table tbody');
            tbody.innerHTML = '';

            sourceFeatures.forEach(sf => {
                const globalIdKey = Object.keys(sf.attributes).find(k => k.toLowerCase() === sourceMatchField.toLowerCase());
                const srcGlobalId = globalIdKey ? sf.attributes[globalIdKey] : null;
                
                const filteredAtts = {};
                for (const [key, val] of Object.entries(sf.attributes)) {
                    const matchedTargetField = targetSchemaFields.find(t => t.toLowerCase() === key.toLowerCase());
                    if (matchedTargetField && matchedTargetField.toLowerCase() !== 'objectid') {
                        filteredAtts[matchedTargetField] = val;
                    }
                }

                // Inject mapped ID
                const targetFidField = targetSchemaFields.find(t => t.toLowerCase() === targetMatchField.toLowerCase());
                if (targetFidField && srcGlobalId) {
                     filteredAtts[targetFidField] = srcGlobalId;
                }

                const preparedFeature = { attributes: filteredAtts, geometry: sf.geometry };
                let isAdd = false;
                let isUpdate = false;
                let changeStatus = "";
                let targetFeatureCache = null;

                if (srcGlobalId && targetDict[String(srcGlobalId).toLowerCase()]) {
                    const tf = targetDict[String(srcGlobalId).toLowerCase()];
                    targetFeatureCache = tf;
                    
                    const tObjId = targetSchemaFields.find(t => t.toLowerCase() === 'objectid');
                    const tGlobId = targetSchemaFields.find(t => t.toLowerCase() === 'globalid');
                    if (tObjId && tf.attributes[tObjId]) preparedFeature.attributes[tObjId] = tf.attributes[tObjId];
                    if (tGlobId && tf.attributes[tGlobId]) preparedFeature.attributes[tGlobId] = tf.attributes[tGlobId];

                    let isDifferent = false;
                    let changeLog = [];
                    for (const k in preparedFeature.attributes) {
                        const oldVal = tf.attributes[k];
                        const newVal = preparedFeature.attributes[k];
                        
                        // We only care if values are strictly different. Nulls and spaces require careful handling.
                        const oldStr = (oldVal === null || oldVal === undefined) ? "" : String(oldVal).trim();
                        const newStr = (newVal === null || newVal === undefined) ? "" : String(newVal).trim();

                        if (oldStr !== newStr) {
                            isDifferent = true;
                            // Prettify empty values
                            const displayOld = oldStr === "" ? "<i>(empty)</i>" : oldStr;
                            const displayNew = newStr === "" ? "<i>(empty)</i>" : newStr;
                            changeLog.push(`Change <b>${k}</b> from '${displayOld}' to '${displayNew}'`);
                        }
                    }
                    if (!isDifferent && preparedFeature.geometry && tf.geometry) {
                       if (preparedFeature.geometry.x !== tf.geometry.x || preparedFeature.geometry.y !== tf.geometry.y) {
                           isDifferent = true;
                           changeLog.push(`Update Location (Point Geometry)`);
                       }
                    }

                    if (isDifferent) { 
                        preparedFeature._changeLogHtml = `<ul style="margin-top:5px; padding-left:15px; font-weight:normal; font-size:0.75rem; color:var(--text-secondary); white-space:normal; list-style-type:circle;">${changeLog.map(l => `<li style="margin-bottom:3px;">${l}</li>`).join('')}</ul>`;
                        updates.push(preparedFeature); 
                        isUpdate = true; 
                        changeStatus = "Update applied"; 
                    }
                    else { unchanged++; }
                } else {
                    adds.push(preparedFeature);
                    isAdd = true;
                    changeStatus = "Inserted";
                }

                // Build Table Row if Add or Update
                if (isAdd || isUpdate) {
                    // Try to guess NGUID and Address fields for display
                    const nguidVal = sf.attributes[Object.keys(sf.attributes).find(k => k.toLowerCase().includes('nguid'))] || srcGlobalId || 'N/A';
                    const srcAddVal = sf.attributes[Object.keys(sf.attributes).find(k => k.toLowerCase().includes('full') || k.toLowerCase().includes('address'))] || 'Missing Address Field';
                    
                    let tgtAddVal = "N/A (New Record)";
                    if (isUpdate && targetFeatureCache) {
                        tgtAddVal = targetFeatureCache.attributes[Object.keys(targetFeatureCache.attributes).find(k => k.toLowerCase().includes('full') || k.toLowerCase().includes('address'))] || 'Missing Address Field';
                    }

                    let actionHtml = `<td style="color:#27ae60; font-weight:bold; vertical-align:top;"><i class="fas fa-plus-circle"></i> Inserted</td>`;
                    if (isUpdate) {
                        actionHtml = `<td style="vertical-align:top;">
                            <div style="color:#e67e22; font-weight:bold;"><i class="fas fa-pen"></i> Updated</div>
                            ${preparedFeature._changeLogHtml || ''}
                        </td>`;
                    }

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="vertical-align:top; font-family:var(--font-mono); font-size:0.8rem; color:var(--teal);">${nguidVal}</td>
                        <td style="vertical-align:top;">${srcAddVal}</td>
                        <td style="vertical-align:top;">${tgtAddVal}</td>
                        ${actionHtml}
                    `;
                    tbody.appendChild(tr);
                }
            });

            document.getElementById('stat-inserts').textContent = adds.length;
            document.getElementById('stat-updates').textContent = updates.length;
            document.getElementById('stat-unchanged').textContent = unchanged;
            appendLog(`Diff Complete: ${adds.length} Adds, ${updates.length} Updates, ${unchanged} Unchanged.`, "success");

            // Render Map
            graphicsLayer.removeAll();
            const addSymbol = { type: "simple-marker", color: [39, 174, 96, 0.8], outline: { color: [255, 255, 255], width: 1 } };
            const updateSymbol = { type: "simple-marker", color: [242, 153, 74, 0.8], outline: { color: [255, 255, 255], width: 1 } };
            const graphics = [];

            adds.forEach(f => {
                if (f.geometry) graphics.push(new Graphic({ geometry: { type: "point", x: f.geometry.x, y: f.geometry.y, spatialReference: sourceSpatialReference }, attributes: f.attributes, symbol: addSymbol, popupTemplate: { title: "New Feature", content: "{*}" } }));
            });
            updates.forEach(f => {
                if (f.geometry) graphics.push(new Graphic({ geometry: { type: "point", x: f.geometry.x, y: f.geometry.y, spatialReference: sourceSpatialReference }, attributes: f.attributes, symbol: updateSymbol, popupTemplate: { title: "Updated Feature", content: "{*}" } }));
            });

            graphicsLayer.addMany(graphics);
            if (graphics.length > 0) view.goTo(graphics);

            if (adds.length > 0 || updates.length > 0) executeBtn.disabled = false;
            else executeBtn.disabled = true;
        }

        // 3. Execute Sync
        executeBtn.addEventListener('click', async () => {
            if (!confirm(`Are you sure you want to apply ${adds.length} inserts and ${updates.length} updates to ${getTargetLayerName()}?`)) {
                return;
            }

            executeBtn.disabled = true;
            executeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing...';
            appendLog("Executing ApplyEdits payload...", "info");

            const csrdToken = window.csrdAuth.getToken();
            const applyEditsUrl = `${targetLayerUrl}/applyEdits`;

            // Prepare chunks if needed, but for now apply at once
            const payload = {
                f: "json",
                token: csrdToken,
                adds: JSON.stringify(adds),
                updates: JSON.stringify(updates),
                useGlobalIds: false
            };

            const formData = new URLSearchParams();
            for (const key in payload) {
                formData.append(key, payload[key]);
            }

            try {
                const response = await fetch(applyEditsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData.toString()
                });

                const data = await response.json();
                if (data.error) throw new Error(data.error.message);

                let addSuccess = 0;
                let addFail = 0;
                let updateSuccess = 0;
                let updateFail = 0;

                if (data.addResults) {
                    data.addResults.forEach(r => r.success ? addSuccess++ : addFail++);
                }
                if (data.updateResults) {
                    data.updateResults.forEach(r => r.success ? updateSuccess++ : updateFail++);
                }

                appendLog(`Sync completed on Server.`, "success");
                appendLog(`Adds: ${addSuccess} successful, ${addFail} failed.`, addFail > 0 ? "error" : "info");
                appendLog(`Updates: ${updateSuccess} successful, ${updateFail} failed.`, updateFail > 0 ? "error" : "info");

                // Disable button to prevent double execution
                executeBtn.disabled = true;

            } catch (err) {
                appendLog(`Sync Failed: ${err.message}`, "error");
            } finally {
                executeBtn.innerHTML = '<i class="fas fa-check"></i> Sync Finished';
            }
        });

    });

};

// Auto-execute if loaded directly
if (document.getElementById('sync-map-view')) {
    window.initSyncAppModule();
}
