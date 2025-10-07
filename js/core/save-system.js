// ============================================
// Save/Load Functionality
// ============================================

const SaveSystem = (() => {
    const SAVE_KEY = 'ai_rpg_save';

    function save() {
        try {
            const state = GameState.getState();
            const saveData = {
                version: '1.0.0',
                timestamp: Date.now(),
                state: state
            };
            localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
            console.log('Game saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to save game:', error);
            return false;
        }
    }

    function load() {
        try {
            const saveData = localStorage.getItem(SAVE_KEY);
            if (!saveData) {
                console.log('No save data found');
                return null;
            }

            const parsed = JSON.parse(saveData);
            console.log('Game loaded successfully');
            return parsed.state;
        } catch (error) {
            console.error('Failed to load game:', error);
            return null;
        }
    }

    function deleteSave() {
        try {
            localStorage.removeItem(SAVE_KEY);
            console.log('Save deleted successfully');
            return true;
        } catch (error) {
            console.error('Failed to delete save:', error);
            return false;
        }
    }

    function hasSave() {
        return localStorage.getItem(SAVE_KEY) !== null;
    }

    return {
        save,
        load,
        deleteSave,
        hasSave
    };
})();

// Expose to global scope
window.SaveSystem = SaveSystem;
