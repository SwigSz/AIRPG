// ============================================
// Enemy Factory - Enemy Creation & Utility Functions
// ============================================

const EnemyFactory = (() => {
    // Parse damage string (e.g., "1~4" or "1")
    function parseDamage(damageStr) {
        if (typeof damageStr === 'number') {
            return { min: damageStr, max: damageStr };
        }

        const str = String(damageStr);
        if (str.includes('~')) {
            const [min, max] = str.split('~').map(parseFloat);
            return { min, max };
        }

        const val = parseFloat(str);
        return { min: val, max: val };
    }

    // Roll damage based on damage range
    function rollDamage(damageStr) {
        const { min, max } = parseDamage(damageStr);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Create an enemy instance from template
    function createEnemy(enemyId) {
        const template = EnemyDatabase.getEnemyTemplate(enemyId);
        if (!template) {
            console.error(`Enemy template not found: ${enemyId}`);
            return null;
        }

        // Create instance with unique ID
        return {
            id: generateEnemyInstanceId(),
            templateId: template.id,
            name: template.name || capitalizeId(template.id),
            level: template.level || 1,
            kind: template.kind || 'unknown',
            hp: template.stats?.hp || template.hp || 10,
            maxHp: template.stats?.maxHp || template.stats?.hp || template.hp || 10,
            defense: template.stats?.defense || template.defense || 0,
            attack: {
                name: template.attack?.name || 'strike',
                kind: template.attack?.kind || 'blunt',
                damage: template.attack?.damage || "1",
                dot: template.attack?.dot || null
            },
            flavor: template.flavor || template.desc || template.description || '',
            biome: template.biome || template.biomes || [],
            xpReward: template.xpReward || 0,
            loot: template.loot || [],
            isAlive: true,
            isPlayer: false,
            initiative: 0
        };
    }

    // Generate unique instance ID
    function generateEnemyInstanceId() {
        return 'enemy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Capitalize ID for display name
    function capitalizeId(id) {
        return id.split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // Calculate enemy attack value from damage range
    function calculateEnemyAttack(enemy) {
        const damageData = parseDamage(enemy.attack.damage);
        // Use average of min/max as base attack
        return Math.floor((damageData.min + damageData.max) / 2);
    }

    return {
        createEnemy,
        rollDamage,
        parseDamage,
        calculateEnemyAttack
    };
})();

window.EnemyFactory = EnemyFactory;
