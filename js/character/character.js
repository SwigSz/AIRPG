// ============================================
// Character Class/Object
// ============================================

const Character = (() => {
    function create(name, options = {}) {
        return {
            id: options.id || generateId(),
            name,
            age: options.age || 0,
            level: options.level !== undefined ? options.level : 1,
            xp: options.xp || 0,
            totalXP: options.totalXP || 0,
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

    // Calculate XP needed for next level
    function getXPForLevel(level) {
        // Level 1->2: 10xp, Level 2->3: 20xp
        return level * 10;
    }

    // Add XP and handle level-ups
    function addXP(character, amount) {
        character.xp += amount;
        character.totalXP += amount;

        // Check for level-up
        let leveled = false;
        while (character.xp >= getXPForLevel(character.level)) {
            character.xp -= getXPForLevel(character.level);
            character.level++;
            leveled = true;
        }

        return leveled;
    }

    // Get current XP progress
    function getXPProgress(character) {
        const needed = getXPForLevel(character.level);
        const current = character.xp;
        return { current, needed, percentage: (current / needed) * 100 };
    }

    return {
        create,
        addXP,
        getXPForLevel,
        getXPProgress
    };
})();

window.Character = Character;
