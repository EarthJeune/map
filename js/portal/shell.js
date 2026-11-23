/**
 * iGUIDE Responsive Glassmorphic Portal Shell, Role-Color Engine & Collapsible Sidebar Router
 */

import { MAPBOX_ACCESS_TOKEN } from '../data/config.js';
import {
    PortalState,
    ROLE_META,
    STATION_NAMES,
    SVG_ICONS,
    apiFetch,
    showToast,
    escapeHtml,
    enableResizableColumns,
    initPersistentResizableTextareas,
    showPortalConfirm
} from './core.js';
import { initAuthModule, completeAuthSession, logoutPortal, switchAuthView } from './auth.js?v=370';
import { initNotificationControls, startNotificationPolling, stopNotificationPolling, renderNotificationsTab, refreshNotifications, syncSidebarQueueBadges } from './notifications.js?v=373';
import { initRoleSwitcher, syncRoleSwitcherUi } from './role-switcher.js?v=372';
import { runRoleTransition } from './role-transition.js';
import { renderDashboardTab } from './dashboard.js?v=375';
import { renderPinTab } from './pin-station.js?v=375';
import { renderBuildingsTab } from './buildings-crud.js?v=375';
import { renderOfficesTab } from './offices-crud.js?v=375';
import { renderPlotsTab } from './plots-crud.js?v=375';
import { renderUserAccountsTab, renderLoginLogsTab } from './users-governance.js?v=375';
import { renderAdminReviewsTab, renderReviewQueueTab, renderReviewDirectoryTab } from './change-requests.js?v=375';

if (window.mapboxgl) {
    window.mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
}

const ROLE_NAV_GROUPS = {
    super_admin: [
        {
            id: 'sa-overview',
            label: '1. Overview & Audit',
            items: [
                { tab: 'dashboard', label: 'Multi-Station Dashboard', icon: 'dashboard' },
                { tab: 'notifications', label: 'Notifications', icon: 'bell' },
                { tab: 'admin-login-logs', label: 'Sign-In Audit Logs', icon: 'shield' }
            ]
        },
        {
            id: 'sa-gov',
            label: '2. Governance & Users',
            items: [
                { tab: 'admin-reviewers', label: 'User Approvals & Roles', icon: 'users' },
                { tab: 'admin-reviews', label: 'Publish & Change Queue', icon: 'checkSquare' }
            ]
        },
        {
            id: 'sa-crud',
            label: '3. Edit Records',
            items: [
                { tab: 'pin', label: '"You Are Here" Pin & Station', icon: 'pin' },
                { tab: 'buildings', label: 'Buildings & Photos', icon: 'building' },
                { tab: 'offices', label: 'Internal Offices', icon: 'folder' },
                { tab: 'plots', label: 'Agricultural Plots & Crops', icon: 'sprout' }
            ]
        },
        {
            id: 'sa-editors',
            label: '4. Visual Map Editors',
            items: [
                { tab: 'editor-draw', label: 'Building Footprint Editor', icon: 'drawFootprint' },
                { tab: 'editor-plot', label: 'Agricultural Plot Editor', icon: 'drawPlot' },
                { tab: 'editor-road', label: 'Road & Entrance Editor', icon: 'route' },
                { tab: 'editor-tree', label: '3D Tree Placement Editor', icon: 'tree' },
                { tab: 'editor-pill', label: 'Pill Label Offset Editor', icon: 'drawPill' }
            ]
        }
    ],
    administrator: [
        {
            id: 'adm-overview',
            label: '1. Overview & Audit',
            items: [
                { tab: 'dashboard', label: 'Dashboard & Status', icon: 'dashboard' },
                { tab: 'notifications', label: 'Notifications', icon: 'bell' },
                { tab: 'admin-login-logs', label: 'Sign-In Audit Logs', icon: 'shield' }
            ]
        },
        {
            id: 'adm-gov',
            label: '2. Governance & Publishing',
            items: [
                { tab: 'admin-reviewers', label: 'User Approvals & Roles', icon: 'users' },
                { tab: 'admin-reviews', label: 'Change Requests & Publish', icon: 'checkSquare' }
            ]
        },
        {
            id: 'adm-directory',
            label: '3. Station Directory (Read-Only)',
            items: [
                { tab: 'review-buildings', label: 'Buildings & Photos', icon: 'building' },
                { tab: 'review-offices', label: 'Internal Offices', icon: 'folder' },
                { tab: 'review-plots', label: 'Agricultural Plots', icon: 'sprout' }
            ]
        }
    ],
    gis_editor: [
        {
            id: 'gis-home',
            label: 'Overview & Submissions',
            items: [
                { tab: 'dashboard', label: 'Dashboard & Status', icon: 'dashboard' },
                { tab: 'notifications', label: 'Notifications', icon: 'bell' },
                { tab: 'admin-reviews', label: 'My Submissions & Revisions', icon: 'checkSquare' }
            ]
        },
        {
            id: 'gis-crud',
            label: 'Edit Records',
            items: [
                { tab: 'pin', label: '"You Are Here" Pin & Station', icon: 'pin' },
                { tab: 'buildings', label: 'Buildings & Photos', icon: 'building' },
                { tab: 'offices', label: 'Internal Offices', icon: 'folder' },
                { tab: 'plots', label: 'Agricultural Plots & Crops', icon: 'sprout' }
            ]
        },
        {
            id: 'gis-editors',
            label: 'Visual Map Editors',
            items: [
                { tab: 'editor-draw', label: 'Building Footprint Editor', icon: 'drawFootprint' },
                { tab: 'editor-plot', label: 'Agricultural Plot Editor', icon: 'drawPlot' },
                { tab: 'editor-road', label: 'Road & Entrance Editor', icon: 'route' },
                { tab: 'editor-tree', label: '3D Tree Placement Editor', icon: 'tree' },
                { tab: 'editor-pill', label: 'Pill Label Offset Editor', icon: 'drawPill' }
            ]
        }
    ],
    reviewer: [
        {
            id: 'rev-queue',
            label: 'Review & Approvals',
            items: [
                { tab: 'review-queue', label: 'Pending Reviews', icon: 'checkSquare' }
            ]
        },
        {
            id: 'rev-view',
            label: 'Station Directory (Read-Only)',
            items: [
                { tab: 'review-overview', label: 'Dashboard & Pin', icon: 'dashboard' },
                { tab: 'notifications', label: 'Notifications', icon: 'bell' },
                { tab: 'review-buildings', label: 'Buildings & Photos', icon: 'building' },
                { tab: 'review-offices', label: 'Internal Offices', icon: 'folder' },
                { tab: 'review-plots', label: 'Agricultural Plots', icon: 'sprout' }
            ]
        }
    ]
};

const TAB_META = {
    dashboard: { title: 'Dashboard & Multi-Station Overview', icon: 'dashboard' },
    notifications: { title: 'Activity Notifications & Updates', icon: 'bell' },
    pin: { title: 'Station Settings & "You Are Here" Kiosk Pin', icon: 'pin' },
    buildings: { title: 'Buildings, Status & Photo Gallery', icon: 'building' },
    offices: { title: 'Internal Building Offices', icon: 'folder' },
    plots: { title: 'Agricultural Plots, Crops & History', icon: 'sprout' },
    'admin-reviews': { title: 'Change Requests, Revisions & Publish Queue', icon: 'checkSquare' },
    'admin-reviewers': { title: 'User Approvals & Role Assignments', icon: 'users' },
    'admin-login-logs': { title: 'Sign-In Audit Logs & Security Trail', icon: 'shield' },
    'review-queue': { title: 'Station Reviewer Approval Queue', icon: 'checkSquare' },
    'review-overview': { title: 'Station Overview & Kiosk Pin (Read-Only)', icon: 'dashboard' },
    'review-buildings': { title: 'Buildings & Photos (Read-Only)', icon: 'building' },
    'review-offices': { title: 'Internal Building Offices (Read-Only)', icon: 'folder' },
    'review-plots': { title: 'Agricultural Plots & Crops (Read-Only)', icon: 'sprout' },
    'editor-draw': { title: 'Building Footprint & 3D Model Editor', icon: 'drawFootprint' },
    'editor-plot': { title: 'Agricultural Plot Polygon Editor', icon: 'drawPlot' },
    'editor-road': { title: 'Road & Entrance Routing Graph Editor', icon: 'route' },
    'editor-tree': { title: '3D Tree Placement Editor', icon: 'tree' },
    'editor-pill': { title: 'Floating Pill Label Offset Editor', icon: 'drawPill' }
};

function getInitials(name, email) {
    const src = (name || email || 'IG').trim();
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
}

export function toggleMobileSidebar(forceOpen = null) {
    const sidebar = document.getElementById('portal-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;
    const next = forceOpen !== null ? Boolean(forceOpen) : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', next);
    overlay.classList.toggle('open', next);
}

const SIDEBAR_BADGE_TABS = new Set(['notifications', 'admin-reviewers', 'admin-reviews', 'review-queue']);

function buildRoleSidebar() {
    const navEl = document.getElementById('sidebar-nav-container');
    if (!navEl) return;

    const groups = ROLE_NAV_GROUPS[PortalState.effectiveRole] || ROLE_NAV_GROUPS.gis_editor;
    const validTabs = new Set(groups.flatMap(g => g.items.map(i => i.tab)));
    if (!validTabs.has(PortalState.currentTab)) {
        PortalState.currentTab = groups[0]?.items[0]?.tab || 'dashboard';
        sessionStorage.setItem('iguide_active_tab', PortalState.currentTab);
        try { localStorage.setItem('iguide_active_tab', PortalState.currentTab); } catch (_) {}
    }

    navEl.innerHTML = groups.map(group => `
        <div class="nav-group" data-group-id="${group.id}">
            <button type="button" class="nav-group-toggle">
                <span>${escapeHtml(group.label)}</span>
                <svg class="nav-group-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div class="nav-group-items">
                ${group.items.map(item => `
                    <button type="button" class="nav-item ${PortalState.currentTab === item.tab ? 'active' : ''}" data-tab="${item.tab}">
                        ${SVG_ICONS[item.icon] || SVG_ICONS.dashboard}
                        <span>${escapeHtml(item.label)}</span>
                        ${SIDEBAR_BADGE_TABS.has(item.tab)
                            ? `<span class="nav-notif-badge" ${item.tab === 'notifications' ? 'id="sidebar-notif-badge"' : ''} data-nav-badge="${item.tab}" style="display:none;">0</span>`
                            : ''}
                    </button>
                `).join('')}
            </div>
        </div>
    `).join('');

    navEl.querySelectorAll('.nav-group-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.nav-group')?.classList.toggle('collapsed');
        });
    });

    navEl.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            window.switchTab(btn.dataset.tab);
            if (window.innerWidth <= 1024) {
                toggleMobileSidebar(false);
            }
        });
    });

    syncSidebarQueueBadges();
}

function syncStationSelectorUi() {
    const locked = PortalState.stationScope !== 'all';
    if (locked && PortalState.stationScope) {
        PortalState.currentStation = PortalState.stationScope;
    }

    const triggerBtn = document.getElementById('station-combo-btn');
    const chevron = document.getElementById('station-combo-chevron');
    const labelEl = document.getElementById('station-combo-label');
    const badgeText = document.getElementById('active-station-badge-text');
    const stName = STATION_NAMES[PortalState.currentStation] || `DA-${PortalState.currentStation.toUpperCase()}`;

    if (labelEl) labelEl.textContent = stName;
    if (badgeText) badgeText.textContent = `DA-${PortalState.currentStation.toUpperCase()}`;
    if (triggerBtn) {
        triggerBtn.classList.toggle('locked', locked);
        triggerBtn.disabled = locked;
    }
    if (chevron) chevron.style.display = locked ? 'none' : 'inline-block';

    document.querySelectorAll('.station-combo-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.station === PortalState.currentStation);
    });
}

export function applyPortalContext() {
    const roleSlug = PortalState.effectiveRole || 'super_admin';
    const meta = ROLE_META[roleSlug] || ROLE_META.super_admin;
    const isSuper = PortalState.baseRole === 'super_admin';
    const isMorphed = isSuper && roleSlug !== 'super_admin';

    // Color-code the entire portal frame via CSS custom properties
    document.body.dataset.role = roleSlug;
    document.title = `iGUIDE Portal (${meta.label}) — DA-CALABARZON`;

    const tagEl = document.getElementById('sidebar-brand-tag');
    const titleEl = document.getElementById('sidebar-brand-title');
    const userNameEl = document.getElementById('sidebar-user-name');
    const userAvatarEl = document.getElementById('sidebar-user-avatar');
    const userTitleEl = document.getElementById('sidebar-user-title');
    const baseRolePillEl = document.getElementById('sidebar-base-role-pill');
    const activeViewBoxEl = document.getElementById('sidebar-active-view-box');
    const activeViewLabelEl = document.getElementById('sidebar-active-view-label');
    const userRoleBadgeEl = document.getElementById('sidebar-user-role-badge');

    if (tagEl) tagEl.textContent = isMorphed ? `VIEWING AS • ${meta.tag}` : meta.tag;
    if (titleEl) {
        if (isMorphed) {
            titleEl.textContent = `iGUIDE • ${meta.label.replace(' (MIS Supt.)', '')}`;
        } else {
            titleEl.textContent = isSuper ? 'iGUIDE Overseer' : 'iGUIDE Portal';
        }
    }
    if (userNameEl) userNameEl.textContent = PortalState.fullName || PortalState.email || 'Portal User';
    if (userAvatarEl) userAvatarEl.textContent = getInitials(PortalState.fullName, PortalState.email);
    if (userTitleEl) {
        const titleText = PortalState.jobTitle || PortalState.officeName || (isSuper ? 'Computer Programmer I' : '');
        userTitleEl.textContent = titleText;
        userTitleEl.style.display = titleText ? '' : 'none';
    }
    if (baseRolePillEl) {
        baseRolePillEl.style.display = 'inline-flex';
        baseRolePillEl.textContent = meta.label.replace(' (MIS Supt.)', '');
    }
    if (activeViewBoxEl) {
        activeViewBoxEl.classList.toggle('is-morphed', isMorphed);
    }
    if (activeViewLabelEl) {
        activeViewLabelEl.textContent = isMorphed ? 'VIEWING AS ROLE' : 'ACTIVE ROLE';
    }
    if (userRoleBadgeEl) {
        const scopeLabel = PortalState.stationScope === 'all' ? 'All Stations' : `DA-${String(PortalState.stationScope).toUpperCase()}`;
        userRoleBadgeEl.textContent = `${meta.label} • ${scopeLabel}`;
    }

    syncStationSelectorUi();
    syncRoleSwitcherUi();
    buildRoleSidebar();
}

const EDITOR_GUIDES = {
    'editor-draw': {
        url: '/draw.html',
        lead: 'Building Footprints:',
        tips: 'Click any building polygon to drag vertices or edit properties. Use Save Directly to write station building GeoJSON.'
    },
    'editor-plot': {
        url: '/plot_draw.html',
        lead: 'Agricultural Plots:',
        tips: 'Click vertices to align trial plot boundaries over the drone orthomosaic. Changes auto-persist & save to station plot GeoJSON.'
    },
    'editor-road': {
        url: '/road_draw.html',
        lead: 'Roads & Entrances:',
        tips: "Press Key '2' to draw walkable roads, Key '1' to place building entrance nodes for A* routing, then Save Directly."
    },
    'editor-tree': {
        url: '/tree_draw.html',
        lead: '3D Tree Planter:',
        tips: 'Pick a tree species & scale, click satellite/drone map to plant (or click pin to remove), and toggle Mapbox 3D Preview to inspect lighting.'
    },
    'editor-pill': {
        url: '/pill_adjust.html',
        lead: 'Floating Pill Offsets:',
        tips: 'Drag any numbered building pill cleanly away from roofs or walkways, then click Save Pill Positions.'
    }
};

export async function loadCurrentTab() {
    const container = document.getElementById('admin-content-area');
    const titleEl = document.getElementById('topbar-title');
    const iconEl = document.getElementById('topbar-icon');
    if (!container) return;

    container.classList.remove('full-bleed', 'tab-fade-in');
    void container.offsetWidth;
    container.classList.add('tab-fade-in');

    const tab = PortalState.currentTab || 'dashboard';
    const tMeta = TAB_META[tab] || { title: 'iGUIDE Portal', icon: 'dashboard' };
    if (titleEl) titleEl.textContent = `${tMeta.title}`;
    if (iconEl) iconEl.innerHTML = SVG_ICONS[tMeta.icon] || SVG_ICONS.dashboard;

    try {
        if (tab === 'dashboard') {
            await renderDashboardTab(container);
        } else if (tab === 'notifications') {
            await renderNotificationsTab(container);
        } else if (tab === 'pin') {
            await renderPinTab(container);
        } else if (tab === 'buildings') {
            await renderBuildingsTab(container);
        } else if (tab === 'offices') {
            await renderOfficesTab(container);
        } else if (tab === 'plots') {
            await renderPlotsTab(container);
        } else if (tab === 'admin-reviews') {
            await renderAdminReviewsTab(container);
        } else if (tab === 'admin-reviewers') {
            await renderUserAccountsTab(container);
        } else if (tab === 'admin-login-logs') {
            await renderLoginLogsTab(container);
        } else if (tab === 'review-queue') {
            await renderReviewQueueTab(container);
        } else if (['review-overview', 'review-buildings', 'review-offices', 'review-plots'].includes(tab)) {
            await renderReviewDirectoryTab(container, tab);
        } else if (tab.startsWith('editor-')) {
            container.classList.add('full-bleed');
            const guide = EDITOR_GUIDES[tab] || { url: '/draw.html', lead: 'Visual Editor:', tips: 'Saves station geometry cleanly.' };
            const activeSt = PortalState.currentStation || 'lares';
            const lockedSt = PortalState.stationScope !== 'all' ? PortalState.stationScope : null;
            const targetStation = lockedSt || activeSt;
            const targetUrl = `${guide.url}?station=${encodeURIComponent(targetStation)}`;
            const stBadge = `DA-${targetStation.toUpperCase()}${lockedSt ? ' (Locked)' : ''}`;

            container.innerHTML = `
                <div class="editor-frame-shell">
                    <div class="editor-guide-bar" id="editor-guide-bar">
                        <div class="editor-guide-left">
                            <span class="editor-guide-station" id="editor-guide-station-badge">${escapeHtml(stBadge)}</span>
                            <div class="editor-guide-text">
                                <strong>${escapeHtml(guide.lead)}</strong> ${escapeHtml(guide.tips)}
                            </div>
                        </div>
                        <a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" id="editor-open-standalone-btn" style="text-decoration:none; white-space:nowrap;">Open Standalone ↗</a>
                    </div>
                    <iframe id="portal-visual-editor-iframe" class="editor-guide-iframe" src="${escapeHtml(targetUrl)}"></iframe>
                </div>
            `;

            const frame = document.getElementById('portal-visual-editor-iframe');
            fetch('/api/version').then(r => r.ok ? r.json() : null).then(v => {
                if (v && v.diskEditorsLocked) {
                    const guideText = document.querySelector('#editor-guide-bar .editor-guide-text');
                    if (guideText && !guideText.querySelector('.editor-prod-lock-pill')) {
                        const badge = document.createElement('span');
                        badge.className = 'editor-prod-lock-pill';
                        badge.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-left:8px;padding:2px 8px;border-radius:999px;background:rgba(245,158,11,0.16);border:1px solid rgba(245,158,11,0.45);color:#fbbf24;font-size:11px;font-weight:700;';
                        badge.innerHTML = `${SVG_ICONS.lock} <span>Production Disk-Lock Active (Edit geometry locally & deploy via Git)</span>`;
                        guideText.appendChild(badge);
                    }
                }
            }).catch(() => {});
            frame?.addEventListener('load', () => {
                try {
                    frame.contentWindow?.postMessage({
                        type: 'IGUIDE_PORTAL_CONTEXT',
                        token: PortalState.token,
                        baseRole: PortalState.baseRole,
                        effectiveRole: PortalState.effectiveRole,
                        stationScope: PortalState.stationScope,
                        currentStation: targetStation
                    }, window.location.origin);
                } catch (_) {}
            });
        }
    } catch (err) {
        container.innerHTML = `<div class="panel-card" style="color:#fda4af; border-color:rgba(244,63,94,0.35);"><h3>We couldn't load this section</h3><p style="margin-top:8px; color:#94a3b8;">Please try refreshing the page or switching tabs. (${escapeHtml(err.message || 'Connection issue')})</p></div>`;
    }
}


window.onChangeStation = function(stationId) {
    if (PortalState.stationScope !== 'all' && stationId !== PortalState.stationScope) {
        showToast(`Your account is locked to DA-${PortalState.stationScope.toUpperCase()}.`);
        return;
    }
    PortalState.currentStation = stationId;
    sessionStorage.setItem('iguide_active_station', stationId);
    try { localStorage.setItem('iguide_active_station', stationId); } catch (_) {}
    syncStationSelectorUi();
    refreshNotifications();
    loadCurrentTab();
};

window.switchTab = function(tabId) {
    PortalState.currentTab = tabId;
    sessionStorage.setItem('iguide_active_tab', tabId);
    try { localStorage.setItem('iguide_active_tab', tabId); } catch (_) {}
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    loadCurrentTab();
};

window.refreshCurrentTab = () => loadCurrentTab();

window.logoutAdmin = async () => {
    const ok = await showPortalConfirm({
        title: 'Log Out of iGUIDE Portal?',
        message: 'Are you sure you want to end your current session and return to the sign-in screen?',
        confirmLabel: 'Log Out',
        cancelLabel: 'Stay Signed In',
        danger: true
    });
    if (!ok) return;
    stopNotificationPolling();
    await logoutPortal();
};

window.toggleStationCombobox = (e) => {
    if (e) e.stopPropagation();
    if (PortalState.stationScope !== 'all') return;
    const btn = document.getElementById('station-combo-btn');
    const menu = document.getElementById('station-combo-menu');
    const isOpen = menu?.classList.toggle('open');
    btn?.classList.toggle('open', Boolean(isOpen));
};

window.selectStationCombo = (stationId) => {
    document.getElementById('station-combo-menu')?.classList.remove('open');
    document.getElementById('station-combo-btn')?.classList.remove('open');
    window.onChangeStation(stationId);
};

window.addEventListener('click', (e) => {
    const wrap = document.getElementById('station-combo-wrap');
    if (wrap && !wrap.contains(e.target)) {
        document.getElementById('station-combo-menu')?.classList.remove('open');
        document.getElementById('station-combo-btn')?.classList.remove('open');
    }
});

function startPortalRuntime() {
    startNotificationPolling(({ tabId, stationId, targetTable, targetId, type }) => {
        if (type === 'system_update' || type === 'broadcast' || type === 'update') {
            return;
        }
        if (stationId && (PortalState.stationScope === 'all' || PortalState.stationScope === stationId)) {
            PortalState.currentStation = stationId;
            sessionStorage.setItem('iguide_active_station', stationId);
            syncStationSelectorUi();
        }
        if (tabId) {
            window.switchTab(tabId);
            // Deep-link redirection to the exact concern
            if (targetTable === 'change_requests' && targetId) {
                setTimeout(() => {
                    if (typeof window.openCrDiffModal === 'function') {
                        window.openCrDiffModal(Number(targetId));
                    }
                }, 350);
            } else if (targetTable === 'admin_users' && targetId) {
                setTimeout(() => {
                    if (typeof window.openUserApprovalModal === 'function') {
                        window.openUserApprovalModal(Number(targetId));
                    }
                }, 350);
            } else if (targetTable === 'buildings' && targetId) {
                setTimeout(() => {
                    if (typeof window.openReadOnlyBuildingModal === 'function') {
                        window.openReadOnlyBuildingModal(targetId);
                    }
                }, 350);
            } else if (targetTable === 'plots' && targetId) {
                setTimeout(() => {
                    if (typeof window.openReadOnlyPlotModal === 'function') {
                        window.openReadOnlyPlotModal(Number(targetId));
                    }
                }, 350);
            }
        } else {
            loadCurrentTab();
        }
    }, (latestNotif) => {
        // Auto-refresh active portal view in-place when new notifications arrive,
        // as long as the user is not currently editing inside an open modal.
        const modalIds = ['gov-modal', 'building-modal', 'bldg-preview-modal', 'office-modal', 'plot-modal'];
        const anyOpenModal = modalIds.some(id => {
            const el = document.getElementById(id);
            return el && (el.classList.contains('open') || getComputedStyle(el).display === 'flex');
        });
        if (!anyOpenModal) {
            loadCurrentTab();
        }
        if (latestNotif && latestNotif.title) {
            showToast(`New notification: ${latestNotif.title}`);
        }
    });
}

async function handleAuthenticatedEntry(options = {}) {
    const ov = document.getElementById('login-overlay');
    if (options && options.animate) {
        const isOverseerMorph = PortalState.baseRole === 'super_admin' && PortalState.effectiveRole !== 'super_admin';
        await runRoleTransition({
            role: PortalState.effectiveRole,
            mode: options.mode || 'login',
            fromRole: options.fromRole || '',
            baseRole: PortalState.baseRole,
            fullName: PortalState.fullName,
            jobTitle: PortalState.jobTitle || (PortalState.baseRole === 'super_admin' ? 'Computer Programmer I' : ''),
            stationScope: PortalState.stationScope,
            currentStation: PortalState.currentStation,
            isOverseerMorph,
            minDurationMs: options.mode === 'return' ? 1250 : 1650,
            work: async () => {
                await new Promise(r => setTimeout(r, 220));
                if (ov) ov.style.display = 'none';
                applyPortalContext();
                startPortalRuntime();
                await Promise.race([loadCurrentTab(), new Promise(r => setTimeout(r, 2500))]);
            }
        });
        return;
    }

    if (ov) ov.style.display = 'none';
    applyPortalContext();
    loadCurrentTab();
    startPortalRuntime();
}

// Initialize Portal Shell
(async function bootPortal() {
    PortalState.onUnauthorized = () => {
        stopNotificationPolling();
        switchAuthView('signin');
        const ov = document.getElementById('login-overlay');
        if (ov) ov.style.display = 'flex';
    };

    initAuthModule(handleAuthenticatedEntry);
    initNotificationControls();
    initRoleSwitcher(async () => {
        applyPortalContext();
        await Promise.race([loadCurrentTab(), new Promise(r => setTimeout(r, 2500))]);
    });

    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => toggleMobileSidebar());
    document.getElementById('sidebar-close-btn')?.addEventListener('click', () => toggleMobileSidebar(false));
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => toggleMobileSidebar(false));

    if (PortalState.token) {
        try {
            let authPayload = await apiFetch('/api/admin/verify');
            const params = new URLSearchParams(window.location.search);
            const returningFromVisitor = params.get('from_preview') === 'visitor';
            if (returningFromVisitor) {
                try {
                    window.history.replaceState({}, '', window.location.pathname);
                } catch (_) {}
                if (authPayload.baseRole === 'super_admin' && authPayload.role !== 'super_admin') {
                    try {
                        const restored = await apiFetch('/api/admin/switch-role', {
                            method: 'POST',
                            body: JSON.stringify({ targetRole: 'super_admin' })
                        });
                        authPayload = { ...authPayload, ...restored };
                    } catch (_) {}
                }
            }
            await completeAuthSession(
                { token: PortalState.token, ...authPayload },
                returningFromVisitor ? { animate: true, mode: 'return', fromRole: 'visitor' } : { animate: false }
            );
        } catch (_) {
            // Invalid/expired stored token falls back cleanly to /login screen
            PortalState.token = '';
            try { sessionStorage.removeItem('da_admin_token'); } catch (_) {}
            try { localStorage.removeItem('da_admin_token'); } catch (_) {}
        }
    }
})();


// Auto-attach drag-to-resize column handles and persistent resizable textareas across tabs & modals
(function initGlobalResizableUI() {
    const attach = () => {
        try { enableResizableColumns(document); } catch (_) { }
        try { initPersistentResizableTextareas(document); } catch (_) { }
    };
    attach();
    if (document.body && typeof MutationObserver !== 'undefined') {
        const obs = new MutationObserver(() => attach());
        obs.observe(document.body, { childList: true, subtree: true });
    }
})();
