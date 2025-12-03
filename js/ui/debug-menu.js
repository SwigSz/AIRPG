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
        console.log('Debug menu initialized. Press ` to open.');
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
