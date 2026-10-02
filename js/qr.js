// DA-LARES Wayfinding — QR Code Handoff Generator Module

import { state } from './data/state.js';

let currentQRCodeInstance = null;

// Initial tunnel check
if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
    fetch('/api/tunnel')
        .then(res => res.json())
        .then(data => {
            if (data && data.url) {
                state.PUBLIC_TUNNEL_URL = data.url;
            }
        })
        .catch(() => {});
}

export function getMobileNavigationUrl(buildingId) {
    const host = window.location.hostname;
    const isLocal = !host || host === 'localhost' || host === '127.0.0.1' || 
                    window.location.protocol === 'file:' || 
                    /^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
    
    let baseOrigin = (isLocal && state.PUBLIC_TUNNEL_URL) 
        ? state.PUBLIC_TUNNEL_URL.replace(/\/$/, '') 
        : window.location.origin;

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

    const render = () => {
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
            console.error("QR Code generation error:", e);
        }

        const linkEl = document.getElementById('bp-qr-link');
        if (linkEl) {
            linkEl.href = url;
            linkEl.textContent = `Open Link: ${url.replace(/^https?:\/\//, '')}`;
        }
    };

    if (state.PUBLIC_TUNNEL_URL) {
        render();
    } else {
        fetch('/api/tunnel')
            .then(res => res.json())
            .then(data => {
                if (data && data.url) {
                    state.PUBLIC_TUNNEL_URL = data.url;
                }
                render();
            })
            .catch(() => render());
    }
}

window.getMobileNavigationUrl = getMobileNavigationUrl;
window.updateBuildingQR = updateBuildingQR;
