// ============================================
// Utility Functions
// ============================================

const Utils = (() => {
    // Random number generation
    function randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    }

    function randomChoice(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    // Clamping
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    // Time formatting
    function formatTime(days) {
        const years = Math.floor(days / 365);
        const remainingDays = days % 365;
        return `Year ${years}, Day ${remainingDays}`;
    }

    // Number formatting
    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // Percentage calculations
    function calculatePercentage(current, max) {
        return Math.floor((current / max) * 100);
    }

    // Deep clone object
    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // UUID generation
    function generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    return {
        randomInt,
        randomFloat,
        randomChoice,
        clamp,
        formatTime,
        formatNumber,
        calculatePercentage,
        deepClone,
        generateId
    };
})();

// Expose to global scope
window.Utils = Utils;
