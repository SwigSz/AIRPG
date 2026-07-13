// ============================================
// Map Display & Navigation
// ============================================

const LocalMap = (() => {
    // ── Mode ────────────────────────────────────────────────────────────────
    // TEST_MODE = true  → old hardcoded map, used for testing
    // TEST_MODE = false → map generates per-region from overworld seed
    const TEST_MODE = false;

    // Current region context (set when entering a region from the overworld)
    let currentRegion = null; // { x, y, biome } or null when in test mode

    // Constants
    const GRID_WIDTH = 40;
    const GRID_HEIGHT = 40;

    // Biome Configuration - Easy to add new biomes
    const BIOMES = {
        forest: {
            name: 'Forest',
            color: '#2d5016',
            walkable: true,
            description: 'Dense woodland with tall trees'
        },
        plains: {
            name: 'Plains',
            color: '#6b8e23',
            walkable: true,
            description: 'Open grassland with rolling hills'
        },
        desert: {
            name: 'Desert',
            color: '#d4a574',
            walkable: true,
            description: 'Sandy dunes under scorching sun'
        },
        tundra: {
            name: 'Tundra',
            color: '#b8c5d6',
            walkable: true,
            description: 'Frozen wasteland covered in snow'
        },
        swamp: {
            name: 'Swamp',
            color: '#4a5f4a',
            walkable: true,
            description: 'Murky wetlands with thick vegetation'
        },
        water: {
            name: 'Water',
            color: '#1e3a5f',
            walkable: false,
            description: 'Deep water, impassable'
        },
        mountain: {
            name: 'Mountain',
            color: '#4a4a4a',
            walkable: false,
            description: 'Rocky peaks, too steep to climb'
        }
    };

    // Resource Configuration - Easy to add new resource types
    const RESOURCES = {
        tree: {
            name: 'Tree',
            color: '#1a3a0f',
            icon: '🌲',
            defaultAmount: 5,
            description: 'A tree that can be harvested for wood',
            itemId: 'wood',
            itemName: 'Wood',
            gatherVerb: 'chopped',
            requiredTool: 'woodcutting',  // Requires woodcutting tool
            requiredToolTier: 1
        },
        rock: {
            name: 'Rock Quarry',
            color: '#666666',
            icon: '⛰️',
            defaultAmount: 5,
            description: 'A large stone deposit that must be mined',
            itemId: 'rock',
            itemName: 'Rock',
            gatherVerb: 'mined',
            requiredTool: 'mining',  // Requires mining tool
            requiredToolTier: 1
        },
        stone: {
            name: 'Loose Stones',
            color: '#8a8a8a',
            icon: '🪨',
            defaultAmount: 2,
            description: 'Small stones scattered on the ground',
            itemId: 'rock',
            itemName: 'Rock',
            gatherVerb: 'picked up'
            // No tool required
        },
        copper_ore: {
            name: 'Copper Ore Vein',
            color: '#b87333',
            icon: '🟫',
            defaultAmount: 3,
            description: 'A copper ore deposit',
            itemId: 'copper_ore',
            itemName: 'Copper Ore',
            gatherVerb: 'mined',
            requiredTool: 'mining',
            requiredToolTier: 1
        },
        berry_bush: {
            name: 'Berry Bush',
            color: '#8b4789',
            icon: '🫐',
            defaultAmount: 3,
            description: 'A bush bearing edible berries',
            itemId: 'berries',
            itemName: 'Berries',
            gatherVerb: 'gathered'
            // No tool required
        },
        stick_bush: {
            name: 'Bush',
            color: '#4a6741',
            icon: '🌳',
            defaultAmount: 4,
            description: 'A bush that can be harvested for sticks',
            itemId: 'stick',
            itemName: 'Stick',
            gatherVerb: 'gathered'
            // No tool required
        },
        fiber_plant: {
            name: 'Fiber Plant',
            color: '#6b8e4e',
            icon: '🌾',
            defaultAmount: 4,
            description: 'A plant with fibrous stalks',
            itemId: 'fiber',
            itemName: 'Fiber',
            gatherVerb: 'gathered'
            // No tool required
        }
    };

    // Combat Encounter Configuration
    const COMBAT_ENCOUNTERS = {
        enemy: {
            name: 'Enemy',
            color: '#8b0000',
            icon: '⚔️',
            description: 'A hostile creature ready for combat',
            respawnTime: 30000 // 30 seconds in milliseconds
        }
    };

    // Nest Configuration (Living Frontier Phase 2)
    const NEST = {
        color: '#3b0d0d',
        icon: '🏴',
        guardColor: '#5c1010',
        // Loot granted per nest level on destruction: [{itemId, quantity}]
        lootPerLevel: [
            { itemId: 'bone', quantity: 2 },
            { itemId: 'leather', quantity: 1 }
        ],
        bossHpMultPerLevel: 0.5,   // +50% boss HP per nest level
        bossXpMultPerLevel: 0.75   // +75% boss XP per nest level
    };

    const GRID_LINE_COLOR = '#000000';
    const GRID_LINE_WIDTH = 0.5;
    const PLAYER_COLOR = '#f4c430';
    const PLAYER_RADIUS_RATIO = 0.4;

    // State
    let canvas = null;
    let ctx = null;
    let grid = [];
    let playerPosition = { x: 10, y: 10 };
    let campLocation = null;
    let tileSize = 0;
    let isInitialized = false;
    let keydownHandler = null;
    let resizeTimeout = null;

    // Camera: top-left tile offset for the viewport
    let cameraX = 0;
    let cameraY = 0;

    // ── Living Frontier state (Phase 1) ────────────────────────────────────
    // Local fog of war: set of "x,y" tiles the player has revealed in the
    // CURRENT region. Persisted per-region via RegionManager.
    let revealedLocal = new Set();
    const LOCAL_REVEAL_RADIUS = 4;

    // Snapshot of generated (pre-delta) resources for the current region:
    // { "x,y": { type, amount } } — used to compute regrow-aware save deltas.
    let baseResources = {};

    // In-game day each node was last harvested: { "x,y": day }
    let harvestDays = {};

    // Click-to-path movement
    let activePath = null;   // remaining steps [{x,y}, ...]
    let pathTimer = null;
    let pathArrivalAction = null; // 'gather' | null
    const PATH_STEP_MS = 150;

    /**
     * Initialize the map module
     */
    function init() {
        // Find or create canvas element
        const mapView = document.querySelector('.map-view');
        if (!mapView) {
            console.error('Map: Could not find .map-view container');
            return;
        }

        // Check if canvas already exists
        canvas = document.getElementById('map-canvas');
        if (!canvas) {
            // Create canvas if it doesn't exist
            canvas = document.createElement('canvas');
            canvas.id = 'map-canvas';
            canvas.style.display = 'block';

            // Save elements before clearing
            const campButton = document.getElementById('set-camp-btn');
            const settlementOverlay = document.querySelector('.in-settlement-overlay');

            // Clear placeholder and add canvas
            mapView.innerHTML = '';

            // Re-add camp button if it existed
            if (campButton) {
                mapView.appendChild(campButton);
            }

            mapView.appendChild(canvas);

            // Re-add settlement overlay if it existed
            if (settlementOverlay) {
                mapView.appendChild(settlementOverlay);
            }
        }

        ctx = canvas.getContext('2d');

        // Generate the hardcoded grid
        // In test mode, generate the hardcoded grid immediately.
        // In overworld mode, grid is generated per-region when enterRegion() is called.
        if (TEST_MODE) {
            generateGrid();
            loadPlayerPosition();
            loadGridState();
        } else {
            // Generate a blank placeholder grid — region restore happens in restoreState()
            grid = [];
            for (let y = 0; y < GRID_HEIGHT; y++) {
                grid[y] = [];
                for (let x = 0; x < GRID_WIDTH; x++) {
                    grid[y][x] = { type: 'plains', biome: 'plains', walkable: true, x, y, resource: null, combatEncounter: null };
                }
            }
        }

        // Set up resize handler for responsive canvas
        setupResizeHandler();

        // Set up keyboard controls
        setupKeyboardControls();

        // Set up click-to-path movement
        setupCanvasClickHandler();

        // Set up tab visibility handler
        setupTabVisibilityHandler();

        // Set up camp button handler
        setupCampButtonHandler();

        // Load camp location from game state
        loadCampLocation();

        // Update in-settlement overlay on init
        updateInSettlementOverlay();

        // Set up leave camp button
        setupLeaveCampButton();

        // Set up "Back to World Map" button (only relevant in overworld mode)
        setupBackToOverworldButton();

        // Wire overworld action buttons
        wireOverworldButtons();

        // Initial render only in test mode — in overworld mode the local map
        // starts hidden and is rendered when the player enters a region.
        if (TEST_MODE) {
            resizeCanvas();
            render();
        }

        isInitialized = true;
    }

    /**
     * Generate a 20x20 hardcoded grid with multiple biomes
     */
    function generateGrid() {
        grid = [];

        for (let y = 0; y < GRID_HEIGHT; y++) {
            grid[y] = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                let biome = 'plains'; // Default biome

                // Water border around the edges
                if (x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1) {
                    biome = 'water';
                }
                // Mountains in corners and scattered positions
                else if (
                    (x === 5 && y === 5) ||
                    (x === 14 && y === 5) ||
                    (x === 5 && y === 14) ||
                    (x === 14 && y === 14) ||
                    (x === 10 && y === 3) ||
                    (x === 3 && y === 10) ||
                    (x === 16 && y === 10) ||
                    (x === 10 && y === 16)
                ) {
                    biome = 'mountain';
                }
                // Forest region (left side)
                else if (x >= 2 && x <= 6 && y >= 2 && y <= 8) {
                    biome = 'forest';
                }
                // Desert region (top right)
                else if (x >= 12 && x <= 17 && y >= 2 && y <= 7) {
                    biome = 'desert';
                }
                // Tundra region (bottom left)
                else if (x >= 2 && x <= 7 && y >= 12 && y <= 17) {
                    biome = 'tundra';
                }
                // Swamp region (bottom right)
                else if (x >= 13 && x <= 17 && y >= 12 && y <= 17) {
                    biome = 'swamp';
                }
                // Central area and remaining spaces are plains

                // Get biome configuration
                const biomeConfig = BIOMES[biome] || BIOMES.plains;

                grid[y][x] = {
                    type: biome,
                    biome: biome,
                    walkable: biomeConfig.walkable,
                    x: x,
                    y: y,
                    resource: null, // Will be populated with resource data if applicable
                    combatEncounter: null // Will be populated with combat encounter data if applicable
                };
            }
        }

        // Place resource nodes manually in specific locations
        placeResources();

        // Place combat encounters in each biome
        placeCombatEncounters();
    }

    /**
     * Place resource nodes at specific tile locations
     */
    function placeResources() {
        // Trees in forest biome (3 trees)
        addResource(3, 4, 'tree', 5);
        addResource(4, 6, 'tree', 5);
        addResource(6, 3, 'tree', 5);

        // Rocks in mountain areas and plains (3 rocks)
        addResource(8, 8, 'rock', 5);
        addResource(9, 11, 'rock', 5);
        addResource(15, 9, 'rock', 5);

        // Copper ore veins in mountain areas (2 veins)
        addResource(10, 9, 'copper_ore', 3);
        addResource(14, 11, 'copper_ore', 3);

        // Berry bushes in various locations (3 bushes)
        addResource(11, 5, 'berry_bush', 3);
        addResource(7, 15, 'berry_bush', 3);
        addResource(15, 13, 'berry_bush', 3);

        // Stick bushes in forest/plains (4 bushes)
        addResource(2, 7, 'stick_bush', 4);
        addResource(5, 5, 'stick_bush', 4);
        addResource(12, 8, 'stick_bush', 4);
        addResource(8, 13, 'stick_bush', 4);

        // Fiber plants in plains areas (4 plants)
        addResource(6, 9, 'fiber_plant', 4);
        addResource(10, 7, 'fiber_plant', 4);
        addResource(13, 6, 'fiber_plant', 4);
        addResource(9, 14, 'fiber_plant', 4);
    }

    /**
     * Add a resource to a specific tile
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} resourceType - Type of resource (tree, rock, bush)
     * @param {number} amount - Amount of resource available
     */
    function addResource(x, y, resourceType, amount) {
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
            console.warn(`Cannot place resource at (${x}, ${y}) - out of bounds`);
            return;
        }

        const tile = grid[y][x];
        if (!tile.walkable) {
            console.warn(`Cannot place resource at (${x}, ${y}) - tile is not walkable`);
            return;
        }

        const resourceConfig = RESOURCES[resourceType];
        if (!resourceConfig) {
            console.warn(`Unknown resource type: ${resourceType}`);
            return;
        }

        tile.resource = {
            type: resourceType,
            amount: amount || resourceConfig.defaultAmount,
            maxAmount: amount || resourceConfig.defaultAmount
        };
    }

    /**
     * Place combat encounters at specific tile locations (one per biome for testing)
     */
    function placeCombatEncounters() {
        // One combat encounter per biome for testing
        addCombatEncounter(4, 5, 'forest');    // Forest biome
        addCombatEncounter(14, 4, 'desert');   // Desert biome
        addCombatEncounter(5, 15, 'tundra');   // Tundra biome
        addCombatEncounter(15, 15, 'swamp');   // Swamp biome
        addCombatEncounter(11, 11, 'plains');  // Plains biome
    }

    /**
     * Add a combat encounter to a specific tile
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {string} biome - Biome type for enemy selection
     */
    function addCombatEncounter(x, y, biome) {
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
            console.warn(`Cannot place combat encounter at (${x}, ${y}) - out of bounds`);
            return;
        }

        const tile = grid[y][x];
        if (!tile.walkable) {
            console.warn(`Cannot place combat encounter at (${x}, ${y}) - tile is not walkable`);
            return;
        }

        const encounterConfig = COMBAT_ENCOUNTERS.enemy;
        if (!encounterConfig) {
            console.warn(`Unknown combat encounter type`);
            return;
        }

        tile.combatEncounter = {
            type: 'enemy',
            biome: biome,
            active: true,
            respawnTimer: null
        };
    }

    /**
     * Load player position from game state
     */
    function loadPlayerPosition() {
        const state = window.GameState?.getState();
        if (state && state.world && state.world.playerPosition) {
            playerPosition = { ...state.world.playerPosition };
        }
    }

    /**
     * Save player position to game state
     */
    function savePlayerPosition() {
        if (!window.GameState) return;

        const state = window.GameState.getState();
        if (!state.world) {
            window.GameState.updateProperty('world', {});
        }

        const worldState = window.GameState.getState().world || {};
        worldState.playerPosition = { ...playerPosition };
        window.GameState.updateProperty('world', worldState);

        // Auto-save
        if (window.SaveSystem) {
            window.SaveSystem.save();
        }
    }

    /**
     * Set up resize handler for responsive rendering
     */
    function setupResizeHandler() {
        // Use ResizeObserver for better performance with debouncing
        const mapView = document.querySelector('.map-view');
        if (!mapView) return;

        let lastWidth = 0;
        let lastHeight = 0;

        const resizeObserver = new ResizeObserver(() => {
            if (!isInitialized) return;

            const rect = mapView.getBoundingClientRect();
            const newWidth = rect.width;
            const newHeight = rect.height;

            // Only trigger resize if dimensions actually changed meaningfully (>1px)
            if (Math.abs(newWidth - lastWidth) > 1 || Math.abs(newHeight - lastHeight) > 1) {
                lastWidth = newWidth;
                lastHeight = newHeight;

                // Debounce resize to prevent rapid re-renders during transitions
                if (resizeTimeout) {
                    clearTimeout(resizeTimeout);
                }

                resizeTimeout = setTimeout(() => {
                    resizeCanvas();
                    render();
                }, 100); // 100ms debounce for smoother transitions
            }
        });

        resizeObserver.observe(mapView);
    }

    /**
     * Set up tab visibility handler to detect when map tab becomes active
     */
    function setupTabVisibilityHandler() {
        // Use MutationObserver to detect when map tab becomes active
        const mapTab = document.getElementById('map-tab');
        if (!mapTab) return;

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const isVisible = mapTab.style.display !== 'none';
                    if (isVisible) {
                        // Tab just became visible, resize and render immediately
                        setTimeout(() => {
                            resizeCanvas();
                            render();
                        }, 0);
                    }
                }
            });
        });

        observer.observe(mapTab, {
            attributes: true,
            attributeFilter: ['style']
        });
    }

    /**
     * Set up camp button click handler
     */
    function setupCampButtonHandler() {
        const campButton = document.getElementById('set-camp-btn');
        if (!campButton) {
            console.warn('Map: Camp button not found');
            return;
        }

        campButton.addEventListener('click', () => {
            placeCamp();
        });

        // Update button visibility based on camp state
        updateCampButtonVisibility();
    }

    /**
     * Update camp button visibility
     */
    function updateCampButtonVisibility() {
        const campButton = document.getElementById('set-camp-btn');
        if (!campButton) return;

        if (campLocation) {
            campButton.classList.add('hidden');
        } else {
            campButton.classList.remove('hidden');
        }
    }

    /**
     * Place camp at current player position
     */
    function placeCamp() {
        if (campLocation) {
            if (window.ActivityLog) {
                ActivityLog.addMessage('Camp has already been placed', 'info');
            }
            return;
        }

        // Check if there's a resource on this tile
        const tile = getTile(playerPosition.x, playerPosition.y);
        if (tile && tile.resource) {
            // Show confirmation modal for resource destruction
            showResourceDestructionModal();
            return;
        }

        // No resource, proceed with placement
        confirmCampPlacement();
    }

    /**
     * Show modal warning about resource destruction
     */
    function showResourceDestructionModal() {
        const modal = document.getElementById('enter-camp-modal');
        if (!modal) return;

        // Reuse the enter camp modal but change the text
        const modalContent = modal.querySelector('.camp-modal');
        const heading = modalContent.querySelector('h2');
        const yesBtn = document.getElementById('enter-camp-yes-btn');
        const noBtn = document.getElementById('enter-camp-no-btn');

        // Store original text
        const originalHeading = heading.textContent;

        // Update modal text
        heading.textContent = 'Placing a camp on this tile will destroy the resource here. Continue?';

        modal.style.display = 'flex';

        // Remove old listeners
        const newYesBtn = yesBtn.cloneNode(true);
        const newNoBtn = noBtn.cloneNode(true);
        yesBtn.replaceWith(newYesBtn);
        noBtn.replaceWith(newNoBtn);

        // Yes button - destroy resource and place camp
        newYesBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            heading.textContent = originalHeading; // Restore original text

            // Remove the resource
            const tile = getTile(playerPosition.x, playerPosition.y);
            if (tile && tile.resource) {
                tile.resource = null;
                saveGridState();
            }

            // Place the camp
            confirmCampPlacement();
        });

        // No button - cancel placement
        newNoBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            heading.textContent = originalHeading; // Restore original text

            if (window.ActivityLog) {
                ActivityLog.addMessage('Camp placement cancelled', 'info');
            }
        });

        // Keyboard handlers
        const keyHandler = (e) => {
            if (e.key === 'Enter') {
                modal.style.display = 'none';
                heading.textContent = originalHeading;
                document.removeEventListener('keydown', keyHandler);

                // Remove the resource
                const tile = getTile(playerPosition.x, playerPosition.y);
                if (tile && tile.resource) {
                    tile.resource = null;
                    saveGridState();
                }

                confirmCampPlacement();
            } else if (e.key === 'Escape') {
                modal.style.display = 'none';
                heading.textContent = originalHeading;
                document.removeEventListener('keydown', keyHandler);

                if (window.ActivityLog) {
                    ActivityLog.addMessage('Camp placement cancelled', 'info');
                }
            }
        };

        document.addEventListener('keydown', keyHandler);
    }

    /**
     * Confirm and execute camp placement
     */
    function confirmCampPlacement() {
        // Place camp at current player position
        campLocation = {
            x: playerPosition.x,
            y: playerPosition.y,
            isPlaced: true
        };

        // Save to game state
        if (window.GameState) {
            window.GameState.updateProperty('campLocation', campLocation);
        }

        // Auto-save
        if (window.SaveSystem) {
            window.SaveSystem.save();
        }

        // Update button visibility
        updateCampButtonVisibility();

        // Log to activity
        if (window.ActivityLog) {
            ActivityLog.addMessage(`Camp established at (${campLocation.x}, ${campLocation.y})`, 'info');
        }

        // Re-render to show camp marker
        render();
    }

    /**
     * Load camp location from game state
     */
    function loadCampLocation() {
        const state = window.GameState?.getState();
        if (state && state.campLocation) {
            campLocation = { ...state.campLocation };
            updateCampButtonVisibility();
        }
    }

    /**
     * Check if player is standing on camp
     */
    function isStandingOnCamp() {
        if (!campLocation || !campLocation.isPlaced) return false;
        return playerPosition.x === campLocation.x && playerPosition.y === campLocation.y;
    }

    /**
     * Show enter camp modal
     */
    function showEnterCampModal() {
        const modal = document.getElementById('enter-camp-modal');
        if (!modal) return;

        modal.style.display = 'flex';

        // Set up button handlers
        const yesBtn = document.getElementById('enter-camp-yes-btn');
        const noBtn = document.getElementById('enter-camp-no-btn');

        // Remove old listeners (if any)
        const newYesBtn = yesBtn.cloneNode(true);
        const newNoBtn = noBtn.cloneNode(true);
        yesBtn.replaceWith(newYesBtn);
        noBtn.replaceWith(newNoBtn);

        // Yes button - enter camp
        newYesBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            enterCamp();
        });

        // No button - close modal
        newNoBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Set up keyboard handlers
        const keyHandler = (e) => {
            if (e.key === 'Enter') {
                modal.style.display = 'none';
                document.removeEventListener('keydown', keyHandler);
                enterCamp();
            } else if (e.key === 'Escape') {
                modal.style.display = 'none';
                document.removeEventListener('keydown', keyHandler);
            }
        };

        document.addEventListener('keydown', keyHandler);
    }

    /**
     * Enter the camp (settlement)
     */
    function enterCamp() {
        const character = window.GameState?.getState()?.character;
        if (!character) return;

        // Set inSettlement flag
        character.inSettlement = true;

        // Enable accelerated time in settlement
        if (window.TimeSystem) {
            window.TimeSystem.setInSettlement(true);
        }

        // Update settlement tab visibility
        if (window.TabManager) {
            window.TabManager.updateSettlementTabVisibility();
        }

        // Resume research if paused
        if (window.Research && window.Research.onSettlementEnter) {
            window.Research.onSettlementEnter();
        }

        // Show in-settlement overlay
        updateInSettlementOverlay();

        // Set up leave camp button
        setupLeaveCampButton();

        // Auto-save
        if (window.SaveSystem) {
            window.SaveSystem.save();
        }

        // Log to activity
        if (window.ActivityLog) {
            ActivityLog.addMessage('Entered camp', 'info');
        }
    }

    /**
     * Leave the camp (settlement)
     */
    function leaveCamp() {
        const character = window.GameState?.getState()?.character;
        if (!character) return;

        // Clear inSettlement flag
        character.inSettlement = false;

        // Disable accelerated time in settlement
        if (window.TimeSystem) {
            window.TimeSystem.setInSettlement(false);
        }

        // Update settlement tab visibility
        if (window.TabManager) {
            window.TabManager.updateSettlementTabVisibility();
        }

        // Pause research when leaving settlement
        if (window.Research && window.Research.onSettlementExit) {
            window.Research.onSettlementExit();
        }

        // Switch to map tab if currently on settlement tab
        if (window.TabManager && window.TabManager.getCurrentTab() === 'settlement') {
            window.TabManager.switchTab('map');
        }

        // Hide in-settlement overlay
        updateInSettlementOverlay();

        // Auto-save
        if (window.SaveSystem) {
            window.SaveSystem.save();
        }

        // Log to activity
        if (window.ActivityLog) {
            ActivityLog.addMessage('Left camp', 'info');
        }
    }

    /**
     * Update in-settlement overlay visibility
     */
    function updateInSettlementOverlay() {
        // In overworld mode, camp UI is handled entirely by world-map.js
        if (!TEST_MODE) return;

        const overlay = document.getElementById('in-settlement-overlay');
        if (!overlay) return;

        const character = window.GameState?.getState()?.character;
        if (character && character.inSettlement) {
            overlay.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
        }
    }

    /**
     * Set up leave camp button
     */
    function setupLeaveCampButton() {
        const leaveCampBtn = document.getElementById('leave-camp-btn');
        if (!leaveCampBtn) return;

        // Remove old listener
        const newBtn = leaveCampBtn.cloneNode(true);
        leaveCampBtn.replaceWith(newBtn);

        // Add click handler
        newBtn.addEventListener('click', () => {
            leaveCamp();
        });
    }

    /**
     * Set up keyboard controls for player movement
     */
    function setupKeyboardControls() {
        // Remove existing handler if any
        if (keydownHandler) {
            document.removeEventListener('keydown', keydownHandler);
        }

        // Create new handler
        keydownHandler = (event) => {
            // Only handle movement when map tab is active
            const mapTab = document.getElementById('map-tab');
            if (!mapTab || !mapTab.classList.contains('active')) {
                return;
            }

            // Check if we're in combat (don't allow map movement during combat)
            const combatOverlay = document.querySelector('.combat-overlay');
            if (combatOverlay && combatOverlay.classList.contains('active')) {
                return;
            }

            // Check if we're in settlement (don't allow map movement when in camp)
            const character = window.GameState?.getState()?.character;
            if (character && character.inSettlement) {
                return;
            }

            // Block movement while time is paused
            if (window.TimeSystem?.isPaused) {
                return;
            }

            let moved = false;
            const currentPos = getPlayerPosition();
            let newX = currentPos.x;
            let newY = currentPos.y;

            // Handle WASD and Arrow keys
            switch(event.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
                    newY = currentPos.y - 1;
                    moved = true;
                    break;
                case 's':
                case 'arrowdown':
                    newY = currentPos.y + 1;
                    moved = true;
                    break;
                case 'a':
                case 'arrowleft':
                    newX = currentPos.x - 1;
                    moved = true;
                    break;
                case 'd':
                case 'arrowright':
                    newX = currentPos.x + 1;
                    moved = true;
                    break;
                case ' ':
                case 'spacebar':
                    event.preventDefault();
                    // Check if standing on camp
                    if (isStandingOnCamp()) {
                        showEnterCampModal();
                    } else {
                        // Handle resource gathering
                        gatherResourceAtPlayerPosition();
                    }
                    return;
            }

            // If a movement key was pressed, attempt to move
            if (moved) {
                event.preventDefault(); // Prevent page scrolling
                stopWalking(false); // manual input cancels click-to-path walking
                const success = movePlayer(newX, newY);

                if (success) {
                    // Log movement to activity log
                    if (window.ActivityLog) {
                        const tile = getTile(newX, newY);
                        const biomeConfig = BIOMES[tile.biome] || BIOMES.plains;
                        ActivityLog.addMessage(`Moved to ${biomeConfig.name} at (${newX}, ${newY})`, 'info');
                    }
                } else {
                    // Visual feedback for blocked movement
                    showBlockedMovementFeedback(newX, newY);
                }
            }
        };

        // Add event listener
        document.addEventListener('keydown', keydownHandler);
    }

    // ════════════════════════════════════════════════════════════════════════
    // RAIDER NESTS (Living Frontier Phase 2)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Place the nest heart + its guards on the freshly generated grid.
     * Position is deterministic per region (Noise is region-seeded here).
     */
    function placeNest(level) {
        // Find a deterministic interior tile for the nest heart
        let nestTile = null;
        for (let i = 0; i < 60 && !nestTile; i++) {
            const rx = 4 + Math.floor(Noise.hash2D(i, 7001) * (GRID_WIDTH - 8));
            const ry = 4 + Math.floor(Noise.hash2D(7002, i) * (GRID_HEIGHT - 8));
            const tile = grid[ry]?.[rx];
            if (tile && tile.walkable && !tile.combatEncounter) {
                nestTile = tile;
            }
        }
        if (!nestTile) return;

        nestTile.resource = null; // the nest displaces whatever grew here
        nestTile.nest = { level };

        // Guards ring the heart: level + 1 encounters within ~3 tiles
        const guardCount = level + 1;
        let placed = 0;
        for (let i = 0; i < 80 && placed < guardCount; i++) {
            const dx = Math.floor(Noise.hash2D(i, 7100) * 7) - 3;
            const dy = Math.floor(Noise.hash2D(7101, i) * 7) - 3;
            if (dx === 0 && dy === 0) continue;
            const gx = nestTile.x + dx;
            const gy = nestTile.y + dy;
            const tile = grid[gy]?.[gx];
            if (!tile || !tile.walkable || tile.nest || tile.combatEncounter) continue;

            tile.resource = null;
            tile.combatEncounter = {
                type: 'enemy',
                biome: currentRegion ? currentRegion.biome : 'plains',
                active: true,
                respawnTimer: null,
                nestGuard: true // guards do not respawn once defeated
            };
            placed++;
        }
    }

    /**
     * Draw nest hearts (fog-aware).
     */
    function drawNests() {
        const { cols, rows } = getViewportTiles();
        for (let vy = 0; vy < rows; vy++) {
            for (let vx = 0; vx < cols; vx++) {
                const gx = cameraX + vx;
                const gy = cameraY + vy;
                if (gx < 0 || gx >= GRID_WIDTH || gy < 0 || gy >= GRID_HEIGHT) continue;
                if (!isLocalTileRevealed(gx, gy)) continue;
                const tile = grid[gy][gx];
                if (tile.nest) {
                    const px = vx * tileSize;
                    const py = vy * tileSize;
                    MapRenderer.drawTint(ctx, px, py, tileSize, NEST.color, 0.75);
                    MapRenderer.drawIcon(ctx, px, py, tileSize, NEST, 0.65);
                }
            }
        }
    }

    /**
     * Draw ancestors' graves (fog-aware).
     */
    function drawGraves() {
        const { cols, rows } = getViewportTiles();
        for (let vy = 0; vy < rows; vy++) {
            for (let vx = 0; vx < cols; vx++) {
                const gx = cameraX + vx;
                const gy = cameraY + vy;
                if (gx < 0 || gx >= GRID_WIDTH || gy < 0 || gy >= GRID_HEIGHT) continue;
                if (!isLocalTileRevealed(gx, gy)) continue;
                const tile = grid[gy][gx];
                if (tile.grave) {
                    MapRenderer.drawIcon(ctx, vx * tileSize, vy * tileSize, tileSize, { icon: '🪦' }, 0.55);
                }
            }
        }
    }

    /**
     * Start the nest-heart boss fight. Triggered by stepping onto the nest.
     */
    function initiateNestAssault(x, y) {
        const tile = getTile(x, y);
        if (!tile || !tile.nest || !currentRegion) return;

        const level = tile.nest.level;
        const biome = currentRegion.biome;

        const availableEnemies = window.EnemyDatabase ? EnemyDatabase.getEnemiesByBiome(biome) : [];
        if (!availableEnemies || availableEnemies.length === 0) {
            console.error(`No enemies available for nest boss in biome: ${biome}`);
            return;
        }

        const enemyId = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
        const boss = window.EnemyFactory ? EnemyFactory.createEnemy(enemyId) : null;
        if (!boss) return;

        // Scale the boss by nest level
        const hpMult = 1 + level * NEST.bossHpMultPerLevel;
        boss.name = `Nest Chieftain (${boss.name})`;
        boss.hp = Math.round(boss.hp * hpMult);
        boss.maxHp = Math.round(boss.maxHp * hpMult);
        boss.xpReward = Math.round((boss.xpReward || 10) * (1 + level * NEST.bossXpMultPerLevel));

        const character = window.GameState?.getState()?.character;
        if (!character) return;

        if (character.hp === undefined) character.hp = 100;
        if (character.maxHp === undefined) character.maxHp = 100;

        const player = {
            ...character,
            isPlayer: true,
            isAlive: character.hp > 0,
            hp: character.hp,
            maxHp: character.maxHp,
            attack: (window.DamageCalculator
                ? DamageCalculator.calculateCurrentWeaponDamage(character)
                : null) || 5,
            defense: character.defense || 0,
            speed: 15,
            initiative: 0
        };

        // Persist the assault so victory resolves even across a mid-fight reload
        const worldState = window.GameState.getState().world || {};
        worldState.pendingNestAssault = {
            region: { x: currentRegion.x, y: currentRegion.y },
            tile: { x, y },
            level
        };
        window.GameState.updateProperty('world', worldState);

        if (window.ActivityLog) {
            ActivityLog.addMessage(`You storm the raider nest! The chieftain emerges...`, 'combat');
        }

        const enemy = { ...boss, speed: 10 };
        if (window.CombatManager) {
            CombatManager.startCombat([player], [enemy]);
        }
    }

    /**
     * Resolve a won nest assault: destroy the nest, mark the region Cleared,
     * and grant scaled loot.
     */
    function resolveNestAssaultVictory(pending) {
        // Destroy the nest tile if we're still in that region
        if (currentRegion && currentRegion.x === pending.region.x && currentRegion.y === pending.region.y) {
            const tile = getTile(pending.tile.x, pending.tile.y);
            if (tile && tile.nest) tile.nest = null;
        }

        // Region becomes Cleared (protected, then decays back to explored)
        let regionName = 'the region';
        if (window.RegionManager) {
            RegionManager.clearNest(pending.region.x, pending.region.y);
            const rec = RegionManager.peekRegion(pending.region.x, pending.region.y);
            if (rec) regionName = rec.name;
        }

        // Loot scales with nest level
        if (window.LootManager) {
            const drops = NEST.lootPerLevel.map(entry => ({
                itemId: entry.itemId,
                quantity: entry.quantity * pending.level
            }));
            LootManager.processDrops(drops);
        }

        if (window.ActivityLog) {
            ActivityLog.addMessage(`The raider nest in ${regionName} is destroyed! The region is cleared.`, 'success');
        }
        if (window.NotificationManager) {
            NotificationManager.showNotification({
                type: 'success',
                icon: '🏴',
                title: 'Nest Destroyed!',
                message: `${regionName} is now cleared`,
                description: 'The region is safe... for a while.'
            });
        }

        render();
        if (window.SaveSystem) SaveSystem.save();
    }

    // ════════════════════════════════════════════════════════════════════════
    // LOCAL FOG OF WAR (Living Frontier Phase 1)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * Fog is active only in region mode (not the TEST_MODE debug map).
     */
    function fogActive() {
        return !TEST_MODE && !!currentRegion;
    }

    function isLocalTileRevealed(x, y) {
        if (!fogActive()) return true;
        return revealedLocal.has(`${x},${y}`);
    }

    /**
     * Reveal tiles in a circle around the player and persist to the region.
     */
    function revealAroundLocalPlayer() {
        if (!fogActive()) return;
        const r = LOCAL_REVEAL_RADIUS;
        const r2 = r * r + 2; // slightly rounded circle
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r2) continue;
                const tx = playerPosition.x + dx;
                const ty = playerPosition.y + dy;
                if (tx >= 0 && tx < GRID_WIDTH && ty >= 0 && ty < GRID_HEIGHT) {
                    revealedLocal.add(`${tx},${ty}`);
                }
            }
        }
        if (window.RegionManager && currentRegion) {
            RegionManager.setRevealedTiles(currentRegion.x, currentRegion.y, revealedLocal);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // CLICK-TO-PATH MOVEMENT (Living Frontier Phase 1)
    // ════════════════════════════════════════════════════════════════════════

    /**
     * A* pathfinding over walkable, revealed tiles (4-directional).
     * Returns an array of steps [{x,y}, ...] excluding the start tile,
     * or null if no path exists.
     */
    function findPath(from, to) {
        const key = (x, y) => `${x},${y}`;
        const isPassable = (x, y) => {
            if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
            if (!grid[y][x].walkable) return false;
            if (fogActive() && !revealedLocal.has(key(x, y))) return false;
            return true;
        };

        if (!isPassable(to.x, to.y)) return null;

        const open = [{ x: from.x, y: from.y, g: 0, f: 0 }];
        const cameFrom = {};
        const gScore = { [key(from.x, from.y)]: 0 };
        const closed = new Set();
        const h = (x, y) => Math.abs(x - to.x) + Math.abs(y - to.y);

        while (open.length > 0) {
            // Pop lowest-f node (linear scan is fine for a 40x40 grid)
            let bestIdx = 0;
            for (let i = 1; i < open.length; i++) {
                if (open[i].f < open[bestIdx].f) bestIdx = i;
            }
            const current = open.splice(bestIdx, 1)[0];
            const cKey = key(current.x, current.y);

            if (current.x === to.x && current.y === to.y) {
                // Reconstruct path (excluding start)
                const path = [];
                let k = cKey;
                while (cameFrom[k] !== undefined) {
                    const [px, py] = k.split(',').map(Number);
                    path.unshift({ x: px, y: py });
                    k = cameFrom[k];
                }
                return path;
            }

            if (closed.has(cKey)) continue;
            closed.add(cKey);

            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 }
            ];

            for (const n of neighbors) {
                if (!isPassable(n.x, n.y)) continue;
                const nKey = key(n.x, n.y);
                if (closed.has(nKey)) continue;
                const g = gScore[cKey] + 1;
                if (gScore[nKey] === undefined || g < gScore[nKey]) {
                    gScore[nKey] = g;
                    cameFrom[nKey] = cKey;
                    open.push({ x: n.x, y: n.y, g, f: g + h(n.x, n.y) });
                }
            }
        }
        return null;
    }

    /**
     * Begin auto-walking a path. Each step goes through movePlayer(), so time
     * cost, encounters, saving, and edge-exit all behave exactly like manual
     * movement. Walking stops on: combat, pause, blocked step, or arrival.
     */
    function startWalking(path, arrivalAction = null) {
        stopWalking(false);
        activePath = path;
        pathArrivalAction = arrivalAction;

        pathTimer = setInterval(() => {
            if (!activePath || activePath.length === 0) {
                stopWalking();
                return;
            }
            if (window.TimeSystem?.isPaused) {
                stopWalking();
                return;
            }
            if (window.CombatManager?.getCombatState()?.isActive) {
                stopWalking();
                return;
            }

            const next = activePath.shift();
            const ok = movePlayer(next.x, next.y);
            if (!ok) {
                stopWalking();
                return;
            }

            // Stop immediately if that step triggered combat
            if (window.CombatManager?.getCombatState()?.isActive) {
                stopWalking();
                return;
            }

            if (activePath && activePath.length === 0) {
                const action = pathArrivalAction;
                stopWalking();
                if (action === 'gather') {
                    gatherResourceAtPlayerPosition();
                }
            }
        }, PATH_STEP_MS);
    }

    function stopWalking(rerender = true) {
        if (pathTimer) {
            clearInterval(pathTimer);
            pathTimer = null;
        }
        activePath = null;
        pathArrivalAction = null;
        if (rerender && ctx && canvas) render();
    }

    /**
     * Handle a click on a local-map tile (grid coordinates).
     */
    function handleTileClick(gx, gy) {
        const tile = getTile(gx, gy);
        if (!tile) return;

        // Unexplored tiles can't be targeted
        if (fogActive() && !isLocalTileRevealed(gx, gy)) {
            if (window.ActivityLog) {
                ActivityLog.addMessage("You haven't explored that area yet.", 'info');
            }
            return;
        }

        // Clicking your own tile: interact (enter camp / gather)
        if (gx === playerPosition.x && gy === playerPosition.y) {
            stopWalking(false);
            if (isStandingOnCamp()) {
                showEnterCampModal();
            } else if (tile.resource) {
                gatherResourceAtPlayerPosition();
            }
            return;
        }

        if (!tile.walkable) {
            showBlockedMovementFeedback(gx, gy);
            return;
        }

        const path = findPath(playerPosition, { x: gx, y: gy });
        if (!path || path.length === 0) {
            if (window.ActivityLog) {
                ActivityLog.addMessage('No path to that location.', 'info');
            }
            return;
        }

        // Walking onto a resource node auto-gathers on arrival
        startWalking(path, tile.resource ? 'gather' : null);
        render(); // show the path preview immediately
    }

    /**
     * Set up canvas click handling for click-to-path movement.
     */
    function setupCanvasClickHandler() {
        if (!canvas) return;

        canvas.addEventListener('click', (e) => {
            // Only when the local map is actually in play
            if (!TEST_MODE && !currentRegion) return;
            if (window.TimeSystem?.isPaused) return;

            const character = window.GameState?.getState()?.character;
            if (character && character.inSettlement) return;

            const combatOverlay = document.querySelector('.combat-overlay');
            if (combatOverlay && combatOverlay.classList.contains('active')) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            const cy = (e.clientY - rect.top) * scaleY;

            const gx = cameraX + Math.floor(cx / tileSize);
            const gy = cameraY + Math.floor(cy / tileSize);
            handleTileClick(gx, gy);
        });
    }

    /**
     * Check if player has the required tool equipped
     * @param {Object} character - The character object
     * @param {string} toolType - Type of tool required ('woodcutting' or 'mining')
     * @param {number} requiredTier - Minimum tier of tool required
     * @returns {boolean} - True if player has required tool equipped
     */
    function checkHasRequiredTool(character, toolType, requiredTier) {
        if (!character.equipment) return false;

        // Check the appropriate equipment slot
        let equippedTool = null;
        if (toolType === 'woodcutting') {
            equippedTool = character.equipment.woodcutting_axe;
        } else if (toolType === 'mining') {
            equippedTool = character.equipment.pickaxe;
        }

        if (!equippedTool) return false;

        // Check tool tier (if tool has stats with the appropriate skill level)
        // For now, makeshift tools are tier 1
        // Future: stone tools tier 2, iron tools tier 3, etc.
        const toolTier = equippedTool.stats?.[toolType] || 1;

        return toolTier >= requiredTier;
    }

    /**
     * Gather resource at the player's current position
     */
    function gatherResourceAtPlayerPosition() {
        const tile = getTile(playerPosition.x, playerPosition.y);

        // Check if there's a resource on this tile
        if (!tile || !tile.resource) {
            if (window.ActivityLog) {
                ActivityLog.addMessage('No resource to gather here', 'info');
            }
            return;
        }

        const resourceConfig = RESOURCES[tile.resource.type];
        if (!resourceConfig) return;

        // Check if resource requires a tool
        if (resourceConfig.requiredTool) {
            const character = window.GameState?.getState()?.character;
            if (!character) return;

            const hasRequiredTool = checkHasRequiredTool(character, resourceConfig.requiredTool, resourceConfig.requiredToolTier);

            if (!hasRequiredTool) {
                const toolName = resourceConfig.requiredTool === 'woodcutting' ? 'Woodcutting Axe' :
                                 resourceConfig.requiredTool === 'mining' ? 'Pickaxe' : 'Tool';
                if (window.ActivityLog) {
                    ActivityLog.addMessage(`You need a ${toolName} equipped to harvest ${resourceConfig.name}`, 'warning');
                }
                return;
            }
        }

        const currentAmount = tile.resource.amount;

        // Harvest 1 resource
        const result = harvestResource(playerPosition.x, playerPosition.y, 1);

        if (!result) return;

        // Create item and add to inventory
        const character = window.GameState?.getState()?.character;
        if (!character || !window.Items || !window.Inventory) {
            console.error('Cannot add resource to inventory - missing dependencies');
            return;
        }

        // Create the resource item using ItemFactory (unified item system)
        if (!window.ItemFactory) {
            console.error('ItemFactory not available - cannot create resource item');
            return;
        }

        if (!resourceConfig.itemId) {
            console.error(`Resource ${resourceConfig.name} is missing itemId - cannot create item`);
            return;
        }

        const item = window.ItemFactory.createItem(resourceConfig.itemId);

        if (!item) {
            console.error(`Failed to create item with ID: ${resourceConfig.itemId}`);
            return;
        }

        // Try to add to inventory
        const success = window.Inventory.addItem(character.inventory, item);

        if (success) {
            // Display success message
            const remainingText = currentAmount > 1 ? ` (${currentAmount - 1} remaining)` : ' (depleted)';
            const message = `${resourceConfig.gatherVerb.charAt(0).toUpperCase() + resourceConfig.gatherVerb.slice(1)} ${resourceConfig.itemName} from ${resourceConfig.name}${remainingText}`;

            if (window.ActivityLog) {
                ActivityLog.addMessage(message, 'loot');
            }

            // Show notification (with stacking by resource type)
            if (window.NotificationManager) {
                NotificationManager.showNotification({
                    type: 'success',
                    icon: '✓',
                    title: 'Resource Gathered',
                    message: `+1 ${resourceConfig.itemName}`,
                    stackKey: `resource_${resourceConfig.itemId}` // Stack notifications by resource type
                });
            }

            // Award skill XP based on resource type
            if (window.SkillManager) {
                let skillId = null;
                let xpAmount = 0;

                // Determine which skill and how much XP
                if (tile.resource.type === 'tree') {
                    skillId = 'woodcutting';
                    xpAmount = 10;
                } else if (tile.resource.type === 'rock') {
                    skillId = 'mining';
                    xpAmount = 10;
                } else if (tile.resource.type === 'copper_ore') {
                    skillId = 'mining';
                    xpAmount = 20;
                }

                // Award XP if applicable
                if (skillId && xpAmount > 0) {
                    SkillManager.addSkillXP(character, skillId, xpAmount);
                }
            }

            // Update inventory UI
            if (window.renderInventoryUI) {
                window.renderInventoryUI();
            }

            // Visual feedback - brief green flash on the tile
            showGatherFeedback(playerPosition.x, playerPosition.y);

            // Auto-save
            if (window.SaveSystem) {
                window.SaveSystem.save();
            }
        } else {
            if (window.ActivityLog) {
                ActivityLog.addMessage('Inventory is full!', 'info');
            }
        }
    }

    /**
     * Show visual feedback when gathering a resource
     */
    function showGatherFeedback(x, y) {
        if (!ctx || !canvas) return;

        // First do a full re-render
        render();

        // Draw green overlay on gathered tile (viewport coords = grid - camera)
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#00ff00';
        ctx.fillRect((x - cameraX) * tileSize, (y - cameraY) * tileSize, tileSize, tileSize);

        // Restore after a brief moment
        setTimeout(() => {
            ctx.restore();
            render();
        }, 200);
    }

    /**
     * Show visual feedback when movement is blocked
     */
    function showBlockedMovementFeedback(blockedX, blockedY) {
        // Check if the blocked position is valid and get tile info
        const tile = getTile(blockedX, blockedY);
        if (!tile) {
            if (window.ActivityLog) {
                ActivityLog.addMessage('Cannot move outside the map boundaries', 'info');
            }
            return;
        }

        if (!tile.walkable) {
            if (window.ActivityLog) {
                const biomeConfig = BIOMES[tile.biome] || BIOMES.plains;
                ActivityLog.addMessage(`Cannot move through ${biomeConfig.name}`, 'info');
            }
        }

        // Add a brief red flash effect on the blocked tile
        if (ctx && canvas) {
            // First do a full re-render to ensure clean state
            render();

            // Then draw red overlay on blocked tile (viewport coords = grid - camera)
            ctx.save(); // Save the entire canvas state
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect((blockedX - cameraX) * tileSize, (blockedY - cameraY) * tileSize, tileSize, tileSize);

            // Restore after a brief moment
            setTimeout(() => {
                ctx.restore(); // Restore the canvas state
                render(); // Re-render everything
            }, 150);
        }
    }

    /**
     * Resize canvas to match container size
     */
    function getViewportTiles() {
        if (!canvas || tileSize === 0) return { cols: 0, rows: 0 };
        return {
            cols: Math.floor(canvas.width  / tileSize),
            rows: Math.floor(canvas.height / tileSize)
        };
    }

    function updateCamera() {
        const { cols, rows } = getViewportTiles();
        // Center camera on player, clamped to grid bounds
        cameraX = Math.max(0, Math.min(GRID_WIDTH  - cols, playerPosition.x - Math.floor(cols / 2)));
        cameraY = Math.max(0, Math.min(GRID_HEIGHT - rows, playerPosition.y - Math.floor(rows / 2)));
    }

    function resizeCanvas() {
        if (!canvas) return;

        const mapTab = document.getElementById('map-tab');
        if (!mapTab) return;

        const rect = mapTab.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const pad = 12;
        const availW = rect.width  - pad * 2;
        const availH = rect.height - pad * 2;

        // Tile size driven by height: fit exactly 17 rows
        const VISIBLE_ROWS = 17;
        tileSize = Math.max(1, Math.floor(availH / VISIBLE_ROWS));

        // Canvas fills available area exactly — uniform padding on all sides
        canvas.width  = availW;
        canvas.height = availH;

        updateCamera();
    }

    /**
     * Render the entire map
     */
    function render() {
        if (!ctx || !canvas) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw tiles
        drawTiles();

        // Draw grid lines
        drawGridLines();

        // Draw resource nodes
        drawResources();

        // Draw combat encounters
        drawCombatEncounters();

        // Draw raider nests
        drawNests();

        // Draw ancestors' graves
        drawGraves();

        // Draw camp (before player so player can stand on camp)
        drawCamp();

        // Draw the active click-to-path route
        drawPath();

        // Draw player
        drawPlayer();
    }

    /**
     * Draw all tiles (fog-aware, via MapRenderer)
     */
    function drawTiles() {
        const { cols, rows } = getViewportTiles();
        for (let vy = 0; vy < rows; vy++) {
            for (let vx = 0; vx < cols; vx++) {
                const gx = cameraX + vx;
                const gy = cameraY + vy;
                if (gx < 0 || gx >= GRID_WIDTH || gy < 0 || gy >= GRID_HEIGHT) continue;

                const px = vx * tileSize;
                const py = vy * tileSize;

                if (!isLocalTileRevealed(gx, gy)) {
                    MapRenderer.drawFog(ctx, px, py, tileSize);
                    continue;
                }

                const tile = grid[gy][gx];
                const biomeConfig = BIOMES[tile.biome] || BIOMES.plains;
                MapRenderer.drawTerrain(ctx, px, py, tileSize, biomeConfig);
            }
        }
    }

    /**
     * Draw the remaining click-to-path route as dots.
     */
    function drawPath() {
        if (!activePath || activePath.length === 0) return;

        ctx.save();
        ctx.fillStyle = 'rgba(244, 196, 48, 0.5)';
        for (const step of activePath) {
            const vx = step.x - cameraX;
            const vy = step.y - cameraY;
            const { cols, rows } = getViewportTiles();
            if (vx < 0 || vx >= cols || vy < 0 || vy >= rows) continue;
            ctx.beginPath();
            ctx.arc(vx * tileSize + tileSize / 2, vy * tileSize + tileSize / 2, Math.max(tileSize * 0.12, 3), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    /**
     * Draw grid lines
     */
    function drawGridLines() {
        const { cols, rows } = getViewportTiles();
        ctx.strokeStyle = GRID_LINE_COLOR;
        ctx.lineWidth = GRID_LINE_WIDTH;

        for (let x = 0; x <= cols; x++) {
            ctx.beginPath();
            ctx.moveTo(x * tileSize, 0);
            ctx.lineTo(x * tileSize, rows * tileSize);
            ctx.stroke();
        }

        for (let y = 0; y <= rows; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * tileSize);
            ctx.lineTo(cols * tileSize, y * tileSize);
            ctx.stroke();
        }
    }

    /**
     * Draw resource nodes on tiles that have them
     */
    function drawResources() {
        const { cols, rows } = getViewportTiles();
        for (let vy = 0; vy < rows; vy++) {
            for (let vx = 0; vx < cols; vx++) {
                const gx = cameraX + vx;
                const gy = cameraY + vy;
                if (gx < 0 || gx >= GRID_WIDTH || gy < 0 || gy >= GRID_HEIGHT) continue;
                if (!isLocalTileRevealed(gx, gy)) continue;
                const tile = grid[gy][gx];
                if (tile.resource) {
                    const resourceConfig = RESOURCES[tile.resource.type];
                    if (!resourceConfig) continue;

                    const px = vx * tileSize;
                    const py = vy * tileSize;
                    MapRenderer.drawTint(ctx, px, py, tileSize, resourceConfig.color, 0.3);
                    MapRenderer.drawIcon(ctx, px, py, tileSize, resourceConfig, 0.5);
                }
            }
        }
    }

    /**
     * Draw combat encounter nodes on tiles that have them
     */
    function drawCombatEncounters() {
        const { cols, rows } = getViewportTiles();
        for (let vy = 0; vy < rows; vy++) {
            for (let vx = 0; vx < cols; vx++) {
                const gx = cameraX + vx;
                const gy = cameraY + vy;
                if (gx < 0 || gx >= GRID_WIDTH || gy < 0 || gy >= GRID_HEIGHT) continue;
                if (!isLocalTileRevealed(gx, gy)) continue;
                const tile = grid[gy][gx];
                if (tile.combatEncounter && tile.combatEncounter.active) {
                    const encounterConfig = COMBAT_ENCOUNTERS.enemy;
                    if (!encounterConfig) continue;

                    const px = vx * tileSize;
                    const py = vy * tileSize;
                    MapRenderer.drawTint(ctx, px, py, tileSize, encounterConfig.color, 0.4);
                    MapRenderer.drawIcon(ctx, px, py, tileSize, encounterConfig, 0.6);
                }
            }
        }
    }

    /**
     * Draw camp marker if camp has been placed
     */
    function drawCamp() {
        // Camp icon only shown on the local map in TEST_MODE.
        // In overworld mode the camp is drawn on the overworld by WorldMap.drawSettlement().
        if (!TEST_MODE) return;
        if (!campLocation || !campLocation.isPlaced) return;

        const vx = campLocation.x - cameraX;
        const vy = campLocation.y - cameraY;
        const { cols, rows } = getViewportTiles();
        if (vx < 0 || vx >= cols || vy < 0 || vy >= rows) return;

        const iconSize = Math.max(tileSize * 0.8, 16);
        ctx.font = `${iconSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText('⛺', vx * tileSize + tileSize / 2, vy * tileSize + tileSize / 2);

        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * Draw player as a yellow circle
     */
    function drawPlayer() {
        const vx = playerPosition.x - cameraX;
        const vy = playerPosition.y - cameraY;
        const centerX = vx * tileSize + tileSize / 2;
        const centerY = vy * tileSize + tileSize / 2;
        const radius = tileSize * PLAYER_RADIUS_RATIO;

        ctx.fillStyle = PLAYER_COLOR;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Move player to a new position
     * @param {number} newX - New X coordinate
     * @param {number} newY - New Y coordinate
     * @returns {boolean} - True if move was successful
     */
    function movePlayer(newX, newY) {
        if (window.TimeSystem?.isPaused) return false;
        // Validate boundaries — in overworld mode, walking off the edge exits the region
        if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) {
            if (!TEST_MODE && currentRegion) {
                exitToOverworld();
            }
            return false;
        }

        // Check if tile is walkable
        const targetTile = grid[newY][newX];
        if (!targetTile.walkable) {
            return false;
        }

        // Update player position
        playerPosition = { x: newX, y: newY };
        updateCamera();

        // Reveal fog around the new position (persists to the region record)
        revealAroundLocalPlayer();

        // Save to game state
        savePlayerPosition();

        // Advance time by 6 hours (0.25 days) for moving a tile
        if (window.TimeSystem) {
            TimeSystem.advanceDays(0.25);
        }

        // Standing at an ancestor's grave: Remembrance (once per generation)
        if (targetTile.grave && window.Succession) {
            Succession.honorGrave(targetTile.grave);
        }

        // Stepping onto a nest heart begins the assault boss fight
        if (targetTile.nest) {
            initiateNestAssault(newX, newY);
            render();
            return true;
        }

        // Check for combat encounter (respects debug encounter toggle)
        const encountersEnabled = window.WorldMap ? WorldMap.isEncountersEnabled() : true;
        if (encountersEnabled && targetTile.combatEncounter && targetTile.combatEncounter.active) {
            initiateCombatEncounter(newX, newY);
        }

        // Re-render
        render();

        return true;
    }

    /**
     * Initiate a combat encounter from a map tile
     * @param {number} x - X coordinate of encounter
     * @param {number} y - Y coordinate of encounter
     */
    function initiateCombatEncounter(x, y) {
        const tile = getTile(x, y);
        if (!tile || !tile.combatEncounter || !tile.combatEncounter.active) {
            return;
        }

        // Get enemies for this biome
        const biome = tile.combatEncounter.biome;
        const availableEnemies = window.EnemyDatabase ? window.EnemyDatabase.getEnemiesByBiome(biome) : [];

        if (!availableEnemies || availableEnemies.length === 0) {
            console.error(`No enemies available for biome: ${biome}`);
            if (window.ActivityLog) {
                ActivityLog.addMessage(`No enemies found in this area!`, 'info');
            }
            return;
        }

        // Randomly select an enemy from this biome
        const randomEnemyId = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];

        // Create the enemy
        const enemyInstance = window.EnemyFactory ? window.EnemyFactory.createEnemy(randomEnemyId) : null;
        if (!enemyInstance) {
            console.error(`Failed to create enemy: ${randomEnemyId}`);
            return;
        }

        // Get the player character
        const character = window.GameState?.getState()?.character;
        if (!character) {
            console.error('No character found');
            return;
        }

        // Initialize HP/Mana if they don't exist (for old saves)
        if (character.hp === undefined) character.hp = 100;
        if (character.maxHp === undefined) character.maxHp = 100;
        if (character.mana === undefined) character.mana = 10;
        if (character.maxMana === undefined) character.maxMana = 10;

        // Calculate player's attack damage based on equipped weapon
        const baseAttack = 5; // Unarmed base damage
        const weaponDamage = window.CombatManager ? getEquippedWeaponDamage(character) : null;
        const playerAttack = weaponDamage || baseAttack;

        // Convert character to combatant format with PERSISTENT HP
        const player = {
            ...character,
            isPlayer: true,
            isAlive: character.hp > 0,
            hp: character.hp,
            maxHp: character.maxHp,
            attack: playerAttack,
            baseAttack: baseAttack,
            defense: character.defense || 0,
            speed: 15,
            initiative: 0
        };

        // Helper function to get equipped weapon damage (copied from combat-manager)
        function getEquippedWeaponDamage(char) {
            const weapon = char.equipment?.mainHand;
            if (!weapon || !weapon.damage) {
                return null;
            }

            // Parse damage string like "5~10" or just "5"
            if (typeof weapon.damage === 'string') {
                if (weapon.damage.includes('~')) {
                    const [min, max] = weapon.damage.split('~').map(Number);
                    return Math.floor(Math.random() * (max - min + 1)) + min;
                }
                return parseInt(weapon.damage);
            }
            return weapon.damage;
        }

        // Convert enemy instance to combatant format
        const enemy = {
            ...enemyInstance,
            speed: 10,
            // Keep the attack object intact (don't overwrite with static value)
            // attack property already copied from enemyInstance spread
            xpReward: enemyInstance.xpReward || 0
        };

        // Store the encounter location for potential respawn
        if (!window.GameState.getState().world) {
            window.GameState.updateProperty('world', {});
        }
        const worldState = window.GameState.getState().world;
        worldState.lastEncounterLocation = { x, y };
        window.GameState.updateProperty('world', worldState);

        // Start combat using CombatManager
        if (window.CombatManager) {
            window.CombatManager.startCombat([player], [enemy]);
        }
    }

    /**
     * Get current player position
     * @returns {{x: number, y: number}}
     */
    function getPlayerPosition() {
        return { ...playerPosition };
    }

    /**
     * Get tile at specific coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Object|null} - Tile object or null if out of bounds
     */
    function getTile(x, y) {
        if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
            return null;
        }
        return grid[y][x];
    }

    /**
     * Get the entire grid
     * @returns {Array} - 2D array of tiles
     */
    function getGrid() {
        return grid;
    }

    /**
     * Get biome configuration by biome type
     * @param {string} biomeType - The biome type
     * @returns {Object|null} - Biome configuration object
     */
    function getBiomeConfig(biomeType) {
        return BIOMES[biomeType] || null;
    }

    /**
     * Get all available biomes
     * @returns {Object} - All biome configurations
     */
    function getAllBiomes() {
        return { ...BIOMES };
    }

    /**
     * Get resource configuration by resource type
     * @param {string} resourceType - The resource type
     * @returns {Object|null} - Resource configuration object
     */
    function getResourceConfig(resourceType) {
        return RESOURCES[resourceType] || null;
    }

    /**
     * Get all available resources
     * @returns {Object} - All resource configurations
     */
    function getAllResources() {
        return { ...RESOURCES };
    }

    /**
     * Harvest resource from a tile
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} amount - Amount to harvest (optional, defaults to 1)
     * @returns {Object|null} - Object with {type, amount} if successful, null if failed
     */
    function harvestResource(x, y, amount = 1) {
        const tile = getTile(x, y);
        if (!tile || !tile.resource) {
            return null;
        }

        const harvested = Math.min(amount, tile.resource.amount);
        tile.resource.amount -= harvested;

        // Record the harvest day — starts/refreshes the node's regrow clock
        if (window.RegionManager) {
            harvestDays[`${x},${y}`] = RegionManager.getCurrentDay();
        }

        // Remove resource node if depleted
        if (tile.resource.amount <= 0) {
            tile.resource = null;
        }

        // Re-render to update visuals
        render();

        // Save state (region deltas in overworld mode, legacy grid in test mode)
        if (!TEST_MODE && currentRegion) {
            saveRegionState(currentRegion.x, currentRegion.y);
        } else {
            saveGridState();
        }

        // Advance time by 0.25 days for harvesting
        if (window.TimeSystem) {
            TimeSystem.advanceDays(0.25);
        }

        return {
            type: tile.resource ? tile.resource.type : null,
            amount: harvested
        };
    }

    /**
     * Save grid state to game state (for persistence)
     */
    function saveGridState() {
        if (!window.GameState) return;

        const worldState = window.GameState.getState().world || {};

        // Extract only tiles with resources for saving
        const resourceTiles = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const tile = grid[y][x];
                if (tile.resource) {
                    resourceTiles.push({
                        x: x,
                        y: y,
                        resource: { ...tile.resource }
                    });
                }
            }
        }

        // Extract tiles with combat encounters for saving
        const combatEncounterTiles = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const tile = grid[y][x];
                if (tile.combatEncounter) {
                    combatEncounterTiles.push({
                        x: x,
                        y: y,
                        combatEncounter: {
                            type: tile.combatEncounter.type,
                            biome: tile.combatEncounter.biome,
                            active: tile.combatEncounter.active
                            // Note: respawnTimer is not saved (will be null on reload)
                        }
                    });
                }
            }
        }

        worldState.resourceTiles = resourceTiles;
        worldState.combatEncounterTiles = combatEncounterTiles;
        window.GameState.updateProperty('world', worldState);

        // Auto-save
        if (window.SaveSystem) {
            window.SaveSystem.save();
        }
    }

    /**
     * Load grid state from game state
     */
    function loadGridState() {
        const state = window.GameState?.getState();
        if (!state || !state.world) {
            return;
        }

        // Only clear and restore resources if there are saved resources
        // This prevents clearing resources on first load when there's no save data yet
        if (state.world.resourceTiles) {
            // First, clear all resources from the grid
            // This ensures depleted resources don't reappear
            for (let y = 0; y < GRID_HEIGHT; y++) {
                for (let x = 0; x < GRID_WIDTH; x++) {
                    if (grid[y] && grid[y][x]) {
                        grid[y][x].resource = null;
                    }
                }
            }

            // Then restore only the saved resource tiles
            state.world.resourceTiles.forEach(savedTile => {
                const tile = grid[savedTile.y][savedTile.x];
                if (tile) {
                    tile.resource = { ...savedTile.resource };
                }
            });
        }

        // Restore combat encounter tiles
        if (state.world.combatEncounterTiles) {
            state.world.combatEncounterTiles.forEach(savedTile => {
                const tile = grid[savedTile.y][savedTile.x];
                if (tile && tile.combatEncounter) {
                    // Update the active state from saved data
                    tile.combatEncounter.active = savedTile.combatEncounter.active;
                }
            });
        }
    }

    /**
     * Handle combat victory - despawn encounter and start respawn timer
     */
    function handleCombatVictory() {
        const worldState = window.GameState?.getState()?.world;
        if (!worldState) return;

        // Nest assault victory takes priority over regular encounters
        if (worldState.pendingNestAssault) {
            const pending = worldState.pendingNestAssault;
            worldState.pendingNestAssault = null;
            window.GameState.updateProperty('world', worldState);
            resolveNestAssaultVictory(pending);
            return;
        }

        if (!worldState.lastEncounterLocation) {
            return;
        }

        const { x, y } = worldState.lastEncounterLocation;
        const tile = getTile(x, y);

        if (tile && tile.combatEncounter) {
            // Deactivate the encounter
            tile.combatEncounter.active = false;

            if (tile.combatEncounter.nestGuard) {
                // Nest guards do not respawn — the way to the heart stays open
                render();
                if (window.ActivityLog) {
                    ActivityLog.addMessage('Nest guard defeated! The heart of the nest is closer.', 'combat');
                }
            } else {
                // Start respawn timer
                const respawnTime = COMBAT_ENCOUNTERS.enemy.respawnTime;
                tile.combatEncounter.respawnTimer = setTimeout(() => {
                    respawnCombatEncounter(x, y);
                }, respawnTime);

                // Save grid state
                saveGridState();

                // Re-render to remove the encounter icon
                render();

                if (window.ActivityLog) {
                    ActivityLog.addMessage(`Enemy defeated! It will respawn in ${respawnTime / 1000} seconds.`, 'info');
                }
            }
        }

        // Clear the last encounter location
        worldState.lastEncounterLocation = null;
        window.GameState.updateProperty('world', worldState);
    }

    /**
     * Handle combat flee or defeat - reset player to origin
     */
    function handleCombatFleeOrDefeat() {
        const origin = { x: 10, y: 10 }; // Map origin point

        // Move player back to origin
        playerPosition = { ...origin };
        updateCamera();
        revealAroundLocalPlayer(); // don't strand the player in unrevealed fog
        savePlayerPosition();

        // Re-render map
        render();

        if (window.ActivityLog) {
            ActivityLog.addMessage(`Returned to safe location at (${origin.x}, ${origin.y})`, 'info');
        }

        // Clear the last encounter location and any pending nest assault
        // (fleeing the chieftain leaves the nest standing)
        const worldState = window.GameState?.getState()?.world;
        if (worldState) {
            worldState.lastEncounterLocation = null;
            if (worldState.pendingNestAssault) {
                worldState.pendingNestAssault = null;
                if (window.ActivityLog) {
                    ActivityLog.addMessage('The nest still stands...', 'warning');
                }
            }
            window.GameState.updateProperty('world', worldState);
        }
    }

    /**
     * Respawn a combat encounter at the given coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    function respawnCombatEncounter(x, y) {
        const tile = getTile(x, y);

        if (tile && tile.combatEncounter) {
            tile.combatEncounter.active = true;
            tile.combatEncounter.respawnTimer = null;

            // Save grid state
            saveGridState();

            // Re-render to show the encounter icon again
            render();

            if (window.ActivityLog) {
                ActivityLog.addMessage(`An enemy has appeared at (${x}, ${y})!`, 'combat');
            }
        }
    }

    // ─── Overworld Integration ───────────────────────────────────────────────

    /**
     * Called by WorldMap when the player enters a region.
     * Generates the local map for this region and shows it.
     * @param {number} regionX - Overworld X coord
     * @param {number} regionY - Overworld Y coord
     * @param {string} biome   - Biome type for this region
     */
    function enterRegion(regionX, regionY, biome, fromDir) {
        currentRegion = { x: regionX, y: regionY, biome };

        // Stop any in-progress auto-walk from a previous region
        stopWalking(false);

        // Visit the region record: creates/migrates it, runs the lazy sim
        // (regrowth), marks it explored, and reports first discovery.
        let regionRecord = null;
        if (!TEST_MODE && window.RegionManager) {
            const visit = RegionManager.visitRegion(regionX, regionY, biome);
            regionRecord = visit.record;
            if (visit.firstVisit && regionRecord && window.ActivityLog) {
                const stars = '★'.repeat(regionRecord.richness) + '☆'.repeat(5 - regionRecord.richness);
                ActivityLog.addMessage(`Discovered ${regionRecord.name}! Richness: ${stars}`, 'success');
            }
        }

        if (TEST_MODE) {
            // In test mode just re-init the hardcoded map
            generateGrid();
        } else {
            // Seed the local map from overworld seed + region coords
            if (window.Noise) {
                const worldSeed = window.GameState?.getState()?.world?.seed || 0;
                // Create a deterministic local seed from world seed + region position
                const localSeedStr = `${worldSeed}_${regionX}_${regionY}`;
                Noise.setSeed(localSeedStr);
            }
            generateRegionGrid(biome);
        }

        // Snapshot the freshly generated (pre-delta) resources so leaving the
        // region can compute sparse, regrow-aware deltas.
        snapshotBaseResources();

        // Apply saved resource deltas (post-lazy-sim, so regrown nodes return)
        applyRegionDeltas(regionRecord);

        // Place the raider nest if this region is infested
        if (regionRecord?.threat?.nestLevel > 0) {
            placeNest(regionRecord.threat.nestLevel);
            if (window.ActivityLog) {
                ActivityLog.addMessage(
                    `A raider nest (Lv ${regionRecord.threat.nestLevel}) festers somewhere in this region!`,
                    'warning'
                );
            }
        }

        // Place ancestors' graves (references — honoring mutates the record)
        if (regionRecord?.graves) {
            regionRecord.graves.forEach(grave => {
                const tile = grid[grave.y]?.[grave.x];
                if (tile) tile.grave = grave;
            });
        }

        // Restore this region's fog of war
        revealedLocal = new Set(regionRecord?.revealedTiles || []);

        // Update the region label in the UI
        const label = document.getElementById('local-map-region-label');
        if (label) {
            const biomeConfig = BIOMES[biome] || BIOMES.plains;
            label.textContent = `${biomeConfig.name} Region (${regionX}, ${regionY})`;
        }

        // Save current region to game state so it persists on reload
        const worldState = window.GameState?.getState()?.world || {};
        worldState.currentRegion = { x: regionX, y: regionY, biome };
        window.GameState?.updateProperty('world', worldState);

        // fromDir is null when restoring from a save (page reload) — use saved position.
        // Otherwise spawn at the edge the player entered from.
        if (fromDir === null || fromDir === undefined) {
            const savedPos = window.GameState?.getState()?.world?.playerPosition;
            if (savedPos) {
                playerPosition = { ...savedPos };
            } else {
                playerPosition = { x: Math.floor(GRID_WIDTH / 2), y: Math.floor(GRID_HEIGHT / 2) };
                savePlayerPosition();
            }
        } else {
            const midX = Math.floor(GRID_WIDTH  / 2);
            const midY = Math.floor(GRID_HEIGHT / 2);
            const edge = 1;
            if      (fromDir === 'up')    playerPosition = { x: midX, y: GRID_HEIGHT - edge - 1 };
            else if (fromDir === 'down')  playerPosition = { x: midX, y: edge };
            else if (fromDir === 'left')  playerPosition = { x: GRID_WIDTH - edge - 1, y: midY };
            else if (fromDir === 'right') playerPosition = { x: edge, y: midY };
            else                          playerPosition = { x: midX, y: midY };
            savePlayerPosition();
        }

        // Reveal fog around the entry position
        revealAroundLocalPlayer();

        resizeCanvas();
        render();
    }

    /**
     * Generate a local map grid for a given biome using noise.
     * Resources are placed procedurally based on biome type.
     */
    function generateRegionGrid(biome) {
        grid = [];

        for (let y = 0; y < GRID_HEIGHT; y++) {
            grid[y] = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                // Use noise to vary terrain within the region
                const n = window.Noise ? Noise.fbm01(x * 0.3, y * 0.3, 2, 0.5, 2.0) : 0.5;

                let tileBiome = biome;

                // Add natural variation — pockets of water or mountains
                if (x === 0 || x === GRID_WIDTH - 1 || y === 0 || y === GRID_HEIGHT - 1) {
                    tileBiome = biome; // Keep borders as the region biome
                } else if (n < 0.15) {
                    tileBiome = 'water';
                } else if (n > 0.88) {
                    tileBiome = 'mountain';
                }

                const biomeConfig = BIOMES[tileBiome] || BIOMES.plains;
                grid[y][x] = {
                    type: tileBiome,
                    biome: tileBiome,
                    walkable: biomeConfig.walkable,
                    x, y,
                    resource: null,
                    combatEncounter: null
                };
            }
        }

        // Place resources based on biome
        placeRegionResources(biome);

        // Place random encounters based on biome
        placeRegionEncounters(biome);
    }

    /**
     * Place resources procedurally for a given biome.
     */
    function placeRegionResources(biome) {
        // Resource pools per biome
        // Weighted pools: repeat entries to bias selection
        // Weighted pools: repeat entries to bias selection.
        // 'stone' = loose rock pickup (no tool). 'rock' = quarry (needs pickaxe).
        // Stones are uncommon: present in most biomes but outweighed by staples.
        const BIOME_RESOURCES = {
            forest:  ['tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'stick_bush', 'berry_bush', 'fiber_plant', 'stone', 'rock'],
            plains:  ['stick_bush', 'stick_bush', 'berry_bush', 'berry_bush', 'fiber_plant', 'fiber_plant', 'stone', 'rock'],
            desert:  ['rock', 'rock', 'rock', 'copper_ore', 'stone'],
            tundra:  ['rock', 'rock', 'stick_bush', 'stick_bush', 'stone'],
            swamp:   ['fiber_plant', 'fiber_plant', 'berry_bush', 'stick_bush', 'stone'],
            mountain: ['rock', 'rock', 'rock', 'rock', 'copper_ore', 'copper_ore', 'stone'],
            water:   []
        };

        const pool = BIOME_RESOURCES[biome] || BIOME_RESOURCES.plains;
        if (pool.length === 0) return;

        // Coverage % of walkable tiles that become resource nodes per biome
        const BIOME_COVERAGE = {
            forest:   0.40,
            plains:   0.12,
            swamp:    0.20,
            tundra:   0.10,
            desert:   0.08,
            mountain: 0.15
        };

        const coverage = BIOME_COVERAGE[biome] ?? 0.10;

        // Iterate every walkable tile and roll per-tile placement.
        // Uses Noise.hash2D (uniform, seeded, independent per tile) — NOT
        // noise2D, which is smooth Perlin noise clustered around 0.5 and made
        // coverage thresholds hit a tiny fraction of the intended rate
        // (forests came out nearly empty, deserts/plains got ~nothing).
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const tile = grid[y][x];
                if (!tile || !tile.walkable || tile.resource) continue;

                // Place roll: unique uniform roll per (x,y), deterministic per region seed
                const placeRoll = window.Noise
                    ? Noise.hash2D(x, y)
                    : Math.random();
                if (placeRoll > coverage) continue;

                // Pool pick: separate uniform roll per tile (offset coords so it
                // doesn't correlate with the place roll)
                const pickRoll = window.Noise
                    ? Noise.hash2D(x + 1013, y + 2027)
                    : Math.random();
                const idx = Math.min(pool.length - 1, Math.floor(pickRoll * pool.length));
                const resourceType = pool[idx];

                addResource(x, y, resourceType);
            }
        }
    }

    /**
     * Place random combat encounter tiles for a region.
     * Encounter count scales with biome danger.
     */
    function placeRegionEncounters(biome) {
        const ENCOUNTER_COUNTS = {
            plains:   2,
            forest:   3,
            desert:   3,
            tundra:   3,
            swamp:    4,
            mountain: 4
        };

        const count = ENCOUNTER_COUNTS[biome] || 2;
        let placed = 0;
        let attempts = 0;

        while (placed < count && attempts < 100) {
            attempts++;
            // Uniform seeded rolls — noise2D clusters near the middle, which
            // biased every encounter toward the center of the region
            const n1 = window.Noise ? Noise.hash2D(attempts, 90001) : Math.random();
            const n2 = window.Noise ? Noise.hash2D(90002, attempts) : Math.random();
            const rx = Math.floor(n1 * (GRID_WIDTH  - 2)) + 1;
            const ry = Math.floor(n2 * (GRID_HEIGHT - 2)) + 1;

            const tile = grid[ry]?.[rx];
            if (!tile || !tile.walkable || tile.combatEncounter || tile.resource) continue;

            addCombatEncounter(rx, ry, biome);
            placed++;
        }
    }

    /**
     * Set up the "Back to World Map" button handler.
     */
    function setupBackToOverworldButton() {
        const btn = document.getElementById('local-map-back-btn');
        if (!btn) return;

        btn.addEventListener('click', () => {
            exitToOverworld();
        });
    }

    /**
     * Exit local map and return to the overworld.
     */
    function exitToOverworld() {
        // Save this region's resource state before leaving
        if (currentRegion) {
            saveRegionState(currentRegion.x, currentRegion.y);
        }

        currentRegion = null;

        // Clear saved region from game state
        const worldState = window.GameState?.getState()?.world || {};
        delete worldState.currentRegion;
        window.GameState?.updateProperty('world', worldState);

        // Tell WorldMap to show the overworld again
        if (window.WorldMap) {
            WorldMap.exitRegion();
        }
    }

    /**
     * Save resource/encounter deltas for the current region.
     */
    /**
     * Snapshot the generated (pre-delta) resource layout of the current grid.
     * Deltas are computed against this when the region is saved.
     */
    function snapshotBaseResources() {
        baseResources = {};
        harvestDays = {};
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const tile = grid[y][x];
                if (tile.resource) {
                    baseResources[`${x},${y}`] = {
                        type: tile.resource.type,
                        amount: tile.resource.amount
                    };
                }
            }
        }
    }

    /**
     * Save the current region's resource deltas + fog to its region record.
     * Only tiles that differ from the generated base are stored — and the
     * lazy sim removes them again once their regrow window passes.
     */
    function saveRegionState(regionX, regionY) {
        if (!window.RegionManager) return;

        const today = RegionManager.getCurrentDay();
        const deltas = {};

        for (const key of Object.keys(baseResources)) {
            const [x, y] = key.split(',').map(Number);
            const base = baseResources[key];
            const current = grid[y]?.[x]?.resource;

            if (!current) {
                // Fully depleted node
                deltas[key] = {
                    type: base.type,
                    amount: 0,
                    harvestedOnDay: harvestDays[key] ?? today
                };
            } else if (current.amount < base.amount) {
                // Partially harvested node
                deltas[key] = {
                    type: base.type,
                    amount: current.amount,
                    harvestedOnDay: harvestDays[key] ?? today
                };
            }
        }

        RegionManager.setResourceDeltas(regionX, regionY, deltas);
        RegionManager.setRevealedTiles(regionX, regionY, revealedLocal);
        if (window.SaveSystem) SaveSystem.save();
    }

    /**
     * Apply a region record's resource deltas over the freshly generated grid.
     * (The lazy sim has already removed any deltas that regrew.)
     */
    function applyRegionDeltas(regionRecord) {
        if (!regionRecord || !regionRecord.resourceDeltas) return;

        Object.entries(regionRecord.resourceDeltas).forEach(([coord, delta]) => {
            const [x, y] = coord.split(',').map(Number);
            const tile = grid[y]?.[x];
            if (!tile) return;

            // Remember the harvest day so re-saving preserves the regrow clock
            if (delta.harvestedOnDay !== undefined) {
                harvestDays[coord] = delta.harvestedOnDay;
            }

            if (delta.amount <= 0) {
                tile.resource = null;
            } else if (tile.resource) {
                tile.resource.amount = delta.amount;
            }
        });
    }

    /**
     * Called by WorldMap when player enters their settlement from the overworld.
     */
    function enterCampFromOverworld() {
        enterCamp();
    }

    /**
     * Called by WorldMap to register where the settlement was placed on the overworld.
     * Stores it so the local camp system stays in sync.
     */
    function setOverworldCamp(pos) {
        campLocation = { x: pos.x, y: pos.y, isPlaced: true };
        if (window.GameState) {
            window.GameState.updateProperty('campLocation', campLocation);
        }
        updateCampButtonVisibility();
    }

    // ─── Overworld button wiring (called from init) ───────────────────────────

    function wireOverworldButtons() {
        const campBtn    = document.getElementById('overworld-camp-btn');
        const exploreBtn = document.getElementById('overworld-explore-btn');

        if (campBtn) {
            campBtn.addEventListener('click', () => {
                if (window.WorldMap) WorldMap.placeSettlement();
            });
        }

        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                if (window.WorldMap) WorldMap.enterRegion();
            });
        }
    }

    /**
     * Force a refresh of the map (useful for external calls)
     */
    function refresh() {
        if (!isInitialized) return;
        resizeCanvas();
        render();
    }

    /**
     * Restore map state from saved game data
     * Called after save data is loaded into GameState
     */
    function restoreState() {
        if (!isInitialized) return;

        if (!TEST_MODE) {
            // If player was inside a region, restore that view
            const savedRegion = window.GameState?.getState()?.world?.currentRegion;
            if (savedRegion) {
                // Switch UI to local map view (WorldMap is now initialized)
                if (window.WorldMap) WorldMap.hide();
                enterRegion(savedRegion.x, savedRegion.y, savedRegion.biome);
                return; // enterRegion handles position + render
            }
        }

        // Reload player position from game state
        loadPlayerPosition();

        // Reload grid state (resources) from game state
        loadGridState();

        // Reload camp location from game state
        loadCampLocation();

        // Update in-settlement overlay
        updateInSettlementOverlay();

        // Update settlement tab visibility
        if (window.TabManager) {
            window.TabManager.updateSettlementTabVisibility();
        }

        // Re-render with restored state
        render();
    }

    return {
        init,
        render,
        refresh,
        restoreState,
        getPlayerPosition,
        movePlayer,
        getTile,
        getGrid,
        getBiomeConfig,
        getAllBiomes,
        getResourceConfig,
        getAllResources,
        harvestResource,
        handleCombatVictory,
        handleCombatFleeOrDefeat,
        // Overworld integration
        enterRegion,
        exitToOverworld,
        setOverworldCamp,
        enterCampFromOverworld,
        showEnterCampModal
    };
})();

// Expose as LocalMap. Deliberately NOT window.Map — assigning this module to
// window.Map used to shadow JavaScript's built-in Map constructor, breaking
// any code that calls `new Map()` after this script loads.
window.LocalMap = LocalMap;
