// ============================================
// Quick Slot Assignment
// ============================================

const QuickSlots = (() => {
    let slots = new Array(GameConfig?.UI?.QUICK_SLOTS || 6).fill(null);

    function init() {
        console.log('QuickSlots: Initializing...');
        setupKeyBindings();
    }

    function setupKeyBindings() {
        document.addEventListener('keydown', (e) => {
            // Number keys 1-6
            if (e.key >= '1' && e.key <= '6') {
                const slotIndex = parseInt(e.key) - 1;
                use(slotIndex);
            }
        });
    }

    function assign(slotIndex, item) {
        if (slotIndex < 0 || slotIndex >= slots.length) {
            console.error('Invalid slot index');
            return;
        }

        slots[slotIndex] = item;
        render();
    }

    function use(slotIndex) {
        if (slotIndex < 0 || slotIndex >= slots.length) return;

        const item = slots[slotIndex];
        if (!item) return;

        console.log(`Used quick slot ${slotIndex + 1}:`, item);

        // Check if item is a consumable
        if (window.ConsumableManager && ConsumableManager.isConsumable(item)) {
            const character = GameState?.getState()?.character;
            if (!character) {
                console.error('No character found');
                return;
            }

            // Check if we're in combat
            const combatState = window.CombatManager?.getCombatState();
            const inCombat = combatState && combatState.isActive;

            // If in combat, check if it's the player's turn
            if (inCombat) {
                const currentCombatant = CombatManager.getCurrentCombatant();
                if (!currentCombatant || !currentCombatant.isPlayer) {
                    if (window.ActivityLog) {
                        ActivityLog.addMessage("It's not your turn!", 'combat');
                    }
                    return;
                }
            }

            // Use the consumable
            const success = ConsumableManager.useConsumable(character, item, combatState);

            if (success) {
                // If in combat, update UI and advance turn
                if (inCombat && window.CombatManager) {
                    // The combat manager will handle updating UI and advancing turn
                    // We need to trigger it manually since we're outside the normal flow
                    if (window.CombatUI) {
                        CombatUI.renderCombatUI();
                    }
                    // Note: We don't call nextTurn here because consumables can be used without ending turn
                    // Or we could make it end the turn - depends on game design
                }

                // Update inventory UI if visible
                if (window.renderInventoryUI) {
                    renderInventoryUI();
                }

                // Remove the item from quick slot if it was the last one
                const inventory = character.inventory;
                const hasMore = inventory?.items?.some(i =>
                    i.name === item.name && i.icon === item.icon
                );

                if (!hasMore) {
                    clear(slotIndex);
                }
            }
        }

        // Emit event for item used
        if (window.EventSystem) {
            EventSystem.emit('quick-slot-used', slotIndex, item);
        }
    }

    function clear(slotIndex) {
        if (slotIndex < 0 || slotIndex >= slots.length) return;
        slots[slotIndex] = null;
        render();
    }

    function render() {
        const container = document.querySelector('.quick-slots');
        if (!container) return;

        container.innerHTML = slots.map((item, index) => `
            <div class="quick-slot ${item ? 'assigned' : ''}" data-slot="${index}">
                <span class="quick-slot-key">${index + 1}</span>
                ${item ? `<span class="quick-slot-item">${item.name}</span>` : ''}
            </div>
        `).join('');
    }

    return {
        init,
        assign,
        use,
        clear
    };
})();

// Expose to global scope
window.QuickSlots = QuickSlots;
