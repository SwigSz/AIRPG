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
        const logContainer = document.querySelector('.activity-feed');
        if (!logContainer) return;

        // Filter logs based on active filters
        const filteredLogs = logs.filter(log => {
            return filters[log.type] || false;
        });

        if (filteredLogs.length === 0) {
            logContainer.innerHTML = '<p class="log-placeholder">No messages to display</p>';
            return;
        }

        logContainer.innerHTML = filteredLogs.map(log => `
            <div class="activity-item ${log.type}">
                <span class="activity-time">${log.timestamp}</span>
                <span class="activity-text">${log.message}</span>
            </div>
        `).join('');

        // Auto-scroll to bottom - scroll the parent .log-content container
        const scrollContainer = document.querySelector('.log-content');
        if (scrollContainer) {
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
        getLogs
    };
})();

// Expose to global scope
window.ActivityLog = ActivityLog;
