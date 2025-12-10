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
        researchedNodes: [],
        campLocation: null,
        time: null,
        activeResearch: null, // { nodeId, startDay, daysRequired, isPaused }
        discoveredRecipes: [], // Recipe IDs the player has discovered
        craftedItems: [], // Item names that have been crafted before
        ui: {
            activeTab: 'character', // Current main tab
            subTabs: {
                // Active sub-tab for each parent tab that has sub-tabs
                character: 'skills',
                settlement: 'buildings',
                crafting: 'basic-combining'
            }
        }
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
            researchedNodes: [],
            campLocation: null,
            activeResearch: null,
            discoveredRecipes: [],
            craftedItems: [],
            ui: {
                activeTab: 'character',
                subTabs: {
                    character: 'skills',
                    settlement: 'buildings',
                    crafting: 'basic-combining'
                }
            }
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
