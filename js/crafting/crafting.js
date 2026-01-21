// ============================================
// Crafting Controller
// ============================================

const Crafting = (() => {
    let initialized = false;
    let discoveredRecipes = []; // Recipes the player has discovered
    let recipes = []; // Recipe database loaded from JSON
    let craftedItems = []; // Track items that have been crafted before
    let currentSelectedWeapon = 'longsword'; // Currently selected weapon type in assembly
    let placedComponents = {}; // Track which items are placed in which slots { slotId: { itemId, baseId, count } }

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
        },
        // Tool recipes
        makeshift_axe: {
            name: "Makeshift Axe",
            category: "Tool",
            slots: [
                {
                    id: "stick",
                    label: "STICK (x1)",
                    required: true,
                    accepts: "Stick",
                    effect: "Required material"
                },
                {
                    id: "rock",
                    label: "ROCK (x1)",
                    required: true,
                    accepts: "Rock",
                    effect: "Required material"
                },
                {
                    id: "fiber",
                    label: "FIBER (x3)",
                    required: true,
                    accepts: "Fiber",
                    effect: "Required material"
                }
            ]
        },
        makeshift_pickaxe: {
            name: "Makeshift Pickaxe",
            category: "Tool",
            slots: [
                {
                    id: "stick",
                    label: "STICK (x1)",
                    required: true,
                    accepts: "Stick",
                    effect: "Required material"
                },
                {
                    id: "rock",
                    label: "ROCK (x2)",
                    required: true,
                    accepts: "Rock",
                    effect: "Required material"
                },
                {
                    id: "fiber",
                    label: "FIBER (x4)",
                    required: true,
                    accepts: "Fiber",
                    effect: "Required material"
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
        },
        {
            id: "makeshift-tools",
            name: "MAKESHIFT TOOLS",
            expanded: true,
            items: [
                { id: "makeshift_axe", name: "Makeshift Axe" },
                { id: "makeshift_pickaxe", name: "Makeshift Pickaxe" }
            ]
        },
        {
            id: "pickaxes",
            name: "PICKAXES",
            expanded: true,
            items: [
                // Add proper pickaxe recipes here (not makeshift)
            ]
        },
        {
            id: "axes",
            name: "AXES",
            expanded: true,
            items: [
                // Add proper axe tool recipes here (not makeshift, not weapons)
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

    /**
     * Check if a recipe's requirements are met
     * @param {Object} recipe - Recipe object from recipes.json
     * @returns {boolean} - True if all requirements are met
     */
    function checkRecipeRequirements(recipeId) {
        // Find the recipe in the recipes array
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) return true; // If no recipe found, allow it (might be hardcoded weapon)

        // If no unlock requirements defined, recipe is always available
        if (!recipe.unlockRequirements) return true;

        const requirements = recipe.unlockRequirements;
        const state = window.GameState ? window.GameState.getState() : null;

        // Check research requirements
        if (requirements.research) {
            if (!state || !state.researchedNodes) return false;
            if (!state.researchedNodes.includes(requirements.research)) {
                return false;
            }
        }

        // Check level requirements
        if (requirements.level) {
            const character = state ? state.character : null;
            if (!character || character.level < requirements.level) {
                return false;
            }
        }

        // Check skill requirements
        if (requirements.skills && requirements.skills.length > 0) {
            const character = state ? state.character : null;
            if (!character || !character.skills) return false;

            for (const skillReq of requirements.skills) {
                const skill = character.skills.find(s => s.name === skillReq.name);
                if (!skill || skill.level < skillReq.level) {
                    return false;
                }
            }
        }

        return true;
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
        // Load placed components from save data
        loadPlacedComponents();

        // Load component filter selection
        loadComponentFilter();

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

        // Setup Craft Item button
        const craftBtn = document.getElementById('craft-item-btn');
        if (craftBtn) {
            craftBtn.addEventListener('click', craftItem);
        }

        // Listen for inventory changes to update validation message and components in real-time
        document.addEventListener('inventoryChanged', () => {
            updateValidationMessage();
            renderPlaceholderComponents();
        });

        // Setup component filter dropdown
        const filterDropdown = document.querySelector('.component-filter-dropdown');
        if (filterDropdown) {
            filterDropdown.addEventListener('change', (e) => {
                // Save the filter selection
                saveComponentFilter();
                // Re-render components with new filter
                renderPlaceholderComponents();
            });
        }
    }

    function refreshFromSaveData() {
        // Load category states from GameState (called after save is loaded)
        loadCategoryStates();
        // Load selected weapon from GameState
        loadSelectedWeapon();
        // Load placed components from GameState
        loadPlacedComponents();
        // Load component filter from GameState
        loadComponentFilter();
        // Re-render to apply loaded states
        renderWeaponCategories();
        // Re-render assembly station with saved selection
        if (currentSelectedWeapon) {
            renderAssemblyStation(currentSelectedWeapon);
        }
        // Re-render components with saved filter
        renderPlaceholderComponents();
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

    function loadSelectedWeapon() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (state && state.craftingSelectedWeapon) {
            currentSelectedWeapon = state.craftingSelectedWeapon;
        }
    }

    function loadPlacedComponents() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (state && state.craftingPlacedComponents) {
            placedComponents = state.craftingPlacedComponents;
        }
    }

    function savePlacedComponents() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (state) {
            state.craftingPlacedComponents = placedComponents;

            // Trigger main save system
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }
    }

    function loadComponentFilter() {
        const state = window.GameState ? window.GameState.getState() : null;
        const filterDropdown = document.querySelector('.component-filter-dropdown');
        if (filterDropdown && state && state.craftingComponentFilter) {
            filterDropdown.value = state.craftingComponentFilter;
        }
    }

    function saveComponentFilter() {
        const filterDropdown = document.querySelector('.component-filter-dropdown');
        if (!filterDropdown) return;

        const state = window.GameState ? window.GameState.getState() : null;
        if (state) {
            state.craftingComponentFilter = filterDropdown.value;

            // Trigger main save system
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }
    }

    function saveSelectedWeapon() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (state) {
            state.craftingSelectedWeapon = currentSelectedWeapon;

            // Trigger main save system
            if (window.SaveSystem) {
                SaveSystem.save();
            }
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
            // Skip hidden categories (empty tool categories)
            if (category.hidden) return;

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

            // Filter items based on requirements
            const availableItems = category.items.filter(item => checkRecipeRequirements(item.id));

            availableItems.forEach(item => {
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
        // Check if we're switching to a different weapon type
        const isChangingWeapon = currentSelectedWeapon !== weaponId;

        // If switching weapons, return all placed components to inventory first
        if (isChangingWeapon && Object.keys(placedComponents).length > 0) {
            // Return all placed components to inventory
            Object.keys(placedComponents).forEach(slotId => {
                const placed = placedComponents[slotId];
                if (placed) {
                    // Add item back to inventory
                    const state = window.GameState ? window.GameState.getState() : null;
                    const character = state ? state.character : null;
                    if (character && window.Inventory) {
                        // Add count items back to inventory
                        for (let i = 0; i < placed.count; i++) {
                            const item = window.ItemFactory.createItem(placed.baseId);
                            if (item) {
                                window.Inventory.addItem(character.inventory, item);
                            }
                        }
                    }
                }
            });

            // Clear the placedComponents object
            placedComponents = {};

            // Save to GameState
            savePlacedComponents();

            // Trigger inventory update event
            document.dispatchEvent(new CustomEvent('inventoryChanged'));

            // Re-render components to update quantities
            renderPlaceholderComponents();
        }

        currentSelectedWeapon = weaponId;

        // Update selected state in navigation
        document.querySelectorAll('.weapon-type-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.weaponId === weaponId);
        });

        // Re-render assembly station with new weapon configuration
        renderAssemblyStation(weaponId);

        // Save selected weapon to GameState
        saveSelectedWeapon();
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

            // Check if this slot has a placed component
            const placedItem = placedComponents[slot.id];

            if (placedItem) {
                // Slot is filled
                slotEl.innerHTML = `
                    <div class="slot-header">
                        <span class="slot-label">${slot.label}</span>
                    </div>
                    <div class="slot-dropzone filled">
                        <div class="slot-filled-content">
                            <div class="slot-item-icon">${placedItem.icon}</div>
                            <div class="slot-item-name">${placedItem.name}</div>
                        </div>
                    </div>
                    <div class="slot-info">
                        <div class="slot-accepts">Accepts: ${slot.accepts}</div>
                    </div>
                `;
            } else {
                // Slot is empty
                slotEl.innerHTML = `
                    <div class="slot-header">
                        <span class="slot-label">${slot.label}</span>
                    </div>
                    <div class="slot-dropzone">
                        <div class="slot-placeholder">[Drop ${slot.label.toLowerCase()} component here]</div>
                    </div>
                    <div class="slot-info">
                        <div class="slot-accepts">Accepts: ${slot.accepts}</div>
                    </div>
                `;
            }

            // Add drag and drop event listeners
            const dropzone = slotEl.querySelector('.slot-dropzone');

            dropzone.addEventListener('dragover', (e) => {
                e.preventDefault();

                // Don't highlight if slot is already filled
                if (placedComponents[slot.id]) {
                    dropzone.classList.add('drag-over-invalid');
                    return;
                }

                dropzone.classList.add('drag-over');
            });

            dropzone.addEventListener('dragleave', (e) => {
                dropzone.classList.remove('drag-over');
                dropzone.classList.remove('drag-over-invalid');
            });

            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('drag-over');
                dropzone.classList.remove('drag-over-invalid');

                // Don't allow dropping on filled slots
                if (placedComponents[slot.id]) {
                    return;
                }

                try {
                    const data = JSON.parse(e.dataTransfer.getData('application/json'));
                    handleComponentDrop(slot.id, data);
                } catch (error) {
                    console.error('Failed to parse drag data:', error);
                }
            });

            // Add click handler to remove item from slot
            if (placedItem) {
                dropzone.addEventListener('click', () => {
                    handleRemoveComponent(slot.id);
                });
                dropzone.style.cursor = 'pointer';
            }

            slotsContainer.appendChild(slotEl);
        });

        // Update validation message
        updateValidationMessage();
    }

    function updateValidationMessage() {
        const config = weaponConfigurations[currentSelectedWeapon];
        if (!config) return;

        // Find the corresponding recipe in recipes.json
        const recipe = recipes.find(r => r.id === currentSelectedWeapon);
        if (!recipe || !recipe.inputs || recipe.inputs.length === 0) {
            // No recipe data, show generic message
            const requiredSlots = config.slots.filter(s => s.required);
            const missingLabels = requiredSlots.map(s => s.label).join(', ');
            const validationEl = document.querySelector('.validation-message');
            if (validationEl) {
                validationEl.textContent = `Required materials: ${missingLabels}`;
            }
            return;
        }

        // Check if all slots are filled
        const allSlotsFilled = config.slots.every(slot => {
            if (slot.required) {
                return placedComponents[slot.id] !== undefined;
            }
            return true; // Optional slots don't need to be filled
        });

        // Get character inventory
        const state = window.GameState ? window.GameState.getState() : null;
        const character = state ? state.character : null;
        if (!character || !character.inventory) {
            return;
        }

        // Get stacked items to count materials
        const stackedItems = window.Inventory ? window.Inventory.getStackedItems(character.inventory) : [];

        // Helper function to extract base item ID from generated ID
        // ItemFactory generates IDs like "stick_1768412508210_i8nnsekvp"
        // Format: baseId_timestamp_randomString
        // Timestamp is 13 digits (milliseconds since epoch)
        const getBaseItemId = (itemId) => {
            const parts = itemId.split('_');
            if (parts.length >= 3) {
                // Find the timestamp part (13-digit number)
                let baseIdParts = [];
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    // Check if this part is the timestamp (13 digits, all numeric)
                    if (!isNaN(part) && part.length === 13) {
                        // Everything before this is the base ID
                        break;
                    }
                    baseIdParts.push(part);
                }
                return baseIdParts.join('_');
            }
            return itemId; // Fallback to full ID
        };

        // Build material requirements display
        let allMaterialsAvailable = true;
        const materialsList = recipe.inputs.map(input => {
            // Find the material in stacked items by matching base item ID
            const stack = stackedItems.find(s => {
                const baseId = getBaseItemId(s.item.id);
                return baseId === input.itemId;
            });
            const currentCount = stack ? stack.quantity : 0;
            const requiredCount = input.count;

            // Get material name (capitalize first letter)
            const materialName = input.itemId.toUpperCase().replace(/_/g, ' ');

            // Check if player has enough
            const hasEnough = currentCount >= requiredCount;
            if (!hasEnough) {
                allMaterialsAvailable = false;
            }
            const icon = hasEnough ? '✓' : '✗';

            return `${icon} ${materialName} (${currentCount}/${requiredCount})`;
        }).join(', ');

        const validationEl = document.querySelector('.validation-message');
        if (validationEl) {
            validationEl.textContent = `Required materials: ${materialsList}`;

            // Update class based on whether all materials are available
            if (allMaterialsAvailable) {
                validationEl.classList.add('materials-available');
                validationEl.classList.remove('materials-missing');
            } else {
                validationEl.classList.add('materials-missing');
                validationEl.classList.remove('materials-available');
            }
        }

        // Enable/disable craft button based on whether all required slots are filled
        const craftBtn = document.getElementById('craft-item-btn');
        if (craftBtn) {
            craftBtn.disabled = !allSlotsFilled;
        }
    }

    function craftItem() {
        // Get the recipe
        const recipe = recipes.find(r => r.id === currentSelectedWeapon);
        if (!recipe) {
            console.error('Recipe not found:', currentSelectedWeapon);
            return;
        }

        // Get character
        const state = window.GameState ? window.GameState.getState() : null;
        const character = state ? state.character : null;
        if (!character) {
            console.error('Character not found');
            return;
        }

        // Create the crafted item
        const craftedItem = window.ItemFactory.createItem(recipe.outputItemId);
        if (!craftedItem) {
            console.error('Failed to create item:', recipe.outputItemId);
            return;
        }

        // Add to inventory
        window.Inventory.addItem(character.inventory, craftedItem);

        // Award Smithing XP
        if (window.SkillManager) {
            // Determine XP based on item tier/complexity
            let xpAmount = 10; // Base XP for basic items

            // Check item classifications for tier
            if (craftedItem.classifications) {
                // Higher tier items give more XP
                if (craftedItem.name.toLowerCase().includes('iron')) {
                    xpAmount = 25;
                } else if (craftedItem.name.toLowerCase().includes('steel') || craftedItem.name.toLowerCase().includes('refined')) {
                    xpAmount = 50;
                } else if (craftedItem.name.toLowerCase().includes('masterwork') || craftedItem.name.toLowerCase().includes('legendary')) {
                    xpAmount = 100;
                }

                // Weapons and armor give more XP than tools
                if (craftedItem.classifications.includes('weapon')) {
                    xpAmount += 5;
                } else if (craftedItem.classifications.includes('armor')) {
                    xpAmount += 3;
                }
            }

            SkillManager.addSkillXP(character, 'smithing', xpAmount);
            console.log(`Awarded ${xpAmount} Smithing XP for crafting ${craftedItem.name}`);
        }

        // Clear placed components (items already removed from inventory when placed)
        placedComponents = {};
        savePlacedComponents();

        // Re-render UI
        renderAssemblyStation(currentSelectedWeapon);
        renderPlaceholderComponents();

        // Trigger inventory update
        document.dispatchEvent(new CustomEvent('inventoryChanged'));

        // Show success message
        console.log(`Successfully crafted: ${craftedItem.name}`);
    }

    function clearAllSlots() {
        // Return all placed components to inventory
        Object.keys(placedComponents).forEach(slotId => {
            const placed = placedComponents[slotId];
            if (placed) {
                // Add item back to inventory
                const state = window.GameState ? window.GameState.getState() : null;
                const character = state ? state.character : null;
                if (character && window.Inventory) {
                    // Add count items back to inventory
                    for (let i = 0; i < placed.count; i++) {
                        const item = window.ItemFactory.createItem(placed.baseId);
                        if (item) {
                            window.Inventory.addItem(character.inventory, item);
                        }
                    }
                }
            }
        });

        // Clear the placedComponents object
        placedComponents = {};

        // Save to GameState
        savePlacedComponents();

        // Re-render the current assembly station to reset all slots
        renderAssemblyStation(currentSelectedWeapon);

        // Re-render components to update quantities
        renderPlaceholderComponents();

        // Trigger inventory update event
        document.dispatchEvent(new CustomEvent('inventoryChanged'));
    }

    function handleComponentDrop(slotId, draggedData) {
        // Get the weapon configuration to check slot requirements
        const config = weaponConfigurations[currentSelectedWeapon];
        if (!config) return;

        // Find the slot definition
        const slotDef = config.slots.find(s => s.id === slotId);
        if (!slotDef) return;

        // Check if the dropped item is accepted by this slot
        // The "accepts" field contains comma-separated component names
        const acceptedItems = slotDef.accepts.split(',').map(item => item.trim().toLowerCase());
        const droppedItemName = draggedData.name.toLowerCase();

        // Check if the dropped item matches any of the accepted items
        const isAccepted = acceptedItems.some(accepted => {
            // Match either exact name or if the accepted name is contained in the item name
            return droppedItemName === accepted || droppedItemName.includes(accepted) || accepted.includes(droppedItemName);
        });

        if (!isAccepted) {
            // This slot doesn't accept this item type
            console.log(`Slot "${slotDef.label}" does not accept "${draggedData.name}". Accepts: ${slotDef.accepts}`);
            return;
        }

        // Get the recipe to check required quantities
        const recipe = recipes.find(r => r.id === currentSelectedWeapon);
        if (!recipe || !recipe.inputs) {
            return;
        }

        // Find how many of this item the recipe needs
        const recipeInput = recipe.inputs.find(input => input.itemId === draggedData.baseId);
        if (!recipeInput) {
            // This item isn't needed for this recipe
            return;
        }

        const requiredCount = recipeInput.count;

        // Check if player has enough
        if (draggedData.quantity < requiredCount) {
            return;
        }

        // Get character and inventory
        const state = window.GameState ? window.GameState.getState() : null;
        const character = state ? state.character : null;
        if (!character || !window.Inventory) {
            return;
        }

        // Remove required quantity from inventory
        let removedCount = 0;
        const inventoryItems = character.inventory.items || [];

        for (let i = inventoryItems.length - 1; i >= 0 && removedCount < requiredCount; i--) {
            const item = inventoryItems[i];
            // Extract base ID to match
            const parts = item.id.split('_');
            let baseIdParts = [];
            for (let j = 0; j < parts.length; j++) {
                const part = parts[j];
                if (!isNaN(part) && part.length === 13) {
                    break;
                }
                baseIdParts.push(part);
            }
            const itemBaseId = baseIdParts.join('_');

            if (itemBaseId === draggedData.baseId) {
                window.Inventory.removeItem(character.inventory, item.id);
                removedCount++;
            }
        }

        // Place the component in the slot
        placedComponents[slotId] = {
            itemId: draggedData.itemId,
            baseId: draggedData.baseId,
            name: draggedData.name,
            icon: draggedData.icon,
            count: requiredCount
        };

        // Save to GameState
        savePlacedComponents();

        // Re-render assembly station to show filled slot
        renderAssemblyStation(currentSelectedWeapon);

        // Re-render components to update quantities
        renderPlaceholderComponents();

        // Trigger inventory update event
        document.dispatchEvent(new CustomEvent('inventoryChanged'));
    }

    function handleRemoveComponent(slotId) {
        const placed = placedComponents[slotId];
        if (!placed) return;

        // Add items back to inventory
        const state = window.GameState ? window.GameState.getState() : null;
        const character = state ? state.character : null;
        if (character && window.Inventory) {
            // Add count items back to inventory
            for (let i = 0; i < placed.count; i++) {
                const item = window.ItemFactory.createItem(placed.baseId);
                if (item) {
                    window.Inventory.addItem(character.inventory, item);
                }
            }
        }

        // Remove from placedComponents
        delete placedComponents[slotId];

        // Save to GameState
        savePlacedComponents();

        // Re-render assembly station
        renderAssemblyStation(currentSelectedWeapon);

        // Re-render components to update quantities
        renderPlaceholderComponents();

        // Trigger inventory update event
        document.dispatchEvent(new CustomEvent('inventoryChanged'));
    }

    function handleAutoPlaceComponent(itemData) {
        // Get the weapon configuration
        const config = weaponConfigurations[currentSelectedWeapon];
        if (!config) return;

        // Find the first available slot that accepts this item
        for (const slot of config.slots) {
            // Skip if slot is already filled
            if (placedComponents[slot.id]) {
                continue;
            }

            // Check if this slot accepts the item
            const acceptedItems = slot.accepts.split(',').map(item => item.trim().toLowerCase());
            const itemName = itemData.name.toLowerCase();

            const isAccepted = acceptedItems.some(accepted => {
                return itemName === accepted || itemName.includes(accepted) || accepted.includes(itemName);
            });

            if (isAccepted) {
                // Found a matching slot, try to place the item
                handleComponentDrop(slot.id, itemData);
                return; // Stop after placing in first available slot
            }
        }

        // If we get here, no available slot was found
        console.log(`No available slot accepts "${itemData.name}"`);
    }

    function renderPlaceholderComponents() {
        const container = document.querySelector('.component-placeholder-cards');
        if (!container) return;

        // Get character inventory
        const state = window.GameState ? window.GameState.getState() : null;
        const character = state ? state.character : null;
        if (!character || !character.inventory) {
            container.innerHTML = '';
            return;
        }

        // Get current filter selection
        const filterDropdown = document.querySelector('.component-filter-dropdown');
        const filterValue = filterDropdown ? filterDropdown.value : 'all';

        // Get stacked items to count materials
        const stackedItems = window.Inventory ? window.Inventory.getStackedItems(character.inventory) : [];

        // Helper function to extract base item ID (same as in updateValidationMessage)
        const getBaseItemId = (itemId) => {
            const parts = itemId.split('_');
            if (parts.length >= 3) {
                let baseIdParts = [];
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    if (!isNaN(part) && part.length === 13) {
                        break;
                    }
                    baseIdParts.push(part);
                }
                return baseIdParts.join('_');
            }
            return itemId;
        };

        // Define material categories
        const basicMaterialIds = ['stick', 'rock', 'fiber'];
        // Add more categories here in the future (blades, handles, guards, etc.)

        // Filter materials based on selected category
        let filteredMaterials;
        if (filterValue === 'all') {
            // Show all materials (anything with "material" classification)
            filteredMaterials = stackedItems.filter(stack => {
                return stack.item.classifications && stack.item.classifications.includes('material');
            });
        } else if (filterValue === 'basics') {
            // Show only basic materials
            filteredMaterials = stackedItems.filter(stack => {
                const baseId = getBaseItemId(stack.item.id);
                return basicMaterialIds.includes(baseId);
            });
        } else {
            // Other categories (blades, handles, guards) - empty for now
            filteredMaterials = [];
        }

        // Clear container
        container.innerHTML = '';

        // Render each material as a component card
        filteredMaterials.forEach(stack => {
            const card = document.createElement('div');
            card.className = 'component-card';
            card.draggable = true;

            const baseId = getBaseItemId(stack.item.id);

            card.innerHTML = `
                <div class="component-icon">${stack.item.icon || '📦'}</div>
                <div class="component-name">${stack.item.name}</div>
                <div class="component-quantity">×${stack.quantity}</div>
            `;

            // Add drag event listeners
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    itemId: stack.item.id,
                    baseId: baseId,
                    name: stack.item.name,
                    icon: stack.item.icon || '📦',
                    quantity: stack.quantity
                }));
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', (e) => {
                card.classList.remove('dragging');
            });

            // Add double-click listener to auto-place in appropriate slot
            card.addEventListener('dblclick', (e) => {
                const itemData = {
                    itemId: stack.item.id,
                    baseId: baseId,
                    name: stack.item.name,
                    icon: stack.item.icon || '📦',
                    quantity: stack.quantity
                };
                handleAutoPlaceComponent(itemData);
            });

            container.appendChild(card);
        });
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
        refreshFromSaveData,
        renderWeaponCategories,
        updateValidationMessage
    };
})();

window.Crafting = Crafting;
