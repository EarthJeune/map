/**
 * Shared Office Floor, Room Number, Office Name & Notes Normalizer
 * Auto-rewrites lowercase text, messy casing, abbreviations, and common typos
 * consistently on both server (Node CommonJS) and client if kept in sync.
 */

const STANDARD_FLOORS = ['Basement', 'Ground Floor', 'Second Floor'];

const KNOWN_ACRONYMS = new Set([
    'GSS', 'AFD', 'PMED', 'MIS', 'RAFIS', 'BAC', 'GAD', 'PPS', 'MNE', 'MES',
    'AMIA', 'CSO', 'ORED', 'RTD', 'RED', 'RAFC', 'HVCDP', 'FOD', 'NUPAP',
    'LARES', 'QARES', 'RARES', 'CARES', 'RCPC', 'AMAD', 'PRDP', 'ILD', 'F2C2',
    'PGRC', 'RSL', 'RSBSA', 'DRRM', 'R&D', 'HR', 'IT', 'COA', 'ISO', 'DA', 'ICT'
]);

const MINOR_WORDS = new Set(['of', 'and', 'for', 'in', 'on', 'the', 'at', 'to', 'by', 'or']);

const WORD_TYPO_MAP = {
    // Floor & room typos
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
    // Office / division / notes typos
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
    const low = core.toLowerCase();
    return WORD_TYPO_MAP[low] || core;
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

    if (KNOWN_ACRONYMS.has(upper)) {
        return lead + upper + trail;
    }
    // Roman numerals used cleanly for buildings/wings/floors
    if (/^(ii|iii|iv|v|vi|vii|viii|ix|x)$/i.test(fixedCore)) {
        return lead + upper + trail;
    }
    // Inside parentheses like (gss), (afd), (mis) -> uppercase short codes
    if (lead === '(' && trail.startsWith(')') && /^[a-z0-9&]{2,6}$/i.test(fixedCore)) {
        return lead + upper + trail;
    }
    if (forceUpperShort && (/^\d+[a-z]+$/i.test(fixedCore) || /^[a-z]\d+$/i.test(fixedCore) || /^[a-z]$/i.test(fixedCore))) {
        return lead + upper + trail;
    }
    if (!isFirst && MINOR_WORDS.has(low)) {
        return lead + low + trail;
    }
    // Ordinals like 3rd, 4th, 21st
    if (/^\d+(st|nd|rd|th)$/i.test(low)) {
        return lead + low + trail;
    }
    return lead + low.charAt(0).toUpperCase() + low.slice(1) + trail;
}

function normalizeFloorLabel(raw) {
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

function normalizeRoomNumber(raw) {
    const cleaned = cleanWhitespace(raw);
    if (!cleaned) return '';

    // Pure numeric / alphanumeric room code like "102", "204b", "101-a", "b12"
    if (/^(?:[a-zA-Z]?\d+[a-zA-Z0-9-]*|[bB]-?\d+[a-zA-Z]?)$/.test(cleaned)) {
        return `Room ${cleaned.toUpperCase()}`;
    }

    // Prefixed room code variants: "rm 102b", "rm.102", "rom 204", "rooom 105", "r00m 301", "#102"
    const rmMatch = cleaned.match(/^(?:r(?:oom|m|om|ooom|00m)\.?\s*#?\s*-?|#)\s*([a-z0-9][a-z0-9-]*)$/i);
    if (rmMatch && rmMatch[1]) {
        return `Room ${rmMatch[1].toUpperCase()}`;
    }

    return cleaned
        .split(' ')
        .map((tok, idx) => toTitleCaseToken(tok, idx === 0, true))
        .join(' ');
}

function normalizeOfficeName(raw) {
    const cleaned = cleanWhitespace(raw);
    if (!cleaned) return '';
    return cleaned
        .split(' ')
        .map((tok, idx) => toTitleCaseToken(tok, idx === 0, false))
        .join(' ');
}

function normalizeOfficeNotes(raw) {
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
            // Preserve intentional casing if word already has uppercase chars; keep lowercase otherwise
            if (fixed !== core) {
                const hadInitialCap = core[0] && core[0] === core[0].toUpperCase() && core[0] !== core[0].toLowerCase();
                return lead + (hadInitialCap ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed) + trail;
            }
            return tok;
        })
        .join(' ');

    return typoFixed.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_, prefix, ch) => prefix + ch.toUpperCase());
}

function normalizeOfficePayload(body = {}) {
    const out = { ...body };
    if (body.office_name !== undefined) {
        out.office_name = normalizeOfficeName(body.office_name);
    }
    if (body.floor_or_room !== undefined) {
        const fl = normalizeFloorLabel(body.floor_or_room);
        out.floor_or_room = fl || null;
    }
    if (body.room_number !== undefined) {
        const rm = normalizeRoomNumber(body.room_number);
        out.room_number = rm || null;
    }
    if (body.office_desc !== undefined) {
        const desc = normalizeOfficeNotes(body.office_desc);
        out.office_desc = desc || null;
    }
    return out;
}

module.exports = {
    STANDARD_FLOORS,
    normalizeFloorLabel,
    normalizeRoomNumber,
    normalizeOfficeName,
    normalizeOfficeNotes,
    normalizeOfficePayload
};

