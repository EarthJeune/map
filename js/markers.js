// DA-LARES Markers Module
// Google Maps-style numbered pins, section badges, and compound entrance arrow.

import { BUILDING_DIRECTORY } from './data/buildings.js?v=72';
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

export function updateMarkerZoomState() {
    if (!state.map) return;
    const z = state.map.getZoom();
    const isZoomedOut = z < 17.8;
    if (isZoomedOut === lastZoomedOutState) return;
    lastZoomedOutState = isZoomedOut;

    const container = state.map.getContainer();
    if (container) {
        container.classList.toggle('map-zoomed-out', isZoomedOut);
    }
    if (document.body) {
        document.body.classList.toggle('map-zoomed-out', isZoomedOut);
    }
}

export function createMarkers() {
    // Only render LARES building markers if current station is LARES
    if (state.currentStationId && state.currentStationId !== 'lares') {
        removeMarkers();
        return;
    }
    removeMarkers();

    const numbersBtn = document.getElementById('chip-numbers');
    const areMarkersVisible = (state.markersVisible !== undefined)
        ? state.markersVisible
        : (numbersBtn ? numbersBtn.classList.contains('active') : true);

    const dirList = (typeof window !== 'undefined' && window.BUILDING_DIRECTORY && window.BUILDING_DIRECTORY.length > 0)
        ? window.BUILDING_DIRECTORY
        : BUILDING_DIRECTORY;

    dirList.forEach((b, index) => {
        const num = index + 1;
        const el = document.createElement('div');
        el.className = 'bldg-map-marker';
        el.dataset.id = b.id;
        if (!areMarkersVisible) {
            el.style.display = 'none';
        }
        const bColor = b.color || (state.savedBuildingColors && state.savedBuildingColors[b.id] && state.savedBuildingColors[b.id].icon) || '#3b82f6';
        el.innerHTML = `
            <div class="bldg-map-badge" style="background:${bColor};">${num}</div>
            <span class="bldg-map-name">${b.name}</span>
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
                .setHTML(`<div class="popup-label main">Building ${num}</div><div class="popup-title">${b.name}</div><div class="popup-desc">${b.desc}</div>`);
            marker.setPopup(popup);
        }
        marker.addTo(state.map);
        state.markers.push(marker);
    });
    updateMarkerZoomState();
}

export function removeMarkers() {
    if (state.markers) {
        state.markers.forEach(m => m.remove());
    }
    state.markers = [];
}

export function declutterMarkersForOrbit(selectedBuildingId) {
    if (!selectedBuildingId) return;
    const dirList = (typeof window !== 'undefined' && window.BUILDING_DIRECTORY && window.BUILDING_DIRECTORY.length > 0)
        ? window.BUILDING_DIRECTORY
        : BUILDING_DIRECTORY;
    const selectedBldg = dirList.find(b => b.id === selectedBuildingId);
    if (!selectedBldg) return;

    document.querySelectorAll('.bldg-map-marker').forEach(el => {
        const id = el.dataset.id;
        if (id === selectedBuildingId) {
            el.classList.add('decluttered-highlight', 'decluttered-dest');
            el.classList.remove('decluttered-dim', 'decluttered-hide');
            el.style.display = '';
        } else {
            const bldg = dirList.find(b => b.id === id);
            if (bldg) {
                const dist = Math.hypot(
                    (bldg.coords[0] - selectedBldg.coords[0]) * 111000 * Math.cos(selectedBldg.coords[1] * Math.PI / 180),
                    (bldg.coords[1] - selectedBldg.coords[1]) * 111000
                );
                // Hide distant markers (>50m) during 3D inspection orbit so browser doesn't transform 33 DOM elements per frame
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
}
