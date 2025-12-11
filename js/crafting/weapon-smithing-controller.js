/**
 * Weapon Smithing Controller
 *
 * Integrates the weapon head hammering system with the smithing UI.
 * Handles the selection of weapon components and launches the hammering minigame.
 */

window.WeaponSmithingController = (function() {
    'use strict';

    let materialsData = null;
    let hammeringConfig = null;

    /**
     * Initialize the controller
     */
    async function init() {
        console.log('[WeaponSmithingController] Initializing...');

        // Load materials data (to get metal info)
        try {
            const materialsResponse = await fetch('data/materials.json');
            const materialsJson = await materialsResponse.json();
            materialsData = materialsJson.materials;
        } catch (error) {
            console.error('[WeaponSmithingController] Failed to load materials.json:', error);
        }

        // Load hammering config (to get weapon types)
        try {
            const configResponse = await fetch('data/hammering-config.json');
            hammeringConfig = await configResponse.json();
        } catch (error) {
            console.error('[WeaponSmithingController] Failed to load hammering-config.json:', error);
        }

        // Setup event listeners for weapon component items
        setupWeaponComponentListeners();

        console.log('[WeaponSmithingController] Initialized');
    }

    /**
     * Setup listeners for weapon component items
     */
    function setupWeaponComponentListeners() {
        // Find all weapon component items
        const weaponItems = document.querySelectorAll('[data-component-type^="blade"], [data-component-type^="armor"]');

        weaponItems.forEach(item => {
            item.addEventListener('click', handleWeaponComponentClick);
        });

        console.log('[WeaponSmithingController] Attached listeners to', weaponItems.length, 'weapon components');
    }

    /**
     * Handle weapon component click
     */
    function handleWeaponComponentClick(event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation(); // Stop other listeners on same element

        const item = event.currentTarget;
        const componentType = item.dataset.componentType;
        const itemName = item.dataset.item;

        console.log('[WeaponSmithingController] Clicked weapon component:', componentType, itemName);

        // For now, only handle blade types
        if (!componentType || !componentType.includes('blade')) {
            console.log('[WeaponSmithingController] Only blades are supported in Phase 1');
            if (window.Modal) {
                window.Modal.show({
                    title: 'Not Available',
                    content: '<p style="text-align: center; color: #fca5a5;">Only weapon blades are available for forging in Phase 1.</p>',
                    buttons: [{ text: 'OK' }]
                });
            }
            return;
        }

        // Determine weapon type from item name
        const weaponType = getWeaponTypeFromItemName(itemName);
        if (!weaponType) {
            console.error('[WeaponSmithingController] Could not determine weapon type from:', itemName);
            return;
        }

        // Check for any available ingots
        const ingots = materialsData.filter(m => m.classifications && m.classifications.includes('ingot'));
        const availableIngots = ingots.filter(ingot => getItemCountById(ingot.id) > 0);

        if (availableIngots.length === 0) {
            if (window.Modal) {
                window.Modal.show({
                    title: 'No Ingots',
                    content: '<p style="text-align: center; color: #fca5a5;">You need a metal ingot to forge this weapon component. Smelt some ore first!</p>',
                    buttons: [{ text: 'OK' }]
                });
            }
            return;
        }

        // Show the forge UI with ingot selection
        showForgeUIWithSelection(weaponType, availableIngots);
    }


    /**
     * Get weapon type configuration from item name
     */
    function getWeaponTypeFromItemName(itemName) {
        if (!hammeringConfig || !hammeringConfig.weaponTypes) return null;

        // Map item names to weapon type IDs
        const nameMapping = {
            'longsword-blade': 'longsword',
            'greatsword-blade': 'greatsword',
            'dagger-blade': 'dagger',
            'axe-head': 'axe',
            'spear-head': 'spear',
            'shortsword-blade': 'shortsword'
        };

        const weaponTypeId = nameMapping[itemName];
        if (!weaponTypeId) {
            console.warn('[WeaponSmithingController] No mapping for item name:', itemName);
            return null;
        }

        return hammeringConfig.weaponTypes.find(wt => wt.id === weaponTypeId);
    }

    /**
     * Show forge UI with ingot selection dropdown
     */
    function showForgeUIWithSelection(weaponType, availableIngots) {
        console.log('[WeaponSmithingController] Showing forge UI with ingot selection');

        // Hide default forge state, show work state
        const defaultState = document.getElementById('forge-default-state');
        const workState = document.getElementById('forge-work-state');

        if (defaultState) defaultState.style.display = 'none';
        if (workState) workState.style.display = 'flex';

        // Update forge item info
        document.getElementById('forge-item-name').textContent = weaponType.displayName;
        document.getElementById('forge-item-description').textContent = weaponType.description;

        // Show generic materials list with dropdown
        const materialsListHTML = `
            <div class="material-item">
                <span class="material-icon">⚙️</span>
                <span class="material-name">Metal Ingot</span>
                <span class="material-count sufficient">1 / 1</span>
            </div>
            <div class="ingot-selection-container">
                <label for="ingot-selector">Select Ingot:</label>
                <select id="ingot-selector">
                    <option value="">-- Choose Ingot --</option>
                    ${availableIngots.map(ingot => `<option value="${ingot.id}">${ingot.icon} ${ingot.name}</option>`).join('')}
                </select>
            </div>
        `;

        document.getElementById('forge-materials-list').innerHTML = materialsListHTML;

        // Add event listener to dropdown
        const dropdown = document.getElementById('ingot-selector');
        if (dropdown) {
            dropdown.addEventListener('change', (e) => {
                const selectedIngotId = e.target.value;
                if (selectedIngotId) {
                    // Start hammering with selected ingot
                    startHammering(selectedIngotId, weaponType);
                }
            });
        }
    }

    /**
     * Start the hammering minigame
     */
    function startHammering(ingotId, weaponType) {
        console.log('[WeaponSmithingController] Starting hammering for:', ingotId, weaponType.name);

        // Get metal material data
        const metal = materialsData.find(m => m.id === ingotId);
        if (!metal) {
            console.error('[WeaponSmithingController] Metal not found:', ingotId);
            return;
        }

        // Check if player has the ingot
        const count = getItemCountById(ingotId);
        if (count === 0) {
            if (window.Modal) {
                window.Modal.show({
                    title: 'No Ingots',
                    content: `<p style="text-align: center; color: #fca5a5;">You don't have any ${metal.name}!</p>`,
                    buttons: [{ text: 'OK' }]
                });
            }
            return;
        }

        // Update forge item name to include metal type
        document.getElementById('forge-item-name').textContent = `${weaponType.displayName} (${metal.name})`;

        // Update materials list to show selected ingot (not yet consumed)
        document.getElementById('forge-materials-list').innerHTML = `
            <div class="material-item">
                <span class="material-icon">${metal.icon}</span>
                <span class="material-name">${metal.name}</span>
                <span class="material-count sufficient">1 / 1 (ready)</span>
            </div>
        `;

        // Create callback to consume ingot when hammering actually starts
        const consumeIngotCallback = () => {
            removeItemById(ingotId);
            console.log('[WeaponSmithingController] Ingot consumed:', ingotId);

            // Update materials list to show consumed
            document.getElementById('forge-materials-list').innerHTML = `
                <div class="material-item">
                    <span class="material-icon">${metal.icon}</span>
                    <span class="material-name">${metal.name}</span>
                    <span class="material-count sufficient">1 / 1 (consumed)</span>
                </div>
            `;
        };

        // Start the hammering minigame (ingot will be consumed when player heats the metal)
        if (window.WeaponHeadHammering) {
            window.WeaponHeadHammering.start(metal, weaponType, handleHammeringComplete, consumeIngotCallback);
        } else {
            console.error('[WeaponSmithingController] WeaponHeadHammering module not loaded!');
            if (window.Modal) {
                window.Modal.show({
                    title: 'Error',
                    content: '<p style="text-align: center; color: #fca5a5;">Hammering system not available</p>',
                    buttons: [{ text: 'OK' }]
                });
            }
        }
    }

    /**
     * Handle hammering completion callback
     */
    function handleHammeringComplete(result) {
        console.log('[WeaponSmithingController] Hammering complete:', result);

        // Show completion modal
        const qualityGrade = getQualityGrade(result.quality);

        if (window.Modal) {
            window.Modal.show({
                title: 'Hammering Complete!',
                content: `
                    <div style="text-align: center;">
                        <p style="font-size: 1.2rem; color: #cbd5e1; margin: 1rem 0;">
                            You've forged a ${result.weaponType.displayName}!
                        </p>
                        <div style="font-size: 3rem; margin: 1rem 0;">🔨</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #f59e0b; margin: 1rem 0;">
                            ${qualityGrade} Quality
                        </div>
                        <div style="color: #94a3b8; margin: 0.5rem 0;">
                            Quality: ${Math.round(result.quality)}%
                        </div>
                        <div style="color: #94a3b8; margin: 0.5rem 0;">
                            Metal: ${result.metal.name}
                        </div>
                        <p style="color: #64748b; margin-top: 1.5rem; font-size: 0.9rem;">
                            Phase 2 (Quenching) and Phase 3 (Grinding) coming soon!
                        </p>
                    </div>
                `,
                buttons: [
                    {
                        text: 'Finish',
                        class: 'modal-btn-primary',
                        onClick: resetForgeUI
                    }
                ]
            });
        } else {
            alert(`Hammering complete! Quality: ${Math.round(result.quality)}%`);
            resetForgeUI();
        }
    }

    /**
     * Get quality grade name
     */
    function getQualityGrade(quality) {
        if (quality >= 95) return 'Masterwork';
        if (quality >= 85) return 'Excellent';
        if (quality >= 75) return 'Well-Forged';
        if (quality >= 60) return 'Standard';
        if (quality >= 40) return 'Rough';
        return 'Flawed';
    }

    /**
     * Reset forge UI to default state
     */
    function resetForgeUI() {
        // Close modal
        if (window.Modal) {
            window.Modal.hide();
        }

        // Reset to default state
        const defaultState = document.getElementById('forge-default-state');
        const workState = document.getElementById('forge-work-state');

        if (defaultState) defaultState.style.display = 'flex';
        if (workState) workState.style.display = 'none';

        // Deselect all smithing items
        document.querySelectorAll('.smithing-item').forEach(item => {
            item.classList.remove('selected');
        });

        // Update UI
        if (window.updateUI) {
            window.updateUI();
        }
    }

    /**
     * Helper: Get item count by ID
     */
    function getItemCountById(itemId) {
        const character = window.GameState ? window.GameState.getState().character : null;
        if (!character || !character.inventory || !character.inventory.items) return 0;

        return character.inventory.items.filter(item => {
            return item.id && item.id.startsWith(itemId + '_');
        }).length;
    }

    /**
     * Helper: Remove one item by ID
     */
    function removeItemById(itemId) {
        const character = window.GameState ? window.GameState.getState().character : null;
        if (!character || !window.Inventory) return;

        const itemToRemove = character.inventory.items.find(item =>
            item.id && item.id.startsWith(itemId + '_')
        );

        if (itemToRemove) {
            window.Inventory.removeItem(character.inventory, itemToRemove.id);
        }
    }

    // Public API
    return {
        init
    };

})();
