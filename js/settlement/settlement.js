// ============================================
// Settlement System
// ============================================

const Settlement = (() => {
    // Settlement state
    let state = {
        settlement: null,
        buildingsData: [],
        resourcesData: [],
        currentTab: 'buildings',
        selectedTrainingSkillId: null
    };

    // ============================================
    // INITIALIZATION & DATA LOADING
    // ============================================
    async function init() {
        // Load resources data from JSON
        try {
            const response = await fetch('data/resources.json');
            const data = await response.json();
            state.resourcesData = data.resources;
        } catch (error) {
            console.error('Failed to load resources.json:', error);
            state.resourcesData = [];
        }

        // Load buildings data from JSON
        try {
            const response = await fetch('data/buildings.json');
            const data = await response.json();
            state.buildingsData = data.buildings;
        } catch (error) {
            console.error('Failed to load buildings.json:', error);
            state.buildingsData = [];
        }

        // Initialize UI event listeners
        initializeUI();

        // Start resource generation loop
        startResourceGeneration();
    }

    function create(name) {
        // Initialize buildings from loaded data
        const buildings = {};
        state.buildingsData.forEach(building => {
            buildings[building.id] = { count: 0 };
        });

        // Initialize resources dynamically from loaded resource data
        const resources = {};
        state.resourcesData.forEach(resource => {
            resources[resource.id] = {
                current: resource.defaultStart || 0,
                max: resource.defaultMax || 100
                // Production is calculated dynamically from buildings, not stored
            };
        });

        state.settlement = {
            id: generateId(),
            name,
            morale: 100,
            day: 1,
            resources: resources,
            buildings: buildings,
            population: {
                total: 0, // Start with 0 population until tavern is built
                max: 20,
                idle: 0,
                assigned: {} // { buildingType: workerCount }
            },
            starvationDays: 0 // Days at 0 food (people leave after 3)
        };

        return state.settlement;
    }

    function generateId() {
        return 'settlement_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // ============================================
    // UI INITIALIZATION
    // ============================================
    function initializeUI() {
        // Initialize sub-tab system using centralized SubTabManager
        if (window.SubTabManager) {
            SubTabManager.initSubTabs(
                'settlement',                      // Parent tab name
                '.settlement-nav-tab',             // Button selector
                '.settlement-tab-content',         // Content selector
                'data-settlement-tab',             // Data attribute
                'settlement-',                     // Content ID prefix
                '-content',                        // Content ID suffix
                onSubTabChange                     // Callback on tab change
            );
        }


        // Building card clicks (delegate to parent to handle dynamic content)
        document.addEventListener('click', (e) => {
            // Check if e.target is a valid DOM element
            if (!e.target || typeof e.target.closest !== 'function') return;

            const card = e.target.closest('.building-card');
            if (card && card.dataset.buildingType) {
                const buildingType = card.dataset.buildingType;
                constructBuilding(buildingType);
            }
        });

        // Create tooltip element for building hover
        const tooltip = document.createElement('div');
        tooltip.id = 'building-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            display: none;
            background: #1e293b;
            border: 2px solid #3b82f6;
            border-radius: 8px;
            padding: 12px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            pointer-events: none;
            max-width: 300px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        `;
        document.body.appendChild(tooltip);

        // Building card hover for tooltips
        document.addEventListener('mouseenter', (e) => {
            // Check if e.target is a valid DOM element
            if (!e.target || typeof e.target.closest !== 'function') return;

            const card = e.target.closest('.building-card');
            if (card && card.dataset.buildingType) {
                const buildingType = card.dataset.buildingType;
                showBuildingTooltip(buildingType, card);
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
            // Check if e.target is a valid DOM element
            if (!e.target || typeof e.target.closest !== 'function') return;

            const card = e.target.closest('.building-card');
            if (card && card.dataset.buildingType) {
                hideBuildingTooltip();
            }
        }, true);
    }

    function showBuildingTooltip(buildingType, cardElement) {
        const buildingData = state.buildingsData.find(b => b.id === buildingType);
        if (!buildingData) return;

        const tooltip = document.getElementById('building-tooltip');
        if (!tooltip) return;

        // Build tooltip content
        let html = `<div style="font-weight: bold; margin-bottom: 8px; color: #3b82f6;">${buildingData.name}</div>`;
        html += `<div style="font-size: 12px; color: #cbd5e1; margin-bottom: 12px;">${buildingData.description}</div>`;

        // Show costs
        if (buildingData.cost) {
            html += '<div style="margin-bottom: 8px;"><strong style="color: #94a3b8;">Cost:</strong></div>';
            for (const [resourceId, cost] of Object.entries(buildingData.cost)) {
                const resourceDef = state.resourcesData.find(r => r.id === resourceId);
                const resourceName = resourceDef ? resourceDef.name : resourceId;
                const current = state.settlement.resources[resourceId]?.current || 0;
                const hasEnough = current >= cost;
                const color = hasEnough ? '#22c55e' : '#ef4444';
                html += `<div style="margin-left: 12px; color: ${color}; font-size: 13px;">${resourceDef?.icon || ''} ${resourceName}: ${Math.floor(current)}/${cost}</div>`;
            }
        }

        // Show production
        if (buildingData.production) {
            html += '<div style="margin-top: 12px; margin-bottom: 8px;"><strong style="color: #94a3b8;">Produces:</strong></div>';
            for (const [resourceId, amount] of Object.entries(buildingData.production)) {
                const resourceDef = state.resourcesData.find(r => r.id === resourceId);
                const resourceName = resourceDef ? resourceDef.name : resourceId;
                html += `<div style="margin-left: 12px; color: #60a5fa; font-size: 13px;">${resourceDef?.icon || ''} +${amount} ${resourceName}/day</div>`;
            }
        }

        // Show capacity bonuses
        if (buildingData.capacityBonus) {
            html += '<div style="margin-top: 12px; margin-bottom: 8px;"><strong style="color: #94a3b8;">Capacity Bonus:</strong></div>';
            for (const [resourceId, bonus] of Object.entries(buildingData.capacityBonus)) {
                const resourceDef = state.resourcesData.find(r => r.id === resourceId);
                const resourceName = resourceDef ? resourceDef.name : resourceId;
                html += `<div style="margin-left: 12px; color: #fbbf24; font-size: 13px;">${resourceDef?.icon || ''} +${bonus} ${resourceName} capacity</div>`;
            }
        }

        // Show population cap bonus
        if (buildingData.populationCapBonus) {
            html += '<div style="margin-top: 12px; margin-bottom: 8px;"><strong style="color: #94a3b8;">Population:</strong></div>';
            html += `<div style="margin-left: 12px; color: #60a5fa; font-size: 13px;">👥 +${buildingData.populationCapBonus} population cap</div>`;
        }

        // Show wanderer spawn bonus
        if (buildingData.wandererSpawnBonus) {
            const bonusPercent = (buildingData.wandererSpawnBonus * 100).toFixed(1);
            html += '<div style="margin-top: 12px; margin-bottom: 8px;"><strong style="color: #94a3b8;">Wanderer Attraction:</strong></div>';
            html += `<div style="margin-left: 12px; color: #a78bfa; font-size: 13px;">🚶 +${bonusPercent}% spawn chance per day</div>`;
        }

        // Show building requirements
        if (buildingData.requires && buildingData.requires.length > 0) {
            html += '<div style="margin-top: 12px; margin-bottom: 8px;"><strong style="color: #94a3b8;">Requires:</strong></div>';
            for (const reqId of buildingData.requires) {
                const reqDef = state.buildingsData.find(b => b.id === reqId);
                const reqName = reqDef ? reqDef.name : reqId;
                const hasReq = (state.settlement.buildings[reqId]?.count || 0) > 0;
                const color = hasReq ? '#22c55e' : '#ef4444';
                html += `<div style="margin-left: 12px; color: ${color}; font-size: 13px;">${reqName}</div>`;
            }
        }

        // Show unlocks (for training buildings)
        if (buildingData.unlocks && buildingData.unlocks.length > 0) {
            html += '<div style="margin-top: 12px; margin-bottom: 8px;"><strong style="color: #94a3b8;">Unlocks:</strong></div>';
            for (const unlockId of buildingData.unlocks) {
                const methods = window.Training?.getTrainingMethods() || {};
                const method = methods[unlockId];
                const methodName = method ? `${method.name} (${method.xpPerDay} XP/day)` : unlockId;
                html += `<div style="margin-left: 12px; color: #f59e0b; font-size: 13px;">${methodName}</div>`;
            }
        }

        tooltip.innerHTML = html;
        tooltip.style.display = 'block';

        // Position tooltip near the building card
        const rect = cardElement.getBoundingClientRect();
        tooltip.style.left = (rect.right + 10) + 'px';
        tooltip.style.top = rect.top + 'px';
    }

    function hideBuildingTooltip() {
        const tooltip = document.getElementById('building-tooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    function switchTab(tabName) {
        // Use centralized SubTabManager to switch tabs
        if (window.SubTabManager) {
            SubTabManager.switchSubTab(
                'settlement',
                tabName,
                '.settlement-nav-tab',
                '.settlement-tab-content',
                'data-settlement-tab',
                'settlement-',
                '-content',
                onSubTabChange
            );
        }
    }

    /**
     * Called when sub-tab changes - only updates the active tab content, NOT the header
     */
    function onSubTabChange(tabName) {
        // Sync with GameState to ensure we have the latest reference
        const gameState = window.GameState?.getState();
        if (gameState && gameState.settlement) {
            state.settlement = gameState.settlement;
        }

        if (!state.settlement) return;

        // Only update the specific tab content that's now active
        // DO NOT update header bar or resources panel
        if (tabName === 'buildings') {
            updateBuildingsTab();
        } else if (tabName === 'population') {
            updatePopulationTab();
        } else if (tabName === 'training') {
            updateTrainingTab();
        }
    }

    // ============================================
    // UI UPDATES
    // ============================================
    function updateUI() {
        // Sync with GameState to ensure we have the latest reference
        const gameState = window.GameState?.getState();
        if (gameState && gameState.settlement) {
            state.settlement = gameState.settlement;
        }

        if (!state.settlement) return;

        updateHeaderBar();
        updateResourcesPanel();

        // Get current sub-tab from SubTabManager
        const currentTab = window.SubTabManager?.getCurrentSubTab('settlement') || 'buildings';

        if (currentTab === 'buildings') {
            updateBuildingsTab();
        } else if (currentTab === 'population') {
            updatePopulationTab();
        } else if (currentTab === 'training') {
            updateTrainingTab();
        }
    }

    function updateHeaderBar() {
        const s = state.settlement;

        // Only update if the value has changed (prevents flashing)
        const civNameEl = document.getElementById('settlement-civ-name');
        if (civNameEl.textContent !== s.name) {
            civNameEl.textContent = s.name;
        }

        // Support both old and new population format
        const popText = s.population?.total !== undefined
            ? `${s.population.total}/${s.population.max}`
            : s.population || 0;
        const popEl = document.getElementById('settlement-header-pop');
        if (popEl.textContent !== popText) {
            popEl.textContent = popText;
        }

        const moraleText = `${s.morale}%`;
        const moraleEl = document.getElementById('settlement-header-morale');
        if (moraleEl.textContent !== moraleText) {
            moraleEl.textContent = moraleText;
        }

        const dayEl = document.getElementById('settlement-header-day');
        if (dayEl.textContent !== s.day.toString()) {
            dayEl.textContent = s.day;
        }

        // Update top bar settlement info (real-time updates)
        // Only show if camp has been placed
        const gameState = window.GameState?.getState();
        const hasCamp = gameState?.campLocation?.isPlaced;

        const topBarSettlementName = document.querySelector('.settlement-name');
        if (topBarSettlementName) {
            if (hasCamp) {
                topBarSettlementName.textContent = `Settlement: ${s.name}`;
                topBarSettlementName.style.display = '';
            } else {
                topBarSettlementName.style.display = 'none';
            }
        }

        const topBarPopulation = document.querySelector('.population');
        if (topBarPopulation) {
            if (hasCamp) {
                topBarPopulation.textContent = `Population: ${popText}`;
                topBarPopulation.style.display = '';
            } else {
                topBarPopulation.style.display = 'none';
            }
        }
    }

    function updateResourcesPanel() {
        // Render resources in the right sidebar (Activity Log area)
        const rightSidebar = document.getElementById('right-sidebar');
        if (!rightSidebar) return;

        // Check if we already have the settlement resources container
        let container = document.getElementById('settlement-resources-sidebar');

        if (!container) {
            // Create the resources container for the first time
            container = document.createElement('div');
            container.id = 'settlement-resources-sidebar';
            container.className = 'settlement-resources-sidebar';
            container.innerHTML = `
                <h3>Resources</h3>
                <div class="resource-category"></div>
            `;
            // Insert at the beginning of right sidebar
            rightSidebar.insertBefore(container, rightSidebar.firstChild);
        }

        const resourceContainer = container.querySelector('.resource-category');
        if (!resourceContainer) return;

        // Calculate current generation rates (base + buildings)
        const currentRates = calculateResourceGenerationRates();

        // Calculate capacity bonuses from buildings
        const capacityBonuses = calculateResourceCapacityBonuses();

        // Clear and re-render all resources dynamically in compact table format
        resourceContainer.innerHTML = '';

        state.resourcesData.forEach(resourceDef => {
            const resourceData = state.settlement.resources[resourceDef.id];
            const rate = currentRates[resourceDef.id] || 0;

            if (resourceData) {
                const resourceRow = document.createElement('div');
                resourceRow.className = 'resource-row';

                const current = Math.floor(resourceData.current);
                const baseMax = resourceData.max;
                const bonus = capacityBonuses[resourceDef.id] || 0;
                const max = baseMax + bonus; // Total capacity = base + bonus
                const rateText = rate.toFixed(2);

                // Format large numbers (K for thousands)
                const formatNumber = (num) => {
                    if (num >= 1000) {
                        return (num / 1000).toFixed(1) + 'K';
                    }
                    return num.toString();
                };

                const currentFormatted = formatNumber(current);
                const maxFormatted = formatNumber(max);

                // Color code based on capacity
                const percentFull = (current / max) * 100;
                let amountClass = '';
                if (percentFull >= 90) {
                    amountClass = 'resource-full';
                } else if (percentFull >= 70) {
                    amountClass = 'resource-high';
                }

                // Format rate display with color coding
                let rateDisplay = '';
                if (rate !== 0) {
                    const sign = rate > 0 ? '+' : '';
                    const rateColor = rate > 0 ? '#22c55e' : '#ef4444'; // Green for positive, red for negative
                    rateDisplay = `<span style="color: ${rateColor}">${sign}${rateText} /d</span>`;
                }

                resourceRow.innerHTML = `
                    <div class="resource-name-col">${resourceDef.name}</div>
                    <div class="resource-amount-col ${amountClass}">${currentFormatted} / ${maxFormatted}</div>
                    <div class="resource-rate-col">${rateDisplay}</div>
                `;

                resourceContainer.appendChild(resourceRow);
            }
        });
    }

    function updateBuildingsTab() {
        const container = document.querySelector('.buildings-grid');
        if (!container) {
            return;
        }

        // Check if the container is actually visible to avoid unnecessary re-renders
        // This prevents the building cards from being destroyed during time ticks
        if (container.offsetParent === null) {
            // Container is hidden, skip rendering
            return;
        }

        // Only clear and re-render if we have buildings to show
        if (state.buildingsData.length === 0) {
            return;
        }

        // Check if building cards already exist - if so, just update them instead of re-rendering
        const existingCards = container.querySelectorAll('.building-card');
        if (existingCards.length > 0) {
            // Update existing cards (counts and affordability)
            existingCards.forEach(card => {
                const buildingType = card.dataset.buildingType;
                const buildingData = state.buildingsData.find(b => b.id === buildingType);
                if (buildingData && state.settlement) {
                    const count = state.settlement.buildings[buildingType]?.count || 0;
                    const badge = card.querySelector('.building-count-badge');
                    if (badge) {
                        badge.textContent = count;
                    }

                    // Update affordability
                    const canAfford = checkCanAffordBuilding(buildingData);
                    if (canAfford) {
                        card.classList.remove('building-disabled');
                    } else {
                        card.classList.add('building-disabled');
                    }
                }
            });
            return; // Don't re-render if cards already exist
        }

        // INITIAL RENDER ONLY (when no cards exist yet)
        container.innerHTML = '';

        // Render all buildings (resource production, population, and training buildings)
        state.buildingsData.forEach(buildingData => {
            if (buildingData.category === 'resource_production' || buildingData.category === 'population' || buildingData.category === 'training') {
                const buildingCard = document.createElement('div');
                buildingCard.className = 'building-card';
                buildingCard.dataset.buildingType = buildingData.id;

                const count = state.settlement.buildings[buildingData.id]?.count || 0;

                // Check if player can afford this building
                const canAfford = checkCanAffordBuilding(buildingData);

                // Add disabled class if can't afford
                if (!canAfford) {
                    buildingCard.classList.add('building-disabled');
                }

                buildingCard.innerHTML = `
                    <div class="building-header">
                        <div class="building-icon">${buildingData.icon}</div>
                        <div class="building-info">
                            <div class="building-name">${buildingData.name}</div>
                        </div>
                    </div>
                    <div class="building-count-badge">${count}</div>
                `;

                container.appendChild(buildingCard);
            }
        });
    }

    function checkCanAffordBuilding(buildingData) {
        // Training buildings (tiered) can only be built once
        if (buildingData.category === 'training') {
            const existing = state.settlement.buildings[buildingData.id]?.count || 0;
            if (existing >= 1) return false;
        }

        // Check building prerequisites (requires)
        if (buildingData.requires) {
            for (const requiredId of buildingData.requires) {
                const count = state.settlement.buildings[requiredId]?.count || 0;
                if (count === 0) return false;
            }
        }

        if (!buildingData.cost) return true;

        for (const [resourceId, cost] of Object.entries(buildingData.cost)) {
            const current = state.settlement.resources[resourceId]?.current || 0;
            if (current < cost) {
                return false;
            }
        }
        return true;
    }

    // ============================================
    // BUILDING CONSTRUCTION
    // ============================================
    function constructBuilding(buildingType) {
        // Get settlement from GameState to ensure we have the latest reference
        const gameState = window.GameState?.getState();
        if (!gameState || !gameState.settlement) {
            return;
        }

        // Update local reference
        state.settlement = gameState.settlement;

        if (!state.settlement.buildings[buildingType]) {
            return;
        }

        // Get building data
        const buildingData = state.buildingsData.find(b => b.id === buildingType);
        if (!buildingData) {
            return;
        }

        // Check building prerequisites
        if (buildingData.requires) {
            for (const requiredId of buildingData.requires) {
                const count = state.settlement.buildings[requiredId]?.count || 0;
                if (count === 0) {
                    const reqBuilding = state.buildingsData.find(b => b.id === requiredId);
                    const reqName = reqBuilding ? reqBuilding.name : requiredId;
                    alert(`Requires: ${reqName}`);
                    return;
                }
            }
        }

        // Training buildings (tiered) can only be built once each
        if (buildingData.category === 'training') {
            const existing = state.settlement.buildings[buildingType]?.count || 0;
            if (existing >= 1) {
                return; // Already built
            }
        }

        // Check resources dynamically
        const cost = buildingData.cost || {};
        const missingResources = [];

        for (const [resourceId, resourceCost] of Object.entries(cost)) {
            const current = state.settlement.resources[resourceId]?.current || 0;
            if (current < resourceCost) {
                const resourceDef = state.resourcesData.find(r => r.id === resourceId);
                const resourceName = resourceDef ? resourceDef.name : resourceId;
                missingResources.push(`${resourceName}: ${Math.floor(current)}/${resourceCost}`);
            }
        }

        if (missingResources.length > 0) {
            alert(`Not enough resources!\n${missingResources.join('\n')}`);
            return;
        }

        // Deduct resources dynamically
        for (const [resourceId, resourceCost] of Object.entries(cost)) {
            if (state.settlement.resources[resourceId]) {
                state.settlement.resources[resourceId].current -= resourceCost;
            }
        }

        // Increment building count
        state.settlement.buildings[buildingType].count++;

        // Production is now calculated dynamically from buildings.json
        // No need to store production values - they're computed on-the-fly

        // Update population cap if this is a housing building
        if (buildingData.populationCapBonus) {
            updatePopulationCap();
        }

        // Update UI and save
        updateUI();

        if (window.GameState) {
            GameState.updateProperty('settlement', state.settlement);
        }
        if (window.SaveSystem) {
            SaveSystem.save();
        }
    }

    // ============================================
    // RESOURCE GENERATION (Based on in-game time)
    // ============================================
    let resourceAccumulators = {};
    let wandererSpawnAccumulator = 0; // Accumulate fractional days for wanderer spawning

    /**
     * Calculate total resource generation rates based on buildings AND worker assignments
     * Buildings are now WORKSTATIONS - they only produce if workers are assigned
     * Returns NET rates (production - consumption)
     */
    function calculateResourceGenerationRates() {
        if (!state.settlement) {
            // Return empty object - will be populated dynamically
            const emptyRates = {};
            state.resourcesData.forEach(r => {
                emptyRates[r.id] = 0;
            });
            return emptyRates;
        }

        // Initialize rates object dynamically from available resources
        const rates = {};
        state.resourcesData.forEach(resource => {
            rates[resource.id] = 0;
        });

        // Initialize assigned workers if not present (for old saves)
        if (!state.settlement.population || !state.settlement.population.assigned) {
            // Still apply consumption even if no workers assigned
            if (state.settlement.population?.total) {
                const foodConsumption = state.settlement.population.total * 0.1;
                rates.food = -foodConsumption;
            }
            return rates;
        }

        // Add production from buildings ONLY where workers are assigned
        for (const buildingId in state.settlement.buildings) {
            const building = state.settlement.buildings[buildingId];
            const buildingData = state.buildingsData.find(b => b.id === buildingId);

            if (buildingData && buildingData.production && building.count > 0) {
                // Get number of workers assigned to this building type
                const workersAssigned = state.settlement.population.assigned[buildingId] || 0;

                // Production = min(building count, workers assigned) * production rate
                // Each worker can operate 1 building
                const activeBuildings = Math.min(building.count, workersAssigned);

                for (const resource in buildingData.production) {
                    if (rates[resource] !== undefined) {
                        // Only active buildings (with workers) produce
                        rates[resource] += buildingData.production[resource] * activeBuildings;
                    }
                }
            }
        }

        // Subtract food consumption (0.1 food per person per day)
        if (state.settlement.population?.total) {
            const foodConsumption = state.settlement.population.total * 0.1;
            rates.food = (rates.food || 0) - foodConsumption;
        }

        return rates;
    }

    /**
     * Calculate total resource capacity bonuses based on buildings
     */
    function calculateResourceCapacityBonuses() {
        if (!state.settlement) {
            const emptyBonuses = {};
            state.resourcesData.forEach(r => {
                emptyBonuses[r.id] = 0;
            });
            return emptyBonuses;
        }

        // Initialize bonuses object dynamically from available resources
        const bonuses = {};
        state.resourcesData.forEach(resource => {
            bonuses[resource.id] = 0;
        });

        // Add capacity bonuses from buildings
        for (const buildingId in state.settlement.buildings) {
            const building = state.settlement.buildings[buildingId];
            const buildingData = state.buildingsData.find(b => b.id === buildingId);

            if (buildingData && buildingData.capacityBonus && building.count > 0) {
                // Each building provides its specified capacity bonus
                for (const resource in buildingData.capacityBonus) {
                    if (bonuses[resource] !== undefined) {
                        bonuses[resource] += buildingData.capacityBonus[resource] * building.count;
                    }
                }
            }
        }

        return bonuses;
    }

    function startResourceGeneration() {
        // No longer using real-time intervals
        // Resources are now generated via onTimeAdvance callback
    }

    function onTimeAdvance(daysAdvanced) {
        if (!state.settlement) return;

        // Initialize population structure if it doesn't exist (for old saves)
        if (!state.settlement.population || typeof state.settlement.population === 'number') {
            const oldPop = state.settlement.population || 0; // Start with 0 if no previous population
            state.settlement.population = {
                total: oldPop,
                max: 20,
                idle: oldPop,
                assigned: {}
            };
        }

        // Update population cap based on housing buildings
        updatePopulationCap();

        // Accumulate fractional days for wanderer spawning
        wandererSpawnAccumulator += daysAdvanced;

        // Try to spawn wanderers for each full day that has passed
        const fullDays = Math.floor(wandererSpawnAccumulator);
        if (fullDays > 0) {
            for (let i = 0; i < fullDays; i++) {
                trySpawnWanderer();
            }
            // Subtract the full days, keep the fractional remainder
            wandererSpawnAccumulator -= fullDays;
        }

        // Get current generation rates (base + buildings + workers)
        const currentRates = calculateResourceGenerationRates();

        // Get capacity bonuses from buildings
        const capacityBonuses = calculateResourceCapacityBonuses();

        // Accumulate fractional resources based on days passed
        for (const resource in currentRates) {
            // Initialize accumulator for this resource if it doesn't exist
            if (resourceAccumulators[resource] === undefined) {
                resourceAccumulators[resource] = 0;
            }

            resourceAccumulators[resource] += currentRates[resource] * daysAdvanced;

            // Convert accumulated fractional resources to whole resources
            const wholeResources = Math.floor(Math.abs(resourceAccumulators[resource]));
            if (wholeResources > 0) {
                const r = state.settlement.resources[resource];
                if (r) {
                    if (resourceAccumulators[resource] > 0) {
                        // Positive accumulator - add resources
                        r.current += wholeResources;
                        // Clamp to max capacity (base + bonus)
                        const maxCapacity = r.max + (capacityBonuses[resource] || 0);
                        r.current = Math.min(r.current, maxCapacity);
                    } else {
                        // Negative accumulator - subtract resources
                        r.current -= wholeResources;
                        // Prevent going negative
                        r.current = Math.max(0, r.current);
                    }

                    // Subtract the whole resources from accumulator, keep the remainder
                    resourceAccumulators[resource] -= (resourceAccumulators[resource] > 0 ? wholeResources : -wholeResources);
                }
            }
        }

        // Check for starvation (0 food)
        const currentFood = state.settlement.resources.food?.current || 0;
        if (currentFood === 0) {
            // Initialize starvationDays if it doesn't exist
            if (state.settlement.starvationDays === undefined) {
                state.settlement.starvationDays = 0;
            }

            state.settlement.starvationDays += fullDays;

            // Every 3 days at 0 food, a person leaves
            if (state.settlement.starvationDays >= 3) {
                const peopleToRemove = Math.floor(state.settlement.starvationDays / 3);

                for (let i = 0; i < peopleToRemove; i++) {
                    if (state.settlement.population.total > 0) {
                        state.settlement.population.total--;

                        // Remove from idle first, then from assigned workers
                        if (state.settlement.population.idle > 0) {
                            state.settlement.population.idle--;
                        } else {
                            // Remove from first assigned job with workers
                            for (const buildingType in state.settlement.population.assigned) {
                                if (state.settlement.population.assigned[buildingType] > 0) {
                                    state.settlement.population.assigned[buildingType]--;
                                    if (state.settlement.population.assigned[buildingType] === 0) {
                                        delete state.settlement.population.assigned[buildingType];
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }

                // Reset starvation counter for remainder
                state.settlement.starvationDays = state.settlement.starvationDays % 3;
            }
        } else {
            // Food is available, reset starvation counter
            state.settlement.starvationDays = 0;
        }

        // Update UI in real-time (including current tab)
        updateUI();
    }

    /**
     * Calculate population cap based on housing buildings
     */
    function updatePopulationCap() {
        const baseCap = 20;
        let bonusCap = 0;

        const housingCount = state.settlement.buildings.housing?.count || 0;
        const housingData = state.buildingsData.find(b => b.id === 'housing');
        if (housingData && housingData.populationCapBonus) {
            bonusCap = housingCount * housingData.populationCapBonus;
        }

        state.settlement.population.max = baseCap + bonusCap;
    }

    /**
     * Calculate wanderer spawn chance based on taverns
     */
    function getWandererSpawnChance() {
        const tavernCount = state.settlement.buildings.tavern?.count || 0;

        // No taverns = no wanderers can spawn
        if (tavernCount === 0) {
            return 0;
        }

        const baseChance = 0.02; // 2% base chance per day (only when tavern exists)
        let bonusChance = 0;

        const tavernData = state.buildingsData.find(b => b.id === 'tavern');
        if (tavernData && tavernData.wandererSpawnBonus) {
            bonusChance = tavernCount * tavernData.wandererSpawnBonus;
        }

        // Cap at 100% (1.0)
        return Math.min(1.0, baseChance + bonusChance);
    }

    /**
     * Try to spawn a wanderer based on spawn chance
     */
    function trySpawnWanderer() {
        const pop = state.settlement.population;

        // Can't spawn if at max population
        if (pop.total >= pop.max) return;

        // Can't spawn if food is at 0 (starvation prevents new arrivals)
        const currentFood = state.settlement.resources.food?.current || 0;
        if (currentFood === 0) return;

        const spawnChance = getWandererSpawnChance();
        const roll = Math.random();

        if (roll < spawnChance) {
            pop.total++;
            pop.idle++;
        }
    }

    // ============================================
    // WORKER MANAGEMENT
    // ============================================

    /**
     * Assign a worker to a building type
     */
    function assignWorker(buildingType) {
        const pop = state.settlement.population;

        // Check if there are idle workers
        if (pop.idle <= 0) {
            alert('No idle workers available!');
            return false;
        }

        // Get building data and count
        const buildingCount = state.settlement.buildings[buildingType]?.count || 0;
        if (buildingCount === 0) {
            alert('You need to build this building first!');
            return false;
        }

        // Get current workers assigned
        const currentWorkers = pop.assigned[buildingType] || 0;

        // Can't assign more workers than buildings
        if (currentWorkers >= buildingCount) {
            alert('All buildings of this type are already staffed!');
            return false;
        }

        // Assign the worker
        pop.assigned[buildingType] = currentWorkers + 1;
        pop.idle--;

        updateUI();
        SaveSystem.save();
        return true;
    }

    /**
     * Unassign a worker from a building type
     */
    function unassignWorker(buildingType) {
        const pop = state.settlement.population;

        // Get current workers assigned
        const currentWorkers = pop.assigned[buildingType] || 0;

        if (currentWorkers === 0) {
            alert('No workers assigned to this building!');
            return false;
        }

        // Unassign the worker
        pop.assigned[buildingType] = currentWorkers - 1;
        if (pop.assigned[buildingType] === 0) {
            delete pop.assigned[buildingType];
        }
        pop.idle++;

        updateUI();
        SaveSystem.save();
        return true;
    }

    /**
     * Update the population tab UI
     */
    function updatePopulationTab() {
        const container = document.querySelector('#settlement-population-content .population-management');
        if (!container) return;

        const pop = state.settlement.population;
        const spawnChance = (getWandererSpawnChance() * 100).toFixed(1);

        let html = `
            <div class="population-header">
                <h3>Population Management</h3>
                <div class="population-stats">
                    <div class="stat-row">
                        <span class="stat-label">Total Population:</span>
                        <span class="stat-value">${pop.total} / ${pop.max}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Idle Workers:</span>
                        <span class="stat-value">${pop.idle}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Wanderer Spawn Chance:</span>
                        <span class="stat-value">${spawnChance}% per day</span>
                    </div>
                </div>
            </div>

            <div class="worker-allocation">
                <h4>Worker Allocation</h4>
                <p class="help-text">Assign workers to buildings to produce resources. Each building requires 1 worker.</p>
                <div class="worker-list">
        `;

        // Show all building types that can have workers (production buildings)
        state.buildingsData.forEach(buildingData => {
            if (buildingData.category === 'resource_production' && buildingData.production) {
                const buildingCount = state.settlement.buildings[buildingData.id]?.count || 0;
                const workersAssigned = pop.assigned[buildingData.id] || 0;

                html += `
                    <div class="worker-allocation-row">
                        <div class="building-info-col">
                            <span class="building-icon">${buildingData.icon}</span>
                            <span class="building-name">${buildingData.name}</span>
                        </div>
                        <div class="worker-count-col">
                            <span class="workers-assigned">${workersAssigned} / ${buildingCount}</span>
                        </div>
                        <div class="worker-buttons-col">
                            <button class="worker-btn unassign-btn" data-building="${buildingData.id}" ${workersAssigned === 0 ? 'disabled' : ''}>-</button>
                            <button class="worker-btn assign-btn" data-building="${buildingData.id}" ${workersAssigned >= buildingCount || pop.idle === 0 ? 'disabled' : ''}>+</button>
                        </div>
                    </div>
                `;
            }
        });

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Add event listeners for worker buttons
        container.querySelectorAll('.assign-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const buildingType = btn.dataset.building;
                assignWorker(buildingType);
            });
        });

        container.querySelectorAll('.unassign-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const buildingType = btn.dataset.building;
                unassignWorker(buildingType);
            });
        });
    }

    // ============================================
    // TRAINING TAB
    // ============================================

    // Persistent training UI state — survives re-renders from time ticks
    let trainingUI = {
        selectedMethodId: null,
        selectedDays: 1,
        configRendered: false  // true once the config panel HTML has been built
    };

    function updateTrainingTab() {
        if (!window.Training) return;

        const character = window.GameState?.getState()?.character;
        if (!character) return;

        updateTrainingProgress();
        updateTrainingSkillList();

        if (state.selectedTrainingSkillId) {
            updateTrainingConfig(state.selectedTrainingSkillId);
        }
    }

    function updateTrainingProgress() {
        const trainingState = window.Training.getTrainingState();
        const progressSection = document.getElementById('training-progress-section');
        if (!progressSection) return;

        if (!trainingState || !trainingState.active) {
            progressSection.style.display = 'none';
            return;
        }

        progressSection.style.display = 'block';

        const methods = window.Training.getTrainingMethods();
        const method = methods[trainingState.methodId];

        document.getElementById('active-training-skill').textContent =
            trainingState.skillId.charAt(0).toUpperCase() + trainingState.skillId.slice(1);
        document.getElementById('active-training-method').textContent = method.name;

        const progress = (trainingState.daysCompleted / trainingState.totalDays) * 100;
        document.getElementById('training-progress-bar').style.width = `${progress}%`;
        document.getElementById('training-progress-text').textContent =
            `Day ${trainingState.daysCompleted.toFixed(2)} / ${trainingState.totalDays}`;

        const pauseBtn = document.getElementById('pause-training-btn');
        if (pauseBtn) {
            pauseBtn.textContent = trainingState.paused ? 'Resume' : 'Pause';
            pauseBtn.onclick = trainingState.paused
                ? () => window.Training.resumeTraining()
                : () => window.Training.pauseTraining();
        }

        const cancelBtn = document.getElementById('cancel-training-btn');
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                if (confirm('Cancel training? You will receive partial XP for completed days.')) {
                    window.Training.cancelTraining();
                }
            };
        }
    }

    function updateTrainingSkillList() {
        const container = document.getElementById('training-skill-list');
        if (!container) return;

        const character = window.GameState?.getState()?.character;
        if (!character) return;

        const trainableSkills = window.Training.getTrainableSkills();
        const allSkills = window.SkillManager?.getAllSkills() || [];

        // Only show skills the character has unlocked (has any XP in), filtered to trainable ones
        const visibleSkills = allSkills.filter(skillDef =>
            trainableSkills.includes(skillDef.id) && character.skills?.[skillDef.id]
        );

        // Fingerprint of which skills are visible — rebuild list if it changes (new skill unlocked)
        const visibleFingerprint = visibleSkills.map(s => s.id).join(',');

        // If items already exist and the set hasn't changed, just update XP text and selection in-place
        const existingItems = container.querySelectorAll('.training-skill-item');
        if (existingItems.length > 0 && container.dataset.skillFingerprint === visibleFingerprint) {
            existingItems.forEach(item => {
                const skillId = item.dataset.skillId;
                const isSelected = state.selectedTrainingSkillId === skillId;
                item.classList.toggle('selected', isSelected);

                const skillData = character.skills?.[skillId];
                const xp = skillData?.xp || 0;
                const levelInfo = window.SkillManager?.getLevelInfo(xp, skillId);
                const level = levelInfo?.level || 1;
                const levelEl = item.querySelector('.training-skill-item-level');
                if (levelEl) levelEl.textContent = `Level ${level} (${xp} XP)`;
            });
            return;
        }

        // Build/rebuild the list
        container.innerHTML = '';
        container.dataset.skillFingerprint = visibleFingerprint;

        if (visibleSkills.length === 0) {
            container.innerHTML = '<p class="empty-message">No trainable skills unlocked yet</p>';
            return;
        }

        visibleSkills.forEach(skillDef => {
            const skillData = character.skills?.[skillDef.id];
            const xp = skillData?.xp || 0;
            const levelInfo = window.SkillManager?.getLevelInfo(xp, skillDef.id);
            const level = levelInfo?.level || 1;

            const item = document.createElement('div');
            item.className = 'training-skill-item' + (state.selectedTrainingSkillId === skillDef.id ? ' selected' : '');
            item.dataset.skillId = skillDef.id;
            item.innerHTML = `<div class="training-skill-item-name">${skillDef.name}</div>
                <div class="training-skill-item-level">Level ${level} (${xp} XP)</div>`;

            item.addEventListener('click', () => {
                state.selectedTrainingSkillId = skillDef.id;
                updateTrainingSkillList();
                updateTrainingConfig(skillDef.id);
            });

            container.appendChild(item);
        });
    }

    function updateTrainingConfig(skillId) {
        const container = document.getElementById('training-config-content');
        if (!container) return;

        const character = window.GameState?.getState()?.character;
        if (!character) return;

        const skillDef = window.SkillManager?.getSkillById(skillId);
        if (!skillDef) return;

        const skillData = character.skills?.[skillId];
        const xp = skillData?.xp || 0;
        const levelInfo = window.SkillManager?.getLevelInfo(xp, skillId);
        const level = levelInfo?.level || 1;
        const xpProgress = levelInfo?.xpProgress || 0;
        const xpNeeded = levelInfo?.xpNeeded || 100;

        const methods = window.Training.getTrainingMethods();

        // Build a fingerprint of training-relevant building counts so we rebuild when they change
        const buildingFingerprint = Object.values(methods)
            .map(m => `${m.requiredBuilding}:${state.settlement?.buildings[m.requiredBuilding]?.count || 0}`)
            .join(',');

        // Only do a full rebuild when the skill changes, buildings change, or panel hasn't been built yet
        const needsRebuild = !trainingUI.configRendered ||
            container.dataset.renderedSkill !== skillId ||
            container.dataset.buildingFingerprint !== buildingFingerprint;

        if (needsRebuild) {
            const previousMethodId = trainingUI.selectedMethodId; // preserve across rebuilds
            trainingUI.selectedMethodId = null;
            trainingUI.selectedDays = trainingUI.selectedDays || 1;
            trainingUI.configRendered = true;
            container.dataset.renderedSkill = skillId;
            container.dataset.buildingFingerprint = buildingFingerprint;

            let html = `
                <div class="training-skill-info">
                    <h2 id="tc-skill-name">${skillDef.name}</h2>
                    <div class="training-skill-level" id="tc-skill-level">Level ${level}</div>
                    <div class="training-skill-xp" id="tc-skill-xp">${xpProgress} / ${xpNeeded} XP to next level</div>
                </div>
                <div class="training-methods-section">
                    <h3>Training Method</h3>
                    <div class="training-methods-grid">`;

            Object.values(methods).forEach(method => {
                const isUnlocked = window.Training.isTrainingMethodUnlocked(method.id);
                const reqDef = state.buildingsData.find(b => b.id === method.requiredBuilding);
                const reqName = reqDef ? reqDef.name : method.requiredBuilding;
                html += `<div class="training-method-card${isUnlocked ? '' : ' locked'}" data-method-id="${method.id}">
                    <div class="training-method-header">
                        <span class="training-method-name">${method.name}</span>
                        <span class="training-method-difficulty">Difficulty: ${method.difficulty}</span>
                    </div>
                    <div class="training-method-xp">${method.xpPerDay} XP per day</div>
                    ${!isUnlocked ? `<div class="training-method-locked-msg">Requires ${reqName}</div>` : ''}
                </div>`;
            });

            html += `</div></div>
                <div class="training-time-section">
                    <h3>Training Duration</h3>
                    <div class="training-time-slider-container">
                        <div class="training-time-value"><span id="tc-days-value">1</span> days</div>
                        <input type="range" min="1" max="30" value="1" id="tc-slider">
                        <div class="training-expected-xp" id="tc-expected-xp">Expected XP: —</div>
                    </div>
                </div>
                <div class="training-action-section">
                    <button class="training-btn training-btn-primary" id="tc-begin-btn">Begin Training</button>
                </div>`;

            container.innerHTML = html;

            // Restore previously selected method if it's still unlocked after rebuild
            if (previousMethodId && window.Training.isTrainingMethodUnlocked(previousMethodId)) {
                trainingUI.selectedMethodId = previousMethodId;
                const restoredCard = container.querySelector(`.training-method-card[data-method-id="${previousMethodId}"]`);
                if (restoredCard) restoredCard.classList.add('selected');
            }

            // Wire up method card clicks
            container.querySelectorAll('.training-method-card:not(.locked)').forEach(card => {
                card.addEventListener('click', () => {
                    container.querySelectorAll('.training-method-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    trainingUI.selectedMethodId = card.dataset.methodId;
                    refreshTrainingConfigState();
                });
            });

            // Wire up slider
            const slider = container.querySelector('#tc-slider');
            slider.value = trainingUI.selectedDays;
            slider.addEventListener('input', () => {
                trainingUI.selectedDays = parseInt(slider.value);
                refreshTrainingConfigState();
            });

            // Wire up begin button
            container.querySelector('#tc-begin-btn').addEventListener('click', () => {
                const ts = window.Training.getTrainingState();
                if (trainingUI.selectedMethodId && !ts?.active) {
                    window.Training.startTraining(skillId, trainingUI.selectedMethodId, trainingUI.selectedDays);
                }
            });
        } else {
            // Just update the live-data fields in-place without rebuilding
            const lvlEl = document.getElementById('tc-skill-level');
            const xpEl = document.getElementById('tc-skill-xp');
            if (lvlEl) lvlEl.textContent = `Level ${level}`;
            if (xpEl) xpEl.textContent = `${xpProgress} / ${xpNeeded} XP to next level`;
        }

        refreshTrainingConfigState();
    }

    function refreshTrainingConfigState() {
        const trainingState = window.Training.getTrainingState();
        const methods = window.Training.getTrainingMethods();

        const daysEl = document.getElementById('tc-days-value');
        const sliderEl = document.getElementById('tc-slider');
        const xpEl = document.getElementById('tc-expected-xp');
        const beginBtn = document.getElementById('tc-begin-btn');

        if (daysEl) daysEl.textContent = trainingUI.selectedDays;
        if (sliderEl) sliderEl.value = trainingUI.selectedDays;

        if (xpEl) {
            if (trainingUI.selectedMethodId && methods[trainingUI.selectedMethodId]) {
                const method = methods[trainingUI.selectedMethodId];
                const intMod = 0;
                const xp = Math.floor(method.xpPerDay * trainingUI.selectedDays * (1 + intMod));
                xpEl.textContent = `Expected XP: ${xp}`;
            } else {
                xpEl.textContent = 'Expected XP: —';
            }
        }

        if (beginBtn) {
            const canBegin = trainingUI.selectedMethodId && !trainingState?.active;
            beginBtn.disabled = !canBegin;
            beginBtn.textContent = trainingState?.active ? 'Already training' : 'Begin Training';
        }
    }

    // ============================================
    // PUBLIC API
    // ============================================
    return {
        init,
        create,
        updateUI,
        onTimeAdvance,
        getState: () => {
            // Include resource accumulators in state
            return {
                ...state.settlement,
                resourceAccumulators: { ...resourceAccumulators }
            };
        },
        setState: (s) => {
            state.settlement = s;

            // Merge in any new resources from resources.json that don't exist in the save
            if (s && s.resources) {
                state.resourcesData.forEach(resourceDef => {
                    if (!s.resources[resourceDef.id]) {
                        s.resources[resourceDef.id] = {
                            current: resourceDef.defaultStart || 0,
                            max: resourceDef.defaultMax || 100
                        };
                    }
                });
            }

            // Merge in any new buildings from buildings.json that don't exist in the save
            if (s && s.buildings) {
                state.buildingsData.forEach(buildingDef => {
                    if (!s.buildings[buildingDef.id]) {
                        s.buildings[buildingDef.id] = { count: 0 };
                    }
                });
            }

            // Restore resource accumulators if they exist
            if (s && s.resourceAccumulators) {
                resourceAccumulators = { ...s.resourceAccumulators };
            }

            updateUI();
        }
    };
})();

window.Settlement = Settlement;
