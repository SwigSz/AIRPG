// ============================================
// Notification Manager - Popup Notifications
// ============================================

const NotificationManager = (() => {
    let notificationContainer = null;
    let activeNotifications = new Map(); // Track active notifications by key for stacking

    function init() {
        // Create notification container if it doesn't exist
        notificationContainer = document.getElementById('notification-container');

        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notification-container';
            notificationContainer.className = 'notification-container';
            document.body.appendChild(notificationContainer);
        }

        // NotificationManager initialized
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
    function showNotification({ type, icon, title, message, description, duration = 5000, stackKey = null }) {
        if (!notificationContainer) {
            init();
        }

        // If stackKey is provided, check if we already have an active notification for this
        if (stackKey && activeNotifications.has(stackKey)) {
            const existingData = activeNotifications.get(stackKey);

            // Update the count
            existingData.count++;

            // Update the notification message
            const notificationElement = existingData.element;
            const messageElement = notificationElement.querySelector('.notification-message');
            if (messageElement) {
                // Extract the base message (remove existing count if any)
                const baseMessage = existingData.baseMessage;
                messageElement.textContent = `+${existingData.count} ${baseMessage}`;
            }

            // Reset the timer
            clearTimeout(existingData.removeTimer);
            existingData.removeTimer = setTimeout(() => {
                notificationElement.classList.remove('show');
                notificationElement.classList.add('hide');

                setTimeout(() => {
                    notificationElement.remove();
                    activeNotifications.delete(stackKey);
                }, 500);
            }, duration);

            return;
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

        // Store notification data if stackKey is provided
        let removeTimer = null;
        if (stackKey) {
            // Extract base message for stacking (e.g., "+1 Stick" -> "Stick")
            const baseMessage = message.replace(/^\+\d+\s+/, '');
            activeNotifications.set(stackKey, {
                element: notification,
                count: 1,
                baseMessage: baseMessage,
                removeTimer: null
            });
        }

        // Remove after duration
        removeTimer = setTimeout(() => {
            notification.classList.remove('show');
            notification.classList.add('hide');

            setTimeout(() => {
                notification.remove();
                if (stackKey) {
                    activeNotifications.delete(stackKey);
                }
            }, 500);
        }, duration);

        // Update timer reference if stacking
        if (stackKey) {
            activeNotifications.get(stackKey).removeTimer = removeTimer;
        }
    }

    return {
        init,
        showAbilityUnlock,
        showSkillUnlock,
        showNotification
    };
})();

window.NotificationManager = NotificationManager;
