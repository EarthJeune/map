// DA-LARES Wayfinding — Adaptive Hardware & Performance Controller Module
// Automatically tunes rendering resolution, frame throttling, and GPU/battery workload.
// Provides dedicated calibration for Kiosk (Intel Core i3 / i5) and Mobile Devices (Battery Saver / Retina).

import { state } from './data/state.js';
import { lucideIcon } from './data/icons.js';

let gpuInfoCache = null;
let activePixelRatio = 1.0;
let dynamicResolutionScale = 1.0; // 1.0, 0.85, or 0.75 (adjusted in real time by Auto mode)
let fpsHistory = [];
let lastFpsCheckTime = 0;
let isLowEndHardwareDetected = false;
let isIntegratedGpuDetected = false;
let styleGraceUntil = 0;
const moduleLoadTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
const STARTUP_GRACE_MS = 4000; // Wait 4s for initial map load before real-time FPS adaptation

export function notifyStyleTransitionGrace(durationMs = 4500) {
    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    styleGraceUntil = Math.max(styleGraceUntil, now + durationMs);
    fpsHistory = [];
    lastFpsCheckTime = now;
}

export function isMobileDevice() {
    if (typeof window === 'undefined') return false;
    return Boolean(
        state.appMode === 'phone' ||
        window.innerWidth <= 768 ||
        /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent) ||
        (typeof window.location !== 'undefined' && (
            window.location.search.includes('mode=phone') ||
            window.location.search.includes('mode=mobile')
        ))
    );
}

export function getProfileStorageKey() {
    return isMobileDevice() ? 'da_mobile_perf_profile' : 'da_kiosk_perf_profile';
}

// 1. WebGL Hardware & GPU Capabilities Detector
export function detectGpuHardware() {
    if (gpuInfoCache) return gpuInfoCache;
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return { vendor: 'unknown', renderer: 'unknown', isLowEnd: false };
    }

    let vendor = 'Standard WebGL';
    let renderer = 'Hardware Accelerated';
    let isLowEnd = false;

    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl', { powerPreference: 'high-performance' }) || canvas.getContext('experimental-webgl');
        if (gl) {
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            if (ext) {
                vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || vendor;
                renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || renderer;
            }
        }
    } catch (e) {
        console.warn('[Performance] GPU detection notice:', e);
    }

    const lowerRenderer = renderer.toLowerCase();
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4; // GB (if supported)

    // Identify integrated laptop/desktop GPUs (Intel HD/UHD/Iris, AMD Radeon APU)
    // These benefit hugely from 1.0x pixelRatio and disabling 4x MSAA, while still keeping 3D trees & full UI effects.
    const isIntegratedGpu = (
        lowerRenderer.includes('intel') ||
        lowerRenderer.includes('hd graphics') ||
        lowerRenderer.includes('uhd graphics') ||
        lowerRenderer.includes('iris') ||
        lowerRenderer.includes('radeon(tm) graphics') ||
        lowerRenderer.includes('radeon graphics')
    );

    // Identify strictly low-end mobile GPUs, software renderers, or low-core/RAM systems:
    if (
        lowerRenderer.includes('mali-400') ||
        lowerRenderer.includes('mali-t') ||
        lowerRenderer.includes('adreno (tm) 3') ||
        lowerRenderer.includes('adreno (tm) 4') ||
        lowerRenderer.includes('adreno (tm) 505') ||
        lowerRenderer.includes('adreno (tm) 506') ||
        lowerRenderer.includes('powervr') ||
        lowerRenderer.includes('llvmpipe') ||
        lowerRenderer.includes('swiftshader') ||
        lowerRenderer.includes('software') ||
        (isIntegratedGpu && (cores <= 4 || memory <= 4)) ||
        cores <= 2 ||
        memory <= 2
    ) {
        isLowEnd = true;
    }

    gpuInfoCache = {
        vendor,
        renderer,
        cores,
        memory,
        isLowEnd,
        isIntegratedGpu
    };

    isLowEndHardwareDetected = isLowEnd;
    isIntegratedGpuDetected = isIntegratedGpu;
    if (isIntegratedGpu || isLowEnd) {
        state.lowPerformanceMode = true;
    }
    const modeLabel = isMobileDevice() ? 'Mobile' : 'Kiosk';
    console.log(`[Performance] Hardware Profile (${modeLabel}): ${renderer} | Cores: ${cores} | RAM: ~${memory}GB | Integrated GPU: ${isIntegratedGpu ? 'YES (Auto Eco-Tuned)' : 'NO'} | Low-End Profile: ${isLowEnd ? 'ACTIVE' : 'OFF'}`);
    applyPerformanceProfileClass();
    return gpuInfoCache;
}

export function applyPerformanceProfileClass() {
    if (typeof document === 'undefined') return;
    const profile = getActivePerformanceProfile();
    const isEco = (profile === 'eco');
    const isLowPerf = isEco || (profile === 'auto' && (isLowEndHardwareDetected || isIntegratedGpuDetected || state.lowPerformanceMode));
    
    const applyToDoc = () => {
        if (document.body) {
            document.body.classList.toggle('low-perf-mode', isLowPerf);
        }
        if (document.documentElement) {
            document.documentElement.classList.toggle('low-perf-mode', isLowPerf);
        }
        try {
            if (state.map && typeof state.map.getLayer === 'function' && state.map.getLayer('3d-trees-layer')) {
                state.map.setLayoutProperty('3d-trees-layer', 'visibility', isLowPerf ? 'none' : (state.treesVisible !== false ? 'visible' : 'none'));
            }
        } catch (e) {}
    };

    if (document.body) {
        applyToDoc();
    } else {
        document.addEventListener('DOMContentLoaded', applyToDoc, { once: true });
    }
}

// 2. Compute Optimal Pixel Ratio (Differentiated for Mobile vs Kiosk)
export function getOptimalPixelRatio() {
    if (typeof window === 'undefined') return 1.0;

    const profile = getActivePerformanceProfile();
    const nativeDpr = window.devicePixelRatio || 1.0;
    const hardware = detectGpuHardware();
    const isMobile = isMobileDevice();

    if (isMobile) {
        // MOBILE-SPECIFIC PERFORMANCE CALIBRATION:
        // High-DPI smartphone displays (2x-3.5x Retina) consume heavy GPU memory and battery.
        // We calibrate specifically for phone thermals and battery lifespan.
        if (profile === 'high') {
            // High Quality (Retina HD): Clamped to 2.0x for crisp sharpness without burning phone battery
            activePixelRatio = Math.min(nativeDpr, 2.0);
        } else if (profile === 'eco') {
            // Battery Saver: Strictly 1.0x (coolest phone temperature, saves ~60% GPU power)
            activePixelRatio = 1.0;
        } else {
            // Auto Adaptive (Mobile):
            const baseRatio = (hardware.isLowEnd || hardware.cores <= 4 || hardware.memory <= 4 || state.lowPerformanceMode)
                ? 1.0
                : Math.min(nativeDpr, 1.25);
            activePixelRatio = Math.max(0.75, Math.round(baseRatio * dynamicResolutionScale * 100) / 100);
        }
    } else {
        // KIOSK / DESKTOP HARDWARE CALIBRATION:
        if (profile === 'high') {
            // Native DPI with anti-aliasing (up to 1.5x)
            activePixelRatio = Math.min(nativeDpr, 1.5);
        } else if (profile === 'eco') {
            // Kiosk Eco: Strictly 1.0x (optimized for Intel Core i3 / i5 & AMD Radeon integrated GPUs)
            activePixelRatio = 1.0;
        } else {
            // Auto Adaptive (Kiosk):
            const baseRatio = (hardware.isLowEnd || hardware.isIntegratedGpu || state.lowPerformanceMode || window.innerWidth > 1920 || nativeDpr > 1.5)
                ? 1.0
                : Math.min(nativeDpr, 1.25);
            activePixelRatio = Math.max(0.75, Math.round(baseRatio * dynamicResolutionScale * 100) / 100);
        }
    }

    return activePixelRatio;
}

// 3. Real-Time Multi-Tier Adaptive Performance Engine
export function reportFrameRate(fps) {
    if (typeof fps !== 'number' || isNaN(fps) || fps <= 0) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    // Ignore frame drops during initial map load, style switches, 3D GLB model parsing, and intro fly-in sequence
    if (!state.mapReady || state.isIntroAnimating || now < styleGraceUntil || (now - moduleLoadTime < STARTUP_GRACE_MS)) {
        fpsHistory = [];
        lastFpsCheckTime = now;
        return;
    }

    fpsHistory.push(fps);
    if (fpsHistory.length > 6) fpsHistory.shift();

    if (now - lastFpsCheckTime < 1500 || fpsHistory.length < 3) return; // Evaluate every 1.5s (3 active samples)
    lastFpsCheckTime = now;

    const avgFps = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length);
    const profile = getActivePerformanceProfile();

    // In 'auto' mode, dynamically adapt in 3 tiers so the map never lags:
    // - Tier 1 (avgFps < 45): Enable low-perf-mode (turns off heavy CSS backdrop-filter blur & infinite marker pulses)
    // - Tier 2 (avgFps < 34 while in low-perf-mode): Scale WebGL pixelRatio to 0.85x (-28% fragment shader load)
    // - Tier 3 (avgFps < 25 while at 0.85x): Scale WebGL pixelRatio to 0.75x (-44% fragment shader load)
    // - Smooth Recovery (avgFps >= 56 for 6 samples): Step pixelRatio back up toward 1.0x without re-enabling laggy blur
    if (profile === 'auto') {
        const isCurrentlyLowPerf = isLowEndHardwareDetected || isIntegratedGpuDetected || state.lowPerformanceMode;

        if (avgFps < 45 && !isCurrentlyLowPerf) {
            console.info(`[Performance] Auto Adaptive Tier 1: Active FPS (${avgFps}) < 45. Disabling heavy glass blur & pulse animations.`);
            state.lowPerformanceMode = true;
            applyPerformanceProfileClass();
            const newRatio = getOptimalPixelRatio();
            if (state.map && typeof state.map.setPixelRatio === 'function') {
                try { state.map.setPixelRatio(newRatio); } catch (e) {}
            }
            updatePerformanceUI();
        } else if (avgFps < 34 && isCurrentlyLowPerf && dynamicResolutionScale > 0.85) {
            dynamicResolutionScale = 0.85;
            const newRatio = getOptimalPixelRatio();
            console.info(`[Performance] Auto Adaptive Tier 2: Active FPS (${avgFps}) < 34. Scaling render resolution to ${newRatio.toFixed(2)}x.`);
            if (state.map && typeof state.map.setPixelRatio === 'function') {
                try { state.map.setPixelRatio(newRatio); } catch (e) {}
            }
            updatePerformanceUI();
        } else if (avgFps < 25 && isCurrentlyLowPerf && dynamicResolutionScale > 0.75) {
            dynamicResolutionScale = 0.75;
            const newRatio = getOptimalPixelRatio();
            console.info(`[Performance] Auto Adaptive Tier 3: Active FPS (${avgFps}) < 25. Scaling render resolution to ${newRatio.toFixed(2)}x.`);
            if (state.map && typeof state.map.setPixelRatio === 'function') {
                try { state.map.setPixelRatio(newRatio); } catch (e) {}
            }
            updatePerformanceUI();
        } else if (avgFps >= 56 && fpsHistory.length >= 6 && dynamicResolutionScale < 1.0) {
            dynamicResolutionScale = dynamicResolutionScale < 0.85 ? 0.85 : 1.0;
            const newRatio = getOptimalPixelRatio();
            console.info(`[Performance] Auto Adaptive Recovery: Sustained ${avgFps} FPS. Restoring render resolution to ${newRatio.toFixed(2)}x.`);
            if (state.map && typeof state.map.setPixelRatio === 'function') {
                try { state.map.setPixelRatio(newRatio); } catch (e) {}
            }
            updatePerformanceUI();
        }
    }
}

// 4. Quality Profile Setter (Differentiated Storage)
export function setPerformanceProfile(profile) {
    if (!profile || !['auto', 'eco', 'high'].includes(profile)) {
        profile = 'auto';
    }

    // Reset dynamic resolution scale when user explicitly switches profiles
    dynamicResolutionScale = 1.0;
    fpsHistory = [];

    const isMobile = isMobileDevice();
    const key = getProfileStorageKey();

    if (isMobile) {
        state.mobilePerformanceProfile = profile;
        if (typeof window !== 'undefined') window.__da_current_mobile_perf_profile = profile;
    } else {
        state.performanceProfile = profile;
        if (typeof window !== 'undefined') window.__da_current_perf_profile = profile;
    }

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, profile);
        }
    } catch (e) {
        console.warn(`[Performance] Could not persist ${key}:`, e);
    }

    const newRatio = getOptimalPixelRatio();
    if (state.map) {
        try {
            if (typeof state.map.setPixelRatio === 'function') {
                state.map.setPixelRatio(newRatio);
            }
        } catch (e) {}
    }

    applyPerformanceProfileClass();
    updatePerformanceUI();
    console.log(`[Performance] ${isMobile ? 'Mobile' : 'Kiosk'} profile set to '${profile}' (Active pixelRatio: ${newRatio})`);
}

export function getActivePerformanceProfile() {
    const isMobile = isMobileDevice();
    const key = getProfileStorageKey();

    let p = isMobile ? state.mobilePerformanceProfile : state.performanceProfile;
    if (!p && typeof window !== 'undefined') {
        p = isMobile ? window.__da_current_mobile_perf_profile : window.__da_current_perf_profile;
    }
    if (!p && typeof localStorage !== 'undefined') {
        try {
            p = localStorage.getItem(key);
        } catch (e) {}
    }
    if (!p || !['auto', 'eco', 'high'].includes(p)) {
        p = 'auto';
    }

    if (isMobile) {
        state.mobilePerformanceProfile = p;
    } else {
        state.performanceProfile = p;
    }
    return p;
}

// 5. Sync with Map Display Settings Modal (Differentiated Labels & Copy)
export function updatePerformanceUI() {
    const isMobile = isMobileDevice();
    const p = getActivePerformanceProfile();

    // 1. Differentiated Section Tag & Title
    const tagEl = document.getElementById('msp-perf-tag');
    const titleEl = document.getElementById('msp-perf-title');

    if (tagEl) {
        tagEl.textContent = isMobile ? 'BATTERY' : 'HARDWARE';
        if (isMobile) {
            tagEl.style.background = 'rgba(56, 189, 248, 0.15)';
            tagEl.style.color = '#38bdf8';
            tagEl.style.borderColor = 'rgba(56, 189, 248, 0.3)';
        } else {
            tagEl.style.background = 'rgba(16, 185, 129, 0.15)';
            tagEl.style.color = '#10b981';
            tagEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        }
    }
    if (titleEl) {
        titleEl.textContent = isMobile ? 'Mobile Performance Profile' : 'Kiosk Performance Profile';
    }

    // 2. Differentiated Button Content & Tooltips
    const btnAuto = document.getElementById('perf-btn-auto');
    const btnEco = document.getElementById('perf-btn-eco');
    const btnHigh = document.getElementById('perf-btn-high');

    const iconAuto = document.getElementById('perf-icon-auto');
    const nameAuto = document.getElementById('perf-name-auto');
    const subAuto = document.getElementById('perf-sub-auto');

    const iconEco = document.getElementById('perf-icon-eco');
    const nameEco = document.getElementById('perf-name-eco');
    const subEco = document.getElementById('perf-sub-eco');

    const iconHigh = document.getElementById('perf-icon-high');
    const nameHigh = document.getElementById('perf-name-high');
    const subHigh = document.getElementById('perf-sub-high');

    if (btnAuto) {
        btnAuto.classList.toggle('active', p === 'auto');
        btnAuto.title = isMobile
            ? 'Smart adaptive balance between battery life and crisp rendering'
            : 'Automatically adjusts UI effects and render resolution to prevent lag';
    }
    if (iconAuto) iconAuto.innerHTML = lucideIcon('zap', 16);
    if (nameAuto) nameAuto.textContent = 'Auto';
    if (subAuto) {
        const isAutoEco = (p === 'auto') && (isLowEndHardwareDetected || isIntegratedGpuDetected || state.lowPerformanceMode);
        if (p === 'auto' && dynamicResolutionScale < 1.0) {
            subAuto.textContent = `Scaled ${activePixelRatio.toFixed(2)}x`;
        } else if (isAutoEco) {
            subAuto.textContent = 'Eco-Tuned';
        } else {
            subAuto.textContent = isMobile ? 'Balanced' : 'Adaptive';
        }
    }

    if (btnEco) {
        btnEco.classList.toggle('active', p === 'eco');
        btnEco.title = isMobile
            ? 'Locks rendering to 1.0x to maximize battery life and keep device cool'
            : 'Low-power mode optimized for Intel Core i3 / i5 & AMD Radeon Integrated Graphics';
    }
    if (iconEco) iconEco.innerHTML = lucideIcon(isMobile ? 'battery-charging' : 'leaf', 16);
    if (nameEco) nameEco.textContent = isMobile ? 'Battery Saver' : 'Kiosk Eco';
    if (subEco) subEco.textContent = isMobile ? 'Cool & Efficient' : 'i3 / i5 GPU';

    if (btnHigh) {
        btnHigh.classList.toggle('active', p === 'high');
        btnHigh.title = isMobile
            ? 'Full Retina HD resolution for high-end smartphones'
            : 'Native retina resolution with full anti-aliasing';
    }
    if (iconHigh) iconHigh.innerHTML = lucideIcon('gem', 16);
    if (nameHigh) nameHigh.textContent = isMobile ? 'High Quality' : 'High';
    if (subHigh) subHigh.textContent = isMobile ? 'Retina HD' : 'Native DPI';

    // 3. Status card summary
    const descEl = document.getElementById('perf-status-desc');
    if (descEl) {
        const hw = detectGpuHardware();
        const devLabel = isMobile ? `${lucideIcon('smartphone', 12)} Mobile` : `${lucideIcon('monitor', 12)} Kiosk`;
        const renderer = (hw && hw.renderer) ? hw.renderer : 'Standard';
        const shortGpu = renderer.length > 28 ? renderer.substring(0, 28) + '…' : renderer;
        const autoModeNote = (p === 'auto' && (hw.isIntegratedGpu || hw.isLowEnd || state.lowPerformanceMode))
            ? ' <span style="color:#10b981;font-weight:700;">(Eco-Tuned)</span>'
            : '';
        descEl.innerHTML = `<strong>Device:</strong> ${devLabel} • <strong>GPU:</strong> ${shortGpu} • <strong>Render:</strong> ${activePixelRatio.toFixed(2)}x${autoModeNote}`;
    }
}

// Global reflections for inline HTML handlers
if (typeof window !== 'undefined') {
    window.detectGpuHardware = detectGpuHardware;
    window.getOptimalPixelRatio = getOptimalPixelRatio;
    window.applyPerformanceProfileClass = applyPerformanceProfileClass;
    window.setPerformanceProfile = setPerformanceProfile;
    window.getActivePerformanceProfile = getActivePerformanceProfile;
    window.updatePerformanceUI = updatePerformanceUI;
    window.isMobileDevice = isMobileDevice;
}
