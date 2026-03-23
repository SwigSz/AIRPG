/**
 * Training System
 * Handles skill training at the settlement's training grounds
 */

const Training = (function() {
    'use strict';

    // Training methods configuration
    const TRAINING_METHODS = {
        basic_training: {
            id: 'basic_training',
            name: 'Basic Training',
            xpPerDay: 50,
            difficulty: 'Easy',
            requiredBuilding: 'combatArena_tier1'
        },
        advanced_training: {
            id: 'advanced_training',
            name: 'Advanced Training',
            xpPerDay: 100,
            difficulty: 'Medium',
            requiredBuilding: 'combatArena_tier2'
        },
        intensive_training: {
            id: 'intensive_training',
            name: 'Intensive Training',
            xpPerDay: 200,
            difficulty: 'Hard',
            requiredBuilding: 'combatArena_tier3'
        }
    };

    // Trainable skills (for now, only combat)
    const TRAINABLE_SKILLS = ['combat'];

    /**
     * Get all training methods
     */
    function getTrainingMethods() {
        return TRAINING_METHODS;
    }

    /**
     * Get trainable skills
     */
    function getTrainableSkills() {
        return TRAINABLE_SKILLS;
    }

    /**
     * Check if a training method is unlocked
     */
    function isTrainingMethodUnlocked(methodId) {
        const method = TRAINING_METHODS[methodId];
        if (!method) return false;

        const state = GameState.getState();
        if (!state.settlement || !state.settlement.buildings) return false;

        // Check if required building exists
        const requiredBuilding = method.requiredBuilding;
        return state.settlement.buildings[requiredBuilding] &&
               state.settlement.buildings[requiredBuilding].count > 0;
    }

    /**
     * Start training for a skill
     */
    function startTraining(skillId, methodId, days) {
        const state = GameState.getState();
        const character = state.character;

        // Validation
        if (!character) {
            console.error('No character found');
            return false;
        }

        if (!character.inSettlement) {
            console.error('Character must be in settlement to train');
            return false;
        }

        if (!TRAINABLE_SKILLS.includes(skillId)) {
            console.error('Skill is not trainable:', skillId);
            return false;
        }

        if (!isTrainingMethodUnlocked(methodId)) {
            console.error('Training method is not unlocked:', methodId);
            return false;
        }

        if (days < 1 || days > 30) {
            console.error('Training days must be between 1 and 30');
            return false;
        }

        // Check if already training
        if (state.training && state.training.active) {
            console.error('Already training');
            return false;
        }

        // Initialize training state
        const method = TRAINING_METHODS[methodId];
        const currentTime = window.TimeSystem ? TimeSystem.getCurrentTime() : 0;

        state.training = {
            active: true,
            paused: false,
            skillId: skillId,
            methodId: methodId,
            totalDays: days,
            daysCompleted: 0,
            startTime: currentTime,
            xpPerDay: method.xpPerDay
        };

        // Save state
        if (window.SaveSystem) {
            SaveSystem.save();
        }

        // Log training start
        if (window.ActivityLog) {
            ActivityLog.addEntry(`Started ${method.name} for ${skillId} skill (${days} days)`, 'training');
        }

        // Update UI
        updateUI();

        return true;
    }

    /**
     * Pause training
     */
    function pauseTraining() {
        const state = GameState.getState();
        if (!state.training || !state.training.active) return false;

        state.training.paused = true;

        if (window.SaveSystem) {
            SaveSystem.save();
        }

        updateUI();
        return true;
    }

    /**
     * Resume training
     */
    function resumeTraining() {
        const state = GameState.getState();
        if (!state.training || !state.training.active || !state.training.paused) return false;

        state.training.paused = false;

        if (window.SaveSystem) {
            SaveSystem.save();
        }

        updateUI();
        return true;
    }

    /**
     * Cancel training (grants proportional XP)
     */
    function cancelTraining() {
        const state = GameState.getState();
        if (!state.training || !state.training.active) return false;

        const training = state.training;

        // Grant proportional XP for days completed
        if (training.daysCompleted > 0) {
            grantTrainingXP(training.daysCompleted);
        }

        // Clear training state
        state.training = null;

        if (window.SaveSystem) {
            SaveSystem.save();
        }

        if (window.ActivityLog) {
            ActivityLog.addEntry('Training cancelled', 'training');
        }

        updateUI();
        return true;
    }

    /**
     * Complete training (grants full XP)
     */
    function completeTraining() {
        const state = GameState.getState();
        if (!state.training || !state.training.active) return;

        const training = state.training;

        // Grant full XP
        grantTrainingXP(training.totalDays);

        // Clear training state
        state.training = null;

        if (window.SaveSystem) {
            SaveSystem.save();
        }

        if (window.ActivityLog) {
            ActivityLog.addEntry('Training completed!', 'training');
        }

        // Show notification
        if (window.NotificationManager) {
            NotificationManager.show('Training completed!', 'success');
        }

        updateUI();
    }

    /**
     * Grant XP for training
     */
    function grantTrainingXP(days) {
        const state = GameState.getState();
        const training = state.training;
        const character = state.character;

        if (!training || !character) return;

        // Calculate XP: base XP × days × (1 + INT modifier)
        const intModifier = window.CharacterStats ?
            CharacterStats.getAttributeModifier(character, 'intelligence') / 100 : 0;

        const totalXP = Math.floor(training.xpPerDay * days * (1 + intModifier));

        // Grant XP to skill
        if (window.SkillManager) {
            SkillManager.addSkillXP(character, training.skillId, totalXP);
        }

        if (window.ActivityLog) {
            ActivityLog.addEntry(
                `Gained ${totalXP} XP in ${training.skillId} skill from training`,
                'training'
            );
        }
    }

    /**
     * Called when time advances
     */
    function onTimeAdvance(daysAdvanced) {
        const state = GameState.getState();
        const training = state.training;

        if (!training || !training.active || training.paused) return;

        const character = state.character;

        // Auto-pause if character left settlement
        if (!character.inSettlement) {
            training.paused = true;
            if (window.ActivityLog) {
                ActivityLog.addEntry('Training paused (left settlement)', 'training');
            }
            updateUI();
            return;
        }

        // Update days completed
        const newDaysCompleted = Math.min(
            training.daysCompleted + daysAdvanced,
            training.totalDays
        );

        training.daysCompleted = newDaysCompleted;

        // Check if training is complete
        if (training.daysCompleted >= training.totalDays) {
            completeTraining();
        } else {
            // Save progress
            if (window.SaveSystem) {
                SaveSystem.save();
            }
            updateUI();
        }
    }

    /**
     * Get current training state
     */
    function getTrainingState() {
        const state = GameState.getState();
        return state.training || null;
    }

    /**
     * Update UI
     */
    function updateUI() {
        // Trigger settlement UI update if on training grounds tab
        if (window.Settlement && window.Settlement.updateUI) {
            Settlement.updateUI();
        }
    }

    // Public API
    return {
        getTrainingMethods,
        getTrainableSkills,
        isTrainingMethodUnlocked,
        startTraining,
        pauseTraining,
        resumeTraining,
        cancelTraining,
        completeTraining,
        onTimeAdvance,
        getTrainingState
    };
})();

// Make globally available
window.Training = Training;
