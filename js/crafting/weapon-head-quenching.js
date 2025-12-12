/**
 * Weapon Head Quenching Minigame
 *
 * Phase 2 of weapon head smithing: Quenching
 * - Click-and-hold barrel interaction
 * - Weapon submersion with visual feedback
 * - Bubble and steam particle systems
 * - Timing-based quality calculation
 * - Quality feedback and transition readiness
 */

window.WeaponHeadQuenching = (function() {
    'use strict';

    // Configuration
    let quenchingConfig = null;
    let selectedMetal = null;
    let selectedWeaponType = null;
    let hammeringQuality = 0;

    // State
    const QUENCHING_STATE = {
        IDLE: 'idle',
        HOLDING: 'holding',
        SUBMERGED: 'submerged',
        BUBBLING: 'bubbling',
        OPTIMAL_WINDOW: 'optimal_window',
        EXTRACTED: 'extracted',
        COMPLETE: 'complete'
    };

    let currentState = QUENCHING_STATE.IDLE;
    let isQuenchingActive = false;

    // Timing
    let bubblesStartTime = 0;
    let bubblesStopTime = 0;
    let extractionTime = 0;
    let bubbleAnimationId = null;
    let steamAnimationId = null;

    // Quality
    let quenchingQuality = 0;

    // DOM elements
    let barrel = null;
    let weaponSprite = null;
    let weaponSpriteImg = null;
    let particleContainer = null;

    // Particles
    let bubbles = [];
    let steamParticles = [];

    // Callbacks
    let onComplete = null;

    /**
     * Initialize the quenching system
     */
    async function init() {
        // Configuration is loaded from hammering-config.json by the controller
        return true;
    }

    /**
     * Start the quenching phase
     * @param {Object} metal - Metal material data
     * @param {Object} weaponType - Weapon type data
     * @param {number} hammerQuality - Quality from hammering phase (0-100)
     * @param {Object} config - Quenching configuration from JSON
     * @param {Function} completeCallback - Called when quenching is complete
     */
    function start(metal, weaponType, hammerQuality, config, completeCallback) {
        selectedMetal = metal;
        selectedWeaponType = weaponType;
        hammeringQuality = hammerQuality;
        quenchingConfig = config;
        onComplete = completeCallback;

        // Reset state
        currentState = QUENCHING_STATE.IDLE;
        quenchingQuality = 0;
        bubblesStartTime = 0;
        bubblesStopTime = 0;
        extractionTime = 0;
        bubbles = [];
        steamParticles = [];

        isQuenchingActive = true;

        // Initialize UI
        setupQuenchingUI();
        activateBarrel();
    }

    /**
     * Stop the quenching phase
     */
    function stop() {
        isQuenchingActive = false;

        // Cancel animations
        if (bubbleAnimationId) {
            cancelAnimationFrame(bubbleAnimationId);
            bubbleAnimationId = null;
        }

        if (steamAnimationId) {
            cancelAnimationFrame(steamAnimationId);
            steamAnimationId = null;
        }

        // Remove event listeners
        removeBarrelListeners();

        // Clean up UI
        destroyQuenchingUI();
    }

    /**
     * Setup quenching UI elements
     */
    function setupQuenchingUI() {
        // Get references
        barrel = document.getElementById('hammering-barrel');
        weaponSprite = document.getElementById('metal-sprite');
        weaponSpriteImg = document.getElementById('metal-sprite-img');

        if (!barrel || !weaponSprite || !weaponSpriteImg) {
            console.error('[WeaponHeadQuenching] Could not find required elements');
            return;
        }

        // Create particle container
        const hammeringScene = document.querySelector('.hammering-scene');
        if (hammeringScene) {
            particleContainer = document.createElement('div');
            particleContainer.id = 'quenching-particles';
            particleContainer.className = 'quenching-particles';
            hammeringScene.appendChild(particleContainer);
        }

        // Don't add water visual to barrel - removed for cleaner look
    }

    /**
     * Activate barrel for quenching interaction
     */
    function activateBarrel() {
        if (!barrel || !weaponSprite) return;

        // Add active class to barrel
        barrel.classList.add('barrel-active');

        // Make weapon sprite draggable
        weaponSprite.style.cursor = 'grab';
        weaponSprite.addEventListener('mousedown', handleWeaponMouseDown);
    }

    /**
     * Remove barrel event listeners
     */
    function removeBarrelListeners() {
        if (barrel) {
            barrel.classList.remove('barrel-active', 'barrel-holding');
        }
        if (weaponSprite) {
            weaponSprite.style.cursor = 'default';
            weaponSprite.removeEventListener('mousedown', handleWeaponMouseDown);
        }
        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('mouseup', handleDocumentMouseUp);

        // Remove extraction click listener
        const scene = document.querySelector('.hammering-scene');
        if (scene) {
            scene.removeEventListener('mousedown', handleExtractionClick);
        }
    }

    // Drag state
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    /**
     * Handle weapon mouse down (start dragging)
     */
    function handleWeaponMouseDown(event) {
        event.preventDefault();

        if (currentState !== QUENCHING_STATE.IDLE) return;

        isDragging = true;
        weaponSprite.style.cursor = 'grabbing';

        // Store initial mouse position
        dragStartX = event.clientX;
        dragStartY = event.clientY;

        // Add document listeners for drag
        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp);
    }

    /**
     * Handle document mouse move (dragging weapon)
     */
    function handleDocumentMouseMove(event) {
        if (!isDragging) return;

        const scene = weaponSprite.closest('.hammering-scene');
        if (!scene) return;

        const sceneRect = scene.getBoundingClientRect();

        // Calculate new position relative to scene
        const x = ((event.clientX - sceneRect.left) / sceneRect.width) * 100;
        const y = ((event.clientY - sceneRect.top) / sceneRect.height) * 100;

        weaponSprite.style.left = `${x}%`;
        weaponSprite.style.top = `${y}%`;
    }

    /**
     * Handle document mouse up (drop weapon)
     */
    function handleDocumentMouseUp(event) {
        if (!isDragging) return;

        isDragging = false;
        weaponSprite.style.cursor = 'grab';

        // Remove drag listeners
        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('mouseup', handleDocumentMouseUp);

        // Check if dropped on barrel (with 40% expanded hitbox)
        const barrelRect = barrel.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;

        // Expand hitbox by 40% in all directions
        const expandWidth = barrelRect.width * 0.4;
        const expandHeight = barrelRect.height * 0.4;
        const expandedLeft = barrelRect.left - expandWidth;
        const expandedRight = barrelRect.right + expandWidth;
        const expandedTop = barrelRect.top - expandHeight;
        const expandedBottom = barrelRect.bottom + expandHeight;

        if (mouseX >= expandedLeft && mouseX <= expandedRight &&
            mouseY >= expandedTop && mouseY <= expandedBottom) {
            // Dropped on barrel - start quenching
            startQuenchingSequence();
        } else {
            // Not on barrel - snap back to center
            weaponSprite.style.transition = 'left 0.3s ease-out, top 0.3s ease-out';
            weaponSprite.style.left = '50%';
            weaponSprite.style.top = '50%';
            setTimeout(() => {
                weaponSprite.style.transition = '';
            }, 300);
        }
    }

    /**
     * Start the quenching sequence (after drag-and-drop)
     */
    function startQuenchingSequence() {
        currentState = QUENCHING_STATE.HOLDING;
        barrel.classList.add('barrel-holding');

        // Remove drag ability
        weaponSprite.style.cursor = 'default';
        weaponSprite.removeEventListener('mousedown', handleWeaponMouseDown);

        // Add click-to-extract on larger area (entire scene for easier clicking)
        const scene = document.querySelector('.hammering-scene');
        if (scene) {
            scene.addEventListener('mousedown', handleExtractionClick);
        }

        // Submerge weapon
        submergeWeapon();
    }

    /**
     * Handle extraction click (anywhere in scene during quenching)
     */
    function handleExtractionClick(event) {
        event.preventDefault();
        event.stopPropagation();

        // Allow extraction during BUBBLING, SUBMERGED, HOLDING, or OPTIMAL_WINDOW states
        if (currentState === QUENCHING_STATE.IDLE || currentState === QUENCHING_STATE.EXTRACTED || currentState === QUENCHING_STATE.COMPLETE) {
            return;
        }

        // Check if click is near barrel area (expanded hitbox)
        const barrelRect = barrel.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;

        // Expand hitbox by 100px in all directions
        const expandedLeft = barrelRect.left - 100;
        const expandedRight = barrelRect.right + 100;
        const expandedTop = barrelRect.top - 100;
        const expandedBottom = barrelRect.bottom + 100;

        if (mouseX >= expandedLeft && mouseX <= expandedRight &&
            mouseY >= expandedTop && mouseY <= expandedBottom) {
            // Clicked near barrel - extract weapon

            // Record extraction time
            extractionTime = performance.now();

            // Remove click listener
            const scene = document.querySelector('.hammering-scene');
            if (scene) {
                scene.removeEventListener('mousedown', handleExtractionClick);
            }

            // Extract weapon
            extractWeapon();
        }
    }

    /**
     * Submerge weapon in water
     */
    function submergeWeapon() {
        if (!weaponSprite || !barrel) return;

        currentState = QUENCHING_STATE.SUBMERGED;

        // Get barrel position
        const barrelRect = barrel.getBoundingClientRect();
        const sceneRect = barrel.closest('.hammering-scene').getBoundingClientRect();

        // Calculate target position (at barrel opening)
        const targetX = ((barrelRect.left + barrelRect.width / 2) - sceneRect.left) / sceneRect.width * 100;
        const targetY = ((barrelRect.top + 30) - sceneRect.top) / sceneRect.height * 100;

        // Hide weapon sprite when in barrel
        weaponSprite.style.opacity = '0';

        // Animate weapon to barrel
        weaponSprite.style.transition = 'left 0.4s ease-out, top 0.4s ease-out';
        weaponSprite.style.left = `${targetX}%`;
        weaponSprite.style.top = `${targetY}%`;

        // Start bubbling after animation
        setTimeout(() => {
            if (currentState === QUENCHING_STATE.SUBMERGED) {
                startBubbling();
            }
        }, 400);

        // Add submerged effect to weapon
        setTimeout(() => {
            weaponSprite.classList.add('weapon-submerged');
        }, 400);

        // Create splash effect
        createSplashEffect(targetX, targetY);
    }

    /**
     * Start bubbling animation
     */
    function startBubbling() {
        currentState = QUENCHING_STATE.BUBBLING;
        bubblesStartTime = performance.now();
        bubblesStopTime = bubblesStartTime + (quenchingConfig.timing.bubbleDuration * 1000);

        // Start particle systems
        startBubbleParticles();
        startSteamParticles();

        // Schedule bubble stop
        setTimeout(() => {
            if (currentState === QUENCHING_STATE.BUBBLING) {
                stopBubbling();
            }
        }, quenchingConfig.timing.bubbleDuration * 1000);
    }

    /**
     * Stop bubbling (enter optimal window)
     */
    function stopBubbling() {
        currentState = QUENCHING_STATE.OPTIMAL_WINDOW;

        // Stop bubble particles
        stopBubbleParticles();

        // Visual feedback that bubbles stopped - subtle glow change
        barrel.classList.add('barrel-optimal-window');

        // No visual indicator - player must watch the bubbles
    }

    /**
     * Extract weapon from water
     */
    function extractWeapon() {
        // Calculate quality based on timing
        calculateQuenchingQuality();

        currentState = QUENCHING_STATE.EXTRACTED;

        // Remove barrel classes
        barrel.classList.remove('barrel-holding', 'barrel-optimal-window');

        // Stop all particle systems
        stopBubbleParticles();
        stopSteamParticles();

        // Create extraction steam burst
        createExtractionSteamBurst();

        // Show weapon sprite again
        weaponSprite.style.opacity = '1';

        // Remove heat color filter (return to original color)
        weaponSprite.style.filter = 'none';
        weaponSpriteImg.style.filter = 'none';

        // Animate weapon back to anvil
        weaponSprite.style.transition = 'left 0.5s ease-in-out, top 0.5s ease-in-out';
        weaponSprite.style.left = '50%';
        weaponSprite.style.top = '50%';

        // Remove submerged effect
        weaponSprite.classList.remove('weapon-submerged');

        // Show quality feedback after extraction animation
        setTimeout(() => {
            showQualityFeedback();
            completeQuenchingPhase();
        }, 500);
    }

    /**
     * Calculate quenching quality based on timing
     */
    function calculateQuenchingQuality() {
        const currentTime = extractionTime;
        const timingConfig = quenchingConfig.timing;

        // If extracted before bubbles even stopped
        if (currentTime < bubblesStopTime) {
            // Early extraction penalty
            const earlyTime = (bubblesStopTime - currentTime) / 1000; // seconds early
            const penalty = earlyTime * timingConfig.earlyPenaltyRate;
            quenchingQuality = Math.max(0, 100 - penalty);
        } else {
            // After bubbles stopped
            const lateTime = (currentTime - bubblesStopTime) / 1000; // seconds after bubbles stopped

            if (lateTime <= timingConfig.optimalWindow) {
                // Within optimal window - perfect quality
                // Closer to middle of window = better
                const windowMiddle = timingConfig.optimalWindow / 2;
                const distanceFromMiddle = Math.abs(lateTime - windowMiddle);
                const perfection = 1 - (distanceFromMiddle / windowMiddle);
                quenchingQuality = 95 + (perfection * 5); // 95-100%
            } else {
                // Late extraction penalty
                const actualLateTime = lateTime - timingConfig.optimalWindow;
                const penalty = actualLateTime * timingConfig.latePenaltyRate;
                quenchingQuality = Math.max(0, 100 - penalty);
            }
        }

        // Clamp to 0-100
        quenchingQuality = Math.max(0, Math.min(100, quenchingQuality));
    }

    /**
     * Show quality feedback to player
     */
    function showQualityFeedback() {
        const grades = quenchingConfig.qualityGrades;
        let gradeLabel = grades.poor.label;

        if (quenchingQuality >= grades.perfect.min) {
            gradeLabel = grades.perfect.label;
        } else if (quenchingQuality >= grades.excellent.min) {
            gradeLabel = grades.excellent.label;
        } else if (quenchingQuality >= grades.good.min) {
            gradeLabel = grades.good.label;
        } else if (quenchingQuality >= grades.adequate.min) {
            gradeLabel = grades.adequate.label;
        }

        // Create feedback element
        const feedback = document.createElement('div');
        feedback.className = 'quenching-quality-feedback';
        feedback.innerHTML = `
            <div class="quality-feedback-label">${gradeLabel}</div>
            <div class="quality-feedback-value">${Math.round(quenchingQuality)}%</div>
        `;

        const scene = document.querySelector('.hammering-scene');
        if (scene) {
            scene.appendChild(feedback);

            // Fade out and remove after 3 seconds
            setTimeout(() => {
                feedback.classList.add('fade-out');
                setTimeout(() => {
                    if (feedback.parentNode) {
                        feedback.parentNode.removeChild(feedback);
                    }
                }, 500);
            }, 2500);
        }
    }

    /**
     * Create splash effect when weapon enters water
     */
    function createSplashEffect(x, y) {
        if (!particleContainer) return;

        for (let i = 0; i < 10; i++) {
            const splash = document.createElement('div');
            splash.className = 'splash-particle';
            splash.style.left = `${x}%`;
            splash.style.top = `${y}%`;

            const angle = (Math.PI * 2 * i) / 10;
            const velocity = 50 + Math.random() * 30;
            const vx = Math.cos(angle) * velocity;
            const vy = Math.sin(angle) * velocity - 50; // Bias upward

            splash.style.setProperty('--vx', `${vx}px`);
            splash.style.setProperty('--vy', `${vy}px`);

            particleContainer.appendChild(splash);

            // Remove after animation
            setTimeout(() => {
                if (splash.parentNode) {
                    splash.parentNode.removeChild(splash);
                }
            }, 800);
        }
    }

    /**
     * Start bubble particle system
     */
    function startBubbleParticles() {
        if (!weaponSprite || !particleContainer) return;

        const bubbleCount = quenchingConfig.visual.bubbleCount;

        // Create initial bubbles
        for (let i = 0; i < bubbleCount; i++) {
            createBubble();
        }

        // Animate bubbles
        animateBubbles();
    }

    /**
     * Create a single bubble
     */
    function createBubble() {
        if (!barrel || !particleContainer) return;

        const bubble = document.createElement('div');
        bubble.className = 'bubble-particle';

        // Position at top of barrel (10px down from barrel sprite top)
        const barrelRect = barrel.getBoundingClientRect();
        const sceneRect = barrel.closest('.hammering-scene').getBoundingClientRect();

        const barrelX = ((barrelRect.left + barrelRect.width / 2) - sceneRect.left) / sceneRect.width * 100;
        const barrelY = ((barrelRect.top + 10) - sceneRect.top) / sceneRect.height * 100;

        const offsetX = (Math.random() - 0.5) * 10; // ±5%
        const offsetY = (Math.random() - 0.5) * 5;  // ±2.5%

        bubble.style.left = `${barrelX + offsetX}%`;
        bubble.style.top = `${barrelY + offsetY}%`;

        // Random size
        const size = 5 + Math.random() * 8; // 5-13px
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;

        // Bubble physics
        bubble.dataset.vy = (-20 - Math.random() * 20).toString(); // Rise speed
        bubble.dataset.vx = ((Math.random() - 0.5) * 10).toString(); // Horizontal drift
        bubble.dataset.lifetime = (600 + Math.random() * 800).toString(); // 0.6-1.4 seconds (shorter lifetime)
        bubble.dataset.createdAt = performance.now().toString();

        particleContainer.appendChild(bubble);
        bubbles.push(bubble);
    }

    /**
     * Animate all bubbles
     */
    function animateBubbles() {
        if (currentState !== QUENCHING_STATE.BUBBLING && currentState !== QUENCHING_STATE.OPTIMAL_WINDOW) return;

        const now = performance.now();

        // Update each bubble
        bubbles = bubbles.filter(bubble => {
            if (!bubble.parentNode) return false;

            const lifetime = parseFloat(bubble.dataset.lifetime);
            const createdAt = parseFloat(bubble.dataset.createdAt);

            // Check if bubble expired
            if (now - createdAt > lifetime) {
                bubble.parentNode.removeChild(bubble);
                return false;
            }

            // Update position
            const vy = parseFloat(bubble.dataset.vy);
            const vx = parseFloat(bubble.dataset.vx);

            const currentY = parseFloat(bubble.style.top);
            const currentX = parseFloat(bubble.style.left);

            bubble.style.top = `${currentY + (vy * 0.016)}%`; // Assuming 60fps
            bubble.style.left = `${currentX + (vx * 0.016)}%`;

            // Fade out as it approaches surface
            const age = (now - createdAt) / lifetime;
            bubble.style.opacity = 1 - age;

            return true;
        });

        // Create new bubbles if in bubbling state
        if (currentState === QUENCHING_STATE.BUBBLING && bubbles.length < quenchingConfig.visual.bubbleCount) {
            if (Math.random() < 0.3) { // 30% chance each frame
                createBubble();
            }
        }

        // Continue animation
        if (currentState === QUENCHING_STATE.BUBBLING || bubbles.length > 0) {
            bubbleAnimationId = requestAnimationFrame(animateBubbles);
        }
    }

    /**
     * Stop bubble particle system
     */
    function stopBubbleParticles() {
        if (bubbleAnimationId) {
            cancelAnimationFrame(bubbleAnimationId);
            bubbleAnimationId = null;
        }

        // Remove all existing bubbles immediately
        bubbles.forEach(bubble => {
            if (bubble.parentNode) {
                bubble.parentNode.removeChild(bubble);
            }
        });
        bubbles = [];
    }

    /**
     * Start steam particle system
     */
    function startSteamParticles() {
        if (!barrel || !particleContainer) return;

        // Animate steam
        animateSteam();
    }

    /**
     * Create a steam particle
     */
    function createSteamParticle() {
        if (!barrel || !particleContainer) return;

        const steam = document.createElement('div');
        steam.className = 'steam-particle';

        // Position at top of barrel sprite
        const barrelRect = barrel.getBoundingClientRect();
        const sceneRect = barrel.closest('.hammering-scene').getBoundingClientRect();

        const barrelX = ((barrelRect.left + barrelRect.width / 2) - sceneRect.left) / sceneRect.width * 100;
        const barrelY = ((barrelRect.top + 20) - sceneRect.top) / sceneRect.height * 100; // 20px from top of barrel

        const offsetX = (Math.random() - 0.5) * 5;
        const offsetY = (Math.random() - 0.5) * 3;

        steam.style.left = `${barrelX + offsetX}%`;
        steam.style.top = `${barrelY + offsetY}%`;

        // Random size
        const size = 10 + Math.random() * 15;
        steam.style.width = `${size}px`;
        steam.style.height = `${size}px`;

        // Steam physics
        steam.dataset.vy = (-30 - Math.random() * 20).toString();
        steam.dataset.vx = ((Math.random() - 0.5) * 15).toString();
        steam.dataset.lifetime = (800 + Math.random() * 1200).toString();
        steam.dataset.createdAt = performance.now().toString();

        particleContainer.appendChild(steam);
        steamParticles.push(steam);
    }

    /**
     * Animate steam particles
     */
    function animateSteam() {
        if (currentState !== QUENCHING_STATE.BUBBLING && currentState !== QUENCHING_STATE.OPTIMAL_WINDOW && currentState !== QUENCHING_STATE.EXTRACTED) return;

        const now = performance.now();

        // Update each steam particle
        steamParticles = steamParticles.filter(steam => {
            if (!steam.parentNode) return false;

            const lifetime = parseFloat(steam.dataset.lifetime);
            const createdAt = parseFloat(steam.dataset.createdAt);

            if (now - createdAt > lifetime) {
                steam.parentNode.removeChild(steam);
                return false;
            }

            const vy = parseFloat(steam.dataset.vy);
            const vx = parseFloat(steam.dataset.vx);

            const currentY = parseFloat(steam.style.top);
            const currentX = parseFloat(steam.style.left);

            steam.style.top = `${currentY + (vy * 0.016)}%`;
            steam.style.left = `${currentX + (vx * 0.016)}%`;

            const age = (now - createdAt) / lifetime;
            steam.style.opacity = 0.6 - age * 0.6;
            steam.style.transform = `scale(${1 + age * 2})`;

            return true;
        });

        // Create new steam if in active states
        if ((currentState === QUENCHING_STATE.BUBBLING || currentState === QUENCHING_STATE.OPTIMAL_WINDOW) &&
            steamParticles.length < quenchingConfig.visual.steamParticleCount) {
            if (Math.random() < 0.2) {
                createSteamParticle();
            }
        }

        // Continue animation
        if (currentState === QUENCHING_STATE.BUBBLING || currentState === QUENCHING_STATE.OPTIMAL_WINDOW || steamParticles.length > 0) {
            steamAnimationId = requestAnimationFrame(animateSteam);
        }
    }

    /**
     * Stop steam particle system
     */
    function stopSteamParticles() {
        if (steamAnimationId) {
            cancelAnimationFrame(steamAnimationId);
            steamAnimationId = null;
        }

        // Remove all existing steam particles immediately
        steamParticles.forEach(steam => {
            if (steam.parentNode) {
                steam.parentNode.removeChild(steam);
            }
        });
        steamParticles = [];
    }

    /**
     * Create steam burst when weapon is extracted
     */
    function createExtractionSteamBurst() {
        if (!weaponSprite || !particleContainer) return;

        const weaponX = parseFloat(weaponSprite.style.left);
        const weaponY = parseFloat(weaponSprite.style.top);

        for (let i = 0; i < 20; i++) {
            const steam = document.createElement('div');
            steam.className = 'steam-burst-particle';

            const angle = (Math.PI * 2 * i) / 20;
            const velocity = 60 + Math.random() * 40;
            const vx = Math.cos(angle) * velocity;
            const vy = Math.sin(angle) * velocity - 30;

            steam.style.left = `${weaponX}%`;
            steam.style.top = `${weaponY}%`;

            const size = 15 + Math.random() * 20;
            steam.style.width = `${size}px`;
            steam.style.height = `${size}px`;

            steam.style.setProperty('--vx', `${vx}px`);
            steam.style.setProperty('--vy', `${vy}px`);

            particleContainer.appendChild(steam);

            setTimeout(() => {
                if (steam.parentNode) {
                    steam.parentNode.removeChild(steam);
                }
            }, 1000);
        }
    }


    /**
     * Complete the quenching phase
     */
    function completeQuenchingPhase() {
        currentState = QUENCHING_STATE.COMPLETE;

        // Call completion callback
        if (onComplete) {
            onComplete({
                hammeringQuality: hammeringQuality,
                quenchingQuality: quenchingQuality,
                metal: selectedMetal,
                weaponType: selectedWeaponType
            });
        }
    }

    /**
     * Destroy quenching UI
     */
    function destroyQuenchingUI() {
        // Remove particle container
        if (particleContainer && particleContainer.parentNode) {
            particleContainer.parentNode.removeChild(particleContainer);
            particleContainer = null;
        }

        // Remove water from barrel
        if (barrel) {
            const water = barrel.querySelector('.barrel-water');
            if (water && water.parentNode) {
                water.parentNode.removeChild(water);
            }
            barrel.classList.remove('barrel-active', 'barrel-holding', 'barrel-optimal-window');
        }

        // Hide weapon sprite now that quenching is complete
        if (weaponSprite) {
            weaponSprite.style.display = 'none';
        }

        // Clear particle arrays
        bubbles = [];
        steamParticles = [];
    }

    // Public API
    return {
        init,
        start,
        stop,
        isActive: () => isQuenchingActive
    };

})();
