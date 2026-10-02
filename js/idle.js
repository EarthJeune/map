// DA-LARES Wayfinding — Idle, Screensaver & Kiosk Marker Module

import { DEFAULT_MAP_VIEW, IDLE_TIMEOUT } from './data/config.js';
import { state } from './data/state.js';
import { map } from './map-setup.js';
import { clearRoute } from './routing.js';
import { buildDirectory } from './sidebar.js';
import { navigateTo } from './walker.js';
import { isKioskMode } from './mode.js';

export function createKioskMarker() {
    if (state.kioskMarkerInstance) state.kioskMarkerInstance.remove();
    const el = document.createElement('div');
    el.className = 'kiosk-marker';
    el.innerHTML = '<div class="kiosk-marker-pulse"></div><div class="kiosk-marker-dot"></div><div class="kiosk-marker-label" style="cursor:pointer;pointer-events:auto;" onclick="toggleKioskLock(event)">📍 You Are Here 🔒</div>';
    state.kioskMarkerInstance = new mapboxgl.Marker({ element: el, anchor: 'center', draggable: state.isKioskDraggable })
        .setLngLat(state.KIOSK_COORDS)
        .addTo(map);
    if (state.kioskMarkerInstance.getElement()) {
        state.kioskMarkerInstance.getElement().style.zIndex = '99999';
    }

    state.kioskMarkerInstance.on('dragend', () => {
        const lngLat = state.kioskMarkerInstance.getLngLat();
        state.KIOSK_COORDS = [lngLat.lng, lngLat.lat];

        fetch('/api/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates: state.KIOSK_COORDS })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert("Saved new Kiosk Location!");
                    if (state.activeRoute) navigateTo(state.activeRoute); // Refresh route
                }
            });
    });
}

export function resetIdle() {
    if (state.idleTimer) clearTimeout(state.idleTimer);
    stopIdleRotation();
    if (!isKioskMode()) return;
    state.idleTimer = setTimeout(startIdleRotation, IDLE_TIMEOUT);
}

export function startIdleRotation() {
    if (!isKioskMode() || state.idleRotating) return;
    state.idleRotating = true;
    // Clear any active route and close panels
    if (state.activeRoute) clearRoute();
    const panel = document.getElementById('building-panel');
    if (panel) panel.classList.remove('active');
    state.selectedBuildingId = null;
    stopOrbit();
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    buildDirectory();

    map.flyTo({ center: DEFAULT_MAP_VIEW.center, zoom: DEFAULT_MAP_VIEW.zoom, pitch: DEFAULT_MAP_VIEW.pitch, bearing: DEFAULT_MAP_VIEW.bearing, duration: 2000 });
    setTimeout(() => {
        if (!state.idleRotating) return;
        function rotate() {
            if (!state.idleRotating) return;
            map.rotateTo(map.getBearing() + 0.15, { duration: 0 });
            requestAnimationFrame(rotate);
        }
        rotate();
    }, 2500);
}

export function stopIdleRotation() {
    state.idleRotating = false;
}

export function orbitBuilding(center) {
    state.isIntroAnimating = false;
    stopOrbit();
    state.isOrbiting = true;

    map.flyTo({
        center: center,
        zoom: 20.1,
        pitch: 70,
        bearing: map.getBearing(),
        duration: 1500,
        essential: true
    });

    state.orbitTimeout = setTimeout(() => {
        if (!state.isOrbiting) return;
        function orbitStep() {
            if (!state.isOrbiting) return;
            map.rotateTo(map.getBearing() + 0.2, { duration: 0 });
            state.orbitAnimFrame = requestAnimationFrame(orbitStep);
        }
        state.orbitAnimFrame = requestAnimationFrame(orbitStep);
    }, 1600);
}

export function stopOrbit() {
    state.isOrbiting = false;
    if (state.orbitTimeout) {
        clearTimeout(state.orbitTimeout);
        state.orbitTimeout = null;
    }
    if (state.orbitAnimFrame) {
        cancelAnimationFrame(state.orbitAnimFrame);
        state.orbitAnimFrame = null;
    }
}

export function initIdleListeners() {
    // Listen for any interaction to reset idle
    ['mousedown', 'touchstart', 'mousemove', 'keydown', 'scroll'].forEach(evt => {
        document.addEventListener(evt, resetIdle, { passive: true });
    });

    // Listen for explicit map interactions to stop orbit
    ['mousedown', 'touchstart', 'wheel'].forEach(evt => {
        document.addEventListener(evt, (e) => {
            if (e.target && e.target.tagName === 'CANVAS') {
                stopOrbit();
            }
        }, { passive: true });
    });
}

// Window reflections
window.createKioskMarker = createKioskMarker;
window.resetIdle = resetIdle;
window.startIdleRotation = startIdleRotation;
window.stopIdleRotation = stopIdleRotation;
window.orbitBuilding = orbitBuilding;
window.stopOrbit = stopOrbit;
