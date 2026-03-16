// Client ID from ArcGIS Enterprise Portal
const ARCGIS_APP_ID = 'vWXtjJtA7k006M4S';

// The URL of your ArcGIS Enterprise Portal
// Based on previous history, the portal URL is:
const PORTAL_URL = 'https://apps.csrd.bc.ca/hub';

export const config = {
    appId: ARCGIS_APP_ID,
    portalUrl: PORTAL_URL,
    redirectUri: window.location.origin + window.location.pathname,
    notebooks: {
        nightlyOrchestratorId: '811614c266a84b769c1fe9ffbedda058',
        salmonArmETLId: 'fb8fd369499b440c8ae3720c1bbe3b9f'
    },
    gpTools: {
        qaValidation: 'https://apps.csrd.bc.ca/arcgis/rest/services/Regional/QA/GPServer',
        reconcilePost: 'https://apps.csrd.bc.ca/arcgis/rest/services/ReconcilePostTraditional/GPServer',
        exportSsap: 'https://apps.csrd.bc.ca/arcgis/rest/services/Landbase/ExportSSAP/GPServer'
    }
};
