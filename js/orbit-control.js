// =============================================================
// DA-LARES Wayfinding — Hybrid Camera Navigation System
// 1. Default Touch Gestures (1-finger Pan, 2-finger Orbit Yaw/Pitch, Pinch Zoom)
// 2. Accessibility Joystick Button for 1-Finger Orbit Mode (SketchUp Orbit style)
// =============================================================

let isOrbitActive = false;
let isDraggingMap = false;
let startX = 0;
let startY = 0;
let startBearing = 0;
let startPitch = 0;

export function isOneFingerOrbitActive() {
    return isOrbitActive;
}

export function toggleOneFingerOrbitMode(forceState) {
    isOrbitActive = forceState !== undefined ? !!forceState : !isOrbitActive;

    const map = window.map;
    const toast = document.getElementById('orbit-toast-badge');
    const btns = document.querySelectorAll('.ctrl-orbit-btn');

    btns.forEach(btn => {
        if (isOrbitActive) {
            btn.classList.add('active');
            btn.setAttribute('title', '1-Finger Orbit Mode ACTIVE (Click to return to 1-finger Pan)');
        } else {
            btn.classList.remove('active');
            btn.setAttribute('title', 'Enable 1-Finger Orbit Mode (SketchUp Orbit)');
        }
    });

    if (toast) {
        toast.style.display = isOrbitActive ? 'flex' : 'none';
    }

    if (!map) return;

    if (isOrbitActive) {
        // Disable standard 1-finger panning so 1 finger orbits bearing & pitch
        try { map.dragPan.disable(); } catch (e) {}
    } else {
        // Restore standard 1-finger panning
        try { map.dragPan.enable(); } catch (e) {}
        isDraggingMap = false;
    }
}

export function initOrbitControl() {
    const map = window.map;
    if (!map) return;

    // 1. Enforce Default Touch Gestures (No buttons required)
    try {
        map.dragPan.enable();         // 1-Finger Drag: Pans map smoothly
        map.touchZoomRotate.enable(); // Pinch Zoom & 2-Finger Rotation (Yaw)
        map.touchPitch.enable();      // 2-Finger Drag Up/Down: Tilts camera angle (Pitch)
        map.dragRotate.enable();      // Mouse right-drag or touch drag rotate
    } catch (e) {
        console.warn('Error enabling Mapbox touch handlers:', e);
    }

    const container = map.getCanvasContainer();
    if (!container) return;

    // Pointer handlers for 1-Finger Orbit Mode
    const onPointerDown = (e) => {
        if (!isOrbitActive || !window.map) return;

        // If multi-touch (e.g. 2 fingers), let Mapbox handle standard gestures
        if (e.touches && e.touches.length > 1) {
            isDraggingMap = false;
            return;
        }

        isDraggingMap = true;
        startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        startBearing = window.map.getBearing();
        startPitch = window.map.getPitch();
    };

    let pendingBearing = null;
    let pendingPitch = null;
    let orbitRaf = null;

    const onPointerMove = (e) => {
        if (!isOrbitActive || !isDraggingMap || !window.map) return;

        // If multi-touch during drag, cancel 1-finger orbit overrides
        if (e.touches && e.touches.length > 1) {
            isDraggingMap = false;
            return;
        }

        const currentX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const currentY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

        const deltaX = currentX - startX;
        const deltaY = currentY - startY;

        // Yaw sensitivity (deg / px) & Pitch sensitivity (deg / px)
        const yawSensitivity = 0.35;
        const pitchSensitivity = 0.30;

        pendingBearing = startBearing + (deltaX * yawSensitivity);
        pendingPitch = Math.max(0, Math.min(80, startPitch - (deltaY * pitchSensitivity)));

        if (!orbitRaf) {
            orbitRaf = requestAnimationFrame(() => {
                if (window.map && isDraggingMap && pendingBearing !== null) {
                    window.map.jumpTo({
                        bearing: pendingBearing,
                        pitch: pendingPitch
                    });
                }
                orbitRaf = null;
            });
        }
    };

    const onPointerUp = () => {
        isDraggingMap = false;
        if (orbitRaf) {
            cancelAnimationFrame(orbitRaf);
            orbitRaf = null;
        }
    };

    container.addEventListener('pointerdown', onPointerDown, { passive: true });
    container.addEventListener('touchstart', onPointerDown, { passive: true });

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });

    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    window.addEventListener('touchend', onPointerUp, { passive: true });

    // Expose global helper for inline HTML / button handlers
    window.toggleOneFingerOrbitMode = toggleOneFingerOrbitMode;
}
