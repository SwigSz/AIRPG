// ============================================
// Global Event Bus
// ============================================

const EventSystem = (() => {
    const listeners = {};

    function on(event, callback) {
        if (!listeners[event]) {
            listeners[event] = [];
        }
        listeners[event].push(callback);
    }

    function off(event, callback) {
        if (!listeners[event]) return;

        listeners[event] = listeners[event].filter(cb => cb !== callback);
    }

    function emit(event, ...args) {
        if (!listeners[event]) return;

        listeners[event].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    function once(event, callback) {
        const onceCallback = (...args) => {
            callback(...args);
            off(event, onceCallback);
        };
        on(event, onceCallback);
    }

    function clear(event) {
        if (event) {
            delete listeners[event];
        } else {
            Object.keys(listeners).forEach(key => delete listeners[key]);
        }
    }

    return {
        on,
        off,
        emit,
        once,
        clear
    };
})();

// Expose to global scope
window.EventSystem = EventSystem;
