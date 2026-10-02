// DA-LARES Markers Module
// Google Maps-style numbered pins, section badges, and compound entrance arrow.

import { BUILDING_DIRECTORY } from './data/buildings.js';
import { state } from './data/state.js';

export function renderSectionBadges() {
    removeSectionBadges();
    if (state.currentMapStyleMode !== 'mapbox') return;
    const boundaryBtn = document.getElementById('chip-boundary');
    const isBoundaryOn = (state.boundaryVisible !== undefined)
        ? state.boundaryVisible
        : (boundaryBtn ? boundaryBtn.classList.contains('active') : true);

    const secDefs = [
        { id: 1, coords: [121.17110, 13.96060], dotClass: 'sec-dot-blue' },
        { id: 2, coords: [121.16940, 13.95980], dotClass: 'sec-dot-orange' },
        { id: 3, coords: [121.16680, 13.95895], dotClass: 'sec-dot-green' }
    ];
    secDefs.forEach(s => {
        const el = document.createElement('div');
        el.className = 'sec-custom-badge';
        if (!isBoundaryOn) el.style.display = 'none';
        el.innerHTML = `
            <span class="sec-badge-circle ${s.dotClass}"></span>
            <span class="sec-text-part">Section ${s.id}</span>
        `;
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat(s.coords)
            .addTo(state.map);
        state.sectionBadges.push(marker);
    });
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

export function updateMarkerZoomState() {
    if (!state.map) return;
    const z = state.map.getZoom();
    const container = state.map.getContainer();
    if (!container) return;
    if (z < 17) {
        container.classList.add('map-zoomed-out');
    } else {
        container.classList.remove('map-zoomed-out');
    }
}

export function createMarkers() {
    const numbersBtn = document.getElementById('chip-numbers');
    const areMarkersVisible = (state.markersVisible !== undefined)
        ? state.markersVisible
        : (numbersBtn ? numbersBtn.classList.contains('active') : true);

    BUILDING_DIRECTORY.forEach((b, index) => {
        const num = index + 1;
        const el = document.createElement('div');
        el.className = 'bldg-map-marker';
        el.dataset.id = b.id;
        if (!areMarkersVisible) {
            el.style.display = 'none';
        }
        el.innerHTML = `
            <div class="bldg-map-badge" style="background:${b.color};">${num}</div>
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
