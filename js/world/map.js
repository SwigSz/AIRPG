// ============================================
// Map Display & Navigation
// ============================================

const Map = (() => {
    // Constants
    const GRID_WIDTH = 20;
    const GRID_HEIGHT = 20;

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
            description: 'A sturdy tree that can be harvested for wood',
            itemName: 'Wood',
            gatherVerb: 'chopped'
        },
        rock: {
            name: 'Rock',
            color: '#666666',
            icon: '🪨',
            defaultAmount: 5,
            description: 'A large stone deposit containing valuable minerals',
            itemName: 'Stone',
            gatherVerb: 'mined'
        },
        bush: {
            name: 'Berry Bush',
            color: '#8b4789',
            icon: '🫐',
            defaultAmount: 3,
            description: 'A bush bearing edible berries',
            itemName: 'Berries',
            gatherVerb: 'gathered'
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

    const GRID_LINE_COLOR = '#000000';
    const GRID_LINE_WIDTH = 0.5;
    const PLAYER_COLOR = '#f4c430';
    const PLAYER_RADIUS_RATIO = 0.4;

    // State
    let canvas = null;
    let ctx = null;
    let grid = [];
    let playerPosition = { x: 10, y: 10 };
    let tileSize = 0;
    let isInitialized = false;
    let keydownHandler = null;
    let resizeTimeout = null;

    /**
     * Initialize the map module
     */
    function init() {
        console.log('Map: Initializing...');

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
            canvas.style.width = '100%';
            canvas.style.height = '100%';

            // Clear placeholder and add canvas
            mapView.innerHTML = '';
            mapView.appendChild(canvas);
        }

        ctx = canvas.getContext('2d');

        // Generate the hardcoded grid
        generateGrid();

        // Load player position from game state if available
        loadPlayerPosition();

        // Load resource state from game state if available
        loadGridState();

        // Set up resize handler for responsive canvas
        setupResizeHandler();

        // Set up keyboard controls
        setupKeyboardControls();

        // Set up tab visibility handler
        setupTabVisibilityHandler();

        // Initial render
        resizeCanvas();
        render();

        isInitialized = true;
        console.log('Map: Initialized successfully');
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

        // Berry bushes in various locations (3 bushes)
        addResource(11, 5, 'bush', 3);
        addResource(7, 15, 'bush', 3);
        addResource(15, 13, 'bush', 3);
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

            // Check if we're in combat view (don't allow map movement during combat)
            const combatView = document.querySelector('.combat-view');
            if (combatView && combatView.classList.contains('active')) {
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
                    // Handle resource gathering
                    event.preventDefault();
                    gatherResourceAtPlayerPosition();
                    return;
            }

            // If a movement key was pressed, attempt to move
            if (moved) {
                event.preventDefault(); // Prevent page scrolling
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
        console.log('Map: Keyboard controls initialized (WASD or Arrow Keys)');
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

        // Create the resource item
        const item = window.Items.createItem(resourceConfig.itemName, null, {
            classifications: ['material'],
            description: `${resourceConfig.itemName} gathered from ${resourceConfig.name.toLowerCase()}`,
            icon: resourceConfig.icon
        });

        // Try to add to inventory
        const success = window.Inventory.addItem(character.inventory, item);

        if (success) {
            // Display success message
            const remainingText = currentAmount > 1 ? ` (${currentAmount - 1} remaining)` : ' (depleted)';
            const message = `${resourceConfig.gatherVerb.charAt(0).toUpperCase() + resourceConfig.gatherVerb.slice(1)} ${resourceConfig.itemName} from ${resourceConfig.name}${remainingText}`;

            if (window.ActivityLog) {
                ActivityLog.addMessage(message, 'loot');
            }

            // Show notification
            if (window.NotificationManager) {
                NotificationManager.show(`+1 ${resourceConfig.itemName}`, 'success');
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

        // Draw green overlay on gathered tile
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

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

            // Then draw red overlay on blocked tile
            ctx.save(); // Save the entire canvas state
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(blockedX * tileSize, blockedY * tileSize, tileSize, tileSize);

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
    function resizeCanvas() {
        if (!canvas) return;

        const mapView = document.querySelector('.map-view');
        if (!mapView) return;

        // Get actual display size
        const rect = mapView.getBoundingClientRect();
        let displayWidth = rect.width;
        let displayHeight = rect.height;

        // If the container is hidden (0 dimensions), skip resize
        // This prevents rendering issues when tab is not visible
        if (displayWidth === 0 || displayHeight === 0) {
            return;
        }

        // Set canvas resolution to match display size
        canvas.width = displayWidth;
        canvas.height = displayHeight;

        // Calculate tile size based on the smaller dimension to fit the grid
        const tileWidth = displayWidth / GRID_WIDTH;
        const tileHeight = displayHeight / GRID_HEIGHT;
        tileSize = Math.floor(Math.min(tileWidth, tileHeight));
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

        // Draw player
        drawPlayer();
    }

    /**
     * Draw all tiles
     */
    function drawTiles() {
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const tile = grid[y][x];
                const biomeConfig = BIOMES[tile.biome] || BIOMES.plains;
                const color = biomeConfig.color;

                ctx.fillStyle = color;
                ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }
        }
    }

    /**
     * Draw grid lines
     */
    function drawGridLines() {
        ctx.strokeStyle = GRID_LINE_COLOR;
        ctx.lineWidth = GRID_LINE_WIDTH;

        // Vertical lines
        for (let x = 0; x <= GRID_WIDTH; x++) {
            ctx.beginPath();
            ctx.moveTo(x * tileSize, 0);
            ctx.lineTo(x * tileSize, GRID_HEIGHT * tileSize);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= GRID_HEIGHT; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * tileSize);
            ctx.lineTo(GRID_WIDTH * tileSize, y * tileSize);
            ctx.stroke();
        }
    }

    /**
     * Draw resource nodes on tiles that have them
     */
    function drawResources() {
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const tile = grid[y][x];
                if (tile.resource) {
                    const resourceConfig = RESOURCES[tile.resource.type];
                    if (!resourceConfig) continue;

                    // Draw darker shade overlay on tile
                    ctx.fillStyle = resourceConfig.color;
                    ctx.globalAlpha = 0.3;
                    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                    ctx.globalAlpha = 1.0;

                    // Draw resource icon centered on tile
                    const iconSize = Math.max(tileSize * 0.5, 12);
                    ctx.font = `${iconSize}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const centerX = x * tileSize + tileSize / 2;
                    const centerY = y * tileSize + tileSize / 2;

                    ctx.fillText(resourceConfig.icon, centerX, centerY);
                }
            }
        }

        // Reset text alignment for other drawing operations
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * Draw combat encounter nodes on tiles that have them
     */
    function drawCombatEncounters() {
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const tile = grid[y][x];
                if (tile.combatEncounter && tile.combatEncounter.active) {
                    const encounterConfig = COMBAT_ENCOUNTERS.enemy;
                    if (!encounterConfig) continue;

                    // Draw darker red overlay on tile
                    ctx.fillStyle = encounterConfig.color;
                    ctx.globalAlpha = 0.4;
                    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                    ctx.globalAlpha = 1.0;

                    // Draw combat icon centered on tile
                    const iconSize = Math.max(tileSize * 0.6, 14);
                    ctx.font = `${iconSize}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const centerX = x * tileSize + tileSize / 2;
                    const centerY = y * tileSize + tileSize / 2;

                    ctx.fillText(encounterConfig.icon, centerX, centerY);
                }
            }
        }

        // Reset text alignment for other drawing operations
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * Draw player as a yellow circle
     */
    function drawPlayer() {
        const centerX = playerPosition.x * tileSize + tileSize / 2;
        const centerY = playerPosition.y * tileSize + tileSize / 2;
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
        // Validate boundaries
        if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) {
            return false;
        }

        // Check if tile is walkable
        const targetTile = grid[newY][newX];
        if (!targetTile.walkable) {
            return false;
        }

        // Update player position
        playerPosition = { x: newX, y: newY };

        // Save to game state
        savePlayerPosition();

        // Check for combat encounter
        if (targetTile.combatEncounter && targetTile.combatEncounter.active) {
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

        // Calculate player's attack damage based on equipped weapon
        const baseAttack = 5; // Unarmed base damage
        const weaponDamage = window.CombatManager ? getEquippedWeaponDamage(character) : null;
        const playerAttack = weaponDamage || baseAttack;

        // Convert character to combatant format
        const player = {
            ...character,
            isPlayer: true,
            isAlive: true,
            hp: 100,
            maxHp: 100,
            attack: playerAttack,
            baseAttack: baseAttack,
            defense: 5,
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
            attack: window.EnemyFactory ? window.EnemyFactory.calculateEnemyAttack(enemyInstance) : enemyInstance.attack,
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

        // Remove resource node if depleted
        if (tile.resource.amount <= 0) {
            tile.resource = null;
        }

        // Re-render to update visuals
        render();

        // Save state
        saveGridState();

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
        if (state.world.resourceTiles) {
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
        if (!worldState || !worldState.lastEncounterLocation) {
            return;
        }

        const { x, y } = worldState.lastEncounterLocation;
        const tile = getTile(x, y);

        if (tile && tile.combatEncounter) {
            // Deactivate the encounter
            tile.combatEncounter.active = false;

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
        savePlayerPosition();

        // Re-render map
        render();

        if (window.ActivityLog) {
            ActivityLog.addMessage(`Returned to safe location at (${origin.x}, ${origin.y})`, 'info');
        }

        // Clear the last encounter location
        const worldState = window.GameState?.getState()?.world;
        if (worldState) {
            worldState.lastEncounterLocation = null;
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

        console.log('Map: Restoring state from save data...');

        // Reload player position from game state
        loadPlayerPosition();

        // Reload grid state (resources) from game state
        loadGridState();

        // Re-render with restored state
        render();

        console.log('Map: State restored successfully');
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
        handleCombatFleeOrDefeat
    };
})();

window.Map = Map;
