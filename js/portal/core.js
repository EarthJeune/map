/**
 * Core shared utilities, role theme catalog, SVG icons & PortalState for iGUIDE Portal
 */

import { buildIdempotencyKey, dedupeInFlightFetch } from '../ui-guard.js';

export const SVG_ICONS = {
    dashboard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
    pin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    building: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
    image: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
    folder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
    sprout: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>`,
    tree: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-7l-2-2"/><path d="M17 8v.8A6 6 0 0 1 13.8 20H10A6.5 6.5 0 0 1 7 8a5 5 0 0 1 10 0Z"/><path d="m14 14-2 2"/></svg>`,
    route: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`,
    landmark: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
    history: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
    users: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    checkSquare: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    drawFootprint: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/></svg>`,
    drawPlot: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>`,
    drawPill: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`,
    shield: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    copy: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    edit: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
    trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
    plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`,
    minus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`,
    upload: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>`,
    box: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
    map: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>`,
    globe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
    eye: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    scissors: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/></svg>`,
    lock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    lightbulb: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
    clock: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    alertTriangle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
    check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    star: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    rotateCcw: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    bell: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
    xClose: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`
};

export const ROLE_META = {
    super_admin: { slug: 'super_admin', label: 'Super Admin', tag: 'OVERSEER COMMAND', color: '#a855f7', light: '#c084fc' },
    administrator: { slug: 'administrator', label: 'Administrator (MIS Supt.)', tag: 'MIS ADMINISTRATOR', color: '#10b981', light: '#34d399' },
    gis_editor: { slug: 'gis_editor', label: 'GIS Editor', tag: 'SPATIAL EDITOR', color: '#0ea5e9', light: '#38bdf8' },
    reviewer: { slug: 'reviewer', label: 'Station Reviewer', tag: 'STATION REVIEWER', color: '#f59e0b', light: '#fbbf24' },
    visitor: { slug: 'visitor', label: 'Visitor Preview', tag: 'PUBLIC PREVIEW', color: '#14b8a6', light: '#2dd4bf' }
};

export const STATION_NAMES = {
    lares: 'DA-LARES (Lipa City)',
    qares: 'DA-QARES (Tiaong)',
    rares: 'DA-RARES (Tanay)',
    cares: 'DA-CARES (Naic)'
};

const safeSessionGet = (k, fallback = '') => {
    try { return (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(k) : null) || fallback; } catch (_) { return fallback; }
};

const safeLocalGet = (k, fallback = '') => {
    try { return (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null) || fallback; } catch (_) { return fallback; }
};

let _prefSyncTimer = null;
const _pendingServerPrefs = {};

export function syncPortalPrefToServer(key, value) {
    if (!key) return;
    _pendingServerPrefs[key] = value;
    if (PortalState && typeof PortalState.uiPreferences === 'object' && PortalState.uiPreferences) {
        PortalState.uiPreferences[key] = value;
    }
    if (_prefSyncTimer) clearTimeout(_prefSyncTimer);
    _prefSyncTimer = setTimeout(async () => {
        const tok = PortalState?.token;
        if (!tok || Object.keys(_pendingServerPrefs).length === 0) return;
        const batch = { ..._pendingServerPrefs };
        for (const k of Object.keys(batch)) delete _pendingServerPrefs[k];
        try {
            await fetch('/api/admin/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Token': tok },
                body: JSON.stringify({ preferences: batch })
            });
        } catch (_) {}
    }, 350);
}

export function hydratePortalPrefsFromServer(uiPrefs = {}, email = '') {
    if (!uiPrefs || typeof uiPrefs !== 'object') return;
    PortalState.uiPreferences = { ...(PortalState.uiPreferences || {}), ...uiPrefs };
    try {
        if (typeof localStorage === 'undefined') return;
        const cleanEmail = String(email || PortalState.email || '').trim().toLowerCase();
        for (const [k, v] of Object.entries(uiPrefs)) {
            if (v === undefined || v === null) continue;
            const strVal = typeof v === 'object' ? JSON.stringify(v) : String(v);
            localStorage.setItem(k, strVal);
            if (cleanEmail) localStorage.setItem(`${k}__${cleanEmail}`, strVal);
            if (k === 'iguide_login_theme' && (strVal === 'light' || strVal === 'dark') && cleanEmail) {
                localStorage.setItem(`iguide_theme_${cleanEmail}`, strVal);
            }
        }
    } catch (_) {}
}

export function getSavedPortalPref(key, fallback = '') {
    try {
        const cleanEmail = String(PortalState?.email || (typeof localStorage !== 'undefined' ? localStorage.getItem('iguide_remember_email') : '') || '').trim().toLowerCase();
        if (PortalState?.uiPreferences && PortalState.uiPreferences[key] !== undefined && PortalState.uiPreferences[key] !== null && PortalState.uiPreferences[key] !== '') {
            return String(PortalState.uiPreferences[key]);
        }
        if (typeof localStorage !== 'undefined') {
            if (cleanEmail) {
                const perUser = localStorage.getItem(`${key}__${cleanEmail}`);
                if (perUser !== null && perUser !== undefined && perUser !== '') return perUser;
            }
            const v = localStorage.getItem(key);
            if (v !== null && v !== undefined && v !== '') return v;
        }
        return fallback;
    } catch (_) {
        return fallback;
    }
}

export function setSavedPortalPref(key, value) {
    try {
        const strVal = String(value);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, strVal);
            const cleanEmail = String(PortalState?.email || localStorage.getItem('iguide_remember_email') || '').trim().toLowerCase();
            if (cleanEmail) localStorage.setItem(`${key}__${cleanEmail}`, strVal);
        }
        syncPortalPrefToServer(key, strVal);
    } catch (_) { }
}

const _initialPortalState = {
    token: safeSessionGet('da_admin_token', '') || safeLocalGet('da_admin_token', ''),
    baseRole: 'super_admin',
    effectiveRole: 'super_admin',
    switchedRole: null,
    roleName: 'Super Admin',
    roleColor: '#a855f7',
    stationScope: 'all',
    currentStation: safeLocalGet('iguide_active_station', '') || safeSessionGet('iguide_active_station', 'lares'),
    currentTab: safeLocalGet('iguide_active_tab', '') || safeSessionGet('iguide_active_tab', 'dashboard'),
    email: '',
    fullName: '',
    jobTitle: '',
    officeName: '',
    permissions: [],
    cachedBuildings: [],
    cachedOffices: [],
    cachedPlots: [],
    cachedStations: [],
    editingBuilding: null,
    editingOffice: null,
    editingPlot: null,
    pinMapInstance: null,
    pinMarkerInstance: null,
    onUnauthorized: null
};

export const PortalState = (typeof window !== 'undefined')
    ? (window.__IGUIDE_PORTAL_STATE__ = window.__IGUIDE_PORTAL_STATE__ || _initialPortalState)
    : _initialPortalState;

export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function showToast(msg) {
    const el = document.getElementById('admin-toast');
    const textEl = document.getElementById('admin-toast-text');
    if (!el || !textEl) return;
    textEl.textContent = msg;
    el.style.display = 'inline-flex';
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

export function copyTextPill(text) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    showToast(`Copied to clipboard: ${text}`);
}

export function broadcastDbSync() {
    try {
        localStorage.setItem('da_db_sync_ts', String(Date.now()));
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('iguide:db-sync', { detail: { station: PortalState.currentStation } }));
        }
        if (typeof BroadcastChannel !== 'undefined') {
            const ch = new BroadcastChannel('da_spatial_hub_sync');
            ch.postMessage({ type: 'db_updated', station: PortalState.currentStation, timestamp: Date.now() });
            ch.close();
        }
    } catch (_) { }
}

export async function apiFetch(url, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const bodyStr = typeof options.body === 'string' ? options.body : '';
    const isMutation = method !== 'GET' && method !== 'HEAD';
    const idempKey = isMutation ? buildIdempotencyKey(method, url, bodyStr) : '';

    const runFetch = async () => {
        const headers = {
            'Content-Type': 'application/json',
            'X-Admin-Token': PortalState.token,
            ...(isMutation ? { 'X-Idempotency-Key': idempKey } : {}),
            ...(options.headers || {})
        };
        const res = await fetch(url, { ...options, headers });
        if (res.status === 401) {
            if (typeof PortalState.onUnauthorized === 'function') {
                PortalState.onUnauthorized();
            } else {
                const ov = document.getElementById('login-overlay');
                if (ov) ov.style.display = 'flex';
            }
            throw new Error('Unauthorized');
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    };

    if (isMutation) {
        return dedupeInFlightFetch(idempKey, runFetch);
    }
    return runFetch();
}

export function canPublish() {
    return Array.isArray(PortalState.permissions) && PortalState.permissions.includes('changes:publish');
}

export function hasPermission(permCode) {
    return Array.isArray(PortalState.permissions) && PortalState.permissions.includes(permCode);
}

export const CATEGORY_LABELS = {
    infrastructure: 'Agri Infrastructure / Facility',
    office: 'Office Building',
    laboratory: 'Laboratory Facility',
    conference: 'Conference / Training Hall',
    trial_sites: 'Agricultural Test / Trial Site',
    orchard: 'Orchard & Perennial Crops',
    digital_agri: 'Digital Agriculture Project'
};

export const FACILITY_STATUS_META = {
    Existing: {
        cls: 'status-pill-live',
        dotCls: 'status-dot-live',
        label: 'Existing',
        help: 'Visible on the public 3D map by default with its 3D model / standard polygon.'
    },
    'Under Construction': {
        cls: 'status-pill-dev',
        dotCls: 'status-dot-dev',
        label: 'Under Construction',
        help: 'Shown as an amber construction cube + warning badge when the Under Construction filter is enabled.'
    },
    Proposed: {
        cls: 'status-pill-blue',
        dotCls: '',
        label: 'Proposed',
        help: 'Shown as a dashed ground land-use polygon + branded iG planned badge when Proposed is enabled.'
    }
};

export const PIN_COLOR_PRESETS = [
    { hex: '#10b981', name: 'Emerald Green' },
    { hex: '#0ea5e9', name: 'Sky Cyan' },
    { hex: '#3b82f6', name: 'Royal Blue' },
    { hex: '#f59e0b', name: 'Amber Gold' },
    { hex: '#8b5cf6', name: 'Violet' },
    { hex: '#ec4899', name: 'Rose Pink' },
    { hex: '#14b8a6', name: 'Teal' },
    { hex: '#ef4444', name: 'Crimson Red' }
];

export const ICON_GALLERY = [
    { id: 'building', label: 'Building', svgKey: 'building' },
    { id: 'office', label: 'Offices', svgKey: 'landmark' },
    { id: 'flask', label: 'Laboratory', svgKey: 'box' },
    { id: 'sprout', label: 'Crops / Field', svgKey: 'sprout' },
    { id: 'tree', label: 'Orchard / Tree', svgKey: 'tree' },
    { id: 'users', label: 'Hall / People', svgKey: 'users' },
    { id: 'warehouse', label: 'Storage', svgKey: 'folder' },
    { id: 'shield', label: 'Security', svgKey: 'shield' },
    { id: 'pin', label: 'Landmark', svgKey: 'pin' },
    { id: 'route', label: 'Gate / Road', svgKey: 'route' }
];

export function renderFacilityStatusBadge(status) {
    const meta = FACILITY_STATUS_META[status] || FACILITY_STATUS_META.Existing;
    return `<span class="status-pill ${meta.cls}">${meta.dotCls ? `<span class="${meta.dotCls}"></span>` : ''}<span>${escapeHtml(meta.label)}</span></span>`;
}

export function renderWorkflowBanner(actionDesc = 'Editing Station Data') {
    const adminDirect = canPublish();
    return `
        <div class="workflow-bar">
            <div class="wf-steps">
                <span class="wf-step active"><span class="wf-num">1</span><span>${escapeHtml(actionDesc)}</span></span>
                <span class="wf-arrow">→</span>
                <span class="wf-step ${adminDirect ? 'optional' : ''}"><span class="wf-num">2</span><span>Station Reviewer${adminDirect ? ' (Optional)' : ' Approval'}</span></span>
                <span class="wf-arrow">→</span>
                <span class="wf-step ${adminDirect ? 'ready' : ''}"><span class="wf-num">3</span><span>Admin Publish Live</span></span>
            </div>
            <div class="wf-caption">
                ${adminDirect
                    ? 'Administrator mode: Publish immediately to the live map, or route via Reviewer.'
                    : 'GIS Editor mode: Saves create a tracked Change Request for your Station Reviewer before going live.'}
            </div>
        </div>
    `;
}

export function animateCounters(rootEl = document) {
    if (typeof requestAnimationFrame !== 'function') return;
    rootEl.querySelectorAll('[data-count-to]').forEach(el => {
        const target = Number(el.dataset.countTo || 0);
        if (!Number.isFinite(target) || target === 0) {
            el.textContent = '0';
            return;
        }
        const duration = 420;
        const start = performance.now();
        function frame(now) {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = String(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    });
}

export function fileToWebpDataUrl(file, maxWidth = 1440, quality = 0.84) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read selected image file.'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('Unsupported or corrupted image format.'));
            img.onload = () => {
                let w = img.naturalWidth || img.width;
                let h = img.naturalHeight || img.height;
                if (w > maxWidth) {
                    h = Math.round((h * maxWidth) / w);
                    w = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, w);
                canvas.height = Math.max(1, h);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                try {
                    resolve(canvas.toDataURL('image/webp', quality));
                } catch (_) {
                    resolve(reader.result);
                }
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

export function closeGovModal() {
    document.getElementById('gov-modal')?.classList.remove('open');
}

export function openGovModal({ title = '', bodyHtml = '', footerHtml = '', maxWidth = '780px' } = {}) {
    const backdrop = document.getElementById('gov-modal');
    const box = document.getElementById('gov-modal-box');
    const titleEl = document.getElementById('gov-modal-title');
    const bodyEl = document.getElementById('gov-modal-body');
    const footerEl = document.getElementById('gov-modal-footer');
    if (!backdrop || !bodyEl) return;

    if (box) box.style.maxWidth = maxWidth;
    if (titleEl) titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    if (footerEl) footerEl.innerHTML = footerHtml;
    document.getElementById('gov-modal-close-x')?.addEventListener('click', closeGovModal, { once: true });
    backdrop.classList.add('open');
    bodyEl.scrollTop = 0;
    if (box) box.scrollTop = 0;
}

if (typeof window !== 'undefined') {
    window.copyTextPill = copyTextPill;
    window.closeGovModal = closeGovModal;
}


// =========================================================================
// SHARED PAGINATION BAR & DRAG-TO-RESIZE TABLE COLUMNS (LOCALSTORAGE)
// =========================================================================
export function buildPageNumbers(page, totalPages) {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    if (start > 2) pages.push('...');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
}

export function renderPaginationBarHtml({ total = 0, page = 1, limit = 10, itemLabel = 'items', pageAttr = 'data-page', limitId = 'portal-page-limit' } = {}) {
    const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = total === 0 ? 0 : ((safePage - 1) * limit) + 1;
    const endIdx = Math.min(total, safePage * limit);
    const nums = buildPageNumbers(safePage, totalPages);
    return `
        <div class="log-pagination-info">Showing <strong>${startIdx}–${endIdx}</strong> of <strong>${total}</strong> ${escapeHtml(itemLabel)}</div>
        <div class="log-pagination-controls">
            <select id="${escapeHtml(limitId)}" class="form-control log-page-size-select" aria-label="Items per page">
                ${[10, 15, 20, 25, 50].map(sz => `<option value="${sz}" ${Number(limit) === sz ? 'selected' : ''}>${sz} / page</option>`).join('')}
            </select>
            <button type="button" class="log-page-btn" ${pageAttr}="${safePage - 1}" ${safePage <= 1 ? 'disabled' : ''}>← Prev</button>
            ${nums.map(n => n === '...'
                ? `<span class="log-page-ellipsis">…</span>`
                : `<button type="button" class="log-page-btn ${n === safePage ? 'active' : ''}" ${pageAttr}="${n}">${n}</button>`
            ).join('')}
            <button type="button" class="log-page-btn" ${pageAttr}="${safePage + 1}" ${safePage >= totalPages ? 'disabled' : ''}>Next →</button>
        </div>
    `;
}

let colResizeWindowListenerBound = false;

export function enableResizableColumns(rootEl = document) {
    if (!colResizeWindowListenerBound && typeof window !== 'undefined') {
        colResizeWindowListenerBound = true;
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 960) {
                document.querySelectorAll('table.crud-table').forEach(t => {
                    t.classList.remove('has-custom-col-widths');
                    t.style.tableLayout = '';
                    t.querySelectorAll('thead th').forEach(th => { th.style.width = ''; });
                });
            }
        });
    }
    if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return;
    rootEl.querySelectorAll('table.crud-table').forEach((table) => {
        // Ensure every table is wrapped in a dedicated touch-scrollable container so card headers/footers never scroll off-screen on mobile
        if (table.parentNode && (!table.parentElement || !table.parentElement.classList.contains('table-scroll-wrap'))) {
            const wrap = document.createElement('div');
            wrap.className = 'table-scroll-wrap';
            table.parentNode.insertBefore(wrap, table);
            wrap.appendChild(table);
        }
        if (window.innerWidth <= 960) {
            table.classList.remove('has-custom-col-widths');
            table.style.tableLayout = '';
            table.querySelectorAll('thead th').forEach(th => { th.style.width = ''; });
        }
        if (table.dataset.colResizeBound === '1') return;
        const headers = Array.from(table.querySelectorAll('thead th'));
        if (headers.length < 2) return;
        table.dataset.colResizeBound = '1';
        table.classList.add('crud-table-resizable');

        const sig = headers.map(h => h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')).join('|');
        const storeKey = `iguide_colw_${sig.slice(0, 80)}`;

        let savedWidths = null;
        try {
            if (PortalState?.uiPreferences && Array.isArray(PortalState.uiPreferences[storeKey])) {
                savedWidths = PortalState.uiPreferences[storeKey];
            } else {
                const raw = localStorage.getItem(storeKey);
                if (raw) savedWidths = JSON.parse(raw);
            }
        } catch (_) { }

        if (window.innerWidth > 960 && Array.isArray(savedWidths) && savedWidths.length === headers.length) {
            table.classList.add('has-custom-col-widths');
            table.style.tableLayout = 'fixed';
            headers.forEach((th, idx) => {
                if (Number(savedWidths[idx]) >= 60) th.style.width = `${Number(savedWidths[idx])}px`;
            });
        }

        const saveWidths = () => {
            try {
                const ws = headers.map(th => Math.round(th.getBoundingClientRect().width));
                localStorage.setItem(storeKey, JSON.stringify(ws));
                syncPortalPrefToServer(storeKey, ws);
            } catch (_) { }
        };

        headers.forEach((th, idx) => {
            if (idx === headers.length - 1) return; // Last column flexes cleanly
            th.style.position = 'relative';
            const handle = document.createElement('span');
            handle.className = 'col-resizer';
            handle.title = 'Drag to resize column (double-click to reset)';
            th.appendChild(handle);

            handle.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                table.classList.remove('has-custom-col-widths');
                table.style.tableLayout = '';
                headers.forEach(h => { h.style.width = ''; });
                try {
                    localStorage.removeItem(storeKey);
                    syncPortalPrefToServer(storeKey, null);
                } catch (_) { }
            });

            handle.addEventListener('mousedown', (e) => {
                if (window.innerWidth <= 960) return;
                e.preventDefault();
                e.stopPropagation();
                // Lock current column widths on first drag so table-layout:fixed keeps exact proportions
                const curWidths = headers.map(h => Math.round(h.getBoundingClientRect().width));
                table.classList.add('has-custom-col-widths');
                table.style.tableLayout = 'fixed';
                headers.forEach((h, i) => {
                    if (i < headers.length - 1) h.style.width = `${curWidths[i]}px`;
                });
                const startX = e.clientX;
                const startW = curWidths[idx];
                handle.classList.add('dragging');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';

                const onMove = (mv) => {
                    const nextW = Math.max(72, Math.round(startW + (mv.clientX - startX)));
                    th.style.width = `${nextW}px`;
                };
                const onUp = () => {
                    handle.classList.remove('dragging');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                    saveWidths();
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
            });
        });
    });
}

/**
 * Branded iGUIDE dark-glass confirmation modal popup (replaces native browser confirm()).
 * Returns Promise<boolean>.
 */
export function showPortalConfirm({
    title = 'Confirm Action',
    message = 'Are you sure you want to continue?',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    requireReason = false,
    reasonLabel = 'Reason (required)',
    reasonPlaceholder = 'Explain why this record is being removed...'
} = {}) {
    return new Promise((resolve) => {
        const existing = document.getElementById('iguide-portal-confirm-modal');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'iguide-portal-confirm-modal';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(2,6,23,0.78); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeIn 0.14s ease;';

        const isLight = document.body.dataset.theme === 'light';
        const accentBorder = danger ? 'rgba(244,63,94,0.42)' : 'rgba(52,211,153,0.42)';
        const accentBg = danger ? 'rgba(244,63,94,0.14)' : 'rgba(16,185,129,0.14)';
        const accentColor = danger ? (isLight ? '#be123c' : '#fb7185') : (isLight ? '#047857' : '#34d399');
        const cardBg = isLight ? '#ffffff' : 'linear-gradient(180deg, rgba(13,22,36,0.98) 0%, rgba(7,13,24,0.98) 100%)';
        const titleColor = isLight ? '#0f172a' : '#f8fafc';
        const msgColor = isLight ? '#334155' : '#cbd5e1';
        const footerBg = isLight ? '#f8fafc' : 'rgba(2,6,23,0.42)';
        const iconSvg = danger
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

        const reasonBlock = requireReason ? `
            <div style="padding:0 20px 14px;">
                <label for="ipc-reason-input" style="display:block; font-size:11.5px; font-weight:700; color:${titleColor}; margin-bottom:5px;">${escapeHtml(reasonLabel)}</label>
                <textarea id="ipc-reason-input" class="form-control" rows="2" placeholder="${escapeHtml(reasonPlaceholder)}" style="width:100%; font-size:12.5px;"></textarea>
                <div id="ipc-reason-err" style="display:none; margin-top:4px; font-size:11.5px; color:#f43f5e; font-weight:600;">Please enter a short reason (at least 3 characters).</div>
            </div>
        ` : '';

        overlay.innerHTML = `
            <div style="width:100%; max-width:440px; background:${cardBg}; border:1px solid ${accentBorder}; border-radius:16px; box-shadow:0 28px 64px rgba(0,0,0,${isLight ? '0.18' : '0.75'}); overflow:hidden; color:${titleColor};">
                <div style="padding:18px 20px 14px; display:flex; align-items:flex-start; gap:13px;">
                    <div style="width:40px; height:40px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:${accentBg}; border:1px solid ${accentBorder}; color:${accentColor};">
                        ${iconSvg}
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:15px; font-weight:700; color:${titleColor}; line-height:1.25;">${escapeHtml(title)}</div>
                        <div style="font-size:12.5px; color:${msgColor}; line-height:1.5; margin-top:6px;">${escapeHtml(message)}</div>
                    </div>
                </div>
                ${reasonBlock}
                <div style="padding:12px 20px 16px; display:flex; justify-content:flex-end; gap:10px; border-top:1px solid rgba(148,163,184,0.16); background:${footerBg};">
                    <button type="button" id="ipc-cancel-btn" class="btn btn-secondary btn-sm" style="min-width:86px; justify-content:center;">${escapeHtml(cancelLabel)}</button>
                    <button type="button" id="ipc-confirm-btn" class="btn ${danger ? 'btn-danger' : 'btn-emerald'} btn-sm" style="min-width:96px; justify-content:center;">${escapeHtml(confirmLabel)}</button>
                </div>
            </div>
        `;

        const finish = (val) => {
            document.removeEventListener('keydown', onKey);
            overlay.remove();
            resolve(val);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') finish(requireReason ? { confirmed: false, reason: '' } : false);
        };
        document.addEventListener('keydown', onKey);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) finish(requireReason ? { confirmed: false, reason: '' } : false);
        });
        document.body.appendChild(overlay);
        document.getElementById('ipc-cancel-btn')?.addEventListener('click', () => finish(requireReason ? { confirmed: false, reason: '' } : false));
        document.getElementById('ipc-confirm-btn')?.addEventListener('click', () => {
            if (requireReason) {
                const reasonVal = String(document.getElementById('ipc-reason-input')?.value || '').trim();
                if (reasonVal.length < 3) {
                    const errEl = document.getElementById('ipc-reason-err');
                    if (errEl) errEl.style.display = 'block';
                    document.getElementById('ipc-reason-input')?.focus();
                    return;
                }
                finish({ confirmed: true, reason: reasonVal });
                return;
            }
            finish(true);
        });
        if (requireReason) {
            document.getElementById('ipc-reason-input')?.focus();
        } else {
            document.getElementById('ipc-confirm-btn')?.focus();
        }
    });
}

/**
 * 1.5: Reusable Version History modal with one-click audited Restore.
 */
export async function openVersionHistoryModal({ stationId, targetTable, targetId, entityName = 'Record' } = {}) {
    const st = stationId || PortalState.currentStation || 'lares';
    try {
        const res = await apiFetch(
            `/api/admin/versions?station=${encodeURIComponent(st)}&target_table=${encodeURIComponent(targetTable)}&target_id=${encodeURIComponent(String(targetId))}`
        );
        const versions = Array.isArray(res?.versions) ? res.versions : [];
        const bodyHtml = versions.length === 0
            ? `<div style="padding:28px 16px; text-align:center; color:#94a3b8; font-size:13px;">No saved version history recorded for this item yet. Future publishes and map editor saves will appear here.</div>`
            : `<div style="display:flex; flex-direction:column; gap:10px; max-height:420px; overflow:auto;">
                ${versions.map(v => {
                    const actorLabel = v.actor_display_name || v.actor_email || 'System';
                    const roleTag = v.actor_base_role === 'super_admin' && v.actor_effective_role && v.actor_effective_role !== 'super_admin'
                        ? `Super Admin acting as ${v.actor_effective_role}`
                        : (v.actor_effective_role || v.actor_base_role || '');
                    return `
                        <div style="padding:12px 14px; border-radius:10px; border:1px solid rgba(148,163,184,0.2); background:rgba(15,23,42,0.55); display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                            <div style="min-width:0; flex:1;">
                                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                    <span class="status-pill status-pill-blue">v${Number(v.version_num || 1)}</span>
                                    <strong style="font-size:13px; color:#f8fafc;">${escapeHtml(v.summary || v.action || 'Saved version')}</strong>
                                </div>
                                <div style="font-size:11.5px; color:#94a3b8; margin-top:5px;">
                                    ${escapeHtml(actorLabel)}${roleTag ? ` (${escapeHtml(roleTag)})` : ''} • ${escapeHtml(v.source || 'portal')} • ${new Date(v.created_at).toLocaleString()}
                                </div>
                            </div>
                            <button type="button" class="btn btn-secondary btn-sm" data-restore-version-id="${v.id}">Restore this version</button>
                        </div>
                    `;
                }).join('')}
            </div>`;

        openGovModal({
            title: `Version History — ${entityName}`,
            maxWidth: '680px',
            bodyHtml,
            footerHtml: `<button type="button" class="btn btn-secondary" onclick="closeGovModal()">Close</button>`
        });

        document.querySelectorAll('[data-restore-version-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const verId = Number(btn.dataset.restoreVersionId);
                const ok = await showPortalConfirm({
                    title: 'Restore Previous Version?',
                    message: `Restoring this version of "${entityName}" will create a new audited change rather than overwriting history.`,
                    confirmLabel: 'Restore Version',
                    cancelLabel: 'Cancel'
                });
                if (!ok) return;
                try {
                    const out = await apiFetch(`/api/admin/versions/${verId}/restore`, { method: 'POST', body: '{}' });
                    closeGovModal();
                    broadcastDbSync();
                    showToast(out.published ? `Restored "${entityName}" (now v${out.version})` : `Queued restore of "${entityName}" as Request #${out.changeRequestId}`);
                    window.refreshCurrentTab?.();
                } catch (err) {
                    showToast(err.message || 'Could not restore version.');
                }
            });
        });
    } catch (err) {
        showToast(err.message || 'Could not load version history.');
    }
}

const TA_HEIGHT_MIN = 64;
const TA_HEIGHT_MAX = 520;

/**
 * Restores saved textarea heights (per-user server + localStorage prefs),
 * persists desktop ResizeObserver changes, and adds a mobile touch drag grip
 * so vertically resized textareas stay the same height across desktop and mobile.
 */
export function initPersistentResizableTextareas(root = document) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    const textareas = root.querySelectorAll('textarea.form-control[id], textarea[id]');

    textareas.forEach((ta) => {
        if (!ta.id || ta.dataset.noResize === '1' || ta.dataset.taResizeBound === '1') return;
        ta.dataset.taResizeBound = '1';

        const prefKey = `iguide_ta_h_${ta.id}`;
        const clampH = (h) => Math.max(TA_HEIGHT_MIN, Math.min(TA_HEIGHT_MAX, Math.round(h)));

        // Apply saved height immediately if present
        const savedRaw = getSavedPortalPref(prefKey, '');
        const savedNum = savedRaw !== '' ? Number(savedRaw) : 0;
        let lastCommittedH = Number.isFinite(savedNum) && savedNum >= TA_HEIGHT_MIN
            ? clampH(savedNum)
            : 0;
        if (lastCommittedH > 0) {
            ta.style.height = `${lastCommittedH}px`;
        }

        // Wrap textarea in a clean container with a touch-friendly bottom drag bar
        let wrap = ta.parentElement;
        if (!wrap || !wrap.classList.contains('ta-resize-wrap')) {
            wrap = document.createElement('div');
            wrap.className = 'ta-resize-wrap';
            if (ta.parentNode) {
                ta.parentNode.insertBefore(wrap, ta);
                wrap.appendChild(ta);
            }
        }

        let grip = wrap.querySelector('.ta-resize-grip');
        if (!grip) {
            grip = document.createElement('button');
            grip.type = 'button';
            grip.className = 'ta-resize-grip';
            grip.setAttribute('aria-label', 'Drag vertically to resize text box');
            grip.title = 'Drag up or down to resize (double-click to reset)';
            grip.innerHTML = `<span class="ta-resize-grip-bar"></span>`;
            wrap.appendChild(grip);
        }

        let saveTimer = null;
        let isGripDragging = false;
        const persistHeight = (heightPx, immediate = false) => {
            const clamped = clampH(heightPx);
            if (!Number.isFinite(clamped) || clamped < TA_HEIGHT_MIN) return;
            lastCommittedH = clamped;
            if (saveTimer) clearTimeout(saveTimer);
            if (immediate) {
                setSavedPortalPref(prefKey, String(clamped));
            } else {
                saveTimer = setTimeout(() => {
                    setSavedPortalPref(prefKey, String(clamped));
                }, 220);
            }
        };

        // Observe desktop corner-handle CSS resizes cleanly
        let initialBaselineH = null;
        if (typeof ResizeObserver !== 'undefined') {
            const ro = new ResizeObserver((entries) => {
                if (isGripDragging) return;
                for (const entry of entries) {
                    const rect = entry.target.getBoundingClientRect();
                    const h = Math.round(rect.height);
                    if (h < TA_HEIGHT_MIN) continue;
                    if (initialBaselineH === null) {
                        initialBaselineH = h;
                        continue;
                    }
                    if (Math.abs(h - (lastCommittedH || initialBaselineH)) >= 4) {
                        persistHeight(h, false);
                    }
                }
            });
            ro.observe(ta);
        }

        // Touch & pointer drag handle so mobile & tablet users can resize smoothly
        grip.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
            e.preventDefault();
            e.stopPropagation();
            isGripDragging = true;
            grip.classList.add('dragging');
            const startY = e.clientY;
            const startH = Math.max(TA_HEIGHT_MIN, Math.round(ta.getBoundingClientRect().height));
            let latestH = startH;

            if (typeof grip.setPointerCapture === 'function' && e.pointerId !== undefined) {
                try { grip.setPointerCapture(e.pointerId); } catch (_) { }
            }

            const onMove = (mv) => {
                latestH = clampH(startH + (mv.clientY - startY));
                ta.style.height = `${latestH}px`;
            };
            const finishDrag = () => {
                isGripDragging = false;
                grip.classList.remove('dragging');
                grip.removeEventListener('pointermove', onMove);
                grip.removeEventListener('pointerup', finishDrag);
                grip.removeEventListener('pointercancel', finishDrag);
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', finishDrag);
                window.removeEventListener('pointercancel', finishDrag);
                if (latestH !== startH) {
                    initialBaselineH = latestH;
                    persistHeight(latestH, true);
                }
            };

            grip.addEventListener('pointermove', onMove);
            grip.addEventListener('pointerup', finishDrag);
            grip.addEventListener('pointercancel', finishDrag);
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', finishDrag);
            window.addEventListener('pointercancel', finishDrag);
        });

        grip.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            ta.style.height = '';
            lastCommittedH = 0;
            initialBaselineH = null;
            setSavedPortalPref(prefKey, '');
        });
    });
}
