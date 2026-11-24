import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const { computeGeometryDiff } = require(path.join(ROOT, 'database', 'geometry_diff.js'));

const squarePoly = (lng, lat, d = 0.0001) => ({
    type: 'Polygon',
    coordinates: [[
        [lng, lat],
        [lng + d, lat],
        [lng + d, lat + d],
        [lng, lat + d],
        [lng, lat]
    ]]
});

test('computeGeometryDiff: auto-detects pill-only moves and computes shift & compass direction', () => {
    const prev = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: { building_code: 'tanco_hall_building', num: 12, name: 'Tanco Hall', marker_coords: [121.16650, 13.95820] },
            geometry: squarePoly(121.16650, 13.95820)
        }]
    };
    const next = {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: { building_code: 'tanco_hall_building', num: 12, name: 'Tanco Hall', marker_coords: [121.16655, 13.95825] },
            geometry: squarePoly(121.16650, 13.95820)
        }]
    };

    const diff = computeGeometryDiff('buildings', prev, next);
    assert.equal(diff.editorType, 'pills');
    assert.equal(diff.totalChanges, 1);
    assert.equal(diff.modifiedCount, 1);
    assert.equal(diff.modified[0].changeKind, 'pill_moved');
    assert.equal(diff.modified[0].direction, 'NE');
    assert.ok(diff.modified[0].shiftM > 5 && diff.modified[0].shiftM < 10, `Unexpected shiftM: ${diff.modified[0].shiftM}`);
    assert.ok(Array.isArray(diff.bbox) && diff.bbox.length === 4);
    assert.match(diff.summaryText, /Pill Label Offsets: 1 pill moved/);
});

test('computeGeometryDiff: detects building footprint addition, area expansion, and removal', () => {
    const prev = {
        type: 'FeatureCollection',
        features: [
            { type: 'Feature', properties: { building_code: 'b1', name: 'Admin' }, geometry: squarePoly(121.1660, 13.9580, 0.0001) },
            { type: 'Feature', properties: { building_code: 'b2', name: 'Old Shed' }, geometry: squarePoly(121.1663, 13.9580, 0.0001) }
        ]
    };
    const next = {
        type: 'FeatureCollection',
        features: [
            { type: 'Feature', properties: { building_code: 'b1', name: 'Admin' }, geometry: squarePoly(121.1660, 13.9580, 0.0002) },
            { type: 'Feature', properties: { building_code: 'b3', name: 'New Lab' }, geometry: squarePoly(121.1666, 13.9582, 0.0001) }
        ]
    };

    const diff = computeGeometryDiff('buildings', prev, next);
    assert.equal(diff.editorType, 'buildings');
    assert.equal(diff.addedCount, 1);
    assert.equal(diff.modifiedCount, 1);
    assert.equal(diff.removedCount, 1);
    assert.equal(diff.totalChanges, 3);
    assert.ok(diff.modified[0].areaDeltaM2 > 100, 'Expected positive area delta');
    assert.equal(diff.added[0].label, 'New Lab');
    assert.equal(diff.removed[0].label, 'Old Shed');
});

test('computeGeometryDiff: tracks road line length deltas and entrance moves', () => {
    const prev = {
        type: 'FeatureCollection',
        features: [
            { type: 'Feature', properties: { id: 'road_1', name: 'Main Spine' }, geometry: { type: 'LineString', coordinates: [[121.1660, 13.9580], [121.1665, 13.9580]] } }
        ]
    };
    const next = {
        type: 'FeatureCollection',
        features: [
            { type: 'Feature', properties: { id: 'road_1', name: 'Main Spine' }, geometry: { type: 'LineString', coordinates: [[121.1660, 13.9580], [121.1670, 13.9580]] } },
            { type: 'Feature', properties: { id: 'ent_new', type: 'entrance', buildingName: 'Tanco Hall' }, geometry: { type: 'Point', coordinates: [121.1668, 13.9581] } }
        ]
    };

    const diff = computeGeometryDiff('roads', prev, next);
    assert.equal(diff.editorType, 'roads');
    assert.equal(diff.addedCount, 1);
    assert.equal(diff.modifiedCount, 1);
    assert.ok(diff.modified[0].lengthDeltaM > 40, `Expected positive length delta, got ${diff.modified[0].lengthDeltaM}`);
});

test('computeGeometryDiff: tracks agricultural plots and 3D trees and detects no-op saves', () => {
    const trees = {
        type: 'FeatureCollection',
        features: [
            { type: 'Feature', properties: { id: 't1', species: 'Mango', scale: 1.2 }, geometry: { type: 'Point', coordinates: [121.1664, 13.9584] } }
        ]
    };
    const noop = computeGeometryDiff('trees', trees, trees);
    assert.equal(noop.totalChanges, 0);

    const treesNext = {
        type: 'FeatureCollection',
        features: [
            ...trees.features,
            { type: 'Feature', properties: { id: 't2', species: 'Coconut', scale: 1.5 }, geometry: { type: 'Point', coordinates: [121.1666, 13.9586] } }
        ]
    };
    const treeDiff = computeGeometryDiff('trees', trees, treesNext);
    assert.equal(treeDiff.addedCount, 1);
    assert.match(treeDiff.added[0].label, /Coconut/);
});

test('Approval pipeline wiring: server.js, publish_engine.js, admin_api.js, change-requests.js, and 5 editors', () => {
    const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const pubSrc = fs.readFileSync(path.join(ROOT, 'database', 'publish_engine.js'), 'utf8');
    const apiSrc = fs.readFileSync(path.join(ROOT, 'database', 'admin_api.js'), 'utf8');
    const crSrc = fs.readFileSync(path.join(ROOT, 'js', 'portal', 'change-requests.js'), 'utf8');
    const bridgeSrc = fs.readFileSync(path.join(ROOT, 'js', 'portal', 'editor-bridge.js'), 'utf8');

    // All 8 visual editor routes invoke maybeQueueVisualEditorForReview
    const queueMatches = serverSrc.match(/maybeQueueVisualEditorForReview\(/g) || [];
    assert.ok(queueMatches.length >= 9, `Expected definition + 8 route calls, found ${queueMatches.length}`);

    // Publish engine & admin_api whitelist handle map_geometry
    assert.match(pubSrc, /targetTable === 'map_geometry'/);
    assert.match(apiSrc, /'map_geometry'/);

    // Reviewer Aerial Visual Diff Map UI
    assert.match(crSrc, /function renderMapGeomVisualDiffHtml/);
    assert.match(crSrc, /function mountMapGeomVisualDiffMap/);
    assert.match(crSrc, /cr-geom-diff-map/);
    assert.match(crSrc, /data-geom-mode="overlay"/);

    // Editor bridge role-aware confirmSave & X-Submit-For-Review
    assert.match(bridgeSrc, /X-Submit-For-Review/);
    assert.match(bridgeSrc, /formatSaveResultMessage/);

    // All 5 visual editors load updated editor-bridge.js?v=306
    for (const f of ['pill_adjust.html', 'draw.html', 'plot_draw.html', 'road_draw.html', 'tree_draw.html']) {
        const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
        assert.match(html, /editor-bridge\.js\?v=306/, `${f} should load editor-bridge.js?v=306`);
    }
});
