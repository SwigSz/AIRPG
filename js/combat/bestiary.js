// ============================================
// Bestiary - Enemy Lore & Information
// ============================================
// This file will contain bestiary entries with detailed information
// about enemies that the player has encountered.

const Bestiary = (() => {
    // Bestiary entries (discovered enemies)
    const discovered = {};

    function addEntry(enemyId) {
        // Add enemy to discovered list
        if (!discovered[enemyId]) {
            discovered[enemyId] = {
                id: enemyId,
                timesEncountered: 0,
                timesDefeated: 0
            };
        }
    }

    function getEntry(enemyId) {
        return discovered[enemyId] || null;
    }

    function getAllEntries() {
        return Object.values(discovered);
    }

    return {
        addEntry,
        getEntry,
        getAllEntries
    };
})();

window.Bestiary = Bestiary;
