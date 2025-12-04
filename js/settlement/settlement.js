// ============================================
// Settlement System
// ============================================

const Settlement = (() => {
    // Settlement state
    let state = {
        settlement: null,
        buildingsData: [],
        currentTab: 'buildings'
    };

    // ============================================
    // INITIALIZATION & DATA LOADING
    // ============================================
    async function init() {
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

        state.settlement = {
            id: generateId(),
            name,
            population: 10,
            morale: 100,
            day: 1,
            resources: {
                wood: { current: 3, max: 100, production: 0 },
                stone: { current: 3, max: 100, production: 0 },
                food: { current: 3, max: 100, production: 0 }
            },
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

        // Building buttons (delegate to parent to handle dynamic content)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('building-build-btn')) {
                e.stopPropagation();
                const card = e.target.closest('.building-card');
                if (card) {
                    const buildingType = card.dataset.buildingType;
                    constructBuilding(buildingType);
                }
            }
        });
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
        // Calculate current generation rates (base + buildings)
        const currentRates = calculateResourceGenerationRates();

        updateResource('wood', state.settlement.resources.wood, currentRates.wood);
        updateResource('stone', state.settlement.resources.stone, currentRates.stone);
        updateResource('food', state.settlement.resources.food, currentRates.food);
    }

    function updateResource(name, data, generationRate) {
        const items = document.querySelectorAll('.resource-item');
        items.forEach(item => {
            const nameEl = item.querySelector('.resource-name');
            if (nameEl && nameEl.textContent.toLowerCase() === name) {
                item.querySelector('.current').textContent = Math.floor(data.current);
                item.querySelector('.max').textContent = data.max;

                const prodEl = item.querySelector('.resource-production');
                const prod = generationRate.toFixed(1);
                prodEl.textContent = generationRate > 0 ? `+${prod}/d` : `${prod}/d`;
                prodEl.className = 'resource-production ' + (generationRate > 0 ? 'positive' : generationRate < 0 ? 'negative' : 'stable');
            }
        });
    }

    function updateBuildingsTab() {
        const cards = document.querySelectorAll('.building-card');
        cards.forEach(card => {
            const type = card.dataset.buildingType;
            if (type && state.settlement.buildings[type] !== undefined) {
                const countEl = card.querySelector('.building-count');
                if (countEl) {
                    countEl.textContent = state.settlement.buildings[type].count;
                }
            }
        });
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

        // Check resources
        const cost = buildingData.cost;
        if (state.settlement.resources.wood.current < cost.wood ||
            state.settlement.resources.stone.current < cost.stone ||
            state.settlement.resources.food.current < cost.food) {
            alert(`Not enough resources! Need: ${cost.wood} Wood, ${cost.stone} Stone, ${cost.food} Food`);
            return;
        }

        // Deduct resources
        state.settlement.resources.wood.current -= cost.wood;
        state.settlement.resources.stone.current -= cost.stone;
        state.settlement.resources.food.current -= cost.food;

        // Increment building count
        state.settlement.buildings[buildingType].count++;

        // Update production
        const production = buildingData.production;
        for (const resource in production) {
            if (state.settlement.resources[resource]) {
                state.settlement.resources[resource].production += production[resource];
            }
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
    let resourceAccumulators = {
        wood: 0,    // 1 wood per 1 day
        stone: 0,   // 1 stone per 3 days
        food: 0     // 1 food per 5 days
    };

    /**
     * Calculate total resource generation rates based on buildings
     */
    function calculateResourceGenerationRates() {
        if (!state.settlement) {
            return { wood: 0, stone: 0, food: 0 };
        }

        const rates = {
            wood: 0,
            stone: 0,
            food: 0
        };

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

    function startResourceGeneration() {
        // No longer using real-time intervals
        // Resources are now generated via onTimeAdvance callback
    }

    function onTimeAdvance(daysAdvanced) {
        if (!state.settlement) return;

        // Get current generation rates (base + buildings)
        const currentRates = calculateResourceGenerationRates();

        // Accumulate fractional resources based on days passed
        for (const resource in currentRates) {
            resourceAccumulators[resource] += currentRates[resource] * daysAdvanced;

            // Convert accumulated fractional resources to whole resources
            const wholeResources = Math.floor(resourceAccumulators[resource]);
            if (wholeResources > 0) {
                const r = state.settlement.resources[resource];
                r.current += wholeResources;
                r.current = Math.max(0, Math.min(r.current, r.max));

                // Subtract the whole resources from accumulator, keep the remainder
                resourceAccumulators[resource] -= wholeResources;
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
            // Restore resource accumulators if they exist
            if (s && s.resourceAccumulators) {
                resourceAccumulators = { ...s.resourceAccumulators };
            }
            updateUI();
        }
    };
})();

window.Settlement = Settlement;
