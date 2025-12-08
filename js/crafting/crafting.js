// ============================================
// Crafting Controller
// ============================================

const Crafting = (() => {
    let initialized = false;
    let discoveredRecipes = []; // Recipes the player has discovered
    let recipes = []; // Recipe database loaded from JSON
    let craftedItems = []; // Track items that have been crafted before

    async function loadRecipes() {
        try {
            const response = await fetch('data/recipes.json');
            const data = await response.json();
            recipes = data.recipes || [];
            // Recipes loaded from JSON
        } catch (error) {
            console.error('Failed to load recipes:', error);
            recipes = [];
        }
    }

    async function init() {
        // Crafting initializing

        // Load recipes from JSON file
        await loadRecipes();

        // Load discovered recipes from localStorage
        loadDiscoveredRecipes();

        // Load crafted items history from localStorage
        loadCraftedItems();

        // Initialize sub-tabs
        initializeSubTabs();
    }

    function initializeSubTabs() {
        // Initialize sub-tab click handlers
        document.querySelectorAll('.crafting-nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                switchCraftingTab(tab.dataset.craftingTab);
            });
        });
    }

    function switchCraftingTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.crafting-nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.craftingTab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.crafting-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const targetContent = document.getElementById(`crafting-${tabName}-content`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
    }

    function loadDiscoveredRecipes() {
        // Load from GameState (new method)
        const state = window.GameState ? window.GameState.getState() : null;
        if (state && state.discoveredRecipes && Array.isArray(state.discoveredRecipes)) {
            discoveredRecipes = state.discoveredRecipes.map(id => recipes.find(r => r.id === id)).filter(r => r);
            return;
        }

        // MIGRATION: Try loading from old localStorage location
        const saved = localStorage.getItem('discoveredRecipes');
        if (saved) {
            try {
                const recipeIds = JSON.parse(saved);
                discoveredRecipes = recipeIds.map(id => recipes.find(r => r.id === id)).filter(r => r);

                // Migrate to GameState
                if (state) {
                    state.discoveredRecipes = recipeIds;
                    console.log(`Migrated ${recipeIds.length} discovered recipes from localStorage to GameState`);
                }

                // Clear old localStorage
                localStorage.removeItem('discoveredRecipes');
            } catch (error) {
                console.error('Failed to load discovered recipes:', error);
                discoveredRecipes = [];
            }
        } else {
            discoveredRecipes = [];
        }
    }

    function saveDiscoveredRecipes() {
        const recipeIds = discoveredRecipes.map(r => r.id);

        // Save to GameState (new method)
        const state = window.GameState ? window.GameState.getState() : null;
        if (state) {
            state.discoveredRecipes = recipeIds;

            // Trigger main save system
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }
    }

    function loadCraftedItems() {
        // Load from GameState (new method)
        const state = window.GameState ? window.GameState.getState() : null;
        if (state && state.craftedItems && Array.isArray(state.craftedItems)) {
            craftedItems = state.craftedItems;
            console.log(`✅ Loaded ${craftedItems.length} crafted items from GameState:`, craftedItems);
            return;
        }

        // MIGRATION: Try loading from old localStorage location
        const saved = localStorage.getItem('craftedItems');
        if (saved) {
            try {
                craftedItems = JSON.parse(saved);

                // Migrate to GameState
                if (state) {
                    state.craftedItems = craftedItems;
                    console.log(`Migrated ${craftedItems.length} crafted items from localStorage to GameState`);
                }

                // Clear old localStorage
                localStorage.removeItem('craftedItems');
            } catch (error) {
                console.error('Failed to load crafted items:', error);
                craftedItems = [];
            }
        } else {
            craftedItems = [];
        }
    }

    function saveCraftedItems() {
        // Save to GameState (new method)
        const state = window.GameState ? window.GameState.getState() : null;
        if (state) {
            state.craftedItems = craftedItems;

            // Trigger main save system
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }
    }

    function isNewItem(itemName) {
        return !craftedItems.includes(itemName);
    }

    function markItemAsCrafted(itemName) {
        if (!craftedItems.includes(itemName)) {
            craftedItems.push(itemName);
            saveCraftedItems();
        }
    }


    return {
        init
    };
})();

window.Crafting = Crafting;
