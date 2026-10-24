// DA-LARES Map Settings Control Panel Module
// Consolidated settings for layer visibility, full/compact label display mode, and time-of-day lighting presets.

import { state } from './data/state.js';
import { updatePerformanceUI, setPerformanceProfile } from './performance.js';

export function syncLayerToggleCheckboxes() {
    const cbBuildings = document.getElementById('msp-toggle-buildings');
    const cbMarkers = document.getElementById('msp-toggle-markers');
    const cbBoundary = document.getElementById('msp-toggle-boundary');

    if (cbBuildings) cbBuildings.checked = state.buildingsVisible !== false;
    if (cbMarkers) cbMarkers.checked = state.markersVisible !== false;
    if (cbBoundary) cbBoundary.checked = state.boundaryVisible !== false;
}

export function handleLayerToggle(type, isChecked) {
    const currentMap = state.map || window.map;

    if (type === 'buildings') {
        state.buildingsVisible = isChecked;
        const vis = isChecked ? 'visible' : 'none';
        if (currentMap) {
            const bldgLayers = [
                '3d-drawings',
                '3d-drawings-roofs',
                '3d-drawings-transparent',
                '3d-drawings-roofs-transparent',
                '3d-buildings-models-layer',
                '3d-buildings-models-transparent'
            ];
            bldgLayers.forEach(id => {
                if (currentMap.getLayer(id)) {
                    try { currentMap.setLayoutProperty(id, 'visibility', vis); } catch (e) { }
                }
            });
            if (currentMap.getLayer('3d-buildings-mapbox')) {
                try {
                    currentMap.setLayoutProperty('3d-buildings-mapbox', 'visibility', (isChecked && state.currentMapStyleMode === 'mapbox') ? 'visible' : 'none');
                } catch (e) { }
            }
        }
    } else if (type === 'numbers' || type === 'labels') {
        state.markersVisible = isChecked;
        if (state.markers && state.markers.length > 0) {
            state.markers.forEach(m => {
                if (m && m.getElement()) {
                    m.getElement().style.display = isChecked ? '' : 'none';
                }
                if (!isChecked && m.getPopup && m.getPopup() && m.getPopup().isOpen()) {
                    m.togglePopup();
                }
            });
        }
        document.querySelectorAll('.bldg-map-marker').forEach(el => {
            el.style.display = isChecked ? '' : 'none';
        });
    } else if (type === 'boundary') {
        state.boundaryVisible = isChecked;
        const vis = isChecked ? 'visible' : 'none';
        if (currentMap) {
            const boundaryLayerIds = [
                'lares-boundary-fill',
                'lares-boundary-glow',
                'lares-boundary-line',
                'lares-compound-border-casing',
                'lares-compound-border-line'
            ];
            boundaryLayerIds.forEach(lid => {
                if (currentMap.getLayer(lid)) {
                    try { currentMap.setLayoutProperty(lid, 'visibility', vis); } catch (e) { }
                }
            });
            ['10', '20', '21', '1', '2', '3'].forEach(fid => {
                ['sec-glow-', 'sec-fill-', 'sec-line-'].forEach(p => {
                    const lid = `${p}${fid}`;
                    if (currentMap.getLayer(lid)) {
                        try { currentMap.setLayoutProperty(lid, 'visibility', vis); } catch (e) { }
                    }
                });
            });
            if (currentMap.getLayer('sec-labels-layer')) {
                try { currentMap.setLayoutProperty('sec-labels-layer', 'visibility', vis); } catch (e) { }
            }
        }
        if (state.sectionBadges && state.sectionBadges.length > 0) {
            state.sectionBadges.forEach(m => {
                if (m && m.getElement()) m.getElement().style.display = isChecked ? 'inline-flex' : 'none';
            });
        }
    }

    syncLayerToggleCheckboxes();
    if (typeof window.resetIdle === 'function') window.resetIdle();
}

export function setLabelDisplayMode(mode) {
    state.labelDisplayMode = mode;
    const isCompact = (mode === 'compact');

    document.body.classList.toggle('label-mode-compact', isCompact);

    const fullBtn = document.getElementById('msp-seg-full');
    const compactBtn = document.getElementById('msp-seg-compact');
    if (fullBtn) fullBtn.classList.toggle('active', !isCompact);
    if (compactBtn) compactBtn.classList.toggle('active', isCompact);

    try {
        localStorage.setItem('da_label_display_mode', mode);
    } catch (e) { }

    if (typeof window.resetIdle === 'function') window.resetIdle();
}

export function setEnvironmentLighting(preset) {
    state.lightingMode = preset;

    // Update active highlight on lighting grid buttons
    document.querySelectorAll('.msp-light-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === preset);
    });

    if (preset === 'auto') {
        if (typeof window.syncLightingWithTime === 'function') {
            window.syncLightingWithTime();
        }
    } else {
        if (typeof window.setLighting === 'function') {
            window.setLighting(preset);
        }
    }

    try {
        localStorage.setItem('da_lighting_mode', preset);
    } catch (e) { }

    if (typeof window.resetIdle === 'function') window.resetIdle();
}

export function toggleMapSettingsPanel(event) {
    if (event) event.stopPropagation();
    const panel = document.getElementById('map-settings-panel');
    if (panel && panel.classList.contains('active')) {
        closeMapSettingsPanel();
    } else {
        openMapSettingsPanel();
    }
}

export function openMapSettingsPanel() {
    const panel = document.getElementById('map-settings-panel');
    const backdrop = document.getElementById('map-settings-backdrop');
    const triggerBtn = document.getElementById('map-settings-trigger-btn');

    if (panel) panel.classList.add('active');
    if (backdrop) backdrop.classList.add('active');
    if (triggerBtn) triggerBtn.classList.add('active');
    state.isMapSettingsOpen = true;

    syncLayerToggleCheckboxes();
    updatePerformanceUI();
    if (typeof window.resetIdle === 'function') window.resetIdle();
}

export function closeMapSettingsPanel() {
    const panel = document.getElementById('map-settings-panel');
    const backdrop = document.getElementById('map-settings-backdrop');
    const triggerBtn = document.getElementById('map-settings-trigger-btn');

    if (panel) panel.classList.remove('active');
    if (backdrop) backdrop.classList.remove('active');
    if (triggerBtn) triggerBtn.classList.remove('active');
    state.isMapSettingsOpen = false;
}

export function initMapSettings() {
    // 1. Restore label display mode
    try {
        const savedLabelMode = localStorage.getItem('da_label_display_mode');
        if (savedLabelMode === 'compact' || savedLabelMode === 'full') {
            setLabelDisplayMode(savedLabelMode);
        } else {
            setLabelDisplayMode('full');
        }
    } catch (e) {
        setLabelDisplayMode('full');
    }

    // 2. Restore lighting preset
    try {
        const savedLighting = localStorage.getItem('da_lighting_mode');
        if (savedLighting && ['dawn', 'day', 'dusk', 'night', 'auto'].includes(savedLighting)) {
            setEnvironmentLighting(savedLighting);
        } else {
            setEnvironmentLighting('auto');
        }
    } catch (e) {
        setEnvironmentLighting('auto');
    }

    syncLayerToggleCheckboxes();
    updatePerformanceUI();

    // 3. Global ESC listener and outside click dismiss
    if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMapSettingsPanel();
        });

        window.addEventListener('click', (e) => {
            const panel = document.getElementById('map-settings-panel');
            const widget = document.getElementById('map-settings-widget');
            if (panel && panel.classList.contains('active')) {
                if (!panel.contains(e.target) && (!widget || !widget.contains(e.target))) {
                    closeMapSettingsPanel();
                }
            }
        });
    }
}

// Window reflections
window.toggleMapSettingsPanel = toggleMapSettingsPanel;
window.openMapSettingsPanel = openMapSettingsPanel;
window.closeMapSettingsPanel = closeMapSettingsPanel;
window.handleLayerToggle = handleLayerToggle;
window.setLabelDisplayMode = setLabelDisplayMode;
window.setEnvironmentLighting = setEnvironmentLighting;
window.setPerformanceProfile = setPerformanceProfile;
window.updatePerformanceUI = updatePerformanceUI;
window.initMapSettings = initMapSettings;
