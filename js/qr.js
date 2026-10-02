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

    const currentMode = state.currentMapStyleMode || (typeof currentMapStyleMode !== 'undefined' ? currentMapStyleMode : 'google');
    const viewMode = (currentMode === 'mapbox') ? 'mapbox' : 'google';
    return `${baseOrigin}${path}?dest=${encodeURIComponent(buildingId)}&view=${viewMode}`;
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
                if (data && data.url && data.url !== state.PUBLIC_TUNNEL_URL) {
                    state.PUBLIC_TUNNEL_URL = data.url;
                    render();
                }
            })
            .catch(() => {});
    }
}

// Window reflections
window.getMobileNavigationUrl = getMobileNavigationUrl;
window.updateBuildingQR = updateBuildingQR;
