// Client ID from ArcGIS Enterprise Portal
const ARCGIS_APP_ID = 'vWXtjJtA7k006M4S';

// The URL of your ArcGIS Enterprise Portal
// Based on previous history, the portal URL is:
const PORTAL_URL = 'https://apps.csrd.bc.ca/portal';

export const config = {
    appId: ARCGIS_APP_ID,
    portalUrl: PORTAL_URL,
    redirectUri: window.location.origin + window.location.pathname
};
