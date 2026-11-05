// DA-LARES Wayfinding — Mode & Device Detection Module
// Distinguishes Kiosk Mode (Landscape / Portrait) from Mobile Phone Mode

import { state } from './data/state.js';

export function detectAppMode() {
    if (typeof window === 'undefined') return 'kiosk';

    // 1. Explicit query parameter has highest priority: ?mode=kiosk or ?mode=phone
    const params = new URLSearchParams(window.location.search);
    const modeParam = (params.get('mode') || '').toLowerCase();
    if (modeParam === 'kiosk') return 'kiosk';
    if (modeParam === 'phone' || modeParam === 'mobile') return 'phone';
    if (params.get('portrait') === '1' || params.get('orientation') === 'portrait') {
        return 'kiosk';
    }

    // 2. Cloudflare Tunnel hostname check:
    // If accessed via public tunnel (trycloudflare.com), it's overwhelmingly a mobile phone visitor!
    const host = window.location.hostname || '';
    if (host.includes('trycloudflare.com') || host.includes('cloudflare')) {
        return 'phone';
    }

    // 3. User-Agent mobile detection:
    const isMobileUA = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);

    // 4. Viewport size check:
    if (window.innerWidth <= 768 || isMobileUA) {
        return 'phone';
    }

    // 5. Default is kiosk
    return 'kiosk';
}

export function detectKioskOrientation() {
    if (typeof window === 'undefined') return 'landscape';
    const params = new URLSearchParams(window.location.search);
    if (params.get('portrait') === '1' || params.get('orientation') === 'portrait') return 'portrait';
    if (params.get('orientation') === 'landscape') return 'landscape';
    return (window.innerHeight > window.innerWidth) ? 'portrait' : 'landscape';
}

export function isPhoneMode() {
    return state.appMode === 'phone';
}

export function isKioskMode() {
    return state.appMode === 'kiosk';
}

export function isPortraitKiosk() {
    return state.appMode === 'kiosk' && state.kioskOrientation === 'portrait';
}

export function applyAppModeToDOM() {
    if (typeof document === 'undefined') return;

    const mode = detectAppMode();
    const orientation = detectKioskOrientation();

    state.appMode = mode;
    state.kioskOrientation = orientation;

    const body = document.body;
    body.classList.remove('mode-kiosk', 'mode-phone', 'kiosk-portrait', 'kiosk-landscape');
    body.classList.add(`mode-${mode}`);

    if (mode === 'kiosk') {
        body.classList.add(`kiosk-${orientation}`);
    }

    if (typeof window.updateSidebarToggleIcon === 'function') {
        window.updateSidebarToggleIcon();
    }

    if (typeof window.updatePerformanceUI === 'function') {
        window.updatePerformanceUI();
    }

    // Tell Mapbox to recalculate canvas size
    try {
        if (window.map && typeof window.map.resize === 'function') {
            // Small delay to let CSS reflow complete before Mapbox measures
            setTimeout(() => window.map.resize(), 50);
        }
    } catch (e) {}

    console.log(`[Mode] Active mode: ${mode} (Orientation: ${orientation}, Viewport: ${window.innerWidth}x${window.innerHeight})`);
}

// Window reflections
window.detectAppMode = detectAppMode;
window.detectKioskOrientation = detectKioskOrientation;
window.isPhoneMode = isPhoneMode;
window.isKioskMode = isKioskMode;
window.isPortraitKiosk = isPortraitKiosk;
window.applyAppModeToDOM = applyAppModeToDOM;
