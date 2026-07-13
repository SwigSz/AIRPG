// ============================================
// Activity Log Updates
// ============================================

const ActivityLog = (() => {
    let logs = [];
    let maxLogs = GameConfig?.UI?.ACTIVITY_LOG_MAX || 100;
    let filters = {
        combat: true,
        loot: true,
        general: true,
        events: true,
        system: true
    };

    function init() {
        // Listen to game events
        if (window.EventSystem) {
            EventSystem.on('log-message', add);
        }

        // Initialize filter checkboxes
        initFilters();

        // Wire up the map overlay log toggle
        initMapLogOverlay();
    }

    function initMapLogOverlay() {
        const toggle = document.getElementById('map-log-toggle');
        const overlay = document.getElementById('map-log-overlay');
        if (!toggle || !overlay) return;

        toggle.addEventListener('click', () => {
            overlay.classList.toggle('collapsed');

            // Persist expanded/collapsed preference
            const state = window.GameState?.getState();
            if (state) {
                if (!state.ui) state.ui = { activeTab: 'character', subTabs: {} };
                state.ui.mapLogExpanded = !overlay.classList.contains('collapsed');
                if (window.SaveSystem) SaveSystem.save();
            }

            // Jump to newest messages when opening
            if (!overlay.classList.contains('collapsed')) {
                const panel = overlay.querySelector('.map-log-panel');
                if (panel) panel.scrollTop = panel.scrollHeight;
            }
        });
    }

    /**
     * Apply the saved expanded/collapsed state of the map log overlay.
     * Called after save data is loaded (state isn't available during init).
     */
    function applySavedMapLogState() {
        const overlay = document.getElementById('map-log-overlay');
        if (!overlay) return;
        const expanded = window.GameState?.getState()?.ui?.mapLogExpanded;
        overlay.classList.toggle('collapsed', !expanded);
    }

    function initFilters() {
        const filterCheckboxes = document.querySelectorAll('.log-filters input[type="checkbox"]:not([disabled])');
        filterCheckboxes.forEach(checkbox => {
            const filterType = checkbox.id.replace('filter-', '');
            if (filterType && filters.hasOwnProperty(filterType)) {
                checkbox.checked = filters[filterType];

                checkbox.addEventListener('change', (e) => {
                    filters[filterType] = e.target.checked;
                    render();
                });
            }
        });
    }

    function add(message, type = 'info') {
        // Filter out ALL combat messages - only show loot and XP
        if (type === 'combat') {
            // Only allow XP gain messages through
            if (!message.match(/gained \d+ XP/i)) {
                return; // Don't add this message
            }
        }

        const timestamp = new Date().toLocaleTimeString();
        const log = {
            id: generateLogId(),
            message,
            type,
            timestamp
        };

        logs.push(log);

        // Keep only max logs (remove oldest)
        if (logs.length > maxLogs) {
            logs = logs.slice(-maxLogs);
        }

        render();
    }

    function generateLogId() {
        return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function addMessage(message, type = 'info') {
        add(message, type);
    }

    function render() {
        // Filter logs based on active filters.
        // Types without a filter checkbox ('info', 'warning', 'success',
        // 'error', ...) are ALWAYS shown — previously they were silently
        // dropped, hiding most of the game's messages.
        const filteredLogs = logs.filter(log => {
            return filters.hasOwnProperty(log.type) ? filters[log.type] : true;
        });

        const html = filteredLogs.length === 0
            ? '<p class="log-placeholder">No messages to display</p>'
            : filteredLogs.map(log => `
                <div class="activity-item ${log.type}">
                    <span class="activity-time">${log.timestamp}</span>
                    <span class="activity-text">${log.message}</span>
                </div>
            `).join('');

        // Render into both feeds: the sidebar log and the map overlay log
        renderFeed(document.querySelector('.activity-feed'), document.querySelector('.log-content'), html);
        renderFeed(document.getElementById('map-log-feed'), document.querySelector('.map-log-panel'), html);
    }

    /**
     * Write log HTML into a feed and keep its scroll pinned to the newest
     * message — but only if the user was already near the bottom. Never yank
     * them away while they're scrolled up reading older messages.
     */
    function renderFeed(feedEl, scrollContainer, html) {
        if (!feedEl) return;

        let stickToBottom = true;
        if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
            const distanceFromBottom = scrollContainer.scrollHeight
                - scrollContainer.scrollTop
                - scrollContainer.clientHeight;
            stickToBottom = distanceFromBottom < 60;
        }

        feedEl.innerHTML = html;

        if (scrollContainer && stickToBottom) {
            setTimeout(() => {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }, 0);
        }
    }

    function clear() {
        logs = [];
        render();
    }

    function getLogs() {
        return logs;
    }

    return {
        init,
        add,
        addMessage,
        clear,
        getLogs,
        applySavedMapLogState
    };
})();

// Expose to global scope
window.ActivityLog = ActivityLog;
