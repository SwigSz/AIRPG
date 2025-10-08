// ============================================
// Game UI Framework - Main Entry Point
// ============================================

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize core systems
    if (window.GameState) GameState.init();
    if (window.EventSystem) EventSystem.init();
    if (window.TimeManager) TimeManager.init();

    // Initialize UI systems
    if (window.UIManager) {
        UIManager.init();
    } else {
        // Fallback to individual initialization
        if (window.TabManager) TabManager.init();
        if (window.CombatUI) CombatUI.init();
    }

    // Initialize save/load button event listeners
    initializeSaveLoadControls();

    // Try to load existing save data
    if (SaveSystem.hasSave()) {
        const savedState = SaveSystem.load();
        if (savedState) {
            GameState.setState(savedState);
            displayCharacterData();

            // Restore combat if it was active
            if (window.CombatManager && savedState.combat && savedState.combat.isActive) {
                CombatManager.restoreCombatState();
            }
        } else {
            // Failed to load, create test character
            initializeTestCharacter();
        }
    } else {
        // No save data, create test character
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

    // Store in game state
    GameState.updateProperty('character', testCharacter);

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

    // Create slots only for items that exist
    character.inventory.items.forEach((item, index) => {
        const slot = document.createElement('div');
        slot.className = 'inventory-slot';
        slot.dataset.slotIndex = index;

        renderItemInSlot(slot, item, 'inventory');
        inventoryGrid.appendChild(slot);
    });
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

    slots.forEach(({ key, label }) => {
        const item = character.equipment[key];
        const slotElement = document.createElement('div');
        slotElement.dataset.slot = key;

        if (item) {
            slotElement.className = 'equipment-slot occupied';
            renderItemInSlot(slotElement, item, 'equipment');
        } else {
            slotElement.className = 'equipment-slot empty';
            slotElement.textContent = label;
        }

        equipmentSlotsContainer.appendChild(slotElement);
    });
}

// Render an item in a slot
function renderItemInSlot(slotElement, item, context) {
    slotElement.classList.remove('empty');

    if (context === 'equipment') {
        slotElement.classList.add('occupied');
        slotElement.innerHTML = `
            <div class="equipment-slot-content">
                <span class="equipment-slot-icon">${item.icon}</span>
                <div class="equipment-slot-info">
                    <div class="equipment-slot-name">${item.name}</div>
                    <div class="equipment-slot-label">${item.slot.replace('_', ' ')}</div>
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
        attachItemEventListeners(actionsDiv, item, context, item.slot);
    } else {
        slotElement.innerHTML = `
            <div class="item-card">
                <span class="item-icon">${item.icon}</span>
                <span class="item-name">${item.name}</span>
            </div>
            <div class="item-actions">
                <button class="item-action-btn equip" data-action="equip">Equip</button>
                <button class="item-action-btn toss" data-action="toss">Toss</button>
                <button class="item-action-btn info" data-action="info">Info</button>
            </div>
        `;

        // Store item ID in dataset
        slotElement.dataset.itemId = item.id;

        // Attach event listeners to buttons
        const actionsDiv = slotElement.querySelector('.item-actions');
        attachItemEventListeners(actionsDiv, item, context);
    }
}

// Attach event listeners to item action buttons
function attachItemEventListeners(actionsDiv, item, context, slot = null) {
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
                    discardItem(item.id, context, slot);
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
function discardItem(itemId, context, slot) {
    const confirmed = confirm('Are you sure you want to discard this item? This action cannot be undone.');
    if (!confirmed) return;

    const character = GameState.getState().character;
    if (!character) return;

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
    statsHTML += `<div><strong>Type:</strong> ${item.type}</div>`;
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
