// ============================================
// Item Definitions & Logic
// ============================================

const Items = (() => {
    // Item types mapped to equipment slots
    const ITEM_TYPES = {
        HEAD: 'head',
        NECK: 'neck',
        CHEST: 'chest',
        HANDS: 'hands',
        LEGS: 'legs',
        FEET: 'feet',
        MAIN_HAND: 'main_hand',
        OFF_HAND: 'off_hand',
        RING: 'ring',
        CLOAK: 'cloak',
        CONSUMABLE: 'consumable',
        MATERIAL: 'material',
        MISC: 'misc'
    };

    function createItem(name, type, options = {}) {
        return {
            id: generateItemId(),
            name,
            classifications: options.classifications || [], // Array: 'weapon', 'tool', 'armor', 'head', 'chest', 'one-handed', 'two-handed', etc.
            stats: options.stats || {},
            description: options.description || '',
            stackable: options.stackable || false,
            quantity: options.quantity || 1,
            icon: options.icon || '📦'
        };
    }

    // Derive the equipment slot from item classifications
    function getItemSlot(item) {
        if (!item.classifications) return null;

        const validSlots = ['head', 'neck', 'chest', 'hands', 'legs', 'feet', 'main_hand', 'off_hand', 'ring', 'cloak'];

        // For weapons, always equip to main_hand by default
        if (item.classifications.includes('weapon')) {
            return 'main_hand';
        }

        // For other items, find the slot in their classifications
        for (const classification of item.classifications) {
            if (validSlots.includes(classification)) {
                return classification;
            }
        }

        return null;
    }

    function generateItemId() {
        return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Placeholder items for each equipment slot
    const PLACEHOLDER_ITEMS = {
        head: {
            name: 'Iron Helm',
            classifications: ['armor', 'head'],
            stats: { defense: 5, weight: 3 },
            description: 'A sturdy iron helmet that provides basic head protection.',
            icon: '⛑️'
        },
        neck: {
            name: 'Silver Amulet',
            classifications: ['accessory', 'neck'],
            stats: { magic: 3, charisma: 2 },
            description: 'A mystical amulet that enhances magical abilities.',
            icon: '📿'
        },
        chest: {
            name: 'Leather Armor',
            classifications: ['armor', 'chest'],
            stats: { defense: 10, weight: 8 },
            description: 'Well-crafted leather armor offering good protection.',
            icon: '🦺'
        },
        hands: {
            name: 'Cloth Gloves',
            classifications: ['armor', 'hands'],
            stats: { dexterity: 2, weight: 1 },
            description: 'Light gloves that allow nimble finger movements.',
            icon: '🧤'
        },
        legs: {
            name: 'Chain Leggings',
            classifications: ['armor', 'legs'],
            stats: { defense: 7, weight: 5 },
            description: 'Chainmail leggings providing solid leg protection.',
            icon: '👖'
        },
        feet: {
            name: 'Leather Boots',
            classifications: ['armor', 'feet'],
            stats: { defense: 3, speed: 1 },
            description: 'Comfortable boots suitable for long journeys.',
            icon: '🥾'
        },
        main_hand: {
            name: 'Iron Sword',
            classifications: ['weapon', 'one-handed', 'melee'],
            stats: { damage: 15, weight: 4 },
            description: 'A well-balanced iron sword with a sharp edge.',
            icon: '⚔️'
        },
        off_hand: {
            name: 'Wooden Shield',
            classifications: ['off_hand', 'one-handed', 'shield'],
            stats: { defense: 8, weight: 6 },
            description: 'A sturdy wooden shield reinforced with metal bands.',
            icon: '🛡️'
        },
        ring1: {
            name: 'Gold Ring',
            classifications: ['accessory', 'ring'],
            stats: { charisma: 3, value: 100 },
            description: 'A beautiful gold ring with intricate engravings.',
            icon: '💍'
        },
        ring2: {
            name: 'Ruby Ring',
            classifications: ['accessory', 'ring'],
            stats: { strength: 2, value: 150 },
            description: 'A ring with a gleaming ruby that radiates power.',
            icon: '💍'
        },
        cloak: {
            name: 'Traveler\'s Cloak',
            classifications: ['armor', 'cloak'],
            stats: { defense: 2, stealth: 3 },
            description: 'A hooded cloak perfect for traveling incognito.',
            icon: '🧥'
        }
    };

    function createPlaceholderItem(slotKey) {
        const template = PLACEHOLDER_ITEMS[slotKey];
        if (!template) return null;

        return createItem(template.name, null, {
            classifications: template.classifications,
            stats: { ...template.stats },
            description: template.description,
            icon: template.icon
        });
    }

    function createAllPlaceholderItems() {
        const items = [];
        for (const slotKey in PLACEHOLDER_ITEMS) {
            items.push(createPlaceholderItem(slotKey));
        }
        return items;
    }

    // Helper functions for item classifications
    function isWeapon(item) {
        return item.classifications && item.classifications.includes('weapon');
    }

    function isTool(item) {
        return item.classifications && item.classifications.includes('tool');
    }

    function isTwoHanded(item) {
        return item.classifications && item.classifications.includes('two-handed');
    }

    function isOneHanded(item) {
        return item.classifications && item.classifications.includes('one-handed');
    }

    function hasClassification(item, classification) {
        return item.classifications && item.classifications.includes(classification);
    }

    function init() {
        console.log('Items: Initializing...');
    }

    return {
        init,
        createItem,
        createPlaceholderItem,
        createAllPlaceholderItems,
        getItemSlot,
        isWeapon,
        isTool,
        isTwoHanded,
        isOneHanded,
        hasClassification,
        ITEM_TYPES
    };
})();

window.Items = Items;

// ============================================
// Item Factory - Loads items from JSON
// ============================================

const ItemFactory = (() => {
    let itemDatabase = {};

    async function init() {
        console.log('ItemFactory: Loading items from items.json...');
        try {
            const response = await fetch('data/items.json');
            const data = await response.json();

            // Store items in a map for quick lookup
            if (data.items && Array.isArray(data.items)) {
                data.items.forEach(item => {
                    itemDatabase[item.id] = item;
                });
                console.log(`ItemFactory: Loaded ${data.items.length} items`);
            } else {
                console.error('ItemFactory: Invalid items.json format');
            }
        } catch (error) {
            console.error('ItemFactory: Failed to load items.json', error);
        }
    }

    function createItem(itemId) {
        const template = itemDatabase[itemId];
        if (!template) {
            console.error(`ItemFactory: Item template not found for id: ${itemId}`);
            return null;
        }

        // Create a new item instance from the template
        // Each item gets a unique ID for inventory tracking
        return {
            ...JSON.parse(JSON.stringify(template)), // Deep clone
            id: generateItemId(itemId)
        };
    }

    function generateItemId(baseId) {
        return baseId + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function getItemTemplate(itemId) {
        return itemDatabase[itemId] || null;
    }

    function getAllItemIds() {
        return Object.keys(itemDatabase);
    }

    function getAllItems() {
        return Object.values(itemDatabase);
    }

    return {
        init,
        createItem,
        getItemTemplate,
        getAllItemIds,
        getAllItems
    };
})();

window.ItemFactory = ItemFactory;
