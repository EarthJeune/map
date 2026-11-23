import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatHumanRequestTitle, parseReviewerFeedback } from '../../js/portal/diff-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORTAL_DIR = path.resolve(__dirname, '..', '..', 'js', 'portal');

test('2.1 Human-readable request titles cover photos, text updates, and deletes', () => {
    assert.equal(
        formatHumanRequestTitle({
            target_table: 'building_images',
            action: 'CREATE',
            payload_json: JSON.stringify({ image_webp_url: 'images/guard_b.webp' })
        }, 'Guard House B'),
        'Added a photo to Guard House B'
    );

    assert.equal(
        formatHumanRequestTitle({
            target_table: 'building_images',
            action: 'DELETE',
            payload_json: JSON.stringify({ image_webp_url: 'images/guard_b.webp' })
        }, 'Guard House B'),
        'Removed 1 photo from Guard House B'
    );

    assert.equal(
        formatHumanRequestTitle({
            target_table: 'buildings',
            action: 'UPDATE',
            previous_json: JSON.stringify({ name: 'Admin Building', description: 'Old text' }),
            payload_json: JSON.stringify({ name: 'Admin Building', description: 'New text' })
        }, 'Admin Building'),
        'Updated description of Admin Building'
    );

    assert.equal(
        formatHumanRequestTitle({
            target_table: 'buildings',
            action: 'UPDATE',
            previous_json: JSON.stringify({ name: 'Guard House B', images: [{ image_webp_url: 'images/a.webp' }] }),
            payload_json: JSON.stringify({ name: 'Guard House B', images: [] })
        }, 'Guard House B'),
        'Removed 1 photo from Guard House B'
    );
});

test('2.3 Reviewer feedback parser turns flagged checklist + note into readable list', () => {
    const parsed = parseReviewerFeedback('Flagged for revision: [Directory Description, Photos] — Please crop the front entrance closer');
    assert.deepEqual(parsed.items, ['Directory Description', 'Photos']);
    assert.equal(parsed.note, 'Please crop the front entrance closer');
});

test('2.2 & 2.3 Banned developer jargon strings are removed from portal UI modules', () => {
    const banned = [
        'Database CRUD Modules',
        'Facility WebP Photos',
        'GLB models',
        'road nodes',
        'Fact-Checked Station Workspace',
        'Standalone (0 Offices)',
        '3D GLB Ready',
        'Edit Footprint in draw.html',
        'Verified on Disk',
        'Governance Queue',
        'General Floor',
        'Add Verified Office',
        'Count unset'
    ];

    const files = fs.readdirSync(PORTAL_DIR).filter(f => f.endsWith('.js'));
    const hits = [];
    for (const file of files) {
        const src = fs.readFileSync(path.join(PORTAL_DIR, file), 'utf8');
        for (const phrase of banned) {
            if (src.includes(phrase)) {
                hits.push(`${file}: "${phrase}"`);
            }
        }
    }
    assert.deepEqual(hits, [], `Found leftover developer jargon: ${hits.join(', ')}`);
});
