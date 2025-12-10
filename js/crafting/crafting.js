// ============================================
// Crafting Controller
// ============================================

const Crafting = (() => {
    let initialized = false;
    let discoveredRecipes = []; // Recipes the player has discovered
    let recipes = []; // Recipe database loaded from JSON
    let craftedItems = []; // Track items that have been crafted before
    let currentSelectedWeapon = 'longsword'; // Currently selected weapon type in assembly

    // Weapon type configurations for component-based assembly
    const weaponConfigurations = {
        longsword: {
            name: "Longsword",
            category: "One-Handed Melee",
            slots: [
                {
                    id: "blade",
                    label: "BLADE",
                    required: true,
                    accepts: "Longsword Blade, Broadsword Blade",
                    effect: "Primary damage source"
                },
                {
                    id: "handle",
                    label: "HANDLE",
                    required: true,
                    accepts: "One-Handed Handle, Leather Grip",
                    effect: "Affects swing speed, grip"
                },
                {
                    id: "guard",
                    label: "GUARD",
                    required: false,
                    accepts: "Crossguard, Full Guard",
                    effect: "+3-5 Defense"
                }
            ]
        },
        shortsword: {
            name: "Shortsword",
            category: "One-Handed Melee",
            slots: [
                {
                    id: "blade",
                    label: "BLADE",
                    required: true,
                    accepts: "Shortsword Blade",
                    effect: "Primary damage source"
                },
                {
                    id: "handle",
                    label: "HANDLE",
                    required: true,
                    accepts: "One-Handed Handle",
                    effect: "Affects swing speed"
                }
            ]
        },
        handaxe: {
            name: "Hand Axe",
            category: "One-Handed Melee",
            slots: [
                {
                    id: "head",
                    label: "AXE HEAD",
                    required: true,
                    accepts: "Hand Axe Head",
                    effect: "Primary damage source"
                },
                {
                    id: "handle",
                    label: "HANDLE",
                    required: true,
                    accepts: "One-Handed Handle, Oak Handle",
                    effect: "Affects durability"
                }
            ]
        },
        mace: {
            name: "Mace",
            category: "One-Handed Melee",
            slots: [
                {
                    id: "head",
                    label: "MACE HEAD",
                    required: true,
                    accepts: "Mace Head, Spiked Head",
                    effect: "Primary damage, armor penetration"
                },
                {
                    id: "handle",
                    label: "HANDLE",
                    required: true,
                    accepts: "One-Handed Handle",
                    effect: "Affects swing speed"
                }
            ]
        },
        dagger: {
            name: "Dagger",
            category: "One-Handed Melee",
            slots: [
                {
                    id: "blade",
                    label: "BLADE",
                    required: true,
                    accepts: "Dagger Blade",
                    effect: "Primary damage, critical chance"
                },
                {
                    id: "grip",
                    label: "GRIP",
                    required: true,
                    accepts: "Leather Grip, Cloth Wrap",
                    effect: "Affects accuracy"
                }
            ]
        },
        greatsword: {
            name: "Greatsword",
            category: "Two-Handed Melee",
            slots: [
                {
                    id: "blade",
                    label: "BLADE",
                    required: true,
                    accepts: "Greatsword Blade",
                    effect: "Primary damage source"
                },
                {
                    id: "handle",
                    label: "HANDLE",
                    required: true,
                    accepts: "Two-Handed Handle",
                    effect: "Affects swing speed, control"
                },
                {
                    id: "guard",
                    label: "GUARD",
                    required: false,
                    accepts: "Crossguard, Full Guard",
                    effect: "+5-7 Defense"
                },
                {
                    id: "pommel",
                    label: "POMMEL",
                    required: false,
                    accepts: "Heavy Pommel, Light Pommel",
                    effect: "Affects balance, +2-4 damage"
                }
            ]
        },
        battleaxe: {
            name: "Battleaxe",
            category: "Two-Handed Melee",
            slots: [
                {
                    id: "head",
                    label: "AXE HEAD",
                    required: true,
                    accepts: "Battleaxe Head, Double-Bit Head",
                    effect: "Primary damage source"
                },
                {
                    id: "handle",
                    label: "HANDLE",
                    required: true,
                    accepts: "Two-Handed Handle, Reinforced Shaft",
                    effect: "Affects durability, reach"
                },
                {
                    id: "counterweight",
                    label: "COUNTERWEIGHT",
                    required: false,
                    accepts: "Lead Weight, Iron Weight",
                    effect: "+3-5 damage, slower swing"
                }
            ]
        },
        warhammer: {
            name: "Warhammer",
            category: "Two-Handed Melee",
            slots: [
                {
                    id: "head",
                    label: "HAMMER HEAD",
                    required: true,
                    accepts: "Warhammer Head, Spiked Head",
                    effect: "Primary damage, armor penetration"
                },
                {
                    id: "handle",
                    label: "HANDLE",
                    required: true,
                    accepts: "Two-Handed Handle",
                    effect: "Affects reach, control"
                },
                {
                    id: "grip",
                    label: "GRIP",
                    required: false,
                    accepts: "Leather Grip, Cloth Wrap",
                    effect: "+5% accuracy"
                }
            ]
        },
        spear: {
            name: "Spear",
            category: "Two-Handed Melee",
            slots: [
                {
                    id: "head",
                    label: "SPEAR HEAD",
                    required: true,
                    accepts: "Spear Head, Barbed Head",
                    effect: "Primary damage source"
                },
                {
                    id: "shaft",
                    label: "SHAFT",
                    required: true,
                    accepts: "Long Shaft, Reinforced Shaft",
                    effect: "Affects reach, durability"
                },
                {
                    id: "butt",
                    label: "BUTT CAP",
                    required: false,
                    accepts: "Metal Cap, Spiked Cap",
                    effect: "Secondary damage, balance"
                }
            ]
        },
        shortbow: {
            name: "Shortbow",
            category: "Ranged Weapon",
            slots: [
                {
                    id: "limbs",
                    label: "LIMBS",
                    required: true,
                    accepts: "Flexible Limbs, Composite Limbs",
                    effect: "Determines draw weight, damage"
                },
                {
                    id: "string",
                    label: "STRING",
                    required: true,
                    accepts: "Sinew String, Hemp String",
                    effect: "Affects durability, accuracy"
                },
                {
                    id: "grip",
                    label: "GRIP",
                    required: false,
                    accepts: "Leather Grip, Cloth Wrap",
                    effect: "+3% accuracy"
                }
            ]
        },
        longbow: {
            name: "Longbow",
            category: "Ranged Weapon",
            slots: [
                {
                    id: "limbs",
                    label: "LIMBS",
                    required: true,
                    accepts: "Long Limbs, Yew Limbs",
                    effect: "Determines range, damage"
                },
                {
                    id: "string",
                    label: "STRING",
                    required: true,
                    accepts: "Sinew String, Silk String",
                    effect: "Affects accuracy, durability"
                },
                {
                    id: "grip",
                    label: "GRIP",
                    required: false,
                    accepts: "Leather Grip",
                    effect: "+5% accuracy"
                }
            ]
        },
        crossbow: {
            name: "Crossbow",
            category: "Ranged Weapon",
            slots: [
                {
                    id: "prod",
                    label: "PROD (BOW)",
                    required: true,
                    accepts: "Steel Prod, Composite Prod",
                    effect: "Primary damage source"
                },
                {
                    id: "stock",
                    label: "STOCK",
                    required: true,
                    accepts: "Wooden Stock, Reinforced Stock",
                    effect: "Affects stability, accuracy"
                },
                {
                    id: "trigger",
                    label: "TRIGGER",
                    required: true,
                    accepts: "Simple Trigger, Advanced Trigger",
                    effect: "Affects reload speed"
                },
                {
                    id: "sight",
                    label: "SIGHT",
                    required: false,
                    accepts: "Iron Sight, Precision Sight",
                    effect: "+8% accuracy"
                }
            ]
        },
        buckler: {
            name: "Buckler",
            category: "Shield",
            slots: [
                {
                    id: "face",
                    label: "SHIELD FACE",
                    required: true,
                    accepts: "Small Shield Face, Metal Face",
                    effect: "Primary defense"
                },
                {
                    id: "straps",
                    label: "STRAPS",
                    required: true,
                    accepts: "Leather Straps, Reinforced Straps",
                    effect: "Affects grip stability"
                }
            ]
        },
        roundshield: {
            name: "Round Shield",
            category: "Shield",
            slots: [
                {
                    id: "face",
                    label: "SHIELD FACE",
                    required: true,
                    accepts: "Round Shield Face, Reinforced Face",
                    effect: "Primary defense"
                },
                {
                    id: "boss",
                    label: "BOSS",
                    required: true,
                    accepts: "Iron Boss, Steel Boss",
                    effect: "Center reinforcement, +2 defense"
                },
                {
                    id: "straps",
                    label: "STRAPS",
                    required: false,
                    accepts: "Leather Straps, Chain Straps",
                    effect: "Affects maneuverability"
                }
            ]
        },
        towershield: {
            name: "Tower Shield",
            category: "Shield",
            slots: [
                {
                    id: "face",
                    label: "SHIELD FACE",
                    required: true,
                    accepts: "Large Shield Face, Heavy Face",
                    effect: "Primary defense, full body coverage"
                },
                {
                    id: "boss",
                    label: "BOSS",
                    required: true,
                    accepts: "Steel Boss, Reinforced Boss",
                    effect: "Center reinforcement, +5 defense"
                },
                {
                    id: "straps",
                    label: "STRAPS",
                    required: true,
                    accepts: "Reinforced Straps, Chain Straps",
                    effect: "Affects carry weight"
                }
            ]
        },
        helm: {
            name: "Helm",
            category: "Armor",
            slots: [
                {
                    id: "shell",
                    label: "SHELL",
                    required: true,
                    accepts: "Iron Shell, Steel Shell",
                    effect: "Primary defense"
                },
                {
                    id: "padding",
                    label: "PADDING",
                    required: true,
                    accepts: "Cloth Padding, Leather Padding",
                    effect: "Comfort, impact absorption"
                }
            ]
        },
        chestplate: {
            name: "Chestplate",
            category: "Armor",
            slots: [
                {
                    id: "plates",
                    label: "PLATES",
                    required: true,
                    accepts: "Iron Plates, Steel Plates",
                    effect: "Primary defense"
                },
                {
                    id: "padding",
                    label: "PADDING",
                    required: true,
                    accepts: "Cloth Padding, Leather Padding",
                    effect: "Comfort, mobility"
                },
                {
                    id: "straps",
                    label: "STRAPS",
                    required: true,
                    accepts: "Leather Straps, Chain Straps",
                    effect: "Secure fit"
                }
            ]
        },
        gauntlets: {
            name: "Gauntlets",
            category: "Armor",
            slots: [
                {
                    id: "plates",
                    label: "PLATES",
                    required: true,
                    accepts: "Iron Plates, Steel Plates",
                    effect: "Hand protection"
                },
                {
                    id: "lining",
                    label: "LINING",
                    required: false,
                    accepts: "Cloth Lining, Leather Lining",
                    effect: "Comfort, dexterity"
                }
            ]
        },
        greaves: {
            name: "Greaves",
            category: "Armor",
            slots: [
                {
                    id: "plates",
                    label: "PLATES",
                    required: true,
                    accepts: "Iron Plates, Steel Plates",
                    effect: "Leg protection"
                },
                {
                    id: "straps",
                    label: "STRAPS",
                    required: true,
                    accepts: "Leather Straps",
                    effect: "Secure fit"
                }
            ]
        },
        boots: {
            name: "Boots",
            category: "Armor",
            slots: [
                {
                    id: "outer",
                    label: "OUTER SHELL",
                    required: true,
                    accepts: "Leather Outer, Reinforced Leather",
                    effect: "Durability, protection"
                },
                {
                    id: "sole",
                    label: "SOLE",
                    required: true,
                    accepts: "Thick Sole, Rubber Sole",
                    effect: "Movement, traction"
                },
                {
                    id: "lining",
                    label: "LINING",
                    required: false,
                    accepts: "Cloth Lining, Fur Lining",
                    effect: "Comfort, warmth"
                }
            ]
        }
    };

    // Weapon categories for navigation menu
    const weaponCategories = [
        {
            id: "one-handed",
            name: "ONE-HANDED WEAPONS",
            expanded: true,
            items: [
                { id: "longsword", name: "Longsword" },
                { id: "shortsword", name: "Shortsword" },
                { id: "handaxe", name: "Hand Axe" },
                { id: "mace", name: "Mace" },
                { id: "dagger", name: "Dagger" }
            ]
        },
        {
            id: "two-handed",
            name: "TWO-HANDED WEAPONS",
            expanded: true,
            items: [
                { id: "greatsword", name: "Greatsword" },
                { id: "battleaxe", name: "Battleaxe" },
                { id: "warhammer", name: "Warhammer" },
                { id: "spear", name: "Spear" }
            ]
        },
        {
            id: "ranged",
            name: "RANGED WEAPONS",
            expanded: true,
            items: [
                { id: "shortbow", name: "Shortbow" },
                { id: "longbow", name: "Longbow" },
                { id: "crossbow", name: "Crossbow" }
            ]
        },
        {
            id: "shields",
            name: "SHIELDS",
            expanded: true,
            items: [
                { id: "buckler", name: "Buckler" },
                { id: "roundshield", name: "Round Shield" },
                { id: "towershield", name: "Tower Shield" }
            ]
        },
        {
            id: "armor",
            name: "ARMOR",
            expanded: true,
            items: [
                { id: "helm", name: "Helm" },
                { id: "chestplate", name: "Chestplate" },
                { id: "gauntlets", name: "Gauntlets" },
                { id: "greaves", name: "Greaves" },
                { id: "boots", name: "Boots" }
            ]
        }
    ];

    async function loadRecipes() {
        try {
            const response = await fetch('data/recipes.json');
            const data = await response.json();
            recipes = data.recipes || [];
            // Recipes loaded from JSON
        } catch (error) {
            console.error('Failed to load recipes:', error);
            recipes = [];
        }
    }

    async function init() {
        // Crafting initializing

        // Load recipes from JSON file
        await loadRecipes();

        // Load discovered recipes from localStorage
        loadDiscoveredRecipes();

        // Load crafted items history from localStorage
        loadCraftedItems();

        // Initialize sub-tabs
        initializeSubTabs();
    }

    function initializeSubTabs() {
        // Initialize sub-tab system using centralized SubTabManager
        if (window.SubTabManager) {
            SubTabManager.initSubTabs(
                'crafting',                        // Parent tab name
                '.crafting-nav-tab',               // Button selector
                '.crafting-tab-content',           // Content selector
                'data-crafting-tab',               // Data attribute
                'crafting-',                       // Content ID prefix
                '-content',                        // Content ID suffix
                null                               // No callback needed
            );
        }

        // Initialize assembly system
        initializeAssemblySystem();
    }

    function initializeAssemblySystem() {
        // Render weapon categories navigation
        renderWeaponCategories();

        // Render placeholder component inventory
        renderPlaceholderComponents();

        // Render initial assembly station (longsword by default)
        renderAssemblyStation(currentSelectedWeapon);

        // Setup Clear All button
        const clearBtn = document.getElementById('clear-assembly-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', clearAllSlots);
        }
    }

    function refreshFromSaveData() {
        // Load category states from GameState (called after save is loaded)
        loadCategoryStates();
        // Re-render to apply loaded states
        renderWeaponCategories();
    }

    function loadCategoryStates() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (state && state.craftingCategoryStates) {
            // Restore expansion states from saved data
            Object.keys(state.craftingCategoryStates).forEach(categoryId => {
                const category = weaponCategories.find(c => c.id === categoryId);
                if (category) {
                    category.expanded = state.craftingCategoryStates[categoryId];
                }
            });
        }
    }

    function saveCategoryStates() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (state) {
            // Save expansion states
            const categoryStates = {};
            weaponCategories.forEach(category => {
                categoryStates[category.id] = category.expanded;
            });
            state.craftingCategoryStates = categoryStates;

            // Trigger main save system
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }
    }

    function renderWeaponCategories() {
        const container = document.querySelector('.weapon-categories');
        if (!container) return;

        container.innerHTML = '';

        weaponCategories.forEach(category => {
            const categoryEl = document.createElement('div');
            categoryEl.className = 'weapon-category';

            // Category header
            const header = document.createElement('div');
            header.className = 'weapon-category-header';
            header.innerHTML = `
                <span class="category-icon">${category.expanded ? '▼' : '▶'}</span>
                <span class="category-name">${category.name}</span>
            `;
            header.addEventListener('click', () => toggleCategory(category.id));

            categoryEl.appendChild(header);

            // Category items
            const itemsList = document.createElement('div');
            itemsList.className = `weapon-category-items ${category.expanded ? 'expanded' : ''}`;

            category.items.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = `weapon-type-item ${item.id === currentSelectedWeapon ? 'selected' : ''}`;
                itemEl.textContent = item.name;
                itemEl.dataset.weaponId = item.id;
                itemEl.addEventListener('click', () => selectWeaponType(item.id));
                itemsList.appendChild(itemEl);
            });

            categoryEl.appendChild(itemsList);
            container.appendChild(categoryEl);
        });
    }

    function toggleCategory(categoryId) {
        const category = weaponCategories.find(c => c.id === categoryId);
        if (!category) return;

        category.expanded = !category.expanded;
        saveCategoryStates(); // Save to GameState
        renderWeaponCategories(); // Re-render to update UI
    }

    function selectWeaponType(weaponId) {
        currentSelectedWeapon = weaponId;

        // Update selected state in navigation
        document.querySelectorAll('.weapon-type-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.weaponId === weaponId);
        });

        // Re-render assembly station with new weapon configuration
        renderAssemblyStation(weaponId);
    }

    function renderAssemblyStation(weaponId) {
        const config = weaponConfigurations[weaponId];
        if (!config) return;

        // Update header
        const nameEl = document.querySelector('.assembly-weapon-name');
        const categoryEl = document.querySelector('.assembly-weapon-category');
        if (nameEl) nameEl.textContent = `CRAFTING: ${config.name.toUpperCase()}`;
        if (categoryEl) categoryEl.textContent = `(${config.category})`;

        // Render slots
        const slotsContainer = document.querySelector('.assembly-slots-container');
        if (!slotsContainer) return;

        slotsContainer.innerHTML = '';

        config.slots.forEach(slot => {
            const slotEl = document.createElement('div');
            slotEl.className = 'assembly-slot';
            slotEl.dataset.slotId = slot.id;

            slotEl.innerHTML = `
                <div class="slot-header">
                    <span class="slot-label">${slot.label}</span>
                </div>
                <div class="slot-dropzone">
                    <div class="slot-placeholder">[Drop ${slot.label.toLowerCase()} component here]</div>
                </div>
                <div class="slot-info">
                    <div class="slot-accepts">Accepts: ${slot.accepts}</div>
                    <div class="slot-effect">Effect: </div>
                </div>
            `;

            slotsContainer.appendChild(slotEl);
        });

        // Update validation message
        updateValidationMessage();
    }

    function updateValidationMessage() {
        const config = weaponConfigurations[currentSelectedWeapon];
        if (!config) return;

        const requiredSlots = config.slots.filter(s => s.required);
        const missingLabels = requiredSlots.map(s => s.label).join(', ');

        const validationEl = document.querySelector('.validation-message');
        if (validationEl) {
            validationEl.textContent = `✗ Missing required: ${missingLabels}`;
        }
    }

    function clearAllSlots() {
        // Re-render the current assembly station to reset all slots
        renderAssemblyStation(currentSelectedWeapon);
    }

    function renderPlaceholderComponents() {
        const container = document.querySelector('.component-placeholder-cards');
        if (!container) return;

        // Clear placeholder components - they will be populated when actual components exist
        container.innerHTML = '';
    }

    function switchCraftingTab(tabName) {
        // Use centralized SubTabManager to switch tabs
        if (window.SubTabManager) {
            SubTabManager.switchSubTab(
                'crafting',
                tabName,
                '.crafting-nav-tab',
                '.crafting-tab-content',
                'data-crafting-tab',
                'crafting-',
                '-content',
                null
            );
        }
    }

    function loadDiscoveredRecipes() {
        // Load from GameState (new method)
        const state = window.GameState ? window.GameState.getState() : null;
        if (state && state.discoveredRecipes && Array.isArray(state.discoveredRecipes)) {
            discoveredRecipes = state.discoveredRecipes.map(id => recipes.find(r => r.id === id)).filter(r => r);
            return;
        }

        // MIGRATION: Try loading from old localStorage location
        const saved = localStorage.getItem('discoveredRecipes');
        if (saved) {
            try {
                const recipeIds = JSON.parse(saved);
                discoveredRecipes = recipeIds.map(id => recipes.find(r => r.id === id)).filter(r => r);

                // Migrate to GameState
                if (state) {
                    state.discoveredRecipes = recipeIds;
                    console.log(`Migrated ${recipeIds.length} discovered recipes from localStorage to GameState`);
                }

                // Clear old localStorage
                localStorage.removeItem('discoveredRecipes');
            } catch (error) {
                console.error('Failed to load discovered recipes:', error);
                discoveredRecipes = [];
            }
        } else {
            discoveredRecipes = [];
        }
    }

    function saveDiscoveredRecipes() {
        const recipeIds = discoveredRecipes.map(r => r.id);

        // Save to GameState (new method)
        const state = window.GameState ? window.GameState.getState() : null;
        if (state) {
            state.discoveredRecipes = recipeIds;

            // Trigger main save system
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }
    }

    function loadCraftedItems() {
        // Load from GameState (new method)
        const state = window.GameState ? window.GameState.getState() : null;
        if (state && state.craftedItems && Array.isArray(state.craftedItems)) {
            craftedItems = state.craftedItems;
            console.log(`✅ Loaded ${craftedItems.length} crafted items from GameState:`, craftedItems);
            return;
        }

        // MIGRATION: Try loading from old localStorage location
        const saved = localStorage.getItem('craftedItems');
        if (saved) {
            try {
                craftedItems = JSON.parse(saved);

                // Migrate to GameState
                if (state) {
                    state.craftedItems = craftedItems;
                    console.log(`Migrated ${craftedItems.length} crafted items from localStorage to GameState`);
                }

                // Clear old localStorage
                localStorage.removeItem('craftedItems');
            } catch (error) {
                console.error('Failed to load crafted items:', error);
                craftedItems = [];
            }
        } else {
            craftedItems = [];
        }
    }

    function saveCraftedItems() {
        // Save to GameState (new method)
        const state = window.GameState ? window.GameState.getState() : null;
        if (state) {
            state.craftedItems = craftedItems;

            // Trigger main save system
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }
    }

    function isNewItem(itemName) {
        return !craftedItems.includes(itemName);
    }

    function markItemAsCrafted(itemName) {
        if (!craftedItems.includes(itemName)) {
            craftedItems.push(itemName);
            saveCraftedItems();
        }
    }


    return {
        init,
        refreshFromSaveData
    };
})();

window.Crafting = Crafting;
