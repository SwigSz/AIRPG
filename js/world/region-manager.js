// ============================================
// Region Manager — Living Frontier region state
// ============================================
//
// Owns the persistent, evolving state of every overworld region
// (see docs/MAP-DESIGN.md). Phase 1 scope:
//   - Region records: seeded name, richness, lifecycle state, visit tracking
//   - Lazy simulation: regions fast-forward when accessed (regrowth for now;
//     nests/threat arrive in Phase 2)
//   - Regrow-aware resource deltas (replaces the old "amount: 0 forever" model)
//   - Local fog-of-war persistence per region
//
// Record shape (stored in GameState.world.regions["x,y"]):
//   {
//     v: 2,                        // record version (v1 = legacy format)
//     name: "Thornwood",           // seeded, biome-flavored
//     richness: 3,                 // 1-5, seeded
//     state: "explored",           // wild | explored | (cleared/claimed in Phase 3)
//     firstVisitDay: 12,
//     lastVisitDay: 40,
//     lastSimDay: 40,              // lazy-sim anchor
//     resourceDeltas: {            // ONLY tiles that differ from generated base
//       "7,3": { type: "tree", amount: 0, harvestedOnDay: 39 }
//     },
//     revealedTiles: ["10,10", ...] // local fog of war
//   }

const RegionManager = (() => {
    'use strict';

    const RECORD_VERSION = 2;

    // Days for a harvested node to fully regrow. null = never regrows.
    const REGROW_DAYS = {
        tree: 20,
        stick_bush: 8,
        berry_bush: 6,
        fiber_plant: 6,
        stone: 25,
        rock: null,        // quarries don't regrow
        copper_ore: null   // ore veins don't regrow
    };

    // ─── Outpost configuration (Living Frontier Phase 3) ────────────────────
    // Outposts are built in CLEARED regions. Tier gates autonomy:
    //   T1 Camp       — workers gather into a local stockpile; visit to haul
    //   T2 Waystation — auto-hauls to the settlement daily (roads speed it up)
    //   T3 Holdfast   — best cap + suppresses nest spawns within 2 regions
    const OUTPOST = {
        tiers: {
            1: { name: 'Camp',       icon: '🏕️', workerCap: 2, cost: { wood: 15, stone: 5 } },
            2: { name: 'Waystation', icon: '🛖', workerCap: 4, cost: { wood: 30, stone: 20 } },
            3: { name: 'Holdfast',   icon: '🏰', workerCap: 6, cost: { wood: 60, stone: 40 } }
        },
        STOCKPILE_CAP_PER_TIER: 100,   // max units per resource in the stockpile
        AUTO_HAUL_BASE: 0.35,          // T2+: fraction of stockpile hauled per day...
        AUTO_HAUL_ROAD_BONUS: 0.02,    // ...plus this per point of road wear (max +0.4)
        HOLDFAST_PROTECT_RADIUS: 2     // no nest spawns this close to a Holdfast
    };

    // Per-worker, per-day gathering yields by biome (multiplied by richness)
    const OUTPOST_YIELDS = {
        forest:   { wood: 2.0, food: 0.5 },
        plains:   { food: 2.0, wood: 0.5 },
        swamp:    { food: 1.2, wood: 1.0 },
        tundra:   { stone: 1.0, food: 0.5 },
        desert:   { stone: 1.5, clay: 0.5 },
        mountain: { stone: 2.0, iron: 0.3 }
    };

    function richnessMultiplier(richness) {
        return 0.5 + richness * 0.25; // ★1 = 0.75x … ★5 = 1.75x
    }

    // ─── Threat configuration (Living Frontier Phase 2) ─────────────────────
    // Nests spawn in unattended EXPLORED regions near the player's domain,
    // grow over time, and are capped by the world "attention" budget — which
    // scales with domain size, so expansion is the difficulty slider.
    const THREAT = {
        SPAWN_WINDOW_DAYS: 40,        // one deterministic spawn roll per window
        BASE_SPAWN_CHANCE: 0.15,      // per-window chance right next to the domain
        MAX_SPAWN_DIST: 10,           // regions farther than this from the domain stay quiet
        GROWTH_DAYS_PER_LEVEL: 45,    // days for a nest to grow one level
        CLEARED_PROTECTION_DAYS: 60   // cleared regions stay nest-free this long
    };

    // ─── Seeded naming ───────────────────────────────────────────────────────

    const NAME_PARTS = {
        forest:   { pre: ['Thorn', 'Elder', 'Green', 'Moss', 'Wolf', 'Silent', 'Deep', 'Bram', 'Oaken', 'Shade'],
                    suf: ['wood', 'weald', 'grove', 'thicket', 'glen'] },
        plains:   { pre: ['Amber', 'Wind', 'Gold', 'High', 'Broad', 'Long', 'Sun', 'Green', 'Wild', 'Fair'],
                    suf: ['field', 'mead', 'downs', 'reach', 'plain'] },
        desert:   { pre: ['Sun', 'Dust', 'Red', 'Mirage', 'Bone', 'Glass', 'Ash', 'Ember'],
                    suf: [' Wastes', ' Flats', ' Expanse', ' Barrens', ' Dunes'] },
        tundra:   { pre: ['Frost', 'Pale', 'White', 'Grim', 'Winter', 'Hoar', 'Bleak'],
                    suf: [' Fells', ' Wastes', ' Reach', ' Fields', 'fall'] },
        swamp:    { pre: ['Murk', 'Fen', 'Black', 'Mire', 'Grey', 'Rot', 'Bog'],
                    suf: ['fen', 'mire', 'marsh', ' Bogs', 'water'] },
        mountain: { pre: ['Iron', 'Grey', 'Storm', 'Crag', 'Thunder', 'Raven', 'Cold'],
                    suf: [' Peaks', ' Crags', ' Heights', ' Tor', 'horn'] },
        water:    { pre: ['Deep', 'Blue', 'Still', 'Dark'],
                    suf: [' Waters', ' Deep', ' Expanse'] }
    };

    /**
     * Deterministic hash in [0,1) from world seed + coords + salt.
     * Independent of Noise's mutable seed state (which changes per region).
     */
    function hash01(x, y, salt) {
        const seed = window.GameState?.getState()?.world?.seed ?? 0;
        const s = `${seed}|${x}|${y}|${salt}`;
        let h = 2166136261 >>> 0;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        h ^= h >>> 13;
        h = Math.imul(h, 0x5bd1e995);
        h ^= h >>> 15;
        return (h >>> 0) / 4294967296;
    }

    function generateName(x, y, biome) {
        const parts = NAME_PARTS[biome] || NAME_PARTS.plains;
        const pre = parts.pre[Math.floor(hash01(x, y, 'name-pre') * parts.pre.length)];
        const suf = parts.suf[Math.floor(hash01(x, y, 'name-suf') * parts.suf.length)];
        return pre + suf;
    }

    function generateRichness(x, y) {
        // 1-5 stars, weighted toward the middle (2-4 common, 1 and 5 rare)
        const r = hash01(x, y, 'richness');
        if (r < 0.08) return 1;
        if (r < 0.35) return 2;
        if (r < 0.72) return 3;
        if (r < 0.94) return 4;
        return 5;
    }

    // ─── Time ────────────────────────────────────────────────────────────────

    function getCurrentDay() {
        if (window.TimeSystem?.getCurrentTime) {
            return Math.floor(TimeSystem.getCurrentTime() / 24);
        }
        return 0;
    }

    // ─── Record access / migration ───────────────────────────────────────────

    function getRegionsStore() {
        const state = window.GameState?.getState();
        if (!state) return null;
        if (!state.world) state.world = {};
        if (!state.world.regions) state.world.regions = {};
        return state.world.regions;
    }

    /**
     * Get (or create) the region record for (x, y).
     * Migrates legacy v1 records ({visited, resources}) to v2. The legacy
     * resources blob stored `amount: 0` for EVERY empty tile, so it cannot be
     * trusted — migration drops it (one-time replenish of visited regions).
     */
    function getRegion(x, y, biome) {
        const store = getRegionsStore();
        if (!store) return null;

        const key = `${x},${y}`;
        let record = store[key];

        if (record && record.v === RECORD_VERSION) {
            return peekRegion(x, y); // routes through field backfill
        }

        // Build a fresh v2 record, preserving legacy visited status
        const wasVisited = !!(record && record.visited);
        record = {
            v: RECORD_VERSION,
            x, y,
            biome: biome || 'plains',
            name: generateName(x, y, biome || 'plains'),
            richness: generateRichness(x, y),
            state: wasVisited ? 'explored' : 'wild',
            firstVisitDay: wasVisited ? 0 : null,
            lastVisitDay: wasVisited ? 0 : null,
            lastSimDay: getCurrentDay(),
            resourceDeltas: {},
            revealedTiles: [],
            threat: { nestLevel: 0, nestBornDay: null },
            clearedOnDay: null
        };
        store[key] = record;
        return record;
    }

    /**
     * Peek at a region's record without creating one.
     */
    function peekRegion(x, y) {
        const store = getRegionsStore();
        if (!store) return null;
        const record = store[`${x},${y}`];
        if (!record || record.v !== RECORD_VERSION) return null;
        // Backfill fields added after the record was first written
        if (record.x === undefined) { record.x = x; record.y = y; }
        if (!record.threat) record.threat = { nestLevel: 0, nestBornDay: null };
        return record;
    }

    // ─── Domain / world attention ────────────────────────────────────────────

    /**
     * The settlement region (the domain's heart).
     */
    function getDomainCenter() {
        const pos = window.GameState?.getState()?.world?.overworldSettlement;
        return pos ? { x: pos.x, y: pos.y } : null;
    }

    /**
     * All claimed (outpost) region records.
     */
    function getClaimedRegions() {
        const store = getRegionsStore();
        if (!store) return [];
        const claimed = [];
        for (const key of Object.keys(store)) {
            const record = store[key];
            if (record && record.v === RECORD_VERSION && record.outpost) {
                const [x, y] = key.split(',').map(Number);
                claimed.push(peekRegion(x, y));
            }
        }
        return claimed;
    }

    /**
     * Domain = settlement + every claimed region.
     * Returns a list of {x, y} coords.
     */
    function getDomainTiles() {
        const tiles = [];
        const center = getDomainCenter();
        if (center) tiles.push(center);
        for (const rec of getClaimedRegions()) tiles.push({ x: rec.x, y: rec.y });
        return tiles;
    }

    function getDomainSize() {
        return getDomainTiles().length;
    }

    /**
     * Maximum nest level the world's "attention" allows. Scales with domain
     * size so expansion is the difficulty slider (see docs/MAP-DESIGN.md).
     * No domain → no threat at all (pure sandbox until you settle).
     */
    function getThreatCap() {
        const domain = getDomainSize();
        if (domain === 0) return 0;
        if (domain <= 2) return 2;   // small domain: nests stay small
        // Lv3 nests spread satellites. Lv4 (raids) unlocks when the raid/siege
        // system ships — the design is still being workshopped.
        return 3;
    }

    function distanceToDomain(x, y) {
        const tiles = getDomainTiles();
        if (tiles.length === 0) return null;
        let best = Infinity;
        for (const t of tiles) {
            // Chebyshev distance (diagonal counts as 1)
            const d = Math.max(Math.abs(x - t.x), Math.abs(y - t.y));
            if (d < best) best = d;
        }
        return best;
    }

    /**
     * Global concurrent-nest budget — the literal "world attention" limit.
     * The world only prosecutes so many fronts at once, so clearing a nest
     * can never leave you facing a pile that spawned meanwhile.
     * Domain 1-2 → 1 nest at a time, 3-5 → 2, 6-8 → 3, capped at 4.
     */
    function getMaxActiveNests() {
        const domain = getDomainSize();
        if (domain === 0) return 0;
        return Math.min(4, 1 + Math.floor(domain / 3));
    }

    function countActiveNests() {
        const store = getRegionsStore();
        if (!store) return 0;
        let count = 0;
        for (const key of Object.keys(store)) {
            const record = store[key];
            if (record && record.v === RECORD_VERSION && record.threat?.nestLevel > 0) {
                count++;
            }
        }
        return count;
    }

    /**
     * Is (x, y) inside a Holdfast's protective radius?
     */
    function isHoldfastProtected(x, y) {
        for (const rec of getClaimedRegions()) {
            if (rec.outpost.tier >= 3) {
                const d = Math.max(Math.abs(x - rec.x), Math.abs(y - rec.y));
                if (d <= OUTPOST.HOLDFAST_PROTECT_RADIUS) return true;
            }
        }
        return false;
    }

    // ─── Lazy simulation ─────────────────────────────────────────────────────

    /**
     * Fast-forward a region to the current day.
     * Phase 1: resource regrowth. Phase 2: cleared-decay + nest spawn/growth.
     */
    function simulate(record) {
        if (!record) return;
        const today = getCurrentDay();
        if (today <= record.lastSimDay) {
            record.lastSimDay = Math.min(record.lastSimDay, today);
            return;
        }
        const fromDay = record.lastSimDay;

        // Regrowth: any harvested node whose regrow window has passed returns
        // to full (its delta is simply removed).
        for (const key of Object.keys(record.resourceDeltas)) {
            const delta = record.resourceDeltas[key];
            const regrowDays = REGROW_DAYS[delta.type];
            if (regrowDays === null || regrowDays === undefined) continue; // never regrows
            const harvestedOn = delta.harvestedOnDay ?? record.lastSimDay;
            if (today - harvestedOn >= regrowDays) {
                delete record.resourceDeltas[key];
            }
        }

        // Cleared protection decays back to explored — the wild creeps back
        if (record.state === 'cleared' && record.clearedOnDay !== null
            && today - record.clearedOnDay >= THREAT.CLEARED_PROTECTION_DAYS) {
            record.state = 'explored';
        }

        // Threat: nest spawning and growth
        simulateThreat(record, fromDay, today);

        // Outpost economy: workers gather, Waystations+ auto-haul
        simulateOutpost(record, fromDay, today);

        record.lastSimDay = today;
    }

    /**
     * Outpost gathering + auto-hauling for one region over [fromDay, today].
     */
    function simulateOutpost(record, fromDay, today) {
        const outpost = record.outpost;
        if (!outpost || outpost.workers <= 0) return;

        const days = today - fromDay;
        if (days <= 0) return;

        const biome = record.biome || 'plains';
        const yields = OUTPOST_YIELDS[biome] || OUTPOST_YIELDS.plains;
        const mult = richnessMultiplier(record.richness);
        const cap = OUTPOST.STOCKPILE_CAP_PER_TIER * outpost.tier;

        if (!outpost.stockpile) outpost.stockpile = {};

        // Gather into the local stockpile
        for (const resourceId of Object.keys(yields)) {
            const gained = yields[resourceId] * mult * outpost.workers * days;
            outpost.stockpile[resourceId] = Math.min(cap, (outpost.stockpile[resourceId] || 0) + gained);
        }

        // Tier 2+: auto-haul a share of the stockpile to the settlement each day.
        // Worn roads increase the haul rate.
        if (outpost.tier >= 2) {
            const roadBonus = Math.min(0.4, (record.roadWear || 0) * OUTPOST.AUTO_HAUL_ROAD_BONUS);
            const dailyRate = Math.min(1, OUTPOST.AUTO_HAUL_BASE + roadBonus);
            // Effective fraction hauled over N days: 1 - (1-rate)^N
            const hauledFraction = 1 - Math.pow(1 - dailyRate, days);
            haulToSettlement(outpost, hauledFraction);
        }
    }

    /**
     * Move a fraction of an outpost's stockpile into settlement resources.
     * Clamps at each resource's base capacity; the remainder stays local.
     */
    function haulToSettlement(outpost, fraction) {
        const settlement = window.GameState?.getState()?.settlement;
        if (!settlement || !settlement.resources || !outpost.stockpile) return;

        for (const resourceId of Object.keys(outpost.stockpile)) {
            const target = settlement.resources[resourceId];
            if (!target) continue;
            const moving = outpost.stockpile[resourceId] * fraction;
            const space = Math.max(0, target.max - target.current);
            const moved = Math.min(moving, space);
            target.current += moved;
            outpost.stockpile[resourceId] -= moved;
            if (outpost.stockpile[resourceId] < 0.01) delete outpost.stockpile[resourceId];
        }
    }

    /**
     * Nest spawn/growth for one region over [fromDay, today].
     * Deterministic: spawn rolls are hashed per (region, time window), so
     * fast-forwarding produces the same outcome regardless of when you look.
     */
    function simulateThreat(record, fromDay, today) {
        if (!record.threat) record.threat = { nestLevel: 0, nestBornDay: null };
        const cap = getThreatCap();
        if (cap === 0) return;                    // no domain, no threat
        if (record.state !== 'explored') return;  // wild = unknown, cleared = protected

        const dist = distanceToDomain(record.x, record.y);
        if (dist === null || dist === 0 || dist > THREAT.MAX_SPAWN_DIST) return;

        // Holdfasts suppress nest spawns in their protective radius
        if (isHoldfastProtected(record.x, record.y)) return;

        const t = record.threat;

        // Spawn roll once per elapsed window, chance falls off with distance.
        // The global nest budget gates NEW spawns (existing nests still grow).
        if (t.nestLevel === 0 && countActiveNests() < getMaxActiveNests()) {
            const chance = THREAT.BASE_SPAWN_CHANCE
                * (1 - (dist - 1) / THREAT.MAX_SPAWN_DIST);
            const startW = Math.floor(fromDay / THREAT.SPAWN_WINDOW_DAYS) + 1;
            const endW = Math.floor(today / THREAT.SPAWN_WINDOW_DAYS);
            for (let w = startW; w <= endW; w++) {
                if (hash01(record.x, record.y, 'nest-spawn-' + w) < chance) {
                    t.nestLevel = 1;
                    t.nestBornDay = w * THREAT.SPAWN_WINDOW_DAYS;
                    break;
                }
            }
        }

        // Growth: one level per GROWTH_DAYS_PER_LEVEL since birth, up to cap
        if (t.nestLevel > 0 && t.nestBornDay !== null) {
            const grown = 1 + Math.floor((today - t.nestBornDay) / THREAT.GROWTH_DAYS_PER_LEVEL);
            t.nestLevel = Math.min(cap, Math.max(t.nestLevel, grown));
        }

        // Lv3 satellite spread: a mature nest seeds ONE Lv1 nest in an
        // adjacent explored, nest-free region (once per nest life)
        if (t.nestLevel >= 3 && !t.spreadDone) {
            const neighbors = [
                [record.x + 1, record.y], [record.x - 1, record.y],
                [record.x, record.y + 1], [record.x, record.y - 1]
            ];
            for (const [nx, ny] of neighbors) {
                const neighbor = peekRegion(nx, ny);
                if (!neighbor || neighbor.state !== 'explored') continue;
                if (neighbor.threat && neighbor.threat.nestLevel > 0) continue;
                if (isHoldfastProtected(nx, ny)) continue;

                neighbor.threat = { nestLevel: 1, nestBornDay: today };
                t.spreadDone = true;
                t.spreadTo = { x: nx, y: ny };
                break;
            }
        }
    }

    /**
     * Fast-forward EVERY known region and report notable threat changes.
     * Called from the overworld (on show/move) — cheap, since regions
     * already at today's date early-exit.
     * @returns {Array<string>} human-readable threat messages
     */
    function simulateAll() {
        const store = getRegionsStore();
        if (!store) return [];

        const messages = [];
        for (const key of Object.keys(store)) {
            const [x, y] = key.split(',').map(Number);
            const record = peekRegion(x, y);
            if (!record || record.state === 'wild') continue;

            const before = record.threat?.nestLevel || 0;
            simulate(record);
            const after = record.threat?.nestLevel || 0;

            if (after > before) {
                if (before === 0) {
                    messages.push(`Scouts report raider activity in ${record.name}!`);
                } else {
                    messages.push(`The raider nest in ${record.name} has grown stronger (Lv ${after}).`);
                }
            }

            // Announce satellite spread once
            if (record.threat?.spreadTo && !record.threat.spreadAnnounced) {
                record.threat.spreadAnnounced = true;
                const child = peekRegion(record.threat.spreadTo.x, record.threat.spreadTo.y);
                if (child) {
                    messages.push(`The nest in ${record.name} has spread to ${child.name}!`);
                }
            }
        }
        return messages;
    }

    // ─── Outpost management (Living Frontier Phase 3) ────────────────────────

    function getSettlementResources() {
        return window.GameState?.getState()?.settlement?.resources || null;
    }

    function canAffordCost(cost) {
        const resources = getSettlementResources();
        if (!resources) return false;
        return Object.keys(cost).every(id => (resources[id]?.current || 0) >= cost[id]);
    }

    function payCost(cost) {
        const resources = getSettlementResources();
        if (!resources) return false;
        for (const id of Object.keys(cost)) {
            resources[id].current -= cost[id];
        }
        return true;
    }

    /**
     * Claim a CLEARED region by building a Tier 1 Camp.
     * @returns {{ok: boolean, reason?: string}}
     */
    function claimRegion(x, y) {
        const record = peekRegion(x, y);
        if (!record) return { ok: false, reason: 'Region unknown' };
        if (record.outpost) return { ok: false, reason: 'Already claimed' };
        if (record.state !== 'cleared') {
            return { ok: false, reason: 'Region must be Cleared first (destroy any nest, then claim before the wild creeps back)' };
        }
        const cost = OUTPOST.tiers[1].cost;
        if (!canAffordCost(cost)) {
            return { ok: false, reason: `Not enough resources (needs ${formatCost(cost)})` };
        }

        payCost(cost);
        record.outpost = { tier: 1, workers: 0, stockpile: {} };
        record.state = 'claimed';
        record.clearedOnDay = null;
        return { ok: true };
    }

    /**
     * Upgrade an outpost to the next tier.
     */
    function upgradeOutpost(x, y) {
        const record = peekRegion(x, y);
        if (!record || !record.outpost) return { ok: false, reason: 'No outpost here' };
        const nextTier = record.outpost.tier + 1;
        const tierDef = OUTPOST.tiers[nextTier];
        if (!tierDef) return { ok: false, reason: 'Already at max tier' };
        if (!canAffordCost(tierDef.cost)) {
            return { ok: false, reason: `Not enough resources (needs ${formatCost(tierDef.cost)})` };
        }
        payCost(tierDef.cost);
        record.outpost.tier = nextTier;
        return { ok: true, tierName: tierDef.name };
    }

    /**
     * Assign one idle settler to an outpost.
     */
    function assignOutpostWorker(x, y) {
        const record = peekRegion(x, y);
        if (!record || !record.outpost) return { ok: false, reason: 'No outpost here' };
        simulate(record); // settle production up to now before the rate changes

        const pop = window.GameState?.getState()?.settlement?.population;
        if (!pop || pop.idle <= 0) return { ok: false, reason: 'No idle settlers' };

        const cap = OUTPOST.tiers[record.outpost.tier].workerCap;
        if (record.outpost.workers >= cap) return { ok: false, reason: 'Outpost is fully staffed' };

        pop.idle--;
        record.outpost.workers++;
        return { ok: true };
    }

    /**
     * Recall one worker from an outpost to the idle pool.
     */
    function unassignOutpostWorker(x, y) {
        const record = peekRegion(x, y);
        if (!record || !record.outpost) return { ok: false, reason: 'No outpost here' };
        if (record.outpost.workers <= 0) return { ok: false, reason: 'No workers assigned' };
        simulate(record); // settle production up to now before the rate changes

        const pop = window.GameState?.getState()?.settlement?.population;
        if (!pop) return { ok: false, reason: 'No settlement' };

        record.outpost.workers--;
        pop.idle++;
        return { ok: true };
    }

    /**
     * Haul an outpost's whole stockpile into settlement resources
     * (the Tier 1 "visit to collect" action).
     * @returns {{ok: boolean, collected: Object}}
     */
    function collectStockpile(x, y) {
        const record = peekRegion(x, y);
        if (!record || !record.outpost) return { ok: false, collected: {} };
        simulate(record); // include production up to this moment

        const before = {};
        for (const id of Object.keys(record.outpost.stockpile || {})) {
            before[id] = record.outpost.stockpile[id];
        }

        haulToSettlement(record.outpost, 1);

        const collected = {};
        for (const id of Object.keys(before)) {
            const moved = before[id] - (record.outpost.stockpile?.[id] || 0);
            if (moved >= 1) collected[id] = Math.floor(moved);
        }
        return { ok: true, collected };
    }

    function formatCost(cost) {
        return Object.keys(cost).map(id => `${cost[id]} ${id}`).join(', ');
    }

    function getOutpostTiers() {
        return OUTPOST.tiers;
    }

    // ─── Roads (organic wear) ────────────────────────────────────────────────

    /**
     * Record a pass through region (x, y) — repeated travel wears in a road.
     */
    function addRoadWear(x, y, biome) {
        const record = getRegion(x, y, biome);
        if (!record) return;
        record.roadWear = (record.roadWear || 0) + 1;
    }

    function getRoadWear(x, y) {
        const record = peekRegion(x, y);
        return record ? (record.roadWear || 0) : 0;
    }

    /**
     * Travel-cost multiplier for a region: worn roads are faster
     * (up to 40% off after ~20 passes).
     */
    function getTravelCostMultiplier(x, y) {
        return 1 - Math.min(0.4, getRoadWear(x, y) * 0.02);
    }

    /**
     * Destroy a region's nest (assault victory). The region becomes Cleared —
     * protected from new nests for a while, then decays back to explored.
     */
    function clearNest(x, y) {
        const record = peekRegion(x, y);
        if (!record) return null;
        const level = record.threat?.nestLevel || 0;
        record.threat = { nestLevel: 0, nestBornDay: null };
        record.state = 'cleared';
        record.clearedOnDay = getCurrentDay();
        return level;
    }

    /**
     * Mark a region as visited/explored. Called by LocalMap.enterRegion.
     * Runs the lazy sim and returns the up-to-date record.
     * @returns {{record: Object, firstVisit: boolean}}
     */
    function visitRegion(x, y, biome) {
        const record = getRegion(x, y, biome);
        if (!record) return { record: null, firstVisit: false };

        // Backfill biome for records created before it was stored
        if (!record.biome && biome) record.biome = biome;

        simulate(record);

        const firstVisit = record.state === 'wild';
        const today = getCurrentDay();
        if (firstVisit) {
            record.state = 'explored';
            record.firstVisitDay = today;
        }
        record.lastVisitDay = today;

        return { record, firstVisit };
    }

    /**
     * Store a region's resource deltas (called when leaving/saving a region).
     */
    function setResourceDeltas(x, y, deltas) {
        const record = peekRegion(x, y);
        if (record) record.resourceDeltas = deltas;
    }

    /**
     * Store a region's revealed fog tiles.
     */
    function setRevealedTiles(x, y, revealedSet) {
        const record = peekRegion(x, y);
        if (record) record.revealedTiles = Array.from(revealedSet);
    }

    /**
     * Info for the overworld panel. Returns null for never-visited regions.
     */
    function getRegionInfo(x, y) {
        const record = peekRegion(x, y);
        if (!record || record.state === 'wild') return null;
        simulate(record); // keep info fresh when inspected
        return {
            name: record.name,
            richness: record.richness,
            state: record.state,
            nestLevel: record.threat?.nestLevel || 0,
            outpost: record.outpost
                ? {
                    tier: record.outpost.tier,
                    tierName: OUTPOST.tiers[record.outpost.tier].name,
                    icon: OUTPOST.tiers[record.outpost.tier].icon,
                    workers: record.outpost.workers,
                    workerCap: OUTPOST.tiers[record.outpost.tier].workerCap,
                    stockpile: record.outpost.stockpile || {}
                }
                : null,
            roadWear: record.roadWear || 0,
            lastVisitDay: record.lastVisitDay,
            daysSinceVisit: record.lastVisitDay !== null
                ? Math.max(0, getCurrentDay() - record.lastVisitDay)
                : null
        };
    }

    /**
     * Is there a max-level nest near the domain? Used for the overworld
     * warning banner. Returns the closest offending region record or null.
     */
    function getLoomingThreat() {
        const center = getDomainCenter();
        if (!center) return null;
        const store = getRegionsStore();
        if (!store) return null;

        const cap = getThreatCap();
        if (cap === 0) return null;

        let worst = null;
        for (const key of Object.keys(store)) {
            const [x, y] = key.split(',').map(Number);
            const record = peekRegion(x, y);
            if (!record || !record.threat || record.threat.nestLevel < cap) continue;
            const dist = distanceToDomain(x, y);
            if (dist === null || dist > 5) continue;
            if (!worst || dist < worst.dist) {
                worst = { record, dist };
            }
        }
        return worst ? worst.record : null;
    }

    function getRegrowDays(resourceType) {
        return REGROW_DAYS[resourceType] ?? null;
    }

    return {
        getRegion,
        peekRegion,
        visitRegion,
        simulate,
        simulateAll,
        clearNest,
        setResourceDeltas,
        setRevealedTiles,
        getRegionInfo,
        getLoomingThreat,
        getThreatCap,
        getRegrowDays,
        getCurrentDay,
        // Territory (Phase 3)
        claimRegion,
        upgradeOutpost,
        assignOutpostWorker,
        unassignOutpostWorker,
        collectStockpile,
        getClaimedRegions,
        getDomainTiles,
        getDomainSize,
        getOutpostTiers,
        addRoadWear,
        getRoadWear,
        getTravelCostMultiplier
    };
})();

window.RegionManager = RegionManager;
