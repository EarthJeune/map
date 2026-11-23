/**
 * Station Settings, Interactive "You Are Here" Pin Map & Visual Tag Chip Builders
 */

import {
    PortalState,
    SVG_ICONS,
    apiFetch,
    showToast,
    broadcastDbSync,
    escapeHtml,
    canPublish,
    hasPermission,
    renderWorkflowBanner,
    showPortalConfirm,
    openVersionHistoryModal
} from './core.js';

function parseJsonSafe(val, fallback) {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch (_) { return fallback; }
}

async function fetchStationOverlays(stationId) {
    const emptyGeo = { type: 'FeatureCollection', features: [] };
    try {
        if (stationId === 'lares') {
            const [bldgs, roads] = await Promise.all([
                fetch('/api/buildings').then(r => r.ok ? r.json() : emptyGeo).catch(() => emptyGeo),
                fetch('/roads.json').then(r => r.ok ? r.json() : emptyGeo).catch(() => emptyGeo)
            ]);
            return { bldgs, roads };
        }
        if (stationId === 'qares') {
            const [bldgs, roads] = await Promise.all([
                fetch('/api/qares/buildings').then(r => r.ok ? r.json() : emptyGeo).catch(() => emptyGeo),
                fetch('/api/qares/roads').then(r => r.ok ? r.json() : emptyGeo).catch(() => emptyGeo)
            ]);
            return { bldgs, roads };
        }
        if (stationId === 'rares') {
            const [bldgs, roads] = await Promise.all([
                fetch('/api/rares/buildings').then(r => r.ok ? r.json() : emptyGeo).catch(() => emptyGeo),
                fetch('/api/rares/roads').then(r => r.ok ? r.json() : emptyGeo).catch(() => emptyGeo)
            ]);
            return { bldgs, roads };
        }
    } catch (_) {}
    return { bldgs: emptyGeo, roads: emptyGeo };
}

function haversineMeters(lng1, lat1, lng2, lat2) {
    if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return 0;
    const dx = (lng2 - lng1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
    const dy = (lat2 - lat1) * 110540;
    return Math.hypot(dx, dy);
}

export async function renderPinTab(container) {
    const stations = await apiFetch('/api/admin/stations');
    const st = stations.find(s => s.station_id === PortalState.currentStation) || stations[0];

    let welcomeTags = parseJsonSafe(st.welcome_tags, []);
    if (!Array.isArray(welcomeTags)) welcomeTags = [];

    let quickTags = parseJsonSafe(st.quick_tags, []);
    if (!Array.isArray(quickTags)) quickTags = [];
    quickTags = quickTags.map(t => (t && typeof t === 'object')
        ? { label: String(t.label || ''), query: String(t.query || t.label || '') }
        : { label: String(t || ''), query: String(t || '') }
    ).filter(t => t.label);

    const filterDesc = parseJsonSafe(st.filter_descriptions, {});
    const canToggleStatus = hasPermission('station:toggle_status');
    const adminDirect = canPublish();
    const startLng = Number(st.kiosk_pin_lng);
    const startLat = Number(st.kiosk_pin_lat);

    container.innerHTML = `
        ${renderWorkflowBanner('Adjusting Kiosk "You Are Here" Pin')}

        <div class="panel-card">
            <div class="panel-header">
                <div class="panel-title-group">
                    <div class="panel-title-icon">${SVG_ICONS.pin}</div>
                    <div>
                        <h3>"You Are Here" Kiosk Pin — ${escapeHtml(st.name)}</h3>
                        <div class="help-tip">Drag the pin or click anywhere on the map to set the kiosk's exact starting location.</div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-secondary" id="pin-version-history-btn">${SVG_ICONS.history} <span>Version History</span></button>
                    ${adminDirect ? `
                        <button type="button" class="btn btn-secondary" id="pin-submit-review-btn">Submit for Review</button>
                        <button type="button" class="btn btn-emerald" id="pin-publish-btn">Save & Publish Live</button>
                    ` : `
                        <button type="button" class="btn btn-emerald" id="pin-submit-review-btn">Submit for Reviewer Approval →</button>
                    `}
                </div>
            </div>

            <div class="pin-editor-grid">
                <div>
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
                        <span style="font-size:12px; font-weight:700; color:var(--text-muted, #64748b);">1. Click or drag the green pin on the aerial map</span>
                        <div style="display:inline-flex; gap:4px; padding:3px; border-radius:9px; border:1px solid var(--border-default); background:var(--surface-2, rgba(15,23,42,0.06));">
                            <button type="button" class="btn btn-sm btn-emerald" id="pin-view-2d-btn" style="padding:4px 10px; font-size:11.5px;">Top-Down Edit</button>
                            <button type="button" class="btn btn-sm btn-secondary" id="pin-view-3d-btn" style="padding:4px 10px; font-size:11.5px;">3D Kiosk Angle</button>
                        </div>
                    </div>
                    <div id="admin-pin-map"></div>
                    <div class="help-tip" style="margin-top:8px; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                        <span>Blue outlines = Campus Buildings • Dashed lines = Walkways & Roads</span>
                        <span id="pin-overlay-status" class="mono-code">Loading overlays...</span>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:14px;">
                    <div style="padding:14px; border-radius:12px; border:1px solid var(--border-default); background:var(--surface-2, rgba(15,23,42,0.04));">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
                            <div style="font-size:13px; font-weight:700;">Pinned Kiosk Coordinates</div>
                            <span id="pin-move-delta-pill" class="status-pill status-pill-blue" style="font-size:11px;">At Live Kiosk Location</span>
                        </div>
                        <div class="form-grid-2">
                            <div class="form-group" style="margin-bottom:0;">
                                <label>Longitude</label>
                                <input type="number" step="any" id="st-pin-lng" class="form-control" style="font-family:var(--font-mono);" value="${startLng.toFixed(8)}">
                            </div>
                            <div class="form-group" style="margin-bottom:0;">
                                <label>Latitude</label>
                                <input type="number" step="any" id="st-pin-lat" class="form-control" style="font-family:var(--font-mono);" value="${startLat.toFixed(8)}">
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:10px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-secondary btn-sm" id="pin-reset-live-btn" disabled>↺ Reset to Live Pin</button>
                            <button type="button" class="btn btn-secondary btn-sm" id="pin-copy-coords-btn">Copy Coordinates</button>
                        </div>
                    </div>

                    <!-- Live Kiosk Preview: How it will look when pinned here -->
                    <div style="padding:14px; border-radius:12px; border:1px solid var(--border-default); background:var(--surface-2, rgba(15,23,42,0.04));">
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;">
                            <div>
                                <div style="font-size:13px; font-weight:700;">Live Kiosk Preview</div>
                                <div class="help-tip" style="margin-top:2px;">How the pulsing "You Are Here" marker will look on the campus kiosk map.</div>
                            </div>
                            <span class="status-pill status-pill-live" style="font-size:10.5px;"><span class="status-dot-live"></span><span>Live Sync</span></span>
                        </div>
                        <div style="position:relative; width:100%; height:220px; border-radius:10px; overflow:hidden; border:1px solid var(--border-default);">
                            <div id="admin-pin-kiosk-preview" style="width:100%; height:100%;"></div>
                            <div style="position:absolute; top:10px; left:10px; pointer-events:none; display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; background:rgba(15,23,42,0.86); color:#f8fafc; font-size:11px; font-weight:700; box-shadow:0 4px 12px rgba(0,0,0,0.28);">
                                <span style="width:7px; height:7px; border-radius:50%; background:#10b981; display:inline-block;"></span>
                                <span>${escapeHtml(st.label || st.name)} • Kiosk View</span>
                            </div>
                        </div>
                    </div>

                    <div style="padding:10px 14px; border-radius:10px; border:1px solid var(--border-default); font-size:12px; color:var(--text-muted, #64748b); display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                        <span><strong>Workflow:</strong> 1. Drag Pin → 2. Reviewer Approves → 3. Admin Publishes Live</span>
                    </div>
                </div>
            </div>

            ${adminDirect ? `
            <details style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border-default);">
                <summary style="cursor:pointer; font-size:13px; font-weight:700; user-select:none; padding:4px 0;">
                    Advanced Station Profile, Deployment Visibility & Directory Settings (Super Admin)
                </summary>
                <div style="margin-top:14px;">
                    <div class="form-grid-2">
                        <div class="form-group">
                            <label>Top Header Badge Label</label>
                            <input type="text" id="st-label" class="form-control" value="${escapeHtml(st.label || '')}">
                        </div>
                        <div class="form-group">
                            <label>Province / Town</label>
                            <input type="text" id="st-province" class="form-control" value="${escapeHtml(st.province || '')}">
                        </div>
                    </div>

                    <div class="form-grid-2">
                        <div class="form-group">
                            <label>Official Full Station Name</label>
                            <input type="text" id="st-fullname" class="form-control" value="${escapeHtml(st.full_name || '')}">
                        </div>
                        <div class="form-group">
                            <label>Station Subtitle</label>
                            <input type="text" id="st-subtitle" class="form-control" value="${escapeHtml(st.subtitle || '')}">
                        </div>
                    </div>

                    <div class="form-grid-2" style="align-items:stretch;">
                        <div class="form-group" style="padding:12px; border-radius:10px; border:1px solid var(--border-default);">
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                                <div>
                                    <label style="margin-bottom:4px;">Public Deployment Visibility</label>
                                    <input type="hidden" id="st-status" value="${escapeHtml(st.status || 'under_development')}">
                                    <div id="st-status-pill-wrap">
                                        ${st.status === 'live'
                                            ? `<span class="status-pill status-pill-live"><span class="status-dot-live"></span><span>Live on Public Map</span></span>`
                                            : `<span class="status-pill status-pill-dev"><span class="status-dot-dev"></span><span>Under Development (Notice Modal)</span></span>`}
                                    </div>
                                </div>
                                ${canToggleStatus
                                    ? `<button type="button" id="st-toggle-status-btn" class="btn btn-secondary btn-sm">Switch to ${st.status === 'live' ? 'Under Dev' : 'Live'}…</button>`
                                    : `<span class="mono-code">Super Admin Only</span>`}
                            </div>
                        </div>

                        <div class="form-group" style="padding:12px; border-radius:10px; border:1px solid var(--border-default);">
                            <label style="display:flex; align-items:center; gap:9px; cursor:pointer; margin:0; text-transform:none; letter-spacing:0; font-size:12.5px;">
                                <input type="checkbox" id="st-req-pub-editors" ${Number(st.require_publish_for_map_editors || 0) === 1 ? 'checked' : ''} style="width:15px; height:15px; accent-color:#10b981;">
                                <span>Require Administrator publish for map-editor changes</span>
                            </label>
                            <div class="help-tip" style="margin-top:4px;">When unchecked (default), map editor saves apply directly and still log version history & audit trail.</div>
                        </div>
                    </div>

                    <div class="form-grid-3">
                        <div class="form-group"><label>Default Zoom</label><input type="number" step="0.1" id="st-zoom" class="form-control" style="font-family:var(--font-mono);" value="${st.default_zoom}"></div>
                        <div class="form-group"><label>Pitch (°)</label><input type="number" step="1" id="st-pitch" class="form-control" style="font-family:var(--font-mono);" value="${st.default_pitch}"></div>
                        <div class="form-group"><label>Bearing (°)</label><input type="number" step="1" id="st-bearing" class="form-control" style="font-family:var(--font-mono);" value="${st.default_bearing}"></div>
                    </div>

                    <div class="form-group">
                        <label>Welcome Modal Highlight Badges (Max 3)</label>
                        <div id="welcome-chips-box" class="tag-chips-container"></div>
                        <div class="pin-welcome-add-row" style="display:flex; gap:8px; margin-top:6px;">
                            <input type="text" id="new-welcome-tag-input" class="form-control" placeholder="e.g. 3D Campus Buildings" style="height:36px;">
                            <button type="button" id="add-welcome-tag-btn" class="btn btn-blue btn-sm">+ Add Tag</button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Quick Search Shortcut Chips (Search Bar Pills)</label>
                        <div id="quick-chips-box" class="tag-chips-container"></div>
                        <div class="pin-quick-add-grid" style="display:grid; grid-template-columns:1fr 1fr auto; gap:8px; margin-top:6px;">
                            <input type="text" id="new-quick-label" class="form-control" placeholder="Button Label (e.g. Tanco Hall)" style="height:36px;">
                            <input type="text" id="new-quick-query" class="form-control" placeholder="Search Keyword (e.g. Tanco)" style="height:36px;">
                            <button type="button" id="add-quick-tag-btn" class="btn btn-blue btn-sm">+ Add Quick Tag</button>
                        </div>
                    </div>

                    <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border-default);">
                        <div style="font-size:12.5px; font-weight:700; margin-bottom:4px;">Category Filter Tooltip Descriptions (${escapeHtml(st.name)})</div>
                        <div class="help-tip" style="margin-bottom:10px;">Shown below each category inside the visitor "Filter by Type" menu (leave blank to use default).</div>
                        <div class="form-grid-2">
                            <div class="form-group"><label>Agri Infrastructure / Facilities</label><input type="text" id="st-fd-infrastructure" class="form-control" placeholder="Default description" value="${escapeHtml(filterDesc.infrastructure || '')}"></div>
                            <div class="form-group"><label>Agricultural Test / Trial Sites</label><input type="text" id="st-fd-trial_sites" class="form-control" placeholder="Default description" value="${escapeHtml(filterDesc.trial_sites || '')}"></div>
                            <div class="form-group"><label>Orchard</label><input type="text" id="st-fd-orchard" class="form-control" placeholder="Default description" value="${escapeHtml(filterDesc.orchard || '')}"></div>
                            <div class="form-group"><label>Office Buildings</label><input type="text" id="st-fd-office" class="form-control" placeholder="Default description" value="${escapeHtml(filterDesc.office || '')}"></div>
                            <div class="form-group"><label>Laboratories</label><input type="text" id="st-fd-laboratory" class="form-control" placeholder="Default description" value="${escapeHtml(filterDesc.laboratory || '')}"></div>
                            <div class="form-group"><label>Conference Hall</label><input type="text" id="st-fd-conference" class="form-control" placeholder="Default description" value="${escapeHtml(filterDesc.conference || '')}"></div>
                            <div class="form-group"><label>Digital Agriculture Project</label><input type="text" id="st-fd-digital_agri" class="form-control" placeholder="Default description" value="${escapeHtml(filterDesc.digital_agri || '')}"></div>
                        </div>
                    </div>
                </div>
            </details>` : ''}
        </div>
    `;

    // Render Tag Chips UI
    const renderChips = () => {
        const wBox = document.getElementById('welcome-chips-box');
        if (wBox) {
            wBox.innerHTML = welcomeTags.length
                ? welcomeTags.map((t, i) => `
                    <span class="tag-chip-pill">
                        <span>${escapeHtml(t)}</span>
                        <button type="button" class="tag-chip-del" data-del-welcome="${i}" title="Remove tag">×</button>
                    </span>`).join('')
                : `<span style="color:#64748b; font-size:12px;">No welcome tags added yet.</span>`;
            wBox.querySelectorAll('[data-del-welcome]').forEach(btn => {
                btn.addEventListener('click', () => {
                    welcomeTags.splice(Number(btn.dataset.delWelcome), 1);
                    renderChips();
                });
            });
        }

        const qBox = document.getElementById('quick-chips-box');
        if (qBox) {
            qBox.innerHTML = quickTags.length
                ? quickTags.map((t, i) => `
                    <span class="tag-chip-pill">
                        <span>${escapeHtml(t.label)}</span>
                        <small>→ ${escapeHtml(t.query)}</small>
                        <button type="button" class="tag-chip-del" data-del-quick="${i}" title="Remove shortcut">×</button>
                    </span>`).join('')
                : `<span style="color:#64748b; font-size:12px;">No quick search chips added yet.</span>`;
            qBox.querySelectorAll('[data-del-quick]').forEach(btn => {
                btn.addEventListener('click', () => {
                    quickTags.splice(Number(btn.dataset.delQuick), 1);
                    renderChips();
                });
            });
        }
    };
    renderChips();

    document.getElementById('add-welcome-tag-btn')?.addEventListener('click', () => {
        const inp = document.getElementById('new-welcome-tag-input');
        const val = inp?.value.trim();
        if (!val) return;
        if (welcomeTags.length >= 3) {
            showToast('Welcome card displays up to 3 highlight badges.');
            return;
        }
        welcomeTags.push(val);
        inp.value = '';
        renderChips();
    });

    document.getElementById('add-quick-tag-btn')?.addEventListener('click', () => {
        const lblEl = document.getElementById('new-quick-label');
        const qryEl = document.getElementById('new-quick-query');
        const label = lblEl?.value.trim();
        const query = qryEl?.value.trim() || label;
        if (!label) return;
        quickTags.push({ label, query });
        lblEl.value = '';
        qryEl.value = '';
        renderChips();
    });

    document.getElementById('pin-version-history-btn')?.addEventListener('click', () => {
        openVersionHistoryModal({
            stationId: st.station_id,
            targetTable: 'stations',
            targetId: st.station_id,
            entityName: st.name || st.station_id.toUpperCase()
        });
    });

    // Safety-gated Status Toggle confirmation
    document.getElementById('st-toggle-status-btn')?.addEventListener('click', async () => {
        const hidden = document.getElementById('st-status');
        const wrap = document.getElementById('st-status-pill-wrap');
        const btn = document.getElementById('st-toggle-status-btn');
        const nextStatus = hidden.value === 'live' ? 'under_development' : 'live';
        const warningMsg = nextStatus === 'live'
            ? `Public kiosk & web visitors will see the live campus map for ${st.name} instead of the Under Development banner once saved.`
            : `Visitors will see the Under Development notice modal upon selecting ${st.name}.`;
        const ok = await showPortalConfirm({
            title: nextStatus === 'live' ? `Switch ${st.name} to Live?` : `Switch ${st.name} to Under Development?`,
            message: warningMsg,
            confirmLabel: nextStatus === 'live' ? 'Switch to Live' : 'Switch to Under Dev',
            cancelLabel: 'Cancel',
            danger: nextStatus !== 'live'
        });
        if (!ok) return;
        hidden.value = nextStatus;
        wrap.innerHTML = nextStatus === 'live'
            ? `<span class="status-pill status-pill-live"><span class="status-dot-live"></span><span>Live on Public Map</span></span>`
            : `<span class="status-pill status-pill-dev"><span class="status-dot-dev"></span><span>Under Development (Notice Modal)</span></span>`;
        btn.textContent = `Switch to ${nextStatus === 'live' ? 'Under Dev' : 'Live'}…`;
    });

    const saveStation = async (submitForReview) => {
        const ok = await showPortalConfirm({
            title: submitForReview ? 'Submit Station Changes for Review?' : 'Save & Publish Station Changes?',
            message: submitForReview
                ? `Submit your station settings and "You Are Here" kiosk pin updates for ${st.station_id.toUpperCase()} to the approval queue?`
                : `Are you sure you want to save and publish the updated station profile and kiosk pin for ${st.station_id.toUpperCase()} to the live map?`,
            confirmLabel: submitForReview ? 'Yes, Submit' : 'Yes, Save & Publish',
            cancelLabel: 'Cancel'
        });
        if (!ok) return;

        const filterDescriptions = adminDirect ? {} : filterDesc;
        if (adminDirect) {
            ['infrastructure', 'trial_sites', 'orchard', 'office', 'laboratory', 'conference', 'digital_agri'].forEach(k => {
                const v = (document.getElementById(`st-fd-${k}`)?.value || '').trim();
                if (v) filterDescriptions[k] = v;
            });
        }

        const payload = {
            label: adminDirect ? (document.getElementById('st-label')?.value.trim() ?? st.label ?? '') : (st.label || ''),
            full_name: adminDirect ? (document.getElementById('st-fullname')?.value.trim() ?? st.full_name ?? '') : (st.full_name || ''),
            subtitle: adminDirect ? (document.getElementById('st-subtitle')?.value.trim() ?? st.subtitle ?? '') : (st.subtitle || ''),
            province: adminDirect ? (document.getElementById('st-province')?.value.trim() ?? st.province ?? '') : (st.province || ''),
            status: adminDirect ? (document.getElementById('st-status')?.value || st.status || 'under_development') : (st.status || 'under_development'),
            kiosk_pin_lng: Number(document.getElementById('st-pin-lng').value),
            kiosk_pin_lat: Number(document.getElementById('st-pin-lat').value),
            default_zoom: adminDirect ? Number(document.getElementById('st-zoom')?.value ?? st.default_zoom) : Number(st.default_zoom),
            default_pitch: adminDirect ? Number(document.getElementById('st-pitch')?.value ?? st.default_pitch) : Number(st.default_pitch),
            default_bearing: adminDirect ? Number(document.getElementById('st-bearing')?.value ?? st.default_bearing) : Number(st.default_bearing),
            welcome_tags: welcomeTags,
            quick_tags: quickTags,
            filter_descriptions: filterDescriptions,
            ...(adminDirect ? { require_publish_for_map_editors: Boolean(document.getElementById('st-req-pub-editors')?.checked) } : {}),
            submitForReview: Boolean(submitForReview)
        };

        const res = await apiFetch(`/api/admin/stations/${st.station_id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        if (res.published) {
            broadcastDbSync();
            showToast(`Published Station & Kiosk Pin updates for ${st.station_id.toUpperCase()}!`);
        } else {
            showToast(`Submitted Pin & Station update (#${res.changeRequestId}) for Reviewer approval!`);
        }
    };

    document.getElementById('pin-publish-btn')?.addEventListener('click', () => saveStation(false));
    document.getElementById('pin-submit-review-btn')?.addEventListener('click', () => saveStation(true));

    // Mount Interactive Mapbox Aerial + Building Footprint + Road Overlay Map AND Live Kiosk 3D Preview
    setTimeout(() => {
        if (!window.mapboxgl) return;
        const tilePath = st.station_id === 'lares' ? '/api/tiles/{z}/{x}/{y}.png' : `/api/tiles/${st.station_id}/{z}/{x}/{y}.png`;
        const buildBaseStyle = () => ({
            version: 8,
            sources: {
                'google-sat': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256, maxzoom: 20 },
                ...(st.station_id !== 'cares' ? {
                    'station-drone': { type: 'raster', tiles: [tilePath], tileSize: 256, minzoom: 14, maxzoom: 21 }
                } : {})
            },
            layers: [
                { id: 'sat', type: 'raster', source: 'google-sat' },
                ...(st.station_id !== 'cares' ? [{ id: 'drone', type: 'raster', source: 'station-drone' }] : [])
            ]
        });

        const mapInst = new window.mapboxgl.Map({
            container: 'admin-pin-map',
            style: buildBaseStyle(),
            center: [startLng, startLat],
            zoom: st.station_id === 'cares' ? 16.5 : 19.0
        });
        PortalState.pinMapInstance = mapInst;

        const marker = new window.mapboxgl.Marker({ color: '#10b981', draggable: true })
            .setLngLat([startLng, startLat])
            .addTo(mapInst);
        PortalState.pinMarkerInstance = marker;

        // Live 3D Kiosk Preview Map (shows exact "You Are Here" view at the pinned coordinates)
        let previewMap = null;
        let previewMarker = null;
        const previewHost = document.getElementById('admin-pin-kiosk-preview');
        if (previewHost) {
            previewMap = new window.mapboxgl.Map({
                container: previewHost,
                style: buildBaseStyle(),
                center: [startLng, startLat],
                zoom: Math.min(20.2, Math.max(17.5, Number(st.default_zoom) || 19.1)),
                pitch: Number(st.default_pitch) || 52,
                bearing: Number(st.default_bearing) || 0,
                interactive: false,
                attributionControl: false
            });
            const yahEl = document.createElement('div');
            yahEl.style.cssText = 'display:flex; flex-direction:column; align-items:center; pointer-events:none;';
            yahEl.innerHTML = `
                <div style="padding:3px 9px; border-radius:999px; background:#059669; color:#ffffff; font-size:10px; font-weight:800; letter-spacing:0.05em; box-shadow:0 4px 14px rgba(5,150,105,0.55); border:1.5px solid #ffffff; white-space:nowrap;">YOU ARE HERE</div>
                <div style="width:14px; height:14px; margin-top:4px; border-radius:50%; background:#10b981; border:3px solid #ffffff; box-shadow:0 0 0 6px rgba(16,185,129,0.32);"></div>
            `;
            previewMarker = new window.mapboxgl.Marker({ element: yahEl, anchor: 'bottom' })
                .setLngLat([startLng, startLat])
                .addTo(previewMap);
        }

        const updateDeltaAndPreview = (lng, lat) => {
            const deltaM = haversineMeters(startLng, startLat, lng, lat);
            const pill = document.getElementById('pin-move-delta-pill');
            const resetBtn = document.getElementById('pin-reset-live-btn');
            if (pill) {
                if (deltaM > 0.3) {
                    pill.className = 'status-pill status-pill-live';
                    pill.textContent = `Moved ${deltaM.toFixed(1)} m from live pin`;
                } else {
                    pill.className = 'status-pill status-pill-blue';
                    pill.textContent = 'At Live Kiosk Location';
                }
            }
            if (resetBtn) resetBtn.disabled = deltaM <= 0.3;
            if (previewMarker) previewMarker.setLngLat([lng, lat]);
            if (previewMap) previewMap.easeTo({ center: [lng, lat], duration: 250 });
        };

        const syncInputs = (lngLat) => {
            const lng = Number(lngLat.lng);
            const lat = Number(lngLat.lat);
            const lngInp = document.getElementById('st-pin-lng');
            const latInp = document.getElementById('st-pin-lat');
            if (lngInp) lngInp.value = lng.toFixed(8);
            if (latInp) latInp.value = lat.toFixed(8);
            updateDeltaAndPreview(lng, lat);
        };

        marker.on('drag', () => {
            const ll = marker.getLngLat();
            updateDeltaAndPreview(ll.lng, ll.lat);
        });
        marker.on('dragend', () => syncInputs(marker.getLngLat()));
        mapInst.on('click', (e) => {
            marker.setLngLat(e.lngLat);
            syncInputs(e.lngLat);
        });

        ['st-pin-lng', 'st-pin-lat'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                const lng = Number(document.getElementById('st-pin-lng')?.value);
                const lat = Number(document.getElementById('st-pin-lat')?.value);
                if (Number.isFinite(lng) && Number.isFinite(lat)) {
                    marker.setLngLat([lng, lat]);
                    mapInst.easeTo({ center: [lng, lat] });
                    updateDeltaAndPreview(lng, lat);
                }
            });
        });

        document.getElementById('pin-reset-live-btn')?.addEventListener('click', () => {
            marker.setLngLat([startLng, startLat]);
            mapInst.easeTo({ center: [startLng, startLat], duration: 300 });
            syncInputs({ lng: startLng, lat: startLat });
            showToast('Pin reset to current live kiosk coordinates.');
        });

        document.getElementById('pin-copy-coords-btn')?.addEventListener('click', async () => {
            const lng = document.getElementById('st-pin-lng')?.value || '';
            const lat = document.getElementById('st-pin-lat')?.value || '';
            try {
                await navigator.clipboard.writeText(`${lng}, ${lat}`);
                showToast(`Copied coordinates: ${lng}, ${lat}`);
            } catch (_) {
                showToast(`Coordinates: ${lng}, ${lat}`);
            }
        });

        const btn2d = document.getElementById('pin-view-2d-btn');
        const btn3d = document.getElementById('pin-view-3d-btn');
        btn2d?.addEventListener('click', () => {
            btn2d.className = 'btn btn-sm btn-emerald';
            if (btn3d) btn3d.className = 'btn btn-sm btn-secondary';
            mapInst.easeTo({ pitch: 0, bearing: 0, zoom: st.station_id === 'cares' ? 16.5 : 19.0, duration: 400 });
        });
        btn3d?.addEventListener('click', () => {
            if (btn2d) btn2d.className = 'btn btn-sm btn-secondary';
            btn3d.className = 'btn btn-sm btn-emerald';
            const ll = marker.getLngLat();
            mapInst.easeTo({
                center: [ll.lng, ll.lat],
                pitch: Number(st.default_pitch) || 52,
                bearing: Number(st.default_bearing) || 0,
                zoom: Number(st.default_zoom) || 19.1,
                duration: 450
            });
        });

        const attachOverlays = (targetMap, bldgs, roads) => {
            if (!targetMap || targetMap.getSource('pin-overlay-bldgs')) return;
            targetMap.addSource('pin-overlay-bldgs', { type: 'geojson', data: bldgs });
            targetMap.addLayer({
                id: 'pin-overlay-bldgs-fill',
                type: 'fill',
                source: 'pin-overlay-bldgs',
                paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.22 }
            });
            targetMap.addLayer({
                id: 'pin-overlay-bldgs-line',
                type: 'line',
                source: 'pin-overlay-bldgs',
                paint: { 'line-color': '#38bdf8', 'line-width': 1.8 }
            });
            targetMap.addSource('pin-overlay-roads', { type: 'geojson', data: roads });
            targetMap.addLayer({
                id: 'pin-overlay-roads-line',
                type: 'line',
                source: 'pin-overlay-roads',
                paint: { 'line-color': '#fbbf24', 'line-width': 2.2, 'line-dasharray': [2, 1.5] }
            });
        };

        mapInst.on('load', async () => {
            const { bldgs, roads } = await fetchStationOverlays(st.station_id);
            const stEl = document.getElementById('pin-overlay-status');
            if (st.station_id === 'cares') {
                if (stEl) stEl.textContent = 'CARES: Pending Field Survey';
                return;
            }
            const bCount = (bldgs.features || []).length;
            const rCount = (roads.features || []).length;
            if (stEl) stEl.textContent = `${bCount} footprints • ${rCount} road features`;
            attachOverlays(mapInst, bldgs, roads);
            if (previewMap) {
                if (previewMap.isStyleLoaded()) attachOverlays(previewMap, bldgs, roads);
                else previewMap.once('load', () => attachOverlays(previewMap, bldgs, roads));
            }
        });
    }, 60);
}

