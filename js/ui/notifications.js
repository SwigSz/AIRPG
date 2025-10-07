// ============================================
// Toast/Notification System
// ============================================

const Notifications = (() => {
    function init() {
        console.log('Notifications: Initializing...');
        createContainer();
    }

    function createContainer() {
        if (document.querySelector('.notification-container')) return;

        const container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    function show(message, type = 'info', duration = 3000) {
        const container = document.querySelector('.notification-container');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        container.appendChild(notification);

        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Remove after duration
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, duration);
    }

    function success(message, duration) {
        show(message, 'success', duration);
    }

    function error(message, duration) {
        show(message, 'error', duration);
    }

    function warning(message, duration) {
        show(message, 'warning', duration);
    }

    function info(message, duration) {
        show(message, 'info', duration);
    }

    return {
        init,
        show,
        success,
        error,
        warning,
        info
    };
})();

// Expose to global scope
window.Notifications = Notifications;
