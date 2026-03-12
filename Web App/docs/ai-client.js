document.addEventListener('DOMContentLoaded', () => {
    // --- Authentication Check ---
    const token = localStorage.getItem('csrd_arcgis_token');
    const aiWidgetContainer = document.getElementById('ai-widget-container');
    
    // Auto-hide the entire widget if the user is not authenticated with the CSRD Portal
    if (!token) {
        if (aiWidgetContainer) aiWidgetContainer.style.display = 'none';
        return; // Stop initialization
    }

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
            // Using Fetch POST to read SSE stream via Ngrok tunnel
            const response = await fetch('https://cheryl-sandier-caylee.ngrok-free.dev/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: text, 
                    thread_id: sessionId,
                    token: token 
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
