// ============================================
// Enemy Class
// ============================================

const Enemy = (() => {
    function create(type, level) {
        return {
            id: Utils.generateId(),
            type,
            level,
            hp: 100,
            maxHp: 100
        };
    }

    return {
        create
    };
})();

window.Enemy = Enemy;
