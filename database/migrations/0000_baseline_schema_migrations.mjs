/**
 * Baseline Safety Marker Migration (Phase 0)
 * Verifies reversible schema_migrations tracking and preserves pre-overhaul baseline state.
 */

export async function up(conn) {
    await conn.query(`
        CREATE TABLE IF NOT EXISTS schema_migration_notes (
            migration_name VARCHAR(255) NOT NULL PRIMARY KEY,
            notes VARCHAR(255) NOT NULL,
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(
        `INSERT INTO schema_migration_notes (migration_name, notes)
         VALUES ('0000_baseline_schema_migrations.mjs', 'Phase 0 reversible migration framework initialized')
         ON DUPLICATE KEY UPDATE notes = VALUES(notes)`
    );
}

export async function down(conn) {
    await conn.query(`DROP TABLE IF EXISTS schema_migration_notes`);
}
