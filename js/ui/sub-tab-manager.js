// ============================================
// Centralized Sub-Tab Management System
// ============================================
// Generic system for managing sub-tabs within parent tabs
// Automatically saves and restores sub-tab state to GameState

const SubTabManager = (() => {
    let isRestoring = false; // Flag to prevent saving during restoration

    /**
     * Initialize sub-tab system for a parent tab
     * @param {string} parentTabName - Name of the parent tab (e.g., 'character', 'settlement', 'crafting')
     * @param {string} buttonSelector - CSS selector for sub-tab buttons (e.g., '.character-tab-btn')
     * @param {string} contentSelector - CSS selector for sub-tab content (e.g., '.character-tab-content')
     * @param {string} dataAttribute - Data attribute name (e.g., 'data-char-tab')
     * @param {string} contentIdPrefix - Prefix for content IDs (e.g., 'skills' becomes 'skills-tab-content')
     * @param {string} contentIdSuffix - Suffix for content IDs (e.g., '-tab-content')
     * @param {function} onTabChange - Optional callback when tab changes (receives tabName)
     */
    function initSubTabs(parentTabName, buttonSelector, contentSelector, dataAttribute, contentIdPrefix, contentIdSuffix, onTabChange) {
        const buttons = document.querySelectorAll(buttonSelector);

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute(dataAttribute);
                switchSubTab(parentTabName, tabName, buttonSelector, contentSelector, dataAttribute, contentIdPrefix, contentIdSuffix, onTabChange);
            });
        });

        // Note: Sub-tab restoration is handled explicitly in main.js after save data loads
        // This ensures saved tab state is available before restoration
    }

    /**
     * Switch to a specific sub-tab
     */
    function switchSubTab(parentTabName, tabName, buttonSelector, contentSelector, dataAttribute, contentIdPrefix, contentIdSuffix, onTabChange) {
        // Save to GameState
        const state = window.GameState?.getState();
        if (state) {
            if (!state.ui) {
                state.ui = { activeTab: 'character', subTabs: {} };
            }
            if (!state.ui.subTabs) {
                state.ui.subTabs = {};
            }
            state.ui.subTabs[parentTabName] = tabName;

            // Immediately save to persist sub-tab state (but not during restoration)
            if (window.SaveSystem && !isRestoring) {
                SaveSystem.save();
            }
        }

        // Update button active states
        document.querySelectorAll(buttonSelector).forEach(btn => {
            if (btn.getAttribute(dataAttribute) === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update content active states
        document.querySelectorAll(contentSelector).forEach(content => {
            content.classList.remove('active');
        });

        // Show the active content
        const activeContent = document.getElementById(`${contentIdPrefix}${tabName}${contentIdSuffix}`);
        if (activeContent) {
            activeContent.classList.add('active');
        }

        // Call optional callback
        if (onTabChange && typeof onTabChange === 'function') {
            onTabChange(tabName);
        }
    }

    /**
     * Restore sub-tab state from GameState
     */
    function restoreSubTab(parentTabName, buttonSelector, contentSelector, dataAttribute, contentIdPrefix, contentIdSuffix, onTabChange) {
        isRestoring = true; // Set flag to prevent saving during restoration

        const state = window.GameState?.getState();
        const savedSubTab = state?.ui?.subTabs?.[parentTabName];

        if (savedSubTab) {
            // Verify the sub-tab exists before switching
            const targetButton = document.querySelector(`${buttonSelector}[${dataAttribute}="${savedSubTab}"]`);
            if (targetButton) {
                switchSubTab(parentTabName, savedSubTab, buttonSelector, contentSelector, dataAttribute, contentIdPrefix, contentIdSuffix, onTabChange);
                isRestoring = false;
                return;
            } else {
                console.warn(`[SubTabManager] Button not found for ${parentTabName}/${savedSubTab}`);
            }
        }

        // If no saved state or tab doesn't exist, activate the first tab
        const firstButton = document.querySelector(buttonSelector);
        if (firstButton) {
            const firstTabName = firstButton.getAttribute(dataAttribute);
            switchSubTab(parentTabName, firstTabName, buttonSelector, contentSelector, dataAttribute, contentIdPrefix, contentIdSuffix, onTabChange);
        }

        isRestoring = false; // Clear flag
    }

    /**
     * Get the current active sub-tab for a parent tab
     */
    function getCurrentSubTab(parentTabName) {
        const state = window.GameState?.getState();
        return state?.ui?.subTabs?.[parentTabName] || null;
    }

    return {
        initSubTabs,
        switchSubTab,
        restoreSubTab,
        getCurrentSubTab
    };
})();

// Expose to global scope
window.SubTabManager = SubTabManager;
