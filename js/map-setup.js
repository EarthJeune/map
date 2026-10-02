// DA-LARES Map Setup & Core Layers Module
// Mapbox GL JS map initialization, 3D layer configurations, style switcher, and lighting.

import {
    MAPBOX_ACCESS_TOKEN,
    CENTER,
    INTRO_START_VIEW,
    INTRO_TARGET_2D_VIEW,
    DEFAULT_MAP_VIEW,
    VIEWS,
    SECTION_COLORS,
    SECTION_PASTEL_COLORS
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
    BUILDING_DIRECTORY
} from './data/buildings.js';

import { state } from './data/state.js';

import {
    createMarkers,
    removeMarkers,
    renderSectionBadges,
    removeSectionBadges,
    createEntranceArrowMarker,
    updateMarkerZoomState
} from './markers.js';

// Mapbox Map Instance
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
export const map = new mapboxgl.Map({
    container: 'map',
    style: (state.currentMapStyleMode === 'mapbox')
        ? 'mapbox://styles/mapbox/standard'
        : 'mapbox://styles/mapbox/satellite-streets-v12',
    center: INTRO_START_VIEW.center,
    zoom: INTRO_START_VIEW.zoom,
    pitch: INTRO_START_VIEW.pitch,
    bearing: INTRO_START_VIEW.bearing,
    antialias: true
});
state.map = map;
window.map = map;

export function getRoofColorCaseStyle() {
    let caseStyle = ['case'];
    const colors = (state && state.savedBuildingColors) ? state.savedBuildingColors : (typeof savedBuildingColors !== 'undefined' ? savedBuildingColors : {});
    for (let id in colors) {
        if (colors[id] && colors[id].roof) {
            caseStyle.push(['==', ['get', 'id'], id]);
            caseStyle.push(colors[id].roof);
        }
    }
    // Default special roof color for Guard House
    caseStyle.push(['==', ['get', 'id'], 'guard_house']);
    caseStyle.push('#dc2626');
    caseStyle.push('#334155'); // Default roof color
    return caseStyle;
}

function safeResetIdle() {
    if (typeof window.resetIdle === 'function') window.resetIdle();
    else if (typeof resetIdle === 'function') resetIdle();
}

export function setupLayers() {
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
export function setupMapboxStandardLayers() {
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

export function ensureTreeIconLoaded(callback) {
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

export function renderTreesLayer() {
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

export function revealMap() {
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

export function setLighting(preset) {
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

export function syncLightingWithTime() {
    const hour = new Date().getHours();
    let preset = 'day';
    if (hour >= 5 && hour < 7) preset = 'dawn';
    else if (hour >= 7 && hour < 17) preset = 'day';
    else if (hour >= 17 && hour < 19) preset = 'dusk';
    else preset = 'night';
    setLighting(preset);
}

setInterval(syncLightingWithTime, 60000);

export function toggleBuildings(btn) {
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
    safeResetIdle();
}

export function toggleTrees(btn) {
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
    safeResetIdle();
}

export function toggleMapboxView(btn) {
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

export function setMapStyleMode(mode) {
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
    safeResetIdle();
}

export function toggleBoundary(btn) {
    if (typeof toggleSettingChip === 'function') toggleSettingChip(btn, 'boundary'); else if (typeof window.toggleSettingChip === 'function') window.toggleSettingChip(btn, 'boundary');
}

export function toggleTerrain(btn) {
    terrainEnabled = !terrainEnabled;
    btn.classList.toggle('active');
    terrainEnabled ? map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 }) : map.setTerrain(null);
}

export function toggleMarkers(btn) {
    const vis = btn.classList.contains('active');
    markers.forEach(m => { m.getElement().style.display = vis ? 'none' : 'block'; if (m.getPopup() && m.getPopup().isOpen()) m.togglePopup() });
    btn.classList.toggle('active');
}

export function flyToView(n) {
    isIntroAnimating = false;
    const v = VIEWS[n]; if (!v) return;
    map.flyTo({ center: v.center, zoom: v.zoom, pitch: v.pitch, bearing: v.bearing, duration: v.duration, essential: true, curve: 1.2 });
}
