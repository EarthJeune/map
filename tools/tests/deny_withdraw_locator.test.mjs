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
    assert.ok(api.includes("type: 'request_withdrawn'"), 'Pending withdraw must notify station reviewer(s) only');
    assert.ok(api.includes("roles: ['reviewer'], stationId: cr.station_id"), 'Withdraw notification must be scoped to assigned station reviewers');
    assert.ok(api.includes("review_denied"), 'Deny (No Revision) must emit distinct notification type');
    assert.ok(api.includes("Denied (Closed)"), 'Deny (No Revision) email must use Denied (Closed) wording');
});

test('UI: Deny (No Revision), Withdraw, clean Facility Photos chip, and Aerial Campus Locator toggle button in modals', () => {
    const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
    assert.ok(!html.includes('id="sidebar-aerial-locator-btn"'), 'Sidebar footer must stay clean without extra Aerial Locator button');
    assert.ok(html.includes('Open Live 3D Map'), 'Sidebar footer keeps single Open Live 3D Map CTA');

    const cr = fs.readFileSync(path.join(ROOT, 'js', 'portal', 'change-requests.js'), 'utf8');
    assert.ok(cr.includes('cr-modal-deny-close-btn'), 'Reviewer modal must include Deny (No Revision) button');
    assert.ok(cr.includes('window.withdrawChangeRequestNow'), 'GIS Editors must have Withdraw Request handler');
    assert.ok(cr.includes('id="cr-toggle-locator-btn"'), 'Visual Diff modal must have Aerial Campus Locator toggle button next to Open Live 3D Map');
    assert.ok(cr.includes('id="cr-aerial-locator-panel" hidden'), 'Visual Diff modal must collapse Aerial Campus Locator by default');
    assert.ok(cr.includes('id="ro-bldg-toggle-locator-btn"'), 'Building inspector modal must have Aerial Campus Locator toggle button');
    assert.ok(cr.includes('id="ro-bldg-locator-panel" hidden'), 'Building inspector modal must collapse Aerial Campus Locator by default');
    assert.ok(cr.includes('id="ro-plot-toggle-locator-btn"'), 'Plot inspector modal must have Aerial Campus Locator toggle button');
    assert.ok(cr.includes('id="ro-plot-locator-panel" hidden'), 'Plot inspector modal must collapse Aerial Campus Locator by default');
    assert.ok(cr.includes("d.key === 'images'"), 'Facility Photos diff chip must format image deltas cleanly');
    assert.ok(cr.includes('Denied (Closed)'), 'Stepper must render Denied (Closed) terminal state');

    const css = fs.readFileSync(path.join(ROOT, 'css', 'portal.css'), 'utf8');
    assert.ok(css.includes('overflow-wrap: anywhere'), 'CSS must wrap diff chips without mid-word clipping');
});

test('Privacy: Role-Only Anonymous Review + Super Admin ****@domain masking & password-verified reveal', () => {
    const api = fs.readFileSync(path.join(ROOT, 'database', 'admin_api.js'), 'utf8');
    assert.ok(api.includes('function maskStrictEmail(email)'), 'Backend must define strict ****@domain email masking');
    assert.ok(api.includes('async function sanitizeChangeRequestPrivacy(rows, adminUser)'), 'Backend must sanitize CR actor privacy');
    assert.ok(api.includes('delete clean.submitted_by_email;'), 'Backend must strip raw submitted_by_email from CR JSON');
    assert.ok(api.includes('delete clean.reviewed_by_email;'), 'Backend must strip raw reviewed_by_email from CR JSON');
    assert.ok(api.includes("router.post('/admin/change-requests/:id/reveal-identity'"), 'Backend must expose Super Admin reveal-identity route');
    assert.ok(api.includes('REVEAL_CR_IDENTITY'), 'Reveal-identity access must be audited');

    const cr = fs.readFileSync(path.join(ROOT, 'js', 'portal', 'change-requests.js'), 'utf8');
    assert.ok(cr.includes('function renderCrActorHtml('), 'UI must render actor identity via privacy-aware helper');
    assert.ok(cr.includes('window.promptRevealCrIdentity'), 'UI must prompt Super Admin password to reveal identity');
    assert.ok(!cr.includes('r.submitted_by_email'), 'UI must not read raw r.submitted_by_email');
    assert.ok(!cr.includes('cr.reviewed_by_email'), 'UI must not read raw cr.reviewed_by_email');
});
