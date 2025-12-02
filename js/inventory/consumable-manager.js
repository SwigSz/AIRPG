// ============================================
// Consumable Item Manager
// ============================================

const ConsumableManager = (() => {
    // Use a consumable item
    function useConsumable(character, item, combatState = null) {
        if (!item || !item.effect) {
            console.error('Invalid consumable item');
            return false;
        }

        // Check if item is consumable
        if (!item.classifications || !item.classifications.includes('consumable')) {
            console.error('Item is not consumable');
            return false;
        }

        // Apply the effect based on type
        const effect = item.effect;
        let success = false;

        switch (effect.type) {
            case 'heal':
                success = applyHealEffect(character, effect, combatState);
                break;
            case 'mana':
                success = applyManaEffect(character, effect, combatState);
                break;
            case 'buff':
                success = applyBuffEffect(character, effect, combatState);
                break;
            default:
                console.error('Unknown effect type:', effect.type);
                return false;
        }

        if (success) {
            // Log the usage
            const message = `${character.name} used ${item.name}!`;
            if (window.ActivityLog) {
                window.ActivityLog.addMessage(message, 'combat');
            }

            // Remove the item from inventory
            if (character.inventory) {
                Inventory.removeItem(character.inventory, item.id);
            }

            // Track consumable usage
            if (window.StatsTracker) {
                StatsTracker.incrementStat('items.consumablesUsed', 1);
            }

            // Save game state
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }

        return success;
    }

    // Apply healing effect
    function applyHealEffect(character, effect, combatState) {
        const healAmount = effect.amount || 0;

        if (combatState) {
            // In combat - heal the combat combatant
            const combatant = combatState.combatants.find(c => c.isPlayer && c.name === character.name);
            if (combatant) {
                const oldHp = combatant.hp;
                combatant.hp = Math.min(combatant.hp + healAmount, combatant.maxHp);
                const actualHealed = combatant.hp - oldHp;

                if (window.ActivityLog) {
                    window.ActivityLog.addMessage(`Restored ${actualHealed} HP!`, 'combat');
                }
                return true;
            }
        } else {
            // Out of combat - heal the character
            // Note: This would need hp/maxHp on the character object
            if (character.hp !== undefined && character.maxHp !== undefined) {
                const oldHp = character.hp;
                character.hp = Math.min(character.hp + healAmount, character.maxHp);
                const actualHealed = character.hp - oldHp;

                if (window.ActivityLog) {
                    window.ActivityLog.addMessage(`Restored ${actualHealed} HP!`, 'info');
                }
                return true;
            }
        }

        return false;
    }

    // Apply mana restoration effect
    function applyManaEffect(character, effect, combatState) {
        const manaAmount = effect.amount || 0;

        // Note: Mana system would need to be implemented on character/combatant
        if (character.mana !== undefined && character.maxMana !== undefined) {
            const oldMana = character.mana;
            character.mana = Math.min(character.mana + manaAmount, character.maxMana);
            const actualRestored = character.mana - oldMana;

            if (window.ActivityLog) {
                const context = combatState ? 'combat' : 'info';
                window.ActivityLog.addMessage(`Restored ${actualRestored} Mana!`, context);
            }
            return true;
        }

        return false;
    }

    // Apply buff effect
    function applyBuffEffect(character, effect, combatState) {
        if (!combatState) {
            // Buffs only work in combat for now
            if (window.ActivityLog) {
                window.ActivityLog.addMessage('This item can only be used in combat!', 'info');
            }
            return false;
        }

        const combatant = combatState.combatants.find(c => c.isPlayer && c.name === character.name);
        if (!combatant) return false;

        // Initialize buffs array if it doesn't exist
        if (!combatant.buffs) {
            combatant.buffs = [];
        }

        // Add the buff
        const buff = {
            stat: effect.stat,
            amount: effect.amount,
            duration: effect.duration,
            turnsRemaining: effect.duration
        };

        combatant.buffs.push(buff);

        // Apply the buff immediately
        if (combatant[effect.stat] !== undefined) {
            combatant[effect.stat] += effect.amount;
        }

        if (window.ActivityLog) {
            window.ActivityLog.addMessage(`${character.name}'s ${effect.stat} increased by ${effect.amount} for ${effect.duration} turns!`, 'combat');
        }

        return true;
    }

    // Get all consumable items from inventory
    function getConsumableItems(inventory) {
        if (!inventory || !inventory.items) return [];

        return inventory.items.filter(item => {
            return item.classifications && item.classifications.includes('consumable');
        });
    }

    // Get consumable items usable in combat
    function getCombatConsumables(inventory) {
        const consumables = getConsumableItems(inventory);
        return consumables.filter(item => item.usableInCombat === true);
    }

    // Check if an item is consumable
    function isConsumable(item) {
        return item && item.classifications && item.classifications.includes('consumable');
    }

    // Process end-of-turn buff updates
    function updateBuffs(combatant) {
        if (!combatant.buffs || combatant.buffs.length === 0) return;

        // Decrease duration and remove expired buffs
        const expiredBuffs = [];

        combatant.buffs = combatant.buffs.filter(buff => {
            buff.turnsRemaining--;

            if (buff.turnsRemaining <= 0) {
                // Remove buff effect
                if (combatant[buff.stat] !== undefined) {
                    combatant[buff.stat] -= buff.amount;
                }
                expiredBuffs.push(buff);
                return false;
            }

            return true;
        });

        // Log expired buffs
        if (expiredBuffs.length > 0 && window.ActivityLog) {
            expiredBuffs.forEach(buff => {
                window.ActivityLog.addMessage(`${combatant.name}'s ${buff.stat} buff wore off.`, 'combat');
            });
        }
    }

    return {
        useConsumable,
        getConsumableItems,
        getCombatConsumables,
        isConsumable,
        updateBuffs
    };
})();

// Expose to global scope
window.ConsumableManager = ConsumableManager;
