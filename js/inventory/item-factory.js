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

    // Starting item IDs for test character
    // These reference items.json - any changes to items.json are automatically reflected
    const STARTING_ITEM_IDS = [
        'iron_helm',
        'silver_amulet',
        'leather_armor',
        'cloth_gloves',
        'chain_leggings',
        'leather_boots',
        'iron_sword',
        'wooden_shield',
        'gold_ring',
        'ruby_ring',
        'travelers_cloak'
    ];

    /**
     * Create starting items for test character
     * These are loaded from items.json via ItemFactory
     * @returns {Array} Array of item instances
     */
    function createAllPlaceholderItems() {
        const items = [];

        // Use ItemFactory to load items from JSON
        if (window.ItemFactory) {
            STARTING_ITEM_IDS.forEach(itemId => {
                const item = ItemFactory.createItem(itemId);
                if (item) {
                    items.push(item);
                } else {
                    console.warn(`Items.createAllPlaceholderItems: Could not create item '${itemId}' - not found in items.json`);
                }
            });
        } else {
            console.error('Items.createAllPlaceholderItems: ItemFactory not available');
        }

        return items;
    }

    /**
     * @deprecated Use ItemFactory.createItem(itemId) instead
     * This function is kept for backwards compatibility only
     */
    function createPlaceholderItem(slotKey) {
        console.warn('Items.createPlaceholderItem is deprecated - use ItemFactory.createItem(itemId) instead');

        // Map old slot keys to item IDs
        const slotToItemId = {
            head: 'iron_helm',
            neck: 'silver_amulet',
            chest: 'leather_armor',
            hands: 'cloth_gloves',
            legs: 'chain_leggings',
            feet: 'leather_boots',
            main_hand: 'iron_sword',
            off_hand: 'wooden_shield',
            ring1: 'gold_ring',
            ring2: 'ruby_ring',
            cloak: 'travelers_cloak'
        };

        const itemId = slotToItemId[slotKey];
        if (!itemId) return null;

        return window.ItemFactory ? ItemFactory.createItem(itemId) : null;
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
