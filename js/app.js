// DA-LARES Wayfinding — Main Application Orchestration Entry Point
// Native ES Module Application Shell

import { MAPBOX_ACCESS_TOKEN, DEFAULT_MAP_VIEW } from './data/config.js';
import { BUILDING_DIRECTORY } from './data/buildings.js';
import { state } from './data/state.js';
import { createMarkers, removeMarkers } from './markers.js';
import { 
    map, 
    revealMap, 
    syncLightingWithTime, 
    getRoofColorCaseStyle,
    toggleBuildings,
    toggleTrees,
    toggleMapboxView,
    toggleBoundary,
    toggleTerrain,
    toggleMarkers,
    flyToView
} from './map-setup.js';

import { 
    buildDirectory, 
    filterDirectory, 
    toggleSidebarMenu, 
    collapseSidebarMenu, 
    toggleSettingChip 
} from './sidebar.js';

import { 
    navigateTo, 
    setRouteSpeed, 
    setRouteCameraMode, 
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

        BUILDING_DIRECTORY.forEach(b => {
            if (state.savedBuildingColors[b.id] && state.savedBuildingColors[b.id].icon) {
                b.color = state.savedBuildingColors[b.id].icon;
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
map.on('load', () => {
    setTimeout(() => {
        revealMap();
        createKioskMarker();
        buildDirectory();
        resetIdle();
        syncLightingWithTime();
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
                const bldg = BUILDING_DIRECTORY.find(b => b.id.toLowerCase() === destParam.toLowerCase());
                if (bldg) {
                    if (isPhoneMode()) {
                        state.isIntroAnimating = false;
                        map.stop();
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
        }, 250);
    }

    // On phone mode: Show Welcome / Onboarding modal if not seen in session
    if (isPhoneMode() && !sessionStorage.getItem('da_lares_welcome_seen')) {
        setTimeout(showPhoneWelcomeModal, 450);
    }
}

// Initialize mode, gesture, and event listeners
applyAppModeToDOM();
window.addEventListener('resize', applyAppModeToDOM);
initPhoneSheetGestures();
initIdleListeners();
initGPSMapListeners();
initWalkerCameraListeners();
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
window.toggleMarkers = toggleMarkers;
window.togglePhoneRouteSheet = togglePhoneRouteSheet;
window.toggleSettingChip = toggleSettingChip;
window.toggleSidebarMenu = toggleSidebarMenu;
window.toggleTerrain = toggleTerrain;
window.toggleTrees = toggleTrees;
window.useEyeDropper = useEyeDropper;

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
