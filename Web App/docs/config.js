// Client ID from ArcGIS Enterprise Portal
const ARCGIS_APP_ID = 'vWXtjJtA7k006M4S';

// The URL of your ArcGIS Enterprise Portal
const PORTAL_URL = 'https://apps.csrd.bc.ca/hub';

// Derived base URLs — all service endpoints flow from PORTAL_URL
const ARCGIS_BASE = PORTAL_URL.replace('/hub', '');
const ARCGIS_REST = PORTAL_URL.replace('/hub', '/arcgis/rest/services');

export const config = {
    appId: ARCGIS_APP_ID,
    portalUrl: PORTAL_URL,
    arcgisBase: ARCGIS_BASE,
    arcgisRestBase: ARCGIS_REST,
    redirectUri: window.location.origin + window.location.pathname,

    cmsTableUrl: `${ARCGIS_REST}/Hosted/NG911_Docs_CMS/FeatureServer/0`,

    notebooks: {
        nightlyOrchestratorId: '811614c266a84b769c1fe9ffbedda058',
        salmonArmETLId: 'fb8fd369499b440c8ae3720c1bbe3b9f'
    },

    gpTools: {
        qaValidation: `${ARCGIS_REST}/Regional/QA/GPServer`,
        reconcilePost: `${ARCGIS_REST}/ReconcilePostTraditional/GPServer`,
        exportSsap: `${ARCGIS_REST}/Landbase/ExportSSAP/GPServer`,
        orchestrator: `https://apps.csrd.bc.ca/notebook/rest/services/a2bd1f1e38ee472e9fcf8d6fa6165b42/GPServer/execute_notebook`
    },

    services: {
        regionalBase: `${ARCGIS_REST}/Regional`,
        municipalEdit: {
            revelstoke: `${ARCGIS_REST}/Regional/NG911_Address_Revelstoke_Edit/FeatureServer`,
            golden: `${ARCGIS_REST}/Regional/NG911_Address_Golden_Edit/FeatureServer`,
            sicamous: `${ARCGIS_REST}/Regional/NG911_Address_Sicamous_Edit/FeatureServer`
        }
    },

    aiServerUrl: 'https://ai.pacifictechsystems.ca' // Permanent Cloudflare Tunnel routing to personal GPU
};
