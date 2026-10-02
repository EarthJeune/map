// DA-LARES Wayfinding — Main Application Module

import {
    MAPBOX_ACCESS_TOKEN,
    CENTER,
    SECTION_COLORS,
    SECTION_PASTEL_COLORS,
    MAPBOX_VIEW_PRESET,
    DEFAULT_MAP_VIEW,
    INTRO_START_VIEW,
    INTRO_TARGET_2D_VIEW,
    VIEWS,
    PREDEFINED_ROUTES,
    SAVED_MAIN_KIOSK_COORDS,
    IDLE_TIMEOUT
} from './data/config.js';

import {
    DA_LARES_OUTER_PERIMETER,
    LARES_MASK,
    LARES_COMPOUND_OUTLINE,
    LARES_TREES,
    LARES_BOUNDARY
} from './data/geo.js';

import {
    LARES_DRAWINGS,
    KNOWN_BUILDING_NAMES,
    CUSTOM_BUILDING_CENTERS,
    BUILDING_DIRECTORY
} from './data/buildings.js';

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
let KIOSK_COORDS = [...SAVED_MAIN_KIOSK_COORDS];
let savedBuildingColors = {};
let markers = [];
let terrainEnabled = false;
let currentLighting = 'day';
let activeRoute = null;
let routeAnimFrame = null;
let idleTimer = null;
let idleRotating = false;
let orbitAnimFrame = null;
let isOrbiting = false;
let orbitTimeout = null;
let markersVisible = true;
let selectedBuildingId = null;

// ==========================================
// MAP — Mapbox Satellite Streets Base with Google Satellite Dual-Layer
// ==========================================
const urlParams = new URLSearchParams(window.location.search);
const urlViewParam = urlParams.get('view') || urlParams.get('mode');
let currentMapStyleMode = (urlViewParam === 'mapbox') ? 'mapbox' : 'google';
let treesVisible = false;
let buildingsVisible = true;

const map = new mapboxgl.Map({
    container: 'map',
    style: (currentMapStyleMode === 'mapbox')
        ? 'mapbox://styles/mapbox/standard'
        : 'mapbox://styles/mapbox/satellite-streets-v12',
    center: INTRO_START_VIEW.center,
    zoom: INTRO_START_VIEW.zoom,
    pitch: INTRO_START_VIEW.pitch,
    bearing: INTRO_START_VIEW.bearing,
    antialias: true
});

// ==========================================
// SETUP — on every style load
// ==========================================
let sectionBadges = [];
let entranceArrowMarker = null;

function renderSectionBadges() {
    removeSectionBadges();
    if (currentMapStyleMode !== 'mapbox') return;
    const boundaryBtn = document.getElementById('chip-boundary');
    const isBoundaryOn = boundaryBtn ? boundaryBtn.classList.contains('active') : true;

    const secDefs = [
        { id: 1, coords: [121.17110, 13.96060], dotClass: 'sec-dot-blue' },
        { id: 2, coords: [121.16940, 13.95980], dotClass: 'sec-dot-orange' },
        { id: 3, coords: [121.16680, 13.95895], dotClass: 'sec-dot-green' }
    ];
    secDefs.forEach(s => {
        const el = document.createElement('div');
        el.className = 'sec-custom-badge';
        if (!isBoundaryOn) el.style.display = 'none';
        el.innerHTML = `
            <span class="sec-badge-circle ${s.dotClass}"></span>
            <span class="sec-text-part">Section ${s.id}</span>
        `;
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat(s.coords)
            .addTo(map);
        sectionBadges.push(marker);
    });
}

function removeSectionBadges() {
    sectionBadges.forEach(m => m.remove());
    sectionBadges = [];
}

function createEntranceArrowMarker() {
    if (entranceArrowMarker) {
        entranceArrowMarker.remove();
        entranceArrowMarker = null;
    }
    const el = document.createElement('div');
    el.className = 'entrance-arrow-marker';
    el.innerHTML = `
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
    `;
    entranceArrowMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([121.16584, 13.95912])
        .addTo(map);
}

function setupLayers() {
    // If in Mapbox Standard mode, use dedicated setup path
    if (currentMapStyleMode === 'mapbox') {
        setupMapboxStandardLayers();
        return;
    }

    // 1. Terrain (disabled by default)
    if (terrainEnabled) {
        if (!map.getSource('mapbox-dem')) {
            map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
        }
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    } else {
        try { map.setTerrain(null); } catch (e) { }
    }

    // 2. Google Satellite raster source & layer (rendered at the bottom)
    if (!map.getSource('google-satellite')) {
        map.addSource('google-satellite', {
            'type': 'raster',
            'tiles': [
                'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
            ],
            'tileSize': 256,
            'maxzoom': 22
        });
    }
    if (!map.getLayer('google-satellite-layer')) {
        map.addLayer({
            'id': 'google-satellite-layer',
            'type': 'raster',
            'source': 'google-satellite',
            'layout': {
                'visibility': (currentMapStyleMode === 'google') ? 'visible' : 'none'
            }
        });
    }

    // 3. Section ground fills & boundary lines (added first so buildings & roads render ON TOP)
    LARES_BOUNDARY.features.forEach(f => {
        const fid = f.properties.fid;
        const color = SECTION_COLORS[fid];
        const pastel = SECTION_PASTEL_COLORS[fid] || color;
        const src = `sec-${fid}`;
        if (!map.getSource(src)) map.addSource(src, { type: 'geojson', data: f });

        // Fill ground layer
        if (!map.getLayer(`sec-fill-${fid}`)) {
            map.addLayer({
                id: `sec-fill-${fid}`,
                type: 'fill',
                source: src,
                layout: { 'visibility': 'none' },
                paint: {
                    'fill-color': color,
                    'fill-opacity': [
                        'interpolate', ['linear'], ['zoom'],
                        15.5, 0.35,
                        17.5, 0.0
                    ]
                }
            });
        }

        // Boundary glow (Google mode)
        if (!map.getLayer(`sec-glow-${fid}`)) {
            map.addLayer({
                id: `sec-glow-${fid}`,
                type: 'line',
                source: src,
                layout: { 'visibility': 'none' },
                paint: {
                    'line-color': color,
                    'line-width': 12,
                    'line-blur': 4,
                    'line-opacity': [
                        'interpolate', ['linear'], ['zoom'],
                        16, 0.6,
                        18, 0.0
                    ]
                }
            });
        }

        // Crisp boundary line
        if (!map.getLayer(`sec-line-${fid}`)) {
            map.addLayer({
                id: `sec-line-${fid}`,
                type: 'line',
                source: src,
                layout: { 'visibility': 'none' },
                paint: {
                    'line-color': color,
                    'line-width': 3,
                    'line-opacity': [
                        'interpolate', ['linear'], ['zoom'],
                        16, 1.0,
                        18, 0.2
                    ]
                }
            });
        }
    });

    // 4. Stylized Road Network (from roads.json) - rendered directly on top of section ground fills
    if (!map.getSource('lares-roads-source')) {
        map.addSource('lares-roads-source', {
            type: 'geojson',
            data: 'roads.json'
        });
    }
    if (!map.getLayer('lares-roads-casing')) {
        map.addLayer({
            'id': 'lares-roads-casing',
            'type': 'line',
            'source': 'lares-roads-source',
            'filter': ['==', '$type', 'LineString'],
            'layout': {
                'line-cap': 'round',
                'line-join': 'round',
                'visibility': (currentMapStyleMode === 'mapbox') ? 'visible' : 'none'
            },
            'paint': {
                'line-color': '#64748b',
                'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    14, 3,
                    16, 7.5,
                    18, 13,
                    20, 20
                ],
                'line-opacity': 0.65
            }
        });
    }
    if (!map.getLayer('lares-roads-fill')) {
        map.addLayer({
            'id': 'lares-roads-fill',
            'type': 'line',
            'source': 'lares-roads-source',
            'filter': ['==', '$type', 'LineString'],
            'layout': {
                'line-cap': 'round',
                'line-join': 'round',
                'visibility': (currentMapStyleMode === 'mapbox') ? 'visible' : 'none'
            },
            'paint': {
                'line-color': '#94a3b8',
                'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    14, 2,
                    16, 5.5,
                    18, 10.5,
                    20, 16
                ],
                'line-opacity': 0.95
            }
        });
    }

    // 5. Dark Vignette / Boundary Mask (Isolates DA-LARES compound in 3D dark void space)
    if (!map.getSource('lares-mask-source')) {
        map.addSource('lares-mask-source', {
            type: 'geojson',
            data: LARES_MASK
        });
    }
    if (!map.getLayer('lares-mask-layer')) {
        map.addLayer({
            'id': 'lares-mask-layer',
            'type': 'fill',
            'source': 'lares-mask-source',
            'layout': {
                'visibility': 'visible'
            },
            'paint': {
                'fill-color': (currentMapStyleMode === 'mapbox') ? '#060a12' : '#0b1121',
                'fill-opacity': 1.0
            }
        });
    }

    // 6. Custom Traced DA-LARES 3D Buildings (33 Facilities)
    if (!map.getSource('lares-drawings-source')) {
        map.addSource('lares-drawings-source', {
            type: 'geojson',
            data: LARES_DRAWINGS
        });
    }
    if (!map.getLayer('3d-drawings')) {
        map.addLayer({
            'id': '3d-drawings',
            'source': 'lares-drawings-source',
            'type': 'fill-extrusion',
            'minzoom': 13,
            'layout': {
                'visibility': buildingsVisible ? 'visible' : 'none'
            },
            'paint': {
                'fill-extrusion-color': (currentMapStyleMode === 'mapbox') ? '#f8fafc' : '#cbd5e1',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': (currentMapStyleMode === 'mapbox') ? 1.0 : 0.95
            }
        });
    }
    if (!map.getLayer('3d-drawings-roofs')) {
        map.addLayer({
            'id': '3d-drawings-roofs',
            'source': 'lares-drawings-source',
            'type': 'fill-extrusion',
            'minzoom': 13,
            'layout': {
                'visibility': buildingsVisible ? 'visible' : 'none'
            },
            'paint': {
                'fill-extrusion-color': (currentMapStyleMode === 'mapbox') ? '#e2e8f0' : getRoofColorCaseStyle(),
                'fill-extrusion-height': ['+', ['get', 'height'], 0.25],
                'fill-extrusion-base': ['get', 'height'],
                'fill-extrusion-opacity': 1.0
            }
        });
    }

    // 7. 3D Trees — DISABLED for now
    // if (typeof LARES_TREES !== 'undefined' && LARES_TREES.features) {
    //     ensureTreeIconLoaded(() => {
    //         renderTreesLayer();
    //     });
    // }

    // 8. Main Entrance Arrow Marker
    createEntranceArrowMarker();

    // 9. Floating Section Badges — Mapbox view only (never in Google Maps view)
    removeSectionBadges();

    // 10. Building Name Markers
    removeMarkers();
    createMarkers();

    // Hide ALL Mapbox base style layers (roads, labels, fills, native buildings, etc.)
    // We provide our own Google satellite tiles + custom layers, so nothing from the base is needed.
    const customPrefixes = ['sec-', 'lares-', 'route-', 'google-', '3d-', 'gps-', 'phone-'];
    map.getStyle().layers.forEach(layer => {
        const isCustom = customPrefixes.some(p => layer.id.startsWith(p));
        if (!isCustom) {
            try { map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (e) { }
        }
    });

    // Sync visual properties with current mode
    setMapStyleMode(currentMapStyleMode);
}

// ==========================================
// MAPBOX STANDARD MODE — Native 3D environment
// ==========================================
function setupMapboxStandardLayers() {
    // 1. Configure Mapbox Standard style properties
    // Hide all external buildings (3D + 2D) and trees. Keep roads!
    try {
        map.setConfigProperty('basemap', 'show3dObjects', false);
        map.setConfigProperty('basemap', 'show3dBuildings', false);
        map.setConfigProperty('basemap', 'show3dLandmarks', false);
        map.setConfigProperty('basemap', 'show3dTrees', false);
        map.setConfigProperty('basemap', 'colorBuildings', 'rgba(0,0,0,0)');
        map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
        map.setConfigProperty('basemap', 'showTransitLabels', false);
        map.setConfigProperty('basemap', 'showPlaceLabels', false);
        map.setConfigProperty('basemap', 'showRoadLabels', true);
    } catch(e) { console.warn('Config properties not supported:', e); }

    // 2. Stylized Internal Road Network (roads.json) — slot 'middle'
    if (!map.getSource('lares-roads-source')) {
        map.addSource('lares-roads-source', {
            type: 'geojson',
            data: 'roads.json'
        });
    }
    if (!map.getLayer('lares-roads-casing')) {
        map.addLayer({
            id: 'lares-roads-casing',
            type: 'line',
            source: 'lares-roads-source',
            slot: 'middle',
            filter: ['==', '$type', 'LineString'],
            layout: {
                'line-cap': 'round',
                'line-join': 'round',
                'visibility': 'visible'
            },
            paint: {
                'line-color': '#94a3b8',
                'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    14, 3,
                    16, 7.5,
                    18, 13,
                    20, 20
                ],
                'line-opacity': 0.65
            }
        });
    }
    if (!map.getLayer('lares-roads-fill')) {
        map.addLayer({
            id: 'lares-roads-fill',
            type: 'line',
            source: 'lares-roads-source',
            slot: 'middle',
            filter: ['==', '$type', 'LineString'],
            layout: {
                'line-cap': 'round',
                'line-join': 'round',
                'visibility': 'visible'
            },
            paint: {
                'line-color': '#f8fafc',
                'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    14, 2,
                    16, 5.5,
                    18, 10.5,
                    20, 16
                ],
                'line-opacity': 0.95
            }
        });
    }

    const boundaryBtn = document.getElementById('chip-boundary');
    const isBoundaryOn = boundaryBtn ? boundaryBtn.classList.contains('active') : true;
    const initBoundaryVis = isBoundaryOn ? 'visible' : 'none';

    // 3. Section dividing lines (no fills) — slot 'middle'
    LARES_BOUNDARY.features.forEach(f => {
        const fid = f.properties.fid;
        const src = `sec-${fid}`;
        if (!map.getSource(src)) map.addSource(src, { type: 'geojson', data: f });
        if (!map.getLayer(`sec-line-${fid}`)) {
            map.addLayer({
                id: `sec-line-${fid}`,
                type: 'line',
                source: src,
                slot: 'middle',
                layout: { 'visibility': initBoundaryVis },
                paint: {
                    'line-color': '#94a3b8',
                    'line-width': 1.5,
                    'line-opacity': 0.5
                }
            });
        }
    });

    // 4. Distinct DA-LARES Compound Border Outline (distinguishes the compound by outline only) — slot 'middle'
    if (!map.getSource('lares-compound-border-source')) {
        map.addSource('lares-compound-border-source', {
            type: 'geojson',
            data: LARES_COMPOUND_OUTLINE
        });
    }
    if (!map.getLayer('lares-compound-border-casing')) {
        map.addLayer({
            id: 'lares-compound-border-casing',
            type: 'line',
            source: 'lares-compound-border-source',
            slot: 'middle',
            layout: {
                'line-cap': 'round',
                'line-join': 'round',
                'visibility': initBoundaryVis
            },
            paint: {
                'line-color': '#334155',
                'line-width': 5,
                'line-opacity': 0.8
            }
        });
    }
    if (!map.getLayer('lares-compound-border-line')) {
        map.addLayer({
            id: 'lares-compound-border-line',
            type: 'line',
            source: 'lares-compound-border-source',
            slot: 'middle',
            layout: {
                'line-cap': 'round',
                'line-join': 'round',
                'visibility': initBoundaryVis
            },
            paint: {
                'line-color': '#0284c7',
                'line-width': 2.5,
                'line-opacity': 1.0
            }
        });
    }

    // 5. Custom DA-LARES 3D Buildings (33 traced footprints) — slot 'middle'
    if (!map.getSource('lares-drawings-source')) {
        map.addSource('lares-drawings-source', {
            type: 'geojson',
            data: LARES_DRAWINGS
        });
    }
    if (!map.getLayer('3d-drawings')) {
        map.addLayer({
            id: '3d-drawings',
            source: 'lares-drawings-source',
            type: 'fill-extrusion',
            slot: 'middle',
            minzoom: 13,
            layout: { visibility: buildingsVisible ? 'visible' : 'none' },
            paint: {
                'fill-extrusion-color': '#f0ece4',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.95,
                'fill-extrusion-emissive-strength': 0.3
            }
        });
    }
    if (!map.getLayer('3d-drawings-roofs')) {
        map.addLayer({
            id: '3d-drawings-roofs',
            source: 'lares-drawings-source',
            type: 'fill-extrusion',
            slot: 'middle',
            minzoom: 13,
            layout: { visibility: buildingsVisible ? 'visible' : 'none' },
            paint: {
                'fill-extrusion-color': '#e8e2d8',
                'fill-extrusion-height': ['+', ['get', 'height'], 0.25],
                'fill-extrusion-base': ['get', 'height'],
                'fill-extrusion-opacity': 1.0,
                'fill-extrusion-emissive-strength': 0.3
            }
        });
    }

    // 6. Section Badges & Entrance Arrow
    renderSectionBadges();
    createEntranceArrowMarker();

    // 7. Building Name Markers (numbered labels)
    removeMarkers();
    createMarkers();

    // 8. Update UI state
    setMapStyleMode(currentMapStyleMode);
}

function ensureTreeIconLoaded(callback) {
    if (map.hasImage('tree-icon')) {
        if (callback) callback();
        return;
    }

    function createBotanicalTreeCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');

        // Soft shadow at base
        ctx.beginPath();
        ctx.ellipse(64, 154, 28, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 25, 12, 0.4)';
        ctx.fill();

        // Trunk with wood gradient
        const trunk = ctx.createLinearGradient(56, 80, 72, 152);
        trunk.addColorStop(0, '#5a381e');
        trunk.addColorStop(0.5, '#734624');
        trunk.addColorStop(1, '#432712');
        ctx.fillStyle = trunk;
        ctx.beginPath();
        ctx.moveTo(60, 85);
        ctx.lineTo(68, 85);
        ctx.lineTo(72, 152);
        ctx.lineTo(56, 152);
        ctx.closePath();
        ctx.fill();

        // Foliage puffs
        const puffs = [
            { x: 64, y: 72, r: 35, c1: '#1b4324', c2: '#0e2915' },
            { x: 42, y: 76, r: 27, c1: '#1b4324', c2: '#0e2915' },
            { x: 86, y: 76, r: 27, c1: '#1b4324', c2: '#0e2915' },
            { x: 64, y: 52, r: 33, c1: '#2d6a37', c2: '#1b4324' },
            { x: 40, y: 56, r: 25, c1: '#347a3e', c2: '#1e4d27' },
            { x: 88, y: 56, r: 25, c1: '#2d6a37', c2: '#1b4324' },
            { x: 54, y: 38, r: 25, c1: '#52b761', c2: '#2d6a37' },
            { x: 74, y: 40, r: 23, c1: '#439d50', c2: '#23592d' },
            { x: 64, y: 26, r: 19, c1: '#6ec97d', c2: '#347a3e' }
        ];

        puffs.forEach(p => {
            ctx.save();
            const grad = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.1, p.x, p.y, p.r);
            grad.addColorStop(0, p.c1);
            grad.addColorStop(1, p.c2);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        return ctx.getImageData(0, 0, 128, 160);
    }

    map.loadImage('tree.png', (error, image) => {
        if (!error && image) {
            if (!map.hasImage('tree-icon')) map.addImage('tree-icon', image);
        } else {
            const imgData = createBotanicalTreeCanvas();
            if (!map.hasImage('tree-icon')) {
                map.addImage('tree-icon', { width: 128, height: 160, data: imgData.data });
            }
        }
        if (callback) callback();
    });
}

function renderTreesLayer() {
    if (!map.getSource('lares-trees-source')) {
        map.addSource('lares-trees-source', {
            type: 'geojson',
            data: LARES_TREES
        });
    }
    if (!map.getLayer('3d-trees')) {
        map.addLayer({
            'id': '3d-trees',
            'type': 'symbol',
            'source': 'lares-trees-source',
            'layout': {
                'icon-image': 'tree-icon',
                'icon-size': [
                    'interpolate', ['linear'], ['zoom'],
                    14, ['*', ['get', 'scale'], 0.45],
                    16, ['*', ['get', 'scale'], 0.85],
                    18, ['*', ['get', 'scale'], 1.25],
                    20, ['*', ['get', 'scale'], 1.7]
                ],
                'icon-pitch-alignment': 'viewport',
                'icon-rotation-alignment': 'viewport',
                'icon-anchor': 'bottom',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'visibility': treesVisible ? 'visible' : 'none'
            }
        });
    } else {
        try { map.setLayoutProperty('3d-trees', 'visibility', treesVisible ? 'visible' : 'none'); } catch (e) { }
    }
}

map.on('style.load', setupLayers);

// ==========================================
// RESILIENT LOADING & STARTUP INTRO SEQUENCE
// ==========================================
let mapReady = false;
let isIntroAnimating = false;

function revealMap() {
    if (mapReady) return;
    mapReady = true;
    document.getElementById('loading-overlay').classList.add('hidden');
    setTimeout(() => document.getElementById('sidebar').classList.add('visible'), 500);
    setTimeout(() => document.getElementById('coords-badge').classList.add('visible'), 800);

    // Startup animation sequence:
    // 1. Starts top-down 2D view zoomed out (zoom: 17.2, pitch: 0, bearing: 0)
    // 2. Slowly zooms in until it gets to the 2D top-down view in the picture (Zoom 19.6)
    // 3. Then after reaching this zoom, transitions to the current 3D perspective angle (pitch: 52, bearing: 165)
    isIntroAnimating = true;
    map.flyTo({
        center: INTRO_TARGET_2D_VIEW.center,
        zoom: INTRO_TARGET_2D_VIEW.zoom,
        pitch: INTRO_TARGET_2D_VIEW.pitch,
        bearing: INTRO_TARGET_2D_VIEW.bearing,
        duration: 3600,
        speed: 0.65,
        curve: 1.0,
        essential: true
    });

    map.once('moveend', () => {
        if (!isIntroAnimating) return;
        setTimeout(() => {
            if (!isIntroAnimating) return;
            map.flyTo({
                center: DEFAULT_MAP_VIEW.center,
                zoom: DEFAULT_MAP_VIEW.zoom,
                pitch: DEFAULT_MAP_VIEW.pitch,
                bearing: DEFAULT_MAP_VIEW.bearing,
                duration: 2200,
                essential: true
            });
            map.once('moveend', () => {
                isIntroAnimating = false;
            });
        }, 450);
    });
}

// Allow any user interaction to stop the intro animation smoothly
['dragstart', 'rotatestart', 'pitchstart', 'zoomstart', 'mousedown', 'touchstart'].forEach(evt => {
    map.on(evt, (e) => {
        if (e && e.originalEvent && isIntroAnimating) {
            isIntroAnimating = false;
            map.stop();
        }
    });
});

map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120 }), 'bottom-right');
map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

// Strategy 1: full load
map.on('load', () => setTimeout(revealMap, 300));
// Strategy 2: style load fallback
map.on('style.load', () => setTimeout(() => { if (!mapReady) revealMap(); }, 5000));
// Strategy 3: hard timeout
setTimeout(() => { if (!mapReady) revealMap(); }, 10000);

function updateMarkerZoomState() {
    const z = map.getZoom();
    const container = map.getContainer();
    if (!container) return;
    if (z < 17) {
        container.classList.add('map-zoomed-out');
    } else {
        container.classList.remove('map-zoomed-out');
    }
}

// Live coords & zoom-adaptive marker names
map.on('move', () => {
    const c = map.getCenter(), z = map.getZoom();
    document.getElementById('coords-text').textContent = `${c.lat.toFixed(4)}° N, ${c.lng.toFixed(4)}° E`;
    document.getElementById('zoom-text').textContent = `Zoom ${z.toFixed(1)}`;
    updateMarkerZoomState();
});

// ==========================================
// MARKERS (Google Maps-style Building Name Labels)
// ==========================================
function createMarkers() {
    BUILDING_DIRECTORY.forEach((b, index) => {
        const num = index + 1;
        const el = document.createElement('div');
        el.className = 'bldg-map-marker';
        el.dataset.id = b.id;
        el.innerHTML = `
            <div class="bldg-map-badge" style="background:${b.color};">${num}</div>
            <span class="bldg-map-name">${b.name}</span>
        `;
        let markerTouchStartX = 0;
        let markerTouchStartY = 0;
        let markerTouchMoved = false;

        el.addEventListener('touchstart', (e) => {
            const t = e.touches[0];
            if (t) {
                markerTouchStartX = t.clientX;
                markerTouchStartY = t.clientY;
                markerTouchMoved = false;
            }
        }, { passive: true });

        el.addEventListener('touchmove', (e) => {
            const t = e.touches[0];
            if (t) {
                if (Math.abs(t.clientX - markerTouchStartX) > 8 || Math.abs(t.clientY - markerTouchStartY) > 8) {
                    markerTouchMoved = true;
                }
            }
        }, { passive: true });

        const onMarkerTap = (e) => {
            if (e.type === 'touchend' && markerTouchMoved) return; // User was panning/swiping map
            e.stopPropagation();
            navigateTo(b.id);
        };
        el.addEventListener('click', onMarkerTap);
        el.addEventListener('touchend', onMarkerTap);

        const marker = new mapboxgl.Marker({ element: el }).setLngLat(b.coords);
        if (!isPhoneMode()) {
            const popup = new mapboxgl.Popup({ offset: 18, closeButton: true, maxWidth: '240px' })
                .setHTML(`<div class="popup-label main">Building ${num}</div><div class="popup-title">${b.name}</div><div class="popup-desc">${b.desc}</div>`);
            marker.setPopup(popup);
        }
        marker.addTo(map);
        markers.push(marker);
    });
    updateMarkerZoomState();
}
function removeMarkers() { markers.forEach(m => m.remove()); markers = []; }

// ==========================================
// CONTROLS
// ==========================================
function setLighting(preset) {
    const canvas = map.getCanvas();
    if (!canvas) return;
    if (preset === 'day') {
        canvas.style.filter = 'none';
        map.setFog(null);
    } else if (preset === 'dawn') {
        canvas.style.filter = 'brightness(95%) saturate(105%) hue-rotate(-5deg)';
        map.setFog(null);
    } else if (preset === 'dusk') {
        canvas.style.filter = 'brightness(85%) saturate(105%) sepia(15%) hue-rotate(-15deg)';
        map.setFog(null);
    } else if (preset === 'night') {
        canvas.style.filter = 'brightness(50%) saturate(80%) sepia(10%) hue-rotate(180deg)';
        map.setFog(null);
    }
}

function syncLightingWithTime() {
    const hour = new Date().getHours();
    let preset = 'day';
    if (hour >= 5 && hour < 7) preset = 'dawn';
    else if (hour >= 7 && hour < 17) preset = 'day';
    else if (hour >= 17 && hour < 19) preset = 'dusk';
    else preset = 'night';
    setLighting(preset);
}

setInterval(syncLightingWithTime, 60000);

function toggleBuildings(btn) {
    buildingsVisible = !buildingsVisible;
    if (btn) btn.classList.toggle('active', buildingsVisible);
    const chip = document.getElementById('chip-buildings');
    if (chip && chip !== btn) chip.classList.toggle('active', buildingsVisible);

    const vis = buildingsVisible ? 'visible' : 'none';
    try {
        if (map.getLayer('3d-drawings')) map.setLayoutProperty('3d-drawings', 'visibility', vis);
        if (map.getLayer('3d-drawings-roofs')) map.setLayoutProperty('3d-drawings-roofs', 'visibility', vis);
        if (map.getLayer('3d-buildings-mapbox')) {
            map.setLayoutProperty('3d-buildings-mapbox', 'visibility', (buildingsVisible && currentMapStyleMode === 'mapbox') ? 'visible' : 'none');
        }
    } catch (e) { }
    resetIdle();
}

function toggleTrees(btn) {
    treesVisible = !treesVisible;
    if (btn) btn.classList.toggle('active', treesVisible);
    const chip = document.getElementById('chip-trees');
    if (chip && chip !== btn) chip.classList.toggle('active', treesVisible);
    const phoneTree = document.getElementById('phone-trees-toggle');
    if (phoneTree && phoneTree !== btn) phoneTree.classList.toggle('active', treesVisible);

    try {
        if (map.getLayer('3d-trees')) {
            map.setLayoutProperty('3d-trees', 'visibility', treesVisible ? 'visible' : 'none');
        }
    } catch (e) { }
    resetIdle();
}

function toggleMapboxView(btn) {
    const nextMode = (currentMapStyleMode === 'google') ? 'mapbox' : 'google';
    currentMapStyleMode = nextMode;

    // Preserve current camera view angle, zoom, pitch, and bearing seamlessly
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentPitch = map.getPitch();
    const currentBearing = map.getBearing();

    if (nextMode === 'mapbox') {
        map.setStyle('mapbox://styles/mapbox/standard');
    } else {
        map.setStyle('mapbox://styles/mapbox/satellite-streets-v12');
    }

    map.once('style.load', () => {
        map.jumpTo({
            center: currentCenter,
            zoom: currentZoom,
            pitch: currentPitch,
            bearing: currentBearing
        });
    });
}

function setMapStyleMode(mode) {
    currentMapStyleMode = mode;
    const isMapbox = (mode === 'mapbox');

    // Toggle body class for CSS state
    document.body.classList.toggle('map-mode-mapbox', isMapbox);

    // Update UI buttons across kiosk and mobile
    const chip = document.getElementById('chip-mapbox-view');
    if (chip) {
        chip.classList.toggle('active', isMapbox);
        const txt = chip.querySelector('.chip-text');
        if (txt) txt.textContent = isMapbox ? 'Mapbox 3D (Active)' : 'Mapbox 3D';
    }

    const floatBtn = document.getElementById('map-view-switch-btn');
    if (floatBtn) {
        floatBtn.classList.toggle('active', isMapbox);
        const icon = floatBtn.querySelector('.mvs-icon');
        const label = floatBtn.querySelector('.mvs-text');
        if (icon) icon.textContent = isMapbox ? '🛰️' : '🗺️';
        if (label) label.textContent = isMapbox ? 'Google Sat' : 'Mapbox 3D';
    }

    const phoneToggle = document.getElementById('phone-mapbox-toggle');
    if (phoneToggle) {
        phoneToggle.classList.toggle('active', isMapbox);
        phoneToggle.textContent = isMapbox ? '🛰️ Google Sat' : '🗺️ Mapbox 3D';
    }

    if (isMapbox) {
        renderSectionBadges();
    } else {
        removeSectionBadges();
    }

    updateMarkerZoomState();
    resetIdle();
}

function toggleBoundary(btn) {
    toggleSettingChip(btn, 'boundary');
}

function toggleTerrain(btn) {
    terrainEnabled = !terrainEnabled;
    btn.classList.toggle('active');
    terrainEnabled ? map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 }) : map.setTerrain(null);
}

function toggleMarkers(btn) {
    const vis = btn.classList.contains('active');
    markers.forEach(m => { m.getElement().style.display = vis ? 'none' : 'block'; if (m.getPopup() && m.getPopup().isOpen()) m.togglePopup() });
    btn.classList.toggle('active');
}

function flyToView(n) {
    isIntroAnimating = false;
    const v = VIEWS[n]; if (!v) return;
    map.flyTo({ center: v.center, zoom: v.zoom, pitch: v.pitch, bearing: v.bearing, duration: v.duration, essential: true, curve: 1.2 });
}

// ==========================================
// SETTINGS CHIPS
// ==========================================
function toggleSettingChip(btn, type) {
    if (type === 'trees') {
        toggleTrees(btn);
        return;
    }
    if (type === 'buildings') {
        toggleBuildings(btn);
        return;
    }
    btn.classList.toggle('active');
    const on = btn.classList.contains('active');
    if (type === 'boundary') {
        const vis = on ? 'visible' : 'none';
        LARES_BOUNDARY.features.forEach(f => {
            const fid = f.properties.fid;
            ['sec-glow-', 'sec-fill-', 'sec-line-'].forEach(p => {
                try { map.setLayoutProperty(`${p}${fid}`, 'visibility', vis) } catch (e) { }
            });
        });
        ['lares-compound-border-casing', 'lares-compound-border-line'].forEach(id => {
            try { map.setLayoutProperty(id, 'visibility', vis) } catch (e) { }
        });
        try { map.setLayoutProperty('sec-labels-layer', 'visibility', vis) } catch (e) { }
        sectionBadges.forEach(m => {
            if (m && m.getElement()) m.getElement().style.display = on ? 'inline-flex' : 'none';
        });
    } else if (type === 'terrain') {
        terrainEnabled = on;
        on ? map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 }) : map.setTerrain(null);
    } else if (type === 'numbers') {
        markersVisible = on;
        markers.forEach(m => {
            m.getElement().style.display = on ? 'flex' : 'none';
            if (!on && m.getPopup() && m.getPopup().isOpen()) m.togglePopup();
        });
    }
    resetIdle();
}

// ==========================================
// KIOSK — BUILDING DIRECTORY
// ==========================================
function buildDirectory(filter = '') {
    const dir = document.getElementById('directory');
    const lowerFilter = filter.toLowerCase();

    let html = '';
    BUILDING_DIRECTORY.forEach((b, index) => {
        if (lowerFilter && !b.name.toLowerCase().includes(lowerFilter) && !b.desc.toLowerCase().includes(lowerFilter)) return;

        const num = index + 1; // 1-based numbering
        const bColor = b.color;
        html += `<div class="dir-item" data-id="${b.id}" onclick="navigateTo('${b.id}')">
            <div class="dir-item-icon" style="background:${bColor}22;color:${bColor}">
                <span class="dir-item-icon-number">${num}</span>
            </div>
            <div class="dir-item-info">
                <div class="dir-item-name">${b.name}</div>
                <div class="dir-item-desc">${b.desc}</div>
            </div>
            <button class="three-dots-btn" onclick="event.stopPropagation(); openColorPicker('${b.id}', '${b.name}')" style="background:none; border:none; cursor:pointer; font-size:16px; padding:4px 8px;">⋮</button>
            <div class="dir-item-arrow">→</div>
        </div>`;
    });

    if (!html) html = '<div style="text-align:center;color:#475569;padding:40px 0;font-size:13px;">No results found</div>';
    dir.innerHTML = html;
    renderPhoneDirectory(filter);
}

function filterDirectory() {
    const val = document.getElementById('search-input').value;
    buildDirectory(val);
    resetIdle();
}

// ==========================================
// SIDEBAR COLLAPSE / EXPAND TOGGLE
// ==========================================
function toggleSidebarMenu() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('sidebar-toggle-icon');
    const btn = document.getElementById('sidebar-toggle-btn');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.toggle('collapsed');
    if (icon) {
        icon.textContent = isCollapsed ? '>' : '<';
    }
    if (btn) {
        const label = isCollapsed ? 'Open menu' : 'Close menu';
        btn.title = label;
        btn.setAttribute('aria-label', label);
    }
    document.documentElement.style.setProperty('--sidebar-offset', isCollapsed ? '0px' : '380px');
}

function collapseSidebarMenu() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('sidebar-toggle-icon');
    const btn = document.getElementById('sidebar-toggle-btn');
    if (!sidebar || sidebar.classList.contains('collapsed')) return;
    sidebar.classList.add('collapsed');
    if (icon) icon.textContent = '>';
    if (btn) {
        btn.title = 'Open menu';
        btn.setAttribute('aria-label', 'Open menu');
    }
    document.documentElement.style.setProperty('--sidebar-offset', '0px');
}

function openSidebarMenu() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('sidebar-toggle-icon');
    const btn = document.getElementById('sidebar-toggle-btn');
    if (!sidebar || !sidebar.classList.contains('collapsed')) return;
    sidebar.classList.remove('collapsed');
    if (icon) icon.textContent = '<';
    if (btn) {
        btn.title = 'Close menu';
        btn.setAttribute('aria-label', 'Close menu');
    }
    document.documentElement.style.setProperty('--sidebar-offset', '380px');
}

function isNavigationActive() {
    if (isPhoneMode()) {
        const routeSheet = document.getElementById('phone-view-route');
        const isRouteSheetVisible = routeSheet && routeSheet.classList.contains('active');
        if (isRouteSheetVisible && (isMobileGPSActive || walkAnimFrame)) {
            return true;
        }
        return false;
    }
    if (walkAnimFrame || isMobileGPSActive) return true;
    return false;
}

// ==========================================
// KIOSK — WAYFINDING / ROUTING
// ==========================================
function navigateTo(buildingId) {
    isIntroAnimating = false;
    resetIdle();
    stopIdleRotation();
    stopOrbit();

    // Guard against accidental clicks while navigating on mobile
    if (isPhoneMode() && isNavigationActive()) {
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

    if (isPhoneMode()) {
        showPhoneBuildingDetails(buildingId);
    } else {
        // Zoom to building and orbit
        orbitBuilding(building.coords);
        // Show building info panel
        showBuildingPanel(buildingId);
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

function setRouteSpeed(multiplier) {
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

function setRouteCameraMode(mode) {
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
function resetCameraControlsTimer() {
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

function startArrivedCountdown() {
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

function clearArrivedCountdown() {
    if (arrivedCountdownTimer) {
        clearInterval(arrivedCountdownTimer);
        arrivedCountdownTimer = null;
    }
    const card = document.getElementById('route-arrived-card');
    if (card) card.style.display = 'none';
}

function returnToOverviewFromArrival() {
    closeRouteAndReset();
    map.flyTo({
        center: DEFAULT_MAP_VIEW.center,
        zoom: DEFAULT_MAP_VIEW.zoom,
        pitch: DEFAULT_MAP_VIEW.pitch,
        bearing: DEFAULT_MAP_VIEW.bearing,
        duration: 1600
    });
}

function exitRouteMode() {
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
function declutterLabelsForRoute(coords, destId) {
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

function restoreLabels() {
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
// GOOGLE MAPS TURN-BY-TURN DIRECTIONS ENGINE
// ==========================================
let currentRouteSteps = null;
let currentRouteDestName = '';
let lastActiveStepIdx = -1;

function buildSteps(coords, directory, destId) {
    if (!coords || coords.length < 2) return [];

    const routeLine = turf.lineString(coords);
    const totalDistance = turf.length(routeLine, { units: 'meters' });

    const destBuilding = directory.find(b => b.id === destId);
    const destName = destBuilding ? destBuilding.name : 'Destination';

    // 1. Calculate cumulative distance for each vertex along the route
    const cumulativeDists = [0];
    let runningDist = 0;
    for (let i = 1; i < coords.length; i++) {
        const segDist = turf.distance(coords[i - 1], coords[i], { units: 'meters' });
        runningDist += segDist;
        cumulativeDists.push(runningDist);
    }

    // 2. Detect turns at interior vertices
    const rawTurns = [];
    for (let i = 1; i < coords.length - 1; i++) {
        const prev = coords[i - 1];
        const curr = coords[i];
        const next = coords[i + 1];

        const b1 = turf.bearing(prev, curr);
        const b2 = turf.bearing(curr, next);

        let diff = b2 - b1;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;

        const absDiff = Math.abs(diff);
        if (absDiff < 25) continue; // Ignore differences under 25 deg (straight)

        let type = 'turn-right';
        let action = 'Turn right';
        let icon = '↱';

        if (absDiff <= 60) {
            if (diff > 0) {
                type = 'bear-right';
                action = 'Bear right';
                icon = '↗';
            } else {
                type = 'bear-left';
                action = 'Bear left';
                icon = '↖';
            }
        } else if (absDiff <= 135) {
            if (diff > 0) {
                type = 'turn-right';
                action = 'Turn right';
                icon = '↱';
            } else {
                type = 'turn-left';
                action = 'Turn left';
                icon = '↰';
            }
        } else {
            type = 'uturn';
            action = 'Make a U-turn';
            icon = '↩';
        }

        rawTurns.push({
            index: i,
            point: curr,
            at: cumulativeDists[i],
            diff: diff,
            absDiff: absDiff,
            type: type,
            action: action,
            icon: icon
        });
    }

    // 3. Merge consecutive turns closer than 8 m into one step
    const mergedTurns = [];
    for (let i = 0; i < rawTurns.length; i++) {
        const t = rawTurns[i];
        if (mergedTurns.length > 0) {
            const prevT = mergedTurns[mergedTurns.length - 1];
            if (t.at - prevT.at < 8) {
                if (t.absDiff > prevT.absDiff) {
                    mergedTurns[mergedTurns.length - 1] = {
                        ...t,
                        at: prevT.at
                    };
                }
                continue;
            }
        }
        mergedTurns.push(t);
    }

    // 4. Pick nearest landmark within 40m (excluding destination)
    mergedTurns.forEach(turn => {
        let nearestDist = Infinity;
        let nearestBuilding = null;
        directory.forEach(b => {
            if (b.id === destId) return; // Exclude destination
            const d = turf.distance(turn.point, b.coords, { units: 'meters' });
            if (d <= 40 && d < nearestDist) {
                nearestDist = d;
                nearestBuilding = b;
            }
        });

        if (nearestBuilding) {
            turn.landmark = nearestBuilding.name;
            turn.text = `${turn.action} at ${nearestBuilding.name}`;
        } else {
            turn.landmark = null;
            turn.text = turn.action;
        }
    });

    // 5. Add "past X" wording for straight sections longer than 60 m that pass a building
    const waypoints = [
        { at: 0, point: coords[0] },
        ...mergedTurns,
        { at: totalDistance, point: coords[coords.length - 1] }
    ];

    const intermediateSteps = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
        const segStart = waypoints[i].at;
        const segEnd = waypoints[i + 1].at;
        const segLen = segEnd - segStart;

        if (segLen > 60) {
            const midDist = segStart + (segLen / 2);
            const midPoint = turf.along(routeLine, midDist, { units: 'meters' }).geometry.coordinates;

            let pastBuilding = null;
            let minPastDist = Infinity;
            directory.forEach(b => {
                if (b.id === destId) return;
                const d = turf.distance(midPoint, b.coords, { units: 'meters' });
                if (d <= 35 && d < minPastDist) {
                    minPastDist = d;
                    pastBuilding = b;
                }
            });

            if (pastBuilding) {
                intermediateSteps.push({
                    at: midDist,
                    point: midPoint,
                    type: 'past',
                    action: 'Continue straight',
                    icon: '⬆️',
                    landmark: pastBuilding.name,
                    text: `Continue straight past ${pastBuilding.name}`
                });
            }
        }
    }

    // 6. Combine all steps
    let combined = [...mergedTurns, ...intermediateSteps];
    combined.sort((a, b) => a.at - b.at);

    const arriveStep = {
        at: totalDistance,
        point: coords[coords.length - 1],
        type: 'arrive',
        action: 'Arrive',
        icon: '🏁',
        landmark: destName,
        text: `Arrive at ${destName}`
    };

    // If no detectable turns or straightaways
    if (combined.length === 0) {
        return [
            {
                at: 0,
                point: coords[0],
                type: 'straight',
                action: 'Head straight',
                icon: '⬆️',
                landmark: null,
                text: `Head straight to ${destName}`
            },
            arriveStep
        ];
    }

    // Initial start step
    let startText = `Head straight toward ${destName}`;
    if (combined.length > 0 && combined[0].at < 12) {
        startText = combined[0].text;
    }
    const startStep = {
        at: 0,
        point: coords[0],
        type: 'start',
        action: 'Start',
        icon: '🚶',
        landmark: null,
        text: startText
    };

    // Filter out any step too close to start or arrive
    const middleSteps = combined.filter(s => s.at >= 8 && s.at <= totalDistance - 6);
    return [startStep, ...middleSteps, arriveStep];
}

function renderStepsList(steps) {
    const list = document.getElementById('route-steps-list');
    if (!list) return;
    let html = '';
    steps.forEach((s, idx) => {
        const prevAt = idx > 0 ? steps[idx - 1].at : 0;
        const stepDist = Math.max(1, Math.round(s.at - prevAt));
        const distLabel = idx === 0 ? 'Start' : `${stepDist} m`;

        html += `
            <div class="route-step-item" id="route-step-${idx}" onclick="focusRouteStep(${idx})">
                <div class="route-step-icon">${s.icon}</div>
                <div class="route-step-text-wrap">
                    <div class="route-step-instruction">${s.text}</div>
                    <div class="route-step-dist">${distLabel}</div>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function focusRouteStep(idx) {
    if (!currentRouteSteps || !currentRouteSteps[idx]) return;
    const s = currentRouteSteps[idx];
    map.flyTo({
        center: s.point,
        zoom: 19.8,
        pitch: 60,
        duration: 1000
    });
}

function highlightActiveStep(idx) {
    if (idx === lastActiveStepIdx) return;
    lastActiveStepIdx = idx;
    document.querySelectorAll('.route-step-item').forEach((el, i) => {
        el.classList.remove('active', 'completed', 'upcoming');
        if (i < idx) {
            el.classList.add('completed');
        } else if (i === idx) {
            el.classList.add('active');
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            el.classList.add('upcoming');
        }
    });
}

function updateLiveNavigation(currentDist, totalDist) {
    if (!currentRouteSteps || currentRouteSteps.length === 0) return;
    const banner = document.getElementById('turn-by-turn-banner');
    if (!banner) return;

    if (currentDist >= totalDist - 3) {
        banner.classList.add('arrived');
        document.getElementById('tbt-icon').innerHTML = '🏁';
        document.getElementById('tbt-distance').textContent = 'Arrived';
        document.getElementById('tbt-instruction').textContent = `You have arrived at ${currentRouteDestName}`;
        highlightActiveStep(currentRouteSteps.length - 1);
        startArrivedCountdown();
        return;
    }

    banner.classList.remove('arrived');

    // Find next step where step.at > currentDist
    let nextIdx = currentRouteSteps.findIndex(s => s.at > currentDist + 1);
    if (nextIdx === -1) nextIdx = currentRouteSteps.length - 1;

    const nextStep = currentRouteSteps[nextIdx];
    const remaining = Math.max(0, nextStep.at - currentDist);
    const rounded = Math.max(5, Math.round(remaining / 5) * 5);

    // Highlight active step in list
    const activeListIdx = nextIdx > 0 ? nextIdx - 1 : 0;
    highlightActiveStep(activeListIdx);

    document.getElementById('tbt-icon').innerHTML = nextStep.icon;

    if (remaining <= 10) {
        document.getElementById('tbt-distance').textContent = 'Now';
        document.getElementById('tbt-instruction').textContent = nextStep.text;
    } else {
        document.getElementById('tbt-distance').textContent = `In ${rounded} m`;
        document.getElementById('tbt-instruction').textContent = nextStep.text;
    }

    if (isPhoneMode()) {
        updatePhoneLiveNavUI(currentDist, totalDist, nextStep, remaining, rounded);
    }
}

let activeFullRouteCoords = null;

function drawRoute(coords, options = {}) {
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
    declutterLabelsForRoute(coords, selectedBuildingId);

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

function clearRoute() {
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
    clearArrivedCountdown();
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

function closeRouteAndReset() {
    clearRoute();
    closeBuildingPanel();
}

// ==========================================
// BUILDING INFO PANEL
// ==========================================
function showBuildingPanel(buildingId) {
    isIntroAnimating = false;
    const index = BUILDING_DIRECTORY.findIndex(b => b.id === buildingId);
    const building = BUILDING_DIRECTORY[index];
    if (!building) return;

    const num = index + 1;
    const panel = document.getElementById('building-panel');

    // Set number badge
    const numEl = document.getElementById('bp-number');
    numEl.textContent = num;
    numEl.style.background = building.color;

    // Set title
    document.getElementById('bp-title').textContent = building.name;
    document.getElementById('bp-subtitle').textContent = building.desc;

    // Set info
    document.getElementById('bp-section').textContent = building.section || 'Compound';
    document.getElementById('bp-type').textContent = 'Office Building';
    document.getElementById('bp-coords').textContent =
        building.coords[1].toFixed(5) + '°N, ' + building.coords[0].toFixed(5) + '°E';

    // Load Image
    const imgEl = document.getElementById('bp-real-image');
    const placeholderEl = document.getElementById('bp-image-placeholder');
    const imgPath = `images/${buildingId}.jpg`;

    const img = new Image();
    img.onload = function () {
        imgEl.src = imgPath;
        imgEl.style.display = 'block';
        placeholderEl.style.display = 'none';
    };
    img.onerror = function () {
        imgEl.style.display = 'none';
        placeholderEl.style.display = 'flex';
    };
    img.src = imgPath;

    // Update QR code for mobile handoff
    updateBuildingQR(buildingId);

    // Show panel
    panel.classList.add('active');
}

function closeBuildingPanel() {
    document.getElementById('building-panel').classList.remove('active');
    document.querySelectorAll('.dir-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));
    selectedBuildingId = null;
    stopOrbit();
    // Fly back to default overview angle
    map.flyTo({ center: DEFAULT_MAP_VIEW.center, zoom: DEFAULT_MAP_VIEW.zoom, pitch: DEFAULT_MAP_VIEW.pitch, bearing: DEFAULT_MAP_VIEW.bearing, duration: 2000 });
    resetIdle();
}

function buildRoadGraph(geojson) {
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

function findNearestNode(coord, graph) {
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

function findShortestPath(startCoord, endCoord, graph) {
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

function computeRouteFromKiosk(buildingId) {
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

function getDirections() {
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

function replayRoute() {
    if (activeRoute) {
        clearArrivedCountdown();
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

function createKioskMarker() {
    if (kioskMarkerInstance) kioskMarkerInstance.remove();
    const el = document.createElement('div');
    el.className = 'kiosk-marker';
    el.innerHTML = '<div class="kiosk-marker-pulse"></div><div class="kiosk-marker-dot"></div><div class="kiosk-marker-label" style="cursor:pointer;pointer-events:auto;" onclick="toggleKioskLock(event)">📍 You Are Here 🔒</div>';
    kioskMarkerInstance = new mapboxgl.Marker({ element: el, anchor: 'center', draggable: isKioskDraggable })
        .setLngLat(KIOSK_COORDS)
        .addTo(map);
    if (kioskMarkerInstance.getElement()) {
        kioskMarkerInstance.getElement().style.zIndex = '99999';
    }

    kioskMarkerInstance.on('dragend', () => {
        const lngLat = kioskMarkerInstance.getLngLat();
        KIOSK_COORDS = [lngLat.lng, lngLat.lat];

        fetch('/api/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates: KIOSK_COORDS })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert("Saved new Kiosk Location!");
                    if (activeRoute) navigateTo(activeRoute); // Refresh route
                }
            });
    });
}

// ==========================================
// KIOSK — IDLE / SCREENSAVER
// ==========================================
function resetIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    stopIdleRotation();
    idleTimer = setTimeout(startIdleRotation, IDLE_TIMEOUT);
}

function startIdleRotation() {
    if (idleRotating) return;
    idleRotating = true;
    // Clear any active route and close panels
    if (activeRoute) clearRoute();
    document.getElementById('building-panel').classList.remove('active');
    selectedBuildingId = null;
    stopOrbit();
    document.getElementById('search-input').value = '';
    buildDirectory();

    map.flyTo({ center: DEFAULT_MAP_VIEW.center, zoom: DEFAULT_MAP_VIEW.zoom, pitch: DEFAULT_MAP_VIEW.pitch, bearing: DEFAULT_MAP_VIEW.bearing, duration: 2000 });
    setTimeout(() => {
        if (!idleRotating) return;
        function rotate() {
            if (!idleRotating) return;
            map.rotateTo(map.getBearing() + 0.15, { duration: 0 });
            requestAnimationFrame(rotate);
        }
        rotate();
    }, 2500);
}

function stopIdleRotation() {
    idleRotating = false;
}

function orbitBuilding(center) {
    isIntroAnimating = false;
    stopOrbit();
    isOrbiting = true;

    map.flyTo({
        center: center,
        zoom: 20.1,
        pitch: 70,
        bearing: map.getBearing(),
        duration: 1500,
        essential: true
    });

    orbitTimeout = setTimeout(() => {
        if (!isOrbiting) return;
        function orbitStep() {
            if (!isOrbiting) return;
            map.rotateTo(map.getBearing() + 0.2, { duration: 0 });
            orbitAnimFrame = requestAnimationFrame(orbitStep);
        }
        orbitAnimFrame = requestAnimationFrame(orbitStep);
    }, 1600);
}

function stopOrbit() {
    isOrbiting = false;
    if (orbitTimeout) {
        clearTimeout(orbitTimeout);
        orbitTimeout = null;
    }
    if (orbitAnimFrame) {
        cancelAnimationFrame(orbitAnimFrame);
        orbitAnimFrame = null;
    }
}

// Listen for any interaction to reset idle
['mousedown', 'touchstart', 'mousemove', 'keydown', 'scroll'].forEach(evt => {
    document.addEventListener(evt, resetIdle, { passive: true });
});

// Listen for explicit map interactions to stop orbit
['mousedown', 'touchstart', 'wheel'].forEach(evt => {
    document.addEventListener(evt, (e) => {
        if (e.target.tagName === 'CANVAS') {
            stopOrbit();
        }
    }, { passive: true });
});

// ==========================================
// INIT
// ==========================================

let ROAD_NETWORK = null;
let roadGraph = new Map();
let BUILDING_ENTRANCES = {};

// Fetch roads.json and build pathfinding graph
fetch('roads.json')
    .then(res => res.json())
    .then(data => {
        ROAD_NETWORK = data;

        // Extract entrances
        if (data.features) {
            data.features.forEach(f => {
                if (f.geometry.type === 'Point' && f.properties.type === 'entrance' && f.properties.buildingId) {
                    if (!BUILDING_ENTRANCES[f.properties.buildingId]) {
                        BUILDING_ENTRANCES[f.properties.buildingId] = [];
                    }
                    BUILDING_ENTRANCES[f.properties.buildingId].push(f.geometry.coordinates);
                }
            });
        }

        roadGraph = buildRoadGraph(data);
        console.log(`Loaded road graph with ${roadGraph.size} nodes.`);
    })
    .catch(err => console.error("Could not fetch roads.json", err));

// Fetch colors from backend
fetch('/api/colors')
    .then(res => res.json())
    .then(data => {
        savedBuildingColors = data || {};

        BUILDING_DIRECTORY.forEach(b => {
            if (savedBuildingColors[b.id] && savedBuildingColors[b.id].icon) {
                b.color = savedBuildingColors[b.id].icon;
            }
        });

        removeMarkers();
        createMarkers();

        if (map.getLayer('3d-drawings-roofs')) {
            map.setPaintProperty('3d-drawings-roofs', 'fill-extrusion-color', getRoofColorCaseStyle());
        }

        buildDirectory();
    })
    .catch(err => console.error("Could not fetch building colors", err));

// Fetch pin location from backend
fetch('/api/pin')
    .then(res => res.json())
    .then(data => {
        if (data.coordinates) {
            KIOSK_COORDS = data.coordinates;
            if (kioskMarkerInstance) {
                kioskMarkerInstance.setLngLat(KIOSK_COORDS);
            }
            if (mapReady && !selectedBuildingId && !activeRoute) {
                map.flyTo({ center: DEFAULT_MAP_VIEW.center, zoom: DEFAULT_MAP_VIEW.zoom, pitch: DEFAULT_MAP_VIEW.pitch, bearing: DEFAULT_MAP_VIEW.bearing, duration: 1500 });
            }
        }
    })
    .catch(err => console.error("Could not fetch pin location", err));


map.on('load', () => {
    setTimeout(() => {
        revealMap();
        createKioskMarker();
        buildDirectory();
        resetIdle();
        syncLightingWithTime();
    }, 300);
});
// ==========================================
// COLOR PICKER LOGIC
// ==========================================
let activeColorId = null;

function getRoofColorCaseStyle() {
    let caseStyle = ['case'];
    for (let id in savedBuildingColors) {
        if (savedBuildingColors[id].roof) {
            caseStyle.push(['==', ['get', 'id'], id]);
            caseStyle.push(savedBuildingColors[id].roof);
        }
    }
    // Fallbacks
    caseStyle.push(['==', ['get', 'id'], 'guard_house']);
    caseStyle.push('#dc2626');
    caseStyle.push('#334155'); // Default
    return caseStyle;
}

function openColorPicker(id, name) {
    activeColorId = id;
    document.getElementById('cp-name').innerText = name;

    const roofHex = (savedBuildingColors[id] && savedBuildingColors[id].roof) ? savedBuildingColors[id].roof : '#334155';
    const iconHex = (savedBuildingColors[id] && savedBuildingColors[id].icon) ? savedBuildingColors[id].icon : '#3b82f6';

    document.getElementById('cp-roof').value = roofHex;
    document.getElementById('cp-roof-hex').value = roofHex.toUpperCase();

    document.getElementById('cp-icon').value = iconHex;
    document.getElementById('cp-icon-hex').value = iconHex.toUpperCase();

    document.getElementById('color-picker-modal').style.display = 'block';
}

function closeColorPicker() {
    document.getElementById('color-picker-modal').style.display = 'none';
    activeColorId = null;
}

function saveColorPicker() {
    if (!activeColorId) return;
    const roofColor = document.getElementById('cp-roof').value;
    const iconColor = document.getElementById('cp-icon').value;

    // Save to local variable
    if (!savedBuildingColors[activeColorId]) savedBuildingColors[activeColorId] = {};
    savedBuildingColors[activeColorId].roof = roofColor;
    savedBuildingColors[activeColorId].icon = iconColor;

    // Post to backend database
    fetch('/api/colors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedBuildingColors)
    }).then(() => {
        // Update Directory Object
        const b = BUILDING_DIRECTORY.find(b => b.id === activeColorId);
        if (b) b.color = iconColor;

        removeMarkers();
        createMarkers();

        // Update Map
        if (map.getLayer('3d-drawings-roofs')) {
            map.setPaintProperty('3d-drawings-roofs', 'fill-extrusion-color', getRoofColorCaseStyle());
        }

        // Update UI Directory
        buildDirectory(document.getElementById('search-input').value);
        closeColorPicker();
    });
}

function syncColorInputs(colorId, hexId) {
    const colorInput = document.getElementById(colorId);
    const hexInput = document.getElementById(hexId);

    colorInput.addEventListener('input', (e) => {
        hexInput.value = e.target.value.toUpperCase();
    });

    hexInput.addEventListener('input', (e) => {
        let val = e.target.value;
        if (!val.startsWith('#')) val = '#' + val;
        if (/^#[0-9A-F]{6}$/i.test(val)) {
            colorInput.value = val;
        }
    });
}

async function useEyeDropper(colorId, hexId) {
    if (!window.EyeDropper) {
        alert("Your browser does not support the EyeDropper API");
        return;
    }
    const eyeDropper = new EyeDropper();
    try {
        const result = await eyeDropper.open();
        const hexColor = result.sRGBHex;
        document.getElementById(colorId).value = hexColor;
        document.getElementById(hexId).value = hexColor.toUpperCase();
    } catch (e) {
        // User canceled the eyedropper
    }
}

document.addEventListener('DOMContentLoaded', () => {
    syncColorInputs('cp-roof', 'cp-roof-hex');
    syncColorInputs('cp-icon', 'cp-icon-hex');
    handleUrlParameters();
});

// ==========================================
// MOBILE PHONE & LIVE GPS WAYFINDING SYSTEM
// ==========================================
let PUBLIC_TUNNEL_URL = 'https://studio-comprehensive-mariah-styles.trycloudflare.com';
fetch('/api/tunnel')
    .then(res => res.json())
    .then(data => { if (data && data.url) PUBLIC_TUNNEL_URL = data.url; })
    .catch(() => {});

function isPhoneMode() {
    return window.innerWidth <= 768;
}

function isMobileDevice() {
    return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
}

function getResponsiveMapPadding() {
    const isMobile = window.innerWidth <= 768;
    const isPortraitKiosk = window.innerWidth > 768 && window.innerHeight > window.innerWidth;
    const isSidebarCollapsed = document.getElementById('sidebar')?.classList.contains('collapsed');

    if (isMobile) {
        return { top: 90, bottom: 240, left: 24, right: 24 };
    } else if (isPortraitKiosk) {
        const sidePad = isSidebarCollapsed ? 40 : 460;
        return { top: 120, bottom: 120, left: sidePad, right: 40 };
    } else {
        const sidePad = isSidebarCollapsed ? 90 : 420;
        return { top: 80, bottom: 80, left: sidePad, right: 90 };
    }
}

// --- High-Contrast Text Color for Badges ---
function getContrastTextColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') return '#ffffff';
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return '#ffffff';
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#0f172a' : '#ffffff';
}

// --- Route Line Curve Smoother ---
function smoothRouteCoords(coords) {
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

function setPhoneSheetSnap(snap) {
    const sheet = document.getElementById('phone-bottom-sheet');
    const camControls = document.getElementById('floating-camera-controls');
    if (!sheet) return;
    sheet.classList.remove('snap-peek', 'snap-half', 'snap-full');
    sheet.classList.add('snap-' + snap);
    phoneSheetCurrentSnap = snap;

    if (camControls && isPhoneMode()) {
        if (snap === 'full') {
            camControls.classList.add('sheet-full-hidden');
        } else {
            camControls.classList.remove('sheet-full-hidden');
        }
    }
}

function cyclePhoneSheetSnap() {
    if (phoneSheetCurrentSnap === 'peek') setPhoneSheetSnap('half');
    else if (phoneSheetCurrentSnap === 'half') setPhoneSheetSnap('full');
    else setPhoneSheetSnap('peek');
}

function togglePhoneRouteSheet() {
    if (phoneSheetCurrentSnap === 'peek') setPhoneSheetSnap('half');
    else setPhoneSheetSnap('peek');
}

function setPhoneSheetView(viewName) {
    document.querySelectorAll('.sheet-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('phone-view-' + viewName);
    if (target) target.classList.add('active');
    phoneSheetCurrentView = viewName;

    const sheet = document.getElementById('phone-bottom-sheet');
    if (sheet) {
        if (viewName === 'route') {
            sheet.classList.add('route-active');
            document.body.classList.add('phone-nav-active');
        } else {
            sheet.classList.remove('route-active');
            document.body.classList.remove('phone-nav-active');
            const topHud = document.getElementById('phone-top-nav-hud');
            if (topHud) topHud.classList.remove('active');
        }
    }
}

function initPhoneSheetGestures() {
    const handle = document.getElementById('sheet-drag-handle');
    const sheet = document.getElementById('phone-bottom-sheet');
    if (!handle || !sheet) return;

    let touchStartY = 0;
    let initialSheetHeight = 0;
    let isDragging = false;
    let lastY = 0;
    let lastTime = 0;
    let dragVelocityY = 0;

    function getSafeBottomPx() {
        const s = getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom') || '';
        return parseInt(s, 10) || 0;
    }

    function getSnapHeights() {
        const vh = window.innerHeight;
        const peek = 88 + getSafeBottomPx();
        const half = Math.round(vh * 0.50);
        const full = Math.round(vh * 0.92);
        return { peek, half, full, vh };
    }

    function onTouchStart(e) {
        const target = e.target;
        if (target.closest('button') || target.closest('input') || target.closest('.phone-search-clear')) {
            return;
        }

        const touch = e.touches[0];
        touchStartY = touch.clientY;
        lastY = touchStartY;
        lastTime = performance.now();
        dragVelocityY = 0;

        initialSheetHeight = sheet.getBoundingClientRect().height;
        isDragging = true;
        sheet.classList.add('is-dragging');
    }

    function onTouchMove(e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        const currentY = touch.clientY;
        const now = performance.now();
        const dt = now - lastTime;
        if (dt > 8) {
            dragVelocityY = (currentY - lastY) / dt;
            lastY = currentY;
            lastTime = now;
        }

        const deltaY = touchStartY - currentY;
        let targetHeight = initialSheetHeight + deltaY;

        const { peek, full } = getSnapHeights();

        if (targetHeight < peek) {
            const under = peek - targetHeight;
            targetHeight = peek - Math.pow(under, 0.72);
        } else if (targetHeight > full) {
            const over = targetHeight - full;
            targetHeight = full + Math.pow(over, 0.72);
        }

        sheet.style.height = `${Math.round(targetHeight)}px`;

        if (e.cancelable) {
            e.preventDefault();
        }
    }

    function onTouchEnd() {
        if (!isDragging) return;
        isDragging = false;

        sheet.classList.remove('is-dragging');

        const currentHeight = sheet.getBoundingClientRect().height;
        sheet.style.height = '';

        const { peek, half, full } = getSnapHeights();
        let targetSnap = 'peek';

        if (dragVelocityY < -0.4) {
            if (currentHeight < half) targetSnap = 'half';
            else targetSnap = 'full';
        } else if (dragVelocityY > 0.4) {
            if (currentHeight > half) targetSnap = 'half';
            else targetSnap = 'peek';
        } else {
            const dPeek = Math.abs(currentHeight - peek);
            const dHalf = Math.abs(currentHeight - half);
            const dFull = Math.abs(currentHeight - full);

            if (dPeek <= dHalf && dPeek <= dFull) {
                targetSnap = 'peek';
            } else if (dHalf <= dPeek && dHalf <= dFull) {
                targetSnap = 'half';
            } else {
                targetSnap = 'full';
            }
        }

        setPhoneSheetSnap(targetSnap);
    }

    const triggers = [
        document.getElementById('sheet-drag-handle'),
        document.querySelector('.sheet-drag-handle-zone'),
        document.querySelector('.phone-bldg-header'),
        document.querySelector('.phone-route-peek-card')
    ].filter(Boolean);

    triggers.forEach(el => {
        el.addEventListener('touchstart', onTouchStart, { passive: false });
    });

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
}

// --- Photo Gallery Mosaic & Lightbox Engine ---
// --- Photo Gallery Mosaic & Lightbox Engine ---
const BUILDING_PHOTOS = {
    'admin_building': ['images/admin_building.jpg']
};

function renderPhoneBuildingGallery(buildingId) {
    const container = document.getElementById('phone-bldg-gallery-container');
    if (!container) return;

    const bldg = BUILDING_DIRECTORY.find(b => b.id === buildingId);
    const bldgName = bldg ? bldg.name : 'Building';

    let candidatePhotos = [];
    if (BUILDING_PHOTOS[buildingId] && BUILDING_PHOTOS[buildingId].length > 0) {
        candidatePhotos = [...BUILDING_PHOTOS[buildingId]];
    }

    const validImages = [];
    if (candidatePhotos.length === 0) {
        displayGalleryDOM([], bldgName);
        return;
    }

    let checked = 0;
    candidatePhotos.forEach(src => {
        const img = new Image();
        img.onload = () => {
            validImages.push(src);
            checked++;
            if (checked === candidatePhotos.length) {
                displayGalleryDOM(validImages, bldgName);
            }
        };
        img.onerror = () => {
            checked++;
            if (checked === candidatePhotos.length) {
                displayGalleryDOM(validImages, bldgName);
            }
        };
        img.src = src;
    });

    function displayGalleryDOM(images, name) {
        if (!container) return;
        if (images.length === 0) {
            container.innerHTML = `
                <div class="pbg-empty-card">
                    <div class="pbg-empty-icon">🏛️</div>
                    <div style="font-weight:700;color:#f1f5f9;font-size:14px;">${name}</div>
                    <div style="font-size:12px;color:#94a3b8;">Facility photos will be added in upcoming updates</div>
                </div>
            `;
            return;
        }

        if (images.length === 1) {
            container.innerHTML = `
                <div class="phone-bldg-gallery-grid single-photo" onclick="openPhotoLightbox('${images[0]}', '${name}')">
                    <div class="pbg-single-slot">
                        <img src="${images[0]}" alt="${name}">
                        <div class="pbg-badge-pill">📷 1 Photo</div>
                    </div>
                </div>
            `;
        } else if (images.length === 2) {
            container.innerHTML = `
                <div class="phone-bldg-gallery-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;height:180px;">
                    <div class="pbg-main-slot" onclick="openPhotoLightbox('${images[0]}', '${name} - View 1')">
                        <img src="${images[0]}" alt="${name} 1">
                    </div>
                    <div class="pbg-main-slot" onclick="openPhotoLightbox('${images[1]}', '${name} - View 2')">
                        <img src="${images[1]}" alt="${name} 2">
                    </div>
                    <div class="pbg-badge-pill">📷 2 Photos</div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="phone-bldg-gallery-grid mosaic">
                    <div class="pbg-main-slot" onclick="openPhotoLightbox('${images[0]}', '${name} - Main View')">
                        <img src="${images[0]}" alt="${name} 1">
                    </div>
                    <div class="pbg-side-slots">
                        <div class="pbg-side-item" onclick="openPhotoLightbox('${images[1]}', '${name} - Side View')">
                            <img src="${images[1]}" alt="${name} 2">
                        </div>
                        <div class="pbg-side-item" onclick="openPhotoLightbox('${images[2]}', '${name} - Interior / Detail')">
                            <img src="${images[2]}" alt="${name} 3">
                        </div>
                    </div>
                    <div class="pbg-badge-pill">📷 ${images.length} Photos</div>
                </div>
            `;
        }
    }
}

function openPhotoLightbox(src, caption) {
    const modal = document.getElementById('photo-lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const cap = document.getElementById('lightbox-caption');
    if (!modal || !img) return;
    img.src = src;
    if (cap) cap.textContent = caption || 'Facility Photo';
    modal.style.display = 'flex';
}

function closePhotoLightbox(e) {
    if (e) e.stopPropagation();
    const modal = document.getElementById('photo-lightbox-modal');
    if (modal) modal.style.display = 'none';
}

// --- Mobile Welcome Onboarding Modal Handlers ---
function showPhoneWelcomeModal() {
    const modal = document.getElementById('phone-welcome-modal');
    if (!modal) return;
    modal.style.display = 'flex';
}

function createUserGPSMarkerElement() {
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

let compassPermissionGranted = false;
let compassListenersBound = false;

function bindCompassListeners() {
    if (compassListenersBound) return;
    compassListenersBound = true;
    window.addEventListener('deviceorientation', handleDeviceHeading, true);
    window.addEventListener('deviceorientationabsolute', handleDeviceHeading, true);
}

function requestDeviceOrientationPermission(callback) {
    if (compassPermissionGranted) {
        bindCompassListeners();
        if (callback) callback(true);
        return;
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(state => {
                if (state === 'granted') {
                    compassPermissionGranted = true;
                    bindCompassListeners();
                    if (callback) callback(true);
                } else {
                    console.warn('Compass permission state:', state);
                    if (callback) callback(false);
                }
            })
            .catch(err => {
                console.warn('Compass permission error:', err);
                if (callback) callback(false);
            });
    } else if (window.DeviceOrientationEvent) {
        compassPermissionGranted = true;
        bindCompassListeners();
        if (callback) callback(true);
    }
}

// Auto-request compass on the first user interaction anywhere on the screen
function triggerCompassPermissionOnFirstGesture() {
    requestDeviceOrientationPermission();
    window.removeEventListener('touchend', triggerCompassPermissionOnFirstGesture);
    window.removeEventListener('click', triggerCompassPermissionOnFirstGesture);
}
window.addEventListener('touchend', triggerCompassPermissionOnFirstGesture, { passive: true });
window.addEventListener('click', triggerCompassPermissionOnFirstGesture, { passive: true });

function updateUserGPSMarker(lng, lat) {
    if (!userGPSMarker) {
        const el = createUserGPSMarkerElement();
        userGPSMarker = new mapboxgl.Marker({ 
            element: el,
            rotationAlignment: 'map',
            pitchAlignment: 'map'
        }).setLngLat([lng, lat]).addTo(map);
    } else {
        userGPSMarker.setLngLat([lng, lat]);
    }
}

function requestUserInitialLocation() {
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
        lastKnownGPSCoords = [userLng, userLat];
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

function handleWelcomeContinue() {
    sessionStorage.setItem('da_lares_welcome_seen', '1');
    const modal = document.getElementById('phone-welcome-modal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 260);
    }
    // Acquire user location to place blue dot on campus; do NOT start a walking route
    requestUserInitialLocation();
    requestDeviceOrientationPermission();
}

function handleWelcomeSkip() {
    sessionStorage.setItem('da_lares_welcome_seen', '1');
    const modal = document.getElementById('phone-welcome-modal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 260);
    }
    showMobileToast('🏛️ Welcome to DA-LARES! Tap any building to navigate.', 3000);
}

// --- Phone Directory & Filtering ---
function renderPhoneDirectory(filter = '') {
    const list = document.getElementById('phone-directory-list');
    if (!list) return;
    const lowerFilter = filter.toLowerCase().trim();

    let html = '';
    BUILDING_DIRECTORY.forEach((b, index) => {
        if (lowerFilter && !b.name.toLowerCase().includes(lowerFilter) && !(b.desc && b.desc.toLowerCase().includes(lowerFilter))) {
            return;
        }

        const num = index + 1;
        const textColor = getContrastTextColor(b.color);
        const isSelected = selectedBuildingId === b.id;

        html += `
            <div class="phone-dir-item ${isSelected ? 'active' : ''}" data-id="${b.id}" onclick="navigateTo('${b.id}')">
                <div class="phone-dir-badge" style="background:${b.color}; color:${textColor};">
                    ${num}
                </div>
                <div class="phone-dir-info">
                    <div class="phone-dir-name">${b.name}</div>
                    <div class="phone-dir-sub">${b.desc || b.section || 'DA-LARES Facility'}</div>
                </div>
                <div class="phone-dir-arrow">›</div>
            </div>
        `;
    });

    if (!html) {
        html = '<div style="text-align:center;color:#64748b;padding:32px 12px;font-size:14px;">No places found</div>';
    }
    list.innerHTML = html;
}

function filterPhoneDirectory() {
    const input = document.getElementById('phone-search-input');
    const val = input ? input.value : '';
    renderPhoneDirectory(val);
    if (phoneSheetCurrentSnap === 'peek' && val.length > 0) {
        setPhoneSheetSnap('half');
    }
}

function clearPhoneSearch() {
    const input = document.getElementById('phone-search-input');
    if (input) input.value = '';
    renderPhoneDirectory('');
}

// --- Phone Building Details View ---
function showPhoneBuildingDetails(buildingId) {
    // Guard against accidental switches while navigation is active
    if (isNavigationActive()) {
        if (selectedBuildingId === buildingId) return;
        showMobileToast(`🧭 Active route to ${currentRouteDestName || 'destination'} in progress. Tap 'Cancel' to choose another building.`, 3500);
        return;
    }

    const index = BUILDING_DIRECTORY.findIndex(b => b.id === buildingId);
    const building = BUILDING_DIRECTORY[index];
    if (!building) return;

    const num = index + 1;
    selectedBuildingId = buildingId;

    // Set badge number & color with contrast check
    const badgeEl = document.getElementById('phone-bldg-badge');
    if (badgeEl) {
        badgeEl.textContent = num;
        badgeEl.style.background = building.color;
        badgeEl.style.color = getContrastTextColor(building.color);
    }

    // Set titles
    document.getElementById('phone-bldg-title').textContent = building.name;
    document.getElementById('phone-bldg-desc').textContent = building.desc || 'DA-LARES Facility';

    // Meta info (Section and Type; Coords row is strictly hidden)
    document.getElementById('phone-bldg-section').textContent = building.section || 'Compound';
    document.getElementById('phone-bldg-type').textContent = building.type || 'Office / Facility';

    // Render Google Maps photo mosaic / gallery form
    renderPhoneBuildingGallery(buildingId);

    // Switch to building view and snap to half height
    setPhoneSheetView('bldg');
    setPhoneSheetSnap('half');

    // Frame camera comfortably in 45° 3D tilt overlooking the building
    map.easeTo({
        center: [building.coords[0], building.coords[1] - 0.00035],
        zoom: 19.3,
        pitch: 46,
        bearing: -15,
        duration: 900
    });
}

function showPhoneDirectoryView() {
    selectedBuildingId = null;
    clearRoute();
    stopPhoneLiveGPS();
    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));
    setPhoneSheetView('dir');
    setPhoneSheetSnap('half');
    renderPhoneDirectory('');
}

function closePhoneBuildingDetails() {
    selectedBuildingId = null;
    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));
    setPhoneSheetView('dir');
    setPhoneSheetSnap('peek');
    map.flyTo({
        center: DEFAULT_MAP_VIEW.center,
        zoom: DEFAULT_MAP_VIEW.zoom,
        pitch: DEFAULT_MAP_VIEW.pitch,
        bearing: DEFAULT_MAP_VIEW.bearing,
        duration: 1500
    });
}

// --- Phone Active Route & Steps ---
function updatePhoneRouteUI(coords) {
    const building = BUILDING_DIRECTORY.find(b => b.id === selectedBuildingId);
    const destName = building ? building.name : (currentRouteDestName || 'Destination');
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

    if (currentRouteSteps && currentRouteSteps.length > 0) {
        if (ptnhPrim) ptnhPrim.textContent = currentRouteSteps[0].text;
        if (ptnhSec) ptnhSec.textContent = currentRouteSteps.length > 1 ? currentRouteSteps[1].text : `Proceed toward ${destName}`;
        if (ptnhIcon) ptnhIcon.innerHTML = currentRouteSteps[0].icon || '⬆️';
        if (ptnhDist) ptnhDist.textContent = `${roundedTotal} m`;
    } else {
        if (ptnhPrim) ptnhPrim.textContent = 'Follow the walkway';
        if (ptnhSec) ptnhSec.textContent = `Heading to ${destName}`;
        if (ptnhDist) ptnhDist.textContent = `${roundedTotal} m`;
    }

    if (topHud && (isMobileGPSActive || walkAnimFrame)) {
        topHud.classList.add('active');
    }

    renderPhoneStepsList(currentRouteSteps);
    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');
}

function renderPhoneStepsList(steps) {
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

function updatePhoneLiveNavUI(currentDist, totalDist, nextStep, remaining, rounded) {
    const remainTag = document.getElementById('phone-route-remain-tag');
    const remainingTotal = Math.max(0, Math.round(totalDist - currentDist));
    if (remainTag) remainTag.textContent = `${remainingTotal} m remaining`;

    const topHud = document.getElementById('phone-top-nav-hud');
    const ptnhIcon = document.getElementById('ptnh-maneuver-icon');
    const ptnhPrim = document.getElementById('ptnh-primary-step');
    const ptnhSec = document.getElementById('ptnh-secondary-step');
    const ptnhDist = document.getElementById('ptnh-dist-pill');

    if (topHud && (isMobileGPSActive || walkAnimFrame)) {
        topHud.classList.add('active');
    }

    if (nextStep) {
        if (ptnhIcon) ptnhIcon.innerHTML = nextStep.icon || '⬆️';
        if (ptnhDist) {
            if (remaining <= 10) ptnhDist.textContent = 'Now';
            else ptnhDist.textContent = `${rounded} m`;
        }
        if (ptnhPrim) {
            ptnhPrim.textContent = nextStep.text;
        }
        const nextNextIdx = currentRouteSteps ? currentRouteSteps.findIndex(s => s.at > nextStep.at + 1) : -1;
        if (ptnhSec) {
            if (nextNextIdx !== -1 && currentRouteSteps[nextNextIdx]) {
                ptnhSec.textContent = `Then: ${currentRouteSteps[nextNextIdx].text}`;
            } else {
                ptnhSec.textContent = `Approaching destination`;
            }
        }
    }

    // Highlight step in phone list
    if (currentRouteSteps) {
        const activeIdx = currentRouteSteps.findIndex(s => s.at > currentDist + 1);
        const stepIdx = activeIdx > 0 ? activeIdx - 1 : 0;
        document.querySelectorAll('.phone-step-item').forEach((el, i) => {
            el.classList.toggle('active', i === stepIdx);
        });
    }
}

function startPhoneAnimatedRoute() {
    stopPhoneLiveGPS(); // Stop any active live GPS
    dismissGPSPermissionCard(); // Never show permission card for animated route

    if (!selectedBuildingId) return;
    const building = BUILDING_DIRECTORY.find(b => b.id === selectedBuildingId);
    if (!building) return;

    activeRoute = building.id;
    const routeCoords = computeRouteFromKiosk(building.id);
    activeFullRouteCoords = routeCoords;
    activeRouteCoords = routeCoords;

    // Turn-by-turn steps
    currentRouteSteps = buildSteps(routeCoords, BUILDING_DIRECTORY, building.id);
    currentRouteDestName = building.name;

    // Mobile view: default to 1x speed as requested by user
    setRouteSpeed(1);

    // Ensure speed bar is visible
    const speedBar = document.getElementById('phone-speed-bar');
    if (speedBar) speedBar.style.display = 'flex';

    // Switch to route sheet view in peek mode
    updatePhoneRouteUI(routeCoords);
    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');

    // Fit whole route in camera view
    const routeLine = turf.lineString(routeCoords);
    const bbox = turf.bbox(routeLine);
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

function replayPhoneRoute() {
    clearArrivedCountdown();
    clearRoute();
    if (selectedBuildingId) {
        if (isMobileGPSActive) {
            startPhoneLiveGPS(selectedBuildingId);
        } else {
            startPhoneAnimatedRoute();
        }
    }
}

function cancelPhoneRoute() {
    stopPhoneLiveGPS();
    clearRoute();
    selectedBuildingId = null;
    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));
    setPhoneSheetView('dir');
    setPhoneSheetSnap('half');
    renderPhoneDirectory('');
    showMobileToast('Navigation cancelled', 2000);
}

// --- Centered Arrival Pop-up Modal Controller ---
function showPhoneArrival(buildingOrId) {
    stopPhoneLiveGPS();
    if (routeAnimFrame) cancelAnimationFrame(routeAnimFrame);
    if (walkAnimFrame) cancelAnimationFrame(walkAnimFrame);
    activeFullRouteCoords = null;

    const topHud = document.getElementById('phone-top-nav-hud');
    if (topHud) topHud.classList.remove('active');

    let building = buildingOrId;
    if (typeof buildingOrId === 'string') {
        building = BUILDING_DIRECTORY.find(b => b.id === buildingOrId);
    }
    const name = building ? building.name : 'Destination';

    // Show Centered Pop-up Modal
    const modal = document.getElementById('phone-arrived-modal');
    const titleEl = document.getElementById('pam-title');
    const descEl = document.getElementById('pam-desc');
    if (titleEl) titleEl.textContent = `Arrived at ${name}!`;
    if (descEl) descEl.textContent = 'You have reached your destination.';
    if (modal) modal.classList.add('active');

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

function closePhoneArrivalPopup() {
    const modal = document.getElementById('phone-arrived-modal');
    if (modal) modal.classList.remove('active');
    selectedBuildingId = null;
    clearRoute();
    setPhoneSheetView('dir');
    setPhoneSheetSnap('peek');
    map.flyTo({
        center: DEFAULT_MAP_VIEW.center,
        zoom: DEFAULT_MAP_VIEW.zoom,
        pitch: DEFAULT_MAP_VIEW.pitch,
        bearing: DEFAULT_MAP_VIEW.bearing,
        duration: 1500
    });
}

function replayFromArrivalPopup() {
    const modal = document.getElementById('phone-arrived-modal');
    if (modal) modal.classList.remove('active');
    clearArrivedCountdown();
    clearRoute();
    if (selectedBuildingId) {
        if (isMobileGPSActive) {
            startPhoneLiveGPS(selectedBuildingId);
        } else {
            startPhoneAnimatedRoute();
        }
    }
}

function donePhoneArrival() {
    closePhoneArrivalPopup();
}

// --- Live Mobile GPS Engine with Road Snapping ---
let userGPSMarker = null;
let gpsAccuracyCircle = null;
let gpsWatchId = null;
let lastKnownGPSCoords = null;
let isMobileGPSActive = false;
let isUserFollowingGPS = true;
let offRouteCounter = 0;
let lastRecalcTime = 0;

function showMobileToast(text, duration = 3500) {
    const toast = document.getElementById('mobile-gps-toast');
    const textEl = document.getElementById('mobile-gps-toast-text');
    if (!toast || !textEl) return;
    textEl.textContent = text;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), duration);
}

let gpsNavigationStartTime = 0;

function startPhoneLiveGPS(buildingId) {
    if (!buildingId) buildingId = selectedBuildingId;
    if (!buildingId) return;
    selectedBuildingId = buildingId;
    gpsNavigationStartTime = Date.now();

    // Stop animated walker simulation if running
    if (walkAnimFrame) cancelAnimationFrame(walkAnimFrame);
    if (walkerMarkerInstance) {
        walkerMarkerInstance.remove();
        walkerMarkerInstance = null;
    }

    isMobileGPSActive = true;
    isUserFollowingGPS = true;
    offRouteCounter = 0;
    document.body.classList.add('phone-gps-active');
    if (typeof updateRecenterStateUI === 'function') updateRecenterStateUI(true);

    const building = BUILDING_DIRECTORY.find(b => b.id === buildingId);
    const bldgName = building ? building.name : 'Destination';
    currentRouteDestName = bldgName;

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

    activeFullRouteCoords = null; // Clear so new route from user GPS is always drawn

    // If last known GPS is already cached, compute and draw immediately from user's live position!
    if (lastKnownGPSCoords) {
        computeAndDrawRouteFromGPS(lastKnownGPSCoords, buildingId);
    }

    if (!navigator.geolocation) {
        showMobileToast('GPS not supported on this browser. Showing route from Kiosk.', 4000);
        startPhoneAnimatedRoute();
        return;
    }

    showMobileToast('📍 Locating your position…', 3000);

    if (gpsWatchId) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
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

function startContinuousTracking(buildingId) {
    if (gpsWatchId) return;
    // CRITICAL: maximumAge: 0 forces the device to ALWAYS deliver the freshest real-time hardware GPS fix
    gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => handleGPSPositionUpdate(pos, buildingId),
        (err) => {
            console.warn('Continuous GPS tracking warning:', err);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 }
    );
}

// --- 60fps Marker Gliding & Camera Lerp Engine ---
let markerCurrentLngLat = null;
let markerTargetLngLat = null;
let markerLerpStartTime = 0;
let markerLerpDuration = 500;
let markerAnimFrame = null;

function animateMarkerTo(targetLngLat) {
    if (!userGPSMarker) return;
    if (!markerCurrentLngLat) {
        markerCurrentLngLat = targetLngLat;
        userGPSMarker.setLngLat(targetLngLat);
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

        if (userGPSMarker) {
            userGPSMarker.setLngLat(markerCurrentLngLat);
        }

        if (progress < 1) {
            markerAnimFrame = requestAnimationFrame(step);
        }
    }
    markerAnimFrame = requestAnimationFrame(step);
}

let lastCameraFollowLngLat = null;
function updateSmoothCameraFollow(targetLngLat, distFromCompoundMeters) {
    if (!isUserFollowingGPS || distFromCompoundMeters > 1500) return;
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

function stopPhoneLiveGPS() {
    if (gpsWatchId) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
    if (markerAnimFrame) {
        cancelAnimationFrame(markerAnimFrame);
        markerAnimFrame = null;
    }
    markerCurrentLngLat = null;
    markerTargetLngLat = null;
    lastCameraFollowLngLat = null;
    lastTrimmedCoord = null;

    isMobileGPSActive = false;
    isUserFollowingGPS = false;
    document.body.classList.remove('phone-gps-active');
    if (typeof autoRecenterTimer !== 'undefined' && autoRecenterTimer) {
        clearTimeout(autoRecenterTimer);
        autoRecenterTimer = null;
    }
    if (typeof updateRecenterStateUI === 'function') updateRecenterStateUI(false);
    document.getElementById('mobile-recenter-btn')?.classList.remove('active');
    if (userGPSMarker) {
        userGPSMarker.remove();
        userGPSMarker = null;
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
const stopMobileGPSNavigation = stopPhoneLiveGPS;
const startMobileGPSNavigation = startPhoneLiveGPS;

function setupGPSLayers() {
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

let smoothedCompassHeading = null;
let rawCompassHeading = null;
let headingAnimFrame = null;

function applyUserHeading(targetHeading) {
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
    // Because rotationAlignment:'map' means the marker element is already counter-rotated by the map bearing
    const mapBearing = map ? (map.getBearing() || 0) : 0;
    const visualRotation = (smoothedCompassHeading - mapBearing + 360) % 360;

    const headingEl = document.getElementById('user-gps-heading');
    if (headingEl) {
        headingEl.style.display = 'flex';
        headingEl.style.transform = `rotate(${Math.round(visualRotation)}deg)`;
    }
}

// Continuously re-apply heading on map rotate/move so fan stays aligned
function startHeadingSync() {
    if (headingAnimFrame) return;
    function syncLoop() {
        if (rawCompassHeading !== null) {
            applyUserHeading(rawCompassHeading);
        }
        headingAnimFrame = requestAnimationFrame(syncLoop);
    }
    headingAnimFrame = requestAnimationFrame(syncLoop);
}

function stopHeadingSync() {
    if (headingAnimFrame) {
        cancelAnimationFrame(headingAnimFrame);
        headingAnimFrame = null;
    }
}

function handleDeviceHeading(e) {
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

        // Store and apply even without GPS marker — it will render when marker appears
        rawCompassHeading = correctedHeading;
        applyUserHeading(correctedHeading);

        // Start continuous sync loop if not already running
        startHeadingSync();
    }
}

function drawCampusRouteFromKiosk(buildingId) {
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

function computeAndDrawRouteFromGPS(startCoord, buildingId) {
    const building = BUILDING_DIRECTORY.find(b => b.id === buildingId);
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

    const entrances = BUILDING_ENTRANCES[targetBuildingId] || [building.coords];
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
    activeFullRouteCoords = routeCoords;
    activeRouteCoords = routeCoords;

    // Turn-by-turn steps
    currentRouteSteps = buildSteps(routeCoords, BUILDING_DIRECTORY, building.id);
    currentRouteDestName = building.name;

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

function handleGPSPositionUpdate(pos, targetBuildingId) {
    if (!targetBuildingId) targetBuildingId = selectedBuildingId;
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
    if (activeFullRouteCoords && activeFullRouteCoords.length > 1) {
        try {
            const fullLine = turf.lineString(activeFullRouteCoords);
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
    if (!isSnapped && ROAD_NETWORK && distFromCompoundMeters <= 1500) {
        try {
            const snappedPt = turf.nearestPointOnLine(ROAD_NETWORK, userPt);
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
    } else if (lastKnownGPSCoords) {
        try {
            const movedDist = turf.distance(turf.point(lastKnownGPSCoords), turf.point(snappedCoord), { units: 'meters' });
            if (movedDist >= 1.2) {
                const bearing = turf.bearing(turf.point(lastKnownGPSCoords), turf.point(snappedCoord));
                applyUserHeading((bearing + 360) % 360);
            }
        } catch (e) {}
    }

    // Cache snapped location
    lastKnownGPSCoords = snappedCoord;

    // 3. Smooth 60fps User GPS Marker Gliding to the Snapped Position
    if (!userGPSMarker) {
        const el = createUserGPSMarkerElement();
        userGPSMarker = new mapboxgl.Marker({ 
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
    const isRouteFromKiosk = activeFullRouteCoords && activeFullRouteCoords.length > 0 &&
        (Math.abs(activeFullRouteCoords[0][0] - KIOSK_COORDS[0]) < 0.00005 && Math.abs(activeFullRouteCoords[0][1] - KIOSK_COORDS[1]) < 0.00005);

    if (!activeFullRouteCoords || !map.getSource('route-source') || (isMobileGPSActive && isRouteFromKiosk)) {
        if (distFromCompoundMeters > 1500) {
            showMobileToast(`📍 Connected to phone GPS (${(distFromCompoundMeters / 1000).toFixed(1)} km away). Route shown from Argosino Kiosk.`, 4000);
            const kCoords = computeRouteFromKiosk(targetBuildingId);
            activeFullRouteCoords = kCoords;
            currentRouteSteps = buildSteps(kCoords, BUILDING_DIRECTORY, targetBuildingId);
            const targetBldg = BUILDING_DIRECTORY.find(b => b.id === targetBuildingId);
            currentRouteDestName = targetBldg ? targetBldg.name : 'Destination';
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
            const fullLine = turf.lineString(activeFullRouteCoords);
            const userSnappedOnRoute = turf.nearestPointOnLine(fullLine, userPt);
            const startPt = turf.point(activeFullRouteCoords[0]);
            const destPt = turf.point(activeFullRouteCoords[activeFullRouteCoords.length - 1]);

            // Check off-route distance (> 25m off route)
            const distFromRoute = turf.distance(userPt, userSnappedOnRoute, { units: 'meters' });
            if (distFromRoute > 25 && distFromCompoundMeters <= 1500) {
                offRouteCounter++;
                if (offRouteCounter >= 3 && (nowTime - lastRecalcTime > 8000)) {
                    lastRecalcTime = nowTime;
                    offRouteCounter = 0;
                    showMobileToast('🔄 Recalculating path from your location…', 2500);
                    computeAndDrawRouteFromGPS(snappedCoord, targetBuildingId);
                    return;
                }
            } else {
                offRouteCounter = 0;
            }

            // CRITICAL FIX FOR ISSUE 3: Only slice/trim route ahead if user is actually on or close to the route (<= 10 meters)
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
            const targetCoord = targetBldg ? targetBldg.coords : activeFullRouteCoords[activeFullRouteCoords.length - 1];
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

function recalculateRouteFromPoint(startCoord, buildingId) {
    computeAndDrawRouteFromGPS(startCoord, buildingId);
}

let userDismissedGPSPrompt = false;

function handleGPSError(err, buildingId) {
    console.warn('GPS location error:', err);
    if (err && err.code === 1) { // PERMISSION_DENIED
        if (gpsWatchId) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
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

function showGPSPermissionCard(buildingId) {
    let card = document.getElementById('phone-gps-permission-card');
    if (!card) {
        card = document.createElement('div');
        card.id = 'phone-gps-permission-card';
        card.className = 'phone-gps-permission-card';
        document.body.appendChild(card);
    }
    const bId = buildingId || selectedBuildingId || '';
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

function dismissGPSPermissionCard(startRoute = false) {
    userDismissedGPSPrompt = true;
    const card = document.getElementById('phone-gps-permission-card');
    if (card) card.remove();
    if (startRoute && selectedBuildingId) {
        startPhoneAnimatedRoute();
    }
}

function startTapToPlaceLocation(buildingId) {
    dismissGPSPermissionCard();
    showMobileToast('📍 Tap anywhere on the campus map to set your starting location!', 5000);
    
    const onMapTap = (e) => {
        map.off('click', onMapTap);
        const tappedCoord = [e.lngLat.lng, e.lngLat.lat];
        lastKnownGPSCoords = tappedCoord;
        
        if (!userGPSMarker) {
            const el = createUserGPSMarkerElement();
            userGPSMarker = new mapboxgl.Marker({ 
                element: el,
                rotationAlignment: 'map',
                pitchAlignment: 'map'
            }).setLngLat(tappedCoord).addTo(map);
        } else {
            userGPSMarker.setLngLat(tappedCoord);
        }
        
        computeAndDrawRouteFromGPS(tappedCoord, buildingId || selectedBuildingId);
        showMobileToast('📍 Route started from your selected point!', 3000);
    };
    
    map.once('click', onMapTap);
}

function retryPhoneGPS(buildingId) {
    userDismissedGPSPrompt = false;
    const card = document.getElementById('phone-gps-permission-card');
    if (card) card.remove();
    showMobileToast('📍 Requesting GPS permission…', 2500);
    startPhoneLiveGPS(buildingId || selectedBuildingId);
}

let autoRecenterTimer = null;

function scheduleAutoRecenter() {
    if (autoRecenterTimer) clearTimeout(autoRecenterTimer);
    if (!isMobileGPSActive) return;
    autoRecenterTimer = setTimeout(() => {
        if (isMobileGPSActive && !isUserFollowingGPS && lastKnownGPSCoords) {
            recenterOnUserGPS({ auto: true });
        }
    }, 5000);
}

function updateRecenterStateUI(isFollowing) {
    const centerBtn = document.getElementById('phone-gps-center-btn');
    const fabBtn = document.getElementById('mobile-recenter-btn');
    if (centerBtn) {
        centerBtn.classList.toggle('needs-recenter', !isFollowing);
        centerBtn.innerHTML = isFollowing ? '<span>🎯</span> Center' : '<span>🎯</span> Re-center';
    }
    if (fabBtn) {
        fabBtn.classList.toggle('active', !isFollowing && isMobileGPSActive);
    }
}

function recenterOnUserGPS(opts = {}) {
    if (autoRecenterTimer) {
        clearTimeout(autoRecenterTimer);
        autoRecenterTimer = null;
    }
    if (lastKnownGPSCoords) {
        isUserFollowingGPS = true;
        updateRecenterStateUI(true);
        map.flyTo({
            center: lastKnownGPSCoords,
            zoom: 19.5,
            pitch: 0,
            duration: 800
        });
        if (!opts.auto) {
            showMobileToast('🎯 Re-centered on your location');
        }
    } else {
        showMobileToast('📍 Acquiring GPS signal…');
        if (selectedBuildingId) {
            startPhoneLiveGPS(selectedBuildingId);
        }
    }
}

// Multi-touch tracking to distinguish 2-finger pinch/zoom from 1-finger pan
let activeTouchCount = 0;
const mapCanvas = map.getCanvas();
if (mapCanvas) {
    mapCanvas.addEventListener('touchstart', (e) => {
        activeTouchCount = e.touches ? e.touches.length : 1;
        if (isMobileGPSActive && !isUserFollowingGPS) {
            scheduleAutoRecenter();
        }
    }, { passive: true });

    mapCanvas.addEventListener('touchend', (e) => {
        activeTouchCount = e.touches ? e.touches.length : 0;
        if (isMobileGPSActive && !isUserFollowingGPS) {
            scheduleAutoRecenter();
        }
    }, { passive: true });

    mapCanvas.addEventListener('touchcancel', () => {
        activeTouchCount = 0;
    }, { passive: true });
}

// Pause follow ONLY on single-finger manual drag, NOT during pinch zoom
map.on('dragstart', (e) => {
    if (!isMobileGPSActive) return;
    const touches = e.originalEvent && e.originalEvent.touches;
    const touchCount = touches ? touches.length : activeTouchCount;
    // If user is pinching (2+ fingers), keep follow active!
    if (touchCount > 1) {
        return;
    }
    isUserFollowingGPS = false;
    updateRecenterStateUI(false);
    scheduleAutoRecenter();
});

map.on('dragend', () => {
    if (isMobileGPSActive && !isUserFollowingGPS) {
        scheduleAutoRecenter();
    }
});

// When zoom ends: If camera is following GPS, re-center smoothly on user's location at the new zoom level!
map.on('zoomend', () => {
    if (isMobileGPSActive && isUserFollowingGPS && lastKnownGPSCoords) {
        map.easeTo({
            center: lastKnownGPSCoords,
            duration: 250,
            easing: t => t
        });
    }
});

// --- Kiosk QR Code Handoff Generator ---
function getMobileNavigationUrl(buildingId) {
    const host = window.location.hostname;
    const isLocal = !host || host === 'localhost' || host === '127.0.0.1' || 
                    window.location.protocol === 'file:' || 
                    /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
    
    let baseOrigin = (isLocal && PUBLIC_TUNNEL_URL) 
        ? PUBLIC_TUNNEL_URL.replace(/\/$/, '') 
        : window.location.origin;

    let path = '/';
    if (window.location.protocol !== 'file:' && window.location.pathname && window.location.pathname !== '/') {
        path = window.location.pathname;
    }
    if (!path.startsWith('/')) path = '/' + path;

    const viewMode = (currentMapStyleMode === 'mapbox') ? 'mapbox' : 'google';
    return `${baseOrigin}${path}?dest=${encodeURIComponent(buildingId)}&view=${viewMode}`;
}

let currentQRCodeInstance = null;
function updateBuildingQR(buildingId) {
    const qrBox = document.getElementById('bp-qr-box');
    if (!qrBox) return;

    const render = () => {
        const url = getMobileNavigationUrl(buildingId);
        qrBox.innerHTML = '';
        try {
            if (typeof QRCode !== 'undefined') {
                currentQRCodeInstance = new QRCode(qrBox, {
                    text: url,
                    width: 66,
                    height: 66,
                    colorDark: "#020617",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } else {
                throw new Error('QRCode library not ready');
            }
        } catch (err) {
            qrBox.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=66x66&data=${encodeURIComponent(url)}" alt="QR" style="width:100%;height:100%;">`;
        }

        const qrLink = document.getElementById('bp-qr-link');
        if (qrLink) {
            qrLink.href = url;
            qrLink.title = url;
        }
    };

    render();

    if (window.location.protocol !== 'file:') {
        fetch('/api/tunnel')
            .then(res => res.json())
            .then(data => {
                if (data && data.url && data.url !== PUBLIC_TUNNEL_URL) {
                    PUBLIC_TUNNEL_URL = data.url;
                    render();
                }
            })
            .catch(() => {});
    }
}

// --- URL Query Parameter Auto-Router ---
function handleUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const destParam = params.get('dest');
    const modeParam = params.get('mode');
    const viewParam = params.get('view');
    if (viewParam === 'mapbox' || modeParam === 'mapbox') {
        const interval = setInterval(() => {
            if (mapReady) {
                clearInterval(interval);
                if (currentMapStyleMode !== 'mapbox') toggleMapboxView();
            }
        }, 100);
    }

    if (destParam) {
        const interval = setInterval(() => {
            if (mapReady && typeof BUILDING_DIRECTORY !== 'undefined' && BUILDING_DIRECTORY.length > 0 && roadGraph && roadGraph.size > 0) {
                clearInterval(interval);
                const bldg = BUILDING_DIRECTORY.find(b => b.id.toLowerCase() === destParam.toLowerCase());
                if (bldg) {
                    if (isPhoneMode()) {
                        isIntroAnimating = false;
                        map.stop();
                        selectedBuildingId = bldg.id;
                        showPhoneBuildingDetails(bldg.id);
                        // Clean URL query parameters so future refreshes do not trap the user in this destination!
                        try {
                            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
                        } catch (e) {}
                    } else {
                        navigateTo(bldg.id);
                    }
                }
            }
        }, 250);
    }

    // On mobile viewports or QR scan visits: Show Welcome / Onboarding modal if not seen in session
    if ((isPhoneMode() || window.innerWidth <= 768 || destParam) && !sessionStorage.getItem('da_lares_welcome_seen')) {
        setTimeout(showPhoneWelcomeModal, 450);
    }
}

// Initialize phone bottom sheet gestures when DOM is ready
initPhoneSheetGestures();


// ============================================================
// Expose functions referenced by inline HTML onclick/oninput handlers.
// These will be migrated to addEventListener in a future step.
// ============================================================
window.cancelPhoneRoute = cancelPhoneRoute;
window.clearPhoneSearch = clearPhoneSearch;
window.closeBuildingPanel = closeBuildingPanel;
window.closeColorPicker = closeColorPicker;
window.closePhoneArrivalPopup = closePhoneArrivalPopup;
window.closePhotoLightbox = closePhotoLightbox;
window.closeRouteAndReset = closeRouteAndReset;
window.collapseSidebarMenu = collapseSidebarMenu;
window.cyclePhoneSheetSnap = cyclePhoneSheetSnap;
window.exitRouteMode = exitRouteMode;
window.filterDirectory = filterDirectory;
window.filterPhoneDirectory = filterPhoneDirectory;
window.getDirections = getDirections;
window.handleWelcomeContinue = handleWelcomeContinue;
window.handleWelcomeSkip = handleWelcomeSkip;
window.recenterOnUserGPS = recenterOnUserGPS;
window.replayFromArrivalPopup = replayFromArrivalPopup;
window.replayPhoneRoute = replayPhoneRoute;
window.replayRoute = replayRoute;
window.saveColorPicker = saveColorPicker;
window.setRouteCameraMode = setRouteCameraMode;
window.setRouteSpeed = setRouteSpeed;
window.showPhoneDirectoryView = showPhoneDirectoryView;
window.showPhoneWelcomeModal = showPhoneWelcomeModal;
window.startMobileGPSNavigation = startMobileGPSNavigation;
window.startPhoneAnimatedRoute = startPhoneAnimatedRoute;
window.startPhoneLiveGPS = startPhoneLiveGPS;
window.toggleMapboxView = toggleMapboxView;
window.togglePhoneRouteSheet = togglePhoneRouteSheet;
window.toggleSettingChip = toggleSettingChip;
window.toggleSidebarMenu = toggleSidebarMenu;
window.useEyeDropper = useEyeDropper;
