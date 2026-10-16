// DA-LARES Wayfinding — Idle, Screensaver & Kiosk Marker Module

import { DEFAULT_MAP_VIEW, IDLE_TIMEOUT } from './data/config.js';
import { state } from './data/state.js';
import { map } from './map-setup.js';
import { clearRoute } from './routing.js';
import { buildDirectory, filterByCategory, openSidebarMenu } from './sidebar.js';
import { navigateTo } from './walker.js';
import { isKioskMode } from './mode.js';

export function createKioskMarker() {
    if (state.kioskMarkerInstance) state.kioskMarkerInstance.remove();
    const el = document.createElement('div');
    el.className = 'kiosk-marker' + (state.isAdmin ? ' admin-mode' : ' visitor-mode');

    if (state.isAdmin) {
        el.innerHTML = '<div class="kiosk-marker-pulse"></div><div class="kiosk-marker-dot"></div><div class="kiosk-marker-label" style="cursor:pointer;pointer-events:auto;" onclick="toggleKioskLock(event)">📍 You Are Here 🔒 (Admin)</div>';
    } else {
        el.innerHTML = '<div class="kiosk-marker-pulse"></div><div class="kiosk-marker-dot"></div><div class="kiosk-marker-label" style="pointer-events:none;cursor:default;user-select:none;">📍 You Are Here</div>';
    }

    state.kioskMarkerInstance = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
        draggable: !!(state.isAdmin && state.isKioskDraggable)
    })
        .setLngLat(state.KIOSK_COORDS)
        .addTo(map);

    if (state.kioskMarkerInstance.getElement()) {
        state.kioskMarkerInstance.getElement().style.zIndex = '99999';
    }

    if (state.isAdmin) {
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
}

let idleAnimFrame = null;

export function resetIdle() {
    if (state.idleTimer) {
        clearTimeout(state.idleTimer);
        state.idleTimer = null;
    }
    stopIdleRotation();
    if (!isKioskMode()) return;
    state.idleTimer = setTimeout(startIdleRotation, IDLE_TIMEOUT);
}

export function startIdleRotation() {
    if (!isKioskMode()) return;
    
    // Stop any existing animation loop
    if (idleAnimFrame) {
        cancelAnimationFrame(idleAnimFrame);
        idleAnimFrame = null;
    }

    // 1. Clear any active walking route & turn banner
    if (typeof clearRoute === 'function') {
        clearRoute();
    } else if (state.activeRoute) {
        state.activeRoute = null;
    }

    // 2. Clear building selection and unhighlight ALL map markers & directory items
    state.selectedBuildingId = null;
    window.selectedBuildingId = null;

    const panel = document.getElementById('building-panel');
    if (panel) panel.classList.remove('active');

    document.querySelectorAll('.dir-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bldg-map-marker').forEach(el => {
        el.classList.remove('active', 'decluttered-dim', 'decluttered-hide', 'decluttered-highlight', 'decluttered-dest');
    });

    // Close any open popups on markers
    if (state.markers) {
        state.markers.forEach(m => {
            if (m.getPopup() && m.getPopup().isOpen()) m.getPopup().remove();
        });
    }

    stopOrbit();

    // 3. Reset search & directory view
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    try {
        if (typeof openSidebarMenu === 'function') openSidebarMenu();
        if (typeof filterByCategory === 'function') filterByCategory('all');
        else buildDirectory();
    } catch (e) {
        buildDirectory();
    }

    state.idleRotating = true;

    // 4. Fly camera back to Kiosk default view
    map.flyTo({ 
        center: DEFAULT_MAP_VIEW.center, 
        zoom: DEFAULT_MAP_VIEW.zoom, 
        pitch: DEFAULT_MAP_VIEW.pitch, 
        bearing: DEFAULT_MAP_VIEW.bearing, 
        duration: 1800,
        essential: true
    });

    // 5. Start 360° continuous rotation loop around Kiosk
    function rotateStep() {
        if (!state.idleRotating) return;
        map.rotateTo(map.getBearing() + 0.15, { duration: 0 });
        idleAnimFrame = requestAnimationFrame(rotateStep);
    }

    setTimeout(() => {
        state.idleRotating = true;
        if (idleAnimFrame) cancelAnimationFrame(idleAnimFrame);
        idleAnimFrame = requestAnimationFrame(rotateStep);
    }, 1900);
}

export function stopIdleRotation() {
    state.idleRotating = false;
    if (idleAnimFrame) {
        cancelAnimationFrame(idleAnimFrame);
        idleAnimFrame = null;
    }
}

export function orbitBuilding(center, options = {}) {
    state.isIntroAnimating = false;
    if (typeof window.stopIntroAnimation === 'function') window.stopIntroAnimation();
    stopOrbit();
    state.isOrbiting = true;

    const isPhone = (typeof window.isPhoneMode === 'function') ? window.isPhoneMode() : false;
    const targetZoom = options.zoom !== undefined ? options.zoom : (isPhone ? 19.3 : 20.1);
    const targetPitch = options.pitch !== undefined ? options.pitch : (isPhone ? 50 : 70);
    const targetBearing = options.bearing !== undefined ? options.bearing : map.getBearing();
    const duration = options.duration !== undefined ? options.duration : 1500;

    map.flyTo({
        center: center,
        zoom: targetZoom,
        pitch: targetPitch,
        bearing: targetBearing,
        duration: duration,
        essential: true
    });

    state.orbitTimeout = setTimeout(() => {
        if (!state.isOrbiting) return;
        function orbitStep() {
            if (!state.isOrbiting) return;
            map.rotateTo(map.getBearing() + 0.22, { duration: 0 });
            state.orbitAnimFrame = requestAnimationFrame(orbitStep);
        }
        state.orbitAnimFrame = requestAnimationFrame(orbitStep);
    }, duration + 100);
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

let holdRotateFrame = null;
let isHoldingRotate = false;

export function startManualRotate(dir) {
    stopIdleRotation();
    stopOrbit();
    stop360Rotation();
    
    isHoldingRotate = true;
    let speed = dir * 1.6;

    function step() {
        if (!isHoldingRotate || !window.map) return;
        window.map.setBearing(window.map.getBearing() + speed);
        holdRotateFrame = requestAnimationFrame(step);
    }

    if (holdRotateFrame) cancelAnimationFrame(holdRotateFrame);
    holdRotateFrame = requestAnimationFrame(step);
}

export function stopManualRotate() {
    isHoldingRotate = false;
    if (holdRotateFrame) {
        cancelAnimationFrame(holdRotateFrame);
        holdRotateFrame = null;
    }
}

export function rotateDegrees(deltaDegrees) {
    stopIdleRotation();
    stopOrbit();
    stop360Rotation();
    if (window.map) {
        window.map.easeTo({
            bearing: window.map.getBearing() + deltaDegrees,
            duration: 350
        });
    }
}

export function toggle360Rotation() {
    if (state.is360Spinning) {
        stop360Rotation();
        return;
    }
    
    stopOrbit();
    state.is360Spinning = true;
    update360ButtonUI(true);

    function step() {
        if (!state.is360Spinning) return;
        map.rotateTo(map.getBearing() + 0.22, { duration: 0 });
        manual360Frame = requestAnimationFrame(step);
    }
    
    if (manual360Frame) cancelAnimationFrame(manual360Frame);
    manual360Frame = requestAnimationFrame(step);
}

export function stop360Rotation() {
    state.is360Spinning = false;
    if (manual360Frame) {
        cancelAnimationFrame(manual360Frame);
        manual360Frame = null;
    }
    update360ButtonUI(false);
}

function update360ButtonUI(isActive) {
    document.querySelectorAll('.ctrl-360-btn, #btn-360-spin').forEach(btn => {
        if (isActive) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

let lastMouseX = -1;
let lastMouseY = -1;

export function initIdleListeners() {
    const handleUserInteraction = (e) => {
        if (e.type === 'mousemove') {
            if (lastMouseX === -1 && lastMouseY === -1) {
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                return;
            }
            const dx = Math.abs(e.clientX - lastMouseX);
            const dy = Math.abs(e.clientY - lastMouseY);
            if (dx < 10 && dy < 10) return; // Filter minor/synthetic mouse jitter
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }

        resetIdle();
    };

    // User interactions reset idle timer
    ['mousedown', 'touchstart', 'mousemove', 'keydown', 'scroll', 'pointerdown'].forEach(evt => {
        document.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    // Explicit canvas interactions stop building orbit and manual 360 spin
    ['mousedown', 'touchstart', 'wheel'].forEach(evt => {
        document.addEventListener(evt, (e) => {
            if (e.target && e.target.tagName === 'CANVAS') {
                stopOrbit();
                if (state.is360Spinning) {
                    stop360Rotation();
                }
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
window.toggle360Rotation = toggle360Rotation;
window.stop360Rotation = stop360Rotation;
window.startManualRotate = startManualRotate;
window.stopManualRotate = stopManualRotate;
window.rotateDegrees = rotateDegrees;
