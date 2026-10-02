// DA-LARES Wayfinding — Main Application Module

import {
    MAPBOX_ACCESS_TOKEN,
    CENTER,
    SECTION_COLORS,
    SECTION_PASTEL_COLORS,
    MAPBOX_VIEW_PRESET,
    DEFAULT_MAP_VIEW,
    INTRO_START_VIEW,
    INTRO_TARGET_2D_VIEW,
    VIEWS,
    PREDEFINED_ROUTES,
    SAVED_MAIN_KIOSK_COORDS,
    IDLE_TIMEOUT
} from './data/config.js?v=5';

import {
    DA_LARES_OUTER_PERIMETER,
    LARES_MASK,
    LARES_COMPOUND_OUTLINE,
    LARES_TREES,
    LARES_BOUNDARY
} from './data/geo.js?v=5';

import {
    LARES_DRAWINGS,
    KNOWN_BUILDING_NAMES,
    CUSTOM_BUILDING_CENTERS,
    BUILDING_DIRECTORY
} from './data/buildings.js?v=5';

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
let KIOSK_COORDS = [...SAVED_MAIN_KIOSK_COORDS];
import { state } from './data/state.js?v=5';

import {
    renderSectionBadges,
    removeSectionBadges,
    createEntranceArrowMarker,
    updateMarkerZoomState,
    createMarkers,
    removeMarkers
} from './markers.js?v=5';

import {
    map,
    setupLayers,
    setupMapboxStandardLayers,
    ensureTreeIconLoaded,
    renderTreesLayer,
    revealMap,
    setLighting,
    syncLightingWithTime,
    toggleBuildings,
    toggleTrees,
    toggleMapboxView,
    setMapStyleMode,
    toggleBoundary,
    toggleTerrain,
    toggleMarkers,
    flyToView
} from './map-setup.js?v=5';

import {
    toggleSettingChip,
    buildDirectory,
    filterDirectory,
    toggleSidebarMenu,
    collapseSidebarMenu,
    openSidebarMenu,
    isNavigationActive
} from './sidebar.js?v=5';

import {
    navigateTo,
    setRouteSpeed,
    setRouteCameraMode,
    resetCameraControlsTimer,
    startArrivedCountdown,
    clearArrivedCountdown,
    returnToOverviewFromArrival,
    exitRouteMode,
    declutterLabelsForRoute,
    restoreLabels
} from './walker.js?v=5';

import {
    buildSteps,
    renderStepsList,
    focusRouteStep,
    highlightActiveStep,
    updateLiveNavigation
} from './steps.js?v=5';

import {
    buildRoadGraph,
    findNearestNode,
    findShortestPath,
    computeRouteFromKiosk,
    drawRoute,
    clearRoute,
    closeRouteAndReset,
    getDirections,
    replayRoute,
    smoothRouteCoords,
    drawCampusRouteFromKiosk
} from './routing.js?v=5';

import {
    showBuildingPanel,
    closeBuildingPanel,
    openColorPicker,
    closeColorPicker,
    saveColorPicker,
    syncColorInputs,
    useEyeDropper
} from './building-panel.js?v=5';

let isKioskDraggable = false;
function createKioskMarker() {
    if (kioskMarkerInstance) kioskMarkerInstance.remove();
    const el = document.createElement('div');
    el.className = 'kiosk-marker';
    el.innerHTML = '<div class="kiosk-marker-pulse"></div><div class="kiosk-marker-dot"></div><div class="kiosk-marker-label" style="cursor:pointer;pointer-events:auto;" onclick="toggleKioskLock(event)">📍 You Are Here 🔒</div>';
    kioskMarkerInstance = new mapboxgl.Marker({ element: el, anchor: 'center', draggable: isKioskDraggable })
        .setLngLat(KIOSK_COORDS)
        .addTo(map);
    if (kioskMarkerInstance.getElement()) {
        kioskMarkerInstance.getElement().style.zIndex = '99999';
    }

    kioskMarkerInstance.on('dragend', () => {
        const lngLat = kioskMarkerInstance.getLngLat();
        KIOSK_COORDS = [lngLat.lng, lngLat.lat];

        fetch('/api/pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates: KIOSK_COORDS })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert("Saved new Kiosk Location!");
                    if (activeRoute) navigateTo(activeRoute); // Refresh route
                }
            });
    });
}

// ==========================================
// KIOSK — IDLE / SCREENSAVER
// ==========================================
window.resetIdle = resetIdle;
function resetIdle() {
    if (idleTimer) clearTimeout(idleTimer);
    stopIdleRotation();
    idleTimer = setTimeout(startIdleRotation, IDLE_TIMEOUT);
}

function startIdleRotation() {
    if (idleRotating) return;
    idleRotating = true;
    // Clear any active route and close panels
    if (activeRoute) clearRoute();
    document.getElementById('building-panel').classList.remove('active');
    selectedBuildingId = null;
    stopOrbit();
    document.getElementById('search-input').value = '';
    buildDirectory();

    map.flyTo({ center: DEFAULT_MAP_VIEW.center, zoom: DEFAULT_MAP_VIEW.zoom, pitch: DEFAULT_MAP_VIEW.pitch, bearing: DEFAULT_MAP_VIEW.bearing, duration: 2000 });
    setTimeout(() => {
        if (!idleRotating) return;
        function rotate() {
            if (!idleRotating) return;
            map.rotateTo(map.getBearing() + 0.15, { duration: 0 });
            requestAnimationFrame(rotate);
        }
        rotate();
    }, 2500);
}

function stopIdleRotation() {
    idleRotating = false;
}

function orbitBuilding(center) {
    isIntroAnimating = false;
    stopOrbit();
    isOrbiting = true;

    map.flyTo({
        center: center,
        zoom: 20.1,
        pitch: 70,
        bearing: map.getBearing(),
        duration: 1500,
        essential: true
    });

    orbitTimeout = setTimeout(() => {
        if (!isOrbiting) return;
        function orbitStep() {
            if (!isOrbiting) return;
            map.rotateTo(map.getBearing() + 0.2, { duration: 0 });
            orbitAnimFrame = requestAnimationFrame(orbitStep);
        }
        orbitAnimFrame = requestAnimationFrame(orbitStep);
    }, 1600);
}

function stopOrbit() {
    isOrbiting = false;
    if (orbitTimeout) {
        clearTimeout(orbitTimeout);
        orbitTimeout = null;
    }
    if (orbitAnimFrame) {
        cancelAnimationFrame(orbitAnimFrame);
        orbitAnimFrame = null;
    }
}

// Listen for any interaction to reset idle
['mousedown', 'touchstart', 'mousemove', 'keydown', 'scroll'].forEach(evt => {
    document.addEventListener(evt, resetIdle, { passive: true });
});

// Listen for explicit map interactions to stop orbit
['mousedown', 'touchstart', 'wheel'].forEach(evt => {
    document.addEventListener(evt, (e) => {
        if (e.target.tagName === 'CANVAS') {
            stopOrbit();
        }
    }, { passive: true });
});

// ==========================================
// INIT
// ==========================================

let ROAD_NETWORK = null;
let roadGraph = new Map();
let BUILDING_ENTRANCES = {};

// Fetch roads.json and build pathfinding graph
fetch('roads.json')
    .then(res => res.json())
    .then(data => {
        ROAD_NETWORK = data;

        // Extract entrances
        if (data.features) {
            data.features.forEach(f => {
                if (f.geometry.type === 'Point' && f.properties.type === 'entrance' && f.properties.buildingId) {
                    if (!BUILDING_ENTRANCES[f.properties.buildingId]) {
                        BUILDING_ENTRANCES[f.properties.buildingId] = [];
                    }
                    BUILDING_ENTRANCES[f.properties.buildingId].push(f.geometry.coordinates);
                }
            });
        }

        roadGraph = buildRoadGraph(data);
        console.log(`Loaded road graph with ${roadGraph.size} nodes.`);
    })
    .catch(err => console.error("Could not fetch roads.json", err));

// Fetch colors from backend
fetch('/api/colors')
    .then(res => res.json())
    .then(data => {
        savedBuildingColors = data || {};

        BUILDING_DIRECTORY.forEach(b => {
            if (savedBuildingColors[b.id] && savedBuildingColors[b.id].icon) {
                b.color = savedBuildingColors[b.id].icon;
            }
        });

        removeMarkers();
        createMarkers();

        if (map.getLayer('3d-drawings-roofs')) {
            map.setPaintProperty('3d-drawings-roofs', 'fill-extrusion-color', getRoofColorCaseStyle());
        }

        buildDirectory();
    })
    .catch(err => console.error("Could not fetch building colors", err));

// Fetch pin location from backend
fetch('/api/pin')
    .then(res => res.json())
    .then(data => {
        if (data.coordinates) {
            KIOSK_COORDS = data.coordinates;
            if (kioskMarkerInstance) {
                kioskMarkerInstance.setLngLat(KIOSK_COORDS);
            }
            if (mapReady && !selectedBuildingId && !activeRoute) {
                map.flyTo({ center: DEFAULT_MAP_VIEW.center, zoom: DEFAULT_MAP_VIEW.zoom, pitch: DEFAULT_MAP_VIEW.pitch, bearing: DEFAULT_MAP_VIEW.bearing, duration: 1500 });
            }
        }
    })
    .catch(err => console.error("Could not fetch pin location", err));


map.on('load', () => {
    setTimeout(() => {
        revealMap();
        createKioskMarker();
        buildDirectory();
        resetIdle();
        syncLightingWithTime();
    }, 300);
});
// ==========================================
// MOBILE PHONE & LIVE GPS WAYFINDING SYSTEM
// ==========================================
let PUBLIC_TUNNEL_URL = 'https://studio-comprehensive-mariah-styles.trycloudflare.com';
fetch('/api/tunnel')
    .then(res => res.json())
    .then(data => { if (data && data.url) PUBLIC_TUNNEL_URL = data.url; })
    .catch(() => {});

function isPhoneMode() {
    return window.innerWidth <= 768;
}

function isMobileDevice() {
    return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent);
}

function getResponsiveMapPadding() {
    const isMobile = window.innerWidth <= 768;
    const isPortraitKiosk = window.innerWidth > 768 && window.innerHeight > window.innerWidth;
    const isSidebarCollapsed = document.getElementById('sidebar')?.classList.contains('collapsed');

    if (isMobile) {
        return { top: 90, bottom: 240, left: 24, right: 24 };
    } else if (isPortraitKiosk) {
        const sidePad = isSidebarCollapsed ? 40 : 460;
        return { top: 120, bottom: 120, left: sidePad, right: 40 };
    } else {
        const sidePad = isSidebarCollapsed ? 90 : 420;
        return { top: 80, bottom: 80, left: sidePad, right: 90 };
    }
}

// --- High-Contrast Text Color for Badges ---
function getContrastTextColor(hexColor) {
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

// --- Route Line Curve Smoother ---
function setPhoneSheetSnap(snap) {
    const sheet = document.getElementById('phone-bottom-sheet');
    const camControls = document.getElementById('floating-camera-controls');
    if (!sheet) return;
    sheet.classList.remove('snap-peek', 'snap-half', 'snap-full');
    sheet.classList.add('snap-' + snap);
    phoneSheetCurrentSnap = snap;

    if (camControls && isPhoneMode()) {
        if (snap === 'full') {
            camControls.classList.add('sheet-full-hidden');
        } else {
            camControls.classList.remove('sheet-full-hidden');
        }
    }
}

function cyclePhoneSheetSnap() {
    if (phoneSheetCurrentSnap === 'peek') setPhoneSheetSnap('half');
    else if (phoneSheetCurrentSnap === 'half') setPhoneSheetSnap('full');
    else setPhoneSheetSnap('peek');
}

function togglePhoneRouteSheet() {
    if (phoneSheetCurrentSnap === 'peek') setPhoneSheetSnap('half');
    else setPhoneSheetSnap('peek');
}

function setPhoneSheetView(viewName) {
    document.querySelectorAll('.sheet-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('phone-view-' + viewName);
    if (target) target.classList.add('active');
    phoneSheetCurrentView = viewName;

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

function initPhoneSheetGestures() {
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

        initialSheetHeight = sheet.getBoundingClientRect().height;
        isDragging = true;
        sheet.classList.add('is-dragging');
    }

    function onTouchMove(e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        const currentY = touch.clientY;
        const now = performance.now();
        const dt = now - lastTime;
        if (dt > 8) {
            dragVelocityY = (currentY - lastY) / dt;
            lastY = currentY;
            lastTime = now;
        }

        const deltaY = touchStartY - currentY;
        let targetHeight = initialSheetHeight + deltaY;

        const { peek, full } = getSnapHeights();

        if (targetHeight < peek) {
            const under = peek - targetHeight;
            targetHeight = peek - Math.pow(under, 0.72);
        } else if (targetHeight > full) {
            const over = targetHeight - full;
            targetHeight = full + Math.pow(over, 0.72);
        }

        sheet.style.height = `${Math.round(targetHeight)}px`;

        if (e.cancelable) {
            e.preventDefault();
        }
    }

    function onTouchEnd() {
        if (!isDragging) return;
        isDragging = false;

        sheet.classList.remove('is-dragging');

        const currentHeight = sheet.getBoundingClientRect().height;
        sheet.style.height = '';

        const { peek, half, full } = getSnapHeights();
        let targetSnap = 'peek';

        if (dragVelocityY < -0.4) {
            if (currentHeight < half) targetSnap = 'half';
            else targetSnap = 'full';
        } else if (dragVelocityY > 0.4) {
            if (currentHeight > half) targetSnap = 'half';
            else targetSnap = 'peek';
        } else {
            const dPeek = Math.abs(currentHeight - peek);
            const dHalf = Math.abs(currentHeight - half);
            const dFull = Math.abs(currentHeight - full);

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

    const triggers = [
        document.getElementById('sheet-drag-handle'),
        document.querySelector('.sheet-drag-handle-zone'),
        document.querySelector('.phone-bldg-header'),
        document.querySelector('.phone-route-peek-card')
    ].filter(Boolean);

    triggers.forEach(el => {
        el.addEventListener('touchstart', onTouchStart, { passive: false });
    });

    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
}

// --- Photo Gallery Mosaic & Lightbox Engine ---
// --- Photo Gallery Mosaic & Lightbox Engine ---
const BUILDING_PHOTOS = {
    'admin_building': ['images/admin_building.jpg']
};

function renderPhoneBuildingGallery(buildingId) {
    const container = document.getElementById('phone-bldg-gallery-container');
    if (!container) return;

    const bldg = BUILDING_DIRECTORY.find(b => b.id === buildingId);
    const bldgName = bldg ? bldg.name : 'Building';

    let candidatePhotos = [];
    if (BUILDING_PHOTOS[buildingId] && BUILDING_PHOTOS[buildingId].length > 0) {
        candidatePhotos = [...BUILDING_PHOTOS[buildingId]];
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

function openPhotoLightbox(src, caption) {
    const modal = document.getElementById('photo-lightbox-modal');
    const img = document.getElementById('lightbox-img');
    const cap = document.getElementById('lightbox-caption');
    if (!modal || !img) return;
    img.src = src;
    if (cap) cap.textContent = caption || 'Facility Photo';
    modal.style.display = 'flex';
}

function closePhotoLightbox(e) {
    if (e) e.stopPropagation();
    const modal = document.getElementById('photo-lightbox-modal');
    if (modal) modal.style.display = 'none';
}

// --- Mobile Welcome Onboarding Modal Handlers ---
function showPhoneWelcomeModal() {
    const modal = document.getElementById('phone-welcome-modal');
    if (!modal) return;
    modal.style.display = 'flex';
}

function createUserGPSMarkerElement() {
    const el = document.createElement('div');
    el.className = 'user-gps-marker';
    el.innerHTML = `
        <div class="user-gps-heading" id="user-gps-heading">
            <svg class="user-gps-fan-svg" viewBox="0 0 120 120" width="120" height="120">
                <defs>
                    <radialGradient id="userFanGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.85" />
                        <stop offset="30%" stop-color="#0284c7" stop-opacity="0.55" />
                        <stop offset="70%" stop-color="#0284c7" stop-opacity="0.18" />
                        <stop offset="100%" stop-color="#0284c7" stop-opacity="0" />
                    </radialGradient>
                </defs>
                <!-- 60-degree glowing fan beam cone pointing forward -->
                <path d="M 60 60 L 29.5 7.2 A 61 61 0 0 1 90.5 7.2 Z" fill="url(#userFanGradient)" />
            </svg>
        </div>
        <div class="user-gps-pulse"></div>
        <div class="user-gps-dot"></div>
    `;
    return el;
}

let compassPermissionGranted = false;
let compassListenersBound = false;

function bindCompassListeners() {
    if (compassListenersBound) return;
    compassListenersBound = true;
    window.addEventListener('deviceorientation', handleDeviceHeading, true);
    window.addEventListener('deviceorientationabsolute', handleDeviceHeading, true);
}

function requestDeviceOrientationPermission(callback) {
    if (compassPermissionGranted) {
        bindCompassListeners();
        if (callback) callback(true);
        return;
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(state => {
                if (state === 'granted') {
                    compassPermissionGranted = true;
                    bindCompassListeners();
                    if (callback) callback(true);
                } else {
                    console.warn('Compass permission state:', state);
                    if (callback) callback(false);
                }
            })
            .catch(err => {
                console.warn('Compass permission error:', err);
                if (callback) callback(false);
            });
    } else if (window.DeviceOrientationEvent) {
        compassPermissionGranted = true;
        bindCompassListeners();
        if (callback) callback(true);
    }
}

// Auto-request compass on the first user interaction anywhere on the screen
function triggerCompassPermissionOnFirstGesture() {
    requestDeviceOrientationPermission();
    window.removeEventListener('touchend', triggerCompassPermissionOnFirstGesture);
    window.removeEventListener('click', triggerCompassPermissionOnFirstGesture);
}
window.addEventListener('touchend', triggerCompassPermissionOnFirstGesture, { passive: true });
window.addEventListener('click', triggerCompassPermissionOnFirstGesture, { passive: true });

function updateUserGPSMarker(lng, lat) {
    if (!userGPSMarker) {
        const el = createUserGPSMarkerElement();
        userGPSMarker = new mapboxgl.Marker({ 
            element: el,
            rotationAlignment: 'map',
            pitchAlignment: 'map'
        }).setLngLat([lng, lat]).addTo(map);
    } else {
        userGPSMarker.setLngLat([lng, lat]);
    }
}

function requestUserInitialLocation() {
    if (!navigator.geolocation) {
        showMobileToast('📍 GPS not supported on this browser.', 3000);
        return;
    }
    showMobileToast('📍 Locating your position on campus…', 3000);

    let initialFound = false;
    const onInitialPos = (pos) => {
        if (initialFound) return;
        initialFound = true;
        const userLng = pos.coords.longitude;
        const userLat = pos.coords.latitude;
        lastKnownGPSCoords = [userLng, userLat];
        updateUserGPSMarker(userLng, userLat);
        showMobileToast('📍 Location found! Tap any building to navigate.', 3500);

        const userPt = turf.point([userLng, userLat]);
        const compoundCenter = turf.point([121.1665, 13.9582]);
        const distFromCompoundMeters = turf.distance(userPt, compoundCenter, { units: 'meters' });
        if (distFromCompoundMeters <= 2500) {
            map.easeTo({
                center: [userLng, userLat],
                zoom: 18.8,
                pitch: 0,
                duration: 900
            });
        }
    };

    navigator.geolocation.getCurrentPosition(
        onInitialPos,
        (err) => {
            if (initialFound) return;
            console.warn('Initial high accuracy GPS slow, trying standard accuracy:', err);
            navigator.geolocation.getCurrentPosition(
                onInitialPos,
                (err2) => {
                    if (err2.code === 1) { // PERMISSION_DENIED
                        showGPSPermissionCard();
                    } else {
                        showMobileToast('📍 GPS signal weak. You can still use the Kiosk as starting point.', 3500);
                    }
                },
                { enableHighAccuracy: false, maximumAge: 30000, timeout: 6000 }
            );
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 4500 }
    );
}

function handleWelcomeContinue() {
    sessionStorage.setItem('da_lares_welcome_seen', '1');
    const modal = document.getElementById('phone-welcome-modal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 260);
    }
    // Acquire user location to place blue dot on campus; do NOT start a walking route
    requestUserInitialLocation();
    requestDeviceOrientationPermission();
}

function handleWelcomeSkip() {
    sessionStorage.setItem('da_lares_welcome_seen', '1');
    const modal = document.getElementById('phone-welcome-modal');
    if (modal) {
        modal.classList.add('closing');
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('closing');
        }, 260);
    }
    showMobileToast('🏛️ Welcome to DA-LARES! Tap any building to navigate.', 3000);
}

// --- Phone Directory & Filtering ---
function renderPhoneDirectory(filter = '') {
    const list = document.getElementById('phone-directory-list');
    if (!list) return;
    const lowerFilter = filter.toLowerCase().trim();

    let html = '';
    BUILDING_DIRECTORY.forEach((b, index) => {
        if (lowerFilter && !b.name.toLowerCase().includes(lowerFilter) && !(b.desc && b.desc.toLowerCase().includes(lowerFilter))) {
            return;
        }

        const num = index + 1;
        const textColor = getContrastTextColor(b.color);
        const isSelected = selectedBuildingId === b.id;

        html += `
            <div class="phone-dir-item ${isSelected ? 'active' : ''}" data-id="${b.id}" onclick="navigateTo('${b.id}')">
                <div class="phone-dir-badge" style="background:${b.color}; color:${textColor};">
                    ${num}
                </div>
                <div class="phone-dir-info">
                    <div class="phone-dir-name">${b.name}</div>
                    <div class="phone-dir-sub">${b.desc || b.section || 'DA-LARES Facility'}</div>
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

function filterPhoneDirectory() {
    const input = document.getElementById('phone-search-input');
    const val = input ? input.value : '';
    renderPhoneDirectory(val);
    if (phoneSheetCurrentSnap === 'peek' && val.length > 0) {
        setPhoneSheetSnap('half');
    }
}

function clearPhoneSearch() {
    const input = document.getElementById('phone-search-input');
    if (input) input.value = '';
    renderPhoneDirectory('');
}

// --- Phone Building Details View ---
function showPhoneBuildingDetails(buildingId) {
    // Guard against accidental switches while navigation is active
    if (isNavigationActive()) {
        if (selectedBuildingId === buildingId) return;
        showMobileToast(`🧭 Active route to ${currentRouteDestName || 'destination'} in progress. Tap 'Cancel' to choose another building.`, 3500);
        return;
    }

    const index = BUILDING_DIRECTORY.findIndex(b => b.id === buildingId);
    const building = BUILDING_DIRECTORY[index];
    if (!building) return;

    const num = index + 1;
    selectedBuildingId = buildingId;

    // Set badge number & color with contrast check
    const badgeEl = document.getElementById('phone-bldg-badge');
    if (badgeEl) {
        badgeEl.textContent = num;
        badgeEl.style.background = building.color;
        badgeEl.style.color = getContrastTextColor(building.color);
    }

    // Set titles
    document.getElementById('phone-bldg-title').textContent = building.name;
    document.getElementById('phone-bldg-desc').textContent = building.desc || 'DA-LARES Facility';

    // Meta info (Section and Type; Coords row is strictly hidden)
    document.getElementById('phone-bldg-section').textContent = building.section || 'Compound';
    document.getElementById('phone-bldg-type').textContent = building.type || 'Office / Facility';

    // Render Google Maps photo mosaic / gallery form
    renderPhoneBuildingGallery(buildingId);

    // Switch to building view and snap to half height
    setPhoneSheetView('bldg');
    setPhoneSheetSnap('half');

    // Frame camera comfortably in 45° 3D tilt overlooking the building
    map.easeTo({
        center: [building.coords[0], building.coords[1] - 0.00035],
        zoom: 19.3,
        pitch: 46,
        bearing: -15,
        duration: 900
    });
}

function showPhoneDirectoryView() {
    selectedBuildingId = null;
    clearRoute();
    stopPhoneLiveGPS();
    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));
    setPhoneSheetView('dir');
    setPhoneSheetSnap('half');
    renderPhoneDirectory('');
}

function closePhoneBuildingDetails() {
    selectedBuildingId = null;
    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));
    setPhoneSheetView('dir');
    setPhoneSheetSnap('peek');
    map.flyTo({
        center: DEFAULT_MAP_VIEW.center,
        zoom: DEFAULT_MAP_VIEW.zoom,
        pitch: DEFAULT_MAP_VIEW.pitch,
        bearing: DEFAULT_MAP_VIEW.bearing,
        duration: 1500
    });
}

// --- Phone Active Route & Steps ---
function updatePhoneRouteUI(coords) {
    const building = BUILDING_DIRECTORY.find(b => b.id === selectedBuildingId);
    const destName = building ? building.name : (currentRouteDestName || 'Destination');
    const totalDist = turf.length(turf.lineString(coords), { units: 'meters' });
    const roundedTotal = Math.round(totalDist);

    const destEl = document.getElementById('phone-route-dest-name');
    const remainEl = document.getElementById('phone-route-remain-tag');
    if (destEl) destEl.textContent = destName;
    if (remainEl) remainEl.textContent = `${roundedTotal} m remaining`;

    const walkingMinutes = Math.max(1, Math.round(roundedTotal / 72));
    const etaTimeEl = document.getElementById('phone-gps-eta-time');
    if (etaTimeEl) etaTimeEl.textContent = (roundedTotal < 40) ? '< 1 min' : `${walkingMinutes} min`;
    const etaDistEl = document.getElementById('phone-gps-eta-dist');
    if (etaDistEl) etaDistEl.textContent = `${roundedTotal} m remaining`;

    // Top HUD update & show
    const topHud = document.getElementById('phone-top-nav-hud');
    const ptnhIcon = document.getElementById('ptnh-maneuver-icon');
    const ptnhPrim = document.getElementById('ptnh-primary-step');
    const ptnhSec = document.getElementById('ptnh-secondary-step');
    const ptnhDist = document.getElementById('ptnh-dist-pill');

    if (currentRouteSteps && currentRouteSteps.length > 0) {
        if (ptnhPrim) ptnhPrim.textContent = currentRouteSteps[0].text;
        if (ptnhSec) ptnhSec.textContent = currentRouteSteps.length > 1 ? currentRouteSteps[1].text : `Proceed toward ${destName}`;
        if (ptnhIcon) ptnhIcon.innerHTML = currentRouteSteps[0].icon || '⬆️';
        if (ptnhDist) ptnhDist.textContent = `${roundedTotal} m`;
    } else {
        if (ptnhPrim) ptnhPrim.textContent = 'Follow the walkway';
        if (ptnhSec) ptnhSec.textContent = `Heading to ${destName}`;
        if (ptnhDist) ptnhDist.textContent = `${roundedTotal} m`;
    }

    if (topHud && (isMobileGPSActive || walkAnimFrame)) {
        topHud.classList.add('active');
    }

    renderPhoneStepsList(currentRouteSteps);
    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');
}

function renderPhoneStepsList(steps) {
    const list = document.getElementById('phone-steps-list');
    if (!list || !steps) return;

    let html = '';
    steps.forEach((s, idx) => {
        const prevAt = idx > 0 ? steps[idx - 1].at : 0;
        const stepDist = Math.max(1, Math.round(s.at - prevAt));
        const distLabel = idx === 0 ? 'Start' : `${stepDist} m`;

        html += `
            <div class="phone-step-item" id="phone-step-${idx}" onclick="focusRouteStep(${idx})">
                <div class="psi-icon">${s.icon}</div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:700; color:#f8fafc;">${s.text}</div>
                    <div style="font-size:12px; color:#94a3b8; margin-top:2px;">${distLabel}</div>
                </div>
            </div>
        `;
    });
    list.innerHTML = html;
}

function updatePhoneLiveNavUI(currentDist, totalDist, nextStep, remaining, rounded) {
    const remainTag = document.getElementById('phone-route-remain-tag');
    const remainingTotal = Math.max(0, Math.round(totalDist - currentDist));
    if (remainTag) remainTag.textContent = `${remainingTotal} m remaining`;

    const topHud = document.getElementById('phone-top-nav-hud');
    const ptnhIcon = document.getElementById('ptnh-maneuver-icon');
    const ptnhPrim = document.getElementById('ptnh-primary-step');
    const ptnhSec = document.getElementById('ptnh-secondary-step');
    const ptnhDist = document.getElementById('ptnh-dist-pill');

    if (topHud && (isMobileGPSActive || walkAnimFrame)) {
        topHud.classList.add('active');
    }

    if (nextStep) {
        if (ptnhIcon) ptnhIcon.innerHTML = nextStep.icon || '⬆️';
        if (ptnhDist) {
            if (remaining <= 10) ptnhDist.textContent = 'Now';
            else ptnhDist.textContent = `${rounded} m`;
        }
        if (ptnhPrim) {
            ptnhPrim.textContent = nextStep.text;
        }
        const nextNextIdx = currentRouteSteps ? currentRouteSteps.findIndex(s => s.at > nextStep.at + 1) : -1;
        if (ptnhSec) {
            if (nextNextIdx !== -1 && currentRouteSteps[nextNextIdx]) {
                ptnhSec.textContent = `Then: ${currentRouteSteps[nextNextIdx].text}`;
            } else {
                ptnhSec.textContent = `Approaching destination`;
            }
        }
    }

    // Highlight step in phone list
    if (currentRouteSteps) {
        const activeIdx = currentRouteSteps.findIndex(s => s.at > currentDist + 1);
        const stepIdx = activeIdx > 0 ? activeIdx - 1 : 0;
        document.querySelectorAll('.phone-step-item').forEach((el, i) => {
            el.classList.toggle('active', i === stepIdx);
        });
    }
}

function startPhoneAnimatedRoute() {
    stopPhoneLiveGPS(); // Stop any active live GPS
    dismissGPSPermissionCard(); // Never show permission card for animated route

    if (!selectedBuildingId) return;
    const building = BUILDING_DIRECTORY.find(b => b.id === selectedBuildingId);
    if (!building) return;

    activeRoute = building.id;
    const routeCoords = computeRouteFromKiosk(building.id);
    activeFullRouteCoords = routeCoords;
    activeRouteCoords = routeCoords;

    // Turn-by-turn steps
    currentRouteSteps = buildSteps(routeCoords, BUILDING_DIRECTORY, building.id);
    currentRouteDestName = building.name;

    // Mobile view: default to 1x speed as requested by user
    setRouteSpeed(1);

    // Ensure speed bar is visible
    const speedBar = document.getElementById('phone-speed-bar');
    if (speedBar) speedBar.style.display = 'flex';

    // Switch to route sheet view in peek mode
    updatePhoneRouteUI(routeCoords);
    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');

    // Fit whole route in camera view
    const routeLine = turf.lineString(routeCoords);
    const bbox = turf.bbox(routeLine);
    map.fitBounds(bbox, {
        padding: getResponsiveMapPadding(),
        maxZoom: 19.5,
        pitch: 45,
        bearing: -15,
        duration: 1100
    });

    // Start animated walker route
    drawRoute(routeCoords, { animated: true });
}

function replayPhoneRoute() {
    clearArrivedCountdown();
    clearRoute();
    if (selectedBuildingId) {
        if (isMobileGPSActive) {
            startPhoneLiveGPS(selectedBuildingId);
        } else {
            startPhoneAnimatedRoute();
        }
    }
}

function cancelPhoneRoute() {
    stopPhoneLiveGPS();
    clearRoute();
    selectedBuildingId = null;
    document.querySelectorAll('.phone-dir-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.bldg-map-marker').forEach(el => el.classList.remove('active'));
    setPhoneSheetView('dir');
    setPhoneSheetSnap('half');
    renderPhoneDirectory('');
    showMobileToast('Navigation cancelled', 2000);
}

// --- Centered Arrival Pop-up Modal Controller ---
function showPhoneArrival(buildingOrId) {
    stopPhoneLiveGPS();
    if (routeAnimFrame) cancelAnimationFrame(routeAnimFrame);
    if (walkAnimFrame) cancelAnimationFrame(walkAnimFrame);
    activeFullRouteCoords = null;

    const topHud = document.getElementById('phone-top-nav-hud');
    if (topHud) topHud.classList.remove('active');

    let building = buildingOrId;
    if (typeof buildingOrId === 'string') {
        building = BUILDING_DIRECTORY.find(b => b.id === buildingOrId);
    }
    const name = building ? building.name : 'Destination';

    // Show Centered Pop-up Modal
    const modal = document.getElementById('phone-arrived-modal');
    const titleEl = document.getElementById('pam-title');
    const descEl = document.getElementById('pam-desc');
    if (titleEl) titleEl.textContent = `Arrived at ${name}!`;
    if (descEl) descEl.textContent = 'You have reached your destination.';
    if (modal) modal.classList.add('active');

    setPhoneSheetView('dir');
    setPhoneSheetSnap('peek');

    // Focus on destination building in 3D tilt
    if (building && building.coords) {
        map.easeTo({
            center: building.coords,
            zoom: 19.8,
            pitch: 52,
            bearing: -15,
            duration: 1200
        });
    }
}

function closePhoneArrivalPopup() {
    const modal = document.getElementById('phone-arrived-modal');
    if (modal) modal.classList.remove('active');
    selectedBuildingId = null;
    clearRoute();
    setPhoneSheetView('dir');
    setPhoneSheetSnap('peek');
    map.flyTo({
        center: DEFAULT_MAP_VIEW.center,
        zoom: DEFAULT_MAP_VIEW.zoom,
        pitch: DEFAULT_MAP_VIEW.pitch,
        bearing: DEFAULT_MAP_VIEW.bearing,
        duration: 1500
    });
}

function replayFromArrivalPopup() {
    const modal = document.getElementById('phone-arrived-modal');
    if (modal) modal.classList.remove('active');
    clearArrivedCountdown();
    clearRoute();
    if (selectedBuildingId) {
        if (isMobileGPSActive) {
            startPhoneLiveGPS(selectedBuildingId);
        } else {
            startPhoneAnimatedRoute();
        }
    }
}

function donePhoneArrival() {
    closePhoneArrivalPopup();
}

// --- Live Mobile GPS Engine with Road Snapping ---
let userGPSMarker = null;
let gpsAccuracyCircle = null;
let gpsWatchId = null;
let lastKnownGPSCoords = null;
let isMobileGPSActive = false;
let isUserFollowingGPS = true;
let offRouteCounter = 0;
let lastRecalcTime = 0;

function showMobileToast(text, duration = 3500) {
    const toast = document.getElementById('mobile-gps-toast');
    const textEl = document.getElementById('mobile-gps-toast-text');
    if (!toast || !textEl) return;
    textEl.textContent = text;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), duration);
}

let gpsNavigationStartTime = 0;

function startPhoneLiveGPS(buildingId) {
    if (!buildingId) buildingId = selectedBuildingId;
    if (!buildingId) return;
    selectedBuildingId = buildingId;
    gpsNavigationStartTime = Date.now();

    // Stop animated walker simulation if running
    if (walkAnimFrame) cancelAnimationFrame(walkAnimFrame);
    if (walkerMarkerInstance) {
        walkerMarkerInstance.remove();
        walkerMarkerInstance = null;
    }

    isMobileGPSActive = true;
    isUserFollowingGPS = true;
    offRouteCounter = 0;
    document.body.classList.add('phone-gps-active');
    if (typeof updateRecenterStateUI === 'function') updateRecenterStateUI(true);

    const building = BUILDING_DIRECTORY.find(b => b.id === buildingId);
    const bldgName = building ? building.name : 'Destination';
    currentRouteDestName = bldgName;

    // Immediately switch sheet to route view so user gets immediate visual feedback!
    const destName = document.getElementById('phone-route-dest-name');
    const remainTag = document.getElementById('phone-route-remain-tag');
    if (destName) destName.textContent = bldgName;
    if (remainTag) remainTag.textContent = 'Acquiring GPS…';

    const topHud = document.getElementById('phone-top-nav-hud');
    const ptnhIcon = document.getElementById('ptnh-maneuver-icon');
    const ptnhPrim = document.getElementById('ptnh-primary-step');
    const ptnhSec = document.getElementById('ptnh-secondary-step');
    const ptnhDist = document.getElementById('ptnh-dist-pill');
    if (ptnhPrim) ptnhPrim.textContent = 'Locating your GPS position…';
    if (ptnhSec) ptnhSec.textContent = `Connecting to phone satellite for ${bldgName}`;
    if (ptnhDist) ptnhDist.textContent = 'GPS';
    if (ptnhIcon) ptnhIcon.innerHTML = '📍';
    if (topHud) topHud.classList.add('active');

    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');

    // Switch to top-down 2D view for accurate walkway navigation
    try { map.easeTo({ pitch: 0, duration: 600 }); } catch (e) {}

    activeFullRouteCoords = null; // Clear so new route from user GPS is always drawn

    // If last known GPS is already cached, compute and draw immediately from user's live position!
    if (lastKnownGPSCoords) {
        computeAndDrawRouteFromGPS(lastKnownGPSCoords, buildingId);
    }

    if (!navigator.geolocation) {
        showMobileToast('GPS not supported on this browser. Showing route from Kiosk.', 4000);
        startPhoneAnimatedRoute();
        return;
    }

    showMobileToast('📍 Locating your position…', 3000);

    if (gpsWatchId) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }

    // Set up GPS accuracy and connector layers on map
    setupGPSLayers();

    // Start continuous tracking immediately for fastest satellite fix
    startContinuousTracking(buildingId);

    // Also initiate high-accuracy query with generous timeout
    navigator.geolocation.getCurrentPosition(
        (pos) => handleGPSPositionUpdate(pos, buildingId),
        (err) => {
            console.warn('Initial GPS query note:', err);
            if (err && err.code === 1) { // PERMISSION_DENIED
                showGPSPermissionCard(buildingId);
            }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
    );

    // Request and bind device orientation / compass on this direct user tap
    requestDeviceOrientationPermission();
}

function startContinuousTracking(buildingId) {
    if (gpsWatchId) return;
    // CRITICAL: maximumAge: 0 forces the device to ALWAYS deliver the freshest real-time hardware GPS fix
    gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => handleGPSPositionUpdate(pos, buildingId),
        (err) => {
            console.warn('Continuous GPS tracking warning:', err);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 }
    );
}

// --- 60fps Marker Gliding & Camera Lerp Engine ---
let markerCurrentLngLat = null;
let markerTargetLngLat = null;
let markerLerpStartTime = 0;
let markerLerpDuration = 500;
let markerAnimFrame = null;
let lastTrimmedCoord = null;

function animateMarkerTo(targetLngLat) {
    if (!userGPSMarker) return;
    if (!markerCurrentLngLat) {
        markerCurrentLngLat = targetLngLat;
        userGPSMarker.setLngLat(targetLngLat);
        return;
    }
    const startLngLat = [...markerCurrentLngLat];
    markerTargetLngLat = targetLngLat;
    markerLerpStartTime = performance.now();

    if (markerAnimFrame) cancelAnimationFrame(markerAnimFrame);

    function step(now) {
        const elapsed = now - markerLerpStartTime;
        const progress = Math.min(1, elapsed / markerLerpDuration);
        const ease = 1 - (1 - progress) * (1 - progress); // Smooth quad ease-out

        const currentLng = startLngLat[0] + (markerTargetLngLat[0] - startLngLat[0]) * ease;
        const currentLat = startLngLat[1] + (markerTargetLngLat[1] - startLngLat[1]) * ease;
        markerCurrentLngLat = [currentLng, currentLat];

        if (userGPSMarker) {
            userGPSMarker.setLngLat(markerCurrentLngLat);
        }

        if (progress < 1) {
            markerAnimFrame = requestAnimationFrame(step);
        }
    }
    markerAnimFrame = requestAnimationFrame(step);
}

let lastCameraFollowLngLat = null;
function updateSmoothCameraFollow(targetLngLat, distFromCompoundMeters) {
    if (!isUserFollowingGPS || distFromCompoundMeters > 1500) return;
    if (!lastCameraFollowLngLat) {
        lastCameraFollowLngLat = targetLngLat;
        map.easeTo({
            center: targetLngLat,
            zoom: 19.5,
            pitch: 0,
            duration: 800
        });
        return;
    }
    // Only update camera if user moved at least 2.0 meters from last camera focus
    const moveD = turf.distance(turf.point(lastCameraFollowLngLat), turf.point(targetLngLat), { units: 'meters' });
    if (moveD >= 2.0) {
        lastCameraFollowLngLat = targetLngLat;
        map.panTo(targetLngLat, {
            duration: 600,
            easing: t => t
        });
    }
}

function stopPhoneLiveGPS() {
    if (gpsWatchId) {
        navigator.geolocation.clearWatch(gpsWatchId);
        gpsWatchId = null;
    }
    if (markerAnimFrame) {
        cancelAnimationFrame(markerAnimFrame);
        markerAnimFrame = null;
    }
    markerCurrentLngLat = null;
    markerTargetLngLat = null;
    lastCameraFollowLngLat = null;
    lastTrimmedCoord = null;

    isMobileGPSActive = false;
    isUserFollowingGPS = false;
    document.body.classList.remove('phone-gps-active');
    if (typeof autoRecenterTimer !== 'undefined' && autoRecenterTimer) {
        clearTimeout(autoRecenterTimer);
        autoRecenterTimer = null;
    }
    if (typeof updateRecenterStateUI === 'function') updateRecenterStateUI(false);
    document.getElementById('mobile-recenter-btn')?.classList.remove('active');
    if (userGPSMarker) {
        userGPSMarker.remove();
        userGPSMarker = null;
    }
    try {
        if (map.getSource('gps-accuracy-source')) {
            map.getSource('gps-accuracy-source').setData({ type: 'FeatureCollection', features: [] });
        }
        if (map.getSource('gps-connector-source')) {
            map.getSource('gps-connector-source').setData({ type: 'FeatureCollection', features: [] });
        }
    } catch (e) { }
    stopHeadingSync();
    smoothedCompassHeading = null;
    rawCompassHeading = null;
}
const stopMobileGPSNavigation = stopPhoneLiveGPS;
const startMobileGPSNavigation = startPhoneLiveGPS;

function setupGPSLayers() {
    if (!map.getSource('gps-accuracy-source')) {
        map.addSource('gps-accuracy-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        map.addLayer({
            id: 'gps-accuracy-layer',
            type: 'fill',
            source: 'gps-accuracy-source',
            paint: {
                'fill-color': '#38bdf8',
                'fill-opacity': 0.15
            }
        });
        map.addLayer({
            id: 'gps-accuracy-stroke',
            type: 'line',
            source: 'gps-accuracy-source',
            paint: {
                'line-color': '#38bdf8',
                'line-width': 1.5,
                'line-opacity': 0.4
            }
        });
    }

    if (!map.getSource('gps-connector-source')) {
        map.addSource('gps-connector-source', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        map.addLayer({
            id: 'gps-connector-layer',
            type: 'line',
            source: 'gps-connector-source',
            paint: {
                'line-color': '#38bdf8',
                'line-width': 2.5,
                'line-dasharray': [2, 2],
                'line-opacity': 0.8
            }
        });
    }
}

let smoothedCompassHeading = null;
let rawCompassHeading = null;
let headingAnimFrame = null;

function applyUserHeading(targetHeading) {
    if (targetHeading === null || targetHeading === undefined || isNaN(targetHeading)) return;
    rawCompassHeading = targetHeading;

    if (smoothedCompassHeading === null) {
        smoothedCompassHeading = targetHeading;
    } else {
        let diff = targetHeading - smoothedCompassHeading;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        smoothedCompassHeading = (smoothedCompassHeading + diff * 0.25 + 360) % 360;
    }

    // Subtract map bearing so fan always points real-world north-relative
    // Because rotationAlignment:'map' means the marker element is already counter-rotated by the map bearing
    const mapBearing = map ? (map.getBearing() || 0) : 0;
    const visualRotation = (smoothedCompassHeading - mapBearing + 360) % 360;

    const headingEl = document.getElementById('user-gps-heading');
    if (headingEl) {
        headingEl.style.display = 'flex';
        headingEl.style.transform = `rotate(${Math.round(visualRotation)}deg)`;
    }
}

// Continuously re-apply heading on map rotate/move so fan stays aligned
function startHeadingSync() {
    if (headingAnimFrame) return;
    function syncLoop() {
        if (rawCompassHeading !== null) {
            applyUserHeading(rawCompassHeading);
        }
        headingAnimFrame = requestAnimationFrame(syncLoop);
    }
    headingAnimFrame = requestAnimationFrame(syncLoop);
}

function stopHeadingSync() {
    if (headingAnimFrame) {
        cancelAnimationFrame(headingAnimFrame);
        headingAnimFrame = null;
    }
}

function handleDeviceHeading(e) {
    let heading = null;

    // 1. iOS Safari: webkitCompassHeading (0 = True North, clockwise)
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
        heading = e.webkitCompassHeading;
    }
    // 2. Android Chrome / Standard: alpha (0 = arbitrary, but deviceorientationabsolute gives true north)
    else if (typeof e.alpha === 'number' && !isNaN(e.alpha)) {
        heading = (360 - e.alpha) % 360;
    }

    if (heading !== null && !isNaN(heading)) {
        // Adjust for screen orientation (landscape, etc.)
        const screenAngle = (typeof window.orientation === 'number')
            ? window.orientation
            : (screen.orientation ? screen.orientation.angle : 0) || 0;
        const correctedHeading = (heading + screenAngle + 360) % 360;

        // Store and apply even without GPS marker — it will render when marker appears
        rawCompassHeading = correctedHeading;
        applyUserHeading(correctedHeading);

        // Start continuous sync loop if not already running
        startHeadingSync();
    }
}

function computeAndDrawRouteFromGPS(startCoord, buildingId) {
    const building = BUILDING_DIRECTORY.find(b => b.id === buildingId);
    if (!building || !roadGraph || roadGraph.size === 0) return;

    const ENTRANCE_OVERRIDES = {
        'rafis_building': 'mis_building',
        'bac_building': 'pmed_building',
        'vacant': 'fmr',
        'mis_data_center': 'fmr'
    };

    let targetBuildingId = building.id;
    if (ENTRANCE_OVERRIDES[targetBuildingId]) {
        targetBuildingId = ENTRANCE_OVERRIDES[targetBuildingId];
    }

    const entrances = BUILDING_ENTRANCES[targetBuildingId] || [building.coords];
    let bestPath = null;
    let minDistance = Infinity;

    entrances.forEach(ent => {
        const p = findShortestPath(startCoord, ent, roadGraph);
        if (p && p.length > 0) {
            const full = [startCoord, ...p, ent];
            const d = turf.length(turf.lineString(full), { units: 'meters' });
            if (d < minDistance) {
                minDistance = d;
                bestPath = full;
            }
        }
    });

    const routeCoords = bestPath || [startCoord, building.coords];
    activeFullRouteCoords = routeCoords;
    activeRouteCoords = routeCoords;

    // Turn-by-turn steps
    currentRouteSteps = buildSteps(routeCoords, BUILDING_DIRECTORY, building.id);
    currentRouteDestName = building.name;

    // Update UI turn-by-turn steps and peek card!
    updatePhoneRouteUI(routeCoords);
    setPhoneSheetView('route');
    setPhoneSheetSnap('peek');

    // Draw route statically without automated walker sprint
    drawRoute(routeCoords, { animated: false });

    const userPt = turf.point(startCoord);
    const compoundCenter = turf.point([121.1665, 13.9582]);
    const distFromCompoundMeters = turf.distance(userPt, compoundCenter, { units: 'meters' });

    if (distFromCompoundMeters > 1500) {
        const bbox = turf.bbox(turf.lineString(routeCoords));
        map.fitBounds(bbox, {
            padding: getResponsiveMapPadding(),
            maxZoom: 17,
            pitch: 0,
            duration: 1200
        });
    } else {
        // Top-down 2D orthogonal view for precision accuracy
        map.easeTo({
            center: startCoord,
            zoom: 19.5,
            pitch: 0,
            duration: 800
        });
    }
}

function handleGPSPositionUpdate(pos, targetBuildingId) {
    if (!targetBuildingId) targetBuildingId = selectedBuildingId;
    const userLng = pos.coords.longitude;
    const userLat = pos.coords.latitude;
    const accuracy = Math.max(5, pos.coords.accuracy || 10);

    // Dismiss permission card if visible
    dismissGPSPermissionCard(false);

    // 1. Distance check from DA-LARES compound
    const userPt = turf.point([userLng, userLat]);
    const compoundCenter = turf.point([121.1665, 13.9582]);
    const distFromCompoundMeters = turf.distance(userPt, compoundCenter, { units: 'meters' });

    // 2. Walkway Map-Matching (Road Snapping)
    let snappedCoord = [userLng, userLat];
    let isSnapped = false;

    // Prioritize snapping directly onto active navigation route line
    if (activeFullRouteCoords && activeFullRouteCoords.length > 1) {
        try {
            const fullLine = turf.lineString(activeFullRouteCoords);
            const snappedOnRoute = turf.nearestPointOnLine(fullLine, userPt);
            const distToRoute = turf.distance(userPt, snappedOnRoute, { units: 'meters' });
            // Snap cleanly if within 14 meters of active route line
            if (distToRoute <= 14) {
                snappedCoord = snappedOnRoute.geometry.coordinates;
                isSnapped = true;
            }
        } catch(e) {}
    }

    // If not snapped to active route, snap to nearest registered campus walkway/road
    if (!isSnapped && ROAD_NETWORK && distFromCompoundMeters <= 1500) {
        try {
            const snappedPt = turf.nearestPointOnLine(ROAD_NETWORK, userPt);
            const distToWalkway = turf.distance(userPt, snappedPt, { units: 'meters' });
            // Snap cleanly if within 12 meters of a campus walkway
            if (distToWalkway <= 12) {
                snappedCoord = snappedPt.geometry.coordinates;
                isSnapped = true;
            }
        } catch (err) {}
    }

    // Direction from GPS hardware heading or walking delta
    if (typeof pos.coords.heading === 'number' && !isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
        applyUserHeading(pos.coords.heading);
    } else if (lastKnownGPSCoords) {
        try {
            const movedDist = turf.distance(turf.point(lastKnownGPSCoords), turf.point(snappedCoord), { units: 'meters' });
            if (movedDist >= 1.2) {
                const bearing = turf.bearing(turf.point(lastKnownGPSCoords), turf.point(snappedCoord));
                applyUserHeading((bearing + 360) % 360);
            }
        } catch (e) {}
    }

    // Cache snapped location
    lastKnownGPSCoords = snappedCoord;

    // 3. Smooth 60fps User GPS Marker Gliding to the Snapped Position
    if (!userGPSMarker) {
        const el = createUserGPSMarkerElement();
        userGPSMarker = new mapboxgl.Marker({ 
            element: el,
            rotationAlignment: 'map',
            pitchAlignment: 'map'
        }).setLngLat(snappedCoord).addTo(map);
        markerCurrentLngLat = snappedCoord;
    } else {
        animateMarkerTo(snappedCoord);
    }

    // 4. Update soft accuracy circle on map (centered on snapped marker)
    try {
        if (map.getSource('gps-accuracy-source')) {
            const circle = turf.circle(snappedCoord, Math.min(accuracy, 25), { units: 'meters' });
            map.getSource('gps-accuracy-source').setData(circle);
        }
    } catch (err) { }

    // 5. Subtle off-road connector line (only shown if user walks far into an open field)
    try {
        if (map.getSource('gps-connector-source')) {
            if (!isSnapped && distFromCompoundMeters <= 1500) {
                const connectorLine = turf.lineString([
                    [userLng, userLat],
                    snappedCoord
                ]);
                map.getSource('gps-connector-source').setData(connectorLine);
            } else {
                map.getSource('gps-connector-source').setData({ type: 'FeatureCollection', features: [] });
            }
        }
    } catch (err) { }

    // If route hasn't been drawn yet, or if it was previously set to Kiosk route, draw starting from user's live GPS position!
    const isRouteFromKiosk = activeFullRouteCoords && activeFullRouteCoords.length > 0 &&
        (Math.abs(activeFullRouteCoords[0][0] - KIOSK_COORDS[0]) < 0.00005 && Math.abs(activeFullRouteCoords[0][1] - KIOSK_COORDS[1]) < 0.00005);

    if (!activeFullRouteCoords || !map.getSource('route-source') || (isMobileGPSActive && isRouteFromKiosk)) {
        if (distFromCompoundMeters > 1500) {
            showMobileToast(`📍 Connected to phone GPS (${(distFromCompoundMeters / 1000).toFixed(1)} km away). Route shown from Argosino Kiosk.`, 4000);
            const kCoords = computeRouteFromKiosk(targetBuildingId);
            activeFullRouteCoords = kCoords;
            currentRouteSteps = buildSteps(kCoords, BUILDING_DIRECTORY, targetBuildingId);
            const targetBldg = BUILDING_DIRECTORY.find(b => b.id === targetBuildingId);
            currentRouteDestName = targetBldg ? targetBldg.name : 'Destination';
            updatePhoneRouteUI(kCoords);
            drawRoute(kCoords, { animated: false });
        } else {
            showMobileToast('📍 Connected to phone GPS. Route started from your location.', 3000);
            computeAndDrawRouteFromGPS(snappedCoord, targetBuildingId);
        }
        return;
    }

    // 5. Throttled Dynamic Route Trimming (Prevents main-thread UI lag)
    const nowTime = Date.now();
    let shouldTrimRoute = false;
    if (!lastTrimmedCoord) {
        shouldTrimRoute = true;
        lastTrimmedCoord = [userLng, userLat];
        lastTrimmedTime = nowTime;
    } else {
        const moveDist = turf.distance(turf.point(lastTrimmedCoord), userPt, { units: 'meters' });
        if (moveDist >= 1.2 || (nowTime - lastTrimmedTime >= 1200)) {
            shouldTrimRoute = true;
            lastTrimmedCoord = [userLng, userLat];
            lastTrimmedTime = nowTime;
        }
    }

    if (shouldTrimRoute) {
        try {
            const fullLine = turf.lineString(activeFullRouteCoords);
            const userSnappedOnRoute = turf.nearestPointOnLine(fullLine, userPt);
            const startPt = turf.point(activeFullRouteCoords[0]);
            const destPt = turf.point(activeFullRouteCoords[activeFullRouteCoords.length - 1]);

            // Check off-route distance (> 25m off route)
            const distFromRoute = turf.distance(userPt, userSnappedOnRoute, { units: 'meters' });
            if (distFromRoute > 25 && distFromCompoundMeters <= 1500) {
                offRouteCounter++;
                if (offRouteCounter >= 3 && (nowTime - lastRecalcTime > 8000)) {
                    lastRecalcTime = nowTime;
                    offRouteCounter = 0;
                    showMobileToast('🔄 Recalculating path from your location…', 2500);
                    computeAndDrawRouteFromGPS(snappedCoord, targetBuildingId);
                    return;
                }
            } else {
                offRouteCounter = 0;
            }

            // CRITICAL FIX FOR ISSUE 3: Only slice/trim route ahead if user is actually on or close to the route (<= 10 meters)
            let remainingDistMeters;
            if (distFromRoute <= 10) {
                const remainingSlice = turf.lineSlice(userSnappedOnRoute, destPt, fullLine);
                remainingDistMeters = turf.length(remainingSlice, { units: 'meters' });

                if (map.getSource('route-source')) {
                    map.getSource('route-source').setData(remainingSlice);
                }

                // Traveled path behind user
                try {
                    const traveledSlice = turf.lineSlice(startPt, userSnappedOnRoute, fullLine);
                    if (map.getSource('route-traveled-source')) {
                        map.getSource('route-traveled-source').setData(traveledSlice);
                    }
                } catch (e) { }
            } else {
                // User is far from route: DO NOT slice green line away! Keep route line full so user sees how to return
                remainingDistMeters = turf.length(fullLine, { units: 'meters' });
            }

            // Update UI distance and ETA
            const roundedDist = Math.max(0, Math.round(remainingDistMeters));
            const remainTag = document.getElementById('phone-route-remain-tag');
            if (remainTag) remainTag.textContent = `${roundedDist} m remaining`;

            const walkingMinutes = Math.max(1, Math.round(roundedDist / 72));
            const etaTimeEl = document.getElementById('phone-gps-eta-time');
            if (etaTimeEl) etaTimeEl.textContent = (roundedDist < 40) ? '< 1 min' : `${walkingMinutes} min`;
            const etaDistEl = document.getElementById('phone-gps-eta-dist');
            if (etaDistEl) etaDistEl.textContent = `${roundedDist} m remaining`;

            const totalDist = turf.length(fullLine, { units: 'meters' });
            const currentDist = Math.max(0, totalDist - remainingDistMeters);
            updateLiveNavigation(currentDist, totalDist);

            // 6. Check Arrival: User MUST be physically within 18m of target AND remaining route <= 12m
            const targetBldg = BUILDING_DIRECTORY.find(b => b.id === targetBuildingId);
            const targetCoord = targetBldg ? targetBldg.coords : activeFullRouteCoords[activeFullRouteCoords.length - 1];
            const actualDistToDest = turf.distance(userPt, turf.point(targetCoord), { units: 'meters' });

            if ((nowTime - gpsNavigationStartTime > 5000) && actualDistToDest <= 18 && remainingDistMeters <= 12) {
                showPhoneArrival(targetBuildingId);
                return;
            }
        } catch (err) {
            console.warn('Live GPS trimming notice:', err);
        }
    }

    // 7. Smooth Camera Glide Following (follows snapped walkway position)
    updateSmoothCameraFollow(snappedCoord, distFromCompoundMeters);
}

function recalculateRouteFromPoint(startCoord, buildingId) {
    computeAndDrawRouteFromGPS(startCoord, buildingId);
}

let userDismissedGPSPrompt = false;

function handleGPSError(err, buildingId) {
    console.warn('GPS location error:', err);
    if (err && err.code === 1) { // PERMISSION_DENIED
        if (gpsWatchId) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
        }
        if (!userDismissedGPSPrompt) {
            showGPSPermissionCard(buildingId);
        }
        return;
    }
    if (err && err.code === 3) {
        // Transient timeout while acquiring satellites indoors
        showMobileToast('📍 Acquiring GPS satellites… please ensure clear sky visibility', 3500);
        return;
    }
    showMobileToast('📍 Searching for GPS signal…', 3000);
}

function showGPSPermissionCard(buildingId) {
    let card = document.getElementById('phone-gps-permission-card');
    if (!card) {
        card = document.createElement('div');
        card.id = 'phone-gps-permission-card';
        card.className = 'phone-gps-permission-card';
        document.body.appendChild(card);
    }
    const bId = buildingId || selectedBuildingId || '';
    card.innerHTML = `
        <div class="pgpc-header">
            <div class="pgpc-title-wrap">
                <span class="pgpc-icon">📍</span>
                <span class="pgpc-title">Location Permission Notice</span>
            </div>
            <button class="pgpc-close-btn" onclick="dismissGPSPermissionCard()" title="Close">✕</button>
        </div>
        <div class="pgpc-desc">
            Your phone reported that location access is restricted. If you already tapped "Allow" in your browser:
        </div>
        <div class="pgpc-tip">
            <strong>Check your phone's main GPS switch:</strong><br>
            • <strong>iPhone:</strong> Go to <em>Settings → Privacy & Security → Location Services</em>. Ensure the top switch is <strong>ON</strong> and Safari has <strong>Precise Location ON</strong>.<br>
            • <strong>Android:</strong> Swipe down your notification panel and turn <strong>ON</strong> the main <strong>Location</strong> icon.
        </div>
        <div class="pgpc-actions">
            <button class="pgpc-btn primary" onclick="retryPhoneGPS('${bId}')">🔄 Retry GPS</button>
            <button class="pgpc-btn" style="background:#0284c7;color:#fff;" onclick="startTapToPlaceLocation('${bId}')">📍 Tap Map to Start</button>
            <button class="pgpc-btn secondary" onclick="dismissGPSPermissionCard(true)">🏛️ Use the Kiosk</button>
        </div>
    `;
}

function dismissGPSPermissionCard(startRoute = false) {
    userDismissedGPSPrompt = true;
    const card = document.getElementById('phone-gps-permission-card');
    if (card) card.remove();
    if (startRoute && selectedBuildingId) {
        startPhoneAnimatedRoute();
    }
}

function startTapToPlaceLocation(buildingId) {
    dismissGPSPermissionCard();
    showMobileToast('📍 Tap anywhere on the campus map to set your starting location!', 5000);
    
    const onMapTap = (e) => {
        map.off('click', onMapTap);
        const tappedCoord = [e.lngLat.lng, e.lngLat.lat];
        lastKnownGPSCoords = tappedCoord;
        
        if (!userGPSMarker) {
            const el = createUserGPSMarkerElement();
            userGPSMarker = new mapboxgl.Marker({ 
                element: el,
                rotationAlignment: 'map',
                pitchAlignment: 'map'
            }).setLngLat(tappedCoord).addTo(map);
        } else {
            userGPSMarker.setLngLat(tappedCoord);
        }
        
        computeAndDrawRouteFromGPS(tappedCoord, buildingId || selectedBuildingId);
        showMobileToast('📍 Route started from your selected point!', 3000);
    };
    
    map.once('click', onMapTap);
}

function retryPhoneGPS(buildingId) {
    userDismissedGPSPrompt = false;
    const card = document.getElementById('phone-gps-permission-card');
    if (card) card.remove();
    showMobileToast('📍 Requesting GPS permission…', 2500);
    startPhoneLiveGPS(buildingId || selectedBuildingId);
}

let autoRecenterTimer = null;

function scheduleAutoRecenter() {
    if (autoRecenterTimer) clearTimeout(autoRecenterTimer);
    if (!isMobileGPSActive) return;
    autoRecenterTimer = setTimeout(() => {
        if (isMobileGPSActive && !isUserFollowingGPS && lastKnownGPSCoords) {
            recenterOnUserGPS({ auto: true });
        }
    }, 5000);
}

function updateRecenterStateUI(isFollowing) {
    const centerBtn = document.getElementById('phone-gps-center-btn');
    const fabBtn = document.getElementById('mobile-recenter-btn');
    if (centerBtn) {
        centerBtn.classList.toggle('needs-recenter', !isFollowing);
        centerBtn.innerHTML = isFollowing ? '<span>🎯</span> Center' : '<span>🎯</span> Re-center';
    }
    if (fabBtn) {
        fabBtn.classList.toggle('active', !isFollowing && isMobileGPSActive);
    }
}

function recenterOnUserGPS(opts = {}) {
    if (autoRecenterTimer) {
        clearTimeout(autoRecenterTimer);
        autoRecenterTimer = null;
    }
    if (lastKnownGPSCoords) {
        isUserFollowingGPS = true;
        updateRecenterStateUI(true);
        map.flyTo({
            center: lastKnownGPSCoords,
            zoom: 19.5,
            pitch: 0,
            duration: 800
        });
        if (!opts.auto) {
            showMobileToast('🎯 Re-centered on your location');
        }
    } else {
        showMobileToast('📍 Acquiring GPS signal…');
        if (selectedBuildingId) {
            startPhoneLiveGPS(selectedBuildingId);
        }
    }
}

// Multi-touch tracking to distinguish 2-finger pinch/zoom from 1-finger pan
let activeTouchCount = 0;
const mapCanvas = map.getCanvas();
if (mapCanvas) {
    mapCanvas.addEventListener('touchstart', (e) => {
        activeTouchCount = e.touches ? e.touches.length : 1;
        if (isMobileGPSActive && !isUserFollowingGPS) {
            scheduleAutoRecenter();
        }
    }, { passive: true });

    mapCanvas.addEventListener('touchend', (e) => {
        activeTouchCount = e.touches ? e.touches.length : 0;
        if (isMobileGPSActive && !isUserFollowingGPS) {
            scheduleAutoRecenter();
        }
    }, { passive: true });

    mapCanvas.addEventListener('touchcancel', () => {
        activeTouchCount = 0;
    }, { passive: true });
}

// Pause follow ONLY on single-finger manual drag, NOT during pinch zoom
map.on('dragstart', (e) => {
    if (!isMobileGPSActive) return;
    const touches = e.originalEvent && e.originalEvent.touches;
    const touchCount = touches ? touches.length : activeTouchCount;
    // If user is pinching (2+ fingers), keep follow active!
    if (touchCount > 1) {
        return;
    }
    isUserFollowingGPS = false;
    updateRecenterStateUI(false);
    scheduleAutoRecenter();
});

map.on('dragend', () => {
    if (isMobileGPSActive && !isUserFollowingGPS) {
        scheduleAutoRecenter();
    }
});

// When zoom ends: If camera is following GPS, re-center smoothly on user's location at the new zoom level!
map.on('zoomend', () => {
    if (isMobileGPSActive && isUserFollowingGPS && lastKnownGPSCoords) {
        map.easeTo({
            center: lastKnownGPSCoords,
            duration: 250,
            easing: t => t
        });
    }
});

// --- Kiosk QR Code Handoff Generator ---
function getMobileNavigationUrl(buildingId) {
    const host = window.location.hostname;
    const isLocal = !host || host === 'localhost' || host === '127.0.0.1' || 
                    window.location.protocol === 'file:' || 
                    /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
    
    let baseOrigin = (isLocal && PUBLIC_TUNNEL_URL) 
        ? PUBLIC_TUNNEL_URL.replace(/\/$/, '') 
        : window.location.origin;

    let path = '/';
    if (window.location.protocol !== 'file:' && window.location.pathname && window.location.pathname !== '/') {
        path = window.location.pathname;
    }
    if (!path.startsWith('/')) path = '/' + path;

    const viewMode = (currentMapStyleMode === 'mapbox') ? 'mapbox' : 'google';
    return `${baseOrigin}${path}?dest=${encodeURIComponent(buildingId)}&view=${viewMode}`;
}

let currentQRCodeInstance = null;
function updateBuildingQR(buildingId) {
    const qrBox = document.getElementById('bp-qr-box');
    if (!qrBox) return;

    const render = () => {
        const url = getMobileNavigationUrl(buildingId);
        qrBox.innerHTML = '';
        try {
            if (typeof QRCode !== 'undefined') {
                currentQRCodeInstance = new QRCode(qrBox, {
                    text: url,
                    width: 66,
                    height: 66,
                    colorDark: "#020617",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } else {
                throw new Error('QRCode library not ready');
            }
        } catch (err) {
            qrBox.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=66x66&data=${encodeURIComponent(url)}" alt="QR" style="width:100%;height:100%;">`;
        }

        const qrLink = document.getElementById('bp-qr-link');
        if (qrLink) {
            qrLink.href = url;
            qrLink.title = url;
        }
    };

    render();

    if (window.location.protocol !== 'file:') {
        fetch('/api/tunnel')
            .then(res => res.json())
            .then(data => {
                if (data && data.url && data.url !== PUBLIC_TUNNEL_URL) {
                    PUBLIC_TUNNEL_URL = data.url;
                    render();
                }
            })
            .catch(() => {});
    }
}

// --- URL Query Parameter Auto-Router ---
function handleUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const destParam = params.get('dest');
    const modeParam = params.get('mode');
    const viewParam = params.get('view');
    if (viewParam === 'mapbox' || modeParam === 'mapbox') {
        const interval = setInterval(() => {
            if (mapReady) {
                clearInterval(interval);
                if (currentMapStyleMode !== 'mapbox') toggleMapboxView();
            }
        }, 100);
    }

    if (destParam) {
        const interval = setInterval(() => {
            if (mapReady && typeof BUILDING_DIRECTORY !== 'undefined' && BUILDING_DIRECTORY.length > 0 && roadGraph && roadGraph.size > 0) {
                clearInterval(interval);
                const bldg = BUILDING_DIRECTORY.find(b => b.id.toLowerCase() === destParam.toLowerCase());
                if (bldg) {
                    if (isPhoneMode()) {
                        isIntroAnimating = false;
                        map.stop();
                        selectedBuildingId = bldg.id;
                        showPhoneBuildingDetails(bldg.id);
                        // Clean URL query parameters so future refreshes do not trap the user in this destination!
                        try {
                            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                            window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
                        } catch (e) {}
                    } else {
                        navigateTo(bldg.id);
                    }
                }
            }
        }, 250);
    }

    // On mobile viewports or QR scan visits: Show Welcome / Onboarding modal if not seen in session
    if ((isPhoneMode() || window.innerWidth <= 768 || destParam) && !sessionStorage.getItem('da_lares_welcome_seen')) {
        setTimeout(showPhoneWelcomeModal, 450);
    }
}

// Initialize phone bottom sheet gestures when DOM is ready
initPhoneSheetGestures();


// ============================================================
// Expose functions referenced by inline HTML onclick/oninput handlers.
// These will be migrated to addEventListener in a future step.
// ============================================================
window.cancelPhoneRoute = cancelPhoneRoute;
window.clearPhoneSearch = clearPhoneSearch;
window.closeBuildingPanel = closeBuildingPanel;
window.closeColorPicker = closeColorPicker;
window.closePhoneArrivalPopup = closePhoneArrivalPopup;
window.closePhotoLightbox = closePhotoLightbox;
window.closeRouteAndReset = closeRouteAndReset;
window.collapseSidebarMenu = collapseSidebarMenu;
window.cyclePhoneSheetSnap = cyclePhoneSheetSnap;
window.exitRouteMode = exitRouteMode;
window.filterDirectory = filterDirectory;
window.filterPhoneDirectory = filterPhoneDirectory;
window.flyToView = flyToView;
window.getDirections = getDirections;
window.handleWelcomeContinue = handleWelcomeContinue;
window.handleWelcomeSkip = handleWelcomeSkip;
window.navigateTo = navigateTo;
window.recenterOnUserGPS = recenterOnUserGPS;
window.replayFromArrivalPopup = replayFromArrivalPopup;
window.replayPhoneRoute = replayPhoneRoute;
window.replayRoute = replayRoute;
window.resetIdle = resetIdle;
window.saveColorPicker = saveColorPicker;
window.setRouteCameraMode = setRouteCameraMode;
window.setRouteSpeed = setRouteSpeed;
window.showPhoneDirectoryView = showPhoneDirectoryView;
window.showPhoneWelcomeModal = showPhoneWelcomeModal;
window.startMobileGPSNavigation = startMobileGPSNavigation;
window.startPhoneAnimatedRoute = startPhoneAnimatedRoute;
window.startPhoneLiveGPS = startPhoneLiveGPS;
window.toggleBoundary = toggleBoundary;
window.toggleBuildings = toggleBuildings;
window.toggleMapboxView = toggleMapboxView;
window.toggleMarkers = toggleMarkers;
window.togglePhoneRouteSheet = togglePhoneRouteSheet;
window.toggleSettingChip = toggleSettingChip;
window.toggleSidebarMenu = toggleSidebarMenu;
window.toggleTerrain = toggleTerrain;
window.toggleTrees = toggleTrees;
window.useEyeDropper = useEyeDropper;
