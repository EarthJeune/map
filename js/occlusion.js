// DA-LARES Wayfinding — Smart 3D Building Occlusion & Dynamic X-Ray Transparency Module
// Makes extruded 3D buildings between the camera and walker/route dynamically translucent (frosted glass)

import { map, getRoofColorCaseStyle } from './map-setup.js';
import { state } from './data/state.js';
import { LARES_DRAWINGS } from './data/buildings.js';
import { activeStatusFilters } from './status-filter.js';
import { isLowPolyMode } from './performance.js';

let cachedBuildings = null;
let lastOccludedIds = [];
let lastCheckTime = 0;
let lastCheckCoord = null;

const BASE_NO_3D_MODEL_FILTER = ['!=', ['get', 'has_3d_model'], true];
const getModelStatusFilter = () => activeStatusFilters.has('Existing')
    ? ['==', ['coalesce', ['get', 'facility_status'], 'Existing'], 'Existing']
    : ['==', ['get', 'id'], '__none__'];
const getBaseFilter = () => ['all', BASE_NO_3D_MODEL_FILTER, getModelStatusFilter()];

// Fast zero-allocation Euclidean distance in meters calibrated for Batangas (~13.96° N)
export function fastMetersDistance(c1, c2) {
    if (!c1 || !c2) return 999;
    const dx = (c2[0] - c1[0]) * 108040;
    const dy = (c2[1] - c1[1]) * 110540;
    return Math.sqrt(dx * dx + dy * dy);
}

// Initialize spatial cache of buildings for fast bounding box & collision tests
export function initBuildingSpatialIndex() {
    if (!LARES_DRAWINGS || !LARES_DRAWINGS.features) return;
    
    cachedBuildings = LARES_DRAWINGS.features.map(f => {
        const id = f.properties.id;
        const poly = f.geometry;
        const bbox = (typeof turf !== 'undefined') ? turf.bbox(f) : null;
        let center = null;
        if (typeof turf !== 'undefined') {
            try {
                center = turf.centroid(f).geometry.coordinates;
            } catch (e) {
                const c = poly.coordinates[0];
                center = c[0];
            }
        }
        return {
            id,
            geometry: poly,
            bbox,
            center,
            height: f.properties.height || 5
        };
    });
}

// Ensure companion translucent layers exist in Mapbox style
export function ensureOcclusionLayers() {
    if (!map || !map.getStyle()) return false;
    if (isLowPolyMode()) return false;

    // 1. Procedural walls & roofs transparent layers
    const origLayerDef = map.getStyle().layers ? map.getStyle().layers.find(l => l.id === '3d-drawings') : null;
    const origRoofDef = map.getStyle().layers ? map.getStyle().layers.find(l => l.id === '3d-drawings-roofs') : null;

    if (origLayerDef && !map.getLayer('3d-drawings-transparent')) {
        const layerConfig = {
            id: '3d-drawings-transparent',
            type: 'fill-extrusion',
            source: origLayerDef.source,
            minzoom: origLayerDef.minzoom || 13,
            layout: {
                visibility: 'none'
            },
            paint: {
                'fill-extrusion-color': (state.currentMapStyleMode === 'mapbox') ? '#e2e8f0' : '#cbd5e1',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.22,
                'fill-extrusion-emissive-strength': 0.35,
                'fill-extrusion-cast-shadows': false
            },
            filter: ['all', getBaseFilter(), ['in', ['get', 'id'], ['literal', []]]]
        };
        map.addLayer(layerConfig);
    }

    if (origRoofDef && !map.getLayer('3d-drawings-roofs-transparent')) {
        const roofLayerConfig = {
            id: '3d-drawings-roofs-transparent',
            type: 'fill-extrusion',
            source: origRoofDef.source,
            minzoom: origRoofDef.minzoom || 13,
            layout: {
                visibility: 'none'
            },
            paint: {
                'fill-extrusion-color': (state.currentMapStyleMode === 'mapbox') ? '#cbd5e1' : getRoofColorCaseStyle(),
                'fill-extrusion-height': ['+', ['get', 'height'], 0.25],
                'fill-extrusion-base': ['get', 'height'],
                'fill-extrusion-opacity': 0.25,
                'fill-extrusion-emissive-strength': 0.35,
                'fill-extrusion-cast-shadows': false
            },
            filter: ['all', getBaseFilter(), ['in', ['get', 'id'], ['literal', []]]]
        };
        map.addLayer(roofLayerConfig);
    }

    // 2. Custom 3D GLB models transparent companion layer
    const origModelDef = map.getStyle().layers ? map.getStyle().layers.find(l => l.id === '3d-buildings-models-layer') : null;
    if (origModelDef && !map.getLayer('3d-buildings-models-transparent')) {
        const transModelDef = {
            id: '3d-buildings-models-transparent',
            type: 'model',
            source: origModelDef.source,
            minzoom: origModelDef.minzoom || 14.5,
            layout: {
                'model-id': ['get', 'model'],
                'visibility': 'none'
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
        if (origModelDef.slot) {
            transModelDef.slot = origModelDef.slot;
        }
        map.addLayer(transModelDef);
    }

    return true;
}

// Fast distance from point [px, py] to line segment [segA, segB] in meters (calibrated for Batangas ~13.96° N)

export function fastDistToSegmentMeters(pt, segA, segB) {

    if (!pt || !segA || !segB) return 999;

    const px = pt[0] * 108040;

    const py = pt[1] * 110540;

    const x1 = segA[0] * 108040;

    const y1 = segA[1] * 110540;

    const x2 = segB[0] * 108040;

    const y2 = segB[1] * 110540;



    const dx = x2 - x1;

    const dy = y2 - y1;

    const lenSq = dx * dx + dy * dy;

    if (lenSq === 0) {

        const sx = px - x1, sy = py - y1;

        return Math.sqrt(sx * sx + sy * sy);

    }

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));

    const projX = x1 + t * dx;

    const projY = y1 + t * dy;

    const ex = px - projX;

    const ey = py - projY;

    return Math.sqrt(ex * ex + ey * ey);

}



// Calculate which buildings should become translucent:

// 1. When avatar is walking or running past the building (proximity detection)

// 2. When building is blocking the camera's sightline to the avatar (perspective ray/corridor occlusion)

export function computeOccludedBuildingIds(targetCoord, destinationId) {

    if (!targetCoord) return [];



    if (!cachedBuildings) initBuildingSpatialIndex();

    if (!cachedBuildings || cachedBuildings.length === 0) return [];



    const pitch = (map && map.getPitch) ? map.getPitch() : 0;

    const bearing = (map && map.getBearing) ? map.getBearing() : 0;

    const zoom = (map && map.getZoom) ? map.getZoom() : 19.5;



    // Fast trigonometric camera position calculation

    let camCoord = null;

    let corridorRadius = 12.0;

    if (pitch >= 15) {

        const rad = Math.PI / 180;

        const backAngleRad = (((bearing + 180) % 360 + 360) % 360) * rad;

        const backDistanceMeters = Math.max(18, Math.min(48, 28 * Math.tan(pitch * rad) * Math.pow(2, 20 - zoom)));

        const dLng = (backDistanceMeters * Math.sin(backAngleRad)) / 108040;

        const dLat = (backDistanceMeters * Math.cos(backAngleRad)) / 110540;

        camCoord = [targetCoord[0] + dLng, targetCoord[1] + dLat];

        corridorRadius = Math.max(8.5, Math.min(13.5, 7.0 + (pitch - 15) * 0.1));

    }



    const occludedIds = [];



    for (let i = 0; i < cachedBuildings.length; i++) {

        const b = cachedBuildings[i];

        

        // RULE 1: Destination building NEVER becomes transparent so the user clearly sees their goal

        if (b.id === destinationId) continue;

        if (!b.center) continue;



        const distToWalker = fastMetersDistance(targetCoord, b.center);

        if (distToWalker > 60) continue; // Far away, skip immediately



        let isOccluded = false;



        // 1. Walker Proximity Check: Avatar is walking directly past the building

        if (distToWalker <= 20) {

            isOccluded = true;

        } else if (camCoord) {

            // 2. Camera Sightline Occlusion: Building blocks camera view to the walker in 3D perspective

            const distToSightline = fastDistToSegmentMeters(b.center, camCoord, targetCoord);

            if (distToSightline <= corridorRadius) {

                isOccluded = true;

            }

        }



        if (isOccluded) {

            occludedIds.push(b.id);

        }

    }



    return occludedIds;

}



// Apply Mapbox filters for solid vs translucent layers:

// - Procedural: 3d-drawings (solid) vs 3d-drawings-transparent (frosted glass)

// - Custom 3D GLB: 3d-buildings-models-layer (solid 1.0) vs 3d-buildings-models-transparent (frosted glass 0.25)

export function applyOcclusionFilters(occludedIds) {

    if (!map || !map.getStyle()) return;



    if (!map.getLayer('3d-drawings-transparent') || (map.getLayer('3d-buildings-models-layer') && !map.getLayer('3d-buildings-models-transparent'))) {

        ensureOcclusionLayers();

    }



    const areEqual = (occludedIds.length === lastOccludedIds.length) &&

        occludedIds.every(id => lastOccludedIds.includes(id));



    if (areEqual) return;



    lastOccludedIds = [...occludedIds];



    try {
        const visWhenActive = (state.buildingsVisible !== false) ? 'visible' : 'none';
        const modelLayerIds = ['lares-3d-models-layer', 'rares-3d-models-layer', 'qares-3d-models-layer', '3d-buildings-models-layer'];
        const transModelLayerIds = ['lares-3d-models-transparent', 'rares-3d-models-transparent', 'qares-3d-models-transparent', '3d-buildings-models-transparent'];

        const modelStatusFilter = getModelStatusFilter();

        if (occludedIds.length === 0) {
            // A. All solid custom 3D models (show all existing models on solid layer, hide transparent layer completely)
            modelLayerIds.forEach(id => {
                if (map.getLayer(id)) map.setFilter(id, modelStatusFilter);
            });
            transModelLayerIds.forEach(id => {
                if (map.getLayer(id)) {
                    map.setLayoutProperty(id, 'visibility', 'none');
                    map.setFilter(id, ['in', ['get', 'id'], ['literal', []]]);
                }
            });

            // B. Procedural buildings
            const baseFilter = getBaseFilter();
            if (map.getLayer('3d-drawings')) map.setFilter('3d-drawings', baseFilter);
            if (map.getLayer('3d-drawings-roofs')) map.setFilter('3d-drawings-roofs', baseFilter);
            if (map.getLayer('3d-drawings-transparent')) {
                map.setLayoutProperty('3d-drawings-transparent', 'visibility', 'none');
                map.setFilter('3d-drawings-transparent', ['all', baseFilter, ['in', ['get', 'id'], ['literal', []]]]);
            }
            if (map.getLayer('3d-drawings-roofs-transparent')) {
                map.setLayoutProperty('3d-drawings-roofs-transparent', 'visibility', 'none');
                map.setFilter('3d-drawings-roofs-transparent', ['all', baseFilter, ['in', ['get', 'id'], ['literal', []]]]);
            }
        } else {
            // A. Custom 3D models: Solid layer excludes occludedIds, translucent layer displays occludedIds
            modelLayerIds.forEach(id => {
                if (map.getLayer(id)) map.setFilter(id, ['all', modelStatusFilter, ['!', ['in', ['get', 'id'], ['literal', occludedIds]]]]);
            });
            transModelLayerIds.forEach(id => {
                if (map.getLayer(id)) {
                    map.setFilter(id, ['all', modelStatusFilter, ['in', ['get', 'id'], ['literal', occludedIds]]]);
                    // Only display transparent layer if the parent station layer is currently visible
                    const parentSolidId = id.replace('-transparent', '-layer');
                    const isParentVisible = map.getLayer(parentSolidId) && map.getLayoutProperty(parentSolidId, 'visibility') === 'visible';
                    if (isParentVisible) {
                        map.setLayoutProperty(id, 'visibility', visWhenActive);
                    }
                }
            });

            // B. Procedural buildings (only filter if procedural buildings are involved)
            const baseFilter = getBaseFilter();
            const solidFilter = ['all', baseFilter, ['!', ['in', ['get', 'id'], ['literal', occludedIds]]]];
            const transFilter = ['all', baseFilter, ['in', ['get', 'id'], ['literal', occludedIds]]];

            if (map.getLayer('3d-drawings')) map.setFilter('3d-drawings', solidFilter);
            if (map.getLayer('3d-drawings-roofs')) map.setFilter('3d-drawings-roofs', solidFilter);
            if (map.getLayer('3d-drawings-transparent')) {
                map.setFilter('3d-drawings-transparent', transFilter);
                map.setLayoutProperty('3d-drawings-transparent', 'visibility', visWhenActive);
            }
            if (map.getLayer('3d-drawings-roofs-transparent')) {
                map.setFilter('3d-drawings-roofs-transparent', transFilter);
                map.setLayoutProperty('3d-drawings-roofs-transparent', 'visibility', visWhenActive);
            }
        }
    } catch (e) {
        console.warn('[Occlusion] Error updating layer filters:', e);
    }

}



// High-performance throttled occlusion updater for 60fps loops

export function updateOcclusion(targetCoord, destinationId) {
    if (isLowPolyMode()) return;

    const now = Date.now();

    // Run at most every 180ms (~5.5 checks/sec) with 1.5m movement threshold to guarantee 60fps

    if (now - lastCheckTime < 180 && lastCheckCoord) {

        if (targetCoord) {

            const distMoved = fastMetersDistance(lastCheckCoord, targetCoord);

            if (distMoved < 1.5) return;

        } else {

            return;

        }

    }



    lastCheckTime = now;

    lastCheckCoord = targetCoord;



    const occludedIds = computeOccludedBuildingIds(targetCoord, destinationId);

    applyOcclusionFilters(occludedIds);

}

// Reset all buildings back to 100% solid
export function resetOcclusion() {
    lastOccludedIds = [];
    lastCheckCoord = null;
    lastCheckTime = 0;

    if (!map || (typeof map.isStyleLoaded === 'function' && !map.isStyleLoaded())) return;
    try {
        if (!map.getStyle()) return;
    } catch (e) {
        return;
    }

    try {
        const baseFilter = getBaseFilter();
        if (map.getLayer('3d-drawings')) map.setFilter('3d-drawings', baseFilter);
        if (map.getLayer('3d-drawings-roofs')) map.setFilter('3d-drawings-roofs', baseFilter);
        if (map.getLayer('3d-drawings-transparent')) {
            map.setLayoutProperty('3d-drawings-transparent', 'visibility', 'none');
            map.setFilter('3d-drawings-transparent', ['all', baseFilter, ['in', ['get', 'id'], ['literal', []]]]);
        }
        if (map.getLayer('3d-drawings-roofs-transparent')) {
            map.setLayoutProperty('3d-drawings-roofs-transparent', 'visibility', 'none');
            map.setFilter('3d-drawings-roofs-transparent', ['all', baseFilter, ['in', ['get', 'id'], ['literal', []]]]);
        }
        const modelStatusFilter = getModelStatusFilter();
        ['lares-3d-models-layer', 'rares-3d-models-layer', 'qares-3d-models-layer', '3d-buildings-models-layer'].forEach(id => {
            if (map.getLayer(id)) map.setFilter(id, modelStatusFilter);
        });
        ['lares-3d-models-transparent', 'rares-3d-models-transparent', 'qares-3d-models-transparent', '3d-buildings-models-transparent'].forEach(id => {
            if (map.getLayer(id)) {
                map.setLayoutProperty(id, 'visibility', 'none');
                map.setFilter(id, ['in', ['get', 'id'], ['literal', []]]);
            }
        });
    } catch (e) {
        console.warn('[Occlusion] Error resetting occlusion:', e);
    }
}

// Attach to window for debug & console inspection
if (typeof window !== 'undefined') {
    window.fastMetersDistance = fastMetersDistance;
    window.updateOcclusion = updateOcclusion;
    window.resetOcclusion = resetOcclusion;
    window.ensureOcclusionLayers = ensureOcclusionLayers;
    window.computeOccludedBuildingIds = computeOccludedBuildingIds;
    window.testOcclusion = (buildingId) => {
        const ids = Array.isArray(buildingId) ? buildingId : (buildingId ? [buildingId] : []);
        applyOcclusionFilters(ids);
        console.log('[Occlusion Test] Applied transparency to:', ids);
    };

    // Keep occlusion dynamically updated if user rotates/pitches the camera during active navigation
    window.initOcclusionListeners = function initOcclusionListeners() {
        const currentMap = (typeof state !== 'undefined' && state.map) || (typeof window !== 'undefined' && window.map);
        if (currentMap && currentMap.on && !currentMap._occlusionListenersAttached) {
            currentMap._occlusionListenersAttached = true;
            const handleCameraMotion = () => {
                if (state.activeRoute && state.currentWalkerCoord) {
                    updateOcclusion(state.currentWalkerCoord, state.selectedBuildingId);
                }
            };
            currentMap.on('rotate', handleCameraMotion);
            currentMap.on('pitch', handleCameraMotion);
        }
    };
    if (typeof setTimeout !== 'undefined') {
        setTimeout(() => {
            try { window.initOcclusionListeners(); } catch (e) {}
        }, 300);
    }
}

export function initOcclusionListeners() {
    if (typeof window !== 'undefined' && typeof window.initOcclusionListeners === 'function') {
        window.initOcclusionListeners();
    }
}


