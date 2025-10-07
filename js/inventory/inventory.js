// ============================================
// Inventory Management
// ============================================

const Inventory = (() => {
    function create() {
        return {
            items: [],
            capacity: 100
        };
    }

    return {
        create
    };
})();

window.Inventory = Inventory;
