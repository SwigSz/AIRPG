// ============================================
// Game UI Framework - Core Functionality
// ============================================

// Current active tab state
let currentTab = 'character';

// Combat mode state (for Map tab)
let combatMode = false;

// ============================================
// Initialize on DOM Load
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeTabSwitching();
    initializeCombatToggle();
    setInitialTab();
});

// ============================================
// Tab Switching System
// ============================================
function initializeTabSwitching() {
    const navButtons = document.querySelectorAll('.nav-button');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update current tab state
    currentTab = tabName;

    // Remove active class from all nav buttons
    const navButtons = document.querySelectorAll('.nav-button');
    navButtons.forEach(btn => btn.classList.remove('active'));

    // Add active class to clicked button
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // Hide all tab content - remove 'active' class from ALL tabs
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none'; // Explicitly hide
    });

    // Show ONLY the selected tab content
    const activeTabContent = document.getElementById(`${tabName}-tab`);
    if (activeTabContent) {
        activeTabContent.classList.add('active');
        activeTabContent.style.display = 'block'; // Explicitly show
    }
}

function setInitialTab() {
    // Set character tab as default on page load
    switchTab('character');
}

// ============================================
// Combat Mode Toggle (for Map Tab Demo)
// ============================================
function initializeCombatToggle() {
    const combatToggleBtn = document.getElementById('combat-toggle');

    combatToggleBtn.addEventListener('click', () => {
        toggleCombatMode();
    });
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
