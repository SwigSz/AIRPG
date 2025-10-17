// ============================================
// Settlement System - Evolve Idle Style
// ============================================

const Settlement = (() => {
    // Settlement state
    let settlement = null;

    // UI State
    let currentTab = 'buildings';
    let tooltipElement = null;

    // ============================================
    // INITIALIZATION
    // ============================================
    function create(name) {
        settlement = {
            id: Utils.generateId(),
            name,
            population: GameConfig.SETTLEMENT.STARTING_POPULATION,
            morale: 100,
            day: 1,
            resources: {
                wood: { current: 500, max: 1000, production: 2.5 },
                stone: { current: 250, max: 500, production: 1.2 },
                food: { current: 800, max: 2000, production: -0.5 },
                iron: { current: 0, max: 100, production: 0 },
                energy: { current: 10, max: 10, production: 0 }
            },
            buildings: {
                hut: { count: 0, workers: 0, maxWorkers: 0 },
                lumberMill: { count: 0, workers: 0, maxWorkers: 0 }
            },
            upgrades: [],
            research: []
        };
        return settlement;
    }

    // ============================================
    // UI INITIALIZATION
    // ============================================
    function initializeUI() {
        // Initialize settlement tab navigation
        const settlementTabs = document.querySelectorAll('.settlement-nav-tab');
        settlementTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.settlementTab;
                switchSettlementTab(tabName);
            });
        });

        // Initialize category collapse/expand
        const categoryHeaders = document.querySelectorAll('.category-header');
        categoryHeaders.forEach(header => {
            header.addEventListener('click', () => {
                header.classList.toggle('collapsed');
            });
        });

        // Initialize tooltips
        initializeTooltips();

        // Update UI
        updateSettlementUI();
    }

    // ============================================
    // TAB SWITCHING
    // ============================================
    function switchSettlementTab(tabName) {
        currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.settlement-nav-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.settlementTab === tabName) {
                tab.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.settlement-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`settlement-${tabName}-content`)?.classList.add('active');
    }

    // ============================================
    // UI UPDATE FUNCTIONS
    // ============================================
    function updateSettlementUI() {
        if (!settlement) return;

        // Update header bar
        updateHeaderBar();

        // Update resources panel
        updateResourcesPanel();

        // Update current tab content
        switch (currentTab) {
            case 'buildings':
                updateBuildingsTab();
                break;
            case 'research':
                updateResearchTab();
                break;
            case 'population':
                updatePopulationTab();
                break;
            case 'trade':
                updateTradeTab();
                break;
            case 'territory':
                updateTerritoryTab();
                break;
        }
    }

    function updateHeaderBar() {
        const civNameEl = document.getElementById('settlement-civ-name');
        const popEl = document.getElementById('settlement-header-pop');
        const moraleEl = document.getElementById('settlement-header-morale');
        const dayEl = document.getElementById('settlement-header-day');

        if (civNameEl) civNameEl.textContent = settlement.name || 'Civilization Name';
        if (popEl) popEl.textContent = settlement.population || 0;
        if (moraleEl) moraleEl.textContent = `${settlement.morale || 100}%`;
        if (dayEl) dayEl.textContent = settlement.day || 1;
    }

    function updateResourcesPanel() {
        // Update wood
        updateResourceDisplay('wood', '🪵', 'Wood', settlement.resources.wood);
        updateResourceDisplay('stone', '🪨', 'Stone', settlement.resources.stone);
        updateResourceDisplay('food', '🌾', 'Food', settlement.resources.food);
        updateResourceDisplay('iron', '⚙️', 'Iron', settlement.resources.iron);
        updateResourceDisplay('energy', '⚡', 'Energy', settlement.resources.energy);
    }

    function updateResourceDisplay(resourceId, icon, name, data) {
        // For now, the resources are static in HTML
        // In the future, we can dynamically generate resource items
        // This function is a placeholder for when resources become dynamic
    }

    function updateBuildingsTab() {
        // Building counts and worker assignments are updated here
        // For now, this is handled by the static HTML
        // Future: dynamically generate building items from data
    }

    function updateResearchTab() {
        // Research tree updates
    }

    function updatePopulationTab() {
        // Population management updates
    }

    function updateTradeTab() {
        // Trade routes updates
    }

    function updateTerritoryTab() {
        // Territory map updates
    }

    // ============================================
    // TOOLTIPS
    // ============================================
    function initializeTooltips() {
        // Create tooltip element
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'tooltip';
        tooltipElement.style.display = 'none';
        document.body.appendChild(tooltipElement);

        // Tooltips disabled for resource items (no listeners added)

        // Add tooltip listeners to building items
        document.querySelectorAll('.building-item').forEach(item => {
            item.addEventListener('mouseenter', (e) => showBuildingTooltip(e, item));
            item.addEventListener('mouseleave', hideTooltip);
            item.addEventListener('mousemove', moveTooltip);
        });
    }

    function showResourceTooltip(e, element) {
        const resourceName = element.querySelector('.resource-name')?.textContent || 'Resource';
        const current = element.querySelector('.current')?.textContent || '0';
        const max = element.querySelector('.max')?.textContent || '0';
        const production = element.querySelector('.resource-production')?.textContent || '0/s';

        tooltipElement.innerHTML = `
            <div class="tooltip-title">${resourceName}</div>
            <div class="tooltip-description">
                Current: ${current} / ${max}<br>
                Production: ${production}
            </div>
        `;
        tooltipElement.style.display = 'block';
        moveTooltip(e);
    }

    function showBuildingTooltip(e, element) {
        const buildingName = element.querySelector('.building-name')?.textContent || 'Building';
        const count = element.querySelector('.building-count span')?.textContent || '0';

        tooltipElement.innerHTML = `
            <div class="tooltip-title">${buildingName}</div>
            <div class="tooltip-description">
                You have ${count} of this building.<br>
                Click to manage workers or build more.
            </div>
        `;
        tooltipElement.style.display = 'block';
        moveTooltip(e);
    }

    function moveTooltip(e) {
        if (!tooltipElement) return;
        const offset = 15;
        tooltipElement.style.left = (e.pageX + offset) + 'px';
        tooltipElement.style.top = (e.pageY + offset) + 'px';
    }

    function hideTooltip() {
        if (tooltipElement) {
            tooltipElement.style.display = 'none';
        }
    }

    // ============================================
    // WORKER ALLOCATION
    // ============================================
    function assignWorker(buildingId) {
        if (!settlement.buildings[buildingId]) return;

        const building = settlement.buildings[buildingId];
        if (building.workers < building.maxWorkers) {
            building.workers++;
            updateSettlementUI();
        }
    }

    function unassignWorker(buildingId) {
        if (!settlement.buildings[buildingId]) return;

        const building = settlement.buildings[buildingId];
        if (building.workers > 0) {
            building.workers--;
            updateSettlementUI();
        }
    }

    // ============================================
    // BUILDING CONSTRUCTION
    // ============================================
    function constructBuilding(buildingId) {
        // Check if player has enough resources
        // Deduct resources
        // Increment building count
        // Update max workers
        if (!settlement.buildings[buildingId]) {
            settlement.buildings[buildingId] = { count: 0, workers: 0, maxWorkers: 0 };
        }

        settlement.buildings[buildingId].count++;
        settlement.buildings[buildingId].maxWorkers += 5; // Each building can hold 5 workers

        updateSettlementUI();
    }

    // ============================================
    // RESOURCE PRODUCTION (Game Loop)
    // ============================================
    function updateResources(deltaTime) {
        if (!settlement) return;

        // Update each resource based on production rate
        Object.keys(settlement.resources).forEach(resourceId => {
            const resource = settlement.resources[resourceId];
            const production = resource.production * (deltaTime / 1000); // per second

            resource.current += production;
            resource.current = Math.max(0, Math.min(resource.current, resource.max));
        });

        updateResourcesPanel();
    }

    // ============================================
    // PUBLIC API
    // ============================================
    return {
        create,
        initializeUI,
        updateSettlementUI,
        updateResources,
        assignWorker,
        unassignWorker,
        constructBuilding,
        getSettlement: () => settlement,
        setSettlement: (s) => { settlement = s; }
    };
})();

window.Settlement = Settlement;
