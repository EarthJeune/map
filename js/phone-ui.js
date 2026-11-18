// DA-LARES Wayfinding — Phone UI & Bottom Sheet Module



import { DEFAULT_MAP_VIEW } from './data/config.js';

import { getActiveStationDefaultView, STATIONS } from './data/stations.js';

import { BUILDING_DIRECTORY, DEFAULT_BUILDING_COLORS, STANDALONE_GATES, getBuildingById } from './data/buildings.js';

import { renderBuildingOfficesHTML, getFlatBuildingOffices, isOfficeMatched, findMatchedOffice, getOfficeSearchSubtitle, isBuildingMatched, getBuildingSearchSubtitle, isPlotZoneMatched, matchesSearchText } from './data/offices.js';

import { getBuildingWayfindingInfo } from './data/descriptions.js';

import { FIELD_COMMODITY_ZONES } from './data/plots.js';
import { lucideIcon, renderIconOrText } from './data/icons.js';

import { activeTypeFilters, EMBEDDED_CONFERENCE_HALLS, toggleTypeFilter, resetTypeFilters, updateFilterDropdownUI, isNavigationActive } from './sidebar.js';

import { deselectPlotZone, clearSubPlotHighlight, zoomToSubPlot, selectPlotZone } from './plot-layers.js';

import { selectStandaloneGate } from './markers.js';

import { state } from './data/state.js';

import { map } from './map-setup.js';

import { clearRoute } from './routing.js';

import {

    requestUserInitialLocation,

    requestDeviceOrientationPermission,

    stopPhoneLiveGPS

} from './gps.js';

import { orbitBuilding, stopOrbit } from './idle.js';

import { stopIntroAnimation } from './map-setup.js';



import {

    isPhoneMode,

    isKioskMode,

    isPortraitKiosk,

    detectAppMode,

    detectKioskOrientation

} from './mode.js';



export { isPhoneMode, isKioskMode, isPortraitKiosk };



export function isMobileDevice() {

    return isPhoneMode() || /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);

}



export function getResponsiveMapPadding() {

    const isMobile = isPhoneMode();

    const isPortrait = isPortraitKiosk();

    const isSidebarCollapsed = document.getElementById('sidebar')?.classList.contains('collapsed');



    if (isMobile) {

        return { top: 90, bottom: 240, left: 24, right: 24 };

    } else if (isPortrait) {

        // Portrait kiosk: map is top 58vh, no left sidebar offset

        return { top: 80, bottom: 40, left: 40, right: 40 };

    } else {

        const sidePad = isSidebarCollapsed ? 90 : 420;

        return { top: 80, bottom: 80, left: sidePad, right: 90 };

    }

}



// --- High-Contrast Text Color for Badges ---

export function getContrastTextColor(hexColor) {

    if (!hexColor || typeof hexColor !== 'string') return '#ffffff';

    let hex = hexColor.replace('#', '');

    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');

    if (hex.length !== 6) return '#ffffff';

    const r = parseInt(hex.substring(0, 2), 16) || 0;

    const g = parseInt(hex.substring(2, 4), 16) || 0;

    const b = parseInt(hex.substring(4, 6), 16) || 0;

    const yiq = (r * 299 + g * 587 + b * 114) / 1000;

    return yiq >= 150 ? '#0f172a' : '#ffffff';

}



export function showMobileToast(text, duration = 3500) {

    const toast = document.getElementById('mobile-gps-toast');

    const textEl = document.getElementById('mobile-gps-toast-text');

    if (!toast || !textEl) return;

    textEl.textContent = text;

    toast.classList.add('visible');

    setTimeout(() => toast.classList.remove('visible'), duration);

}



export function setPhoneSheetSnap(snap) {

    const sheet = document.getElementById('phone-bottom-sheet');

    const camControls = document.getElementById('floating-camera-controls');

    if (!sheet) return;

    sheet.classList.remove('snap-peek', 'snap-half', 'snap-full', 'is-dragging', 'dragging');

    sheet.style.transform = '';

    sheet.style.height = '';

    sheet.classList.add('snap-' + snap);

    state.phoneSheetCurrentSnap = snap;



    if (camControls && isPhoneMode()) {
        if (snap === 'full' || snap === 'half') {
            camControls.classList.add('sheet-expanded-hidden');
            camControls.classList.add('sheet-full-hidden');
        } else {
            camControls.classList.remove('sheet-expanded-hidden');
            camControls.classList.remove('sheet-full-hidden');
        }
    }

}



export function cyclePhoneSheetSnap() {

    if (state.phoneSheetCurrentSnap === 'peek') setPhoneSheetSnap('half');

    else if (state.phoneSheetCurrentSnap === 'half') setPhoneSheetSnap('full');

    else setPhoneSheetSnap('peek');

}



export function togglePhoneRouteSheet() {

    if (state.phoneSheetCurrentSnap === 'peek') setPhoneSheetSnap('half');

    else setPhoneSheetSnap('peek');

}



export function setPhoneSheetView(viewName) {

    document.querySelectorAll('.sheet-view').forEach(v => v.classList.remove('active'));

    const target = document.getElementById('phone-view-' + viewName);

    if (target) target.classList.add('active');

    state.phoneSheetCurrentView = viewName;



    const sheet = document.getElementById('phone-bottom-sheet');

    if (sheet) {

        sheet.classList.toggle('bldg-active', viewName === 'bldg');

        if (viewName === 'route') {

            sheet.classList.add('route-active');

            document.body.classList.add('phone-nav-active');

        } else {

            sheet.classList.remove('route-active');

            document.body.classList.remove('phone-nav-active');

            const topHud = document.getElementById('phone-top-nav-hud');

            if (topHud) topHud.classList.remove('active');

        }

    }

}



export function initPhoneSheetGestures() {

    const sheet = document.getElementById('phone-bottom-sheet');

    if (!sheet || sheet.dataset.gesturesBound === '1') return;

    sheet.dataset.gesturesBound = '1';



    const SKIRT_PX = 40;

    const SCROLLABLE_SELECTOR = '.phone-directory-list, .phone-bldg-scrollable, .phone-route-scrollable';



    let pointerActive = false;

    let hasDraggedSheet = false;

    let gestureAxis = null;

    let startX = 0;

    let startY = 0;

    let dragAnchorY = 0;

    let anchorVisibleHeight = 0;

    let maxMovedPx = 0;

    let lastY = 0;

    let lastTime = 0;

    let velocityY = 0;

    let activeScrollEl = null;

    let startSnap = 'peek';

    let suppressNextClick = false;

    let lastTouchTimestamp = 0;

    let lastWheelSnapTime = 0;



    function getSafeBottomPx() {

        const s = getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom') || '';

        return parseInt(s, 10) || 0;

    }



    function getSnapHeights() {

        const vh = window.innerHeight;

        const safeBottom = getSafeBottomPx();

        let peekBase = 142;

        if (sheet.classList.contains('route-active')) peekBase = 124;

        else if (sheet.classList.contains('bldg-active')) peekBase = 92;

        const peek = peekBase + safeBottom;

        const half = Math.round(vh * 0.50);

        const measuredFull = (sheet.offsetHeight || 0) - SKIRT_PX;

        const full = measuredFull > half + 60 ? measuredFull : Math.round(vh * 0.92);

        return { peek, half, full, vh };

    }



    function getCurrentVisibleHeight() {

        const rect = sheet.getBoundingClientRect();

        return Math.max(0, window.innerHeight - rect.top);

    }



    function engageSheetDrag(clientY) {

        dragAnchorY = clientY;

        anchorVisibleHeight = getCurrentVisibleHeight();

        hasDraggedSheet = true;

        sheet.classList.add('is-dragging');

    }



    function onGestureStart(clientX, clientY, target, isTouch) {

        if (!target || target.closest('.phone-filter-dropdown')) return;

        if (!isTouch && target.closest('input, textarea, select')) return;



        pointerActive = true;

        hasDraggedSheet = false;

        gestureAxis = null;

        startX = clientX;

        startY = clientY;

        dragAnchorY = clientY;

        anchorVisibleHeight = getCurrentVisibleHeight();

        maxMovedPx = 0;

        lastY = clientY;

        lastTime = performance.now();

        velocityY = 0;

        activeScrollEl = target.closest(SCROLLABLE_SELECTOR);

        startSnap = state.phoneSheetCurrentSnap || 'peek';

    }



    function onGestureMove(clientX, clientY, rawEvent, isTouch) {

        if (!pointerActive) return;



        const dx = clientX - startX;

        const dy = clientY - startY;

        maxMovedPx = Math.max(maxMovedPx, Math.abs(dy));



        if (!gestureAxis) {

            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;

            if (Math.abs(dx) > Math.abs(dy) * 1.15) {

                gestureAxis = 'x';

                pointerActive = false;

                return;

            }

            gestureAxis = 'y';

        }



        if (!hasDraggedSheet) {

            const canScrollInner = (

                startSnap === 'full' &&

                activeScrollEl &&

                activeScrollEl.scrollHeight > activeScrollEl.clientHeight + 2

            );



            if (canScrollInner) {

                if (dy < 0) {

                    pointerActive = false;

                    return;

                }

                if (activeScrollEl.scrollTop > 1) {

                    lastY = clientY;

                    lastTime = performance.now();

                    return;

                }

                if (isTouch && rawEvent && !rawEvent.cancelable) {

                    return;

                }

            }



            engageSheetDrag(clientY);

        }



        if (rawEvent && rawEvent.cancelable) {

            rawEvent.preventDefault();

        }



        if (dy > 12) {

            const searchInput = document.getElementById('phone-search-input');

            if (searchInput && document.activeElement === searchInput) {

                searchInput.blur();

            }

        }



        const now = performance.now();

        const dt = now - lastTime;

        if (dt > 0) {

            const instV = (clientY - lastY) / dt;

            velocityY = velocityY * 0.35 + instV * 0.65;

            lastY = clientY;

            lastTime = now;

        }



        const snaps = getSnapHeights();

        const deltaUp = dragAnchorY - clientY;

        let visibleH = anchorVisibleHeight + deltaUp;



        if (visibleH < snaps.peek) {

            visibleH = snaps.peek - (snaps.peek - visibleH) * 0.22;

        } else if (visibleH > snaps.full) {

            visibleH = snaps.full + Math.min(28, (visibleH - snaps.full) * 0.18);

        }



        const fullH = Math.max(snaps.full, (sheet.offsetHeight || 0) - SKIRT_PX);

        const translateY = fullH - visibleH;

        sheet.style.transform = `translate3d(0, ${translateY.toFixed(1)}px, 0)`;

    }



    function onGestureEnd() {

        if (!pointerActive) return;

        pointerActive = false;



        if (!hasDraggedSheet) return;

        hasDraggedSheet = false;



        if (maxMovedPx > 6) {

            suppressNextClick = true;

            setTimeout(() => { suppressNextClick = false; }, 350);

        }



        if (performance.now() - lastTime > 90) {

            velocityY = 0;

        }



        const snaps = getSnapHeights();

        const currentVisible = getCurrentVisibleHeight();

        const movedUp = currentVisible - anchorVisibleHeight;



        let targetSnap = startSnap;



        if (velocityY < -1.1) {

            targetSnap = 'full';

        } else if (velocityY > 1.1) {

            targetSnap = 'peek';

        } else if (velocityY < -0.22) {

            targetSnap = (currentVisible < snaps.half - 10) ? 'half' : 'full';

        } else if (velocityY > 0.22) {

            targetSnap = (currentVisible > snaps.half + 10) ? 'half' : 'peek';

        } else if (movedUp > 46) {

            targetSnap = (startSnap === 'peek' && currentVisible < (snaps.half + snaps.full) * 0.5) ? 'half' : 'full';

        } else if (movedUp < -46) {

            targetSnap = (startSnap === 'full' && currentVisible > (snaps.peek + snaps.half) * 0.5) ? 'half' : 'peek';

        } else {

            const dPeek = Math.abs(currentVisible - snaps.peek);

            const dHalf = Math.abs(currentVisible - snaps.half);

            const dFull = Math.abs(currentVisible - snaps.full);

            if (dPeek <= dHalf && dPeek <= dFull) targetSnap = 'peek';

            else if (dHalf <= dPeek && dHalf <= dFull) targetSnap = 'half';

            else targetSnap = 'full';

        }



        setPhoneSheetSnap(targetSnap);

    }



    sheet.addEventListener('click', (e) => {

        if (suppressNextClick) {

            e.preventDefault();

            e.stopPropagation();

            suppressNextClick = false;

        }

    }, true);



    sheet.addEventListener('touchstart', (e) => {

        if (e.touches.length !== 1) return;

        lastTouchTimestamp = performance.now();

        const t = e.touches[0];

        onGestureStart(t.clientX, t.clientY, e.target, true);

    }, { passive: true });



    window.addEventListener('touchmove', (e) => {

        if (!pointerActive || e.touches.length !== 1) return;

        const t = e.touches[0];

        onGestureMove(t.clientX, t.clientY, e, true);

    }, { passive: false });



    window.addEventListener('touchend', onGestureEnd, { passive: true });

    window.addEventListener('touchcancel', onGestureEnd, { passive: true });



    sheet.addEventListener('mousedown', (e) => {

        if (e.button !== 0 || performance.now() - lastTouchTimestamp < 600) return;

        onGestureStart(e.clientX, e.clientY, e.target, false);

    });



    window.addEventListener('mousemove', (e) => {

        if (!pointerActive || performance.now() - lastTouchTimestamp < 600) return;

        onGestureMove(e.clientX, e.clientY, e, false);

    });



    window.addEventListener('mouseup', () => {

        if (performance.now() - lastTouchTimestamp < 600) return;

        onGestureEnd();

    });



    sheet.addEventListener('wheel', (e) => {

        const now = performance.now();

        if (now - lastWheelSnapTime < 360) return;

        const curSnap = state.phoneSheetCurrentSnap || 'peek';

        if (e.deltaY > 18 && curSnap !== 'full') {

            e.preventDefault();

            lastWheelSnapTime = now;

            setPhoneSheetSnap(curSnap === 'peek' ? 'half' : 'full');

        } else if (e.deltaY < -24 && curSnap === 'full') {

            const sc = e.target.closest(SCROLLABLE_SELECTOR);

            if (!sc || sc.scrollTop <= 0) {

                e.preventDefault();

                lastWheelSnapTime = now;

                setPhoneSheetSnap('half');

            }

        }

    }, { passive: false });



    const searchInput = document.getElementById('phone-search-input');

    if (searchInput) {

        searchInput.addEventListener('focus', () => {

            if (state.phoneSheetCurrentSnap !== 'full') {

                setPhoneSheetSnap('full');

            }

        });

    }

}



// --- Photo Gallery Mosaic & Lightbox Engine ---

export const BUILDING_PHOTOS = {

    'admin_building': ['images/admin_building.webp'],

    'automated_weather_station': ['images/automated_weather_station.webp']

};



export function renderPhoneBuildingGallery(buildingId) {

    const container = document.getElementById('phone-bldg-gallery-container');

    if (!container) return;



    const bldg = BUILDING_DIRECTORY.find(b => b.id === buildingId);

    const bldgName = bldg ? bldg.name : 'Building';



    let candidatePhotos = [];

    if (BUILDING_PHOTOS[buildingId] && BUILDING_PHOTOS[buildingId].length > 0) {

        candidatePhotos = [...BUILDING_PHOTOS[buildingId]];

    } else {

        const safeId = buildingId.replace(/\//g, '_');

        candidatePhotos = [`images/${safeId}.webp`];

    }



    const validImages = [];

    if (candidatePhotos.length === 0) {

        displayGalleryDOM([], bldgName);

        return;

    }



    let checked = 0;

    candidatePhotos.forEach(src => {

        const img = new Image();

        img.onload = () => {

            validImages.push(src);

            checked++;

            if (checked === candidatePhotos.length) {

                displayGalleryDOM(validImages, bldgName);

            }

        };

        img.onerror = () => {

            checked++;

            if (checked === candidatePhotos.length) {

                displayGalleryDOM(validImages, bldgName);

            }

        };

        img.src = src;

    });



    function displayGalleryDOM(images, name) {

        if (!container) return;

        if (images.length === 0) {

            container.innerHTML = `

                <div class="pbg-empty-card">

                    <div class="pbg-empty-icon">${lucideIcon('landmark', 28)}</div>

                    <div style="font-weight:700;color:#f1f5f9;font-size:14px;">${name}</div>

                    <div style="font-size:12px;color:#94a3b8;">Facility photos will be added in upcoming updates</div>

                </div>

            `;

            return;

        }



        if (images.length === 1) {

            container.innerHTML = `

                <div class="phone-bldg-gallery-grid single-photo" onclick="openPhotoLightbox('${images[0]}', '${name}')">

                    <div class="pbg-single-slot">

                        <img src="${images[0]}" alt="${name}">

                        <div class="pbg-badge-pill">${lucideIcon('camera', 12)} 1 Photo</div>

                    </div>

                </div>

            `;

        } else if (images.length === 2) {

            container.innerHTML = `

                <div class="phone-bldg-gallery-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:4px;height:180px;">

                    <div class="pbg-main-slot" onclick="openPhotoLightbox('${images[0]}', '${name} - View 1')">

                        <img src="${images[0]}" alt="${name} 1">

                    </div>

                    <div class="pbg-main-slot" onclick="openPhotoLightbox('${images[1]}', '${name} - View 2')">

                        <img src="${images[1]}" alt="${name} 2">

                    </div>

                    <div class="pbg-badge-pill">${lucideIcon('camera', 12)} 2 Photos</div>

                </div>

            `;

        } else {

            container.innerHTML = `

                <div class="phone-bldg-gallery-grid mosaic">

                    <div class="pbg-main-slot" onclick="openPhotoLightbox('${images[0]}', '${name} - Main View')">

                        <img src="${images[0]}" alt="${name} 1">

                    </div>

                    <div class="pbg-side-slots">

                        <div class="pbg-side-item" onclick="openPhotoLightbox('${images[1]}', '${name} - Side View')">

                            <img src="${images[1]}" alt="${name} 2">

                        </div>

                        <div class="pbg-side-item" onclick="openPhotoLightbox('${images[2]}', '${name} - Interior / Detail')">

                            <img src="${images[2]}" alt="${name} 3">

                        </div>

                    </div>

                    <div class="pbg-badge-pill">${lucideIcon('camera', 12)} ${images.length} Photos</div>

                </div>

            `;

        }

    }

}



export function openPhotoLightbox(src, caption) {

    const modal = document.getElementById('photo-lightbox-modal');

    const img = document.getElementById('lightbox-img');

    const cap = document.getElementById('lightbox-caption');

    if (!modal || !img) return;

    img.src = src;

    if (cap) cap.textContent = caption || 'Facility Photo';

    modal.style.display = 'flex';

}



export function closePhotoLightbox(e) {

    if (e) e.stopPropagation();

    const modal = document.getElementById('photo-lightbox-modal');

    if (modal) modal.style.display = 'none';

}



// --- System-Wide DASH Welcome & Intro Modal Handlers ---

let selectedWelcomeStationId = 'lares';

export function selectWelcomeStation(stationId) {
    if (!stationId) return;
    selectedWelcomeStationId = stationId;
    const cards = document.querySelectorAll('.dash-welcome-station-card');
    cards.forEach(card => {
        card.classList.toggle('active', card.dataset.station === stationId);
    });
}

export function updateWelcomeModalActiveStation() {
    const currentId = selectedWelcomeStationId || (state && state.currentStationId) || 'lares';
    selectedWelcomeStationId = currentId;
    const cards = document.querySelectorAll('.dash-welcome-station-card');
    cards.forEach(card => {
        const sId = card.dataset.station;
        card.classList.toggle('active', sId === currentId);
    });

    const proceedBtn = document.getElementById('dash-proceed-btn');
    if (proceedBtn) {
        const btnText = proceedBtn.querySelector('span:first-child');
        if (btnText) {
            btnText.textContent = 'Explore Campus';
        }
    }
}

export function goToWelcomeStep(step) {
    const stepIntro = document.getElementById('dash-welcome-step-intro');
    const stepStations = document.getElementById('dash-welcome-step-stations');
    if (!stepIntro || !stepStations) return;

    if (step === 'stations') {
        stepIntro.style.display = 'none';
        stepStations.style.display = 'flex';
        selectedWelcomeStationId = (state && state.currentStationId) || 'lares';
        updateWelcomeModalActiveStation();
    } else {
        stepIntro.style.display = 'flex';
        stepStations.style.display = 'none';
    }
}

export function showDashWelcomeModal(initialStep = 'intro') {
    const modal = document.getElementById('dash-welcome-modal') || document.getElementById('phone-welcome-modal');
    if (!modal) return;
    goToWelcomeStep(initialStep);
    updateWelcomeModalActiveStation();
    modal.style.display = 'flex';
}

export function closeDashWelcomeModal(event) {
    if (event && event.target && event.target.id !== 'dash-welcome-modal' && event.target.id !== 'phone-welcome-modal') return;
    const modal = document.getElementById('dash-welcome-modal') || document.getElementById('phone-welcome-modal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 260);
    }
    // Play signature cinematic intro fly-in once upon proceeding or initial dismiss
    // (skip generic campus intro if user scanned a specific destination building via QR)
    if (!state.hasInitialIntroPlayed) {
        state.hasInitialIntroPlayed = true;
        if (!state.selectedBuildingId && !state.activeRoute && typeof window.playIntroAnimation === 'function') {
            window.playIntroAnimation(null, true);
        }
    }
}

export function handleWelcomeProceed() {
    const targetId = selectedWelcomeStationId || (state && state.currentStationId) || 'lares';
    const modal = document.getElementById('dash-welcome-modal') || document.getElementById('phone-welcome-modal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 260);
    }

    const stationsDict = (typeof STATIONS !== 'undefined') ? STATIONS : (window.STATIONS || {});
    const targetStation = stationsDict[targetId];
    const urlParams = (typeof window !== 'undefined') ? new URLSearchParams(window.location.search) : null;
    const isDevOverride = Boolean((state && state.isAdmin) || (urlParams && urlParams.get('dev') === '1'));

    // The second picture (#station-dev-modal) only pops up when clicking "Explore Campus" if the station is under development
    if (targetStation && targetStation.status === 'under_development' && !isDevOverride) {
        if (typeof window.showStationDevModal === 'function') {
            window.showStationDevModal(targetId);
        }
        return;
    }

    // If selecting a different station, trigger multi-station switch
    if (state && targetId !== state.currentStationId) {
        if (typeof window.switchResearchStation === 'function') {
            window.switchResearchStation(targetId, true);
        }
    } else {
        // Staying on same station (e.g. initial LARES)
        if (!state.hasInitialIntroPlayed) {
            state.hasInitialIntroPlayed = true;
            if (!state.selectedBuildingId && !state.activeRoute && typeof window.playIntroAnimation === 'function') {
                window.playIntroAnimation(null, true);
            }
        }
    }
}

export function handleWelcomeSelectStation(stationId) {
    selectWelcomeStation(stationId);
    handleWelcomeProceed();
}

export function handleDashWelcomeProceed() {
    handleWelcomeProceed();
}



export function showPhoneWelcomeModal() {

    showDashWelcomeModal();

}



export function handleWelcomeContinue() {

    handleDashWelcomeProceed();

}



export function handleWelcomeSkip() {

    handleDashWelcomeProceed();

}



// --- Mobile Filter Dropdown Handlers ---

export function togglePhoneFilterDropdown(e) {

    if (e) {

        e.stopPropagation();

        if (e.preventDefault) e.preventDefault();

    }

    const wrap = document.getElementById('phone-filter-wrap');

    const dd = document.getElementById('phone-filter-dropdown');

    const backdrop = document.getElementById('phone-filter-backdrop');

    const btn = document.getElementById('phone-filter-btn');

    if (!dd || !wrap) return;

    const isOpen = wrap.classList.toggle('open');

    dd.classList.toggle('open', isOpen);

    if (backdrop) backdrop.classList.toggle('active', isOpen);

    if (btn) btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

}



export function closePhoneFilterDropdown() {

    const wrap = document.getElementById('phone-filter-wrap');

    const dd = document.getElementById('phone-filter-dropdown');

    const backdrop = document.getElementById('phone-filter-backdrop');

    const btn = document.getElementById('phone-filter-btn');

    if (wrap) wrap.classList.remove('open');

    if (dd) dd.classList.remove('open');

    if (backdrop) backdrop.classList.remove('active');

    if (btn) btn.setAttribute('aria-expanded', 'false');

}



// --- Phone Directory & Filtering ---

export function renderPhoneDirectory(filter = '') {

    const list = document.getElementById('phone-directory-list');

    if (!list) return;

    const lowerFilter = filter.toLowerCase().trim();



    const dirList = (typeof window !== 'undefined' && window.BUILDING_DIRECTORY && window.BUILDING_DIRECTORY.length > 0)

        ? window.BUILDING_DIRECTORY

        : BUILDING_DIRECTORY;



    const hasTypeFilters = activeTypeFilters && activeTypeFilters.size > 0;



    // 1. Filter Buildings

    let filteredBuildings = [];

    if (!hasTypeFilters || activeTypeFilters.has('office') || activeTypeFilters.has('laboratory') || activeTypeFilters.has('infrastructure') || activeTypeFilters.has('conference') || activeTypeFilters.has('digital_agri')) {

        filteredBuildings = dirList.filter((b) => {

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

            if (!lowerFilter) return true;

            const matchedOffice = findMatchedOffice(b.id, lowerFilter);

            return isBuildingMatched(b, lowerFilter) || !!matchedOffice;

        });

    }



    // 2. Filter Embedded Conference Halls

    let matchedConferenceHalls = [];

    const showConferenceHalls = hasTypeFilters ? activeTypeFilters.has('conference') : !!lowerFilter;

    if (showConferenceHalls) {

        matchedConferenceHalls = EMBEDDED_CONFERENCE_HALLS.filter(c => {

            if (!lowerFilter) return true;

            return matchesSearchText(c.name, lowerFilter) || matchesSearchText(c.desc, lowerFilter) || (c.targetOffice && isOfficeMatched(c.targetOffice, lowerFilter)) || lowerFilter.includes('conf');

        });

    }



    // 3. Filter Plot Zones (23 Official Master Zones)

    let matchedPlots = [];

    const showOrchard = hasTypeFilters ? activeTypeFilters.has('orchard') : false;

    const showTrial = hasTypeFilters ? activeTypeFilters.has('trial_sites') : false;

    const showNursery = hasTypeFilters ? activeTypeFilters.has('infrastructure') : false;



    const plotZonesList = (typeof FIELD_COMMODITY_ZONES !== 'undefined') ? FIELD_COMMODITY_ZONES : [];

    if (!hasTypeFilters && !lowerFilter) {

        matchedPlots = plotZonesList;

    } else if (showOrchard || showTrial || showNursery || lowerFilter) {

        matchedPlots = plotZonesList.filter(z => {

            const zCat = z.category;

            if (hasTypeFilters) {

                let catMatches = false;

                if (showOrchard && zCat === 'orchard') catMatches = true;

                if (showTrial && zCat === 'crop') catMatches = true;

                if (showNursery && zCat === 'nursery') catMatches = true;

                if (!catMatches) return false;

            }

            if (!lowerFilter) {

                return hasTypeFilters;

            }

            return isPlotZoneMatched(z, lowerFilter);

        });

    }



    // 4. Filter Standalone Compound Gates

    let matchedGates = [];

    const gatesList = (typeof window !== 'undefined' && window.STANDALONE_GATES)

        ? Object.values(window.STANDALONE_GATES)

        : (typeof STANDALONE_GATES !== 'undefined' ? Object.values(STANDALONE_GATES) : []);

    if (!hasTypeFilters && !lowerFilter) {

        matchedGates = gatesList;

    } else if (lowerFilter && (!hasTypeFilters || activeTypeFilters.has('infrastructure'))) {

        matchedGates = gatesList.filter(g => {

            return g.name.toLowerCase().includes(lowerFilter) ||

                   (g.desc && g.desc.toLowerCase().includes(lowerFilter)) ||

                   lowerFilter.includes('gate') ||

                   (lowerFilter.includes('entrance') && g.id.includes('entrance')) ||

                   (lowerFilter.includes('exit') && g.id.includes('exit'));

        });

    }



    const totalCount = filteredBuildings.length + matchedConferenceHalls.length + matchedPlots.length + matchedGates.length;



    let headerLabel = 'ALL CAMPUS PLACES';

    if (hasTypeFilters && lowerFilter) {

        headerLabel = `FILTERED SEARCH (${totalCount})`;

    } else if (hasTypeFilters) {

        headerLabel = `FILTERED FACILITIES (${totalCount})`;

    } else if (lowerFilter) {

        headerLabel = `SEARCH RESULTS (${totalCount})`;

    } else {

        headerLabel = `CAMPUS DIRECTORY (${totalCount})`;

    }



    let html = `<div style="padding: 6px 4px 10px; font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 0.5px; display:flex; justify-content:space-between; align-items:center;">

        <span>${headerLabel}</span>

        <span style="font-size:10px; color:#38bdf8; font-weight:600;">DA-LARES</span>

    </div>`;



    if (totalCount === 0) {

        html += '<div style="text-align:center;color:#64748b;padding:32px 12px;font-size:14px;">No places found matching your criteria</div>';

        list.innerHTML = html;

        return;

    }



    // Render Buildings

    filteredBuildings.forEach((b) => {

        const hasNum = b.num !== null && b.num !== undefined;

        const badgeContent = hasNum ? b.num : renderIconOrText(b.icon || 'landmark', 16);

        const bColor = (state.savedBuildingColors && state.savedBuildingColors[b.id] && state.savedBuildingColors[b.id].icon) || b.color || (DEFAULT_BUILDING_COLORS && DEFAULT_BUILDING_COLORS[b.id] && DEFAULT_BUILDING_COLORS[b.id].icon) || '#3b82f6';

        const textColor = getContrastTextColor(bColor);

        const isSelected = state.selectedBuildingId === b.id;



        const matchedOffice = lowerFilter ? findMatchedOffice(b.id, lowerFilter) : null;



        const wfInfo = getBuildingWayfindingInfo(b.id, b.desc);

        let subText = wfInfo.compactTag || b.desc || b.section || 'DA-LARES Facility';

        if (b.id === 'plot22_water_tank' || b.id === 'plot22_comfort_room') {
            subText = `<span class="phone-dir-plot-tag">Plot 22</span> ${wfInfo.compactTag || b.desc || 'Facility'}`;
        }

        if (matchedOffice) {

            const matchedLabel = getOfficeSearchSubtitle(matchedOffice, lowerFilter);

            subText = `<span class="phone-dir-office-tag" title="${matchedLabel.replace(/"/g, '&quot;')}"><span class="dot-office">${lucideIcon('building-2', 12)}</span><span class="office-name-text">${matchedLabel}</span></span>`;

        } else if (lowerFilter) {

            const bldgAliasSub = getBuildingSearchSubtitle(b, lowerFilter);

            if (bldgAliasSub) {

                subText = `<span class="phone-dir-office-tag" title="${bldgAliasSub.replace(/"/g, '&quot;')}"><span class="dot-office">${lucideIcon('landmark', 12)}</span><span class="office-name-text">${bldgAliasSub}</span></span>`;

            }

        }



        const officeArg = matchedOffice ? matchedOffice.replace(/'/g, "\'") : '';

        html += `

            <div class="phone-dir-item ${isSelected ? 'active' : ''}" data-id="${b.id}" onclick="navigateTo('${b.id}', '${officeArg}')">

                <div class="phone-dir-badge" style="background:${bColor}22; color:${bColor}; border:1px solid ${bColor}44; font-size:${hasNum ? '14px' : '16px'};">

                    ${badgeContent}

                </div>

                <div class="phone-dir-info">

                    <div class="phone-dir-name">${b.name}</div>

                    <div class="phone-dir-sub">${subText}</div>

                </div>

                <div class="phone-dir-arrow">›</div>

            </div>

        `;

    });



    // Render Embedded Conference Halls

    matchedConferenceHalls.forEach((item) => {

        const isConfSelected = (state.selectedBuildingId === item.buildingId && state.activeSearchedOffice === item.targetOffice);

        html += `

            <div class="phone-dir-item ${isConfSelected ? 'active' : ''}" data-id="${item.buildingId}" onclick="navigateTo('${item.buildingId}', '${item.targetOffice.replace(/'/g, "\'")}')">

                <div class="phone-dir-badge" style="background:rgba(139, 92, 246, 0.25); color:#c4b5fd; border:1px solid rgba(139, 92, 246, 0.4);">

                    ${lucideIcon('landmark', 16)}

                </div>

                <div class="phone-dir-info">

                    <div class="phone-dir-name">${item.name}</div>

                    <div class="phone-dir-sub"><span class="phone-dir-conf-tag">Conference Hall</span> ${item.desc}</div>

                </div>

                <div class="phone-dir-arrow">›</div>

            </div>

        `;

    });



    // Render Standalone Compound Gates

    matchedGates.forEach((gate) => {

        const isGateSelected = (state.selectedBuildingId === gate.id);

        const gColor = gate.color || '#10b981';

        html += `

            <div class="phone-dir-item ${isGateSelected ? 'active' : ''}" data-id="${gate.id}" onclick="selectStandaloneGate('${gate.id}')">

                <div class="phone-dir-badge" style="background:${gColor}22; color:${gColor}; border:1px solid ${gColor}55;">

                    ${renderIconOrText(gate.icon || 'door-open', 16)}

                </div>

                <div class="phone-dir-info">

                    <div class="phone-dir-name">${gate.name}</div>

                    <div class="phone-dir-sub"><span class="phone-dir-gate-tag" style="background:${gColor}22; color:${gColor};">GATE</span> ${gate.desc}</div>

                </div>

                <div class="phone-dir-arrow">›</div>

            </div>

        `;

    });



    // Render Plot Zones (23 Official Master Zones)

    matchedPlots.forEach((zone) => {

        const isPlotSelected = (state.selectedPlotZoneId === zone.id || (typeof window !== 'undefined' && window.selectedPlotZoneId === zone.id));

        const zoneColor = zone.color || '#10b981';

        const tagLabel = zone.category === 'orchard' ? 'Orchard' : (zone.category === 'crop' ? 'Trial Site' : 'Facility');

        html += `

            <div class="phone-dir-item ${isPlotSelected ? 'active' : ''}" data-plot-id="${zone.id}" onclick="selectPlotZone('${zone.id}')">

                <div class="phone-dir-badge" style="background:${zoneColor}25; color:${zoneColor}; border:1px solid ${zoneColor}50;">

                    ${zone.id === 'zone_mango_banana_jackfruit' ? lucideIcon('trees', 16) : renderIconOrText(zone.icon || 'wheat', 16)}

                </div>

                <div class="phone-dir-info">

                    <div class="phone-dir-name">${zone.name}</div>

                    <div class="phone-dir-sub"><span class="phone-dir-plot-tag">${zone.plotRange ? zone.plotRange : tagLabel}</span> ${zone.description || ''}</div>

                </div>

                <div class="phone-dir-arrow">›</div>

            </div>

        `;

    });



    list.innerHTML = html;

}



export function filterPhoneDirectory() {

    const input = document.getElementById('phone-search-input');

    const val = input ? input.value : '';

    const clearBtn = document.getElementById('phone-search-clear');

    if (clearBtn) {

        clearBtn.style.display = val.trim() ? 'flex' : 'none';

    }

    if (state.currentStationId === 'qares') {

        if (typeof window.filterQARESSearch === 'function') {

            window.filterQARESSearch(val);

        }

        if (state.phoneSheetCurrentSnap === 'peek' && val.length > 0) {

            setPhoneSheetSnap('half');

        }

        return;

    }

    renderPhoneDirectory(val);

    if (state.phoneSheetCurrentSnap === 'peek' && val.length > 0) {

        setPhoneSheetSnap('half');

    }

    // If phone building details view is active, update offices in real time

    if (state.phoneSheetCurrentView === 'bldg' && state.selectedBuildingId) {

        const officesContainer = document.getElementById('phone-bldg-offices-container');

        if (officesContainer) {

            officesContainer.innerHTML = renderBuildingOfficesHTML(state.selectedBuildingId, val);

        }

    }

}



export function clearPhoneSearch() {

    const input = document.getElementById('phone-search-input');

    if (input) input.value = '';

    const clearBtn = document.getElementById('phone-search-clear');

    if (clearBtn) clearBtn.style.display = 'none';

    renderPhoneDirectory('');

}



// --- Phone Building Details View ---

export function showPhoneBuildingDetails(buildingId, targetOffice = '') {

    if (isNavigationActive()) {

        if (state.selectedBuildingId === buildingId) return;

        showMobileToast(`🧭 Active route to ${state.currentRouteDestName || 'destination'} in progress. Tap 'Cancel' to choose another building.`, 3500);

        return;

    }



    const building = (typeof getBuildingById === 'function')

        ? getBuildingById(buildingId)

        : BUILDING_DIRECTORY.find(b => b.id === buildingId);

    if (!building) return;



    const isGate = !!building.isGate || buildingId.startsWith('gate_');

    const num = isGate ? (building.icon || '🚪') : (building.num || 1);

    state.selectedBuildingId = buildingId;

    state.selectedPlotZoneId = null;



    // Reset inline action buttons and kiosk origin row

    const actionsInline = document.getElementById('phone-bldg-actions-inline');

    if (actionsInline) {

        actionsInline.style.display = isGate ? 'none' : 'flex';

    }



    const kioskOriginRow = document.getElementById('pbi-kiosk-origin-row');

    if (kioskOriginRow) {

        kioskOriginRow.style.display = isGate ? 'none' : 'flex';

    }



    // Reset labels

    const visualLbl = document.getElementById('pbi-visual-lbl');

    const servicesLbl = document.getElementById('pbi-services-lbl');

    if (visualLbl) visualLbl.textContent = 'HOW TO SPOT IT';

    if (servicesLbl) servicesLbl.textContent = "WHAT'S INSIDE & SERVICES";



    // Set badge number & color matching desktop translucent scheme

    const badgeEl = document.getElementById('phone-bldg-badge');

    if (badgeEl) {

        const hasNum = building.num !== null && building.num !== undefined;
        const badgeContent = hasNum ? building.num : renderIconOrText(building.icon || 'landmark', 16);

        if (isGate) {
            badgeEl.innerHTML = renderIconOrText(num, 16);
        } else if (hasNum) {
            badgeEl.textContent = building.num;
        } else {
            badgeEl.innerHTML = badgeContent;
        }

        const bColor = building.color || '#3b82f6';
        badgeEl.style.background = `${bColor}22`;
        badgeEl.style.color = bColor;
        badgeEl.style.border = `1px solid ${bColor}44`;

    }// Retrieve visitor-friendly wayfinding descriptions

    const wfInfo = getBuildingWayfindingInfo(buildingId, building.desc);



    // Set titles

    const titleEl = document.getElementById('phone-bldg-title');

    const descEl = document.getElementById('phone-bldg-desc');

    if (titleEl) titleEl.textContent = building.name;

    if (descEl) descEl.textContent = isGate ? (building.desc || 'Campus Access Gate') : (wfInfo.compactTag || building.desc || 'Research Facility');



    // Populate Visual Landmark & Key Services

    const visualEl = document.getElementById('phone-bldg-visual');

    const servicesEl = document.getElementById('phone-bldg-services');

    if (visualEl) visualEl.textContent = isGate ? (building.desc || 'Campus Perimeter Gate') : wfInfo.visualLandmark;

    if (servicesEl) {

        if (isGate) {

            servicesEl.innerHTML = `

                <div style="font-size:12px; color:#f8fafc;">

                    Official campus ingress / egress checkpoint staffed by DA security personnel.

                    ${building.guardHouseName ? `<br><span style="color:#38bdf8; font-weight:600;">Stationed Post:</span> ${building.guardHouseName}` : ''}

                </div>

            `;

        } else {

            servicesEl.textContent = wfInfo.keyServices;

        }

    }



    // Meta info fallback (if present in DOM)

    const sectionEl = document.getElementById('phone-bldg-section');

    const typeEl = document.getElementById('phone-bldg-type');

    if (sectionEl) sectionEl.textContent = building.section || 'Compound';

    if (typeEl) typeEl.textContent = building.type || 'Research Facility';



    // Hide sub-plots container

    const subplotsContainer = document.getElementById('phone-bldg-subplots-container');

    if (subplotsContainer) {

        subplotsContainer.style.display = 'none';

        subplotsContainer.innerHTML = '';

    }



    // Render offices & units with highlighted query

    const officesContainer = document.getElementById('phone-bldg-offices-container');

    if (officesContainer) {

        if (building.isQARES || isGate) {

            officesContainer.innerHTML = '';

        } else {

            const query = targetOffice || document.getElementById('phone-search-input')?.value || '';

            officesContainer.innerHTML = renderBuildingOfficesHTML(buildingId, query);

            const highlightedPill = officesContainer.querySelector('.office-pill.highlighted');

            if (highlightedPill) {

                setTimeout(() => {

                    highlightedPill.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                }, 150);

            }

        }

    }



    // Render Google Maps photo mosaic / gallery form

    renderPhoneBuildingGallery(buildingId);



    // Switch to building view and snap to half height

    setPhoneSheetView('bldg');

    setPhoneSheetSnap('half');



    // Safe stop any lingering intro flyover

    stopIntroAnimation();



    // Focus camera directly on scanned/selected building and start 3D orbit (only for actual buildings)

    if (!isGate && building.coords) {

        orbitBuilding(building.coords);

    }

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
    } else {
        if (typeof window.clearSubPlotHighlight === 'function') window.clearSubPlotHighlight();
    }
}



// --- Phone Agricultural Plot Details View ---

export function showPhonePlotDetails(zoneOrId) {

    const zone = (typeof zoneOrId === 'object' && zoneOrId !== null)

        ? zoneOrId

        : FIELD_COMMODITY_ZONES.find(z => z.id === zoneOrId);

    if (!zone) return;



    state.selectedBuildingId = zone.id;

    window.selectedBuildingId = zone.id;

    state.selectedPlotZoneId = zone.id;

    window.selectedPlotZoneId = zone.id;



    // 1. Badge matching desktop translucent scheme

    const badgeEl = document.getElementById('phone-bldg-badge');

    if (badgeEl) {

        badgeEl.innerHTML = zone.id === 'zone_mango_banana_jackfruit' ? lucideIcon('trees', 16) : renderIconOrText(zone.icon || 'wheat', 16);

        const zColor = zone.color || '#10b981';
        badgeEl.style.background = `${zColor}22`;
        badgeEl.style.color = zColor;
        badgeEl.style.border = `1px solid ${zColor}44`;

    }

    // 2. Title & Subtitle

    const titleEl = document.getElementById('phone-bldg-title');

    const descEl = document.getElementById('phone-bldg-desc');

    if (titleEl) titleEl.textContent = zone.name;



    const plotCountText = `${zone.plotCount || 1} Plot${(zone.plotCount > 1) ? 's' : ''}`;

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



    if (descEl) descEl.textContent = `${rangeText} • ${plotCountText} • ${areaText}`;



    // 3. Hide walking action buttons for plots (infographics only)

    const actionsInline = document.getElementById('phone-bldg-actions-inline');

    if (actionsInline) actionsInline.style.display = 'none';



    // 4. Information rows

    const visualLbl = document.getElementById('pbi-visual-lbl');

    const visualVal = document.getElementById('phone-bldg-visual');

    if (visualLbl) visualLbl.textContent = 'OVERVIEW & COMMODITY';

    if (visualVal) visualVal.textContent = zone.description || `Research field block for ${zone.name}.`;



    const servicesLbl = document.getElementById('pbi-services-lbl');

    const servicesVal = document.getElementById('phone-bldg-services');

    if (servicesLbl) servicesLbl.textContent = 'KEY PLOT METRICS';

    if (servicesVal) {

        servicesVal.innerHTML = `

            <div style="display:flex; flex-direction:column; gap:5px; font-size:12px; margin-top:2px;">

                <div><strong style="color:#38bdf8;">Estimated Area:</strong> <span style="color:#f8fafc;">${areaText}</span></div>

                <div><strong style="color:#38bdf8;">Total Plots:</strong> <span style="color:#f8fafc;">${plotCountText} (${rangeText})</span></div>

                <div><strong style="color:#38bdf8;">Commodity Category:</strong> <span style="color:#f8fafc;">${(zone.category || 'Agricultural Field').toUpperCase()}</span></div>

            </div>

        `;

    }



    const kioskOriginRow = document.getElementById('pbi-kiosk-origin-row');

    if (kioskOriginRow) kioskOriginRow.style.display = 'none';



    // 5. Offices container: empty for plots

    const officesContainer = document.getElementById('phone-bldg-offices-container');

    if (officesContainer) officesContainer.innerHTML = '';



    // 6. Sub-Plots Breakdown (Screenhouses in Plot 17, Plot 18, Water Tank & CR in Plot 22)

    const subplotsContainer = document.getElementById('phone-bldg-subplots-container');

    if (subplotsContainer) {

        if (zone.subPlots && zone.subPlots.length > 0) {

            subplotsContainer.style.display = 'block';

            let html = `

                <div class="phone-subplots-card" style="margin-top:12px; padding:12px; background:rgba(15,23,42,0.65); border:1px solid rgba(255,255,255,0.08); border-radius:12px;">

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">

                        <span style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; color:#38bdf8;">${lucideIcon('sprout', 14)} Sub-Plots in this Zone (${zone.subPlots.length})</span>

                        <span style="font-size:10px; color:#94a3b8;">Tap to zoom</span>

                    </div>

                    <div style="display:flex; flex-direction:column; gap:6px;">

            `;

            zone.subPlots.forEach(sp => {

                const subTitle = sp.label || sp.name || `Screenhouse ${sp.plotNum}`;

                const coordsJson = sp.centerCoords ? `[${sp.centerCoords[0]}, ${sp.centerCoords[1]}]` : 'null';

                const bldgJson = sp.buildingId ? `'${sp.buildingId}'` : 'null';

                html += `

                    <div class="office-pill sub-plot-chip" data-plot-num="${sp.plotNum}" data-id="${sp.buildingId || ''}" data-zone-id="${zone.id}"

                         onclick="if(window.zoomToSubPlot) window.zoomToSubPlot('${sp.plotNum}', ${coordsJson}, ${bldgJson}, '${zone.id}')"

                         title="Tap to focus ${subTitle}"

                         style="cursor:pointer; display:flex; align-items:flex-start; gap:10px; padding:8px 12px; border-radius:8px; background:rgba(30,41,59,0.7); border:1px solid rgba(255,255,255,0.08);">

                        <span class="op-dot" style="background:${zone.color || '#10b981'}; width:8px; height:8px; border-radius:50%; margin-top:5px; flex-shrink:0;"></span>

                        <div style="display:flex; flex-direction:column; line-height:1.25;">

                            <span class="op-name" style="font-size:12px; font-weight:700; color:#f8fafc;">${subTitle}</span>

                            ${sp.details ? `<span style="font-size:11px; color:#94a3b8; margin-top:2px;">${sp.details}</span>` : ''}

                        </div>

                    </div>

                `;

            });

            html += `</div></div>`;

            subplotsContainer.innerHTML = html;

        } else {

            subplotsContainer.style.display = 'none';

            subplotsContainer.innerHTML = '';

        }

    }



    // 7. Gallery photo

    const galleryContainer = document.getElementById('phone-bldg-gallery-container');

    if (galleryContainer) {

        if (zone.image) {

            galleryContainer.innerHTML = `

                <div class="phone-bldg-gallery-grid single-photo" onclick="openPhotoLightbox('${zone.image}', '${zone.name.replace(/'/g, "\'")}')">

                    <div class="pbg-single-slot">

                        <img src="${zone.image}" alt="${zone.name}">

                        <div class="pbg-badge-pill">${lucideIcon('camera', 12)} 1 Photo</div>

                    </div>

                </div>

            `;

        } else {

            galleryContainer.innerHTML = '';

        }

    }



    // 8. Switch to view and snap half

    setPhoneSheetView('bldg');

    setPhoneSheetSnap('half');



    // 9. Update active items

    document.querySelectorAll('.phone-dir-item').forEach(el => {

        el.classList.toggle('active', el.dataset.plotId === zone.id);

    });

}



export function showPhoneDirectoryView() {

    state.selectedBuildingId = null;

    state.selectedPlotZoneId = null;

    state.activeSearchedOffice = '';

    stopOrbit();

    clearRoute();

    stopPhoneLiveGPS();

    if (typeof deselectPlotZone === 'function') deselectPlotZone();

    if (typeof clearSubPlotHighlight === 'function') clearSubPlotHighlight();

    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));

    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));

    document.querySelectorAll('.gate-callout-badge').forEach(el => el.classList.remove('active'));

    setPhoneSheetView('dir');

    setPhoneSheetSnap('half');

    renderPhoneDirectory(document.getElementById('phone-search-input')?.value || '');

    const defaultView = getActiveStationDefaultView();

    if (map && defaultView) {

        map.flyTo({

            center: defaultView.center,

            zoom: defaultView.zoom,

            pitch: defaultView.pitch,

            bearing: defaultView.bearing,

            duration: 1200

        });

    }

}



export function closePhoneBuildingDetails() {

    state.selectedBuildingId = null;

    state.selectedPlotZoneId = null;

    state.activeSearchedOffice = '';

    stopOrbit();

    if (typeof deselectPlotZone === 'function') deselectPlotZone();

    if (typeof clearSubPlotHighlight === 'function') clearSubPlotHighlight();

    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));

    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));

    document.querySelectorAll('.gate-callout-badge').forEach(el => el.classList.remove('active'));

    setPhoneSheetView('dir');

    setPhoneSheetSnap('peek');

    const defaultView = getActiveStationDefaultView();

    map.flyTo({

        center: defaultView.center,

        zoom: defaultView.zoom,

        pitch: defaultView.pitch,

        bearing: defaultView.bearing,

        duration: 1500

    });

}



// Window reflections

window.isPhoneMode = isPhoneMode;

window.isMobileDevice = isMobileDevice;

window.getResponsiveMapPadding = getResponsiveMapPadding;

window.getContrastTextColor = getContrastTextColor;

window.showMobileToast = showMobileToast;

window.setPhoneSheetSnap = setPhoneSheetSnap;

window.cyclePhoneSheetSnap = cyclePhoneSheetSnap;

window.togglePhoneRouteSheet = togglePhoneRouteSheet;

window.setPhoneSheetView = setPhoneSheetView;

window.initPhoneSheetGestures = initPhoneSheetGestures;

window.renderPhoneBuildingGallery = renderPhoneBuildingGallery;

window.openPhotoLightbox = openPhotoLightbox;

window.closePhotoLightbox = closePhotoLightbox;

window.selectWelcomeStation = selectWelcomeStation;
window.handleWelcomeProceed = handleWelcomeProceed;
window.showDashWelcomeModal = showDashWelcomeModal;

window.goToWelcomeStep = goToWelcomeStep;

window.closeDashWelcomeModal = closeDashWelcomeModal;

window.handleDashWelcomeProceed = handleDashWelcomeProceed;

window.handleWelcomeSelectStation = handleWelcomeSelectStation;

window.updateWelcomeModalActiveStation = updateWelcomeModalActiveStation;

window.showPhoneWelcomeModal = showPhoneWelcomeModal;

window.handleWelcomeContinue = handleWelcomeContinue;

window.handleWelcomeSkip = handleWelcomeSkip;

window.renderPhoneDirectory = renderPhoneDirectory;

window.filterPhoneDirectory = filterPhoneDirectory;

window.clearPhoneSearch = clearPhoneSearch;

window.showPhoneBuildingDetails = showPhoneBuildingDetails;

window.showPhonePlotDetails = showPhonePlotDetails;

window.showPhoneDirectoryView = showPhoneDirectoryView;

window.closePhoneBuildingDetails = closePhoneBuildingDetails;

window.togglePhoneFilterDropdown = togglePhoneFilterDropdown;

window.closePhoneFilterDropdown = closePhoneFilterDropdown;

