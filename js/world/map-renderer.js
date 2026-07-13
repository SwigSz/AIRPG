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
     * Draw a terrain tile (full square).
     */
    function drawTerrain(ctx, px, py, size, visual) {
        if (hasSprite(visual)) {
            const s = tileset.atlas[visual.sprite];
            ctx.drawImage(tileset.image, s.x, s.y, s.w, s.h, px, py, size, size);
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
            const iconSize = size * Math.max(scale, 0.5);
            const off = (size - iconSize) / 2;
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
        drawTerrain,
        drawIcon,
        drawFog,
        drawTint,
        isUsingTileset: () => tileset !== null
    };
})();

window.MapRenderer = MapRenderer;
