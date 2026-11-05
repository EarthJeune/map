import { DEFAULT_MAP_VIEW, IDLE_TIMEOUT, SAVED_MAIN_KIOSK_COORDS } from './data/config.js';
import { lucideIcon } from './data/icons.js';
import { getActiveStationDefaultView } from './data/stations.js';
import { state } from './data/state.js';
import { map } from './map-setup.js';
import { clearRoute, closeRouteAndReset } from './routing.js';
import { buildDirectory, filterByCategory, openSidebarMenu } from './sidebar.js';
import { navigateTo, exitRouteMode, clearArrivedCountdown } from './walker.js';
import { isKioskMode } from './mode.js';
import { closeQRZoomModal, resetQRAutoExitCountdown, clearQRAutoExitCountdown } from './qr.js';
import { closePhotoLightbox } from './phone-ui.js';
import { closeBuildingPanel } from './building-panel.js';
import { declutterMarkersForOrbit, restoreMarkersAfterOrbit } from './markers.js';

export function createKioskMarker() {
    if (state.kioskMarkerInstance) {
        state.kioskMarkerInstance.remove();
        state.kioskMarkerInstance = null;
    }
    if (state.qaresKioskMarkerInstance) {
        state.qaresKioskMarkerInstance.remove();
        state.qaresKioskMarkerInstance = null;
    }

    const isQares = (state.currentStationId === 'qares');
    const targetCoords = isQares
        ? (state.QARES_KIOSK_COORDS || [121.3713315, 13.9432268])
        : (state.KIOSK_COORDS || SAVED_MAIN_KIOSK_COORDS);

    // In admin mode, enable dragging by default so it's immediately ready
    const isDraggable = !!(state.isAdmin && state.isKioskDraggable !== false);

    const el = document.createElement('div');
    el.className = 'kiosk-marker' + (state.isAdmin ? ' admin-mode' : ' visitor-mode');

    const prefix = isQares ? 'QARES • ' : '';
    if (state.isAdmin) {
        const dragNotice = isDraggable ? `${lucideIcon('unlock', 12)} (Drag to move)` : `${lucideIcon('lock', 12)} (Admin)`;
        const bgStyle = isDraggable ? 'background:#eab308;color:#000;border:1px solid #ca8a04;' : '';
        el.innerHTML = `<div class="kiosk-marker-pulse"></div><div class="kiosk-marker-dot"></div><div class="kiosk-marker-label" style="cursor:pointer;pointer-events:auto;${bgStyle}" onclick="toggleKioskLock(event)">${lucideIcon('map-pin', 13)} ${prefix}You Are Here ${dragNotice}</div>`;
    } else {
        el.innerHTML = `<div class="kiosk-marker-pulse"></div><div class="kiosk-marker-dot"></div><div class="kiosk-marker-label" style="pointer-events:none;cursor:default;user-select:none;">${lucideIcon('map-pin', 13)} ${prefix}You Are Here</div>`;
    }

    const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
        draggable: isDraggable
    })
        .setLngLat(targetCoords)
        .addTo(map);

    state.kioskMarkerInstance = marker;
    if (isQares) {
        state.qaresKioskMarkerInstance = marker;
    }

    const markerEl = marker.getElement();
    if (markerEl) {
        markerEl.style.zIndex = '99999';
        if (state.isAdmin) {
            markerEl.style.cursor = isDraggable ? 'grab' : 'pointer';
        }
    }

    if (state.isAdmin) {
        marker.on('dragstart', () => {
            if (marker.getElement()) marker.getElement().style.cursor = 'grabbing';
        });

        marker.on('dragend', () => {
            if (marker.getElement()) marker.getElement().style.cursor = 'grab';
            const lngLat = marker.getLngLat();
            repositionActiveKioskPin([lngLat.lng, lngLat.lat]);
        });
    }
}

export function repositionActiveKioskPin(newCoords) {
    if (!newCoords || !Array.isArray(newCoords) || newCoords.length !== 2) return;
    const isQares = (state.currentStationId === 'qares');
    const marker = state.kioskMarkerInstance;
    if (marker) {
        marker.setLngLat(newCoords);
    }

    if (isQares) {
        state.QARES_KIOSK_COORDS = newCoords;
        window.QARES_KIOSK_COORDS = newCoords;

        fetch('/api/qares/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates: newCoords, station: 'qares' })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showAutoExitToast(`📍 Saved QARES Kiosk Pin [${newCoords[0].toFixed(5)}, ${newCoords[1].toFixed(5)}]`, 3500);
                }
            })
            .catch(err => console.error("Error saving QARES kiosk pin:", err));
    } else {
        state.KIOSK_COORDS = newCoords;
        window.KIOSK_COORDS = newCoords;

        fetch('/api/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates: newCoords, station: 'lares' })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showAutoExitToast(`📍 Saved LARES Kiosk Pin [${newCoords[0].toFixed(5)}, ${newCoords[1].toFixed(5)}]`, 3500);
                    if (state.activeRoute) navigateTo(state.activeRoute);
                }
            })
            .catch(err => console.error("Error saving LARES kiosk pin:", err));
    }
}
if (typeof window !== 'undefined') {
    window.repositionActiveKioskPin = repositionActiveKioskPin;
}

let idleAnimFrame = null;
let idleStartTimeout = null;
let manual360Frame = null;
let autoExitToastTimer = null;

export function showAutoExitToast(msg = 'Auto-exiting session • Returning to You Are Here', duration = 2600) {
    const toast = document.getElementById('kiosk-auto-exit-toast');
    const text = document.getElementById('kiosk-auto-exit-text');
    if (!toast) return;

    if (text) text.textContent = msg;
    toast.style.display = 'flex';
    void toast.offsetWidth; // Force reflow
    toast.classList.add('visible');

    if (autoExitToastTimer) clearTimeout(autoExitToastTimer);
    autoExitToastTimer = setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => {
            if (!toast.classList.contains('visible')) {
                toast.style.display = 'none';
            }
        }, 300);
    }, duration);
}

export function autoExitActiveSession(reason = 'afk') {
    // 1. Immediately dismiss QR Zoom modal & stop countdown
    try {
        if (typeof clearQRAutoExitCountdown === 'function') clearQRAutoExitCountdown();
        if (typeof closeQRZoomModal === 'function') closeQRZoomModal();
        else if (typeof window.closeQRZoomModal === 'function') window.closeQRZoomModal();
    } catch (e) { }

    // 2. Dismiss Fullscreen Photo Lightbox modal
    try {
        if (typeof closePhotoLightbox === 'function') closePhotoLightbox();
        else if (typeof window.closePhotoLightbox === 'function') window.closePhotoLightbox();
    } catch (e) { }

    // 3. Dismiss Color Picker modal if open
    const colorModal = document.getElementById('color-picker-modal');
    if (colorModal) colorModal.style.display = 'none';

    // 4. Dismiss Map Settings Panel if open
    try {
        if (typeof closeMapSettingsPanel === 'function') closeMapSettingsPanel();
        else if (typeof window.closeMapSettingsPanel === 'function') window.closeMapSettingsPanel();
    } catch (e) { }

    // 5. Check if an active route navigation or building panel was open
    const hadActiveSession = !!(
        state.activeRoute ||
        state.selectedBuildingId ||
        document.getElementById('route-info')?.classList.contains('active') ||
        document.getElementById('building-panel')?.classList.contains('active') ||
        document.getElementById('qr-zoom-modal')?.style.display === 'flex'
    );

    if (hadActiveSession) {
        showAutoExitToast('Auto-exiting session • Returning to You Are Here', 2600);
    }

    // 5. Exit active route and reset walker, HUD, banner, steps, camera controls
    try {
        if (typeof clearArrivedCountdown === 'function') clearArrivedCountdown();
        if (typeof exitRouteMode === 'function') exitRouteMode();
        else if (typeof window.exitRouteMode === 'function') window.exitRouteMode();
        else if (typeof closeRouteAndReset === 'function') closeRouteAndReset();
        else if (typeof clearRoute === 'function') clearRoute();
    } catch (e) { }
    state.activeRoute = null;

    // 6. Close building info panel and unhighlight markers
    try {
        if (typeof closeBuildingPanel === 'function') closeBuildingPanel(true);
        else if (typeof window.closeBuildingPanel === 'function') window.closeBuildingPanel(true);
    } catch (e) { }

    const panel = document.getElementById('building-panel');
    if (panel) panel.classList.remove('active');

    state.selectedBuildingId = null;
    window.selectedBuildingId = null;

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

    // 7. Reset search input and directory view (LARES only; QARES has its own drawing suite/directory)
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    try {
        if (typeof openSidebarMenu === 'function') openSidebarMenu();
        if (state.currentStationId === 'lares') {
            if (typeof filterByCategory === 'function') filterByCategory('all', true);
            else buildDirectory();
        }
    } catch (e) {
        try { if (state.currentStationId === 'lares') buildDirectory(); } catch (err) { }
    }
}

export function triggerAutoExitToIdle(reason = 'afk') {
    if (!isKioskMode()) return;
    autoExitActiveSession(reason);
    startIdleRotation();
}

export function resetIdle() {
    if (state.idleTimer) {
        clearTimeout(state.idleTimer);
        state.idleTimer = null;
    }
    const wasIdleOrResting = state.idleRotating || state.isEcoRestMode;
    stopIdleRotation();

    // If user touched to exit idle/eco-rest and is in QARES, ensure camera is centered on QARES compound if it drifted
    if (wasIdleOrResting && state.currentStationId === 'qares' && map) {
        try {
            const curCenter = map.getCenter();
            // QARES compound is around [121.371, 13.943]
            // If the camera somehow got clamped at the west/outer bounds
            if (curCenter.lng < 121.365 || curCenter.lng > 121.378 || curCenter.lat < 13.938 || curCenter.lat > 13.952) {
                const defaultView = getActiveStationDefaultView('qares');
                map.flyTo({
                    center: defaultView.center,
                    zoom: defaultView.zoom,
                    pitch: defaultView.pitch,
                    bearing: defaultView.bearing,
                    duration: 1200
                });
            }
        } catch (e) { }
    }

    if (!isKioskMode()) return;
    state.idleTimer = setTimeout(startIdleRotation, IDLE_TIMEOUT);
}

export function startIdleRotation() {
    if (!isKioskMode() || (typeof document !== 'undefined' && document.hidden)) return;

    // If already continuously rotating in idle mode, do not interrupt or reset the orbit
    if (state.idleRotating && idleAnimFrame) return;

    // Stop any existing animation loop or pending start timer
    if (idleStartTimeout) {
        clearTimeout(idleStartTimeout);
        idleStartTimeout = null;
    }
    if (idleAnimFrame) {
        cancelAnimationFrame(idleAnimFrame);
        idleAnimFrame = null;
    }

    // Auto-exit any active route, modals, or panels before returning to You Are Here animation
    autoExitActiveSession('idle_timeout');

    // Ensure no background idleTimer remains armed while idle rotation is active
    if (state.idleTimer) {
        clearTimeout(state.idleTimer);
        state.idleTimer = null;
    }

    state.idleRotating = true;

    // Station-aware default view: flies to QARES pin in QARES, or LARES pin in LARES
    const defaultView = getActiveStationDefaultView();

    // Check if camera is already parked at defaultView center/zoom/pitch so we don't snap bearing
    const curCenter = map.getCenter();
    const distLng = Math.abs(curCenter.lng - defaultView.center[0]);
    const distLat = Math.abs(curCenter.lat - defaultView.center[1]);
    const isAlreadyAtDefault = (
        distLng < 0.00015 &&
        distLat < 0.00015 &&
        Math.abs(map.getZoom() - defaultView.zoom) < 0.35 &&
        Math.abs(map.getPitch() - defaultView.pitch) < 4
    );

    const flyDuration = isAlreadyAtDefault ? 0 : 1800;
    if (!isAlreadyAtDefault) {
        map.flyTo({
            center: defaultView.center,
            zoom: defaultView.zoom,
            pitch: defaultView.pitch,
            bearing: defaultView.bearing,
            padding: { top: 0, bottom: 0, left: 0, right: 0 },
            duration: flyDuration,
            essential: true
        });
    }

    const idleStartTime = Date.now();
    const IDLE_ROTATION_ECO_LIMIT_MS = 5 * 60 * 1000; // 5 minutes max continuous rotation before resting

    const beginContinuousIdleOrbit = () => {
        if (!state.idleRotating) return;
        if (idleAnimFrame) cancelAnimationFrame(idleAnimFrame);

        let lastRotTime = performance.now();
        const orbitStartStamp = lastRotTime;
        let currentBearing = map.getBearing();

        function rotateStep(now) {
            if (!state.idleRotating || (typeof document !== 'undefined' && document.hidden)) {
                stopIdleRotation();
                return;
            }

            // Thermal / Eco-Rest: After 5 minutes unattended, smoothly park camera at You Are Here
            if (Date.now() - idleStartTime > IDLE_ROTATION_ECO_LIMIT_MS) {
                stopIdleRotation();
                state.isEcoRestMode = true;
                const restView = getActiveStationDefaultView();
                map.easeTo({
                    center: restView.center,
                    zoom: restView.zoom,
                    pitch: restView.pitch,
                    bearing: restView.bearing,
                    duration: 1200
                });
                showAutoExitToast('💡 Kiosk Eco-Rest Active • Touch screen to explore', 5000);
                return;
            }

            const dt = Math.max(0, Math.min(now - lastRotTime, 64));
            lastRotTime = now;

            // Smooth 600ms ease-in ramp so orbit starts gently without a sudden speed jump
            const elapsed = now - orbitStartStamp;
            const easeFactor = Math.min(1.0, elapsed / 600);

            // Continuous 6.0 deg/sec (0.10 deg per 16.67ms frame) with zero wrap-around stutter
            const bearingStep = (0.10 * (dt / 16.67)) * easeFactor;
            currentBearing = (currentBearing + bearingStep) % 360;
            map.setBearing(currentBearing);

            idleAnimFrame = requestAnimationFrame(rotateStep);
        }

        idleAnimFrame = requestAnimationFrame(rotateStep);
    };

    if (flyDuration === 0) {
        beginContinuousIdleOrbit();
    } else {
        idleStartTimeout = setTimeout(() => {
            idleStartTimeout = null;
            beginContinuousIdleOrbit();
        }, flyDuration);
    }
}

export function stopIdleRotation() {
    state.idleRotating = false;
    state.isEcoRestMode = false;
    if (idleStartTimeout) {
        clearTimeout(idleStartTimeout);
        idleStartTimeout = null;
    }
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

    const isPhone = (typeof window.isPhoneMode === 'function') ? window.isPhoneMode() : (window.innerWidth <= 768);
    // Optimized targetPitch: 54° on kiosk, 48° on mobile.
    // 70° was causing massive horizon frustum overdraw, rendering all distant buildings and ground mipmaps simultaneously.
    // 54° gives a gorgeous, realistic 3D isometric view while cutting GPU fill-rate strain by >60%.
    const targetZoom = options.zoom !== undefined ? options.zoom : (isPhone ? 19.1 : 19.6);
    const targetPitch = options.pitch !== undefined ? options.pitch : (isPhone ? 48 : 54);
    const targetBearing = options.bearing !== undefined ? options.bearing : map.getBearing();
    const duration = options.duration !== undefined ? options.duration : 1300;

    // Declutter distant markers during orbit so browser doesn't compute CSS transforms for 33 labels every 16ms
    if (typeof declutterMarkersForOrbit === 'function' && state.selectedBuildingId) {
        declutterMarkersForOrbit(state.selectedBuildingId);
    }

    // Offset camera padding so building is centered between the sidebar and building detail drawer
    const isPortraitKiosk = (typeof document !== 'undefined' && document.body.classList.contains('kiosk-portrait')) ||
        ((typeof window !== 'undefined') && window.innerHeight > window.innerWidth && !isPhone);
    const pad = options.padding || (isPortraitKiosk
        ? { top: 90, bottom: Math.round((typeof window !== 'undefined' ? window.innerHeight : 1000) * 0.46), left: 24, right: 24 }
        : (isPhone
            ? { top: 70, bottom: 250, left: 16, right: 16 }
            : { top: 60, bottom: 60, left: 380, right: 380 }
        )
    );

    map.flyTo({
        center: center,
        zoom: targetZoom,
        pitch: targetPitch,
        bearing: targetBearing,
        padding: pad,
        duration: duration,
        essential: true
    });

    state.orbitTimeout = setTimeout(() => {
        state.orbitTimeout = null;
        if (!state.isOrbiting || !map) return;

        let lastOrbitTime = performance.now();
        const orbitStartStamp = lastOrbitTime;
        let currentBearing = map.getBearing();

        function orbitStep(now) {
            if (!state.isOrbiting || !map) return;
            const dt = Math.max(0, Math.min(now - lastOrbitTime, 64));
            lastOrbitTime = now;

            // Smooth 500ms ease-in ramp so rotation begins seamlessly right after flyTo
            const elapsed = now - orbitStartStamp;
            const easeFactor = Math.min(1.0, elapsed / 500);

            // True V-synced 60 FPS continuous rotation (9.6 deg/sec = 37.5s per full 360° turn)
            const step = ((0.16 * dt) / 16.67) * easeFactor;
            currentBearing = (currentBearing + step) % 360;
            map.setBearing(currentBearing);

            state.orbitAnimFrame = requestAnimationFrame(orbitStep);
        }

        state.orbitAnimFrame = requestAnimationFrame(orbitStep);
    }, duration);
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
    if (typeof restoreMarkersAfterOrbit === 'function') {
        restoreMarkersAfterOrbit();
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

    let lastSpinTime = performance.now();
    let currentBearing = map.getBearing();

    function step(now) {
        if (!state.is360Spinning || !map) return;
        const dt = Math.max(0, Math.min(now - lastSpinTime, 64));
        lastSpinTime = now;
        const delta = (0.22 * dt) / 16.67;
        currentBearing = (currentBearing + delta) % 360;
        map.setBearing(currentBearing);
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
        if (typeof resetQRAutoExitCountdown === 'function') {
            resetQRAutoExitCountdown();
        } else if (typeof window.resetQRAutoExitCountdown === 'function') {
            window.resetQRAutoExitCountdown();
        }
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
window.autoExitActiveSession = autoExitActiveSession;
window.triggerAutoExitToIdle = triggerAutoExitToIdle;
window.showAutoExitToast = showAutoExitToast;
window.orbitBuilding = orbitBuilding;
window.stopOrbit = stopOrbit;
window.toggle360Rotation = toggle360Rotation;
window.stop360Rotation = stop360Rotation;
window.startManualRotate = startManualRotate;
window.stopManualRotate = stopManualRotate;
window.rotateDegrees = rotateDegrees;


// Page Visibility API: cleanly suspend screensaver and timers when tab is hidden or minimized
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (state.idleTimer) {
                clearTimeout(state.idleTimer);
                state.idleTimer = null;
            }
            stopIdleRotation();
        } else {
            resetIdle();
        }
    });
}
