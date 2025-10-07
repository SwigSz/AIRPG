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

    // Initialize save/load button event listeners
    initializeSaveLoadControls();

    console.log('All systems initialized');
});

// Save/Load Controls Initialization
function initializeSaveLoadControls() {
    const exportBtn = document.getElementById('export-save-btn');
    const importBtn = document.getElementById('import-save-btn');
    const wipeBtn = document.getElementById('wipe-save-btn');

    // Export button
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            SaveSystem.exportToFile();
        });
    }

    // Import button
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt';

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    SaveSystem.importFromFile(file)
                        .then(() => {
                            // Trigger UI updates without page reload
                            if (window.UIManager && UIManager.refresh) {
                                UIManager.refresh();
                            }
                            if (window.EventSystem) {
                                EventSystem.emit('game:loaded');
                            }
                        })
                        .catch((error) => {
                            console.error('Failed to import save file:', error);
                        });
                }
            };

            input.click();
        });
    }

    // Wipe data button
    if (wipeBtn) {
        wipeBtn.addEventListener('click', () => {
            const confirmed = confirm('Are you sure you want to wipe all save data? This action cannot be undone!');
            if (confirmed) {
                if (SaveSystem.wipeData()) {
                    alert('All save data has been wiped. The page will now reload.');
                    location.reload();
                } else {
                    alert('Failed to wipe save data.');
                }
            }
        });
    }
}
