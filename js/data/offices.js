// DA-LARES Building Offices & Operational Units Directory
import { lucideIcon } from './icons.js';

// Separate optional Room Number tags indexed by `${buildingId}::${officeName}`
export const OFFICE_ROOM_NUMBERS = {};

export const BUILDING_OFFICES = {
    'tanco_hall_building': [
        'PMED Office of the Chief',
        'AMIA',
        'Civil Society Organizations',
        'Gender and Development',
        'PPS',
        'MNE / MES',
        'PMED',
        'Bidding and Awards Committee'
    ],
    'admin_building': [
        {
            floor: 'Ground Floor',
            offices: [
                'General Services Section (GSS)',
                'Property',
                'Budget 1',
                'Budget 2',
                'Records',
                'Motorpool'
            ]
        },
        {
            floor: '2nd Floor',
            offices: [
                'Accounting',
                'Personnel',
                'Admin and Finance (AFD)',
                'Office of the Admin'
            ]
        }
    ],
    'ored_building': [
        'Cashier',
        'ORED Staff',
        'RTD for Research',
        'ORED Conference',
        'RTD for Operations',
        'RED Office'
    ],
    'lares_building': [
        'Office of the Center Chief',
        'RAFC',
        'Rice Program',
        'HVCDP',
        'Organic Agriculture Program',
        'FOD / NUPAP',
        'Halal / 4k',
        'SAAD',
        'Sagip Saka',
        'Livestock Program'
    ],
    'raed_building': [
        'RAED Chief Office',
        'EPDSS',
        'PPMS',
        'SRES'
    ],
    'multi_purpose_administrative_building': [
        'Farm to Market Road (FMR)',
        'MIS Data Center',
        'BAC Extension Office'
    ],
    'mis_rafis_building': [
        'Office of the Chief - MIS',
        'Office of the Chief - RAFIS'
    ],
    'rsbsa_building': [
        'RSBSA Operations Office',
        'DRRM'
    ],
    'rnd_building': [
        'Office of the Chief - Research Division',
        'R&D Conference Hall'
    ]
};

/**
 * Returns a flat list of office strings for search filtering
 */
export function getFlatBuildingOffices(buildingId) {
    const data = BUILDING_OFFICES[buildingId];
    if (!data) return [];
    if (data.status === 'pending') return [];
    if (Array.isArray(data)) {
        const flat = [];
        data.forEach(item => {
            if (typeof item === 'string') {
                flat.push(item);
            } else if (item && Array.isArray(item.offices)) {
                flat.push(...item.offices);
            }
        });
        return flat;
    }
    return [];
}

// Full-name & acronym search aliases for office badges
export const OFFICE_SEARCH_ALIASES = {
    // Tanco Hall Building
    'AMIA': [
        'Adaptation and Mitigation Initiative in Agriculture (AMIA)'
    ],
    'Civil Society Organizations': [
        'CSO',
        'Civil Society Organizations (CSO)'
    ],
    'Gender and Development': [
        'GAD',
        'Gender and Development (GAD)'
    ],
    'PPS': [
        'Planning and Programming Section (PPS)'
    ],
    'MNE / MES': [
        'Monitoring and Evaluation Section (MNE / MES)',
        'MNE',
        'MES',
        'MNE/MES'
    ],
    'PMED': [
        'Planning, Monitoring and Evaluation Division (PMED)'
    ],
    'Bidding and Awards Committee': [
        'BAC',
        'Bidding and Awards Committee (BAC)',
        'Bidding and Awards Comittee',
        'Bids and Awards Committee (BAC)'
    ],

    // Admin Building
    'General Services Section (GSS)': [
        'GSS',
        'General Services Section'
    ],
    'Admin and Finance (AFD)': [
        'Administrative and Finance Division (AFD)',
        'AFD'
    ],

    // ORED Building
    'ORED Staff': [
        'Office of the Regional Executive Director (ORED) Staff'
    ],
    'RTD for Research': [
        'Regional Technical Director (RTD) for Research'
    ],
    'ORED Conference': [
        'Office of the Regional Executive Director (ORED) Conference Hall'
    ],
    'RTD for Operations': [
        'Regional Technical Director (RTD) for Operations'
    ],
    'RED Office': [
        'Regional Executive Director (RED) Office',
        'Office of the Regional Executive Director (ORED)'
    ],

    // LARES Building
    'RAFC': [
        'Regional Agricultural and Fishery Council (RAFC)',
        'Regional Agricultural and Fisheries Council (RAFC)'
    ],
    'HVCDP': [
        'High Value Crops Development Program (HVCDP)'
    ],
    'FOD / NUPAP': [
        'Field Operations Division (FOD) / National Urban and Peri-Urban Agriculture Program (NUPAP)',
        'Field Operations Division (FOD)',
        'National Urban and Peri-Urban Agriculture Program (NUPAP)',
        'FOD /NUPAP',
        'FOD/NUPAP'
    ],
    'Halal / 4k': [
        'Halal Food Industry Development Program / 4k',
        'Halal Food Industry Development Program',
        'Kabuhayan at Kaunlaran ng Kababayang Katutubo (4K) Program'
    ],
    'SAAD': [
        'Special Area for Agricultural Development (SAAD) Program'
    ],

    // RAED Building
    'RAED Chief Office': [
        'Regional Agricultural Engineering Division (RAED) Chief Office'
    ],
    'EPDSS': [
        'Engineering Plans, Designs and Specifications Section (EPDSS)'
    ],
    'PPMS': [
        'Programs and Projects Management Section (PPMS)'
    ],
    'SRES': [
        'Standards Regulation and Enforcement Section (SRES)'
    ],

    // Multi-Purpose Administrative Building
    'Farm to Market Road (FMR)': [
        'Farm-to-Market Road (FMR) Development Program'
    ],
    'MIS Data Center': [
        'Management Information Systems (MIS) Data Center',
        'Management Information System (MIS) Data Center'
    ],
    'BAC Extension Office': [
        'Bidding and Awards Committee (BAC) Extension Office',
        'Bids and Awards Committee (BAC) Extension Office'
    ],

    // MIS / RAFIS Building
    'Office of the Chief - MIS': [
        'Management Information Systems (MIS) — Office of the Chief',
        'Management Information System (MIS)'
    ],
    'Office of the Chief - RAFIS': [
        'Regional Agriculture and Fisheries Information Section (RAFIS) — Office of the Chief',
        'Regional Agricultural and Fisheries Information Section (RAFIS)'
    ],

    // RSBSA Building
    'RSBSA Operations Office': [
        'Registry System for Basic Sectors in Agriculture (RSBSA) Operations Office'
    ],
    'DRRM': [
        'Disaster Risk Reduction and Management (DRRM)'
    ],

    // R&D Multipurpose Building
    'Office of the Chief - Research Division': [
        'Research and Development (R&D) Division — Office of the Chief'
    ],
    'R&D Conference Hall': [
        'Research and Development (R&D) Conference Hall',
        'RnD Conference Hall'
    ]
};

// Full-name & acronym search aliases for campus buildings (including standalone facilities)
// Note: Index 0 is the canonical display badge ("ACRONYM — Full Official Meaning") shown when a building matches via full-name/acronym search.
export const BUILDING_SEARCH_ALIASES = {
    'ored_building': [
        'ORED — Office of the Regional Executive Director',
        'Office of the Regional Executive Director (ORED)',
        'Regional Executive Director (RED)'
    ],
    'admin_building': [
        'Administrative Building',
        'Administrative & Finance Division (AFD)',
        'Admin Building',
        'AFD'
    ],
    'amad_building': [
        'AMAD — Agribusiness and Marketing Assistance Division',
        'Agribusiness and Marketing Assistance Division (AMAD)',
        'Agri-Business and Marketing Assistance Division'
    ],
    'lares_building': [
        'LARES — Lipa Agricultural Research & Experiment Station',
        'Lipa Agricultural Research & Experiment Station (LARES)'
    ],
    'ild_building': [
        'ILD — Integrated Laboratories Division',
        'Integrated Laboratories Division (ILD)',
        'Integrated Laboratory Division (ILD)'
    ],
    'f2c2_building': [
        'F2C2 — Farm and Fisheries Clustering and Consolidation Program',
        'Farm and Fisheries Clustering and Consolidation (F2C2) Program',
        'Farm and Fishery Clustering and Consolidation Program',
        'Farmers and Fisherfolk Clustering and Consolidation (F2C2)'
    ],
    'seaguard_building': [
        'CGUARD — Corn Germplasm Utilization through Advanced Research and Development',
        'Corn Germplasm Utilization through Advanced Research and Development (CGUARD)',
        'CALABARZON CGUARD Crop Research & Varietal Laboratory',
        'CGUARD',
        'C-GUARD'
    ],
    'raed_building': [
        'RAED — Regional Agricultural Engineering Division',
        'Regional Agricultural Engineering Division (RAED)'
    ],
    'canteen': [
        'DA Canteen — Department of Agriculture Canteen',
        'Department of Agriculture Canteen'
    ],
    'tanco_hall_building': [
        'PMED — Planning, Monitoring and Evaluation Division',
        'Planning, Monitoring and Evaluation Division (PMED)',
        'Arturo R. Tanco Hall'
    ],
    'mis_rafis_building': [
        'MIS / RAFIS — Management Information Systems & Regional Agriculture and Fisheries Information Section',
        'Management Information Systems (MIS)',
        'Management Information System (MIS)',
        'Regional Agriculture and Fisheries Information Section (RAFIS)',
        'Regional Agricultural and Fisheries Information Section (RAFIS)',
        'Information and Communications Technology Service (ICTS)'
    ],
    'rnd_building': [
        'R&D — Research and Development Multipurpose Building',
        'Research and Development (R&D) Multipurpose Building',
        'RnD Multipurpose Building'
    ],
    'laboratory_building': [
        'DA-BAR — Bureau of Agricultural Research Post-Harvest Facility',
        'Post-Harvest Laboratory Building',
        'Bureau of Agricultural Research (DA-BAR) Post-Harvest Facility'
    ],
    'prdp_building': [
        'PRDP — Philippine Rural Development Project Scale-Up (RPCO 4A)',
        'Philippine Rural Development Project (PRDP) Scale-Up',
        'Philippine Rural Development Program (PRDP)',
        'Regional Project Coordination Office 4A (RPCO 4A)',
        'RPCO IVA',
        'Intensified Building Up of Infrastructure and Logistics for Development (I-BUILD)',
        'Investments in Rural Enterprises and Agriculture and Fisheries Productivity (I-REAP)',
        'I-BUILD',
        'I-REAP',
        'I-PLAN',
        'I-SUPPORT'
    ],
    'multi_purpose_administrative_building': [
        'MPAB — Multi-Purpose Administrative Building (FMR)',
        'Farm to Market Road (FMR) Development Program',
        'MPAB'
    ],
    'pgrc_building': [
        'PGRC — Plant Genetic Resources Center',
        'Plant Genetic Resources Center (PGRC)',
        'Plant Genetic Resource Center (PGRC)'
    ],
    'corn/casava_building': [
        'Office of the Regional Corn and Cassava Program',
        'Corn and Casava Facility'
    ],
    'rsbsa_building': [
        'RSBSA — Registry System for Basic Sectors in Agriculture',
        'Registry System for Basic Sectors in Agriculture (RSBSA)',
        'Registry System for the Basic Sectors in Agriculture (RSBSA)'
    ],
    'tissue_culture_building': [
        'TC — Tissue Culture Laboratory',
        'TC Laboratory',
        'Plant Tissue Culture (TC) Laboratory'
    ],
    'rsl_building': [
        'RSL — Regional Soils Laboratory',
        'Regional Soils Laboratory (RSL)',
        'Regional Soil Laboratory (RSL)',
        'RSL Building'
    ],
    'rcpc_building': [
        'RCPC — Regional Crop Protection Center CALABARZON',
        'Regional Crop Protection Center (RCPC) CALABARZON',
        'Regional Crop Protection Centre (RCPC)'
    ],
    'automated_weather_station': [
        'AWS — Automated Weather Station',
        'Automated Weather Station (AWS)',
        'Agrometeorological Weather Station',
        'AWS'
    ],
    'plot22_comfort_room': [
        'Plot 22 Comfort Room',
        'CR — Comfort Room',
        'Comfort Room (CR)',
        'CR',
        'Restroom'
    ],
    'plot22_water_tank': [
        'LARES — Lipa Agricultural Research & Experiment Station Water Tank',
        'Lipa Agricultural Research & Experiment Station (LARES) Water Tank'
    ],
    'lares_agricultural_supplies_storage': [
        'LARES — Lipa Agricultural Research & Experiment Station Supplies Storage',
        'Lipa Agricultural Research & Experiment Station (LARES) Agricultural Supplies Storage'
    ],
    'warehouse_1': [
        'LARES — Lipa Agricultural Research & Experiment Station Fertilizer & Pesticide Storage',
        'Lipa Agricultural Research & Experiment Station (LARES) Synthetic Fertilizer & Pesticide Storage'
    ],
    'lares_farm_machinery_shed_1': [
        'LARES — Lipa Agricultural Research & Experiment Station Farm Machinery Shed 1',
        'Lipa Agricultural Research & Experiment Station (LARES) Farm Machinery Shed 1'
    ],
    'lares_organic_fertilizer_storage': [
        'LARES — Lipa Agricultural Research & Experiment Station Organic Fertilizer Storage',
        'Lipa Agricultural Research & Experiment Station (LARES) Organic Fertilizer Storage'
    ],
    'warehouse_3': [
        'LARES — Lipa Agricultural Research & Experiment Station Corn Seed Processing',
        'Lipa Agricultural Research & Experiment Station (LARES) Corn Seed Processing Facility'
    ],
    'warehouse_4': [
        'LARES — Lipa Agricultural Research & Experiment Station Farm Machinery Shed 2',
        'Lipa Agricultural Research & Experiment Station (LARES) Farm Machinery Shed 2'
    ]
};

// Full-name & acronym search aliases for commodity plot zones
export const PLOT_ZONE_SEARCH_ALIASES = {
    'zone_tc_makapuno_screenhouse': [
        'Tissue Culture Makapuno & Banana Screenhouse',
        'Tissue-Cultured Makapuno & Banana Screenhouse',
        'TC'
    ],
    'zone_cguard_corn': [
        'Corn Germplasm Utilization through Advanced Research and Development (CGUARD) Corn',
        'CALABARZON CGUARD Corn',
        'C-GUARD Corn'
    ]
};

const SEARCH_STOPWORDS = new Set([
    'the', 'of', 'for', 'and', 'in', 'to', 'at', 'on', 'by', 'through', 'with', 'a', 'an'
]);

function stemSearchWord(w) {
    if (!w || w.length < 4) return w;
    if (w.length === 4) return w;
    return w
        .replace(/ultural$/, 'ultur')
        .replace(/ulture$/, 'ultur')
        .replace(/ories$/, 'ory')
        .replace(/ies$/, 'y')
        .replace(/s$/, '');
}

export function matchesSearchText(text, rawQuery) {
    if (!text || !rawQuery) return false;
    const normQuery = String(rawQuery).trim().toLowerCase();
    const normText = String(text).trim().toLowerCase();
    if (!normText || !normQuery) return false;

    // 1. Exact match (case-insensitive)
    if (normText === normQuery) return true;

    // 2. Non-alphanumeric acronym tokens like "r&d"
    if (/[^a-z0-9\s]/.test(normQuery) && normQuery.length >= 2 && normText.includes(normQuery)) {
        return true;
    }

    // 3. Word-prefix match (handles 1–3 char acronyms like TC, CR, AWS, RED, RSL, ILD, MIS, FMR, GAD, CSO, PPS, BAC, 4K cleanly without mid-word false positives)
    const words = normText.split(/[\s/,\-_()|•—–&]+/).filter(Boolean);
    if (words.some(w => w.startsWith(normQuery))) return true;

    // 4. Multi-character / phrase / stem-normalized matching (>= 4 chars)
    if (normQuery.length >= 4) {
        if (normText.includes(normQuery)) return true;

        const cleanQuery = normQuery.replace(/[\s/,\-_()|•—–&]+/g, ' ').trim();
        if (cleanQuery.length >= 3) {
            const cleanText = normText.replace(/[\s/,\-_()|•—–&]+/g, ' ').trim();
            if (cleanText.includes(cleanQuery)) return true;

            // Match when mid-phrase parenthetical acronyms like "(RTD)" or "(SAAD)" are omitted by the user
            const strippedParens = normText
                .replace(/\([^)]*\)/g, ' ')
                .replace(/[\s/,\-_()|•—–&]+/g, ' ')
                .trim();
            if (strippedParens.includes(cleanQuery)) return true;

            // Single-word stem match (e.g. "laboratories" <-> "laboratory", "agricultural" <-> "agriculture", "soils" <-> "soil")
            // Guard: target stem `sw` must be >= 4 chars (and not a stopword) so short words like "in"/"of"/"for" NEVER match "information"/"office"/"forest"!
            const rawTokens = cleanQuery.split(' ').filter(Boolean);
            const stemmedWords = words.map(stemSearchWord);
            if (rawTokens.length === 1) {
                const sq = stemSearchWord(rawTokens[0]);
                if (sq.length >= 4 && stemmedWords.some(sw =>
                    sw.length >= 4 && !SEARCH_STOPWORDS.has(sw) && (sw.startsWith(sq) || (sq.startsWith(sw) && (sq.length - sw.length) <= 3))
                )) {
                    return true;
                }
            }

            // 5. Multi-word token matching (ignores minor articles/prepositions like "the"/"for"/"through" and normalizes singular/plural stems)
            if (rawTokens.length >= 2) {
                const contentTokens = rawTokens.filter(t => !SEARCH_STOPWORDS.has(t));
                const tokensToCheck = contentTokens.length > 0 ? contentTokens : rawTokens;
                const allTokensMatch = tokensToCheck.every(tok => {
                    if (words.some(w => w.startsWith(tok))) return true;
                    if (tok.length >= 4 && cleanText.includes(tok)) return true;
                    const st = stemSearchWord(tok);
                    if (st.length >= 4 && stemmedWords.some(sw =>
                        sw.length >= 4 && !SEARCH_STOPWORDS.has(sw) && (sw.startsWith(st) || (st.startsWith(sw) && (st.length - sw.length) <= 3))
                    )) return true;
                    return false;
                });
                if (allTokensMatch) return true;
            }
        }
    }

    return false;
}

function matchesSingleOfficeText(text, normQuery) {
    return matchesSearchText(text, normQuery);
}

/**
 * Determines if an office name (or any of its full-name search aliases) matches the target or search query
 */
export function isOfficeMatched(officeName, targetOrQuery) {
    if (!officeName || !targetOrQuery) return false;
    const normQuery = String(targetOrQuery).trim().toLowerCase();
    if (!normQuery) return false;

    if (matchesSingleOfficeText(officeName, normQuery)) return true;

    const aliases = OFFICE_SEARCH_ALIASES[officeName];
    if (Array.isArray(aliases) && aliases.some(alias => matchesSingleOfficeText(alias, normQuery))) {
        return true;
    }

    return false;
}

/**
 * Finds the best-matching office within a building (or flat office list), ranking exact and more specific matches ahead of broader sibling aliases
 */
export function findMatchedOffice(buildingIdOrOffices, query) {
    const normQuery = String(query || '').trim().toLowerCase();
    if (!normQuery) return null;

    const flatOffices = Array.isArray(buildingIdOrOffices)
        ? buildingIdOrOffices
        : getFlatBuildingOffices(buildingIdOrOffices);

    let bestOffice = null;
    let bestScore = -Infinity;

    for (const off of flatOffices) {
        if (!off) continue;
        const normOff = String(off).trim().toLowerCase();
        let score = -Infinity;

        if (normOff === normQuery) {
            score = 1000;
        } else if (matchesSingleOfficeText(off, normQuery)) {
            score = 800 - normOff.length;
        } else {
            const aliases = OFFICE_SEARCH_ALIASES[off];
            if (Array.isArray(aliases)) {
                for (const alias of aliases) {
                    if (!matchesSingleOfficeText(alias, normQuery)) continue;
                    const normAlias = String(alias).trim().toLowerCase();
                    const strippedAlias = normAlias.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
                    const aliasScore = (normAlias === normQuery || strippedAlias === normQuery)
                        ? 600
                        : (400 - normAlias.length);
                    if (aliasScore > score) score = aliasScore;
                }
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestOffice = off;
        }
    }

    return bestOffice;
}

/**
 * Returns display label for directory search tag (appends full name when matched via alias)
 */
export function getOfficeSearchSubtitle(officeName, query) {
    if (!officeName) return '';
    const normQuery = String(query || '').trim().toLowerCase();
    if (!normQuery || matchesSingleOfficeText(officeName, normQuery)) {
        return officeName;
    }
    const aliases = OFFICE_SEARCH_ALIASES[officeName];
    if (Array.isArray(aliases) && aliases.length > 0 && aliases.some(alias => matchesSingleOfficeText(alias, normQuery))) {
        return `${officeName} — ${aliases[0]}`;
    }
    return officeName;
}

/**
 * Determines if a building matches the search query across its name, description, or full-name/acronym aliases
 */
export function isBuildingMatched(building, query) {
    if (!building || !query) return false;
    const normQuery = String(query).trim().toLowerCase();
    if (!normQuery) return true;

    if (matchesSearchText(building.name, normQuery)) return true;
    if (building.desc && matchesSearchText(building.desc, normQuery)) return true;
    if (building.type && matchesSearchText(building.type, normQuery)) return true;
    if (building.compactTag && matchesSearchText(building.compactTag, normQuery)) return true;
    if (building.visualLandmark && matchesSearchText(building.visualLandmark, normQuery)) return true;
    if (building.keyServices && matchesSearchText(building.keyServices, normQuery)) return true;

    const aliases = BUILDING_SEARCH_ALIASES[building.id];
    if (Array.isArray(aliases) && aliases.some(alias => matchesSearchText(alias, normQuery))) {
        return true;
    }

    return false;
}

/**
 * Escapes HTML special characters for safe template rendering
 */
export function escapeSearchHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeRegexChars(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlights matching search query terms inside plain text with <mark class="search-match-mark">.
 * Applies safe HTML escaping before/around matches and uses whole-word guards for 1-2 char alphanumeric queries.
 */
export function highlightSearchTermsHtml(text, rawQuery = '') {
    const str = String(text ?? '');
    if (!str) return '';
    const trimmed = String(rawQuery || '').trim();
    if (!trimmed) return escapeSearchHtml(str);

    const candidateTerms = [trimmed];
    const tokens = trimmed
        .toLowerCase()
        .split(/[\s/&()\-+,.:;]+/)
        .map(t => t.trim())
        .filter(Boolean);
    for (const tok of tokens) {
        if (!candidateTerms.some(c => c.toLowerCase() === tok)) {
            candidateTerms.push(tok);
        }
    }

    // Sort longest first so full-phrase match takes priority over individual words
    candidateTerms.sort((a, b) => b.length - a.length);

    const patterns = candidateTerms
        .map(term => {
            const esc = escapeRegexChars(term);
            if (!esc) return '';
            // Guard 1-2 character alphanumeric terms with word boundaries to avoid noisy mid-word highlights
            if (term.length <= 2 && /^[a-z0-9]+$/i.test(term)) {
                return `\\b${esc}\\b`;
            }
            return esc;
        })
        .filter(Boolean);

    if (patterns.length === 0) return escapeSearchHtml(str);

    const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
    let out = '';
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(str)) !== null) {
        if (match[0].length === 0) {
            regex.lastIndex++;
            continue;
        }
        if (match.index > lastIndex) {
            out += escapeSearchHtml(str.slice(lastIndex, match.index));
        }
        out += `<mark class="search-match-mark">${escapeSearchHtml(match[0])}</mark>`;
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
        out += escapeSearchHtml(str.slice(lastIndex));
    }
    return out;
}

/**
 * Extracts a concise window centered around the first matching search phrase/token.
 */
function extractMatchedSnippet(rawText, query, maxLen = 92) {
    const clean = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    if (clean.length <= maxLen) return clean;

    const lowerClean = clean.toLowerCase();
    const normQuery = String(query || '').trim().toLowerCase();
    let matchIdx = normQuery ? lowerClean.indexOf(normQuery) : -1;
    let matchLen = normQuery.length;

    if (matchIdx === -1 && normQuery) {
        const tokens = normQuery.split(/[\s/&()\-+,.:;]+/).filter(Boolean);
        for (const tok of tokens) {
            const idx = lowerClean.indexOf(tok);
            if (idx !== -1) {
                matchIdx = idx;
                matchLen = tok.length;
                break;
            }
        }
    }

    if (matchIdx === -1) {
        return clean.slice(0, maxLen - 1).trimEnd() + '…';
    }

    const halfPad = Math.max(20, Math.floor((maxLen - matchLen) / 2));
    let start = Math.max(0, matchIdx - halfPad);
    let end = Math.min(clean.length, start + maxLen);
    if (end - start < maxLen) {
        start = Math.max(0, end - maxLen);
    }

    // Snap outward/inward to clean word boundaries when truncating
    if (start > 0) {
        const nextSpace = clean.indexOf(' ', start);
        if (nextSpace !== -1 && nextSpace < matchIdx) {
            start = nextSpace + 1;
        }
    }
    if (end < clean.length) {
        const prevSpace = clean.lastIndexOf(' ', end);
        if (prevSpace > matchIdx + matchLen) {
            end = prevSpace;
        }
    }

    let snippet = clean.slice(start, end).trim();
    if (start > 0) snippet = '…' + snippet;
    if (end < clean.length) snippet += '…';
    return snippet;
}

/**
 * Returns full-name, alias, or matched context snippet (Description / Services / Landmark) when a building matches via metadata rather than its display title
 */
export function getBuildingSearchSubtitle(building, query, wayfindingInfo = null) {
    if (!building || !query) return '';
    const normQuery = String(query).trim().toLowerCase();
    if (!normQuery || matchesSearchText(building.name, normQuery)) return '';

    const aliases = BUILDING_SEARCH_ALIASES[building.id];
    if (Array.isArray(aliases) && aliases.length > 0) {
        if (matchesSearchText(aliases[0], normQuery)) {
            return aliases[0];
        }
        const matchedAlias = aliases.find(alias => matchesSearchText(alias, normQuery));
        if (matchedAlias) {
            return matchedAlias.length <= 8 ? aliases[0] : matchedAlias;
        }
    }

    const compactTag = building.compactTag || (wayfindingInfo && wayfindingInfo.compactTag) || '';
    if (compactTag && matchesSearchText(compactTag, normQuery)) {
        return compactTag;
    }

    if (building.type && matchesSearchText(building.type, normQuery)) {
        return building.type;
    }

    if (building.desc && matchesSearchText(building.desc, normQuery)) {
        const descParts = building.desc.split('|').map(p => p.trim()).filter(Boolean);
        const matchedPart = descParts.find(p => matchesSearchText(p, normQuery));
        return extractMatchedSnippet(matchedPart || building.desc, normQuery, 92);
    }

    const keyServices = building.keyServices || (wayfindingInfo && wayfindingInfo.keyServices) || '';
    if (keyServices && matchesSearchText(keyServices, normQuery)) {
        return 'Services: ' + extractMatchedSnippet(keyServices, normQuery, 88);
    }

    const visualLandmark = building.visualLandmark || (wayfindingInfo && wayfindingInfo.visualLandmark) || '';
    if (visualLandmark && matchesSearchText(visualLandmark, normQuery)) {
        return 'Landmark: ' + extractMatchedSnippet(visualLandmark, normQuery, 88);
    }

    return '';
}

/**
 * Scores a building match for search ranking (Title/Number > Office > Alias > Type/Tag > Description > Services > Landmark)
 */
export function getBuildingSearchRelevanceScore(building, query, matchedOffice = null, wayfindingInfo = null) {
    if (!building || !query) return 0;
    const normQuery = String(query).trim().toLowerCase();
    if (!normQuery) return 0;

    const normName = String(building.name || '').trim().toLowerCase();
    const numStr = building.num !== null && building.num !== undefined ? String(building.num).toLowerCase() : '';

    if (normName === normQuery || (numStr && (numStr === normQuery || `#${numStr}` === normQuery))) {
        return 1000;
    }
    if (normName.startsWith(normQuery)) {
        return 920;
    }
    if (matchesSearchText(building.name, normQuery)) {
        return 860;
    }
    if (matchedOffice) {
        return matchesSearchText(matchedOffice, normQuery) ? 760 : 720;
    }
    const aliases = BUILDING_SEARCH_ALIASES[building.id];
    if (Array.isArray(aliases) && aliases.some(alias => matchesSearchText(alias, normQuery))) {
        return 640;
    }
    const compactTag = building.compactTag || (wayfindingInfo && wayfindingInfo.compactTag) || '';
    if ((compactTag && matchesSearchText(compactTag, normQuery)) || (building.type && matchesSearchText(building.type, normQuery))) {
        return 520;
    }
    if (building.desc && matchesSearchText(building.desc, normQuery)) {
        return 420;
    }
    const keyServices = building.keyServices || (wayfindingInfo && wayfindingInfo.keyServices) || '';
    if (keyServices && matchesSearchText(keyServices, normQuery)) {
        return 320;
    }
    const visualLandmark = building.visualLandmark || (wayfindingInfo && wayfindingInfo.visualLandmark) || '';
    if (visualLandmark && matchesSearchText(visualLandmark, normQuery)) {
        return 220;
    }
    return 100;
}

/**
 * Scores a commodity plot zone match for search ranking (Name > Sub-plot/Range > Alias/Crop > Description)
 */
export function getPlotSearchRelevanceScore(zone, query) {
    if (!zone || !query) return 0;
    const normQuery = String(query).trim().toLowerCase();
    if (!normQuery) return 0;

    const normName = String(zone.name || '').trim().toLowerCase();
    if (normName === normQuery) return 1000;
    if (normName.startsWith(normQuery)) return 920;
    if (matchesSearchText(zone.name, normQuery)) return 860;
    if (zone.plotRange && matchesSearchText(zone.plotRange, normQuery)) return 760;
    if (Array.isArray(zone.subPlots) && zone.subPlots.some(sp =>
        (sp.label && matchesSearchText(sp.label, normQuery)) ||
        (sp.name && matchesSearchText(sp.name, normQuery)) ||
        (sp.crop && matchesSearchText(sp.crop, normQuery))
    )) {
        return 720;
    }
    const aliases = PLOT_ZONE_SEARCH_ALIASES[zone.id];
    if (Array.isArray(aliases) && aliases.some(alias => matchesSearchText(alias, normQuery))) {
        return 640;
    }
    if (zone.currentCrop && matchesSearchText(zone.currentCrop, normQuery)) return 560;
    if (zone.description && matchesSearchText(zone.description, normQuery)) return 420;
    return 100;
}

/**
 * Returns the best explanatory subtitle snippet for a matched plot zone in search cards
 */
export function getPlotSearchSubtitle(zone, query) {
    if (!zone) return '';
    const normQuery = String(query || '').trim().toLowerCase();
    if (!normQuery) return zone.description || '';

    if (zone.description && matchesSearchText(zone.description, normQuery)) {
        return extractMatchedSnippet(zone.description, normQuery, 96);
    }
    if (Array.isArray(zone.subPlots)) {
        const matchedSp = zone.subPlots.find(sp =>
            (sp.label && matchesSearchText(sp.label, normQuery)) ||
            (sp.name && matchesSearchText(sp.name, normQuery)) ||
            (sp.crop && matchesSearchText(sp.crop, normQuery))
        );
        if (matchedSp) {
            const label = matchedSp.label || matchedSp.name || `Plot ${matchedSp.plotNum}`;
            return `Sub-Plot: ${label}`;
        }
    }
    if (zone.currentCrop && matchesSearchText(zone.currentCrop, normQuery)) {
        return `Crop: ${zone.currentCrop}`;
    }
    const aliases = PLOT_ZONE_SEARCH_ALIASES[zone.id];
    if (Array.isArray(aliases)) {
        const matchedAlias = aliases.find(alias => matchesSearchText(alias, normQuery));
        if (matchedAlias) return matchedAlias;
    }
    return zone.description || '';
}

/**
 * Determines if a commodity plot zone matches the search query (including full-name/acronym aliases)
 */
export function isPlotZoneMatched(zone, query) {
    if (!zone || !query) return false;
    const normQuery = String(query).trim().toLowerCase();
    if (!normQuery) return true;

    if (matchesSearchText(zone.name, normQuery)) return true;
    if (zone.description && matchesSearchText(zone.description, normQuery)) return true;
    if (zone.plotRange && matchesSearchText(zone.plotRange, normQuery)) return true;
    if (zone.currentCrop && matchesSearchText(zone.currentCrop, normQuery)) return true;

    const aliases = PLOT_ZONE_SEARCH_ALIASES[zone.id];
    if (Array.isArray(aliases) && aliases.some(alias => matchesSearchText(alias, normQuery))) {
        return true;
    }

    if (Array.isArray(zone.subPlots) && zone.subPlots.some(sp =>
        (sp.name && matchesSearchText(sp.name, normQuery)) ||
        (sp.label && matchesSearchText(sp.label, normQuery)) ||
        (sp.crop && matchesSearchText(sp.crop, normQuery))
    )) {
        return true;
    }

    return false;
}

/**
 * Determines if an office or room is a conference venue / hall
 */
export function isConferenceRoom(officeName) {
    if (!officeName) return false;
    const lower = String(officeName).trim().toLowerCase();
    return lower.includes('conference') || lower.includes('hall') || lower.includes('auditorium');
}

/**
 * Determines if an office matches any currently active filter category
 */
export function isOfficeMatchedByFilter(officeName, activeFilters) {
    if (!officeName || !activeFilters || activeFilters.size === 0) return false;
    const lower = String(officeName).trim().toLowerCase();

    // 1. Conference Hall filter: highlights any conference hall or meeting room
    if (activeFilters.has('conference') && isConferenceRoom(officeName)) {
        return true;
    }

    // 2. Office Buildings filter: in mixed buildings (e.g. RSBSA, ORED, R&D), highlights administrative offices
    if (activeFilters.has('office') && !activeFilters.has('conference') && !isConferenceRoom(officeName)) {
        return true;
    }

    // 3. Laboratory filter
    if (activeFilters.has('laboratory') && (lower.includes('lab') || lower.includes('research') || lower.includes('experiment'))) {
        return true;
    }

    return false;
}

/**
 * Checks if a building has any registered offices
 */
export function hasBuildingOffices(buildingId) {
    const data = BUILDING_OFFICES[buildingId];
    if (!data) return false;
    if (data.status === 'pending') return true;
    if (Array.isArray(data)) return data.length > 0;
    return false;
}

/**
 * Generates semantic HTML for office listing in Kiosk and Mobile drawers
 */
export function renderBuildingOfficesHTML(buildingId, highlightQuery = '') {
    const data = BUILDING_OFFICES[buildingId];
    if (!data) return '';

    if (data.status === 'pending') {
        return `
            <div class="bldg-offices-card">
                <div class="bldg-offices-header">
                    <span class="bldg-offices-icon">${lucideIcon('building-2', 14)}</span>
                    <span class="bldg-offices-title">Offices & Units</span>
                </div>
                <div class="bldg-offices-pending">
                    <span class="pending-icon">${lucideIcon('building-2', 14)}</span>
                    <span>${highlightSearchTermsHtml(data.message || 'Offices information pending update', highlightQuery)}</span>
                </div>
            </div>
        `;
    }

    if (!Array.isArray(data) || data.length === 0) return '';

    // Determine active type filters from global state or window
    const activeFilters = (typeof window !== 'undefined' && window.activeTypeFilters) ? window.activeTypeFilters : null;
    const hasTypeFilters = !!(activeFilters && activeFilters.size > 0);

    // Determine effective search query if not explicitly passed
    let activeQuery = (highlightQuery || '').trim();
    if (!activeQuery && typeof document !== 'undefined') {
        const inputVal = (document.getElementById('search-input')?.value || document.getElementById('phone-search-input')?.value || '').trim();
        if (inputVal) {
            const flat = getFlatBuildingOffices(buildingId);
            if (flat.some(off => isOfficeMatched(off, inputVal))) {
                activeQuery = inputVal;
            }
        }
    }

    let contentHTML = '';

    const escapePillHtml = escapeSearchHtml;

    const renderOfficePill = (off) => {
        const isMatchedByQuery = Boolean(activeQuery && isOfficeMatched(off, activeQuery));
        const isMatchedByFilter = Boolean(hasTypeFilters && isOfficeMatchedByFilter(off, activeFilters));
        const isMatched = isMatchedByQuery || isMatchedByFilter;
        const isConf = isConferenceRoom(off);
        const pillIcon = isConf ? lucideIcon('landmark', 13) : '';
        const fullTitle = (OFFICE_SEARCH_ALIASES[off] && OFFICE_SEARCH_ALIASES[off][0])
            ? ` title="${escapePillHtml(OFFICE_SEARCH_ALIASES[off][0])}"`
            : '';
        const roomTag = OFFICE_ROOM_NUMBERS[`${buildingId}::${off}`];
        const roomBadge = roomTag ? `<span class="office-room-tag">${escapePillHtml(roomTag)}</span>` : '';
        const nameHtml = isMatchedByQuery ? highlightSearchTermsHtml(off, activeQuery) : escapePillHtml(off);
        return `<div class="office-pill ${isMatched ? 'highlighted' : ''} ${isConf ? 'is-conference' : ''}"${fullTitle}><span class="op-dot"></span>${pillIcon ? `<span class="op-pill-icon">${pillIcon}</span>` : ''}<span class="op-name">${nameHtml}</span>${roomBadge}</div>`;
    };

    // Check if offices are partitioned by floors
    const hasFloors = data.some(item => typeof item === 'object' && item.floor && Array.isArray(item.offices));

    if (hasFloors) {
        data.forEach(group => {
            if (typeof group === 'object' && group.floor && Array.isArray(group.offices)) {
                contentHTML += `
                    <div class="bldg-floor-group">
                        <div class="bldg-floor-header">
                            <span class="bldg-floor-badge">${escapePillHtml(group.floor)}</span>
                            <span class="bldg-floor-count">${group.offices.length} offices</span>
                        </div>
                        <div class="bldg-offices-pills">
                            ${group.offices.map(renderOfficePill).join('')}
                        </div>
                    </div>
                `;
            }
        });
    } else {
        contentHTML = `
            <div class="bldg-offices-pills">
                ${data.map(renderOfficePill).join('')}
            </div>
        `;
    }

    const totalCount = getFlatBuildingOffices(buildingId).length;

    return `
        <div class="bldg-offices-card">
            <div class="bldg-offices-header">
                <div style="display:flex;align-items:center;gap:7px;">
                    <span class="bldg-offices-icon">${lucideIcon('building-2', 14)}</span>
                    <span class="bldg-offices-title">Offices & Units</span>
                </div>
                <span class="bldg-offices-total">${totalCount} Total</span>
            </div>
            ${contentHTML}
        </div>
    `;
}
