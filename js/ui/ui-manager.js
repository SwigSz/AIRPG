// ============================================
// Main UI Controller
// ============================================

const UIManager = (() => {
    function init() {
        // Initialize all UI subsystems
        if (window.TabManager) TabManager.init();
        if (window.ActivityLog) ActivityLog.init();
        if (window.QuickSlots) QuickSlots.init();
        if (window.Notifications) Notifications.init();
    }

    function update() {
        // Update UI elements based on game state
    }

    function refresh() {
        // Force refresh all UI
    }

    return {
        init,
        update,
        refresh
    };
})();

// Expose to global scope
window.UIManager = UIManager;
