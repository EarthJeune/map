// DA-LARES Routing & Graph Pathfinding Module
// A* / Dijkstra shortest path, road network graph, route drawing, and smoothing.

import { BUILDING_DIRECTORY } from './data/buildings.js?v=5';
import { state } from './data/state.js?v=5';
import { map } from './map-setup.js?v=5';
import { buildSteps, renderStepsList } from './steps.js?v=5';
import { clearArrivedCountdown, declutterLabelsForRoute, restoreLabels } from './walker.js?v=5';
import { closeBuildingPanel } from './building-panel.js?v=5';

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


export function drawRoute(coords, options = {}) {
    // Remove existing route and markers
    ['route-glow', 'route-casing', 'route-line', 'route-traveled-line', 'route-dots'].forEach(id => {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch (e) { }
    });
    ['route-source', 'route-traveled-source'].forEach(id => {
        try { if (map.getSource(id)) map.removeSource(id); } catch (e) { }
    });
    if (routeAnimFrame) cancelAnimationFrame(routeAnimFrame);
    if (walkAnimFrame) cancelAnimationFrame(walkAnimFrame);
    if (walkerMarkerInstance) {
        walkerMarkerInstance.remove();
        walkerMarkerInstance = null;
    }
    if (destinationMarkerInstance) {
        destinationMarkerInstance.remove();
        destinationMarkerInstance = null;
    }
    // Clean up any existing destination flag pins from DOM and markers list
    document.querySelectorAll('.dest-pin-marker').forEach(el => {
        const parent = el.closest('.mapboxgl-marker');
        if (parent) parent.remove();
        else el.remove();
    });
    markers = markers.filter(m => {
        const el = m.getElement();
        if (el && (el.classList.contains('dest-marker') || el.querySelector('.dest-marker') || el.querySelector('.dest-pin-marker'))) {
            m.remove();
            return false;
        }
        return true;
    });

    if (coords.length < 2) return;

    activeRouteCoords = coords;
    activeFullRouteCoords = [...coords];
    currentWalkerCoord = coords[0];

    // Only animate simulated walker on Kiosk; phones use live GPS or static preview
    const shouldAnimate = (options && options.animated !== undefined) ? options.animated : (!isPhoneMode());

    if (isPhoneMode()) {
        updatePhoneRouteUI(coords);
    } else {
        routeCameraMode = 'follow';
        setRouteCameraMode('follow');
        // Show bottom floating camera controls on kiosk
        const fcc = document.getElementById('floating-camera-controls');
        if (fcc) {
            fcc.classList.add('active');
            fcc.classList.remove('dimmed');
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
    if (destinationMarkerInstance) {
        destinationMarkerInstance.remove();
        destinationMarkerInstance = null;
    }
    const endCoord = coords[coords.length - 1];
    const destEl = document.createElement('div');
    destEl.className = 'dest-pin-marker dest-marker';
    destEl.innerHTML = `
        <div class="dest-pulse-ring"></div>
        <div class="dest-pin-badge">🏁</div>
    `;
    destinationMarkerInstance = new mapboxgl.Marker({ element: destEl, anchor: 'bottom' }).setLngLat(endCoord).addTo(map);
    markers.push(destinationMarkerInstance);

    // Animation Logic
    const routeLine = turf.lineString(coords);
    const totalDistance = turf.length(routeLine, { units: 'meters' });
    if (totalDistance <= 0) return;

    // Build Turn-by-Turn Steps
    const destBuilding = BUILDING_DIRECTORY.find(b => b.id === selectedBuildingId);
    currentRouteDestName = destBuilding ? destBuilding.name : 'Destination';
    currentRouteSteps = buildSteps(coords, BUILDING_DIRECTORY, selectedBuildingId);
    renderStepsList(currentRouteSteps);

    // Declutter surrounding 3D building labels along this route corridor
    safeDeclutterLabelsForRoute(coords, selectedBuildingId);

    if (shouldAnimate) {
        // Kiosk animated claymation stop-motion walker mode
        const walkerEl = document.createElement('div');
        walkerEl.className = 'route-walker-avatar mode-idle';
        walkerEl.innerHTML = `
            <span class="dust-puff">💨</span>
            <span class="speed-lines">⚡</span>
            <div class="clay-svg-wrap">
                <svg class="clay-svg" viewBox="0 0 60 76">
                    <!-- Contact Shadow under feet -->
                    <ellipse class="clay-shadow" cx="30" cy="72" rx="16" ry="4.5" fill="#000" />
                    
                    <!-- BACK ARM (thick, rounded clay) -->
                    <g class="clay-limb-back-arm">
                        <path d="M 30 29 C 24 37, 20 44, 20 48" stroke="#15803d" stroke-width="8" stroke-linecap="round" fill="none" />
                        <circle cx="20" cy="48" r="4.5" fill="#f8fafc" />
                    </g>

                    <!-- BACK LEG (thick chunky clay) -->
                    <g class="clay-limb-back-leg">
                        <path d="M 30 48 C 26 56, 24 64, 24 70" stroke="#0f172a" stroke-width="9" stroke-linecap="round" fill="none" />
                        <path d="M 20 71 C 20 67, 30 67, 30 71 Z" fill="#ef4444" />
                        <rect x="18" y="70.5" width="13" height="3" rx="1.5" fill="#f8fafc" />
                    </g>

                    <!-- BODY GROUP (Torso + Head with Squash & Stretch) -->
                    <g class="clay-body-group">
                        <!-- Clay Torso (Plump, Kiosk Green) -->
                        <path d="M 23 26 C 21 34, 21 44, 25 49 C 29 51, 33 51, 36 48 C 39 42, 39 33, 37 26 Z" fill="#22c55e" />
                        <!-- Torso Highlight -->
                        <path d="M 25 28 C 23 34, 23 42, 26 46" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linecap="round" fill="none" />

                        <!-- Head Group with Looking Around capability -->
                        <g class="clay-head-group">
                            <!-- Chunky Clay Head -->
                            <ellipse cx="30" cy="15" rx="11" ry="11" fill="#f8fafc" />
                            <!-- Soft shaded underside of head -->
                            <path d="M 21 18 C 24 25, 36 25, 39 18 Z" fill="#cbd5e1" opacity="0.6" />
                            <!-- Clay Green Cap / Visor -->
                            <path d="M 19 14 C 20 7, 38 6, 41 12 C 43 14, 45 15, 46 16 C 43 18, 38 18, 36 17 C 32 16, 21 16, 19 14 Z" fill="#16a34a" />
                            <!-- Handmade thumbprint / seam detail -->
                            <path d="M 26 12 C 28 10, 31 11, 33 13" stroke="rgba(0,0,0,0.18)" stroke-width="1.2" stroke-linecap="round" fill="none" />
                        </g>
                    </g>

                    <!-- FRONT LEG -->
                    <g class="clay-limb-front-leg">
                        <path d="M 30 48 C 34 56, 36 64, 36 70" stroke="#1e293b" stroke-width="9" stroke-linecap="round" fill="none" />
                        <path d="M 32 71 C 32 67, 42 67, 42 71 Z" fill="#ef4444" />
                        <rect x="30" y="70.5" width="13" height="3" rx="1.5" fill="#f8fafc" />
                    </g>

                    <!-- FRONT ARM -->
                    <g class="clay-limb-front-arm">
                        <path d="M 30 29 C 36 37, 40 44, 40 48" stroke="#22c55e" stroke-width="8" stroke-linecap="round" fill="none" />
                        <circle cx="40" cy="48" r="4.5" fill="#f8fafc" />
                    </g>
                </svg>
            </div>
        `;
        walkerMarkerInstance = new mapboxgl.Marker({ 
            element: walkerEl,
            anchor: 'bottom',
            offset: [0, -72],
            pitchAlignment: 'viewport',
            rotationAlignment: 'viewport'
        }).setLngLat(coords[0]).addTo(map);
        if (walkerMarkerInstance.getElement()) {
            walkerMarkerInstance.getElement().style.zIndex = '120';
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
            banner.classList.remove('arrived');
            banner.classList.add('active');
        }

        updateLiveNavigation(0, totalDistance);

        let currentDistance = 0;
        const baseSpeedMps = 6.0;
        let lastTimestamp = null;

        if (routeCameraMode === 'follow') {
            map.flyTo({
                center: coords[0],
                zoom: 20.2,
                pitch: 68,
                bearing: -20,
                duration: 1500,
                essential: true
            });
        } else {
            setRouteCameraMode(routeCameraMode);
        }

        function animateWalking(timestamp) {
            if (!lastTimestamp) lastTimestamp = timestamp;
            let dt = (timestamp - lastTimestamp) / 1000;
            lastTimestamp = timestamp;
            if (dt > 0.1 || dt <= 0) dt = 0.016;

            currentDistance += baseSpeedMps * routeSpeedMultiplier * dt;

            if (currentDistance >= totalDistance) {
                currentDistance = totalDistance;
                map.getSource('route-source').setData({
                    type: 'Feature', geometry: { type: 'LineString', coordinates: coords }
                });
                walkerMarkerInstance.setLngLat(coords[coords.length - 1]);
                updateLiveNavigation(totalDistance, totalDistance);

                // At destination: ONLY do idle animation (celebration hop briefly, then continuous idle breathing & waving)
                walkerEl.className = 'route-walker-avatar mode-celebrate';
                setTimeout(() => {
                    if (walkerMarkerInstance && walkerEl.classList.contains('mode-celebrate')) {
                        walkerEl.className = 'route-walker-avatar mode-idle';
                    }
                }, 2200);
                return;
            }

            const currentPoint = turf.along(routeLine, currentDistance, { units: 'meters' });
            const currentCoord = currentPoint.geometry.coordinates;

            // Auto-flip facing direction based on movement vector relative to SCREEN (not map longitude)
            // Uses map.project() so it accurately reflects left/right on screen regardless of camera rotation or Follow mode
            if (currentWalkerCoord) {
                const pPrev = map.project(currentWalkerCoord);
                const pCurr = map.project(currentCoord);
                const screenDx = pCurr.x - pPrev.x;
                if (Math.abs(screenDx) > 0.3) {
                    const wrap = walkerEl.querySelector('.clay-svg-wrap');
                    if (wrap) {
                        wrap.style.transform = screenDx < 0 ? 'scaleX(-1)' : 'scaleX(1)';
                    }
                }
            }
            currentWalkerCoord = currentCoord;
            walkerMarkerInstance.setLngLat(currentCoord);

            const slicedLine = turf.lineSliceAlong(routeLine, 0.0001, currentDistance, { units: 'meters' });
            map.getSource('route-source').setData(slicedLine);

            if (routeCameraMode === 'follow' && !isTransitioningToFollow) {
                map.jumpTo({
                    center: currentCoord
                });
            }

            updateLiveNavigation(currentDistance, totalDistance);
            walkAnimFrame = requestAnimationFrame(animateWalking);
        }

        // Start animation after camera reaches the start (switches from mode-idle to running at selected speed)
        setTimeout(() => {
            lastTimestamp = null;
            if (walkerEl && !walkerEl.classList.contains('mode-celebrate')) {
                walkerEl.className = 'route-walker-avatar speed-' + routeSpeedMultiplier + 'x';
            }
            walkAnimFrame = requestAnimationFrame(animateWalking);
        }, 1600);
    } else {
        // Static / Live GPS mode (No automated walker)
        updateLiveNavigation(0, totalDistance);
        if (isPhoneMode() && currentRouteSteps && currentRouteSteps.length > 0) {
            updatePhoneLiveNavUI(0, totalDistance, currentRouteSteps[0], totalDistance, Math.round(totalDistance));
        }
    }
}

export function clearRoute() {
    if (typeof stopPhoneLiveGPS === 'function') stopPhoneLiveGPS();
    ['route-glow', 'route-casing', 'route-line', 'route-traveled-line', 'route-dots'].forEach(id => {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch (e) { }
    });
    ['route-source', 'route-traveled-source'].forEach(id => {
        try { if (map.getSource(id)) map.removeSource(id); } catch (e) { }
    });
    if (routeAnimFrame) cancelAnimationFrame(routeAnimFrame);
    if (walkAnimFrame) cancelAnimationFrame(walkAnimFrame);
    if (walkerMarkerInstance) {
        walkerMarkerInstance.remove();
        walkerMarkerInstance = null;
    }

    isTransitioningToFollow = false;
    if (transitionFollowTimer) {
        clearTimeout(transitionFollowTimer);
        transitionFollowTimer = null;
    }

    // Remove destination markers
    if (destinationMarkerInstance) {
        destinationMarkerInstance.remove();
        destinationMarkerInstance = null;
    }
    document.querySelectorAll('.dest-pin-marker').forEach(el => {
        const parent = el.closest('.mapboxgl-marker');
        if (parent) parent.remove();
        else el.remove();
    });
    markers = markers.filter(m => {
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
        banner.classList.remove('active', 'arrived');
    }
    const fcc = document.getElementById('floating-camera-controls');
    if (fcc) {
        fcc.classList.remove('active', 'dimmed');
    }
    if (cameraControlsDimTimer) {
        clearTimeout(cameraControlsDimTimer);
        cameraControlsDimTimer = null;
    }
    safeClearArrivedCountdown();
    restoreLabels();
    document.getElementById('coords-badge')?.classList.remove('route-hidden');

    const stepsList = document.getElementById('route-steps-list');
    if (stepsList) stepsList.innerHTML = '';
    currentRouteSteps = null;
    lastActiveStepIdx = -1;

    const phoneSteps = document.getElementById('phone-steps-list');
    if (phoneSteps) phoneSteps.innerHTML = '';

    document.getElementById('route-info')?.classList.remove('active');
    document.getElementById('sidebar')?.classList.remove('route-active');
    activeRoute = null;
    activeRouteCoords = null;
    activeFullRouteCoords = null;
    currentWalkerCoord = null;
    isMobileGPSActive = false;
    isUserFollowingGPS = false;
    document.getElementById('mobile-recenter-btn')?.classList.remove('active');
    const topHud = document.getElementById('phone-top-nav-hud');
    if (topHud) topHud.classList.remove('active');
    document.body.classList.remove('phone-nav-active');
    const sheet = document.getElementById('phone-bottom-sheet');
    if (sheet) sheet.classList.remove('route-active');
    routeSpeedMultiplier = 2;
    setRouteSpeed(2);

    if (isPhoneMode()) {
        setPhoneSheetView('dir');
        setPhoneSheetSnap('peek');
    }
}

export function closeRouteAndReset() {
    clearRoute();
    closeBuildingPanel();
}

// ==========================================
// BUILDING INFO PANEL
// ==========================================

export function buildRoadGraph(geojson) {
    const graph = new Map();
    const nodeCoords = []; // Store assigned keys and actual coordinates

    function getSnappedKey(coord) {
        let nearestDist = Infinity;
        let nearestKey = null;
        for (const n of nodeCoords) {
            const dist = turf.distance(coord, n.coord, { units: 'meters' });
            // Snap vertices that are within 0.5 meters of each other (prevents zigzags)
            if (dist < 0.5) {
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestKey = n.key;
                }
            }
        }
        if (nearestKey) return nearestKey;
        // Create new node
        const key = `${coord[0]},${coord[1]}`;
        nodeCoords.push({ key: key, coord: coord });
        return key;
    }

    function addEdge(coord1, coord2) {
        const key1 = getSnappedKey(coord1);
        const key2 = getSnappedKey(coord2);

        if (key1 === key2) return; // Prevent self-loop if segment is tiny

        if (!graph.has(key1)) graph.set(key1, { coord: coord1, edges: [] });
        if (!graph.has(key2)) graph.set(key2, { coord: coord2, edges: [] });

        const dist = turf.distance(coord1, coord2, { units: 'meters' });

        graph.get(key1).edges.push({ to: key2, cost: dist });
        graph.get(key2).edges.push({ to: key1, cost: dist });
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
    const building = BUILDING_DIRECTORY.find(b => b.id === buildingId);
    if (!building) return [KIOSK_COORDS, KIOSK_COORDS];

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
    const targetBuilding = BUILDING_DIRECTORY.find(b => b.id === targetBuildingId) || building;
    const targetCoords = targetBuilding.coords;

    if (roadGraph && roadGraph.size > 0) {
        let bestPath = null;
        let minDistance = Infinity;

        const entrances = BUILDING_ENTRANCES[targetBuildingId];
        if (entrances && entrances.length > 0) {
            entrances.forEach(ent => {
                const p = findShortestPath(KIOSK_COORDS, ent, roadGraph);
                if (p && p.length > 0) {
                    const pWithEntrance = [...p, ent];
                    const d = turf.length(turf.lineString([KIOSK_COORDS, ...pWithEntrance]), { units: 'meters' });
                    if (d < minDistance) {
                        minDistance = d;
                        bestPath = pWithEntrance;
                    }
                }
            });
        } else {
            bestPath = findShortestPath(KIOSK_COORDS, targetCoords, roadGraph);
        }

        if (bestPath && bestPath.length > 0) {
            return [KIOSK_COORDS, ...bestPath];
        }
    }
    return [KIOSK_COORDS, building.coords];
}

export function getDirections() {
    if (!selectedBuildingId) return;
    const building = BUILDING_DIRECTORY.find(b => b.id === selectedBuildingId);
    if (!building) return;

    stopOrbit();

    const routeCoords = computeRouteFromKiosk(building.id);
    const routeLine = turf.lineString(routeCoords);
    const routeDistance = turf.length(routeLine, { units: 'meters' });
    const routeWalkTime = Math.ceil(routeDistance / 80) || 1;

    // Show route info bar
    document.getElementById('route-dest').textContent = building.name;
    document.getElementById('route-meta').innerHTML =
        `<span class="rm-stat">📏 ${Math.round(routeDistance)}m</span>` +
        `<span class="rm-stat">🚶 ~${routeWalkTime} min walk</span>`;
    document.getElementById('route-info').classList.add('active');

    // Draw route on map
    drawRoute(routeCoords);
    activeRoute = selectedBuildingId;

    // Close the building panel
    document.getElementById('building-panel').classList.remove('active');
}

export function replayRoute() {
    if (activeRoute) {
        safeClearArrivedCountdown();
        clearRoute();
        getDirections();
    }
}

// ==========================================
// KIOSK — "YOU ARE HERE" MARKER
// ==========================================
let kioskMarkerInstance = null;
let isKioskDraggable = false;

window.toggleKioskLock = function (e) {
    if (e) e.stopPropagation();
    isKioskDraggable = !isKioskDraggable;
    const label = document.querySelector('.kiosk-marker-label');
    if (label) {
        if (isKioskDraggable) {
            label.innerHTML = '📍 You Are Here 🔓 (Drag to move)';
            label.style.background = '#eab308';
            label.style.color = '#000';
            label.style.border = '1px solid #ca8a04';
        } else {
            label.innerHTML = '📍 You Are Here 🔒';
            label.style.background = 'rgba(15, 23, 42, .9)';
            label.style.color = '#22c55e';
            label.style.border = '1px solid rgba(34, 197, 94, .3)';
        }
    }
    if (kioskMarkerInstance) {
        kioskMarkerInstance.setDraggable(isKioskDraggable);
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
    activeFullRouteCoords = routeCoords;
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

