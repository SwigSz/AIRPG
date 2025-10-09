// ============================================
// Tab Switching System
// ============================================

const TabManager = (() => {
    let currentTab = 'character';

    function init() {
        initializeTabSwitching();
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

    return {
        init,
        switchTab,
        getCurrentTab
    };
})();

// Expose to global scope
window.TabManager = TabManager;
