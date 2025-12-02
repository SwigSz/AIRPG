// ============================================
// Combat System - Turn-Based Combat Manager
// ============================================

const CombatManager = (() => {
    let combatState = null;
    let pendingAction = null; // Store action waiting for target selection

    // Combat state structure
    function createCombatState() {
        return {
            combatants: [],
            turnOrder: [],
            currentTurnIndex: 0,
            turnNumber: 1,
            isActive: false
        };
    }

    // Create a combatant
    function createCombatant(name, stats, isPlayer = false) {
        return {
            id: generateCombatantId(),
            name,
            speed: stats.speed || 10,
            hp: stats.hp || 100,
            maxHp: stats.maxHp || 100,
            isAlive: true,
            isPlayer,
            initiative: 0,
            attack: stats.attack || 10,
            defense: stats.defense || 5
        };
    }

    function generateCombatantId() {
        return 'combatant_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Roll d20
    function rollD20() {
        return Math.floor(Math.random() * 20) + 1;
    }

    // Roll initiative for all combatants
    function rollInitiative(combatants) {
        combatants.forEach(combatant => {
            combatant.initiative = rollD20();
        });
    }

    // Sort combatants by initiative (highest first)
    function sortByInitiative(combatants) {
        return [...combatants].sort((a, b) => b.initiative - a.initiative);
    }

    // Start combat with given combatants
    function startCombat(playerParty, enemyParty) {
        combatState = createCombatState();

        // Add all combatants
        combatState.combatants = [...playerParty, ...enemyParty];

        // Roll initiative
        rollInitiative(combatState.combatants);

        // Create turn order
        combatState.turnOrder = sortByInitiative(combatState.combatants);

        // Set combat active
        combatState.isActive = true;
        combatState.currentTurnIndex = 0;
        combatState.turnNumber = 1;

        logCombat('=== COMBAT START ===');
        combatState.turnOrder.forEach(c => {
            logCombat(`${c.name} rolled initiative: ${c.initiative}`);
        });

        // Show combat view
        toggleCombatView(true);

        // Render combat UI
        renderCombatUI();

        // Save combat state
        saveCombatState();

        // Process first turn
        processCurrentTurn();
    }

    // Get current combatant
    function getCurrentCombatant() {
        if (!combatState || !combatState.isActive) return null;
        return combatState.turnOrder[combatState.currentTurnIndex];
    }

    // Process current turn
    function processCurrentTurn() {
        const current = getCurrentCombatant();

        if (!current) return;

        // Skip dead combatants
        if (!current.isAlive) {
            logCombat(`${current.name}'s turn is skipped (deceased)`);
            nextTurn();
            return;
        }

        logCombat(`\n--- ${current.name}'s Turn ---`);
        renderCombatUI();

        // If it's an enemy's turn, auto-process
        if (!current.isPlayer) {
            setTimeout(() => {
                enemyAI(current);
            }, 1000);
        }
        // Player turns are handled by button clicks
    }

    // Simple enemy AI
    function enemyAI(enemy) {
        const alivePlayers = combatState.combatants.filter(c => c.isPlayer && c.isAlive);
        if (alivePlayers.length === 0) return;

        // Pick random player
        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];

        // Basic attack
        performAttack(enemy, target);

        // End turn after short delay (only if combat is still active)
        setTimeout(() => {
            if (combatState && combatState.isActive) {
                nextTurn();
            }
        }, 1000);
    }

    // Perform a basic attack
    function performAttack(attacker, target) {
        const damage = Math.max(1, attacker.attack - target.defense + rollD20());

        target.hp = Math.max(0, target.hp - damage);

        logCombat(`${attacker.name} attacks ${target.name} for ${damage} damage!`);

        if (target.hp <= 0) {
            target.isAlive = false;
            logCombat(`${target.name} has been defeated!`);
        }

        renderCombatUI();
        checkCombatEnd();
    }

    // Use a skill
    function useSkill(attacker, target, skillName) {
        if (skillName === 'Power Strike') {
            const damage = Math.max(1, (attacker.attack * 1.5) - target.defense + rollD20());
            target.hp = Math.max(0, target.hp - damage);
            logCombat(`${attacker.name} uses Power Strike on ${target.name} for ${damage} damage!`);

            if (target.hp <= 0) {
                target.isAlive = false;
                logCombat(`${target.name} has been defeated!`);
            }
        }

        renderCombatUI();
        checkCombatEnd();
    }

    // Next turn
    function nextTurn() {
        if (!combatState || !combatState.isActive) return;

        combatState.currentTurnIndex++;

        // If we've gone through all combatants, start a new round
        if (combatState.currentTurnIndex >= combatState.turnOrder.length) {
            combatState.currentTurnIndex = 0;
            combatState.turnNumber++;
            logCombat(`\n=== Turn ${combatState.turnNumber} ===`);
        }

        // Save combat state after each turn
        saveCombatState();

        // Add a small delay before processing the next turn to let UI update
        setTimeout(() => {
            if (combatState && combatState.isActive) {
                processCurrentTurn();
            }
        }, 500);
    }

    // Check if combat should end
    function checkCombatEnd() {
        if (!combatState) return;

        const alivePlayers = combatState.combatants.filter(c => c.isPlayer && c.isAlive);
        const aliveEnemies = combatState.combatants.filter(c => !c.isPlayer && c.isAlive);

        if (alivePlayers.length === 0) {
            endCombat('defeat');
        } else if (aliveEnemies.length === 0) {
            endCombat('victory');
        }
    }

    // End combat
    function endCombat(result) {
        if (!combatState) return;

        // Save references before clearing state
        const combatants = combatState.combatants;

        combatState.isActive = false;

        if (result === 'victory') {
            logCombat('\n=== VICTORY ===');
            logCombat('All enemies have been defeated!');

            // Track combat stats
            if (window.StatsTracker) {
                const deadEnemies = combatants.filter(c => !c.isPlayer && !c.isAlive);
                StatsTracker.incrementStat('combat.enemiesKilled', deadEnemies.length);
                StatsTracker.incrementStat('combat.combatsWon', 1);
            }

            // Award XP to all living players
            const deadEnemies = combatants.filter(c => !c.isPlayer && !c.isAlive);
            const totalXP = deadEnemies.reduce((sum, enemy) => sum + (enemy.xpReward || 0), 0);

            console.log('Dead enemies:', deadEnemies);
            console.log('Total XP to award:', totalXP);

            if (totalXP > 0) {
                combatants.forEach(player => {
                    if (player.isPlayer && player.isAlive) {
                        // Get the actual GameState character
                        const character = GameState.getState().character;
                        console.log('Character before XP:', character);
                        if (character) {
                            // Add XP directly to the GameState character
                            const leveled = Character.addXP(character, totalXP);
                            console.log('Character after XP:', character);
                            logCombat(`${player.name} gained ${totalXP} XP!`);
                            if (leveled) {
                                logCombat(`${player.name} leveled up to level ${character.level}!`);
                            }

                            // Immediately update UI to show XP changes
                            if (window.updateTopBar) {
                                updateTopBar(character);
                            }

                            // Immediately save the game state
                            if (window.SaveSystem) {
                                SaveSystem.save();
                            }
                        }
                    }
                });
            }

            // Check for ability/skill unlocks
            if (window.AbilityManager) {
                AbilityManager.checkAndUnlockAbilities();
            }
            if (window.SkillManager) {
                SkillManager.checkAndEarnSkills();
            }
            // Refresh character UI
            if (window.CharacterUI) {
                CharacterUI.render();
            }
        } else if (result === 'defeat') {
            logCombat('\n=== DEFEAT ===');
            logCombat('Your party has been defeated...');

            // Track combat stats
            if (window.StatsTracker) {
                StatsTracker.incrementStat('combat.combatsLost', 1);
            }
        } else if (result === 'flee') {
            logCombat('\n=== FLED FROM COMBAT ===');

            // Track combat stats
            if (window.StatsTracker) {
                StatsTracker.incrementStat('combat.combatsFled', 1);
            }
        }

        // Clear combat state after processing rewards
        clearCombatState();

        renderCombatUI();

        // Return to map view after 2 seconds
        setTimeout(() => {
            toggleCombatView(false);
            logCombat('Returning to map...');
            pendingAction = null; // Clear any pending actions

            // Update top bar to reflect XP/level changes
            if (window.updateTopBar && GameState) {
                const character = GameState.getState().character;
                if (character) {
                    updateTopBar(character);
                }
            }

            // Auto-save after combat
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }, 2000);
    }

    // Combat logging
    function logCombat(message) {
        if (window.ActivityLog) {
            window.ActivityLog.addMessage(message, 'combat');
        }
    }

    // Toggle combat view
    function toggleCombatView(show) {
        const mapView = document.querySelector('.map-view');
        const combatView = document.querySelector('.combat-view');

        if (show) {
            mapView.classList.remove('active');
            combatView.classList.add('active');
        } else {
            combatView.classList.remove('active');
            mapView.classList.add('active');
        }
    }

    // Render combat UI
    function renderCombatUI() {
        if (!combatState) return;

        renderTurnOrder();
        renderCombatants();
        renderActionButtons();
    }

    // Render turn order bar
    function renderTurnOrder() {
        const turnOrderEl = document.querySelector('.turn-order-slots');
        const turnCounterEl = document.querySelector('.turn-counter');

        if (!turnOrderEl) return;

        // Update turn counter
        if (turnCounterEl) {
            turnCounterEl.textContent = `Combat Turn: ${combatState.turnNumber}`;
        }

        // Clear and rebuild turn order
        turnOrderEl.innerHTML = '';

        combatState.turnOrder.forEach((combatant, index) => {
            const slot = document.createElement('div');
            slot.className = 'turn-slot';

            if (index === combatState.currentTurnIndex) {
                slot.classList.add('active');
            }

            if (!combatant.isAlive) {
                slot.classList.add('dead');
            }

            slot.innerHTML = `
                <div class="turn-slot-name">${combatant.name}</div>
                <div class="turn-slot-init">${combatant.initiative}</div>
            `;

            turnOrderEl.appendChild(slot);
        });
    }

    // Render combatants
    function renderCombatants() {
        renderEnemies();
        renderPlayers();
    }

    // Render enemies in top half
    function renderEnemies() {
        const enemyDisplay = document.querySelector('.enemy-display');
        if (!enemyDisplay) return;

        enemyDisplay.innerHTML = '';

        const enemies = combatState.combatants.filter(c => !c.isPlayer);
        enemies.forEach(enemy => {
            const enemyCard = document.createElement('div');
            enemyCard.className = 'combatant-card enemy';
            if (!enemy.isAlive) enemyCard.classList.add('dead');

            // Make alive enemies clickable for targeting
            if (enemy.isAlive && pendingAction) {
                enemyCard.classList.add('targetable');
                enemyCard.style.cursor = 'pointer';
            }

            enemyCard.innerHTML = `
                <div class="combatant-name">${enemy.name}</div>
                <div class="combatant-hp">
                    <div class="hp-bar">
                        <div class="hp-fill" style="width: ${(enemy.hp / enemy.maxHp) * 100}%"></div>
                    </div>
                    <div class="hp-text">${enemy.hp} / ${enemy.maxHp}</div>
                </div>
                ${!enemy.isAlive ? '<div class="corpse-label">CORPSE</div>' : ''}
            `;

            // Add click handler for targeting
            if (enemy.isAlive) {
                enemyCard.addEventListener('click', () => {
                    if (pendingAction) {
                        selectTarget(enemy.id);
                    }
                });
            }

            enemyDisplay.appendChild(enemyCard);
        });
    }

    // Render players in bottom half
    function renderPlayers() {
        const playerDisplay = document.querySelector('.player-display');
        if (!playerDisplay) return;

        playerDisplay.innerHTML = '';

        const players = combatState.combatants.filter(c => c.isPlayer);
        players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'combatant-card player';
            if (!player.isAlive) playerCard.classList.add('dead');

            playerCard.innerHTML = `
                <div class="combatant-name">${player.name}</div>
                <div class="combatant-hp">
                    <div class="hp-bar">
                        <div class="hp-fill" style="width: ${(player.hp / player.maxHp) * 100}%"></div>
                    </div>
                    <div class="hp-text">${player.hp} / ${player.maxHp}</div>
                </div>
                ${!player.isAlive ? '<div class="corpse-label">CORPSE</div>' : ''}
            `;

            playerDisplay.appendChild(playerCard);
        });
    }

    // Render action buttons
    function renderActionButtons() {
        const actionsEl = document.querySelector('.combat-actions');
        if (!actionsEl) return;

        const current = getCurrentCombatant();

        if (!current || !current.isPlayer || !current.isAlive || !combatState.isActive) {
            actionsEl.innerHTML = '<div class="action-message">Waiting...</div>';
            return;
        }

        // If we're selecting a target, show selection message
        if (pendingAction) {
            actionsEl.innerHTML = `
                <div class="action-message">Select a target...</div>
                <button class="action-btn cancel-btn" id="cancel-action-btn">Cancel</button>
            `;

            document.getElementById('cancel-action-btn')?.addEventListener('click', () => {
                cancelAction();
            });
            return;
        }

        // Show main combat menu
        actionsEl.innerHTML = `
            <div class="action-message">${current.name}'s Turn - Choose your action:</div>
            <div class="combat-menu">
                <button class="menu-btn" id="attack-btn">⚔️ Attack</button>
                <button class="menu-btn" id="defend-btn">🛡️ Defend</button>
                <button class="menu-btn" id="skills-btn">✨ Skills</button>
                <button class="menu-btn" id="items-btn">🎒 Items</button>
                <button class="menu-btn" id="flee-btn">🏃 Flee</button>
            </div>
        `;

        // Attack button
        document.getElementById('attack-btn')?.addEventListener('click', () => {
            initiatAction('attack');
        });

        // Defend button
        document.getElementById('defend-btn')?.addEventListener('click', () => {
            performDefend(current);
        });

        // Skills button
        document.getElementById('skills-btn')?.addEventListener('click', () => {
            showSkillsMenu();
        });

        // Items button
        document.getElementById('items-btn')?.addEventListener('click', () => {
            logCombat('No items available.');
            renderActionButtons();
        });

        // Flee button
        document.getElementById('flee-btn')?.addEventListener('click', () => {
            attemptFlee();
        });
    }

    // Show skills submenu
    function showSkillsMenu() {
        const actionsEl = document.querySelector('.combat-actions');
        if (!actionsEl) return;

        // Get unlocked abilities from AbilityManager
        let abilitiesHTML = '';
        if (window.AbilityManager) {
            const unlockedAbilities = AbilityManager.getUnlockedAbilities();

            if (unlockedAbilities.length > 0) {
                unlockedAbilities.forEach(ability => {
                    abilitiesHTML += `<button class="menu-btn skill-btn" data-ability-id="${ability.id}">${ability.icon || '⚡'} ${ability.name}</button>`;
                });
            } else {
                abilitiesHTML = '<div class="action-message no-abilities">No abilities unlocked yet</div>';
            }
        } else {
            // Fallback if AbilityManager not available
            abilitiesHTML = '<button class="menu-btn skill-btn" data-ability-id="power_strike">⚡ Power Strike</button>';
        }

        actionsEl.innerHTML = `
            <div class="action-message">Select a skill:</div>
            <div class="combat-menu">
                ${abilitiesHTML}
                <button class="menu-btn back-btn" id="back-to-menu-btn">← Back</button>
            </div>
        `;

        // Add event listeners to ability buttons
        document.querySelectorAll('[data-ability-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const abilityId = btn.getAttribute('data-ability-id');
                const ability = window.AbilityManager?.getAbilityById(abilityId);
                if (ability) {
                    useAbility(ability);
                }
            });
        });

        // Legacy Power Strike handler (keep for backwards compatibility)
        document.querySelector('[data-skill="Power Strike"]')?.addEventListener('click', () => {
            initiatAction('skill', 'Power Strike');
        });

        // Back button
        document.getElementById('back-to-menu-btn')?.addEventListener('click', () => {
            renderActionButtons();
        });
    }

    // Use an ability from AbilityManager
    function useAbility(ability) {
        const aliveEnemies = combatState.combatants.filter(c => !c.isPlayer && c.isAlive);
        const current = getCurrentCombatant();

        // If only one enemy, auto-target them
        if (aliveEnemies.length === 1) {
            const target = aliveEnemies[0];

            // Calculate damage based on ability
            let damage = ability.damage?.base || 0;
            if (ability.damage?.multiplier) {
                damage = Math.floor(damage * ability.damage.multiplier);
            }

            // Apply damage
            target.hp -= damage;
            if (target.hp < 0) target.hp = 0;
            if (target.hp === 0) target.isAlive = false;

            logCombat(`${current.name} used ${ability.name} on ${target.name} for ${damage} damage!`);

            // Track ability usage
            if (window.StatsTracker) {
                StatsTracker.incrementStat('combat.abilitiesUsed', 1);
            }

            // End turn
            nextTurn();
        } else {
            // Multiple enemies, need to select target
            initiatAction('ability', ability);
        }
    }

    // Initiate an action that requires target selection
    function initiatAction(actionType, skillName = null) {
        const aliveEnemies = combatState.combatants.filter(c => !c.isPlayer && c.isAlive);

        // If only one enemy, auto-target them
        if (aliveEnemies.length === 1) {
            const current = getCurrentCombatant();
            const target = aliveEnemies[0];

            // Execute the action immediately
            if (actionType === 'attack') {
                performAttack(current, target);
            } else if (actionType === 'skill') {
                useSkill(current, target, skillName);
            }

            // End turn
            nextTurn();
            return;
        }

        // Multiple enemies - need target selection
        pendingAction = {
            type: actionType,
            skill: skillName
        };

        renderCombatUI();
    }

    // Cancel pending action
    function cancelAction() {
        pendingAction = null;
        renderCombatUI();
    }

    // Select target and execute action
    function selectTarget(targetId) {
        if (!pendingAction) return;

        const current = getCurrentCombatant();
        const target = combatState.combatants.find(c => c.id === targetId);

        if (!target || !target.isAlive) return;

        // Execute the action
        if (pendingAction.type === 'attack') {
            performAttack(current, target);
        } else if (pendingAction.type === 'skill') {
            useSkill(current, target, pendingAction.skill);
        }

        // Clear pending action
        pendingAction = null;

        // End turn
        nextTurn();
    }

    // Perform defend action
    function performDefend(character) {
        logCombat(`${character.name} takes a defensive stance!`);
        // Could add defense buff here in future
        nextTurn();
    }

    // Attempt to flee combat
    function attemptFlee() {
        const fleeChance = Math.random();
        if (fleeChance > 0.5) {
            logCombat('Successfully fled from combat!');
            endCombat('flee');
        } else {
            logCombat('Failed to flee!');
            nextTurn();
        }
    }

    // Handle player actions
    function handlePlayerAction(actionType, targetId) {
        const current = getCurrentCombatant();
        if (!current || !current.isPlayer) return;

        const target = combatState.combatants.find(c => c.id === targetId);
        if (!target) return;

        if (actionType === 'attack') {
            performAttack(current, target);
            nextTurn();
        }
    }

    // Initialize combat system
    function init() {
        const combatToggleBtn = document.getElementById('combat-toggle');
        if (combatToggleBtn) {
            combatToggleBtn.addEventListener('click', () => {
                initTestCombat();
            });
        }

    }

    // Initialize test combat
    function initTestCombat() {
        const character = GameState.getState().character;
        if (!character) {
            console.error('No character found');
            return;
        }

        // Use the actual character object as the player combatant
        const player = {
            ...character,
            isPlayer: true,
            isAlive: true,
            hp: 100,
            maxHp: 100,
            attack: 15,
            defense: 5,
            speed: 15,
            initiative: 0
        };

        // Get all available enemy IDs from the database
        const availableEnemies = EnemyDatabase.getAllEnemyIds();
        if (!availableEnemies || availableEnemies.length === 0) {
            console.error('No enemies available in database');
            return;
        }

        // Randomly select an enemy
        const randomEnemyId = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
        console.log(`Random encounter: ${randomEnemyId}`);

        // Create enemy from factory using random selection
        const enemyInstance = EnemyFactory.createEnemy(randomEnemyId);
        if (!enemyInstance) {
            console.error('Failed to create enemy');
            return;
        }

        // Convert enemy instance to combatant format
        const enemy = {
            ...enemyInstance,
            speed: 10,
            attack: EnemyFactory.calculateEnemyAttack(enemyInstance),
            xpReward: enemyInstance.xpReward || 0
        };

        startCombat([player], [enemy]);
    }

    // Save combat state to GameState
    function saveCombatState() {
        if (combatState && combatState.isActive) {
            GameState.updateProperty('combat', {
                ...combatState,
                pendingAction
            });
            SaveSystem.save();
        }
    }

    // Restore combat state from GameState
    function restoreCombatState() {
        const savedCombat = GameState.getState().combat;
        if (savedCombat && savedCombat.isActive) {
            combatState = savedCombat;
            pendingAction = savedCombat.pendingAction;

            // Show combat view
            toggleCombatView(true);

            // Render combat UI
            renderCombatUI();

            // Resume processing current turn
            const current = getCurrentCombatant();
            if (current && current.isPlayer && current.isAlive) {
                // Player's turn - show action menu
                renderCombatUI();
            } else if (current && !current.isPlayer && current.isAlive) {
                // Enemy's turn - process AI action
                processCurrentTurn();
            }
        }
    }

    // Clear combat state
    function clearCombatState() {
        combatState = null;
        pendingAction = null;
        GameState.updateProperty('combat', null);
        SaveSystem.save();
    }

    return {
        init,
        startCombat,
        restoreCombatState,
        getCurrentCombatant,
        getCombatState: () => combatState
    };
})();

// Expose to global scope
window.CombatManager = CombatManager;
window.CombatUI = CombatManager; // For backward compatibility
