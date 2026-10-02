// DA-LARES Configuration & View Presets

export const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoiZWFydGgwMzA3IiwiYSI6ImNtdWFqNTR5czAxNmEyd29lMm42YjZlMDkifQ.xdPOP5RVPdn6YNka-ZdwoQ';
if (typeof mapboxgl !== 'undefined') {
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
}
export const CENTER = [121.16928638966252, 13.959884572708496];

export const SECTION_COLORS = { 10: '#22c55e', 20: '#3b82f6', 21: '#fbbf24' };
export const SECTION_PASTEL_COLORS = { 10: '#86efac', 20: '#93c5fd', 21: '#fde68a' };
export const MAPBOX_VIEW_PRESET = {
    center: [121.1683, 13.9601],
    zoom: 16.6,
    pitch: 58,
    bearing: -28
};
export const DEFAULT_MAP_VIEW = {
    center: [121.1665, 13.9583],
    zoom: 19.1,
    pitch: 52,
    bearing: 165
};
export const INTRO_START_VIEW = {
    center: [121.1665, 13.9582],
    zoom: 17.2,
    pitch: 0,
    bearing: 0
};
export const INTRO_TARGET_2D_VIEW = {
    center: [121.1665, 13.9582],
    zoom: 19.6,
    pitch: 0,
    bearing: 0
};
export const VIEWS = {
    overview: { center: DEFAULT_MAP_VIEW.center, zoom: DEFAULT_MAP_VIEW.zoom, pitch: DEFAULT_MAP_VIEW.pitch, bearing: DEFAULT_MAP_VIEW.bearing, duration: 2000 },
    closeup: { center: [121.1664, 13.9590], zoom: 19.5, pitch: 65, bearing: -10, duration: 2000 },
    topdown: { center: DEFAULT_MAP_VIEW.center, zoom: DEFAULT_MAP_VIEW.zoom, pitch: 0, bearing: 0, duration: 2000 },
    cinematic: { center: DEFAULT_MAP_VIEW.center, zoom: DEFAULT_MAP_VIEW.zoom, pitch: 70, bearing: -45, duration: 2500 }
};

export const PREDEFINED_ROUTES = {};

export const SAVED_MAIN_KIOSK_COORDS = [121.16646567620313, 13.958189696041458];
export const IDLE_TIMEOUT = 60000; // 60 seconds
