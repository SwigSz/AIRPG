// ============================================
// Game UI Framework - Main Entry Point
// ============================================

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize core systems
    if (window.GameState) GameState.init();
    if (window.EventSystem) EventSystem.init();
    if (window.TimeManager) TimeManager.init();
    if (window.TimeSystem) TimeSystem.init();

    // Initialize stats tracker
    if (window.StatsTracker) StatsTracker.init();

    // Initialize data systems (load from JSON)
    if (window.ItemFactory) await ItemFactory.init();
    if (window.EnemyDatabase) await EnemyDatabase.init();
    if (window.AbilityManager) await AbilityManager.init();
    if (window.SkillManager) await SkillManager.init();
    if (window.LootManager) await LootManager.init();
    if (window.Smithing) await Smithing.init();

    // Initialize UI systems (but NOT TabManager yet - wait until after save load)
    if (window.UIManager) {
        UIManager.init();
    } else {
        // Fallback to individual initialization
        // TabManager.init() will be called AFTER save data is loaded
        if (window.CombatUI) CombatUI.init();
    }

    // Initialize tooltip and notification systems
    if (window.TooltipManager) TooltipManager.init();
    if (window.NotificationManager) NotificationManager.init();

    // Initialize character UI
    if (window.CharacterUI) CharacterUI.init();

    // Initialize combat manager
    if (window.CombatManager) CombatManager.init();

    // Initialize crafting system
    if (window.Crafting) await Crafting.init();

    // Initialize settlement system
    if (window.Settlement) await Settlement.init();

    // Initialize research tree system
    if (window.Research) await Research.init();

    // Initialize map system
    if (window.Map) Map.init();

    // Initialize save/load button event listeners
    initializeSaveLoadControls();

    // Initialize debug menu (after character is loaded)
    // Will be initialized after character load
    if (window.DebugMenu) {
        // Wait for character to be available
        setTimeout(() => {
            const character = GameState.getState().character;
            if (character) {
                DebugMenu.init(character);
            }
        }, 100);
    }

    // Start autosave (every 30 seconds)
    if (window.SaveSystem) {
        SaveSystem.startAutosave(30);
    }

    // Try to load existing save data
    if (SaveSystem.hasSave()) {
        const savedState = SaveSystem.load();
        if (savedState && savedState.character) {
            GameState.setState(savedState);

            // Recalculate stats after loading (in case formulas changed)
            if (window.CharacterStats && savedState.character) {
                CharacterStats.applyToCharacter(savedState.character);
            }

            displayCharacterData();

            // Check for ability unlocks (in case new abilities were added or conditions changed)
            if (window.AbilityManager) {
                AbilityManager.checkAndUnlockAbilities();
            }

            // Restore time system state
            if (window.TimeSystem && savedState.time) {
                TimeSystem.loadSaveData(savedState.time);
            }

            // Restore settlement state for time system
            if (window.TimeSystem && savedState.character && savedState.character.inSettlement) {
                TimeSystem.setInSettlement(true);
            }

            // Restore map state (player position and resources)
            if (window.Map && window.Map.restoreState) {
                Map.restoreState();
            }

            // Restore combat if it was active
            if (window.CombatManager && savedState.combat && savedState.combat.isActive) {
                CombatManager.restoreCombatState();
            }

            // Initialize TabManager AFTER settlement state is restored
            if (window.TabManager) TabManager.init();

            // Restore sub-tabs for all parent tabs (must happen after save load)
            if (window.SubTabManager) {
                // Character sub-tabs (with render callback from CharacterUI)
                if (window.CharacterUI && window.CharacterUI.render) {
                    SubTabManager.restoreSubTab('character', '.character-tab-btn', '.character-tab-content', 'data-char-tab', '', '-tab-content', window.CharacterUI.render);
                } else {
                    SubTabManager.restoreSubTab('character', '.character-tab-btn', '.character-tab-content', 'data-char-tab', '', '-tab-content', null);
                }

                // Settlement sub-tabs (with updateUI callback from Settlement)
                if (window.Settlement && window.Settlement.updateUI) {
                    SubTabManager.restoreSubTab('settlement', '.settlement-nav-tab', '.settlement-tab-content', 'data-settlement-tab', 'settlement-', '-content', window.Settlement.updateUI);
                } else {
                    SubTabManager.restoreSubTab('settlement', '.settlement-nav-tab', '.settlement-tab-content', 'data-settlement-tab', 'settlement-', '-content', null);
                }

                // Crafting sub-tabs (no callback needed)
                SubTabManager.restoreSubTab('crafting', '.crafting-nav-tab', '.crafting-tab-content', 'data-crafting-tab', 'crafting-', '-content', null);
            }

            // Mark tabs as ready to prevent flash on load
            document.body.classList.add('tabs-ready');

            // Check research nodes after loading save (crafting history is now loaded)
            if (window.Research && window.Research.checkAndAutoCompleteNodes) {
                Research.checkAndAutoCompleteNodes();
            }

            // Refresh crafting category states from save data
            if (window.Crafting && window.Crafting.refreshFromSaveData) {
                Crafting.refreshFromSaveData();
            }

            // Reload smithing coal pit state from save data
            if (window.Smithing && window.Smithing.loadCoalPitState) {
                Smithing.loadCoalPitState();
            }

            // Refresh smithing category states from save data
            if (window.SmithingUI && window.SmithingUI.refreshFromSaveData) {
                SmithingUI.refreshFromSaveData();
            }
        } else {
            // Failed to load or no character, create test character
            console.log('No character in saved state, creating new character...');
            initializeTestCharacter();
        }
    } else {
        // No save data, create test character
        console.log('No save data found, creating new character...');
        initializeTestCharacter();
    }
});

// Initialize Test Character with Test Data
function initializeTestCharacter() {
    // Create test skill
    const woodcuttingSkill = Skills.createSkill('Woodcutting', {
        level: 1,
        xp: 0,
        xpToNext: 100
    });

    // Create all placeholder items for inventory
    const placeholderItems = Items.createAllPlaceholderItems();

    // Create test character with proper inventory and equipment structure
    const testCharacter = Character.create('Test Hero', {
        age: 25,
        level: 1,
        skills: [woodcuttingSkill],
        inventory: Inventory.create(),
        equipment: Equipment.create()
        // Stats will default to 0 for all attributes
    });

    // Add placeholder items to inventory
    placeholderItems.forEach(item => {
        Inventory.addItem(testCharacter.inventory, item);
    });

    // Add starting consumable items
    if (window.ItemFactory) {
        // Add health potions
        for (let i = 0; i < 5; i++) {
            const healthPotion = ItemFactory.createItem('health_potion');
            if (healthPotion) Inventory.addItem(testCharacter.inventory, healthPotion);
        }

        // Add mana potions
        for (let i = 0; i < 3; i++) {
            const manaPotion = ItemFactory.createItem('mana_potion');
            if (manaPotion) Inventory.addItem(testCharacter.inventory, manaPotion);
        }

        // Add greater health potion
        const greaterHealthPotion = ItemFactory.createItem('greater_health_potion');
        if (greaterHealthPotion) Inventory.addItem(testCharacter.inventory, greaterHealthPotion);

        // Add elixirs
        const strengthElixir = ItemFactory.createItem('elixir_of_strength');
        if (strengthElixir) Inventory.addItem(testCharacter.inventory, strengthElixir);

        const defenseElixir = ItemFactory.createItem('elixir_of_defense');
        if (defenseElixir) Inventory.addItem(testCharacter.inventory, defenseElixir);
    }

    // Add test greatsword from ItemFactory (uses proper item ID)
    const greatsword = ItemFactory.createItem('greatsword');
    if (greatsword) {
        Inventory.addItem(testCharacter.inventory, greatsword);
    }

    // Add ranged weapons for testing
    const shortbow = ItemFactory.createItem('shortbow');
    if (shortbow) {
        Inventory.addItem(testCharacter.inventory, shortbow);
    }

    const huntingBow = ItemFactory.createItem('hunting_bow');
    if (huntingBow) {
        Inventory.addItem(testCharacter.inventory, huntingBow);
    }

    const crossbow = ItemFactory.createItem('crossbow');
    if (crossbow) {
        Inventory.addItem(testCharacter.inventory, crossbow);
    }

    // Add magic weapons for testing
    const woodenWand = ItemFactory.createItem('wooden_wand');
    if (woodenWand) {
        Inventory.addItem(testCharacter.inventory, woodenWand);
    }

    const crystalStaff = ItemFactory.createItem('crystal_staff');
    if (crystalStaff) {
        Inventory.addItem(testCharacter.inventory, crystalStaff);
    }

    const arcaneTome = ItemFactory.createItem('arcane_tome');
    if (arcaneTome) {
        Inventory.addItem(testCharacter.inventory, arcaneTome);
    }

    // Add crafting materials for testing
    const materials = ['stick', 'rock', 'fiber', 'leather', 'wolf_pelt', 'raw_meat', 'bone'];
    materials.forEach(materialId => {
        // Add multiple of each material for testing stacking
        for (let i = 0; i < 5; i++) {
            const material = ItemFactory.createItem(materialId);
            if (material) {
                Inventory.addItem(testCharacter.inventory, material);
            }
        }
    });

    // Add smithing materials for testing
    // Copper ore for immediate smelting tests
    for (let i = 0; i < 3; i++) {
        const copperOre = ItemFactory.createItem('copper_ore');
        if (copperOre) {
            Inventory.addItem(testCharacter.inventory, copperOre);
        }
    }

    // Coal for fuel management testing
    for (let i = 0; i < 20; i++) {
        const coal = ItemFactory.createItem('coal');
        if (coal) {
            Inventory.addItem(testCharacter.inventory, coal);
        }
    }

    // Store in game state
    GameState.updateProperty('character', testCharacter);

    // Calculate initial stats (defense, HP, etc.)
    if (window.CharacterStats) {
        CharacterStats.applyToCharacter(testCharacter);
    }

    // Create test settlement
    const testSettlement = Settlement.create('New Haven');
    GameState.updateProperty('settlement', testSettlement);
    Settlement.setState(testSettlement);

    // Display character data
    displayCharacterData();

    // Check for initial ability unlocks
    if (window.AbilityManager) {
        AbilityManager.checkAndUnlockAbilities();
    }

    // Auto-save the initial character
    SaveSystem.save();

    // Initialize TabManager AFTER character is created
    if (window.TabManager) TabManager.init();

    // Restore sub-tabs for all parent tabs (for new characters, use defaults)
    if (window.SubTabManager) {
        // Character sub-tabs (with render callback from CharacterUI)
        if (window.CharacterUI && window.CharacterUI.render) {
            SubTabManager.restoreSubTab('character', '.character-tab-btn', '.character-tab-content', 'data-char-tab', '', '-tab-content', window.CharacterUI.render);
        } else {
            SubTabManager.restoreSubTab('character', '.character-tab-btn', '.character-tab-content', 'data-char-tab', '', '-tab-content', null);
        }

        // Settlement sub-tabs (with updateUI callback from Settlement)
        if (window.Settlement && window.Settlement.updateUI) {
            SubTabManager.restoreSubTab('settlement', '.settlement-nav-tab', '.settlement-tab-content', 'data-settlement-tab', 'settlement-', '-content', window.Settlement.updateUI);
        } else {
            SubTabManager.restoreSubTab('settlement', '.settlement-nav-tab', '.settlement-tab-content', 'data-settlement-tab', 'settlement-', '-content', null);
        }

        // Crafting sub-tabs (no callback needed)
        SubTabManager.restoreSubTab('crafting', '.crafting-nav-tab', '.crafting-tab-content', 'data-crafting-tab', 'crafting-', '-content', null);
    }

    // Mark tabs as ready to prevent flash on load
    document.body.classList.add('tabs-ready');
}

// Display Character Data in UI
function displayCharacterData() {
    const character = GameState.getState().character;
    if (!character) return;

    // Update top bar
    updateTopBar(character);

    // Display skills
    displaySkills(character.skills);

    // Display inventory and equipment
    renderInventoryUI();
    renderEquipmentUI();

    // Setup inventory controls (filter, search, sort)
    const inventoryGrid = document.getElementById('inventory-grid');
    if (inventoryGrid && window.InventoryUI) {
        InventoryUI.setupInventoryControls(inventoryGrid, character, handleItemAction);
    }

    // Render character UI if available
    if (window.CharacterUI) {
        CharacterUI.render();
    }

    // Update settlement UI if settlement exists
    const settlement = GameState.getState().settlement;
    if (window.Settlement && settlement) {
        Settlement.setState(settlement);
    }

    // Reload research state if Research module exists
    if (window.Research) {
        Research.reloadState();
    }
}

// Update Top Bar with Character Info
function updateTopBar(character) {
    // Update character name and meta info
    const nameEl = document.querySelector('.character-name');
    const genEl = document.querySelector('.generation');
    const ageEl = document.querySelector('.age');
    const levelEl = document.querySelector('.level');

    if (nameEl) nameEl.textContent = character.name;
    if (genEl) genEl.textContent = `Gen: --`;
    if (ageEl) ageEl.textContent = `Age: --`;
    if (levelEl) levelEl.textContent = `Lvl: ${character.level}`;

    // Initialize HP/Mana if they don't exist (for old saves)
    if (character.hp === undefined) character.hp = 100;
    if (character.maxHp === undefined) character.maxHp = 100;
    if (character.mana === undefined) character.mana = 10;
    if (character.maxMana === undefined) character.maxMana = 10;

    // Update Health Bar
    const healthBar = document.querySelector('.health-bar');
    const healthLabel = document.querySelector('#status-bars .status-bar-container:nth-child(1) label');
    if (healthBar) {
        const healthPercent = (character.hp / character.maxHp) * 100;
        healthBar.style.width = `${healthPercent}%`;
    }
    if (healthLabel) {
        healthLabel.textContent = `Health: ${character.hp}/${character.maxHp}`;
    }

    // Update Mana Bar
    const manaBar = document.querySelector('.mana-bar');
    const manaLabel = document.querySelector('#status-bars .status-bar-container:nth-child(2) label');
    if (manaBar) {
        const manaPercent = (character.mana / character.maxMana) * 100;
        manaBar.style.width = `${manaPercent}%`;
    }
    if (manaLabel) {
        manaLabel.textContent = `Mana: ${character.mana}/${character.maxMana}`;
    }

    // Update XP bar in OLD character tab (legacy support)
    const xpProgress = Character.getXPProgress(character);
    const characterLevelDisplay = document.getElementById('character-level-display');
    const characterXpBar = document.getElementById('character-xp-bar');
    const characterXpText = document.getElementById('character-xp-text');

    if (characterLevelDisplay) {
        characterLevelDisplay.textContent = character.level;
    }
    if (characterXpBar) {
        characterXpBar.style.width = `${xpProgress.percentage}%`;
    }
    if (characterXpText) {
        characterXpText.textContent = `${xpProgress.current} / ${xpProgress.needed} XP`;
    }

    // Update OLD character tab stats (legacy support - only updates the OLD character tab)
    updateOldCharacterTabStats(character);
}

// Update character stats display in OLD character tab ONLY (not the new CharacterUI Stats tab)
function updateOldCharacterTabStats(character) {
    // Only select stats-list that's a direct descendant of character-stats (the old location)
    const oldCharacterStats = document.querySelector('#character-tab .character-stats');
    if (!oldCharacterStats || !character.stats) return;

    const statsList = oldCharacterStats.querySelector('.stats-list');
    if (!statsList) return;

    const stats = character.stats;
    const statValues = statsList.querySelectorAll('.stat-value');

    if (statValues.length >= 6) {
        statValues[0].textContent = stats.strength || 0;
        statValues[1].textContent = stats.dexterity || 0;
        statValues[2].textContent = stats.constitution || 0;
        statValues[3].textContent = stats.intelligence || 0;
        statValues[4].textContent = stats.wisdom || 0;
        statValues[5].textContent = stats.charisma || 0;
    }
}

// Make updateTopBar globally accessible
window.updateTopBar = updateTopBar;

// Display Skills in Character Tab
function displaySkills(skills) {
    if (!skills || skills.length === 0) return;

    const skillsGrid = document.querySelector('.skills-grid');
    skillsGrid.innerHTML = ''; // Clear existing

    skills.forEach(skill => {
        const skillCard = document.createElement('div');
        skillCard.className = 'skill-card';
        skillCard.innerHTML = `
            <div class="skill-name">${skill.name}</div>
            <div class="skill-level">Level: ${skill.level}</div>
            <div class="skill-xp">${skill.xp} / ${skill.xpToNext} XP</div>
        `;
        skillsGrid.appendChild(skillCard);
    });
}

// ============================================
// INVENTORY UI SYSTEM
// ============================================
// ** All inventory rendering uses js/ui/inventory-ui.js **
// See CLAUDE.md and inventory-ui.js for documentation
// ============================================

// Render inventory grid (dynamic slots based on items)
function renderInventoryUI() {
    const character = GameState.getState().character;
    if (!character) return;

    const inventoryGrid = document.getElementById('inventory-grid');

    // Use InventoryUI module to render the grid
    InventoryUI.renderInventoryGrid(inventoryGrid, character, handleItemAction);
}

// Render equipment slots
function renderEquipmentUI() {
    const character = GameState.getState().character;
    if (!character) return;

    const equipmentSlotsContainer = document.querySelector('.equipment-slots');

    // Use InventoryUI module to render equipment slots
    InventoryUI.renderEquipmentSlots(equipmentSlotsContainer, character, handleItemAction);
}

// Handle item actions from InventoryUI callbacks
function handleItemAction(action, item, context, slot = null, stack = null) {
    switch(action) {
        case 'equip':
            equipItemFromInventory(item.id);
            break;
        case 'unequip':
            unequipItemToInventory(slot);
            break;
        case 'use':
            useConsumableItem(item.id);
            break;
        case 'toss':
            discardItem(item.id, context, slot, stack);
            break;
        case 'info':
            InventoryUI.showItemDetailsModal(item);
            break;
    }
}

// Equip item from inventory
function equipItemFromInventory(itemId) {
    const character = GameState.getState().character;
    if (!character) return;

    const success = Inventory.equipItemFromInventory(character, itemId);
    if (success) {
        // Recalculate derived stats
        if (window.CharacterStats) {
            CharacterStats.applyToCharacter(character);
        }

        // Update UI
        renderInventoryUI();
        renderEquipmentUI();
        updateTopBar(character);

        // Auto-save
        SaveSystem.save();
    }
}

// Unequip item to inventory
function unequipItemToInventory(slot) {
    const character = GameState.getState().character;
    if (!character) return;

    const success = Inventory.unequipItemToInventory(character, slot);
    if (success) {
        // Recalculate derived stats
        if (window.CharacterStats) {
            CharacterStats.applyToCharacter(character);
        }

        // Update UI
        renderInventoryUI();
        renderEquipmentUI();
        updateTopBar(character);

        // Auto-save
        SaveSystem.save();
    }
}

// Use consumable item from inventory
function useConsumableItem(itemId) {
    const character = GameState.getState().character;
    if (!character) return;

    // Get the item from inventory
    const item = Inventory.getItem(character.inventory, itemId);
    if (!item) {
        console.error('Item not found in inventory');
        return;
    }

    // Check if item is consumable
    if (!window.ConsumableManager || !ConsumableManager.isConsumable(item)) {
        ActivityLog.addMessage('This item cannot be used.', 'info');
        return;
    }

    // Check if we're in combat
    const combatState = window.CombatManager?.getCombatState();
    const inCombat = combatState && combatState.isActive;

    // If in combat and item is not usable in combat, prevent usage
    if (inCombat && !item.usableInCombat) {
        ActivityLog.addMessage('This item cannot be used in combat.', 'combat');
        return;
    }

    // Use the consumable
    const success = ConsumableManager.useConsumable(character, item, combatState);

    if (success) {
        // Update UI
        renderInventoryUI();

        // If in combat, update combat UI
        if (inCombat && window.CombatManager) {
            // Note: Consumables used outside of combat turns don't end the turn
            // If you want them to end the turn, add that logic in CombatManager
        }

        // Auto-save
        SaveSystem.save();
    }
}

// Discard item (remove from game)
function discardItem(itemId, context, slot, stack = null) {
    const character = GameState.getState().character;
    if (!character) return;

    // Check if confirmation is enabled
    const confirmToggle = document.getElementById('confirm-toss-toggle');
    const shouldConfirm = confirmToggle ? confirmToggle.checked : true;

    if (shouldConfirm) {
        // If it's a stack with multiple items, show quantity in confirmation
        let confirmMessage = 'Are you sure you want to discard this item? This action cannot be undone.';
        if (stack && stack.quantity > 1) {
            confirmMessage = `Discard one ${stack.item.name}? (${stack.quantity - 1} will remain)`;
        }

        const confirmed = confirm(confirmMessage);
        if (!confirmed) return;
    }

    if (context === 'inventory') {
        Inventory.removeItem(character.inventory, itemId);
    } else if (context === 'equipment') {
        Equipment.unequipItem(character.equipment, slot);
    }

    // Update UI
    renderInventoryUI();
    renderEquipmentUI();

    // Auto-save
    SaveSystem.save();
}

// Initialize inventory modal handlers (delegated to InventoryUI)
document.addEventListener('DOMContentLoaded', () => {
    InventoryUI.initModalHandlers();

    // Setup modal Discard and Close buttons
    const modal = document.getElementById('item-details-modal');
    const modalTossBtn = document.getElementById('modal-toss-btn');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    if (modalTossBtn) {
        modalTossBtn.addEventListener('click', () => {
            const itemId = modal.dataset.itemId;
            if (itemId) {
                // Get character and find item
                const character = GameState.getState().character;
                const item = Inventory.getItem(character.inventory, itemId);

                if (item) {
                    // Show confirmation dialog
                    const confirmToss = document.getElementById('confirm-toss-toggle')?.checked !== false;
                    if (confirmToss) {
                        if (!confirm(`Discard ${item.name}?`)) {
                            return;
                        }
                    }

                    // Discard the item
                    discardItem(itemId, 'inventory', null, null);

                    // Close modal
                    modal.style.display = 'none';
                }
            }
        });
    }

    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
});

// Save/Load Controls Initialization
function initializeSaveLoadControls() {
    const exportBtn = document.getElementById('export-save-btn');
    const importBtn = document.getElementById('import-save-btn');
    const wipeBtn = document.getElementById('wipe-save-btn');

    // Export button
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            SaveSystem.exportToFile();
        });
    }

    // Import button
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt';

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    SaveSystem.importFromFile(file)
                        .then(() => {
                            // Trigger UI updates without page reload
                            if (window.UIManager && UIManager.refresh) {
                                UIManager.refresh();
                            }
                            if (window.EventSystem) {
                                EventSystem.emit('game:loaded');
                            }
                        })
                        .catch((error) => {
                            console.error('Failed to import save file:', error);
                        });
                }
            };

            input.click();
        });
    }

    // Wipe data button
    if (wipeBtn) {
        wipeBtn.addEventListener('click', () => {
            const confirmed = confirm('Are you sure you want to wipe all save data? This action cannot be undone!');
            if (confirmed) {
                SaveSystem.wipeData();
                location.reload();
            }
        });
    }
}

// ============================================
// Debug Helper Functions (for testing)
// ============================================

// Function to give items to the player (accessible via browser console)
window.giveItem = function(itemId, quantity = 1) {
    const character = GameState.getState().character;
    if (!character) {
        console.error('No character found');
        return;
    }

    if (!window.ItemFactory) {
        console.error('ItemFactory not available');
        return;
    }

    for (let i = 0; i < quantity; i++) {
        const item = ItemFactory.createItem(itemId);
        if (item) {
            const success = Inventory.addItem(character.inventory, item);
            if (!success) {
                console.error(`Failed to add item ${i + 1}/${quantity} - inventory full`);
                break;
            }
        } else {
            console.error(`Failed to create item with id: ${itemId}`);
            return;
        }
    }

    console.log(`Added ${quantity}x ${itemId} to inventory`);

    // Update UI
    if (window.renderInventoryUI) {
        renderInventoryUI();
    }

    // Save
    if (window.SaveSystem) {
        SaveSystem.save();
    }
};

// Function to list all available item IDs
window.listItems = function() {
    if (!window.ItemFactory || !window.ItemFactory.getAllItemIds) {
        console.error('ItemFactory not available or missing getAllItemIds method');
        return;
    }

    const itemIds = ItemFactory.getAllItemIds();
    console.log('Available item IDs:');
    itemIds.forEach(id => console.log('  - ' + id));
};
