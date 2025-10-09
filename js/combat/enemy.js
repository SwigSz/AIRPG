// ============================================
// Enemy Database
// ============================================
// This file contains all enemy definitions in the game.
// Use the structure below to add new enemies.
//
// Example Enemy Structure:
// {
//     id: "enemy_name",           // Unique identifier
//     name: "Display Name",       // Optional, auto-generated from id if missing
//     level: 1,                   // Enemy level
//     kind: "beast",              // Type: beast, spirit, goblinoid, humanoid, construct, etc.
//     flavor: "Description",      // Flavor text (not displayed in combat yet)
//     desc: "Description",        // Alternative to flavor
//     hp: 10,                     // Health points
//     defense: 2,                 // Defense stat
//     attack: {
//         name: "strike",         // Attack name
//         kind: "blunt",          // Damage type: blunt, slash, pierce, spirit
//         damage: "1~4",          // Damage range (supports "1~4" or "1")
//         dot: {                  // Optional damage-over-time (not implemented yet)
//             percent: "20%",
//             adj: "burning",
//             flags: "noattack",
//             duration: 3
//         }
//     },
//     biome: ["swamp", "plains"],  // Optional spawn biomes
//     xpReward: 10                 // XP awarded on death
// }

const EnemyDatabase = (() => {
    // Enemy definitions database (loaded from JSON)
    let ENEMIES = {};

    // Load enemies from JSON file
    async function loadEnemies() {
        try {
            const response = await fetch('data/enemies.json');
            const data = await response.json();

            // Convert array to object keyed by id
            ENEMIES = {};
            data.enemies.forEach(enemy => {
                // Convert JSON format to internal format
                ENEMIES[enemy.id] = {
                    id: enemy.id,
                    name: enemy.name,
                    level: enemy.level,
                    kind: enemy.kind,
                    flavor: enemy.description,
                    hp: enemy.stats.hp,
                    defense: enemy.stats.defense,
                    attack: enemy.attack,
                    biome: enemy.biomes || [],
                    xpReward: enemy.xpReward
                };
            });

            console.log('Loaded', Object.keys(ENEMIES).length, 'enemies from JSON');
        } catch (error) {
            console.error('Failed to load enemies:', error);
            ENEMIES = {};
        }
    }

    // Get enemy template
    function getEnemyTemplate(enemyId) {
        return ENEMIES[enemyId];
    }

    // Get all enemy IDs
    function getAllEnemyIds() {
        return Object.keys(ENEMIES);
    }

    // Add new enemy to database
    function addEnemy(enemyData) {
        if (!enemyData.id) {
            console.error('Enemy must have an id');
            return false;
        }

        ENEMIES[enemyData.id] = enemyData;
        console.log(`Added enemy: ${enemyData.id}`);
        return true;
    }

    // Initialize - load enemies
    async function init() {
        await loadEnemies();
    }

    return {
        init,
        getEnemyTemplate,
        getAllEnemyIds,
        addEnemy
    };
})();

window.EnemyDatabase = EnemyDatabase;
