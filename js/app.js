// DA-LARES Wayfinding — Main Application Orchestration Entry Point
// Native ES Module Application Shell

import { MAPBOX_ACCESS_TOKEN, DEFAULT_MAP_VIEW, SAVED_MAIN_KIOSK_COORDS } from './data/config.js';
import { BUILDING_DIRECTORY, DEFAULT_BUILDING_COLORS } from './data/buildings.js';
import { STATIONS } from './data/stations.js';
import { BUILDING_OFFICES, OFFICE_SEARCH_ALIASES } from './data/offices.js';
import { BUILDING_WAYFINDING_INFO } from './data/descriptions.js';
import { FIELD_COMMODITY_ZONES } from './data/plots.js';
import { state } from './data/state.js';
import { createMarkers, removeMarkers } from './markers.js';
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
            window.BUILDING_ENTRANCES['gate_main_entrance'] = [[121.165745, 13.958316]];
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

// Hydrate live station, building, office, photo, and agronomic plot records from 10-table MySQL database
export function syncDatabaseBootstrap(stationId = 'lares') {
    return fetch(`/api/bootstrap?station=${encodeURIComponent(stationId)}&_t=${Date.now()}`)
        .then(res => res.ok ? res.json() : null)
        .catch(() => null)
        .then(boot => {
            if (!boot || boot.error) return;

            // 1. Sync all 4 stations status, subtitles, UI metadata, and "You Are Here" pins
            if (Array.isArray(boot.allStations)) {
                const parseJsonMeta = (val, fallback) => {
                    if (!val) return fallback;
                    if (typeof val === 'object') return val;
                    try { return JSON.parse(val); } catch (e) { return fallback; }
                };
                boot.allStations.forEach(st => {
                    if (STATIONS[st.station_id]) {
                        if (st.name) STATIONS[st.station_id].name = st.name;
                        STATIONS[st.station_id].label = st.label || STATIONS[st.station_id].label;
                        STATIONS[st.station_id].sub = st.subtitle || STATIONS[st.station_id].sub;
                        STATIONS[st.station_id].fullName = st.full_name || STATIONS[st.station_id].fullName || STATIONS[st.station_id].sub;
                        STATIONS[st.station_id].province = st.province || STATIONS[st.station_id].province;
                        STATIONS[st.station_id].status = st.status === 'live' ? 'active' : 'under_development';

                        const parsedWelcome = parseJsonMeta(st.welcome_tags, null);
                        if (Array.isArray(parsedWelcome) && parsedWelcome.length > 0) {
                            STATIONS[st.station_id].welcomeTags = parsedWelcome;
                        }
                        const parsedQuick = parseJsonMeta(st.quick_tags, null);
                        if (Array.isArray(parsedQuick)) {
                            STATIONS[st.station_id].quickTags = parsedQuick;
                        }
                        const parsedFilterDesc = parseJsonMeta(st.filter_descriptions, null);
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

            // 2. Sync buildings, descriptions, multi-photos, and offices
            if (Array.isArray(boot.buildings)) {
                // Also sync RARES/QARES baseline GeoJSON features if loaded
                const stationBaseline = stationId === 'rares'
                    ? window.raresBuildingsBaseline
                    : (stationId === 'qares' ? window.qaresBuildingsBaseline : null);
                const baselineMap = new Map();
                if (stationBaseline && Array.isArray(stationBaseline.features)) {
                    stationBaseline.features.forEach(f => {
                        if (f.properties && f.properties.id) baselineMap.set(f.properties.id, f.properties);
                    });
                }

                boot.buildings.forEach(dbBldg => {
                    const bProp = baselineMap.get(dbBldg.building_code);
                    if (bProp) {
                        if (dbBldg.name) bProp.name = dbBldg.name;
                        if (dbBldg.description !== undefined && dbBldg.description !== null) bProp.description = dbBldg.description;
                        if (dbBldg.category) bProp.category = dbBldg.category;
                        if (dbBldg.type_label) bProp.type = dbBldg.type_label;
                        if (dbBldg.pin_color) bProp.color = dbBldg.pin_color;
                        if (dbBldg.icon) bProp.icon = dbBldg.icon;
                        if (Array.isArray(dbBldg.images) && dbBldg.images.length > 0) {
                            bProp.image = dbBldg.images[0].image_webp_url;
                            bProp.images = dbBldg.images.map(img => ({
                                src: img.image_webp_url,
                                label: img.caption || 'Facility View'
                            }));
                        }
                    }

                    const target = BUILDING_DIRECTORY.find(b => b.id === dbBldg.building_code);
                    if (target) {
                        if (dbBldg.name) target.name = dbBldg.name;
                        if (dbBldg.building_num !== undefined) target.num = dbBldg.building_num;
                        if (dbBldg.category) target.category = dbBldg.category;
                        if (dbBldg.type_label) target.type = dbBldg.type_label;
                        if (dbBldg.description !== undefined && dbBldg.description !== null) target.desc = dbBldg.description;
                        if (dbBldg.pin_color) target.color = dbBldg.pin_color;
                        if (dbBldg.icon) target.icon = dbBldg.icon;
                        if (dbBldg.compact_tag !== undefined) target.compactTag = dbBldg.compact_tag || '';
                        if (dbBldg.visual_landmark !== undefined) target.visualLandmark = dbBldg.visual_landmark || '';
                        if (dbBldg.key_services !== undefined) target.keyServices = dbBldg.key_services || '';
                        if (Array.isArray(dbBldg.images) && dbBldg.images.length > 0) {
                            target.image = dbBldg.images[0].image_webp_url;
                            target.images = dbBldg.images.map(img => ({
                                src: img.image_webp_url,
                                label: img.caption || 'Facility View'
                            }));
                        }
                    }

                    // Sync wayfinding info
                    if (dbBldg.visual_landmark || dbBldg.key_services || dbBldg.compact_tag) {
                        BUILDING_WAYFINDING_INFO[dbBldg.building_code] = {
                            ...(BUILDING_WAYFINDING_INFO[dbBldg.building_code] || {}),
                            compactTag: dbBldg.compact_tag || (BUILDING_WAYFINDING_INFO[dbBldg.building_code]?.compactTag) || '',
                            visualLandmark: dbBldg.visual_landmark || (BUILDING_WAYFINDING_INFO[dbBldg.building_code]?.visualLandmark) || '',
                            keyServices: dbBldg.key_services || (BUILDING_WAYFINDING_INFO[dbBldg.building_code]?.keyServices) || ''
                        };
                    }

                    // Sync offices & search aliases (supports 0, 1, or multiple offices with floor grouping)
                    if (Array.isArray(dbBldg.offices)) {
                        dbBldg.offices.forEach(o => {
                            if (o.office_name && o.search_aliases) {
                                const parsedAliases = Array.isArray(o.search_aliases)
                                    ? o.search_aliases
                                    : String(o.search_aliases).split(',').map(s => s.trim()).filter(Boolean);
                                if (parsedAliases.length > 0) {
                                    OFFICE_SEARCH_ALIASES[o.office_name] = parsedAliases;
                                }
                            }
                        });
                        if (dbBldg.offices.length === 0) {
                            delete BUILDING_OFFICES[dbBldg.building_code];
                        } else {
                            const hasFloors = dbBldg.offices.some(o => o.floor_or_room);
                            if (hasFloors) {
                                const floorGroups = {};
                                dbBldg.offices.forEach(o => {
                                    const fl = o.floor_or_room || 'General';
                                    if (!floorGroups[fl]) floorGroups[fl] = [];
                                    floorGroups[fl].push(o.office_name);
                                });
                                BUILDING_OFFICES[dbBldg.building_code] = Object.entries(floorGroups).map(([floor, offices]) => ({ floor, offices }));
                            } else {
                                BUILDING_OFFICES[dbBldg.building_code] = dbBldg.offices.map(o => o.office_name);
                            }
                        }
                    }
                });
                if (stationId === 'rares' && typeof window.renderRARESDirectory === 'function') {
                    window.renderRARESDirectory(window.raresBuildingsBaseline);
                    if (typeof window.createMarkers === 'function') window.createMarkers();
                } else if (stationId === 'qares' && typeof window.renderQARESDirectory === 'function') {
                    window.renderQARESDirectory(window.qaresBuildingsBaseline);
                    if (typeof window.createMarkers === 'function') window.createMarkers();
                }
            }

            // 3. Sync agricultural plots & agronomic records
            if (Array.isArray(boot.plots)) {
                boot.plots.forEach(dbPlot => {
                    const targetZone = FIELD_COMMODITY_ZONES.find(z => z.id === dbPlot.plot_code);
                    if (targetZone) {
                        if (dbPlot.zone_name) targetZone.name = dbPlot.zone_name;
                        if (dbPlot.plot_number) targetZone.plotRange = dbPlot.plot_number;
                        if (dbPlot.category) targetZone.category = dbPlot.category;
                        if (dbPlot.icon) targetZone.icon = dbPlot.icon;
                        if (dbPlot.color) targetZone.color = dbPlot.color;
                        if (dbPlot.description !== undefined && dbPlot.description !== null) targetZone.description = dbPlot.description;
                        if (dbPlot.image_webp_url) targetZone.image = dbPlot.image_webp_url;
                        targetZone.currentCrop = dbPlot.current_crop || null;
                        targetZone.treeCount = dbPlot.tree_or_plant_count;
                        targetZone.croppingCycle = dbPlot.cropping_cycle || 'perennial';
                        targetZone.cycleMonths = dbPlot.cycle_months || null;
                        targetZone.areaHectares = dbPlot.area_hectares || null;
                        targetZone.status = dbPlot.status || 'Active';
                    }
                });
            }

            if (state.currentStationId === 'lares') {
                // Re-run filterDirectory so active search bar queries immediately reflect MySQL updates
                if (typeof filterDirectory === 'function') {
                    filterDirectory();
                } else {
                    buildDirectory();
                }
                if (typeof renderPhoneDirectory === 'function') {
                    const phoneQuery = document.getElementById('phone-search-input')?.value || '';
                    renderPhoneDirectory(phoneQuery);
                }
                if (state.mapReady) {
                    removeMarkers();
                    createMarkers();
                }
            }
        });
}

// Initial database bootstrap on startup
syncDatabaseBootstrap('lares');

// Live Cross-Tab Sync: Whenever Admin saves changes in /admin, automatically refresh map, search, and directory
if (typeof window !== 'undefined') {
    window.syncDatabaseBootstrap = syncDatabaseBootstrap;
    window.addEventListener('storage', (e) => {
        if (e.key === 'da_db_sync_ts') {
            syncDatabaseBootstrap(state.currentStationId || 'lares');
        }
    });
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const syncChannel = new BroadcastChannel('da_spatial_hub_sync');
            syncChannel.onmessage = (ev) => {
                if (ev.data && ev.data.type === 'db_updated') {
                    syncDatabaseBootstrap(state.currentStationId || 'lares');
                }
            };
        } catch (e) {}
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
                const bldg = BUILDING_DIRECTORY.find(b =>
                    b.id.toLowerCase() === destParam.toLowerCase() ||
                    b.id.toLowerCase().includes(destParam.toLowerCase()) ||
                    (!isNaN(destParam) && (b.num === parseInt(destParam, 10) || BUILDING_DIRECTORY[parseInt(destParam, 10) - 1]?.id === b.id))
                );
                if (bldg) {
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

// Public 3D Map strictly runs in Visitor / Kiosk mode (All Admin CRUD & Pin Calibration live at /admin)
if (typeof document !== 'undefined') {
    state.isAdmin = false;
    state.isKioskDraggable = false;
    document.documentElement.classList.remove('admin-mode');
    document.body.classList.remove('admin-mode');
}
