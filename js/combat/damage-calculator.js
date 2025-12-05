// ============================================
// Centralized Damage Calculation System
// ============================================
// This module handles all damage calculations, including:
// - Weapon damage type detection (melee/ranged/magic)
// - Damage multiplier aggregation from multiple sources
// - Final damage computation
//
// MODDING: To add new damage types or bonus sources, see sections marked with [MODDING]

const DamageCalculator = (() => {
    // [MODDING] Add new damage types here
    const DAMAGE_TYPES = {
        MELEE: 'melee',
        RANGED: 'ranged',
        MAGIC: 'magic'
        // Future: HOLY: 'holy', DARK: 'dark', ELEMENTAL: 'elemental', etc.
    };

    /**
     * Detect the damage type of a weapon based on its classifications
     * @param {Object} weapon - The weapon item object
     * @returns {string|null} - The damage type ('melee', 'ranged', 'magic') or null if none found
     */
    function getWeaponDamageType(weapon) {
        if (!weapon) {
            return null;
        }

        if (!weapon.classifications || !Array.isArray(weapon.classifications)) {
            return null;
        }

        // Check for damage type classifications in priority order
        // [MODDING] Add new damage type checks here in your preferred priority order
        if (weapon.classifications.includes(DAMAGE_TYPES.MELEE)) {
            return DAMAGE_TYPES.MELEE;
        }
        if (weapon.classifications.includes(DAMAGE_TYPES.RANGED)) {
            return DAMAGE_TYPES.RANGED;
        }
        if (weapon.classifications.includes(DAMAGE_TYPES.MAGIC)) {
            return DAMAGE_TYPES.MAGIC;
        }

        return null; // No recognized damage type
    }

    /**
     * Get the base damage multiplier from character attributes
     * @param {Object} character - The character object
     * @param {string} damageType - The damage type ('melee', 'ranged', 'magic')
     * @returns {number} - The multiplier from attributes (1.0 = 100%)
     */
    function getAttributeMultiplier(character, damageType) {
        if (!character) return 1.0;

        // Map damage types to character attribute multipliers
        // These are calculated by CharacterStats.calculate()
        switch (damageType) {
            case DAMAGE_TYPES.MELEE:
                return character.meleeAttack || 1.0;
            case DAMAGE_TYPES.RANGED:
                return character.rangedAttack || 1.0;
            case DAMAGE_TYPES.MAGIC:
                return character.magicAttack || 1.0;
            default:
                return 1.0;
        }
    }

    /**
     * Get additional damage multiplier bonuses from skills, buffs, equipment passives, etc.
     * [MODDING] This is the main extension point for adding new damage bonus sources
     *
     * @param {Object} character - The character object
     * @param {string} damageType - The damage type
     * @returns {number} - Additional multiplier bonus (0.1 = +10%)
     */
    function getAdditionalBonuses(character, damageType) {
        let bonusMultiplier = 0;

        // [MODDING] Add bonus sources here:
        // Examples for future implementation:

        // 1. Skill-based bonuses
        // if (character.skills && character.skills['sword_mastery']?.active) {
        //     if (damageType === DAMAGE_TYPES.MELEE) {
        //         bonusMultiplier += 0.15; // +15% melee damage
        //     }
        // }

        // 2. Temporary buff bonuses
        // if (character.buffs) {
        //     character.buffs.forEach(buff => {
        //         if (buff.type === 'damage_bonus' && buff.damageType === damageType) {
        //             bonusMultiplier += buff.amount;
        //         }
        //     });
        // }

        // 3. Equipment passive bonuses (beyond stat bonuses)
        // if (character.equipment) {
        //     Object.values(character.equipment).forEach(item => {
        //         if (item?.passives?.damageBonus && item.passives.damageType === damageType) {
        //             bonusMultiplier += item.passives.damageBonus;
        //         }
        //     });
        // }

        // 4. Achievement/trait bonuses
        // if (character.traits?.includes('berserker') && damageType === DAMAGE_TYPES.MELEE) {
        //     bonusMultiplier += 0.10; // +10% melee damage
        // }

        return bonusMultiplier;
    }

    /**
     * Calculate the total damage multiplier for a specific damage type
     * This aggregates all bonus sources additively
     *
     * @param {Object} character - The character object
     * @param {string} damageType - The damage type
     * @returns {number} - Total multiplier (1.0 = 100%, 2.0 = 200%)
     */
    function calculateDamageMultiplier(character, damageType) {
        if (!damageType) return 1.0; // No damage type = no multiplier

        // Start with attribute-based multiplier
        const attributeMultiplier = getAttributeMultiplier(character, damageType);

        // Get additional bonuses (these are added to the multiplier)
        const additionalBonuses = getAdditionalBonuses(character, damageType);

        // Final multiplier = attribute multiplier + additional bonuses
        // Example: 2.0 (200% from attributes) + 0.15 (15% from skill) = 2.15 (215% total)
        return attributeMultiplier + additionalBonuses;
    }

    /**
     * Calculate final weapon damage after applying all multipliers
     * THIS IS THE MAIN FUNCTION TO USE FOR DAMAGE CALCULATION
     *
     * @param {Object} character - The character object
     * @param {Object} weapon - The weapon item object
     * @param {number} baseDamage - Base damage value from weapon
     * @returns {Object} - { damage: number, damageType: string|null, multiplier: number, breakdown: string }
     */
    function calculateWeaponDamage(character, weapon, baseDamage) {
        // Detect weapon damage type
        const damageType = getWeaponDamageType(weapon);

        // If no damage type, return base damage unmodified
        if (!damageType) {
            return {
                damage: baseDamage,
                damageType: null,
                multiplier: 1.0,
                breakdown: `Base Damage: ${baseDamage}\nNo damage type modifiers`
            };
        }

        // Calculate total multiplier
        const multiplier = calculateDamageMultiplier(character, damageType);

        // Calculate final damage
        const finalDamage = Math.floor(baseDamage * multiplier);

        // Create breakdown for debugging/tooltips
        const breakdown = createDamageBreakdown(baseDamage, damageType, multiplier, finalDamage);

        return {
            damage: finalDamage,
            damageType: damageType,
            multiplier: multiplier,
            breakdown: breakdown
        };
    }

    /**
     * Create a human-readable breakdown of damage calculation
     * @private
     */
    function createDamageBreakdown(baseDamage, damageType, multiplier, finalDamage) {
        const lines = [];
        lines.push(`Base Damage: ${baseDamage}`);
        lines.push(`Damage Type: ${damageType}`);
        lines.push(`Multiplier: ${Math.round(multiplier * 100)}%`);
        lines.push(`Final Damage: ${finalDamage}`);
        return lines.join('\n');
    }

    /**
     * Convenience function: Calculate damage for currently equipped weapon
     * @param {Object} character - The character object
     * @returns {number} - Final damage value
     */
    function calculateCurrentWeaponDamage(character) {
        if (!character || !character.equipment) {
            return 5; // Unarmed damage
        }

        // Get equipped weapon (check both naming conventions)
        const weapon = character.equipment.main_hand || character.equipment.mainHand;

        if (!weapon) {
            return 5; // Unarmed damage
        }

        // Get weapon's base damage
        const baseDamage = weapon.stats?.damage || 5;

        // Calculate final damage
        const result = calculateWeaponDamage(character, weapon, baseDamage);
        return result.damage;
    }

    // Public API
    return {
        // Main functions
        calculateWeaponDamage,
        calculateCurrentWeaponDamage,
        calculateDamageMultiplier,

        // Utility functions
        getWeaponDamageType,
        getAttributeMultiplier,

        // Constants (for external reference)
        DAMAGE_TYPES
    };
})();

window.DamageCalculator = DamageCalculator;
