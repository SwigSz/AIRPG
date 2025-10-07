// ============================================
// Time Management (1 day = 1 second)
// ============================================

const TimeManager = (() => {
    let currentDay = 0;
    let isRunning = false;
    let intervalId = null;

    function init() {
        console.log('TimeManager: Initializing...');
    }

    function start() {
        if (isRunning) return;

        isRunning = true;
        intervalId = setInterval(() => {
            tick();
        }, GameConfig.TIME.DAY_DURATION);
        console.log('Time started');
    }

    function stop() {
        if (!isRunning) return;

        isRunning = false;
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
        console.log('Time stopped');
    }

    function tick() {
        currentDay++;
        GameState.updateProperty('currentDay', currentDay);

        // Trigger daily events
        if (window.EventSystem) {
            EventSystem.emit('day-passed', currentDay);
        }
    }

    function getCurrentDay() {
        return currentDay;
    }

    function getCurrentYear() {
        return Math.floor(currentDay / GameConfig.TIME.YEAR_DAYS);
    }

    function getDayOfYear() {
        return currentDay % GameConfig.TIME.YEAR_DAYS;
    }

    return {
        init,
        start,
        stop,
        getCurrentDay,
        getCurrentYear,
        getDayOfYear
    };
})();

// Expose to global scope
window.TimeManager = TimeManager;
