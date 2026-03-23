# Map System Roadmap

This file tracks future map features. Delete items as they are implemented.

---

## Core Foundation (implement first)
- [x] ~~Hardcoded 20x20 grid with biomes~~ (replaced by procedural generation)
- [ ] **Procedural world generation** - Large world (e.g. 200x200 visible tiles backed by chunk system, or full 5000x5000 logical space)
  - Noise-based biome placement (Perlin/simplex noise)
  - Seeded generation — each playthrough gets a seed, same seed = same world
  - Seed saved with game state so the world persists across sessions
  - Biomes: forest, plains, desert, tundra, swamp (water and mountains as natural barriers)
  - Resources placed procedurally based on biome (trees in forest, ore near mountains, etc.)
- [ ] **Camera/viewport system** - Player stays centered, world scrolls around them
  - Only render visible tiles (culling) for performance on large worlds
  - Smooth or snapped scrolling
- [ ] **Fog of war** - Unexplored tiles are hidden/dark, revealed as player walks near them
  - Fog state saved per-tile in game state (or as a visited set)

---

## Encounters
- [ ] **Random combat encounters** (step-based, no specific tiles)
  - Each biome has an encounter rate (e.g. swamp = high, plains = low)
  - Each step in a biome has a % chance to trigger combat
  - Enemy pool selected based on current biome
  - Remove the current hardcoded combat encounter tiles system
- [ ] **Visible enemies on map** (later, after random encounters)
  - Roaming enemy sprites on the map
  - Player can choose to engage or avoid
  - Elites / named enemies as visible encounters

---

## Points of Interest (later)
- [ ] **Dungeons** - Entrance tiles on the map that lead to a separate dungeon floor system
  - Multiple floors, each floor is its own generated map
  - Boss enemy at the end
  - Unique loot
- [ ] **Ruined settlements** - Lootable locations with a one-time reward
- [ ] **NPC camps** - Traders, questgivers, neutral factions
- [ ] **Enemy camps/bases** - Clearable locations that stop raids or unlock content
- [ ] **Hidden/secret locations** - Require specific items or skills to discover

---

## Scouting & Expeditions (later, player-suggested)
- [ ] **Scouting party system** - Send NPCs from settlement to scout/explore areas
  - Returns a map of the scouted region
  - Can bring back resources or intel on enemy camps

---

## Quality of Life
- [ ] **Minimap** - Small overview of explored world in corner of screen
- [ ] **Map markers** - Player can place custom markers on explored tiles
- [ ] **Fast travel** - Between discovered waypoints (camps, settlements, etc.)
- [ ] **Movement cost variation** - Swamp/tundra tiles cost more moves (stamina system)

---

## Notes
- World seed stored in `GameState` under `state.world.seed`
- Biome generation should use a well-known JS noise library (e.g. simplex-noise) or implement basic Perlin noise
- Chunk-based loading recommended for very large worlds (load/unload chunks around player)
- Keep camp placement system — it's the anchor between map and settlement
