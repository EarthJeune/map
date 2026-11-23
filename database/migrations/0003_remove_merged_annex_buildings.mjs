/**
 * Migration 0003: Remove merged annex footprint rows from buildings table
 *
 * plot18_screenhouse_9_headhouse (merged into models/plot18_screenhouse_9.glb)
 * and warehouse_7_annex (merged into models/warehouse_7.glb) have has_marker = 0,
 * zero photos/offices/entrances/roads, and caused duplicate empty cards & 96% KPI.
 */

const MERGED_ANNEX_ROWS = [
    {
        id: 38,
        station_id: 'lares',
        building_code: 'plot18_screenhouse_9_headhouse',
        building_num: null,
        name: 'Citrus Seedlings Headhouse',
        category: 'trial_sites',
        type_label: 'Infrastructure Facility',
        section: 'Compound',
        icon: '🏢',
        pin_color: '#3b82f6',
        roof_color: '#334155',
        description: 'DA-LARES Facility',
        marker_lng: 121.16771100174685,
        marker_lat: 13.959294751283664,
        model_altitude: 0,
        footprint_geojson: '{"coordinates":[[[121.16769315896988,13.959264151124955],[121.167757943462,13.959286958525439],[121.16773782783412,13.959340206598384],[121.16767291949839,13.959318289044589],[121.16769315896988,13.959264151124955]]],"type":"Polygon"}',
        height: 5,
        is_subplot: 1,
        has_marker: 0,
        is_visible: 1,
        facility_status: 'Existing',
        version: 1
    },
    {
        id: 48,
        station_id: 'lares',
        building_code: 'warehouse_7_annex',
        building_num: null,
        name: 'Corn Banner Warehouse Annex',
        category: 'infrastructure',
        type_label: 'Infrastructure Facility',
        section: 'Compound',
        icon: '🏢',
        pin_color: '#3b82f6',
        roof_color: '#334155',
        description: 'DA-LARES Facility',
        marker_lng: 121.16744833,
        marker_lat: 13.96018757,
        model_altitude: 0,
        footprint_geojson: '{"coordinates":[[[121.16746020084156,13.960239945487913],[121.1674043794784,13.96022148264393],[121.16743656728693,13.960136010532423],[121.16749216410267,13.960152856382038],[121.16746020084156,13.960239945487913]]],"type":"Polygon"}',
        height: 5,
        is_subplot: 1,
        has_marker: 0,
        is_visible: 1,
        facility_status: 'Existing',
        version: 1
    }
];

export async function up(conn) {
    await conn.query(
        `DELETE FROM buildings WHERE station_id = 'lares' AND building_code IN ('plot18_screenhouse_9_headhouse', 'warehouse_7_annex')`
    );
}

export async function down(conn) {
    for (const r of MERGED_ANNEX_ROWS) {
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
