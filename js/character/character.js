// ============================================
// Character Class/Object
// ============================================

const Character = (() => {
    function create(name, options = {}) {
        return {
            id: Utils.generateId(),
            name,
            age: 0,
            stats: {},
            skills: {},
            traits: [],
            profession: null,
            generation: options.generation || 1
        };
    }

    return {
        create
    };
})();

window.Character = Character;
