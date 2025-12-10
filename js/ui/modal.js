/**
 * Modal System
 *
 * Provides a dynamic modal/popup system that creates and manages
 * modals with custom content, titles, and buttons.
 *
 * Usage:
 * Modal.show({
 *     title: 'Modal Title',
 *     content: '<p>Modal content HTML</p>',
 *     buttons: [
 *         {
 *             text: 'Button Label',
 *             class: 'modal-btn-primary', // optional
 *             onClick: () => { ... } // optional callback
 *         }
 *     ]
 * });
 */

window.Modal = (function() {
    'use strict';

    let currentModalElement = null;

    /**
     * Show a modal with custom content
     * @param {Object} config - Modal configuration
     * @param {string} config.title - Modal title
     * @param {string} config.content - Modal content (HTML string)
     * @param {Array} config.buttons - Array of button configurations
     */
    function show(config) {
        // Close any existing modal first
        hide();

        const {
            title = 'Notice',
            content = '',
            buttons = [{ text: 'OK' }]
        } = config;

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        // Create modal content container
        const modal = document.createElement('div');
        modal.className = 'modal-content';

        // Create modal header
        const header = document.createElement('div');
        header.className = 'modal-header';

        const titleElement = document.createElement('h2');
        titleElement.className = 'modal-title';
        titleElement.textContent = title;

        header.appendChild(titleElement);

        // Create modal body
        const body = document.createElement('div');
        body.className = 'modal-body';
        body.innerHTML = content;

        // Create modal footer with buttons
        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        buttons.forEach(buttonConfig => {
            const button = document.createElement('button');
            button.className = `modal-btn ${buttonConfig.class || 'modal-btn-primary'}`;
            button.textContent = buttonConfig.text || 'OK';

            button.addEventListener('click', () => {
                if (buttonConfig.onClick) {
                    buttonConfig.onClick();
                } else {
                    hide();
                }
            });

            footer.appendChild(button);
        });

        // Assemble modal
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);

        // Add to document
        document.body.appendChild(overlay);
        currentModalElement = overlay;

        // Add body class
        document.body.classList.add('modal-open');

        // Close on overlay click (but not on modal content click)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                hide();
            }
        });

        // Close on ESC key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                hide();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * Hide the current modal
     */
    function hide() {
        if (currentModalElement) {
            currentModalElement.remove();
            currentModalElement = null;
            document.body.classList.remove('modal-open');
        }
    }

    /**
     * Check if a modal is currently open
     * @returns {boolean}
     */
    function isOpen() {
        return currentModalElement !== null;
    }

    // Public API
    return {
        show,
        hide,
        isOpen
    };

})();
