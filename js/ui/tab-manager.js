// ============================================
// Tab Switching System
// ============================================

const TabManager = (() => {
    let currentTab = 'character';

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
        // Update current tab state
        currentTab = tabName;

        // Save to localStorage
        localStorage.setItem('lastActiveTab', tabName);

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

        // Toggle right sidebar content based on active tab
        toggleRightSidebarContent(tabName);

        // Trigger tab-specific updates when switching to inventory tab
        if (tabName === 'inventory' && window.renderInventoryUI) {
            renderInventoryUI();
        }
        if (tabName === 'inventory' && window.renderEquipmentUI) {
            renderEquipmentUI();
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
            // Show right sidebar on map tab
            if (rightSidebar) rightSidebar.style.display = 'flex';

            // Show Activity Log and Quick Slots on map tab
            if (activityLog) activityLog.style.display = 'flex';
            if (quickSlots) quickSlots.style.display = 'block';

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
        // Try to restore last active tab from localStorage
        const lastActiveTab = localStorage.getItem('lastActiveTab');

        // If a tab was saved and it exists, switch to it; otherwise default to character
        if (lastActiveTab && document.getElementById(`${lastActiveTab}-tab`)) {
            switchTab(lastActiveTab);
        } else {
            switchTab('character');
        }
    }

    function getCurrentTab() {
        return currentTab;
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
