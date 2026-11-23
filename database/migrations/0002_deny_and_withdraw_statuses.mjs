/**
 * Migration 0002: Add terminal 'denied' (Deny without Revision) and 'withdrawn' statuses
 * to change_requests.status ENUM. Fully reversible via down(conn).
 */

export async function up(conn) {
    await conn.query(
        `ALTER TABLE change_requests MODIFY COLUMN status ENUM('draft','pending','approved','rejected','denied','withdrawn','published','undone') NOT NULL DEFAULT 'pending'`
    );
}

export async function down(conn) {
    await conn.query(`UPDATE change_requests SET status = 'rejected' WHERE status IN ('denied', 'withdrawn')`);
    await conn.query(
        `ALTER TABLE change_requests MODIFY COLUMN status ENUM('draft','pending','approved','rejected','published','undone') NOT NULL DEFAULT 'pending'`
    );
}
