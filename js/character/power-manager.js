// ============================================
// Power Manager - Manage Passive Powers
// ============================================

const PowerManager = (() => {
    let powersData = [];
    let earnedPowers = []; // IDs of powers that have been earned

    // Load powers from JSON
    async function init() {
        try {
            const response = await fetch('data/powers.json');
            const data = await response.json();
            powersData = data.skills || []; // Keep 'skills' key in JSON for backward compatibility
            // Powers loaded

            // Load earned powers from game state if available
            if (window.GameState) {
                const state = GameState.getState();
                earnedPowers = state.earnedPowers || state.earnedSkills || []; // Backward compatibility
            }
        } catch (error) {
            console.error('PowerManager: Failed to load powers.json', error);
        }
    }

    // Get all powers (both earned and not earned)
    function getAllPowers() {
        return powersData.map(power => {
            return {
                ...power,
                earned: isPowerEarned(power.id)
            };
        });
    }

    // Get only earned powers
    function getEarnedPowers() {
        return powersData.filter(power => isPowerEarned(power.id));
    }

    // Check if a power is earned (either manually earned or meets conditions)
    function isPowerEarned(powerId) {
        // Already manually earned
        if (earnedPowers.includes(powerId)) {
            return true;
        }

        // Check if conditions are met
        const power = powersData.find(p => p.id === powerId);
        if (!power) return false;

        // If no unlock condition, it's earned by default
        if (!power.unlockConditions) {
            return true;
        }

        // Evaluate unlock condition
        if (window.ConditionEvaluator) {
            return ConditionEvaluator.evaluate(power.unlockConditions);
        }

        return false;
    }

    // Check and auto-earn powers based on conditions
    function checkAndEarnPowers() {
        let anyEarned = false;

        powersData.forEach(power => {
            // Skip if already earned
            if (earnedPowers.includes(power.id)) {
                return;
            }

            // Skip if no unlock condition
            if (!power.unlockConditions) {
                return;
            }

            // Check if conditions are met
            if (window.ConditionEvaluator && ConditionEvaluator.evaluate(power.unlockConditions)) {
                // Earn the power
                earnPower(power.id);
                anyEarned = true;
            }
        });

        return anyEarned;
    }

    // Earn a power
    function earnPower(powerId) {
        if (earnedPowers.includes(powerId)) {
            console.log('PowerManager: Power already earned:', powerId);
            return false;
        }

        const power = powersData.find(p => p.id === powerId);
        if (!power) {
            console.error('PowerManager: Power not found:', powerId);
            return false;
        }

        earnedPowers.push(powerId);

        // Update game state
        if (window.GameState) {
            GameState.updateProperty('earnedPowers', earnedPowers);
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }

        console.log('PowerManager: Earned power:', power.name);

        // Award XP if power has xpReward
        if (power.xpReward && window.GameState) {
            const character = GameState.getState().character;
            if (character && window.Character) {
                Character.addXP(character, power.xpReward);
                console.log(`PowerManager: Awarded ${power.xpReward} XP for earning ${power.name}`);
            }
        }

        // Show notification popup
        if (window.NotificationManager) {
            NotificationManager.showPowerUnlock(power);
        }

        // Emit event for other systems to react
        if (window.EventSystem) {
            EventSystem.emit('power:earned', power);
        }

        return true;
    }

    // Get power by ID
    function getPowerById(powerId) {
        const power = powersData.find(p => p.id === powerId);
        if (power) {
            return {
                ...power,
                earned: isPowerEarned(power.id)
            };
        }
        return null;
    }

    // Set earned powers (used when loading save data)
    function setEarnedPowers(powers) {
        earnedPowers = powers || [];
    }

    return {
        init,
        getAllPowers,
        getEarnedPowers,
        isPowerEarned,
        earnPower,
        getPowerById,
        setEarnedPowers,
        checkAndEarnPowers
    };
})();

window.PowerManager = PowerManager;
