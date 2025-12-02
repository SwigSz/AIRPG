// ============================================
// Ability Management System
// ============================================

const AbilityManager = (() => {
    let abilitiesData = [];
    let unlockedAbilities = [];

    // Load abilities from JSON
    async function init() {
        try {
            const response = await fetch('data/abilities.json');
            const data = await response.json();
            abilitiesData = data.abilities || [];
            console.log('AbilityManager: Loaded', abilitiesData.length, 'abilities');

            // Load unlocked abilities from game state if available
            if (window.GameState) {
                const state = GameState.getState();
                unlockedAbilities = state.unlockedAbilities || [];
            }
        } catch (error) {
            console.error('AbilityManager: Failed to load abilities.json', error);
        }
    }

    // Get all abilities (both locked and unlocked)
    function getAllAbilities() {
        return abilitiesData.map(ability => {
            return {
                ...ability,
                unlocked: isAbilityUnlocked(ability.id)
            };
        });
    }

    // Get only unlocked abilities
    function getUnlockedAbilities() {
        return abilitiesData.filter(ability => isAbilityUnlocked(ability.id));
    }

    // Check if an ability is unlocked (either manually unlocked or meets conditions)
    function isAbilityUnlocked(abilityId) {
        // Already manually unlocked
        if (unlockedAbilities.includes(abilityId)) {
            return true;
        }

        // Check if conditions are met
        const ability = abilitiesData.find(a => a.id === abilityId);
        if (!ability) return false;

        // If no unlock condition, it's unlocked by default
        if (!ability.unlockConditions) {
            return true;
        }

        // Evaluate unlock condition
        if (window.ConditionEvaluator) {
            return ConditionEvaluator.evaluate(ability.unlockConditions);
        }

        return false;
    }

    // Check and auto-unlock abilities based on conditions
    function checkAndUnlockAbilities() {
        let anyUnlocked = false;

        abilitiesData.forEach(ability => {
            // Skip if already unlocked
            if (unlockedAbilities.includes(ability.id)) {
                return;
            }

            // Skip if no unlock condition (shouldn't happen, but safety check)
            if (!ability.unlockConditions) {
                return;
            }

            // Check if conditions are met
            if (window.ConditionEvaluator && ConditionEvaluator.evaluate(ability.unlockConditions)) {
                // Unlock the ability
                unlockAbility(ability.id);
                anyUnlocked = true;
            }
        });

        return anyUnlocked;
    }

    // Unlock an ability
    function unlockAbility(abilityId) {
        if (isAbilityUnlocked(abilityId)) {
            console.log('AbilityManager: Ability already unlocked:', abilityId);
            return false;
        }

        const ability = abilitiesData.find(a => a.id === abilityId);
        if (!ability) {
            console.error('AbilityManager: Ability not found:', abilityId);
            return false;
        }

        unlockedAbilities.push(abilityId);

        // Update game state
        if (window.GameState) {
            GameState.updateProperty('unlockedAbilities', unlockedAbilities);
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }

        console.log('AbilityManager: Unlocked ability:', ability.name);

        // Show notification popup
        if (window.NotificationManager) {
            NotificationManager.showAbilityUnlock(ability);
        }

        // Emit event for other systems to react
        if (window.EventSystem) {
            EventSystem.emit('ability:unlocked', ability);
        }

        return true;
    }

    // Get ability by ID
    function getAbilityById(abilityId) {
        const ability = abilitiesData.find(a => a.id === abilityId);
        if (ability) {
            return {
                ...ability,
                unlocked: isAbilityUnlocked(ability.id)
            };
        }
        return null;
    }

    // Set unlocked abilities (used when loading save data)
    function setUnlockedAbilities(abilities) {
        unlockedAbilities = abilities || [];
    }

    return {
        init,
        getAllAbilities,
        getUnlockedAbilities,
        isAbilityUnlocked,
        unlockAbility,
        getAbilityById,
        setUnlockedAbilities,
        checkAndUnlockAbilities
    };
})();

window.AbilityManager = AbilityManager;
