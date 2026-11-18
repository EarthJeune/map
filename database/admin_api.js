/**
 * DA-CALABARZON 10-Table MySQL CRUD & Bootstrap Router
 * Powers both the read-only Public 3D Map Bootstrap API and the Protected Solo Admin Portal (/admin).
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (e) {}

module.exports = function createAdminApiRouter(pool, rootDir) {
    const router = express.Router();

    function query(sql, params = []) {
        return new Promise((resolve, reject) => {
            pool.query(sql, params, (err, results) => {
                if (err) reject(err);
                else resolve(results);
            });
        });
    }

    async function logAudit(action, targetTable, targetId, summary, username = 'admin') {
        try {
            await query(
                `INSERT INTO admin_audit_logs (admin_username, action, target_table, target_id, summary) VALUES (?, ?, ?, ?, ?)`,
                [username, action, targetTable, String(targetId || ''), summary]
            );
        } catch (e) {
            console.warn('[AuditLog] Failed to record audit log:', e.message);
        }
    }

    function sha256Hex(value) {
        return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
    }

    function hashPasswordScrypt(password) {
        const salt = crypto.randomBytes(16).toString('hex');
        const derived = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
        return `scrypt$${salt}$${derived}`;
    }

    function verifyPasswordScrypt(password, stored) {
        if (!stored || !String(stored).startsWith('scrypt$')) return false;
        const parts = String(stored).split('$');
        if (parts.length !== 3) return false;
        const [, salt, hexHash] = parts;
        try {
            const derived = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
            return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hexHash, 'hex'));
        } catch (e) {
            return false;
        }
    }

    function maskEmail(email) {
        if (!email || !email.includes('@')) return '';
        const [u, d] = email.split('@');
        const visible = u.slice(0, Math.min(2, u.length));
        return `${visible}${'*'.repeat(Math.max(2, u.length - 2))}@${d}`;
    }

    async function sendMailSafe({ to, subject, text, html }) {
        const smtpUser = (process.env.SMTP_USER || '').trim();
        const smtpPass = (process.env.SMTP_APP_PASSWORD || '').trim();
        if (nodemailer && smtpUser && smtpPass) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: smtpUser, pass: smtpPass }
            });
            await transporter.sendMail({
                from: `"iGUIDE DA-CALABARZON" <${smtpUser}>`,
                to,
                subject,
                text,
                html
            });
            return { sent: true, mode: 'gmail' };
        }
        // Fallback when SMTP_APP_PASSWORD is not yet set: log to server terminal only (never expose OTP in HTTP response)
        console.log(`\n[iGUIDE Mailer - Console Fallback] To: ${maskEmail(to)} | Subject: ${subject}\n${text}\n`);
        return { sent: false, mode: 'console' };
    }

    // SHA-256 Encrypted Admin Credentials (stored in MySQL `admin_users` table & `.env` as 64-char SHA-256 hex digests)
    const ENV_USER_SHA256 = (process.env.ADMIN_USERNAME_SHA256 || (process.env.ADMIN_USERNAME ? sha256Hex(process.env.ADMIN_USERNAME) : '')).toLowerCase();
    const ENV_PASS_SHA256 = (process.env.ADMIN_PASSWORD_SHA256 || (process.env.ADMIN_PASSWORD ? sha256Hex(process.env.ADMIN_PASSWORD) : '')).toLowerCase();
    const TOKEN_SECRET = process.env.ADMIN_SECRET || process.env.APP_KEY || 'da-calabarzon-spatial-hub-secret-2026';

    let activeUserSha256 = ENV_USER_SHA256;
    let activePassSha256 = ENV_PASS_SHA256;

    // Initialize `admin_users` table in MySQL with SHA-256 encrypted username & password
    (async function initAdminUsersTable() {
        try {
            await query(`
                CREATE TABLE IF NOT EXISTS admin_users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username_sha256 CHAR(64) NOT NULL UNIQUE,
                    password_sha256 CHAR(64) NOT NULL,
                    role VARCHAR(50) DEFAULT 'super_admin',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            if (ENV_USER_SHA256 && ENV_PASS_SHA256) {
                await query(`
                    INSERT INTO admin_users (id, username_sha256, password_sha256, role)
                    VALUES (1, ?, ?, 'super_admin')
                    ON DUPLICATE KEY UPDATE
                        username_sha256 = VALUES(username_sha256),
                        password_sha256 = VALUES(password_sha256)
                `, [ENV_USER_SHA256, ENV_PASS_SHA256]);
            }
            const userCols = await query(`SHOW COLUMNS FROM admin_users`);
            const uColNames = new Set((userCols || []).map(c => c.Field));
            if (!uColNames.has('email')) await query(`ALTER TABLE admin_users ADD COLUMN email VARCHAR(190) NULL UNIQUE`);
            if (!uColNames.has('full_name')) await query(`ALTER TABLE admin_users ADD COLUMN full_name VARCHAR(120) NULL`);
            if (!uColNames.has('station_id')) await query(`ALTER TABLE admin_users ADD COLUMN station_id VARCHAR(32) NULL`);
            if (!uColNames.has('otp_hash')) await query(`ALTER TABLE admin_users ADD COLUMN otp_hash CHAR(64) NULL`);
            if (!uColNames.has('otp_expires_at')) await query(`ALTER TABLE admin_users ADD COLUMN otp_expires_at DATETIME NULL`);
            if (!uColNames.has('otp_attempts')) await query(`ALTER TABLE admin_users ADD COLUMN otp_attempts TINYINT NOT NULL DEFAULT 0`);
            if (!uColNames.has('is_active')) await query(`ALTER TABLE admin_users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`);
            await query(`ALTER TABLE admin_users MODIFY COLUMN password_sha256 VARCHAR(255) NOT NULL`);

            const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
            if (adminEmail) {
                await query(`UPDATE admin_users SET email = ?, full_name = COALESCE(full_name, 'MIS Administrator') WHERE id = 1`, [adminEmail]);
            }

            // Seed temporary station reviewer from private .env if configured
            const tempRevEmail = (process.env.TEMP_REVIEWER_EMAIL || '').trim().toLowerCase();
            const tempRevPass = (process.env.TEMP_REVIEWER_PASSWORD || '').trim();
            const tempRevStation = (process.env.TEMP_REVIEWER_STATION || 'lares').trim().toLowerCase();
            const tempRevName = (process.env.TEMP_REVIEWER_NAME || 'Station Reviewer').trim();
            if (tempRevEmail && tempRevPass) {
                const existingRev = await query(`SELECT id FROM admin_users WHERE email = ? LIMIT 1`, [tempRevEmail]);
                if (!existingRev || existingRev.length === 0) {
                    await query(`
                        INSERT INTO admin_users (username_sha256, password_sha256, email, full_name, role, station_id, is_active)
                        VALUES (?, ?, ?, ?, 'reviewer', ?, 1)
                    `, [sha256Hex(tempRevEmail), hashPasswordScrypt(tempRevPass), tempRevEmail, tempRevName, tempRevStation]);
                }
            }

            const rows = await query(`SELECT username_sha256, password_sha256 FROM admin_users WHERE id = 1 LIMIT 1`);
            if (rows && rows[0]) {
                activeUserSha256 = String(rows[0].username_sha256).toLowerCase();
                activePassSha256 = String(rows[0].password_sha256).toLowerCase();
            }
        } catch (err) {
            console.warn('[AdminAuth] Notice initializing admin_users table:', err.message);
        }
    })();

    // Per-IP brute-force rate limiter for /api/admin/login (max 5 failed attempts per 60s)
    const loginAttempts = new Map();
    const pendingOtpTokens = new Map(); // otpSessionId -> { userId, expiresAtMs }
    const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours max session lifetime
    const activeSessions = new Map(); // token -> { expiresAtMs, revoked, userId, role, stationId, email }

    // Initialize `admin_sessions`, `change_requests`, & optional `stations` UI metadata columns
    (async function initAdminSessionsAndStationCols() {
        try {
            await query(`
                CREATE TABLE IF NOT EXISTS admin_sessions (
                    token VARCHAR(128) PRIMARY KEY,
                    username_sha256 CHAR(64) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NOT NULL,
                    revoked TINYINT(1) NOT NULL DEFAULT 0
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            const sessCols = await query(`SHOW COLUMNS FROM admin_sessions`);
            const sColNames = new Set((sessCols || []).map(c => c.Field));
            if (!sColNames.has('user_id')) await query(`ALTER TABLE admin_sessions ADD COLUMN user_id INT NULL`);
            if (!sColNames.has('role')) await query(`ALTER TABLE admin_sessions ADD COLUMN role VARCHAR(32) DEFAULT 'super_admin'`);
            if (!sColNames.has('station_id')) await query(`ALTER TABLE admin_sessions ADD COLUMN station_id VARCHAR(32) NULL`);
            if (!sColNames.has('email')) await query(`ALTER TABLE admin_sessions ADD COLUMN email VARCHAR(190) NULL`);

            await query(`
                CREATE TABLE IF NOT EXISTS change_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    station_id VARCHAR(32) NOT NULL,
                    target_table VARCHAR(64) NOT NULL,
                    target_id VARCHAR(120) NOT NULL,
                    action ENUM('CREATE','UPDATE','DELETE') NOT NULL DEFAULT 'UPDATE',
                    summary VARCHAR(255) NOT NULL,
                    previous_json LONGTEXT NULL,
                    payload_json LONGTEXT NULL,
                    status ENUM('pending','approved','rejected','published') NOT NULL DEFAULT 'pending',
                    submitted_by_email VARCHAR(190) NULL,
                    reviewed_by_email VARCHAR(190) NULL,
                    reviewer_comment TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    reviewed_at DATETIME NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            await query(`DELETE FROM admin_sessions WHERE revoked = 1 OR expires_at < NOW()`).catch(() => {});

            const cols = await query(`SHOW COLUMNS FROM stations`);
            const colNames = new Set((cols || []).map(c => c.Field));
            if (!colNames.has('welcome_tags')) {
                await query(`ALTER TABLE stations ADD COLUMN welcome_tags TEXT NULL`);
            }
            if (!colNames.has('quick_tags')) {
                await query(`ALTER TABLE stations ADD COLUMN quick_tags TEXT NULL`);
            }
            if (!colNames.has('filter_descriptions')) {
                await query(`ALTER TABLE stations ADD COLUMN filter_descriptions TEXT NULL`);
            }
        } catch (err) {
            console.warn('[AdminInit] Notice initializing sessions/station columns:', err.message);
        }
    })();

    function safeCompareHex(a, b) {
        if (!a || !b || a.length !== 64 || b.length !== 64) return false;
        try {
            return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
        } catch (e) {
            return false;
        }
    }

    function generateAdminToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    function extractTokenFromRequest(req) {
        const authHeader = req.headers['authorization'] || '';
        const headerToken = req.headers['x-admin-token'] || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');
        if (headerToken) return String(headerToken).trim();
        if (req.body && typeof req.body === 'object' && req.body.token) {
            return String(req.body.token).trim();
        }
        if (typeof req.body === 'string') {
            try {
                const parsed = JSON.parse(req.body);
                if (parsed && parsed.token) return String(parsed.token).trim();
            } catch (e) {}
        }
        return '';
    }

    async function verifyAdminTokenAsync(token) {
        if (!token || typeof token !== 'string' || token.length < 32) return null;
        const cached = activeSessions.get(token);
        if (cached) {
            if (cached.revoked || Date.now() > cached.expiresAtMs) {
                activeSessions.delete(token);
                return null;
            }
            return cached;
        }
        try {
            const rows = await query(
                `SELECT expires_at, revoked, user_id, role, station_id, email FROM admin_sessions WHERE token = ? LIMIT 1`,
                [token]
            );
            if (!rows || !rows[0]) return null;
            const row = rows[0];
            const expiresAtMs = new Date(row.expires_at).getTime();
            if (Number(row.revoked) === 1 || !Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
                return null;
            }
            const sess = {
                expiresAtMs,
                revoked: false,
                userId: row.user_id || 1,
                role: row.role || 'super_admin',
                stationId: row.station_id || null,
                email: row.email || null
            };
            activeSessions.set(token, sess);
            return sess;
        } catch (e) {
            return null;
        }
    }

    function verifyAdminToken(token) {
        if (!token || typeof token !== 'string') return false;
        const cached = activeSessions.get(token);
        return Boolean(cached && !cached.revoked && Date.now() <= cached.expiresAtMs);
    }

    async function requireAdminAuth(req, res, next) {
        const token = extractTokenFromRequest(req);
        const sess = await verifyAdminTokenAsync(token);
        if (sess) {
            req.adminToken = token;
            req.adminUser = sess;
            return next();
        }
        return res.status(401).json({ error: 'Unauthorized: Valid login required.' });
    }

    async function requireSuperAdmin(req, res, next) {
        return requireAdminAuth(req, res, () => {
            if (req.adminUser && req.adminUser.role === 'super_admin') {
                return next();
            }
            return res.status(403).json({ error: 'Forbidden: MIS Administrator privileges required.' });
        });
    }

    router.verifyAdminToken = verifyAdminToken;
    router.verifyAdminTokenAsync = verifyAdminTokenAsync;
    router.requireAdminAuth = requireAdminAuth;
    router.requireSuperAdmin = requireSuperAdmin;

    // =========================================================================
    // 1. PUBLIC READ-ONLY 3D MAP BOOTSTRAP ENDPOINT
    // =========================================================================
    router.get('/bootstrap', async (req, res) => {
        const stationId = (req.query.station || 'lares').toLowerCase();
        try {
            const allStations = await query(`
                SELECT station_id, name, label, subtitle, full_name, province, status,
                       kiosk_pin_lng, kiosk_pin_lat, drone_offset_dx, drone_offset_dy,
                       default_center_lng, default_center_lat, default_zoom, default_pitch, default_bearing,
                       mbtiles_filename, welcome_tags, quick_tags, filter_descriptions
                FROM stations
                ORDER BY FIELD(station_id, 'lares', 'qares', 'rares', 'cares')
            `);

            const station = allStations.find(s => s.station_id === stationId) || allStations[0] || null;

            const buildings = await query(`
                SELECT * FROM buildings
                WHERE station_id = ? AND is_visible = 1
                ORDER BY CASE WHEN building_num IS NULL THEN 1 ELSE 0 END, building_num ASC, id ASC
            `, [stationId]);

            const images = await query(`
                SELECT * FROM building_images
                WHERE station_id = ?
                ORDER BY is_primary DESC, display_order ASC, id ASC
            `, [stationId]);

            const offices = await query(`
                SELECT * FROM building_offices
                WHERE station_id = ?
                ORDER BY display_order ASC, id ASC
            `, [stationId]);

            const entrances = await query(`
                SELECT * FROM building_entrances
                WHERE station_id = ?
            `, [stationId]);

            const plots = await query(`
                SELECT * FROM agricultural_plots
                WHERE station_id = ?
                ORDER BY id ASC
            `, [stationId]);

            const subplots = await query(`
                SELECT * FROM plot_subplots
                WHERE station_id = ?
                ORDER BY display_order ASC, id ASC
            `, [stationId]);

            // Group images, offices, and entrances by building_code
            const imgByBldg = {};
            for (const img of images) {
                if (!imgByBldg[img.building_code]) imgByBldg[img.building_code] = [];
                imgByBldg[img.building_code].push(img);
            }

            const ofcByBldg = {};
            for (const ofc of offices) {
                if (!ofcByBldg[ofc.building_code]) ofcByBldg[ofc.building_code] = [];
                ofcByBldg[ofc.building_code].push(ofc);
            }

            const entByBldg = {};
            for (const ent of entrances) {
                if (!entByBldg[ent.building_code]) entByBldg[ent.building_code] = [];
                entByBldg[ent.building_code].push([ent.entrance_lng, ent.entrance_lat]);
            }

            const enrichedBuildings = buildings.map(b => ({
                ...b,
                images: imgByBldg[b.building_code] || [],
                offices: ofcByBldg[b.building_code] || [],
                entrances: entByBldg[b.building_code] || []
            }));

            const spByPlot = {};
            for (const sp of subplots) {
                if (!spByPlot[sp.parent_plot_code]) spByPlot[sp.parent_plot_code] = [];
                spByPlot[sp.parent_plot_code].push(sp);
            }

            const enrichedPlots = plots.map(p => ({
                ...p,
                subPlots: spByPlot[p.plot_code] || []
            }));

            res.json({
                station,
                allStations,
                buildings: enrichedBuildings,
                plots: enrichedPlots
            });
        } catch (err) {
            console.error('[Bootstrap API Error]:', err.message);
            res.status(500).json({ error: 'Database bootstrap failed', details: err.message });
        }
    });

    // =========================================================================
    // 2. TWO-STEP OTP AUTHENTICATION (MIS ADMIN & STATION REVIEWERS)
    // =========================================================================
    async function issueOtpAndEmail(user) {
        const otp = String(crypto.randomInt(100000, 999999));
        const otpHash = sha256Hex(otp);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        await query(
            `UPDATE admin_users SET otp_hash = ?, otp_expires_at = ?, otp_attempts = 0 WHERE id = ?`,
            [otpHash, expiresAt, user.id]
        );
        const otpToken = crypto.randomBytes(24).toString('hex');
        pendingOtpTokens.set(otpToken, { userId: user.id, expiresAtMs: Date.now() + 5 * 60 * 1000 });
        const targetEmail = user.email || (process.env.ADMIN_EMAIL || '').trim();
        let mailResult = { sent: false, mode: 'console' };
        if (targetEmail) {
            mailResult = await sendMailSafe({
                to: targetEmail,
                subject: `[iGUIDE] Your Login Verification Code: ${otp}`,
                text: `Hello ${user.full_name || 'User'},\n\nYour 6-digit iGUIDE login OTP is: ${otp}\nThis code expires in 5 minutes.\n\nIf you did not request this login, please ignore this email.`,
                html: `<div style="font-family:Arial,sans-serif;max-width:480px;padding:20px;border:1px solid #e2e8f0;border-radius:10px;"><h2 style="color:#063017;margin:0 0 10px;">iGUIDE Verification Code</h2><p>Hello <b>${user.full_name || 'User'}</b>,</p><p>Use this 6-digit code to finish signing in (expires in 5 minutes):</p><div style="font-size:30px;font-weight:bold;letter-spacing:6px;color:#10b981;background:#063017;padding:12px 18px;border-radius:8px;display:inline-block;margin:10px 0;">${otp}</div><p style="font-size:12px;color:#64748b;">DA-CALABARZON iGUIDE Portal</p></div>`
            });
        }
        return { otpToken, maskedEmail: maskEmail(targetEmail), mailMode: mailResult.mode };
    }

    router.post('/admin/login', async (req, res) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const now = Date.now();
        const record = loginAttempts.get(ip) || { count: 0, resetAt: now + 60000 };
        if (now > record.resetAt) {
            record.count = 0;
            record.resetAt = now + 60000;
        }
        if (record.count >= 5) {
            const waitSec = Math.ceil((record.resetAt - now) / 1000);
            return res.status(429).json({ error: `Too many failed login attempts. Please wait ${waitSec}s.` });
        }

        const { username, password } = req.body || {};
        const identifier = String(username || '').trim();
        const lowerIdent = identifier.toLowerCase();
        const inputUserSha256 = sha256Hex(identifier);
        const inputPassSha256 = sha256Hex(password);

        let matchedUser = null;
        try {
            const allUsers = await query(`SELECT * FROM admin_users WHERE is_active = 1`);
            for (const u of allUsers) {
                const emailMatch = u.email && String(u.email).toLowerCase() === lowerIdent;
                const userHashMatch = safeCompareHex(inputUserSha256, String(u.username_sha256 || '').toLowerCase());
                if (!emailMatch && !userHashMatch) continue;

                const passMatches = String(u.password_sha256 || '').startsWith('scrypt$')
                    ? verifyPasswordScrypt(password, u.password_sha256)
                    : safeCompareHex(inputPassSha256, String(u.password_sha256 || '').toLowerCase());
                if (passMatches) {
                    matchedUser = u;
                    break;
                }
            }
        } catch (e) {
            console.warn('[AdminAuth] Login lookup notice:', e.message);
        }

        if (matchedUser) {
            loginAttempts.delete(ip);
            try {
                const otpInfo = await issueOtpAndEmail(matchedUser);
                return res.json({
                    success: true,
                    step: 'otp',
                    otpToken: otpInfo.otpToken,
                    maskedEmail: otpInfo.maskedEmail,
                    mailMode: otpInfo.mailMode,
                    role: matchedUser.role || 'super_admin',
                    stationId: matchedUser.station_id || null
                });
            } catch (mailErr) {
                return res.status(500).json({ error: 'Failed to dispatch login OTP: ' + mailErr.message });
            }
        }

        record.count += 1;
        loginAttempts.set(ip, record);
        return res.status(401).json({ error: 'Invalid email/username or password' });
    });

    router.post('/admin/verify-otp', async (req, res) => {
        const { otpToken, otp } = req.body || {};
        const pending = pendingOtpTokens.get(String(otpToken || ''));
        if (!pending || Date.now() > pending.expiresAtMs) {
            pendingOtpTokens.delete(String(otpToken || ''));
            return res.status(401).json({ error: 'OTP session expired. Please sign in again.' });
        }

        try {
            const rows = await query(`SELECT * FROM admin_users WHERE id = ? AND is_active = 1 LIMIT 1`, [pending.userId]);
            const user = rows && rows[0];
            if (!user || !user.otp_hash || !user.otp_expires_at) {
                return res.status(401).json({ error: 'No active OTP found. Please sign in again.' });
            }
            if (new Date(user.otp_expires_at).getTime() < Date.now()) {
                return res.status(401).json({ error: 'OTP expired. Click Resend Code or sign in again.' });
            }
            if (Number(user.otp_attempts || 0) >= 5) {
                pendingOtpTokens.delete(String(otpToken || ''));
                return res.status(429).json({ error: 'Too many invalid OTP attempts. Please sign in again.' });
            }

            const submittedHash = sha256Hex(String(otp || '').trim());
            if (!safeCompareHex(submittedHash, String(user.otp_hash).toLowerCase())) {
                await query(`UPDATE admin_users SET otp_attempts = otp_attempts + 1 WHERE id = ?`, [user.id]);
                return res.status(401).json({ error: 'Invalid 6-digit verification code.' });
            }

            // Clear OTP & issue session
            pendingOtpTokens.delete(String(otpToken || ''));
            await query(`UPDATE admin_users SET otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0 WHERE id = ?`, [user.id]);

            const token = generateAdminToken();
            const expiresAtMs = Date.now() + SESSION_TTL_MS;
            const expiresAtDate = new Date(expiresAtMs);
            const sessObj = {
                expiresAtMs,
                revoked: false,
                userId: user.id,
                role: user.role || 'super_admin',
                stationId: user.station_id || null,
                email: user.email || null
            };
            activeSessions.set(token, sessObj);
            await query(
                `INSERT INTO admin_sessions (token, username_sha256, user_id, role, station_id, email, expires_at, revoked) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
                [token, user.username_sha256, user.id, sessObj.role, sessObj.stationId, sessObj.email, expiresAtDate]
            );
            logAudit('USER_LOGIN', 'admin_users', user.email || `id:${user.id}`, `${sessObj.role} authenticated with Gmail OTP`, user.email || 'admin');
            return res.json({
                success: true,
                token,
                expiresAt: expiresAtMs,
                role: sessObj.role,
                stationId: sessObj.stationId,
                email: sessObj.email,
                fullName: user.full_name || 'User'
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/resend-otp', async (req, res) => {
        const { otpToken } = req.body || {};
        const pending = pendingOtpTokens.get(String(otpToken || ''));
        if (!pending) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
        try {
            const rows = await query(`SELECT * FROM admin_users WHERE id = ? AND is_active = 1 LIMIT 1`, [pending.userId]);
            if (!rows || !rows[0]) return res.status(401).json({ error: 'Account not found.' });
            pendingOtpTokens.delete(String(otpToken || ''));
            const otpInfo = await issueOtpAndEmail(rows[0]);
            return res.json({ success: true, otpToken: otpInfo.otpToken, maskedEmail: otpInfo.maskedEmail, mailMode: otpInfo.mailMode });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/logout', async (req, res) => {
        const token = extractTokenFromRequest(req);
        if (token) {
            const sess = await verifyAdminTokenAsync(token);
            activeSessions.delete(token);
            try {
                await query(`UPDATE admin_sessions SET revoked = 1 WHERE token = ?`, [token]);
            } catch (e) {}
            if (sess) {
                logAudit('USER_LOGOUT', 'admin_sessions', token.slice(0, 12), 'Session logged out', sess.email || 'admin');
            }
        }
        return res.json({ success: true });
    });

    router.get('/admin/verify', requireAdminAuth, (req, res) => {
        res.json({
            valid: true,
            role: req.adminUser.role,
            stationId: req.adminUser.stationId,
            email: req.adminUser.email
        });
    });

    // =========================================================================
    // 2B. REVIEWER ACCOUNTS & CHANGE REQUEST WORKFLOW (ADMIN + REVIEWER)
    // =========================================================================
    router.get('/admin/reviewers', requireSuperAdmin, async (req, res) => {
        try {
            const rows = await query(`SELECT id, email, full_name, role, station_id, is_active, updated_at FROM admin_users WHERE role = 'reviewer' ORDER BY station_id ASC, id ASC`);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/reviewers', requireSuperAdmin, async (req, res) => {
        const { email, full_name, station_id, password } = req.body || {};
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanStation = String(station_id || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@') || !cleanStation || !password) {
            return res.status(400).json({ error: 'Email, station, and password are required.' });
        }
        try {
            await query(
                `INSERT INTO admin_users (username_sha256, password_sha256, email, full_name, role, station_id, is_active) VALUES (?, ?, ?, ?, 'reviewer', ?, 1)`,
                [sha256Hex(cleanEmail), hashPasswordScrypt(password), cleanEmail, full_name || 'Station Reviewer', cleanStation]
            );
            logAudit('CREATE_REVIEWER', 'admin_users', cleanEmail, `Added reviewer for ${cleanStation.toUpperCase()}`, req.adminUser.email || 'admin');
            res.json({ success: true });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.put('/admin/reviewers/:id/toggle', requireSuperAdmin, async (req, res) => {
        try {
            await query(`UPDATE admin_users SET is_active = IF(is_active = 1, 0, 1) WHERE id = ? AND role = 'reviewer'`, [req.params.id]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/reviewers/:id/station', requireSuperAdmin, async (req, res) => {
        const cleanStation = String((req.body && req.body.station_id) || '').trim().toLowerCase();
        if (!['lares', 'qares', 'rares', 'cares'].includes(cleanStation)) {
            return res.status(400).json({ error: 'Invalid station_id.' });
        }
        try {
            await query(`UPDATE admin_users SET station_id = ? WHERE id = ? AND role = 'reviewer'`, [cleanStation, req.params.id]);
            await query(`UPDATE admin_sessions SET station_id = ? WHERE user_id = ? AND revoked = 0`, [cleanStation, req.params.id]);
            logAudit('REASSIGN_REVIEWER_STATION', 'admin_users', req.params.id, `Reassigned reviewer #${req.params.id} to DA-${cleanStation.toUpperCase()}`, req.adminUser.email || 'admin');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/admin/change-requests', requireSuperAdmin, async (req, res) => {
        const stationId = req.query.station ? String(req.query.station).toLowerCase() : null;
        try {
            const rows = stationId
                ? await query(`SELECT * FROM change_requests WHERE station_id = ? ORDER BY id DESC LIMIT 100`, [stationId])
                : await query(`SELECT * FROM change_requests ORDER BY id DESC LIMIT 100`);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/change-requests', requireSuperAdmin, async (req, res) => {
        const { station_id, target_table, target_id, action, summary, previous_json, payload_json } = req.body || {};
        const st = String(station_id || 'lares').toLowerCase();
        if (!summary) return res.status(400).json({ error: 'Summary is required.' });
        try {
            const result = await query(
                `INSERT INTO change_requests (station_id, target_table, target_id, action, summary, previous_json, payload_json, status, submitted_by_email) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                [st, target_table || 'buildings', target_id || 'general', action || 'UPDATE', summary, previous_json || null, payload_json || null, req.adminUser.email || 'admin']
            );
            const reviewers = await query(`SELECT email, full_name FROM admin_users WHERE role = 'reviewer' AND station_id = ? AND is_active = 1`, [st]);
            let notified = 0;
            for (const rev of reviewers) {
                if (rev.email) {
                    await sendMailSafe({
                        to: rev.email,
                        subject: `[iGUIDE Review Needed] ${st.toUpperCase()}: ${summary}`,
                        text: `Hello ${rev.full_name || 'Reviewer'},\n\nA new update for DA-${st.toUpperCase()} is waiting for your review:\n\nSummary: ${summary}\nTarget: ${target_table || 'buildings'} (${target_id || 'general'})\n\nPlease sign in to the iGUIDE Reviewer Portal to Approve, Reject, or Comment.`
                    });
                    notified++;
                }
            }
            logAudit('SUBMIT_CHANGE_REQUEST', 'change_requests', result.insertId, `Submitted ${st.toUpperCase()} review: ${summary}`, req.adminUser.email || 'admin');
            res.json({ success: true, id: result.insertId, notifiedReviewers: notified });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/change-requests/:id/publish', requireSuperAdmin, async (req, res) => {
        try {
            await query(`UPDATE change_requests SET status = 'published' WHERE id = ? AND status = 'approved'`, [req.params.id]);
            logAudit('PUBLISH_CHANGE_REQUEST', 'change_requests', req.params.id, `Published approved change #${req.params.id}`, req.adminUser.email || 'admin');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Station Reviewer Endpoints (Strictly Scoped to Reviewer's Assigned Station — Read/Approve/Reject/Comment ONLY)
    router.get('/review/requests', requireAdminAuth, async (req, res) => {
        const stationId = req.adminUser.role === 'reviewer'
            ? req.adminUser.stationId
            : (req.query.station || 'lares').toLowerCase();
        if (!stationId) return res.status(403).json({ error: 'No station assigned to this reviewer account.' });
        try {
            const rows = await query(`SELECT * FROM change_requests WHERE station_id = ? ORDER BY FIELD(status, 'pending', 'approved', 'rejected', 'published'), id DESC`, [stationId]);
            res.json({ stationId, requests: rows });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/review/requests/:id/decide', requireAdminAuth, async (req, res) => {
        const { decision, comment } = req.body || {};
        if (!['approved', 'rejected'].includes(decision)) {
            return res.status(400).json({ error: 'Decision must be approved or rejected.' });
        }
        const cleanComment = String(comment || '').trim();
        if (decision === 'rejected' && !cleanComment) {
            return res.status(400).json({ error: 'Please include a comment explaining why this change is rejected.' });
        }
        try {
            const rows = await query(`SELECT * FROM change_requests WHERE id = ? LIMIT 1`, [req.params.id]);
            const cr = rows && rows[0];
            if (!cr) return res.status(404).json({ error: 'Change request not found.' });
            if (req.adminUser.role === 'reviewer' && cr.station_id !== req.adminUser.stationId) {
                return res.status(403).json({ error: 'Forbidden: You can only review your assigned station.' });
            }
            await query(
                `UPDATE change_requests SET status = ?, reviewer_comment = ?, reviewed_by_email = ?, reviewed_at = NOW() WHERE id = ?`,
                [decision, cleanComment, req.adminUser.email || 'reviewer', cr.id]
            );
            logAudit(`REVIEW_${decision.toUpperCase()}`, 'change_requests', cr.id, `${cr.station_id.toUpperCase()} #${cr.id} ${decision}: ${cleanComment}`, req.adminUser.email || 'reviewer');

            // Notify Admin via Gmail with Reviewer Decision + Comment
            let adminNotified = false;
            const adminEmail = (cr.submitted_by_email && cr.submitted_by_email.includes('@'))
                ? cr.submitted_by_email
                : (process.env.ADMIN_EMAIL || '').trim();
            if (adminEmail) {
                try {
                    await sendMailSafe({
                        to: adminEmail,
                        subject: `[iGUIDE Review ${decision.toUpperCase()}] DA-${cr.station_id.toUpperCase()}: ${cr.summary}`,
                        text: `Hello MIS Admin,\n\nA Station Reviewer has ${decision.toUpperCase()} change request #${cr.id} for DA-${cr.station_id.toUpperCase()}.\n\nSummary: ${cr.summary}\nTarget: ${cr.target_table} (${cr.target_id})\nReviewer: ${req.adminUser.email || 'Station Reviewer'}\nDecision: ${decision.toUpperCase()}\nComment: ${cleanComment || '(No comment provided)'}\n\nOpen iGUIDE Admin (http://localhost:8080/admin) to view or publish.`
                    });
                    adminNotified = true;
                } catch (mailErr) {
                    console.warn('[ReviewDecisionMailer] Failed to email admin:', mailErr.message);
                }
            }
            res.json({ success: true, adminNotified });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/review/station-overview', requireAdminAuth, async (req, res) => {
        const stationId = req.adminUser.role === 'reviewer'
            ? req.adminUser.stationId
            : (req.query.station || 'lares').toLowerCase();
        if (!stationId) return res.status(403).json({ error: 'No station assigned.' });
        try {
            const [station] = await query(`SELECT * FROM stations WHERE station_id = ? LIMIT 1`, [stationId]);
            const buildings = await query(`SELECT * FROM buildings WHERE station_id = ? ORDER BY CASE WHEN building_num IS NULL THEN 1 ELSE 0 END, building_num ASC, id ASC`, [stationId]);
            const images = await query(`SELECT * FROM building_images WHERE station_id = ? ORDER BY is_primary DESC, display_order ASC, id ASC`, [stationId]);
            const offices = await query(`SELECT * FROM building_offices WHERE station_id = ? ORDER BY display_order ASC, id ASC`, [stationId]);
            const plots = await query(`SELECT * FROM agricultural_plots WHERE station_id = ? ORDER BY id ASC`, [stationId]);
            const subplots = await query(`SELECT * FROM plot_subplots WHERE station_id = ? ORDER BY display_order ASC, id ASC`, [stationId]);
            const [treeCnt] = await query(`SELECT COUNT(*) AS cnt FROM campus_trees WHERE station_id = ?`, [stationId]);
            const [roadCnt] = await query(`SELECT COUNT(*) AS cnt FROM road_features WHERE station_id = ?`, [stationId]);

            const imgByBldg = {};
            for (const img of images) {
                if (!imgByBldg[img.building_code]) imgByBldg[img.building_code] = [];
                imgByBldg[img.building_code].push(img);
            }
            const spByPlot = {};
            for (const sp of subplots) {
                if (!spByPlot[sp.parent_plot_code]) spByPlot[sp.parent_plot_code] = [];
                spByPlot[sp.parent_plot_code].push(sp);
            }

            res.json({
                stationId,
                station: station || null,
                counts: {
                    buildings: buildings.length,
                    images: images.length,
                    offices: offices.length,
                    plots: plots.length,
                    subplots: subplots.length,
                    trees: treeCnt ? treeCnt.cnt : 0,
                    roads: roadCnt ? roadCnt.cnt : 0
                },
                buildings: buildings.map(b => ({ ...b, images: imgByBldg[b.building_code] || [] })),
                offices,
                plots: plots.map(p => ({ ...p, subPlots: spByPlot[p.plot_code] || [] }))
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =========================================================================
    // 3. ADMIN DASHBOARD OVERVIEW & AUDIT LOGS
    // =========================================================================
    router.get('/admin/dashboard', requireSuperAdmin, async (req, res) => {
        const stationId = (req.query.station || 'lares').toLowerCase();
        try {
            const stations = await query(`SELECT station_id, name, label, subtitle, province, status, kiosk_pin_lng, kiosk_pin_lat, mbtiles_filename, updated_at FROM stations ORDER BY FIELD(station_id, 'lares', 'qares', 'rares', 'cares')`);
            const [bldgCnt] = await query(`SELECT COUNT(*) AS cnt FROM buildings WHERE station_id = ?`, [stationId]);
            const [imgCnt] = await query(`SELECT COUNT(*) AS cnt FROM building_images WHERE station_id = ?`, [stationId]);
            const [ofcCnt] = await query(`SELECT COUNT(*) AS cnt FROM building_offices WHERE station_id = ?`, [stationId]);
            const [entCnt] = await query(`SELECT COUNT(*) AS cnt FROM building_entrances WHERE station_id = ?`, [stationId]);
            const [plotCnt] = await query(`SELECT COUNT(*) AS cnt FROM agricultural_plots WHERE station_id = ?`, [stationId]);
            const [subPlotCnt] = await query(`SELECT COUNT(*) AS cnt FROM plot_subplots WHERE station_id = ?`, [stationId]);
            const [treeCnt] = await query(`SELECT COUNT(*) AS cnt FROM campus_trees WHERE station_id = ?`, [stationId]);
            const [roadCnt] = await query(`SELECT COUNT(*) AS cnt FROM road_features WHERE station_id = ?`, [stationId]);

            const auditLogs = await query(`SELECT * FROM admin_audit_logs ORDER BY id DESC LIMIT 25`);

            res.json({
                stationId,
                stations,
                counts: {
                    buildings: bldgCnt.cnt,
                    images: imgCnt.cnt,
                    offices: ofcCnt.cnt,
                    entrances: entCnt.cnt,
                    plots: plotCnt.cnt,
                    subplots: subPlotCnt.cnt,
                    trees: treeCnt.cnt,
                    roads: roadCnt.cnt
                },
                auditLogs
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =========================================================================
    // 4. STATIONS & "YOU ARE HERE" KIOSK PIN CRUD (Table 1: `stations`)
    // =========================================================================
    router.get('/admin/stations', requireSuperAdmin, async (req, res) => {
        try {
            const rows = await query(`SELECT * FROM stations ORDER BY FIELD(station_id, 'lares', 'qares', 'rares', 'cares')`);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/stations/:stationId', requireSuperAdmin, async (req, res) => {
        const sId = req.params.stationId.toLowerCase();
        const b = req.body || {};
        const serializeJsonField = (val) => {
            if (val === undefined || val === null) return null;
            if (typeof val === 'string') return val;
            try { return JSON.stringify(val); } catch (e) { return null; }
        };
        try {
            await query(`
                UPDATE stations SET
                    name = COALESCE(?, name),
                    label = COALESCE(?, label),
                    subtitle = COALESCE(?, subtitle),
                    full_name = COALESCE(?, full_name),
                    province = COALESCE(?, province),
                    status = COALESCE(?, status),
                    kiosk_pin_lng = COALESCE(?, kiosk_pin_lng),
                    kiosk_pin_lat = COALESCE(?, kiosk_pin_lat),
                    drone_offset_dx = COALESCE(?, drone_offset_dx),
                    drone_offset_dy = COALESCE(?, drone_offset_dy),
                    default_center_lng = COALESCE(?, default_center_lng),
                    default_center_lat = COALESCE(?, default_center_lat),
                    default_zoom = COALESCE(?, default_zoom),
                    default_pitch = COALESCE(?, default_pitch),
                    default_bearing = COALESCE(?, default_bearing),
                    welcome_tags = COALESCE(?, welcome_tags),
                    quick_tags = COALESCE(?, quick_tags),
                    filter_descriptions = COALESCE(?, filter_descriptions)
                WHERE station_id = ?
            `, [
                b.name ?? null, b.label ?? null, b.subtitle ?? null, b.full_name ?? null, b.province ?? null, b.status ?? null,
                b.kiosk_pin_lng !== undefined ? Number(b.kiosk_pin_lng) : null,
                b.kiosk_pin_lat !== undefined ? Number(b.kiosk_pin_lat) : null,
                b.drone_offset_dx !== undefined ? Number(b.drone_offset_dx) : null,
                b.drone_offset_dy !== undefined ? Number(b.drone_offset_dy) : null,
                b.default_center_lng !== undefined ? Number(b.default_center_lng) : null,
                b.default_center_lat !== undefined ? Number(b.default_center_lat) : null,
                b.default_zoom !== undefined ? Number(b.default_zoom) : null,
                b.default_pitch !== undefined ? Number(b.default_pitch) : null,
                b.default_bearing !== undefined ? Number(b.default_bearing) : null,
                serializeJsonField(b.welcome_tags),
                serializeJsonField(b.quick_tags),
                serializeJsonField(b.filter_descriptions),
                sId
            ]);

            // Sync legacy settings & pin.json so 3-tier fallback stays in sync
            if (b.kiosk_pin_lng !== undefined && b.kiosk_pin_lat !== undefined) {
                const coords = [Number(b.kiosk_pin_lng), Number(b.kiosk_pin_lat)];
                const settingKey = sId === 'lares' ? 'kiosk_pin' : `${sId}_kiosk_pin`;
                await query(`INSERT INTO settings (\`key\`, \`value\`) VALUES (?, ?) ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, [settingKey, JSON.stringify(coords)]);
                const pinFile = sId === 'lares' ? 'pin.json' : `${sId}_pin.json`;
                try {
                    fs.writeFileSync(path.join(rootDir, pinFile), JSON.stringify({ coordinates: coords }, null, 2));
                } catch (e) {}
            }

            await logAudit('UPDATE_STATION', 'stations', sId, `Updated station ${sId} (Status: ${b.status || 'unchanged'}, Pin: [${b.kiosk_pin_lng}, ${b.kiosk_pin_lat}])`);
            const [updated] = await query(`SELECT * FROM stations WHERE station_id = ?`, [sId]);
            res.json({ success: true, station: updated });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =========================================================================
    // 5. BUILDINGS CRUD (Table 2: `buildings`)
    // =========================================================================
    router.get('/admin/buildings', requireSuperAdmin, async (req, res) => {
        const stationId = (req.query.station || 'lares').toLowerCase();
        try {
            const buildings = await query(`
                SELECT * FROM buildings
                WHERE station_id = ?
                ORDER BY CASE WHEN building_num IS NULL THEN 1 ELSE 0 END, building_num ASC, id ASC
            `, [stationId]);

            const images = await query(`SELECT * FROM building_images WHERE station_id = ? ORDER BY is_primary DESC, display_order ASC, id ASC`, [stationId]);
            const offices = await query(`SELECT * FROM building_offices WHERE station_id = ? ORDER BY display_order ASC, id ASC`, [stationId]);

            const imgMap = {};
            images.forEach(img => {
                if (!imgMap[img.building_code]) imgMap[img.building_code] = [];
                imgMap[img.building_code].push(img);
            });

            const ofcMap = {};
            offices.forEach(o => {
                if (!ofcMap[o.building_code]) ofcMap[o.building_code] = [];
                ofcMap[o.building_code].push(o);
            });

            res.json(buildings.map(b => ({
                ...b,
                images: imgMap[b.building_code] || [],
                offices: ofcMap[b.building_code] || []
            })));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/buildings', requireSuperAdmin, async (req, res) => {
        const b = req.body || {};
        const stationId = (b.station_id || 'lares').toLowerCase();
        const bCode = (b.building_code || `bldg_${Date.now()}`).trim();
        try {
            const result = await query(`
                INSERT INTO buildings (
                    station_id, building_code, building_num, name, category, type_label, section,
                    icon, pin_color, roof_color, description, compact_tag, visual_landmark, key_services,
                    marker_lng, marker_lat, model_glb_url, height, is_subplot, has_marker, is_visible
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                stationId, bCode,
                b.building_num !== '' && b.building_num !== null && b.building_num !== undefined ? Number(b.building_num) : null,
                b.name || 'New Facility',
                b.category || 'infrastructure',
                b.type_label || 'Infrastructure Facility',
                b.section || 'Compound',
                b.icon || '🏢',
                b.pin_color || '#3b82f6',
                b.roof_color || '#334155',
                b.description || '',
                b.compact_tag || null,
                b.visual_landmark || null,
                b.key_services || null,
                b.marker_lng ? Number(b.marker_lng) : null,
                b.marker_lat ? Number(b.marker_lat) : null,
                b.model_glb_url || null,
                b.height ? Number(b.height) : 5.0,
                b.is_subplot ? 1 : 0,
                b.has_marker !== undefined ? (b.has_marker ? 1 : 0) : 1,
                b.is_visible !== undefined ? (b.is_visible ? 1 : 0) : 1
            ]);
            await logAudit('CREATE_BUILDING', 'buildings', bCode, `Created building "${b.name}" (${bCode}) in ${stationId.toUpperCase()}`);
            res.json({ success: true, id: result.insertId, building_code: bCode });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/buildings/:id', requireSuperAdmin, async (req, res) => {
        const id = Number(req.params.id);
        const b = req.body || {};
        try {
            await query(`
                UPDATE buildings SET
                    building_num = ?,
                    name = ?,
                    category = ?,
                    type_label = ?,
                    section = ?,
                    icon = ?,
                    pin_color = ?,
                    roof_color = ?,
                    description = ?,
                    compact_tag = ?,
                    visual_landmark = ?,
                    key_services = ?,
                    marker_lng = ?,
                    marker_lat = ?,
                    model_glb_url = ?,
                    height = ?,
                    has_marker = ?,
                    is_visible = ?
                WHERE id = ?
            `, [
                b.building_num !== '' && b.building_num !== null && b.building_num !== undefined ? Number(b.building_num) : null,
                b.name,
                b.category || 'infrastructure',
                b.type_label || 'Infrastructure Facility',
                b.section || 'Compound',
                b.icon || '🏢',
                b.pin_color || '#3b82f6',
                b.roof_color || '#334155',
                b.description || '',
                b.compact_tag || null,
                b.visual_landmark || null,
                b.key_services || null,
                b.marker_lng !== '' && b.marker_lng !== null && b.marker_lng !== undefined ? Number(b.marker_lng) : null,
                b.marker_lat !== '' && b.marker_lat !== null && b.marker_lat !== undefined ? Number(b.marker_lat) : null,
                b.model_glb_url || null,
                b.height ? Number(b.height) : 5.0,
                b.has_marker !== undefined ? (b.has_marker ? 1 : 0) : 1,
                b.is_visible !== undefined ? (b.is_visible ? 1 : 0) : 1,
                id
            ]);
            await logAudit('UPDATE_BUILDING', 'buildings', id, `Updated building "${b.name}" (#${b.building_num || 'unnumbered'})`);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/admin/buildings/:id', requireSuperAdmin, async (req, res) => {
        const id = Number(req.params.id);
        try {
            const [row] = await query(`SELECT station_id, building_code, name FROM buildings WHERE id = ?`, [id]);
            if (row) {
                await query(`DELETE FROM building_images WHERE station_id = ? AND building_code = ?`, [row.station_id, row.building_code]);
                await query(`DELETE FROM building_offices WHERE station_id = ? AND building_code = ?`, [row.station_id, row.building_code]);
                await query(`DELETE FROM buildings WHERE id = ?`, [id]);
                await logAudit('DELETE_BUILDING', 'buildings', row.building_code, `Deleted building "${row.name}" (${row.building_code})`);
            }
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =========================================================================
    // 6. BUILDING MULTI-PHOTOS CRUD (Table 3: `building_images`)
    // =========================================================================
    router.post('/admin/building-images', requireSuperAdmin, async (req, res) => {
        const b = req.body || {};
        const stationId = (b.station_id || 'lares').toLowerCase();
        const bCode = b.building_code;
        if (!bCode) return res.status(400).json({ error: 'building_code is required' });

        try {
            let finalUrl = b.image_webp_url || '';

            // Support base64 file upload directly from the Admin CRUD form
            if (b.base64_data && b.filename) {
                const safeBase = b.filename.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/\.(webp|jpg|jpeg|png)$/i, '');
                const outName = `${safeBase}_${Date.now()}.webp`;
                const outPath = path.join(rootDir, 'images', outName);
                const base64Clean = b.base64_data.replace(/^data:image\/\w+;base64,/, '');
                fs.writeFileSync(outPath, Buffer.from(base64Clean, 'base64'));
                finalUrl = `images/${outName}`;
            }

            if (!finalUrl) return res.status(400).json({ error: 'Image URL or uploaded file is required' });

            if (b.is_primary) {
                await query(`UPDATE building_images SET is_primary = 0 WHERE station_id = ? AND building_code = ?`, [stationId, bCode]);
            }

            const result = await query(`
                INSERT INTO building_images (station_id, building_code, image_webp_url, caption, display_order, is_primary)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                stationId, bCode, finalUrl,
                b.caption || 'Facility View',
                b.display_order ? Number(b.display_order) : 1,
                b.is_primary ? 1 : 0
            ]);

            await logAudit('ADD_BUILDING_IMAGE', 'building_images', bCode, `Added photo "${finalUrl}" (${b.caption || 'Facility View'}) to ${bCode}`);
            res.json({ success: true, id: result.insertId, image_webp_url: finalUrl });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/building-images/:id', requireSuperAdmin, async (req, res) => {
        const id = Number(req.params.id);
        const b = req.body || {};
        try {
            const [row] = await query(`SELECT * FROM building_images WHERE id = ?`, [id]);
            if (!row) return res.status(404).json({ error: 'Image not found' });

            if (b.is_primary) {
                await query(`UPDATE building_images SET is_primary = 0 WHERE station_id = ? AND building_code = ?`, [row.station_id, row.building_code]);
            }

            await query(`
                UPDATE building_images SET
                    caption = COALESCE(?, caption),
                    display_order = COALESCE(?, display_order),
                    is_primary = COALESCE(?, is_primary)
                WHERE id = ?
            `, [
                b.caption ?? null,
                b.display_order !== undefined ? Number(b.display_order) : null,
                b.is_primary !== undefined ? (b.is_primary ? 1 : 0) : null,
                id
            ]);
            await logAudit('UPDATE_BUILDING_IMAGE', 'building_images', id, `Updated photo #${id} on ${row.building_code}`);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/admin/building-images/:id', requireSuperAdmin, async (req, res) => {
        const id = Number(req.params.id);
        try {
            const [row] = await query(`SELECT * FROM building_images WHERE id = ?`, [id]);
            await query(`DELETE FROM building_images WHERE id = ?`, [id]);
            if (row) {
                await logAudit('DELETE_BUILDING_IMAGE', 'building_images', row.building_code, `Removed photo "${row.image_webp_url}" from ${row.building_code}`);
            }
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =========================================================================
    // 7. INTERNAL OFFICES CRUD (Table 4: `building_offices`)
    // =========================================================================
    router.get('/admin/offices', requireSuperAdmin, async (req, res) => {
        const stationId = (req.query.station || 'lares').toLowerCase();
        const bCode = req.query.building_code;
        try {
            let sql = `
                SELECT o.*, b.name AS building_name, b.building_num
                FROM building_offices o
                LEFT JOIN buildings b ON b.station_id = o.station_id AND b.building_code = o.building_code
                WHERE o.station_id = ?
            `;
            const params = [stationId];
            if (bCode) {
                sql += ` AND o.building_code = ?`;
                params.push(bCode);
            }
            sql += ` ORDER BY b.building_num ASC, o.building_code ASC, o.display_order ASC, o.id ASC`;
            const rows = await query(sql, params);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/offices', requireSuperAdmin, async (req, res) => {
        const b = req.body || {};
        const stationId = (b.station_id || 'lares').toLowerCase();
        if (!b.building_code || !b.office_name) {
            return res.status(400).json({ error: 'building_code and office_name are required' });
        }
        try {
            const result = await query(`
                INSERT INTO building_offices (station_id, building_code, office_name, office_desc, floor_or_room, search_keywords, display_order)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                stationId, b.building_code, b.office_name,
                b.office_desc || null, b.floor_or_room || null, b.search_keywords || null,
                b.display_order ? Number(b.display_order) : 1
            ]);
            await logAudit('CREATE_OFFICE', 'building_offices', b.building_code, `Added office "${b.office_name}" to ${b.building_code}`);
            res.json({ success: true, id: result.insertId });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/offices/:id', requireSuperAdmin, async (req, res) => {
        const id = Number(req.params.id);
        const b = req.body || {};
        try {
            await query(`
                UPDATE building_offices SET
                    building_code = COALESCE(?, building_code),
                    office_name = COALESCE(?, office_name),
                    office_desc = ?,
                    floor_or_room = ?,
                    search_keywords = ?,
                    display_order = COALESCE(?, display_order)
                WHERE id = ?
            `, [
                b.building_code ?? null,
                b.office_name ?? null,
                b.office_desc ?? null,
                b.floor_or_room ?? null,
                b.search_keywords ?? null,
                b.display_order !== undefined ? Number(b.display_order) : null,
                id
            ]);
            await logAudit('UPDATE_OFFICE', 'building_offices', id, `Updated office "${b.office_name}"`);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/admin/offices/:id', requireSuperAdmin, async (req, res) => {
        const id = Number(req.params.id);
        try {
            const [row] = await query(`SELECT * FROM building_offices WHERE id = ?`, [id]);
            await query(`DELETE FROM building_offices WHERE id = ?`, [id]);
            if (row) {
                await logAudit('DELETE_OFFICE', 'building_offices', row.building_code, `Removed office "${row.office_name}" from ${row.building_code}`);
            }
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =========================================================================
    // 8. AGRICULTURAL PLOTS & SUB-PLOTS CRUD (Tables 6 & 7)
    // =========================================================================
    router.get('/admin/plots', requireSuperAdmin, async (req, res) => {
        const stationId = (req.query.station || 'lares').toLowerCase();
        try {
            const plots = await query(`SELECT * FROM agricultural_plots WHERE station_id = ? ORDER BY id ASC`, [stationId]);
            const subplots = await query(`SELECT * FROM plot_subplots WHERE station_id = ? ORDER BY display_order ASC, id ASC`, [stationId]);
            const spMap = {};
            subplots.forEach(sp => {
                if (!spMap[sp.parent_plot_code]) spMap[sp.parent_plot_code] = [];
                spMap[sp.parent_plot_code].push(sp);
            });
            res.json(plots.map(p => ({
                ...p,
                subPlots: spMap[p.plot_code] || []
            })));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/plots', requireSuperAdmin, async (req, res) => {
        const b = req.body || {};
        const stationId = (b.station_id || 'lares').toLowerCase();
        const plotCode = (b.plot_code || `plot_${Date.now()}`).trim();
        try {
            const result = await query(`
                INSERT INTO agricultural_plots (
                    station_id, plot_code, plot_number, zone_name, category, icon, color,
                    current_crop, tree_or_plant_count, cropping_cycle, cycle_months,
                    area_hectares, soil_type, status, description, image_webp_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                stationId, plotCode, b.plot_number || '', b.zone_name || 'New Plot Zone',
                b.category || 'orchard', b.icon || '🌱', b.color || '#22c55e',
                b.current_crop || null,
                b.tree_or_plant_count !== '' && b.tree_or_plant_count !== null && b.tree_or_plant_count !== undefined ? Number(b.tree_or_plant_count) : null,
                b.cropping_cycle || 'perennial',
                b.cycle_months || null,
                b.area_hectares !== '' && b.area_hectares !== null && b.area_hectares !== undefined ? Number(b.area_hectares) : null,
                b.soil_type || null,
                b.status || 'Active',
                b.description || '',
                b.image_webp_url || null
            ]);
            await logAudit('CREATE_PLOT', 'agricultural_plots', plotCode, `Created plot "${b.zone_name}" (${b.plot_number || plotCode})`);
            res.json({ success: true, id: result.insertId, plot_code: plotCode });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/plots/:id', requireSuperAdmin, async (req, res) => {
        const id = Number(req.params.id);
        const b = req.body || {};
        try {
            await query(`
                UPDATE agricultural_plots SET
                    plot_number = ?,
                    zone_name = ?,
                    category = ?,
                    icon = ?,
                    color = ?,
                    current_crop = ?,
                    tree_or_plant_count = ?,
                    cropping_cycle = ?,
                    cycle_months = ?,
                    area_hectares = ?,
                    soil_type = ?,
                    status = ?,
                    description = ?,
                    image_webp_url = ?
                WHERE id = ?
            `, [
                b.plot_number || '',
                b.zone_name,
                b.category || 'orchard',
                b.icon || '🌱',
                b.color || '#22c55e',
                b.current_crop || null,
                b.tree_or_plant_count !== '' && b.tree_or_plant_count !== null && b.tree_or_plant_count !== undefined ? Number(b.tree_or_plant_count) : null,
                b.cropping_cycle || 'perennial',
                b.cycle_months || null,
                b.area_hectares !== '' && b.area_hectares !== null && b.area_hectares !== undefined ? Number(b.area_hectares) : null,
                b.soil_type || null,
                b.status || 'Active',
                b.description || '',
                b.image_webp_url || null,
                id
            ]);
            await logAudit('UPDATE_PLOT', 'agricultural_plots', id, `Updated plot "${b.zone_name}" (Crop: ${b.current_crop || 'N/A'}, Trees: ${b.tree_or_plant_count ?? 'N/A'}, Cycle: ${b.cropping_cycle})`);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/admin/plots/:id', requireSuperAdmin, async (req, res) => {
        const id = Number(req.params.id);
        try {
            const [row] = await query(`SELECT * FROM agricultural_plots WHERE id = ?`, [id]);
            if (row) {
                await query(`DELETE FROM plot_subplots WHERE station_id = ? AND parent_plot_code = ?`, [row.station_id, row.plot_code]);
                await query(`DELETE FROM agricultural_plots WHERE id = ?`, [id]);
                await logAudit('DELETE_PLOT', 'agricultural_plots', row.plot_code, `Deleted plot "${row.zone_name}"`);
            }
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/subplots/:id', requireSuperAdmin, async (req, res) => {
        const id = Number(req.params.id);
        const b = req.body || {};
        try {
            await query(`
                UPDATE plot_subplots SET
                    name = ?,
                    current_crop = ?,
                    tree_or_plant_count = ?,
                    cropping_cycle = ?,
                    description = ?,
                    image_webp_url = ?
                WHERE id = ?
            `, [
                b.name,
                b.current_crop || null,
                b.tree_or_plant_count !== '' && b.tree_or_plant_count !== null && b.tree_or_plant_count !== undefined ? Number(b.tree_or_plant_count) : null,
                b.cropping_cycle || null,
                b.description || '',
                b.image_webp_url || null,
                id
            ]);
            await logAudit('UPDATE_SUBPLOT', 'plot_subplots', id, `Updated sub-plot "${b.name}"`);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
