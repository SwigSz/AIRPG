// ============================================
// Game UI Framework - Main Entry Point
// ============================================

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    console.log('AI-RPG Game Framework Initialized');

    // Initialize core systems
    if (window.GameState) GameState.init();
    if (window.EventSystem) EventSystem.init();
    if (window.TimeManager) TimeManager.init();

    // Initialize UI systems
    if (window.UIManager) {
        UIManager.init();
    } else {
        // Fallback to individual initialization
        if (window.TabManager) TabManager.init();
        if (window.CombatUI) CombatUI.init();
    }

    console.log('All systems initialized');
});
