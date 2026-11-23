// DA-LARES Wayfinding — Phone Navigation & Arrival Controller

import { BUILDING_DIRECTORY, getBuildingById } from './data/buildings.js';
import { lucideIcon } from './data/icons.js';
import { DEFAULT_MAP_VIEW } from './data/config.js';
import { getActiveStationDefaultView } from './data/stations.js';
import { state } from './data/state.js';
import { map } from './map-setup.js';
import { computeRouteFromKiosk, drawRoute, clearRoute } from './routing.js';
import { buildSteps } from './steps.js';
import { setRouteSpeed, clearArrivedCountdown, updateCameraControlsUI } from './walker.js';
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
import { withCooldown } from './ui-guard.js';

// --- Phone Active Route & Steps ---
export function updatePhoneRouteUI(coords) {
    const building = getBuildingById(state.selectedBuildingId) || BUILDING_DIRECTORY.find(b => b.id === state.selectedBuildingId);
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
        if (ptnhIcon) ptnhIcon.innerHTML = state.currentRouteSteps[0].icon || lucideIcon('arrow-up', 20);
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
        if (ptnhIcon) ptnhIcon.innerHTML = nextStep.icon || lucideIcon('arrow-up', 20);
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
    return withCooldown('phone:route-start', _startPhoneAnimatedRouteImpl, 320).result;
}

function _startPhoneAnimatedRouteImpl() {
    state.lastNavType = 'sim';
    state.lastArrivalWasGps = false;
    stopOrbit();
    stopPhoneLiveGPS(); // Stop any active live GPS
    dismissGPSPermissionCard(); // Never show permission card for animated route

    if (!state.selectedBuildingId) return;
    const building = getBuildingById(state.selectedBuildingId) || BUILDING_DIRECTORY.find(b => b.id === state.selectedBuildingId);
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

    // Show camera view controls above peek sheet
    const fcc = document.getElementById('floating-camera-controls');
    if (fcc) {
        fcc.classList.add('active');
        fcc.classList.remove('dimmed', 'sheet-expanded-hidden', 'sheet-full-hidden');
        if (typeof updateCameraControlsUI === 'function') updateCameraControlsUI();
    }

    // Switch to route sheet view in peek mode
    updatePhoneRouteUI(routeCoords);
    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');

    // Fit whole route in camera view
    const routeLine = turf.lineString(routeCoords);
    const bbox = turf.bbox(routeLine);
    try { map.stop(); } catch (_) { }
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
    return withCooldown('phone:route-replay', _replayPhoneRouteImpl, 350).result;
}

function _replayPhoneRouteImpl() {
    clearArrivedCountdown();
    clearRoute();
    if (state.selectedBuildingId) {
        if (state.isMobileGPSActive) {
            startPhoneLiveGPS(state.selectedBuildingId);
        } else {
            _startPhoneAnimatedRouteImpl();
        }
    }
}

export function cancelPhoneRoute() {
    return withCooldown('phone:route-cancel', _cancelPhoneRouteImpl, 280).result;
}

function _cancelPhoneRouteImpl() {
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
export function showPhoneArrival(buildingOrId, source = null) {
    const isGps = (source === 'gps') || Boolean(state.isMobileGPSActive) || (state.lastNavType === 'gps');
    state.lastNavType = null;
    state.lastArrivalWasGps = isGps;

    stopPhoneLiveGPS();
    if (state.routeAnimFrame) cancelAnimationFrame(state.routeAnimFrame);
    if (state.walkAnimFrame) cancelAnimationFrame(state.walkAnimFrame);
    state.activeFullRouteCoords = null;

    const topHud = document.getElementById('phone-top-nav-hud');
    if (topHud) topHud.classList.remove('active');
    const fcc = document.getElementById('floating-camera-controls');
    if (fcc) fcc.classList.remove('active', 'dimmed');

    let building = buildingOrId;
    if (typeof buildingOrId === 'string') {
        building = getBuildingById(buildingOrId) || BUILDING_DIRECTORY.find(b => b.id === buildingOrId);
    }
    const name = building ? building.name : 'Destination';

    // Show Centered Pop-up Modal
    const modal = document.getElementById('phone-arrived-modal');
    const titleEl = document.getElementById('pam-title');
    const descEl = document.getElementById('pam-desc');
    const repeatBtn = modal ? (document.getElementById('pam-repeat-btn') || modal.querySelector('.pam-btn-repeat')) : null;
    const actionsEl = modal ? (document.getElementById('pam-actions') || modal.querySelector('.pam-actions')) : null;

    if (titleEl) titleEl.textContent = `Arrived at ${name}!`;
    if (descEl) {
        descEl.textContent = isGps
            ? 'You have reached your destination via live GPS guidance.'
            : 'You have reached your destination.';
    }

    // Strictly suppress Repeat button during Live GPS navigation
    if (repeatBtn) {
        repeatBtn.style.display = isGps ? 'none' : 'inline-flex';
    }
    if (actionsEl) {
        actionsEl.classList.toggle('is-gps-mode', isGps);
    }
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
        const actionsEl = modal.querySelector('.pam-actions');
        if (actionsEl) actionsEl.classList.remove('is-gps-mode');
        const repeatBtn = document.getElementById('pam-repeat-btn') || modal.querySelector('.pam-btn-repeat');
        if (repeatBtn) repeatBtn.style.display = '';
    }
    state.lastArrivalWasGps = false;
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
    return withCooldown('phone:arrival-replay', _replayFromArrivalPopupImpl, 350).result;
}

function _replayFromArrivalPopupImpl() {
    const modal = document.getElementById('phone-arrived-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        const actionsEl = modal.querySelector('.pam-actions');
        if (actionsEl) actionsEl.classList.remove('is-gps-mode');
        const repeatBtn = document.getElementById('pam-repeat-btn') || modal.querySelector('.pam-btn-repeat');
        if (repeatBtn) repeatBtn.style.display = '';
    }
    clearArrivedCountdown();
    clearRoute();

    // Guard: strictly suppress repeat when arrival was from Live GPS
    if (state.lastArrivalWasGps) {
        console.warn('[Phone Arrival] Repeat route suppressed because last navigation was Live GPS.');
        state.lastArrivalWasGps = false;
        return;
    }

    if (state.selectedBuildingId) {
        if (state.isMobileGPSActive) {
            startPhoneLiveGPS(state.selectedBuildingId);
        } else {
            _startPhoneAnimatedRouteImpl();
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
