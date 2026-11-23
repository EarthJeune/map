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
import { lucideIcon } from './data/icons.js';

import {
    DA_LARES_OUTER_PERIMETER,
    LARES_MASK,
    LARES_COMPOUND_OUTLINE,
    LARES_BOUNDARY,
    LARES_UNIFIED_BOUNDARY
} from './data/geo.js';

import {
    LARES_DRAWINGS,
    BUILDING_DIRECTORY,
    CUSTOM_3D_BUILDINGS
} from './data/buildings.js';
if (typeof window !== 'undefined') window.CUSTOM_3D_BUILDINGS = CUSTOM_3D_BUILDINGS;

import { state } from './data/state.js';

import {
    FIELD_COMMODITY_ZONES,
    ZONE_POLYGONS
} from './data/plots.js';

import {
    activeStatusFilters,
    normalizeFacilityStatus,
    buildFallbackRectRing
} from './status-filter.js';

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
    getOptimalPixelRatio,
    getActivePerformanceProfile,
    applyMapboxPixelRatio,
    notifyStyleTransitionGrace,
    isEcoPerfMode,
    isLowPolyMode
} from './performance.js';

import { initPlotLayers, updatePlotStatusFilters } from './plot-layers.js';

export function getMinimalDroneStyle() {
    return {
        version: 8,
        name: 'DA-Drone-View',
        glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
        light: {
            anchor: 'viewport',
            color: '#ffffff',
            intensity: 0.42
        },
        sources: {},
        layers: [
            {
                id: 'drone-earth-bg',
                type: 'background',
                paint: {
                    'background-color': '#0b1121'
                }
            }
        ]
    };
}

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
applyMapboxPixelRatio(optimalRatio, null);

function createOptimizedMapInstance() {
    const perfProfile = getActivePerformanceProfile();
    const shouldPreferHighPerf = perfProfile !== 'eco';
    const origGetContext = (shouldPreferHighPerf && typeof HTMLCanvasElement !== 'undefined')
        ? HTMLCanvasElement.prototype.getContext
        : null;

    if (origGetContext) {
        HTMLCanvasElement.prototype.getContext = function(type, attrs) {
            if ((type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') && this.closest && this.closest('#map')) {
                const nextAttrs = Object.assign({}, attrs || {}, { powerPreference: 'high-performance' });
                return origGetContext.call(this, type, nextAttrs);
            }
            return origGetContext.call(this, type, attrs);
        };
    }

    try {
        const useLowPoly = isLowPolyMode();
        const mapboxVectorStyle = useLowPoly
            ? 'mapbox://styles/mapbox/dark-v11'
            : 'mapbox://styles/mapbox/standard';
        return new mapboxgl.Map({
            container: 'map',
            style: (state.currentMapStyleMode === 'mapbox')
                ? mapboxVectorStyle
                : getMinimalDroneStyle(),
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
            antialias: !hardwareProfile.isLowEnd && !hardwareProfile.isIntegratedGpu && !isInitialMobileDevice && !useLowPoly,
            maxTileCacheSize: useLowPoly ? 36 : (isInitialMobileDevice ? 72 : 120),
            renderWorldCopies: false,
            fadeDuration: (isInitialMobileDevice || useLowPoly) ? 0 : 40,
            refreshExpiredTiles: false
        });
    } finally {
        if (origGetContext) {
            HTMLCanvasElement.prototype.getContext = origGetContext;
        }
    }
}

export const map = createOptimizedMapInstance();
state.map = map;
window.map = map;
map.on('zoom', updateMarkerZoomState);
map.on('zoomend', () => {
    updateMarkerZoomState();
    syncGoogleSatelliteVisibility();
});

export function syncGoogleSatelliteVisibility() {
    if (!map || !map.getLayer('google-satellite-layer')) return;
    const isDroneMode = (state.currentMapStyleMode !== 'mapbox');
    // Always keep Google Satellite visible underneath Aerial Drone tiles so transparent MBTiles cutouts never reveal white/blue holes
    const desiredVis = isDroneMode ? 'visible' : 'none';
    try {
        if (map.getLayoutProperty('google-satellite-layer', 'visibility') !== desiredVis) {
            map.setLayoutProperty('google-satellite-layer', 'visibility', desiredVis);
        }
    } catch (e) { }
}
if (typeof window !== 'undefined') {
    window.syncGoogleSatelliteVisibility = syncGoogleSatelliteVisibility;
}

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
    caseStyle.push('#1f5c3e'); // Crisp forest green architectural roof fallback for Low-Poly 3D
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
                'visibility': (state.currentMapStyleMode !== 'mapbox') ? 'visible' : 'none'
            },
            'paint': {
                'raster-fade-duration': 0
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
            'maxzoom': 21,
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

    // Soft ambient grass green glow (Google Satellite mode, blur disabled for 60fps shader perf)
    if (!map.getLayer('lares-boundary-glow')) {
        map.addLayer({
            id: 'lares-boundary-glow',
            type: 'line',
            source: 'lares-unified-boundary-source',
            layout: { 'visibility': initBoundaryVis },
            paint: {
                'line-color': '#4ade80',
                'line-width': 8,
                'line-blur': 0,
                'line-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    14, 0.35,
                    16, 0.25,
                    18, 0.14
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
            data: 'roads.json?v=81'
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
        const isMapbox = (state.currentMapStyleMode === 'mapbox');
        map.addLayer({
            'id': 'lares-mask-layer',
            'type': 'fill',
            'source': 'lares-mask-source',
            'layout': {
                'visibility': (!isMapbox && (!state.currentStationId || state.currentStationId === 'lares')) ? 'visible' : 'none'
            },
            'paint': {
                'fill-color': '#0b1121',
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
        const extrudeFilter = ['!=', ['get', 'has_3d_model'], true];
        map.addLayer({
            'id': '3d-drawings',
            'source': 'lares-drawings-source',
            'type': 'fill-extrusion',
            'filter': extrudeFilter,
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
        const extrudeFilter = ['!=', ['get', 'has_3d_model'], true];
        map.addLayer({
            'id': '3d-drawings-roofs',
            'source': 'lares-drawings-source',
            'type': 'fill-extrusion',
            'filter': extrudeFilter,
            'minzoom': 14.5,
            'layout': {
                'visibility': state.buildingsVisible ? 'visible' : 'none'
            },
            'paint': {
                'fill-extrusion-color': (state.currentMapStyleMode === 'mapbox') ? getRoofColorCaseStyle() : getRoofColorCaseStyle(),
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
        } else if (state.currentStationId === 'rares' && typeof window.loadRARESData === 'function') {
            window.loadRARESData();
        }
    }

    // 8. Main Entrance Arrow Marker (LARES only)
    if (state.currentStationId === 'lares') {
        createEntranceArrowMarker();
    }

    // 9. Floating Section Badges — Mapbox view only (never in Google Maps view)
    removeSectionBadges();

    // 10. Building Name Markers (LARES only — reuse existing DOM markers across style switches)
    if (state.currentStationId === 'lares') {
        if (!state.markers || state.markers.length === 0) {
            createMarkers();
        }
    } else {
        removeMarkers();
    }

    // Strip unused Mapbox base style layers to keep style graph ultra-lean (~110 layers removed)
    // We provide our own Google satellite tiles + custom layers, so nothing from the base is needed.
    const customPrefixes = ['sec-', 'lares-', 'qares-', 'rares-', 'cares-', 'route-', 'google-', 'drone-', '3d-', 'gps-', 'phone-', 'plots-', 'building-under-construction-', 'proposed-'];
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

    if (mapReady && (!state.currentStationId || state.currentStationId === 'lares')) {
        try { initPlotLayers(); } catch (e) { }
    }

    ensureStatusOverlayLayers(false);
    applyFacilityStatusFilters();
}

// ==========================================
// MAPBOX STANDARD MODE — Native 3D environment
// ==========================================
export function setupMapboxStandardLayers() {
    const styleObj = map.getStyle() || {};
    const isStandardStyle = Array.isArray(styleObj.imports) && styleObj.imports.length > 0;

    if (isStandardStyle) {
        // Hide all external buildings (3D + 2D) and trees on Mapbox Standard
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
    } else {
        // Lightweight vector mode (dark-v11 for Low-Poly Kiosk): hide generic vector buildings/POI clutter
        try {
            (styleObj.layers || []).forEach(l => {
                if (!l || !l.id) return;
                if (/^(building|poi-label|transit-label)/i.test(l.id)) {
                    map.setLayoutProperty(l.id, 'visibility', 'none');
                }
            });
        } catch (e) { }
    }
    // Synchronize initial sky and atmospheric lighting
    syncLightingWithTime();

    if (state.currentStationId === 'qares') {
        if (typeof window.loadQARESData === 'function') {
            window.loadQARESData();
        }
        removeSectionBadges();
        removeMarkers();
        setMapStyleMode(state.currentMapStyleMode);
        ensureStatusOverlayLayers(isStandardStyle);
        applyFacilityStatusFilters();
        return;
    }

    if (state.currentStationId === 'rares') {
        if (typeof window.loadRARESData === 'function') {
            window.loadRARESData();
        }
        removeSectionBadges();
        removeMarkers();
        setMapStyleMode(state.currentMapStyleMode);
        ensureStatusOverlayLayers(isStandardStyle);
        applyFacilityStatusFilters();
        return;
    }

    // 2. Stylized Internal Road Network (roads.json)
    if (!map.getSource('lares-roads-source')) {
        map.addSource('lares-roads-source', {
            type: 'geojson',
            data: 'roads.json?v=81'
        });
    }
    if (!map.getLayer('lares-roads-casing')) {
        const layerCfg = {
            id: 'lares-roads-casing',
            type: 'line',
            source: 'lares-roads-source',
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
        };
        if (isStandardStyle) layerCfg.slot = 'middle';
        map.addLayer(layerCfg);
    }
    if (!map.getLayer('lares-roads-fill')) {
        const layerCfg = {
            id: 'lares-roads-fill',
            type: 'line',
            source: 'lares-roads-source',
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
        };
        if (isStandardStyle) layerCfg.slot = 'middle';
        map.addLayer(layerCfg);
    }

    const boundaryBtn = document.getElementById('chip-boundary');
    const isBoundaryOn = (state.boundaryVisible !== undefined)
        ? state.boundaryVisible
        : (boundaryBtn ? boundaryBtn.classList.contains('active') : true);
    const initBoundaryVis = isBoundaryOn ? 'visible' : 'none';

    // 3. Distinct DA-LARES Compound Border Outline (single grass green outline per QGIS perimeter)
    if (!map.getSource('lares-compound-border-source')) {
        map.addSource('lares-compound-border-source', {
            type: 'geojson',
            data: LARES_COMPOUND_OUTLINE
        });
    }
    if (!map.getLayer('lares-compound-border-casing')) {
        const layerCfg = {
            id: 'lares-compound-border-casing',
            type: 'line',
            source: 'lares-compound-border-source',
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
        };
        if (isStandardStyle) layerCfg.slot = 'middle';
        map.addLayer(layerCfg);
    }
    if (!map.getLayer('lares-compound-border-line')) {
        const layerCfg = {
            id: 'lares-compound-border-line',
            type: 'line',
            source: 'lares-compound-border-source',
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
        };
        if (isStandardStyle) layerCfg.slot = 'middle';
        map.addLayer(layerCfg);
    }

    // 5. Custom DA-LARES 3D Buildings (33 traced footprints)
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
    const stdFilter = ['!=', ['get', 'has_3d_model'], true];
    if (!map.getLayer('3d-drawings')) {
        const layerCfg = {
            id: '3d-drawings',
            source: 'lares-drawings-source',
            type: 'fill-extrusion',
            filter: stdFilter,
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
        };
        if (isStandardStyle) layerCfg.slot = 'middle';
        map.addLayer(layerCfg);
    }
    if (!map.getLayer('3d-drawings-roofs')) {
        const layerCfg = {
            id: '3d-drawings-roofs',
            source: 'lares-drawings-source',
            type: 'fill-extrusion',
            filter: stdFilter,
            minzoom: 14.5,
            layout: { visibility: state.buildingsVisible ? 'visible' : 'none' },
            paint: {
                'fill-extrusion-color': getRoofColorCaseStyle(),
                'fill-extrusion-height': ['+', ['get', 'height'], 0.25],
                'fill-extrusion-base': ['get', 'height'],
                'fill-extrusion-opacity': 1.0,
                'fill-extrusion-emissive-strength': 0.35,
                'fill-extrusion-cast-shadows': false
            }
        };
        if (isStandardStyle) layerCfg.slot = 'middle';
        map.addLayer(layerCfg);
    }

    // Authentic Bespoke 3D Building Models (always rendered across Low-Res Eco & High modes)
    setup3DBuildingModelsLayer(map, isStandardStyle);

    // 6. Custom 3D Low-Poly Tree Models (skipped automatically in Low-Poly / Eco Mode to save VRAM)
    if (!isLowPolyMode()) {
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
                tolerance: 0,
                buffer: 0,
                maxzoom: 24,
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
    }

    // 7. Entrance Arrow
    removeSectionBadges();
    createEntranceArrowMarker();

    // 7. Building Name Markers (reuse existing DOM markers if already mounted for LARES)
    if (!state.markers || state.markers.length === 0) {
        createMarkers();
    }

    // 8. Agricultural Plots Layer (22 research commodity blocks)
    if (!state.currentStationId || state.currentStationId === 'lares') {
        try {
            initPlotLayers();
        } catch (e) {
            console.warn('Could not init plot layers in Mapbox Standard mode:', e);
        }
    }

    // 9. Update UI state
    setMapStyleMode(state.currentMapStyleMode);
    ensureStatusOverlayLayers(true);
    applyFacilityStatusFilters();
}

/** Move a layer to the top only when it is not scoped to a Mapbox Standard slot. */
export function safeMoveLayer(m, layerId) {
    try {
        if (!m) return;
        const layer = m.getLayer(layerId);
        if (!layer) return;
        const style = m.getStyle();
        if (!style || !Array.isArray(style.layers)) return;
        if (Array.isArray(style.imports) && style.imports.length > 0) {
            return;
        }
        const styleLayer = style.layers.find(l => l.id === layerId);
        const slot = styleLayer?.slot
            || layer.slot
            || (typeof layer.serialize === 'function' ? layer.serialize().slot : null);
        if (!slot) {
            m.moveLayer(layerId);
        }
    } catch (e) {}
}

export function setupStation3DModels(map, stationId = 'lares', isStandardMode = false) {
    if (!CUSTOM_3D_BUILDINGS || typeof CUSTOM_3D_BUILDINGS !== 'object') return;
    const targetStation = stationId || state.currentStationId || 'lares';
    const ecoPerf = isEcoPerfMode();
    const styleObj = (typeof map.getStyle === 'function' ? map.getStyle() : null) || {};
    const hasStdImports = Boolean(isStandardMode && Array.isArray(styleObj.imports) && styleObj.imports.length > 0);

    try {
        // 1. Get building IDs strictly belonging to this station
        const stationBuildingIds = Object.keys(CUSTOM_3D_BUILDINGS).filter(id => {
            const b = CUSTOM_3D_BUILDINGS[id];
            const bStation = b.stationId || 'lares';
            return bStation === targetStation;
        });

        if (stationBuildingIds.length === 0) return;

        // 2. Register GLB models with Mapbox
        stationBuildingIds.forEach(id => {
            const b = CUSTOM_3D_BUILDINGS[id];
            if (!map.hasModel(b.modelId)) {
                map.addModel(b.modelId, b.modelUrl);
            }
        });

        // 3. Prepare dedicated static GeoJSON features for this station
        const dirSource = (typeof window !== 'undefined' && Array.isArray(window.BUILDING_DIRECTORY))
            ? window.BUILDING_DIRECTORY
            : BUILDING_DIRECTORY;
        const dirStatusMap = new Map(
            (dirSource || []).map(item => [item.id, normalizeFacilityStatus(item.facility_status || 'Existing')])
        );
        const features = stationBuildingIds.map(id => {
            const b = CUSTOM_3D_BUILDINGS[id];
            const fStatus = dirStatusMap.get(id) || normalizeFacilityStatus(b.facility_status || 'Existing');
            return {
                type: 'Feature',
                id: id,
                properties: {
                    id: id,
                    model: b.modelId,
                    rotation: b.rotation || 0,
                    scale: b.scale || [1, 1, 1],
                    station: targetStation,
                    facility_status: fStatus
                },
                geometry: {
                    type: 'Point',
                    coordinates: b.coords
                }
            };
        });

        const sourceId = `${targetStation}-3d-models-source`;
        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, {
                type: 'geojson',
                tolerance: 0,
                buffer: 64,
                maxzoom: 16,
                data: {
                    type: 'FeatureCollection',
                    features: features
                }
            });
        } else {
            try {
                map.getSource(sourceId).setData({
                    type: 'FeatureCollection',
                    features: features
                });
            } catch (e) {}
        }

        const isCurrentStation = (state.currentStationId || 'lares') === targetStation;
        const shouldBeVisible = isCurrentStation && (state.buildingsVisible !== false);

        // 4. Solid 3D Building Layer for this station (single canonical layer — no duplicate draw calls)
        const layerId = `${targetStation}-3d-models-layer`;
        if (!map.getLayer(layerId)) {
            const layerDef = {
                id: layerId,
                type: 'model',
                source: sourceId,
                minzoom: 14.5,
                layout: {
                    'model-id': ['get', 'model'],
                    'visibility': shouldBeVisible ? 'visible' : 'none'
                },
                paint: {
                    'model-scale': ['coalesce', ['get', 'scale'], ['literal', [1.0, 1.0, 1.0]]],
                    'model-rotation': [0, 0, ['coalesce', ['get', 'rotation'], 0]],
                    'model-opacity': 1.0,
                    'model-opacity-transition': { duration: ecoPerf ? 0 : 250, delay: 0 },
                    'model-cast-shadows': false,
                    'model-receive-shadows': false,
                    'model-emissive-strength': 0.8
                }
            };
            if (hasStdImports) {
                layerDef.slot = 'middle';
            }
            map.addLayer(layerDef);
        } else {
            try {
                map.setLayoutProperty(layerId, 'visibility', shouldBeVisible ? 'visible' : 'none');
                safeMoveLayer(map, layerId);
            } catch (e) {}
        }

        // 5. Translucent 3D Layer for Walker Occlusion (skipped in Eco Low-Res mode to avoid duplicate draw passes)
        const transLayerId = `${targetStation}-3d-models-transparent`;
        if (!ecoPerf) {
            if (!map.getLayer(transLayerId)) {
                const transLayerDef = {
                    id: transLayerId,
                    type: 'model',
                    source: sourceId,
                    minzoom: 14.5,
                    layout: {
                        'model-id': ['get', 'model'],
                        'visibility': 'none'
                    },
                    paint: {
                        'model-scale': ['coalesce', ['get', 'scale'], ['literal', [1.0, 1.0, 1.0]]],
                        'model-rotation': [0, 0, ['coalesce', ['get', 'rotation'], 0]],
                        'model-opacity': 0.25,
                        'model-opacity-transition': { duration: 250, delay: 0 },
                        'model-cast-shadows': false,
                        'model-receive-shadows': false,
                        'model-emissive-strength': 0.8
                    },
                    filter: ['in', ['get', 'id'], ['literal', []]]
                };
                if (hasStdImports) {
                    transLayerDef.slot = 'middle';
                }
                map.addLayer(transLayerDef);
            } else {
                safeMoveLayer(map, transLayerId);
            }
        } else if (map.getLayer(transLayerId)) {
            try { map.setLayoutProperty(transLayerId, 'visibility', 'none'); } catch (e) {}
        }

        // If target station is active, guarantee its 3D model layer is elevated to the top
        if (isCurrentStation) {
            safeMoveLayer(map, layerId);
            if (!ecoPerf) safeMoveLayer(map, transLayerId);
        }
    } catch (e) {
        console.warn(`Could not initialize 3D building models for station ${targetStation}:`, e);
    }
}

export function setup3DBuildingModelsLayer(map, isStandardMode) {
    // Lazy-load ONLY the active station's GLBs on boot instead of preloading all stations upfront
    const currentStation = (state && state.currentStationId) || 'lares';
    setupStation3DModels(map, currentStation, isStandardMode);
}

function getFacilityOverlayGeometry(stationId, facilityId, coords, fallbackGeo = null, halfLng = 0.000048, halfLat = 0.000038) {
    if (fallbackGeo && fallbackGeo.type && fallbackGeo.coordinates) {
        return fallbackGeo;
    }
    if (stationId === 'lares' && LARES_DRAWINGS && Array.isArray(LARES_DRAWINGS.features)) {
        const feat = LARES_DRAWINGS.features.find(f => f && f.properties && f.properties.id === facilityId);
        if (feat && feat.geometry && feat.geometry.coordinates) return feat.geometry;
    } else if (stationId === 'qares' && window.qaresBuildingsBaseline && Array.isArray(window.qaresBuildingsBaseline.features)) {
        const feat = window.qaresBuildingsBaseline.features.find(f => f && f.properties && (f.properties.id === facilityId || f.properties.building_code === facilityId));
        if (feat && feat.geometry && feat.geometry.coordinates) return feat.geometry;
    } else if (stationId === 'rares' && window.raresBuildingsBaseline && Array.isArray(window.raresBuildingsBaseline.features)) {
        const feat = window.raresBuildingsBaseline.features.find(f => f && f.properties && (f.properties.id === facilityId || f.properties.building_code === facilityId));
        if (feat && feat.geometry && feat.geometry.coordinates) return feat.geometry;
    }
    if (!Array.isArray(coords) || coords.length < 2 || !Number.isFinite(Number(coords[0])) || !Number.isFinite(Number(coords[1]))) {
        return null;
    }
    const coordsRing = buildFallbackRectRing(coords, halfLng, halfLat);
    return coordsRing ? { type: 'Polygon', coordinates: coordsRing } : null;
}

export function ensureStatusOverlayLayers(isStandardMode = (state.currentMapStyleMode === 'mapbox')) {
    if (!map) return;
    try {
        const styleObj = (typeof map.getStyle === 'function' ? map.getStyle() : null) || {};
        const hasStdImports = Boolean(isStandardMode && Array.isArray(styleObj.imports) && styleObj.imports.length > 0);
        if (!map.getSource('under-construction-3d-source')) {
            map.addSource('under-construction-3d-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }
        if (!map.getSource('proposed-landuse-source')) {
            map.addSource('proposed-landuse-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }
        if (!map.getLayer('building-under-construction-3d')) {
            const ucLayer = {
                id: 'building-under-construction-3d',
                type: 'fill-extrusion',
                source: 'under-construction-3d-source',
                minzoom: 14.5,
                layout: {
                    visibility: state.buildingsVisible !== false ? 'visible' : 'none'
                },
                paint: {
                    'fill-extrusion-color': '#f59e0b',
                    'fill-extrusion-height': ['coalesce', ['get', 'height'], 5.5],
                    'fill-extrusion-base': 0,
                    'fill-extrusion-opacity': 0.72
                }
            };
            if (hasStdImports) ucLayer.slot = 'middle';
            map.addLayer(ucLayer);
        }
        if (!map.getLayer('proposed-landuse-fill')) {
            const propFillLayer = {
                id: 'proposed-landuse-fill',
                type: 'fill',
                source: 'proposed-landuse-source',
                minzoom: 14.0,
                paint: {
                    'fill-color': '#14b8a6',
                    'fill-opacity': 0.22
                }
            };
            if (hasStdImports) propFillLayer.slot = 'middle';
            map.addLayer(propFillLayer);
        }
        if (!map.getLayer('proposed-landuse-line')) {
            const propLineLayer = {
                id: 'proposed-landuse-line',
                type: 'line',
                source: 'proposed-landuse-source',
                minzoom: 14.0,
                paint: {
                    'line-color': '#2dd4bf',
                    'line-width': 2.5,
                    'line-dasharray': [2, 2]
                }
            };
            if (hasStdImports) propLineLayer.slot = 'middle';
            map.addLayer(propLineLayer);
        }
        if (!map._p6StatusLayerHandlersBound) {
            map._p6StatusLayerHandlersBound = true;
            map.on('click', 'building-under-construction-3d', (e) => {
                const f = e.features && e.features[0];
                const fid = f && f.properties && f.properties.id;
                if (fid && typeof window.navigateTo === 'function') {
                    window.navigateTo(fid);
                }
            });
            map.on('click', 'proposed-landuse-fill', (e) => {
                const f = e.features && e.features[0];
                if (!f || !f.properties) return;
                if (f.properties.facility_type === 'plot' && typeof window.selectPlotZone === 'function') {
                    window.selectPlotZone(f.properties.id);
                } else if (f.properties.id && typeof window.navigateTo === 'function') {
                    window.navigateTo(f.properties.id);
                }
            });
            ['building-under-construction-3d', 'proposed-landuse-fill'].forEach(lid => {
                map.on('mouseenter', lid, () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mouseleave', lid, () => { map.getCanvas().style.cursor = ''; });
            });
        }
    } catch (e) {
        console.warn('[Phase6] Status overlay layer setup notice:', e);
    }
}

export function applyFacilityStatusFilters() {
    if (!map) return;
    ensureStatusOverlayLayers(state.currentMapStyleMode === 'mapbox');

    const stationId = state.currentStationId || 'lares';
    const dirList = (typeof window !== 'undefined' && Array.isArray(window.BUILDING_DIRECTORY) && window.BUILDING_DIRECTORY.length > 0)
        ? window.BUILDING_DIRECTORY
        : BUILDING_DIRECTORY;
    const dirStatusMap = new Map(
        (dirList || []).map(item => [item.id, normalizeFacilityStatus(item.facility_status || 'Existing')])
    );

    try {
        if (LARES_DRAWINGS && Array.isArray(LARES_DRAWINGS.features)) {
            LARES_DRAWINGS.features.forEach(f => {
                if (!f || !f.properties) return;
                const st = dirStatusMap.has(f.properties.id)
                    ? dirStatusMap.get(f.properties.id)
                    : normalizeFacilityStatus(f.properties.facility_status || 'Existing');
                f.properties.facility_status = st;
            });
            if (map.getSource('lares-drawings-source')) {
                map.getSource('lares-drawings-source').setData(LARES_DRAWINGS);
            }
        }

        const ecoPerf = isEcoPerfMode();
        if (CUSTOM_3D_BUILDINGS && typeof CUSTOM_3D_BUILDINGS === 'object') {
            const isStd = (state.currentMapStyleMode === 'mapbox');
            const activeStationCode = stationId || 'lares';
            [activeStationCode].forEach(stCode => {
                const stationIds = Object.keys(CUSTOM_3D_BUILDINGS).filter(id => (CUSTOM_3D_BUILDINGS[id].stationId || 'lares') === stCode);
                if (stationIds.length === 0) return;

                // Ensure newly DB-assigned GLB models are registered & mounted dynamically for the active station only
                stationIds.forEach(id => {
                    const b = CUSTOM_3D_BUILDINGS[id];
                    if (b && b.modelId && b.modelUrl && typeof map.hasModel === 'function' && !map.hasModel(b.modelId)) {
                        try { map.addModel(b.modelId, b.modelUrl); } catch (e) {}
                    }
                });

                const srcId = `${stCode}-3d-models-source`;
                if (!map.getSource(srcId) || !map.getLayer(`${stCode}-3d-models-layer`)) {
                    setupStation3DModels(map, stCode, isStd);
                    return;
                }

                const features = stationIds.map(id => {
                    const b = CUSTOM_3D_BUILDINGS[id];
                    const fStatus = dirStatusMap.get(id) || normalizeFacilityStatus(b.facility_status || 'Existing');
                    b.facility_status = fStatus;
                    return {
                        type: 'Feature',
                        id: id,
                        properties: {
                            id: id,
                            model: b.modelId,
                            rotation: b.rotation || 0,
                            scale: b.scale || [1, 1, 1],
                            station: stCode,
                            facility_status: fStatus
                        },
                        geometry: { type: 'Point', coordinates: b.coords }
                    };
                });
                if (map.getSource(srcId)) {
                    map.getSource(srcId).setData({ type: 'FeatureCollection', features });
                }
            });
        }

        const showExisting = activeStatusFilters.has('Existing');
        const noMatchFilter = ['==', ['get', 'id'], '__none__'];

        const extrudeFilter = showExisting
            ? ['all', ['!=', ['get', 'has_3d_model'], true], ['==', ['coalesce', ['get', 'facility_status'], 'Existing'], 'Existing']]
            : noMatchFilter;
        ['3d-drawings', '3d-drawings-roofs'].forEach(lid => {
            if (map.getLayer(lid)) map.setFilter(lid, extrudeFilter);
        });

        const modelFilter = showExisting
            ? ['==', ['coalesce', ['get', 'facility_status'], 'Existing'], 'Existing']
            : noMatchFilter;
        ['lares-3d-models-layer', '3d-buildings-models-layer', 'qares-3d-models-layer', 'rares-3d-models-layer'].forEach(lid => {
            if (map.getLayer(lid)) {
                map.setFilter(lid, modelFilter);
                map.setLayoutProperty(lid, 'visibility', (state.buildingsVisible === false || !lid.startsWith(`${stationId}-`)) ? 'none' : 'visible');
            }
        });
        if (ecoPerf) {
            ['lares-3d-models-transparent', 'rares-3d-models-transparent', 'qares-3d-models-transparent', '3d-buildings-models-transparent'].forEach(lid => {
                if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', 'none');
            });
        }

        const qaresExtrudeFilter = showExisting
            ? ['all', ['==', ['coalesce', ['get', 'filter_type'], ['get', 'category'], 'Buildings'], 'Buildings'], ['==', ['coalesce', ['get', 'facility_status'], 'Existing'], 'Existing']]
            : noMatchFilter;
        ['qares-footprints-3d', 'qares-footprints-roofs'].forEach(lid => {
            if (map.getLayer(lid)) map.setFilter(lid, qaresExtrudeFilter);
        });
        if (map.getLayer('rares-footprints-3d')) {
            map.setFilter('rares-footprints-3d', extrudeFilter);
        }

        const includeUC = activeStatusFilters.has('Under Construction') && (state.buildingsVisible !== false);
        const includePropBldg = activeStatusFilters.has('Proposed') && (state.buildingsVisible !== false);
        const includePropPlot = activeStatusFilters.has('Proposed');
        const ucFeatures = [];
        const propFeatures = [];

        if (stationId === 'lares') {
            (dirList || []).forEach(b => {
                if (!b || b.isSubPlot || b.isVisible === false || b.id.startsWith('plot17_') || b.id.startsWith('plot18_') || b.id.startsWith('plot22_')) return;
                const st = normalizeFacilityStatus(b.facility_status || 'Existing');
                if (st === 'Under Construction' && includeUC) {
                    const geo = getFacilityOverlayGeometry('lares', b.id, b.coords, b._footprintGeojson, 0.000048, 0.000038);
                    if (geo) {
                        ucFeatures.push({
                            type: 'Feature',
                            id: b.id,
                            properties: { id: b.id, name: b.name, facility_status: st, facility_type: 'building', height: Number(b.height) || 5.5 },
                            geometry: geo
                        });
                    }
                } else if (st === 'Proposed' && includePropBldg) {
                    const geo = getFacilityOverlayGeometry('lares', b.id, b.coords, b._footprintGeojson, 0.000052, 0.000042);
                    if (geo) {
                        propFeatures.push({
                            type: 'Feature',
                            id: b.id,
                            properties: { id: b.id, name: b.name, facility_status: st, facility_type: 'building' },
                            geometry: geo
                        });
                    }
                }
            });

            if (includePropPlot) {
                const plotZones = (typeof window !== 'undefined' && Array.isArray(window.FIELD_COMMODITY_ZONES)) ? window.FIELD_COMMODITY_ZONES : FIELD_COMMODITY_ZONES;
                (plotZones || []).forEach(z => {
                    if (!z || normalizeFacilityStatus(z.facility_status || 'Existing') !== 'Proposed') return;
                    const zPoly = (ZONE_POLYGONS || []).find(f => f && ((f.properties && (f.properties.id === z.id || f.properties.zoneId === z.id)) || f.id === z.id));
                    const geo = (zPoly && zPoly.geometry) ? zPoly.geometry : getFacilityOverlayGeometry('lares', z.id, z.centerCoords || z.coords, null, 0.000065, 0.000055);
                    if (geo) {
                        propFeatures.push({
                            type: 'Feature',
                            id: z.id,
                            properties: { id: z.id, name: z.name, facility_status: 'Proposed', facility_type: 'plot' },
                            geometry: geo
                        });
                    }
                });
            }
        } else {
            const baseline = (stationId === 'qares')
                ? (typeof window !== 'undefined' ? window.qaresBuildingsBaseline : null)
                : (typeof window !== 'undefined' ? window.raresBuildingsBaseline : null);
            if (baseline && Array.isArray(baseline.features)) {
                baseline.features.forEach((f, idx) => {
                    const p = f.properties || {};
                    if (stationId === 'qares') {
                        const cat = p.filter_type || p.category || 'Buildings';
                        if (cat !== 'Buildings') return;
                    }
                    const st = normalizeFacilityStatus(p.facility_status || 'Existing');
                    const fid = p.building_code || p.id || `${stationId}_${idx + 1}`;
                    if (st === 'Under Construction' && includeUC && f.geometry) {
                        ucFeatures.push({
                            type: 'Feature',
                            id: fid,
                            properties: { id: fid, name: p.name || fid, facility_status: st, facility_type: 'building', height: Number(p.height) || 5.5 },
                            geometry: f.geometry
                        });
                    } else if (st === 'Proposed' && includePropBldg && f.geometry) {
                        propFeatures.push({
                            type: 'Feature',
                            id: fid,
                            properties: { id: fid, name: p.name || fid, facility_status: st, facility_type: 'building' },
                            geometry: f.geometry
                        });
                    }
                });
            }
        }

        if (map.getSource('under-construction-3d-source')) {
            map.getSource('under-construction-3d-source').setData({ type: 'FeatureCollection', features: ucFeatures });
        }
        if (map.getSource('proposed-landuse-source')) {
            map.getSource('proposed-landuse-source').setData({ type: 'FeatureCollection', features: propFeatures });
        }
        if (map.getLayer('building-under-construction-3d')) {
            map.setLayoutProperty('building-under-construction-3d', 'visibility', state.buildingsVisible !== false ? 'visible' : 'none');
        }
    } catch (e) {
        console.warn('[Phase6] applyFacilityStatusFilters warning:', e);
    }

    try { updatePlotStatusFilters(); } catch (e) { }
    try {
        removeMarkers();
        createMarkers();
        if (typeof window.createPlotMarkers === 'function') window.createPlotMarkers();
    } catch (e) { }
}

export function syncLowPolyBuildingMode() {
    if (!map || (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded())) return;
    if (state.currentMapStyleMode === 'mapbox') {
        try {
            const styleObj = map.getStyle() || {};
            const hasStdImports = Array.isArray(styleObj.imports) && styleObj.imports.length > 0;
            const wantsStd = !isEcoPerfMode();
            if (wantsStd !== hasStdImports) {
                const curCenter = map.getCenter();
                const curZoom = map.getZoom();
                const curPitch = map.getPitch();
                const curBearing = map.getBearing();
                notifyStyleTransitionGrace(4500);
                map.once('style.load', () => {
                    map.jumpTo({ center: curCenter, zoom: curZoom, pitch: curPitch, bearing: curBearing });
                    if (state.currentStationId === 'qares' && typeof window.loadQARESData === 'function') {
                        window.loadQARESData();
                    } else if (state.currentStationId === 'rares' && typeof window.loadRARESData === 'function') {
                        window.loadRARESData();
                    }
                    setMapStyleMode('mapbox');
                });
                map.setStyle(wantsStd ? 'mapbox://styles/mapbox/standard' : 'mapbox://styles/mapbox/dark-v11', { diff: false });
                return;
            }
        } catch (e) {}
    }
    applyFacilityStatusFilters();
    try {
        if (map.getLayer('3d-trees-layer')) {
            map.setLayoutProperty('3d-trees-layer', 'visibility', (!isEcoPerfMode() && state.treesVisible !== false && state.currentMapStyleMode === 'mapbox') ? 'visible' : 'none');
        }
        if (isEcoPerfMode() || state.currentMapStyleMode !== 'mapbox') {
            map.setFog(null);
        }
    } catch (e) {}
}
if (typeof window !== 'undefined') {
    window.syncLowPolyBuildingMode = syncLowPolyBuildingMode;
}

map.on('style.load', setupLayers);

// ==========================================
// RESILIENT LOADING & STARTUP INTRO SEQUENCE
// ==========================================
let mapReady = false;
let isIntroAnimating = false;
let currentIntroSequenceId = 0;
let introStepTimeoutId = null;

export function isCoordInStationBounds(coord, stationId) {
    if (!coord || !STATIONS[stationId] || !STATIONS[stationId].bounds) return false;
    const [[w, s], [e, n]] = STATIONS[stationId].bounds;
    const lng = (typeof coord.lng === 'number') ? coord.lng : coord[0];
    const lat = (typeof coord.lat === 'number') ? coord.lat : coord[1];
    return lng >= (w - 0.02) && lng <= (e + 0.02) && lat >= (s - 0.02) && lat <= (n + 0.02);
}

export function stopIntroAnimation() {
    currentIntroSequenceId++;
    if (introStepTimeoutId) {
        clearTimeout(introStepTimeoutId);
        introStepTimeoutId = null;
    }
    isIntroAnimating = false;
    state.isIntroAnimating = false;
    try { map.stop(); } catch (e) { }
}

export function playIntroAnimation(onComplete, force = false) {
    const urlParams = new URLSearchParams(window.location.search);
    const isMobileMode = (typeof window !== 'undefined' && (
        window.innerWidth <= 768 ||
        urlParams.get('mode') === 'phone' ||
        /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent)
    ));

    const stationId = state.currentStationId || 'lares';
    const introViews = getStationIntroViews(stationId);

    if (!force && (urlParams.has('dest') || isMobileMode)) {
        stopIntroAnimation();
        map.jumpTo(getActiveStationDefaultView(stationId));
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    // Cancel any in-flight camera movements and invalidate previous sequences
    stopIntroAnimation();
    const mySeqId = ++currentIntroSequenceId;

    // Release bounds completely during intro fly-in so there is NEVER clamping
    try { map.setMaxBounds(null); } catch (e) { }

    // 1. Position camera at station's start view (top-down 2D view zoomed out: pitch 0, bearing 0)
    map.jumpTo({
        center: introViews.start.center,
        zoom: introViews.start.zoom,
        pitch: introViews.start.pitch,
        bearing: introViews.start.bearing
    });

    isIntroAnimating = true;
    state.isIntroAnimating = true;

    // 2. Slowly zooms in until it gets to the 2D top-down view directly above You Are Here pin
    map.flyTo({
        center: introViews.target2D.center,
        zoom: introViews.target2D.zoom,
        pitch: introViews.target2D.pitch,
        bearing: introViews.target2D.bearing,
        duration: 3200,
        speed: 0.7,
        curve: 1.0,
        essential: true
    });

    map.once('moveend', () => {
        if (mySeqId !== currentIntroSequenceId || !isIntroAnimating || state.currentStationId !== stationId) return;

        introStepTimeoutId = setTimeout(() => {
            introStepTimeoutId = null;
            if (mySeqId !== currentIntroSequenceId || !isIntroAnimating || state.currentStationId !== stationId) return;

            // 3. Then transitions to the station's signature 3D perspective angle
            map.flyTo({
                center: introViews.final3D.center,
                zoom: introViews.final3D.zoom,
                pitch: introViews.final3D.pitch,
                bearing: introViews.final3D.bearing,
                duration: 2000,
                essential: true
            });

            map.once('moveend', () => {
                if (mySeqId !== currentIntroSequenceId || state.currentStationId !== stationId) return;
                isIntroAnimating = false;
                state.isIntroAnimating = false;

                // Failsafe: Only clamp bounds if camera actually arrived within station bounds
                const activeStation = STATIONS[stationId];
                if (activeStation && activeStation.bounds && isCoordInStationBounds(map.getCenter(), stationId)) {
                    try { map.setMaxBounds(activeStation.bounds); } catch (e) { }
                } else {
                    try { map.setMaxBounds(null); } catch (e) { }
                }
                if (typeof onComplete === 'function') onComplete();
            });
        }, 350);
    });
}

export function revealMap() {
    if (mapReady || state.mapReady) return;
    mapReady = true;
    state.mapReady = true;
    window.mapReady = true;

    const minSplashMs = 4400;
    const elapsed = window.__iguideSplashStart ? (Date.now() - window.__iguideSplashStart) : minSplashMs;
    const waitMs = Math.max(0, minSplashMs - elapsed);

    setTimeout(() => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => {
                overlay.style.display = 'none';
                const splashLogo = document.getElementById('map-splash-logo');
                if (splashLogo) splashLogo.removeAttribute('src');
            }, 800);
        }
    }, waitMs);

    setTimeout(() => document.getElementById('sidebar').classList.add('visible'), waitMs + 500);
    setTimeout(() => document.getElementById('coords-badge').classList.add('visible'), waitMs + 800);

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('dest')) {
        state.hasInitialIntroPlayed = true;
    }

    // Initialize Agricultural Plot Layers for DA-LARES
    if (!state.currentStationId || state.currentStationId === 'lares') {
        try {
            initPlotLayers();
        } catch (e) {
            console.warn('[Plots] Could not init plot layers:', e);
        }
    }
}

// Allow user interaction gestures to stop the intro animation smoothly
['dragstart', 'rotatestart', 'pitchstart', 'zoomstart'].forEach(evt => {
    map.on(evt, (e) => {
        if (e && e.originalEvent && isIntroAnimating) {
            stopIntroAnimation();
            const stationId = state.currentStationId || 'lares';
            const station = STATIONS[stationId];
            if (station && station.bounds && isCoordInStationBounds(map.getCenter(), stationId)) {
                try { map.setMaxBounds(station.bounds); } catch (err) { }
            } else {
                try { map.setMaxBounds(null); } catch (err) { }
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
        btn.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center;">${lucideIcon('rotate-3d', 16)}</span>`;

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

if (!window._mapControlsAdded) {
    window._mapControlsAdded = true;
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new OrbitControl(), 'top-right');
    map.addControl(new HeightLimitScaleControl(), 'bottom-right');
    map.addControl(new mapboxgl.FullscreenControl({ container: document.documentElement }), 'top-right');
}

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
            const styleObj = map.getStyle() || {};
            if (Array.isArray(styleObj.imports) && styleObj.imports.length > 0) {
                map.setConfigProperty('basemap', 'lightPreset', config.lightPreset);
            }
        } catch (e) { }
    }

    // 2. Set atmospheric sky/fog ONLY in full Mapbox Standard 3D mode (avoid bright sky haze bleeding into drone gaps on low-end GPUs)
    if (state.currentMapStyleMode === 'mapbox' && !isLowPolyMode()) {
        try {
            map.setFog(config.fog);
        } catch (e) { }
    } else {
        try { map.setFog(null); } catch (e) { }
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
    state.buildingsVisible = !state.buildingsVisible;
    try {
        localStorage.setItem('da_buildings_visible', state.buildingsVisible ? 'true' : 'false');
    } catch (e) { }
    if (btn) btn.classList.toggle('active', state.buildingsVisible);
    const chip = document.getElementById('chip-buildings');
    if (chip && chip !== btn) chip.classList.toggle('active', state.buildingsVisible);

    const vis = state.buildingsVisible ? 'visible' : 'none';
    const transVis = (state.buildingsVisible && state.activeRoute) ? 'visible' : 'none';
    const st = state.currentStationId || 'lares';
    try {
        if (map.getLayer('3d-drawings')) map.setLayoutProperty('3d-drawings', 'visibility', st === 'lares' ? vis : 'none');
        if (map.getLayer('3d-drawings-roofs')) map.setLayoutProperty('3d-drawings-roofs', 'visibility', st === 'lares' ? vis : 'none');
        if (map.getLayer('3d-drawings-transparent')) map.setLayoutProperty('3d-drawings-transparent', 'visibility', st === 'lares' ? transVis : 'none');
        if (map.getLayer('3d-drawings-roofs-transparent')) map.setLayoutProperty('3d-drawings-roofs-transparent', 'visibility', st === 'lares' ? transVis : 'none');
        ['lares', 'rares', 'qares'].forEach(sid => {
            const mid = `${sid}-3d-models-layer`;
            const tid = `${sid}-3d-models-transparent`;
            if (map.getLayer(mid)) map.setLayoutProperty(mid, 'visibility', sid === st ? vis : 'none');
            if (map.getLayer(tid)) map.setLayoutProperty(tid, 'visibility', sid === st ? transVis : 'none');
        });
        if (map.getLayer('3d-buildings-mapbox')) {
            map.setLayoutProperty('3d-buildings-mapbox', 'visibility', (state.buildingsVisible && state.currentMapStyleMode === 'mapbox') ? 'visible' : 'none');
        }
        if (map.getLayer('qares-footprints-3d')) map.setLayoutProperty('qares-footprints-3d', 'visibility', st === 'qares' ? vis : 'none');
        if (map.getLayer('qares-footprints-roofs')) map.setLayoutProperty('qares-footprints-roofs', 'visibility', st === 'qares' ? vis : 'none');
        if (map.getLayer('qares-footprints-fill')) map.setLayoutProperty('qares-footprints-fill', 'visibility', 'none');
        if (map.getLayer('qares-footprints-line')) map.setLayoutProperty('qares-footprints-line', 'visibility', 'none');
        if (map.getLayer('rares-footprints-3d')) map.setLayoutProperty('rares-footprints-3d', 'visibility', st === 'rares' ? vis : 'none');
    } catch (e) { }


    // Sync Map Settings panel checkbox
    const cbBldg = document.getElementById('msp-toggle-buildings');
    if (cbBldg) cbBldg.checked = state.buildingsVisible;

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

    notifyStyleTransitionGrace(4500);

    map.once('style.load', () => {
        map.jumpTo({
            center: currentCenter,
            zoom: currentZoom,
            pitch: currentPitch,
            bearing: currentBearing
        });
        if (state.currentStationId === 'qares' && typeof window.loadQARESData === 'function') {
            window.loadQARESData();
        } else if (state.currentStationId === 'rares' && typeof window.loadRARESData === 'function') {
            window.loadRARESData();
        }
        setMapStyleMode(mode);
    });

    if (mode === 'mapbox') {
        const vectorStyle = isLowPolyMode()
            ? 'mapbox://styles/mapbox/dark-v11'
            : 'mapbox://styles/mapbox/standard';
        map.setStyle(vectorStyle, { diff: false });
    } else {
        map.setStyle(getMinimalDroneStyle(), { diff: false });
    }

    map.once('style.load', () => {
        if (typeof window.resetOcclusion === 'function') {
            try { window.resetOcclusion(); } catch (e) { }
        }
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
        triggerIcon.innerHTML = lucideIcon(isMapbox ? 'map' : 'drone', 18);
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
        if (icon) icon.innerHTML = lucideIcon(isMapbox ? 'drone' : 'map', 16);
        if (label) label.textContent = isMapbox ? 'Aerial Drone' : 'Mapbox 3D';
    }

    const phoneToggle = document.getElementById('phone-mapbox-toggle');
    if (phoneToggle) {
        phoneToggle.classList.toggle('active', isMapbox);
        phoneToggle.innerHTML = `${lucideIcon(isMapbox ? 'drone' : 'map', 14)} ${isMapbox ? 'Aerial Drone' : 'Mapbox 3D'}`;
    }

    removeSectionBadges();
    if (!map || (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded())) {
        return;
    }
    try {
        if (map.getLayer('lares-drone-layer')) {
            map.setLayoutProperty('lares-drone-layer', 'visibility', (!isMapbox && (!state.currentStationId || state.currentStationId === 'lares')) ? 'visible' : 'none');
        }
        if (map.getLayer('qares-ortho-layer')) {
            map.setLayoutProperty('qares-ortho-layer', 'visibility', (!isMapbox && state.currentStationId === 'qares') ? 'visible' : 'none');
        }
        if (map.getLayer('rares-ortho-layer')) {
            map.setLayoutProperty('rares-ortho-layer', 'visibility', (!isMapbox && state.currentStationId === 'rares') ? 'visible' : 'none');
        }
        if (map.getLayer('google-satellite-overlay-layer')) {
            map.setLayoutProperty('google-satellite-overlay-layer', 'visibility', (!isMapbox && state.gmapsOverlayOpacity > 0) ? 'visible' : 'none');
        }
        const showLaresMask = !isMapbox && (!state.currentStationId || state.currentStationId === 'lares');
        const showQaresMask = !isMapbox && (state.currentStationId === 'qares');
        const showRaresMask = !isMapbox && (state.currentStationId === 'rares');
        if (map.getLayer('lares-mask-layer')) {
            map.setLayoutProperty('lares-mask-layer', 'visibility', showLaresMask ? 'visible' : 'none');
        }
        if (map.getLayer('qares-mask-layer')) {
            map.setLayoutProperty('qares-mask-layer', 'visibility', showQaresMask ? 'visible' : 'none');
        }
        if (map.getLayer('rares-mask-layer')) {
            map.setLayoutProperty('rares-mask-layer', 'visibility', showRaresMask ? 'visible' : 'none');
        }
        syncGoogleSatelliteVisibility();
        ['lares-3d-models-layer', 'rares-3d-models-layer', 'qares-3d-models-layer', '3d-buildings-models-layer'].forEach(lid => {
            safeMoveLayer(map, lid);
        });
        ['lares-3d-models-transparent', 'rares-3d-models-transparent', 'qares-3d-models-transparent', '3d-buildings-models-transparent'].forEach(lid => {
            safeMoveLayer(map, lid);
        });
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
        const bndVis = state.boundaryVisible !== false ? 'visible' : 'none';
        const qaresShadowVis = (!isMapbox && bndVis === 'visible' && state.currentStationId === 'qares') ? 'visible' : 'none';
        if (map.getLayer('qares-boundary-glow')) {
            map.setLayoutProperty('qares-boundary-glow', 'visibility', qaresShadowVis);
        }
        if (map.getLayer('qares-boundary-casing')) {
            map.setLayoutProperty('qares-boundary-casing', 'visibility', qaresShadowVis);
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
    window.applyFacilityStatusFilters = applyFacilityStatusFilters;
    window.ensureStatusOverlayLayers = ensureStatusOverlayLayers;
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

