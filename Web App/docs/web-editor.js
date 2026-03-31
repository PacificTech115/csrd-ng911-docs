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
    
    // Admins default to Revelstoke for now via the web editor to avoid errors, or they can switch via UI later
    if (!muniKey && (auth.isAdmin && auth.isAdmin())) {
        muniKey = 'revelstoke'; // Default for admin testing
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
        // We rely on the global require from the ArcGIS JS API loaded in index.html
        require([
            "esri/identity/IdentityManager",
            "esri/Map",
            "esri/views/MapView",
            "esri/layers/FeatureLayer",
            "esri/widgets/Editor",
            "esri/widgets/Home",
            "esri/widgets/BasemapToggle"
        ], function(IdentityManager, Map, MapView, FeatureLayer, Editor, Home, BasemapToggle) {
            
            // Register OAuth token to bypass ArcGIS Server prompts
            const token = auth.getToken();
            if (token) {
                // We use base portal URL or REST base depending on the token issuer
                // Usually the IdentityManager is smart enough, but we should register it to config.portalUrl or config.arcgisRestBase
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

                    // Add widgets to UI
                    view.ui.add(editor, "top-right");
                    
                    const homeWidget = new Home({ view: view });
                    view.ui.add(homeWidget, "top-left");
                    
                    const basemapToggle = new BasemapToggle({
                        view: view,
                        nextBasemap: "hybrid"
                    });
                    view.ui.add(basemapToggle, "bottom-right");

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
