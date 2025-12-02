// ============================================
// Tooltip Manager - Hover Tooltips
// ============================================

const TooltipManager = (() => {
    let tooltip = null;
    let hoverTimeout = null;
    let currentTarget = null;

    function init() {
        // Create tooltip element
        tooltip = document.createElement('div');
        tooltip.className = 'hover-tooltip';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);

        // TooltipManager initialized
    }

    // Show tooltip for a skill or ability
    function showTooltip(element, data, type) {
        if (!tooltip) init();

        // Clear any existing timeout
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }

        currentTarget = element;

        // Wait 500ms before showing tooltip
        hoverTimeout = setTimeout(() => {
            if (currentTarget !== element) return;

            // Build tooltip content based on type
            let content = '';

            if (type === 'ability') {
                content = `
                    <div class="tooltip-header">
                        <span class="tooltip-icon">${data.icon || '⚡'}</span>
                        <span class="tooltip-name">${data.name}</span>
                    </div>
                    <div class="tooltip-description">${data.description || 'No description'}</div>
                    <div class="tooltip-details">
                        ${data.type ? `<div class="tooltip-detail">Type: <span class="detail-value">${data.type}</span></div>` : ''}
                        ${data.manaCost ? `<div class="tooltip-detail">Mana Cost: <span class="detail-value">${data.manaCost}</span></div>` : ''}
                        ${data.cooldown ? `<div class="tooltip-detail">Cooldown: <span class="detail-value">${data.cooldown}s</span></div>` : ''}
                        ${data.damage ? `<div class="tooltip-detail">Base Damage: <span class="detail-value">${data.damage.base}</span></div>` : ''}
                    </div>
                    ${!data.unlocked && data.unlockDescription ? `<div class="tooltip-unlock">Unlock: ${data.unlockDescription}</div>` : ''}
                `;
            } else if (type === 'skill') {
                content = `
                    <div class="tooltip-header">
                        <span class="tooltip-icon">${data.icon || '📜'}</span>
                        <span class="tooltip-name">${data.name}</span>
                    </div>
                    <div class="tooltip-description">${data.description || 'No description'}</div>
                    <div class="tooltip-details">
                        ${data.category ? `<div class="tooltip-detail">Category: <span class="detail-value">${data.category}</span></div>` : ''}
                        ${data.level ? `<div class="tooltip-detail">Level: <span class="detail-value">${data.level}/${data.maxLevel || '∞'}</span></div>` : ''}
                        ${data.xpReward ? `<div class="tooltip-detail">XP Reward: <span class="detail-value">${data.xpReward}</span></div>` : ''}
                    </div>
                    ${!data.earned && data.unlockDescription ? `<div class="tooltip-unlock">Unlock: ${data.unlockDescription}</div>` : ''}
                `;
            }

            tooltip.innerHTML = content;
            tooltip.style.display = 'block';

            // Position tooltip near the element
            positionTooltip(element);
        }, 500);
    }

    // Position tooltip relative to element
    function positionTooltip(element) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        // Position to the right of the element by default
        let left = rect.right + 10;
        let top = rect.top;

        // If tooltip would go off right edge, position to the left
        if (left + tooltipRect.width > window.innerWidth) {
            left = rect.left - tooltipRect.width - 10;
        }

        // If tooltip would go off bottom edge, adjust upward
        if (top + tooltipRect.height > window.innerHeight) {
            top = window.innerHeight - tooltipRect.height - 10;
        }

        // If tooltip would go off top edge, adjust downward
        if (top < 0) {
            top = 10;
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    // Hide tooltip
    function hideTooltip() {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        currentTarget = null;
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    return {
        init,
        showTooltip,
        hideTooltip
    };
})();

window.TooltipManager = TooltipManager;
