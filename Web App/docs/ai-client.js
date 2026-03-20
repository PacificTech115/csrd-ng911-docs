document.addEventListener('DOMContentLoaded', () => {
    const aiWidgetContainer = document.getElementById('ai-widget-container');
    const fab = document.getElementById('ai-fab');
    const modal = document.getElementById('ai-chat-modal');
    const btnClose = document.getElementById('ai-btn-close');
    const btnExpand = document.getElementById('ai-btn-expand');
    const btnHistory = document.getElementById('ai-btn-history');
    const historySidebar = document.getElementById('ai-history-sidebar');
    const historyClose = document.getElementById('ai-history-close');
    const historyList = document.getElementById('ai-history-list');
    const newChatBtn = document.getElementById('ai-new-chat');
    const inputField = document.getElementById('ai-chat-input');
    const submitBtn = document.getElementById('ai-chat-submit');
    const messagesContainer = document.getElementById('ai-chat-messages');
    const toolRibbon = document.getElementById('ai-tool-ribbon');

    let isFullScreen = false;
    let isWaitingForResponse = false;
    let aiHostUrl = null; // resolved once on first use

    // --- Session Management (persistent per user) ---
    const getUsername = () => {
        try {
            const userStr = localStorage.getItem('csrd_arcgis_user');
            const user = userStr ? JSON.parse(userStr) : null;
            return user ? user.username : 'anonymous';
        } catch (e) { return 'anonymous'; }
    };

    const getSessionKey = () => `ai_session_${getUsername()}`;

    const loadOrCreateSession = () => {
        const stored = localStorage.getItem(getSessionKey());
        if (stored) return stored;
        const newId = "session_" + Math.random().toString(36).substring(2, 9);
        localStorage.setItem(getSessionKey(), newId);
        return newId;
    };

    let sessionId = loadOrCreateSession();

    const startNewSession = () => {
        sessionId = "session_" + Math.random().toString(36).substring(2, 9);
        localStorage.setItem(getSessionKey(), sessionId);
        messagesContainer.innerHTML = `
            <div class="ai-message ai-message-assistant">
                Hi! I'm the NG911 AI Assistant. You can ask me about schema fields, attribute rules, or system automation scripts.
            </div>`;
    };

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
        const username = getUsername();
        const uLower = username.toLowerCase();
        const admins = ['csrd_service', 'csrd_gis', 'dmajor@csrd'];
        const isAdmin = admins.includes(uLower) || uLower === 'csrd' || uLower.includes('admin');
        return {
            username: username,
            is_admin: isAdmin,
            municipality: detectMunicipality(username),
            current_page: window.location.hash.substring(1) || 'home'
        };
    };

    // --- Resolve backend URL (once) ---
    const resolveHostUrl = async () => {
        if (aiHostUrl) return aiHostUrl;
        try {
            const cfgModule = await import('./config.js');
            if (cfgModule.config && cfgModule.config.aiServerUrl) {
                aiHostUrl = cfgModule.config.aiServerUrl;
            }
        } catch (e) {
            console.warn("Could not load config for AI Server URL, using dynamic fallback.", e);
        }
        if (!aiHostUrl) {
            aiHostUrl = `http://${window.location.hostname || 'localhost'}:8000`;
        }
        return aiHostUrl;
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
            let attempts = 0;
            const poll = setInterval(() => {
                attempts++;
                const el = document.getElementById(elementId)
                    || document.querySelector(`[data-field="${elementId}"]`);
                if (el) {
                    clearInterval(poll);
                    const groupBody = el.closest('.field-group-body');
                    if (groupBody && groupBody.classList.contains('collapsed')) {
                        groupBody.classList.remove('collapsed');
                        const header = groupBody.previousElementSibling;
                        if (header && header.classList.contains('field-group-header')) {
                            header.classList.remove('collapsed');
                        }
                    }
                    setTimeout(() => {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.classList.add('ai-highlight');
                        setTimeout(() => el.classList.remove('ai-highlight'), 3000);
                    }, 100);
                }
                if (attempts >= 20) clearInterval(poll);
            }, 200);
        };

        const currentHash = window.location.hash.substring(1) || '';
        if (currentHash === route) {
            scrollToElement();
        } else {
            window.location.hash = route;
            scrollToElement();
        }
    };

    // --- Conversation History ---
    const loadConversationHistory = async () => {
        const url = await resolveHostUrl();
        const username = getUsername();
        try {
            const res = await fetch(`${url}/api/conversations?username=${encodeURIComponent(username)}`);
            if (!res.ok) return;
            const conversations = await res.json();

            if (conversations.length === 0) {
                historyList.innerHTML = '<div class="ai-history-empty">No past conversations</div>';
                return;
            }

            historyList.innerHTML = conversations.map(c => `
                <div class="ai-history-item" data-thread-id="${c.thread_id}">
                    <div class="ai-history-item-content">
                        <div class="ai-history-item-title">${c.title}</div>
                        <div class="ai-history-item-date">${new Date(c.updated_at + 'Z').toLocaleDateString()}</div>
                    </div>
                    <button class="ai-history-item-delete" data-thread-id="${c.thread_id}" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            `).join('');

            // Click to load conversation
            historyList.querySelectorAll('.ai-history-item-content').forEach(item => {
                item.addEventListener('click', () => {
                    const threadId = item.parentElement.dataset.threadId;
                    loadConversation(threadId);
                });
            });

            // Click to delete
            historyList.querySelectorAll('.ai-history-item-delete').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const threadId = btn.dataset.threadId;
                    await fetch(`${url}/api/conversations/${threadId}`, { method: 'DELETE' });
                    btn.closest('.ai-history-item').remove();
                    if (historyList.children.length === 0) {
                        historyList.innerHTML = '<div class="ai-history-empty">No past conversations</div>';
                    }
                });
            });
        } catch (e) {
            console.error("Failed to load conversation history:", e);
            historyList.innerHTML = '<div class="ai-history-empty">Could not load history</div>';
        }
    };

    const loadConversation = async (threadId) => {
        const url = await resolveHostUrl();
        try {
            const res = await fetch(`${url}/api/conversations/${threadId}`);
            if (!res.ok) throw new Error("Not found");
            const data = await res.json();

            // Switch to this thread
            sessionId = threadId;
            localStorage.setItem(getSessionKey(), threadId);

            // Clear and re-render messages
            messagesContainer.innerHTML = '';
            for (const msg of data.messages) {
                appendMessage(msg.role === 'user' ? 'user' : 'assistant', msg.content);
            }

            // Close sidebar
            historySidebar.classList.remove('open');
        } catch (e) {
            console.error("Failed to load conversation:", e);
        }
    };

    // History sidebar toggle
    if (btnHistory) {
        btnHistory.addEventListener('click', () => {
            historySidebar.classList.add('open');
            loadConversationHistory();
        });
    }
    if (historyClose) {
        historyClose.addEventListener('click', () => {
            historySidebar.classList.remove('open');
        });
    }
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            startNewSession();
            historySidebar.classList.remove('open');
        });
    }

    // --- State Toggles ---
    fab.addEventListener('click', () => {
        aiWidgetContainer.classList.remove('ai-widget-closed');
        aiWidgetContainer.classList.add('ai-widget-open');
        inputField.focus();
    });

    btnClose.addEventListener('click', () => {
        aiWidgetContainer.classList.remove('ai-widget-open');
        aiWidgetContainer.classList.add('ai-widget-closed');
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

        inputField.value = '';
        inputField.style.height = 'auto';
        appendMessage('user', text);
        isWaitingForResponse = true;

        toolRibbon.textContent = "";
        toolRibbon.style.display = "none";

        // Create response bubble with thinking animation
        const responseDiv = appendMessage('assistant', '');
        responseDiv.innerHTML = '<div class="ai-thinking"><span></span><span></span><span></span></div>';
        let accumulatedText = "";
        let thinkingCleared = false;

        try {
            const url = await resolveHostUrl();

            const response = await fetch(`${url}/api/chat`, {
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
                buffer = lines.pop();

                let currentEvent = null;

                for (const line of lines) {
                    if (line.startsWith('event:')) {
                        currentEvent = line.substring(6).trim();
                    } else if (line.startsWith('data:')) {
                        const dataStr = line.substring(5).trim();
                        if (currentEvent === 'message') {
                            const data = JSON.parse(dataStr);
                            if (data.chunk) {
                                // Clear thinking animation on first token
                                if (!thinkingCleared) {
                                    thinkingCleared = true;
                                }
                                accumulatedText += data.chunk;
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
