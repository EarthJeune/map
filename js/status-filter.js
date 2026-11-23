/**
 * Unified Facility Status Filter & Visual Badge Engine (Phase 6)
 * Controls Existing (default checked), Under Construction, and Proposed visibility
 * across desktop sidebar, mobile sheet, 3D layers, dashed land-use polygons, and map pills.
 */

export const STATUS_FILTER_MODES = [
    {
        mode: 'existing',
        label: 'Existing Only',
        dot: '#10b981',
        desc: 'Default • Completed & operational buildings & plots',
        statuses: ['Existing']
    },
    {
        mode: 'under_construction',
        label: 'Under Construction',
        dot: '#f59e0b',
        desc: 'Ongoing construction (generic 3D prism)',
        statuses: ['Under Construction']
    },
    {
        mode: 'proposed',
        label: 'Proposed Land Use',
        dot: '#14b8a6',
        desc: 'Planned land-use areas (dashed outline)',
        statuses: ['Proposed']
    },
    {
        mode: 'all',
        label: 'All Statuses',
        dot: '#38bdf8',
        desc: 'Operational, construction & proposed combined',
        statuses: ['Existing', 'Under Construction', 'Proposed']
    }
];

export const STATUS_FILTER_DEFS = STATUS_FILTER_MODES;

export const activeStatusFilters = new Set(['Existing']);
let currentStatusMode = 'existing';

if (typeof window !== 'undefined') {
    window.activeStatusFilters = activeStatusFilters;
}

export function getActiveStatusMode() {
    return currentStatusMode;
}

export function setStatusFilterMode(modeOrKey) {
    const clean = String(modeOrKey || '').trim().toLowerCase();
    let nextMode = 'existing';
    if (clean === 'under_construction' || clean === 'under construction') {
        nextMode = 'under_construction';
    } else if (clean === 'proposed') {
        nextMode = 'proposed';
    } else if (clean === 'all') {
        nextMode = 'all';
    }
    const def = STATUS_FILTER_MODES.find(m => m.mode === nextMode) || STATUS_FILTER_MODES[0];
    currentStatusMode = def.mode;
    activeStatusFilters.clear();
    def.statuses.forEach(s => activeStatusFilters.add(s));
    return currentStatusMode;
}

export function normalizeFacilityStatus(raw) {
    const clean = String(raw || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
    if (clean === 'under construction' || clean === 'ongoing construction' || clean === 'construction') {
        return 'Under Construction';
    }
    if (clean === 'proposed' || clean === 'planned' || clean === 'proposed land use') {
        return 'Proposed';
    }
    return 'Existing';
}

export function isFacilityStatusVisible(raw) {
    return activeStatusFilters.has(normalizeFacilityStatus(raw));
}

export function getNonDefaultStatusFilterCount() {
    return currentStatusMode === 'existing' ? 0 : 1;
}

export function resetStatusFiltersToDefault() {
    setStatusFilterMode('existing');
}

export function renderFacilityStatusBadgeHtml(raw, variant = 'drawer') {
    const status = normalizeFacilityStatus(raw);
    if (status === 'Existing') return '';
    const compactCls = variant === 'marker' ? ' fsb-compact' : '';
    if (status === 'Under Construction') {
        return `<span class="facility-status-badge status-under-construction${compactCls}">UNDER CONSTRUCTION</span>`;
    }
    return `<span class="facility-status-badge status-proposed${compactCls}"><span class="fsb-ig-dot">iG</span>PROPOSED LAND USE</span>`;
}

export function buildStatusFilterOptionsHtml(groupName = 'facility-status-desk') {
    const optionsHtml = STATUS_FILTER_MODES.map(st => {
        const isActive = currentStatusMode === st.mode;
        const iconHtml = st.mode === 'all'
            ? `<span class="fdm-status-dot fdm-status-dot-all" style="background:linear-gradient(135deg,#10b981,#f59e0b,#14b8a6); box-shadow:0 0 8px rgba(56,189,248,0.45);"></span>`
            : `<span class="fdm-status-dot" style="background:${st.dot}; box-shadow: 0 0 8px ${st.dot}66;"></span>`;
        return `
            <label class="fdm-item fdm-status-item ${isActive ? 'active' : ''}" data-status-mode="${st.mode}">
                <input type="radio" name="${groupName}" class="fdm-status-radio" value="${st.mode}" data-status-mode="${st.mode}" ${isActive ? 'checked' : ''} onchange="toggleStatusFilter('${st.mode}', this.checked)">
                <span class="fdm-item-icon">${iconHtml}</span>
                <div class="fdm-item-text">
                    <span class="fdm-item-name">${st.label}</span>
                    <span class="fdm-item-desc">${st.desc}</span>
                </div>
            </label>
        `;
    }).join('');

    return `${optionsHtml}<div class="fdm-status-hint">Default view displays existing operational facilities. Select another mode to inspect ongoing construction or planned land-use zones.</div>`;
}

/**
 * Generate a clean rectangular polygon ring around [lng, lat] when a DB-synced
 * building or split plot lacks traced footprint geometry.
 */
export function buildFallbackRectRing(centerCoords, halfLng = 0.000055, halfLat = 0.000045) {
    if (!Array.isArray(centerCoords) || centerCoords.length < 2) return null;
    const lng = Number(centerCoords[0]);
    const lat = Number(centerCoords[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || (lng === 0 && lat === 0)) return null;
    return [[
        [lng - halfLng, lat - halfLat],
        [lng + halfLng, lat - halfLat],
        [lng + halfLng, lat + halfLat],
        [lng - halfLng, lat + halfLat],
        [lng - halfLng, lat - halfLat]
    ]];
}

if (typeof window !== 'undefined') {
    window.normalizeFacilityStatus = normalizeFacilityStatus;
    window.isFacilityStatusVisible = isFacilityStatusVisible;
    window.renderFacilityStatusBadgeHtml = renderFacilityStatusBadgeHtml;
}

