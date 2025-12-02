// ============================================
// Save/Load Functionality
// ============================================

const SaveSystem = (() => {
    const SAVE_KEY = 'ai_rpg_save';
    let autosaveInterval = null;
    let isAutosaveEnabled = true;

    function save(isAutosave = false) {
        try {
            const state = GameState.getState();
            const saveData = {
                version: '1.0.0',
                timestamp: Date.now(),
                state: state
            };
            localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
            // Game saved (silently to reduce console bloat)
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
            // Game loaded successfully
            return parsed.state;
        } catch (error) {
            console.error('Failed to load game:', error);
            return null;
        }
    }

    function deleteSave() {
        try {
            localStorage.removeItem(SAVE_KEY);
            // Save deleted successfully
            return true;
        } catch (error) {
            console.error('Failed to delete save:', error);
            return false;
        }
    }

    function hasSave() {
        return localStorage.getItem(SAVE_KEY) !== null;
    }

    function exportToFile() {
        try {
            const state = GameState.getState();
            const saveData = {
                version: '1.0.0',
                timestamp: Date.now(),
                state: state
            };

            // Convert to JSON string, then encode to base64
            const jsonString = JSON.stringify(saveData);
            const base64Data = btoa(jsonString);

            // Create a blob and download
            const blob = new Blob([base64Data], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-rpg-save-${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('Save exported successfully');
            return true;
        } catch (error) {
            console.error('Failed to export save:', error);
            return false;
        }
    }

    function importFromFile(file) {
        return new Promise((resolve, reject) => {
            try {
                const reader = new FileReader();

                reader.onload = (e) => {
                    try {
                        // Decode base64
                        const base64Data = e.target.result;
                        const jsonString = atob(base64Data);
                        const saveData = JSON.parse(jsonString);

                        // Validate save data structure
                        if (!saveData.version || !saveData.state) {
                            throw new Error('Invalid save file format');
                        }

                        // Load the state
                        GameState.setState(saveData.state);

                        // Also save to localStorage
                        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));

                        console.log('Save imported successfully');
                        resolve(saveData.state);
                    } catch (error) {
                        console.error('Failed to parse save file:', error);
                        reject(error);
                    }
                };

                reader.onerror = () => {
                    reject(new Error('Failed to read file'));
                };

                reader.readAsText(file);
            } catch (error) {
                console.error('Failed to import save:', error);
                reject(error);
            }
        });
    }

    function wipeData() {
        try {
            // Clear localStorage completely (including discovered recipes, crafted items, and last tab)
            localStorage.removeItem(SAVE_KEY);
            localStorage.removeItem('discoveredRecipes');
            localStorage.removeItem('craftedItems');
            localStorage.removeItem('lastActiveTab');

            // Reset game state
            GameState.reset();

            console.log('All save data wiped successfully');
            return true;
        } catch (error) {
            console.error('Failed to wipe data:', error);
            return false;
        }
    }

    function startAutosave(intervalSeconds = 30) {
        // Stop any existing autosave interval
        stopAutosave();

        // Start new autosave interval
        autosaveInterval = setInterval(() => {
            if (isAutosaveEnabled && GameState.getState().initialized) {
                save(true); // Pass true to indicate this is an autosave
            }
        }, intervalSeconds * 1000);

        // Autosave enabled
    }

    function stopAutosave() {
        if (autosaveInterval) {
            clearInterval(autosaveInterval);
            autosaveInterval = null;
            // Autosave stopped
        }
    }

    function toggleAutosave() {
        isAutosaveEnabled = !isAutosaveEnabled;
        console.log(`Autosave ${isAutosaveEnabled ? 'enabled' : 'disabled'}`);
        return isAutosaveEnabled;
    }

    function isAutosaveActive() {
        return isAutosaveEnabled && autosaveInterval !== null;
    }

    return {
        save,
        load,
        deleteSave,
        hasSave,
        exportToFile,
        importFromFile,
        wipeData,
        startAutosave,
        stopAutosave,
        toggleAutosave,
        isAutosaveActive
    };
})();

// Expose to global scope
window.SaveSystem = SaveSystem;
