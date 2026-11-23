import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
    computeSnapshotBeforeAfter,
    hasGeometryActuallyChanged,
    countRealBuildingChanges
} from '../../js/portal/diff-utils.js';
import { createDbConnection } from '../../database/migrations/migrate.mjs';

const require = createRequire(import.meta.url);
const phase1 = require('../../database/phase1_safety.js');

test('1.1 Snapshot diff: Request #65 (add photo to Guard House B) keeps Before at submit-time state even when live DB already has the photo', () => {
    const photoOld = { image_webp_url: 'images/guard_house_b_old.webp', caption: 'Front View' };
    const photoNew = { image_webp_url: 'images/guard_house_b_new.webp', caption: 'Side Gate' };

    // Live DB already contains BOTH photos (e.g. after publish)
    const liveBuildingRecord = {
        id: 42,
        building_code: 'guard_house_b',
        name: 'Guard House B',
        images: [photoOld, photoNew]
    };

    // Case A: building_images CREATE request with submit-time previous_json snapshot
    const crPhotoAdd = {
        id: 65,
        target_table: 'building_images',
        action: 'CREATE',
        previous_json: JSON.stringify({ id: 42, building_code: 'guard_house_b', name: 'Guard House B', images: [photoOld] }),
        payload_json: JSON.stringify({ building_code: 'guard_house_b', image_webp_url: photoNew.image_webp_url, caption: photoNew.caption })
    };
    const { beforeState: b1, afterState: a1 } = computeSnapshotBeforeAfter(crPhotoAdd, liveBuildingRecord);
    assert.equal(b1.images.length, 1, 'Before must only contain the 1 submit-time photo');
    assert.equal(b1.images[0].image_webp_url, photoOld.image_webp_url);
    assert.equal(a1.images.length, 2, 'After must contain both photos');
    assert.equal(a1.images[1].image_webp_url, photoNew.image_webp_url);

    // Case B: buildings UPDATE request adding a photo
    const crBldgUpdate = {
        id: 65,
        target_table: 'buildings',
        action: 'UPDATE',
        previous_json: JSON.stringify({ id: 42, building_code: 'guard_house_b', name: 'Guard House B', images: [photoOld] }),
        payload_json: JSON.stringify({ name: 'Guard House B', images: [photoOld, photoNew] })
    };
    const { beforeState: b2, afterState: a2 } = computeSnapshotBeforeAfter(crBldgUpdate, liveBuildingRecord);
    assert.equal(b2.images.length, 1);
    assert.equal(a2.images.length, 2);
});

test('1.2 Conflicting requests & stale base_version guard', async () => {
    const staleBlocked = phase1.evaluateStaleBaseGuard({ baseVersion: 1, liveVersion: 3, action: 'UPDATE', overrideReason: '' });
    assert.equal(staleBlocked.allowed, false);
    assert.equal(staleBlocked.statusCode, 409);

    const staleOverridden = phase1.evaluateStaleBaseGuard({ baseVersion: 1, liveVersion: 3, action: 'UPDATE', overrideReason: 'Verified non-overlapping field edits' });
    assert.equal(staleOverridden.allowed, true);
    assert.equal(staleOverridden.overridden, true);

    const fakeQuery = async (sql) => {
        if (sql.includes('FROM buildings')) return [{ id: 99, station_id: 'lares', building_code: 'guard_house_b', version: 2 }];
        return [];
    };
    const enriched = await phase1.attachConflictMetadata(fakeQuery, [
        { id: 64, station_id: 'lares', target_table: 'buildings', target_id: '99', action: 'UPDATE', status: 'pending', base_version: 1, summary: 'Edit desc', submitted_by_name: 'Editor A' },
        { id: 65, station_id: 'lares', target_table: 'buildings', target_id: '99', action: 'UPDATE', status: 'pending', base_version: 2, summary: 'Add photo', submitted_by_name: 'Editor B' }
    ]);
    assert.equal(enriched[0].is_stale_base, true);
    assert.equal(enriched[0].conflicts.length, 1);
    assert.equal(enriched[0].conflicts[0].id, 65);
    assert.equal(enriched[1].is_stale_base, false);
    assert.equal(enriched[1].conflicts.length, 1);
    assert.equal(enriched[1].conflicts[0].id, 64);
});

test('1.3 Accurate geometry change label and View Result & Changes (n) counter', () => {
    const poly = { type: 'Polygon', coordinates: [[[121.166, 13.958], [121.167, 13.958], [121.167, 13.959], [121.166, 13.958]]] };
    const polyMoved = { type: 'Polygon', coordinates: [[[121.1665, 13.9585], [121.1675, 13.9585], [121.1675, 13.9595], [121.1665, 13.9585]]] };

    assert.equal(hasGeometryActuallyChanged({ footprint_geojson: JSON.stringify(poly) }, { description: 'Only text changed' }, 'UPDATE'), false);
    assert.equal(hasGeometryActuallyChanged({ footprint_geojson: JSON.stringify(poly) }, { footprint_geojson: JSON.stringify(poly) }, 'UPDATE'), false);
    assert.equal(hasGeometryActuallyChanged({ footprint_geojson: JSON.stringify(poly) }, { footprint_geojson: JSON.stringify(polyMoved) }, 'UPDATE'), true);

    const orig = { name: 'Guard House B', description: 'Main gate', pin_color: '#10b981', model_glb_url: 'models/guard_house.glb?v=1' };
    const sameForm = { name: 'Guard House B', description: 'Main gate', pin_color: '#10B981', model_glb_url: 'models/guard_house.glb' };
    const origPhotos = [{ image_webp_url: 'images/a.webp', caption: 'Front' }];

    assert.equal(countRealBuildingChanges(orig, sameForm, origPhotos, [...origPhotos]), 0, 'Counter must be 0 before any edit');
    assert.equal(countRealBuildingChanges(orig, { ...sameForm, description: 'Updated gate' }, origPhotos, [...origPhotos]), 1);
    assert.equal(
        countRealBuildingChanges(orig, { ...sameForm, description: 'Updated gate' }, origPhotos, [...origPhotos, { image_webp_url: 'images/b.webp', caption: 'Side' }]),
        2
    );
});

test('1.4 Role accountability (acting as) and self-approval block + Super Admin override', () => {
    const meta = phase1.formatActorAuditMeta({
        userId: 1,
        email: 'super@da.gov.ph',
        fullName: 'Earth Jeune Layola',
        baseRole: 'super_admin',
        role: 'reviewer',
        isTest: 0
    });
    assert.equal(meta.actingLabel, 'Super Admin acting as Reviewer');

    const selfBlockedReviewer = phase1.evaluateSelfActionGuard({
        submittedByUserId: 7,
        actorUser: { userId: 7, baseRole: 'reviewer', role: 'reviewer' },
        overrideReason: 'trying anyway',
        actionLabel: 'approve'
    });
    assert.equal(selfBlockedReviewer.allowed, false);
    assert.equal(selfBlockedReviewer.code, 'SELF_ACTION_BLOCKED');

    const superNoReason = phase1.evaluateSelfActionGuard({
        submittedByUserId: 1,
        actorUser: { userId: 1, baseRole: 'super_admin', role: 'reviewer' },
        overrideReason: '',
        actionLabel: 'approve'
    });
    assert.equal(superNoReason.allowed, false);
    assert.equal(superNoReason.code, 'SELF_ACTION_OVERRIDE_REQUIRED');

    const superWithReason = phase1.evaluateSelfActionGuard({
        submittedByUserId: 1,
        actorUser: { userId: 1, baseRole: 'super_admin', role: 'reviewer' },
        overrideReason: 'Emergency field correction verified on-site',
        actionLabel: 'approve'
    });
    assert.equal(superWithReason.allowed, true);
    assert.equal(superWithReason.overridden, true);
});

test('1.5 Undo publish 24h window and live record_versions storage', async () => {
    const now = Date.now();
    assert.equal(phase1.isWithinUndoWindow(new Date(now - 60 * 60 * 1000).toISOString(), now), true);
    assert.equal(phase1.isWithinUndoWindow(new Date(now - 25 * 60 * 60 * 1000).toISOString(), now), false);

    const conn = await createDbConnection();
    let insertedId = null;
    try {
        const queryFn = async (sql, params) => {
            const [rows] = await conn.query(sql, params);
            return rows;
        };
        insertedId = await phase1.recordEntityVersion(queryFn, {
            stationId: 'lares',
            targetTable: 'buildings',
            targetId: 'phase1_test_probe',
            versionNum: 1,
            action: 'UPDATE',
            summary: 'Phase 1 automated test version probe',
            snapshot: { name: 'Probe' },
            source: 'portal',
            adminUser: { userId: 1, email: 'test@example.com', fullName: 'Test Runner', baseRole: 'super_admin', role: 'reviewer', isTest: 1 }
        });
        assert.ok(insertedId > 0, 'record_versions insert should return insertId');
        const [rows] = await conn.query(`SELECT * FROM record_versions WHERE id = ?`, [insertedId]);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].actor_base_role, 'super_admin');
        assert.equal(rows[0].actor_effective_role, 'reviewer');
    } finally {
        if (insertedId) {
            await conn.query(`DELETE FROM record_versions WHERE id = ?`, [insertedId]);
        }
        await conn.end();
    }
});

test('1.7 Delete confirmation requires a written reason', () => {
    assert.equal(phase1.validateDeleteReason('').valid, false);
    assert.equal(phase1.validateDeleteReason('  ').valid, false);
    assert.equal(phase1.validateDeleteReason('no').valid, false);
    assert.equal(phase1.validateDeleteReason('Removed outdated duplicate photo').valid, true);
});
