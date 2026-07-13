// ============================================
// Tab Switching System
// ============================================

const TabManager = (() => {
    let isRestoring = false; // Flag to prevent saving during restoration

    function init() {
        initializeTabSwitching();
        updateSettlementTabVisibility();
        setInitialTab();
    }

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
        // Save to GameState
        const state = window.GameState?.getState();
        if (state) {
            if (!state.ui) {
                state.ui = { activeTab: 'character', subTabs: {} };
            }
            state.ui.activeTab = tabName;

            // Immediately save to persist tab state (but not during restoration)
            if (window.SaveSystem && !isRestoring) {
                SaveSystem.save();
            }
        }

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

        // Toggle map-active class on center-content for full-bleed map layout
        const centerContent = document.getElementById('center-content');
        if (centerContent) {
            if (tabName === 'map') {
                centerContent.classList.add('map-active');
            } else {
                centerContent.classList.remove('map-active');
            }
        }

        // Toggle right sidebar content based on active tab
        toggleRightSidebarContent(tabName);

        // Trigger tab-specific updates when switching to inventory tab
        if (tabName === 'inventory' && window.renderInventoryUI) {
            renderInventoryUI();
        }
        if (tabName === 'inventory' && window.renderEquipmentUI) {
            renderEquipmentUI();
        }

        // Trigger crafting UI update when switching to crafting tab
        if (tabName === 'crafting' && window.Crafting) {
            if (window.Crafting.renderWeaponCategories) {
                Crafting.renderWeaponCategories();
            }
            if (window.Crafting.updateValidationMessage) {
                Crafting.updateValidationMessage();
            }
        }

        // Restore remembered scroll positions for the newly shown tab
        if (window.ScrollMemory) {
            ScrollMemory.restore();
        }
    }

    function toggleRightSidebarContent(tabName) {
        const rightSidebar = document.getElementById('right-sidebar');
        const activityLog = document.querySelector('.activity-log');
        const quickSlots = document.querySelector('.quick-slots');

        if (tabName === 'settlement') {
            // Show right sidebar on settlement tab
            if (rightSidebar) rightSidebar.style.display = 'flex';

            // Hide Activity Log and Quick Slots when in settlement tab
            if (activityLog) activityLog.style.display = 'none';
            if (quickSlots) quickSlots.style.display = 'none';

            // Trigger settlement UI update to render resources FIRST
            if (window.Settlement) {
                Settlement.updateUI();
            }

            // Now show settlement resources (after it's been created)
            const settlementResources = document.getElementById('settlement-resources-sidebar');
            if (settlementResources) {
                settlementResources.style.display = 'flex';
            }
        } else if (tabName === 'map') {
            // Hide right sidebar on map tab — give map full width
            if (rightSidebar) rightSidebar.style.display = 'none';

            // Hide settlement resources
            const settlementResources = document.getElementById('settlement-resources-sidebar');
            if (settlementResources) {
                settlementResources.style.display = 'none';
            }
        } else {
            // Hide right sidebar for all other tabs (character, inventory, crafting)
            if (rightSidebar) rightSidebar.style.display = 'none';

            // Hide settlement resources
            const settlementResources = document.getElementById('settlement-resources-sidebar');
            if (settlementResources) {
                settlementResources.style.display = 'none';
            }
        }
    }

    function setInitialTab() {
        isRestoring = true; // Set flag to prevent saving during restoration

        // Try to restore last active tab from GameState
        const state = window.GameState?.getState();
        const lastActiveTab = state?.ui?.activeTab;

        // Migrate from old localStorage system if needed
        if (!lastActiveTab) {
            const legacyTab = localStorage.getItem('lastActiveTab');
            if (legacyTab && state) {
                if (!state.ui) {
                    state.ui = { activeTab: 'character', subTabs: {} };
                }
                state.ui.activeTab = legacyTab;
                localStorage.removeItem('lastActiveTab'); // Clean up old storage
            }
        }

        // If a tab was saved and it exists, switch to it; otherwise default to character
        const tabToActivate = lastActiveTab || 'character';
        if (document.getElementById(`${tabToActivate}-tab`)) {
            switchTab(tabToActivate);
        } else {
            switchTab('character');
        }

        isRestoring = false; // Clear flag
    }

    function getCurrentTab() {
        const state = window.GameState?.getState();
        return state?.ui?.activeTab || 'character';
    }

    /**
     * Update settlement tab visibility based on character.inSettlement
     */
    function updateSettlementTabVisibility() {
        const settlementButton = document.querySelector('[data-tab="settlement"]');
        if (!settlementButton) return;

        const character = window.GameState?.getState()?.character;
        if (character && character.inSettlement) {
            settlementButton.style.display = 'flex';
        } else {
            settlementButton.style.display = 'none';
        }
    }

    return {
        init,
        switchTab,
        getCurrentTab,
        updateSettlementTabVisibility
    };
})();

// Expose to global scope
window.TabManager = TabManager;
