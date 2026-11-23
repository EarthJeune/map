/**
 * Fact-Checked Multi-Station Dashboard, Reconciled Counts & Disk Asset Sync
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

let auditSearch = '';
let auditLimit = Number(getSavedPortalPref('iguide_pref_audit_limit', 10)) || 10;

function renderStationStatusPillHtml(status) {
    return status === 'live'
        ? `<span class="status-pill status-pill-live"><span class="status-dot-live"></span><span>Live on Public Map</span></span>`
        : `<span class="status-pill status-pill-dev"><span class="status-dot-dev"></span><span>Under Development</span></span>`;
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
        return `<tr><td colspan="5" style="text-align:center; color:#64748b; padding:24px;">No activity matching your view filter yet.</td></tr>`;
    }
    return items.map(log => `
        <tr>
            <td><span class="mono-id">#${log.id}</span></td>
            <td style="color:#94a3b8; font-size:12px;">${new Date(log.created_at).toLocaleString()}</td>
            <td><span class="mono-code">${escapeHtml(log.admin_username || 'system')}</span></td>
            <td><span class="status-pill status-pill-blue">${escapeHtml(log.action)}</span></td>
            <td style="color:#cbd5e1;">${escapeHtml(log.summary || '')}</td>
        </tr>
    `).join('');
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
    const data = await apiFetch(`/api/admin/dashboard?station=${PortalState.currentStation}`);
    PortalState.cachedStations = data.stations || [];
    const c = data.counts || {};
    const gov = data.governance || {};
    const needsRev = Array.isArray(data.needsRevisionItems) ? data.needsRevisionItems : [];
    const activeSt = PortalState.cachedStations.find(s => s.station_id === PortalState.currentStation) || {
        name: `DA-${PortalState.currentStation.toUpperCase()}`,
        province: 'CALABARZON',
        status: 'under_development'
    };
    const isSuperAdmin = PortalState.effectiveRole === 'super_admin';
    const canViewAudit = hasPermission('audit:view');
    const canSyncAssets = hasPermission('system:reconcile_assets');
    const canEditPin = hasPermission('station:edit_pin');
    const canDraftBuildings = hasPermission('buildings:draft_change');
    const photoDelta = Math.max(0, Number(c.diskWebpCount || 0) - Number(c.images || 0));

    let currentAuditPage = Number(data.auditPage || 1);
    let currentAuditTotal = Number(data.auditTotal ?? (data.auditLogs || []).length);
    let currentAuditTotalPages = Number(data.auditTotalPages || 1);

    container.innerHTML = `
        ${needsRev.length > 0 ? `
        <div class="alert-revision-card">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
                <div>
                    <strong style="color:#fda4af; font-size:13.5px; display:inline-flex; align-items:center; gap:6px;">${SVG_ICONS.alertTriangle} <span>${needsRev.length} Change Request(s) Returned by Station Reviewer (DA-${PortalState.currentStation.toUpperCase()})</span></strong>
                    <div class="help-tip" style="color:#fecdd3;">Review the comments below, update your payload, and resubmit to your Station Reviewer.</div>
                </div>
                <button class="btn btn-danger btn-sm" onclick="switchTab('admin-reviews')">Open Revision Queue →</button>
            </div>
            <div style="display:grid; gap:8px;">
                ${needsRev.slice(0, 4).map(r => `
                    <div style="padding:9px 12px; border-radius:9px; background:rgba(15,23,42,0.72); border:1px solid rgba(244,63,94,0.24); display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                        <div>
                            <span class="mono-id">#${r.id}</span>
                            <span class="mono-code">${escapeHtml(r.target_table)}</span>
                            <strong style="color:#fff; font-size:12.5px; margin-left:4px;">${escapeHtml(r.summary)}</strong>
                            <div style="font-size:12px; color:#fda4af; margin-top:4px;"><strong>Reviewer Feedback:</strong> "${escapeHtml(r.reviewer_comment || 'Changes requested.')}"</div>
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="switchTab('admin-reviews')">Revise Request</button>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <div class="panel-card dash-station-hero-card" style="display:flex; align-items:center; justify-content:space-between; gap:20px; padding:20px 24px; margin-bottom:20px; border-color:var(--role-accent-border);">
            <div>
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px; flex-wrap:wrap;">
                    <span class="dash-hero-kicker" style="font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--role-accent-light);">Fact-Checked Station Workspace</span>
                    <span id="dash-active-status-pill">${renderStationStatusPillHtml(activeSt.status)}</span>
                </div>
                <h2 style="font-size:20px; font-weight:700; color:#f8fafc; margin:0 0 4px;">${escapeHtml(activeSt.name)}</h2>
                <div style="font-size:12.5px; color:#94a3b8;">${escapeHtml(activeSt.subtitle || '')} ${activeSt.province ? '• ' + escapeHtml(activeSt.province) : ''}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                ${canEditPin
                    ? `<button class="btn btn-secondary btn-sm" onclick="switchTab('pin')">${SVG_ICONS.pin} <span>Pin & Station Settings</span></button>`
                    : (hasPermission('changes:publish')
                        ? `<button class="btn btn-secondary btn-sm" onclick="switchTab('admin-reviews')">${SVG_ICONS.checkSquare} <span>Change Requests & Publish</span></button>`
                        : '')}
                <button class="btn btn-secondary btn-sm" onclick="switchTab('${canDraftBuildings ? 'buildings' : 'review-buildings'}')">${SVG_ICONS.building} <span>Buildings Directory</span></button>
                ${canSyncAssets ? `<button type="button" id="dash-sync-assets-btn" class="btn btn-blue btn-sm" title="Scan /images/*.webp and /models/*.glb on disk and link any new files to matching buildings in MySQL">${SVG_ICONS.image} <span>Sync Assets</span></button>` : ''}
                <a class="btn btn-emerald btn-sm" href="/?station=${encodeURIComponent(PortalState.currentStation)}" target="_blank">Open Public Map ↗</a>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-card-top">
                    <div class="stat-label">Buildings (${PortalState.currentStation.toUpperCase()})</div>
                    <div class="stat-icon-badge">${SVG_ICONS.building}</div>
                </div>
                <div class="stat-value" data-count-to="${c.buildings || 0}">0</div>
                <span class="stat-table-pill">
                    ${Number(c.buildings || 0) !== Number(c.groupedFacilities || 0)
                        ? `${c.buildings} parts • ${c.groupedFacilities} grouped`
                        : `${c.numberedBuildings ?? 0} numbered + ${c.utilityFacilities ?? 0} utilities`}
                </span>
            </div>

            <div class="stat-card">
                <div class="stat-card-top">
                    <div class="stat-label">Facility WebP Photos</div>
                    <div class="stat-icon-badge">${SVG_ICONS.image}</div>
                </div>
                <div class="stat-value" data-count-to="${c.images || 0}">0</div>
                <span class="stat-table-pill">${c.diskWebpCount ?? 0} on disk ${photoDelta > 0 ? `(+${photoDelta} unseeded)` : ''}</span>
            </div>

            <div class="stat-card">
                <div class="stat-card-top">
                    <div class="stat-label">Internal Offices</div>
                    <div class="stat-icon-badge">${SVG_ICONS.folder}</div>
                </div>
                <div class="stat-value" data-count-to="${c.offices || 0}">0</div>
                <span class="stat-table-pill">Verified unit assignments</span>
            </div>

            <div class="stat-card">
                <div class="stat-card-top">
                    <div class="stat-label">Agricultural Plots</div>
                    <div class="stat-icon-badge">${SVG_ICONS.sprout}</div>
                </div>
                <div class="stat-value" data-count-to="${c.plots || 0}">0</div>
                <span class="stat-table-pill">${PortalState.currentStation === 'lares'
                    ? `${c.plots || 23} planted zones • ${c.totalPhysicalPlots || 45} total plots • ${c.subplots || 0} sub-plots`
                    : `${c.subplots || 0} screenhouse sub-plots`}</span>
            </div>

            <div class="stat-card">
                <div class="stat-card-top">
                    <div class="stat-label">Road & Entrances</div>
                    <div class="stat-icon-badge">${SVG_ICONS.route}</div>
                </div>
                <div class="stat-value" data-count-to="${c.entrances || 0}">0</div>
                <span class="stat-table-pill">${c.roads || 0} road nodes • ${c.customGlbCount || 0} GLB models</span>
            </div>

            <div class="stat-card">
                <div class="stat-card-top">
                    <div class="stat-label">Governance Queue</div>
                    <div class="stat-icon-badge">${SVG_ICONS.checkSquare}</div>
                </div>
                <div class="stat-value" data-count-to="${(gov.pendingReviews || 0) + (gov.readyToPublish || 0) + (gov.pendingSignups || 0)}">0</div>
                <span class="stat-table-pill">${gov.pendingSignups || 0} sign-ups • ${gov.pendingReviews || 0} reviews • ${gov.readyToPublish || 0} publish</span>
            </div>
        </div>

        ${isSuperAdmin ? `
        <div class="panel-card">
            <div class="panel-header">
                <div class="panel-title-group">
                    <div class="panel-title-icon">${SVG_ICONS.landmark}</div>
                    <div>
                        <h3>All 4 DA-CALABARZON Research Stations</h3>
                        <div class="help-tip">Switch any station directly between Live on Public Map and Under Development, or inspect its kiosk pin & settings.</div>
                    </div>
                </div>
            </div>
            <div class="table-scroll-wrap">
            <table class="crud-table">
                <thead>
                    <tr>
                        <th>Station</th>
                        <th>Province</th>
                        <th>"You Are Here" Kiosk Pin</th>
                        <th>Offline Drone MBTiles</th>
                        <th>Public Map Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${PortalState.cachedStations.map(st => {
                        const coordStr = `[${Number(st.kiosk_pin_lng).toFixed(6)}, ${Number(st.kiosk_pin_lat).toFixed(6)}]`;
                        const mbtilesStr = st.mbtiles_filename || 'Pending Survey';
                        const isLive = st.status === 'live';
                        return `
                        <tr>
                            <td>
                                <div style="font-weight:600; color:#f8fafc;">${escapeHtml(st.name)}</div>
                                <div style="font-size:11.5px; color:#64748b; margin-top:2px;">${escapeHtml(st.subtitle || '')}</div>
                            </td>
                            <td style="color:#cbd5e1;">${escapeHtml(st.province || '')}</td>
                            <td>
                                <span class="copy-pill" onclick="copyTextPill('${coordStr}')" title="Copy coordinates">
                                    <span>${coordStr}</span>
                                    ${SVG_ICONS.copy}
                                </span>
                            </td>
                            <td>
                                <span class="copy-pill" onclick="copyTextPill('${escapeHtml(mbtilesStr)}')" title="Copy MBTiles filename">
                                    <span>${escapeHtml(mbtilesStr)}</span>
                                    ${SVG_ICONS.copy}
                                </span>
                            </td>
                            <td>
                                <div class="station-status-switch" data-status-group="${escapeHtml(st.station_id)}">
                                    <button type="button"
                                        class="station-status-opt is-live ${isLive ? 'is-active' : ''}"
                                        data-station-status-btn
                                        data-station-id="${escapeHtml(st.station_id)}"
                                        data-target-status="live"
                                        aria-pressed="${isLive ? 'true' : 'false'}">Live on Public Map</button>
                                    <button type="button"
                                        class="station-status-opt is-dev ${!isLive ? 'is-active' : ''}"
                                        data-station-status-btn
                                        data-station-id="${escapeHtml(st.station_id)}"
                                        data-target-status="under_development"
                                        aria-pressed="${!isLive ? 'true' : 'false'}">Under Development</button>
                                </div>
                            </td>
                            <td>
                                <button class="btn btn-blue btn-sm" onclick="onChangeStation('${escapeHtml(st.station_id)}'); switchTab('pin');">${SVG_ICONS.pin} <span>Inspect Station</span></button>
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
                        <h3>Recent Portal Activity & Audit Trail</h3>
                        <div class="help-tip">${isSuperAdmin
                            ? 'Full portal audit log across all roles and stations.'
                            : 'Showing portal activity for roles lower than Super Admin (Super Admin actions are hidden).'}</div>
                    </div>
                </div>
                <div class="dash-audit-search-wrap" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <input type="text" id="dash-audit-search" class="form-control" style="width:260px; max-width:100%; height:36px;" placeholder="Filter actor, action, or summary..." value="${escapeHtml(auditSearch)}">
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
        if (!canViewAudit) return;
        const tbody = document.getElementById('dash-audit-tbody');
        const pager = document.getElementById('dash-audit-pagination');
        if (!tbody || !pager) return;
        try {
            const res = await apiFetch(`/api/admin/audit-logs?page=${page}&limit=${auditLimit}&search=${encodeURIComponent(auditSearch.trim())}`);
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
        if (auditSearch.trim() || auditLimit !== 10) {
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
    }

    const syncBtn = document.getElementById('dash-sync-assets-btn');
    syncBtn?.addEventListener('click', async () => {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Syncing...';
        try {
            const res = await apiFetch('/api/admin/reconcile-assets', { method: 'POST', body: '{}' });
            broadcastDbSync();
            showToast(`Asset Sync complete: added ${res.inserted} new .webp records (${res.skipped} zone/marker files skipped).`);
            await renderDashboardTab(container);
        } catch (err) {
            showToast(err.message || 'Asset sync failed');
            syncBtn.disabled = false;
            syncBtn.textContent = 'Sync Assets';
        }
    });
}

