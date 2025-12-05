// ============================================
// Settlement System
// ============================================

const Settlement = (() => {
    // Settlement state
    let state = {
        settlement: null,
        buildingsData: [],
        resourcesData: [],
        currentTab: 'buildings'
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
            console.log('✅ Loaded resources:', state.resourcesData.map(r => r.id).join(', '));
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
            population: 10,
            morale: 100,
            day: 1,
            resources: resources,
            buildings: buildings
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
        // Tab switching
        document.querySelectorAll('.settlement-nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                switchTab(tab.dataset.settlementTab);
            });
        });

        // Building card clicks (delegate to parent to handle dynamic content)
        document.addEventListener('click', (e) => {
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
            const card = e.target.closest('.building-card');
            if (card && card.dataset.buildingType) {
                const buildingType = card.dataset.buildingType;
                showBuildingTooltip(buildingType, card);
            }
        }, true);

        document.addEventListener('mouseleave', (e) => {
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
        state.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.settlement-nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.settlementTab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.settlement-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`settlement-${tabName}-content`)?.classList.add('active');
    }

    // ============================================
    // UI UPDATES
    // ============================================
    function updateUI() {
        if (!state.settlement) return;

        updateHeaderBar();
        updateResourcesPanel();

        if (state.currentTab === 'buildings') {
            updateBuildingsTab();
        }
    }

    function updateHeaderBar() {
        const s = state.settlement;
        document.getElementById('settlement-civ-name').textContent = s.name;
        document.getElementById('settlement-header-pop').textContent = s.population;
        document.getElementById('settlement-header-morale').textContent = `${s.morale}%`;
        document.getElementById('settlement-header-day').textContent = s.day;
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

                resourceRow.innerHTML = `
                    <div class="resource-name-col">${resourceDef.name}</div>
                    <div class="resource-amount-col ${amountClass}">${currentFormatted} / ${maxFormatted}</div>
                    <div class="resource-rate-col">${rate > 0 ? rateText + ' /d' : ''}</div>
                `;

                resourceContainer.appendChild(resourceRow);
            }
        });
    }

    function updateBuildingsTab() {
        const container = document.querySelector('.buildings-grid');
        if (!container) return;

        // Clear and re-render all buildings dynamically
        container.innerHTML = '';

        // Render resource production buildings
        state.buildingsData.forEach(buildingData => {
            if (buildingData.category === 'resource_production') {
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
        if (!state.settlement || !state.settlement.buildings[buildingType]) {
            return;
        }

        // Get building data
        const buildingData = state.buildingsData.find(b => b.id === buildingType);
        if (!buildingData) return;

        // Check resources dynamically
        const cost = buildingData.cost;
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

    /**
     * Calculate total resource generation rates based on buildings
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

        // Add production from buildings only (no base rate)
        for (const buildingId in state.settlement.buildings) {
            const building = state.settlement.buildings[buildingId];
            const buildingData = state.buildingsData.find(b => b.id === buildingId);

            if (buildingData && buildingData.production && building.count > 0) {
                // Each building produces its specified amount per day
                for (const resource in buildingData.production) {
                    if (rates[resource] !== undefined) {
                        // buildingData.production[resource] is the amount per building per day
                        rates[resource] += buildingData.production[resource] * building.count;
                    }
                }
            }
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

        // Get current generation rates (base + buildings)
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
            const wholeResources = Math.floor(resourceAccumulators[resource]);
            if (wholeResources > 0) {
                const r = state.settlement.resources[resource];
                if (r) {
                    r.current += wholeResources;
                    // Clamp to max capacity (base + bonus)
                    const maxCapacity = r.max + (capacityBonuses[resource] || 0);
                    r.current = Math.max(0, Math.min(r.current, maxCapacity));

                    // Subtract the whole resources from accumulator, keep the remainder
                    resourceAccumulators[resource] -= wholeResources;
                }
            }
        }

        // Update UI
        updateResourcesPanel();
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
                        console.log(`🆕 Added new resource to save: ${resourceDef.id}`);
                    }
                });
            }

            // Merge in any new buildings from buildings.json that don't exist in the save
            if (s && s.buildings) {
                state.buildingsData.forEach(buildingDef => {
                    if (!s.buildings[buildingDef.id]) {
                        s.buildings[buildingDef.id] = { count: 0 };
                        console.log(`🆕 Added new building to save: ${buildingDef.id}`);
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
