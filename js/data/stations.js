// DA-CALABARZON Regional Research Stations Registry
export const DEFAULT_FILTER_TYPES = [
    { id: 'infrastructure', name: 'Agri Infrastructure / Facilities', defaultDesc: 'Warehouse, screenhouse, nursery, water tank, motorpool' },
    { id: 'trial_sites', name: 'Agricultural Test / Trial Sites', defaultDesc: 'Field crop variety trials, root crops, corn & vegetables' },
    { id: 'orchard', name: 'Orchard', defaultDesc: 'Citrus, mango, pomelo, makapuno & cacao groves' },
    { id: 'office', name: 'Office Buildings', defaultDesc: 'Administrative, division & regional program offices' },
    { id: 'laboratory', name: 'Laboratories', defaultDesc: 'Soils, tissue culture, post-harvest & crop protection labs' },
    { id: 'conference', name: 'Conference Hall', defaultDesc: 'Training centers, auditoriums & conference halls' },
    { id: 'digital_agri', name: 'Digital Agriculture Project', defaultDesc: 'Automated Weather Station (AWS) & smart agri sensors' }
];

export const STATIONS = {
    lares: {
        id: 'lares',
        name: 'DA-LARES',
        label: 'DA-LARES (Lipa)',
        sub: 'Lipa Agricultural Research and Experiment Station',
        fullName: 'Lipa Agricultural Research and Experiment Station',
        province: 'Lipa City, Batangas',
        status: 'active',
        icon: '🌾',
        welcomeTags: ['50 3D Buildings', '45 Field Plots', 'Live Wayfinding'],
        quickTags: [
            { label: 'MIS / RAFIS', query: 'MIS' },
            { label: 'Admin', query: 'Admin' },
            { label: 'Tanco Hall', query: 'Tanco' },
            { label: 'Canteen', query: 'Canteen' },
            { label: 'Soils Lab', query: 'RSL' }
        ],
        filterDescriptions: {
            office: 'Tanco Hall, Admin, ORED, LARES, RAED, AMAD, etc.',
            laboratory: 'Soils, Tissue Culture, Post-Harvest, RCPC, PGRC, ILD',
            conference: 'Argosino Hall, ORED, and R&D Conference Halls'
        },
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
        sub: 'Quezon Agricultural Research and Experiment Station',
        fullName: 'Quezon Agricultural Research and Experiment Station',
        province: 'Tiaong, Quezon',
        status: 'under_development',
        icon: '🌱',
        welcomeTags: ['48 3D Buildings', 'Drone Orthomosaic', 'Road Network'],
        quickTags: [],
        center: [121.37130, 13.94360],
        zoom: 19.0,
        pitch: 52,
        bearing: 25,
        introStartZoom: 17.2,
        introTarget2DZoom: 19.6,
        bounds: [
            [121.30, 13.88],
            [121.44, 14.00]
        ],
        kioskCoords: [121.3713315, 13.9432268],
        buildingsFile: 'qares_buildings.json',
        roadsFile: 'qares_roads.json',
        hasDrone: true
    },
    rares: {
        id: 'rares',
        name: 'DA-RARES',
        label: 'DA-RARES (Tanay)',
        sub: 'Rizal Agricultural Research and Experiment Station',
        fullName: 'Rizal Agricultural Research and Experiment Station',
        province: 'Tanay, Rizal',
        status: 'under_development',
        icon: '🌿',
        welcomeTags: ['50 3D Buildings', '28 Field Plots', 'Road Network'],
        quickTags: [],
        center: [121.33930, 14.57500],
        zoom: 18.5,
        pitch: 50,
        bearing: 0,
        introStartZoom: 16.5,
        introTarget2DZoom: 18.8,
        bounds: [
            [121.330, 14.565],
            [121.350, 14.585]
        ],
        kioskCoords: [121.34000, 14.57550],
        boundaryFile: 'rares_boundary.json',
        plotsFile: 'rares_plots.json',
        roadsFile: 'rares_roads.json',
        buildingsFile: 'rares_buildings.json',
        hasDrone: true
    },
    cares: {
        id: 'cares',
        name: 'DA-CARES',
        label: 'DA-CARES (Naic)',
        sub: 'Cavite Agricultural Research and Experiment Station',
        fullName: 'Cavite Agricultural Research and Experiment Station',
        province: 'Naic, Cavite',
        status: 'under_development',
        icon: '🍃',
        welcomeTags: ['Upcoming Survey', '3D Campus Map', 'In Progress'],
        quickTags: [],
        center: [120.7925, 14.2965],
        zoom: 18.5,
        pitch: 50,
        bearing: 0,
        bounds: [
            [120.72, 14.22],
            [120.86, 14.37]
        ]
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
            || station.center
            || station.kioskCoords;
        return {
            center: center,
            zoom: station.zoom || 19.0,
            pitch: station.pitch !== undefined ? station.pitch : 52,
            bearing: station.bearing !== undefined ? station.bearing : 25
        };
    }

    if (stationId === 'rares') {
        const center = (typeof window !== 'undefined' && (window.RARES_KIOSK_COORDS || (window.state && window.state.RARES_KIOSK_COORDS)))
            || station.center
            || station.kioskCoords;
        return {
            center: center,
            zoom: station.zoom || 18.5,
            pitch: station.pitch !== undefined ? station.pitch : 50,
            bearing: station.bearing !== undefined ? station.bearing : 0
        };
    }

    const center = (typeof window !== 'undefined' && (window.KIOSK_COORDS || (window.state && window.state.KIOSK_COORDS)))
        || station.center
        || station.kioskCoords;
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
