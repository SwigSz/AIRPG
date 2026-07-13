# The Living Frontier — Map & World Redesign

> **Status:** Design phase. Decisions below marked ✅ are locked; items marked 🔧 are
> still being workshopped. Phases at the bottom define build order.

## Vision

**The wilderness is a slow, patient enemy. Everything you don't tame grows wilder.
Everything you tame, your heirs inherit.**

The map stops being a place you visit and becomes the thing you play against. The
settlement is your heart, the frontier is the battlefield, and time is the opponent's
army. The world — not the character — is the true protagonist: characters die,
dynasties stumble, but the territory and its history persist.

## Design pillars

1. **The world evolves with in-game time** — regions regrow, decay, and grow hostile
   whether or not you're watching.
2. **Expansion is the difficulty slider** — threat pressure scales with domain size.
   Turtle and stay safe; expand and invite war. No difficulty setting; the player
   tunes it by playing.
3. **The land remembers** — harvesting, building, roads, graves. Player action leaves
   permanent marks on the map.
4. **Each life is distinct; the territory compounds** — skills die with the character,
   the world does not.

---

## Decided design

### Region lifecycle ✅

Every overworld tile carries persistent, evolving state:

| State | Meaning | Transitions |
|---|---|---|
| **Wild** | Never visited. Richness/threat unknown. | → Explored (visit) |
| **Explored** | Mapped, POIs known, still dangerous. | → Cleared (destroy nests) / can become Infested (neglect) |
| **Cleared** | Safe for now; threat creeps back over time. | → Claimed (build outpost), or decays → Explored |
| **Claimed** | Outpost built, settlers can work it. | Part of the **Domain** |

**Lazy simulation (architecture keystone):** nothing ticks in the background. Each
region stores `lastSimDay`; when accessed (entered, or inspected on the overworld),
`simulateRegion(region, daysElapsed)` fast-forwards regrowth, nest growth, and events.
O(1) per region, on demand. Rolls are seeded by `(regionSeed, day)` so reloading
doesn't reroll outcomes.

### Threat — domain-scaled pressure ✅

- **Nests** spawn in unattended explored regions. Spawn chance scales with elapsed
  days + distance from the player's domain.
- Nests **grow**: Lv1 scouts → Lv2 raider camp (patrols visible on local map) →
  Lv3 spreads a satellite nest to an adjacent region → Lv4 launches **raids** at the
  settlement.
- Clearing a nest is a local-map assault: fight through guards to the nest heart;
  boss encounters at higher levels. Rewards scale with nest level — festering nests
  are richer and scarier.
- **World attention budget:** total threat pressure is a function of domain size
  (primary) plus a slow time factor (secondary). At 1–2 claimed regions nests are
  rare, slow, and capped at Lv2 (no raids). Every claimed region raises the pressure
  ceiling. Cozy early, warlike at scale.
- Overworld shows pressure: skull pips per region and a raid forecast line
  ("Raiders will reach New Haven in ~6 days").

### Territory & outposts — autonomy as progression ✅

Outposts are built in Cleared regions using settlement resources. Tiers gate
autonomy (unlocked via research/buildings, reusing existing data-driven patterns):

| Tier | Name | Behavior |
|---|---|---|
| 1 | **Camp** | Assign workers; they gather into a *local stockpile*; the player must physically visit to haul it home. Deliberate micromanagement — keeps the player on the road while the domain is young. |
| 2 | **Waystation** | Auto-hauling to the settlement along worn roads; hauling throughput depends on road wear. |
| 3 | **Holdfast** | A foreman runs it: rotates workers, repels small raids alone, escalates only real threats to the player. (This is where expedition-style automation naturally arrives.) |

- **Roads wear in organically**: repeatedly traveled routes lower travel cost over
  time. (Deliberate road construction can come later; organic wear ships first.)
- **Domain** = contiguous claimed regions. Larger safe domain → settlement
  morale/population bonuses. Domain borders are drawn on the overworld — your
  civilization is a visible, growing shape.

### Ecology ✅

- **Regrowth:** organic nodes (trees, bushes, plants) regrow after biome-specific
  day counts. Store `depletedOnDay` per node instead of a permanent `amount: 0`
  (also fixes current save bloat where every empty tile is written).
- **Ore** is finite per vein, but prospecting/events can reveal new veins.
- **Terraforming through use:** strip a forest and the tile becomes *cleared land* —
  fewer trees, but it's the terrain outposts/farms want. Harvesting has consequences.
- **Seasons** (12 months already exist): regrowth modifiers, seasonal availability,
  frozen fords. Slotted late — charming, not load-bearing.

### Movement & local maps ✅

- **Click-to-path:** A* to any revealed tile, ~100ms per step, interrupted by
  discoveries and encounters. (Existing per-step validation becomes the loop body.)
- **Local fog of war:** regions are revealed by walking them; revealed tiles persist.
  Discovery is the content.
- **Local maps reflect region state:** infested → patrols + corrupted ground near the
  nest; claimed → outpost building, visible settler NPCs gathering, worn paths. An
  owned region *looks* owned.
- **POIs:** 1–3 per region (cave, ruin, shrine, rich vein, abandoned camp), each with
  its own state. Overworld hints at them before you commit travel days
  ("smoke rises over this forest").

### Succession & legacy ✅

- **Heir-gated continuation:** the run continues past death only with a designated
  heir.
- **Acquisition — anointing only (for now):** designate any settler/wanderer as heir.
  Architecture must leave room for blood heirs / dynasty systems later (planned
  expansion). Wanderers stop being +1 population and become candidates worth vetting.
  - *Future hook:* train the anointed heir at the Training Grounds while alive —
    investment in your successor as gameplay.
- **Inheritance — world + gear only:** skills/stats do NOT carry over. Territory,
  items, buildings, roads, and threat state are the inheritance. Each life is
  mechanically distinct; the world compounds.
- **No heir at death → the run ends, the world persists:** game over screen, but the
  save remains. Years later a **New Founder** (fresh character, no inheritance)
  arrives at the overgrown, threat-ridden remains of the old domain and may reclaim
  it. Lapsed years are simulated: nests matured, outposts ruined, forests regrown.
- **Graves:** characters' graves appear where they died. Visiting a predecessor's
  grave grants the heir a small "Remembrance" buff. Dying deep in the frontier means
  someone must journey to recover what was lost.
- **Succession pressure window:** threat growth ticks up briefly after succession —
  "the frontier tests the heir."

### Raids — hybrid by presence, siege loop ✅

- **If the player is at the settlement** when a raid arrives → playable siege (below).
- **If the player is away** → auto-resolution from defense strength (walls + towers +
  militia) vs raid strength, with a losses report. Creates real "should I leave home
  right now?" tension against the forecast timer.

**The Siege Loop (three stages):**

1. **Forecast (prep phase).** "Raiders reach New Haven in ~X days." Prep is gameplay:
   place/repair defenses on the camp's local map — barricades, spike traps,
   watchtowers (all placeable entries in buildings.json) — and muster **militia**:
   settlers assigned to a defense role via the existing worker-assignment UI, with
   stats derived from training buildings.
2. **The Assault (tower defense).** Raiders spawn at the camp map edge in waves and
   path toward the walls/gate. Towers auto-fire (staffed towers fire faster), traps
   trigger, walls soak damage — all visible in real time on the local map renderer
   (pathing + tick damage; no new combat engine). If raid strength is exhausted
   before the walls fail: **"The walls held"** — victory without combat.
3. **The Breach (if walls fall).** Raiders get inside → snaps into the turn-based
   combat system: player + militia party vs. the surviving raiders. **Militia are
   named settlers and can permanently die** — including a designated heir fighting
   in defense of their home. Defeat = looted stockpiles, damaged buildings, settler
   deaths — heavy but never settlement deletion. A run only ends when the player
   dies heirless.

Balance note: wall HP comes from palisade/wall buildings; tower count and staffing
thin waves; raid strength scales with the attacking nest's level and world attention.

---

## Data model sketch

```js
world.regions["12,15"] = {
  name: "Thornwood",              // seeded name
  state: "claimed",               // wild | explored | cleared | claimed
  richness: 3,                    // 1-5, shown on overworld once explored
  lastSimDay: 142,                // lazy-sim anchor
  threat: { nestLevel: 0, nest: { x, y }, nextRollDay: 150 },
  pois: [ { type: "cave", x: 4, y: 11, state: "uncleared" } ],
  outpost: { tier: 1, workers: 2, stockpile: { wood: 40 } },
  resourceDeltas: { "7,3": { depletedOnDay: 139 } },   // regrow-aware, sparse
  revealedTiles: [ ... ],
  roadWear: 14                    // travel-cost discount on used routes
}
```

Global additions: `world.attention` (derived from domain size), `state.dynasty`
(list of past characters: name, grave region, cause of death), `state.heir`
(designated settler id + investment level).

---

## Build phases (each ships playable)

1. **Foundation** ✅ SHIPPED (July 2026) — region state model + lazy sim
   (`js/world/region-manager.js`), renderer abstraction (`js/world/map-renderer.js`,
   tileset-ready), region names/richness/info panel on the overworld, local fog of
   war, click-to-path movement (A* over revealed tiles, auto-gather on arrival),
   regrow-aware resource deltas. Legacy v1 region blobs are migrated (their
   untrustworthy "every empty tile = depleted" data is dropped; visited regions
   replenish once).
2. **Threat** ✅ SHIPPED (July 2026) — nest spawn/growth in the lazy sim
   (deterministic per (region, time-window) hash), domain-scaled attention budget
   (`RegionManager.getThreatCap()`: no settlement = no threat; small domain caps
   nests at Lv2), nest assault gameplay (heart + level+1 non-respawning guards on
   the local map, scaled "Nest Chieftain" boss, loot × level on destruction),
   Cleared state with protection window that decays back to explored, overworld
   threat pips + 💀 info line + looming-threat banner, threat news in the activity
   log. Lv3 satellite spread + Lv4 raids activate in Phase 3 when the attention
   cap can exceed 2.
3. **Territory** ✅ SHIPPED (July 2026) — claim Cleared regions ("🏕️ Build
   Outpost" on the overworld, costs settlement resources); outpost tiers 1–3
   (Camp/Waystation/Holdfast) with worker caps, upgrade costs, and per-biome
   gathering yields scaled by richness; T1 manual hauling ("📦 Collect
   Stockpile"), T2+ auto-hauling (rate boosted by road wear), T3 nest-spawn
   suppression within 2 regions; Settlement → Territory tab (worker assignment
   from the idle pool, stockpiles, upgrades, domain summary); organic roads
   (travel wears them in, up to -40% travel cost, shown as track marks + 🛤️);
   fast travel between domain tiles (half time, no encounters); golden domain
   borders on the overworld; +2 population cap per claimed region; threat cap
   rises to Lv3 beyond 2 domain tiles, and Lv3 nests spread one satellite nest
   to an adjacent explored region. Lv4 + raids remain gated on the siege-loop
   workshop. Note: domain contiguity is NOT yet enforced (any claimed region
   counts); revisit if sprawl becomes degenerate.
4. **Legacy** ✅ SHIPPED (July 2026) — `js/core/succession.js`: aging (1 year =
   180 days, lifespan 65–85, physical stat decay in the final 10 years, ⌛ in
   the top bar), heir anointing (Population tab, heir dies if the settlement
   empties), death by old age or combat defeat, succession (heir starts at 18,
   Gen +1, world + gear only — skills/stats reset), graves placed where
   characters fall (🪦 on the local map; honoring one grants +1 attribute
   point once per generation), heirless death = run ends with the world
   persisting — a New Founder arrives 2 years later with NOTHING to a domain
   decayed *organically by the simulation* (starvation scatters settlers,
   nests matured). Dynasty history in `state.dynasty.pastCharacters`.
   NOT yet built: succession threat-pressure window, heir training investment.

**Threat balance pass (July 2026, after playtest):** nests spawned faster than
they could be cleared. Fixes: global concurrent-nest budget = the literal
attention limit (`getMaxActiveNests()`: domain 1-2 → 1 nest at a time, /3
thereafter, cap 4); spawn window 15→40 days at 22%→15%; growth 25→45
days/level; cleared protection 40→60 days; local map step & harvest cost
0.5→0.25 days.

## Loop closures ✅ SHIPPED (July 2026, post-Phase 4)

- **Sprite tileset live**: Kenney Roguelike/RPG pack (CC0) at
  `assets/sprites/roguelike-sheet.png`, atlas in `map-renderer.js`
  (16px + 1px spacing; `T(col,row)` helper). Both map layers render sprites;
  emoji/color fallback remains if the image fails.
- **Named settlers**: roster in `settlement.settlers` (name + trait), synced
  to the population counters (`syncSettlerRoster`, self-healing). Wanderers
  arrive as named people. Heirs are chosen FROM the roster; the heir's trait
  grants +1 to its mapped stat on succession. Roster feeds future militia/
  foremen (siege workshop prerequisite).
- **Live morale**: events push it (starvation −5, succession −15, nest cleared
  +10, claim +5), drifts 0.5/day toward baseline 75. Multiplies settlement
  production (0.63 + morale/200) and wanderer arrivals (×morale/100).
- **Chronicle**: Character → Chronicle sub-tab renders the dynasty from
  `dynasty.pastCharacters` + per-generation deeds (`Succession.recordDeed`:
  regionsDiscovered, nestsCleared, outpostsFounded, gravesHonored,
  settlersJoined).
- **Gear demand curve**: nest chieftain defense +2/level, with a "your weapon
  can barely scratch" warning when the player's damage won't bite.
- **Trade caravans**: `js/settlement/trade.js` — arrivals every ~30 days,
  down to ~12 as roads wear in (the organic-road payoff); stays 6 days with
  3 one-shot barter offers (resources ↔ resources/items); Settlement → Trade
  tab with the in-place render pattern.

## Integration notes (existing systems reused)

- **TimeSystem** drives all lazy simulation (`lastSimDay` anchors).
- **Worker assignment** pattern (settlement population tab) extends to outposts.
- **Research tree / buildings.json** gate outpost tiers and defenses.
- **Training system** later extends to heir investment.
- **Combat system** hosts nest assaults and (pending workshop) raid defense.
- **Noise.hash2D** for all per-tile deterministic rolls; region seeds from world seed.
- **Region save deltas** evolve into the richer region state object above.

## Further locked decisions

- **Mortality — age is the clock ✅:** characters age with in-game years and die
  naturally (wire up the existing aging system). Old age decays stats, naturally
  pushing late-life play toward "prepare the heir, fortify the walls." Every life
  has three acts. Lifespan tuning TBD (DAYS_PER_YEAR = 180; settlement time runs
  1 day ≈ 2s — pace must be validated in play).
- **World size — fixed ~30×30 ✅:** ~900 regions, fully knowable and tameable. A
  completed dynasty can paint the entire map. Bounded lazy-sim bookkeeping.
- **Visuals — sprite tileset ✅:** adopt a 16px top-down tileset (candidate: Kenney
  roguelike packs, CC0, ~1,700 tiles). Implementation rule: Phase 1 builds a small
  renderer abstraction (`drawTile(x, y, spriteId)`) with colored-tile fallback so
  sprites drop in without touching game logic; art lands during Phase 1–2.

## Open questions

- Travel events during multi-day overworld travel (choice popups) — scope and tone.
- Blood-heir / dynasty expansion design (post-Phase 4).
- Can the player *watch or intervene* during the Assault stage (reposition militia
  between waves? fight at the wall as a unit?) or is Stage 1 fully automated?
- Settlement damage floor: exactly what raiders can/cannot destroy on a loss.
- Aging pace + lifespan numbers (needs playtesting against real session lengths).
