// DA-CALABARZON Multi-Station Wayfinding Manager
// Manages station selection, lag-free regional camera flyovers, and station data hydration.

import { STATIONS, DEFAULT_STATION_ID, DEFAULT_FILTER_TYPES, getActiveStationDefaultView, getStationIntroViews } from './data/stations.js';
import { state } from './data/state.js';
import { map, stopIntroAnimation, playIntroAnimation, setupMapboxStandardLayers, setup3DBuildingModelsLayer, setupStation3DModels, safeMoveLayer } from './map-setup.js';
import { INTRO_START_VIEW } from './data/config.js';
import { buildDirectory } from './sidebar.js';
import { removeMarkers, createMarkers, createEntranceArrowMarker, removeSectionBadges } from './markers.js';
import { createKioskMarker, stopIdleRotation, resetIdle } from './idle.js';
import { buildRoadGraph } from './routing.js';
import { QARES_MASK, RARES_MASK } from './data/geo.js';
import { lucideIcon } from './data/icons.js';

let activeFlyNotificationTimer = null;
let activeStationSwitchTimer = null;
let activeCurtainDismissTimer = null;
let activeStationSwitchSafetyTimer = null;
let stationDropdownListenerBound = false;

export function initStationSelector() {
    const activeStationId = state.currentStationId || DEFAULT_STATION_ID;
    updateStationUI(activeStationId);
    renderStationCategoryBar(activeStationId);

    // Click-outside listener to close dropdown (guarded so it only binds once)
    if (!stationDropdownListenerBound && typeof document !== 'undefined') {
        stationDropdownListenerBound = true;
        document.addEventListener('click', (e) => {
            const flyout = document.getElementById('station-dropdown-flyout');
            const btn = document.getElementById('station-dropdown-btn');
            if (flyout && flyout.classList.contains('active')) {
                if (!flyout.contains(e.target) && (!btn || !btn.contains(e.target))) {
                    closeStationDropdown();
                }
            }
        });
    }

    // Ensure bounds are not clamped on startup until intro sequence completes
    if (map) {
        try { map.setMaxBounds(null); } catch (e) { }
    }
}

export function toggleStationDropdown(event) {
    if (event) event.stopPropagation();
    const flyout = document.getElementById('station-dropdown-flyout');
    if (flyout) {
        flyout.classList.toggle('active');
    }
}

export function closeStationDropdown() {
    const flyout = document.getElementById('station-dropdown-flyout');
    if (flyout) {
        flyout.classList.remove('active');
    }
}

const STATION_ICON_MAP = {
    lares: 'wheat',
    qares: 'sprout',
    rares: 'trees',
    cares: 'leaf'
};

const FILTER_ICON_MAP = {
    infrastructure: 'hard-hat',
    trial_sites: 'wheat',
    orchard: 'trees',
    office: 'building-2',
    laboratory: 'flask-conical',
    conference: 'landmark',
    digital_agri: 'radio'
};

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderDynamicStationContainers(activeStationId) {
    const stationList = Object.values(STATIONS);

    // 1. Top-left station dropdown list
    const dropdownList = document.getElementById('station-dropdown-list');
    if (dropdownList) {
        dropdownList.innerHTML = stationList.map(st => {
            const isActive = st.id === activeStationId;
            const isDev = st.status === 'under_development';
            const badgeClass = isActive ? 'active-badge' : (isDev ? 'dev-badge' : '');
            const badgeText = isActive ? 'Active' : (isDev ? 'Under Dev' : 'Select');
            return `
                <div class="station-dropdown-item${isActive ? ' active' : ''}" data-station="${escapeHtml(st.id)}" onclick="switchResearchStation('${escapeHtml(st.id)}')">
                    <div class="station-item-icon">${lucideIcon(STATION_ICON_MAP[st.id] || 'map-pin', 16)}</div>
                    <div class="station-item-info">
                        <div class="station-item-title">${escapeHtml(st.name)}</div>
                        <div class="station-item-sub">${escapeHtml(st.province)}</div>
                    </div>
                    <span class="station-item-status ${badgeClass}">${badgeText}</span>
                </div>`;
        }).join('');
    }

    // 2. Welcome modal 4-station grid
    const welcomeGrid = document.getElementById('dash-welcome-stations-grid');
    if (welcomeGrid) {
        welcomeGrid.innerHTML = stationList.map(st => {
            const isActive = st.id === activeStationId;
            const isLive = st.status === 'active';
            const tags = Array.isArray(st.welcomeTags) ? st.welcomeTags.slice(0, 3) : [];
            const badgeHtml = isLive
                ? `<span class="dash-wsc-badge active"><span class="dash-pulse-dot"></span> Active Flagship</span>`
                : `<span class="dash-wsc-badge dev">Under Development</span>`;
            const ctaText = isLive ? 'Enter Campus' : 'Preview Station';
            return `
                <div class="dash-welcome-station-card${isActive ? ' active' : ''}" data-station="${escapeHtml(st.id)}" onclick="selectWelcomeStation('${escapeHtml(st.id)}')" title="Select ${escapeHtml(st.name)} Station">
                    <div class="dash-wsc-top">
                        <div class="dash-wsc-icon-wrap ${escapeHtml(st.id)}">
                            ${lucideIcon(STATION_ICON_MAP[st.id] || 'map-pin', 22)}
                        </div>
                        <div class="dash-wsc-meta">
                            <div class="dash-wsc-code-row">
                                <span class="dash-wsc-code">${escapeHtml(st.name)}</span>
                                ${badgeHtml}
                            </div>
                            <div class="dash-wsc-province">${escapeHtml(st.province)}</div>
                        </div>
                    </div>
                    <div class="dash-wsc-fullname">${escapeHtml(st.fullName || st.sub)}</div>
                    <div class="dash-wsc-tags">
                        ${tags.map(t => `<span class="dash-wsc-tag">${escapeHtml(t)}</span>`).join('')}
                    </div>
                    <div class="dash-wsc-cta">
                        <span>${ctaText}</span>
                        ${lucideIcon('arrow-right', 16)}
                    </div>
                </div>`;
        }).join('');
    }

    // 3. Mobile station switcher modal list
    const phoneList = document.getElementById('phone-station-list');
    if (phoneList) {
        phoneList.innerHTML = stationList.map(st => {
            const isActive = st.id === activeStationId;
            const isDev = st.status === 'under_development';
            const statusClass = isActive ? 'active' : (isDev ? 'dev-badge' : '');
            const statusText = isActive ? 'Active' : (isDev ? 'Under Dev' : 'Select');
            const suffix = st.status === 'active' ? 'Main Campus' : 'Under Development';
            return `
                <div class="phone-station-card${isActive ? ' active' : ''}" data-station="${escapeHtml(st.id)}" onclick="handlePhoneSelectStation('${escapeHtml(st.id)}')">
                    <div class="psc-icon-wrap">
                        <span class="psc-icon">${lucideIcon(STATION_ICON_MAP[st.id] || 'map-pin', 16)}</span>
                    </div>
                    <div class="psc-info">
                        <div class="psc-title-row">
                            <span class="psc-title">${escapeHtml(st.name)}</span>
                            <span class="psc-province">${escapeHtml(st.province)}</span>
                        </div>
                        <div class="psc-desc">${escapeHtml(st.fullName || st.sub)} • ${suffix}</div>
                    </div>
                    <span class="psc-status ${statusClass}">${statusText}</span>
                </div>`;
        }).join('');
    }

    // 4. Filter by type dropdown options (station-aware descriptions, preserving checked state)
    const fdmOptions = document.getElementById('fdm-options');
    if (fdmOptions) {
        const prevChecked = new Set(
            Array.from(fdmOptions.querySelectorAll('.fdm-checkbox:checked')).map(cb => cb.value)
        );
        const activeSt = STATIONS[activeStationId] || STATIONS.lares;
        const customDescs = (activeSt && activeSt.filterDescriptions) || {};
        fdmOptions.innerHTML = DEFAULT_FILTER_TYPES.map(ft => {
            const desc = customDescs[ft.id] || ft.defaultDesc;
            const checkedAttr = prevChecked.has(ft.id) ? ' checked' : '';
            return `
                <label class="fdm-item" data-type="${escapeHtml(ft.id)}">
                    <input type="checkbox" class="fdm-checkbox" value="${escapeHtml(ft.id)}"${checkedAttr} onchange="toggleTypeFilter('${escapeHtml(ft.id)}', this.checked)">
                    <span class="fdm-item-icon">${lucideIcon(FILTER_ICON_MAP[ft.id] || 'filter', 16)}</span>
                    <div class="fdm-item-text">
                        <span class="fdm-item-name">${escapeHtml(ft.name)}</span>
                        <span class="fdm-item-desc">${escapeHtml(desc)}</span>
                    </div>
                </label>`;
        }).join('');
    }

    // 5. Quick search suggestion tags
    const quickTagsEl = document.getElementById('kiosk-quick-tags');
    if (quickTagsEl) {
        const activeSt = STATIONS[activeStationId] || STATIONS.lares;
        const tags = Array.isArray(activeSt?.quickTags) ? activeSt.quickTags : [];
        if (tags.length > 0) {
            quickTagsEl.innerHTML = `<span class="quick-tag-label">Popular:</span>` + tags.map(t => {
                const label = typeof t === 'object' ? (t.label || t.query || '') : String(t);
                const query = typeof t === 'object' ? (t.query || t.label || '') : String(t);
                return `<button class="quick-tag" onclick="quickSearch('${escapeHtml(query).replace(/'/g, "\\'")}')">${escapeHtml(label)}</button>`;
            }).join('');
            quickTagsEl.style.display = 'flex';
        } else {
            quickTagsEl.innerHTML = '';
            quickTagsEl.style.display = 'none';
        }
    }
}

function updateStationUI(stationId) {
    renderDynamicStationContainers(stationId);
    const st = STATIONS[stationId] || STATIONS.lares;
    const labelEl = document.getElementById('station-current-label');
    const subEl = document.getElementById('station-subtitle');
    if (labelEl) labelEl.textContent = st.label;
    if (subEl) subEl.textContent = st.sub;

    // Update active highlight on dropdown items
    document.querySelectorAll('.station-dropdown-item').forEach(item => {
        const sId = item.dataset.station;
        const targetSt = STATIONS[sId];
        const isActive = sId === stationId;
        const isDev = targetSt && targetSt.status === 'under_development';
        item.classList.toggle('active', isActive);
        const subItemEl = item.querySelector('.station-item-sub');
        if (subItemEl && targetSt && targetSt.province) {
            subItemEl.textContent = targetSt.province;
        }
        const statusEl = item.querySelector('.station-item-status');
        if (statusEl) {
            if (isActive) {
                statusEl.textContent = 'Active';
                statusEl.className = 'station-item-status active-badge';
            } else if (isDev) {
                statusEl.textContent = 'Under Dev';
                statusEl.className = 'station-item-status dev-badge';
            } else {
                statusEl.textContent = 'Select';
                statusEl.className = 'station-item-status';
            }
        }
    });

    // Update Phone UI station indicator and modal cards
    const phonePillName = document.getElementById('phone-station-pill-name');
    const phoneBannerName = document.getElementById('phone-station-banner-name');
    if (phonePillName) phonePillName.textContent = st.name || st.label;
    if (phoneBannerName) phoneBannerName.textContent = st.label;

    document.querySelectorAll('.phone-station-card').forEach(card => {
        const sId = card.dataset.station;
        const targetSt = STATIONS[sId];
        const isActive = sId === stationId;
        const isDev = targetSt && targetSt.status === 'under_development';
        card.classList.toggle('active', isActive);
        const subCardEl = card.querySelector('.psc-sub');
        if (subCardEl && targetSt && targetSt.province) {
            subCardEl.textContent = targetSt.province;
        }
        const statusEl = card.querySelector('.psc-status');
        if (statusEl) {
            if (isActive) {
                statusEl.textContent = 'Active';
                statusEl.className = 'psc-status active';
            } else if (isDev) {
                statusEl.textContent = 'Under Dev';
                statusEl.className = 'psc-status dev-badge';
            } else {
                statusEl.textContent = 'Select';
                statusEl.className = 'psc-status';
            }
        }
    });

    // Update Welcome Modal active card highlight & button text if rendered
    if (typeof window.updateWelcomeModalActiveStation === 'function') {
        window.updateWelcomeModalActiveStation();
    }
}

function showStationFlyNotification(text) {
    let notif = document.getElementById('station-fly-toast');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'station-fly-toast';
        notif.className = 'station-fly-toast';
        document.body.appendChild(notif);
    }
    notif.innerHTML = `<span>${lucideIcon('drone', 16)}</span> <span>${text}</span>`;
    notif.classList.add('active');

    if (activeFlyNotificationTimer) clearTimeout(activeFlyNotificationTimer);
    activeFlyNotificationTimer = setTimeout(() => {
        notif.classList.remove('active');
    }, 3500);
}

// Check if application is running in deployed production mode vs local development.
// When deployed (or with ?deployed=1), unfinished stations are protected with the Under Development modal.
// In local development (localhost / 127.0.0.1 / ?dev=1), developers have full unrestricted switching to QARES.
export function isDeployedMode() {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('deployed') === '1') return true;
    if (urlParams.get('dev') === '1') return false;
    if (window.IS_DEPLOYED !== undefined) return Boolean(window.IS_DEPLOYED);
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '' || host.startsWith('192.168.') || host.endsWith('.local');
    return !isLocal;
}

export function switchResearchStation(stationId, forceBypass = false) {
    closeStationDropdown();

    if (!STATIONS[stationId]) return;
    if (state.currentStationId === stationId) return;

    const targetStation = STATIONS[stationId];
    // Respect MySQL station status ('under_development' vs 'active'/'live') controlled in /admin.
    // Only authenticated Admins (state.isAdmin) or explicit ?dev=1 bypass the Under Development modal.
    const urlParams = (typeof window !== 'undefined') ? new URLSearchParams(window.location.search) : null;
    const isDevOverride = Boolean(state.isAdmin || (urlParams && urlParams.get('dev') === '1'));
    if (targetStation && targetStation.status === 'under_development' && !forceBypass && !isDevOverride) {
        showStationDevModal(stationId);
        return;
    }

    performStationSwitch(stationId);
}

export function performStationSwitch(stationId) {
    // 1. Immediately invalidate and cancel any in-flight switch timers, animations, or rotations
    if (activeStationSwitchTimer) {
        clearTimeout(activeStationSwitchTimer);
        activeStationSwitchTimer = null;
    }
    if (activeCurtainDismissTimer) {
        clearTimeout(activeCurtainDismissTimer);
        activeCurtainDismissTimer = null;
    }
    if (activeStationSwitchSafetyTimer) {
        clearTimeout(activeStationSwitchSafetyTimer);
        activeStationSwitchSafetyTimer = null;
    }

    if (typeof stopIntroAnimation === 'function') {
        stopIntroAnimation();
    }
    if (typeof stopIdleRotation === 'function') {
        stopIdleRotation();
    }
    if (typeof resetIdle === 'function') {
        resetIdle();
    }

    // Immediately and synchronously release map bounds so the camera can NEVER be clamped
    if (map) {
        try { map.setMaxBounds(null); } catch (e) { }
        try { map.stop(); } catch (e) { }
    }

    const targetStation = STATIONS[stationId];
    state.currentStationId = stationId;

    updateStationUI(stationId);

    // 2. Show Smooth Transition Curtain
    const curtain = document.getElementById('station-transition-curtain');
    const stcIcon = document.getElementById('stc-icon');
    const stcTitle = document.getElementById('stc-title');
    const stcSub = document.getElementById('stc-sub');

    if (stcIcon) stcIcon.textContent = targetStation.icon;
    if (stcTitle) stcTitle.textContent = `Connecting to ${targetStation.name}`;
    if (stcSub) stcSub.textContent = `${targetStation.fullName} • ${targetStation.province}`;
    if (curtain) {
        curtain.setAttribute('aria-hidden', 'false');
        curtain.classList.add('active');

        // Immediate tap/click to dismiss failsafe
        if (!curtain.dataset.hasDismissListener) {
            curtain.dataset.hasDismissListener = 'true';
            curtain.addEventListener('click', () => {
                curtain.classList.remove('active');
                curtain.setAttribute('aria-hidden', 'true');
            });
        }
    }

    const dismissCurtain = () => {
        if (curtain) {
            curtain.classList.remove('active');
            curtain.setAttribute('aria-hidden', 'true');
        }
    };

    // Safety failsafe: transition curtain MUST NEVER remain stuck longer than 500ms
    activeStationSwitchSafetyTimer = setTimeout(dismissCurtain, 500);

    // Reset any active route / building panels without initiating flyTo
    if (typeof window.closeRouteAndReset === 'function') {
        try { window.closeRouteAndReset(); } catch (e) { }
    }
    if (typeof window.closeBuildingPanel === 'function') {
        try { window.closeBuildingPanel(true); } catch (e) { }
    }

    // 3. Perform Seamless Teleport Behind the Curtain (200ms fade-in)
    activeStationSwitchTimer = setTimeout(() => {
        activeStationSwitchTimer = null;
        try {
            // Clean up all map markers & badges
            if (typeof removeMarkers === 'function') removeMarkers();
            if (typeof removeSectionBadges === 'function') removeSectionBadges();
            document.querySelectorAll('.bldg-map-marker').forEach(el => el.remove());

            if (state.kioskMarkerInstance) {
                try { state.kioskMarkerInstance.remove(); } catch (e) { }
                state.kioskMarkerInstance = null;
            }
            if (state.qaresKioskMarkerInstance) {
                try { state.qaresKioskMarkerInstance.remove(); } catch (e) { }
                state.qaresKioskMarkerInstance = null;
            }
            if (state.entranceArrowMarker) {
                try { state.entranceArrowMarker.remove(); } catch (e) { }
                state.entranceArrowMarker = null;
            }

            const isDrone = (state.currentMapStyleMode === 'google');
            const isMapbox = (state.currentMapStyleMode === 'mapbox');

            // Synchronously ensure bounds are completely free
            try { map.setMaxBounds(null); } catch (e) { }

            // Pre-position camera at Target Station's starting high birds-eye view behind curtain
            const introViews = getStationIntroViews(stationId);
            map.jumpTo({
                center: introViews.start.center,
                zoom: introViews.start.zoom,
                pitch: introViews.start.pitch,
                bearing: introViews.start.bearing
            });

            // Mount Target Station Data with STRICT UNCONDITIONAL LAYER ISOLATION
            if (stationId === 'lares') {
                // FORCIBLY HIDE ALL QARES & RARES LAYERS
                const otherLayers = [
                    'qares-mask-layer',
                    'qares-ortho-layer',
                    'qares-boundary-fill',
                    'qares-boundary-glow',
                    'qares-boundary-casing',
                    'qares-boundary-line',
                    'qares-railway-ballast',
                    'qares-railway-sleepers',
                    'qares-railway-rail-left',
                    'qares-railway-rail-right',
                    'qares-footprints-fill',
                    'qares-footprints-line',
                    'qares-footprints-3d',
                    'qares-footprints-roofs',
                    'qares-roads-line',
                    'rares-mask-layer',
                    'rares-ortho-layer',
                    'rares-boundary-fill',
                    'rares-boundary-glow',
                    'rares-boundary-casing',
                    'rares-boundary-line',
                    'rares-plots-fill',
                    'rares-plots-line',
                    'rares-footprints-3d'
                ];
                otherLayers.forEach(id => {
                    if (map.getLayer(id)) {
                        try { map.setLayoutProperty(id, 'visibility', 'none'); } catch (e) { }
                    }
                });

                // MOUNT LARES DATA
                state.roadGraph = state.laresRoadGraph || window.roadGraph;
                window.roadGraph = state.roadGraph;

                // Option C: Strict Station-Isolated 3D Building Models (Mount/restore LARES)
                if (typeof setupStation3DModels === 'function') {
                    setupStation3DModels(map, 'lares', isMapbox);
                }

                const bldgVis = state.buildingsVisible !== false ? 'visible' : 'none';
                const bndVis = state.boundaryVisible !== false ? 'visible' : 'none';

                const bldgLayers = [
                    'lares-3d-models-layer',
                    '3d-buildings-models-layer',
                    '3d-drawings',
                    '3d-drawings-extrusion',
                    '3d-drawings-roofs'
                ];
                bldgLayers.forEach(id => {
                    if (map.getLayer(id)) {
                        try { map.setLayoutProperty(id, 'visibility', bldgVis); } catch (e) { }
                    }
                });

                // Guarantee other stations' isolated 3D models are hidden
                ['rares-3d-models-layer', 'rares-3d-models-transparent', 'qares-3d-models-layer', 'qares-3d-models-transparent'].forEach(id => {
                    if (map.getLayer(id)) {
                        try { map.setLayoutProperty(id, 'visibility', 'none'); } catch (e) { }
                    }
                });

                safeMoveLayer(map, 'lares-3d-models-layer');
                safeMoveLayer(map, 'lares-3d-models-transparent');

                const bndLayers = [
                    'lares-boundary-line',
                    'lares-boundary-glow',
                    'lares-boundary-fill',
                    'lares-compound-border-casing',
                    'lares-compound-border-line',
                    'plots-fill',
                    'plots-line',
                    'plots-labels'
                ];
                bndLayers.forEach(id => {
                    if (map.getLayer(id)) {
                        try { map.setLayoutProperty(id, 'visibility', bndVis); } catch (e) { }
                    }
                });

                // LARES mask: strictly visible ONLY in satellite view when boundaries are on
                const showLaresMask = !isMapbox && (bndVis === 'visible');
                if (map.getLayer('lares-mask-layer')) {
                    try { map.setLayoutProperty('lares-mask-layer', 'visibility', showLaresMask ? 'visible' : 'none'); } catch (e) { }
                }

                const showVectorRoads = isMapbox;
                ['lares-roads-casing', 'lares-roads-fill', 'lares-roads-network'].forEach(id => {
                    if (map.getLayer(id)) {
                        try { map.setLayoutProperty(id, 'visibility', showVectorRoads ? 'visible' : 'none'); } catch (e) { }
                    }
                });

                if (map.getLayer('lares-drone-layer')) {
                    try { map.setLayoutProperty('lares-drone-layer', 'visibility', isDrone ? 'visible' : 'none'); } catch (e) { }
                }
                if (map.getLayer('google-satellite-layer')) {
                    try { map.setLayoutProperty('google-satellite-layer', 'visibility', isDrone ? 'visible' : 'none'); } catch (e) { }
                }

                if (map.getLayer('trees-3d') && state.treesVisible) {
                    try { map.setLayoutProperty('trees-3d', 'visibility', 'visible'); } catch (e) { }
                }

                if (isMapbox && !map.getLayer('lares-compound-border-line')) {
                    if (typeof setupMapboxStandardLayers === 'function') {
                        setupMapboxStandardLayers();
                    }
                }



                if (typeof createMarkers === 'function') createMarkers();
                if (typeof createKioskMarker === 'function') createKioskMarker();
                if (typeof createEntranceArrowMarker === 'function') createEntranceArrowMarker();
                if (typeof buildDirectory === 'function') buildDirectory();
                renderStationCategoryBar('lares');

            } else if (stationId === 'qares') {
                // FORCIBLY HIDE ALL LARES & RARES LAYERS
                const hideLayers = [
                    'lares-3d-models-layer',
                    'lares-3d-models-transparent',
                    'rares-3d-models-layer',
                    'rares-3d-models-transparent',
                    '3d-buildings-models-layer',
                    '3d-buildings-translucent-layer',
                    '3d-drawings',
                    '3d-drawings-extrusion',
                    '3d-drawings-roofs',
                    'lares-mask-layer',
                    'lares-drone-layer',
                    'google-satellite-overlay-layer',
                    'lares-boundary-line',
                    'lares-boundary-glow',
                    'lares-boundary-fill',
                    'lares-compound-border-casing',
                    'lares-compound-border-line',
                    'lares-roads-casing',
                    'lares-roads-fill',
                    'lares-roads-network',
                    'plots-fill',
                    'plots-line',
                    'plots-labels',
                    'trees-3d',
                    'rares-mask-layer',
                    'rares-ortho-layer',
                    'rares-boundary-fill',
                    'rares-boundary-glow',
                    'rares-boundary-casing',
                    'rares-boundary-line',
                    'rares-plots-fill',
                    'rares-plots-line',
                    'rares-footprints-3d'
                ];
                hideLayers.forEach(id => {
                    if (map.getLayer(id)) {
                        try { map.setLayoutProperty(id, 'visibility', 'none'); } catch (e) { }
                    }
                });

                if (state.qaresRoadGraph) {
                    state.roadGraph = state.qaresRoadGraph;
                    window.roadGraph = state.qaresRoadGraph;
                }

                renderStationCategoryBar('qares');
                loadQARESData();
                if (typeof setupStation3DModels === 'function') {
                    setupStation3DModels(map, 'qares', isMapbox);
                }

                if (typeof createKioskMarker === 'function') {
                    createKioskMarker();
                }

            } else if (stationId === 'rares') {
                // FORCIBLY HIDE ALL LARES & QARES LAYERS
                const hideLayers = [
                    'lares-3d-models-layer',
                    'lares-3d-models-transparent',
                    'qares-3d-models-layer',
                    'qares-3d-models-transparent',
                    '3d-buildings-models-layer',
                    '3d-buildings-translucent-layer',
                    '3d-drawings',
                    '3d-drawings-extrusion',
                    '3d-drawings-roofs',
                    'lares-mask-layer',
                    'lares-drone-layer',
                    'google-satellite-overlay-layer',
                    'lares-boundary-line',
                    'lares-boundary-glow',
                    'lares-boundary-fill',
                    'lares-compound-border-casing',
                    'lares-compound-border-line',
                    'lares-roads-casing',
                    'lares-roads-fill',
                    'lares-roads-network',
                    'plots-fill',
                    'plots-line',
                    'plots-labels',
                    'trees-3d',
                    'qares-mask-layer',
                    'qares-ortho-layer',
                    'qares-boundary-fill',
                    'qares-boundary-glow',
                    'qares-boundary-casing',
                    'qares-boundary-line',
                    'qares-railway-ballast',
                    'qares-railway-sleepers',
                    'qares-railway-rail-left',
                    'qares-railway-rail-right',
                    'qares-footprints-fill',
                    'qares-footprints-line',
                    'qares-footprints-3d',
                    'qares-footprints-roofs',
                    'qares-roads-line'
                ];
                hideLayers.forEach(id => {
                    if (map.getLayer(id)) {
                        try { map.setLayoutProperty(id, 'visibility', 'none'); } catch (e) { }
                    }
                });

                renderStationCategoryBar('rares');
                renderRARESDirectory();
                loadRARESData();

                // Option C: Strict Station-Isolated 3D Building Models (Mount/restore RARES)
                if (typeof setupStation3DModels === 'function') {
                    setupStation3DModels(map, 'rares', isMapbox);
                }
                const bldgVis = state.buildingsVisible !== false ? 'visible' : 'none';
                if (map.getLayer('rares-3d-models-layer')) {
                    try {
                        map.setLayoutProperty('rares-3d-models-layer', 'visibility', bldgVis);
                        safeMoveLayer(map, 'rares-3d-models-layer');
                    } catch (e) {}
                }
                safeMoveLayer(map, 'rares-3d-models-transparent');

                if (typeof createKioskMarker === 'function') {
                    createKioskMarker();
                }
            }
        } catch (err) {
            console.error('[StationSwitch] Error during station transition:', err);
        } finally {
            // Dismiss transition curtain promptly (100ms after teleport finishes) and launch cinematic intro fly-in
            activeCurtainDismissTimer = setTimeout(() => {
                activeCurtainDismissTimer = null;
                if (activeStationSwitchSafetyTimer) {
                    clearTimeout(activeStationSwitchSafetyTimer);
                    activeStationSwitchSafetyTimer = null;
                }
                dismissCurtain();
                if (typeof playIntroAnimation === 'function') {
                    playIntroAnimation(null, true);
                }
            }, 100);
        }
    }, 200);
}

let qaresEventsBound = false;
function bindQARESBuildingEvents() {
    if (!map || qaresEventsBound) return;
    qaresEventsBound = true;

    const onQaresBuildingClick = (e) => {
        if (!e.features || !e.features.length) return;
        const f = e.features[0];
        const p = f.properties || {};
        const bId = p.id;
        if (bId && typeof window.navigateTo === 'function') {
            window.navigateTo(bId);
        }
    };

    map.on('click', 'qares-footprints-3d', onQaresBuildingClick);
    map.on('click', 'qares-footprints-roofs', onQaresBuildingClick);
    map.on('mouseenter', 'qares-footprints-3d', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'qares-footprints-3d', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'qares-footprints-roofs', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'qares-footprints-roofs', () => { map.getCanvas().style.cursor = ''; });
}

export function buildQARESMaskFromBoundary(boundaryGeoJson) {
    if (!boundaryGeoJson || !boundaryGeoJson.features) return null;
    let front = null;
    let flint = null;
    for (const f of boundaryGeoJson.features) {
        const id = (f.properties && f.properties.id) || f.id;
        if (id === 'qares_front' && f.geometry && f.geometry.type === 'Polygon') {
            front = f.geometry.coordinates[0];
        }
        if (id === 'qares_flint' && f.geometry && f.geometry.type === 'Polygon') {
            flint = f.geometry.coordinates[0];
        }
    }
    if (!front || !flint) return null;

    // Bridge coordinates connecting across PNR Railway Track
    const bridgeEastNorth = [121.37061209525696, 13.944254361703344];
    const bridgeEastMid = [121.3705593874083, 13.944142160808177];
    const bridgeWestNorth = [121.37047394506597, 13.94430713756418];
    const bridgeWestMid1 = [121.37042437050941, 13.944201606477387];
    const bridgeWestMid2 = [121.37042414140082, 13.944201113871262];

    function lineIntersect(p1, p2, p3, p4) {
        const xd = [p1[0] - p2[0], p3[0] - p4[0]];
        const yd = [p1[1] - p2[1], p3[1] - p4[1]];
        const div = xd[0] * yd[1] - xd[1] * yd[0];
        if (div === 0) return null;
        const d1 = p1[0] * p2[1] - p1[1] * p2[0];
        const d2 = p3[0] * p4[1] - p3[1] * p4[0];
        return [(d1 * xd[1] - xd[0] * d2) / div, (d1 * yd[1] - yd[0] * d2) / div];
    }

    const eastIntersect = lineIntersect(front[2], front[3], bridgeEastMid, bridgeEastNorth) || [121.37051705867479, 13.944052054016835];
    const westIntersect = lineIntersect(front[3], front[4], [121.37037, 13.94408], bridgeWestNorth) || [121.370380891412, 13.944103798967703];

    const hole = [
        front[0], // SW
        front[1], // SE
        front[2], // NE
        eastIntersect,
        bridgeEastMid,
        bridgeEastNorth
    ];

    for (let i = 1; i < flint.length - 1; i++) {
        hole.push(flint[i]);
    }
    hole.push(flint[0]); // SW of Flint

    hole.push(bridgeWestNorth);
    hole.push(bridgeWestMid1);
    hole.push(bridgeWestMid2);
    hole.push(westIntersect);

    for (let i = 4; i < front.length; i++) {
        hole.push(front[i]);
    }

    return {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
                    hole
                ]
            },
            properties: {
                station: 'qares',
                description: 'DA-QARES Compound Vignette Mask with Walkway Bridge'
            }
        }]
    };
}

export function loadQARESData() {
    const isDrone = (state.currentMapStyleMode === 'google');
    const isMapbox = (state.currentMapStyleMode === 'mapbox');

    // 0. Ensure structural QARES layers respect active visibility states
    const bldgVis = state.buildingsVisible ? 'visible' : 'none';
    const bndVis = state.boundaryVisible !== false ? 'visible' : 'none';
    const bndShadowVis = (!isMapbox && bndVis === 'visible') ? 'visible' : 'none';
    ['qares-boundary-fill', 'qares-boundary-line', 'qares-railway-casing', 'qares-railway-line'].forEach(id => {
        if (map && map.getLayer(id)) {
            try { map.setLayoutProperty(id, 'visibility', bndVis); } catch (e) { }
        }
    });
    ['qares-boundary-glow', 'qares-boundary-casing'].forEach(id => {
        if (map && map.getLayer(id)) {
            try { map.setLayoutProperty(id, 'visibility', bndShadowVis); } catch (e) { }
        }
    });
    ['qares-footprints-3d', 'qares-footprints-roofs'].forEach(id => {
        if (map && map.getLayer(id)) {
            try { map.setLayoutProperty(id, 'visibility', bldgVis); } catch (e) { }
        }
    });

    // High-Resolution Drone Orthomosaic: ONLY visible in Aerial Drone View, hidden in Mapbox 3D View
    if (map && map.getLayer('qares-ortho-layer')) {
        try { map.setLayoutProperty('qares-ortho-layer', 'visibility', isDrone ? 'visible' : 'none'); } catch (e) { }
    }

    // Remove road outline layer if present so it doesn't render over aerial imagery
    if (map && map.getLayer('qares-roads-line')) {
        try { map.removeLayer('qares-roads-line'); } catch (e) { }
    }

    // 1. Ensure LARES mask is turned OFF and satellite imagery is visible
    if (map && map.getLayer('lares-mask-layer')) {
        try { map.setLayoutProperty('lares-mask-layer', 'visibility', 'none'); } catch (e) { }
    }
    if (map && map.getLayer('google-satellite-layer')) {
        try { map.setLayoutProperty('google-satellite-layer', 'visibility', isDrone ? 'visible' : 'none'); } catch (e) { }
    }

    // 2. High-Resolution QARES Drone Orthomosaic Layer (Tiled MBTiles Pyramid, Zooms 14-21)
    try {
        if (!map.getSource('qares-drone-source')) {
            map.addSource('qares-drone-source', {
                type: 'raster',
                tiles: [
                    '/api/tiles/qares/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                minzoom: 14,
                maxzoom: 21,
                bounds: [121.366888, 13.941220, 121.376150, 13.950960]
            });
        }
        if (!map.getLayer('qares-ortho-layer') && map.getSource('qares-drone-source')) {
            map.addLayer({
                id: 'qares-ortho-layer',
                type: 'raster',
                source: 'qares-drone-source',
                slot: 'bottom',
                layout: {
                    'visibility': isDrone ? 'visible' : 'none'
                },
                paint: {
                    'raster-opacity': 1.0,
                    'raster-fade-duration': 0
                }
            });
        } else if (map.getLayer('qares-ortho-layer')) {
            try { map.setLayoutProperty('qares-ortho-layer', 'visibility', isDrone ? 'visible' : 'none'); } catch (e) { }
        }
    } catch (e) {
        console.warn('[QARES] Ortho source/layer notice:', e);
    }

    // 2b. Dark Vignette / Boundary Mask (Isolates DA-QARES compound in 3D dark void space, leaving connecting walkway visible)
    try {
        if (!map.getSource('qares-mask-source')) {
            map.addSource('qares-mask-source', {
                type: 'geojson',
                data: QARES_MASK
            });
        }
        const showQaresMask = !isMapbox && (state.currentStationId === 'qares');
        if (!map.getLayer('qares-mask-layer') && map.getSource('qares-mask-source')) {
            map.addLayer({
                id: 'qares-mask-layer',
                type: 'fill',
                source: 'qares-mask-source',
                slot: 'middle',
                layout: {
                    'visibility': showQaresMask ? 'visible' : 'none'
                },
                paint: {
                    'fill-color': '#0b1121',
                    'fill-opacity': 1.0
                }
            });
        } else if (map.getLayer('qares-mask-layer')) {
            try {
                map.setLayoutProperty('qares-mask-layer', 'visibility', showQaresMask ? 'visible' : 'none');
                map.setPaintProperty('qares-mask-layer', 'fill-color', '#0b1121');
                map.setPaintProperty('qares-mask-layer', 'fill-opacity', 1.0);
            } catch (e) { }
        }
    } catch (e) {
        console.warn('[QARES] Mask layer notice:', e);
    }

    // 3. QARES Compound Official Boundary Outline (QGIS Split Parcels: Front & Flint + PNR Corridor)
    try {
        if (!map.getSource('qares-boundary-source')) {
            map.addSource('qares-boundary-source', {
                type: 'geojson',
                data: 'qares_boundary.json'
            });
        }

        // 3a. Subtle interior green fill
        if (!map.getLayer('qares-boundary-fill') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-boundary-fill',
                type: 'fill',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
                layout: { 'visibility': bndVis },
                paint: {
                    'fill-color': '#22c55e',
                    'fill-opacity': 0.06
                }
            });
        } else if (map.getLayer('qares-boundary-fill')) {
            try { map.setLayoutProperty('qares-boundary-fill', 'visibility', bndVis); } catch (e) { }
        }

        // 3b. Soft ambient grass green glow (Satellite mode only; zero shadow in Mapbox mode)
        if (!map.getLayer('qares-boundary-glow') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-boundary-glow',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                    'visibility': bndShadowVis
                },
                paint: {
                    'line-color': '#4ade80',
                    'line-width': 10,
                    'line-blur': 4,
                    'line-opacity': 0.35
                }
            });
        } else if (map.getLayer('qares-boundary-glow')) {
            try { map.setLayoutProperty('qares-boundary-glow', 'visibility', bndShadowVis); } catch (e) { }
        }

        // 3c. High-contrast dark forest green outer protective casing (Satellite mode only; zero shadow in Mapbox mode)
        if (!map.getLayer('qares-boundary-casing') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-boundary-casing',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                    'visibility': bndShadowVis
                },
                paint: {
                    'line-color': '#14532d',
                    'line-width': 5.5,
                    'line-opacity': 0.85
                }
            });
        } else if (map.getLayer('qares-boundary-casing')) {
            try { map.setLayoutProperty('qares-boundary-casing', 'visibility', bndShadowVis); } catch (e) { }
        }

        // 3d. Crisp unified neon green perimeter line
        if (!map.getLayer('qares-boundary-line') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-boundary-line',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                    'visibility': bndVis
                },
                paint: {
                    'line-color': '#22c55e',
                    'line-width': 3.0,
                    'line-opacity': 0.95
                }
            });
        } else if (map.getLayer('qares-boundary-line')) {
            try { map.setLayoutProperty('qares-boundary-line', 'visibility', bndVis); } catch (e) { }
        }

        // 3e. Authentic Multi-Layered PNR Railway Track (Ballast, Sleepers/Ties & Twin Steel Rails)
        // Clean up legacy single-line layers if present
        ['qares-railway-casing', 'qares-railway-line'].forEach(id => {
            if (map.getLayer(id)) {
                try { map.removeLayer(id); } catch (e) { }
            }
        });

        // 1. Ballast Bed (Dark crushed stone gravel foundation)
        if (!map.getLayer('qares-railway-ballast') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-railway-ballast',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['==', ['geometry-type'], 'LineString'],
                layout: { 'line-cap': 'round', 'line-join': 'round', 'visibility': bndVis },
                paint: {
                    'line-color': '#0f172a',
                    'line-width': [
                        'interpolate', ['linear'], ['zoom'],
                        14, 6,
                        16, 10,
                        18, 16,
                        20, 22
                    ],
                    'line-opacity': 1.0
                }
            });
        } else if (map.getLayer('qares-railway-ballast')) {
            try { map.setLayoutProperty('qares-railway-ballast', 'visibility', bndVis); } catch (e) { }
        }

        // 2. Railroad Ties / Cross Sleepers (Perpendicular wooden/concrete crossbars)
        if (!map.getLayer('qares-railway-sleepers') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-railway-sleepers',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['==', ['geometry-type'], 'LineString'],
                layout: { 'line-cap': 'butt', 'line-join': 'miter', 'visibility': bndVis },
                paint: {
                    'line-color': '#94a3b8',
                    'line-width': [
                        'interpolate', ['linear'], ['zoom'],
                        14, 5,
                        16, 8,
                        18, 13,
                        20, 18
                    ],
                    'line-dasharray': [0.35, 1.25],
                    'line-opacity': 0.95
                }
            });
        } else if (map.getLayer('qares-railway-sleepers')) {
            try { map.setLayoutProperty('qares-railway-sleepers', 'visibility', bndVis); } catch (e) { }
        }

        // 3. Left Steel Rail (Parallel shining metallic steel rail)
        if (!map.getLayer('qares-railway-rail-left') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-railway-rail-left',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['==', ['geometry-type'], 'LineString'],
                layout: { 'line-cap': 'round', 'line-join': 'round', 'visibility': bndVis },
                paint: {
                    'line-color': '#f8fafc',
                    'line-width': [
                        'interpolate', ['linear'], ['zoom'],
                        14, 1.0,
                        16, 1.5,
                        18, 2.2,
                        20, 3.0
                    ],
                    'line-offset': [
                        'interpolate', ['linear'], ['zoom'],
                        14, -1.8,
                        16, -2.8,
                        18, -4.5,
                        20, -6.5
                    ],
                    'line-opacity': 1.0
                }
            });
        } else if (map.getLayer('qares-railway-rail-left')) {
            try { map.setLayoutProperty('qares-railway-rail-left', 'visibility', bndVis); } catch (e) { }
        }

        // 4. Right Steel Rail (Parallel shining metallic steel rail)
        if (!map.getLayer('qares-railway-rail-right') && map.getSource('qares-boundary-source')) {
            map.addLayer({
                id: 'qares-railway-rail-right',
                type: 'line',
                source: 'qares-boundary-source',
                slot: 'middle',
                filter: ['==', ['geometry-type'], 'LineString'],
                layout: { 'line-cap': 'round', 'line-join': 'round', 'visibility': bndVis },
                paint: {
                    'line-color': '#f8fafc',
                    'line-width': [
                        'interpolate', ['linear'], ['zoom'],
                        14, 1.0,
                        16, 1.5,
                        18, 2.2,
                        20, 3.0
                    ],
                    'line-offset': [
                        'interpolate', ['linear'], ['zoom'],
                        14, 1.8,
                        16, 2.8,
                        18, 4.5,
                        20, 6.5
                    ],
                    'line-opacity': 1.0
                }
            });
        } else if (map.getLayer('qares-railway-rail-right')) {
            try { map.setLayoutProperty('qares-railway-rail-right', 'visibility', bndVis); } catch (e) { }
        }
    } catch (e) {
        console.warn('[QARES] Boundary layers notice:', e);
    }

    // 3f. Dynamically fetch qares_boundary.json to guarantee realtime boundary & mask alignment
    try {
        fetch('qares_boundary.json?t=' + Date.now())
            .then(r => r.json())
            .then(bndData => {
                if (!bndData || !bndData.features) return;
                if (map && map.getSource('qares-boundary-source')) {
                    try { map.getSource('qares-boundary-source').setData(bndData); } catch (e) { }
                }
                const dynamicMask = buildQARESMaskFromBoundary(bndData);
                if (dynamicMask && map && map.getSource('qares-mask-source')) {
                    try { map.getSource('qares-mask-source').setData(dynamicMask); } catch (e) { }
                }
            })
            .catch(e => console.warn('[QARES] Dynamic boundary sync notice:', e));
    } catch (e) { }

    // Helper: Mount/Sync QARES Footprints Source & 3D Extrusion Layers
    function applyQARESFootprints(data) {
        if (!map || !data) return;
        qaresBuildingsBaseline = data;
        if (typeof window !== 'undefined') window.qaresBuildingsBaseline = data;

        // 1. Ensure source
        try {
            if (!map.getSource('qares-footprints-source')) {
                map.addSource('qares-footprints-source', { type: 'geojson', data: data });
            } else {
                try { map.getSource('qares-footprints-source').setData(data); } catch (e) { }
            }
        } catch (e) {
            console.warn('[QARES] Footprints source notice:', e);
        }

        const bldgVis = state.buildingsVisible ? 'visible' : 'none';

        // 2. 3D Extruded Building Walls (Generic Light Gray Concrete / Stucco)
        try {
            if (!map.getLayer('qares-footprints-3d') && map.getSource('qares-footprints-source')) {
                map.addLayer({
                    id: 'qares-footprints-3d',
                    type: 'fill-extrusion',
                    source: 'qares-footprints-source',
                    slot: 'middle',
                    filter: ['==', ['coalesce', ['get', 'filter_type'], ['get', 'category'], 'Buildings'], 'Buildings'],
                    layout: {
                        'visibility': bldgVis
                    },
                    paint: {
                        'fill-extrusion-color': '#d4d8de',
                        'fill-extrusion-height': ['coalesce', ['get', 'height'], 5],
                        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
                        'fill-extrusion-opacity': 0.95,
                        'fill-extrusion-emissive-strength': 0.35,
                        'fill-extrusion-cast-shadows': false
                    }
                });
            } else if (map.getLayer('qares-footprints-3d')) {
                try {
                    map.setLayoutProperty('qares-footprints-3d', 'visibility', bldgVis);
                    map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-color', '#d4d8de');
                    map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-height', ['coalesce', ['get', 'height'], 5]);
                    map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-base', ['coalesce', ['get', 'min_height'], 0]);
                    map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-opacity', 0.95);
                    map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-emissive-strength', 0.35);
                    map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-cast-shadows', false);
                    map.setFilter('qares-footprints-3d', ['==', ['coalesce', ['get', 'filter_type'], ['get', 'category'], 'Buildings'], 'Buildings']);
                } catch (e) { }
            }
        } catch (e) {
            console.warn('[QARES] 3D footprints layer notice:', e);
        }

        // 3. 3D Architectural Roof Slab (Elevated Cap matching Respective Color Coding)
        try {
            if (!map.getLayer('qares-footprints-roofs') && map.getSource('qares-footprints-source')) {
                map.addLayer({
                    id: 'qares-footprints-roofs',
                    type: 'fill-extrusion',
                    source: 'qares-footprints-source',
                    slot: 'middle',
                    filter: ['==', ['coalesce', ['get', 'filter_type'], ['get', 'category'], 'Buildings'], 'Buildings'],
                    layout: {
                        'visibility': bldgVis
                    },
                    paint: {
                        'fill-extrusion-color': ['coalesce', ['get', 'roof_color'], ['get', 'color'], '#dc2626'],
                        'fill-extrusion-height': ['+', ['coalesce', ['get', 'height'], 5], 0.35],
                        'fill-extrusion-base': ['coalesce', ['get', 'height'], 5],
                        'fill-extrusion-opacity': 1.0,
                        'fill-extrusion-emissive-strength': 0.35,
                        'fill-extrusion-cast-shadows': false
                    }
                });
            } else if (map.getLayer('qares-footprints-roofs')) {
                try {
                    map.setLayoutProperty('qares-footprints-roofs', 'visibility', bldgVis);
                    map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-color', ['coalesce', ['get', 'roof_color'], ['get', 'color'], '#dc2626']);
                    map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-height', ['+', ['coalesce', ['get', 'height'], 5], 0.35]);
                    map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-base', ['coalesce', ['get', 'height'], 5]);
                    map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-opacity', 1.0);
                    map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-emissive-strength', 0.35);
                    map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-cast-shadows', false);
                    map.setFilter('qares-footprints-roofs', ['==', ['coalesce', ['get', 'filter_type'], ['get', 'category'], 'Buildings'], 'Buildings']);
                } catch (e) { }
            }
        } catch (e) {
            console.warn('[QARES] Roofs layer notice:', e);
        }

        // Hide legacy flat 2D ground layers so they don't clip under 3D models
        if (map.getLayer('qares-footprints-fill')) try { map.setLayoutProperty('qares-footprints-fill', 'visibility', 'none'); } catch (e) { }
        if (map.getLayer('qares-footprints-line')) try { map.setLayoutProperty('qares-footprints-line', 'visibility', 'none'); } catch (e) { }

        // Bind interactive click & hover handlers once
        bindQARESBuildingEvents();

        // Render Directory for QARES (retaining Buildings part)
        renderQARESDirectory(data, 'Buildings');
    }

    // Immediate mount from cached memory baseline (zero delay on style change)
    if (qaresBuildingsBaseline) {
        applyQARESFootprints(qaresBuildingsBaseline);
    }

    // 4. Fetch QARES Buildings GeoJSON (ensures fresh data)
    fetch('qares_buildings.json?v=' + Date.now())
        .then(r => r.json())
        .then(data => {
            applyQARESFootprints(data);
        })
        .catch(e => console.log('Notice: Could not load QARES buildings.', e));

    // 3. Fetch QARES Roads GeoJSON & Build Pathfinding Graph (only if not yet cached)
    if (state.qaresRoadGraph) {
        state.roadGraph = state.qaresRoadGraph;
        window.roadGraph = state.qaresRoadGraph;
    } else {
        fetch('qares_roads.json')
            .then(r => r.json())
            .then(roadData => {
                if (!map) return;
                if (map.getSource('qares-roads-source')) {
                    map.getSource('qares-roads-source').setData(roadData);
                } else {
                    map.addSource('qares-roads-source', { type: 'geojson', data: roadData });
                }
                if (map.getLayer('qares-roads-line')) {
                    try { map.removeLayer('qares-roads-line'); } catch (e) { }
                }

                // Build QARES road topology graph
                state.qaresRoadGraph = buildRoadGraph(roadData);
                if (state.currentStationId === 'qares') {
                    state.roadGraph = state.qaresRoadGraph;
                    window.roadGraph = state.qaresRoadGraph;
                }
                console.log(`[QARES] Loaded road graph with ${state.qaresRoadGraph.size} nodes.`);
            })
            .catch(e => console.warn('Notice: Could not load qares_roads.json:', e));
    }

    // Ensure QARES Kiosk "You Are Here" pin is mounted
    if (typeof createKioskMarker === 'function') {
        createKioskMarker();
    }
}

let raresBuildingsBaseline = null;

// Helper: Contextual Functional Subtitle for RARES Facilities (matching LARES & QARES format)
function getRARESSubtitle(name, desc) {
    if (desc && desc.trim()) return desc;
    const n = (name || '').toLowerCase();
    if (n.includes('guard')) return 'Station Security Checkpoint & Gate Access';
    if (n.includes('admin')) return 'Administrative & Station Management';
    if (n.includes('seed storage')) return 'Certified Seed Storage & Warehouse';
    if (n.includes('chemical storage')) return 'Agricultural Chemical & Fertilizer Storage';
    if (n.includes('flatbed dryer')) return 'Mechanical Grain & Seed Drying Facility';
    if (n.includes('apco')) return 'Agricultural Program Coordinating Office (APCO)';
    if (n.includes('common cr') || n.includes('comfort room') || n.includes('cr')) return 'Public Restroom & Station Amenity';
    if (n.includes('vermicomposting facility (new)')) return 'Modern Vermicomposting & Bio-Fertilizer Facility';
    if (n.includes('vermicomposting') || n.includes('vermi')) return 'Organic Compost & Vermiculture Unit';
    if (n.includes('office supply')) return 'Station Logistics & Supplies Storage';
    if (n.includes('machinery & equipment storage')) return 'Heavy Machinery & Farm Implements Storage';
    if (n.includes('machinery shed')) return 'Agricultural Machinery & Tractor Shed';
    if (n.includes('storage area for hydroponics')) return 'Hydroponic Supplies & Seedling Area';
    if (n.includes('greenhouse with hydroponics')) return 'Hydroponic Cultivation & Production Greenhouse';
    if (n.includes('low-cost greenhouse')) return 'Protected Crop Cultivation Structure';
    if (n.includes('low-cost hydroponics')) return 'Soilless Farming & Hydroponic System';
    if (n.includes('sgpp storage')) return 'Smart Greenhouse Logistics & Storage';
    if (n.includes('smart greenhouse') || n.includes('sgpp')) return 'Smart Protected Farming Research Facility';
    if (n.includes('multipurpose r&d')) return 'Multipurpose Agricultural R&D Facility';
    if (n.includes('mushroom laboratory') || (n.includes('mushroom') && n.includes('lab'))) return 'Mushroom Tissue Culture & Spawn Laboratory';
    if (n.includes('mushroom')) return 'Mushroom Production & Fruiting House';
    if (n.includes('staff house')) return 'Station Personnel Residential Quarters';
    if (n.includes('mini conference') || n.includes('conference')) return 'Training & Conference Facility';
    if (n.includes('poultry house')) return 'Poultry Research & Production House';
    if (n.includes('farm house')) return 'Field Station & Farm Operations Quarters';
    if (n.includes('pre-composting')) return 'Organic Biomass & Pre-Composting Station';
    if (n.includes('weather') || n.includes('aws')) return 'Agro-Meteorological & Weather Station';
    if (n.includes('rest area')) return 'Field Rest Area & Station Amenity';
    if (n.includes('hatchery')) return 'Poultry & Avian Hatchery Facility';
    if (n.includes('palay shed') || n.includes('palay')) return 'Rice Post-Harvest & Drying Shed';
    if (n.includes('botanical concoction')) return 'Natural Farm Inputs & Concoctions Storage';
    if (n.includes('wood vinegar')) return 'Bio-Charcoal & Wood Vinegar Production Facility';
    if (n.includes('breeder house') || n.includes('breeder')) return 'Livestock Breeding & Genetics Facility';
    if (n.includes('brooder house') || n.includes('brooder')) return 'Poultry Brooding & Chick Care Facility';
    if (n.includes('solar') || n.includes('spis')) return 'Renewable Energy Solar-Powered Irrigation System';
    if (n.includes('nursery')) return 'Planting Materials & Crop Nursery';
    if (n.includes('storage') || n.includes('warehouse')) return 'Agricultural Supplies & Equipment Storage';
    return 'RARES Agricultural Facility';
}

const RARES_SEARCH_ALIASES = {
    'guard house': ['guard', 'security', 'gate', 'checkpoint', 'entrance'],
    'admin building': ['admin', 'office', 'administration', 'management'],
    'seed storage': ['seed', 'storage', 'warehouse', 'seeds', 'bodega'],
    'chemical storage': ['chemical', 'fertilizer', 'pesticide', 'storage'],
    'flatbed dryer': ['flatbed', 'dryer', 'drying', 'palay dryer'],
    'nursery a': ['nursery', 'seedling', 'crop'],
    'apco': ['apco', 'coordinating', 'office', 'agricultural program'],
    'common cr': ['cr', 'comfort room', 'restroom', 'toilet'],
    'vermicomposting facility (old)': ['vermi', 'compost', 'organic', 'vermicomposting', 'old vermi'],
    'office supply storage': ['supply', 'supplies', 'storage', 'office storage'],
    'machinery shed': ['machinery', 'tractor', 'shed', 'equipment'],
    'nursery / storage area for hydroponics': ['hydroponics', 'storage', 'nursery', 'seedling'],
    'greenhouse with hydroponics': ['greenhouse', 'hydroponics', 'hydro'],
    'nursery b': ['nursery', 'seedling', 'crop'],
    'staff house a': ['staff', 'dorm', 'quarters', 'housing'],
    'sgpp storage': ['sgpp', 'storage', 'smart greenhouse'],
    'multipurpose r&d building': ['r&d', 'research', 'rnd', 'multipurpose', 'dormitory'],
    'low-cost greenhouse': ['greenhouse', 'low-cost', 'low cost'],
    'low-cost hydroponics facility': ['hydroponics', 'hydro', 'low-cost'],
    'staff house b': ['staff', 'dorm', 'quarters', 'housing'],
    'staff house c': ['staff', 'dorm', 'quarters', 'housing'],
    'mushroom laboratory': ['mushroom', 'lab', 'spawn', 'laboratory'],
    'staff house d': ['staff', 'dorm', 'quarters', 'housing'],
    'mini conference hall': ['conference', 'hall', 'training', 'seminar'],
    'poultry house': ['poultry', 'chicken', 'birds', 'coop'],
    'farm house': ['farm house', 'farmhouse', 'operations'],
    'vermicomposting facility (new)': ['vermi', 'compost', 'organic', 'vermicomposting', 'new vermi'],
    'machinery & equipment storage': ['machinery', 'equipment', 'storage'],
    'pre-composting area': ['pre-compost', 'compost', 'biomass'],
    'automated weather station (aws)': ['aws', 'weather', 'meteorological', 'station'],
    'automated weather station': ['aws', 'weather', 'meteorological', 'station'],
    'rest area': ['rest', 'kubo', 'gazebo', 'cottage'],
    'hatchery area': ['hatchery', 'incubator', 'eggs', 'avian'],
    'multipurpose palay shed': ['palay', 'rice', 'shed', 'drying'],
    'botanical concoction storage': ['botanical', 'concoction', 'organic inputs', 'extracts'],
    'wood vinegar facility': ['wood vinegar', 'biochar', 'pyrolysis'],
    'smart greenhouse project in the philippines (sgpp)': ['sgpp', 'smart greenhouse', 'greenhouse'],
    'breeder house': ['breeder', 'breeding', 'livestock', 'cattle', 'animals'],
    'brooder house': ['brooder', 'brooding', 'chicks', 'poultry'],
    'solar powered irrigation system (spis)': ['spis', 'solar', 'irrigation', 'water', 'pump']
};

export function getGroupedRARESFacilities(data) {
    const allFeatures = (data && data.features) ? data.features : [];
    const groups = new Map();

    allFeatures.forEach(f => {
        const props = f.properties || {};
        const id = props.id || '';
        const match = id.match(/_([0-9]+)/);
        const baseNum = match ? parseInt(match[1], 10) : null;
        const key = baseNum !== null ? baseNum : id;

        if (!groups.has(key)) {
            groups.set(key, {
                baseNum: baseNum,
                num: baseNum,
                id: `rares_building_${baseNum || id}`,
                name: props.name || `Facility ${baseNum || ''}`,
                category: props.category || 'Buildings',
                description: props.description || '',
                features: [],
                allCoordinates: []
            });
        }
        const group = groups.get(key);
        group.features.push(f);
        if (f.geometry && f.geometry.type === 'Polygon' && f.geometry.coordinates && f.geometry.coordinates[0]) {
            f.geometry.coordinates[0].forEach(coord => {
                group.allCoordinates.push(coord);
            });
        }
    });

    const result = Array.from(groups.values()).map(g => {
        let centerCoords = [121.3393, 14.5750];
        const markerFeat = g.features.find(f => f.properties && f.properties.marker_coords);
        if (markerFeat && Array.isArray(markerFeat.properties.marker_coords) && markerFeat.properties.marker_coords.length === 2) {
            centerCoords = markerFeat.properties.marker_coords;
        } else if (g.allCoordinates.length > 0) {
            let sumLng = 0, sumLat = 0;
            g.allCoordinates.forEach(c => {
                sumLng += c[0];
                sumLat += c[1];
            });
            centerCoords = [sumLng / g.allCoordinates.length, sumLat / g.allCoordinates.length];
        } else if (g.features[0] && g.features[0].geometry && g.features[0].geometry.coordinates && g.features[0].geometry.coordinates[0]) {
            const ring = g.features[0].geometry.coordinates[0];
            let sumLng = 0, sumLat = 0;
            ring.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
            centerCoords = [sumLng / ring.length, sumLat / ring.length];
        }

        return {
            baseNum: g.baseNum,
            num: g.baseNum,
            id: g.id,
            name: g.name,
            category: g.category,
            description: g.description,
            coords: centerCoords,
            structureCount: g.features.length,
            features: g.features
        };
    });

    result.sort((a, b) => {
        if (a.baseNum !== null && b.baseNum !== null) return a.baseNum - b.baseNum;
        return (a.baseNum || 9999) - (b.baseNum || 9999);
    });

    return result;
}

export function renderRARESDirectory(data = raresBuildingsBaseline, filterCat = 'all', isPreFiltered = false, customList = null) {
    if (data && !isPreFiltered) raresBuildingsBaseline = data;
    if (typeof window !== 'undefined') window.raresBuildingsBaseline = raresBuildingsBaseline;

    const dirEl = document.getElementById('directory');
    const phoneDirEl = document.getElementById('phone-directory-list');

    let facilities = customList;
    if (!facilities) {
        facilities = getGroupedRARESFacilities(data);
        if (filterCat && filterCat !== 'all') {
            facilities = facilities.filter(f => f.category === filterCat);
        }
    }

    const headerTitle = isPreFiltered ? `RARES SEARCH (${facilities.length})` : `RARES BUILDINGS (${facilities.length})`;
    let html = `<div class="dir-section-header" style="padding: 12px 16px 8px; font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; display:flex; justify-content:space-between; align-items:center;">
        <span>${headerTitle}</span>
        <span style="font-size:10px; color:#38bdf8; font-weight:600;">Tanay, Rizal</span>
    </div>`;

    if (facilities.length === 0) {
        html += `<div style="padding: 36px 16px; text-align: center; color: #94a3b8; font-size: 13px; line-height: 1.5;">
            <div style="font-size: 28px; margin-bottom: 8px;">🌿</div>
            <div style="font-weight: 600; color: #e2e8f0; margin-bottom: 4px;">DA-RARES Tanay Campus Active</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Traced buildings from the Building Drawer will appear here.</div>
        </div>`;
    } else {
        facilities.forEach((fac) => {
            const num = fac.num;
            const name = fac.name;
            const sub = getRARESSubtitle(name, fac.description);
            const bId = fac.id;
            const centerCoords = fac.coords;

            html += `
            <div class="dir-item" data-id="${bId}" onclick="flyToRARESFacility(${centerCoords[0]}, ${centerCoords[1]}, '${bId}')" data-category="${fac.category || 'Buildings'}" style="cursor: pointer;">
                <div class="dir-item-icon" style="background: rgba(16, 185, 129, 0.16); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);">
                    <span class="dir-item-icon-number">${num}</span>
                </div>
                <div class="dir-item-info">
                    <div class="dir-item-name">${name}</div>
                    <div class="dir-item-desc">${sub}</div>
                </div>
                <div class="dir-item-arrow">→</div>
            </div>`;
        });
    }

    if (dirEl) dirEl.innerHTML = html;

    if (phoneDirEl) {
        let phtml = '';
        if (facilities.length === 0) {
            phtml = `<div style="padding: 36px 16px; text-align: center; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                <div style="font-size: 28px; margin-bottom: 8px;">🌿</div>
                <div style="font-weight: 600; color: #e2e8f0; margin-bottom: 4px;">DA-RARES Tanay Campus Active</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Traced buildings from the Building Drawer will appear here.</div>
            </div>`;
        } else {
            facilities.forEach((fac) => {
                const num = fac.num;
                const name = fac.name;
                const sub = getRARESSubtitle(name, fac.description);
                const bId = fac.id;
                const centerCoords = fac.coords;

                phtml += `
                <div class="phone-dir-item" data-id="${bId}" onclick="flyToRARESFacility(${centerCoords[0]}, ${centerCoords[1]}, '${bId}'); if(window.setPhoneSheetSnap) window.setPhoneSheetSnap('half');" style="cursor: pointer;">
                    <div class="phone-dir-badge" style="background: rgba(16, 185, 129, 0.18); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-weight: 800;">
                        ${num}
                    </div>
                    <div class="phone-dir-info">
                        <div class="phone-dir-name">${name}</div>
                        <div class="phone-dir-sub">${sub}</div>
                    </div>
                    <div class="phone-dir-arrow">›</div>
                </div>`;
            });
        }
        phoneDirEl.innerHTML = phtml;
    }

    // Trigger map pill markers creation for RARES
    if (typeof window.createMarkers === 'function') {
        window.createMarkers();
    }
}

export function filterRARESSearch(query = '') {
    if (!raresBuildingsBaseline) {
        renderRARESDirectory();
        return;
    }
    const lower = query.toLowerCase().trim();
    if (!lower) {
        renderRARESDirectory(raresBuildingsBaseline, 'all', false);
        return;
    }
    const allGrouped = getGroupedRARESFacilities(raresBuildingsBaseline);
    const filtered = allGrouped.filter(fac => {
        const name = (fac.name || '').toLowerCase();
        const id = (fac.id || '').toLowerCase();
        const cat = (fac.category || '').toLowerCase();
        const numStr = String(fac.num);
        const aliases = RARES_SEARCH_ALIASES[name] || [];
        const matchesAlias = aliases.some(a => a.includes(lower));
        return name.includes(lower) || id.includes(lower) || cat.includes(lower) || numStr === lower || matchesAlias;
    });
    renderRARESDirectory(raresBuildingsBaseline, 'all', true, filtered);
}

export function flyToRARESFacility(lng, lat, id) {
    if (!map) return;
    map.flyTo({
        center: [lng, lat],
        zoom: 19.0,
        pitch: 45,
        essential: true
    });
    if (id) {
        const baseId = id.split('.')[0];
        document.querySelectorAll('#directory .dir-item').forEach(el => {
            const isMatch = (el.dataset.id === id || el.dataset.id === baseId);
            el.classList.toggle('active', isMatch);
            if (isMatch) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        document.querySelectorAll('#phone-directory-list .phone-dir-item').forEach(el => {
            const isMatch = (el.dataset.id === id || el.dataset.id === baseId);
            el.classList.toggle('active', isMatch);
        });
    }
}

export function loadRARESData() {
    if (!map) return;
    const isDrone = (state.currentMapStyleMode === 'google');
    const isMapbox = (state.currentMapStyleMode === 'mapbox');
    const bndVis = state.boundaryVisible !== false ? 'visible' : 'none';
    const bndShadowVis = (!isMapbox && state.boundaryVisible !== false) ? 'visible' : 'none';

    // 0. Ensure structural QARES and LARES layers are turned OFF
    ['lares-3d-models-layer', 'lares-3d-models-transparent', 'qares-3d-models-layer', 'qares-3d-models-transparent', 'qares-footprints-3d', 'qares-footprints-roofs', 'qares-boundary-fill', 'qares-boundary-line', 'qares-boundary-glow', 'qares-boundary-casing', 'qares-railway-ballast', 'qares-railway-sleepers', 'qares-railway-rail-left', 'qares-railway-rail-right', 'qares-mask-layer', 'qares-ortho-layer'].forEach(id => {
        if (map.getLayer(id)) {
            try { map.setLayoutProperty(id, 'visibility', 'none'); } catch (e) { }
        }
    });
    if (map.getLayer('lares-mask-layer')) {
        try { map.setLayoutProperty('lares-mask-layer', 'visibility', 'none'); } catch (e) { }
    }
    if (map.getLayer('lares-drone-layer')) {
        try { map.setLayoutProperty('lares-drone-layer', 'visibility', 'none'); } catch (e) { }
    }
    if (map.getLayer('google-satellite-layer')) {
        try { map.setLayoutProperty('google-satellite-layer', 'visibility', isDrone ? 'visible' : 'none'); } catch (e) { }
    }

    // 1. High-Resolution RARES Drone Orthomosaic Layer (Offline MBTiles, Zooms 14-21)
    const styleLayers = map.getStyle()?.layers;
    const isMiddleSlot = (id) => Array.isArray(styleLayers) && styleLayers.some(l => l.id === id && l.slot === 'middle');
    const bldgsModelBeforeId = isMiddleSlot('rares-3d-models-layer')
        ? 'rares-3d-models-layer'
        : (isMiddleSlot('3d-buildings-models-layer') ? '3d-buildings-models-layer' : undefined);
    try {
        if (!map.getSource('rares-drone-source')) {
            map.addSource('rares-drone-source', {
                type: 'raster',
                tiles: [
                    '/api/tiles/rares/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                minzoom: 14,
                maxzoom: 21,
                bounds: [121.3366, 14.5727, 121.3421, 14.5773]
            });
        }
        if (!map.getLayer('rares-ortho-layer') && map.getSource('rares-drone-source')) {
            map.addLayer({
                id: 'rares-ortho-layer',
                type: 'raster',
                source: 'rares-drone-source',
                slot: 'bottom',
                layout: {
                    'visibility': isDrone ? 'visible' : 'none'
                },
                paint: {
                    'raster-opacity': 1.0,
                    'raster-fade-duration': 0
                }
            });
        } else if (map.getLayer('rares-ortho-layer')) {
            try { map.setLayoutProperty('rares-ortho-layer', 'visibility', isDrone ? 'visible' : 'none'); } catch (e) { }
        }
    } catch (e) {
        console.warn('[RARES] Ortho source/layer notice:', e);
    }

    // 2. Dark Vignette / Boundary Mask (Isolates DA-RARES compound in 3D dark void space)
    try {
        if (!map.getSource('rares-mask-source')) {
            map.addSource('rares-mask-source', {
                type: 'geojson',
                data: RARES_MASK
            });
        }
        const showRaresMask = !isMapbox && (state.currentStationId === 'rares');
        if (!map.getLayer('rares-mask-layer') && map.getSource('rares-mask-source')) {
            map.addLayer({
                id: 'rares-mask-layer',
                type: 'fill',
                source: 'rares-mask-source',
                slot: 'middle',
                layout: {
                    'visibility': showRaresMask ? 'visible' : 'none'
                },
                paint: {
                    'fill-color': '#0b1121',
                    'fill-opacity': 1.0
                }
            }, bldgsModelBeforeId);
        } else if (map.getLayer('rares-mask-layer')) {
            try {
                map.setLayoutProperty('rares-mask-layer', 'visibility', showRaresMask ? 'visible' : 'none');
                map.setPaintProperty('rares-mask-layer', 'fill-color', '#0b1121');
                map.setPaintProperty('rares-mask-layer', 'fill-opacity', 1.0);
            } catch (e) { }
        }
    } catch (e) {
        console.warn('[RARES] Mask layer notice:', e);
    }

    // 3. RARES Compound Official Boundary Outline (Dissolved single outer perimeter)
    try {
        if (!map.getSource('rares-boundary-source')) {
            map.addSource('rares-boundary-source', {
                type: 'geojson',
                data: 'rares_boundary.json'
            });
        }

        // 3a. Subtle interior green fill
        if (!map.getLayer('rares-boundary-fill') && map.getSource('rares-boundary-source')) {
            map.addLayer({
                id: 'rares-boundary-fill',
                type: 'fill',
                source: 'rares-boundary-source',
                slot: 'middle',
                filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
                layout: { 'visibility': bndVis },
                paint: {
                    'fill-color': '#22c55e',
                    'fill-opacity': 0.06
                }
            }, bldgsModelBeforeId);
        } else if (map.getLayer('rares-boundary-fill')) {
            try { map.setLayoutProperty('rares-boundary-fill', 'visibility', bndVis); } catch (e) { }
        }

        // 3b. Soft ambient grass green glow
        if (!map.getLayer('rares-boundary-glow') && map.getSource('rares-boundary-source')) {
            map.addLayer({
                id: 'rares-boundary-glow',
                type: 'line',
                source: 'rares-boundary-source',
                slot: 'middle',
                filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                    'visibility': bndShadowVis
                },
                paint: {
                    'line-color': '#4ade80',
                    'line-width': 10,
                    'line-blur': 4,
                    'line-opacity': 0.35
                }
            }, bldgsModelBeforeId);
        } else if (map.getLayer('rares-boundary-glow')) {
            try { map.setLayoutProperty('rares-boundary-glow', 'visibility', bndShadowVis); } catch (e) { }
        }

        // 3c. Dark forest green outer protective casing
        if (!map.getLayer('rares-boundary-casing') && map.getSource('rares-boundary-source')) {
            map.addLayer({
                id: 'rares-boundary-casing',
                type: 'line',
                source: 'rares-boundary-source',
                slot: 'middle',
                filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                    'visibility': bndShadowVis
                },
                paint: {
                    'line-color': '#14532d',
                    'line-width': 5.5,
                    'line-opacity': 0.85
                }
            }, bldgsModelBeforeId);
        } else if (map.getLayer('rares-boundary-casing')) {
            try { map.setLayoutProperty('rares-boundary-casing', 'visibility', bndShadowVis); } catch (e) { }
        }

        // 3d. Crisp unified neon green perimeter line
        if (!map.getLayer('rares-boundary-line') && map.getSource('rares-boundary-source')) {
            map.addLayer({
                id: 'rares-boundary-line',
                type: 'line',
                source: 'rares-boundary-source',
                slot: 'middle',
                filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
                layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                    'visibility': bndVis
                },
                paint: {
                    'line-color': '#22c55e',
                    'line-width': 3.0,
                    'line-opacity': 0.95
                }
            }, bldgsModelBeforeId);
        } else if (map.getLayer('rares-boundary-line')) {
            try { map.setLayoutProperty('rares-boundary-line', 'visibility', bndVis); } catch (e) { }
        }
    } catch (e) {
        console.warn('[RARES] Boundary layers notice:', e);
    }

    // 4. Dynamically fetch rares_boundary.json to guarantee realtime boundary & mask alignment
    try {
        fetch('rares_boundary.json?t=' + Date.now())
            .then(r => r.json())
            .then(bndData => {
                if (!bndData || !bndData.features || !bndData.features[0]) return;
                if (map && map.getSource('rares-boundary-source')) {
                    try { map.getSource('rares-boundary-source').setData(bndData); } catch (e) { }
                }
                const coords = bndData.features[0].geometry.coordinates[0];
                if (coords && map && map.getSource('rares-mask-source')) {
                    const dynamicMask = {
                        type: 'FeatureCollection',
                        features: [{
                            type: 'Feature',
                            geometry: {
                                type: 'Polygon',
                                coordinates: [
                                    [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
                                    coords
                                ]
                            },
                            properties: { station: 'rares' }
                        }]
                    };
                    try { map.getSource('rares-mask-source').setData(dynamicMask); } catch (e) { }
                }
            })
            .catch(e => console.warn('[RARES] Dynamic boundary sync notice:', e));
    } catch (e) { }

    // 5. Check if buildings exist in rares_buildings.json and hydrate live MySQL overrides
    renderRARESDirectory();
    Promise.all([
        fetch('rares_buildings.json?v=' + Date.now()).then(r => r.json()),
        fetch(`/api/bootstrap?station=rares&_t=${Date.now()}`).then(r => r.ok ? r.json() : null).catch(() => null)
    ])
        .then(([data, boot]) => {
            if (data && data.features && boot && Array.isArray(boot.buildings)) {
                const byCode = new Map();
                boot.buildings.forEach(b => {
                    if (b && b.building_code) byCode.set(b.building_code, b);
                });
                data.features.forEach(f => {
                    const p = f.properties || {};
                    const dbBldg = byCode.get(p.id);
                    if (dbBldg) {
                        if (dbBldg.name) p.name = dbBldg.name;
                        if (dbBldg.description !== undefined && dbBldg.description !== null) p.description = dbBldg.description;
                        if (dbBldg.category) p.category = dbBldg.category;
                        if (dbBldg.type_label) p.type = dbBldg.type_label;
                        if (dbBldg.pin_color) p.color = dbBldg.pin_color;
                        if (dbBldg.icon) p.icon = dbBldg.icon;
                        if (Array.isArray(dbBldg.images) && dbBldg.images.length > 0) {
                            p.image = dbBldg.images[0].image_webp_url;
                            p.images = dbBldg.images.map(img => ({
                                src: img.image_webp_url,
                                label: img.caption || 'Facility View'
                            }));
                        }
                    }
                });
            }
            if (data && data.features) {
                raresBuildingsBaseline = data;
                renderRARESDirectory(data);
            }
            if (!map || !data || !data.features || data.features.length === 0) return;
            // When user traces buildings, mount them cleanly
            if (!map.getSource('rares-footprints-source')) {
                map.addSource('rares-footprints-source', { type: 'geojson', data: data });
            } else {
                map.getSource('rares-footprints-source').setData(data);
            }
            const bldgVis = state.buildingsVisible !== false ? 'visible' : 'none';
            if (!map.getLayer('rares-footprints-3d') && map.getSource('rares-footprints-source')) {
                map.addLayer({
                    id: 'rares-footprints-3d',
                    type: 'fill-extrusion',
                    source: 'rares-footprints-source',
                    slot: 'middle',
                    filter: ['!=', ['get', 'has_3d_model'], true],
                    layout: { 'visibility': bldgVis },
                    paint: {
                        'fill-extrusion-color': '#d4d8de',
                        'fill-extrusion-height': ['coalesce', ['get', 'height'], 5],
                        'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
                        'fill-extrusion-opacity': 0.95
                    }
                }, bldgsModelBeforeId);
            } else if (map.getLayer('rares-footprints-3d')) {
                try {
                    map.setFilter('rares-footprints-3d', ['!=', ['get', 'has_3d_model'], true]);
                    map.setLayoutProperty('rares-footprints-3d', 'visibility', bldgVis);
                } catch (e) {}
            }
            if (typeof setupStation3DModels === 'function') {
                setupStation3DModels(map, 'rares', (state.currentMapStyleMode === 'mapbox'));
            }

            // 6. Mount RARES Agricultural Plots (toggleable via Map Settings -> Agricultural Plots)
            const plotVis = state.plotsVisible === true ? 'visible' : 'none';
            if (!map.getSource('rares-plots-source')) {
                map.addSource('rares-plots-source', {
                    type: 'geojson',
                    data: 'rares_plots.json'
                });
            }
            if (!map.getLayer('rares-plots-fill') && map.getSource('rares-plots-source')) {
                map.addLayer({
                    id: 'rares-plots-fill',
                    type: 'fill',
                    source: 'rares-plots-source',
                    slot: 'middle',
                    layout: { 'visibility': plotVis },
                    paint: {
                        'fill-color': [
                            'match',
                            ['get', 'category'],
                            'Infrastructure', '#38bdf8',
                            'Crop', '#22c55e',
                            'Orchard', '#eab308',
                            '#10b981'
                        ],
                        'fill-opacity': 0.18
                    }
                }, bldgsModelBeforeId);
            } else if (map.getLayer('rares-plots-fill')) {
                try { map.setLayoutProperty('rares-plots-fill', 'visibility', plotVis); } catch (e) {}
            }

            if (!map.getLayer('rares-plots-line') && map.getSource('rares-plots-source')) {
                map.addLayer({
                    id: 'rares-plots-line',
                    type: 'line',
                    source: 'rares-plots-source',
                    slot: 'middle',
                    layout: { 'visibility': plotVis },
                    paint: {
                        'line-color': '#10b981',
                        'line-width': 1.8,
                        'line-dasharray': [2, 1]
                    }
                }, bldgsModelBeforeId);
            } else if (map.getLayer('rares-plots-line')) {
                try { map.setLayoutProperty('rares-plots-line', 'visibility', plotVis); } catch (e) {}
            }

            // Guarantee 3D architectural models sit strictly above all ground rasters, footprints, and plots
            ['rares-3d-models-layer', 'rares-3d-models-transparent', '3d-buildings-models-layer', '3d-buildings-models-transparent'].forEach(lid => {
                safeMoveLayer(map, lid);
            });

            if (typeof window.createMarkers === 'function') {
                window.createMarkers();
            }
        })
        .catch(() => {
            renderRARESDirectory();
        });

    // Ensure Kiosk "You Are Here" pin is mounted
    if (typeof createKioskMarker === 'function') {
        createKioskMarker();
    }
}

// Station Category Bar Renderer (Syncs Desktop & Mobile)
// Station Category Bar Renderer (Syncs Desktop & Mobile)
export function renderStationCategoryBar(stationId) {
    const catBar = document.getElementById('kiosk-categories-bar');
    const phoneCatBar = document.getElementById('phone-categories-bar');
    const quickTags = document.getElementById('kiosk-quick-tags');

    // Category filter chips are removed for now; 3D buildings are fully retained
    if (catBar) {
        catBar.innerHTML = '';
        catBar.style.display = 'none';
    }
    if (phoneCatBar) {
        phoneCatBar.innerHTML = '';
        phoneCatBar.style.display = 'none';
    }
    if (quickTags) {
        const tags = STATIONS[stationId]?.quickTags;
        quickTags.style.display = (Array.isArray(tags) && tags.length > 0) ? 'flex' : 'none';
    }
}

// QARES Directory & Categorization State
let qaresBuildingsBaseline = null;
let activeQARESCategory = 'Buildings';

export function filterQARESByCategory(cat) {
    activeQARESCategory = cat || 'Buildings';
    const searchVal = (document.getElementById('search-input')?.value || document.getElementById('phone-search-input')?.value || '').trim();
    if (searchVal) {
        filterQARESSearch(searchVal);
    } else if (qaresBuildingsBaseline) {
        renderQARESDirectory(qaresBuildingsBaseline, activeQARESCategory);
    }

    // Retain all 3D building models and footprints on the map
    if (map) {
        ['qares-footprints-3d', 'qares-footprints-roofs'].forEach(id => {
            if (map.getLayer(id)) {
                try { map.setFilter(id, null); } catch (e) { }
            }
        });
        if (map.getLayer('qares-footprints-3d')) {
            map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-color', '#d4d8de');
            map.setPaintProperty('qares-footprints-3d', 'fill-extrusion-opacity', 0.95);
        }
        if (map.getLayer('qares-footprints-roofs')) {
            map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-color', ['coalesce', ['get', 'roof_color'], ['get', 'color'], '#dc2626']);
            map.setPaintProperty('qares-footprints-roofs', 'fill-extrusion-opacity', 1.0);
        }
    }
}

const QARES_SEARCH_ALIASES = {
    'rp vehicle garage': ['republic of the philippines (rp) government vehicle garage'],
    'embryo tissue culture laboratory': ['tc laboratory', 'etc laboratory'],
    'planting material production unit office': ['pmpu office', 'pmpu'],
    'qares livestock unit': ['quezon agricultural research and experiment station (qares) livestock unit'],
    'quezon agricultural programs coordinating office': ['qapco', 'apco'],
    'bsf facility': ['black soldier fly (bsf) facility']
};

export function filterQARESSearch(query = '') {
    if (!qaresBuildingsBaseline) return;
    const q = query.trim().toLowerCase();
    const filtered = {
        ...qaresBuildingsBaseline,
        features: (qaresBuildingsBaseline.features || []).filter(f => {
            const p = f.properties || {};
            const name = (p.name || '').toLowerCase();
            const id = (p.id || '').toLowerCase();
            const cat = (p.filter_type || p.category || 'Buildings').toLowerCase();
            const colorCode = (p.color_code || '').toLowerCase();
            const aliases = QARES_SEARCH_ALIASES[name] || [];
            const matchesAlias = q && aliases.some(a => a.includes(q));
            const matchesText = !q || name.includes(q) || id.includes(q) || cat.includes(q) || colorCode.includes(q) || matchesAlias;
            const matchesCat = (activeQARESCategory === 'all') || ((p.filter_type || p.category || 'Buildings') === activeQARESCategory);
            return matchesText && matchesCat;
        })
    };
    renderQARESDirectory(filtered, activeQARESCategory, true);
}

// Helper: Contextual Functional Subtitle for QARES Facilities (matching LARES format)
function getQARESSubtitle(name, desc) {
    if (desc && desc.trim()) return desc;
    const n = (name || '').toLowerCase();
    if (n.includes('guard')) return 'Main Entrance Security & Gate Access';
    if (n.includes('info') || n.includes('hub')) return 'Visitor Information & Reception Center';
    if (n.includes('admin')) return 'Administrative & Executive Services';
    if (n.includes('research') || n.includes('center')) return 'Agricultural Research & Development Division';
    if (n.includes('lab') || n.includes('tissue') || n.includes('embryo') || n.includes('wine')) return 'Specialized Crop Research & Analytical Lab';
    if (n.includes('garage') || n.includes('motorpool')) return 'Transportation & Vehicle Maintenance Bay';
    if (n.includes('guest')) return 'Staff & Visitor Quarters';
    if (n.includes('conference') || n.includes('court') || n.includes('hall')) return 'Conference & Assembly Facility';
    if (n.includes('livestock') || n.includes('goat') || n.includes('chicken') || n.includes('pen') || n.includes('barn') || n.includes('egg') || n.includes('grower') || n.includes('brooder') || n.includes('pullet')) return 'Livestock Research & Breeding Facility';
    if (n.includes('storage') || n.includes('bodega') || n.includes('storehouse') || n.includes('fertilizer') || n.includes('silage')) return 'Agricultural Storage & Warehouse Facility';
    if (n.includes('nursery') || n.includes('production') || n.includes('makapuno')) return 'Planting Materials & Crop Production Unit';
    if (n.includes('organic') || n.includes('compost') || n.includes('bsf')) return 'Organic Agriculture & Bio-Resource Facility';
    return 'QARES Agricultural Facility';
}

export function renderQARESDirectory(data, filterCat = 'Buildings', isPreFiltered = false) {
    if (!isPreFiltered) qaresBuildingsBaseline = data;
    if (typeof window !== 'undefined') window.qaresBuildingsBaseline = data;

    const dirEl = document.getElementById('directory');
    const phoneDirEl = document.getElementById('phone-directory-list');

    // Color definitions for badges matching QARES color palette with subtle shade depths
    const QARES_COLORS_DEF = {
        red: { name: 'Red', hex: '#ef4444', bg: 'rgba(239, 68, 68, 0.22)', border: 'rgba(239, 68, 68, 0.45)' },
        blue: { name: 'Blue', hex: '#3b82f6', bg: 'rgba(59, 130, 246, 0.22)', border: 'rgba(59, 130, 246, 0.45)' },
        green: { name: 'Green', hex: '#22c55e', bg: 'rgba(34, 197, 94, 0.22)', border: 'rgba(34, 197, 94, 0.45)' },
        yellow: { name: 'Yellow', hex: '#eab308', bg: 'rgba(234, 179, 8, 0.22)', border: 'rgba(234, 179, 8, 0.45)' },
        light_grey: { name: 'Light Grey', hex: '#94a3b8', bg: 'rgba(148, 163, 184, 0.22)', border: 'rgba(148, 163, 184, 0.45)' },
        pink: { name: 'Pink', hex: '#ec4899', bg: 'rgba(236, 72, 153, 0.22)', border: 'rgba(236, 72, 153, 0.45)' },
        brown: { name: 'Brown', hex: '#b45309', bg: 'rgba(180, 83, 9, 0.22)', border: 'rgba(180, 83, 9, 0.45)' }
    };

    const allFeatures = data.features || [];
    // Retain Buildings part in QARES directory list
    const features = isPreFiltered ? allFeatures : allFeatures.filter(f => {
        if (filterCat === 'all') return true;
        const cat = f.properties.filter_type || f.properties.category || 'Buildings';
        return cat === filterCat;
    });

    if (dirEl) {
        const headerTitle = isPreFiltered ? `QARES SEARCH (${features.length})` : `QARES BUILDINGS (${features.length})`;
        let html = `<div class="dir-section-header" style="padding: 12px 16px 8px; font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; display:flex; justify-content:space-between; align-items:center;">
            <span>${headerTitle}</span>
            <span style="font-size:10px; color:#38bdf8; font-weight:600;">Tiaong, Quezon</span>
        </div>`;

        if (features.length === 0) {
            html += `<div style="padding: 36px 16px; text-align: center; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                <div style="margin-bottom: 8px;">${lucideIcon('folder-open', 28)}</div>
                No facilities found.
            </div>`;
        } else {
            features.forEach((f, idx) => {
                const props = f.properties || {};
                const num = idx + 1;
                const name = props.name || props.id || `Facility ${num}`;
                const cKey = props.color_code || 'red';
                const shade = props.color || props.roof_color || (QARES_COLORS_DEF[cKey] ? QARES_COLORS_DEF[cKey].hex : '#ef4444');
                const badgeBg = `${shade}26`;
                const badgeBorder = `${shade}55`;

                let centerCoords = [121.37152, 13.94609];
                if (f.geometry && f.geometry.type === 'Polygon' && f.geometry.coordinates && f.geometry.coordinates[0]) {
                    const ring = f.geometry.coordinates[0];
                    let sumLng = 0, sumLat = 0;
                    ring.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
                    centerCoords = [sumLng / ring.length, sumLat / ring.length];
                }

                const subText = getQARESSubtitle(name, props.desc);

                html += `
                    <div class="dir-item" data-id="${props.id || `qares_${num}`}" onclick="navigateTo('${props.id || `qares_${num}`}');">
                        <div class="dir-item-icon" style="background:${badgeBg}; color:${shade}; border:1px solid ${badgeBorder};">
                            <span class="dir-item-icon-number">${num}</span>
                        </div>
                        <div class="dir-item-info">
                            <div class="dir-item-name">${name}</div>
                            <div class="dir-item-desc">${subText}</div>
                        </div>
                        <div class="dir-item-arrow">→</div>
                    </div>
                `;
            });
        }
        dirEl.innerHTML = html;
    }

    if (phoneDirEl) {
        let phtml = '';
        if (features.length === 0) {
            phtml = `<div style="padding: 36px 16px; text-align: center; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                <div style="margin-bottom: 8px;">${lucideIcon('folder-open', 28)}</div>
                No facilities found.
            </div>`;
        } else {
            features.forEach((f, idx) => {
                const props = f.properties || {};
                const name = props.name || props.id || `Facility ${idx + 1}`;
                const cKey = props.color_code || 'red';
                const shade = props.color || props.roof_color || (QARES_COLORS_DEF[cKey] ? QARES_COLORS_DEF[cKey].hex : '#ef4444');
                const num = idx + 1;

                let centerCoords = [121.37152, 13.94609];
                if (f.geometry && f.geometry.type === 'Polygon' && f.geometry.coordinates && f.geometry.coordinates[0]) {
                    const ring = f.geometry.coordinates[0];
                    let sumLng = 0, sumLat = 0;
                    ring.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
                    centerCoords = [sumLng / ring.length, sumLat / ring.length];
                }

                const subText = getQARESSubtitle(name, props.desc);

                phtml += `
                    <div class="phone-dir-item" data-id="${props.id || `qares_${num}`}" onclick="navigateTo('${props.id || `qares_${num}`}'); if(window.setPhoneSheetSnap) window.setPhoneSheetSnap('half');" style="cursor: pointer;">
                        <div class="phone-dir-badge" style="background:${shade}22; color:${shade}; border:1px solid ${shade}44; font-weight:800;">
                            ${num}
                        </div>
                        <div class="phone-dir-info">
                            <div class="phone-dir-name">${name}</div>
                            <div class="phone-dir-sub">${subText}</div>
                        </div>
                        <div class="phone-dir-arrow">›</div>
                    </div>
                `;
            });
        }
        phoneDirEl.innerHTML = phtml;
    }

    // Trigger map pill markers creation for QARES
    if (typeof window.createMarkers === 'function') {
        window.createMarkers();
    }
}

// Global reflections for inline HTML
if (typeof window !== 'undefined') {
    window.loadQARESData = loadQARESData;
    window.loadRARESData = loadRARESData;
    window.renderRARESDirectory = renderRARESDirectory;
    window.getGroupedRARESFacilities = getGroupedRARESFacilities;
    window.getRARESSubtitle = getRARESSubtitle;
    window.toggleStationDropdown = toggleStationDropdown;
    window.closeStationDropdown = closeStationDropdown;
    window.switchResearchStation = switchResearchStation;
    window.performStationSwitch = performStationSwitch;
    window.initStationSelector = initStationSelector;
    window.renderStationCategoryBar = renderStationCategoryBar;
    window.filterQARESByCategory = filterQARESByCategory;
    window.filterQARESSearch = filterQARESSearch;
    window.renderQARESDirectory = renderQARESDirectory;
    window.filterRARESSearch = filterRARESSearch;
    window.flyToRARESFacility = flyToRARESFacility;
    window.flyToQARESFacility = function (lng, lat, id) {
        if (!map) return;
        map.flyTo({
            center: [lng, lat],
            zoom: 18.5,
            pitch: 52,
            essential: true
        });
        if (id) {
            document.querySelectorAll('#directory .dir-item').forEach(el => {
                const isMatch = (el.dataset.id === id);
                el.classList.toggle('active', isMatch);
                if (isMatch) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
            document.querySelectorAll('.bldg-map-marker').forEach(el => {
                el.classList.toggle('active', el.dataset.id === id);
            });
        }
    };
    window.openPhoneStationModal = openPhoneStationModal;
    window.closePhoneStationModal = closePhoneStationModal;
    window.handlePhoneSelectStation = handlePhoneSelectStation;
    window.isDeployedMode = isDeployedMode;
    window.showStationDevModal = showStationDevModal;
    window.closeStationDevModal = closeStationDevModal;
    window.proceedToDevStationPreview = proceedToDevStationPreview;
}

export function showStationDevModal(stationId) {
    const st = STATIONS[stationId] || { name: stationId, label: stationId, sub: 'Regional Research Station', province: 'CALABARZON' };
    const modal = document.getElementById('station-dev-modal');
    if (!modal) return;

    const titleEl = document.getElementById('station-dev-title');
    const subEl = document.getElementById('station-dev-sub');
    const previewBtn = document.getElementById('station-dev-preview-btn');

    if (titleEl) titleEl.textContent = `${st.name} (${st.province || st.sub})`;
    if (subEl) subEl.textContent = st.fullName || st.sub;

    if (previewBtn) {
        // In local development or admin mode (?admin=1), allow exploring preview
        const isDev = !isDeployedMode();
        const isAdmin = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === '1');
        previewBtn.style.display = (isDev || isAdmin) ? 'inline-flex' : 'none';
        previewBtn.dataset.targetStation = stationId;
        previewBtn.innerHTML = `<span>${isDev ? 'Explore Station (Dev)' : 'Explore Preview (Admin)'}</span>`;
    }

    modal.style.display = 'flex';
}

export function closeStationDevModal(event) {
    if (event && event.target && event.target.id !== 'station-dev-modal' && !event.target.closest('.station-dev-close-btn') && !event.target.classList.contains('station-dev-btn')) {
        return;
    }
    const modal = document.getElementById('station-dev-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

export function proceedToDevStationPreview() {
    const previewBtn = document.getElementById('station-dev-preview-btn');
    const stationId = previewBtn ? previewBtn.dataset.targetStation : null;
    closeStationDevModal();
    if (stationId && typeof performStationSwitch === 'function') {
        performStationSwitch(stationId);
    }
}

export function openPhoneStationModal() {
    const modal = document.getElementById('phone-station-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

export function closePhoneStationModal(event) {
    if (event && event.target && event.target.id !== 'phone-station-modal' && !event.target.classList.contains('phone-station-modal-close')) {
        return;
    }
    const modal = document.getElementById('phone-station-modal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 220);
    }
}

export function handlePhoneSelectStation(stationId) {
    closePhoneStationModal();
    if (typeof switchResearchStation === 'function') {
        switchResearchStation(stationId);
    }
    if (typeof window.setPhoneSheetSnap === 'function') {
        window.setPhoneSheetSnap('peek');
    }
}

