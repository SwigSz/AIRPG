// ============================================
// Equipment System
// ============================================

const Equipment = (() => {
    // Equipment slot names
    const EQUIPMENT_SLOTS = {
        HEAD: 'head',
        NECK: 'neck',
        CHEST: 'chest',
        HANDS: 'hands',
        LEGS: 'legs',
        FEET: 'feet',
        MAIN_HAND: 'main_hand',
        OFF_HAND: 'off_hand',
        RING1: 'ring1',
        RING2: 'ring2',
        CLOAK: 'cloak'
    };

    function create() {
        return {
            head: null,
            neck: null,
            chest: null,
            hands: null,
            legs: null,
            feet: null,
            main_hand: null,
            off_hand: null,
            ring1: null,
            ring2: null,
            cloak: null
        };
    }

    function equipItem(equipment, item) {
        if (!item || !item.slot) {
            console.error('Cannot equip item: invalid item or missing slot', item);
            return false;
        }

        const slot = item.slot;
        if (!(slot in equipment)) {
            console.error(`Invalid equipment slot: ${slot}`);
            return false;
        }

        // Unequip existing item in that slot first
        const previousItem = equipment[slot];
        equipment[slot] = item;

        console.log(`Equipped ${item.name} to ${slot}`);
        return previousItem; // Return the previously equipped item (or null)
    }

    function unequipItem(equipment, slot) {
        if (!(slot in equipment)) {
            console.error(`Invalid equipment slot: ${slot}`);
            return null;
        }

        const item = equipment[slot];
        equipment[slot] = null;

        if (item) {
            console.log(`Unequipped ${item.name} from ${slot}`);
        }

        return item; // Return the unequipped item (or null)
    }

    function getEquippedItem(equipment, slot) {
        return equipment[slot] || null;
    }

    function getAllEquippedItems(equipment) {
        const items = [];
        for (const slot in equipment) {
            if (equipment[slot]) {
                items.push(equipment[slot]);
            }
        }
        return items;
    }

    function isSlotOccupied(equipment, slot) {
        return equipment[slot] !== null;
    }

    function calculateTotalStats(equipment) {
        const totalStats = {};

        for (const slot in equipment) {
            const item = equipment[slot];
            if (item && item.stats) {
                for (const stat in item.stats) {
                    if (!totalStats[stat]) {
                        totalStats[stat] = 0;
                    }
                    totalStats[stat] += item.stats[stat];
                }
            }
        }

        return totalStats;
    }

    function init() {
        console.log('Equipment: Initializing...');
    }

    return {
        init,
        create,
        equipItem,
        unequipItem,
        getEquippedItem,
        getAllEquippedItems,
        isSlotOccupied,
        calculateTotalStats,
        EQUIPMENT_SLOTS
    };
})();

window.Equipment = Equipment;
