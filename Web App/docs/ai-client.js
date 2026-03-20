document.addEventListener('DOMContentLoaded', () => {
    const aiWidgetContainer = document.getElementById('ai-widget-container');
    const fab = document.getElementById('ai-fab');
    const modal = document.getElementById('ai-chat-modal');
    const btnClose = document.getElementById('ai-btn-close');
    const btnExpand = document.getElementById('ai-btn-expand');
    const inputField = document.getElementById('ai-chat-input');
    const submitBtn = document.getElementById('ai-chat-submit');
    const messagesContainer = document.getElementById('ai-chat-messages');
    const toolRibbon = document.getElementById('ai-tool-ribbon');

    let isFullScreen = false;
    let sessionId = "session_" + Math.random().toString(36).substring(2, 9);
    let isWaitingForResponse = false;

    // --- User Context Helpers ---
    const detectMunicipality = (username) => {
        if (!username) return '';
        const u = username.toLowerCase();
        if (u.includes('revelstoke')) return 'revelstoke';
        if (u.includes('golden')) return 'golden';
        if (u.includes('salmonarm') || u.includes('salmon_arm')) return 'salmonarm';
        if (u.includes('sicamous')) return 'sicamous';
        return '';
    };

    const getUserContext = () => {
        try {
            const userStr = localStorage.getItem('csrd_arcgis_user');
            const user = userStr ? JSON.parse(userStr) : null;
            const username = user ? user.username : 'anonymous';

            // Mirror admin check from auth.js
            const uLower = username.toLowerCase();
            const admins = ['csrd_service', 'csrd_gis', 'dmajor@csrd'];
            const isAdmin = admins.includes(uLower) || uLower === 'csrd' || uLower.includes('admin');

            return {
                username: username,
                is_admin: isAdmin,
                municipality: detectMunicipality(username),
                current_page: window.location.hash.substring(1) || 'home'
            };
        } catch (e) {
            return { username: 'anonymous', is_admin: false, municipality: '', current_page: '' };
        }
    };

    // --- Wrap tables for horizontal scroll ---
    const wrapTables = (container) => {
        container.querySelectorAll('table').forEach(table => {
            if (table.parentElement.classList.contains('table-wrap')) return;
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrap';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        });
    };

    // --- Navigation Command Processing ---
    const processNavigationCommands = (container) => {
        const html = container.innerHTML;
        // Match {{nav:route#elementId|Label}} or {{nav:route|Label}}
        const processed = html.replace(
            /\{\{nav:([^#|}]+)(?:#([^|}]+))?\|([^}]+)\}\}/g,
            (match, route, elementId, label) => {
                const dataEl = elementId ? ` data-element="${elementId}"` : '';
                return `<button class="ai-nav-btn" data-route="${route}"${dataEl} onclick="window.handleAINavigation(this)"><i class="fas fa-arrow-right"></i> ${label}</button>`;
            }
        );
        if (processed !== html) {
            container.innerHTML = processed;
        }
    };

    // Global navigation handler
    window.handleAINavigation = function(btn) {
        const route = btn.dataset.route;
        const elementId = btn.dataset.element;

        const scrollToElement = () => {
            if (!elementId) return;

            // Poll for the element (the router may still be loading the partial)
            let attempts = 0;
            const poll = setInterval(() => {
                attempts++;
                const el = document.getElementById(elementId)
                    || document.querySelector(`[data-field="${elementId}"]`);

                if (el) {
                    clearInterval(poll);

                    // Expand parent group if it's collapsed
                    const groupBody = el.closest('.field-group-body');
                    if (groupBody && groupBody.classList.contains('collapsed')) {
                        groupBody.classList.remove('collapsed');
                        const header = groupBody.previousElementSibling;
                        if (header && header.classList.contains('field-group-header')) {
                            header.classList.remove('collapsed');
                        }
                    }

                    // Small delay to let any CSS transitions finish
                    setTimeout(() => {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('ai-highlight');
                        setTimeout(() => el.classList.remove('ai-highlight'), 3000);
                    }, 100);
                }

                if (attempts >= 20) clearInterval(poll); // Give up after 4 seconds
            }, 200);
        };

        // Check if we're already on the target page
        const currentHash = window.location.hash.substring(1) || '';
        if (currentHash === route) {
            // Already on the page — just scroll
            scrollToElement();
        } else {
            // Navigate, then scroll once the page loads
            window.location.hash = route;
            scrollToElement();
        }
    };

    // --- State Toggles ---
    fab.addEventListener('click', () => {
        aiWidgetContainer.classList.remove('ai-widget-closed');
        aiWidgetContainer.classList.add('ai-widget-open');
        inputField.focus();
    });

    btnClose.addEventListener('click', () => {
        aiWidgetContainer.classList.remove('ai-widget-open');
        aiWidgetContainer.classList.add('ai-widget-closed');
        // Reset full screen if closed
        if (isFullScreen) {
            isFullScreen = false;
            aiWidgetContainer.classList.remove('ai-widget-fullscreen');
            btnExpand.innerHTML = '<i class="fas fa-expand"></i>';
        }
    });

    btnExpand.addEventListener('click', () => {
        isFullScreen = !isFullScreen;
        if (isFullScreen) {
            aiWidgetContainer.classList.add('ai-widget-fullscreen');
            btnExpand.innerHTML = '<i class="fas fa-compress"></i>';
        } else {
            aiWidgetContainer.classList.remove('ai-widget-fullscreen');
            btnExpand.innerHTML = '<i class="fas fa-expand"></i>';
        }
    });

    // --- Message Handling ---
    const appendMessage = (role, text) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `ai-message ai-message-${role}`;
        
        // Use Marked.js for AI responses
        if (role === 'assistant' && typeof marked !== 'undefined') {
            msgDiv.innerHTML = marked.parse(text);
        } else {
            msgDiv.textContent = text;
        }
        
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return msgDiv;
    };

    const submitMessage = async () => {
        if (isWaitingForResponse) return;
        const text = inputField.value.trim();
        if (!text) return;

        // Clear input, show user message
        inputField.value = '';
        inputField.style.height = 'auto'; // reset height
        appendMessage('user', text);
        isWaitingForResponse = true;
        
        toolRibbon.textContent = "";
        toolRibbon.style.display = "none";

        // Create a placeholder for the AI's streaming response
        const responseDiv = appendMessage('assistant', '');
        let accumulatedText = "";

        try {
            // Dynamically resolve backend IP from config.js (supports reverse proxies like Ngrok/Cloudflare)
            let aiHostUrl = `http://${window.location.hostname || 'localhost'}:8000`; // Fallback
            try {
                const cfgModule = await import('./config.js');
                if (cfgModule.config && cfgModule.config.aiServerUrl) {
                    aiHostUrl = cfgModule.config.aiServerUrl;
                }
            } catch (cfgErr) {
                console.warn("Could not load config for AI Server URL, using dynamic fallback.", cfgErr);
            }
            
            // Using Fetch POST to read SSE stream via dynamic backend URL
            const response = await fetch(`${aiHostUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    thread_id: sessionId,
                    user_context: getUserContext()
                })
            });

            if (!response.ok) throw new Error("API returned status " + response.status);

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep the last incomplete line in the buffer

                let currentEvent = null;

                for (const line of lines) {
                    if (line.startsWith('event:')) {
                        currentEvent = line.substring(6).trim();
                    } else if (line.startsWith('data:')) {
                        const dataStr = line.substring(5).trim();
                        if (currentEvent === 'message') {
                            const data = JSON.parse(dataStr);
                            if (data.chunk) {
                                accumulatedText += data.chunk;
                                // Update markdown dynamically
                                responseDiv.innerHTML = marked.parse(accumulatedText);
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                            }
                        } else if (currentEvent === 'tool') {
                            const data = JSON.parse(dataStr);
                            toolRibbon.style.display = "block";
                            toolRibbon.innerHTML = `<i class="fas fa-cog fa-spin"></i> Using tool: <code>${data.tool}</code>`;
                        } else if (currentEvent === 'error') {
                            const data = JSON.parse(dataStr);
                            accumulatedText += "\n\n**Error:** " + data.error;
                            responseDiv.innerHTML = marked.parse(accumulatedText);
                        } else if (currentEvent === 'done') {
                            toolRibbon.style.display = "none";
                            // Process navigation commands in the final response
                            processNavigationCommands(responseDiv);
                            wrapTables(responseDiv);
                        }
                    }
                }
            }
        } catch (error) {
            accumulatedText += "\n\n**Connection Error:** Could not reach the AI backend.";
            responseDiv.innerHTML = marked.parse(accumulatedText);
        } finally {
            isWaitingForResponse = false;
            toolRibbon.style.display = "none";
        }
    };

    // --- Input Listeners ---
    submitBtn.addEventListener('click', submitMessage);

    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitMessage();
        }
    });

    // Auto-resize textarea
    inputField.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.scrollHeight > 150) {
            this.style.overflowY = 'auto';
        } else {
            this.style.overflowY = 'hidden';
        }
    });
});
