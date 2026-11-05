// DA-CALABARZON Multi-Station Wayfinding Manager
// Manages station selection, lag-free regional camera flyovers, and station data hydration.

import { STATIONS, DEFAULT_STATION_ID, getActiveStationDefaultView, getStationIntroViews } from './data/stations.js';
import { state } from './data/state.js';
import { map, stopIntroAnimation, playIntroAnimation, setupMapboxStandardLayers } from './map-setup.js';
import { INTRO_START_VIEW } from './data/config.js';
import { buildDirectory } from './sidebar.js';
import { removeMarkers, createMarkers, createEntranceArrowMarker, removeSectionBadges } from './markers.js';
import { createKioskMarker, stopIdleRotation, resetIdle } from './idle.js';
import { buildRoadGraph } from './routing.js';
import { QARES_MASK } from './data/geo.js';
import { lucideIcon } from './data/icons.js';

let activeFlyNotificationTimer = null;
let activeStationSwitchTimer = null;
let activeCurtainDismissTimer = null;
let activeStationSwitchSafetyTimer = null;

export function initStationSelector() {
    const activeStationId = state.currentStationId || DEFAULT_STATION_ID;
    updateStationUI(activeStationId);
    renderStationCategoryBar(activeStationId);

    // Click-outside listener to close dropdown
    document.addEventListener('click', (e) => {
        const flyout = document.getElementById('station-dropdown-flyout');
        const btn = document.getElementById('station-dropdown-btn');
        if (flyout && flyout.classList.contains('active')) {
            if (!flyout.contains(e.target) && !btn.contains(e.target)) {
                closeStationDropdown();
            }
        }
    });

    // Ensure bounds are not clamped on startup until intro sequence completes
    if (map) {
        try { map.setMaxBounds(null); } catch (e) {}
    }
}

export function toggleStationDropdown(event) {
    if (event) event.stopPropagation();
    const flyout = document.getElementById('station-dropdown-flyout');
    if (flyout) {
        flyout.classList.toggle('active');
    }
}

export function closeStationDropdown() {
    const flyout = document.getElementById('station-dropdown-flyout');
    if (flyout) {
        flyout.classList.remove('active');
    }
}

function updateStationUI(stationId) {
    const st = STATIONS[stationId] || STATIONS.lares;
    const labelEl = document.getElementById('station-current-label');
    const subEl = document.getElementById('station-subtitle');
    if (labelEl) labelEl.textContent = st.label;
    if (subEl) subEl.textContent = st.sub;

    // Update active highlight on dropdown items
    document.querySelectorAll('.station-dropdown-item').forEach(item => {
        const sId = item.dataset.station;
        const targetSt = STATIONS[sId];
        const isActive = sId === stationId;
        const isDev = targetSt && targetSt.status === 'under_development';
        item.classList.toggle('active', isActive);
        const statusEl = item.querySelector('.station-item-status');
        if (statusEl) {
            if (isActive) {
                statusEl.textContent = 'Active';
                statusEl.className = 'station-item-status active-badge';
            } else if (isDev) {
                statusEl.textContent = 'Under Dev';
                statusEl.className = 'station-item-status dev-badge';
            } else {
                statusEl.textContent = 'Select';
                statusEl.className = 'station-item-status';
            }
        }
    });

    // Update Phone UI station indicator and modal cards
    const phonePillName = document.getElementById('phone-station-pill-name');
    const phoneBannerName = document.getElementById('phone-station-banner-name');
    if (phonePillName) phonePillName.textContent = st.name || st.label;
    if (phoneBannerName) phoneBannerName.textContent = st.label;

    document.querySelectorAll('.phone-station-card').forEach(card => {
        const sId = card.dataset.station;
        const targetSt = STATIONS[sId];
        const isActive = sId === stationId;
        const isDev = targetSt && targetSt.status === 'under_development';
        card.classList.toggle('active', isActive);
        const statusEl = card.querySelector('.psc-status');
        if (statusEl) {
            if (isActive) {
                statusEl.textContent = 'Active';
                statusEl.className = 'psc-status active';
            } else if (isDev) {
                statusEl.textContent = 'Under Dev';
                statusEl.className = 'psc-status dev-badge';
            } else {
                statusEl.textContent = 'Select';
                statusEl.className = 'psc-status';
            }
        }
    });
}

function showStationFlyNotification(text) {
    let notif = document.getElementById('station-fly-toast');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'station-fly-toast';
        notif.className = 'station-fly-toast';
        document.body.appendChild(notif);
    }
    notif.innerHTML = `<span>${lucideIcon('drone', 16)}</span> <span>${text}</span>`;
    notif.classList.add('active');

    if (activeFlyNotificationTimer) clearTimeout(activeFlyNotificationTimer);
    activeFlyNotificationTimer = setTimeout(() => {
        notif.classList.remove('active');
    }, 3500);
}

// Check if application is running in deployed production mode vs local development.
// When deployed (or with ?deployed=1), unfinished stations are protected with the Under Development modal.
// In local development (localhost / 127.0.0.1 / ?dev=1), developers have full unrestricted switching to QARES.
export function isDeployedMode() {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('deployed') === '1') return true;
    if (urlParams.get('dev') === '1') return false;
    if (window.IS_DEPLOYED !== undefined) return Boolean(window.IS_DEPLOYED);
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '' || host.startsWith('192.168.') || host.endsWith('.local');
    return !isLocal;
}

export function switchResearchStation(stationId, forceBypass = false) {
    closeStationDropdown();

    if (!STATIONS[stationId]) return;
    if (state.currentStationId === stationId) return;

    const targetStation = STATIONS[stationId];
    // "When deployed make sure that other research stations will be shown as Under Development when they choose it."
    // In local development, developers can freely switch to and build QARES.
    if (isDeployedMode() && targetStation && targetStation.status === 'under_development' && !forceBypass) {
        showStationDevModal(stationId);
        return;
    }

    performStationSwitch(stationId);
}

export function performStationSwitch(stationId) {
    // 1. Immediately invalidate and cancel any in-flight switch timers, animations, or rotations
    if (activeStationSwitchTimer) {
        clearTimeout(activeStationSwitchTimer);
        activeStationSwitchTimer = null;
    }
    if (activeCurtainDismissTimer) {
        clearTimeout(activeCurtainDismissTimer);
        activeCurtainDismissTimer = null;
    }
    if (activeStationSwitchSafetyTimer) {
        clearTimeout(activeStationSwitchSafetyTimer);
        activeStationSwitchSafetyTimer = null;
    }

    if (typeof stopIntroAnimation === 'function') {
        stopIntroAnimation();
    }
    if (typeof stopIdleRotation === 'function') {
        stopIdleRotation();
    }
    if (typeof resetIdle === 'function') {
        resetIdle();
    }

    // Immediately and synchronously release map bounds so the camera can NEVER be clamped
    if (map) {
        try { map.setMaxBounds(null); } catch (e) {}
        try { map.stop(); } catch (e) {}
    }

    const targetStation = STATIONS[stationId];
    state.currentStationId = stationId;

    updateStationUI(stationId);

    // 2. Show Smooth Transition Curtain
    const curtain = document.getElementById('station-transition-curtain');
    const stcIcon = document.getElementById('stc-icon');
    const stcTitle = document.getElementById('stc-title');
    const stcSub = document.getElementById('stc-sub');

    if (stcIcon) stcIcon.textContent = targetStation.icon;
    if (stcTitle) stcTitle.textContent = `Connecting to ${targetStation.name}`;
    if (stcSub) stcSub.textContent = `${targetStation.fullName} • ${targetStation.province}`;
    if (curtain) {
        curtain.setAttribute('aria-hidden', 'false');
        curtain.classList.add('active');

        // Immediate tap/click to dismiss failsafe
        if (!curtain.dataset.hasDismissListener) {
            curtain.dataset.hasDismissListener = 'true';
            curtain.addEventListener('click', () => {
                curtain.classList.remove('active');
                curtain.setAttribute('aria-hidden', 'true');
            });
        }
    }

    const dismissCurtain = () => {
        if (curtain) {
            curtain.classList.remove('active');
            curtain.setAttribute('aria-hidden', 'true');
        }
    };

    // Safety failsafe: transition curtain MUST NEVER remain stuck longer than 500ms
    activeStationSwitchSafetyTimer = setTimeout(dismissCurtain, 500);

    // Reset any active route / building panels without initiating flyTo
    if (typeof window.closeRouteAndReset === 'function') {
        try { window.closeRouteAndReset(); } catch (e) {}
    }
    if (typeof window.closeBuildingPanel === 'function') {
        try { window.closeBuildingPanel(true); } catch (e) {}
    }

    // 3. Perform Seamless Teleport Behind the Curtain (200ms fade-in)
    activeStationSwitchTimer = setTimeout(() => {
        activeStationSwitchTimer = null;
        try {
            // Clean up all map markers & badges
            if (typeof removeMarkers === 'function') removeMarkers();
            if (typeof removeSectionBadges === 'function') removeSectionBadges();
            document.querySelectorAll('.bldg-map-marker').forEach(el => el.remove());

            if (state.kioskMarkerInstance) {
                try { state.kioskMarkerInstance.remove(); } catch (e) {}
                state.kioskMarkerInstance = null;
            }
            if (state.qaresKioskMarkerInstance) {
                try { state.qaresKioskMarkerInstance.remove(); } catch (e) {}
                state.qaresKioskMarkerInstance = null;
            }
            if (state.entranceArrowMarker) {
                try { state.entranceArrowMarker.remove(); } catch (e) {}
                state.entranceArrowMarker = null;
            }

            const isDrone = (state.currentMapStyleMode === 'google');
            const isMapbox = (state.currentMapStyleMode === 'mapbox');

            // Synchronously ensure bounds are completely free
            try { map.setMaxBounds(null); } catch (e) {}

            // Pre-position camera at Target Station's starting high birds-eye view behind curtain
            const introViews = getStationIntroViews(stationId);
            map.jumpTo({
                center: introViews.start.center,
                zoom: introViews.start.zoom,
                pitch: introViews.start.pitch,
                bearing: introViews.start.bearing
            });

            // Mount Target Station Data with STRICT UNCONDITIONAL LAYER ISOLATION
            if (stationId === 'lares') {
                // FORCIBLY HIDE ALL QARES LAYERS
                const qaresLayers = [
                    'qares-mask-layer',
                    'qares-ortho-layer',
                    'qares-boundary-fill',
                    'qares-boundary-glow',
                    'qares-boundary-casing',
                    'qares-boundary-line',
                    'qares-railway-ballast',
                    'qares-railway-sleepers',
                    'qares-railway-rail-left',
                    'qares-railway-rail-right',
                    'qares-footprints-fill',
                    'qares-footprints-line',
                    'qares-footprints-3d',
                    'qares-footprints-roofs',
                    'qares-roads-line'
                ];
                qaresLayers.forEach(id => {
                    if (map.getLayer(id)) {
                        try { map.setLayoutProperty(id, 'visibility', 'none'); } catch (e) {}
                    }
                });

                // MOUNT LARES DATA
                state.roadGraph = state.laresRoadGraph || window.roadGraph;
                window.roadGraph = state.roadGraph;

                const bldgVis = state.buildingsVisible !== false ? 'visible' : 'none';
                const bndVis = state.boundaryVisible !== false ? 'visible' : 'none';

                const bldgLayers = [
                    '3d-buildings-models-layer',
                    '3d-buildings-translucent-layer',
                    '3d-drawings',
                    '3d-drawings-extrusion',
                    '3d-drawings-roofs'
                ];
                bldgLayers.forEach(id => {
                    if (map.getLayer(id)) {
                        try { map.setLayoutProperty(id, 'visibility', bldgVis); } catch (e) {}
                    }
                });

                const bndLayers = [
                    'lares-boundary-line',
                    'lares-boundary-glow',
                    'lares-boundary-fill',
                    'lares-compound-border-casing',
                    'lares-compound-border-line',
                    'plots-fill',
                    'plots-line',
                    'plots-labels'
                ];
                bndLayers.forEach(id => {
                    if (map.getLayer(id)) {
                        try { map.setLayoutProperty(id, 'visibility', bndVis); } catch (e) {}
                    }
                });

                // LARES mask: strictly visible ONLY in satellite view when boundaries are on
                const showLaresMask = !isMapbox && (bndVis === 'visible');
                if (map.getLayer('lares-mask-layer')) {
                    try { map.setLayoutProperty('lares-mask-layer', 'visibility', showLaresMask ? 'visible' : 'none'); } catch (e) {}
                }

                const showVectorRoads = isMapbox;
                ['lares-roads-casing', 'lares-roads-fill', 'lares-roads-network'].forEach(id => {
                    if (map.getLayer(id)) {
                        try { map.setLayoutProperty(id, 'visibility', showVectorRoads ? 'visible' : 'none'); } catch (e) {}
                    }
                });

                if (map.getLayer('lares-drone-layer')) {
                    try { map.setLayoutProperty('lares-drone-layer', 'visibility', isDrone ? 'visible' : 'none'); } catch (e) {}
                }
                if (map.getLayer('google-satellite-layer')) {
                    try { map.setLayoutProperty('google-satellite-layer', 'visibility', isDrone ? 'visible' : 'none'); } catch (e) {}
                }

                if (map.getLayer('trees-3d') && state.treesVisible) {
                    try { map.setLayoutProperty('trees-3d', 'visibility', 'visible'); } catch (e) {}
                }

                if (isMapbox && !map.getLayer('lares-compound-border-line')) {
                    if (typeof setupMapboxStandardLayers === 'function') {
                        setupMapboxStandardLayers();
                    }
                }

                if (typeof createMarkers === 'function') createMarkers();
                if (typeof createKioskMarker === 'function') createKioskMarker();
                if (typeof createEntranceArrowMarker === 'function') createEntranceArrowMarker();
                if (typeof buildDirectory === 'function') buildDirectory();
                renderStationCategoryBar('lares');

            } else if (stationId === 'qares') {
                // FORCIBLY HIDE ALL LARES LAYERS
                const laresLayers = [
                    '3d-buildings-models-layer',
                    '3d-buildings-translucent-layer',
                    '3d-drawings',
                    '3d-drawings-extrusion',
                    '3d-drawings-roofs',
                    'lares-mask-layer',
                    'lares-drone-layer',
                    'google-satellite-overlay-layer',
                    'lares-boundary-line',
                    'lares-boundary-glow',
                    'lares-boundary-fill',
                    'lares-compound-border-casing',
                    'lares-compound-border-line',
                    'lares-roads-casing',
                    'lares-roads-fill',
                    'lares-roads-network',
                    'plots-fill',
                    'plots-line',
                    'plots-labels',
                    'trees-3d'
                ];
                laresLayers.forEach(id => {
                    if (map.getLayer(id)) {
                        try { map.setLayoutProperty(id, 'visibility', 'none'); } catch (e) {}
                    }
                });

                if (state.qaresRoadGraph) {
                    state.roadGraph = state.qaresRoadGraph;
                    window.roadGraph = state.qaresRoadGraph;
                }

                renderStationCategoryBar('qares');
                loadQARESData();

                if (typeof createKioskMarker === 'function') {
                    createKioskMarker();
                }
            }
        } catch (err) {
            console.error('[StationSwitch] Error during station transition:', err);
        } finally {
            // Dismiss transition curtain promptly (100ms after teleport finishes) and launch cinematic intro fly-in
            activeCurtainDismissTimer = setTimeout(() => {
                activeCurtainDismissTimer = null;
                if (activeStationSwitchSafetyTimer) {
                    clearTimeout(activeStationSwitchSafetyTimer);
                    activeStationSwitchSafetyTimer = null;
                }
                dismissCurtain();
                if (typeof playIntroAnimation === 'function') {
                    playIntroAnimation(null, true);
                }
            }, 100);
        }
    }, 200);
}

let qaresEventsBound = false;
function bindQARESBuildingEvents() {
    if (!map || qaresEventsBound) return;
    qaresEventsBound = true;

    const onQaresBuildingClick = (e) => {
        if (!e.features || !e.features.length) return;
        const f = e.features[0];
        const p = f.properties || {};
        const bId = p.id;
        if (bId && typeof window.navigateTo === 'function') {
            window.navigateTo(bId);
        }
    };

    map.on('click', 'qares-footprints-3d', onQaresBuildingClick);
    map.on('click', 'qares-footprints-roofs', onQaresBuildingClick);
    map.on('mouseenter', 'qares-footprints-3d', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'qares-footprints-3d', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'qares-footprints-roofs', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'qares-footprints-roofs', () => { map.getCanvas().style.cursor = ''; });
}

export function buildQARESMaskFromBoundary(boundaryGeoJson) {
    if (!boundaryGeoJson || !boundaryGeoJson.features) return null;
    let front = null;
    let flint = null;
    for (const f of boundaryGeoJson.features) {
        const id = (f.properties && f.properties.id) || f.id;
        if (id === 'qares_front' && f.geometry && f.geometry.type === 'Polygon') {
            front = f.geometry.coordinates[0];
        }
        if (id === 'qares_flint' && f.geometry && f.geometry.type === 'Polygon') {
            flint = f.geometry.coordinates[0];
        }
    }
    if (!front || !flint) return null;

    // Bridge coordinates connecting across PNR Railway Track
    const bridgeEastNorth = [121.37061209525696, 13.944254361703344];
    const bridgeEastMid   = [121.3705593874083, 13.944142160808177];
    const bridgeWestNorth = [121.37047394506597, 13.94430713756418];
    const bridgeWestMid1  = [121.37042437050941, 13.944201606477387];
    const bridgeWestMid2  = [121.37042414140082, 13.944201113871262];

    function lineIntersect(p1, p2, p3, p4) {
        const xd = [p1[0] - p2[0], p3[0] - p4[0]];
        const yd = [p1[1] - p2[1], p3[1] - p4[1]];
        const div = xd[0] * yd[1] - xd[1] * yd[0];
        if (div === 0) return null;
        const d1 = p1[0] * p2[1] - p1[1] * p2[0];
        const d2 = p3[0] * p4[1] - p3[1] * p4[0];
        return [(d1 * xd[1] - xd[0] * d2) / div, (d1 * yd[1] - yd[0] * d2) / div];
    }

    const eastIntersect = lineIntersect(front[2], front[3], bridgeEastMid, bridgeEastNorth) || [121.37051705867479, 13.944052054016835];
    const westIntersect = lineIntersect(front[3], front[4], [121.37037, 13.94408], bridgeWestNorth) || [121.370380891412, 13.944103798967703];

    const hole = [
        front[0], // SW
        front[1], // SE
        front[2], // NE
        eastIntersect,
        bridgeEastMid,
        bridgeEastNorth
    ];

    for (let i = 1; i < flint.length - 1; i++) {
        hole.push(flint[i]);
    }
    hole.push(flint[0]); // SW of Flint

    hole.push(bridgeWestNorth);
    hole.push(bridgeWestMid1);
    hole.push(bridgeWestMid2);
    hole.push(westIntersect);

    for (let i = 4; i < front.length; i++) {
        hole.push(front[i]);
    }

    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
                    hole
                ]
            },
            properties: {
                station: 'qares',
                description: 'DA-QARES Compound Vignette Mask with Walkway Bridge'
            }
        }]
    };
}

export function loadQARESData() {
    const isDrone = (state.currentMapStyleMode === 'google');
    const isMapbox = (state.currentMapStyleMode === 'mapbox');

    // 0. Ensure structural QARES layers respect active visibility states
    const bldgVis = state.buildingsVisible ? 'visible' : 'none';
    const bndVis = state.boundaryVisible !== false ? 'visible' : 'none';
    const bndShadowVis = (!isMapbox && bndVis === 'visible') ? 'visible' : 'none';
    ['qares-boundary-fill', 'qares-boundary-line', 'qares-railway-casing', 'qares-railway-line'].forEach(id => {
        if (map && map.getLayer(id)) {
            try { map.setLayoutProperty(id, 'visibility', bndVis); } catch (e) {}
        }
    });
    ['qares-boundary-glow', 'qares-boundary-casing'].forEach(id => {
        if (map && map.getLayer(id)) {
            try { map.setLayoutProperty(id, 'visibility', bndShadowVis); } catch (e) {}
        }
    });
    ['qares-footprints-3d', 'qares-footprints-roofs'].forEach(id => {
        if (map && map.getLayer(id)) {
            try { map.setLayoutProperty(id, 'visibility', bldgVis); } catch (e) {}
        }
    });

    // High-Resolution Drone Orthomosaic: ONLY visible in Aerial Drone View, hidden in Mapbox 3D View
    if (map && map.getLayer('qares-ortho-layer')) {
        try { map.setLayoutProperty('qares-ortho-layer', 'visibility', isDrone ? 'visible' : 'none'); } catch (e) {}
    }

    // Remove road outline layer if present so it doesn't render over aerial imagery
    if (map && map.getLayer('qares-roads-line')) {
        try { map.removeLayer('qares-roads-line'); } catch (e) {}
    }

    // 1. Ensure LARES mask is turned OFF and satellite imagery is visible
    if (map && map.getLayer('lares-mask-layer')) {
        try { map.setLayoutProperty('lares-mask-layer', 'visibility', 'none'); } catch (e) {}
    }
    if (map && map.getLayer('google-satellite-layer')) {
        try { map.setLayoutProperty('google-satellite-layer', 'visibility', isDrone ? 'visible' : 'none'); } catch (e) {}
    }

    // 2. High-Resolution QARES Drone Orthomosaic Layer (Tiled MBTiles Pyramid, Zooms 14-21)
    try {
        if (!map.getSource('qares-drone-source')) {
            map.addSource('qares-drone-source', {
                type: 'raster',
                tiles: [
                    '/api/tiles/qares/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                minzoom: 14,
                maxzoom: 22,
                bounds: [121.366888, 13.941220, 121.376150, 13.950960]
            });
        }
        if (!map.getLayer('qares-ortho-layer') && map.getSource('qares-drone-source')) {
            map.addLayer({
                id: 'qares-ortho-layer',
                type: 'raster',
                source: 'qares-drone-source',
                slot: 'bottom',
                layout: {
                    'visibility': isDrone ? 'visible' : 'none'
                },
                paint: {
                    'raster-opacity': 1.0,
                    'raster-fade-duration': 0
                }
            });
        } else if (map.getLayer('qares-ortho-layer')) {
            try { map.setLayoutProperty('qares-ortho-layer', 'visibility', isDrone ? 'visible' : 'none'); } catch (e) {}
        }
    } catch (e) {
        console.warn('[QARES] Ortho source/layer notice:', e);
    }

    // 2b. Dark Vignette / Boundary Mask (Isolates DA-QARES compound in 3D dark void space, leaving connecting walkway visible)
    try {
        if (!map.getSource('qares-mask-source')) {
            map.addSource('qares-mask-source', {
                type: 'geojson',
                data: QARES_MASK
            });
        }
        const showQaresMask = !isMapbox && (state.currentStationId === 'qares');
        if (!map.getLayer('qares-mask-layer') && map.getSource('qares-mask-source')) {
            map.addLayer({
                id: 'qares-mask-layer',
                type: 'fill',
                source: 'qares-mask-source',
                slot: 'middle',
                layout: {
                    'visibility': showQaresMask ? 'visible' : 'none'
                },
                paint: {
                    'fill-color': '#0b1121',
                    'fill-opacity': 1.0
                }
            });
        } else if (map.getLayer('qares-mask-layer')) {
            try {
                map.setLayoutProperty('qares-mask-layer', 'visibility', showQaresMask ? 'visible' : 'none');
                map.setPaintProperty('qares-mask-layer', 'fill-color', '#0b1121');
                map.setPaintProperty('qares-mask-layer', 'fill-opacity', 1.0);
            } catch (e) {}
        }
    } catch (e) {
        console.warn('[QARES] Mask layer notice:', e);
    }

    // 3. QARES Compound Official Boundary Outline (QGIS Split Parcels: Front & Flint + PNR Corridor)
    try {
        if (!map.getSource('qares-boundary-source')) {
            map.addSource('qares-boundary-source', {
                type: 'geojson',
                data: 'qares_boundary.json'
            });
        }

        // 3a. Subtle interior green fill
        if (!map.getLayer('qares-boundary-fill') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-boundary-fill',
                type: 'fill',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
                layout: { 'visibility': bndVis },
                paint: {
                    'fill-color': '#22c55e',
                    'fill-opacity': 0.06
                }
            });
        } else if (map.getLayer('qares-boundary-fill')) {
            try { map.setLayoutProperty('qares-boundary-fill', 'visibility', bndVis); } catch (e) {}
        }

        // 3b. Soft ambient grass green glow (Satellite mode only; zero shadow in Mapbox mode)
        if (!map.getLayer('qares-boundary-glow') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-boundary-glow',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                    'visibility': bndShadowVis
                },
                paint: {
                    'line-color': '#4ade80',
                    'line-width': 10,
                    'line-blur': 4,
                    'line-opacity': 0.35
                }
            });
        } else if (map.getLayer('qares-boundary-glow')) {
            try { map.setLayoutProperty('qares-boundary-glow', 'visibility', bndShadowVis); } catch (e) {}
        }

        // 3c. High-contrast dark forest green outer protective casing (Satellite mode only; zero shadow in Mapbox mode)
        if (!map.getLayer('qares-boundary-casing') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-boundary-casing',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                    'visibility': bndShadowVis
                },
                paint: {
                    'line-color': '#14532d',
                    'line-width': 5.5,
                    'line-opacity': 0.85
                }
            });
        } else if (map.getLayer('qares-boundary-casing')) {
            try { map.setLayoutProperty('qares-boundary-casing', 'visibility', bndShadowVis); } catch (e) {}
        }

        // 3d. Crisp unified neon green perimeter line
        if (!map.getLayer('qares-boundary-line') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-boundary-line',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                    'visibility': bndVis
                },
                paint: {
                    'line-color': '#22c55e',
                    'line-width': 3.0,
                    'line-opacity': 0.95
                }
            });
        } else if (map.getLayer('qares-boundary-line')) {
            try { map.setLayoutProperty('qares-boundary-line', 'visibility', bndVis); } catch (e) {}
        }

        // 3e. Authentic Multi-Layered PNR Railway Track (Ballast, Sleepers/Ties & Twin Steel Rails)
        // Clean up legacy single-line layers if present
        ['qares-railway-casing', 'qares-railway-line'].forEach(id => {
            if (map.getLayer(id)) {
                try { map.removeLayer(id); } catch (e) {}
            }
        });

        // 1. Ballast Bed (Dark crushed stone gravel foundation)
        if (!map.getLayer('qares-railway-ballast') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-railway-ballast',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['==', ['geometry-type'], 'LineString'],
                layout: { 'line-cap': 'round', 'line-join': 'round', 'visibility': bndVis },
                paint: {
                    'line-color': '#0f172a',
                    'line-width': [
                        'interpolate', ['linear'], ['zoom'],
                        14, 6,
                        16, 10,
                        18, 16,
                        20, 22
                    ],
                    'line-opacity': 1.0
                }
            });
        } else if (map.getLayer('qares-railway-ballast')) {
            try { map.setLayoutProperty('qares-railway-ballast', 'visibility', bndVis); } catch (e) {}
        }

        // 2. Railroad Ties / Cross Sleepers (Perpendicular wooden/concrete crossbars)
        if (!map.getLayer('qares-railway-sleepers') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-railway-sleepers',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['==', ['geometry-type'], 'LineString'],
                layout: { 'line-cap': 'butt', 'line-join': 'miter', 'visibility': bndVis },
                paint: {
                    'line-color': '#94a3b8',
                    'line-width': [
                        'interpolate', ['linear'], ['zoom'],
                        14, 5,
                        16, 8,
                        18, 13,
                        20, 18
                    ],
                    'line-dasharray': [0.35, 1.25],
                    'line-opacity': 0.95
                }
            });
        } else if (map.getLayer('qares-railway-sleepers')) {
            try { map.setLayoutProperty('qares-railway-sleepers', 'visibility', bndVis); } catch (e) {}
        }

        // 3. Left Steel Rail (Parallel shining metallic steel rail)
        if (!map.getLayer('qares-railway-rail-left') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-railway-rail-left',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['==', ['geometry-type'], 'LineString'],
                layout: { 'line-cap': 'round', 'line-join': 'round', 'visibility': bndVis },
                paint: {
                    'line-color': '#f8fafc',
                    'line-width': [
                        'interpolate', ['linear'], ['zoom'],
                        14, 1.0,
                        16, 1.5,
                        18, 2.2,
                        20, 3.0
                    ],
                    'line-offset': [
                        'interpolate', ['linear'], ['zoom'],
                        14, -1.8,
                        16, -2.8,
                        18, -4.5,
                        20, -6.5
                    ],
                    'line-opacity': 1.0
                }
            });
        } else if (map.getLayer('qares-railway-rail-left')) {
            try { map.setLayoutProperty('qares-railway-rail-left', 'visibility', bndVis); } catch (e) {}
        }

        // 4. Right Steel Rail (Parallel shining metallic steel rail)
        if (!map.getLayer('qares-railway-rail-right') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-railway-rail-right',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['==', ['geometry-type'], 'LineString'],
                layout: { 'line-cap': 'round', 'line-join': 'round', 'visibility': bndVis },
                paint: {
                    'line-color': '#f8fafc',
                    'line-width': [
                        'interpolate', ['linear'], ['zoom'],
                        14, 1.0,
                        16, 1.5,
                        18, 2.2,
                        20, 3.0
                    ],
                    'line-offset': [
                        'interpolate', ['linear'], ['zoom'],
                        14, 1.8,
                        16, 2.8,
                        18, 4.5,
                        20, 6.5
                    ],
                    'line-opacity': 1.0
                }
            });
        } else if (map.getLayer('qares-railway-rail-right')) {
            try { map.setLayoutProperty('qares-railway-rail-right', 'visibility', bndVis); } catch (e) {}
        }
    } catch (e) {
        console.warn('[QARES] Boundary layers notice:', e);
    }

    // 3f. Dynamically fetch qares_boundary.json to guarantee realtime boundary & mask alignment
    try {
        fetch('qares_boundary.json?t=' + Date.now())
            .then(r => r.json())
            .then(bndData => {
                if (!bndData || !bndData.features) return;
                if (map && map.getSource('qares-boundary-source')) {
                    try { map.getSource('qares-boundary-source').setData(bndData); } catch (e) {}
                }
                const dynamicMask = buildQARESMaskFromBoundary(bndData);
                if (dynamicMask && map && map.getSource('qares-mask-source')) {
                    try { map.getSource('qares-mask-source').setData(dynamicMask); } catch (e) {}
                }
            })
            .catch(e => console.warn('[QARES] Dynamic boundary sync notice:', e));
    } catch (e) {}

    // Helper: Mount/Sync QARES Footprints Source & 3D Extrusion Layers
    function applyQARESFootprints(data) {
        if (!map || !data) return;
        qaresBuildingsBaseline = data;
        if (typeof window !== 'undefined') window.qaresBuildingsBaseline = data;

        // 1. Ensure source
        try {
            if (!map.getSource('qares-footprints-source')) {
                map.addSource('qares-footprints-source', { type: 'geojson', data: data });
            } else {
                try { map.getSource('qares-footprints-source').setData(data); } catch (e) {}
            }
        } catch (e) {
            console.warn('[QARES] Footprints source notice:', e);
        }

        const bldgVis = state.buildingsVisible ? 'visible' : 'none';

        // 2. 3D Extruded Building Walls (Generic Light Gray Concrete / Stucco)
        try {
            if (!map.getLayer('qares-footprints-3d') && map.getSource('qares-footprints-source')) {
                map.addLayer({
                    id: 'qares-footprints-3d',
                    type: 'fill-extrusion',
                    source: 'qares-footprints-source',
                    slot: 'middle',
                    filter: ['==', ['coalesce', ['get', 'filter_type'], ['get', 'category'], 'Buildings'], 'Buildings'],
                    layout: {
                        'visibility': bldgVis
                    },
                    paint: {
                        'fill-extrusion-color': '#d4d8de',
                        'fill-extrusion-height': ['coalesce', ['get', 'height'], 5],
                        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
                        'fill-extrusion-opacity': 0.95,
                        'fill-extrusion-emissive-strength': 0.35,
                        'fill-extrusion-cast-shadows': false
                    }
                });
            } else if (map.getLayer('qares-footprints-3d')) {
                try {
                    map.setLayoutProperty('qares-footprints-3d', 'visibility', bldgVis);
                    map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-color', '#d4d8de');
                    map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-height', ['coalesce', ['get', 'height'], 5]);
                    map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-base', ['coalesce', ['get', 'min_height'], 0]);
                    map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-opacity', 0.95);
                    map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-emissive-strength', 0.35);
                    map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-cast-shadows', false);
                    map.setFilter('qares-footprints-3d', ['==', ['coalesce', ['get', 'filter_type'], ['get', 'category'], 'Buildings'], 'Buildings']);
                } catch (e) {}
            }
        } catch (e) {
            console.warn('[QARES] 3D footprints layer notice:', e);
        }

        // 3. 3D Architectural Roof Slab (Elevated Cap matching Respective Color Coding)
        try {
            if (!map.getLayer('qares-footprints-roofs') && map.getSource('qares-footprints-source')) {
                map.addLayer({
                    id: 'qares-footprints-roofs',
                    type: 'fill-extrusion',
                    source: 'qares-footprints-source',
                    slot: 'middle',
                    filter: ['==', ['coalesce', ['get', 'filter_type'], ['get', 'category'], 'Buildings'], 'Buildings'],
                    layout: {
                        'visibility': bldgVis
                    },
                    paint: {
                        'fill-extrusion-color': ['coalesce', ['get', 'roof_color'], ['get', 'color'], '#dc2626'],
                        'fill-extrusion-height': ['+', ['coalesce', ['get', 'height'], 5], 0.35],
                        'fill-extrusion-base': ['coalesce', ['get', 'height'], 5],
                        'fill-extrusion-opacity': 1.0,
                        'fill-extrusion-emissive-strength': 0.35,
                        'fill-extrusion-cast-shadows': false
                    }
                });
            } else if (map.getLayer('qares-footprints-roofs')) {
                try {
                    map.setLayoutProperty('qares-footprints-roofs', 'visibility', bldgVis);
                    map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-color', ['coalesce', ['get', 'roof_color'], ['get', 'color'], '#dc2626']);
                    map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-height', ['+', ['coalesce', ['get', 'height'], 5], 0.35]);
                    map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-base', ['coalesce', ['get', 'height'], 5]);
                    map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-opacity', 1.0);
                    map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-emissive-strength', 0.35);
                    map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-cast-shadows', false);
                    map.setFilter('qares-footprints-roofs', ['==', ['coalesce', ['get', 'filter_type'], ['get', 'category'], 'Buildings'], 'Buildings']);
                } catch (e) {}
            }
        } catch (e) {
            console.warn('[QARES] Roofs layer notice:', e);
        }

        // Hide legacy flat 2D ground layers so they don't clip under 3D models
        if (map.getLayer('qares-footprints-fill')) try { map.setLayoutProperty('qares-footprints-fill', 'visibility', 'none'); } catch (e) {}
        if (map.getLayer('qares-footprints-line')) try { map.setLayoutProperty('qares-footprints-line', 'visibility', 'none'); } catch (e) {}

        // Bind interactive click & hover handlers once
        bindQARESBuildingEvents();

        // Render Directory for QARES (retaining Buildings part)
        renderQARESDirectory(data, 'Buildings');
    }

    // Immediate mount from cached memory baseline (zero delay on style change)
    if (qaresBuildingsBaseline) {
        applyQARESFootprints(qaresBuildingsBaseline);
    }

    // 4. Fetch QARES Buildings GeoJSON (ensures fresh data)
    fetch('qares_buildings.json?v=' + Date.now())
        .then(r => r.json())
        .then(data => {
            applyQARESFootprints(data);
        })
        .catch(e => console.log('Notice: Could not load QARES buildings.', e));

    // 3. Fetch QARES Roads GeoJSON & Build Pathfinding Graph (only if not yet cached)
    if (state.qaresRoadGraph) {
        state.roadGraph = state.qaresRoadGraph;
        window.roadGraph = state.qaresRoadGraph;
    } else {
        fetch('qares_roads.json')
            .then(r => r.json())
            .then(roadData => {
                if (!map) return;
                if (map.getSource('qares-roads-source')) {
                    map.getSource('qares-roads-source').setData(roadData);
                } else {
                    map.addSource('qares-roads-source', { type: 'geojson', data: roadData });
                }
                if (map.getLayer('qares-roads-line')) {
                    try { map.removeLayer('qares-roads-line'); } catch (e) {}
                }

                // Build QARES road topology graph
                state.qaresRoadGraph = buildRoadGraph(roadData);
                if (state.currentStationId === 'qares') {
                    state.roadGraph = state.qaresRoadGraph;
                    window.roadGraph = state.qaresRoadGraph;
                }
                console.log(`[QARES] Loaded road graph with ${state.qaresRoadGraph.size} nodes.`);
            })
            .catch(e => console.warn('Notice: Could not load qares_roads.json:', e));
    }

    // Ensure QARES Kiosk "You Are Here" pin is mounted
    if (typeof createKioskMarker === 'function') {
        createKioskMarker();
    }
}

// Station Category Bar Renderer (Syncs Desktop & Mobile)
// Station Category Bar Renderer (Syncs Desktop & Mobile)
export function renderStationCategoryBar(stationId) {
    const catBar = document.getElementById('kiosk-categories-bar');
    const phoneCatBar = document.getElementById('phone-categories-bar');
    const quickTags = document.getElementById('kiosk-quick-tags');

    // Category filter chips are removed for now; 3D buildings are fully retained
    if (catBar) {
        catBar.innerHTML = '';
        catBar.style.display = 'none';
    }
    if (phoneCatBar) {
        phoneCatBar.innerHTML = '';
        phoneCatBar.style.display = 'none';
    }
    if (quickTags) {
        quickTags.style.display = (stationId === 'lares') ? 'flex' : 'none';
    }
}

// QARES Directory & Categorization State
let qaresBuildingsBaseline = null;
let activeQARESCategory = 'Buildings';

export function filterQARESByCategory(cat) {
    activeQARESCategory = cat || 'Buildings';
    const searchVal = (document.getElementById('search-input')?.value || document.getElementById('phone-search-input')?.value || '').trim();
    if (searchVal) {
        filterQARESSearch(searchVal);
    } else if (qaresBuildingsBaseline) {
        renderQARESDirectory(qaresBuildingsBaseline, activeQARESCategory);
    }

    // Retain all 3D building models and footprints on the map
    if (map) {
        ['qares-footprints-3d', 'qares-footprints-roofs'].forEach(id => {
            if (map.getLayer(id)) {
                try { map.setFilter(id, null); } catch (e) {}
            }
        });
        if (map.getLayer('qares-footprints-3d')) {
            map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-color', '#d4d8de');
            map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-opacity', 0.95);
        }
        if (map.getLayer('qares-footprints-roofs')) {
            map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-color', ['coalesce', ['get', 'roof_color'], ['get', 'color'], '#dc2626']);
            map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-opacity', 1.0);
        }
    }
}

const QARES_SEARCH_ALIASES = {
    'rp vehicle garage': ['republic of the philippines (rp) government vehicle garage'],
    'embryo tissue culture laboratory': ['tc laboratory', 'etc laboratory'],
    'planting material production unit office': ['pmpu office', 'pmpu'],
    'qares livestock unit': ['quezon agricultural research and experiment station (qares) livestock unit'],
    'quezon agricultural programs coordinating office': ['qapco', 'apco'],
    'bsf facility': ['black soldier fly (bsf) facility']
};

export function filterQARESSearch(query = '') {
    if (!qaresBuildingsBaseline) return;
    const q = query.trim().toLowerCase();
    const filtered = {
        ...qaresBuildingsBaseline,
        features: (qaresBuildingsBaseline.features || []).filter(f => {
            const p = f.properties || {};
            const name = (p.name || '').toLowerCase();
            const id = (p.id || '').toLowerCase();
            const cat = (p.filter_type || p.category || 'Buildings').toLowerCase();
            const colorCode = (p.color_code || '').toLowerCase();
            const aliases = QARES_SEARCH_ALIASES[name] || [];
            const matchesAlias = q && aliases.some(a => a.includes(q));
            const matchesText = !q || name.includes(q) || id.includes(q) || cat.includes(q) || colorCode.includes(q) || matchesAlias;
            const matchesCat = (activeQARESCategory === 'all') || ((p.filter_type || p.category || 'Buildings') === activeQARESCategory);
            return matchesText && matchesCat;
        })
    };
    renderQARESDirectory(filtered, activeQARESCategory, true);
}

// Helper: Contextual Functional Subtitle for QARES Facilities (matching LARES format)
function getQARESSubtitle(name, desc) {
    if (desc && desc.trim()) return desc;
    const n = (name || '').toLowerCase();
    if (n.includes('guard')) return 'Main Entrance Security & Gate Access';
    if (n.includes('info') || n.includes('hub')) return 'Visitor Information & Reception Center';
    if (n.includes('admin')) return 'Administrative & Executive Services';
    if (n.includes('research') || n.includes('center')) return 'Agricultural Research & Development Division';
    if (n.includes('lab') || n.includes('tissue') || n.includes('embryo') || n.includes('wine')) return 'Specialized Crop Research & Analytical Lab';
    if (n.includes('garage') || n.includes('motorpool')) return 'Transportation & Vehicle Maintenance Bay';
    if (n.includes('guest')) return 'Staff & Visitor Quarters';
    if (n.includes('conference') || n.includes('court') || n.includes('hall')) return 'Conference & Assembly Facility';
    if (n.includes('livestock') || n.includes('goat') || n.includes('chicken') || n.includes('pen') || n.includes('barn') || n.includes('egg') || n.includes('grower') || n.includes('brooder') || n.includes('pullet')) return 'Livestock Research & Breeding Facility';
    if (n.includes('storage') || n.includes('bodega') || n.includes('storehouse') || n.includes('fertilizer') || n.includes('silage')) return 'Agricultural Storage & Warehouse Facility';
    if (n.includes('nursery') || n.includes('production') || n.includes('makapuno')) return 'Planting Materials & Crop Production Unit';
    if (n.includes('organic') || n.includes('compost') || n.includes('bsf')) return 'Organic Agriculture & Bio-Resource Facility';
    return 'QARES Agricultural Facility';
}

export function renderQARESDirectory(data, filterCat = 'Buildings', isPreFiltered = false) {
    if (!isPreFiltered) qaresBuildingsBaseline = data;
    if (typeof window !== 'undefined') window.qaresBuildingsBaseline = data;

    const dirEl = document.getElementById('directory');
    const phoneDirEl = document.getElementById('phone-directory-list');

    // Color definitions for badges matching QARES color palette with subtle shade depths
    const QARES_COLORS_DEF = {
        red: { name: 'Red', hex: '#ef4444', bg: 'rgba(239, 68, 68, 0.22)', border: 'rgba(239, 68, 68, 0.45)' },
        blue: { name: 'Blue', hex: '#3b82f6', bg: 'rgba(59, 130, 246, 0.22)', border: 'rgba(59, 130, 246, 0.45)' },
        green: { name: 'Green', hex: '#22c55e', bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)' },
        yellow: { name: 'Yellow', hex: '#eab308', bg: 'rgba(234, 179, 8, 0.22)', border: 'rgba(234, 179, 8, 0.45)' },
        light_grey: { name: 'Light Grey', hex: '#94a3b8', bg: 'rgba(148, 163, 184, 0.22)', border: 'rgba(148, 163, 184, 0.45)' },
        pink: { name: 'Pink', hex: '#ec4899', bg: 'rgba(236, 72, 153, 0.22)', border: 'rgba(236, 72, 153, 0.45)' },
        brown: { name: 'Brown', hex: '#b45309', bg: 'rgba(180, 83, 9, 0.22)', border: 'rgba(180, 83, 9, 0.45)' }
    };

    const allFeatures = data.features || [];
    // Retain Buildings part in QARES directory list
    const features = isPreFiltered ? allFeatures : allFeatures.filter(f => {
        if (filterCat === 'all') return true;
        const cat = f.properties.filter_type || f.properties.category || 'Buildings';
        return cat === filterCat;
    });

    if (dirEl) {
        const headerTitle = isPreFiltered ? `QARES SEARCH (${features.length})` : `QARES BUILDINGS (${features.length})`;
        let html = `<div class="dir-section-header" style="padding: 12px 16px 8px; font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; display:flex; justify-content:space-between; align-items:center;">
            <span>${headerTitle}</span>
            <span style="font-size:10px; color:#38bdf8; font-weight:600;">Tiaong, Quezon</span>
        </div>`;

        if (features.length === 0) {
            html += `<div style="padding: 36px 16px; text-align: center; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                <div style="margin-bottom: 8px;">${lucideIcon('folder-open', 28)}</div>
                No facilities found.
            </div>`;
        } else {
            features.forEach((f, idx) => {
                const props = f.properties || {};
                const num = idx + 1;
                const name = props.name || props.id || `Facility ${num}`;
                const cKey = props.color_code || 'red';
                const shade = props.color || props.roof_color || (QARES_COLORS_DEF[cKey] ? QARES_COLORS_DEF[cKey].hex : '#ef4444');
                const badgeBg = `${shade}26`;
                const badgeBorder = `${shade}55`;

                let centerCoords = [121.37152, 13.94609];
                if (f.geometry && f.geometry.type === 'Polygon' && f.geometry.coordinates && f.geometry.coordinates[0]) {
                    const ring = f.geometry.coordinates[0];
                    let sumLng = 0, sumLat = 0;
                    ring.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
                    centerCoords = [sumLng / ring.length, sumLat / ring.length];
                }

                const subText = getQARESSubtitle(name, props.desc);

                html += `
                    <div class="dir-item" data-id="${props.id || `qares_${num}`}" onclick="navigateTo('${props.id || `qares_${num}`}');">
                        <div class="dir-item-icon" style="background:${badgeBg}; color:${shade}; border:1px solid ${badgeBorder};">
                            <span class="dir-item-icon-number">${num}</span>
                        </div>
                        <div class="dir-item-info">
                            <div class="dir-item-name">${name}</div>
                            <div class="dir-item-desc">${subText}</div>
                        </div>
                        <div class="dir-item-arrow">→</div>
                    </div>
                `;
            });
        }
        dirEl.innerHTML = html;
    }

    if (phoneDirEl) {
        let phtml = '';
        if (features.length === 0) {
            phtml = `<div style="padding: 36px 16px; text-align: center; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                <div style="margin-bottom: 8px;">${lucideIcon('folder-open', 28)}</div>
                No facilities found.
            </div>`;
        } else {
            features.forEach((f, idx) => {
                const props = f.properties || {};
                const name = props.name || props.id || `Facility ${idx + 1}`;
                const cKey = props.color_code || 'red';
                const shade = props.color || props.roof_color || (QARES_COLORS_DEF[cKey] ? QARES_COLORS_DEF[cKey].hex : '#ef4444');
                const num = idx + 1;

                let centerCoords = [121.37152, 13.94609];
                if (f.geometry && f.geometry.type === 'Polygon' && f.geometry.coordinates && f.geometry.coordinates[0]) {
                    const ring = f.geometry.coordinates[0];
                    let sumLng = 0, sumLat = 0;
                    ring.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
                    centerCoords = [sumLng / ring.length, sumLat / ring.length];
                }

                const subText = getQARESSubtitle(name, props.desc);

                phtml += `
                    <div class="phone-dir-item" data-id="${props.id || `qares_${num}`}" onclick="navigateTo('${props.id || `qares_${num}`}'); if(window.setPhoneSheetSnap) window.setPhoneSheetSnap('half');" style="cursor: pointer;">
                        <div class="phone-dir-badge" style="background:${shade}22; color:${shade}; border:1px solid ${shade}44; font-weight:800;">
                            ${num}
                        </div>
                        <div class="phone-dir-info">
                            <div class="phone-dir-name">${name}</div>
                            <div class="phone-dir-sub">${subText}</div>
                        </div>
                        <div class="phone-dir-arrow">›</div>
                    </div>
                `;
            });
        }
        phoneDirEl.innerHTML = phtml;
    }

    // Trigger map pill markers creation for QARES
    if (typeof window.createMarkers === 'function') {
        window.createMarkers();
    }
}

// Global reflections for inline HTML
if (typeof window !== 'undefined') {
    window.loadQARESData = loadQARESData;
    window.toggleStationDropdown = toggleStationDropdown;
    window.closeStationDropdown = closeStationDropdown;
    window.switchResearchStation = switchResearchStation;
    window.initStationSelector = initStationSelector;
    window.renderStationCategoryBar = renderStationCategoryBar;
    window.filterQARESByCategory = filterQARESByCategory;
    window.filterQARESSearch = filterQARESSearch;
    window.renderQARESDirectory = renderQARESDirectory;
    window.flyToQARESFacility = function(lng, lat, id) {
        if (!map) return;
        map.flyTo({
            center: [lng, lat],
            zoom: 18.5,
            pitch: 52,
            essential: true
        });
        if (id) {
            document.querySelectorAll('#directory .dir-item').forEach(el => {
                const isMatch = (el.dataset.id === id);
                el.classList.toggle('active', isMatch);
                if (isMatch) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
            document.querySelectorAll('.bldg-map-marker').forEach(el => {
                el.classList.toggle('active', el.dataset.id === id);
            });
        }
    };
    window.openPhoneStationModal = openPhoneStationModal;
    window.closePhoneStationModal = closePhoneStationModal;
    window.handlePhoneSelectStation = handlePhoneSelectStation;
    window.isDeployedMode = isDeployedMode;
    window.showStationDevModal = showStationDevModal;
    window.closeStationDevModal = closeStationDevModal;
    window.proceedToDevStationPreview = proceedToDevStationPreview;
}

export function showStationDevModal(stationId) {
    const st = STATIONS[stationId] || { name: stationId, label: stationId, sub: 'Regional Research Station', province: 'CALABARZON' };
    const modal = document.getElementById('station-dev-modal');
    if (!modal) return;

    const titleEl = document.getElementById('station-dev-title');
    const subEl = document.getElementById('station-dev-sub');
    const previewBtn = document.getElementById('station-dev-preview-btn');

    if (titleEl) titleEl.textContent = `${st.name} (${st.province || st.sub})`;
    if (subEl) subEl.textContent = st.fullName || st.sub;

    if (previewBtn) {
        // In local development or admin mode (?admin=1), allow exploring preview
        const isDev = !isDeployedMode();
        const isAdmin = (typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('admin') === '1' || localStorage.getItem('da_admin_mode') === 'true'));
        previewBtn.style.display = (isDev || isAdmin) ? 'inline-flex' : 'none';
        previewBtn.dataset.targetStation = stationId;
        previewBtn.innerHTML = `<span>${isDev ? 'Explore Station (Dev)' : 'Explore Preview (Admin)'}</span>`;
    }

    modal.style.display = 'flex';
}

export function closeStationDevModal(event) {
    if (event && event.target && event.target.id !== 'station-dev-modal' && !event.target.closest('.station-dev-close-btn') && !event.target.classList.contains('station-dev-btn')) {
        return;
    }
    const modal = document.getElementById('station-dev-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

export function proceedToDevStationPreview() {
    const previewBtn = document.getElementById('station-dev-preview-btn');
    const stationId = previewBtn ? previewBtn.dataset.targetStation : null;
    closeStationDevModal();
    if (stationId && typeof performStationSwitch === 'function') {
        performStationSwitch(stationId);
    }
}

export function openPhoneStationModal() {
    const modal = document.getElementById('phone-station-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

export function closePhoneStationModal(event) {
    if (event && event.target && event.target.id !== 'phone-station-modal' && !event.target.classList.contains('phone-station-modal-close')) {
        return;
    }
    const modal = document.getElementById('phone-station-modal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 220);
    }
}

export function handlePhoneSelectStation(stationId) {
    closePhoneStationModal();
    if (typeof switchResearchStation === 'function') {
        switchResearchStation(stationId);
    }
    if (typeof window.setPhoneSheetSnap === 'function') {
        window.setPhoneSheetSnap('peek');
    }
}

