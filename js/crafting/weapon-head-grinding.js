/**
 * Weapon Head Grinding Minigame
 *
 * Phase 3 of weapon head smithing: Grinding
 * - Vertical fill bar timing minigame
 * - Multiple grinding passes based on weapon type
 * - Quality calculation per pass
 * - Grinding sparks particle system
 * - Final quality calculation combining all three phases
 */

window.WeaponHeadGrinding = (function() {
    'use strict';

    // Configuration
    let grindingConfig = null;
    let selectedMetal = null;
    let selectedWeaponType = null;
    let hammeringQuality = 0;
    let quenchingQuality = 0;

    // State
    const GRINDING_STATE = {
        IDLE: 'idle',
        FILLING: 'filling',
        EVALUATING: 'evaluating',
        COMPLETE: 'complete'
    };

    let currentState = GRINDING_STATE.IDLE;
    let isGrindingActive = false;

    // Pass tracking
    let totalPasses = 0;
    let currentPass = 0;
    let passQualities = [];
    let grindingQuality = 0;

    // Fill bar state
    let fillPercentage = 0;
    let targetPercentage = 0;
    let fillSpeed = 0;
    let isMouseDown = false;
    let lastFrameTime = 0;

    // DOM elements
    let grindingWheel = null;
    let weaponSprite = null;
    let weaponSpriteImg = null;
    let fillBarContainer = null;
    let fillBarFill = null;
    let targetLine = null;
    let passCounter = null;
    let particleContainer = null;

    // Particles
    let sparkParticles = [];
    let sparkAnimationId = null;

    // Timeout tracking (to prevent memory leaks and state pollution)
    let startPassTimeoutId = null;
    let evaluateTimeoutId = null;

    // Callbacks
    let onComplete = null;

    /**
     * Initialize the grinding system
     */
    async function init() {
        // Configuration is loaded from hammering-config.json by the controller
        return true;
    }

    /**
     * Start the grinding phase
     * @param {Object} metal - Metal material data (should have { id, name, tier, baseColor })
     * @param {Object} weaponType - Weapon type data (should have { id, name, displayName, spriteConfig })
     * @param {number} hammerQuality - Quality from hammering phase (0-100)
     * @param {number} quenchQuality - Quality from quenching phase (0-100)
     * @param {Object} config - Grinding configuration from JSON
     * @param {Function} completeCallback - Called when grinding is complete
     */
    function start(metal, weaponType, hammerQuality, quenchQuality, config, completeCallback) {
        console.log('[WeaponHeadGrinding] Starting grinding phase with:', { metal, weaponType });

        // Metal object comes from hammering/quenching and already has { id, name, tier, baseColor }
        selectedMetal = metal;
        selectedWeaponType = weaponType;
        hammeringQuality = hammerQuality;
        quenchingQuality = quenchQuality;
        grindingConfig = config;
        onComplete = completeCallback;

        // Reset state
        currentState = GRINDING_STATE.IDLE;
        currentPass = 0;
        passQualities = [];
        grindingQuality = 0;
        fillPercentage = 0;
        isMouseDown = false;
        sparkParticles = [];

        // Calculate total passes required for this weapon
        totalPasses = grindingConfig.weaponPassRequirements[weaponType.id] || 3;
        console.log(`[WeaponHeadGrinding] RESET STATE - currentPass: ${currentPass}, totalPasses: ${totalPasses}, passQualities.length: ${passQualities.length}`);

        // Calculate fill speed based on metal tier
        // Metal object already has tier property (not metal.smithing.tier)
        const metalTier = selectedMetal.tier || 1;
        const tierMultiplier = grindingConfig.fillBar.tierSpeedMultipliers[metalTier.toString()] || 1.0;
        fillSpeed = grindingConfig.fillBar.baseSpeed * tierMultiplier;

        console.log(`[WeaponHeadGrinding] Metal tier: ${metalTier}, Fill speed: ${fillSpeed}`);

        isGrindingActive = true;

        // Initialize UI
        setupGrindingUI();
        // Don't call startNextPass() yet - it will be called after dragging weapon to wheel
    }

    /**
     * Stop the grinding phase
     */
    function stop() {
        isGrindingActive = false;
        currentState = GRINDING_STATE.IDLE;

        // Stop animations
        if (sparkAnimationId) {
            cancelAnimationFrame(sparkAnimationId);
            sparkAnimationId = null;
        }

        // Clear any pending timeouts
        if (startPassTimeoutId) {
            clearTimeout(startPassTimeoutId);
            startPassTimeoutId = null;
        }
        if (evaluateTimeoutId) {
            clearTimeout(evaluateTimeoutId);
            evaluateTimeoutId = null;
        }

        // Remove event listeners
        if (fillBarContainer) {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mouseup', handleMouseUp);
        }

        // Remove weapon drag listener
        if (weaponMouseDownHandler && weaponSprite) {
            weaponSprite.removeEventListener('mousedown', weaponMouseDownHandler);
            weaponMouseDownHandler = null;
        }

        // Destroy UI
        destroyGrindingUI();
    }

    /**
     * Setup grinding UI elements
     */
    function setupGrindingUI() {
        // Get references
        grindingWheel = document.getElementById('grinding-wheel');
        weaponSprite = document.getElementById('metal-sprite');
        weaponSpriteImg = document.getElementById('metal-sprite-img');
        fillBarContainer = document.getElementById('grinding-fill-bar-container');
        fillBarFill = document.getElementById('grinding-fill-bar-fill');
        targetLine = document.getElementById('grinding-target-line');
        passCounter = document.getElementById('grinding-pass-counter');

        if (!grindingWheel || !weaponSprite || !fillBarContainer || !weaponSpriteImg) {
            console.error('[WeaponHeadGrinding] Could not find required elements');
            return;
        }

        // Move weapon sprite to grinding scene so it's visible
        const grindingScene = document.querySelector('.grinding-scene');
        if (grindingScene && weaponSprite.parentElement !== grindingScene) {
            grindingScene.appendChild(weaponSprite);
        }

        // Load the finished weapon head sprite
        loadWeaponSprite();

        // Position weapon sprite on top of anvil (anvil is at right: 35%, convert to left: 65%)
        weaponSprite.style.display = 'block';
        weaponSprite.style.opacity = '1';
        weaponSprite.style.left = 'calc(65% + 40px)'; // Anvil is at right 35%, so left is 65% + 40px to right
        weaponSprite.style.right = 'auto'; // Clear right positioning
        weaponSprite.style.top = 'calc(32% + 60px)'; // Match anvil's top position + 60px down
        weaponSprite.style.filter = 'none'; // No heat effect
        weaponSprite.style.transition = 'none'; // No transition initially

        // Hide fill bar initially
        fillBarContainer.style.display = 'none';

        // Create particle container
        if (grindingScene) {
            particleContainer = document.createElement('div');
            particleContainer.id = 'grinding-particles';
            particleContainer.className = 'grinding-particles';
            grindingScene.appendChild(particleContainer);
        }

        // Setup fill bar dimensions (for when it shows)
        fillBarContainer.style.height = `${grindingConfig.fillBar.height}px`;
        fillBarContainer.querySelector('.grinding-fill-bar').style.width = `${grindingConfig.fillBar.width}px`;

        // Setup weapon dragging
        setupWeaponDragging();
    }

    /**
     * Load the weapon head sprite for grinding
     */
    function loadWeaponSprite() {
        if (!weaponSpriteImg || !selectedMetal || !selectedWeaponType) {
            console.error('[WeaponHeadGrinding] Cannot load sprite - missing data');
            return;
        }

        const spriteConfig = selectedWeaponType.spriteConfig;
        let spritePath = spriteConfig.finished; // Use the finished weapon head sprite

        // Replace {metal} placeholder with actual metal name (remove "Ingot" suffix if present)
        let metalName = selectedMetal.name;
        // Remove " Ingot" suffix if it exists
        metalName = metalName.replace(/\s*Ingot$/i, '');
        // Convert to lowercase for folder name (e.g., "Copper" -> "copper")
        metalName = metalName.toLowerCase();
        spritePath = spritePath.replace('{metal}', metalName);

        console.log(`[WeaponHeadGrinding] Loading weapon sprite: ${spritePath}`);
        weaponSpriteImg.src = spritePath;
        weaponSpriteImg.alt = `${selectedWeaponType.displayName}`;
    }

    // Store reference to weapon drag handler so we can remove it
    let weaponMouseDownHandler = null;

    /**
     * Setup weapon dragging mechanic
     */
    function setupWeaponDragging() {
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let weaponStartLeft = 0;
        let weaponStartTop = 0;

        function handleWeaponMouseDown(event) {
            if (currentState !== GRINDING_STATE.IDLE) return;
            if (currentPass > 0) return; // Can't drag if already grinding

            event.preventDefault(); // Prevent text selection
            event.stopPropagation();

            isDragging = true;
            dragStartX = event.clientX;
            dragStartY = event.clientY;

            const weaponRect = weaponSprite.getBoundingClientRect();
            const sceneRect = weaponSprite.parentElement.getBoundingClientRect();
            weaponStartLeft = ((weaponRect.left + weaponRect.width / 2) - sceneRect.left) / sceneRect.width * 100;
            weaponStartTop = ((weaponRect.top + weaponRect.height / 2) - sceneRect.top) / sceneRect.height * 100;

            weaponSprite.style.cursor = 'grabbing';
            weaponSprite.style.transition = 'none';

            document.addEventListener('mousemove', handleWeaponDrag);
            document.addEventListener('mouseup', handleWeaponRelease);
        }

        function handleWeaponDrag(event) {
            if (!isDragging) return;

            const deltaX = event.clientX - dragStartX;
            const deltaY = event.clientY - dragStartY;
            const sceneRect = weaponSprite.parentElement.getBoundingClientRect();

            const newLeft = weaponStartLeft + (deltaX / sceneRect.width * 100);
            const newTop = weaponStartTop + (deltaY / sceneRect.height * 100);

            weaponSprite.style.left = `${newLeft}%`;
            weaponSprite.style.top = `${newTop}%`;

            // Check if near grinding wheel for highlight
            const wheelRect = grindingWheel.getBoundingClientRect();
            const weaponRect = weaponSprite.getBoundingClientRect();
            const distance = Math.hypot(
                (wheelRect.left + wheelRect.width / 2) - (weaponRect.left + weaponRect.width / 2),
                (wheelRect.top + wheelRect.height / 2) - (weaponRect.top + weaponRect.height / 2)
            );

            if (distance < 150) {
                grindingWheel.classList.add('active-hover');
            } else {
                grindingWheel.classList.remove('active-hover');
            }
        }

        function handleWeaponRelease(event) {
            if (!isDragging) return;

            isDragging = false;
            weaponSprite.style.cursor = 'grab';

            document.removeEventListener('mousemove', handleWeaponDrag);
            document.removeEventListener('mouseup', handleWeaponRelease);

            // Check if dropped on grinding wheel
            const wheelRect = grindingWheel.getBoundingClientRect();
            const weaponRect = weaponSprite.getBoundingClientRect();
            const mouseX = event.clientX;
            const mouseY = event.clientY;

            const distance = Math.hypot(
                (wheelRect.left + wheelRect.width / 2) - (weaponRect.left + weaponRect.width / 2),
                (wheelRect.top + wheelRect.height / 2) - (weaponRect.top + weaponRect.height / 2)
            );

            if (distance < 150) {
                // Start grinding!
                grindingWheel.classList.remove('active-hover');
                startGrindingMinigame();
            } else {
                // Return to anvil
                weaponSprite.style.transition = 'left 0.3s ease, right 0.3s ease, top 0.3s ease';
                weaponSprite.style.left = 'calc(65% + 40px)';
                weaponSprite.style.right = 'auto';
                weaponSprite.style.top = 'calc(32% + 60px)';
            }
        }

        // Remove old listener before adding new one (prevent duplicates)
        if (weaponMouseDownHandler) {
            weaponSprite.removeEventListener('mousedown', weaponMouseDownHandler);
        }

        // Store handler reference so we can remove it later
        weaponMouseDownHandler = handleWeaponMouseDown;
        weaponSprite.addEventListener('mousedown', handleWeaponMouseDown);
    }

    /**
     * Start the grinding minigame (after weapon dragged to wheel)
     */
    function startGrindingMinigame() {
        // Position weapon at RIGHT side of grindstone (contact point) - moved closer by adjusting calc
        weaponSprite.style.transition = 'left 0.5s ease, right 0.5s ease, top 0.5s ease';
        weaponSprite.style.left = 'calc(45% - 50px)'; // Right side of grindstone, 50px closer to left
        weaponSprite.style.right = 'auto';
        weaponSprite.style.top = '50%'; // Center vertically
        weaponSprite.style.cursor = 'default';
        weaponSprite.style.pointerEvents = 'none';

        // Show fill bar
        fillBarContainer.style.display = 'flex';

        // Remove any existing listeners first (prevent duplicates)
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mouseup', handleMouseUp);

        // Add event listeners for filling
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);

        // Start first pass (store timeout ID so we can clear it if needed)
        startPassTimeoutId = setTimeout(() => {
            startPassTimeoutId = null; // Clear the ID once executed
            startNextPass();
        }, 600);
    }

    /**
     * Start the next grinding pass
     */
    function startNextPass() {
        currentPass++;
        console.log(`[WeaponHeadGrinding] startNextPass() - currentPass INCREMENTED to: ${currentPass}, totalPasses: ${totalPasses}, passQualities.length: ${passQualities.length}`);
        currentState = GRINDING_STATE.IDLE;
        fillPercentage = 0;
        fillBarFill.style.height = '0%';

        // Update pass counter
        if (passCounter) {
            passCounter.textContent = `Pass ${currentPass} of ${totalPasses}`;
        }

        // Generate random target position across full range
        const minPercent = grindingConfig.targetLineRange.min; // 25%
        const maxPercent = grindingConfig.targetLineRange.max; // 75%
        // Generate a truly random position between min and max (25% to 75%)
        targetPercentage = minPercent + (Math.random() * (maxPercent - minPercent));

        // Position target line
        if (targetLine) {
            targetLine.style.bottom = `${targetPercentage}%`;
            targetLine.style.height = `${grindingConfig.fillBar.targetLineThickness}px`;
        }

        console.log(`[WeaponHeadGrinding] Started pass ${currentPass}/${totalPasses}, target line at: ${targetPercentage.toFixed(1)}% (range: ${minPercent}%-${maxPercent}%, variation: ${(maxPercent - minPercent)}%)`);
    }

    /**
     * Handle mouse down event
     */
    function handleMouseDown(event) {
        if (!isGrindingActive || currentState !== GRINDING_STATE.IDLE) return;

        isMouseDown = true;
        currentState = GRINDING_STATE.FILLING;
        lastFrameTime = performance.now();

        // Start fill animation
        requestAnimationFrame(updateFillBar);

        // Start spark particles
        startSparkParticles();
    }

    /**
     * Handle mouse up event
     */
    function handleMouseUp(event) {
        if (!isGrindingActive || currentState !== GRINDING_STATE.FILLING) return;

        isMouseDown = false;
        currentState = GRINDING_STATE.EVALUATING;

        // Stop spark particles
        stopSparkParticles();

        // Evaluate this pass
        evaluatePass();
    }

    /**
     * Update fill bar animation
     */
    function updateFillBar(timestamp) {
        if (!isMouseDown || currentState !== GRINDING_STATE.FILLING) return;

        const deltaTime = (timestamp - lastFrameTime) / 1000; // Convert to seconds
        lastFrameTime = timestamp;

        // Increase fill percentage
        const fillIncrease = (fillSpeed / grindingConfig.fillBar.height) * deltaTime * 100;
        fillPercentage = Math.min(100, fillPercentage + fillIncrease);

        // Update visual
        fillBarFill.style.height = `${fillPercentage}%`;

        // Continue animation
        if (isMouseDown && fillPercentage < 100) {
            requestAnimationFrame(updateFillBar);
        } else if (fillPercentage >= 100) {
            // Auto-release if reached max
            isMouseDown = false;
            currentState = GRINDING_STATE.EVALUATING;
            stopSparkParticles();
            evaluatePass();
        }
    }

    /**
     * Evaluate the current pass quality
     */
    function evaluatePass() {
        // Calculate distance from target line center in pixels
        const pixelsOff = Math.abs((fillPercentage - targetPercentage) / 100 * grindingConfig.fillBar.height);

        // New scoring system:
        // - Landing on target line (within thickness) = (100 / totalPasses)%
        // - Each pixel off = -1% penalty
        const halfThickness = grindingConfig.fillBar.targetLineThickness / 2;
        const perfectScore = 100 / totalPasses; // e.g., 25% for 4 passes

        let passQuality;
        if (pixelsOff <= halfThickness) {
            // Perfect hit - full score for this pass
            passQuality = perfectScore;
        } else {
            // Missed - lose 1% per pixel off from edge of target line
            const pixelsOffFromEdge = pixelsOff - halfThickness;
            passQuality = perfectScore - pixelsOffFromEdge;
            passQuality = Math.max(0, passQuality); // Floor at 0
        }

        // Store pass quality
        passQualities.push(passQuality);

        console.log(`[WeaponHeadGrinding] Pass ${currentPass} complete: ${passQuality.toFixed(1)}% (fill: ${fillPercentage.toFixed(1)}%, target: ${targetPercentage.toFixed(1)}%, off by: ${pixelsOff.toFixed(1)}px, perfect score: ${perfectScore.toFixed(1)}%)`);
        console.log(`[WeaponHeadGrinding] passQualities array now has ${passQualities.length} entries`);

        // Show feedback
        showPassFeedback(passQuality);

        // Check if all passes complete (store timeout ID so we can clear it if needed)
        evaluateTimeoutId = setTimeout(() => {
            evaluateTimeoutId = null; // Clear the ID once executed
            console.log(`[WeaponHeadGrinding] Checking completion - currentPass: ${currentPass}, totalPasses: ${totalPasses}, currentPass >= totalPasses: ${currentPass >= totalPasses}`);
            if (currentPass >= totalPasses) {
                completeGrinding();
            } else {
                startNextPass();
            }
        }, 1500); // Brief pause between passes
    }

    /**
     * Show visual feedback for pass quality
     */
    function showPassFeedback(quality) {
        // Flash fill bar based on quality
        const fillBar = fillBarFill;
        if (!fillBar) return;

        // Quality feedback based on percentage of perfect score achieved
        const perfectScore = 100 / totalPasses;
        const percentageOfPerfect = (quality / perfectScore) * 100;

        if (percentageOfPerfect >= 100) {
            fillBar.style.background = 'linear-gradient(to top, #10b981, #34d399)'; // Green - perfect hit
        } else if (percentageOfPerfect >= 75) {
            fillBar.style.background = 'linear-gradient(to top, #3b82f6, #60a5fa)'; // Blue - good
        } else if (percentageOfPerfect >= 50) {
            fillBar.style.background = 'linear-gradient(to top, #f59e0b, #fbbf24)'; // Yellow - okay
        } else {
            fillBar.style.background = 'linear-gradient(to top, #ef4444, #f87171)'; // Red - poor
        }

        // Reset color after delay
        setTimeout(() => {
            fillBar.style.background = 'linear-gradient(to top, #3b82f6, #60a5fa)';
        }, 1000);
    }

    /**
     * Complete the grinding phase
     */
    function completeGrinding() {
        currentState = GRINDING_STATE.COMPLETE;

        // Sum all pass qualities (each pass contributes its percentage, max 100% total)
        grindingQuality = passQualities.reduce((sum, q) => sum + q, 0);

        // Calculate final quality from all three phases
        const finalQuality = (hammeringQuality + quenchingQuality + grindingQuality) / 3;

        console.log(`[WeaponHeadGrinding] Grinding complete!`);
        console.log(`  Hammering: ${hammeringQuality.toFixed(1)}%`);
        console.log(`  Quenching: ${quenchingQuality.toFixed(1)}%`);
        console.log(`  Grinding: ${grindingQuality.toFixed(1)}%`);
        console.log(`  Final Quality: ${finalQuality.toFixed(1)}%`);

        // Return weapon to anvil
        if (weaponSprite) {
            weaponSprite.style.transition = 'left 0.8s ease, right 0.8s ease, top 0.8s ease';
            weaponSprite.style.left = 'calc(65% + 40px)';
            weaponSprite.style.right = 'auto';
            weaponSprite.style.top = 'calc(32% + 60px)';
        }

        // Hide fill bar
        if (fillBarContainer) {
            setTimeout(() => {
                fillBarContainer.style.display = 'none';
            }, 500);
        }

        // Call completion callback after weapon returns to anvil
        setTimeout(() => {
            if (onComplete) {
                onComplete({
                    hammeringQuality: hammeringQuality,
                    quenchingQuality: quenchingQuality,
                    grindingQuality: grindingQuality,
                    finalQuality: finalQuality,
                    metal: selectedMetal,
                    weaponType: selectedWeaponType
                });
            }
        }, 1000);
    }

    /**
     * Start spark particle system
     */
    function startSparkParticles() {
        if (sparkAnimationId) return;

        sparkAnimationId = requestAnimationFrame(animateSparks);
    }

    /**
     * Stop spark particle system
     */
    function stopSparkParticles() {
        if (sparkAnimationId) {
            cancelAnimationFrame(sparkAnimationId);
            sparkAnimationId = null;
        }
    }

    /**
     * Animate spark particles
     */
    function animateSparks(timestamp) {
        if (!isMouseDown || !particleContainer) return;

        // Spawn new sparks
        if (Math.random() < 0.6) { // 60% chance per frame (doubled from 30%)
            createSparkParticle();
        }

        // Continue animation
        if (isMouseDown) {
            sparkAnimationId = requestAnimationFrame(animateSparks);
        }
    }

    /**
     * Create a single spark particle
     */
    function createSparkParticle() {
        if (!particleContainer || !grindingWheel) return;

        const spark = document.createElement('div');
        spark.className = 'grinding-spark';

        // Position at contact point (right edge of wheel, moved 10px left)
        const wheelRect = grindingWheel.getBoundingClientRect();
        const sceneRect = particleContainer.parentElement.getBoundingClientRect();

        // Contact point is at the right edge of the wheel, middle height, moved 10px left
        // Add random offset to create clustered spawn points
        const baseContactX = ((wheelRect.right - 20) - sceneRect.left) / sceneRect.width * 100; // -20 instead of -10 (moved 10px left)
        const baseContactY = ((wheelRect.top + wheelRect.height / 2) - sceneRect.top) / sceneRect.height * 100;

        // Add small random offset to create a cluster of spawn points (±15px variation)
        const offsetX = (Math.random() - 0.5) * 30; // ±15px horizontal
        const offsetY = (Math.random() - 0.5) * 30; // ±15px vertical
        const contactX = baseContactX + (offsetX / sceneRect.width * 100);
        const contactY = baseContactY + (offsetY / sceneRect.height * 100);

        spark.style.left = `${contactX}%`;
        spark.style.top = `${contactY}%`;

        // Random velocity (sparks fly to the right and slightly down)
        const angle = (Math.random() - 0.3) * Math.PI / 4; // -22.5 to 22.5 degrees
        const velocity = 100 + Math.random() * 100;
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;

        spark.style.setProperty('--vx', `${vx}px`);
        spark.style.setProperty('--vy', `${vy}px`);

        particleContainer.appendChild(spark);

        // Remove after animation
        setTimeout(() => {
            if (spark.parentNode) {
                spark.parentNode.removeChild(spark);
            }
        }, 800);
    }

    /**
     * Destroy grinding UI
     */
    function destroyGrindingUI() {
        // Remove particle container
        if (particleContainer && particleContainer.parentNode) {
            particleContainer.parentNode.removeChild(particleContainer);
            particleContainer = null;
        }

        // Hide weapon sprite
        if (weaponSprite) {
            weaponSprite.style.display = 'none';
        }

        // Reset fill bar
        if (fillBarFill) {
            fillBarFill.style.height = '0%';
        }

        // Clear particles
        sparkParticles = [];
    }

    // Public API
    return {
        init,
        start,
        stop,
        isActive: () => isGrindingActive
    };

})();
