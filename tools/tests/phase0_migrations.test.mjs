import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportSchemaSnapshot } from '../../database/migrations/schema_snapshot.mjs';
import {
    createDbConnection,
    runUp,
    runDown,
    getMigrationStatus
} from '../../database/migrations/migrate.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'database', 'migrations');

test('Phase 0: MySQL live schema backup exports core governance and spatial tables', async () => {
    const res = await exportSchemaSnapshot();
    assert.ok(fs.existsSync(res.path), 'Schema backup file should exist on disk');
    const sql = fs.readFileSync(res.path, 'utf8');
    for (const tbl of ['admin_users', 'buildings', 'building_offices', 'agricultural_plots', 'change_requests', 'admin_audit_logs', 'notifications', 'stations']) {
        assert.ok(res.tables.includes(tbl), `Live schema should include table ${tbl}`);
        assert.match(sql, new RegExp(`CREATE TABLE \\\`${tbl}\\\``), `Backup SQL should include DDL for ${tbl}`);
    }
});

test('Phase 0: reversible migration runner supports up -> rollback -> re-apply cleanly', async () => {
    const conn = await createDbConnection();
    const target = '0000_baseline_schema_migrations.mjs';
    try {
        await runDown(conn, MIGRATIONS_DIR, target);

        const applied = await runUp(conn, MIGRATIONS_DIR, { targetName: target });
        assert.deepEqual(applied, [target]);

        const afterUp = await getMigrationStatus(conn, MIGRATIONS_DIR);
        const entryUp = afterUp.find(s => s.name === target);
        assert.equal(entryUp?.applied, true);

        const [noteTablesUp] = await conn.query(`SHOW TABLES LIKE 'schema_migration_notes'`);
        assert.equal(noteTablesUp.length, 1);

        const rolledBack = await runDown(conn, MIGRATIONS_DIR, target);
        assert.deepEqual(rolledBack, [target]);

        const [noteTablesDown] = await conn.query(`SHOW TABLES LIKE 'schema_migration_notes'`);
        assert.equal(noteTablesDown.length, 0);

        const reApplied = await runUp(conn, MIGRATIONS_DIR, { targetName: target });
        assert.deepEqual(reApplied, [target]);
    } finally {
        await conn.end();
    }
});
