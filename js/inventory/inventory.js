// ============================================
// Inventory Management
// ============================================

const Inventory = (() => {
    function create() {
        return {
            items: [],
            capacity: 64 // 8x8 grid
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
        console.log(`Removed ${removedItem.name} from inventory`);
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

        if (!item.slot) {
            console.error('Item cannot be equipped - no slot defined');
            return false;
        }

        // Remove from inventory
        removeItem(character.inventory, itemId);

        // Equip the item (returns previously equipped item if any)
        const previousItem = Equipment.equipItem(character.equipment, item);

        // If there was a previously equipped item, add it back to inventory
        if (previousItem) {
            addItem(character.inventory, previousItem);
        }

        console.log(`Equipped ${item.name}`);
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
        console.log(`Unequipped ${item.name} to inventory`);
        return true;
    }

    // Group stackable items by name and icon for display purposes
    function getStackedItems(inventory) {
        const stacks = [];
        const processed = new Set();

        inventory.items.forEach((item, index) => {
            if (processed.has(index)) return;

            if (item.stackable) {
                // Find all items with the same name and icon
                const stackItems = inventory.items.filter((otherItem, otherIndex) => {
                    return !processed.has(otherIndex) &&
                           otherItem.stackable &&
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
                    isStack: true
                });
            } else {
                processed.add(index);
                stacks.push({
                    item: item,
                    items: [item],
                    quantity: 1,
                    isStack: false
                });
            }
        });

        return stacks;
    }

    function init() {
        console.log('Inventory: Initializing...');
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
