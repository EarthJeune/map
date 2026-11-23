import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Migration 0006: Keep strictly 1 primary WebP photo per DA-RARES building
 *
 * Removes extra secondary RARES photos (display_order > 1) so each of the 39
 * singular DA-RARES buildings has 1 clean primary front photo with blank caption.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MANIFEST_PATH = path.resolve(__dirname, '..', '..', 'tools', 'rares_photos_manifest.json');

export async function up(conn) {
    await conn.query(`DELETE FROM building_images WHERE station_id = 'rares' AND display_order > 1`);
    await conn.query(`UPDATE building_images SET caption = '', is_primary = 1, display_order = 1 WHERE station_id = 'rares'`);
}

export async function down(conn) {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    await conn.query(`DELETE FROM building_images WHERE station_id = 'rares'`);
    for (const [code, entries] of Object.entries(manifest)) {
        for (const item of entries) {
            await conn.query(
                `INSERT INTO building_images (station_id, building_code, image_webp_url, caption, display_order, is_primary)
                 VALUES ('rares', ?, ?, '', ?, ?)`,
                [code, item.image_webp_url, Number(item.display_order || 1), item.is_primary ? 1 : 0]
            );
        }
    }
}
