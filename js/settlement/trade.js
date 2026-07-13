// ============================================
// Trade Caravans (Living Frontier — loop closure)
// ============================================
//
// Merchant caravans visit the settlement on a cadence that improves as your
// roads wear in — the organic road system's economic payoff. Each caravan
// brings a handful of one-shot barter offers (no currency; the frontier runs
// on goods). Offers can swap surplus resources or buy crafted items.
//
// State lives in GameState.trade:
//   { nextArrivalDay, caravan: null | { arrivedDay, leavesDay, offers: [...] } }

const Trade = (() => {
    'use strict';

    const BASE_INTERVAL_DAYS = 30;   // caravan cadence with no roads
    const MIN_INTERVAL_DAYS = 12;    // best cadence with well-worn roads
    const STAY_DAYS = 6;             // how long a caravan stays
    const OFFERS_PER_CARAVAN = 3;

    // Barter pool. give/get use settlement resource ids; getItem uses item ids
    // from items.json/materials.json (granted to the character's inventory).
    const OFFER_POOL = [
        { give: { wood: 20 },  get: { stone: 12 } },
        { give: { stone: 15 }, get: { wood: 25 } },
        { give: { food: 25 },  get: { wood: 18 } },
        { give: { wood: 30 },  get: { food: 25 } },
        { give: { wood: 35 },  get: { iron: 4 } },
        { give: { food: 30 },  get: { copper: 4 } },
        { give: { stone: 25 }, get: { clay: 15 } },
        { give: { food: 25 },  getItem: { id: 'health_potion', quantity: 2 } },
        { give: { wood: 40 },  getItem: { id: 'coal', quantity: 8 } },
        { give: { stone: 30 }, getItem: { id: 'copper_ore', quantity: 3 } },
        { give: { food: 40 },  getItem: { id: 'copper_ingot', quantity: 1 } }
    ];

    function ensureState() {
        const state = window.GameState?.getState();
        if (!state) return null;
        if (!state.trade) {
            state.trade = { nextArrivalDay: null, caravan: null };
        }
        return state.trade;
    }

    function getCurrentDay() {
        return window.RegionManager ? RegionManager.getCurrentDay() : 0;
    }

    /**
     * Caravan cadence: worn roads across the world shorten the wait.
     */
    function getArrivalInterval() {
        let totalWear = 0;
        const regions = window.GameState?.getState()?.world?.regions || {};
        for (const key of Object.keys(regions)) {
            totalWear += regions[key]?.roadWear || 0;
        }
        const discount = Math.min(BASE_INTERVAL_DAYS - MIN_INTERVAL_DAYS, Math.floor(totalWear / 15));
        return BASE_INTERVAL_DAYS - discount;
    }

    /**
     * Advance caravan arrivals/departures. Called from Settlement.onTimeAdvance.
     */
    function onTimeAdvance() {
        const trade = ensureState();
        if (!trade) return;

        // Caravans only visit once a settlement exists
        const hasSettlement = !!window.GameState?.getState()?.world?.overworldSettlement;
        if (!hasSettlement) return;

        const today = getCurrentDay();

        if (trade.nextArrivalDay === null) {
            trade.nextArrivalDay = today + getArrivalInterval();
            return;
        }

        // Departure
        if (trade.caravan && today >= trade.caravan.leavesDay) {
            trade.caravan = null;
            trade.nextArrivalDay = today + getArrivalInterval();
            if (window.ActivityLog) {
                ActivityLog.addMessage('The trade caravan has moved on.', 'info');
            }
        }

        // Arrival
        if (!trade.caravan && today >= trade.nextArrivalDay) {
            trade.caravan = {
                arrivedDay: today,
                leavesDay: today + STAY_DAYS,
                offers: generateOffers()
            };
            if (window.ActivityLog) {
                ActivityLog.addMessage(`A trade caravan has arrived! It will stay ${STAY_DAYS} days. (Settlement → Trade)`, 'success');
            }
            if (window.NotificationManager) {
                NotificationManager.showNotification({
                    type: 'success',
                    icon: '🐫',
                    title: 'Caravan Arrived',
                    message: 'Merchants at the gates',
                    description: `Trading for ${STAY_DAYS} days`,
                    stackKey: 'caravan-arrival' // never stack duplicate arrivals
                });
            }
        }
    }

    function generateOffers() {
        // Shuffle-pick distinct offers
        const pool = [...OFFER_POOL];
        const offers = [];
        for (let i = 0; i < OFFERS_PER_CARAVAN && pool.length > 0; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            const [offer] = pool.splice(idx, 1);
            offers.push({ ...offer, used: false });
        }
        return offers;
    }

    // ─── Executing trades ────────────────────────────────────────────────────

    function canAfford(offer) {
        const resources = window.GameState?.getState()?.settlement?.resources;
        if (!resources) return false;
        return Object.keys(offer.give).every(id => (resources[id]?.current || 0) >= offer.give[id]);
    }

    /**
     * Execute an offer by index. Returns {ok, reason?}.
     */
    function executeOffer(index) {
        const trade = ensureState();
        const offer = trade?.caravan?.offers?.[index];
        if (!offer) return { ok: false, reason: 'No such offer' };
        if (offer.used) return { ok: false, reason: 'Already traded' };
        if (!canAfford(offer)) return { ok: false, reason: 'Not enough resources' };

        const resources = window.GameState.getState().settlement.resources;

        // Pay
        for (const id of Object.keys(offer.give)) {
            resources[id].current -= offer.give[id];
        }

        // Receive: resources (clamped at capacity)...
        const received = [];
        if (offer.get) {
            for (const id of Object.keys(offer.get)) {
                if (!resources[id]) continue;
                const space = Math.max(0, resources[id].max - resources[id].current);
                const moved = Math.min(offer.get[id], space);
                resources[id].current += moved;
                received.push(`${moved} ${id}`);
            }
        }
        // ...or items into the character's inventory
        if (offer.getItem && window.ItemFactory && window.Inventory) {
            const character = window.GameState.getState().character;
            let added = 0;
            for (let i = 0; i < offer.getItem.quantity; i++) {
                const item = ItemFactory.createItem(offer.getItem.id);
                if (item && Inventory.addItem(character.inventory, item)) added++;
            }
            received.push(`${added}x ${offer.getItem.id.replace(/_/g, ' ')}`);
            if (window.renderInventoryUI) renderInventoryUI();
        }

        offer.used = true;

        if (window.ActivityLog) {
            const gave = Object.keys(offer.give).map(id => `${offer.give[id]} ${id}`).join(', ');
            ActivityLog.addMessage(`Traded ${gave} for ${received.join(', ')}.`, 'loot');
        }
        if (window.Settlement) Settlement.updateUI();
        if (window.SaveSystem) SaveSystem.save();
        return { ok: true };
    }

    // ─── Trade tab UI ────────────────────────────────────────────────────────

    function describeSide(offer) {
        const gave = Object.keys(offer.give).map(id => `${offer.give[id]} ${id}`).join(' + ');
        let got;
        if (offer.get) {
            got = Object.keys(offer.get).map(id => `${offer.get[id]} ${id}`).join(' + ');
        } else if (offer.getItem) {
            got = `${offer.getItem.quantity}x ${offer.getItem.id.replace(/_/g, ' ')}`;
        }
        return { gave, got };
    }

    /**
     * Render the Settlement → Trade tab. Follows the fingerprint +
     * in-place-update pattern (this runs on the 50ms settlement tick).
     */
    function updateTradeTab() {
        const container = document.querySelector('#settlement-trade-content .trade-routes');
        if (!container) return;
        if (container.offsetParent === null) return; // hidden

        const trade = ensureState();
        if (!trade) return;

        const today = getCurrentDay();
        const caravan = trade.caravan;

        const fingerprint = caravan
            ? `c:${caravan.arrivedDay}:${caravan.offers.map(o => o.used ? 1 : 0).join('')}`
            : `none:${trade.nextArrivalDay}`;

        if (container.dataset.tradeFingerprint === fingerprint && container.querySelector('.caravan-status')) {
            // IN-PLACE: countdown + affordability only
            const countdownEl = container.querySelector('#caravan-countdown');
            if (countdownEl) {
                const text = caravan
                    ? `Leaves in ${Math.max(0, caravan.leavesDay - today)} day(s)`
                    : `Next caravan expected in ~${Math.max(0, (trade.nextArrivalDay || today) - today)} day(s)`;
                if (countdownEl.textContent !== text) countdownEl.textContent = text;
            }
            if (caravan) {
                const resources = window.GameState?.getState()?.settlement?.resources || {};
                container.querySelectorAll('.caravan-trade-btn').forEach((btn, i) => {
                    const offer = caravan.offers[i];
                    if (offer) btn.disabled = offer.used || !canAfford(offer);
                });
                container.querySelectorAll('.offer-stock').forEach(el => {
                    const id = el.dataset.resource;
                    const text = `(have ${Math.floor(resources[id]?.current || 0)})`;
                    if (el.textContent !== text) el.textContent = text;
                });
            }
            return;
        }

        // FULL REBUILD
        let html = '<h3>Trade</h3>';

        if (!caravan) {
            const eta = trade.nextArrivalDay !== null
                ? Math.max(0, trade.nextArrivalDay - today)
                : '?';
            html += `
                <div class="caravan-status">
                    <div>🐫 No caravan at the gates.</div>
                    <div id="caravan-countdown">Next caravan expected in ~${eta} day(s)</div>
                    <p class="help-text">Well-traveled roads bring merchants more often (current cadence: every ~${getArrivalInterval()} days).</p>
                </div>
            `;
        } else {
            html += `
                <div class="caravan-status">
                    <div>🐫 A caravan is trading at the gates!</div>
                    <div id="caravan-countdown">Leaves in ${Math.max(0, caravan.leavesDay - today)} day(s)</div>
                </div>
                <div class="caravan-offers">
            `;
            const resources = window.GameState?.getState()?.settlement?.resources || {};
            caravan.offers.forEach((offer, i) => {
                const { gave, got } = describeSide(offer);
                // Show current stock of the primary cost resource
                const costId = Object.keys(offer.give)[0];
                const stock = Math.floor(resources[costId]?.current || 0);
                html += `
                    <div class="caravan-offer${offer.used ? ' offer-done' : ''}">
                        <span>${gave} <span class="offer-stock" data-resource="${costId}">(have ${stock})</span> → <strong>${got}</strong></span>
                        <button class="caravan-trade-btn" data-offer="${i}" ${offer.used || !canAfford(offer) ? 'disabled' : ''}>
                            ${offer.used ? 'Traded' : 'Trade'}
                        </button>
                    </div>
                `;
            });
            html += '</div>';
        }

        container.innerHTML = html;
        container.dataset.tradeFingerprint = fingerprint;

        container.querySelectorAll('.caravan-trade-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const result = executeOffer(parseInt(btn.dataset.offer, 10));
                if (!result.ok && result.reason !== 'Already traded') {
                    alert(result.reason);
                }
            });
        });
    }

    return {
        onTimeAdvance,
        updateTradeTab,
        executeOffer,
        getArrivalInterval
    };
})();

window.Trade = Trade;
