// ============================================
// Crafting Controller
// ============================================

const Crafting = (() => {
    let initialized = false;
    let discoveredRecipes = []; // Recipes the player has discovered
    let recipes = []; // Recipe database loaded from JSON

    async function loadRecipes() {
        try {
            const response = await fetch('data/recipes.json');
            const data = await response.json();
            recipes = data.recipes || [];
            console.log('Loaded', recipes.length, 'recipes from JSON');
        } catch (error) {
            console.error('Failed to load recipes:', error);
            recipes = [];
        }
    }

    async function init() {
        console.log('Crafting: Initializing...');

        // Load recipes from JSON file
        await loadRecipes();

        // Load discovered recipes from localStorage
        loadDiscoveredRecipes();

        // Initialize on DOM ready with a small delay
        setTimeout(() => {
            renderMiniInventory();
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
        const saved = localStorage.getItem('discoveredRecipes');
        if (saved) {
            try {
                const recipeIds = JSON.parse(saved);
                discoveredRecipes = recipeIds.map(id => recipes.find(r => r.id === id)).filter(r => r);
                console.log('Loaded', discoveredRecipes.length, 'discovered recipes');
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
        localStorage.setItem('discoveredRecipes', JSON.stringify(recipeIds));
    }

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

        console.log('Rendering mini inventory. Items:', character.inventory.items.length);
        miniInventoryGrid.innerHTML = '';

        // Use the same stacking logic as the main inventory
        const stacks = Inventory.getStackedItems(character.inventory);

        // Render stacked items
        stacks.forEach(stack => {
            const slot = document.createElement('div');
            slot.className = 'mini-inventory-slot';
            slot.dataset.itemName = stack.item.name;
            // Store all item IDs in the stack
            slot.dataset.itemIds = JSON.stringify(stack.items.map(i => i.id));

            // Display with count if more than 1
            const displayName = stack.quantity > 1
                ? `${stack.item.name} x${stack.quantity}`
                : stack.item.name;

            slot.innerHTML = `
                <div class="item-card">
                    <span class="item-name">${displayName}</span>
                </div>
            `;

            // Add click event to move item to crafting slot
            slot.addEventListener('click', () => {
                // Get the first available item from the stack
                const availableItem = getAvailableItemFromStack(stack.items);
                if (availableItem) {
                    addItemToCraftingSlot(availableItem);
                }
            });

            miniInventoryGrid.appendChild(slot);
        });

        console.log('Mini inventory rendered with stacked items');
        updateMiniInventoryAvailability();
    }

    function getAvailableItemFromStack(items) {
        // Get all used item IDs
        const inputSlots = document.querySelectorAll('.input-slot');
        const usedItemIds = [];
        inputSlots.forEach(slot => {
            if (!slot.classList.contains('empty') && slot.dataset.itemId) {
                usedItemIds.push(slot.dataset.itemId);
            }
        });

        // Find first item not currently used
        return items.find(item => !usedItemIds.includes(item.id));
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

    function updateMiniInventoryAvailability() {
        // Get all item IDs currently in crafting slots
        const inputSlots = document.querySelectorAll('.input-slot');
        const usedItemIds = [];

        inputSlots.forEach(slot => {
            if (!slot.classList.contains('empty') && slot.dataset.itemId) {
                usedItemIds.push(slot.dataset.itemId);
            }
        });

        // Update mini inventory slots based on usage
        const miniSlots = document.querySelectorAll('.mini-inventory-slot');
        miniSlots.forEach(slot => {
            const itemIds = JSON.parse(slot.dataset.itemIds || '[]');

            // Count how many items from this stack are currently used
            const usedCount = itemIds.filter(id => usedItemIds.includes(id)).length;

            // Hide if all instances are used
            if (usedCount >= itemIds.length) {
                slot.classList.add('used');
            } else {
                slot.classList.remove('used');
            }

            // Update the display count
            const totalCount = itemIds.length;
            const availableCount = totalCount - usedCount;
            const itemName = slot.dataset.itemName;

            if (availableCount > 0) {
                const displayName = totalCount > 1
                    ? `${itemName} x${availableCount}`
                    : itemName;

                slot.querySelector('.item-name').textContent = displayName;
            }
        });
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
            updateMiniInventoryAvailability();
        });

        console.log(`Added ${item.name} to crafting slot`);
        updateMiniInventoryAvailability();
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
            if (!outputSlot.classList.contains('empty') && outputSlot.dataset.craftedItem) {
                // Auto-collect the previous crafted item
                const previousItemTemplate = JSON.parse(outputSlot.dataset.craftedItem);
                const previousItem = Items.createItem(previousItemTemplate.name, previousItemTemplate.type, {
                    description: previousItemTemplate.description,
                    icon: previousItemTemplate.icon,
                    slot: previousItemTemplate.slot || null,
                    stats: previousItemTemplate.stats || {}
                });
                Inventory.addItem(character.inventory, previousItem);
                console.log('Auto-collected previous crafted item:', previousItem.name);
            }

            // Remove items from inventory immediately
            craftingItemIds.forEach(itemId => {
                Inventory.removeItem(character.inventory, itemId);
            });

            // Clear all input slots immediately
            clearAllSlots();

            // Show output in center slot
            outputSlot.innerHTML = `
                <div class="item-card">
                    <span class="item-name">${matchedRecipe.output.name}</span>
                </div>
            `;
            outputSlot.classList.remove('empty');
            outputSlot.dataset.craftedItem = JSON.stringify(matchedRecipe.output);

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
        } else {
            console.log('No matching recipe found');
            alert('No recipe matches this combination!');
        }
    }

    function findMatchingRecipe(craftingItems) {
        for (let recipe of recipes) {
            // Count required items
            const requiredCounts = {};
            recipe.inputs.forEach(input => {
                requiredCounts[input.name] = input.count;
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
        if (outputSlot.classList.contains('empty') || !outputSlot.dataset.craftedItem) {
            return;
        }

        const craftedItemTemplate = JSON.parse(outputSlot.dataset.craftedItem);
        const character = GameState.getState().character;

        // Create a proper item with unique ID using Items.createItem
        const craftedItem = Items.createItem(craftedItemTemplate.name, craftedItemTemplate.type, {
            description: craftedItemTemplate.description,
            icon: craftedItemTemplate.icon,
            slot: craftedItemTemplate.slot || null,
            stats: craftedItemTemplate.stats || {}
        });

        // Items were already removed from inventory in attemptCraft()
        // Just add the crafted item to inventory
        Inventory.addItem(character.inventory, craftedItem);

        // Clear output slot
        outputSlot.innerHTML = '';
        outputSlot.classList.add('empty');
        delete outputSlot.dataset.craftedItem;

        // Re-render inventory displays
        renderMiniInventory();
        if (window.renderInventoryUI) {
            renderInventoryUI();
        }

        // Save game
        if (window.SaveSystem) {
            SaveSystem.save();
        }

        console.log('Crafted:', craftedItem.name);
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
                ingredientItem.textContent = `${input.name} x${input.count}`;
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
        updateMiniInventoryAvailability();
    }

    return {
        init,
        renderMiniInventory
    };
})();

window.Crafting = Crafting;
