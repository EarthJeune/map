/**
 * Targeted Notification Bell, 30s Polling & Deep-Link Router for iGUIDE Portal
 */

import { PortalState, apiFetch, escapeHtml } from './core.js';

let pollTimer = null;
let lastUnreadCount = -1;
let lastTopNotifId = null;
let latestNotifications = [];
let latestUnreadCount = 0;
let latestQueueCounts = {
    pendingUsers: 0,
    pendingReviews: 0,
    approvedPublish: 0,
    needsRevision: 0
};
let activeNotifPageFilter = 'all';
let onNavigateCallback = null;
let onLiveUpdateCallback = null;
let _audioCtx = null;

function ensureAudioUnlocked() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!_audioCtx) _audioCtx = new AudioCtx();
        if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
        return _audioCtx;
    } catch (_) {
        return null;
    }
}

// Unlock Web Audio on first user interaction so pings never get blocked by autoplay policies
if (typeof window !== 'undefined' && !window._iguidePingUnlocked) {
    window._iguidePingUnlocked = true;
    const unlockOnce = () => {
        ensureAudioUnlocked();
        window.removeEventListener('pointerdown', unlockOnce);
        window.removeEventListener('keydown', unlockOnce);
    };
    window.addEventListener('pointerdown', unlockOnce, { passive: true });
    window.addEventListener('keydown', unlockOnce, { passive: true });
}

export function playNotificationPing() {
    try {
        const ctx = ensureAudioUnlocked();
        if (!ctx) return;
        const now = ctx.currentTime;
        // Pleasant two-tone crystalline ping (E6 -> A6)
        [
            { freq: 1318.5, start: 0, dur: 0.14, gain: 0.11 },
            { freq: 1760.0, start: 0.09, dur: 0.22, gain: 0.09 }
        ].forEach(tone => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(tone.freq, now + tone.start);
            g.gain.setValueAtTime(0.0001, now + tone.start);
            g.gain.exponentialRampToValueAtTime(tone.gain, now + tone.start + 0.015);
            g.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + tone.dur);
            osc.connect(g);
            g.connect(ctx.destination);
            osc.start(now + tone.start);
            osc.stop(now + tone.start + tone.dur + 0.02);
        });
    } catch (_) { }
}

let roleChangeModalShown = false;

function showRoleChangedPopup(newRoleName, newStationScope) {
    if (roleChangeModalShown) return;
    roleChangeModalShown = true;
    stopNotificationPolling();

    const scopeLabel = newStationScope === 'all'
        ? 'All Research Stations'
        : `DA-${String(newStationScope || 'lares').toUpperCase()}`;

    const existing = document.getElementById('role-change-blocking-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'role-change-blocking-modal';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(5,10,18,0.82); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:20px;';
    overlay.innerHTML = `
        <div style="width:100%; max-width:440px; background:linear-gradient(160deg,#0f172a,#111827); border:1px solid rgba(52,211,153,0.45); border-radius:18px; padding:26px; box-shadow:0 24px 60px rgba(0,0,0,0.65); text-align:center; color:#f8fafc;">
            <div style="width:52px; height:52px; margin:0 auto 14px; border-radius:14px; background:rgba(16,185,129,0.16); border:1px solid rgba(52,211,153,0.4); display:flex; align-items:center; justify-content:center; color:#34d399;">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3 style="margin:0 0 8px; font-size:18px; font-weight:800; color:#f8fafc;">Your Portal Role Was Updated</h3>
            <p style="margin:0 0 16px; font-size:13.5px; line-height:1.55; color:#cbd5e1;">
                An Administrator updated your access profile to <strong style="color:#34d399;">${escapeHtml(newRoleName || 'Updated Role')}</strong> (<strong style="color:#38bdf8;">${escapeHtml(scopeLabel)}</strong>).
            </p>
            <p style="margin:0 0 18px; font-size:12px; color:#94a3b8;">
                Refreshing workspace automatically in <strong id="role-change-countdown" style="color:#f8fafc;">5</strong>s...
            </p>
            <button type="button" id="role-change-reload-btn" class="btn btn-emerald" style="width:100%; height:42px; font-weight:700; justify-content:center;">
                Refresh Workspace Now
            </button>
        </div>
    `;
    document.body.appendChild(overlay);

    const doReload = () => window.location.reload();
    document.getElementById('role-change-reload-btn')?.addEventListener('click', doReload);

    let secs = 5;
    const timer = setInterval(() => {
        secs -= 1;
        const el = document.getElementById('role-change-countdown');
        if (el) el.textContent = String(Math.max(0, secs));
        if (secs <= 0) {
            clearInterval(timer);
            doReload();
        }
    }, 1000);
}


function formatCleanNotifTitle(n) {
    let title = String(n.title || 'iGUIDE Notification');
    // Clean legacy stored notifications that had "(CR #63)" or "on CR #63"
    if (/\bCR\s*#\d+/i.test(title)) {
        const msg = String(n.message || '');
        const quoted = msg.match(/"([^"]{2,100})"/);
        const extracted = quoted && quoted[1]
            ? quoted[1].replace(/^(Update|Create|Add|Delete|Remove|Edit)\s+(Building|Facility|Plot|Office|Photo)\s*:?\s*/i, '').replace(/^["']|["']$/g, '').trim()
            : '';
        if (extracted) {
            title = title.replace(/\s*(?:on\s+)?\(?CR\s*#\d+\)?/gi, '').trim() + `: ${extracted}`;
        } else {
            title = title.replace(/\bCR\s*#(\d+)/gi, 'Request #$1');
        }
    }
    return title;
}

function formatRelativeTime(ts) {
    const dt = new Date(ts);
    if (isNaN(dt.getTime())) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return dt.toLocaleDateString();
}

export function getUnreadNotificationCount() {
    return latestUnreadCount;
}

function setSidebarTabBadge(tabId, count, { tone = '', title = '' } = {}) {
    const el = document.querySelector(`.nav-notif-badge[data-nav-badge="${tabId}"]`);
    if (!el) return;
    const n = Math.max(0, Number(count || 0));
    el.classList.remove('badge-amber', 'badge-emerald', 'badge-sky');
    if (tone) el.classList.add(tone);
    el.title = title || '';
    if (n > 0) {
        el.textContent = n > 99 ? '99+' : String(n);
        el.style.display = 'inline-flex';
    } else {
        el.textContent = '0';
        el.style.display = 'none';
    }
}

export function syncSidebarQueueBadges() {
    const unread = latestUnreadCount;
    const bellBadge = document.getElementById('notif-badge-count');
    if (bellBadge) {
        bellBadge.textContent = unread > 99 ? '99+' : String(unread);
        if (unread > 0) {
            if (unread !== lastUnreadCount) {
                bellBadge.classList.remove('visible');
                void bellBadge.offsetWidth;
            }
            bellBadge.classList.add('visible');
        } else {
            bellBadge.classList.remove('visible');
        }
    }

    setSidebarTabBadge('notifications', unread, {
        title: unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : ''
    });

    const q = latestQueueCounts || {};
    const pendingUsers = Number(q.pendingUsers || 0);
    const pendingReviews = Number(q.pendingReviews || 0);
    const approvedPublish = Number(q.approvedPublish || 0);
    const needsRevision = Number(q.needsRevision || 0);
    const role = PortalState.effectiveRole || 'super_admin';

    setSidebarTabBadge('admin-reviewers', pendingUsers, {
        tone: pendingUsers > 0 ? '' : 'badge-amber',
        title: pendingUsers > 0 ? `${pendingUsers} account${pendingUsers === 1 ? '' : 's'} awaiting approval` : ''
    });

    setSidebarTabBadge('review-queue', pendingReviews, {
        tone: pendingReviews > 0 ? '' : 'badge-amber',
        title: pendingReviews > 0 ? `${pendingReviews} change request${pendingReviews === 1 ? '' : 's'} pending review` : ''
    });

    if (role === 'administrator') {
        setSidebarTabBadge('admin-reviews', approvedPublish, {
            tone: approvedPublish > 0 ? '' : 'badge-emerald',
            title: approvedPublish > 0 ? `${approvedPublish} approved edit${approvedPublish === 1 ? '' : 's'} ready to publish` : ''
        });
    } else if (role === 'gis_editor') {
        if (needsRevision > 0) {
            setSidebarTabBadge('admin-reviews', needsRevision, {
                tone: '',
                title: `${needsRevision} returned for revision${pendingReviews > 0 ? ` • ${pendingReviews} pending review` : ''}`
            });
        } else {
            setSidebarTabBadge('admin-reviews', pendingReviews, {
                tone: 'badge-sky',
                title: pendingReviews > 0 ? `${pendingReviews} submission${pendingReviews === 1 ? '' : 's'} awaiting review` : ''
            });
        }
    } else {
        const saTotal = pendingReviews + approvedPublish + needsRevision;
        setSidebarTabBadge('admin-reviews', saTotal, {
            tone: saTotal > 0 ? '' : 'badge-amber',
            title: saTotal > 0 ? `${pendingReviews} pending review • ${approvedPublish} ready to publish • ${needsRevision} needs revision` : ''
        });
    }
}

function matchesNotifFilter(n, filter) {
    if (filter === 'unread') return Number(n.is_read) === 0;
    const type = String(n.type || '').toLowerCase();
    const linkTab = String(n.link_tab || '').toLowerCase();
    if (filter === 'geometry') {
        return type.includes('geometry') || type.includes('road') || type.includes('plot') || linkTab.startsWith('editor-');
    }
    if (filter === 'reviews') {
        return type.includes('review') || type.includes('change') || type.includes('suggest') || type.includes('approval') || linkTab === 'admin-reviews' || linkTab === 'review-queue';
    }
    return true;
}

function renderNotifPageItems() {
    const pageListEl = document.getElementById('notif-page-list');
    const summaryEl = document.getElementById('notif-page-summary');
    if (!pageListEl) return;

    if (summaryEl) {
        summaryEl.textContent = latestUnreadCount > 0
            ? `${latestUnreadCount} unread notification${latestUnreadCount === 1 ? '' : 's'} • ${latestNotifications.length} total`
            : `All caught up • ${latestNotifications.length} recent notification${latestNotifications.length === 1 ? '' : 's'}`;
    }

    const filtered = latestNotifications.filter(n => matchesNotifFilter(n, activeNotifPageFilter));
    if (filtered.length === 0) {
        pageListEl.innerHTML = `
            <div class="notif-page-empty">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <div style="font-weight:600; margin-top:8px;">No notifications match this filter</div>
                <div style="font-size:12px; opacity:0.75; margin-top:2px;">Switch to "All" or wait for new activity updates across your station.</div>
            </div>
        `;
        return;
    }

    pageListEl.innerHTML = filtered.map(n => {
        const isUnread = Number(n.is_read) === 0;
        const cleanMsg = String(n.message || '')
            .replace(/\(CR #(\d+)\)/gi, '(Request #$1)')
            .replace(/\bCR #(\d+)/gi, 'Request #$1');
        const stTag = n.station_id ? `DA-${String(n.station_id).toUpperCase()}` : '';
        return `
            <button type="button" class="notif-page-card ${isUnread ? 'unread' : ''}" data-notif-id="${n.id}" data-link-tab="${escapeHtml(n.link_tab || '')}" data-station="${escapeHtml(n.station_id || '')}" data-target-table="${escapeHtml(n.target_table || '')}" data-target-id="${escapeHtml(n.target_id || '')}" data-type="${escapeHtml(n.type || '')}">
                <span class="notif-unread-dot"></span>
                <div class="notif-page-card-body">
                    <div class="notif-page-card-top">
                        <span class="notif-page-card-title">${escapeHtml(formatCleanNotifTitle(n))}</span>
                        <span class="notif-page-card-time">${formatRelativeTime(n.created_at)}</span>
                    </div>
                    ${cleanMsg ? `<div class="notif-page-card-msg">${escapeHtml(cleanMsg)}</div>` : ''}
                    <div class="notif-page-card-meta">
                        ${stTag ? `<span class="notif-page-station-pill">${escapeHtml(stTag)}</span>` : ''}
                        <span class="notif-page-state-pill ${isUnread ? 'is-unread' : ''}">${isUnread ? 'Unread' : 'Read'}</span>
                    </div>
                </div>
            </button>
        `;
    }).join('');

    pageListEl.querySelectorAll('.notif-page-card').forEach(btn => {
        btn.addEventListener('click', () => handleNotificationClick(btn));
    });
}

async function markAllNotificationsRead() {
    try {
        await apiFetch('/api/notifications/read-all', { method: 'POST', body: '{}' });
        await refreshNotifications();
    } catch (_) {}
}

export async function refreshNotifications() {
    if (!PortalState.token) return;
    try {
        const stationParam = encodeURIComponent(PortalState.currentStation || 'lares');
        const data = await apiFetch(`/api/notifications?station=${stationParam}`);
        // Detect live role or station-scope change for active non-Super-Admin users
        if (data && data.account && PortalState.baseRole && PortalState.baseRole !== 'super_admin') {
            const srvRole = String(data.account.baseRole || '').toLowerCase();
            const srvScope = String(data.account.stationScope || '').toLowerCase();
            const curRole = String(PortalState.baseRole || '').toLowerCase();
            const curScope = String(PortalState.stationScope || '').toLowerCase();
            if ((srvRole && srvRole !== curRole) || (srvScope && curScope && srvScope !== curScope)) {
                showRoleChangedPopup(data.account.roleName || srvRole, srvScope);
                return;
            }
        }
        const unread = Number(data.unreadCount || 0);
        const rawItems = Array.isArray(data.notifications) ? data.notifications : [];
        // Collapse duplicate notifications for the same (type, target_table, target_id) within the same feed
        const seenEventKeys = new Set();
        const items = rawItems.filter(n => {
            if (n && n.type && n.target_table && n.target_id !== undefined && n.target_id !== null && String(n.target_id) !== '') {
                const key = `${n.type}:${n.target_table}:${n.target_id}`;
                if (seenEventKeys.has(key)) return false;
                seenEventKeys.add(key);
            }
            return true;
        });

        latestNotifications = items;
        latestUnreadCount = unread;
        if (data && data.queueCounts && typeof data.queueCounts === 'object') {
            latestQueueCounts = {
                pendingUsers: Number(data.queueCounts.pendingUsers || 0),
                pendingReviews: Number(data.queueCounts.pendingReviews || 0),
                approvedPublish: Number(data.queueCounts.approvedPublish || 0),
                needsRevision: Number(data.queueCounts.needsRevision || 0)
            };
        }
        syncSidebarQueueBadges();

        const topId = items.length > 0 ? Number(items[0].id || 0) : 0;
        const hasNewArrival = (lastTopNotifId !== null && topId > lastTopNotifId) ||
            (lastUnreadCount !== -1 && unread > lastUnreadCount);

        if (hasNewArrival && items.length > 0) {
            playNotificationPing();
            if (typeof onLiveUpdateCallback === 'function') {
                try { onLiveUpdateCallback(items[0]); } catch (_) { }
            }
        }
        lastUnreadCount = unread;
        if (topId > 0 || lastTopNotifId === null) lastTopNotifId = topId;

        renderNotifPageItems();

        const listEl = document.getElementById('notif-list');
        if (!listEl) return;
        if (items.length === 0) {
            listEl.innerHTML = `<div style="padding:26px 16px; text-align:center; color:#64748b; font-size:12px;">No notifications yet.</div>`;
            return;
        }
        listEl.innerHTML = items.map(n => `
            <button type="button" class="notif-item ${Number(n.is_read) === 0 ? 'unread' : ''}" data-notif-id="${n.id}" data-link-tab="${escapeHtml(n.link_tab || '')}" data-station="${escapeHtml(n.station_id || '')}" data-target-table="${escapeHtml(n.target_table || '')}" data-target-id="${escapeHtml(n.target_id || '')}" data-type="${escapeHtml(n.type || '')}">
                <span class="notif-unread-dot"></span>
                <div style="min-width:0; flex:1;">
                    <div class="notif-item-title">${escapeHtml(formatCleanNotifTitle(n))}</div>
                    <div class="notif-item-msg">${escapeHtml(String(n.message || '').replace(/\(CR #(\d+)\)/gi, '(Request #$1)').replace(/\bCR #(\d+)/gi, 'Request #$1'))}</div>
                    <div class="notif-item-time">${n.station_id ? 'DA-' + escapeHtml(String(n.station_id).toUpperCase()) + ' • ' : ''}${formatRelativeTime(n.created_at)}</div>
                </div>
            </button>
        `).join('');

        listEl.querySelectorAll('.notif-item').forEach(btn => {
            btn.addEventListener('click', () => handleNotificationClick(btn));
        });
    } catch (_) {
        // Silent background poll fail (session expiry is handled by apiFetch)
    }
}

export async function renderNotificationsTab(container) {
    if (!container) return;
    container.innerHTML = `
        <div class="notif-page-shell">
            <div class="notif-page-header">
                <div>
                    <h2 class="notif-page-heading">Notifications Center</h2>
                    <div class="notif-page-summary" id="notif-page-summary">Loading recent notifications...</div>
                </div>
                <div class="notif-page-actions">
                    <button type="button" class="btn btn-secondary btn-sm" id="notif-page-refresh-btn">Refresh</button>
                    <button type="button" class="btn btn-emerald btn-sm" id="notif-page-mark-all-btn">Mark All Read</button>
                </div>
            </div>
            <div class="notif-page-filters" id="notif-page-filters">
                ${[
                    { id: 'all', label: 'All Activity' },
                    { id: 'unread', label: 'Unread' },
                    { id: 'geometry', label: 'Geometry & Maps' },
                    { id: 'reviews', label: 'Reviews & Approvals' }
                ].map(f => `<button type="button" class="notif-filter-chip ${activeNotifPageFilter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>`).join('')}
            </div>
            <div class="notif-page-list" id="notif-page-list"></div>
        </div>
    `;

    container.querySelectorAll('.notif-filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            activeNotifPageFilter = chip.dataset.filter || 'all';
            container.querySelectorAll('.notif-filter-chip').forEach(c => c.classList.toggle('active', c === chip));
            renderNotifPageItems();
        });
    });

    document.getElementById('notif-page-refresh-btn')?.addEventListener('click', () => refreshNotifications());
    document.getElementById('notif-page-mark-all-btn')?.addEventListener('click', () => markAllNotificationsRead());

    await refreshNotifications();
}

async function handleNotificationClick(btn) {
    const id = btn.dataset.notifId;
    const linkTab = btn.dataset.linkTab;
    const station = btn.dataset.station;
    const targetTable = btn.dataset.targetTable;
    const targetId = btn.dataset.targetId;
    const type = btn.dataset.type;

    try {
        await apiFetch(`/api/notifications/${id}/read`, { method: 'POST', body: '{}' });
    } catch (_) {}

    document.getElementById('notif-popover')?.classList.remove('open');
    await refreshNotifications();

    // If it is just a system update or broadcast notification, do not jump away
    if (type === 'system_update' || type === 'broadcast' || type === 'update') {
        return;
    }

    if (typeof onNavigateCallback === 'function') {
        onNavigateCallback({ tabId: linkTab, stationId: station, targetTable, targetId, type });
    }
}

export function startNotificationPolling(onNavigate, onLiveUpdate = null) {
    onNavigateCallback = onNavigate || null;
    onLiveUpdateCallback = onLiveUpdate || null;
    stopNotificationPolling();
    refreshNotifications();
    pollTimer = setInterval(refreshNotifications, 8000);
}

export function stopNotificationPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

export function initNotificationControls() {
    const bellBtn = document.getElementById('notif-bell-btn');
    const pop = document.getElementById('notif-popover');
    const markAllBtn = document.getElementById('notif-mark-all-btn');
    const wrap = document.getElementById('notif-wrap');

    bellBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('role-switcher-menu')?.classList.remove('open');
        const isOpen = pop?.classList.toggle('open');
        if (isOpen) refreshNotifications();
    });

    markAllBtn?.addEventListener('click', () => markAllNotificationsRead());

    window.addEventListener('click', (e) => {
        if (wrap && !wrap.contains(e.target)) {
            pop?.classList.remove('open');
        }
    });

    if (!window._iguideSyncBadgeHooked) {
        window._iguideSyncBadgeHooked = true;
        window.addEventListener('iguide:db-sync', () => {
            refreshNotifications();
        });
    }
}

