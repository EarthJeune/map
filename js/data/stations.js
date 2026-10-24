// DA-CALABARZON Regional Research Stations Registry
export const STATIONS = {
    lares: {
        id: 'lares',
        name: 'DA-LARES',
        label: 'DA-LARES (Lipa)',
        sub: 'Interactive Wayfinding Map',
        fullName: 'Southern Tagalog Integrated Agricultural Research Center',
        province: 'Lipa City, Batangas',
        icon: '🌾',
        center: [121.1665, 13.9583],
        zoom: 19.1,
        pitch: 52,
        bearing: 165,
        introStartZoom: 17.2,
        introTarget2DZoom: 19.6,
        bounds: [
            [121.155, 13.948],
            [121.185, 13.972]
        ],
        kioskCoords: [121.16584852, 13.95828551],
        buildingsFile: 'buildings.json',
        roadsFile: 'roads.json',
        hasDrone: true
    },
    qares: {
        id: 'qares',
        name: 'DA-QARES',
        label: 'DA-QARES (Tiaong)',
        sub: 'Quezon Agricultural Research & Experiment Station',
        fullName: 'Quezon Agricultural Research and Experiment Station',
        province: 'Tiaong, Quezon',
        icon: '🌱',
        center: [121.37133, 13.94323],
        zoom: 17.6,
        pitch: 45,
        bearing: -15,
        introStartZoom: 15.6,
        introTarget2DZoom: 18.2,
        bounds: [
            [121.355, 13.935],
            [121.385, 13.960]
        ],
        kioskCoords: [121.3713315, 13.9432268],
        buildingsFile: 'qares_buildings.json',
        roadsFile: 'qares_roads.json',
        hasDrone: true
    }
};

export const DEFAULT_STATION_ID = 'lares';

export function getActiveStationDefaultView(targetStationId) {
    let stationId = targetStationId;
    if (!stationId && typeof window !== 'undefined') {
        stationId = (window.state && window.state.currentStationId) || window.currentStationId || DEFAULT_STATION_ID;
    }
    if (!stationId) stationId = DEFAULT_STATION_ID;

    const station = STATIONS[stationId] || STATIONS.lares;
    if (stationId === 'qares') {
        const center = (typeof window !== 'undefined' && (window.QARES_KIOSK_COORDS || (window.state && window.state.QARES_KIOSK_COORDS)))
            || station.kioskCoords 
            || station.center;
        return {
            center: center,
            zoom: station.zoom || 17.6,
            pitch: station.pitch !== undefined ? station.pitch : 45,
            bearing: station.bearing !== undefined ? station.bearing : -15
        };
    }

    const center = (typeof window !== 'undefined' && (window.KIOSK_COORDS || (window.state && window.state.KIOSK_COORDS)))
        || station.kioskCoords 
        || station.center;
    return {
        center: center,
        zoom: station.zoom || 19.1,
        pitch: station.pitch !== undefined ? station.pitch : 52,
        bearing: station.bearing !== undefined ? station.bearing : 165
    };
}

export function getStationIntroViews(targetStationId) {
    let stationId = targetStationId;
    if (!stationId && typeof window !== 'undefined') {
        stationId = (window.state && window.state.currentStationId) || window.currentStationId || DEFAULT_STATION_ID;
    }
    if (!stationId) stationId = DEFAULT_STATION_ID;

    const station = STATIONS[stationId] || STATIONS.lares;
    const defaultView = getActiveStationDefaultView(stationId);
    const center = defaultView.center;
    const finalZoom = defaultView.zoom;
    const finalPitch = defaultView.pitch;
    const finalBearing = defaultView.bearing;

    // Start 2D zoom: high altitude top-down view (defaults to finalZoom - 1.9, clamped >= 14.0)
    const startZoom = (station.introStartZoom !== undefined) 
        ? station.introStartZoom 
        : Math.max(14.0, finalZoom - 1.9);

    // Target 2D zoom: close-up top-down view directly over the You Are Here pin before 3D tilt
    const target2DZoom = (station.introTarget2DZoom !== undefined)
        ? station.introTarget2DZoom
        : Math.min(20.0, finalZoom + 0.5);

    return {
        start: {
            center: center,
            zoom: startZoom,
            pitch: 0,
            bearing: 0
        },
        target2D: {
            center: center,
            zoom: target2DZoom,
            pitch: 0,
            bearing: 0
        },
        final3D: {
            center: center,
            zoom: finalZoom,
            pitch: finalPitch,
            bearing: finalBearing
        },
        bounds: station.bounds
    };
}

if (typeof window !== 'undefined') {
    window.STATIONS = STATIONS;
    window.getActiveStationDefaultView = getActiveStationDefaultView;
    window.getStationIntroViews = getStationIntroViews;
}
