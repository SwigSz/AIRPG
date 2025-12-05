// ============================================
// Community Research - Research Tree System
// ============================================

const Research = (() => {
    let canvas = null;
    let ctx = null;
    let treeData = null;
    let researchedNodes = new Set();
    let hoveredNode = null;
    let hoverTimeout = null;
    let tooltip = null;
    let showTooltip = false;

    const NODE_RADIUS = 30;
    const HOVER_DELAY = 500; // 0.5 seconds
    const COLORS = {
        locked: '#6b7280',      // Gray
        available: '#3b82f6',   // Blue
        researched: '#22c55e',  // Green
        hover: '#f97316',       // Orange
        background: '#0f172a',  // Dark blue
        line: '#ffffff',        // White
        text: '#ffffff'         // White
    };

    async function init() {
        canvas = document.getElementById('research-tree-canvas');
        if (!canvas) {
            console.error('Research tree canvas not found');
            return;
        }

        ctx = canvas.getContext('2d');

        // Set canvas size - container will handle scrolling
        canvas.width = 1200;
        canvas.height = 500;

        // Create tooltip element
        createTooltip();

        await loadTree();
        loadResearchedNodes();

        // Check for any nodes that should be auto-completed on load
        checkAndAutoCompleteNodes();

        // Check if there's active research from a loaded save
        const state = window.GameState ? window.GameState.getState() : null;
        console.log('🔬 Research.init() - checking for activeResearch:', state ? state.activeResearch : 'no state');
        if (state && state.activeResearch) {
            console.log('🔬 Restored active research from save:', state.activeResearch);
        } else {
            console.log('🔬 No active research found during init');
        }

        setupEventListeners();
        render();

        // Start animation loop for progress updates
        startAnimationLoop();
    }

    function startAnimationLoop() {
        setInterval(() => {
            const state = window.GameState ? window.GameState.getState() : null;
            // Always render if there's active research (paused or not) to show current state
            // This ensures the completion state shows immediately
            if (state && (state.activeResearch || hasActiveResearchInProgress())) {
                render();
            }
        }, 50); // Update 20 times per second for fluid animation
    }

    function hasActiveResearchInProgress() {
        // Check if any node is currently being researched
        const state = window.GameState ? window.GameState.getState() : null;
        return state && state.activeResearch;
    }

    function createTooltip() {
        tooltip = document.createElement('div');
        tooltip.id = 'research-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.display = 'none';
        tooltip.style.backgroundColor = '#1e293b';
        tooltip.style.border = '2px solid #3b82f6';
        tooltip.style.borderRadius = '8px';
        tooltip.style.padding = '12px';
        tooltip.style.color = '#ffffff';
        tooltip.style.fontSize = '14px';
        tooltip.style.maxWidth = '250px';
        tooltip.style.zIndex = '1000';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
        document.body.appendChild(tooltip);
    }

    async function loadTree() {
        try {
            const response = await fetch('data/research-tree.json');
            treeData = await response.json();
        } catch (error) {
            console.error('Failed to load research tree:', error);
            treeData = { nodes: {} };
        }
    }

    function loadResearchedNodes() {
        // Load researched nodes from GameState
        const state = window.GameState ? window.GameState.getState() : null;
        if (state && state.researchedNodes && Array.isArray(state.researchedNodes)) {
            researchedNodes = new Set(state.researchedNodes);
            console.log('✅ Loaded researched nodes:', state.researchedNodes);
        } else {
            researchedNodes = new Set();
            console.log('✅ No researched nodes found, starting fresh');
        }
    }

    function reloadState() {
        // Reload research state from GameState (called after loading a save)
        loadResearchedNodes();
        render();
        console.log('🔬 Research state reloaded from save');
    }

    function saveResearchedNodes() {
        // Save researched nodes to GameState
        const state = window.GameState ? window.GameState.getState() : null;
        if (state) {
            state.researchedNodes = Array.from(researchedNodes);

            // Trigger save if SaveSystem exists
            if (window.SaveSystem) {
                SaveSystem.save();
            }
        }
    }

    function setupEventListeners() {
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        canvas.addEventListener('click', handleClick);
    }

    function handleMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        let foundNode = null;
        for (const nodeId in treeData.nodes) {
            const node = treeData.nodes[nodeId];
            const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
            if (dist <= NODE_RADIUS) {
                foundNode = nodeId;
                break;
            }
        }

        if (foundNode !== hoveredNode) {
            hoveredNode = foundNode;
            hideTooltip();

            if (hoveredNode) {
                // Start hover delay timer
                hoverTimeout = setTimeout(() => {
                    showTooltipForNode(hoveredNode, e.pageX, e.pageY);
                }, HOVER_DELAY);
            }

            render();
        }
    }

    function handleMouseLeave() {
        hoveredNode = null;
        hideTooltip();
        render();
    }

    function handleClick(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        for (const nodeId in treeData.nodes) {
            const node = treeData.nodes[nodeId];
            const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
            if (dist <= NODE_RADIUS) {
                clickNode(nodeId);
                break;
            }
        }
    }

    function clickNode(nodeId) {
        if (hasResearched(nodeId)) {
            return;
        }

        if (!isAvailable(nodeId)) {
            return;
        }

        // Show detail modal instead of auto-completing
        showResearchDetailModal(nodeId);
    }

    function showResearchDetailModal(nodeId) {
        const node = treeData.nodes[nodeId];
        if (!node) return;

        const state = window.GameState ? window.GameState.getState() : null;
        if (!state || !state.settlement) return;

        const settlement = state.settlement;
        const activeResearch = state.activeResearch;

        // Check if this research is currently active
        const isActive = activeResearch && activeResearch.nodeId === nodeId;
        const isPaused = isActive && activeResearch.isPaused;

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;';

        const modalContent = document.createElement('div');
        modalContent.style.cssText = 'background: #1e293b; border: 2px solid #3b82f6; border-radius: 12px; padding: 24px; max-width: 500px; color: white;';

        let html = `
            <h2 style="margin: 0 0 16px 0; color: #3b82f6; font-size: 24px;">${node.name}</h2>
            <p style="margin: 0 0 20px 0; color: #cbd5e1; font-size: 14px;">${node.description}</p>
        `;

        // Show resource costs
        if (node.resourceCosts) {
            html += '<div style="margin-bottom: 20px;"><h3 style="margin: 0 0 12px 0; color: #94a3b8; font-size: 16px;">Resource Requirements:</h3>';

            for (const [resource, cost] of Object.entries(node.resourceCosts)) {
                const current = settlement.resources[resource]?.current || 0;
                const hasEnough = current >= cost;
                const color = hasEnough ? '#22c55e' : '#ef4444';
                html += `<div style="margin: 6px 0; color: ${color}; font-size: 14px;">
                    ${resource.charAt(0).toUpperCase() + resource.slice(1)}: ${Math.floor(current)}/${cost}
                </div>`;
            }
            html += '</div>';
        }

        // Show time requirement
        if (node.timeDays) {
            html += `<div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 8px 0; color: #94a3b8; font-size: 16px;">Time Required:</h3>
                <div style="color: #cbd5e1; font-size: 14px;">${node.timeDays} days (in settlement)</div>
            </div>`;
        }

        // Show what it unlocks
        if (node.unlocksRecipes && node.unlocksRecipes.length > 0) {
            html += '<div style="margin-bottom: 20px;"><h3 style="margin: 0 0 8px 0; color: #94a3b8; font-size: 16px;">Unlocks:</h3>';
            node.unlocksRecipes.forEach(recipe => {
                html += `<div style="margin: 4px 0; color: #60a5fa; font-size: 14px;">• Recipe: ${recipe}</div>`;
            });
            html += '</div>';
        }

        // Show research status and buttons
        if (isActive) {
            const daysElapsed = Math.floor(activeResearch.daysElapsed || 0);
            const daysRequired = node.timeDays;
            const progress = Math.min(100, (daysElapsed / daysRequired) * 100);

            html += `<div style="margin-bottom: 20px; padding: 12px; background: #0f172a; border-radius: 8px;">
                <div style="font-size: 14px; color: #cbd5e1; margin-bottom: 8px;">Research Progress:</div>
                <div style="font-size: 18px; color: #3b82f6; font-weight: bold;">${daysElapsed} / ${daysRequired} days</div>
                <div style="margin-top: 8px; background: #334155; height: 20px; border-radius: 4px; overflow: hidden;">
                    <div style="background: #3b82f6; height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
                </div>
                ${isPaused ? '<div style="margin-top: 8px; color: #f59e0b; font-size: 14px;">⚠ Research Paused (Leave settlement to continue elsewhere)</div>' : ''}
            </div>`;
        }

        // Add buttons
        html += '<div style="display: flex; gap: 12px; margin-top: 20px;">';

        if (!isActive) {
            // Check if we can afford it
            const canAfford = checkCanAffordResearch(nodeId);
            html += `<button id="start-research-btn" style="flex: 1; padding: 12px; background: ${canAfford ? '#3b82f6' : '#6b7280'}; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: ${canAfford ? 'pointer' : 'not-allowed'}; font-weight: bold;">
                Start Research
            </button>`;
        } else if (isPaused) {
            html += `<button id="resume-research-btn" style="flex: 1; padding: 12px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: bold;">
                Resume Research
            </button>`;
        }

        html += `<button id="close-modal-btn" style="flex: 1; padding: 12px; background: #475569; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">
            Close
        </button></div>`;

        modalContent.innerHTML = html;
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Event listeners
        const closeBtn = modal.querySelector('#close-modal-btn');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        const startBtn = modal.querySelector('#start-research-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const canAfford = checkCanAffordResearch(nodeId);
                if (canAfford) {
                    try {
                        startResearch(nodeId);
                    } catch (error) {
                        console.error('Error starting research:', error);
                    }
                    // Always close modal after attempting to start research
                    document.body.removeChild(modal);
                } else {
                    // Can't afford - show message but don't close modal
                    console.log('Cannot afford research - need more resources');
                }
            });
        }

        const resumeBtn = modal.querySelector('#resume-research-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                resumeResearch();
                document.body.removeChild(modal);
            });
        }

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    function checkCanAffordResearch(nodeId) {
        const node = treeData.nodes[nodeId];
        if (!node || !node.resourceCosts) return true;

        const state = window.GameState ? window.GameState.getState() : null;
        if (!state || !state.settlement) return false;

        const settlement = state.settlement;

        for (const [resource, cost] of Object.entries(node.resourceCosts)) {
            const current = settlement.resources[resource]?.current || 0;
            if (current < cost) {
                return false;
            }
        }

        return true;
    }

    function startResearch(nodeId) {
        const node = treeData.nodes[nodeId];
        if (!node) return;

        const state = window.GameState ? window.GameState.getState() : null;
        if (!state || !state.settlement) return;

        // Check if we can afford it
        if (!checkCanAffordResearch(nodeId)) {
            console.log('Not enough resources to start research');
            return;
        }

        // Deduct resources
        const settlement = state.settlement;
        if (node.resourceCosts) {
            for (const [resource, cost] of Object.entries(node.resourceCosts)) {
                settlement.resources[resource].current -= cost;
            }
        }

        // Get current day from TimeSystem (with fractional hours for precise tracking)
        const currentDay = window.TimeSystem ?
            (TimeSystem.currentTime.day +
             (TimeSystem.currentTime.month * TimeSystem.DAYS_PER_MONTH) +
             (TimeSystem.currentTime.year * TimeSystem.DAYS_PER_YEAR) +
             (TimeSystem.currentTime.hour / TimeSystem.HOURS_PER_DAY)) : 0;

        // Start research
        state.activeResearch = {
            nodeId: nodeId,
            startDay: currentDay,
            daysElapsed: 0,
            daysRequired: node.timeDays,
            isPaused: false
        };

        // Save state
        if (window.SaveSystem) {
            SaveSystem.save();
        }

        // Update UI
        if (window.Settlement) {
            Settlement.updateUI();
        }

        render();

        // Show notification
        if (window.NotificationManager) {
            NotificationManager.show(`Research started: ${node.name}`, 'info');
        }

        // Log to activity
        if (window.ActivityLog) {
            ActivityLog.addMessage(`Started researching: ${node.name}`, 'info');
        }

        console.log(`Started research: ${node.name}`);
    }

    function resumeResearch() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (!state || !state.activeResearch) return;

        state.activeResearch.isPaused = false;

        if (window.SaveSystem) {
            SaveSystem.save();
        }

        render();
        console.log('Research resumed');
    }

    function completeResearch(nodeId) {
        const node = treeData.nodes[nodeId];
        if (!node) return;

        researchedNodes.add(nodeId);
        saveResearchedNodes();

        // Clear active research
        const state = window.GameState ? window.GameState.getState() : null;
        if (state) {
            state.activeResearch = null;
        }

        // Force immediate render to show completion state
        render();

        // Handle recipe unlocks if this node unlocks recipes
        if (node.unlocksRecipes && node.unlocksRecipes.length > 0) {
            console.log(`Research ${nodeId} unlocks recipes:`, node.unlocksRecipes);

            // Show notification for unlocked recipes
            if (window.NotificationManager) {
                const recipeText = node.unlocksRecipes.join(', ');
                NotificationManager.show(`Research Complete! Unlocked: ${recipeText}`, 'success');
            }
        }

        // Log to activity
        if (window.ActivityLog) {
            ActivityLog.addMessage(`Research completed: ${node.name}`, 'success');
        }

        // Emit event if EventSystem exists
        if (window.EventSystem) {
            EventSystem.emit('research-completed', { nodeId, node });
        }

        // Save state
        if (window.SaveSystem) {
            SaveSystem.save();
        }

        // Render again after a short delay to ensure state is fully updated
        setTimeout(() => render(), 100);

        console.log(`Research completed: ${node.name}`);
    }

    function isAvailable(nodeId) {
        const node = treeData.nodes[nodeId];
        if (!node) return false;

        // Check if all tech prerequisites are researched
        for (const prereqId of node.prerequisites) {
            if (!hasResearched(prereqId)) {
                return false;
            }
        }

        // Check if all item requirements are met
        if (node.itemRequirements && node.itemRequirements.length > 0) {
            for (const itemReq of node.itemRequirements) {
                if (!hasItemRequirement(itemReq)) {
                    return false;
                }
            }
        }

        return true;
    }

    function hasItemRequirement(itemReq) {
        // Get crafting history from GameState
        const state = window.GameState ? window.GameState.getState() : null;
        if (!state || !state.craftingHistory) return false;

        // Check if the item has been crafted
        if (itemReq.mustCraft) {
            return state.craftingHistory.some(item => item === itemReq.itemName);
        }

        return false;
    }

    function hasResearched(nodeId) {
        return researchedNodes.has(nodeId);
    }

    // Check all nodes - this function now only triggers a re-render when item requirements change
    // Nodes are NOT auto-completed, they only become available (unlocked) when requirements are met
    function checkAndAutoCompleteNodes() {
        // Just re-render the tree to update node states
        // Nodes will change from gray (locked) to blue (available) when isAvailable() returns true
        render();
        return false;
    }

    function reset() {
        researchedNodes.clear();
        render();
    }

    function showTooltipForNode(nodeId, mouseX, mouseY) {
        const node = treeData.nodes[nodeId];
        if (!node || !tooltip) return;

        const available = isAvailable(nodeId);
        const researched = hasResearched(nodeId);
        const isLocked = !available && !researched;

        let content = '';

        if (isLocked) {
            // Locked node - show ??? for prerequisites
            content += '<div style="font-weight: bold; margin-bottom: 8px; color: #f59e0b;">Unknown</div>';
            content += '<div style="font-size: 12px; color: #9ca3af; margin-bottom: 8px;">Requires:</div>';

            // Show hidden tech prerequisites
            for (let i = 0; i < node.prerequisites.length; i++) {
                content += '<div style="margin-left: 8px; color: #6b7280;">----- ?</div>';
            }

            // Show hidden item prerequisites
            if (node.itemRequirements && node.itemRequirements.length > 0) {
                for (let i = 0; i < node.itemRequirements.length; i++) {
                    content += '<div style="margin-left: 8px; color: #6b7280;">----- ?</div>';
                }
            }
        } else {
            // Available or researched - show full info
            content += `<div style="font-weight: bold; margin-bottom: 8px; color: ${researched ? '#22c55e' : '#3b82f6'};">${node.name}</div>`;
            content += `<div style="font-size: 12px; color: #cbd5e1; margin-bottom: 8px;">${node.description}</div>`;

            // Show item requirements if they exist
            if (node.itemRequirements && node.itemRequirements.length > 0) {
                content += '<div style="font-size: 12px; color: #9ca3af; margin-top: 8px; margin-bottom: 4px;">Required Items:</div>';
                node.itemRequirements.forEach(itemReq => {
                    const hasCrafted = hasItemRequirement(itemReq);
                    const checkmark = hasCrafted ? '✓ ' : '';
                    const color = hasCrafted ? '#22c55e' : '#fbbf24';
                    content += `<div style="margin-left: 8px; color: ${color};">${checkmark}${itemReq.itemName} ${itemReq.mustCraft ? '(Craft)' : ''}</div>`;
                });
            }

            // Show resource costs if available
            if (node.resourceCosts && !researched) {
                content += '<div style="font-size: 12px; color: #9ca3af; margin-top: 8px; margin-bottom: 4px;">Resources Required:</div>';
                for (const [resource, cost] of Object.entries(node.resourceCosts)) {
                    content += `<div style="margin-left: 8px; color: #cbd5e1; font-size: 11px;">${resource.charAt(0).toUpperCase() + resource.slice(1)}: ${cost}</div>`;
                }
            }

            // Show time requirement if available and not researched
            if (node.timeDays && !researched) {
                content += `<div style="font-size: 11px; color: #64748b; margin-top: 8px;">Time: ${node.timeDays} days (in settlement)</div>`;
            }

            if (node.unlocks && node.unlocks.length > 0) {
                content += '<div style="font-size: 12px; color: #9ca3af; margin-top: 8px; margin-bottom: 4px;">Unlocks:</div>';
                node.unlocks.forEach(unlockId => {
                    const unlockNode = treeData.nodes[unlockId];
                    if (unlockNode) {
                        content += `<div style="margin-left: 8px; color: #60a5fa;">• ${unlockNode.name}</div>`;
                    }
                });
            }
        }

        tooltip.innerHTML = content;
        tooltip.style.display = 'block';
        tooltip.style.left = (mouseX + 15) + 'px';
        tooltip.style.top = (mouseY + 15) + 'px';
    }

    function hideTooltip() {
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    function render() {
        if (!ctx || !treeData) return;

        // Clear canvas with background color
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw connection lines first (behind nodes)
        drawConnections();

        // Draw nodes
        for (const nodeId in treeData.nodes) {
            drawNode(nodeId);
        }
    }

    function drawConnections() {
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 2;

        for (const nodeId in treeData.nodes) {
            const node = treeData.nodes[nodeId];

            // Draw lines to unlocked nodes
            for (const unlockedId of node.unlocks) {
                const unlockedNode = treeData.nodes[unlockedId];
                if (unlockedNode) {
                    ctx.beginPath();
                    ctx.moveTo(node.x, node.y);
                    ctx.lineTo(unlockedNode.x, unlockedNode.y);
                    ctx.stroke();
                }
            }
        }
    }

    function drawNode(nodeId) {
        const node = treeData.nodes[nodeId];
        const researched = hasResearched(nodeId);
        const available = isAvailable(nodeId);
        const hovered = hoveredNode === nodeId;

        // Check if this is currently being researched
        const state = window.GameState ? window.GameState.getState() : null;
        const isActiveResearch = state && state.activeResearch && state.activeResearch.nodeId === nodeId;

        // Determine node color
        let fillColor;
        if (researched) {
            fillColor = COLORS.researched;
        } else if (isActiveResearch) {
            fillColor = '#f59e0b'; // Orange for in-progress research
        } else if (available) {
            fillColor = COLORS.available;
        } else {
            fillColor = COLORS.locked;
        }

        // Draw progress fill if researching (water fill effect from bottom to top)
        if (isActiveResearch && state.activeResearch.daysElapsed >= 0) {
            // Calculate progress with REAL-TIME interpolation for smooth, continuous filling
            // Get current time including hours for smooth progress
            const currentTotalDays = window.TimeSystem ?
                (TimeSystem.currentTime.day +
                 (TimeSystem.currentTime.month * TimeSystem.DAYS_PER_MONTH) +
                 (TimeSystem.currentTime.year * TimeSystem.DAYS_PER_YEAR) +
                 (TimeSystem.currentTime.hour / TimeSystem.HOURS_PER_DAY)) : 0;

            const daysElapsed = currentTotalDays - state.activeResearch.startDay;
            const rawProgress = daysElapsed / state.activeResearch.daysRequired;
            const progress = Math.min(1, Math.max(0, rawProgress));

            // Draw base circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = fillColor;
            ctx.fill();

            // Draw water fill progress
            if (progress > 0.001) { // Small threshold to avoid rendering artifacts
                ctx.save();

                // Create circular clipping mask
                ctx.beginPath();
                ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
                ctx.clip();

                // Calculate fill height (from bottom to top) with smooth easing
                const fillHeight = NODE_RADIUS * 2 * progress;
                const fillY = node.y + NODE_RADIUS - fillHeight;

                // Add subtle gradient for more fluid appearance
                const gradient = ctx.createLinearGradient(node.x, fillY, node.x, node.y + NODE_RADIUS);
                gradient.addColorStop(0, '#60a5fa'); // Lighter blue at top
                gradient.addColorStop(1, '#3b82f6'); // Darker blue at bottom

                // Draw water fill rectangle with gradient
                ctx.fillStyle = gradient;
                ctx.fillRect(node.x - NODE_RADIUS, fillY, NODE_RADIUS * 2, fillHeight);

                // Add a subtle wave effect at the top of the water
                if (progress < 0.99) { // Don't show wave when almost complete
                    ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    const waveY = fillY + 1;
                    ctx.moveTo(node.x - NODE_RADIUS, waveY);
                    // Simple sine wave
                    for (let i = 0; i <= NODE_RADIUS * 2; i += 2) {
                        const x = node.x - NODE_RADIUS + i;
                        const wave = Math.sin((i / 5) + (Date.now() / 200)) * 1.5;
                        ctx.lineTo(x, waveY + wave);
                    }
                    ctx.stroke();
                }

                ctx.restore();
            }
        } else {
            // Draw normal circle (no active research)
            ctx.beginPath();
            ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = fillColor;
            ctx.fill();
        }

        // Draw hover border
        if (hovered) {
            ctx.strokeStyle = COLORS.hover;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw checkmark if researched
        if (researched) {
            ctx.strokeStyle = COLORS.text;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(node.x - 10, node.y);
            ctx.lineTo(node.x - 5, node.y + 8);
            ctx.lineTo(node.x + 10, node.y - 8);
            ctx.stroke();
        }

        // Draw node name under the node (always visible)
        const isLocked = !available && !researched;
        const displayName = isLocked ? 'Unknown' : node.name;

        ctx.fillStyle = COLORS.text;
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(displayName, node.x, node.y + NODE_RADIUS + 15);
    }

    function updateResearchProgress() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (!state || !state.activeResearch || !state.character) return;

        const activeResearch = state.activeResearch;
        const character = state.character;

        // Check if player is in settlement
        if (!character.inSettlement) {
            // Pause research if not in settlement
            if (!activeResearch.isPaused) {
                activeResearch.isPaused = true;
                console.log('Research paused - player left settlement');
            }
            return;
        }

        // Resume research if in settlement and paused
        if (activeResearch.isPaused) {
            activeResearch.isPaused = false;
            console.log('Research resumed - player in settlement');
        }

        // Calculate days elapsed (with fractional hours for smooth progress)
        const currentDay = window.TimeSystem ?
            (TimeSystem.currentTime.day +
             (TimeSystem.currentTime.month * TimeSystem.DAYS_PER_MONTH) +
             (TimeSystem.currentTime.year * TimeSystem.DAYS_PER_YEAR) +
             (TimeSystem.currentTime.hour / TimeSystem.HOURS_PER_DAY)) : 0;

        const totalDaysElapsed = currentDay - activeResearch.startDay;

        // Update days elapsed
        activeResearch.daysElapsed = totalDaysElapsed;

        // Check if research is complete
        if (totalDaysElapsed >= activeResearch.daysRequired) {
            completeResearch(activeResearch.nodeId);
        }
    }

    function onSettlementEnter() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (!state || !state.activeResearch) return;

        if (state.activeResearch.isPaused) {
            state.activeResearch.isPaused = false;
            console.log('Research auto-resumed on settlement entry');
            render();
        }
    }

    function onSettlementExit() {
        const state = window.GameState ? window.GameState.getState() : null;
        if (!state || !state.activeResearch) return;

        if (!state.activeResearch.isPaused) {
            state.activeResearch.isPaused = true;
            console.log('Research auto-paused on settlement exit');
            render();
        }
    }

    return {
        init,
        loadTree,
        render,
        reloadState,
        isAvailable,
        clickNode,
        hasResearched,
        checkAndAutoCompleteNodes,
        reset,
        updateResearchProgress,
        onSettlementEnter,
        onSettlementExit
    };
})();

window.Research = Research;
