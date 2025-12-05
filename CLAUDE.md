# Claude's Development Notes & Reminders

## CRITICAL PRINCIPLE: Real-Time UI Updates

**THE GAME MUST UPDATE IN REAL-TIME. PERIOD.**

All UI elements MUST update immediately when their underlying data changes. Players should NEVER have to:
- Switch tabs to see updates
- Reload the page to see changes
- Click anything to refresh data

### Implementation Rules

1. **When data changes, call updateUI() immediately**
   - Settlement resources change → Call `Settlement.updateUI()`
   - Character stats change → Update character panel
   - Inventory changes → Re-render inventory
   - Combat state changes → Update combat UI

2. **System callbacks must trigger UI updates**
   - `onTimeAdvance()` MUST call full `updateUI()`, not just partial updates
   - Event handlers MUST update UI after modifying data
   - Auto-save triggers MUST update UI

3. **Tab-specific updates**
   - `updateUI()` functions MUST check which tab is active
   - Only render the active tab's content to avoid performance issues
   - All tabs must update when their data changes AND they're visible

4. **Common Mistakes to Avoid**
   - ❌ Calling only `updateHeaderBar()` when full UI needs refresh
   - ❌ Forgetting to call `updateUI()` after data mutations
   - ❌ Assuming UI will "eventually" update
   - ❌ Only updating UI on user interaction

### Example: Settlement System

```javascript
// CORRECT - Full UI update on time advance
function onTimeAdvance(daysAdvanced) {
    // ... modify resources, population, etc ...
    updateUI(); // ✅ Updates everything visible
}

// WRONG - Partial update
function onTimeAdvance(daysAdvanced) {
    // ... modify resources, population, etc ...
    updateHeaderBar(); // ❌ Population tab won't update!
    updateResourcesPanel(); // ❌ Still missing active tab!
}
```

**If the UI doesn't update in real-time, IT'S A BUG.**

---

## Quick Reference: File Locations

When you need to edit specific functionality, look in these locations:

### Core Systems
- **Main entry point**: `js/main.js` - Game initialization, character creation, main game loop
- **Character data**: `js/character/character.js` - Character object creation and management
- **Character stats**: `js/character/stats.js` - Stat calculations and derived attributes
- **Combat stats**: `js/character/combat-stats.js` - Combat-specific stat calculations
- **Game state**: `js/core/game-state.js` - Global game state management
- **Save system**: `js/core/save-system.js` - Save/load functionality

### Inventory & Items
- **Inventory logic**: `js/items/inventory.js` - Inventory data structure and operations
- **Inventory UI**: `js/ui/inventory-ui.js` - ALL inventory rendering (centralized)
- **Equipment logic**: `js/items/equipment.js` - Equipment data structure and operations
- **Item factory**: `js/items/item-factory.js` - Creates items from items.json
- **Item definitions**: `data/items.json` - All item data (weapons, armor, consumables)
- **Materials**: `data/materials.json` - Crafting materials data
- **Consumables**: `js/items/consumable-manager.js` - Potion/consumable usage logic

### Combat Systems
- **Combat manager**: `js/combat/combat-manager.js` - Combat flow, turns, UI
- **Damage calculator**: `js/combat/damage-calculator.js` - ALL damage calculations (centralized)
- **Enemy database**: `js/combat/enemy.js` - Loads and manages enemy data
- **Enemy definitions**: `data/enemies.json` - All enemy data
- **Abilities**: `data/abilities.json` - Combat abilities data
- **Skills**: `data/skills.json` - Skill definitions
- **Spells**: `data/spells.json` - Spell definitions

### World & Map
- **Map system**: `js/world/map.js` - World map, movement, encounters
- **Settlements**: `js/settlement/settlement.js` - Settlement management and resources
- **Settlement resources**: `data/resources.json` - All settlement resource definitions (data-driven)
- **Settlement buildings**: `data/buildings.json` - Building definitions and resource costs/production
- **Settlement upgrades**: `data/settlement-upgrades.json` - Upgrade definitions
- **Settlement detection**: `character.inSettlement` flag - Boolean property on character object that determines if player is in settlement (used for tab visibility and research progress)

### Crafting & Research
- **Crafting system**: `js/crafting/crafting.js` - Crafting logic and UI
- **Recipes**: `data/recipes.json` - All crafting recipes
- **Research system**: `js/settlement/research.js` - Research/tech tree logic
- **Research data**: `data/research-tree.json` - Research node definitions

### UI Components
- **UI Manager**: `js/ui/ui-manager.js` - UI panel management
- **Inventory UI**: `js/ui/inventory-ui.js` - Centralized inventory rendering
- **Modal system**: `js/ui/modal.js` - Modal dialogs
- **Debug menu**: `js/debug-menu.js` - Debug tools and cheats

### Skills & Progression
- **Skills system**: `js/skills/skills.js` - Skill leveling and management
- **Traits**: `data/traits.json` - Character trait definitions
- **Achievements**: `data/achievements.json` - Achievement definitions

### Quests
- **Quest system**: `js/quests/quests.js` - Quest logic and tracking
- **Quest data**: `data/quests.json` - Quest definitions

### Common Patterns
- **Need to add a new item?** → Edit `data/items.json`
- **Need to modify item rendering?** → Edit `js/ui/inventory-ui.js` (NEVER duplicate this code)
- **Need to change damage calculations?** → Edit `js/combat/damage-calculator.js` (NEVER calculate elsewhere)
- **Need to add an enemy?** → Edit `data/enemies.json`
- **Need to add a recipe?** → Edit `data/recipes.json`
- **Need to add a settlement resource?** → Edit `data/resources.json` (fully data-driven)
- **Need to add a building?** → Edit `data/buildings.json`
- **Need to modify combat flow?** → Edit `js/combat/combat-manager.js`
- **Need to change map behavior?** → Edit `js/world/map.js`
- **Need to modify character creation?** → Edit `js/main.js` (initializeTestCharacter function)

---

## Hot-Reload System

### How It Works

The game is designed to support **hot-reloading** of content. When you add new items, recipes, research nodes, or enemies to the JSON files, players can simply **refresh the page** to see the new content WITHOUT losing their progress.

### What Gets Hot-Reloaded

✅ **Automatically reloaded on every page refresh:**
- Items (`data/items.json`)
- Materials (`data/materials.json`)
- Recipes (`data/recipes.json`)
- Research nodes (`data/research-tree.json`)
- Enemies (`data/enemies.json`)
- Abilities (`data/abilities.json`)
- Skills (`data/skills.json`)
- Spells (`data/spells.json`)
- Resources (`data/resources.json`)
- Buildings (`data/buildings.json`)

✅ **Player progress preserved in save file:**
- Discovered recipes (which recipes the player has found)
- Crafted items history (tracking first-time crafts)
- Researched nodes (completed research)
- Character stats, inventory, equipment
- Settlement resources and upgrades
- Quest progress

### How Player Progress is Stored

All player progress is stored in **GameState** and saved to a single save file in localStorage under the key `ai_rpg_save`. This includes:

- `state.discoveredRecipes` - Array of recipe IDs the player has discovered
- `state.craftedItems` - Array of item names the player has crafted before
- `state.researchedNodes` - Array of research node IDs completed
- `state.craftingHistory` - Array of item names crafted (for research unlocks)

**Migration:** Old saves that stored `discoveredRecipes` and `craftedItems` in separate localStorage keys are automatically migrated to GameState on load.

### Adding New Content (Developer Guide)

When adding new content to JSON files:

1. **Add the new entry** to the appropriate JSON file (items.json, recipes.json, etc.)
2. **No code changes needed** - the game will load it automatically
3. **Player saves are safe** - existing progress is preserved
4. **Test by refreshing** - just reload the page to see your changes

**Example: Adding a new item**
```json
// In data/items.json
{
  "id": "new_sword",
  "name": "New Sword",
  "classifications": ["weapon", "one-handed", "melee"],
  "stats": { "damage": 15 }
}
```
Save the file → Refresh the game → New item is available!

### Important Rules

**❌ DO NOT:**
- Store game data in separate localStorage keys (use GameState)
- Hardcode item/recipe/enemy data in JavaScript
- Cache JSON data across page loads

**✅ DO:**
- Load all content from JSON files on init
- Store player progress in GameState
- Use migration logic in save-system.js for breaking changes

---

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

## UI Architecture Guidelines

### Inventory UI System

**CRITICAL: All inventory rendering MUST use the centralized InventoryUI module.**

#### Module Location
`js/ui/inventory-ui.js`

#### Architecture Pattern
```
DATA LAYER (Pure Logic)           UI LAYER (Presentation)
├── inventory.js                  ├── inventory-ui.js ← SINGLE SOURCE OF TRUTH
├── equipment.js                  │   ├── renderInventoryGrid()
├── consumable-manager.js         │   ├── renderEquipmentSlots()
└── item-factory.js               │   ├── renderMiniInventory()
                                  │   ├── renderCombatItemsMenu()
                                  │   └── showItemDetailsModal()
```

#### Usage Rules

**❌ DO NOT:**
- Write custom HTML generation for inventory items
- Implement your own item stacking logic
- Create manual event listeners for item actions
- Duplicate inventory rendering code in new systems

**✅ DO:**
- Always import and use `InventoryUI` functions
- Use callbacks for item action handling
- Refer to existing examples in main.js, crafting.js, combat-manager.js
- Read the comprehensive documentation at the top of `inventory-ui.js`

#### Quick Reference

**For full inventory display:**
```javascript
InventoryUI.renderInventoryGrid(container, character, handleItemAction);
```

**For mini inventory (crafting, trading, etc.):**
```javascript
InventoryUI.renderMiniInventory(container, character, onItemClick, { usedItemIds });
```

**For combat items menu:**
```javascript
InventoryUI.renderCombatItemsMenu(container, character, onItemUse, onBack);
```

**For item details modal:**
```javascript
InventoryUI.showItemDetailsModal(item);
```

#### Why This Matters

Before centralization:
- Inventory rendering code duplicated across 3+ files (493+ lines total)
- Item stacking logic implemented 3 different ways
- UI inconsistencies between different inventory views
- Changes required updating multiple files

After centralization:
- Single source of truth for all inventory rendering
- Consistent UI across all contexts
- Easier to maintain and test
- Prevents future code duplication

**See `js/ui/inventory-ui.js` for detailed usage examples and API documentation.**

---

## Combat Systems Architecture

### Centralized Damage Calculator

**CRITICAL: All damage calculations MUST use the DamageCalculator module.**

#### Module Location
`js/combat/damage-calculator.js`

#### Architecture Pattern
```
DAMAGE CALCULATION FLOW
├── Weapon Classification Detection (melee/ranged/magic)
├── Attribute Multiplier (from CharacterStats)
├── Additional Bonuses (skills, buffs, passives) [ADDITIVE]
└── Final Damage = Base Damage × Total Multiplier
```

#### Core Principles

1. **Damage Type Detection**: Weapons are classified by checking their `classifications` array in items.json
   - Example: `["weapon", "one-handed", "melee"]`
   - Supported types: `melee`, `ranged`, `magic`
   - Weapons without a damage type classification receive NO multipliers

2. **Additive Bonus Stacking**: All damage bonuses add together (NOT multiply)
   - Base: 100% (1.0)
   - Attribute bonus: +2% per point (from CharacterStats)
   - Skill bonus: +15% (example)
   - Total: 100% + attribute% + skill% = final multiplier

3. **Extensibility for Modding**: New damage sources can be added in `getAdditionalBonuses()`
   - Skills with damage bonuses
   - Temporary buffs
   - Equipment passive effects
   - Traits/achievements

#### Usage Rules

**❌ DO NOT:**
- Calculate damage manually in combat code
- Apply multipliers directly in combat-manager.js
- Hardcode damage type checks
- Use multiplicative stacking for bonuses

**✅ DO:**
- Always use `DamageCalculator.calculateCurrentWeaponDamage(character)`
- Add new damage types to `DAMAGE_TYPES` constant
- Add new bonus sources to `getAdditionalBonuses()` function
- Keep bonuses additive unless explicitly designed otherwise

#### Quick Reference

**Calculate current weapon damage:**
```javascript
const damage = DamageCalculator.calculateCurrentWeaponDamage(character);
```

**Calculate specific weapon damage with breakdown:**
```javascript
const result = DamageCalculator.calculateWeaponDamage(character, weapon, baseDamage);
// Returns: { damage, damageType, multiplier, breakdown }
```

**Get damage multiplier only:**
```javascript
const multiplier = DamageCalculator.calculateDamageMultiplier(character, 'melee');
```

**Detect weapon damage type:**
```javascript
const damageType = DamageCalculator.getWeaponDamageType(weapon);
// Returns: 'melee', 'ranged', 'magic', or null
```

#### Adding New Damage Types (Modding)

1. Add new type to `DAMAGE_TYPES` constant
2. Add detection logic to `getWeaponDamageType()`
3. Add attribute mapping to `getAttributeMultiplier()` (if needed)
4. Update weapon classifications in items.json

Example:
```javascript
// In damage-calculator.js
const DAMAGE_TYPES = {
    MELEE: 'melee',
    RANGED: 'ranged',
    MAGIC: 'magic',
    HOLY: 'holy'  // New damage type
};
```

#### Adding New Bonus Sources (Modding)

All bonus sources should be added to `getAdditionalBonuses()` in damage-calculator.js:

```javascript
function getAdditionalBonuses(character, damageType) {
    let bonusMultiplier = 0;

    // Skill bonuses
    if (character.skills?.sword_mastery?.active && damageType === 'melee') {
        bonusMultiplier += 0.15; // +15% melee damage
    }

    // Buff bonuses
    if (character.buffs) {
        character.buffs.forEach(buff => {
            if (buff.damageBonus && buff.damageType === damageType) {
                bonusMultiplier += buff.damageBonus;
            }
        });
    }

    return bonusMultiplier;
}
```

**See `js/combat/damage-calculator.js` for detailed implementation and modding examples.**

---

## Settlement Resource System

### Overview
The settlement system uses a **fully data-driven resource system** similar to idle/incremental games. Resources are defined in `data/resources.json` and dynamically loaded, making it trivial to add new resources without code changes.

### Architecture Pattern

```
DATA LAYER                        GAME STATE                    UI LAYER
├── resources.json                ├── GameState.settlement      ├── settlement.js
│   └── Resource definitions      │   └── resources: {}         │   └── Dynamic rendering
├── buildings.json                │       ├── wood: {...}       └── Auto-updates
    └── Production/costs              └── stone: {...}
```

### How It Works

**Resource Storage:**
- All resource data stored in `GameState.settlement.resources`
- Structure: `{ resourceId: { current, max, production } }`
- Automatically saved/loaded with game state
- Single source of truth for all resource values

**Resource Definitions (data/resources.json):**
```json
{
  "resources": [
    {
      "id": "wood",
      "name": "Wood",
      "icon": "🪵",
      "description": "Basic building material",
      "category": "material",
      "defaultMax": 100,
      "defaultStart": 3
    }
  ]
}
```

**Building Integration (data/buildings.json):**
Buildings reference resources by ID:
```json
{
  "cost": {
    "wood": 10,
    "stone": 5
  },
  "production": {
    "wood": 1.0
  }
}
```

### Key Principles

1. **Centralized Storage**: All resource amounts stored in `GameState.settlement.resources`
2. **Data-Driven**: Resource types defined in JSON, not code
3. **Hot-Reloadable**: New resources can be added via JSON; refresh to see changes
4. **Backward Compatible**: Old saves automatically work with new resource system
5. **Idle Game Pattern**: Resources accumulate over time based on production rates

### Adding New Resources

**Step 1: Define in resources.json**
```json
{
  "id": "iron",
  "name": "Iron Ore",
  "icon": "⛏️",
  "description": "Metal ore for advanced crafting",
  "category": "material",
  "defaultMax": 50,
  "defaultStart": 0
}
```

**Step 2: (Optional) Add Buildings That Produce It**
```json
{
  "id": "ironMine",
  "name": "Iron Mine",
  "production": {
    "iron": 0.5
  }
}
```

**Step 3: Refresh the Game**
- New resource automatically appears in settlement UI
- Buildings can now produce/consume it
- Saved games preserve resource amounts

### Usage Rules

**✅ DO:**
- Store ALL resource amounts in `GameState.settlement.resources`
- Reference resources by ID from resources.json
- Use dynamic iteration when displaying resources
- Add new resources via JSON files only

**❌ DO NOT:**
- Hardcode resource types in JavaScript
- Store resource values outside GameState
- Create separate variables for resource tracking
- Modify settlement.js to add resources

### Example: Accessing Resources in Code

```javascript
// Get current wood amount
const wood = GameState.getState().settlement.resources.wood.current;

// Add wood
GameState.getState().settlement.resources.wood.current += 10;

// Check if enough resources for cost
const cost = { wood: 10, stone: 5 };
const canAfford = Object.keys(cost).every(resourceId => {
    return state.settlement.resources[resourceId].current >= cost[resourceId];
});
```

### Resource Generation

Resources are generated via the time system:
1. Buildings define production rates (per day)
2. `Settlement.onTimeAdvance(daysAdvanced)` called when time passes
3. Fractional resources accumulated in `resourceAccumulators`
4. Whole resources added to `settlement.resources[id].current`
5. Capped at `settlement.resources[id].max`

**See `js/settlement/settlement.js` for implementation details.**

---

## Item Classification System

### Overview
The game uses a flexible, data-driven classification system where items can have multiple classifications. Classifications are defined in `data/attributes.json` and applied to items in `data/items.json`.

### Key Principles

1. **Multiple Classifications**: Items can have multiple classifications (e.g., `["weapon", "one-handed", "melee"]`)
2. **Data-Driven**: All classifications are defined in attributes.json - no hardcoding in JavaScript
3. **Modular**: Adding new classifications requires NO code changes, only data updates
4. **Extensible**: Future systems can check for any classification to apply game logic

### Classification Types

#### Primary Types
- `weapon` - Can deal damage in combat
- `armor` - Provides defense
- `accessory` - Jewelry and trinkets
- `consumable` - Single-use items
- `material` - Crafting ingredients
- `tool` - Used for gathering resources
- `quest` - Quest-specific items

#### Hand Slot Types
- `one-handed` - Can be equipped in one hand
- `two-handed` - Requires both hands

#### Weapon Damage Types
- `melee` - Close-range physical weapons
- `ranged` - Distance weapons (bows, crossbows)
- `magic` - Magical weapons (wands, staves)

#### Special Types
- `shield` - Defensive off-hand equipment (NOT armor)

### Adding New Classifications

**Step 1: Define in attributes.json**
```json
{
  "id": "new_classification",
  "name": "Display Name",
  "description": "What this classification means"
}
```

**Step 2: Apply to Items**
```json
{
  "id": "item_id",
  "classifications": ["weapon", "two-handed", "new_classification"]
}
```

**Step 3: (Optional) Add Game Logic**
If the classification should DO something:
- Add logic to relevant systems (combat, inventory, etc.)
- Use `item.classifications.includes('new_classification')` to check

### Important Rules

**✅ DO:**
- Add classifications to both attributes.json AND items.json
- Use multiple classifications to describe items fully
- Keep classifications semantic and descriptive
- Update placeholder items in item-factory.js when changing classifications

**❌ DO NOT:**
- Hardcode classification checks without defining in attributes.json
- Use classifications as booleans (they are tags, not flags)
- Forget to update both items.json and item-factory.js placeholders
- Mix classification purposes (damage types vs item types)

### Weapon Type System Integration

Weapon damage types (melee/ranged/magic) integrate with the DamageCalculator:

1. Weapon has damage type in classifications: `["weapon", "one-handed", "melee"]`
2. DamageCalculator detects the damage type
3. Applies appropriate attribute multiplier (STR for melee, DEX for ranged, INT for magic)
4. Returns final calculated damage

**Without damage type classification**: Weapon deals base damage only (no multipliers)

### Example: Shield Classification

Shields demonstrate the flexibility of the system:
- **Before**: `["armor", "off_hand", "one-handed"]`
- **After**: `["off_hand", "one-handed", "shield"]`
- **Reason**: Shields are not armor; they're defensive equipment with unique mechanics

Future implementation could add:
- Block chance based on shield classification
- Shield-specific skills
- Shield bash abilities

---

## Notes
- This file will be appended with additional reminders and guidelines as development progresses
- Always maintain backward compatibility when updating JSON structures
- Include clear comments in sample entries for modder guidance
- When creating new data-driven systems, follow the JSON loading pattern above
- When displaying inventory, ALWAYS use the InventoryUI module
- When calculating damage, ALWAYS use the DamageCalculator module
