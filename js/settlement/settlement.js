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
        updateResource('wood', state.settlement.resources.wood);
        updateResource('stone', state.settlement.resources.stone);
        updateResource('food', state.settlement.resources.food);
    }

    function updateResource(name, data) {
        const items = document.querySelectorAll('.resource-item');
        items.forEach(item => {
            const nameEl = item.querySelector('.resource-name');
            if (nameEl && nameEl.textContent.toLowerCase() === name) {
                item.querySelector('.current').textContent = Math.floor(data.current);
                item.querySelector('.max').textContent = data.max;

                const prodEl = item.querySelector('.resource-production');
                const prod = data.production.toFixed(1);
                prodEl.textContent = data.production > 0 ? `+${prod}/s` : `${prod}/s`;
                prodEl.className = 'resource-production ' + (data.production > 0 ? 'positive' : data.production < 0 ? 'negative' : 'stable');
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
    // RESOURCE GENERATION
    // ============================================
    let lastUpdateTime = Date.now();
    let updateInterval = null;

    function startResourceGeneration() {
        if (updateInterval) return;

        lastUpdateTime = Date.now();
        updateInterval = setInterval(() => {
            if (!state.settlement) return;

            const now = Date.now();
            const delta = (now - lastUpdateTime) / 1000; // Convert to seconds
            lastUpdateTime = now;

            // Update resources
            for (const resource in state.settlement.resources) {
                const r = state.settlement.resources[resource];
                r.current += r.production * delta;
                r.current = Math.max(0, Math.min(r.current, r.max));
            }

            // Update UI
            updateResourcesPanel();
        }, 100); // Update 10 times per second
    }

    // ============================================
    // PUBLIC API
    // ============================================
    return {
        init,
        create,
        updateUI,
        getState: () => state.settlement,
        setState: (s) => {
            state.settlement = s;
            updateUI();
        }
    };
})();

window.Settlement = Settlement;
