/**
 * SMITHING UI - Collapsible Category Management with State Persistence
 *
 * This file handles ONLY the UI interactions for the Smithing tab.
 * No game logic, no data processing - just visual state management.
 *
 * Category states are saved to GameState.smithingCategoryStates and persist across sessions.
 */

const SmithingUI = (() => {
    'use strict';

    /**
     * Load category states from GameState
     */
    function loadCategoryStates() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (!state || !state.smithingCategoryStates) {
            return null;
        }
        return state.smithingCategoryStates;
    }

    /**
     * Save category states to GameState
     */
    function saveCategoryStates(states) {
        const state = window.GameState ? window.GameState.getState() : null;
        if (state) {
            state.smithingCategoryStates = states;

            // Trigger main save system
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }
    }

    /**
     * Get current category states from DOM
     */
    function getCurrentStates() {
        const states = {
            categories: {},
            subcategories: {}
        };

        // Get category states
        document.querySelectorAll('.smithing-category-header').forEach(header => {
            const categoryId = header.dataset.category;
            const items = header.nextElementSibling;
            states.categories[categoryId] = items.classList.contains('expanded');
        });

        // Get subcategory states
        document.querySelectorAll('.smithing-subcategory-header').forEach(header => {
            const subcategoryId = header.dataset.subcategory;
            const parentCategory = header.closest('.smithing-category').querySelector('.smithing-category-header').dataset.category;
            const items = header.nextElementSibling;
            const key = `${parentCategory}.${subcategoryId}`;
            states.subcategories[key] = items.classList.contains('expanded');
        });

        return states;
    }

    /**
     * Apply saved states to DOM
     */
    function applyStates(states) {
        if (!states) return;

        // Apply category states
        if (states.categories) {
            document.querySelectorAll('.smithing-category-header').forEach(header => {
                const categoryId = header.dataset.category;
                const items = header.nextElementSibling;
                const icon = header.querySelector('.category-icon');

                if (states.categories.hasOwnProperty(categoryId)) {
                    const isExpanded = states.categories[categoryId];
                    if (isExpanded) {
                        items.classList.add('expanded');
                        icon.textContent = '▼';
                    } else {
                        items.classList.remove('expanded');
                        icon.textContent = '►';
                    }
                }
            });
        }

        // Apply subcategory states
        if (states.subcategories) {
            document.querySelectorAll('.smithing-subcategory-header').forEach(header => {
                const subcategoryId = header.dataset.subcategory;
                const parentCategory = header.closest('.smithing-category').querySelector('.smithing-category-header').dataset.category;
                const key = `${parentCategory}.${subcategoryId}`;
                const items = header.nextElementSibling;
                const icon = header.querySelector('.subcategory-icon');

                if (states.subcategories.hasOwnProperty(key)) {
                    const isExpanded = states.subcategories[key];
                    if (isExpanded) {
                        items.classList.add('expanded');
                        icon.textContent = '▼';
                    } else {
                        items.classList.remove('expanded');
                        icon.textContent = '►';
                    }
                }
            });
        }
    }

    /**
     * Initialize collapsible category functionality
     */
    function initSmithingUI() {
        // Load and apply saved states
        const savedStates = loadCategoryStates();
        if (savedStates) {
            applyStates(savedStates);
        }

        // Category header click handlers
        const categoryHeaders = document.querySelectorAll('.smithing-category-header');
        categoryHeaders.forEach(header => {
            header.addEventListener('click', function() {
                const items = this.nextElementSibling;
                const icon = this.querySelector('.category-icon');

                // Toggle expanded state
                items.classList.toggle('expanded');

                // Rotate icon
                if (items.classList.contains('expanded')) {
                    icon.textContent = '▼';
                } else {
                    icon.textContent = '►';
                }

                // Save state
                saveCategoryStates(getCurrentStates());
            });
        });

        // Sub-category header click handlers
        const subcategoryHeaders = document.querySelectorAll('.smithing-subcategory-header');
        subcategoryHeaders.forEach(header => {
            header.addEventListener('click', function(e) {
                e.stopPropagation(); // Prevent parent category from toggling

                const items = this.nextElementSibling;
                const icon = this.querySelector('.subcategory-icon');

                // Toggle expanded state
                items.classList.toggle('expanded');

                // Rotate icon
                if (items.classList.contains('expanded')) {
                    icon.textContent = '▼';
                } else {
                    icon.textContent = '►';
                }

                // Save state
                saveCategoryStates(getCurrentStates());
            });
        });

        // Item selection - call the Smithing system to handle game logic
        const smithingItems = document.querySelectorAll('.smithing-item');
        smithingItems.forEach(item => {
            item.addEventListener('click', function(e) {
                // Don't handle if it's locked
                if (this.classList.contains('locked')) return;

                // Call Smithing system to handle the actual game logic
                if (window.Smithing && window.Smithing.handleItemClick) {
                    window.Smithing.handleItemClick(e, this);
                }
            });
        });

        // Cancel button is handled by Smithing.js now, don't duplicate
    }

    /**
     * Refresh UI from saved data (called when save is loaded)
     */
    function refreshFromSaveData() {
        const savedStates = loadCategoryStates();
        if (savedStates) {
            applyStates(savedStates);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSmithingUI);
    } else {
        initSmithingUI();
    }

    // Public API
    return {
        init: initSmithingUI,
        refreshFromSaveData
    };
})();

window.SmithingUI = SmithingUI;
