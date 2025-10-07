// ============================================
// Character Class/Object
// ============================================

const Character = (() => {
    function create(name, options = {}) {
        return {
            id: options.id || generateId(),
            name,
            age: options.age || 0,
            level: options.level || 1,
            stats: options.stats || {},
            skills: options.skills || [],
            traits: options.traits || [],
            profession: options.profession || null,
            generation: options.generation || 1,
            inventory: options.inventory || [],
            equipment: options.equipment || {
                head: null,
                neck: null,
                chest: null,
                hands: null,
                legs: null,
                feet: null,
                mainHand: null,
                offHand: null,
                ring1: null,
                ring2: null,
                cloak: null
            }
        };
    }

    function generateId() {
        return 'char_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    return {
        create
    };
})();

window.Character = Character;
