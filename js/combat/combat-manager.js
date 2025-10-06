// ============================================
// Combat Mode Toggle (for Map Tab Demo)
// ============================================

const CombatUI = (() => {
    let combatMode = false;

    function init() {
        initializeCombatToggle();
    }

    function initializeCombatToggle() {
        const combatToggleBtn = document.getElementById('combat-toggle');

        if (combatToggleBtn) {
            combatToggleBtn.addEventListener('click', () => {
                toggleCombatMode();
            });
        }
    }

    function toggleCombatMode() {
        combatMode = !combatMode;

        const mapView = document.querySelector('.map-view');
        const combatView = document.querySelector('.combat-view');

        if (combatMode) {
            // Switch to combat view
            mapView.classList.remove('active');
            combatView.classList.add('active');
        } else {
            // Switch to map view
            combatView.classList.remove('active');
            mapView.classList.add('active');
        }
    }

    function isCombatActive() {
        return combatMode;
    }

    return {
        init,
        toggleCombatMode,
        isCombatActive
    };
})();

// Expose to global scope
window.CombatUI = CombatUI;
