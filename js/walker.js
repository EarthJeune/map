// DA-LARES Walker & Route Animation Module
// Animated walking person marker, camera follow modes, speed control, and arrival countdown.

import { DEFAULT_MAP_VIEW, SAVED_MAIN_KIOSK_COORDS } from './data/config.js';
import { getActiveStationDefaultView } from './data/stations.js';
import { BUILDING_DIRECTORY } from './data/buildings.js?v=72';
import { state } from './data/state.js';
import { map } from './map-setup.js';
import { resetIdle, stopIdleRotation, stopOrbit, orbitBuilding } from './idle.js';
import { clearRoute, closeRouteAndReset } from './routing.js';
import { showMobileToast, showPhoneBuildingDetails, getResponsiveMapPadding, isPhoneMode } from './phone-ui.js';
import { resetOcclusion, updateOcclusion } from './occlusion.js?v=81';

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
function safeShowPhoneBuildingDetails(id, targetOffice = '') {
    if (typeof showPhoneBuildingDetails === 'function') showPhoneBuildingDetails(id, targetOffice);
    else if (typeof window.showPhoneBuildingDetails === 'function') window.showPhoneBuildingDetails(id, targetOffice);
}
function safeOrbitBuilding(coords) {
    if (typeof orbitBuilding === 'function') orbitBuilding(coords);
    else if (typeof window.orbitBuilding === 'function') window.orbitBuilding(coords);
}
function safeShowBuildingPanel(id, targetOffice = '') {
    if (typeof showBuildingPanel === 'function') showBuildingPanel(id, targetOffice);
    else if (typeof window.showBuildingPanel === 'function') window.showBuildingPanel(id, targetOffice);
}

export function navigateTo(buildingId, targetOffice = '') {
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

    // Track active searched office in state
    state.activeSearchedOffice = targetOffice || '';

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
        safeShowPhoneBuildingDetails(buildingId, targetOffice);
    } else {
        // Zoom to building and orbit
        safeOrbitBuilding(building.coords);
        // Show building info panel
        safeShowBuildingPanel(buildingId, targetOffice);
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

const PERSPECTIVE_CONFIGS = {
    follow: { zoom: 20.2, pitch: 68, bearing: -20 },
    overview: { zoom: 19.5, pitch: 48, bearing: -20 },
    topdown: { zoom: 19.5, pitch: 0, bearing: 0 }
};

export function updateCameraControlsUI() {
    const fccFollow = document.getElementById('fcc-follow');
    const fccOverview = document.getElementById('fcc-overview');
    const fccTopdown = document.getElementById('fcc-topdown');

    // 1. Lock/Unlock Button state (tracks state.isFollowing)
    if (fccFollow) {
        const isLocked = !!state.isFollowing;
        fccFollow.classList.toggle('active', isLocked);
        fccFollow.innerHTML = isLocked ? '🔒 Locked' : '🔓 Unlocked';
        fccFollow.title = isLocked
            ? 'Camera locked to walker (Click to unlock free-form view)'
            : 'Camera unlocked (free form - click to lock onto walker)';
    }

    // 2. Perspective buttons (Side View & Top View)
    const persp = state.routeCameraPerspective || 'follow';
    if (fccOverview) {
        fccOverview.classList.toggle('active', persp === 'overview');
    }
    if (fccTopdown) {
        fccTopdown.classList.toggle('active', persp === 'topdown');
    }
}

export function setRouteCameraMode(mode, force = false) {
    state.isIntroAnimating = false;
    if (transitionFollowTimer) {
        clearTimeout(transitionFollowTimer);
        transitionFollowTimer = null;
    }

    // A. Lock / Unlock toggle (Follow button clicked)
    if (mode === 'follow' || mode === 'lock' || mode === 'toggle-lock') {
        if (force) {
            state.isFollowing = true;
            state.routeCameraPerspective = 'follow';
        } else {
            // Toggling Locked / Unlocked
            state.isFollowing = !state.isFollowing;
            if (!state.isFollowing) {
                state.cameraTransition = null;
                state.isTransitioningToFollow = false;
                isTransitioningToFollow = false;
            }
        }
    } else {
        // B. Perspective switches: 'overview' (Side View) or 'topdown' (Top View)
        if (!force && state.routeCameraPerspective === mode) {
            // Clicking already active perspective toggles back to standard 3D follow perspective
            state.routeCameraPerspective = 'follow';
        } else {
            state.routeCameraPerspective = mode;
        }
        // As requested: switching perspective guarantees camera is LOCKED and follow remains highlighted!
        state.isFollowing = true;
    }

    state.routeCameraMode = state.routeCameraPerspective;
    routeCameraMode = state.routeCameraPerspective;

    updateCameraControlsUI();

    transitionToPerspective(state.routeCameraPerspective);
}

export function resetCameraModeToDefault() {
    state.isFollowing = true;
    state.routeCameraPerspective = 'follow';
    state.routeCameraMode = 'follow';
    routeCameraMode = 'follow';
    updateCameraControlsUI();
}

function transitionToPerspective(mode) {
    const config = PERSPECTIVE_CONFIGS[mode] || PERSPECTIVE_CONFIGS.follow;
    const activeCoords = state.activeRouteCoords || activeRouteCoords;
    const target = state.currentWalkerCoord || currentWalkerCoord || (activeCoords ? activeCoords[0] : null);

    if (!map) return;

    // CASE A: Follow is ON -> Camera stays locked onto walker
    if (state.isFollowing) {
        if (!target) return;
        const mapCenter = map.getCenter();
        let distToWalker = 0;
        try {
            if (typeof turf !== 'undefined' && turf.distance) {
                distToWalker = turf.distance([mapCenter.lng, mapCenter.lat], target, { units: 'meters' });
            }
        } catch (e) { }

        const isActivelyWalking = !!state.walkAnimFrame;

        // If walker is moving AND camera is already near walker (<= 35m):
        // Continuously lock onto moving walker while animating pitch/bearing/zoom
        if (isActivelyWalking && distToWalker <= 35) {
            let diff = (config.bearing - map.getBearing()) % 360;
            if (diff > 180) diff -= 360;
            if (diff < -180) diff += 360;

            state.cameraTransition = {
                startTime: performance.now(),
                duration: 700,
                startPitch: map.getPitch(),
                targetPitch: config.pitch,
                startBearing: map.getBearing(),
                bearingDiff: diff,
                startZoom: map.getZoom(),
                targetZoom: config.zoom
            };
            state.isTransitioningToFollow = true;
            isTransitioningToFollow = true;
        } else {
            // Walker is stationary or camera was far away: fly smoothly to walker
            state.cameraTransition = null;
            state.isTransitioningToFollow = true;
            isTransitioningToFollow = true;
            map.stop();
            map.flyTo({
                center: target,
                pitch: config.pitch,
                bearing: config.bearing,
                zoom: config.zoom,
                duration: distToWalker > 35 ? 850 : 700,
                essential: true
            });
            map.once('moveend', () => {
                state.isTransitioningToFollow = false;
                isTransitioningToFollow = false;
            });
            transitionFollowTimer = setTimeout(() => {
                state.isTransitioningToFollow = false;
                isTransitioningToFollow = false;
            }, 900);
        }
    } else {
        // CASE B: Follow is OFF (Free View)
        // Smoothly adjust perspective angle (pitch, bearing, zoom) at the current viewpoint
        // WITHOUT locking or chasing the walker!
        state.cameraTransition = null;
        map.stop();
        map.easeTo({
            pitch: config.pitch,
            bearing: config.bearing,
            zoom: config.zoom,
            duration: 650,
            essential: true
        });
    }
}

// Auto-dimming camera controls after 5 seconds of inactivity
let cameraControlsDimTimer = null;
export function resetCameraControlsTimer() {
    const fcc = document.getElementById('floating-camera-controls');
    const fsc = document.getElementById('floating-speed-controls');
    if (!fcc) return;
    fcc.classList.remove('dimmed');
    if (fsc) fsc.classList.remove('dimmed');
    if (cameraControlsDimTimer) {
        clearTimeout(cameraControlsDimTimer);
        cameraControlsDimTimer = null;
    }
    if (state.activeRoute && fcc.classList.contains('active')) {
        cameraControlsDimTimer = setTimeout(() => {
            if (state.activeRoute && fcc.classList.contains('active')) {
                fcc.classList.add('dimmed');
                if (fsc) fsc.classList.add('dimmed');
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

    // Dedicated Kiosk Arrival Action Bar
    const kaaBar = document.getElementById('kiosk-arrival-action-bar');
    const kaaName = document.getElementById('kaa-dest-name');
    const kaaCountdown = document.getElementById('kaa-countdown-text');
    const fsc = document.getElementById('floating-speed-controls');
    if (fsc) fsc.classList.remove('active');
    const fcc = document.getElementById('floating-camera-controls');
    if (fcc) fcc.classList.remove('active');

    if (kaaBar) {
        if (kaaName) kaaName.textContent = dName;
        if (kaaCountdown) kaaCountdown.textContent = `Returning to campus overview in ${arrivedCountdownSeconds}s`;
        kaaBar.classList.add('active');
    }

    arrivedCountdownTimer = setInterval(() => {
        arrivedCountdownSeconds--;
        if (countdownText) {
            countdownText.textContent = `Returning to overview in ${arrivedCountdownSeconds}s`;
        }
        if (kaaCountdown) {
            kaaCountdown.textContent = `Returning to campus overview in ${arrivedCountdownSeconds}s`;
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

    const kaaBar = document.getElementById('kiosk-arrival-action-bar');
    if (kaaBar) kaaBar.classList.remove('active');
}

export function viewArrivedBuildingDetails() {
    clearArrivedCountdown();
    const destId = state.currentRouteDestId || state.selectedBuildingId || window.selectedBuildingId;
    if (destId) {
        exitRouteMode();
        setTimeout(() => {
            if (typeof window.showBuildingPanel === 'function') {
                window.showBuildingPanel(destId);
            }
            const b = BUILDING_DIRECTORY.find(item => item.id === destId);
            if (b && typeof window.orbitBuilding === 'function') {
                window.orbitBuilding(b.coords);
            }
        }, 120);
    } else {
        exitRouteMode();
    }
}

export function returnToOverviewFromArrival() {
    resetOcclusion();
    closeRouteAndReset();
    const defaultView = getActiveStationDefaultView();
    map.flyTo({
        center: defaultView.center,
        zoom: defaultView.zoom,
        pitch: defaultView.pitch,
        bearing: defaultView.bearing,
        duration: 1600
    });
}

export function exitRouteMode() {
    closeRouteAndReset();
}

// User touch or interaction immediately pauses auto-return
['pointerdown', 'touchstart', 'keydown'].forEach(evt => {
    window.addEventListener(evt, (e) => {
        if (arrivedCountdownTimer) {
            // If interacting directly with arrival buttons, pause timer without hiding the bar
            if (e.target && e.target.closest && e.target.closest('.kiosk-arrival-action-bar')) {
                clearInterval(arrivedCountdownTimer);
                arrivedCountdownTimer = null;
                const kaaCountdown = document.getElementById('kaa-countdown-text');
                if (kaaCountdown) kaaCountdown.textContent = 'Auto-return paused';
                return;
            }
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
                if (e && e.originalEvent && state.activeRoute && state.isFollowing) {
                    state.isFollowing = false;
                    state.cameraTransition = null;
                    state.isTransitioningToFollow = false;
                    isTransitioningToFollow = false;
                    updateCameraControlsUI();
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
window.updateCameraControlsUI = updateCameraControlsUI;
window.resetCameraControlsTimer = resetCameraControlsTimer;
window.startArrivedCountdown = startArrivedCountdown;
window.clearArrivedCountdown = clearArrivedCountdown;
window.viewArrivedBuildingDetails = viewArrivedBuildingDetails;
window.returnToOverviewFromArrival = returnToOverviewFromArrival;
window.exitRouteMode = exitRouteMode;
window.resetCameraModeToDefault = resetCameraModeToDefault;
window.declutterLabelsForRoute = declutterLabelsForRoute;
window.restoreLabels = restoreLabels;
