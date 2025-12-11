/**
 * Smithing System Controller
 *
 * Manages the tier-based ingot smelting system with progressive minigame complexity.
 * Tier 1 (Copper, Tin): 2 stages - Heating + Pouring
 * Future tiers will add additional minigame stages.
 */

window.Smithing = (function() {
    'use strict';

    // State
    let materialsData = null;
    let selectedOreId = null;
    let selectedIngotId = null;
    let isMinigameActive = false;
    let coalInPit = 0; // Persistent coal pit state (0-10)
    const MAX_COAL = 10;

    // Initialize smithing system
    async function init() {
        // Load materials data
        try {
            const response = await fetch('data/materials.json');
            const data = await response.json();
            materialsData = data.materials;
        } catch (error) {
            console.error('[Smithing] Failed to load materials.json:', error);
            return;
        }

        // Load coal pit state from GameState
        loadCoalPitState();

        // Set up event listeners
        setupEventListeners();

        // Initialize UI
        initializeUI();

    }

    // Set up all event listeners
    function setupEventListeners() {
        // DON'T set up category/subcategory/item listeners here - smithing-ui.js handles those
        // We only handle the forge-specific buttons

        // Add coal button
        const addCoalBtn = document.getElementById('add-coal-btn');
        if (addCoalBtn) {
            addCoalBtn.addEventListener('click', handleAddCoal);
        }

        // Start forging button
        const startForgeBtn = document.getElementById('start-forge-btn');
        if (startForgeBtn) {
            startForgeBtn.addEventListener('click', handleStartForging);
        }

        // Cancel button
        const cancelForgeBtn = document.getElementById('cancel-forge-btn');
        if (cancelForgeBtn) {
            cancelForgeBtn.addEventListener('click', handleCancel);
        }
    }

    // Initialize UI to default state
    function initializeUI() {
        // Show default state
        document.getElementById('forge-default-state').style.display = 'flex';
        document.getElementById('forge-work-state').style.display = 'none';

        // Ensure crucible starts empty
        const metalGlow = document.getElementById('metal-glow');
        if (metalGlow) {
            metalGlow.style.height = '0%';
        }

        // Update coal display
        updateCoalDisplay();
    }

    // Load coal pit state from GameState
    function loadCoalPitState() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (!state) {
            console.warn('[Smithing] GameState not available, using default coal pit state');
            return;
        }

        // Ensure smithing property exists (migration for old saves)
        if (!state.smithing) {
            state.smithing = {
                coalInPit: 0
            };
        }

        // Load coal pit amount
        coalInPit = state.smithing.coalInPit || 0;

        // Load selected ore/ingot
        loadSelectedOreIngot();

        // Update the UI display
        updateCoalDisplay();

        // Update start button state if an item is selected
        if (selectedOreId && selectedIngotId) {
            updateStartButtonState();
        }
    }

    // Load selected ore/ingot from GameState
    function loadSelectedOreIngot() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (!state || !state.smithing) return;

        if (state.smithing.selectedOreId && state.smithing.selectedIngotId) {
            selectedOreId = state.smithing.selectedOreId;
            selectedIngotId = state.smithing.selectedIngotId;

            // Re-select the item in the UI
            const itemElement = document.querySelector(`[data-ore-id="${selectedOreId}"][data-ingot-id="${selectedIngotId}"]`);
            if (itemElement) {
                // Trigger the selection UI update
                itemElement.classList.add('selected');

                // Show forge work state
                document.getElementById('forge-default-state').style.display = 'none';
                document.getElementById('forge-work-state').style.display = 'flex';

                // Update forge UI with selected item info
                updateForgeUI();
            }
        }
    }

    // Save selected ore/ingot to GameState
    function saveSelectedOreIngot() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (!state) return;

        // Ensure smithing property exists
        if (!state.smithing) {
            state.smithing = {};
        }

        state.smithing.selectedOreId = selectedOreId;
        state.smithing.selectedIngotId = selectedIngotId;

        // Persist to localStorage
        if (window.SaveSystem) {
            window.SaveSystem.save();
        }
    }

    // Save coal pit state to GameState and persist to localStorage
    function saveCoalPitState() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (!state) {
            console.warn('[Smithing] GameState not available, cannot save coal pit state');
            return;
        }

        // Ensure smithing property exists
        if (!state.smithing) {
            state.smithing = {};
        }

        // Save coal pit amount
        state.smithing.coalInPit = coalInPit;

        // Persist to localStorage
        if (window.SaveSystem) {
            window.SaveSystem.save();
        }
    }

    // Handle smithing item click (select ingot to craft)
    // Called by smithing-ui.js
    function handleItemClick(event, item) {
        if (isMinigameActive) {
            return;
        }

        // If item wasn't passed, get it from currentTarget (for backward compatibility)
        if (!item) {
            item = event.currentTarget;
        }

        const oreId = item.dataset.oreId;
        const ingotId = item.dataset.ingotId;

        // Skip if this isn't an ore/ingot item (might be weapon component)
        if (!oreId && !ingotId) {
            return;
        }

        // Deselect all items
        document.querySelectorAll('.smithing-item').forEach(i => {
            i.classList.remove('selected');
        });

        // Select this item
        item.classList.add('selected');
        selectedOreId = oreId;
        selectedIngotId = ingotId;

        // Show forge work state
        document.getElementById('forge-default-state').style.display = 'none';
        document.getElementById('forge-work-state').style.display = 'flex';

        // Show ingot smelting work area, hide weapon hammering work area
        const ingotForgeArea = document.querySelector('.forge-work-area');
        const weaponForgeArea = document.getElementById('weapon-forge-work-area');

        if (ingotForgeArea) ingotForgeArea.style.display = 'grid';
        if (weaponForgeArea) weaponForgeArea.style.display = 'none';

        // Show ingot smelting UI elements (at bottom), hide weapon UI elements
        const forgeStageProgress = document.getElementById('forge-stage-progress');
        const forgeActionBar = document.querySelector('.forge-action-bar');
        const weaponStageProgress = document.getElementById('weapon-stage-progress');
        const weaponActionBar = document.querySelector('.weapon-forge-action-bar');

        if (forgeStageProgress) forgeStageProgress.style.display = 'flex';
        if (forgeActionBar) forgeActionBar.style.display = 'flex';
        if (weaponStageProgress) weaponStageProgress.style.display = 'none';
        if (weaponActionBar) weaponActionBar.style.display = 'none';

        // Update forge UI with selected item info
        updateForgeUI();

        // Save selected ore/ingot to GameState
        saveSelectedOreIngot();
    }

    // Update forge UI with selected item details
    function updateForgeUI() {
        // Don't update if weapon hammering is active
        if (window.WeaponHeadHammering && window.WeaponHeadHammering.isActive()) {
            console.log('[Smithing] Skipping forge UI update - weapon hammering is active');
            return;
        }

        const oreMaterial = getMaterial(selectedOreId);
        const ingotMaterial = getMaterial(selectedIngotId);

        if (!oreMaterial || !ingotMaterial) {
            console.error('[Smithing] Could not find materials for:', selectedOreId, selectedIngotId);
            return;
        }

        // Update item name and description
        document.getElementById('forge-item-name').textContent = ingotMaterial.name;
        document.getElementById('forge-item-description').textContent = ingotMaterial.description;

        // Update materials required
        updateMaterialsDisplay(oreMaterial);

        // Reset minigame elements to pre-game state
        resetMinigameElements();

        // Update start button state
        updateStartButtonState();
    }

    // Update materials required display
    function updateMaterialsDisplay(oreMaterial) {
        const materialsList = document.getElementById('forge-materials-list');
        const oresRequired = oreMaterial.smithing.oresRequired;
        const oresOwned = getItemCountById(selectedOreId);

        const isSufficient = oresOwned >= oresRequired;

        materialsList.innerHTML = `
            <div class="material-item">
                <span class="material-icon">${oreMaterial.icon}</span>
                <span class="material-name">${oreMaterial.name}</span>
                <span class="material-count ${isSufficient ? 'sufficient' : 'insufficient'}">
                    ${oresOwned} / ${oresRequired}
                </span>
            </div>
        `;
    }

    // Reset minigame elements to initial state
    function resetMinigameElements() {
        // Reset temperature gauge
        const gaugeArrow = document.getElementById('gauge-arrow');
        if (gaugeArrow) {
            gaugeArrow.style.bottom = '0%';
        }

        // Hide optimal zone marker initially
        const optimalMarker = document.getElementById('optimal-zone-marker');
        if (optimalMarker) {
            optimalMarker.style.display = 'none';
        }

        // Reset crucible glow (empty until forging starts)
        const metalGlow = document.getElementById('metal-glow');
        if (metalGlow) {
            metalGlow.className = 'metal-glow temp-grey';
            metalGlow.style.height = '0%'; // Empty until forging starts
        }

        // Reset mold fill
        const moldFill = document.getElementById('mold-fill');
        if (moldFill) {
            moldFill.style.height = '0%';
            moldFill.className = 'mold-fill temp-grey';
        }

        // Disable bellows
        const bellowsContainer = document.getElementById('bellows-container');
        if (bellowsContainer) {
            bellowsContainer.classList.add('disabled');
        }

        // Disable chain and reset to top position
        const chainContainer = document.getElementById('chain-container');
        if (chainContainer) {
            chainContainer.classList.remove('active');
        }

        const chainLinks = document.querySelector('.chain-links');
        if (chainLinks) {
            chainLinks.style.height = '20px';
        }

        const chainHandle = document.querySelector('.chain-handle');
        if (chainHandle) {
            chainHandle.style.top = '10px';
        }

        // Hide proceed button
        const proceedBtn = document.getElementById('proceed-pour-btn');
        if (proceedBtn) {
            proceedBtn.style.display = 'none';
        }

        // Reset stage progress
        document.querySelectorAll('.stage-step').forEach(step => {
            step.classList.remove('active', 'completed');
        });

        // Update coal display
        updateCoalDisplay();
    }

    // Update start button enabled/disabled state
    function updateStartButtonState() {
        const startBtn = document.getElementById('start-forge-btn');
        if (!startBtn) return;

        const oreMaterial = getMaterial(selectedOreId);
        if (!oreMaterial) return;

        const oresRequired = oreMaterial.smithing.oresRequired;
        const oresOwned = getItemCountById(selectedOreId);
        const hasEnoughOres = oresOwned >= oresRequired;
        const hasCoal = coalInPit > 0;

        // Can only start if we have enough ores AND coal in the pit
        const canStart = hasEnoughOres && hasCoal;
        startBtn.disabled = !canStart;

        // Update button text to indicate why it's disabled
        if (!hasCoal && hasEnoughOres) {
            startBtn.title = 'Add coal to the heater first';
        } else if (!hasEnoughOres) {
            startBtn.title = 'Not enough ore';
        } else {
            startBtn.title = 'Start forging';
        }
    }

    // Handle add coal button click
    function handleAddCoal() {
        if (coalInPit >= MAX_COAL) {
            return;
        }

        // Check if player has coal
        const coalCount = getItemCountById('coal');
        if (coalCount === 0) {
            return;
        }

        // Remove 1 coal from inventory
        removeItemsById('coal', 1);

        // Add 1 coal to pit
        coalInPit++;

        // Save coal pit state
        saveCoalPitState();

        // Update UI
        updateCoalDisplay();

        // Update start button state (in case it was disabled due to no coal)
        if (selectedOreId && selectedIngotId) {
            updateStartButtonState();
        }

        // If minigame is active, notify minigame system
        if (isMinigameActive && window.SmithingMinigames) {
            window.SmithingMinigames.onCoalAdded();
        }
    }

    // Update coal pit display
    function updateCoalDisplay() {
        const coalCountEl = document.getElementById('coal-count');
        if (coalCountEl) {
            coalCountEl.textContent = `${coalInPit}/${MAX_COAL}`;
        }

        const addCoalBtn = document.getElementById('add-coal-btn');
        if (addCoalBtn) {
            const coalInInventory = getItemCountById('coal');
            addCoalBtn.disabled = coalInPit >= MAX_COAL || coalInInventory === 0;
        }
    }

    // Handle start forging button click
    function handleStartForging() {
        if (isMinigameActive) {
            return;
        }

        // Check if there's coal in the pit
        if (coalInPit <= 0) {
            if (window.Modal) {
                window.Modal.show({
                    title: 'No Coal',
                    content: '<p style="text-align: center; color: #fca5a5;">You need to add coal to the heater before you can start forging.</p>',
                    buttons: [{ text: 'OK' }]
                });
            } else {
                alert('You need to add coal to the heater before you can start forging.');
            }
            return;
        }

        const oreMaterial = getMaterial(selectedOreId);
        const ingotMaterial = getMaterial(selectedIngotId);

        if (!oreMaterial || !ingotMaterial) {
            console.error('[Smithing] Materials not found');
            return;
        }

        // Check if player has enough ores
        const oresRequired = oreMaterial.smithing.oresRequired;
        const oresOwned = getItemCountById(selectedOreId);

        if (oresOwned < oresRequired) {
            return;
        }

        // Consume ores
        removeItemsById(selectedOreId, oresRequired);

        // Start minigame
        isMinigameActive = true;
        startMinigame(oreMaterial, ingotMaterial);
    }

    // Start the smelting minigame
    function startMinigame(oreMaterial, ingotMaterial) {
        // Hide start button
        const startBtn = document.getElementById('start-forge-btn');
        if (startBtn) {
            startBtn.style.display = 'none';
        }

        // Lock item selection
        document.querySelectorAll('.smithing-item').forEach(item => {
            item.style.pointerEvents = 'none';
            item.style.opacity = '0.6';
        });

        // Initialize minigame
        if (window.SmithingMinigames) {
            window.SmithingMinigames.start(oreMaterial, ingotMaterial, coalInPit, {
                onCoalConsumed: handleCoalConsumed,
                onMinigameComplete: handleMinigameComplete
            });
        } else {
            console.error('[Smithing] SmithingMinigames module not loaded');
        }
    }

    // Handle coal consumed callback
    function handleCoalConsumed() {
        if (coalInPit > 0) {
            coalInPit--;
            saveCoalPitState();
            updateCoalDisplay();
        }
    }

    // Handle minigame completion
    function handleMinigameComplete(quality, gradeName) {
        isMinigameActive = false;

        // Create ingot with quality data
        createIngot(quality, gradeName);

        // Show success popup
        showSuccessPopup(gradeName);
    }

    // Create ingot item with quality data
    function createIngot(quality, gradeName) {
        const ingotMaterial = getMaterial(selectedIngotId);
        if (!ingotMaterial) return;

        // Create item with quality embedded in the item data
        const ingotItem = {
            id: selectedIngotId,
            name: `${gradeName} ${ingotMaterial.name}`,
            icon: ingotMaterial.icon,
            description: ingotMaterial.description,
            type: ingotMaterial.type,
            classifications: ingotMaterial.classifications,
            stackable: ingotMaterial.stackable,
            rarity: ingotMaterial.rarity,
            value: Math.floor(ingotMaterial.value * (quality / 100)),
            quality: quality,
            qualityGrade: gradeName
        };

        // Add to inventory (will stack with same grade ingots)
        addItemToInventory(ingotItem);
    }

    // Show success popup
    function showSuccessPopup(gradeName) {
        const ingotMaterial = getMaterial(selectedIngotId);
        if (!ingotMaterial) return;

        const title = 'Smelting Complete!';
        const message = `Successfully smithed a ${gradeName} ${ingotMaterial.name}`;

        if (window.Modal) {
            window.Modal.show({
                title: title,
                content: `<p style="text-align: center; font-size: 1.1rem; color: #cbd5e1; margin: 1rem 0;">${message}</p>
                          <div style="text-align: center; font-size: 3rem; margin: 1rem 0;">${ingotMaterial.icon}</div>
                          <div style="text-align: center; font-size: 1.2rem; font-weight: 700; color: #f59e0b; margin: 1rem 0;">${gradeName}</div>`,
                buttons: [
                    {
                        text: 'Collect Ingot',
                        onClick: handleCollectIngot
                    }
                ]
            });
        } else {
            // Fallback if Modal not available
            alert(message);
            handleCollectIngot();
        }
    }

    // Handle collect ingot button in success popup
    function handleCollectIngot() {
        // Close modal
        if (window.Modal) {
            window.Modal.hide();
        }

        // Reset minigame state but KEEP the selection
        resetMinigameAfterCompletion();
    }

    // Reset minigame elements after successful completion (keeps selection)
    function resetMinigameAfterCompletion() {
        // Unlock item selection
        document.querySelectorAll('.smithing-item').forEach(item => {
            item.style.pointerEvents = '';
            item.style.opacity = '';
        });

        // Reset minigame elements
        resetMinigameElements();

        // Show start button again
        const startBtn = document.getElementById('start-forge-btn');
        if (startBtn) {
            startBtn.style.display = 'block';
        }

        // Update forge UI to refresh materials count
        if (selectedOreId && selectedIngotId) {
            updateForgeUI();
        }

        // Update UI (inventory changed)
        if (window.updateUI) {
            window.updateUI();
        }
    }

    // Handle cancel button click
    function handleCancel() {
        if (!isMinigameActive) {
            // Just return to default state
            resetToDefaultState();
            return;
        }

        // Confirm cancellation
        if (window.Modal) {
            window.Modal.show({
                title: 'Cancel Smelting?',
                content: '<p style="text-align: center; color: #fca5a5; margin: 1rem 0;">Materials will be lost. Coal will remain in the pit.</p>',
                buttons: [
                    {
                        text: 'Cancel',
                        class: 'modal-btn-secondary'
                    },
                    {
                        text: 'Confirm',
                        class: 'modal-btn-primary',
                        onClick: confirmCancel
                    }
                ]
            });
        } else {
            if (confirm('Cancel smelting? Materials will be lost.')) {
                confirmCancel();
            }
        }
    }

    // Confirm cancel action
    function confirmCancel() {
        // Stop minigame if active
        if (isMinigameActive && window.SmithingMinigames) {
            window.SmithingMinigames.stop();
        }

        isMinigameActive = false;

        // Close modal
        if (window.Modal) {
            window.Modal.hide();
        }

        // Reset to default state
        resetToDefaultState();
    }

    // Reset to default state (no selection)
    function resetToDefaultState() {
        // Deselect all items
        document.querySelectorAll('.smithing-item').forEach(item => {
            item.classList.remove('selected');
            item.style.pointerEvents = '';
            item.style.opacity = '';
        });

        selectedOreId = null;
        selectedIngotId = null;

        // Clear saved selection from GameState
        saveSelectedOreIngot();

        // Show default state
        document.getElementById('forge-default-state').style.display = 'flex';
        document.getElementById('forge-work-state').style.display = 'none';

        // Show start button again
        const startBtn = document.getElementById('start-forge-btn');
        if (startBtn) {
            startBtn.style.display = 'block';
        }

        // Empty the crucible
        const metalGlow = document.getElementById('metal-glow');
        if (metalGlow) {
            metalGlow.style.height = '0%';
        }

        // Update coal display
        updateCoalDisplay();

        // Update UI if character tab is active
        if (window.updateUI) {
            window.updateUI();
        }
    }

    // Get material by ID
    function getMaterial(id) {
        if (!materialsData) return null;
        return materialsData.find(m => m.id === id);
    }

    // Helper: Count items of a specific ID in character's inventory
    function getItemCountById(itemId) {
        const character = window.GameState ? window.GameState.getState().character : null;
        if (!character || !character.inventory || !character.inventory.items) return 0;

        // ItemFactory generates IDs like "copper_ore_1234567890_abc123"
        // We need to count items whose ID starts with the base ID
        return character.inventory.items.filter(item => {
            return item.id && item.id.startsWith(itemId + '_');
        }).length;
    }

    // Helper: Remove multiple items by ID from character's inventory
    function removeItemsById(itemId, count) {
        const character = window.GameState ? window.GameState.getState().character : null;
        if (!character || !window.Inventory) return;

        // Find and remove items that match the base ID
        let removed = 0;
        while (removed < count && character.inventory.items.length > 0) {
            const itemToRemove = character.inventory.items.find(item =>
                item.id && item.id.startsWith(itemId + '_')
            );

            if (itemToRemove) {
                window.Inventory.removeItem(character.inventory, itemToRemove.id);
                removed++;
            } else {
                break; // No more items to remove
            }
        }
    }

    // Helper: Add item to character's inventory
    function addItemToInventory(item) {
        const character = window.GameState ? window.GameState.getState().character : null;
        if (!character || !window.Inventory) return;

        window.Inventory.addItem(character.inventory, item);
    }

    // Public API
    return {
        init,
        loadCoalPitState,
        getCoalInPit: () => coalInPit,
        setCoalInPit: (amount) => {
            coalInPit = Math.max(0, Math.min(MAX_COAL, amount));
            saveCoalPitState();
            updateCoalDisplay();
        },
        // Expose for smithing-ui.js to call
        handleItemClick
    };

})();
