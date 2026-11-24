// DA-LARES Wayfinding — QR Code Handoff Generator Module

import { state } from './data/state.js';

let currentQRCodeInstance = null;
let currentZoomQRCodeInstance = null;

export function isPublicDomainUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
    // Disallow RFC 1918 private IPv4 addresses
    if (/^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(url)) return false;
    // Must be a valid HTTPS public tunnel or domain
    return url.startsWith('https://');
}

export function fetchTunnelInfo() {
    if (typeof window === 'undefined' || window.location.protocol === 'file:') return Promise.resolve(null);
    return fetch('/api/tunnel')
        .then(res => res.json())
        .then(data => {
            if (data) {
                if (isPublicDomainUrl(data.tunnelUrl)) {
                    state.PUBLIC_TUNNEL_URL = data.tunnelUrl;
                } else if (isPublicDomainUrl(data.url)) {
                    state.PUBLIC_TUNNEL_URL = data.url;
                } else {
                    state.PUBLIC_TUNNEL_URL = null;
                }

                if (data.localUrl) {
                    state.LOCAL_IP_URL = data.localUrl;
                }
            }
            return data;
        })
        .catch(err => {
            console.warn('[QR] Could not fetch tunnel info:', err);
            return null;
        });
}

// Initial fetch on page load & populate Welcome Menu QR code
fetchTunnelInfo().then(() => {
    updateWelcomeQR();
});

export function updateWelcomeQR() {
    const qrBox = document.getElementById('welcome-qr-box');
    if (!qrBox) return;

    fetchTunnelInfo().then(() => {
        const url = getMobileNavigationUrl('1');
        qrBox.innerHTML = '';
        try {
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrBox, {
                    text: url,
                    width: 128,
                height: 128,
                    colorDark: '#07100e',
                    colorLight: '#ffffff',
                    correctLevel: (typeof QRCode !== 'undefined' && QRCode.CorrectLevel) ? QRCode.CorrectLevel.M : 0
                });
            }
        } catch (e) {
            console.error('[QR] Welcome QR generation error:', e);
        }
    });
}

export function getMobileNavigationUrl(buildingId) {
    const host = window.location.hostname;
    const isLocal = !host || host === 'localhost' || host === '127.0.0.1' || window.location.protocol === 'file:';

    let baseOrigin = '';

    // Prefer public tunnel so mobile data phones (4G/5G) can access from anywhere
    if (state.PUBLIC_TUNNEL_URL) {
        baseOrigin = state.PUBLIC_TUNNEL_URL.replace(/\/$/, '');
    } else if (!isLocal && !/^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) {
        baseOrigin = window.location.origin;
    } else if (state.LOCAL_IP_URL) {
        baseOrigin = state.LOCAL_IP_URL.replace(/\/$/, '');
    } else {
        baseOrigin = window.location.origin;
    }

    // STRICT: Mobile navigation QR codes MUST ALWAYS open the new upgraded 3D map (index.html)
    // Never propagate legacy.html or previous version pages to phone users!
    const path = '/index.html';

    const currentMode = state.currentMapStyleMode || 'google';
    const viewMode = (currentMode === 'mapbox') ? 'mapbox' : 'google';
    const destParam = (buildingId && buildingId !== '1') ? `dest=${encodeURIComponent(buildingId)}&` : '';
    return `${baseOrigin}${path}?${destParam}mode=phone&view=${viewMode}&v=74`;
}

export function updateBuildingQR(buildingId) {
    const qrBox = document.getElementById('bp-qr-box');
    if (!qrBox) return;

    fetchTunnelInfo().then(() => {
        const url = getMobileNavigationUrl(buildingId);
        qrBox.innerHTML = '';
        try {
            if (typeof QRCode !== 'undefined') {
                currentQRCodeInstance = new QRCode(qrBox, {
                    text: url,
                    width: 120,
                    height: 120,
                    colorDark: '#0f172a',
                    colorLight: '#ffffff',
                    correctLevel: (typeof QRCode !== 'undefined' && QRCode.CorrectLevel) ? QRCode.CorrectLevel.M : 0
                });
            } else {
                qrBox.innerHTML = '<div style="font-size:10px;color:#94a3b8;padding:10px;text-align:center;">QR library loading...</div>';
            }
        } catch (e) {
            console.error('[QR] Building QR generation error:', e);
        }

        const linkEl = document.getElementById('bp-qr-link');
        if (linkEl) {
            linkEl.href = url;
            linkEl.textContent = `Open Link: ${url.replace(/^https?:\/\//, '')}`;
        }
    });
}

export function updateRouteQR(buildingId) {
    const qrBox = document.getElementById('route-qr-box');
    if (!qrBox) return;

    fetchTunnelInfo().then(() => {
        const url = getMobileNavigationUrl(buildingId);
        qrBox.innerHTML = '';
        try {
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrBox, {
                    text: url,
                    width: 68,
                    height: 68,
                    colorDark: '#0f172a',
                    colorLight: '#ffffff',
                    correctLevel: (typeof QRCode !== 'undefined' && QRCode.CorrectLevel) ? QRCode.CorrectLevel.M : 0
                });
            } else {
                qrBox.innerHTML = '<div style="font-size:9px;color:#94a3b8;padding:6px;text-align:center;">QR loading...</div>';
            }
        } catch (e) {
            console.error('[QR] Route QR Code generation error:', e);
        }
    });
}

let qrCountdownInterval = null;
let qrRemainingSeconds = 25;
const QR_AUTO_EXIT_SECONDS = 25;

export function startQRAutoExitCountdown() {
    clearQRAutoExitCountdown();
    qrRemainingSeconds = QR_AUTO_EXIT_SECONDS;
    updateQRCountdownDisplay(qrRemainingSeconds);

    qrCountdownInterval = setInterval(() => {
        qrRemainingSeconds--;
        updateQRCountdownDisplay(qrRemainingSeconds);
        if (qrRemainingSeconds <= 0) {
            clearQRAutoExitCountdown();
            handleQRAutoExitTimeout();
        }
    }, 1000);
}

export function clearQRAutoExitCountdown() {
    if (qrCountdownInterval) {
        clearInterval(qrCountdownInterval);
        qrCountdownInterval = null;
    }
}

export function resetQRAutoExitCountdown() {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal && modal.style.display === 'flex') {
        qrRemainingSeconds = QR_AUTO_EXIT_SECONDS;
        updateQRCountdownDisplay(qrRemainingSeconds);
    }
}

function updateQRCountdownDisplay(seconds) {
    const el = document.getElementById('qr-countdown-num');
    if (el) el.textContent = seconds;
}

function handleQRAutoExitTimeout() {
    const modal = document.getElementById('qr-zoom-modal');
    if (!modal || modal.style.display === 'none') return;

    if (typeof window.triggerAutoExitToIdle === 'function') {
        window.triggerAutoExitToIdle('qr_timeout');
    } else {
        closeQRZoomModal();
        if (typeof window.exitRouteMode === 'function') window.exitRouteMode();
        if (typeof window.closeBuildingPanel === 'function') window.closeBuildingPanel();
        if (typeof window.startIdleRotation === 'function') window.startIdleRotation();
    }
}

export function openQRZoomModal(buildingId) {
    const targetBuilding = (buildingId !== undefined && buildingId !== null) ? buildingId : (state.selectedBuildingId || '1');
    const modal = document.getElementById('qr-zoom-modal');
    const zoomBox = document.getElementById('qr-zoom-box');
    if (!modal || !zoomBox) return;

    const subtitleEl = modal.querySelector('.qr-zoom-subtitle');
    if (subtitleEl) {
        subtitleEl.textContent = (targetBuilding === '1')
            ? 'Point camera at QR code to open the 3D campus map on your phone'
            : 'Point camera at QR code to open live route';
    }

    modal.style.display = 'flex';
    startQRAutoExitCountdown();

    fetchTunnelInfo().then(() => {
        const url = getMobileNavigationUrl(targetBuilding);
        zoomBox.innerHTML = '';
        try {
            if (typeof QRCode !== 'undefined') {
                currentZoomQRCodeInstance = new QRCode(zoomBox, {
                    text: url,
                    width: 230,
                    height: 230,
                    colorDark: '#0f172a',
                    colorLight: '#ffffff',
                    correctLevel: (typeof QRCode !== 'undefined' && QRCode.CorrectLevel) ? QRCode.CorrectLevel.H : 0
                });
            } else {
                zoomBox.innerHTML = '<div style="font-size:12px;color:#94a3b8;">Loading QR...</div>';
            }
        } catch (e) {
            console.error('[QR] Zoom QR generation error:', e);
        }
    });
}

export function closeQRZoomModal(event) {
    if (event) event.stopPropagation();
    clearQRAutoExitCountdown();
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) modal.style.display = 'none';
}

// Global ESC listener to close QR zoom modal
if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeQRZoomModal();
    });
}

window.getMobileNavigationUrl = getMobileNavigationUrl;
window.updateWelcomeQR = updateWelcomeQR;
window.updateBuildingQR = updateBuildingQR;
window.updateRouteQR = updateRouteQR;
window.openQRZoomModal = openQRZoomModal;
window.closeQRZoomModal = closeQRZoomModal;
window.startQRAutoExitCountdown = startQRAutoExitCountdown;
window.clearQRAutoExitCountdown = clearQRAutoExitCountdown;
window.resetQRAutoExitCountdown = resetQRAutoExitCountdown;
