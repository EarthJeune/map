/**
 * Transactional Publish Engine, Plot Split/Merge Manager & Asset Reconciliation
 * Applies CRUD payloads (direct Admin saves or Reviewer-approved Change Requests) atomically to MySQL
 * and bumps `settings.data_version` so live public kiosks/browsers update cleanly without reloads.
 */

const fs = require('fs');
const path = require('path');
const { normalizeOfficePayload } = require('./office_text_normalizer');

const VALID_CROPPING_CYCLES = new Set(['annual', 'perennial', 'monthly_seasonal', 'fallow']);

function normalizeCroppingCycle(val, fallback = 'perennial') {
    const raw = String(val || '').trim().toLowerCase();
    if (VALID_CROPPING_CYCLES.has(raw)) return raw;
    if (raw === 'seasonal' || raw === 'monthly') return 'monthly_seasonal';
    const fb = String(fallback || 'perennial').trim().toLowerCase();
    return VALID_CROPPING_CYCLES.has(fb) ? fb : 'perennial';
}

function serializeJsonField(val) {
    if (val === undefined || val === null) return null;
    if (typeof val === 'string') return val;
    try { return JSON.stringify(val); } catch (e) { return null; }
}

function extractGeoGeometry(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    let parsed = raw;
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return null;
        try { parsed = JSON.parse(trimmed); } catch (_) { return null; }
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const geo = (parsed.type === 'Feature' && parsed.geometry) ? parsed.geometry : parsed;
    if (!geo || !geo.type || !geo.coordinates) return null;
    if (geo.type === 'Polygon' && Array.isArray(geo.coordinates[0]) && geo.coordinates[0].length >= 3) return geo;
    if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates[0]?.[0]) && geo.coordinates[0][0].length >= 3) return geo;
    if (geo.type === 'Point' && Array.isArray(geo.coordinates) && geo.coordinates.length >= 2) return geo;
    return null;
}

function hasValidGeoGeometry(raw) {
    return Boolean(extractGeoGeometry(raw));
}

function hasFiniteLngLat(lng, lat) {
    if (lng === undefined || lng === null || lng === '' || lat === undefined || lat === null || lat === '') return false;
    const nLng = Number(lng);
    const nLat = Number(lat);
    return Number.isFinite(nLng) && Number.isFinite(nLat) && !(nLng === 0 && nLat === 0)
        && Math.abs(nLng) <= 180 && Math.abs(nLat) <= 90;
}

function computeGeoCentroid(raw) {
    const geo = extractGeoGeometry(raw);
    if (!geo) return null;
    if (geo.type === 'Point') {
        return hasFiniteLngLat(geo.coordinates[0], geo.coordinates[1])
            ? [Number(Number(geo.coordinates[0]).toFixed(8)), Number(Number(geo.coordinates[1]).toFixed(8))]
            : null;
    }
    const ring = geo.type === 'Polygon' ? geo.coordinates[0] : geo.coordinates[0][0];
    if (!Array.isArray(ring) || ring.length === 0) return null;
    const first = ring[0];
    const last = ring[ring.length - 1];
    const pts = (ring.length > 1 && first[0] === last[0] && first[1] === last[1]) ? ring.slice(0, -1) : ring;
    if (!pts.length) return null;
    let sumLng = 0, sumLat = 0, cnt = 0;
    for (const c of pts) {
        if (Array.isArray(c) && c.length >= 2 && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))) {
            sumLng += Number(c[0]);
            sumLat += Number(c[1]);
            cnt++;
        }
    }
    if (!cnt) return null;
    return [Number((sumLng / cnt).toFixed(8)), Number((sumLat / cnt).toFixed(8))];
}

function hasBuildingGeometry(rec = {}) {
    if (!rec || typeof rec !== 'object') return false;
    return hasValidGeoGeometry(rec.footprint_geojson ?? rec.coordinates_json) || hasFiniteLngLat(rec.marker_lng, rec.marker_lat);
}

function hasPlotGeometry(rec = {}) {
    if (!rec || typeof rec !== 'object') return false;
    return hasValidGeoGeometry(rec.polygon_geojson ?? rec.coordinates_json) || hasFiniteLngLat(rec.center_lng, rec.center_lat);
}

async function runInTransaction(pool, workFn) {
    const conn = await pool.promise().getConnection();
    const txQuery = async (sql, params = []) => {
        const [rows] = await conn.query(sql, params);
        return rows;
    };
    try {
        await conn.beginTransaction();
        const result = await workFn(txQuery);
        await conn.commit();
        return result;
    } catch (err) {
        try { await conn.rollback(); } catch (e) {}
        throw err;
    } finally {
        conn.release();
    }
}

async function bumpDataVersion(execQuery) {
    const stamp = `${Date.now()}:${new Date().toISOString()}`;
    await execQuery(
        `INSERT INTO settings (\`key\`, \`value\`) VALUES ('data_version', ?) ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`,
        [stamp]
    );
    return stamp;
}

async function recordPlotHistory(execQuery, { stationId, plotCode, plotNumber, eventType, previousZoneCode = null, newZoneCode = null, summary, details = null, changedBy = 'system' }) {
    await execQuery(
        `INSERT INTO plot_history (station_id, plot_code, plot_number, event_type, previous_zone_code, new_zone_code, summary, details_json, changed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            stationId,
            plotCode,
            plotNumber || null,
            eventType,
            previousZoneCode,
            newZoneCode,
            summary || `${eventType} on ${plotCode}`,
            details ? JSON.stringify(details) : null,
            changedBy
        ]
    );
}

/**
 * Apply one approved change-request or direct Admin CRUD payload to live MySQL tables.
 */
async function applyCrudOperation(execQuery, rootDir, { stationId, targetTable, targetId, action = 'UPDATE', payload = {}, actorEmail = 'admin' }) {
    const st = String(stationId || payload.station_id || 'lares').toLowerCase();
    const act = String(action || 'UPDATE').toUpperCase();
    const b = payload || {};
    let resultMeta = { applied: true, targetTable, action: act };

    if (targetTable === 'stations') {
        const sId = String(targetId || st).toLowerCase();
        await execQuery(`
            UPDATE stations SET
                name = COALESCE(?, name),
                label = COALESCE(?, label),
                subtitle = COALESCE(?, subtitle),
                full_name = COALESCE(?, full_name),
                province = COALESCE(?, province),
                status = COALESCE(?, status),
                kiosk_pin_lng = COALESCE(?, kiosk_pin_lng),
                kiosk_pin_lat = COALESCE(?, kiosk_pin_lat),
                drone_offset_dx = COALESCE(?, drone_offset_dx),
                drone_offset_dy = COALESCE(?, drone_offset_dy),
                default_center_lng = COALESCE(?, default_center_lng),
                default_center_lat = COALESCE(?, default_center_lat),
                default_zoom = COALESCE(?, default_zoom),
                default_pitch = COALESCE(?, default_pitch),
                default_bearing = COALESCE(?, default_bearing),
                welcome_tags = COALESCE(?, welcome_tags),
                quick_tags = COALESCE(?, quick_tags),
                filter_descriptions = COALESCE(?, filter_descriptions)
            WHERE station_id = ?
        `, [
            b.name ?? null, b.label ?? null, b.subtitle ?? null, b.full_name ?? null, b.province ?? null, b.status ?? null,
            b.kiosk_pin_lng !== undefined ? Number(b.kiosk_pin_lng) : null,
            b.kiosk_pin_lat !== undefined ? Number(b.kiosk_pin_lat) : null,
            b.drone_offset_dx !== undefined ? Number(b.drone_offset_dx) : null,
            b.drone_offset_dy !== undefined ? Number(b.drone_offset_dy) : null,
            b.default_center_lng !== undefined ? Number(b.default_center_lng) : null,
            b.default_center_lat !== undefined ? Number(b.default_center_lat) : null,
            b.default_zoom !== undefined ? Number(b.default_zoom) : null,
            b.default_pitch !== undefined ? Number(b.default_pitch) : null,
            b.default_bearing !== undefined ? Number(b.default_bearing) : null,
            serializeJsonField(b.welcome_tags),
            serializeJsonField(b.quick_tags),
            serializeJsonField(b.filter_descriptions),
            sId
        ]);

        if (b.kiosk_pin_lng !== undefined && b.kiosk_pin_lat !== undefined) {
            const coords = [Number(b.kiosk_pin_lng), Number(b.kiosk_pin_lat)];
            const settingKey = sId === 'lares' ? 'kiosk_pin' : `${sId}_kiosk_pin`;
            await execQuery(`INSERT INTO settings (\`key\`, \`value\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, [settingKey, JSON.stringify(coords)]);
            const pinFile = sId === 'lares' ? 'pin.json' : `${sId}_pin.json`;
            try { fs.writeFileSync(path.join(rootDir, pinFile), JSON.stringify({ station: sId, coordinates: coords }, null, 2)); } catch (e) {}
        }
        resultMeta.targetId = sId;
    } else if (targetTable === 'buildings') {
        if (act === 'CREATE') {
            const bCode = String(b.building_code || targetId || `bldg_${Date.now()}`).trim();
            const fpRaw = b.footprint_geojson ?? b.coordinates_json;
            const fpJson = serializeJsonField(fpRaw);
            const fpCentroid = fpJson ? computeGeoCentroid(fpJson) : null;
            const createLng = hasFiniteLngLat(b.marker_lng, b.marker_lat) ? Number(b.marker_lng) : (fpCentroid ? fpCentroid[0] : null);
            const createLat = hasFiniteLngLat(b.marker_lng, b.marker_lat) ? Number(b.marker_lat) : (fpCentroid ? fpCentroid[1] : null);
            const res = await execQuery(`
                INSERT INTO buildings (
                    station_id, building_code, building_num, name, category, type_label, section,
                    icon, pin_color, roof_color, description, compact_tag, visual_landmark, key_services,
                    marker_lng, marker_lat, model_glb_url, model_scale, model_rotation, model_altitude,
                    footprint_geojson, height, is_subplot, has_marker, is_visible, facility_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                st, bCode,
                b.building_num !== '' && b.building_num !== null && b.building_num !== undefined ? Number(b.building_num) : null,
                b.name || 'New Facility',
                b.category || 'infrastructure',
                b.type_label || 'Infrastructure Facility',
                b.section || 'Compound',
                b.icon || '🏢',
                b.pin_color || '#3b82f6',
                b.roof_color || '#334155',
                b.description || '',
                b.compact_tag || null,
                b.visual_landmark || null,
                b.key_services || null,
                createLng,
                createLat,
                b.model_glb_url || null,
                b.model_scale !== undefined && b.model_scale !== '' ? String(b.model_scale) : null,
                b.model_rotation !== undefined && b.model_rotation !== '' && b.model_rotation !== null ? String(b.model_rotation) : null,
                b.model_altitude !== undefined && b.model_altitude !== '' && b.model_altitude !== null ? Number(b.model_altitude) : 0,
                fpJson,
                b.height ? Number(b.height) : 5.0,
                b.is_subplot ? 1 : 0,
                b.has_marker !== undefined ? (b.has_marker ? 1 : 0) : 1,
                b.is_visible !== undefined ? (b.is_visible ? 1 : 0) : 1,
                b.facility_status || 'Existing'
            ]);
            resultMeta.id = res.insertId;
            resultMeta.targetId = bCode;
            if (Array.isArray(b.images)) {
                await execQuery(`DELETE FROM building_images WHERE station_id = ? AND building_code = ?`, [st, bCode]);
                for (let idx = 0; idx < b.images.length; idx++) {
                    const img = b.images[idx];
                    if (!img || !img.image_webp_url) continue;
                    await execQuery(
                        `INSERT INTO building_images (station_id, building_code, image_webp_url, caption, display_order, is_primary) VALUES (?, ?, ?, ?, ?, ?)`,
                        [st, bCode, String(img.image_webp_url).trim(), String(img.caption || 'Facility View').trim(), idx, idx === 0 ? 1 : 0]
                    );
                }
            }
            if (b.gallery_mode === 'slider' || b.gallery_mode === 'carousel') {
                await execQuery(
                    'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
                    [`gallery_mode_${st}_${bCode}`, b.gallery_mode]
                );
            }
        } else if (act === 'DELETE') {
            const whereById = /^\d+$/.test(String(targetId));
            const [row] = await execQuery(
                whereById ? `SELECT id, station_id, building_code FROM buildings WHERE id = ?` : `SELECT id, station_id, building_code FROM buildings WHERE station_id = ? AND building_code = ?`,
                whereById ? [Number(targetId)] : [st, String(targetId)]
            );
            if (row) {
                await execQuery(`DELETE FROM building_images WHERE station_id = ? AND building_code = ?`, [row.station_id, row.building_code]);
                await execQuery(`DELETE FROM building_offices WHERE station_id = ? AND building_code = ?`, [row.station_id, row.building_code]);
                await execQuery(`DELETE FROM buildings WHERE id = ?`, [row.id]);
            }
        } else {
            const whereById = /^\d+$/.test(String(targetId));
            const [prev] = await execQuery(
                whereById ? `SELECT * FROM buildings WHERE id = ? LIMIT 1` : `SELECT * FROM buildings WHERE station_id = ? AND building_code = ? LIMIT 1`,
                whereById ? [Number(targetId)] : [st, String(targetId)]
            );
            const p = prev || {};
            const nextNum = b.building_num !== undefined
                ? (b.building_num !== '' && b.building_num !== null ? Number(b.building_num) : null)
                : (p.building_num ?? null);
            const nextLng = b.marker_lng !== undefined
                ? (b.marker_lng !== '' && b.marker_lng !== null ? Number(b.marker_lng) : null)
                : (p.marker_lng ?? null);
            const nextLat = b.marker_lat !== undefined
                ? (b.marker_lat !== '' && b.marker_lat !== null ? Number(b.marker_lat) : null)
                : (p.marker_lat ?? null);
            const nextFootprint = (b.footprint_geojson !== undefined || b.coordinates_json !== undefined)
                ? serializeJsonField(b.footprint_geojson ?? b.coordinates_json)
                : (p.footprint_geojson ?? null);
            const updCentroid = nextFootprint ? computeGeoCentroid(nextFootprint) : null;
            const resolvedUpdLng = hasFiniteLngLat(nextLng, nextLat) ? nextLng : (updCentroid ? updCentroid[0] : nextLng);
            const resolvedUpdLat = hasFiniteLngLat(nextLng, nextLat) ? nextLat : (updCentroid ? updCentroid[1] : nextLat);
            const nextScale = b.model_scale !== undefined
                ? (b.model_scale !== '' && b.model_scale !== null ? String(b.model_scale) : null)
                : (p.model_scale ?? null);
            const nextRotation = b.model_rotation !== undefined
                ? (b.model_rotation !== '' && b.model_rotation !== null ? String(b.model_rotation) : null)
                : (p.model_rotation ?? null);
            const nextAltitude = b.model_altitude !== undefined
                ? (b.model_altitude !== '' && b.model_altitude !== null ? Number(b.model_altitude) : 0)
                : (p.model_altitude ?? 0);
            await execQuery(`
                UPDATE buildings SET
                    building_num = ?,
                    name = ?,
                    category = ?,
                    type_label = ?,
                    section = ?,
                    icon = ?,
                    pin_color = ?,
                    roof_color = ?,
                    description = ?,
                    compact_tag = ?,
                    visual_landmark = ?,
                    key_services = ?,
                    marker_lng = ?,
                    marker_lat = ?,
                    model_glb_url = ?,
                    model_scale = ?,
                    model_rotation = ?,
                    model_altitude = ?,
                    footprint_geojson = ?,
                    height = ?,
                    has_marker = ?,
                    is_visible = ?,
                    facility_status = ?
                WHERE ${whereById ? 'id = ?' : 'station_id = ? AND building_code = ?'}
            `, [
                nextNum,
                b.name !== undefined ? (b.name || p.name || 'Facility') : (p.name || 'Facility'),
                b.category !== undefined ? (b.category || 'infrastructure') : (p.category || 'infrastructure'),
                b.type_label !== undefined ? (b.type_label || 'Infrastructure Facility') : (p.type_label || 'Infrastructure Facility'),
                b.section !== undefined ? (b.section || 'Compound') : (p.section || 'Compound'),
                b.icon !== undefined ? (b.icon || '🏢') : (p.icon || '🏢'),
                b.pin_color !== undefined ? (b.pin_color || '#3b82f6') : (p.pin_color || '#3b82f6'),
                b.roof_color !== undefined ? (b.roof_color || '#334155') : (p.roof_color || '#334155'),
                b.description !== undefined ? (b.description || '') : (p.description || ''),
                b.compact_tag !== undefined ? (b.compact_tag || null) : (p.compact_tag ?? null),
                b.visual_landmark !== undefined ? (b.visual_landmark || null) : (p.visual_landmark ?? null),
                b.key_services !== undefined ? (b.key_services || null) : (p.key_services ?? null),
                resolvedUpdLng,
                resolvedUpdLat,
                b.model_glb_url !== undefined ? (b.model_glb_url || null) : (p.model_glb_url ?? null),
                nextScale,
                nextRotation,
                nextAltitude,
                nextFootprint,
                b.height !== undefined ? (b.height ? Number(b.height) : 5.0) : (p.height ?? 5.0),
                b.has_marker !== undefined ? (b.has_marker ? 1 : 0) : (p.has_marker ?? 1),
                b.is_visible !== undefined ? (b.is_visible ? 1 : 0) : (p.is_visible ?? 1),
                b.facility_status !== undefined ? (b.facility_status || 'Existing') : (p.facility_status || 'Existing'),
                ...(whereById ? [Number(targetId)] : [st, String(targetId)])
            ]);
            const resolvedCode = String(b.building_code || p.building_code || (!whereById ? targetId : '')).trim();
            if (resolvedCode && Array.isArray(b.images)) {
                await execQuery(`DELETE FROM building_images WHERE station_id = ? AND building_code = ?`, [st, resolvedCode]);
                for (let idx = 0; idx < b.images.length; idx++) {
                    const img = b.images[idx];
                    if (!img || !img.image_webp_url) continue;
                    await execQuery(
                        `INSERT INTO building_images (station_id, building_code, image_webp_url, caption, display_order, is_primary) VALUES (?, ?, ?, ?, ?, ?)`,
                        [st, resolvedCode, String(img.image_webp_url).trim(), String(img.caption || 'Facility View').trim(), idx, idx === 0 ? 1 : 0]
                    );
                }
            }
            if (resolvedCode && (b.gallery_mode === 'slider' || b.gallery_mode === 'carousel')) {
                await execQuery(
                    'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
                    [`gallery_mode_${st}_${resolvedCode}`, b.gallery_mode]
                );
            }
        }
    } else if (targetTable === 'building_images') {
        if (act === 'CREATE') {
            let finalUrl = b.image_webp_url || '';
            if (b.base64_data && b.filename && !finalUrl) {
                const base64Clean = String(b.base64_data).replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
                const buf = Buffer.from(base64Clean, 'base64');
                const isWebpHeader = buf.length >= 12
                    && buf.length <= 15 * 1024 * 1024
                    && buf.subarray(0, 4).toString('ascii') === 'RIFF'
                    && buf.subarray(8, 12).toString('ascii') === 'WEBP';
                if (!isWebpHeader) {
                    throw new Error('Uploaded photo must be a valid WebP image under 15 MB.');
                }
                const safeBase = String(b.filename).replace(/[^a-zA-Z0-9_-]/g, '_').replace(/\.(webp|jpg|jpeg|png)$/i, '') || 'facility_photo';
                const outName = `${safeBase}_${Date.now()}.webp`;
                fs.writeFileSync(path.join(rootDir, 'images', outName), buf);
                finalUrl = `images/${outName}`;
            }
            if (b.is_primary) {
                await execQuery(`UPDATE building_images SET is_primary = 0 WHERE station_id = ? AND building_code = ?`, [st, b.building_code]);
            }
            const res = await execQuery(
                `INSERT INTO building_images (station_id, building_code, image_webp_url, caption, display_order, is_primary) VALUES (?, ?, ?, ?, ?, ?)`,
                [st, b.building_code, finalUrl, b.caption || 'Facility View', b.display_order ? Number(b.display_order) : 1, b.is_primary ? 1 : 0]
            );
            resultMeta.id = res.insertId;
            resultMeta.image_webp_url = finalUrl;
        } else if (act === 'DELETE') {
            await execQuery(`DELETE FROM building_images WHERE id = ?`, [Number(targetId)]);
        } else {
            const [row] = await execQuery(`SELECT * FROM building_images WHERE id = ?`, [Number(targetId)]);
            if (row) {
                if (b.is_primary) {
                    await execQuery(`UPDATE building_images SET is_primary = 0 WHERE station_id = ? AND building_code = ?`, [row.station_id, row.building_code]);
                }
                await execQuery(
                    `UPDATE building_images SET caption = COALESCE(?, caption), display_order = COALESCE(?, display_order), is_primary = COALESCE(?, is_primary) WHERE id = ?`,
                    [b.caption ?? null, b.display_order !== undefined ? Number(b.display_order) : null, b.is_primary !== undefined ? (b.is_primary ? 1 : 0) : null, row.id]
                );
            }
        }
    } else if (targetTable === 'building_offices') {
        const nb = normalizeOfficePayload(b);
        if (act === 'CREATE') {
            const res = await execQuery(
                `INSERT INTO building_offices (station_id, building_code, office_name, office_desc, floor_or_room, room_number, search_keywords, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [st, nb.building_code, nb.office_name, nb.office_desc || null, nb.floor_or_room || null, nb.room_number || null, nb.search_keywords || null, nb.display_order ? Number(nb.display_order) : 1]
            );
            resultMeta.id = res.insertId;
        } else if (act === 'DELETE') {
            await execQuery(`DELETE FROM building_offices WHERE id = ?`, [Number(targetId)]);
        } else {
            await execQuery(`
                UPDATE building_offices SET
                    building_code = COALESCE(?, building_code),
                    office_name = COALESCE(?, office_name),
                    office_desc = ?,
                    floor_or_room = ?,
                    room_number = ?,
                    search_keywords = ?,
                    display_order = COALESCE(?, display_order)
                WHERE id = ?
            `, [nb.building_code ?? null, nb.office_name ?? null, nb.office_desc ?? null, nb.floor_or_room ?? null, nb.room_number ?? null, nb.search_keywords ?? null, nb.display_order !== undefined ? Number(nb.display_order) : null, Number(targetId)]);
        }
    } else if (targetTable === 'agricultural_plots') {
        if (act === 'SPLIT') {
            // Split an individual plot out of a combined multi-plot zone while preserving historical traceability
            const parentId = Number(b.parent_plot_id || targetId);
            const [parent] = await execQuery(`SELECT * FROM agricultural_plots WHERE id = ? LIMIT 1`, [parentId]);
            if (!parent) throw new Error('Parent combined plot not found for SPLIT');

            const newCode = String(b.new_plot_code || `plot_${b.split_plot_number || Date.now()}_${Date.now()}`).replace(/\s+/g, '_').toLowerCase();
            const nextParentNum = b.updated_parent_plot_number ?? b.parent_plot_numbers ?? b.parent_plot_number;
            const parentPoly = serializeJsonField(b.updated_parent_polygon_geojson);
            const parentCentroid = parentPoly ? computeGeoCentroid(parentPoly) : null;
            if (nextParentNum !== undefined || parentPoly) {
                await execQuery(
                    `UPDATE agricultural_plots SET
                        plot_number = COALESCE(?, plot_number),
                        polygon_geojson = COALESCE(?, polygon_geojson),
                        center_lng = COALESCE(?, center_lng),
                        center_lat = COALESCE(?, center_lat)
                    WHERE id = ?`,
                    [
                        nextParentNum !== undefined ? nextParentNum : null,
                        parentPoly || null,
                        parentCentroid ? parentCentroid[0] : null,
                        parentCentroid ? parentCentroid[1] : null,
                        parent.id
                    ]
                );
            }
            const splitCrop = b.current_crop || b.split_commodity || b.commodity || null;
            const splitZone = b.zone_name || b.split_zone_name || `${b.split_plot_number} (Split from ${parent.zone_name})`;
            const splitPoly = serializeJsonField(b.polygon_geojson ?? b.split_polygon_geojson ?? b.coordinates_json);
            const splitCentroid = splitPoly ? computeGeoCentroid(splitPoly) : null;
            const splitLng = hasFiniteLngLat(b.center_lng, b.center_lat) ? Number(b.center_lng) : (splitCentroid ? splitCentroid[0] : (parent.center_lng ?? null));
            const splitLat = hasFiniteLngLat(b.center_lng, b.center_lat) ? Number(b.center_lat) : (splitCentroid ? splitCentroid[1] : (parent.center_lat ?? null));
            const res = await execQuery(`
                INSERT INTO agricultural_plots (
                    station_id, plot_code, plot_number, zone_name, category, icon, color,
                    current_crop, tree_or_plant_count, cropping_cycle, cycle_months,
                    area_hectares, soil_type, status, facility_status, description, image_webp_url, center_lng, center_lat, polygon_geojson
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                parent.station_id,
                newCode,
                b.split_plot_number || 'Plot',
                splitZone,
                b.category || parent.category || 'crop',
                b.icon || parent.icon || '🌱',
                b.color || parent.color || '#22c55e',
                splitCrop,
                b.tree_or_plant_count !== '' && b.tree_or_plant_count !== null && b.tree_or_plant_count !== undefined ? Number(b.tree_or_plant_count) : null,
                normalizeCroppingCycle(b.cropping_cycle, parent.cropping_cycle || 'perennial'),
                b.cycle_months || null,
                b.area_hectares !== '' && b.area_hectares !== null && b.area_hectares !== undefined ? Number(b.area_hectares) : null,
                b.soil_type || parent.soil_type || null,
                b.status || 'Active',
                b.facility_status || 'Existing',
                b.description || `Split individually from combined zone "${parent.zone_name}" (${parent.plot_number || parent.plot_code}).`,
                b.image_webp_url || parent.image_webp_url || null,
                splitLng,
                splitLat,
                splitPoly
            ]);
            await recordPlotHistory(execQuery, {
                stationId: parent.station_id,
                plotCode: newCode,
                plotNumber: b.split_plot_number || '',
                eventType: 'SPLIT',
                previousZoneCode: parent.plot_code,
                newZoneCode: newCode,
                summary: `Split ${b.split_plot_number || newCode} from combined zone "${parent.zone_name}" (${parent.plot_number || parent.plot_code})`,
                details: { parent_id: parent.id, crop: splitCrop, notes: b.notes || '' },
                changedBy: actorEmail
            });
            await recordPlotHistory(execQuery, {
                stationId: parent.station_id,
                plotCode: parent.plot_code,
                plotNumber: nextParentNum ?? parent.plot_number,
                eventType: 'SPLIT',
                previousZoneCode: parent.plot_code,
                newZoneCode: newCode,
                summary: `Separated ${b.split_plot_number || newCode} out into its own individual plot (${newCode})`,
                details: { split_code: newCode, notes: b.notes || '' },
                changedBy: actorEmail
            });
            resultMeta.id = res.insertId;
            resultMeta.plot_code = newCode;
        } else if (act === 'MERGE') {
            const sourceIds = Array.isArray(b.source_plot_ids) ? b.source_plot_ids.map(Number) : [];
            const targetPlotId = Number(b.target_plot_id || targetId);
            const [targetPlot] = await execQuery(`SELECT * FROM agricultural_plots WHERE id = ? LIMIT 1`, [targetPlotId]);
            if (!targetPlot) throw new Error('Target zone not found for MERGE');

            const mergedNum = b.merged_plot_number ?? b.merged_plot_numbers ?? null;
            const mergedPoly = serializeJsonField(b.merged_polygon_geojson ?? b.polygon_geojson);
            const mergedCentroid = mergedPoly ? computeGeoCentroid(mergedPoly) : null;
            await execQuery(
                `UPDATE agricultural_plots SET
                    plot_number = COALESCE(?, plot_number),
                    zone_name = COALESCE(?, zone_name),
                    area_hectares = COALESCE(?, area_hectares),
                    description = COALESCE(?, description),
                    polygon_geojson = COALESCE(?, polygon_geojson),
                    center_lng = COALESCE(?, center_lng),
                    center_lat = COALESCE(?, center_lat)
                WHERE id = ?`,
                [
                    mergedNum,
                    b.merged_zone_name ?? null,
                    b.merged_area_hectares !== undefined ? Number(b.merged_area_hectares) : null,
                    b.description ?? null,
                    mergedPoly || null,
                    mergedCentroid ? mergedCentroid[0] : null,
                    mergedCentroid ? mergedCentroid[1] : null,
                    targetPlot.id
                ]
            );
            for (const sid of sourceIds) {
                if (sid === targetPlot.id) continue;
                const [src] = await execQuery(`SELECT * FROM agricultural_plots WHERE id = ? LIMIT 1`, [sid]);
                if (src) {
                    await recordPlotHistory(execQuery, {
                        stationId: src.station_id,
                        plotCode: targetPlot.plot_code,
                        plotNumber: mergedNum || targetPlot.plot_number,
                        eventType: 'MERGE',
                        previousZoneCode: src.plot_code,
                        newZoneCode: targetPlot.plot_code,
                        summary: `Merged individual plot "${src.zone_name}" (${src.plot_number || src.plot_code}) into "${b.merged_zone_name || targetPlot.zone_name}"`,
                        details: { merged_plot: src },
                        changedBy: actorEmail
                    });
                    await execQuery(`DELETE FROM plot_subplots WHERE station_id = ? AND parent_plot_code = ?`, [src.station_id, src.plot_code]);
                    await execQuery(`DELETE FROM agricultural_plots WHERE id = ?`, [src.id]);
                }
            }
        } else if (act === 'CREATE') {
            const plotCode = String(b.plot_code || targetId || `plot_${Date.now()}`).trim();
            const cropVal = b.current_crop || b.commodity || null;
            const plotPoly = serializeJsonField(b.polygon_geojson ?? b.coordinates_json);
            const plotCentroid = plotPoly ? computeGeoCentroid(plotPoly) : null;
            const plotLng = hasFiniteLngLat(b.center_lng, b.center_lat) ? Number(b.center_lng) : (plotCentroid ? plotCentroid[0] : null);
            const plotLat = hasFiniteLngLat(b.center_lng, b.center_lat) ? Number(b.center_lat) : (plotCentroid ? plotCentroid[1] : null);
            const res = await execQuery(`
                INSERT INTO agricultural_plots (
                    station_id, plot_code, plot_number, zone_name, category, icon, color,
                    current_crop, tree_or_plant_count, cropping_cycle, cycle_months,
                    area_hectares, soil_type, status, facility_status, description, image_webp_url, center_lng, center_lat, polygon_geojson
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                st, plotCode, b.plot_number || b.plot_numbers || '', b.zone_name || 'New Plot Zone',
                b.category || 'orchard', b.icon || '🌱', b.color || '#22c55e',
                cropVal,
                b.tree_or_plant_count !== '' && b.tree_or_plant_count !== null && b.tree_or_plant_count !== undefined ? Number(b.tree_or_plant_count) : null,
                normalizeCroppingCycle(b.cropping_cycle, 'perennial'),
                b.cycle_months || null,
                b.area_hectares !== '' && b.area_hectares !== null && b.area_hectares !== undefined ? Number(b.area_hectares) : null,
                b.soil_type || null,
                b.status || 'Active',
                b.facility_status || 'Existing',
                b.description || '',
                b.image_webp_url || null,
                plotLng,
                plotLat,
                plotPoly
            ]);
            await recordPlotHistory(execQuery, {
                stationId: st,
                plotCode,
                plotNumber: b.plot_number || b.plot_numbers || '',
                eventType: 'CREATED',
                newZoneCode: plotCode,
                summary: `Created plot "${b.zone_name}" (${cropVal || 'No crop set'})`,
                changedBy: actorEmail
            });
            resultMeta.id = res.insertId;
            resultMeta.plot_code = plotCode;
        } else if (act === 'DELETE') {
            const [row] = await execQuery(`SELECT * FROM agricultural_plots WHERE id = ?`, [Number(targetId)]);
            if (row) {
                await execQuery(`DELETE FROM plot_subplots WHERE station_id = ? AND parent_plot_code = ?`, [row.station_id, row.plot_code]);
                await execQuery(`DELETE FROM agricultural_plots WHERE id = ?`, [row.id]);
            }
        } else {
            const [prev] = await execQuery(`SELECT * FROM agricultural_plots WHERE id = ? LIMIT 1`, [Number(targetId)]);
            const p = prev || {};
            const hasCropKey = ('current_crop' in b) || ('commodity' in b);
            const cropVal = hasCropKey ? (b.current_crop ?? b.commodity ?? null) : (p.current_crop ?? null);
            const nextTreeCnt = b.tree_or_plant_count !== undefined
                ? (b.tree_or_plant_count !== '' && b.tree_or_plant_count !== null ? Number(b.tree_or_plant_count) : null)
                : (p.tree_or_plant_count ?? null);
            const nextArea = b.area_hectares !== undefined
                ? (b.area_hectares !== '' && b.area_hectares !== null ? Number(b.area_hectares) : null)
                : (p.area_hectares ?? null);
            const nextPolyGeo = (b.polygon_geojson !== undefined || b.coordinates_json !== undefined)
                ? serializeJsonField(b.polygon_geojson ?? b.coordinates_json)
                : (p.polygon_geojson ?? null);
            const polyCentroid = nextPolyGeo ? computeGeoCentroid(nextPolyGeo) : null;
            const nextCenterLng = hasFiniteLngLat(b.center_lng, b.center_lat)
                ? Number(b.center_lng)
                : (polyCentroid ? polyCentroid[0] : (p.center_lng ?? null));
            const nextCenterLat = hasFiniteLngLat(b.center_lng, b.center_lat)
                ? Number(b.center_lat)
                : (polyCentroid ? polyCentroid[1] : (p.center_lat ?? null));
            const nextStatus = b.status !== undefined ? (b.status || 'Active') : (p.status || 'Active');
            const nextFacStatus = b.facility_status !== undefined ? (b.facility_status || 'Existing') : (p.facility_status || 'Existing');
            const nextPlotNum = (b.plot_number !== undefined || b.plot_numbers !== undefined)
                ? (b.plot_number || b.plot_numbers || '')
                : (p.plot_number || '');
            await execQuery(`
                UPDATE agricultural_plots SET
                    plot_number = ?,
                    zone_name = ?,
                    category = ?,
                    icon = ?,
                    color = ?,
                    current_crop = ?,
                    tree_or_plant_count = ?,
                    cropping_cycle = ?,
                    cycle_months = ?,
                    area_hectares = ?,
                    soil_type = ?,
                    status = ?,
                    facility_status = ?,
                    description = ?,
                    image_webp_url = ?,
                    center_lng = ?,
                    center_lat = ?,
                    polygon_geojson = ?
                WHERE id = ?
            `, [
                nextPlotNum,
                b.zone_name !== undefined ? (b.zone_name || p.zone_name) : p.zone_name,
                b.category !== undefined ? (b.category || 'orchard') : (p.category || 'orchard'),
                b.icon !== undefined ? (b.icon || '🌱') : (p.icon || '🌱'),
                b.color !== undefined ? (b.color || '#22c55e') : (p.color || '#22c55e'),
                cropVal,
                nextTreeCnt,
                normalizeCroppingCycle(b.cropping_cycle, p.cropping_cycle || 'perennial'),
                b.cycle_months !== undefined ? (b.cycle_months || null) : (p.cycle_months ?? null),
                nextArea,
                b.soil_type !== undefined ? (b.soil_type || null) : (p.soil_type ?? null),
                nextStatus,
                nextFacStatus,
                b.description !== undefined ? (b.description || '') : (p.description || ''),
                b.image_webp_url !== undefined ? (b.image_webp_url || null) : (p.image_webp_url ?? null),
                nextCenterLng,
                nextCenterLat,
                nextPolyGeo,
                Number(targetId)
            ]);
            if (prev) {
                if ((prev.current_crop || '') !== (cropVal || '')) {
                    await recordPlotHistory(execQuery, {
                        stationId: prev.station_id,
                        plotCode: prev.plot_code,
                        plotNumber: nextPlotNum || prev.plot_number,
                        eventType: 'CROP_CHANGE',
                        previousZoneCode: prev.plot_code,
                        newZoneCode: prev.plot_code,
                        summary: `Crop updated from "${prev.current_crop || 'None'}" to "${cropVal || 'None'}"`,
                        changedBy: actorEmail
                    });
                }
                if ((prev.status || '') !== nextStatus || (prev.facility_status || 'Existing') !== nextFacStatus) {
                    await recordPlotHistory(execQuery, {
                        stationId: prev.station_id,
                        plotCode: prev.plot_code,
                        plotNumber: b.plot_number || prev.plot_number,
                        eventType: 'STATUS_CHANGE',
                        previousZoneCode: prev.plot_code,
                        newZoneCode: prev.plot_code,
                        summary: `Status updated: ${prev.status}/${prev.facility_status || 'Existing'} -> ${b.status}/${b.facility_status || 'Existing'}`,
                        changedBy: actorEmail
                    });
                }
            }
        }
    } else if (targetTable === 'plot_subplots') {
        await execQuery(`
            UPDATE plot_subplots SET
                name = ?, current_crop = ?, tree_or_plant_count = ?, cropping_cycle = ?, description = ?, image_webp_url = ?
            WHERE id = ?
        `, [
            b.name, b.current_crop || null,
            b.tree_or_plant_count !== '' && b.tree_or_plant_count !== null && b.tree_or_plant_count !== undefined ? Number(b.tree_or_plant_count) : null,
            b.cropping_cycle || null, b.description || '', b.image_webp_url || null, Number(targetId)
        ]);
    } else if (targetTable === 'map_geometry') {
        const rootDir = path.resolve(__dirname, '..');
        const geo = b.geojson && Array.isArray(b.geojson.features) ? b.geojson : null;
        const editorType = String(b.editor_type || 'buildings').toLowerCase();
        const relFile = String(b.file_path || '').replace(/^\/+/, '');
        if (!geo || !relFile || relFile.includes('..')) {
            throw new Error('Invalid map_geometry publish payload');
        }
        const absFile = path.join(rootDir, relFile);
        const bDir = path.join(rootDir, 'archive', 'backups');
        try {
            if (fs.existsSync(absFile)) {
                if (!fs.existsSync(bDir)) fs.mkdirSync(bDir, { recursive: true });
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                const base = path.basename(relFile, path.extname(relFile));
                fs.copyFileSync(absFile, path.join(bDir, `${base}_backup_${ts}.json`));
            }
        } catch (_) {}

        fs.writeFileSync(absFile, JSON.stringify(geo, null, 2), 'utf8');

        // For DA-LARES buildings/pills, also update LARES_DRAWINGS inside js/data/buildings.js
        if (st === 'lares' && (editorType === 'buildings' || editorType === 'pills') && relFile === 'buildings.json') {
            const bJsPath = path.join(rootDir, 'js', 'data', 'buildings.js');
            if (fs.existsSync(bJsPath)) {
                const content = fs.readFileSync(bJsPath, 'utf8');
                const startMarker = 'export const LARES_DRAWINGS = ';
                const endMarker = 'export const KNOWN_BUILDING_NAMES';
                const startIndex = content.indexOf(startMarker);
                const nextIndex = content.indexOf(endMarker, startIndex);
                if (startIndex !== -1 && nextIndex !== -1) {
                    const endSemi = content.lastIndexOf(';', nextIndex);
                    const updated = content.slice(0, startIndex + startMarker.length) + JSON.stringify(geo, null, 2) + content.slice(endSemi);
                    fs.writeFileSync(bJsPath, updated, 'utf8');
                }
            }
        }

        // Sync updated building footprints & marker_coords to MySQL buildings table
        if (editorType === 'buildings' || editorType === 'pills') {
            for (const f of geo.features) {
                const p = (f && f.properties) || {};
                const code = String(p.building_code || p.id || '').trim();
                if (!code || !hasValidGeoGeometry(f.geometry)) continue;
                const hasMc = Array.isArray(p.marker_coords) && p.marker_coords.length >= 2 && hasFiniteLngLat(p.marker_coords[0], p.marker_coords[1]);
                const mc = hasMc
                    ? [Number(Number(p.marker_coords[0]).toFixed(8)), Number(Number(p.marker_coords[1]).toFixed(8))]
                    : computeGeoCentroid(f.geometry);
                if (!mc) continue;
                await execQuery(
                    `UPDATE buildings SET marker_lng = ?, marker_lat = ?, footprint_geojson = ? WHERE station_id = ? AND building_code = ?`,
                    [mc[0], mc[1], JSON.stringify(f.geometry), st, code]
                );
            }
        }
        resultMeta.filePath = relFile;
        resultMeta.featureCount = geo.features.length;
    }

    const version = await bumpDataVersion(execQuery);
    resultMeta.dataVersion = version;
    return resultMeta;
}

/**
 * Reconcile disk images/*.webp against `building_images` without importing plot/zone/marker prefixes.
 */
async function reconcileDiskAssets(query, rootDir) {
    const imagesDir = path.join(rootDir, 'images');
    if (!fs.existsSync(imagesDir)) {
        return { inserted: 0, skipped: 0, existing: 0 };
    }
    const files = fs.readdirSync(imagesDir).filter(f => f.toLowerCase().endsWith('.webp'));
    const existingRows = await query(`SELECT image_webp_url FROM building_images`);
    const existingSet = new Set(existingRows.map(r => String(r.image_webp_url || '').toLowerCase()));
    const allBldgs = await query(`SELECT station_id, building_code FROM buildings`);
    const validBldgSet = new Set(allBldgs.map(b => `${String(b.station_id).toLowerCase()}:${String(b.building_code)}`));

    let inserted = 0;
    let skipped = 0;
    for (const file of files) {
        const url = `images/${file}`;
        if (existingSet.has(url.toLowerCase())) continue;

        const base = file.replace(/\.webp$/i, '');
        if (base.startsWith('zone_') || base.startsWith('gate_') || base.endsWith('_marker')) {
            skipped++;
            continue;
        }
        let stationId = 'lares';
        let bCode = base;
        let caption = 'Primary Facility View';
        let order = 1;
        let isPrimary = 1;

        if (base.startsWith('rares_')) {
            stationId = 'rares';
        } else if (base.startsWith('qares_')) {
            stationId = 'qares';
        } else if (base.endsWith('_inside')) {
            bCode = base.replace(/_inside$/, '');
            caption = 'Interior View';
            order = 2;
            isPrimary = 0;
        } else if (base.endsWith('_side')) {
            bCode = base.replace(/_side$/, '');
            caption = 'Side Angle View';
            order = 3;
            isPrimary = 0;
        } else if (base.endsWith('_angle')) {
            bCode = base.replace(/_angle$/, '');
            caption = 'Secondary Angle View';
            order = 2;
            isPrimary = 0;
        } else if (base === 'corn_casava_building') {
            bCode = 'corn/casava_building';
        } else if (/^plot18_screenhouse_[678]$/.test(base)) {
            bCode = 'plot18_greenhouse_complex';
            const shNum = base.slice(-1);
            caption = `Citrus Seedlings Screenhouse ${shNum}`;
            order = Number(shNum) - 5;
            isPrimary = shNum === '7' ? 1 : 0;
        }

        // Strictly link only to verified building_codes that exist in `buildings` (prevents orphan image rows)
        if (!validBldgSet.has(`${stationId}:${bCode}`)) {
            skipped++;
            continue;
        }

        await query(
            `INSERT INTO building_images (station_id, building_code, image_webp_url, caption, display_order, is_primary) VALUES (?, ?, ?, ?, ?, ?)`,
            [stationId, bCode, url, caption, order, isPrimary]
        );
        inserted++;
    }
    if (inserted > 0) {
        await bumpDataVersion(query);
    }
    return { inserted, skipped, totalScanned: files.length };
}

module.exports = {
    runInTransaction,
    bumpDataVersion,
    recordPlotHistory,
    applyCrudOperation,
    reconcileDiskAssets,
    extractGeoGeometry,
    hasValidGeoGeometry,
    hasFiniteLngLat,
    computeGeoCentroid,
    hasBuildingGeometry,
    hasPlotGeometry
};
