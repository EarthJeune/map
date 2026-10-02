// DA-LARES Central State Management
// Holds all shared mutable application state.
// State properties are reflected on window so module-level unqualified reads/writes
// and inline HTML onclick handlers resolve safely without regressions.

import { SAVED_MAIN_KIOSK_COORDS } from './config.js';

const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
const urlViewParam = urlParams.get('view');

export const state = {
    // Mode & Orientation
    appMode: 'kiosk',
    kioskOrientation: 'landscape',

    // Map & Style
    map: null,
    mapReady: false,
    isIntroAnimating: true,
    currentMapStyleMode: (urlViewParam === 'mapbox') ? 'mapbox' : 'google',
    treesVisible: true,
    buildingsVisible: true,
    terrainEnabled: false,
    currentLighting: 'day',
    markersVisible: true,

    // Markers & Overlays
    markers: [],
    sectionBadges: [],
    entranceArrowMarker: null,
    kioskMarkerInstance: null,
    isKioskDraggable: false,
    KIOSK_COORDS: [...SAVED_MAIN_KIOSK_COORDS],

    // Building Selection & Customization
    selectedBuildingId: null,
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
    currentWalkerCoord: null,
    routeCameraMode: 'follow-heading',
    isTransitioningToFollow: false,
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
    PUBLIC_TUNNEL_URL: 'https://studio-comprehensive-mariah-styles.trycloudflare.com',

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
