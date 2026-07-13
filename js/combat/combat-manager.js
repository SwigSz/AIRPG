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
            isActive: false,
            abilityCooldowns: {} // Track ability cooldowns: { abilityId: remainingTurns }
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

    // Show floating damage number on combatant card
    function showFloatingDamage(combatantId, amount, type) {
        const targetCard = document.querySelector(`[data-combatant-id="${combatantId}"]`);
        if (!targetCard) {
            console.warn(`[Combat] Could not find card with ID: ${combatantId}`);
            return;
        }

        const floatEl = document.createElement('div');
        floatEl.className = `damage-float ${type}`;

        if (type === 'miss') {
            floatEl.textContent = 'EVADED';
        } else if (type === 'heal') {
            floatEl.textContent = `+${amount} HP`;
        } else if (type === 'mana') {
            floatEl.textContent = `+${amount} MP`;
        } else if (type === 'crit') {
            floatEl.textContent = `CRIT! -${amount}`;
        } else {
            floatEl.textContent = `-${amount}`;
        }

        targetCard.appendChild(floatEl);

        // Remove element after animation completes
        setTimeout(() => {
            floatEl.remove();
        }, 1200);
    }

    // Animate HP damage on combatant card
    function animateHPDamage(combatantId, oldHP, newHP, maxHP) {
        const targetCard = document.querySelector(`[data-combatant-id="${combatantId}"]`);
        if (!targetCard) return;

        const hpBar = targetCard.querySelector('.hp-bar');
        if (!hpBar) return;

        const hpFill = hpBar.querySelector('.hp-fill');
        const damageIndicator = hpBar.querySelector('.hp-damage-indicator');
        if (!hpFill || !damageIndicator) return;

        const oldPercent = (oldHP / maxHP) * 100;
        const newPercent = (newHP / maxHP) * 100;
        const damagePercent = oldPercent - newPercent;

        // Set initial state: HP fill at new value, damage indicator showing the gap
        hpFill.style.transition = 'none';
        hpFill.style.width = `${newPercent}%`;
        damageIndicator.style.transition = 'none';
        damageIndicator.style.width = `${damagePercent}%`;
        damageIndicator.style.left = `${newPercent}%`;
        damageIndicator.style.opacity = '0';

        // Force reflow
        void hpBar.offsetWidth;

        // Show damage indicator (lighter bar) in the gap for 0.3s
        damageIndicator.style.opacity = '1';

        // After 0.3s, animate the damage indicator shrinking to nothing
        setTimeout(() => {
            damageIndicator.style.transition = 'width 0.5s ease, opacity 0.5s ease';
            damageIndicator.style.width = '0%';
            damageIndicator.style.opacity = '0';
        }, 300);
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
            // Player's turn - reduce ability cooldowns
            if (combatState.abilityCooldowns) {
                Object.keys(combatState.abilityCooldowns).forEach(abilityId => {
                    if (combatState.abilityCooldowns[abilityId] > 0) {
                        combatState.abilityCooldowns[abilityId]--;
                    }
                    // Remove cooldown if it reaches 0
                    if (combatState.abilityCooldowns[abilityId] <= 0) {
                        delete combatState.abilityCooldowns[abilityId];
                    }
                });
            }

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
        // For players, use centralized damage calculation system
        if (combatant.isPlayer) {
            const character = GameState.getState().character;
            if (character && window.DamageCalculator) {
                // Use DamageCalculator for proper damage type multipliers
                return DamageCalculator.calculateCurrentWeaponDamage(character);
            }
            // Fallback if DamageCalculator not loaded
            return combatant.attack || combatant.baseAttack || 5;
        }
        // For enemies, roll damage from their attack damage range
        if (combatant.attack && typeof combatant.attack === 'object' && combatant.attack.damage) {
            // Enemy has attack object with damage string (e.g., "2~5")
            if (window.EnemyFactory) {
                return EnemyFactory.rollDamage(combatant.attack.damage);
            }
        }
        // Fallback to static attack value if no damage range found
        return combatant.attack || 10;
    }

    // Perform a basic attack
    function performAttack(attacker, target) {
        // Determine target card ID for floating damage
        let targetCardId = 'player';
        if (!target.isPlayer) {
            const enemies = combatState.combatants.filter(c => !c.isPlayer);
            const targetIndex = enemies.findIndex(e => e.id === target.id);
            targetCardId = `enemy-${targetIndex}`;
        }

        // Check for evasion (works for both players and enemies)
        // Note: Cannot evade while blocking (bracing for impact)
        let targetEvasion = 0;
        if (!target.isBlocking) {
            if (target.isPlayer) {
                const character = GameState.getState().character;
                targetEvasion = character?.evasion || 0;
            } else {
                // Enemies can have evasion too
                targetEvasion = target.evasion || 0;
            }
        }

        if (targetEvasion > 0) {
            const evasionRoll = Math.random() * 100; // Roll 0-100
            if (evasionRoll < targetEvasion) {
                logCombat(`${target.name} evaded ${attacker.name}'s attack!`);
                renderCombatUI();

                // Show floating damage AFTER rendering (same as normal damage)
                requestAnimationFrame(() => {
                    showFloatingDamage(targetCardId, 0, 'miss');
                });

                checkCombatEnd();
                return; // Attack completely missed
            }
        }

        // Get current attack value (dynamically for players)
        const attackValue = getCurrentAttack(attacker);
        let damage = Math.max(1, attackValue - target.defense);

        // Check for crit (works for both players and enemies)
        let isCrit = false;
        let attackerCritChance = 0;

        if (attacker.isPlayer) {
            const character = GameState.getState().character;
            attackerCritChance = character?.critChance || 0;
        } else {
            // Enemies can have crit chance too
            attackerCritChance = attacker.critChance || 0;
        }

        if (attackerCritChance > 0) {
            const critRoll = Math.random() * 100; // Roll 0-100
            if (critRoll < attackerCritChance) {
                isCrit = true;
                damage = damage * 2; // Double damage on crit
            }
        }

        // Apply block reduction if target is blocking
        if (target.isBlocking) {
            const blockAmount = target.blockAmount || 5;
            const reducedDamage = Math.max(0, damage - blockAmount);
            const blockedAmount = damage - reducedDamage;
            damage = reducedDamage;

            logCombat(`${target.name} blocked ${blockedAmount} damage!`);

            // Clear blocking status after use
            target.isBlocking = false;
            target.blockAmount = 0;
        }

        // Store old HP for animation
        const oldHP = target.hp;
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

        // Show floating damage number and animate HP AFTER rendering
        requestAnimationFrame(() => {
            const damageType = isCrit ? 'crit' : 'damage';
            showFloatingDamage(targetCardId, damage, damageType);
            animateHPDamage(targetCardId, oldHP, target.hp, target.maxHp);
        });

        checkCombatEnd();
    }

    // Use a skill
    function useSkill(attacker, target, skillName) {
        // Determine target card ID for floating damage
        let targetCardId = 'player';
        if (!target.isPlayer) {
            const enemies = combatState.combatants.filter(c => !c.isPlayer);
            const targetIndex = enemies.findIndex(e => e.id === target.id);
            targetCardId = `enemy-${targetIndex}`;
        }

        if (skillName === 'Power Strike') {
            // Get current attack value (dynamically for players)
            const attackValue = getCurrentAttack(attacker);
            const damage = Math.max(1, Math.floor((attackValue * 1.5) - target.defense));

            // Store old HP for animation
            const oldHP = target.hp;
            target.hp = Math.max(0, target.hp - damage);

            logCombat(`${attacker.name} uses Power Strike on ${target.name} for ${damage} damage!`);

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

            // Show floating damage number and animate HP AFTER rendering
            requestAnimationFrame(() => {
                showFloatingDamage(targetCardId, damage, 'damage');
                animateHPDamage(targetCardId, oldHP, target.hp, target.maxHp);
            });
        }

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
            const deadEnemies = combatants.filter(c => !c.isPlayer && !c.isAlive);
            if (window.StatsTracker) {
                StatsTracker.incrementStat('combat.kills', deadEnemies.length);
                StatsTracker.incrementStat('combat.battlesWon', 1);
            }

            // Award XP to all living players
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

            // Award combat skill XP for winning
            const character = GameState.getState().character;
            if (character && window.SkillManager) {
                SkillManager.addSkillXP(character, 'combat', 50);
            }

            // Process loot drops from defeated enemies
            if (window.LootManager) {
                deadEnemies.forEach(enemy => {
                    LootManager.handleEnemyLoot(enemy);
                });
            }

            // Check for ability/power unlocks
            if (window.AbilityManager) {
                AbilityManager.checkAndUnlockAbilities();
            }
            if (window.PowerManager) {
                PowerManager.checkAndEarnPowers();
            }
            // Refresh character UI
            if (window.CharacterUI) {
                CharacterUI.render();
            }
        } else if (result === 'defeat') {
            logCombat('Defeat! Your party has been defeated.');

            // Track combat stats
            if (window.StatsTracker) {
                StatsTracker.incrementStat('combat.battlesLost', 1);
            }

            // Award combat skill XP for losing (consolation prize)
            const character = GameState.getState().character;
            if (character && window.SkillManager) {
                SkillManager.addSkillXP(character, 'combat', 10);
            }
        } else if (result === 'flee') {
            logCombat('Fled from combat.');
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
            if (window.LocalMap) {
                if (result === 'victory') {
                    window.LocalMap.handleCombatVictory();
                } else if (result === 'flee' || result === 'defeat') {
                    window.LocalMap.handleCombatFleeOrDefeat();
                }
            }

            // Defeat is death — the dynasty system takes over from here
            // (heir succession, or the end of the line)
            if (result === 'defeat' && window.Succession) {
                Succession.die('been slain in battle');
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
        enemies.forEach((enemy, index) => {
            const enemyCard = document.createElement('div');
            enemyCard.className = 'combatant-card enemy';
            enemyCard.setAttribute('data-combatant-id', `enemy-${index}`);
            if (!enemy.isAlive) enemyCard.classList.add('dead');

            // Make alive enemies clickable for targeting
            if (enemy.isAlive && pendingAction) {
                enemyCard.classList.add('targetable');
                enemyCard.style.cursor = 'pointer';
            }

            const enemyDefense = enemy.defense || 0;

            // Parse enemy damage range from attack object
            let enemyAttackMin = 1;
            let enemyAttackMax = 1;
            if (enemy.attack && typeof enemy.attack === 'object' && enemy.attack.damage) {
                const damageRange = window.EnemyFactory ? EnemyFactory.parseDamage(enemy.attack.damage) : { min: 1, max: 1 };
                enemyAttackMin = damageRange.min;
                enemyAttackMax = damageRange.max;
            } else if (typeof enemy.attack === 'number') {
                // Fallback for old format
                enemyAttackMin = Math.max(1, enemy.attack - 2);
                enemyAttackMax = enemy.attack + 2;
            }

            enemyCard.innerHTML = `
                <div class="combatant-name">${enemy.name}</div>
                <div class="combatant-hp">
                    <div class="hp-bar">
                        <div class="hp-fill" style="width: ${(enemy.hp / enemy.maxHp) * 100}%"></div>
                        <div class="hp-damage-indicator" style="width: 0%"></div>
                    </div>
                    <div class="hp-text">${enemy.hp} / ${enemy.maxHp}</div>
                </div>
                ${enemy.isAlive ? `
                    <div class="enemy-stats">
                        <div class="enemy-stat">🛡️ ${enemyDefense}</div>
                        <div class="enemy-stat">⚔️ ${enemyAttackMin}-${enemyAttackMax}</div>
                    </div>
                ` : '<div class="corpse-label">CORPSE</div>'}
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
            playerCard.setAttribute('data-combatant-id', 'player');
            if (!player.isAlive) playerCard.classList.add('dead');

            playerCard.innerHTML = `
                <div class="combatant-name">${player.name}</div>
                <div class="combatant-hp">
                    <div class="hp-bar">
                        <div class="hp-fill" style="width: ${(player.hp / player.maxHp) * 100}%"></div>
                        <div class="hp-damage-indicator" style="width: 0%"></div>
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

        if (!current || !current.isAlive || !combatState.isActive) {
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

        // Determine if it's the player's turn
        const isPlayerTurn = current.isPlayer;
        const disabledClass = isPlayerTurn ? '' : 'disabled';
        const messageText = isPlayerTurn ? `${current.name}'s Turn - Choose your action:` : 'Enemy turn';

        // Show main combat menu (always visible, but disabled during enemy turn)
        actionsEl.innerHTML = `
            <div class="action-message">${messageText}</div>
            <div class="combat-menu">
                <button class="menu-btn attack-btn ${disabledClass}" id="attack-btn">⚔️ Attack</button>
                <button class="menu-btn ${disabledClass}" id="defend-btn">🛡️ Defend</button>
                <button class="menu-btn ${disabledClass}" id="skills-btn">✨ Skills</button>
                <button class="menu-btn ${disabledClass}" id="items-btn">🎒 Items</button>
                <button class="menu-btn ${disabledClass}" id="flee-btn">🏃 Flee</button>
            </div>
        `;

        // Only add event listeners if it's the player's turn
        if (isPlayerTurn) {
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
    }

    // Show skills submenu
    function showSkillsMenu() {
        const actionsEl = document.querySelector('.combat-actions');
        if (!actionsEl) return;

        // Get unlocked abilities from AbilityManager
        let abilitiesHTML = '';
        if (window.AbilityManager) {
            const unlockedAbilities = AbilityManager.getUnlockedAbilities();
            const character = GameState.getState().character;
            const currentMana = character?.mana || 0;

            if (unlockedAbilities.length > 0) {
                unlockedAbilities.forEach(ability => {
                    const manaCost = ability.manaCost || 0;
                    const hasEnoughMana = currentMana >= manaCost;
                    const cooldownRemaining = combatState.abilityCooldowns?.[ability.id] || 0;
                    const isOnCooldown = cooldownRemaining > 0;
                    const isDisabled = !hasEnoughMana || isOnCooldown;
                    const disabledClass = isDisabled ? 'disabled' : '';
                    const disabledAttr = isDisabled ? 'disabled' : '';

                    let displayText = `${ability.icon || '⚡'} ${ability.name}`;
                    if (isOnCooldown) {
                        displayText += ` (CD: ${cooldownRemaining})`;
                    } else if (manaCost > 0) {
                        displayText += ` (${manaCost} MP)`;
                    }

                    abilitiesHTML += `<button class="menu-btn skill-btn ${disabledClass}" data-ability-id="${ability.id}" ${disabledAttr}>${displayText}</button>`;
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
        const character = GameState.getState().character;

        // Check if ability is on cooldown
        if (combatState.abilityCooldowns && combatState.abilityCooldowns[ability.id]) {
            const remainingTurns = combatState.abilityCooldowns[ability.id];
            logCombat(`${ability.name} is on cooldown! ${remainingTurns} turn(s) remaining.`);
            return;
        }

        // Check if player has enough mana
        if (ability.manaCost && ability.manaCost > 0) {
            if (!character || character.mana < ability.manaCost) {
                logCombat(`Not enough mana! ${ability.name} requires ${ability.manaCost} mana.`);
                return;
            }
        }

        // Consume mana
        if (ability.manaCost && ability.manaCost > 0 && character) {
            character.mana -= ability.manaCost;
            if (character.mana < 0) character.mana = 0;

            // Update top bar to reflect mana change
            if (window.updateTopBar) {
                updateTopBar(character);
            }

            // Save the change
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }

        // Set ability on cooldown
        if (ability.cooldown && ability.cooldown > 0) {
            combatState.abilityCooldowns[ability.id] = ability.cooldown;
        }

        // Check ability type
        if (ability.type === 'support') {
            // Support abilities target the player
            const playerCombatant = combatState.combatants.find(c => c.isPlayer);

            // Handle healing
            if (ability.healing) {
                const oldHP = playerCombatant.hp;
                const healAmount = ability.healing.base || 0;
                playerCombatant.hp += healAmount;
                if (playerCombatant.hp > playerCombatant.maxHp) {
                    playerCombatant.hp = playerCombatant.maxHp;
                }

                // Update character HP
                character.hp = playerCombatant.hp;

                logCombat(`${current.name} used ${ability.name} and restored ${healAmount} HP!`);

                // Update top bar
                if (window.updateTopBar) {
                    updateTopBar(character);
                }

                renderCombatUI();

                // Show floating heal number
                requestAnimationFrame(() => {
                    showFloatingDamage('player', healAmount, 'heal');
                    animateHPDamage('player', oldHP, playerCombatant.hp, playerCombatant.maxHp);
                });
            }

            // Handle mana restore
            if (ability.manaRestore) {
                const manaAmount = ability.manaRestore.base || 0;
                character.mana += manaAmount;
                if (character.mana > character.maxMana) {
                    character.mana = character.maxMana;
                }

                logCombat(`${current.name} used ${ability.name} and restored ${manaAmount} mana!`);

                // Update top bar
                if (window.updateTopBar) {
                    updateTopBar(character);
                }

                renderCombatUI();

                // Show floating mana number
                requestAnimationFrame(() => {
                    showFloatingDamage('player', manaAmount, 'mana');
                });
            }

            // Handle buffs (if implemented in the future)
            if (ability.buff) {
                logCombat(`${current.name} used ${ability.name}! (Buff effects not yet implemented)`);
            }

            // Save changes
            if (window.SaveSystem) {
                SaveSystem.save();
            }

            // End turn
            if (combatState && combatState.isActive) {
                nextTurn();
            }
        } else {
            // Attack abilities
            // If only one enemy, auto-target them
            if (aliveEnemies.length === 1) {
                const target = aliveEnemies[0];

                // Calculate damage based on ability
                let damage = ability.damage?.base || 0;
                if (ability.damage?.multiplier) {
                    damage = Math.floor(damage * ability.damage.multiplier);
                }

                // Determine target card ID for animation
                let targetCardId = 'player';
                if (!target.isPlayer) {
                    const enemies = combatState.combatants.filter(c => !c.isPlayer);
                    const targetIndex = enemies.findIndex(e => e.id === target.id);
                    targetCardId = `enemy-${targetIndex}`;
                }

                // Store old HP for animation
                const oldHP = target.hp;

                // Apply damage
                target.hp -= damage;
                if (target.hp < 0) target.hp = 0;
                if (target.hp === 0) target.isAlive = false;

                logCombat(`${current.name} used ${ability.name} on ${target.name} for ${damage} damage!`);

                // Update character HP in real-time if target is the player
                if (target.isPlayer) {
                    if (character) {
                        character.hp = target.hp;
                        if (window.updateTopBar) {
                            updateTopBar(character);
                        }
                    }
                }

                renderCombatUI();

                // Show floating damage number and animate HP AFTER rendering
                requestAnimationFrame(() => {
                    showFloatingDamage(targetCardId, damage, 'damage');
                    animateHPDamage(targetCardId, oldHP, target.hp, target.maxHp);
                });

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

                // Determine target card ID for animation
                let targetCardId = 'player';
                if (!target.isPlayer) {
                    const enemies = combatState.combatants.filter(c => !c.isPlayer);
                    const targetIndex = enemies.findIndex(e => e.id === target.id);
                    targetCardId = `enemy-${targetIndex}`;
                }

                // Store old HP for animation
                const oldHP = target.hp;

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

                // Clear pending action
                pendingAction = null;

                renderCombatUI();

                // Show floating damage number and animate HP AFTER rendering
                requestAnimationFrame(() => {
                    showFloatingDamage(targetCardId, damage, 'damage');
                    animateHPDamage(targetCardId, oldHP, target.hp, target.maxHp);
                });
            }
        }

        checkCombatEnd();

        // End turn only if combat is still active
        if (combatState && combatState.isActive) {
            nextTurn();
        }
    }

    // Perform defend action
    function performDefend(character) {
        // Calculate block amount: base 5 + shield blockPower if equipped
        let blockAmount = 5; // Base block amount

        // Check if player has a shield equipped
        if (character.isPlayer) {
            const gameCharacter = GameState.getState().character;
            if (gameCharacter && gameCharacter.equipment && gameCharacter.equipment.off_hand) {
                const offHandItem = gameCharacter.equipment.off_hand;
                // Check if the off-hand item is a shield
                if (offHandItem.classifications && offHandItem.classifications.includes('shield')) {
                    // Add shield's block power
                    if (offHandItem.stats && offHandItem.stats.blockPower) {
                        blockAmount += offHandItem.stats.blockPower;
                    }
                }
            }
        }

        // Set blocking status
        character.isBlocking = true;
        character.blockAmount = blockAmount;

        logCombat(`${character.name} takes a defensive stance! (Will block ${blockAmount} damage)`);

        // End turn only if combat is still active
        if (combatState && combatState.isActive) {
            nextTurn();
        }
    }

    // Show flee result indicator
    function showFleeIndicator(success) {
        const fleeBtn = document.getElementById('flee-btn');
        if (!fleeBtn) return;

        // Create indicator element
        const indicator = document.createElement('div');
        indicator.className = `flee-indicator ${success ? 'success' : 'failure'}`;
        indicator.textContent = success ? 'ESCAPED!' : 'FAILED!';

        // Position above the button
        const btnRect = fleeBtn.getBoundingClientRect();
        const actionsRect = fleeBtn.parentElement.getBoundingClientRect();

        indicator.style.left = `${btnRect.left - actionsRect.left + (btnRect.width / 2)}px`;
        indicator.style.top = `${btnRect.top - actionsRect.top - 40}px`;

        fleeBtn.parentElement.appendChild(indicator);

        // Remove after animation
        setTimeout(() => {
            indicator.remove();
        }, 2000);
    }

    // Attempt to flee combat
    function attemptFlee() {
        // Disable flee button to prevent spam
        const fleeBtn = document.getElementById('flee-btn');
        if (fleeBtn) {
            fleeBtn.disabled = true;
            fleeBtn.classList.add('disabled');
        }

        // Base 50% flee chance + 1% per point of dexterity above 0
        const character = window.GameState?.getState()?.character;
        const dex = character?.stats?.dexterity || 0;
        const fleeThreshold = Math.max(0.05, 0.5 - (dex * 0.01));
        const fleeChance = Math.random();
        const success = fleeChance > fleeThreshold;

        // Show visual indicator
        showFleeIndicator(success);

        if (success) {
            logCombat('Successfully fled from combat!');
            // Shorter delay to end combat quickly
            setTimeout(() => {
                endCombat('flee');
            }, 300);
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
            defense: character.defense || 0,
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
            // Keep the attack object intact (don't overwrite with static value)
            // attack property already copied from enemyInstance spread
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

            // Migrate old enemy format to new format
            if (combatState.combatants) {
                combatState.combatants.forEach(combatant => {
                    // If enemy has old format (attack is a number), migrate to new format
                    if (!combatant.isPlayer && typeof combatant.attack === 'number') {
                        const oldAttack = combatant.attack;
                        // Recreate enemy from template to get proper attack object
                        if (combatant.templateId && window.EnemyFactory) {
                            const freshEnemy = EnemyFactory.createEnemy(combatant.templateId);
                            if (freshEnemy) {
                                // Keep current HP and alive status, but update attack structure
                                combatant.attack = freshEnemy.attack;
                                combatant.defense = freshEnemy.defense; // Also update defense in case it was wrong
                            }
                        }
                    }
                });
            }

            // Show combat view
            toggleCombatView(true);

            // Render combat UI
            renderCombatUI();

            // Resume processing current turn
            const current = getCurrentCombatant();
            if (current && current.isPlayer && current.isAlive) {
                // Player's turn - show action menu
                renderCombatUI();
            } else if (current) {
                // Enemy's turn OR a dead combatant's slot — processCurrentTurn
                // handles both (it advances past dead combatants). Previously a
                // dead current combatant left combat soft-locked after reload.
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
