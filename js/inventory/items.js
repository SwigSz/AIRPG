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
            type, // Item type from ITEM_TYPES
            slot: options.slot || null, // Equipment slot if applicable
            stats: options.stats || {},
            description: options.description || '',
            stackable: options.stackable || false,
            quantity: options.quantity || 1,
            icon: options.icon || '📦'
        };
    }

    function generateItemId() {
        return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Placeholder items for each equipment slot
    const PLACEHOLDER_ITEMS = {
        head: {
            name: 'Iron Helm',
            type: ITEM_TYPES.HEAD,
            slot: 'head',
            stats: { defense: 5, weight: 3 },
            description: 'A sturdy iron helmet that provides basic head protection.',
            icon: '⛑️'
        },
        neck: {
            name: 'Silver Amulet',
            type: ITEM_TYPES.NECK,
            slot: 'neck',
            stats: { magic: 3, charisma: 2 },
            description: 'A mystical amulet that enhances magical abilities.',
            icon: '📿'
        },
        chest: {
            name: 'Leather Armor',
            type: ITEM_TYPES.CHEST,
            slot: 'chest',
            stats: { defense: 10, weight: 8 },
            description: 'Well-crafted leather armor offering good protection.',
            icon: '🦺'
        },
        hands: {
            name: 'Cloth Gloves',
            type: ITEM_TYPES.HANDS,
            slot: 'hands',
            stats: { dexterity: 2, weight: 1 },
            description: 'Light gloves that allow nimble finger movements.',
            icon: '🧤'
        },
        legs: {
            name: 'Chain Leggings',
            type: ITEM_TYPES.LEGS,
            slot: 'legs',
            stats: { defense: 7, weight: 5 },
            description: 'Chainmail leggings providing solid leg protection.',
            icon: '👖'
        },
        feet: {
            name: 'Leather Boots',
            type: ITEM_TYPES.FEET,
            slot: 'feet',
            stats: { defense: 3, speed: 1 },
            description: 'Comfortable boots suitable for long journeys.',
            icon: '🥾'
        },
        main_hand: {
            name: 'Iron Sword',
            type: ITEM_TYPES.MAIN_HAND,
            slot: 'main_hand',
            stats: { damage: 15, weight: 4 },
            description: 'A well-balanced iron sword with a sharp edge.',
            icon: '⚔️'
        },
        off_hand: {
            name: 'Wooden Shield',
            type: ITEM_TYPES.OFF_HAND,
            slot: 'off_hand',
            stats: { defense: 8, weight: 6 },
            description: 'A sturdy wooden shield reinforced with metal bands.',
            icon: '🛡️'
        },
        ring1: {
            name: 'Gold Ring',
            type: ITEM_TYPES.RING,
            slot: 'ring1',
            stats: { charisma: 3, value: 100 },
            description: 'A beautiful gold ring with intricate engravings.',
            icon: '💍'
        },
        ring2: {
            name: 'Ruby Ring',
            type: ITEM_TYPES.RING,
            slot: 'ring2',
            stats: { strength: 2, value: 150 },
            description: 'A ring with a gleaming ruby that radiates power.',
            icon: '💍'
        },
        cloak: {
            name: 'Traveler\'s Cloak',
            type: ITEM_TYPES.CLOAK,
            slot: 'cloak',
            stats: { defense: 2, stealth: 3 },
            description: 'A hooded cloak perfect for traveling incognito.',
            icon: '🧥'
        }
    };

    function createPlaceholderItem(slotKey) {
        const template = PLACEHOLDER_ITEMS[slotKey];
        if (!template) return null;

        return createItem(template.name, template.type, {
            slot: template.slot,
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

    function init() {
        console.log('Items: Initializing...');
    }

    return {
        init,
        createItem,
        createPlaceholderItem,
        createAllPlaceholderItems,
        ITEM_TYPES
    };
})();

window.Items = Items;
