import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Migration 0004: Merge RARES dot-suffixed sub-parts & sync RARES 3D model_glb_url
 *
 * - Removes the 11 dot-suffixed sub-part rows in DA-RARES (rares_building_13.1,
 *   24.1, 36.1..36.7 SGPP bays, 39.1..39.2 SPIS arrays) so each facility is a
 *   single authoritative building record (39 total) while preserving all custom
 *   3D sub-models in CUSTOM_3D_BUILDINGS and merging the #13 water tank into
 *   models/rares_gh_hydro.glb.
 * - Syncs model_glb_url for all 39 RARES buildings so DA-RARES reports 39/39 (100%).
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_PATH = path.join(__dirname, '0004_rares_subparts_snapshot.json');

const RARES_MODEL_URLS = {
    rares_building_1: 'models/rares_guard_house.glb?v=1',
    rares_building_2: 'models/rares_admin_building.glb?v=11',
    rares_building_3: 'models/rares_seed_storage.glb?v=4',
    rares_building_4: 'models/rares_chemical_storage.glb?v=4',
    rares_building_5: 'models/rares_flatbed_dryer.glb?v=6',
    rares_building_6: 'models/rares_nursery_a.glb?v=1',
    rares_building_7: 'models/rares_apco.glb?v=2',
    rares_building_8: 'models/rares_common_cr.glb?v=1',
    rares_building_9: 'models/rares_vermicomposting.glb?v=1',
    rares_building_10: 'models/rares_office_supply.glb?v=2',
    rares_building_11: 'models/rares_machinery.glb?v=1',
    rares_building_12: 'models/rares_hydro_storage.glb?v=1',
    rares_building_13: 'models/rares_gh_hydro.glb?v=2',
    rares_building_14: 'models/rares_nursery_b.glb?v=1',
    rares_building_15: 'models/rares_staff_house_a.glb?v=1',
    rares_building_16: 'models/rares_sgpp_storage.glb?v=2',
    rares_building_17: 'models/rares_multipurpose_rnd.glb?v=2',
    rares_building_18: 'models/rares_low_cost_greenhouse.glb?v=1',
    rares_building_19: 'models/rares_low_cost_hydroponics.glb?v=1',
    rares_building_20: 'models/rares_staff_house_b.glb?v=2',
    rares_building_21: 'models/rares_staff_house_c.glb?v=2',
    rares_building_22: 'models/rares_mushroom_laboratory.glb?v=1',
    rares_building_23: 'models/rares_staff_house_d.glb?v=1',
    rares_building_24: 'models/rares_mini_conference_hall.glb?v=1',
    rares_building_25: 'models/rares_poultry_house.glb?v=1',
    rares_building_26: 'models/rares_farm_house.glb?v=3',
    rares_building_27: 'models/rares_vermicomposting_new.glb?v=1',
    rares_building_28: 'models/rares_machinery_equipment_storage.glb?v=1',
    rares_building_29: 'models/rares_pre_composting_area.glb?v=1',
    rares_building_30: 'models/rares_aws.glb?v=1',
    rares_building_31: 'models/rares_rest_area.glb?v=1',
    rares_building_32: 'models/rares_hatchery_area.glb?v=1',
    rares_building_33: 'models/rares_palay_shed.glb?v=1',
    rares_building_34: 'models/rares_botanical_storage.glb?v=1',
    rares_building_35: 'models/rares_wood_vinegar.glb?v=1',
    rares_building_36: 'models/rares_sgpp_bay0.glb?v=2',
    rares_building_37: 'models/rares_breeder_house.glb?v=2',
    rares_building_38: 'models/rares_brooder_house.glb?v=2',
    rares_building_39: 'models/rares_spis_tank.glb?v=1'
};

export async function up(conn) {
    await conn.query(`DELETE FROM buildings WHERE station_id = 'rares' AND building_code LIKE '%.%'`);
    for (const [code, url] of Object.entries(RARES_MODEL_URLS)) {
        await conn.query(
            `UPDATE buildings SET model_glb_url = ? WHERE station_id = 'rares' AND building_code = ?`,
            [url, code]
        );
    }
}

export async function down(conn) {
    const rows = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
    for (const r of rows) {
        await conn.query(
            `INSERT IGNORE INTO buildings
                (id, station_id, building_code, building_num, name, category, type_label, section, icon, pin_color, roof_color, description, marker_lng, marker_lat, model_altitude, footprint_geojson, height, is_subplot, has_marker, is_visible, facility_status, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                r.id, r.station_id, r.building_code, r.building_num, r.name, r.category,
                r.type_label, r.section, r.icon, r.pin_color, r.roof_color, r.description,
                r.marker_lng, r.marker_lat, r.model_altitude, r.footprint_geojson, r.height,
                r.is_subplot, r.has_marker, r.is_visible, r.facility_status, r.version
            ]
        );
    }
}
