// DA-LARES Turn-by-Turn Directions Steps Module
// Build step instructions, step list rendering, and active step highlighting.

import { BUILDING_DIRECTORY } from './data/buildings.js?v=72';
import { state } from './data/state.js';
import { map } from './map-setup.js';
import { startArrivedCountdown } from './walker.js';
import { isPhoneMode } from './mode.js';
import { updatePhoneLiveNavUI } from './phone-nav.js';

// GOOGLE MAPS TURN-BY-TURN DIRECTIONS ENGINE
// ==========================================
let steps = null;
let destName = '';
let lastActiveStepIdx = -1;

export function buildSteps(coords, directory, destId) {
    if (!coords || coords.length < 2) return [];

    const routeLine = turf.lineString(coords);
    const totalDistance = turf.length(routeLine, { units: 'meters' });

    const destBuilding = directory ? directory.find(b => b.id === destId) : null;
    destName = destBuilding ? destBuilding.name : (state.currentRouteDestName || 'Destination');
    if (destName === 'Mis Rafis Building') destName = 'MIS / RAFIS Building';
    state.currentRouteDestName = destName;

    // 1. Calculate cumulative distance for each vertex along the route
    const cumulativeDists = [0];
    let runningDist = 0;
    for (let i = 1; i < coords.length; i++) {
        const segDist = turf.distance(coords[i - 1], coords[i], { units: 'meters' });
        runningDist += segDist;
        cumulativeDists.push(runningDist);
    }

    // 2. Detect turns at interior vertices
    const rawTurns = [];
    for (let i = 1; i < coords.length - 1; i++) {
        const prev = coords[i - 1];
        const curr = coords[i];
        const next = coords[i + 1];

        const b1 = turf.bearing(prev, curr);
        const b2 = turf.bearing(curr, next);

        let diff = b2 - b1;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;

        const absDiff = Math.abs(diff);
        if (absDiff < 25) continue; // Ignore differences under 25 deg (straight)

        let type = 'turn-right';
        let action = 'Turn right';
        let icon = '↱';

        if (absDiff <= 60) {
            if (diff > 0) {
                type = 'bear-right';
                action = 'Bear right';
                icon = '↗';
            } else {
                type = 'bear-left';
                action = 'Bear left';
                icon = '↖';
            }
        } else if (absDiff <= 135) {
            if (diff > 0) {
                type = 'turn-right';
                action = 'Turn right';
                icon = '↱';
            } else {
                type = 'turn-left';
                action = 'Turn left';
                icon = '↰';
            }
        } else {
            type = 'uturn';
            action = 'Make a U-turn';
            icon = '↩';
        }

        rawTurns.push({
            index: i,
            point: curr,
            at: cumulativeDists[i],
            diff: diff,
            absDiff: absDiff,
            type: type,
            action: action,
            icon: icon
        });
    }

    // 3. Merge consecutive turns closer than 8 m into one step
    const mergedTurns = [];
    for (let i = 0; i < rawTurns.length; i++) {
        const t = rawTurns[i];
        if (mergedTurns.length > 0) {
            const prevT = mergedTurns[mergedTurns.length - 1];
            if (t.at - prevT.at < 8) {
                if (t.absDiff > prevT.absDiff) {
                    mergedTurns[mergedTurns.length - 1] = {
                        ...t,
                        at: prevT.at
                    };
                }
                continue;
            }
        }
        mergedTurns.push(t);
    }

    // 4. Pick nearest landmark within 35m (excluding destination), deduplicating consecutive mentions
    let lastMentionedLandmark = null;
    mergedTurns.forEach(turn => {
        let nearestDist = Infinity;
        let nearestBuilding = null;
        directory.forEach(b => {
            if (b.id === destId) return; // Exclude destination
            const d = turf.distance(turn.point, b.coords, { units: 'meters' });
            if (d <= 35 && d < nearestDist) {
                nearestDist = d;
                nearestBuilding = b;
            }
        });

        if (nearestBuilding) {
            if (nearestBuilding.name === lastMentionedLandmark) {
                turn.landmark = nearestBuilding.name;
                turn.text = `${turn.action} along walkway`;
            } else {
                turn.landmark = nearestBuilding.name;
                turn.text = `${turn.action} at ${nearestBuilding.name}`;
                lastMentionedLandmark = nearestBuilding.name;
            }
        } else {
            turn.landmark = null;
            turn.text = `${turn.action} along walkway`;
        }
    });

    // 5. Add "past X" wording for straight sections longer than 60 m that pass a building
    const waypoints = [
        { at: 0, point: coords[0] },
        ...mergedTurns,
        { at: totalDistance, point: coords[coords.length - 1] }
    ];

    const intermediateSteps = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
        const segStart = waypoints[i].at;
        const segEnd = waypoints[i + 1].at;
        const segLen = segEnd - segStart;

        if (segLen > 60) {
            const midDist = segStart + (segLen / 2);
            const midPoint = turf.along(routeLine, midDist, { units: 'meters' }).geometry.coordinates;

            let pastBuilding = null;
            let minPastDist = Infinity;
            directory.forEach(b => {
                if (b.id === destId) return;
                const d = turf.distance(midPoint, b.coords, { units: 'meters' });
                if (d <= 35 && d < minPastDist) {
                    minPastDist = d;
                    pastBuilding = b;
                }
            });

            if (pastBuilding) {
                intermediateSteps.push({
                    at: midDist,
                    point: midPoint,
                    type: 'past',
                    action: 'Continue straight',
                    icon: '⬆️',
                    landmark: pastBuilding.name,
                    text: `Continue straight past ${pastBuilding.name}`
                });
            }
        }
    }

    // 6. Combine all steps
    let combined = [...mergedTurns, ...intermediateSteps];
    combined.sort((a, b) => a.at - b.at);

    const arriveStep = {
        at: totalDistance,
        point: coords[coords.length - 1],
        type: 'arrive',
        action: 'Arrive',
        icon: '🏁',
        landmark: destName,
        text: `Arrive at ${destName}`
    };

    // If no detectable turns or straightaways
    if (combined.length === 0) {
        const resultSteps = [

        ];
        steps = resultSteps;
        destName = destName;
        state.steps = resultSteps;
        state.destName = destName;
        return resultSteps;
    }

    // Initial start step
    let startText = `Head straight toward ${destName}`;
    if (combined.length > 0 && combined[0].at < 12) {
        startText = combined[0].text;
    }
    const startStep = {
        at: 0,
        point: coords[0],
        type: 'start',
        action: 'Start',
        icon: '🚶',
        landmark: null,
        text: startText
    };

    // Filter out any step too close to start or arrive
    const middleSteps = combined.filter(s => s.at >= 8 && s.at <= totalDistance - 6);
    const resultSteps = [startStep, ...middleSteps, arriveStep];
    steps = resultSteps;
    state.steps = resultSteps;
    state.destName = destName;
    state.currentRouteSteps = resultSteps;
    state.currentRouteDestName = destName;
    return resultSteps;
}

export function renderStepsList(steps) {
    const list = document.getElementById('route-steps-list');
    if (!list) return;
    const btnText = document.getElementById('rst-btn-text');
    if (btnText) btnText.textContent = `All Steps (${steps.length})`;
    const container = document.getElementById('route-steps-container');
    if (container) container.classList.remove('expanded');
    const icon = document.getElementById('rst-icon');
    if (icon) icon.textContent = '▾';

    let html = '';
    steps.forEach((s, idx) => {
        const prevAt = idx > 0 ? steps[idx - 1].at : 0;
        const stepDist = Math.max(1, Math.round(s.at - prevAt));
        const distLabel = idx === 0 ? 'Start' : `${stepDist} m`;

        html += `
            <div class="route-step-item" id="route-step-${idx}" onclick="focusRouteStep(${idx})">
                <div class="route-step-icon">${s.icon}</div>
                <div class="route-step-text-wrap">
                    <div class="route-step-instruction">${s.text}</div>
                    <div class="route-step-dist">${distLabel}</div>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

export function focusRouteStep(idx) {
    const currentSteps = state.currentRouteSteps || state.steps || steps;
    if (!currentSteps || !currentSteps[idx]) return;
    const s = currentSteps[idx];
    map.flyTo({
        center: s.point,
        zoom: 19.8,
        pitch: 60,
        duration: 1000
    });
}

export function highlightActiveStep(idx) {
    if (idx === state.lastActiveStepIdx) return;
    state.lastActiveStepIdx = idx;
    document.querySelectorAll('.route-step-item').forEach((el, i) => {
        el.classList.remove('active', 'completed', 'upcoming');
        if (i < idx) {
            el.classList.add('completed');
        } else if (i === idx) {
            el.classList.add('active');
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            el.classList.add('upcoming');
        }
    });
}

let tbtBannerEl = null;
let tbtIconEl = null;
let tbtDistEl = null;
let tbtInstEl = null;
let lastTbtIcon = '';
let lastTbtDist = '';
let lastTbtInst = '';
let lastActiveNavStepIdx = -1;

export function resetStepsNavigation() {
    lastActiveNavStepIdx = -1;
    lastTbtIcon = '';
    lastTbtDist = '';
    lastTbtInst = '';
    state.lastActiveStepIdx = -1;
    document.querySelectorAll('.route-step-item').forEach((el, i) => {
        el.classList.remove('active', 'completed', 'upcoming');
        if (i === 0) el.classList.add('active');
        else el.classList.add('upcoming');
    });
}

export function updateLiveNavigation(currentDist, totalDist) {
    const routeSteps = state.currentRouteSteps || state.steps || steps;
    const destBldg = (typeof BUILDING_DIRECTORY !== 'undefined') ? BUILDING_DIRECTORY.find(b => b.id === (state.selectedBuildingId || state.activeRoute)) : null;
    let targetDestName = state.currentRouteDestName || (destBldg ? destBldg.name : '') || state.destName || destName || (routeSteps && routeSteps[routeSteps.length - 1]?.landmark) || 'your destination';
    if (targetDestName === 'Mis Rafis Building') targetDestName = 'MIS / RAFIS Building';
    if (!routeSteps || routeSteps.length === 0) return;

    if (!tbtBannerEl) tbtBannerEl = document.getElementById('turn-by-turn-banner');
    if (!tbtIconEl) tbtIconEl = document.getElementById('tbt-icon');
    if (!tbtDistEl) tbtDistEl = document.getElementById('tbt-distance');
    if (!tbtInstEl) tbtInstEl = document.getElementById('tbt-instruction');
    if (!tbtBannerEl) return;

    if (currentDist >= totalDist - 3) {
        tbtBannerEl.classList.add('arrived');
        if (tbtIconEl && lastTbtIcon !== '🏁') { tbtIconEl.innerHTML = '🏁'; lastTbtIcon = '🏁'; }
        if (tbtDistEl && lastTbtDist !== 'Arrived') { tbtDistEl.textContent = 'Arrived'; lastTbtDist = 'Arrived'; }
        const arrText = `You have arrived at ${targetDestName}`;
        if (tbtInstEl && lastTbtInst !== arrText) { tbtInstEl.textContent = arrText; lastTbtInst = arrText; }
        highlightActiveStep(routeSteps.length - 1);
        startArrivedCountdown();
        return;
    }

    tbtBannerEl.classList.remove('arrived');

    // Find next step where step.at > currentDist
    let nextIdx = routeSteps.findIndex(s => s.at > currentDist + 1);
    if (nextIdx === -1) nextIdx = routeSteps.length - 1;

    const nextStep = routeSteps[nextIdx];
    const remaining = Math.max(0, nextStep.at - currentDist);
    const rounded = Math.max(5, Math.round(remaining / 5) * 5);

    // Highlight active step in list
    const activeListIdx = nextIdx > 0 ? nextIdx - 1 : 0;
    if (activeListIdx !== lastActiveNavStepIdx) {
        lastActiveNavStepIdx = activeListIdx;
        highlightActiveStep(activeListIdx);
    }

    if (tbtIconEl && lastTbtIcon !== nextStep.icon) {
        tbtIconEl.innerHTML = nextStep.icon;
        lastTbtIcon = nextStep.icon;
    }

    const distText = (remaining <= 10) ? 'Now' : `In ${rounded} m`;
    if (tbtDistEl && lastTbtDist !== distText) {
        tbtDistEl.textContent = distText;
        lastTbtDist = distText;
    }

    if (tbtInstEl && lastTbtInst !== nextStep.text) {
        tbtInstEl.textContent = nextStep.text;
        lastTbtInst = nextStep.text;
    }

    if (isPhoneMode()) {
        updatePhoneLiveNavUI(currentDist, totalDist, nextStep, remaining, rounded);
    }
}

let activeFullRouteCoords = null;


export function toggleRouteStepsExpansion() {
    const container = document.getElementById('route-steps-container');
    const icon = document.getElementById('rst-icon');
    if (!container) return;
    container.classList.toggle('expanded');
    const isExpanded = container.classList.contains('expanded');
    if (icon) icon.textContent = isExpanded ? '▴' : '▾';
}

window.buildSteps = buildSteps;
window.renderStepsList = renderStepsList;
window.focusRouteStep = focusRouteStep;
window.highlightActiveStep = highlightActiveStep;
window.updateLiveNavigation = updateLiveNavigation;
window.toggleRouteStepsExpansion = toggleRouteStepsExpansion;

