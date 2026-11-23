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

    container.innerHTML = `
        ${renderWorkflowBanner('Editing Station Metadata & Kiosk Pin')}

        <div class="panel-card">
            <div class="panel-header">
                <div class="panel-title-group">
                    <div class="panel-title-icon">${SVG_ICONS.pin}</div>
                    <div>
                        <h3>Kiosk "You Are Here" Pin & Campus Info — ${escapeHtml(st.name)}</h3>
                        <div class="help-tip">Drag the green pin on the aerial drone map or click the walkway where visitors stand at the kiosk entrance.</div>
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
                    <div id="admin-pin-map"></div>
                    <div class="help-tip" style="margin-top:8px; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                        <span>Blue outlines = Campus Buildings • Dashed lines = Walkways & Roads</span>
                        <span id="pin-overlay-status" class="mono-code">Loading overlays...</span>
                    </div>
                </div>

                <div>
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

                    <div class="form-group">
                        <label>Official Full Station Name</label>
                        <input type="text" id="st-fullname" class="form-control" value="${escapeHtml(st.full_name || '')}">
                    </div>
                    ${adminDirect ? `
                    <div class="form-group" style="padding:10px 12px; border-radius:9px; border:1px solid rgba(148,163,184,0.22); background:rgba(15,23,42,0.45);">
                        <label style="display:flex; align-items:center; gap:9px; cursor:pointer; margin:0; text-transform:none; letter-spacing:0; font-size:12.5px; color:#f8fafc;">
                            <input type="checkbox" id="st-req-pub-editors" ${Number(st.require_publish_for_map_editors || 0) === 1 ? 'checked' : ''} style="width:15px; height:15px; accent-color:#10b981;">
                            <span>Require Administrator publish for map-editor changes</span>
                        </label>
                        <div class="help-tip" style="margin-top:4px;">When unchecked (default), map editor saves apply directly and still log version history & audit trail.</div>
                    </div>` : ''}
                    <div class="form-group">
                        <label>Station Subtitle</label>
                        <input type="text" id="st-subtitle" class="form-control" value="${escapeHtml(st.subtitle || '')}">
                    </div>

                    <!-- Gated Public Deployment Status Control -->
                    <div class="form-group" style="padding:12px; border-radius:10px; background:rgba(9,13,22,0.72); border:1px solid var(--border-default);">
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

                    <div class="form-grid-2">
                        <div class="form-group">
                            <label>"You Are Here" Longitude</label>
                            <input type="number" step="any" id="st-pin-lng" class="form-control" style="font-family:var(--font-mono);" value="${st.kiosk_pin_lng}">
                        </div>
                        <div class="form-group">
                            <label>"You Are Here" Latitude</label>
                            <input type="number" step="any" id="st-pin-lat" class="form-control" style="font-family:var(--font-mono);" value="${st.kiosk_pin_lat}">
                        </div>
                    </div>

                    <div class="form-grid-3">
                        <div class="form-group"><label>Default Zoom</label><input type="number" step="0.1" id="st-zoom" class="form-control" style="font-family:var(--font-mono);" value="${st.default_zoom}"></div>
                        <div class="form-group"><label>Pitch (°)</label><input type="number" step="1" id="st-pitch" class="form-control" style="font-family:var(--font-mono);" value="${st.default_pitch}"></div>
                        <div class="form-group"><label>Bearing (°)</label><input type="number" step="1" id="st-bearing" class="form-control" style="font-family:var(--font-mono);" value="${st.default_bearing}"></div>
                    </div>

                    <!-- Interactive Welcome Tag Chip Builder -->
                    <div class="form-group">
                        <label>Welcome Modal Highlight Badges (Max 3)</label>
                        <div id="welcome-chips-box" class="tag-chips-container"></div>
                        <div class="pin-welcome-add-row" style="display:flex; gap:8px; margin-top:6px;">
                            <input type="text" id="new-welcome-tag-input" class="form-control" placeholder="e.g. 3D Campus Buildings" style="height:36px;">
                            <button type="button" id="add-welcome-tag-btn" class="btn btn-blue btn-sm">+ Add Tag</button>
                        </div>
                    </div>

                    <!-- Interactive Quick Search Tag Chip Builder -->
                    <div class="form-group">
                        <label>Quick Search Shortcut Chips (Search Bar Pills)</label>
                        <div id="quick-chips-box" class="tag-chips-container"></div>
                        <div class="pin-quick-add-grid" style="display:grid; grid-template-columns:1fr 1fr auto; gap:8px; margin-top:6px;">
                            <input type="text" id="new-quick-label" class="form-control" placeholder="Button Label (e.g. Tanco Hall)" style="height:36px;">
                            <input type="text" id="new-quick-query" class="form-control" placeholder="Search Keyword (e.g. Tanco)" style="height:36px;">
                            <button type="button" id="add-quick-tag-btn" class="btn btn-blue btn-sm">+ Add Quick Tag</button>
                        </div>
                        <div class="help-tip">Visitors see the Label button and clicking it automatically searches the Map directory for the Keyword.</div>
                    </div>
                </div>
            </div>

            <div style="margin-top:20px; padding-top:16px; border-top:1px solid rgba(148,163,184,0.16);">
                <div style="font-size:13px; font-weight:700; color:#f8fafc; margin-bottom:4px;">Category Filter Tooltip Descriptions (${escapeHtml(st.name)})</div>
                <div class="help-tip" style="margin-bottom:12px;">Shown below each category inside the visitor "Filter by Type" menu (leave blank to use default).</div>
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

        const filterDescriptions = {};
        ['infrastructure', 'trial_sites', 'orchard', 'office', 'laboratory', 'conference', 'digital_agri'].forEach(k => {
            const v = (document.getElementById(`st-fd-${k}`)?.value || '').trim();
            if (v) filterDescriptions[k] = v;
        });

        const payload = {
            label: document.getElementById('st-label').value.trim(),
            full_name: document.getElementById('st-fullname').value.trim(),
            subtitle: document.getElementById('st-subtitle').value.trim(),
            province: document.getElementById('st-province').value.trim(),
            status: document.getElementById('st-status').value,
            kiosk_pin_lng: Number(document.getElementById('st-pin-lng').value),
            kiosk_pin_lat: Number(document.getElementById('st-pin-lat').value),
            default_zoom: Number(document.getElementById('st-zoom').value),
            default_pitch: Number(document.getElementById('st-pitch').value),
            default_bearing: Number(document.getElementById('st-bearing').value),
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

    // Mount Interactive Mapbox Aerial + Building Footprint + Road Overlay Map
    setTimeout(() => {
        if (!window.mapboxgl) return;
        const startLng = Number(st.kiosk_pin_lng);
        const startLat = Number(st.kiosk_pin_lat);
        const tilePath = st.station_id === 'lares' ? '/api/tiles/{z}/{x}/{y}.png' : `/api/tiles/${st.station_id}/{z}/{x}/{y}.png`;

        const mapInst = new window.mapboxgl.Map({
            container: 'admin-pin-map',
            style: {
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
            },
            center: [startLng, startLat],
            zoom: st.station_id === 'cares' ? 16.5 : 19.0
        });
        PortalState.pinMapInstance = mapInst;

        const marker = new window.mapboxgl.Marker({ color: '#10b981', draggable: true })
            .setLngLat([startLng, startLat])
            .addTo(mapInst);
        PortalState.pinMarkerInstance = marker;

        const syncInputs = (lngLat) => {
            const lngInp = document.getElementById('st-pin-lng');
            const latInp = document.getElementById('st-pin-lat');
            if (lngInp) lngInp.value = Number(lngLat.lng).toFixed(8);
            if (latInp) latInp.value = Number(lngLat.lat).toFixed(8);
        };

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
                }
            });
        });

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

            mapInst.addSource('pin-overlay-bldgs', { type: 'geojson', data: bldgs });
            mapInst.addLayer({
                id: 'pin-overlay-bldgs-fill',
                type: 'fill',
                source: 'pin-overlay-bldgs',
                paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.22 }
            });
            mapInst.addLayer({
                id: 'pin-overlay-bldgs-line',
                type: 'line',
                source: 'pin-overlay-bldgs',
                paint: { 'line-color': '#38bdf8', 'line-width': 1.8 }
            });

            mapInst.addSource('pin-overlay-roads', { type: 'geojson', data: roads });
            mapInst.addLayer({
                id: 'pin-overlay-roads-line',
                type: 'line',
                source: 'pin-overlay-roads',
                paint: { 'line-color': '#fbbf24', 'line-width': 2.2, 'line-dasharray': [2, 1.5] }
            });
        });
    }, 60);
}

