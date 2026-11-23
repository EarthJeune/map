// DA-LARES Building Info Panel & Color Customization Module



// Building detail drawer, photo gallery trigger, and color picker.







import { DEFAULT_MAP_VIEW } from './data/config.js';



import { getActiveStationDefaultView } from './data/stations.js';



import { BUILDING_DIRECTORY, getBuildingById } from './data/buildings.js';



import { renderBuildingOfficesHTML, highlightSearchTermsHtml, escapeSearchHtml, matchesSearchText } from './data/offices.js';



import { getBuildingWayfindingInfo } from './data/descriptions.js';



import { state } from './data/state.js';
import { renderFacilityStatusBadgeHtml } from './status-filter.js';



import { map, getRoofColorCaseStyle } from './map-setup.js';



import { updateBuildingQR, closeQRZoomModal } from './qr.js';



import { stopOrbit, resetIdle } from './idle.js';



import { removeMarkers, createMarkers } from './markers.js';



import { buildDirectory } from './sidebar.js';



import { FIELD_COMMODITY_ZONES } from './data/plots.js';
import { lucideIcon, renderIconOrText } from './data/icons.js';







export function showBuildingPanel(buildingId, targetOffice = '') {



    state.isIntroAnimating = false;



    state.selectedBuildingId = buildingId;



    window.selectedBuildingId = buildingId;



    if (targetOffice) {



        state.activeSearchedOffice = targetOffice;



    }



    if (typeof window.deselectPlotZone === 'function') window.deselectPlotZone();



    if (typeof window.clearSubPlotHighlight === 'function') window.clearSubPlotHighlight();



    const building = (typeof getBuildingById === 'function')



        ? getBuildingById(buildingId)



        : BUILDING_DIRECTORY.find(b => b.id === buildingId);



    if (!building) return;







    const num = building.num || 1;



    const panel = document.getElementById('building-panel');

    if (!panel) return;

    panel.dataset.buildingId = buildingId;
    panel.dataset.panelMode = 'building';
    panel._activePlotContext = null;







    // Retrieve visitor-friendly wayfinding descriptions



    const wfInfo = getBuildingWayfindingInfo(buildingId, building.desc);







    // Set number badge



    const numEl = document.getElementById('bp-number');



    if (numEl) {



        if (building.isGate) {
            const svgFn = (typeof getMapboxGateSvg === 'function')
                ? getMapboxGateSvg
                : (typeof window.getMapboxGateSvg === 'function' ? window.getMapboxGateSvg : null);
            numEl.innerHTML = svgFn ? svgFn(building.color || '#10b981', true) : lucideIcon('door-open', 18);
            numEl.classList.add('bp-number-gate');
            numEl.style.background = 'transparent';
        } else if (!building.num) {
            numEl.classList.remove('bp-number-gate');
            numEl.innerHTML = renderIconOrText(building.icon || 'landmark', 18);
            numEl.style.background = building.color || '#3b82f6';
            numEl.style.fontSize = '20px';
        } else {
            numEl.classList.remove('bp-number-gate');
            numEl.textContent = building.num;
            numEl.style.background = building.color || '#3b82f6';
            numEl.style.fontSize = '';
        }



    }







    // Set title and scannable subtitle



    const titleEl = document.getElementById('bp-title');



    const subEl = document.getElementById('bp-subtitle');



    if (titleEl) titleEl.textContent = building.name;



    const isUnderDevStation = Boolean(building.isQARES || building.isRARES);

    if (subEl) {
        subEl.textContent = isUnderDevStation
            ? (building.category || 'Facility')
            : (wfInfo.compactTag || building.desc || 'Research Facility');
    }

    const statusPillEl = document.getElementById('bp-status-pill');
    if (statusPillEl) statusPillEl.innerHTML = building.isGate ? '' : renderFacilityStatusBadgeHtml(building.facility_status);

    // Populate Visual Landmark & Key Services wayfinding cards (suppressed cleanly for QARES/RARES)
    const wfBlock = panel.querySelector('.bp-wayfinding-block');
    const visEl = document.getElementById('bp-visual-landmark');
    const srvEl = document.getElementById('bp-key-services');
    const activeSearchQuery = (document.getElementById('search-input')?.value || document.getElementById('phone-search-input')?.value || '').trim();

    if (isUnderDevStation) {
        if (wfBlock) wfBlock.style.display = 'none';
        if (visEl) { visEl.dataset.rawText = ''; visEl.textContent = ''; }
        if (srvEl) { srvEl.dataset.rawText = ''; srvEl.textContent = ''; }
    } else {
        if (wfBlock) wfBlock.style.display = '';
        if (visEl) {
            const rawVis = wfInfo.visualLandmark || '';
            visEl.dataset.rawText = rawVis;
            visEl.innerHTML = highlightSearchTermsHtml(rawVis, activeSearchQuery);
        }
        if (srvEl) {
            const rawSrv = wfInfo.keyServices || '';
            srvEl.dataset.rawText = rawSrv;
            srvEl.innerHTML = highlightSearchTermsHtml(rawSrv, activeSearchQuery);
        }
    }







    // Backward-compatible meta rows (if present in DOM)



    const secEl = document.getElementById('bp-section');



    const typeEl = document.getElementById('bp-type');



    const coordsEl = document.getElementById('bp-coords');



    if (secEl) secEl.textContent = building.section || 'Compound';



    if (typeEl) typeEl.textContent = building.type || 'Standalone Facility';



    if (coordsEl && building.coords) {



        coordsEl.textContent = building.coords[1].toFixed(5) + '°N, ' + building.coords[0].toFixed(5) + '°E';



    }







    // Render offices & units with highlighted query



    const officesContainer = document.getElementById('bp-offices-container');
    const officesCard = document.getElementById('bp-offices-card') || (officesContainer ? officesContainer.closest('.bp-card') : null);



    if (officesContainer) {



        if (building.isGate) {
            officesContainer.innerHTML = '';
            if (officesCard) officesCard.style.display = 'none';
        } else if (building.isQARES) {
            if (officesCard) officesCard.style.display = '';



            // Strictly Ground-Truth: QARES has no internal offices assigned yet



            officesContainer.innerHTML = '';



        } else {
            if (officesCard) officesCard.style.display = '';



            const query = targetOffice || state.activeSearchedOffice || document.getElementById('search-input')?.value || '';



            officesContainer.innerHTML = renderBuildingOfficesHTML(buildingId, query);



            const highlightedPill = officesContainer.querySelector('.office-pill.highlighted');



            if (highlightedPill) {



                setTimeout(() => {



                    highlightedPill.scrollIntoView({ behavior: 'smooth', block: 'nearest' });



                }, 150);



            }



        }



    }







    // Load Image with unified Hero Controller (suppressed for QARES/RARES clean menu)
    const imgArea = document.getElementById('bp-image-area');
    if (isUnderDevStation) {
        if (imgArea) imgArea.style.display = 'none';
    } else {
        if (imgArea) imgArea.style.display = 'block';
        const safeId = buildingId.replace(/\//g, '_');
        const fallbackSrc = building.image || `images/${safeId}.webp`;
        const bldgViews = Array.isArray(building.images) && building.images.length > 0
            ? building.images
                .map((im, i) => ({
                    src: im.src || im.image_webp_url || '',
                    label: im.label || im.caption || `Photo ${i + 1}`
                }))
                .filter(v => Boolean(v.src))
            : [{ src: fallbackSrc, label: building.isGate ? 'Access Gate' : 'Facade' }];
        const imgPath = bldgViews[0]?.src || fallbackSrc;
        setDrawerHeroImage({
            src: imgPath,
            title: building.name,
            badgeDotColor: building.color || (building.isGate ? '#10b981' : '#3b82f6'),
            views: bldgViews,
            activeIdx: 0,
            fallbackIcon: building.isGate ? '🚪' : '🏛️'
        });
    }

    // Show panel (Restore actions and QR for buildings)
    panel.classList.remove('is-plot-panel');
    const actionsEl = panel.querySelector('.bp-actions');
    if (actionsEl) actionsEl.style.display = '';

    // Update QR code for mobile handoff
    updateBuildingQR(buildingId);

    panel.classList.add('active');
    document.body.classList.add('has-active-bldg-panel');

    // If opening Plot 22 utility facilities, trigger sub-plot highlight (polygon casing & spotlight beacon)
    if (buildingId === 'plot22_water_tank' || buildingId === 'plot22_comfort_room') {
        const coffeeZone = (typeof FIELD_COMMODITY_ZONES !== 'undefined')
            ? FIELD_COMMODITY_ZONES.find(z => z.id === 'zone_coffee_orchard')
            : null;
        const subPlot = coffeeZone && coffeeZone.subPlots
            ? coffeeZone.subPlots.find(sp => sp.buildingId === buildingId)
            : null;
        if (subPlot && typeof window.highlightSubPlot === 'function') {
            window.highlightSubPlot(subPlot, building.color || '#38bdf8', 'zone_coffee_orchard');
        }
    }
}







export function closeBuildingPanel(skipFly = false) {



    if (typeof closeQRZoomModal === 'function') {



        closeQRZoomModal();



    } else if (typeof window.closeQRZoomModal === 'function') {



        window.closeQRZoomModal();



    }



    const panel = document.getElementById('building-panel');



    const wasActive = panel && panel.classList.contains('active');



    if (panel) {
        panel.classList.remove('active');
        panel.classList.remove('is-plot-panel');
        const actionsEl = panel.querySelector('.bp-actions');
        if (actionsEl) actionsEl.style.display = '';
    }



    if (typeof window.clearSubPlotHighlight === 'function') window.clearSubPlotHighlight();



    document.body.classList.remove('has-active-bldg-panel');



    



    // Unhighlight directory items and map markers



    document.querySelectorAll('.gate-callout-badge').forEach(el => el.classList.remove('active'));

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







    state.selectedBuildingId = null;



    window.selectedBuildingId = null;



    state.activeSearchedOffice = '';



    stopOrbit();







    if (typeof restoreLabels === 'function') {



        restoreLabels();



    }







    // Fly back to active station default overview angle only if panel was actually open and skipFly is not requested



    if (wasActive && !skipFly && map) {



        const defaultView = getActiveStationDefaultView();



        map.flyTo({ 



            center: defaultView.center, 



            zoom: defaultView.zoom, 



            pitch: defaultView.pitch, 



            bearing: defaultView.bearing, 



            duration: 1500 



        });



    }







    if (typeof window.deselectPlotZone === 'function') {



        window.deselectPlotZone();



    }







    resetIdle();



}







function renderDesktopPlotSections(zone, areaText, plotCountText, rangeText, searchQuery = '') {
    const visEl = document.getElementById('bp-visual-landmark');
    const srvEl = document.getElementById('bp-key-services');
    const officesContainer = document.getElementById('bp-offices-container');
    const overviewRaw = zone.description || `Research field block for ${zone.name} situated along the station farm drives.`;

    if (visEl) {
        visEl.dataset.rawText = overviewRaw;
        visEl.innerHTML = highlightSearchTermsHtml(overviewRaw, searchQuery);
    }

    if (srvEl) {
        const cropLine = zone.currentCrop
            ? `<div><strong style="color:#4ade80;">Current Planted Crop:</strong> <span style="color:#f8fafc;">${highlightSearchTermsHtml(zone.currentCrop, searchQuery)}</span></div>`
            : '';
        const treeLine = (zone.treeCount !== null && zone.treeCount !== undefined && zone.treeCount !== '')
            ? `<div><strong style="color:#4ade80;">Tree / Plant Count:</strong> <span style="color:#f8fafc;">${Number(zone.treeCount).toLocaleString()} trees/plants</span></div>`
            : '';
        const cycleLine = zone.cycleMonths
            ? `<div><strong style="color:#38bdf8;">Cropping Cycle:</strong> <span style="color:#f8fafc;">${highlightSearchTermsHtml(zone.cycleMonths, searchQuery)}</span></div>`
            : '';
        const statusLine = zone.status
            ? `<div><strong style="color:#38bdf8;">Plot Status:</strong> <span style="color:#86efac; font-weight:700;">${highlightSearchTermsHtml(zone.status, searchQuery)}</span></div>`
            : '';

        srvEl.innerHTML = `
            <div class="bp-plot-metrics" style="display:flex; flex-direction:column; gap:6px; font-size:12px;">
                ${cropLine}
                ${treeLine}
                ${cycleLine}
                ${statusLine}
                <div><strong style="color:#38bdf8;">Estimated Area:</strong> <span style="color:#f8fafc;">${escapeSearchHtml(areaText)}</span></div>
                <div><strong style="color:#38bdf8;">Total Plots:</strong> <span style="color:#f8fafc;">${escapeSearchHtml(plotCountText)} (${highlightSearchTermsHtml(rangeText, searchQuery)})</span></div>
                <div><strong style="color:#38bdf8;">Plot Category:</strong> <span style="color:#f8fafc;">${escapeSearchHtml((zone.category || 'Agricultural Plot').toUpperCase())}</span></div>
            </div>
        `;
    }

    if (officesContainer) {
        if (zone.subPlots && zone.subPlots.length > 0) {
            const normQuery = String(searchQuery || '').trim().toLowerCase();
            let html = `
                <div class="bp-sub-plots-section" style="margin-top:14px;">
                    <div class="bldg-offices-header" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <span class="bldg-offices-title" style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; color:#38bdf8;">${lucideIcon('sprout', 14)} Sub-Plots (${zone.subPlots.length})</span>
                        <span style="font-size:10px; color:#94a3b8;">Tap to zoom</span>
                    </div>
                    <div class="bldg-offices-pills" style="display:flex; flex-direction:column; gap:6px;">
            `;
            zone.subPlots.forEach(sp => {
                const subTitle = sp.label || sp.name || `Screenhouse ${sp.plotNum}`;
                const coordsJson = sp.centerCoords ? `[${sp.centerCoords[0]}, ${sp.centerCoords[1]}]` : 'null';
                const bldgJson = sp.buildingId ? `'${sp.buildingId}'` : 'null';
                const isSubMatched = Boolean(normQuery && (
                    matchesSearchText(subTitle, normQuery) ||
                    (sp.details && matchesSearchText(sp.details, normQuery)) ||
                    (sp.crop && matchesSearchText(sp.crop, normQuery))
                ));
                html += `
                    <div class="office-pill sub-plot-chip ${isSubMatched ? 'highlighted' : ''}" data-plot-num="${sp.plotNum}" data-id="${sp.buildingId || ''}" data-zone-id="${zone.id}" onclick="if(window.zoomToSubPlot) window.zoomToSubPlot('${sp.plotNum}', ${coordsJson}, ${bldgJson}, '${zone.id}')" title="Click to zoom directly into ${escapeSearchHtml(subTitle)}" style="cursor:pointer; display:flex; align-items:flex-start; gap:10px; padding:8px 12px; border-radius:8px; background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.08); transition:all 0.15s ease;">
                        <span class="op-dot" style="background:${zone.color}; width:8px; height:8px; border-radius:50%; margin-top:5px; flex-shrink:0;"></span>
                        <div style="display:flex; flex-direction:column; line-height:1.25;">
                            <span class="op-name" style="font-size:12px; font-weight:700; color:#f8fafc;">${highlightSearchTermsHtml(subTitle, searchQuery)}</span>
                            ${sp.details ? `<span style="font-size:11px; color:#94a3b8; margin-top:2px;">${highlightSearchTermsHtml(sp.details, searchQuery)}</span>` : ''}
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
            officesContainer.innerHTML = html;
        } else {
            officesContainer.innerHTML = '';
        }
    }
}

export function refreshBuildingPanelSearchHighlights(query = '') {
    const panel = document.getElementById('building-panel');
    if (!panel || !panel.classList.contains('active')) return;
    const trimmed = String(query || '').trim();

    if (panel.dataset.panelMode === 'plot' && panel._activePlotContext) {
        const { zone, areaText, plotCountText, rangeText } = panel._activePlotContext;
        renderDesktopPlotSections(zone, areaText, plotCountText, rangeText, trimmed);
        return;
    }

    const visEl = document.getElementById('bp-visual-landmark');
    const srvEl = document.getElementById('bp-key-services');
    if (visEl && typeof visEl.dataset.rawText === 'string') {
        visEl.innerHTML = highlightSearchTermsHtml(visEl.dataset.rawText, trimmed);
    }
    if (srvEl && typeof srvEl.dataset.rawText === 'string') {
        srvEl.innerHTML = highlightSearchTermsHtml(srvEl.dataset.rawText, trimmed);
    }

    const currentBldgId = state.selectedBuildingId || window.selectedBuildingId || panel.dataset.buildingId;
    const officesContainer = document.getElementById('bp-offices-container');
    if (officesContainer && currentBldgId) {
        officesContainer.innerHTML = renderBuildingOfficesHTML(currentBldgId, trimmed);
        const highlightedPill = officesContainer.querySelector('.office-pill.highlighted');
        if (highlightedPill) {
            setTimeout(() => {
                highlightedPill.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 120);
        }
    }
}

export function showPlotPanel(zoneId) {



    state.isIntroAnimating = false;



    const zone = (typeof FIELD_COMMODITY_ZONES !== 'undefined')



        ? FIELD_COMMODITY_ZONES.find(z => 



            z.id === zoneId || 



            (z.plotsList && z.plotsList.includes(Number(zoneId))) ||



            (z.subPlots && z.subPlots.some(sp => `plot_${sp.plotNum}` === zoneId || sp.plotNum == zoneId))



          )



        : null;



    if (!zone) return;







    state.selectedBuildingId = zone.id;



    window.selectedBuildingId = zone.id;



    state.activeRoute = null;







    const panel = document.getElementById('building-panel');

    if (!panel) return;

    panel.dataset.buildingId = zone.id;
    panel.dataset.panelMode = 'plot';







    // 1. Number/Icon Badge



    const numEl = document.getElementById('bp-number');



    if (numEl) {



        numEl.innerHTML = zone.id === 'zone_mango_banana_jackfruit' ? lucideIcon('trees', 18) : renderIconOrText(zone.icon || 'wheat', 18);



        numEl.style.background = zone.color || '#10b981';



        numEl.style.color = '#ffffff';



        numEl.style.fontSize = '18px';



    }







    // 2. Title and Subtitle



    const titleEl = document.getElementById('bp-title');



    const subEl = document.getElementById('bp-subtitle');



    if (titleEl) titleEl.textContent = zone.name;

    const statusPillEl = document.getElementById('bp-status-pill');

    if (statusPillEl) statusPillEl.innerHTML = renderFacilityStatusBadgeHtml(zone.facility_status);



    const plotCountText = `${zone.plotCount || 1} Sub-Plot${(zone.plotCount > 1) ? 's' : ''}`;



    const rangeText = zone.plotRange || `Plot ${zone.plotsList ? zone.plotsList.join(', ') : ''}`;



    let areaText = zone.areaSqm || '';



    if (!areaText && typeof turf !== 'undefined' && zone.groupPolygon) {



        try {



            const sqmMeters = Math.round(turf.area(turf.polygon([zone.groupPolygon])));



            if (sqmMeters >= 10000) {



                areaText = `${sqmMeters.toLocaleString()} m² (${(sqmMeters / 10000).toFixed(2)} ha)`;



            } else {



                areaText = `${sqmMeters.toLocaleString()} m²`;



            }



        } catch (e) {



            areaText = 'Calibrated Field Area';



        }



    } else if (!areaText) {



        areaText = 'Calibrated Field Area';



    }







    if (subEl) subEl.textContent = `${rangeText} • ${plotCountText} • ${areaText}`;







    // 3. Visitor Wayfinding Cards (Visual Landmark & Key Details) & Sub-Plots
    panel._activePlotContext = { zone, areaText, plotCountText, rangeText };
    const activeSearchQuery = (document.getElementById('search-input')?.value || document.getElementById('phone-search-input')?.value || '').trim();

    // 4. Meta rows (if in DOM)
    const secEl = document.getElementById('bp-section');
    const typeEl = document.getElementById('bp-type');
    const coordsEl = document.getElementById('bp-coords');

    if (secEl) secEl.textContent = 'Agricultural Plot';
    if (typeEl) typeEl.textContent = 'Research Field Block';
    if (coordsEl && zone.centerCoords) {
        coordsEl.textContent = zone.centerCoords[1].toFixed(5) + '°N, ' + zone.centerCoords[0].toFixed(5) + '°E';
    }

    // 5. Populate Overview, Metrics & Sub-Plots list with active search highlights
    renderDesktopPlotSections(zone, areaText, plotCountText, rangeText, activeSearchQuery);

    // 6. Image area setup: support Master Zone image or cleanly hide if no photo
    const imgArea = document.getElementById('bp-image-area');
    if (zone && zone.image) {
        if (imgArea) imgArea.style.display = 'block';
        restoreDrawerHeroMaster(zone);
    } else {
        if (imgArea) imgArea.style.display = 'none';
        const placeholderEl = document.getElementById('bp-image-placeholder');
        if (placeholderEl) placeholderEl.style.display = 'none';
    }

    // 7. Enable Get Directions, GPS navigation, and QR code handoff for agricultural plots
    panel.classList.add('is-plot-panel');
    const actionsEl = panel.querySelector('.bp-actions');
    if (actionsEl) actionsEl.style.display = '';
    updateBuildingQR(zone.id);

    // 8. Open drawer
    panel.classList.add('active');
    document.body.classList.add('has-active-bldg-panel');
}











// COLOR PICKER LOGIC



// ==========================================



let activeColorId = null;







export function openColorPicker(id, name) {



    activeColorId = id;



    document.getElementById('cp-name').innerText = name;







    const colors = state.savedBuildingColors || {};



    const roofHex = (colors[id] && colors[id].roof) ? colors[id].roof : '#334155';



    const iconHex = (colors[id] && colors[id].icon) ? colors[id].icon : '#3b82f6';







    document.getElementById('cp-roof').value = roofHex;



    document.getElementById('cp-roof-hex').value = roofHex.toUpperCase();







    document.getElementById('cp-icon').value = iconHex;



    document.getElementById('cp-icon-hex').value = iconHex.toUpperCase();







    document.getElementById('color-picker-modal').style.display = 'block';



}







export function closeColorPicker() {



    document.getElementById('color-picker-modal').style.display = 'none';



    activeColorId = null;



}







export function saveColorPicker() {



    if (!activeColorId) return;



    const roofColor = document.getElementById('cp-roof').value;



    const iconColor = document.getElementById('cp-icon').value;







    if (!state.savedBuildingColors) state.savedBuildingColors = {};



    if (!state.savedBuildingColors[activeColorId]) state.savedBuildingColors[activeColorId] = {};



    state.savedBuildingColors[activeColorId].roof = roofColor;



    state.savedBuildingColors[activeColorId].icon = iconColor;







    // Post to backend database



    fetch('/api/colors', {



        method: 'POST',



        headers: { 'Content-Type': 'application/json' },



        body: JSON.stringify(state.savedBuildingColors)



    }).then(() => {



        // Update Directory Object



        const b = BUILDING_DIRECTORY.find(item => item.id === activeColorId);



        if (b) b.color = iconColor;







        removeMarkers();



        createMarkers();







        // Update Map



        if (map.getLayer('3d-drawings-roofs')) {



            map.setPaintProperty('3d-drawings-roofs', 'fill-extrusion-color', getRoofColorCaseStyle());



        }



        if (map.getLayer('3d-drawings-roofs-transparent')) {



            map.setPaintProperty('3d-drawings-roofs-transparent', 'fill-extrusion-color', getRoofColorCaseStyle());



        }







        // Update UI Directory



        const searchInput = document.getElementById('search-input');



        buildDirectory(searchInput ? searchInput.value : '');



        closeColorPicker();



    });



}







export function syncColorInputs(colorId, hexId) {



    const colorInput = document.getElementById(colorId);



    const hexInput = document.getElementById(hexId);



    if (!colorInput || !hexInput) return;







    colorInput.addEventListener('input', (e) => {



        hexInput.value = e.target.value.toUpperCase();



    });







    hexInput.addEventListener('input', (e) => {



        let val = e.target.value;



        if (!val.startsWith('#')) val = '#' + val;



        if (/^#[0-9A-F]{6}$/i.test(val)) {



            colorInput.value = val;



        }



    });



}







export async function useEyeDropper(colorId, hexId) {



    if (!window.EyeDropper) {



        alert("Your browser does not support the EyeDropper API");



        return;



    }



    const eyeDropper = new EyeDropper();



    try {



        const result = await eyeDropper.open();



        const hexColor = result.sRGBHex;



        document.getElementById(colorId).value = hexColor;



        document.getElementById(hexId).value = hexColor.toUpperCase();



    } catch (e) {



        // User canceled the eyedropper



    }



}







document.addEventListener('DOMContentLoaded', () => {



    syncColorInputs('cp-roof', 'cp-roof-hex');



    syncColorInputs('cp-icon', 'cp-icon-hex');



    // handleUrlParameters called from app.js?v=208



});







// ==========================================







window.showBuildingPanel = showBuildingPanel;



window.showPlotPanel = showPlotPanel;
window.refreshBuildingPanelSearchHighlights = refreshBuildingPanelSearchHighlights;



window.closeBuildingPanel = closeBuildingPanel;



window.openColorPicker = openColorPicker;



window.closeColorPicker = closeColorPicker;



window.saveColorPicker = saveColorPicker;



window.syncColorInputs = syncColorInputs;



window.useEyeDropper = useEyeDropper;





// ==========================================
// DYNAMIC DRAWER HERO CONTROLLER (Alternative 1)
// ==========================================
let currentHeroViews = [];
let currentHeroActiveIdx = 0;
let currentHeroTitle = '';

export function setDrawerHeroImage({ src, title = '', subtitle = '', badgeDotColor = '#38bdf8', views = [], activeIdx = 0, fallbackIcon = '📷' } = {}) {
    const areaEl = document.getElementById('bp-image-area');
    const imgEl = document.getElementById('bp-real-image');
    const placeholderEl = document.getElementById('bp-image-placeholder');
    const vignetteEl = document.getElementById('bp-image-vignette');
    const badgeEl = document.getElementById('bp-image-badge');
    const badgeTextEl = document.getElementById('bp-image-badge-text');
    const badgeDotEl = badgeEl ? badgeEl.querySelector('.bp-badge-dot') : null;
    const expandHintEl = document.getElementById('bp-image-expand-hint');
    const viewsBarEl = document.getElementById('bp-image-views-bar');
    const prevBtn = document.getElementById('bp-slide-prev');
    const nextBtn = document.getElementById('bp-slide-next');
    const counterEl = document.getElementById('bp-slide-counter');

    currentHeroViews = views && views.length > 0 ? views : (src ? [{ src, label: 'Main View' }] : []);
    currentHeroActiveIdx = activeIdx;
    currentHeroTitle = title || subtitle || 'Facility Photo';

    const activeId = state.selectedBuildingId || (typeof window !== 'undefined' && window.selectedBuildingId) || '';
    const isPlot = activeId.startsWith('zone_') || activeId.startsWith('plot_') || Boolean(typeof window !== 'undefined' && window.selectedPlotZoneId);

    if (!src) {
        if (imgEl) imgEl.style.display = 'none';
        if (vignetteEl) vignetteEl.style.display = 'none';
        if (badgeEl) badgeEl.style.display = 'none';
        if (expandHintEl) expandHintEl.style.display = 'none';
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        if (counterEl) counterEl.style.display = 'none';
        if (viewsBarEl) { viewsBarEl.innerHTML = ''; viewsBarEl.style.display = 'none'; }
        if (isPlot) {
            if (areaEl) areaEl.style.display = 'none';
            if (placeholderEl) placeholderEl.style.display = 'none';
        } else {
            if (areaEl) areaEl.style.display = 'block';
            if (placeholderEl) {
                placeholderEl.style.display = 'flex';
                const iconSpan = placeholderEl.querySelector('.bp-image-icon');
                if (iconSpan) iconSpan.innerHTML = renderIconOrText(fallbackIcon, 24);
                const textSpan = placeholderEl.querySelector('span:last-child');
                if (textSpan) textSpan.textContent = title ? `${title} (No Photo)` : 'No photo available';
            }
        }
        return;
    }

    const testImg = new Image();
    testImg.onload = function() {
        if (!imgEl) return;
        if (areaEl) areaEl.style.display = 'block';
        imgEl.src = src;
        imgEl.style.display = 'block';
        imgEl.style.opacity = '1';
        if (placeholderEl) placeholderEl.style.display = 'none';
        if (vignetteEl) vignetteEl.style.display = 'block';
        if (expandHintEl) {
            expandHintEl.style.display = 'flex';
            expandHintEl.onclick = (e) => {
                e.stopPropagation();
                if (typeof window.openPhotoLightbox === 'function') {
                    const activeView = currentHeroViews[currentHeroActiveIdx] || { src: imgEl.src, label: 'Main View' };
                    window.openPhotoLightbox(activeView.src, `${currentHeroTitle} — ${activeView.label}`);
                }
            };
        }
        imgEl.onclick = () => {
            if (typeof window.openPhotoLightbox === 'function') {
                const activeView = currentHeroViews[currentHeroActiveIdx] || { src: imgEl.src, label: 'Main View' };
                window.openPhotoLightbox(activeView.src, `${currentHeroTitle} — ${activeView.label}`);
            }
        };

        // Render badge
        if (badgeEl && badgeTextEl) {
            badgeTextEl.textContent = title || subtitle || 'Facility Photo';
            badgeEl.style.display = 'flex';
            if (badgeDotEl) {
                badgeDotEl.style.background = badgeDotColor;
                badgeDotEl.style.boxShadow = `0 0 8px ${badgeDotColor}`;
            }
        }

        // Render views switcher & prev/next slideshow arrows if multiple photos exist
        const hasMulti = currentHeroViews.length > 1;
        if (prevBtn) {
            prevBtn.style.display = hasMulti ? 'flex' : 'none';
            prevBtn.onclick = (e) => {
                e.stopPropagation();
                if (currentHeroViews.length > 1) {
                    const nextIdx = (currentHeroActiveIdx - 1 + currentHeroViews.length) % currentHeroViews.length;
                    switchHeroView(nextIdx);
                }
            };
        }
        if (nextBtn) {
            nextBtn.style.display = hasMulti ? 'flex' : 'none';
            nextBtn.onclick = (e) => {
                e.stopPropagation();
                if (currentHeroViews.length > 1) {
                    const nextIdx = (currentHeroActiveIdx + 1) % currentHeroViews.length;
                    switchHeroView(nextIdx);
                }
            };
        }
        if (counterEl) {
            counterEl.style.display = hasMulti ? 'block' : 'none';
            counterEl.textContent = `${currentHeroActiveIdx + 1} / ${currentHeroViews.length}`;
        }

        if (viewsBarEl) {
            if (hasMulti) {
                let chipsHtml = '';
                currentHeroViews.forEach((v, idx) => {
                    const isActive = idx === currentHeroActiveIdx;
                    chipsHtml += `<button type="button" class="bp-view-chip ${isActive ? 'active' : ''}" data-idx="${idx}">${v.label || `View ${idx + 1}`}</button>`;
                });
                viewsBarEl.innerHTML = chipsHtml;
                viewsBarEl.style.display = 'flex';
                viewsBarEl.querySelectorAll('.bp-view-chip').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const idx = parseInt(btn.dataset.idx, 10);
                        if (!isNaN(idx) && currentHeroViews[idx]) {
                            switchHeroView(idx);
                        }
                    };
                });
            } else {
                viewsBarEl.innerHTML = '';
                viewsBarEl.style.display = 'none';
            }
        }
    };

    testImg.onerror = function() {
        // Transparent fallback: if webp requested but not found, try jpg before falling back to placeholder
        if (src && src.endsWith('.webp') && !testImg.src.includes('?fallback=1')) {
            testImg.src = src.replace(/\.webp$/, '.jpg') + '?fallback=1';
            return;
        }
        if (imgEl) imgEl.style.display = 'none';
        if (vignetteEl) vignetteEl.style.display = 'none';
        if (badgeEl) badgeEl.style.display = 'none';
        if (expandHintEl) expandHintEl.style.display = 'none';
        if (prevBtn) prevBtn.style.display = 'none';
        if (nextBtn) nextBtn.style.display = 'none';
        if (counterEl) counterEl.style.display = 'none';
        if (viewsBarEl) { viewsBarEl.innerHTML = ''; viewsBarEl.style.display = 'none'; }
        if (isPlot) {
            if (areaEl) areaEl.style.display = 'none';
            if (placeholderEl) placeholderEl.style.display = 'none';
        } else {
            if (areaEl) areaEl.style.display = 'block';
            if (placeholderEl) {
                placeholderEl.style.display = 'flex';
                const iconSpan = placeholderEl.querySelector('.bp-image-icon');
                if (iconSpan) iconSpan.innerHTML = renderIconOrText(fallbackIcon, 24);
                const textSpan = placeholderEl.querySelector('span:last-child');
                if (textSpan) textSpan.textContent = title ? `${title} (No Photo)` : 'No photo available';
            }
        }
    };

    testImg.src = src;
}

export function switchHeroView(idx) {
    if (!currentHeroViews || !currentHeroViews[idx]) return;
    currentHeroActiveIdx = idx;
    const view = currentHeroViews[idx];
    const imgEl = document.getElementById('bp-real-image');
    const badgeTextEl = document.getElementById('bp-image-badge-text');
    const viewsBarEl = document.getElementById('bp-image-views-bar');
    const counterEl = document.getElementById('bp-slide-counter');

    if (imgEl) {
        imgEl.style.opacity = '0.35';
        setTimeout(() => {
            imgEl.src = view.src;
            imgEl.style.opacity = '1';
        }, 120);
    }
    if (badgeTextEl && view.label) {
        badgeTextEl.textContent = `${currentHeroTitle} — ${view.label}`;
    }
    if (counterEl && currentHeroViews.length > 1) {
        counterEl.textContent = `${idx + 1} / ${currentHeroViews.length}`;
    }
    if (viewsBarEl) {
        viewsBarEl.querySelectorAll('.bp-view-chip').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.idx, 10) === idx);
        });
    }
}

export function setDrawerHeroSubPlot(subPlotData, parentZone) {
    if (!subPlotData) return;
    const targetZone = parentZone || (subPlotData.zoneId && typeof FIELD_COMMODITY_ZONES !== 'undefined' ? FIELD_COMMODITY_ZONES.find(z => z.id === subPlotData.zoneId) : null);
    const color = (targetZone && targetZone.color) ? targetZone.color : '#38bdf8';
    const title = subPlotData.label || subPlotData.name || `Screenhouse ${subPlotData.plotNum}`;

    let primarySrc = subPlotData.image;
    let viewsList = subPlotData.images || [];

    if (!primarySrc && subPlotData.buildingId) {
        primarySrc = `images/${subPlotData.buildingId}.webp`;
    }

    const imgArea = document.getElementById('bp-image-area');

    if (!primarySrc) {
        if (targetZone && targetZone.image) {
            restoreDrawerHeroMaster(targetZone);
        } else {
            if (imgArea) imgArea.style.display = 'none';
            const placeholderEl = document.getElementById('bp-image-placeholder');
            if (placeholderEl) placeholderEl.style.display = 'none';
        }
        return;
    }

    if (imgArea) imgArea.style.display = 'block';

    setDrawerHeroImage({
        src: primarySrc,
        title: title,
        badgeDotColor: color,
        views: viewsList.length > 0 ? viewsList : (primarySrc ? [{ src: primarySrc, label: 'Exterior Front' }] : []),
        activeIdx: 0,
        fallbackIcon: (targetZone && targetZone.icon) ? targetZone.icon : 'building-2'
    });

    // Also update phone gallery container if in mobile mode
    const phoneGallery = document.getElementById('phone-bldg-gallery-container');
    if (phoneGallery && primarySrc) {
        phoneGallery.innerHTML = `
            <div class="phone-bldg-gallery-grid single-photo" onclick="if(window.openPhotoLightbox) window.openPhotoLightbox('${primarySrc}', '${title.replace(/'/g, "\'")}')">
                <div class="pbg-single-slot">
                    <img src="${primarySrc}" alt="${title}">
                    <div class="pbg-badge-pill">${lucideIcon('camera', 12)} 1 Photo</div>
                </div>
            </div>
        `;
    }
}

export function restoreDrawerHeroMaster(parentZone) {
    const zoneId = parentZone ? (parentZone.id || parentZone) : (state.selectedBuildingId || (typeof window !== 'undefined' && window.selectedBuildingId));
    const zone = (typeof FIELD_COMMODITY_ZONES !== 'undefined')
        ? FIELD_COMMODITY_ZONES.find(z => z.id === zoneId)
        : null;

    const imgArea = document.getElementById('bp-image-area');
    const placeholderEl = document.getElementById('bp-image-placeholder');

    if (!zone || !zone.image) {
        if (imgArea) imgArea.style.display = 'none';
        if (placeholderEl) placeholderEl.style.display = 'none';
        return;
    }

    if (imgArea) imgArea.style.display = 'block';

    const masterSrc = zone.image;
    setDrawerHeroImage({
        src: masterSrc,
        title: `${zone.name} (Overview)`,
        badgeDotColor: zone.color || '#06b6d4',
        views: masterSrc ? [{ src: masterSrc, label: 'Compound View' }] : [],
        activeIdx: 0,
        fallbackIcon: zone.icon || 'wheat'
    });

    // Also restore phone gallery container if in mobile mode
    const phoneGallery = document.getElementById('phone-bldg-gallery-container');
    if (phoneGallery && masterSrc) {
        phoneGallery.innerHTML = `
            <div class="phone-bldg-gallery-grid single-photo" onclick="if(window.openPhotoLightbox) window.openPhotoLightbox('${masterSrc}', '${zone.name.replace(/'/g, "\'")}')">
                <div class="pbg-single-slot">
                    <img src="${masterSrc}" alt="${zone.name}">
                    <div class="pbg-badge-pill">${lucideIcon('camera', 12)} 1 Photo</div>
                </div>
            </div>
        `;
    }
}

window.setDrawerHeroSubPlot = setDrawerHeroSubPlot;
window.restoreDrawerHeroMaster = restoreDrawerHeroMaster;
window.setDrawerHeroImage = setDrawerHeroImage;
window.switchHeroView = switchHeroView;
