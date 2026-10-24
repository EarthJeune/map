// DA-CALABARZON Multi-Station Wayfinding Manager
// Manages station selection, lag-free regional camera flyovers, and station data hydration.

import { STATIONS, DEFAULT_STATION_ID, getActiveStationDefaultView, getStationIntroViews } from './data/stations.js';
import { state } from './data/state.js';
import { map, stopIntroAnimation, playIntroAnimation } from './map-setup.js';
import { INTRO_START_VIEW } from './data/config.js';
import { buildDirectory } from './sidebar.js';
import { removeMarkers, createMarkers, createEntranceArrowMarker, removeSectionBadges } from './markers.js';
import { createKioskMarker, stopIdleRotation, resetIdle } from './idle.js';

let activeFlyNotificationTimer = null;

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

    if (STATIONS[activeStationId] && STATIONS[activeStationId].bounds && map) {
        try { map.setMaxBounds(STATIONS[activeStationId].bounds); } catch (e) {}
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
        const isActive = item.dataset.station === stationId;
        item.classList.toggle('active', isActive);
        const statusEl = item.querySelector('.station-item-status');
        if (statusEl) {
            statusEl.textContent = isActive ? 'Active' : 'Select';
            statusEl.classList.toggle('active-badge', isActive);
        }
    });

    // Update Phone UI station indicator and modal cards
    const phonePillName = document.getElementById('phone-station-pill-name');
    const phoneBannerName = document.getElementById('phone-station-banner-name');
    if (phonePillName) phonePillName.textContent = st.name || st.label;
    if (phoneBannerName) phoneBannerName.textContent = st.label;

    document.querySelectorAll('.phone-station-card').forEach(card => {
        const isActive = card.dataset.station === stationId;
        card.classList.toggle('active', isActive);
        const statusEl = card.querySelector('.psc-status');
        if (statusEl) {
            statusEl.textContent = isActive ? 'Active' : 'Select';
            statusEl.classList.toggle('active', isActive);
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
    notif.innerHTML = `<span>✈️</span> <span>${text}</span>`;
    notif.classList.add('active');

    if (activeFlyNotificationTimer) clearTimeout(activeFlyNotificationTimer);
    activeFlyNotificationTimer = setTimeout(() => {
        notif.classList.remove('active');
    }, 3500);
}

export function switchResearchStation(stationId) {
    closeStationDropdown();

    if (!STATIONS[stationId]) return;
    if (state.currentStationId === stationId) return;

    const prevStationId = state.currentStationId || 'lares';
    const targetStation = STATIONS[stationId];
    state.currentStationId = stationId;

    try {
        localStorage.setItem('da_current_station', stationId);
    } catch (e) {}

    updateStationUI(stationId);

    // 1. Show Smooth Transition Curtain
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
    }

    // Immediately cancel any in-flight intro animations, camera paths, or idle rotations
    if (typeof stopIntroAnimation === 'function') {
        stopIntroAnimation();
    }
    if (typeof stopIdleRotation === 'function') {
        stopIdleRotation();
    }
    if (typeof resetIdle === 'function') {
        resetIdle();
    }
    if (map) {
        try { map.stop(); } catch (e) {}
    }

    // Reset any active route / building panels without initiating flyTo
    if (typeof window.closeRouteAndReset === 'function') {
        try { window.closeRouteAndReset(); } catch (e) {}
    }
    if (typeof window.closeBuildingPanel === 'function') {
        try { window.closeBuildingPanel(true); } catch (e) {}
    }

    // 2. Perform Seamless Teleport Behind the Curtain (280ms fade-in)
    setTimeout(() => {
        // A. Clean up previous station's unique elements
        if (prevStationId === 'lares') {
            // Hide LARES dark vignette mask
            if (map.getLayer('lares-mask-layer')) {
                try { map.setLayoutProperty('lares-mask-layer', 'visibility', 'none'); } catch (e) {}
            }

            // Hide LARES 3D models, drone raster layer, plots, boundary lines, roads, and trees
            const laresLayers = [
                '3d-buildings-models-layer',
                '3d-buildings-translucent-layer',
                '3d-drawings',
                '3d-drawings-extrusion',
                '3d-drawings-roofs',
                'lares-drone-layer',
                'google-satellite-overlay-layer',
                'lares-boundary-line',
                'lares-boundary-glow',
                'lares-boundary-fill',
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

            // Remove ALL LARES building numbered markers & badges
            if (typeof removeMarkers === 'function') {
                removeMarkers();
            }
            if (typeof removeSectionBadges === 'function') {
                removeSectionBadges();
            }
            document.querySelectorAll('.bldg-map-marker').forEach(el => el.remove());

            // Remove LARES Kiosk "You Are Here" pin
            if (state.kioskMarkerInstance) {
                state.kioskMarkerInstance.remove();
                state.kioskMarkerInstance = null;
            }

            // Remove LARES entrance arrow marker
            if (state.entranceArrowMarker) {
                state.entranceArrowMarker.remove();
                state.entranceArrowMarker = null;
            }

        } else if (prevStationId === 'qares') {
            // Hide QARES specific layers
            const qaresLayers = [
                'qares-ortho-layer',
                'qares-boundary-fill',
                'qares-boundary-line',
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
            if (state.qaresKioskMarkerInstance) {
                state.qaresKioskMarkerInstance.remove();
                state.qaresKioskMarkerInstance = null;
            }
            if (state.kioskMarkerInstance) {
                state.kioskMarkerInstance.remove();
                state.kioskMarkerInstance = null;
            }
        }

        // Ensure satellite base map layer is VISIBLE
        if (map.getLayer('google-satellite-layer')) {
            try { map.setLayoutProperty('google-satellite-layer', 'visibility', 'visible'); } catch (e) {}
        }

        // Release bounds temporarily to permit snap
        try {
            map.setMaxBounds([
                [120.40, 13.30],
                [122.80, 15.00]
            ]);
        } catch (e) {}

        // B. Instant Glitch-Free Camera Teleport (zero tile flickering)
        const introViews = getStationIntroViews(stationId);
        map.jumpTo({
            center: introViews.start.center,
            zoom: introViews.start.zoom,
            pitch: introViews.start.pitch,
            bearing: introViews.start.bearing
        });

        // C. Mount Target Station Data
        if (stationId === 'lares') {
            // Restore LARES layers
            const laresLayers = [
                '3d-buildings-models-layer',
                '3d-buildings-translucent-layer',
                '3d-drawings',
                '3d-drawings-extrusion',
                '3d-drawings-roofs',
                'lares-mask-layer',
                'lares-boundary-line',
                'lares-boundary-glow',
                'lares-boundary-fill',
                'lares-compound-border-line',
                'plots-fill',
                'plots-line',
                'plots-labels'
            ];
            laresLayers.forEach(id => {
                if (map.getLayer(id)) {
                    try { map.setLayoutProperty(id, 'visibility', 'visible'); } catch (e) {}
                }
            });

            // Stylized vector road lines should ONLY be visible in Mapbox 3D vector mode, NEVER in Aerial Drone mode
            const showVectorRoads = (state.currentMapStyleMode === 'mapbox');
            ['lares-roads-casing', 'lares-roads-fill', 'lares-roads-network'].forEach(id => {
                if (map.getLayer(id)) {
                    try { map.setLayoutProperty(id, 'visibility', showVectorRoads ? 'visible' : 'none'); } catch (e) {}
                }
            });

            // Restore Drone Layer if in Google style
            if (map.getLayer('lares-drone-layer') && state.currentMapStyleMode === 'google') {
                try { map.setLayoutProperty('lares-drone-layer', 'visibility', 'visible'); } catch (e) {}
            }

            // Restore Trees if enabled
            if (map.getLayer('trees-3d') && state.treesVisible) {
                try { map.setLayoutProperty('trees-3d', 'visibility', 'visible'); } catch (e) {}
            }

            // Restore LARES markers & pins
            if (typeof createMarkers === 'function') {
                createMarkers();
            }
            if (typeof createKioskMarker === 'function') {
                createKioskMarker();
            }
            if (typeof createEntranceArrowMarker === 'function') {
                createEntranceArrowMarker();
            }

            // Restore LARES Directory & Categories
            if (typeof buildDirectory === 'function') {
                buildDirectory();
            }
            renderStationCategoryBar('lares');

        } else if (stationId === 'qares') {
            renderStationCategoryBar('qares');

            loadQARESData();

            // Mount QARES Kiosk "You Are Here" pin
            if (typeof createKioskMarker === 'function') {
                createKioskMarker();
            }

        }

        // 3. Smooth Fade-Out Curtain after content settles & initiate signature intro fly-in for active station
        setTimeout(() => {
            if (curtain) {
                curtain.classList.remove('active');
                curtain.setAttribute('aria-hidden', 'true');
            }
            playIntroAnimation();
        }, 320);

    }, 280);
}

let qaresEventsBound = false;
function bindQARESBuildingEvents() {
    if (!map || qaresEventsBound) return;
    qaresEventsBound = true;

    const onQaresBuildingClick = (e) => {
        if (!e.features || !e.features.length) return;
        const f = e.features[0];
        const p = f.properties || {};
        const name = p.name || p.id || 'QARES Facility';
        const cat = p.filter_type || p.category || 'Buildings';
        const code = (p.color_code || 'red').toUpperCase();
        const colorHex = p.color || '#ef4444';
        const h = p.height || 5;

        new mapboxgl.Popup({ closeButton: true, closeOnClick: true, offset: 15 })
            .setLngLat(e.lngLat)
            .setHTML(`
                <div style="font-family: inherit; padding: 6px 8px; color: #0f172a; min-width: 170px;">
                    <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: ${colorHex}; margin-bottom: 2px;">
                        ● ${cat} (${code})
                    </div>
                    <div style="font-size: 14px; font-weight: 700; color: #020617; line-height: 1.25; margin-bottom: 4px;">
                        ${name}
                    </div>
                    <div style="font-size: 11px; color: #64748b;">
                        Facility Height: <strong>${h}m</strong>
                    </div>
                </div>
            `)
            .addTo(map);
    };

    map.on('click', 'qares-footprints-3d', onQaresBuildingClick);
    map.on('click', 'qares-footprints-roofs', onQaresBuildingClick);
    map.on('mouseenter', 'qares-footprints-3d', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'qares-footprints-3d', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'qares-footprints-roofs', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'qares-footprints-roofs', () => { map.getCanvas().style.cursor = ''; });
}

export function loadQARESData() {
    const isDrone = (state.currentMapStyleMode === 'google');

    // 0. Ensure structural QARES layers are visible
    const qaresLayerIds = [
        'qares-boundary-fill',
        'qares-boundary-line',
        'qares-footprints-3d',
        'qares-footprints-roofs'
    ];
    qaresLayerIds.forEach(id => {
        if (map && map.getLayer(id)) {
            try { map.setLayoutProperty(id, 'visibility', 'visible'); } catch (e) {}
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

    // 3. QARES Compound Official Boundary Outline
    if (!map.getSource('qares-boundary-source')) {
        map.addSource('qares-boundary-source', {
            type: 'geojson',
            data: 'qares_boundary.json'
        });
    }
    if (!map.getLayer('qares-boundary-fill') && map.getSource('qares-boundary-source')) {
        map.addLayer({
            id: 'qares-boundary-fill',
            type: 'fill',
            source: 'qares-boundary-source',
            slot: 'middle',
            paint: {
                'fill-color': '#10b981',
                'fill-opacity': 0.08
            }
        });
    } else if (map.getLayer('qares-boundary-fill')) {
        try { map.setLayoutProperty('qares-boundary-fill', 'visibility', 'visible'); } catch (e) {}
    }

    if (!map.getLayer('qares-boundary-line') && map.getSource('qares-boundary-source')) {
        map.addLayer({
            id: 'qares-boundary-line',
            type: 'line',
            source: 'qares-boundary-source',
            slot: 'middle',
            paint: {
                'line-color': '#10b981',
                'line-width': 2.5,
                'line-dasharray': [3, 1]
            }
        });
    } else if (map.getLayer('qares-boundary-line')) {
        try { map.setLayoutProperty('qares-boundary-line', 'visibility', 'visible'); } catch (e) {}
    }

    // Helper: Mount/Sync QARES Footprints Source & 3D Extrusion Layers
    function applyQARESFootprints(data) {
        if (!map || !data) return;
        qaresBuildingsBaseline = data;

        // 1. Ensure source
        if (!map.getSource('qares-footprints-source')) {
            map.addSource('qares-footprints-source', { type: 'geojson', data: data });
        } else {
            try { map.getSource('qares-footprints-source').setData(data); } catch (e) {}
        }

        const bldgVis = state.buildingsVisible ? 'visible' : 'none';

        // 2. 3D Extruded Building Walls (Ground to Height)
        if (!map.getLayer('qares-footprints-3d') && map.getSource('qares-footprints-source')) {
            map.addLayer({
                id: 'qares-footprints-3d',
                type: 'fill-extrusion',
                source: 'qares-footprints-source',
                slot: 'middle',
                layout: {
                    'visibility': bldgVis
                },
                paint: {
                    'fill-extrusion-color': ['coalesce', ['get', 'color'], '#ef4444'],
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
                map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-color', ['coalesce', ['get', 'color'], '#ef4444']);
                map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-height', ['coalesce', ['get', 'height'], 5]);
                map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-base', ['coalesce', ['get', 'min_height'], 0]);
                map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-opacity', 0.95);
                map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-emissive-strength', 0.35);
                map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-cast-shadows', false);
            } catch (e) {}
        }

        // 3. 3D Architectural Roof Slab (Elevated Cap matching Roof Color)
        if (!map.getLayer('qares-footprints-roofs') && map.getSource('qares-footprints-source')) {
            map.addLayer({
                id: 'qares-footprints-roofs',
                type: 'fill-extrusion',
                source: 'qares-footprints-source',
                slot: 'middle',
                layout: {
                    'visibility': bldgVis
                },
                paint: {
                    'fill-extrusion-color': ['coalesce', ['get', 'roof_color'], '#dc2626'],
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
                map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-color', ['coalesce', ['get', 'roof_color'], '#dc2626']);
                map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-height', ['+', ['coalesce', ['get', 'height'], 5], 0.35]);
                map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-base', ['coalesce', ['get', 'height'], 5]);
                map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-opacity', 1.0);
                map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-emissive-strength', 0.35);
                map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-cast-shadows', false);
            } catch (e) {}
        }

        // Hide legacy flat 2D ground layers so they don't clip under 3D models
        if (map.getLayer('qares-footprints-fill')) try { map.setLayoutProperty('qares-footprints-fill', 'visibility', 'none'); } catch (e) {}
        if (map.getLayer('qares-footprints-line')) try { map.setLayoutProperty('qares-footprints-line', 'visibility', 'none'); } catch (e) {}

        // Bind interactive click & hover handlers once
        bindQARESBuildingEvents();

        // Render Directory for QARES with active filter
        renderQARESDirectory(data, activeQARESCategory);

        // Re-apply active category filter (All, Buildings, Misc Buildings, Utilities)
        if (typeof filterQARESByCategory === 'function' && activeQARESCategory) {
            filterQARESByCategory(activeQARESCategory);
        }
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

    // 3. Fetch QARES Roads GeoJSON (pathfinding topology only, no visible road outline)
    fetch('qares_roads.json?v=' + Date.now())
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
        })
        .catch(e => {});

    // Ensure QARES Kiosk "You Are Here" pin is mounted
    if (typeof createKioskMarker === 'function') {
        createKioskMarker();
    }
}

// Station Category Bar Renderer (Syncs Desktop & Mobile)
export function renderStationCategoryBar(stationId) {
    const isQARES = (stationId === 'qares');
    const catBar = document.getElementById('kiosk-categories-bar');
    const phoneCatBar = document.getElementById('phone-categories-bar');
    const quickTags = document.getElementById('kiosk-quick-tags');

    if (isQARES) {
        const html = `
            <button class="cat-chip ${activeQARESCategory === 'all' ? 'active' : ''}" data-cat="all" onclick="filterQARESByCategory('all')">🌐 All</button>
            <button class="cat-chip ${activeQARESCategory === 'Buildings' ? 'active' : ''}" data-cat="Buildings" onclick="filterQARESByCategory('Buildings')">🏢 Buildings</button>
            <button class="cat-chip ${activeQARESCategory === 'Misc Buildings' ? 'active' : ''}" data-cat="Misc Buildings" onclick="filterQARESByCategory('Misc Buildings')">🏠 Misc Buildings</button>
            <button class="cat-chip ${activeQARESCategory === 'Utilities' ? 'active' : ''}" data-cat="Utilities" onclick="filterQARESByCategory('Utilities')">⚡ Utilities</button>
        `;
        if (catBar) {
            catBar.innerHTML = html;
            catBar.style.display = 'flex';
        }
        if (phoneCatBar) {
            phoneCatBar.innerHTML = html;
            phoneCatBar.style.display = 'flex';
        }
        if (quickTags) quickTags.style.display = 'none';
    } else {
        // LARES: Filters are for QARES standalone only, NOT in LARES
        if (catBar) {
            catBar.innerHTML = '';
            catBar.style.display = 'none';
        }
        if (phoneCatBar) {
            phoneCatBar.innerHTML = '';
            phoneCatBar.style.display = 'none';
        }
        if (quickTags) quickTags.style.display = 'flex';
    }
}

// QARES Directory & Categorization State
let qaresBuildingsBaseline = null;
let activeQARESCategory = 'all';

export function filterQARESByCategory(cat) {
    activeQARESCategory = cat;
    document.querySelectorAll('#kiosk-categories-bar .cat-chip, #phone-categories-bar .cat-chip').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === cat);
    });

    const searchVal = (document.getElementById('search-input')?.value || document.getElementById('phone-search-input')?.value || '').trim();
    if (searchVal) {
        filterQARESSearch(searchVal);
    } else if (qaresBuildingsBaseline) {
        renderQARESDirectory(qaresBuildingsBaseline, cat);
    }

    if (map) {
        if (cat === 'all') {
            // Restore visibility of all QARES buildings
            ['qares-footprints-3d', 'qares-footprints-roofs', 'qares-footprints-fill', 'qares-footprints-line'].forEach(id => {
                if (map.getLayer(id)) {
                    try { map.setFilter(id, null); } catch (e) {}
                }
            });
            if (map.getLayer('qares-footprints-3d')) {
                map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-color', ['coalesce', ['get', 'color'], '#ef4444']);
                map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-opacity', 0.95);
            }
            if (map.getLayer('qares-footprints-roofs')) {
                map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-color', ['coalesce', ['get', 'roof_color'], '#dc2626']);
                map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-opacity', 1.0);
            }
        } else {
            // When Buildings, Misc Buildings, or Utilities is selected:
            // Directly hide non-matching buildings cleanly using setFilter
            const catFilter = ['==', ['coalesce', ['get', 'filter_type'], ['get', 'category'], 'Buildings'], cat];
            ['qares-footprints-3d', 'qares-footprints-roofs', 'qares-footprints-fill', 'qares-footprints-line'].forEach(id => {
                if (map.getLayer(id)) {
                    try { map.setFilter(id, catFilter); } catch (e) {}
                }
            });
            if (map.getLayer('qares-footprints-3d')) {
                map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-color', ['coalesce', ['get', 'color'], '#ef4444']);
                map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-opacity', 0.95);
            }
            if (map.getLayer('qares-footprints-roofs')) {
                map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-color', ['coalesce', ['get', 'roof_color'], '#dc2626']);
                map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-opacity', 1.0);
            }
        }
    }
}

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
            const matchesText = !q || name.includes(q) || id.includes(q) || cat.includes(q) || colorCode.includes(q);
            const matchesCat = (activeQARESCategory === 'all') || ((p.filter_type || p.category || 'Buildings') === activeQARESCategory);
            return matchesText && matchesCat;
        })
    };
    renderQARESDirectory(filtered, activeQARESCategory, true);
}

export function renderQARESDirectory(data, filterCat = 'all', isPreFiltered = false) {
    if (!isPreFiltered) qaresBuildingsBaseline = data;
    const dirEl = document.getElementById('directory');
    const phoneDirEl = document.getElementById('phone-directory-list');

    const QARES_COLORS_DEF = {
        red: { name: 'Red', hex: '#ef4444', icon: '🔴' },
        blue: { name: 'Blue', hex: '#3b82f6', icon: '🔵' },
        green: { name: 'Green', hex: '#22c55e', icon: '🟢' },
        yellow: { name: 'Yellow', hex: '#eab308', icon: '🟡' },
        light_grey: { name: 'Light Grey', hex: '#94a3b8', icon: '⚪' },
        pink: { name: 'Pink', hex: '#ec4899', icon: '🌸' },
        brown: { name: 'Brown', hex: '#92400e', icon: '🟤' }
    };

    const allFeatures = data.features || [];
    const features = isPreFiltered ? allFeatures : allFeatures.filter(f => {
        if (filterCat === 'all') return true;
        const cat = f.properties.filter_type || f.properties.category || 'Buildings';
        return cat === filterCat;
    });

    if (dirEl) {
        const catLabels = {
            'all': 'FACILITIES',
            'Buildings': 'BUILDINGS',
            'Misc Buildings': 'MISC BUILDINGS',
            'Utilities': 'UTILITIES'
        };
        const titleText = catLabels[filterCat] || filterCat.toUpperCase();
        let html = `<div style="padding: 12px 16px 8px; font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; display:flex; justify-content:space-between; align-items:center;">
            <span>QARES ${titleText} (${features.length})</span>
            <span style="font-size:10px; color:#38bdf8; font-weight:600;">Tiaong, Quezon</span>
        </div>`;

        if (features.length === 0) {
            html += `<div style="padding: 36px 16px; text-align: center; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                <div style="font-size: 28px; margin-bottom: 8px;">📂</div>
                No facilities found under <strong>${filterCat}</strong>.
            </div>`;
        } else {
            features.forEach((f, idx) => {
                const props = f.properties || {};
                const name = props.name || props.id || `Facility ${idx + 1}`;
                const cat = props.filter_type || props.category || 'Buildings';
                const cKey = props.color_code || 'red';
                const colorHex = props.color || (QARES_COLORS_DEF[cKey] ? QARES_COLORS_DEF[cKey].hex : '#ef4444');
                const catIcon = cat === 'Agricultural Facilities' ? '🌾' : cat === 'Misc Buildings' ? '🏠' : cat === 'Utilities' ? '⚡' : '🏢';

                let centerCoords = [121.37152, 13.94609];
                if (f.geometry && f.geometry.type === 'Polygon' && f.geometry.coordinates && f.geometry.coordinates[0]) {
                    const ring = f.geometry.coordinates[0];
                    let sumLng = 0, sumLat = 0;
                    ring.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
                    centerCoords = [sumLng / ring.length, sumLat / ring.length];
                }

                html += `
                    <div class="directory-card" onclick="flyToQARESFacility(${centerCoords[0]}, ${centerCoords[1]})" style="margin: 0 12px 8px; padding: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-left: 4px solid ${colorHex}; border-radius: 12px; cursor: pointer; transition: all 0.2s ease;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width: 28px; height: 28px; border-radius: 8px; background: ${colorHex}22; border: 1px solid ${colorHex}55; display: flex; align-items: center; justify-content: center; font-size: 14px;">
                                ${catIcon}
                            </div>
                            <div style="flex:1; min-width:0;">
                                <div style="font-size:13px; font-weight:700; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>
                                <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                                    <span style="font-size:10px; font-weight:700; color:${colorHex}; text-transform:uppercase; letter-spacing:0.4px;">● ${cKey}</span>
                                    <span style="color:rgba(255,255,255,0.2);">•</span>
                                    <span style="font-size:10.5px; color:#94a3b8;">${cat}</span>
                                </div>
                            </div>
                            <span style="color:#38bdf8; font-size:12px;">→</span>
                        </div>
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
                <div style="font-size: 28px; margin-bottom: 8px;">📂</div>
                No facilities found under <strong>${filterCat}</strong>.
            </div>`;
        } else {
            features.forEach((f, idx) => {
                const props = f.properties || {};
                const name = props.name || props.id || `Facility ${idx + 1}`;
                const cat = props.filter_type || props.category || 'Buildings';
                const cKey = props.color_code || 'red';
                const colorHex = props.color || (QARES_COLORS_DEF[cKey] ? QARES_COLORS_DEF[cKey].hex : '#ef4444');

                let centerCoords = [121.37152, 13.94609];
                if (f.geometry && f.geometry.type === 'Polygon' && f.geometry.coordinates && f.geometry.coordinates[0]) {
                    const ring = f.geometry.coordinates[0];
                    let sumLng = 0, sumLat = 0;
                    ring.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
                    centerCoords = [sumLng / ring.length, sumLat / ring.length];
                }

                phtml += `
                    <div class="phone-dir-item" onclick="flyToQARESFacility(${centerCoords[0]}, ${centerCoords[1]}); if(window.setPhoneSheetSnap) window.setPhoneSheetSnap('peek');" style="cursor: pointer; border-left: 3px solid ${colorHex};">
                        <div class="phone-dir-badge" style="background:${colorHex}; color:#fff; font-weight:700;">
                            ${idx + 1}
                        </div>
                        <div class="phone-dir-info">
                            <div class="phone-dir-name">${name}</div>
                            <div class="phone-dir-sub">${cat} • <span style="color:${colorHex}; font-weight:600;">${cKey.toUpperCase()}</span></div>
                        </div>
                        <div class="phone-dir-arrow">›</div>
                    </div>
                `;
            });
        }
        phoneDirEl.innerHTML = phtml;
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
    window.flyToQARESFacility = function(lng, lat) {
        if (!map) return;
        map.flyTo({
            center: [lng, lat],
            zoom: 18.5,
            pitch: 52,
            essential: true
        });
    };
    window.openPhoneStationModal = openPhoneStationModal;
    window.closePhoneStationModal = closePhoneStationModal;
    window.handlePhoneSelectStation = handlePhoneSelectStation;
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

