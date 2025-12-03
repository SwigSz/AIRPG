// ============================================
// Stats Tracker - Track Player Statistics
// ============================================

const StatsTracker = (() => {
    // Default stats structure
    const defaultStats = {
        combat: {
            kills: 0,
            battlesWon: 0,
            battlesLost: 0
        },
        crafting: {
            itemsCrafted: 0,
            recipeDiscoveries: 0
        },
        general: {
            playtime: 0,
            levelUps: 0,
            xpGained: 0
        }
    };

    let stats = null;

    function init() {
        // Load stats from game state or initialize with defaults
        const state = GameState.getState();
        if (state.playerStats) {
            stats = { ...defaultStats, ...state.playerStats };
        } else {
            stats = JSON.parse(JSON.stringify(defaultStats));
            // Don't auto-save during init - this overwrites existing saves before they're loaded!
            // Just update the game state property
            GameState.updateProperty('playerStats', stats);
        }
        // StatsTracker initialized
    }

    // Get all stats
    function getStats() {
        return stats;
    }

    // Get a specific stat value by path (e.g., "combat.enemiesKilled")
    function getStat(path) {
        const keys = path.split('.');
        let value = stats;
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return 0;
            }
        }
        return typeof value === 'number' ? value : 0;
    }

    // Increment a stat by a certain amount
    function incrementStat(path, amount = 1) {
        const keys = path.split('.');
        let current = stats;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        const lastKey = keys[keys.length - 1];
        if (typeof current[lastKey] !== 'number') {
            current[lastKey] = 0;
        }
        current[lastKey] += amount;

        saveStats();

        // Emit event for other systems to react
        if (window.EventSystem) {
            EventSystem.emit('stat:changed', { path, value: current[lastKey], amount });
        }

        return current[lastKey];
    }

    // Set a stat to a specific value
    function setStat(path, value) {
        const keys = path.split('.');
        let current = stats;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        const lastKey = keys[keys.length - 1];
        current[lastKey] = value;

        saveStats();

        // Emit event
        if (window.EventSystem) {
            EventSystem.emit('stat:changed', { path, value });
        }

        return value;
    }

    // Save stats to game state
    function saveStats() {
        if (window.GameState) {
            GameState.updateProperty('playerStats', stats);
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }
    }

    // Reset all stats (for new game)
    function resetStats() {
        stats = JSON.parse(JSON.stringify(defaultStats));
        saveStats();
    }

    // Set stats (used when loading save data)
    function setStats(newStats) {
        stats = { ...defaultStats, ...newStats };
    }

    return {
        init,
        getStats,
        getStat,
        incrementStat,
        setStat,
        resetStats,
        setStats
    };
})();

window.StatsTracker = StatsTracker;
