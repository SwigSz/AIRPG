// ============================================
// Modal/Popup Handling
// ============================================

const ModalManager = (() => {
    let currentModal = null;

    function init() {
        console.log('ModalManager: Initializing...');
        setupCloseHandlers();
    }

    function setupCloseHandlers() {
        // Close modal on overlay click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                close();
            }
        });

        // Close modal on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && currentModal) {
                close();
            }
        });
    }

    function open(modalId, data = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal ${modalId} not found`);
            return;
        }

        currentModal = modal;
        modal.classList.add('active');
        document.body.classList.add('modal-open');

        // Emit event for modal opened
        if (window.EventSystem) {
            EventSystem.emit('modal-opened', modalId, data);
        }
    }

    function close() {
        if (!currentModal) return;

        const modalId = currentModal.id;
        currentModal.classList.remove('active');
        document.body.classList.remove('modal-open');
        currentModal = null;

        // Emit event for modal closed
        if (window.EventSystem) {
            EventSystem.emit('modal-closed', modalId);
        }
    }

    function isOpen() {
        return currentModal !== null;
    }

    return {
        init,
        open,
        close,
        isOpen
    };
})();

// Expose to global scope
window.ModalManager = ModalManager;
