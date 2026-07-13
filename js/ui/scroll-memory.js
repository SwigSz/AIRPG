// ============================================
// Scroll Memory System
// ============================================
// Remembers the scroll position of every scrollable container in the game
// and restores it when the container becomes visible again (e.g. after
// switching tabs/sub-tabs, which resets scroll via display:none).
//
// How it works:
// - A capture-phase 'scroll' listener on document records positions as the
//   player scrolls, keyed by a stable selector for the scrolled element.
// - TabManager / SubTabManager call ScrollMemory.restore() after showing
//   new content; positions are re-applied on the next animation frame.
// - The main scroller (#center-content) is shared by all tabs, so its
//   position is remembered per active tab.
//
// Positions are session-only (not saved to disk) by design — a fresh page
// load starts at the top.

const ScrollMemory = (() => {
    const positions = {}; // key -> { top, left }

    function currentTabKey() {
        return window.GameState?.getState?.()?.ui?.activeTab || 'default';
    }

    /**
     * Build a stable CSS selector for an element (id preferred, otherwise
     * nearest ancestor id + class list).
     */
    function selectorFor(el) {
        if (!el || el.nodeType !== 1) return null;
        if (el.id) return '#' + el.id;

        const classes = (typeof el.className === 'string' ? el.className : '').trim();
        if (!classes) return null;
        const classSelector = '.' + classes.split(/\s+/).join('.');

        const ancestor = el.closest('[id]');
        if (ancestor && ancestor !== el) {
            return '#' + ancestor.id + ' ' + classSelector;
        }
        return classSelector;
    }

    /**
     * Build a unique storage key for an element.
     * - '#center-content@<tab>' for the shared main scroller (per-tab memory)
     * - '<selector>||<index>' when the selector matches multiple elements
     */
    function keyFor(el) {
        const sel = selectorFor(el);
        if (!sel) return null;

        if (el.id === 'center-content') {
            return sel + '@' + currentTabKey();
        }

        try {
            const matches = document.querySelectorAll(sel);
            if (matches.length > 1) {
                const idx = Array.prototype.indexOf.call(matches, el);
                if (idx < 0) return null;
                return sel + '||' + idx;
            }
        } catch (err) {
            return null; // selector wasn't valid (unusual class names)
        }
        return sel;
    }

    function onScroll(e) {
        const el = e.target;
        // Ignore window/document scrolls — the game scrolls inner containers
        if (!el || el.nodeType !== 1) return;

        const key = keyFor(el);
        if (!key) return;
        positions[key] = { top: el.scrollTop, left: el.scrollLeft };
    }

    /**
     * Re-apply every remembered scroll position to elements that are
     * currently visible. Runs on the next animation frame so layout is done.
     */
    function restore() {
        requestAnimationFrame(() => {
            const activeTab = currentTabKey();

            for (const key in positions) {
                let sel = key;
                let idx = -1;

                // Per-tab keys only apply when their tab is active
                const at = sel.indexOf('@');
                if (at !== -1) {
                    if (sel.slice(at + 1) !== activeTab) continue;
                    sel = sel.slice(0, at);
                }

                // Indexed keys (selector matched multiple elements)
                const pipe = sel.indexOf('||');
                if (pipe !== -1) {
                    idx = parseInt(sel.slice(pipe + 2), 10);
                    sel = sel.slice(0, pipe);
                }

                let el = null;
                try {
                    el = idx >= 0
                        ? document.querySelectorAll(sel)[idx]
                        : document.querySelector(sel);
                } catch (err) {
                    continue;
                }

                // Skip missing or hidden elements (display:none containers)
                if (!el || el.offsetParent === null) continue;

                const pos = positions[key];
                if (el.scrollTop !== pos.top) el.scrollTop = pos.top;
                if (el.scrollLeft !== pos.left) el.scrollLeft = pos.left;
            }
        });
    }

    function clear() {
        for (const key in positions) delete positions[key];
    }

    // Capture-phase listener sees scrolls on any element, not just window
    document.addEventListener('scroll', onScroll, true);

    return {
        restore,
        clear
    };
})();

// Expose to global scope
window.ScrollMemory = ScrollMemory;
