/**
 * Governance Console: Split User Approvals & Role Assignments + Sign-In Audit Logs
 */

import {
    PortalState,
    renderPaginationBarHtml,
    ROLE_META,
    SVG_ICONS,
    apiFetch,
    showToast,
    escapeHtml,
    hasPermission,
    openGovModal,
    closeGovModal,
    showPortalConfirm,
    getSavedPortalPref,
    setSavedPortalPref
} from './core.js';

const VALID_USER_SUBTABS = new Set(['pending', 'approved', 'not_approved', 'disabled']);

let activeUserSubTab = getSavedPortalPref('iguide_pref_user_subtab', 'pending'); // 'pending' | 'approved' | 'not_approved' | 'disabled'
let userSearch = '';
let userPage = 1;
let userLimit = Number(getSavedPortalPref('iguide_pref_user_limit', 10)) || 10;
let loginSearch = '';
let loginOutcomeFilter = '';
let loginPage = 1;
let loginLimit = Number(getSavedPortalPref('iguide_pref_login_limit', 15)) || 15;
let cachedUsersList = [];
let cachedLoginLogs = [];
let currentUsersContainerRef = null;

function renderRoleBadge(roleSlug, customHex = null) {
    const meta = ROLE_META[roleSlug] || { label: roleSlug || 'User', color: customHex || '#10b981' };
    const hex = customHex || meta.color;
    return `<span class="status-pill" style="background:color-mix(in srgb, ${hex} 16%, transparent); border:1px solid color-mix(in srgb, ${hex} 40%, transparent); color:${hex};"><span style="width:7px; height:7px; border-radius:999px; background:${hex};"></span><span>${escapeHtml(meta.label)}</span></span>`;
}

function renderUsersTbody(subtab) {
    const term = userSearch.trim().toLowerCase();
    const canApprove = hasPermission('users:approve_assign');
    const canManageRoles = hasPermission('users:manage_roles');

    const filtered = cachedUsersList.filter(u => {
        const st = u.approval_status || 'approved';
        const active = Number(u.is_active) === 1;
        if (subtab === 'pending' && st !== 'pending') return false;
        if (subtab === 'approved' && !(st === 'approved' && active)) return false;
        if (subtab === 'not_approved' && st !== 'not_approved') return false;
        if (subtab === 'disabled' && !(st === 'approved' && !active)) return false;
        if (term) {
            const hay = `${u.full_name || ''} ${u.email || ''} ${u.job_title || ''} ${u.office_name || ''} ${u.responsibilities || ''} ${u.role_slug || ''} ${u.station_scope || ''}`.toLowerCase();
            if (!hay.includes(term)) return false;
        }
        return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / userLimit));
    if (userPage > totalPages) userPage = totalPages;
    const paged = filtered.slice((userPage - 1) * userLimit, userPage * userLimit);

    const pagerEl = document.getElementById('ug-users-pagination');
    if (pagerEl) {
        pagerEl.innerHTML = renderPaginationBarHtml({
            total: filtered.length,
            page: userPage,
            limit: userLimit,
            itemLabel: 'accounts',
            pageAttr: 'data-ug-page',
            limitId: 'ug-users-limit'
        });
    }

    if (!paged.length) {
        return `<tr><td colspan="5" style="text-align:center; color:#64748b; padding:26px;">No accounts in this category.</td></tr>`;
    }

    return paged.map(u => {
        const roleSlug = u.role_slug || u.role || 'reviewer';
        const scopeStr = (u.station_scope || u.station_id || 'lares') === 'all'
            ? 'All Stations'
            : `DA-${String(u.station_scope || u.station_id).toUpperCase()}`;
        const statusBadge = u.approval_status === 'pending'
            ? `<span class="status-pill status-pill-dev">Pending Approval</span>`
            : (u.approval_status === 'not_approved'
                ? `<span class="status-pill status-pill-rose">Not Approved</span>`
                : (Number(u.is_active) === 1
                    ? `<span class="status-pill status-pill-live"><span class="status-dot-live"></span>Active</span>`
                    : `<span class="status-pill status-pill-rose">Disabled</span>`));

        return `
        <tr>
            <td>
                <div style="font-weight:700; color:#f8fafc;">${escapeHtml(u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Applicant')}</div>
                <div style="font-size:12px; color:#94a3b8;">${escapeHtml(u.email)}</div>
            </td>
            <td>
                ${u.job_title ? `<div style="font-size:12.5px; color:var(--role-accent-light); font-weight:700; margin-bottom:2px;">${escapeHtml(u.job_title)}</div>` : ''}
                <div style="font-size:12px; color:#e2e8f0; font-weight:600;">${escapeHtml(u.office_name || '—')}</div>
                ${u.responsibilities && u.responsibilities !== u.job_title ? `<div class="help-tip" style="max-width:260px;">${escapeHtml(u.responsibilities)}</div>` : ''}
            </td>
            <td>
                ${u.approval_status === 'pending'
                    ? `<span class="mono-code">Requested: ${escapeHtml(scopeStr)}</span>`
                    : `${renderRoleBadge(roleSlug, u.role_color)} <span class="mono-code" style="margin-left:4px;">${escapeHtml(scopeStr)}</span>`}
            </td>
            <td>
                ${statusBadge}
                ${u.rejection_reason ? `<div class="help-tip" style="color:#fda4af;">"${escapeHtml(u.rejection_reason)}"</div>` : ''}
                ${u.last_login_at ? `<div class="help-tip">Last login: ${new Date(u.last_login_at).toLocaleString()}</div>` : ''}
            </td>
            <td>
                <div class="action-cell">
                    ${u.approval_status === 'pending' && canApprove ? `
                        <button type="button" class="btn btn-emerald btn-sm" onclick="openUserApproveModal(${u.id}, 'approve')">Approve & Assign</button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="openUserDenyModal(${u.id})">Deny</button>
                    ` : ''}
                    ${u.approval_status === 'not_approved' && canApprove ? `
                        <button type="button" class="btn btn-emerald btn-sm" onclick="openUserApproveModal(${u.id}, 'approve')">Re-Approve</button>
                    ` : ''}
                    ${u.approval_status === 'approved' && canManageRoles && u.id !== 1 ? `
                        <button type="button" class="btn btn-blue btn-sm" onclick="openUserApproveModal(${u.id}, 'edit')">Edit Role</button>
                        ${Number(u.is_active) === 1
                            ? `<button type="button" class="btn btn-danger btn-sm" onclick="toggleUserActive(${u.id}, false)">Disable</button>`
                            : `<button type="button" class="btn btn-emerald btn-sm" onclick="toggleUserActive(${u.id}, true)">Enable</button>`}
                    ` : (u.id === 1 ? `<span class="mono-code">Primary Super Admin</span>` : '')}
                </div>
            </td>
        </tr>`;
    }).join('');
}

function buildLoginPageNumbers(page, totalPages) {
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

function renderLoginLogsTbody(logs = cachedLoginLogs) {
    if (!logs || !logs.length) {
        return `<tr><td colspan="5" style="text-align:center; color:#64748b; padding:26px;">No matching sign-in events recorded yet.</td></tr>`;
    }

    const statusMap = {
        success: ['status-pill-live', 'OTP Verified Sign-In'],
        otp_sent: ['status-pill-blue', 'Password OK • OTP Sent'],
        blocked_pending: ['status-pill-dev', 'Blocked (Pending Approval)'],
        blocked_not_approved: ['status-pill-rose', 'Blocked (Not Approved)'],
        blocked_disabled: ['status-pill-rose', 'Blocked (Disabled)'],
        failed_password: ['status-pill-rose', 'Failed Password']
    };

    return logs.map(l => {
        const [cls, label] = statusMap[l.login_status] || ['status-pill-blue', l.login_status];
        return `
        <tr>
            <td style="font-size:12px; color:#94a3b8;">${new Date(l.created_at).toLocaleString()}</td>
            <td>
                <strong style="color:#f8fafc;">${escapeHtml(l.full_name || '—')}</strong>
                <div style="font-size:11.5px; color:#94a3b8;">${escapeHtml(l.email || '')}</div>
            </td>
            <td>
                ${l.role_used ? renderRoleBadge(l.role_used) : '<span class="mono-code">—</span>'}
                <span class="mono-code" style="margin-left:4px;">${escapeHtml((l.acting_station || '—').toUpperCase())}</span>
            </td>
            <td><span class="status-pill ${cls}">${escapeHtml(label)}</span></td>
            <td>
                <div style="font-size:12px; color:#cbd5e1; white-space:nowrap;">${escapeHtml(l.client_device || 'Web Browser')}</div>
            </td>
        </tr>`;
    }).join('');
}

function renderLoginPaginationHtml({ total, page, limit, totalPages }) {
    const startIdx = total === 0 ? 0 : ((page - 1) * limit) + 1;
    const endIdx = Math.min(total, page * limit);
    const nums = buildLoginPageNumbers(page, totalPages);
    return `
        <div class="log-pagination-info">Showing <strong>${startIdx}–${endIdx}</strong> of <strong>${total}</strong> events</div>
        <div class="log-pagination-controls">
            <select id="ug-login-limit" class="form-control log-page-size-select" aria-label="Events per page">
                ${[10, 15, 25, 50].map(sz => `<option value="${sz}" ${limit === sz ? 'selected' : ''}>${sz} / page</option>`).join('')}
            </select>
            <button type="button" class="log-page-btn" data-login-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
            ${nums.map(n => n === '...'
                ? `<span class="log-page-ellipsis">…</span>`
                : `<button type="button" class="log-page-btn ${n === page ? 'active' : ''}" data-login-page="${n}">${n}</button>`
            ).join('')}
            <button type="button" class="log-page-btn" data-login-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next →</button>
        </div>
    `;
}

export async function renderUserAccountsTab(container, initialSubTab = null) {
    currentUsersContainerRef = container;
    if (initialSubTab && VALID_USER_SUBTABS.has(initialSubTab)) {
        activeUserSubTab = initialSubTab;
    } else if (!VALID_USER_SUBTABS.has(activeUserSubTab)) {
        activeUserSubTab = 'pending';
    }

    const usersData = await apiFetch('/api/admin/users');
    cachedUsersList = usersData.users || [];

    const counts = {
        pending: cachedUsersList.filter(u => u.approval_status === 'pending').length,
        approved: cachedUsersList.filter(u => u.approval_status === 'approved' && Number(u.is_active) === 1).length,
        not_approved: cachedUsersList.filter(u => u.approval_status === 'not_approved').length,
        disabled: cachedUsersList.filter(u => u.approval_status === 'approved' && Number(u.is_active) === 0).length
    };

    const tabs = [
        { id: 'pending', label: 'Pending Sign-Ups', count: counts.pending },
        { id: 'approved', label: 'Approved (Active)', count: counts.approved },
        { id: 'not_approved', label: 'Not Approved', count: counts.not_approved },
        { id: 'disabled', label: 'Disabled', count: counts.disabled }
    ];

    container.innerHTML = `
        <div class="panel-card">
            <div class="panel-header">
                <div class="panel-title-group">
                    <div class="panel-title-icon">${SVG_ICONS.users}</div>
                    <div>
                        <h3>User Sign-Up Approvals & Role Assignments</h3>
                        <div class="help-tip">Review pending staff registrations, assign color-coded roles and research station locks, or enable/disable portal accounts. (Sign-in history is tracked separately under Sign-In Audit Logs.)</div>
                    </div>
                </div>
            </div>

            <div class="subtabs-strip" id="ug-subtabs">
                ${tabs.map(t => `
                    <button type="button" class="subtab-pill ${activeUserSubTab === t.id ? 'active' : ''}" data-ug-tab="${t.id}">
                        <span>${escapeHtml(t.label)}</span>
                        <span class="subtab-count">${t.count}</span>
                    </button>
                `).join('')}
            </div>

            <div style="margin-bottom:14px;">
                <input type="text" id="ug-users-search" class="form-control" placeholder="Search staff by name, email, office, role, or station..." value="${escapeHtml(userSearch)}">
            </div>

            <div class="table-scroll-wrap">
            <table class="crud-table">
                <thead>
                    <tr>
                        <th>Account Profile</th>
                        <th>Position & Division / Office</th>
                        <th>Assigned Role & Station</th>
                        <th>Status / Last Activity</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="ug-users-tbody"></tbody>
            </table>
            </div>
            <div id="ug-users-pagination" class="log-pagination-bar"></div>
        </div>
    `;

    const bindUsersPager = () => {
        container.querySelectorAll('[data-ug-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const nextP = Number(btn.dataset.ugPage);
                if (!btn.disabled && nextP >= 1) {
                    userPage = nextP;
                    refreshUsersRows();
                }
            });
        });
        document.getElementById('ug-users-limit')?.addEventListener('change', (e) => {
            userLimit = Number(e.target.value) || 10;
            setSavedPortalPref('iguide_pref_user_limit', userLimit);
            userPage = 1;
            refreshUsersRows();
        });
    };

    const refreshUsersRows = () => {
        const tbody = document.getElementById('ug-users-tbody');
        if (tbody) tbody.innerHTML = renderUsersTbody(activeUserSubTab);
        bindUsersPager();
    };
    refreshUsersRows();

    document.getElementById('ug-users-search')?.addEventListener('input', (e) => {
        userSearch = e.target.value;
        userPage = 1;
        refreshUsersRows();
    });

    container.querySelectorAll('[data-ug-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const nextTab = btn.dataset.ugTab;
            if (!VALID_USER_SUBTABS.has(nextTab)) return;
            activeUserSubTab = nextTab;
            userPage = 1;
            container.querySelectorAll('[data-ug-tab]').forEach(b => b.classList.toggle('active', b.dataset.ugTab === activeUserSubTab));
            refreshUsersRows();
        });
    });
}

export async function renderLoginLogsTab(container) {
    if (!hasPermission('logins:view')) {
        container.innerHTML = `
            <div class="panel-card">
                <div class="panel-header">
                    <div class="panel-title-group">
                        <div class="panel-title-icon">${SVG_ICONS.shield}</div>
                        <div>
                            <h3>Sign-In Audit Logs & Security Trail</h3>
                            <div class="help-tip">Access restricted: your current role does not hold <code>logins:view</code> permission.</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const isSuperAdmin = PortalState.effectiveRole === 'super_admin';

    const fetchLoginPageData = async (page = loginPage) => {
        const res = await apiFetch(
            `/api/admin/login-logs?page=${page}&limit=${loginLimit}&status=${encodeURIComponent(loginOutcomeFilter)}&search=${encodeURIComponent(loginSearch.trim())}`
        );
        if (Array.isArray(res)) {
            const total = res.length;
            const totalPages = Math.max(1, Math.ceil(total / loginLimit));
            const safePage = Math.min(Math.max(1, page), totalPages);
            const items = res.slice((safePage - 1) * loginLimit, safePage * loginLimit);
            return {
                items,
                total,
                page: safePage,
                limit: loginLimit,
                totalPages,
                summary: {
                    totalAll: total,
                    verified: res.filter(l => l.login_status === 'success').length,
                    blockedOrFailed: res.filter(l => ['failed_password', 'blocked_pending', 'blocked_not_approved', 'blocked_disabled'].includes(l.login_status)).length
                }
            };
        }
        return {
            items: Array.isArray(res?.items) ? res.items : [],
            total: Number(res?.total || 0),
            page: Number(res?.page || 1),
            limit: Number(res?.limit || loginLimit),
            totalPages: Number(res?.totalPages || 1),
            summary: res?.summary || { totalAll: 0, verified: 0, blockedOrFailed: 0 }
        };
    };

    const initialData = await fetchLoginPageData(loginPage);
    cachedLoginLogs = initialData.items;
    loginPage = initialData.page;
    loginLimit = initialData.limit;

    const totalEvents = Number(initialData.summary.totalAll || 0);
    const verifiedCount = Number(initialData.summary.verified || 0);
    const blockedOrFailedCount = Number(initialData.summary.blockedOrFailed || 0);

    container.innerHTML = `
        <div class="panel-card">
            <div class="panel-header">
                <div class="panel-title-group">
                    <div class="panel-title-icon">${SVG_ICONS.shield}</div>
                    <div>
                        <h3>Sign-In Audit Logs & Security Trail</h3>
                        <div class="help-tip">${isSuperAdmin
                            ? 'Read-only authentication log of OTP-verified sign-ins, failed password attempts, and blocked login events across all roles.'
                            : 'Showing sign-in events for roles lower than Super Admin (Super Admin logins are hidden).'}</div>
                    </div>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;" id="ug-login-summary-pills">
                    <span class="status-pill status-pill-blue">Total Events: <strong id="ug-login-stat-total">${totalEvents}</strong></span>
                    <span class="status-pill status-pill-live"><span class="status-dot-live"></span>OTP Verified: <strong id="ug-login-stat-verified">${verifiedCount}</strong></span>
                    <span class="status-pill ${blockedOrFailedCount > 0 ? 'status-pill-rose' : 'status-pill-blue'}" id="ug-login-blocked-pill">Blocked / Failed: <strong id="ug-login-stat-blocked">${blockedOrFailedCount}</strong></span>
                </div>
            </div>

            <div class="portal-filter-grid-2" style="display:grid; grid-template-columns:1.5fr 1fr; gap:10px; margin-bottom:14px;">
                <input type="text" id="ug-login-search" class="form-control" placeholder="Search logs by name, email, role, or outcome..." value="${escapeHtml(loginSearch)}">
                <select id="ug-login-filter" class="form-control">
                    <option value="">All Login Outcomes (${totalEvents})</option>
                    <option value="success" ${loginOutcomeFilter === 'success' ? 'selected' : ''}>OTP Verified Sign-In</option>
                    <option value="otp_sent" ${loginOutcomeFilter === 'otp_sent' ? 'selected' : ''}>OTP Sent</option>
                    <option value="blocked_pending" ${loginOutcomeFilter === 'blocked_pending' ? 'selected' : ''}>Blocked — Pending Approval</option>
                    <option value="blocked_not_approved" ${loginOutcomeFilter === 'blocked_not_approved' ? 'selected' : ''}>Blocked — Not Approved</option>
                    <option value="blocked_disabled" ${loginOutcomeFilter === 'blocked_disabled' ? 'selected' : ''}>Blocked — Disabled</option>
                    <option value="failed_password" ${loginOutcomeFilter === 'failed_password' ? 'selected' : ''}>Failed Password</option>
                </select>
            </div>

            <div class="table-scroll-wrap">
            <table class="crud-table">
                <thead>
                    <tr><th>Timestamp</th><th>User / Email</th><th>Role & Station</th><th>Outcome</th><th>Client / Device</th></tr>
                </thead>
                <tbody id="ug-login-tbody">${renderLoginLogsTbody(cachedLoginLogs)}</tbody>
            </table>
            </div>
            <div id="ug-login-pagination" class="log-pagination-bar">${renderLoginPaginationHtml(initialData)}</div>
        </div>
    `;

    const bindLoginPaginationEvents = () => {
        container.querySelectorAll('[data-login-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const nextP = Number(btn.dataset.loginPage);
                if (!btn.disabled && nextP >= 1) reloadLoginPage(nextP);
            });
        });
        document.getElementById('ug-login-limit')?.addEventListener('change', (e) => {
            loginLimit = Number(e.target.value) || 15;
            setSavedPortalPref('iguide_pref_login_limit', loginLimit);
            loginPage = 1;
            reloadLoginPage(1);
        });
    };

    const reloadLoginPage = async (page = 1) => {
        const tbody = document.getElementById('ug-login-tbody');
        const pager = document.getElementById('ug-login-pagination');
        if (!tbody || !pager) return;
        try {
            const pageData = await fetchLoginPageData(page);
            cachedLoginLogs = pageData.items;
            loginPage = pageData.page;
            loginLimit = pageData.limit;

            tbody.innerHTML = renderLoginLogsTbody(cachedLoginLogs);
            pager.innerHTML = renderLoginPaginationHtml(pageData);
            bindLoginPaginationEvents();

            const totEl = document.getElementById('ug-login-stat-total');
            const verEl = document.getElementById('ug-login-stat-verified');
            const blkEl = document.getElementById('ug-login-stat-blocked');
            const blkPill = document.getElementById('ug-login-blocked-pill');
            const sumTot = Number(pageData.summary?.totalAll || 0);
            const sumBlk = Number(pageData.summary?.blockedOrFailed || 0);
            if (totEl) totEl.textContent = sumTot;
            if (verEl) verEl.textContent = Number(pageData.summary?.verified || 0);
            if (blkEl) blkEl.textContent = sumBlk;
            if (blkPill) blkPill.className = `status-pill ${sumBlk > 0 ? 'status-pill-rose' : 'status-pill-blue'}`;
        } catch (err) {
            showToast(err.message || 'Could not load sign-in logs');
        }
    };

    bindLoginPaginationEvents();

    let loginSearchTimer = null;
    document.getElementById('ug-login-search')?.addEventListener('input', (e) => {
        loginSearch = e.target.value;
        loginPage = 1;
        clearTimeout(loginSearchTimer);
        loginSearchTimer = setTimeout(() => reloadLoginPage(1), 250);
    });
    document.getElementById('ug-login-filter')?.addEventListener('change', (e) => {
        loginOutcomeFilter = e.target.value;
        loginPage = 1;
        reloadLoginPage(1);
    });
}

window.openUserApproveModal = (userId, mode = 'approve') => {
    const u = cachedUsersList.find(x => x.id === userId);
    if (!u) return;

    const currentRole = (mode === 'approve' && u.approval_status === 'pending') ? 'gis_editor' : (u.role_slug || u.role || 'gis_editor');
    const currentStation = (u.station_scope && u.station_scope !== 'all') ? u.station_scope : (u.station_id && u.station_id !== 'all' ? u.station_id : 'lares');

    const roleChoices = [
        { slug: 'gis_editor', name: 'GIS Editor', color: '#0ea5e9', desc: 'Station-locked CRUD drafting (to Reviewer) & Visual Map Editors.' },
        { slug: 'reviewer', name: 'Station Reviewer', color: '#f59e0b', desc: 'Station-locked review, suggest edits & approve/deny change requests.' },
        { slug: 'administrator', name: 'Administrator (MIS)', color: '#10b981', desc: 'All Stations: approves sign-ups & publishes reviewed updates live.' }
    ];

    let selectedRole = roleChoices.some(r => r.slug === currentRole) ? currentRole : 'gis_editor';

    openGovModal({
        title: mode === 'approve' ? `Approve Sign-Up & Assign Role — ${u.full_name || u.email}` : `Edit Role & Station Scope — ${u.full_name || u.email}`,
        maxWidth: '680px',
        bodyHtml: `
            <div style="padding:12px 14px; border-radius:10px; background:rgba(9,13,22,0.78); border:1px solid var(--border-subtle); margin-bottom:14px;">
                <div style="font-weight:700; color:#f8fafc; font-size:14px;">${escapeHtml(u.full_name || 'Applicant')}${u.job_title ? ` <span style="font-size:12px; color:var(--role-accent-light); font-weight:700;">• ${escapeHtml(u.job_title)}</span>` : ''}</div>
                <div style="font-size:12px; color:#94a3b8;">${escapeHtml(u.email)} • Requested Station: <strong>DA-${escapeHtml(String(u.station_id || 'lares').toUpperCase())}</strong></div>
                ${u.office_name ? `<div style="font-size:11.5px; color:#cbd5e1; margin-top:3px;">${escapeHtml(u.office_name)}</div>` : ''}
            </div>

            <label style="display:block; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em;">1. Select Color-Coded Portal Role</label>
            <div class="role-selector-grid" id="ug-role-cards"${roleChoices.length === 4 ? ' style="grid-template-columns:repeat(2, minmax(0, 1fr));"' : ''}>
                ${roleChoices.map(r => `
                    <button type="button" class="role-radio-card ${selectedRole === r.slug ? 'selected' : ''}" data-pick-role="${r.slug}" style="--card-role-color:${r.color};">
                        <div class="role-radio-title">
                            <span style="width:9px; height:9px; border-radius:999px; background:${r.color};"></span>
                            <span>${escapeHtml(r.name)}</span>
                        </div>
                        <div class="role-radio-desc">${escapeHtml(r.desc)}</div>
                    </button>
                `).join('')}
            </div>

            <div class="form-grid-2">
                <div class="form-group">
                    <label for="ug-assign-station">2. Assigned Research Station</label>
                    <select id="ug-assign-station" class="form-control">
                        <option value="lares" ${currentStation === 'lares' ? 'selected' : ''}>DA-LARES (Lipa City)</option>
                        <option value="qares" ${currentStation === 'qares' ? 'selected' : ''}>DA-QARES (Tiaong)</option>
                        <option value="rares" ${currentStation === 'rares' ? 'selected' : ''}>DA-RARES (Tanay)</option>
                        <option value="cares" ${currentStation === 'cares' ? 'selected' : ''}>DA-CARES (Naic)</option>
                    </select>
                    <div class="help-tip" id="ug-station-hint">GIS Editors & Reviewers are strictly locked to this station.</div>
                </div>
                <div class="form-group">
                    <label for="ug-assign-position">3. Position / Designation</label>
                    <input type="text" id="ug-assign-position" class="form-control" value="${escapeHtml(u.job_title || '')}" placeholder="e.g. Computer Programmer I">
                </div>
            </div>
            <div class="form-group">
                <label for="ug-assign-office">4. Division & Office / Section</label>
                <input type="text" id="ug-assign-office" class="form-control" value="${escapeHtml(u.office_name || '')}">
            </div>
            <div class="form-group">
                <label for="ug-assign-resp">5. Assigned Responsibilities / Scope Notes</label>
                <textarea id="ug-assign-resp" class="form-control" rows="2">${escapeHtml(u.responsibilities || '')}</textarea>
            </div>
        `,
        footerHtml: `
            <button type="button" class="btn btn-secondary" onclick="closeGovModal()">Cancel</button>
            <button type="button" class="btn btn-emerald" id="ug-confirm-approve-btn">${mode === 'approve' ? 'Approve & Send Gmail Link' : 'Save Role & Access'}</button>
        `
    });

    const syncStationLock = () => {
        const stEl = document.getElementById('ug-assign-station');
        const hintEl = document.getElementById('ug-station-hint');
        const isAll = selectedRole === 'administrator' || selectedRole === 'super_admin';
        if (stEl) stEl.disabled = isAll;
        if (hintEl) hintEl.textContent = isAll ? 'Administrators have access to All Research Stations.' : 'GIS Editors & Reviewers are strictly locked to this station.';
    };
    syncStationLock();

    document.querySelectorAll('#ug-role-cards [data-pick-role]').forEach(card => {
        card.addEventListener('click', () => {
            selectedRole = card.dataset.pickRole;
            document.querySelectorAll('#ug-role-cards [data-pick-role]').forEach(c => c.classList.toggle('selected', c.dataset.pickRole === selectedRole));
            syncStationLock();
        });
    });

    document.getElementById('ug-confirm-approve-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
            const stationScope = (selectedRole === 'administrator' || selectedRole === 'super_admin')
                ? 'all'
                : document.getElementById('ug-assign-station').value;
            const payload = {
                role_slug: selectedRole,
                station_scope: stationScope,
                job_title: document.getElementById('ug-assign-position').value.trim(),
                office_name: document.getElementById('ug-assign-office').value.trim(),
                responsibilities: document.getElementById('ug-assign-resp').value.trim()
            };
            if (mode === 'approve') {
                await apiFetch(`/api/admin/users/${u.id}/approve`, { method: 'POST', body: JSON.stringify(payload) });
                showToast(`Approved ${u.email} as ${selectedRole} & sent /login Gmail alert!`);
            } else {
                await apiFetch(`/api/admin/users/${u.id}`, { method: 'PUT', body: JSON.stringify(payload) });
                showToast(`Updated role/station assignment for ${u.email}!`);
            }
            closeGovModal();
            if (currentUsersContainerRef) await renderUserAccountsTab(currentUsersContainerRef, 'approved');
        } catch (err) {
            showToast(err.message);
            btn.disabled = false;
        }
    });
};

window.openUserDenyModal = (userId) => {
    const u = cachedUsersList.find(x => x.id === userId);
    if (!u) return;
    openGovModal({
        title: `Deny Sign-Up Request — ${u.full_name || u.email}`,
        maxWidth: '520px',
        bodyHtml: `
            <p class="help-tip" style="font-size:12.5px; color:#cbd5e1; margin-bottom:12px;">
                Marking <strong>${escapeHtml(u.email)}</strong> as <strong>Not Approved</strong> prevents sign-in and sends a polite email notification.
            </p>
            <div class="form-group">
                <label for="ug-deny-reason">Reason / Administrative Note</label>
                <textarea id="ug-deny-reason" class="form-control" rows="3" placeholder="e.g. Account not recognized under station personnel roster."></textarea>
            </div>
        `,
        footerHtml: `
            <button type="button" class="btn btn-secondary" onclick="closeGovModal()">Cancel</button>
            <button type="button" class="btn btn-danger" id="ug-confirm-deny-btn">Confirm Not Approved</button>
        `
    });
    document.getElementById('ug-confirm-deny-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
            const reason = document.getElementById('ug-deny-reason').value.trim() || 'Registration declined by Administrator.';
            await apiFetch(`/api/admin/users/${u.id}/deny`, { method: 'POST', body: JSON.stringify({ reason }) });
            closeGovModal();
            showToast(`Marked ${u.email} as Not Approved.`);
            if (currentUsersContainerRef) await renderUserAccountsTab(currentUsersContainerRef, 'not_approved');
        } catch (err) {
            showToast(err.message);
            btn.disabled = false;
        }
    });
};

window.toggleUserActive = async (userId, nextActive) => {
    const u = cachedUsersList.find(x => x.id === userId);
    if (!u) return;
    const ok = await showPortalConfirm({
        title: nextActive ? 'Re-enable Portal Access?' : 'Disable Portal Access?',
        message: `${nextActive ? 'Re-enable' : 'Disable'} portal access for ${u.full_name || u.email} (${u.email})?`,
        confirmLabel: nextActive ? 'Re-enable User' : 'Disable User',
        cancelLabel: 'Cancel',
        danger: !nextActive
    });
    if (!ok) return;
    try {
        await apiFetch(`/api/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify({ is_active: nextActive }) });
        showToast(`${u.email} ${nextActive ? 're-enabled' : 'disabled'}.`);
        if (currentUsersContainerRef) await renderUserAccountsTab(currentUsersContainerRef, nextActive ? 'approved' : 'disabled');
    } catch (err) {
        showToast(err.message);
    }
};
