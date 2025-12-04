// ============================================
// Central Game State Management
// ============================================

const GameState = (() => {
    let state = {
        initialized: false,
        paused: false,
        currentDay: 0,
        character: null,
        settlement: null,
        world: null,
        inventory: null,
        quests: [],
        achievements: [],
        combat: null,
        craftingHistory: [],
        campLocation: null,
        time: null
    };

    function init() {
        state.initialized = true;
        return state;
    }

    function getState() {
        return state;
    }

    function setState(newState) {
        // Directly replace the entire state object
        state = newState;
    }

    function updateProperty(key, value) {
        state[key] = value;
    }

    function pause() {
        state.paused = true;
    }

    function resume() {
        state.paused = false;
    }

    function reset() {
        state = {
            initialized: true,
            paused: false,
            currentDay: 0,
            character: null,
            settlement: null,
            world: null,
            inventory: null,
            quests: [],
            achievements: [],
            combat: null,
            craftingHistory: [],
            campLocation: null
        };
    }

    function addToCraftingHistory(itemName) {
        if (!state.craftingHistory) {
            state.craftingHistory = [];
        }
        if (!state.craftingHistory.includes(itemName)) {
            state.craftingHistory.push(itemName);
        }
    }

    return {
        init,
        getState,
        setState,
        updateProperty,
        pause,
        resume,
        reset,
        addToCraftingHistory
    };
})();

// Expose to global scope
window.GameState = GameState;
