// DA-LARES Routing & Graph Pathfinding Module

// A* / Dijkstra shortest path, road network graph, route drawing, and smoothing.



import { BUILDING_DIRECTORY, BUILDING_ENTRANCES, getBuildingById } from './data/buildings.js';
import { lucideIcon } from './data/icons.js';

import { FIELD_COMMODITY_ZONES } from './data/plots.js';

import { SAVED_MAIN_KIOSK_COORDS } from './data/config.js';

import { STATIONS } from './data/stations.js';

import { state } from './data/state.js';

import { map } from './map-setup.js';

import { buildSteps, renderStepsList, updateLiveNavigation, resetStepsNavigation } from './steps.js';

import { 

    clearArrivedCountdown, 

    declutterLabelsForRoute, 

    restoreLabels, 

    setRouteSpeed,

    setRouteCameraMode,

    resetCameraModeToDefault,

    updateCameraControlsUI,

    resetCameraControlsTimer

} from './walker.js';

import { closeBuildingPanel } from './building-panel.js';

import { 

    isPhoneMode, 

    setPhoneSheetView, 

    setPhoneSheetSnap,

    getResponsiveMapPadding

} from './phone-ui.js';

import { updatePhoneRouteUI, updatePhoneLiveNavUI } from './phone-nav.js';

import { stopPhoneLiveGPS } from './gps.js';

import { stopOrbit } from './idle.js';

import { updateRouteQR, closeQRZoomModal } from './qr.js';

import { updateOcclusion, resetOcclusion } from './occlusion.js';
import { updateSidebarToggleIcon } from './sidebar.js';



function safeClearArrivedCountdown() {

    if (typeof clearArrivedCountdown === 'function') clearArrivedCountdown();

    else if (typeof window.clearArrivedCountdown === 'function') window.clearArrivedCountdown();

}

function safeCloseBuildingPanel() {

    if (typeof closeBuildingPanel === 'function') closeBuildingPanel();

    else if (typeof window.closeBuildingPanel === 'function') window.closeBuildingPanel();

}

function safeDeclutterLabelsForRoute(coords, id) {

    if (typeof declutterLabelsForRoute === 'function') declutterLabelsForRoute(coords, id);

    else if (typeof window.declutterLabelsForRoute === 'function') window.declutterLabelsForRoute(coords, id);

}

function safeRestoreLabels() {

    if (typeof restoreLabels === 'function') restoreLabels();

    else if (typeof window.restoreLabels === 'function') window.restoreLabels();

}



function launchWalkerLoop(coords, walkerEl, totalDistance, routeLine) {

    if (state.walkAnimFrame) {

        cancelAnimationFrame(state.walkAnimFrame);

        state.walkAnimFrame = null;

    }

    if (state.walkStartTimer) {

        clearTimeout(state.walkStartTimer);

        state.walkStartTimer = null;

    }

    if (state.celebrationTimer) {

        clearTimeout(state.celebrationTimer);

        state.celebrationTimer = null;

    }



    let currentDistance = 0;

    const baseSpeedMps = 6.0;

    let lastTimestamp = null;

    let lastSliceDistance = 0;



    function animateWalking(timestamp) {

        if (!lastTimestamp) lastTimestamp = timestamp;

        let dt = (timestamp - lastTimestamp) / 1000;

        lastTimestamp = timestamp;

        if (dt > 0.1 || dt <= 0) dt = 0.016;



        currentDistance += baseSpeedMps * state.routeSpeedMultiplier * dt;



        if (currentDistance >= totalDistance) {

            currentDistance = totalDistance;

            if (map.getSource('route-source')) {

                map.getSource('route-source').setData({

                    type: 'Feature', geometry: { type: 'LineString', coordinates: coords }

                });

            }

            if (state.walkerMarkerInstance) {

                state.walkerMarkerInstance.setLngLat(coords[coords.length - 1]);

            }

            updateLiveNavigation(totalDistance, totalDistance);



            // At destination: ONLY do idle animation (celebration hop briefly, then continuous idle breathing & waving)

            if (walkerEl) {

                walkerEl.className = 'mapboxgl-marker mapboxgl-marker-anchor-bottom route-walker-avatar mode-celebrate';

            }

            resetOcclusion();
            state.isWalking = false;
            if (typeof window.declutterMarkersForNavigation === 'function') {
                window.declutterMarkersForNavigation(false);
            }

            state.celebrationTimer = setTimeout(() => {

                if (state.walkerMarkerInstance && walkerEl && walkerEl.classList.contains('mode-celebrate')) {

                    walkerEl.className = 'mapboxgl-marker mapboxgl-marker-anchor-bottom route-walker-avatar mode-idle';

                }

            }, 2200);

            return;

        }



        const currentPoint = turf.along(routeLine, currentDistance, { units: 'meters' });

        const currentCoord = currentPoint.geometry.coordinates;



        // Auto-flip facing direction based on movement vector relative to SCREEN (not map longitude)

        if (state.currentWalkerCoord) {

            const pPrev = map.project(state.currentWalkerCoord);

            const pCurr = map.project(currentCoord);

            const screenDx = pCurr.x - pPrev.x;

            if (Math.abs(screenDx) > 0.3) {

                const wrap = walkerEl ? walkerEl.querySelector('.clay-svg-wrap') : null;

                if (wrap) {

                    wrap.style.transform = screenDx < 0 ? 'scaleX(-1)' : 'scaleX(1)';

                }

            }

        }

        state.currentWalkerCoord = currentCoord;

        if (state.walkerMarkerInstance) {

            state.walkerMarkerInstance.setLngLat(currentCoord);

        }



        try {

            if (currentDistance > 0.05 && map.getSource('route-source')) {

                // Throttle line slice buffer re-upload to avoid GPU bus saturation on low-end Intel HD Graphics

                if (!lastSliceDistance || (currentDistance - lastSliceDistance >= 1.8) || (totalDistance - currentDistance < 0.2)) {

                    lastSliceDistance = currentDistance;

                    const slicedLine = turf.lineSliceAlong(routeLine, 0, currentDistance, { units: 'meters' });

                    map.getSource('route-source').setData(slicedLine);

                }

            }

        } catch (err) {

            console.warn('Line slice notice:', err);

        }



        if (state.isFollowing) {

            if (state.cameraTransition) {

                const now = performance.now();

                const elapsed = now - state.cameraTransition.startTime;

                const progress = Math.min(elapsed / state.cameraTransition.duration, 1);



                // Smooth ease-out cubic curve (fast onset, gentle settle)

                const ease = 1 - Math.pow(1 - progress, 3);



                const curPitch = state.cameraTransition.startPitch + (state.cameraTransition.targetPitch - state.cameraTransition.startPitch) * ease;

                const curBearing = state.cameraTransition.startBearing + state.cameraTransition.bearingDiff * ease;

                const curZoom = state.cameraTransition.startZoom + (state.cameraTransition.targetZoom - state.cameraTransition.startZoom) * ease;



                map.jumpTo({

                    center: currentCoord,

                    pitch: curPitch,

                    bearing: curBearing,

                    zoom: curZoom

                });



                if (progress >= 1) {

                    state.cameraTransition = null;

                    state.isTransitioningToFollow = false;

                }

            } else if (!state.isTransitioningToFollow) {

                map.jumpTo({

                    center: currentCoord

                });

            }

        }



        // Smart 3D building occlusion: fade buildings blocking sightline to frosted glass

        try {

            updateOcclusion(currentCoord, state.activeRoute || state.selectedBuildingId);

        } catch (occErr) {

            console.warn('[Occlusion non-fatal]:', occErr);

        }



        try {

            updateLiveNavigation(currentDistance, totalDistance);

        } catch (navErr) {

            console.warn('[Nav update non-fatal]:', navErr);

        }



        state.walkAnimFrame = requestAnimationFrame(animateWalking);

    }



    // Camera reposition duration scaled dynamically to actual distance

    const curCenter = map.getCenter();

    const camDist = turf.distance([curCenter.lng, curCenter.lat], coords[0], { units: 'meters' });



    let camDuration = 350;

    if (camDist > 120) {

        camDuration = Math.min(1000, Math.round(camDist * 6));

    } else if (camDist > 50) {

        camDuration = Math.round(camDist * 6.5);

    } else if (camDist <= 25) {

        camDuration = 300;

    } else {

        camDuration = 350;

    }



    if (state.isFollowing) {

        const pitch = state.routeCameraPerspective === 'topdown' ? 0 : (state.routeCameraPerspective === 'overview' ? 48 : 68);

        const bearing = state.routeCameraPerspective === 'topdown' ? 0 : -20;

        const zoom = state.routeCameraPerspective === 'follow' ? 20.2 : 19.5;

        if (camDist <= 50) {

            map.easeTo({

                center: coords[0],

                zoom: zoom,

                pitch: pitch,

                bearing: bearing,

                duration: camDuration,

                essential: true

            });

        } else {

            map.flyTo({

                center: coords[0],

                zoom: zoom,

                pitch: pitch,

                bearing: bearing,

                duration: camDuration,

                essential: true

            });

        }

    } else {

        setRouteCameraMode(state.routeCameraMode || 'follow');

    }



    // Start walker immediately as camera settles

    const startDelay = Math.max(150, camDuration + 40);

    state.walkStartTimer = setTimeout(() => {

        lastTimestamp = null;

        if (walkerEl && !walkerEl.classList.contains('mode-celebrate')) {

            walkerEl.className = 'mapboxgl-marker mapboxgl-marker-anchor-bottom route-walker-avatar speed-' + state.routeSpeedMultiplier + 'x';

        }

        state.walkAnimFrame = requestAnimationFrame(animateWalking);

    }, startDelay);

}





export function drawRoute(coords, options = {}) {

    // Clear any previous route timers

    if (state.walkStartTimer) {

        clearTimeout(state.walkStartTimer);

        state.walkStartTimer = null;

    }

    if (state.celebrationTimer) {

        clearTimeout(state.celebrationTimer);

        state.celebrationTimer = null;

    }

    // Remove existing route and state.markers

    ['route-glow', 'route-casing', 'route-line', 'route-traveled-line', 'route-dots'].forEach(id => {

        try { if (map.getLayer(id)) map.removeLayer(id); } catch (e) { }

    });

    ['route-source', 'route-traveled-source'].forEach(id => {

        try { if (map.getSource(id)) map.removeSource(id); } catch (e) { }

    });

    if (state.routeAnimFrame) cancelAnimationFrame(state.routeAnimFrame);

    if (state.walkAnimFrame) cancelAnimationFrame(state.walkAnimFrame);

    if (state.walkerMarkerInstance) {

        state.walkerMarkerInstance.remove();

        state.walkerMarkerInstance = null;

    }

    if (state.destinationMarkerInstance) {

        state.destinationMarkerInstance.remove();

        state.destinationMarkerInstance = null;

    }

    // Clean up any existing destination flag pins from DOM and state.markers list

    document.querySelectorAll('.dest-pin-marker').forEach(el => {

        const parent = el.closest('.mapboxgl-marker');

        if (parent) parent.remove();

        else el.remove();

    });

    state.markers = state.markers.filter(m => {

        const el = m.getElement();

        if (el && (el.classList.contains('dest-marker') || el.querySelector('.dest-marker') || el.querySelector('.dest-pin-marker'))) {

            m.remove();

            return false;

        }

        return true;

    });



    if (coords.length < 2) return;



    state.activeRouteCoords = coords;

    state.activeFullRouteCoords = [...coords];

    state.currentWalkerCoord = coords[0];
    state.isWalking = true;
    if (typeof window.declutterMarkersForNavigation === 'function') {
        window.declutterMarkersForNavigation(true, state.activeRoute || state.selectedBuildingId);
    }



    // Only animate simulated walker on Kiosk; phones use live GPS or static preview

    const shouldAnimate = (options && options.animated !== undefined) ? options.animated : (!isPhoneMode());



    if (isPhoneMode()) {

        updatePhoneRouteUI(coords);
        if (shouldAnimate) {
            const fcc = document.getElementById('floating-camera-controls');
            if (fcc) {
                fcc.classList.add('active');
                fcc.classList.remove('dimmed', 'sheet-expanded-hidden', 'sheet-full-hidden');
            }
            updateCameraControlsUI();
        }

    } else {

        resetCameraModeToDefault();

        setRouteCameraMode('follow', true);

        // Show bottom floating camera controls and speed controls on kiosk

        const fcc = document.getElementById('floating-camera-controls');

        const fsc = document.getElementById('floating-speed-controls');

        if (fcc) {

            fcc.classList.add('active');

            fcc.classList.remove('dimmed');

        }

        if (fsc) {

            fsc.classList.add('active');

            fsc.classList.remove('dimmed');

        }

        resetCameraControlsTimer();

        // Give active route 100% of the sidebar space

        document.getElementById('sidebar')?.classList.add('route-active');

        // Hide bottom coordinates badge so it never overlaps the camera toolbar

        document.getElementById('coords-badge')?.classList.add('route-hidden');

    }



    // 1. Traveled (faded history) route layer

    map.addSource('route-traveled-source', {

        type: 'geojson',

        data: { type: 'FeatureCollection', features: [] }

    });

    map.addLayer({

        id: 'route-traveled-line',

        type: 'line',

        source: 'route-traveled-source',

        paint: {

            'line-color': '#94a3b8',

            'line-width': 5,

            'line-opacity': 0.35,

            'line-dasharray': [2, 2]

        },

        layout: {

            'line-cap': 'round',

            'line-join': 'round'

        }

    });



    // 2. Active route source

    const initialCoords = shouldAnimate ? [coords[0], coords[0]] : coords;

    map.addSource('route-source', {

        type: 'geojson',

        data: { type: 'Feature', geometry: { type: 'LineString', coordinates: initialCoords } }

    });



    // Glow layer (Emerald Green Ambience)

    map.addLayer({

        id: 'route-glow',

        type: 'line',

        source: 'route-source',

        paint: {

            'line-color': '#22c55e',

            'line-width': 20,

            'line-opacity': 0.35,

            'line-blur': 8

        }

    });



    // High-contrast dark casing layer under green line

    map.addLayer({

        id: 'route-casing',

        type: 'line',

        source: 'route-source',

        paint: {

            'line-color': '#020617',

            'line-width': 14,

            'line-opacity': 0.95

        },

        layout: {

            'line-cap': 'round',

            'line-join': 'round'

        }

    });



    // Main core route line (Vibrant green core)

    map.addLayer({

        id: 'route-line',

        type: 'line',

        source: 'route-source',

        paint: {

            'line-color': '#22c55e',

            'line-width': 8,

            'line-opacity': 1

        },

        layout: {

            'line-cap': 'round',

            'line-join': 'round'

        }

    });



    // Add animated pulsing destination marker

    if (state.destinationMarkerInstance) {

        state.destinationMarkerInstance.remove();

        state.destinationMarkerInstance = null;

    }

    const endCoord = coords[coords.length - 1];

    const destEl = document.createElement('div');

    destEl.className = 'dest-pin-marker dest-marker';

    destEl.innerHTML = `

        <div class="dest-pulse-ring"></div>

        <div class="dest-pin-badge">${lucideIcon('flag', 16)}</div>

    `;

    state.destinationMarkerInstance = new mapboxgl.Marker({ element: destEl, anchor: 'bottom' }).setLngLat(endCoord).addTo(map);

    state.markers.push(state.destinationMarkerInstance);



    // Animation Logic

    const routeLine = turf.lineString(coords);

    const totalDistance = turf.length(routeLine, { units: 'meters' });

    if (totalDistance <= 0) return;



    // Build Turn-by-Turn Steps

    const currentDestId = state.selectedBuildingId || window.selectedBuildingId || state.activeRoute;

    const destBuilding = BUILDING_DIRECTORY.find(b => b.id === currentDestId);

    state.currentRouteDestName = destBuilding ? destBuilding.name : 'Destination';

    state.currentRouteSteps = buildSteps(coords, BUILDING_DIRECTORY, currentDestId);

    renderStepsList(state.currentRouteSteps);



    // Declutter surrounding 3D building labels along this route corridor

    safeDeclutterLabelsForRoute(coords, currentDestId);



    if (shouldAnimate) {

        // Kiosk animated claymation stop-motion walker mode

        const walkerEl = document.createElement('div');

        walkerEl.className = 'mapboxgl-marker mapboxgl-marker-anchor-bottom route-walker-avatar mode-idle';

        walkerEl.innerHTML = `

            <span class="dust-puff">💨</span>

            <span class="speed-lines">⚡</span>

            <div class="clay-svg-wrap">

                <svg class="clay-svg" viewBox="0 0 60 76">

                    <defs>

                        <!-- Rice straw linear gradient for Salakot cone -->

                        <linearGradient id="salakotGrad" x1="0%" y1="0%" x2="100%" y2="100%">

                            <stop offset="0%" stop-color="#fef08a" />

                            <stop offset="35%" stop-color="#fde047" />

                            <stop offset="70%" stop-color="#eab308" />

                            <stop offset="100%" stop-color="#ca8a04" />

                        </linearGradient>

                        <!-- Salakot underside deep shadow -->

                        <linearGradient id="salakotUnder" x1="0%" y1="0%" x2="0%" y2="100%">

                            <stop offset="0%" stop-color="#92400e" />

                            <stop offset="100%" stop-color="#451a03" />

                        </linearGradient>

                        <!-- Denim overalls gradient -->

                        <linearGradient id="denimGrad" x1="0%" y1="0%" x2="100%" y2="100%">

                            <stop offset="0%" stop-color="#3b82f6" />

                            <stop offset="55%" stop-color="#1d4ed8" />

                            <stop offset="100%" stop-color="#1e3a8a" />

                        </linearGradient>

                        <!-- Yellow Farmer Rubber Gumboots -->

                        <linearGradient id="bootGrad" x1="0%" y1="0%" x2="100%" y2="100%">

                            <stop offset="0%" stop-color="#fde047" />

                            <stop offset="60%" stop-color="#eab308" />

                            <stop offset="100%" stop-color="#a16207" />

                        </linearGradient>

                    </defs>



                    <!-- Contact Shadow under feet (pivot 30, 72) -->

                    <ellipse class="clay-shadow" cx="30" cy="72" rx="16" ry="4.5" fill="#000" />

                    

                    <!-- BACK ARM (pivot 30, 29) -->

                    <g class="clay-limb-back-arm">

                        <!-- Upper sleeve (DA Green) -->

                        <path d="M 30 29 C 24 37, 20 44, 20 48" stroke="#15803d" stroke-width="8" stroke-linecap="round" fill="none" />

                        <!-- Rolled sleeve cuff -->

                        <circle cx="21" cy="46" r="4.5" fill="#166534" />

                        <!-- Forearm & Hand in friendly warm clay skin tone -->

                        <circle cx="19.5" cy="49" r="4.2" fill="#fde68a" />

                        <circle cx="21.5" cy="48" r="1.8" fill="#fcd34d" />

                    </g>



                    <!-- BACK LEG (pivot 30, 48) -->

                    <g class="clay-limb-back-leg">

                        <!-- Dark Denim Trousers -->

                        <path d="M 30 48 C 26 56, 24 64, 24 68" stroke="#1e3a8a" stroke-width="9" stroke-linecap="round" fill="none" />

                        <!-- Rolled pant cuff -->

                        <rect x="18.5" y="65.5" width="10" height="3" rx="1.5" fill="#60a5fa" />

                        <!-- Yellow Farmer Rubber Mud Boot (Bota) -->

                        <path d="M 18 67 C 18 64, 28 64, 29 67 L 30 71.5 L 17 71.5 Z" fill="url(#bootGrad)" />

                        <!-- Mud-grip black rubber sole -->

                        <rect x="16.5" y="70.5" width="14" height="3" rx="1.5" fill="#0f172a" />

                    </g>



                    <!-- BODY GROUP (Torso + Overalls + Bandana + Head with Squash & Stretch, pivot 30, 48) -->

                    <g class="clay-body-group">

                        <!-- DA Green Under-Shirt -->

                        <path d="M 23 26 C 21 34, 21 44, 25 49 C 29 51, 33 51, 36 48 C 39 42, 39 33, 37 26 Z" fill="#22c55e" />

                        

                        <!-- Denim Dungarees / Overalls -->

                        <path d="M 22.5 33.5 C 22 41, 22.5 47, 25.5 49.5 C 28.5 51.5, 33 51.5, 35.5 49 C 37.5 45, 38 40, 37.5 33.5 Z" fill="url(#denimGrad)" />

                        

                        <!-- Overalls Straps -->

                        <path d="M 24 27 L 25 35" stroke="#1d4ed8" stroke-width="2.6" stroke-linecap="round" />

                        <path d="M 36 27 L 35 35" stroke="#1d4ed8" stroke-width="2.6" stroke-linecap="round" />

                        

                        <!-- Golden Brass Buckles -->

                        <circle cx="25" cy="35" r="1.3" fill="#fbbf24" stroke="#78350f" stroke-width="0.5" />

                        <circle cx="35" cy="35" r="1.3" fill="#fbbf24" stroke="#78350f" stroke-width="0.5" />



                        <!-- Center Chest Pocket with Golden Stalk of Rice / Palay -->

                        <path d="M 26.5 38.5 H 33.5 V 43.5 C 33.5 44.8, 26.5 44.8, 26.5 43.5 Z" fill="#1e40af" stroke="#60a5fa" stroke-width="0.7" />

                        <!-- Rice / Palay Grain Stalk sticking out of pocket -->

                        <path d="M 31 38 Q 32.5 33.5 34.5 32" stroke="#eab308" stroke-width="1.3" stroke-linecap="round" fill="none" />

                        <ellipse cx="34.5" cy="32" rx="1.4" ry="0.8" transform="rotate(-30 34.5 32)" fill="#fef08a" />

                        <ellipse cx="33" cy="33.8" rx="1.2" ry="0.7" transform="rotate(-40 33 33.8)" fill="#facc15" />



                        <!-- Traditional Red Farmer Neck Bandana / Panyo sa Leeg -->

                        <path d="M 22 25 Q 30 29 38 25 Q 35 28 30 28.5 Q 25 28 22 25 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="0.6" />

                        <!-- Bandana Knot -->

                        <polygon points="28.5,28 31.5,28 32.5,32.5 29,31.5" fill="#dc2626" />



                        <!-- HEAD GROUP (Head + Expressive Full Face + Salakot, pivot 30, 15) -->

                        <g class="clay-head-group">

                            <!-- Friendly Rounded Clay Head -->

                            <ellipse cx="30" cy="18.5" rx="10" ry="9.5" fill="#fde68a" />

                            

                            <!-- Soft chin shading -->

                            <path d="M 23 22 C 25 27, 35 27, 37 22 Z" fill="#f59e0b" opacity="0.3" />



                            <!-- Cute Clay Ears -->

                            <circle cx="20" cy="19" r="2.2" fill="#fcd34d" />

                            <circle cx="40" cy="19" r="2.2" fill="#fcd34d" />



                            <!-- FULL ON EXPRESSIVE FACE (Clear, Bright & Cheerful) -->

                            <!-- Friendly Dark Chibi/Anime Eyes with Highlights -->

                            <!-- Left Eye -->

                            <ellipse cx="26" cy="18.2" rx="1.8" ry="2.4" fill="#0f172a" />

                            <circle cx="25.2" cy="17.2" r="0.9" fill="#ffffff" />

                            <circle cx="26.7" cy="19.3" r="0.45" fill="#ffffff" opacity="0.8" />



                            <!-- Right Eye -->

                            <ellipse cx="34" cy="18.2" rx="1.8" ry="2.4" fill="#0f172a" />

                            <circle cx="33.2" cy="17.2" r="0.9" fill="#ffffff" />

                            <circle cx="34.7" cy="19.3" r="0.45" fill="#ffffff" opacity="0.8" />



                            <!-- Playful Cheerful Eyebrows -->

                            <path d="M 23.8 14.5 Q 26.2 13 28.5 14.5" stroke="#78350f" stroke-width="1.3" stroke-linecap="round" fill="none" />

                            <path d="M 31.5 14.5 Q 33.8 13 36.2 14.5" stroke="#78350f" stroke-width="1.3" stroke-linecap="round" fill="none" />



                            <!-- Rosy Cheeks (Sun-warmed farmer glow) -->

                            <ellipse cx="23" cy="20.2" rx="2.3" ry="1.4" fill="#f43f5e" opacity="0.55" />

                            <ellipse cx="37" cy="20.2" rx="2.3" ry="1.4" fill="#f43f5e" opacity="0.55" />



                            <!-- Cute Button Nose -->

                            <circle cx="30" cy="19.4" r="0.95" fill="#f59e0b" />



                            <!-- Cheerful Open Smile with Rosy Tongue -->

                            <path d="M 27 21.5 Q 30 25.2 33 21.5 Z" fill="#991b1b" stroke="#78350f" stroke-width="0.8" stroke-linejoin="round" />

                            <path d="M 28.4 23.6 Q 30 25.2 31.6 23.6 Z" fill="#fb7185" />



                            <!-- SALAKOT (Authentic Filipino Conical Straw Rice Hat) -->

                            <!-- Chin tie strap (Tali ng Salakot) passing under chin -->

                            <path d="M 18 15 Q 23 25.5 30 26 Q 37 25.5 42 15" stroke="#78350f" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="0.85" />

                            <!-- Wood bead cinch on chin strap -->

                            <circle cx="30" cy="25.8" r="1.2" fill="#b45309" />



                            <!-- Forehead shadow cast by the wide brim -->

                            <ellipse cx="30" cy="16.5" rx="8.5" ry="2.2" fill="#78350f" opacity="0.32" />



                            <!-- Salakot Underside Dark Rattan Rim & Shading -->

                            <path d="M 8.5 14.5 C 16 17.5 44 17.5 51.5 14.5 C 47 18.5 13 18.5 8.5 14.5 Z" fill="url(#salakotUnder)" />



                            <!-- Salakot Conical Hat Dome -->

                            <path d="M 30 1.5 C 30 1.5, 41 7.8, 51.5 14.5 C 44 16.8, 16 16.8, 8.5 14.5 C 19 7.8, 30 1.5, 30 1.5 Z" fill="url(#salakotGrad)" stroke="#854d0e" stroke-width="1.2" stroke-linejoin="round" />



                            <!-- Woven Bamboo Ribs & Straw Texture Lines -->

                            <!-- Radial Bamboo Spoke Ribs -->

                            <line x1="30" y1="1.8" x2="30" y2="16" stroke="#78350f" stroke-width="0.9" opacity="0.45" />

                            <line x1="30" y1="1.8" x2="19" y2="15" stroke="#78350f" stroke-width="0.8" opacity="0.4" />

                            <line x1="30" y1="1.8" x2="41" y2="15" stroke="#78350f" stroke-width="0.8" opacity="0.4" />

                            <line x1="30" y1="1.8" x2="13" y2="14.2" stroke="#78350f" stroke-width="0.7" opacity="0.35" />

                            <line x1="30" y1="1.8" x2="47" y2="14.2" stroke="#78350f" stroke-width="0.7" opacity="0.35" />



                            <!-- Circular Woven Ring Wefts -->

                            <path d="M 23 6.2 Q 30 8.2 37 6.2" stroke="#92400e" stroke-width="0.8" fill="none" opacity="0.5" />

                            <path d="M 17 10.2 Q 30 12.8 43 10.2" stroke="#92400e" stroke-width="0.9" fill="none" opacity="0.55" />

                            <path d="M 11 13.8 Q 30 16.5 49 13.8" stroke="#92400e" stroke-width="1.0" fill="none" opacity="0.6" />



                            <!-- Top Crown Finial / Wood Cap -->

                            <ellipse cx="30" cy="1.8" rx="2.4" ry="1.5" fill="#78350f" stroke="#451a03" stroke-width="0.6" />

                            <circle cx="30" cy="1.0" r="1.1" fill="#b45309" />

                        </g>

                    </g>



                    <!-- FRONT LEG (pivot 30, 48) -->

                    <g class="clay-limb-front-leg">

                        <!-- Bright Denim Trousers -->

                        <path d="M 30 48 C 34 56, 36 64, 36 68" stroke="#2563eb" stroke-width="9" stroke-linecap="round" fill="none" />

                        <!-- Rolled pant cuff -->

                        <rect x="31" y="65.5" width="10" height="3" rx="1.5" fill="#93c5fd" />

                        <!-- Yellow Farmer Rubber Mud Boot (Bota) -->

                        <path d="M 30 67 C 30 64, 40 64, 41 67 L 42 71.5 L 29 71.5 Z" fill="url(#bootGrad)" />

                        <!-- Mud-grip black rubber sole -->

                        <rect x="28.5" y="70.5" width="14" height="3" rx="1.5" fill="#0f172a" />

                    </g>



                    <!-- FRONT ARM (pivot 30, 29) -->

                    <g class="clay-limb-front-arm">

                        <!-- Upper sleeve (DA Green) -->

                        <path d="M 30 29 C 36 37, 40 44, 40 48" stroke="#22c55e" stroke-width="8" stroke-linecap="round" fill="none" />

                        <!-- Rolled sleeve cuff -->

                        <circle cx="39" cy="46" r="4.5" fill="#15803d" />

                        <!-- Forearm & Hand in friendly warm clay skin tone -->

                        <circle cx="40.5" cy="49" r="4.2" fill="#fde68a" />

                        <circle cx="38.5" cy="48" r="1.8" fill="#fcd34d" />

                    </g>

                </svg>

            </div>

        `;

        state.walkerMarkerInstance = new mapboxgl.Marker({ 

            element: walkerEl,

            anchor: 'bottom',

            offset: [0, 4],

            pitchAlignment: 'viewport',

            rotationAlignment: 'viewport'

        }).setLngLat(coords[0]).addTo(map);

        if (state.walkerMarkerInstance.getElement()) {

            state.walkerMarkerInstance.getElement().style.zIndex = '120';

        }



        // Initialize facing direction relative to screen

        if (coords.length > 1) {

            const p0 = map.project(coords[0]);

            const p1 = map.project(coords[1]);

            const initialScreenDx = p1.x - p0.x;

            const wrap = walkerEl.querySelector('.clay-svg-wrap');

            if (wrap && Math.abs(initialScreenDx) > 0.4) {

                wrap.style.transform = initialScreenDx < 0 ? 'scaleX(-1)' : 'scaleX(1)';

            }

        }



        const banner = document.getElementById('turn-by-turn-banner');

        if (banner) {

            banner.classList.remove('arrived', 'is-long-dest');

            banner.classList.add('active');

        }



        resetStepsNavigation();

        updateLiveNavigation(0, totalDistance);



        launchWalkerLoop(coords, walkerEl, totalDistance, routeLine);

    } else {

        // Static / Live GPS mode (No automated walker)

        updateLiveNavigation(0, totalDistance);

        if (isPhoneMode() && state.currentRouteSteps && state.currentRouteSteps.length > 0) {

            updatePhoneLiveNavUI(0, totalDistance, state.currentRouteSteps[0], totalDistance, Math.round(totalDistance));

        }

    }

}



export function clearRoute() {

    if (typeof closeQRZoomModal === 'function') {

        closeQRZoomModal();

    } else if (typeof window.closeQRZoomModal === 'function') {

        window.closeQRZoomModal();

    }

    if (typeof stopPhoneLiveGPS === 'function') stopPhoneLiveGPS();

    if (state.walkStartTimer) {

        clearTimeout(state.walkStartTimer);

        state.walkStartTimer = null;

    }

    if (state.celebrationTimer) {

        clearTimeout(state.celebrationTimer);

        state.celebrationTimer = null;

    }

    ['route-glow', 'route-casing', 'route-line', 'route-traveled-line', 'route-dots'].forEach(id => {

        try { if (map.getLayer(id)) map.removeLayer(id); } catch (e) { }

    });

    ['route-source', 'route-traveled-source'].forEach(id => {

        try { if (map.getSource(id)) map.removeSource(id); } catch (e) { }

    });

    if (state.routeAnimFrame) cancelAnimationFrame(state.routeAnimFrame);

    if (state.walkAnimFrame) cancelAnimationFrame(state.walkAnimFrame);

    if (state.walkerMarkerInstance) {

        state.walkerMarkerInstance.remove();

        state.walkerMarkerInstance = null;

    }

    resetOcclusion();
            state.isWalking = false;
            if (typeof window.declutterMarkersForNavigation === 'function') {
                window.declutterMarkersForNavigation(false);
            }



    state.isTransitioningToFollow = false;

    state.cameraTransition = null;

    if (state.transitionFollowTimer) {

        clearTimeout(state.transitionFollowTimer);

        state.transitionFollowTimer = null;

    }



    // Remove destination state.markers

    if (state.destinationMarkerInstance) {

        state.destinationMarkerInstance.remove();

        state.destinationMarkerInstance = null;

    }

    document.querySelectorAll('.dest-pin-marker').forEach(el => {

        const parent = el.closest('.mapboxgl-marker');

        if (parent) parent.remove();

        else el.remove();

    });

    state.markers = state.markers.filter(m => {

        const el = m.getElement();

        if (el && (el.classList.contains('dest-marker') || el.querySelector('.dest-marker') || el.querySelector('.dest-pin-marker'))) {

            m.remove();

            return false;

        }

        return true;

    });



    // Clear turn-by-turn banner and steps

    const banner = document.getElementById('turn-by-turn-banner');

    if (banner) {

        banner.classList.remove('active', 'arrived', 'is-long-dest');

    }

    const fcc = document.getElementById('floating-camera-controls');

    const fsc = document.getElementById('floating-speed-controls');

    if (fcc) {

        fcc.classList.remove('active', 'dimmed');

    }

    if (fsc) {

        fsc.classList.remove('active', 'dimmed');

    }

    resetCameraModeToDefault();

    if (state.cameraControlsDimTimer) {

        clearTimeout(state.cameraControlsDimTimer);

        state.cameraControlsDimTimer = null;

    }

    safeClearArrivedCountdown();

    restoreLabels();

    document.getElementById('coords-badge')?.classList.remove('route-hidden');



    const stepsList = document.getElementById('route-steps-list');

    if (stepsList) stepsList.innerHTML = '';

    state.currentRouteSteps = null;

    state.lastActiveStepIdx = -1;



    const phoneSteps = document.getElementById('phone-steps-list');

    if (phoneSteps) phoneSteps.innerHTML = '';



    document.getElementById('route-info')?.classList.remove('active');

    document.getElementById('sidebar')?.classList.remove('route-active');

    document.body.classList.remove('has-active-route');


    state.isWalking = false;
    if (typeof window.declutterMarkersForNavigation === 'function') {
        window.declutterMarkersForNavigation(false);
    }
    state.activeRoute = null;

    state.activeRouteCoords = null;

    state.activeFullRouteCoords = null;

    state.currentWalkerCoord = null;

    state.isFollowing = true;

    state.routeCameraPerspective = 'follow';

    state.isMobileGPSActive = false;

    state.isUserFollowingGPS = false;

    document.getElementById('mobile-recenter-btn')?.classList.remove('active');

    const topHud = document.getElementById('phone-top-nav-hud');

    if (topHud) topHud.classList.remove('active');

    document.body.classList.remove('phone-nav-active');

    const sheet = document.getElementById('phone-bottom-sheet');

    if (sheet) sheet.classList.remove('route-active');

    state.routeSpeedMultiplier = 2;

    setRouteSpeed(2);

    updateCameraControlsUI();



    if (isPhoneMode()) {

        setPhoneSheetView('dir');

        setPhoneSheetSnap('peek');

    }

}



export function closeRouteAndReset() {

    if (typeof closeQRZoomModal === 'function') {

        closeQRZoomModal();

    } else if (typeof window.closeQRZoomModal === 'function') {

        window.closeQRZoomModal();

    }

    clearRoute();

    closeBuildingPanel();

}



// ==========================================

// BUILDING INFO PANEL

// ==========================================



export function buildRoadGraph(geojson) {

    const graph = new Map();

    // Spatial Hash Grid: ~5-meter cells (~0.00005 deg) for sub-millisecond vertex lookup

    const cellSize = 0.00005;

    const grid = new Map();



    function getSnappedKey(coord) {

        const gx = Math.floor(coord[0] / cellSize);

        const gy = Math.floor(coord[1] / cellSize);

        let nearestDist = Infinity;

        let nearestKey = null;



        // Check 3x3 surrounding cells

        for (let dx = -1; dx <= 1; dx++) {

            for (let dy = -1; dy <= 1; dy++) {

                const cell = grid.get(`${gx + dx}:${gy + dy}`);

                if (!cell) continue;

                for (let i = 0; i < cell.length; i++) {

                    const n = cell[i];

                    const dist = turf.distance(coord, n.coord, { units: 'meters' });

                    // Snap vertices that are within 0.5 meters of each other (prevents zigzags)

                    if (dist < 0.5 && dist < nearestDist) {

                        nearestDist = dist;

                        nearestKey = n.key;

                    }

                }

            }

        }

        if (nearestKey) return nearestKey;



        // Create new node and register into spatial grid

        const key = `${coord[0]},${coord[1]}`;

        if (!graph.has(key)) {

            graph.set(key, { coord, edges: [] });

        }

        const nodeItem = { key, coord };

        const gk = `${gx}:${gy}`;

        if (!grid.has(gk)) grid.set(gk, []);

        grid.get(gk).push(nodeItem);

        return key;

    }



    // Pass 1: Pre-register all true road vertices & junction endpoints first so 1-meter

    // turf.lineChunk subdivisions on side branches never pull straight main walkways into V-shaped pits.

    geojson.features.forEach(feature => {

        if (feature.geometry && feature.geometry.type === 'LineString') {

            feature.geometry.coordinates.forEach(coord => {

                getSnappedKey(coord);

            });

        }

    });



    function addEdge(coord1, coord2) {

        const key1 = getSnappedKey(coord1);

        const key2 = getSnappedKey(coord2);



        if (key1 === key2) return; // Prevent self-loop if segment is tiny



        const node1 = graph.get(key1);

        const node2 = graph.get(key2);

        const dist = turf.distance(node1.coord, node2.coord, { units: 'meters' });



        node1.edges.push({ to: key2, cost: dist });

        node2.edges.push({ to: key1, cost: dist });

    }



    geojson.features.forEach(feature => {

        if (feature.geometry.type === 'LineString') {

            // Break long lines into 1-meter chunks so they precisely follow the drawn lines without zigzags

            // and provide perfectly spaced nodes for building destinations to snap to without cutting corners

            try {

                const chunks = turf.lineChunk(feature, 1, { units: 'meters' });

                chunks.features.forEach(chunk => {

                    const coords = chunk.geometry.coordinates;

                    for (let i = 0; i < coords.length - 1; i++) {

                        addEdge(coords[i], coords[i + 1]);

                    }

                });

            } catch (e) {

                const coords = feature.geometry.coordinates;

                for (let i = 0; i < coords.length - 1; i++) {

                    addEdge(coords[i], coords[i + 1]);

                }

            }

        }

    });



    return graph;

}



export function findNearestNode(coord, graph) {

    let nearestKey = null;

    let minDist = Infinity;

    for (const [key, node] of graph.entries()) {

        const dist = turf.distance(coord, node.coord, { units: 'meters' });

        if (dist < minDist) {

            minDist = dist;

            nearestKey = key;

        }

    }

    return nearestKey;

}



export function findShortestPath(startCoord, endCoord, graph) {

    const startKey = findNearestNode(startCoord, graph);

    const endKey = findNearestNode(endCoord, graph);



    if (!startKey || !endKey) return null;



    const openSet = new Set([startKey]);

    const cameFrom = new Map();

    const gScore = new Map();

    const fScore = new Map();



    for (const key of graph.keys()) {

        gScore.set(key, Infinity);

        fScore.set(key, Infinity);

    }



    gScore.set(startKey, 0);

    fScore.set(startKey, turf.distance(graph.get(startKey).coord, graph.get(endKey).coord, { units: 'meters' }));



    while (openSet.size > 0) {

        let current = null;

        let lowestF = Infinity;

        for (const key of openSet) {

            const score = fScore.get(key);

            if (score < lowestF) {

                lowestF = score;

                current = key;

            }

        }



        if (current === endKey) {

            const path = [graph.get(current).coord];

            while (cameFrom.has(current)) {

                current = cameFrom.get(current);

                path.unshift(graph.get(current).coord);

            }

            return path;

        }



        openSet.delete(current);



        const neighbors = graph.get(current).edges;

        for (const neighbor of neighbors) {

            const tentativeGScore = gScore.get(current) + neighbor.cost;

            if (tentativeGScore < gScore.get(neighbor.to)) {

                cameFrom.set(neighbor.to, current);

                gScore.set(neighbor.to, tentativeGScore);

                const hScore = turf.distance(graph.get(neighbor.to).coord, graph.get(endKey).coord, { units: 'meters' });

                fScore.set(neighbor.to, tentativeGScore + hScore);

                openSet.add(neighbor.to);

            }

        }

    }

    return null;

}



export function computeRouteFromKiosk(buildingId) {

    const stationId = state.currentStationId || 'lares';

    const isQares = (stationId === 'qares');

    const station = STATIONS[stationId] || STATIONS.lares;

    const kioskCoords = isQares

        ? (state.QARES_KIOSK_COORDS || (station && station.kioskCoords) || [121.3713315, 13.9432268])

        : (state.KIOSK_COORDS || (station && station.kioskCoords) || SAVED_MAIN_KIOSK_COORDS);

    const building = (typeof getBuildingById === 'function') ? getBuildingById(buildingId) : BUILDING_DIRECTORY.find(b => b.id === buildingId);

    let zone = null;

    if (!building && typeof FIELD_COMMODITY_ZONES !== 'undefined') {

        zone = FIELD_COMMODITY_ZONES.find(z => z.id === buildingId);

    }

    if (!building && !zone) return [kioskCoords, kioskCoords];



    const ENTRANCE_OVERRIDES = {

        'mis_building': 'mis_rafis_building',

        'rafis_building': 'mis_rafis_building',

        'fod_building': 'lares_building',

        'bac_building': 'tanco_hall_building',

        'pmed_building': 'tanco_hall_building',

        'fmr': 'multi_purpose_administrative_building',

        'mis_data_center': 'multi_purpose_administrative_building',

        'vacant': 'multi_purpose_administrative_building',
        'warehouse_2': 'lares_farm_machinery_shed_1'

    };



    let targetBuildingId = building.id;

    if (ENTRANCE_OVERRIDES[targetBuildingId]) {

        targetBuildingId = ENTRANCE_OVERRIDES[targetBuildingId];

    }

    let targetCoords = null;

    let targetName = '';

    const targetBuilding = ((typeof getBuildingById === 'function') ? getBuildingById(targetBuildingId) : BUILDING_DIRECTORY.find(b => b.id === targetBuildingId)) || building;

    if (targetBuilding && (targetBuilding.coords || (building && building.coords))) {

        targetCoords = targetBuilding.coords || building.coords;

        targetName = targetBuilding.name;

    } else if (typeof FIELD_COMMODITY_ZONES !== 'undefined') {

        const zone = FIELD_COMMODITY_ZONES.find(z => z.id === targetBuildingId);

        if (zone) {

            targetCoords = zone.centerCoords;

            targetName = zone.name;

        }

    }

    if (!targetCoords) return [kioskCoords, kioskCoords];



    const activeGraph = isQares

        ? (state.qaresRoadGraph || state.roadGraph || window.roadGraph)

        : (state.laresRoadGraph || state.roadGraph || window.roadGraph);



    if (activeGraph && activeGraph.size > 0) {

        let bestPath = null;

        let minDistance = Infinity;



        const bEntrances = (typeof window !== 'undefined' && window.BUILDING_ENTRANCES && Object.keys(window.BUILDING_ENTRANCES).length > 0)

            ? window.BUILDING_ENTRANCES

            : (BUILDING_ENTRANCES || {});

        const entrances = bEntrances[targetBuildingId];

        if (entrances && entrances.length > 0) {

            entrances.forEach(ent => {

                const p = findShortestPath(kioskCoords, ent, activeGraph);

                if (p && p.length > 0) {

                    const pWithEntrance = [...p, ent];

                    const d = turf.length(turf.lineString([kioskCoords, ...pWithEntrance]), { units: 'meters' });

                    if (d < minDistance) {

                        minDistance = d;

                        bestPath = pWithEntrance;

                    }

                }

            });

        } else {

            bestPath = findShortestPath(kioskCoords, targetCoords, activeGraph);

        }



        if (bestPath && bestPath.length > 0) {

            return [kioskCoords, ...bestPath];

        }

    }

    return [kioskCoords, targetCoords];

}



export function getDirections() {
    const targetId = state.selectedBuildingId || window.selectedBuildingId;
    if (!targetId) return;

    // Plots are infographics only for now: navigation disabled
    if (typeof FIELD_COMMODITY_ZONES !== 'undefined' && FIELD_COMMODITY_ZONES.some(z => z.id === targetId)) {
        return;
    }
    if (targetId && (targetId.startsWith('zone_') || targetId.startsWith('plot_') || targetId.startsWith('plot17_') || targetId.startsWith('plot18_'))) {
        return;
    }

    let targetName = '';
    const building = (typeof getBuildingById === 'function') ? getBuildingById(targetId) : BUILDING_DIRECTORY.find(b => b.id === targetId);
    if (building) {
        targetName = building.name;
    }
    if (!targetName) return;



    stopOrbit();



    const routeCoords = computeRouteFromKiosk(targetId);

    if (!routeCoords || routeCoords.length < 2) return;

    const routeLine = turf.lineString(routeCoords);

    const routeDistance = turf.length(routeLine, { units: 'meters' });

    const routeWalkTime = Math.ceil(routeDistance / 80) || 1;



    // Draw route on map first (which clears previous route and adds route-active to sidebar)

    state.currentRouteDestId = targetId;

    state.currentRouteDestName = targetName;

    document.body.classList.remove('has-active-bldg-panel');

    document.body.classList.add('has-active-route');



    drawRoute(routeCoords);

    state.activeRoute = targetId;



    // Show route info bar in sidebar

    const destEl = document.getElementById('route-dest');

    if (destEl) destEl.textContent = targetName;

    const metaEl = document.getElementById('route-meta');

    if (metaEl) {

        metaEl.innerHTML =

            `<span class="rm-stat">${lucideIcon('ruler', 13)} ${Math.round(routeDistance)}m</span>` +

            `<span class="rm-stat">${lucideIcon('footprints', 13)} ~${routeWalkTime} min walk</span>`;

    }

    document.getElementById('route-info')?.classList.add('active');

    updateRouteQR(targetId);



    // Close the building panel
    document.getElementById('building-panel')?.classList.remove('active');

    // In portrait kiosk mode, default the route menu to folded so the screen shows the clean 3D navigation view (Picture 2)
    if (document.body.classList.contains('kiosk-portrait')) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('collapsed');
            document.body.classList.add('sidebar-collapsed');
            if (typeof updateSidebarToggleIcon === 'function') {
                updateSidebarToggleIcon();
            } else if (typeof window.updateSidebarToggleIcon === 'function') {
                window.updateSidebarToggleIcon();
            }
        }
    }

}



export function replayRoute() {

    if (!state.activeRoute) return;

    safeClearArrivedCountdown();



    if (state.walkStartTimer) {

        clearTimeout(state.walkStartTimer);

        state.walkStartTimer = null;

    }

    if (state.celebrationTimer) {

        clearTimeout(state.celebrationTimer);

        state.celebrationTimer = null;

    }

    if (state.walkAnimFrame) {

        cancelAnimationFrame(state.walkAnimFrame);

        state.walkAnimFrame = null;

    }



    const coords = state.activeRouteCoords;

    const walkerEl = state.walkerMarkerInstance ? state.walkerMarkerInstance.getElement() : null;

    const routeSource = map.getSource('route-source');

    const traveledSource = map.getSource('route-traveled-source');



    if (coords && coords.length >= 2 && walkerEl && routeSource && traveledSource) {

        // Fast in-place rewind: zero layer destruction, zero WebGL shader recompile

        routeSource.setData({

            type: 'Feature',

            geometry: { type: 'LineString', coordinates: [coords[0], coords[0]] }

        });

        traveledSource.setData({

            type: 'FeatureCollection',

            features: []

        });



        state.currentWalkerCoord = coords[0];
    state.isWalking = true;
    if (typeof window.declutterMarkersForNavigation === 'function') {
        window.declutterMarkersForNavigation(true, state.activeRoute || state.selectedBuildingId);
    }

        state.walkerMarkerInstance.setLngLat(coords[0]);

        walkerEl.className = 'mapboxgl-marker mapboxgl-marker-anchor-bottom route-walker-avatar mode-idle';



        if (coords.length > 1) {

            const p0 = map.project(coords[0]);

            const p1 = map.project(coords[1]);

            const initialScreenDx = p1.x - p0.x;

            const wrap = walkerEl.querySelector('.clay-svg-wrap');

            if (wrap && Math.abs(initialScreenDx) > 0.4) {

                wrap.style.transform = initialScreenDx < 0 ? 'scaleX(-1)' : 'scaleX(1)';

            }

        }



        const banner = document.getElementById('turn-by-turn-banner');

        if (banner) {

            banner.classList.remove('arrived', 'is-long-dest');

            banner.classList.add('active');

        }

        resetStepsNavigation();



        const routeLine = turf.lineString(coords);

        const totalDistance = turf.length(routeLine, { units: 'meters' });

        updateLiveNavigation(0, totalDistance);



        state.isFollowing = true;
        state.cameraTransition = null;
        state.isTransitioningToFollow = false;

        resetCameraModeToDefault();
        setRouteCameraMode('follow', true);

        // Dismiss post-arrival prompt cards
            const arrivedCard = document.getElementById('route-arrived-card');
        if (arrivedCard) arrivedCard.style.display = 'none';

        // Restore floating camera controls and speed controls on kiosk
        const fcc = document.getElementById('floating-camera-controls');
        const fsc = document.getElementById('floating-speed-controls');
        if (fcc) {
            fcc.classList.add('active');
            fcc.classList.remove('dimmed');
        }
        if (fsc) {
            fsc.classList.add('active');
            fsc.classList.remove('dimmed');
        }
        resetCameraControlsTimer();

        // Re-center camera cleanly back to starting coordinate
        if (map && coords && coords.length > 0) {
            map.jumpTo({
                center: coords[0]
            });
        }

        updateCameraControlsUI();

        launchWalkerLoop(coords, walkerEl, totalDistance, routeLine);
        return;

    }



    clearRoute();

    getDirections();

}



// ==========================================

// KIOSK — "YOU ARE HERE" MARKER

// ==========================================

let kioskMarkerInstance = null;

let isKioskDraggable = false;



window.toggleKioskLock = function (e) {

    if (!state.isAdmin) return;

    if (e) e.stopPropagation();

    isKioskDraggable = (state.isKioskDraggable === false);

    state.isKioskDraggable = isKioskDraggable;

    const isQares = (state.currentStationId === 'qares');
    const isRares = (state.currentStationId === 'rares');
    const prefix = isQares ? 'QARES • ' : isRares ? 'RARES • ' : '';

    const label = document.querySelector('.kiosk-marker-label');

    if (label) {

        if (isKioskDraggable) {

            label.innerHTML = `${lucideIcon('map-pin', 13)} ${prefix}You Are Here ${lucideIcon('unlock', 12)} (Drag to move)`;

            label.style.background = '#eab308';

            label.style.color = '#000';

            label.style.border = '1px solid #ca8a04';

        } else {

            label.innerHTML = `${lucideIcon('map-pin', 13)} ${prefix}You Are Here ${lucideIcon('lock', 12)} (Admin)`;

            label.style.background = 'rgba(15, 23, 42, .9)';

            label.style.color = '#22c55e';

            label.style.border = '1px solid rgba(34, 197, 94, .3)';

        }

    }

    const marker = state.kioskMarkerInstance || kioskMarkerInstance;

    if (marker) {

        marker.setDraggable(isKioskDraggable);

        const markerEl = marker.getElement();

        if (markerEl) {

            markerEl.style.cursor = isKioskDraggable ? 'grab' : 'pointer';

        }

    }

}





export function smoothRouteCoords(coords) {

    if (!coords || coords.length < 3) return coords;

    try {

        const line = turf.lineString(coords);

        const curved = turf.bezierSpline(line, { sharpness: 0.75 });

        if (curved && curved.geometry && curved.geometry.coordinates && curved.geometry.coordinates.length >= 2) {

            return curved.geometry.coordinates;

        }

    } catch (err) {

        console.warn('Bezier spline notice:', err);

    }

    return coords;

}



// --- Mobile Bottom Sheet State Machine ---

let phoneSheetCurrentSnap = 'peek'; // 'peek' | 'half' | 'full'

let phoneSheetCurrentView = 'dir';  // 'dir' | 'bldg' | 'route' | 'arrived'

let phoneCurrentCategory = 'all';





export function drawCampusRouteFromKiosk(buildingId) {

    const building = BUILDING_DIRECTORY.find(b => b.id === buildingId);

    if (!building) return;



    const routeCoords = computeRouteFromKiosk(buildingId);

    state.activeFullRouteCoords = routeCoords;

    drawRoute(routeCoords, { animated: false });



    const routeLine = turf.lineString(routeCoords);

    const bbox = turf.bbox(routeLine);

    map.fitBounds(bbox, {

        padding: getResponsiveMapPadding(),

        maxZoom: 19.5,

        pitch: 45,

        duration: 1200

    });

}





window.buildRoadGraph = buildRoadGraph;

window.findNearestNode = findNearestNode;

window.findShortestPath = findShortestPath;

window.computeRouteFromKiosk = computeRouteFromKiosk;

window.drawRoute = drawRoute;

window.clearRoute = clearRoute;

window.closeRouteAndReset = closeRouteAndReset;

window.getDirections = getDirections;

window.replayRoute = replayRoute;

window.smoothRouteCoords = smoothRouteCoords;

window.drawCampusRouteFromKiosk = drawCampusRouteFromKiosk;



