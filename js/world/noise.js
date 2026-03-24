/**
 * Seedable Perlin Noise
 * Deterministic noise generation for procedural world generation.
 * Same seed always produces the same output.
 */

const Noise = (() => {
    'use strict';

    // Seeded pseudo-random number generator (mulberry32)
    function createRNG(seed) {
        let s = seed >>> 0;
        return function() {
            s += 0x6D2B79F5;
            let t = Math.imul(s ^ s >>> 15, 1 | s);
            t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // Build a seeded permutation table (512 entries for wrapping)
    function buildPermTable(seed) {
        const rng = createRNG(seed);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;

        // Fisher-Yates shuffle with seeded RNG
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [p[i], p[j]] = [p[j], p[i]];
        }

        // Double the table for wrapping
        const perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
        return perm;
    }

    // Gradient vectors for 2D Perlin
    const GRADS = [
        [1, 1], [-1, 1], [1, -1], [-1, -1],
        [1, 0], [-1, 0], [0, 1], [0, -1]
    ];

    function grad(hash, x, y) {
        const g = GRADS[hash & 7];
        return g[0] * x + g[1] * y;
    }

    function fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    function lerp(a, b, t) {
        return a + t * (b - a);
    }

    // Active permutation table
    let perm = null;
    let currentSeed = null;

    /**
     * Set the seed for noise generation.
     * Must be called before using noise2D.
     */
    function setSeed(seed) {
        // Convert string seeds to number
        if (typeof seed === 'string') {
            let h = 0;
            for (let i = 0; i < seed.length; i++) {
                h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
            }
            seed = h >>> 0;
        }
        currentSeed = seed;
        perm = buildPermTable(seed);
    }

    /**
     * Sample 2D Perlin noise at (x, y).
     * Returns a value in roughly [-1, 1].
     * Call setSeed() before using this.
     */
    function noise2D(x, y) {
        if (!perm) {
            console.warn('Noise: no seed set, using default seed 0');
            setSeed(0);
        }

        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);

        const u = fade(xf);
        const v = fade(yf);

        const aa = perm[perm[X] + Y];
        const ab = perm[perm[X] + Y + 1];
        const ba = perm[perm[X + 1] + Y];
        const bb = perm[perm[X + 1] + Y + 1];

        return lerp(
            lerp(grad(aa, xf, yf),     grad(ba, xf - 1, yf),     u),
            lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
            v
        );
    }

    /**
     * Fractional Brownian Motion — layered noise for more natural terrain.
     * @param {number} x
     * @param {number} y
     * @param {number} octaves - Number of noise layers (more = more detail)
     * @param {number} persistence - How much each octave contributes (0-1)
     * @param {number} lacunarity - How frequency increases per octave
     * @returns {number} Value in roughly [-1, 1]
     */
    function fbm(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
        let value = 0;
        let amplitude = 1;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        return value / maxValue; // Normalize to [-1, 1]
    }

    /**
     * Get a normalized fbm value in [0, 1] range.
     */
    function fbm01(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
        return (fbm(x, y, octaves, persistence, lacunarity) + 1) / 2;
    }

    /**
     * Get current seed
     */
    function getSeed() {
        return currentSeed;
    }

    return {
        setSeed,
        getSeed,
        noise2D,
        fbm,
        fbm01
    };
})();

window.Noise = Noise;
