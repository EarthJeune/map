/**
 * Building-Grouped Internal Offices CRUD with Floor Dropdown (Basement / Ground Floor / Second Floor / Custom),
 * Separate Room Number Field, Auto Typo & Casing Rewriter, Up/Down Ordering & Rule 6 Clarity
 */

import {
    PortalState,
    SVG_ICONS,
    apiFetch,
    showToast,
    broadcastDbSync,
    escapeHtml,
    canPublish,
    renderWorkflowBanner,
    showPortalConfirm
} from './core.js';

let officeSearch = '';
let officeGroupMode = 'all'; // 'all' | 'with_offices' | 'standalone'

export const STANDARD_FLOORS = ['Basement', 'Ground Floor', 'Second Floor'];

const KNOWN_ACRONYMS = new Set([
    'GSS', 'AFD', 'PMED', 'MIS', 'RAFIS', 'BAC', 'GAD', 'PPS', 'MNE', 'MES',
    'AMIA', 'CSO', 'ORED', 'RTD', 'RED', 'RAFC', 'HVCDP', 'FOD', 'NUPAP',
    'LARES', 'QARES', 'RARES', 'CARES', 'RCPC', 'AMAD', 'PRDP', 'ILD', 'F2C2',
    'PGRC', 'RSL', 'RSBSA', 'DRRM', 'R&D', 'HR', 'IT', 'COA', 'ISO', 'DA', 'ICT'
]);

const MINOR_WORDS = new Set(['of', 'and', 'for', 'in', 'on', 'the', 'at', 'to', 'by', 'or']);

const WORD_TYPO_MAP = {
    basment: 'basement',
    basemnt: 'basement',
    bsement: 'basement',
    basemnet: 'basement',
    bsmt: 'basement',
    grnd: 'ground',
    groud: 'ground',
    groun: 'ground',
    flr: 'floor',
    flor: 'floor',
    floo: 'floor',
    foor: 'floor',
    florr: 'floor',
    secnd: 'second',
    secod: 'second',
    secon: 'second',
    secound: 'second',
    thrid: 'third',
    thrd: 'third',
    fourht: 'fourth',
    fith: 'fifth',
    mezanine: 'mezzanine',
    mezz: 'mezzanine',
    anex: 'annex',
    rm: 'room',
    rom: 'room',
    rooom: 'room',
    r00m: 'room',
    ofice: 'office',
    offce: 'office',
    offcie: 'office',
    divison: 'division',
    divsion: 'division',
    secton: 'section',
    sectin: 'section',
    seciton: 'section',
    adminstrative: 'administrative',
    administative: 'administrative',
    generl: 'general',
    genral: 'general',
    servces: 'services',
    servies: 'services',
    managment: 'management',
    mangement: 'management',
    resarch: 'research',
    reserach: 'research',
    operatons: 'operations',
    opertions: 'operations',
    finace: 'finance',
    fiannce: 'finance',
    planing: 'planning',
    monitring: 'monitoring',
    monitroing: 'monitoring',
    evalution: 'evaluation',
    comittee: 'committee',
    commitee: 'committee',
    biding: 'bidding',
    confernce: 'conference',
    confrence: 'conference',
    conf: 'conference',
    laboratoy: 'laboratory',
    labratory: 'laboratory',
    reigonal: 'regional',
    reginal: 'regional',
    agricutural: 'agricultural',
    agricultual: 'agricultural',
    extention: 'extension',
    suport: 'support',
    cordinator: 'coordinator',
    enginnering: 'engineering',
    engneering: 'engineering',
    accouting: 'accounting',
    acounting: 'accounting',
    budjet: 'budget',
    procuerment: 'procurement',
    procuremnt: 'procurement',
    persomel: 'personnel',
    personel: 'personnel',
    recrods: 'records',
    chif: 'chief',
    directer: 'director',
    staf: 'staff',
    facilites: 'facilities',
    logisitics: 'logistics',
    logistcs: 'logistics',
    hal: 'hall'
};

function cleanWhitespace(raw) {
    return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

function fixTyposInWord(core) {
    return WORD_TYPO_MAP[core.toLowerCase()] || core;
}

function toTitleCaseToken(rawToken, isFirst, forceUpperShort = false) {
    const match = rawToken.match(/^([^a-zA-Z0-9&]*)(.*?)([^a-zA-Z0-9&]*)$/);
    if (!match) return rawToken;
    const [, lead, core, trail] = match;
    if (!core) return rawToken;

    if (core.includes('/') && !core.includes(' ')) {
        return lead + core.split('/').map((part, i) => toTitleCaseToken(part, isFirst && i === 0, forceUpperShort)).join('/') + trail;
    }

    const fixedCore = fixTyposInWord(core);
    const upper = fixedCore.toUpperCase();
    const low = fixedCore.toLowerCase();

    if (KNOWN_ACRONYMS.has(upper)) return lead + upper + trail;
    if (/^(ii|iii|iv|v|vi|vii|viii|ix|x)$/i.test(fixedCore)) return lead + upper + trail;
    if (lead === '(' && trail.startsWith(')') && /^[a-z0-9&]{2,6}$/i.test(fixedCore)) return lead + upper + trail;
    if (forceUpperShort && (/^\d+[a-z]+$/i.test(fixedCore) || /^[a-z]\d+$/i.test(fixedCore) || /^[a-z]$/i.test(fixedCore))) {
        return lead + upper + trail;
    }
    if (!isFirst && MINOR_WORDS.has(low)) return lead + low + trail;
    if (/^\d+(st|nd|rd|th)$/i.test(low)) return lead + low + trail;
    return lead + low.charAt(0).toUpperCase() + low.slice(1) + trail;
}

export function normalizeFloorLabel(raw) {
    const cleaned = cleanWhitespace(raw);
    if (!cleaned) return '';

    const key = cleaned.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
    if (['basement', 'basment', 'basemnt', 'bsement', 'basemnet', 'bsmt', 'base ment', 'b1', 'b-1', 'basement floor'].includes(key)) {
        return 'Basement';
    }
    if (['ground', 'ground floor', 'grnd', 'grnd floor', 'grnd flr', 'groud floor', 'groun floor', 'ground flr', 'ground flor', 'ground floo', 'ground foor', 'gf', 'g/f', '1st floor', 'first floor', '1st flr', '1f'].includes(key)) {
        return 'Ground Floor';
    }
    if (['second', 'second floor', '2nd', '2nd floor', '2nd flr', '2nd flor', 'secnd floor', 'secod floor', 'secon floor', 'secound floor', 'second flr', 'second flor', '2f', '2/f'].includes(key)) {
        return 'Second Floor';
    }
    if (['3rd', '3rd floor', '3rd flr', 'third', 'third floor', 'thrid floor', 'thrd floor', 'third flr', 'third flor', '3f', '3/f'].includes(key)) {
        return 'Third Floor';
    }
    if (['4th', '4th floor', '4th flr', 'fourth', 'fourth floor', 'forth floor', 'fourht floor', '4f', '4/f'].includes(key)) {
        return 'Fourth Floor';
    }
    if (['5th', '5th floor', '5th flr', 'fifth', 'fifth floor', 'fith floor', '5f', '5/f'].includes(key)) {
        return 'Fifth Floor';
    }
    if (['mezanine', 'mezz', 'mezzanine', 'mezzanine floor'].includes(key)) {
        return 'Mezzanine';
    }
    if (['roofdeck', 'roof deck', 'rooftop', 'roof top'].includes(key)) {
        return 'Roof Deck';
    }
    if (['anex', 'annex'].includes(key)) {
        return 'Annex';
    }

    return cleaned
        .split(' ')
        .map((tok, idx) => toTitleCaseToken(tok, idx === 0, false))
        .join(' ');
}

export function normalizeRoomNumber(raw) {
    const cleaned = cleanWhitespace(raw);
    if (!cleaned) return '';

    if (/^(?:[a-zA-Z]?\d+[a-zA-Z0-9-]*|[bB]-?\d+[a-zA-Z]?)$/.test(cleaned)) {
        return `Room ${cleaned.toUpperCase()}`;
    }

    const rmMatch = cleaned.match(/^(?:r(?:oom|m|om|ooom|00m)\.?\s*#?\s*-?|#)\s*([a-z0-9][a-z0-9-]*)$/i);
    if (rmMatch && rmMatch[1]) {
        return `Room ${rmMatch[1].toUpperCase()}`;
    }

    return cleaned
        .split(' ')
        .map((tok, idx) => toTitleCaseToken(tok, idx === 0, true))
        .join(' ');
}

export function normalizeOfficeName(raw) {
    const cleaned = cleanWhitespace(raw);
    if (!cleaned) return '';
    return cleaned
        .split(' ')
        .map((tok, idx) => toTitleCaseToken(tok, idx === 0, false))
        .join(' ');
}

export function normalizeOfficeNotes(raw) {
    const cleaned = cleanWhitespace(raw);
    if (!cleaned) return '';

    const typoFixed = cleaned
        .split(' ')
        .map(tok => {
            const match = tok.match(/^([^a-zA-Z0-9&]*)(.*?)([^a-zA-Z0-9&]*)$/);
            if (!match) return tok;
            const [, lead, core, trail] = match;
            if (!core) return tok;
            const fixed = fixTyposInWord(core);
            const upper = fixed.toUpperCase();
            if (KNOWN_ACRONYMS.has(upper)) return lead + upper + trail;
            if (fixed !== core) {
                const hadInitialCap = core[0] && core[0] === core[0].toUpperCase() && core[0] !== core[0].toLowerCase();
                return lead + (hadInitialCap ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed) + trail;
            }
            return tok;
        })
        .join(' ');

    return typoFixed.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, prefix, ch) => prefix + ch.toUpperCase());
}

/**
 * Separates legacy combined values (e.g. "Ground Floor, Room 102") when separate `room_number` is empty.
 */
function splitLegacyFloorAndRoom(floorOrRoom, roomNumber) {
    const cleanRoom = cleanWhitespace(roomNumber);
    const cleanFloor = cleanWhitespace(floorOrRoom);
    if (cleanRoom) {
        return {
            floor: normalizeFloorLabel(cleanFloor),
            room: normalizeRoomNumber(cleanRoom)
        };
    }
    if (!cleanFloor) {
        return { floor: '', room: '' };
    }
    const comboMatch = cleanFloor.match(/^(.+?)\s*(?:,|\/|\s+-\s+|\s+(?=(?:room|rm\.?|#)\s*[a-z0-9]))\s*((?:room|rm\.?|#)?\s*[a-z0-9][a-z0-9-]*.*)$/i);
    if (comboMatch && /^(?:room|rm\.?|#)/i.test(comboMatch[2])) {
        return {
            floor: normalizeFloorLabel(comboMatch[1]),
            room: normalizeRoomNumber(comboMatch[2])
        };
    }
    if (/^(?:room|rm\.?|#)\s*[a-z0-9]/i.test(cleanFloor)) {
        return {
            floor: '',
            room: normalizeRoomNumber(cleanFloor)
        };
    }
    return {
        floor: normalizeFloorLabel(cleanFloor),
        room: ''
    };
}

function setRewriteHint(hintId, rawVal, fixedVal, customMessage = '') {
    const el = document.getElementById(hintId);
    if (!el) return;
    if (customMessage) {
        el.textContent = customMessage;
        el.style.color = '#34d399';
        return;
    }
    if (rawVal && fixedVal && rawVal !== fixedVal) {
        el.textContent = `✓ Auto-formatted: "${rawVal}" → "${fixedVal}"`;
        el.style.color = '#34d399';
    } else {
        el.textContent = '';
    }
}

function renderOfficeGroupsList() {
    const host = document.getElementById('offices-groups-host');
    if (!host) return;

    const buildings = PortalState.cachedBuildings || [];
    const officesByBldg = {};
    (PortalState.cachedOffices || []).forEach(o => {
        (officesByBldg[o.building_code] ||= []).push(o);
    });

    const filteredBldgs = buildings.filter(b => {
        const list = officesByBldg[b.building_code] || [];
        if (officeGroupMode === 'with_offices' && list.length === 0) return false;
        if (officeGroupMode === 'standalone' && list.length > 0) return false;
        if (officeSearch) {
            const term = officeSearch.toLowerCase();
            const bMatch = `${b.name} ${b.building_code} ${b.building_num || ''}`.toLowerCase().includes(term);
            const oMatch = list.some(o => `${o.office_name} ${o.floor_or_room || ''} ${o.room_number || ''} ${o.office_desc || ''}`.toLowerCase().includes(term));
            if (!bMatch && !oMatch) return false;
        }
        return true;
    });

    if (filteredBldgs.length === 0) {
        host.innerHTML = `<div style="text-align:center; padding:34px 16px; color:#94a3b8;">No matching buildings or offices found.</div>`;
        return;
    }

    host.innerHTML = filteredBldgs.map(b => {
        const list = (officesByBldg[b.building_code] || []).slice().sort((a, x) => Number(a.display_order || 1) - Number(x.display_order || 1) || a.id - x.id);
        const isStandalone = list.length === 0;
        return `
            <div class="office-group-card ${isStandalone ? 'collapsed' : ''}" data-office-bldg="${escapeHtml(b.building_code)}">
                <div class="office-group-head" onclick="this.closest('.office-group-card').classList.toggle('collapsed')">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        ${b.building_num ? `<span class="mono-id">#${b.building_num}</span>` : ''}
                        <strong style="color:#f8fafc; font-size:14px;">${escapeHtml(b.name)}</strong>
                        <span class="mono-code">${escapeHtml(b.building_code)}</span>
                        ${isStandalone
                            ? `<span class="status-pill" style="background:rgba(100,116,139,0.16); border:1px solid rgba(148,163,184,0.28); color:#cbd5e1;">No offices</span>`
                            : `<span class="status-pill status-pill-live">${list.length === 1 ? '1 Office' : `${list.length} Offices`}</span>`}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;" onclick="event.stopPropagation()">
                        <button type="button" class="btn btn-blue btn-sm" onclick="openOfficeModal(null, '${escapeHtml(b.building_code)}')">${SVG_ICONS.plus} <span>Add Office</span></button>
                    </div>
                </div>
                <div class="office-group-body">
                    ${isStandalone ? `
                        <div class="help-tip" style="margin-top:10px;">
                            No offices are currently listed in this building.
                        </div>
                    ` : list.map((o, idx) => {
                        const { floor, room } = splitLegacyFloorAndRoom(o.floor_or_room, o.room_number);
                        return `
                        <div class="office-row-item">
                            <div style="min-width:220px; flex:1;">
                                <div style="font-weight:700; color:var(--role-accent-light); font-size:13.5px;">${escapeHtml(o.office_name)}</div>
                                <div style="display:flex; gap:8px; align-items:center; margin-top:4px; flex-wrap:wrap;">
                                    <span class="status-pill status-pill-blue" style="font-size:10.5px;">${escapeHtml(floor || 'Not set')}</span>
                                    ${room ? `<span class="status-pill status-pill-live" style="font-size:10.5px;">${escapeHtml(room)}</span>` : ''}
                                    <span class="mono-id" style="font-size:11px;">Order #${o.display_order || (idx + 1)}</span>
                                    ${o.office_desc ? `<span style="font-size:11.5px; color:#94a3b8;">${escapeHtml(o.office_desc)}</span>` : ''}
                                </div>
                            </div>
                            <div class="action-cell">
                                <button type="button" class="btn btn-secondary btn-sm" title="Move Up" ${idx === 0 ? 'disabled' : ''} onclick="moveOfficeOrder('${escapeHtml(b.building_code)}', ${o.id}, -1)">↑</button>
                                <button type="button" class="btn btn-secondary btn-sm" title="Move Down" ${idx === list.length - 1 ? 'disabled' : ''} onclick="moveOfficeOrder('${escapeHtml(b.building_code)}', ${o.id}, 1)">↓</button>
                                <button type="button" class="btn btn-blue btn-sm" onclick="openOfficeModal(${o.id})">${SVG_ICONS.edit} <span>Edit</span></button>
                                <button type="button" class="btn btn-danger btn-sm" onclick="deleteOfficeRow(${o.id})" title="Remove office">${SVG_ICONS.trash}</button>
                            </div>
                        </div>
                    `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

export async function renderOfficesTab(container) {
    [PortalState.cachedBuildings, PortalState.cachedOffices] = await Promise.all([
        apiFetch(`/api/admin/buildings?station=${PortalState.currentStation}`),
        apiFetch(`/api/admin/offices?station=${PortalState.currentStation}`)
    ]);

    container.innerHTML = `
        ${renderWorkflowBanner('Internal Building Offices')}

        <div class="panel-card">
            <div class="panel-header">
                <div class="panel-title-group">
                    <div class="panel-title-icon">${SVG_ICONS.folder}</div>
                    <div>
                        <h3>Building-Grouped Internal Offices (${PortalState.cachedOffices.length} units in ${PortalState.currentStation.toUpperCase()})</h3>
                        <div class="help-tip">Click any building card header to expand/collapse its internal units. Standalone buildings cleanly show 0 offices.</div>
                    </div>
                </div>
                <button type="button" class="btn btn-emerald" onclick="openOfficeModal(null)">${SVG_ICONS.plus} <span>Add Office</span></button>
            </div>

            <div class="portal-filter-grid-2" style="display:grid; grid-template-columns:1.5fr 1fr; gap:10px; margin-bottom:16px;">
                <input type="text" id="office-search-input" class="form-control" placeholder="Search buildings, office names, floors, or rooms..." value="${escapeHtml(officeSearch)}">
                <select id="office-group-filter" class="form-control">
                    <option value="all" ${officeGroupMode === 'all' ? 'selected' : ''}>Show All Buildings (${PortalState.cachedBuildings.length})</option>
                    <option value="with_offices" ${officeGroupMode === 'with_offices' ? 'selected' : ''}>Multi-Office Buildings Only</option>
                    <option value="standalone" ${officeGroupMode === 'standalone' ? 'selected' : ''}>Standalone Facilities Only (0 Offices)</option>
                </select>
            </div>

            <div id="offices-groups-host"></div>
        </div>
    `;

    renderOfficeGroupsList();

    document.getElementById('office-search-input')?.addEventListener('input', (e) => {
        officeSearch = e.target.value;
        renderOfficeGroupsList();
    });
    document.getElementById('office-group-filter')?.addEventListener('change', (e) => {
        officeGroupMode = e.target.value;
        renderOfficeGroupsList();
    });
}

window.moveOfficeOrder = async (bCode, officeId, dir) => {
    const list = (PortalState.cachedOffices || [])
        .filter(o => o.building_code === bCode)
        .sort((a, x) => Number(a.display_order || 1) - Number(x.display_order || 1) || a.id - x.id);
    const idx = list.findIndex(o => o.id === officeId);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= list.length) return;

    const a = list[idx];
    const b = list[targetIdx];
    const orderA = Number(a.display_order || (idx + 1));
    const orderB = Number(b.display_order || (targetIdx + 1));
    const nextA = orderA === orderB ? targetIdx + 1 : orderB;
    const nextB = orderA === orderB ? idx + 1 : orderA;

    const r1 = await apiFetch(`/api/admin/offices/${a.id}`, {
        method: 'PUT',
        body: JSON.stringify({
            station_id: PortalState.currentStation,
            building_code: bCode,
            office_name: a.office_name,
            floor_or_room: a.floor_or_room,
            room_number: a.room_number || null,
            office_desc: a.office_desc || null,
            display_order: nextA
        })
    });
    const r2 = await apiFetch(`/api/admin/offices/${b.id}`, {
        method: 'PUT',
        body: JSON.stringify({
            station_id: PortalState.currentStation,
            building_code: bCode,
            office_name: b.office_name,
            floor_or_room: b.floor_or_room,
            room_number: b.room_number || null,
            office_desc: b.office_desc || null,
            display_order: nextB
        })
    });
    if (r1.published || r2.published) {
        broadcastDbSync();
        showToast('Reordered office display sequence!');
    } else {
        showToast('Reorder requests submitted for Reviewer approval!');
    }
    window.refreshCurrentTab();
};

window.openOfficeModal = (officeId, presetBldgCode = null) => {
    const cur = officeId ? PortalState.cachedOffices.find(o => o.id === officeId) : {
        id: null,
        building_code: presetBldgCode || (PortalState.cachedBuildings[0]?.building_code || ''),
        office_name: '',
        floor_or_room: '',
        room_number: '',
        office_desc: '',
        display_order: 1
    };
    PortalState.editingOffice = cur;

    const { floor: parsedFloor, room: parsedRoom } = splitLegacyFloorAndRoom(cur.floor_or_room, cur.room_number);
    const isStandardFloor = STANDARD_FLOORS.includes(parsedFloor);
    const selectValue = !parsedFloor ? '' : (isStandardFloor ? parsedFloor : '__custom__');
    const customFloorInit = isStandardFloor ? '' : parsedFloor;

    document.getElementById('office-modal-title').textContent = cur.id ? `Edit Office: ${cur.office_name}` : 'Add Official Building Office';
    document.getElementById('office-modal-body').innerHTML = `
        <div class="form-group">
            <label>Parent Building *</label>
            <select id="om-bldg" class="form-control">
                ${(PortalState.cachedBuildings || []).map(b => `<option value="${escapeHtml(b.building_code)}" ${cur.building_code === b.building_code ? 'selected' : ''}>${b.building_num ? '#' + b.building_num + ' ' : ''}${escapeHtml(b.name)}</option>`).join('')}
            </select>
        </div>

        <div class="form-group">
            <label>Official Office / Division / Unit Name *</label>
            <input type="text" id="om-name" class="form-control" value="${escapeHtml(cur.office_name || '')}" placeholder="e.g. Planning, Monitoring and Evaluation Division">
            <div class="help-tip" id="om-name-hint">Typos & small letters auto-capitalize cleanly (e.g. "generl servces (gss)" → "General Services (GSS)").</div>
        </div>

        <div class="form-grid-2" style="align-items:start;">
            <div class="form-group">
                <label>Floor Level</label>
                <select id="om-floor-select" class="form-control">
                    <option value="" ${selectValue === '' ? 'selected' : ''}>Not set</option>
                    <option value="Basement" ${selectValue === 'Basement' ? 'selected' : ''}>Basement</option>
                    <option value="Ground Floor" ${selectValue === 'Ground Floor' ? 'selected' : ''}>Ground Floor</option>
                    <option value="Second Floor" ${selectValue === 'Second Floor' ? 'selected' : ''}>Second Floor</option>
                    <option value="__custom__" ${selectValue === '__custom__' ? 'selected' : ''}>Custom Floor...</option>
                </select>
                <div id="om-floor-custom-wrap" style="margin-top:8px;" ${selectValue === '__custom__' ? '' : 'hidden'}>
                    <input type="text" id="om-floor-custom" class="form-control" value="${escapeHtml(customFloorInit)}" placeholder="e.g. Third Floor, Mezzanine, Annex">
                </div>
                <div class="help-tip" id="om-floor-hint">Choose a floor or select Custom Floor (auto-corrects casing & typos).</div>
            </div>

            <div class="form-group">
                <label>Room Number (Optional)</label>
                <input type="text" id="om-room" class="form-control" value="${escapeHtml(parsedRoom || '')}" placeholder="e.g. Room 102, 204B, Conference Hall A">
                <div class="help-tip" id="om-room-hint">Enter just a number like <code>102</code> or <code>rm 204b</code> — formats to <code>Room 102</code> / <code>Room 204B</code>.</div>
            </div>
        </div>

        <div class="form-grid-2" style="align-items:start;">
            <div class="form-group" style="margin-bottom:0;">
                <label>Brief Role / Notes (Optional)</label>
                <input type="text" id="om-desc" class="form-control" value="${escapeHtml(cur.office_desc || '')}" placeholder="Optional short description">
                <div class="help-tip" id="om-desc-hint"></div>
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label>Display Order</label>
                <input type="number" id="om-order" class="form-control" style="font-family:var(--font-mono);" value="${cur.display_order || 1}">
            </div>
        </div>
    `;

    // Wire floor dropdown + live blur auto-rewriters
    const floorSel = document.getElementById('om-floor-select');
    const customWrap = document.getElementById('om-floor-custom-wrap');
    const customInp = document.getElementById('om-floor-custom');
    const roomInp = document.getElementById('om-room');
    const nameInp = document.getElementById('om-name');
    const descInp = document.getElementById('om-desc');

    floorSel?.addEventListener('change', () => {
        const isCustom = floorSel.value === '__custom__';
        if (customWrap) customWrap.hidden = !isCustom;
        setRewriteHint('om-floor-hint', '', '', isCustom ? 'Type a custom floor — small letters & typos are auto-corrected.' : '');
        if (isCustom) customInp?.focus();
    });

    customInp?.addEventListener('blur', () => {
        const raw = customInp.value.trim();
        if (!raw) return;
        const fixed = normalizeFloorLabel(raw);
        if (STANDARD_FLOORS.includes(fixed)) {
            if (floorSel) floorSel.value = fixed;
            customInp.value = '';
            if (customWrap) customWrap.hidden = true;
            setRewriteHint('om-floor-hint', raw, fixed, `✓ Matched standard floor: "${fixed}"`);
        } else {
            customInp.value = fixed;
            setRewriteHint('om-floor-hint', raw, fixed);
        }
    });

    roomInp?.addEventListener('blur', () => {
        const raw = roomInp.value.trim();
        if (!raw) {
            setRewriteHint('om-room-hint', '', '');
            return;
        }
        const fixed = normalizeRoomNumber(raw);
        roomInp.value = fixed;
        setRewriteHint('om-room-hint', raw, fixed);
    });

    nameInp?.addEventListener('blur', () => {
        const raw = nameInp.value.trim();
        if (!raw) return;
        const fixed = normalizeOfficeName(raw);
        nameInp.value = fixed;
        setRewriteHint('om-name-hint', raw, fixed);
    });

    descInp?.addEventListener('blur', () => {
        const raw = descInp.value.trim();
        if (!raw) {
            setRewriteHint('om-desc-hint', '', '');
            return;
        }
        const fixed = normalizeOfficeNotes(raw);
        descInp.value = fixed;
        setRewriteHint('om-desc-hint', raw, fixed);
    });

    const footer = document.querySelector('#office-modal .modal-footer');
    if (footer) {
        footer.innerHTML = canPublish()
            ? `<button type="button" class="btn btn-secondary" onclick="closeOfficeModal()">Cancel</button>
               <button type="button" class="btn btn-blue" onclick="submitOfficeModal(true)">Submit for Review</button>
               <button type="button" class="btn btn-emerald" onclick="submitOfficeModal(false)">Save & Publish Live</button>`
            : `<button type="button" class="btn btn-secondary" onclick="closeOfficeModal()">Cancel</button>
               <button type="button" class="btn btn-emerald" onclick="submitOfficeModal(true)">Submit for Reviewer Approval →</button>`;
    }

    document.getElementById('office-modal').classList.add('open');
};

window.closeOfficeModal = () => document.getElementById('office-modal')?.classList.remove('open');

window.submitOfficeModal = async (submitForReview = false) => {
    const nameEl = document.getElementById('om-name');
    const floorSel = document.getElementById('om-floor-select');
    const customInp = document.getElementById('om-floor-custom');
    const roomEl = document.getElementById('om-room');
    const descEl = document.getElementById('om-desc');

    const normalizedName = normalizeOfficeName(nameEl?.value || '');
    if (nameEl) nameEl.value = normalizedName;

    let resolvedFloor = '';
    if (floorSel?.value === '__custom__') {
        resolvedFloor = normalizeFloorLabel(customInp?.value || '');
        if (customInp) customInp.value = resolvedFloor;
    } else {
        resolvedFloor = normalizeFloorLabel(floorSel?.value || '');
    }

    const resolvedRoom = normalizeRoomNumber(roomEl?.value || '');
    if (roomEl) roomEl.value = resolvedRoom;

    const resolvedNotes = normalizeOfficeNotes(descEl?.value || '');
    if (descEl) descEl.value = resolvedNotes;

    const payload = {
        station_id: PortalState.currentStation,
        building_code: document.getElementById('om-bldg').value,
        office_name: normalizedName,
        floor_or_room: resolvedFloor || null,
        room_number: resolvedRoom || null,
        office_desc: resolvedNotes || null,
        display_order: Number(document.getElementById('om-order').value || 1),
        submitForReview: Boolean(submitForReview)
    };
    if (!payload.office_name) {
        showToast('Office Name is required.');
        return;
    }

    const ok = await showPortalConfirm({
        title: submitForReview ? 'Submit Office Update for Review?' : 'Save Office Changes?',
        message: submitForReview
            ? `Submit office "${payload.office_name}" for Station Reviewer approval?`
            : `Are you sure you want to save and publish office "${payload.office_name}" to the live campus map?`,
        confirmLabel: submitForReview ? 'Yes, Submit' : 'Yes, Save Office',
        cancelLabel: 'Cancel'
    });
    if (!ok) return;

    const res = PortalState.editingOffice?.id
        ? await apiFetch(`/api/admin/offices/${PortalState.editingOffice.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : await apiFetch('/api/admin/offices', { method: 'POST', body: JSON.stringify(payload) });

    if (res.published) {
        broadcastDbSync();
        showToast('Office updated on live map!');
    } else {
        showToast(`Submitted office update (#${res.changeRequestId}) for Reviewer approval!`);
    }
    window.closeOfficeModal();
    window.refreshCurrentTab();
};

window.saveOfficeModal = () => window.submitOfficeModal(!canPublish());

window.deleteOfficeRow = async (id) => {
    const o = (PortalState.cachedOffices || []).find(x => x.id === id);
    const resConfirm = await showPortalConfirm({
        title: 'Remove Office Assignment?',
        message: `Remove "${o ? o.office_name : 'this office'}" from the building directory? (GIS Editor changes will be sent for Reviewer approval.)`,
        confirmLabel: 'Remove Office',
        cancelLabel: 'Cancel',
        danger: true,
        requireReason: true,
        reasonLabel: 'Reason for removal (required)',
        reasonPlaceholder: 'e.g. Office relocated or merged into another division'
    });
    if (!resConfirm?.confirmed) return;
    const res = await apiFetch(`/api/admin/offices/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ delete_reason: resConfirm.reason })
    });
    if (res.published) broadcastDbSync();
    showToast(res.published ? 'Office deleted.' : 'Deletion queued for Reviewer approval.');
    window.refreshCurrentTab();
};
