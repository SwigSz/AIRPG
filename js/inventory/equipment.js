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
        CLOAK: 'cloak',
        PICKAXE: 'pickaxe',
        WOODCUTTING_AXE: 'woodcutting_axe'
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
            cloak: null,
            pickaxe: null,
            woodcutting_axe: null
        };
    }

    function equipItem(equipment, item) {
        if (!item) {
            console.error('Cannot equip item: invalid item', item);
            return { success: false, unequippedItems: [] };
        }

        // Derive slot from item classifications
        let slot = window.Items ? Items.getItemSlot(item) : null;

        if (!slot) {
            console.error('Cannot equip item: no valid slot found in classifications', item);
            return { success: false, unequippedItems: [] };
        }

        // Special handling for rings - check both ring slots and use the first empty one
        if (slot === 'ring') {
            if (!equipment.ring1) {
                slot = 'ring1';
            } else if (!equipment.ring2) {
                slot = 'ring2';
            } else {
                // Both slots occupied, replace ring1
                slot = 'ring1';
            }
        }

        if (!(slot in equipment)) {
            console.error(`Invalid equipment slot: ${slot}`);
            return { success: false, unequippedItems: [] };
        }

        // Check if item is two-handed
        const isTwoHanded = item.classifications && item.classifications.includes('two-handed');

        // Array to store items being unequipped
        const unequippedItems = [];

        if (isTwoHanded) {
            // Two-handed weapon takes both main and off hand - clear both slots
            if (equipment.main_hand) {
                unequippedItems.push(equipment.main_hand);
            }
            if (equipment.off_hand) {
                unequippedItems.push(equipment.off_hand);
            }
            equipment.main_hand = item;
            equipment.off_hand = null;
        } else {
            // If equipping to off-hand while two-handed is equipped in main hand, unequip it
            if (slot === 'off_hand' && equipment.main_hand && equipment.main_hand.classifications && equipment.main_hand.classifications.includes('two-handed')) {
                unequippedItems.push(equipment.main_hand);
                equipment.main_hand = null;
            }

            // Unequip existing item in target slot
            if (equipment[slot]) {
                unequippedItems.push(equipment[slot]);
            }

            // Equip the new item
            equipment[slot] = item;
        }

        // Return result object with all unequipped items
        return { success: true, unequippedItems: unequippedItems };
    }

    function unequipItem(equipment, slot) {
        if (!(slot in equipment)) {
            console.error(`Invalid equipment slot: ${slot}`);
            return null;
        }

        const item = equipment[slot];
        equipment[slot] = null;

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
