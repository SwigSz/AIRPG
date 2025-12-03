// ============================================
// Centralized Inventory UI Rendering Module
// ============================================
//
// ** IMPORTANT: THIS IS THE SINGLE SOURCE OF TRUTH FOR ALL INVENTORY RENDERING **
//
// This module provides reusable UI rendering functions for inventory display
// across different contexts (main inventory, crafting, combat, etc.)
//
// Preserve JavaScript's built-in Map constructor before game's Map class overwrites it
const JavaScriptMap = Map;
//
// ============================================
// WHY THIS MODULE EXISTS
// ============================================
// Before this refactoring, inventory rendering code was duplicated across:
// - main.js (363 lines)
// - crafting.js (70 lines)
// - combat-manager.js (60 lines)
//
// This caused:
// ❌ Code duplication (item stacking logic in 3+ places)
// ❌ Inconsistent UI across different views
// ❌ Hard to maintain (changes required updating 3+ files)
// ❌ Testing difficulties
//
// Now ALL inventory rendering goes through this single module.
//
// ============================================
// USAGE GUIDELINES - READ THIS BEFORE CODING
// ============================================
//
// ** DO NOT CREATE NEW INVENTORY RENDERING CODE **
//
// If you need to display inventory items anywhere in the game:
// 1. DO NOT write custom HTML generation for items
// 2. DO NOT implement your own item stacking logic
// 3. DO NOT create manual event listeners for item actions
// 4. ALWAYS use the functions in this module
//
// ============================================
// AVAILABLE FUNCTIONS
// ============================================
//
// 1. renderInventoryGrid(containerElement, character, onItemAction)
//    - Use for: Full inventory display (main inventory tab)
//    - Example: See main.js renderInventoryUI()
//
// 2. renderEquipmentSlots(containerElement, character, onItemAction)
//    - Use for: Equipment display
//    - Example: See main.js renderEquipmentUI()
//
// 3. renderMiniInventory(containerElement, character, onItemClick, options)
//    - Use for: Compact inventory views (crafting, trading, etc.)
//    - Example: See crafting.js renderMiniInventory()
//    - Options: { usedItemIds: [] } for availability tracking
//
// 4. renderCombatItemsMenu(containerElement, character, onItemUse, onBack)
//    - Use for: Combat consumables menu
//    - Example: See combat-manager.js showItemsMenu()
//
// 5. showItemDetailsModal(item)
//    - Use for: Displaying item details in a modal
//    - Example: See main.js handleItemAction()
//
// 6. createItemStacks(items)
//    - Use for: Manual item stacking if needed
//    - Returns: Map of stacked items
//
// ============================================
// USAGE EXAMPLES
// ============================================
//
// Example 1: Basic inventory display
// -----------------------------------
// const inventoryGrid = document.getElementById('inventory-grid');
// const character = GameState.getState().character;
//
// InventoryUI.renderInventoryGrid(inventoryGrid, character, (action, item, context, slot, stack) => {
//     if (action === 'equip') equipItem(item.id);
//     if (action === 'use') useItem(item.id);
//     if (action === 'toss') discardItem(item.id);
//     if (action === 'info') InventoryUI.showItemDetailsModal(item);
// });
//
// Example 2: Mini inventory for a trading window
// -----------------------------------------------
// const miniInventory = document.getElementById('trade-inventory');
// const character = GameState.getState().character;
//
// InventoryUI.renderMiniInventory(
//     miniInventory,
//     character,
//     (item) => {
//         // Called when item is clicked
//         addItemToTradeSlot(item);
//     },
//     { usedItemIds: getCurrentTradeItemIds() } // Optional: mark items as used
// );
//
// Example 3: Combat items menu
// -----------------------------
// const combatActions = document.querySelector('.combat-actions');
// const character = GameState.getState().character;
//
// InventoryUI.renderCombatItemsMenu(
//     combatActions,
//     character,
//     (item) => {
//         // Called when item is used
//         useItemInCombat(item);
//     },
//     () => {
//         // Called when back button is clicked
//         showCombatMenu();
//     }
// );
//
// ============================================
// MODIFYING THIS MODULE
// ============================================
//
// When changing this module:
// 1. Test ALL inventory views: main, crafting, combat
// 2. Ensure backward compatibility with existing callbacks
// 3. Update usage examples above if API changes
// 4. Update CLAUDE.md with any architectural changes
//
// ============================================

const InventoryUI = (() => {
    // ============================================
    // MODULE STATE (for filtering and sorting)
    // ============================================

    let currentFilter = 'all';
    let currentSort = 'default';
    let searchQuery = '';

    // ============================================
    // CORE RENDERING FUNCTIONS
    // ============================================

    /**
     * Render a full inventory grid (for main inventory tab)
     * @param {HTMLElement} containerElement - The DOM element to render into
     * @param {Object} character - The character object with inventory
     * @param {Function} onItemAction - Callback for item actions (equip, use, toss, info)
     */
    function renderInventoryGrid(containerElement, character, onItemAction) {
        if (!containerElement || !character) return;

        containerElement.innerHTML = '';

        // Get stacked items from inventory
        let stacks = Inventory.getStackedItems(character.inventory);

        // Apply filters and sorting
        stacks = applyFiltersAndSort(stacks);

        // Update inventory count
        updateInventoryCount(character);

        // Create slots for each stack
        stacks.forEach((stack, index) => {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slotIndex = index;

            // Get primary category for visual indicator
            const primaryCategory = stack.item.classifications && stack.item.classifications.length > 0
                ? stack.item.classifications[0]
                : 'unknown';
            slot.dataset.category = primaryCategory;

            renderItemInSlot(slot, stack.item, 'inventory', stack, null, false, onItemAction);
            containerElement.appendChild(slot);
        });
    }

    /**
     * Render equipment slots (for main inventory tab)
     * @param {HTMLElement} containerElement - The DOM element to render into
     * @param {Object} character - The character object with equipment
     * @param {Function} onItemAction - Callback for item actions (unequip, toss, info)
     */
    function renderEquipmentSlots(containerElement, character, onItemAction) {
        if (!containerElement || !character) return;

        containerElement.innerHTML = '';

        // Define slot order and labels
        const slots = [
            { key: 'head', label: 'Head' },
            { key: 'neck', label: 'Neck' },
            { key: 'chest', label: 'Chest' },
            { key: 'hands', label: 'Hands' },
            { key: 'legs', label: 'Legs' },
            { key: 'feet', label: 'Feet' },
            { key: 'main_hand', label: 'Main Hand' },
            { key: 'off_hand', label: 'Off Hand' },
            { key: 'ring1', label: 'Ring 1' },
            { key: 'ring2', label: 'Ring 2' },
            { key: 'cloak', label: 'Cloak' }
        ];

        // Check if main hand has a two-handed weapon
        const mainHandItem = character.equipment.main_hand;
        const isTwoHandedEquipped = mainHandItem && mainHandItem.classifications && mainHandItem.classifications.includes('two-handed');

        slots.forEach(({ key, label }) => {
            // Skip off_hand slot if two-handed weapon is equipped
            if (key === 'off_hand' && isTwoHandedEquipped) {
                return;
            }

            const item = character.equipment[key];
            const slotElement = document.createElement('div');
            slotElement.dataset.slot = key;

            if (item) {
                slotElement.className = 'equipment-slot occupied';

                // Special rendering for two-handed weapons in main hand
                if (key === 'main_hand' && isTwoHandedEquipped) {
                    renderItemInSlot(slotElement, item, 'equipment', null, key, true, onItemAction);
                } else {
                    renderItemInSlot(slotElement, item, 'equipment', null, key, false, onItemAction);
                }
            } else {
                slotElement.className = 'equipment-slot empty';
                slotElement.textContent = label;
            }

            containerElement.appendChild(slotElement);
        });
    }

    /**
     * Render a mini inventory (for crafting window, compact views)
     * @param {HTMLElement} containerElement - The DOM element to render into
     * @param {Object} character - The character object with inventory
     * @param {Function} onItemClick - Callback when item is clicked
     * @param {Object} options - Additional options (usedItemIds for availability tracking)
     */
    function renderMiniInventory(containerElement, character, onItemClick, options = {}) {
        if (!containerElement || !character) return;

        containerElement.innerHTML = '';

        // Get stacked items from inventory
        const stacks = Inventory.getStackedItems(character.inventory);

        // Get used item IDs from options (for crafting availability tracking)
        const usedItemIds = options.usedItemIds || [];

        // Render stacked items
        stacks.forEach(stack => {
            const slot = document.createElement('div');
            slot.className = 'mini-inventory-slot';
            slot.dataset.itemName = stack.item.name;
            // Store all item IDs in the stack
            slot.dataset.itemIds = JSON.stringify(stack.items.map(i => i.id));

            // Count how many items from this stack are currently used
            const usedCount = stack.items.filter(item => usedItemIds.includes(item.id)).length;
            const availableCount = stack.quantity - usedCount;

            // Display with count if more than 1
            const displayName = availableCount > 1
                ? `${stack.item.name} x${availableCount}`
                : stack.item.name;

            slot.innerHTML = `
                <div class="item-card">
                    <span class="item-name">${displayName}</span>
                </div>
            `;

            // Mark as used if all instances are used
            if (usedCount >= stack.quantity) {
                slot.classList.add('used');
            }

            // Add click event
            if (onItemClick) {
                slot.addEventListener('click', () => {
                    // Get the first available item from the stack
                    const availableItem = stack.items.find(item => !usedItemIds.includes(item.id));
                    if (availableItem) {
                        onItemClick(availableItem, stack);
                    }
                });
            }

            containerElement.appendChild(slot);
        });
    }

    /**
     * Render combat items menu (for combat window)
     * @param {HTMLElement} containerElement - The DOM element to render into
     * @param {Object} character - The character object with inventory
     * @param {Function} onItemUse - Callback when item is used
     * @param {Function} onBack - Callback for back button
     */
    function renderCombatItemsMenu(containerElement, character, onItemUse, onBack) {
        if (!containerElement) return;

        if (!character || !character.inventory) {
            containerElement.innerHTML = `
                <div class="action-message">No items available</div>
                <div class="combat-menu">
                    <button class="menu-btn back-btn" id="back-to-menu-btn">← Back</button>
                </div>
            `;
            document.getElementById('back-to-menu-btn')?.addEventListener('click', onBack);
            return;
        }

        // Get consumable items usable in combat
        let consumableItems = [];
        if (window.ConsumableManager) {
            consumableItems = ConsumableManager.getCombatConsumables(character.inventory);
        }

        // Group items by name and icon (stacking)
        const itemStacks = createItemStacks(consumableItems);

        let itemsHTML = '';
        if (itemStacks.size > 0) {
            itemStacks.forEach(stack => {
                const displayName = stack.quantity > 1
                    ? `${stack.item.name} x${stack.quantity}`
                    : stack.item.name;
                itemsHTML += `<button class="menu-btn item-btn" data-item-id="${stack.item.id}">${stack.item.icon || '📦'} ${displayName}</button>`;
            });
        } else {
            itemsHTML = '<div class="action-message no-items">No usable items</div>';
        }

        containerElement.innerHTML = `
            <div class="action-message">Select an item to use:</div>
            <div class="combat-menu">
                ${itemsHTML}
                <button class="menu-btn back-btn" id="back-to-menu-btn">← Back</button>
            </div>
        `;

        // Add event listeners to item buttons
        document.querySelectorAll('[data-item-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.getAttribute('data-item-id');
                const item = character.inventory.items.find(i => i.id === itemId);
                if (item && onItemUse) {
                    onItemUse(item);
                }
            });
        });

        // Back button
        document.getElementById('back-to-menu-btn')?.addEventListener('click', onBack);
    }

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Render an item in a slot (internal helper)
     * @private
     */
    function renderItemInSlot(slotElement, item, context, stack = null, equipSlot = null, isTwoHanded = false, onItemAction = null) {
        slotElement.classList.remove('empty');

        if (context === 'equipment') {
            slotElement.classList.add('occupied');

            // Get the slot label - show "Both Hands" for two-handed weapons
            let slotLabel = equipSlot ? equipSlot.replace('_', ' ') : '';
            if (isTwoHanded) {
                slotLabel = 'Both Hands';
            }

            slotElement.innerHTML = `
                <div class="equipment-slot-content">
                    <span class="equipment-slot-icon">${item.icon}</span>
                    <div class="equipment-slot-info">
                        <div class="equipment-slot-name">${item.name}</div>
                        <div class="equipment-slot-label">${slotLabel}</div>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="item-action-btn unequip" data-action="unequip">Unequip</button>
                    <button class="item-action-btn toss" data-action="toss">Toss</button>
                    <button class="item-action-btn info" data-action="info">Info</button>
                </div>
            `;

            // Store item ID in dataset
            slotElement.dataset.itemId = item.id;

            // Attach event listeners to buttons
            if (onItemAction) {
                const actionsDiv = slotElement.querySelector('.item-actions');
                attachItemEventListeners(actionsDiv, item, context, equipSlot, stack, onItemAction);
            }
        } else {
            // Check item classifications
            const isConsumable = item.classifications && item.classifications.includes('consumable');
            const isMaterial = item.classifications && item.classifications.includes('material');
            const isEquipable = item.classifications && (
                item.classifications.includes('weapon') ||
                item.classifications.includes('armor') ||
                item.classifications.includes('accessory') ||
                item.classifications.includes('off_hand')
            );

            // Quantity badge (only show if > 1)
            const quantityBadgeHTML = stack && stack.quantity > 1
                ? `<div class="quantity-badge">${stack.quantity}</div>`
                : '';

            // Build single action button based on item type
            let actionButtonHTML = '';
            if (isMaterial) {
                actionButtonHTML = '<div class="item-material-label">Material</div>';
            } else if (isConsumable) {
                actionButtonHTML = '<button class="item-primary-btn use" data-action="use">Use</button>';
            } else if (isEquipable) {
                actionButtonHTML = '<button class="item-primary-btn equip" data-action="equip">Equip</button>';
            }

            slotElement.innerHTML = `
                ${quantityBadgeHTML}
                <div class="item-card" data-action="info">
                    <span class="item-icon">${item.icon}</span>
                    <span class="item-name">${item.name}</span>
                </div>
                ${actionButtonHTML}
            `;

            // Store item ID in dataset (use first item in stack)
            slotElement.dataset.itemId = item.id;

            // Attach event listeners
            if (onItemAction) {
                // Item card click shows info modal
                const itemCard = slotElement.querySelector('.item-card');
                if (itemCard) {
                    itemCard.addEventListener('click', (e) => {
                        e.stopPropagation();
                        onItemAction('info', item, context, null, stack);
                    });
                }

                // Primary button action
                const primaryBtn = slotElement.querySelector('.item-primary-btn');
                if (primaryBtn) {
                    primaryBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const action = primaryBtn.dataset.action;
                        onItemAction(action, item, context, null, stack);
                    });
                }
            }
        }
    }

    /**
     * Attach event listeners to item action buttons (internal helper)
     * @private
     */
    function attachItemEventListeners(actionsDiv, item, context, slot = null, stack = null, onItemAction) {
        if (!onItemAction) return;

        // Get all action buttons
        const actionButtons = actionsDiv.querySelectorAll('.item-action-btn');

        actionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = button.dataset.action;

                // Call the action callback with context
                onItemAction(action, item, context, slot, stack);
            });
        });
    }

    /**
     * Create item stacks from a list of items (groups by name and icon)
     * @param {Array} items - Array of items to stack
     * @returns {Map} Map of stacks
     */
    function createItemStacks(items) {
        const itemStacks = new JavaScriptMap();

        items.forEach(item => {
            const key = `${item.name}_${item.icon}`;
            if (!itemStacks.has(key)) {
                itemStacks.set(key, {
                    item: item,
                    quantity: 0,
                    items: []
                });
            }
            const stack = itemStacks.get(key);
            stack.quantity++;
            stack.items.push(item);
        });

        return itemStacks;
    }

    /**
     * Apply filters and sorting to item stacks
     * @private
     */
    function applyFiltersAndSort(stacks) {
        let filtered = [...stacks];

        // Apply category filter
        if (currentFilter !== 'all') {
            filtered = filtered.filter(stack => {
                return stack.item.classifications &&
                       stack.item.classifications.includes(currentFilter);
            });
        }

        // Apply search filter
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(stack => {
                return stack.item.name.toLowerCase().includes(query);
            });
        }

        // Apply sorting
        if (currentSort === 'name-asc') {
            filtered.sort((a, b) => a.item.name.localeCompare(b.item.name));
        } else if (currentSort === 'name-desc') {
            filtered.sort((a, b) => b.item.name.localeCompare(a.item.name));
        } else if (currentSort === 'type') {
            filtered.sort((a, b) => {
                const typeA = a.item.classifications && a.item.classifications[0] || 'unknown';
                const typeB = b.item.classifications && b.item.classifications[0] || 'unknown';
                return typeA.localeCompare(typeB);
            });
        }
        // 'default' sort maintains original order

        return filtered;
    }

    /**
     * Update inventory count display
     * @private
     */
    function updateInventoryCount(character) {
        const countDisplay = document.getElementById('inventory-count-display');
        if (countDisplay && character && character.inventory) {
            const current = character.inventory.items.length;
            const capacity = character.inventory.capacity;
            countDisplay.textContent = `${current} / ${capacity}`;
        }
    }

    /**
     * Setup inventory controls (search, filter, sort)
     * @param {HTMLElement} container - The inventory grid container
     * @param {Object} character - The character object
     * @param {Function} onItemAction - Callback for item actions
     */
    function setupInventoryControls(container, character, onItemAction) {
        const searchInput = document.getElementById('inventory-search');
        const filterButtons = document.querySelectorAll('.filter-btn');
        const sortSelect = document.getElementById('sort-select');

        if (!searchInput || !filterButtons || !sortSelect) {
            console.warn('Inventory control elements not found');
            return;
        }

        // Search input
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderInventoryGrid(container, character, onItemAction);
        });

        // Filter buttons
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update filter
                currentFilter = btn.dataset.filter;
                renderInventoryGrid(container, character, onItemAction);
            });
        });

        // Sort dropdown
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            renderInventoryGrid(container, character, onItemAction);
        });

        // Initial count update
        updateInventoryCount(character);
    }

    /**
     * Show item details modal
     * @param {Object} item - The item to display
     */
    function showItemDetailsModal(item, onItemAction = null) {
        const modal = document.getElementById('item-details-modal');
        const modalName = document.getElementById('modal-item-name');
        const modalDescription = document.getElementById('modal-item-description');
        const modalStatsContent = document.getElementById('modal-stats-content');

        if (!modal || !modalName || !modalDescription || !modalStatsContent) {
            console.error('Item details modal elements not found');
            return;
        }

        // Set content
        modalName.textContent = item.name;
        modalDescription.textContent = item.description;

        // Build stats HTML
        let statsHTML = '';
        if (item.stats && Object.keys(item.stats).length > 0) {
            for (const [key, value] of Object.entries(item.stats)) {
                const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
                statsHTML += `<div><strong>${capitalizedKey}:</strong> ${value}</div>`;
            }
        }

        // Display classifications instead of type
        if (item.classifications && item.classifications.length > 0) {
            const formattedClassifications = item.classifications.map(c => {
                // Capitalize and replace underscores with spaces
                return c.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('-');
            }).join(', ');
            statsHTML += `<div><strong>Type:</strong> ${formattedClassifications}</div>`;
        }

        modalStatsContent.innerHTML = statsHTML;

        // Store item in modal dataset for Discard button
        modal.dataset.itemId = item.id;

        // Show modal
        modal.style.display = 'flex';
    }

    /**
     * Initialize modal close handlers (call once on page load)
     */
    function initModalHandlers() {
        const modal = document.getElementById('item-details-modal');
        if (!modal) return;

        const closeBtn = modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        });
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        // Core rendering functions
        renderInventoryGrid,
        renderEquipmentSlots,
        renderMiniInventory,
        renderCombatItemsMenu,

        // Utility functions
        showItemDetailsModal,
        initModalHandlers,
        createItemStacks,
        setupInventoryControls,
        updateInventoryCount
    };
})();

// Expose to global scope
window.InventoryUI = InventoryUI;
