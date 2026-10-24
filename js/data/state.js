// DA-LARES Central State Management
// Holds all shared mutable application state.
// State properties are reflected on window so module-level unqualified reads/writes
// and inline HTML onclick handlers resolve safely without regressions.

import { SAVED_MAIN_KIOSK_COORDS } from './config.js';
import { STATIONS, DEFAULT_STATION_ID } from './stations.js';

const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
const urlViewParam = urlParams.get('view');
const urlAdminParam = urlParams.get('admin');
const urlStationParam = urlParams.get('station');
export const isLegacyMode = false;

function detectInitialStationId() {
    if (typeof window === 'undefined') return DEFAULT_STATION_ID;
    try {
        if (urlStationParam && STATIONS[urlStationParam]) {
            return urlStationParam;
        }
    } catch (e) {}
    // Kiosk ALWAYS loads at DA-LARES first
    return DEFAULT_STATION_ID;
}

const initialStationId = detectInitialStationId();

export const state = {
    // Current Active Research Station
    currentStationId: initialStationId,

    // Mode & Orientation
    appMode: 'kiosk',
    kioskOrientation: 'landscape',
    isAdmin: (urlAdminParam === '1' || urlAdminParam === 'true' || (typeof localStorage !== 'undefined' && localStorage.getItem('da_admin_mode') === 'true')),
    isLegacyMode: false,

    // Map & Style
    map: null,
    mapReady: false,
    isIntroAnimating: true,
    currentMapStyleMode: (urlViewParam === 'mapbox') ? 'mapbox' : 'google',
    treesVisible: true,
    buildingsVisible: true,
    terrainEnabled: false,
    currentLighting: 'day',
    lightingMode: 'auto',
    labelDisplayMode: 'full',
    isMapSettingsOpen: false,
    markersVisible: true,
    boundaryVisible: true,
    droneOffset: { dx: 0, dy: 0, autoApply: true },
    savedDroneOffset: { dx: 0, dy: 0 },
    gmapsOverlayOpacity: 0.0,

    // Markers & Overlays
    markers: [],
    sectionBadges: [],
    entranceArrowMarker: null,
    kioskMarkerInstance: null,
    qaresKioskMarkerInstance: null,
    isKioskDraggable: false,
    KIOSK_COORDS: [...SAVED_MAIN_KIOSK_COORDS],
    QARES_KIOSK_COORDS: [121.3713315, 13.9432268],

    // Building Selection & Customization
    selectedBuildingId: null,
    activeSearchedOffice: '',
    savedBuildingColors: {},
    activeColorId: null,

    // Routing & Pathfinding
    roadGraph: null,
    roadNodes: null,
    activeRoute: null,
    routeAnimFrame: null,
    activeRouteCoords: null,
    activeFullRouteCoords: null,
    currentRouteSteps: [],
    currentRouteDestName: '',
    lastActiveStepIdx: -1,
    routeSpeedMultiplier: 2,

    // Walker & Camera Follow
    walkerMarkerInstance: null,
    destinationMarkerInstance: null,
    walkAnimFrame: null,
    walkStartTimer: null,
    celebrationTimer: null,
    currentWalkerCoord: null,
    routeCameraMode: 'follow',
    isFollowing: true,
    routeCameraPerspective: 'follow',
    isTransitioningToFollow: false,
    cameraTransition: null,
    transitionFollowTimer: null,
    cameraControlsDimTimer: null,
    currentRouteSpeed: 2,
    arrivedCountdownTimer: null,
    arrivedCountdownRemaining: 15,

    // Idle & Screensaver
    idleTimer: null,
    idleRotating: false,
    orbitAnimFrame: null,
    isOrbiting: false,
    orbitTimeout: null,

    // Mobile Phone UI & Bottom Sheet
    phoneSheetCurrentSnap: 'peek',
    phoneSheetCurrentView: 'dir',
    activeTouchCount: 0,
    PUBLIC_TUNNEL_URL: null,

    // Mobile GPS & Orientation
    isMobileGPSActive: false,
    userGPSMarker: null,
    userGPSAccuracyCircle: null,
    gpsAccuracyCircle: null,
    gpsWatchId: null,
    lastKnownGPSCoords: null,
    isUserFollowingGPS: true,
    offRouteCounter: 0,
    lastRecalcTime: 0,
    markerCurrentLngLat: null,
    markerAnimFrame: null,
    smoothedCompassHeading: null,
    headingAnimFrame: null,
    autoRecenterTimer: null,
    lastTrimmedCoord: null,
    isFirstPhoneOrientation: true,
    hasPromptedPhoneCompass: false,
    compassPermissionGranted: false,
    compassListenersBound: false,
};

// Mirror state properties onto window so legacy/unqualified lookups bind seamlessly
if (typeof window !== 'undefined') {
    window.DA_LARES_STATE = state;
    window.state = state;
    for (const key of Object.keys(state)) {
        if (!(key in window)) {
            Object.defineProperty(window, key, {
                get() { return state[key]; },
                set(v) { state[key] = v; },
                configurable: true,
                enumerable: true
            });
        }
    }
}
