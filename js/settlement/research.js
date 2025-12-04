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
        setupEventListeners();
        render();
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

        researchedNodes.add(nodeId);

        // Handle recipe unlocks if this node unlocks recipes
        const node = treeData.nodes[nodeId];
        if (node && node.unlocksRecipes && node.unlocksRecipes.length > 0) {
            console.log(`Research ${nodeId} unlocks recipes:`, node.unlocksRecipes);
            // Recipes are now unlockable through the research system
            // The crafting system will check Research.hasResearched() to allow crafting
        }

        render();

        // Emit event if EventSystem exists
        if (window.EventSystem) {
            EventSystem.emit('research-completed', { nodeId, node });
        }
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

    // Check all nodes and auto-complete any that have their requirements met
    function checkAndAutoCompleteNodes() {
        let anyCompleted = false;

        for (const nodeId in treeData.nodes) {
            const node = treeData.nodes[nodeId];

            // Skip if already researched
            if (hasResearched(nodeId)) {
                continue;
            }

            // Check if this node should auto-complete (has item requirements met)
            if (node.itemRequirements && node.itemRequirements.length > 0) {
                if (isAvailable(nodeId)) {
                    console.log(`Auto-completing research node: ${node.name}`);
                    researchedNodes.add(nodeId);

                    // Handle recipe unlocks
                    if (node.unlocksRecipes && node.unlocksRecipes.length > 0) {
                        console.log(`Research ${nodeId} unlocks recipes:`, node.unlocksRecipes);
                    }

                    // Emit event
                    if (window.EventSystem) {
                        EventSystem.emit('research-completed', { nodeId, node });
                    }

                    anyCompleted = true;
                }
            }
        }

        if (anyCompleted) {
            render();
        }

        return anyCompleted;
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

            if (node.unlocks && node.unlocks.length > 0) {
                content += '<div style="font-size: 12px; color: #9ca3af; margin-top: 8px; margin-bottom: 4px;">Unlocks:</div>';
                node.unlocks.forEach(unlockId => {
                    const unlockNode = treeData.nodes[unlockId];
                    if (unlockNode) {
                        content += `<div style="margin-left: 8px; color: #60a5fa;">• ${unlockNode.name}</div>`;
                    }
                });
            }

            content += `<div style="font-size: 11px; color: #64748b; margin-top: 8px;">Cost: ${node.cost} | Time: ${node.time}</div>`;
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

        // Determine node color
        let fillColor;
        if (researched) {
            fillColor = COLORS.researched;
        } else if (available) {
            fillColor = COLORS.available;
        } else {
            fillColor = COLORS.locked;
        }

        // Draw circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Draw hover border
        if (hovered) {
            ctx.strokeStyle = COLORS.hover;
            ctx.lineWidth = 3;
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

        // Draw hover border on top if hovered
        if (hovered) {
            ctx.strokeStyle = COLORS.hover;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    return {
        init,
        loadTree,
        render,
        isAvailable,
        clickNode,
        hasResearched,
        checkAndAutoCompleteNodes,
        reset
    };
})();

window.Research = Research;
