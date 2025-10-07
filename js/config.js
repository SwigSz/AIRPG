// ============================================
// Game Configuration Constants
// ============================================

const GameConfig = {
    // Time System
    TIME: {
        DAY_DURATION: 1000, // 1 day = 1 second
        YEAR_DAYS: 365,
        LIFESPAN_YEARS: 80
    },

    // Character Stats
    STATS: {
        MIN: 1,
        MAX: 100,
        STARTING: 10
    },

    // Combat
    COMBAT: {
        TURN_DURATION: 3000, // 3 seconds per turn
        MAX_ENEMY_LEVEL_DIFFERENCE: 5
    },

    // Settlement
    SETTLEMENT: {
        STARTING_POPULATION: 10,
        MAX_POPULATION: 1000,
        TASK_SLOTS_PER_PERSON: 1
    },

    // World
    WORLD: {
        MAP_SIZE: 100, // 100x100 tiles
        STARTING_EXPLORED: 1, // 1x1 starting area
        DIFFICULTY_SCALING: 0.1 // Per tile distance
    },

    // Progression
    PROGRESSION: {
        SKILL_CAP: 100,
        STAT_CAP: 100,
        REBIRTH_BONUS: 0.1 // 10% bonus per rebirth
    },

    // UI
    UI: {
        ACTIVITY_LOG_MAX: 100,
        QUICK_SLOTS: 6,
        NOTIFICATION_DURATION: 3000
    }
};

// Expose to global scope
window.GameConfig = GameConfig;
