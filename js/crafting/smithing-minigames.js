/**
 * Smithing Minigames Logic
 *
 * Handles the tier-based smelting minigame stages.
 * Tier 1: Heating + Pouring
 * Temperature management, bellows interaction, chain pouring, quality calculation.
 */

window.SmithingMinigames = (function() {
    'use strict';

    // Constants
    const TEMPERATURE_MIN = 0;
    const TEMPERATURE_MAX = 100;
    const COAL_CONSUMPTION_INTERVAL = 10000; // 10 seconds in ms
    const TEMPERATURE_UPDATE_INTERVAL = 100; // 100ms for smooth updates
    const BELLOWS_HOLD_DURATION = 1000; // 1 second for full effect
    const TEMPERATURE_INCREASE_PER_BELLOWS = 8; // Full bellows press
    const TEMPERATURE_DECAY_RATE = 0.05; // Per update when not using bellows
    const TEMPERATURE_RAPID_DECAY_RATE = 0.3; // Per update when out of coal
    const POUR_SPEED_SLOW = 0.3; // Fill% per update
    const POUR_SPEED_OPTIMAL = 0.6;
    const POUR_SPEED_FAST = 1.2;
    const POUR_DRAG_THRESHOLD_OPTIMAL = 50; // pixels
    const POUR_DRAG_THRESHOLD_FAST = 100;

    // Quality calculation constants
    const QUALITY_BASE = 70;
    const QUALITY_HEATING_MAX = 15;
    const QUALITY_POURING_MAX = 10;
    const QUALITY_SKILL_MAX = 10; // Future: smithing skill bonus
    const OVERHEAT_PENALTY_MAX = 5;

    // Temperature color mapping
    const TEMP_COLORS = [
        { min: 0, max: 10, class: 'temp-grey', color: '#64748b' },
        { min: 10, max: 20, class: 'temp-dark-red', color: '#7f1d1d' },
        { min: 20, max: 30, class: 'temp-red', color: '#dc2626' },
        { min: 30, max: 45, class: 'temp-red-orange', color: '#ea580c' },
        { min: 45, max: 60, class: 'temp-orange', color: '#f59e0b' },
        { min: 60, max: 75, class: 'temp-yellow-orange', color: '#fbbf24' },
        { min: 75, max: 85, class: 'temp-yellow', color: '#fef08a' },
        { min: 85, max: 95, class: 'temp-yellow-white', color: '#fefce8' },
        { min: 95, max: 100, class: 'temp-white', color: '#ffffff' }
    ];

    // State
    let currentStage = null; // 'heating' or 'pouring'
    let temperature = 0;
    let coalInPit = 0;
    let optimalTemp = 55;
    let optimalTempRange = [45, 65];
    let oreMaterial = null;
    let ingotMaterial = null;
    let callbacks = null;

    // Heating stage state
    let coalConsumptionTimer = null;
    let temperatureUpdateTimer = null;
    let bellowsHoldStartTime = null;
    let bellowsHoldTimer = null;
    let timeInOptimalZone = 0; // Tracks time spent ABOVE optimal temperature (overheating penalty)

    // Pouring stage state
    let pouringActive = false;
    let pouringStartY = 0;
    let currentChainPull = 0; // Current pull distance (0-200 pixels)
    let moldFillPercent = 0;
    let crucibleFillPercent = 100; // Crucible starts full
    let splashCount = 0;
    let pourTemperature = 0; // Temperature at which pouring started
    let pouringUpdateInterval = null;

    // Start minigame
    function start(ore, ingot, initialCoal, eventCallbacks) {
        console.log('[SmithingMinigames] Starting minigame for', ingot.name);

        oreMaterial = ore;
        ingotMaterial = ingot;
        coalInPit = initialCoal;
        callbacks = eventCallbacks;

        // Get optimal temperature from ore data
        optimalTemp = ore.smithing.optimalTemp || 55;

        // Derive optimal range from color band
        const optimalColorClass = ore.smithing.optimalColor || 'temp-orange';
        const colorBand = TEMP_COLORS.find(c => c.class === optimalColorClass);
        if (colorBand) {
            optimalTempRange = [colorBand.min, colorBand.max];
        } else {
            optimalTempRange = [45, 65]; // Fallback
        }

        // Reset state
        temperature = 0;
        currentStage = 'heating';
        timeInOptimalZone = 0; // Tracks time spent ABOVE optimal (overheating)
        moldFillPercent = 0;
        crucibleFillPercent = 100;
        splashCount = 0;

        // Fill crucible with ore (starts at 0%, animates to 100%)
        const metalGlow = document.getElementById('metal-glow');
        if (metalGlow) {
            metalGlow.style.height = '0%';
            // Animate to full over 0.5 seconds to show ore being added
            setTimeout(() => {
                if (metalGlow) {
                    metalGlow.style.transition = 'height 0.8s ease-out';
                    metalGlow.style.height = '100%';
                }
            }, 50);
        }

        // Show debug panel
        showDebugPanel();

        // Start heating stage
        startHeatingStage();
    }

    // Stop minigame (for cancellation)
    function stop() {
        console.log('[SmithingMinigames] Stopping minigame');

        // Clear all timers
        if (coalConsumptionTimer) clearInterval(coalConsumptionTimer);
        if (temperatureUpdateTimer) clearInterval(temperatureUpdateTimer);
        if (bellowsHoldTimer) clearInterval(bellowsHoldTimer);
        if (pouringUpdateInterval) clearInterval(pouringUpdateInterval);

        // Remove event listeners
        removeBellowsListeners();
        removeChainListeners();

        // Hide debug panel
        hideDebugPanel();

        // Reset state
        currentStage = null;
    }

    // Show debug panel
    function showDebugPanel() {
        const panel = document.getElementById('quality-debug-panel');
        if (panel) {
            panel.style.display = 'block';
            updateDebugPanel();
        }
    }

    // Hide debug panel
    function hideDebugPanel() {
        const panel = document.getElementById('quality-debug-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    // Update debug panel with current quality tracking data
    function updateDebugPanel() {
        // Update temperature
        const tempEl = document.getElementById('debug-temp');
        if (tempEl) tempEl.textContent = temperature.toFixed(1);

        // Update time above optimal
        const optimalEl = document.getElementById('debug-optimal');
        if (optimalEl) optimalEl.textContent = timeInOptimalZone.toFixed(1) + 's';

        // Update splashes
        const splashEl = document.getElementById('debug-splashes');
        if (splashEl) splashEl.textContent = splashCount;

        // Update pour temperature
        const pourTempEl = document.getElementById('debug-pour-temp');
        if (pourTempEl) pourTempEl.textContent = pourTemperature.toFixed(1);

        // Calculate and update estimated quality
        const estimatedQuality = calculateQuality();
        const qualityEl = document.getElementById('debug-quality');
        if (qualityEl) qualityEl.textContent = estimatedQuality + '%';
    }

    // Start heating stage
    function startHeatingStage() {
        console.log('[SmithingMinigames] Starting heating stage');

        currentStage = 'heating';

        // Update stage progress UI
        updateStageProgress('heat', 'active');

        // Enable bellows
        enableBellows();

        // Start coal consumption timer
        startCoalConsumption();

        // Start temperature update loop
        startTemperatureUpdates();
    }

    // Show optimal zone marker on temperature gauge
    function showOptimalZone() {
        const marker = document.getElementById('optimal-zone-marker');
        if (marker) {
            const percent = optimalTemp;
            marker.style.bottom = `${percent}%`;
            marker.style.display = 'block';
        }
    }

    // Enable bellows interaction
    function enableBellows() {
        const bellowsContainer = document.getElementById('bellows-container');
        if (!bellowsContainer) return;

        // Only enable if there's coal in the pit
        if (coalInPit > 0) {
            bellowsContainer.classList.remove('disabled');
        } else {
            bellowsContainer.classList.add('disabled');
        }

        // Show the "Hold SPACE" hint
        const bellowsHint = bellowsContainer.querySelector('.bellows-hint');
        if (bellowsHint) {
            bellowsHint.style.display = 'block';
        }

        // Add spacebar event listeners
        document.addEventListener('keydown', handleBellowsKeyDown);
        document.addEventListener('keyup', handleBellowsKeyUp);
    }

    // Remove bellows event listeners
    function removeBellowsListeners() {
        const bellowsContainer = document.getElementById('bellows-container');
        if (!bellowsContainer) return;

        document.removeEventListener('keydown', handleBellowsKeyDown);
        document.removeEventListener('keyup', handleBellowsKeyUp);

        bellowsContainer.classList.add('disabled');
        bellowsContainer.classList.remove('active');

        // Hide the "Hold SPACE" hint
        const bellowsHint = bellowsContainer.querySelector('.bellows-hint');
        if (bellowsHint) {
            bellowsHint.style.display = 'none';
        }
    }

    // Handle bellows spacebar press
    function handleBellowsKeyDown(event) {
        // Only activate bellows with spacebar
        if (event.code !== 'Space') return;

        // Prevent if already active
        if (bellowsHoldStartTime) return;

        // Can't use bellows if there's no coal
        if (coalInPit <= 0) {
            console.log('[SmithingMinigames] Cannot use bellows - no coal in pit');
            return;
        }

        event.preventDefault();

        bellowsHoldStartTime = Date.now();

        // Change sprite to closed
        const bellowsSprite = document.getElementById('bellows-sprite');
        if (bellowsSprite) {
            bellowsSprite.src = 'assets/sprites/smithing/BellowsClosed.png';
        }

        const bellowsContainer = document.getElementById('bellows-container');
        if (bellowsContainer) {
            bellowsContainer.classList.add('active');
        }
    }

    // Handle bellows spacebar release
    function handleBellowsKeyUp(event) {
        // Only respond to spacebar
        if (event.code !== 'Space') return;

        if (!bellowsHoldStartTime) return;

        event.preventDefault();

        const holdDuration = Date.now() - bellowsHoldStartTime;
        const holdRatio = Math.min(holdDuration / BELLOWS_HOLD_DURATION, 1);
        const tempIncrease = TEMPERATURE_INCREASE_PER_BELLOWS * holdRatio;

        // Increase temperature
        temperature = Math.min(temperature + tempIncrease, TEMPERATURE_MAX);

        console.log('[SmithingMinigames] Bellows used. Hold ratio:', holdRatio.toFixed(2), 'Temp increase:', tempIncrease.toFixed(1));

        bellowsHoldStartTime = null;

        // Change sprite back to open
        const bellowsSprite = document.getElementById('bellows-sprite');
        if (bellowsSprite) {
            bellowsSprite.src = 'assets/sprites/smithing/BellowsOpen.png';
        }

        const bellowsContainer = document.getElementById('bellows-container');
        if (bellowsContainer) {
            bellowsContainer.classList.remove('active');
        }
    }

    // Start coal consumption timer
    function startCoalConsumption() {
        coalConsumptionTimer = setInterval(() => {
            if (coalInPit > 0) {
                coalInPit--;
                if (callbacks && callbacks.onCoalConsumed) {
                    callbacks.onCoalConsumed();
                }
                console.log('[SmithingMinigames] Coal consumed. Remaining:', coalInPit);

                // Disable bellows if we run out of coal
                if (coalInPit <= 0) {
                    const bellowsContainer = document.getElementById('bellows-container');
                    if (bellowsContainer) {
                        bellowsContainer.classList.add('disabled');
                    }
                }
            }
        }, COAL_CONSUMPTION_INTERVAL);
    }

    // Start temperature update loop
    function startTemperatureUpdates() {
        temperatureUpdateTimer = setInterval(() => {
            updateTemperature();
            updateTemperatureUI();
            trackHeatingPerformance();
            updateDebugPanel();
        }, TEMPERATURE_UPDATE_INTERVAL);
    }

    // Update temperature (passive decay)
    function updateTemperature() {
        if (bellowsHoldStartTime) {
            // Bellows is being held, no decay
            return;
        }

        // Apply decay
        let decayRate = coalInPit > 0 ? TEMPERATURE_DECAY_RATE : TEMPERATURE_RAPID_DECAY_RATE;
        temperature = Math.max(temperature - decayRate, TEMPERATURE_MIN);
    }

    // Update temperature UI
    function updateTemperatureUI() {
        // Update gauge arrow
        const gaugeArrow = document.getElementById('gauge-arrow');
        if (gaugeArrow) {
            gaugeArrow.style.bottom = `${temperature}%`;
        }

        // Update crucible glow color
        const metalGlow = document.getElementById('metal-glow');
        if (metalGlow) {
            const colorData = getTempColorData(temperature);
            metalGlow.className = `metal-glow ${colorData.class}`;
        }
    }

    // Track heating performance for quality calculation
    function trackHeatingPerformance() {
        const interval = TEMPERATURE_UPDATE_INTERVAL / 1000; // Convert to seconds

        // Only track time spent ABOVE optimal range (overheating)
        if (temperature > optimalTempRange[1]) {
            timeInOptimalZone += interval; // Reusing this variable for "time above optimal"
        }
    }

    // Get temperature color data
    function getTempColorData(temp) {
        for (let i = 0; i < TEMP_COLORS.length; i++) {
            const range = TEMP_COLORS[i];
            if (temp >= range.min && temp <= range.max) {
                return range;
            }
        }
        return TEMP_COLORS[0]; // Default to grey
    }

    // Callback when coal is added during minigame
    function onCoalAdded() {
        coalInPit++;
        console.log('[SmithingMinigames] Coal added to pit during minigame. Total:', coalInPit);

        // Re-enable bellows if coal was added
        const bellowsContainer = document.getElementById('bellows-container');
        if (bellowsContainer && coalInPit > 0) {
            bellowsContainer.classList.remove('disabled');
        }
    }

    // Handle proceed to pour button (appears when player is ready)
    function setupProceedButton() {
        const proceedBtn = document.getElementById('proceed-pour-btn');
        if (proceedBtn) {
            proceedBtn.style.display = 'block';
            proceedBtn.onclick = handleProceedToPour;
        }
    }

    // Hide proceed button
    function hideProceedButton() {
        const proceedBtn = document.getElementById('proceed-pour-btn');
        if (proceedBtn) {
            proceedBtn.style.display = 'none';
        }
    }

    // Make proceed button visible (player manually shows it when ready)
    // For Tier 1, we'll show it after a few seconds of heating or when temp is above 20
    // Also hide it if temperature drops below minimum threshold
    function checkShowProceedButton() {
        if (temperature >= 20) {
            setupProceedButton();
            return true;
        } else {
            hideProceedButton();
            return false;
        }
    }

    // Update heating stage - check if we should show proceed button
    setInterval(() => {
        if (currentStage === 'heating') {
            checkShowProceedButton();
        }
    }, 1000);

    // Handle proceed to pour
    function handleProceedToPour() {
        console.log('[SmithingMinigames] Proceeding to pouring stage');

        // Store the pour temperature
        pourTemperature = temperature;

        // Update debug panel with pour temperature
        updateDebugPanel();

        // End heating stage
        endHeatingStage();

        // Start pouring stage
        startPouringStage();
    }

    // End heating stage
    function endHeatingStage() {
        // Clear timers
        if (coalConsumptionTimer) clearInterval(coalConsumptionTimer);
        if (temperatureUpdateTimer) clearInterval(temperatureUpdateTimer);

        // Disable bellows
        removeBellowsListeners();

        // Hide proceed button
        const proceedBtn = document.getElementById('proceed-pour-btn');
        if (proceedBtn) {
            proceedBtn.style.display = 'none';
        }

        // Mark heating stage as complete
        updateStageProgress('heat', 'completed');
    }

    // Start pouring stage
    function startPouringStage() {
        console.log('[SmithingMinigames] Starting pouring stage');

        currentStage = 'pouring';

        // Reset pouring state
        currentChainPull = 0;
        moldFillPercent = 0;
        crucibleFillPercent = 100; // Crucible starts full

        // Update stage progress UI
        updateStageProgress('pour', 'active');

        // Enable chain interaction
        enableChain();

        // Reset chain visual to top position
        updateChainVisual(0);

        // Set mold fill color to pour temperature
        const moldFill = document.getElementById('mold-fill');
        if (moldFill) {
            const colorData = getTempColorData(pourTemperature);
            moldFill.className = `mold-fill ${colorData.class}`;
            moldFill.style.height = '0%';
        }

        // Initialize crucible fill at 100%
        const metalGlow = document.getElementById('metal-glow');
        if (metalGlow) {
            metalGlow.style.height = '100%';
        }
    }

    // Enable chain interaction
    function enableChain() {
        const chainContainer = document.getElementById('chain-container');
        if (!chainContainer) return;

        chainContainer.classList.add('active');

        // Add event listeners
        const chainHandle = document.getElementById('chain-handle');
        if (chainHandle) {
            chainHandle.addEventListener('mousedown', handleChainMouseDown);
            chainHandle.addEventListener('touchstart', handleChainMouseDown);
        }
    }

    // Remove chain event listeners
    function removeChainListeners() {
        const chainHandle = document.getElementById('chain-handle');
        if (!chainHandle) return;

        chainHandle.removeEventListener('mousedown', handleChainMouseDown);
        chainHandle.removeEventListener('touchstart', handleChainMouseDown);
        document.removeEventListener('mousemove', handleChainMouseMove);
        document.removeEventListener('touchmove', handleChainMouseMove);
        document.removeEventListener('mouseup', handleChainMouseUp);
        document.removeEventListener('touchend', handleChainMouseUp);

        const chainContainer = document.getElementById('chain-container');
        if (chainContainer) {
            chainContainer.classList.remove('active');
        }
    }

    // Handle chain mouse down (start pouring)
    function handleChainMouseDown(event) {
        event.preventDefault();

        pouringActive = true;
        pouringStartY = event.clientY || (event.touches && event.touches[0].clientY);
        currentChainPull = 0;

        // Add global listeners
        document.addEventListener('mousemove', handleChainMouseMove);
        document.addEventListener('touchmove', handleChainMouseMove);
        document.addEventListener('mouseup', handleChainMouseUp);
        document.addEventListener('touchend', handleChainMouseUp);

        // Start continuous pouring updates
        startPouringUpdates();

        console.log('[SmithingMinigames] Chain grabbed');
    }

    // Handle chain mouse move (dragging)
    function handleChainMouseMove(event) {
        if (!pouringActive) return;

        event.preventDefault();

        const currentY = event.clientY || (event.touches && event.touches[0].clientY);
        const pullDistance = Math.max(0, Math.min(200, currentY - pouringStartY)); // Max 200px pull

        currentChainPull = pullDistance;

        // Update chain visual
        updateChainVisual(pullDistance);
    }

    // Handle chain mouse up (stop pouring)
    function handleChainMouseUp(event) {
        if (!pouringActive) return;

        event.preventDefault();

        pouringActive = false;
        currentChainPull = 0;

        // Stop pouring updates
        if (pouringUpdateInterval) {
            clearInterval(pouringUpdateInterval);
            pouringUpdateInterval = null;
        }

        // Reset chain visual
        updateChainVisual(0);

        console.log('[SmithingMinigames] Chain released');
    }

    // Update chain visual to show extension
    function updateChainVisual(pullDistance) {
        const chainLinks = document.querySelector('.chain-links');
        const chainHandle = document.querySelector('.chain-handle');

        if (chainLinks) {
            // Chain links extend from top
            chainLinks.style.height = `${20 + pullDistance}px`;
        }

        if (chainHandle) {
            // Handle moves down
            chainHandle.style.top = `${10 + pullDistance}px`;
        }
    }

    // Start continuous pouring updates
    function startPouringUpdates() {
        // Update every 50ms for smooth pouring
        pouringUpdateInterval = setInterval(() => {
            if (!pouringActive) return;

            pourLiquid();
            updateDebugPanel();
        }, 50);
    }

    // Pour liquid into mold based on current chain position
    function pourLiquid() {
        if (moldFillPercent >= 100) {
            // Mold is full
            endPouringStage();
            return;
        }

        // Determine pour speed based on chain pull distance
        let pourSpeed = 0;

        if (currentChainPull < POUR_DRAG_THRESHOLD_OPTIMAL) {
            // Slow pour (0-50px)
            pourSpeed = POUR_SPEED_SLOW * (currentChainPull / POUR_DRAG_THRESHOLD_OPTIMAL);
        } else if (currentChainPull < POUR_DRAG_THRESHOLD_FAST) {
            // Optimal pour (50-100px)
            pourSpeed = POUR_SPEED_OPTIMAL;
        } else {
            // Fast pour with splashing (100px+)
            pourSpeed = POUR_SPEED_FAST;

            // Occasional splash effects when pouring too fast
            if (Math.random() < 0.3) {
                createSplash();
            }
        }

        // Only pour if chain is pulled
        if (currentChainPull > 5) {
            // Update mold fill
            moldFillPercent = Math.min(moldFillPercent + pourSpeed, 100);

            // Update crucible drain (inverse of mold fill)
            crucibleFillPercent = 100 - moldFillPercent;

            // Update mold fill UI
            const moldFill = document.getElementById('mold-fill');
            if (moldFill) {
                moldFill.style.height = `${moldFillPercent}%`;
            }

            // Update crucible fill UI
            const metalGlow = document.getElementById('metal-glow');
            if (metalGlow) {
                metalGlow.style.height = `${crucibleFillPercent}%`;
            }
        }
    }

    // Create splash effect
    function createSplash() {
        splashCount++;

        // Create splash particle (simple visual effect)
        const mold = document.getElementById('mold');
        if (!mold) return;

        const splash = document.createElement('div');
        splash.className = 'mold-splash';
        const colorData = getTempColorData(pourTemperature);
        splash.style.backgroundColor = colorData.color;
        splash.style.left = `${Math.random() * 100}%`;
        splash.style.top = `${Math.random() * 50}%`;

        mold.appendChild(splash);

        // Remove after animation
        setTimeout(() => {
            if (mold.contains(splash)) {
                mold.removeChild(splash);
            }
        }, 800);
    }

    // End pouring stage
    function endPouringStage() {
        console.log('[SmithingMinigames] Pouring complete');

        pouringActive = false;

        // Stop pouring updates
        if (pouringUpdateInterval) {
            clearInterval(pouringUpdateInterval);
            pouringUpdateInterval = null;
        }

        // Reset chain visual
        updateChainVisual(0);

        // Remove chain listeners
        removeChainListeners();

        // Mark pouring stage as complete
        updateStageProgress('pour', 'completed');

        // Start cooling animation
        startCoolingAnimation();
    }

    // Start cooling animation
    function startCoolingAnimation() {
        console.log('[SmithingMinigames] Starting cooling animation');

        const moldFill = document.getElementById('mold-fill');
        if (!moldFill) return;

        const ingotBaseColor = ingotMaterial.smithing.baseColor || '#B87333';

        // Transition from pour temperature to base color
        setTimeout(() => {
            moldFill.style.transition = 'background-color 2.5s ease';
            moldFill.style.backgroundColor = ingotBaseColor;
            moldFill.className = 'mold-fill'; // Remove temp class
        }, 100);

        // After cooling, calculate quality and complete
        setTimeout(() => {
            completeMinigame();
        }, 2800);
    }

    // Complete minigame and calculate quality
    function completeMinigame() {
        console.log('[SmithingMinigames] Calculating quality...');

        const quality = calculateQuality();
        const gradeName = getQualityGrade(quality);

        console.log('[SmithingMinigames] Final quality:', quality, 'Grade:', gradeName);

        // Stop minigame
        stop();

        // Notify completion
        if (callbacks && callbacks.onMinigameComplete) {
            callbacks.onMinigameComplete(quality, gradeName);
        }
    }

    // Calculate final quality (0-100%)
    function calculateQuality() {
        let quality = 100; // Start at 100%

        // Pour temperature penalty
        if (pourTemperature < optimalTempRange[0]) {
            // Poured below optimal color
            quality -= 20;
        } else if (pourTemperature > optimalTempRange[1]) {
            // Poured above optimal color
            quality -= 15;
        }

        // Splash penalty: -1% per splash
        quality -= splashCount;

        // Overheating penalty: -1% per full second spent above optimal during heating
        const secondsOverheated = Math.floor(timeInOptimalZone); // timeInOptimalZone now tracks time above optimal
        quality -= secondsOverheated;

        // Clamp to reasonable range (0-100%)
        quality = Math.max(0, Math.min(100, quality));

        return quality;
    }

    // Get quality grade name from percentage (0-100%)
    function getQualityGrade(quality) {
        if (quality >= 100) return 'Masterwork';
        if (quality >= 95) return 'Excellent';
        if (quality >= 85) return 'Well-Forged';
        if (quality >= 75) return 'Standard';
        if (quality >= 60) return 'Rough';
        return 'Flawed';
    }

    // Update stage progress UI
    function updateStageProgress(stageName, state) {
        // state: 'active', 'completed'
        const stageSteps = document.querySelectorAll('.stage-step');

        stageSteps.forEach(step => {
            const stepStage = step.dataset.stage;

            if (stepStage === stageName) {
                step.classList.remove('active', 'completed');
                step.classList.add(state);
            }
        });
    }

    // Public API
    return {
        start,
        stop,
        onCoalAdded
    };

})();
