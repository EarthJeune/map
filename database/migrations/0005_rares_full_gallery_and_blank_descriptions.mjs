import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Migration 0005: Sync all 212 WebP photos for DA-RARES buildings & blank RARES descriptions
 *
 * - Replaces station_id='rares' rows in building_images with all converted WebP photos
 *   from tools/rares_photos_manifest.json (212 images across all 39 singular RARES buildings).
 * - Blanks description, visual_landmark, and key_services for all DA-RARES buildings so
 *   station staff / GIS Editors can author verified descriptions cleanly via the Admin Portal.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MANIFEST_PATH = path.resolve(__dirname, '..', '..', 'tools', 'rares_photos_manifest.json');

export async function up(conn) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

    await conn.query(`DELETE FROM building_images WHERE station_id = 'rares'`);

    for (const [code, entries] of Object.entries(manifest)) {
        for (const item of entries) {
            await conn.query(
                `INSERT INTO building_images (station_id, building_code, image_webp_url, caption, display_order, is_primary)
                 VALUES ('rares', ?, ?, ?, ?, ?)`,
                [code, item.image_webp_url, item.caption || '', Number(item.display_order || 1), item.is_primary ? 1 : 0]
            );
        }
    }

    await conn.query(
        `UPDATE buildings
         SET description = '', visual_landmark = '', key_services = ''
         WHERE station_id = 'rares'`
    );
}

export async function down(conn) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    await conn.query(`DELETE FROM building_images WHERE station_id = 'rares'`);
    for (const [code, entries] of Object.entries(manifest)) {
        const primary = entries[0];
        if (!primary) continue;
        await conn.query(
            `INSERT INTO building_images (station_id, building_code, image_webp_url, caption, display_order, is_primary)
             VALUES ('rares', ?, ?, 'Primary Facility View', 1, 1)`,
            [code, primary.image_webp_url]
        );
    }
    await conn.query(
        `UPDATE buildings
         SET description = 'DA-RARES Research Facility', visual_landmark = NULL, key_services = NULL
         WHERE station_id = 'rares'`
    );
}
