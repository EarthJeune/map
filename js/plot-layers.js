// DA-LARES Field Plots & Commodity Zones Mapbox Layer Module
// Renders single seamless outer group rectangles (zero lines in the middle on overview),
// dynamic sub-plot cuts that illuminate strictly on selection, and clean pin LOD.

import { FIELD_COMMODITY_ZONES, ZONE_POLYGONS, ALL_PLOT_POLYGONS, INTERNAL_CUT_LINES, getPlotsGeoJSON, getSubPlotsGeoJSON } from './data/plots.js?v=83';
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
        return;
    }

    currentMap.addSource('plots-group-source', {
        type: 'geojson',
        data: groupData
    });

    currentMap.addSource('plots-cuts-source', {
        type: 'geojson',
        data: cutsData
    });

    // 1. Group Fill Layer (Translucent wash seated cleanly on ground furrows)
    currentMap.addLayer({
        id: 'plots-group-fill',
        type: 'fill',
        source: 'plots-group-source',
        paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'selected'], false], 0.35,
                ['boolean', ['feature-state', 'hover'], false], 0.25,
                0.16
            ]
        }
    });

    // 2. Seamless Outer Perimeter Casing (Single full rectangle with ZERO middle lines)
    currentMap.addLayer({
        id: 'plots-group-casing',
        type: 'line',
        source: 'plots-group-source',
        paint: {
            'line-color': ['get', 'color'],
            'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false], 3.8,
                ['boolean', ['feature-state', 'hover'], false], 2.8,
                1.8
            ],
            'line-opacity': 0.95
        }
    });

    // 3. Internal Sub-Plot Cuts (100% INVISIBLE on overview; illuminated ONLY on click/selection!)
    currentMap.addLayer({
        id: 'plots-internal-cuts',
        type: 'line',
        source: 'plots-cuts-source',
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

    // Hover effect across entire commodity zone
    let hoveredZoneId = null;
    currentMap.on('mousemove', 'plots-group-fill', (e) => {
        if (e.features && e.features.length > 0) {
            currentMap.getCanvas().style.cursor = 'pointer';
            const zid = e.features[0].properties.zoneId || e.features[0].properties.id;
            if (hoveredZoneId !== zid) {
                if (hoveredZoneId) {
                    currentMap.setFeatureState({ source: 'plots-group-source', id: hoveredZoneId }, { hover: false });
                    const prevMarker = document.querySelector(`.plot-map-marker[data-zone-id="${hoveredZoneId}"]`);
                    if (prevMarker) prevMarker.classList.remove('hovered');
                }
                hoveredZoneId = zid;
                currentMap.setFeatureState({ source: 'plots-group-source', id: zid }, { hover: true });
                const markerEl = document.querySelector(`.plot-map-marker[data-zone-id="${zid}"]`);
                if (markerEl) markerEl.classList.add('hovered');
            }
        }
    });

    currentMap.on('mouseleave', 'plots-group-fill', () => {
        currentMap.getCanvas().style.cursor = '';
        if (hoveredZoneId) {
            currentMap.setFeatureState({ source: 'plots-group-source', id: hoveredZoneId }, { hover: false });
            const markerEl = document.querySelector(`.plot-map-marker[data-zone-id="${hoveredZoneId}"]`);
            if (markerEl) markerEl.classList.remove('hovered');
            hoveredZoneId = null;
        }
    });

    // Click selection — activates neon border and illuminates sub-plot cuts
    currentMap.on('click', 'plots-group-fill', (e) => {
        if (!e.features || !e.features[0]) return;
        const zid = e.features[0].properties.zoneId || e.features[0].properties.id;
        selectPlotZone(zid);
    });

    // Clean Pin Strategy: update LOD when camera moves or zooms
    currentMap.on('zoom', updatePlotMarkerLOD);
    currentMap.on('moveend', updatePlotMarkerLOD);

    createPlotMarkers();
}

// Clean Pin Strategy: collapse pins into subtle chips at overview zoom (< 17.6)
export function updatePlotMarkerLOD() {
    const currentMap = state.map || (typeof window !== 'undefined' && window.map);
    if (!currentMap) return;
    const isClose = currentMap.getZoom() >= 17.6;

    document.querySelectorAll('.plot-map-marker').forEach(el => {
        if (isClose) {
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

    const isCollapsed = currentMap.getZoom() < 17.6;

    FIELD_COMMODITY_ZONES.forEach(zone => {
        const el = document.createElement('div');
        el.className = 'plot-map-marker' + (isCollapsed ? ' collapsed' : '');
        el.dataset.zoneId = zone.id;
        el.innerHTML = `
            <div class="plot-marker-badge" style="background: ${zone.color};">
                <span>${zone.icon}</span>
            </div>
            <div class="plot-marker-info">
                <span class="plot-marker-name">${zone.name}</span>
                ${zone.plotRange ? `<span class="plot-marker-range">${zone.plotRange}</span>` : ''}
            </div>
        `;

        el.addEventListener('mouseenter', () => {
            currentMap.setFeatureState({ source: 'plots-group-source', id: zone.id }, { hover: true });
        });

        el.addEventListener('mouseleave', () => {
            if (selectedPlotZoneId !== zone.id) {
                currentMap.setFeatureState({ source: 'plots-group-source', id: zone.id }, { hover: false });
            }
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

export function togglePlotVisibility(visible) {
    const currentMap = state.map || (typeof window !== 'undefined' && window.map);
    if (!currentMap) return;

    const vis = visible ? 'visible' : 'none';
    ['plots-group-fill', 'plots-group-casing', 'plots-internal-cuts'].forEach(lid => {
        if (currentMap.getLayer(lid)) {
            try { currentMap.setLayoutProperty(lid, 'visibility', vis); } catch (e) { }
        }
    });

    plotMarkers.forEach(m => {
        if (m.getElement()) {
            m.getElement().style.display = visible ? 'inline-flex' : 'none';
        }
    });
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

    // 1. Illuminate target zone outer boundary on plots-group-source
    FIELD_COMMODITY_ZONES.forEach(z => {
        const isMatch = (z.id === targetZoneId);
        currentMap.setFeatureState({ source: 'plots-group-source', id: z.id }, { selected: isMatch });
    });

    // 2. Dynamically illuminate ONLY the internal cuts of the selected zone on plots-cuts-source
    INTERNAL_CUT_LINES.forEach(cut => {
        const isCutMatch = (cut.properties.zoneId === targetZoneId);
        currentMap.setFeatureState({ source: 'plots-cuts-source', id: cut.id }, { selected: isCutMatch });
    });

    // 3. Highlight marker on ground
    document.querySelectorAll('.plot-map-marker').forEach(el => {
        el.classList.toggle('active', el.dataset.zoneId === targetZoneId);
    });

    // 4. Smooth camera flight to zone center
    if (currentMap) {
        currentMap.flyTo({
            center: zone.centerCoords,
            zoom: 18.0,
            pitch: 45,
            duration: 1200
        });
    }

    // 5. Open Slide-out Details Drawer with Sub-Plot Breakdown
    if (typeof showPlotPanel === 'function') {
        showPlotPanel(targetZoneId);
    }
}

export function deselectPlotZone() {
    const currentMap = state.map || (typeof window !== 'undefined' && window.map);
    selectedPlotZoneId = null;

    if (currentMap) {
        FIELD_COMMODITY_ZONES.forEach(z => {
            currentMap.setFeatureState({ source: 'plots-group-source', id: z.id }, { selected: false });
        });
        INTERNAL_CUT_LINES.forEach(cut => {
            currentMap.setFeatureState({ source: 'plots-cuts-source', id: cut.id }, { selected: false });
        });
    }

    document.querySelectorAll('.plot-map-marker').forEach(el => {
        el.classList.remove('active');
    });
}

// Deep zoom directly into an individual sub-plot partition
export function zoomToSubPlot(plotNum) {
    const currentMap = state.map || (typeof window !== 'undefined' && window.map);
    if (!currentMap) return;

    const plotFeature = ALL_PLOT_POLYGONS.find(f => f.properties.plotNum == plotNum);
    if (!plotFeature) return;

    const coords = plotFeature.geometry.coordinates[0];
    const xs = coords.map(p => p[0]);
    const ys = coords.map(p => p[1]);
    const center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];

    currentMap.flyTo({
        center: center,
        zoom: 19.2,
        pitch: 40,
        duration: 1000
    });
}

if (typeof window !== 'undefined') {
    window.selectPlotZone = selectPlotZone;
    window.deselectPlotZone = deselectPlotZone;
    window.zoomToSubPlot = zoomToSubPlot;
    window.initPlotLayers = initPlotLayers;
}
