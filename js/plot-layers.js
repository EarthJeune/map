// DA-LARES Field Plots & Commodity Zones Mapbox Layer Module

// Renders single seamless outer group rectangles (zero lines in the middle on overview),

// dynamic sub-plot cuts that illuminate strictly on selection, and clean pin LOD.



import { FIELD_COMMODITY_ZONES, ZONE_POLYGONS, ALL_PLOT_POLYGONS, INTERNAL_CUT_LINES, getPlotsGeoJSON, getSubPlotsGeoJSON } from './data/plots.js';

import { state } from './data/state.js';

import { showPlotPanel } from './building-panel.js';



let plotMarkers = [];

let selectedPlotZoneId = null;



export function initPlotLayers() {

    const currentMap = state.map || (typeof window !== 'undefined' && window.map);

    if (!currentMap) return;



    const groupData = getPlotsGeoJSON();

    const cutsData = getSubPlotsGeoJSON();



    if (currentMap.getSource('plots-group-source')) {

        currentMap.getSource('plots-group-source').setData(groupData);

        currentMap.getSource('plots-cuts-source').setData(cutsData);

        if (currentMap.getSource('plots-active-subplot-source')) {

            currentMap.getSource('plots-active-subplot-source').setData({ type: 'FeatureCollection', features: [] });

        }

        return;

    }



    currentMap.addSource('plots-group-source', {

        type: 'geojson',

        data: groupData,

        promoteId: 'id'

    });



    currentMap.addSource('plots-cuts-source', {

        type: 'geojson',

        data: cutsData,

        promoteId: 'id'

    });



    const isVisible = (state.plotsVisible === true);



    // 1. Group Fill Layer (Translucent wash seated cleanly on ground furrows)

    currentMap.addLayer({

        id: 'plots-group-fill',

        type: 'fill',

        source: 'plots-group-source',

        slot: 'middle',

        paint: {

            'fill-color': ['get', 'color'],

            'fill-opacity': [

                'case',

                ['boolean', ['feature-state', 'selected'], false], 0.35,

                ['boolean', ['feature-state', 'hover'], false], 0.25,

                isVisible ? 0.16 : 0.001

            ]

        }

    });



    // 2. Seamless Outer Perimeter Casing (Single full rectangle with ZERO middle lines)

    currentMap.addLayer({

        id: 'plots-group-casing',

        type: 'line',

        source: 'plots-group-source',

        slot: 'middle',

        paint: {

            'line-color': ['get', 'color'],

            'line-width': [

                'case',

                ['boolean', ['feature-state', 'selected'], false], 3.8,

                ['boolean', ['feature-state', 'hover'], false], 2.8,

                isVisible ? 1.8 : 0.0

            ],

            'line-opacity': [

                'case',

                ['boolean', ['feature-state', 'selected'], false], 0.95,

                ['boolean', ['feature-state', 'hover'], false], 0.95,

                isVisible ? 0.95 : 0.0

            ]

        }

    });



    // 3. Internal Sub-Plot Cuts (100% INVISIBLE on overview; illuminated ONLY on click/selection!)

    currentMap.addLayer({

        id: 'plots-internal-cuts',

        type: 'line',

        source: 'plots-cuts-source',

        slot: 'middle',

        paint: {

            'line-color': '#ffffff',

            'line-dasharray': [2, 2],

            'line-width': 2.0,

            'line-opacity': [

                'case',

                ['boolean', ['feature-state', 'selected'], false], 0.90, // Illuminated on click

                0.0 // 100% Invisible in overview (zero lines in the middle!)

            ]

        }

    });



    // 4. Dedicated Active Sub-Plot Selection Spotlight Layers (Glow & Highlighting)

    if (!currentMap.getSource('plots-active-subplot-source')) {

        currentMap.addSource('plots-active-subplot-source', {

            type: 'geojson',

            data: { type: 'FeatureCollection', features: [] }

        });



        currentMap.addLayer({

            id: 'plots-active-subplot-fill',

            type: 'fill',

            source: 'plots-active-subplot-source',

            slot: 'middle',

            paint: {

                'fill-color': ['coalesce', ['get', 'color'], '#38bdf8'],

                'fill-opacity': 0.28

            }

        });



        currentMap.addLayer({

            id: 'plots-active-subplot-glow',

            type: 'line',

            source: 'plots-active-subplot-source',

            slot: 'middle',

            paint: {

                'line-color': ['coalesce', ['get', 'color'], '#38bdf8'],

                'line-width': 7.0,

                'line-blur': 4.0,

                'line-opacity': 0.85

            }

        });



        currentMap.addLayer({

            id: 'plots-active-subplot-casing',

            type: 'line',

            source: 'plots-active-subplot-source',

            slot: 'middle',

            paint: {

                'line-color': '#ffffff',

                'line-width': 2.5,

                'line-opacity': 0.95

            }

        });

    }



    // Restore feature state if a zone was already selected across style reload

    if (selectedPlotZoneId) {

        try {

            currentMap.setFeatureState(

                { source: 'plots-group-source', id: selectedPlotZoneId },

                { selected: true, hover: false }

            );

            INTERNAL_CUT_LINES.forEach(cut => {

                if (cut.properties.zoneId === selectedPlotZoneId) {

                    currentMap.setFeatureState(

                        { source: 'plots-cuts-source', id: cut.id },

                        { selected: true }

                    );

                }

            });

        } catch (e) { }

    }



    // Centralized Hover Management across Canvas and DOM Markers

    currentMap.on('mousemove', 'plots-group-fill', (e) => {

        if (e.features && e.features.length > 0) {

            currentMap.getCanvas().style.cursor = 'pointer';

            const zid = e.features[0].id || e.features[0].properties?.zoneId || e.features[0].properties?.id;

            setPlotZoneHover(zid);

        }

    });



    currentMap.on('mouseleave', 'plots-group-fill', () => {

        currentMap.getCanvas().style.cursor = '';

        clearPlotZoneHover();

    });



    // Clear hover whenever camera moves (prevents stuck hover when flying/panning)

    currentMap.on('movestart', () => {

        clearPlotZoneHover();

    });



    // Click selection — activates neon border and illuminates sub-plot cuts

    currentMap.on('click', 'plots-group-fill', (e) => {

        if (!e.features || !e.features[0]) return;

        const zid = e.features[0].id || e.features[0].properties?.zoneId || e.features[0].properties?.id;

        selectPlotZone(zid);

    });



    // Clean Pin Strategy: update LOD when camera moves or zooms

    currentMap.on('zoom', updatePlotMarkerLOD);

    currentMap.on('moveend', updatePlotMarkerLOD);



    createPlotMarkers();

}



let hoveredZoneId = null;



export function setPlotZoneHover(zoneId) {

    const currentMap = state.map || (typeof window !== 'undefined' && window.map);

    if (!currentMap || !currentMap.getSource('plots-group-source')) return;



    if (hoveredZoneId === zoneId) return;



    // Clear previous hovered zone if it wasn't the selected zone

    if (hoveredZoneId && hoveredZoneId !== selectedPlotZoneId) {

        currentMap.setFeatureState({ source: 'plots-group-source', id: hoveredZoneId }, { hover: false });

    }



    hoveredZoneId = zoneId;



    if (zoneId && zoneId !== selectedPlotZoneId) {

        currentMap.setFeatureState({ source: 'plots-group-source', id: zoneId }, { hover: true });

    }

}



export function clearPlotZoneHover(zoneId) {

    const currentMap = state.map || (typeof window !== 'undefined' && window.map);

    if (!currentMap || !currentMap.getSource('plots-group-source')) return;



    if (!zoneId || hoveredZoneId === zoneId) {

        if (hoveredZoneId && hoveredZoneId !== selectedPlotZoneId) {

            currentMap.setFeatureState({ source: 'plots-group-source', id: hoveredZoneId }, { hover: false });

        }

        hoveredZoneId = null;

    }

}



// Clean Pin Strategy & Settings Alignment: collapse pins into subtle chips at overview or in compact mode

export function updatePlotMarkerLOD() {

    const currentMap = state.map || (typeof window !== 'undefined' && window.map);

    if (!currentMap) return;

    const isClose = currentMap.getZoom() >= 17.4;

    const isCompactMode = (state.labelDisplayMode === 'compact') || (typeof document !== 'undefined' && document.body.classList.contains('label-mode-compact'));



    document.querySelectorAll('.plot-map-marker').forEach(el => {

        if (!isCompactMode && isClose) {

            el.classList.remove('collapsed');

        } else {

            el.classList.add('collapsed');

        }

    });

}



export function createPlotMarkers() {

    removePlotMarkers();

    const currentMap = state.map || (typeof window !== 'undefined' && window.map);

    if (!currentMap) return;



    const isClose = currentMap.getZoom() >= 17.4;

    const isCompactMode = (state.labelDisplayMode === 'compact') || (typeof document !== 'undefined' && document.body.classList.contains('label-mode-compact'));

    const isCollapsed = isCompactMode || !isClose;

    const markersShouldShow = (state.markersVisible !== false);



    FIELD_COMMODITY_ZONES.forEach(zone => {

        const el = document.createElement('div');

        el.className = 'plot-map-marker' + (isCollapsed ? ' collapsed' : '');

        el.dataset.zoneId = zone.id;

        el.style.display = markersShouldShow ? '' : 'none';



        const countText = zone.plotCount ? `${zone.plotCount} Plot${zone.plotCount > 1 ? 's' : ''}` : '1 Plot';

        const rangeText = zone.plotRange || '';

        const subtitle = (rangeText && zone.plotCount > 1) 

            ? `${rangeText} • ${countText}`

            : (rangeText || countText);



        el.innerHTML = `

            <div class="plot-marker-badge" style="background: ${zone.color};">

                <span>${zone.icon}</span>

            </div>

            <div class="plot-marker-info">

                <span class="plot-marker-name">${zone.name}</span>

                <span class="plot-marker-range">${subtitle}</span>

            </div>

        `;



        el.addEventListener('mouseenter', () => {

            setPlotZoneHover(zone.id);

        });



        el.addEventListener('mouseleave', () => {

            clearPlotZoneHover(zone.id);

        });



        el.addEventListener('click', (e) => {

            e.stopPropagation();

            selectPlotZone(zone.id);

        });



        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })

            .setLngLat(zone.centerCoords)

            .addTo(currentMap);



        plotMarkers.push(marker);

    });

}



export function removePlotMarkers() {

    plotMarkers.forEach(m => m.remove());

    plotMarkers = [];

}



export function updatePlotLayerStyles() {

    const currentMap = state.map || (typeof window !== 'undefined' && window.map);

    if (!currentMap) return;



    const isVisible = (state.plotsVisible === true);



    if (currentMap.getLayer('plots-group-fill')) {

        currentMap.setPaintProperty('plots-group-fill', 'fill-opacity', [

            'case',

            ['boolean', ['feature-state', 'selected'], false], 0.35,

            ['boolean', ['feature-state', 'hover'], false], 0.25,

            isVisible ? 0.16 : 0.001

        ]);

    }



    if (currentMap.getLayer('plots-group-casing')) {

        currentMap.setPaintProperty('plots-group-casing', 'line-width', [

            'case',

            ['boolean', ['feature-state', 'selected'], false], 3.8,

            ['boolean', ['feature-state', 'hover'], false], 2.8,

            isVisible ? 1.8 : 0.0

        ]);

        currentMap.setPaintProperty('plots-group-casing', 'line-opacity', [

            'case',

            ['boolean', ['feature-state', 'selected'], false], 0.95,

            ['boolean', ['feature-state', 'hover'], false], 0.95,

            isVisible ? 0.95 : 0.0

        ]);

    }

}



export function togglePlotVisibility(visible) {

    state.plotsVisible = visible;

    try {

        localStorage.setItem('da_plots_visible', visible ? 'true' : 'false');

    } catch (e) { }

    updatePlotLayerStyles();

}



export function selectPlotZone(zoneIdOrPlotId) {

    const currentMap = state.map || (typeof window !== 'undefined' && window.map);

    const zone = FIELD_COMMODITY_ZONES.find(z => 

        z.id === zoneIdOrPlotId || 

        (z.plotsList && z.plotsList.includes(Number(zoneIdOrPlotId))) ||

        (z.subPlots && z.subPlots.some(sp => `plot_${sp.plotNum}` === zoneIdOrPlotId || sp.plotNum == zoneIdOrPlotId))

    );

    if (!zone) return;



    const targetZoneId = zone.id;

    selectedPlotZoneId = targetZoneId;

    hoveredZoneId = null;

    if (typeof window !== 'undefined') window.selectedPlotZoneId = targetZoneId;



    // 1. Immediately terminate active building orbits, idle rotation, and navigation routes

    state.isIntroAnimating = false;

    if (typeof window.stopOrbit === 'function') window.stopOrbit();

    if (typeof window.stopIdleRotation === 'function') window.stopIdleRotation();

    if (typeof window.resetIdle === 'function') window.resetIdle();

    if (typeof window.clearRoute === 'function') window.clearRoute();



    // 2. Clear previous building marker badges and active classes

    state.selectedBuildingId = targetZoneId;

    window.selectedBuildingId = targetZoneId;

    state.activeSearchedOffice = '';



    document.querySelectorAll('.bldg-map-marker').forEach(el => {

        el.classList.remove('active', 'decluttered-dim', 'decluttered-hide', 'decluttered-highlight', 'decluttered-dest');

    });

    if (state.markers) {

        state.markers.forEach(m => {

            if (m.getPopup() && m.getPopup().isOpen()) m.getPopup().remove();

        });

    }



    // 3. Highlight active directory item in sidebar

    document.querySelectorAll('.dir-item').forEach(el => el.classList.remove('active'));

    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));

    const activeDirItem = document.querySelector(`.dir-item[data-plot-id="${targetZoneId}"]`);

    if (activeDirItem) {

        activeDirItem.classList.add('active');

        activeDirItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    }



    // 4. Wipe active sub-plot spotlight beacon & glow

    clearSubPlotHighlight();



    // 5. Update Mapbox feature states for master commodity zone & internal cuts

    if (currentMap) {

        try {

            if (currentMap.getSource('plots-group-source')) {

                currentMap.removeFeatureState({ source: 'plots-group-source' });

            }

            if (currentMap.getSource('plots-cuts-source')) {

                currentMap.removeFeatureState({ source: 'plots-cuts-source' });

            }

        } catch (e) { }



        // Explicitly enforce selected on target and reset hover & selected on all other zones

        FIELD_COMMODITY_ZONES.forEach(z => {

            const isMatch = (z.id === targetZoneId);

            currentMap.setFeatureState(

                { source: 'plots-group-source', id: z.id },

                { selected: isMatch, hover: false }

            );

        });



        // Dynamically illuminate ONLY the internal cuts of the newly selected zone

        INTERNAL_CUT_LINES.forEach(cut => {

            const isCutMatch = (cut.properties.zoneId === targetZoneId);

            currentMap.setFeatureState(

                { source: 'plots-cuts-source', id: cut.id },

                { selected: isCutMatch }

            );

        });

    }



    // 6. Highlight marker on ground

    document.querySelectorAll('.plot-map-marker').forEach(el => {

        el.classList.toggle('active', el.dataset.zoneId === targetZoneId);

    });



    // 7. Smooth camera flight or fitBounds to zone with viewport padding

    if (currentMap) {

        const isPhone = (typeof window.isPhoneMode === 'function') ? window.isPhoneMode() : (window.innerWidth <= 768);

        const isPortraitKiosk = (typeof document !== 'undefined' && document.body.classList.contains('kiosk-portrait')) ||

            ((typeof window !== 'undefined') && window.innerHeight > window.innerWidth && !isPhone);

        

        const pad = isPortraitKiosk

            ? { top: 90, bottom: Math.round((typeof window !== 'undefined' ? window.innerHeight : 1000) * 0.46), left: 24, right: 24 }

            : (isPhone

                ? { top: 70, bottom: 250, left: 16, right: 16 }

                : { top: 70, bottom: 70, left: 390, right: 410 }

            );



        let didFitBounds = false;

        if (typeof turf !== 'undefined' && zone.groupPolygon && zone.groupPolygon.length >= 3) {

            try {

                const bbox = turf.bbox(turf.polygon([zone.groupPolygon]));

                if (bbox && bbox.length === 4 && !bbox.some(isNaN)) {

                    currentMap.fitBounds(bbox, {

                        padding: pad,

                        pitch: isPhone ? 35 : 45,

                        bearing: currentMap.getBearing() || 15,

                        maxZoom: 18.5,

                        duration: 1200,

                        essential: true

                    });

                    didFitBounds = true;

                }

            } catch (err) {

                console.warn('[PlotLayers] fitBounds fallback:', err);

            }

        }



        if (!didFitBounds && zone.centerCoords) {

            currentMap.flyTo({

                center: zone.centerCoords,

                zoom: isPhone ? 17.8 : 18.2,

                pitch: isPhone ? 35 : 45,

                padding: pad,

                duration: 1200,

                essential: true

            });

        }

    }



    // 8. Open Slide-out Details Drawer with Sub-Plot Breakdown
    const isPhone = (typeof window.isPhoneMode === 'function') ? window.isPhoneMode() : (window.innerWidth <= 768);
    if (isPhone && typeof window.showPhonePlotDetails === 'function') {
        window.showPhonePlotDetails(zone);
    } else if (typeof showPlotPanel === 'function') {
        showPlotPanel(targetZoneId);
    }

}



export function deselectPlotZone() {

    clearSubPlotHighlight();

    const currentMap = state.map || (typeof window !== 'undefined' && window.map);

    selectedPlotZoneId = null;

    hoveredZoneId = null;

    if (typeof window !== 'undefined') window.selectedPlotZoneId = null;



    if (currentMap) {

        try {

            if (currentMap.getSource('plots-group-source')) {

                currentMap.removeFeatureState({ source: 'plots-group-source' });

            }

            if (currentMap.getSource('plots-cuts-source')) {

                currentMap.removeFeatureState({ source: 'plots-cuts-source' });

            }

        } catch (e) { }



        FIELD_COMMODITY_ZONES.forEach(z => {

            currentMap.setFeatureState(

                { source: 'plots-group-source', id: z.id },

                { selected: false, hover: false }

            );

        });

        INTERNAL_CUT_LINES.forEach(cut => {

            currentMap.setFeatureState(

                { source: 'plots-cuts-source', id: cut.id },

                { selected: false }

            );

        });

    }



    document.querySelectorAll('.plot-map-marker').forEach(el => {

        el.classList.remove('active');

    });

}



let activeSpotlightMarker = null;
let activeSubPlotNum = null;
let activeSubPlotBuildingId = null;
let activeSubPlotZoneId = null;

// Clears active sub-plot spotlight beacon, footprint glow, and chip selection
export function clearSubPlotHighlight() {
    activeSubPlotNum = null;
    activeSubPlotBuildingId = null;
    activeSubPlotZoneId = null;
    const currentMap = state.map || (typeof window !== 'undefined' && window.map);
    if (activeSpotlightMarker) {
        activeSpotlightMarker.remove();
        activeSpotlightMarker = null;
    }
    if (currentMap) {
        try {
            if (currentMap.getSource('plots-active-subplot-source')) {
                currentMap.getSource('plots-active-subplot-source').setData({
                    type: 'FeatureCollection',
                    features: []
                });
            }
        } catch (e) { }
    }
    document.querySelectorAll('.sub-plot-chip').forEach(el => el.classList.remove('active'));

    // Revert Drawer Hero Image back to Master Zone overview
    if (typeof window.restoreDrawerHeroMaster === 'function') {
        window.restoreDrawerHeroMaster();
    }
}

// Illuminates active sub-plot / screenhouse with spotlight HUD beacon & glowing footprint
export function highlightSubPlot(subPlotData, zoneColor = '#38bdf8', zoneId = null) {
    const currentMap = state.map || (typeof window !== 'undefined' && window.map);
    if (!currentMap || !subPlotData) return;

    const targetZoneId = zoneId || subPlotData.zoneId || selectedPlotZoneId || (typeof window !== 'undefined' && window.selectedPlotZoneId) || state.selectedBuildingId;

    activeSubPlotNum = subPlotData.plotNum;
    activeSubPlotBuildingId = subPlotData.buildingId || null;
    activeSubPlotZoneId = targetZoneId;

    // 1. Update GeoJSON Highlight Polygon (Neon Footprint Casing)
    if (subPlotData.polygon && currentMap.getSource('plots-active-subplot-source')) {
        const polyCoords = Array.isArray(subPlotData.polygon[0][0])
            ? subPlotData.polygon
            : [subPlotData.polygon];
        try {
            currentMap.getSource('plots-active-subplot-source').setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    properties: {
                        color: zoneColor || '#38bdf8'
                    },
                    geometry: {
                        type: 'Polygon',
                        coordinates: polyCoords
                    }
                }]
            });
        } catch (e) { }
    }

    // 2. Position Spotlight Beacon HUD Marker
    const center = subPlotData.centerCoords;
    if (center && Array.isArray(center) && center.length === 2 && typeof mapboxgl !== 'undefined') {
        if (!activeSpotlightMarker) {
            const el = document.createElement('div');
            el.className = 'spotlight-beacon';
            activeSpotlightMarker = new mapboxgl.Marker({
                element: el,
                anchor: 'bottom'
            }).setLngLat(center).addTo(currentMap);
        } else {
            activeSpotlightMarker.setLngLat(center);
        }

        const el = activeSpotlightMarker.getElement();
        const titleText = subPlotData.label || subPlotData.name || `Plot ${subPlotData.plotNum}`;
        const shortTitle = titleText.split(':')[0].trim();
        const subText = subPlotData.crop || subPlotData.details || 'Active Facility';
        
        el.innerHTML = `
            <div class="spotlight-beacon-wrapper" style="--spotlight-color: ${zoneColor};">
                <div class="spotlight-pulse-ring"></div>
                <div class="spotlight-hud-badge">
                    <span class="spotlight-hud-icon">📍</span>
                    <div class="spotlight-hud-text">
                        <span class="spotlight-hud-title">${shortTitle}</span>
                        <span class="spotlight-hud-sub">${subText}</span>
                    </div>
                </div>
                <div class="spotlight-stem"></div>
                <div class="spotlight-anchor-dot"></div>
            </div>
        `;
    }

    // 3. Highlight chip strictly in the current active drawer
    document.querySelectorAll('.sub-plot-chip').forEach(chip => {
        let isMatch = false;
        if (subPlotData.buildingId && chip.dataset.id === subPlotData.buildingId) {
            isMatch = true;
        } else if (!subPlotData.buildingId && chip.dataset.plotNum == subPlotData.plotNum) {
            if (!chip.dataset.zoneId || chip.dataset.zoneId === targetZoneId) {
                isMatch = true;
            }
        }
        chip.classList.toggle('active', isMatch);
    });

    // 4. Dynamic Hero Image Swap in Building Panel Drawer (Alternative 1)
    const parentZone = (typeof FIELD_COMMODITY_ZONES !== 'undefined')
        ? FIELD_COMMODITY_ZONES.find(z => z.id === targetZoneId)
        : null;
    if (typeof window.setDrawerHeroSubPlot === 'function') {
        window.setDrawerHeroSubPlot(subPlotData, parentZone);
    }
}

// Deep zoom directly into an individual sub-plot partition or screenhouse with Spotlight Highlighting
export function zoomToSubPlot(plotNum, centerCoords, buildingId, zoneId = null) {
    const currentMap = state.map || (typeof window !== 'undefined' && window.map);
    if (!currentMap) return;

    const activeZoneId = zoneId || selectedPlotZoneId || (typeof window !== 'undefined' && window.selectedPlotZoneId) || state.selectedBuildingId;

    // Toggle off if already active: smooth zoom back out to parent zone overview
    const isAlreadyActive = (buildingId && activeSubPlotBuildingId === buildingId) ||
        (!buildingId && activeSubPlotNum == plotNum && (!activeSubPlotZoneId || activeSubPlotZoneId === activeZoneId));

    if (isAlreadyActive) {
        clearSubPlotHighlight();
        if (activeZoneId && typeof selectPlotZone === 'function') {
            selectPlotZone(activeZoneId);
        }
        return;
    }

    // Resolve full sub-plot data accurately scoped to parent zone
    let subPlotData = null;
    let parentZone = activeZoneId ? FIELD_COMMODITY_ZONES.find(z => z.id === activeZoneId) : null;

    // 1. Search strictly inside the active parentZone first
    if (parentZone && parentZone.subPlots) {
        if (buildingId) {
            subPlotData = parentZone.subPlots.find(sp => sp.buildingId === buildingId);
        }
        if (!subPlotData && plotNum != null) {
            subPlotData = parentZone.subPlots.find(sp => sp.plotNum == plotNum);
        }
    }

    // 2. If not found in parentZone and buildingId was specified, search across all zones strictly by buildingId
    if (!subPlotData && buildingId) {
        for (const z of FIELD_COMMODITY_ZONES) {
            if (z.subPlots) {
                const found = z.subPlots.find(sp => sp.buildingId === buildingId);
                if (found) {
                    subPlotData = found;
                    parentZone = z;
                    break;
                }
            }
        }
    }

    // 3. If still not found and plotNum was specified, search across all zones by plotNum matching only non-screenhouse plots
    if (!subPlotData && plotNum != null) {
        for (const z of FIELD_COMMODITY_ZONES) {
            if (z.subPlots) {
                const found = z.subPlots.find(sp => sp.plotNum == plotNum && (!buildingId || sp.buildingId === buildingId));
                if (found) {
                    subPlotData = found;
                    parentZone = z;
                    break;
                }
            }
        }
    }

    // 4. Fallback to ALL_PLOT_POLYGONS if applicable
    if (!subPlotData && plotNum) {
        const plotFeature = ALL_PLOT_POLYGONS.find(f => f.properties.plotNum == plotNum);
        if (plotFeature) {
            subPlotData = {
                plotNum: plotNum,
                name: plotFeature.properties.name || `Plot ${plotNum}`,
                crop: plotFeature.properties.crop || '',
                polygon: plotFeature.geometry.coordinates,
                centerCoords: centerCoords
            };
        }
    }

    if (!subPlotData) return;

    let center = centerCoords || subPlotData.centerCoords;
    if (!center && subPlotData.polygon) {
        const coords = Array.isArray(subPlotData.polygon[0][0]) ? subPlotData.polygon[0] : subPlotData.polygon;
        const xs = coords.map(p => p[0]);
        const ys = coords.map(p => p[1]);
        center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    }
    if (!center) return;

    subPlotData.centerCoords = center;

    // 1. Activate Spotlight HUD Beacon & Ground Polygon Glow
    highlightSubPlot(subPlotData, (parentZone ? parentZone.color : '#38bdf8'), (parentZone ? parentZone.id : activeZoneId));

    if (typeof window.stopOrbit === 'function') window.stopOrbit();
    if (typeof window.stopIdleRotation === 'function') window.stopIdleRotation();
    if (typeof window.resetIdle === 'function') window.resetIdle();

    const isPhone = (typeof window.isPhoneMode === 'function') ? window.isPhoneMode() : (window.innerWidth <= 768);
    const isPortraitKiosk = (typeof document !== 'undefined' && document.body.classList.contains('kiosk-portrait')) ||
        ((typeof window !== 'undefined') && window.innerHeight > window.innerWidth && !isPhone);
    const pad = isPortraitKiosk
        ? { top: 90, bottom: Math.round((typeof window !== 'undefined' ? window.innerHeight : 1000) * 0.46), left: 24, right: 24 }
        : (isPhone
            ? { top: 70, bottom: 250, left: 16, right: 16 }
            : { top: 70, bottom: 70, left: 390, right: 410 }
        );

    // 2. Smooth 3D Perspective Camera Fly-In with Viewport Padding
    currentMap.flyTo({
        center: center,
        zoom: 19.8,
        pitch: 45,
        bearing: currentMap.getBearing() || 25,
        padding: pad,
        duration: 900,
        essential: true
    });
}

if (typeof window !== 'undefined') {

    window.FIELD_COMMODITY_ZONES = FIELD_COMMODITY_ZONES;
    window.ZONE_POLYGONS = ZONE_POLYGONS;
    window.ALL_PLOT_POLYGONS = ALL_PLOT_POLYGONS;
    window.INTERNAL_CUT_LINES = INTERNAL_CUT_LINES;

    window.selectPlotZone = selectPlotZone;

    window.deselectPlotZone = deselectPlotZone;

    window.zoomToSubPlot = zoomToSubPlot;

    window.highlightSubPlot = highlightSubPlot;

    window.clearSubPlotHighlight = clearSubPlotHighlight;

    window.initPlotLayers = initPlotLayers;

    window.updatePlotLayerStyles = updatePlotLayerStyles;

    window.togglePlotVisibility = togglePlotVisibility;

    window.updatePlotMarkerLOD = updatePlotMarkerLOD;

    window.setPlotZoneHover = setPlotZoneHover;

    window.clearPlotZoneHover = clearPlotZoneHover;

}

