// ========== CMS Core: ArcGIS Hosted Table Integration ==========
// This script enables dynamic content loading and saving from an ArcGIS Hosted Table.

class CMSController {
    constructor() {
        this.cache = {}; // Stores { 'home.heroTitle': 'CSRD NG9-1-1...' }
        this.tableUrl = 'https://apps.csrd.bc.ca/arcgis/rest/services/Hosted/NG911_Docs_CMS/FeatureServer/0';
        this.isLoaded = false;
        this.pendingEdits = {}; // Stores edits before saving to ArcGIS

        // ArcGIS often lowercases or removes spaces from user-provided field names
        // We will dynamically map our expected names to the real DB field names here:
        this.fieldMap = {
            key: 'KeyName',
            content: 'ContentValue',
            type: 'ContentType',
            id: 'OBJECTID'
        };
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

        const queryUrl = `${this.tableUrl}/query?where=1=1&outFields=*&f=json&token=${token}&_t=${Date.now()}`;

        try {
            const response = await fetch(queryUrl);
            const data = await response.json();

            if (data.error) {
                console.error("CMS Fetch Error:", data.error.message);
                return;
            }

            // Dynamically map exact field names from the DB schema
            if (data.fields) {
                data.fields.forEach(f => {
                    const lowerName = f.name.toLowerCase();
                    if (lowerName.includes('key')) this.fieldMap.key = f.name;
                    if (lowerName.includes('contentvalue') || lowerName.includes('content_value')) this.fieldMap.content = f.name;
                    if (lowerName.includes('type')) this.fieldMap.type = f.name;
                    if (lowerName === 'objectid') this.fieldMap.id = f.name;
                });
            }

            if (data.features) {
                this.cache = {};
                data.features.forEach(f => {
                    const attr = f.attributes;
                    const keyVal = attr[this.fieldMap.key];
                    if (keyVal) {
                        this.cache[keyVal] = attr; // Store full row data (ContentValue, objectid, etc)
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

        // 1. Process Structural Blocks first (so nested elements are restored)
        const htmlElements = container.querySelectorAll('[data-cms-html]');
        htmlElements.forEach(el => {
            const key = el.getAttribute('data-cms-html');
            const row = this.cache[key];
            if (row && row[this.fieldMap.content]) {
                let contentVal = row[this.fieldMap.content];
                try {
                    // Try to decode as base64
                    if (contentVal && contentVal.match(/^[A-Za-z0-9+/=]+$/)) {
                        contentVal = decodeURIComponent(escape(atob(contentVal)));
                    }
                } catch (e) { }

                el.innerHTML = contentVal;

                // Post-process: fix stale image paths from old saves
                el.querySelectorAll('img').forEach(img => {
                    const src = img.getAttribute('src');
                    if (src && !src.startsWith('docs/') && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('/')) {
                        img.setAttribute('src', 'docs/' + src);
                    }
                });
                // Strip leftover editor metadata from restored HTML
                el.querySelectorAll('[data-original-cms-content]').forEach(n => n.removeAttribute('data-original-cms-content'));
                el.querySelectorAll('[data-editor-bound]').forEach(n => n.removeAttribute('data-editor-bound'));
            }
        });

        // 2. Process Individual Text/Media Variables
        const elements = container.querySelectorAll('[data-cms-key]');
        elements.forEach(el => {
            const key = el.getAttribute('data-cms-key');
            const row = this.cache[key];
            if (row && row[this.fieldMap.content]) {
                let contentVal = row[this.fieldMap.content];
                const typeVal = row[this.fieldMap.type];

                // Attempt to decode Base64 (to bypass ArcGIS XSS filters)
                try {
                    if (contentVal && contentVal.match(/^[A-Za-z0-9+/=]+$/)) {
                        contentVal = decodeURIComponent(escape(atob(contentVal)));
                    }
                } catch (e) { }

                // If the field is a regular link href
                if (el.tagName === 'A' && el.hasAttribute('href') && typeVal === 'url') {
                    el.setAttribute('href', contentVal);
                }
                // If the field is an image source
                else if (el.tagName === 'IMG' && el.hasAttribute('src') && typeVal === 'url') {
                    el.setAttribute('src', contentVal);
                }
                // Otherwise treat as inner HTML content
                else {
                    el.innerHTML = contentVal;
                }
            }
        });
    }

    /**
     * Stash an edit locally in memory (used by editor-core.js when a user types)
     */
    trackEdit(key, newContent, contentType = 'html') {
        // Base64 encode the content before saving it so ArcGIS doesn't reject HTML tags like <br>
        const encodedContent = btoa(unescape(encodeURIComponent(newContent)));

        this.pendingEdits[key] = {
            keyVal: key,
            contentVal: encodedContent,
            typeVal: contentType
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

            if (existingRow && existingRow[this.fieldMap.id]) {
                // Update
                const attrs = {};
                attrs[this.fieldMap.id] = existingRow[this.fieldMap.id];
                attrs[this.fieldMap.content] = editData.contentVal;
                attrs[this.fieldMap.type] = existingRow[this.fieldMap.type] || editData.typeVal;
                updates.push({ attributes: attrs });
            } else {
                // Insert
                const attrs = {};
                attrs[this.fieldMap.key] = editData.keyVal;
                attrs[this.fieldMap.content] = editData.contentVal;
                attrs[this.fieldMap.type] = editData.typeVal;
                adds.push({ attributes: attrs });
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
                const firstError = failed[0].error ? (failed[0].error.description || failed[0].error.message || JSON.stringify(failed[0].error)) : "Unknown ArcGIS rejection";
                throw new Error(`ArcGIS rejected save: ${firstError}`);
            }

            // Success! Update local cache
            keysToSave.forEach(key => {
                if (!this.cache[key]) this.cache[key] = {};
                this.cache[key][this.fieldMap.content] = this.pendingEdits[key].contentVal;

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
