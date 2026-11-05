// DA-LARES Drone Orthomosaic Interactive Alignment & Calibration Module
// Enables real-time visual alignment of 3D campus models, building footprints,
// markers, and boundaries with high-resolution drone orthomosaics in Admin Mode.

import { state } from './data/state.js';
import { CUSTOM_3D_BUILDINGS, LARES_DRAWINGS, BUILDING_DIRECTORY } from './data/buildings.js';
import { lucideIcon } from './data/icons.js';

// Precise geodetic conversion factors at DA-LARES latitude (~13.958° N)
const METERS_PER_DEG_LAT = 111139.0;
const METERS_PER_DEG_LNG = 107860.0;

let currentStep = 0.2; // default nudge step in meters
let isHudOpen = false;
let isHudMinimized = false;
let animFrameId = null;

// Original cache copies for unpolluted delta application
let cachedBuildingFeatures = null;
let cachedDrawingFeatures = null;
let cachedTreesData = null;

export function syncAdminDroneDOM() {
    const existingBtn = document.getElementById('admin-drone-calib-btn');
    if (existingBtn) existingBtn.remove();

    if (state.isAdmin) {
        buildDroneCalibrationHUD();
    } else {
        isHudOpen = false;
        const existingHud = document.getElementById('drone-calib-hud');
        if (existingHud) existingHud.remove();
        const existingToast = document.getElementById('dcal-toast');
        if (existingToast) existingToast.remove();
    }
}

export function initDroneCalibration() {
    // 1. Mount HUD in DOM strictly when Admin Mode is active (visitors get zero admin DOM elements)
    syncAdminDroneDOM();

    // 2. Fetch saved calibration asynchronously in background
    fetchSavedOffset();

    // 3. Initial sync if starting on Drone View
    syncDroneOffsetOnStyleChange();

    // 4. Attach keyboard listeners for arrow key nudging and Alt+Shift+D toggle
    window.addEventListener('keydown', handleCalibrationKeydown);
    window.addEventListener('keydown', (e) => {
        if (state.isAdmin && e.altKey && (e.key === 'D' || e.key === 'd')) {
            e.preventDefault();
            toggleDroneCalibrationHUD();
        }
    });
}

async function fetchSavedOffset() {
    try {
        const res = await fetch('/api/drone-offset');
        if (res.ok) {
            const data = await res.json();
            if (typeof data.dx === 'number') {
                state.droneOffset.dx = data.dx;
                state.savedDroneOffset.dx = data.dx;
            }
            if (typeof data.dy === 'number') {
                state.droneOffset.dy = data.dy;
                state.savedDroneOffset.dy = data.dy;
            }
            if (typeof data.autoApply === 'boolean') state.droneOffset.autoApply = data.autoApply;

            const sliderX = document.getElementById('dcal-slider-x');
            const sliderY = document.getElementById('dcal-slider-y');
            if (sliderX) sliderX.value = state.droneOffset.dx;
            if (sliderY) sliderY.value = state.droneOffset.dy;
            updateHudReadout(state.droneOffset.dx, state.droneOffset.dy);
            syncDroneOffsetOnStyleChange();
        }
    } catch (e) {
        try {
            const local = localStorage.getItem('da_drone_offset');
            if (local) {
                const parsed = JSON.parse(local);
                if (typeof parsed.dx === 'number') {
                    state.droneOffset.dx = parsed.dx;
                    state.savedDroneOffset.dx = parsed.dx;
                }
                if (typeof parsed.dy === 'number') {
                    state.droneOffset.dy = parsed.dy;
                    state.savedDroneOffset.dy = parsed.dy;
                }
                if (typeof parsed.autoApply === 'boolean') state.droneOffset.autoApply = parsed.autoApply;

                const sliderX = document.getElementById('dcal-slider-x');
                const sliderY = document.getElementById('dcal-slider-y');
                if (sliderX) sliderX.value = state.droneOffset.dx;
                if (sliderY) sliderY.value = state.droneOffset.dy;
                updateHudReadout(state.droneOffset.dx, state.droneOffset.dy);
                syncDroneOffsetOnStyleChange();
            }
        } catch (err) { }
    }
}


// Convert meters offset to GPS delta
export function metersToGPSDelta(dx, dy) {
    return {
        dLng: dx / METERS_PER_DEG_LNG,
        dLat: dy / METERS_PER_DEG_LAT
    };
}

// Update all campus layers synchronously in real time
export function applyDroneOffset(dx, dy, force = false) {
    state.droneOffset.dx = dx;
    state.droneOffset.dy = dy;

    updateHudReadout(dx, dy);

    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(() => {
        executeLayerShift(dx, dy, force);
    });
}

function executeLayerShift(dx, dy, force = false) {
    const currentMap = state.map || window.map;
    if (!currentMap) return;

    // Apply calibration offset across both Mapbox 3D and Aerial Drone views
    const effectiveDx = (state.droneOffset.autoApply || force) ? dx : 0;
    const effectiveDy = (state.droneOffset.autoApply || force) ? dy : 0;

    const { dLng, dLat } = metersToGPSDelta(effectiveDx, effectiveDy);

    // A. 3D Building Models Layer
    const modelsSource = currentMap.getSource('lares-3d-buildings-models-source');
    if (modelsSource && typeof CUSTOM_3D_BUILDINGS !== 'undefined') {
        const shiftedModelFeatures = Object.keys(CUSTOM_3D_BUILDINGS).map(id => {
            const b = CUSTOM_3D_BUILDINGS[id];
            return {
                type: 'Feature',
                id: id,
                geometry: {
                    type: 'Point',
                    coordinates: [b.coords[0] + dLng, b.coords[1] + dLat]
                },
                properties: {
                    id: id,
                    model: b.modelId,
                    rotation: b.rotation || 0,
                    scale: b.scale || [1, 1, 1]
                }
            };
        });
        try {
            modelsSource.setData({
                type: 'FeatureCollection',
                features: shiftedModelFeatures
            });
        } catch (e) { }
    }

    // B. 2D Building Drawings & Roofs
    const dwgSource = currentMap.getSource('lares-drawings-source');
    if (dwgSource && LARES_DRAWINGS && LARES_DRAWINGS.features) {
        if (!cachedDrawingFeatures) {
            cachedDrawingFeatures = JSON.parse(JSON.stringify(LARES_DRAWINGS.features));
            if (typeof CUSTOM_3D_BUILDINGS !== 'undefined') {
                cachedDrawingFeatures.forEach(f => {
                    if (f.properties && CUSTOM_3D_BUILDINGS[f.properties.id]) {
                        f.properties.has_3d_model = true;
                    }
                });
            }
        }
        const shiftedFeatures = cachedDrawingFeatures.map(f => {
            const geom = JSON.parse(JSON.stringify(f.geometry));
            if (geom.type === 'Polygon') {
                geom.coordinates = geom.coordinates.map(ring =>
                    ring.map(pt => [pt[0] + dLng, pt[1] + dLat])
                );
            } else if (geom.type === 'MultiPolygon') {
                geom.coordinates = geom.coordinates.map(poly =>
                    poly.map(ring => ring.map(pt => [pt[0] + dLng, pt[1] + dLat]))
                );
            }
            return { ...f, geometry: geom };
        });
        try {
            dwgSource.setData({
                type: 'FeatureCollection',
                features: shiftedFeatures
            });
        } catch (e) { }
    }

    // C. Building Pin Markers (Look up by canonical building ID, NOT array index, since sub-plots are filtered out of state.markers)
    if (state.markers && state.markers.length > 0 && typeof BUILDING_DIRECTORY !== 'undefined') {
        state.markers.forEach((m) => {
            const el = m.getElement ? m.getElement() : null;
            const bId = el ? el.dataset.id : null;
            const b = bId ? BUILDING_DIRECTORY.find(item => item.id === bId) : null;
            if (b && m && typeof m.setLngLat === 'function') {
                m.setLngLat([b.coords[0] + dLng, b.coords[1] + dLat]);
            }
        });
    }

    // D. Trees Source
    const treesSource = currentMap.getSource('lares-3d-trees-source');
    if (treesSource && treesSource._data) {
        if (!cachedTreesData) {
            try {
                cachedTreesData = JSON.parse(JSON.stringify(treesSource._data));
            } catch (e) { }
        }
        if (cachedTreesData && cachedTreesData.features) {
            const shiftedTrees = cachedTreesData.features.map(f => ({
                ...f,
                geometry: {
                    type: 'Point',
                    coordinates: [f.geometry.coordinates[0] + dLng, f.geometry.coordinates[1] + dLat]
                }
            }));
            try {
                treesSource.setData({ type: 'FeatureCollection', features: shiftedTrees });
            } catch (e) { }
        }
    }
}

// Automatically sync offset whenever user switches map style mode
export function syncDroneOffsetOnStyleChange() {
    if (state.droneOffset.autoApply && (state.droneOffset.dx !== 0 || state.droneOffset.dy !== 0)) {
        applyDroneOffset(state.droneOffset.dx, state.droneOffset.dy);
    } else {
        executeLayerShift(state.droneOffset.dx || 0, state.droneOffset.dy || 0, false);
    }
    updateHudStatusBanner();
}

// Save calibrated offset permanently
export async function saveDroneCalibration() {
    const payload = {
        dx: state.droneOffset.dx,
        dy: state.droneOffset.dy,
        autoApply: state.droneOffset.autoApply !== false
    };

    state.savedDroneOffset.dx = payload.dx;
    state.savedDroneOffset.dy = payload.dy;

    try {
        localStorage.setItem('da_drone_offset', JSON.stringify(payload));
    } catch (e) { }

    try {
        const res = await fetch('/api/drone-offset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast(`✅ Drone alignment saved (${payload.dx >= 0 ? '+' : ''}${payload.dx.toFixed(2)}m, ${payload.dy >= 0 ? '+' : ''}${payload.dy.toFixed(2)}m)`);
            return;
        }
    } catch (e) { }

    showToast(`✅ Saved locally (${payload.dx >= 0 ? '+' : ''}${payload.dx.toFixed(2)}m, ${payload.dy >= 0 ? '+' : ''}${payload.dy.toFixed(2)}m)`);
}

// Reset calibration to factory default (0.00m) and zero overlay
export async function resetToDefaultCalibration() {
    applyDroneOffset(0, 0);
    setGmapsOverlayOpacity(0.0);
    state.droneOffset.dx = 0;
    state.droneOffset.dy = 0;
    state.savedDroneOffset.dx = 0;
    state.savedDroneOffset.dy = 0;

    const sliderX = document.getElementById('dcal-slider-x');
    const sliderY = document.getElementById('dcal-slider-y');
    if (sliderX) sliderX.value = 0;
    if (sliderY) sliderY.value = 0;

    const payload = {
        dx: 0,
        dy: 0,
        autoApply: state.droneOffset.autoApply !== false
    };

    try {
        localStorage.setItem('da_drone_offset', JSON.stringify(payload));
    } catch (e) { }

    try {
        await fetch('/api/drone-offset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) { }

    showToast('🔄 Calibration reset to default (0.00m)');
}

// Revert unsaved calibration nudges back to last saved offset
export function revertToSavedCalibration() {
    const sx = state.savedDroneOffset?.dx || 0;
    const sy = state.savedDroneOffset?.dy || 0;
    applyDroneOffset(sx, sy);

    const sliderX = document.getElementById('dcal-slider-x');
    const sliderY = document.getElementById('dcal-slider-y');
    if (sliderX) sliderX.value = sx;
    if (sliderY) sliderY.value = sy;

    showToast(`↩️ Reverted to saved (${sx >= 0 ? '+' : ''}${sx.toFixed(2)}m, ${sy >= 0 ? '+' : ''}${sy.toFixed(2)}m)`);
}

// Reset calibration in memory (backwards-compatible alias)
export function resetDroneCalibration() {
    resetToDefaultCalibration();
}

// Dynamically adjust Google Maps Satellite comparison overlay opacity
export function setGmapsOverlayOpacity(opacity) {
    const clamped = Math.max(0, Math.min(1, typeof opacity === 'number' ? opacity : parseFloat(opacity) || 0));
    state.gmapsOverlayOpacity = clamped;

    const currentMap = state.map || window.map;
    if (currentMap) {
        if (!currentMap.getLayer('google-satellite-overlay-layer') && currentMap.getSource('google-satellite')) {
            const beforeId = currentMap.getLayer('lares-boundary-fill') ? 'lares-boundary-fill' : undefined;
            currentMap.addLayer({
                id: 'google-satellite-overlay-layer',
                type: 'raster',
                source: 'google-satellite',
                layout: {
                    visibility: (clamped > 0 && state.currentMapStyleMode === 'google') ? 'visible' : 'none'
                },
                paint: {
                    'raster-opacity': clamped,
                    'raster-fade-duration': 0
                }
            }, beforeId);
        } else if (currentMap.getLayer('google-satellite-overlay-layer')) {
            const isDroneView = (state.currentMapStyleMode === 'google');
            if (clamped > 0 && isDroneView) {
                currentMap.setLayoutProperty('google-satellite-overlay-layer', 'visibility', 'visible');
                currentMap.setPaintProperty('google-satellite-overlay-layer', 'raster-opacity', clamped);
            } else {
                currentMap.setLayoutProperty('google-satellite-overlay-layer', 'visibility', 'none');
            }
        }
    }

    // Update slider & readout
    const slider = document.getElementById('dcal-slider-opacity');
    const readout = document.getElementById('dcal-opacity-num');
    if (slider) slider.value = clamped;
    if (readout) readout.textContent = `${Math.round(clamped * 100)}%`;

    const chips = document.querySelectorAll('.dcal-opacity-chip');
    chips.forEach(chip => {
        const val = parseFloat(chip.dataset.opacity);
        chip.classList.toggle('active', Math.abs(val - clamped) < 0.03);
    });
}


// Keyboard shortcuts when HUD is active
function handleCalibrationKeydown(e) {
    if (!state.isAdmin || !isHudOpen) return;

    // Ignore if typing inside an input
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    let step = currentStep;
    if (e.shiftKey) step = 1.0;
    if (e.ctrlKey || e.altKey) step = 0.05;

    let handled = false;
    let newDx = state.droneOffset.dx;
    let newDy = state.droneOffset.dy;

    switch (e.key) {
        case 'ArrowUp':
            newDy = +(newDy + step).toFixed(3);
            handled = true;
            break;
        case 'ArrowDown':
            newDy = +(newDy - step).toFixed(3);
            handled = true;
            break;
        case 'ArrowLeft':
            newDx = +(newDx - step).toFixed(3);
            handled = true;
            break;
        case 'ArrowRight':
            newDx = +(newDx + step).toFixed(3);
            handled = true;
            break;
    }

    if (handled) {
        e.preventDefault();
        const sliderX = document.getElementById('dcal-slider-x');
        const sliderY = document.getElementById('dcal-slider-y');
        if (sliderX) sliderX.value = newDx;
        if (sliderY) sliderY.value = newDy;
        applyDroneOffset(newDx, newDy);
    }
}

// Build the floating HUD modal
function buildDroneCalibrationHUD() {
    if (document.getElementById('drone-calib-hud')) return;

    const hud = document.createElement('div');
    hud.id = 'drone-calib-hud';
    hud.className = 'drone-calib-hud';
    hud.style.display = 'none';

    hud.innerHTML = `
        <div class="dcal-header" id="dcal-header">
            <div class="dcal-title">
                <span class="dcal-icon">${lucideIcon('satellite', 16)}</span>
                <span>Drone View Calibration</span>
            </div>
            <div class="dcal-header-actions">
                <button class="dcal-btn-icon" id="dcal-min-btn" title="Minimize / Expand">_</button>
                <button class="dcal-btn-icon" id="dcal-close-btn" title="Close Panel">${lucideIcon('x', 15)}</button>
            </div>
        </div>

        <div class="dcal-body" id="dcal-body">
            <!-- Mode Status Banner -->
            <div class="dcal-status" id="dcal-status-banner">
                <span class="dcal-status-dot"></span>
                <span class="dcal-status-text" id="dcal-status-text">Active on: Aerial Drone View</span>
                <button class="dcal-switch-btn" id="dcal-switch-btn" style="display:none;" onclick="selectMapStyle('google')">Switch to Drone View</button>
            </div>

            <!-- Coordinate Delta Readout -->
            <div class="dcal-readout-card">
                <div class="dcal-readout-row">
                    <span class="dcal-label">Offset East/West (X):</span>
                    <strong class="dcal-val" id="dcal-val-x">+0.00 m</strong>
                </div>
                <div class="dcal-readout-row">
                    <span class="dcal-label">Offset North/South (Y):</span>
                    <strong class="dcal-val" id="dcal-val-y">+0.00 m</strong>
                </div>
                <div class="dcal-readout-row dcal-sub-row">
                    <span class="dcal-sub-label">Δ Longitude:</span>
                    <span class="dcal-sub-val" id="dcal-val-dlng">±0.00000000°</span>
                </div>
                <div class="dcal-readout-row dcal-sub-row">
                    <span class="dcal-sub-label">Δ Latitude:</span>
                    <span class="dcal-sub-val" id="dcal-val-dlat">±0.00000000°</span>
                </div>
            </div>

            <!-- Fine-Tuning Range Sliders -->
            <div class="dcal-controls-section">
                <div class="dcal-slider-group">
                    <div class="dcal-slider-header">
                        <span>X Axis (West ◀ ▶ East)</span>
                        <span id="dcal-x-num" class="dcal-num">0.00m</span>
                    </div>
                    <input type="range" id="dcal-slider-x" min="-25.0" max="25.0" step="0.05" value="0" class="dcal-slider">
                </div>

                <div class="dcal-slider-group">
                    <div class="dcal-slider-header">
                        <span>Y Axis (South ▼ ▲ North)</span>
                        <span id="dcal-y-num" class="dcal-num">0.00m</span>
                    </div>
                    <input type="range" id="dcal-slider-y" min="-25.0" max="25.0" step="0.05" value="0" class="dcal-slider">
                </div>
            </div>

            <!-- Google Maps Comparison Overlay Section -->
            <div class="dcal-overlay-section">
                <div class="dcal-slider-header">
                    <span class="dcal-overlay-title">${lucideIcon('map', 14)} Old Google Maps Satellite Overlay</span>
                    <span id="dcal-opacity-num" class="dcal-num">0%</span>
                </div>
                <input type="range" id="dcal-slider-opacity" min="0" max="1" step="0.02" value="0" class="dcal-slider dcal-slider-opacity">
                <div class="dcal-opacity-chips">
                    <button type="button" class="dcal-opacity-chip active" data-opacity="0">0% (Off)</button>
                    <button type="button" class="dcal-opacity-chip" data-opacity="0.30">30%</button>
                    <button type="button" class="dcal-opacity-chip" data-opacity="0.50">50% Split</button>
                    <button type="button" class="dcal-opacity-chip" data-opacity="0.75">75%</button>
                    <button type="button" class="dcal-opacity-chip" data-opacity="1.0">100%</button>
                </div>
                <div class="dcal-overlay-hint">${lucideIcon('lightbulb', 13)} Blend old Google Satellite on top of drone shot to cross-reference alignment.</div>
            </div>

            <!-- Directional Nudge D-Pad -->
            <div class="dcal-dpad-section">
                <div class="dcal-step-selector">
                    <span class="dcal-step-label">Step Size:</span>
                    <button class="dcal-step-btn" data-step="0.05">Fine (0.05m)</button>
                    <button class="dcal-step-btn active" data-step="0.2">0.2m</button>
                    <button class="dcal-step-btn" data-step="1.0">1.0m</button>
                </div>

                <div class="dcal-dpad-grid">
                    <div></div>
                    <button class="dcal-dpad-btn" id="dcal-btn-up" title="Nudge North (▲)">▲</button>
                    <div></div>
                    <button class="dcal-dpad-btn" id="dcal-btn-left" title="Nudge West (◀)">◀</button>
                    <button class="dcal-dpad-center" id="dcal-btn-center" title="Reset to Center">⌖</button>
                    <button class="dcal-dpad-btn" id="dcal-btn-right" title="Nudge East (▶)">▶</button>
                    <div></div>
                    <button class="dcal-dpad-btn" id="dcal-btn-down" title="Nudge South (▼)">▼</button>
                    <div></div>
                </div>
                <div class="dcal-hint">${lucideIcon('lightbulb', 13)} Tip: Use Keyboard Arrow Keys to nudge. Hold Shift for 1.0m.</div>
            </div>

            <!-- Auto-Apply Toggle -->
            <label class="dcal-toggle-label">
                <input type="checkbox" id="dcal-cb-autoapply" checked>
                <span>Auto-apply offset in Aerial Drone View only</span>
            </label>

            <!-- Action Buttons -->
            <div class="dcal-actions">
                <button class="dcal-btn dcal-btn-reset" id="dcal-btn-reset" title="Reset all offsets and overlay back to factory 0.00m default">${lucideIcon('rotate-ccw', 14)} Reset to Default</button>
                <button class="dcal-btn dcal-btn-revert" id="dcal-btn-revert" title="Revert to last saved calibration">${lucideIcon('rotate-ccw', 14)} Revert</button>
                <button class="dcal-btn dcal-btn-save" id="dcal-btn-save" title="Save this alignment as permanent offset">${lucideIcon('save', 14)} Save Alignment</button>
            </div>
        </div>
    `;

    document.body.appendChild(hud);

    // Event listeners for HUD
    document.getElementById('dcal-close-btn').addEventListener('click', toggleDroneCalibrationHUD);
    document.getElementById('dcal-min-btn').addEventListener('click', () => {
        isHudMinimized = !isHudMinimized;
        document.getElementById('dcal-body').style.display = isHudMinimized ? 'none' : 'block';
        document.getElementById('dcal-min-btn').textContent = isHudMinimized ? '+' : '_';
    });

    const sliderX = document.getElementById('dcal-slider-x');
    const sliderY = document.getElementById('dcal-slider-y');
    const sliderOpacity = document.getElementById('dcal-slider-opacity');

    sliderX.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        applyDroneOffset(val, state.droneOffset.dy);
    });

    sliderY.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        applyDroneOffset(state.droneOffset.dx, val);
    });

    if (sliderOpacity) {
        sliderOpacity.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            setGmapsOverlayOpacity(val);
        });
    }

    // Google Satellite comparison preset chips
    hud.querySelectorAll('.dcal-opacity-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const val = parseFloat(chip.dataset.opacity) || 0;
            setGmapsOverlayOpacity(val);
        });
    });

    // D-Pad buttons
    document.getElementById('dcal-btn-up').addEventListener('click', () => {
        const ny = +(state.droneOffset.dy + currentStep).toFixed(3);
        sliderY.value = ny;
        applyDroneOffset(state.droneOffset.dx, ny);
    });
    document.getElementById('dcal-btn-down').addEventListener('click', () => {
        const ny = +(state.droneOffset.dy - currentStep).toFixed(3);
        sliderY.value = ny;
        applyDroneOffset(state.droneOffset.dx, ny);
    });
    document.getElementById('dcal-btn-left').addEventListener('click', () => {
        const nx = +(state.droneOffset.dx - currentStep).toFixed(3);
        sliderX.value = nx;
        applyDroneOffset(nx, state.droneOffset.dy);
    });
    document.getElementById('dcal-btn-right').addEventListener('click', () => {
        const nx = +(state.droneOffset.dx + currentStep).toFixed(3);
        sliderX.value = nx;
        applyDroneOffset(nx, state.droneOffset.dy);
    });
    document.getElementById('dcal-btn-center').addEventListener('click', () => {
        applyDroneOffset(0, 0);
        sliderX.value = 0;
        sliderY.value = 0;
    });

    // Step selector buttons
    hud.querySelectorAll('.dcal-step-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            hud.querySelectorAll('.dcal-step-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentStep = parseFloat(btn.dataset.step) || 0.2;
        });
    });

    // Auto-apply checkbox
    const cbAuto = document.getElementById('dcal-cb-autoapply');
    cbAuto.checked = state.droneOffset.autoApply !== false;
    cbAuto.addEventListener('change', (e) => {
        state.droneOffset.autoApply = e.target.checked;
        syncDroneOffsetOnStyleChange();
    });

    // Action buttons
    document.getElementById('dcal-btn-reset').addEventListener('click', resetToDefaultCalibration);
    document.getElementById('dcal-btn-revert').addEventListener('click', revertToSavedCalibration);
    document.getElementById('dcal-btn-save').addEventListener('click', saveDroneCalibration);

    // Make HUD draggable across screen
    makeDraggable(hud, document.getElementById('dcal-header'));

    // Set initial values
    sliderX.value = state.droneOffset.dx;
    sliderY.value = state.droneOffset.dy;
    if (sliderOpacity) sliderOpacity.value = state.gmapsOverlayOpacity || 0;
    updateHudReadout(state.droneOffset.dx, state.droneOffset.dy);
}


export function toggleDroneCalibrationHUD() {
    if (!state.isAdmin) return;

    let hud = document.getElementById('drone-calib-hud');
    if (!hud) {
        buildDroneCalibrationHUD();
        hud = document.getElementById('drone-calib-hud');
    }
    if (!hud) return;

    isHudOpen = (hud.style.display === 'none' || hud.style.display === '');
    hud.style.display = isHudOpen ? 'block' : 'none';

    const triggerBtn = document.getElementById('admin-drone-calib-trigger-btn');
    if (triggerBtn) {
        triggerBtn.classList.toggle('active', isHudOpen);
    }

    if (isHudOpen) {
        updateHudStatusBanner();
        updateHudReadout(state.droneOffset.dx, state.droneOffset.dy);
    }
}

function updateHudReadout(dx, dy) {
    const valX = document.getElementById('dcal-val-x');
    const valY = document.getElementById('dcal-val-y');
    const numX = document.getElementById('dcal-x-num');
    const numY = document.getElementById('dcal-y-num');
    const valDlng = document.getElementById('dcal-val-dlng');
    const valDlat = document.getElementById('dcal-val-dlat');

    const signX = dx >= 0 ? '+' : '';
    const signY = dy >= 0 ? '+' : '';

    if (valX) valX.textContent = `${signX}${dx.toFixed(2)} m (${dx >= 0 ? 'East' : 'West'})`;
    if (valY) valY.textContent = `${signY}${dy.toFixed(2)} m (${dy >= 0 ? 'North' : 'South'})`;
    if (numX) numX.textContent = `${signX}${dx.toFixed(2)}m`;
    if (numY) numY.textContent = `${signY}${dy.toFixed(2)}m`;

    const { dLng, dLat } = metersToGPSDelta(dx, dy);
    if (valDlng) valDlng.textContent = `${dLng >= 0 ? '+' : ''}${dLng.toFixed(8)}°`;
    if (valDlat) valDlat.textContent = `${dLat >= 0 ? '+' : ''}${dLat.toFixed(8)}°`;
}

function updateHudStatusBanner() {
    const banner = document.getElementById('dcal-status-banner');
    const txt = document.getElementById('dcal-status-text');
    const switchBtn = document.getElementById('dcal-switch-btn');
    if (!banner || !txt) return;

    const isDrone = (state.currentMapStyleMode === 'google');
    if (isDrone) {
        banner.className = 'dcal-status active-drone';
        txt.textContent = '🟢 Active on: Aerial Drone View';
        if (switchBtn) switchBtn.style.display = 'none';
    } else {
        banner.className = 'dcal-status warning-mapbox';
        txt.textContent = '⚠️ Viewing: Mapbox 3D View';
        if (switchBtn) switchBtn.style.display = 'inline-block';
    }
}

// Make floating window draggable by its header
function makeDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;
    handle.ontouchstart = dragTouchStart;

    function dragMouseDown(e) {
        if (e.target.tagName === 'BUTTON') return;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        el.style.top = (el.offsetTop - pos2) + 'px';
        el.style.left = (el.offsetLeft - pos1) + 'px';
        el.style.bottom = 'auto';
        el.style.right = 'auto';
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }

    function dragTouchStart(e) {
        if (e.target.tagName === 'BUTTON') return;
        const touch = e.touches[0];
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        document.ontouchend = closeTouchDrag;
        document.ontouchmove = touchDrag;
    }

    function touchDrag(e) {
        const touch = e.touches[0];
        pos1 = pos3 - touch.clientX;
        pos2 = pos4 - touch.clientY;
        pos3 = touch.clientX;
        pos4 = touch.clientY;
        el.style.top = (el.offsetTop - pos2) + 'px';
        el.style.left = (el.offsetLeft - pos1) + 'px';
        el.style.bottom = 'auto';
        el.style.right = 'auto';
    }

    function closeTouchDrag() {
        document.ontouchend = null;
        document.ontouchmove = null;
    }
}

// Lightweight toast notification
function showToast(msg) {
    let t = document.getElementById('dcal-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'dcal-toast';
        t.className = 'dcal-toast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
        t.classList.remove('visible');
    }, 2800);
}

// Global window registration
if (typeof window !== 'undefined') {
    window.initDroneCalibration = initDroneCalibration;
    window.syncAdminDroneDOM = syncAdminDroneDOM;
    window.applyDroneOffset = applyDroneOffset;
    window.saveDroneCalibration = saveDroneCalibration;
    window.resetDroneCalibration = resetDroneCalibration;
    window.resetToDefaultCalibration = resetToDefaultCalibration;
    window.revertToSavedCalibration = revertToSavedCalibration;
    window.setGmapsOverlayOpacity = setGmapsOverlayOpacity;
    window.toggleDroneCalibrationHUD = toggleDroneCalibrationHUD;
    window.syncDroneOffsetOnStyleChange = syncDroneOffsetOnStyleChange;
}

