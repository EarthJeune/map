// DA-LARES Wayfinding — Phone Navigation & Arrival Controller

import { BUILDING_DIRECTORY } from './data/buildings.js?v=72';
import { DEFAULT_MAP_VIEW } from './data/config.js';
import { getActiveStationDefaultView } from './data/stations.js';
import { state } from './data/state.js';
import { map } from './map-setup.js';
import { computeRouteFromKiosk, drawRoute, clearRoute } from './routing.js';
import { buildSteps } from './steps.js';
import { setRouteSpeed, clearArrivedCountdown } from './walker.js';
import { 
    getResponsiveMapPadding, 
    setPhoneSheetSnap, 
    setPhoneSheetView, 
    showMobileToast, 
    renderPhoneDirectory 
} from './phone-ui.js';
import { 
    stopPhoneLiveGPS, 
    dismissGPSPermissionCard, 
    startPhoneLiveGPS 
} from './gps.js';
import { stopOrbit } from './idle.js';

// --- Phone Active Route & Steps ---
export function updatePhoneRouteUI(coords) {
    const building = BUILDING_DIRECTORY.find(b => b.id === state.selectedBuildingId);
    const destName = building ? building.name : (state.currentRouteDestName || 'Destination');
    const totalDist = turf.length(turf.lineString(coords), { units: 'meters' });
    const roundedTotal = Math.round(totalDist);

    const destEl = document.getElementById('phone-route-dest-name');
    const remainEl = document.getElementById('phone-route-remain-tag');
    if (destEl) destEl.textContent = destName;
    if (remainEl) remainEl.textContent = `${roundedTotal} m remaining`;

    const walkingMinutes = Math.max(1, Math.round(roundedTotal / 72));
    const etaTimeEl = document.getElementById('phone-gps-eta-time');
    if (etaTimeEl) etaTimeEl.textContent = (roundedTotal < 40) ? '< 1 min' : `${walkingMinutes} min`;
    const etaDistEl = document.getElementById('phone-gps-eta-dist');
    if (etaDistEl) etaDistEl.textContent = `${roundedTotal} m remaining`;

    // Top HUD update & show
    const topHud = document.getElementById('phone-top-nav-hud');
    const ptnhIcon = document.getElementById('ptnh-maneuver-icon');
    const ptnhPrim = document.getElementById('ptnh-primary-step');
    const ptnhSec = document.getElementById('ptnh-secondary-step');
    const ptnhDist = document.getElementById('ptnh-dist-pill');

    if (state.currentRouteSteps && state.currentRouteSteps.length > 0) {
        if (ptnhPrim) ptnhPrim.textContent = state.currentRouteSteps[0].text;
        if (ptnhSec) ptnhSec.textContent = state.currentRouteSteps.length > 1 ? state.currentRouteSteps[1].text : `Proceed toward ${destName}`;
        if (ptnhIcon) ptnhIcon.innerHTML = state.currentRouteSteps[0].icon || '⬆️';
        if (ptnhDist) ptnhDist.textContent = `${roundedTotal} m`;
    } else {
        if (ptnhPrim) ptnhPrim.textContent = 'Follow the walkway';
        if (ptnhSec) ptnhSec.textContent = `Heading to ${destName}`;
        if (ptnhDist) ptnhDist.textContent = `${roundedTotal} m`;
    }

    if (topHud && (state.isMobileGPSActive || state.walkAnimFrame)) {
        topHud.classList.add('active');
    }

    renderPhoneStepsList(state.currentRouteSteps);
    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');
}

export function renderPhoneStepsList(steps) {
    const list = document.getElementById('phone-steps-list');
    if (!list || !steps) return;

    let html = '';
    steps.forEach((s, idx) => {
        const prevAt = idx > 0 ? steps[idx - 1].at : 0;
        const stepDist = Math.max(1, Math.round(s.at - prevAt));
        const distLabel = idx === 0 ? 'Start' : `${stepDist} m`;

        html += `
            <div class="phone-step-item" id="phone-step-${idx}" onclick="focusRouteStep(${idx})">
                <div class="psi-icon">${s.icon}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; color:#f8fafc;">${s.text}</div>
                    <div style="font-size:12px; color:#94a3b8; margin-top:2px;">${distLabel}</div>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

export function updatePhoneLiveNavUI(currentDist, totalDist, nextStep, remaining, rounded) {
    const remainTag = document.getElementById('phone-route-remain-tag');
    const remainingTotal = Math.max(0, Math.round(totalDist - currentDist));
    if (remainTag) remainTag.textContent = `${remainingTotal} m remaining`;

    const topHud = document.getElementById('phone-top-nav-hud');
    const ptnhIcon = document.getElementById('ptnh-maneuver-icon');
    const ptnhPrim = document.getElementById('ptnh-primary-step');
    const ptnhSec = document.getElementById('ptnh-secondary-step');
    const ptnhDist = document.getElementById('ptnh-dist-pill');

    if (topHud && (state.isMobileGPSActive || state.walkAnimFrame)) {
        topHud.classList.add('active');
    }

    if (nextStep) {
        if (ptnhIcon) ptnhIcon.innerHTML = nextStep.icon || '⬆️';
        if (ptnhDist) {
            if (remaining <= 10) ptnhDist.textContent = 'Now';
            else ptnhDist.textContent = `${rounded} m`;
        }
        if (ptnhPrim) {
            ptnhPrim.textContent = nextStep.text;
        }
        const nextNextIdx = state.currentRouteSteps ? state.currentRouteSteps.findIndex(s => s.at > nextStep.at + 1) : -1;
        if (ptnhSec) {
            if (nextNextIdx !== -1 && state.currentRouteSteps[nextNextIdx]) {
                ptnhSec.textContent = `Then: ${state.currentRouteSteps[nextNextIdx].text}`;
            } else {
                ptnhSec.textContent = `Approaching destination`;
            }
        }
    }

    // Highlight step in phone list
    if (state.currentRouteSteps) {
        const activeIdx = state.currentRouteSteps.findIndex(s => s.at > currentDist + 1);
        const stepIdx = activeIdx > 0 ? activeIdx - 1 : 0;
        document.querySelectorAll('.phone-step-item').forEach((el, i) => {
            el.classList.toggle('active', i === stepIdx);
        });
    }
}

export function startPhoneAnimatedRoute() {
    stopOrbit();
    stopPhoneLiveGPS(); // Stop any active live GPS
    dismissGPSPermissionCard(); // Never show permission card for animated route

    if (!state.selectedBuildingId) return;
    const building = BUILDING_DIRECTORY.find(b => b.id === state.selectedBuildingId);
    if (!building) return;

    state.activeRoute = building.id;
    const routeCoords = computeRouteFromKiosk(building.id);
    state.activeFullRouteCoords = routeCoords;
    state.activeRouteCoords = routeCoords;

    // Turn-by-turn steps
    state.currentRouteSteps = buildSteps(routeCoords, BUILDING_DIRECTORY, building.id);
    state.currentRouteDestName = building.name;

    // Mobile view: default to 1x speed as requested by user
    setRouteSpeed(1);

    // Ensure speed bar is visible
    const speedBar = document.getElementById('phone-speed-bar');
    if (speedBar) speedBar.style.display = 'flex';

    // Switch to route sheet view in peek mode
    updatePhoneRouteUI(routeCoords);
    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');

    // Fit whole route in camera view
    const routeLine = turf.lineString(routeCoords);
    const bbox = turf.bbox(routeLine);
    map.fitBounds(bbox, {
        padding: getResponsiveMapPadding(),
        maxZoom: 19.5,
        pitch: 45,
        bearing: -15,
        duration: 1100
    });

    // Start animated walker route
    drawRoute(routeCoords, { animated: true });
}

export function replayPhoneRoute() {
    clearArrivedCountdown();
    clearRoute();
    if (state.selectedBuildingId) {
        if (state.isMobileGPSActive) {
            startPhoneLiveGPS(state.selectedBuildingId);
        } else {
            startPhoneAnimatedRoute();
        }
    }
}

export function cancelPhoneRoute() {
    stopOrbit();
    stopPhoneLiveGPS();
    clearRoute();
    state.selectedBuildingId = null;
    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));
    setPhoneSheetView('dir');
    setPhoneSheetSnap('half');
    renderPhoneDirectory('');
    showMobileToast('Navigation cancelled', 2000);
}

// --- Centered Arrival Pop-up Modal Controller ---
export function showPhoneArrival(buildingOrId) {
    stopPhoneLiveGPS();
    if (state.routeAnimFrame) cancelAnimationFrame(state.routeAnimFrame);
    if (state.walkAnimFrame) cancelAnimationFrame(state.walkAnimFrame);
    state.activeFullRouteCoords = null;

    const topHud = document.getElementById('phone-top-nav-hud');
    if (topHud) topHud.classList.remove('active');

    let building = buildingOrId;
    if (typeof buildingOrId === 'string') {
        building = BUILDING_DIRECTORY.find(b => b.id === buildingOrId);
    }
    const name = building ? building.name : 'Destination';

    // Show Centered Pop-up Modal
    const modal = document.getElementById('phone-arrived-modal');
    const titleEl = document.getElementById('pam-title');
    const descEl = document.getElementById('pam-desc');
    if (titleEl) titleEl.textContent = `Arrived at ${name}!`;
    if (descEl) descEl.textContent = 'You have reached your destination.';
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }

    setPhoneSheetView('dir');
    setPhoneSheetSnap('peek');

    // Focus on destination building in 3D tilt
    if (building && building.coords) {
        map.easeTo({
            center: building.coords,
            zoom: 19.8,
            pitch: 52,
            bearing: -15,
            duration: 1200
        });
    }
}

export function closePhoneArrivalPopup() {
    const modal = document.getElementById('phone-arrived-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    state.selectedBuildingId = null;
    clearRoute();
    setPhoneSheetView('dir');
    setPhoneSheetSnap('peek');
    const defaultView = getActiveStationDefaultView();
    map.flyTo({
        center: defaultView.center,
        zoom: defaultView.zoom,
        pitch: defaultView.pitch,
        bearing: defaultView.bearing,
        duration: 1500
    });
}

export function replayFromArrivalPopup() {
    const modal = document.getElementById('phone-arrived-modal');
    if (modal) modal.classList.remove('active');
    clearArrivedCountdown();
    clearRoute();
    if (state.selectedBuildingId) {
        if (state.isMobileGPSActive) {
            startPhoneLiveGPS(state.selectedBuildingId);
        } else {
            startPhoneAnimatedRoute();
        }
    }
}

export function donePhoneArrival() {
    closePhoneArrivalPopup();
}

// Window reflections
window.updatePhoneRouteUI = updatePhoneRouteUI;
window.renderPhoneStepsList = renderPhoneStepsList;
window.updatePhoneLiveNavUI = updatePhoneLiveNavUI;
window.startPhoneAnimatedRoute = startPhoneAnimatedRoute;
window.replayPhoneRoute = replayPhoneRoute;
window.cancelPhoneRoute = cancelPhoneRoute;
window.showPhoneArrival = showPhoneArrival;
window.closePhoneArrivalPopup = closePhoneArrivalPopup;
window.replayFromArrivalPopup = replayFromArrivalPopup;
window.donePhoneArrival = donePhoneArrival;
