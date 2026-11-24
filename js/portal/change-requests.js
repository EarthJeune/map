/**
 * Governance Console: Visual Change Requests Queue, Interactive Spatial Geometry Diff & Map-Card Inspector,
 * Station Reviewer Approvals, GIS Editor Revise & Resubmit Loop, Transactional Publish,
 * and Truly Visual Read-Only Station Directory (2D/3D Campus Blueprint Radar, Buildings & Photos,
 * Floor-by-Floor Grouped Offices, and Agricultural Plots with Polygon Silhouettes)
 */

import {
    PortalState,
    SVG_ICONS,
    apiFetch,
    showToast,
    broadcastDbSync,
    escapeHtml,
    hasPermission,
    renderFacilityStatusBadge,
    openGovModal,
    closeGovModal,
    copyTextPill,
    renderPaginationBarHtml,
    getSavedPortalPref,
    setSavedPortalPref,
    showPortalConfirm
} from './core.js';
import { guardAsyncAction } from '../ui-guard.js';
import { MAPBOX_ACCESS_TOKEN } from '../data/config.js';
import { computeSnapshotBeforeAfter, hasGeometryActuallyChanged, formatHumanRequestTitle, parseReviewerFeedback } from './diff-utils.js';

const spatialAerialSpecs = new Map();
const spatialAerialMaps = new Map();
let activeGeomDiffMap = null;

function destroyActiveGeomDiffMap() {
    if (activeGeomDiffMap) {
        try { activeGeomDiffMap.remove(); } catch (_) { }
        activeGeomDiffMap = null;
    }
}

const MAP_EDITOR_META = {
    buildings: { label: 'Building Footprints', tab: 'editor-draw', color: '#38bdf8' },
    pills: { label: 'Pill Label Offsets', tab: 'editor-pill', color: '#f59e0b' },
    roads: { label: 'Roads & Entrances', tab: 'editor-road', color: '#a855f7' },
    plots: { label: 'Agricultural Plots', tab: 'editor-plot', color: '#10b981' },
    trees: { label: '3D Tree Placement', tab: 'editor-tree', color: '#22c55e' }
};

function formatGeomItemDelta(item) {
    if (!item) return '';
    if (item.changeKind === 'pill_moved') {
        return `moved ${item.shiftM ?? 0} m${item.direction ? ' ' + item.direction : ''}`;
    }
    if (item.changeKind === 'added') {
        if (item.areaM2 > 0) return `+${Math.round(item.areaM2).toLocaleString()} m²`;
        if (item.lengthM > 0) return `+${item.lengthM} m`;
        return 'New feature';
    }
    if (item.changeKind === 'removed') {
        if (item.areaM2 > 0) return `−${Math.round(item.areaM2).toLocaleString()} m²`;
        if (item.lengthM > 0) return `−${item.lengthM} m`;
        return 'Removed';
    }
    const bits = [];
    if (item.areaDeltaM2) bits.push(`${item.areaDeltaM2 > 0 ? '+' : ''}${Math.round(item.areaDeltaM2).toLocaleString()} m²`);
    if (item.lengthDeltaM) bits.push(`${item.lengthDeltaM > 0 ? '+' : ''}${item.lengthDeltaM} m`);
    if (item.shiftM >= 0.5) bits.push(`shifted ${item.shiftM} m${item.direction ? ' ' + item.direction : ''}`);
    return bits.length ? bits.join(' • ') : 'Geometry edited';
}

function getGeomDiffSummary(cr) {
    const next = parseJsonSafe(cr?.payload_json);
    const prev = parseJsonSafe(cr?.previous_json);
    const ds = next?.diff_summary || {};
    const editorType = ds.editorType || next?.editor_type || prev?.editor_type || 'buildings';
    const meta = MAP_EDITOR_META[editorType] || MAP_EDITOR_META.buildings;
    return {
        editorType,
        editorTitle: ds.editorTitle || meta.label,
        editorTab: meta.tab,
        accentColor: meta.color,
        filePath: next?.file_path || prev?.file_path || '',
        summaryText: ds.summaryText || cr?.summary || meta.label,
        added: Array.isArray(ds.added) ? ds.added : [],
        modified: Array.isArray(ds.modified) ? ds.modified : [],
        removed: Array.isArray(ds.removed) ? ds.removed : [],
        addedCount: Number(ds.addedCount ?? (Array.isArray(ds.added) ? ds.added.length : 0)),
        modifiedCount: Number(ds.modifiedCount ?? (Array.isArray(ds.modified) ? ds.modified.length : 0)),
        removedCount: Number(ds.removedCount ?? (Array.isArray(ds.removed) ? ds.removed.length : 0)),
        bbox: Array.isArray(ds.bbox) && ds.bbox.length === 4 ? ds.bbox : null,
        prevGeo: prev?.geojson || null,
        nextGeo: next?.geojson || null
    };
}

function renderMapGeomVisualDiffHtml(cr) {
    const g = getGeomDiffSummary(cr);
    const allItems = [
        ...g.added.map((it, i) => ({ ...it, _group: 'added', _idx: `a_${i}` })),
        ...g.modified.map((it, i) => ({ ...it, _group: 'modified', _idx: `m_${i}` })),
        ...g.removed.map((it, i) => ({ ...it, _group: 'removed', _idx: `r_${i}` }))
    ];
    const total = g.addedCount + g.modifiedCount + g.removedCount;
    const isLight = document.body.dataset.theme === 'light';
    const panelBg = isLight ? '#f8fafc' : 'rgba(9,16,28,0.88)';
    const borderCol = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(148,163,184,0.20)';
    const textMain = isLight ? '#0f172a' : '#f8fafc';
    const textMuted = isLight ? '#475569' : '#94a3b8';

    const badgeFor = (it) => {
        if (it.changeKind === 'added') return `<span style="padding:2px 7px; border-radius:999px; font-size:10px; font-weight:800; background:rgba(16,185,129,0.18); color:#10b981; border:1px solid rgba(16,185,129,0.38);">+ ADDED</span>`;
        if (it.changeKind === 'removed') return `<span style="padding:2px 7px; border-radius:999px; font-size:10px; font-weight:800; background:rgba(244,63,94,0.16); color:#f43f5e; border:1px solid rgba(244,63,94,0.38);">− REMOVED</span>`;
        if (it.changeKind === 'pill_moved') return `<span style="padding:2px 7px; border-radius:999px; font-size:10px; font-weight:800; background:rgba(245,158,11,0.18); color:#f59e0b; border:1px solid rgba(245,158,11,0.40);">→ MOVED</span>`;
        return `<span style="padding:2px 7px; border-radius:999px; font-size:10px; font-weight:800; background:rgba(56,189,248,0.18); color:#38bdf8; border:1px solid rgba(56,189,248,0.38);">~ EDITED</span>`;
    };

    return `
        <div style="border:1px solid ${borderCol}; border-radius:14px; overflow:hidden; background:${panelBg}; margin-bottom:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; padding:10px 14px; border-bottom:1px solid ${borderCol};">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span class="status-pill status-pill-live" style="font-size:11px;">${escapeHtml(g.editorTitle)}</span>
                    <span style="font-size:12px; font-weight:700; color:${textMain};">${escapeHtml(g.summaryText)}</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <div class="cr-preview-mode-tabs" id="cr-geom-mode-tabs">
                        <button type="button" class="cr-preview-mode-btn active" data-geom-mode="overlay">Overlay Diff</button>
                        <button type="button" class="cr-preview-mode-btn" data-geom-mode="before">Before (Live)</button>
                        <button type="button" class="cr-preview-mode-btn" data-geom-mode="after">After (Proposed)</button>
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm" id="cr-geom-fit-btn" style="padding:5px 10px; font-size:11.5px;">Fit All Changes</button>
                </div>
            </div>

            <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; padding:7px 14px; font-size:11.5px; color:${textMuted}; border-bottom:1px solid ${borderCol};">
                <span style="display:inline-flex; align-items:center; gap:5px;"><span style="width:12px; height:3px; border-top:2px dashed #f43f5e; display:inline-block;"></span> Before (Live)</span>
                <span style="display:inline-flex; align-items:center; gap:5px;"><span style="width:12px; height:3px; background:#10b981; display:inline-block; border-radius:2px;"></span> After (Proposed)</span>
                <span style="display:inline-flex; align-items:center; gap:5px;"><span style="width:12px; height:3px; border-top:2px dashed #f59e0b; display:inline-block;"></span> Pill / Point Shift Vector</span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr));">
                <div style="position:relative; min-height:400px; background:#0b1322; border-right:1px solid ${borderCol};">
                    <div id="cr-geom-diff-map" style="width:100%; height:400px;"></div>
                </div>
                <div style="max-height:400px; overflow-y:auto; padding:10px 12px; display:flex; flex-direction:column; gap:7px;">
                    <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:${textMuted}; padding:2px 2px 4px;">
                        Changed Features (${total}) — Click to Zoom
                    </div>
                    ${allItems.length === 0 ? `<div style="font-size:12.5px; color:${textMuted}; padding:16px 4px;">No feature-level differences recorded.</div>` : allItems.map(it => {
        const c = Array.isArray(it.center) && it.center.length >= 2 ? it.center : null;
        const delta = formatGeomItemDelta(it);
        return `
                            <button type="button" class="cr-geom-item-btn" data-lng="${c ? c[0] : ''}" data-lat="${c ? c[1] : ''}" style="text-align:left; width:100%; padding:9px 10px; border-radius:10px; border:1px solid ${borderCol}; background:${isLight ? '#ffffff' : 'rgba(15,23,42,0.72)'}; color:${textMain}; cursor:pointer; display:flex; flex-direction:column; gap:4px; transition:border-color 0.15s, transform 0.12s;">
                                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
                                    <strong style="font-size:12.5px; line-height:1.25;">${escapeHtml(it.label || it.key)}</strong>
                                    ${badgeFor(it)}
                                </div>
                                <div style="font-size:11.5px; color:${textMuted}; display:flex; align-items:center; justify-content:space-between; gap:6px;">
                                    <span>${escapeHtml(delta)}</span>
                                    ${c ? `<span style="color:#10b981; font-weight:700; font-size:11px;">Zoom →</span>` : ''}
                                </div>
                            </button>
                        `;
    }).join('')}
                </div>
            </div>
        </div>
    `;
}

function mountMapGeomVisualDiffMap(cr) {
    destroyActiveGeomDiffMap();
    const container = document.getElementById('cr-geom-diff-map');
    if (!container || !window.mapboxgl) return;

    const g = getGeomDiffSummary(cr);
    const stationId = String(cr.station_id || PortalState.currentStation || 'lares').toLowerCase();
    const tilePath = stationId === 'lares' ? '/api/tiles/{z}/{x}/{y}.png' : `/api/tiles/${stationId}/{z}/{x}/{y}.png`;
    const defaultCenters = {
        lares: [121.1665, 13.9585],
        qares: [121.3713, 13.9432],
        rares: [121.3393, 14.5750],
        cares: [120.7850, 14.3150]
    };
    const fallbackCenter = defaultCenters[stationId] || defaultCenters.lares;
    const initCenter = g.bbox
        ? [(g.bbox[0] + g.bbox[2]) / 2, (g.bbox[1] + g.bbox[3]) / 2]
        : fallbackCenter;

    const map = new window.mapboxgl.Map({
        container,
        style: {
            version: 8,
            sources: {
                'google-sat': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256, maxzoom: 20 },
                ...(stationId !== 'cares' ? {
                    'station-drone': { type: 'raster', tiles: [tilePath], tileSize: 256, minzoom: 14, maxzoom: 21 }
                } : {})
            },
            layers: [
                { id: 'sat', type: 'raster', source: 'google-sat' },
                ...(stationId !== 'cares' ? [{ id: 'drone', type: 'raster', source: 'station-drone' }] : [])
            ]
        },
        center: initCenter,
        zoom: 18.5
    });
    activeGeomDiffMap = map;
    map.addControl(new window.mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    const beforeFeats = [];
    const afterFeats = [];
    const arrowFeats = [];
    const beforePts = [];
    const afterPts = [];

    g.added.forEach(it => {
        if (it.afterGeometry) {
            afterFeats.push({ type: 'Feature', properties: { label: it.label }, geometry: it.afterGeometry });
        }
        if (it.afterGeometry?.type === 'Point' && Array.isArray(it.center)) {
            afterPts.push({ type: 'Feature', properties: { label: it.label }, geometry: { type: 'Point', coordinates: it.center } });
        }
    });
    g.removed.forEach(it => {
        if (it.beforeGeometry) {
            beforeFeats.push({ type: 'Feature', properties: { label: it.label }, geometry: it.beforeGeometry });
        }
        if (it.beforeGeometry?.type === 'Point' && Array.isArray(it.center)) {
            beforePts.push({ type: 'Feature', properties: { label: it.label }, geometry: { type: 'Point', coordinates: it.center } });
        }
    });
    g.modified.forEach(it => {
        if (it.changeKind === 'pill_moved') {
            if (Array.isArray(it.fromCoord)) {
                beforePts.push({ type: 'Feature', properties: { label: it.label }, geometry: { type: 'Point', coordinates: it.fromCoord } });
            }
            if (Array.isArray(it.toCoord)) {
                afterPts.push({ type: 'Feature', properties: { label: it.label }, geometry: { type: 'Point', coordinates: it.toCoord } });
            }
            if (Array.isArray(it.fromCoord) && Array.isArray(it.toCoord)) {
                arrowFeats.push({
                    type: 'Feature',
                    properties: { label: it.label },
                    geometry: { type: 'LineString', coordinates: [it.fromCoord, it.toCoord] }
                });
            }
            if (it.afterGeometry) {
                afterFeats.push({ type: 'Feature', properties: { label: it.label }, geometry: it.afterGeometry });
            }
        } else {
            if (it.beforeGeometry) beforeFeats.push({ type: 'Feature', properties: { label: it.label }, geometry: it.beforeGeometry });
            if (it.afterGeometry) afterFeats.push({ type: 'Feature', properties: { label: it.label }, geometry: it.afterGeometry });
            if (Array.isArray(it.fromCoord) && Array.isArray(it.toCoord) && it.shiftM >= 0.5) {
                arrowFeats.push({
                    type: 'Feature',
                    properties: { label: it.label },
                    geometry: { type: 'LineString', coordinates: [it.fromCoord, it.toCoord] }
                });
            }
            if (it.beforeGeometry?.type === 'Point' && Array.isArray(it.fromCoord)) {
                beforePts.push({ type: 'Feature', properties: { label: it.label }, geometry: { type: 'Point', coordinates: it.fromCoord } });
            }
            if (it.afterGeometry?.type === 'Point' && Array.isArray(it.toCoord)) {
                afterPts.push({ type: 'Feature', properties: { label: it.label }, geometry: { type: 'Point', coordinates: it.toCoord } });
            }
        }
    });

    const fitAll = () => {
        if (!g.bbox) return;
        const [minX, minY, maxX, maxY] = g.bbox;
        if (Math.abs(maxX - minX) < 0.00015 && Math.abs(maxY - minY) < 0.00015) {
            map.flyTo({ center: [(minX + maxX) / 2, (minY + maxY) / 2], zoom: 19.4, duration: 400 });
        } else {
            map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 56, maxZoom: 19.6, duration: 450 });
        }
    };

    map.on('load', () => {
        if (g.prevGeo && Array.isArray(g.prevGeo.features) && g.prevGeo.features.length > 0) {
            map.addSource('diff-context', { type: 'geojson', data: g.prevGeo });
            map.addLayer({
                id: 'diff-context-line',
                type: 'line',
                source: 'diff-context',
                paint: { 'line-color': '#cbd5e1', 'line-width': 1, 'line-opacity': 0.35 }
            });
        }

        map.addSource('diff-before', { type: 'geojson', data: { type: 'FeatureCollection', features: beforeFeats } });
        map.addSource('diff-after', { type: 'geojson', data: { type: 'FeatureCollection', features: afterFeats } });
        map.addSource('diff-arrows', { type: 'geojson', data: { type: 'FeatureCollection', features: arrowFeats } });
        map.addSource('diff-before-pts', { type: 'geojson', data: { type: 'FeatureCollection', features: beforePts } });
        map.addSource('diff-after-pts', { type: 'geojson', data: { type: 'FeatureCollection', features: afterPts } });

        // Before (Red Dashed)
        map.addLayer({ id: 'diff-before-fill', type: 'fill', source: 'diff-before', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#f43f5e', 'fill-opacity': 0.22 } });
        map.addLayer({ id: 'diff-before-line', type: 'line', source: 'diff-before', paint: { 'line-color': '#f43f5e', 'line-width': 3, 'line-dasharray': [2, 1.5] } });
        map.addLayer({ id: 'diff-before-pt', type: 'circle', source: 'diff-before-pts', paint: { 'circle-radius': 7, 'circle-color': '#f43f5e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });

        // After (Bright Emerald)
        map.addLayer({ id: 'diff-after-fill', type: 'fill', source: 'diff-after', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#10b981', 'fill-opacity': 0.28 } });
        map.addLayer({ id: 'diff-after-line', type: 'line', source: 'diff-after', paint: { 'line-color': '#10b981', 'line-width': 3.5 } });
        map.addLayer({ id: 'diff-after-pt', type: 'circle', source: 'diff-after-pts', paint: { 'circle-radius': 8, 'circle-color': '#10b981', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 } });

        // Shift Vectors (Amber Dashed)
        map.addLayer({ id: 'diff-arrow-line', type: 'line', source: 'diff-arrows', paint: { 'line-color': '#f59e0b', 'line-width': 3, 'line-dasharray': [2, 1.2] } });

        fitAll();
    });

    const setLayerVis = (ids, visible) => {
        const v = visible ? 'visible' : 'none';
        ids.forEach(id => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
        });
    };

    document.querySelectorAll('#cr-geom-mode-tabs [data-geom-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.geomMode;
            document.querySelectorAll('#cr-geom-mode-tabs [data-geom-mode]').forEach(b => b.classList.toggle('active', b.dataset.geomMode === mode));
            setLayerVis(['diff-before-fill', 'diff-before-line', 'diff-before-pt'], mode === 'overlay' || mode === 'before');
            setLayerVis(['diff-after-fill', 'diff-after-line', 'diff-after-pt'], mode === 'overlay' || mode === 'after');
            setLayerVis(['diff-arrow-line'], mode === 'overlay');
        });
    });

    document.getElementById('cr-geom-fit-btn')?.addEventListener('click', fitAll);

    document.querySelectorAll('.cr-geom-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lng = Number(btn.dataset.lng);
            const lat = Number(btn.dataset.lat);
            if (Number.isFinite(lng) && Number.isFinite(lat) && (lng !== 0 || lat !== 0)) {
                map.flyTo({ center: [lng, lat], zoom: 19.7, duration: 500 });
            }
            document.querySelectorAll('.cr-geom-item-btn').forEach(b => { b.style.borderColor = ''; });
            btn.style.borderColor = '#10b981';
        });
    });
}

const STATION_TILE_BOUNDS = {
    lares: [121.165052, 13.956537, 121.173221, 13.963038],
    qares: [121.366888, 13.941220, 121.376150, 13.950966],
    rares: [121.336600, 14.572700, 121.342100, 14.577300]
};

let activeCrSubTab = 'pending'; // 'pending' | 'rejected' | 'approved' | 'published' | 'all'
let crQueueViewMode = getSavedPortalPref('iguide_pref_cr_view', 'cards'); // 'cards' | 'table'
let crQueuePage = 1;
let crQueueLimit = Number(getSavedPortalPref('iguide_pref_cr_limit', 10)) || 10;
let cachedRequests = [];
const revealedCrIdentities = new Map();

function renderCrActorHtml(cr, kind = 'submitted') {
    const id = Number(cr?.id || 0);
    const revealed = revealedCrIdentities.get(id);
    const isRev = kind === 'reviewed';
    const roleLabel = isRev
        ? (cr?.reviewed_by_label || `Station Reviewer - DA ${String(cr?.station_id || PortalState.currentStation || 'lares').toUpperCase()}`)
        : (cr?.submitted_by_label || `GIS Editor - DA ${String(cr?.station_id || PortalState.currentStation || 'lares').toUpperCase()}`);
    const maskedEmail = isRev ? cr?.reviewed_by_masked_email : cr?.submitted_by_masked_email;
    const canReveal = Boolean(cr?.can_reveal_identity && maskedEmail);

    let inner = '';
    if (revealed) {
        const fullName = isRev ? revealed.reviewed_by_name : revealed.submitted_by_name;
        const fullEmail = isRev ? revealed.reviewed_by_email : revealed.submitted_by_email;
        const namePart = fullName ? `<strong style="color:#e2e8f0;">${escapeHtml(fullName)}</strong> ` : '';
        const emailPart = fullEmail ? `<span class="mono-id" style="font-size:11px; color:#7dd3fc;">${escapeHtml(fullEmail)}</span>` : `<strong style="color:#e2e8f0;">${escapeHtml(roleLabel)}</strong>`;
        inner = `${namePart}${emailPart}`;
    } else if (canReveal) {
        inner = `<strong style="color:#e2e8f0;">${escapeHtml(roleLabel)}</strong> <span class="mono-id" style="font-size:11px; opacity:0.85;">(${escapeHtml(maskedEmail)})</span> <button type="button" class="btn btn-secondary btn-xs" style="padding:1px 7px; font-size:10.5px; margin-left:4px; vertical-align:middle;" onclick="promptRevealCrIdentity(${id})">Reveal</button>`;
    } else {
        inner = `<strong style="color:#e2e8f0;">${escapeHtml(roleLabel)}</strong>`;
    }
    return `<span data-cr-actor="${id}:${kind}">${inner}</span>`;
}

window.promptRevealCrIdentity = (crId) => {
    const id = Number(crId);
    const existing = document.getElementById('cr-reveal-pw-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'cr-reveal-pw-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; z-index:99999; background:rgba(2,6,23,0.72); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:16px;';
    overlay.innerHTML = `
        <div role="dialog" aria-modal="true" aria-labelledby="cr-reveal-pw-title" style="width:100%; max-width:420px; background:var(--surface-1, #0f172a); border:1px solid var(--border-subtle, rgba(148,163,184,0.22)); border-radius:14px; padding:20px; box-shadow:0 20px 50px rgba(0,0,0,0.5);">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;">
                <h3 id="cr-reveal-pw-title" style="margin:0; font-size:15px; font-weight:700; color:var(--text-primary, #f8fafc);">Verify Super Admin Password</h3>
                <button type="button" class="btn btn-secondary btn-xs" id="cr-reveal-pw-close" aria-label="Close">✕</button>
            </div>
            <p style="margin:0 0 12px; font-size:12.5px; color:var(--text-secondary, #94a3b8); line-height:1.45;">
                Enter your Super Admin login password to reveal the full name and email for Request #${id}. This access is recorded in the audit log.
            </p>
            <form id="cr-reveal-pw-form" autocomplete="off">
                <input type="password" id="cr-reveal-pw-input" class="form-input" autocomplete="current-password" placeholder="Super Admin login password" required style="width:100%; margin-bottom:8px;">
                <div id="cr-reveal-pw-err" style="display:none; font-size:12px; color:#f43f5e; margin-bottom:10px;"></div>
                <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
                    <button type="button" class="btn btn-secondary btn-sm" id="cr-reveal-pw-cancel">Cancel</button>
                    <button type="submit" class="btn btn-emerald btn-sm" id="cr-reveal-pw-submit">Verify &amp; Reveal</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);

    const close = () => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
    };
    const onKey = (ev) => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
    overlay.querySelector('#cr-reveal-pw-close')?.addEventListener('click', close);
    overlay.querySelector('#cr-reveal-pw-cancel')?.addEventListener('click', close);

    const pwInput = overlay.querySelector('#cr-reveal-pw-input');
    const errEl = overlay.querySelector('#cr-reveal-pw-err');
    const submitBtn = overlay.querySelector('#cr-reveal-pw-submit');
    setTimeout(() => pwInput?.focus(), 20);

    overlay.querySelector('#cr-reveal-pw-form')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const password = String(pwInput?.value || '');
        if (!password) return;
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Verifying...'; }
        try {
            const res = await apiFetch(`/api/admin/change-requests/${id}/reveal-identity`, {
                method: 'POST',
                body: JSON.stringify({ password })
            });
            revealedCrIdentities.set(id, res);
            const crObj = cachedRequests.find(x => Number(x.id) === id) || { id };
            document.querySelectorAll(`[data-cr-actor="${id}:submitted"]`).forEach(el => {
                const wrapper = document.createElement('span');
                wrapper.innerHTML = renderCrActorHtml(crObj, 'submitted');
                el.replaceWith(wrapper.firstElementChild);
            });
            document.querySelectorAll(`[data-cr-actor="${id}:reviewed"]`).forEach(el => {
                const wrapper = document.createElement('span');
                wrapper.innerHTML = renderCrActorHtml(crObj, 'reviewed');
                el.replaceWith(wrapper.firstElementChild);
            });
            close();
            showToast(`Identity revealed for Request #${id} (logged in audit trail).`);
        } catch (err) {
            if (errEl) {
                errEl.textContent = err.message || 'Incorrect password.';
                errEl.style.display = 'block';
            }
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Verify & Reveal'; }
            pwInput?.select();
        }
    });
};
let currentCrContainer = null;
let currentIsReviewerView = false;
let lastOverviewData = null;
let lastOverviewStation = '';
let roBldgSearch = '';
let roBldgCategory = '';
let roOfficeSearch = '';
let roOfficeBldg = '';
let roPlotSearch = '';
let roPlotCycle = '';
let roSlideIndex = 0;
let roOverviewMapMode = '2d'; // '2d' | '3d'

const CATEGORY_LABELS = {
    office: 'Office Building',
    laboratory: 'Laboratory Facility',
    infrastructure: 'Agri Infrastructure / Facility',
    conference: 'Conference / Training Hall',
    orchard: 'Orchard',
    trial_sites: 'Agricultural Test / Trial Site',
    digital_agri: 'Digital Agriculture Project',
    crop: 'Agricultural Crop Plot'
};

const CR_FIELD_LABELS = {
    name: 'Official Name',
    building_num: 'Building Number (#)',
    building_code: 'Building Code / Parent Building',
    type_label: 'Facility Type Label',
    category: 'Directory Category',
    facility_status: 'Public Map Status',
    description: 'Directory Description / Notes',
    visual_landmark: 'How to Spot It (Visual Landmark)',
    visual_guidance: 'How to Spot It (Visual Landmark)',
    key_services: "What's Inside & Services",
    services: "What's Inside & Services",
    pin_color: 'Marker Pin Color',
    color: 'Polygon / Marker Color',
    roof_color: '3D Roof Color',
    pin_icon: 'Directory & Pin Icon',
    icon: 'Plot Marker Icon',
    model_glb_url: '3D Architectural Model (.glb)',
    model_rotation_deg: '3D Bearing Rotation (°)',
    model_rotation: '3D Bearing Rotation',
    model_scale: '3D Model Scale',
    office_name: 'Office / Division / Unit Name',
    floor_or_room: 'Floor',
    room_number: 'Room Number',
    display_order: 'Display Order',
    zone_name: 'Plot / Field Name',
    plot_number: 'Plot Number / Range',
    plot_code: 'Plot Code',
    current_crop: 'Current Planted Crop',
    tree_or_plant_count: 'Tree / Plant Count',
    area_hectares: 'Area (Hectares)',
    cropping_cycle: 'Cropping Cycle',
    cycle_months: 'Cycle Months Label',
    soil_type: 'Soil Type',
    status: 'Status / Field Stage',
    image_webp_url: 'Photo Image (.webp)',
    image_url: 'Photo Image (.webp)',
    images: 'Facility Photos',
    gallery_mode: 'Photo Gallery Mode',
    caption: 'Photo Caption',
    is_primary: 'Primary Cover Photo',
    kiosk_pin_lng: '"You Are Here" Longitude',
    kiosk_pin_lat: '"You Are Here" Latitude',
    marker_lng: 'Marker Longitude',
    marker_lat: 'Marker Latitude',
    center_lng: 'Center Longitude',
    center_lat: 'Center Latitude',
    full_name: 'Official Full Name',
    subtitle: 'Subtitle',
    province: 'Province / Town',
    label: 'Header Badge Label',
    footprint_geojson: 'Building Footprint Geometry',
    polygon_geojson: 'Plot Boundary Geometry',
    coordinates_json: 'Spatial Boundary Coordinates',
    split_plot_number: 'Split Plot Number',
    split_zone_name: 'Split Plot Name',
    split_polygon_geojson: 'Split Child Polygon Geometry',
    updated_parent_plot_number: 'Updated Parent Plot Range',
    updated_parent_polygon_geojson: 'Updated Parent Polygon Geometry',
    merged_plot_number: 'Merged Plot Numbers',
    merged_zone_name: 'Merged Plot Name'
};

function parseJsonSafe(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (_) { return {}; }
}

function normalizeImgSrc(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/')) return s;
    return '/' + s.replace(/^\/+/, '');
}

function humanFieldLabel(key) {
    if (CR_FIELD_LABELS[key]) return CR_FIELD_LABELS[key];
    return String(key || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

// =========================================================================
// SPATIAL GEOMETRY PARSER, METRICS & VECTOR SVG MINI-MAP ENGINE
// =========================================================================
function extractGeoRings(raw) {
    if (!raw) return [];
    let obj = raw;
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return [];
        try { obj = JSON.parse(trimmed); } catch (_) { return []; }
    }
    if (!obj || typeof obj !== 'object') return [];

    const rings = [];
    const visitCoords = (coords) => {
        if (!Array.isArray(coords) || coords.length === 0) return;
        if (typeof coords[0] === 'number' && typeof coords[1] === 'number') return;
        if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number' && typeof coords[0][1] === 'number') {
            const validRing = coords
                .map(pt => [Number(pt[0]), Number(pt[1])])
                .filter(pt => Number.isFinite(pt[0]) && Number.isFinite(pt[1]));
            if (validRing.length >= 3) rings.push(validRing);
            return;
        }
        coords.forEach(visitCoords);
    };

    if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
        obj.features.forEach(f => {
            if (f && f.geometry && f.geometry.coordinates) visitCoords(f.geometry.coordinates);
        });
    } else if (obj.type === 'Feature' && obj.geometry && obj.geometry.coordinates) {
        visitCoords(obj.geometry.coordinates);
    } else if (obj.coordinates) {
        visitCoords(obj.coordinates);
    } else if (Array.isArray(obj)) {
        visitCoords(obj);
    }
    return rings;
}

function extractLineStrings(raw) {
    if (!raw) return [];
    let obj = raw;
    if (typeof raw === 'string') {
        try { obj = JSON.parse(raw); } catch (_) { return []; }
    }
    if (!obj || typeof obj !== 'object') return [];
    const lines = [];
    const visit = (coords) => {
        if (!Array.isArray(coords) || !coords.length) return;
        if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            const pts = coords
                .map(pt => [Number(pt[0]), Number(pt[1])])
                .filter(pt => Number.isFinite(pt[0]) && Number.isFinite(pt[1]));
            if (pts.length >= 2) lines.push(pts);
            return;
        }
        coords.forEach(visit);
    };
    if (obj.coordinates) visit(obj.coordinates);
    else if (obj.geometry && obj.geometry.coordinates) visit(obj.geometry.coordinates);
    else if (Array.isArray(obj)) visit(obj);
    return lines;
}

function computeRingsMetrics(rings) {
    if (!Array.isArray(rings) || !rings.length) {
        return { vertices: 0, areaM2: 0, centroid: null };
    }
    let totalVertices = 0;
    let totalAreaM2 = 0;
    let sumLng = 0;
    let sumLat = 0;
    let ptCount = 0;
    const R = 6378137;

    rings.forEach(ring => {
        if (!Array.isArray(ring) || ring.length < 3) return;
        const closed = (ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]);
        const n = closed ? ring.length - 1 : ring.length;
        totalVertices += Math.max(0, n);
        const refLatRad = (ring[0][1] * Math.PI) / 180;
        const cosLat = Math.cos(refLatRad);

        let shoelace = 0;
        for (let i = 0; i < n; i++) {
            const p1 = ring[i];
            const p2 = ring[(i + 1) % n];
            sumLng += p1[0];
            sumLat += p1[1];
            ptCount++;
            const x1 = ((p1[0] * Math.PI) / 180) * R * cosLat;
            const y1 = ((p1[1] * Math.PI) / 180) * R;
            const x2 = ((p2[0] * Math.PI) / 180) * R * cosLat;
            const y2 = ((p2[1] * Math.PI) / 180) * R;
            shoelace += (x1 * y2 - x2 * y1);
        }
        totalAreaM2 += Math.abs(shoelace) * 0.5;
    });

    return {
        vertices: totalVertices,
        areaM2: totalAreaM2,
        centroid: ptCount > 0 ? [sumLng / ptCount, sumLat / ptCount] : null
    };
}

function distanceMeters(ptA, ptB) {
    if (!ptA || !ptB || !Number.isFinite(ptA[0]) || !Number.isFinite(ptA[1]) || !Number.isFinite(ptB[0]) || !Number.isFinite(ptB[1])) {
        return 0;
    }
    const R = 6378137;
    const dLat = ((ptB[1] - ptA[1]) * Math.PI) / 180;
    const dLng = ((ptB[0] - ptA[0]) * Math.PI) / 180;
    const avgLat = (((ptA[1] + ptB[1]) * 0.5) * Math.PI) / 180;
    const x = dLng * Math.cos(avgLat) * R;
    const y = dLat * R;
    return Math.sqrt(x * x + y * y);
}

function createSpatialProjector(allPoints, width, height, padRatio = 0.14) {
    const valid = (allPoints || []).filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (!valid.length) {
        return {
            project: () => [width * 0.5, height * 0.5],
            ringToPath: () => '',
            hasBounds: false
        };
    }
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    valid.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    });

    const centerLng = (minLng + maxLng) * 0.5;
    const centerLat = (minLat + maxLat) * 0.5;
    const cosLat = Math.cos((centerLat * Math.PI) / 180) || 1;

    let spanX = Math.max((maxLng - minLng) * cosLat, 0.00018);
    let spanY = Math.max(maxLat - minLat, 0.00018);
    const padX = width * padRatio;
    const padY = height * padRatio;
    const drawW = Math.max(16, width - padX * 2);
    const drawH = Math.max(16, height - padY * 2);
    const scale = Math.min(drawW / spanX, drawH / spanY);

    const project = ([lng, lat]) => {
        const dx = (lng - centerLng) * cosLat;
        const dy = lat - centerLat;
        const x = width * 0.5 + dx * scale;
        const y = height * 0.5 - dy * scale;
        return [Number(x.toFixed(2)), Number(y.toFixed(2))];
    };

    const ringToPath = (ring, close = true) => {
        if (!Array.isArray(ring) || ring.length < 2) return '';
        return ring.map((pt, idx) => {
            const [x, y] = project(pt);
            return `${idx === 0 ? 'M' : 'L'}${x},${y}`;
        }).join(' ') + (close ? ' Z' : '');
    };

    return { project, ringToPath, hasBounds: true, centerLng, centerLat };
}

function renderShapeSilhouetteSvg(afterGeomRaw, {
    beforeGeomRaw = null,
    strokeColor = '#34d399',
    fillColor = 'rgba(16,185,129,0.28)',
    width = 58,
    height = 46
} = {}) {
    const afterRings = extractGeoRings(afterGeomRaw);
    const beforeRings = extractGeoRings(beforeGeomRaw);
    const allPts = [];
    afterRings.forEach(r => r.forEach(pt => allPts.push(pt)));
    beforeRings.forEach(r => r.forEach(pt => allPts.push(pt)));

    if (!allPts.length) return '';
    const proj = createSpatialProjector(allPts, width, height, 0.16);
    const beforePaths = beforeRings.map(r => proj.ringToPath(r, true)).filter(Boolean);
    const afterPaths = afterRings.map(r => proj.ringToPath(r, true)).filter(Boolean);

    return `
        <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="display:block;">
            ${beforePaths.length ? beforePaths.map(d => `<path d="${d}" fill="rgba(244,63,94,0.16)" stroke="#f43f5e" stroke-width="1.3" stroke-dasharray="2.5,2"/>`).join('') : ''}
            ${afterPaths.map(d => `<path d="${d}" fill="${escapeHtml(fillColor)}" stroke="${escapeHtml(strokeColor)}" stroke-width="1.6"/>`).join('')}
        </svg>
    `;
}

async function ensureStationOverviewLoaded(stationId) {
    const st = String(stationId || PortalState.currentStation || 'lares').toLowerCase();
    if (lastOverviewData && lastOverviewStation === st) {
        return lastOverviewData;
    }
    try {
        const data = await apiFetch(`/api/review/station-overview?station=${encodeURIComponent(st)}`);
        lastOverviewData = data;
        lastOverviewStation = st;
        return data;
    } catch (_) {
        return lastOverviewData;
    }
}

function findContextEntityForCr(cr, overview) {
    if (!cr || !overview) return { building: null, plot: null };
    const prev = parseJsonSafe(cr.previous_json);
    const next = parseJsonSafe(cr.payload_json);
    const m = { ...prev, ...next };
    const table = String(cr.target_table || '').toLowerCase();
    const buildings = overview.buildings || [];
    const plots = overview.plots || [];

    if (table === 'buildings' || table === 'building_images' || table === 'building_offices') {
        const code = m.building_code || cr.target_id;
        const b = buildings.find(x => x.building_code === String(code) || String(x.id) === String(cr.target_id));
        return { building: b || null, plot: null };
    }
    if (table === 'agricultural_plots' || table === 'plot_subplots') {
        const pCode = m.plot_code || m.parent_plot_code || cr.target_id;
        const p = plots.find(x => String(x.id) === String(cr.target_id) || x.plot_code === String(pCode));
        return { building: null, plot: p || null };
    }
    return { building: null, plot: null };
}

function summarizeGeometryValue(val) {
    const rings = extractGeoRings(val);
    if (rings.length > 0) {
        const { vertices, areaM2 } = computeRingsMetrics(rings);
        const areaStr = areaM2 >= 10000
            ? `${(areaM2 / 10000).toFixed(2)} ha (${Math.round(areaM2).toLocaleString()} m²)`
            : `${Math.round(areaM2).toLocaleString()} m²`;
        return `Mapped Polygon (${vertices} vertices • ~${areaStr})`;
    }
    if (!val) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return str.length > 140 ? `${str.slice(0, 140)}…` : str;
}

function formatDiffFieldValue(key, val) {
    if (val === undefined || val === null || val === '') return '';
    if (['footprint_geojson', 'polygon_geojson', 'coordinates_json', 'split_polygon_geojson', 'updated_parent_polygon_geojson'].includes(key)) {
        return summarizeGeometryValue(val);
    }
    if (key === 'category' && CATEGORY_LABELS[val]) {
        return `${CATEGORY_LABELS[val]} (${val})`;
    }
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
}

function computeWordDiff(pastText, newText) {
    const pStr = String(pastText ?? '');
    const nStr = String(newText ?? '');
    if (pStr === nStr) {
        const esc = escapeHtml(pStr) || '<em style="color:#64748b;">(unchanged / empty)</em>';
        return { pastHtml: esc, changedHtml: esc };
    }
    if (!pStr) {
        return {
            pastHtml: '<em style="color:#fda4af;">(blank / none)</em>',
            changedHtml: `<mark class="diff-word-add">${escapeHtml(nStr)}</mark>`
        };
    }
    if (!nStr) {
        return {
            pastHtml: `<mark class="diff-word-del">${escapeHtml(pStr)}</mark>`,
            changedHtml: '<em style="color:#6ee7b7;">(cleared)</em>'
        };
    }

    const a = pStr.split(/(\s+)/).filter(t => t.length > 0);
    const b = nStr.split(/(\s+)/).filter(t => t.length > 0);
    if (a.length * b.length > 25000) {
        return {
            pastHtml: `<mark class="diff-word-del">${escapeHtml(pStr)}</mark>`,
            changedHtml: `<mark class="diff-word-add">${escapeHtml(nStr)}</mark>`
        };
    }

    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = m - 1; i >= 0; i--) {
        for (let j = n - 1; j >= 0; j--) {
            dp[i][j] = a[i] === b[j]
                ? 1 + dp[i + 1][j + 1]
                : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }

    const pastSegs = [];
    const changedSegs = [];
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
        if (a[i] === b[j]) {
            pastSegs.push({ kind: 'eq', text: a[i] });
            changedSegs.push({ kind: 'eq', text: b[j] });
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            pastSegs.push({ kind: 'del', text: a[i] });
            i++;
        } else {
            changedSegs.push({ kind: 'add', text: b[j] });
            j++;
        }
    }
    while (i < m) pastSegs.push({ kind: 'del', text: a[i++] });
    while (j < n) changedSegs.push({ kind: 'add', text: b[j++] });

    const renderSegs = (segs, markClass) => segs.map(s =>
        s.kind === 'eq' ? escapeHtml(s.text) : `<mark class="${markClass}">${escapeHtml(s.text)}</mark>`
    ).join('');

    return {
        pastHtml: renderSegs(pastSegs, 'diff-word-del'),
        changedHtml: renderSegs(changedSegs, 'diff-word-add')
    };
}

function renderCrStepper(cr) {
    const st = String(cr.status || 'pending').toLowerCase();
    if (st === 'denied') {
        return `<div class="cr-progress-strip" aria-label="Request progress"><span class="cr-progress-step is-done">Draft</span><span class="cr-progress-step is-done">In review</span><span class="cr-progress-step is-revision">Denied (Closed)</span></div>`;
    }
    if (st === 'withdrawn') {
        return `<div class="cr-progress-strip" aria-label="Request progress"><span class="cr-progress-step is-done">Draft</span><span class="cr-progress-step">Withdrawn</span></div>`;
    }
    const steps = [
        { id: 'draft', label: 'Draft' },
        { id: 'pending', label: 'In review' },
        { id: 'rejected', label: 'Needs revision' },
        { id: 'approved', label: 'Approved' },
        { id: 'published', label: 'Published' }
    ];
    const order = { draft: 0, pending: 1, rejected: 2, approved: 3, published: 4, undone: 4 };
    const activeIdx = order[st] ?? 1;

    return `<div class="cr-progress-strip" aria-label="Request progress">${steps.map((s, idx) => {
        let cls = 'cr-progress-step';
        if (st === 'rejected' && s.id === 'rejected') {
            cls += ' is-revision';
        } else if (s.id === st || (st === 'undone' && s.id === 'published')) {
            cls += ' is-current';
        } else if (idx < activeIdx && !(s.id === 'rejected' && st !== 'rejected')) {
            cls += ' is-done';
        }
        return `<span class="${cls}">${s.label}</span>`;
    }).join('')}</div>`;
}

function normalizePhotoListForDiff(arr) {
    return (Array.isArray(arr) ? arr : [])
        .filter(im => im && (im.image_webp_url || im.image_url))
        .map((im, idx) => ({
            index: idx + 1,
            url: String(im.image_webp_url || im.image_url || '').split('?')[0].trim().toLowerCase(),
            rawUrl: String(im.image_webp_url || im.image_url || '').trim(),
            caption: String(im.caption || 'Facility View').trim()
        }));
}

function extractImageCaptionChanges(prevImgs, nextImgs) {
    const beforeList = normalizePhotoListForDiff(prevImgs);
    const afterList = normalizePhotoListForDiff(nextImgs);
    const changes = [];
    const matchedBefore = new Set();

    afterList.forEach((aImg, aIdx) => {
        let bMatchIdx = beforeList.findIndex((b, bi) => !matchedBefore.has(bi) && b.url === aImg.url);
        if (bMatchIdx < 0 && beforeList[aIdx] && !matchedBefore.has(aIdx) && beforeList.length === afterList.length) {
            bMatchIdx = aIdx;
        }
        if (bMatchIdx >= 0) {
            matchedBefore.add(bMatchIdx);
            const bImg = beforeList[bMatchIdx];
            if (bImg.caption !== aImg.caption) {
                changes.push({
                    index: aIdx + 1,
                    beforeIndex: bMatchIdx + 1,
                    url: aImg.rawUrl,
                    beforeCaption: bImg.caption,
                    afterCaption: aImg.caption
                });
            }
        }
    });
    return changes;
}

function normalizeValueForDiff(key, rawVal) {
    if (rawVal === undefined || rawVal === null) return '';
    let s = typeof rawVal === 'object' ? JSON.stringify(rawVal) : String(rawVal).trim();
    if (!s || s === '(blank / none)' || s === 'null' || s === 'undefined') return '';
    // Case-insensitive hex color comparison (#D64550 === #d64550)
    if (['pin_color', 'color', 'roof_color'].includes(key) && /^#[0-9a-f]{3,8}$/i.test(s)) {
        return s.toLowerCase();
    }
    // Strip cache-busting query strings (?v=opt1, ?v=123) from model & image URLs
    if (['model_glb_url', 'model_glb_path', 'glb_path', 'model_url', 'image_webp_url', 'image_url'].includes(key)) {
        return s.split('?')[0].trim().toLowerCase();
    }
    // Normalize numeric equivalence ("1" === 1, "121.16580" === "121.1658")
    if (/^-?\d+(\.\d+)?$/.test(s)) {
        const num = Number(s);
        if (Number.isFinite(num)) return String(num);
    }
    return s;
}

const TECHNICAL_SKIP_KEYS = new Set([
    'id', 'images', 'offices', 'history', 'subPlots', 'submitForReview',
    'saveAsDraft', 'has_geometry', 'has_footprint', 'station_id', 'is_visible',
    'sort_order', 'base64_data', 'created_at', 'updated_at', 'model_exists',
    'review_summary', 'building_code', 'plot_code'
]);

function buildDiffRows(cr) {
    if (String(cr?.target_table || '').toLowerCase() === 'map_geometry') {
        const g = getGeomDiffSummary(cr);
        const fmtList = (arr) => arr.length
            ? arr.slice(0, 6).map(it => `${it.label || it.key} (${formatGeomItemDelta(it)})`).join(', ') + (arr.length > 6 ? ` +${arr.length - 6} more` : '')
            : '(None)';
        const rows = [
            { key: 'editor_type', label: 'Visual Map Editor', beforeVal: g.editorTitle, afterVal: g.editorTitle, changed: false }
        ];
        if (g.addedCount > 0) rows.push({ key: 'added', label: `Added Features (${g.addedCount})`, beforeVal: '(Not on live map)', afterVal: fmtList(g.added), changed: true });
        if (g.modifiedCount > 0) rows.push({ key: 'modified', label: g.editorType === 'pills' ? `Moved Pill Labels (${g.modifiedCount})` : `Modified Features (${g.modifiedCount})`, beforeVal: 'Previous live coordinates', afterVal: fmtList(g.modified), changed: true });
        if (g.removedCount > 0) rows.push({ key: 'removed', label: `Removed Features (${g.removedCount})`, beforeVal: fmtList(g.removed), afterVal: '(Scheduled for removal)', changed: true });
        return rows;
    }

    const prev = parseJsonSafe(cr.previous_json);
    const next = parseJsonSafe(cr.payload_json);
    const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]))
        .filter(k => !TECHNICAL_SKIP_KEYS.has(k) && (next[k] !== undefined || prev[k] !== undefined));

    const rows = keys.map(key => {
        const rawBefore = prev[key];
        const rawAfter = next[key];
        const beforeVal = formatDiffFieldValue(key, rawBefore);
        const afterVal = formatDiffFieldValue(key, rawAfter);
        const normBefore = normalizeValueForDiff(key, rawBefore);
        const normAfter = normalizeValueForDiff(key, rawAfter);
        const changed = cr.action === 'CREATE' || cr.action === 'DELETE'
            ? Boolean(normBefore || normAfter)
            : normBefore !== normAfter;
        return {
            key,
            label: humanFieldLabel(key),
            beforeVal,
            afterVal,
            rawBefore,
            rawAfter,
            changed
        };
    });

    // Compare bundled building gallery photos (images array) when present
    if (Array.isArray(prev.images) || Array.isArray(next.images)) {
        const bImgs = normalizePhotoListForDiff(prev.images);
        const aImgs = normalizePhotoListForDiff(next.images);
        const imgChanged = JSON.stringify(bImgs.map(i => ({ u: i.url, c: i.caption }))) !== JSON.stringify(aImgs.map(i => ({ u: i.url, c: i.caption })));
        if (imgChanged) {
            const captionChanges = extractImageCaptionChanges(prev.images, next.images);
            const fmtList = (list) => list.length
                ? list.map((im, i) => `#${i + 1} "${im.caption}"`).join(', ')
                : '(No photos)';
            rows.push({
                key: 'images',
                label: captionChanges.length > 0 && bImgs.length === aImgs.length && bImgs.every((b, i) => aImgs[i] && b.url === aImgs[i].url)
                    ? 'Photo Caption'
                    : 'Facility Photos',
                beforeVal: fmtList(bImgs),
                afterVal: fmtList(aImgs),
                rawBefore: prev.images || [],
                rawAfter: next.images || [],
                captionChanges,
                changed: true
            });
        }
    }

    return rows.sort((a, b) => Number(b.changed) - Number(a.changed));
}

function renderVisualDiffCardsHtml(rows, action) {
    if (!rows || rows.length === 0) {
        return `<div class="bldg-diff-item" style="text-align:center; color:#94a3b8;">No field differences detected.</div>`;
    }
    return rows.map(d => {
        const isColor = ['pin_color', 'color', 'roof_color'].includes(d.key) && (/^#[0-9a-f]{3,8}$/i.test(d.beforeVal) || /^#[0-9a-f]{3,8}$/i.test(d.afterVal));
        const isImage = ['image_webp_url', 'image_url'].includes(d.key);
        const isGeom = ['footprint_geojson', 'polygon_geojson', 'coordinates_json', 'split_polygon_geojson', 'updated_parent_polygon_geojson'].includes(d.key);

        if (isGeom) {
            const shapeSvg = renderShapeSilhouetteSvg(d.rawAfter || d.rawBefore, {
                beforeGeomRaw: d.rawBefore,
                width: 110,
                height: 76
            });
            return `
                <div class="bldg-diff-item">
                    <div class="bldg-diff-field-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/></svg> ${escapeHtml(d.label)}</div>
                    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                        ${shapeSvg ? `<div style="padding:4px; border-radius:8px; background:rgba(2,6,23,0.88); border:1px solid rgba(52,211,153,0.35);">${shapeSvg}</div>` : ''}
                        <div style="flex:1; min-width:180px; display:flex; flex-direction:column; gap:6px;">
                            <div class="diff-box-past"><span class="diff-line-tag">− PAST</span>${escapeHtml(d.beforeVal || '(No prior geometry)')}</div>
                            <div class="diff-box-changed"><span class="diff-line-tag">+ CHANGED</span>${escapeHtml(d.afterVal || '(Geometry removed)')}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        if (isColor) {
            const pHex = /^#[0-9a-f]{3,8}$/i.test(d.beforeVal) ? d.beforeVal : '#64748b';
            const nHex = /^#[0-9a-f]{3,8}$/i.test(d.afterVal) ? d.afterVal : '#10b981';
            return `
                <div class="bldg-diff-item">
                    <div class="bldg-diff-field-label">${escapeHtml(d.label)}</div>
                    <div class="diff-box-past" style="display:flex; align-items:center; gap:8px;">
                        <span class="diff-line-tag">− PAST</span>
                        ${action === 'CREATE' ? '<em>(New Record)</em>' : `<span style="width:18px; height:18px; border-radius:5px; background:${escapeHtml(pHex)}; border:1px solid rgba(255,255,255,0.3); display:inline-block;"></span><span class="mono-id">${escapeHtml(d.beforeVal || '—')}</span>`}
                    </div>
                    <div class="diff-box-changed" style="display:flex; align-items:center; gap:8px;">
                        <span class="diff-line-tag">+ CHANGED</span>
                        ${action === 'DELETE' ? '<em>(Will Delete)</em>' : `<span style="width:18px; height:18px; border-radius:5px; background:${escapeHtml(nHex)}; border:1px solid rgba(255,255,255,0.3); display:inline-block;"></span><span class="mono-id">${escapeHtml(d.afterVal || '—')}</span>`}
                    </div>
                </div>
            `;
        }

        if (d.key === 'images') {
            const bList = normalizePhotoListForDiff(d.rawBefore);
            const aList = normalizePhotoListForDiff(d.rawAfter);
            const capChanges = Array.isArray(d.captionChanges) ? d.captionChanges : extractImageCaptionChanges(d.rawBefore, d.rawAfter);
            const urlsChanged = bList.length !== aList.length || bList.some((b, i) => !aList[i] || b.url !== aList[i].url);

            const capDiffHtml = capChanges.map(cc => {
                const { pastHtml, changedHtml } = computeWordDiff(cc.beforeCaption, cc.afterCaption);
                const thumbSrc = normalizeImgSrc(cc.url);
                return `
                    <div style="display:flex; align-items:flex-start; gap:10px; margin-bottom:8px;">
                        ${thumbSrc ? `<img src="${escapeHtml(thumbSrc)}" alt="Photo #${cc.index}" style="width:54px; height:40px; object-fit:cover; border-radius:6px; border:1px solid rgba(148,163,184,0.35); flex-shrink:0; margin-top:2px;">` : ''}
                        <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:5px;">
                            <div style="font-size:11px; font-weight:700; color:#94a3b8;">Photo #${cc.index} Caption</div>
                            <div class="diff-box-past"><span class="diff-line-tag">− PAST</span>${pastHtml}</div>
                            <div class="diff-box-changed"><span class="diff-line-tag">+ CHANGED</span>${changedHtml}</div>
                        </div>
                    </div>
                `;
            }).join('');

            const gallerySummaryHtml = urlsChanged ? `
                <div class="diff-box-past" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:${capChanges.length ? '6px' : '0'};">
                    <span class="diff-line-tag">− PAST (${bList.length})</span>
                    ${bList.length
                        ? bList.map(im => `<span style="display:inline-flex; align-items:center; gap:5px; padding:2px 6px 2px 3px; border-radius:6px; background:rgba(15,23,42,0.28); font-size:11px;"><img src="${escapeHtml(normalizeImgSrc(im.rawUrl))}" alt="" style="width:26px; height:20px; object-fit:cover; border-radius:4px;">#${im.index} ${escapeHtml(im.caption)}</span>`).join('')
                        : '<span>(No previous photos)</span>'}
                </div>
                <div class="diff-box-changed" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span class="diff-line-tag">+ CHANGED (${aList.length})</span>
                    ${aList.length
                        ? aList.map(im => `<span style="display:inline-flex; align-items:center; gap:5px; padding:2px 6px 2px 3px; border-radius:6px; background:rgba(15,23,42,0.28); font-size:11px;"><img src="${escapeHtml(normalizeImgSrc(im.rawUrl))}" alt="" style="width:26px; height:20px; object-fit:cover; border-radius:4px;">#${im.index} ${escapeHtml(im.caption)}</span>`).join('')
                        : '<span>(All photos removed)</span>'}
                </div>
            ` : '';

            return `
                <div class="bldg-diff-item">
                    <div class="bldg-diff-field-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg> ${escapeHtml(d.label)}</div>
                    ${capDiffHtml}
                    ${gallerySummaryHtml}
                </div>
            `;
        }

        if (isImage) {
            const pSrc = normalizeImgSrc(d.beforeVal);
            const nSrc = normalizeImgSrc(d.afterVal);
            return `
                <div class="bldg-diff-item">
                    <div class="bldg-diff-field-label"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg> ${escapeHtml(d.label)}</div>
                    <div class="diff-box-past" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <span class="diff-line-tag">− PAST</span>
                        ${pSrc ? `<img src="${escapeHtml(pSrc)}" alt="Past" style="height:64px; width:96px; object-fit:cover; border-radius:6px; border:1px solid rgba(255,255,255,0.2);">` : ''}
                        <span class="mono-code">${escapeHtml(d.beforeVal || '(no previous photo)')}</span>
                    </div>
                    <div class="diff-box-changed" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <span class="diff-line-tag">+ CHANGED</span>
                        ${nSrc ? `<img src="${escapeHtml(nSrc)}" alt="New" style="height:64px; width:96px; object-fit:cover; border-radius:6px; border:1px solid rgba(255,255,255,0.2);">` : ''}
                        <span class="mono-code">${escapeHtml(d.afterVal || '(removed)')}</span>
                    </div>
                </div>
            `;
        }

        const { pastHtml, changedHtml } = computeWordDiff(
            action === 'CREATE' ? '' : d.beforeVal,
            action === 'DELETE' ? '' : d.afterVal
        );
        return `
            <div class="bldg-diff-item">
                <div class="bldg-diff-field-label">${escapeHtml(d.label)}</div>
                <div class="diff-box-past"><span class="diff-line-tag">− PAST</span>${action === 'CREATE' ? '<em style="color:#fda4af;">(New Record)</em>' : pastHtml}</div>
                <div class="diff-box-changed"><span class="diff-line-tag">+ CHANGED</span>${action === 'DELETE' ? '<em style="color:#fda4af;">(Scheduled for Deletion)</em>' : changedHtml}</div>
            </div>
        `;
    }).join('');
}

// =========================================================================
// INTERACTIVE CAMPUS SPATIAL LOCATOR & BEFORE/AFTER GEOMETRY DIFF CANVAS
// =========================================================================
function buildCampusSpatialDiffSpec(cr, overview) {
    const prev = parseJsonSafe(cr.previous_json);
    const next = parseJsonSafe(cr.payload_json);
    const merged = { ...prev, ...next };
    const table = String(cr.target_table || '').toLowerCase();
    const ctx = findContextEntityForCr(cr, overview);

    let beforeGeom = prev.footprint_geojson || prev.polygon_geojson || prev.coordinates_json || null;
    let afterGeom = next.footprint_geojson || next.polygon_geojson || next.coordinates_json || next.updated_parent_polygon_geojson || null;
    let splitChildGeom = next.split_polygon_geojson || null;

    if (!beforeGeom && !afterGeom) {
        if (ctx.building && ctx.building.footprint_geojson) {
            afterGeom = ctx.building.footprint_geojson;
        } else if (ctx.plot && ctx.plot.polygon_geojson) {
            afterGeom = ctx.plot.polygon_geojson;
        }
    }

    const beforeRings = extractGeoRings(beforeGeom);
    const afterRings = extractGeoRings(afterGeom);
    const splitRings = extractGeoRings(splitChildGeom);

    let beforePin = null;
    let afterPin = null;
    if (table === 'stations') {
        if (Number.isFinite(Number(prev.kiosk_pin_lng)) && Number.isFinite(Number(prev.kiosk_pin_lat))) {
            beforePin = [Number(prev.kiosk_pin_lng), Number(prev.kiosk_pin_lat)];
        }
        const st = overview?.station || {};
        const aLng = Number(next.kiosk_pin_lng ?? st.kiosk_pin_lng);
        const aLat = Number(next.kiosk_pin_lat ?? st.kiosk_pin_lat);
        if (Number.isFinite(aLng) && Number.isFinite(aLat)) afterPin = [aLng, aLat];
    } else {
        const bLng = Number(prev.marker_lng ?? prev.center_lng);
        const bLat = Number(prev.marker_lat ?? prev.center_lat);
        if (Number.isFinite(bLng) && Number.isFinite(bLat)) beforePin = [bLng, bLat];

        const aLng = Number(next.marker_lng ?? next.center_lng ?? ctx.building?.marker_lng ?? ctx.plot?.center_lng);
        const aLat = Number(next.marker_lat ?? next.center_lat ?? ctx.building?.marker_lat ?? ctx.plot?.center_lat);
        if (Number.isFinite(aLng) && Number.isFinite(aLat)) afterPin = [aLng, aLat];
    }

    const beforeMetrics = computeRingsMetrics(beforeRings);
    const afterMetrics = computeRingsMetrics(afterRings);
    const splitMetrics = computeRingsMetrics(splitRings);

    const geomChanged = hasGeometryActuallyChanged(prev, next, cr.action) || splitRings.length > 0;

    const targetLabel = merged.name || merged.zone_name || merged.office_name || ctx.building?.name || ctx.plot?.zone_name || cr.target_id || 'Target Entity';
    const targetColor = merged.pin_color || merged.color || ctx.building?.pin_color || ctx.plot?.color || '#10b981';

    return {
        beforeRings,
        afterRings,
        splitRings,
        beforePin,
        afterPin,
        beforeMetrics,
        afterMetrics,
        splitMetrics,
        geomChanged,
        targetLabel,
        targetColor,
        ctx
    };
}

function renderSpatialContextMapHtml({
    stageId,
    overview,
    targetBuildingCode = null,
    targetPlotId = null,
    diffSpec = null,
    compact = true
}) {
    const buildings = overview?.buildings || [];
    const plots = overview?.plots || [];
    const roads = overview?.roads || [];
    const st = overview?.station || {};
    const W = 720;
    const H = compact ? 235 : 410;

    const campusPts = [];
    const targetPts = [];

    roads.forEach(r => {
        extractLineStrings(r.geometry_geojson).forEach(line => line.forEach(pt => campusPts.push(pt)));
    });
    plots.forEach(p => {
        const rings = extractGeoRings(p.polygon_geojson);
        rings.forEach(ring => ring.forEach(pt => {
            campusPts.push(pt);
            if (targetPlotId !== null && Number(p.id) === Number(targetPlotId)) targetPts.push(pt);
        }));
    });
    buildings.forEach(b => {
        const rings = extractGeoRings(b.footprint_geojson);
        rings.forEach(ring => ring.forEach(pt => {
            campusPts.push(pt);
            if (targetBuildingCode && b.building_code === targetBuildingCode) targetPts.push(pt);
        }));
        if (Number.isFinite(Number(b.marker_lng)) && Number.isFinite(Number(b.marker_lat))) {
            const pt = [Number(b.marker_lng), Number(b.marker_lat)];
            campusPts.push(pt);
            if (targetBuildingCode && b.building_code === targetBuildingCode) targetPts.push(pt);
        }
    });

    if (diffSpec) {
        diffSpec.beforeRings.forEach(r => r.forEach(pt => { campusPts.push(pt); targetPts.push(pt); }));
        diffSpec.afterRings.forEach(r => r.forEach(pt => { campusPts.push(pt); targetPts.push(pt); }));
        diffSpec.splitRings.forEach(r => r.forEach(pt => { campusPts.push(pt); targetPts.push(pt); }));
        if (diffSpec.beforePin) { campusPts.push(diffSpec.beforePin); targetPts.push(diffSpec.beforePin); }
        if (diffSpec.afterPin) { campusPts.push(diffSpec.afterPin); targetPts.push(diffSpec.afterPin); }
    }

    const focusPts = targetPts.length >= 3 ? targetPts : campusPts;
    const proj = createSpatialProjector(campusPts.length ? campusPts : focusPts, W, H, 0.10);

    // Compute target focus bounding box in projected SVG coordinates for auto-zoom around the target
    let initViewBox = `0 0 ${W} ${H}`;
    if (targetPts.length > 0 && proj.hasBounds) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        targetPts.forEach(pt => {
            const [x, y] = proj.project(pt);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        });
        const cx = (minX + maxX) * 0.5;
        const cy = (minY + maxY) * 0.5;
        const spanW = Math.max(maxX - minX, 75) * 2.5;
        const spanH = Math.max(maxY - minY, 55) * 2.5;
        const aspect = W / H;
        let vw = Math.min(W, Math.max(spanW, spanH * aspect));
        let vh = vw / aspect;
        const vx = Math.max(0, Math.min(W - vw, cx - vw * 0.5));
        const vy = Math.max(0, Math.min(H - vh, cy - vh * 0.5));
        initViewBox = `${vx.toFixed(1)} ${vy.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`;
    }

    const roadSvg = roads.map(r => {
        const lines = extractLineStrings(r.geometry_geojson);
        return lines.map(line => {
            const d = proj.ringToPath(line, false);
            return d ? `<path d="${d}" fill="none" stroke="rgba(148,163,184,0.28)" stroke-width="1.8" stroke-linecap="round"/>` : '';
        }).join('');
    }).join('');

    const plotSvg = plots.map(p => {
        const isTarget = targetPlotId !== null && Number(p.id) === Number(targetPlotId);
        const rings = extractGeoRings(p.polygon_geojson);
        const color = p.color || '#10b981';
        return rings.map(ring => {
            const d = proj.ringToPath(ring, true);
            if (!d) return '';
            return `<path d="${d}" fill="${isTarget ? `${escapeHtml(color)}55` : 'rgba(16,185,129,0.08)'}" stroke="${isTarget ? escapeHtml(color) : 'rgba(52,211,153,0.22)'}" stroke-width="${isTarget ? '2.2' : '0.9'}"/>`;
        }).join('');
    }).join('');

    const bldgSvg = buildings.map(b => {
        const isTarget = targetBuildingCode && b.building_code === targetBuildingCode;
        const rings = extractGeoRings(b.footprint_geojson);
        const color = b.pin_color || '#38bdf8';
        return rings.map(ring => {
            const d = proj.ringToPath(ring, true);
            if (!d) return '';
            return `<path d="${d}" fill="${isTarget ? `${escapeHtml(color)}66` : 'rgba(148,163,184,0.16)'}" stroke="${isTarget ? '#38bdf8' : 'rgba(203,213,225,0.34)'}" stroke-width="${isTarget ? '2.2' : '0.9'}"/>`;
        }).join('');
    }).join('');

    let diffOverlaySvg = '';
    let metricsHtml = '';

    if (diffSpec) {
        const beforePaths = diffSpec.beforeRings.map(r => proj.ringToPath(r, true)).filter(Boolean);
        const afterPaths = diffSpec.afterRings.map(r => proj.ringToPath(r, true)).filter(Boolean);
        const splitPaths = diffSpec.splitRings.map(r => proj.ringToPath(r, true)).filter(Boolean);

        diffOverlaySvg += beforePaths.map(d =>
            `<path d="${d}" fill="rgba(244,63,94,0.20)" stroke="#f43f5e" stroke-width="2.2" stroke-dasharray="5,3"/>`
        ).join('');

        diffOverlaySvg += afterPaths.map(d =>
            `<path d="${d}" fill="rgba(16,185,129,0.34)" stroke="#10b981" stroke-width="2.4"/>`
        ).join('');

        diffOverlaySvg += splitPaths.map(d =>
            `<path d="${d}" fill="rgba(14,165,233,0.36)" stroke="#38bdf8" stroke-width="2.4"/>`
        ).join('');

        const pinPt = diffSpec.afterPin || diffSpec.afterMetrics.centroid || diffSpec.beforePin || diffSpec.beforeMetrics.centroid;
        if (diffSpec.beforePin && diffSpec.afterPin && distanceMeters(diffSpec.beforePin, diffSpec.afterPin) > 0.3) {
            const [bx, by] = proj.project(diffSpec.beforePin);
            const [ax, ay] = proj.project(diffSpec.afterPin);
            diffOverlaySvg += `
                <line x1="${bx}" y1="${by}" x2="${ax}" y2="${ay}" stroke="#fbbf24" stroke-width="1.8" stroke-dasharray="3,2"/>
                <circle cx="${bx}" cy="${by}" r="5" fill="#f43f5e" stroke="#fff" stroke-width="1.3"/>
                <circle cx="${ax}" cy="${ay}" r="6" fill="#10b981" stroke="#fff" stroke-width="1.6"/>
            `;
        } else if (pinPt) {
            const [px, py] = proj.project(pinPt);
            diffOverlaySvg += `
                <circle cx="${px}" cy="${py}" r="11" fill="none" stroke="#34d399" stroke-width="1.4" opacity="0.65"/>
                <circle cx="${px}" cy="${py}" r="5.5" fill="#10b981" stroke="#ffffff" stroke-width="1.6"/>
            `;
        }

        const areaM2 = diffSpec.afterMetrics.areaM2 || diffSpec.beforeMetrics.areaM2;
        const verts = diffSpec.afterMetrics.vertices || diffSpec.beforeMetrics.vertices;
        const shiftM = (diffSpec.beforeMetrics.centroid && diffSpec.afterMetrics.centroid)
            ? distanceMeters(diffSpec.beforeMetrics.centroid, diffSpec.afterMetrics.centroid)
            : ((diffSpec.beforePin && diffSpec.afterPin) ? distanceMeters(diffSpec.beforePin, diffSpec.afterPin) : 0);

        metricsHtml = `
            <div class="rv-spatial-metrics-bar">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span style="color:#f8fafc; font-weight:700; display:inline-flex; align-items:center; gap:5px;">${SVG_ICONS.pin} ${escapeHtml(diffSpec.targetLabel)}</span>
                    ${diffSpec.geomChanged
                ? `<span class="status-pill status-pill-live" style="font-size:10px;">Spatial Geometry Modified</span>`
                : `<span class="status-pill status-pill-blue" style="font-size:10px;">Location Unchanged</span>`}
                </div>
                ${diffSpec.geomChanged ? `
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-family:var(--font-mono); font-size:11px;">
                    ${verts ? `<span>Vertices: <strong style="color:#f8fafc;">${verts}</strong></span>` : ''}
                    ${areaM2 > 0 ? `<span>Area: <strong style="color:#6ee7b7;">${Math.round(areaM2).toLocaleString()} m² (${(areaM2 / 10000).toFixed(2)} ha)</strong></span>` : ''}
                    ${shiftM > 0.3 ? `<span>Shift: <strong style="color:#fbbf24;">${shiftM.toFixed(1)} m</strong></span>` : ''}
                </div>` : ''}
            </div>
        `;
    }

    const kioskLng = Number(st.kiosk_pin_lng);
    const kioskLat = Number(st.kiosk_pin_lat);
    let kioskPinSvg = '';
    if (Number.isFinite(kioskLng) && Number.isFinite(kioskLat) && proj.hasBounds) {
        const [kx, ky] = proj.project([kioskLng, kioskLat]);
        kioskPinSvg = `
            <g>
                <circle cx="${kx}" cy="${ky}" r="4.5" fill="#f59e0b" stroke="#fff" stroke-width="1.2"/>
            </g>
        `;
    }

    // Save geographic spec so bindSpatialSvgPanZoom can mount a live Mapbox GL Aerial Drone Mini-Map
    spatialAerialSpecs.set(stageId, {
        stationId: String(st.station_id || st.id || PortalState.currentStation || 'lares').toLowerCase(),
        buildings,
        plots,
        kiosk: (Number.isFinite(kioskLng) && Number.isFinite(kioskLat)) ? [kioskLng, kioskLat] : null,
        targetPts,
        campusPts,
        targetBuildingCode,
        targetPlotId,
        diffSpec
    });

    const icMap = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>';
    const icPlus = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
    const icMinus = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>';
    const icTarget = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';

    return `
        <div class="rv-spatial-canvas-wrap" id="${escapeHtml(stageId)}-wrap" data-full-vb="0 0 ${W} ${H}" data-focus-vb="${initViewBox}">
            <div class="rv-spatial-toolbar">
                <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:11px;">
                    <strong style="display:inline-flex; align-items:center; gap:5px; color:#7dd3fc; text-transform:uppercase; letter-spacing:0.05em;">${icMap} Aerial Campus Locator</strong>
                    <span style="display:inline-flex; align-items:center; gap:4px; color:#fbbf24;"><span style="width:8px; height:8px; border-radius:999px; background:#f59e0b; border:1px solid #fff; display:inline-block;"></span>Kiosk</span>
                    <span style="display:inline-flex; align-items:center; gap:4px; color:#6ee7b7;"><span style="width:10px; height:3px; background:#10b981; display:inline-block;"></span>Target / After</span>
                    ${diffSpec && diffSpec.geomChanged ? `<span style="display:inline-flex; align-items:center; gap:4px; color:#fda4af;"><span style="width:10px; height:3px; background:#f43f5e; display:inline-block;"></span>Before</span>` : ''}
                    ${diffSpec && diffSpec.splitRings.length ? `<span style="display:inline-flex; align-items:center; gap:4px; color:#7dd3fc;"><span style="width:10px; height:3px; background:#38bdf8; display:inline-block;"></span>Split Plot</span>` : ''}
                </div>
                <div class="rv-spatial-zoom-btns">
                    <button type="button" class="rv-zoom-btn" data-rv-act="zoom-in" title="Zoom In">${icPlus}</button>
                    <button type="button" class="rv-zoom-btn" data-rv-act="zoom-out" title="Zoom Out">${icMinus}</button>
                    <button type="button" class="rv-zoom-btn" data-rv-act="fit-target" title="Focus on Target">${icTarget} Target</button>
                    <button type="button" class="rv-zoom-btn" data-rv-act="fit-all" title="Show Full Station">${icMap} Full Station</button>
                </div>
            </div>
            <div class="rv-spatial-svg-stage ${compact ? 'compact' : ''}" id="${escapeHtml(stageId)}-stage">
                <svg class="rv-spatial-svg" id="${escapeHtml(stageId)}-svg" viewBox="${initViewBox}" preserveAspectRatio="xMidYMid meet">
                    ${roadSvg}
                    ${plotSvg}
                    ${bldgSvg}
                    ${kioskPinSvg}
                    ${diffOverlaySvg}
                </svg>
            </div>
            ${metricsHtml}
        </div>
    `;
}

function computeLngLatBounds(pts) {
    if (!pts || !pts.length) return null;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const p of pts) {
        if (!Array.isArray(p) || p.length < 2) continue;
        const lng = Number(p[0]), lat = Number(p[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    }
    if (!Number.isFinite(minLng)) return null;
    // Pad point-only bounds so fitBounds never collapses to a single point
    if (Math.abs(maxLng - minLng) < 0.00025) { minLng -= 0.00035; maxLng += 0.00035; }
    if (Math.abs(maxLat - minLat) < 0.00025) { minLat -= 0.00035; maxLat += 0.00035; }
    return [[minLng, minLat], [maxLng, maxLat]];
}

function mountAerialLocatorMap(stageId, wrap, stage, svg) {
    if (typeof mapboxgl === 'undefined' || !MAPBOX_ACCESS_TOKEN) return false;
    const spec = spatialAerialSpecs.get(stageId);
    if (!spec) return false;

    const campusBounds = computeLngLatBounds(spec.campusPts);
    const targetBounds = computeLngLatBounds(spec.targetPts) || campusBounds;
    if (!campusBounds) return false;

    try {
        const prevMap = spatialAerialMaps.get(stageId);
        if (prevMap) {
            try { prevMap.remove(); } catch (_) { }
            spatialAerialMaps.delete(stageId);
        }

        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
        const hostId = `${stageId}-aerial-host`;
        let host = document.getElementById(hostId);
        if (!host) {
            host = document.createElement('div');
            host.id = hostId;
            host.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; z-index:2;';
            stage.style.position = 'relative';
            stage.appendChild(host);
        }
        svg.style.display = 'none';

        const initCenter = [
            (targetBounds[0][0] + targetBounds[1][0]) / 2,
            (targetBounds[0][1] + targetBounds[1][1]) / 2
        ];

        const mbMap = new mapboxgl.Map({
            container: host,
            style: 'mapbox://styles/mapbox/satellite-streets-v12',
            center: initCenter,
            zoom: 18.2,
            pitch: 0,
            bearing: 0,
            attributionControl: false,
            interactive: true
        });
        spatialAerialMaps.set(stageId, mbMap);

        mbMap.on('load', () => {
            // 1. Mount station local aerial drone orthophoto layer
            const tileBounds = STATION_TILE_BOUNDS[spec.stationId];
            if (tileBounds) {
                try {
                    mbMap.addSource('aerial-drone-ortho', {
                        type: 'raster',
                        tiles: [`/api/tiles/${spec.stationId}/{z}/{x}/{y}.png`],
                        tileSize: 256,
                        minzoom: 14,
                        maxzoom: 21,
                        bounds: tileBounds
                    });
                    mbMap.addLayer({
                        id: 'aerial-drone-ortho-layer',
                        type: 'raster',
                        source: 'aerial-drone-ortho',
                        paint: { 'raster-opacity': 1 }
                    });
                } catch (_) { }
            }

            // 2. Surrounding campus footprints + landmark labels
            const polyFeatures = [];
            const labelFeatures = [];

            (spec.plots || []).forEach(p => {
                const isTarget = spec.targetPlotId !== null && Number(p.id) === Number(spec.targetPlotId);
                extractGeoRings(p.polygon_geojson).forEach(ring => {
                    if (ring.length >= 3) {
                        const closed = [...ring, ring[0]];
                        polyFeatures.push({
                            type: 'Feature',
                            properties: { kind: isTarget ? 'target' : 'plot', label: p.zone_name || '' },
                            geometry: { type: 'Polygon', coordinates: [closed] }
                        });
                    }
                });
                const lng = Number(p.center_lng), lat = Number(p.center_lat);
                if (Number.isFinite(lng) && Number.isFinite(lat) && p.zone_name) {
                    labelFeatures.push({
                        type: 'Feature',
                        properties: { label: p.zone_name, isTarget: isTarget ? 1 : 0 },
                        geometry: { type: 'Point', coordinates: [lng, lat] }
                    });
                }
            });

            (spec.buildings || []).forEach(b => {
                const isTarget = Boolean(spec.targetBuildingCode && b.building_code === spec.targetBuildingCode);
                extractGeoRings(b.footprint_geojson).forEach(ring => {
                    if (ring.length >= 3) {
                        const closed = [...ring, ring[0]];
                        polyFeatures.push({
                            type: 'Feature',
                            properties: { kind: isTarget ? 'target' : 'building', label: b.name || '' },
                            geometry: { type: 'Polygon', coordinates: [closed] }
                        });
                    }
                });
                const lng = Number(b.marker_lng), lat = Number(b.marker_lat);
                if (Number.isFinite(lng) && Number.isFinite(lat) && b.name) {
                    labelFeatures.push({
                        type: 'Feature',
                        properties: { label: b.name, isTarget: isTarget ? 1 : 0 },
                        geometry: { type: 'Point', coordinates: [lng, lat] }
                    });
                }
            });

            // Overlay Before/After diff polygons if present
            if (spec.diffSpec) {
                (spec.diffSpec.beforeRings || []).forEach(ring => {
                    if (ring.length >= 3) {
                        polyFeatures.push({
                            type: 'Feature',
                            properties: { kind: 'before' },
                            geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] }
                        });
                    }
                });
                (spec.diffSpec.afterRings || []).forEach(ring => {
                    if (ring.length >= 3) {
                        polyFeatures.push({
                            type: 'Feature',
                            properties: { kind: 'target' },
                            geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] }
                        });
                    }
                });
            }

            mbMap.addSource('locator-polys', { type: 'geojson', data: { type: 'FeatureCollection', features: polyFeatures } });
            mbMap.addLayer({
                id: 'locator-context-fill',
                type: 'fill',
                source: 'locator-polys',
                filter: ['in', ['get', 'kind'], ['literal', ['building', 'plot']]],
                paint: { 'fill-color': ['match', ['get', 'kind'], 'plot', '#10b981', '#e2e8f0'], 'fill-opacity': 0.14 }
            });
            mbMap.addLayer({
                id: 'locator-context-line',
                type: 'line',
                source: 'locator-polys',
                filter: ['in', ['get', 'kind'], ['literal', ['building', 'plot']]],
                paint: { 'line-color': 'rgba(255,255,255,0.45)', 'line-width': 1 }
            });
            mbMap.addLayer({
                id: 'locator-before-line',
                type: 'line',
                source: 'locator-polys',
                filter: ['==', ['get', 'kind'], 'before'],
                paint: { 'line-color': '#f43f5e', 'line-width': 2.5, 'line-dasharray': [2, 1.5] }
            });
            mbMap.addLayer({
                id: 'locator-target-fill',
                type: 'fill',
                source: 'locator-polys',
                filter: ['==', ['get', 'kind'], 'target'],
                paint: { 'fill-color': '#10b981', 'fill-opacity': 0.36 }
            });
            mbMap.addLayer({
                id: 'locator-target-line',
                type: 'line',
                source: 'locator-polys',
                filter: ['==', ['get', 'kind'], 'target'],
                paint: { 'line-color': '#34d399', 'line-width': 3 }
            });

            mbMap.addSource('locator-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: labelFeatures } });
            mbMap.addLayer({
                id: 'locator-landmark-labels',
                type: 'symbol',
                source: 'locator-labels',
                layout: {
                    'text-field': ['get', 'label'],
                    'text-size': ['case', ['==', ['get', 'isTarget'], 1], 12.5, 10],
                    'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                    'text-allow-overlap': ['case', ['==', ['get', 'isTarget'], 1], true, false],
                    'text-padding': 4
                },
                paint: {
                    'text-color': ['case', ['==', ['get', 'isTarget'], 1], '#6ee7b7', '#f8fafc'],
                    'text-halo-color': 'rgba(2, 6, 23, 0.92)',
                    'text-halo-width': 1.8
                }
            });

            // 3. Kiosk Reference Pin ("You Are Here")
            if (spec.kiosk) {
                const kEl = document.createElement('div');
                kEl.style.cssText = 'display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:999px; background:rgba(15,23,42,0.92); border:1.5px solid #f59e0b; color:#fbbf24; font-size:9.5px; font-weight:800; letter-spacing:0.04em; box-shadow:0 3px 10px rgba(0,0,0,0.55); white-space:nowrap;';
                kEl.innerHTML = '<span style="width:7px;height:7px;border-radius:999px;background:#f59e0b;display:inline-block;"></span>KIOSK';
                new mapboxgl.Marker({ element: kEl, anchor: 'center' }).setLngLat(spec.kiosk).addTo(mbMap);
            }

            // 4. Target glowing pin
            const targetPin = (spec.diffSpec && (spec.diffSpec.afterPin || spec.diffSpec.beforePin)) || initCenter;
            if (targetPin) {
                const tEl = document.createElement('div');
                tEl.style.cssText = 'width:18px; height:18px; border-radius:999px; background:#10b981; border:3px solid #ffffff; box-shadow:0 0 0 6px rgba(16,185,129,0.35), 0 4px 12px rgba(0,0,0,0.6);';
                new mapboxgl.Marker({ element: tEl, anchor: 'center' }).setLngLat(targetPin).addTo(mbMap);
            }

            mbMap.fitBounds(targetBounds, { padding: 55, maxZoom: 18.8, duration: 0 });
        });

        wrap.querySelectorAll('[data-rv-act]').forEach(btn => {
            btn.addEventListener('click', () => {
                const act = btn.dataset.rvAct;
                if (act === 'zoom-in') mbMap.zoomIn({ duration: 250 });
                else if (act === 'zoom-out') mbMap.zoomOut({ duration: 250 });
                else if (act === 'fit-target') mbMap.fitBounds(targetBounds, { padding: 55, maxZoom: 18.8, duration: 450 });
                else if (act === 'fit-all') mbMap.fitBounds(campusBounds, { padding: 28, maxZoom: 17.2, duration: 450 });
            });
        });

        return true;
    } catch (err) {
        console.warn('Aerial locator fallback to SVG:', err);
        svg.style.display = '';
        return false;
    }
}

function bindSpatialSvgPanZoom(stageId) {
    const wrap = document.getElementById(`${stageId}-wrap`);
    const stage = document.getElementById(`${stageId}-stage`);
    const svg = document.getElementById(`${stageId}-svg`);
    if (!wrap || !stage || !svg) return;

    if (mountAerialLocatorMap(stageId, wrap, stage, svg)) return;

    const fullVbStr = wrap.dataset.fullVb || '0 0 720 410';
    const focusVbStr = wrap.dataset.focusVb || fullVbStr;
    const parseVb = (s) => s.split(/\s+/).map(Number);
    let [vx, vy, vw, vh] = parseVb(svg.getAttribute('viewBox') || focusVbStr);
    const [, , maxW, maxH] = parseVb(fullVbStr);

    const applyVb = () => {
        vw = Math.max(45, Math.min(maxW * 1.15, vw));
        vh = Math.max(30, Math.min(maxH * 1.15, vh));
        svg.setAttribute('viewBox', `${vx.toFixed(2)} ${vy.toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`);
    };

    const zoomBy = (factor) => {
        const cx = vx + vw * 0.5;
        const cy = vy + vh * 0.5;
        vw *= factor;
        vh *= factor;
        vx = cx - vw * 0.5;
        vy = cy - vh * 0.5;
        applyVb();
    };

    wrap.querySelectorAll('[data-rv-act]').forEach(btn => {
        btn.addEventListener('click', () => {
            const act = btn.dataset.rvAct;
            if (act === 'zoom-in') zoomBy(0.75);
            else if (act === 'zoom-out') zoomBy(1.33);
            else if (act === 'fit-target') {
                [vx, vy, vw, vh] = parseVb(focusVbStr);
                applyVb();
            } else if (act === 'fit-all') {
                [vx, vy, vw, vh] = parseVb(fullVbStr);
                applyVb();
            }
        });
    });

    stage.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomBy(e.deltaY < 0 ? 0.84 : 1.19);
    }, { passive: false });

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startVx = 0;
    let startVy = 0;

    stage.addEventListener('pointerdown', (e) => {
        if (e.target.closest('[data-map-click]')) return;
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startVx = vx;
        startVy = vy;
        stage.setPointerCapture?.(e.pointerId);
    });
    stage.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dx = ((e.clientX - startX) / rect.width) * vw;
        const dy = ((e.clientY - startY) / rect.height) * vh;
        vx = startVx - dx;
        vy = startVy - dy;
        applyVb();
    });
    const stopDrag = () => { dragging = false; };
    stage.addEventListener('pointerup', stopDrag);
    stage.addEventListener('pointercancel', stopDrag);
}

// =========================================================================
// VISITOR MAP DRAWER PREVIEW REPLICA (SUPPORTS BEFORE, AFTER, SIDE-BY-SIDE)
// =========================================================================

window.openCrPhotoLightbox = (src, title = 'Facility Photo', badge = '') => {
    if (!src) return;
    const existing = document.getElementById('cr-photo-lightbox');
    if (existing) existing.remove();
    const lb = document.createElement('div');
    lb.id = 'cr-photo-lightbox';
    lb.className = 'bldg-cropper-backdrop';
    lb.style.zIndex = '99999';
    const isLight = document.body.dataset.theme === 'light';
    const lbBg = isLight ? '#ffffff' : '#07111a';
    const lbHeaderBg = isLight ? '#f8fafc' : 'rgba(9,16,28,0.92)';
    const lbTitleColor = isLight ? '#0f172a' : '#f8fafc';
    lb.innerHTML = `
        <div style="width:100%; max-width:900px; background:${lbBg}; border:1px solid rgba(52,211,153,0.38); border-radius:16px; overflow:hidden; box-shadow:0 28px 70px rgba(0,0,0,${isLight ? '0.25' : '0.85'});">
            <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(148,163,184,0.16); background:${lbHeaderBg};">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${badge ? `<span class="status-pill ${badge.toLowerCase().includes('before') ? 'status-pill-blue' : 'status-pill-live'}" style="font-size:10px;">${escapeHtml(badge)}</span>` : ''}
                    <strong style="color:${lbTitleColor}; font-size:13.5px;">${escapeHtml(title)}</strong>
                </div>
                <button type="button" id="cr-lb-close" class="overseer-role-modal-x" aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>
            <div style="background:#020617; display:flex; align-items:center; justify-content:center; min-height:340px; max-height:74vh;">
                <img src="${escapeHtml(src)}" alt="${escapeHtml(title)}" style="max-width:100%; max-height:74vh; object-fit:contain; display:block;">
            </div>
        </div>
    `;
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.remove(); });
    document.body.appendChild(lb);
    document.getElementById('cr-lb-close')?.addEventListener('click', () => lb.remove());
};

function renderEntityVisitorCardHtml(cr, recordData, badgeText = '', opts = {}) {
    const m = recordData || {};
    const table = String(cr.target_table || '').toLowerCase();
    const ctx = findContextEntityForCr(cr, lastOverviewData);
    const isAfter = Boolean(opts.isAfter);
    const changedKeys = opts.changedKeys instanceof Set ? opts.changedKeys : new Set();
    const beforeData = opts.beforeData || {};
    const afterData = opts.afterData || {};

    const hasChanged = (...keys) => keys.some(k => changedKeys.has(k));
    const updTag = (show) => {
        if (!show) return '';
        return isAfter
            ? '<span class="cr-inline-upd-pill">+ Updated</span>'
            : '<span class="cr-inline-rem-pill">− Changed</span>';
    };
    const updCls = (show) => {
        if (!show) return '';
        return isAfter ? ' cr-field-updated' : ' cr-field-removed';
    };
    const renderHighlightedText = (key, text) => {
        const val = String(text || '');
        if (!hasChanged(key)) return escapeHtml(val);
        const prevTxt = String(beforeData[key] || '');
        const nextTxt = String(afterData[key] || '');
        if (isAfter) {
            if (!prevTxt) return `<span class="cr-word-ins">${escapeHtml(val)}</span>`;
            try {
                const wd = computeWordDiff(prevTxt, val);
                return wd.changedHtml || escapeHtml(val);
            } catch (_) {
                return escapeHtml(val);
            }
        } else {
            if (!nextTxt) return `<span class="cr-word-del">${escapeHtml(val)}</span>`;
            try {
                const wd = computeWordDiff(val, nextTxt);
                return wd.pastHtml || escapeHtml(val);
            } catch (_) {
                return escapeHtml(val);
            }
        }
    };

    const isBeforeLabel = badgeText.toLowerCase().includes('before');
    const headerPill = badgeText
        ? `<div class="cr-compare-header-pill ${isBeforeLabel ? 'before' : 'after'}"><span>${escapeHtml(badgeText)}</span></div>`
        : '';

    if (table === 'building_images') {
        const b = ctx.building || {};
        const pinColor = b.pin_color || b.color || '#10b981';
        const bNum = b.building_num ?? '•';
        const bName = b.name || m.building_code || cr.target_id || 'Building Facility';
        const existingImgs = Array.isArray(b.images) ? b.images : [];
        const existingPrimary = existingImgs.find(im => Number(im.is_primary) === 1) || existingImgs[0] || null;
        const existingLiveSrc = normalizeImgSrc((existingPrimary && (existingPrimary.image_webp_url || existingPrimary.image_url)) || b.image_webp_url || b.image_url || '');
        const proposedSrc = normalizeImgSrc(m.image_webp_url || m.image_url || '');
        const displaySrc = isAfter ? (proposedSrc || existingLiveSrc) : existingLiveSrc;
        const photoLabel = isAfter ? (m.caption || 'Proposed New Photo') : ((existingPrimary && existingPrimary.caption) || 'Current Live Photo');
        const visualLandmark = b.visual_landmark || 'Visual landmark guidance not yet entered.';
        const keyServices = b.key_services || 'Key services not yet entered.';
        const safeZoomTitle = `${bName} — ${photoLabel}`.replace(/'/g, "\\'");
        const safeBadge = String(badgeText || '').replace(/'/g, "\\'");

        return `
            <div>
                ${headerPill}
                <div class="bldg-live-preview-card">
                    <div class="blp-header">
                        <div class="pin-live-circle" style="background:${escapeHtml(pinColor)};">${escapeHtml(String(bNum))}</div>
                        <div style="min-width:0; flex:1;">
                            <div style="font-size:15px; font-weight:700; color:#f8fafc; line-height:1.25;">${escapeHtml(bName)}</div>
                            <div style="font-size:11.5px; color:#94a3b8; margin-top:2px;">${escapeHtml(b.type_label || CATEGORY_LABELS[b.category] || 'Research Facility')}</div>
                            <div style="margin-top:5px;">${renderFacilityStatusBadge(b.facility_status || 'Existing')}</div>
                        </div>
                    </div>
                    <div class="blp-hero-wrap${isAfter ? ' cr-field-updated' : ' cr-field-removed'}" style="height:210px; position:relative; padding:0;">
                        ${displaySrc
                ? `<img src="${escapeHtml(displaySrc)}" alt="${escapeHtml(photoLabel)}" onclick="openCrPhotoLightbox('${escapeHtml(displaySrc)}', '${escapeHtml(safeZoomTitle)}', '${escapeHtml(safeBadge)}')" title="Click to enlarge photo" style="cursor:zoom-in; width:100%; height:100%; object-fit:cover; display:block;">`
                : `<div class="ro-card-hero-empty">${SVG_ICONS.image}<span>No live photo uploaded yet</span></div>`}
                        <div style="position:absolute; left:8px; right:8px; bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:6px; pointer-events:none;">
                            <span style="padding:3px 8px; border-radius:7px; background:rgba(2,6,23,0.84); color:#f8fafc; font-size:11px; font-weight:700;">${escapeHtml(photoLabel)}</span>
                            ${isAfter
                ? `<span class="cr-inline-upd-pill">${Number(m.is_primary) === 1 ? '+ New #1 Cover' : '+ New Photo #' + (existingImgs.length + 1)}</span>`
                : `<span class="cr-inline-rem-pill">− Previous Photo</span>`}
                        </div>
                    </div>
                    <div style="padding:8px 16px 14px;">
                        <div class="blp-wf-card visual">
                            <div style="font-size:10.5px; font-weight:700; color:#7dd3fc; letter-spacing:0.06em; margin-bottom:4px;">HOW TO SPOT IT</div>
                            <div style="font-size:12px; color:#e2e8f0; line-height:1.45;">${escapeHtml(visualLandmark)}</div>
                        </div>
                        <div class="blp-wf-card services">
                            <div style="font-size:10.5px; font-weight:700; color:#86efac; letter-spacing:0.06em; margin-bottom:4px;">WHAT'S INSIDE & SERVICES</div>
                            <div style="font-size:12px; color:#e2e8f0; line-height:1.45;">${escapeHtml(keyServices)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    if (table === 'building_offices') {
        const parentName = ctx.building ? `${ctx.building.building_num ? '#' + ctx.building.building_num + ' ' : ''}${ctx.building.name}` : (m.building_code || '—');
        return `
            <div>
                ${headerPill}
                <div class="bldg-live-preview-card">
                    <div class="blp-header">
                        <div class="pin-live-circle" style="background:#10b981;">${SVG_ICONS.folder}</div>
                        <div style="min-width:0; flex:1;">
                            <div class="${updCls(hasChanged('office_name'))}" style="font-size:15px; font-weight:700; color:#f8fafc;">${renderHighlightedText('office_name', m.office_name || '(Empty / Not Created Yet)')} ${updTag(hasChanged('office_name'))}</div>
                            <div style="font-size:11.5px; color:#94a3b8; margin-top:2px;">Parent Building: <strong style="color:#e2e8f0;">${escapeHtml(parentName)}</strong></div>
                        </div>
                    </div>
                    <div style="padding:14px 16px;">
                        <div class="${updCls(hasChanged('floor_or_room', 'room_number'))}" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:10px;">
                            <span class="ro-floor-pill">Floor: ${escapeHtml(m.floor_or_room || 'Ground Floor')}</span>
                            ${m.room_number ? `<span class="ro-room-pill">${escapeHtml(m.room_number)}</span>` : '<span class="mono-code">No room #</span>'}
                            ${updTag(hasChanged('floor_or_room', 'room_number'))}
                        </div>
                        <div class="blp-wf-card services${updCls(hasChanged('description'))}">
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                                <span style="font-size:10.5px; font-weight:700; color:#86efac; letter-spacing:0.06em;">OFFICE ROLE & DIRECTORY NOTES</span>
                                ${updTag(hasChanged('description'))}
                            </div>
                            <div style="font-size:12px; color:#e2e8f0; line-height:1.45;">${renderHighlightedText('description', m.description || 'Displayed inside the parent building drawer on the 3D map.')}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    if (table === 'agricultural_plots' || table === 'plot_subplots') {
        const plotColor = m.color || ctx.plot?.color || '#10b981';
        const imgSrc = normalizeImgSrc(m.image_webp_url || m.image_url || ctx.plot?.image_webp_url || '');
        const shapeSvg = renderShapeSilhouetteSvg(m.polygon_geojson || m.updated_parent_polygon_geojson || ctx.plot?.polygon_geojson, {
            strokeColor: plotColor,
            fillColor: `${plotColor}44`,
            width: 56,
            height: 44
        });
        return `
            <div>
                ${headerPill}
                <div class="bldg-live-preview-card" style="border-color:${escapeHtml(plotColor)}55;">
                    <div class="blp-header">
                        <div class="pin-live-circle" style="background:${escapeHtml(plotColor)};">${SVG_ICONS.sprout}</div>
                        <div style="min-width:0; flex:1;">
                            <div style="font-size:15px; font-weight:700; color:#f8fafc;">${escapeHtml(m.zone_name || m.name || ctx.plot?.zone_name || 'Agricultural Plot')}</div>
                            <div style="font-size:11.5px; color:#94a3b8; margin-top:2px;">${escapeHtml(m.plot_number || m.updated_parent_plot_number || m.plot_code || 'Plot')}</div>
                            <div style="margin-top:5px;">${renderFacilityStatusBadge(m.facility_status || 'Existing')}</div>
                        </div>
                        ${shapeSvg ? `<div style="padding:3px; border-radius:8px; background:rgba(2,6,23,0.85); border:1px solid ${escapeHtml(plotColor)}66;" title="Plot Polygon Shape">${shapeSvg}</div>` : ''}
                    </div>
                    ${imgSrc ? `<div class="blp-hero-wrap"><img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(m.zone_name || 'Plot')}"></div>` : ''}
                    <div style="padding:12px 16px 14px;">
                        <div class="ro-plot-metrics-grid" style="margin-bottom:10px;">
                            <div class="${updCls(hasChanged('current_crop'))}"><span style="color:#94a3b8;">Planted Crop ${updTag(hasChanged('current_crop'))}</span><br><strong style="color:#4ade80;">${escapeHtml(m.current_crop || '—')}</strong></div>
                            <div class="${updCls(hasChanged('cycle_months', 'cropping_cycle'))}"><span style="color:#94a3b8;">Cropping Cycle ${updTag(hasChanged('cycle_months', 'cropping_cycle'))}</span><br><strong style="color:#f8fafc;">${escapeHtml(m.cycle_months || m.cropping_cycle || '—')}</strong></div>
                            <div class="${updCls(hasChanged('status'))}"><span style="color:#94a3b8;">Field Stage ${updTag(hasChanged('status'))}</span><br><strong style="color:#38bdf8;">${escapeHtml(m.status || 'Active')}</strong></div>
                            <div class="${updCls(hasChanged('tree_or_plant_count', 'area_hectares'))}"><span style="color:#94a3b8;">Count / Area ${updTag(hasChanged('tree_or_plant_count', 'area_hectares'))}</span><br><strong style="color:#f8fafc;">${m.tree_or_plant_count ? `${Number(m.tree_or_plant_count).toLocaleString()} plants` : (m.area_hectares ? `${m.area_hectares} ha` : '—')}</strong></div>
                        </div>
                        <div class="blp-wf-card visual${updCls(hasChanged('description'))}">
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                                <span style="font-size:10.5px; font-weight:700; color:#7dd3fc; letter-spacing:0.06em;">PLOT OVERVIEW</span>
                                ${updTag(hasChanged('description'))}
                            </div>
                            <div style="font-size:12px; color:#e2e8f0; line-height:1.45;">${renderHighlightedText('description', m.description || 'Research field plot on the station campus map.')}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    if (table === 'stations') {
        return `
            <div>
                ${headerPill}
                <div class="bldg-live-preview-card">
                    <div class="blp-header">
                        <div class="pin-live-circle" style="background:#10b981;">${SVG_ICONS.pin}</div>
                        <div style="min-width:0; flex:1;">
                            <div style="font-size:15px; font-weight:700; color:#f8fafc;">${escapeHtml(m.full_name || m.name || ('DA-' + String(cr.station_id || 'lares').toUpperCase()))}</div>
                            <div style="font-size:11.5px; color:#94a3b8; margin-top:2px;">${escapeHtml(m.subtitle || '')} ${m.province ? '• ' + escapeHtml(m.province) : ''}</div>
                        </div>
                    </div>
                    <div style="padding:12px 16px 14px; font-size:12px; color:#e2e8f0; display:grid; gap:8px;">
                        <div><strong>Kiosk "You Are Here" Pin:</strong> <span class="mono-id">[${m.kiosk_pin_lng ?? '—'}, ${m.kiosk_pin_lat ?? '—'}]</span></div>
                        <div><strong>Camera Default:</strong> <span class="mono-code">Zoom ${m.default_zoom ?? '—'} • Pitch ${m.default_pitch ?? '—'}° • Bearing ${m.default_bearing ?? '—'}°</span></div>
                    </div>
                </div>
            </div>
        `;
    }

    // Default: Building Live Map Drawer Replica
    const pinColor = m.pin_color || m.color || ctx.building?.pin_color || '#10b981';
    const bNum = m.building_num ?? ctx.building?.building_num ?? '•';
    const galleryImgs = Array.isArray(m.images)
        ? m.images.filter(im => im && (im.image_webp_url || im.image_url))
        : (Array.isArray(ctx.building?.images) ? ctx.building.images.filter(im => im && (im.image_webp_url || im.image_url)) : []);
    const primaryImgFromArr = galleryImgs[0] ? (galleryImgs[0].image_webp_url || galleryImgs[0].image_url) : '';
    const imgSrc = normalizeImgSrc(m.image_webp_url || m.image_url || primaryImgFromArr || '');
    const primaryCaption = (galleryImgs[0] && galleryImgs[0].caption) || m.name || ctx.building?.name || 'Facility View';
    const photosChanged = hasChanged('images', 'image_webp_url', 'image_url');
    const captionChanges = extractImageCaptionChanges(
        Array.isArray(beforeData.images) ? beforeData.images : ctx.building?.images,
        Array.isArray(afterData.images) ? afterData.images : []
    );
    const primaryCaptionChange = captionChanges.find(c => c.index === 1) || null;
    const primaryCaptionHtml = primaryCaptionChange
        ? (() => {
            const wd = computeWordDiff(primaryCaptionChange.beforeCaption, primaryCaptionChange.afterCaption);
            return isAfter ? (wd.changedHtml || escapeHtml(primaryCaption)) : (wd.pastHtml || escapeHtml(primaryCaption));
        })()
        : escapeHtml(primaryCaption);
    const primaryCaptionStyle = primaryCaptionChange
        ? (isAfter
            ? 'padding:3px 9px; border-radius:6px; background:rgba(6,78,59,0.92); border:1px solid rgba(52,211,153,0.85); color:#ecfdf5; font-size:11px; font-weight:700; box-shadow:0 2px 8px rgba(0,0,0,0.35);'
            : 'padding:3px 9px; border-radius:6px; background:rgba(136,19,55,0.92); border:1px solid rgba(251,113,133,0.85); color:#ffe4e6; font-size:11px; font-weight:700; box-shadow:0 2px 8px rgba(0,0,0,0.35);')
        : 'padding:2px 8px; border-radius:6px; background:rgba(2,6,23,0.84); color:#f8fafc; font-size:10.5px; font-weight:700;';
    const photoStatusBadgeHtml = (() => {
        if (!photosChanged) return '';
        if (primaryCaptionChange) {
            return isAfter
                ? '<span class="cr-inline-upd-pill">+ Caption Updated</span>'
                : '<span class="cr-inline-rem-pill">− Previous Caption</span>';
        }
        return isAfter
            ? '<span class="cr-inline-upd-pill">+ Updated Photo</span>'
            : '<span class="cr-inline-rem-pill">− Previous Photo</span>';
    })();
    const visualLandmark = m.visual_landmark || m.visual_guidance || ctx.building?.visual_landmark || 'Visual landmark guidance not yet entered.';
    const keyServices = m.key_services || m.services || ctx.building?.key_services || 'Key services not yet entered.';
    const shapeSvg = renderShapeSilhouetteSvg(m.footprint_geojson || ctx.building?.footprint_geojson, {
        strokeColor: '#38bdf8',
        fillColor: 'rgba(56,189,248,0.25)',
        width: 56,
        height: 44
    });

    return `
        <div>
            ${headerPill}
            <div class="bldg-live-preview-card">
                <div class="blp-header">
                    <div class="pin-live-circle" style="background:${escapeHtml(pinColor)};">${escapeHtml(String(bNum))}</div>
                    <div style="min-width:0; flex:1;">
                        <div class="${updCls(hasChanged('name'))}" style="font-size:15px; font-weight:700; color:#f8fafc; line-height:1.25;">${renderHighlightedText('name', m.name || ctx.building?.name || cr.target_id || 'Building Facility')} ${updTag(hasChanged('name'))}</div>
                        <div class="${updCls(hasChanged('type_label', 'category', 'compact_tag'))}" style="font-size:11.5px; color:#94a3b8; margin-top:2px;">${escapeHtml(m.type_label || CATEGORY_LABELS[m.category] || ctx.building?.type_label || 'Research Facility')} ${updTag(hasChanged('type_label', 'category', 'compact_tag'))}</div>
                        <div class="${updCls(hasChanged('facility_status'))}" style="margin-top:5px; display:inline-flex; align-items:center; gap:6px;">${renderFacilityStatusBadge(m.facility_status || ctx.building?.facility_status || 'Existing')} ${updTag(hasChanged('facility_status'))}</div>
                    </div>
                    ${shapeSvg ? `<div style="padding:3px; border-radius:8px; background:rgba(2,6,23,0.85); border:1px solid rgba(56,189,248,0.38);" title="Building Footprint">${shapeSvg}</div>` : ''}
                </div>
                <div class="blp-hero-wrap${updCls(photosChanged)}" style="position:relative; padding:0;">
                    ${imgSrc
            ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(primaryCaption)}" onclick="openCrPhotoLightbox('${escapeHtml(imgSrc)}', '${escapeHtml(String((m.name || ctx.building?.name || 'Building') + ' — ' + primaryCaption).replace(/'/g, "\\'"))}', '${escapeHtml(String(badgeText || '').replace(/'/g, "\\'"))}')" title="Click to enlarge photo" style="cursor:zoom-in;">
                           <div style="position:absolute; left:8px; right:8px; bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:6px; pointer-events:none; flex-wrap:wrap;">
                               <span style="${primaryCaptionStyle}">${primaryCaptionHtml}</span>
                               <span style="display:inline-flex; align-items:center; gap:5px;">
                                   ${photoStatusBadgeHtml}
                                   <span style="padding:2px 7px; border-radius:999px; background:rgba(15,23,42,0.88); color:#cbd5e1; font-size:10px; font-weight:700;">${galleryImgs.length || 1} Photo${(galleryImgs.length || 1) === 1 ? '' : 's'}</span>
                               </span>
                           </div>`
            : `<div class="ro-card-hero-empty">${SVG_ICONS.building}<span>${photosChanged ? (isAfter ? 'All photos removed' : 'No previous photo') : 'No facility photo attached'}</span></div>`}
                </div>
                ${captionChanges.length > 0 ? `
                    <div style="padding:8px 16px 2px;">
                        <div class="blp-wf-card ${isAfter ? 'cr-field-updated' : 'cr-field-removed'}" style="margin-bottom:4px; padding:8px 10px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; margin-bottom:4px;">
                                <span style="font-size:10.5px; font-weight:800; letter-spacing:0.06em; color:${isAfter ? '#34d399' : '#fb7185'};">PHOTO CAPTION${captionChanges.length > 1 ? 'S' : ''} ${isAfter ? 'UPDATED' : 'BEFORE'}</span>
                                ${isAfter ? '<span class="cr-inline-upd-pill">+ Caption Updated</span>' : '<span class="cr-inline-rem-pill">− Previous Caption</span>'}
                            </div>
                            ${captionChanges.map(cc => {
                const wd = computeWordDiff(cc.beforeCaption, cc.afterCaption);
                return `<div style="font-size:12px; line-height:1.45; margin-top:2px;"><strong style="opacity:0.8;">Photo #${cc.index}:</strong> ${isAfter ? wd.changedHtml : wd.pastHtml}</div>`;
            }).join('')}
                        </div>
                    </div>
                ` : ''}
                ${galleryImgs.length > 1 ? `
                    <div style="display:flex; gap:6px; padding:6px 14px 4px; overflow-x:auto;">
                        ${galleryImgs.map((im, idx) => {
                const s = normalizeImgSrc(im.image_webp_url || im.image_url);
                const cap = String(im.caption || ('Photo #' + (idx + 1)));
                return `<button type="button" onclick="openCrPhotoLightbox('${escapeHtml(s)}', '${escapeHtml(String((m.name || 'Building') + ' — #' + (idx + 1) + ' ' + cap).replace(/'/g, "\\'"))}', '${escapeHtml(String(badgeText || '').replace(/'/g, "\\'"))}')" title="#${idx + 1} ${escapeHtml(cap)} — click to zoom" style="position:relative; width:54px; height:38px; border-radius:7px; overflow:hidden; border:1px solid ${idx === 0 ? 'rgba(52,211,153,0.75)' : 'rgba(148,163,184,0.28)'}; padding:0; cursor:zoom-in; flex-shrink:0; background:#020617;">
                                <img src="${escapeHtml(s)}" alt="${escapeHtml(cap)}" style="width:100%; height:100%; object-fit:cover; display:block;">
                                <span style="position:absolute; bottom:1px; left:2px; font-size:9px; font-weight:800; color:#fff; background:rgba(2,6,23,0.82); padding:0 4px; border-radius:4px;">#${idx + 1}</span>
                            </button>`;
            }).join('')}
                    </div>
                ` : ''}
                <div style="padding:4px 16px 14px;">
                    <div class="blp-wf-card visual${updCls(hasChanged('visual_landmark', 'visual_guidance'))}">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                            <span style="font-size:10.5px; font-weight:700; color:#7dd3fc; letter-spacing:0.06em;">HOW TO SPOT IT</span>
                            ${updTag(hasChanged('visual_landmark', 'visual_guidance'))}
                        </div>
                        <div style="font-size:12px; color:#e2e8f0; line-height:1.45;">${renderHighlightedText('visual_landmark', visualLandmark)}</div>
                    </div>
                    <div class="blp-wf-card services${updCls(hasChanged('key_services', 'services'))}">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                            <span style="font-size:10.5px; font-weight:700; color:#86efac; letter-spacing:0.06em;">WHAT'S INSIDE & SERVICES</span>
                            ${updTag(hasChanged('key_services', 'services'))}
                        </div>
                        <div style="font-size:12px; color:#e2e8f0; line-height:1.45;">${renderHighlightedText('key_services', keyServices)}</div>
                    </div>
                    ${(m.description || ctx.building?.description) ? `
                        <div class="blp-wf-card notes${updCls(hasChanged('description'))}" style="margin-top:8px;">
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                                <span style="font-size:10.5px; font-weight:700; color:#cbd5e1; letter-spacing:0.06em;">DIRECTORY DESCRIPTION / NOTES</span>
                                ${updTag(hasChanged('description'))}
                            </div>
                            <div style="font-size:12px; color:#e2e8f0; line-height:1.45;">${renderHighlightedText('description', m.description || ctx.building?.description)}</div>
                        </div>` : ''}
                </div>
            </div>
        </div>
    `;
}

function renderCrVisualPreviewHtml(cr, previewMode = 'side', changedKeys = null) {
    const ctx = findContextEntityForCr(cr, lastOverviewData);
    const baseRecord = ctx.building || ctx.plot || {};
    const { beforeState, afterState } = computeSnapshotBeforeAfter(cr, baseRecord);
    const isDelete = String(cr.action || '').toUpperCase() === 'DELETE';
    const cKeys = changedKeys instanceof Set ? changedKeys : new Set(buildDiffRows(cr).filter(d => d.changed).map(d => d.key));

    const deleteBanner = isDelete ? `
        <div style="margin-bottom:10px; padding:8px 12px; border-radius:9px; background:rgba(244,63,94,0.14); border:1px solid rgba(244,63,94,0.38); color:#fda4af; font-size:12px; font-weight:700;">
            Deletion Request — This record will be removed when published.
        </div>
    ` : '';

    const legendBar = cKeys.size > 0 ? `
        <div class="cr-diff-legend-strip">
            <span style="font-weight:700; color:#f8fafc;">Visual Change Highlights (${cKeys.size} ${cKeys.size === 1 ? 'field' : 'fields'} changed)</span>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <span class="cr-inline-rem-pill">− Red = Past / Replaced</span>
                <span class="cr-inline-upd-pill">+ Green = Updated / Added</span>
            </div>
        </div>
    ` : '';

    if (previewMode === 'before') {
        return `${deleteBanner}${legendBar}${renderEntityVisitorCardHtml(cr, beforeState, 'Before • Current Live View', { isAfter: false, changedKeys: cKeys, beforeData: beforeState, afterData: afterState })}`;
    }
    if (previewMode === 'slider') {
        const beforeCard = renderEntityVisitorCardHtml(cr, beforeState, 'Before • Current Live View', { isAfter: false, changedKeys: cKeys, beforeData: beforeState, afterData: afterState });
        const afterCard = renderEntityVisitorCardHtml(cr, afterState, 'After • Proposed Update', { isAfter: true, changedKeys: cKeys, beforeData: beforeState, afterData: afterState });
        return `
            ${deleteBanner}
            ${legendBar}
            <div class="cr-split-slider-toolbar">
                <span class="cr-inline-rem-pill">← Left: Before (Live)</span>
                <div style="flex:1; max-width:340px; display:flex; align-items:center; gap:8px;">
                    <input type="range" id="cr-split-range-input" class="cr-split-range" min="0" max="100" value="50" aria-label="Before and After Split Slider" oninput="updateCrSplitSlider(this.value)">
                    <span id="cr-split-pct-label" class="mono-code" style="min-width:44px; text-align:center;">50%</span>
                </div>
                <span class="cr-inline-upd-pill">Right: After (Proposed) →</span>
            </div>
            <div class="cr-split-curtain-stage" id="cr-split-curtain-stage" style="--split-pct:50%;">
                <div class="cr-split-pane cr-split-before">
                    ${beforeCard}
                </div>
                <div class="cr-split-pane cr-split-after" id="cr-split-after-pane">
                    ${afterCard}
                </div>
                <div class="cr-split-divider" id="cr-split-divider" title="Drag left or right to compare Before vs. After">
                    <div class="cr-split-handle">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m18 8 4 4-4 4"/><path d="M2 12h20"/><path d="m6 8-4 4 4 4"/></svg>
                    </div>
                </div>
            </div>
        `;
    }
    if (previewMode === 'side') {
        return `
            ${deleteBanner}
            ${legendBar}
            <div class="cr-cards-side-by-side">
                ${renderEntityVisitorCardHtml(cr, beforeState, 'Before • Current Live View', { isAfter: false, changedKeys: cKeys, beforeData: beforeState, afterData: afterState })}
                ${renderEntityVisitorCardHtml(cr, afterState, 'After • Proposed Update', { isAfter: true, changedKeys: cKeys, beforeData: beforeState, afterData: afterState })}
            </div>
        `;
    }
    return `${deleteBanner}${legendBar}${renderEntityVisitorCardHtml(cr, afterState, 'After • Proposed Update', { isAfter: true, changedKeys: cKeys, beforeData: beforeState, afterData: afterState })}`;
}

// =========================================================================
// VISUAL CHANGE REQUEST QUEUE (CARDS + TABLE TOGGLE)
// =========================================================================
function buildCrVisualCardThumbnail(cr) {
    const table = String(cr.target_table || '').toLowerCase();
    if (table === 'map_geometry') {
        const g = getGeomDiffSummary(cr);
        return `
            <div class="cr-vc-hero" onclick="openCrDiffModal(${cr.id})" title="Click to open Interactive Aerial Visual Diff Map" style="background:linear-gradient(135deg, rgba(15,23,42,0.92), rgba(6,78,59,0.55));">
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:10px; text-align:center;">
                    <div style="width:38px; height:38px; border-radius:11px; background:${g.accentColor}22; border:1px solid ${g.accentColor}66; color:${g.accentColor}; display:flex; align-items:center; justify-content:center;">
                        ${SVG_ICONS.map}
                    </div>
                    <span style="font-size:11px; font-weight:800; color:#f8fafc; line-height:1.2;">${escapeHtml(g.editorTitle)}</span>
                    <span style="font-size:10px; color:#94a3b8; font-weight:600;">Aerial Visual Diff Ready</span>
                </div>
                <span class="cr-vc-action-pill" style="border-color:${g.accentColor}88; color:${g.accentColor};">MAP EDIT</span>
            </div>
        `;
    }

    const prev = parseJsonSafe(cr.previous_json);
    const next = parseJsonSafe(cr.payload_json);
    const m = { ...prev, ...next };
    const ctx = findContextEntityForCr(cr, lastOverviewData);

    const imgCandidate = m.image_webp_url
        || m.image_url
        || (Array.isArray(m.images) && m.images[0] && (m.images[0].image_webp_url || m.images[0].image_url))
        || (ctx.building && Array.isArray(ctx.building.images) && ctx.building.images[0] && (ctx.building.images[0].image_webp_url || ctx.building.images[0].image_url))
        || ctx.plot?.image_webp_url
        || '';
    const imgSrc = normalizeImgSrc(imgCandidate);

    const beforeGeom = prev.footprint_geojson || prev.polygon_geojson || prev.coordinates_json || null;
    const afterGeom = next.footprint_geojson || next.polygon_geojson || next.coordinates_json || next.updated_parent_polygon_geojson || ctx.building?.footprint_geojson || ctx.plot?.polygon_geojson || null;
    const accentColor = m.pin_color || m.color || ctx.building?.pin_color || ctx.plot?.color || '#34d399';

    const miniShapeSvg = renderShapeSilhouetteSvg(afterGeom, {
        beforeGeomRaw: beforeGeom,
        strokeColor: accentColor,
        fillColor: `${accentColor}44`,
        width: 52,
        height: 42
    });

    const largeShapeSvg = renderShapeSilhouetteSvg(afterGeom, {
        beforeGeomRaw: beforeGeom,
        strokeColor: accentColor,
        fillColor: `${accentColor}44`,
        width: 170,
        height: 112
    });

    const actionColors = {
        CREATE: '#10b981',
        UPDATE: '#38bdf8',
        DELETE: '#f43f5e',
        SPLIT: '#f59e0b',
        MERGE: '#a855f7'
    };
    const actUpper = String(cr.action || 'UPDATE').toUpperCase();
    const actColor = actionColors[actUpper] || '#38bdf8';

    return `
        <div class="cr-vc-hero" onclick="openCrDiffModal(${cr.id})" title="Click to open Visual Diff & Map Inspector">
            ${imgSrc
            ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(cr.summary)}" loading="lazy">`
            : (largeShapeSvg
                ? `<div style="display:flex; flex-direction:column; align-items:center; gap:3px;">${largeShapeSvg}<span style="font-size:10px; color:#94a3b8; font-weight:600;">Spatial Polygon Preview</span></div>`
                : `<div class="ro-card-hero-empty">${table === 'building_offices' ? SVG_ICONS.folder : (table.includes('plot') ? SVG_ICONS.sprout : SVG_ICONS.building)}<span>Visual Record Preview</span></div>`)}
            <span class="cr-vc-action-pill" style="border-color:${actColor}88; color:${actColor};">${escapeHtml(actUpper)}</span>
            ${imgSrc && miniShapeSvg ? `<div class="cr-vc-minimap-badge" title="Campus Footprint / Polygon">${miniShapeSvg}</div>` : ''}
        </div>
    `;
}

function renderCrDiffSummaryChips(cr) {
    if (String(cr?.target_table || '').toLowerCase() === 'map_geometry') {
        const g = getGeomDiffSummary(cr);
        const chips = [];
        if (g.addedCount > 0) chips.push(`<span class="cr-diff-chip geom">+${g.addedCount} Added</span>`);
        if (g.modifiedCount > 0) chips.push(`<span class="cr-diff-chip geom">${g.editorType === 'pills' ? `${g.modifiedCount} Pill${g.modifiedCount === 1 ? '' : 's'} Moved` : `~${g.modifiedCount} Modified`}</span>`);
        if (g.removedCount > 0) chips.push(`<span class="cr-diff-chip" style="border-color:rgba(244,63,94,0.45); color:#fb7185;">−${g.removedCount} Removed</span>`);
        const highlights = [...g.modified, ...g.added, ...g.removed].slice(0, 2);
        highlights.forEach(it => {
            const lbl = `${it.label || it.key}: ${formatGeomItemDelta(it)}`;
            chips.push(`<span class="cr-diff-chip" title="${escapeHtml(lbl)}">${escapeHtml(lbl.length > 48 ? lbl.slice(0, 46) + '…' : lbl)}</span>`);
        });
        return chips.length ? chips.join('') : `<span class="cr-diff-chip geom">${escapeHtml(g.editorTitle)}</span>`;
    }

    const diffRows = buildDiffRows(cr).filter(r => r.changed);
    if (!diffRows.length) {
        return `<span class="cr-diff-chip">Record Submission</span>`;
    }
    return diffRows.slice(0, 4).map(d => {
        const isGeom = ['footprint_geojson', 'polygon_geojson', 'coordinates_json', 'split_polygon_geojson', 'updated_parent_polygon_geojson'].includes(d.key);
        const isPhoto = ['image_webp_url', 'image_url'].includes(d.key);
        if (isGeom) {
            return `<span class="cr-diff-chip geom"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/></svg> ${escapeHtml(d.label)}</span>`;
        }
        if (isPhoto || d.key === 'images') {
            let photoLabel = d.label;
            if (d.key === 'images') {
                const bCount = Array.isArray(d.rawBefore) ? d.rawBefore.length : 0;
                const aCount = Array.isArray(d.rawAfter) ? d.rawAfter.length : 0;
                const capChanges = Array.isArray(d.captionChanges) ? d.captionChanges : extractImageCaptionChanges(d.rawBefore, d.rawAfter);
                if (aCount > bCount) {
                    photoLabel = `Photos: +${aCount - bCount} added (${aCount} total)` + (capChanges.length ? ` • ${capChanges.length} caption edited` : '');
                } else if (aCount < bCount) {
                    photoLabel = `Photos: ${bCount - aCount} removed (${aCount} total)` + (capChanges.length ? ` • ${capChanges.length} caption edited` : '');
                } else if (capChanges.length === 1) {
                    const c = capChanges[0];
                    const trimCap = (s) => s.length > 26 ? s.slice(0, 24).trimEnd() + '…' : s;
                    photoLabel = `Photo #${c.index} Caption: "${trimCap(c.beforeCaption)}" → "${trimCap(c.afterCaption)}"`;
                } else if (capChanges.length > 1) {
                    photoLabel = `Photo Captions: ${capChanges.length} updated`;
                } else {
                    photoLabel = `Photos updated (${aCount} total)`;
                }
            }
            return `<span class="cr-diff-chip photo" title="${escapeHtml(photoLabel)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg> ${escapeHtml(photoLabel)}</span>`;
        }
        const rawAfter = String(d.afterVal || '(cleared)');
        const shortAfter = rawAfter.length > 64 ? rawAfter.slice(0, 62).trimEnd() + '…' : rawAfter;
        return `<span class="cr-diff-chip" title="${escapeHtml(`${d.label}: ${rawAfter}`)}"><strong>${escapeHtml(d.label)}:</strong> ${escapeHtml(shortAfter)}</span>`;
    }).join('') + (diffRows.length > 4 ? `<span class="cr-diff-chip">+${diffRows.length - 4} more</span>` : '');
}

function renderCrListTable() {
    const host = document.getElementById('cr-list-host');
    const pagerHost = document.getElementById('cr-pagination-host');
    if (!host) return;

    const allFiltered = cachedRequests.filter(r => activeCrSubTab === 'all' || r.status === activeCrSubTab);
    const totalPages = Math.max(1, Math.ceil(allFiltered.length / crQueueLimit));
    if (crQueuePage > totalPages) crQueuePage = totalPages;
    const list = allFiltered.slice((crQueuePage - 1) * crQueueLimit, crQueuePage * crQueueLimit);

    if (pagerHost) {
        if (allFiltered.length === 0) {
            pagerHost.innerHTML = '';
        } else {
            pagerHost.innerHTML = renderPaginationBarHtml({
                total: allFiltered.length,
                page: crQueuePage,
                limit: crQueueLimit,
                itemLabel: 'requests',
                pageAttr: 'data-cr-page',
                limitId: 'cr-queue-limit'
            });
            pagerHost.querySelectorAll('[data-cr-page]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const nextP = Number(btn.dataset.crPage);
                    if (!btn.disabled && nextP >= 1) {
                        crQueuePage = nextP;
                        renderCrListTable();
                    }
                });
            });
            document.getElementById('cr-queue-limit')?.addEventListener('change', (e) => {
                crQueueLimit = Number(e.target.value) || 10;
                setSavedPortalPref('iguide_pref_cr_limit', crQueueLimit);
                crQueuePage = 1;
                renderCrListTable();
            });
        }
    }

    if (list.length === 0) {
        const emptyByTab = {
            draft: 'No drafts saved yet. Use "Save Changes (Draft)" when editing a record to group multiple edits.',
            pending: 'Nothing waiting for your review.',
            rejected: 'No revisions requested right now.',
            approved: 'Nothing ready to publish right now.',
            published: 'No published changes yet.',
            all: 'No change requests recorded yet.'
        };
        host.innerHTML = `<div style="text-align:center; padding:32px; color:#94a3b8;">${escapeHtml(emptyByTab[activeCrSubTab] || 'No requests to show.')}</div>`;
        return;
    }

    const isReviewerRole = PortalState.effectiveRole === 'reviewer' || PortalState.effectiveRole === 'super_admin';
    const canDecide = isReviewerRole && hasPermission('reviews:decide');
    const canPublishNow = hasPermission('changes:publish');
    const canRevise = hasPermission('buildings:draft_change') || hasPermission('plots:draft_change') || hasPermission('offices:draft_change');

    const targetLabelMap = {
        buildings: 'Building Facility',
        building_images: 'Facility Photo',
        building_offices: 'Internal Office',
        agricultural_plots: 'Agricultural Plot',
        plot_subplots: 'Screenhouse Sub-Plot',
        stations: 'Station Pin & Settings',
        map_geometry: 'Visual Map Editor'
    };

    if (crQueueViewMode === 'cards') {
        host.innerHTML = `
            <div class="cr-visual-card-list">
                ${list.map(r => {
            const ctx = findContextEntityForCr(r, lastOverviewData);
            const entityLabel = ctx.building
                ? `${ctx.building.building_num ? '#' + ctx.building.building_num + ' ' : ''}${ctx.building.name}`
                : (ctx.plot ? `${ctx.plot.plot_number ? ctx.plot.plot_number + ' • ' : ''}${ctx.plot.zone_name}` : r.target_id);
            const humanTitle = formatHumanRequestTitle(r, entityLabel);
            const fb = parseReviewerFeedback(r.reviewer_comment || '');
            return `
                        <div class="cr-visual-card">
                            ${buildCrVisualCardThumbnail(r)}
                            <div class="cr-vc-body">
                                <div>
                                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:5px;">
                                        <span class="status-pill status-pill-blue" style="font-size:10.5px;">${escapeHtml(targetLabelMap[r.target_table] || r.target_table)}</span>
                                        <span style="font-size:12px; color:#cbd5e1; font-weight:600;">DA-${escapeHtml(String(r.station_id || '').toUpperCase())}</span>
                                    </div>
                                    <div style="font-size:14.5px; font-weight:700; color:#f8fafc; margin-bottom:7px;">${escapeHtml(humanTitle)}</div>
                                    <div class="cr-vc-pills" style="margin-bottom:8px;">
                                        ${renderCrDiffSummaryChips(r)}
                                    </div>
                                    <details class="tech-details-box" style="margin-bottom:8px; font-size:11.5px; color:#94a3b8;">
                                        <summary style="cursor:pointer; user-select:none; color:#94a3b8;">Technical details</summary>
                                        <div style="margin-top:5px; padding:6px 8px; border-radius:6px; background:rgba(15,23,42,0.55); font-family:var(--font-mono); font-size:11px; line-height:1.5;">
                                            Request #${r.id} • Table: ${escapeHtml(r.target_table)} • Target: ${escapeHtml(r.target_id)} • Action: ${escapeHtml(r.action || 'UPDATE')} • Base v${Number(r.base_version || 1)}
                                        </div>
                                    </details>
                                </div>
                                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                                    ${renderCrStepper(r)}
                                    <div style="font-size:11.5px; color:#94a3b8;">
                                        Submitted by ${renderCrActorHtml(r, 'submitted')}
                                    </div>
                                </div>
                                ${(Array.isArray(r.conflicts) && r.conflicts.length > 0) || r.is_stale_base ? `
                                    <div style="padding:7px 10px; border-radius:8px; font-size:11.5px; background:rgba(245,158,11,0.12); color:#fde68a; border:1px solid rgba(245,158,11,0.38);">
                                        ${r.is_stale_base ? `<div><strong>Outdated base version:</strong> Based on v${Number(r.base_version || 1)}, live record is now v${Number(r.live_version || 1)}. Rebase or include an override note to approve.</div>` : ''}
                                        ${Array.isArray(r.conflicts) && r.conflicts.length > 0 ? `<div><strong>Conflicting open request(s) on this record:</strong> ${r.conflicts.map(c => `#${c.id} (${escapeHtml(c.status)})`).join(', ')}</div>` : ''}
                                    </div>
                                ` : ''}
                                ${r.delete_reason ? `
                                    <div style="padding:6px 10px; border-radius:8px; font-size:11.5px; background:rgba(244,63,94,0.10); color:#fda4af; border:1px solid rgba(244,63,94,0.28);">
                                        <strong>Deletion Reason:</strong> "${escapeHtml(r.delete_reason)}"
                                    </div>
                                ` : ''}
                                ${r.reviewer_comment ? `
                                    <div style="padding:7px 10px; border-radius:8px; font-size:11.5px; ${['rejected', 'denied'].includes(r.status) ? 'background:rgba(244,63,94,0.12); color:#fda4af; border:1px solid rgba(244,63,94,0.3);' : 'background:rgba(16,185,129,0.10); color:#6ee7b7;'}">
                                        <strong>${r.status === 'denied' ? 'Denial Reason:' : 'Reviewer Feedback:'}</strong>
                                        ${fb.items.length > 0 ? `<ul style="margin:4px 0 0 18px; padding:0;">${fb.items.map(it => `<li>${escapeHtml(it)}</li>`).join('')}</ul>` : ''}
                                        ${fb.note ? `<div style="margin-top:3px;">${escapeHtml(fb.note)}</div>` : ''}
                                    </div>
                                ` : ''}
                            </div>
                            <div class="cr-vc-actions">
                                <button type="button" class="btn btn-secondary btn-sm" style="width:100%; justify-content:center;" onclick="openCrDiffModal(${r.id})">
                                    ${SVG_ICONS.map} <span>Inspect Visual Diff</span>
                                </button>
                                ${r.status === 'draft' && canRevise ? `
                                    <button type="button" class="btn btn-emerald btn-sm" style="width:100%; justify-content:center;" onclick="submitDraftRequestNow(${r.id})">
                                        Submit Draft for Review →
                                    </button>
                                ` : ''}
                                ${['draft', 'pending'].includes(r.status) && canRevise && (PortalState.baseRole === 'super_admin' || Boolean(r.is_own_submission)) ? `
                                    <button type="button" class="btn btn-secondary btn-sm" style="width:100%; justify-content:center;" onclick="withdrawChangeRequestNow(${r.id})">
                                        Withdraw Request
                                    </button>
                                ` : ''}
                                ${r.is_stale_base && ['draft', 'pending', 'rejected'].includes(r.status) ? `
                                    <button type="button" class="btn btn-secondary btn-sm" style="width:100%; justify-content:center;" onclick="rebaseChangeRequestNow(${r.id})">
                                        Rebase to Live v${Number(r.live_version || 1)}
                                    </button>
                                ` : ''}
                                ${r.status === 'pending' && canDecide ? `
                                    <button type="button" class="btn btn-emerald btn-sm" style="width:100%; justify-content:center;" onclick="openCrDiffModal(${r.id}, 'review')">
                                        Review & Decide →
                                    </button>
                                ` : (r.status === 'pending' && canPublishNow ? `
                                    <span class="status-pill status-pill-dev" style="width:100%; justify-content:center; padding:6px 10px; font-size:11px;">${SVG_ICONS.clock} <span>Awaiting Station Reviewer</span></span>
                                ` : '')}
                                ${
            r.status === 'rejected' && canRevise ? `
                                    <button type="button" class="btn btn-blue btn-sm" style="width:100%; justify-content:center;" onclick="openCrDiffModal(${r.id}, 'revise')">
                                        Revise & Resubmit
                                    </button>
                                ` : ''
        }
                                ${
            r.status === 'approved' && canPublishNow ? `
                                    <button type="button" class="btn btn-emerald btn-sm" style="width:100%; justify-content:center;" onclick="publishChangeRequestNow(${r.id})">
                                        Publish Live
                                    </button>
                                ` : ''
        }
                                ${
            r.can_undo_publish && canPublishNow ? `
                                    <button type="button" class="btn btn-danger btn-sm" style="width:100%; justify-content:center;" onclick="undoPublishedRequestNow(${r.id})">
                                        Undo Publish (24h)
                                    </button>
                                ` : ''
        }
                            </div >
                        </div >
            `;
                }).join('')}
            </div>
        `;
        return;
    }

    host.innerHTML = `
        <div class="table-scroll-wrap">
        <table class="crud-table">
            <thead>
                <tr>
                    <th>Req #</th>
                    <th>Station / Module</th>
                    <th>Summary & Pipeline Progress</th>
                    <th>Submitted / Reviewer Notes</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${list.map(r => `
                    <tr>
                        <td>
                            <span class="mono-id">#${r.id}</span>
                            <div style="margin-top:4px;"><span class="status-pill status-pill-blue" style="font-size:10px;">${escapeHtml(r.action)}</span></div>
                        </td>
                        <td>
                            <span class="mono-code">DA-${escapeHtml(String(r.station_id || '').toUpperCase())}</span>
                            <div style="font-size:12px; font-weight:600; color:#e2e8f0; margin-top:4px;">${escapeHtml(targetLabelMap[r.target_table] || r.target_table)}</div>
                            <span class="mono-id">${escapeHtml(r.target_id)}</span>
                        </td>
                        <td>
                            <div style="font-weight:700; color:#f8fafc; margin-bottom:6px;">${escapeHtml(r.summary)}</div>
                            ${renderCrStepper(r)}
                        </td>
                        <td>
                            <div style="font-size:12px; color:#94a3b8;">By: ${renderCrActorHtml(r, 'submitted')}</div>
                            ${r.reviewer_comment ? `
                                <div style="margin-top:5px; padding:5px 8px; border-radius:7px; font-size:11.5px; ${['rejected', 'denied'].includes(r.status) ? 'background:rgba(244,63,94,0.12); color:#fda4af; border:1px solid rgba(244,63,94,0.3);' : 'background:rgba(16,185,129,0.10); color:#6ee7b7;'}">
                                    <strong>${r.status === 'denied' ? 'Denied:' : 'Reviewer:'}</strong> "${escapeHtml(r.reviewer_comment)}"
                                </div>` : ''}
                        </td>
                        <td>
                            <div class="action-cell">
                                <button type="button" class="btn btn-secondary btn-sm" onclick="openCrDiffModal(${r.id})">${SVG_ICONS.map} <span>Inspect Visual Diff</span></button>
                                ${['draft', 'pending'].includes(r.status) && canRevise && (PortalState.baseRole === 'super_admin' || Boolean(r.is_own_submission)) ? `
                                    <button type="button" class="btn btn-secondary btn-sm" onclick="withdrawChangeRequestNow(${r.id})">Withdraw</button>
                                ` : ''}
                                ${r.status === 'pending' && canDecide ? `
                                    <button type="button" class="btn btn-emerald btn-sm" onclick="openCrDiffModal(${r.id}, 'review')">Review →</button>
                                ` : ''}
                                ${r.status === 'rejected' && canRevise ? `
                                    <button type="button" class="btn btn-blue btn-sm" onclick="openCrDiffModal(${r.id}, 'revise')">Revise & Resubmit</button>
                                ` : ''}
                                ${r.status === 'approved' && canPublishNow ? `
                                    <button type="button" class="btn btn-emerald btn-sm" onclick="publishChangeRequestNow(${r.id})">Publish Live</button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        </div>
    `;
}

async function renderChangeRequestWorkspace(container, { isReviewerView = false } = {}) {
    currentCrContainer = container;
    currentIsReviewerView = isReviewerView;

    const overviewPromise = ensureStationOverviewLoaded(PortalState.currentStation);
    if (isReviewerView) {
        const [res] = await Promise.all([
            apiFetch(`/api/review/requests?station=${PortalState.currentStation}`),
            overviewPromise
        ]);
        cachedRequests = res.requests || [];
    } else {
        const stationQuery = PortalState.stationScope === 'all' && !PortalState.currentStation ? '' : `?station=${PortalState.currentStation}`;
        const [reqs] = await Promise.all([
            apiFetch(`/api/admin/change-requests${stationQuery}`),
            overviewPromise
        ]);
        cachedRequests = reqs || [];
    }

    const counts = {
        draft: cachedRequests.filter(r => r.status === 'draft').length,
        pending: cachedRequests.filter(r => r.status === 'pending').length,
        rejected: cachedRequests.filter(r => r.status === 'rejected').length,
        denied: cachedRequests.filter(r => r.status === 'denied').length,
        withdrawn: cachedRequests.filter(r => r.status === 'withdrawn').length,
        approved: cachedRequests.filter(r => r.status === 'approved').length,
        published: cachedRequests.filter(r => r.status === 'published').length,
        undone: cachedRequests.filter(r => r.status === 'undone').length,
        all: cachedRequests.length
    };

    if (activeCrSubTab === 'pending' && counts.pending === 0) {
        if (hasPermission('changes:publish') && counts.approved > 0) {
            activeCrSubTab = 'approved';
        } else if (counts.rejected > 0) {
            activeCrSubTab = 'rejected';
        } else if (counts.draft > 0) {
            activeCrSubTab = 'draft';
        }
    }

    const roleSlug = PortalState.effectiveRole || 'super_admin';
    const subtabs = [
        ...(counts.draft > 0 || !isReviewerView ? [{ id: 'draft', label: 'Drafts', count: counts.draft, urgent: false }] : []),
        { id: 'pending', label: 'Pending Review', count: counts.pending, urgent: counts.pending > 0 && ['reviewer', 'super_admin', 'administrator'].includes(roleSlug) },
        { id: 'rejected', label: 'Needs Revision', count: counts.rejected, urgent: counts.rejected > 0 },
        ...(counts.denied > 0 ? [{ id: 'denied', label: 'Denied (Closed)', count: counts.denied, urgent: false }] : []),
        { id: 'approved', label: 'Approved (Ready to Publish)', count: counts.approved, urgent: counts.approved > 0 && hasPermission('changes:publish') },
        { id: 'published', label: 'Published', count: counts.published, urgent: false },
        ...(counts.withdrawn > 0 ? [{ id: 'withdrawn', label: 'Withdrawn', count: counts.withdrawn, urgent: false }] : []),
        ...(counts.undone > 0 ? [{ id: 'undone', label: 'Undone', count: counts.undone, urgent: false }] : []),
        { id: 'all', label: 'All History', count: counts.all, urgent: false }
    ];

    container.innerHTML = `
        <div class="panel-card">
            <div class="panel-header">
                <div class="panel-title-group">
                    <div class="panel-title-icon">${SVG_ICONS.checkSquare}</div>
                    <div>
                        <h3>${isReviewerView ? `Visual Station Reviewer Workspace — DA-${PortalState.currentStation.toUpperCase()}` : `Visual Change Requests & Publish Queue — DA-${PortalState.currentStation.toUpperCase()}`}</h3>
                        <div class="help-tip">Each request shows a live photo/polygon thumbnail and changed-field chips. Click <strong>Inspect Visual Diff</strong> to review the interactive Campus Spatial Map overlay, Before vs. After visitor map cards, and word-level diffs.</div>
                    </div>
                </div>
                <div class="cr-view-mode-group" id="cr-view-mode-toggle">
                    <button type="button" class="cr-view-mode-btn ${crQueueViewMode === 'cards' ? 'active' : ''}" data-cr-view="cards"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg> Visual Cards</button>
                    <button type="button" class="cr-view-mode-btn ${crQueueViewMode === 'table' ? 'active' : ''}" data-cr-view="table"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg> Compact Table</button>
                </div>
            </div>

            <div class="subtabs-strip" id="cr-subtabs">
                ${subtabs.map(t => `
                    <button type="button" class="subtab-pill ${activeCrSubTab === t.id ? 'active' : ''} ${t.urgent ? 'is-urgent' : ''}" data-cr-tab="${t.id}">
                        <span>${escapeHtml(t.label)}</span>
                        <span class="subtab-count">${t.count}</span>
                    </button>
                `).join('')}
            </div>

            <div id="cr-list-host"></div>
            <div id="cr-pagination-host" class="log-pagination-bar"></div>
        </div>
    `;

    renderCrListTable();

    container.querySelectorAll('[data-cr-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            activeCrSubTab = btn.dataset.crTab;
            crQueuePage = 1;
            container.querySelectorAll('[data-cr-tab]').forEach(b => b.classList.toggle('active', b.dataset.crTab === activeCrSubTab));
            renderCrListTable();
        });
    });

    container.querySelectorAll('[data-cr-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            crQueueViewMode = btn.dataset.crView;
            setSavedPortalPref('iguide_pref_cr_view', crQueueViewMode);
            container.querySelectorAll('[data-cr-view]').forEach(b => b.classList.toggle('active', b.dataset.crView === crQueueViewMode));
            renderCrListTable();
        });
    });
}

export async function renderAdminReviewsTab(container) {
    if (PortalState.effectiveRole === 'administrator' && activeCrSubTab === 'pending') {
        activeCrSubTab = 'approved';
    }
    await renderChangeRequestWorkspace(container, { isReviewerView: false });
}

export async function renderReviewQueueTab(container) {
    if (PortalState.effectiveRole === 'reviewer' && (activeCrSubTab === 'approved' || activeCrSubTab === 'published')) {
        activeCrSubTab = 'pending';
    }
    await renderChangeRequestWorkspace(container, { isReviewerView: true });
}

if (typeof window !== 'undefined') {
    window.setCrSubTab = (subTab) => {
        if (subTab) activeCrSubTab = String(subTab);
    };
}

window.withdrawChangeRequestNow = async (id) => {
    const ok = await showPortalConfirm({
        title: `Withdraw Request #${id}?`,
        message: 'Cancel this submission and remove it from the active review queue? It will remain recorded in All History.',
        confirmLabel: 'Withdraw Request',
        cancelLabel: 'Keep Request',
        danger: true
    });
    if (!ok) return;
    try {
        await apiFetch(`/api/admin/change-requests/${id}/withdraw`, { method: 'POST', body: '{}' });
        broadcastDbSync();
        showToast(`Request #${id} withdrawn.`);
        if (currentCrContainer) await renderChangeRequestWorkspace(currentCrContainer, { isReviewerView: currentIsReviewerView });
    } catch (err) {
        showToast(err.message);
    }
};

window.submitDraftRequestNow = async (id) => {
    const ok = await showPortalConfirm({
        title: `Submit Grouped Draft #${id} for Review?`,
        message: 'Send all accumulated changes in this draft as one change request to your Station Reviewer?',
        confirmLabel: 'Submit for Review',
        cancelLabel: 'Keep as Draft'
    });
    if (!ok) return;
    try {
        await apiFetch(`/api/admin/change-requests/${id}/submit-draft`, { method: 'POST', body: '{}' });
        broadcastDbSync();
        showToast(`Draft #${id} submitted for Reviewer approval.`);
        if (currentCrContainer) await renderChangeRequestWorkspace(currentCrContainer, { isReviewerView: currentIsReviewerView });
    } catch (err) {
        showToast(err.message);
    }
};

window.rebaseChangeRequestNow = async (id) => {
    const ok = await showPortalConfirm({
        title: `Rebase Request #${id} onto Live Version?`,
        message: 'Update this request snapshot to the latest live record version while keeping your proposed changes?',
        confirmLabel: 'Rebase Now',
        cancelLabel: 'Cancel'
    });
    if (!ok) return;
    try {
        const out = await apiFetch(`/api/admin/change-requests/${id}/rebase`, { method: 'POST', body: '{}' });
        broadcastDbSync();
        showToast(`Request #${id} rebased onto live version v${out.baseVersion}.`);
        if (currentCrContainer) await renderChangeRequestWorkspace(currentCrContainer, { isReviewerView: currentIsReviewerView });
    } catch (err) {
        showToast(err.message);
    }
};

window.undoPublishedRequestNow = async (id) => {
    const ok = await showPortalConfirm({
        title: `Undo Published Request #${id}?`,
        message: 'Revert this published change back to its pre-publish snapshot? This creates an audited undo entry in version history.',
        confirmLabel: 'Undo Publish',
        cancelLabel: 'Cancel',
        danger: true
    });
    if (!ok) return;
    try {
        await apiFetch(`/api/admin/change-requests/${id}/undo-publish`, { method: 'POST', body: '{}' });
        broadcastDbSync();
        lastOverviewData = null;
        showToast(`Undid publish of Request #${id} and restored prior live state.`);
        if (currentCrContainer) await renderChangeRequestWorkspace(currentCrContainer, { isReviewerView: currentIsReviewerView });
    } catch (err) {
        showToast(err.message);
    }
};

window.publishChangeRequestNow = async (id, triggerEl = null) => {
    const cr = cachedRequests.find(r => r.id === Number(id));
    const stLabel = `DA-${String(cr?.station_id || PortalState.currentStation || 'lares').toUpperCase()}`;
    const summaryLabel = cr?.summary ? `"${cr.summary}"` : `Change Request #${id}`;
    const isSelfSubmitted = Boolean(cr?.is_own_submission);
    const isSuper = PortalState.baseRole === 'super_admin';

    let overrideReason = '';
    if (isSelfSubmitted && isSuper) {
        const resConfirm = await showPortalConfirm({
            title: `Super Admin Self-Publish Override (Request #${id})`,
            message: `You submitted ${summaryLabel}. Enter a written override reason to publish your own submission live to ${stLabel}:`,
            confirmLabel: 'Override & Publish Live',
            cancelLabel: 'Cancel',
            requireReason: true,
            reasonLabel: 'Override Reason (logged in audit trail)',
            reasonPlaceholder: 'e.g. Verified field correction with station lead'
        });
        if (!resConfirm?.confirmed) return;
        overrideReason = resConfirm.reason;
    } else {
        const ok = await showPortalConfirm({
            title: `Publish Approved Edit Live? (Request #${id})`,
            message: `Are you sure you want to publish ${summaryLabel} live to the ${stLabel} public 3D map and database? Visitors will see this update immediately.`,
            confirmLabel: 'Publish Live Now',
            cancelLabel: 'Cancel',
            danger: false
        });
        if (!ok) return;
    }
    return guardAsyncAction(triggerEl, async () => {
        try {
            await apiFetch(`/api/admin/change-requests/${id}/publish`, {
                method: 'POST',
                body: JSON.stringify(overrideReason ? { override_reason: overrideReason } : {})
            });
            closeGovModal();
            broadcastDbSync();
            lastOverviewData = null;
            showToast(`Change Request #${id} published live & pushed to maps!`);
            if (currentCrContainer) await renderChangeRequestWorkspace(currentCrContainer, { isReviewerView: currentIsReviewerView });
        } catch (err) {
            showToast(err.message);
        }
    }, { lockKey: `publish-cr-${id}`, cooldownMs: 1200, busyText: 'Publishing...' });
};

window.openCrDiffModal = async (crId, focusMode = '') => {
    const cr = cachedRequests.find(r => r.id === Number(crId));
    if (!cr) return;

    await ensureStationOverviewLoaded(cr.station_id || PortalState.currentStation);

    const diffRows = buildDiffRows(cr);
    const changedRows = diffRows.filter(d => d.changed);
    const payloadObj = parseJsonSafe(cr.payload_json);
    const diffSpec = buildCampusSpatialDiffSpec(cr, lastOverviewData);
    const spatialMapHtml = renderSpatialContextMapHtml({
        stageId: 'cr-modal-spatial',
        overview: lastOverviewData,
        targetBuildingCode: diffSpec.ctx.building?.building_code || null,
        targetPlotId: diffSpec.ctx.plot?.id ?? null,
        diffSpec,
        compact: true
    });

    const isReviewerRole = PortalState.effectiveRole === 'reviewer' || PortalState.effectiveRole === 'super_admin';
    const canDecide = isReviewerRole && hasPermission('reviews:decide') && cr.status === 'pending';
    const canPublishNow = hasPermission('changes:publish') && cr.status === 'approved';
    const canRevise = (hasPermission('buildings:draft_change') || hasPermission('plots:draft_change') || hasPermission('offices:draft_change')) && cr.status === 'rejected';

    const changedKeysSet = new Set(changedRows.map(d => d.key));
    const changedLabelsSummary = changedRows.length
        ? changedRows.map(d => d.label).join(', ')
        : 'No content field differences';
    let showAllFields = false;
    let cardPreviewMode = 'side'; // Default: Side-by-Side Before vs. After comparison

    const renderCards = () => {
        const rowsToShow = showAllFields ? diffRows : (changedRows.length ? changedRows : diffRows);
        return renderVisualDiffCardsHtml(rowsToShow, cr.action);
    };

    const crTableLower = String(cr.target_table || '').toLowerCase();
    const isMapGeometry = crTableLower === 'map_geometry';
    const geomInfo = isMapGeometry ? getGeomDiffSummary(cr) : null;

    const editableKeys = isMapGeometry ? [] : Object.keys(payloadObj)
        .filter(k => !TECHNICAL_SKIP_KEYS.has(k) && !['footprint_geojson', 'polygon_geojson', 'coordinates_json', 'split_polygon_geojson', 'updated_parent_polygon_geojson'].includes(k))
        .sort((a, b) => Number(changedKeysSet.has(b)) - Number(changedKeysSet.has(a)));
    const reviseSectionHtml = canRevise ? (isMapGeometry ? `
        <div style="margin-top:18px; padding:14px 16px; border-radius:12px; background:rgba(14,165,233,0.08); border:1px solid rgba(56,189,248,0.30); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div>
                <h4 style="color:#38bdf8; font-size:13.5px; margin:0 0 4px;">Revise Geometry in Visual Map Editor</h4>
                <div class="help-tip" style="margin:0;">Open <strong>${escapeHtml(geomInfo.editorTitle)}</strong>, adjust the flagged features based on your Reviewer's feedback, and click Save to submit an updated request.</div>
            </div>
            <button type="button" class="btn btn-blue btn-sm" id="cr-open-geom-editor-btn">Open ${escapeHtml(geomInfo.editorTitle)} →</button>
        </div>
    ` : `
        <div style="margin-top:18px; padding:14px 16px; border-radius:12px; background:rgba(14,165,233,0.08); border:1px solid rgba(56,189,248,0.30);">
            <h4 style="color:#38bdf8; font-size:13.5px; margin-bottom:6px;">Revise & Resubmit Payload (Pre-Filled)</h4>
            <div class="help-tip" style="margin-bottom:12px;">Update the flagged fields below based on your Station Reviewer's feedback and send back to Pending Review.</div>
            <div class="form-group">
                <label>Updated Change Summary</label>
                <input type="text" id="cr-revise-summary" class="form-control" value="${escapeHtml(cr.summary)}">
            </div>
            <div class="form-grid-2">
                ${editableKeys.map(k => {
        const val = payloadObj[k] === undefined || payloadObj[k] === null ? '' : (typeof payloadObj[k] === 'object' ? JSON.stringify(payloadObj[k]) : String(payloadObj[k]));
        const lbl = humanFieldLabel(k);
        if (k === 'facility_status') {
            return `<div class="form-group"><label>${escapeHtml(lbl)}</label><select class="form-control cr-rev-field" data-field="${escapeHtml(k)}">${['Existing', 'Under Construction', 'Proposed'].map(s => `<option value="${s}" ${val === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>`;
        }
        return `<div class="form-group"><label>${escapeHtml(lbl)}</label><input type="text" class="form-control cr-rev-field" data-field="${escapeHtml(k)}" value="${escapeHtml(val)}"></div>`;
    }).join('')}
            </div>
        </div>
    `) : '';

    const reviewChecklistOptions = isMapGeometry
        ? ['Building / Plot Alignment', 'Pill Label Placement', 'Road / Entrance Connection', 'Tree Placement / Scale', 'Missing or Extra Feature', 'Boundary Overlap']
        : (crTableLower === 'agricultural_plots' || crTableLower === 'plot_subplots'
            ? ['Plot / Zone Name', 'Planted Crop', 'Cropping Cycle', 'Growth Stage', 'Tree / Plant Count', 'Plot Description', 'Polygon Shape']
            : (crTableLower === 'building_offices'
                ? ['Office Name', 'Floor / Level', 'Room Number', 'Office Description']
                : ['Photo / Crop', 'Photo Order (#1/#2)', 'Photo Caption', 'Building Name', 'Directory Description', 'How to Spot It', "What's Inside & Services", 'Facility Status', 'Map Position']));

    const reviewDecisionHtml = canDecide ? `
        <div style="margin-top:18px; padding:14px 16px; border-radius:12px; background:rgba(245,158,11,0.08); border:1px solid rgba(251,191,36,0.32);">
            <h4 style="color:#fbbf24; font-size:13.5px; margin-bottom:8px;">Station Reviewer Decision (DA-${escapeHtml(String(cr.station_id || '').toUpperCase())})</h4>
            <div style="margin-bottom:10px;">
                <div style="font-size:11px; font-weight:700; color:#fde68a; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:6px;">Flag Parts Needing Revision (Check all that apply when requesting changes)</div>
                <div class="cr-rev-checklist-grid" id="cr-review-checklist">
                    ${reviewChecklistOptions.map(opt => `
                        <label class="cr-rev-check-pill">
                            <input type="checkbox" value="${escapeHtml(opt)}">
                            <span>${escapeHtml(opt)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label for="cr-modal-review-cmt">Reviewer Note / Specific Instructions</label>
                <textarea id="cr-modal-review-cmt" class="form-control" rows="2" placeholder="Add specific wording or guidance for the GIS Editor (required when denying if no boxes checked)..."></textarea>
            </div>
        </div>
    ` : '';

    let footerHtml = `<button type="button" class="btn btn-secondary" onclick="closeGovModal()">Close</button>`;
    if (canDecide) {
        footerHtml += `
            <button type="button" class="btn btn-danger" id="cr-modal-deny-close-btn">Deny (No Revision)</button>
            <button type="button" class="btn btn-secondary" id="cr-modal-deny-btn" style="border-color:rgba(245,158,11,0.45); color:#f59e0b;">Request Revision</button>
            <button type="button" class="btn btn-emerald" id="cr-modal-approve-btn">Approve for Publishing</button>
        `;
    }
    if (canRevise && !isMapGeometry) {
        footerHtml += `<button type="button" class="btn btn-emerald" id="cr-modal-resubmit-btn">Revise & Resubmit to Reviewer →</button>`;
    }
    if (canPublishNow) {
        footerHtml += `<button type="button" class="btn btn-emerald" onclick="publishChangeRequestNow(${cr.id})">Publish Live to Map & Database</button>`;
    }

    destroyActiveGeomDiffMap();

    openGovModal({
        title: `Visual Diff & Map Inspector — ${cr.summary} (Request #${cr.id})`,
        maxWidth: '1120px',
        bodyHtml: `
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
                ${renderCrStepper(cr)}
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${!isMapGeometry ? `<button type="button" class="btn btn-secondary btn-sm" id="cr-toggle-locator-btn" aria-expanded="false">${SVG_ICONS.map} <span>Aerial Campus Locator</span></button>` : ''}
                    <a href="/?station=${encodeURIComponent(cr.station_id || PortalState.currentStation)}" target="_blank" class="btn btn-secondary btn-sm">Open Live 3D Map ↗</a>
                    ${!isMapGeometry ? `<button type="button" class="btn btn-secondary btn-sm" id="cr-toggle-all-fields-btn">Show All Fields (${diffRows.length})</button>` : ''}
                </div>
            </div>

            ${cr.reviewer_comment ? `
                <div class="alert-revision-card" style="${!['rejected', 'denied'].includes(cr.status) ? 'background:rgba(16,185,129,0.10); border-color:rgba(52,211,153,0.32);' : ''}">
                    <strong style="color:${['rejected', 'denied'].includes(cr.status) ? '#fda4af' : '#34d399'}; font-size:12.5px;">${cr.status === 'denied' ? 'Denial Reason' : 'Reviewer Comment'} (${renderCrActorHtml(cr, 'reviewed')}):</strong>
                    <div style="color:#f8fafc; font-size:13px; margin-top:4px;">"${escapeHtml(cr.reviewer_comment)}"</div>
                </div>
            ` : ''}

            ${isMapGeometry ? `
                ${renderMapGeomVisualDiffHtml(cr)}
            ` : `
                <div id="cr-aerial-locator-panel" hidden style="margin-bottom:14px;">
                    ${spatialMapHtml}
                </div>

                <div class="cr-change-summary-bar">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <span class="status-pill status-pill-live">${changedRows.length} ${changedRows.length === 1 ? 'Field' : 'Fields'} Updated</span>
                        <span style="font-size:12.5px; color:#e2e8f0; font-weight:600;">${escapeHtml(changedLabelsSummary)}</span>
                    </div>
                    <div class="cr-preview-mode-tabs" id="cr-card-mode-tabs">
                        <button type="button" class="cr-preview-mode-btn active" data-card-mode="side">Side-by-Side</button>
                        <button type="button" class="cr-preview-mode-btn" data-card-mode="slider" title="Interactive Before / After Split Slider">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px; margin-right:3px;"><path d="m18 8 4 4-4 4"/><path d="M2 12h20"/><path d="m6 8-4 4 4 4"/></svg>Split Slider
                        </button>
                        <button type="button" class="cr-preview-mode-btn" data-card-mode="after">After Only</button>
                        <button type="button" class="cr-preview-mode-btn" data-card-mode="before">Before Only</button>
                    </div>
                </div>

                <div id="cr-visitor-card-host" style="margin-bottom:14px;">
                    ${renderCrVisualPreviewHtml(cr, cardPreviewMode, changedKeysSet)}
                </div>
            `}

            <details class="cr-tech-diff-details">
                <summary class="cr-tech-diff-summary">
                    <span>${isMapGeometry ? `Geometry Summary Breakdown (${changedRows.length} groups)` : `Field-by-Field Breakdown (${changedRows.length} changed)`}</span>
                    <span style="font-size:11px; color:#94a3b8; font-weight:500;">Click to expand summary comparison</span>
                </summary>
                <div style="padding-top:12px;">
                    <div id="cr-diff-cards-host" style="display:flex; flex-direction:column; gap:10px;">
                        ${renderCards()}
                    </div>
                </div>
            </details>

            ${reviseSectionHtml}
            ${reviewDecisionHtml}
        `,
        footerHtml
    });

    if (isMapGeometry) {
        setTimeout(() => mountMapGeomVisualDiffMap(cr), 45);
        document.getElementById('cr-open-geom-editor-btn')?.addEventListener('click', () => {
            destroyActiveGeomDiffMap();
            closeGovModal();
            const navBtn = document.querySelector(`[data-tab="${geomInfo.editorTab}"]`);
            if (navBtn) navBtn.click();
        });
    }

    let crLocatorBound = false;
    document.getElementById('cr-toggle-locator-btn')?.addEventListener('click', (e) => {
        const panel = document.getElementById('cr-aerial-locator-panel');
        if (!panel) return;
        const willShow = panel.hidden;
        panel.hidden = !willShow;
        e.currentTarget.setAttribute('aria-expanded', willShow ? 'true' : 'false');
        e.currentTarget.innerHTML = `${SVG_ICONS.map} <span>${willShow ? 'Hide Aerial Locator' : 'Aerial Campus Locator'}</span>`;
        if (willShow && !crLocatorBound) {
            crLocatorBound = true;
            bindSpatialSvgPanZoom('cr-modal-spatial');
        }
    });

    window.updateCrSplitSlider = (pctVal) => {
        const pct = Math.max(0, Math.min(100, Number(pctVal) || 0));
        const stage = document.getElementById('cr-split-curtain-stage');
        const range = document.getElementById('cr-split-range-input');
        const lbl = document.getElementById('cr-split-pct-label');
        if (stage) stage.style.setProperty('--split-pct', `${pct}%`);
        if (range && Number(range.value) !== Math.round(pct)) range.value = String(Math.round(pct));
        if (lbl) lbl.textContent = `${Math.round(pct)}%`;
    };

    const bindCrSplitCurtainDrag = () => {
        const stage = document.getElementById('cr-split-curtain-stage');
        if (!stage) return;
        let dragging = false;
        const updateFromClientX = (clientX) => {
            const rect = stage.getBoundingClientRect();
            if (!rect.width) return;
            const pct = ((clientX - rect.left) / rect.width) * 100;
            window.updateCrSplitSlider(pct);
        };
        stage.addEventListener('dragstart', (e) => e.preventDefault());
        stage.querySelectorAll('img').forEach(img => { img.draggable = false; });
        stage.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            dragging = true;
            try { stage.setPointerCapture(e.pointerId); } catch (_) { }
            updateFromClientX(e.clientX);
        });
        stage.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            e.preventDefault();
            updateFromClientX(e.clientX);
        });
        const stop = () => { dragging = false; };
        stage.addEventListener('pointerup', stop);
        stage.addEventListener('pointercancel', stop);
    };

    document.querySelectorAll('#cr-card-mode-tabs [data-card-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
            cardPreviewMode = btn.dataset.cardMode;
            document.querySelectorAll('#cr-card-mode-tabs [data-card-mode]').forEach(b => b.classList.toggle('active', b.dataset.cardMode === cardPreviewMode));
            const host = document.getElementById('cr-visitor-card-host');
            if (host) {
                host.innerHTML = renderCrVisualPreviewHtml(cr, cardPreviewMode, changedKeysSet);
                if (cardPreviewMode === 'slider') bindCrSplitCurtainDrag();
            }
        });
    });

    document.getElementById('cr-toggle-all-fields-btn')?.addEventListener('click', (e) => {
        showAllFields = !showAllFields;
        e.currentTarget.textContent = showAllFields ? `Show Changed Only (${changedRows.length})` : `Show All Fields (${diffRows.length})`;
        const host = document.getElementById('cr-diff-cards-host');
        if (host) host.innerHTML = renderCards();
    });

    const sendDecision = async (decision, triggerBtn) => {
        const cmtEl = document.getElementById('cr-modal-review-cmt');
        const rawNote = cmtEl ? cmtEl.value.trim() : '';
        const checkedItems = Array.from(document.querySelectorAll('#cr-review-checklist input[type="checkbox"]:checked'))
            .map(cb => cb.value)
            .filter(Boolean);
        let comment = rawNote;
        if (checkedItems.length > 0) {
            comment = `Flagged for revision: [${checkedItems.join(', ')}]${rawNote ? ' — ' + rawNote : ''}`;
        }
        if (decision === 'rejected' && !comment) {
            showToast('Please check at least one item or enter a review note explaining what to revise.');
            cmtEl?.focus();
            return;
        }
        if (decision === 'denied') {
            const okDeny = await showPortalConfirm({
                title: `Deny & Close Request #${cr.id} Without Revision?`,
                message: 'This will permanently close the request without sending it back to the GIS Editor for revision. It will stay logged in All History.',
                confirmLabel: 'Deny & Close',
                cancelLabel: 'Cancel',
                danger: true
            });
            if (!okDeny) return;
        }
        if (triggerBtn) triggerBtn.disabled = true;
        try {
            const payloadBody = { decision, comment };
            if (decision === 'approved' && (cr.is_stale_base || (PortalState.baseRole === 'super_admin' && Boolean(cr.is_own_submission)))) {
                const ov = await showPortalConfirm({
                    title: cr.is_stale_base ? 'Override Outdated Base Version?' : 'Super Admin Self-Approval Override',
                    message: cr.is_stale_base
                        ? `Request #${cr.id} is based on v${cr.base_version} while live is v${cr.live_version}. Enter a written override note (or cancel and Rebase first).`
                        : 'You submitted this request. Super Admin self-approval requires a written reason that will be recorded in the audit log.',
                    confirmLabel: 'Override & Approve',
                    cancelLabel: 'Cancel',
                    requireReason: true,
                    reasonLabel: 'Override Reason (required)',
                    reasonPlaceholder: 'Explain why this approval override is safe...'
                });
                if (!ov?.confirmed) {
                    if (triggerBtn) triggerBtn.disabled = false;
                    return;
                }
                payloadBody.override_reason = ov.reason;
            }
            const res = await apiFetch(`/api/review/requests/${cr.id}/decide`, {
                method: 'POST',
                body: JSON.stringify(payloadBody)
            });
            closeGovModal();
            broadcastDbSync();
            lastOverviewData = null;
            showToast(decision === 'approved'
                ? `Approved "${cr.summary}"${res.adminNotified ? ' & notified Administrator!' : '!'}`
                : (decision === 'denied'
                    ? `Denied and closed "${cr.summary}" (no revision required).`
                    : `Returned "${cr.summary}" to GIS Editor for revision.`));
            if (currentCrContainer) await renderChangeRequestWorkspace(currentCrContainer, { isReviewerView: currentIsReviewerView });
        } catch (err) {
            showToast(err.message);
            if (triggerBtn) triggerBtn.disabled = false;
        }
    };

    document.getElementById('cr-modal-approve-btn')?.addEventListener('click', (e) => sendDecision('approved', e.currentTarget));
    document.getElementById('cr-modal-deny-btn')?.addEventListener('click', (e) => sendDecision('rejected', e.currentTarget));
    document.getElementById('cr-modal-deny-close-btn')?.addEventListener('click', (e) => sendDecision('denied', e.currentTarget));

    document.getElementById('cr-modal-resubmit-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
            const nextPayload = { ...payloadObj };
            document.querySelectorAll('.cr-rev-field').forEach(inp => {
                const k = inp.dataset.field;
                const rawVal = inp.value;
                const origType = typeof payloadObj[k];
                if (origType === 'object' && payloadObj[k] !== null) {
                    try { nextPayload[k] = JSON.parse(rawVal); } catch (_) { nextPayload[k] = rawVal; }
                } else if (origType === 'number') {
                    nextPayload[k] = rawVal.trim() === '' ? null : Number(rawVal);
                } else if (origType === 'boolean') {
                    nextPayload[k] = rawVal === 'true' || rawVal === '1';
                } else {
                    nextPayload[k] = rawVal;
                }
            });
            const nextSummary = document.getElementById('cr-revise-summary')?.value.trim() || cr.summary;
            await apiFetch(`/api/admin/change-requests/${cr.id}/resubmit`, {
                method: 'POST',
                body: JSON.stringify({ summary: nextSummary, payload_json: nextPayload })
            });
            closeGovModal();
            lastOverviewData = null;
            showToast(`Revised & resubmitted "${cr.summary}" back to Station Reviewer!`);
            activeCrSubTab = 'pending';
            if (currentCrContainer) await renderChangeRequestWorkspace(currentCrContainer, { isReviewerView: currentIsReviewerView });
        } catch (err) {
            showToast(err.message);
            btn.disabled = false;
        }
    });

    // Always start the Visual Diff & Map Inspector scrolled to the very top
    const modalBody = document.getElementById('gov-modal-body');
    if (modalBody) modalBody.scrollTop = 0;
};

// =========================================================================
// READ-ONLY VISUAL STATION DIRECTORY (REVIEWER & ADMINISTRATOR)
// =========================================================================
window.openReviewerSuggestModal = (entityType, entityId) => {
    const data = lastOverviewData;
    if (!data) return;

    let record = null;
    let entityName = '';
    let fields = [];

    if (entityType === 'building') {
        record = (data.buildings || []).find(b => b.building_code === String(entityId) || String(b.id) === String(entityId));
        if (!record) return;
        entityName = record.name || record.building_code;
        fields = [
            { key: 'description', label: 'Directory Description / Notes' },
            { key: 'visual_landmark', label: 'How to Spot It (Visual Landmark)' },
            { key: 'key_services', label: "What's Inside & Services" },
            { key: 'name', label: 'Building Name' },
            { key: 'facility_status', label: 'Facility Status (Existing / Under Construction / Proposed)' },
            { key: 'photo', label: 'Facility Photos / Cover Image' },
            { key: 'general', label: 'Other Concern / Geometry' }
        ];
    } else if (entityType === 'office') {
        record = (data.offices || []).find(o => String(o.id) === String(entityId));
        if (!record) return;
        entityName = record.office_name || 'Internal Office';
        fields = [
            { key: 'office_name', label: 'Office / Unit Name' },
            { key: 'floor_or_room', label: 'Floor / Level' },
            { key: 'room_number', label: 'Room Number' },
            { key: 'description', label: 'Office Role & Directory Notes' },
            { key: 'general', label: 'Other Office Concern (Add / Relocate / Remove)' }
        ];
    } else if (entityType === 'plot') {
        record = (data.plots || []).find(p => String(p.id) === String(entityId));
        if (!record) return;
        entityName = record.zone_name || record.plot_number || 'Agricultural Plot';
        fields = [
            { key: 'description', label: 'Plot Overview Description' },
            { key: 'current_crop', label: 'Current Planted Crop / Variety' },
            { key: 'status', label: 'Growth / Field Stage' },
            { key: 'cycle_months', label: 'Cropping Cycle' },
            { key: 'tree_or_plant_count', label: 'Tree / Plant Count' },
            { key: 'zone_name', label: 'Plot / Zone Name' },
            { key: 'general', label: 'Other Plot Concern' }
        ];
    } else {
        return;
    }

    const getCurVal = (k) => {
        if (!record || k === 'general' || k === 'photo') return '';
        const v = record[k];
        return v === undefined || v === null ? '' : String(v);
    };

    openGovModal({
        title: `Suggest Change to GIS Editor — ${entityName}`,
        maxWidth: '620px',
        bodyHtml: `
            <div style="padding:11px 14px; border-radius:10px; background:rgba(245,158,11,0.10); border:1px solid rgba(251,191,36,0.32); margin-bottom:14px; font-size:12.5px; color:#fde68a; line-height:1.45;">
                Pick which part of <strong>${escapeHtml(entityName)}</strong> needs updating and write your suggested wording. This will notify your station's <strong>GIS Editor</strong> to apply the revision and submit it back for your final approval.
            </div>

            <div class="form-group">
                <label>1. Check Which Part(s) Need Revision</label>
                <div class="cr-rev-checklist-grid" id="rv-sug-checklist">
                    ${fields.map((f, idx) => `
                        <label class="cr-rev-check-pill">
                            <input type="checkbox" value="${escapeHtml(f.key)}" data-label="${escapeHtml(f.label)}" ${idx === 0 ? 'checked' : ''}>
                            <span>${escapeHtml(f.label)}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="form-group" id="rv-sug-current-wrap">
                <label id="rv-sug-current-lbl">Current Live Value (Reference)</label>
                <div id="rv-sug-current-val" style="padding:9px 12px; border-radius:9px; background:rgba(9,13,22,0.75); border:1px solid rgba(148,163,184,0.2); font-size:12.5px; color:#94a3b8; line-height:1.45; min-height:36px;"></div>
            </div>

            <div class="form-group">
                <label for="rv-sug-value">2. Suggested New Wording / Value</label>
                <textarea id="rv-sug-value" class="form-control" rows="3" placeholder="Type the exact updated text or value you want the GIS Editor to apply..."></textarea>
            </div>

            <div class="form-group" style="margin-bottom:0;">
                <label for="rv-sug-note">3. Concern / Note for GIS Editor (Optional)</label>
                <input type="text" id="rv-sug-note" class="form-control" placeholder="e.g. Updated official name, tighten photo crop, or corrected crop variety">
            </div>
        `,
        footerHtml: `
            <button type="button" class="btn btn-secondary" onclick="closeGovModal()">Cancel</button>
            <button type="button" class="btn btn-emerald" id="rv-sug-submit-btn">Send Suggestion to GIS Editor →</button>
        `
    });

    const curValEl = document.getElementById('rv-sug-current-val');
    const curLblEl = document.getElementById('rv-sug-current-lbl');
    const sugInput = document.getElementById('rv-sug-value');

    const getCheckedFields = () => Array.from(document.querySelectorAll('#rv-sug-checklist input[type="checkbox"]:checked')).map(cb => ({
        key: cb.value,
        label: cb.dataset.label || cb.value
    }));

    const syncCurrentField = () => {
        const checked = getCheckedFields();
        const primary = checked[0] || fields[0];
        if (curLblEl) curLblEl.textContent = primary ? `Current Live Value — ${primary.label}` : 'Current Live Value (Reference)';
        const cur = primary ? getCurVal(primary.key) : '';
        if (curValEl) curValEl.textContent = cur || '(Currently blank / not set)';
        if (sugInput && !sugInput.dataset.userTyped) {
            sugInput.value = cur;
        }
    };
    sugInput?.addEventListener('input', () => { sugInput.dataset.userTyped = '1'; });
    document.querySelectorAll('#rv-sug-checklist input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
            if (sugInput) delete sugInput.dataset.userTyped;
            syncCurrentField();
        });
    });
    syncCurrentField();

    document.getElementById('rv-sug-submit-btn')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const checked = getCheckedFields();
        if (checked.length === 0) {
            showToast('Please check at least one part that needs revision.');
            return;
        }
        const primary = checked[0];
        const allLabels = checked.map(c => c.label).join(', ');
        const suggestedVal = sugInput ? sugInput.value.trim() : '';
        const note = document.getElementById('rv-sug-note')?.value.trim() || '';
        if (!suggestedVal && !note) {
            showToast('Please enter a suggested change or concern note.');
            sugInput?.focus();
            return;
        }
        btn.disabled = true;
        try {
            await apiFetch('/api/review/suggest-change', {
                method: 'POST',
                body: JSON.stringify({
                    station_id: PortalState.currentStation,
                    entity_type: entityType,
                    entity_id: String(entityType === 'building' ? (record.building_code || record.id) : record.id),
                    entity_name: entityName,
                    field_key: primary.key,
                    field_label: allLabels,
                    suggested_value: suggestedVal,
                    concern_note: note
                })
            });
            closeGovModal();
            showToast(`Suggestion sent to GIS Editor for ${entityName}!`);
        } catch (err) {
            showToast(err.message || 'Could not send suggestion');
            btn.disabled = false;
        }
    });
};

window.openReadOnlyBuildingModal = (buildingCode) => {
    const data = lastOverviewData;
    if (!data) return;
    const b = (data.buildings || []).find(x => x.building_code === buildingCode);
    if (!b) return;

    const photos = (b.images || [])
        .map(img => ({
            url: normalizeImgSrc(img.image_webp_url || img.image_url || ''),
            caption: img.caption || b.name
        }))
        .filter(p => p.url);
    const offices = (data.offices || []).filter(o => o.building_code === b.building_code);
    const pinColor = b.pin_color || b.color || '#10b981';
    const bNum = b.building_num !== null && b.building_num !== undefined ? b.building_num : '•';
    const locatorMapHtml = renderSpatialContextMapHtml({
        stageId: 'ro-bldg-modal-map',
        overview: data,
        targetBuildingCode: b.building_code,
        compact: true
    });
    roSlideIndex = 0;

    openGovModal({
        title: `Map Card, Campus Footprint & Photo Gallery — ${b.name}`,
        maxWidth: '780px',
        bodyHtml: `
            <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                <button type="button" class="btn btn-secondary btn-sm" id="ro-bldg-toggle-locator-btn" aria-expanded="false">${SVG_ICONS.map} <span>Aerial Campus Locator</span></button>
                <a href="/?station=${encodeURIComponent(PortalState.currentStation)}" target="_blank" class="btn btn-secondary btn-sm">Open Live 3D Map ↗</a>
            </div>
            <div id="ro-bldg-locator-panel" hidden style="margin-bottom:12px;">
                ${locatorMapHtml}
            </div>
            <div class="bldg-live-preview-card">
                <div class="blp-header">
                    <div class="pin-live-circle" style="background:${escapeHtml(pinColor)};">${escapeHtml(String(bNum))}</div>
                    <div style="min-width:0; flex:1;">
                        <div style="font-size:16px; font-weight:700; color:#f8fafc;">${escapeHtml(b.name)}</div>
                        <div style="font-size:12px; color:#94a3b8; margin-top:2px;">${escapeHtml(b.type_label || CATEGORY_LABELS[b.category] || 'Research Facility')}</div>
                        <div style="margin-top:6px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            ${renderFacilityStatusBadge(b.facility_status || 'Existing')}
                            ${b.model_glb_url ? `<span class="mono-code" style="color:#34d399;">3D Model: ${escapeHtml(b.model_glb_url)}</span>` : ''}
                        </div>
                    </div>
                </div>

                <div class="blp-hero-wrap" id="ro-modal-slideshow-host" style="height:240px;"></div>

                <div style="padding:8px 16px 16px;">
                    <div class="blp-wf-card visual">
                        <div style="font-size:10.5px; font-weight:700; color:#7dd3fc; letter-spacing:0.06em; margin-bottom:4px;">HOW TO SPOT IT</div>
                        <div style="font-size:12.5px; color:#e2e8f0; line-height:1.45;">${escapeHtml(b.visual_landmark || b.visual_guidance || 'Visual landmark guidance not yet entered.')}</div>
                    </div>
                    <div class="blp-wf-card services">
                        <div style="font-size:10.5px; font-weight:700; color:#86efac; letter-spacing:0.06em; margin-bottom:4px;">WHAT'S INSIDE & SERVICES</div>
                        <div style="font-size:12.5px; color:#e2e8f0; line-height:1.45;">${escapeHtml(b.key_services || b.services || 'Key services not yet entered.')}</div>
                    </div>
                    ${b.description ? `<div style="font-size:12px; color:#cbd5e1; margin-top:8px; line-height:1.5;">${escapeHtml(b.description)}</div>` : ''}

                    ${offices.length > 0 ? `
                        <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08);">
                            <div style="font-size:11px; font-weight:700; color:#7dd3fc; letter-spacing:0.05em; margin-bottom:8px;">INTERNAL OFFICES IN THIS BUILDING (${offices.length})</div>
                            <div style="display:grid; gap:6px;">
                                ${offices.map(o => `
                                    <div style="padding:8px 11px; border-radius:9px; background:rgba(9,13,22,0.72); border:1px solid rgba(148,163,184,0.14); display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                                        <strong style="font-size:12.5px; color:#f8fafc;">${escapeHtml(o.office_name)}</strong>
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            <span class="ro-floor-pill">${escapeHtml(o.floor_or_room || 'Ground Floor')}</span>
                                            ${o.room_number ? `<span class="ro-room-pill">${escapeHtml(o.room_number)}</span>` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `,
        footerHtml: `
            ${(hasPermission('reviews:suggest') || hasPermission('reviews:decide')) ? `<button type="button" class="btn btn-blue" onclick="openReviewerSuggestModal('building', '${escapeHtml(b.building_code)}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> Suggest Change to GIS Editor</button>` : ''}
            <a href="/?station=${encodeURIComponent(PortalState.currentStation)}" target="_blank" class="btn btn-emerald">Open on Live 3D Map ↗</a>
            <button type="button" class="btn btn-secondary" onclick="closeGovModal()">Close Preview</button>
        `
    });

    let roBldgLocatorBound = false;
    document.getElementById('ro-bldg-toggle-locator-btn')?.addEventListener('click', (e) => {
        const panel = document.getElementById('ro-bldg-locator-panel');
        if (!panel) return;
        const willShow = panel.hidden;
        panel.hidden = !willShow;
        e.currentTarget.setAttribute('aria-expanded', willShow ? 'true' : 'false');
        e.currentTarget.innerHTML = `${SVG_ICONS.map} <span>${willShow ? 'Hide Aerial Locator' : 'Aerial Campus Locator'}</span>`;
        if (willShow && !roBldgLocatorBound) {
            roBldgLocatorBound = true;
            bindSpatialSvgPanZoom('ro-bldg-modal-map');
        }
    });

    const renderSlide = () => {
        const host = document.getElementById('ro-modal-slideshow-host');
        if (!host) return;
        if (!photos.length) {
            host.innerHTML = `<div class="ro-card-hero-empty">${SVG_ICONS.image}<span>No WebP photo uploaded for this building</span></div>`;
            return;
        }
        const safeIdx = ((roSlideIndex % photos.length) + photos.length) % photos.length;
        const cur = photos[safeIdx];
        host.innerHTML = `
            <img src="${escapeHtml(cur.url)}" alt="${escapeHtml(cur.caption)}">
            ${photos.length > 1 ? `
                <button type="button" class="bldg-hero-nav prev" id="ro-slide-prev" aria-label="Previous photo">‹</button>
                <button type="button" class="bldg-hero-nav next" id="ro-slide-next" aria-label="Next photo">›</button>
            ` : ''}
            <div style="position:absolute; left:10px; right:10px; bottom:10px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <span style="padding:3px 9px; border-radius:999px; background:rgba(2,6,23,0.82); color:#f8fafc; font-size:11px; font-weight:600;">${escapeHtml(cur.caption)}</span>
                <span style="padding:3px 9px; border-radius:999px; background:rgba(2,6,23,0.82); color:#7dd3fc; font-size:11px; font-weight:700;">${safeIdx + 1} / ${photos.length}</span>
            </div>
        `;
        document.getElementById('ro-slide-prev')?.addEventListener('click', () => { roSlideIndex -= 1; renderSlide(); });
        document.getElementById('ro-slide-next')?.addEventListener('click', () => { roSlideIndex += 1; renderSlide(); });
    };
    renderSlide();
};

window.openReadOnlyPlotModal = (plotId) => {
    const data = lastOverviewData;
    if (!data) return;
    const p = (data.plots || []).find(x => x.id === Number(plotId));
    if (!p) return;

    const plotColor = p.color || '#10b981';
    const imgSrc = normalizeImgSrc(p.image_webp_url || p.image_url || '');
    const subPlots = Array.isArray(p.subPlots) ? p.subPlots : [];
    const locatorMapHtml = renderSpatialContextMapHtml({
        stageId: 'ro-plot-modal-map',
        overview: data,
        targetPlotId: p.id,
        compact: true
    });

    openGovModal({
        title: `Agricultural Plot Card & Campus Polygon — ${p.zone_name}`,
        maxWidth: '760px',
        bodyHtml: `
            <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                <button type="button" class="btn btn-secondary btn-sm" id="ro-plot-toggle-locator-btn" aria-expanded="false">${SVG_ICONS.map} <span>Aerial Campus Locator</span></button>
                <a href="/?station=${encodeURIComponent(PortalState.currentStation)}" target="_blank" class="btn btn-secondary btn-sm">Open Live 3D Map ↗</a>
            </div>
            <div id="ro-plot-locator-panel" hidden style="margin-bottom:12px;">
                ${locatorMapHtml}
            </div>
            <div class="bldg-live-preview-card" style="border-color:${escapeHtml(plotColor)}66;">
                <div class="blp-header">
                    <div class="pin-live-circle" style="background:${escapeHtml(plotColor)};">${SVG_ICONS.sprout}</div>
                    <div style="min-width:0; flex:1;">
                        <div style="font-size:16px; font-weight:700; color:#f8fafc;">${escapeHtml(p.zone_name)}</div>
                        <div style="font-size:12px; color:#94a3b8; margin-top:2px;">${escapeHtml(p.plot_number || p.plot_code || 'Plot')}</div>
                        <div style="margin-top:6px;">${renderFacilityStatusBadge(p.facility_status || 'Existing')}</div>
                    </div>
                </div>
                ${imgSrc ? `<div class="blp-hero-wrap" style="height:210px;"><img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.zone_name)}"></div>` : ''}
                <div style="padding:14px 16px;">
                    <div class="ro-plot-metrics-grid" style="margin-bottom:12px;">
                        <div><span style="color:#94a3b8;">Current Planted Crop:</span><br><strong style="color:#4ade80;">${escapeHtml(p.current_crop || '—')}</strong></div>
                        <div><span style="color:#94a3b8;">Cropping Cycle:</span><br><strong style="color:#f8fafc;">${escapeHtml(p.cycle_months || p.cropping_cycle || 'Perennial')}</strong></div>
                        <div><span style="color:#94a3b8;">Growth / Field Stage:</span><br><strong style="color:#38bdf8;">${escapeHtml(p.status || 'Active')}</strong></div>
                        <div><span style="color:#94a3b8;">Count / Area:</span><br><strong style="color:#f8fafc;">${p.tree_or_plant_count !== null && p.tree_or_plant_count !== undefined ? `${Number(p.tree_or_plant_count).toLocaleString()} plants` : 'Not entered'}${p.area_hectares ? ` • ${p.area_hectares} ha` : ''}</strong></div>
                    </div>

                    <div class="blp-wf-card visual">
                        <div style="font-size:10.5px; font-weight:700; color:#7dd3fc; letter-spacing:0.06em; margin-bottom:4px;">PLOT OVERVIEW</div>
                        <div style="font-size:12.5px; color:#e2e8f0; line-height:1.45;">${escapeHtml(p.description || 'Verified research plot on the station campus map.')}</div>
                    </div>

                    ${subPlots.length > 0 ? `
                        <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08);">
                            <div style="font-size:11px; font-weight:700; color:#34d399; letter-spacing:0.05em; margin-bottom:8px;">SUB-PLOTS (${subPlots.length})</div>
                            <div style="display:grid; gap:6px;">
                                ${subPlots.map(sp => `
                                    <div style="padding:8px 11px; border-radius:9px; background:rgba(9,13,22,0.72); border:1px solid rgba(148,163,184,0.14); display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                                        <strong style="font-size:12.5px; color:#f8fafc;">${escapeHtml(sp.name)}</strong>
                                        <span style="font-size:12px; color:#4ade80; font-weight:600;">${escapeHtml(sp.current_crop || '—')}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `,
        footerHtml: `
            ${(hasPermission('reviews:suggest') || hasPermission('reviews:decide')) ? `<button type="button" class="btn btn-blue" onclick="openReviewerSuggestModal('plot', ${p.id})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> Suggest Change to GIS Editor</button>` : ''}
            <a href="/?station=${encodeURIComponent(PortalState.currentStation)}" target="_blank" class="btn btn-emerald">Open on Live 3D Map ↗</a>
            <button type="button" class="btn btn-secondary" onclick="closeGovModal()">Close Preview</button>
        `
    });

    let roPlotLocatorBound = false;
    document.getElementById('ro-plot-toggle-locator-btn')?.addEventListener('click', (e) => {
        const panel = document.getElementById('ro-plot-locator-panel');
        if (!panel) return;
        const willShow = panel.hidden;
        panel.hidden = !willShow;
        e.currentTarget.setAttribute('aria-expanded', willShow ? 'true' : 'false');
        e.currentTarget.innerHTML = `${SVG_ICONS.map} <span>${willShow ? 'Hide Aerial Locator' : 'Aerial Campus Locator'}</span>`;
        if (willShow && !roPlotLocatorBound) {
            roPlotLocatorBound = true;
            bindSpatialSvgPanZoom('ro-plot-modal-map');
        }
    });
};

// =========================================================================
// INTERACTIVE 2D CAMPUS BLUEPRINT & PENDING REVIEW RADAR (OVERVIEW DASHBOARD)
// =========================================================================
function renderOverviewInteractiveBlueprintHtml(data) {
    const buildings = data.buildings || [];
    const plots = data.plots || [];
    const roads = data.roads || [];
    const pendingReqs = data.pendingRequests || [];
    const st = data.station || {};
    const W = 940;
    const H = 430;

    const allPts = [];
    roads.forEach(r => extractLineStrings(r.geometry_geojson).forEach(l => l.forEach(pt => allPts.push(pt))));
    plots.forEach(p => extractGeoRings(p.polygon_geojson).forEach(r => r.forEach(pt => allPts.push(pt))));
    buildings.forEach(b => {
        extractGeoRings(b.footprint_geojson).forEach(r => r.forEach(pt => allPts.push(pt)));
        if (Number.isFinite(Number(b.marker_lng)) && Number.isFinite(Number(b.marker_lat))) {
            allPts.push([Number(b.marker_lng), Number(b.marker_lat)]);
        }
    });

    const proj = createSpatialProjector(allPts, W, H, 0.08);

    const pendingByBldg = {};
    const pendingByPlot = {};
    pendingReqs.forEach(cr => {
        const t = String(cr.target_table || '').toLowerCase();
        if (t === 'buildings' || t === 'building_images' || t === 'building_offices') {
            pendingByBldg[cr.target_id] = cr;
        } else if (t === 'agricultural_plots' || t === 'plot_subplots') {
            pendingByPlot[cr.target_id] = cr;
        }
    });

    const roadPaths = roads.map(r => {
        return extractLineStrings(r.geometry_geojson).map(line => {
            const d = proj.ringToPath(line, false);
            return d ? `<path d="${d}" fill="none" stroke="rgba(148,163,184,0.34)" stroke-width="2.2" stroke-linecap="round"/>` : '';
        }).join('');
    }).join('');

    const plotPolys = plots.map(p => {
        const rings = extractGeoRings(p.polygon_geojson);
        const color = p.color || '#10b981';
        const metrics = computeRingsMetrics(rings);
        const cPt = metrics.centroid || (Number.isFinite(Number(p.center_lng)) ? [Number(p.center_lng), Number(p.center_lat)] : null);
        const [cx, cy] = cPt ? proj.project(cPt) : [0, 0];
        const pend = pendingByPlot[String(p.id)] || pendingByPlot[p.plot_code];

        return `
            <g class="rv-layer-plots" data-map-click="plot" data-plot-id="${p.id}" data-tip-title="${escapeHtml(p.zone_name)}" data-tip-sub="${escapeHtml(p.plot_number || 'Plot')} • Crop: ${escapeHtml(p.current_crop || '—')}" style="cursor:pointer;">
                ${rings.map(r => {
            const d = proj.ringToPath(r, true);
            return d ? `<path d="${d}" fill="${escapeHtml(color)}33" stroke="${pend ? '#fbbf24' : escapeHtml(color)}" stroke-width="${pend ? '2.4' : '1.3'}"/>` : '';
        }).join('')}
                ${cPt ? `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="#d1fae5" font-size="8.5" font-weight="700" pointer-events="none">${escapeHtml(String(p.plot_number || '').replace(/Plots?\s*/i, 'P'))}</text>` : ''}
            </g>
        `;
    }).join('');

    const bldgPolys = buildings.map(b => {
        const rings = extractGeoRings(b.footprint_geojson);
        const color = b.pin_color || '#38bdf8';
        const metrics = computeRingsMetrics(rings);
        const cPt = metrics.centroid || (Number.isFinite(Number(b.marker_lng)) ? [Number(b.marker_lng), Number(b.marker_lat)] : null);
        const [cx, cy] = cPt ? proj.project(cPt) : [0, 0];
        const pend = pendingByBldg[b.building_code] || pendingByBldg[String(b.id)];

        return `
            <g class="rv-layer-bldgs" data-map-click="bldg" data-bldg-code="${escapeHtml(b.building_code)}" data-tip-title="${escapeHtml(b.building_num ? '#' + b.building_num + ' ' + b.name : b.name)}" data-tip-sub="${escapeHtml(b.type_label || CATEGORY_LABELS[b.category] || 'Facility')}" style="cursor:pointer;">
                ${rings.map(r => {
            const d = proj.ringToPath(r, true);
            return d ? `<path d="${d}" fill="${escapeHtml(color)}66" stroke="${pend ? '#fbbf24' : '#e2e8f0'}" stroke-width="${pend ? '2.4' : '1.1'}"/>` : '';
        }).join('')}
                ${cPt ? `
                    <circle cx="${cx}" cy="${cy}" r="7.5" fill="${escapeHtml(color)}" stroke="#020617" stroke-width="1.3"/>
                    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-size="7.5" font-weight="800" pointer-events="none">${escapeHtml(String(b.building_num ?? '•'))}</text>
                ` : ''}
            </g>
        `;
    }).join('');

    let kioskPinSvg = '';
    if (Number.isFinite(Number(st.kiosk_pin_lng)) && Number.isFinite(Number(st.kiosk_pin_lat)) && proj.hasBounds) {
        const [kx, ky] = proj.project([Number(st.kiosk_pin_lng), Number(st.kiosk_pin_lat)]);
        kioskPinSvg = `
            <g class="rv-layer-kiosk" data-tip-title="You Are Here — Kiosk Totem Pin" data-tip-sub="[${Number(st.kiosk_pin_lng).toFixed(6)}, ${Number(st.kiosk_pin_lat).toFixed(6)}]">
                <circle cx="${kx}" cy="${ky}" r="14" fill="rgba(245,158,11,0.22)" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3,2"/>
                <circle cx="${kx}" cy="${ky}" r="6" fill="#f59e0b" stroke="#ffffff" stroke-width="1.8"/>
            </g>
        `;
    }

    return `
        <div class="rv-spatial-canvas-wrap" id="ro-overview-blueprint-wrap" data-full-vb="0 0 ${W} ${H}" data-focus-vb="0 0 ${W} ${H}">
            <div class="rv-spatial-toolbar">
                <div class="rv-spatial-layer-toggles">
                    <button type="button" class="rv-layer-chip active" data-toggle-layer="rv-layer-bldgs">${SVG_ICONS.building} <span>Buildings (${buildings.length})</span></button>
                    <button type="button" class="rv-layer-chip active" data-toggle-layer="rv-layer-plots">${SVG_ICONS.sprout} <span>Plots (${plots.length})</span></button>
                    <button type="button" class="rv-layer-chip active" data-toggle-layer="rv-layer-roads">${SVG_ICONS.route} <span>Roads (${roads.length})</span></button>
                    <button type="button" class="rv-layer-chip active" data-toggle-layer="rv-layer-kiosk">${SVG_ICONS.pin} <span>"You Are Here" Pin</span></button>
                </div>
                <div class="rv-spatial-zoom-btns">
                    <button type="button" class="rv-zoom-btn" data-rv-act="zoom-in" title="Zoom In">${SVG_ICONS.plus}</button>
                    <button type="button" class="rv-zoom-btn" data-rv-act="zoom-out" title="Zoom Out">${SVG_ICONS.minus}</button>
                    <button type="button" class="rv-zoom-btn" data-rv-act="fit-all" title="Reset Map">${SVG_ICONS.rotateCcw} <span>Reset Map</span></button>
                </div>
            </div>
            <div class="rv-spatial-svg-stage" id="ro-overview-blueprint-stage">
                <div class="rv-map-tooltip" id="ro-overview-map-tooltip"></div>
                <svg class="rv-spatial-svg" id="ro-overview-blueprint-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
                    <g class="rv-layer-roads">${roadPaths}</g>
                    ${plotPolys}
                    ${bldgPolys}
                    ${kioskPinSvg}
                </svg>
            </div>
            <div class="rv-spatial-metrics-bar">
                <span style="display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap;">${SVG_ICONS.lightbulb} <span><strong>Interactive Station Blueprint:</strong> Click any numbered Building (#1–#${buildings.length}) or Agricultural Plot polygon on the map to inspect its photo gallery, offices, and agronomic card. Drag to pan, scroll to zoom.</span></span>
                ${pendingReqs.length > 0 ? `<button type="button" class="btn btn-emerald btn-sm" onclick="switchTab('review-queue')">${pendingReqs.length} Pending Review${pendingReqs.length === 1 ? '' : 's'} →</button>` : `<span class="status-pill status-pill-live" style="font-size:10.5px;">All Reviews Up to Date</span>`}
            </div>
        </div>
    `;
}

function bindOverviewInteractiveBlueprint() {
    bindSpatialSvgPanZoom('ro-overview-blueprint');
    const wrap = document.getElementById('ro-overview-blueprint-wrap');
    const stage = document.getElementById('ro-overview-blueprint-stage');
    const tooltip = document.getElementById('ro-overview-map-tooltip');
    if (!wrap || !stage) return;

    wrap.querySelectorAll('[data-toggle-layer]').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            const cls = btn.dataset.toggleLayer;
            const visible = btn.classList.contains('active');
            wrap.querySelectorAll(`.${cls}`).forEach(el => {
                el.style.display = visible ? '' : 'none';
            });
        });
    });

    wrap.querySelectorAll('[data-map-click]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const kind = el.dataset.mapClick;
            if (kind === 'bldg' && el.dataset.bldgCode) {
                window.openReadOnlyBuildingModal(el.dataset.bldgCode);
            } else if (kind === 'plot' && el.dataset.plotId) {
                window.openReadOnlyPlotModal(Number(el.dataset.plotId));
            }
        });
    });

    if (tooltip) {
        wrap.querySelectorAll('[data-tip-title]').forEach(el => {
            el.addEventListener('pointer move', () => { });
            el.addEventListener('pointerenter', () => {
                tooltip.innerHTML = `<div style="font-weight:700; color:#f8fafc;">${escapeHtml(el.dataset.tipTitle || '')}</div><div style="color:#7dd3fc; font-size:11px; margin-top:2px;">${escapeHtml(el.dataset.tipSub || '')}</div><div style="color:#94a3b8; font-size:10px; margin-top:3px;">Click to open visual card</div>`;
                tooltip.style.display = 'block';
            });
            el.addEventListener('pointermove', (e) => {
                const rect = stage.getBoundingClientRect();
                const left = Math.min(rect.width - 250, Math.max(8, e.clientX - rect.left + 14));
                const top = Math.min(rect.height - 75, Math.max(8, e.clientY - rect.top + 14));
                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
            });
            el.addEventListener('pointerleave', () => {
                tooltip.style.display = 'none';
            });
        });
    }
}

export async function renderReviewDirectoryTab(container, viewMode = 'review-overview') {
    const data = await apiFetch(`/api/review/station-overview?station=${PortalState.currentStation}`);
    lastOverviewData = data;
    lastOverviewStation = String(PortalState.currentStation || 'lares').toLowerCase();
    const st = data.station || {};
    const c = data.counts || {};
    const buildings = data.buildings || [];
    const offices = data.offices || [];
    const plots = data.plots || [];

    if (viewMode === 'review-overview') {
        const coordStr = st.kiosk_pin_lng && st.kiosk_pin_lat
            ? `[${Number(st.kiosk_pin_lng).toFixed(6)}, ${Number(st.kiosk_pin_lat).toFixed(6)}]`
            : '[121.166434, 13.958121]';
        const mbtilesStr = st.mbtiles_filename || 'Pending Survey';

        const renderMapStage = () => {
            if (roOverviewMapMode === '3d') {
                return `
                    <div class="rv-spatial-canvas-wrap" style="height:475px;">
                        <iframe src="/?station=${encodeURIComponent(PortalState.currentStation)}" title="Live 3D Campus Map Preview" style="width:100%; height:100%; border:0; display:block;"></iframe>
                    </div>
                `;
            }
            return renderOverviewInteractiveBlueprintHtml(data);
        };

        container.innerHTML = `
            <div class="panel-card dash-station-hero-card" style="display:flex; align-items:center; justify-content:space-between; gap:18px; flex-wrap:wrap; border-color:var(--role-accent-border);">
                <div>
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px; flex-wrap:wrap;">
                        <span class="dash-hero-kicker" style="font-size:11px; font-weight:700; color:var(--role-accent-light); text-transform:uppercase;">Visual Station Overview & Spatial Inspector</span>
                        ${st.status === 'live'
                ? `<span class="status-pill status-pill-live"><span class="status-dot-live"></span><span>Live on Public Map</span></span>`
                : `<span class="status-pill status-pill-dev"><span class="status-dot-dev"></span><span>Under Development</span></span>`}
                    </div>
                    <h2 style="font-size:20px; color:#f8fafc; margin:0 0 6px;">${escapeHtml(st.name || 'DA-' + PortalState.currentStation.toUpperCase())}</h2>
                    <div style="font-size:13px; color:#94a3b8;">${escapeHtml(st.subtitle || '')} ${st.province ? '• ' + escapeHtml(st.province) : ''}</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('review-buildings')">${SVG_ICONS.building} <span>Buildings & Photos</span></button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('review-offices')">${SVG_ICONS.folder} <span>Internal Offices</span></button>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="switchTab('review-plots')">${SVG_ICONS.sprout} <span>Agricultural Plots</span></button>
                    <a href="/?station=${encodeURIComponent(PortalState.currentStation)}" target="_blank" class="btn btn-emerald btn-sm">Open Public Map ↗</a>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card" style="cursor:pointer;" onclick="switchTab('review-buildings')"><div class="stat-label">Buildings</div><div class="stat-value">${c.buildings || 0}</div><span class="stat-table-pill">Visual cards & footprints</span></div>
                <div class="stat-card" style="cursor:pointer;" onclick="switchTab('review-buildings')"><div class="stat-label">WebP Photos</div><div class="stat-value">${c.images || 0}</div><span class="stat-table-pill">Slideshow gallery</span></div>
                <div class="stat-card" style="cursor:pointer;" onclick="switchTab('review-offices')"><div class="stat-label">Internal Offices</div><div class="stat-value">${c.offices || 0}</div><span class="stat-table-pill">Floor-by-floor stacks</span></div>
                <div class="stat-card" style="cursor:pointer;" onclick="switchTab('review-plots')"><div class="stat-label">Agricultural Plots</div><div class="stat-value">${c.plots || 0}</div><span class="stat-table-pill">${c.subplots || 0} sub-plots</span></div>
                <div class="stat-card"><div class="stat-label">3D Trees</div><div class="stat-value">${c.trees || 0}</div><span class="stat-table-pill">Read-only</span></div>
                <div class="stat-card"><div class="stat-label">Walkway Points</div><div class="stat-value">${c.roads || 0}</div><span class="stat-table-pill">Read-only</span></div>
            </div>

            <div class="panel-card">
                <div class="panel-header">
                    <div class="panel-title-group">
                        <div class="panel-title-icon">${SVG_ICONS.pin}</div>
                        <div>
                            <h3>Interactive Campus Blueprint & "You Are Here" Kiosk Pin Inspector</h3>
                            <div class="help-tip">Click any building or agricultural plot directly on the map below to open its visual photo card, or switch to the embedded Live 3D Campus Map preview.</div>
                        </div>
                    </div>
                    <div class="cr-view-mode-group" id="ro-overview-map-mode">
                        <button type="button" class="cr-view-mode-btn ${roOverviewMapMode === '2d' ? 'active' : ''}" data-map-mode="2d">${SVG_ICONS.map} <span>2D Interactive Blueprint</span></button>
                        <button type="button" class="cr-view-mode-btn ${roOverviewMapMode === '3d' ? 'active' : ''}" data-map-mode="3d">${SVG_ICONS.globe} <span>Live 3D Map Preview</span></button>
                    </div>
                </div>

                <div id="ro-overview-map-host" style="margin-bottom:14px;">
                    ${renderMapStage()}
                </div>

                <div class="form-grid-3">
                    <div style="padding:12px 14px; border-radius:11px; background:rgba(9,13,22,0.68); border:1px solid var(--border-subtle);">
                        <div style="font-size:11px; color:#94a3b8; text-transform:uppercase; font-weight:700; margin-bottom:6px;">"You Are Here" Kiosk Pin</div>
                        <span class="copy-pill" onclick="copyTextPill('${coordStr}')"><span>${coordStr}</span>${SVG_ICONS.copy}</span>
                    </div>
                    <div style="padding:12px 14px; border-radius:11px; background:rgba(9,13,22,0.68); border:1px solid var(--border-subtle);">
                        <div style="font-size:11px; color:#94a3b8; text-transform:uppercase; font-weight:700; margin-bottom:6px;">Offline Drone MBTiles</div>
                        <span class="copy-pill" onclick="copyTextPill('${escapeHtml(mbtilesStr)}')"><span>${escapeHtml(mbtilesStr)}</span>${SVG_ICONS.copy}</span>
                    </div>
                    <div style="padding:12px 14px; border-radius:11px; background:rgba(9,13,22,0.68); border:1px solid var(--border-subtle);">
                        <div style="font-size:11px; color:#94a3b8; text-transform:uppercase; font-weight:700; margin-bottom:6px;">Default Map Camera</div>
                        <span class="mono-code">Zoom ${st.default_zoom ?? 18} • Pitch ${st.default_pitch ?? 55}° • Bearing ${st.default_bearing ?? 0}°</span>
                    </div>
                </div>
            </div>
        `;

        if (roOverviewMapMode === '2d') bindOverviewInteractiveBlueprint();

        container.querySelectorAll('#ro-overview-map-mode [data-map-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                roOverviewMapMode = btn.dataset.mapMode;
                container.querySelectorAll('#ro-overview-map-mode [data-map-mode]').forEach(b => b.classList.toggle('active', b.dataset.mapMode === roOverviewMapMode));
                const host = document.getElementById('ro-overview-map-host');
                if (host) {
                    host.innerHTML = renderMapStage();
                    if (roOverviewMapMode === '2d') bindOverviewInteractiveBlueprint();
                }
            });
        });
        return;
    }

    if (viewMode === 'review-buildings') {
        const officeCountByBldg = {};
        offices.forEach(o => {
            officeCountByBldg[o.building_code] = (officeCountByBldg[o.building_code] || 0) + 1;
        });

        const renderBldgCards = () => {
            const term = roBldgSearch.trim().toLowerCase();
            const filtered = buildings.filter(b => {
                if (roBldgCategory && b.category !== roBldgCategory) return false;
                if (term) {
                    const hay = `${b.building_num ?? ''} ${b.name || ''} ${b.type_label || ''} ${b.category || ''} ${b.description || ''} ${b.visual_landmark || ''}`.toLowerCase();
                    if (!hay.includes(term)) return false;
                }
                return true;
            });

            if (!filtered.length) {
                return `<div style="grid-column:1/-1; text-align:center; padding:36px; color:#94a3b8;">No buildings match your filter.</div>`;
            }

            return filtered.map(b => {
                const imgs = Array.isArray(b.images) ? b.images : [];
                const primaryUrl = imgs[0] ? normalizeImgSrc(imgs[0].image_webp_url || imgs[0].image_url || '') : '';
                const pinColor = b.pin_color || b.color || '#10b981';
                const bNum = b.building_num !== null && b.building_num !== undefined ? `#${b.building_num}` : '•';
                const ofcCnt = officeCountByBldg[b.building_code] || 0;
                const catLabel = b.type_label || CATEGORY_LABELS[b.category] || b.category || 'Research Facility';
                const footprintSvg = renderShapeSilhouetteSvg(b.footprint_geojson, {
                    strokeColor: '#38bdf8',
                    fillColor: 'rgba(56,189,248,0.28)',
                    width: 56,
                    height: 44
                });

                return `
                    <div class="ro-visual-card">
                        <div class="ro-card-hero" onclick="openReadOnlyBuildingModal('${escapeHtml(b.building_code)}')" style="cursor:pointer;">
                            ${primaryUrl
                        ? `<img class="ro-card-hero-img" src="${escapeHtml(primaryUrl)}" alt="${escapeHtml(b.name)}" loading="lazy">`
                        : `<div class="ro-card-hero-empty">${footprintSvg || SVG_ICONS.building}<span>No photo uploaded</span></div>`}
                            <div class="ro-card-overlay-top">
                                <span class="pin-live-circle" style="background:${escapeHtml(pinColor)}; width:28px; height:28px; font-size:11.5px;">${escapeHtml(bNum)}</span>
                                ${renderFacilityStatusBadge(b.facility_status || 'Existing')}
                            </div>
                            ${primaryUrl && footprintSvg ? `<div class="rv-minimap-corner-badge" title="Mapped Building Footprint">${footprintSvg}</div>` : ''}
                            <span class="ro-photo-count-pill">${SVG_ICONS.image} <span>${imgs.length} ${imgs.length === 1 ? 'Photo' : 'Photos'}</span></span>
                        </div>
                        <div class="ro-card-body">
                            <div>
                                <div class="ro-card-title">${escapeHtml(b.name)}</div>
                                <div class="ro-card-sub">${escapeHtml(catLabel)}</div>
                            </div>
                            <div class="ro-card-desc">${escapeHtml(b.description || b.visual_landmark || 'Click below to view the campus footprint locator, map card, and photo gallery.')}</div>
                            <div class="ro-card-meta-row">
                                ${ofcCnt > 0 ? `<span class="ro-floor-pill">${ofcCnt} ${ofcCnt === 1 ? 'Office' : 'Offices'}</span>` : ''}
                                ${b.model_glb_url ? `<span class="status-pill status-pill-live" style="font-size:10px;">3D Model</span>` : ''}
                            </div>
                            <div style="display:flex; gap:6px; margin-top:4px;">
                                <button type="button" class="btn btn-secondary btn-sm" style="flex:1; justify-content:center;" onclick="openReadOnlyBuildingModal('${escapeHtml(b.building_code)}')">
                                    View Card & Map
                                </button>
                                ${(hasPermission('reviews:suggest') || hasPermission('reviews:decide')) ? `<button type="button" class="btn btn-blue btn-sm" style="justify-content:center; white-space:nowrap;" onclick="openReviewerSuggestModal('building', '${escapeHtml(b.building_code)}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> Suggest</button>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        };

        container.innerHTML = `
            <div class="panel-card">
                <div class="panel-header">
                    <div class="panel-title-group">
                        <div class="panel-title-icon">${SVG_ICONS.building}</div>
                        <div>
                            <h3>Buildings, Footprints & Photo Gallery — DA-${PortalState.currentStation.toUpperCase()} (${buildings.length})</h3>
                            <div class="help-tip">Read-only visual directory with corner footprint silhouettes. Click any building card to inspect its interactive campus locator map, multi-photo WebP slideshow, landmark guidance, services, and internal offices.</div>
                        </div>
                    </div>
                    <span class="status-pill status-pill-blue">${c.images || 0} WebP Photos</span>
                </div>

                <div class="ro-toolbar">
                    <input type="text" id="ro-bldg-search" class="form-control" placeholder="Search building #, official name, type, or description..." value="${escapeHtml(roBldgSearch)}">
                    <select id="ro-bldg-cat" class="form-control">
                        <option value="">All Facility Categories (${buildings.length})</option>
                        ${Object.entries(CATEGORY_LABELS).filter(([k]) => k !== 'crop').map(([k, lbl]) =>
            `<option value="${k}" ${roBldgCategory === k ? 'selected' : ''}>${escapeHtml(lbl)}</option>`
        ).join('')}
                    </select>
                </div>

                <div class="ro-card-grid" id="ro-bldg-grid">${renderBldgCards()}</div>
            </div>
        `;

        document.getElementById('ro-bldg-search')?.addEventListener('input', (e) => {
            roBldgSearch = e.target.value;
            const grid = document.getElementById('ro-bldg-grid');
            if (grid) grid.innerHTML = renderBldgCards();
        });
        document.getElementById('ro-bldg-cat')?.addEventListener('change', (e) => {
            roBldgCategory = e.target.value;
            const grid = document.getElementById('ro-bldg-grid');
            if (grid) grid.innerHTML = renderBldgCards();
        });
        return;
    }

    if (viewMode === 'review-offices') {
        const bldgMap = Object.fromEntries(buildings.map(b => [b.building_code, b]));
        const bldgCodesWithOffices = Array.from(new Set(offices.map(o => o.building_code).filter(Boolean)));

        const renderOfficeGroups = () => {
            const term = roOfficeSearch.trim().toLowerCase();
            const filteredOffices = offices.filter(o => {
                if (roOfficeBldg && o.building_code !== roOfficeBldg) return false;
                if (term) {
                    const parentB = bldgMap[o.building_code];
                    const hay = `${o.office_name || ''} ${o.floor_or_room || ''} ${o.room_number || ''} ${o.description || ''} ${parentB?.name || ''} ${o.building_code || ''}`.toLowerCase();
                    if (!hay.includes(term)) return false;
                }
                return true;
            });

            if (!filteredOffices.length) {
                return `<div style="text-align:center; padding:36px; color:#94a3b8;">No internal offices match your search.</div>`;
            }

            const grouped = new Map();
            filteredOffices.forEach(o => {
                const code = o.building_code || 'unassigned';
                if (!grouped.has(code)) grouped.set(code, []);
                grouped.get(code).push(o);
            });

            const sortedCodes = Array.from(grouped.keys()).sort((a, b) => {
                const ba = bldgMap[a];
                const bb = bldgMap[b];
                const na = ba?.building_num ?? 999;
                const nb = bb?.building_num ?? 999;
                if (na !== nb) return na - nb;
                return String(ba?.name || a).localeCompare(String(bb?.name || b));
            });

            return sortedCodes.map(code => {
                const b = bldgMap[code];
                const list = grouped.get(code) || [];
                const bName = b ? b.name : code.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
                const bNum = b && b.building_num !== null && b.building_num !== undefined ? `#${b.building_num}` : '•';
                const pinColor = (b && (b.pin_color || b.color)) || '#10b981';
                const thumbUrl = b && Array.isArray(b.images) && b.images[0]
                    ? normalizeImgSrc(b.images[0].image_webp_url || b.images[0].image_url || '')
                    : '';
                const footprintSvg = b ? renderShapeSilhouetteSvg(b.footprint_geojson, {
                    strokeColor: '#38bdf8',
                    fillColor: 'rgba(56,189,248,0.25)',
                    width: 48,
                    height: 36
                }) : '';

                // Group offices inside this building by Floor Tier for a visual architectural stack
                const floorGroups = new Map();
                list.forEach(o => {
                    const fl = (o.floor_or_room || 'Ground Floor').trim();
                    if (!floorGroups.has(fl)) floorGroups.set(fl, []);
                    floorGroups.get(fl).push(o);
                });

                return `
                    <div class="ro-office-group-card">
                        <div class="ro-office-group-header">
                            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                                ${thumbUrl
                        ? `<img class="ro-office-thumb" src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(bName)}" loading="lazy">`
                        : `<div class="pin-live-circle" style="background:${escapeHtml(pinColor)};">${escapeHtml(bNum)}</div>`}
                                ${footprintSvg ? `<div style="padding:2px; border-radius:7px; background:rgba(2,6,23,0.85); border:1px solid rgba(56,189,248,0.35);" title="Building Footprint">${footprintSvg}</div>` : ''}
                                <div>
                                    <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap;">
                                        <span class="pin-live-circle" style="background:${escapeHtml(pinColor)}; width:24px; height:24px; font-size:10.5px;">${escapeHtml(bNum)}</span>
                                        <strong style="font-size:14.5px; color:#f8fafc;">${escapeHtml(bName)}</strong>
                                        <span class="status-pill status-pill-blue" style="font-size:10.5px;">${list.length} ${list.length === 1 ? 'Office' : 'Offices'}</span>
                                    </div>
                                    ${b?.type_label ? `<div style="font-size:11.5px; color:#94a3b8; margin-top:2px;">${escapeHtml(b.type_label)}</div>` : ''}
                                </div>
                            </div>
                            ${b ? `<button type="button" class="btn btn-secondary btn-sm" onclick="openReadOnlyBuildingModal('${escapeHtml(code)}')">View Building Card & Map</button>` : ''}
                        </div>
                        <div class="ro-floor-stack-wrap">
                            ${Array.from(floorGroups.entries()).map(([floorName, fOffices]) => `
                                <div class="ro-floor-tier">
                                    <div class="ro-floor-tier-header">
                                        <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/></svg> ${escapeHtml(floorName)}</span>
                                        <span>${fOffices.length} ${fOffices.length === 1 ? 'Unit' : 'Units'}</span>
                                    </div>
                                    <div class="ro-floor-office-grid">
                                        ${fOffices.map(o => `
                                            <div class="ro-floor-office-tile">
                                                <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px;">
                                                    <strong style="font-size:12.5px; color:#f8fafc; line-height:1.3;">${escapeHtml(o.office_name || '—')}</strong>
                                                    ${o.room_number ? `<span class="ro-room-pill">${escapeHtml(o.room_number)}</span>` : ''}
                                                </div>
                                                ${o.description ? `<div style="font-size:11px; color:#94a3b8; line-height:1.35;">${escapeHtml(o.description)}</div>` : ''}
                                                ${(hasPermission('reviews:suggest') || hasPermission('reviews:decide')) ? `<div style="margin-top:6px;"><button type="button" class="btn btn-secondary btn-sm" style="padding:3px 9px; font-size:11px;" onclick="openReviewerSuggestModal('office', ${o.id})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> Suggest Change</button></div>` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        };

        container.innerHTML = `
            <div class="panel-card">
                <div class="panel-header">
                    <div class="panel-title-group">
                        <div class="panel-title-icon">${SVG_ICONS.folder}</div>
                        <div>
                            <h3>Floor-by-Floor Internal Building Offices — DA-${PortalState.currentStation.toUpperCase()} (${offices.length})</h3>
                            <div class="help-tip">Visually stacked by parent building and floor level with verified Room Number badges and building footprint silhouettes.</div>
                        </div>
                    </div>
                    <span class="status-pill status-pill-blue">${bldgCodesWithOffices.length} Office Buildings</span>
                </div>

                <div class="ro-toolbar">
                    <input type="text" id="ro-ofc-search" class="form-control" placeholder="Search office name, building name, floor, or room number..." value="${escapeHtml(roOfficeSearch)}">
                    <select id="ro-ofc-bldg" class="form-control">
                        <option value="">All Buildings with Offices (${bldgCodesWithOffices.length})</option>
                        ${bldgCodesWithOffices.map(code => {
            const b = bldgMap[code];
            const label = b ? `${b.building_num ? '#' + b.building_num + ' ' : ''}${b.name}` : code;
            return `<option value="${escapeHtml(code)}" ${roOfficeBldg === code ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }).join('')}
                    </select>
                </div>

                <div id="ro-ofc-groups-host">${renderOfficeGroups()}</div>
            </div>
        `;

        document.getElementById('ro-ofc-search')?.addEventListener('input', (e) => {
            roOfficeSearch = e.target.value;
            const host = document.getElementById('ro-ofc-groups-host');
            if (host) host.innerHTML = renderOfficeGroups();
        });
        document.getElementById('ro-ofc-bldg')?.addEventListener('change', (e) => {
            roOfficeBldg = e.target.value;
            const host = document.getElementById('ro-ofc-groups-host');
            if (host) host.innerHTML = renderOfficeGroups();
        });
        return;
    }

    // Default: review-plots (Visual Agricultural Plots Grid with Polygon Silhouettes)
    const renderPlotCards = () => {
        const term = roPlotSearch.trim().toLowerCase();
        const filtered = plots.filter(p => {
            if (roPlotCycle && p.cropping_cycle !== roPlotCycle) return false;
            if (term) {
                const hay = `${p.plot_number || ''} ${p.zone_name || ''} ${p.current_crop || ''} ${p.cycle_months || ''} ${p.status || ''}`.toLowerCase();
                if (!hay.includes(term)) return false;
            }
            return true;
        });

        if (!filtered.length) {
            return `<div style="grid-column:1/-1; text-align:center; padding:36px; color:#94a3b8;">No agricultural plots match your filter.</div>`;
        }

        return filtered.map(p => {
            const plotColor = p.color || '#10b981';
            const imgSrc = normalizeImgSrc(p.image_webp_url || p.image_url || '');
            const spCount = Array.isArray(p.subPlots) ? p.subPlots.length : 0;
            const polySvgSmall = renderShapeSilhouetteSvg(p.polygon_geojson, {
                strokeColor: plotColor,
                fillColor: `${plotColor}44`,
                width: 56,
                height: 44
            });
            const polySvgHero = renderShapeSilhouetteSvg(p.polygon_geojson, {
                strokeColor: plotColor,
                fillColor: `${plotColor}44`,
                width: 145,
                height: 86
            });

            return `
                <div class="ro-visual-card" style="border-color:${escapeHtml(plotColor)}44;">
                    <div class="ro-card-hero" onclick="openReadOnlyPlotModal(${p.id})" style="cursor:pointer; height:138px;">
                        ${imgSrc
                    ? `<img class="ro-card-hero-img" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(p.zone_name)}" loading="lazy">`
                    : `<div class="ro-card-hero-empty" style="color:${escapeHtml(plotColor)};">${polySvgHero || SVG_ICONS.sprout}</div>`}
                        <div class="ro-card-overlay-top">
                            <span class="status-pill" style="background:rgba(2,6,23,0.82); border:1px solid ${escapeHtml(plotColor)}88; color:#f8fafc; font-weight:700;">${escapeHtml(p.plot_number || 'Plot')}</span>
                            ${renderFacilityStatusBadge(p.facility_status || 'Existing')}
                        </div>
                        ${imgSrc && polySvgSmall ? `<div class="rv-minimap-corner-badge" style="border-color:${escapeHtml(plotColor)}88;" title="Mapped Plot Boundary">${polySvgSmall}</div>` : ''}
                        ${spCount > 0 ? `<span class="ro-photo-count-pill">${spCount} Screenhouses</span>` : ''}
                    </div>
                    <div class="ro-card-body">
                        <div>
                            <div class="ro-card-title">${escapeHtml(p.zone_name)}</div>
                            <div class="ro-card-sub" style="color:#4ade80;">Crop: ${escapeHtml(p.current_crop || '—')}</div>
                        </div>
                        <div class="ro-plot-metrics-grid">
                            <div><span style="color:#94a3b8;">Cycle:</span><br><strong style="color:#f8fafc;">${escapeHtml(p.cycle_months || p.cropping_cycle || 'Perennial')}</strong></div>
                            <div><span style="color:#94a3b8;">Stage:</span><br><strong style="color:#38bdf8;">${escapeHtml(p.status || 'Active')}</strong></div>
                            <div><span style="color:#94a3b8;">Plants:</span><br><strong style="color:#f8fafc;">${p.tree_or_plant_count !== null && p.tree_or_plant_count !== undefined ? Number(p.tree_or_plant_count).toLocaleString() : 'Unset'}</strong></div>
                            <div><span style="color:#94a3b8;">Area:</span><br><strong style="color:#f8fafc;">${p.area_hectares ? `${p.area_hectares} ha` : 'Calibrated'}</strong></div>
                        </div>
                        <div style="display:flex; gap:6px; margin-top:auto;">
                            <button type="button" class="btn btn-secondary btn-sm" style="flex:1; justify-content:center;" onclick="openReadOnlyPlotModal(${p.id})">
                                View Plot & Map
                            </button>
                            ${(hasPermission('reviews:suggest') || hasPermission('reviews:decide')) ? `<button type="button" class="btn btn-blue btn-sm" style="justify-content:center; white-space:nowrap;" onclick="openReviewerSuggestModal('plot', ${p.id})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> Suggest</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    container.innerHTML = `
        <div class="panel-card">
            <div class="panel-header">
                <div class="panel-title-group">
                    <div class="panel-title-icon">${SVG_ICONS.sprout}</div>
                    <div>
                        <h3>Agricultural Plots, Polygons & Crops — DA-${PortalState.currentStation.toUpperCase()} (${PortalState.currentStation === 'lares' ? `${plots.length} Planted Zones • 45 Total Plots` : plots.length})</h3>
                        <div class="help-tip">Read-only visual field directory showing each plot's mapped polygon shape, planted crop, cropping cycle, growth stage, and screenhouse sub-plots.</div>
                    </div>
                </div>
                <span class="status-pill status-pill-blue">${c.subplots || 0} Screenhouse Sub-Plots</span>
            </div>

            <div class="ro-toolbar">
                <input type="text" id="ro-plot-search" class="form-control" placeholder="Search plot #, field name, planted crop, or stage..." value="${escapeHtml(roPlotSearch)}">
                <select id="ro-plot-cycle" class="form-control">
                    <option value="">All Cropping Cycles (${plots.length})</option>
                    <option value="perennial" ${roPlotCycle === 'perennial' ? 'selected' : ''}>Perennial (Year-round)</option>
                    <option value="annual" ${roPlotCycle === 'annual' ? 'selected' : ''}>Annual</option>
                    <option value="monthly_seasonal" ${roPlotCycle === 'monthly_seasonal' ? 'selected' : ''}>Monthly / Seasonal</option>
                    <option value="fallow" ${roPlotCycle === 'fallow' ? 'selected' : ''}>Fallow / Soil Rest</option>
                </select>
            </div>

            <div class="ro-card-grid" id="ro-plot-grid">${renderPlotCards()}</div>
        </div>
    `;

    document.getElementById('ro-plot-search')?.addEventListener('input', (e) => {
        roPlotSearch = e.target.value;
        const grid = document.getElementById('ro-plot-grid');
        if (grid) grid.innerHTML = renderPlotCards();
    });
    document.getElementById('ro-plot-cycle')?.addEventListener('change', (e) => {
        roPlotCycle = e.target.value;
        const grid = document.getElementById('ro-plot-grid');
        if (grid) grid.innerHTML = renderPlotCards();
    });
}
