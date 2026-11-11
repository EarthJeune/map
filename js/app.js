// DA-LARES Wayfinding — Main Application Orchestration Entry Point
// Native ES Module Application Shell

import { MAPBOX_ACCESS_TOKEN, DEFAULT_MAP_VIEW, SAVED_MAIN_KIOSK_COORDS } from './data/config.js';
import { BUILDING_DIRECTORY, DEFAULT_BUILDING_COLORS } from './data/buildings.js';
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
            if (!isAnyAnimationActive && (Date.now() - lastActivityTimestamp > 2000)) {
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

// Sync Admin Mode state to DOM
if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('admin-mode', !!state.isAdmin);
    document.body.classList.toggle('admin-mode', !!state.isAdmin);
}

// Secret Admin Mode Toggle Shortcut: Alt + Shift + A
window.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        state.isAdmin = !state.isAdmin;
        state.isKioskDraggable = state.isAdmin;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('da_admin_mode', state.isAdmin ? 'true' : 'false');
        }
        document.documentElement.classList.toggle('admin-mode', state.isAdmin);
        document.body.classList.toggle('admin-mode', state.isAdmin);
        if (typeof window.syncAdminDroneDOM === 'function') {
            window.syncAdminDroneDOM();
        }
        if (state.currentStationId === 'lares') {
            buildDirectory();
        } else if (state.currentStationId === 'qares') {
            if (typeof window.renderQARESDirectory === 'function' && window.qaresBuildingsBaseline) {
                window.renderQARESDirectory(window.qaresBuildingsBaseline);
            }
        } else if (state.currentStationId === 'rares') {
            if (typeof window.renderRARESDirectory === 'function') {
                window.renderRARESDirectory();
            }
        }
        createKioskMarker();
        const activeStationLabel = (state.currentStationId === 'qares') ? 'DA-QARES (Tiaong)' : (state.currentStationId === 'rares') ? 'DA-RARES (Tanay)' : 'DA-LARES (Lipa)';
        const msg = state.isAdmin
            ? `🔓 Admin Mode Enabled (${activeStationLabel})\n\n• Kiosk Pin Calibration: Drag the "You Are Here" pin or Alt + Click anywhere on the map to place it\n• Drone Calibration: Click 🛰️ in the top-right toolbar or press Alt + Shift + D`
            : '🔒 Visitor Kiosk Mode (Admin Controls Hidden)';
        console.log(msg);
        alert(msg);
    }
});

// Admin Mode Quick Pin Placement: Alt + Click anywhere on the map to relocate the active station's Kiosk Pin
if (map) {
    map.on('click', (e) => {
        if (state.isAdmin && e.originalEvent && e.originalEvent.altKey) {
            e.preventDefault();
            const newCoords = [e.lngLat.lng, e.lngLat.lat];
            if (typeof window.repositionActiveKioskPin === 'function') {
                window.repositionActiveKioskPin(newCoords);
            }
        }
    });
}
