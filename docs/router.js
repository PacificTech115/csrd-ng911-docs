import { auth } from './auth.js';

class SPA_Router {
    constructor() {
        this.appRoot = document.getElementById('app-root');
        this.routes = {
            '': 'home.html', // default view
            'architecture': 'architecture.html',
            'schema-guide': 'schema-guide.html',
            'attribute-rules': 'attribute-rules.html',
            'domains': 'domains.html',
            'automation-scripts': 'automation-scripts.html',
            'gp-tools': 'gp-tools.html',
            'power-automate': 'power-automate.html',
            'maintenance': 'maintenance.html',
            'version-edits': 'version-edits.html',
            'quick-reference': 'quick-reference.html',
            'revelstoke': 'revelstoke.html',
            'golden': 'golden.html',
            'salmonarm': 'salmonarm.html',
            'sicamous': 'sicamous.html'
        };

        // Enforce Authentication
        this.enforceAuth();
    }

    async enforceAuth() {
        // Blocks rendering until auth is verified
        await auth.init();

        if (auth.isAuthenticated()) {
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
                this.appRoot.innerHTML = `< div class="alert danger" >
            <i class="fas fa-ban"></i> Access Denied.Your ArcGIS account(${user.username}) does not have permission to view the ${hash.charAt(0).toUpperCase() + hash.slice(1)} User Guide.
                </div > `;
                return;
            }
        }

        // Load Content
        try {
            const response = await fetch(`partials / ${this.routes[hash]} `);
            if (response.ok) {
                const htmlContent = await response.text();
                this.appRoot.innerHTML = htmlContent;
                this.initializePageScripts();

                // Highlight active nav link
                document.querySelectorAll('.sidebar-nav a').forEach(a => {
                    a.classList.remove('active');
                    if (a.getAttribute('href') === `#${hash} `) {
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

    initializePageScripts() {
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

        // Let editor-core.js know we navigated
        if (typeof window.initEditorUI === 'function') {
            window.initEditorUI();
        }
    }

    buildSidebarNav() {
        const nav = document.getElementById('dynamic-nav');
        let navHtml = `
            < a href = "#" > <i class="fas fa-home"></i> Home</a >
            <a href="#architecture"><i class="fas fa-sitemap"></i> Architecture</a>
            <div class="nav-group-label">1. Technical Documentation</div>
            <div class="nav-sub-label">Database</div>
            <a href="#schema-guide" class="nav-indent"><i class="fas fa-table-columns"></i> Schema Guide</a>
            <a href="#attribute-rules" class="nav-indent"><i class="fas fa-wand-magic-sparkles"></i> Attribute Rules</a>
            <a href="#domains" class="nav-indent"><i class="fas fa-list-check"></i> Domains</a>
            <div class="nav-sub-label">Automations</div>
            <a href="#automation-scripts" class="nav-indent"><i class="fas fa-robot"></i> ArcGIS Notebooks</a>
            <a href="#gp-tools" class="nav-indent"><i class="fas fa-gears"></i> GP Tools</a>
            <a href="#power-automate" class="nav-indent"><i class="fas fa-envelope"></i> Power Automate</a>
            <div class="nav-group-label">2. Maintenance Guide</div>
            <a href="#maintenance"><i class="fas fa-wrench"></i> Maintenance</a>
        `;

        // Render Municipalities based on permissions
        const user = auth.getUser();
        const isAdmin = user.username.toLowerCase() === 'csrd' || user.username.toLowerCase().includes('admin');

        navHtml += `< div class="nav-group-label" > 3. Municipal Guides</div > `;

        if (isAdmin || user.username.toLowerCase().includes('revelstoke')) {
            navHtml += `< a href = "#revelstoke" class="nav-indent" > <i class="fas fa-city"></i> Revelstoke</a > `;
        }
        if (isAdmin || user.username.toLowerCase().includes('golden')) {
            navHtml += `< a href = "#golden" class="nav-indent" > <i class="fas fa-city"></i> Golden</a > `;
        }
        if (isAdmin || user.username.toLowerCase().includes('salmonarm')) {
            navHtml += `< a href = "#salmonarm" class="nav-indent" > <i class="fas fa-city"></i> Salmon Arm</a > `;
        }
        if (isAdmin || user.username.toLowerCase().includes('sicamous')) {
            navHtml += `< a href = "#sicamous" class="nav-indent" > <i class="fas fa-city"></i> Sicamous</a > `;
        }

        navHtml += `
            < div class="nav-group-label" > 4. Version Control</div >
            <a href="#version-edits"><i class="fas fa-history"></i> Version Edits</a>
            <div class="nav-group-label">5. Quick Reference</div>
            <a href="#quick-reference"><i class="fas fa-bolt"></i> Quick Reference</a>
        `;

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
        userInfo.innerHTML = `< i class="fas fa-user-circle" ></i > Logged in as: <strong>${user.username}</strong> <br> <a href="#" id="logout-btn" style="color:var(--red); text-decoration:none; display:inline-block; margin-top:5px;"><i class="fas fa-sign-out-alt"></i> Logout</a>`;

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
