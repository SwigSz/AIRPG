// ============================================
// Settlement Class/Object
// ============================================

const Settlement = (() => {
    function create(name) {
        return {
            id: Utils.generateId(),
            name,
            population: GameConfig.SETTLEMENT.STARTING_POPULATION,
            resources: {},
            upgrades: [],
            research: []
        };
    }

    return {
        create
    };
})();

window.Settlement = Settlement;
