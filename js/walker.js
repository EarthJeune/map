// DA-LARES Walker & Route Animation Module
// Animated walking person marker, camera follow modes, speed control, and arrival countdown.

import { DEFAULT_MAP_VIEW, SAVED_MAIN_KIOSK_COORDS } from './data/config.js';
import { BUILDING_DIRECTORY } from './data/buildings.js';
import { state } from './data/state.js';
import { map } from './map-setup.js';
import { resetIdle, stopIdleRotation, stopOrbit, orbitBuilding } from './idle.js';
import { clearRoute, closeRouteAndReset } from './routing.js';
import { showBuildingPanel } from './building-panel.js';
import { showMobileToast, showPhoneBuildingDetails, getResponsiveMapPadding, isPhoneMode } from './phone-ui.js';

// ==========================================

function safeResetIdle() {
    if (typeof resetIdle === 'function') resetIdle();
    else if (typeof window.resetIdle === 'function') window.resetIdle();
}
function safeStopIdleRotation() {
    if (typeof stopIdleRotation === 'function') stopIdleRotation();
    else if (typeof window.stopIdleRotation === 'function') window.stopIdleRotation();
}
function safeStopOrbit() {
    if (typeof stopOrbit === 'function') stopOrbit();
    else if (typeof window.stopOrbit === 'function') window.stopOrbit();
}
function safeIsPhoneMode() {
    if (typeof isPhoneMode === 'function') return isPhoneMode();
    if (typeof window.isPhoneMode === 'function') return window.isPhoneMode();
    return window.innerWidth <= 768;
}
function safeIsNavigationActive() {
    if (typeof window.isNavigationActive === 'function') return window.isNavigationActive();
    return Boolean(state.walkAnimFrame || state.isMobileGPSActive);
}
function safeShowMobileToast(msg, dur) {
    if (typeof showMobileToast === 'function') showMobileToast(msg, dur);
    else if (typeof window.showMobileToast === 'function') window.showMobileToast(msg, dur);
}
function safeClearRoute() {
    if (typeof clearRoute === 'function') clearRoute();
    else if (typeof window.clearRoute === 'function') window.clearRoute();
}
function safeShowPhoneBuildingDetails(id) {
    if (typeof showPhoneBuildingDetails === 'function') showPhoneBuildingDetails(id);
    else if (typeof window.showPhoneBuildingDetails === 'function') window.showPhoneBuildingDetails(id);
}
function safeOrbitBuilding(coords) {
    if (typeof orbitBuilding === 'function') orbitBuilding(coords);
    else if (typeof window.orbitBuilding === 'function') window.orbitBuilding(coords);
}
function safeShowBuildingPanel(id) {
    if (typeof showBuildingPanel === 'function') showBuildingPanel(id);
    else if (typeof window.showBuildingPanel === 'function') window.showBuildingPanel(id);
}

export function navigateTo(buildingId) {
    state.isIntroAnimating = false;
    safeResetIdle();
    safeStopIdleRotation();
    safeStopOrbit();

    // Guard against accidental clicks while navigating on mobile
    if (safeIsPhoneMode() && safeIsNavigationActive()) {
        if (state.selectedBuildingId === buildingId) return;
        safeShowMobileToast(`🧭 Active route to ${state.currentRouteDestName || 'destination'} in progress. Tap 'Cancel' to choose another building.`, 3500);
        return;
    }

    safeClearRoute(); // Clear any existing route/green lines
    const building = BUILDING_DIRECTORY.find(b => b.id === buildingId);
    if (!building) return;

    // Highlight active item
    document.querySelectorAll('.dir-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`.dir-item[data-id="${buildingId}"]`);
    if (activeEl) activeEl.classList.add('active');

    // Highlight active phone item
    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));
    const activePhoneEl = document.querySelector(`.phone-dir-item[data-id="${buildingId}"]`);
    if (activePhoneEl) activePhoneEl.classList.add('active');

    // Highlight active map marker
    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));
    const activeMarker = document.querySelector(`.bldg-map-marker[data-id="${buildingId}"]`);
    if (activeMarker) activeMarker.classList.add('active');

    // Track selected building across state and window
    state.selectedBuildingId = buildingId;
    window.selectedBuildingId = buildingId;

    if (safeIsPhoneMode()) {
        safeShowPhoneBuildingDetails(buildingId);
    } else {
        // Zoom to building and orbit
        safeOrbitBuilding(building.coords);
        // Show building info panel
        safeShowBuildingPanel(buildingId);
    }
}

let walkerMarkerInstance = null;
let destinationMarkerInstance = null;
let walkAnimFrame = null;
let activeRouteCoords = null;
let currentWalkerCoord = null;
let routeCameraMode = 'follow';
let isTransitioningToFollow = false;
let transitionFollowTimer = null;
let routeSpeedMultiplier = 2;

export function setRouteSpeed(multiplier) {
    routeSpeedMultiplier = multiplier;
    state.routeSpeedMultiplier = multiplier;
    document.querySelectorAll('.speed-pill').forEach(btn => {
        const spd = parseInt(btn.dataset.speed || btn.getAttribute('data-speed'), 10);
        if (spd === multiplier) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Dynamically update stop-motion runner avatar animation speed (no badge on model!)
    const walker = state.walkerMarkerInstance || walkerMarkerInstance;
    if (walker) {
        const el = walker.getElement();
        if (el && !el.classList.contains('mode-idle') && !el.classList.contains('mode-celebrate')) {
            el.className = 'route-walker-avatar speed-' + multiplier + 'x';
        }
    }
}

export function setRouteCameraMode(mode) {
    state.isIntroAnimating = false;
    routeCameraMode = mode;
    state.routeCameraMode = mode;
    isTransitioningToFollow = false;
    state.isTransitioningToFollow = false;
    if (transitionFollowTimer) {
        clearTimeout(transitionFollowTimer);
        transitionFollowTimer = null;
    }

    document.querySelectorAll('.fcc-btn').forEach(b => b.classList.remove('active'));

    const fccBtn = document.getElementById('fcc-' + mode);
    if (fccBtn) fccBtn.classList.add('active');

    const activeCoords = state.activeRouteCoords || activeRouteCoords;
    if (!activeCoords || activeCoords.length < 2) return;
    const routeLine = turf.lineString(activeCoords);

    const responsivePadding = getResponsiveMapPadding();

    if (mode === 'overview') {
        map.stop();
        const bbox = turf.bbox(routeLine);
        map.fitBounds(bbox, {
            padding: responsivePadding,
            maxZoom: 19.5,
            pitch: 48,
            bearing: -20,
            duration: 1200
        });
    } else if (mode === 'topdown') {
        map.stop();
        const bbox = turf.bbox(routeLine);
        map.fitBounds(bbox, {
            padding: responsivePadding,
            maxZoom: 19.5,
            pitch: 0,
            bearing: 0,
            duration: 1000
        });
    } else if (mode === 'follow') {
        map.stop();
        isTransitioningToFollow = true;
        state.isTransitioningToFollow = true;
        const target = state.currentWalkerCoord || currentWalkerCoord || activeCoords[0];
        map.flyTo({
            center: target,
            zoom: 20.2,
            pitch: 68,
            bearing: -20,
            duration: 800,
            essential: true
        });
        transitionFollowTimer = setTimeout(() => {
            isTransitioningToFollow = false;
            state.isTransitioningToFollow = false;
        }, 850);
        map.once('moveend', () => {
            isTransitioningToFollow = false;
            state.isTransitioningToFollow = false;
            if (transitionFollowTimer) {
                clearTimeout(transitionFollowTimer);
                transitionFollowTimer = null;
            }
        });
    }
}

// Auto-dimming camera controls after 5 seconds of inactivity
let cameraControlsDimTimer = null;
export function resetCameraControlsTimer() {
    const fcc = document.getElementById('floating-camera-controls');
    if (!fcc) return;
    fcc.classList.remove('dimmed');
    if (cameraControlsDimTimer) {
        clearTimeout(cameraControlsDimTimer);
        cameraControlsDimTimer = null;
    }
    if (state.activeRoute && fcc.classList.contains('active')) {
        cameraControlsDimTimer = setTimeout(() => {
            if (state.activeRoute && fcc.classList.contains('active')) {
                fcc.classList.add('dimmed');
            }
        }, 5000);
    }
}
['mousemove', 'touchstart', 'click'].forEach(evt => {
    window.addEventListener(evt, resetCameraControlsTimer, { passive: true });
});

// Arrival countdown & state management
let arrivedCountdownTimer = null;
let arrivedCountdownSeconds = 30;

export function startArrivedCountdown() {
    clearArrivedCountdown();
    arrivedCountdownSeconds = 30;
    const card = document.getElementById('route-arrived-card');
    const countdownText = document.getElementById('arrived-countdown-text');
    const arrivedDesc = document.getElementById('arrived-card-desc');
    if (card) card.style.display = 'flex';
    const dName = state.currentRouteDestName || "your destination";
    if (arrivedDesc) arrivedDesc.textContent = `You have reached ${dName}.`;
    if (countdownText) countdownText.textContent = `Returning to overview in ${arrivedCountdownSeconds}s`;

    arrivedCountdownTimer = setInterval(() => {
        arrivedCountdownSeconds--;
        if (countdownText) {
            countdownText.textContent = `Returning to overview in ${arrivedCountdownSeconds}s`;
        }
        if (arrivedCountdownSeconds <= 0) {
            clearArrivedCountdown();
            returnToOverviewFromArrival();
        }
    }, 1000);
}

export function clearArrivedCountdown() {
    if (arrivedCountdownTimer) {
        clearInterval(arrivedCountdownTimer);
        arrivedCountdownTimer = null;
    }
    const card = document.getElementById('route-arrived-card');
    if (card) card.style.display = 'none';
}

export function returnToOverviewFromArrival() {
    closeRouteAndReset();
    map.flyTo({
        center: DEFAULT_MAP_VIEW.center,
        zoom: DEFAULT_MAP_VIEW.zoom,
        pitch: DEFAULT_MAP_VIEW.pitch,
        bearing: DEFAULT_MAP_VIEW.bearing,
        duration: 1600
    });
}

export function exitRouteMode() {
    closeRouteAndReset();
}

// User touch or interaction immediately pauses auto-return
['pointerdown', 'touchstart', 'keydown'].forEach(evt => {
    window.addEventListener(evt, () => {
        if (arrivedCountdownTimer) {
            clearArrivedCountdown();
            const countdownText = document.getElementById('arrived-countdown-text');
            if (countdownText) countdownText.textContent = 'Auto-return paused';
            const card = document.getElementById('route-arrived-card');
            if (card) {
                card.style.display = 'flex';
                setTimeout(() => { if (!arrivedCountdownTimer && card) card.style.display = 'none'; }, 2000);
            }
        }
    }, { passive: true });
});

// Label Decluttering during active route
export function declutterLabelsForRoute(coords, destId) {
    if (!coords || coords.length < 2) return;
    const routeLine = turf.lineString(coords);

    state.markers.forEach(m => {
        const el = m.getElement();
        if (!el || !el.classList.contains('bldg-map-marker')) return;
        const bId = el.dataset.id;
        const b = BUILDING_DIRECTORY.find(item => item.id === bId);
        if (!b) return;

        el.classList.remove('decluttered-dim', 'decluttered-hide', 'decluttered-highlight', 'decluttered-dest');

        // Destination building stays highlighted and always stacks above every other label
        if (b.id === destId) {
            el.classList.add('decluttered-highlight', 'decluttered-dest');
            return;
        }

        // Hide immediate neighbours whose label would sit on top of the destination label
        // (e.g. RAFIS shares a wall with MIS, so their labels overlap almost exactly)
        const destB = BUILDING_DIRECTORY.find(item => item.id === destId);
        if (destB && turf.distance(turf.point(b.coords), turf.point(destB.coords), { units: 'meters' }) < 12) {
            el.classList.add('decluttered-hide');
            return;
        }

        // Check collision with Kiosk marker (< 9 meters)
        const kioskDist = turf.distance(turf.point(b.coords), turf.point(state.KIOSK_COORDS || SAVED_MAIN_KIOSK_COORDS), { units: 'meters' });
        if (kioskDist < 9) {
            el.classList.add('decluttered-hide');
            return;
        }

        // Check if mentioned in turn steps
        const steps = state.currentRouteSteps;
        const isLandmark = steps && steps.some(s => s.landmark === b.name || (s.text && s.text.includes(b.name)));
        if (isLandmark) {
            el.classList.add('decluttered-highlight');
            return;
        }

        // Check distance to route line (<= 40 meters)
        const distToRoute = turf.pointToLineDistance(b.coords, routeLine, { units: 'meters' });
        if (distToRoute <= 40) {
            // Visible corridor context
        } else {
            el.classList.add('decluttered-dim');
        }
    });
}

export function restoreLabels() {
    state.markers.forEach(m => {
        const el = m.getElement();
        if (el && el.classList.contains('bldg-map-marker')) {
            el.classList.remove('decluttered-dim', 'decluttered-hide', 'decluttered-highlight', 'decluttered-dest');
        }
    });
}

// Allow manual free look during route without fighting the walker animation.
// We strictly check e.originalEvent so programmatic map.flyTo / easeTo / fitBounds NEVER trigger free mode!
export function initWalkerCameraListeners() {
    ['dragstart', 'rotatestart', 'pitchstart', 'zoomstart'].forEach(evt => {
        if (map && typeof map.on === 'function') {
            map.on(evt, (e) => {
                if (e && e.originalEvent && state.activeRoute && (state.routeCameraMode || 'follow') === 'follow' && !state.isTransitioningToFollow) {
                    setRouteCameraMode('free');
                }
            });
        }
    });
}
if (typeof window !== 'undefined') {
    window.initWalkerCameraListeners = initWalkerCameraListeners;
}

// ==========================================
window.navigateTo = navigateTo;
window.setRouteSpeed = setRouteSpeed;
window.setRouteCameraMode = setRouteCameraMode;
window.resetCameraControlsTimer = resetCameraControlsTimer;
window.startArrivedCountdown = startArrivedCountdown;
window.clearArrivedCountdown = clearArrivedCountdown;
window.returnToOverviewFromArrival = returnToOverviewFromArrival;
window.exitRouteMode = exitRouteMode;
window.declutterLabelsForRoute = declutterLabelsForRoute;
window.restoreLabels = restoreLabels;
