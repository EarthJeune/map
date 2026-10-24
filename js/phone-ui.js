// DA-LARES Wayfinding — Phone UI & Bottom Sheet Module

import { DEFAULT_MAP_VIEW } from './data/config.js';
import { getActiveStationDefaultView } from './data/stations.js';
import { BUILDING_DIRECTORY } from './data/buildings.js?v=72';
import { renderBuildingOfficesHTML, getFlatBuildingOffices } from './data/offices.js?v=52';
import { state } from './data/state.js';
import { map } from './map-setup.js';
import { clearRoute } from './routing.js';
import { isNavigationActive } from './sidebar.js';
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
    sheet.classList.remove('snap-peek', 'snap-half', 'snap-full');
    sheet.classList.add('snap-' + snap);
    state.phoneSheetCurrentSnap = snap;

    if (camControls && isPhoneMode()) {
        if (snap === 'full') {
            camControls.classList.add('sheet-full-hidden');
        } else {
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
    const handle = document.getElementById('sheet-drag-handle');
    const sheet = document.getElementById('phone-bottom-sheet');
    if (!handle || !sheet) return;

    let touchStartY = 0;
    let initialSheetHeight = 0;
    let isDragging = false;
    let lastY = 0;
    let lastTime = 0;
    let dragVelocityY = 0;

    function getSafeBottomPx() {
        const s = getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom') || '';
        return parseInt(s, 10) || 0;
    }

    function getSnapHeights() {
        const vh = window.innerHeight;
        const peek = 88 + getSafeBottomPx();
        const half = Math.round(vh * 0.50);
        const full = Math.round(vh * 0.92);
        return { peek, half, full, vh };
    }

    function onTouchStart(e) {
        const target = e.target;
        if (target.closest('button') || target.closest('input') || target.closest('.phone-search-clear')) {
            return;
        }

        const touch = e.touches[0];
        touchStartY = touch.clientY;
        lastY = touchStartY;
        lastTime = performance.now();
        dragVelocityY = 0;
        isDragging = true;

        initialSheetHeight = sheet.getBoundingClientRect().height;
        sheet.classList.add('dragging');
    }

    function onTouchMove(e) {
        if (!isDragging) return;

        const touch = e.touches[0];
        const currentY = touch.clientY;
        const currentTime = performance.now();
        const deltaY = touchStartY - currentY;
        const dt = Math.max(1, currentTime - lastTime);

        dragVelocityY = (currentY - lastY) / dt;
        lastY = currentY;
        lastTime = currentTime;

        const snaps = getSnapHeights();
        let newHeight = initialSheetHeight + deltaY;

        if (newHeight < snaps.peek) {
            const under = snaps.peek - newHeight;
            newHeight = snaps.peek - (under * 0.25);
        } else if (newHeight > snaps.full) {
            const over = newHeight - snaps.full;
            newHeight = snaps.full + (over * 0.25);
        }

        sheet.style.height = `${Math.round(newHeight)}px`;
        if (e.cancelable) e.preventDefault();
    }

    function onTouchEnd() {
        if (!isDragging) return;
        isDragging = false;
        sheet.classList.remove('dragging');
        sheet.style.height = '';

        const snaps = getSnapHeights();
        const currentHeight = sheet.getBoundingClientRect().height;

        let targetSnap = 'peek';
        if (dragVelocityY < -0.45) {
            targetSnap = (currentHeight < snaps.half) ? 'half' : 'full';
        } else if (dragVelocityY > 0.45) {
            targetSnap = (currentHeight > snaps.half) ? 'half' : 'peek';
        } else {
            const dPeek = Math.abs(currentHeight - snaps.peek);
            const dHalf = Math.abs(currentHeight - snaps.half);
            const dFull = Math.abs(currentHeight - snaps.full);

            if (dPeek <= dHalf && dPeek <= dFull) {
                targetSnap = 'peek';
            } else if (dHalf <= dPeek && dHalf <= dFull) {
                targetSnap = 'half';
            } else {
                targetSnap = 'full';
            }
        }

        setPhoneSheetSnap(targetSnap);
    }

    handle.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
}

// --- Photo Gallery Mosaic & Lightbox Engine ---
export const BUILDING_PHOTOS = {
    'admin_building': ['images/admin_building.jpg']
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
        candidatePhotos = [`images/${safeId}.jpg`];
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
                    <div class="pbg-empty-icon">🏛️</div>
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
                        <div class="pbg-badge-pill">📷 1 Photo</div>
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
                    <div class="pbg-badge-pill">📷 2 Photos</div>
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
                    <div class="pbg-badge-pill">📷 ${images.length} Photos</div>
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
export function showDashWelcomeModal() {
    const modal = document.getElementById('dash-welcome-modal') || document.getElementById('phone-welcome-modal');
    if (!modal) return;
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
}

export function handleDashWelcomeProceed() {
    const modal = document.getElementById('dash-welcome-modal') || document.getElementById('phone-welcome-modal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 260);
    }

    // Play signature cinematic intro fly-in
    if (typeof window.playIntroAnimation === 'function') {
        window.playIntroAnimation();
    }

    // ============================================================
    // DEVICE-SPECIFIC PROCEED BEHAVIOR:
    // - Kiosk / PC / Laptop: NO asking of location (proceed directly to map)
    // - Mobile Phone: Ask location & orientation notifications so live GPS is ready
    // ============================================================
    const isMobileUA = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
    const hasPhoneParam = (new URLSearchParams(window.location.search).get('mode') || '').toLowerCase() === 'phone';
    const isActualPhone = isPhoneMode() && !isKioskMode() && (isMobileUA || hasPhoneParam);

    if (isActualPhone) {
        try {
            if (typeof requestDeviceOrientationPermission === 'function') {
                requestDeviceOrientationPermission();
            }
            if (typeof requestUserInitialLocation === 'function') {
                requestUserInitialLocation();
            }
        } catch (e) {
            console.warn('Mobile sensor permission note:', e);
        }
    }
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

// --- Phone Directory & Filtering ---
export function renderPhoneDirectory(filter = '') {
    const list = document.getElementById('phone-directory-list');
    if (!list) return;
    const lowerFilter = filter.toLowerCase().trim();

    let html = '';
    BUILDING_DIRECTORY.forEach((b, index) => {
        const flatOffices = getFlatBuildingOffices(b.id);
        const matchedOffice = lowerFilter ? flatOffices.find(off => off.toLowerCase().includes(lowerFilter)) : null;
        const matchesNameOrDesc = lowerFilter && (b.name.toLowerCase().includes(lowerFilter) || (b.desc && b.desc.toLowerCase().includes(lowerFilter)));

        if (lowerFilter && !matchesNameOrDesc && !matchedOffice) {
            return;
        }

        const num = index + 1;
        const textColor = getContrastTextColor(b.color);
        const isSelected = state.selectedBuildingId === b.id;

        let subText = b.desc || b.section || 'DA-LARES Facility';
        if (matchedOffice) {
            subText = `<span class="phone-dir-office-tag" title="${matchedOffice.replace(/"/g, '&quot;')}"><span class="dot-office">🏢</span><span class="office-name-text">${matchedOffice}</span></span>`;
        } else if (flatOffices.length > 0) {
            subText = `<span class="phone-dir-offices-count">${flatOffices.length} offices inside</span>`;
        }

        const officeArg = matchedOffice ? matchedOffice.replace(/'/g, "\\'") : '';
        html += `
            <div class="phone-dir-item ${isSelected ? 'active' : ''}" data-id="${b.id}" onclick="navigateTo('${b.id}', '${officeArg}')">
                <div class="phone-dir-badge" style="background:${b.color}; color:${textColor};">
                    ${num}
                </div>
                <div class="phone-dir-info">
                    <div class="phone-dir-name">${b.name}</div>
                    <div class="phone-dir-sub">${subText}</div>
                </div>
                <div class="phone-dir-arrow">›</div>
            </div>
        `;
    });

    if (!html) {
        html = '<div style="text-align:center;color:#64748b;padding:32px 12px;font-size:14px;">No places found</div>';
    }
    list.innerHTML = html;
}

export function filterPhoneDirectory() {
    const input = document.getElementById('phone-search-input');
    const val = input ? input.value : '';
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
    renderPhoneDirectory('');
}

// --- Phone Building Details View ---
export function showPhoneBuildingDetails(buildingId, targetOffice = '') {
    // Guard against accidental switches while navigation is active
    if (isNavigationActive()) {
        if (state.selectedBuildingId === buildingId) return;
        showMobileToast(`🧭 Active route to ${state.currentRouteDestName || 'destination'} in progress. Tap 'Cancel' to choose another building.`, 3500);
        return;
    }

    const index = BUILDING_DIRECTORY.findIndex(b => b.id === buildingId);
    const building = BUILDING_DIRECTORY[index];
    if (!building) return;

    const num = index + 1;
    state.selectedBuildingId = buildingId;

    // Set badge number & color with contrast check
    const badgeEl = document.getElementById('phone-bldg-badge');
    if (badgeEl) {
        badgeEl.textContent = num;
        badgeEl.style.background = building.color;
        badgeEl.style.color = getContrastTextColor(building.color);
    }

    // Set titles
    const titleEl = document.getElementById('phone-bldg-title');
    const descEl = document.getElementById('phone-bldg-desc');
    if (titleEl) titleEl.textContent = building.name;
    if (descEl) descEl.textContent = building.desc || 'DA-LARES Facility';

    // Meta info (Section and Type; Coords row is strictly hidden)
    const sectionEl = document.getElementById('phone-bldg-section');
    const typeEl = document.getElementById('phone-bldg-type');
    if (sectionEl) sectionEl.textContent = building.section || 'Compound';
    if (typeEl) typeEl.textContent = building.type || 'Office / Facility';

    // Render offices & units with highlighted query
    const officesContainer = document.getElementById('phone-bldg-offices-container');
    if (officesContainer) {
        const query = targetOffice || document.getElementById('phone-search-input')?.value || '';
        officesContainer.innerHTML = renderBuildingOfficesHTML(buildingId, query);
        const highlightedPill = officesContainer.querySelector('.office-pill.highlighted');
        if (highlightedPill) {
            setTimeout(() => {
                highlightedPill.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 150);
        }
    }

    // Render Google Maps photo mosaic / gallery form
    renderPhoneBuildingGallery(buildingId);

    // Switch to building view and snap to half height
    setPhoneSheetView('bldg');
    setPhoneSheetSnap('half');

    // Safe stop any lingering intro flyover
    stopIntroAnimation();

    // Focus camera directly on scanned/selected building and start 3D orbit
    orbitBuilding(building.coords);
}

export function showPhoneDirectoryView() {
    state.selectedBuildingId = null;
    state.activeSearchedOffice = '';
    stopOrbit();
    clearRoute();
    stopPhoneLiveGPS();
    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));
    setPhoneSheetView('dir');
    setPhoneSheetSnap('half');
    renderPhoneDirectory('');
}

export function closePhoneBuildingDetails() {
    state.selectedBuildingId = null;
    state.activeSearchedOffice = '';
    stopOrbit();
    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));
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
window.showDashWelcomeModal = showDashWelcomeModal;
window.closeDashWelcomeModal = closeDashWelcomeModal;
window.handleDashWelcomeProceed = handleDashWelcomeProceed;
window.showPhoneWelcomeModal = showPhoneWelcomeModal;
window.handleWelcomeContinue = handleWelcomeContinue;
window.handleWelcomeSkip = handleWelcomeSkip;
window.renderPhoneDirectory = renderPhoneDirectory;
window.filterPhoneDirectory = filterPhoneDirectory;
window.clearPhoneSearch = clearPhoneSearch;
window.showPhoneBuildingDetails = showPhoneBuildingDetails;
window.showPhoneDirectoryView = showPhoneDirectoryView;
window.closePhoneBuildingDetails = closePhoneBuildingDetails;
