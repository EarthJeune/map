// DA-LARES Walker & Route Animation Module
// Animated walking person marker, camera follow modes, speed control, and arrival countdown.

import { DEFAULT_MAP_VIEW } from './data/config.js?v=5';
import { BUILDING_DIRECTORY } from './data/buildings.js?v=5';
import { state } from './data/state.js?v=5';
import { map } from './map-setup.js?v=5';

// ==========================================


function safeResetIdle() {
    if (typeof window.resetIdle === 'function') window.safeResetIdle();
    else if (typeof resetIdle === 'function') resetIdle();
}
function safeStopIdleRotation() {
    if (typeof window.stopIdleRotation === 'function') window.safeStopIdleRotation();
    else if (typeof stopIdleRotation === 'function') stopIdleRotation();
}
function safeStopOrbit() {
    if (typeof window.stopOrbit === 'function') window.safeStopOrbit();
    else if (typeof stopOrbit === 'function') stopOrbit();
}
function safeIsPhoneMode() {
    if (typeof window.isPhoneMode === 'function') return window.isPhoneMode();
    return window.innerWidth <= 768;
}
function safeIsNavigationActive() {
    if (typeof window.isNavigationActive === 'function') return window.isNavigationActive();
    return Boolean(state.walkAnimFrame || state.isMobileGPSActive);
}
function safeShowMobileToast(msg, dur) {
    if (typeof window.showMobileToast === 'function') window.safeShowMobileToast(msg, dur);
}
function safeClearRoute() {
    if (typeof window.clearRoute === 'function') window.safeClearRoute();
    else if (typeof clearRoute === 'function') clearRoute();
}
function safeShowPhoneBuildingDetails(id) {
    if (typeof window.showPhoneBuildingDetails === 'function') window.showPhoneBuildingDetails(id);
}
function safeOrbitBuilding(coords) {
    if (typeof window.orbitBuilding === 'function') window.orbitBuilding(coords);
    else if (typeof orbitBuilding === 'function') orbitBuilding(coords);
}
function safeShowBuildingPanel(id) {
    if (typeof window.showBuildingPanel === 'function') window.showBuildingPanel(id);
    else if (typeof showBuildingPanel === 'function') showBuildingPanel(id);
}

export function navigateTo(buildingId) {
    isIntroAnimating = false;
    resetIdle();
    stopIdleRotation();
    stopOrbit();

    // Guard against accidental clicks while navigating on mobile
    if (safeIsPhoneMode() && safeIsNavigationActive()) {
        if (selectedBuildingId === buildingId) return;
        showMobileToast(`🧭 Active route to ${currentRouteDestName || 'destination'} in progress. Tap 'Cancel' to choose another building.`, 3500);
        return;
    }

    clearRoute(); // Clear any existing route/green lines
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

    // Track selected building
    selectedBuildingId = buildingId;

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
    document.querySelectorAll('.speed-pill').forEach(btn => {
        const spd = parseInt(btn.dataset.speed || btn.getAttribute('data-speed'), 10);
        if (spd === multiplier) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Dynamically update stop-motion runner avatar animation speed (no badge on model!)
    if (walkerMarkerInstance) {
        const el = walkerMarkerInstance.getElement();
        if (el && !el.classList.contains('mode-idle') && !el.classList.contains('mode-celebrate')) {
            el.className = 'route-walker-avatar speed-' + multiplier + 'x';
        }
    }
}

export function setRouteCameraMode(mode) {
    isIntroAnimating = false;
    routeCameraMode = mode;
    isTransitioningToFollow = false;
    if (transitionFollowTimer) {
        clearTimeout(transitionFollowTimer);
        transitionFollowTimer = null;
    }

    document.querySelectorAll('.fcc-btn').forEach(b => b.classList.remove('active'));

    const fccBtn = document.getElementById('fcc-' + mode);
    if (fccBtn) fccBtn.classList.add('active');

    if (!activeRouteCoords || activeRouteCoords.length < 2) return;
    const routeLine = turf.lineString(activeRouteCoords);

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
        const target = currentWalkerCoord || activeRouteCoords[0];
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
        }, 850);
        map.once('moveend', () => {
            isTransitioningToFollow = false;
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
    if (activeRoute && fcc.classList.contains('active')) {
        cameraControlsDimTimer = setTimeout(() => {
            if (activeRoute && fcc.classList.contains('active')) {
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
    if (arrivedDesc) arrivedDesc.textContent = `You have reached ${currentRouteDestName}.`;
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

    markers.forEach(m => {
        const el = m.getElement();
        if (!el || !el.classList.contains('bldg-map-marker')) return;
        const bId = el.dataset.id;
        const b = BUILDING_DIRECTORY.find(item => item.id === bId);
        if (!b) return;

        el.classList.remove('decluttered-dim', 'decluttered-hide', 'decluttered-highlight');

        // Destination building stays highlighted
        if (b.id === destId) {
            el.classList.add('decluttered-highlight');
            return;
        }

        // Check collision with Kiosk marker (< 9 meters)
        const kioskDist = turf.distance(turf.point(b.coords), turf.point(KIOSK_COORDS), { units: 'meters' });
        if (kioskDist < 9) {
            el.classList.add('decluttered-hide');
            return;
        }

        // Check if mentioned in turn steps
        const isLandmark = currentRouteSteps && currentRouteSteps.some(s => s.landmark === b.name || (s.text && s.text.includes(b.name)));
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
    markers.forEach(m => {
        const el = m.getElement();
        if (el && el.classList.contains('bldg-map-marker')) {
            el.classList.remove('decluttered-dim', 'decluttered-hide', 'decluttered-highlight');
        }
    });
}

// Allow manual free look during route without fighting the walker animation.
// We strictly check e.originalEvent so programmatic map.flyTo / easeTo / fitBounds NEVER trigger free mode!
['dragstart', 'rotatestart', 'pitchstart', 'zoomstart'].forEach(evt => {
    map.on(evt, (e) => {
        if (e && e.originalEvent && activeRoute && routeCameraMode === 'follow' && !isTransitioningToFollow) {
            setRouteCameraMode('free');
        }
    });
});

// ==========================================
window.navigateTo = navigateTo;


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

