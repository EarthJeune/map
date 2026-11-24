/**
 * Unified Auth, Station-Locking & Pending-Survey Guard for all 5 iGUIDE Visual Editors
 * Loaded via <script src="/js/portal/editor-bridge.js?v=303"></script> in:
 *   draw.html, plot_draw.html, road_draw.html, tree_draw.html, pill_adjust.html
 */
(function (global) {
    'use strict';

    const TOKEN_KEY = 'da_admin_token';
    const STATION_ORDER = ['lares', 'qares', 'rares', 'cares'];
    const STATION_LABELS = {
        lares: 'DA-LARES (Lipa City)',
        qares: 'DA-QARES (Tiaong)',
        rares: 'DA-RARES (Tanay)',
        cares: 'DA-CARES (Naic)'
    };

    const state = {
        initialized: false,
        token: '',
        authenticated: false,
        authorized: false,
        baseRole: null,
        effectiveRole: null,
        stationScope: 'all',
        lockedStation: null,
        email: '',
        fullName: '',
        validStations: STATION_ORDER.slice(),
        stationButtonIds: {},
        onForceStation: null,
        onContextReady: null,
        nextSubmitForReview: false
    };

    try {
        state.token = sessionStorage.getItem(TOKEN_KEY) || '';
    } catch (_) {
        state.token = '';
    }

    function computeLockedStation(ctx) {
        if (!ctx || !ctx.authenticated) return null;
        if (ctx.baseRole === 'super_admin' || ctx.stationScope === 'all') return null;
        const sc = String(ctx.stationScope || '').trim().toLowerCase();
        return STATION_ORDER.includes(sc) ? sc : null;
    }

    function ensureBannerStyles() {
        if (document.getElementById('iguide-bridge-styles')) return;
        const style = document.createElement('style');
        style.id = 'iguide-bridge-styles';
        style.textContent = `
            .iguide-editor-auth-pill {
                position: fixed;
                bottom: 30px;
                right: 16px;
                z-index: 950;
                display: none;
                align-items: center;
                gap: 10px;
                padding: 9px 14px;
                border-radius: 12px;
                background: rgba(15, 23, 42, 0.94);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(251, 191, 36, 0.45);
                box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
                color: #f8fafc;
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                font-size: 12px;
                font-weight: 600;
            }
            .iguide-editor-auth-pill.visible { display: flex; }
            .iguide-editor-auth-pill.danger { border-color: rgba(244, 63, 94, 0.5); }
            .iguide-editor-auth-link {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 5px 11px;
                border-radius: 8px;
                background: #10b981;
                color: #052e16;
                text-decoration: none;
                font-weight: 700;
                font-size: 11.5px;
                white-space: nowrap;
            }
            .iguide-editor-auth-link:hover { background: #34d399; }
            .iguide-cares-survey-banner {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 900;
                display: none;
                align-items: center;
                gap: 10px;
                padding: 11px 18px;
                border-radius: 14px;
                background: rgba(15, 23, 42, 0.95);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(251, 191, 36, 0.48);
                box-shadow: 0 14px 32px rgba(0, 0, 0, 0.5);
                color: #fef3c7;
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                font-size: 12.5px;
                font-weight: 600;
                max-width: min(92vw, 560px);
                text-align: center;
            }
            .iguide-cares-survey-banner.visible { display: flex; }
            .iguide-lock-chip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                margin-left: 6px;
                padding: 2px 7px;
                border-radius: 999px;
                background: rgba(14, 165, 233, 0.16);
                border: 1px solid rgba(56, 189, 248, 0.35);
                color: #38bdf8;
                font-size: 10px;
                font-weight: 700;
            }
            .layer-btn.station-locked-disabled,
            .station-btn.station-locked-disabled {
                opacity: 0.38 !important;
                cursor: not-allowed !important;
                pointer-events: auto;
            }
        `;
        document.head.appendChild(style);
    }

    function renderAuthBanner() {
        ensureBannerStyles();
        if (!document.body) return;
        let banner = document.getElementById('iguide-editor-auth-pill');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'iguide-editor-auth-pill';
            banner.className = 'iguide-editor-auth-pill';
            document.body.appendChild(banner);
        }

        const LUCIDE_LOCK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
        const LUCIDE_EYE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
        const isEmbedded = window.self !== window.top;
        if (!state.authenticated) {
            banner.className = 'iguide-editor-auth-pill visible';
            const loginHref = '/login?return=' + encodeURIComponent(window.location.pathname + window.location.search);
            banner.innerHTML = isEmbedded
                ? `<span>${LUCIDE_LOCK}Session not verified — Re-sign in at iGUIDE Portal to save edits</span>`
                : `<span>${LUCIDE_LOCK}Read-Only Preview — Sign in to save geometry changes</span>
                   <a class="iguide-editor-auth-link" href="${loginHref}">Sign In at /login →</a>`;
            return;
        }

        if (!state.authorized) {
            banner.className = 'iguide-editor-auth-pill danger visible';
            banner.innerHTML = `<span>${LUCIDE_EYE}View-Only (${state.effectiveRole || 'role'}) — Editing visual geometry requires GIS Editor or Admin permission</span>`;
            return;
        }

        if (state.lockedStation) {
            banner.className = 'iguide-editor-auth-pill visible';
            banner.style.borderColor = 'rgba(56, 189, 248, 0.45)';
            banner.innerHTML = `<span>${LUCIDE_LOCK}Assigned Station: <strong style="color:#38bdf8;">${STATION_LABELS[state.lockedStation] || state.lockedStation.toUpperCase()}</strong></span>`;
            return;
        }

        banner.className = 'iguide-editor-auth-pill';
        banner.innerHTML = '';
    }

    function syncCaresBanner(stationId) {
        ensureBannerStyles();
        if (!document.body) return;
        let banner = document.getElementById('iguide-cares-survey-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'iguide-cares-survey-banner';
            banner.className = 'iguide-cares-survey-banner';
            document.body.appendChild(banner);
        }
        if (String(stationId || '').toLowerCase() === 'cares') {
            const LUCIDE_SPROUT = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>';
            banner.className = 'iguide-cares-survey-banner visible';
            banner.innerHTML = `<span>${LUCIDE_SPROUT}<strong>DA-CARES (Naic, Cavite) — Pending Field Survey:</strong> Satellite baseline active. Drone orthomosaic & campus layers are awaiting field survey before geometry editing.</span>`;
        } else {
            banner.className = 'iguide-cares-survey-banner';
            banner.innerHTML = '';
        }
    }

    function applyStationButtonLocks() {
        const locked = state.lockedStation;
        const mapIds = state.stationButtonIds || {};
        STATION_ORDER.forEach((st) => {
            const idList = [mapIds[st], `btn-station-${st}`, `btn-${st}`].filter(Boolean);
            idList.forEach((elId) => {
                const btn = document.getElementById(elId);
                if (!btn) return;
                const blocked = Boolean(locked && st !== locked);
                btn.disabled = blocked;
                btn.classList.toggle('station-locked-disabled', blocked);
                if (blocked) {
                    btn.title = `Locked to ${STATION_LABELS[locked] || 'DA-' + locked.toUpperCase()}`;
                } else {
                    btn.removeAttribute('title');
                }
            });
        });
    }

    function applyVerifyResponse(v, rawToken) {
        const isVerified = Boolean(v && v.valid !== false && (v.valid === true || v.ok === true || v.authenticated === true || v.role || v.baseRole || Array.isArray(v.permissions)));
        if (!isVerified) {
            state.authenticated = false;
            state.authorized = false;
            state.token = '';
            state.baseRole = null;
            state.effectiveRole = null;
            state.stationScope = 'all';
            state.lockedStation = null;
        } else {
            const perms = Array.isArray(v.permissions) ? v.permissions : [];
            state.authenticated = true;
            state.token = rawToken || state.token;
            state.baseRole = v.baseRole || v.role || null;
            state.effectiveRole = v.role || v.baseRole || null;
            state.stationScope = v.stationScope || v.stationId || 'all';
            state.email = v.email || '';
            state.fullName = v.fullName || '';
            state.authorized = perms.includes('editors:use_visual');
            state.lockedStation = computeLockedStation(state);
        }

        renderAuthBanner();
        applyStationButtonLocks();

        if (state.lockedStation && typeof state.onForceStation === 'function') {
            state.onForceStation(state.lockedStation);
        }
        if (typeof state.onContextReady === 'function') {
            state.onContextReady({ ...state });
        }
    }

    async function verifyCurrentToken() {
        if (!state.token) {
            applyVerifyResponse(null, '');
            return state;
        }
        try {
            const resp = await originalFetch('/api/admin/verify', {
                headers: { 'X-Admin-Token': state.token }
            });
            if (!resp.ok) {
                applyVerifyResponse(null, '');
                return state;
            }
            const data = await resp.json();
            applyVerifyResponse(data, state.token);
            return state;
        } catch (_) {
            applyVerifyResponse(null, '');
            return state;
        }
    }

    // Preserve native fetch before defensively adding X-Admin-Token on same-origin /api/ mutations
    const originalFetch = global.fetch.bind(global);
    global.fetch = function (input, init) {
        try {
            const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
            const isSameOriginApi = urlStr.startsWith('/api/') || urlStr.startsWith(global.location.origin + '/api/');
            const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
            if (isSameOriginApi && method !== 'GET' && state.token) {
                const nextInit = Object.assign({}, init || {});
                const hdrs = new Headers(nextInit.headers || {});
                if (!hdrs.has('X-Admin-Token')) {
                    hdrs.set('X-Admin-Token', state.token);
                }
                nextInit.headers = hdrs;
                return originalFetch(input, nextInit);
            }
        } catch (_) {}
        return originalFetch(input, init);
    };

    async function authFetch(url, options = {}) {
        const hdrs = new Headers(options.headers || {});
        if (state.token && !hdrs.has('X-Admin-Token')) {
            hdrs.set('X-Admin-Token', state.token);
        }
        const method = String(options.method || 'GET').toUpperCase();
        if (method !== 'GET' && state.nextSubmitForReview) {
            hdrs.set('X-Submit-For-Review', '1');
            state.nextSubmitForReview = false;
        }
        if (options.body && !hdrs.has('Content-Type')) {
            hdrs.set('Content-Type', 'application/json');
        }
        const resp = await originalFetch(url, { ...options, headers: hdrs });
        let data = {};
        try {
            data = await resp.json();
        } catch (_) {}

        if (resp.status === 401) {
            applyVerifyResponse(null, '');
            const err = new Error(data.error || 'Authentication required: Please sign in at /login.');
            err.status = 401;
            throw err;
        }
        if (resp.status === 403) {
            const err = new Error(data.error || 'Forbidden: Your role or station assignment cannot modify this station.');
            err.status = 403;
            throw err;
        }
        if (!resp.ok) {
            const err = new Error(data.error || `Server error (HTTP ${resp.status})`);
            err.status = resp.status;
            throw err;
        }

        if (String(options.method || 'GET').toUpperCase() !== 'GET') {
            broadcastSync();
        }
        return data;
    }

    function broadcastSync() {
        try {
            const bc = new BroadcastChannel('iguide_db_sync');
            bc.postMessage({ type: 'db_updated', ts: Date.now(), source: 'visual-editor' });
            bc.close();
        } catch (_) {}
    }

    // Listen for live parent portal context messages when embedded inside /login
    global.addEventListener('message', (event) => {
        if (event.origin !== global.location.origin) return;
        const msg = event.data;
        if (!msg || msg.type !== 'IGUIDE_PORTAL_CONTEXT') return;

        const shouldForce = Boolean(state.lockedStation) || msg.forceStation === true || !new URLSearchParams(global.location.search).get('station');
        if (msg.token && msg.token !== state.token) {
            state.token = msg.token;
            try { sessionStorage.setItem(TOKEN_KEY, msg.token); } catch (_) {}
            verifyCurrentToken().then(() => {
                const forceAfter = Boolean(state.lockedStation) || msg.forceStation === true || !new URLSearchParams(global.location.search).get('station');
                if (msg.currentStation && forceAfter && !state.lockedStation && typeof state.onForceStation === 'function') {
                    state.onForceStation(msg.currentStation);
                }
            });
            return;
        }

        if (msg.currentStation && shouldForce && !state.lockedStation && typeof state.onForceStation === 'function') {
            state.onForceStation(msg.currentStation);
        }
    });

    const readinessPromise = verifyCurrentToken();

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isDirectPublisher() {
        return state.effectiveRole === 'super_admin';
    }

    function formatSaveResultMessage(res, liveFallbackMsg) {
        if (res && res.noChanges) {
            return 'ℹ️ No geometry changes detected compared to the live map.';
        }
        if (res && res.queued) {
            const idPart = res.changeRequestId ? ` (Request #${res.changeRequestId})` : '';
            const sumPart = res.diffSummary ? ` — ${res.diffSummary}` : '';
            return `✅ Submitted for Station Reviewer Approval${idPart}${sumPart}`;
        }
        return liveFallbackMsg;
    }

    /**
     * Branded iGUIDE confirmation popup shared across all 5 visual map editing tools.
     * Role-aware: GIS Editors submit for Station Reviewer approval; Super Admins can choose Submit for Review or Publish Live.
     * Returns Promise<boolean>.
     */
    function confirmSave({
        title = 'Confirm Save?',
        message = 'Are you sure you want to save your changes?',
        confirmLabel = 'Yes, Save',
        cancelLabel = 'Cancel',
        danger = false
    } = {}) {
        return new Promise((resolve) => {
            const existing = document.getElementById('iguide-editor-confirm-modal');
            if (existing) existing.remove();

            const directPub = isDirectPublisher();
            const resolvedTitle = directPub ? title : title.replace(/^Save\b/i, 'Submit');
            const resolvedMsg = directPub
                ? message
                : `${message} Your changes will be queued for your Station Reviewer with a visual Before vs. After aerial diff before going live.`;
            const resolvedConfirmLabel = directPub ? confirmLabel : 'Submit for Review →';

            const overlay = document.createElement('div');
            overlay.id = 'iguide-editor-confirm-modal';
            overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(2,6,23,0.78); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:20px; font-family:Inter,system-ui,-apple-system,sans-serif;';

            const accentBorder = danger ? 'rgba(244,63,94,0.45)' : (directPub ? 'rgba(52,211,153,0.45)' : 'rgba(56,189,248,0.45)');
            const accentBg = danger ? 'rgba(244,63,94,0.14)' : (directPub ? 'rgba(16,185,129,0.14)' : 'rgba(14,165,233,0.14)');
            const accentColor = danger ? '#fb7185' : (directPub ? '#34d399' : '#38bdf8');
            const btnBg = danger ? 'linear-gradient(135deg,#e11d48,#be123c)' : 'linear-gradient(135deg,#10b981,#059669)';
            const iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>';

            overlay.innerHTML = `
                <div style="width:100%; max-width:460px; background:linear-gradient(180deg, rgba(13,22,36,0.98) 0%, rgba(7,13,24,0.98) 100%); border:1px solid ${accentBorder}; border-radius:16px; box-shadow:0 28px 64px rgba(0,0,0,0.75); overflow:hidden; color:#f8fafc;">
                    <div style="padding:18px 20px 14px; display:flex; align-items:flex-start; gap:13px;">
                        <div style="width:40px; height:40px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:${accentBg}; border:1px solid ${accentBorder}; color:${accentColor};">
                            ${iconSvg}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-size:15px; font-weight:700; color:#f8fafc; line-height:1.25;">${escapeHtml(resolvedTitle)}</div>
                            <div style="font-size:12.5px; color:#cbd5e1; line-height:1.5; margin-top:6px;">${escapeHtml(resolvedMsg)}</div>
                        </div>
                    </div>
                    <div style="padding:12px 20px 16px; display:flex; justify-content:flex-end; gap:8px; flex-wrap:wrap; border-top:1px solid rgba(148,163,184,0.16); background:rgba(2,6,23,0.42);">
                        <button type="button" id="iec-cancel-btn" style="padding:7px 14px; border-radius:8px; border:1px solid rgba(148,163,184,0.28); background:rgba(30,41,59,0.8); color:#e2e8f0; font-size:12.5px; font-weight:600; cursor:pointer;">${escapeHtml(cancelLabel)}</button>
                        ${directPub ? `<button type="button" id="iec-review-btn" style="padding:7px 14px; border-radius:8px; border:1px solid rgba(56,189,248,0.45); background:rgba(14,165,233,0.16); color:#7dd3fc; font-size:12.5px; font-weight:700; cursor:pointer;">Submit for Review</button>` : ''}
                        <button type="button" id="iec-confirm-btn" style="padding:7px 16px; border-radius:8px; border:none; background:${btnBg}; color:#fff; font-size:12.5px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(16,185,129,0.28);">${escapeHtml(resolvedConfirmLabel)}</button>
                    </div>
                </div>
            `;

            const finish = (val, submitForReview = false) => {
                state.nextSubmitForReview = Boolean(val && submitForReview);
                document.removeEventListener('keydown', onKey);
                overlay.remove();
                resolve(val);
            };
            const onKey = (e) => {
                if (e.key === 'Escape') finish(false, false);
            };
            document.addEventListener('keydown', onKey);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false, false); });
            document.body.appendChild(overlay);
            document.getElementById('iec-cancel-btn')?.addEventListener('click', () => finish(false, false));
            document.getElementById('iec-review-btn')?.addEventListener('click', () => finish(true, true));
            document.getElementById('iec-confirm-btn')?.addEventListener('click', () => finish(true, !directPub));
            document.getElementById('iec-confirm-btn')?.focus();
        });
    }

    global.IGuideEditorBridge = {
        getState() {
            return { ...state };
        },
        isDirectPublisher,
        formatSaveResultMessage,
        ready() {
            return readinessPromise;
        },
        init(opts = {}) {
            state.initialized = true;
            if (Array.isArray(opts.validStations)) state.validStations = opts.validStations;
            if (opts.stationButtonIds) state.stationButtonIds = opts.stationButtonIds;
            if (typeof opts.onForceStation === 'function') state.onForceStation = opts.onForceStation;
            if (typeof opts.onContextReady === 'function') state.onContextReady = opts.onContextReady;

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    renderAuthBanner();
                    applyStationButtonLocks();
                    if (opts.currentStation) syncCaresBanner(opts.currentStation);
                });
            } else {
                renderAuthBanner();
                applyStationButtonLocks();
                if (opts.currentStation) syncCaresBanner(opts.currentStation);
            }
            return readinessPromise;
        },
        resolveStation(requested, valid = STATION_ORDER, fallback = 'lares') {
            if (state.lockedStation && valid.includes(state.lockedStation)) {
                return state.lockedStation;
            }
            const clean = String(requested || '').trim().toLowerCase();
            return valid.includes(clean) ? clean : fallback;
        },
        canSwitchTo(targetStation, notifyFn = null) {
            const st = String(targetStation || '').trim().toLowerCase();
            if (state.lockedStation && st !== state.lockedStation) {
                const msg = `Account locked to ${STATION_LABELS[state.lockedStation] || 'DA-' + state.lockedStation.toUpperCase()}. Cannot switch to DA-${st.toUpperCase()}.`;
                if (typeof notifyFn === 'function') notifyFn(msg);
                else alert(msg);
                return false;
            }
            return true;
        },
        syncCaresBanner,
        applyStationButtonLocks,
        authFetch,
        broadcastSync,
        confirmSave,
        refreshAuth: verifyCurrentToken
    };
})(window);
