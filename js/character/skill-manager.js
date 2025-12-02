// ============================================
// Skill Manager - Manage Passive Skills
// ============================================

const SkillManager = (() => {
    let skillsData = [];
    let earnedSkills = []; // IDs of skills that have been earned

    // Load skills from JSON
    async function init() {
        try {
            const response = await fetch('data/skills.json');
            const data = await response.json();
            skillsData = data.skills || [];
            // Skills loaded

            // Load earned skills from game state if available
            if (window.GameState) {
                const state = GameState.getState();
                earnedSkills = state.earnedSkills || [];
            }
        } catch (error) {
            console.error('SkillManager: Failed to load skills.json', error);
        }
    }

    // Get all skills (both earned and not earned)
    function getAllSkills() {
        return skillsData.map(skill => {
            return {
                ...skill,
                earned: isSkillEarned(skill.id)
            };
        });
    }

    // Get only earned skills
    function getEarnedSkills() {
        return skillsData.filter(skill => isSkillEarned(skill.id));
    }

    // Check if a skill is earned (either manually earned or meets conditions)
    function isSkillEarned(skillId) {
        // Already manually earned
        if (earnedSkills.includes(skillId)) {
            return true;
        }

        // Check if conditions are met
        const skill = skillsData.find(s => s.id === skillId);
        if (!skill) return false;

        // If no unlock condition, it's earned by default
        if (!skill.unlockConditions) {
            return true;
        }

        // Evaluate unlock condition
        if (window.ConditionEvaluator) {
            return ConditionEvaluator.evaluate(skill.unlockConditions);
        }

        return false;
    }

    // Check and auto-earn skills based on conditions
    function checkAndEarnSkills() {
        let anyEarned = false;

        skillsData.forEach(skill => {
            // Skip if already earned
            if (earnedSkills.includes(skill.id)) {
                return;
            }

            // Skip if no unlock condition
            if (!skill.unlockConditions) {
                return;
            }

            // Check if conditions are met
            if (window.ConditionEvaluator && ConditionEvaluator.evaluate(skill.unlockConditions)) {
                // Earn the skill
                earnSkill(skill.id);
                anyEarned = true;
            }
        });

        return anyEarned;
    }

    // Earn a skill
    function earnSkill(skillId) {
        if (earnedSkills.includes(skillId)) {
            console.log('SkillManager: Skill already earned:', skillId);
            return false;
        }

        const skill = skillsData.find(s => s.id === skillId);
        if (!skill) {
            console.error('SkillManager: Skill not found:', skillId);
            return false;
        }

        earnedSkills.push(skillId);

        // Update game state
        if (window.GameState) {
            GameState.updateProperty('earnedSkills', earnedSkills);
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }

        console.log('SkillManager: Earned skill:', skill.name);

        // Award XP if skill has xpReward
        if (skill.xpReward && window.GameState) {
            const character = GameState.getState().character;
            if (character && window.Character) {
                Character.addXP(character, skill.xpReward);
                console.log(`SkillManager: Awarded ${skill.xpReward} XP for earning ${skill.name}`);
            }
        }

        // Show notification popup
        if (window.NotificationManager) {
            NotificationManager.showSkillUnlock(skill);
        }

        // Emit event for other systems to react
        if (window.EventSystem) {
            EventSystem.emit('skill:earned', skill);
        }

        return true;
    }

    // Get skill by ID
    function getSkillById(skillId) {
        const skill = skillsData.find(s => s.id === skillId);
        if (skill) {
            return {
                ...skill,
                earned: isSkillEarned(skill.id)
            };
        }
        return null;
    }

    // Set earned skills (used when loading save data)
    function setEarnedSkills(skills) {
        earnedSkills = skills || [];
    }

    return {
        init,
        getAllSkills,
        getEarnedSkills,
        isSkillEarned,
        earnSkill,
        getSkillById,
        setEarnedSkills,
        checkAndEarnSkills
    };
})();

window.SkillManager = SkillManager;
