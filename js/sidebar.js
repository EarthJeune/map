// DA-LARES Sidebar & Directory Module
// Directory list, search filter, sidebar menu toggle/collapse, and setting chips.

import { BUILDING_DIRECTORY } from './data/buildings.js';
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
        const isCurrentlyActive = btn.classList.contains('active');
        const nextState = !isCurrentlyActive;
        btn.classList.toggle('active', nextState);
        const vis = nextState ? 'visible' : 'none';
        try {
            if (map.getLayer('lares-boundary-line')) map.setLayoutProperty('lares-boundary-line', 'visibility', vis);
            if (map.getLayer('lares-boundary-glow')) map.setLayoutProperty('lares-boundary-glow', 'visibility', vis);
            if (map.getLayer('lares-boundary-fill')) map.setLayoutProperty('lares-boundary-fill', 'visibility', vis);
            if (map.getLayer('lares-mask-dimmer')) map.setLayoutProperty('lares-mask-dimmer', 'visibility', vis);
        } catch (e) { }
        safeResetIdle();
        return;
    }
    btn.classList.toggle('active');
    const on = btn.classList.contains('active');
    if (type === 'numbers') {
        document.querySelectorAll('.bldg-badge').forEach(b => {
            b.style.display = on ? 'flex' : 'none';
        });
        document.querySelectorAll('.bldg-tag-pill').forEach(b => {
            b.style.display = on ? 'inline-flex' : 'none';
        });
    }
    safeResetIdle();
}

export function buildDirectory(filter = '') {
    const dir = document.getElementById('directory');
    if (!dir) return;
    const lowerFilter = filter.toLowerCase().trim();

    let html = '';
    BUILDING_DIRECTORY.forEach((b, index) => {
        if (lowerFilter && !b.name.toLowerCase().includes(lowerFilter) && !(b.desc && b.desc.toLowerCase().includes(lowerFilter))) {
            return;
        }

        const num = index + 1; // 1-based numbering matching 3D map pins
        const bColor = b.color || '#3b82f6';
        const isSelected = state.selectedBuildingId === b.id;
        html += `<div class="dir-item ${isSelected ? 'active' : ''}" data-id="${b.id}" onclick="navigateTo('${b.id}')">
            <div class="dir-item-icon" style="background:${bColor}22;color:${bColor}">
                <span class="dir-item-icon-number">${num}</span>
            </div>
            <div class="dir-item-info">
                <div class="dir-item-name">${b.name}</div>
                <div class="dir-item-desc">${b.desc || 'DA-LARES Facility'}</div>
            </div>
            <button class="three-dots-btn" onclick="event.stopPropagation(); openColorPicker('${b.id}', '${b.name.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; font-size:16px; padding:4px 8px;" title="Customize Color">⋮</button>
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
