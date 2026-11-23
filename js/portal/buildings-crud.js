/**
 * Buildings & Multi-Photo WebP Gallery CRUD with Top Hero Slideshow,
 * Interactive Canvas Color Wheel, Live Map Drawer Replica & Red/Green Word Diff
 */

import {
    PortalState,
    SVG_ICONS,
    CATEGORY_LABELS,
    FACILITY_STATUS_META,
    PIN_COLOR_PRESETS,
    ICON_GALLERY,
    apiFetch,
    showToast,
    broadcastDbSync,
    escapeHtml,
    canPublish,
    renderFacilityStatusBadge,
    renderWorkflowBanner,
    fileToWebpDataUrl,
    showPortalConfirm,
    getSavedPortalPref,
    setSavedPortalPref
} from './core.js';

let bldgViewMode = getSavedPortalPref('iguide_pref_bldg_view', 'cards');
let searchTerm = '';
let categoryFilter = '';
let statusFilter = '';
let availableModelsCache = null;

// Active modal editing state (kept isolated from form DOM reloads)
let originalBuildingSnapshot = null;
let workingPhotos = [];
let removedPhotos = [];
let activeSlideIdx = 0;
let previewSlideIdx = 0;
let activeGalleryMode = 'slider'; // 'slider' | 'carousel'
let visitorPreviewIdx = 0;
let activeColorWheelController = null;
let heroStageDropBound = false;

function hasBldgGeometry(b) {
    if (!b) return false;
    if (b.has_geometry === true) return true;
    const hasFp = Boolean(b.footprint_geojson && String(b.footprint_geojson).trim().length > 0);
    const lng = Number(b.marker_lng);
    const lat = Number(b.marker_lat);
    const hasCoords = b.marker_lng !== null && b.marker_lng !== undefined && b.marker_lng !== ''
        && b.marker_lat !== null && b.marker_lat !== undefined && b.marker_lat !== ''
        && Number.isFinite(lng) && Number.isFinite(lat) && !(lng === 0 && lat === 0);
    return hasFp || hasCoords;
}

async function getAvailableModels() {
    if (Array.isArray(availableModelsCache)) return availableModelsCache;
    try {
        availableModelsCache = await apiFetch('/api/admin/models');
    } catch (_) {
        availableModelsCache = [];
    }
    return availableModelsCache;
}

function getFilteredBuildings() {
    return (PortalState.cachedBuildings || []).filter(b => {
        if (categoryFilter && b.category !== categoryFilter) return false;
        if (statusFilter && (b.facility_status || 'Existing') !== statusFilter) return false;
        if (searchTerm) {
            const hay = `${b.name} ${b.building_code} ${b.building_num || ''} ${b.type_label || ''} ${b.category}`.toLowerCase();
            if (!hay.includes(searchTerm.toLowerCase())) return false;
        }
        return true;
    });
}

function normalizeHexColor(hex, fallback = '#10b981') {
    const raw = String(hex || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
        return ('#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3]).toLowerCase();
    }
    return fallback;
}

function hexToRgb(hex) {
    const clean = normalizeHexColor(hex).slice(1);
    return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16)
    };
}

function hexToHsl(hex) {
    const { r: r255, g: g255, b: b255 } = hexToRgb(hex);
    const r = r255 / 255;
    const g = g255 / 255;
    const b = b255 / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h /= 6;
    }
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

function hslToRgb(h, s, l) {
    const hn = (((Number(h) % 360) + 360) % 360) / 360;
    const sn = Math.max(0, Math.min(100, Number(s))) / 100;
    const ln = Math.max(0, Math.min(100, Number(l))) / 100;

    if (sn === 0) {
        const v = Math.round(ln * 255);
        return { r: v, g: v, b: v };
    }
    const hue2rgb = (p, q, t) => {
        let tt = t;
        if (tt < 0) tt += 1;
        if (tt > 1) tt -= 1;
        if (tt < 1 / 6) return p + (q - p) * 6 * tt;
        if (tt < 1 / 2) return q;
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
        return p;
    };
    const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
    const p = 2 * ln - q;
    return {
        r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
        g: Math.round(hue2rgb(p, q, hn) * 255),
        b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255)
    };
}

function hslToHex(h, s, l) {
    const { r, g, b } = hslToRgb(h, s, l);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Interactive circular Hue/Saturation canvas wheel + lightness slider.
 */
function initInteractiveColorWheel(initialHex, onChange) {
    const canvas = document.getElementById('bm-color-wheel-canvas');
    const cursor = document.getElementById('bm-color-cursor');
    const slider = document.getElementById('bm-color-lightness');
    const lightLbl = document.getElementById('bm-color-lightness-val');
    if (!canvas || !cursor || !slider) return null;

    const size = canvas.width || 132;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 2;
    const ctx = canvas.getContext('2d');

    if (ctx) {
        const img = ctx.createImageData(size, size);
        const data = img.data;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.hypot(dx, dy);
                if (dist <= radius) {
                    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
                    const sat = Math.min(100, (dist / radius) * 100);
                    const { r, g, b } = hslToRgb(hue, sat, 50);
                    const edgeAlpha = dist > radius - 1 ? Math.max(0, Math.round((radius - dist) * 255)) : 255;
                    const idx = (y * size + x) * 4;
                    data[idx] = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = edgeAlpha;
                }
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    let stateHsl = hexToHsl(initialHex || '#10b981');
    if (stateHsl.l < 8 || stateHsl.l > 92) stateHsl.l = Math.max(8, Math.min(92, stateHsl.l));

    function updateUi(emit = false) {
        const hex = hslToHex(stateHsl.h, stateHsl.s, stateHsl.l);
        const pureHex = hslToHex(stateHsl.h, stateHsl.s, 50);
        const rad = (stateHsl.h * Math.PI) / 180;
        const rDist = (stateHsl.s / 100) * radius;
        // .color-wheel-canvas-wrap has 2px padding around the 132px canvas
        const leftPx = 2 + cx + Math.cos(rad) * rDist;
        const topPx = 2 + cy + Math.sin(rad) * rDist;
        cursor.style.left = `${leftPx}px`;
        cursor.style.top = `${topPx}px`;
        cursor.style.background = hex;

        slider.value = String(Math.round(stateHsl.l));
        slider.style.background = `linear-gradient(90deg, #000000 0%, ${pureHex} 50%, #ffffff 100%)`;
        if (lightLbl) lightLbl.textContent = `${Math.round(stateHsl.l)}%`;
        if (emit && typeof onChange === 'function') onChange(hex);
    }

    function pickFromClientPoint(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const scaleX = size / rect.width;
        const scaleY = size / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.min(radius, Math.hypot(dx, dy));
        const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
        const sat = Math.round((dist / radius) * 100);
        stateHsl.h = Math.round(hue);
        stateHsl.s = sat;
        updateUi(true);
    }

    let dragging = false;
    canvas.addEventListener('pointerdown', (e) => {
        dragging = true;
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        pickFromClientPoint(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        pickFromClientPoint(e.clientX, e.clientY);
    });
    const endDrag = (e) => {
        dragging = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    slider.addEventListener('input', () => {
        stateHsl.l = Number(slider.value);
        updateUi(true);
    });

    updateUi(false);

    return {
        setHex(newHex) {
            stateHsl = hexToHsl(newHex);
            updateUi(false);
        }
    };
}

/**
 * Word-level Red (Past) vs Green (Changed) diff generator.
 */
function computeWordDiff(pastText, newText) {
    const pStr = String(pastText ?? '');
    const nStr = String(newText ?? '');
    if (pStr === nStr) {
        const esc = escapeHtml(pStr) || '<em style="color:#64748b;">(empty)</em>';
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

    const joinMarked = (segs, markClass) => {
        let html = '';
        let open = false;
        for (const s of segs) {
            const isMarked = s.kind !== 'eq';
            if (isMarked && !open) {
                html += `<mark class="${markClass}">`;
                open = true;
            } else if (!isMarked && open) {
                html += '</mark>';
                open = false;
            }
            html += escapeHtml(s.text);
        }
        if (open) html += '</mark>';
        return html;
    };

    return {
        pastHtml: joinMarked(pastSegs, 'diff-word-del'),
        changedHtml: joinMarked(changedSegs, 'diff-word-add')
    };
}

function getPhotoPreviewSrc(photo) {
    if (!photo) return '';
    if (photo.localDataUrl) return photo.localDataUrl;
    const url = String(photo.image_webp_url || '').replace(/^\/+/, '');
    return url ? `/${url}` : '';
}

function readCurrentBuildingFormState() {
    const rawScale = (document.getElementById('bm-model-scale')?.value || '').trim();
    return {
        building_num: String(document.getElementById('bm-num')?.value ?? '').trim(),
        building_code: String(document.getElementById('bm-code')?.value ?? '').trim(),
        category: String(document.getElementById('bm-category')?.value ?? 'infrastructure'),
        facility_status: String(document.getElementById('bm-fstatus')?.value ?? 'Existing'),
        name: String(document.getElementById('bm-name')?.value ?? '').trim(),
        type_label: String(document.getElementById('bm-type')?.value ?? '').trim(),
        description: String(document.getElementById('bm-desc')?.value ?? '').trim(),
        visual_landmark: String(document.getElementById('bm-landmark')?.value ?? '').trim(),
        key_services: String(document.getElementById('bm-services')?.value ?? '').trim(),
        model_glb_url: String(document.getElementById('bm-model')?.value ?? '').trim(),
        model_rotation: String(document.getElementById('bm-model-rot')?.value ?? '').trim(),
        model_scale: rawScale,
        pin_color: normalizeHexColor(document.getElementById('bm-color')?.value || '#10b981'),
        icon: String(document.getElementById('bm-icon')?.value ?? 'building').trim()
    };
}

function buildBuildingDiffs() {
    if (!originalBuildingSnapshot) return [];
    const cur = readCurrentBuildingFormState();
    const orig = originalBuildingSnapshot;
    const diffs = [];

    const textFields = [
        ['name', 'Official Building Name'],
        ['type_label', 'Facility Type / Subtitle'],
        ['building_num', 'Building Number (#)'],
        ['building_code', 'Unique Building Code'],
        ['category', 'Directory Category'],
        ['facility_status', 'Public Map Status'],
        ['visual_landmark', 'How to Spot It (Visual Landmark)'],
        ['key_services', "What's Inside & Services"],
        ['description', 'Directory Summary'],
        ['icon', 'Directory & Pin Icon'],
        ['model_glb_url', '3D Model (.glb)'],
        ['model_rotation', '3D Bearing Rotation (°)'],
        ['model_scale', '3D Model Scale']
    ];

    for (const [key, label] of textFields) {
        const pastVal = String(orig[key] ?? '');
        const newVal = String(cur[key] ?? '');
        if (pastVal !== newVal) {
            const fmtPast = key === 'category' ? (CATEGORY_LABELS[pastVal] || pastVal) : pastVal;
            const fmtNew = key === 'category' ? (CATEGORY_LABELS[newVal] || newVal) : newVal;
            diffs.push({ field: key, label, type: 'text', past: fmtPast, changed: fmtNew });
        }
    }

    if (normalizeHexColor(orig.pin_color) !== normalizeHexColor(cur.pin_color)) {
        diffs.push({
            field: 'pin_color',
            label: 'Marker Pin Color',
            type: 'color',
            past: normalizeHexColor(orig.pin_color),
            changed: normalizeHexColor(cur.pin_color)
        });
    }

    // Track photo changes (added, removed, caption, primary cover)
    const origImages = Array.isArray(orig.images) ? orig.images : [];
    const origById = new Map(origImages.filter(im => im.id != null).map(im => [String(im.id), im]));

    for (const rm of removedPhotos) {
        diffs.push({
            field: 'photo_remove',
            label: 'Removed Gallery Photo',
            type: 'photo_remove',
            past: `${rm.caption || 'Facility View'} (${rm.image_webp_url || rm.localFilename || 'photo'})`,
            changed: '(Removed from slideshow)'
        });
    }

    for (const ph of workingPhotos) {
        const matchOrig = ph.id != null ? origById.get(String(ph.id)) : null;
        if (!matchOrig) {
            diffs.push({
                field: 'photo_add',
                label: 'Added Gallery Photo',
                type: 'photo_add',
                past: '(Not in gallery)',
                changed: `${ph.caption || 'Facility View'} (${ph.image_webp_url || ph.localFilename || 'WebP photo'})`
            });
        } else {
            const origCap = String(matchOrig.caption || 'Facility View').trim();
            const newCap = String(ph.caption || 'Facility View').trim();
            if (origCap !== newCap) {
                diffs.push({
                    field: 'photo_caption',
                    label: `Photo Caption (${ph.image_webp_url || '#' + ph.id})`,
                    type: 'text',
                    past: origCap,
                    changed: newCap
                });
            }
            const origPrim = Number(matchOrig.is_primary) ? 1 : 0;
            const newPrim = Number(ph.is_primary) ? 1 : 0;
            if (origPrim !== newPrim) {
                diffs.push({
                    field: 'photo_primary',
                    label: `Primary Cover Flag (${ph.caption || 'Photo'})`,
                    type: 'text',
                    past: origPrim ? 'Primary Cover' : 'Secondary Slide',
                    changed: newPrim ? 'Primary Cover' : 'Secondary Slide'
                });
            }
        }
    }

    // Track photo ordering changes (e.g., swapped slides)
    const origOrderSig = origImages.map(im => String(im.image_webp_url || '').trim()).join('|');
    const newOrderSig = workingPhotos.map(im => String(im.image_webp_url || '').trim()).join('|');
    if (origImages.length === workingPhotos.length && origOrderSig !== newOrderSig && !diffs.some(d => d.field === 'photo_primary')) {
        diffs.push({
            field: 'photo_order',
            label: 'Gallery Photo Order',
            type: 'text',
            past: origImages.map((im, i) => `#${i + 1} ${im.caption || 'Photo'}`).join(' → '),
            changed: workingPhotos.map((im, i) => `#${i + 1} ${im.caption || 'Photo'}`).join(' → ')
        });
    }

    const origMode = String(orig.gallery_mode || 'slider');
    if (origMode !== activeGalleryMode) {
        diffs.push({
            field: 'gallery_mode',
            label: 'Photo Gallery Display Mode',
            type: 'text',
            past: origMode === 'carousel' ? 'Carousel' : 'Slider',
            changed: activeGalleryMode === 'carousel' ? 'Carousel' : 'Slider'
        });
    }

    return diffs;
}

function updateResultButtonBadge() {
    const diffs = buildBuildingDiffs();
    const badge = document.getElementById('bldg-diff-btn-badge');
    if (badge) {
        badge.textContent = diffs.length > 0 ? String(diffs.length) : '0';
        badge.style.background = diffs.length > 0 ? 'rgba(16,185,129,0.28)' : 'rgba(148,163,184,0.18)';
        badge.style.color = diffs.length > 0 ? '#6ee7b7' : '#cbd5e1';
    }
    updatePinLivePreview();
}

function updatePinLivePreview() {
    const circle = document.getElementById('bm-pin-preview-circle');
    const hexLabel = document.getElementById('bm-pin-preview-hex');
    const nameLabel = document.getElementById('bm-pin-preview-name');
    const iconGroup = document.getElementById('bm-icon-group');
    const colorIconGrid = document.getElementById('bm-color-icon-grid');
    const sectionSub = document.getElementById('bm-pin-section-sub');
    const hex = normalizeHexColor(document.getElementById('bm-color')?.value || '#10b981');
    const numVal = (document.getElementById('bm-num')?.value || '').trim();
    const bName = (document.getElementById('bm-name')?.value || '').trim() || 'Building Pin Preview';
    const iconId = (document.getElementById('bm-icon')?.value || 'building').trim();
    const iconDef = ICON_GALLERY.find(ic => ic.id === iconId);

    if (circle) {
        circle.style.background = hex;
        if (numVal) {
            circle.textContent = numVal;
        } else {
            circle.innerHTML = (iconDef && SVG_ICONS[iconDef.svgKey]) || SVG_ICONS.building;
        }
    }
    if (hexLabel) {
        hexLabel.textContent = numVal
            ? `${hex.toUpperCase()} • Numbered Pin #${numVal}`
            : `${hex.toUpperCase()} • Unnumbered Utility Icon`;
    }
    if (nameLabel) nameLabel.textContent = bName;

    // Numbered buildings (#1-#39) always display their Building Number (#) in the 3D map pin & directory badge;
    // only show the fallback icon picker when Building Number (#) is blank (unnumbered utility structures).
    if (iconGroup) {
        iconGroup.style.display = numVal ? 'none' : '';
    }
    if (colorIconGrid) {
        colorIconGrid.style.gridTemplateColumns = numVal ? '1fr' : '';
    }
    if (sectionSub) {
        sectionSub.textContent = numVal
            ? `Numbered Building (#${numVal}): The 3D map pin & directory badge automatically display #${numVal}`
            : 'Unnumbered Utility Facility: Choose the badge color and fallback icon shown on the map';
    }
}

function renderBuildingsCollection() {
    const host = document.getElementById('buildings-list-host');
    const countEl = document.getElementById('bldg-filtered-count');
    if (!host) return;

    const list = getFilteredBuildings();
    if (countEl) countEl.textContent = `${list.length} of ${PortalState.cachedBuildings.length} shown`;

    if (list.length === 0) {
        host.innerHTML = `<div style="text-align:center; padding:36px 16px; color:#94a3b8;">No buildings match your search or filters.</div>`;
        return;
    }

    if (bldgViewMode === 'cards') {
        host.innerHTML = `
            <div class="bldg-cards-grid">
                ${list.map(b => {
                    const primaryImg = b.images && b.images[0] ? b.images[0].image_webp_url : null;
                    const fStatus = b.facility_status || 'Existing';
                    return `
                    <div class="bldg-card">
                        <div class="bldg-card-thumb">
                            ${primaryImg
                                ? `<img src="/${escapeHtml(primaryImg)}" alt="${escapeHtml(b.name)}" onerror="this.style.display='none'">`
                                : `<div style="color:#64748b; font-size:12px;">No Primary Photo</div>`}
                            <div style="position:absolute; top:10px; left:10px; display:flex; gap:6px;">
                                ${b.building_num ? `<span class="mono-code" style="background:rgba(2,6,23,0.85); color:#fff;">#${b.building_num}</span>` : ''}
                                ${renderFacilityStatusBadge(fStatus)}
                            </div>
                            <span class="mono-code" style="position:absolute; bottom:8px; right:8px; background:rgba(2,6,23,0.82);">${b.images.length} .webp</span>
                        </div>
                        <div class="bldg-card-body">
                            <div>
                                <div style="font-weight:700; color:#f8fafc; font-size:14px;">${escapeHtml(b.name)}</div>
                                <div class="help-tip" style="margin-top:2px;">${escapeHtml(CATEGORY_LABELS[b.category] || b.category)} • <span class="mono-id">${escapeHtml(b.building_code)}</span></div>
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                                <span class="mono-code">${b.offices.length === 0 ? 'Standalone (0 Offices)' : `${b.offices.length} Internal Office(s)`}</span>
                                <span class="mono-code" style="color:${b.model_exists ? '#34d399' : '#94a3b8'};">${b.model_exists ? '3D GLB Ready' : 'Procedural Box'}</span>
                                ${!hasBldgGeometry(b) ? `<span class="mono-code" style="color:#fbbf24; border-color:rgba(245,158,11,0.4); background:rgba(245,158,11,0.12); display:inline-flex; align-items:center; gap:4px;">${SVG_ICONS.alertTriangle} <span>Unmapped Draft</span></span>` : ''}
                            </div>
                        </div>
                        <div class="bldg-card-footer">
                            <button type="button" class="btn btn-blue btn-sm" style="flex:1;" onclick="openBuildingModal(${b.id})">${SVG_ICONS.edit} <span>Edit & Photos</span></button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="deleteBuildingRow(${b.id})" title="Delete building">${SVG_ICONS.trash}</button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `;
    } else {
        host.innerHTML = `
            <div class="table-scroll-wrap">
            <table class="crud-table">
                <thead>
                    <tr><th>#</th><th>Photo</th><th>Building & Code</th><th>Category & Visibility</th><th>Offices</th><th>3D Model</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${list.map(b => {
                        const primaryImg = b.images && b.images[0] ? b.images[0].image_webp_url : null;
                        return `
                        <tr>
                            <td><span class="mono-id">${b.building_num ? '#' + b.building_num : '—'}</span></td>
                            <td>${primaryImg ? `<img src="/${escapeHtml(primaryImg)}" style="width:54px; height:38px; object-fit:cover; border-radius:6px;" onerror="this.style.display='none'">` : `<span style="font-size:11px; color:#64748b;">No Photo</span>`}</td>
                            <td>
                                <div style="font-weight:600; color:#f8fafc;">${escapeHtml(b.name)}</div>
                                <span class="mono-code">${escapeHtml(b.building_code)}</span>
                            </td>
                            <td>
                                <span class="status-pill status-pill-blue">${escapeHtml(b.category)}</span>
                                <div style="margin-top:4px;">${renderFacilityStatusBadge(b.facility_status || 'Existing')}</div>
                                ${!hasBldgGeometry(b) ? `<div style="margin-top:4px;"><span class="status-pill" style="background:rgba(245,158,11,0.16); color:#fbbf24; border:1px solid rgba(245,158,11,0.35); font-size:10.5px;">Unmapped Draft (Hidden)</span></div>` : ''}
                            </td>
                            <td><span class="mono-code">${b.offices.length === 0 ? '0 (Standalone)' : `${b.offices.length} Office(s)`}</span></td>
                            <td>${b.model_exists ? `<span style="color:#34d399; font-size:12px; display:inline-flex; align-items:center; gap:4px;">${SVG_ICONS.check} <span>GLB Ready</span></span>` : `<span style="color:#94a3b8; font-size:12px;">Procedural</span>`}</td>
                            <td>
                                <div class="action-cell">
                                    <button class="btn btn-blue btn-sm" onclick="openBuildingModal(${b.id})">${SVG_ICONS.edit} <span>Edit</span></button>
                                    <button class="btn btn-danger btn-sm" onclick="deleteBuildingRow(${b.id})">${SVG_ICONS.trash}</button>
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            </div>
        `;
    }
}

export async function renderBuildingsTab(container) {
    PortalState.cachedBuildings = await apiFetch(`/api/admin/buildings?station=${PortalState.currentStation}`);

    container.innerHTML = `
        ${renderWorkflowBanner('Buildings & Facility Gallery')}

        <div class="panel-card">
            <div class="panel-header">
                <div class="panel-title-group">
                    <div class="panel-title-icon">${SVG_ICONS.building}</div>
                    <div>
                        <h3>Buildings & Multi-Photo Directory (${PortalState.currentStation.toUpperCase()})</h3>
                        <div class="help-tip" id="bldg-filtered-count">Showing all buildings</div>
                    </div>
                </div>
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <div class="view-switch-bar">
                        <button type="button" class="view-switch-btn ${bldgViewMode === 'cards' ? 'active' : ''}" data-bview="cards">Card View</button>
                        <button type="button" class="view-switch-btn ${bldgViewMode === 'table' ? 'active' : ''}" data-bview="table">Table View</button>
                    </div>
                    <button type="button" class="btn btn-emerald" id="btn-add-new-bldg">${SVG_ICONS.plus} <span>Add Building</span></button>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1.5fr 1fr 1fr; gap:10px; margin-bottom:16px;" class="bldg-filter-row">
                <input type="text" id="bldg-search-inp" class="form-control" placeholder="Search by building name, number, or code..." value="${escapeHtml(searchTerm)}">
                <select id="bldg-cat-filter" class="form-control">
                    <option value="">All Directory Categories</option>
                    ${Object.entries(CATEGORY_LABELS).map(([k, lbl]) => `<option value="${k}" ${categoryFilter === k ? 'selected' : ''}>${escapeHtml(lbl)}</option>`).join('')}
                </select>
                <select id="bldg-status-filter" class="form-control">
                    <option value="">All Facility Statuses</option>
                    <option value="Existing" ${statusFilter === 'Existing' ? 'selected' : ''}>Existing (Live Map Default)</option>
                    <option value="Under Construction" ${statusFilter === 'Under Construction' ? 'selected' : ''}>Under Construction</option>
                    <option value="Proposed" ${statusFilter === 'Proposed' ? 'selected' : ''}>Proposed Land-Use</option>
                </select>
            </div>

            <div id="buildings-list-host"></div>
        </div>
    `;

    renderBuildingsCollection();

    container.querySelectorAll('[data-bview]').forEach(btn => {
        btn.addEventListener('click', () => {
            bldgViewMode = btn.dataset.bview;
            setSavedPortalPref('iguide_pref_bldg_view', bldgViewMode);
            container.querySelectorAll('[data-bview]').forEach(b => b.classList.toggle('active', b.dataset.bview === bldgViewMode));
            renderBuildingsCollection();
        });
    });

    document.getElementById('bldg-search-inp')?.addEventListener('input', (e) => {
        searchTerm = e.target.value;
        renderBuildingsCollection();
    });
    document.getElementById('bldg-cat-filter')?.addEventListener('change', (e) => {
        categoryFilter = e.target.value;
        renderBuildingsCollection();
    });
    document.getElementById('bldg-status-filter')?.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        renderBuildingsCollection();
    });
    document.getElementById('btn-add-new-bldg')?.addEventListener('click', () => window.openBuildingModal(null));
}


// =========================================================================
// FREE-FORM IMAGE CROPPER MODAL (HTML5 CANVAS -> WEBP, ZERO EXTERNAL DEPS)
// =========================================================================
function openFreeFormCropperModal(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onerror = () => resolve({ action: 'skip' });
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => resolve({ action: 'skip' });
            img.onload = () => {
                const natW = img.naturalWidth || img.width;
                const natH = img.naturalHeight || img.height;

                const existing = document.getElementById('bldg-cropper-overlay');
                if (existing) existing.remove();

                const overlay = document.createElement('div');
                overlay.id = 'bldg-cropper-overlay';
                overlay.className = 'bldg-cropper-backdrop';
                overlay.innerHTML = `
                    <div class="bldg-cropper-modal">
                        <div class="bldg-cropper-header">
                            <div>
                                <h3 style="margin:0; font-size:15.5px; font-weight:800; color:#f8fafc;">Free-Form Photo Cropper</h3>
                                <div style="font-size:11.5px; color:#94a3b8; margin-top:2px;">Drag corners or edges to crop freely, or drag inside the box to reposition. Converted cleanly to WebP.</div>
                            </div>
                            <button type="button" id="crop-cancel-x" class="overseer-role-modal-x" aria-label="Cancel">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>

                        <div class="bldg-cropper-toolbar">
                            <div style="display:flex; gap:6px; flex-wrap:wrap;" id="crop-ratio-btns">
                                <button type="button" class="btn btn-emerald btn-sm" data-crop-ratio="free">Free-Form</button>
                                <button type="button" class="btn btn-secondary btn-sm" data-crop-ratio="1.7778">16:9 Wide</button>
                                <button type="button" class="btn btn-secondary btn-sm" data-crop-ratio="1.3333">4:3 Standard</button>
                                <button type="button" class="btn btn-secondary btn-sm" data-crop-ratio="1">1:1 Square</button>
                                <button type="button" class="btn btn-secondary btn-sm" id="crop-reset-btn">Reset Full</button>
                            </div>
                            <span class="mono-code" id="crop-dims-pill">${natW} × ${natH} px</span>
                        </div>

                        <div class="bldg-cropper-stage-wrap">
                            <div class="bldg-cropper-stage" id="crop-stage">
                                <img id="crop-source-img" src="${reader.result}" alt="Crop source" draggable="false">
                                <div class="bldg-cropper-box" id="crop-box">
                                    <span class="crop-grid-v v1"></span>
                                    <span class="crop-grid-v v2"></span>
                                    <span class="crop-grid-h h1"></span>
                                    <span class="crop-grid-h h2"></span>
                                    <span class="crop-handle nw" data-h="nw"></span>
                                    <span class="crop-handle n" data-h="n"></span>
                                    <span class="crop-handle ne" data-h="ne"></span>
                                    <span class="crop-handle e" data-h="e"></span>
                                    <span class="crop-handle se" data-h="se"></span>
                                    <span class="crop-handle s" data-h="s"></span>
                                    <span class="crop-handle sw" data-h="sw"></span>
                                    <span class="crop-handle w" data-h="w"></span>
                                </div>
                            </div>
                        </div>

                        <div class="bldg-cropper-footer">
                            <button type="button" class="btn btn-secondary" id="crop-cancel-btn">Cancel</button>
                            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                                <button type="button" class="btn btn-blue" id="crop-skip-btn">Use Full Original</button>
                                <button type="button" class="btn btn-emerald" id="crop-apply-btn">Apply Crop & Upload (WebP)</button>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(overlay);

                const stage = document.getElementById('crop-stage');
                const srcImg = document.getElementById('crop-source-img');
                const box = document.getElementById('crop-box');
                const dimsPill = document.getElementById('crop-dims-pill');

                let crop = { x: 0.05, y: 0.05, w: 0.90, h: 0.90 };
                let lockedRatio = null;

                const renderBox = () => {
                    box.style.left = `${(crop.x * 100).toFixed(3)}%`;
                    box.style.top = `${(crop.y * 100).toFixed(3)}%`;
                    box.style.width = `${(crop.w * 100).toFixed(3)}%`;
                    box.style.height = `${(crop.h * 100).toFixed(3)}%`;
                    const outW = Math.max(1, Math.round(crop.w * natW));
                    const outH = Math.max(1, Math.round(crop.h * natH));
                    if (dimsPill) dimsPill.textContent = `${outW} × ${outH} px`;
                };
                renderBox();

                let dragMode = null;
                let startClientX = 0, startClientY = 0;
                let startCrop = null;
                let stageRect = null;

                const onPointerDown = (e) => {
                    const h = e.target.closest('.crop-handle');
                    if (h) {
                        dragMode = h.dataset.h;
                    } else if (e.target.closest('#crop-box')) {
                        dragMode = 'move';
                    } else {
                        return;
                    }
                    e.preventDefault();
                    stageRect = srcImg.getBoundingClientRect();
                    startClientX = e.clientX;
                    startClientY = e.clientY;
                    startCrop = { ...crop };
                    window.addEventListener('pointermove', onPointerMove);
                    window.addEventListener('pointerup', onPointerUp);
                };

                const onPointerMove = (e) => {
                    if (!dragMode || !stageRect || stageRect.width < 10 || stageRect.height < 10) return;
                    const dx = (e.clientX - startClientX) / stageRect.width;
                    const dy = (e.clientY - startClientY) / stageRect.height;
                    const minSize = 0.08;

                    if (dragMode === 'move') {
                        crop.x = Math.max(0, Math.min(1 - startCrop.w, startCrop.x + dx));
                        crop.y = Math.max(0, Math.min(1 - startCrop.h, startCrop.y + dy));
                    } else {
                        let x1 = startCrop.x;
                        let y1 = startCrop.y;
                        let x2 = startCrop.x + startCrop.w;
                        let y2 = startCrop.y + startCrop.h;

                        if (dragMode.includes('w')) x1 = Math.max(0, Math.min(x2 - minSize, startCrop.x + dx));
                        if (dragMode.includes('e')) x2 = Math.min(1, Math.max(x1 + minSize, startCrop.x + startCrop.w + dx));
                        if (dragMode.includes('n')) y1 = Math.max(0, Math.min(y2 - minSize, startCrop.y + dy));
                        if (dragMode.includes('s')) y2 = Math.min(1, Math.max(y1 + minSize, startCrop.y + startCrop.h + dy));

                        let nw = x2 - x1;
                        let nh = y2 - y1;
                        if (lockedRatio) {
                            const imgAspect = natW / natH;
                            const targetNormH = (nw * imgAspect) / lockedRatio;
                            if (y1 + targetNormH <= 1) {
                                nh = Math.max(minSize, targetNormH);
                            } else {
                                nh = 1 - y1;
                                nw = (nh * lockedRatio) / imgAspect;
                            }
                        }
                        crop = { x: x1, y: y1, w: Math.min(1 - x1, nw), h: Math.min(1 - y1, nh) };
                    }
                    renderBox();
                };

                const onPointerUp = () => {
                    dragMode = null;
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                };

                stage.addEventListener('pointerdown', onPointerDown);

                document.querySelectorAll('#crop-ratio-btns [data-crop-ratio]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const val = btn.dataset.cropRatio;
                        document.querySelectorAll('#crop-ratio-btns [data-crop-ratio]').forEach(b => {
                            b.className = b === btn ? 'btn btn-emerald btn-sm' : 'btn btn-secondary btn-sm';
                        });
                        if (val === 'free') {
                            lockedRatio = null;
                        } else {
                            lockedRatio = Number(val);
                            const imgAspect = natW / natH;
                            let nw = 0.86;
                            let nh = (nw * imgAspect) / lockedRatio;
                            if (nh > 0.86) {
                                nh = 0.86;
                                nw = (nh * lockedRatio) / imgAspect;
                            }
                            crop = { x: (1 - nw) / 2, y: (1 - nh) / 2, w: nw, h: nh };
                            renderBox();
                        }
                    });
                });

                document.getElementById('crop-reset-btn')?.addEventListener('click', () => {
                    lockedRatio = null;
                    crop = { x: 0, y: 0, w: 1, h: 1 };
                    document.querySelectorAll('#crop-ratio-btns [data-crop-ratio]').forEach(b => {
                        b.className = b.dataset.cropRatio === 'free' ? 'btn btn-emerald btn-sm' : 'btn btn-secondary btn-sm';
                    });
                    renderBox();
                });

                const finish = (result) => {
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    overlay.remove();
                    resolve(result);
                };

                document.getElementById('crop-cancel-btn')?.addEventListener('click', () => finish({ action: 'cancel' }));
                document.getElementById('crop-cancel-x')?.addEventListener('click', () => finish({ action: 'cancel' }));
                document.getElementById('crop-skip-btn')?.addEventListener('click', () => finish({ action: 'skip' }));
                document.getElementById('crop-apply-btn')?.addEventListener('click', () => {
                    try {
                        const sx = Math.round(crop.x * natW);
                        const sy = Math.round(crop.y * natH);
                        const sw = Math.max(16, Math.round(crop.w * natW));
                        const sh = Math.max(16, Math.round(crop.h * natH));
                        const maxSide = 1440;
                        const scale = Math.min(1, maxSide / Math.max(sw, sh));
                        const outW = Math.max(1, Math.round(sw * scale));
                        const outH = Math.max(1, Math.round(sh * scale));

                        const canvas = document.createElement('canvas');
                        canvas.width = outW;
                        canvas.height = outH;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
                        const dataUrl = canvas.toDataURL('image/webp', 0.84);
                        finish({ action: 'cropped', dataUrl });
                    } catch (err) {
                        finish({ action: 'skip' });
                    }
                });
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

// =========================================================================
// VISITOR FULLSCREEN LIGHTBOX PREVIEW (TEST HOW VISITORS CLICK & ZOOM)
// =========================================================================
window.openEditorVisitorLightbox = (startIdx = 0) => {
    if (!workingPhotos.length) return;
    let curIdx = Math.max(0, Math.min(workingPhotos.length - 1, Number(startIdx) || 0));

    const existing = document.getElementById('bldg-visitor-lightbox');
    if (existing) existing.remove();

    const lb = document.createElement('div');
    lb.id = 'bldg-visitor-lightbox';
    lb.className = 'bldg-cropper-backdrop';
    lb.style.zIndex = '99999';

    const renderLb = () => {
        const ph = workingPhotos[curIdx];
        if (!ph) return;
        const isLight = document.body.dataset.theme === 'light';
        const lbBg = isLight ? '#ffffff' : '#07111a';
        const lbHeaderBg = isLight ? '#f8fafc' : 'rgba(9,16,28,0.92)';
        const lbTitleColor = isLight ? '#0f172a' : '#f8fafc';
        lb.innerHTML = `
            <div style="position:relative; width:100%; max-width:920px; background:${lbBg}; border:1px solid rgba(52,211,153,0.35); border-radius:16px; overflow:hidden; box-shadow:0 28px 70px rgba(0,0,0,${isLight ? '0.25' : '0.85'});">
                <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(148,163,184,0.16); background:${lbHeaderBg};">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="status-pill status-pill-live" style="font-size:10px;">Visitor Click View</span>
                        <strong style="color:${lbTitleColor}; font-size:13.5px;">${escapeHtml(ph.caption || 'Facility View')}</strong>
                        <span class="mono-code">${curIdx + 1} / ${workingPhotos.length}</span>
                    </div>
                    <button type="button" id="vlb-close-btn" class="overseer-role-modal-x" aria-label="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>
                <div style="position:relative; background:#020617; display:flex; align-items:center; justify-content:center; min-height:360px; max-height:72vh;">
                    <img src="${escapeHtml(getPhotoPreviewSrc(ph))}" alt="${escapeHtml(ph.caption || '')}" style="max-width:100%; max-height:72vh; object-fit:contain; display:block;">
                    ${workingPhotos.length > 1 ? `
                        <button type="button" class="bldg-slide-nav prev" id="vlb-prev" style="left:14px;">‹</button>
                        <button type="button" class="bldg-slide-nav next" id="vlb-next" style="right:14px;">›</button>
                    ` : ''}
                </div>
            </div>
        `;
        document.getElementById('vlb-close-btn')?.addEventListener('click', () => lb.remove());
        document.getElementById('vlb-prev')?.addEventListener('click', () => { curIdx = (curIdx - 1 + workingPhotos.length) % workingPhotos.length; renderLb(); });
        document.getElementById('vlb-next')?.addEventListener('click', () => { curIdx = (curIdx + 1) % workingPhotos.length; renderLb(); });
    };

    lb.addEventListener('click', (e) => { if (e.target === lb) lb.remove(); });
    document.body.appendChild(lb);
    renderLb();
};

window.swapBuildingPhoto = (idx, delta) => {
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || idx >= workingPhotos.length || targetIdx >= workingPhotos.length) return;
    const tmp = workingPhotos[idx];
    workingPhotos[idx] = workingPhotos[targetIdx];
    workingPhotos[targetIdx] = tmp;
    workingPhotos.forEach((p, i) => { p.is_primary = i === 0 ? 1 : 0; p.display_order = i; });
    activeSlideIdx = targetIdx;
    visitorPreviewIdx = targetIdx;
    renderHeroGallerySection();
    updateResultButtonBadge();
    showToast(`Swapped photo order — now #${targetIdx + 1} of ${workingPhotos.length}${targetIdx === 0 ? ' (1st Cover)' : ''}. Click Submit/Save to apply.`);
};

window.setBuildingGalleryMode = (mode) => {
    activeGalleryMode = (mode === 'carousel') ? 'carousel' : 'slider';
    renderHeroGallerySection();
    updateResultButtonBadge();
    showToast(`Visitor photo display set to ${activeGalleryMode === 'carousel' ? 'Carousel' : 'Slider'} mode.`);
};

window.stepVisitorPreview = (delta) => {
    if (workingPhotos.length <= 1) return;
    activeSlideIdx = (activeSlideIdx + delta + workingPhotos.length) % workingPhotos.length;
    visitorPreviewIdx = activeSlideIdx;
    renderHeroGallerySection();
};

window.selectVisitorPreview = (idx) => {
    if (idx >= 0 && idx < workingPhotos.length) {
        activeSlideIdx = idx;
        visitorPreviewIdx = idx;
        renderHeroGallerySection();
    }
};

async function handleMultiPhotoFiles(fileList) {
    const files = Array.from(fileList || []).filter(f => f && String(f.type || '').startsWith('image/'));
    if (files.length === 0) {
        showToast('Please select valid image files (.webp, .jpg, or .png).');
        return;
    }

    const firstNewIdx = workingPhotos.length;
    let uploadedCount = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const cropRes = await openFreeFormCropperModal(file);
            if (!cropRes || cropRes.action === 'cancel') continue;
            const webpDataUrl = (cropRes.action === 'cropped' && cropRes.dataUrl)
                ? cropRes.dataUrl
                : await fileToWebpDataUrl(file, 1440, 0.84);
            const rawStem = String(file.name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
            const defaultCaption = rawStem ? rawStem.slice(0, 48) : (workingPhotos.length === 0 ? 'Front Facade' : `Facility View ${workingPhotos.length + 1}`);
            // Strictly append after existing photos: 1st photo stays primary, newly uploaded becomes 2nd (or next)
            const makePrimary = workingPhotos.length === 0 ? 1 : 0;
            const nextOrder = workingPhotos.length;

            // Upload cropped .webp to disk WITHOUT creating a separate Change Request.
            // All photo changes are bundled together when the editor submits the building!
            const up = await apiFetch('/api/admin/upload-webp', {
                method: 'POST',
                body: JSON.stringify({
                    station_id: PortalState.currentStation,
                    filename: file.name,
                    base64_data: webpDataUrl
                })
            });

            workingPhotos.push({
                id: null,
                clientKey: `ph_${Date.now()}_${i}`,
                image_webp_url: up.image_webp_url || '',
                caption: defaultCaption,
                display_order: nextOrder,
                is_primary: makePrimary,
                pendingReview: false,
                localDataUrl: webpDataUrl,
                localFilename: file.name,
                isNewLocal: true
            });
            uploadedCount += 1;
        } catch (err) {
            showToast(`Could not process ${file.name}: ${err.message}`);
        }
    }

    if (uploadedCount > 0) {
        activeSlideIdx = Math.min(firstNewIdx, Math.max(0, workingPhotos.length - 1));
        visitorPreviewIdx = activeSlideIdx;
        renderHeroGallerySection();
        updateResultButtonBadge();
        showToast(`${uploadedCount} WebP photo(s) staged! Click Submit / Save below to include with your building update.`);
    }
}

function renderHeroGallerySection() {
    const host = document.getElementById('bldg-hero-gallery-host');
    if (!host) return;

    if (activeSlideIdx >= workingPhotos.length) {
        activeSlideIdx = Math.max(0, workingPhotos.length - 1);
    }
    const activePhoto = workingPhotos[activeSlideIdx] || null;
    const total = workingPhotos.length;
    const showArrows = total > 1;
    const activeSrc = getPhotoPreviewSrc(activePhoto);

    host.innerHTML = `
        <div class="bldg-hero-section">
            <div class="bldg-hero-stage" id="bldg-hero-stage">
                <input type="file" id="new-photo-file" accept="image/*" multiple style="display:none;">
                <div class="bldg-hero-top-bar">
                    <div class="bldg-hero-badges-left">
                        <span class="bldg-slide-pill" id="bldg-hero-counter">${total > 0 ? `Photo ${activeSlideIdx + 1} / ${total}` : 'No Photos Yet'}</span>
                        ${activePhoto && Number(activePhoto.is_primary) ? `<span class="bldg-slide-pill primary">${SVG_ICONS.star} <span>Primary Cover</span></span>` : ''}
                        ${activePhoto && activePhoto.isNewLocal ? `<span class="bldg-slide-pill pending">Staged for Submission</span>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${total > 0 ? `
                            <div class="cr-preview-mode-tabs" style="background:rgba(2,6,23,0.78); border:1px solid rgba(255,255,255,0.16); padding:2px; border-radius:9px;">
                                <button type="button" class="cr-preview-mode-btn ${activeGalleryMode === 'slider' ? 'active' : ''}" onclick="setBuildingGalleryMode('slider')" style="padding:3px 9px; font-size:11px;">Slider</button>
                                <button type="button" class="cr-preview-mode-btn ${activeGalleryMode === 'carousel' ? 'active' : ''}" onclick="setBuildingGalleryMode('carousel')" style="padding:3px 9px; font-size:11px;">Carousel</button>
                            </div>
                        ` : ''}
                        <button type="button" class="bldg-hero-upload-btn" id="btn-trigger-multi-upload">
                            ${SVG_ICONS.upload}
                            <span>+ Upload Photos</span>
                        </button>
                    </div>
                </div>

                ${activePhoto ? (
                    activeGalleryMode === 'carousel' ? `
                        <div class="bldg-vp-carousel-track" style="height:100%; padding:52px 14px 14px; align-items:center; background:rgba(2,6,23,0.55);">
                            ${workingPhotos.map((ph, i) => `
                                <div class="bldg-vp-carousel-slide ${i === activeSlideIdx ? 'active' : ''}" onclick="selectEditorSlide(${i}); openEditorVisitorLightbox(${i})" title="Click to enlarge (Visitor View)" style="height:100%;">
                                    <img src="${escapeHtml(getPhotoPreviewSrc(ph))}" alt="${escapeHtml(ph.caption || '')}">
                                    <span class="bldg-vp-slide-badge">#${i + 1} ${escapeHtml(ph.caption || 'View')}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <img src="${escapeHtml(activeSrc)}" alt="${escapeHtml(activePhoto.caption || 'Building Photo')}" class="bldg-hero-img" id="bldg-hero-active-img" onclick="openEditorVisitorLightbox(${activeSlideIdx})" title="Click to preview fullscreen visitor zoom" style="cursor:zoom-in;">
                        <div class="bldg-hero-vignette" style="pointer-events:none;"></div>
                        ${showArrows ? `
                            <button type="button" class="bldg-slide-nav prev" id="bldg-slide-prev" aria-label="Previous photo" onclick="stepEditorSlide(-1)">‹</button>
                            <button type="button" class="bldg-slide-nav next" id="bldg-slide-next" aria-label="Next photo" onclick="stepEditorSlide(1)">›</button>
                        ` : ''}
                        <div class="bldg-hero-caption-bar" style="pointer-events:none;">
                            <span class="bldg-hero-caption-text">${escapeHtml(activePhoto.caption || 'Facility View')}</span>
                            <span class="bldg-hero-file-name">Click photo to zoom • ${escapeHtml(activePhoto.image_webp_url || activePhoto.localFilename || 'WebP')}</span>
                        </div>
                    `
                ) : `
                    <div class="bldg-hero-empty" id="bldg-hero-empty-trigger">
                        <div class="bldg-hero-empty-icon">${SVG_ICONS.image}</div>
                        <div style="font-weight:700; color:#f8fafc; font-size:14px;">Upload Multi-Photo Facility Slideshow</div>
                        <div class="help-tip" style="max-width:360px;">Click <strong>+ Upload Photos</strong> or drag & drop images here (.webp / .jpg / .png). You can free-form crop each photo and arrange them in Slider or Carousel mode.</div>
                    </div>
                `}
            </div>

            ${total > 0 ? `
                <div class="bldg-thumb-strip" id="bldg-thumb-strip">
                    ${workingPhotos.map((ph, idx) => `
                        <button type="button" class="bldg-thumb-item ${idx === activeSlideIdx ? 'active' : ''}" onclick="selectEditorSlide(${idx})" title="Photo #${idx + 1}: ${escapeHtml(ph.caption || `Photo ${idx + 1}`)}">
                            <img src="${escapeHtml(getPhotoPreviewSrc(ph))}" alt="${escapeHtml(ph.caption || '')}">
                            <span class="bldg-thumb-order-badge">${idx === 0 ? '#1' : '#' + (idx + 1)}</span>
                        </button>
                    `).join('')}
                    <button type="button" class="bldg-thumb-add" id="btn-thumb-add-photos" title="Upload & free-form crop another photo">+ Add</button>
                </div>

                <div class="bldg-slide-controls">
                    <input type="text" class="form-control" id="bldg-active-caption" value="${escapeHtml(activePhoto.caption || 'Facility View')}" placeholder="Photo view label (e.g. Front Entrance, Side Courtyard)" style="flex:1; min-width:160px; height:32px; font-size:12px;">
                    <button type="button" class="btn btn-secondary btn-sm" onclick="updatePhotoCaption(${activeSlideIdx})">Save Caption</button>
                    ${total > 1 ? `
                        <button type="button" class="btn btn-secondary btn-sm" onclick="swapBuildingPhoto(${activeSlideIdx}, -1)" ${activeSlideIdx === 0 ? 'disabled' : ''} title="Swap with previous photo">← Swap Left</button>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="swapBuildingPhoto(${activeSlideIdx}, 1)" ${activeSlideIdx >= total - 1 ? 'disabled' : ''} title="Swap with next photo">Swap Right →</button>
                    ` : ''}
                    ${activeSlideIdx > 0 ? `<button type="button" class="btn btn-blue btn-sm" onclick="swapBuildingPhoto(${activeSlideIdx}, -${activeSlideIdx})">Make 1st (Cover)</button>` : ''}
                    <button type="button" class="btn btn-danger btn-sm" onclick="deleteBuildingPhoto(${activeSlideIdx})">Remove</button>
                </div>
            ` : ''}
        </div>
    `;

    const fileInput = document.getElementById('new-photo-file');
    document.getElementById('btn-trigger-multi-upload')?.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput?.click();
    });
    document.getElementById('bldg-hero-empty-trigger')?.addEventListener('click', () => fileInput?.click());
    document.getElementById('btn-thumb-add-photos')?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleMultiPhotoFiles(e.target.files);
            e.target.value = '';
        }
    });

    const stage = document.getElementById('bldg-hero-stage');
    if (stage) {
        stage.addEventListener('dragover', (e) => {
            e.preventDefault();
            stage.classList.add('dragover');
        });
        stage.addEventListener('dragleave', () => stage.classList.remove('dragover'));
        stage.addEventListener('drop', (e) => {
            e.preventDefault();
            stage.classList.remove('dragover');
            if (e.dataTransfer?.files?.length) {
                handleMultiPhotoFiles(e.dataTransfer.files);
            }
        });
    }
    heroStageDropBound = true;
}

window.stepEditorSlide = (delta) => {
    if (workingPhotos.length <= 1) return;
    activeSlideIdx = (activeSlideIdx + delta + workingPhotos.length) % workingPhotos.length;
    renderHeroGallerySection();
};

window.selectEditorSlide = (idx) => {
    if (idx < 0 || idx >= workingPhotos.length) return;
    activeSlideIdx = idx;
    renderHeroGallerySection();
};

window.openBuildingModal = async (bldgId) => {
    const cur = bldgId ? PortalState.cachedBuildings.find(b => b.id === bldgId) : {
        id: null, station_id: PortalState.currentStation, building_code: '', building_num: '', name: '',
        category: 'infrastructure', facility_status: 'Existing', type_label: 'Infrastructure Facility', icon: 'building',
        pin_color: '#10b981', roof_color: '#334155', description: '', visual_landmark: '', key_services: '',
        model_glb_url: '', height: 5.0, images: []
    };
    PortalState.editingBuilding = cur;
    const models = await getAvailableModels();
    const curStatus = cur.facility_status || 'Existing';
    const curIcon = cur.icon || 'building';
    const curColor = normalizeHexColor(cur.pin_color || '#10b981');
    const hasGeo = hasBldgGeometry(cur);
    const drawLink = `/draw.html?station=${encodeURIComponent(PortalState.currentStation)}${cur.building_code ? `&bldg=${encodeURIComponent(cur.building_code)}` : ''}`;

    const cleanModelVal = String(cur.model_glb_url || '').split('?')[0].trim().replace(/^\/+/, '');
    const matchedDiskModel = models.some(m => m.url === cleanModelVal);

    // Initialize clean snapshot & working gallery for diffing & non-destructive photo edits
    originalBuildingSnapshot = {
        building_num: String(cur.building_num ?? '').trim(),
        building_code: String(cur.building_code || '').trim(),
        category: String(cur.category || 'infrastructure'),
        facility_status: String(curStatus),
        name: String(cur.name || '').trim(),
        type_label: String(cur.type_label || '').trim(),
        description: String(cur.description || '').trim(),
        visual_landmark: String(cur.visual_landmark || '').trim(),
        key_services: String(cur.key_services || '').trim(),
        model_glb_url: matchedDiskModel ? cleanModelVal : String(cur.model_glb_url || '').trim(),
        model_rotation: String(cur.model_rotation ?? '').trim(),
        model_scale: String(cur.model_scale ?? '').trim(),
        pin_color: curColor,
        icon: String(curIcon),
        images: (cur.images || []).map(im => ({ ...im }))
    };
    workingPhotos = (cur.images || []).map((im, idx) => ({
        id: im.id,
        clientKey: `db_${im.id || idx}`,
        image_webp_url: im.image_webp_url,
        caption: im.caption || 'Facility View',
        is_primary: Number(im.is_primary) ? 1 : 0,
        pendingReview: false,
        localDataUrl: null,
        localFilename: '',
        isNewLocal: false
    }));
    removedPhotos = [];
    activeSlideIdx = 0;
    previewSlideIdx = 0;

    document.getElementById('bldg-modal-title').textContent = cur.id
        ? `Edit Building: ${cur.name} (${cur.building_code})`
        : `Add New Building — DA-${PortalState.currentStation.toUpperCase()}`;

    const renderModelStatusPill = (val) => {
        const cleanVal = String(val || '').split('?')[0].trim().replace(/^\/+/, '');
        if (!cleanVal) return `<span class="status-pill status-pill-blue">Procedural 3D Extruded Box</span>`;
        const found = models.find(m => m.url === cleanVal);
        if (found) return `<span class="status-pill status-pill-live"><span class="status-dot-live"></span><span>Verified on Disk (${found.sizeKb} KB)</span></span>`;
        return `<span class="status-pill status-pill-rose">${SVG_ICONS.alertTriangle} <span>Model file not found in /models</span></span>`;
    };

    document.getElementById('bldg-modal-body').innerHTML = `
        <!-- 1. TOP-MOST HERO MULTI-PHOTO SLIDESHOW (Mirrors Live Map Drawer Top Banner) -->
        <div id="bldg-hero-gallery-host"></div>

        <!-- 2. MAP HEADER & DIRECTORY IDENTITY -->
        <div class="bldg-editor-section">
            <div class="bldg-section-heading">
                <span>1. Map Drawer Header & Directory Identity</span>
                <span class="help-tip" style="margin-top:0;">Shown at the top of the campus map card & sidebar search</span>
            </div>
            <div class="form-grid-3">
                <div class="form-group">
                    <label>Official Building Name *</label>
                    <input type="text" id="bm-name" class="form-control" value="${escapeHtml(cur.name || '')}" placeholder="e.g. Tanco Hall Building">
                    <div class="help-tip">Main bold heading visitors click on the map.</div>
                </div>
                <div class="form-group">
                    <label>Subtitle / Facility Type</label>
                    <input type="text" id="bm-type" class="form-control" value="${escapeHtml(cur.type_label || '')}" placeholder="e.g. Conference Hall">
                    <div class="help-tip">Short label under the building name.</div>
                </div>
                <div class="form-group">
                    <label>Public Map Status</label>
                    <select id="bm-fstatus" class="form-control">
                        ${['Existing', 'Under Construction', 'Proposed'].map(s => `<option value="${s}" ${curStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <div class="help-tip" id="bm-fstatus-help">${escapeHtml((FACILITY_STATUS_META[curStatus] || FACILITY_STATUS_META.Existing).help)}</div>
                </div>
            </div>

            <div class="form-grid-3">
                <div class="form-group" style="margin-bottom:0;">
                    <label>Building Number (#)</label>
                    <input type="number" id="bm-num" class="form-control" style="font-family:var(--font-mono);" value="${cur.building_num ?? ''}" placeholder="Blank for utilities">
                    <div class="help-tip">Number inside the floating 3D map pin circle.</div>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>Unique Code</label>
                    <input type="text" id="bm-code" class="form-control" style="font-family:var(--font-mono);" value="${escapeHtml(cur.building_code || '')}" ${cur.id ? 'readonly' : ''} placeholder="e.g. tanco_hall_building">
                    <div class="help-tip">${cur.id ? 'Locked ID linking 3D model, roads & QR.' : 'Auto-generated if left blank.'}</div>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>Directory Category</label>
                    <select id="bm-category" class="form-control">
                        ${Object.entries(CATEGORY_LABELS).map(([k, lbl]) => `<option value="${k}" ${cur.category === k ? 'selected' : ''}>${escapeHtml(lbl)}</option>`).join('')}
                    </select>
                    <div class="help-tip">Controls the campus filter dropdown group.</div>
                </div>
            </div>
        </div>

        <!-- 3. VISITOR WAYFINDING CARDS (Exact Blue/Green Cards in Map Drawer) -->
        <div class="bldg-editor-section">
            <div class="bldg-section-heading">
                <span>2. Map Drawer Info Cards ("How to Spot It" & Services)</span>
                <span class="help-tip" style="margin-top:0;">Direct preview matches the map drawer blocks below the photo</span>
            </div>
            <div class="form-grid-2">
                <div class="form-group bm-wayfinding-visual">
                    <label style="color:#7dd3fc;">How to Spot It (Visual Landmark)</label>
                    <textarea id="bm-landmark" class="form-control" rows="3" placeholder="e.g. Green hip-roof booth beside the main security gate...">${escapeHtml(cur.visual_landmark || '')}</textarea>
                    <div class="help-tip">Displayed inside the <strong>blue card</strong> so visitors recognize the building by sight.</div>
                </div>
                <div class="form-group bm-wayfinding-services">
                    <label style="color:#86efac;">What's Inside & Key Services</label>
                    <textarea id="bm-services" class="form-control" rows="3" placeholder="e.g. Visitor identification, pass issuance, and gate access control...">${escapeHtml(cur.key_services || '')}</textarea>
                    <div class="help-tip">Displayed inside the <strong>green card</strong> summarizing what services are offered.</div>
                </div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>Directory Summary Line</label>
                <textarea id="bm-desc" class="form-control" rows="2" placeholder="One-line summary shown in the sidebar search list & directory cards">${escapeHtml(cur.description || '')}</textarea>
                <div class="help-tip">Concise 1-line summary shown in the left-side directory list & search results.</div>
            </div>
        </div>

        <!-- 4. INTERACTIVE COLOR WHEEL & FALLBACK UTILITY ICON PICKER -->
        <div class="bldg-editor-section">
            <div class="bldg-section-heading">
                <span>3. Map Pin Badge Color</span>
                <span class="help-tip" id="bm-pin-section-sub" style="margin-top:0;">${cur.building_num
                    ? `Numbered Building (#${escapeHtml(cur.building_num)}): The 3D map pin & directory badge automatically display #${escapeHtml(cur.building_num)}`
                    : 'Unnumbered Utility Facility: Choose the badge color and fallback icon shown on the map'}</span>
            </div>
            <div class="form-grid-2" id="bm-color-icon-grid" style="align-items:start; ${cur.building_num ? 'grid-template-columns:1fr;' : ''}">
                <div class="form-group" style="margin-bottom:0;">
                    <label>Marker Pin Color Wheel & Brightness</label>
                    <div class="color-wheel-box">
                        <div class="color-wheel-canvas-wrap" title="Click or drag anywhere on the wheel to pick a color">
                            <canvas id="bm-color-wheel-canvas" width="132" height="132"></canvas>
                            <div class="color-wheel-cursor" id="bm-color-cursor"></div>
                        </div>
                        <div class="color-wheel-controls">
                            <div class="color-lightness-row">
                                <div style="display:flex; justify-content:space-between; font-size:11px; color:#94a3b8;">
                                    <span>Brightness / Shade</span>
                                    <span id="bm-color-lightness-val" style="font-family:var(--font-mono); color:#f8fafc;">50%</span>
                                </div>
                                <input type="range" id="bm-color-lightness" class="color-lightness-slider" min="8" max="92" value="50" aria-label="Color Brightness">
                            </div>

                            <div class="pin-live-preview" id="bm-pin-preview">
                                <div class="pin-live-circle" id="bm-pin-preview-circle">1</div>
                                <div style="min-width:0; flex:1;">
                                    <div id="bm-pin-preview-name" style="font-size:12px; font-weight:700; color:#f8fafc; line-height:1.25;">Pin Preview</div>
                                    <div id="bm-pin-preview-hex" style="font-family:var(--font-mono); font-size:10.5px; color:#94a3b8;">${escapeHtml(curColor.toUpperCase())}</div>
                                </div>
                                <input type="color" id="bm-color-picker" value="${escapeHtml(curColor)}" title="Open native OS color picker" style="width:34px; height:30px; border:1px solid rgba(255,255,255,0.2); border-radius:7px; background:transparent; cursor:pointer; flex-shrink:0;">
                            </div>

                            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                                <input type="text" id="bm-color" class="form-control" style="width:115px; font-family:var(--font-mono); height:34px; font-size:12.5px;" value="${escapeHtml(curColor)}" aria-label="Hex Color Code">
                                <div class="color-presets-row" id="bm-color-swatches" style="margin-top:0;">
                                    ${PIN_COLOR_PRESETS.map(p => `<button type="button" class="color-swatch-btn ${curColor === p.hex.toLowerCase() ? 'active' : ''}" data-hex="${p.hex}" title="${p.name}" style="background:${p.hex};"></button>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="form-group" id="bm-icon-group" style="margin-bottom:0; ${cur.building_num ? 'display:none;' : ''}">
                    <label>Fallback Pin Icon (Unnumbered Utility Only)</label>
                    <div class="help-tip" style="margin-top:0; margin-bottom:6px;">Only used when Building Number (#) is blank.</div>
                    <input type="hidden" id="bm-icon" value="${escapeHtml(curIcon)}">
                    <div class="icon-gallery-grid" id="bm-icon-gallery">
                        ${ICON_GALLERY.map(ic => `
                            <button type="button" class="icon-tile ${curIcon === ic.id ? 'active' : ''}" data-icon-id="${ic.id}">
                                ${SVG_ICONS[ic.svgKey] || SVG_ICONS.building}
                                <span>${ic.label}</span>
                            </button>`).join('')}
                    </div>
                </div>
            </div>
        </div>

        <!-- 5. 3D ARCHITECTURAL MODEL & SPATIAL FOOTPRINT -->
        <div class="bldg-editor-section" style="margin-bottom:0;">
            <div class="bldg-section-heading">
                <span>4. Spatial Footprint & 3D Architectural Model</span>
                <span class="help-tip" style="margin-top:0;">Footprint geometry & GLB placement on campus</span>
            </div>

            <div class="alert-revision-card" style="margin-bottom:12px; background:${hasGeo ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.10)'}; border-color:${hasGeo ? 'rgba(16,185,129,0.28)' : 'rgba(245,158,11,0.38)'}; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                <div>
                    <strong style="color:${hasGeo ? '#34d399' : '#fbbf24'}; font-size:12.5px; display:inline-flex; align-items:center; gap:6px;">
                        ${hasGeo ? `${SVG_ICONS.check} <span>Footprint & Coordinates Mapped — Ready to Publish Live</span>` : `${SVG_ICONS.alertTriangle} <span>Unmapped Record — Missing Polygon / Coordinates</span>`}
                    </strong>
                    <div class="help-tip" style="margin-top:3px; color:#cbd5e1;">
                        ${hasGeo
                            ? 'This building has verified spatial geometry and can be published safely to the public 3D map.'
                            : 'Save & Publish Live is locked until a footprint is drawn in draw.html so unmapped records cannot spawn fallback boxes.'}
                    </div>
                </div>
                <a href="${drawLink}" target="_blank" class="btn btn-blue btn-sm">${hasGeo ? 'Edit Footprint in draw.html →' : 'Draw Footprint in draw.html →'}</a>
            </div>

            <div class="form-group">
                <label>3D Architectural Model (.glb) & File Check</label>
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <select id="bm-model" class="form-control" style="flex:1; font-family:var(--font-mono);">
                        <option value="">— None (Use Procedural 3D Box) —</option>
                        ${cleanModelVal && !models.some(m => m.url === cleanModelVal)
                            ? `<option value="${escapeHtml(cur.model_glb_url)}" selected>${escapeHtml(cur.model_glb_url)} (Missing on disk)</option>` : ''}
                        ${models.map(m => `<option value="${escapeHtml(m.url)}" ${cleanModelVal === m.url ? 'selected' : ''}>${escapeHtml(m.filename)} (${m.sizeKb} KB)</option>`).join('')}
                    </select>
                    <span id="bm-model-status-pill">${renderModelStatusPill(cur.model_glb_url)}</span>
                </div>
            </div>
            <div class="form-grid-2">
                <div class="form-group" style="margin-bottom:0;">
                    <label>3D Bearing Rotation (°)</label>
                    <input type="number" step="0.1" id="bm-model-rot" class="form-control" style="font-family:var(--font-mono);" value="${escapeHtml(cur.model_rotation ?? '')}" placeholder="Blank = use calibrated default">
                    <div class="help-tip">Optional 0–360° compass bearing when spawning new DB <code>.glb</code> models.</div>
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>3D Model Scale</label>
                    <input type="text" id="bm-model-scale" class="form-control" style="font-family:var(--font-mono);" value="${escapeHtml(cur.model_scale ?? '')}" placeholder="e.g. 1 or [1,1,1]">
                    <div class="help-tip">Uniform factor (e.g. <code>1</code>) or axis array <code>[1,1,1]</code>.</div>
                </div>
            </div>
        </div>
    `;

    // Render top slideshow gallery right away
    renderHeroGallerySection();

    // Wire dynamic form listeners + live change badge counter
    const liveTrackIds = ['bm-num', 'bm-code', 'bm-category', 'bm-fstatus', 'bm-name', 'bm-type', 'bm-desc', 'bm-landmark', 'bm-services', 'bm-model', 'bm-model-rot', 'bm-model-scale'];
    liveTrackIds.forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener('input', updateResultButtonBadge);
        el?.addEventListener('change', updateResultButtonBadge);
    });

    document.getElementById('bm-fstatus')?.addEventListener('change', (e) => {
        const tip = document.getElementById('bm-fstatus-help');
        if (tip) tip.textContent = (FACILITY_STATUS_META[e.target.value] || FACILITY_STATUS_META.Existing).help;
    });

    document.getElementById('bm-model')?.addEventListener('change', (e) => {
        const pill = document.getElementById('bm-model-status-pill');
        if (pill) pill.innerHTML = renderModelStatusPill(e.target.value);
    });

    const colorPicker = document.getElementById('bm-color-picker');
    const colorText = document.getElementById('bm-color');
    const syncColorAll = (hex, fromWheel = false) => {
        const norm = normalizeHexColor(hex);
        if (colorPicker) colorPicker.value = norm;
        if (colorText) colorText.value = norm;
        document.querySelectorAll('#bm-color-swatches .color-swatch-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.hex.toLowerCase() === norm);
        });
        if (!fromWheel && activeColorWheelController) {
            activeColorWheelController.setHex(norm);
        }
        updateResultButtonBadge();
    };

    activeColorWheelController = initInteractiveColorWheel(curColor, (pickedHex) => {
        syncColorAll(pickedHex, true);
    });
    colorPicker?.addEventListener('input', (e) => syncColorAll(e.target.value));
    colorText?.addEventListener('input', (e) => {
        if (/^#[0-9a-f]{6}$/i.test(e.target.value.trim())) syncColorAll(e.target.value);
    });
    document.querySelectorAll('#bm-color-swatches .color-swatch-btn').forEach(btn => {
        btn.addEventListener('click', () => syncColorAll(btn.dataset.hex));
    });

    document.querySelectorAll('#bm-icon-gallery .icon-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            document.getElementById('bm-icon').value = tile.dataset.iconId;
            document.querySelectorAll('#bm-icon-gallery .icon-tile').forEach(t => t.classList.remove('active'));
            tile.classList.add('active');
            updateResultButtonBadge();
        });
    });

    // Dynamic Role-Aware & Geometry-Gated Modal Footer with View Result & Changes button
    const footer = document.querySelector('#building-modal .modal-footer');
    if (footer) {
        const adminDirect = canPublish();
        const resultBtn = `
            <button type="button" class="btn btn-secondary" id="btn-view-bldg-result" onclick="openBuildingResultPreview()" style="margin-right:auto; border-color:rgba(56,189,248,0.38); color:#7dd3fc;">
                ${SVG_ICONS.eye}
                <span>View Result & Changes</span>
                <span id="bldg-diff-btn-badge" class="mono-id" style="padding:1px 7px; border-radius:999px; font-size:11px; background:rgba(148,163,184,0.18);">0</span>
            </button>
        `;
        if (adminDirect) {
            footer.innerHTML = hasGeo
                ? `${resultBtn}
                   <button type="button" class="btn btn-secondary" onclick="closeBuildingModal()">Cancel</button>
                   <button type="button" class="btn btn-blue" onclick="submitBuildingModal(true, false)">Submit for Review</button>
                   <button type="button" class="btn btn-emerald" onclick="submitBuildingModal(false, false)">Save & Publish Live</button>`
                : `${resultBtn}
                   <button type="button" class="btn btn-secondary" onclick="closeBuildingModal()">Cancel</button>
                   <button type="button" class="btn btn-blue" onclick="submitBuildingModal(false, true)">Save Unmapped Draft (Hidden)</button>
                   <button type="button" class="btn btn-emerald" disabled style="opacity:0.45; cursor:not-allowed;" title="Draw footprint in draw.html first before publishing live">Save & Publish Live (Needs Geometry)</button>`;
        } else {
            footer.innerHTML = `${resultBtn}
               <button type="button" class="btn btn-secondary" onclick="closeBuildingModal()">Cancel</button>
               <button type="button" class="btn btn-emerald" onclick="submitBuildingModal(true, false)">Submit for Reviewer Approval →</button>`;
        }
    }

    activeGalleryMode = 'slider';
    visitorPreviewIdx = 0;
    originalBuildingSnapshot.gallery_mode = 'slider';
    if (PortalState.editingBuilding && PortalState.editingBuilding.building_code) {
        apiFetch(`/api/admin/building-gallery-mode?station=${encodeURIComponent(PortalState.currentStation)}&building_code=${encodeURIComponent(PortalState.editingBuilding.building_code)}`)
            .then(r => {
                if (r && r.gallery_mode) {
                    activeGalleryMode = r.gallery_mode;
                    if (originalBuildingSnapshot) originalBuildingSnapshot.gallery_mode = r.gallery_mode;
                    renderHeroGallerySection();
                    updateResultButtonBadge();
                }
            })
            .catch(() => {});
    }
    updateResultButtonBadge();
    document.getElementById('building-modal').classList.add('open');
};

function renderPreviewHeroSlideshow() {
    const host = document.getElementById('blp-hero-host');
    if (!host) return;
    if (workingPhotos.length === 0) {
        host.innerHTML = `<div style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; color:#64748b; font-size:12px;">${SVG_ICONS.image}<span>No facility photos uploaded</span></div>`;
        return;
    }
    if (previewSlideIdx >= workingPhotos.length) previewSlideIdx = 0;
    const ph = workingPhotos[previewSlideIdx];
    const showArrows = workingPhotos.length > 1;
    host.innerHTML = `
        <img src="${escapeHtml(getPhotoPreviewSrc(ph))}" alt="${escapeHtml(ph.caption || 'Preview')}">
        <div class="bldg-hero-vignette"></div>
        ${showArrows ? `
            <button type="button" class="bldg-slide-nav prev" style="width:30px; height:30px; font-size:16px; left:8px;" onclick="stepPreviewSlide(-1)">‹</button>
            <button type="button" class="bldg-slide-nav next" style="width:30px; height:30px; font-size:16px; right:8px;" onclick="stepPreviewSlide(1)">›</button>
        ` : ''}
        <div style="position:absolute; top:8px; right:8px; z-index:4; padding:2px 8px; border-radius:999px; background:rgba(9,13,22,0.82); border:1px solid rgba(255,255,255,0.16); color:#f8fafc; font-size:10.5px; font-weight:700;">
            ${previewSlideIdx + 1} / ${workingPhotos.length}
        </div>
        <div style="position:absolute; bottom:8px; left:8px; right:8px; z-index:4; padding:4px 9px; border-radius:7px; background:rgba(9,13,22,0.82); border:1px solid rgba(255,255,255,0.12); font-size:11px; font-weight:700; color:#f8fafc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHtml(ph.caption || 'Facility View')}
        </div>
    `;
}

window.stepPreviewSlide = (delta) => {
    if (workingPhotos.length <= 1) return;
    previewSlideIdx = (previewSlideIdx + delta + workingPhotos.length) % workingPhotos.length;
    renderPreviewHeroSlideshow();
};

window.openBuildingResultPreview = () => {
    const cur = readCurrentBuildingFormState();
    const editing = PortalState.editingBuilding || {};
    const diffs = buildBuildingDiffs();
    const hasGeo = hasBldgGeometry(editing);
    previewSlideIdx = activeSlideIdx < workingPhotos.length ? activeSlideIdx : 0;

    document.getElementById('bldg-preview-title').textContent = `View Result & Changes — ${cur.name || 'Building Preview'}`;
    const countPill = document.getElementById('bldg-preview-count-pill');
    if (countPill) {
        countPill.textContent = diffs.length === 1 ? '1 change staged' : `${diffs.length} changes staged`;
        countPill.className = `status-pill ${diffs.length > 0 ? 'status-pill-live' : 'status-pill-blue'}`;
    }

    const iconDef = ICON_GALLERY.find(ic => ic.id === cur.icon);
    const pinBadgeInner = cur.building_num
        ? escapeHtml(cur.building_num)
        : ((iconDef && SVG_ICONS[iconDef.svgKey]) || SVG_ICONS.building);
    const offices = Array.isArray(editing.offices) ? editing.offices : [];

    const diffsHtml = diffs.length === 0
        ? `<div class="bldg-diff-item" style="text-align:center; padding:26px 16px; color:#94a3b8;">
               No changes made yet. Modify any text field, pin color, icon, or gallery photo to preview Red (Past) vs. Green (Changed) diffs.
           </div>`
        : diffs.map(d => {
            if (d.type === 'color') {
                return `
                    <div class="bldg-diff-item">
                        <div class="bldg-diff-field-label">${escapeHtml(d.label)}</div>
                        <div class="diff-box-past" style="display:flex; align-items:center; gap:8px;">
                            <span class="diff-line-tag">− PAST</span>
                            <span style="width:16px; height:16px; border-radius:4px; background:${escapeHtml(d.past)}; border:1px solid rgba(255,255,255,0.3); display:inline-block;"></span>
                            <span class="mono-id" style="color:#ffe4e6;">${escapeHtml(d.past.toUpperCase())}</span>
                        </div>
                        <div class="diff-box-changed" style="display:flex; align-items:center; gap:8px;">
                            <span class="diff-line-tag">+ CHANGED</span>
                            <span style="width:16px; height:16px; border-radius:4px; background:${escapeHtml(d.changed)}; border:1px solid rgba(255,255,255,0.3); display:inline-block;"></span>
                            <span class="mono-id" style="color:#ecfdf5;">${escapeHtml(d.changed.toUpperCase())}</span>
                        </div>
                    </div>
                `;
            }
            const { pastHtml, changedHtml } = computeWordDiff(d.past, d.changed);
            return `
                <div class="bldg-diff-item">
                    <div class="bldg-diff-field-label">${escapeHtml(d.label)}</div>
                    <div class="diff-box-past"><span class="diff-line-tag">− PAST</span>${pastHtml}</div>
                    <div class="diff-box-changed"><span class="diff-line-tag">+ CHANGED</span>${changedHtml}</div>
                </div>
            `;
        }).join('');

    document.getElementById('bldg-preview-body').innerHTML = `
        <div class="bldg-preview-split">
            <!-- LEFT: Authentic Map Building Drawer Replica -->
            <div>
                <div style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#7dd3fc; margin-bottom:8px;">
                    Live Map Drawer Preview (Visitor View)
                </div>
                <div class="bldg-live-preview-card">
                    <div class="blp-header">
                        <div class="pin-live-circle" style="background:${escapeHtml(cur.pin_color)};">${pinBadgeInner}</div>
                        <div style="min-width:0; flex:1;">
                            <div style="font-size:15px; font-weight:700; color:#f8fafc; line-height:1.2;">${escapeHtml(cur.name || 'Untitled Building')}</div>
                            <div style="font-size:11.5px; color:#94a3b8; margin-top:2px;">${escapeHtml(cur.type_label || CATEGORY_LABELS[cur.category] || 'Research Facility')}</div>
                            <div style="margin-top:5px;">${renderFacilityStatusBadge(cur.facility_status || 'Existing')}</div>
                        </div>
                    </div>

                    <div class="blp-hero-wrap" id="blp-hero-host"></div>

                    <div style="padding:4px 16px 14px;">
                        <div class="blp-wf-card visual">
                            <div style="font-size:10.5px; font-weight:700; color:#7dd3fc; letter-spacing:0.06em; margin-bottom:4px;">HOW TO SPOT IT</div>
                            <div style="font-size:12px; color:#e2e8f0; line-height:1.45;">${escapeHtml(cur.visual_landmark || 'Visual landmark guidance not yet entered.')}</div>
                        </div>
                        <div class="blp-wf-card services">
                            <div style="font-size:10.5px; font-weight:700; color:#86efac; letter-spacing:0.06em; margin-bottom:4px;">WHAT'S INSIDE & SERVICES</div>
                            <div style="font-size:12px; color:#e2e8f0; line-height:1.45;">${escapeHtml(cur.key_services || 'Key services not yet entered.')}</div>
                        </div>
                        ${cur.description ? `<div style="font-size:11.5px; color:#94a3b8; margin-top:6px;">${escapeHtml(cur.description)}</div>` : ''}
                        ${offices.length > 0 ? `
                            <div style="margin-top:10px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06);">
                                <div style="font-size:10.5px; font-weight:700; color:#cbd5e1; margin-bottom:5px;">INTERNAL OFFICES (${offices.length})</div>
                                <div style="display:flex; flex-wrap:wrap; gap:5px;">
                                    ${offices.slice(0, 6).map(o => `<span class="mono-code">${escapeHtml(o.office_name || o.name || 'Office')}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- RIGHT: Red Past vs Green Changed Diff Panel -->
            <div class="bldg-diff-panel">
                <div class="diff-legend-bar">
                    <strong style="color:#f8fafc;">Text & Media Diff Summary</strong>
                    <div class="diff-legend-pills">
                        <span class="diff-legend-tag past">− Past (Previous)</span>
                        <span class="diff-legend-tag changed">+ Changed (New)</span>
                    </div>
                </div>
                ${diffsHtml}
            </div>
        </div>
    `;

    renderPreviewHeroSlideshow();

    const pFooter = document.getElementById('bldg-preview-footer');
    if (pFooter) {
        const adminDirect = canPublish();
        if (adminDirect) {
            pFooter.innerHTML = hasGeo
                ? `<button type="button" class="btn btn-secondary" onclick="closeBuildingResultPreview()">← Back to Editing</button>
                   <button type="button" class="btn btn-blue" onclick="closeBuildingResultPreview(); submitBuildingModal(true, false)">Submit for Review</button>
                   <button type="button" class="btn btn-emerald" onclick="closeBuildingResultPreview(); submitBuildingModal(false, false)">Save & Publish Live</button>`
                : `<button type="button" class="btn btn-secondary" onclick="closeBuildingResultPreview()">← Back to Editing</button>
                   <button type="button" class="btn btn-blue" onclick="closeBuildingResultPreview(); submitBuildingModal(false, true)">Save Unmapped Draft (Hidden)</button>`;
        } else {
            pFooter.innerHTML = `<button type="button" class="btn btn-secondary" onclick="closeBuildingResultPreview()">← Back to Editing</button>
               <button type="button" class="btn btn-emerald" onclick="closeBuildingResultPreview(); submitBuildingModal(true, false)">Submit for Reviewer Approval →</button>`;
        }
    }

    document.getElementById('bldg-preview-modal').classList.add('open');
};

window.closeBuildingResultPreview = () => document.getElementById('bldg-preview-modal')?.classList.remove('open');

window.closeBuildingModal = () => {
    window.closeBuildingResultPreview();
    document.getElementById('building-modal')?.classList.remove('open');
};

window.submitBuildingModal = async (submitForReview = false, saveAsDraft = false) => {
    const editing = PortalState.editingBuilding;
    const hasGeo = hasBldgGeometry(editing);
    if (!hasGeo && !submitForReview && !saveAsDraft) {
        showToast('Cannot Publish Live without mapped geometry. Save as an Unmapped Draft or draw the footprint in draw.html first.');
        return;
    }
    const nameVal = document.getElementById('bm-name').value.trim();
    if (!nameVal) {
        showToast('Official Building Name is required.');
        return;
    }

    let codeVal = document.getElementById('bm-code').value.trim();
    if (!codeVal && (!editing || !editing.id)) {
        const slug = nameVal.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        codeVal = slug || `bldg_${Date.now()}`;
    }

    const payload = {
        station_id: PortalState.currentStation,
        building_num: document.getElementById('bm-num').value,
        building_code: codeVal,
        category: document.getElementById('bm-category').value,
        facility_status: document.getElementById('bm-fstatus').value,
        name: nameVal,
        type_label: document.getElementById('bm-type').value.trim(),
        description: document.getElementById('bm-desc').value.trim(),
        visual_landmark: document.getElementById('bm-landmark').value.trim(),
        key_services: document.getElementById('bm-services').value.trim(),
        model_glb_url: document.getElementById('bm-model').value.trim(),
        model_rotation: (document.getElementById('bm-model-rot')?.value || '').trim() || null,
        model_scale: (() => {
            const raw = (document.getElementById('bm-model-scale')?.value || '').trim();
            if (!raw) return null;
            if (/^\d+(\.\d+)?$/.test(raw)) {
                const n = Number(raw);
                return JSON.stringify([n, n, n]);
            }
            return raw;
        })(),
        pin_color: normalizeHexColor(document.getElementById('bm-color').value.trim()),
        icon: document.getElementById('bm-icon').value.trim(),
        images: workingPhotos
            .filter(p => p && p.image_webp_url)
            .map((p, i) => ({
                image_webp_url: p.image_webp_url,
                caption: p.caption || 'Facility View',
                display_order: i,
                is_primary: i === 0 ? 1 : 0
            })),
        gallery_mode: activeGalleryMode,
        submitForReview: Boolean(submitForReview),
        saveAsDraft: Boolean(saveAsDraft)
    };

    const ok = await showPortalConfirm({
        title: saveAsDraft
            ? 'Save Building as Draft?'
            : (submitForReview ? 'Submit Building for Review?' : 'Save & Publish Building Changes?'),
        message: saveAsDraft
            ? `Save "${nameVal}" as an unmapped draft (hidden from public map until geometry is drawn)?`
            : (submitForReview
                ? `Submit your changes to "${nameVal}" for Station Reviewer approval?`
                : `Are you sure you want to save and publish "${nameVal}" directly to the live campus map?`),
        confirmLabel: saveAsDraft ? 'Yes, Save Draft' : (submitForReview ? 'Yes, Submit' : 'Yes, Save & Publish'),
        cancelLabel: 'Cancel'
    });
    if (!ok) return;

    const res = editing && editing.id
        ? await apiFetch(`/api/admin/buildings/${editing.id}`, { method: 'PUT', body: JSON.stringify({ ...editing, ...payload }) })
        : await apiFetch('/api/admin/buildings', { method: 'POST', body: JSON.stringify(payload) });

    if (res.published) {
        broadcastDbSync();
        showToast(`Published "${payload.name}" cleanly to live map!`);
    } else if (res.draft) {
        showToast(`Saved "${payload.name}" as Unmapped Draft (hidden until drawn in draw.html).`);
    } else {
        showToast(`Submitted "${payload.name}" (Request #${res.changeRequestId}) for Reviewer approval!`);
    }
    window.closeBuildingModal();
    window.refreshCurrentTab();
};

window.saveBuildingModal = () => window.submitBuildingModal(!canPublish());

window.updatePhotoCaption = (slideIdxOrId) => {
    const ph = typeof slideIdxOrId === 'number' && workingPhotos[slideIdxOrId]
        ? workingPhotos[slideIdxOrId]
        : workingPhotos.find(p => p.id === slideIdxOrId);
    if (!ph) return;

    const caption = (document.getElementById('bldg-active-caption')?.value || document.getElementById(`img-cap-${ph.id}`)?.value || '').trim() || 'Facility View';
    ph.caption = caption;
    showToast('Photo caption staged! Click Submit / Save below to include with your building update.');
    renderHeroGallerySection();
    updateResultButtonBadge();
};

window.setPrimaryBuildingPhoto = (slideIdxOrId) => {
    const ph = typeof slideIdxOrId === 'number' && workingPhotos[slideIdxOrId]
        ? workingPhotos[slideIdxOrId]
        : workingPhotos.find(p => p.id === slideIdxOrId);
    if (!ph) return;

    const curIdx = workingPhotos.indexOf(ph);
    if (curIdx > 0) {
        workingPhotos.splice(curIdx, 1);
        workingPhotos.unshift(ph);
        activeSlideIdx = 0;
        visitorPreviewIdx = 0;
    }
    workingPhotos.forEach((p, i) => { p.is_primary = i === 0 ? 1 : 0; p.display_order = i; });
    showToast('Primary cover updated! Click Submit / Save below to apply.');
    renderHeroGallerySection();
    updateResultButtonBadge();
};

window.deleteBuildingPhoto = async (slideIdxOrId) => {
    const idx = (typeof slideIdxOrId === 'number' && workingPhotos[slideIdxOrId])
        ? slideIdxOrId
        : workingPhotos.findIndex(p => p.id === slideIdxOrId);
    if (idx < 0) return;

    const ph = workingPhotos[idx];
    const ok = await showPortalConfirm({
        title: 'Remove Facility Photo?',
        message: `Remove "${ph.caption || 'this photo'}" from the building gallery? This change will be bundled into your building submission when you save.`,
        confirmLabel: 'Remove Photo',
        cancelLabel: 'Keep Photo',
        danger: true
    });
    if (!ok) return;

    removedPhotos.push(ph);
    workingPhotos.splice(idx, 1);
    workingPhotos.forEach((p, i) => { p.is_primary = i === 0 ? 1 : 0; p.display_order = i; });
    if (activeSlideIdx >= workingPhotos.length) {
        activeSlideIdx = Math.max(0, workingPhotos.length - 1);
    }
    showToast('Photo removed from gallery. Click Submit / Save below to apply.');
    renderHeroGallerySection();
    updateResultButtonBadge();
};

window.deleteBuildingRow = async (id) => {
    const b = PortalState.cachedBuildings.find(x => x.id === id);
    const ok = await showPortalConfirm({
        title: 'Delete Building Record?',
        message: `Delete "${b ? b.name : 'this building'}" from the station directory?`,
        confirmLabel: 'Delete Building',
        cancelLabel: 'Cancel',
        danger: true
    });
    if (!ok) return;
    const res = await apiFetch(`/api/admin/buildings/${id}`, { method: 'DELETE' });
    if (res.published) broadcastDbSync();
    showToast(res.published ? 'Building deleted.' : 'Deletion queued for Reviewer approval.');
    window.refreshCurrentTab();
};
