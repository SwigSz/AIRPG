// ============================================
// Generational System
// ============================================

const Generation = (() => {
    function init() {
        console.log('Generation: Initializing...');
    }

    return {
        init
    };
})();

window.Generation = Generation;
