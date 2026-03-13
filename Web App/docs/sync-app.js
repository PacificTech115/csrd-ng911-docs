// docs/sync-app.js

window.initSyncAppModule = function() {
    console.log("Sync App initializing...");

    let targetLayerUrl = "";
    let sourceFeatures = [];
    let targetFeatures = [];
    let adds = [];
    let updates = [];
    let targetSchemaFields = [];
    
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

        // 2. Analyze & Compare
        analyzeBtn.addEventListener('click', async () => {
            let sourceUrl = sourceInput.value.trim();
            if (!sourceUrl) {
                alert("Please enter a valid Source Feature Service REST URL.");
                return;
            }

            // Strip trailing slash if present
            if (sourceUrl.endsWith('/')) sourceUrl = sourceUrl.slice(0, -1);

            if (!targetLayerUrl) {
                alert("Target CSRD layer is unknown. Cannot proceed.");
                return;
            }

            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 300);
            
            logPanel.innerHTML = '';
            appendLog("Starting Analysis...", "info");
            resultsPanel.style.display = 'block';

            try {
                // Fetch Target Schema to drop extra fields
                appendLog(`Fetching Target schema from ${targetLayerUrl}...`, "info");
                const csrdToken = window.csrdAuth.getToken();
                const targetSchemaUrl = `${targetLayerUrl}?f=json&token=${csrdToken}`;
                const schemaResp = await fetch(targetSchemaUrl);
                const schemaData = await schemaResp.json();
                
                if (schemaData.error) throw new Error(schemaData.error.message);
                
                targetSchemaFields = schemaData.fields.map(f => f.name);
                appendLog(`Loaded Target schema with ${targetSchemaFields.length} fields.`, "success");

                // Fetch Target Data
                appendLog(`Fetching Target records...`, "info");
                const targetQueryUrl = `${targetLayerUrl}/query?where=1=1&outFields=*&returnGeometry=true&f=json&token=${csrdToken}`;
                const tQueryResp = await fetch(targetQueryUrl);
                const tQueryData = await tQueryResp.json();
                if (tQueryData.error) throw new Error(tQueryData.error.message);
                targetFeatures = tQueryData.features || [];
                appendLog(`Loaded ${targetFeatures.length} Target records.`, "success");

                // Fetch Source Data using esriRequest to trigger IdentityManager for cross-origin auth
                appendLog(`Fetching Source records via IdentityManager...`, "info");
                const sourceQueryUrl = `${sourceUrl}/query`;
                let sQueryData;
                
                try {
                    sQueryData = await esriRequest(sourceQueryUrl, {
                        query: {
                            where: "1=1",
                            outFields: "*",
                            returnGeometry: "true",
                            f: "json"
                        },
                        responseType: "json"
                    });
                } catch (reqErr) {
                    // IdentityManager throws specific errors, but "Failed to fetch" is a raw network error, usually CORS.
                    if (reqErr.message === "Failed to fetch") {
                        throw new Error("Network Error blocking the request. The municipal server is actively blocking apps.csrd.bc.ca via CORS (Cross-Origin Resource Sharing) or the URL is unreachable.");
                    } else if (reqErr.name === "identity-manager:not-authorized") {
                        throw new Error("Authentication failed or was canceled for the municipal server.");
                    } else {
                        throw reqErr;
                    }
                }

                sourceFeatures = sQueryData.data.features || [];
                appendLog(`Loaded ${sourceFeatures.length} Source records.`, "success");

                // --- DIFF ENGINE ---
                appendLog(`Running Cascading Match Engine...`, "info");
                adds = [];
                updates = [];
                let unchanged = 0;

                // Build lookup for Target Features by Featureid
                const targetDict = {};
                targetFeatures.forEach(tf => {
                    // Make search case-insensitive for field names
                    const fidKey = Object.keys(tf.attributes).find(k => k.toLowerCase() === 'featureid');
                    if (fidKey && tf.attributes[fidKey]) {
                        targetDict[String(tf.attributes[fidKey]).toLowerCase()] = tf;
                    }
                });

                sourceFeatures.forEach(sf => {
                    const globalIdKey = Object.keys(sf.attributes).find(k => k.toLowerCase() === 'globalid');
                    const srcGlobalId = globalIdKey ? sf.attributes[globalIdKey] : null;
                    
                    // Filter Source Attributes to match Target Schema
                    const filteredAtts = {};
                    for (const [key, val] of Object.entries(sf.attributes)) {
                        const matchedTargetField = targetSchemaFields.find(t => t.toLowerCase() === key.toLowerCase());
                        if (matchedTargetField && matchedTargetField.toLowerCase() !== 'objectid') {
                            filteredAtts[matchedTargetField] = val;
                        }
                    }

                    // Map Source GlobalID to Target FeatureID
                    const targetFidField = targetSchemaFields.find(t => t.toLowerCase() === 'featureid');
                    if (targetFidField && srcGlobalId) {
                         filteredAtts[targetFidField] = srcGlobalId;
                    }

                    const preparedFeature = {
                        attributes: filteredAtts,
                        geometry: sf.geometry
                    };

                    if (srcGlobalId && targetDict[String(srcGlobalId).toLowerCase()]) {
                        // Exists in target -> Update. We must inject the Target's objectid so applyEdits knows what to update
                        const tf = targetDict[String(srcGlobalId).toLowerCase()];
                        
                        const targetObjectIdField = targetSchemaFields.find(t => t.toLowerCase() === 'objectid');
                        const targetGlobalIdField = targetSchemaFields.find(t => t.toLowerCase() === 'globalid');
                        
                        if (targetObjectIdField && tf.attributes[targetObjectIdField]) {
                            preparedFeature.attributes[targetObjectIdField] = tf.attributes[targetObjectIdField];
                        }
                        // Restore target's actual globalid so it doesn't try to change it
                        if (targetGlobalIdField && tf.attributes[targetGlobalIdField]) {
                            preparedFeature.attributes[targetGlobalIdField] = tf.attributes[targetGlobalIdField];
                        }

                        // Check if fields actually changed (basic diff)
                        // This prevents sending unneeded updates
                        let isDifferent = false;
                        for (const k in preparedFeature.attributes) {
                            if (preparedFeature.attributes[k] !== tf.attributes[k]) {
                                isDifferent = true;
                                break;
                            }
                        }
                        
                        // Compare primitive geometry (only x/y wrapper for points)
                        if (!isDifferent && preparedFeature.geometry && tf.geometry) {
                           if (preparedFeature.geometry.x !== tf.geometry.x || preparedFeature.geometry.y !== tf.geometry.y) {
                               isDifferent = true;
                           }
                        }

                        if (isDifferent) {
                            updates.push(preparedFeature);
                        } else {
                            unchanged++;
                        }

                    } else {
                        // Does not exist -> Add
                        adds.push(preparedFeature);
                    }
                });

                document.getElementById('stat-inserts').textContent = adds.length;
                document.getElementById('stat-updates').textContent = updates.length;
                document.getElementById('stat-unchanged').textContent = unchanged;
                
                appendLog(`Diff Complete: ${adds.length} Adds, ${updates.length} Updates, ${unchanged} Unchanged.`, "success");

                // Render on Map
                graphicsLayer.removeAll();
                
                const addSymbol = {
                    type: "simple-marker",
                    color: [39, 174, 96, 0.8],
                    outline: { color: [255, 255, 255], width: 1 }
                };

                const updateSymbol = {
                    type: "simple-marker",
                    color: [242, 153, 74, 0.8],
                    outline: { color: [255, 255, 255], width: 1 }
                };

                const graphics = [];

                adds.forEach(f => {
                    if (f.geometry) {
                        graphics.push(new Graphic({
                            geometry: { type: "point", x: f.geometry.x, y: f.geometry.y, spatialReference: sQueryData.data.spatialReference },
                            attributes: f.attributes,
                            symbol: addSymbol,
                            popupTemplate: { title: "New Feature", content: "{*}" }
                        }));
                    }
                });

                updates.forEach(f => {
                    if (f.geometry) {
                        graphics.push(new Graphic({
                            geometry: { type: "point", x: f.geometry.x, y: f.geometry.y, spatialReference: sQueryData.data.spatialReference },
                            attributes: f.attributes,
                            symbol: updateSymbol,
                            popupTemplate: { title: "Updated Feature", content: "{*}" }
                        }));
                    }
                });

                graphicsLayer.addMany(graphics);
                if (graphics.length > 0) {
                    view.goTo(graphics);
                }

                if (adds.length > 0 || updates.length > 0) {
                    executeBtn.disabled = false;
                }

            } catch (err) {
                appendLog(`Error: ${err.message}`, "error");
                console.error("Analysis Error:", err);
            } finally {
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = '<i class="fas fa-magnifying-glass-chart"></i> Analyze & Compare';
            }
        });

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
