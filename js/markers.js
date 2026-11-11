// DA-LARES Markers Module

// Google Maps-style numbered pins, section badges, and compound entrance arrow.



import { BUILDING_DIRECTORY, DEFAULT_BUILDING_COLORS } from './data/buildings.js';

import { state } from './data/state.js';



export function renderSectionBadges() {

    removeSectionBadges();

    // Section 1-3 badges permanently removed per unified single compound boundary

}



export function removeSectionBadges() {

    if (state.sectionBadges) {

        state.sectionBadges.forEach(m => m.remove());

    }

    state.sectionBadges = [];

}



export function createEntranceArrowMarker() {

    if (state.entranceArrowMarker) {

        state.entranceArrowMarker.remove();

        state.entranceArrowMarker = null;

    }

    // Only render LARES entrance arrow if current station is LARES

    if (state.currentStationId && state.currentStationId !== 'lares') {

        return;

    }

    const el = document.createElement('div');

    el.className = 'entrance-arrow-marker';

    el.innerHTML = `

        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">

            <line x1="12" y1="19" x2="12" y2="5"></line>

            <polyline points="5 12 12 5 19 12"></polyline>

        </svg>

    `;

    state.entranceArrowMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })

        .setLngLat([121.16584, 13.95912])

        .addTo(state.map);

}



let lastZoomedOutState = null;

let virtualizeRafId = null;



export function virtualizeMarkers() {

    if (!state.map || !state.markers || state.markers.length === 0) return;

    if (state.markersVisible === false) {

        if (typeof document !== 'undefined' && document.body) {
            document.body.classList.add('labels-hidden');
        }

        state.markers.forEach(m => {

            const el = m.getElement();

            if (el) el.style.setProperty('display', 'none', 'important');

        });

        return;

    }

    if (typeof document !== 'undefined' && document.body) {
        document.body.classList.remove('labels-hidden');
    }



    const bounds = state.map.getBounds();

    if (!bounds) return;



    // Buffer visible bounds by 12% to prevent pop-in at screen edges

    const lngSpan = bounds.getEast() - bounds.getWest();

    const latSpan = bounds.getNorth() - bounds.getSouth();

    const bufLng = Math.abs(lngSpan) * 0.12;

    const bufLat = Math.abs(latSpan) * 0.12;

    const minLng = bounds.getWest() - bufLng;

    const maxLng = bounds.getEast() + bufLng;

    const minLat = bounds.getSouth() - bufLat;

    const maxLat = bounds.getNorth() + bufLat;



    state.markers.forEach(m => {

        const el = m.getElement();

        if (!el) return;



        // Keep active destination/route highlights visible

        if (el.classList.contains('decluttered-highlight') || el.classList.contains('decluttered-dest')) {

            if (el.style.display !== '') {
                el.style.removeProperty('display');
                el.style.display = '';
            }

            return;

        }

        if (el.classList.contains('decluttered-hide')) {

            if (el.style.display !== 'none') el.style.setProperty('display', 'none', 'important');

            return;

        }



        const lngLat = m.getLngLat();

        const inFrustum = (

            lngLat.lng >= minLng && lngLat.lng <= maxLng &&

            lngLat.lat >= minLat && lngLat.lat <= maxLat

        );



        if (inFrustum) {

            if (el.style.display === 'none') {
                el.style.removeProperty('display');
                el.style.display = '';
            }

        } else {

            if (el.style.display !== 'none') el.style.setProperty('display', 'none', 'important');

        }

    });

}



let lastVirtualizeTime = 0;

export function scheduleVirtualizeMarkers() {
    // Skip expensive bounds virtualization during stationary setBearing orbits
    if (state.isOrbiting || state.idleRotating) return;

    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    if (now - lastVirtualizeTime < 180) return;

    if (virtualizeRafId) return;
    virtualizeRafId = requestAnimationFrame(() => {
        virtualizeRafId = null;
        lastVirtualizeTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
        virtualizeMarkers();
    });
}

export function updateMarkerZoomState() {
    if (!state.map) return;
    const z = state.map.getZoom();
    const isZoomedOut = z < 17.8;
    if (isZoomedOut !== lastZoomedOutState) {
        lastZoomedOutState = isZoomedOut;

        const container = state.map.getContainer();
        if (container) {
            container.classList.toggle('map-zoomed-out', isZoomedOut);
        }
        if (document.body) {
            document.body.classList.toggle('map-zoomed-out', isZoomedOut);
        }
    }
    scheduleVirtualizeMarkers();
}

let isVirtualizeListenerBound = false;
function bindMarkerVirtualizationListener() {
    if (isVirtualizeListenerBound || !state.map) return;
    state.map.on('move', scheduleVirtualizeMarkers);
    state.map.on('moveend', () => {
        lastVirtualizeTime = 0;
        scheduleVirtualizeMarkers();
    });
    isVirtualizeListenerBound = true;
}





export function getMapboxGateSvg(color = '#10b981', active = false) {

    // Official Mapbox / Maki 'gate' symbol matching Mapbox basemap presentation

    return `

    <svg class="maki-gate-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15" width="16" height="16" fill="currentColor">

        <path d="M1 2.75A.75.75 0 0 1 1.75 2h1.114c.09 0 .18.016.263.048l3.386 1.27A.75.75 0 0 1 7 4.02v5.96a.75.75 0 0 1-.487.702L3 12v.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1-.75-.75v-9.5Zm3 5.736v-4.87a.25.25 0 0 0-.162-.234l-.5-.187A.25.25 0 0 0 3 3.429v5.224c0 .17.167.291.33.237l.5-.166A.25.25 0 0 0 4 8.486ZM5 4.18v3.807a.25.25 0 0 0 .33.238l.5-.167A.25.25 0 0 0 6 7.82V4.366a.25.25 0 0 0-.162-.234l-.5-.187A.25.25 0 0 0 5 4.179Zm9-1.43a.75.75 0 0 0-.75-.75h-1.114a.75.75 0 0 0-.263.048l-3.386 1.27A.75.75 0 0 0 8 4.02v5.96a.75.75 0 0 0 .487.702L12 12v.25c0 .414.336.75.75.75h.5a.75.75 0 0 0 .75-.75v-9.5Zm-2.83 5.974a.25.25 0 0 1-.17-.238v-4.87a.25.25 0 0 1 .162-.234l.5-.187a.25.25 0 0 1 .338.234v5.224a.25.25 0 0 1-.33.237l-.5-.166ZM10 4.179v3.807a.25.25 0 0 1-.33.238l-.5-.167A.25.25 0 0 1 9 7.82V4.366a.25.25 0 0 1 .162-.234l.5-.187a.25.25 0 0 1 .338.234Z"/>

    </svg>`;

}



export const COMPOUND_GATE_BARRIERS = [

    {

        id: 'gate_main_entrance',

        guardHouseId: 'guard_house',

        name: 'Main Entrance',

        subtext: 'Near Guard House A',

        coords: [121.165745, 13.958380],

        type: 'entrance',

        color: '#10b981',

        icon: '🚪'

    },

    {

        id: 'gate_main_exit',

        guardHouseId: 'exit_guard_house_1',

        name: 'Main Exit',

        subtext: 'Near Guard House B',

        coords: [121.165745, 13.959177],

        type: 'exit',

        color: '#f59e0b',

        icon: '🚪'

    },

    {

        id: 'gate_back_gate',

        guardHouseId: 'exit_guard_house_2',

        name: 'Back Gate Entrance / Exit',

        subtext: 'Near Guard House C',

        coords: [121.172478, 13.961711],

        type: 'bilateral',

        color: '#38bdf8',

        icon: '🚪'

    }

];



export function renderGateCalloutBadges() {

    removeGateCalloutBadges();

    if (!state.map) return;

    if (state.currentStationId && state.currentStationId !== 'lares') return;



    COMPOUND_GATE_BARRIERS.forEach(gate => {

        const el = document.createElement('div');

        el.className = `mapbox-gate-marker gate-callout-badge gate-${gate.type}`;

        el.dataset.gateId = gate.id;

        el.innerHTML = `

            <div class="mapbox-gate-symbol" title="${gate.name} (${gate.subtext})">

                ${getMapboxGateSvg(gate.color, false)}

            </div>

            <div class="mapbox-gate-label">${gate.name}</div>

        `;



        el.addEventListener('click', (e) => {

            e.stopPropagation();

            selectStandaloneGate(gate.id);

        });



        const marker = new mapboxgl.Marker({

            element: el,

            anchor: 'center'

        }).setLngLat(gate.coords).addTo(state.map);



        if (!state.gateMarkers) state.gateMarkers = [];

        state.gateMarkers.push(marker);

    });

}



export function selectStandaloneGate(gateId) {

    const gate = COMPOUND_GATE_BARRIERS.find(g => g.id === gateId);

    if (!gate) return;



    if (typeof window.resetIdle === 'function') window.resetIdle();

    if (typeof window.stopOrbit === 'function') window.stopOrbit();

    if (typeof window.safeClearRoute === 'function') window.safeClearRoute();

    if (typeof window.deselectPlotZone === 'function') window.deselectPlotZone();

    if (typeof window.clearSubPlotHighlight === 'function') window.clearSubPlotHighlight();



    // 1. STRICT STANDALONE: Deselect ALL directory items and numbered pins!

    // Guard House A, B, C MUST NEVER be selected or highlighted!

    document.querySelectorAll('.dir-item').forEach(el => el.classList.remove('active'));

    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));

    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));



    // 2. Mark this gate badge as active (with glowing ring and active style)

    document.querySelectorAll('.gate-callout-badge').forEach(el => {

        if (el.dataset.gateId === gateId) {

            el.classList.add('active');

        } else {

            el.classList.remove('active');

        }

    });



    // 3. Track selected ID in state and window

    state.selectedBuildingId = gateId;

    window.selectedBuildingId = gateId;



    // 4. Smoothly ease camera to gate coordinates preserving angle and pitch (no flinging or spinning)

    if (state.map) {

        state.map.easeTo({

            center: gate.coords,

            zoom: Math.max(state.map.getZoom(), 18.2),

            duration: 600,

            essential: true

        });

    }



    // 5. Open the drawer panel for the standalone gate

    const isPhone = (typeof window.isPhoneMode === 'function') ? window.isPhoneMode() : (window.innerWidth <= 768);

    if (isPhone && typeof window.showPhoneBuildingDetails === 'function') {

        window.showPhoneBuildingDetails(gateId);

    } else if (typeof window.showBuildingPanel === 'function') {

        window.showBuildingPanel(gateId);

    }

}



export function removeGateCalloutBadges() {

    if (state.gateMarkers && state.gateMarkers.length > 0) {

        state.gateMarkers.forEach(m => m.remove());

    }

    state.gateMarkers = [];

}



export function createMarkers() {

    removeMarkers();

    renderGateCalloutBadges();

    bindMarkerVirtualizationListener();



    const currentStation = state.currentStationId || 'lares';

    const numbersBtn = document.getElementById('chip-numbers');

    const areMarkersVisible = (state.markersVisible !== undefined)

        ? (state.markersVisible !== false)

        : (numbersBtn ? numbersBtn.classList.contains('active') : true);

    if (typeof document !== 'undefined' && document.body) {
        document.body.classList.toggle('labels-hidden', !areMarkersVisible);
    }



    let itemsToRender = [];



    if (currentStation === 'lares') {

        const dirList = (typeof window !== 'undefined' && window.BUILDING_DIRECTORY && window.BUILDING_DIRECTORY.length > 0)

            ? window.BUILDING_DIRECTORY

            : BUILDING_DIRECTORY;



        // Exclude screenhouses from generating individual floating map pins (accessed via Plot Zone Sub-Plots list)

        itemsToRender = dirList

            .filter(b => !b.isSubPlot && b.hasMarker !== false && !b.id.startsWith('plot17_') && !b.id.startsWith('plot18_') && !b.id.startsWith('plot22_'))

            .map((b, index) => ({

                id: b.id,

                name: b.name,

                desc: b.desc || 'DA-LARES Facility',

                num: b.num || (index + 1),

                color: (state.savedBuildingColors && state.savedBuildingColors[b.id] && state.savedBuildingColors[b.id].icon) || b.color || (DEFAULT_BUILDING_COLORS[b.id] && DEFAULT_BUILDING_COLORS[b.id].icon) || '#3b82f6',

                coords: b.coords,

                isQARES: false

            }));

    } else if (currentStation === 'qares') {

        const qaresData = (typeof window !== 'undefined' && window.qaresBuildingsBaseline) ? window.qaresBuildingsBaseline : null;

        if (qaresData && qaresData.features) {

            const QARES_COLORS_DEF = {

                red: '#ef4444',

                blue: '#3b82f6',

                green: '#22c55e',

                yellow: '#eab308',

                light_grey: '#94a3b8',

                pink: '#ec4899',

                brown: '#b45309'

            };

            const bldgs = qaresData.features.filter(f => {

                const cat = f.properties && (f.properties.filter_type || f.properties.category || 'Buildings');

                return cat === 'Buildings';

            });

            itemsToRender = bldgs.map((f, index) => {

                const p = f.properties || {};

                const cKey = p.color_code || 'red';

                const col = p.color || p.roof_color || QARES_COLORS_DEF[cKey] || '#ef4444';

                let centerCoords = [121.37152, 13.94609];

                if (f.geometry && f.geometry.type === 'Polygon' && f.geometry.coordinates && f.geometry.coordinates[0]) {

                    const ring = f.geometry.coordinates[0];

                    let sumLng = 0, sumLat = 0;

                    ring.forEach(c => { sumLng += c[0]; sumLat += c[1]; });

                    centerCoords = [sumLng / ring.length, sumLat / ring.length];

                }

                return {

                    id: p.id || `qares_${index + 1}`,

                    name: p.name || p.id,

                    desc: p.desc || 'QARES Research Facility',

                    num: index + 1,

                    color: col,

                    coords: centerCoords,

                    isQARES: true
                };
            });
        }
    } else if (currentStation === 'rares') {
        const raresData = (typeof window !== 'undefined' && window.raresBuildingsBaseline) ? window.raresBuildingsBaseline : null;
        if (raresData && raresData.features) {
            const groups = new Map();
            raresData.features.forEach(f => {
                const props = f.properties || {};
                const id = props.id || '';
                const match = id.match(/_([0-9]+)/);
                const baseNum = match ? parseInt(match[1], 10) : null;
                const key = baseNum !== null ? baseNum : id;

                if (!groups.has(key)) {
                    groups.set(key, {
                        baseNum: baseNum,
                        id: `rares_building_${baseNum || id}`,
                        name: props.name || `Facility ${baseNum || ''}`,
                        desc: props.description || 'RARES Agricultural Facility',
                        features: [],
                        allCoordinates: []
                    });
                }
                const group = groups.get(key);
                group.features.push(f);
                if (f.geometry && f.geometry.type === 'Polygon' && f.geometry.coordinates && f.geometry.coordinates[0]) {
                    f.geometry.coordinates[0].forEach(c => group.allCoordinates.push(c));
                }
            });

            const combinedList = Array.from(groups.values()).map(g => {
                let centerCoords = [121.3393, 14.5750];
                const markerFeat = g.features.find(f => f.properties && f.properties.marker_coords);
                if (markerFeat && Array.isArray(markerFeat.properties.marker_coords) && markerFeat.properties.marker_coords.length === 2) {
                    centerCoords = markerFeat.properties.marker_coords;
                } else if (g.allCoordinates.length > 0) {
                    let sumLng = 0, sumLat = 0;
                    g.allCoordinates.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
                    centerCoords = [sumLng / g.allCoordinates.length, sumLat / g.allCoordinates.length];
                }
                return {
                    id: g.id,
                    name: g.name,
                    desc: (typeof window !== 'undefined' && window.getRARESSubtitle) ? window.getRARESSubtitle(g.name, g.desc) : g.desc,
                    num: g.baseNum !== null ? g.baseNum : 1,
                    color: '#10b981',
                    coords: centerCoords,
                    isRARES: true
                };
            });

            combinedList.sort((a, b) => a.num - b.num);
            itemsToRender = combinedList;
        }
    }



    if (!state.map || itemsToRender.length === 0) return;



    itemsToRender.forEach(b => {

        const el = document.createElement('div');

        el.className = 'bldg-map-marker';

        el.dataset.id = b.id;

        if (!areMarkersVisible) {

            el.style.setProperty('display', 'none', 'important');

        }

        const hasNum = b.num !== null && b.num !== undefined;

        const badgeContent = hasNum ? b.num : (b.icon || '🏛️');

        el.innerHTML = `

            <div class="bldg-map-badge" style="background:${b.color}; font-size:${hasNum ? '12px' : '15px'};">${badgeContent}</div>

            <div class="bldg-map-label-group">

                <span class="bldg-map-name">${b.name}</span>

            </div>

        `;

        let markerTouchStartX = 0;

        let markerTouchStartY = 0;

        let markerTouchMoved = false;



        el.addEventListener('touchstart', (e) => {

            const t = e.touches[0];

            if (t) {

                markerTouchStartX = t.clientX;

                markerTouchStartY = t.clientY;

                markerTouchMoved = false;

            }

        }, { passive: true });



        el.addEventListener('touchmove', (e) => {

            const t = e.touches[0];

            if (t) {

                if (Math.abs(t.clientX - markerTouchStartX) > 8 || Math.abs(t.clientY - markerTouchStartY) > 8) {

                    markerTouchMoved = true;

                }

            }

        }, { passive: true });



        const onMarkerTap = (e) => {

            if (e.type === 'touchend' && markerTouchMoved) return; // User was panning/swiping map

            e.stopPropagation();

            if (typeof window.navigateTo === 'function') {

                window.navigateTo(b.id);

            }

        };

        el.addEventListener('click', onMarkerTap);

        el.addEventListener('touchend', onMarkerTap);



        const marker = new mapboxgl.Marker({ element: el }).setLngLat(b.coords);

        const isPhone = (typeof window.isPhoneMode === 'function') ? window.isPhoneMode() : (window.innerWidth <= 768);

        if (!isPhone) {

            const popup = new mapboxgl.Popup({ offset: 18, closeButton: true, maxWidth: '240px' })

                .setHTML(`<div class="popup-label main">Building ${b.num}</div><div class="popup-title">${b.name}</div><div class="popup-desc">${b.desc}</div>`);

            marker.setPopup(popup);

        }

        marker.addTo(state.map);

        state.markers.push(marker);

    });

    updateMarkerZoomState();

    scheduleVirtualizeMarkers();

}



export function removeMarkers() {

    removeGateCalloutBadges();

    if (state.markers) {

        state.markers.forEach(m => m.remove());

    }

    state.markers = [];

}



if (typeof window !== 'undefined') {

    window.selectStandaloneGate = selectStandaloneGate;

    window.getMapboxGateSvg = getMapboxGateSvg;

    window.createMarkers = createMarkers;

    window.removeMarkers = removeMarkers;

    window.virtualizeMarkers = virtualizeMarkers;

    window.scheduleVirtualizeMarkers = scheduleVirtualizeMarkers;

}



export function declutterMarkersForOrbit(selectedBuildingId) {

    if (!selectedBuildingId) return;

    const selectedBldg = (typeof window.getBuildingById === 'function')

        ? window.getBuildingById(selectedBuildingId)

        : BUILDING_DIRECTORY.find(b => b.id === selectedBuildingId);

    if (!selectedBldg) return;



    document.querySelectorAll('.bldg-map-marker').forEach(el => {

        const id = el.dataset.id;

        if (id === selectedBuildingId) {

            el.classList.add('decluttered-highlight', 'decluttered-dest');

            el.classList.remove('decluttered-dim', 'decluttered-hide');

            el.style.display = '';

        } else {

            const bldg = (typeof window.getBuildingById === 'function')

                ? window.getBuildingById(id)

                : BUILDING_DIRECTORY.find(b => b.id === id);

            if (bldg && bldg.coords && selectedBldg.coords) {

                const dist = Math.hypot(

                    (bldg.coords[0] - selectedBldg.coords[0]) * 111000 * Math.cos(selectedBldg.coords[1] * Math.PI / 180),

                    (bldg.coords[1] - selectedBldg.coords[1]) * 111000

                );

                // Hide distant markers (>50m) during 3D inspection orbit

                if (dist > 50) {

                    el.classList.add('decluttered-hide');

                    el.classList.remove('decluttered-dim');

                } else {

                    el.classList.add('decluttered-dim');

                    el.classList.remove('decluttered-hide');

                }

            }

        }

    });

}



export function restoreMarkersAfterOrbit() {

    document.querySelectorAll('.bldg-map-marker').forEach(el => {

        el.classList.remove('decluttered-dim', 'decluttered-hide', 'decluttered-highlight', 'decluttered-dest');

        if (state.markersVisible !== false) {

            el.style.display = '';

        }

    });

    scheduleVirtualizeMarkers();

}





export function declutterMarkersForNavigation(active, destId) {



    if (!state.markers || state.markers.length === 0) return;



    const targetDestId = destId || state.activeRoute || state.selectedBuildingId;



    



    document.querySelectorAll('.bldg-map-marker').forEach(el => {



        const id = el.dataset.id;



        if (!active) {



            el.classList.remove('decluttered-dim', 'decluttered-hide', 'decluttered-highlight', 'decluttered-dest');



            if (state.markersVisible !== false) {



                el.style.display = '';



            }



            return;



        }







        // Active navigation: Keep only destination building marker visible to eliminate DOM matrix transforms



        if (id === targetDestId) {



            el.classList.add('decluttered-highlight', 'decluttered-dest');



            el.classList.remove('decluttered-dim', 'decluttered-hide');



            el.style.display = '';



        } else {



            el.classList.add('decluttered-hide');



            el.classList.remove('decluttered-dim');



            el.style.display = 'none';



        }



    });







    if (!active) {



        scheduleVirtualizeMarkers();



    }



}







if (typeof window !== 'undefined') {



    window.declutterMarkersForNavigation = declutterMarkersForNavigation;



}



