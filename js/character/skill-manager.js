// ============================================
// Skill Manager - XP and Leveling System for Progression Skills
// ============================================

const SkillManager = (() => {
    let skillsData = [];

    // Load skills data from JSON
    async function init() {
        try {
            const response = await fetch('data/skills-data.json');
            const data = await response.json();
            skillsData = data.skills || [];
            console.log('SkillManager: Skills loaded successfully');
        } catch (error) {
            console.error('SkillManager: Failed to load skills-data.json', error);
        }
    }

    // Calculate XP required for a specific level using skill-specific values
    function getXPForLevel(level, skillId) {
        const skill = getSkillById(skillId);
        if (!skill) return 0;
        if (level <= 1) return 0;

        const baseXP = skill.baseXP || 100;
        const exponent = skill.xpExponent || 1.5;
        return Math.floor(baseXP * Math.pow(level - 1, exponent));
    }

    // Calculate cumulative XP required to reach a level
    function getCumulativeXPForLevel(level, skillId) {
        let total = 0;
        for (let l = 2; l <= level; l++) {
            total += getXPForLevel(l, skillId);
        }
        return total;
    }

    // Get level from cumulative XP
    function getLevelFromXP(xp, skillId) {
        let level = 1;
        while (getCumulativeXPForLevel(level + 1, skillId) <= xp) {
            level++;
        }
        return level;
    }

    // Get level info from cumulative XP
    function getLevelInfo(xp, skillId) {
        const level = getLevelFromXP(xp, skillId);
        const xpForCurrentLevel = getCumulativeXPForLevel(level, skillId);
        const xpForNextLevel = getCumulativeXPForLevel(level + 1, skillId);

        return {
            level,
            xpForCurrentLevel,
            xpForNextLevel,
            xpProgress: xp - xpForCurrentLevel,
            xpNeeded: xpForNextLevel - xpForCurrentLevel
        };
    }

    // Get all skills data
    function getAllSkills() {
        return skillsData;
    }

    // Get skill by ID
    function getSkillById(skillId) {
        return skillsData.find(skill => skill.id === skillId);
    }

    // Get skill bonuses for a specific skill at a specific level
    function getSkillBonuses(skillId, level) {
        const skill = getSkillById(skillId);
        if (!skill || !skill.milestoneBonuses) return [];

        // Return milestone bonuses that are unlocked at or below the current level
        return skill.milestoneBonuses
            .filter(bonus => bonus.level <= level)
            .sort((a, b) => a.level - b.level);
    }

    // Add XP to a skill (unlocks skill if first XP)
    function addSkillXP(character, skillId, xp) {
        if (!character.skills) {
            character.skills = {};
        }

        const skill = getSkillById(skillId);
        if (!skill) {
            console.error(`SkillManager: Skill ${skillId} not found in skills data`);
            return false;
        }

        // Check if skill is being unlocked for the first time
        const isNewSkill = !character.skills[skillId];

        if (isNewSkill) {
            // Unlock the skill
            character.skills[skillId] = {
                level: 1,
                xp: xp
            };

            console.log(`SkillManager: Unlocked ${skill.name} skill!`);

            // Show unlock notification
            if (window.NotificationManager) {
                NotificationManager.showSkillUnlock(skill);
            }

            // Emit unlock event
            if (window.EventSystem) {
                EventSystem.emit('skill:unlock', {
                    skillId,
                    skill
                });
            }

            // Update UI
            if (window.CharacterUI) {
                CharacterUI.render();
            }
        } else {
            // Add XP to existing skill
            const oldLevel = getLevelFromXP(character.skills[skillId].xp, skillId);
            character.skills[skillId].xp += xp;
            const newLevel = getLevelFromXP(character.skills[skillId].xp, skillId);
            character.skills[skillId].level = newLevel;

            // Check for level up
            if (newLevel > oldLevel) {
                handleLevelUp(character, skillId, oldLevel, newLevel);
            }
        }

        // Save game state
        if (window.SaveSystem) {
            SaveSystem.save();
        }

        return true;
    }

    // Handle skill level up
    function handleLevelUp(character, skillId, oldLevel, newLevel) {
        const skill = getSkillById(skillId);
        if (!skill) return;

        console.log(`SkillManager: ${skill.name} leveled up! ${oldLevel} → ${newLevel}`);

        // Show notification
        if (window.NotificationManager) {
            NotificationManager.showSkillLevelUp(skill, newLevel);
        }

        // Emit event
        if (window.EventSystem) {
            EventSystem.emit('skill:levelup', {
                skillId,
                skill,
                oldLevel,
                newLevel
            });
        }

        // Update UI
        if (window.CharacterUI) {
            CharacterUI.render();
        }
    }

    // Initialize character skills (backward compatibility - ensures skills object exists but starts empty)
    function initializeCharacterSkills(character) {
        if (!character.skills) {
            character.skills = {};
        }

        // Recalculate levels from XP for any existing skills (backward compatibility)
        Object.keys(character.skills).forEach(skillId => {
            const level = getLevelFromXP(character.skills[skillId].xp, skillId);
            character.skills[skillId].level = level;
        });
    }

    // Get skill level
    function getSkillLevel(character, skillId) {
        if (!character.skills || !character.skills[skillId]) return 0;
        return character.skills[skillId].level;
    }

    // Get skill XP
    function getSkillXP(character, skillId) {
        if (!character.skills || !character.skills[skillId]) return 0;
        return character.skills[skillId].xp;
    }

    // Check if skill is unlocked
    function isSkillUnlocked(character, skillId) {
        return character.skills && character.skills[skillId] !== undefined;
    }

    return {
        init,
        getAllSkills,
        getSkillById,
        getSkillBonuses,
        addSkillXP,
        getLevelInfo,
        getLevelFromXP,
        getCumulativeXPForLevel,
        getXPForLevel,
        initializeCharacterSkills,
        getSkillLevel,
        getSkillXP,
        isSkillUnlocked
    };
})();

window.SkillManager = SkillManager;
