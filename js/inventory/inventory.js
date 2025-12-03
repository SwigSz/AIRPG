// ============================================
// Inventory Management
// ============================================

const Inventory = (() => {
    function create() {
        return {
            items: [],
            capacity: 256 // 16x16 grid potential (dynamic rendering)
        };
    }

    function addItem(inventory, item) {
        if (inventory.items.length >= inventory.capacity) {
            return false;
        }

        inventory.items.push(item);
        return true;
    }

    function removeItem(inventory, itemId) {
        const index = inventory.items.findIndex(item => item.id === itemId);
        if (index === -1) {
            console.error('Item not found in inventory');
            return null;
        }

        const removedItem = inventory.items.splice(index, 1)[0];
        return removedItem;
    }

    function getItem(inventory, itemId) {
        return inventory.items.find(item => item.id === itemId) || null;
    }

    function hasSpace(inventory) {
        return inventory.items.length < inventory.capacity;
    }

    function getItemCount(inventory) {
        return inventory.items.length;
    }

    function clear(inventory) {
        inventory.items = [];
    }

    // Equip item from inventory to equipment
    function equipItemFromInventory(character, itemId) {
        const item = getItem(character.inventory, itemId);
        if (!item) {
            console.error('Item not found in inventory');
            return false;
        }

        // Remove from inventory
        removeItem(character.inventory, itemId);

        // Equip the item (returns result object with unequipped items array)
        const result = Equipment.equipItem(character.equipment, item);

        if (!result.success) {
            // Re-add item to inventory if equipping failed
            addItem(character.inventory, item);
            return false;
        }

        // Add all unequipped items back to inventory
        if (result.unequippedItems && result.unequippedItems.length > 0) {
            result.unequippedItems.forEach(unequippedItem => {
                addItem(character.inventory, unequippedItem);
            });
        }

        // Recalculate character stats after equipment change
        if (window.CharacterStats) {
            CharacterStats.applyToCharacter(character);
        }

        return true;
    }

    // Unequip item from equipment to inventory
    function unequipItemToInventory(character, slot) {
        if (!hasSpace(character.inventory)) {
            console.error('No space in inventory to unequip item');
            return false;
        }

        const item = Equipment.unequipItem(character.equipment, slot);
        if (!item) {
            console.error('No item equipped in that slot');
            return false;
        }

        addItem(character.inventory, item);

        // Recalculate character stats after equipment change
        if (window.CharacterStats) {
            CharacterStats.applyToCharacter(character);
        }

        return true;
    }

    // Group items by name and icon for display purposes - universal stacking
    function getStackedItems(inventory) {
        const stacks = [];
        const processed = new Set();

        inventory.items.forEach((item, index) => {
            if (processed.has(index)) return;

            // Find all items with the same name and icon (universal stacking)
            const stackItems = inventory.items.filter((otherItem, otherIndex) => {
                return !processed.has(otherIndex) &&
                       otherItem.name === item.name &&
                       otherItem.icon === item.icon;
            });

            // Mark all found items as processed
            inventory.items.forEach((otherItem, otherIndex) => {
                if (stackItems.includes(otherItem)) {
                    processed.add(otherIndex);
                }
            });

            // Create a stack representation
            stacks.push({
                item: item, // First item in the stack
                items: stackItems, // All items in the stack
                quantity: stackItems.length,
                isStack: stackItems.length > 1
            });
        });

        return stacks;
    }

    function init() {
        // Inventory initialized
    }

    return {
        init,
        create,
        addItem,
        removeItem,
        getItem,
        hasSpace,
        getItemCount,
        clear,
        equipItemFromInventory,
        unequipItemToInventory,
        getStackedItems
    };
})();

window.Inventory = Inventory;
