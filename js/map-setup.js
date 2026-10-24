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

import { STATIONS, getActiveStationDefaultView, getStationIntroViews } from './data/stations.js';

import {
    DA_LARES_OUTER_PERIMETER,
    LARES_MASK,
    LARES_COMPOUND_OUTLINE,
    LARES_TREES,
    LARES_BOUNDARY,
    LARES_UNIFIED_BOUNDARY
} from './data/geo.js';

import {
    LARES_DRAWINGS,
    BUILDING_DIRECTORY,
    CUSTOM_3D_BUILDINGS
} from './data/buildings.js?v=72';

import { state } from './data/state.js';

import {
    createMarkers,
    removeMarkers,
    renderSectionBadges,
    removeSectionBadges,
    createEntranceArrowMarker,
    updateMarkerZoomState
} from './markers.js';

import {
    detectGpuHardware,
    getOptimalPixelRatio
} from './performance.js';

// Mapbox Map Instance
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
const isInitialMobileDevice = (typeof window !== 'undefined' && (
    window.innerWidth <= 768 ||
    window.location.search.includes('mode=phone') ||
    /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent)
));

const activeStationId = state.currentStationId || 'lares';
const activeStation = STATIONS[activeStationId] || STATIONS.lares;
const introViews = getStationIntroViews(activeStationId);
const initialCameraView = isInitialMobileDevice
    ? getActiveStationDefaultView(activeStationId)
    : introViews.start;

const hardwareProfile = detectGpuHardware();
const optimalRatio = getOptimalPixelRatio();

export const map = new mapboxgl.Map({
    container: 'map',
    style: (state.currentMapStyleMode === 'mapbox')
        ? 'mapbox://styles/mapbox/standard'
        : 'mapbox://styles/mapbox/satellite-streets-v12',
    center: initialCameraView.center,
    zoom: initialCameraView.zoom,
    pitch: initialCameraView.pitch,
    bearing: initialCameraView.bearing,
    minZoom: 10.0,
    maxZoom: 22.5,
    maxBounds: activeStation.bounds || [
        [120.40, 13.30], // Southwest bounds (CALABARZON Region IV-A)
        [122.80, 15.00]  // Northeast bounds
    ],
    antialias: !hardwareProfile.isLowEnd && !isInitialMobileDevice, // Disable expensive MSAA on low-end Intel HD Graphics & Mobile
    pixelRatio: optimalRatio,
    maxTileCacheSize: (hardwareProfile.isLowEnd || isInitialMobileDevice) ? 40 : 80,
    fadeDuration: isInitialMobileDevice ? 0 : 50,
    refreshExpiredTiles: false
});
state.map = map;
window.map = map;
map.on('zoom', updateMarkerZoomState);
map.on('zoomend', updateMarkerZoomState);

export function getRoofColorCaseStyle() {
    let caseStyle = ['case'];
    const colors = (state && state.savedBuildingColors) ? state.savedBuildingColors : {};
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
    if (state.currentMapStyleMode === 'mapbox') {
        setupMapboxStandardLayers();
        return;
    }

    // 1. Terrain (disabled by default)
    if (state.terrainEnabled) {
        if (!map.getSource('mapbox-dem')) {
            map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
        }
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    } else {
        try { map.setTerrain(null); } catch (e) { }
    }
    // 2. Synchronize initial sky and atmospheric lighting
    syncLightingWithTime();

    // 2. Google Satellite raster source & layer (rendered at the bottom)
    if (!map.getSource('google-satellite')) {
        map.addSource('google-satellite', {
            'type': 'raster',
            'tiles': [
                'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
            ],
            'tileSize': 256,
            'maxzoom': 20
        });
    }
    if (!map.getLayer('google-satellite-layer')) {
        map.addLayer({
            'id': 'google-satellite-layer',
            'type': 'raster',
            'source': 'google-satellite',
            'layout': {
                'visibility': (state.currentMapStyleMode === 'google') ? 'visible' : 'none'
            }
        });
    }

    // 2b. High-Resolution DA-LARES Drone Orthomosaic (Offline MBTiles, 100% ground-truth imagery)
    if (!map.getSource('lares-drone-source')) {
        map.addSource('lares-drone-source', {
            'type': 'raster',
            'tiles': [
                '/api/tiles/{z}/{x}/{y}.png'
            ],
            'tileSize': 256,
            'minzoom': 14,
            'maxzoom': 24,
            'bounds': [121.165052, 13.956537, 121.173221, 13.963068]
        });
    }
    if (!map.getLayer('lares-drone-layer')) {
        map.addLayer({
            'id': 'lares-drone-layer',
            'type': 'raster',
            'source': 'lares-drone-source',
            'layout': {
                'visibility': (state.currentMapStyleMode === 'google' && (!state.currentStationId || state.currentStationId === 'lares')) ? 'visible' : 'none'
            },
            'paint': {
                'raster-opacity': 1.0,
                'raster-fade-duration': 0
            }
        });
    }

    // 2c. Google Satellite Comparison Overlay Layer (Adjustable opacity on top of drone layer for calibration)
    if (!map.getLayer('google-satellite-overlay-layer')) {
        map.addLayer({
            'id': 'google-satellite-overlay-layer',
            'type': 'raster',
            'source': 'google-satellite',
            'layout': {
                'visibility': (state.gmapsOverlayOpacity > 0 && state.currentMapStyleMode === 'google') ? 'visible' : 'none'
            },
            'paint': {
                'raster-opacity': state.gmapsOverlayOpacity || 0.0,
                'raster-fade-duration': 0
            }
        });
    }

    // 3. Unified DA-LARES Compound Boundary (Single grass green outline, zero internal dividing lines)
    const boundaryBtn = document.getElementById('chip-boundary');
    const isBoundaryOn = (state.boundaryVisible !== undefined)
        ? state.boundaryVisible
        : (boundaryBtn ? boundaryBtn.classList.contains('active') : true);
    const initBoundaryVis = isBoundaryOn ? 'visible' : 'none';

    if (!map.getSource('lares-unified-boundary-source')) {
        map.addSource('lares-unified-boundary-source', {
            type: 'geojson',
            data: LARES_UNIFIED_BOUNDARY
        });
    }

    // Subtle grass-green lawn tint (fades out gracefully on high zoom to reveal aerial details)
    if (!map.getLayer('lares-boundary-fill')) {
        map.addLayer({
            id: 'lares-boundary-fill',
            type: 'fill',
            source: 'lares-unified-boundary-source',
            layout: { 'visibility': initBoundaryVis },
            paint: {
                'fill-color': '#22c55e',
                'fill-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    14, 0.08,
                    16, 0.04,
                    18, 0.0
                ]
            }
        });
    }

    // Soft ambient grass green glow (Google Satellite mode)
    if (!map.getLayer('lares-boundary-glow')) {
        map.addLayer({
            id: 'lares-boundary-glow',
            type: 'line',
            source: 'lares-unified-boundary-source',
            layout: { 'visibility': initBoundaryVis },
            paint: {
                'line-color': '#4ade80',
                'line-width': 10,
                'line-blur': 4,
                'line-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    14, 0.5,
                    16, 0.4,
                    18, 0.2
                ]
            }
        });
    }

    // Crisp unified grass green perimeter line (Google Satellite mode)
    if (!map.getLayer('lares-boundary-line')) {
        map.addLayer({
            id: 'lares-boundary-line',
            type: 'line',
            source: 'lares-unified-boundary-source',
            layout: {
                'line-cap': 'round',
                'line-join': 'round',
                'visibility': initBoundaryVis
            },
            paint: {
                'line-color': '#22c55e',
                'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    14, 2.5,
                    16, 3.5,
                    18, 4.0
                ],
                'line-opacity': 0.95
            }
        });
    }

    // 4. Stylized Road Network (from roads.json) - rendered directly on top of section ground fills
    if (!map.getSource('lares-roads-source')) {
        map.addSource('lares-roads-source', {
            type: 'geojson',
            data: 'roads.json?v=72'
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
                'visibility': (state.currentMapStyleMode === 'mapbox') ? 'visible' : 'none'
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
                'visibility': (state.currentMapStyleMode === 'mapbox') ? 'visible' : 'none'
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
                'visibility': (!state.currentStationId || state.currentStationId === 'lares') ? 'visible' : 'none'
            },
            'paint': {
                'fill-color': (state.currentMapStyleMode === 'mapbox') ? '#060a12' : '#0b1121',
                'fill-opacity': 1.0
            }
        });
    }

    // 6. Custom Traced DA-LARES 3D Buildings (33 Facilities)
    if (LARES_DRAWINGS && LARES_DRAWINGS.features && CUSTOM_3D_BUILDINGS) {
        LARES_DRAWINGS.features.forEach(f => {
            if (f.properties && CUSTOM_3D_BUILDINGS[f.properties.id]) {
                f.properties.has_3d_model = true;
            }
        });
    }
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
            'filter': ['!=', ['get', 'has_3d_model'], true],
            'minzoom': 14.5,
            'layout': {
                'visibility': state.buildingsVisible ? 'visible' : 'none'
            },
            'paint': {
                'fill-extrusion-color': (state.currentMapStyleMode === 'mapbox') ? '#f8fafc' : '#cbd5e1',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': (state.currentMapStyleMode === 'mapbox') ? 1.0 : 0.95
            }
        });
    }
    if (!map.getLayer('3d-drawings-roofs')) {
        map.addLayer({
            'id': '3d-drawings-roofs',
            'source': 'lares-drawings-source',
            'type': 'fill-extrusion',
            'filter': ['!=', ['get', 'has_3d_model'], true],
            'minzoom': 14.5,
            'layout': {
                'visibility': state.buildingsVisible ? 'visible' : 'none'
            },
            'paint': {
                'fill-extrusion-color': (state.currentMapStyleMode === 'mapbox') ? '#e2e8f0' : getRoofColorCaseStyle(),
                'fill-extrusion-height': ['+', ['get', 'height'], 0.25],
                'fill-extrusion-base': ['get', 'height'],
                'fill-extrusion-opacity': 1.0
            }
        });
    }

    // 7. Custom Realistic 3D Building Models (MIS-RAFIS, etc.)
    setup3DBuildingModelsLayer(map, false);

    // If active station is NOT lares, immediately ensure LARES models and layers are hidden
    if (state.currentStationId && state.currentStationId !== 'lares') {
        const laresLayers = [
            '3d-buildings-models-layer',
            '3d-buildings-translucent-layer',
            '3d-drawings',
            '3d-drawings-roofs',
            'lares-mask-layer',
            'lares-boundary-line',
            'lares-boundary-fill',
            'lares-boundary-glow',
            'lares-compound-border-line',
            'lares-roads-casing',
            'lares-roads-network'
        ];
        laresLayers.forEach(id => {
            if (map.getLayer(id)) {
                try { map.setLayoutProperty(id, 'visibility', 'none'); } catch (e) { }
            }
        });
        if (state.currentStationId === 'qares' && typeof window.loadQARESData === 'function') {
            window.loadQARESData();
        }
    }

    // 8. Main Entrance Arrow Marker (LARES only)
    if (state.currentStationId === 'lares') {
        createEntranceArrowMarker();
    }

    // 9. Floating Section Badges — Mapbox view only (never in Google Maps view)
    removeSectionBadges();

    // 10. Building Name Markers (LARES only)
    removeMarkers();
    if (state.currentStationId === 'lares') {
        createMarkers();
    }

    // Strip unused Mapbox base style layers to keep style graph ultra-lean (~110 layers removed)
    // We provide our own Google satellite tiles + custom layers, so nothing from the base is needed.
    const customPrefixes = ['sec-', 'lares-', 'qares-', 'route-', 'google-', 'drone-', '3d-', 'gps-', 'phone-', 'plots-'];
    const currentLayers = map.getStyle().layers || [];
    currentLayers.forEach(layer => {
        const isCustom = customPrefixes.some(p => layer.id.startsWith(p));
        if (!isCustom) {
            try { map.removeLayer(layer.id); } catch (e) {
                try { map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (e2) { }
            }
        }
    });

    // Sync visual properties with current mode
    setMapStyleMode(state.currentMapStyleMode);
}

// ==========================================
// MAPBOX STANDARD MODE — Native 3D environment
// ==========================================
export function setupMapboxStandardLayers() {
    // 1. Configure Mapbox Standard style properties
    // Hide all external buildings (3D + 2D) and trees. Keep roads!
    try {
        map.setConfigProperty('basemap', 'lightPreset', 'day');
        map.setConfigProperty('basemap', 'show3dObjects', false);
        map.setConfigProperty('basemap', 'show3dBuildings', false);
        map.setConfigProperty('basemap', 'show3dLandmarks', false);
        map.setConfigProperty('basemap', 'show3dTrees', false);
        map.setConfigProperty('basemap', 'showPedestrianRoads', false);
        map.setConfigProperty('basemap', 'colorBuildings', 'rgba(0,0,0,0)');
        map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);
        map.setConfigProperty('basemap', 'showTransitLabels', false);
        map.setConfigProperty('basemap', 'showPlaceLabels', false);
        map.setConfigProperty('basemap', 'showRoadLabels', true);
    } catch (e) { console.warn('Config properties not supported:', e); }
    // Synchronize initial sky and atmospheric lighting with current time of day
    syncLightingWithTime();

    if (state.currentStationId === 'qares') {
        if (typeof window.loadQARESData === 'function') {
            window.loadQARESData();
        }
        removeSectionBadges();
        removeMarkers();
        setMapStyleMode(state.currentMapStyleMode);
        return;
    }

    // 2. Stylized Internal Road Network (roads.json) — slot 'middle'
    if (!map.getSource('lares-roads-source')) {
        map.addSource('lares-roads-source', {
            type: 'geojson',
            data: 'roads.json?v=72'
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
                'visibility': (state.currentMapStyleMode === 'mapbox') ? 'visible' : 'none'
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
                'visibility': (state.currentMapStyleMode === 'mapbox') ? 'visible' : 'none'
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
    const isBoundaryOn = (state.boundaryVisible !== undefined)
        ? state.boundaryVisible
        : (boundaryBtn ? boundaryBtn.classList.contains('active') : true);
    const initBoundaryVis = isBoundaryOn ? 'visible' : 'none';

    // 3. Distinct DA-LARES Compound Border Outline (single grass green outline per QGIS perimeter) — slot 'middle'
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
                'line-color': '#14532d',
                'line-width': 5.5,
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
                'line-color': '#22c55e',
                'line-width': 3,
                'line-opacity': 0.95
            }
        });
    }

    // 5. Custom DA-LARES 3D Buildings (33 traced footprints) — slot 'middle'
    if (LARES_DRAWINGS && LARES_DRAWINGS.features && CUSTOM_3D_BUILDINGS) {
        LARES_DRAWINGS.features.forEach(f => {
            if (f.properties && CUSTOM_3D_BUILDINGS[f.properties.id]) {
                f.properties.has_3d_model = true;
            }
        });
    }
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
            filter: ['!=', ['get', 'has_3d_model'], true],
            minzoom: 14.5,
            layout: { visibility: state.buildingsVisible ? 'visible' : 'none' },
            paint: {
                'fill-extrusion-color': '#f0ece4',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.95,
                'fill-extrusion-emissive-strength': 0.35,
                'fill-extrusion-cast-shadows': false
            }
        });
    }
    if (!map.getLayer('3d-drawings-roofs')) {
        map.addLayer({
            id: '3d-drawings-roofs',
            source: 'lares-drawings-source',
            type: 'fill-extrusion',
            slot: 'middle',
            filter: ['!=', ['get', 'has_3d_model'], true],
            minzoom: 14.5,
            layout: { visibility: state.buildingsVisible ? 'visible' : 'none' },
            paint: {
                'fill-extrusion-color': '#e8e2d8',
                'fill-extrusion-height': ['+', ['get', 'height'], 0.25],
                'fill-extrusion-base': ['get', 'height'],
                'fill-extrusion-opacity': 1.0,
                'fill-extrusion-emissive-strength': 0.35,
                'fill-extrusion-cast-shadows': false
            }
        });
    }

    // Custom Realistic 3D Building Models (MIS-RAFIS, etc.)
    setup3DBuildingModelsLayer(map, true);

    // 6. Custom 3D Low-Poly Tree Models (Mapbox 3D mode only — from trees.json)
    try {
        const TREE_MODELS = {
            'tree_mango': 'models/tree_mango.glb',
            'tree_palm': 'models/tree_palm.glb',
            'tree_pine': 'models/tree_pine.glb',
            'tree_bush': 'models/tree_bush.glb'
        };
        Object.keys(TREE_MODELS).forEach(k => {
            if (!map.hasModel(k)) map.addModel(k, TREE_MODELS[k]);
        });

        if (!map.getSource('lares-3d-trees-source')) {
            map.addSource('lares-3d-trees-source', {
                type: 'geojson',
                data: 'trees.json?v=72'
            });
        }

        const treeBtn = document.getElementById('chip-trees');
        const isTreesOn = (state.treesVisible !== undefined)
            ? state.treesVisible
            : (treeBtn ? treeBtn.classList.contains('active') : true);
        const initTreeVis = isTreesOn ? 'visible' : 'none';

        if (!map.getLayer('3d-trees-layer')) {
            map.addLayer({
                id: '3d-trees-layer',
                type: 'model',
                source: 'lares-3d-trees-source',
                slot: 'middle',
                minzoom: 17.8,
                layout: {
                    'model-id': ['coalesce', ['get', 'model'], 'tree_mango'],
                    'visibility': initTreeVis
                },
                paint: {
                    'model-scale': [
                        'case',
                        ['==', ['get', 'scale'], 0.75], [0.75, 0.75, 0.75],
                        ['==', ['get', 'scale'], 1.35], [1.35, 1.35, 1.35],
                        ['==', ['get', 'scale'], 1.7], [1.7, 1.7, 1.7],
                        [1.0, 1.0, 1.0]
                    ],
                    'model-rotation': [0, 0, ['coalesce', ['get', 'rotation'], 0]],
                    'model-cast-shadows': false,
                    'model-receive-shadows': false
                }
            });
        }
    } catch (e) {
        console.warn('Could not initialize 3D tree models:', e);
    }

    // 7. Entrance Arrow
    removeSectionBadges();
    createEntranceArrowMarker();

    // 7. Building Name Markers (numbered labels)
    removeMarkers();
    createMarkers();

    // 8. Update UI state
    setMapStyleMode(state.currentMapStyleMode);
}

export function setup3DBuildingModelsLayer(map, isStandardMode) {
    if (!CUSTOM_3D_BUILDINGS || typeof CUSTOM_3D_BUILDINGS !== 'object') return;

    try {
        // 1. Register GLB models with Mapbox
        Object.keys(CUSTOM_3D_BUILDINGS).forEach(id => {
            const b = CUSTOM_3D_BUILDINGS[id];
            if (!map.hasModel(b.modelId)) {
                map.addModel(b.modelId, b.modelUrl);
            }
        });

        // 2. Prepare GeoJSON source for 3D building instances
        const features = Object.keys(CUSTOM_3D_BUILDINGS).map(id => {
            const b = CUSTOM_3D_BUILDINGS[id];
            return {
                type: 'Feature',
                id: id,
                properties: {
                    id: id,
                    model: b.modelId,
                    rotation: b.rotation || 0,
                    scale: b.scale || [1, 1, 1]
                },
                geometry: {
                    type: 'Point',
                    coordinates: b.coords
                }
            };
        });

        const sourceId = 'lares-3d-buildings-models-source';
        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: features
                }
            });
        } else {
            map.getSource(sourceId).setData({
                type: 'FeatureCollection',
                features: features
            });
        }

        const layerId = '3d-buildings-models-layer';
        if (!map.getLayer(layerId)) {
            const layerDef = {
                id: layerId,
                type: 'model',
                source: sourceId,
                minzoom: 14.5,
                layout: {
                    'model-id': ['get', 'model'],
                    'visibility': state.buildingsVisible ? 'visible' : 'none'
                },
                paint: {
                    'model-scale': [1.0, 1.0, 1.0],
                    'model-rotation': [0, 0, ['coalesce', ['get', 'rotation'], 0]],
                    'model-opacity': 1.0,
                    'model-opacity-transition': { duration: 250, delay: 0 },
                    'model-cast-shadows': false,
                    'model-receive-shadows': false,
                    'model-emissive-strength': 0.8
                }
            };
            if (isStandardMode) {
                layerDef.slot = 'middle';
            }
            map.addLayer(layerDef);
        }

        const transLayerId = '3d-buildings-models-transparent';
        if (!map.getLayer(transLayerId)) {
            const transLayerDef = {
                id: transLayerId,
                type: 'model',
                source: sourceId,
                minzoom: 14.5,
                layout: {
                    'model-id': ['get', 'model'],
                    'visibility': state.buildingsVisible ? 'visible' : 'none'
                },
                paint: {
                    'model-scale': [1.0, 1.0, 1.0],
                    'model-rotation': [0, 0, ['coalesce', ['get', 'rotation'], 0]],
                    'model-opacity': 0.25,
                    'model-opacity-transition': { duration: 250, delay: 0 },
                    'model-cast-shadows': false,
                    'model-receive-shadows': false,
                    'model-emissive-strength': 0.8
                },
                filter: ['in', ['get', 'id'], ['literal', []]]
            };
            if (isStandardMode) {
                transLayerDef.slot = 'middle';
            }
            map.addLayer(transLayerDef);
        }
    } catch (e) {
        console.warn('Could not initialize 3D building models layer:', e);
    }
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
                'visibility': state.treesVisible ? 'visible' : 'none'
            }
        });
    } else {
        try { map.setLayoutProperty('3d-trees', 'visibility', state.treesVisible ? 'visible' : 'none'); } catch (e) { }
    }
}

map.on('style.load', setupLayers);

// ==========================================
// RESILIENT LOADING & STARTUP INTRO SEQUENCE
// ==========================================
let mapReady = false;
let isIntroAnimating = false;

export function stopIntroAnimation() {
    isIntroAnimating = false;
    state.isIntroAnimating = false;
    try { map.stop(); } catch (e) { }
}

export function playIntroAnimation(onComplete) {
    const urlParams = new URLSearchParams(window.location.search);
    const isMobileMode = (typeof window !== 'undefined' && (
        window.innerWidth <= 768 ||
        urlParams.get('mode') === 'phone' ||
        /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent)
    ));

    if (urlParams.has('dest') || isMobileMode) {
        isIntroAnimating = false;
        state.isIntroAnimating = false;
        map.jumpTo(getActiveStationDefaultView());
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    // Cancel any in-flight camera movements
    stopIntroAnimation();

    const stationId = state.currentStationId || 'lares';
    const introViews = getStationIntroViews(stationId);

    // 1. Position camera at station's start view (top-down 2D view zoomed out: pitch 0, bearing 0)
    map.jumpTo({
        center: introViews.start.center,
        zoom: introViews.start.zoom,
        pitch: introViews.start.pitch,
        bearing: introViews.start.bearing
    });

    isIntroAnimating = true;
    state.isIntroAnimating = true;

    // Temporarily relax bounds during the cinematic fly-in so there is zero camera jitter or boundary snapping
    try {
        map.setMaxBounds([
            [120.40, 13.30],
            [122.80, 15.00]
        ]);
    } catch (e) { }

    // 2. Slowly zooms in until it gets to the 2D top-down view directly above You Are Here pin
    map.flyTo({
        center: introViews.target2D.center,
        zoom: introViews.target2D.zoom,
        pitch: introViews.target2D.pitch,
        bearing: introViews.target2D.bearing,
        duration: 3600,
        speed: 0.65,
        curve: 1.0,
        essential: true
    });

    map.once('moveend', () => {
        if (!isIntroAnimating) return;
        setTimeout(() => {
            if (!isIntroAnimating) return;
            // 3. Then after reaching this zoom, transitions to the station's signature 3D perspective angle
            map.flyTo({
                center: introViews.final3D.center,
                zoom: introViews.final3D.zoom,
                pitch: introViews.final3D.pitch,
                bearing: introViews.final3D.bearing,
                duration: 2200,
                essential: true
            });
            map.once('moveend', () => {
                isIntroAnimating = false;
                state.isIntroAnimating = false;
                const activeBounds = introViews.bounds || (STATIONS[stationId] && STATIONS[stationId].bounds);
                if (activeBounds) {
                    try { map.setMaxBounds(activeBounds); } catch (e) { }
                }
                if (typeof onComplete === 'function') onComplete();
            });
        }, 450);
    });
}

export function revealMap() {
    if (mapReady || state.mapReady) return;
    mapReady = true;
    state.mapReady = true;
    window.mapReady = true;
    document.getElementById('loading-overlay').classList.add('hidden');
    setTimeout(() => document.getElementById('sidebar').classList.add('visible'), 500);
    setTimeout(() => document.getElementById('coords-badge').classList.add('visible'), 800);

    playIntroAnimation();
}

// Allow any user interaction to stop the intro animation smoothly
['dragstart', 'rotatestart', 'pitchstart', 'zoomstart', 'mousedown', 'touchstart'].forEach(evt => {
    map.on(evt, (e) => {
        if (e && e.originalEvent && isIntroAnimating) {
            isIntroAnimating = false;
            state.isIntroAnimating = false;
            map.stop();
            const stationId = state.currentStationId || 'lares';
            const station = STATIONS[stationId] || STATIONS.lares;
            if (station && station.bounds) {
                try { map.setMaxBounds(station.bounds); } catch (err) { }
            }
        }
    });
});

// Custom Mapbox Accessibility 1-Finger Orbit Joystick Control
class OrbitControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group ctrl-orbit-group';

        const btn = document.createElement('button');
        btn.className = 'mapboxgl-ctrl-icon ctrl-orbit-btn';
        btn.type = 'button';
        btn.title = 'Toggle 1-Finger Orbit Mode (SketchUp Orbit)';
        btn.innerHTML = '<span style="font-size: 16px; display: inline-block;">🕹️</span>';

        btn.onclick = (e) => {
            e.stopPropagation();
            if (typeof window.toggleOneFingerOrbitMode === 'function') {
                window.toggleOneFingerOrbitMode();
            }
        };

        this._container.appendChild(btn);
        return this._container;
    }

    onRemove() {
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        this._map = undefined;
    }
}

// Height Limit & Metric Scale Control (Includes 75m threshold and limits maximum vertical display to 75m)
class HeightLimitScaleControl extends mapboxgl.ScaleControl {
    constructor(options = {}) {
        super({ maxWidth: 120, unit: 'metric', ...options });
    }

    _setScale(maxWidth, maxDistance, unit) {
        if (unit === 'meter') {
            let distance = 1;
            const thresholds = [75, 50, 20, 10, 5, 2, 1];
            for (const t of thresholds) {
                if (maxDistance >= t) {
                    distance = t;
                    break;
                }
            }
            const ratio = distance / maxDistance;
            this._container.innerHTML = `${distance} m`;
            this._container.style.width = `${Math.min(maxWidth, Math.round(maxWidth * ratio))}px`;
            return;
        }
        super._setScale(maxWidth, maxDistance, unit);
    }
}

map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new OrbitControl(), 'top-right');
map.addControl(new HeightLimitScaleControl(), 'bottom-right');
map.addControl(new mapboxgl.FullscreenControl({ container: document.documentElement }), 'top-right');

// Strategy 1: full load
map.on('load', () => {
    const isMobileMode = (typeof window !== 'undefined' && (
        window.innerWidth <= 768 ||
        window.location.search.includes('mode=phone') ||
        /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent)
    ));
    setTimeout(revealMap, isMobileMode ? 750 : 300);
});
// Strategy 2: style load fallback
map.on('style.load', () => setTimeout(() => { if (!mapReady) revealMap(); }, 5000));
// Strategy 3: hard timeout
setTimeout(() => { if (!mapReady) revealMap(); }, 10000);

export const SKY_PRESETS = {
    day: {
        lightPreset: 'day',
        fog: {
            'range': [0.8, 12],
            'color': '#e0f2fe',
            'high-color': '#0284c7',
            'horizon-blend': 0.15,
            'space-color': '#0369a1',
            'star-intensity': 0.0
        }
    },
    dawn: {
        lightPreset: 'dawn',
        fog: {
            'range': [0.5, 10],
            'color': '#fde68a',
            'high-color': '#38bdf8',
            'horizon-blend': 0.2,
            'space-color': '#1e3a8a',
            'star-intensity': 0.1
        }
    },
    dusk: {
        lightPreset: 'dusk',
        fog: {
            'range': [0.5, 9],
            'color': '#fdba74',
            'high-color': '#6366f1',
            'horizon-blend': 0.25,
            'space-color': '#1e1b4b',
            'star-intensity': 0.25
        }
    },
    night: {
        lightPreset: 'night',
        fog: {
            'range': [0.5, 8],
            'color': '#0f172a',
            'high-color': '#020617',
            'horizon-blend': 0.1,
            'space-color': '#020617',
            'star-intensity': 0.6
        }
    }
};

let currentSkyPreset = 'day';

export function setLighting(preset) {
    const config = SKY_PRESETS[preset] || SKY_PRESETS['day'];
    currentSkyPreset = preset;

    // 1. If in Mapbox Standard 3D mode, update basemap lightPreset
    if (state.currentMapStyleMode === 'mapbox') {
        try {
            map.setConfigProperty('basemap', 'lightPreset', config.lightPreset);
        } catch (e) { }
    }

    // 2. Set atmospheric sky/fog for ALL modes (both Mapbox Standard 3D & Aerial Drone View)
    // Eliminates morning pitch blackness above horizon and ensures morning daylight, dawn, dusk, and night skies render vibrantly
    try {
        map.setFog(config.fog);
    } catch (e) { }
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
    state.buildingsVisible = !state.buildingsVisible;
    if (btn) btn.classList.toggle('active', state.buildingsVisible);
    const chip = document.getElementById('chip-buildings');
    if (chip && chip !== btn) chip.classList.toggle('active', state.buildingsVisible);

    const vis = state.buildingsVisible ? 'visible' : 'none';
    try {
        if (map.getLayer('3d-drawings')) map.setLayoutProperty('3d-drawings', 'visibility', vis);
        if (map.getLayer('3d-drawings-roofs')) map.setLayoutProperty('3d-drawings-roofs', 'visibility', vis);
        if (map.getLayer('3d-drawings-transparent')) map.setLayoutProperty('3d-drawings-transparent', 'visibility', vis);
        if (map.getLayer('3d-drawings-roofs-transparent')) map.setLayoutProperty('3d-drawings-roofs-transparent', 'visibility', vis);
        if (map.getLayer('3d-buildings-models-layer')) map.setLayoutProperty('3d-buildings-models-layer', 'visibility', vis);
        if (map.getLayer('3d-buildings-models-transparent')) map.setLayoutProperty('3d-buildings-models-transparent', 'visibility', vis);
        if (map.getLayer('3d-buildings-mapbox')) {
            map.setLayoutProperty('3d-buildings-mapbox', 'visibility', (state.buildingsVisible && state.currentMapStyleMode === 'mapbox') ? 'visible' : 'none');
        }
        if (map.getLayer('qares-footprints-3d')) map.setLayoutProperty('qares-footprints-3d', 'visibility', vis);
        if (map.getLayer('qares-footprints-roofs')) map.setLayoutProperty('qares-footprints-roofs', 'visibility', vis);
    } catch (e) { }
    safeResetIdle();
}

export function toggleTrees(btn) {
    state.treesVisible = !state.treesVisible;
    if (btn) btn.classList.toggle('active', state.treesVisible);
    const chip = document.getElementById('chip-trees');
    if (chip && chip !== btn) chip.classList.toggle('active', state.treesVisible);
    const phoneTree = document.getElementById('phone-trees-toggle');
    if (phoneTree && phoneTree !== btn) phoneTree.classList.toggle('active', state.treesVisible);

    try {
        if (map.getLayer('3d-trees-layer')) {
            map.setLayoutProperty('3d-trees-layer', 'visibility', (state.treesVisible && state.currentMapStyleMode === 'mapbox') ? 'visible' : 'none');
        }
        if (map.getLayer('3d-trees')) {
            map.setLayoutProperty('3d-trees', 'visibility', 'none');
        }
    } catch (e) { }
    safeResetIdle();
}

export function toggleMapLayerMenu() {
    const isPhone = (typeof isPhoneMode === 'function' && isPhoneMode()) || window.innerWidth <= 768;
    if (isPhone) {
        openMapLayerModal();
    } else {
        const widget = document.getElementById('map-layer-widget');
        if (widget) {
            widget.classList.toggle('expanded');
        }
    }
}

export function openMapLayerModal() {
    const modal = document.getElementById('map-layer-modal');
    const backdrop = document.getElementById('map-layer-modal-backdrop');
    if (modal) modal.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
}

export function closeMapLayerModal() {
    const modal = document.getElementById('map-layer-modal');
    const backdrop = document.getElementById('map-layer-modal-backdrop');
    if (modal) modal.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
}

export function closeMapLayerFlyout() {
    const widget = document.getElementById('map-layer-widget');
    if (widget) widget.classList.remove('expanded');
}

export function selectMapStyle(mode) {
    closeMapLayerModal();
    closeMapLayerFlyout();

    if (state.currentMapStyleMode === mode) return;
    state.currentMapStyleMode = mode;

    // Preserve current camera view angle, zoom, pitch, and bearing seamlessly
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentPitch = map.getPitch();
    const currentBearing = map.getBearing();

    if (mode === 'mapbox') {
        map.setStyle('mapbox://styles/mapbox/standard');
    } else {
        map.setStyle('mapbox://styles/mapbox/satellite-streets-v12');
    }

    if (typeof window.resetOcclusion === 'function') {
        window.resetOcclusion();
    }

    map.once('style.load', () => {
        map.jumpTo({
            center: currentCenter,
            zoom: currentZoom,
            pitch: currentPitch,
            bearing: currentBearing
        });
        if (state.currentStationId === 'qares' && typeof window.loadQARESData === 'function') {
            window.loadQARESData();
        }
        setMapStyleMode(mode);
    });

    setMapStyleMode(mode);
}

export function toggleMapboxView(btn) {
    const nextMode = (state.currentMapStyleMode === 'google') ? 'mapbox' : 'google';
    selectMapStyle(nextMode);
}

export function setMapStyleMode(mode) {
    state.currentMapStyleMode = mode;
    const isMapbox = (mode === 'mapbox');

    // Toggle body class for CSS state
    document.body.classList.toggle('map-mode-mapbox', isMapbox);

    // Update Desktop flyout options
    const optGoogle = document.getElementById('layer-opt-google');
    const optMapbox = document.getElementById('layer-opt-mapbox');
    if (optGoogle) optGoogle.classList.toggle('active', !isMapbox);
    if (optMapbox) optMapbox.classList.toggle('active', isMapbox);

    // Update Mobile pop-up modal options
    const mlmGoogle = document.getElementById('mlm-opt-google');
    const mlmMapbox = document.getElementById('mlm-opt-mapbox');
    if (mlmGoogle) mlmGoogle.classList.toggle('active', !isMapbox);
    if (mlmMapbox) mlmMapbox.classList.toggle('active', isMapbox);

    // Update top-right trigger icon
    const triggerIcon = document.getElementById('mlt-current-icon');
    if (triggerIcon) {
        triggerIcon.textContent = isMapbox ? '🗺️' : '🚁';
    }

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
        if (icon) icon.textContent = isMapbox ? '🚁' : '🗺️';
        if (label) label.textContent = isMapbox ? 'Aerial Drone' : 'Mapbox 3D';
    }

    const phoneToggle = document.getElementById('phone-mapbox-toggle');
    if (phoneToggle) {
        phoneToggle.classList.toggle('active', isMapbox);
        phoneToggle.textContent = isMapbox ? '🚁 Aerial Drone' : '🗺️ Mapbox 3D';
    }

    removeSectionBadges();
    try {
        if (map.getLayer('google-satellite-layer')) {
            map.setLayoutProperty('google-satellite-layer', 'visibility', isMapbox ? 'none' : 'visible');
        }
        if (map.getLayer('lares-drone-layer')) {
            map.setLayoutProperty('lares-drone-layer', 'visibility', (!isMapbox && (!state.currentStationId || state.currentStationId === 'lares')) ? 'visible' : 'none');
        }
        if (map.getLayer('qares-ortho-layer')) {
            map.setLayoutProperty('qares-ortho-layer', 'visibility', (!isMapbox && state.currentStationId === 'qares') ? 'visible' : 'none');
        }
        if (map.getLayer('google-satellite-overlay-layer')) {
            map.setLayoutProperty('google-satellite-overlay-layer', 'visibility', (!isMapbox && state.gmapsOverlayOpacity > 0) ? 'visible' : 'none');
        }
        if (map.getLayer('lares-mask-layer')) {
            map.setPaintProperty('lares-mask-layer', 'fill-color', isMapbox ? '#060a12' : '#0b1121');
        }
        if (map.getLayer('3d-trees-layer')) {
            map.setLayoutProperty('3d-trees-layer', 'visibility', (isMapbox && state.treesVisible) ? 'visible' : 'none');
        }
        if (map.getLayer('3d-trees')) {
            map.setLayoutProperty('3d-trees', 'visibility', 'none');
        }
        const showRoads = isMapbox && (state.currentStationId === 'lares' || !state.currentStationId);
        if (map.getLayer('lares-roads-casing')) {
            map.setLayoutProperty('lares-roads-casing', 'visibility', showRoads ? 'visible' : 'none');
        }
        if (map.getLayer('lares-roads-fill')) {
            map.setLayoutProperty('lares-roads-fill', 'visibility', showRoads ? 'visible' : 'none');
        }
    } catch (e) { }
    // Maintain atmospheric sky across mode toggles
    setLighting(currentSkyPreset);

    updateMarkerZoomState();
    if (typeof window.syncDroneOffsetOnStyleChange === 'function') {
        window.syncDroneOffsetOnStyleChange();
    }
    safeResetIdle();
}

if (typeof window !== 'undefined') {
    window.addEventListener('click', (e) => {
        const widget = document.getElementById('map-layer-widget');
        if (widget && widget.classList.contains('expanded')) {
            if (!widget.contains(e.target)) {
                widget.classList.remove('expanded');
            }
        }
    });
    window.toggleMapLayerMenu = toggleMapLayerMenu;
    window.openMapLayerModal = openMapLayerModal;
    window.closeMapLayerModal = closeMapLayerModal;
    window.closeMapLayerFlyout = closeMapLayerFlyout;
    window.selectMapStyle = selectMapStyle;
    window.setLighting = setLighting;
    window.syncLightingWithTime = syncLightingWithTime;
}

export function toggleBoundary(btn) {
    if (typeof window.toggleSettingChip === 'function') window.toggleSettingChip(btn, 'boundary');
}

export function toggleTerrain(btn) {
    state.terrainEnabled = !state.terrainEnabled;
    btn.classList.toggle('active');
    state.terrainEnabled ? map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 }) : map.setTerrain(null);
}

export function toggleMarkers(btn) {
    if (typeof window.toggleSettingChip === 'function') {
        window.toggleSettingChip(btn || document.getElementById('chip-numbers'), 'numbers');
    }
}

export function flyToView(n) {
    isIntroAnimating = false;
    if (state.currentStationId === 'qares') {
        const defaultView = getActiveStationDefaultView('qares');
        map.flyTo({ center: defaultView.center, zoom: defaultView.zoom, pitch: defaultView.pitch, bearing: defaultView.bearing, duration: 1500, essential: true });
        return;
    }
    const v = VIEWS[n]; if (!v) return;
    map.flyTo({ center: v.center, zoom: v.zoom, pitch: v.pitch, bearing: v.bearing, duration: v.duration, essential: true, curve: 1.2 });
}

window.stopIntroAnimation = stopIntroAnimation;
window.playIntroAnimation = playIntroAnimation;
window.revealMap = revealMap;

