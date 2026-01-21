// ============================================
// Character UI Manager - Skills, Abilities, Stats
// ============================================

const CharacterUI = (() => {
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
                    <button class="character-tab-btn active" data-char-tab="stats">
                        <span class="tab-icon">📊</span>
                        <span class="tab-label">Stats</span>
                    </button>
                    <button class="character-tab-btn" data-char-tab="abilities">
                        <span class="tab-icon">⚡</span>
                        <span class="tab-label">Abilities</span>
                    </button>
                    <button class="character-tab-btn" data-char-tab="powers">
                        <span class="tab-icon">✨</span>
                        <span class="tab-label">Powers</span>
                    </button>
                    <button class="character-tab-btn" data-char-tab="progression">
                        <span class="tab-icon">📈</span>
                        <span class="tab-label">Skills</span>
                    </button>
                </div>

                <!-- Tab Content Area -->
                <div class="character-tab-content-area">
                    <!-- Stats Tab -->
                    <div class="character-tab-content active" id="stats-tab-content">
                        <h2>Character Statistics</h2>
                        <div class="stats-categories">
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

                    <!-- Abilities Tab -->
                    <div class="character-tab-content" id="abilities-tab-content">
                        <h2>Abilities</h2>
                        <div class="abilities-grid" id="abilities-grid">
                            <!-- Abilities will be rendered here -->
                        </div>
                    </div>

                    <!-- Powers Tab (formerly Skills) -->
                    <div class="character-tab-content" id="powers-tab-content">
                        <h2>Powers</h2>
                        <div class="powers-grid" id="powers-grid">
                            <!-- Powers will be rendered here -->
                        </div>
                    </div>

                    <!-- Progression Skills Tab (NEW) -->
                    <div class="character-tab-content" id="progression-tab-content">
                        <div class="progression-skills-layout">
                            <div class="skill-list-panel">
                                <h3>Skills</h3>
                                <div class="skill-list" id="skill-list">
                                    <!-- Skill list will be rendered here -->
                                </div>
                            </div>
                            <div class="skill-details-panel">
                                <div id="skill-details">
                                    <p class="empty-message">Select a skill to view details</p>
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
        // Initialize sub-tab system using centralized SubTabManager
        if (window.SubTabManager) {
            SubTabManager.initSubTabs(
                'character',                       // Parent tab name
                '.character-tab-btn',              // Button selector
                '.character-tab-content',          // Content selector
                'data-char-tab',                   // Data attribute
                '',                                // Content ID prefix (empty because IDs are like 'skills-tab-content')
                '-tab-content',                    // Content ID suffix
                render                             // Callback on tab change
            );
        }
    }

    // Switch between character tabs
    function switchTab(tabName) {
        // Use centralized SubTabManager to switch tabs
        if (window.SubTabManager) {
            SubTabManager.switchSubTab(
                'character',
                tabName,
                '.character-tab-btn',
                '.character-tab-content',
                'data-char-tab',
                '',
                '-tab-content',
                render
            );
        }
    }

    // Main render function
    function render() {
        // Get current active tab from SubTabManager
        const activeTab = window.SubTabManager?.getCurrentSubTab('character') || 'stats';

        if (activeTab === 'stats') {
            renderStats();
            // Set up attribute buttons after rendering stats
            setTimeout(() => setupAttributeButtons(), 0);
        } else if (activeTab === 'abilities') {
            renderAbilities();
        } else if (activeTab === 'powers') {
            renderPowers();
        } else if (activeTab === 'progression') {
            renderProgression();
        }
    }

    // Render powers (formerly skills)
    function renderPowers() {
        const powersGrid = document.getElementById('powers-grid');
        if (!powersGrid) return;

        powersGrid.innerHTML = '';

        if (!window.PowerManager) {
            powersGrid.innerHTML = '<p class="empty-message">Power system not loaded</p>';
            return;
        }

        const allPowers = PowerManager.getAllPowers();
        const earnedPowers = allPowers.filter(power => power.earned);

        if (earnedPowers.length === 0) {
            powersGrid.innerHTML = '<p class="empty-message">No powers earned yet. Earn your first power by crafting an item!</p>';
            return;
        }

        earnedPowers.forEach(power => {
            const powerCard = createPowerCard(power);
            powersGrid.appendChild(powerCard);
        });
    }

    // Create a power card element
    function createPowerCard(power) {
        const card = document.createElement('div');
        card.className = 'skill-card'; // Reuse skill-card styles

        card.innerHTML = `
            <div class="skill-icon">${power.icon || '✨'}</div>
            <div class="skill-name">${power.name}</div>
            <div class="skill-category">${power.category || ''}</div>
        `;

        // Add hover tooltip
        card.addEventListener('mouseenter', () => {
            if (window.TooltipManager) {
                const tooltipData = {
                    ...power,
                    unlockDescription: power.unlockConditions ?
                        window.ConditionEvaluator?.describeCondition(power.unlockConditions) : null
                };
                TooltipManager.showTooltip(card, tooltipData, 'power');
            }
        });

        card.addEventListener('mouseleave', () => {
            if (window.TooltipManager) {
                TooltipManager.hideTooltip();
            }
        });

        return card;
    }

    // Render progression skills (NEW SYSTEM)
    function renderProgression() {
        if (!window.SkillManager) {
            const skillList = document.getElementById('skill-list');
            if (skillList) {
                skillList.innerHTML = '<p class="empty-message">Skill system not loaded</p>';
            }
            return;
        }

        renderSkillList();
    }

    // Render skill list
    function renderSkillList() {
        const skillListContainer = document.getElementById('skill-list');
        if (!skillListContainer) return;

        const character = window.GameState?.getState()?.character;
        if (!character || !character.skills) {
            skillListContainer.innerHTML = '<p class="empty-message">No skills unlocked yet.<br><br>Earn XP to unlock skills!</p>';
            return;
        }

        skillListContainer.innerHTML = '';

        // Get only unlocked skills (skills that exist in character.skills)
        const allSkills = SkillManager.getAllSkills();
        const unlockedSkills = allSkills
            .filter(skill => character.skills[skill.id] !== undefined)
            .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

        if (unlockedSkills.length === 0) {
            skillListContainer.innerHTML = '<p class="empty-message">No skills unlocked yet.<br><br>Earn XP to unlock skills!</p>';
            return;
        }

        unlockedSkills.forEach(skill => {
            const skillData = character.skills[skill.id];

            const skillRow = document.createElement('div');
            skillRow.className = 'skill-row';
            skillRow.dataset.skillId = skill.id;

            skillRow.innerHTML = `
                <span class="skill-row-name">${skill.name}</span>
                <span class="skill-row-level">Lv. ${skillData.level}</span>
            `;

            skillRow.addEventListener('click', () => {
                // Remove active class from all rows
                document.querySelectorAll('.skill-row').forEach(row => row.classList.remove('active'));
                // Add active class to clicked row
                skillRow.classList.add('active');
                // Render details for this skill
                renderSkillDetails(skill, skillData);
            });

            skillListContainer.appendChild(skillRow);
        });

        // Auto-select first skill if available
        if (unlockedSkills.length > 0) {
            const firstSkillRow = skillListContainer.querySelector('.skill-row');
            if (firstSkillRow) {
                firstSkillRow.click();
            }
        }
    }

    // Render skill details panel
    function renderSkillDetails(skill, skillData) {
        const detailsContainer = document.getElementById('skill-details');
        if (!detailsContainer) return;

        const levelInfo = SkillManager.getLevelInfo(skillData.xp, skill.id);
        const xpForNext = levelInfo.xpForNextLevel - skillData.xp;
        const xpProgress = ((skillData.xp - levelInfo.xpForCurrentLevel) / (levelInfo.xpForNextLevel - levelInfo.xpForCurrentLevel)) * 100;

        detailsContainer.innerHTML = `
            <div class="skill-detail-header">
                <div class="skill-detail-icon">${skill.icon}</div>
                <div class="skill-detail-title">
                    <h3>${skill.name}</h3>
                    <p class="skill-detail-description">${skill.description || 'No description available'}</p>
                </div>
            </div>

            <div class="skill-detail-level">
                <h4>Level ${levelInfo.level}</h4>
                <div class="skill-xp-info">
                    <span>${skillData.xp.toLocaleString()} / ${levelInfo.xpForNextLevel.toLocaleString()} XP</span>
                    <span>${Math.floor(xpProgress)}%</span>
                </div>
                <div class="skill-xp-bar">
                    <div class="skill-xp-fill" style="width: ${xpProgress}%"></div>
                </div>
                <p class="xp-remaining">${xpForNext.toLocaleString()} XP until level ${levelInfo.level + 1}</p>
            </div>

            <div class="skill-detail-bonuses">
                <h4>Bonuses</h4>
                <div class="bonuses-list">
                    ${renderSkillBonuses(skill, levelInfo.level)}
                </div>
            </div>
        `;
    }

    // Render skill bonuses
    function renderSkillBonuses(skill, level) {
        const bonuses = SkillManager.getSkillBonuses(skill.id, level);

        if (!bonuses || bonuses.length === 0) {
            return '<p class="empty-message">No bonuses available yet</p>';
        }

        return bonuses.map(bonus => `
            <div class="bonus-item">
                <span class="bonus-icon">${bonus.icon || '+'}</span>
                <span class="bonus-text">${bonus.description}</span>
            </div>
        `).join('');
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

        // Render character stats
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

        // Get calculated stats to show equipment bonuses
        const calculated = window.CharacterStats ? CharacterStats.calculate(character) : null;
        const equipBonus = calculated?.equipmentBonuses?.[attributeKey] || 0;

        // Format: "BaseValue" or "BaseValue (+Bonus)"
        let displayValue = value.toString();
        if (equipBonus > 0) {
            displayValue = `${value} <span class="equipment-bonus">(+${equipBonus})</span>`;
        }

        return `
            <div class="attribute-item">
                <span class="attribute-name">${attributeName}:</span>
                <span class="attribute-value">${displayValue}</span>
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
