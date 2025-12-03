// ============================================
// Character Stats System - Derived Stats & Formulas
// ============================================

const CharacterStats = (() => {
    // Formula constants for derived stats
    const FORMULAS = {
        // HP = Base HP + (Constitution × HP per CON)
        hp: {
            base: 100,
            perConstitution: 10,
            description: "Base HP + (Constitution × 10)"
        },

        // Mana = Base Mana + (Intelligence × Mana per INT)
        mana: {
            base: 50,
            perIntelligence: 5,
            description: "Base Mana + (Intelligence × 5)"
        },

        // Melee Attack = Base + (Strength × multiplier)
        meleeAttack: {
            base: 1.0,
            perStrength: 0.02, // 2% per point
            description: "100% + (Strength × 2%)"
        },

        // Ranged Attack = Base + (Dexterity × multiplier)
        rangedAttack: {
            base: 1.0,
            perDexterity: 0.02, // 2% per point
            description: "100% + (Dexterity × 2%)"
        },

        // Magic Attack = Base + (Intelligence × multiplier)
        magicAttack: {
            base: 1.0,
            perIntelligence: 0.02, // 2% per point
            description: "100% + (Intelligence × 2%)"
        },

        // Defense = Wisdom / 2 (rounded down)
        defense: {
            base: 0,
            perWisdom: 0.5,
            description: "Wisdom ÷ 2"
        },

        // Evasion = Dexterity × 0.5% (capped at 50%)
        evasion: {
            base: 0,
            perDexterity: 0.5, // 0.5% per point
            max: 50, // Max 50% evasion
            description: "Dexterity × 0.5% (max 50%)"
        },

        // Crit Chance = Dexterity × 0.3% (capped at 30%)
        critChance: {
            base: 0,
            perDexterity: 0.3, // 0.3% per point
            max: 30, // Max 30% crit
            description: "Dexterity × 0.3% (max 30%)"
        },

        // Carry Capacity = Base + (Strength × capacity per STR)
        carryCapacity: {
            base: 40,
            perStrength: 5, // 5 lbs per point
            description: "40 lbs + (Strength × 5 lbs)"
        }
    };

    /**
     * Calculate all derived stats for a character
     * @param {Object} character - The character object
     * @returns {Object} Object containing all derived stats with breakdowns
     */
    function calculate(character) {
        // Get base attributes (with defaults)
        const str = getAttributeValue(character, 'strength');
        const dex = getAttributeValue(character, 'dexterity');
        const con = getAttributeValue(character, 'constitution');
        const int = getAttributeValue(character, 'intelligence');
        const wis = getAttributeValue(character, 'wisdom');
        const cha = getAttributeValue(character, 'charisma');

        // Get equipment bonuses
        const equipBonus = calculateEquipmentBonuses(character);

        // Calculate HP
        const maxHp = Math.floor(
            FORMULAS.hp.base +
            (con * FORMULAS.hp.perConstitution) +
            (equipBonus.constitution * FORMULAS.hp.perConstitution)
        );

        // Calculate Mana
        const maxMana = Math.floor(
            FORMULAS.mana.base +
            (int * FORMULAS.mana.perIntelligence) +
            (equipBonus.intelligence * FORMULAS.mana.perIntelligence)
        );

        // Calculate Melee Attack (as multiplier)
        const totalStr = str + equipBonus.strength;
        const meleeAttack = FORMULAS.meleeAttack.base + (totalStr * FORMULAS.meleeAttack.perStrength);

        // Calculate Ranged Attack (as multiplier)
        const totalDex = dex + equipBonus.dexterity;
        const rangedAttack = FORMULAS.rangedAttack.base + (totalDex * FORMULAS.rangedAttack.perDexterity);

        // Calculate Magic Attack (as multiplier)
        const totalInt = int + equipBonus.intelligence;
        const magicAttack = FORMULAS.magicAttack.base + (totalInt * FORMULAS.magicAttack.perIntelligence);

        // Calculate Defense
        const totalWis = wis + equipBonus.wisdom;
        const defense = Math.floor(totalWis * FORMULAS.defense.perWisdom) + (equipBonus.defense || 0);

        // Calculate Evasion (with cap)
        const evasion = Math.min(
            FORMULAS.evasion.max,
            FORMULAS.evasion.base + (totalDex * FORMULAS.evasion.perDexterity)
        );

        // Calculate Crit Chance (with cap)
        const critChance = Math.min(
            FORMULAS.critChance.max,
            FORMULAS.critChance.base + (totalDex * FORMULAS.critChance.perDexterity)
        );

        // Calculate Carry Capacity
        const totalStrForCapacity = str + equipBonus.strength;
        const carryCapacity = FORMULAS.carryCapacity.base + (totalStrForCapacity * FORMULAS.carryCapacity.perStrength);

        return {
            // Attributes (base + equipment)
            attributes: {
                strength: totalStr,
                dexterity: totalDex,
                constitution: con + equipBonus.constitution,
                intelligence: totalInt,
                wisdom: totalWis,
                charisma: cha + equipBonus.charisma
            },

            // Derived stats
            maxHp,
            maxMana,
            meleeAttack,
            rangedAttack,
            magicAttack,
            defense,
            evasion,
            critChance,
            carryCapacity,

            // Breakdowns for tooltips
            breakdowns: {
                maxHp: getHpBreakdown(con, equipBonus.constitution, maxHp),
                maxMana: getManaBreakdown(int, equipBonus.intelligence, maxMana),
                meleeAttack: getMeleeAttackBreakdown(str, equipBonus.strength, meleeAttack),
                rangedAttack: getRangedAttackBreakdown(dex, equipBonus.dexterity, rangedAttack),
                magicAttack: getMagicAttackBreakdown(int, equipBonus.intelligence, magicAttack),
                defense: getDefenseBreakdown(wis, equipBonus.wisdom, equipBonus.defense || 0, defense),
                evasion: getEvasionBreakdown(dex, equipBonus.dexterity, evasion),
                critChance: getCritChanceBreakdown(dex, equipBonus.dexterity, critChance),
                carryCapacity: getCarryCapacityBreakdown(str, equipBonus.strength, carryCapacity)
            }
        };
    }

    /**
     * Get attribute value from character stats
     */
    function getAttributeValue(character, attributeName) {
        if (!character.stats || typeof character.stats[attributeName] !== 'number') {
            return 0;
        }
        return character.stats[attributeName];
    }

    /**
     * Calculate bonuses from equipped items
     */
    function calculateEquipmentBonuses(character) {
        const bonuses = {
            strength: 0,
            dexterity: 0,
            constitution: 0,
            intelligence: 0,
            wisdom: 0,
            charisma: 0,
            defense: 0
        };

        if (!character.equipment) return bonuses;

        // Iterate through all equipment slots
        Object.values(character.equipment).forEach(item => {
            if (item && item.stats) {
                // Add stat bonuses from equipment
                Object.keys(bonuses).forEach(stat => {
                    if (item.stats[stat]) {
                        bonuses[stat] += item.stats[stat];
                    }
                });
            }
        });

        return bonuses;
    }

    // ============================================
    // Breakdown Functions (for tooltips)
    // ============================================

    function getHpBreakdown(baseConstitution, equipConstitution, total) {
        const lines = [];
        lines.push(`Base HP: ${FORMULAS.hp.base}`);
        if (baseConstitution > 0) {
            lines.push(`Constitution (${baseConstitution}): +${baseConstitution * FORMULAS.hp.perConstitution}`);
        }
        if (equipConstitution > 0) {
            lines.push(`Equipment CON (${equipConstitution}): +${equipConstitution * FORMULAS.hp.perConstitution}`);
        }
        lines.push(`Total: ${total}`);
        return lines.join('\n');
    }

    function getManaBreakdown(baseIntelligence, equipIntelligence, total) {
        const lines = [];
        lines.push(`Base Mana: ${FORMULAS.mana.base}`);
        if (baseIntelligence > 0) {
            lines.push(`Intelligence (${baseIntelligence}): +${baseIntelligence * FORMULAS.mana.perIntelligence}`);
        }
        if (equipIntelligence > 0) {
            lines.push(`Equipment INT (${equipIntelligence}): +${equipIntelligence * FORMULAS.mana.perIntelligence}`);
        }
        lines.push(`Total: ${total}`);
        return lines.join('\n');
    }

    function getMeleeAttackBreakdown(baseStrength, equipStrength, total) {
        const lines = [];
        lines.push(`Base: 100%`);
        if (baseStrength > 0) {
            lines.push(`Strength (${baseStrength}): +${(baseStrength * FORMULAS.meleeAttack.perStrength * 100).toFixed(0)}%`);
        }
        if (equipStrength > 0) {
            lines.push(`Equipment STR (${equipStrength}): +${(equipStrength * FORMULAS.meleeAttack.perStrength * 100).toFixed(0)}%`);
        }
        lines.push(`Total: ${Math.round(total * 100)}%`);
        return lines.join('\n');
    }

    function getRangedAttackBreakdown(baseDexterity, equipDexterity, total) {
        const lines = [];
        lines.push(`Base: 100%`);
        if (baseDexterity > 0) {
            lines.push(`Dexterity (${baseDexterity}): +${(baseDexterity * FORMULAS.rangedAttack.perDexterity * 100).toFixed(0)}%`);
        }
        if (equipDexterity > 0) {
            lines.push(`Equipment DEX (${equipDexterity}): +${(equipDexterity * FORMULAS.rangedAttack.perDexterity * 100).toFixed(0)}%`);
        }
        lines.push(`Total: ${Math.round(total * 100)}%`);
        return lines.join('\n');
    }

    function getMagicAttackBreakdown(baseIntelligence, equipIntelligence, total) {
        const lines = [];
        lines.push(`Base: 100%`);
        if (baseIntelligence > 0) {
            lines.push(`Intelligence (${baseIntelligence}): +${(baseIntelligence * FORMULAS.magicAttack.perIntelligence * 100).toFixed(0)}%`);
        }
        if (equipIntelligence > 0) {
            lines.push(`Equipment INT (${equipIntelligence}): +${(equipIntelligence * FORMULAS.magicAttack.perIntelligence * 100).toFixed(0)}%`);
        }
        lines.push(`Total: ${Math.round(total * 100)}%`);
        return lines.join('\n');
    }

    function getDefenseBreakdown(baseWisdom, equipWisdom, equipDefense, total) {
        const lines = [];
        const totalWis = baseWisdom + equipWisdom;
        if (totalWis > 0) {
            lines.push(`Wisdom (${totalWis}): ${Math.floor(totalWis * FORMULAS.defense.perWisdom)}`);
        }
        if (equipDefense > 0) {
            lines.push(`Equipment: +${equipDefense}`);
        }
        lines.push(`Total: ${total}`);
        return lines.join('\n');
    }

    function getEvasionBreakdown(baseDexterity, equipDexterity, total) {
        const lines = [];
        const totalDex = baseDexterity + equipDexterity;
        if (totalDex > 0) {
            lines.push(`Dexterity (${totalDex}): ${(totalDex * FORMULAS.evasion.perDexterity).toFixed(1)}%`);
        }
        if (total >= FORMULAS.evasion.max) {
            lines.push(`(Capped at ${FORMULAS.evasion.max}%)`);
        }
        lines.push(`Total: ${total.toFixed(1)}%`);
        return lines.join('\n');
    }

    function getCritChanceBreakdown(baseDexterity, equipDexterity, total) {
        const lines = [];
        const totalDex = baseDexterity + equipDexterity;
        if (totalDex > 0) {
            lines.push(`Dexterity (${totalDex}): ${(totalDex * FORMULAS.critChance.perDexterity).toFixed(1)}%`);
        }
        if (total >= FORMULAS.critChance.max) {
            lines.push(`(Capped at ${FORMULAS.critChance.max}%)`);
        }
        lines.push(`Total: ${total.toFixed(1)}%`);
        return lines.join('\n');
    }

    function getCarryCapacityBreakdown(baseStrength, equipStrength, total) {
        const lines = [];
        lines.push(`Base: ${FORMULAS.carryCapacity.base} lbs`);
        const totalStr = baseStrength + equipStrength;
        if (totalStr > 0) {
            lines.push(`Strength (${totalStr}): +${totalStr * FORMULAS.carryCapacity.perStrength} lbs`);
        }
        lines.push(`Total: ${total} lbs`);
        return lines.join('\n');
    }

    /**
     * Apply calculated stats to character object
     */
    function applyToCharacter(character) {
        const calculated = calculate(character);

        // Update character's derived stats
        character.maxHp = calculated.maxHp;
        character.maxMana = calculated.maxMana;
        character.meleeAttack = calculated.meleeAttack;
        character.rangedAttack = calculated.rangedAttack;
        character.magicAttack = calculated.magicAttack;
        character.defense = calculated.defense;
        character.evasion = calculated.evasion;
        character.critChance = calculated.critChance;
        character.carryCapacity = calculated.carryCapacity;

        // Ensure current HP/Mana don't exceed max
        if (character.hp > character.maxHp) {
            character.hp = character.maxHp;
        }
        if (character.mana > character.maxMana) {
            character.mana = character.maxMana;
        }

        return calculated;
    }

    return {
        calculate,
        applyToCharacter,
        FORMULAS
    };
})();

window.CharacterStats = CharacterStats;
