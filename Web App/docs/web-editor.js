import { config } from './config.js';
import { auth } from './auth.js?v=3';

export async function initWebEditor() {
    const user = auth.getUser();
    if (!user) {
        document.getElementById('we-status').innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--red);"></i> Not logged in';
        document.getElementById('we-loading').innerHTML = '<h2>Authentication Required</h2><p>Please log in to access the Web Editor.</p>';
        return;
    }

    const uName = user.username.toLowerCase();
    
    // Determine municipality service
    let muniKey = null;
    let muniLabel = '';
    
    if (uName.includes('revelstoke')) { muniKey = 'revelstoke'; muniLabel = 'Revelstoke'; }
    else if (uName.includes('golden')) { muniKey = 'golden'; muniLabel = 'Golden'; }
    else if (uName.includes('salmonarm') || uName.includes('salmon_arm')) { muniKey = 'salmonarm'; muniLabel = 'Salmon Arm'; }
    else if (uName.includes('sicamous')) { muniKey = 'sicamous'; muniLabel = 'Sicamous'; }
    
    // Admins default to Revelstoke testing, or valid route
    if (!muniKey && (auth.isAdmin && auth.isAdmin())) {
        muniKey = 'revelstoke'; 
        muniLabel = 'Revelstoke (Admin Default)';
    }

    if (!muniKey) {
        document.getElementById('we-loading').innerHTML = `<h2>Access Denied</h2><p>Your account '<b>${user.username}</b>' does not have an associated municipal edit service configured.</p>`;
        document.getElementById('we-status').innerHTML = '<i class="fas fa-ban" style="color:var(--red);"></i> Unauthorized';
        return;
    }

    const serviceUrl = config.services.municipalEdit[muniKey];
    if (!serviceUrl) {
        document.getElementById('we-loading').innerHTML = `<h2>Configuration Error</h2><p>Could not find the service endpoint for ${muniLabel}.</p>`;
        return;
    }

    // Update UI headers
    document.getElementById('we-title').textContent = `${muniLabel} Address Editor`;

    try {
        require([
            "esri/identity/IdentityManager",
            "esri/Map",
            "esri/views/MapView",
            "esri/layers/FeatureLayer",
            "esri/widgets/Editor",
            "esri/widgets/Home",
            "esri/widgets/BasemapToggle",
            "esri/widgets/FeatureTable",
            "esri/widgets/Search"
        ], function(IdentityManager, Map, MapView, FeatureLayer, Editor, Home, BasemapToggle, FeatureTable, Search) {
            
            // Register OAuth token to bypass ArcGIS Server prompts
            const token = auth.getToken();
            if (token) {
                IdentityManager.registerToken({
                    server: config.portalUrl,
                    token: token
                });
                IdentityManager.registerToken({
                    server: config.arcgisRestBase,
                    token: token
                });
            }

            // Initialize Map
            const map = new Map({
                basemap: "topo-vector"
            });

            // View container matching the HTML id
            const view = new MapView({
                container: "viewDiv",
                map: map,
                zoom: 12,
                center: [-119.5, 50.8] // Rough CSRD area default
            });

            // The specific Municipal Edit Layer
            const editLayer = new FeatureLayer({
                url: serviceUrl,
                title: `${muniLabel} Addressing`,
                outFields: ["*"] // Fetch all fields for the editor
            });

            map.add(editLayer);

            view.when(() => {
                editLayer.when(() => {
                    // Zoom conditionally to the layer's extent once loaded, if it is valid
                    if(editLayer.fullExtent) {
                        view.goTo(editLayer.fullExtent);
                    }
                    
                    // Add Editor Widget
                    const editor = new Editor({
                        view: view,
                        layerInfos: [{
                            layer: editLayer,
                            enabled: true,
                            addEnabled: true,
                            updateEnabled: true,
                            deleteEnabled: true
                        }]
                    });
                    view.ui.add(editor, "top-right");

                    // Add Search Widget
                    const searchWidget = new Search({
                        view: view,
                        allPlaceholder: "Find address or NGUID",
                        includeDefaultSources: false,
                        sources: [{
                            layer: editLayer,
                            searchFields: ["Full_Addr", "NGUID"],
                            displayField: "Full_Addr",
                            exactMatch: false,
                            outFields: ["*"],
                            name: `${muniLabel} Addresses`,
                            placeholder: "Search by Full Address or NGUID"
                        }]
                    });
                    // Put it in the top right, but secondary to the Editor maybe, or put it top-leading
                    view.ui.add(searchWidget, {
                        position: "top-left",
                        index: 0
                    });
                    
                    const homeWidget = new Home({ view: view });
                    view.ui.add(homeWidget, "top-left");
                    
                    const basemapToggle = new BasemapToggle({
                        view: view,
                        nextBasemap: "hybrid"
                    });
                    view.ui.add(basemapToggle, "bottom-right");

                    // Add Feature Table
                    const featureTable = new FeatureTable({
                        view: view,
                        layer: editLayer,
                        container: "tableDiv",
                        editingEnabled: true,
                        visibleElements: {
                            selectionColumn: true,
                            menuItems: {
                                clearSelection: true,
                                refreshData: true,
                                toggleColumns: true,
                            }
                        }
                    });

                    // Table Toggle Interaction Logic
                    const toggleBtn = document.getElementById('btn-toggle-table');
                    const tableSection = document.getElementById('table-section');
                    const btnText = document.getElementById('btn-toggle-table-text');
                    
                    if (toggleBtn && tableSection) {
                        // Enable the button since data is ready
                        toggleBtn.style.opacity = '1';
                        toggleBtn.style.pointerEvents = 'auto';

                        toggleBtn.addEventListener('click', () => {
                            if (tableSection.style.display === 'none') {
                                tableSection.style.display = 'block';
                                btnText.textContent = 'Hide Table';
                            } else {
                                tableSection.style.display = 'none';
                                btnText.textContent = 'Show Table';
                            }
                            // Allow DOM to repaint before resizing the map view
                            setTimeout(() => { view.resize(); }, 150);
                        });
                    }

                    // --- Widget Interactivity Setup ---
                    
                    // 1. Table Selection -> Pan/Zoom Map
                    featureTable.highlightIds.on("change", async (event) => {
                        if (event.added.length > 0) {
                            const objectId = event.added[0];
                            const query = editLayer.createQuery();
                            query.objectIds = [objectId];
                            query.returnGeometry = true;
                            query.outSpatialReference = view.spatialReference;
                            try {
                                const results = await editLayer.queryFeatures(query);
                                if (results.features.length > 0) {
                                    view.goTo({
                                        target: results.features[0],
                                        zoom: 18
                                    });
                                }
                            } catch(e) { console.error("Could not zoom to feature table selection", e); }
                        }
                    });

                    // 2. Map Click -> Select in Table
                    view.on("click", (event) => {
                        view.hitTest(event).then((response) => {
                            const results = response.results.filter(r => 
                                r.graphic && r.graphic.layer === editLayer
                            );
                            if (results.length > 0) {
                                const objectId = results[0].graphic.attributes[editLayer.objectIdField];
                                if (objectId) {
                                    featureTable.highlightIds.removeAll();
                                    featureTable.highlightIds.add(objectId);
                                    
                                    // Open table automatically if they click a map point
                                    if(tableSection && tableSection.style.display === 'none' && toggleBtn) {
                                        toggleBtn.click();
                                    }
                                }
                            }
                        });
                    });

                    // 3. Search Result -> Select in Table
                    searchWidget.on("select-result", (event) => {
                        if (event.result && event.result.feature) {
                            const objectId = event.result.feature.attributes[editLayer.objectIdField];
                            if (objectId) {
                                featureTable.highlightIds.removeAll();
                                featureTable.highlightIds.add(objectId);
                                
                                // Open table automatically
                                if(tableSection && tableSection.style.display === 'none' && toggleBtn) {
                                    toggleBtn.click();
                                }
                            }
                        }
                    });

                    // Hide the loading overlay smoothly
                    const loadingDiv = document.getElementById('we-loading');
                    if(loadingDiv) {
                        loadingDiv.style.transition = "opacity 0.5s ease";
                        loadingDiv.style.opacity = '0';
                        setTimeout(() => { loadingDiv.style.display = 'none'; }, 500);
                    }
                    
                    document.getElementById('we-status').innerHTML = '<i class="fas fa-check-circle" style="color:var(--teal);"></i> Live &amp; Secure';
                }).catch(err => {
                    console.error("Layer load error:", err);
                    document.getElementById('we-loading').innerHTML = `<h2>Data Error</h2><p>Cannot load the feature service. Verify permissions or token.</p><p style="color:var(--red); font-size:0.8rem;">${err.message}</p>`;
                    document.getElementById('we-status').innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--red);"></i> Connection Failed';
                });
            });

        });
    } catch (e) {
        console.error("ArcGIS JS API Error", e);
        document.getElementById('we-loading').innerHTML = '<h2>Application Error</h2><p>Failed to initialize the ArcGIS JavaScript API.</p>';
    }
}
