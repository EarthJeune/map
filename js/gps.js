// DA-LARES Wayfinding — Live Mobile GPS Engine & Sensor Fusion Optimization Module
// High-precision road snapping, Kalman-style jitter filtering, haptics, and compass sync

import { BUILDING_DIRECTORY, getBuildingById } from './data/buildings.js';
import { DA_LARES_OUTER_PERIMETER, QARES_MASK, RARES_MASK } from './data/geo.js';
import { lucideIcon } from './data/icons.js';
import { state } from './data/state.js';
import { map, stopIntroAnimation } from './map-setup.js';
import { stopOrbit } from './idle.js';
import {
    computeRouteFromKiosk,
    drawRoute,
    clearRoute,
    findShortestPath
} from './routing.js';
import { buildSteps, updateLiveNavigation } from './steps.js';
import {
    showMobileToast,
    getResponsiveMapPadding,
    setPhoneSheetView,
    setPhoneSheetSnap
} from './phone-ui.js';
import {
    updatePhoneRouteUI,
    showPhoneArrival,
    startPhoneAnimatedRoute
} from './phone-nav.js';
import { updateOcclusion, resetOcclusion } from './occlusion.js';
import { isPhoneMode, isKioskMode } from './mode.js';
import { withCooldown } from './ui-guard.js';

// ============================================================
// SENSOR FUSION & JITTER FILTER ENGINE
// ============================================================

class GPSFilter {
    constructor() {
        this.lastRawCoord = null;
        this.lastFilteredCoord = null;
        this.lastUpdateTime = 0;
        this.lastAccuracy = null;
        this.currentSpeedMps = 0;
        this.isStationary = true;
    }

    reset() {
        this.lastRawCoord = null;
        this.lastFilteredCoord = null;
        this.lastUpdateTime = 0;
        this.lastAccuracy = null;
        this.currentSpeedMps = 0;
        this.isStationary = true;
    }

    filter(rawLng, rawLat, accuracy, timestamp) {
        const now = timestamp || Date.now();
        const rawPt = [rawLng, rawLat];
        const safeAccuracy = Math.max(4, accuracy || 15);

        if (!this.lastFilteredCoord) {
            this.lastRawCoord = rawPt;
            this.lastFilteredCoord = rawPt;
            this.lastUpdateTime = now;
            this.lastAccuracy = safeAccuracy;
            this.currentSpeedMps = 0;
            this.isStationary = true;
            return { coord: rawPt, speed: 0, isStationary: true };
        }

        // Ignore coarse WiFi/cell fallback fixes when we already have a tight satellite lock
        if (this.lastAccuracy !== null && this.lastAccuracy <= 20 && safeAccuracy > 45) {
            return { coord: this.lastFilteredCoord, speed: this.currentSpeedMps, isStationary: this.isStationary };
        }

        const dtSec = Math.max(0.2, (now - this.lastUpdateTime) / 1000);
        this.lastUpdateTime = now;

        const moveDist = turf.distance(
            turf.point(this.lastFilteredCoord),
            turf.point(rawPt),
            { units: 'meters' }
        );

        this.currentSpeedMps = moveDist / dtSec;

        // Snap immediately when a tight satellite fix replaces an earlier coarse fix
        if (safeAccuracy <= 15 && this.lastAccuracy !== null && this.lastAccuracy > 30) {
            this.lastFilteredCoord = rawPt;
            this.lastRawCoord = rawPt;
            this.lastAccuracy = safeAccuracy;
            this.isStationary = false;
            return { coord: this.lastFilteredCoord, speed: this.currentSpeedMps, isStationary: false };
        }

        // Reject GPS teleport spikes (> 15 m/s when accuracy is loose)
        if (this.currentSpeedMps > 6.5 && safeAccuracy > 15) {
            console.warn('[GPS Filter] Suppressed multipath GPS jump:', Math.round(moveDist), 'm');
            return { coord: this.lastFilteredCoord, speed: this.currentSpeedMps, isStationary: this.isStationary };
        }

        // Stationary Deadband: suppress jitter while user is standing still
        if (moveDist < 1.2 && (this.currentSpeedMps < 0.45 || safeAccuracy > 25)) {
            this.isStationary = true;
            const alpha = 0.12;
            const lng = this.lastFilteredCoord[0] + (rawLng - this.lastFilteredCoord[0]) * alpha;
            const lat = this.lastFilteredCoord[1] + (rawLat - this.lastFilteredCoord[1]) * alpha;
            this.lastFilteredCoord = [lng, lat];
            this.lastAccuracy = safeAccuracy;
            return { coord: this.lastFilteredCoord, speed: 0, isStationary: true };
        }

        this.isStationary = false;

        // Dynamic Confidence Weighting based on satellite accuracy
        const alpha = Math.min(0.92, Math.max(0.35, 14 / safeAccuracy));

        const lng = this.lastFilteredCoord[0] + (rawLng - this.lastFilteredCoord[0]) * alpha;
        const lat = this.lastFilteredCoord[1] + (rawLat - this.lastFilteredCoord[1]) * alpha;
        this.lastFilteredCoord = [lng, lat];
        this.lastRawCoord = rawPt;
        this.lastAccuracy = safeAccuracy;

        return {
            coord: this.lastFilteredCoord,
            speed: this.currentSpeedMps,
            isStationary: false
        };
    }
}

class HeadingFilter {
    constructor() {
        this.currentHeading = null;
        this.targetHeading = null;
    }

    reset() {
        this.currentHeading = null;
        this.targetHeading = null;
    }

    setTarget(heading) {
        if (heading === null || isNaN(heading)) return;
        this.targetHeading = (heading + 360) % 360;
        if (this.currentHeading === null) {
            this.currentHeading = this.targetHeading;
        }
    }

    step(dtSec) {
        if (this.currentHeading === null || this.targetHeading === null) return this.currentHeading;

        let diff = this.targetHeading - this.currentHeading;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;

        const factor = Math.min(1.0, dtSec * 8.5);
        this.currentHeading = (this.currentHeading + diff * factor + 360) % 360;
        return this.currentHeading;
    }
}

const gpsFilter = new GPSFilter();
const headingFilter = new HeadingFilter();

let gpsNavigationStartTime = 0;
let userDismissedGPSPrompt = false;
let lastCameraFollowLngLat = null;
let lastTrimmedTime = 0;
let lastAccuracyCircleUpdate = 0;

let markerCurrentLngLat = null;
let markerTargetLngLat = null;
let markerLerpStartTime = 0;
let markerLerpDuration = 450;
let markerAnimFrame = null;
let lastTrimmedCoord = null;

let rawCompassHeading = null;
let headingAnimFrame = null;
let lastHeadingFrameTime = 0;

let activeTouchCount = 0;
const CAMPUS_GATE_BUFFER_METERS = 35;
let isOffCampusFallbackActive = false;
let userDismissedOffCampusPrompt = false;

export function evaluateCampusPerimeter(coord, toleranceMeters = CAMPUS_GATE_BUFFER_METERS) {
    if (!Array.isArray(coord) || coord.length < 2 || isNaN(coord[0]) || isNaN(coord[1])) {
        return { inside: false, distanceOutsideMeters: Infinity };
    }
    try {
        const pt = turf.point(coord);
        const stationId = state.currentStationId || 'lares';
        const ring = stationId === 'qares'
            ? (QARES_MASK?.features?.[0]?.geometry?.coordinates?.[1] || DA_LARES_OUTER_PERIMETER)
            : stationId === 'rares'
                ? (RARES_MASK?.features?.[0]?.geometry?.coordinates?.[1] || DA_LARES_OUTER_PERIMETER)
                : DA_LARES_OUTER_PERIMETER;

        const poly = turf.polygon([ring]);
        if (turf.booleanPointInPolygon(pt, poly)) {
            return { inside: true, distanceOutsideMeters: 0 };
        }
        const boundaryLine = turf.lineString(ring);
        const distMeters = turf.pointToLineDistance(pt, boundaryLine, { units: 'meters' });
        return {
            inside: distMeters <= toleranceMeters,
            distanceOutsideMeters: distMeters
        };
    } catch (e) {
        const fallbackCenter = turf.point(state.KIOSK_COORDS || [121.1665, 13.9582]);
        const d = turf.distance(turf.point(coord), fallbackCenter, { units: 'meters' });
        return { inside: d <= 450, distanceOutsideMeters: d };
    }
}

// Haptic feedback helpers
export function triggerHapticArrival() {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate([180, 80, 180]); } catch (e) { }
    }
}

export function triggerHapticRecalculate() {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(60); } catch (e) { }
    }
}

// ============================================================
// SCREEN WAKE LOCK API (Keeps screen awake during navigation)
// ============================================================
let screenWakeLock = null;

export async function acquireWakeLock() {
    try {
        if ('wakeLock' in navigator && navigator.wakeLock) {
            screenWakeLock = await navigator.wakeLock.request('screen');
            screenWakeLock.addEventListener('release', () => {
                screenWakeLock = null;
            });
        }
    } catch (err) {
        // Non-blocking warning (requires user gesture or secure context on some OS)
    }
}

export async function releaseWakeLock() {
    try {
        if (screenWakeLock) {
            await screenWakeLock.release();
            screenWakeLock = null;
        }
    } catch (err) { }
}

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && state.isMobileGPSActive) {
            acquireWakeLock();
        }
    });
}

// ============================================================
// DIAGNOSTIC HUD OVERLAY (?debug=1)
// ============================================================
const isDebugMode = (typeof window !== 'undefined') && new URLSearchParams(window.location.search).get('debug') === '1';
let debugHudEl = null;
let lastFpsTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
let frameCount = 0;
let currentFps = 60;

export function updateDebugHUD(data = {}) {
    if (!isDebugMode || typeof document === 'undefined') return;
    if (!debugHudEl) {
        debugHudEl = document.createElement('div');
        debugHudEl.id = 'gps-debug-hud';
        debugHudEl.className = 'gps-debug-hud';
        debugHudEl.innerHTML = `
            <div class="debug-title">⚙ GPS ENGINE DIAGNOSTICS</div>
            <div class="debug-row"><span>Fix Age:</span> <strong id="dbg-fix-age">--</strong></div>
            <div class="debug-row"><span>Accuracy:</span> <strong id="dbg-acc">--</strong></div>
            <div class="debug-row"><span>Speed:</span> <strong id="dbg-speed">--</strong></div>
            <div class="debug-row"><span>Heading:</span> <strong id="dbg-heading">--</strong></div>
            <div class="debug-row"><span>FPS:</span> <strong id="dbg-fps">60</strong></div>
        `;
        document.body.appendChild(debugHudEl);
    }
    const ageEl = document.getElementById('dbg-fix-age');
    const accEl = document.getElementById('dbg-acc');
    const spdEl = document.getElementById('dbg-speed');
    const hdgEl = document.getElementById('dbg-heading');
    if (ageEl && data.fixAge !== undefined) ageEl.textContent = `${Math.round(data.fixAge)} ms`;
    if (accEl && data.accuracy !== undefined) accEl.textContent = `±${data.accuracy.toFixed(1)} m`;
    if (spdEl && data.speed !== undefined) spdEl.textContent = `${(data.speed * 3.6).toFixed(1)} km/h`;
    if (hdgEl && data.heading !== undefined) hdgEl.textContent = `${Math.round(data.heading)}°`;
}

export function tickDebugFPS(now) {
    if (!isDebugMode) return;
    frameCount++;
    if (now - lastFpsTime >= 1000) {
        currentFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
        frameCount = 0;
        lastFpsTime = now;
        const fpsEl = document.getElementById('dbg-fps');
        if (fpsEl) fpsEl.textContent = `${currentFps} fps`;
    }
}

export function createUserGPSMarkerElement() {
    const el = document.createElement('div');
    el.className = 'user-gps-marker';
    el.innerHTML = `
        <div class="user-gps-heading" id="user-gps-heading">
            <svg class="user-gps-fan-svg" viewBox="0 0 120 120" width="120" height="120">
                <defs>
                    <radialGradient id="userFanGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.85" />
                        <stop offset="30%" stop-color="#0284c7" stop-opacity="0.55" />
                        <stop offset="70%" stop-color="#0284c7" stop-opacity="0.18" />
                        <stop offset="100%" stop-color="#0284c7" stop-opacity="0" />
                    </radialGradient>
                </defs>
                <path d="M 60 60 L 29.5 7.2 A 61 61 0 0 1 90.5 7.2 Z" fill="url(#userFanGradient)" />
            </svg>
        </div>
        <div class="user-gps-pulse"></div>
        <div class="user-gps-dot"></div>
    `;
    return el;
}

export function bindCompassListeners() {
    if (state.compassListenersBound) return;
    state.compassListenersBound = true;
    window.addEventListener('deviceorientation', handleDeviceHeading, true);
    window.addEventListener('deviceorientationabsolute', handleDeviceHeading, true);
}

export function requestDeviceOrientationPermission(callback) {
    if (state.compassPermissionGranted) {
        bindCompassListeners();
        if (callback) callback(true);
        return;
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permState => {
                if (permState === 'granted') {
                    state.compassPermissionGranted = true;
                    bindCompassListeners();
                    if (callback) callback(true);
                } else {
                    console.warn('Compass permission state:', permState);
                    if (callback) callback(false);
                }
            })
            .catch(err => {
                console.warn('Compass permission error:', err);
                if (callback) callback(false);
            });
    } else if (window.DeviceOrientationEvent) {
        state.compassPermissionGranted = true;
        bindCompassListeners();
        if (callback) callback(true);
    } else {
        if (callback) callback(false);
    }
}

// Note: Compass permission is triggered only on explicit user request (e.g. starting live navigation),
// preventing double permission dialogs upon tapping Continue on the welcome modal.

// Map-Matching: Smoothly snap noisy phone GPS fixes onto the active route or campus road network
// so walkers on the road don't appear floating on adjacent grass/buildings due to 4-10m GPS drift.
function snapCoordToRoadOrRoute(rawCoord, accuracy = 10) {
    if (!rawCoord || rawCoord.length < 2 || typeof turf === 'undefined') {
        return { coord: rawCoord, snapped: false, source: 'raw', dist: Infinity };
    }
    try {
        const pt = turf.point(rawCoord);

        // Priority 1: Active navigation route corridor
        if (state.isMobileGPSActive && Array.isArray(state.activeFullRouteCoords) && state.activeFullRouteCoords.length >= 2) {
            const routeLine = turf.lineString(state.activeFullRouteCoords);
            const nearest = turf.nearestPointOnLine(routeLine, pt);
            const dist = turf.distance(pt, nearest, { units: 'meters' });
            const routeSnapRadius = Math.min(14, Math.max(8, (accuracy || 10) * 0.85));
            if (dist <= routeSnapRadius) {
                return { coord: nearest.geometry.coordinates, snapped: true, source: 'route', dist };
            }
        }

        // Priority 2: Nearest campus road LineString in ROAD_NETWORK
        const roadNet = (typeof window !== 'undefined' && window.ROAD_NETWORK && Array.isArray(window.ROAD_NETWORK.features))
            ? window.ROAD_NETWORK
            : null;
        if (roadNet) {
            const roadSnapRadius = Math.min(12, Math.max(7, (accuracy || 10) * 0.75));
            let bestCoord = null;
            let bestDist = Infinity;
            for (let i = 0; i < roadNet.features.length; i++) {
                const f = roadNet.features[i];
                if (!f || !f.geometry || f.geometry.type !== 'LineString' || !f.geometry.coordinates || f.geometry.coordinates.length < 2) continue;
                const nearest = turf.nearestPointOnLine(f, pt);
                const d = turf.distance(pt, nearest, { units: 'meters' });
                if (d < bestDist) {
                    bestDist = d;
                    bestCoord = nearest.geometry.coordinates;
                }
            }
            if (bestCoord && bestDist <= roadSnapRadius) {
                return { coord: bestCoord, snapped: true, source: 'road', dist: bestDist };
            }
        }
    } catch (_) { }
    return { coord: rawCoord, snapped: false, source: 'raw', dist: Infinity };
}

export function updateUserGPSMarker(lng, lat) {
    const snapRes = snapCoordToRoadOrRoute([lng, lat], 10);
    const displayCoord = snapRes.coord || [lng, lat];
    if (!state.userGPSMarker) {
        const el = createUserGPSMarkerElement();
        state.userGPSMarker = new mapboxgl.Marker({
            element: el,
            anchor: 'center',
            rotationAlignment: 'map',
            pitchAlignment: 'map'
        }).setLngLat(displayCoord).addTo(map);
    } else {
        if (typeof state.userGPSMarker.setPitchAlignment === 'function') {
            state.userGPSMarker.setPitchAlignment('map');
            state.userGPSMarker.setRotationAlignment('map');
        }
        state.userGPSMarker.setLngLat(displayCoord);
    }
}

export function requestUserInitialLocation() {
    // Strictly ONLY for mobile smartphones — NEVER on PC, Laptop, or Kiosk displays
    const isMobileUA = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
    const hasPhoneParam = (new URLSearchParams(window.location.search).get('mode') || '').toLowerCase() === 'phone';
    if (isKioskMode() || (!isMobileUA && !hasPhoneParam)) {
        return;
    }

    if (!navigator.geolocation) {
        showMobileToast('📍 GPS not supported on this browser.', 3000);
        return;
    }

    let initialFound = false;
    const onInitialPos = (pos) => {
        if (initialFound) return;
        initialFound = true;
        const userLng = pos.coords.longitude;
        const userLat = pos.coords.latitude;
        const userCoord = [userLng, userLat];
        state.lastKnownGPSCoords = userCoord;
        const perimStatus = evaluateCampusPerimeter(userCoord);

        if (perimStatus.inside) {
            updateUserGPSMarker(userLng, userLat);
            showMobileToast('📍 Location found! Tap any building to navigate.', 3000);
            // Only re-center on user coordinates if NO building is actively selected!
            // When arriving via QR scan for a specific building, leave the camera orbiting the destination building!
            if (!state.selectedBuildingId) {
                map.easeTo({
                    center: userCoord,
                    zoom: 18.8,
                    pitch: 0,
                    duration: 900
                });
            }
        } else {
            const distLabel = perimStatus.distanceOutsideMeters >= 1000
                ? `${(perimStatus.distanceOutsideMeters / 1000).toFixed(1)} km`
                : `${Math.round(perimStatus.distanceOutsideMeters)} m`;
            showMobileToast(`📍 Outside campus boundary (${distLabel} away). Showing campus preview.`, 3500);
        }
    };

    navigator.geolocation.getCurrentPosition(
        onInitialPos,
        (err) => {
            if (initialFound) return;
            console.warn('Initial GPS check:', err);
            // Silent fallback to standard accuracy if needed, without popup notifications
            navigator.geolocation.getCurrentPosition(
                onInitialPos,
                (err2) => {
                    console.warn('Initial GPS fallback failed:', err2);
                },
                { enableHighAccuracy: false, maximumAge: 30000, timeout: 6000 }
            );
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}

export function startPhoneLiveGPS(buildingId) {
    withCooldown('phone:gps-start', () => {
        if (!buildingId) buildingId = state.selectedBuildingId;
        if (!buildingId) return;
        state.selectedBuildingId = buildingId;
        state.lastNavType = 'gps';
        state.lastArrivalWasGps = false;
        gpsNavigationStartTime = Date.now();
        gpsFilter.reset();
        headingFilter.reset();
        lastCameraFollowLngLat = null;

    // 1. Unconditionally stop any building orbit and intro animations!
    stopOrbit();
    if (typeof stopIntroAnimation === 'function') stopIntroAnimation();
    if (typeof window.stopOrbit === 'function') window.stopOrbit();
    try { map.stop(); } catch (e) { }

    // Stop animated walker simulation if running
    if (state.walkAnimFrame) cancelAnimationFrame(state.walkAnimFrame);
    if (state.walkerMarkerInstance) {
        state.walkerMarkerInstance.remove();
        state.walkerMarkerInstance = null;
    }

    state.isMobileGPSActive = true;
    state.isUserFollowingGPS = true;
    state.offRouteCounter = 0;
    state.arrivalConfirmCounter = 0;
    state.lastRecalcTime = 0;
    state.minDestDistance = null;
    isOffCampusFallbackActive = false;
    userDismissedOffCampusPrompt = false;
    dismissOffCampusPromptCard(false);
    document.body.classList.add('phone-gps-active');
    updateRecenterStateUI(true);

    const building = getBuildingById(buildingId) || BUILDING_DIRECTORY.find(b => b.id === buildingId);
    const bldgName = building ? building.name : 'Destination';
    state.currentRouteDestName = bldgName;

    // Immediate visual feedback in route view
    const destName = document.getElementById('phone-route-dest-name');
    const remainTag = document.getElementById('phone-route-remain-tag');
    if (destName) destName.textContent = bldgName;
    if (remainTag) remainTag.textContent = 'Acquiring GPS…';

    const topHud = document.getElementById('phone-top-nav-hud');
    const ptnhIcon = document.getElementById('ptnh-maneuver-icon');
    const ptnhPrim = document.getElementById('ptnh-primary-step');
    const ptnhSec = document.getElementById('ptnh-secondary-step');
    const ptnhDist = document.getElementById('ptnh-dist-pill');
    if (ptnhPrim) ptnhPrim.textContent = 'Locating your GPS position…';
    if (ptnhSec) ptnhSec.textContent = `Connecting to phone satellite for ${bldgName}`;
    if (ptnhDist) ptnhDist.textContent = 'GPS';
    if (ptnhIcon) ptnhIcon.innerHTML = lucideIcon('map-pin', 20);
    if (topHud) topHud.classList.add('active');

    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');

    state.activeFullRouteCoords = null;

    // 2. Immediately fly camera straight to blue ping only if user is inside campus boundary!
    const pingCoord = state.lastKnownGPSCoords || (state.userGPSMarker ? [state.userGPSMarker.getLngLat().lng, state.userGPSMarker.getLngLat().lat] : null);

    if (pingCoord && evaluateCampusPerimeter(pingCoord).inside) {
        map.flyTo({
            center: pingCoord,
            zoom: 19.3,
            pitch: 45,
            duration: 900,
            essential: true
        });
        computeAndDrawRouteFromGPS(pingCoord, buildingId);
    }

    if (!navigator.geolocation) {
        showMobileToast('GPS not supported on this browser. Showing route from Kiosk.', 4000);
        startPhoneAnimatedRoute();
        return;
    }

    showMobileToast('📍 Guiding live from your blue ping…', 3000);

    if (state.gpsWatchId) {
        navigator.geolocation.clearWatch(state.gpsWatchId);
        state.gpsWatchId = null;
    }

    acquireWakeLock();
    setupGPSLayers();

    // Request Compass (DeviceOrientation) synchronously on user tap first,
    // then immediately request GPS Location once answered so iOS Safari never drops either dialog.
    requestDeviceOrientationPermission(() => {
        startContinuousTracking(buildingId);

        navigator.geolocation.getCurrentPosition(
            (pos) => handleGPSPositionUpdate(pos, buildingId),
            (err) => {
                console.warn('Initial GPS query note:', err);
                if (err && err.code === 1) {
                    showGPSPermissionCard(buildingId);
                }
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
        );
    });
    }, 450);
}

export function startContinuousTracking(buildingId) {
    if (state.gpsWatchId) return;
    state.gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => handleGPSPositionUpdate(pos, buildingId),
        (err) => {
            console.warn('Continuous GPS tracking warning:', err);
            if (err && err.code === 1) {
                handleGPSError(err, buildingId);
            }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}

// 60fps Marker Gliding with dynamic duration based on fix interval
export function animateMarkerTo(targetLngLat, duration = 450) {
    if (!state.userGPSMarker) return;
    if (!markerCurrentLngLat) {
        markerCurrentLngLat = targetLngLat;
        state.userGPSMarker.setLngLat(targetLngLat);
        return;
    }
    const startLngLat = [...markerCurrentLngLat];
    markerTargetLngLat = targetLngLat;
    markerLerpStartTime = performance.now();
    markerLerpDuration = duration;

    if (markerAnimFrame) cancelAnimationFrame(markerAnimFrame);

    function step(now) {
        if (isDebugMode) {
            tickDebugFPS(now);
        }

        const elapsed = now - markerLerpStartTime;
        const progress = Math.min(1, elapsed / markerLerpDuration);
        const ease = 1 - Math.pow(1 - progress, 2);

        const currentLng = startLngLat[0] + (markerTargetLngLat[0] - startLngLat[0]) * ease;
        const currentLat = startLngLat[1] + (markerTargetLngLat[1] - startLngLat[1]) * ease;
        markerCurrentLngLat = [currentLng, currentLat];

        if (state.userGPSMarker) {
            state.userGPSMarker.setLngLat(markerCurrentLngLat);
        }

        if (progress < 1) {
            markerAnimFrame = requestAnimationFrame(step);
        }
    }
    markerAnimFrame = requestAnimationFrame(step);
}

export function updateSmoothCameraFollow(targetLngLat, distFromCompoundMeters) {
    if (!state.isUserFollowingGPS) return;
    if (!lastCameraFollowLngLat) {
        lastCameraFollowLngLat = targetLngLat;
        map.easeTo({
            center: targetLngLat,
            zoom: 19.3,
            pitch: 45,
            duration: 800
        });
        return;
    }
    const moveD = turf.distance(turf.point(lastCameraFollowLngLat), turf.point(targetLngLat), { units: 'meters' });
    if (moveD >= 1.5) {
        lastCameraFollowLngLat = targetLngLat;
        map.panTo(targetLngLat, {
            duration: 500,
            easing: t => t
        });
        if (state.activeRoute) {
            updateOcclusion(targetLngLat, state.selectedBuildingId);
        }
    }
}

export function stopPhoneLiveGPS() {
    releaseWakeLock();
    resetOcclusion();
    if (state.gpsWatchId) {
        navigator.geolocation.clearWatch(state.gpsWatchId);
        state.gpsWatchId = null;
    }
    if (markerAnimFrame) {
        cancelAnimationFrame(markerAnimFrame);
        markerAnimFrame = null;
    }
    markerCurrentLngLat = null;
    markerTargetLngLat = null;
    lastCameraFollowLngLat = null;
    lastTrimmedCoord = null;
    isOffCampusFallbackActive = false;
    dismissOffCampusPromptCard(false);

    state.isMobileGPSActive = false;
    state.isUserFollowingGPS = false;
    state.offRouteCounter = 0;
    state.arrivalConfirmCounter = 0;
    state.minDestDistance = null;
    document.body.classList.remove('phone-gps-active');
    if (state.autoRecenterTimer) {
        clearTimeout(state.autoRecenterTimer);
        state.autoRecenterTimer = null;
    }
    updateRecenterStateUI(false);
    document.getElementById('mobile-recenter-btn')?.classList.remove('active');
    if (state.userGPSMarker) {
        state.userGPSMarker.remove();
        state.userGPSMarker = null;
    }
    try {
        if (map.getSource('gps-accuracy-source')) {
            map.getSource('gps-accuracy-source').setData({ type: 'FeatureCollection', features: [] });
        }
        if (map.getSource('gps-connector-source')) {
            map.getSource('gps-connector-source').setData({ type: 'FeatureCollection', features: [] });
        }
    } catch (e) { }
    stopHeadingSync();
    rawCompassHeading = null;
}

export const stopMobileGPSNavigation = stopPhoneLiveGPS;
export const startMobileGPSNavigation = startPhoneLiveGPS;

export function setupGPSLayers() {
    if (!map.getSource('gps-accuracy-source')) {
        map.addSource('gps-accuracy-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        map.addLayer({
            id: 'gps-accuracy-layer',
            type: 'fill',
            source: 'gps-accuracy-source',
            paint: {
                'fill-color': '#38bdf8',
                'fill-opacity': 0.15
            }
        });
        map.addLayer({
            id: 'gps-accuracy-stroke',
            type: 'line',
            source: 'gps-accuracy-source',
            paint: {
                'line-color': '#38bdf8',
                'line-width': 1.5,
                'line-opacity': 0.4
            }
        });
    }

    if (!map.getSource('gps-connector-source')) {
        map.addSource('gps-connector-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        map.addLayer({
            id: 'gps-connector-layer',
            type: 'line',
            source: 'gps-connector-source',
            paint: {
                'line-color': '#38bdf8',
                'line-width': 2.5,
                'line-dasharray': [2, 2],
                'line-opacity': 0.8
            }
        });
    }
}

export function applyUserHeading(targetHeading) {
    if (targetHeading === null || targetHeading === undefined || isNaN(targetHeading)) return;
    rawCompassHeading = targetHeading;
    headingFilter.setTarget(targetHeading);
    startHeadingSync();
}

export function startHeadingSync() {
    if (headingAnimFrame) return;
    lastHeadingFrameTime = performance.now();
    let lastVisualRotation = null;
    let settledFrames = 0;

    function syncLoop(now) {
        const dtSec = Math.max(0.001, (now - lastHeadingFrameTime) / 1000);
        lastHeadingFrameTime = now;

        const smoothed = headingFilter.step(dtSec);
        if (smoothed !== null) {
            const isMapRotated = state.userGPSMarker && typeof state.userGPSMarker.getRotationAlignment === 'function' && state.userGPSMarker.getRotationAlignment() === 'map';
            const mapBearing = map ? (map.getBearing() || 0) : 0;
            const visualRotation = isMapRotated ? (smoothed % 360) : ((smoothed - mapBearing + 360) % 360);
            const roundedRot = Math.round(visualRotation);

            const headingEl = document.getElementById('user-gps-heading');
            if (!headingEl) {
                headingAnimFrame = null;
                return;
            }
            if (roundedRot !== lastVisualRotation) {
                lastVisualRotation = roundedRot;
                settledFrames = 0;
                headingEl.style.display = 'flex';
                headingEl.style.transform = `rotate(${roundedRot}deg)`;
            } else {
                settledFrames++;
                if (settledFrames >= 6) {
                    headingAnimFrame = null;
                    return;
                }
            }
        } else {
            headingAnimFrame = null;
            return;
        }
        headingAnimFrame = requestAnimationFrame(syncLoop);
    }
    headingAnimFrame = requestAnimationFrame(syncLoop);
}

export function stopHeadingSync() {
    if (headingAnimFrame) {
        cancelAnimationFrame(headingAnimFrame);
        headingAnimFrame = null;
    }
}

export function handleDeviceHeading(e) {
    let heading = null;

    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
        heading = e.webkitCompassHeading;
    } else if (typeof e.alpha === 'number' && !isNaN(e.alpha)) {
        heading = (360 - e.alpha) % 360;
    }

    if (heading !== null && !isNaN(heading)) {
        const screenAngle = (typeof window.orientation === 'number')
            ? window.orientation
            : (screen.orientation ? screen.orientation.angle : 0) || 0;
        const correctedHeading = (heading + screenAngle + 360) % 360;

        // If user is walking at reasonable speed, motion course takes priority over compass
        if (gpsFilter.isStationary || gpsFilter.currentSpeedMps < 0.8) {
            applyUserHeading(correctedHeading);
        }
    }
}

function cleanRouteCoords(coords) {
    if (!coords || coords.length < 2) return coords;
    const cleaned = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
        const prev = cleaned[cleaned.length - 1];
        const curr = coords[i];
        if (Math.abs(prev[0] - curr[0]) > 0.000001 || Math.abs(prev[1] - curr[1]) > 0.000001) {
            cleaned.push(curr);
        }
    }
    return cleaned.length >= 2 ? cleaned : coords;
}

export function computeAndDrawRouteFromGPS(startCoord, buildingId) {
    const building = getBuildingById(buildingId) || BUILDING_DIRECTORY.find(b => b.id === buildingId);
    const roadGraph = state.roadGraph || (typeof window !== 'undefined' ? window.roadGraph : null);
    const buildingEntrances = (typeof window !== 'undefined' && window.BUILDING_ENTRANCES) ? window.BUILDING_ENTRANCES : {};

    if (!building || !roadGraph || roadGraph.size === 0) return;

    const ENTRANCE_OVERRIDES = {
        'mis_building': 'mis_rafis_building',
        'rafis_building': 'mis_rafis_building',
        'fod_building': 'lares_building',
        'bac_building': 'tanco_hall_building',
        'pmed_building': 'tanco_hall_building',
        'fmr': 'multi_purpose_administrative_building',
        'mis_data_center': 'multi_purpose_administrative_building',
        'vacant': 'multi_purpose_administrative_building'
    };

    let targetBuildingId = building.id;
    if (ENTRANCE_OVERRIDES[targetBuildingId]) {
        targetBuildingId = ENTRANCE_OVERRIDES[targetBuildingId];
    }

    const entrances = buildingEntrances[targetBuildingId] || [building.coords];
    let bestPath = null;
    let minDistance = Infinity;

    entrances.forEach(ent => {
        const p = findShortestPath(startCoord, ent, roadGraph);
        if (p && p.length > 0) {
            const full = [startCoord, ...p, ent];
            const d = turf.length(turf.lineString(full), { units: 'meters' });
            if (d < minDistance) {
                minDistance = d;
                bestPath = full;
            }
        }
    });

    const routeCoords = cleanRouteCoords(bestPath || [startCoord, building.coords]);
    state.activeFullRouteCoords = routeCoords;
    state.activeRouteCoords = routeCoords;
    lastTrimmedCoord = null;
    lastTrimmedTime = 0;
    try {
        state.minDestDistance = turf.length(turf.lineString(routeCoords), { units: 'meters' });
    } catch (e) {
        state.minDestDistance = null;
    }

    state.currentRouteSteps = buildSteps(routeCoords, BUILDING_DIRECTORY, building.id);
    state.currentRouteDestName = building.name;

    updatePhoneRouteUI(routeCoords);
    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');

    drawRoute(routeCoords, { animated: false });

    stopOrbit();
    try { map.stop(); } catch (e) { }

    // Focus camera directly on the blue ping (startCoord)
    map.flyTo({
        center: startCoord,
        zoom: 19.3,
        pitch: 45,
        duration: 900,
        essential: true
    });
}

export function handleGPSPositionUpdate(pos, targetBuildingId) {
    if (!targetBuildingId) targetBuildingId = state.selectedBuildingId;
    const rawLng = pos.coords.longitude;
    const rawLat = pos.coords.latitude;
    const accuracy = Math.max(4, pos.coords.accuracy || 10);
    const nowTime = Date.now();
    const fixTimestamp = pos.timestamp || nowTime;

    dismissGPSPermissionCard(false);

    // 1. Pass raw GPS through Kalman-style Jitter Filter
    const filterResult = gpsFilter.filter(rawLng, rawLat, accuracy, fixTimestamp);
    const [filteredLng, filteredLat] = filterResult.coord;
    const userCoord = [filteredLng, filteredLat];
    const userPt = turf.point(userCoord);

    const compoundCenter = turf.point([121.1665, 13.9582]);
    const distFromCompoundMeters = turf.distance(userPt, compoundCenter, { units: 'meters' });
    const perimStatus = evaluateCampusPerimeter(userCoord);

    if (isDebugMode) {
        updateDebugHUD({
            fixAge: (pos.timestamp ? Math.max(0, nowTime - pos.timestamp) : 0),
            accuracy: accuracy,
            speed: filterResult.speed,
            heading: (typeof pos.coords.heading === 'number' && !isNaN(pos.coords.heading) && pos.coords.heading >= 0)
                ? pos.coords.heading
                : (rawCompassHeading || 0)
        });
    }

    // Off-campus perimeter check: prevent floating marker / camera pan into black mask outside DA-LARES
    if (!perimStatus.inside) {
        state.lastKnownGPSCoords = userCoord;
        if (state.userGPSMarker) {
            state.userGPSMarker.remove();
            state.userGPSMarker = null;
            markerCurrentLngLat = null;
        }
        if (!isOffCampusFallbackActive || !state.activeFullRouteCoords || !map.getSource('route-source')) {
            isOffCampusFallbackActive = true;
            const distLabel = perimStatus.distanceOutsideMeters >= 1000
                ? `${(perimStatus.distanceOutsideMeters / 1000).toFixed(1)} km`
                : `${Math.round(perimStatus.distanceOutsideMeters)} m`;
            const stationLabel = state.currentStationId === 'qares'
                ? 'DA-QARES'
                : state.currentStationId === 'rares'
                    ? 'DA-RARES'
                    : 'DA-LARES';
            showMobileToast(`📍 Outside ${stationLabel} (${distLabel} away). Showing campus route from Kiosk — live GPS activates when you enter.`, 4500);
            const kCoords = computeRouteFromKiosk(targetBuildingId);
            state.activeFullRouteCoords = kCoords;
            state.activeRouteCoords = kCoords;
            state.currentRouteSteps = buildSteps(kCoords, BUILDING_DIRECTORY, targetBuildingId);
            const targetBldg = getBuildingById(targetBuildingId) || BUILDING_DIRECTORY.find(b => b.id === targetBuildingId);
            state.currentRouteDestName = targetBldg ? targetBldg.name : 'Destination';
            updatePhoneRouteUI(kCoords);
            drawRoute(kCoords, { animated: false });
            if (!userDismissedOffCampusPrompt) {
                showOffCampusPromptCard(userCoord, perimStatus.distanceOutsideMeters, targetBuildingId);
            }
            if (kCoords && kCoords.length >= 2) {
                try {
                    const bbox = turf.bbox(turf.lineString(kCoords));
                    map.fitBounds(bbox, {
                        padding: getResponsiveMapPadding(),
                        pitch: 45,
                        duration: 900,
                        maxZoom: 18.8
                    });
                } catch (e) { }
            }
        }
        return;
    }

    const justEnteredCampus = isOffCampusFallbackActive;
    if (justEnteredCampus) {
        isOffCampusFallbackActive = false;
        lastCameraFollowLngLat = null;
        dismissOffCampusPromptCard(false);
    }

    // 2. Sensor Fusion: Course Over Ground (movement bearing) when walking actively
    if (typeof pos.coords.heading === 'number' && !isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
        applyUserHeading(pos.coords.heading);
    } else if (state.lastKnownGPSCoords && filterResult.speed >= 0.8) {
        try {
            const movedDist = turf.distance(turf.point(state.lastKnownGPSCoords), userPt, { units: 'meters' });
            if (movedDist >= 1.2) {
                const bearing = turf.bearing(turf.point(state.lastKnownGPSCoords), userPt);
                applyUserHeading((bearing + 360) % 360);
            }
        } catch (e) { }
    }

    state.lastKnownGPSCoords = userCoord;

    // 3. Smooth 60fps Marker Gliding with Map-Matching (snaps onto active route / campus road within drift radius)
    const snapRes = snapCoordToRoadOrRoute(userCoord, accuracy);
    const displayCoord = snapRes.coord || userCoord;
    const lerpDuration = filterResult.isStationary ? 300 : Math.min(600, Math.max(350, 1000 / (filterResult.speed + 1)));
    if (!state.userGPSMarker) {
        const el = createUserGPSMarkerElement();
        state.userGPSMarker = new mapboxgl.Marker({
            element: el,
            anchor: 'center',
            rotationAlignment: 'map',
            pitchAlignment: 'map'
        }).setLngLat(displayCoord).addTo(map);
        markerCurrentLngLat = displayCoord;
    } else {
        if (typeof state.userGPSMarker.setPitchAlignment === 'function') {
            state.userGPSMarker.setPitchAlignment('map');
            state.userGPSMarker.setRotationAlignment('map');
        }
        animateMarkerTo(displayCoord, lerpDuration);
    }

    // 4. Clean GPS accuracy layers (omits oversized polygon radar circle)
    if (nowTime - lastAccuracyCircleUpdate > 1000) {
        lastAccuracyCircleUpdate = nowTime;
        try {
            if (map.getSource('gps-accuracy-source')) {
                map.getSource('gps-accuracy-source').setData({ type: 'FeatureCollection', features: [] });
            }
            if (map.getSource('gps-connector-source')) {
                map.getSource('gps-connector-source').setData({ type: 'FeatureCollection', features: [] });
            }
        } catch (err) { }
    }

    // 5. Route Generation / Reset from User GPS
    const isRouteFromKiosk = state.activeFullRouteCoords && state.activeFullRouteCoords.length > 0 &&
        (Math.abs(state.activeFullRouteCoords[0][0] - state.KIOSK_COORDS[0]) < 0.00005 && Math.abs(state.activeFullRouteCoords[0][1] - state.KIOSK_COORDS[1]) < 0.00005);

    if (justEnteredCampus || !state.activeFullRouteCoords || !map.getSource('route-source') || (state.isMobileGPSActive && isRouteFromKiosk)) {
        showMobileToast(justEnteredCampus
            ? '📍 Entered campus! Live GPS route started from your location.'
            : '📍 Connected to phone GPS. Route started from your location.', 3000);
        computeAndDrawRouteFromGPS(userCoord, targetBuildingId);
        return;
    }

    // 6. Throttled Dynamic Route Trimming & Off-Route Detection
    let shouldTrimRoute = false;
    if (!lastTrimmedCoord) {
        shouldTrimRoute = true;
        lastTrimmedCoord = [filteredLng, filteredLat];
        lastTrimmedTime = nowTime;
    } else {
        const moveDist = turf.distance(turf.point(lastTrimmedCoord), userPt, { units: 'meters' });
        if (moveDist >= 1.4 || (nowTime - lastTrimmedTime >= 1200)) {
            shouldTrimRoute = true;
            lastTrimmedCoord = [filteredLng, filteredLat];
            lastTrimmedTime = nowTime;
        }
    }

    if (shouldTrimRoute) {
        try {
            const fullLine = turf.lineString(state.activeFullRouteCoords);
            const userSnappedOnRoute = turf.nearestPointOnLine(fullLine, userPt);
            const startPt = turf.point(state.activeFullRouteCoords[0]);
            const destPt = turf.point(state.activeFullRouteCoords[state.activeFullRouteCoords.length - 1]);
            const targetBldg = getBuildingById(targetBuildingId) || BUILDING_DIRECTORY.find(b => b.id === targetBuildingId);
            const distToEntrance = turf.distance(userPt, destPt, { units: 'meters' });
            const distToBldgCentroid = targetBldg && targetBldg.coords ? turf.distance(userPt, turf.point(targetBldg.coords), { units: 'meters' }) : distToEntrance;
            const actualDistToDest = Math.min(distToEntrance, distToBldgCentroid);

            // Track minimum distance achieved to destination for reverse/walking-away detection
            if (state.minDestDistance === undefined || state.minDestDistance === null || actualDistToDest < state.minDestDistance) {
                state.minDestDistance = actualDistToDest;
            }

            // Perpendicular distance from user GPS to active route line
            const distFromRoute = turf.distance(userPt, userSnappedOnRoute, { units: 'meters' });

            // Dynamic Off-Route / Detour Detection:
            // 1. If user is > 14m away: immediate reroute (took another road)
            // 2. If user is > 8.5m away for 2 cycles: sustained detour onto another path
            // 3. If user is walking in the opposite direction (distance to destination increased by > 12m from closest point)
            const isFarOffRoute = accuracy <= 15 ? distFromRoute > 14 : distFromRoute > 20;
            const isMediumOffRoute = distFromRoute > 9.5;
            const isWalkingAway = (state.minDestDistance !== null && (actualDistToDest - state.minDestDistance > 12) && (nowTime - gpsNavigationStartTime > 4000));

            if (isFarOffRoute || isMediumOffRoute || isWalkingAway) {
                state.offRouteCounter++;
            } else {
                state.offRouteCounter = 0;
            }

            const shouldTriggerReroute = isFarOffRoute || (state.offRouteCounter >= 2) || (isWalkingAway && state.offRouteCounter >= 2);

            if (shouldTriggerReroute && perimStatus.inside) {
                if (nowTime - (state.lastRecalcTime || 0) > 2500) {
                    state.lastRecalcTime = nowTime;
                    state.offRouteCounter = 0;
    state.arrivalConfirmCounter = 0;
                    state.minDestDistance = actualDistToDest;
                    triggerHapticRecalculate();
                    showMobileToast('🔄 Rerouting path from your location…', 2000);
                    computeAndDrawRouteFromGPS(userCoord, targetBuildingId);
                    return;
                }
            }

            // Slice remaining route ahead of user when following the corridor
            let remainingDistMeters;
            if (distFromRoute <= 10) {
                const remainingSlice = turf.lineSlice(userSnappedOnRoute, destPt, fullLine);
                remainingDistMeters = turf.length(remainingSlice, { units: 'meters' });

                if (map.getSource('route-source')) {
                    map.getSource('route-source').setData(remainingSlice);
                }

                try {
                    const traveledSlice = turf.lineSlice(startPt, userSnappedOnRoute, fullLine);
                    if (map.getSource('route-traveled-source')) {
                        map.getSource('route-traveled-source').setData(traveledSlice);
                    }
                } catch (e) { }

                // Only show dashed connector line if user is genuinely unsnapped off-road
                if (!snapRes.snapped && distFromRoute >= 3.5 && map.getSource('gps-connector-source')) {
                    map.getSource('gps-connector-source').setData({
                        type: 'FeatureCollection',
                        features: [{
                            type: 'Feature',
                            geometry: {
                                type: 'LineString',
                                coordinates: [userCoord, userSnappedOnRoute.geometry.coordinates]
                            }
                        }]
                    });
                } else if (map.getSource('gps-connector-source')) {
                    map.getSource('gps-connector-source').setData({ type: 'FeatureCollection', features: [] });
                }
            } else {
                remainingDistMeters = turf.length(fullLine, { units: 'meters' });
            }

            // Update UI ETA & distance
            const roundedDist = Math.max(0, Math.round(remainingDistMeters));
            const remainTag = document.getElementById('phone-route-remain-tag');
            if (remainTag) remainTag.textContent = `${roundedDist} m remaining`;

            const walkingMinutes = Math.max(1, Math.round(roundedDist / 72));
            const etaTimeEl = document.getElementById('phone-gps-eta-time');
            if (etaTimeEl) etaTimeEl.textContent = (roundedDist < 40) ? '< 1 min' : `${walkingMinutes} min`;
            const etaDistEl = document.getElementById('phone-gps-eta-dist');
            if (etaDistEl) etaDistEl.textContent = `${roundedDist} m remaining`;

            const totalDist = turf.length(fullLine, { units: 'meters' });
            const currentDist = Math.max(0, totalDist - remainingDistMeters);
            updateLiveNavigation(currentDist, totalDist);

            // 7. Arrival Verification with Haptics (Strict finish-line / entrance proximity)
            // Only trigger when the user actually reaches the finish flag along the path,
            // never prematurely before turning a corner or passing a side wall.
            const inFinishZone = (distToEntrance <= 6.5) && (remainingDistMeters <= 7);
            const atExactFinish = (distToEntrance <= 4.5) && (remainingDistMeters <= 5);
            if (inFinishZone) {
                state.arrivalConfirmCounter = (state.arrivalConfirmCounter || 0) + 1;
            } else {
                state.arrivalConfirmCounter = 0;
            }

            const hasArrived = (nowTime - gpsNavigationStartTime > 3500) &&
                (atExactFinish || state.arrivalConfirmCounter >= 2);

            if (hasArrived) {
                state.arrivalConfirmCounter = 0;
                triggerHapticArrival();
                showPhoneArrival(targetBuildingId, 'gps');
                return;
            }
        } catch (err) {
            console.warn('Live GPS trimming notice:', err);
        }
    }

    // 8. Camera Follow
    updateSmoothCameraFollow(userCoord, distFromCompoundMeters);
}

export function recalculateRouteFromPoint(startCoord, buildingId) {
    computeAndDrawRouteFromGPS(startCoord, buildingId);
}

export function handleGPSError(err, buildingId) {
    console.warn('GPS location error:', err);
    if (err && err.code === 1) {
        if (state.gpsWatchId) {
            navigator.geolocation.clearWatch(state.gpsWatchId);
            state.gpsWatchId = null;
        }
        if (!userDismissedGPSPrompt) {
            showGPSPermissionCard(buildingId);
        }
        return;
    }
    if (err && err.code === 3) {
        showMobileToast('📍 Acquiring GPS satellites… please ensure clear sky visibility', 3500);
        return;
    }
    showMobileToast('📍 Searching for GPS signal…', 3000);
}

export function showGPSPermissionCard(buildingId) {
    let card = document.getElementById('phone-gps-permission-card');
    if (!card) {
        card = document.createElement('div');
        card.id = 'phone-gps-permission-card';
        card.className = 'phone-gps-permission-card';
        document.body.appendChild(card);
    }
    const bId = buildingId || state.selectedBuildingId || '';
    card.innerHTML = `
        <div class="pgpc-header">
            <div class="pgpc-title-wrap">
                <span class="pgpc-icon">${lucideIcon('map-pin', 18)}</span>
                <span class="pgpc-title">Location Permission Notice</span>
            </div>
            <button class="pgpc-close-btn" onclick="dismissGPSPermissionCard()" title="Close">${lucideIcon('x', 16)}</button>
        </div>
        <div class="pgpc-desc">
            Your phone reported that location access is restricted. If you already tapped "Allow" in your browser:
        </div>
        <div class="pgpc-tip">
            <strong>Check your phone's main GPS switch:</strong><br>
            • <strong>iPhone:</strong> Go to <em>Settings → Privacy & Security → Location Services</em>. Ensure the top switch is <strong>ON</strong> and Safari has <strong>Precise Location ON</strong>.<br>
            • <strong>Android:</strong> Swipe down your notification panel and turn <strong>ON</strong> the main <strong>Location</strong> icon.
        </div>
        <div class="pgpc-actions">
            <button class="pgpc-btn primary" onclick="retryPhoneGPS('${bId}')">${lucideIcon('rotate-ccw', 14)} Retry GPS</button>
            <button class="pgpc-btn" style="background:#0284c7;color:#fff;" onclick="startTapToPlaceLocation('${bId}')">${lucideIcon('map-pin', 14)} Tap Map to Start</button>
            <button class="pgpc-btn secondary" onclick="dismissGPSPermissionCard(true)">${lucideIcon('landmark', 14)} Use the Kiosk</button>
        </div>
    `;
}

export function dismissGPSPermissionCard(startRoute = false) {
    userDismissedGPSPrompt = true;
    const card = document.getElementById('phone-gps-permission-card');
    if (card) card.remove();
    if (startRoute && state.selectedBuildingId) {
        startPhoneAnimatedRoute();
    }
}

export function showOffCampusPromptCard(userCoord, distOutsideMeters, buildingId) {
    let card = document.getElementById('phone-offcampus-gmaps-card');
    if (!card) {
        card = document.createElement('div');
        card.id = 'phone-offcampus-gmaps-card';
        card.className = 'phone-gps-permission-card';
        document.body.appendChild(card);
    }
    const isQares = state.currentStationId === 'qares';
    const stationLabel = isQares ? 'DA-QARES' : 'DA-LARES';
    // Main Entrance Gate coordinates: DA-LARES [121.165745, 13.958380], DA-QARES [121.3713315, 13.9432268]
    const gateLatLng = isQares ? '13.9432268,121.3713315' : '13.958380,121.165745';
    const originParam = (Array.isArray(userCoord) && userCoord.length >= 2)
        ? `&origin=${userCoord[1]},${userCoord[0]}`
        : '';
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${gateLatLng}&travelmode=driving`;

    const distLabel = distOutsideMeters >= 1000
        ? `${(distOutsideMeters / 1000).toFixed(1)} km`
        : `${Math.round(distOutsideMeters)} m`;
    const bId = buildingId || state.selectedBuildingId || '';
    const targetBldg = getBuildingById(bId) || BUILDING_DIRECTORY.find(b => b.id === bId);
    const destName = targetBldg ? targetBldg.name : 'your destination';

    card.innerHTML = `
        <div class="pgpc-header">
            <div class="pgpc-title-wrap">
                <span class="pgpc-icon">${lucideIcon('compass', 18)}</span>
                <span class="pgpc-title">Outside ${stationLabel} (${distLabel} away)</span>
            </div>
            <button class="pgpc-close-btn" onclick="dismissOffCampusPromptCard(true)" title="Close">${lucideIcon('x', 16)}</button>
        </div>
        <div class="pgpc-desc">
            You are currently outside the <strong>${stationLabel}</strong> campus boundary. Our 3D Live GPS guides along internal campus roads &amp; walkways.
        </div>
        <div class="pgpc-tip">
            <strong>Need directions to the Main Gate first?</strong><br>
            Use <strong>Google Maps</strong> to reach the ${stationLabel} Main Entrance. Once you enter the gate, keep this page open and Live GPS will automatically guide you to <strong>${destName}</strong>!
        </div>
        <div class="pgpc-actions">
            <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" class="pgpc-btn primary" style="text-decoration:none;">
                ${lucideIcon('map', 15)} Open in Google Maps
            </a>
            <button class="pgpc-btn secondary" onclick="dismissOffCampusPromptCard(true)">
                ${lucideIcon('eye', 15)} Preview Campus Route
            </button>
        </div>
    `;
}

export function dismissOffCampusPromptCard(markDismissed = true) {
    if (markDismissed) {
        userDismissedOffCampusPrompt = true;
    }
    const card = document.getElementById('phone-offcampus-gmaps-card');
    if (card) card.remove();
}

export function startTapToPlaceLocation(buildingId) {
    dismissGPSPermissionCard();
    showMobileToast('📍 Tap anywhere on the campus map to set your starting location!', 5000);

    const onMapTap = (e) => {
        map.off('click', onMapTap);
        const tappedCoord = [e.lngLat.lng, e.lngLat.lat];
        state.lastKnownGPSCoords = tappedCoord;

        if (!state.userGPSMarker) {
            const el = createUserGPSMarkerElement();
            state.userGPSMarker = new mapboxgl.Marker({
                element: el,
                anchor: 'center',
                rotationAlignment: 'map',
                pitchAlignment: 'map'
            }).setLngLat(tappedCoord).addTo(map);
        } else {
            if (typeof state.userGPSMarker.setPitchAlignment === 'function') {
                state.userGPSMarker.setPitchAlignment('map');
                state.userGPSMarker.setRotationAlignment('map');
            }
            state.userGPSMarker.setLngLat(tappedCoord);
        }

        computeAndDrawRouteFromGPS(tappedCoord, buildingId || state.selectedBuildingId);
        showMobileToast('📍 Route started from your selected point!', 3000);
    };

    map.once('click', onMapTap);
}

export function retryPhoneGPS(buildingId) {
    userDismissedGPSPrompt = false;
    const card = document.getElementById('phone-gps-permission-card');
    if (card) card.remove();
    showMobileToast('📍 Requesting GPS permission…', 2500);
    startPhoneLiveGPS(buildingId || state.selectedBuildingId);
}

export function scheduleAutoRecenter() {
    if (state.autoRecenterTimer) clearTimeout(state.autoRecenterTimer);
    if (!state.isMobileGPSActive) return;
    state.autoRecenterTimer = setTimeout(() => {
        if (state.isMobileGPSActive && !state.isUserFollowingGPS && state.lastKnownGPSCoords) {
            recenterOnUserGPS({ auto: true });
        }
    }, 5000);
}

export function updateRecenterStateUI(isFollowing) {
    const centerBtn = document.getElementById('phone-gps-center-btn');
    const fabBtn = document.getElementById('mobile-recenter-btn');
    if (centerBtn) {
        centerBtn.classList.toggle('needs-recenter', !isFollowing);
        centerBtn.innerHTML = isFollowing ? `<span>${lucideIcon('crosshair', 14)}</span> Center` : `<span>${lucideIcon('crosshair', 14)}</span> Re-center`;
    }
    if (fabBtn) {
        fabBtn.classList.toggle('active', !isFollowing && state.isMobileGPSActive);
    }
}

export function recenterOnUserGPS(opts = {}) {
    if (opts && opts.auto) {
        return _recenterOnUserGPSImpl(opts);
    }
    return withCooldown('phone:gps-recenter', () => _recenterOnUserGPSImpl(opts), 300).result;
}

function _recenterOnUserGPSImpl(opts = {}) {
    if (state.autoRecenterTimer) {
        clearTimeout(state.autoRecenterTimer);
        state.autoRecenterTimer = null;
    }
    if (state.lastKnownGPSCoords) {
        if (!evaluateCampusPerimeter(state.lastKnownGPSCoords).inside) {
            state.isUserFollowingGPS = true;
            updateRecenterStateUI(true);
            if (state.activeFullRouteCoords && state.activeFullRouteCoords.length >= 2) {
                try {
                    const bbox = turf.bbox(turf.lineString(state.activeFullRouteCoords));
                    map.fitBounds(bbox, {
                        padding: getResponsiveMapPadding(),
                        pitch: 45,
                        duration: 800,
                        maxZoom: 18.8
                    });
                } catch (e) { }
            }
            if (!opts.auto) {
                showMobileToast('📍 Outside campus boundary — centered on campus route');
            }
            return;
        }
        state.isUserFollowingGPS = true;
        updateRecenterStateUI(true);
        map.flyTo({
            center: state.lastKnownGPSCoords,
            zoom: 19.5,
            pitch: 0,
            duration: 800
        });
        if (!opts.auto) {
            showMobileToast('🎯 Re-centered on your location');
        }
    } else {
        showMobileToast('📍 Acquiring GPS signal…');
        if (state.selectedBuildingId) {
            startPhoneLiveGPS(state.selectedBuildingId);
        }
    }
}

export function initGPSMapListeners() {
    function pauseFollowingOnUserGesture() {
        if (!state.isMobileGPSActive) return;
        state.isUserFollowingGPS = false;
        updateRecenterStateUI(false);
        scheduleAutoRecenter();
    }

    map.on('dragstart', pauseFollowingOnUserGesture);
    map.on('zoomstart', pauseFollowingOnUserGesture);
    map.on('rotatestart', pauseFollowingOnUserGesture);
    map.on('pitchstart', pauseFollowingOnUserGesture);

    map.on('dragend', () => {
        if (state.isMobileGPSActive && !state.isUserFollowingGPS) {
            scheduleAutoRecenter();
        }
    });

    map.on('zoomend', () => {
        if (state.isMobileGPSActive && !state.isUserFollowingGPS) {
            scheduleAutoRecenter();
        }
    });
}

// Window reflections
window.createUserGPSMarkerElement = createUserGPSMarkerElement;
window.updateUserGPSMarker = updateUserGPSMarker;
window.requestUserInitialLocation = requestUserInitialLocation;
window.startPhoneLiveGPS = startPhoneLiveGPS;
window.startMobileGPSNavigation = startMobileGPSNavigation;
window.stopPhoneLiveGPS = stopPhoneLiveGPS;
window.stopMobileGPSNavigation = stopMobileGPSNavigation;
window.dismissGPSPermissionCard = dismissGPSPermissionCard;
window.showOffCampusPromptCard = showOffCampusPromptCard;
window.dismissOffCampusPromptCard = dismissOffCampusPromptCard;
window.retryPhoneGPS = retryPhoneGPS;
window.startTapToPlaceLocation = startTapToPlaceLocation;
window.recenterOnUserGPS = recenterOnUserGPS;
window.handleWelcomeContinue = window.handleWelcomeContinue;
window.triggerHapticArrival = triggerHapticArrival;
window.triggerHapticRecalculate = triggerHapticRecalculate;
window.handleGPSPositionUpdate = handleGPSPositionUpdate;
window.computeAndDrawRouteFromGPS = computeAndDrawRouteFromGPS;
