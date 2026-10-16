// DA-LARES Wayfinding — Main Application Orchestration Entry Point
// Native ES Module Application Shell

import { MAPBOX_ACCESS_TOKEN, DEFAULT_MAP_VIEW } from './data/config.js';
import { BUILDING_DIRECTORY } from './data/buildings.js?v=60';
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
    closePhotoLightbox 
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
    initIdleListeners 
} from './idle.js';

import { 
    getMobileNavigationUrl, 
    updateBuildingQR 
} from './qr.js';

import { 
    initOrbitControl, 
    toggleOneFingerOrbitMode 
} from './orbit-control.js';

import { 
    ensureOcclusionLayers, 
    updateOcclusion, 
    resetOcclusion 
} from './occlusion.js';

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

// Global references for pathfinding & entrance points
window.ROAD_NETWORK = null;
window.roadGraph = new Map();
window.BUILDING_ENTRANCES = {};

// Fetch roads.json and build pathfinding graph
fetch('roads.json')
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
                'vacant': 'multi_purpose_administrative_building'
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
        }

        window.roadGraph = buildRoadGraph(data);
        state.roadGraph = window.roadGraph;
        console.log(`Loaded road graph with ${window.roadGraph.size} nodes.`);
    })
    .catch(err => console.error("Could not fetch roads.json", err));

// Fetch colors from backend
fetch('/api/colors')
    .then(res => res.json())
    .then(data => {
        state.savedBuildingColors = data || {};
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
            state.KIOSK_COORDS = data.coordinates;
            window.KIOSK_COORDS = state.KIOSK_COORDS;
            if (state.kioskMarkerInstance) {
                state.kioskMarkerInstance.setLngLat(state.KIOSK_COORDS);
            }
            if (state.mapReady && !state.selectedBuildingId && !state.activeRoute) {
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

// Initial Map load sequence
function initViewportTelemetry() {
    const coordsEl = document.getElementById('coords-text');
    const zoomEl = document.getElementById('zoom-text');
    const fpsEl = document.getElementById('fps-badge');
    if (!map) return;

    let lastPosUpdate = 0;
    const updateCoords = () => {
        const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        if (now - lastPosUpdate < 150) return;
        lastPosUpdate = now;
        const center = map.getCenter();
        const zoom = map.getZoom();
        if (coordsEl) coordsEl.textContent = `${center.lat.toFixed(4)}° N, ${center.lng.toFixed(4)}° E`;
        if (zoomEl) zoomEl.textContent = `Zoom ${zoom.toFixed(1)}`;
    };
    map.on('move', updateCoords);
    updateCoords();

    let frameCount = 0;
    let lastFpsCalc = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    function fpsLoop(now) {
        frameCount++;
        if (now - lastFpsCalc >= 500) {
            const fps = Math.round((frameCount * 1000) / (now - lastFpsCalc));
            frameCount = 0;
            lastFpsCalc = now;
            if (fpsEl) {
                fpsEl.textContent = `${fps} FPS`;
                fpsEl.style.color = fps >= 45 ? '#22c55e' : (fps >= 28 ? '#eab308' : '#ef4444');
            }
        }
        requestAnimationFrame(fpsLoop);
    }
    requestAnimationFrame(fpsLoop);
}

map.on('load', () => {
    setTimeout(() => {
        revealMap();
        ensureOcclusionLayers();
        createKioskMarker();
        buildDirectory();
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
                    (!isNaN(destParam) && BUILDING_DIRECTORY[parseInt(destParam, 10) - 1]?.id === b.id)
                );
                if (bldg) {
                    if (isPhoneMode()) {
                        stopIntroAnimation();
                        state.selectedBuildingId = bldg.id;
                        showPhoneBuildingDetails(bldg.id);
                        try {
                            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
                        } catch (e) {}
                    } else {
                        navigateTo(bldg.id);
                    }
                }
            }
        }, 150);
    }

    // On phone mode: Show Welcome / Onboarding modal if not seen in session
    if (isPhoneMode() && !sessionStorage.getItem('da_lares_welcome_seen')) {
        setTimeout(showPhoneWelcomeModal, 450);
    }
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
handleUrlParameters();

// ============================================================
// Window reflections for inline HTML onclick/oninput handlers
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
window.flyToView = flyToView;
window.getDirections = getDirections;
window.handleWelcomeContinue = handleWelcomeContinue;
window.handleWelcomeSkip = handleWelcomeSkip;
window.navigateTo = navigateTo;
window.recenterOnUserGPS = recenterOnUserGPS;
window.replayFromArrivalPopup = replayFromArrivalPopup;
window.replayPhoneRoute = replayPhoneRoute;
window.replayRoute = replayRoute;
window.resetIdle = resetIdle;
window.resetCameraModeToDefault = resetCameraModeToDefault;
window.saveColorPicker = saveColorPicker;
window.setRouteCameraMode = setRouteCameraMode;
window.setRouteSpeed = setRouteSpeed;
window.showPhoneDirectoryView = showPhoneDirectoryView;
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

// Sync Admin Mode state to DOM
if (typeof document !== 'undefined') {
    document.body.classList.toggle('admin-mode', !!state.isAdmin);
}

// Secret Admin Mode Toggle Shortcut: Alt + Shift + A
window.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        state.isAdmin = !state.isAdmin;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('da_admin_mode', state.isAdmin ? 'true' : 'false');
        }
        document.body.classList.toggle('admin-mode', state.isAdmin);
        buildDirectory();
        createKioskMarker();
        const msg = state.isAdmin 
            ? '🔓 Admin Mode Enabled (Calibration & Customization Unlocked)' 
            : '🔒 Visitor Kiosk Mode (Admin Controls Hidden)';
        console.log(msg);
        alert(msg);
    }
});
