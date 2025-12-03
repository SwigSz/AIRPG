// ============================================
// Condition Evaluator - Evaluate Unlock Conditions
// ============================================

const ConditionEvaluator = (() => {

    /**
     * Evaluate a condition against current game state
     *
     * Format examples:
     * - "enemiesKilled>=1" - short form stat (auto-prefixes combat.)
     * - "combat.enemiesKilled>=1" - full stat path
     * - "itemsCrafted>=1" - short form (auto-prefixes crafting.)
     * - "level>=5" - level check
     * - "enemiesKilled>=1,level>=5" - multiple conditions (all must be true)
     */
    function evaluate(condition) {
        if (!condition) return true;
        if (typeof condition !== 'string') {
            console.warn('ConditionEvaluator: Condition must be a string. Got:', typeof condition);
            return false;
        }

        // Split by comma for multiple conditions (all must be true)
        const conditions = condition.split(',').map(s => s.trim());

        return conditions.every(cond => {
            // Match pattern: "statName operator value"
            const match = cond.match(/^([a-zA-Z._]+)\s*(>=|<=|>|<|==|!=)\s*(.+)$/);

            if (!match) {
                console.warn('ConditionEvaluator: Invalid condition format:', cond);
                return false;
            }

            const [, statName, operator, valueStr] = match;
            const value = parseFloat(valueStr);

            // Check if it's a level condition
            if (statName === 'level') {
                if (!window.GameState) return false;
                const character = GameState.getState().character;
                if (!character) return false;
                return compareValues(character.level, operator, value);
            }

            // Auto-prefix common stat shortcuts
            let fullStatPath = statName;
            if (!statName.includes('.')) {
                if (['kills', 'battlesWon', 'battlesLost'].includes(statName)) {
                    fullStatPath = 'combat.' + statName;
                } else if (['itemsCrafted', 'recipeDiscoveries'].includes(statName)) {
                    fullStatPath = 'crafting.' + statName;
                } else if (['playtime', 'levelUps', 'xpGained'].includes(statName)) {
                    fullStatPath = 'general.' + statName;
                }
            }

            // Evaluate stat condition
            if (!window.StatsTracker) {
                console.warn('ConditionEvaluator: StatsTracker not available');
                return false;
            }

            const statValue = StatsTracker.getStat(fullStatPath);
            return compareValues(statValue, operator, value);
        });
    }

    // Compare two values with an operator
    function compareValues(left, operator, right) {
        switch (operator) {
            case '>=': return left >= right;
            case '>': return left > right;
            case '<=': return left <= right;
            case '<': return left < right;
            case '==': return left === right;
            case '!=': return left !== right;
            default:
                console.warn('ConditionEvaluator: Unknown operator', operator);
                return false;
        }
    }

    /**
     * Generate a human-readable description of a condition
     */
    function describeCondition(condition) {
        if (!condition) return 'Always available';
        if (typeof condition !== 'string') return 'Invalid condition';

        const conditions = condition.split(',').map(s => s.trim());
        return conditions.map(cond => {
            const match = cond.match(/^([a-zA-Z._]+)\s*(>=|<=|>|<|==|!=)\s*(.+)$/);
            if (!match) return cond;

            const [, statName, operator, value] = match;

            // Make stat name more readable
            const readableStat = statName
                .split('.').pop()
                .replace(/([A-Z])/g, ' $1')
                .toLowerCase()
                .trim();

            return `${readableStat} ${operator} ${value}`;
        }).join(' and ');
    }

    return {
        evaluate,
        describeCondition
    };
})();

window.ConditionEvaluator = ConditionEvaluator;
