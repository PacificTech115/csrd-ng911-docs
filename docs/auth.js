import { config } from './config.js?v=2';

class ArcGISAuth {
    constructor() {
        this.tokenKey = 'csrd_arcgis_token';
        this.userKey = 'csrd_arcgis_user';
        this.expiresKey = 'csrd_arcgis_expires';
        this.groupsKey = 'csrd_arcgis_groups';
    }

    /**
     * Initializes authentication.
     * Checks if we are returning from an OAuth redirect with a token in the hash.
     * If not, checks if we have a valid token in localStorage.
     * If not, redirects to login.
     */
    async init() {
        if (this.handleRedirectCallback()) {
            await this.fetchUserInfo();
            // Clean hash from URL and reload to strip token from address bar
            window.location.hash = '';
            window.location.reload();
            return;
        }

        if (this.isAuthenticated()) {
            // Check if we need to refresh user info (e.g. groups)
            if (!localStorage.getItem(this.userKey)) {
                await this.fetchUserInfo();
            }
        }
    }

    login() {
        const authUrl = `${config.portalUrl}/sharing/rest/oauth2/authorize?client_id=${config.appId}&response_type=token&expiration=1440&redirect_uri=${encodeURIComponent(config.redirectUri)}`;
        window.location.href = authUrl;
    }

    logout() {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        localStorage.removeItem(this.expiresKey);
        localStorage.removeItem(this.groupsKey);
        window.location.reload();
    }

    isAuthenticated() {
        const token = localStorage.getItem(this.tokenKey);
        const expires = localStorage.getItem(this.expiresKey);
        if (!token || !expires) return false;
        if (new Date().getTime() > parseInt(expires)) {
            // Token expired
            this.logout();
            return false;
        }
        return true;
    }

    getToken() {
        if (this.isAuthenticated()) {
            return localStorage.getItem(this.tokenKey);
        }
        return null;
    }

    getUser() {
        const userStr = localStorage.getItem(this.userKey);
        return userStr ? JSON.parse(userStr) : null;
    }

    getGroups() {
        const groupsStr = localStorage.getItem(this.groupsKey);
        return groupsStr ? JSON.parse(groupsStr) : [];
    }

    /**
     * Checks if there's an access_token in the URL hash (from Implicit Grant).
     * If so, saves it.
     */
    handleRedirectCallback() {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token=')) {
            try {
                // Safely parse hash (some OAuth responses use standard '&' ampersands, others might not)
                const hashParams = hash.substring(1).split('&').reduce((acc, item) => {
                    const [k, v] = item.split('=');
                    acc[k] = decodeURIComponent(v);
                    return acc;
                }, {});

                const token = hashParams['access_token'];
                const expiresIn = hashParams['expires_in'] || '14400';

                if (token) {
                    localStorage.setItem(this.tokenKey, token);
                    const expireTime = new Date().getTime() + (parseInt(expiresIn) * 1000);
                    localStorage.setItem(this.expiresKey, expireTime.toString());
                    return true;
                } else {
                    alert("OAuth Error: access_token missing in URL payload -> " + hash);
                }
            } catch (e) {
                alert("OAuth Parse Error: " + e.message);
            }
        }
        return false;
    }

    /**
     * Fetches user metadata and group memberships from the Portal to determine roles.
     */
    async fetchUserInfo() {
        const token = this.getToken();
        if (!token) return;

        try {
            // Get basic self info
            const selfRes = await fetch(`${config.portalUrl}/sharing/rest/portals/self?f=json&token=${token}`);
            const selfData = await selfRes.json();

            if (selfData.error) throw new Error(selfData.error.message);

            const username = selfData.user.username;
            localStorage.setItem(this.userKey, JSON.stringify(selfData.user));

            // Get groups
            const userRes = await fetch(`${config.portalUrl}/sharing/rest/community/users/${username}?f=json&token=${token}`);
            const userData = await userRes.json();

            if (userData.groups) {
                const groupNames = userData.groups.map(g => g.title);
                localStorage.setItem(this.groupsKey, JSON.stringify(groupNames));
            }

        } catch (error) {
            console.error('Error fetching user info from Portal:', error);
            alert("ArcGIS Portal Connection Error:\n\n" + error.message + "\n\nAuto-redirect paused for debugging. Please check developer console.");
            // this.logout(); // Disabled to stop the infinite redirect loop
        }
    }

    /**
     * Helper to verify if the user has editor privileges
     */
    isEditor() {
        const user = this.getUser();
        if (!user) return false;

        // Either they have the explicit "_Editing" suffix, or they are a global CSRD admin
        const uName = user.username.toLowerCase();
        return uName.includes('_editing') || uName === 'csrd' || uName.includes('admin');
    }

    /**
     * Helper to verify access to a specific municipality
     * Returns true if Global Admin or matches municipality.
     */
    hasAccessTo(municipality) {
        const user = this.getUser();
        if (!user) return false;

        const uName = user.username.toLowerCase();

        // Global access
        if (uName === 'csrd' || uName.includes('admin')) return true;

        // E.g., user "Golden" or "Golden_Editing" has access to "golden"
        return uName.includes(municipality.toLowerCase());
    }
}

export const auth = new ArcGISAuth();
