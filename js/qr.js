// DA-LARES Wayfinding — QR Code Handoff Generator Module

import { state } from './data/state.js';

let currentQRCodeInstance = null;
let currentZoomQRCodeInstance = null;

export function fetchTunnelInfo() {
    if (typeof window === 'undefined' || window.location.protocol === 'file:') return Promise.resolve(null);
    return fetch('/api/tunnel')
        .then(res => res.json())
        .then(data => {
            if (data) {
                if (data.tunnelUrl && !data.tunnelUrl.includes('localhost') && !data.tunnelUrl.includes('127.0.0.1')) {
                    state.PUBLIC_TUNNEL_URL = data.tunnelUrl;
                } else if (data.url && !data.url.includes('localhost') && !data.url.includes('127.0.0.1')) {
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

// Initial fetch on page load
fetchTunnelInfo();

export function getMobileNavigationUrl(buildingId) {
    const host = window.location.hostname;
    const isLocal = !host || host === 'localhost' || host === '127.0.0.1' || window.location.protocol === 'file:';

    let baseOrigin = '';

    // Prefer public tunnel so mobile data phones can access from anywhere
    if (state.PUBLIC_TUNNEL_URL) {
        baseOrigin = state.PUBLIC_TUNNEL_URL.replace(/\/$/, '');
    } else if (state.LOCAL_IP_URL) {
        baseOrigin = state.LOCAL_IP_URL.replace(/\/$/, '');
    } else if (!isLocal) {
        baseOrigin = window.location.origin;
    } else {
        baseOrigin = window.location.origin;
    }

    let path = '/';
    if (window.location.protocol !== 'file:' && window.location.pathname && window.location.pathname !== '/') {
        path = window.location.pathname;
    }
    if (!path.startsWith('/')) path = '/' + path;

    const currentMode = state.currentMapStyleMode || 'google';
    const viewMode = (currentMode === 'mapbox') ? 'mapbox' : 'google';
    return `${baseOrigin}${path}?dest=${encodeURIComponent(buildingId)}&mode=phone&view=${viewMode}`;
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

export function openQRZoomModal(buildingId) {
    const targetBuilding = buildingId || state.selectedBuildingId || '1';
    const modal = document.getElementById('qr-zoom-modal');
    const zoomBox = document.getElementById('qr-zoom-box');
    if (!modal || !zoomBox) return;

    modal.style.display = 'flex';

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
window.updateBuildingQR = updateBuildingQR;
window.updateRouteQR = updateRouteQR;
window.openQRZoomModal = openQRZoomModal;
window.closeQRZoomModal = closeQRZoomModal;
