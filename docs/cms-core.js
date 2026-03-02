// ========== CMS Core: ArcGIS Hosted Table Integration ==========
// This script enables dynamic content loading and saving from an ArcGIS Hosted Table.

class CMSController {
    constructor() {
        this.cache = {}; // Stores { 'home.heroTitle': 'CSRD NG9-1-1...' }
        this.tableUrl = 'https://apps.csrd.bc.ca/arcgis/rest/services/Hosted/NG911_Docs_CMS/FeatureServer/0';
        this.isLoaded = false;
        this.pendingEdits = {}; // Stores edits before saving to ArcGIS
    }

    /**
     * Fetch all CMS content from the ArcGIS Hosted Table
     * This is called once on site load.
     */
    async fetchAllContent() {
        const token = localStorage.getItem('csrd_arcgis_token');
        if (!token) {
            console.warn("CMS: No token found. Skipping content fetch.");
            return;
        }

        const queryUrl = `${this.tableUrl}/query?where=1=1&outFields=*&f=json&token=${token}`;

        try {
            const response = await fetch(queryUrl);
            const data = await response.json();

            if (data.error) {
                console.error("CMS Fetch Error:", data.error.message);
                return;
            }

            if (data.features) {
                this.cache = {};
                data.features.forEach(f => {
                    const attr = f.attributes;
                    if (attr.KeyName) {
                        this.cache[attr.KeyName] = attr; // Store full row data (ContentValue, objectid, etc)
                    }
                });
                console.log(`CMS: Loaded ${data.features.length} content keys.`);
                this.isLoaded = true;
            }
        } catch (err) {
            console.error("CMS: Failed to fetch from Hosted Table", err);
        }
    }

    /**
     * Replaces the innerHTML of elements with a matching `data-cms-key`
     * Called by the router after a page's HTML template is loaded.
     */
    applyContentToDOM(container) {
        if (!this.isLoaded) return; // If DB failed or still loading, skip

        const elements = container.querySelectorAll('[data-cms-key]');
        elements.forEach(el => {
            const key = el.getAttribute('data-cms-key');
            if (this.cache[key] && this.cache[key].ContentValue) {
                // If the field is a regular link href
                if (el.tagName === 'A' && el.hasAttribute('href') && this.cache[key].ContentType === 'url') {
                    el.setAttribute('href', this.cache[key].ContentValue);
                }
                // If the field is an image source
                else if (el.tagName === 'IMG' && el.hasAttribute('src') && this.cache[key].ContentType === 'url') {
                    el.setAttribute('src', this.cache[key].ContentValue);
                }
                // Otherwise treat as inner HTML content
                else {
                    el.innerHTML = this.cache[key].ContentValue;
                }
            }
        });
    }

    /**
     * Stash an edit locally in memory (used by editor-core.js when a user types)
     */
    trackEdit(key, newContent, contentType = 'html') {
        this.pendingEdits[key] = {
            KeyName: key,
            ContentValue: newContent,
            ContentType: contentType
        };
    }

    /**
     * Saves all tracked edits back to the ArcGIS Hosted Table via applyEdits
     */
    async saveAllEdits() {
        const token = localStorage.getItem('csrd_arcgis_token');
        if (!token) throw new Error("Authentication required to save.");

        const keysToSave = Object.keys(this.pendingEdits);
        if (keysToSave.length === 0) return 0;

        const adds = [];
        const updates = [];

        keysToSave.forEach(key => {
            const editData = this.pendingEdits[key];
            const existingRow = this.cache[key];

            if (existingRow && existingRow.OBJECTID) {
                // Row exists in ArcGIS, update it
                updates.push({
                    attributes: {
                        OBJECTID: existingRow.OBJECTID,
                        ContentValue: editData.ContentValue,
                        ContentType: existingRow.ContentType || editData.ContentType
                    }
                });
            } else {
                // Row doesn't exist, insert new
                adds.push({
                    attributes: {
                        KeyName: key,
                        ContentValue: editData.ContentValue,
                        ContentType: editData.ContentType
                    }
                });
            }
        });

        // Construct applyEdits payload
        const formData = new URLSearchParams();
        formData.append('f', 'json');
        formData.append('token', token);

        if (adds.length > 0) formData.append('adds', JSON.stringify(adds));
        if (updates.length > 0) formData.append('updates', JSON.stringify(updates));

        try {
            const response = await fetch(`${this.tableUrl}/applyEdits`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            });

            const data = await response.json();

            if (data.error) throw new Error(data.error.message);

            // Check for individual row errors
            const allResults = [...(data.addResults || []), ...(data.updateResults || [])];
            const failed = allResults.filter(r => !r.success);

            if (failed.length > 0) {
                throw new Error(`Failed to save ${failed.length} items. Check network logs.`);
            }

            // Success! Update local cache
            keysToSave.forEach(key => {
                if (!this.cache[key]) this.cache[key] = {};
                this.cache[key].ContentValue = this.pendingEdits[key].ContentValue;

                // If it was a new ADD, we should reload the CMS entirely to get the new OBJECTIDs
                // but for now, the UI will just work on the current page session.
            });

            // Clear pending
            this.pendingEdits = {};

            return keysToSave.length;

        } catch (err) {
            console.error("CMS Save Error: ", err);
            throw err;
        }
    }
}

// Global Singleton
window.cms = new CMSController();
