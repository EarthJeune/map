// DA-LARES Sidebar & Directory Module
// Directory list, search filter, sidebar menu toggle/collapse, and setting chips.

import { BUILDING_DIRECTORY } from './data/buildings.js?v=60';
import { getFlatBuildingOffices, renderBuildingOfficesHTML } from './data/offices.js?v=52';
import { LARES_BOUNDARY } from './data/geo.js';
import { state } from './data/state.js';
import { toggleTrees, toggleBuildings, map } from './map-setup.js';
import { resetIdle } from './idle.js';
import { renderPhoneDirectory, isPhoneMode } from './phone-ui.js';

function safeResetIdle() {
    if (typeof resetIdle === 'function') resetIdle();
    else if (typeof window.resetIdle === 'function') window.resetIdle();
}

function safeRenderPhoneDirectory(filter) {
    if (typeof renderPhoneDirectory === 'function') {
        renderPhoneDirectory(filter);
    } else if (typeof window.renderPhoneDirectory === 'function') {
        window.renderPhoneDirectory(filter);
    }
}

function safeIsPhoneMode() {
    if (typeof isPhoneMode === 'function') return isPhoneMode();
    if (typeof window.isPhoneMode === 'function') return window.isPhoneMode();
    return window.innerWidth <= 768;
}

export function toggleSettingChip(btn, type) {
    if (type === 'trees') {
        toggleTrees(btn);
        return;
    }
    if (type === 'buildings') {
        toggleBuildings(btn);
        return;
    }
    if (type === 'boundary') {
        const targetBtn = btn || document.getElementById('chip-boundary');
        if (targetBtn) targetBtn.classList.toggle('active');
        const on = targetBtn ? targetBtn.classList.contains('active') : true;
        state.boundaryVisible = on;
        const vis = on ? 'visible' : 'none';
        const currentMap = state.map || map || window.map;

        if (currentMap) {
            // Unified grass green boundary layers (Google & Mapbox modes)
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

            // Cleanup any legacy section layers if present
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

        // Section Badges (floating HTML markers)
        if (state.sectionBadges && state.sectionBadges.length > 0) {
            state.sectionBadges.forEach(m => {
                if (m && m.getElement()) m.getElement().style.display = on ? 'inline-flex' : 'none';
            });
        }

        safeResetIdle();
        return;
    }
    if (type === 'numbers') {
        const targetBtn = btn || document.getElementById('chip-numbers');
        if (targetBtn) targetBtn.classList.toggle('active');
        const on = targetBtn ? targetBtn.classList.contains('active') : true;
        state.markersVisible = on;

        if (state.markers && state.markers.length > 0) {
            state.markers.forEach(m => {
                if (m && m.getElement()) {
                    m.getElement().style.display = on ? '' : 'none';
                }
                if (!on && m.getPopup && m.getPopup() && m.getPopup().isOpen()) {
                    m.togglePopup();
                }
            });
        }

        // Direct DOM update as fallback for any building marker element
        document.querySelectorAll('.bldg-map-marker').forEach(el => {
            el.style.display = on ? '' : 'none';
        });

        safeResetIdle();
        return;
    }
    if (type === 'terrain') {
        const targetBtn = btn || document.getElementById('chip-terrain');
        if (targetBtn) targetBtn.classList.toggle('active');
        const on = targetBtn ? targetBtn.classList.contains('active') : true;
        state.terrainEnabled = on;
        const currentMap = state.map || map || window.map;
        if (currentMap) {
            try {
                on ? currentMap.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 }) : currentMap.setTerrain(null);
            } catch (e) { }
        }
        safeResetIdle();
        return;
    }
    safeResetIdle();
}

let currentCategory = 'all';

export function highlightCategoryMarkers(cat) {
    document.querySelectorAll('.bldg-map-marker').forEach(el => {
        const id = el.dataset.id;
        const b = BUILDING_DIRECTORY.find(item => item.id === id);
        if (!b) return;
        if (cat === 'all') {
            el.classList.remove('cat-dimmed', 'cat-highlighted');
        } else if (b.category === cat) {
            el.classList.remove('cat-dimmed');
            el.classList.add('cat-highlighted');
        } else {
            el.classList.add('cat-dimmed');
            el.classList.remove('cat-highlighted');
        }
    });
}

export function filterByCategory(cat) {
    currentCategory = cat || 'all';
    document.querySelectorAll('.cat-chip').forEach(el => {
        el.classList.toggle('active', el.dataset.cat === currentCategory);
    });
    const searchVal = document.getElementById('search-input')?.value || '';
    buildDirectory(searchVal, currentCategory);
    highlightCategoryMarkers(currentCategory);
    safeResetIdle();
}

export function quickSearch(term) {
    const input = document.getElementById('search-input');
    if (input) {
        input.value = term;
        filterDirectory();
        input.focus();
    }
}

export function buildDirectory(filter = '', category = currentCategory) {
    const dir = document.getElementById('directory');
    if (!dir) return;
    const lowerFilter = filter.toLowerCase().trim();

    let html = '';
    const dirList = (typeof window !== 'undefined' && window.BUILDING_DIRECTORY && window.BUILDING_DIRECTORY.length > 0)
        ? window.BUILDING_DIRECTORY
        : BUILDING_DIRECTORY;

    dirList.forEach((b, index) => {
        // Category check
        if (category && category !== 'all' && b.category !== category) {
            return;
        }

        const flatOffices = getFlatBuildingOffices(b.id);
        const matchedOffice = lowerFilter ? flatOffices.find(off => off.toLowerCase().includes(lowerFilter)) : null;
        const matchesNameOrDesc = lowerFilter && (b.name.toLowerCase().includes(lowerFilter) || (b.desc && b.desc.toLowerCase().includes(lowerFilter)));

        if (lowerFilter && !matchesNameOrDesc && !matchedOffice) {
            return;
        }

        const num = index + 1; // 1-based numbering matching 3D map pins
        const bColor = b.color || (state.savedBuildingColors && state.savedBuildingColors[b.id] && state.savedBuildingColors[b.id].icon) || '#3b82f6';
        const isSelected = state.selectedBuildingId === b.id;

        let subText = b.desc || 'DA-LARES Facility';
        if (matchedOffice) {
            subText = `<span class="dir-office-tag" title="${matchedOffice.replace(/"/g, '&quot;')}"><span class="dot-office">🏢</span><span class="office-name-text">${matchedOffice}</span></span>`;
        } else if (flatOffices.length > 0) {
            subText = `<span class="dir-offices-count">${flatOffices.length} offices inside</span>`;
        }

        const adminBtn = state.isAdmin
            ? `<button class="three-dots-btn" onclick="event.stopPropagation(); openColorPicker('${b.id}', '${b.name.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; font-size:16px; padding:4px 8px;" title="Customize Color">⋮</button>`
            : '';

        const officeArg = matchedOffice ? matchedOffice.replace(/'/g, "\\'") : '';
        html += `<div class="dir-item ${isSelected ? 'active' : ''}" data-id="${b.id}" onclick="navigateTo('${b.id}', '${officeArg}')">
            <div class="dir-item-icon" style="background:${bColor}22;color:${bColor}">
                <span class="dir-item-icon-number">${num}</span>
            </div>
            <div class="dir-item-info">
                <div class="dir-item-name">${b.name}</div>
                <div class="dir-item-desc">${subText}</div>
            </div>
            ${adminBtn}
            <div class="dir-item-arrow">→</div>
        </div>`;
    });

    if (!html) {
        html = '<div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">No facilities found matching your search.</div>';
    }

    dir.innerHTML = html;
    safeRenderPhoneDirectory(filter);
}

export function filterDirectory() {
    const val = document.getElementById('search-input')?.value || '';
    buildDirectory(val, currentCategory);
    safeRenderPhoneDirectory(val);

    // If building panel is open, dynamically update highlighted offices in real time
    const panel = document.getElementById('building-panel');
    if (panel && panel.classList.contains('active') && state.selectedBuildingId) {
        const officesContainer = document.getElementById('bp-offices-container');
        if (officesContainer) {
            officesContainer.innerHTML = renderBuildingOfficesHTML(state.selectedBuildingId, val);
        }
    }

    safeResetIdle();
}

export function updateSidebarToggleIcon() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('sidebar-toggle-icon');
    const btn = document.getElementById('sidebar-toggle-btn');
    if (!icon) return;

    const isPortrait = document.body.classList.contains('kiosk-portrait');
    const isCollapsed = sidebar ? sidebar.classList.contains('collapsed') : false;

    if (isPortrait) {
        if (isCollapsed) {
            // Arrow pointing UP to open drawer
            icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
            if (btn) {
                btn.title = 'Open Menu';
                btn.setAttribute('aria-label', 'Open Menu');
            }
        } else {
            // Arrow pointing DOWN to collapse drawer
            icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
            if (btn) {
                btn.title = 'Collapse Menu';
                btn.setAttribute('aria-label', 'Collapse Menu');
            }
        }
    } else {
        if (isCollapsed) {
            // Arrow pointing RIGHT to open sidebar
            icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
            if (btn) {
                btn.title = 'Open Menu';
                btn.setAttribute('aria-label', 'Open Menu');
            }
        } else {
            // Arrow pointing LEFT to close sidebar
            icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto;"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
            if (btn) {
                btn.title = 'Close Menu';
                btn.setAttribute('aria-label', 'Close Menu');
            }
        }
    }
}

export function toggleSidebarMenu() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.classList.toggle('collapsed');
    const isPortrait = document.body.classList.contains('kiosk-portrait');
    const isCollapsed = sidebar.classList.contains('collapsed');
    document.body.classList.toggle('sidebar-collapsed', isCollapsed);

    updateSidebarToggleIcon();
    document.documentElement.style.setProperty('--sidebar-offset', isPortrait ? '0px' : (isCollapsed ? '0px' : '380px'));
}

export function collapseSidebarMenu() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || sidebar.classList.contains('collapsed')) return;
    sidebar.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
    const isPortrait = document.body.classList.contains('kiosk-portrait');
    updateSidebarToggleIcon();
    if (!isPortrait) {
        document.documentElement.style.setProperty('--sidebar-offset', '0px');
    }
}

export function openSidebarMenu() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || !sidebar.classList.contains('collapsed')) return;
    sidebar.classList.remove('collapsed');
    document.body.classList.remove('sidebar-collapsed');
    const isPortrait = document.body.classList.contains('kiosk-portrait');
    updateSidebarToggleIcon();
    if (!isPortrait) {
        document.documentElement.style.setProperty('--sidebar-offset', '380px');
    }
}

export function isNavigationActive() {
    if (safeIsPhoneMode()) {
        const routeSheet = document.getElementById('phone-view-route');
        const isRouteSheetVisible = routeSheet && routeSheet.classList.contains('active');
        if (isRouteSheetVisible && (state.isMobileGPSActive || state.walkAnimFrame)) {
            return true;
        }
        return false;
    }
    if (state.walkAnimFrame || state.isMobileGPSActive) return true;
    return false;
}

window.toggleSettingChip = toggleSettingChip;
window.buildDirectory = buildDirectory;
window.filterDirectory = filterDirectory;
window.filterByCategory = filterByCategory;
window.quickSearch = quickSearch;
window.toggleSidebarMenu = toggleSidebarMenu;
window.collapseSidebarMenu = collapseSidebarMenu;
window.openSidebarMenu = openSidebarMenu;
window.updateSidebarToggleIcon = updateSidebarToggleIcon;
window.isNavigationActive = isNavigationActive;
