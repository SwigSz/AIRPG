// ============================================
// Procedural World Generation
// ============================================

const WorldGenerator = (() => {
    function generate() {
        console.log('WorldGenerator: Generating world...');
        return {};
    }

    return {
        generate
    };
})();

window.WorldGenerator = WorldGenerator;
