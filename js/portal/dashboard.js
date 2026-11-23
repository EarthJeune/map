/**
 * Role-Specific Home Screens, Modernized Actionable KPIs, Station Overview & Audit Trail
 */

import {
    PortalState,
    SVG_ICONS,
    apiFetch,
    showToast,
    broadcastDbSync,
    escapeHtml,
    hasPermission,
    animateCounters,
    showPortalConfirm,
    getSavedPortalPref,
    setSavedPortalPref
} from './core.js';
import { formatHumanRequestTitle, parseReviewerFeedback } from './diff-utils.js';

let auditSearch = '';
let auditShowTest = false;
let auditLimit = Number(getSavedPortalPref('iguide_pref_audit_limit', 10)) || 10;

function renderStationStatusPillHtml(status) {
    return status === 'live'
        ? `<span class="status-pill status-pill-live"><span class="status-dot-live"></span><span>Live on Public Map</span></span>`
        : `<span class="status-pill status-pill-dev"><span class="status-dot-dev"></span><span>Under Development</span></span>`;
}

function formatWaitDuration(ts) {
    const dt = new Date(ts);
    if (isNaN(dt.getTime())) return '';
    const mins = Math.max(1, Math.floor((Date.now() - dt.getTime()) / 60000));
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

function renderModernKpiCard({ label, value, sub, icon, tone = '', targetTab = '', progressPct = null }) {
    const clickable = Boolean(targetTab);
    const toneClass = (tone && Number(value) > 0) ? `kpi-tone-${tone}` : '';
    const tag = clickable ? 'button' : 'div';
    const clickAttr = clickable ? `type="button" onclick="switchTab('${escapeHtml(targetTab)}')"` : '';
    const pct = Number.isFinite(progressPct) ? Math.max(0, Math.min(100, Math.round(progressPct))) : null;
    return `
        <${tag} class="kpi-card-modern ${clickable ? 'is-clickable' : ''} ${toneClass}" ${clickAttr}>
            <div class="kpi-card-head">
                <span class="kpi-card-label">${escapeHtml(label)}</span>
                <span class="kpi-card-icon">${SVG_ICONS[icon] || SVG_ICONS.dashboard}</span>
            </div>
            <div class="kpi-card-value" data-count-to="${Number(value || 0)}">${Number(value || 0)}</div>
            <div class="kpi-card-sub">${escapeHtml(sub)}</div>
            ${pct !== null ? `<div class="kpi-progress-track" aria-label="${pct}% coverage"><div class="kpi-progress-fill" style="width:${pct}%;"></div></div>` : ''}
        </${tag}>
    `;
}

function buildPageNumbers(page, totalPages) {
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

function renderAuditRowsHtml(items) {
    if (!items || items.length === 0) {
        return `<tr><td colspan="5" style="text-align:center; color:var(--text-muted-aa); padding:24px;">No activity matching your filter yet.</td></tr>`;
    }
    return items.map(log => {
        const displayName = log.actor_display_name || log.admin_username || 'System';
        const roleBadge = log.acting_label
            ? `<span style="font-size:11px; color:var(--text-muted-aa); display:block; margin-top:2px;">${escapeHtml(log.acting_label)}</span>`
            : '';
        return `
        <tr>
            <td><span class="mono-id">#${log.id}</span></td>
            <td style="color:var(--text-muted-aa); font-size:12px;">${new Date(log.created_at).toLocaleString()}</td>
            <td>
                <strong style="font-size:13px;">${escapeHtml(displayName)}</strong>
                ${roleBadge}
            </td>
            <td><span class="status-pill status-pill-blue">${escapeHtml(log.action)}</span></td>
            <td>${escapeHtml(log.summary || '')}</td>
        </tr>
    `;
    }).join('');
}

function renderAuditPaginationHtml({ total, page, limit, totalPages }) {
    const startIdx = total === 0 ? 0 : ((page - 1) * limit) + 1;
    const endIdx = Math.min(total, page * limit);
    const nums = buildPageNumbers(page, totalPages);
    return `
        <div class="log-pagination-info">Showing <strong>${startIdx}–${endIdx}</strong> of <strong>${total}</strong> entries</div>
        <div class="log-pagination-controls">
            <select id="dash-audit-limit" class="form-control log-page-size-select" aria-label="Rows per page">
                ${[10, 20, 50].map(sz => `<option value="${sz}" ${limit === sz ? 'selected' : ''}>${sz} / page</option>`).join('')}
            </select>
            <button type="button" class="log-page-btn" data-audit-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
            ${nums.map(n => n === '...'
                ? `<span class="log-page-ellipsis">…</span>`
                : `<button type="button" class="log-page-btn ${n === page ? 'active' : ''}" data-audit-page="${n}">${n}</button>`
            ).join('')}
            <button type="button" class="log-page-btn" data-audit-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next →</button>
        </div>
    `;
}

export async function renderDashboardTab(container) {
    const role = PortalState.effectiveRole || 'super_admin';
    const isSuperAdmin = role === 'super_admin';
    const canViewAudit = hasPermission('audit:view');
    const canSyncAssets = hasPermission('system:reconcile_assets');

    const [data, requestsRaw] = await Promise.all([
        apiFetch(`/api/admin/dashboard?station=${PortalState.currentStation}`),
        hasPermission('reviews:view')
            ? apiFetch(`/api/admin/change-requests?station=${PortalState.currentStation}`).catch(() => [])
            : Promise.resolve([])
    ]);

    const requests = Array.isArray(requestsRaw) ? requestsRaw : [];
    PortalState.cachedStations = data.stations || [];
    const c = data.counts || {};
    const gov = data.governance || {};
    const activeSt = PortalState.cachedStations.find(s => s.station_id === PortalState.currentStation) || {
        name: `DA-${PortalState.currentStation.toUpperCase()}`,
        province: 'CALABARZON',
        status: 'under_development'
    };

    const drafts = requests.filter(r => r.status === 'draft');
    const pendingRevs = requests.filter(r => r.status === 'pending');
    const needsRev = requests.filter(r => r.status === 'rejected');
    const readyPub = requests.filter(r => r.status === 'approved');
    const recentlyPublished = requests.filter(r => r.status === 'published').slice(0, 5);

    const bldgCount = Number(c.buildings || 0);
    const glbCount = Number(c.customGlbCount || 0);
    const modelPct = bldgCount > 0 ? Math.min(100, Math.round((glbCount / bldgCount) * 100)) : 0;

    let currentAuditPage = Number(data.auditPage || 1);
    let currentAuditTotal = Number(data.auditTotal ?? (data.auditLogs || []).length);
    let currentAuditTotalPages = Number(data.auditTotalPages || 1);

    // Build Role-Specific Home Sections (3.1)
    let roleHomeHtml = '';

    if (role === 'gis_editor') {
        roleHomeHtml = `
            <div class="kpi-grid-modern">
                ${renderModernKpiCard({ label: 'Needs your revision', value: needsRev.length, sub: needsRev.length ? 'Returned by Reviewer' : 'All caught up', icon: 'alertTriangle', tone: 'rose', targetTab: 'admin-reviews' })}
                ${renderModernKpiCard({ label: 'Saved drafts', value: drafts.length, sub: drafts.length ? 'Ready to submit together' : 'No unsaved drafts', icon: 'edit', tone: 'sky', targetTab: 'admin-reviews' })}
                ${renderModernKpiCard({ label: 'Waiting for review', value: pendingRevs.length, sub: pendingRevs.length ? 'With Station Reviewer' : 'Nothing pending', icon: 'clock', tone: 'amber', targetTab: 'admin-reviews' })}
                ${renderModernKpiCard({ label: 'Buildings with 3D models', value: glbCount, sub: `${glbCount} of ${bldgCount} buildings (${modelPct}%)`, icon: 'building', targetTab: 'buildings', progressPct: modelPct })}
            </div>

            <div class="role-home-section">
                <div class="role-home-section-head">
                    <h3 class="role-home-section-title">Quick Actions</h3>
                    <div class="quick-actions-row">
                        <button type="button" class="btn btn-emerald btn-sm" onclick="switchTab('buildings')">${SVG_ICONS.plus} <span>Add building</span></button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('buildings')">${SVG_ICONS.image} <span>Add photo</span></button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('plots')">${SVG_ICONS.sprout} <span>Update plot</span></button>
                    </div>
                </div>
            </div>

            <div class="role-home-section">
                <div class="role-home-section-head">
                    <h3 class="role-home-section-title">Needs your revision (${needsRev.length})</h3>
                    ${needsRev.length > 0 ? `<button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('admin-reviews')">Open Revision Queue →</button>` : ''}
                </div>
                ${needsRev.length === 0
                    ? `<div class="portal-empty-state">Nothing needs revision right now.</div>`
                    : `<div class="home-queue-list">
                        ${needsRev.slice(0, 5).map(r => {
                            const fb = parseReviewerFeedback(r.reviewer_comment || '');
                            return `
                            <div class="home-queue-item" style="border-left:3px solid #f43f5e;">
                                <div style="flex:1; min-width:220px;">
                                    <div style="font-weight:700; font-size:14px;">${escapeHtml(formatHumanRequestTitle(r))}</div>
                                    ${fb.items.length > 0 ? `<ul style="margin:6px 0 0 18px; padding:0; font-size:12.5px; color:#fda4af;">${fb.items.map(it => `<li>${escapeHtml(it)}</li>`).join('')}</ul>` : ''}
                                    ${fb.note ? `<div style="font-size:12.5px; color:#fda4af; margin-top:4px;">${escapeHtml(fb.note)}</div>` : ''}
                                </div>
                                <button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('admin-reviews')">Revise Request</button>
                            </div>`;
                        }).join('')}
                    </div>`}
            </div>

            ${drafts.length > 0 ? `
            <div class="role-home-section">
                <div class="role-home-section-head">
                    <h3 class="role-home-section-title">Drafts (${drafts.length})</h3>
                </div>
                <div class="home-queue-list">
                    ${drafts.slice(0, 5).map(r => `
                        <div class="home-queue-item">
                            <div>
                                <div style="font-weight:700; font-size:14px;">${escapeHtml(formatHumanRequestTitle(r))}</div>
                                <div class="help-tip">Saved ${formatWaitDuration(r.updated_at || r.created_at)}</div>
                            </div>
                            <button type="button" class="btn btn-emerald btn-sm" onclick="switchTab('admin-reviews')">Review & Submit</button>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}
        `;
    } else if (role === 'reviewer') {
        roleHomeHtml = `
            <div class="kpi-grid-modern">
                ${renderModernKpiCard({ label: 'Awaiting your review', value: pendingRevs.length, sub: pendingRevs.length ? 'Needs approval or feedback' : 'Nothing waiting for your review', icon: 'clock', tone: 'amber', targetTab: 'review-queue' })}
                ${renderModernKpiCard({ label: 'Approved & ready to publish', value: readyPub.length, sub: 'Forwarded to Administrator', icon: 'checkSquare', tone: 'emerald', targetTab: 'review-queue' })}
                ${renderModernKpiCard({ label: 'Returned for revision', value: needsRev.length, sub: 'Waiting on GIS Editor', icon: 'alertTriangle', tone: 'rose', targetTab: 'review-queue' })}
                ${renderModernKpiCard({ label: 'Station Buildings', value: bldgCount, sub: `${c.images || 0} photos • ${c.offices || 0} offices`, icon: 'building', targetTab: 'review-buildings' })}
            </div>

            <div class="role-home-section">
                <div class="role-home-section-head">
                    <h3 class="role-home-section-title">Awaiting your review (${pendingRevs.length})</h3>
                    <button type="button" class="btn btn-emerald btn-sm" onclick="switchTab('review-queue')">Open Review Queue →</button>
                </div>
                ${pendingRevs.length === 0
                    ? `<div class="portal-empty-state">Nothing waiting for your review.</div>`
                    : `<div class="home-queue-list">
                        ${pendingRevs.slice(0, 8).map(r => `
                            <div class="home-queue-item">
                                <div style="flex:1; min-width:220px;">
                                    <div style="font-weight:700; font-size:14px;">${escapeHtml(formatHumanRequestTitle(r))}</div>
                                    <div class="help-tip" style="margin-top:4px;">
                                        Submitted by <strong>${escapeHtml(r.submitted_by_name || 'GIS Editor')}</strong> • Waiting ${formatWaitDuration(r.created_at)}
                                    </div>
                                </div>
                                <button type="button" class="btn btn-emerald btn-sm" onclick="switchTab('review-queue')">Review →</button>
                            </div>
                        `).join('')}
                    </div>`}
            </div>
        `;
    } else if (role === 'administrator') {
        roleHomeHtml = `
            <div class="kpi-grid-modern">
                ${renderModernKpiCard({ label: 'Ready to publish', value: gov.readyToPublish || 0, sub: (gov.readyToPublish || 0) ? 'Approved by Reviewer' : 'Nothing ready to publish', icon: 'checkSquare', tone: 'emerald', targetTab: 'admin-reviews' })}
                ${renderModernKpiCard({ label: 'Sign-ups waiting', value: gov.pendingSignups || 0, sub: (gov.pendingSignups || 0) ? 'Pending account approval' : 'All caught up', icon: 'users', tone: 'amber', targetTab: 'admin-reviewers' })}
                ${renderModernKpiCard({ label: 'Awaiting review', value: gov.pendingReviews || 0, sub: 'Currently with Reviewer', icon: 'clock', tone: 'sky', targetTab: 'admin-reviews' })}
                ${renderModernKpiCard({ label: 'Buildings with 3D models', value: glbCount, sub: `${glbCount} of ${bldgCount} buildings (${modelPct}%)`, icon: 'building', targetTab: 'review-buildings', progressPct: modelPct })}
            </div>

            <div class="role-home-section">
                <div class="role-home-section-head">
                    <h3 class="role-home-section-title">Ready to publish (${readyPub.length})</h3>
                    <div class="quick-actions-row">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('review-buildings')">Recommend facility updates</button>
                        <button type="button" class="btn btn-emerald btn-sm" onclick="switchTab('admin-reviews')">Open Publish Queue →</button>
                    </div>
                </div>
                ${readyPub.length === 0
                    ? `<div class="portal-empty-state">Nothing ready to publish right now.</div>`
                    : `<div class="home-queue-list">
                        ${readyPub.slice(0, 6).map(r => `
                            <div class="home-queue-item" style="border-left:3px solid #10b981;">
                                <div>
                                    <div style="font-weight:700; font-size:14px;">${escapeHtml(formatHumanRequestTitle(r))}</div>
                                    <div class="help-tip">Submitted by ${escapeHtml(r.submitted_by_name || 'Editor')} • Approved ${formatWaitDuration(r.reviewed_at || r.created_at)}</div>
                                </div>
                                <button type="button" class="btn btn-emerald btn-sm" onclick="switchTab('admin-reviews')">Inspect & Publish</button>
                            </div>
                        `).join('')}
                    </div>`}
            </div>

            ${recentlyPublished.length > 0 ? `
            <div class="role-home-section">
                <div class="role-home-section-head">
                    <h3 class="role-home-section-title">Recently published</h3>
                </div>
                <div class="home-queue-list">
                    ${recentlyPublished.map(r => `
                        <div class="home-queue-item">
                            <div>
                                <div style="font-weight:600; font-size:14px;">${escapeHtml(formatHumanRequestTitle(r))}</div>
                                <div class="help-tip">Published ${formatWaitDuration(r.published_at || r.updated_at)}</div>
                            </div>
                            ${r.can_undo_publish
                                ? `<button type="button" class="btn btn-danger btn-sm" data-dash-undo-cr="${r.id}">Undo publish</button>`
                                : `<span class="status-pill status-pill-live">Published</span>`}
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}
        `;
    } else {
        // Super Admin Home: Complete System Overview + Actionable KPIs
        roleHomeHtml = `
            <div class="kpi-grid-modern">
                ${renderModernKpiCard({ label: 'Sign-ups waiting', value: gov.pendingSignups || 0, sub: (gov.pendingSignups || 0) ? 'Pending account approval' : 'All caught up', icon: 'users', tone: 'amber', targetTab: 'admin-reviewers' })}
                ${renderModernKpiCard({ label: 'Awaiting review', value: gov.pendingReviews || 0, sub: (gov.pendingReviews || 0) ? 'Waiting on Station Reviewer' : 'Nothing waiting for review', icon: 'clock', tone: 'sky', targetTab: 'admin-reviews' })}
                ${renderModernKpiCard({ label: 'Ready to publish', value: gov.readyToPublish || 0, sub: (gov.readyToPublish || 0) ? 'Approved and ready to go live' : 'Nothing ready to publish', icon: 'checkSquare', tone: 'emerald', targetTab: 'admin-reviews' })}
                ${renderModernKpiCard({ label: 'Buildings', value: bldgCount, sub: `${glbCount} of ${bldgCount} with 3D models (${modelPct}%)`, icon: 'building', targetTab: 'buildings', progressPct: modelPct })}
                ${renderModernKpiCard({ label: 'Photos', value: c.images || 0, sub: `${c.diskWebpCount ?? 0} image files available`, icon: 'image', targetTab: 'buildings' })}
                ${renderModernKpiCard({ label: 'Internal Offices', value: c.offices || 0, sub: 'Listed inside station buildings', icon: 'folder', targetTab: 'offices' })}
                ${renderModernKpiCard({ label: 'Agricultural Plots', value: c.plots || 0, sub: PortalState.currentStation === 'lares' ? `${c.plots || 23} planted zones • ${c.totalPhysicalPlots || 45} total plots` : `${c.subplots || 0} screenhouse sub-plots`, icon: 'sprout', targetTab: 'plots' })}
                ${renderModernKpiCard({ label: 'Walkways & Entrances', value: c.entrances || 0, sub: `${c.roads || 0} walkway points • ${glbCount} 3D models`, icon: 'route', targetTab: 'editor-road' })}
            </div>
        `;
    }

    container.innerHTML = `
        <div class="panel-card dash-station-hero-card" style="display:flex; align-items:center; justify-content:space-between; gap:20px; padding:20px 24px; margin-bottom:20px;">
            <div>
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:4px; flex-wrap:wrap;">
                    <h2 style="font-size:20px; font-weight:700; margin:0;">${escapeHtml(activeSt.name)}</h2>
                    <span id="dash-active-status-pill">${renderStationStatusPillHtml(activeSt.status)}</span>
                </div>
                <div style="font-size:13px; color:var(--text-muted-aa);">${escapeHtml(activeSt.subtitle || '')} ${activeSt.province ? '• ' + escapeHtml(activeSt.province) : ''}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                ${canSyncAssets ? `<button type="button" id="dash-sync-assets-btn" class="btn btn-secondary btn-sm" title="Scan disk images and 3D models and link new files in the database">${SVG_ICONS.image} <span>Sync Media Files</span></button>` : ''}
            </div>
        </div>

        ${roleHomeHtml}

        ${isSuperAdmin ? `
        <div class="panel-card">
            <div class="panel-header">
                <div class="panel-title-group">
                    <div class="panel-title-icon">${SVG_ICONS.landmark}</div>
                    <div>
                        <h3>CALABARZON Research Stations</h3>
                        <div class="help-tip">Switch a station between Live on Public Map and Under Development.</div>
                    </div>
                </div>
            </div>
            <div class="table-scroll-wrap">
            <table class="crud-table">
                <thead>
                    <tr>
                        <th>Station</th>
                        <th>Province</th>
                        <th>Public Visibility</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${(data.stations || []).map(st => {
                        const isLive = st.status === 'live';
                        return `
                        <tr>
                            <td>
                                <div style="font-weight:700;">${escapeHtml(st.name)}</div>
                                <div class="help-tip">${escapeHtml(st.full_name || '')}</div>
                            </td>
                            <td>${escapeHtml(st.province || '')}</td>
                            <td>
                                <div class="station-status-segment" data-status-group="${escapeHtml(st.station_id)}" role="group" aria-label="Visibility for ${escapeHtml(st.name)}">
                                    <button type="button" class="station-status-opt is-live ${isLive ? 'is-active' : ''}" data-station-status-btn data-station-id="${escapeHtml(st.station_id)}" data-target-status="live" aria-pressed="${isLive ? 'true' : 'false'}">Live on Public Map</button>
                                    <button type="button" class="station-status-opt is-dev ${!isLive ? 'is-active' : ''}" data-station-status-btn data-station-id="${escapeHtml(st.station_id)}" data-target-status="under_development" aria-pressed="${!isLive ? 'true' : 'false'}">Under Development</button>
                                </div>
                            </td>
                            <td>
                                <button type="button" class="btn btn-secondary btn-sm" onclick="onChangeStation('${escapeHtml(st.station_id)}'); switchTab('pin');">${SVG_ICONS.pin} <span>Open Station</span></button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            </div>
        </div>
        ` : ''}

        ${canViewAudit ? `
        <div class="panel-card">
            <div class="panel-header">
                <div class="panel-title-group">
                    <div class="panel-title-icon">${SVG_ICONS.history}</div>
                    <div>
                        <h3>Recent Activity & Audit Trail</h3>
                        <div class="help-tip">${isSuperAdmin
                            ? 'Full audit trail across all roles and stations.'
                            : 'Showing station activity for editors, reviewers, and administrators.'}</div>
                    </div>
                </div>
                <div class="dash-audit-search-wrap" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <label style="display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--text-secondary-aa); cursor:pointer; user-select:none;">
                        <input type="checkbox" id="dash-audit-show-test" ${auditShowTest ? 'checked' : ''} style="accent-color:#10b981;">
                        <span>Show test data</span>
                    </label>
                    <input type="text" id="dash-audit-search" class="form-control" style="width:240px; max-width:100%; height:36px;" placeholder="Filter actor, action, or summary..." value="${escapeHtml(auditSearch)}">
                </div>
            </div>
            <div class="table-scroll-wrap">
            <table class="crud-table">
                <thead>
                    <tr><th>ID</th><th>Timestamp</th><th>Actor</th><th>Action</th><th>Summary</th></tr>
                </thead>
                <tbody id="dash-audit-tbody">${renderAuditRowsHtml(data.auditLogs || [])}</tbody>
            </table>
            </div>
            <div id="dash-audit-pagination" class="log-pagination-bar">${renderAuditPaginationHtml({
                total: currentAuditTotal,
                page: currentAuditPage,
                limit: Number(data.auditLimit || auditLimit),
                totalPages: currentAuditTotalPages
            })}</div>
        </div>
        ` : ''}
    `;

    animateCounters(container);

    // Wire Administrator 24h Undo Publish buttons on home screen
    container.querySelectorAll('[data-dash-undo-cr]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const crId = Number(btn.dataset.dashUndoCr);
            const ok = await showPortalConfirm({
                title: `Undo Published Request #${crId}?`,
                message: 'Revert this published change back to its pre-publish snapshot?',
                confirmLabel: 'Undo Publish',
                cancelLabel: 'Cancel',
                danger: true
            });
            if (!ok) return;
            try {
                await apiFetch(`/api/admin/change-requests/${crId}/undo-publish`, { method: 'POST', body: '{}' });
                broadcastDbSync();
                showToast(`Undid publish of Request #${crId}.`);
                await renderDashboardTab(container);
            } catch (err) {
                showToast(err.message || 'Could not undo publish.');
            }
        });
    });

    const bindAuditPaginationEvents = () => {
        container.querySelectorAll('[data-audit-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const nextP = Number(btn.dataset.auditPage);
                if (!btn.disabled && nextP >= 1) loadAuditLogsPage(nextP);
            });
        });
        document.getElementById('dash-audit-limit')?.addEventListener('change', (e) => {
            auditLimit = Number(e.target.value) || 10;
            setSavedPortalPref('iguide_pref_audit_limit', auditLimit);
            loadAuditLogsPage(1);
        });
    };

    const loadAuditLogsPage = async (page = 1) => {
        const tbody = document.getElementById('dash-audit-tbody');
        const pager = document.getElementById('dash-audit-pagination');
        if (!tbody || !pager) return;
        try {
            const res = await apiFetch(`/api/admin/audit-logs?page=${page}&limit=${auditLimit}&search=${encodeURIComponent(auditSearch.trim())}${auditShowTest ? '&includeTest=1' : ''}`);
            currentAuditPage = Number(res.page || 1);
            currentAuditTotal = Number(res.total || 0);
            currentAuditTotalPages = Number(res.totalPages || 1);
            tbody.innerHTML = renderAuditRowsHtml(res.items || []);
            pager.innerHTML = renderAuditPaginationHtml({
                total: currentAuditTotal,
                page: currentAuditPage,
                limit: Number(res.limit || auditLimit),
                totalPages: currentAuditTotalPages
            });
            bindAuditPaginationEvents();
        } catch (err) {
            showToast(err.message || 'Could not load audit logs');
        }
    };

    if (canViewAudit) {
        bindAuditPaginationEvents();
        let auditSearchTimer = null;
        document.getElementById('dash-audit-search')?.addEventListener('input', (e) => {
            auditSearch = e.target.value;
            clearTimeout(auditSearchTimer);
            auditSearchTimer = setTimeout(() => loadAuditLogsPage(1), 250);
        });
        document.getElementById('dash-audit-show-test')?.addEventListener('change', (e) => {
            auditShowTest = Boolean(e.target.checked);
            loadAuditLogsPage(1);
        });
        if (auditSearch.trim() || auditLimit !== 10 || auditShowTest) {
            loadAuditLogsPage(1);
        }
    }

    if (isSuperAdmin) {
        container.querySelectorAll('[data-station-status-btn]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const stationId = btn.dataset.stationId;
                const targetStatus = btn.dataset.targetStatus;
                const st = (PortalState.cachedStations || []).find(s => s.station_id === stationId);
                if (!st) return;
                const curStatus = st.status === 'live' ? 'live' : 'under_development';
                if (curStatus === targetStatus) return;

                const label = targetStatus === 'live' ? 'Live on Public Map' : 'Under Development';
                const ok = await showPortalConfirm({
                    title: `Switch ${st.name} Status?`,
                    message: `Switch ${st.name} to "${label}" on the public campus map?`,
                    confirmLabel: `Switch to ${targetStatus === 'live' ? 'Live' : 'Under Dev'}`,
                    cancelLabel: 'Cancel',
                    danger: targetStatus !== 'live'
                });
                if (!ok) return;

                const groupEl = container.querySelector(`[data-status-group="${stationId}"]`);
                const btns = groupEl ? Array.from(groupEl.querySelectorAll('button')) : [btn];
                btns.forEach(b => { b.disabled = true; });
                try {
                    const res = await apiFetch(`/api/admin/stations/${stationId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ status: targetStatus })
                    });
                    st.status = (res.station && res.station.status) || targetStatus;
                    const nowLive = st.status === 'live';
                    btns.forEach(b => {
                        const isLiveBtn = b.dataset.targetStatus === 'live';
                        const active = isLiveBtn ? nowLive : !nowLive;
                        b.classList.toggle('is-active', active);
                        b.setAttribute('aria-pressed', active ? 'true' : 'false');
                    });
                    if (stationId === PortalState.currentStation) {
                        const topPill = document.getElementById('dash-active-status-pill');
                        if (topPill) topPill.innerHTML = renderStationStatusPillHtml(st.status);
                    }
                    broadcastDbSync();
                    showToast(`${st.name} set to ${label}.`);
                    if (canViewAudit) await loadAuditLogsPage(1);
                } catch (err) {
                    showToast(err.message || 'Could not update station visibility');
                } finally {
                    btns.forEach(b => { b.disabled = false; });
                }
            });
        });

        document.getElementById('dash-sync-assets-btn')?.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true;
            try {
                const res = await apiFetch('/api/admin/reconcile-assets', { method: 'POST', body: '{}' });
                broadcastDbSync();
                showToast(`Media sync complete: linked ${res.imagesAdded || 0} photos & ${res.modelsLinked || 0} 3D models.`);
                await renderDashboardTab(container);
            } catch (err) {
                showToast(err.message);
                btn.disabled = false;
            }
        });
    }
}
