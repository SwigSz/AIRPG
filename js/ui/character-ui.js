// ============================================
// Character UI Manager - Skills, Abilities, Stats
// ============================================

const CharacterUI = (() => {
    let activeTab = 'skills'; // 'skills', 'abilities', 'stats'

    function init() {
        // Create the new character tab structure
        createCharacterTabStructure();

        // Set up tab switching
        setupTabSwitching();

        // Render initial data
        render();

        // CharacterUI initialized
    }

    // Create the new structure for the character tab
    function createCharacterTabStructure() {
        const characterTab = document.getElementById('character-tab');
        if (!characterTab) return;

        characterTab.innerHTML = `
            <div class="character-tab-layout">
                <!-- Tab Navigation -->
                <div class="character-tab-nav">
                    <button class="character-tab-btn active" data-char-tab="skills">
                        <span class="tab-icon">📜</span>
                        <span class="tab-label">Skills</span>
                    </button>
                    <button class="character-tab-btn" data-char-tab="abilities">
                        <span class="tab-icon">⚡</span>
                        <span class="tab-label">Abilities</span>
                    </button>
                    <button class="character-tab-btn" data-char-tab="stats">
                        <span class="tab-icon">📊</span>
                        <span class="tab-label">Stats</span>
                    </button>
                </div>

                <!-- Tab Content Area -->
                <div class="character-tab-content-area">
                    <!-- Skills Tab -->
                    <div class="character-tab-content active" id="skills-tab-content">
                        <h2>Skills</h2>
                        <div class="skills-grid" id="skills-grid">
                            <!-- Skills will be rendered here -->
                        </div>
                    </div>

                    <!-- Abilities Tab -->
                    <div class="character-tab-content" id="abilities-tab-content">
                        <h2>Abilities</h2>
                        <div class="abilities-grid" id="abilities-grid">
                            <!-- Abilities will be rendered here -->
                        </div>
                    </div>

                    <!-- Stats Tab -->
                    <div class="character-tab-content" id="stats-tab-content">
                        <h2>Character Statistics</h2>
                        <div class="stats-categories">
                            <div class="stats-category">
                                <h3>Combat Stats</h3>
                                <div class="stats-list" id="combat-stats-list">
                                    <!-- Combat stats will be rendered here -->
                                </div>
                            </div>
                            <div class="stats-category">
                                <h3>Character Stats</h3>
                                <div class="stats-list" id="character-stats-list">
                                    <!-- Character stats will be rendered here -->
                                </div>
                            </div>
                            <div class="stats-category">
                                <h3>General Stats</h3>
                                <div class="stats-list" id="general-stats-list">
                                    <!-- General stats will be rendered here -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Set up tab switching functionality
    function setupTabSwitching() {
        const tabButtons = document.querySelectorAll('.character-tab-btn');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-char-tab');
                switchTab(tabName);
            });
        });
    }

    // Switch between character tabs
    function switchTab(tabName) {
        activeTab = tabName;

        // Update button active states
        document.querySelectorAll('.character-tab-btn').forEach(btn => {
            if (btn.getAttribute('data-char-tab') === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update content active states
        document.querySelectorAll('.character-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const activeContent = document.getElementById(`${tabName}-tab-content`);
        if (activeContent) {
            activeContent.classList.add('active');
        }

        // Re-render the active tab
        render();
    }

    // Main render function
    function render() {
        if (activeTab === 'skills') {
            renderSkills();
        } else if (activeTab === 'abilities') {
            renderAbilities();
        } else if (activeTab === 'stats') {
            renderStats();
            // Set up attribute buttons after rendering stats
            setTimeout(() => setupAttributeButtons(), 0);
        }
    }

    // Render skills
    function renderSkills() {
        const skillsGrid = document.getElementById('skills-grid');
        if (!skillsGrid) return;

        skillsGrid.innerHTML = '';

        if (!window.SkillManager) {
            skillsGrid.innerHTML = '<p class="empty-message">Skill system not loaded</p>';
            return;
        }

        const allSkills = SkillManager.getAllSkills();
        const earnedSkills = allSkills.filter(skill => skill.earned);

        if (earnedSkills.length === 0) {
            skillsGrid.innerHTML = '<p class="empty-message">No skills earned yet. Earn your first skill by crafting an item!</p>';
            return;
        }

        earnedSkills.forEach(skill => {
            const skillCard = createSkillCard(skill);
            skillsGrid.appendChild(skillCard);
        });
    }

    // Create a skill card element
    function createSkillCard(skill) {
        const card = document.createElement('div');
        card.className = 'skill-card';

        card.innerHTML = `
            <div class="skill-icon">${skill.icon || '📜'}</div>
            <div class="skill-name">${skill.name}</div>
            <div class="skill-category">${skill.category || ''}</div>
        `;

        // Add hover tooltip
        card.addEventListener('mouseenter', () => {
            if (window.TooltipManager) {
                const tooltipData = {
                    ...skill,
                    unlockDescription: skill.unlockConditions ?
                        window.ConditionEvaluator?.describeCondition(skill.unlockConditions) : null
                };
                TooltipManager.showTooltip(card, tooltipData, 'skill');
            }
        });

        card.addEventListener('mouseleave', () => {
            if (window.TooltipManager) {
                TooltipManager.hideTooltip();
            }
        });

        return card;
    }

    // Render abilities
    function renderAbilities() {
        const abilitiesGrid = document.getElementById('abilities-grid');
        if (!abilitiesGrid) return;

        abilitiesGrid.innerHTML = '';

        if (!window.AbilityManager) {
            abilitiesGrid.innerHTML = '<p class="empty-message">Ability system not loaded</p>';
            return;
        }

        const allAbilities = AbilityManager.getAllAbilities();
        const unlockedAbilities = allAbilities.filter(ability => ability.unlocked);

        if (unlockedAbilities.length === 0) {
            abilitiesGrid.innerHTML = '<p class="empty-message">No abilities unlocked yet. Defeat your first enemy to unlock Power Strike!</p>';
            return;
        }

        unlockedAbilities.forEach(ability => {
            const abilityCard = createAbilityCard(ability);
            abilitiesGrid.appendChild(abilityCard);
        });
    }

    // Create an ability card element
    function createAbilityCard(ability) {
        const card = document.createElement('div');
        card.className = 'ability-card';

        card.innerHTML = `
            <div class="ability-icon">${ability.icon || '⚡'}</div>
            <div class="ability-name">${ability.name}</div>
            <div class="ability-type">${ability.type || ''}</div>
        `;

        // Add hover tooltip
        card.addEventListener('mouseenter', () => {
            if (window.TooltipManager) {
                const tooltipData = {
                    ...ability,
                    unlockDescription: ability.unlockConditions ?
                        window.ConditionEvaluator?.describeCondition(ability.unlockConditions) : null
                };
                TooltipManager.showTooltip(card, tooltipData, 'ability');
            }
        });

        card.addEventListener('mouseleave', () => {
            if (window.TooltipManager) {
                TooltipManager.hideTooltip();
            }
        });

        return card;
    }

    // Render stats
    function renderStats() {
        if (!window.StatsTracker) return;

        const stats = StatsTracker.getStats();

        // Render combat stats
        const combatStatsList = document.getElementById('combat-stats-list');
        if (combatStatsList && stats.combat) {
            combatStatsList.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">Enemies Killed:</span>
                    <span class="stat-value">${stats.combat.enemiesKilled || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Damage Dealt:</span>
                    <span class="stat-value">${stats.combat.damageDealt || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Damage Taken:</span>
                    <span class="stat-value">${stats.combat.damageTaken || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Attacks Made:</span>
                    <span class="stat-value">${stats.combat.attacksMade || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Abilities Used:</span>
                    <span class="stat-value">${stats.combat.abilitiesUsed || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Combats Won:</span>
                    <span class="stat-value">${stats.combat.combatsWon || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Combats Lost:</span>
                    <span class="stat-value">${stats.combat.combatsLost || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Combats Fled:</span>
                    <span class="stat-value">${stats.combat.combatsFled || 0}</span>
                </div>
            `;
        }

        // Render character stats (new combat stats)
        const characterStatsList = document.getElementById('character-stats-list');
        if (characterStatsList) {
            const character = window.GameState?.getState().character;
            if (character && window.CharacterStats) {
                // Calculate stats with breakdowns
                const calculated = CharacterStats.calculate(character);
                const breakdowns = calculated.breakdowns;

                // Format attack multipliers as percentages
                const meleeAttackPercent = Math.round((character.meleeAttack || 1.0) * 100);
                const rangedAttackPercent = Math.round((character.rangedAttack || 1.0) * 100);
                const magicAttackPercent = Math.round((character.magicAttack || 1.0) * 100);

                characterStatsList.innerHTML = `
                    <div class="stat-item" title="${breakdowns.maxHp.replace(/\n/g, '&#10;')}">
                        <span class="stat-label">Max HP:</span>
                        <span class="stat-value">${character.maxHp || 100}</span>
                    </div>
                    <div class="stat-item" title="${breakdowns.maxMana.replace(/\n/g, '&#10;')}">
                        <span class="stat-label">Max Mana:</span>
                        <span class="stat-value">${character.maxMana || 50}</span>
                    </div>
                    <div class="stat-item" title="${breakdowns.meleeAttack.replace(/\n/g, '&#10;')}">
                        <span class="stat-label">Melee Attack:</span>
                        <span class="stat-value">${meleeAttackPercent}%</span>
                    </div>
                    <div class="stat-item" title="${breakdowns.rangedAttack.replace(/\n/g, '&#10;')}">
                        <span class="stat-label">Ranged Attack:</span>
                        <span class="stat-value">${rangedAttackPercent}%</span>
                    </div>
                    <div class="stat-item" title="${breakdowns.magicAttack.replace(/\n/g, '&#10;')}">
                        <span class="stat-label">Magic Attack:</span>
                        <span class="stat-value">${magicAttackPercent}%</span>
                    </div>
                    <div class="stat-item" title="${breakdowns.defense.replace(/\n/g, '&#10;')}">
                        <span class="stat-label">Defense:</span>
                        <span class="stat-value">${character.defense || 0}</span>
                    </div>
                    <div class="stat-item" title="${breakdowns.evasion.replace(/\n/g, '&#10;')}">
                        <span class="stat-label">Evasion:</span>
                        <span class="stat-value">${(character.evasion || 0).toFixed(1)}%</span>
                    </div>
                    <div class="stat-item" title="${breakdowns.critChance.replace(/\n/g, '&#10;')}">
                        <span class="stat-label">Crit Chance:</span>
                        <span class="stat-value">${(character.critChance || 0).toFixed(1)}%</span>
                    </div>
                    <div class="stat-item" title="${breakdowns.carryCapacity.replace(/\n/g, '&#10;')}">
                        <span class="stat-label">Carry Capacity:</span>
                        <span class="stat-value">${character.carryCapacity || 40} lbs</span>
                    </div>
                `;
            } else {
                characterStatsList.innerHTML = '<p class="empty-message">No character data available</p>';
            }
        }

        // Render general stats (character progression)
        const generalStatsList = document.getElementById('general-stats-list');
        if (generalStatsList) {
            const character = window.GameState?.getState().character;
            if (character) {
                // Get XP progress
                const xpProgress = window.Character?.getXPProgress(character) || { current: 0, needed: 100, percentage: 0 };

                // Get character stats (if they exist)
                const charStats = character.stats || {};

                generalStatsList.innerHTML = `
                    <!-- Character Level with XP Bar -->
                    <div class="stat-item character-level">
                        <div class="level-display-row">
                            <span class="stat-label">Level:</span>
                            <span class="stat-value level-value">${character.level || 1}</span>
                        </div>
                        <div class="xp-bar">
                            <div class="xp-fill" style="width: ${xpProgress.percentage}%"></div>
                        </div>
                        <div class="xp-text">${xpProgress.current} / ${xpProgress.needed} XP</div>
                    </div>

                    <!-- Character Attributes -->
                    <div class="stat-item attributes-section">
                        <div class="stat-label">
                            Attributes
                            ${character.attributePoints > 0 ? `<span class="attribute-points-badge">(${character.attributePoints})</span>` : ''}
                        </div>
                        <div class="attributes-list">
                            ${renderAttributeRow(character, 'strength', 'STR', charStats.strength || 0)}
                            ${renderAttributeRow(character, 'dexterity', 'DEX', charStats.dexterity || 0)}
                            ${renderAttributeRow(character, 'constitution', 'CON', charStats.constitution || 0)}
                            ${renderAttributeRow(character, 'intelligence', 'INT', charStats.intelligence || 0)}
                            ${renderAttributeRow(character, 'wisdom', 'WIS', charStats.wisdom || 0)}
                            ${renderAttributeRow(character, 'charisma', 'CHA', charStats.charisma || 0)}
                        </div>
                    </div>
                `;
            } else {
                generalStatsList.innerHTML = '<p class="empty-message">No character data available</p>';
            }
        }
    }

    // Render an attribute row with + button if points available
    function renderAttributeRow(character, attributeKey, attributeName, value) {
        const hasPoints = character.attributePoints > 0;
        const buttonHtml = hasPoints ?
            `<button class="attribute-plus-btn" data-attribute="${attributeKey}" title="Spend 1 attribute point">+</button>` :
            '';

        return `
            <div class="attribute-item">
                <span class="attribute-name">${attributeName}:</span>
                <span class="attribute-value">${value}</span>
                ${buttonHtml}
            </div>
        `;
    }

    // Handle attribute point spending
    function handleAttributePointSpend(attributeName) {
        const character = window.GameState?.getState().character;
        if (!character) return;

        const result = window.Character.spendAttributePoint(character, attributeName);
        if (result.success) {
            // Update UI
            render();

            // Update top bar
            if (window.updateTopBar) {
                updateTopBar(character);
            }

            // Show feedback
            if (window.ActivityLog) {
                ActivityLog.addMessage(`Increased ${attributeName} by 1!`, 'success');
            }
        } else {
            // Show error
            if (window.ActivityLog) {
                ActivityLog.addMessage(result.error, 'error');
            }
        }
    }

    // Set up event listeners for attribute buttons
    function setupAttributeButtons() {
        const buttons = document.querySelectorAll('.attribute-plus-btn');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const attributeName = button.getAttribute('data-attribute');
                handleAttributePointSpend(attributeName);
            });
        });
    }

    return {
        init,
        render,
        setupAttributeButtons
    };
})();

window.CharacterUI = CharacterUI;
