// ============================================
// Character Class/Object
// ============================================

const Character = (() => {
    function create(name, options = {}) {
        const character = {
            id: options.id || generateId(),
            name,
            age: options.age || 0,
            level: options.level !== undefined ? options.level : 1,
            xp: options.xp || 0,
            totalXP: options.totalXP || 0,
            hp: options.hp !== undefined ? options.hp : 100,
            maxHp: options.maxHp || 100,
            mana: options.mana !== undefined ? options.mana : 50,
            maxMana: options.maxMana || 50,
            stats: options.stats || {
                strength: 0,
                dexterity: 0,
                constitution: 0,
                intelligence: 0,
                wisdom: 0,
                charisma: 0
            },
            attributePoints: options.attributePoints !== undefined ? options.attributePoints : 0,
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
            },
            // Derived combat stats (calculated from attributes)
            meleeAttack: options.meleeAttack !== undefined ? options.meleeAttack : 1.0,
            rangedAttack: options.rangedAttack !== undefined ? options.rangedAttack : 1.0,
            magicAttack: options.magicAttack !== undefined ? options.magicAttack : 1.0,
            defense: options.defense !== undefined ? options.defense : 0,
            evasion: options.evasion !== undefined ? options.evasion : 0,
            critChance: options.critChance !== undefined ? options.critChance : 0,
            carryCapacity: options.carryCapacity !== undefined ? options.carryCapacity : 40
        };

        // Apply stat calculations if CharacterStats is available
        if (window.CharacterStats) {
            CharacterStats.applyToCharacter(character);
        }

        return character;
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

            // Grant 1 attribute point per level
            character.attributePoints = (character.attributePoints || 0) + 1;
        }

        return leveled;
    }

    // Spend an attribute point to increase an attribute
    function spendAttributePoint(character, attributeName) {
        // Validate attribute name
        const validAttributes = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
        if (!validAttributes.includes(attributeName)) {
            return { success: false, error: 'Invalid attribute name' };
        }

        // Check if character has points to spend
        if (!character.attributePoints || character.attributePoints <= 0) {
            return { success: false, error: 'No attribute points available' };
        }

        // Increase the attribute
        if (!character.stats) {
            character.stats = {};
        }
        character.stats[attributeName] = (character.stats[attributeName] || 0) + 1;

        // Decrease available points
        character.attributePoints--;

        // Recalculate derived stats
        if (window.CharacterStats) {
            CharacterStats.applyToCharacter(character);
        }

        // Save the game
        if (window.SaveSystem) {
            SaveSystem.save();
        }

        return { success: true };
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
        getXPProgress,
        spendAttributePoint
    };
})();

window.Character = Character;
