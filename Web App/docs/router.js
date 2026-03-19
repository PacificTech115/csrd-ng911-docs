import { config } from './config.js';
import { auth } from './auth.js?v=3';

class SPA_Router {
    constructor() {
        this.appRoot = document.getElementById('app-root');
        this.routes = {
            '': 'home.html', // default view
            'architecture': 'architecture.html',
            'schema-guide': 'schema-guide.html',
            'attribute-rules': 'attribute-rules.html',
            'rule-full-address': 'rule-full-address.html',
            'rule-nguid': 'rule-nguid.html',
            'rule-longitude': 'rule-longitude.html',
            'rule-latitude': 'rule-latitude.html',
            'rule-addcode': 'rule-addcode.html',
            'rule-dateupdate': 'rule-dateupdate.html',
            'rule-qastatus': 'rule-qastatus.html',
            'rule-defaultagency': 'rule-defaultagency.html',
            'rule-mandatory': 'rule-mandatory.html',
            'domains': 'domains.html',
            'automation-scripts': 'automation-scripts.html',
            'automations-dashboard': 'automations-dashboard.html',
            'gp-tools': 'gp-tools.html',
            'power-automate': 'power-automate.html',
            'script-orchestrator': 'script-orchestrator.html',
            'script-etl': 'script-etl.html',
            'script-qa': 'script-qa.html',
            'script-reconcile': 'script-reconcile.html',
            'script-export': 'script-export.html',
            'maintenance': 'maintenance.html',
            'system-resources': 'system-resources.html',
            'version-edits': 'version-edits.html',
            'quick-reference': 'quick-reference.html',
            'revelstoke': 'revelstoke.html',
            'golden': 'golden.html',
            'salmonarm': 'salmonarm.html',
            'sicamous': 'sicamous.html',
            'sync-app': 'sync-app.html'
        };

        // Enforce Authentication
        this.enforceAuth();
    }

    async enforceAuth() {
        // [DEV MODE BYPASS]: Allow local 8080 testing without getting 'invalid redirect uri' from ArcGIS Portal
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log("Local Dev Mode: Bypassing ArcGIS Authentication");
            
            // Mock a temporary user so the CMS and editor tools don't crash
            localStorage.setItem('csrd_arcgis_user', JSON.stringify({ username: "local_dev" }));
            localStorage.setItem('csrd_arcgis_token', 'dev_token_123');
            localStorage.setItem('csrd_arcgis_expires', (Date.now() + 86400000).toString());

            await window.cms.fetchAllContent();
            this.buildSidebarNav();
            this.initRouter();
            return;
        }

        // Blocks rendering until auth is verified (Production Behavior)
        await auth.init();

        if (auth.isAuthenticated()) {
            await window.cms.fetchAllContent();
            this.buildSidebarNav();
            this.initRouter();
        } else {
            this.showLoginScreen();
        }
    }

    showLoginScreen() {
        // Hide sidebar
        document.getElementById('sidebar').style.display = 'none';

        // Adjust main content area to take full width
        const mainArea = document.querySelector('.main');
        if (mainArea) {
            mainArea.style.marginLeft = '0';
        }

        this.appRoot.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; gap: 20px; font-family: 'Inter', sans-serif;">
                <img src="csrd-logo.png" alt="CSRD Logo" style="max-width: 250px; margin-bottom: 20px;">
                <h1 style="color: var(--navy); font-family: 'Poppins', sans-serif; font-size: 2.5rem; margin: 0;">CSRD NG911 Documentation</h1>
                <p style="color: var(--text-secondary); max-width: 600px; font-size: 1.1rem; line-height: 1.6;">Welcome to the Columbia Shuswap Regional District NG911 mapping documentation hub. Please sign in with your ArcGIS Enterprise Portal account to securely access the architectural schema and municipal user guides.</p>
                <button id="btn-login-portal" style="margin-top: 20px; background-color: var(--teal); color: white; border: none; padding: 15px 30px; font-size: 1.1rem; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; gap: 10px; align-items: center; transition: all 0.2s ease;">
                    <i class="fas fa-sign-in-alt"></i> Sign in to CSRD Portal
                </button>
            </div>
        `;

        // Add hover effect
        const btn = document.getElementById('btn-login-portal');
        btn.addEventListener('mouseenter', () => btn.style.transform = 'translateY(-2px)');
        btn.addEventListener('mouseleave', () => btn.style.transform = 'none');

        btn.addEventListener('click', () => {
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Redirecting...';
            auth.login();
        });
    }

    initRouter() {
        // Restore layout if coming from login screen
        document.getElementById('sidebar').style.display = 'flex';
        const mainArea = document.querySelector('.main');
        if (mainArea) {
            mainArea.style.marginLeft = '';
        }

        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute(); // Execute immediately on load
    }

    async handleRoute() {
        const hash = window.location.hash.substring(1) || '';
        if (!this.routes[hash]) {
            this.appRoot.innerHTML = '<h2>404 - Page Not Found</h2><p>The requested document does not exist.</p>';
            return;
        }

        // --- AUTHORIZATION CHECK ---
        const user = auth.getUser();

        // If it's a municipal guide, check access
        const restrictedRoutes = ['revelstoke', 'golden', 'salmonarm', 'sicamous'];
        if (restrictedRoutes.includes(hash)) {
            if (!auth.hasAccessTo(hash)) {
                this.appRoot.innerHTML = `<div class="alert danger">
            <i class="fas fa-ban"></i> Access Denied. Your ArcGIS account (${user.username}) does not have permission to view the ${hash.charAt(0).toUpperCase() + hash.slice(1)} User Guide.
                </div>`;
                return;
            }
        }

        // Load Content
        try {
            const response = await fetch(`docs/partials/${this.routes[hash]}?t=${Date.now()}`);
            if (response.ok) {
                const htmlContent = await response.text();
                this.appRoot.innerHTML = htmlContent;

                // Apply CMS text/links before showing to user
                if (window.cms) {
                    window.cms.applyContentToDOM(this.appRoot);
                }

                this.enforcePageRBAC(hash);
                this.initializePageScripts(hash);

                // Highlight active nav link
                document.querySelectorAll('.sidebar-nav a').forEach(a => {
                    a.classList.remove('active');
                    if (a.getAttribute('href') === `#${hash}`) {
                        a.classList.add('active');
                    }
                });

                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'instant' });
            } else {
                throw new Error(response.statusText);
            }
        } catch (error) {
            console.error('Failed to load page content:', error);
            this.appRoot.innerHTML = '<h2>Error loading content</h2><p>Could not fetch the requested document.</p>';
        }
    }

    initializePageScripts(hash = '') {
        // Re-run scroll reveals since the DOM changed
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

        // Initialize search engine if the search box exists on this page
        if (typeof window.initSearch === 'function') {
            window.initSearch();
        }

        // Initialize doc-toggle expandable sections
        document.querySelectorAll('.doc-toggle').forEach(btn => {
            if (btn.dataset.toggleBound) return;
            btn.dataset.toggleBound = 'true';
            btn.addEventListener('click', function () {
                const targetId = this.getAttribute('data-target');
                const target = document.getElementById(targetId);
                if (!target) return;
                const isExpanded = this.getAttribute('aria-expanded') === 'true';
                this.setAttribute('aria-expanded', String(!isExpanded));
                target.classList.toggle('collapsed');
                // Toggle chevron icon
                const icon = this.querySelector('i.fas');
                if (icon) {
                    icon.classList.toggle('fa-chevron-down');
                    icon.classList.toggle('fa-chevron-up');
                }
            });
        });

        // Initialize field-group-header toggles (Schema Guide collapsible tables)
        document.querySelectorAll('.field-group-header').forEach(header => {
            if (header.dataset.toggleBound) return;
            header.dataset.toggleBound = 'true';
            header.addEventListener('click', function () {
                this.classList.toggle('collapsed');
                const body = this.nextElementSibling;
                if (body && body.classList.contains('field-group-body')) {
                    body.classList.toggle('collapsed');
                }
            });
        });

        // Initialize breakdown-card toggles (Attribute Rule section expand/collapse)
        document.querySelectorAll('.breakdown-card[data-section]').forEach(card => {
            if (card.dataset.toggleBound) return;
            card.dataset.toggleBound = 'true';
            card.addEventListener('click', function (e) {
                // Don't toggle if they clicked a link inside
                if (e.target.closest('a')) return;

                const wasExpanded = this.classList.contains('expanded');
                // Collapse all cards first
                document.querySelectorAll('.breakdown-card.expanded').forEach(c => c.classList.remove('expanded'));
                // Clear all code highlights
                document.querySelectorAll('.code-section.highlighted').forEach(s => s.classList.remove('highlighted'));

                if (!wasExpanded) {
                    this.classList.add('expanded');
                    // Highlight corresponding code section
                    const sectionId = this.getAttribute('data-section');
                    const codeSection = document.querySelector(`.code-section[data-section="${sectionId}"]`);
                    if (codeSection) {
                        codeSection.classList.add('highlighted');
                        // Open the source code details if closed
                        const details = codeSection.closest('details');
                        if (details && !details.open) details.open = true;
                        // Scroll the code section into view
                        setTimeout(() => codeSection.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
                    }
                }
            });
        });

        // Let editor-core.js know we navigated
        if (typeof window.initEditorUI === 'function') {
            window.initEditorUI();
        }

        // Attach Tokenized Download Handlers for ArcGIS Portal Items
        const pitemxBtnIds = [
            'btn-revelstoke-pitemx', 'home-btn-revelstoke-pitemx',
            'btn-golden-pitemx', 'home-btn-golden-pitemx',
            'btn-sicamous-pitemx', 'home-btn-sicamous-pitemx'
        ];

        const serviceMap = config.services.municipalEdit;

        pitemxBtnIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    
                    const token = auth.getToken();
                    if (!token) {
                        alert("Authentication token expired. Please reload the page to sign in again before downloading.");
                        return;
                    }
                    
                    // Determine which service URL to use based on the button ID
                    let serviceUrl = '';
                    if (id.includes('revelstoke')) serviceUrl = serviceMap['revelstoke'];
                    else if (id.includes('golden')) serviceUrl = serviceMap['golden'];
                    else if (id.includes('sicamous')) serviceUrl = serviceMap['sicamous'];

                    if (!serviceUrl) return;

                    // Provide visual feedback while fetching the Item ID
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';
                    btn.style.pointerEvents = 'none';
                    if (window.showToast) window.showToast('Locating Portal Item...');

                    try {
                        // 1. Fetch the Feature Service metadata
                        const response = await fetch(`${serviceUrl}?f=json&token=${token}`);
                        const data = await response.json();

                        if (data.error) throw new Error(data.error.message || "Failed to fetch service metadata");
                        if (!data.serviceItemId) throw new Error("Feature Service does not have an underlying serviceItemId.");

                        const itemId = data.serviceItemId;

                        // 2. Build the authenticated REST API endpoint requesting the pitemx from the Portal Item
                        const downloadUrl = `${config.portalUrl}/sharing/rest/content/items/${itemId}/item.pitemx?token=${token}`;
                        
                        // Fire the download
                        window.location.href = downloadUrl;
                        if (window.showToast) window.showToast('Download started.');

                    } catch (err) {
                        console.error("Download Error:", err);
                        alert("Could not generate download link: " + err.message);
                    } finally {
                        // Restore button state
                        btn.innerHTML = originalText;
                        btn.style.pointerEvents = 'auto';
                    }
                });
            }
        });

        // --- Dynamic Script Loading for specific routes ---
        if (hash === 'sync-app') {
            if (typeof window.initSyncAppModule === 'function') {
                window.initSyncAppModule();
            } else {
                const script = document.createElement('script');
                script.src = `docs/sync-app.js?v=${Date.now()}`;
                document.body.appendChild(script);
            }
        } else if (hash === 'automations-dashboard') {
            import(`./automations-dashboard.js?v=${Date.now()}`).then(module => {
                module.initAutomationsDashboard();
            }).catch(e => console.error("Failed to load automations dashboard module", e));
        } else if (['script-qa', 'script-reconcile', 'script-export'].includes(hash)) {
            import(`./gp-runner.js?v=${Date.now()}`).then(module => {
                module.initGPRunner(hash);
            }).catch(e => console.error("Failed to load GP runner module", e));
        }
    }

    enforcePageRBAC(hash) {
        const user = auth.getUser();
        const isAdmin = auth.isAdmin ? auth.isAdmin() : false;

        // Apply municipal branding to the sidebar logo
        this.applyMunicipalBranding(user, isAdmin);

        if (hash === '' || hash === 'home') {

            if (!isAdmin) {
                // Hide admin-only cards
                document.querySelectorAll('[data-admin-only="true"]').forEach(el => el.remove());

                // Update municipal guide link to point directly to their specific municipality
                const uName = (user && user.username) ? user.username.toLowerCase() : '';
                const muniCard = document.getElementById('municipal-guide-card');

                let targetMuni = null;
                if (muniCard) {
                    if (uName.includes('revelstoke')) {
                        muniCard.setAttribute('href', '#revelstoke');
                        targetMuni = 'revelstoke';
                    } else if (uName.includes('golden')) {
                        muniCard.setAttribute('href', '#golden');
                        targetMuni = 'golden';
                    } else if (uName.includes('salmonarm') || uName.includes('salmon_arm')) {
                        muniCard.setAttribute('href', '#salmonarm');
                        targetMuni = 'salmonarm';
                    } else if (uName.includes('sicamous')) {
                        muniCard.setAttribute('href', '#sicamous');
                        targetMuni = 'sicamous';
                    } else {
                        muniCard.remove();
                    }
                }

                // Aggressively scan and filter Quick Actions grid
                const quickActionsGrid = document.querySelector('#quick-actions .grid-2');
                if (quickActionsGrid) {
                    const cards = Array.from(quickActionsGrid.querySelectorAll('a, .nav-card'));

                    cards.forEach(card => {
                        const text = (card.textContent || '').toLowerCase();
                        let isTarget = false;
                        if (targetMuni === 'revelstoke' && text.includes('revelstoke')) isTarget = true;
                        if (targetMuni === 'golden' && text.includes('golden')) isTarget = true;
                        if (targetMuni === 'salmonarm' && (text.includes('salmon arm') || text.includes('salmonarm'))) isTarget = true;
                        if (targetMuni === 'sicamous' && text.includes('sicamous')) isTarget = true;

                        if (!isTarget) {
                            card.remove(); // Nuke from DOM
                        } else {
                            card.style.setProperty('display', 'flex', 'important');
                        }
                    });

                    if (targetMuni) {
                        const quickActionsSection = document.getElementById('quick-actions');
                        if (quickActionsSection) quickActionsSection.style.setProperty('display', 'block', 'important');
                    }
                }
            } else {
                // Admins see everything, but we can default their municipal guide card to revelstoke or keep it generic
                const muniCard = document.getElementById('municipal-guide-card');
                if (muniCard) muniCard.setAttribute('href', '#revelstoke');

                // Show Quick Actions section for Admins as well
                const quickActionsSection = document.getElementById('quick-actions');
                if (quickActionsSection) quickActionsSection.style.setProperty('display', 'block', 'important');

                const quickActionsGrid = document.querySelector('#quick-actions .grid-2');
                if (quickActionsGrid) {
                    const cards = Array.from(quickActionsGrid.querySelectorAll('a, .nav-card'));
                    cards.forEach(card => card.style.setProperty('display', 'flex', 'important'));
                }
            }
        }
    }

    applyMunicipalBranding(user, isAdmin) {
        if (!user) return;
        const uName = user.username.toLowerCase();
        const logo = document.getElementById('sidebar-logo');
        const brandTitle = document.getElementById('sidebar-brand-title');

        const muniConfig = {
            'revelstoke': {
                name: 'City of Revelstoke',
                logo: 'docs/assets/revelstoke/Revelstoke.png'
            },
            'golden': {
                name: 'Town of Golden',
                logo: 'docs/assets/golden/Golden.jpg'
            },
            'salmonarm': {
                name: 'City of Salmon Arm',
                logo: 'docs/assets/salmonarm/SalmonArm.png'
            },
            'sicamous': {
                name: 'District of Sicamous',
                logo: 'docs/assets/sicamous/Sicamous.png'
            }
        };

        // Only apply municipal sidebar branding for non-admin users
        // Hero title is now fully CMS-controlled, so we don't touch it here
        if (!isAdmin) {
            for (const [key, config] of Object.entries(muniConfig)) {
                if (uName.includes(key)) {
                    if (config.logo && logo) logo.src = config.logo;
                    if (brandTitle) brandTitle.textContent = config.name;
                    break;
                }
            }
        }
    }

    buildSidebarNav() {
        const nav = document.getElementById('dynamic-nav');
        const user = auth.getUser();
        const isAdmin = auth.isAdmin ? auth.isAdmin() : (user.username.toLowerCase() === 'csrd' || user.username.toLowerCase().includes('admin'));

        // Define allowed pages for search scope filtering
        const baseMuniPages = ['home.html', 'architecture.html', 'schema-guide.html', 'attribute-rules.html',
            'rule-full-address.html', 'rule-nguid.html', 'rule-longitude.html', 'rule-latitude.html',
            'rule-addcode.html', 'rule-dateupdate.html', 'rule-qastatus.html', 'rule-defaultagency.html',
            'rule-mandatory.html', 'domains.html', 'script-orchestrator.html', 'script-etl.html',
            'script-qa.html', 'script-reconcile.html', 'script-export.html'];

        if (isAdmin) {
            window.CSRD_ALLOWED_PAGES = null; // null = all pages allowed
        } else {
            const uName = user.username.toLowerCase();
            const allowedPages = [...baseMuniPages];
            if (uName.includes('revelstoke')) allowedPages.push('revelstoke.html');
            else if (uName.includes('golden')) allowedPages.push('golden.html');
            else if (uName.includes('salmonarm')) allowedPages.push('salmonarm.html');
            else if (uName.includes('sicamous')) allowedPages.push('sicamous.html');
            window.CSRD_ALLOWED_PAGES = allowedPages;
        }

        let navHtml = `
            <a href="#"><i class="fas fa-home"></i> Home</a>
            <a href="#architecture"><i class="fas fa-sitemap"></i> Architecture</a>
            <div class="nav-group-label">Technical Documentation</div>
            <div class="nav-sub-label">Database</div>
            <a href="#schema-guide" class="nav-indent"><i class="fas fa-table-columns"></i> Schema Guide</a>
            <a href="#attribute-rules" class="nav-indent"><i class="fas fa-wand-magic-sparkles"></i> Attribute Rules</a>
            <a href="#domains" class="nav-indent"><i class="fas fa-list-check"></i> Domains</a>
        `;

        if (isAdmin) {
            navHtml += `
            <div class="nav-sub-label">Automations</div>
            <a href="#automations-dashboard" class="nav-indent"><i class="fas fa-chart-line"></i> Dashboard</a>
            <a href="#automation-scripts" class="nav-indent"><i class="fas fa-robot"></i> ArcGIS Notebooks</a>
            <a href="#gp-tools" class="nav-indent"><i class="fas fa-gears"></i> GP Tools</a>
            <a href="#power-automate" class="nav-indent"><i class="fas fa-envelope"></i> Power Automate</a>
            <div class="nav-group-label">Maintenance Guide</div>
            <a href="#maintenance"><i class="fas fa-wrench"></i> Maintenance</a>
            <a href="#system-resources"><i class="fas fa-link"></i> System Resources</a>
            `;
        }

        const hasRevelstoke = isAdmin || user.username.toLowerCase().includes('revelstoke');
        const hasGolden = isAdmin || user.username.toLowerCase().includes('golden');
        const hasSalmonarm = isAdmin || user.username.toLowerCase().includes('salmonarm');
        const hasSicamous = isAdmin || user.username.toLowerCase().includes('sicamous');

        if (hasRevelstoke || hasGolden || hasSalmonarm || hasSicamous) {
            navHtml += `<div class="nav-group-label">Municipal Guides</div>`;
            if (hasRevelstoke) navHtml += `<a href="#revelstoke" class="nav-indent"><i class="fas fa-city"></i> Revelstoke</a>`;
            if (hasGolden) navHtml += `<a href="#golden" class="nav-indent"><i class="fas fa-city"></i> Golden</a>`;
            if (hasSalmonarm) navHtml += `<a href="#salmonarm" class="nav-indent"><i class="fas fa-city"></i> Salmon Arm</a>`;
            if (hasSicamous) navHtml += `<a href="#sicamous" class="nav-indent"><i class="fas fa-city"></i> Sicamous</a>`;
            
            navHtml += `
            <div class="nav-group-label">Tools</div>
            <a href="#sync-app"><i class="fas fa-sync"></i> Data Sync App</a>
            `;
        }

        if (isAdmin) {
            navHtml += `
            <div class="nav-group-label">Version Control</div>
            <a href="#version-edits"><i class="fas fa-history"></i> Version Edits</a>
            <div class="nav-group-label">Quick Reference</div>
            <a href="#quick-reference"><i class="fas fa-bolt"></i> Quick Reference</a>
            `;
        }

        nav.innerHTML = navHtml;

        // User info & Editor Toggle
        const sidebarBrand = document.querySelector('.sidebar-brand');

        // Remove existing dynamic content if re-rendering
        const existingInfo = sidebarBrand.querySelector('.user-info-box');
        if (existingInfo) existingInfo.remove();

        const userInfo = document.createElement('div');
        userInfo.className = 'user-info-box';
        userInfo.style.marginTop = '15px';
        userInfo.style.fontSize = '0.8rem';
        userInfo.style.color = 'var(--text-secondary)';
        userInfo.innerHTML = `<i class="fas fa-user-circle"></i> Logged in as: <strong>${user.username}</strong> <br> <a href="#" id="logout-btn" style="color:var(--red); text-decoration:none; display:inline-block; margin-top:5px;"><i class="fas fa-sign-out-alt"></i> Logout</a>`;

        // If the user is an Editor based on their ArcGIS Role, inject the toggle
        if (auth.isEditor()) {
            userInfo.innerHTML += `
            <div class="editor-toggle-container" style="margin-top:15px; background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#fff; font-weight:600;"><i class="fas fa-pen-to-square"></i> Edit Docs</span>
                <label class="switch">
                    <input type="checkbox" id="editorToggle" ${localStorage.getItem('csrd_editor_mode') === 'true' ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
            </div>`;
        }

        sidebarBrand.appendChild(userInfo);

        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            auth.logout();
        });

        const toggle = document.getElementById('editorToggle');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                localStorage.setItem('csrd_editor_mode', e.target.checked);
                location.reload();
            });
        }
    }
}

// Start Application
window.csrdAuth = auth;
const app = new SPA_Router();
