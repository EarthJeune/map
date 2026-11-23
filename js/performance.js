// DA-LARES Wayfinding — Adaptive Hardware & Performance Controller Module
// Automatically tunes rendering resolution, frame throttling, and GPU/battery workload.
// Provides dedicated calibration for Kiosk (Intel Core i3 / i5) and Mobile Devices (Battery Saver / Retina).

import { state } from './data/state.js';
import { lucideIcon } from './data/icons.js';

const NATIVE_DPR = (typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 0)
    ? window.devicePixelRatio
    : 1.0;

let gpuInfoCache = null;
let activePixelRatio = 1.0;
let appliedCanvasPixelRatio = null;
let dynamicResolutionScale = 1.0; // 1.0, 0.85, or 0.75 (adjusted in real time by Auto mode)
let fpsHistory = [];
let lastFpsCheckTime = 0;
let isLowEndHardwareDetected = false;
let isIntegratedGpuDetected = false;
let styleGraceUntil = 0;
const moduleLoadTime = (typeof performance !== 'undefined') ? performance.now() : Date.now();
const STARTUP_GRACE_MS = 4000; // Wait 4s for initial map load before real-time FPS adaptation

export function getNativeDevicePixelRatio() {
    return NATIVE_DPR;
}

/**
 * Mapbox GL JS v3.x reads `window.devicePixelRatio` directly inside `_resizeCanvas`.
 * Keep a clean getter backed by `activePixelRatio` and resize the WebGL backing store when changed.
 */
export function applyMapboxPixelRatio(ratio, targetMap = state.map) {
    if (typeof window === 'undefined' || typeof ratio !== 'number' || isNaN(ratio) || ratio <= 0) {
        return;
    }
    const clamped = Math.max(0.55, Math.min(ratio, Math.max(1.0, NATIVE_DPR)));
    activePixelRatio = clamped;

    try {
        Object.defineProperty(window, 'devicePixelRatio', {
            configurable: true,
            get: () => activePixelRatio
        });
    } catch (e) { }

    const mapObj = targetMap || (typeof window !== 'undefined' ? window.map : null);
    if (!mapObj || appliedCanvasPixelRatio === clamped) {
        appliedCanvasPixelRatio = clamped;
        return;
    }
    appliedCanvasPixelRatio = clamped;

    try {
        const container = typeof mapObj.getContainer === 'function' ? mapObj.getContainer() : null;
        const w = container ? container.clientWidth : 0;
        const h = container ? container.clientHeight : 0;
        if (w > 0 && h > 0) {
            if (typeof mapObj._resizeCanvas === 'function') {
                mapObj._resizeCanvas(w, h);
            }
            if (mapObj.painter && typeof mapObj.painter.resize === 'function') {
                mapObj.painter.resize(w, h);
            }
            if (typeof mapObj.resize === 'function') {
                mapObj.resize();
            }
            if (typeof mapObj.triggerRepaint === 'function') {
                mapObj.triggerRepaint();
            }
        }
    } catch (e) { }
}

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
    const hasExplicitMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory > 0;
    const memory = hasExplicitMemory ? navigator.deviceMemory : 8; // Do not penalize browsers (iOS Safari/Firefox) that omit deviceMemory

    // Identify integrated laptop/desktop GPUs (Intel HD/UHD/Iris, AMD Radeon APU)
    const isIntegratedGpu = (
        lowerRenderer.includes('intel') ||
        lowerRenderer.includes('hd graphics') ||
        lowerRenderer.includes('uhd graphics') ||
        lowerRenderer.includes('iris') ||
        lowerRenderer.includes('radeon(tm) graphics') ||
        lowerRenderer.includes('radeon graphics')
    );

    // Identify strictly low-end legacy GPUs, software renderers, or <= 2GB RAM / <= 2-core devices.
    // Modern smartphones (often bucketed at deviceMemory=4) and standard laptops start in crisp Full-Res in Auto mode
    // and only scale down dynamically if real-time measured FPS drops.
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
        /hd graphics\s*(4\d\d\d|5\d\d\d)|uhd graphics\s*600|celeron|pentium|atom/i.test(lowerRenderer) ||
        cores <= 2 ||
        (hasExplicitMemory && memory <= 2)
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
    if (isLowEnd) {
        state.lowPerformanceMode = true;
    }
    const modeLabel = isMobileDevice() ? 'Mobile' : 'Kiosk';
    console.log(`[Performance] Hardware Profile (${modeLabel}): ${renderer} | Cores: ${cores} | RAM: ~${memory}GB | Integrated GPU: ${isIntegratedGpu ? 'YES' : 'NO'} | Low-End Profile: ${isLowEnd ? 'ACTIVE' : 'OFF'}`);
    applyPerformanceProfileClass();
    return gpuInfoCache;
}

export function applyPerformanceProfileClass() {
    if (typeof document === 'undefined') return;
    const profile = getActivePerformanceProfile();
    const isEco = (profile === 'eco');
    const isLowPerf = isEco || (profile === 'auto' && (isLowEndHardwareDetected || state.lowPerformanceMode || dynamicResolutionScale < 1.0));
    
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

export function isEcoPerfMode() {
    const profile = getActivePerformanceProfile();
    if (profile === 'eco') return true;
    if (profile === 'high') return false;
    const hw = detectGpuHardware();
    return Boolean((hw && hw.isLowEnd) || dynamicResolutionScale < 1.0);
}

// Backward-compatible alias (keeps authentic 3D .glb models while lowering render resolution & GPU effects)
export function isLowPolyMode() {
    return isEcoPerfMode();
}

// 2. Compute Optimal Pixel Ratio (Differentiated for Mobile vs Kiosk)
export function getOptimalPixelRatio() {
    if (typeof window === 'undefined') return 1.0;

    const profile = getActivePerformanceProfile();
    const nativeDpr = NATIVE_DPR;
    const hardware = detectGpuHardware();
    const isMobile = isMobileDevice();

    if (isMobile) {
        if (profile === 'high') {
            activePixelRatio = Math.min(nativeDpr, 2.0);
        } else if (profile === 'eco') {
            // Battery Saver (Low-Res 3D): 0.70x WebGL buffer while keeping authentic 3D .glb buildings & native sharp DOM pills
            activePixelRatio = 0.70;
        } else {
            // Auto on Mobile: start crisp (up to 1.35x on Retina phones) and scale down only if real-time FPS drops
            const baseRatio = hardware.isLowEnd
                ? 0.78
                : Math.min(nativeDpr, 1.35);
            activePixelRatio = Math.max(0.65, Math.round(baseRatio * dynamicResolutionScale * 100) / 100);
        }
    } else {
        // KIOSK / DESKTOP / LAPTOP HARDWARE CALIBRATION:
        if (profile === 'high') {
            activePixelRatio = Math.min(nativeDpr, 1.75);
        } else if (profile === 'eco') {
            // Kiosk Eco (Low-Res 3D): 0.65x cuts 1080x1920 pixel shader work by 58% while keeping authentic 3D GLBs & native UI crisp
            activePixelRatio = 0.65;
        } else if (hardware.isLowEnd) {
            // Auto Low-End Kiosk (i3-5010U / HD Graphics 5500 / <= 2GB RAM): start directly at 0.75x
            activePixelRatio = Math.max(0.60, Math.round(0.75 * dynamicResolutionScale * 100) / 100);
        } else {
            const baseRatio = hardware.isIntegratedGpu
                ? Math.min(nativeDpr, 1.15)
                : Math.min(nativeDpr, 1.35);
            activePixelRatio = Math.max(0.65, Math.round(baseRatio * dynamicResolutionScale * 100) / 100);
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
        if (avgFps < 38 && dynamicResolutionScale > 0.85) {
            dynamicResolutionScale = 0.85;
            state.lowPerformanceMode = true;
            applyPerformanceProfileClass();
            const newRatio = getOptimalPixelRatio();
            console.info(`[Performance] Auto Adaptive Step-Down 1: Active FPS (${avgFps}) < 38. Scaling render resolution to ${newRatio.toFixed(2)}x.`);
            applyMapboxPixelRatio(newRatio);
            updatePerformanceUI();
        } else if (avgFps < 26 && dynamicResolutionScale > 0.72) {
            dynamicResolutionScale = 0.72;
            state.lowPerformanceMode = true;
            applyPerformanceProfileClass();
            const newRatio = getOptimalPixelRatio();
            console.info(`[Performance] Auto Adaptive Step-Down 2: Active FPS (${avgFps}) < 26. Scaling render resolution to ${newRatio.toFixed(2)}x.`);
            applyMapboxPixelRatio(newRatio);
            updatePerformanceUI();
        } else if (avgFps >= 52 && fpsHistory.length >= 6 && (dynamicResolutionScale < 1.0 || (state.lowPerformanceMode && !isLowEndHardwareDetected))) {
            dynamicResolutionScale = dynamicResolutionScale < 0.85 ? 0.85 : 1.0;
            if (dynamicResolutionScale >= 1.0 && !isLowEndHardwareDetected) {
                state.lowPerformanceMode = false;
            }
            applyPerformanceProfileClass();
            const newRatio = getOptimalPixelRatio();
            console.info(`[Performance] Auto Adaptive Recovery: Sustained ${avgFps} FPS. Restoring render resolution to ${newRatio.toFixed(2)}x.`);
            applyMapboxPixelRatio(newRatio);
            updatePerformanceUI();
        }
    }
}

// 4. Quality Profile Setter (Differentiated Storage)
export function setPerformanceProfile(profile) {
    if (!profile || !['auto', 'eco', 'high'].includes(profile)) {
        profile = 'auto';
    }

    // Reset dynamic resolution scale & low-perf state when user explicitly switches profiles
    dynamicResolutionScale = 1.0;
    fpsHistory = [];
    state.lowPerformanceMode = (profile === 'eco') ? true : isLowEndHardwareDetected;

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
    applyMapboxPixelRatio(newRatio);

    applyPerformanceProfileClass();
    if (typeof window !== 'undefined' && typeof window.syncLowPolyBuildingMode === 'function') {
        try { window.syncLowPolyBuildingMode(); } catch (e) {}
    }
    updatePerformanceUI();
    console.log(`[Performance] ${isMobile ? 'Mobile' : 'Kiosk'} profile set to '${profile}' (Active pixelRatio: ${newRatio}, Eco Low-Res: ${isEcoPerfMode()})`);
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
            ? 'Starts in crisp High-Res and automatically scales down only if FPS drops'
            : 'Starts in crisp High-Res and automatically scales render resolution if FPS drops';
    }
    if (iconAuto) iconAuto.innerHTML = lucideIcon('zap', 16);
    if (nameAuto) nameAuto.textContent = 'Auto';
    if (subAuto) {
        if (p === 'auto' && (dynamicResolutionScale < 1.0 || isLowEndHardwareDetected)) {
            subAuto.textContent = `Auto ${activePixelRatio.toFixed(2)}x`;
        } else {
            subAuto.textContent = isMobile ? 'Auto HD' : 'Adaptive HD';
        }
    }

    if (btnEco) {
        btnEco.classList.toggle('active', p === 'eco');
        btnEco.title = isMobile
            ? 'Lower-resolution 3D rendering (0.70x WebGL) keeping authentic 3D building models to save battery & boost FPS'
            : 'Lower-resolution 3D rendering (0.65x WebGL) keeping authentic 3D building models for Intel HD & low-RAM kiosks';
    }
    if (iconEco) iconEco.innerHTML = lucideIcon(isMobile ? 'battery-charging' : 'leaf', 16);
    if (nameEco) nameEco.textContent = isMobile ? 'Battery Saver' : 'Kiosk Eco';
    if (subEco) subEco.textContent = 'Low-Res 3D';

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
        const devLabel = isMobile ? `${lucideIcon('smartphone', 12)} Mobile` : `${lucideIcon('monitor', 12)} Kiosk`;
        const isEcoRes = isEcoPerfMode();
        const autoModeNote = (p === 'auto')
            ? ` <span style="color:#10b981;font-weight:700;">(${isEcoRes ? 'Auto Low-Res' : 'Auto High-Res'})</span>`
            : '';
        const modeTag = isEcoRes ? 'Low-Res 3D GLB' : 'Full-Res 3D GLB';
        descEl.innerHTML = `<strong>Device:</strong> ${devLabel} • <strong>3D:</strong> ${modeTag} • <strong>Render:</strong> ${activePixelRatio.toFixed(2)}x${autoModeNote}`;
    }
}

// Global reflections for inline HTML handlers
if (typeof window !== 'undefined') {
    window.detectGpuHardware = detectGpuHardware;
    window.isEcoPerfMode = isEcoPerfMode;
    window.isLowPolyMode = isLowPolyMode;
    window.getOptimalPixelRatio = getOptimalPixelRatio;
    window.applyMapboxPixelRatio = applyMapboxPixelRatio;
    window.applyPerformanceProfileClass = applyPerformanceProfileClass;
    window.setPerformanceProfile = setPerformanceProfile;
    window.getActivePerformanceProfile = getActivePerformanceProfile;
    window.updatePerformanceUI = updatePerformanceUI;
    window.isMobileDevice = isMobileDevice;
}
