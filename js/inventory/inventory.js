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
            console.error('Inventory is full!');
            return false;
        }

        inventory.items.push(item);
        console.log(`Added ${item.name} to inventory`);
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
        unequipItemToInventory
    };
})();

window.Inventory = Inventory;
