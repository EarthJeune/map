/**
 * Pre-Launch Clean-Slate Reset Utility for iGUIDE Governance Tables
 *
 * Clears testing rows from `change_requests` and `notifications`, and resets
 * `change_requests` AUTO_INCREMENT back to 1 so production submissions start cleanly at #1.
 *
 * Usage:
 *   node tools/reset_test_governance_data.mjs --confirm
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
require(path.join(rootDir, 'node_modules/dotenv')).config({ path: path.join(rootDir, '.env') });
const mysql = require(path.join(rootDir, 'node_modules/mysql2/promise'));

async function main() {
    const confirmed = process.argv.includes('--confirm');
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kiosk'
    });

    try {
        const [[crCount]] = await pool.query('SELECT COUNT(*) AS cnt FROM change_requests');
        const [[notifCount]] = await pool.query('SELECT COUNT(*) AS cnt FROM notifications');
        const [[aiInfo]] = await pool.query(
            "SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'change_requests'"
        );

        console.log('Current Governance Test Data:');
        console.log(`  change_requests rows: ${crCount.cnt} (next ID = #${aiInfo.AUTO_INCREMENT})`);
        console.log(`  notifications rows:   ${notifCount.cnt}`);

        if (!confirmed) {
            console.log('\nDry-run only. Re-run with --confirm to clear test requests/notifications and reset Request IDs to #1:');
            console.log('  node tools/reset_test_governance_data.mjs --confirm');
            return;
        }

        await pool.query('DELETE FROM notifications');
        await pool.query('DELETE FROM change_requests');
        await pool.query('ALTER TABLE change_requests AUTO_INCREMENT = 1');
        await pool.query('ALTER TABLE notifications AUTO_INCREMENT = 1');

        console.log('\n✅ Clean-slate reset complete! Next Change Request will start at #1.');
    } finally {
        await pool.end();
    }
}

main().catch(err => {
    console.error('Reset failed:', err.message);
    process.exit(1);
});

