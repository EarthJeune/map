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

    let html = '';
    let currentSection = '';

    const sorted = [...BUILDING_DIRECTORY].sort((a, b) => {
        if (a.section !== b.section) return (a.section || '').localeCompare(b.section || '');
        return a.name.localeCompare(b.name);
    });

    const q = filter.toLowerCase().trim();
    const filtered = q
        ? sorted.filter(b => b.name.toLowerCase().includes(q) || (b.desc && b.desc.toLowerCase().includes(q)))
        : sorted;

    filtered.forEach(b => {
        if (b.section !== currentSection && !q) {
            currentSection = b.section;
            html += `<div class="dir-section-header">${currentSection}</div>`;
        }
        const bldgIndex = BUILDING_DIRECTORY.findIndex(item => item.id === b.id) + 1;
        html += `
            <div class="dir-item" data-id="${b.id}" onclick="navigateTo('${b.id}')">
                <div class="dir-num" style="background: ${b.color || '#3b82f6'}">${bldgIndex}</div>
                <div class="dir-info">
                    <div class="dir-name">${b.name}</div>
                    <div class="dir-desc">${b.desc || ''}</div>
                </div>
            </div>
        `;
    });

    if (filtered.length === 0) {
        html = '<div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">No facilities found matching your search.</div>';
    }

    dir.innerHTML = html;
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
