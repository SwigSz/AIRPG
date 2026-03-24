/**
 * World Map (Overworld) System
 *
 * Two-layer map architecture:
 *   - Overworld: 30x30 grid of regions, each region is a biome tile.
 *     Player navigates here with WASD. Entering a region (Space/Enter or button)
 *     switches to the local map for that region.
 *   - Local map: handled by map.js (existing system), generated per-region from seed.
 *
 * Generation:
 *   - Noise-based biome assignment using two noise layers (elevation + temperature).
 *   - Seeded so the same seed always produces the same world.
 *   - Seed stored in GameState.world.seed and persists across sessions.
 *
 * Fog of war:
 *   - Regions are hidden until the player has been adjacent to them.
 *   - Visited region coords stored in GameState.world.visitedRegions (Set serialized as array).
 *
 * State storage (delta-based):
 *   - Only saves visited status and resource/encounter deltas per region.
 *   - Unvisited regions cost zero storage.
 */

const WorldMap = (() => {
    'use strict';

    // ─── Constants ───────────────────────────────────────────────────────────

    const WORLD_WIDTH  = 30;
    const WORLD_HEIGHT = 30;

    // Viewport matches the full world — all tiles visible at once
    const VIEWPORT_W = WORLD_WIDTH;
    const VIEWPORT_H = WORLD_HEIGHT;

    // Travel cost in days per biome type
    const TRAVEL_COST = {
        plains:   1.0,
        forest:   1.5,
        desert:   2.0,
        tundra:   2.0,
        swamp:    2.5,
        mountain: null, // impassable
        water:    null  // impassable
    };

    // Biome visual config
    const BIOME_CONFIG = {
        plains:   { name: 'Plains',   color: '#6b8e23', icon: '🌿' },
        forest:   { name: 'Forest',   color: '#2d5016', icon: '🌲' },
        desert:   { name: 'Desert',   color: '#c8a45a', icon: '🏜️' },
        tundra:   { name: 'Tundra',   color: '#a8bdd1', icon: '❄️' },
        swamp:    { name: 'Swamp',    color: '#3d5c3d', icon: '🌫️' },
        mountain: { name: 'Mountain', color: '#5a5a5a', icon: '⛰️' },
        water:    { name: 'Water',    color: '#1a3a6b', icon: '🌊' }
    };

    // Noise sampling scale — lower = larger biome blobs
    const ELEVATION_SCALE  = 0.12;
    const TEMPERATURE_SCALE = 0.08;

    // ─── State ───────────────────────────────────────────────────────────────

    let canvas       = null;
    let ctx          = null;
    let tileSize     = 0;
    let isActive     = false; // true when overworld is showing (vs local map)
    let encountersEnabled = true; // debug toggle
    let fogEnabled        = true;  // debug toggle
    let isInitialized = false;

    // Player position on overworld grid
    let playerPos = { x: 15, y: 15 };

    // Camera top-left corner (in overworld tile coords)
    let camera = { x: 0, y: 0 };

    // The generated region grid [y][x]
    let regionGrid = [];

    // Settlement location on overworld (set when player places camp)
    let settlementPos = null;

    // Fog: Set of "x,y" strings the player has revealed
    let revealedTiles = new Set();

    // Resize debounce
    let resizeTimeout = null;

    // Keyboard handler reference for cleanup
    let keydownHandler = null;

    // ─── Initialization ───────────────────────────────────────────────────────

    /**
     * Initialize the world map.
     * Called from main.js after GameState is ready.
     */
    function init() {
        // Load or generate seed
        const state = window.GameState?.getState();
        let seed = state?.world?.seed;

        if (!seed) {
            seed = generateSeed();
            saveToGameState({ seed });
        }

        // Seed the noise
        if (window.Noise) {
            Noise.setSeed(seed);
        } else {
            console.error('WorldMap: Noise module not loaded');
        }

        // Generate the world
        generateWorld();

        // Load saved state (player pos, settlement, revealed tiles)
        loadFromGameState();

        // Find/create canvas
        setupCanvas();

        // Keyboard controls
        setupKeyboardControls();

        // Resize handler
        setupResizeHandler();

        // Initial camera center on player
        centerCameraOnPlayer();

        isInitialized = true;

        // Show overworld by default (local map is hidden until player enters a region)
        show();
    }

    // ─── World Generation ─────────────────────────────────────────────────────

    /**
     * Generate a random alphanumeric seed string.
     */
    function generateSeed() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let seed = '';
        for (let i = 0; i < 10; i++) {
            seed += chars[Math.floor(Math.random() * chars.length)];
        }
        return seed;
    }

    /**
     * Generate the full overworld region grid from noise.
     */
    function generateWorld() {
        regionGrid = [];

        for (let y = 0; y < WORLD_HEIGHT; y++) {
            regionGrid[y] = [];
            for (let x = 0; x < WORLD_WIDTH; x++) {
                const biome = getBiomeAt(x, y);
                regionGrid[y][x] = {
                    x, y,
                    biome,
                    walkable: TRAVEL_COST[biome] !== null,
                    travelCost: TRAVEL_COST[biome] || null
                };
            }
        }
    }

    /**
     * Determine biome at overworld coord (x, y) using two noise layers.
     *
     * Elevation noise → determines water/mountain presence
     * Temperature noise → differentiates remaining biomes
     */
    function getBiomeAt(x, y) {
        if (!window.Noise) return 'plains';

        // Hard water border
        if (x === 0 || x === WORLD_WIDTH - 1 || y === 0 || y === WORLD_HEIGHT - 1) {
            return 'water';
        }

        const elevation    = Noise.fbm01(x * ELEVATION_SCALE,   y * ELEVATION_SCALE,   4, 0.5, 2.0);
        const temperature  = Noise.fbm01(x * TEMPERATURE_SCALE, y * TEMPERATURE_SCALE, 3, 0.6, 2.0);

        // Water: low elevation
        if (elevation < 0.28) return 'water';

        // Mountain: high elevation
        if (elevation > 0.72) return 'mountain';

        // Remaining land — biome by temperature
        if (temperature < 0.20) return 'tundra';
        if (temperature < 0.38) return 'swamp';
        if (temperature < 0.55) return 'forest';
        if (temperature < 0.75) return 'plains';
        return 'desert';
    }

    // ─── Visibility / Fog ─────────────────────────────────────────────────────

    /**
     * Reveal tiles around the player (radius 2).
     */
    function revealAroundPlayer() {
        const radius = 2;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tx = playerPos.x + dx;
                const ty = playerPos.y + dy;
                if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT) {
                    revealedTiles.add(`${tx},${ty}`);
                }
            }
        }
    }

    function isTileRevealed(x, y) {
        if (!fogEnabled) return true;
        return revealedTiles.has(`${x},${y}`);
    }

    // ─── Camera ───────────────────────────────────────────────────────────────

    function centerCameraOnPlayer() {
        camera.x = Math.max(0, Math.min(WORLD_WIDTH  - VIEWPORT_W, playerPos.x - Math.floor(VIEWPORT_W / 2)));
        camera.y = Math.max(0, Math.min(WORLD_HEIGHT - VIEWPORT_H, playerPos.y - Math.floor(VIEWPORT_H / 2)));
    }

    // ─── Player Movement ─────────────────────────────────────────────────────

    /**
     * Move the player to (newX, newY) on the overworld.
     * Returns true if successful.
     */
    function movePlayer(newX, newY) {
        if (newX < 0 || newX >= WORLD_WIDTH || newY < 0 || newY >= WORLD_HEIGHT) return false;

        const tile = regionGrid[newY][newX];
        if (!tile.walkable) {
            showBlockedFeedback();
            return false;
        }

        playerPos = { x: newX, y: newY };

        // Reveal surrounding tiles
        revealAroundPlayer();

        // Advance time by travel cost
        const cost = tile.travelCost || 1;
        if (window.TimeSystem) {
            TimeSystem.advanceDays(cost);
        }

        // Check for random journey encounter
        if (encountersEnabled) checkJourneyEncounter(tile);

        // Keep camera centered on player
        centerCameraOnPlayer();

        // Save state
        saveToGameState({ playerPos });

        // Re-render
        render();

        // Update info panel
        updateInfoPanel(tile);

        // Log to activity
        if (window.ActivityLog) {
            const biome = BIOME_CONFIG[tile.biome] || BIOME_CONFIG.plains;
            ActivityLog.addMessage(
                `Traveled to ${biome.name} region (${newX}, ${newY}) — ${cost} day${cost !== 1 ? 's' : ''}`,
                'info'
            );
        }

        return true;
    }

    /**
     * Roll for a random journey encounter while traveling between regions.
     * These are separate from local map encounters (combat while exploring a region).
     */
    function checkJourneyEncounter(tile) {
        // Encounter rates per biome (chance per tile traveled)
        const ENCOUNTER_RATES = {
            plains:  0.05,
            forest:  0.12,
            desert:  0.10,
            tundra:  0.10,
            swamp:   0.18,
            mountain: 0.15
        };

        const rate = ENCOUNTER_RATES[tile.biome] || 0.05;
        if (Math.random() < rate) {
            triggerJourneyEncounter(tile.biome);
        }
    }

    /**
     * Trigger a journey encounter (combat while traveling overworld).
     */
    function triggerJourneyEncounter(biome) {
        if (!window.EnemyDatabase || !window.EnemyFactory || !window.CombatManager) return;

        const availableEnemies = EnemyDatabase.getEnemiesByBiome(biome);
        if (!availableEnemies || availableEnemies.length === 0) return;

        const enemyId = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
        const enemyInstance = EnemyFactory.createEnemy(enemyId);
        if (!enemyInstance) return;

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
            attack: getEquippedWeaponDamage(character) || 5,
            defense: character.defense || 0,
            speed: 15,
            initiative: 0
        };

        const enemy = {
            ...enemyInstance,
            speed: 10,
            xpReward: enemyInstance.xpReward || 0
        };

        if (window.ActivityLog) {
            ActivityLog.addMessage(`Ambushed while traveling through ${biome}!`, 'combat');
        }

        CombatManager.startCombat([player], [enemy]);
    }

    function getEquippedWeaponDamage(character) {
        const weapon = character.equipment?.mainHand;
        if (!weapon?.damage) return null;
        if (typeof weapon.damage === 'string' && weapon.damage.includes('~')) {
            const [min, max] = weapon.damage.split('~').map(Number);
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        return parseInt(weapon.damage) || null;
    }

    // ─── Enter / Exit Region ─────────────────────────────────────────────────

    /**
     * Enter the current overworld tile as a local map region.
     * Switches from overworld view to local map view.
     */
    function enterRegion() {
        const tile = regionGrid[playerPos.y][playerPos.x];

        // If this is the settlement tile, enter settlement instead
        if (settlementPos && playerPos.x === settlementPos.x && playerPos.y === settlementPos.y) {
            if (window.Map) {
                Map.enterCampFromOverworld();
            }
            return;
        }

        if (window.ActivityLog) {
            const biome = BIOME_CONFIG[tile.biome] || BIOME_CONFIG.plains;
            ActivityLog.addMessage(`Exploring ${biome.name} region at (${playerPos.x}, ${playerPos.y})...`, 'info');
        }

        // Tell Map (local map system) which region we're entering
        if (window.Map) {
            Map.enterRegion(playerPos.x, playerPos.y, tile.biome);
        }

        // Hide overworld, show local map
        hide();
    }

    /**
     * Called by the local map system when the player exits a region.
     * Returns to the overworld view.
     */
    function exitRegion() {
        show();
        render();
    }

    // ─── Settlement Placement ─────────────────────────────────────────────────

    /**
     * Place the settlement at the player's current overworld position.
     * Called when the player uses the "Set Up Camp" button on the overworld.
     */
    function placeSettlement() {
        if (settlementPos) {
            if (window.ActivityLog) ActivityLog.addMessage('Settlement already placed.', 'info');
            return;
        }

        const tile = regionGrid[playerPos.y][playerPos.x];
        if (!tile.walkable) {
            if (window.ActivityLog) ActivityLog.addMessage('Cannot place settlement here.', 'warning');
            return;
        }

        settlementPos = { x: playerPos.x, y: playerPos.y };

        // Also set camp in the legacy Map system so settlement tab works
        if (window.Map) {
            Map.setOverworldCamp(settlementPos);
        }

        saveToGameState({ settlementPos });

        if (window.ActivityLog) {
            ActivityLog.addMessage(`Settlement established at (${settlementPos.x}, ${settlementPos.y})`, 'info');
        }

        updateCampButtonVisibility();
        render();
    }

    // ─── Show / Hide ─────────────────────────────────────────────────────────

    function show() {
        isActive = true;
        const container = document.getElementById('overworld-view');
        if (container) container.style.display = 'block';

        // Hide local map
        const localView = document.querySelector('.map-view');
        if (localView) localView.style.display = 'none';

        // Update buttons
        updateCampButtonVisibility();
        updateExploreButton();

        // Resize + render
        setTimeout(() => {
            resizeCanvas();
            render();
        }, 0);
    }

    function hide() {
        isActive = false;
        const container = document.getElementById('overworld-view');
        if (container) container.style.display = 'none';

        // Show local map
        const localView = document.querySelector('.map-view');
        if (localView) localView.style.display = 'block';
    }

    // ─── UI Helpers ───────────────────────────────────────────────────────────

    function updateCampButtonVisibility() {
        const btn = document.getElementById('overworld-camp-btn');
        if (!btn) return;
        btn.style.display = settlementPos ? 'none' : 'block';
    }

    function updateExploreButton() {
        const btn = document.getElementById('overworld-explore-btn');
        if (!btn) return;

        const tile = regionGrid[playerPos.y]?.[playerPos.x];
        if (!tile) return;

        // If standing on settlement tile, show "Enter Settlement" instead
        if (settlementPos && playerPos.x === settlementPos.x && playerPos.y === settlementPos.y) {
            btn.textContent = '🏠 Enter Settlement';
        } else {
            const biome = BIOME_CONFIG[tile.biome] || BIOME_CONFIG.plains;
            btn.textContent = `🗺️ Explore ${biome.name}`;
        }
    }

    function updateInfoPanel(tile) {
        const panel = document.getElementById('overworld-info');
        if (!panel) return;

        const biome = BIOME_CONFIG[tile.biome] || BIOME_CONFIG.plains;
        const cost  = tile.travelCost ? `${tile.travelCost} day${tile.travelCost !== 1 ? 's' : ''}` : 'Impassable';

        const isSettlement = settlementPos && tile.x === settlementPos.x && tile.y === settlementPos.y;

        panel.innerHTML = `
            <span class="overworld-info-biome">${biome.icon} ${biome.name}</span>
            <span class="overworld-info-coords">(${tile.x}, ${tile.y})</span>
            ${isSettlement ? '<span class="overworld-info-tag">⛺ Settlement</span>' : ''}
            <span class="overworld-info-cost">Travel cost: ${cost}</span>
        `;
    }

    function showBlockedFeedback() {
        // Brief flash the info panel red or log a message
        if (window.ActivityLog) {
            ActivityLog.addMessage('Impassable terrain.', 'warning');
        }
    }

    // ─── Canvas Setup ─────────────────────────────────────────────────────────

    function setupCanvas() {
        const container = document.getElementById('overworld-view');
        if (!container) {
            console.error('WorldMap: #overworld-view container not found');
            return;
        }

        canvas = document.getElementById('overworld-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'overworld-canvas';
            canvas.style.display = 'block';
            container.appendChild(canvas);
        }

        ctx = canvas.getContext('2d');
        resizeCanvas();
    }

    function setupResizeHandler() {
        const container = document.getElementById('overworld-view');
        if (!container) return;

        const observer = new ResizeObserver(() => {
            if (!isActive) return;
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                resizeCanvas();
                render();
            }, 80);
        });
        observer.observe(container);
    }

    function resizeCanvas() {
        if (!canvas) return;
        const mapTab = document.getElementById('map-tab');
        if (!mapTab) return;

        const rect = mapTab.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Use the map-tab's inner dimensions (padding 12px each side)
        const pad = 12;
        const availW = rect.width  - pad * 2;
        const availH = rect.height - pad * 2;
        tileSize = Math.max(1, Math.floor(Math.min(availW / VIEWPORT_W, availH / VIEWPORT_H)));

        canvas.width  = VIEWPORT_W * tileSize;
        canvas.height = VIEWPORT_H * tileSize;
    }

    // ─── Rendering ────────────────────────────────────────────────────────────

    function render() {
        if (!ctx || !canvas || !isActive) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawTiles();
        drawGridLines();
        drawSettlement();
        drawPlayer();
    }

    function drawTiles() {
        for (let vy = 0; vy < VIEWPORT_H; vy++) {
            for (let vx = 0; vx < VIEWPORT_W; vx++) {
                const wx = camera.x + vx;
                const wy = camera.y + vy;

                if (wx < 0 || wx >= WORLD_WIDTH || wy < 0 || wy >= WORLD_HEIGHT) continue;

                const tile     = regionGrid[wy][wx];
                const revealed = isTileRevealed(wx, wy);
                const biome    = BIOME_CONFIG[tile.biome] || BIOME_CONFIG.plains;

                const px = vx * tileSize;
                const py = vy * tileSize;

                if (!revealed) {
                    // Unrevealed — draw dark tile
                    ctx.fillStyle = '#0a0a0a';
                    ctx.fillRect(px, py, tileSize, tileSize);
                    continue;
                }

                // Draw biome color
                ctx.fillStyle = biome.color;
                ctx.fillRect(px, py, tileSize, tileSize);

                // Draw biome icon if tile is large enough
                if (tileSize >= 20) {
                    const iconSize = Math.max(tileSize * 0.55, 12);
                    ctx.font = `${iconSize}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(biome.icon, px + tileSize / 2, py + tileSize / 2);
                }
            }
        }

        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    function drawGridLines() {
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 0.5;

        for (let vx = 0; vx <= VIEWPORT_W; vx++) {
            ctx.beginPath();
            ctx.moveTo(vx * tileSize, 0);
            ctx.lineTo(vx * tileSize, canvas.height);
            ctx.stroke();
        }
        for (let vy = 0; vy <= VIEWPORT_H; vy++) {
            ctx.beginPath();
            ctx.moveTo(0, vy * tileSize);
            ctx.lineTo(canvas.width, vy * tileSize);
            ctx.stroke();
        }
    }

    function drawSettlement() {
        if (!settlementPos) return;

        const vx = settlementPos.x - camera.x;
        const vy = settlementPos.y - camera.y;
        if (vx < 0 || vx >= VIEWPORT_W || vy < 0 || vy >= VIEWPORT_H) return;

        const px = vx * tileSize + tileSize / 2;
        const py = vy * tileSize + tileSize / 2;

        const iconSize = Math.max(tileSize * 0.7, 14);
        ctx.font = `${iconSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⛺', px, py);

        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    function drawPlayer() {
        const vx = playerPos.x - camera.x;
        const vy = playerPos.y - camera.y;
        if (vx < 0 || vx >= VIEWPORT_W || vy < 0 || vy >= VIEWPORT_H) return;

        const px = vx * tileSize + tileSize / 2;
        const py = vy * tileSize + tileSize / 2;
        const radius = tileSize * 0.3;

        // White border
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, radius + 2, 0, Math.PI * 2);
        ctx.fill();

        // Yellow player dot
        ctx.fillStyle = '#f4c430';
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // ─── Keyboard Controls ────────────────────────────────────────────────────

    function setupKeyboardControls() {
        if (keydownHandler) {
            document.removeEventListener('keydown', keydownHandler);
        }

        keydownHandler = (e) => {
            if (!isActive) return;

            // Don't move if combat is active
            const combatOverlay = document.querySelector('.combat-overlay');
            if (combatOverlay && combatOverlay.classList.contains('active')) return;

            let dx = 0, dy = 0;

            switch (e.key.toLowerCase()) {
                case 'w': case 'arrowup':    dy = -1; break;
                case 's': case 'arrowdown':  dy =  1; break;
                case 'a': case 'arrowleft':  dx = -1; break;
                case 'd': case 'arrowright': dx =  1; break;
                case ' ': case 'enter':
                    e.preventDefault();
                    enterRegion();
                    return;
                default: return;
            }

            e.preventDefault();
            movePlayer(playerPos.x + dx, playerPos.y + dy);
        };

        document.addEventListener('keydown', keydownHandler);
    }

    // ─── Game State Persistence ───────────────────────────────────────────────

    function saveToGameState(delta) {
        if (!window.GameState) return;

        const state = GameState.getState();
        const world = state.world || {};

        if (delta.seed       !== undefined) world.seed          = delta.seed;
        if (delta.playerPos  !== undefined) world.overworldPos  = delta.playerPos;
        if (delta.settlementPos !== undefined) world.overworldSettlement = delta.settlementPos;

        // Serialize revealedTiles Set → array
        world.revealedTiles = Array.from(revealedTiles);

        GameState.updateProperty('world', world);

        if (window.SaveSystem) SaveSystem.save();
    }

    function loadFromGameState() {
        const state = window.GameState?.getState();
        if (!state?.world) {
            // Fresh game — reveal starting area
            revealAroundPlayer();
            return;
        }

        const world = state.world;

        if (world.overworldPos) {
            playerPos = { ...world.overworldPos };
        }

        if (world.overworldSettlement) {
            settlementPos = { ...world.overworldSettlement };
        }

        if (Array.isArray(world.revealedTiles)) {
            revealedTiles = new Set(world.revealedTiles);
        }

        // Always reveal current position on load
        revealAroundPlayer();
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * Get the biome of the overworld tile at (x, y).
     * Used by the local map to know which biome to generate.
     */
    function getRegionBiome(x, y) {
        if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return 'plains';
        return regionGrid[y][x].biome;
    }

    /**
     * Get the current overworld player position.
     */
    function getPlayerPosition() {
        return { ...playerPos };
    }

    /**
     * Get the seed used for this world.
     */
    function getSeed() {
        return window.Noise?.getSeed() ?? null;
    }

    /**
     * Check whether the overworld is currently active (vs local map).
     */
    function getIsActive() {
        return isActive;
    }

    function toggleEncounters() {
        encountersEnabled = !encountersEnabled;
        return encountersEnabled;
    }

    function toggleFog() {
        fogEnabled = !fogEnabled;
        render();
        return fogEnabled;
    }

    function revealAllTiles() {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            for (let x = 0; x < WORLD_WIDTH; x++) {
                revealedTiles.add(`${x},${y}`);
            }
        }
        render();
    }

    return {
        init,
        show,
        hide,
        enterRegion,
        exitRegion,
        placeSettlement,
        getRegionBiome,
        getPlayerPosition,
        getSeed,
        getIsActive,
        render,
        toggleEncounters,
        toggleFog,
        revealAllTiles,
        isEncountersEnabled: () => encountersEnabled,
        isFogEnabled: () => fogEnabled
    };
})();

window.WorldMap = WorldMap;
