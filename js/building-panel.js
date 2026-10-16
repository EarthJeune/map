// DA-LARES Building Info Panel & Color Customization Module
// Building detail drawer, photo gallery trigger, and color picker.

import { DEFAULT_MAP_VIEW } from './data/config.js';
import { BUILDING_DIRECTORY } from './data/buildings.js?v=60';
import { renderBuildingOfficesHTML } from './data/offices.js?v=52';
import { state } from './data/state.js';
import { map, getRoofColorCaseStyle } from './map-setup.js';
import { updateBuildingQR } from './qr.js';
import { stopOrbit, resetIdle } from './idle.js';
import { removeMarkers, createMarkers } from './markers.js';
import { buildDirectory } from './sidebar.js';

export function showBuildingPanel(buildingId, targetOffice = '') {
    state.isIntroAnimating = false;
    const index = BUILDING_DIRECTORY.findIndex(b => b.id === buildingId);
    const building = BUILDING_DIRECTORY[index];
    if (!building) return;

    const num = index + 1;
    const panel = document.getElementById('building-panel');

    // Set number badge
    const numEl = document.getElementById('bp-number');
    numEl.textContent = num;
    numEl.style.background = building.color;

    // Set title
    document.getElementById('bp-title').textContent = building.name;
    document.getElementById('bp-subtitle').textContent = building.desc;

    // Set info
    document.getElementById('bp-section').textContent = building.section || 'Compound';
    document.getElementById('bp-type').textContent = building.type || 'Standalone Facility';
    document.getElementById('bp-coords').textContent =
        building.coords[1].toFixed(5) + '°N, ' + building.coords[0].toFixed(5) + '°E';

    // Render offices & units with highlighted query
    const officesContainer = document.getElementById('bp-offices-container');
    if (officesContainer) {
        const query = targetOffice || state.activeSearchedOffice || document.getElementById('search-input')?.value || '';
        officesContainer.innerHTML = renderBuildingOfficesHTML(buildingId, query);
        const highlightedPill = officesContainer.querySelector('.office-pill.highlighted');
        if (highlightedPill) {
            setTimeout(() => {
                highlightedPill.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 150);
        }
    }

    // Load Image
    const imgEl = document.getElementById('bp-real-image');
    const placeholderEl = document.getElementById('bp-image-placeholder');
    const safeId = buildingId.replace(/\//g, '_');
    const imgPath = `images/${safeId}.jpg`;

    const img = new Image();
    img.onload = function () {
        imgEl.src = imgPath;
        imgEl.style.display = 'block';
        placeholderEl.style.display = 'none';
    };
    img.onerror = function () {
        imgEl.style.display = 'none';
        placeholderEl.style.display = 'flex';
    };
    img.src = imgPath;

    // Update QR code for mobile handoff
    updateBuildingQR(buildingId);

    // Show panel
    panel.classList.add('active');
}

export function closeBuildingPanel() {
    const panel = document.getElementById('building-panel');
    if (panel) panel.classList.remove('active');
    
    // Unhighlight directory items and map markers
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

    // Fly back to default overview angle
    map.flyTo({ 
        center: DEFAULT_MAP_VIEW.center, 
        zoom: DEFAULT_MAP_VIEW.zoom, 
        pitch: DEFAULT_MAP_VIEW.pitch, 
        bearing: DEFAULT_MAP_VIEW.bearing, 
        duration: 2000 
    });

    resetIdle();
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
    // handleUrlParameters called from app.js?v=50
});

// ==========================================

window.showBuildingPanel = showBuildingPanel;
window.closeBuildingPanel = closeBuildingPanel;
window.openColorPicker = openColorPicker;
window.closeColorPicker = closeColorPicker;
window.saveColorPicker = saveColorPicker;
window.syncColorInputs = syncColorInputs;
window.useEyeDropper = useEyeDropper;
