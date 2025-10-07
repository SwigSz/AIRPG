// ============================================
// Game UI Framework - Main Entry Point
// ============================================

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    console.log('AI-RPG Game Framework Initialized');

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

    // Initialize test character
    initializeTestCharacter();

    console.log('All systems initialized');
});

// Initialize Test Character with Test Data
function initializeTestCharacter() {
    // Create test skill
    const woodcuttingSkill = Skills.createSkill('Woodcutting', {
        level: 5,
        xp: 250,
        xpToNext: 500
    });

    // Create test item
    const ironSword = Items.createItem('Iron Sword', 'weapon', {
        stats: {
            damage: 15,
            durability: 100
        },
        description: 'A sturdy iron blade'
    });

    // Create test character
    const testCharacter = Character.create('Test Hero', {
        age: 25,
        level: 3,
        skills: [woodcuttingSkill],
        inventory: [ironSword],
        stats: {
            strength: 10,
            dexterity: 8,
            constitution: 12,
            intelligence: 7,
            wisdom: 6,
            charisma: 9
        }
    });

    // Store in game state
    GameState.updateProperty('character', testCharacter);

    // Display character data
    displayCharacterData();

    console.log('Test character initialized:', testCharacter);
}

// Display Character Data in UI
function displayCharacterData() {
    const character = GameState.getState().character;
    if (!character) return;

    // Display skills
    displaySkills(character.skills);

    // Display inventory items
    displayInventory(character.inventory);
}

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

// Display Inventory Items
function displayInventory(inventory) {
    if (!inventory || inventory.length === 0) return;

    console.log('Test Item:', inventory[0]);

    // Display in first inventory slot as visual test
    const firstSlot = document.querySelector('.inventory-grid .inventory-slot');
    if (firstSlot && inventory[0]) {
        const item = inventory[0];
        firstSlot.classList.remove('empty');
        firstSlot.textContent = item.name;

        // Add double-click event to show modal
        firstSlot.addEventListener('dblclick', () => {
            showItemDetailsModal(item);
        });
    }
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
                if (SaveSystem.wipeData()) {
                    alert('All save data has been wiped. The page will now reload.');
                    location.reload();
                } else {
                    alert('Failed to wipe save data.');
                }
            }
        });
    }
}
