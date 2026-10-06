// DA-LARES Sidebar & Directory Module
// Directory list, search filter, sidebar menu toggle/collapse, and setting chips.

import { BUILDING_DIRECTORY } from './data/buildings.js';
import { getFlatBuildingOffices } from './data/offices.js';
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
            // Google mode section layers & Mapbox dividing lines
            LARES_BOUNDARY.features.forEach(f => {
                const fid = f.properties.fid;
                ['sec-glow-', 'sec-fill-', 'sec-line-'].forEach(p => {
                    const lid = `${p}${fid}`;
                    if (currentMap.getLayer(lid)) {
                        try { currentMap.setLayoutProperty(lid, 'visibility', vis); } catch (e) { }
                    }
                });
            });

            // Mapbox compound border outline
            ['lares-compound-border-casing', 'lares-compound-border-line'].forEach(id => {
                if (currentMap.getLayer(id)) {
                    try { currentMap.setLayoutProperty(id, 'visibility', vis); } catch (e) { }
                }
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

export function buildDirectory(filter = '') {
    const dir = document.getElementById('directory');
    if (!dir) return;
    const lowerFilter = filter.toLowerCase().trim();

    let html = '';
    BUILDING_DIRECTORY.forEach((b, index) => {
        const flatOffices = getFlatBuildingOffices(b.id);
        const matchedOffice = lowerFilter ? flatOffices.find(off => off.toLowerCase().includes(lowerFilter)) : null;
        const matchesNameOrDesc = lowerFilter && (b.name.toLowerCase().includes(lowerFilter) || (b.desc && b.desc.toLowerCase().includes(lowerFilter)));

        if (lowerFilter && !matchesNameOrDesc && !matchedOffice) {
            return;
        }

        const num = index + 1; // 1-based numbering matching 3D map pins
        const bColor = b.color || '#3b82f6';
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

        html += `<div class="dir-item ${isSelected ? 'active' : ''}" data-id="${b.id}" onclick="navigateTo('${b.id}')">
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
    buildDirectory(val);
    safeRenderPhoneDirectory(val);
    safeResetIdle();
}

export function toggleSidebarMenu() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('sidebar-toggle-icon');
    const btn = document.getElementById('sidebar-toggle-btn');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.toggle('collapsed');
    if (icon) {
        icon.textContent = isCollapsed ? '>' : '<';
    }
    if (btn) {
        const label = isCollapsed ? 'Open menu' : 'Close menu';
        btn.title = label;
        btn.setAttribute('aria-label', label);
    }
    const isPortrait = document.body.classList.contains('kiosk-portrait');
    document.documentElement.style.setProperty('--sidebar-offset', isPortrait ? '0px' : (isCollapsed ? '0px' : '380px'));
}

export function collapseSidebarMenu() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('sidebar-toggle-icon');
    const btn = document.getElementById('sidebar-toggle-btn');
    if (!sidebar || sidebar.classList.contains('collapsed')) return;
    sidebar.classList.add('collapsed');
    if (icon) icon.textContent = '>';
    if (btn) {
        btn.title = 'Open menu';
        btn.setAttribute('aria-label', 'Open menu');
    }
    if (!document.body.classList.contains('kiosk-portrait')) {
        document.documentElement.style.setProperty('--sidebar-offset', '0px');
    }
}

export function openSidebarMenu() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('sidebar-toggle-icon');
    const btn = document.getElementById('sidebar-toggle-btn');
    if (!sidebar || !sidebar.classList.contains('collapsed')) return;
    sidebar.classList.remove('collapsed');
    if (icon) icon.textContent = '<';
    if (btn) {
        btn.title = 'Close menu';
        btn.setAttribute('aria-label', 'Close menu');
    }
    if (!document.body.classList.contains('kiosk-portrait')) {
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
window.toggleSidebarMenu = toggleSidebarMenu;
window.collapseSidebarMenu = collapseSidebarMenu;
window.openSidebarMenu = openSidebarMenu;
window.isNavigationActive = isNavigationActive;
