// ============================================
// Combat System - Turn-Based Combat Manager
// ============================================

const CombatManager = (() => {
    let combatState = null;
    let pendingAction = null; // Store action waiting for target selection
    let isProcessingTurn = false; // Prevent multiple simultaneous turn processing

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

        // Log enemy encounter
        const enemyNames = combatState.combatants.filter(c => !c.isPlayer).map(c => c.name).join(', ');
        logCombat(`Combat started against ${enemyNames}`);

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
        // Prevent multiple simultaneous turn processing
        if (isProcessingTurn) return;
        isProcessingTurn = true;

        const current = getCurrentCombatant();

        if (!current) {
            isProcessingTurn = false;
            return;
        }

        // Skip dead combatants
        if (!current.isAlive) {
            isProcessingTurn = false;
            nextTurn();
            return;
        }

        renderCombatUI();

        // If it's an enemy's turn, auto-process
        if (!current.isPlayer) {
            setTimeout(() => {
                enemyAI(current);
            }, 1000);
        } else {
            // Player's turn - unlock turn processing since we're waiting for player input
            isProcessingTurn = false;
        }
        // Player turns are handled by button clicks
    }

    // Simple enemy AI
    function enemyAI(enemy) {
        // Check if combat is still active
        if (!combatState || !combatState.isActive) {
            isProcessingTurn = false;
            return;
        }

        const alivePlayers = combatState.combatants.filter(c => c.isPlayer && c.isAlive);
        if (alivePlayers.length === 0) {
            isProcessingTurn = false;
            return;
        }

        // Pick random player
        const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];

        // Basic attack
        performAttack(enemy, target);

        // Unlock turn processing before calling nextTurn
        isProcessingTurn = false;

        // End turn after short delay
        setTimeout(() => {
            if (combatState && combatState.isActive) {
                nextTurn();
            }
        }, 1000);
    }

    // Get equipped weapon damage
    function getEquippedWeaponDamage(character) {
        if (!character.equipment) return null;

        // Check main hand for weapon
        const mainHandItem = character.equipment.main_hand || character.equipment.mainHand;

        if (mainHandItem && mainHandItem.stats && mainHandItem.stats.damage) {
            return mainHandItem.stats.damage;
        }

        return null;
    }

    // Get current attack damage for a combatant
    function getCurrentAttack(combatant) {
        // For players, dynamically calculate from equipment
        if (combatant.isPlayer) {
            const character = GameState.getState().character;
            if (character) {
                const baseAttack = 5; // Unarmed base damage
                const weaponDamage = getEquippedWeaponDamage(character);
                let finalDamage = weaponDamage || baseAttack;

                // Apply melee attack multiplier if using a melee weapon
                const mainHandItem = character.equipment.main_hand || character.equipment.mainHand;
                if (mainHandItem && mainHandItem.weaponType === 'melee') {
                    const meleeMultiplier = character.meleeAttack || 1.0;
                    finalDamage = Math.floor(finalDamage * meleeMultiplier);
                }

                return finalDamage;
            }
            // Fallback to stored attack value
            return combatant.attack || combatant.baseAttack || 5;
        }
        // For enemies, use their static attack value
        return combatant.attack || 10;
    }

    // Perform a basic attack
    function performAttack(attacker, target) {
        // Check for evasion (only for players as targets)
        if (target.isPlayer) {
            const character = GameState.getState().character;
            if (character && character.evasion > 0) {
                const evasionRoll = Math.random() * 100; // Roll 0-100
                if (evasionRoll < character.evasion) {
                    logCombat(`${target.name} evaded ${attacker.name}'s attack!`);
                    renderCombatUI();
                    checkCombatEnd();
                    return; // Attack completely missed
                }
            }
        }

        // Get current attack value (dynamically for players)
        const attackValue = getCurrentAttack(attacker);
        let damage = Math.max(1, attackValue - target.defense);

        // Check for crit (only for players)
        let isCrit = false;
        if (attacker.isPlayer) {
            const character = GameState.getState().character;
            if (character && character.critChance > 0) {
                const critRoll = Math.random() * 100; // Roll 0-100
                if (critRoll < character.critChance) {
                    isCrit = true;
                    damage = damage * 2; // Double damage on crit
                }
            }
        }

        target.hp = Math.max(0, target.hp - damage);

        if (isCrit) {
            logCombat(`${attacker.name} attacks ${target.name} for ${damage} damage! CRITICAL HIT!`);
        } else {
            logCombat(`${attacker.name} attacks ${target.name} for ${damage} damage!`);
        }

        if (target.hp <= 0) {
            target.isAlive = false;
            logCombat(`${target.name} has been defeated!`);
        }

        // Update character HP in real-time if target is the player
        if (target.isPlayer) {
            const character = GameState.getState().character;
            if (character) {
                character.hp = target.hp;
                if (window.updateTopBar) {
                    updateTopBar(character);
                }
            }
        }

        renderCombatUI();
        checkCombatEnd();
    }

    // Use a skill
    function useSkill(attacker, target, skillName) {
        if (skillName === 'Power Strike') {
            // Get current attack value (dynamically for players)
            const attackValue = getCurrentAttack(attacker);
            const damage = Math.max(1, Math.floor((attackValue * 1.5) - target.defense));
            target.hp = Math.max(0, target.hp - damage);
            logCombat(`${attacker.name} uses Power Strike on ${target.name} for ${damage} damage!`);

            if (target.hp <= 0) {
                target.isAlive = false;
                logCombat(`${target.name} has been defeated!`);
            }
        }

        // Update character HP in real-time if target is the player
        if (target.isPlayer) {
            const character = GameState.getState().character;
            if (character) {
                character.hp = target.hp;
                if (window.updateTopBar) {
                    updateTopBar(character);
                }
            }
        }

        renderCombatUI();
        checkCombatEnd();
    }

    // Next turn
    function nextTurn() {
        if (!combatState || !combatState.isActive) return;

        // Ensure we're not already processing a turn
        if (isProcessingTurn) return;

        combatState.currentTurnIndex++;

        // If we've gone through all combatants, start a new round
        if (combatState.currentTurnIndex >= combatState.turnOrder.length) {
            combatState.currentTurnIndex = 0;
            combatState.turnNumber++;
        }

        // Save combat state after each turn
        saveCombatState();

        // Add a small delay before processing the next turn to let UI update
        setTimeout(() => {
            if (combatState && combatState.isActive && !isProcessingTurn) {
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

        // Save player's HP back to character profile BEFORE clearing combat state
        const playerCombatant = combatants.find(c => c.isPlayer);
        if (playerCombatant) {
            const character = GameState.getState().character;
            if (character) {
                // Update character's HP to match their combat HP
                character.hp = Math.max(0, playerCombatant.hp);
                character.maxHp = playerCombatant.maxHp;

                // Update the top bar immediately to show new HP
                if (window.updateTopBar) {
                    updateTopBar(character);
                }
            }
        }

        combatState.isActive = false;

        if (result === 'victory') {
            logCombat('Victory! All enemies defeated.');

            // Track combat stats
            if (window.StatsTracker) {
                const deadEnemies = combatants.filter(c => !c.isPlayer && !c.isAlive);
                StatsTracker.incrementStat('combat.enemiesKilled', deadEnemies.length);
                StatsTracker.incrementStat('combat.combatsWon', 1);
            }

            // Award XP to all living players
            const deadEnemies = combatants.filter(c => !c.isPlayer && !c.isAlive);
            const totalXP = deadEnemies.reduce((sum, enemy) => sum + (enemy.xpReward || 0), 0);

            if (totalXP > 0) {
                combatants.forEach(player => {
                    if (player.isPlayer && player.isAlive) {
                        // Get the actual GameState character
                        const character = GameState.getState().character;
                        if (character) {
                            // Add XP directly to the GameState character
                            const leveled = Character.addXP(character, totalXP);
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

            // Process loot drops from defeated enemies
            if (window.LootManager) {
                deadEnemies.forEach(enemy => {
                    LootManager.handleEnemyLoot(enemy);
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
            logCombat('Defeat! Your party has been defeated.');

            // Track combat stats
            if (window.StatsTracker) {
                StatsTracker.incrementStat('combat.combatsLost', 1);
            }
        } else if (result === 'flee') {
            logCombat('Fled from combat.');

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

            // Handle map encounter based on combat result
            if (window.Map) {
                if (result === 'victory') {
                    window.Map.handleCombatVictory();
                } else if (result === 'flee' || result === 'defeat') {
                    window.Map.handleCombatFleeOrDefeat();
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

    // Toggle combat view - Shows/hides overlay on top of map
    function toggleCombatView(show) {
        const combatOverlay = document.querySelector('.combat-overlay');

        if (show) {
            // Show combat overlay on top of map
            combatOverlay.classList.add('active');
        } else {
            // Hide combat overlay, revealing map underneath
            combatOverlay.classList.remove('active');
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
            showItemsMenu();
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

    // ============================================
    // COMBAT ITEMS MENU
    // ============================================
    // ** Uses centralized InventoryUI module **
    // See js/ui/inventory-ui.js and CLAUDE.md
    // ============================================
    function showItemsMenu() {
        const actionsEl = document.querySelector('.combat-actions');
        if (!actionsEl) return;

        const character = GameState.getState().character;

        // Use InventoryUI module to render combat items menu
        InventoryUI.renderCombatItemsMenu(
            actionsEl,
            character,
            (item) => {
                // Callback when item is used
                useItemInCombat(item);
            },
            () => {
                // Callback for back button
                renderActionButtons();
            }
        );
    }

    // Use an item in combat
    function useItemInCombat(item) {
        const current = getCurrentCombatant();
        if (!current) return;

        const character = GameState.getState().character;
        if (!character) return;

        // Use the consumable via ConsumableManager
        if (window.ConsumableManager) {
            const success = ConsumableManager.useConsumable(character, item, combatState);

            if (success) {
                // Update UI
                renderCombatUI();
                checkCombatEnd();

                // End turn only if combat is still active
                if (combatState && combatState.isActive) {
                    nextTurn();
                }
            } else {
                // Failed to use item, return to menu
                renderActionButtons();
            }
        }
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

            // Update character HP in real-time if target is the player
            if (target.isPlayer) {
                const character = GameState.getState().character;
                if (character) {
                    character.hp = target.hp;
                    if (window.updateTopBar) {
                        updateTopBar(character);
                    }
                }
            }

            // Track ability usage
            if (window.StatsTracker) {
                StatsTracker.incrementStat('combat.abilitiesUsed', 1);
            }

            renderCombatUI();
            checkCombatEnd();

            // End turn - check combat end handles victory/defeat
            if (combatState && combatState.isActive) {
                nextTurn();
            }
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

            // End turn only if combat is still active
            if (combatState && combatState.isActive) {
                nextTurn();
            }
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
        } else if (pendingAction.type === 'ability') {
            // Handle ability from AbilityManager
            const ability = pendingAction.skill; // The ability object was stored in 'skill' field
            if (ability) {
                let damage = ability.damage?.base || 0;
                if (ability.damage?.multiplier) {
                    damage = Math.floor(damage * ability.damage.multiplier);
                }

                target.hp -= damage;
                if (target.hp < 0) target.hp = 0;
                if (target.hp === 0) target.isAlive = false;

                logCombat(`${current.name} used ${ability.name} on ${target.name} for ${damage} damage!`);

                // Update character HP in real-time if target is the player
                if (target.isPlayer) {
                    const character = GameState.getState().character;
                    if (character) {
                        character.hp = target.hp;
                        if (window.updateTopBar) {
                            updateTopBar(character);
                        }
                    }
                }

                if (window.StatsTracker) {
                    StatsTracker.incrementStat('combat.abilitiesUsed', 1);
                }
            }
        }

        // Clear pending action
        pendingAction = null;

        renderCombatUI();
        checkCombatEnd();

        // End turn only if combat is still active
        if (combatState && combatState.isActive) {
            nextTurn();
        }
    }

    // Perform defend action
    function performDefend(character) {
        logCombat(`${character.name} takes a defensive stance!`);
        // Could add defense buff here in future

        // End turn only if combat is still active
        if (combatState && combatState.isActive) {
            nextTurn();
        }
    }

    // Attempt to flee combat
    function attemptFlee() {
        const fleeChance = Math.random();
        if (fleeChance > 0.5) {
            logCombat('Successfully fled from combat!');
            endCombat('flee');
        } else {
            logCombat('Failed to flee!');

            // End turn only if combat is still active
            if (combatState && combatState.isActive) {
                nextTurn();
            }
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

            // End turn only if combat is still active
            if (combatState && combatState.isActive) {
                nextTurn();
            }
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

        // Initialize HP/Mana if they don't exist (for old saves)
        if (character.hp === undefined) character.hp = 100;
        if (character.maxHp === undefined) character.maxHp = 100;
        if (character.mana === undefined) character.mana = 10;
        if (character.maxMana === undefined) character.maxMana = 10;

        // Calculate player's attack damage based on equipped weapon
        const baseAttack = 5; // Unarmed base damage
        const weaponDamage = getEquippedWeaponDamage(character);
        const playerAttack = weaponDamage || baseAttack;

        // Use the actual character object as the player combatant with PERSISTENT HP
        const player = {
            ...character,
            isPlayer: true,
            isAlive: character.hp > 0,
            hp: character.hp,
            maxHp: character.maxHp,
            attack: playerAttack,
            baseAttack: baseAttack, // Store base for reference
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
            isProcessingTurn = false; // Reset turn processing flag on restore

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
        isProcessingTurn = false; // Reset turn processing flag
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
