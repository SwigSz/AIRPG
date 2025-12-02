// ============================================
// Notification Manager - Popup Notifications
// ============================================

const NotificationManager = (() => {
    let notificationContainer = null;

    function init() {
        // Create notification container if it doesn't exist
        notificationContainer = document.getElementById('notification-container');

        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.className = 'notification-container';
            document.body.appendChild(notificationContainer);
        }

        console.log('NotificationManager: Initialized');
    }

    // Show ability unlock notification
    function showAbilityUnlock(ability) {
        showNotification({
            type: 'ability',
            icon: ability.icon,
            title: 'New Ability Unlocked!',
            message: ability.name,
            description: ability.description
        });
    }

    // Show skill unlock notification
    function showSkillUnlock(skill) {
        showNotification({
            type: 'skill',
            icon: skill.icon,
            title: 'New Skill Earned!',
            message: skill.name,
            description: skill.description
        });
    }

    // Generic notification display
    function showNotification({ type, icon, title, message, description, duration = 5000 }) {
        if (!notificationContainer) {
            init();
        }

        const notification = document.createElement('div');
        notification.className = `notification ${type}-notification`;

        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">${icon}</div>
                <div class="notification-text">
                    <div class="notification-title">${title}</div>
                    <div class="notification-message">${message}</div>
                    ${description ? `<div class="notification-description">${description}</div>` : ''}
                </div>
            </div>
        `;

        notificationContainer.appendChild(notification);

        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Remove after duration
        setTimeout(() => {
            notification.classList.remove('show');
            notification.classList.add('hide');

            setTimeout(() => {
                notification.remove();
            }, 500);
        }, duration);
    }

    return {
        init,
        showAbilityUnlock,
        showSkillUnlock,
        showNotification
    };
})();

window.NotificationManager = NotificationManager;
