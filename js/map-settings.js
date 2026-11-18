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
    const cbPlots = document.getElementById('msp-toggle-plots');
    if (cbPlots) cbPlots.checked = state.plotsVisible === true;

    if (document.body) {
        document.body.classList.toggle('labels-hidden', state.markersVisible === false);
    }
}

export function handleLayerToggle(type, isChecked) {
    const currentMap = state.map || window.map;

    if (type === 'buildings') {
        state.buildingsVisible = isChecked;
        try {
            localStorage.setItem('da_buildings_visible', isChecked ? 'true' : 'false');
        } catch (e) { }
        const vis = isChecked ? 'visible' : 'none';
        if (currentMap) {
            const currentStation = state.currentStationId || 'lares';
            const bldgLayers = [
                'lares-3d-models-layer',
                'lares-3d-models-transparent',
                '3d-buildings-models-layer',
                '3d-buildings-models-transparent',
                '3d-drawings',
                '3d-drawings-roofs',
                '3d-drawings-transparent',
                '3d-drawings-roofs-transparent',
                'rares-3d-models-layer',
                'rares-3d-models-transparent',
                'rares-footprints-3d',
                'qares-3d-models-layer',
                'qares-3d-models-transparent',
                'qares-footprints-3d',
                'qares-footprints-roofs',
                'qares-footprints-fill',
                'qares-footprints-line'
            ];
            bldgLayers.forEach(id => {
                if (currentMap.getLayer(id)) {
                    let shouldBeVisible = isChecked;
                    if (id.startsWith('lares-') || id.startsWith('3d-')) {
                        shouldBeVisible = isChecked && currentStation === 'lares';
                    } else if (id.startsWith('rares-')) {
                        shouldBeVisible = isChecked && currentStation === 'rares';
                    } else if (id.startsWith('qares-')) {
                        shouldBeVisible = isChecked && currentStation === 'qares';
                    }
                    try { currentMap.setLayoutProperty(id, 'visibility', shouldBeVisible ? 'visible' : 'none'); } catch (e) { }
                }
            });
            if (currentMap.getLayer('3d-buildings-mapbox')) {
                try {
                    currentMap.setLayoutProperty('3d-buildings-mapbox', 'visibility', (isChecked && state.currentMapStyleMode === 'mapbox') ? 'visible' : 'none');
                } catch (e) { }
            }
        }

        // Synchronize corresponding bottom bar chip
        const chipBldg = document.getElementById('chip-buildings');
        if (chipBldg) chipBldg.classList.toggle('active', isChecked);

    } else if (type === 'numbers' || type === 'labels') {
        state.markersVisible = isChecked;
        try {
            localStorage.setItem('da_markers_visible', isChecked ? 'true' : 'false');
        } catch (e) { }
        const markersShouldShow = isChecked;
        if (document.body) {
            document.body.classList.toggle('labels-hidden', !markersShouldShow);
        }
        if (state.markers && state.markers.length > 0) {
            state.markers.forEach(m => {
                if (m && m.getElement()) {
                    if (markersShouldShow) {
                        m.getElement().style.removeProperty('display');
                        m.getElement().style.display = '';
                    } else {
                        m.getElement().style.setProperty('display', 'none', 'important');
                    }
                }
                if (!markersShouldShow && m.getPopup && m.getPopup() && m.getPopup().isOpen()) {
                    m.togglePopup();
                }
            });
        }
        document.querySelectorAll('.bldg-map-marker').forEach(el => {
            if (markersShouldShow) {
                el.style.removeProperty('display');
                el.style.display = '';
            } else {
                el.style.setProperty('display', 'none', 'important');
            }
        });
        document.querySelectorAll('.plot-map-marker').forEach(el => {
            if (markersShouldShow) {
                el.style.removeProperty('display');
                el.style.display = '';
            } else {
                el.style.setProperty('display', 'none', 'important');
            }
        });
        if (markersShouldShow && typeof window.virtualizeMarkers === 'function') {
            window.virtualizeMarkers();
        }

        const chipNum = document.getElementById('chip-numbers');
        if (chipNum) chipNum.classList.toggle('active', isChecked);

    } else if (type === 'plots') {
        state.plotsVisible = isChecked;
        try {
            localStorage.setItem('da_plots_visible', isChecked ? 'true' : 'false');
        } catch (e) { }
        if (currentMap) {
            const plotVis = isChecked ? 'visible' : 'none';
            ['rares-plots-fill', 'rares-plots-line', 'qares-plots-fill', 'qares-plots-line'].forEach(id => {
                if (currentMap.getLayer(id)) {
                    try { currentMap.setLayoutProperty(id, 'visibility', plotVis); } catch (e) { }
                }
            });
        }
        if (typeof window.updatePlotLayerStyles === 'function') {
            window.updatePlotLayerStyles();
        }

    } else if (type === 'boundary') {
        state.boundaryVisible = isChecked;
        try {
            localStorage.setItem('da_boundary_visible', isChecked ? 'true' : 'false');
        } catch (e) { }
        const vis = isChecked ? 'visible' : 'none';
        if (currentMap) {
            const isMapbox = (state.currentMapStyleMode === 'mapbox');
            const shadowVis = (!isMapbox && isChecked) ? 'visible' : 'none';

            const boundaryLayerIds = [
                'lares-boundary-fill',
                'lares-boundary-glow',
                'lares-boundary-line',
                'lares-compound-border-casing',
                'lares-compound-border-line',
                'qares-boundary-fill',
                'qares-boundary-line',
                'qares-railway-casing',
                'qares-railway-line',
                'rares-boundary-fill',
                'rares-boundary-line'
            ];
            boundaryLayerIds.forEach(lid => {
                if (currentMap.getLayer(lid)) {
                    try { currentMap.setLayoutProperty(lid, 'visibility', vis); } catch (e) { }
                }
            });
            ['qares-boundary-glow', 'qares-boundary-casing', 'rares-boundary-glow', 'rares-boundary-casing'].forEach(lid => {
                if (currentMap.getLayer(lid)) {
                    try { currentMap.setLayoutProperty(lid, 'visibility', shadowVis); } catch (e) { }
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

        const chipBnd = document.getElementById('chip-boundary');
        if (chipBnd) chipBnd.classList.toggle('active', isChecked);
    }

    syncLayerToggleCheckboxes();
    if (typeof window.resetIdle === 'function') window.resetIdle();
}

export function setLabelDisplayMode(mode) {
    state.labelDisplayMode = mode;
    const isCompact = (mode === 'compact');

    document.body.classList.toggle('label-mode-compact', isCompact);
    if (state.markersVisible === false) {
        document.body.classList.add('labels-hidden');
    }

    const fullBtn = document.getElementById('msp-seg-full');
    const compactBtn = document.getElementById('msp-seg-compact');
    if (fullBtn) fullBtn.classList.toggle('active', !isCompact);
    if (compactBtn) compactBtn.classList.toggle('active', isCompact);

    try {
        localStorage.setItem('da_label_display_mode', mode);
    } catch (e) { }

    if (typeof window.updatePlotMarkerLOD === 'function') {
        window.updatePlotMarkerLOD();
    }

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

    // 3. Restore layer visibility preferences (buildings, markers, boundary, plots)
    try {
        const savedBuildings = localStorage.getItem('da_buildings_visible');
        if (savedBuildings !== null) state.buildingsVisible = (savedBuildings === 'true');
    } catch (e) { }
    try {
        const savedMarkers = localStorage.getItem('da_markers_visible');
        if (savedMarkers !== null) state.markersVisible = (savedMarkers === 'true');
    } catch (e) { }
    try {
        const savedBoundary = localStorage.getItem('da_boundary_visible');
        if (savedBoundary !== null) state.boundaryVisible = (savedBoundary === 'true');
    } catch (e) { }
    try {
        const savedPlots = localStorage.getItem('da_plots_visible');
        if (savedPlots !== null) {
            state.plotsVisible = (savedPlots === 'true');
        } else {
            state.plotsVisible = false;
        }
    } catch (e) {
        state.plotsVisible = false;
    }

    syncLayerToggleCheckboxes();
    updatePerformanceUI();

    // Re-apply saved layer visibility & lighting once the map finishes loading
    const m = state.map || window.map;
    if (m && typeof m.once === 'function') {
        m.once('load', () => {
            if (state.buildingsVisible === false) handleLayerToggle('buildings', false);
            if (state.markersVisible === false) handleLayerToggle('numbers', false);
            if (state.boundaryVisible === false) handleLayerToggle('boundary', false);
            if (state.plotsVisible === true) handleLayerToggle('plots', true);
            if (state.lightingMode && state.lightingMode !== 'auto') {
                setEnvironmentLighting(state.lightingMode);
            }
        });
    }

    // 4. Bind Kiosk Performance Profile Button Listeners
    const btnAuto = document.getElementById('perf-btn-auto');
    const btnEco = document.getElementById('perf-btn-eco');
    const btnHigh = document.getElementById('perf-btn-high');
    if (btnAuto && !btnAuto._perfBound) {
        btnAuto._perfBound = true;
        btnAuto.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setPerformanceProfile('auto');
        });
    }
    if (btnEco && !btnEco._perfBound) {
        btnEco._perfBound = true;
        btnEco.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setPerformanceProfile('eco');
        });
    }
    if (btnHigh && !btnHigh._perfBound) {
        btnHigh._perfBound = true;
        btnHigh.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setPerformanceProfile('high');
        });
    }

    // 5. Global ESC listener and outside click dismiss
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
