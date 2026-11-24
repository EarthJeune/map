/**
 * Feature-Level Spatial Geometry Diff Engine for all 5 iGUIDE Visual Map Editors:
 *   - Building Footprints (draw.html)
 *   - Pill Label Offsets (pill_adjust.html)
 *   - Roads & Entrances (road_draw.html)
 *   - Agricultural Plots (plot_draw.html)
 *   - 3D Tree Placement (tree_draw.html)
 */

'use strict';

function toRad(d) {
    return (Number(d) * Math.PI) / 180;
}

function distanceMeters(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) return 0;
    const lng1 = Number(a[0]), lat1 = Number(a[1]);
    const lng2 = Number(b[0]), lat2 = Number(b[1]);
    if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return 0;
    const dx = (lng2 - lng1) * 111320 * Math.cos(toRad((lat1 + lat2) / 2));
    const dy = (lat2 - lat1) * 110540;
    return Math.hypot(dx, dy);
}

function compassDirection(from, to) {
    if (!Array.isArray(from) || !Array.isArray(to)) return '';
    const dx = Number(to[0]) - Number(from[0]);
    const dy = Number(to[1]) - Number(from[1]);
    if (Math.hypot(dx, dy) < 1e-9) return '';
    const deg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
}

function polygonAreaM2(geometry) {
    if (!geometry || !geometry.coordinates) return 0;
    const rings = [];
    if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates[0])) {
        rings.push(geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
        for (const poly of geometry.coordinates) {
            if (Array.isArray(poly) && Array.isArray(poly[0])) rings.push(poly[0]);
        }
    }
    let total = 0;
    for (const ring of rings) {
        if (!ring || ring.length < 3) continue;
        const lat0 = Number(ring[0][1]) || 13.95;
        const mPerDegLon = 111320 * Math.cos(toRad(lat0));
        const mPerDegLat = 110540;
        let area = 0;
        for (let i = 0; i < ring.length - 1; i++) {
            const x1 = Number(ring[i][0]) * mPerDegLon;
            const y1 = Number(ring[i][1]) * mPerDegLat;
            const x2 = Number(ring[i + 1][0]) * mPerDegLon;
            const y2 = Number(ring[i + 1][1]) * mPerDegLat;
            area += (x1 * y2 - x2 * y1);
        }
        total += Math.abs(area) / 2;
    }
    return Math.round(total);
}

function lineLengthM(geometry) {
    if (!geometry || !geometry.coordinates) return 0;
    const lines = geometry.type === 'LineString'
        ? [geometry.coordinates]
        : (geometry.type === 'MultiLineString' ? geometry.coordinates : []);
    let total = 0;
    for (const line of lines) {
        if (!Array.isArray(line)) continue;
        for (let i = 1; i < line.length; i++) {
            total += distanceMeters(line[i - 1], line[i]);
        }
    }
    return Math.round(total * 10) / 10;
}

function geometryCenter(geometry) {
    if (!geometry || !geometry.coordinates) return null;
    if (geometry.type === 'Point') {
        return [Number(geometry.coordinates[0]), Number(geometry.coordinates[1])];
    }
    const pts = [];
    const walk = (c) => {
        if (!Array.isArray(c)) return;
        if (c.length >= 2 && typeof c[0] === 'number' && typeof c[1] === 'number') {
            pts.push([c[0], c[1]]);
        } else {
            c.forEach(walk);
        }
    };
    walk(geometry.coordinates);
    if (!pts.length) return null;
    let sx = 0, sy = 0;
    for (const p of pts) { sx += p[0]; sy += p[1]; }
    return [sx / pts.length, sy / pts.length];
}

function roundCoords(coords, prec = 6) {
    if (!Array.isArray(coords)) return coords;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return [Number(coords[0].toFixed(prec)), Number(coords[1].toFixed(prec))];
    }
    return coords.map(c => roundCoords(c, prec));
}

function geomSignature(geometry) {
    if (!geometry) return '';
    return JSON.stringify({ t: geometry.type, c: roundCoords(geometry.coordinates, 6) });
}

function featureKey(editorType, f, idx) {
    const p = f?.properties || {};
    if (editorType === 'buildings' || editorType === 'pills') {
        return String(p.building_code || p.id || p.name || `bldg_${idx}`).trim();
    }
    if (editorType === 'plots') {
        return String(p.plot_code || p.id || p.zone_name || p.name || `plot_${idx}`).trim();
    }
    if (editorType === 'roads') {
        if (p.id) return String(p.id).trim();
        if (p.type === 'entrance' && p.buildingId) return `ent_${p.buildingId}`;
        return `${p.type || 'road'}_${geomSignature(f.geometry).slice(0, 48)}_${idx}`;
    }
    if (editorType === 'trees') {
        if (p.id) return String(p.id).trim();
        const c = geometryCenter(f.geometry);
        return c ? `tree_${c[0].toFixed(6)}_${c[1].toFixed(6)}` : `tree_${idx}`;
    }
    return String(p.id || p.name || `feat_${idx}`).trim();
}

function featureLabel(editorType, f, key) {
    const p = f?.properties || {};
    if (editorType === 'buildings' || editorType === 'pills') {
        const num = p.num !== undefined && p.num !== null && p.num !== '' ? `#${p.num} ` : '';
        return `${num}${p.name || p.building_code || key}`.trim();
    }
    if (editorType === 'plots') {
        return p.zone_name || p.name || p.plot_number || key;
    }
    if (editorType === 'roads') {
        if (p.type === 'entrance') return `Entrance: ${p.buildingName || p.buildingId || key}`;
        return p.name || p.id || 'Campus Walkway';
    }
    if (editorType === 'trees') {
        const sp = p.species || p.type || 'Tree';
        const sc = p.scale ? ` ×${Number(p.scale).toFixed(1)}` : '';
        return `${sp}${sc}`;
    }
    return p.name || key;
}

function extendBbox(bbox, coords) {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        const lng = coords[0], lat = coords[1];
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        if (lng < bbox[0]) bbox[0] = lng;
        if (lat < bbox[1]) bbox[1] = lat;
        if (lng > bbox[2]) bbox[2] = lng;
        if (lat > bbox[3]) bbox[3] = lat;
    } else {
        for (const c of coords) extendBbox(bbox, c);
    }
}

function validMarkerCoords(mc) {
    return Array.isArray(mc) && mc.length >= 2 &&
        Number.isFinite(Number(mc[0])) && Number.isFinite(Number(mc[1])) &&
        Number(mc[0]) !== 0 && Number(mc[1]) !== 0;
}

function computeGeometryDiff(requestedEditorType, prevGeo, nextGeo) {
    const prevFeats = Array.isArray(prevGeo?.features) ? prevGeo.features : [];
    const nextFeats = Array.isArray(nextGeo?.features) ? nextGeo.features : [];

    let editorType = requestedEditorType;
    const prevMap = new Map();
    const nextMap = new Map();

    prevFeats.forEach((f, i) => {
        const k = featureKey(editorType, f, i);
        if (!prevMap.has(k)) prevMap.set(k, f);
    });
    nextFeats.forEach((f, i) => {
        const k = featureKey(editorType, f, i);
        if (!nextMap.has(k)) nextMap.set(k, f);
    });

    const added = [];
    const removed = [];
    const modified = [];
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
    let onlyPillsMoved = (editorType === 'buildings' || editorType === 'pills');

    // Detect added & modified
    for (const [k, nf] of nextMap.entries()) {
        const pf = prevMap.get(k);
        if (!pf) {
            onlyPillsMoved = false;
            const center = geometryCenter(nf.geometry);
            const areaM2 = polygonAreaM2(nf.geometry);
            const lenM = lineLengthM(nf.geometry);
            extendBbox(bbox, nf.geometry?.coordinates);
            added.push({
                key: k,
                label: featureLabel(editorType, nf, k),
                changeKind: 'added',
                center,
                areaM2,
                lengthM: lenM,
                afterGeometry: nf.geometry,
                properties: nf.properties || {}
            });
            continue;
        }

        const prevSig = geomSignature(pf.geometry);
        const nextSig = geomSignature(nf.geometry);
        const geomChanged = prevSig !== nextSig;

        const prevMc = validMarkerCoords(pf.properties?.marker_coords) ? pf.properties.marker_coords.map(Number) : null;
        const nextMc = validMarkerCoords(nf.properties?.marker_coords) ? nf.properties.marker_coords.map(Number) : null;
        const prevAnchor = prevMc || geometryCenter(pf.geometry);
        const nextAnchor = nextMc || geometryCenter(nf.geometry);
        const pillShiftM = (prevAnchor && nextAnchor && (prevMc || nextMc))
            ? distanceMeters(prevAnchor, nextAnchor)
            : 0;
        const pillMoved = (editorType === 'buildings' || editorType === 'pills') && pillShiftM > 0.2;

        if (geomChanged) onlyPillsMoved = false;

        if (geomChanged || pillMoved) {
            const oldCenter = geometryCenter(pf.geometry);
            const newCenter = geometryCenter(nf.geometry);
            const shiftM = pillMoved && !geomChanged
                ? Math.round(pillShiftM * 10) / 10
                : Math.round(distanceMeters(oldCenter, newCenter) * 10) / 10;
            const dir = pillMoved && !geomChanged
                ? compassDirection(prevAnchor, nextAnchor)
                : compassDirection(oldCenter, newCenter);
            const beforeAreaM2 = polygonAreaM2(pf.geometry);
            const afterAreaM2 = polygonAreaM2(nf.geometry);
            const beforeLenM = lineLengthM(pf.geometry);
            const afterLenM = lineLengthM(nf.geometry);

            extendBbox(bbox, pf.geometry?.coordinates);
            extendBbox(bbox, nf.geometry?.coordinates);
            if (prevAnchor) extendBbox(bbox, prevAnchor);
            if (nextAnchor) extendBbox(bbox, nextAnchor);

            modified.push({
                key: k,
                label: featureLabel(editorType, nf, k),
                changeKind: pillMoved && !geomChanged ? 'pill_moved' : 'modified',
                fromCoord: pillMoved && !geomChanged ? prevAnchor : oldCenter,
                toCoord: pillMoved && !geomChanged ? nextAnchor : newCenter,
                center: nextAnchor || newCenter,
                shiftM,
                direction: dir,
                beforeAreaM2,
                afterAreaM2,
                areaDeltaM2: afterAreaM2 - beforeAreaM2,
                beforeLengthM: beforeLenM,
                afterLengthM: afterLenM,
                lengthDeltaM: Math.round((afterLenM - beforeLenM) * 10) / 10,
                beforeGeometry: pf.geometry,
                afterGeometry: nf.geometry,
                properties: nf.properties || {}
            });
        }
    }

    // Detect removed
    for (const [k, pf] of prevMap.entries()) {
        if (!nextMap.has(k)) {
            onlyPillsMoved = false;
            const center = geometryCenter(pf.geometry);
            const areaM2 = polygonAreaM2(pf.geometry);
            const lenM = lineLengthM(pf.geometry);
            extendBbox(bbox, pf.geometry?.coordinates);
            removed.push({
                key: k,
                label: featureLabel(editorType, pf, k),
                changeKind: 'removed',
                center,
                areaM2,
                lengthM: lenM,
                beforeGeometry: pf.geometry,
                properties: pf.properties || {}
            });
        }
    }

    const totalChanges = added.length + modified.length + removed.length;
    if (onlyPillsMoved && totalChanges > 0) {
        editorType = 'pills';
    }

    const editorTitles = {
        buildings: 'Building Footprints',
        pills: 'Pill Label Offsets',
        roads: 'Roads & Entrances',
        plots: 'Agricultural Plots',
        trees: '3D Tree Placement'
    };

    const parts = [];
    if (added.length) parts.push(`+${added.length} added`);
    if (modified.length) parts.push(editorType === 'pills' ? `${modified.length} pill${modified.length === 1 ? '' : 's'} moved` : `~${modified.length} modified`);
    if (removed.length) parts.push(`−${removed.length} removed`);

    const summaryText = parts.length
        ? `${editorTitles[editorType] || 'Map Geometry'}: ${parts.join(', ')}`
        : `${editorTitles[editorType] || 'Map Geometry'}: No changes`;

    const hasValidBbox = bbox.every(Number.isFinite);
    return {
        editorType,
        editorTitle: editorTitles[editorType] || 'Map Geometry',
        totalChanges,
        addedCount: added.length,
        modifiedCount: modified.length,
        removedCount: removed.length,
        summaryText,
        bbox: hasValidBbox ? bbox : null,
        added: added.slice(0, 80),
        modified: modified.slice(0, 80),
        removed: removed.slice(0, 80)
    };
}

module.exports = {
    computeGeometryDiff,
    distanceMeters,
    polygonAreaM2,
    lineLengthM,
    geometryCenter
};
