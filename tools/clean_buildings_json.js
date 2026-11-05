const fs = require('fs');
const path = require('path');

const buildingsJsonPath = path.join(__dirname, '..', 'buildings.json');
const buildingsJsPath = path.join(__dirname, '..', 'js', 'data', 'buildings.js');

const rawData = JSON.parse(fs.readFileSync(buildingsJsonPath, 'utf8'));

const CANONICAL_UPDATES = {
    30: { id: 'plot17_screenhouse_1', name: 'Plot 17 Screenhouse 1', category: 'trial_sites', isSubPlot: true, hasMarker: false },
    31: { id: 'plot17_screenhouse_2', name: 'Plot 17 Screenhouse 2', category: 'trial_sites', isSubPlot: true, hasMarker: false },
    32: { id: 'plot17_screenhouse_3', name: 'Plot 17 Screenhouse 3', category: 'trial_sites', isSubPlot: true, hasMarker: false },
    33: { id: 'plot17_screenhouse_4', name: 'Plot 17 Screenhouse 4', category: 'trial_sites', isSubPlot: true, hasMarker: false },
    34: { id: 'plot17_screenhouse_5', name: 'Plot 17 Screenhouse 5', category: 'trial_sites', isSubPlot: true, hasMarker: false },
    35: { id: 'plot18_greenhouse_complex', name: 'Plot 18 Research Greenhouse Complex', category: 'trial_sites', isSubPlot: true, hasMarker: false },
    36: { id: 'plot18_screenhouse_9', name: 'Screenhouse 9 & Potting Headhouse', category: 'trial_sites', isSubPlot: true, hasMarker: false },
    37: { id: 'plot18_screenhouse_9_headhouse', name: 'Screenhouse 9 Headhouse', category: 'trial_sites', isSubPlot: true, hasMarker: false },
    38: { id: 'warehouse_1', name: 'Warehouse 1 (Abono)', category: 'infrastructure', isSubPlot: false, hasMarker: true },
    39: { id: 'warehouse_2', name: 'Warehouse 2 (Organic Fertilizer)', category: 'infrastructure', isSubPlot: false, hasMarker: true },
    40: { id: 'warehouse_3', name: 'Warehouse 3 (Seed Production & Packing)', category: 'infrastructure', isSubPlot: false, hasMarker: true },
    41: { id: 'warehouse_4', name: 'Warehouse 4 (Tractor & Machinery Shed)', category: 'infrastructure', isSubPlot: false, hasMarker: true },
    42: { id: 'warehouse_5', name: 'Warehouse 5 (Main Storage & Logistics)', category: 'infrastructure', isSubPlot: false, hasMarker: true },
    43: { id: 'warehouse_6', name: 'Warehouse 6 (Seed Dryer Shed)', category: 'infrastructure', isSubPlot: false, hasMarker: true },
    44: { id: 'warehouse_7', name: 'Warehouse 7 (Rice Seed Warehouse & Annex)', category: 'infrastructure', isSubPlot: false, hasMarker: true },
    45: { id: 'warehouse_7_annex', name: 'Warehouse 7 Annex', category: 'infrastructure', isSubPlot: false, hasMarker: false },
    46: { id: 'lares_agricultural_supplies_storage', name: 'LARES Agricultural Supplies Storage', category: 'infrastructure', isSubPlot: false, hasMarker: true }
};

const BUILDINGS_WITH_3D = new Set([
    'mis_rafis_building', 'tanco_hall_building', 'argosino_hall', 'canteen',
    'raed_building', 'guard_house', 'amad_building', 'pgrc_building',
    'prdp_building', 'lares_agricultural_supplies_storage', 'ored_building', 'admin_building', 'lares_building',
    'laboratory_building', 'f2c2_building', 'ild_building', 'seaguard_building',
    'corn/casava_building', 'rsbsa_building', 'tissue_culture_building',
    'rcpc_building', 'motorpool_barracks', 'rnd_building', 'rsl_building',
    'exit_guard_house_1', 'exit_guard_house_2', 'multi_purpose_administrative_building',
    'dorm', 'guest_house', 'mushroom_laboratory', 'warehouse_1', 'warehouse_2', 'warehouse_3', 'warehouse_4', 'warehouse_5', 'warehouse_6', 'warehouse_7'
]);

rawData.features.forEach((f, idx) => {
    f.properties = f.properties || {};
    if (CANONICAL_UPDATES[idx]) {
        Object.assign(f.properties, CANONICAL_UPDATES[idx]);
    }
    if (BUILDINGS_WITH_3D.has(f.properties.id)) {
        f.properties.has_3d_model = true;
    }
});

// Save buildings.json
fs.writeFileSync(buildingsJsonPath, JSON.stringify(rawData, null, 2), 'utf8');
console.log('Saved sanitized buildings.json with', rawData.features.length, 'features.');

// Update js/data/buildings.js LARES_DRAWINGS
const content = fs.readFileSync(buildingsJsPath, 'utf8');
const startMarker = 'export const LARES_DRAWINGS = ';
const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
    console.error('Could not find startMarker in buildings.js');
    process.exit(1);
}
const endMarker = 'export const KNOWN_BUILDING_NAMES';
const nextIndex = content.indexOf(endMarker, startIndex);
if (nextIndex === -1) {
    console.error('Could not find endMarker in buildings.js');
    process.exit(1);
}

const before = content.substring(0, startIndex + startMarker.length);
const after = content.substring(nextIndex);
const formattedData = JSON.stringify(rawData, null, 4);
const newContent = `${before}${formattedData};\n\n${after}`;

fs.writeFileSync(buildingsJsPath, newContent, 'utf8');
console.log('Successfully updated LARES_DRAWINGS in js/data/buildings.js.');

