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
    let currentWeaponType = null; // Track current weapon type for UI refresh
    let selectedIngotId = null; // Currently selected ingot for hammering
    let selectedWeaponType = null; // Currently selected weapon type

    /**
     * Initialize the controller
     */
    async function init() {
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

        // Setup tab visibility listener to refresh UI
        setupTabVisibilityListener();

        // Setup weapon forge buttons
        setupWeaponForgeButtons();
    }

    /**
     * Setup listener for tab visibility changes
     */
    function setupTabVisibilityListener() {
        // Listen for inventory changes to refresh ingot counts
        document.addEventListener('inventoryChanged', (e) => {
            // Check if the changed item is an ingot
            if (e.detail && e.detail.item && e.detail.item.name && e.detail.item.name.includes('Ingot')) {
                // Refresh the dropdown if we're in weapon smithing mode
                if (currentWeaponType) {
                    refreshIngotDropdown();
                }
            }
        });

        // Also listen for tab changes to refresh ingot counts
        document.addEventListener('click', (e) => {
            const tabButton = e.target.closest('.tab-btn');
            if (tabButton && tabButton.dataset.tab === 'smithing') {
                // Refresh the UI if we're in weapon smithing mode
                setTimeout(() => {
                    if (currentWeaponType) {
                        refreshIngotDropdown();
                    }
                }, 100);
            }
        });
    }

    /**
     * Setup weapon forge button listeners
     */
    function setupWeaponForgeButtons() {
        const startBtn = document.getElementById('start-weapon-forge-btn');
        const cancelBtn = document.getElementById('cancel-weapon-forge-btn');

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (selectedIngotId && selectedWeaponType) {
                    startHammering(selectedIngotId, selectedWeaponType);
                }
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', handleWeaponForgeCancel);
        }
    }

    /**
     * Handle weapon forge cancel
     */
    function handleWeaponForgeCancel() {
        // Reset selection state
        selectedIngotId = null;
        selectedWeaponType = null;
        currentWeaponType = null;

        // Hide work state, show default state
        const defaultState = document.getElementById('forge-default-state');
        const workState = document.getElementById('forge-work-state');

        if (defaultState) defaultState.style.display = 'flex';
        if (workState) workState.style.display = 'none';

        // Re-enable weapon component items
        document.querySelectorAll('.smithing-item').forEach(item => {
            item.style.pointerEvents = 'auto';
            item.style.opacity = '1';
        });
    }

    /**
     * Refresh the ingot dropdown with current inventory
     */
    function refreshIngotDropdown() {
        if (!currentWeaponType) return;

        // Get current ingots from inventory
        const character = window.GameState ? window.GameState.getState().character : null;
        const inventoryIngots = character && character.inventory && character.inventory.items
            ? character.inventory.items.filter(item => item.name && item.name.includes('Ingot'))
            : [];

        // Group ingots by their exact name
        const ingotsByName = {};
        inventoryIngots.forEach(invItem => {
            const name = invItem.name;
            if (!ingotsByName[name]) {
                // Extract base material ID (remove instance suffix like _1765484714477_7armhdpfz)
                let materialId = invItem.materialId;
                if (!materialId && invItem.id) {
                    // If materialId doesn't exist, extract from ID (e.g., copper_ingot_123_abc -> copper_ingot)
                    materialId = invItem.id.replace(/_\d+_[a-z0-9]+$/i, '');
                }
                ingotsByName[name] = {
                    name: name,
                    materialId: materialId,
                    count: 0,
                    invItems: [] // Store actual inventory items for this group
                };
            }
            ingotsByName[name].count++;
            ingotsByName[name].invItems.push(invItem);
        });

        const availableIngots = Object.values(ingotsByName);

        // Update the dropdown
        const dropdown = document.getElementById('ingot-selector');
        if (dropdown) {
            const totalIngotCount = availableIngots.reduce((sum, ingot) => sum + ingot.count, 0);

            // Rebuild dropdown options
            dropdown.innerHTML = `
                <option value="">-- Choose Ingot --</option>
                ${availableIngots.map(ingot => {
                    const material = materialsData.find(m => m.id === ingot.materialId);
                    const icon = material ? material.icon : '🔶';
                    return `<option value="${ingot.materialId}" data-name="${ingot.name}">${icon} ${ingot.name} x${ingot.count}</option>`;
                }).join('')}
            `;

            // Re-attach event listener
            dropdown.removeEventListener('change', handleDropdownChange);
            dropdown.addEventListener('change', handleDropdownChange);

            // Update the count display
            const countDisplay = document.querySelector('#forge-materials-list .material-count');
            if (countDisplay) {
                countDisplay.textContent = `${totalIngotCount} / 1`;
                countDisplay.className = `material-count ${totalIngotCount > 0 ? 'sufficient' : 'insufficient'}`;
            }
        }
    }

    /**
     * Handle dropdown change event
     */
    function handleDropdownChange(e) {
        const selectedIngotId = e.target.value;
        if (selectedIngotId && currentWeaponType) {
            startHammering(selectedIngotId, currentWeaponType);
        }
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

        // Deselect all smithing items (ingots and weapon components)
        document.querySelectorAll('.smithing-item').forEach(i => {
            i.classList.remove('selected');
        });

        // Select this weapon component
        item.classList.add('selected');

        // For now, only handle blade types
        if (!componentType || !componentType.includes('blade')) {
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

        // Store current weapon type for UI refresh
        currentWeaponType = weaponType;

        // Get all unique ingots from inventory with their actual names
        const character = window.GameState ? window.GameState.getState().character : null;
        const inventoryIngots = character && character.inventory && character.inventory.items
            ? character.inventory.items.filter(item => item.name && item.name.includes('Ingot'))
            : [];

        // Group ingots by their exact name (to handle quality variants separately)
        const ingotsByName = {};
        inventoryIngots.forEach(invItem => {
            const name = invItem.name;
            if (!ingotsByName[name]) {
                // Extract base material ID (remove instance suffix like _1765484714477_7armhdpfz)
                let materialId = invItem.materialId;
                if (!materialId && invItem.id) {
                    // If materialId doesn't exist, extract from ID (e.g., copper_ingot_123_abc -> copper_ingot)
                    materialId = invItem.id.replace(/_\d+_[a-z0-9]+$/i, '');
                }
                ingotsByName[name] = {
                    name: name,
                    materialId: materialId,
                    count: 0
                };
            }
            ingotsByName[name].count++;
        });

        // Convert to array for dropdown
        const availableIngots = Object.values(ingotsByName);

        // Show the forge UI with ingot selection (even if no ingots available)
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
        // Hide default forge state, show work state
        const defaultState = document.getElementById('forge-default-state');
        const workState = document.getElementById('forge-work-state');

        if (defaultState) defaultState.style.display = 'none';
        if (workState) workState.style.display = 'flex';

        // Hide ingot smelting work area, show weapon hammering work area
        const ingotForgeArea = document.querySelector('.forge-work-area');
        const weaponForgeArea = document.getElementById('weapon-forge-work-area');

        if (ingotForgeArea) ingotForgeArea.style.display = 'none';
        if (weaponForgeArea) weaponForgeArea.style.display = 'grid';

        // Show weapon-specific UI elements (buttons and progress indicator)
        const weaponActionBar = document.querySelector('.weapon-forge-action-bar');
        const weaponStageProgress = document.getElementById('weapon-stage-progress');
        if (weaponActionBar) weaponActionBar.style.display = 'flex';
        if (weaponStageProgress) weaponStageProgress.style.display = 'flex';

        // Hide ingot smelting UI elements (they're at the bottom of the shared container)
        const forgeStageProgress = document.getElementById('forge-stage-progress');
        const forgeActionBar = document.querySelector('.forge-action-bar');
        if (forgeStageProgress) forgeStageProgress.style.display = 'none';
        if (forgeActionBar) forgeActionBar.style.display = 'none';

        // Update forge item info
        document.getElementById('forge-item-name').textContent = weaponType.displayName;
        document.getElementById('forge-item-description').textContent = weaponType.description;

        // Calculate total ingot count
        const totalIngotCount = availableIngots.reduce((sum, ingot) => sum + ingot.count, 0);
        const hasIngots = totalIngotCount > 0;

        // Show dropdown and materials list inline
        const materialsListHTML = `
            <div style="display: grid; grid-template-columns: 2fr auto; gap: 0.5rem; align-items: start;">
                <select id="ingot-selector" style="height: 100%;">
                    <option value="">-- Choose Ingot --</option>
                    ${availableIngots.map(ingot => {
                        // Get material data for icon
                        const material = materialsData.find(m => m.id === ingot.materialId);
                        const icon = material ? material.icon : '🔶';
                        return `<option value="${ingot.materialId}" data-name="${ingot.name}">${icon} ${ingot.name} x${ingot.count}</option>`;
                    }).join('')}
                </select>
                <div class="material-item" style="margin: 0; padding: 0.5rem;">
                    <span class="material-icon">⚙️</span>
                    <span class="material-name">Metal Ingot</span>
                    <span class="material-count ${hasIngots ? 'sufficient' : 'insufficient'}">${totalIngotCount} / 1</span>
                </div>
            </div>
        `;

        document.getElementById('forge-materials-list').innerHTML = materialsListHTML;

        // Add event listener to dropdown
        const dropdown = document.getElementById('ingot-selector');
        if (dropdown) {
            dropdown.addEventListener('change', (e) => {
                const ingotId = e.target.value;

                if (ingotId) {
                    // Store selected ingot and weapon type
                    selectedIngotId = ingotId;
                    selectedWeaponType = weaponType;

                    // Get metal material data for display
                    const metal = materialsData.find(m => m.id === ingotId);

                    if (metal) {
                        // Update forge item name to include metal type
                        document.getElementById('forge-item-name').textContent = `${weaponType.displayName} (${metal.name})`;

                        // Update materials list to show selected ingot
                        document.getElementById('forge-materials-list').innerHTML = `
                            <div class="material-item">
                                <span class="material-icon">${metal.icon}</span>
                                <span class="material-name">${metal.name}</span>
                                <span class="material-count sufficient">1 / 1 (ready)</span>
                            </div>
                        `;

                        // Enable the "Start Hammering" button
                        const startBtn = document.getElementById('start-weapon-forge-btn');
                        if (startBtn) {
                            startBtn.disabled = false;
                        }
                    }
                } else {
                    // No ingot selected - disable button
                    selectedIngotId = null;
                    selectedWeaponType = null;
                    const startBtn = document.getElementById('start-weapon-forge-btn');
                    if (startBtn) {
                        startBtn.disabled = true;
                    }
                }
            });
        }

        // Initially disable the "Start Hammering" button
        const startBtn = document.getElementById('start-weapon-forge-btn');
        if (startBtn) {
            startBtn.disabled = true;
        }
    }

    /**
     * Start the hammering minigame
     */
    function startHammering(ingotId, weaponType) {
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

        // Hide only the "Start Hammering" button (keep Cancel button visible)
        const startBtn = document.getElementById('start-weapon-forge-btn');
        if (startBtn) startBtn.style.display = 'none';

        // Mark the HAMMER stage as active
        const weaponStageProgress = document.getElementById('weapon-stage-progress');
        if (weaponStageProgress) {
            const hammerStep = weaponStageProgress.querySelector('[data-stage="hammer"]');
            if (hammerStep) {
                hammerStep.classList.add('active');
            }
        }

        // Create callback to consume ingot when hammering actually starts
        const consumeIngotCallback = () => {
            removeItemById(ingotId);

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
        // Mark the HAMMER stage as completed
        const weaponStageProgress = document.getElementById('weapon-stage-progress');
        if (weaponStageProgress) {
            const hammerStep = weaponStageProgress.querySelector('[data-stage="hammer"]');
            if (hammerStep) {
                hammerStep.classList.remove('active');
                hammerStep.classList.add('completed');
            }
        }

        // Activate quenching stage
        const quenchStep = weaponStageProgress.querySelector('[data-stage="quench"]');
        if (quenchStep) {
            quenchStep.classList.add('active');
        }

        // Automatically start quenching phase (no modal)
        startQuenching(result);
    }

    /**
     * Start the quenching phase
     */
    function startQuenching(hammeringResult) {
        // Get metal data
        const metal = materialsData.find(m => m.id === hammeringResult.metal.id);
        if (!metal) {
            console.error('[WeaponSmithingController] Metal not found:', hammeringResult.metal.id);
            return;
        }

        // Start quenching minigame
        if (window.WeaponHeadQuenching) {
            window.WeaponHeadQuenching.start(
                metal,
                hammeringResult.weaponType,
                hammeringResult.quality,
                hammeringConfig.quenchingConfig,
                handleQuenchingComplete
            );
        } else {
            console.error('[WeaponSmithingController] WeaponHeadQuenching module not loaded');
        }
    }

    /**
     * Handle quenching completion callback
     */
    function handleQuenchingComplete(result) {
        // Mark quenching stage as completed
        const weaponStageProgress = document.getElementById('weapon-stage-progress');
        if (weaponStageProgress) {
            const quenchStep = weaponStageProgress.querySelector('[data-stage="quench"]');
            if (quenchStep) {
                quenchStep.classList.remove('active');
                quenchStep.classList.add('completed');
            }
        }

        // Automatically proceed to grinding phase after brief delay
        setTimeout(() => {
            startGrindingPhase(result);
        }, 500);
    }

    /**
     * Start the grinding phase (Phase 3)
     */
    function startGrindingPhase(quenchingResult) {
        // Close modal
        if (window.Modal) {
            window.Modal.hide();
        }

        // Mark grinding stage as active
        const weaponStageProgress = document.getElementById('weapon-stage-progress');
        if (weaponStageProgress) {
            const grindStep = weaponStageProgress.querySelector('[data-stage="grind"]');
            if (grindStep) {
                grindStep.classList.add('active');
            }
        }

        // Transition from forge area to grinding area
        const hammeringArea = document.querySelector('.hammering-area');
        const grindingArea = document.getElementById('grinding-area');

        if (hammeringArea && grindingArea) {
            // Show grinding area first (off-screen to the right)
            grindingArea.style.display = 'block';

            // Force reflow to ensure display change is applied
            grindingArea.offsetHeight;

            // Start slide transition on next frame
            requestAnimationFrame(() => {
                hammeringArea.classList.add('transitioning-out');
                grindingArea.classList.add('active');
            });

            // Wait for transition to complete, then start grinding
            setTimeout(() => {
                if (window.WeaponHeadGrinding) {
                    window.WeaponHeadGrinding.start(
                        quenchingResult.metal,
                        quenchingResult.weaponType,
                        quenchingResult.hammeringQuality,
                        quenchingResult.quenchingQuality,
                        hammeringConfig.grindingConfig,
                        handleGrindingComplete
                    );
                } else {
                    console.error('[WeaponSmithingController] WeaponHeadGrinding module not loaded');
                }
            }, 1300); // Match CSS transition duration (1.2s + 100ms buffer)
        }
    }

    /**
     * Handle grinding completion callback
     */
    function handleGrindingComplete(result) {
        // Mark grinding stage as completed
        const weaponStageProgress = document.getElementById('weapon-stage-progress');
        if (weaponStageProgress) {
            const grindStep = weaponStageProgress.querySelector('[data-stage="grind"]');
            if (grindStep) {
                grindStep.classList.remove('active');
                grindStep.classList.add('completed');
            }
        }

        const qualityGrade = getQualityGrade(result.finalQuality);

        // Show final completion modal
        if (window.Modal) {
            window.Modal.show({
                title: 'Weapon Head Complete!',
                content: `
                    <div style="text-align: center;">
                        <p style="font-size: 1.2rem; color: #cbd5e1; margin: 1rem 0;">
                            ${result.weaponType.displayName} crafting complete!
                        </p>
                        <div style="font-size: 3rem; margin: 1rem 0;">⚔️</div>
                        <div style="font-size: 1.8rem; font-weight: 700; color: #f59e0b; margin: 1rem 0;">
                            ${qualityGrade}
                        </div>
                        <div style="color: #94a3b8; margin: 0.5rem 0;">
                            Hammering: ${Math.round(result.hammeringQuality)}%
                        </div>
                        <div style="color: #94a3b8; margin: 0.5rem 0;">
                            Quenching: ${Math.round(result.quenchingQuality)}%
                        </div>
                        <div style="color: #94a3b8; margin: 0.5rem 0;">
                            Grinding: ${Math.round(result.grindingQuality)}%
                        </div>
                        <div style="color: #10b981; font-weight: bold; font-size: 1.3rem; margin: 1.5rem 0;">
                            Final Quality: ${Math.round(result.finalQuality)}%
                        </div>
                        <p style="color: #64748b; margin-top: 1rem; font-size: 0.9rem;">
                            The weapon head has been added to your inventory.
                        </p>
                    </div>
                `,
                buttons: [
                    {
                        text: 'Complete',
                        class: 'modal-btn-primary',
                        onClick: () => finalizeWeaponHead(result)
                    }
                ]
            });
        } else {
            alert(`Weapon head complete! Final Quality: ${Math.round(result.finalQuality)}%`);
            finalizeWeaponHead(result);
        }
    }

    /**
     * Finalize weapon head and add to inventory
     */
    function finalizeWeaponHead(result) {
        // Close modal
        if (window.Modal) {
            window.Modal.hide();
        }

        // TODO: Create weapon head item and add to inventory
        // For now, just log the result
        console.log('[WeaponSmithingController] Weapon head crafted:', {
            type: result.weaponType.id,
            metal: result.metal.id,
            quality: Math.round(result.finalQuality),
            grade: getQualityGrade(result.finalQuality)
        });

        // Award Smithing XP (200 × quality percentage)
        if (window.SkillManager) {
            const xpAmount = Math.floor(200 * (result.finalQuality / 100));
            const character = window.GameState ? window.GameState.getState().character : null;
            if (character) {
                SkillManager.addSkillXP(character, 'smithing', xpAmount);
            }
        }

        // Reset UI
        resetForgeUI();
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

        // Clean up hammering minigame
        if (window.WeaponHeadHammering && window.WeaponHeadHammering.stop) {
            window.WeaponHeadHammering.stop();
        }

        // Clean up quenching minigame
        if (window.WeaponHeadQuenching && window.WeaponHeadQuenching.stop) {
            window.WeaponHeadQuenching.stop();
        }

        // Clean up grinding minigame
        if (window.WeaponHeadGrinding && window.WeaponHeadGrinding.stop) {
            window.WeaponHeadGrinding.stop();
        }

        // Reset metal sprite back to hammering scene
        const metalSprite = document.getElementById('metal-sprite');
        const hammeringScene = document.querySelector('.hammering-scene');
        if (metalSprite && hammeringScene && metalSprite.parentElement !== hammeringScene) {
            hammeringScene.appendChild(metalSprite);
        }

        // Reset grinding area
        const grindingArea = document.getElementById('grinding-area');
        if (grindingArea) {
            grindingArea.style.display = 'none';
            grindingArea.classList.remove('active');
        }

        // Reset hammering area
        const hammeringArea = document.querySelector('.hammering-area');
        if (hammeringArea) {
            hammeringArea.classList.remove('transitioning-out');
        }

        // Reset weapon stage progress
        const weaponStageProgress = document.getElementById('weapon-stage-progress');
        if (weaponStageProgress) {
            const hammerStep = weaponStageProgress.querySelector('[data-stage="hammer"]');
            if (hammerStep) {
                hammerStep.classList.remove('active', 'completed');
            }

            const quenchStep = weaponStageProgress.querySelector('[data-stage="quench"]');
            if (quenchStep) {
                quenchStep.classList.remove('active', 'completed');
            }

            const grindStep = weaponStageProgress.querySelector('[data-stage="grind"]');
            if (grindStep) {
                grindStep.classList.remove('active', 'completed');
            }
        }

        // Show start button again
        const startBtn = document.getElementById('start-weapon-forge-btn');
        if (startBtn) startBtn.style.display = 'block';

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
            // Check both materialId and item.id for matches
            return (item.materialId === itemId) ||
                   (item.id && item.id.startsWith(itemId + '_')) ||
                   (item.id && item.id === itemId);
        }).length;
    }

    /**
     * Helper: Remove one item by ID
     */
    function removeItemById(itemId) {
        const character = window.GameState ? window.GameState.getState().character : null;
        if (!character || !window.Inventory) return;

        const itemToRemove = character.inventory.items.find(item =>
            (item.materialId === itemId) ||
            (item.id && item.id.startsWith(itemId + '_')) ||
            (item.id && item.id === itemId)
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
