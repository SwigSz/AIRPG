// ============================================
// Child Generation
// ============================================

const Children = (() => {
    function init() {
        console.log('Children: Initializing...');
    }

    return {
        init
    };
})();

window.Children = Children;
