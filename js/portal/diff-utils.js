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

const FRIENDLY_FIELD_NAMES = {
    name: 'name',
    zone_name: 'name',
    office_name: 'name',
    description: 'description',
    visual_landmark: 'visual landmark',
    key_services: 'services',
    facility_status: 'status',
    pin_color: 'pin color',
    color: 'color',
    category: 'category',
    type_label: 'facility type',
    current_crop: 'planted crop',
    tree_or_plant_count: 'plant count',
    cycle_months: 'cropping cycle',
    floor_or_room: 'floor',
    room_number: 'room number',
    kiosk_pin_lng: 'kiosk location',
    kiosk_pin_lat: 'kiosk location',
    footprint_geojson: 'building outline',
    polygon_geojson: 'plot boundary',
    model_glb_url: '3D model'
};

/**
 * 2.1: Generate plain, human-readable request titles from change type and entity name
 * (e.g. "Added a photo to Guard House B", "Updated description of Admin Building").
 */
export function formatHumanRequestTitle(cr = {}, entityName = '') {
    const prev = parseJsonSafe(cr.previous_json);
    const next = parseJsonSafe(cr.payload_json);
    const table = String(cr.target_table || '').toLowerCase();
    const action = String(cr.action || 'UPDATE').toUpperCase();
    const cleanName = String(
        entityName
        || next.name
        || next.zone_name
        || next.office_name
        || prev.name
        || prev.zone_name
        || prev.office_name
        || cr.target_id
        || 'record'
    ).trim();

    if (table === 'building_images') {
        if (action === 'CREATE') return `Added a photo to ${cleanName}`;
        if (action === 'DELETE') return `Removed 1 photo from ${cleanName}`;
        return `Updated photos of ${cleanName}`;
    }

    if (table === 'stations') {
        return `Updated station settings for ${cleanName}`;
    }

    if (table === 'map_geometry') {
        return `Updated map layout for ${cleanName}`;
    }

    const typeWord = table === 'building_offices'
        ? 'office'
        : (table === 'agricultural_plots' || table === 'plot_subplots' ? 'plot' : 'building');

    if (action === 'CREATE') return `Added ${typeWord} ${cleanName}`;
    if (action === 'DELETE') return `Removed ${typeWord} ${cleanName}`;
    if (action === 'SPLIT') return `Split plot from ${cleanName}`;
    if (action === 'MERGE') return `Merged plots into ${cleanName}`;

    // Check photo delta on building UPDATEs
    const beforeImgs = normalizeImageList(prev.images);
    const afterImgs = Array.isArray(next.images) ? normalizeImageList(next.images) : beforeImgs;
    const beforeUrls = new Set(beforeImgs.map(i => i.image_webp_url.toLowerCase()));
    const afterUrls = new Set(afterImgs.map(i => i.image_webp_url.toLowerCase()));
    const addedPhotos = afterImgs.filter(i => !beforeUrls.has(i.image_webp_url.toLowerCase())).length;
    const removedPhotos = beforeImgs.filter(i => !afterUrls.has(i.image_webp_url.toLowerCase())).length;

    const changedFriendly = [];
    for (const [k, label] of Object.entries(FRIENDLY_FIELD_NAMES)) {
        if (next[k] === undefined) continue;
        const a = String(prev[k] ?? '').trim();
        const b = String(next[k] ?? '').trim();
        if (a !== b && !changedFriendly.includes(label)) {
            changedFriendly.push(label);
        }
    }

    if (changedFriendly.length === 0) {
        if (addedPhotos > 0 && removedPhotos === 0) {
            return addedPhotos === 1 ? `Added a photo to ${cleanName}` : `Added ${addedPhotos} photos to ${cleanName}`;
        }
        if (removedPhotos > 0 && addedPhotos === 0) {
            return `Removed ${removedPhotos} photo${removedPhotos === 1 ? '' : 's'} from ${cleanName}`;
        }
        if (addedPhotos > 0 || removedPhotos > 0) {
            return `Updated photos of ${cleanName}`;
        }
    }

    if (changedFriendly.length === 1) {
        return `Updated ${changedFriendly[0]} of ${cleanName}`;
    }
    if (changedFriendly.length === 2) {
        return `Updated ${changedFriendly[0]} and ${changedFriendly[1]} of ${cleanName}`;
    }
    return `Updated ${cleanName}`;
}

/**
 * 2.3: Parse reviewer revision comments into structured checked parts + plain note
 * so GIS Editors see a readable list.
 */
export function parseReviewerFeedback(comment = '') {
    const raw = String(comment || '').trim();
    if (!raw) return { items: [], note: '' };

    const flaggedMatch = raw.match(/^Flagged for revision:\s*\[([^\]]+)\]\s*(?:[—\-:]\s*(.*))?$/i);
    if (flaggedMatch) {
        const items = flaggedMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        const note = (flaggedMatch[2] || '').trim();
        return { items, note };
    }

    const suggestMatch = raw.match(/^\[Reviewer Suggestion\s*[—\-]\s*([^\]]+)\]\s*:?\s*(.*)$/i);
    if (suggestMatch) {
        const items = suggestMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        const note = (suggestMatch[2] || '').trim();
        return { items, note };
    }

    return { items: [], note: raw };
}
