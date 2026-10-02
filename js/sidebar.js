// DA-LARES Sidebar & Directory Module
// Directory list, search filter, sidebar menu toggle/collapse, and setting chips.

import { BUILDING_DIRECTORY } from './data/buildings.js?v=5';
import { LARES_BOUNDARY } from './data/geo.js?v=5';
import { state } from './data/state.js?v=5';
import { toggleTrees, toggleBuildings, map } from './map-setup.js?v=5';

function safeResetIdle() {
    if (typeof window.resetIdle === 'function') window.resetIdle();
    else if (typeof resetIdle === 'function') resetIdle();
}

function safeRenderPhoneDirectory(filter) {
    if (typeof window.renderPhoneDirectory === 'function') {
        window.renderPhoneDirectory(filter);
    }
}

function safeIsPhoneMode() {
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
    btn.classList.toggle('active');
    const on = btn.classList.contains('active');
    if (type === 'boundary') {
        const vis = on ? 'visible' : 'none';
        LARES_BOUNDARY.features.forEach(f => {
            const fid = f.properties.fid;
            ['sec-glow-', 'sec-fill-', 'sec-line-'].forEach(p => {
                const lid = `${p}${fid}`;
                if (map.getLayer(lid)) {
                    try { map.setLayoutProperty(lid, 'visibility', vis); } catch (e) { }
                }
            });
        });
        ['lares-compound-border-casing', 'lares-compound-border-line'].forEach(id => {
            if (map.getLayer(id)) {
                try { map.setLayoutProperty(id, 'visibility', vis); } catch (e) { }
            }
        });
        if (map.getLayer('sec-labels-layer')) {
            try { map.setLayoutProperty('sec-labels-layer', 'visibility', vis); } catch (e) { }
        }
        if (state.sectionBadges) {
            state.sectionBadges.forEach(m => {
                if (m && m.getElement()) m.getElement().style.display = on ? 'inline-flex' : 'none';
            });
        }
    } else if (type === 'terrain') {
        state.terrainEnabled = on;
        on ? map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 }) : map.setTerrain(null);
    } else if (type === 'numbers') {
        state.markersVisible = on;
        if (state.markers) {
            state.markers.forEach(m => {
                m.getElement().style.display = on ? 'flex' : 'none';
                if (!on && m.getPopup() && m.getPopup().isOpen()) m.togglePopup();
            });
        }
    }
    safeResetIdle();
}

export function buildDirectory(filter = '') {
    const dir = document.getElementById('directory');
    if (!dir) return;
    const lowerFilter = filter.toLowerCase();

    let html = '';
    BUILDING_DIRECTORY.forEach((b, index) => {
        if (lowerFilter && !b.name.toLowerCase().includes(lowerFilter) && !b.desc.toLowerCase().includes(lowerFilter)) return;

        const num = index + 1; // 1-based numbering
        const bColor = b.color;
        html += `<div class="dir-item" data-id="${b.id}" onclick="navigateTo('${b.id}')">
            <div class="dir-item-icon" style="background:${bColor}22;color:${bColor}">
                <span class="dir-item-icon-number">${num}</span>
            </div>
            <div class="dir-item-info">
                <div class="dir-item-name">${b.name}</div>
                <div class="dir-item-desc">${b.desc}</div>
            </div>
            <button class="three-dots-btn" onclick="event.stopPropagation(); openColorPicker('${b.id}', '${b.name}')" style="background:none; border:none; cursor:pointer; font-size:16px; padding:4px 8px;">⋮</button>
            <div class="dir-item-arrow">→</div>
        </div>`;
    });

    if (!html) html = '<div style="text-align:center;color:#475569;padding:40px 0;font-size:13px;">No results found</div>';
    dir.innerHTML = html;
    safeRenderPhoneDirectory(filter);
}

export function filterDirectory() {
    const input = document.getElementById('search-input');
    const val = input ? input.value : '';
    buildDirectory(val);
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
    document.documentElement.style.setProperty('--sidebar-offset', isCollapsed ? '0px' : '380px');
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
    document.documentElement.style.setProperty('--sidebar-offset', '0px');
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
    document.documentElement.style.setProperty('--sidebar-offset', '380px');
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
