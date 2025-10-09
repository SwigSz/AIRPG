# Claude's Development Notes & Reminders

## Project Structure Guidelines

### Data Files Architecture
All JSON data files in `/data/` should be structured for easy modding. Each file contains a top-level array property named after the file (e.g., `items.json` has `"items": []`).

**Key Principle**: Any modder should be able to copy an existing entry's structure and create their own content by following the same pattern.

### JSON File Specifications

#### **abilities.json**
- Contains all combat abilities with stats and info
- Used by both players and enemies
- Structure: `{ "abilities": [...] }`

#### **achievements.json**
- Contains all achievements in the game
- Includes obtainment requirements and related info
- Structure: `{ "achievements": [...] }`

#### **enemies.json**
- Contains ALL enemies in the game
- Complete enemy definitions with stats, abilities, loot tables
- Structure: `{ "enemies": [...] }`

#### **items.json**
- Contains EVERY ITEM (weapons, gear, potions, consumables)
- Does NOT include materials (those go in materials.json)
- Structure: `{ "items": [...] }`

#### **materials.json**
- Contains crafting materials (sticks, rocks, ores, etc.)
- Items used as ingredients for crafting recipes
- Structure: `{ "materials": [...] }`

#### **quests.json**
- Contains all quests in the game
- Includes unlock requirements, how to start, objectives, rewards
- Structure: `{ "quests": [...] }`

#### **recipes.json**
- Contains all crafting recipes
- Defines inputs and outputs for crafting system
- Structure: `{ "recipes": [...] }`

#### **research.json**
- Contains all researchable technologies/knowledge
- Includes unlock requirements and completion status tracking
- Structure: `{ "research": [...] }`

#### **settlement-upgrades.json**
- Contains all settlement upgrades (different from research)
- Tracks obtained status and unlock requirements
- Structure: `{ "upgrades": [...] }`

#### **skills.json**
- Contains all skills in the game
- Used by both players and enemies (no distinction)
- Structure: `{ "skills": [...] }`

#### **spells.json**
- Contains all magical spells
- Includes mana costs, damage, effects, requirements
- Structure: `{ "spells": [...] }`

#### **traits.json**
- Contains all possible player traits
- Character traits that affect gameplay
- Structure: `{ "traits": [...] }`

---

## Loading JSON Data Files

### System Files That Load JSON
The following JavaScript files load data from JSON files and must initialize with `async init()`:

1. **enemy.js** (`EnemyDatabase`)
   - Loads from: `data/enemies.json`
   - Must call: `await EnemyDatabase.init()` in main.js
   - Converts JSON format to internal enemy format

2. **crafting.js** (`Crafting`)
   - Loads from: `data/recipes.json`
   - Must call: `await Crafting.init()` in main.js
   - Loads recipe definitions for crafting system

### Initialization Order in main.js
```javascript
// Initialize data systems FIRST (before UI systems)
if (window.EnemyDatabase) await EnemyDatabase.init();
if (window.Crafting) await Crafting.init();
// Then initialize UI systems...
```

**IMPORTANT**: Any new system that loads JSON data must:
1. Have an `async init()` function
2. Be called with `await` in main.js
3. Be initialized BEFORE UI systems that depend on the data

---

## Notes
- This file will be appended with additional reminders and guidelines as development progresses
- Always maintain backward compatibility when updating JSON structures
- Include clear comments in sample entries for modder guidance
- When creating new data-driven systems, follow the JSON loading pattern above
