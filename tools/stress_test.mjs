#!/usr/bin/env node
/**
 * iGUIDE 1,000-Burst HTTP Load, OTP Flood, Idempotency & Publish-Race Stress Tester
 * Usage: node tools/stress_test.mjs
 */

import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TEST_PORT = Number(process.env.STRESS_PORT || 18100);
const HOST = '127.0.0.1';

function sha256(s) {
    return crypto.createHash('sha256').update(String(s || ''), 'utf8').digest('hex');
}

function hashScrypt(pw) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(pw, salt, 64).toString('hex');
    return `scrypt$${salt}$${derived}`;
}

function httpRequest({ method = 'GET', reqPath, headers = {}, body = null, agent }) {
    return new Promise((resolve) => {
        const t0 = process.hrtime.bigint();
        const payload = body !== null ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
        const reqHeaders = {
            ...(payload !== null ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(payload)) } : {}),
            ...headers
        };
        const req = http.request({
            hostname: HOST,
            port: TEST_PORT,
            path: reqPath,
            method,
            headers: reqHeaders,
            agent
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const ms = Number(process.hrtime.bigint() - t0) / 1e6;
                resolve({ status: res.statusCode || 0, ms, body: Buffer.concat(chunks) });
            });
        });
        req.setTimeout(15000, () => {
            req.destroy(new Error('timeout'));
        });
        req.on('error', () => {
            const ms = Number(process.hrtime.bigint() - t0) / 1e6;
            resolve({ status: 0, ms, body: Buffer.alloc(0) });
        });
        if (payload !== null) req.write(payload);
        req.end();
    });
}

async function runConcurrentBurst({ name, total, concurrency, makeRequest }) {
    const agent = new http.Agent({ keepAlive: true, maxSockets: Math.min(concurrency, 256) });
    const latencies = [];
    const counts = {};
    let nextIdx = 0;
    const tStart = process.hrtime.bigint();

    async function worker() {
        while (true) {
            const idx = nextIdx++;
            if (idx >= total) break;
            const res = await makeRequest(idx, agent);
            const k = String(res.status);
            counts[k] = (counts[k] || 0) + 1;
            latencies.push(res.ms);
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
    await Promise.all(workers);
    agent.destroy();

    const wallMs = Number((Number(process.hrtime.bigint() - tStart) / 1e6).toFixed(1));
    latencies.sort((a, b) => a - b);
    const pick = (p) => Number((latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] || 0).toFixed(1));
    const server5xx = Object.entries(counts)
        .filter(([k]) => Number(k) === 0 || Number(k) >= 500)
        .reduce((acc, [, v]) => acc + v, 0);

    return {
        name,
        total,
        concurrency,
        wallMs,
        rps: wallMs > 0 ? Math.round((total / wallMs) * 1000) : 0,
        p50Ms: pick(0.5),
        p95Ms: pick(0.95),
        p99Ms: pick(0.99),
        maxMs: pick(1.0),
        counts,
        server5xx
    };
}

async function waitForServer(timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const res = await httpRequest({ reqPath: '/api/version' });
        if (res.status === 200) return;
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Test server on ${HOST}:${TEST_PORT} failed to start`);
}

async function main() {
    let db = null;
    let srv = null;
    let maxBefore = null;
    const tag = `stress_${Date.now()}`;
    const testPass = 'StressTest!2026';

    try {
        db = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT || 3306),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'kiosk'
        });

        const [[uMax]] = await db.query('SELECT COALESCE(MAX(id),0) m FROM admin_users');
        const [[auMax]] = await db.query('SELECT COALESCE(MAX(id),0) m FROM admin_audit_logs');
        const [[crMax]] = await db.query('SELECT COALESCE(MAX(id),0) m FROM change_requests');
        const [[nfMax]] = await db.query('SELECT COALESCE(MAX(id),0) m FROM notifications');
        const [[verRow]] = await db.query("SELECT `value` FROM settings WHERE `key` = 'data_version' LIMIT 1");
        const [tables] = await db.query("SHOW TABLES");
        const tableNames = tables.map((row) => Object.values(row)[0]);
        const hasLoginAttemptsTbl = tableNames.includes('user_login_logs');
        const laMax = hasLoginAttemptsTbl
            ? (await db.query('SELECT COALESCE(MAX(id),0) m FROM user_login_logs'))[0][0].m
            : 0;

        maxBefore = {
            users: Number(uMax.m),
            audit: Number(auMax.m),
            cr: Number(crMax.m),
            notif: Number(nfMax.m),
            loginAudit: Number(laMax),
            hasLoginAttemptsTbl,
            dataVersion: verRow ? verRow.value : null
        };

        const edEmail = `${tag}_ed@example.com`;
        const admEmail = `${tag}_adm@example.com`;
        const edTok = crypto.randomBytes(32).toString('hex');
        const admTok = crypto.randomBytes(32).toString('hex');

        const [[edRole]] = await db.query("SELECT id FROM roles WHERE slug='gis_editor'");
        const [[admRole]] = await db.query("SELECT id FROM roles WHERE slug='administrator'");
        const [edRes] = await db.query(
            "INSERT INTO admin_users (username_sha256, password_sha256, role, email, full_name, station_id, approval_status, is_active) VALUES (?, ?, 'gis_editor', ?, 'Stress Test Editor', 'lares', 'approved', 1)",
            [sha256(edEmail), hashScrypt(testPass), edEmail]
        );
        await db.query("INSERT INTO user_roles (user_id, role_id, station_scope) VALUES (?, ?, 'lares')", [edRes.insertId, edRole.id]);
        await db.query(
            "INSERT INTO admin_sessions (token, username_sha256, user_id, role, base_role, switched_role, station_id, email, expires_at, revoked) VALUES (?, ?, ?, 'gis_editor', 'gis_editor', NULL, 'lares', ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), 0)",
            [edTok, sha256(edEmail), edRes.insertId, edEmail]
        );

        const [admRes] = await db.query(
            "INSERT INTO admin_users (username_sha256, password_sha256, role, email, full_name, station_id, approval_status, is_active) VALUES (?, ?, 'administrator', ?, 'Stress Test Admin', 'all', 'approved', 1)",
            [sha256(admEmail), hashScrypt(testPass), admEmail]
        );
        await db.query("INSERT INTO user_roles (user_id, role_id, station_scope) VALUES (?, ?, 'all')", [admRes.insertId, admRole.id]);
        await db.query(
            "INSERT INTO admin_sessions (token, username_sha256, user_id, role, base_role, switched_role, station_id, email, expires_at, revoked) VALUES (?, ?, ?, 'administrator', 'administrator', NULL, 'all', ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), 0)",
            [admTok, sha256(admEmail), admRes.insertId, admEmail]
        );

        const [approvedCr] = await db.query(
            "INSERT INTO change_requests (station_id, target_table, target_id, action, summary, payload_json, status, submitted_by_email, submitted_by_user_id) VALUES ('lares', 'system_stress_test', ?, 'NOTE', 'Stress Publish Race Fixture', '{}', 'approved', ?, ?)",
            [tag, edEmail, edRes.insertId]
        );

        srv = spawn('node', [path.join(ROOT, 'server.js'), '--no-tunnel'], {
            cwd: ROOT,
            env: { ...process.env, PORT: String(TEST_PORT), NO_TUNNEL: '1', SMTP_USER: '', SMTP_APP_PASSWORD: '' },
            stdio: 'ignore'
        });
        await waitForServer();

        const results = [];

        // 1a. Cold Cache Thundering-Herd Singleflight (250 simultaneous cold hits)
        const r1Cold = await runConcurrentBurst({
            name: '250x Cold GET /api/bootstrap?station=lares (Singleflight)',
            total: 250,
            concurrency: 250,
            makeRequest: (_, agent) => httpRequest({
                reqPath: '/api/bootstrap?station=lares',
                headers: { 'Accept-Encoding': 'gzip' },
                agent
            })
        });
        results.push(r1Cold);

        // 1b. 1,000-Burst Warm Public Bootstrap
        const r1 = await runConcurrentBurst({
            name: '1,000x Warm GET /api/bootstrap?station=lares',
            total: 1000,
            concurrency: 250,
            makeRequest: (_, agent) => httpRequest({
                reqPath: '/api/bootstrap?station=lares',
                headers: { 'Accept-Encoding': 'gzip' },
                agent
            })
        });
        results.push(r1);

        // 2. 1,000-Burst Version Poll
        const r2 = await runConcurrentBurst({
            name: '1,000x GET /api/version',
            total: 1000,
            concurrency: 250,
            makeRequest: (_, agent) => httpRequest({ reqPath: '/api/version', agent })
        });
        results.push(r2);

        // 3. 500-Burst MBTiles Drone Tiles
        const r3 = await runConcurrentBurst({
            name: '500x GET /api/tiles/lares/17/109646/60681.png',
            total: 500,
            concurrency: 200,
            makeRequest: (_, agent) => httpRequest({ reqPath: '/api/tiles/lares/17/109646/60681.png', agent })
        });
        results.push(r3);

        // 4. 100-Burst Login / OTP Cooldown Storm (must throttle after <= 2 OTP dispatches)
        const r4 = await runConcurrentBurst({
            name: '100x POST /api/admin/login OTP Flood',
            total: 100,
            concurrency: 50,
            makeRequest: (_, agent) => httpRequest({
                method: 'POST',
                reqPath: '/api/admin/login',
                body: { email: edEmail, password: testPass },
                agent
            })
        });
        results.push(r4);

        // 5. 100-Burst Identical Change-Request Spam (must insert strictly 1 DB row)
        const draftSummary = `${tag} Identical Spam Submit`;
        const r5 = await runConcurrentBurst({
            name: '100x POST /api/admin/change-requests Spam',
            total: 100,
            concurrency: 50,
            makeRequest: (_, agent) => httpRequest({
                method: 'POST',
                reqPath: '/api/admin/change-requests',
                headers: { 'X-Admin-Token': edTok },
                body: {
                    station_id: 'lares',
                    target_table: 'system_stress_test',
                    target_id: tag,
                    action: 'NOTE',
                    summary: draftSummary,
                    payload_json: { note: tag }
                },
                agent
            })
        });
        const [[spamCrCount]] = await db.query('SELECT COUNT(*) cnt FROM change_requests WHERE summary = ?', [draftSummary]);
        r5.dbRowsCreated = Number(spamCrCount.cnt);
        results.push(r5);

        // 6. 100-Concurrent Publish Race on ONE Approved CR (strictly 1 commit)
        const r6 = await runConcurrentBurst({
            name: '100x POST /api/admin/change-requests/:id/publish Race',
            total: 100,
            concurrency: 100,
            makeRequest: (_, agent) => httpRequest({
                method: 'POST',
                reqPath: `/api/admin/change-requests/${approvedCr.insertId}/publish`,
                headers: { 'X-Admin-Token': admTok },
                body: {},
                agent
            })
        });
        const [[pubRow]] = await db.query('SELECT status FROM change_requests WHERE id = ?', [approvedCr.insertId]);
        r6.finalStatus = pubRow?.status;
        results.push(r6);

        // Post-flood server liveness check
        const alive = await httpRequest({ reqPath: '/api/version' });

        // Strict Assertions
        const failures = [];
        for (const r of results) {
            if (r.server5xx > 0) failures.push(`${r.name}: had ${r.server5xx} 5xx/network errors`);
        }
        if ((r1Cold.counts['200'] || 0) !== 250) failures.push(`Cold Bootstrap: expected 250x 200, got ${JSON.stringify(r1Cold.counts)}`);
        if (r1Cold.p95Ms > 850) failures.push(`Cold Bootstrap p95 too high: ${r1Cold.p95Ms}ms`);
        if ((r1.counts['200'] || 0) !== 1000) failures.push(`Warm Bootstrap: expected 1000x 200, got ${JSON.stringify(r1.counts)}`);
        if (r1.p95Ms > 300) failures.push(`Warm Bootstrap p95 too high: ${r1.p95Ms}ms`);
        if ((r2.counts['200'] || 0) !== 1000) failures.push(`Version: expected 1000x 200, got ${JSON.stringify(r2.counts)}`);
        if ((r4.counts['200'] || 0) > 2) failures.push(`Login OTP flood leaked > 2 OTP dispatches: ${JSON.stringify(r4.counts)}`);
        if (r5.dbRowsCreated !== 1) failures.push(`Change-Request spam created ${r5.dbRowsCreated} DB rows instead of 1`);
        if ((r6.counts['200'] || 0) !== 1) failures.push(`Publish race allowed ${r6.counts['200'] || 0} publishes instead of 1 (${JSON.stringify(r6.counts)})`);
        if (r6.finalStatus !== 'published') failures.push(`Publish race finalStatus=${r6.finalStatus}`);
        if (alive.status !== 200) failures.push(`Server unresponsive after flood: status=${alive.status}`);

        console.log(JSON.stringify({ passed: failures.length === 0, failures, results, serverAliveStatus: alive.status }, null, 2));
        if (failures.length > 0) process.exitCode = 1;
    } finally {
        try { if (srv) srv.kill(); } catch (_) { }
        if (db && maxBefore) {
            try {
                await db.query('DELETE FROM change_requests WHERE id > ?', [maxBefore.cr]);
                await db.query('DELETE FROM notifications WHERE id > ?', [maxBefore.notif]);
                await db.query('DELETE FROM admin_audit_logs WHERE id > ?', [maxBefore.audit]);
                if (maxBefore.hasLoginAttemptsTbl) {
                    await db.query('DELETE FROM user_login_logs WHERE id > ?', [maxBefore.loginAudit]);
                }
                await db.query('DELETE FROM admin_sessions WHERE user_id > ?', [maxBefore.users]);
                await db.query('DELETE FROM user_roles WHERE user_id > ?', [maxBefore.users]);
                await db.query('DELETE FROM admin_users WHERE id > ?', [maxBefore.users]);
                if (maxBefore.dataVersion !== null) {
                    await db.query("UPDATE settings SET `value` = ? WHERE `key` = 'data_version'", [maxBefore.dataVersion]);
                }
            } catch (e) {
                console.error('Cleanup error:', e.message);
            }
            await db.end();
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
