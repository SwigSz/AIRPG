// ============================================
// Game UI Framework - Main Entry Point
// ============================================

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize core systems
    if (window.GameState) GameState.init();
    if (window.EventSystem) EventSystem.init();
    if (window.TimeManager) TimeManager.init();

    // Initialize stats tracker
    if (window.StatsTracker) StatsTracker.init();

    // Initialize data systems (load from JSON)
    if (window.EnemyDatabase) await EnemyDatabase.init();
    if (window.AbilityManager) await AbilityManager.init();
    if (window.SkillManager) await SkillManager.init();

    // Initialize UI systems
    if (window.UIManager) {
        UIManager.init();
    } else {
        // Fallback to individual initialization
        if (window.TabManager) TabManager.init();
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

    // Initialize save/load button event listeners
    initializeSaveLoadControls();

    // Start autosave (every 30 seconds)
    if (window.SaveSystem) {
        SaveSystem.startAutosave(30);
    }

    // Try to load existing save data
    if (SaveSystem.hasSave()) {
        const savedState = SaveSystem.load();
        if (savedState && savedState.character) {
            GameState.setState(savedState);
            displayCharacterData();

            // Restore combat if it was active
            if (window.CombatManager && savedState.combat && savedState.combat.isActive) {
                CombatManager.restoreCombatState();
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
        level: 5,
        xp: 250,
        xpToNext: 500
    });

    // Create all placeholder items for inventory
    const placeholderItems = Items.createAllPlaceholderItems();

    // Create test character with proper inventory and equipment structure
    const testCharacter = Character.create('Test Hero', {
        age: 25,
        skills: [woodcuttingSkill],
        inventory: Inventory.create(),
        equipment: Equipment.create(),
        stats: {
            strength: 10,
            dexterity: 8,
            constitution: 12,
            intelligence: 7,
            wisdom: 6,
            charisma: 9
        }
    });

    // Add placeholder items to inventory
    placeholderItems.forEach(item => {
        Inventory.addItem(testCharacter.inventory, item);
    });

    // Add crafting test items (individual items that will stack in the UI)
    const stick1 = Items.createItem('Stick', null, {
        classifications: ['material'],
        description: 'A sturdy stick.',
        icon: '🪵'
    });
    const stick2 = Items.createItem('Stick', null, {
        classifications: ['material'],
        description: 'A sturdy stick.',
        icon: '🪵'
    });
    const rock1 = Items.createItem('Rock', null, {
        classifications: ['material'],
        description: 'A heavy rock.',
        icon: '🪨'
    });
    const rock2 = Items.createItem('Rock', null, {
        classifications: ['material'],
        description: 'A heavy rock.',
        icon: '🪨'
    });

    // Add test greatsword
    const greatsword = Items.createItem('Greatsword', null, {
        classifications: ['weapon', 'two-handed'],
        description: 'A massive two-handed sword that deals devastating damage.',
        icon: '⚔️',
        stats: { damage: 30, weight: 12 }
    });

    Inventory.addItem(testCharacter.inventory, stick1);
    Inventory.addItem(testCharacter.inventory, stick2);
    Inventory.addItem(testCharacter.inventory, rock1);
    Inventory.addItem(testCharacter.inventory, rock2);
    Inventory.addItem(testCharacter.inventory, greatsword);

    // Store in game state
    GameState.updateProperty('character', testCharacter);

    // Create test settlement
    const testSettlement = Settlement.create('New Haven');
    GameState.updateProperty('settlement', testSettlement);
    Settlement.setState(testSettlement);

    // Display character data
    displayCharacterData();

    // Auto-save the initial character
    SaveSystem.save();
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

    // Render mini inventory if crafting module is available
    if (window.Crafting) {
        Crafting.renderMiniInventory();
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

    // Update XP bar in character tab
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

    // Update character stats in character tab
    updateCharacterStats(character);
}

// Update character stats display in character tab
function updateCharacterStats(character) {
    const statsList = document.querySelector('.stats-list');
    if (!statsList || !character.stats) return;

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

// Render inventory grid (dynamic slots based on items)
function renderInventoryUI() {
    const character = GameState.getState().character;
    if (!character) return;

    const inventoryGrid = document.getElementById('inventory-grid');
    inventoryGrid.innerHTML = '';

    // Get stacked items from inventory
    const stacks = Inventory.getStackedItems(character.inventory);

    // Create slots for each stack
    stacks.forEach((stack, index) => {
        const slot = document.createElement('div');
        slot.className = 'inventory-slot';
        slot.dataset.slotIndex = index;

        renderItemInSlot(slot, stack.item, 'inventory', stack);
        inventoryGrid.appendChild(slot);
    });

    // Always update mini inventory when inventory changes
    if (window.Crafting) {
        Crafting.renderMiniInventory();
    }
}

// Render equipment slots
function renderEquipmentUI() {
    const character = GameState.getState().character;
    if (!character) return;

    const equipmentSlotsContainer = document.querySelector('.equipment-slots');
    equipmentSlotsContainer.innerHTML = '';

    // Define slot order and labels
    const slots = [
        { key: 'head', label: 'Head' },
        { key: 'neck', label: 'Neck' },
        { key: 'chest', label: 'Chest' },
        { key: 'hands', label: 'Hands' },
        { key: 'legs', label: 'Legs' },
        { key: 'feet', label: 'Feet' },
        { key: 'main_hand', label: 'Main Hand' },
        { key: 'off_hand', label: 'Off Hand' },
        { key: 'ring1', label: 'Ring 1' },
        { key: 'ring2', label: 'Ring 2' },
        { key: 'cloak', label: 'Cloak' }
    ];

    // Check if main hand has a two-handed weapon
    const mainHandItem = character.equipment.main_hand;
    const isTwoHandedEquipped = mainHandItem && mainHandItem.classifications && mainHandItem.classifications.includes('two-handed');

    slots.forEach(({ key, label }) => {
        // Skip off_hand slot if two-handed weapon is equipped
        if (key === 'off_hand' && isTwoHandedEquipped) {
            return;
        }

        const item = character.equipment[key];
        const slotElement = document.createElement('div');
        slotElement.dataset.slot = key;

        if (item) {
            slotElement.className = 'equipment-slot occupied';

            // Special rendering for two-handed weapons in main hand
            if (key === 'main_hand' && isTwoHandedEquipped) {
                renderItemInSlot(slotElement, item, 'equipment', null, key, true);
            } else {
                renderItemInSlot(slotElement, item, 'equipment', null, key);
            }
        } else {
            slotElement.className = 'equipment-slot empty';
            slotElement.textContent = label;
        }

        equipmentSlotsContainer.appendChild(slotElement);
    });
}

// Render an item in a slot
function renderItemInSlot(slotElement, item, context, stack = null, equipSlot = null, isTwoHanded = false) {
    slotElement.classList.remove('empty');

    if (context === 'equipment') {
        slotElement.classList.add('occupied');

        // Get the slot label - show "Both Hands" for two-handed weapons
        let slotLabel = equipSlot ? equipSlot.replace('_', ' ') : '';
        if (isTwoHanded) {
            slotLabel = 'Both Hands';
        }

        slotElement.innerHTML = `
            <div class="equipment-slot-content">
                <span class="equipment-slot-icon">${item.icon}</span>
                <div class="equipment-slot-info">
                    <div class="equipment-slot-name">${item.name}</div>
                    <div class="equipment-slot-label">${slotLabel}</div>
                </div>
            </div>
            <div class="item-actions">
                <button class="item-action-btn unequip" data-action="unequip">Unequip</button>
                <button class="item-action-btn toss" data-action="toss">Toss</button>
                <button class="item-action-btn info" data-action="info">Info</button>
            </div>
        `;

        // Store item ID in dataset
        slotElement.dataset.itemId = item.id;

        // Attach event listeners to buttons
        const actionsDiv = slotElement.querySelector('.item-actions');
        attachItemEventListeners(actionsDiv, item, context, equipSlot, stack);
    } else {
        // Display quantity if it's a stack with multiple items
        const displayName = stack && stack.quantity > 1
            ? `${item.name} x${stack.quantity}`
            : item.name;

        slotElement.innerHTML = `
            <div class="item-card">
                <span class="item-icon">${item.icon}</span>
                <span class="item-name">${displayName}</span>
            </div>
            <div class="item-actions">
                <button class="item-action-btn equip" data-action="equip">Equip</button>
                <button class="item-action-btn toss" data-action="toss">Toss</button>
                <button class="item-action-btn info" data-action="info">Info</button>
            </div>
        `;

        // Store item ID in dataset (use first item in stack)
        slotElement.dataset.itemId = item.id;

        // Attach event listeners to buttons
        const actionsDiv = slotElement.querySelector('.item-actions');
        attachItemEventListeners(actionsDiv, item, context, null, stack);
    }
}

// Attach event listeners to item action buttons
function attachItemEventListeners(actionsDiv, item, context, slot = null, stack = null) {
    // Get all action buttons
    const actionButtons = actionsDiv.querySelectorAll('.item-action-btn');

    actionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = button.dataset.action;

            switch(action) {
                case 'equip':
                    equipItemFromInventory(item.id);
                    break;
                case 'unequip':
                    unequipItemToInventory(slot);
                    break;
                case 'toss':
                    discardItem(item.id, context, slot, stack);
                    break;
                case 'info':
                    showItemDetailsModal(item);
                    break;
            }
        });
    });
}

// Equip item from inventory
function equipItemFromInventory(itemId) {
    const character = GameState.getState().character;
    if (!character) return;

    const success = Inventory.equipItemFromInventory(character, itemId);
    if (success) {
        // Update UI
        renderInventoryUI();
        renderEquipmentUI();

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
        // Update UI
        renderInventoryUI();
        renderEquipmentUI();

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

// Show Item Details Modal
function showItemDetailsModal(item) {
    const modal = document.getElementById('item-details-modal');
    const modalName = document.getElementById('modal-item-name');
    const modalDescription = document.getElementById('modal-item-description');
    const modalStatsContent = document.getElementById('modal-stats-content');

    // Set content
    modalName.textContent = item.name;
    modalDescription.textContent = item.description;

    // Build stats HTML
    let statsHTML = '';
    if (item.stats && Object.keys(item.stats).length > 0) {
        for (const [key, value] of Object.entries(item.stats)) {
            const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
            statsHTML += `<div><strong>${capitalizedKey}:</strong> ${value}</div>`;
        }
    }

    // Display classifications instead of type
    if (item.classifications && item.classifications.length > 0) {
        const formattedClassifications = item.classifications.map(c => {
            // Capitalize and replace underscores with spaces
            return c.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('-');
        }).join(', ');
        statsHTML += `<div><strong>Type:</strong> ${formattedClassifications}</div>`;
    }

    modalStatsContent.innerHTML = statsHTML;

    // Show modal
    modal.style.display = 'flex';
}

// Close modal when clicking X or outside
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('item-details-modal');
    const closeBtn = modal.querySelector('.modal-close');

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });
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
