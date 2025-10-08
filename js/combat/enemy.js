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
//     biome: ["swamp", "plains"]  // Optional spawn biomes
// }

const EnemyDatabase = (() => {
    // Enemy definitions database
    const ENEMIES = {
        "test_dummy": {
            id: "test_dummy",
            name: "Test Dummy",
            level: 1,
            kind: "construct",
            flavor: "A training dummy. It doesn't fight back.",
            hp: 50,
            defense: 3,
            attack: {
                name: "bump",
                kind: "blunt",
                damage: "1~2"
            }
        }
    };

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

    return {
        getEnemyTemplate,
        getAllEnemyIds,
        addEnemy
    };
})();

window.EnemyDatabase = EnemyDatabase;
