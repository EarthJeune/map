import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(ROOT, '.env') });

test('Migration 0002: change_requests.status ENUM includes denied and withdrawn', async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kiosk',
        port: Number(process.env.DB_PORT || 3306)
    });
    try {
        const [rows] = await conn.query("SHOW COLUMNS FROM change_requests LIKE 'status'");
        assert.equal(rows.length, 1, 'change_requests.status column must exist');
        const colType = String(rows[0].Type || '');
        assert.ok(colType.includes("'denied'"), `Expected 'denied' in ENUM, got ${colType}`);
        assert.ok(colType.includes("'withdrawn'"), `Expected 'withdrawn' in ENUM, got ${colType}`);
    } finally {
        await conn.end();
    }
});

test('Backend API: supports Deny (No Revision) and Withdraw Request', () => {
    const api = fs.readFileSync(path.join(ROOT, 'database', 'admin_api.js'), 'utf8');
    assert.ok(api.includes("router.post('/admin/change-requests/:id/withdraw'"), 'Withdraw endpoint must exist');
    assert.ok(api.includes("['approved', 'rejected', 'denied'].includes(decision)"), 'Decide endpoint must accept denied');
    assert.ok(api.includes("WITHDRAW_CHANGE_REQUEST"), 'Withdraw action must be audited');
    assert.ok(api.includes("review_denied"), 'Deny (No Revision) must emit distinct notification type');
});

test('UI: Deny (No Revision), Withdraw, clean Facility Photos chip, and Aerial Campus Locator button', () => {
    const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
    assert.ok(html.includes('sidebar-footer-map-row'), 'Sidebar footer must group Live 3D Map and Aerial Locator');
    assert.ok(html.includes('id="sidebar-aerial-locator-btn"'), 'Sidebar must include Aerial Locator button');
    assert.ok(html.includes('openAerialCampusLocatorModal()'), 'Aerial Locator button must invoke modal handler');

    const cr = fs.readFileSync(path.join(ROOT, 'js', 'portal', 'change-requests.js'), 'utf8');
    assert.ok(cr.includes('cr-modal-deny-close-btn'), 'Reviewer modal must include Deny (No Revision) button');
    assert.ok(cr.includes('window.withdrawChangeRequestNow'), 'GIS Editors must have Withdraw Request handler');
    assert.ok(cr.includes('window.openAerialCampusLocatorModal'), 'Aerial Campus Locator modal handler must be exposed');
    assert.ok(cr.includes("d.key === 'images'"), 'Facility Photos diff chip must format image deltas cleanly');
    assert.ok(cr.includes('Denied (Closed)'), 'Stepper must render Denied (Closed) terminal state');

    const css = fs.readFileSync(path.join(ROOT, 'css', 'portal.css'), 'utf8');
    assert.ok(css.includes('.sidebar-footer-map-row'), 'CSS must style paired map/locator footer row');
    assert.ok(css.includes('overflow-wrap: anywhere'), 'CSS must wrap diff chips without mid-word clipping');
});
