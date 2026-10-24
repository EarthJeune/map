// DA-LARES Wayfinding — Smart 3D Building Occlusion & Dynamic X-Ray Transparency Module
// Makes extruded 3D buildings between the camera and walker/route dynamically translucent (frosted glass)

import { map, getRoofColorCaseStyle } from './map-setup.js';
import { state } from './data/state.js';
import { LARES_DRAWINGS } from './data/buildings.js?v=72';

let cachedBuildings = null;
let lastOccludedIds = [];
let lastCheckTime = 0;
let lastCheckCoord = null;

const BASE_NO_3D_MODEL_FILTER = ['!=', ['get', 'has_3d_model'], true];
const getBaseFilter = () => BASE_NO_3D_MODEL_FILTER;

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
                visibility: state.buildingsVisible ? 'visible' : 'none'
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
                visibility: state.buildingsVisible ? 'visible' : 'none'
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
        if (origModelDef.slot) {
            transModelDef.slot = origModelDef.slot;
        }
        map.addLayer(transModelDef);
    }

    return true;
}

// Calculate which buildings should become translucent:
// 1. When avatar is walking or running past the building (proximity detection)
// 2. When building is blocking the camera's sightline to the avatar (perspective ray/corridor occlusion)
export function computeOccludedBuildingIds(targetCoord, destinationId) {
    if (!targetCoord || typeof turf === 'undefined') return [];

    if (!cachedBuildings) initBuildingSpatialIndex();
    if (!cachedBuildings || cachedBuildings.length === 0) return [];

    const pitch = (map && map.getPitch) ? map.getPitch() : 0;
    const bearing = (map && map.getBearing) ? map.getBearing() : 0;
    const zoom = (map && map.getZoom) ? map.getZoom() : 19.5;
    
    const targetPt = turf.point(targetCoord);

    // Build camera sightline ray and corridor when camera is pitched (pitch >= 15°)
    let sightline = null;
    let corridor = null;
    if (pitch >= 15) {
        const backAngle = ((bearing + 180) % 360 + 360) % 360;
        const backDistanceMeters = Math.max(18, Math.min(48, 28 * Math.tan((pitch * Math.PI) / 180) * Math.pow(2, 20 - zoom)));
        try {
            const camPt = turf.destination(targetPt, backDistanceMeters, backAngle, { units: 'meters' });
            sightline = turf.lineString([camPt.geometry.coordinates, targetCoord]);
            const corridorRadius = Math.max(9.0, Math.min(14.0, 7.5 + (pitch - 15) * 0.12));
            corridor = turf.buffer(sightline, corridorRadius, { units: 'meters' });
        } catch (e) {
            sightline = null;
            corridor = null;
        }
    }

    const occludedIds = [];

    for (let i = 0; i < cachedBuildings.length; i++) {
        const b = cachedBuildings[i];
        
        // RULE 1: Destination building NEVER becomes transparent so the user clearly sees their goal
        if (b.id === destinationId) continue;

        let distToWalker = 999;
        if (b.center) {
            distToWalker = fastMetersDistance(targetCoord, b.center);
            if (distToWalker > 65) continue; // Far away, skip immediately
        }

        let isOccluded = false;

        // 1. Walker Proximity Check: Model is walking or running past the building
        // Campus roads run 4m–12m from building perimeters. Centroid distance <= 22m or polygon distance <= 15m.
        if (distToWalker <= 22) {
            isOccluded = true;
        } else if (distToWalker <= 36 && b.geometry) {
            try {
                if (turf.booleanPointInPolygon(targetPt, b.geometry)) {
                    isOccluded = true;
                } else {
                    const line = turf.polygonToLine(b.geometry);
                    const polyDist = turf.pointToLineDistance(targetPt, line, { units: 'meters' });
                    if (polyDist <= 15) {
                        isOccluded = true;
                    }
                }
            } catch (err) {
                if (distToWalker <= 24) isOccluded = true;
            }
        }

        // 2. Camera Sightline Occlusion: Building blocks camera view to the walker in 3D perspective
        if (!isOccluded && (sightline || corridor) && b.geometry) {
            try {
                const intersectsRay = sightline ? turf.booleanIntersects(sightline, b.geometry) : false;
                const intersectsCorridor = corridor ? turf.booleanIntersects(corridor, b.geometry) : false;
                if (intersectsRay || intersectsCorridor) {
                    isOccluded = true;
                }
            } catch (err) {
                // Ignore fallback
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
        if (occludedIds.length === 0) {
            // A. All solid procedural buildings
            const baseFilter = getBaseFilter();
            if (map.getLayer('3d-drawings')) map.setFilter('3d-drawings', baseFilter);
            if (map.getLayer('3d-drawings-roofs')) map.setFilter('3d-drawings-roofs', baseFilter);
            if (map.getLayer('3d-drawings-transparent')) {
                map.setFilter('3d-drawings-transparent', ['all', baseFilter, ['in', ['get', 'id'], ['literal', []]]]);
            }
            if (map.getLayer('3d-drawings-roofs-transparent')) {
                map.setFilter('3d-drawings-roofs-transparent', ['all', baseFilter, ['in', ['get', 'id'], ['literal', []]]]);
            }

            // B. All solid custom 3D models (show all on solid layer, hide on transparent layer)
            if (map.getLayer('3d-buildings-models-layer')) {
                map.setFilter('3d-buildings-models-layer', null);
            }
            if (map.getLayer('3d-buildings-models-transparent')) {
                map.setFilter('3d-buildings-models-transparent', ['in', ['get', 'id'], ['literal', []]]);
            }
        } else {
            // A. Procedural buildings
            const baseFilter = getBaseFilter();
            const solidFilter = ['all', baseFilter, ['!', ['in', ['get', 'id'], ['literal', occludedIds]]]];
            const transFilter = ['all', baseFilter, ['in', ['get', 'id'], ['literal', occludedIds]]];

            if (map.getLayer('3d-drawings')) map.setFilter('3d-drawings', solidFilter);
            if (map.getLayer('3d-drawings-roofs')) map.setFilter('3d-drawings-roofs', solidFilter);
            if (map.getLayer('3d-drawings-transparent')) map.setFilter('3d-drawings-transparent', transFilter);
            if (map.getLayer('3d-drawings-roofs-transparent')) map.setFilter('3d-drawings-roofs-transparent', transFilter);

            // B. Custom 3D models: Solid layer excludes occludedIds, translucent layer displays occludedIds
            if (map.getLayer('3d-buildings-models-layer')) {
                map.setFilter('3d-buildings-models-layer', ['!', ['in', ['get', 'id'], ['literal', occludedIds]]]);
            }
            if (map.getLayer('3d-buildings-models-transparent')) {
                map.setFilter('3d-buildings-models-transparent', ['in', ['get', 'id'], ['literal', occludedIds]]);
            }
        }
    } catch (e) {
        console.warn('[Occlusion] Error updating layer filters:', e);
    }
}

// High-performance throttled occlusion updater for 60fps loops
export function updateOcclusion(targetCoord, destinationId) {
    const now = Date.now();
    // Run at most every 90ms (~11 checks/sec) to preserve 60fps budget
    if (now - lastCheckTime < 90 && lastCheckCoord) {
        if (targetCoord) {
            const distMoved = fastMetersDistance(lastCheckCoord, targetCoord);
            if (distMoved < 1.0) return;
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
    
    if (!map || !map.getStyle()) return;

    try {
        const baseFilter = getBaseFilter();
        if (map.getLayer('3d-drawings')) map.setFilter('3d-drawings', baseFilter);
        if (map.getLayer('3d-drawings-roofs')) map.setFilter('3d-drawings-roofs', baseFilter);
        if (map.getLayer('3d-drawings-transparent')) {
            map.setFilter('3d-drawings-transparent', ['all', baseFilter, ['in', ['get', 'id'], ['literal', []]]]);
        }
        if (map.getLayer('3d-drawings-roofs-transparent')) {
            map.setFilter('3d-drawings-roofs-transparent', ['all', baseFilter, ['in', ['get', 'id'], ['literal', []]]]);
        }
        if (map.getLayer('3d-buildings-models-layer')) {
            map.setFilter('3d-buildings-models-layer', null);
        }
        if (map.getLayer('3d-buildings-models-transparent')) {
            map.setFilter('3d-buildings-models-transparent', ['in', ['get', 'id'], ['literal', []]]);
        }
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


