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

    // Direction of last move: 'up','down','left','right'
    let lastMoveDir = 'down';

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

        // Territory action buttons (claim / collect / fast travel)
        setupTerritoryButtons();

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
        if (window.TimeSystem?.isPaused) { showPausedFeedback(); return false; }
        if (newX < 0 || newX >= WORLD_WIDTH || newY < 0 || newY >= WORLD_HEIGHT) return false;

        const tile = regionGrid[newY][newX];
        if (!tile.walkable) {
            showBlockedFeedback();
            return false;
        }

        // Track direction of movement
        const dx = newX - playerPos.x;
        const dy = newY - playerPos.y;
        if      (dy < 0) lastMoveDir = 'up';
        else if (dy > 0) lastMoveDir = 'down';
        else if (dx < 0) lastMoveDir = 'left';
        else if (dx > 0) lastMoveDir = 'right';

        playerPos = { x: newX, y: newY };

        // Reveal surrounding tiles
        revealAroundPlayer();

        // Advance time by travel cost — worn roads are faster
        const roadMult = window.RegionManager
            ? RegionManager.getTravelCostMultiplier(newX, newY)
            : 1;
        const cost = Math.round((tile.travelCost || 1) * roadMult * 10) / 10;
        if (window.TimeSystem) {
            TimeSystem.advanceDays(cost);
        }

        // This pass wears the road in a little more
        if (window.RegionManager) {
            RegionManager.addRoadWear(newX, newY, tile.biome);
        }

        // Fast-forward the living world and report threat changes
        if (window.RegionManager) {
            const threatNews = RegionManager.simulateAll();
            if (window.ActivityLog) {
                threatNews.slice(0, 3).forEach(msg => ActivityLog.addMessage(msg, 'warning'));
            }
        }

        // Check for random journey encounter
        if (encountersEnabled) checkJourneyEncounter(tile);

        // Keep camera centered on player
        centerCameraOnPlayer();

        // Save state
        saveToGameState({ playerPos });

        // Re-render
        render();

        // Update info panel + territory action buttons
        updateInfoPanel(tile);
        updateTerritoryButtons();

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
        if (window.TimeSystem?.isPaused) { showPausedFeedback(); return; }
        const tile = regionGrid[playerPos.y][playerPos.x];

        // If this is the settlement tile, prompt to enter camp
        if (settlementPos && playerPos.x === settlementPos.x && playerPos.y === settlementPos.y) {
            showOverworldEnterCampPrompt();
            return;
        }

        if (window.ActivityLog) {
            const biome = BIOME_CONFIG[tile.biome] || BIOME_CONFIG.plains;
            ActivityLog.addMessage(`Exploring ${biome.name} region at (${playerPos.x}, ${playerPos.y})...`, 'info');
        }

        // Tell LocalMap (local map system) which region we're entering
        if (window.LocalMap) {
            LocalMap.enterRegion(playerPos.x, playerPos.y, tile.biome, lastMoveDir);
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

    /**
     * Show a prompt asking the player if they want to enter their camp.
     * Handles enter/leave camp entirely from the overworld context.
     */
    function showOverworldEnterCampPrompt() {
        const modal = document.getElementById('enter-camp-modal');
        if (!modal) return;

        modal.style.display = 'flex';

        const yesBtn = document.getElementById('enter-camp-yes-btn');
        const noBtn  = document.getElementById('enter-camp-no-btn');
        const newYes = yesBtn.cloneNode(true);
        const newNo  = noBtn.cloneNode(true);
        yesBtn.replaceWith(newYes);
        noBtn.replaceWith(newNo);

        newYes.addEventListener('click', () => {
            modal.style.display = 'none';
            enterOverworldCamp();
        });
        newNo.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        const keyHandler = (e) => {
            if (e.key === 'Enter') {
                modal.style.display = 'none';
                document.removeEventListener('keydown', keyHandler);
                enterOverworldCamp();
            } else if (e.key === 'Escape') {
                modal.style.display = 'none';
                document.removeEventListener('keydown', keyHandler);
            }
        };
        document.addEventListener('keydown', keyHandler);
    }

    function enterOverworldCamp() {
        const character = window.GameState?.getState()?.character;
        if (!character) return;

        character.inSettlement = true;

        if (window.TimeSystem) TimeSystem.setInSettlement(true);
        if (window.TabManager) TabManager.updateSettlementTabVisibility();
        if (window.Research?.onSettlementEnter) Research.onSettlementEnter();

        // Show the settlement overlay centered over the overworld canvas
        const overlay = document.getElementById('in-settlement-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            const btn = document.getElementById('leave-camp-btn');
            if (btn) btn.onclick = leaveOverworldCamp;
        }

        render();
        if (window.SaveSystem) SaveSystem.save();
        if (window.ActivityLog) ActivityLog.addMessage('Entered camp.', 'info');
    }

    function leaveOverworldCamp() {
        const character = window.GameState?.getState()?.character;
        if (!character) return;

        character.inSettlement = false;

        if (window.TimeSystem) TimeSystem.setInSettlement(false);
        if (window.TabManager) TabManager.updateSettlementTabVisibility();
        if (window.Research?.onSettlementLeave) Research.onSettlementLeave();

        // Hide the settlement overlay
        const overlay = document.getElementById('in-settlement-overlay');
        if (overlay) overlay.style.display = 'none';

        render();
        if (window.SaveSystem) SaveSystem.save();
        if (window.ActivityLog) ActivityLog.addMessage('Left camp.', 'info');
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

        // Settling a region certainly counts as exploring it
        if (window.RegionManager) {
            RegionManager.visitRegion(settlementPos.x, settlementPos.y, tile.biome);
        }

        // Also set camp in the legacy LocalMap system so settlement tab works
        if (window.LocalMap) {
            LocalMap.setOverworldCamp(settlementPos);
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

        // Fast-forward the living world (returning from a region / settlement)
        if (window.RegionManager) {
            const threatNews = RegionManager.simulateAll();
            if (window.ActivityLog) {
                threatNews.slice(0, 3).forEach(msg => ActivityLog.addMessage(msg, 'warning'));
            }
        }

        // Refresh info panel + territory buttons for the current tile
        const currentTile = regionGrid[playerPos.y]?.[playerPos.x];
        if (currentTile) updateInfoPanel(currentTile);
        updateTerritoryButtons();

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

    // ─── Territory actions (Living Frontier Phase 3) ─────────────────────────

    /**
     * Show/hide the claim, collect, and fast-travel buttons based on the
     * tile the player is standing on.
     */
    function updateTerritoryButtons() {
        const claimBtn   = document.getElementById('overworld-claim-btn');
        const collectBtn = document.getElementById('overworld-collect-btn');
        const travelBtn  = document.getElementById('overworld-fast-travel-btn');
        if (!window.RegionManager) return;

        const record = RegionManager.peekRegion(playerPos.x, playerPos.y);
        const isSettlementTile = settlementPos && playerPos.x === settlementPos.x && playerPos.y === settlementPos.y;

        if (claimBtn) {
            const canClaim = record && record.state === 'cleared' && !record.outpost && settlementPos;
            claimBtn.style.display = canClaim ? 'block' : 'none';
        }
        if (collectBtn) {
            const hasStock = record?.outpost && Object.keys(record.outpost.stockpile || {})
                .some(id => (record.outpost.stockpile[id] || 0) >= 1);
            collectBtn.style.display = hasStock ? 'block' : 'none';
        }
        if (travelBtn) {
            // Fast travel from any domain tile, if there's somewhere else to go
            const onDomainTile = isSettlementTile || !!record?.outpost;
            const destinations = getFastTravelDestinations();
            travelBtn.style.display = (onDomainTile && destinations.length > 0) ? 'block' : 'none';
        }
    }

    function claimCurrentRegion() {
        if (!window.RegionManager) return;
        const result = RegionManager.claimRegion(playerPos.x, playerPos.y);
        if (result.ok) {
            const record = RegionManager.peekRegion(playerPos.x, playerPos.y);
            if (window.ActivityLog) {
                ActivityLog.addMessage(`Outpost established in ${record.name}! Assign settlers on the Settlement → Territory tab.`, 'success');
            }
            if (window.NotificationManager) {
                NotificationManager.showNotification({
                    type: 'success',
                    icon: '🏕️',
                    title: 'Region Claimed!',
                    message: record.name,
                    description: 'Your domain grows — and so does the world\'s attention.'
                });
            }
            if (window.Settlement) Settlement.updateUI();
            if (window.SaveSystem) SaveSystem.save();
        } else if (window.ActivityLog) {
            ActivityLog.addMessage(`Cannot claim: ${result.reason}`, 'warning');
        }
        render();
        updateTerritoryButtons();
        const tile = regionGrid[playerPos.y]?.[playerPos.x];
        if (tile) updateInfoPanel(tile);
    }

    function collectCurrentStockpile() {
        if (!window.RegionManager) return;
        const result = RegionManager.collectStockpile(playerPos.x, playerPos.y);
        if (result.ok) {
            const parts = Object.keys(result.collected).map(id => `+${result.collected[id]} ${id}`);
            if (window.ActivityLog) {
                ActivityLog.addMessage(parts.length > 0
                    ? `Hauled stockpile home: ${parts.join(', ')}`
                    : 'Stockpile collected (settlement storage is full).', 'loot');
            }
            if (window.Settlement) Settlement.updateUI();
            if (window.SaveSystem) SaveSystem.save();
        }
        updateTerritoryButtons();
        const tile = regionGrid[playerPos.y]?.[playerPos.x];
        if (tile) updateInfoPanel(tile);
    }

    /**
     * Domain tiles the player can fast-travel to (excluding where they stand).
     */
    function getFastTravelDestinations() {
        if (!window.RegionManager) return [];
        const destinations = [];

        if (settlementPos && !(playerPos.x === settlementPos.x && playerPos.y === settlementPos.y)) {
            const s = window.GameState?.getState()?.settlement;
            destinations.push({ x: settlementPos.x, y: settlementPos.y, name: `⛺ ${s?.name || 'Settlement'}` });
        }
        for (const rec of RegionManager.getClaimedRegions()) {
            if (rec.x === playerPos.x && rec.y === playerPos.y) continue;
            const tierIcon = RegionManager.getOutpostTiers()[rec.outpost.tier].icon;
            destinations.push({ x: rec.x, y: rec.y, name: `${tierIcon} ${rec.name}` });
        }
        return destinations;
    }

    /**
     * Fast travel between domain tiles: half travel time along known roads,
     * no random encounters.
     */
    function showFastTravelMenu() {
        if (window.TimeSystem?.isPaused) { showPausedFeedback(); return; }
        const destinations = getFastTravelDestinations();
        if (destinations.length === 0) return;

        // Remove any existing menu
        document.getElementById('fast-travel-menu')?.remove();

        const menu = document.createElement('div');
        menu.id = 'fast-travel-menu';
        menu.className = 'fast-travel-menu';

        const title = document.createElement('div');
        title.className = 'fast-travel-title';
        title.textContent = '🐎 Fast Travel';
        menu.appendChild(title);

        destinations.forEach(dest => {
            const dist = Math.max(Math.abs(dest.x - playerPos.x), Math.abs(dest.y - playerPos.y));
            const days = Math.round(dist * 0.5 * 10) / 10;
            const btn = document.createElement('button');
            btn.className = 'fast-travel-option';
            btn.textContent = `${dest.name} — ${days} day${days !== 1 ? 's' : ''}`;
            btn.addEventListener('click', () => {
                menu.remove();
                fastTravelTo(dest, days);
            });
            menu.appendChild(btn);
        });

        const cancel = document.createElement('button');
        cancel.className = 'fast-travel-option fast-travel-cancel';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => menu.remove());
        menu.appendChild(cancel);

        const container = document.getElementById('overworld-view');
        (container || document.body).appendChild(menu);
    }

    function fastTravelTo(dest, days) {
        playerPos = { x: dest.x, y: dest.y };
        revealAroundPlayer();
        if (window.TimeSystem) TimeSystem.advanceDays(days);
        if (window.RegionManager) {
            const threatNews = RegionManager.simulateAll();
            if (window.ActivityLog) {
                threatNews.slice(0, 3).forEach(msg => ActivityLog.addMessage(msg, 'warning'));
            }
        }
        centerCameraOnPlayer();
        saveToGameState({ playerPos });
        render();
        const tile = regionGrid[playerPos.y]?.[playerPos.x];
        if (tile) updateInfoPanel(tile);
        updateTerritoryButtons();
        updateExploreButton();
        if (window.ActivityLog) {
            ActivityLog.addMessage(`Fast traveled to ${dest.name} (${days} days).`, 'info');
        }
    }

    function updateInfoPanel(tile) {
        const panel = document.getElementById('overworld-info');
        if (!panel) return;

        const biome = BIOME_CONFIG[tile.biome] || BIOME_CONFIG.plains;

        // Worn roads lower the effective travel cost
        let cost = 'Impassable';
        if (tile.travelCost) {
            const mult = window.RegionManager ? RegionManager.getTravelCostMultiplier(tile.x, tile.y) : 1;
            const effective = Math.round(tile.travelCost * mult * 10) / 10;
            cost = `${effective} day${effective !== 1 ? 's' : ''}`;
            if (mult < 1) cost += ' 🛤️';
        }

        const isSettlement = settlementPos && tile.x === settlementPos.x && tile.y === settlementPos.y;

        // Living Frontier region info (name/richness/state once explored)
        let regionHtml = '';
        if (tile.walkable && window.RegionManager) {
            const info = RegionManager.getRegionInfo(tile.x, tile.y);
            if (info) {
                const stars = '★'.repeat(info.richness) + '☆'.repeat(5 - info.richness);
                const visitText = info.daysSinceVisit === 0
                    ? 'visited today'
                    : `visited ${info.daysSinceVisit} day${info.daysSinceVisit !== 1 ? 's' : ''} ago`;

                let threatHtml = '';
                if (info.nestLevel > 0) {
                    threatHtml = `<span class="overworld-info-threat">💀 Raider nest (Lv ${info.nestLevel})</span>`;
                } else if (info.state === 'cleared') {
                    threatHtml = '<span class="overworld-info-cleared">🛡 Cleared — claim it before the wild returns</span>';
                }

                let outpostHtml = '';
                if (info.outpost) {
                    const stock = Object.keys(info.outpost.stockpile)
                        .map(id => `${Math.floor(info.outpost.stockpile[id])} ${id}`)
                        .filter(s => !s.startsWith('0 '))
                        .join(', ');
                    outpostHtml = `<span class="overworld-info-outpost">${info.outpost.icon} ${info.outpost.tierName} — ${info.outpost.workers}/${info.outpost.workerCap} workers${stock ? ` | 📦 ${stock}` : ''}</span>`;
                }

                regionHtml = `
                    <span class="overworld-info-name">${info.name}</span>
                    <span class="overworld-info-richness" title="Resource richness">${stars}</span>
                    ${outpostHtml}
                    ${threatHtml}
                    <span class="overworld-info-visited">${visitText}</span>
                `;
            } else {
                regionHtml = '<span class="overworld-info-name overworld-info-uncharted">Uncharted</span>';
            }
        }

        // Looming-threat banner: a maxed nest near the domain
        let bannerHtml = '';
        if (window.RegionManager) {
            const looming = RegionManager.getLoomingThreat();
            if (looming) {
                bannerHtml = `<span class="overworld-threat-banner">⚠️ A raider nest festers in ${looming.name} — clear it before it grows bolder!</span>`;
            }
        }

        panel.innerHTML = `
            ${bannerHtml}
            <span class="overworld-info-biome">${biome.icon} ${biome.name}</span>
            ${regionHtml}
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

    let pausedMessageTimeout = null;
    let pausedMessageVisible = false;

    function showPausedFeedback() {
        pausedMessageVisible = true;
        if (pausedMessageTimeout) clearTimeout(pausedMessageTimeout);
        pausedMessageTimeout = setTimeout(() => {
            pausedMessageVisible = false;
            pausedMessageTimeout = null;
            // Trigger a redraw to clear the message
            if (canvas && ctx) render();
        }, 2000);
        // Draw immediately
        if (canvas && ctx) {
            drawPausedMessage();
        }
    }

    function drawPausedMessage() {
        if (!pausedMessageVisible || !canvas || !ctx) return;
        const msg = 'Cannot travel while game is paused!';
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        const pad = 18;
        ctx.save();
        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(msg).width + pad * 2;
        const h = 48;
        // Background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        const rx = x - w / 2, ry = y - h / 2;
        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 8);
        ctx.fill();
        ctx.stroke();
        // Text
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(msg, x, y);
        ctx.restore();
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

        // Click + cursor handlers for canvas-drawn buttons (e.g. Leave Camp)
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width  / rect.width;
            const scaleY = canvas.height / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            const cy = (e.clientY - rect.top)  * scaleY;
            const btn = canvas._leaveCampBtn;
            if (btn && cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
                leaveOverworldCamp();
            }
        });
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width  / rect.width;
            const scaleY = canvas.height / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            const cy = (e.clientY - rect.top)  * scaleY;
            const btn = canvas._leaveCampBtn;
            if (btn && cx >= btn.x && cx <= btn.x + btn.w && cy >= btn.y && cy <= btn.y + btn.h) {
                canvas.style.cursor = 'pointer';
            } else {
                canvas.style.cursor = 'default';
            }
        });
    }

    function setupTerritoryButtons() {
        const claimBtn   = document.getElementById('overworld-claim-btn');
        const collectBtn = document.getElementById('overworld-collect-btn');
        const travelBtn  = document.getElementById('overworld-fast-travel-btn');

        if (claimBtn)   claimBtn.addEventListener('click', claimCurrentRegion);
        if (collectBtn) collectBtn.addEventListener('click', collectCurrentStockpile);
        if (travelBtn)  travelBtn.addEventListener('click', showFastTravelMenu);
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
                // Returning to the map tab resizes the container — refresh the
                // context-sensitive UI too (stockpiles may have grown, regions
                // may have been claimed from the settlement tab, etc.)
                updateTerritoryButtons();
                const tile = regionGrid[playerPos.y]?.[playerPos.x];
                if (tile) updateInfoPanel(tile);
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

        // Dim the map and draw Leave Camp button when in camp
        const character = window.GameState?.getState()?.character;
        if (character?.inSettlement) {
            // Dim
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw Leave Camp button centered on canvas
            const dpr = window.devicePixelRatio || 1;
            const btnW = 200 * dpr, btnH = 50 * dpr;
            const btnX = (canvas.width  - btnW) / 2;
            const btnY = (canvas.height - btnH) / 2;
            const radius = 8 * dpr;

            ctx.fillStyle = '#dc2626';
            ctx.beginPath();
            ctx.roundRect(btnX, btnY, btnW, btnH, radius);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${18 * dpr}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Leave Camp', canvas.width / 2, canvas.height / 2);
            ctx.textAlign = 'start';
            ctx.textBaseline = 'alphabetic';

            // Store button bounds for click detection
            canvas._leaveCampBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
        } else {
            canvas._leaveCampBtn = null;
        }

        // Draw paused message overlay if active
        drawPausedMessage();
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
                    MapRenderer.drawFog(ctx, px, py, tileSize);
                    continue;
                }

                // Draw biome terrain
                MapRenderer.drawTerrain(ctx, px, py, tileSize, biome);

                // Draw biome icon if tile is large enough
                if (tileSize >= 20) {
                    MapRenderer.drawIcon(ctx, px, py, tileSize, biome, 0.55);
                }

                // Region state markers (Living Frontier)
                if (tile.walkable && window.RegionManager) {
                    const record = RegionManager.peekRegion(wx, wy);

                    // Worn road marker (faint track dot), even on pass-through tiles
                    if (record && (record.roadWear || 0) >= 5 && !record.outpost) {
                        ctx.fillStyle = `rgba(160, 120, 70, ${Math.min(0.75, 0.25 + record.roadWear * 0.02)})`;
                        const rw = Math.max(tileSize * 0.16, 4);
                        ctx.fillRect(px + (tileSize - rw) / 2, py + (tileSize - rw) / 2, rw, rw);
                    }

                    // Claimed region: outpost icon + golden domain border
                    if (record && record.outpost) {
                        const tierDef = RegionManager.getOutpostTiers()[record.outpost.tier];
                        if (tileSize >= 16) {
                            MapRenderer.drawIcon(ctx, px, py, tileSize, { icon: tierDef.icon }, 0.6);
                        }
                        ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
                    }

                    if (record && record.state !== 'wild') {
                        // Explored: small white dot / Cleared: green dot (top-right)
                        ctx.fillStyle = record.state === 'cleared'
                            ? 'rgba(74, 222, 128, 0.9)'
                            : 'rgba(255, 255, 255, 0.75)';
                        const r = Math.max(tileSize * 0.08, 2);
                        ctx.beginPath();
                        ctx.arc(px + tileSize - r * 2, py + r * 2, r, 0, Math.PI * 2);
                        ctx.fill();

                        // Nest threat pips: red squares along the bottom edge,
                        // one per nest level
                        const nestLevel = record.threat?.nestLevel || 0;
                        if (nestLevel > 0) {
                            const pip = Math.max(tileSize * 0.14, 3);
                            ctx.fillStyle = '#ef4444';
                            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
                            ctx.lineWidth = 1;
                            for (let i = 0; i < nestLevel; i++) {
                                const pipX = px + 2 + i * (pip + 2);
                                const pipY = py + tileSize - pip - 2;
                                ctx.fillRect(pipX, pipY, pip, pip);
                                ctx.strokeRect(pipX, pipY, pip, pip);
                            }
                        }
                    }
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

        const tx = vx * tileSize;
        const ty = vy * tileSize;
        const px = tx + tileSize / 2;
        const py = ty + tileSize / 2;

        // Grey background + golden domain border
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(tx, ty, tileSize, tileSize);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx + 1, ty + 1, tileSize - 2, tileSize - 2);

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

            // Don't move if in settlement
            const character = window.GameState?.getState()?.character;
            if (character && character.inSettlement) return;

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

        if (delta.seed              !== undefined) world.seed               = delta.seed;
        if (delta.playerPos         !== undefined) world.overworldPos        = delta.playerPos;
        if (delta.settlementPos     !== undefined) world.overworldSettlement = delta.settlementPos;
        if (delta.encountersEnabled !== undefined) world.encountersEnabled   = delta.encountersEnabled;

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

        if (world.encountersEnabled !== undefined) {
            encountersEnabled = world.encountersEnabled;
        }

        if (Array.isArray(world.revealedTiles)) {
            revealedTiles = new Set(world.revealedTiles);
        }

        // Always reveal current position on load
        revealAroundPlayer();

        // Restore in-settlement UI state if player was in camp on save
        const character = window.GameState?.getState()?.character;
        if (character?.inSettlement) {
            const overlay = document.getElementById('in-settlement-overlay');
            if (overlay) {
                overlay.style.display = 'flex';
                const btn = document.getElementById('leave-camp-btn');
                if (btn) btn.onclick = leaveOverworldCamp;
            }
        }
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
        saveToGameState({ encountersEnabled });
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
