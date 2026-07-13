// ============================================
// Map Renderer — drawing abstraction for both map layers
// ============================================
//
// Single place where tiles/icons hit the canvas. Today it renders the
// colored-tile + emoji fallback; when a sprite tileset is adopted, calling
// setTileset() switches every draw call to sprites with NO changes to game
// logic (map.js / world-map.js just pass their visual config objects).
//
// A "visual" object is any config with optional fields:
//   { color: '#2d5016', icon: '🌲', sprite: 'terrain/forest' }
// - color  → used for terrain fill fallback
// - icon   → emoji drawn for nodes/markers fallback
// - sprite → atlas key; used automatically once a tileset is loaded

const MapRenderer = (() => {
    'use strict';

    // Loaded tileset: { image: HTMLImageElement, atlas: { key: {x,y,w,h} } }
    let tileset = null;

    // ─── Default tileset: Kenney Roguelike/RPG pack (CC0) ───────────────────
    // 16px tiles with 1px spacing → tile (col,row) is at (col*17, row*17).
    const T = (c, r) => ({ x: c * 17, y: r * 17, w: 16, h: 16 });

    const DEFAULT_TILESET_URL = 'assets/sprites/roguelike-sheet.png';
    const DEFAULT_ATLAS = {
        // Terrain bases — only SEAMLESS fill tiles here. Distinct biomes are
        // made with tints + icons over seamless ground, never "slab" tiles
        // with baked-in edges (those plaid badly when tiled).
        'terrain/plains':   T(5, 0),    // light grass (seamless)
        'terrain/forest':   T(5, 0),    // grass base; tint + trees make the forest
        'terrain/desert':   T(2, 26),   // sand (seamless)
        'terrain/tundra':   T(45, 26),  // snow (seamless)
        'terrain/swamp':    T(6, 0),    // muddy bog (seamless)
        'terrain/water':    T(16, 28),  // water (seamless)
        'terrain/mountain': T(6, 0),    // dirt base; grey tint + rock pile icon

        // Resource nodes
        'node/tree':        T(16, 9),   // pine
        'node/stick_bush':  T(21, 9),   // round bush
        'node/berry_bush':  T(19, 9),   // hedge bush
        'node/fiber_plant': T(22, 10),  // sprout
        'node/rock':        T(53, 21),  // tan rock pile (quarry)
        'node/stone':       T(54, 21),  // grey rock pile (loose stones)
        'node/copper_ore':  T(45, 10),  // ore nuggets

        // Markers
        'marker/nest':      T(50, 0),   // raider banner
        'marker/grave':     T(52, 9)    // headstone
    };

    /**
     * Load the bundled default tileset (Kenney Roguelike/RPG pack).
     */
    function loadDefaultTileset() {
        return setTileset(DEFAULT_TILESET_URL, DEFAULT_ATLAS);
    }

    /**
     * Load a sprite tileset. Draw calls with a matching `sprite` key switch
     * to sprites automatically.
     * @param {string} imageUrl - spritesheet image URL
     * @param {Object} atlas - map of sprite key -> {x, y, w, h} source rect
     * @returns {Promise} resolves when the image is loaded
     */
    function setTileset(imageUrl, atlas) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                tileset = { image, atlas };
                resolve();
            };
            image.onerror = reject;
            image.src = imageUrl;
        });
    }

    function hasSprite(visual) {
        return tileset && visual && visual.sprite && tileset.atlas[visual.sprite];
    }

    /**
     * Draw a terrain tile (full square). A visual may carry a `tint`
     * (rgba string) drawn over the sprite — used to differentiate biomes
     * that share a seamless base tile.
     */
    function drawTerrain(ctx, px, py, size, visual) {
        if (hasSprite(visual)) {
            const s = tileset.atlas[visual.sprite];
            ctx.imageSmoothingEnabled = false; // crisp pixel art
            // +0.5 overdraw hides sub-pixel seams between scaled tiles
            ctx.drawImage(tileset.image, s.x, s.y, s.w, s.h, px, py, size + 0.5, size + 0.5);
            if (visual.tint) {
                ctx.fillStyle = visual.tint;
                ctx.fillRect(px, py, size + 0.5, size + 0.5);
            }
            return;
        }
        ctx.fillStyle = (visual && visual.color) || '#000000';
        ctx.fillRect(px, py, size, size);
    }

    /**
     * Draw an icon (resource node, encounter, marker) centered on a tile.
     * @param {number} scale - icon size relative to tile size (default 0.55)
     */
    function drawIcon(ctx, px, py, size, visual, scale = 0.55) {
        if (hasSprite(visual)) {
            const s = tileset.atlas[visual.sprite];
            const iconSize = size * Math.max(scale, 0.6);
            const off = (size - iconSize) / 2;
            ctx.imageSmoothingEnabled = false; // crisp pixel art
            ctx.drawImage(tileset.image, s.x, s.y, s.w, s.h, px + off, py + off, iconSize, iconSize);
            return;
        }
        if (!visual || !visual.icon) return;
        const iconSize = Math.max(size * scale, 12);
        ctx.font = `${iconSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(visual.icon, px + size / 2, py + size / 2);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    /**
     * Draw an unexplored (fogged) tile.
     */
    function drawFog(ctx, px, py, size) {
        ctx.fillStyle = '#0a0f1a';
        ctx.fillRect(px, py, size, size);
    }

    /**
     * Draw a translucent tint over a tile (resource/encounter backgrounds).
     */
    function drawTint(ctx, px, py, size, color, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, size, size);
        ctx.restore();
    }

    return {
        setTileset,
        loadDefaultTileset,
        drawTerrain,
        drawIcon,
        drawFog,
        drawTint,
        isUsingTileset: () => tileset !== null
    };
})();

window.MapRenderer = MapRenderer;
