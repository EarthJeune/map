/**
 * Migration 0007: Super Admin Station Open/Close & Staff Editing Lock
 *
 * - Expands stations.status ENUM to ('live', 'under_development', 'maintenance')
 *   so Super Admin can open/close stations for maintenance/fixing.
 * - Adds stations.editing_locked TINYINT(1) DEFAULT 0 so Super Admin can lock
 *   non-Super-Admin staff (GIS Editors & Reviewers) from editing unfinished or
 *   under-maintenance stations (defaults DA-CARES to editing_locked = 1).
 */

export async function up(conn) {
    await conn.query(`
        ALTER TABLE stations
        MODIFY COLUMN status ENUM('live', 'under_development', 'maintenance') DEFAULT 'under_development'
    `);
    const [cols] = await conn.query(`SHOW COLUMNS FROM stations LIKE 'editing_locked'`);
    if (!Array.isArray(cols) || cols.length === 0) {
        await conn.query(`
            ALTER TABLE stations
            ADD COLUMN editing_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER status
        `);
    }
    await conn.query(`UPDATE stations SET editing_locked = 1 WHERE station_id = 'cares'`);
}

export async function down(conn) {
    await conn.query(`UPDATE stations SET status = 'under_development' WHERE status = 'maintenance'`);
    const [cols] = await conn.query(`SHOW COLUMNS FROM stations LIKE 'editing_locked'`);
    if (Array.isArray(cols) && cols.length > 0) {
        await conn.query(`ALTER TABLE stations DROP COLUMN editing_locked`);
    }
    await conn.query(`
        ALTER TABLE stations
        MODIFY COLUMN status ENUM('live', 'under_development') DEFAULT 'under_development'
    `);
}
