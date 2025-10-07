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

        // Emit event for item used
        if (window.EventSystem) {
            EventSystem.emit('quick-slot-used', slotIndex, item);
        }

        console.log(`Used quick slot ${slotIndex + 1}:`, item);
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
