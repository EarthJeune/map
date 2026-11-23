/**
 * Phase 1 Migration: Logic & Safety Foundations
 * - Version columns on buildings, building_offices, agricultural_plots, stations
 * - Station setting require_publish_for_map_editors (default 0)
 * - Test account flag is_test on admin_users & admin_audit_logs
 * - Accountability columns on admin_audit_logs & change_requests
 * - Optimistic locking (base_version), grouped drafts (status='draft', draft_group_key),
 *   delete_reason, override_reason, and 24h undo publish (published_snapshot_json, undone_at)
 * - record_versions history table for buildings, offices, plots, kiosk pins & map editors
 * - Option A permission 'reviews:suggest' granted to reviewer, administrator, super_admin
 */

async function hasColumn(conn, table, column) {
    const [rows] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
    );
    return Number(rows[0]?.cnt || 0) > 0;
}

async function addColIfMissing(conn, table, column, ddl) {
    if (!(await hasColumn(conn, table, column))) {
        await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${ddl}`);
    }
}

async function dropColIfExists(conn, table, column) {
    if (await hasColumn(conn, table, column)) {
        await conn.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
    }
}

export async function up(conn) {
    await addColIfMissing(conn, 'buildings', 'version', 'INT NOT NULL DEFAULT 1');
    await addColIfMissing(conn, 'building_offices', 'version', 'INT NOT NULL DEFAULT 1');
    await addColIfMissing(conn, 'agricultural_plots', 'version', 'INT NOT NULL DEFAULT 1');
    await addColIfMissing(conn, 'stations', 'version', 'INT NOT NULL DEFAULT 1');
    await addColIfMissing(conn, 'stations', 'require_publish_for_map_editors', 'TINYINT(1) NOT NULL DEFAULT 0');

    await addColIfMissing(conn, 'admin_users', 'is_test', 'TINYINT(1) NOT NULL DEFAULT 0');

    await addColIfMissing(conn, 'admin_audit_logs', 'actor_user_id', 'INT NULL');
    await addColIfMissing(conn, 'admin_audit_logs', 'actor_display_name', 'VARCHAR(150) NULL');
    await addColIfMissing(conn, 'admin_audit_logs', 'actor_base_role', 'VARCHAR(32) NULL');
    await addColIfMissing(conn, 'admin_audit_logs', 'actor_effective_role', 'VARCHAR(32) NULL');
    await addColIfMissing(conn, 'admin_audit_logs', 'acting_label', 'VARCHAR(120) NULL');
    await addColIfMissing(conn, 'admin_audit_logs', 'is_test', 'TINYINT(1) NOT NULL DEFAULT 0');

    await conn.query(
        `ALTER TABLE change_requests MODIFY COLUMN status ENUM('draft','pending','approved','rejected','published','undone') NOT NULL DEFAULT 'pending'`
    );
    await addColIfMissing(conn, 'change_requests', 'base_version', 'INT NOT NULL DEFAULT 1');
    await addColIfMissing(conn, 'change_requests', 'delete_reason', 'TEXT NULL');
    await addColIfMissing(conn, 'change_requests', 'override_reason', 'TEXT NULL');
    await addColIfMissing(conn, 'change_requests', 'draft_group_key', 'VARCHAR(160) NULL');
    await addColIfMissing(conn, 'change_requests', 'published_snapshot_json', 'LONGTEXT NULL');
    await addColIfMissing(conn, 'change_requests', 'undone_at', 'DATETIME NULL');
    await addColIfMissing(conn, 'change_requests', 'undone_by_email', 'VARCHAR(190) NULL');
    await addColIfMissing(conn, 'change_requests', 'actor_base_role', 'VARCHAR(32) NULL');
    await addColIfMissing(conn, 'change_requests', 'actor_effective_role', 'VARCHAR(32) NULL');
    await addColIfMissing(conn, 'change_requests', 'submitted_by_name', 'VARCHAR(150) NULL');
    await addColIfMissing(conn, 'change_requests', 'reviewed_by_name', 'VARCHAR(150) NULL');
    await addColIfMissing(conn, 'change_requests', 'published_by_name', 'VARCHAR(150) NULL');

    await conn.query(`
        CREATE TABLE IF NOT EXISTS record_versions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            station_id VARCHAR(32) NOT NULL,
            target_table VARCHAR(64) NOT NULL,
            target_id VARCHAR(128) NOT NULL,
            version_num INT NOT NULL DEFAULT 1,
            action VARCHAR(32) NOT NULL DEFAULT 'UPDATE',
            summary VARCHAR(255) NULL,
            snapshot_json LONGTEXT NOT NULL,
            change_request_id INT NULL,
            source VARCHAR(32) NOT NULL DEFAULT 'portal',
            actor_user_id INT NULL,
            actor_email VARCHAR(190) NULL,
            actor_display_name VARCHAR(150) NULL,
            actor_base_role VARCHAR(32) NULL,
            actor_effective_role VARCHAR(32) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_rv_lookup (station_id, target_table, target_id, version_num),
            INDEX idx_rv_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Grant Option A permission 'reviews:suggest' to reviewer, administrator, super_admin
    await conn.query(
        `INSERT IGNORE INTO permissions (code, resource, action, description)
         VALUES ('reviews:suggest', 'reviews', 'suggest', 'Recommend facility/directory updates to GIS Editor')`
    );
    await conn.query(`
        INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id
        FROM roles r
        JOIN permissions p ON p.code = 'reviews:suggest'
        WHERE r.slug IN ('reviewer', 'administrator', 'super_admin')
    `);
}

export async function down(conn) {
    await conn.query(`
        DELETE rp FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE p.code = 'reviews:suggest'
    `);
    await conn.query(`DELETE FROM permissions WHERE code = 'reviews:suggest'`);
    await conn.query(`DROP TABLE IF EXISTS record_versions`);

    for (const col of [
        'published_by_name', 'reviewed_by_name', 'submitted_by_name',
        'actor_effective_role', 'actor_base_role',
        'undone_by_email', 'undone_at', 'published_snapshot_json',
        'draft_group_key', 'override_reason', 'delete_reason', 'base_version'
    ]) {
        await dropColIfExists(conn, 'change_requests', col);
    }
    // Convert any draft/undone statuses back safely before narrowing enum
    await conn.query(`UPDATE change_requests SET status = 'rejected' WHERE status IN ('draft', 'undone')`);
    await conn.query(
        `ALTER TABLE change_requests MODIFY COLUMN status ENUM('pending','approved','rejected','published') NOT NULL DEFAULT 'pending'`
    );

    for (const col of ['is_test', 'acting_label', 'actor_effective_role', 'actor_base_role', 'actor_display_name', 'actor_user_id']) {
        await dropColIfExists(conn, 'admin_audit_logs', col);
    }

    await dropColIfExists(conn, 'admin_users', 'is_test');
    await dropColIfExists(conn, 'stations', 'require_publish_for_map_editors');
    await dropColIfExists(conn, 'stations', 'version');
    await dropColIfExists(conn, 'agricultural_plots', 'version');
    await dropColIfExists(conn, 'building_offices', 'version');
    await dropColIfExists(conn, 'buildings', 'version');
}
