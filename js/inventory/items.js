// ============================================
// Item Definitions & Logic
// ============================================

const Items = (() => {
    function createItem(name, type, options = {}) {
        return {
            id: generateItemId(),
            name,
            type, // e.g., 'weapon', 'armor', 'consumable', 'material'
            stats: options.stats || {},
            description: options.description || '',
            stackable: options.stackable || false,
            quantity: options.quantity || 1
        };
    }

    function generateItemId() {
        return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function init() {
        console.log('Items: Initializing...');
    }

    return {
        init,
        createItem
    };
})();

window.Items = Items;
