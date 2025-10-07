// ============================================
// Difficulty Scaling
// ============================================

const Difficulty = (() => {
    function calculate(distance) {
        return distance * GameConfig.WORLD.DIFFICULTY_SCALING;
    }

    return {
        calculate
    };
})();

window.Difficulty = Difficulty;
