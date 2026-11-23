// DA-LARES Wayfinding — Main Application Orchestration Entry Point
// Native ES Module Application Shell

import { MAPBOX_ACCESS_TOKEN, DEFAULT_MAP_VIEW, SAVED_MAIN_KIOSK_COORDS } from './data/config.js';
import {
    BUILDING_DIRECTORY,
    DEFAULT_BUILDING_COLORS,
    LARES_DRAWINGS,
    KNOWN_BUILDING_NAMES,
    CUSTOM_BUILDING_CENTERS,
    CUSTOM_3D_BUILDINGS
} from './data/buildings.js';
import { STATIONS } from './data/stations.js';
import { BUILDING_OFFICES, OFFICE_SEARCH_ALIASES, OFFICE_ROOM_NUMBERS } from './data/offices.js';
import { BUILDING_WAYFINDING_INFO } from './data/descriptions.js';
import { FIELD_COMMODITY_ZONES, ZONE_POLYGONS } from './data/plots.js';
import { state } from './data/state.js';
import { createMarkers, removeMarkers } from './markers.js';
import { normalizeFacilityStatus, buildFallbackRectRing } from './status-filter.js';
import {
    map,
    revealMap,
    syncLightingWithTime,
    getRoofColorCaseStyle,
    toggleBuildings,
    toggleMapboxView,
    toggleMapLayerMenu,
    openMapLayerModal,
    closeMapLayerModal,
    closeMapLayerFlyout,
    selectMapStyle,
    toggleBoundary,
    toggleTerrain,
    toggleMarkers,
    toggleTrees,
    flyToView,
    stopIntroAnimation
} from './map-setup.js';

import {
    buildDirectory,
    filterDirectory,
    toggleSidebarMenu,
    collapseSidebarMenu,
    updateSidebarToggleIcon,
    toggleSettingChip
} from './sidebar.js';

import {
    navigateTo,
    setRouteSpeed,
    setRouteCameraMode,
    resetCameraModeToDefault,
    updateCameraControlsUI,
    exitRouteMode,
    initWalkerCameraListeners
} from './walker.js';

import {
    buildRoadGraph,
    clearRoute,
    closeRouteAndReset,
    getDirections,
    replayRoute
} from './routing.js';

import {
    showBuildingPanel,
    showPlotPanel,
    closeBuildingPanel,
    closeColorPicker,
    saveColorPicker,
    useEyeDropper
} from './building-panel.js';

import {
    applyAppModeToDOM,
    isPhoneMode,
    isKioskMode,
    isPortraitKiosk
} from './mode.js';

import {
    showPhoneWelcomeModal,
    handleWelcomeContinue,
    handleWelcomeSkip,
    renderPhoneDirectory,
    filterPhoneDirectory,
    clearPhoneSearch,
    showPhoneBuildingDetails,
    showPhoneDirectoryView,
    closePhoneBuildingDetails,
    setPhoneSheetSnap,
    cyclePhoneSheetSnap,
    togglePhoneRouteSheet,
    initPhoneSheetGestures,
    closePhotoLightbox,
    showPhonePlotDetails,
    togglePhoneFilterDropdown,
    closePhoneFilterDropdown
} from './phone-ui.js';

import {
    startPhoneAnimatedRoute,
    replayPhoneRoute,
    cancelPhoneRoute,
    showPhoneArrival,
    closePhoneArrivalPopup,
    replayFromArrivalPopup
} from './phone-nav.js';

import {
    startPhoneLiveGPS,
    startMobileGPSNavigation,
    stopPhoneLiveGPS,
    recenterOnUserGPS,
    initGPSMapListeners
} from './gps.js';

import {
    createKioskMarker,
    resetIdle,
    initIdleListeners,
    autoExitActiveSession,
    triggerAutoExitToIdle,
    showAutoExitToast
} from './idle.js';

import {
    getMobileNavigationUrl,
    updateBuildingQR,
    openQRZoomModal,
    closeQRZoomModal
} from './qr.js';

import {
    initOrbitControl,
    toggleOneFingerOrbitMode
} from './orbit-control.js';

import {
    initMapSettings,
    toggleMapSettingsPanel,
    openMapSettingsPanel,
    closeMapSettingsPanel,
    handleLayerToggle,
    setLabelDisplayMode,
    setEnvironmentLighting
} from './map-settings.js';

import { selectStandaloneGate } from './markers.js';

import {
    ensureOcclusionLayers,
    updateOcclusion,
    resetOcclusion
} from './occlusion.js';

import {
    initDroneCalibration,
    toggleDroneCalibrationHUD,
    applyDroneOffset,
    saveDroneCalibration,
    resetDroneCalibration
} from './drone-calibration.js';

import {
    initStationSelector,
    toggleStationDropdown,
    closeStationDropdown,
    switchResearchStation,
    loadQARESData,
    loadRARESData,
    renderRARESDirectory
} from './stations.js';

import {
    reportFrameRate,
    setPerformanceProfile,
    updatePerformanceUI
} from './performance.js';

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

// Global references for pathfinding & entrance points
window.ROAD_NETWORK = null;
window.roadGraph = new Map();
window.BUILDING_ENTRANCES = {};

// Fetch roads.json and build pathfinding graph
fetch('roads.json?v=81')
    .then(res => res.json())
    .then(data => {
        window.ROAD_NETWORK = data;

        // Extract entrances
        if (data.features) {
            const aliasMap = {
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
            data.features.forEach(f => {
                if (f.geometry.type === 'Point' && f.properties.type === 'entrance' && f.properties.buildingId) {
                    const bId = aliasMap[f.properties.buildingId] || f.properties.buildingId;
                    if (!window.BUILDING_ENTRANCES[bId]) {
                        window.BUILDING_ENTRANCES[bId] = [];
                    }
                    window.BUILDING_ENTRANCES[bId].push(f.geometry.coordinates);
                }
            });

            // Standalone compound gate barriers for direct pathfinding
            window.BUILDING_ENTRANCES['gate_main_entrance'] = [[121.165745, 13.958356]];
            window.BUILDING_ENTRANCES['gate_main_exit'] = [[121.165745, 13.959177]];
            window.BUILDING_ENTRANCES['gate_back_gate'] = [[121.172478, 13.961711]];
        }

        window.roadGraph = buildRoadGraph(data);
        state.roadGraph = window.roadGraph;
        state.laresRoadGraph = window.roadGraph;
        console.log(`Loaded road graph with ${window.roadGraph.size} nodes.`);
    })
    .catch(err => console.error("Could not fetch roads.json", err));

// Fetch colors from backend (with guaranteed per-building fallback to DEFAULT_BUILDING_COLORS)
fetch('/api/colors')
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
        const validData = (data && typeof data === 'object' && !data.error) ? data : {};
        state.savedBuildingColors = { ...DEFAULT_BUILDING_COLORS, ...validData };
        window.savedBuildingColors = state.savedBuildingColors;

        const updateList = (list) => {
            if (Array.isArray(list)) {
                list.forEach(b => {
                    if (state.savedBuildingColors[b.id] && state.savedBuildingColors[b.id].icon) {
                        b.color = state.savedBuildingColors[b.id].icon;
                    }
                });
            }
        };
        updateList(BUILDING_DIRECTORY);
        if (typeof window !== 'undefined' && window.BUILDING_DIRECTORY) {
            updateList(window.BUILDING_DIRECTORY);
        }

        if (state.currentStationId === 'lares') {
            removeMarkers();
            createMarkers();

            if (map.getLayer('3d-drawings-roofs')) {
                map.setPaintProperty('3d-drawings-roofs', 'fill-extrusion-color', getRoofColorCaseStyle());
            }

            buildDirectory();
        }
    })
    .catch(err => console.error("Could not fetch building colors", err));

// Fetch LARES pin location from backend (with fallback to current SAVED_MAIN_KIOSK_COORDS)
fetch('/api/pin')
    .then(res => res.ok ? res.json() : {})
    .catch(() => ({}))
    .then(data => {
        const validPin = data && Array.isArray(data.coordinates) && data.coordinates.length === 2 && data.coordinates[0] > 121.164 && data.coordinates[0] < 121.175;
        state.KIOSK_COORDS = validPin ? data.coordinates : [...SAVED_MAIN_KIOSK_COORDS];
        if (state.KIOSK_COORDS) {
            window.KIOSK_COORDS = state.KIOSK_COORDS;
            if (state.kioskMarkerInstance && state.currentStationId === 'lares') {
                state.kioskMarkerInstance.setLngLat(state.KIOSK_COORDS);
            }
            if (state.currentStationId === 'lares' && state.mapReady && !state.selectedBuildingId && !state.activeRoute) {
                map.flyTo({
                    center: DEFAULT_MAP_VIEW.center,
                    zoom: DEFAULT_MAP_VIEW.zoom,
                    pitch: DEFAULT_MAP_VIEW.pitch,
                    bearing: DEFAULT_MAP_VIEW.bearing,
                    duration: 1500
                });
            }
        }
    })
    .catch(err => console.error("Could not fetch pin location", err));

// Fetch QARES pin location from backend
fetch('/api/qares/pin')
    .then(res => res.json())
    .then(data => {
        if (data.coordinates) {
            state.QARES_KIOSK_COORDS = data.coordinates;
            window.QARES_KIOSK_COORDS = state.QARES_KIOSK_COORDS;
            if (state.kioskMarkerInstance && state.currentStationId === 'qares') {
                state.kioskMarkerInstance.setLngLat(state.QARES_KIOSK_COORDS);
            }
        }
    })
    .catch(err => console.error("Could not fetch QARES pin location", err));

// Fetch RARES pin location from backend
fetch('/api/rares/pin')
    .then(res => res.json())
    .then(data => {
        if (data.coordinates) {
            state.RARES_KIOSK_COORDS = data.coordinates;
            window.RARES_KIOSK_COORDS = state.RARES_KIOSK_COORDS;
            if (state.kioskMarkerInstance && state.currentStationId === 'rares') {
                state.kioskMarkerInstance.setLngLat(state.RARES_KIOSK_COORDS);
            }
        }
    })
    .catch(err => console.error("Could not fetch RARES pin location", err));

const STATIC_CUSTOM_3D_IDS = new Set(Object.keys(CUSTOM_3D_BUILDINGS || {}));

function parseModelScaleArray(raw) {
    if (Array.isArray(raw) && raw.length >= 3) {
        return raw.slice(0, 3).map(v => Number(v) || 1);
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) return [raw, raw, raw];
    const str = String(raw ?? '').trim();
    if (!str) return [1.0, 1.0, 1.0];
    if (/^\d+(\.\d+)?$/.test(str)) {
        const n = Number(str) || 1;
        return [n, n, n];
    }
    try {
        const arr = JSON.parse(str);
        if (Array.isArray(arr) && arr.length >= 3) {
            return arr.slice(0, 3).map(v => Number(v) || 1);
        }
    } catch (_) {}
    return [1.0, 1.0, 1.0];
}

function syncBuilding3DEntry(stationId, code, dbBldg, resolvedCoords, fStatus) {
    if (!CUSTOM_3D_BUILDINGS || !code) return;
    const rawUrl = String(dbBldg.model_glb_url || '').trim();
    const cleanUrl = rawUrl.split('?')[0].trim().replace(/^\/+/, '');
    const rot = (dbBldg.model_rotation !== null && dbBldg.model_rotation !== undefined && dbBldg.model_rotation !== '')
        ? Number(dbBldg.model_rotation)
        : null;

    if (STATIC_CUSTOM_3D_IDS.has(code)) {
        const existing = CUSTOM_3D_BUILDINGS[code];
        if (!existing) return;
        // Preserve static calibrated coords unless DB doesn't exist; only apply explicitly changed transform
        existing.facility_status = fStatus;
        if (!existing.stationId) existing.stationId = stationId;
        const curCleanUrl = String(existing.modelUrl || '').split('?')[0].trim().replace(/^\/+/, '');
        if (cleanUrl && cleanUrl !== curCleanUrl) {
            existing.modelUrl = rawUrl;
            existing.modelId = `db_${stationId}_${code}_${cleanUrl.replace(/[^a-z0-9]/gi, '_')}`;
        }
        if (rot !== null && Number.isFinite(rot)) {
            existing.rotation = rot;
        }
        if (dbBldg.model_scale !== null && dbBldg.model_scale !== undefined && String(dbBldg.model_scale).trim() !== '') {
            existing.scale = parseModelScaleArray(dbBldg.model_scale);
        }
        return;
    }

    if (cleanUrl && resolvedCoords) {
        CUSTOM_3D_BUILDINGS[code] = {
            modelId: `db_${stationId}_${code}_${cleanUrl.replace(/[^a-z0-9]/gi, '_')}`,
            modelUrl: rawUrl,
            coords: resolvedCoords,
            rotation: (rot !== null && Number.isFinite(rot)) ? rot : 0,
            scale: parseModelScaleArray(dbBldg.model_scale),
            stationId,
            facility_status: fStatus,
            _dynamicFromDb: true
        };
    } else if (CUSTOM_3D_BUILDINGS[code] && CUSTOM_3D_BUILDINGS[code]._dynamicFromDb) {
        delete CUSTOM_3D_BUILDINGS[code];
    }
}

function parseJsonSafe(raw, fallback = null) {
    if (raw === null || raw === undefined || raw === '') return fallback;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (_) { return fallback; }
}

function extractGeoGeometry(rawGeo) {
    const parsed = parseJsonSafe(rawGeo, null);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.type === 'Feature' && parsed.geometry && parsed.geometry.coordinates) return parsed.geometry;
    if (parsed.type && parsed.coordinates) return parsed;
    return null;
}

function computeGeometryCenter(geo) {
    if (!geo || !geo.coordinates) return null;
    let ring = null;
    if (geo.type === 'Polygon' && Array.isArray(geo.coordinates[0])) ring = geo.coordinates[0];
    else if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates[0]?.[0])) ring = geo.coordinates[0][0];
    else if (geo.type === 'Point' && Array.isArray(geo.coordinates)) return [Number(geo.coordinates[0]), Number(geo.coordinates[1])];
    if (!ring || ring.length === 0) return null;
    let sumLng = 0, sumLat = 0, count = 0;
    ring.forEach(c => {
        if (Array.isArray(c) && c.length >= 2) {
            sumLng += Number(c[0]);
            sumLat += Number(c[1]);
            count++;
        }
    });
    return count > 0 ? [sumLng / count, sumLat / count] : null;
}

// Hydrate live station, building, office, photo, and agronomic plot records from 10-table MySQL database
export function syncDatabaseBootstrap(stationId = 'lares') {
    const activeSt = (stationId || state.currentStationId || 'lares').toLowerCase();
    return fetch(`/api/bootstrap?station=${encodeURIComponent(activeSt)}&_t=${Date.now()}`, { cache: 'no-store' })
        .then(res => res.ok ? res.json() : null)
        .catch(() => null)
        .then(boot => {
            if (!boot || boot.error) return;

            // 1. Sync all 4 stations status, subtitles, UI metadata, and "You Are Here" pins
            if (Array.isArray(boot.allStations)) {
                boot.allStations.forEach(st => {
                    if (STATIONS[st.station_id]) {
                        if (st.name) STATIONS[st.station_id].name = st.name;
                        STATIONS[st.station_id].label = st.label || STATIONS[st.station_id].label;
                        STATIONS[st.station_id].sub = st.subtitle || STATIONS[st.station_id].sub;
                        STATIONS[st.station_id].fullName = st.full_name || STATIONS[st.station_id].fullName || STATIONS[st.station_id].sub;
                        STATIONS[st.station_id].province = st.province || STATIONS[st.station_id].province;
                        STATIONS[st.station_id].status = st.status === 'live' ? 'active' : 'under_development';

                        const parsedWelcome = parseJsonSafe(st.welcome_tags, null);
                        if (Array.isArray(parsedWelcome) && parsedWelcome.length > 0) {
                            STATIONS[st.station_id].welcomeTags = parsedWelcome;
                        }
                        const parsedQuick = parseJsonSafe(st.quick_tags, null);
                        if (Array.isArray(parsedQuick)) {
                            STATIONS[st.station_id].quickTags = parsedQuick;
                        }
                        const parsedFilterDesc = parseJsonSafe(st.filter_descriptions, null);
                        if (parsedFilterDesc && typeof parsedFilterDesc === 'object' && !Array.isArray(parsedFilterDesc)) {
                            STATIONS[st.station_id].filterDescriptions = {
                                ...(STATIONS[st.station_id].filterDescriptions || {}),
                                ...parsedFilterDesc
                            };
                        }
                        if (st.kiosk_pin_lng && st.kiosk_pin_lat) {
                            const coords = [Number(st.kiosk_pin_lng), Number(st.kiosk_pin_lat)];
                            STATIONS[st.station_id].kioskCoords = coords;
                            if (st.station_id === 'lares') {
                                state.KIOSK_COORDS = coords;
                                window.KIOSK_COORDS = coords;
                            } else if (st.station_id === 'qares') {
                                state.QARES_KIOSK_COORDS = coords;
                                window.QARES_KIOSK_COORDS = coords;
                            } else if (st.station_id === 'rares') {
                                state.RARES_KIOSK_COORDS = coords;
                                window.RARES_KIOSK_COORDS = coords;
                            }
                            if (state.kioskMarkerInstance && state.currentStationId === st.station_id) {
                                state.kioskMarkerInstance.setLngLat(coords);
                            }
                        }
                    }
                });
                initStationSelector();
            }

            // 2. Sync buildings (Full Insert / Update / Delete), descriptions, photos, offices, and footprints
            if (Array.isArray(boot.buildings)) {
                const dbCodes = new Set(boot.buildings.map(b => b.building_code).filter(Boolean));
                const stationBaseline = activeSt === 'rares'
                    ? window.raresBuildingsBaseline
                    : (activeSt === 'qares' ? window.qaresBuildingsBaseline : null);

                // Delete removed features on non-LARES baselines when MySQL returned records
                if (stationBaseline && Array.isArray(stationBaseline.features) && dbCodes.size > 0) {
                    for (let i = stationBaseline.features.length - 1; i >= 0; i--) {
                        const p = stationBaseline.features[i]?.properties || {};
                        const code = p.building_code || p.id;
                        if (code && !dbCodes.has(code)) {
                            stationBaseline.features.splice(i, 1);
                            delete BUILDING_OFFICES[code];
                            if (CUSTOM_3D_BUILDINGS[code]?. _dynamicFromDb) {
                                delete CUSTOM_3D_BUILDINGS[code];
                            }
                        }
                    }
                }

                // Delete removed buildings on LARES when MySQL returned records (preserving standalone gates)
                if (activeSt === 'lares' && dbCodes.size > 0) {
                    for (let i = BUILDING_DIRECTORY.length - 1; i >= 0; i--) {
                        const b = BUILDING_DIRECTORY[i];
                        if (b && !b.isGate && b.id && !dbCodes.has(b.id)) {
                            BUILDING_DIRECTORY.splice(i, 1);
                            delete BUILDING_OFFICES[b.id];
                            delete BUILDING_WAYFINDING_INFO[b.id];
                            delete KNOWN_BUILDING_NAMES[b.id];
                            delete CUSTOM_BUILDING_CENTERS[b.id];
                            if (CUSTOM_3D_BUILDINGS[b.id]?._dynamicFromDb) {
                                delete CUSTOM_3D_BUILDINGS[b.id];
                            }
                        }
                    }
                    if (LARES_DRAWINGS && Array.isArray(LARES_DRAWINGS.features)) {
                        for (let i = LARES_DRAWINGS.features.length - 1; i >= 0; i--) {
                            const fid = LARES_DRAWINGS.features[i]?.properties?.id;
                            if (fid && !dbCodes.has(fid)) {
                                LARES_DRAWINGS.features.splice(i, 1);
                            }
                        }
                    }
                }

                const baselineMap = new Map();
                if (stationBaseline && Array.isArray(stationBaseline.features)) {
                    stationBaseline.features.forEach(f => {
                        const key = f.properties && (f.properties.building_code || f.properties.id);
                        if (key && !baselineMap.has(key)) baselineMap.set(key, f.properties);
                    });
                }

                boot.buildings.forEach(dbBldg => {
                    const code = dbBldg.building_code;
                    if (!code) return;
                    const fStatus = normalizeFacilityStatus(dbBldg.facility_status || 'Existing');
                    const dbCoords = (dbBldg.marker_lng && dbBldg.marker_lat)
                        ? [Number(dbBldg.marker_lng), Number(dbBldg.marker_lat)]
                        : null;
                    const footprintGeo = extractGeoGeometry(dbBldg.footprint_geojson);
                    const geoCenter = computeGeometryCenter(footprintGeo);
                    const resolvedCoords = dbCoords || geoCenter;
                    const mappedImages = Array.isArray(dbBldg.images) && dbBldg.images.length > 0
                        ? dbBldg.images.map(img => ({ src: img.image_webp_url, label: img.caption || 'Facility View' }))
                        : null;

                    syncBuilding3DEntry(activeSt, code, dbBldg, resolvedCoords, fStatus);

                    // Sync QARES / RARES GeoJSON baseline feature
                    if (stationBaseline && Array.isArray(stationBaseline.features)) {
                        let bProp = baselineMap.get(code);
                        if (!bProp && resolvedCoords) {
                            const geom = footprintGeo || {
                                type: 'Polygon',
                                coordinates: buildFallbackRectRing(resolvedCoords, 0.000048, 0.000038)
                            };
                            const newFeat = {
                                type: 'Feature',
                                properties: {
                                    id: code,
                                    building_code: code,
                                    name: dbBldg.name || code,
                                    description: dbBldg.description || '',
                                    category: dbBldg.category || 'Buildings',
                                    filter_type: 'Buildings',
                                    type: dbBldg.type_label || 'Facility',
                                    color: dbBldg.pin_color || '#3b82f6',
                                    roof_color: dbBldg.roof_color || dbBldg.pin_color || '#334155',
                                    icon: dbBldg.icon || '🏛️',
                                    height: Number(dbBldg.height) || 5.5,
                                    min_height: 0,
                                    facility_status: fStatus,
                                    marker_coords: resolvedCoords
                                },
                                geometry: geom
                            };
                            stationBaseline.features.push(newFeat);
                            bProp = newFeat.properties;
                            baselineMap.set(code, bProp);
                        } else if (bProp) {
                            if (dbBldg.name) bProp.name = dbBldg.name;
                            if (dbBldg.description !== undefined && dbBldg.description !== null) bProp.description = dbBldg.description;
                            if (dbBldg.category) bProp.category = dbBldg.category;
                            if (dbBldg.type_label) bProp.type = dbBldg.type_label;
                            if (dbBldg.pin_color) bProp.color = dbBldg.pin_color;
                            if (dbBldg.roof_color) bProp.roof_color = dbBldg.roof_color;
                            if (dbBldg.icon) bProp.icon = dbBldg.icon;
                            if (dbBldg.height) bProp.height = Number(dbBldg.height) || bProp.height;
                            bProp.facility_status = fStatus;
                            if (resolvedCoords) bProp.marker_coords = resolvedCoords;
                        }
                        if (bProp) {
                            bProp.has_3d_model = Boolean(CUSTOM_3D_BUILDINGS && CUSTOM_3D_BUILDINGS[code]);
                            if (dbBldg.compact_tag !== undefined) bProp.compact_tag = dbBldg.compact_tag || '';
                            if (dbBldg.visual_landmark !== undefined) bProp.visual_landmark = dbBldg.visual_landmark || '';
                            if (dbBldg.key_services !== undefined) bProp.key_services = dbBldg.key_services || '';
                            if (mappedImages) {
                                bProp.image = mappedImages[0].src;
                                bProp.images = mappedImages;
                            }
                        }
                    }

                    // Sync LARES directory, names, centers & drawings geometry
                    if (activeSt === 'lares') {
                        let target = BUILDING_DIRECTORY.find(b => b.id === code);
                        const existingCoords = (target && Array.isArray(target.coords) && target.coords.length >= 2 && Number.isFinite(Number(target.coords[0])) && Number.isFinite(Number(target.coords[1]))) ? target.coords : null;
                        const effectiveCoords = resolvedCoords || existingCoords;
                        if (!effectiveCoords && !footprintGeo) {
                            // Never synthesize fallback [121.1665, 13.9585] boxes or markers for unmapped drafts
                            return;
                        }
                        if (!target) {
                            target = {
                                id: code,
                                name: dbBldg.name || code,
                                num: dbBldg.building_num !== undefined ? dbBldg.building_num : null,
                                icon: dbBldg.icon || '🏛️',
                                desc: dbBldg.description || 'DA-LARES Facility',
                                section: dbBldg.section || 'Compound',
                                coords: effectiveCoords,
                                color: dbBldg.pin_color || '#3b82f6',
                                roofColor: dbBldg.roof_color || '#334155',
                                category: dbBldg.category || 'infrastructure',
                                type: dbBldg.type_label || 'Facility',
                                facility_status: fStatus,
                                isSubPlot: Boolean(dbBldg.is_subplot),
                                hasMarker: dbBldg.has_marker !== 0 && dbBldg.has_marker !== false,
                                isVisible: dbBldg.is_visible !== 0 && dbBldg.is_visible !== false,
                                height: Number(dbBldg.height) || 5.5
                            };
                            BUILDING_DIRECTORY.push(target);
                        } else {
                            if (dbBldg.name) target.name = dbBldg.name;
                            if (dbBldg.building_num !== undefined) target.num = dbBldg.building_num;
                            if (dbBldg.category) target.category = dbBldg.category;
                            if (dbBldg.type_label) target.type = dbBldg.type_label;
                            if (dbBldg.description !== undefined && dbBldg.description !== null) target.desc = dbBldg.description;
                            if (dbBldg.pin_color) target.color = dbBldg.pin_color;
                            if (dbBldg.roof_color) target.roofColor = dbBldg.roof_color;
                            if (dbBldg.icon) target.icon = dbBldg.icon;
                            if (resolvedCoords) target.coords = resolvedCoords;
                            target.facility_status = fStatus;
                            target.isSubPlot = Boolean(dbBldg.is_subplot);
                            target.hasMarker = dbBldg.has_marker !== 0 && dbBldg.has_marker !== false;
                            target.isVisible = dbBldg.is_visible !== 0 && dbBldg.is_visible !== false;
                            if (dbBldg.height) target.height = Number(dbBldg.height) || target.height;
                        }
                        target.compactTag = dbBldg.compact_tag || '';
                        target.visualLandmark = dbBldg.visual_landmark || '';
                        target.keyServices = dbBldg.key_services || '';
                        if (mappedImages) {
                            target.image = mappedImages[0].src;
                            target.images = mappedImages;
                        }
                        if (footprintGeo) {
                            target._footprintGeojson = footprintGeo;
                        }

                        if (target.name) KNOWN_BUILDING_NAMES[code] = target.name;
                        if (effectiveCoords) CUSTOM_BUILDING_CENTERS[code] = effectiveCoords;

                        if (LARES_DRAWINGS && Array.isArray(LARES_DRAWINGS.features)) {
                            const existingFeat = LARES_DRAWINGS.features.find(f => f && f.properties && f.properties.id === code);
                            if (existingFeat) {
                                existingFeat.properties.name = target.name;
                                existingFeat.properties.facility_status = fStatus;
                                existingFeat.properties.height = Number(dbBldg.height) || existingFeat.properties.height || 5.5;
                                existingFeat.properties.has_3d_model = Boolean(CUSTOM_3D_BUILDINGS && CUSTOM_3D_BUILDINGS[code]);
                                if (footprintGeo) existingFeat.geometry = footprintGeo;
                            } else {
                                const fallbackRing = !footprintGeo ? buildFallbackRectRing(effectiveCoords, 0.000048, 0.000038) : null;
                                const resolvedGeom = footprintGeo || (fallbackRing ? { type: 'Polygon', coordinates: fallbackRing } : null);
                                if (resolvedGeom) {
                                    LARES_DRAWINGS.features.push({
                                        type: 'Feature',
                                        properties: {
                                            id: code,
                                            name: target.name,
                                            height: Number(dbBldg.height) || 5.5,
                                            min_height: 0,
                                            facility_status: fStatus,
                                            has_3d_model: Boolean(CUSTOM_3D_BUILDINGS && CUSTOM_3D_BUILDINGS[code])
                                        },
                                        geometry: resolvedGeom
                                    });
                                }
                            }
                        }
                    }

                    // Sync wayfinding info
                    if (dbBldg.visual_landmark || dbBldg.key_services || dbBldg.compact_tag) {
                        BUILDING_WAYFINDING_INFO[code] = {
                            ...(BUILDING_WAYFINDING_INFO[code] || {}),
                            compactTag: dbBldg.compact_tag || (BUILDING_WAYFINDING_INFO[code]?.compactTag) || '',
                            visualLandmark: dbBldg.visual_landmark || (BUILDING_WAYFINDING_INFO[code]?.visualLandmark) || '',
                            keyServices: dbBldg.key_services || (BUILDING_WAYFINDING_INFO[code]?.keyServices) || ''
                        };
                    }

                    // Sync offices, room numbers & search aliases (supports 0, 1, or multiple offices with floor grouping)
                    if (Array.isArray(dbBldg.offices)) {
                        Object.keys(OFFICE_ROOM_NUMBERS).forEach(k => {
                            if (k.startsWith(`${code}::`)) delete OFFICE_ROOM_NUMBERS[k];
                        });
                        dbBldg.offices.forEach(o => {
                            const rawKeywords = o.search_aliases || o.search_keywords;
                            if (o.office_name && rawKeywords) {
                                const parsedAliases = Array.isArray(rawKeywords)
                                    ? rawKeywords
                                    : String(rawKeywords).split(',').map(s => s.trim()).filter(Boolean);
                                if (parsedAliases.length > 0) {
                                    OFFICE_SEARCH_ALIASES[o.office_name] = parsedAliases;
                                }
                            }
                            if (o.office_name && o.room_number) {
                                OFFICE_ROOM_NUMBERS[`${code}::${o.office_name}`] = o.room_number;
                            }
                        });
                        if (dbBldg.offices.length === 0) {
                            delete BUILDING_OFFICES[code];
                        } else {
                            const hasFloors = dbBldg.offices.some(o => o.floor_or_room);
                            if (hasFloors) {
                                const floorGroups = {};
                                dbBldg.offices.forEach(o => {
                                    const fl = o.floor_or_room || 'General';
                                    if (!floorGroups[fl]) floorGroups[fl] = [];
                                    floorGroups[fl].push(o.office_name);
                                });
                                BUILDING_OFFICES[code] = Object.entries(floorGroups).map(([floor, offices]) => ({ floor, offices }));
                            } else {
                                BUILDING_OFFICES[code] = dbBldg.offices.map(o => o.office_name);
                            }
                        }
                    }
                });

                // Refresh live Mapbox source for QARES/RARES GeoJSON footprints if mounted
                if (activeSt === 'qares' && state.map && state.map.getSource('qares-footprints-source') && window.qaresBuildingsBaseline) {
                    try { state.map.getSource('qares-footprints-source').setData(window.qaresBuildingsBaseline); } catch (e) {}
                } else if (activeSt === 'rares' && state.map && state.map.getSource('rares-footprints-source') && window.raresBuildingsBaseline) {
                    try { state.map.getSource('rares-footprints-source').setData(window.raresBuildingsBaseline); } catch (e) {}
                }

                if (activeSt === 'rares' && typeof window.renderRARESDirectory === 'function') {
                    window.renderRARESDirectory(window.raresBuildingsBaseline);
                } else if (activeSt === 'qares' && typeof window.renderQARESDirectory === 'function') {
                    window.renderQARESDirectory(window.qaresBuildingsBaseline);
                }
            }

            // 3. Sync agricultural plots & agronomic records (Full Insert / Split / Update / Delete)
            if (activeSt === 'lares' && Array.isArray(boot.plots)) {
                const dbPlotCodes = new Set(boot.plots.map(p => p.plot_code).filter(Boolean));
                if (dbPlotCodes.size > 0) {
                    for (let i = FIELD_COMMODITY_ZONES.length - 1; i >= 0; i--) {
                        if (FIELD_COMMODITY_ZONES[i] && FIELD_COMMODITY_ZONES[i].id && !dbPlotCodes.has(FIELD_COMMODITY_ZONES[i].id)) {
                            FIELD_COMMODITY_ZONES.splice(i, 1);
                        }
                    }
                    if (Array.isArray(ZONE_POLYGONS)) {
                        for (let i = ZONE_POLYGONS.length - 1; i >= 0; i--) {
                            const f = ZONE_POLYGONS[i];
                            const fid = (f && f.properties && (f.properties.id || f.properties.zoneId)) || (f && f.id);
                            if (fid && !dbPlotCodes.has(fid)) {
                                ZONE_POLYGONS.splice(i, 1);
                            }
                        }
                    }
                }

                boot.plots.forEach(dbPlot => {
                    const pCode = dbPlot.plot_code;
                    if (!pCode) return;
                    const pStatus = normalizeFacilityStatus(dbPlot.facility_status || 'Existing');
                    const polyGeo = extractGeoGeometry(dbPlot.polygon_geojson);
                    const polyCenter = computeGeometryCenter(polyGeo);
                    const dbCenter = (dbPlot.center_lng && dbPlot.center_lat)
                        ? [Number(dbPlot.center_lng), Number(dbPlot.center_lat)]
                        : null;

                    let targetZone = FIELD_COMMODITY_ZONES.find(z => z.id === pCode);
                    const existingZoneCoords = (targetZone && Array.isArray(targetZone.coords) && targetZone.coords.length >= 2 && Number.isFinite(Number(targetZone.coords[0])) && Number.isFinite(Number(targetZone.coords[1]))) ? targetZone.coords : null;
                    const zoneCoords = dbCenter || polyCenter || existingZoneCoords || null;
                    if (!zoneCoords && !polyGeo) {
                        // Never synthesize fallback [121.1665, 13.9585] plot boxes or markers for unmapped plot records
                        return;
                    }

                    if (!targetZone) {
                        targetZone = {
                            id: pCode,
                            name: dbPlot.zone_name || pCode,
                            plotRange: dbPlot.plot_number || 'Plot',
                            plotCount: 1,
                            plotsList: [],
                            subPlots: [],
                            category: dbPlot.category || 'crop',
                            icon: dbPlot.icon || '🌱',
                            color: dbPlot.color || '#22c55e',
                            description: dbPlot.description || '',
                            image: dbPlot.image_webp_url || '',
                            coords: zoneCoords,
                            centerCoords: zoneCoords,
                            facility_status: pStatus,
                            currentCrop: dbPlot.current_crop || null,
                            treeCount: dbPlot.tree_or_plant_count,
                            croppingCycle: dbPlot.cropping_cycle || 'perennial',
                            cycleMonths: dbPlot.cycle_months || null,
                            areaHectares: dbPlot.area_hectares || null,
                            soilType: dbPlot.soil_type || null,
                            status: dbPlot.status || 'Active'
                        };
                        FIELD_COMMODITY_ZONES.push(targetZone);
                    } else {
                        if (dbPlot.zone_name) targetZone.name = dbPlot.zone_name;
                        if (dbPlot.plot_number) targetZone.plotRange = dbPlot.plot_number;
                        if (dbPlot.category) targetZone.category = dbPlot.category;
                        if (dbPlot.icon) targetZone.icon = dbPlot.icon;
                        if (dbPlot.color) targetZone.color = dbPlot.color;
                        if (dbPlot.description !== undefined && dbPlot.description !== null) targetZone.description = dbPlot.description;
                        if (dbPlot.image_webp_url) targetZone.image = dbPlot.image_webp_url;
                        if (dbCenter || polyCenter || !targetZone.centerCoords) {
                            targetZone.coords = zoneCoords;
                            targetZone.centerCoords = zoneCoords;
                        }
                        targetZone.facility_status = pStatus;
                        targetZone.currentCrop = dbPlot.current_crop || null;
                        targetZone.treeCount = dbPlot.tree_or_plant_count;
                        targetZone.croppingCycle = dbPlot.cropping_cycle || 'perennial';
                        targetZone.cycleMonths = dbPlot.cycle_months || null;
                        targetZone.areaHectares = dbPlot.area_hectares || null;
                        targetZone.soilType = dbPlot.soil_type || null;
                        targetZone.status = dbPlot.status || 'Active';
                    }

                    if (Array.isArray(dbPlot.subPlots) && dbPlot.subPlots.length > 0) {
                        const existingSubPlots = Array.isArray(targetZone.subPlots) ? targetZone.subPlots : [];
                        targetZone.subPlots = dbPlot.subPlots.map((sp, spIdx) => {
                            const matched = existingSubPlots.find(ex =>
                                (sp.subplot_code && ex.buildingId === sp.subplot_code) ||
                                (sp.name && ex.name === sp.name)
                            ) || existingSubPlots[spIdx] || {};
                            return {
                                ...matched,
                                id: sp.id,
                                buildingId: sp.subplot_code || matched.buildingId || '',
                                plotNum: matched.plotNum || sp.plot_num || '',
                                name: sp.name || matched.name || 'Sub-Plot',
                                desc: sp.description || matched.desc || '',
                                currentCrop: sp.current_crop || matched.currentCrop || ''
                            };
                        });
                    }

                    if (Array.isArray(ZONE_POLYGONS)) {
                        const zFeat = ZONE_POLYGONS.find(f => f && ((f.properties && (f.properties.id === pCode || f.properties.zoneId === pCode)) || f.id === pCode));
                        if (zFeat) {
                            zFeat.properties = {
                                ...(zFeat.properties || {}),
                                id: pCode,
                                zoneId: pCode,
                                name: targetZone.name,
                                color: targetZone.color,
                                category: targetZone.category,
                                facility_status: pStatus
                            };
                            if (polyGeo) zFeat.geometry = polyGeo;
                        } else {
                            const fallbackPolyRing = !polyGeo ? buildFallbackRectRing(zoneCoords, 0.000065, 0.000055) : null;
                            const resolvedPolyGeom = polyGeo || (fallbackPolyRing ? { type: 'Polygon', coordinates: fallbackPolyRing } : null);
                            if (resolvedPolyGeom) {
                                ZONE_POLYGONS.push({
                                    type: 'Feature',
                                    id: pCode,
                                    properties: {
                                        id: pCode,
                                        zoneId: pCode,
                                        name: targetZone.name,
                                        color: targetZone.color,
                                        category: targetZone.category,
                                        facility_status: pStatus
                                    },
                                    geometry: resolvedPolyGeom
                                });
                            }
                        }
                    }
                });

                if (typeof window.initPlotLayers === 'function') {
                    try { window.initPlotLayers(); } catch (e) {}
                }
            }

            if (activeSt === 'lares') {
                if (typeof filterDirectory === 'function') {
                    filterDirectory();
                } else {
                    buildDirectory();
                }
                if (typeof renderPhoneDirectory === 'function') {
                    const phoneQuery = document.getElementById('phone-search-input')?.value || '';
                    renderPhoneDirectory(phoneQuery);
                }
            }

            const isMapStyleReady = state.mapReady || (map && typeof map.isStyleLoaded === 'function' && map.isStyleLoaded());
            if (isMapStyleReady && typeof window.applyFacilityStatusFilters === 'function') {
                window.applyFacilityStatusFilters();
            } else if (activeSt === 'lares' && isMapStyleReady) {
                removeMarkers();
                createMarkers();
            }

            // Refresh currently open building/plot drawer in-place without forcing reload
            const activeId = state.selectedBuildingId || window.selectedBuildingId;
            if (activeId) {
                const isPlotSelected = Boolean(window.selectedPlotZoneId && window.selectedPlotZoneId === activeId)
                    || FIELD_COMMODITY_ZONES.some(z => z.id === activeId);
                const desktopPanel = document.getElementById('building-panel');
                if (desktopPanel && (desktopPanel.classList.contains('active') || desktopPanel.classList.contains('open'))) {
                    if (isPlotSelected) {
                        const zMatch = FIELD_COMMODITY_ZONES.find(z => z.id === activeId);
                        if (zMatch) showPlotPanel(zMatch.id);
                        else closeBuildingPanel();
                    } else if (activeSt !== 'lares' || BUILDING_DIRECTORY.some(b => b.id === activeId)) {
                        showBuildingPanel(activeId, state.activeSearchedOffice || '');
                    } else {
                        closeBuildingPanel();
                    }
                }
                const phoneBldgView = document.getElementById('phone-view-bldg');
                if (phoneBldgView && (phoneBldgView.classList.contains('active') || state.phoneSheetCurrentView === 'bldg')) {
                    if (isPlotSelected) {
                        const zMatch = FIELD_COMMODITY_ZONES.find(z => z.id === activeId);
                        if (zMatch) showPhonePlotDetails(zMatch);
                        else closePhoneBuildingDetails();
                    } else if (activeSt !== 'lares' || BUILDING_DIRECTORY.some(b => b.id === activeId)) {
                        showPhoneBuildingDetails(activeId, state.activeSearchedOffice || '');
                    } else {
                        closePhoneBuildingDetails();
                    }
                }
            }
        });
}

// Initial database bootstrap on startup
syncDatabaseBootstrap('lares');

// Live Cross-Tab & Multi-Device Sync (BroadcastChannel + 30s /api/version polling)
let lastKnownDbUpdatedAt = null;
let versionPollInFlight = false;

export async function checkRemoteDataVersion(forceSync = false) {
    if (versionPollInFlight) return false;
    versionPollInFlight = true;
    try {
        const res = await fetch(`/api/version?_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return false;
        const ver = await res.json();
        const nextVer = ver && ver.dbUpdatedAt ? String(ver.dbUpdatedAt) : '';
        const changed = Boolean(nextVer && lastKnownDbUpdatedAt !== null && nextVer !== lastKnownDbUpdatedAt);
        if (nextVer) {
            lastKnownDbUpdatedAt = nextVer;
        }
        if (forceSync || changed) {
            await syncDatabaseBootstrap(state.currentStationId || 'lares');
            return true;
        }
        return false;
    } catch (_) {
        return false;
    } finally {
        versionPollInFlight = false;
    }
}

if (typeof window !== 'undefined') {
    window.syncDatabaseBootstrap = syncDatabaseBootstrap;
    window.checkRemoteDataVersion = checkRemoteDataVersion;

    // Record baseline data_version cleanly at startup
    checkRemoteDataVersion(false);

    // 30-second lightweight background polling for multi-device kiosk/mobile auto-sync
    setInterval(() => {
        checkRemoteDataVersion(false);
    }, 30000);

    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkRemoteDataVersion(false);
            }
        });
    }

    window.addEventListener('storage', (e) => {
        if (e.key === 'da_db_sync_ts') {
            checkRemoteDataVersion(true);
        }
    });

    if (typeof BroadcastChannel !== 'undefined') {
        const handleLiveSyncEvent = (ev) => {
            const d = (ev && ev.data) || {};
            if (!d.type || d.type === 'db_updated' || d.type === 'publish_complete' || d.type === 'draft_published') {
                checkRemoteDataVersion(true);
            }
        };
        ['iguide_db_sync', 'da_spatial_hub_sync'].forEach(channelName => {
            try {
                const syncChannel = new BroadcastChannel(channelName);
                syncChannel.onmessage = handleLiveSyncEvent;
            } catch (e) {}
        });
    }
}

// Initial Map load sequence
function initViewportTelemetry() {
    const coordsEl = document.getElementById('coords-text');
    const zoomEl = document.getElementById('zoom-text');
    const fpsEl = document.getElementById('fps-badge');
    if (!map) return;

    let lastPosUpdate = 0;
    let coordsRafId = null;
    const updateCoords = () => {
        coordsRafId = null;
        const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        if (now - lastPosUpdate < 150) return;
        lastPosUpdate = now;
        const center = map.getCenter();
        const zoom = map.getZoom();
        const pitch = (map.getPitch() || 0) * Math.PI / 180;
        const fov = 36.87 * Math.PI / 180;
        const earthCirc = 40075016.686;
        const altMeters = Math.round(((earthCirc * Math.cos(center.lat * Math.PI / 180)) / (Math.pow(2, zoom) * 2 * Math.tan(fov / 2))) * Math.cos(pitch));
        if (coordsEl) coordsEl.textContent = `${center.lat.toFixed(4)}° N, ${center.lng.toFixed(4)}° E`;
        if (zoomEl) zoomEl.textContent = `Zoom ${zoom.toFixed(1)} (${altMeters}m alt)`;
    };
    const onMapMoveThrottled = () => {
        if (!coordsRafId) {
            coordsRafId = requestAnimationFrame(updateCoords);
        }
        wakeFpsMeter();
    };
    map.on('move', onMapMoveThrottled);
    updateCoords();

    // Adaptive, Idle-Sleeping Frame Meter
    // On low-end systems, running continuous RAF ticks while the map is static wastes CPU/battery.
    // This meter runs during active interaction / movement / animation, and enters sleep during idle.
    let frameCount = 0;
    let lastFpsCalc = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    let fpsRafId = null;
    let isFpsMeterActive = false;
    let lastActivityTimestamp = Date.now();

    function wakeFpsMeter() {
        lastActivityTimestamp = Date.now();
        if (isFpsMeterActive || (typeof document !== 'undefined' && document.hidden)) return;
        isFpsMeterActive = true;
        frameCount = 0;
        lastFpsCalc = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        fpsRafId = requestAnimationFrame(fpsStep);
    }

    function sleepFpsMeter() {
        if (!isFpsMeterActive) return;
        isFpsMeterActive = false;
        if (fpsRafId) {
            cancelAnimationFrame(fpsRafId);
            fpsRafId = null;
        }
    }

    function fpsStep(now) {
        if (!isFpsMeterActive || (typeof document !== 'undefined' && document.hidden)) {
            sleepFpsMeter();
            return;
        }

        frameCount++;
        if (now - lastFpsCalc >= 500) {
            const fps = Math.round((frameCount * 1000) / (now - lastFpsCalc));
            frameCount = 0;
            lastFpsCalc = now;
            if (fpsEl) {
                fpsEl.textContent = `${fps} FPS`;
                fpsEl.style.color = fps >= 45 ? '#22c55e' : (fps >= 28 ? '#eab308' : '#ef4444');
            }
            if (typeof reportFrameRate === 'function') {
                reportFrameRate(fps);
            }

            // Check if animations or movement are ongoing
            const isAnyAnimationActive = state.isWalking || state.isOrbiting || state.idleRotating || state.isIntroAnimating;
            if (isAnyAnimationActive) {
                lastActivityTimestamp = Date.now();
            } else if (Date.now() - lastActivityTimestamp > 2000) {
                // Enter idle sleep to free CPU cores
                sleepFpsMeter();
                return;
            }
        }
        fpsRafId = requestAnimationFrame(fpsStep);
    }

    // Wake meter on any camera manipulation or interactive state change
    map.on('movestart', wakeFpsMeter);
    map.on('zoomstart', wakeFpsMeter);
    map.on('rotatestart', wakeFpsMeter);
    map.on('pitchstart', wakeFpsMeter);
    if (typeof window !== 'undefined') {
        window.wakeFpsMeter = wakeFpsMeter;
        window.addEventListener('pointerdown', wakeFpsMeter, { passive: true });
        window.addEventListener('wheel', wakeFpsMeter, { passive: true });
    }

    // Initial warm-up for 3 seconds to measure baseline hardware FPS
    wakeFpsMeter();

    // Page Visibility API integration: stop measuring when tab is hidden, wake up when tab returns
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                sleepFpsMeter();
            } else {
                wakeFpsMeter();
            }
        });
    }
}

map.on('load', () => {
    setTimeout(() => {
        initStationSelector();
        revealMap();
        ensureOcclusionLayers();
        if (state.currentStationId === 'lares') {
            createKioskMarker();
            buildDirectory();
        } else if (state.currentStationId === 'qares') {
            createKioskMarker();
            loadQARESData();
        } else if (state.currentStationId === 'rares') {
            createKioskMarker();
            renderRARESDirectory();
            loadRARESData();
        }
        resetIdle();
        syncLightingWithTime();
        initViewportTelemetry();
    }, 300);
});

// --- URL Query Parameter Auto-Router ---
export function handleUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const destParam = params.get('dest');
    const viewParam = params.get('view');

    if (viewParam === 'mapbox') {
        const interval = setInterval(() => {
            if (state.mapReady) {
                clearInterval(interval);
                if (state.currentMapStyleMode !== 'mapbox') toggleMapboxView();
            }
        }, 100);
    }

    if (destParam) {
        const interval = setInterval(() => {
            if (state.mapReady && typeof BUILDING_DIRECTORY !== 'undefined' && BUILDING_DIRECTORY.length > 0 && window.roadGraph && window.roadGraph.size > 0) {
                clearInterval(interval);
                const normDest = destParam.toLowerCase();
                const matchedZone = (typeof FIELD_COMMODITY_ZONES !== 'undefined')
                    ? FIELD_COMMODITY_ZONES.find(z =>
                        z.id.toLowerCase() === normDest ||
                        (z.name && z.name.toLowerCase() === normDest)
                    )
                    : null;
                const bldg = !matchedZone ? BUILDING_DIRECTORY.find(b =>
                    b.id.toLowerCase() === normDest ||
                    b.id.toLowerCase().includes(normDest) ||
                    (!isNaN(destParam) && (b.num === parseInt(destParam, 10) || BUILDING_DIRECTORY[parseInt(destParam, 10) - 1]?.id === b.id))
                ) : null;
                if (matchedZone) {
                    if (typeof window.selectPlotZone === 'function') {
                        window.selectPlotZone(matchedZone.id);
                    }
                    if (isPhoneMode()) {
                        stopIntroAnimation();
                        state.selectedBuildingId = matchedZone.id;
                        state.selectedPlotZoneId = matchedZone.id;
                        showPhonePlotDetails(matchedZone);
                        try {
                            const nextParams = new URLSearchParams(window.location.search);
                            nextParams.delete('dest');
                            const queryStr = nextParams.toString();
                            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + (queryStr ? `?${queryStr}` : '');
                            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
                        } catch (e) { }
                    }
                } else if (bldg) {
                    if (isPhoneMode()) {
                        stopIntroAnimation();
                        state.selectedBuildingId = bldg.id;
                        showPhoneBuildingDetails(bldg.id);
                        try {
                            const nextParams = new URLSearchParams(window.location.search);
                            nextParams.delete('dest');
                            const queryStr = nextParams.toString();
                            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + (queryStr ? `?${queryStr}` : '');
                            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
                        } catch (e) { }
                    } else {
                        navigateTo(bldg.id);
                    }
                }
            }
        }, 150);
    }

    // Always show Welcome / Intro modal first on load, refresh, or QR scan
    setTimeout(showPhoneWelcomeModal, 450);
}

// Initialize mode, gesture, and event listeners
applyAppModeToDOM();
updateSidebarToggleIcon();
window.addEventListener('resize', applyAppModeToDOM);
initPhoneSheetGestures();
initIdleListeners();
initGPSMapListeners();
initWalkerCameraListeners();
initOrbitControl();
initMapSettings();
initDroneCalibration();
handleUrlParameters();

// ============================================================
// Window reflections for inline HTML onclick/oninput handlers
// ============================================================
window.autoExitActiveSession = autoExitActiveSession;
window.triggerAutoExitToIdle = triggerAutoExitToIdle;
window.showAutoExitToast = showAutoExitToast;
window.toggleMapSettingsPanel = toggleMapSettingsPanel;
window.openMapSettingsPanel = openMapSettingsPanel;
window.closeMapSettingsPanel = closeMapSettingsPanel;
window.handleLayerToggle = handleLayerToggle;
window.setLabelDisplayMode = setLabelDisplayMode;
window.setEnvironmentLighting = setEnvironmentLighting;
window.initMapSettings = initMapSettings;
window.initDroneCalibration = initDroneCalibration;
window.toggleDroneCalibrationHUD = toggleDroneCalibrationHUD;
window.applyDroneOffset = applyDroneOffset;
window.saveDroneCalibration = saveDroneCalibration;
window.resetDroneCalibration = resetDroneCalibration;
window.cancelPhoneRoute = cancelPhoneRoute;
window.clearPhoneSearch = clearPhoneSearch;
window.closeBuildingPanel = closeBuildingPanel;
window.closeColorPicker = closeColorPicker;
window.closePhoneArrivalPopup = closePhoneArrivalPopup;
window.closePhotoLightbox = closePhotoLightbox;
window.closeQRZoomModal = closeQRZoomModal;
window.openQRZoomModal = openQRZoomModal;
window.closeRouteAndReset = closeRouteAndReset;
window.collapseSidebarMenu = collapseSidebarMenu;
window.cyclePhoneSheetSnap = cyclePhoneSheetSnap;
window.exitRouteMode = exitRouteMode;
window.filterDirectory = filterDirectory;
window.filterPhoneDirectory = filterPhoneDirectory;
window.flyToView = flyToView;
window.getDirections = getDirections;
window.handleWelcomeContinue = handleWelcomeContinue;
window.handleWelcomeSkip = handleWelcomeSkip;
window.navigateTo = navigateTo;
window.selectStandaloneGate = selectStandaloneGate;
window.recenterOnUserGPS = recenterOnUserGPS;
window.replayFromArrivalPopup = replayFromArrivalPopup;
window.replayPhoneRoute = replayPhoneRoute;
window.replayRoute = replayRoute;
window.resetIdle = resetIdle;
window.resetCameraModeToDefault = resetCameraModeToDefault;
window.saveColorPicker = saveColorPicker;
window.setRouteCameraMode = setRouteCameraMode;
window.updateCameraControlsUI = updateCameraControlsUI;
window.setRouteSpeed = setRouteSpeed;
window.showPhoneDirectoryView = showPhoneDirectoryView;
window.showPhonePlotDetails = showPhonePlotDetails;
window.togglePhoneFilterDropdown = togglePhoneFilterDropdown;
window.closePhoneFilterDropdown = closePhoneFilterDropdown;
window.showPhoneWelcomeModal = showPhoneWelcomeModal;
window.startMobileGPSNavigation = startMobileGPSNavigation;
window.startPhoneAnimatedRoute = startPhoneAnimatedRoute;
window.startPhoneLiveGPS = startPhoneLiveGPS;
window.toggleBoundary = toggleBoundary;
window.toggleBuildings = toggleBuildings;
window.toggleMapboxView = toggleMapboxView;
window.toggleMapLayerMenu = toggleMapLayerMenu;
window.openMapLayerModal = openMapLayerModal;
window.closeMapLayerModal = closeMapLayerModal;
window.closeMapLayerFlyout = closeMapLayerFlyout;
window.selectMapStyle = selectMapStyle;
window.toggleMarkers = toggleMarkers;
window.togglePhoneRouteSheet = togglePhoneRouteSheet;
window.toggleSettingChip = toggleSettingChip;
window.toggleSidebarMenu = toggleSidebarMenu;
window.updateSidebarToggleIcon = updateSidebarToggleIcon;
window.toggleTerrain = toggleTerrain;
window.toggleTrees = toggleTrees;
window.toggleOneFingerOrbitMode = toggleOneFingerOrbitMode;
window.useEyeDropper = useEyeDropper;
window.ensureOcclusionLayers = ensureOcclusionLayers;
window.updateOcclusion = updateOcclusion;
window.resetOcclusion = resetOcclusion;
window.initStationSelector = initStationSelector;
window.toggleStationDropdown = toggleStationDropdown;
window.closeStationDropdown = closeStationDropdown;
window.switchResearchStation = switchResearchStation;
window.state = state;

// Public 3D Map strictly runs in Visitor / Kiosk mode (All internal edits live at /login)
if (typeof document !== 'undefined') {
    state.isAdmin = false;
    state.isKioskDraggable = false;
    document.documentElement.classList.remove('admin-mode');
    document.body.classList.remove('admin-mode');

    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('preview_role') === 'visitor' && sessionStorage.getItem('da_admin_token')) {
            const bar = document.createElement('div');
            bar.id = 'visitor-preview-return-bar';
            bar.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(15,23,42,0.94);backdrop-filter:blur(12px);border:1px solid rgba(168,85,247,0.55);color:#f8fafc;padding:9px 16px;border-radius:999px;display:flex;align-items:center;gap:12px;font-family:Inter,sans-serif;font-size:12.5px;box-shadow:0 12px 32px rgba(0,0,0,0.55);';
            bar.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:999px;background:#14b8a6;"></span><strong>Visitor Preview Mode</strong></span><a href="/login?from_preview=visitor" style="background:linear-gradient(135deg,#a855f7,#7e22ce);color:#fff;text-decoration:none;font-weight:700;padding:5px 12px;border-radius:999px;font-size:11.5px;">Exit Visitor Preview → Return to Super Admin</a>`;
            document.body.appendChild(bar);
        }
    } catch (_) {}
}
