/**
 * CSRD NG911 - Client-Side Editor Mode Prototype (Enhanced WYSIWYG)
 * Features: Context-Aware Tables/Lists, Enter-key Intercept, Expanded Toolbar, Revert Action
 */

window.initEditorUI = function () {
    applySavedEdits();

    // Validate if the user is truly an editor via ArcGIS Auth before enabling the mode
    if (localStorage.getItem('csrd_editor_mode') === 'true') {
        if (window.csrdAuth && window.csrdAuth.isEditor()) {
            enableEditMode();
        } else {
            console.warn('Unauthorized attempt to enter editor mode.');
            localStorage.setItem('csrd_editor_mode', 'false');
        }
    }
};

window.getPageId = function () {
    return window.location.hash.substring(1) || 'home';
};

// --- CORE EDITOR LOGIC ---
let activeNode = null;

function applySavedEdits() {
    // Deprecated: We now rely entirely on ArcGIS Hosted Tables via cms-core.js
    // Local storage overrides are disabled so that different editors see the global state.
    return;
}

function enableEditMode() {
    document.body.classList.add('editor-mode-active');
    injectToolbar();
    makeNodesEditable();
    initResourceAdder();
    blockNavigation();
    showToast('WYSIWYG Editor Active. Toolbar at top.');
}

function blockNavigation() {
    const mainArea = document.querySelector('.main');
    if (!mainArea) return;

    mainArea.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        const btn = e.target.closest('button');

        // Allow toolbar buttons
        if (e.target.closest('.editor-toolbar')) return;

        // Allow Add Resource and specific custom card actions
        if (e.target.closest('.add-resource-btn') ||
            e.target.closest('.resource-add-form') ||
            e.target.closest('.custom-card-delete')) {
            return;
        }

        // Allow links inside CMS-managed containers so the link editor prompt works
        if (link && (link.closest('[data-cms-html]') || link.closest('[data-cms-key]') || link.hasAttribute('data-cms-href'))) {
            // Let the link editor capture-phase handler deal with this click
            e.preventDefault(); // Still prevent actual navigation
            return;             // But don't block the event from reaching the link editor
        }

        if (link || (btn && !btn.classList.contains('mobile-toggle'))) {
            e.preventDefault();
            e.stopPropagation();
            showToast('Navigation blocked. You are in Edit Mode.');
        }
    }, true);
}

function injectToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';
    toolbar.innerHTML = `
        <div class="toolbar-group">
            <button onclick="document.execCommand('undo', false, null)" title="Undo"><i class="fas fa-undo"></i></button>
            <button onclick="document.execCommand('redo', false, null)" title="Redo"><i class="fas fa-redo"></i></button>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-group">
            <button onclick="document.execCommand('bold', false, null)" title="Bold"><i class="fas fa-bold"></i></button>
            <button onclick="document.execCommand('italic', false, null)" title="Italic"><i class="fas fa-italic"></i></button>
            <button onclick="document.execCommand('underline', false, null)" title="Underline"><i class="fas fa-underline"></i></button>
            <button onclick="document.execCommand('strikethrough', false, null)" title="Strikethrough"><i class="fas fa-strikethrough"></i></button>
            <button onclick="insertLink()" title="Insert Link"><i class="fas fa-link"></i></button>
        </div>
        <div class="toolbar-sep"></div>
        <div class="toolbar-group">
            <button id="btnContextAdd" onclick="addNode('p')" title="Add Block"><i class="fas fa-plus"></i> <span>Add Text</span></button>
            <button id="btnContextAddHeader" onclick="addNode('h3')" title="Add Header below"><i class="fas fa-heading"></i></button>
            <button id="btnContextAddStep" onclick="addNode('card')" title="Duplicate Step" style="display:none;"><i class="fas fa-clone"></i> <span>Dupe Step</span></button>
            <button id="btnContextDelete" onclick="deleteActiveNode()" title="Delete selected block" class="btn-danger"><i class="fas fa-trash"></i> <span>Delete</span></button>
        </div>
        <div class="toolbar-group" style="margin-left: auto;">
            <button onclick="savePageHTML()" class="btn-save"><i class="fas fa-save"></i> Save Page</button>
        </div>
    `;
    document.body.appendChild(toolbar);
}

window.insertLink = function () {
    const url = prompt("Enter the URL for the link:", "https://");
    if (url) {
        document.execCommand('createLink', false, url);
        // Force the link to be an editable node so it can be blocked
        makeNodesEditable();
    }
};

function makeNodesEditable() {
    // 1. Target literal text elements designated for CMS control
    const nodes = document.querySelectorAll('[data-cms-key]');

    nodes.forEach(node => {
        // Skip nodes inside details summary or code blocks or existing UI buttons
        if (node.closest('summary') || node.closest('.code-block') || node.closest('.editor-toolbar')) return;

        if (!node.classList.contains('editable-node')) {
            node.setAttribute('contenteditable', 'true');
            node.classList.add('editable-node');

            // Store original content to detect changes
            node.dataset.originalCmsContent = node.innerHTML;

            // Handle focus explicitly to update the toolbar context
            node.addEventListener('focus', function () {
                activeNode = this;
                document.querySelectorAll('.editable-node.focused').forEach(n => n.classList.remove('focused'));
                this.classList.add('focused');
                updateToolbarContext(this);
            });

            node.addEventListener('blur', function () {
                this.classList.remove('focused');

                // Track edit if content changed
                const newContent = this.innerHTML;
                const oldContent = this.dataset.originalCmsContent;
                if (newContent !== oldContent && window.cms) {
                    const key = this.getAttribute('data-cms-key');
                    window.cms.trackEdit(key, newContent, 'html');
                    trackEdit(getPageId(), "CMS Update", oldContent, newContent);
                    this.dataset.originalCmsContent = newContent; // Update baseline

                    // NEW: If this node is inside a data-cms-html container, trigger a save on the container too
                    const parentContainer = this.closest('[data-cms-html]');
                    if (parentContainer) {
                        flagContainerForSave(parentContainer);
                    }
                }
            });

            // Intercept Enter key inside p and li tags to spawn adjacent blocks instead of internal <br>
            node.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    const tag = this.tagName.toLowerCase();
                    if (tag === 'li' || tag === 'p' || tag === 'td') {
                        e.preventDefault();
                        activeNode = this;
                        // You must click the dedicated "Add Row" button. 
                        // But for li and p, Enter spawns a sibling seamlessly.
                        if (tag !== 'td') {
                            addNode(tag, true);
                        } else {
                            // If in <td>, just move cursor to next cell if possible, else do nothing.
                            const nextCell = this.nextElementSibling;
                            if (nextCell && nextCell.classList.contains('editable-node')) {
                                nextCell.focus();
                            }
                        }
                    }
                }
            });
        }
    });

    // 2. Initialize Visual Builder Structural Blocks (data-cms-html)
    initVisualBuilderBlocks();

    // 3. Initialize Link Editors
    initLinkEditors();
}

// --- VISUAL BUILDER LOGIC ---

function initVisualBuilderBlocks() {
    const containers = document.querySelectorAll('[data-cms-html]');

    containers.forEach(container => {
        // Prevent adding multiple action bars
        if (container.querySelector('.cms-action-bar')) return;

        const actionBar = document.createElement('div');
        actionBar.className = 'cms-action-bar';
        actionBar.contentEditable = 'false'; // Keep it out of wysiwyg flow

        // Disable actions if parent is grid and node is only child, etc.
        const isFlexGrid = window.getComputedStyle(container.parentElement).display === 'grid' || window.getComputedStyle(container.parentElement).display === 'flex';

        actionBar.innerHTML = `
            <button onclick="moveCmsNode(this.closest('[data-cms-html]'), -1)" title="Move Up/Left"><i class="fas fa-arrow-left"></i></button>
            <button onclick="moveCmsNode(this.closest('[data-cms-html]'), 1)" title="Move Down/Right"><i class="fas fa-arrow-right"></i></button>
            <button onclick="duplicateCmsNode(this.closest('[data-cms-html]'))" title="Duplicate Block"><i class="fas fa-copy"></i></button>
            <button onclick="deleteCmsNode(this.closest('[data-cms-html]'))" class="btn-danger" title="Delete Block"><i class="fas fa-trash"></i></button>
        `;

        container.appendChild(actionBar);
    });
}

window.moveCmsNode = function (node, direction) {
    if (!node || !node.parentNode) return;

    if (direction === -1 && node.previousElementSibling) {
        node.parentNode.insertBefore(node, node.previousElementSibling);
        flagContainerForSave(node.parentNode);
        showToast('Block moved up.');
    } else if (direction === 1 && node.nextElementSibling) {
        node.parentNode.insertBefore(node.nextElementSibling, node);
        flagContainerForSave(node.parentNode);
        showToast('Block moved down.');
    } else {
        showToast('Cannot move block further in that direction.');
    }
};

window.duplicateCmsNode = function (node) {
    if (!node || !node.parentNode) return;

    // Clone node deeply
    const clone = node.cloneNode(true);

    // Remove the old action bar from the clone so it gets a fresh one
    const oldBar = clone.querySelector('.cms-action-bar');
    if (oldBar) oldBar.remove();

    // Reset unique IDs if present
    if (clone.id) clone.id = clone.id + '_copy_' + Date.now();

    // Attempt to rename nested data-cms-key if present so they don't overwrite each other in DB (optional, but good practice)
    const nestedKeys = clone.querySelectorAll('[data-cms-key]');
    nestedKeys.forEach(k => {
        const oldKey = k.getAttribute('data-cms-key');
        k.setAttribute('data-cms-key', oldKey + '_copy_' + Date.now());
    });

    node.parentNode.insertBefore(clone, node.nextSibling);

    // Re-initialize editability on the new clone
    makeNodesEditable();

    flagContainerForSave(node.parentNode);
    showToast('Block duplicated.');
};

window.deleteCmsNode = function (node) {
    if (!confirm('Are you sure you want to delete this entire layout block?')) return;
    const parent = node.parentNode;
    node.remove();
    flagContainerForSave(parent);
    showToast('Block deleted.');
};

// Flags a structural container or parent container to completely resave its HTML
window.flagContainerForSave = function (containerElement) {
    // If the element itself isn't a data-cms-html block, find the nearest ancestor that is
    const target = containerElement.hasAttribute('data-cms-html') ? containerElement : containerElement.closest('[data-cms-html]');

    if (target && window.cms) {
        // Strip the action bars temporarily to get clean HTML
        const actionBars = target.querySelectorAll('.cms-action-bar');
        actionBars.forEach(bar => bar.style.display = 'none'); // Hiding is safer than removing to not break bound events during edit session

        // We actually want to strip them completely for the DB save, so clone it
        const clone = target.cloneNode(true);
        clone.querySelectorAll('.cms-action-bar').forEach(b => b.remove());
        // Strip contenteditable attributes that might be active
        clone.querySelectorAll('.editable-node').forEach(n => {
            n.removeAttribute('contenteditable');
            n.classList.remove('editable-node', 'focused');
        });
        // Strip all editor metadata attributes to prevent state leaking into DB
        clone.querySelectorAll('[data-original-cms-content]').forEach(n => n.removeAttribute('data-original-cms-content'));
        clone.querySelectorAll('[data-editor-bound]').forEach(n => n.removeAttribute('data-editor-bound'));
        clone.querySelectorAll('[data-toggle-bound]').forEach(n => n.removeAttribute('data-toggle-bound'));
        // Strip empty class attributes
        clone.querySelectorAll('[class=""]').forEach(n => n.removeAttribute('class'));

        const key = target.getAttribute('data-cms-html');
        // Save the raw outer HTML (or inner, depending on logic. Let's save inner to keep the wrapper intact)
        window.cms.trackEdit(key, clone.innerHTML, 'html');

        // Restore display 
        actionBars.forEach(bar => bar.style.display = '');
    }
};

// --- LINK EDITOR LOGIC ---

function initLinkEditors() {
    const links = document.querySelectorAll('a[data-cms-href]');

    links.forEach(link => {
        // Prevent multiple listeners
        if (link.dataset.editorBound) return;
        link.dataset.editorBound = 'true';

        link.addEventListener('click', function (e) {
            if (!document.body.classList.contains('editor-mode-active')) return;

            e.preventDefault();
            e.stopPropagation();

            const currentUrl = this.getAttribute('href');
            const newUrl = prompt('Edit Link Destination:', currentUrl);

            if (newUrl !== null && newUrl !== currentUrl) {
                this.setAttribute('href', newUrl);

                // Track edit structurally
                const key = this.getAttribute('data-cms-href');
                window.cms.trackEdit(key, newUrl, 'url');

                // Also trigger save on parent container if it's part of a visual block
                flagContainerForSave(this);

                showToast('Link updated.');
            }
        }, true); // Use capture phase to intercept before navigation
    });
}

// --- ADD RESOURCE CARD LOGIC ---
function initResourceAdder() {
    // 1. Show Add Buttons
    document.querySelectorAll('.add-resource-btn').forEach(btn => {
        btn.style.display = 'flex';

        btn.onclick = (e) => {
            e.preventDefault();
            const container = btn.previousElementSibling; // .custom-cards-container
            openPortalPickerModal(container);
        };
    });

    // Show the static delete buttons
    document.querySelectorAll('.static-delete').forEach(btn => {
        btn.style.display = 'inline-block';
    });

    // 2. Bind existing Delete Buttons on ALL loaded cards (custom and static)
    bindCardDeletes();
}

async function openPortalPickerModal(container) {
    // Check if modal already exists
    if (document.getElementById('portal-picker-modal')) return;

    // Create modal structure
    const modal = document.createElement('div');
    modal.id = 'portal-picker-modal';
    modal.className = 'portal-modal-overlay';
    modal.innerHTML = `
        <div class="portal-modal-content">
            <div class="portal-modal-header">
                <h3><i class="fas fa-satellite-dish"></i> Select Resource from Portal</h3>
                <button type="button" class="portal-modal-close" id="close-portal-picker"><i class="fas fa-times"></i></button>
            </div>
            <div class="portal-modal-body">
                <div id="portal-picker-loading" class="portal-picker-state">
                    <div class="spinner"></div>
                    <p>Loading your ArcGIS Portal content...</p>
                </div>
                <div id="portal-picker-error" class="portal-picker-state" style="display:none; color: #ef4444;"></div>
                <div class="portal-item-grid" id="portal-picker-grid" style="display:none;"></div>
            </div>
            <div class="portal-modal-footer">
                <span class="portal-picker-hint"><i class="fas fa-info-circle"></i> Click to instantly add a card to this section.</span>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Bind close
    const closeModal = () => modal.remove();
    document.getElementById('close-portal-picker').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    // Fetch User Content
    try {
        const token = localStorage.getItem('csrd_arcgis_token');
        const userStr = localStorage.getItem('csrd_arcgis_user');
        if (!token || !userStr) throw new Error("Not authenticated with ArcGIS.");

        const user = JSON.parse(userStr);
        const portalUrl = 'https://apps.csrd.bc.ca/hub';

        // Fetch up to 100 items from the root folder first
        const res = await fetch(`${portalUrl}/sharing/rest/content/users/${user.username}?f=json&num=100&token=${token}`);
        const data = await res.json();

        if (data.error) throw new Error(data.error.message);

        const grid = document.getElementById('portal-picker-grid');
        const loading = document.getElementById('portal-picker-loading');

        const typeMap = {
            'Feature Service': 'type-featureservice',
            'Map Service': 'type-mapservice',
            'Geoprocessing Service': 'type-geoprocessingservice',
            'Web Map': 'type-webmap',
            'Web Mapping Application': 'type-siteapplication',
            'Dashboard': 'type-siteapplication',
            'Notebook': 'type-notebook',
            'File Geodatabase': 'type-filegeodatabase',
            'Data Store': 'type-datastore',
            'Folder': 'type-folder'
        };

        let items = data.items || [];

        if (items.length === 0) {
            loading.style.display = 'none';
            const errorDiv = document.getElementById('portal-picker-error');
            errorDiv.style.display = 'block';
            errorDiv.innerHTML = 'No items found in your root ArcGIS Portal folder.';
            return;
        }

        // Render mini-cards
        items.forEach(item => {
            const typeClass = typeMap[item.type] || 'type-file';
            const card = document.createElement('div');
            card.className = 'portal-picker-card';

            // Format time
            const dateStr = new Date(item.modified).toLocaleDateString();

            card.innerHTML = `
                <div class="picker-card-title">${item.title}</div>
                <div class="picker-card-meta">
                    <span class="resource-type ${typeClass}">${item.type}</span>
                    <span class="picker-date">${dateStr}</span>
                </div>
                <div class="picker-card-snippet">${item.snippet || 'No snippet available.'}</div>
            `;

            // Click Handler -> Add to page
            card.onclick = () => {
                const html = createCustomCardHTML(item, portalUrl);
                container.insertAdjacentHTML('beforeend', html);
                bindCardDeletes();
                flagContainerForSave(container);
                showToast(`Added: ${item.title}. Click "Save Page" to keep it.`);
                closeModal();
            };

            grid.appendChild(card);
        });

        loading.style.display = 'none';
        grid.style.display = 'grid';

    } catch (err) {
        console.error('Portal Content Fetch Error:', err);
        document.getElementById('portal-picker-loading').style.display = 'none';
        const errorDiv = document.getElementById('portal-picker-error');
        errorDiv.style.display = 'block';
        errorDiv.innerHTML = `Error: ${err.message}`;
    }
}

function createCustomCardHTML(item, portalUrl) {
    // Map item types to CSS classes
    const typeMap = {
        'Feature Service': 'type-featureservice',
        'Map Service': 'type-mapservice',
        'Geoprocessing Service': 'type-geoprocessingservice',
        'Web Map': 'type-webmap',
        'Web Mapping Application': 'type-siteapplication',
        'Dashboard': 'type-siteapplication',
        'Notebook': 'type-notebook',
        'File Geodatabase': 'type-filegeodatabase',
        'Data Store': 'type-datastore',
        'Folder': 'type-folder'
    };

    const typeClass = typeMap[item.type] || 'type-file';
    let urlHtml = '';

    // Portal Link always present
    urlHtml += `<a href="${portalUrl}/home/item.html?id=${item.id}" target="_blank" class="btn-resource btn-primary"><i class="fas fa-external-link-alt"></i> Portal</a>`;

    // REST Endpoint if it's a service
    if (item.url) {
        urlHtml += `<a href="${item.url}" target="_blank" class="btn-resource btn-secondary"><i class="fas fa-server"></i> REST</a>`;
    }

    return `
    <li class="download-item custom-card">
        <div class="download-info">
            <div class="download-icon"><i class="fas fa-link"></i></div>
            <div style="flex:1">
                <div class="download-filename">
                    ${item.title} <span class="resource-type ${typeClass}">${item.type}</span>
                </div>
                <div class="download-desc">${item.snippet || item.description || 'No description available in Portal.'}</div>
                <div class="download-path">ID: ${item.id}</div>
            </div>
        </div>
        <div class="action-group">
            ${urlHtml}
            <button type="button" class="custom-card-delete" title="Remove Resource"><i class="fas fa-trash"></i></button>
        </div>
    </li>`;
}

function bindCardDeletes() {
    document.querySelectorAll('.custom-card-delete').forEach(btn => {
        // Remove existing listener to prevent doubling
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (confirm('Remove this resource?')) {
                const card = this.closest('.download-item');
                // Container might be .custom-cards-container (dynamic) or .download-section (static)
                const container = card.closest('.custom-cards-container') || card.closest('.download-section');

                if (card && container) {
                    card.remove();
                    flagContainerForSave(container);
                    showToast('Resource removed. Click "Save Page" to keep changes.');
                }
            }
        });
    });
}

// Update the labels of the Add/Delete buttons based on what is focused
function updateToolbarContext(node) {
    const btnAdd = document.getElementById('btnContextAdd');
    const btnDel = document.getElementById('btnContextDelete');
    const btnHeader = document.getElementById('btnContextAddHeader');
    const btnStep = document.getElementById('btnContextAddStep');
    if (btnStep) btnStep.style.display = 'none';
    const tag = node.tagName.toLowerCase();

    if (tag === 'td') {
        btnAdd.innerHTML = '<i class="fas fa-table-row"></i> <span>Add Row</span>';
        btnDel.innerHTML = '<i class="fas fa-trash"></i> <span>Del Row</span>';
        btnAdd.setAttribute('onclick', "addNode('tr')");
        btnHeader.style.display = 'none'; // Headers don't make sense inside tables usually
    } else if (tag === 'h4' && node.closest('.card')) {
        btnAdd.innerHTML = '<i class="fas fa-paragraph"></i> <span>Add Text</span>';
        btnDel.innerHTML = '<i class="fas fa-trash"></i> <span>Delete Step</span>';
        btnAdd.setAttribute('onclick', "addNode('p')");
        btnHeader.style.display = 'none';
        if (btnStep) btnStep.style.display = 'flex';
    } else if (tag === 'li') {
        btnAdd.innerHTML = '<i class="fas fa-list-ul"></i> <span>Add Bullet</span>';
        btnDel.innerHTML = '<i class="fas fa-trash"></i> <span>Del Bullet</span>';
        btnAdd.setAttribute('onclick', "addNode('li')");
        btnHeader.style.display = 'none';
    } else {
        btnAdd.innerHTML = '<i class="fas fa-paragraph"></i> <span>Add Text</span>';
        btnDel.innerHTML = '<i class="fas fa-trash"></i> <span>Delete</span>';
        btnAdd.setAttribute('onclick', "addNode('p')");
        btnHeader.style.display = 'flex';
    }
}

// --- SMART TOOLBAR ACTIONS ---

window.addNode = function (tag, viaKeyboard = false) {
    if (!activeNode) {
        showToast('Click a text block first to insert below it.');
        return;
    }

    let newNode;
    let logTag = tag;

    // SMART TABLE ROW CLONING
    if (tag === 'tr' && activeNode.tagName.toLowerCase() === 'td') {
        const row = activeNode.closest('tr');
        if (!row) return;

        newNode = row.cloneNode(true);
        // Clear all text in the cloned cells
        const cells = newNode.querySelectorAll('td');
        cells.forEach(c => {
            c.innerHTML = '<br>'; // Give it breathing room
            c.classList.remove('focused');
        });

        row.parentNode.insertBefore(newNode, row.nextSibling);

        // Focus the first cell of the new row
        if (cells.length > 0) activeNode = cells[0];

    } else {
        // Standard P, H3, or LI spawning
        newNode = document.createElement(tag);
        // If Enter key was pressed, leave it completely blank. If clicked from toolbar, give a hint.
        newNode.innerHTML = viaKeyboard ? '<br>' : (tag === 'p' ? 'Start typing new text here...' : (tag === 'li' ? 'New list item' : 'New Header'));
        newNode.className = 'editable-node new-node-flash';

        activeNode.parentNode.insertBefore(newNode, activeNode.nextSibling);
        activeNode = newNode;
    }

    makeNodesEditable();
    activeNode.focus();
    updateToolbarContext(activeNode); // Sync toolbar UI to the newly spawned node

    if (!viaKeyboard) {
        trackEdit(getPageId(), "ADD", "none", `Added new <${logTag}> block`);
    }
};

window.deleteActiveNode = function () {
    if (!activeNode) {
        showToast('Click a block first to delete it.');
        return;
    }

    if (confirm('Are you sure you want to delete this block?')) {
        const tag = activeNode.tagName.toLowerCase();
        let textToLog = activeNode.innerText;
        let logTag = tag;

        // If deleting a table cell, actually delete the whole row
        if (tag === 'td') {
            const row = activeNode.closest('tr');
            if (row) {
                textToLog = "Table Row";
                logTag = "tr";
                row.remove();
            }
        } else {
            activeNode.remove();
        }

        activeNode = null;
        updateToolbarContext({ tagName: 'P' }); // Reset context UI to default

        showToast('Block deleted. Make sure to click "Save Page".');
        trackEdit(getPageId(), "DELETE", textToLog, `Deleted <${logTag}> block`);
    }
};

window.savePageHTML = async function () {
    const btn = document.querySelector('.btn-save');
    if (!btn) return;

    // Disable button to prevent double clicks
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    // Strip out editable attributes
    const editables = document.querySelectorAll('.editable-node');
    editables.forEach(node => {
        node.removeAttribute('contenteditable');
        node.classList.remove('editable-node', 'focused', 'new-node-flash');
        if (node.classList.length === 0) node.removeAttribute('class');
    });

    try {
        if (window.cms) {
            const numSaved = await window.cms.saveAllEdits();
            showToast(`Successfully saved ${numSaved} content blocks to ArcGIS.`);

            btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> Save Page';
            }, 2000);
        } else {
            throw new Error("CMS controller not found.");
        }
    } catch (err) {
        showToast(`Failed to save: ${err.message}`);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Save Failed';
        setTimeout(() => { btn.innerHTML = '<i class="fas fa-save"></i> Retry Save'; }, 3000);
    }
};

// --- LOGGING & REVERSAL ---

function trackEdit(page, elementType, oldText, newText) {
    if (oldText === newText || oldText === '<br>') return;

    let edits = JSON.parse(localStorage.getItem('csrd_version_edits') || '[]');

    edits.unshift({
        timestamp: new Date().toISOString(),
        page: page,
        type: elementType,
        oldText: oldText,
        newText: newText,
        author: 'CSRD Editor'
    });

    if (edits.length > 200) edits.pop();
    localStorage.setItem('csrd_version_edits', JSON.stringify(edits));
}

window.reverseEdit = function (timestamp) {
    let edits = JSON.parse(localStorage.getItem('csrd_version_edits') || '[]');
    const editIndex = edits.findIndex(e => e.timestamp === timestamp);
    if (editIndex === -1) return;

    const edit = edits[editIndex];

    if (edit.type === "SAVE" || edit.type === "ADD" || edit.type === "DELETE") {
        showToast("Cannot auto-reverse structural changes. Use 'Discard All' if needed.");
        return;
    }

    if (!confirm('Revert this specific text change?')) return;

    let savedHtml = localStorage.getItem(`csrd_page_${edit.page}`);
    if (!savedHtml) {
        showToast(`No saved structural data found for ${edit.page}.`);
        return;
    }

    if (savedHtml.includes(edit.newText)) {
        savedHtml = savedHtml.replace(edit.newText, edit.oldText);
        localStorage.setItem(`csrd_page_${edit.page}`, savedHtml);

        edits.splice(editIndex, 1);
        localStorage.setItem('csrd_version_edits', JSON.stringify(edits));

        showToast('Edit reversed successfully.');
        setTimeout(() => location.reload(), 1000);
    } else {
        showToast('Could not locate the exact text in the saved block (it may have been heavily modified since).');
    }
};

window.discardAllEdits = function () {
    if (confirm("WARNING: This will permanently delete ALL local edits, saved pages, and edit history. Proceed?")) {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('csrd_page_') || key === 'csrd_version_edits')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        showToast('All local edits and history discarded.');

        // Force an immediate UI clear so the user doesn't have to wait for the reload delay
        const tbody = document.getElementById('editsBody');
        if (tbody) tbody.innerHTML = '';
        const msg = document.getElementById('noEditsMsg');
        if (msg) msg.style.display = 'flex';
        const table = document.getElementById('editsTable');
        if (table) table.style.display = 'none';
        const count = document.getElementById('editCount');
        if (count) count.textContent = '0 Edits';

        setTimeout(() => window.location.reload(true), 1500);
    }
};

function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'editor-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- SEARCH HIGHLIGHTING ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const sq = params.get('sq');
    if (sq) {
        // Wait a small bit for any dynamically rendered content (like collapsibles) before highlighting
        setTimeout(() => highlightKeyword(sq), 100);
        // Clean URL to avoid highlighting sticking around if they refresh
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

function highlightKeyword(keyword) {
    if (!keyword || keyword.length < 2) return;
    const wrap = document.querySelector('.content-wrap');
    if (!wrap) return;

    const regex = new RegExp('(' + keyword.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&') + ')', 'gi');

    // Walk text nodes to safely wrap text without breaking existing HTML tags
    const walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT, null, false);
    const nodesToReplace = [];

    while (walker.nextNode()) {
        const node = walker.currentNode;
        // Skip text inside script, style, or already highlighted marks
        if (node.parentNode &&
            ['SCRIPT', 'STYLE', 'MARK', 'TITLE'].includes(node.parentNode.nodeName)) {
            continue;
        }

        if (node.nodeValue.match(regex)) {
            nodesToReplace.push(node);
        }
    }

    nodesToReplace.forEach(node => {
        const span = document.createElement('span');
        span.innerHTML = node.nodeValue.replace(regex, '<mark class="search-highlight">$1</mark>');
        if (node.parentNode) {
            node.parentNode.replaceChild(span, node);
        }
    });

    // Expand details blocks if the highlight is inside them, then scroll
    const marks = document.querySelectorAll('.search-highlight');
    if (marks.length > 0) {
        const firstMark = marks[0];
        const details = firstMark.closest('details');
        if (details) details.setAttribute('open', '');

        firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}


/* --- LIGHTBOX (IMAGE ZOOM) --- */
document.addEventListener('DOMContentLoaded', () => {
    // Create the overlay container once
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    const overlayImg = document.createElement('img');
    overlay.appendChild(overlayImg);
    document.body.appendChild(overlay);

    // Close on click anywhere in the overlay
    overlay.addEventListener('click', () => {
        overlay.classList.remove('active');
        setTimeout(() => overlayImg.src = '', 300); // Clear after fade out
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            overlay.classList.remove('active');
            setTimeout(() => overlayImg.src = '', 300);
        }
    });

    // Attach click listeners to all article images
    const allImages = document.querySelectorAll('.content-wrap img:not(.sidebar-brand img, .site-footer img)');
    allImages.forEach(img => {
        img.addEventListener('click', () => {
            overlayImg.src = img.src;
            overlay.classList.add('active');
        });
    });
});


/* --- IMAGE UPLOAD LOGIC --- */
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    let currentTargetImage = null;

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || !currentTargetImage) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress and convert to Base64
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

                // Update the old text logic so reverse action works if needed
                const oldText = currentTargetImage.src;

                currentTargetImage.src = dataUrl;

                // NEW: Trigger save on parent container if it's part of a visual block
                if (typeof flagContainerForSave === 'function') {
                    flagContainerForSave(currentTargetImage);
                }

                // Trigger save so it's persisted instantly
                if (typeof savePageHTML === 'function') {
                    savePageHTML();
                }
                if (typeof showToast === 'function') {
                    showToast('Image updated successfully.');
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Intercept clicks on images when in editor mode
    document.body.addEventListener('click', (e) => {
        if (!document.body.classList.contains('editor-mode-active')) return;

        if (e.target.tagName.toLowerCase() === 'img' && e.target.closest('.content-wrap')) {
            e.preventDefault();
            e.stopPropagation();
            currentTargetImage = e.target;
            fileInput.click();
        }
    }, true);
});
