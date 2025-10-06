// ============================================
// Game UI Framework - Main Entry Point
// ============================================

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    console.log('AI-RPG Game Framework Initialized');

    // Initialize all systems
    if (window.TabManager) {
        window.TabManager.init();
    }

    if (window.CombatUI) {
        window.CombatUI.init();
    }
});
