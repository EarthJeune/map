// DA-LARES Building Offices & Operational Units Directory

export const BUILDING_OFFICES = {
    'tanco_hall_building': [
        'PMED Office of the Chief',
        'AMIA',
        'CSO',
        'GAD',
        'PPS',
        'MNE',
        'PMED',
        'BAC'
    ],
    'admin_building': [
        {
            floor: 'Ground Floor',
            offices: [
                'GSS',
                'PROPERTY',
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
                'Admin and Finance',
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
        'Rice',
        'HVCDP',
        'Organic Agriculture',
        'FOD / Nupap',
        'Halal / 4k',
        'Saad',
        'Sagip Saka',
        'Livestock'
    ],
    'raed_building': [
        'RAED Chief Office',
        'EPDSS',
        'PPMS',
        'SRES'
    ],
    'multi_purpose_administrative_building': [
        'FMR',
        'MIS Data Center',
        'BAC Extension Office'
    ],
    'rnd_building': {
        status: 'pending',
        message: 'Offices information pending update'
    }
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
export function renderBuildingOfficesHTML(buildingId) {
    const data = BUILDING_OFFICES[buildingId];
    if (!data) return '';

    if (data.status === 'pending') {
        return `
            <div class="bldg-offices-card">
                <div class="bldg-offices-header">
                    <span class="bldg-offices-icon">🏢</span>
                    <span class="bldg-offices-title">Offices & Units</span>
                </div>
                <div class="bldg-offices-pending">
                    <span class="pending-icon">⏳</span>
                    <span>${data.message || 'Offices information pending update'}</span>
                </div>
            </div>
        `;
    }

    if (!Array.isArray(data) || data.length === 0) return '';

    let contentHTML = '';

    // Check if offices are partitioned by floors
    const hasFloors = data.some(item => typeof item === 'object' && item.floor && Array.isArray(item.offices));

    if (hasFloors) {
        data.forEach(group => {
            if (typeof group === 'object' && group.floor && Array.isArray(group.offices)) {
                contentHTML += `
                    <div class="bldg-floor-group">
                        <div class="bldg-floor-header">
                            <span class="bldg-floor-badge">${group.floor}</span>
                            <span class="bldg-floor-count">${group.offices.length} offices</span>
                        </div>
                        <div class="bldg-offices-pills">
                            ${group.offices.map(off => `<div class="office-pill"><span class="op-dot"></span><span class="op-name">${off}</span></div>`).join('')}
                        </div>
                    </div>
                `;
            }
        });
    } else {
        contentHTML = `
            <div class="bldg-offices-pills">
                ${data.map(off => `<div class="office-pill"><span class="op-dot"></span><span class="op-name">${off}</span></div>`).join('')}
            </div>
        `;
    }

    const totalCount = getFlatBuildingOffices(buildingId).length;

    return `
        <div class="bldg-offices-card">
            <div class="bldg-offices-header">
                <div style="display:flex;align-items:center;gap:7px;">
                    <span class="bldg-offices-icon">🏢</span>
                    <span class="bldg-offices-title">Offices & Units</span>
                </div>
                <span class="bldg-offices-total">${totalCount} Total</span>
            </div>
            ${contentHTML}
        </div>
    `;
}
