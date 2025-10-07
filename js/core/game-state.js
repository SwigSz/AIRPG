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
        achievements: []
    };

    function init() {
        console.log('GameState: Initializing...');
        state.initialized = true;
        return state;
    }

    function getState() {
        return state;
    }

    function setState(newState) {
        state = { ...state, ...newState };
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
            achievements: []
        };
    }

    return {
        init,
        getState,
        setState,
        updateProperty,
        pause,
        resume,
        reset
    };
})();

// Expose to global scope
window.GameState = GameState;
