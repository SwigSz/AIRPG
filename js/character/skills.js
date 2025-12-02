// ============================================
// Skill System
// ============================================

const Skills = (() => {
    function createSkill(name, options = {}) {
        return {
            name,
            level: options.level || 1,
            xp: options.xp || 0,
            xpToNext: options.xpToNext || 100
        };
    }

    function init() {
        console.log('Skills: Initializing...');
    }

    return {
        init,
        createSkill
    };
})();

window.Skills = Skills;
