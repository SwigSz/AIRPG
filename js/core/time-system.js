/**
 * Time System
 * Manages in-game time progression and formatting
 */

const TimeSystem = {
    // Time configuration
    HOURS_PER_DAY: 24,
    DAYS_PER_MONTH: 15,
    MONTHS_PER_YEAR: 12,
    DAYS_PER_YEAR: 180, // 12 months × 15 days
    SETTLEMENT_DAY_DURATION: 2000, // 1 day = 2 seconds in settlement (in milliseconds)

    // Current time state
    currentTime: {
        year: 0,
        month: 0,
        day: 0,
        hour: 0,
        totalHours: 0 // Internal tracking for precision
    },

    // Settlement time tracking
    lastTickTime: 0,
    isInSettlement: false,

    /**
     * Initialize the time system
     */
    init() {
        this.currentTime = {
            year: 0,
            month: 0,
            day: 0,
            hour: 0,
            totalHours: 0
        };
        this.lastTickTime = Date.now();
        this.isInSettlement = false;

        // Start the tick system for settlement time progression
        this.startTickSystem();

        console.log('Time system initialized');
    },

    /**
     * Start the tick system for continuous time updates in settlement
     */
    startTickSystem() {
        setInterval(() => {
            if (this.isInSettlement) {
                const now = Date.now();
                const deltaTime = now - this.lastTickTime;
                this.lastTickTime = now;

                // Calculate hours to add based on delta time
                // 1 day (24 hours) per 2 seconds = 12 hours per second
                const hoursToAdd = (deltaTime / 1000) * (this.HOURS_PER_DAY / (this.SETTLEMENT_DAY_DURATION / 1000));
                this.advanceTime(hoursToAdd);
            } else {
                // Reset last tick time when not in settlement to prevent time jumps
                this.lastTickTime = Date.now();
            }
        }, 50); // Update 20 times per second for smooth progression
    },

    /**
     * Set whether the player is in settlement (for time acceleration)
     */
    setInSettlement(inSettlement) {
        this.isInSettlement = inSettlement;
        this.lastTickTime = Date.now(); // Reset tick time to prevent jumps
    },

    /**
     * Advance time by a number of hours
     * @param {number} hours - Hours to advance
     */
    advanceTime(hours) {
        this.currentTime.totalHours += hours;

        // Calculate year, month, day, and hour from total hours
        const totalHours = Math.floor(this.currentTime.totalHours);
        const totalDays = Math.floor(totalHours / this.HOURS_PER_DAY);

        this.currentTime.hour = totalHours % this.HOURS_PER_DAY;

        const daysInYear = totalDays % this.DAYS_PER_YEAR;
        this.currentTime.month = Math.floor(daysInYear / this.DAYS_PER_MONTH);
        this.currentTime.day = daysInYear % this.DAYS_PER_MONTH;
        this.currentTime.year = Math.floor(totalDays / this.DAYS_PER_YEAR);

        // Notify settlement of time change for resource generation
        if (window.Settlement && window.Settlement.onTimeAdvance) {
            const daysAdvanced = hours / this.HOURS_PER_DAY;
            window.Settlement.onTimeAdvance(daysAdvanced);
        }

        // Trigger UI update
        this.updateUI();
    },

    /**
     * Advance time by a number of days (convenience method)
     * @param {number} days - Days to advance
     */
    advanceDays(days) {
        this.advanceTime(days * this.HOURS_PER_DAY);
    },

    /**
     * Get formatted date string
     * @returns {string} Formatted date (e.g., "Year 0, Month 1, Day 5, 14:00")
     */
    getFormattedDate() {
        const hourStr = String(this.currentTime.hour).padStart(2, '0');
        return `Year ${this.currentTime.year}, Month ${this.currentTime.month}, Day ${this.currentTime.day}, ${hourStr}:00`;
    },

    /**
     * Get short formatted date for top bar
     * @returns {string} Short date (e.g., "Time: 14:00 | Date: Y0 M1 D5")
     */
    getShortFormattedDate() {
        const hourStr = String(this.currentTime.hour).padStart(2, '0');
        return `Time: ${hourStr}:00 | Date: Y${this.currentTime.year} M${this.currentTime.month} D${this.currentTime.day}`;
    },

    /**
     * Get current day number
     * @returns {number} Current day
     */
    getCurrentDay() {
        return this.currentTime.day;
    },

    /**
     * Get current year
     * @returns {number} Current year
     */
    getCurrentYear() {
        return this.currentTime.year;
    },

    /**
     * Get current hour
     * @returns {number} Current hour
     */
    getCurrentHour() {
        return this.currentTime.hour;
    },

    /**
     * Update all time-related UI elements
     */
    updateUI() {
        // Update top bar date display
        const dateElement = document.querySelector('.time-date');
        if (dateElement) {
            dateElement.textContent = this.getShortFormattedDate();
        }

        // Update settlement tab date display (no hours)
        const settlementDayElement = document.getElementById('settlement-header-day');
        if (settlementDayElement) {
            settlementDayElement.textContent = `Y${this.currentTime.year} M${this.currentTime.month} D${this.currentTime.day}`;
        }
    },

    /**
     * Get time data for saving
     * @returns {object} Time state
     */
    getSaveData() {
        return {
            year: this.currentTime.year,
            month: this.currentTime.month,
            day: this.currentTime.day,
            hour: this.currentTime.hour,
            totalHours: this.currentTime.totalHours
        };
    },

    /**
     * Load time data from save
     * @param {object} saveData - Saved time data
     */
    loadSaveData(saveData) {
        if (saveData) {
            this.currentTime.year = saveData.year || 0;
            this.currentTime.month = saveData.month || 0;
            this.currentTime.day = saveData.day || 0;
            this.currentTime.hour = saveData.hour || 0;
            this.currentTime.totalHours = saveData.totalHours || 0;
            this.updateUI();
        }
    }
};

// Make globally available
window.TimeSystem = TimeSystem;
