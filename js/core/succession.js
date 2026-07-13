// ============================================
// Succession & Legacy (Living Frontier Phase 4)
// ============================================
//
// Aging, death, heirs, graves, and the New Founder — see docs/MAP-DESIGN.md.
//
// The rules (locked in the design doc):
//   - Characters age with in-game time and die of old age. Age is the clock.
//   - The run continues past death ONLY with a designated heir (an anointed
//     settler). Inheritance is WORLD + GEAR ONLY — skills/stats reset.
//   - Dying heirless ends the run, but the world persists: a New Founder
//     arrives years later at the overgrown remains of the domain.
//   - Graves appear where characters die; honoring a predecessor's grave
//     grants the heir a one-time Remembrance boon.
//
// Dynasty state lives in GameState.dynasty:
//   {
//     generation: 1,
//     heir: null | { name, anointedDay },
//     pastCharacters: [{ name, generation, cause, diedDay, ageAtDeath, region }],
//     runEnded: false
//   }

const Succession = (() => {
    'use strict';

    const DAYS_PER_YEAR = 180;          // matches TimeSystem
    const LIFESPAN_MIN = 65;
    const LIFESPAN_SPREAD = 20;         // lifespan = 65 + 0..20 years
    const ELDERLY_YEARS_BEFORE_END = 10; // stat decay begins this many years out
    const HEIR_START_AGE = 18;
    const NEW_FOUNDER_GAP_DAYS = 360;   // 2 years pass before a New Founder arrives

    const HEIR_NAMES = [
        'Aldric', 'Brenna', 'Cassia', 'Doran', 'Elara', 'Fenwick', 'Gwyn',
        'Hale', 'Isolde', 'Joren', 'Kestrel', 'Lysa', 'Marek', 'Nadia',
        'Osric', 'Petra', 'Quinn', 'Rowan', 'Sable', 'Torin', 'Una', 'Wren'
    ];

    let dying = false; // re-entrancy guard

    // ─── State ───────────────────────────────────────────────────────────────

    function ensureDynasty() {
        const state = window.GameState?.getState();
        if (!state) return null;
        if (!state.dynasty) {
            state.dynasty = {
                generation: state.character?.generation || 1,
                heir: null,
                pastCharacters: [],
                runEnded: false
            };
        }
        return state.dynasty;
    }

    function init() {
        const dynasty = ensureDynasty();
        const character = window.GameState?.getState()?.character;

        if (character) {
            // Backfill aging fields on older characters
            if (character.lifespan === undefined) {
                character.lifespan = LIFESPAN_MIN + Math.floor(Math.random() * (LIFESPAN_SPREAD + 1));
            }
            if (character.ageDaysAccum === undefined) {
                character.ageDaysAccum = 0;
            }
        }

        // A save that ended heirless re-offers the New Founder on load
        if (dynasty && dynasty.runEnded) {
            showRunEndedModal();
        }
    }

    // ─── Aging ───────────────────────────────────────────────────────────────

    /**
     * Called from TimeSystem on every time advance.
     */
    function onTimeAdvance(daysAdvanced) {
        const state = window.GameState?.getState();
        const character = state?.character;
        const dynasty = ensureDynasty();
        if (!character || !dynasty || dynasty.runEnded || dying) return;

        if (character.lifespan === undefined) {
            character.lifespan = LIFESPAN_MIN + Math.floor(Math.random() * (LIFESPAN_SPREAD + 1));
        }

        character.ageDaysAccum = (character.ageDaysAccum || 0) + daysAdvanced;

        // Birthdays
        while (character.ageDaysAccum >= DAYS_PER_YEAR) {
            character.ageDaysAccum -= DAYS_PER_YEAR;
            character.age = (character.age || 0) + 1;
            onBirthday(character);
            if (dying) return; // died of old age mid-loop
        }

        // If the heir was a settler and the settlement emptied out, they're
        // gone (the settler roster sync also calls clearHeir by id)
        if (dynasty.heir) {
            const pop = state.settlement?.population;
            if (pop && pop.total <= 0) {
                clearHeir('Your heir has perished with the settlement... you must anoint another.');
            }
        }
    }

    /**
     * The heir is gone (starved, scattered). Called by the settler roster sync.
     */
    function clearHeir(message) {
        const dynasty = ensureDynasty();
        if (!dynasty || !dynasty.heir) return;
        dynasty.heir = null;
        if (message && window.ActivityLog) {
            ActivityLog.addMessage(message, 'warning');
        }
    }

    // ─── Deeds (Chronicle bookkeeping) ───────────────────────────────────────

    /**
     * Record a deed for the current generation. Keys: regionsDiscovered,
     * nestsCleared, outpostsFounded, gravesHonored, settlersJoined.
     */
    function recordDeed(key, amount = 1) {
        const dynasty = ensureDynasty();
        if (!dynasty) return;
        if (!dynasty.deeds) dynasty.deeds = {};
        const gen = String(dynasty.generation);
        if (!dynasty.deeds[gen]) dynasty.deeds[gen] = {};
        dynasty.deeds[gen][key] = (dynasty.deeds[gen][key] || 0) + amount;
    }

    function getDynasty() {
        return ensureDynasty();
    }

    function onBirthday(character) {
        const yearsLeft = character.lifespan - character.age;

        if (yearsLeft <= 0) {
            die('died of old age');
            return;
        }

        if (yearsLeft <= ELDERLY_YEARS_BEFORE_END) {
            // Old age gnaws at the body: lose 1 point from a physical stat
            const physical = ['strength', 'dexterity', 'constitution'];
            const candidates = physical.filter(s => (character.stats?.[s] || 0) > 0);
            if (candidates.length > 0) {
                const stat = candidates[Math.floor(Math.random() * candidates.length)];
                character.stats[stat]--;
                if (window.CharacterStats) CharacterStats.applyToCharacter(character);
            }
            if (window.ActivityLog) {
                ActivityLog.addMessage(
                    yearsLeft <= 3
                        ? `${character.name} is ${character.age} — the frontier will not carry them much longer. Is the heir ready?`
                        : `${character.name} turns ${character.age}. Age is taking its toll.`,
                    'warning'
                );
            }

            // Impossible-to-miss milestones: entering old age, and the final years
            if (window.NotificationManager
                && (yearsLeft === ELDERLY_YEARS_BEFORE_END || yearsLeft === 3)) {
                const heir = getHeir();
                NotificationManager.showNotification({
                    type: 'warning',
                    icon: '⌛',
                    title: yearsLeft === 3 ? 'The Final Years' : 'Age Sets In',
                    message: `${character.name} is ${character.age}`,
                    description: heir
                        ? `${heir.name} stands ready to inherit.`
                        : 'NO HEIR ANOINTED — the line will end!',
                    stackKey: 'aging'
                });
            }
        }

        if (window.updateTopBar) updateTopBar(character);
    }

    // ─── Heirs ───────────────────────────────────────────────────────────────

    function suggestHeirName() {
        return HEIR_NAMES[Math.floor(Math.random() * HEIR_NAMES.length)];
    }

    /**
     * Anoint a settler as heir.
     * @param {Object|string} settler - a settler object ({id, name, trait})
     *        from the settlement roster, or a plain name string (legacy)
     */
    function anointHeir(settler) {
        const state = window.GameState?.getState();
        const dynasty = ensureDynasty();
        if (!state || !dynasty) return { ok: false, reason: 'No game state' };
        if (dynasty.heir) return { ok: false, reason: `${dynasty.heir.name} is already your heir` };

        const pop = state.settlement?.population;
        if (!pop || pop.total <= 0) {
            return { ok: false, reason: 'You need at least one settler to anoint' };
        }

        if (typeof settler === 'object' && settler !== null) {
            dynasty.heir = {
                name: settler.name,
                settlerId: settler.id,
                trait: settler.trait || null,
                anointedDay: window.RegionManager ? RegionManager.getCurrentDay() : 0
            };
        } else {
            dynasty.heir = {
                name: (String(settler || '') || suggestHeirName()).trim().slice(0, 24) || suggestHeirName(),
                settlerId: null,
                trait: null,
                anointedDay: window.RegionManager ? RegionManager.getCurrentDay() : 0
            };
        }

        if (window.ActivityLog) {
            ActivityLog.addMessage(`${dynasty.heir.name} has been anointed as your heir. The line will continue.`, 'success');
        }
        if (window.NotificationManager) {
            NotificationManager.showNotification({
                type: 'success',
                icon: '👑',
                title: 'Heir Anointed',
                message: dynasty.heir.name,
                description: 'Should you fall, they will carry on.'
            });
        }
        if (window.SaveSystem) SaveSystem.save();
        return { ok: true };
    }

    function getHeir() {
        return ensureDynasty()?.heir || null;
    }

    function getGeneration() {
        return ensureDynasty()?.generation || 1;
    }

    // ─── Death & succession ──────────────────────────────────────────────────

    /**
     * The character dies. With an heir the dynasty continues; without one the
     * run ends (the world persists for a New Founder).
     * @param {string} cause - human-readable cause of death
     */
    function die(cause) {
        if (dying) return;
        const state = window.GameState?.getState();
        const dynasty = ensureDynasty();
        const character = state?.character;
        if (!state || !dynasty || !character || dynasty.runEnded) return;
        dying = true;

        const today = window.RegionManager ? RegionManager.getCurrentDay() : 0;
        const currentRegion = state.world?.currentRegion || null;

        // Record the fallen
        dynasty.pastCharacters.push({
            name: character.name,
            generation: dynasty.generation,
            cause,
            diedDay: today,
            ageAtDeath: character.age || 0,
            region: currentRegion ? { x: currentRegion.x, y: currentRegion.y } : null
        });

        // Place a grave where they fell (if inside a region)
        if (currentRegion && window.RegionManager && window.LocalMap) {
            const record = RegionManager.peekRegion(currentRegion.x, currentRegion.y);
            if (record) {
                if (!record.graves) record.graves = [];
                const pos = LocalMap.getPlayerPosition();
                record.graves.push({
                    x: pos.x, y: pos.y,
                    name: character.name,
                    generation: dynasty.generation,
                    honoredBy: []
                });
            }
        }

        if (window.ActivityLog) {
            ActivityLog.addMessage(`${character.name} has ${cause} at age ${character.age}.`, 'warning');
        }

        if (dynasty.heir) {
            succeedTo(dynasty.heir, character, cause);
        } else {
            endRun(character, cause);
        }
        dying = false;
    }

    /**
     * The heir takes over: world + gear only, everything else starts fresh.
     */
    function succeedTo(heir, oldCharacter, cause) {
        const state = window.GameState.getState();
        const dynasty = state.dynasty;

        dynasty.generation++;
        dynasty.heir = null;

        // The heir was a settler — they leave the population to become you
        const pop = state.settlement?.population;
        if (pop && pop.total > 0) {
            pop.total--;
            if (pop.idle > 0) pop.idle--;
        }
        if (heir.settlerId && window.Settlement?.removeSettlerById) {
            Settlement.removeSettlerById(heir.settlerId);
        }

        // World + gear only: inventory and equipment transfer, nothing else
        const newCharacter = Character.create(heir.name, {
            age: HEIR_START_AGE,
            generation: dynasty.generation,
            inventory: oldCharacter.inventory,
            equipment: oldCharacter.equipment,
            skills: {}
        });
        newCharacter.lifespan = LIFESPAN_MIN + Math.floor(Math.random() * (LIFESPAN_SPREAD + 1));
        newCharacter.ageDaysAccum = 0;

        // The heir's trait shapes them: +1 to its mapped stat
        if (heir.trait && window.Settlement?.getTraitDef) {
            const trait = Settlement.getTraitDef(heir.trait);
            if (trait && trait.stat) {
                newCharacter.stats[trait.stat] = (newCharacter.stats[trait.stat] || 0) + 1;
            }
        }

        // Losing a leader weighs on the settlement
        if (window.Settlement?.adjustMorale) {
            Settlement.adjustMorale(-15, `${oldCharacter.name} is mourned`);
        }

        if (window.SkillManager) SkillManager.initializeCharacterSkills(newCharacter);
        if (window.CharacterStats) CharacterStats.applyToCharacter(newCharacter);

        GameState.updateProperty('character', newCharacter);

        returnToSettlementView(newCharacter);

        showSuccessionModal(
            '⚰️ The Torch Passes',
            `${oldCharacter.name} has ${cause} at age ${oldCharacter.age}.`,
            `${heir.name} takes up the mantle as Generation ${dynasty.generation}. `
            + `The territory, the roads, and the gear endure — the rest must be earned anew. `
            + `Remember to anoint a new heir.`
        );

        if (window.ActivityLog) {
            ActivityLog.addMessage(`${heir.name} rises as Generation ${dynasty.generation}.`, 'success');
        }
        refreshAfterCharacterChange(newCharacter);
    }

    /**
     * No heir: the run ends. The world (and this save) persists.
     */
    function endRun(character, cause) {
        const dynasty = window.GameState.getState().dynasty;
        dynasty.runEnded = true;
        if (window.SaveSystem) SaveSystem.save();
        showRunEndedModal(character, cause);
    }

    /**
     * A New Founder arrives years later at the remains of the domain.
     * Fresh character, NO inheritance — the old gear was lost with the dead.
     */
    function arriveAsNewFounder(name) {
        const state = window.GameState.getState();
        const dynasty = ensureDynasty();

        // Years pass; the world festers. No scripted decay needed — the
        // simulation IS the decay: unfed settlers scatter via the starvation
        // rules, nests grow via the lazy sim, forests regrow over the roads.
        if (window.TimeSystem) TimeSystem.advanceDays(NEW_FOUNDER_GAP_DAYS);
        if (window.RegionManager) RegionManager.simulateAll();

        const founderName = (name || 'The Wanderer').trim().slice(0, 24) || 'The Wanderer';
        const newCharacter = Character.create(founderName, {
            age: 20 + Math.floor(Math.random() * 8),
            generation: 1,
            inventory: window.Inventory ? Inventory.create() : [],
            equipment: window.Equipment ? Equipment.create() : {},
            skills: {}
        });
        newCharacter.lifespan = LIFESPAN_MIN + Math.floor(Math.random() * (LIFESPAN_SPREAD + 1));
        newCharacter.ageDaysAccum = 0;

        if (window.SkillManager) SkillManager.initializeCharacterSkills(newCharacter);
        if (window.CharacterStats) CharacterStats.applyToCharacter(newCharacter);

        GameState.updateProperty('character', newCharacter);

        dynasty.runEnded = false;
        dynasty.generation = 1;

        returnToSettlementView(newCharacter);

        if (window.ActivityLog) {
            ActivityLog.addMessage(
                `${founderName} arrives at the overgrown remains of the old domain. Two years have passed... and the wild has not been idle.`,
                'info'
            );
        }
        refreshAfterCharacterChange(newCharacter);
    }

    // ─── View / UI plumbing ──────────────────────────────────────────────────

    /**
     * Pull the (new) character back to the overworld at the settlement.
     */
    function returnToSettlementView(character) {
        const state = window.GameState.getState();

        character.inSettlement = false;
        if (window.TimeSystem) TimeSystem.setInSettlement(false);

        // Leave any region view
        if (state.world?.currentRegion && window.LocalMap) {
            LocalMap.exitToOverworld();
        }

        // Stand at the settlement (heirs come from there; founders arrive there)
        const home = state.world?.overworldSettlement;
        if (home) {
            if (window.WorldMap?.setPlayerPosition) {
                WorldMap.setPlayerPosition(home.x, home.y);
            } else if (state.world) {
                state.world.overworldPos = { x: home.x, y: home.y };
            }
        }
    }

    function refreshAfterCharacterChange(character) {
        if (window.displayCharacterData) displayCharacterData();
        if (window.updateTopBar) updateTopBar(character);
        if (window.TabManager) TabManager.updateSettlementTabVisibility();
        if (window.Settlement) Settlement.updateUI();
        if (window.WorldMap) {
            WorldMap.show();
        }
        if (window.SaveSystem) SaveSystem.save();
    }

    function showSuccessionModal(title, line1, line2) {
        showModal(title, [line1, line2], [
            { label: 'Continue the Line', action: () => {} }
        ]);
    }

    function showRunEndedModal(character, cause) {
        const dynasty = ensureDynasty();
        const gens = dynasty?.pastCharacters?.length || 0;
        const lines = [];
        if (character && cause) {
            lines.push(`${character.name} has ${cause} at age ${character.age} — with no heir to carry on.`);
        }
        lines.push(`The line is broken after ${gens} ${gens === 1 ? 'life' : 'lives'}. The settlement will scatter, the roads will fade... but the land remembers.`);
        lines.push('Years later, a wanderer crests the hill and sees the ruins of a domain worth reclaiming.');

        showModal('🕯️ The Line Is Broken', lines, [
            {
                label: '🚶 Arrive as a New Founder',
                action: () => {
                    const name = prompt('Name the new founder:', 'The Wanderer') || 'The Wanderer';
                    arriveAsNewFounder(name);
                }
            }
        ]);
    }

    /**
     * Minimal blocking modal (independent of the item-details modal).
     */
    function showModal(title, lines, buttons) {
        document.getElementById('succession-modal')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'succession-modal';
        overlay.className = 'succession-modal-overlay';

        const box = document.createElement('div');
        box.className = 'succession-modal-box';

        const h2 = document.createElement('h2');
        h2.textContent = title;
        box.appendChild(h2);

        lines.forEach(text => {
            const p = document.createElement('p');
            p.textContent = text;
            box.appendChild(p);
        });

        buttons.forEach(btn => {
            const el = document.createElement('button');
            el.className = 'succession-modal-btn';
            el.textContent = btn.label;
            el.addEventListener('click', () => {
                overlay.remove();
                btn.action();
            });
            box.appendChild(el);
        });

        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }

    // ─── Graves / Remembrance ────────────────────────────────────────────────

    /**
     * Called when the player steps onto a grave tile. One Remembrance boon
     * per grave per generation: +1 attribute point.
     */
    function honorGrave(grave) {
        const state = window.GameState?.getState();
        const character = state?.character;
        const dynasty = ensureDynasty();
        if (!character || !dynasty || !grave) return;

        if (!grave.honoredBy) grave.honoredBy = [];
        if (grave.honoredBy.includes(dynasty.generation)) return; // already honored

        grave.honoredBy.push(dynasty.generation);
        character.attributePoints = (character.attributePoints || 0) + 1;
        recordDeed('gravesHonored');

        if (window.ActivityLog) {
            ActivityLog.addMessage(
                `You stand at the grave of ${grave.name} (Gen ${grave.generation}). Their strength flows through you. +1 attribute point.`,
                'success'
            );
        }
        if (window.NotificationManager) {
            NotificationManager.showNotification({
                type: 'success',
                icon: '🪦',
                title: 'Remembrance',
                message: `${grave.name} is honored`,
                description: '+1 attribute point'
            });
        }
        if (window.SaveSystem) SaveSystem.save();
    }

    return {
        init,
        onTimeAdvance,
        anointHeir,
        clearHeir,
        suggestHeirName,
        getHeir,
        getGeneration,
        getDynasty,
        recordDeed,
        die,
        arriveAsNewFounder,
        honorGrave
    };
})();

window.Succession = Succession;
