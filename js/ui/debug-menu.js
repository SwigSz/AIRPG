/**
 * Debug Menu System
 * Provides developer tools and cheats for testing
 * Opens with backtick (`) key
 */

const DebugMenu = (() => {
    let isOpen = false;
    let modal = null;
    let character = null;

    /**
     * Initialize the debug menu system
     * @param {Character} char - The player character reference
     */
    function init(char) {
        character = char;
        createModal();
        attachKeyboardListener();
    }

    /**
     * Create the debug menu modal HTML
     */
    function createModal() {
        modal = document.createElement('div');
        modal.id = 'debug-menu-modal';
        modal.className = 'modal';
        modal.style.display = 'none';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>🐛 Debug Menu</h2>
                    <button class="close-btn" id="debug-menu-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="debug-menu-section">
                        <h3>Character Boosts</h3>
                        <div class="debug-buttons">
                            <button class="btn" id="debug-give-xp">
                                <span>⚡ Give 9999 XP</span>
                            </button>
                        </div>
                    </div>

                    <div class="debug-menu-section">
                        <h3>Materials</h3>
                        <div class="debug-buttons">
                            <button class="btn" id="debug-give-tin-materials">
                                <span>⬜ Give 3x Tin Ingots + Ores</span>
                            </button>
                        </div>
                    </div>

                    <div class="debug-menu-section">
                        <h3>Settlement</h3>
                        <div class="debug-buttons">
                            <button class="btn" id="debug-max-settlement-resources">
                                <span>🏘️ Max Settlement Resources</span>
                            </button>
                        </div>
                    </div>

                    <div class="debug-menu-section">
                        <h3>World Map</h3>
                        <div class="debug-buttons">
                            <button class="btn" id="debug-toggle-encounters">
                                <span>⚔️ Encounters: ON</span>
                            </button>
                            <button class="btn" id="debug-reveal-map">
                                <span>🗺️ Reveal Full Map</span>
                            </button>
                            <button class="btn" id="debug-toggle-fog">
                                <span>🌫️ Fog of War: ON</span>
                            </button>
                        </div>
                    </div>

                    <div class="debug-menu-info">
                        <small style="opacity: 0.7;">Press ~ to close</small>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Attach button event listeners
        attachButtonListeners();
    }

    /**
     * Attach event listeners to debug menu buttons
     */
    function attachButtonListeners() {
        // Close button
        const closeBtn = document.getElementById('debug-menu-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => close());
        }

        // Give XP button
        const giveXpBtn = document.getElementById('debug-give-xp');
        if (giveXpBtn) {
            giveXpBtn.addEventListener('click', () => giveXP(9999));
        }

        // Give Tin Materials button
        const giveTinBtn = document.getElementById('debug-give-tin-materials');
        if (giveTinBtn) {
            giveTinBtn.addEventListener('click', () => giveTinMaterials());
        }

        // Max Settlement Resources button
        const maxResourcesBtn = document.getElementById('debug-max-settlement-resources');
        if (maxResourcesBtn) {
            maxResourcesBtn.addEventListener('click', () => maxSettlementResources());
        }

        // Toggle encounters button
        const toggleEncountersBtn = document.getElementById('debug-toggle-encounters');
        if (toggleEncountersBtn) {
            // Sync button state with saved value on load
            const syncEncounterBtn = () => {
                if (!window.WorldMap) return;
                const enabled = WorldMap.isEncountersEnabled();
                toggleEncountersBtn.querySelector('span').textContent = `⚔️ Encounters: ${enabled ? 'ON' : 'OFF'}`;
                toggleEncountersBtn.style.opacity = enabled ? '1' : '0.5';
            };
            syncEncounterBtn();
            toggleEncountersBtn.addEventListener('click', () => {
                if (!window.WorldMap) return;
                const enabled = WorldMap.toggleEncounters();
                toggleEncountersBtn.querySelector('span').textContent = `⚔️ Encounters: ${enabled ? 'ON' : 'OFF'}`;
                toggleEncountersBtn.style.opacity = enabled ? '1' : '0.5';
                showFeedback(`Random encounters ${enabled ? 'enabled' : 'disabled'}`);
            });
        }

        // Reveal full map button
        const revealMapBtn = document.getElementById('debug-reveal-map');
        if (revealMapBtn) {
            revealMapBtn.addEventListener('click', () => {
                if (!window.WorldMap) return;
                WorldMap.revealAllTiles();
                showFeedback('Full map revealed!');
            });
        }

        // Toggle fog of war button
        const toggleFogBtn = document.getElementById('debug-toggle-fog');
        if (toggleFogBtn) {
            toggleFogBtn.addEventListener('click', () => {
                if (!window.WorldMap) return;
                const enabled = WorldMap.toggleFog();
                toggleFogBtn.querySelector('span').textContent = `🌫️ Fog of War: ${enabled ? 'ON' : 'OFF'}`;
                toggleFogBtn.style.opacity = enabled ? '1' : '0.5';
                showFeedback(`Fog of war ${enabled ? 'enabled' : 'disabled'}`);
            });
        }
    }

    /**
     * Attach keyboard listener for backtick key
     */
    function attachKeyboardListener() {
        document.addEventListener('keydown', (e) => {
            // Check for backtick key (`)
            if (e.key === '`' || e.key === '~') {
                e.preventDefault();
                toggle();
            }
        });
    }

    /**
     * Toggle debug menu open/closed
     */
    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    /**
     * Open the debug menu
     */
    function open() {
        if (!modal) return;

        modal.style.display = 'block';
        isOpen = true;
        console.log('Debug menu opened');
    }

    /**
     * Close the debug menu
     */
    function close() {
        if (!modal) return;

        modal.style.display = 'none';
        isOpen = false;
        console.log('Debug menu closed');
    }

    /**
     * Give XP to the player character
     * @param {number} amount - Amount of XP to give
     */
    function giveXP(amount) {
        if (!character) {
            console.error('No character reference available');
            return;
        }

        const levelBefore = character.level;

        // Use Character.addXP to add experience
        if (window.Character && window.Character.addXP) {
            Character.addXP(character, amount);
        } else {
            console.error('Character.addXP not available');
            return;
        }

        const levelAfter = character.level;

        console.log(`Debug: Gave ${amount} XP to player`);

        // Show feedback message
        showFeedback(`Gave ${amount} XP!${levelAfter > levelBefore ? ` Leveled up to ${levelAfter}!` : ''}`);

        // Update UI - use the global updateTopBar function
        if (window.updateTopBar) {
            updateTopBar(character);
        }

        // Auto-save
        if (window.SaveSystem) {
            SaveSystem.save();
        }
    }

    /**
     * Give tin materials (ingots and ores) to the player
     */
    function giveTinMaterials() {
        if (!character) {
            console.error('No character reference available');
            return;
        }

        // Use ItemFactory to create tin materials
        if (!window.ItemFactory) {
            console.error('ItemFactory not available');
            return;
        }

        let itemsAdded = 0;

        // Add 3 tin ingots
        for (let i = 0; i < 3; i++) {
            const tinIngot = ItemFactory.createItem('tin_ingot');
            if (tinIngot) {
                Inventory.addItem(character.inventory, tinIngot);
                itemsAdded++;
            }
        }

        // Add 3 tin ores
        for (let i = 0; i < 3; i++) {
            const tinOre = ItemFactory.createItem('tin_ore');
            if (tinOre) {
                Inventory.addItem(character.inventory, tinOre);
                itemsAdded++;
            }
        }

        console.log(`Debug: Gave ${itemsAdded} tin materials to player`);

        // Show feedback message
        showFeedback('Gave 3x Tin Ingots + 3x Tin Ores!');

        // Update UI
        if (window.updateUI) {
            updateUI();
        }

        // Auto-save
        if (window.SaveSystem) {
            SaveSystem.save();
        }
    }

    /**
     * Max out all settlement resources
     */
    function maxSettlementResources() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (!state || !state.settlement || !state.settlement.resources) {
            console.error('Settlement resources not available');
            showFeedback('Error: Settlement not available');
            return;
        }

        let resourceCount = 0;

        // Max out all resources to their maximum values
        Object.keys(state.settlement.resources).forEach(resourceId => {
            const resource = state.settlement.resources[resourceId];
            if (resource && typeof resource.max === 'number') {
                resource.current = resource.max;
                resourceCount++;
            }
        });

        console.log(`Debug: Maxed out ${resourceCount} settlement resources`);

        // Show feedback message
        showFeedback(`Maxed out ${resourceCount} settlement resources!`);

        // Update UI
        if (window.Settlement && window.Settlement.updateUI) {
            Settlement.updateUI();
        }

        // Auto-save
        if (window.SaveSystem) {
            SaveSystem.save();
        }
    }

    /**
     * Show temporary feedback message
     * @param {string} message - Message to display
     */
    function showFeedback(message) {
        const feedback = document.createElement('div');
        feedback.className = 'debug-feedback';
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 200, 0, 0.9);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 10001;
            animation: fadeInOut 2s ease-in-out;
        `;

        document.body.appendChild(feedback);

        setTimeout(() => {
            feedback.remove();
        }, 2000);
    }

    // Public API
    return {
        init,
        open,
        close,
        toggle
    };
})();

// Expose to window
window.DebugMenu = DebugMenu;
