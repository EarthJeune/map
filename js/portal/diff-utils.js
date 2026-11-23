/**
 * Pure, testable Diff & Snapshot utilities for Phase 1 (1.1 & 1.3)
 * Shared by change-requests.js and buildings-crud.js.
 */

export function parseJsonSafe(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (_) { return {}; }
}

function normalizeImageList(arr) {
    return (Array.isArray(arr) ? arr : [])
        .filter(im => im && (im.image_webp_url || im.image_url))
        .map(im => ({
            image_webp_url: String(im.image_webp_url || im.image_url || '').split('?')[0].trim(),
            caption: String(im.caption || 'Facility View').trim()
        }));
}

/**
 * 1.1: Build immutable Before vs. After preview states strictly from cr.previous_json
 * and cr.payload_json so live database changes (e.g. after publishing or adding a photo)
 * NEVER overwrite or leak into the Before column.
 */
export function computeSnapshotBeforeAfter(cr, liveFallbackRecord = null) {
    const prev = parseJsonSafe(cr?.previous_json);
    const next = parseJsonSafe(cr?.payload_json);
    const action = String(cr?.action || 'UPDATE').toUpperCase();
    const targetTable = String(cr?.target_table || '').toLowerCase();

    const hasPrevSnapshot = prev && typeof prev === 'object' && Object.keys(prev).length > 0;

    // Only pull static identity fields from live fallback when previous_json doesn't carry them.
    // NEVER pull live mutable fields (images, description, offices, geometry) into beforeState.
    const staticIdentity = liveFallbackRecord ? {
        name: liveFallbackRecord.name || liveFallbackRecord.zone_name || '',
        building_code: liveFallbackRecord.building_code || '',
        building_num: liveFallbackRecord.building_num ?? null,
        plot_code: liveFallbackRecord.plot_code || '',
        plot_number: liveFallbackRecord.plot_number || '',
        category: liveFallbackRecord.category || '',
        type_label: liveFallbackRecord.type_label || '',
        pin_color: liveFallbackRecord.pin_color || liveFallbackRecord.color || ''
    } : {};

    let beforeState;
    if (action === 'CREATE') {
        beforeState = { ...staticIdentity, ...prev, images: Array.isArray(prev.images) ? prev.images : [] };
    } else if (hasPrevSnapshot) {
        beforeState = {
            ...staticIdentity,
            ...prev,
            images: Array.isArray(prev.images) ? prev.images : []
        };
    } else {
        // Legacy request submitted before snapshot capture existed
        beforeState = { ...staticIdentity, images: [] };
    }

    let afterState = { ...beforeState, ...next };

    // Special handling for standalone building_images CREATE/DELETE requests (e.g. Request #65)
    if (targetTable === 'building_images') {
        const beforeImgs = normalizeImageList(beforeState.images);
        const addedUrl = String(next.image_webp_url || next.image_url || '').split('?')[0].trim();
        if (action === 'CREATE' && addedUrl) {
            const exists = beforeImgs.some(im => im.image_webp_url.toLowerCase() === addedUrl.toLowerCase());
            afterState.images = exists
                ? beforeImgs
                : [...beforeImgs, { image_webp_url: addedUrl, caption: String(next.caption || 'Facility View').trim() }];
            beforeState.images = beforeImgs;
        } else if (action === 'DELETE' && addedUrl) {
            beforeState.images = beforeImgs.length
                ? beforeImgs
                : [{ image_webp_url: addedUrl, caption: String(prev.caption || 'Facility View').trim() }];
            afterState.images = beforeState.images.filter(
                im => im.image_webp_url.toLowerCase() !== addedUrl.toLowerCase()
            );
        }
    }

    return { beforeState, afterState, hasPrevSnapshot };
}

function normalizeGeoString(raw) {
    if (!raw) return '';
    let obj = raw;
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return '';
        try { obj = JSON.parse(trimmed); } catch (_) { return trimmed; }
    }
    if (!obj || typeof obj !== 'object') return '';
    const geom = (obj.type === 'Feature' && obj.geometry) ? obj.geometry : obj;
    const roundCoords = (c) => {
        if (typeof c === 'number') return Number(c.toFixed(6));
        if (Array.isArray(c)) return c.map(roundCoords);
        return c;
    };
    return JSON.stringify({
        type: geom.type || '',
        coordinates: roundCoords(geom.coordinates || [])
    });
}

/**
 * 1.3: Returns true ONLY when spatial geometry (polygon/footprint/pin coordinates)
 * genuinely differs between previous snapshot and proposed payload.
 */
export function hasGeometryActuallyChanged(prevObj = {}, nextObj = {}, action = 'UPDATE') {
    const prev = parseJsonSafe(prevObj);
    const next = parseJsonSafe(nextObj);
    const act = String(action || 'UPDATE').toUpperCase();

    const geomKeys = [
        'footprint_geojson',
        'polygon_geojson',
        'coordinates_json',
        'split_polygon_geojson',
        'updated_parent_polygon_geojson'
    ];

    for (const k of geomKeys) {
        if (next[k] === undefined && prev[k] === undefined) continue;
        // If next payload omitted the geometry key on an UPDATE, geometry did not change
        if (act === 'UPDATE' && next[k] === undefined) continue;
        const bNorm = normalizeGeoString(prev[k]);
        const aNorm = normalizeGeoString(next[k]);
        if (bNorm !== aNorm && (bNorm || aNorm)) return true;
    }

    const pinPairs = [
        ['marker_lng', 'marker_lat'],
        ['kiosk_pin_lng', 'kiosk_pin_lat']
    ];
    for (const [lngKey, latKey] of pinPairs) {
        if (act === 'UPDATE' && next[lngKey] === undefined && next[latKey] === undefined) continue;
        const bLng = prev[lngKey] !== undefined && prev[lngKey] !== null && prev[lngKey] !== '' ? Number(Number(prev[lngKey]).toFixed(6)) : null;
        const bLat = prev[latKey] !== undefined && prev[latKey] !== null && prev[latKey] !== '' ? Number(Number(prev[latKey]).toFixed(6)) : null;
        const aLng = next[lngKey] !== undefined && next[lngKey] !== null && next[lngKey] !== '' ? Number(Number(next[lngKey]).toFixed(6)) : null;
        const aLat = next[latKey] !== undefined && next[latKey] !== null && next[latKey] !== '' ? Number(Number(next[latKey]).toFixed(6)) : null;
        if (bLng !== aLng || bLat !== aLat) {
            if ((bLng !== null && bLat !== null) || (aLng !== null && aLat !== null)) return true;
        }
    }

    return false;
}

/**
 * 1.3: Accurate "View Result & Changes (n)" counter for Building editor modal.
 * Returns 0 before any edit and exact count of changed fields + photo edits.
 */
export function countRealBuildingChanges(originalSnap = {}, currentForm = {}, originalPhotos = [], workingPhotos = []) {
    const trackedFields = [
        'name', 'building_num', 'building_code', 'category', 'facility_status',
        'type_label', 'description', 'visual_landmark', 'key_services',
        'model_glb_url', 'model_rotation', 'model_scale', 'pin_color', 'icon', 'gallery_mode'
    ];
    let count = 0;
    for (const key of trackedFields) {
        let a = originalSnap?.[key] ?? '';
        let b = currentForm?.[key] ?? '';
        if (key === 'pin_color') {
            a = String(a).trim().toLowerCase();
            b = String(b).trim().toLowerCase();
        } else if (key === 'model_glb_url') {
            a = String(a).split('?')[0].trim().toLowerCase();
            b = String(b).split('?')[0].trim().toLowerCase();
        } else {
            a = String(a).trim();
            b = String(b).trim();
        }
        if (a !== b) count++;
    }

    const origImgs = normalizeImageList(originalPhotos);
    const workImgs = normalizeImageList(workingPhotos);
    if (JSON.stringify(origImgs) !== JSON.stringify(workImgs)) {
        count++;
    }
    return count;
}
