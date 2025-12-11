/**
 * Weapon Head Hammering Minigame
 *
 * Phase 1 of weapon head smithing: Hammering
 * - Three sprite stages: ingot → worked metal → weapon head
 * - Temperature system with color tinting (no gauge)
 * - Drag and drop between forge and anvil
 * - Timing-based hammering minigame
 * - Quality tracking for final weapon
 */

window.WeaponHeadHammering = (function() {
    'use strict';

    // Configuration
    let hammeringConfig = null;
    let selectedMetal = null; // { id, name, tier, baseColor }
    let selectedWeaponType = null; // { id, name, spriteConfig }

    // State
    const SPRITE_STAGES = {
        INGOT: 'ingot',
        WORKED: 'worked',
        FINISHED: 'finished'
    };

    const METAL_POSITIONS = {
        FORGE: 'forge',
        ANVIL: 'anvil'
    };

    const TEMPERATURE_STATES = {
        UNHEATED: 'unheated',
        RED: 'red',
        ORANGE_RED: 'orangeRed',
        YELLOW: 'yellow',
        BRIGHT_YELLOW: 'brightYellow',
        WHITE: 'white'
    };

    let currentSpriteStage = SPRITE_STAGES.INGOT;
    let currentPosition = METAL_POSITIONS.ANVIL; // Start on anvil
    let temperature = 0; // 0-100 scale
    let isDragging = false;
    let isMinigameActive = false;

    let successfulHammers = 0;
    let hammersToWorked = 2; // Default tier 1
    let hammersToWeapon = 3; // Always 3
    let totalHammersNeeded = 5;

    let qualityScores = [];
    let averageQuality = 0;

    let temperatureUpdateInterval = null;
    let overheatPenaltyInterval = null;

    // Timing bar state
    let timingBarActive = false;
    let markerPosition = 0; // 0-100%
    let markerDirection = 1; // 1 = right, -1 = left
    let perfectZoneStart = 0;
    let perfectZoneWidth = 60;
    let okZoneWidth = 100;
    let timingBarInterval = null;
    let timingBarAnimationId = null;

    // Sprite elements
    let metalSprite = null;
    let metalSpriteImg = null;

    // Callbacks
    let onComplete = null;
    let onConsumeIngot = null;
    let ingotConsumed = false;

    // State flag
    let isHammeringActive = false;

    /**
     * Initialize the hammering system
     */
    async function init() {
        // Load configuration
        try {
            const response = await fetch('data/hammering-config.json');
            hammeringConfig = await response.json();
        } catch (error) {
            console.error('[WeaponHeadHammering] Failed to load hammering-config.json:', error);
            return false;
        }

        return true;
    }

    /**
     * Start the hammering phase
     * @param {Object} metal - Metal material data (from materials.json)
     * @param {Object} weaponType - Weapon type data (from hammering-config.json)
     * @param {Function} completeCallback - Called when hammering is complete
     * @param {Function} consumeIngotCallback - Called when ingot should be consumed (optional)
     */
    function start(metal, weaponType, completeCallback, consumeIngotCallback) {
        selectedMetal = {
            id: metal.id,
            name: metal.name,
            tier: metal.smithing.tier,
            baseColor: metal.smithing.baseColor || hammeringConfig.temperatureColors.unheated
        };

        selectedWeaponType = weaponType;
        onComplete = completeCallback;
        onConsumeIngot = consumeIngotCallback;
        ingotConsumed = false;

        // Get tier configuration
        const tierConfig = hammeringConfig.materialTiers.find(t => t.tier === selectedMetal.tier);
        if (tierConfig) {
            hammersToWorked = tierConfig.hammerToWorked;
            hammersToWeapon = tierConfig.hammerToWeapon;
            perfectZoneWidth = tierConfig.perfectZoneWidth;
            okZoneWidth = tierConfig.okZoneWidth;
        }

        totalHammersNeeded = hammersToWorked + hammersToWeapon;

        // Reset state
        currentSpriteStage = SPRITE_STAGES.INGOT;
        currentPosition = METAL_POSITIONS.ANVIL;
        temperature = 0;
        successfulHammers = 0;
        qualityScores = [];
        averageQuality = 0;
        isDragging = false;
        isMinigameActive = false;
        timingBarActive = false;

        // Set active flag
        isHammeringActive = true;

        // Initialize UI
        createHammeringUI();
        loadSprite();
        startTemperatureSystem();
        setupDragAndDrop();
    }

    /**
     * Stop the hammering phase
     */
    function stop() {
        // Clear active flag
        isHammeringActive = false;

        // Clear intervals
        if (temperatureUpdateInterval) {
            clearInterval(temperatureUpdateInterval);
            temperatureUpdateInterval = null;
        }

        if (overheatPenaltyInterval) {
            clearInterval(overheatPenaltyInterval);
            overheatPenaltyInterval = null;
        }

        if (timingBarInterval) {
            clearInterval(timingBarInterval);
            timingBarInterval = null;
        }

        if (timingBarAnimationId) {
            cancelAnimationFrame(timingBarAnimationId);
            timingBarAnimationId = null;
        }

        // Remove event listeners
        removeDragAndDropListeners();

        // Clear UI
        destroyHammeringUI();
    }

    /**
     * Initialize the hammering UI elements (they already exist in HTML)
     */
    function createHammeringUI() {
        // Get references to existing elements
        metalSprite = document.getElementById('metal-sprite');
        metalSpriteImg = document.getElementById('metal-sprite-img');

        if (!metalSprite || !metalSpriteImg) {
            console.error('[WeaponHeadHammering] Could not find metal sprite elements');
            return;
        }

        // Reset metal sprite position to center (will move to anvil when dragged)
        metalSprite.style.left = '50%';
        metalSprite.style.top = '50%';
        metalSprite.style.display = 'block'; // Make sprite visible when minigame starts

        // Update hammer total display
        const hammerTotal = document.getElementById('hammer-total');
        if (hammerTotal) {
            hammerTotal.textContent = totalHammersNeeded;
        }

        // Reset progress
        const hammerCount = document.getElementById('hammer-count');
        if (hammerCount) {
            hammerCount.textContent = '0';
        }

        const progressFill = document.getElementById('hammer-progress-fill');
        if (progressFill) {
            progressFill.style.width = '0%';
        }

        // Reset quality
        const qualityDisplay = document.getElementById('current-quality');
        if (qualityDisplay) {
            qualityDisplay.textContent = '0%';
        }

        // Hide timing bar initially
        const timingBarContainer = document.getElementById('timing-bar-container');
        if (timingBarContainer) {
            timingBarContainer.style.display = 'none';
        }
    }

    /**
     * Reset the hammering UI to initial state
     */
    function destroyHammeringUI() {
        // Reset metal sprite position
        const metalSprite = document.getElementById('metal-sprite');
        if (metalSprite) {
            metalSprite.style.left = '50%';
            metalSprite.style.top = '50%';
            metalSprite.style.display = 'none'; // Hide sprite when minigame ends
        }

        // Reset metal sprite image
        const metalSpriteImg = document.getElementById('metal-sprite-img');
        if (metalSpriteImg) {
            metalSpriteImg.src = '';
        }

        // Hide timing bar
        const timingBarContainer = document.getElementById('timing-bar-container');
        if (timingBarContainer) {
            timingBarContainer.style.display = 'none';
        }

        // Reset progress
        const hammerCount = document.getElementById('hammer-count');
        if (hammerCount) {
            hammerCount.textContent = '0';
        }

        const progressFill = document.getElementById('hammer-progress-fill');
        if (progressFill) {
            progressFill.style.width = '0%';
        }

        // Reset quality
        const qualityDisplay = document.getElementById('current-quality');
        if (qualityDisplay) {
            qualityDisplay.textContent = '0%';
        }
    }

    /**
     * Load the appropriate sprite for the current stage
     */
    function loadSprite() {
        if (!metalSpriteImg || !selectedMetal || !selectedWeaponType) return;

        const spriteConfig = selectedWeaponType.spriteConfig;
        let spritePath = '';

        // Get sprite path based on current stage
        switch (currentSpriteStage) {
            case SPRITE_STAGES.INGOT:
                spritePath = spriteConfig.ingot;
                break;
            case SPRITE_STAGES.WORKED:
                spritePath = spriteConfig.worked;
                break;
            case SPRITE_STAGES.FINISHED:
                spritePath = spriteConfig.finished;
                break;
        }

        // Replace {metal} placeholder with actual metal name (remove "Ingot" suffix if present)
        let metalName = selectedMetal.name;
        // Remove " Ingot" suffix if it exists
        metalName = metalName.replace(/\s*Ingot$/i, '');
        // Capitalize first letter
        metalName = metalName.charAt(0).toUpperCase() + metalName.slice(1);
        spritePath = spritePath.replace('{metal}', metalName);

        metalSpriteImg.src = spritePath;

        // Apply current temperature color
        updateSpriteTemperatureColor();
    }

    /**
     * Update sprite color based on temperature
     */
    function updateSpriteTemperatureColor() {
        if (!metalSpriteImg) return;

        let color = selectedMetal.baseColor;

        // Determine temperature state
        if (temperature < 20) {
            color = selectedMetal.baseColor; // Unheated
        } else if (temperature < 40) {
            color = hammeringConfig.temperatureColors.red;
        } else if (temperature < 60) {
            color = hammeringConfig.temperatureColors.orangeRed;
        } else if (temperature < 80) {
            color = hammeringConfig.temperatureColors.yellow;
        } else if (temperature < 90) {
            color = hammeringConfig.temperatureColors.brightYellow;
        } else {
            color = hammeringConfig.temperatureColors.white;
        }

        // Apply color tint using CSS filter
        // This is a simple approach - a more sophisticated method would use canvas or SVG filters
        metalSpriteImg.style.filter = `drop-shadow(0 0 10px ${color}) brightness(${1 + (temperature / 100)})`;
    }

    /**
     * Start the temperature system
     */
    function startTemperatureSystem() {
        // Update temperature every 100ms
        temperatureUpdateInterval = setInterval(() => {
            updateTemperature();
            updateSpriteTemperatureColor();
            updateQualityDisplay();
        }, 100);

        // Check for overheat penalty every second
        overheatPenaltyInterval = setInterval(() => {
            applyOverheatPenalty();
        }, 1000);
    }

    /**
     * Update temperature based on position
     */
    function updateTemperature() {
        const tierConfig = hammeringConfig.materialTiers.find(t => t.tier === selectedMetal.tier);
        if (!tierConfig) return;

        if (currentPosition === METAL_POSITIONS.FORGE) {
            // Consume ingot when player first places metal in forge
            if (!ingotConsumed && onConsumeIngot) {
                onConsumeIngot();
                ingotConsumed = true;
            }

            // Heat up in forge
            temperature = Math.min(100, temperature + tierConfig.heatingRate);
        } else if (currentPosition === METAL_POSITIONS.ANVIL) {
            // Cool down on anvil
            temperature = Math.max(0, temperature - tierConfig.coolingRate);

            // Auto-cancel minigame if temperature drops too low
            if (timingBarActive && temperature < hammeringConfig.temperatureThresholds.workableMin) {
                autoCancelMinigame('Metal too cold to work');
            }
        }
    }

    /**
     * Apply quality penalty if overheating in forge
     */
    function applyOverheatPenalty() {
        if (currentPosition !== METAL_POSITIONS.FORGE) return;

        const thresholds = hammeringConfig.temperatureThresholds;

        if (temperature >= thresholds.extremeOverheat) {
            // Extreme overheat: -10% quality per second
            averageQuality = Math.max(0, averageQuality - 10);
        } else if (temperature >= thresholds.overheat) {
            // Regular overheat: -1% quality per second
            averageQuality = Math.max(0, averageQuality - 1);
        }
    }

    /**
     * Setup drag and drop mechanics
     */
    function setupDragAndDrop() {
        if (!metalSprite) return;

        metalSprite.addEventListener('mousedown', handleSpriteMouseDown);
        metalSprite.addEventListener('click', handleSpriteClick);
    }

    /**
     * Remove drag and drop listeners
     */
    function removeDragAndDropListeners() {
        if (!metalSprite) return;

        metalSprite.removeEventListener('mousedown', handleSpriteMouseDown);
        metalSprite.removeEventListener('click', handleSpriteClick);
        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('mouseup', handleDocumentMouseUp);
    }

    /**
     * Handle sprite mouse down (start drag)
     */
    function handleSpriteMouseDown(event) {
        // Can't drag during minigame
        if (timingBarActive) return;

        event.preventDefault();
        isDragging = true;

        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp);
    }

    /**
     * Handle document mouse move (dragging)
     */
    function handleDocumentMouseMove(event) {
        if (!isDragging || !metalSprite) return;

        event.preventDefault();

        // Update sprite position to follow mouse
        const forgeWorkArea = document.querySelector('.hammering-scene');
        if (!forgeWorkArea) return;

        const rect = forgeWorkArea.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        metalSprite.style.left = `${x}px`;
        metalSprite.style.top = `${y}px`;
    }

    /**
     * Handle document mouse up (end drag, check drop target)
     */
    function handleDocumentMouseUp(event) {
        if (!isDragging) return;

        event.preventDefault();
        isDragging = false;

        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('mouseup', handleDocumentMouseUp);

        // Check drop target
        checkDropTarget(event.clientX, event.clientY);
    }

    /**
     * Check which element the sprite was dropped on
     */
    function checkDropTarget(clientX, clientY) {
        const forge = document.getElementById('hammering-forge');
        const anvil = document.getElementById('hammering-anvil');

        if (!forge || !anvil) return;

        const forgeRect = forge.getBoundingClientRect();
        const anvilRect = anvil.getBoundingClientRect();

        const isOverForge = (
            clientX >= forgeRect.left &&
            clientX <= forgeRect.right &&
            clientY >= forgeRect.top &&
            clientY <= forgeRect.bottom
        );

        const isOverAnvil = (
            clientX >= anvilRect.left &&
            clientX <= anvilRect.right &&
            clientY >= anvilRect.top &&
            clientY <= anvilRect.bottom
        );

        if (isOverForge) {
            snapToForge();
        } else if (isOverAnvil) {
            snapToAnvil();
        } else {
            // Return to last valid position
            if (currentPosition === METAL_POSITIONS.FORGE) {
                snapToForge();
            } else {
                snapToAnvil();
            }
        }
    }

    /**
     * Snap sprite to forge position
     */
    function snapToForge() {
        currentPosition = METAL_POSITIONS.FORGE;

        if (metalSprite) {
            metalSprite.style.left = '100px';
            metalSprite.style.top = '50%';
        }
    }

    /**
     * Snap sprite to anvil position
     */
    function snapToAnvil() {
        currentPosition = METAL_POSITIONS.ANVIL;

        if (metalSprite) {
            metalSprite.style.left = '50%';
            metalSprite.style.top = '50%';
        }
    }

    /**
     * Handle sprite click (start minigame if conditions are met)
     */
    function handleSpriteClick(event) {
        event.preventDefault();

        // Can only start minigame if:
        // 1. Metal is on anvil
        // 2. Temperature is workable (red or hotter)
        // 3. Minigame is not already active

        if (timingBarActive) return;
        if (currentPosition !== METAL_POSITIONS.ANVIL) return;

        const workableMin = hammeringConfig.temperatureThresholds.workableMin;
        if (temperature < workableMin) {
            if (window.Modal) {
                window.Modal.show({
                    title: 'Metal Too Cold',
                    content: '<p style="text-align: center; color: #fca5a5;">The metal is too cold to work! Heat it in the forge first.</p>',
                    buttons: [{ text: 'OK' }]
                });
            }
            return;
        }

        startHammeringMinigame();
    }

    /**
     * Start the hammering minigame
     */
    function startHammeringMinigame() {
        timingBarActive = true;
        markerPosition = 0;
        markerDirection = 1;

        // Randomize perfect zone position
        // Account for yellow (ok) zones on both sides so they're always fully visible
        const maxStart = 100 - perfectZoneWidth - (okZoneWidth * 2);
        perfectZoneStart = okZoneWidth + (Math.random() * maxStart);

        // Show timing bar UI
        const timingBarContainer = document.getElementById('timing-bar-container');
        if (timingBarContainer) {
            timingBarContainer.style.display = 'block';
        }

        // Update zone positions
        updateTimingZones();

        // Start marker animation
        startTimingBarAnimation();

        // Listen for spacebar
        document.addEventListener('keydown', handleSpacebarPress);

        // Setup cancel button
        const cancelBtn = document.getElementById('cancel-minigame-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => autoCancelMinigame('Cancelled by player'));
        }

        // No dimming - removed for better visibility
    }

    /**
     * Update timing zone positions and widths
     */
    function updateTimingZones() {
        const perfectZone = document.getElementById('perfect-zone');
        const okZoneLeft = document.getElementById('ok-zone-left');
        const okZoneRight = document.getElementById('ok-zone-right');

        if (!perfectZone || !okZoneLeft || !okZoneRight) return;

        // Calculate zone widths in pixels (using the timing bar as reference)
        const timingBar = document.getElementById('timing-bar');
        if (!timingBar) return;

        const barWidth = timingBar.offsetWidth;
        const perfectWidthPx = (perfectZoneWidth / 100) * barWidth;
        const okWidthPx = (okZoneWidth / 100) * barWidth;

        // Calculate positions: [Yellow Left | Green Perfect | Yellow Right]
        const perfectStartPx = (perfectZoneStart / 100) * barWidth;
        const okLeftStartPx = perfectStartPx - okWidthPx;
        const okRightStartPx = perfectStartPx + perfectWidthPx;

        // Perfect zone (center, green)
        perfectZone.style.left = `${perfectStartPx}px`;
        perfectZone.style.width = `${perfectWidthPx}px`;

        // OK zones (flanking perfect, yellow) - non-overlapping
        okZoneLeft.style.left = `${okLeftStartPx}px`;
        okZoneLeft.style.width = `${okWidthPx}px`;

        okZoneRight.style.left = `${okRightStartPx}px`;
        okZoneRight.style.width = `${okWidthPx}px`;
    }

    /**
     * Start timing bar marker animation
     */
    function startTimingBarAnimation() {
        // Cancel any existing animation
        if (timingBarAnimationId) {
            cancelAnimationFrame(timingBarAnimationId);
            timingBarAnimationId = null;
        }

        const markerSpeed = hammeringConfig.hammeringDefaults.markerSpeed || 2.0;
        let lastTimestamp = performance.now();

        function animate(timestamp) {
            if (!timingBarActive) return;

            const deltaTime = timestamp - lastTimestamp;
            lastTimestamp = timestamp;

            // Update marker position (normalize to 60 FPS)
            const speedAdjustment = deltaTime / 16.67; // 16.67ms = 60 FPS frame time
            markerPosition += markerDirection * markerSpeed * speedAdjustment;

            // Reverse direction at edges
            if (markerPosition >= 100) {
                markerPosition = 100;
                markerDirection = -1;
            } else if (markerPosition <= 0) {
                markerPosition = 0;
                markerDirection = 1;
            }

            // Update marker element
            const marker = document.getElementById('timing-marker');
            if (marker) {
                marker.style.left = `${markerPosition}%`;
            }

            // Continue animation
            timingBarAnimationId = requestAnimationFrame(animate);
        }

        timingBarAnimationId = requestAnimationFrame(animate);
    }

    /**
     * Handle spacebar press during minigame
     */
    function handleSpacebarPress(event) {
        if (event.code !== 'Space') return;
        if (!timingBarActive) return;

        event.preventDefault();

        // Pause the animation to show where player hit
        timingBarActive = false; // This stops the animate loop

        // Add visual feedback - make marker glow
        const marker = document.getElementById('timing-marker');
        if (marker) {
            marker.style.boxShadow = '0 0 20px rgba(255, 255, 255, 1)';
            marker.style.width = '6px';
        }

        // Determine which zone the marker is in
        const hitZone = determineHitZone();

        // Process the hit
        processHammerHit(hitZone);

        // Resume after 200ms delay to show hit position
        setTimeout(() => {
            // Reset marker visual
            if (marker) {
                marker.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.8)';
                marker.style.width = '4px';
            }

            // Only resume if we haven't completed all hammers
            if (successfulHammers < totalHammersNeeded) {
                // Randomize perfect zone position for next hit
                const maxStart = 100 - perfectZoneWidth - (okZoneWidth * 2);
                perfectZoneStart = okZoneWidth + (Math.random() * maxStart);

                // Update zone positions with new random location
                updateTimingZones();

                // Resume the minigame
                timingBarActive = true;
                startTimingBarAnimation();
            }
        }, 200);
    }

    /**
     * Determine which zone the marker is currently in
     */
    function determineHitZone() {
        const perfectStart = perfectZoneStart;
        const perfectEnd = perfectZoneStart + perfectZoneWidth;

        const okLeftStart = Math.max(0, perfectZoneStart - okZoneWidth);
        const okLeftEnd = perfectZoneStart;

        const okRightStart = perfectEnd;
        const okRightEnd = Math.min(100, perfectEnd + okZoneWidth);

        if (markerPosition >= perfectStart && markerPosition <= perfectEnd) {
            return 'perfect';
        } else if (
            (markerPosition >= okLeftStart && markerPosition < okLeftEnd) ||
            (markerPosition > okRightStart && markerPosition <= okRightEnd)
        ) {
            return 'ok';
        } else {
            return 'bad';
        }
    }

    /**
     * Process a hammer hit
     */
    function processHammerHit(zone) {
        // Award quality based on zone
        const qualityBonus = hammeringConfig.qualityBonuses[zone] || 1;
        qualityScores.push(qualityBonus);

        // Calculate average quality
        const sum = qualityScores.reduce((a, b) => a + b, 0);
        averageQuality = Math.round((sum / qualityScores.length) * 100 / hammeringConfig.qualityBonuses.perfect);

        // Decrease temperature slightly
        const tempDecrease = hammeringConfig.hammeringDefaults.temperatureDecreasePerHit || 5;
        temperature = Math.max(0, temperature - tempDecrease);

        // Increment successful hammers
        successfulHammers++;

        // Update UI
        updateHammerProgress();
        updateQualityDisplay();

        // Visual feedback
        playHammerAnimation(zone);
        spawnSparkParticles(zone);

        // Check for sprite transition
        checkSpriteTransition();

        // Check if hammering phase is complete
        if (successfulHammers >= totalHammersNeeded) {
            // Only end the minigame when all hammers are done
            endHammeringMinigame();
            completeHammeringPhase();
        }
        // Otherwise, the minigame stays open for the next hit (resumed after 200ms delay in handleSpacebarPress)
    }

    /**
     * Update hammer progress display
     */
    function updateHammerProgress() {
        const hammerCount = document.getElementById('hammer-count');
        const hammerProgressFill = document.getElementById('hammer-progress-fill');

        if (hammerCount) {
            hammerCount.textContent = successfulHammers;
        }

        if (hammerProgressFill) {
            const progress = (successfulHammers / totalHammersNeeded) * 100;
            hammerProgressFill.style.width = `${progress}%`;
        }
    }

    /**
     * Update quality display
     */
    function updateQualityDisplay() {
        const qualityDisplay = document.getElementById('current-quality');
        if (qualityDisplay) {
            qualityDisplay.textContent = `${Math.round(averageQuality)}%`;
        }
    }

    /**
     * Play hammer strike animation
     */
    function playHammerAnimation(zone) {
        // TODO: Implement hammer swing animation
    }

    /**
     * Spawn spark particles
     */
    function spawnSparkParticles(zone) {
        const defaults = hammeringConfig.hammeringDefaults;
        let sparkCount = defaults.sparkCountBad;

        if (zone === 'perfect') {
            sparkCount = defaults.sparkCountPerfect;
        } else if (zone === 'ok') {
            sparkCount = defaults.sparkCountOK;
        }

        // TODO: Implement particle system
    }

    /**
     * End the hammering minigame
     */
    function endHammeringMinigame() {
        timingBarActive = false;

        // Hide timing bar
        const timingBarContainer = document.getElementById('timing-bar-container');
        if (timingBarContainer) {
            timingBarContainer.style.display = 'none';
        }

        // Stop marker animation
        if (timingBarInterval) {
            clearInterval(timingBarInterval);
            timingBarInterval = null;
        }

        // Remove spacebar listener
        document.removeEventListener('keydown', handleSpacebarPress);

        // No opacity changes - removed dimming feature
    }

    /**
     * Auto-cancel minigame (temperature dropped, etc.)
     */
    function autoCancelMinigame(reason) {
        endHammeringMinigame();

        // Show message to user
        if (window.Modal) {
            window.Modal.show({
                title: 'Hammering Cancelled',
                content: `<p style="text-align: center; color: #fca5a5;">${reason}</p>`,
                buttons: [{ text: 'OK' }]
            });
        }
    }

    /**
     * Check if sprite should transition to next stage
     */
    function checkSpriteTransition() {
        if (currentSpriteStage === SPRITE_STAGES.INGOT && successfulHammers >= hammersToWorked) {
            // Transition to worked metal
            currentSpriteStage = SPRITE_STAGES.WORKED;
            loadSprite();
        } else if (currentSpriteStage === SPRITE_STAGES.WORKED && successfulHammers >= totalHammersNeeded) {
            // Transition to weapon head
            currentSpriteStage = SPRITE_STAGES.FINISHED;
            loadSprite();
        }
    }

    /**
     * Complete the hammering phase
     */
    function completeHammeringPhase() {
        // Stop the system
        stop();

        // Call completion callback
        if (onComplete) {
            onComplete({
                quality: averageQuality,
                metal: selectedMetal,
                weaponType: selectedWeaponType
            });
        }
    }

    // Public API
    return {
        init,
        start,
        stop,
        isActive: () => isHammeringActive
    };

})();
