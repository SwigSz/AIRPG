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

        // Initialize on DOM ready with a small delay
        // Note: renderMiniInventory will be called when character is ready
        setTimeout(() => {
            initializeCraftingSlots();
            renderRecipeList();
        }, 100);

        // Initialize mini inventory when tab manager is ready
        if (window.TabManager) {
            // Listen for tab switches to update mini inventory
            const originalSwitch = TabManager.switchTab;
            TabManager.switchTab = function(tabName) {
                originalSwitch.call(TabManager, tabName);
                if (tabName === 'crafting') {
                    console.log('Crafting tab opened, rendering mini inventory...');
                    setTimeout(() => renderMiniInventory(), 50);
                    if (!initialized) {
                        initializeCraftingSlots();
                        initialized = true;
                    }
                }
            };
        }
    }

    function loadDiscoveredRecipes() {
        // Load from GameState (new method)
        const state = window.GameState ? window.GameState.getState() : null;
        if (state && state.discoveredRecipes && Array.isArray(state.discoveredRecipes)) {
            discoveredRecipes = state.discoveredRecipes.map(id => recipes.find(r => r.id === id)).filter(r => r);
            console.log(`Loaded ${discoveredRecipes.length} discovered recipes from GameState`);
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
            console.log(`Loaded ${craftedItems.length} crafted items from GameState`);
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

    // ============================================
    // MINI INVENTORY RENDERING
    // ============================================
    // ** Uses centralized InventoryUI module **
    // See js/ui/inventory-ui.js and CLAUDE.md
    // ============================================
    function renderMiniInventory() {
        const miniInventoryGrid = document.getElementById('crafting-mini-inventory-grid');
        if (!miniInventoryGrid) {
            console.error('Mini inventory grid element not found!');
            return;
        }

        const state = GameState.getState();
        if (!state || !state.character) {
            console.error('No character in game state!');
            return;
        }

        const character = state.character;
        if (!character.inventory || !character.inventory.items) {
            console.error('Character has no inventory!');
            return;
        }

        // Get all used item IDs from crafting slots
        const usedItemIds = getUsedItemIds();

        // Use InventoryUI module to render mini inventory
        InventoryUI.renderMiniInventory(
            miniInventoryGrid,
            character,
            (item) => {
                // Callback when item is clicked
                addItemToCraftingSlot(item);
            },
            { usedItemIds }
        );
    }

    function getUsedItemIds() {
        // Get all item IDs currently in crafting slots
        const inputSlots = document.querySelectorAll('.input-slot');
        const usedItemIds = [];
        inputSlots.forEach(slot => {
            if (!slot.classList.contains('empty') && slot.dataset.itemId) {
                usedItemIds.push(slot.dataset.itemId);
            }
        });
        return usedItemIds;
    }

    function initializeCraftingSlots() {
        const craftingSlots = document.querySelectorAll('.crafting-slot');

        craftingSlots.forEach(slot => {
            // All slots start as empty
            slot.classList.add('empty');
        });

        // Initialize Clear All button
        const clearBtn = document.querySelector('.clear-all-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', clearAllSlots);
        }

        // Initialize Combine button
        const combineBtn = document.querySelector('.combine-btn');
        if (combineBtn) {
            combineBtn.addEventListener('click', attemptCraft);
        }

        // Initialize output slot click
        const outputSlot = document.querySelector('.output-slot');
        if (outputSlot) {
            outputSlot.addEventListener('click', collectOutput);
        }
    }

    function addItemToCraftingSlot(item) {
        // Find first empty input slot
        const inputSlots = document.querySelectorAll('.input-slot');
        let emptySlot = null;

        for (let slot of inputSlots) {
            if (slot.classList.contains('empty')) {
                emptySlot = slot;
                break;
            }
        }

        if (!emptySlot) {
            console.log('All crafting slots are full');
            return;
        }

        // Add item to the slot
        emptySlot.innerHTML = `
            <div class="item-card">
                <span class="item-name">${item.name}</span>
            </div>
        `;
        emptySlot.classList.remove('empty');
        emptySlot.dataset.itemId = item.id;
        emptySlot.dataset.itemName = item.name;

        // Add click to remove item from slot
        emptySlot.addEventListener('click', function removeItem() {
            emptySlot.innerHTML = '';
            emptySlot.classList.add('empty');
            delete emptySlot.dataset.itemId;
            delete emptySlot.dataset.itemName;
            emptySlot.removeEventListener('click', removeItem);
            renderMiniInventory();
        });

        console.log(`Added ${item.name} to crafting slot`);
        renderMiniInventory();
    }

    function attemptCraft() {
        // Get items in crafting slots
        const inputSlots = document.querySelectorAll('.input-slot');
        const craftingItems = [];
        const craftingItemIds = [];

        inputSlots.forEach(slot => {
            if (!slot.classList.contains('empty') && slot.dataset.itemName) {
                craftingItems.push(slot.dataset.itemName);
                if (slot.dataset.itemId) {
                    craftingItemIds.push(slot.dataset.itemId);
                }
            }
        });

        if (craftingItems.length === 0) {
            console.log('No items in crafting grid');
            return;
        }

        // Check if combination matches a recipe
        const matchedRecipe = findMatchingRecipe(craftingItems);

        if (matchedRecipe) {
            console.log('Recipe matched:', matchedRecipe.name);

            const character = GameState.getState().character;

            // Check if there's already an item in the output slot
            const outputSlot = document.querySelector('.output-slot');
            if (!outputSlot.classList.contains('empty') && outputSlot.dataset.craftedItemId) {
                // Auto-collect the previous crafted item
                const previousItemId = outputSlot.dataset.craftedItemId;
                const previousItem = ItemFactory.createItem(previousItemId);
                if (previousItem) {
                    Inventory.addItem(character.inventory, previousItem);
                    console.log('Auto-collected previous crafted item:', previousItem.name);
                }
            }

            // Remove items from inventory immediately
            craftingItemIds.forEach(itemId => {
                Inventory.removeItem(character.inventory, itemId);
            });

            // Clear all input slots immediately
            clearAllSlots();

            // Get the item template to display the name
            const itemTemplate = ItemFactory.getItemTemplate(matchedRecipe.outputItemId);
            if (!itemTemplate) {
                console.error('Could not find item template for:', matchedRecipe.outputItemId);
                alert('Error: Recipe output item not found in items.json!');
                return;
            }

            // Show output in center slot
            outputSlot.innerHTML = `
                <div class="item-card">
                    <span class="item-name">${itemTemplate.name}</span>
                </div>
            `;
            outputSlot.classList.remove('empty');
            outputSlot.dataset.craftedItemId = matchedRecipe.outputItemId;

            // Update inventory displays
            renderMiniInventory();
            if (window.renderInventoryUI) {
                renderInventoryUI();
            }

            // Save game
            if (window.SaveSystem) {
                SaveSystem.save();
            }

            // Add to discovered recipes if not already discovered
            if (!discoveredRecipes.find(r => r.id === matchedRecipe.id)) {
                discoveredRecipes.push(matchedRecipe);
                saveDiscoveredRecipes();
                renderRecipeList();
            }

            // Track crafting stats
            if (window.StatsTracker) {
                StatsTracker.incrementStat('crafting.itemsCrafted', 1);
            }

            // Check for ability/skill unlocks
            if (window.AbilityManager) {
                AbilityManager.checkAndUnlockAbilities();
            }
            if (window.SkillManager) {
                SkillManager.checkAndEarnSkills();
            }
            // Refresh character UI
            if (window.CharacterUI) {
                CharacterUI.render();
            }

            // Show crafted item modal
            showCraftedItemModal(itemTemplate);
        } else {
            console.log('No matching recipe found');
            alert('No recipe matches this combination!');
        }
    }

    function findMatchingRecipe(craftingItems) {
        for (let recipe of recipes) {
            // Check if recipe requires research and if it's unlocked
            if (recipe.unlockRequirements && recipe.unlockRequirements.research) {
                const requiredResearch = recipe.unlockRequirements.research;
                // Check if research is completed
                if (window.Research && !Research.hasResearched(requiredResearch)) {
                    // Recipe is locked behind research
                    continue;
                }
            }

            // Count required items (look up names from ItemFactory)
            const requiredCounts = {};
            recipe.inputs.forEach(input => {
                const itemTemplate = ItemFactory.getItemTemplate(input.itemId);
                if (itemTemplate) {
                    requiredCounts[itemTemplate.name] = input.count;
                }
            });

            // Count crafted items
            const craftedCounts = {};
            craftingItems.forEach(itemName => {
                craftedCounts[itemName] = (craftedCounts[itemName] || 0) + 1;
            });

            // Check if they match exactly
            const requiredKeys = Object.keys(requiredCounts).sort();
            const craftedKeys = Object.keys(craftedCounts).sort();

            if (JSON.stringify(requiredKeys) === JSON.stringify(craftedKeys)) {
                let match = true;
                for (let key of requiredKeys) {
                    if (requiredCounts[key] !== craftedCounts[key]) {
                        match = false;
                        break;
                    }
                }
                if (match) return recipe;
            }
        }
        return null;
    }

    function collectOutput() {
        const outputSlot = document.querySelector('.output-slot');
        if (outputSlot.classList.contains('empty') || !outputSlot.dataset.craftedItemId) {
            return;
        }

        const craftedItemId = outputSlot.dataset.craftedItemId;
        const craftedItemTemplate = ItemFactory.getItemTemplate(craftedItemId);

        if (!craftedItemTemplate) {
            console.error('Could not find item template for:', craftedItemId);
            return;
        }

        // Show crafted item modal instead of auto-collecting
        showCraftedItemModal(craftedItemTemplate);
    }

    function showCraftedItemModal(itemTemplate) {
        const modal = document.getElementById('crafted-item-modal');
        const itemName = document.getElementById('crafted-item-name');
        const itemDescription = document.getElementById('crafted-item-description');
        const statsContent = document.getElementById('crafted-stats-content');
        const takeBtn = document.getElementById('take-crafted-btn');
        const discardBtn = document.getElementById('discard-crafted-btn');
        const newItemBanner = document.getElementById('new-item-banner');

        // Check if this is a new item (never crafted before)
        const isFirstCraft = isNewItem(itemTemplate.name);
        console.log(`Item: ${itemTemplate.name}, Is First Craft: ${isFirstCraft}, Crafted Items:`, craftedItems);

        // Show/hide the "New item created!" banner
        if (newItemBanner) {
            if (isFirstCraft) {
                newItemBanner.style.display = 'block';
                console.log('✨ Showing "New item created!" banner');
            } else {
                newItemBanner.style.display = 'none';
                console.log('Banner hidden - item previously crafted');
            }
        } else {
            console.error('New item banner element not found!');
        }

        // Set content
        itemName.textContent = itemTemplate.name;
        itemDescription.textContent = itemTemplate.description || 'No description available.';

        // Build stats HTML
        let statsHTML = '';
        if (itemTemplate.stats && Object.keys(itemTemplate.stats).length > 0) {
            for (const [key, value] of Object.entries(itemTemplate.stats)) {
                const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                statsHTML += `<div><strong>${capitalizedKey}:</strong> ${value}</div>`;
            }
        }
        statsContent.innerHTML = statsHTML;

        // Remove previous event listeners by cloning buttons
        const newTakeBtn = takeBtn.cloneNode(true);
        const newDiscardBtn = discardBtn.cloneNode(true);
        takeBtn.parentNode.replaceChild(newTakeBtn, takeBtn);
        discardBtn.parentNode.replaceChild(newDiscardBtn, discardBtn);

        // Add event listeners
        newTakeBtn.addEventListener('click', () => {
            takeCraftedItem(itemTemplate);
            modal.style.display = 'none';
        });

        newDiscardBtn.addEventListener('click', () => {
            discardCraftedItem();
            modal.style.display = 'none';
        });

        // Close button
        const closeBtn = modal.querySelector('.modal-close');
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Close with Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                modal.style.display = 'none';
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);

        // Show modal
        modal.style.display = 'flex';
    }

    function takeCraftedItem(itemTemplate) {
        const character = GameState.getState().character;

        // Create a proper item with unique ID using ItemFactory
        const craftedItem = ItemFactory.createItem(itemTemplate.id);

        if (!craftedItem) {
            console.error('Failed to create item:', itemTemplate.id);
            return;
        }

        // Mark this item as crafted (for "New item created!" tracking)
        markItemAsCrafted(craftedItem.name);

        // Add the crafted item to inventory
        Inventory.addItem(character.inventory, craftedItem);

        // Track crafted item in crafting history for research unlocks
        if (window.GameState && window.GameState.addToCraftingHistory) {
            GameState.addToCraftingHistory(craftedItem.name);
        }

        // Check for auto-completing research nodes
        if (window.Research && window.Research.checkAndAutoCompleteNodes) {
            Research.checkAndAutoCompleteNodes();
        }

        // Trigger research tree update if it exists
        if (window.Research && window.Research.render) {
            Research.render();
        }

        // Clear output slot
        const outputSlot = document.querySelector('.output-slot');
        outputSlot.innerHTML = '';
        outputSlot.classList.add('empty');
        delete outputSlot.dataset.craftedItemId;

        // Re-render inventory displays
        renderMiniInventory();
        if (window.renderInventoryUI) {
            renderInventoryUI();
        }

        // Save game
        if (window.SaveSystem) {
            SaveSystem.save();
        }

        console.log('Crafted and took:', craftedItem.name);
    }

    function discardCraftedItem() {
        // Get the item template before clearing
        const outputSlot = document.querySelector('.output-slot');
        const craftedItemId = outputSlot.dataset.craftedItemId;

        if (craftedItemId) {
            const craftedItemTemplate = ItemFactory.getItemTemplate(craftedItemId);

            // Mark this item as crafted even though it's being discarded
            // (so the "New item created!" banner won't show again)
            if (craftedItemTemplate && craftedItemTemplate.name) {
                markItemAsCrafted(craftedItemTemplate.name);
            }
        }

        // Clear output slot without adding to inventory
        outputSlot.innerHTML = '';
        outputSlot.classList.add('empty');
        delete outputSlot.dataset.craftedItemId;

        // Save game
        if (window.SaveSystem) {
            SaveSystem.save();
        }

        console.log('Crafted item discarded');
    }

    function renderRecipeList() {
        const recipesGrid = document.querySelector('.recipes-grid');
        if (!recipesGrid) return;

        recipesGrid.innerHTML = '';

        // Render each discovered recipe as a bar
        discoveredRecipes.forEach(recipe => {
            const recipeContainer = document.createElement('div');

            const recipeBar = document.createElement('div');
            recipeBar.className = 'recipe-bar';
            recipeBar.dataset.recipeId = recipe.id;

            const recipeName = document.createElement('span');
            recipeName.textContent = recipe.name;

            const arrow = document.createElement('span');
            arrow.className = 'recipe-bar-arrow';
            arrow.textContent = '▶';

            recipeBar.appendChild(recipeName);
            recipeBar.appendChild(arrow);

            // Create dropdown
            const dropdown = document.createElement('div');
            dropdown.className = 'recipe-dropdown';

            const ingredientsList = document.createElement('div');
            ingredientsList.className = 'recipe-ingredients';

            recipe.inputs.forEach(input => {
                const ingredientItem = document.createElement('div');
                ingredientItem.className = 'recipe-ingredient-item';

                // Look up item name from ItemFactory
                const itemTemplate = ItemFactory.getItemTemplate(input.itemId);
                const itemName = itemTemplate ? itemTemplate.name : input.itemId;

                ingredientItem.textContent = `${itemName} x${input.count}`;
                ingredientsList.appendChild(ingredientItem);
            });

            dropdown.appendChild(ingredientsList);

            // Add click handler to toggle dropdown
            recipeBar.addEventListener('click', () => {
                recipeBar.classList.toggle('expanded');
                dropdown.classList.toggle('open');
            });

            recipeContainer.appendChild(recipeBar);
            recipeContainer.appendChild(dropdown);
            recipesGrid.appendChild(recipeContainer);
        });
    }

    function clearAllSlots() {
        const inputSlots = document.querySelectorAll('.input-slot');
        inputSlots.forEach(slot => {
            slot.innerHTML = '';
            slot.classList.add('empty');
            delete slot.dataset.itemId;
            delete slot.dataset.itemName;
        });
        renderMiniInventory();
    }

    return {
        init,
        renderMiniInventory
    };
})();

window.Crafting = Crafting;
