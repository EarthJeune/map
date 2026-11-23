/**
 * Agricultural Plots, Screenhouse Sub-Plots, Editor-Backed Multi-Plot Split/Merge & Crop History Timeline
 */

import {
    PortalState,
    SVG_ICONS,
    FACILITY_STATUS_META,
    PIN_COLOR_PRESETS,
    ICON_GALLERY,
    apiFetch,
    showToast,
    broadcastDbSync,
    escapeHtml,
    canPublish,
    hasPermission,
    renderFacilityStatusBadge,
    renderWorkflowBanner,
    fileToWebpDataUrl,
    showPortalConfirm
} from './core.js';
import { ALL_PLOT_POLYGONS } from '../data/plots.js';

let plotSearch = '';
let plotStatusFilter = '';
const expandedHistoryCodes = new Set();

// Index of the 45 calibrated individual plot polygons from the Visual Plot Editor (plot_draw.html / plots.js)
const CALIBRATED_PLOT_RING_BY_NUM = {};
(ALL_PLOT_POLYGONS || []).forEach(feat => {
    const n = Number(feat?.properties?.plotNum);
    const ring = feat?.geometry?.coordinates?.[0];
    if (Number.isFinite(n) && Array.isArray(ring) && ring.length >= 4) {
        CALIBRATED_PLOT_RING_BY_NUM[n] = ring;
    }
});

/**
 * Extract individual 1..45 plot numbers from a plot_number label such as:
 * - "Plots 6–12" -> [6,7,8,9,10,11,12]
 * - "Plots 6-7, 9-12" -> [6,7,9,10,11,12]
 * - "Plot 17 (Screenhouses 1–5)" -> [17] (parenthetical screenhouse numbers are ignored)
 */
function parsePlotNumbersFromLabel(label) {
    const cleaned = String(label || '').replace(/\([^)]*\)/g, ' ');
    const nums = new Set();
    const rangeRe = /(\d+)\s*[–—-]\s*(\d+)/g;
    let match;
    const withoutRanges = cleaned.replace(rangeRe, (_, aStr, bStr) => {
        const a = Number(aStr);
        const b = Number(bStr);
        if (Number.isFinite(a) && Number.isFinite(b) && a >= 1 && b <= 60 && a <= b) {
            for (let k = a; k <= b; k++) nums.add(k);
        }
        return ' ';
    });
    const singleRe = /\b(\d+)\b/g;
    while ((match = singleRe.exec(withoutRanges)) !== null) {
        const n = Number(match[1]);
        if (Number.isFinite(n) && n >= 1 && n <= 60) nums.add(n);
    }
    return Array.from(nums).sort((a, b) => a - b);
}

/**
 * Format an array of plot numbers back into an official label:
 * - [8] -> "Plot 8"
 * - [6,7,8] -> "Plots 6–8"
 * - [6,7,9,10,11,12] -> "Plots 6–7, 9–12"
 */
function formatPlotNumbersLabel(nums) {
    const sorted = Array.from(new Set((nums || []).map(Number).filter(Number.isFinite))).sort((a, b) => a - b);
    if (!sorted.length) return '';
    if (sorted.length === 1) return `Plot ${sorted[0]}`;
    const ranges = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === prev + 1) {
            prev = sorted[i];
        } else {
            ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
            start = sorted[i];
            prev = sorted[i];
        }
    }
    ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
    return `Plots ${ranges.join(', ')}`;
}

function computeRingAreaHa(ring) {
    if (!Array.isArray(ring) || ring.length < 3) return 0;
    const closed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
    const n = closed ? ring.length - 1 : ring.length;
    if (n < 3) return 0;
    const R = 6378137;
    const cosLat = Math.cos((ring[0][1] * Math.PI) / 180);
    let shoelace = 0;
    for (let i = 0; i < n; i++) {
        const p1 = ring[i];
        const p2 = ring[(i + 1) % n];
        const x1 = ((p1[0] * Math.PI) / 180) * R * cosLat;
        const y1 = ((p1[1] * Math.PI) / 180) * R;
        const x2 = ((p2[0] * Math.PI) / 180) * R * cosLat;
        const y2 = ((p2[1] * Math.PI) / 180) * R;
        shoelace += (x1 * y2 - x2 * y1);
    }
    const areaM2 = Math.abs(shoelace) * 0.5;
    return Number((areaM2 / 10000).toFixed(2));
}

/**
 * Construct the exact outer polygon (and area in ha) for any subset of the 45 calibrated plots
 * drawn in the Visual Plot Editor (ALL_PLOT_POLYGONS).
 */
function buildCalibratedPolygonForPlotNums(nums) {
    const sorted = Array.from(new Set((nums || []).map(Number).filter(n => CALIBRATED_PLOT_RING_BY_NUM[n]))).sort((a, b) => a - b);
    if (!sorted.length) return { polygon: null, areaHa: 0 };

    let totalAreaHa = 0;
    sorted.forEach(n => {
        totalAreaHa += computeRingAreaHa(CALIBRATED_PLOT_RING_BY_NUM[n]);
    });
    totalAreaHa = Number(totalAreaHa.toFixed(2));

    if (sorted.length === 1) {
        return {
            polygon: CALIBRATED_PLOT_RING_BY_NUM[sorted[0]],
            areaHa: totalAreaHa
        };
    }

    // Check if contiguous range [first..last]
    const isContiguous = sorted[sorted.length - 1] - sorted[0] === sorted.length - 1;
    const firstRing = CALIBRATED_PLOT_RING_BY_NUM[sorted[0]];
    const lastRing = CALIBRATED_PLOT_RING_BY_NUM[sorted[sorted.length - 1]];

    // Standard 4-corner calibrated strip: [first[3], last[0], last[1], first[2], first[3]]
    if (isContiguous && firstRing.length === 5 && lastRing.length === 5) {
        return {
            polygon: [firstRing[3], lastRing[0], lastRing[1], firstRing[2], firstRing[3]],
            areaHa: totalAreaHa
        };
    }

    // Multi-vertex / L-shaped plot range (e.g. Plots 30–32) or non-contiguous selection:
    // keep the outer bounding ring of first..last so all vertices are preserved
    if (isContiguous && firstRing && lastRing) {
        const prefix = firstRing.slice(2, firstRing.length - 1);
        const combined = [...prefix, lastRing[0], lastRing[1], prefix[0]];
        return {
            polygon: combined,
            areaHa: totalAreaHa
        };
    }

    return {
        polygon: firstRing,
        areaHa: totalAreaHa
    };
}

/**
 * Render an interactive SVG strip of the individual calibrated plot polygons (e.g. Plot 6..12)
 * so the user can visually see and click individual plots to split or merge.
 */
function renderCalibratedPlotStripSvg(allNums, splitSet, parentColor = '#f97316', splitColor = '#10b981') {
    const validNums = (allNums || []).filter(n => CALIBRATED_PLOT_RING_BY_NUM[n]);
    if (!validNums.length) return '';

    const W = 560;
    const H = 148;
    const allPts = [];
    validNums.forEach(n => {
        CALIBRATED_PLOT_RING_BY_NUM[n].forEach(pt => allPts.push(pt));
    });

    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    allPts.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    });

    const centerLng = (minLng + maxLng) * 0.5;
    const centerLat = (minLat + maxLat) * 0.5;
    const cosLat = Math.cos((centerLat * Math.PI) / 180) || 1;
    const spanX = Math.max((maxLng - minLng) * cosLat, 0.00012);
    const spanY = Math.max(maxLat - minLat, 0.00012);
    const scale = Math.min((W - 44) / spanX, (H - 36) / spanY);

    const project = ([lng, lat]) => [
        Number((W * 0.5 + (lng - centerLng) * cosLat * scale).toFixed(2)),
        Number((H * 0.5 - (lat - centerLat) * scale).toFixed(2))
    ];

    const shapesHtml = validNums.map(n => {
        const ring = CALIBRATED_PLOT_RING_BY_NUM[n];
        const isSplit = splitSet.has(n);
        const d = ring.map((pt, idx) => {
            const [x, y] = project(pt);
            return `${idx === 0 ? 'M' : 'L'}${x},${y}`;
        }).join(' ') + ' Z';

        const pts = ring.slice(0, ring.length - 1);
        const cLng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cLat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        const [cx, cy] = project([cLng, cLat]);
        const fill = isSplit ? `${splitColor}55` : `${parentColor}44`;
        const stroke = isSplit ? splitColor : parentColor;

        return `
            <g data-click-plot-num="${n}" style="cursor:pointer;">
                <path d="${d}" fill="${escapeHtml(fill)}" stroke="${escapeHtml(stroke)}" stroke-width="2.2"/>
                <circle cx="${cx}" cy="${cy}" r="12" fill="rgba(2,6,23,0.86)" stroke="${escapeHtml(stroke)}" stroke-width="1.5"/>
                <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" fill="#f8fafc" font-size="10" font-weight="800">P${n}</text>
            </g>
        `;
    }).join('');

    return `
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="display:block; border-radius:10px; background:radial-gradient(circle at 50% 45%, #0c1829 0%, #060b14 100%); border:1px solid rgba(56,189,248,0.28);">
            ${shapesHtml}
        </svg>
    `;
}

function hasPlotGeometry(p) {
    if (!p) return false;
    if (p.has_geometry === true) return true;
    const hasPoly = Boolean(p.polygon_geojson && String(p.polygon_geojson).trim().length > 0);
    const lng = Number(p.center_lng);
    const lat = Number(p.center_lat);
    const hasCoords = p.center_lng !== null && p.center_lng !== undefined && p.center_lng !== ''
        && p.center_lat !== null && p.center_lat !== undefined && p.center_lat !== ''
        && Number.isFinite(lng) && Number.isFinite(lat) && !(lng === 0 && lat === 0);
    return hasPoly || hasCoords;
}

function renderPlotsTable() {
    const host = document.getElementById('plots-table-host');
    if (!host) return;

    const list = (PortalState.cachedPlots || []).filter(p => {
        if (plotStatusFilter && (p.facility_status || 'Existing') !== plotStatusFilter) return false;
        if (plotSearch) {
            const hay = `${p.plot_number || ''} ${p.zone_name || ''} ${p.plot_code || ''} ${p.current_crop || ''}`.toLowerCase();
            if (!hay.includes(plotSearch.toLowerCase())) return false;
        }
        return true;
    });

    if (list.length === 0) {
        host.innerHTML = `<div style="text-align:center; padding:32px; color:#94a3b8;">No agricultural plots match your filter.</div>`;
        return;
    }

    const canSplitMerge = hasPermission('plots:split_merge');

    host.innerHTML = `
        <div class="table-scroll-wrap">
        <table class="crud-table">
            <thead>
                <tr>
                    <th>Plot #</th>
                    <th>Plot Name & Code</th>
                    <th>Current Planted Crop</th>
                    <th>Count / Area</th>
                    <th>Cycle & Stage</th>
                    <th>Map Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${list.map(p => {
                    const subPlots = Array.isArray(p.subPlots) ? p.subPlots : [];
                    const spCount = subPlots.length;
                    const histCount = (p.history || []).length;
                    const isExpanded = expandedHistoryCodes.has(p.plot_code);
                    const parsedPlotNums = parsePlotNumbersFromLabel(p.plot_number);
                    const isMultiPlotRange = parsedPlotNums.length > 1;

                    return `
                    <tr>
                        <td>
                            <span class="mono-id">${escapeHtml(p.plot_number || '—')}</span>
                            ${isMultiPlotRange ? `<div style="margin-top:3px;"><span class="status-pill status-pill-blue" style="font-size:10px;">${parsedPlotNums.length} Merged Plots</span></div>` : ''}
                        </td>
                        <td>
                            <div style="font-weight:700; color:#f8fafc;">${escapeHtml(p.zone_name)}</div>
                            <span class="mono-code">${escapeHtml(p.plot_code)}</span>
                            ${spCount > 0 ? `<span class="mono-code" style="color:#34d399; margin-left:4px;">${spCount} Screenhouses</span>` : ''}
                            ${spCount > 0 ? `
                                <div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:7px;">
                                    ${subPlots.map(sp => `
                                        <span style="display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:7px; background:rgba(16,185,129,0.10); border:1px solid rgba(52,211,153,0.28); font-size:11px; color:#e2e8f0;">
                                            <strong style="color:#6ee7b7;">${escapeHtml(sp.name)}:</strong>
                                            <span>${escapeHtml(sp.current_crop || 'Unset')}</span>
                                        </span>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </td>
                        <td style="color:var(--role-accent-light); font-weight:600;">${escapeHtml(p.current_crop || '—')}</td>
                        <td>
                            <div>${p.tree_or_plant_count !== null ? `<strong>${Number(p.tree_or_plant_count).toLocaleString()}</strong> plants` : '<span style="color:#94a3b8;">Not entered</span>'}</div>
                            <div class="help-tip">${p.area_hectares ? `${p.area_hectares} ha` : ''}</div>
                        </td>
                        <td>
                            <span class="status-pill status-pill-blue">${escapeHtml(p.cycle_months || p.cropping_cycle || 'perennial')}</span>
                            <div class="help-tip">${escapeHtml(p.status || 'Active')}</div>
                        </td>
                        <td>
                            ${renderFacilityStatusBadge(p.facility_status || 'Existing')}
                            ${!hasPlotGeometry(p) ? `<div style="margin-top:4px;"><span class="status-pill" style="background:rgba(245,158,11,0.16); color:#fbbf24; border:1px solid rgba(245,158,11,0.35); font-size:10.5px;">Unmapped Draft (Hidden)</span></div>` : ''}
                        </td>
                        <td>
                            <div class="action-cell">
                                <button type="button" class="btn btn-blue btn-sm" onclick="openPlotModal(${p.id})" title="${spCount > 0 ? 'Update plot crop & individual screenhouse contents' : 'Update planted crop, count, cycle & stage'}">${SVG_ICONS.edit} <span>${spCount > 0 ? 'Edit Crop & Screenhouses' : 'Edit Crop'}</span></button>
                                ${canSplitMerge && isMultiPlotRange ? `<button type="button" class="btn btn-secondary btn-sm" onclick="openSplitPlotWizard(${p.id})" title="Split individual calibrated plots (e.g. Plots 6–8 vs. Plots 9–12) using their drawn polygons">${SVG_ICONS.scissors} <span>Split Range</span></button>` : ''}
                                <button type="button" class="btn btn-secondary btn-sm" onclick="togglePlotHistoryRow('${escapeHtml(p.plot_code)}')" title="View planting, harvest, and split history for this plot" aria-label="View planting and crop history">${SVG_ICONS.history} <span>${histCount}</span></button>
                                <button type="button" class="btn btn-danger btn-sm" onclick="deletePlotRow(${p.id})" title="Delete plot">${SVG_ICONS.trash}</button>
                            </div>
                        </td>
                    </tr>
                    ${isExpanded ? `
                    <tr>
                        <td colspan="7" style="background:rgba(2,6,23,0.55); padding:14px 20px;">
                            <div style="font-size:11.5px; font-weight:700; color:var(--role-accent-light); text-transform:uppercase; margin-bottom:8px;">Crop Rotation & Split/Merge History (${escapeHtml(p.plot_code)})</div>
                            <div id="hist-body-${escapeHtml(p.plot_code)}">
                                ${(p.history && p.history.length > 0) ? `
                                    <div class="history-timeline">
                                        ${p.history.map(h => `
                                            <div class="history-event">
                                                <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                                                    <span class="status-pill status-pill-blue" style="font-size:10px;">${escapeHtml(h.event_type)}</span>
                                                    <span class="mono-id" style="font-size:11px;">${new Date(h.created_at).toLocaleString()} • ${escapeHtml(h.changed_by || 'system')}</span>
                                                </div>
                                                <div style="font-size:12.5px; color:#e2e8f0; margin-top:4px;">${escapeHtml(h.summary)}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : `<div class="help-tip">No planting or crop history recorded for this plot yet.</div>`}
                            </div>
                        </td>
                    </tr>` : ''}
                    `;
                }).join('')}
            </tbody>
        </table>
        </div>
    `;
}

export async function renderPlotsTab(container) {
    PortalState.cachedPlots = await apiFetch(`/api/admin/plots?station=${PortalState.currentStation}`);
    const canSplitMerge = hasPermission('plots:split_merge');

    container.innerHTML = `
        ${renderWorkflowBanner('Agricultural Plots, Crops & Timeline')}

        <div class="panel-card">
            <div class="panel-header">
                <div class="panel-title-group">
                    <div class="panel-title-icon">${SVG_ICONS.sprout}</div>
                    <div>
                        <h3>Agricultural Plots & Crop Directory — DA-${PortalState.currentStation.toUpperCase()} <span class="mono-code" style="font-size:12px; vertical-align:middle; margin-left:6px;">${PortalState.currentStation === 'lares' ? `${PortalState.cachedPlots.length} planted zones • 45 total plots` : `${PortalState.cachedPlots.length} ${PortalState.cachedPlots.length === 1 ? 'plot' : 'plots'}`}</span></h3>
                        <div class="help-tip">Update what is planted inside each plot or screenhouse. Multi-plot ranges (such as <strong>Plots 6–12</strong>) show <strong>Split Range</strong> so you can divide them into separate crops using the 45 individual plot polygons already drawn in the editor, or click <strong>Merge Adjacent Plots</strong> to combine adjacent plots with the same crop.</div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    ${canSplitMerge && PortalState.cachedPlots.length >= 2
                        ? `<button type="button" class="btn btn-blue" onclick="openMergePlotWizard()">${SVG_ICONS.plus} <span>Merge Adjacent Plots</span></button>` : ''}
                    <button type="button" class="btn btn-emerald" onclick="openPlotModal(null)">${SVG_ICONS.plus} <span>Add Agricultural Plot</span></button>
                </div>
            </div>

            <div class="portal-filter-grid-2" style="display:grid; grid-template-columns:1.5fr 1fr; gap:10px; margin-bottom:16px;">
                <input type="text" id="plot-search-input" class="form-control" placeholder="Search plot #, name, crop, or code..." value="${escapeHtml(plotSearch)}">
                <select id="plot-status-filter" class="form-control">
                    <option value="">All Public Map Statuses</option>
                    <option value="Existing" ${plotStatusFilter === 'Existing' ? 'selected' : ''}>Existing (Live Default)</option>
                    <option value="Under Construction" ${plotStatusFilter === 'Under Construction' ? 'selected' : ''}>Under Construction</option>
                    <option value="Proposed" ${plotStatusFilter === 'Proposed' ? 'selected' : ''}>Proposed Land-Use</option>
                </select>
            </div>

            <div id="plots-table-host"></div>
        </div>
    `;

    renderPlotsTable();

    document.getElementById('plot-search-input')?.addEventListener('input', (e) => {
        plotSearch = e.target.value;
        renderPlotsTable();
    });
    document.getElementById('plot-status-filter')?.addEventListener('change', (e) => {
        plotStatusFilter = e.target.value;
        renderPlotsTable();
    });
}

window.togglePlotHistoryRow = async (plotCode) => {
    if (expandedHistoryCodes.has(plotCode)) {
        expandedHistoryCodes.delete(plotCode);
        renderPlotsTable();
        return;
    }
    expandedHistoryCodes.add(plotCode);
    renderPlotsTable();
    try {
        const fresh = await apiFetch(`/api/admin/plots/${encodeURIComponent(plotCode)}/history?station=${PortalState.currentStation}`);
        const target = PortalState.cachedPlots.find(p => p.plot_code === plotCode);
        if (target) target.history = fresh;
        renderPlotsTable();
    } catch (_) {}
};

window.openPlotModal = (plotId) => {
    const cur = plotId ? PortalState.cachedPlots.find(p => p.id === plotId) : {
        id: null, plot_code: '', plot_number: '', zone_name: '', category: 'orchard',
        icon: 'sprout', color: '#10b981', current_crop: '', tree_or_plant_count: '',
        cropping_cycle: 'perennial', cycle_months: 'Year-round (Perennial)', area_hectares: '',
        soil_type: '', status: 'Active', facility_status: 'Existing', description: '', image_webp_url: '', subPlots: []
    };
    PortalState.editingPlot = cur;
    const curFStatus = cur.facility_status || 'Existing';
    const curColor = cur.color || '#10b981';
    const curIcon = cur.icon || 'sprout';
    const hasGeo = hasPlotGeometry(cur);
    const plotDrawUrl = PortalState.currentStation === 'rares' ? '/plot_draw.html?station=rares' : '';

    document.getElementById('plot-modal-title').textContent = cur.id
        ? `Edit Agricultural Plot: ${cur.zone_name}`
        : `Add Agricultural Plot — DA-${PortalState.currentStation.toUpperCase()}`;

    document.getElementById('plot-modal-body').innerHTML = `
        <div class="alert-revision-card" style="margin-bottom:14px; background:${hasGeo ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.10)'}; border-color:${hasGeo ? 'rgba(16,185,129,0.28)' : 'rgba(245,158,11,0.38)'}; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div>
                <strong style="color:${hasGeo ? '#34d399' : '#fbbf24'}; font-size:12.5px; display:inline-flex; align-items:center; gap:6px;">
                    ${hasGeo ? `${SVG_ICONS.check} <span>Plot Polygon & Coordinates Mapped — Ready to Publish Live</span>` : `${SVG_ICONS.alertTriangle} <span>Unmapped Plot Record — Missing Polygon / Coordinates</span>`}
                </strong>
                <div class="help-tip" style="margin-top:3px; color:#cbd5e1;">
                    ${hasGeo
                        ? 'This plot has verified boundary geometry and can be published safely to the public map.'
                        : 'Save & Publish Live is locked until polygon geometry or coordinates exist so unmapped plots cannot spawn fallback [121.1665, 13.9585] boxes.'}
                </div>
            </div>
            ${plotDrawUrl ? `<a href="${plotDrawUrl}" target="_blank" class="btn btn-blue btn-sm">Open Plot Drawer →</a>` : ''}
        </div>
        <div class="form-grid-3">
            <div class="form-group"><label>Plot Number / Range *</label><input type="text" id="pm-num" class="form-control" style="font-family:var(--font-mono);" value="${escapeHtml(cur.plot_number || '')}" placeholder="e.g. Plot 1 or Plots 6–12"></div>
            <div class="form-group"><label>Plot / Field Name *</label><input type="text" id="pm-name" class="form-control" value="${escapeHtml(cur.zone_name || '')}" placeholder="e.g. Citrus Orchard"></div>
            <div class="form-group">
                <label>Public Map Status</label>
                <select id="pm-fstatus" class="form-control">
                    ${['Existing', 'Under Construction', 'Proposed'].map(s => `<option value="${s}" ${curFStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
                <div class="help-tip" id="pm-fstatus-help">${escapeHtml((FACILITY_STATUS_META[curFStatus] || FACILITY_STATUS_META.Existing).help)}</div>
            </div>
        </div>

        <div class="form-grid-3">
            <div class="form-group"><label>Current Planted Crop</label><input type="text" id="pm-crop" class="form-control" value="${escapeHtml(cur.current_crop || '')}"></div>
            <div class="form-group"><label>Tree / Plant Count</label><input type="number" id="pm-trees" class="form-control" style="font-family:var(--font-mono);" value="${cur.tree_or_plant_count ?? ''}"></div>
            <div class="form-group"><label>Area (Hectares)</label><input type="number" step="0.01" id="pm-area" class="form-control" style="font-family:var(--font-mono);" value="${cur.area_hectares ?? ''}"></div>
        </div>

        <div class="form-grid-3">
            <div class="form-group">
                <label>Growth / Field Stage</label>
                <select id="pm-status" class="form-control">
                    ${['Active', 'Harvesting', 'Vegetative Growth', 'Land Preparation', 'Fallow / Soil Rest'].map(s => `<option value="${s}" ${cur.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Cropping Cycle Type</label>
                <select id="pm-cycle" class="form-control">
                    <option value="perennial" ${cur.cropping_cycle === 'perennial' ? 'selected' : ''}>Perennial (Multi-Year)</option>
                    <option value="annual" ${cur.cropping_cycle === 'annual' ? 'selected' : ''}>Annual (Yearly Crop)</option>
                    <option value="monthly_seasonal" ${cur.cropping_cycle === 'monthly_seasonal' ? 'selected' : ''}>Monthly / Seasonal</option>
                    <option value="fallow" ${cur.cropping_cycle === 'fallow' ? 'selected' : ''}>Fallow / Soil Rest</option>
                </select>
            </div>
            <div class="form-group"><label>Cycle Months Label</label><input type="text" id="pm-months" class="form-control" value="${escapeHtml(cur.cycle_months || '')}" placeholder="e.g. Dry Season (Nov–Apr)"></div>
        </div>

        <div class="form-group"><label>Agronomic Field Notes</label><textarea id="pm-desc" class="form-control" rows="2">${escapeHtml(cur.description || '')}</textarea></div>

        <div class="form-grid-2">
            <div class="form-group">
                <label>Polygon Highlight Color</label>
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="color" id="pm-color-picker" value="${escapeHtml(curColor)}" style="width:42px; height:36px; border:none; border-radius:8px; background:transparent; cursor:pointer;">
                    <input type="text" id="pm-color" class="form-control" style="width:120px; font-family:var(--font-mono);" value="${escapeHtml(curColor)}">
                </div>
                <div class="color-presets-row" id="pm-color-swatches">
                    ${PIN_COLOR_PRESETS.map(p => `<button type="button" class="color-swatch-btn ${curColor.toLowerCase() === p.hex ? 'active' : ''}" data-hex="${p.hex}" style="background:${p.hex};"></button>`).join('')}
                </div>
            </div>
            <div class="form-group">
                <label>Plot Marker Icon</label>
                <input type="hidden" id="pm-icon" value="${escapeHtml(curIcon)}">
                <div class="icon-gallery-grid" id="pm-icon-gallery">
                    ${ICON_GALLERY.slice(0, 8).map(ic => `
                        <button type="button" class="icon-tile ${curIcon === ic.id ? 'active' : ''}" data-icon-id="${ic.id}">
                            ${SVG_ICONS[ic.svgKey] || SVG_ICONS.sprout}
                            <span>${ic.label}</span>
                        </button>`).join('')}
                </div>
            </div>
        </div>

        <div class="form-group">
            <label>Plot Cover Photo (Automatically Converted to WebP)</label>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                <div id="pm-img-preview-box" style="width:92px; height:60px; border-radius:9px; overflow:hidden; border:1px solid rgba(148,163,184,0.25); background:rgba(2,6,23,0.7); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    ${cur.image_webp_url
                        ? `<img src="/${escapeHtml(String(cur.image_webp_url).replace(/^\/+/, ''))}" alt="Plot photo" style="width:100%; height:100%; object-fit:cover;">`
                        : `<span style="color:#64748b; font-size:11px;">No Photo</span>`}
                </div>
                <div style="flex:1; min-width:180px; display:flex; flex-direction:column; gap:6px;">
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <input type="file" id="pm-img-file" accept="image/*" style="display:none;">
                        <button type="button" class="btn btn-emerald btn-sm" id="pm-img-upload-btn">${SVG_ICONS.upload} Upload Photo (.jpg/.png → .webp)</button>
                        <button type="button" class="btn btn-danger btn-sm" id="pm-img-clear-btn" style="${cur.image_webp_url ? '' : 'display:none;'}">Remove</button>
                    </div>
                    <input type="text" id="pm-img" class="form-control" style="font-family:var(--font-mono); font-size:11.5px; height:30px;" value="${escapeHtml(cur.image_webp_url || '')}" placeholder="Automatically filled when you upload a photo">
                </div>
            </div>
        </div>

        ${(cur.subPlots && cur.subPlots.length > 0) ? `
        <hr style="border:none; border-top:1px solid rgba(255,255,255,0.08); margin:16px 0;">
        <div>
            <label style="font-size:12px; font-weight:700; color:var(--role-accent-light); text-transform:uppercase;">Official Screenhouse Sub-Plots (${cur.subPlots.length})</label>
            <div style="display:grid; gap:8px; margin-top:8px;">
                ${cur.subPlots.map(sp => `
                    <div class="subplot-inline-grid" style="padding:10px; border-radius:9px; background:rgba(9,13,22,0.72); border:1px solid var(--border-subtle); display:grid; grid-template-columns:1.2fr 1.2fr 0.7fr auto; gap:8px; align-items:center;">
                        <input type="text" class="form-control" id="sp-name-${sp.id}" value="${escapeHtml(sp.name || '')}" style="height:32px; font-size:12px;" placeholder="Screenhouse name">
                        <input type="text" class="form-control" id="sp-crop-${sp.id}" value="${escapeHtml(sp.current_crop || '')}" style="height:32px; font-size:12px;" placeholder="Planted crop">
                        <input type="number" class="form-control" id="sp-cnt-${sp.id}" value="${sp.tree_or_plant_count ?? ''}" style="height:32px; font-size:12px;" placeholder="Count">
                        <button type="button" class="btn btn-blue btn-sm" onclick="saveSubplotInline(${sp.id})">Save</button>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}
    `;

    document.getElementById('pm-fstatus')?.addEventListener('change', (e) => {
        const tip = document.getElementById('pm-fstatus-help');
        if (tip) tip.textContent = (FACILITY_STATUS_META[e.target.value] || FACILITY_STATUS_META.Existing).help;
    });

    // Friendly Auto-WebP Plot Photo Uploader
    const pmImgInput = document.getElementById('pm-img');
    const pmImgFile = document.getElementById('pm-img-file');
    const pmImgPreview = document.getElementById('pm-img-preview-box');
    const pmImgClear = document.getElementById('pm-img-clear-btn');
    document.getElementById('pm-img-upload-btn')?.addEventListener('click', () => pmImgFile?.click());
    pmImgClear?.addEventListener('click', () => {
        if (pmImgInput) pmImgInput.value = '';
        if (pmImgPreview) pmImgPreview.innerHTML = `<span style="color:#64748b; font-size:11px;">No Photo</span>`;
        if (pmImgClear) pmImgClear.style.display = 'none';
    });
    pmImgFile?.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
            showToast('Converting photo to WebP...');
            const webpDataUrl = await fileToWebpDataUrl(file, 1440, 0.84);
            const up = await apiFetch('/api/admin/upload-webp', {
                method: 'POST',
                body: JSON.stringify({
                    station_id: PortalState.currentStation,
                    filename: file.name,
                    base64_data: webpDataUrl
                })
            });
            if (pmImgInput) pmImgInput.value = up.image_webp_url || '';
            if (pmImgPreview) pmImgPreview.innerHTML = `<img src="${escapeHtml(webpDataUrl)}" alt="Plot photo" style="width:100%; height:100%; object-fit:cover;">`;
            if (pmImgClear) pmImgClear.style.display = '';
            showToast('Photo converted to WebP & attached! Click Submit/Save to apply.');
        } catch (err) {
            showToast(`Photo upload failed: ${err.message}`);
        }
    });

    const cp = document.getElementById('pm-color-picker');
    const ct = document.getElementById('pm-color');
    const syncColor = (hex) => {
        if (cp) cp.value = hex;
        if (ct) ct.value = hex;
        document.querySelectorAll('#pm-color-swatches .color-swatch-btn').forEach(b => b.classList.toggle('active', b.dataset.hex.toLowerCase() === hex.toLowerCase()));
    };
    cp?.addEventListener('input', (e) => syncColor(e.target.value));
    ct?.addEventListener('input', (e) => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) syncColor(e.target.value); });
    document.querySelectorAll('#pm-color-swatches .color-swatch-btn').forEach(btn => btn.addEventListener('click', () => syncColor(btn.dataset.hex)));

    document.querySelectorAll('#pm-icon-gallery .icon-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            document.getElementById('pm-icon').value = tile.dataset.iconId;
            document.querySelectorAll('#pm-icon-gallery .icon-tile').forEach(t => t.classList.remove('active'));
            tile.classList.add('active');
        });
    });

    const adminDirect = canPublish();
    if (adminDirect) {
        setPlotModalFooter(hasGeo
            ? `<button type="button" class="btn btn-secondary" onclick="closePlotModal()">Cancel</button>
               <button type="button" class="btn btn-blue" onclick="submitPlotModal(true, false)">Submit for Review</button>
               <button type="button" class="btn btn-emerald" onclick="submitPlotModal(false, false)">Save & Publish Live</button>`
            : `<button type="button" class="btn btn-secondary" onclick="closePlotModal()">Cancel</button>
               <button type="button" class="btn btn-blue" onclick="submitPlotModal(false, true)">Save Unmapped Draft (Hidden)</button>
               <button type="button" class="btn btn-emerald" disabled style="opacity:0.45; cursor:not-allowed;" title="Locked until plot polygon or coordinates exist">Save & Publish Live (Needs Geometry)</button>`);
    } else {
        setPlotModalFooter(`<button type="button" class="btn btn-secondary" onclick="closePlotModal()">Cancel</button>
               <button type="button" class="btn btn-emerald" onclick="submitPlotModal(true, false)">Submit for Reviewer Approval →</button>`);
    }

    document.getElementById('plot-modal').classList.add('open');
};

function setPlotModalFooter(html) {
    const footer = document.querySelector('#plot-modal .modal-footer');
    if (footer) footer.innerHTML = html;
}

window.closePlotModal = () => {
    document.getElementById('plot-modal').classList.remove('open');
};

window.submitPlotModal = async (submitForReview = false, asDraft = false) => {
    const cur = PortalState.editingPlot || {};
    const zone_name = document.getElementById('pm-name').value.trim();
    const plot_number = document.getElementById('pm-num').value.trim();
    if (!zone_name || !plot_number) {
        showToast('Plot Number and Plot Name are required.');
        return;
    }

    // If creating a plot whose plot_number matches calibrated plots in ALL_PLOT_POLYGONS, auto-attach its calibrated polygon
    const parsedNums = parsePlotNumbersFromLabel(plot_number);
    const calibrated = (!cur.polygon_geojson && parsedNums.length > 0)
        ? buildCalibratedPolygonForPlotNums(parsedNums)
        : { polygon: null, areaHa: 0 };

    const payload = {
        station_id: PortalState.currentStation,
        plot_code: cur.plot_code || `zone_${zone_name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        plot_number,
        zone_name,
        category: cur.category || 'orchard',
        icon: document.getElementById('pm-icon').value || 'sprout',
        color: document.getElementById('pm-color').value.trim() || '#10b981',
        current_crop: document.getElementById('pm-crop').value.trim(),
        tree_or_plant_count: document.getElementById('pm-trees').value === '' ? null : Number(document.getElementById('pm-trees').value),
        area_hectares: document.getElementById('pm-area').value === '' ? (calibrated.areaHa || null) : Number(document.getElementById('pm-area').value),
        cropping_cycle: document.getElementById('pm-cycle').value,
        cycle_months: document.getElementById('pm-months').value.trim(),
        status: document.getElementById('pm-status').value,
        facility_status: document.getElementById('pm-fstatus').value,
        description: document.getElementById('pm-desc').value.trim(),
        image_webp_url: document.getElementById('pm-img').value.trim() || null,
        polygon_geojson: cur.polygon_geojson || calibrated.polygon || undefined,
        asDraft: Boolean(asDraft),
        submitForReview: Boolean(submitForReview)
    };

    const ok = await showPortalConfirm({
        title: asDraft
            ? 'Save Plot as Draft?'
            : (submitForReview ? 'Submit Plot for Review?' : 'Save & Publish Plot Changes?'),
        message: asDraft
            ? `Save "${zone_name}" (${plot_number}) as an unmapped draft?`
            : (submitForReview
                ? `Submit updates to "${zone_name}" (${plot_number}) for Station Reviewer approval?`
                : `Are you sure you want to save and publish "${zone_name}" (${plot_number}) to the live 3D map?`),
        confirmLabel: asDraft ? 'Yes, Save Draft' : (submitForReview ? 'Yes, Submit' : 'Yes, Save & Publish'),
        cancelLabel: 'Cancel'
    });
    if (!ok) return;

    const res = cur.id
        ? await apiFetch(`/api/admin/plots/${cur.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await apiFetch('/api/admin/plots', { method: 'POST', body: JSON.stringify(payload) });

    window.closePlotModal();
    if (res.published) {
        broadcastDbSync();
        showToast(`Plot "${zone_name}" published live to 3D map!`);
    } else if (res.savedAsDraft) {
        showToast(`Saved "${zone_name}" as Unmapped Draft (hidden from public map until geometry is drawn).`);
    } else {
        showToast(`Submitted "${zone_name}" (#${res.changeRequestId}) for Station Reviewer approval!`);
    }
    window.refreshCurrentTab();
};

window.saveSubplotInline = async (spId) => {
    const subName = document.getElementById(`sp-name-${spId}`)?.value.trim() || `Sub-Plot #${spId}`;
    const ok = await showPortalConfirm({
        title: 'Save Sub-Plot Changes?',
        message: `Are you sure you want to save changes to "${subName}"?`,
        confirmLabel: 'Yes, Save Sub-Plot',
        cancelLabel: 'Cancel'
    });
    if (!ok) return;

    const payload = {
        name: document.getElementById(`sp-name-${spId}`)?.value.trim(),
        current_crop: document.getElementById(`sp-crop-${spId}`)?.value.trim(),
        tree_or_plant_count: document.getElementById(`sp-cnt-${spId}`)?.value === '' ? null : Number(document.getElementById(`sp-cnt-${spId}`).value)
    };
    const res = await apiFetch(`/api/admin/subplots/${spId}`, { method: 'PUT', body: JSON.stringify(payload) });
    if (res.published) {
        broadcastDbSync();
        showToast('Screenhouse sub-plot updated live!');
    } else {
        showToast(`Sub-plot update (#${res.changeRequestId}) sent to Reviewer!`);
    }
};

// =========================================================================
// EDITOR-BACKED VISUAL MULTI-PLOT RANGE SPLIT WIZARD (e.g. Plots 6–12 -> Plots 6–8 + Plots 9–12)
// =========================================================================
window.openSplitPlotWizard = (plotId) => {
    const parent = PortalState.cachedPlots.find(p => p.id === plotId);
    if (!parent) return;

    const allNums = parsePlotNumbersFromLabel(parent.plot_number);
    if (allNums.length < 2) {
        showToast('This plot is already a single individual plot.');
        return;
    }

    // Default split: second half of the plot numbers splits off (e.g., for 6..12 -> 6..8 stays, 9..12 splits off)
    const midIdx = Math.floor(allNums.length / 2);
    const splitSet = new Set(allNums.slice(midIdx));
    const parentColor = parent.color || '#f97316';
    let splitColor = '#10b981';

    document.getElementById('plot-modal-title').textContent = `Split Combined Plot Range — ${parent.zone_name} (${parent.plot_number || parent.plot_code})`;
    document.getElementById('plot-modal-body').innerHTML = `
        <div class="alert-revision-card" style="background:rgba(16,185,129,0.10); border-color:rgba(52,211,153,0.32);">
            <strong style="color:#34d399; font-size:13px;">Editor-Calibrated Polygon Split (${allNums.length} Individual Plots Available)</strong>
            <div class="help-tip" style="color:#cbd5e1; margin-top:4px;">
                Because <strong>${escapeHtml(parent.plot_number)}</strong> is composed of ${allNums.length} individual calibrated plot polygons drawn in the editor, click any plot on the visual map or pill strip below to assign it to <strong>Remaining Plot A</strong> or <strong>New Split Plot B</strong>. Both resulting plots automatically receive their exact merged polygons on the 3D map.
            </div>
        </div>

        <div style="margin-bottom:12px;">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:6px; font-size:11.5px;">
                <span style="font-weight:700; color:#f8fafc;">Click Individual Plots to Toggle Assignment:</span>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="display:inline-flex; align-items:center; gap:5px; color:#fdba74;"><span style="width:11px; height:11px; border-radius:3px; background:${escapeHtml(parentColor)}; display:inline-block;"></span>Remaining Plot A (${escapeHtml(parent.zone_name)})</span>
                    <span style="display:inline-flex; align-items:center; gap:5px; color:#6ee7b7;"><span style="width:11px; height:11px; border-radius:3px; background:#10b981; display:inline-block;"></span>New Split Plot B</span>
                </div>
            </div>
            <div id="spw-svg-host"></div>
            <div id="spw-pills-host" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;"></div>
        </div>

        <div class="form-grid-2">
            <div class="form-group">
                <label>Remaining Plot A Range (Auto-Computed) *</label>
                <input type="text" id="spw-parent-num" class="form-control" style="font-family:var(--font-mono);" required>
            </div>
            <div class="form-group">
                <label>New Split Plot B Number / Range (Auto-Computed) *</label>
                <input type="text" id="spw-num" class="form-control" style="font-family:var(--font-mono);" required>
            </div>
        </div>

        <div class="form-grid-2">
            <div class="form-group">
                <label>New Split Plot B Name *</label>
                <input type="text" id="spw-zone" class="form-control" placeholder="e.g. Cacao Experimental Area" required>
            </div>
            <div class="form-group">
                <label>New Split Plot B Planted Crop *</label>
                <input type="text" id="spw-crop" class="form-control" placeholder="e.g. Criollo & Trinitario Cacao" value="${escapeHtml(parent.current_crop || '')}">
            </div>
        </div>

        <div class="form-grid-3">
            <div class="form-group">
                <label>Cropping Cycle</label>
                <select id="spw-cycle" class="form-control">
                    <option value="perennial" ${parent.cropping_cycle === 'perennial' ? 'selected' : ''}>Perennial</option>
                    <option value="annual" ${parent.cropping_cycle === 'annual' ? 'selected' : ''}>Annual</option>
                    <option value="monthly_seasonal" ${parent.cropping_cycle === 'monthly_seasonal' ? 'selected' : ''}>Monthly / Seasonal</option>
                    <option value="fallow" ${parent.cropping_cycle === 'fallow' ? 'selected' : ''}>Fallow</option>
                </select>
            </div>
            <div class="form-group">
                <label>Split Plot B Area (ha)</label>
                <input type="number" step="0.01" id="spw-area" class="form-control" style="font-family:var(--font-mono);">
            </div>
            <div class="form-group">
                <label>Reason / Audit Note</label>
                <input type="text" id="spw-notes" class="form-control" placeholder="e.g. Planted Plots 9–12 with new crop">
            </div>
        </div>
    `;

    let computedParentPoly = null;
    let computedSplitPoly = null;

    const syncSplitUi = () => {
        const stayNums = allNums.filter(n => !splitSet.has(n));
        const splitNums = allNums.filter(n => splitSet.has(n));

        const parentLabel = formatPlotNumbersLabel(stayNums);
        const splitLabel = formatPlotNumbersLabel(splitNums);

        const parentGeo = buildCalibratedPolygonForPlotNums(stayNums);
        const splitGeo = buildCalibratedPolygonForPlotNums(splitNums);
        computedParentPoly = parentGeo.polygon;
        computedSplitPoly = splitGeo.polygon;

        const parentInput = document.getElementById('spw-parent-num');
        const splitInput = document.getElementById('spw-num');
        const areaInput = document.getElementById('spw-area');
        if (parentInput) parentInput.value = parentLabel;
        if (splitInput) splitInput.value = splitLabel;
        if (areaInput && splitGeo.areaHa) areaInput.value = splitGeo.areaHa;

        const svgHost = document.getElementById('spw-svg-host');
        if (svgHost) {
            svgHost.innerHTML = renderCalibratedPlotStripSvg(allNums, splitSet, parentColor, splitColor);
            svgHost.querySelectorAll('[data-click-plot-num]').forEach(g => {
                g.addEventListener('click', () => {
                    const n = Number(g.dataset.clickPlotNum);
                    togglePlotInSplit(n);
                });
            });
        }

        const pillsHost = document.getElementById('spw-pills-host');
        if (pillsHost) {
            pillsHost.innerHTML = allNums.map(n => {
                const isSp = splitSet.has(n);
                return `
                    <button type="button" class="btn btn-sm" data-pill-plot="${n}" style="background:${isSp ? 'rgba(16,185,129,0.20)' : 'rgba(249,115,22,0.18)'}; border:1px solid ${isSp ? '#10b981' : parentColor}; color:#f8fafc; font-weight:700;">
                        Plot ${n} → ${isSp ? 'New Plot B' : 'Keep in A'}
                    </button>
                `;
            }).join('');
            pillsHost.querySelectorAll('[data-pill-plot]').forEach(btn => {
                btn.addEventListener('click', () => {
                    togglePlotInSplit(Number(btn.dataset.pillPlot));
                });
            });
        }
    };

    const togglePlotInSplit = (n) => {
        if (splitSet.has(n)) {
            if (splitSet.size <= 1) {
                showToast('At least 1 plot must be selected to split off.');
                return;
            }
            splitSet.delete(n);
        } else {
            if (splitSet.size >= allNums.length - 1) {
                showToast('At least 1 plot must remain in the parent plot.');
                return;
            }
            splitSet.add(n);
        }
        syncSplitUi();
    };

    syncSplitUi();

    window._execSplit = async (submitForReview) => {
        const splitNum = document.getElementById('spw-num')?.value.trim();
        const zoneName = document.getElementById('spw-zone')?.value.trim();
        const parentNum = document.getElementById('spw-parent-num')?.value.trim();
        if (!splitNum || !parentNum) {
            showToast('Both Remaining Plot A and New Split Plot B must have at least 1 plot assigned.');
            return;
        }
        if (!zoneName) {
            showToast('Please enter the New Split Plot B Name.');
            document.getElementById('spw-zone')?.focus();
            return;
        }
        const payload = {
            station_id: PortalState.currentStation,
            split_plot_number: splitNum,
            zone_name: zoneName,
            current_crop: document.getElementById('spw-crop')?.value.trim(),
            cropping_cycle: document.getElementById('spw-cycle')?.value,
            area_hectares: document.getElementById('spw-area')?.value ? Number(document.getElementById('spw-area').value) : null,
            updated_parent_plot_number: parentNum,
            updated_parent_polygon_geojson: computedParentPoly,
            polygon_geojson: computedSplitPoly,
            split_polygon_geojson: computedSplitPoly,
            notes: document.getElementById('spw-notes')?.value.trim(),
            submitForReview: Boolean(submitForReview)
        };
        const ok = await showPortalConfirm({
            title: submitForReview ? 'Submit Plot Split for Review?' : 'Confirm Plot Split & Publish?',
            message: submitForReview
                ? `Submit split of "${parentNum}" into "${splitNum}" for Reviewer approval?`
                : `Are you sure you want to save and publish the split of "${parentNum}" and "${splitNum}" to the live 3D map?`,
            confirmLabel: submitForReview ? 'Yes, Submit Split' : 'Yes, Split & Save',
            cancelLabel: 'Cancel'
        });
        if (!ok) return;

        const res = await apiFetch(`/api/admin/plots/${parent.id}/split`, { method: 'POST', body: JSON.stringify(payload) });
        if (res.published) {
            broadcastDbSync();
            showToast(`Split "${parentNum}" and "${splitNum}" with exact calibrated polygons on the 3D map!`);
        } else {
            showToast(`Split proposal for "${splitNum}" (#${res.changeRequestId}) sent for Reviewer approval!`);
        }
        window.closePlotModal();
        window.refreshCurrentTab();
    };

    setPlotModalFooter(canPublish()
        ? `<button type="button" class="btn btn-secondary" onclick="closePlotModal()">Cancel</button>
           <button type="button" class="btn btn-blue" onclick="window._execSplit(true)">Submit Split for Review</button>
           <button type="button" class="btn btn-emerald" onclick="window._execSplit(false)">Split & Publish Live</button>`
        : `<button type="button" class="btn btn-secondary" onclick="closePlotModal()">Cancel</button>
           <button type="button" class="btn btn-emerald" onclick="window._execSplit(true)">Submit Plot Split for Approval →</button>`);

    document.getElementById('plot-modal').classList.add('open');
};

// =========================================================================
// EDITOR-BACKED MERGE ADJACENT PLOTS WIZARD
// =========================================================================
window.openMergePlotWizard = () => {
    const plots = PortalState.cachedPlots || [];
    if (plots.length < 2) {
        showToast('Need at least 2 plots to merge.');
        return;
    }
    document.getElementById('plot-modal-title').textContent = `Merge Adjacent Plots Into Combined Plot`;
    document.getElementById('plot-modal-body').innerHTML = `
        <div class="alert-revision-card" style="background:rgba(16,185,129,0.10); border-color:rgba(52,211,153,0.32);">
            <strong style="color:#34d399; font-size:13px;">Editor-Calibrated Adjacent Plot Merge</strong>
            <div class="help-tip" style="color:#cbd5e1; margin-top:4px;">
                Select the <strong>Target Plot</strong> and check the adjacent plot(s) sharing the same crop to merge into it (for example, merging <strong>Plots 6–8</strong> and <strong>Plots 9–12</strong> back into <strong>Plots 6–12</strong>). Their calibrated polygons from the editor are automatically combined into a single outer boundary.
            </div>
        </div>

        <div class="form-grid-2">
            <div class="form-group">
                <label>Target Plot *</label>
                <select id="mgw-target" class="form-control">
                    ${plots.map(p => `<option value="${p.id}">${escapeHtml(p.plot_number || p.plot_code)} — ${escapeHtml(p.zone_name)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Combined Plot Numbers (Auto-Computed)</label>
                <input type="text" id="mgw-num" class="form-control" style="font-family:var(--font-mono);" placeholder="e.g. Plots 6–12">
            </div>
        </div>
        <div class="form-grid-2">
            <div class="form-group"><label>Updated Plot Name</label><input type="text" id="mgw-zone" class="form-control" placeholder="Leave blank to keep target name"></div>
            <div class="form-group"><label>Total Combined Area (ha)</label><input type="number" step="0.01" id="mgw-area" class="form-control" style="font-family:var(--font-mono);"></div>
        </div>

        <div class="form-group">
            <label>Select Adjacent Plot(s) to Merge Into Target *</label>
            <div style="max-height:175px; overflow-y:auto; padding:8px; border-radius:9px; background:rgba(9,13,22,0.85); border:1px solid var(--border-default); display:grid; gap:6px;">
                ${plots.map(p => `
                    <label style="display:flex; align-items:center; gap:8px; font-size:12.5px; color:#e2e8f0; cursor:pointer; text-transform:none; letter-spacing:0; margin:0;">
                        <input type="checkbox" class="mgw-src-check" value="${p.id}">
                        <span><strong>${escapeHtml(p.plot_number || p.plot_code)}</strong> — ${escapeHtml(p.zone_name)} <span style="color:#94a3b8;">(${escapeHtml(p.current_crop || 'No crop')})</span></span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;

    let computedMergedPoly = null;

    const syncMergeComputation = () => {
        const targetId = Number(document.getElementById('mgw-target')?.value);
        const targetPlot = plots.find(p => p.id === targetId);
        const checkedIds = Array.from(document.querySelectorAll('.mgw-src-check:checked'))
            .map(el => Number(el.value))
            .filter(id => id !== targetId);

        const combinedPlotObjs = [targetPlot, ...checkedIds.map(id => plots.find(p => p.id === id))].filter(Boolean);
        const allNums = [];
        combinedPlotObjs.forEach(p => {
            parsePlotNumbersFromLabel(p.plot_number).forEach(n => allNums.push(n));
        });
        const uniqueSorted = Array.from(new Set(allNums)).sort((a, b) => a - b);
        const label = formatPlotNumbersLabel(uniqueSorted);
        const geo = buildCalibratedPolygonForPlotNums(uniqueSorted);
        computedMergedPoly = geo.polygon;

        const numEl = document.getElementById('mgw-num');
        const areaEl = document.getElementById('mgw-area');
        if (numEl && label) numEl.value = label;
        if (areaEl && geo.areaHa) areaEl.value = geo.areaHa;
    };

    document.getElementById('mgw-target')?.addEventListener('change', syncMergeComputation);
    document.querySelectorAll('.mgw-src-check').forEach(cb => cb.addEventListener('change', syncMergeComputation));
    syncMergeComputation();

    window._execMerge = async (submitForReview) => {
        const targetId = Number(document.getElementById('mgw-target').value);
        const sourceIds = Array.from(document.querySelectorAll('.mgw-src-check:checked'))
            .map(el => Number(el.value))
            .filter(id => id !== targetId);
        if (sourceIds.length === 0) {
            showToast('Select at least one adjacent plot different from the target plot.');
            return;
        }
        const payload = {
            station_id: PortalState.currentStation,
            target_plot_id: targetId,
            source_plot_ids: sourceIds,
            merged_plot_number: document.getElementById('mgw-num')?.value.trim() || null,
            merged_zone_name: document.getElementById('mgw-zone')?.value.trim() || null,
            merged_area_hectares: document.getElementById('mgw-area')?.value ? Number(document.getElementById('mgw-area').value) : undefined,
            merged_polygon_geojson: computedMergedPoly,
            polygon_geojson: computedMergedPoly,
            submitForReview: Boolean(submitForReview)
        };
        const ok = await showPortalConfirm({
            title: submitForReview ? 'Submit Plot Merge for Review?' : 'Confirm Plot Merge & Publish?',
            message: submitForReview
                ? `Submit merging ${sourceIds.length} adjacent plot(s) into "${payload.merged_plot_number || 'Target Plot'}" for Reviewer approval?`
                : `Are you sure you want to merge ${sourceIds.length} adjacent plot(s) into "${payload.merged_plot_number || 'Target Plot'}" and publish live?`,
            confirmLabel: submitForReview ? 'Yes, Submit Merge' : 'Yes, Merge & Save',
            cancelLabel: 'Cancel'
        });
        if (!ok) return;

        const res = await apiFetch('/api/admin/plots/merge', { method: 'POST', body: JSON.stringify(payload) });
        if (res.published) {
            broadcastDbSync();
            showToast('Merged plots with exact calibrated boundary & archived history!');
        } else {
            showToast(`Merge proposal (#${res.changeRequestId}) sent for Reviewer approval!`);
        }
        window.closePlotModal();
        window.refreshCurrentTab();
    };

    setPlotModalFooter(canPublish()
        ? `<button type="button" class="btn btn-secondary" onclick="closePlotModal()">Cancel</button>
           <button type="button" class="btn btn-blue" onclick="window._execMerge(true)">Submit Merge for Review</button>
           <button type="button" class="btn btn-emerald" onclick="window._execMerge(false)">Merge & Publish Live</button>`
        : `<button type="button" class="btn btn-secondary" onclick="closePlotModal()">Cancel</button>
           <button type="button" class="btn btn-emerald" onclick="window._execMerge(true)">Submit Merge for Reviewer Approval →</button>`);

    document.getElementById('plot-modal').classList.add('open');
};

window.deletePlotRow = async (id) => {
    const p = (PortalState.cachedPlots || []).find(x => x.id === id);
    const resConfirm = await showPortalConfirm({
        title: 'Delete Agricultural Plot?',
        message: `Delete "${p ? (p.zone_name || p.plot_number) : 'this agricultural plot'}" from the station directory? (GIS Editor deletions are queued for Reviewer approval.)`,
        confirmLabel: 'Delete Plot',
        cancelLabel: 'Cancel',
        danger: true,
        requireReason: true,
        reasonLabel: 'Reason for deletion (required)',
        reasonPlaceholder: 'e.g. Duplicate plot entry or decommissioned trial plot'
    });
    if (!resConfirm?.confirmed) return;
    const res = await apiFetch(`/api/admin/plots/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ delete_reason: resConfirm.reason })
    });
    if (res.published) broadcastDbSync();
    showToast(res.published ? 'Plot deleted.' : 'Deletion queued for Reviewer approval.');
    window.refreshCurrentTab();
};
