// DA-LARES Sidebar & Directory Module
// Directory list, search filter, sidebar menu toggle/collapse, and setting chips.

import { BUILDING_DIRECTORY, DEFAULT_BUILDING_COLORS, STANDALONE_GATES } from './data/buildings.js';
import { lucideIcon, renderIconOrText } from './data/icons.js';
import { getFlatBuildingOffices, isOfficeMatched, findMatchedOffice, getOfficeSearchSubtitle, isBuildingMatched, getBuildingSearchSubtitle, isPlotZoneMatched, matchesSearchText, renderBuildingOfficesHTML } from './data/offices.js';
import { FIELD_COMMODITY_ZONES } from './data/plots.js';
import { selectPlotZone } from './plot-layers.js';
import { getBuildingWayfindingInfo } from './data/descriptions.js';
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
            const isMapbox = (state.currentMapStyleMode === 'mapbox');
            const shadowVis = (!isMapbox && on) ? 'visible' : 'none';

            // Unified boundary layers (LARES, QARES & RARES)
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

            // Shadow / glow layers (Satellite mode only, hidden in Mapbox mode)
            ['qares-boundary-glow', 'qares-boundary-casing', 'rares-boundary-glow', 'rares-boundary-casing'].forEach(lid => {
                if (currentMap.getLayer(lid)) {
                    try { currentMap.setLayoutProperty(lid, 'visibility', shadowVis); } catch (e) { }
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

        // Sync Map Settings panel checkbox
        const cbBnd = document.getElementById('msp-toggle-boundary');
        if (cbBnd) cbBnd.checked = on;

        safeResetIdle();
        return;
    }
    if (type === 'numbers') {
        const targetBtn = btn || document.getElementById('chip-numbers');
        if (targetBtn) targetBtn.classList.toggle('active');
        const on = targetBtn ? targetBtn.classList.contains('active') : true;
        state.markersVisible = on;

        const markersShouldShow = on;
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

        // Direct DOM update as fallback for any building marker element
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

        // Sync Map Settings panel checkbox
        const cbNum = document.getElementById('msp-toggle-markers');
        if (cbNum) cbNum.checked = on;

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

export function filterByCategory(cat, skipIdleReset = false) {
    currentCategory = cat || 'all';
    document.querySelectorAll('.cat-chip').forEach(el => {
        el.classList.toggle('active', el.dataset.cat === currentCategory);
    });
    const searchVal = document.getElementById('search-input')?.value || '';
    buildDirectory(searchVal, currentCategory);
    highlightCategoryMarkers(currentCategory);
    if (!skipIdleReset) {
        safeResetIdle();
    }
}

// Embedded Conference Halls for direct wayfinding
export const EMBEDDED_CONFERENCE_HALLS = [
    {
        id: 'conf_ored',
        buildingId: 'ored_building',
        name: 'ORED Conference',
        desc: 'Executive Conference Room | ORED Building',
        category: 'conference',
        targetOffice: 'ORED Conference',
        icon: '🏛️'
    },
    {
        id: 'conf_rnd',
        buildingId: 'rnd_building',
        name: 'R&D Conference Hall',
        desc: 'Research Division Conference Hall | R&D Multipurpose Building',
        category: 'conference',
        targetOffice: 'R&D Conference Hall',
        icon: '🏛️'
    }
];

export const activeTypeFilters = new Set();
if (typeof window !== 'undefined') {
    window.activeTypeFilters = activeTypeFilters;
}

export function toggleTypeFilter(typeKey, isChecked) {
    if (isChecked) {
        activeTypeFilters.add(typeKey);
    } else {
        activeTypeFilters.delete(typeKey);
    }
    updateFilterDropdownUI();
    filterDirectory();
    const phoneInputVal = document.getElementById('phone-search-input')?.value || '';
    safeRenderPhoneDirectory(phoneInputVal);
    safeResetIdle();
}

export function resetTypeFilters() {
    activeTypeFilters.clear();
    state.activeSearchedOffice = '';
    document.querySelectorAll('.fdm-checkbox').forEach(cb => {
        cb.checked = false;
    });
    updateFilterDropdownUI();
    filterDirectory();
    const phoneInputVal = document.getElementById('phone-search-input')?.value || '';
    safeRenderPhoneDirectory(phoneInputVal);
    safeResetIdle();
}

export function updateFilterDropdownUI() {
    const count = activeTypeFilters.size;
    // Desktop badge & button
    const badge = document.getElementById('filter-count-badge');
    const btn = document.getElementById('filter-dropdown-btn');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
    if (btn) {
        btn.classList.toggle('has-filters', count > 0);
    }

    // Mobile badge & button
    const phoneBadge = document.getElementById('phone-filter-count-badge');
    const phoneBtn = document.getElementById('phone-filter-btn');
    if (phoneBadge) {
        if (count > 0) {
            phoneBadge.textContent = count;
            phoneBadge.style.display = 'inline-flex';
        } else {
            phoneBadge.style.display = 'none';
        }
    }
    if (phoneBtn) {
        phoneBtn.classList.toggle('has-filters', count > 0);
    }

    // Synchronize both desktop & mobile fdm-item active classes & checkboxes
    document.querySelectorAll('.fdm-item').forEach(item => {
        const type = item.dataset.type;
        item.classList.toggle('active', activeTypeFilters.has(type));
    });
    document.querySelectorAll('.fdm-checkbox').forEach(cb => {
        cb.checked = activeTypeFilters.has(cb.value);
    });
}

export function toggleFilterDropdown(e) {
    if (e) {
        e.stopPropagation();
        if (e.preventDefault) e.preventDefault();
    }
    const wrap = document.getElementById('filter-dropdown-wrap');
    if (!wrap) return;
    const isOpen = wrap.classList.toggle('open');
    const btn = document.getElementById('filter-dropdown-btn');
    if (btn) {
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    safeResetIdle();
}

export function closeFilterDropdown() {
    const wrap = document.getElementById('filter-dropdown-wrap');
    if (wrap && wrap.classList.contains('open')) {
        wrap.classList.remove('open');
        const btn = document.getElementById('filter-dropdown-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }
}

export function clearSearchInput() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    if (input) {
        input.value = '';
        input.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    filterDirectory();
    safeResetIdle();
}

if (typeof window !== 'undefined') {
    window.addEventListener('click', (e) => {
        const wrap = document.getElementById('filter-dropdown-wrap');
        if (wrap && wrap.classList.contains('open') && !wrap.contains(e.target)) {
            closeFilterDropdown();
        }
    });
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
    if (state.currentStationId && state.currentStationId !== 'lares') {
        if (state.currentStationId === 'qares') {
            if (typeof window.renderQARESDirectory === 'function' && window.qaresBuildingsBaseline) {
                window.renderQARESDirectory(window.qaresBuildingsBaseline);
            }
        } else if (state.currentStationId === 'rares') {
            if (typeof window.renderRARESDirectory === 'function') {
                window.renderRARESDirectory();
            }
        }
        return; // Prevent LARES directory from overwriting QARES or RARES stations
    }
    const dir = document.getElementById('directory');
    if (!dir) return;
    const lowerFilter = filter.toLowerCase().trim();

    const dirList = (typeof window !== 'undefined' && window.BUILDING_DIRECTORY && window.BUILDING_DIRECTORY.length > 0)
        ? window.BUILDING_DIRECTORY
        : BUILDING_DIRECTORY;

    const hasTypeFilters = activeTypeFilters.size > 0;

    // 1. Filter Buildings
    let filteredBuildings = [];
    if (!hasTypeFilters || activeTypeFilters.has('office') || activeTypeFilters.has('laboratory') || activeTypeFilters.has('infrastructure') || activeTypeFilters.has('conference') || activeTypeFilters.has('digital_agri')) {
        filteredBuildings = dirList.filter((b) => {
            // Screenhouses are sub-plots of Master Commodity Zones, not standalone buildings
            if (b.isSubPlot || b.id.startsWith('plot17_') || b.id.startsWith('plot18_')) {
                return false;
            }
            // Utility amenities (Water Tank, CR) are omitted from the default unfiltered view (strictly 39 numbered facilities)
            if (!hasTypeFilters && !lowerFilter && (b.hasMarker === false || b.num === null)) {
                return false;
            }
            if (hasTypeFilters && !activeTypeFilters.has(b.category)) {
                return false;
            }
            if (category && category !== 'all' && b.category !== category) return false;
            if (!lowerFilter) return true;
            const matchedOffice = findMatchedOffice(b.id, lowerFilter);
            return isBuildingMatched(b, lowerFilter) || !!matchedOffice;
        });
    }

    // 2. Filter Embedded Conference Halls (ORED Conference, RSBSA Conference Room, R&D Conference Hall)
    let matchedConferenceHalls = [];
    const showConferenceHalls = hasTypeFilters ? activeTypeFilters.has('conference') : !!lowerFilter;
    if (showConferenceHalls) {
        matchedConferenceHalls = EMBEDDED_CONFERENCE_HALLS.filter(c => {
            if (!lowerFilter) return true;
            return matchesSearchText(c.name, lowerFilter) || matchesSearchText(c.desc, lowerFilter) || (c.targetOffice && isOfficeMatched(c.targetOffice, lowerFilter)) || lowerFilter.includes('conf');
        });
    }

    // 3. Filter Plot Zones (Orchards, Trial Sites, Screenhouses)
    let matchedPlots = [];
    const showOrchard = hasTypeFilters ? activeTypeFilters.has('orchard') : false;
    const showTrial = hasTypeFilters ? activeTypeFilters.has('trial_sites') : false;
    const showNursery = hasTypeFilters ? activeTypeFilters.has('infrastructure') : false;

    if (showOrchard || showTrial || showNursery || lowerFilter) {
        matchedPlots = FIELD_COMMODITY_ZONES.filter(z => {
            const zCat = z.category; // 'orchard', 'crop', 'nursery'
            if (hasTypeFilters) {
                let catMatches = false;
                if (showOrchard && zCat === 'orchard') catMatches = true;
                if (showTrial && zCat === 'crop') catMatches = true;
                if (showNursery && zCat === 'nursery') catMatches = true;
                if (!catMatches) return false;
            }
            if (!lowerFilter) {
                // When type filter is active with no search text, return all matched zones
                return hasTypeFilters;
            }
            // If user typed a search text:
            return isPlotZoneMatched(z, lowerFilter);
        });
    }

    // 4. Filter Standalone Compound Gates
    let matchedGates = [];
    if (lowerFilter && (!hasTypeFilters || activeTypeFilters.has('infrastructure'))) {
        const gatesList = (typeof window !== 'undefined' && window.STANDALONE_GATES)
            ? Object.values(window.STANDALONE_GATES)
            : (typeof STANDALONE_GATES !== 'undefined' ? Object.values(STANDALONE_GATES) : []);
        matchedGates = gatesList.filter(g => {
            return g.name.toLowerCase().includes(lowerFilter) ||
                (g.desc && g.desc.toLowerCase().includes(lowerFilter)) ||
                lowerFilter.includes('gate') ||
                (lowerFilter.includes('entrance') && g.id.includes('entrance')) ||
                (lowerFilter.includes('exit') && g.id.includes('exit'));
        });
    }

    const totalCount = filteredBuildings.length + matchedConferenceHalls.length + matchedPlots.length + matchedGates.length;

    let headerLabel = 'LARES BUILDINGS';
    if (hasTypeFilters && lowerFilter) {
        headerLabel = `FILTERED SEARCH (${totalCount})`;
    } else if (hasTypeFilters) {
        headerLabel = `FILTERED FACILITIES (${totalCount})`;
    } else if (lowerFilter) {
        headerLabel = `LARES SEARCH (${totalCount})`;
    } else {
        headerLabel = `LARES BUILDINGS (${totalCount})`;
    }

    let html = `<div style="padding: 12px 16px 8px; font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; display:flex; justify-content:space-between; align-items:center;">
        <span>${headerLabel}</span>
        <span style="font-size:10px; color:#38bdf8; font-weight:600;">Lipa City, Batangas</span>
    </div>`;

    if (totalCount === 0) {
        html += '<div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">No facilities or plots found matching your criteria.</div>';
    } else {
        // Render Buildings
        filteredBuildings.forEach((b) => {
            const hasNum = b.num !== null && b.num !== undefined;
            const badgeContent = hasNum ? b.num : renderIconOrText(b.icon || 'building-2', 16);
            const badgeClass = hasNum ? 'dir-item-icon-number' : 'dir-item-icon-emoji';

            const matchedOffice = lowerFilter ? findMatchedOffice(b.id, lowerFilter) : null;

            const bColor = (state.savedBuildingColors && state.savedBuildingColors[b.id] && state.savedBuildingColors[b.id].icon) || b.color || (DEFAULT_BUILDING_COLORS[b.id] && DEFAULT_BUILDING_COLORS[b.id].icon) || '#3b82f6';
            const isSelected = state.selectedBuildingId === b.id;

            const wfInfo = getBuildingWayfindingInfo(b.id, b.desc);
            let subText = wfInfo.compactTag || b.desc || 'DA-LARES Facility';
            if (b.id === 'plot22_water_tank' || b.id === 'plot22_comfort_room') {
                subText = `<span class="dir-plot-tag">Plot 22</span> ${wfInfo.compactTag || b.desc || 'Facility'}`;
            }
            if (matchedOffice) {
                const matchedLabel = getOfficeSearchSubtitle(matchedOffice, lowerFilter);
                subText = `<span class="dir-office-tag" title="${matchedLabel.replace(/"/g, '&quot;')}"><span class="dot-office">${lucideIcon('building-2', 12)}</span><span class="office-name-text">${matchedLabel}</span></span>`;
            } else if (lowerFilter) {
                const bldgAliasSub = getBuildingSearchSubtitle(b, lowerFilter);
                if (bldgAliasSub) {
                    subText = `<span class="dir-office-tag" title="${bldgAliasSub.replace(/"/g, '&quot;')}"><span class="dot-office">${lucideIcon('landmark', 12)}</span><span class="office-name-text">${bldgAliasSub}</span></span>`;
                }
            }

            const adminBtn = state.isAdmin
                ? `<button class="three-dots-btn" onclick="event.stopPropagation(); openColorPicker('${b.id}', '${b.name.replace(/'/g, "\\'")}')" style="background:none; border:none; cursor:pointer; font-size:16px; padding:4px 8px;" title="Customize Color">⋮</button>`
                : '';

            const officeArg = matchedOffice ? matchedOffice.replace(/'/g, "\\'") : '';
            html += `<div class="dir-item ${isSelected ? 'active' : ''}" data-id="${b.id}" onclick="navigateTo('${b.id}', '${officeArg}')">
                <div class="dir-item-icon" style="background:${bColor}22;color:${bColor}">
                    <span class="${badgeClass}">${badgeContent}</span>
                </div>
                <div class="dir-item-info">
                    <div class="dir-item-name">${b.name}</div>
                    <div class="dir-item-desc">${subText}</div>
                </div>
                ${adminBtn}
                <div class="dir-item-arrow">→</div>
            </div>`;
        });

        // Render Embedded Conference Halls
        matchedConferenceHalls.forEach((item) => {
            const isConfSelected = (state.selectedBuildingId === item.buildingId && state.activeSearchedOffice === item.targetOffice);
            html += `<div class="dir-item ${isConfSelected ? 'active' : ''}" data-id="${item.buildingId}" onclick="navigateTo('${item.buildingId}', '${item.targetOffice.replace(/'/g, "\\'")}')">
                <div class="dir-item-icon" style="background:rgba(139, 92, 246, 0.2); color:#a78bfa;">
                    <span class="dir-item-icon-emoji">${lucideIcon('landmark', 16)}</span>
                </div>
                <div class="dir-item-info">
                    <div class="dir-item-name">${item.name}</div>
                    <div class="dir-item-desc"><span class="dir-conf-tag">Conference Hall</span> ${item.desc}</div>
                </div>
                <div class="dir-item-arrow">→</div>
            </div>`;
        });

        // Render Standalone Compound Gates
        matchedGates.forEach((gate) => {
            const isGateSelected = (state.selectedBuildingId === gate.id);
            html += `<div class="dir-item ${isGateSelected ? 'active' : ''}" data-id="${gate.id}" onclick="selectStandaloneGate('${gate.id}')">
                <div class="dir-item-icon" style="background:${gate.color}22; color:${gate.color}; border: 1px solid ${gate.color}66;">
                    <span class="dir-item-icon-emoji">${renderIconOrText(gate.icon || 'door-open', 16)}</span>
                </div>
                <div class="dir-item-info">
                    <div class="dir-item-name">${gate.name}</div>
                    <div class="dir-item-desc"><span class="dir-plot-tag" style="background:${gate.color}22; color:${gate.color};">GATE</span> ${gate.desc}</div>
                </div>
                <div class="dir-item-arrow">→</div>
            </div>`;
        });

        // Render Plot Zones (Orchards / Trial Sites / Screenhouses)
        matchedPlots.forEach((zone) => {
            const isPlotSelected = (state.selectedPlotZoneId === zone.id || (typeof window !== 'undefined' && window.selectedPlotZoneId === zone.id));
            const zoneColor = zone.color || '#10b981';
            const tagLabel = zone.category === 'orchard' ? 'Orchard' : (zone.category === 'crop' ? 'Trial Site' : 'Facility');
            html += `<div class="dir-item ${isPlotSelected ? 'active' : ''}" data-plot-id="${zone.id}" onclick="selectPlotZone('${zone.id}')">
                <div class="dir-item-icon" style="background:${zoneColor}22; color:${zoneColor};">
                    <span class="dir-item-icon-emoji">${zone.id === 'zone_mango_banana_jackfruit' ? lucideIcon('trees', 16) : renderIconOrText(zone.icon || 'sprout', 16)}</span>
                </div>
                <div class="dir-item-info">
                    <div class="dir-item-name">${zone.name}</div>
                    <div class="dir-item-desc"><span class="dir-plot-tag">${zone.plotRange ? zone.plotRange : tagLabel}</span> ${zone.description || ''}</div>
                </div>
                <div class="dir-item-arrow">→</div>
            </div>`;
        });
    }

    dir.innerHTML = html;
    safeRenderPhoneDirectory(filter);
}

export function filterDirectory() {
    const input = document.getElementById('search-input');
    const val = input ? input.value : '';
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) {
        clearBtn.style.display = val.trim() ? 'flex' : 'none';
    }
    if (state.currentStationId === 'qares') {
        if (typeof window.filterQARESSearch === 'function') {
            window.filterQARESSearch(val);
        }
        safeResetIdle();
        return;
    }
    if (state.currentStationId === 'rares') {
        if (typeof window.filterRARESSearch === 'function') {
            window.filterRARESSearch(val);
        }
        safeResetIdle();
        return;
    }
    buildDirectory(val, currentCategory);
    safeRenderPhoneDirectory(val);

    // If building panel is open, dynamically update highlighted offices in real time
    const panel = document.getElementById('building-panel');
    const currentBldgId = state.selectedBuildingId || window.selectedBuildingId || (panel ? panel.dataset.buildingId : null);
    if (panel && panel.classList.contains('active') && currentBldgId) {
        const officesContainer = document.getElementById('bp-offices-container');
        if (officesContainer) {
            officesContainer.innerHTML = renderBuildingOfficesHTML(currentBldgId, val);
            const highlightedPill = officesContainer.querySelector('.office-pill.highlighted');
            if (highlightedPill) {
                setTimeout(() => {
                    highlightedPill.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 120);
            }
        }
    }

    // Support mobile phone building panel offices container
    const phoneOfficesContainer = document.getElementById('phone-bldg-offices-container');
    if (phoneOfficesContainer && currentBldgId) {
        phoneOfficesContainer.innerHTML = renderBuildingOfficesHTML(currentBldgId, val);
        const highlightedPill = phoneOfficesContainer.querySelector('.office-pill.highlighted');
        if (highlightedPill) {
            setTimeout(() => {
                highlightedPill.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 120);
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
window.toggleTypeFilter = toggleTypeFilter;
window.resetTypeFilters = resetTypeFilters;
window.toggleFilterDropdown = toggleFilterDropdown;
window.closeFilterDropdown = closeFilterDropdown;
window.clearSearchInput = clearSearchInput;
