// DA-LARES Wayfinding — Live Mobile GPS Engine & Compass System

import { BUILDING_DIRECTORY } from './data/buildings.js';
import { state } from './data/state.js';
import { map } from './map-setup.js';
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

let gpsNavigationStartTime = 0;
let userDismissedGPSPrompt = false;
let lastCameraFollowLngLat = null;
let lastTrimmedTime = 0;

let markerCurrentLngLat = null;
let markerTargetLngLat = null;
let markerLerpStartTime = 0;
let markerLerpDuration = 500;
let markerAnimFrame = null;
let lastTrimmedCoord = null;

let smoothedCompassHeading = null;
let rawCompassHeading = null;
let headingAnimFrame = null;

let activeTouchCount = 0;

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
                <!-- 60-degree glowing fan beam cone pointing forward -->
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
    }
}

// Auto-request compass on the first user interaction anywhere on the screen
export function triggerCompassPermissionOnFirstGesture() {
    if (typeof window.isPhoneMode === 'function' && !window.isPhoneMode()) {
        return;
    }
    requestDeviceOrientationPermission();
    window.removeEventListener('touchend', triggerCompassPermissionOnFirstGesture);
    window.removeEventListener('click', triggerCompassPermissionOnFirstGesture);
}
window.addEventListener('touchend', triggerCompassPermissionOnFirstGesture, { passive: true });
window.addEventListener('click', triggerCompassPermissionOnFirstGesture, { passive: true });

export function updateUserGPSMarker(lng, lat) {
    if (!state.userGPSMarker) {
        const el = createUserGPSMarkerElement();
        state.userGPSMarker = new mapboxgl.Marker({ 
            element: el,
            rotationAlignment: 'map',
            pitchAlignment: 'map'
        }).setLngLat([lng, lat]).addTo(map);
    } else {
        state.userGPSMarker.setLngLat([lng, lat]);
    }
}

export function requestUserInitialLocation() {
    if (!navigator.geolocation) {
        showMobileToast('📍 GPS not supported on this browser.', 3000);
        return;
    }
    showMobileToast('📍 Locating your position on campus…', 3000);

    let initialFound = false;
    const onInitialPos = (pos) => {
        if (initialFound) return;
        initialFound = true;
        const userLng = pos.coords.longitude;
        const userLat = pos.coords.latitude;
        state.lastKnownGPSCoords = [userLng, userLat];
        updateUserGPSMarker(userLng, userLat);
        showMobileToast('📍 Location found! Tap any building to navigate.', 3500);

        const userPt = turf.point([userLng, userLat]);
        const compoundCenter = turf.point([121.1665, 13.9582]);
        const distFromCompoundMeters = turf.distance(userPt, compoundCenter, { units: 'meters' });
        if (distFromCompoundMeters <= 2500) {
            map.easeTo({
                center: [userLng, userLat],
                zoom: 18.8,
                pitch: 0,
                duration: 900
            });
        }
    };

    navigator.geolocation.getCurrentPosition(
        onInitialPos,
        (err) => {
            if (initialFound) return;
            console.warn('Initial high accuracy GPS slow, trying standard accuracy:', err);
            navigator.geolocation.getCurrentPosition(
                onInitialPos,
                (err2) => {
                    if (err2.code === 1) { // PERMISSION_DENIED
                        showGPSPermissionCard();
                    } else {
                        showMobileToast('📍 GPS signal weak. You can still use the Kiosk as starting point.', 3500);
                    }
                },
                { enableHighAccuracy: false, maximumAge: 30000, timeout: 6000 }
            );
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 4500 }
    );
}

export function startPhoneLiveGPS(buildingId) {
    if (!buildingId) buildingId = state.selectedBuildingId;
    if (!buildingId) return;
    state.selectedBuildingId = buildingId;
    gpsNavigationStartTime = Date.now();

    // Stop animated walker simulation if running
    if (state.walkAnimFrame) cancelAnimationFrame(state.walkAnimFrame);
    if (state.walkerMarkerInstance) {
        state.walkerMarkerInstance.remove();
        state.walkerMarkerInstance = null;
    }

    state.isMobileGPSActive = true;
    state.isUserFollowingGPS = true;
    state.offRouteCounter = 0;
    document.body.classList.add('phone-gps-active');
    updateRecenterStateUI(true);

    const building = BUILDING_DIRECTORY.find(b => b.id === buildingId);
    const bldgName = building ? building.name : 'Destination';
    state.currentRouteDestName = bldgName;

    // Immediately switch sheet to route view so user gets immediate visual feedback!
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
    if (ptnhIcon) ptnhIcon.innerHTML = '📍';
    if (topHud) topHud.classList.add('active');

    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');

    // Switch to top-down 2D view for accurate walkway navigation
    try { map.easeTo({ pitch: 0, duration: 600 }); } catch (e) {}

    state.activeFullRouteCoords = null; // Clear so new route from user GPS is always drawn

    // If last known GPS is already cached, compute and draw immediately from user's live position!
    if (state.lastKnownGPSCoords) {
        computeAndDrawRouteFromGPS(state.lastKnownGPSCoords, buildingId);
    }

    if (!navigator.geolocation) {
        showMobileToast('GPS not supported on this browser. Showing route from Kiosk.', 4000);
        startPhoneAnimatedRoute();
        return;
    }

    showMobileToast('📍 Locating your position…', 3000);

    if (state.gpsWatchId) {
        navigator.geolocation.clearWatch(state.gpsWatchId);
        state.gpsWatchId = null;
    }

    // Set up GPS accuracy and connector layers on map
    setupGPSLayers();

    // Start continuous tracking immediately for fastest satellite fix
    startContinuousTracking(buildingId);

    // Also initiate high-accuracy query with generous timeout
    navigator.geolocation.getCurrentPosition(
        (pos) => handleGPSPositionUpdate(pos, buildingId),
        (err) => {
            console.warn('Initial GPS query note:', err);
            if (err && err.code === 1) { // PERMISSION_DENIED
                showGPSPermissionCard(buildingId);
            }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
    );

    // Request and bind device orientation / compass on this direct user tap
    requestDeviceOrientationPermission();
}

export function startContinuousTracking(buildingId) {
    if (state.gpsWatchId) return;
    // CRITICAL: maximumAge: 0 forces the device to ALWAYS deliver the freshest real-time hardware GPS fix
    state.gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => handleGPSPositionUpdate(pos, buildingId),
        (err) => {
            console.warn('Continuous GPS tracking warning:', err);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 }
    );
}

export function animateMarkerTo(targetLngLat) {
    if (!state.userGPSMarker) return;
    if (!markerCurrentLngLat) {
        markerCurrentLngLat = targetLngLat;
        state.userGPSMarker.setLngLat(targetLngLat);
        return;
    }
    const startLngLat = [...markerCurrentLngLat];
    markerTargetLngLat = targetLngLat;
    markerLerpStartTime = performance.now();

    if (markerAnimFrame) cancelAnimationFrame(markerAnimFrame);

    function step(now) {
        const elapsed = now - markerLerpStartTime;
        const progress = Math.min(1, elapsed / markerLerpDuration);
        const ease = 1 - (1 - progress) * (1 - progress); // Smooth quad ease-out

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
    if (!state.isUserFollowingGPS || distFromCompoundMeters > 1500) return;
    if (!lastCameraFollowLngLat) {
        lastCameraFollowLngLat = targetLngLat;
        map.easeTo({
            center: targetLngLat,
            zoom: 19.5,
            pitch: 0,
            duration: 800
        });
        return;
    }
    // Only update camera if user moved at least 2.0 meters from last camera focus
    const moveD = turf.distance(turf.point(lastCameraFollowLngLat), turf.point(targetLngLat), { units: 'meters' });
    if (moveD >= 2.0) {
        lastCameraFollowLngLat = targetLngLat;
        map.panTo(targetLngLat, {
            duration: 600,
            easing: t => t
        });
    }
}

export function stopPhoneLiveGPS() {
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

    state.isMobileGPSActive = false;
    state.isUserFollowingGPS = false;
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
    smoothedCompassHeading = null;
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

    if (smoothedCompassHeading === null) {
        smoothedCompassHeading = targetHeading;
    } else {
        let diff = targetHeading - smoothedCompassHeading;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        smoothedCompassHeading = (smoothedCompassHeading + diff * 0.25 + 360) % 360;
    }

    // Subtract map bearing so fan always points real-world north-relative
    const mapBearing = map ? (map.getBearing() || 0) : 0;
    const visualRotation = (smoothedCompassHeading - mapBearing + 360) % 360;

    const headingEl = document.getElementById('user-gps-heading');
    if (headingEl) {
        headingEl.style.display = 'flex';
        headingEl.style.transform = `rotate(${Math.round(visualRotation)}deg)`;
    }
}

// Continuously re-apply heading on map rotate/move so fan stays aligned
export function startHeadingSync() {
    if (headingAnimFrame) return;
    function syncLoop() {
        if (rawCompassHeading !== null) {
            applyUserHeading(rawCompassHeading);
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

    // 1. iOS Safari: webkitCompassHeading (0 = True North, clockwise)
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
        heading = e.webkitCompassHeading;
    }
    // 2. Android Chrome / Standard: alpha (0 = arbitrary, but deviceorientationabsolute gives true north)
    else if (typeof e.alpha === 'number' && !isNaN(e.alpha)) {
        heading = (360 - e.alpha) % 360;
    }

    if (heading !== null && !isNaN(heading)) {
        // Adjust for screen orientation (landscape, etc.)
        const screenAngle = (typeof window.orientation === 'number')
            ? window.orientation
            : (screen.orientation ? screen.orientation.angle : 0) || 0;
        const correctedHeading = (heading + screenAngle + 360) % 360;

        rawCompassHeading = correctedHeading;
        applyUserHeading(correctedHeading);
        startHeadingSync();
    }
}

export function computeAndDrawRouteFromGPS(startCoord, buildingId) {
    const building = BUILDING_DIRECTORY.find(b => b.id === buildingId);
    const roadGraph = state.roadGraph || (typeof window !== 'undefined' ? window.roadGraph : null);
    const buildingEntrances = (typeof window !== 'undefined' && window.BUILDING_ENTRANCES) ? window.BUILDING_ENTRANCES : {};

    if (!building || !roadGraph || roadGraph.size === 0) return;

    const ENTRANCE_OVERRIDES = {
        'rafis_building': 'mis_building',
        'bac_building': 'pmed_building',
        'vacant': 'fmr',
        'mis_data_center': 'fmr'
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

    const routeCoords = bestPath || [startCoord, building.coords];
    state.activeFullRouteCoords = routeCoords;
    state.activeRouteCoords = routeCoords;

    // Turn-by-turn steps
    state.currentRouteSteps = buildSteps(routeCoords, BUILDING_DIRECTORY, building.id);
    state.currentRouteDestName = building.name;

    // Update UI turn-by-turn steps and peek card!
    updatePhoneRouteUI(routeCoords);
    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');

    // Draw route statically without automated walker sprint
    drawRoute(routeCoords, { animated: false });

    const userPt = turf.point(startCoord);
    const compoundCenter = turf.point([121.1665, 13.9582]);
    const distFromCompoundMeters = turf.distance(userPt, compoundCenter, { units: 'meters' });

    if (distFromCompoundMeters > 1500) {
        const bbox = turf.bbox(turf.lineString(routeCoords));
        map.fitBounds(bbox, {
            padding: getResponsiveMapPadding(),
            maxZoom: 17,
            pitch: 0,
            duration: 1200
        });
    } else {
        // Top-down 2D orthogonal view for precision accuracy
        map.easeTo({
            center: startCoord,
            zoom: 19.5,
            pitch: 0,
            duration: 800
        });
    }
}

export function handleGPSPositionUpdate(pos, targetBuildingId) {
    if (!targetBuildingId) targetBuildingId = state.selectedBuildingId;
    const userLng = pos.coords.longitude;
    const userLat = pos.coords.latitude;
    const accuracy = Math.max(5, pos.coords.accuracy || 10);

    // Dismiss permission card if visible
    dismissGPSPermissionCard(false);

    // 1. Distance check from DA-LARES compound
    const userPt = turf.point([userLng, userLat]);
    const compoundCenter = turf.point([121.1665, 13.9582]);
    const distFromCompoundMeters = turf.distance(userPt, compoundCenter, { units: 'meters' });

    // 2. Walkway Map-Matching (Road Snapping)
    let snappedCoord = [userLng, userLat];
    let isSnapped = false;

    // Prioritize snapping directly onto active navigation route line
    if (state.activeFullRouteCoords && state.activeFullRouteCoords.length > 1) {
        try {
            const fullLine = turf.lineString(state.activeFullRouteCoords);
            const snappedOnRoute = turf.nearestPointOnLine(fullLine, userPt);
            const distToRoute = turf.distance(userPt, snappedOnRoute, { units: 'meters' });
            // Snap cleanly if within 14 meters of active route line
            if (distToRoute <= 14) {
                snappedCoord = snappedOnRoute.geometry.coordinates;
                isSnapped = true;
            }
        } catch(e) {}
    }

    // If not snapped to active route, snap to nearest registered campus walkway/road
    const roadNetwork = (typeof window !== 'undefined' && window.ROAD_NETWORK) ? window.ROAD_NETWORK : null;
    if (!isSnapped && roadNetwork && distFromCompoundMeters <= 1500) {
        try {
            const snappedPt = turf.nearestPointOnLine(roadNetwork, userPt);
            const distToWalkway = turf.distance(userPt, snappedPt, { units: 'meters' });
            // Snap cleanly if within 12 meters of a campus walkway
            if (distToWalkway <= 12) {
                snappedCoord = snappedPt.geometry.coordinates;
                isSnapped = true;
            }
        } catch (err) {}
    }

    // Direction from GPS hardware heading or walking delta
    if (typeof pos.coords.heading === 'number' && !isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
        applyUserHeading(pos.coords.heading);
    } else if (state.lastKnownGPSCoords) {
        try {
            const movedDist = turf.distance(turf.point(state.lastKnownGPSCoords), turf.point(snappedCoord), { units: 'meters' });
            if (movedDist >= 1.2) {
                const bearing = turf.bearing(turf.point(state.lastKnownGPSCoords), turf.point(snappedCoord));
                applyUserHeading((bearing + 360) % 360);
            }
        } catch (e) {}
    }

    // Cache snapped location
    state.lastKnownGPSCoords = snappedCoord;

    // 3. Smooth 60fps User GPS Marker Gliding to the Snapped Position
    if (!state.userGPSMarker) {
        const el = createUserGPSMarkerElement();
        state.userGPSMarker = new mapboxgl.Marker({ 
            element: el,
            rotationAlignment: 'map',
            pitchAlignment: 'map'
        }).setLngLat(snappedCoord).addTo(map);
        markerCurrentLngLat = snappedCoord;
    } else {
        animateMarkerTo(snappedCoord);
    }

    // 4. Update soft accuracy circle on map (centered on snapped marker)
    try {
        if (map.getSource('gps-accuracy-source')) {
            const circle = turf.circle(snappedCoord, Math.min(accuracy, 25), { units: 'meters' });
            map.getSource('gps-accuracy-source').setData(circle);
        }
    } catch (err) { }

    // 5. Subtle off-road connector line (only shown if user walks far into an open field)
    try {
        if (map.getSource('gps-connector-source')) {
            if (!isSnapped && distFromCompoundMeters <= 1500) {
                const connectorLine = turf.lineString([
                    [userLng, userLat],
                    snappedCoord
                ]);
                map.getSource('gps-connector-source').setData(connectorLine);
            } else {
                map.getSource('gps-connector-source').setData({ type: 'FeatureCollection', features: [] });
            }
        }
    } catch (err) { }

    // If route hasn't been drawn yet, or if it was previously set to Kiosk route, draw starting from user's live GPS position!
    const isRouteFromKiosk = state.activeFullRouteCoords && state.activeFullRouteCoords.length > 0 &&
        (Math.abs(state.activeFullRouteCoords[0][0] - state.KIOSK_COORDS[0]) < 0.00005 && Math.abs(state.activeFullRouteCoords[0][1] - state.KIOSK_COORDS[1]) < 0.00005);

    if (!state.activeFullRouteCoords || !map.getSource('route-source') || (state.isMobileGPSActive && isRouteFromKiosk)) {
        if (distFromCompoundMeters > 1500) {
            showMobileToast(`📍 Connected to phone GPS (${(distFromCompoundMeters / 1000).toFixed(1)} km away). Route shown from Argosino Kiosk.`, 4000);
            const kCoords = computeRouteFromKiosk(targetBuildingId);
            state.activeFullRouteCoords = kCoords;
            state.currentRouteSteps = buildSteps(kCoords, BUILDING_DIRECTORY, targetBuildingId);
            const targetBldg = BUILDING_DIRECTORY.find(b => b.id === targetBuildingId);
            state.currentRouteDestName = targetBldg ? targetBldg.name : 'Destination';
            updatePhoneRouteUI(kCoords);
            drawRoute(kCoords, { animated: false });
        } else {
            showMobileToast('📍 Connected to phone GPS. Route started from your location.', 3000);
            computeAndDrawRouteFromGPS(snappedCoord, targetBuildingId);
        }
        return;
    }

    // 5. Throttled Dynamic Route Trimming (Prevents main-thread UI lag)
    const nowTime = Date.now();
    let shouldTrimRoute = false;
    if (!lastTrimmedCoord) {
        shouldTrimRoute = true;
        lastTrimmedCoord = [userLng, userLat];
        lastTrimmedTime = nowTime;
    } else {
        const moveDist = turf.distance(turf.point(lastTrimmedCoord), userPt, { units: 'meters' });
        if (moveDist >= 1.2 || (nowTime - lastTrimmedTime >= 1200)) {
            shouldTrimRoute = true;
            lastTrimmedCoord = [userLng, userLat];
            lastTrimmedTime = nowTime;
        }
    }

    if (shouldTrimRoute) {
        try {
            const fullLine = turf.lineString(state.activeFullRouteCoords);
            const userSnappedOnRoute = turf.nearestPointOnLine(fullLine, userPt);
            const startPt = turf.point(state.activeFullRouteCoords[0]);
            const destPt = turf.point(state.activeFullRouteCoords[state.activeFullRouteCoords.length - 1]);

            // Check off-route distance (> 25m off route)
            const distFromRoute = turf.distance(userPt, userSnappedOnRoute, { units: 'meters' });
            if (distFromRoute > 25 && distFromCompoundMeters <= 1500) {
                state.offRouteCounter++;
                if (state.offRouteCounter >= 3 && (nowTime - state.lastRecalcTime > 8000)) {
                    state.lastRecalcTime = nowTime;
                    state.offRouteCounter = 0;
                    showMobileToast('🔄 Recalculating path from your location…', 2500);
                    computeAndDrawRouteFromGPS(snappedCoord, targetBuildingId);
                    return;
                }
            } else {
                state.offRouteCounter = 0;
            }

            // Only slice/trim route ahead if user is actually on or close to the route (<= 10 meters)
            let remainingDistMeters;
            if (distFromRoute <= 10) {
                const remainingSlice = turf.lineSlice(userSnappedOnRoute, destPt, fullLine);
                remainingDistMeters = turf.length(remainingSlice, { units: 'meters' });

                if (map.getSource('route-source')) {
                    map.getSource('route-source').setData(remainingSlice);
                }

                // Traveled path behind user
                try {
                    const traveledSlice = turf.lineSlice(startPt, userSnappedOnRoute, fullLine);
                    if (map.getSource('route-traveled-source')) {
                        map.getSource('route-traveled-source').setData(traveledSlice);
                    }
                } catch (e) { }
            } else {
                // User is far from route: DO NOT slice green line away! Keep route line full so user sees how to return
                remainingDistMeters = turf.length(fullLine, { units: 'meters' });
            }

            // Update UI distance and ETA
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

            // 6. Check Arrival: User MUST be physically within 18m of target AND remaining route <= 12m
            const targetBldg = BUILDING_DIRECTORY.find(b => b.id === targetBuildingId);
            const targetCoord = targetBldg ? targetBldg.coords : state.activeFullRouteCoords[state.activeFullRouteCoords.length - 1];
            const actualDistToDest = turf.distance(userPt, turf.point(targetCoord), { units: 'meters' });

            if ((nowTime - gpsNavigationStartTime > 5000) && actualDistToDest <= 18 && remainingDistMeters <= 12) {
                showPhoneArrival(targetBuildingId);
                return;
            }
        } catch (err) {
            console.warn('Live GPS trimming notice:', err);
        }
    }

    // 7. Smooth Camera Glide Following (follows snapped walkway position)
    updateSmoothCameraFollow(snappedCoord, distFromCompoundMeters);
}

export function recalculateRouteFromPoint(startCoord, buildingId) {
    computeAndDrawRouteFromGPS(startCoord, buildingId);
}

export function handleGPSError(err, buildingId) {
    console.warn('GPS location error:', err);
    if (err && err.code === 1) { // PERMISSION_DENIED
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
        // Transient timeout while acquiring satellites indoors
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
                <span class="pgpc-icon">📍</span>
                <span class="pgpc-title">Location Permission Notice</span>
            </div>
            <button class="pgpc-close-btn" onclick="dismissGPSPermissionCard()" title="Close">✕</button>
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
            <button class="pgpc-btn primary" onclick="retryPhoneGPS('${bId}')">🔄 Retry GPS</button>
            <button class="pgpc-btn" style="background:#0284c7;color:#fff;" onclick="startTapToPlaceLocation('${bId}')">📍 Tap Map to Start</button>
            <button class="pgpc-btn secondary" onclick="dismissGPSPermissionCard(true)">🏛️ Use the Kiosk</button>
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
                rotationAlignment: 'map',
                pitchAlignment: 'map'
            }).setLngLat(tappedCoord).addTo(map);
        } else {
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
        centerBtn.innerHTML = isFollowing ? '<span>🎯</span> Center' : '<span>🎯</span> Re-center';
    }
    if (fabBtn) {
        fabBtn.classList.toggle('active', !isFollowing && state.isMobileGPSActive);
    }
}

export function recenterOnUserGPS(opts = {}) {
    if (state.autoRecenterTimer) {
        clearTimeout(state.autoRecenterTimer);
        state.autoRecenterTimer = null;
    }
    if (state.lastKnownGPSCoords) {
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
    const mapCanvas = map.getCanvas();
    if (mapCanvas) {
        mapCanvas.addEventListener('touchstart', (e) => {
            activeTouchCount = e.touches ? e.touches.length : 1;
            if (state.isMobileGPSActive && !state.isUserFollowingGPS) {
                scheduleAutoRecenter();
            }
        }, { passive: true });

        mapCanvas.addEventListener('touchend', (e) => {
            activeTouchCount = e.touches ? e.touches.length : 0;
            if (state.isMobileGPSActive && !state.isUserFollowingGPS) {
                scheduleAutoRecenter();
            }
        }, { passive: true });

        mapCanvas.addEventListener('touchcancel', () => {
            activeTouchCount = 0;
        }, { passive: true });
    }

    // Pause follow ONLY on single-finger manual drag, NOT during pinch zoom
    map.on('dragstart', (e) => {
        if (!state.isMobileGPSActive) return;
        const touches = e.originalEvent && e.originalEvent.touches;
        const touchCount = touches ? touches.length : activeTouchCount;
        // If user is pinching (2+ fingers), keep follow active!
        if (touchCount > 1) {
            return;
        }
        state.isUserFollowingGPS = false;
        updateRecenterStateUI(false);
        scheduleAutoRecenter();
    });

    map.on('dragend', () => {
        if (state.isMobileGPSActive && !state.isUserFollowingGPS) {
            scheduleAutoRecenter();
        }
    });

    // When zoom ends: If camera is following GPS, re-center smoothly on user's location at the new zoom level!
    map.on('zoomend', () => {
        if (state.isMobileGPSActive && state.isUserFollowingGPS && state.lastKnownGPSCoords) {
            map.easeTo({
                center: state.lastKnownGPSCoords,
                duration: 250,
                easing: t => t
            });
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
window.retryPhoneGPS = retryPhoneGPS;
window.startTapToPlaceLocation = startTapToPlaceLocation;
window.recenterOnUserGPS = recenterOnUserGPS;
window.handleWelcomeContinue = window.handleWelcomeContinue;
