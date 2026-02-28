/**
 * CSRD NG911 - Client-Side Editor Mode Prototype (Enhanced WYSIWYG)
 * Features: Context-Aware Tables/Lists, Enter-key Intercept, Expanded Toolbar, Revert Action
 */

document.addEventListener('DOMContentLoaded', () => {
    initEditorAuth();
    applySavedEdits();

    const authState = localStorage.getItem('csrd_editor_auth');
    const sidebar = document.querySelector('.sidebar-nav');

    if (sidebar) {
        if (authState !== 'true') {
            const loginLink = document.createElement('a');
            loginLink.href = '#';
            loginLink.innerHTML = '<i class="fas fa-lock"></i> Editor Login';
            loginLink.className = 'editor-login-btn';
            loginLink.onclick = (e) => { e.preventDefault(); showLoginModal(); };
            sidebar.appendChild(loginLink);
        } else {
            const toggleContainer = document.createElement('div');
            toggleContainer.className = 'editor-toggle-container';
            toggleContainer.innerHTML = `
                <span><i class="fas fa-pen-to-square"></i> Editor Mode</span>
                <label class="switch">
                    <input type="checkbox" id="editorToggle" ${localStorage.getItem('csrd_editor_mode') === 'true' ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            `;
            sidebar.appendChild(toggleContainer);

            const logoutLink = document.createElement('a');
            logoutLink.href = '#';
            logoutLink.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
            logoutLink.className = 'editor-logout-btn';
            logoutLink.onclick = (e) => {
                e.preventDefault();
                localStorage.removeItem('csrd_editor_auth');
                localStorage.removeItem('csrd_editor_mode');
                location.reload();
            };
            sidebar.appendChild(logoutLink);

            document.getElementById('editorToggle').addEventListener('change', (e) => {
                localStorage.setItem('csrd_editor_mode', e.target.checked);
                location.reload();
            });

            if (localStorage.getItem('csrd_editor_mode') === 'true') {
                enableEditMode();
            }
        }
    }
});

// --- AUTHENTICATION ---
function initEditorAuth() {
    const modalHtml = `
        <div id="loginModal" class="editor-modal">
            <div class="editor-modal-content">
                <h3>Editor Login</h3>
                <p>Please authenticate to access Edit Mode.</p>
                <input type="text" id="loginUser" placeholder="Username (CSRD)">
                <input type="password" id="loginPass" placeholder="Password">
                <div class="editor-modal-error" id="loginError"></div>
                <div class="editor-modal-actions">
                    <button onclick="closeLoginModal()" class="btn-cancel">Cancel</button>
                    <button onclick="attemptLogin()" class="btn-submit">Login</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.showLoginModal = function () {
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('loginUser').focus();
};

window.closeLoginModal = function () {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('loginError').textContent = '';
};

window.attemptLogin = function () {
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    if (user.toLowerCase() === 'csrd' && pass === '1234') {
        localStorage.setItem('csrd_editor_auth', 'true');
        location.reload();
    } else {
        document.getElementById('loginError').textContent = 'Invalid username or password.';
    }
};

// --- CORE EDITOR LOGIC ---
let activeNode = null;

function getPageId() {
    return window.location.pathname.split('/').pop() || 'Documentation.html';
}

function applySavedEdits() {
    const pageId = getPageId();
    if (pageId === 'version-edits.html') return;

    const savedHtml = localStorage.getItem(`csrd_page_${pageId}`);
    if (savedHtml) {
        const wrap = document.querySelector('.content-wrap');
        if (wrap) wrap.innerHTML = savedHtml;
    }
}

function enableEditMode() {
    document.body.classList.add('editor-mode-active');
    injectToolbar();
    makeNodesEditable();
    blockNavigation();
    showToast('WYSIWYG Editor Active. Toolbar at top.');
}

function blockNavigation() {
    const mainArea = document.querySelector('.main');
    if (!mainArea) return;

    mainArea.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        const btn = e.target.closest('button');

        if (e.target.closest('.editor-toolbar')) return;

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
    const selectors = '.content-wrap p, .content-wrap h1, .content-wrap h2, .content-wrap h3, .content-wrap h4, .content-wrap li, .content-wrap td, .card p, .card h4, .nav-card-body p, .nav-card-body h4';
    const nodes = document.querySelectorAll(selectors);

    nodes.forEach(node => {
        // Skip nodes inside details summary or code blocks or existing UI buttons
        if (node.closest('summary') || node.closest('.code-block') || node.closest('.editor-toolbar')) return;

        if (!node.classList.contains('editable-node')) {
            node.setAttribute('contenteditable', 'true');
            node.classList.add('editable-node');

            // Handle focus explicitly to update the toolbar context
            node.addEventListener('focus', function () {
                activeNode = this;
                document.querySelectorAll('.editable-node.focused').forEach(n => n.classList.remove('focused'));
                this.classList.add('focused');
                updateToolbarContext(this);
            });

            node.addEventListener('blur', function () {
                this.classList.remove('focused');
            });

            // Intercept Enter key inside p and li tags to spawn adjacent blocks instead of internal <br>
            node.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    const tag = this.tagName.toLowerCase();
                    if (tag === 'li' || tag === 'p' || tag === 'td') {
                        e.preventDefault();
                        activeNode = this;
                        // For tables, Enter won't add a whole row automatically to avoid chaos. 
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
}

// Update the labels of the Add/Delete buttons based on what is focused
function updateToolbarContext(node) {
    const btnAdd = document.getElementById('btnContextAdd');
    const btnDel = document.getElementById('btnContextDelete');
    const btnHeader = document.getElementById('btnContextAddHeader');
    const tag = node.tagName.toLowerCase();

    if (tag === 'td') {
        btnAdd.innerHTML = '<i class="fas fa-table-row"></i> <span>Add Row</span>';
        btnDel.innerHTML = '<i class="fas fa-trash"></i> <span>Del Row</span>';
        btnAdd.setAttribute('onclick', "addNode('tr')");
        btnHeader.style.display = 'none'; // Headers don't make sense inside tables usually
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

window.savePageHTML = function () {
    const wrap = document.querySelector('.content-wrap');
    if (!wrap) return;

    const clone = wrap.cloneNode(true);
    const editables = clone.querySelectorAll('.editable-node');

    editables.forEach(node => {
        node.removeAttribute('contenteditable');
        node.classList.remove('editable-node', 'focused', 'new-node-flash');
        if (node.classList.length === 0) node.removeAttribute('class');
    });

    const cleanHtml = clone.innerHTML;
    localStorage.setItem(`csrd_page_${getPageId()}`, cleanHtml);

    showToast('Page contents saved successfully!');
    trackEdit(getPageId(), "SAVE", "Page structural save", "Saved updated HTML");

    const btn = document.querySelector('.btn-save');
    btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
    setTimeout(() => { btn.innerHTML = '<i class="fas fa-save"></i> Save Page'; }, 2000);
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

// --- TAWK.TO REAL-TIME CHAT WIDGET ---
var Tawk_API = Tawk_API || {};
var Tawk_LoadStart = new Date();
(function () {
    // Note: To activate this chat widget, replace the placeholders with the actual
    // Direct Chat Link from your free Tawk.to account (https://dashboard.tawk.to).
    // Example: '65f1a2b3c4d5e6f7a8b9c0d1/1hp2q3r4s'
    const TAWK_PROPERTY_ID = 'YOUR_PROPERTY_ID_HERE/default';

    // Only load the script if a real property ID has been configured
    if (TAWK_PROPERTY_ID.includes('YOUR_PROPERTY_ID')) {
        console.warn('Tawk.to Chat Widget disabled: Pending Property ID configuration.');
        return;
    }

    var s1 = document.createElement("script"), s0 = document.getElementsByTagName("script")[0];
    s1.async = true;
    s1.src = 'https://embed.tawk.to/' + TAWK_PROPERTY_ID;
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    if (s0 && s0.parentNode) {
        s0.parentNode.insertBefore(s1, s0);
    } else {
        document.head.appendChild(s1);
    }
})();
