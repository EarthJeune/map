/**
 * DA-CALABARZON iGUIDE MySQL CRUD, Normalized RBAC, Onboarding, Governance & Publish Router
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (e) {}

const {
    ROLE_DEFS,
    VALID_STATIONS,
    validateUniquePassword,
    sha256Hex,
    hashPasswordScrypt,
    verifyPasswordScrypt,
    initRbacSchemaAndSeed,
    createRbacManager
} = require('./rbac');
const {
    runInTransaction,
    bumpDataVersion,
    applyCrudOperation,
    reconcileDiskAssets,
    hasValidGeoGeometry,
    hasFiniteLngLat,
    hasBuildingGeometry,
    hasPlotGeometry
} = require('./publish_engine');
const {
    buildOtpSecurityEmail,
    buildWorkflowEmail
} = require('./email_templates');
const { normalizeOfficePayload } = require('./office_text_normalizer');
const phase1 = require('./phase1_safety');

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

    async function logAudit(action, targetTable, targetId, summary, actorOrUsername = 'admin') {
        try {
            let meta;
            if (actorOrUsername && typeof actorOrUsername === 'object') {
                meta = phase1.formatActorAuditMeta(actorOrUsername);
            } else {
                const uname = String(actorOrUsername || 'admin');
                let userRow = null;
                if (uname.includes('@')) {
                    const rows = await query(`SELECT id, full_name, role, is_test FROM admin_users WHERE LOWER(email) = LOWER(?) LIMIT 1`, [uname]).catch(() => []);
                    userRow = rows[0] || null;
                }
                meta = phase1.formatActorAuditMeta({
                    userId: userRow?.id || null,
                    email: uname,
                    fullName: userRow?.full_name || uname,
                    baseRole: userRow?.role || (uname === 'super_admin' ? 'super_admin' : 'admin'),
                    role: userRow?.role || 'admin',
                    isTest: userRow?.is_test || 0
                });
            }
            await query(
                `INSERT INTO admin_audit_logs (
                    admin_username, action, target_table, target_id, summary,
                    actor_user_id, actor_display_name, actor_base_role, actor_effective_role, acting_label, is_test
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    meta.email,
                    action,
                    targetTable,
                    String(targetId || ''),
                    summary,
                    meta.userId,
                    meta.displayName,
                    meta.baseRole,
                    meta.effectiveRole,
                    meta.actingLabel,
                    meta.isTest
                ]
            );
        } catch (e) {
            console.warn('[AuditLog] Failed to record audit log:', e.message);
        }
    }

    function maskEmail(email) {
        if (!email || !email.includes('@')) return '';
        const [u, d] = email.split('@');
        const visible = u.slice(0, Math.min(2, u.length));
        return `${visible}${'*'.repeat(Math.max(2, u.length - 2))}@${d}`;
    }

    function maskStrictEmail(email) {
        if (!email || !email.includes('@')) return '****@hidden';
        const [, d] = email.split('@');
        return `****@${d}`;
    }

    function formatRoleStationLabel(role, stationId, fallbackRole = 'GIS Editor') {
        const roleLabels = {
            gis_editor: 'GIS Editor',
            reviewer: 'Station Reviewer',
            administrator: 'Administrator',
            super_admin: fallbackRole
        };
        const rLabel = roleLabels[String(role || '').toLowerCase()] || fallbackRole;
        const st = String(stationId || 'lares').toUpperCase();
        return `${rLabel} - DA ${st}`;
    }

    async function sanitizeChangeRequestPrivacy(rows, adminUser) {
        if (!Array.isArray(rows) || !rows.length) return [];
        const isTrueSuperAdminView = adminUser?.baseRole === 'super_admin' && (!adminUser?.role || adminUser.role === 'super_admin');
        const userIds = new Set();
        const emails = new Set();
        for (const r of rows) {
            if (r.submitted_by_user_id) userIds.add(Number(r.submitted_by_user_id));
            if (r.reviewed_by_user_id) userIds.add(Number(r.reviewed_by_user_id));
            if (r.submitted_by_email) emails.add(String(r.submitted_by_email).toLowerCase());
            if (r.reviewed_by_email) emails.add(String(r.reviewed_by_email).toLowerCase());
        }
        const byId = new Map();
        const byEmail = new Map();
        if (userIds.size || emails.size) {
            const clauses = [];
            const params = [];
            if (userIds.size) {
                clauses.push(`id IN (${Array.from(userIds).map(() => '?').join(',')})`);
                params.push(...Array.from(userIds));
            }
            if (emails.size) {
                clauses.push(`LOWER(email) IN (${Array.from(emails).map(() => '?').join(',')})`);
                params.push(...Array.from(emails));
            }
            try {
                const uRows = await query(`SELECT id, email, role FROM admin_users WHERE ${clauses.join(' OR ')}`, params);
                for (const u of uRows) {
                    byId.set(Number(u.id), u);
                    if (u.email) byEmail.set(String(u.email).toLowerCase(), u);
                }
            } catch (_) { /* fallback to default labels */ }
        }
        return rows.map((r) => {
            const subUser = (r.submitted_by_user_id && byId.get(Number(r.submitted_by_user_id)))
                || (r.submitted_by_email && byEmail.get(String(r.submitted_by_email).toLowerCase()))
                || null;
            const revUser = (r.reviewed_by_user_id && byId.get(Number(r.reviewed_by_user_id)))
                || (r.reviewed_by_email && byEmail.get(String(r.reviewed_by_email).toLowerCase()))
                || null;
            const isOwn = Boolean(
                (r.submitted_by_user_id && adminUser?.userId && Number(r.submitted_by_user_id) === Number(adminUser.userId))
                || (r.submitted_by_email && adminUser?.email && String(r.submitted_by_email).toLowerCase() === String(adminUser.email).toLowerCase())
            );
            const subRole = subUser?.role || 'gis_editor';
            const revRole = revUser?.role || 'reviewer';
            const submitted_by_label = formatRoleStationLabel(subRole, r.station_id, 'GIS Editor');
            const reviewed_by_label = (r.reviewed_by_email || r.reviewed_by_user_id || r.reviewed_at)
                ? formatRoleStationLabel(revRole, r.station_id, 'Station Reviewer')
                : null;
            const clean = { ...r };
            delete clean.submitted_by_email;
            delete clean.submitted_by_name;
            delete clean.reviewed_by_email;
            delete clean.reviewed_by_name;
            return {
                ...clean,
                is_own_submission: isOwn,
                submitted_by_label,
                reviewed_by_label,
                submitted_by_masked_email: isTrueSuperAdminView && r.submitted_by_email ? maskStrictEmail(r.submitted_by_email) : null,
                reviewed_by_masked_email: isTrueSuperAdminView && r.reviewed_by_email ? maskStrictEmail(r.reviewed_by_email) : null,
                can_reveal_identity: isTrueSuperAdminView
            };
        });
    }

    function getPublicBaseUrl(req) {
        const envUrl = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
        if (envUrl) return envUrl;
        const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
        const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:8080';
        return `${proto}://${host}`;
    }

    async function sendMailSafe({ to, subject, text, html }) {
        const cleanTo = String(to || '').trim().toLowerCase();
        // Safeguard: never send real SMTP emails when DISABLE_EMAILS=1 or to reserved test domains
        if (process.env.DISABLE_EMAILS === '1' || /@(test\.local|example\.(com|org|net)|localhost|invalid)$/i.test(cleanTo)) {
            return { sent: false, mode: 'suppressed_test' };
        }
        const smtpUser = (process.env.SMTP_USER || '').trim();
        const smtpPass = (process.env.SMTP_APP_PASSWORD || '').trim();
        if (nodemailer && smtpUser && smtpPass) {
            try {
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
            } catch (err) {
                console.warn('[iGUIDE Mailer] Gmail send warning:', err.message);
                return { sent: false, mode: 'error', error: err.message };
            }
        }
        console.log(`\n[iGUIDE Mailer - Console Fallback] To: ${maskEmail(to)} | Subject: ${subject}\n${text}\n`);
        return { sent: false, mode: 'console' };
    }

    const mailQueue = [];
    let mailActiveWorkers = 0;
    const MAIL_QUEUE_MAX = 200;

    function queueBackgroundMail(payload) {
        if (!payload || !payload.to) return;
        if (mailQueue.length >= MAIL_QUEUE_MAX) return;
        mailQueue.push(payload);
        setImmediate(drainMailQueue);
    }

    function drainMailQueue() {
        while (mailActiveWorkers < 2 && mailQueue.length > 0) {
            const job = mailQueue.shift();
            mailActiveWorkers += 1;
            sendMailSafe(job)
                .catch((err) => console.warn('[iGUIDE AsyncMailer] Warning:', err && err.message))
                .finally(() => {
                    mailActiveWorkers -= 1;
                    if (mailQueue.length > 0) setImmediate(drainMailQueue);
                });
        }
    }

    const rbac = createRbacManager(query, logAudit);
    const { authorize } = rbac;

    // Initialize RBAC & Phase 1 Schema on startup
    const initReady = initRbacSchemaAndSeed(query).catch(err => {
        console.warn('[RBAC Init] Notice initializing schema:', err.message);
    });

    const loginAttempts = new Map();
    const otpEmailCooldowns = new Map();       // lowerEmail -> { count, resetAt }
    const pendingOtpTokens = new Map();        // login OTP: token -> { userId, expiresAtMs }
    const pendingResetOtpTokens = new Map();   // forgot-password OTP: token -> { userId, verified, expiresAtMs }
    const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
    const activeSessions = new Map();

    // Public read cache (/api/bootstrap) + mutation idempotency deduplication store
    const bootstrapCache = new Map();          // stationId -> { payload, expiresAtMs }
    const bootstrapInFlight = new Map();       // stationId -> Promise
    const idempotencyResults = new Map();      // dedupKey -> { status, body, expiresAtMs }
    const idempotencyInFlight = new Map();     // dedupKey -> Promise
    const cacheInvalidationListeners = [];

    function invalidatePublicCache(reason = 'mutation') {
        bootstrapCache.clear();
        for (const fn of cacheInvalidationListeners) {
            try { fn(reason); } catch (_) { }
        }
    }

    router.invalidatePublicCache = invalidatePublicCache;
    router.onCacheInvalidated = (fn) => {
        if (typeof fn === 'function') cacheInvalidationListeners.push(fn);
    };

    const mapSweepTimer = setInterval(() => {
        const now = Date.now();
        for (const [k, v] of loginAttempts.entries()) { if (now > v.resetAt) loginAttempts.delete(k); }
        for (const [k, v] of otpEmailCooldowns.entries()) { if (now > v.resetAt) otpEmailCooldowns.delete(k); }
        for (const [k, v] of pendingOtpTokens.entries()) { if (now > v.expiresAtMs) pendingOtpTokens.delete(k); }
        for (const [k, v] of pendingResetOtpTokens.entries()) { if (now > v.expiresAtMs) pendingResetOtpTokens.delete(k); }
        for (const [k, v] of activeSessions.entries()) { if (v.revoked || now > v.expiresAtMs) activeSessions.delete(k); }
        for (const [k, v] of bootstrapCache.entries()) { if (now > v.expiresAtMs) bootstrapCache.delete(k); }
        for (const [k, v] of idempotencyResults.entries()) { if (now > v.expiresAtMs) idempotencyResults.delete(k); }
    }, 30000);
    if (typeof mapSweepTimer.unref === 'function') mapSweepTimer.unref();

    function checkAndConsumeOtpQuota(email) {
        const key = String(email || '').trim().toLowerCase();
        if (!key) return { allowed: true };
        const now = Date.now();
        let rec = otpEmailCooldowns.get(key);
        if (!rec || now > rec.resetAt) {
            rec = { count: 0, resetAt: now + 30000 };
        }
        if (rec.count >= 2) {
            const waitSec = Math.max(1, Math.ceil((rec.resetAt - now) / 1000));
            return { allowed: false, waitSec };
        }
        rec.count += 1;
        otpEmailCooldowns.set(key, rec);
        return { allowed: true };
    }

    // Invalidate cached bootstrap/version on any successful mutating API response
    router.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD' && !req.path.startsWith('/admin/diagnostics')) {
            res.on('finish', () => {
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    invalidatePublicCache(`${req.method} ${req.path}`);
                }
            });
        }
        next();
    });

    // Idempotency / duplicate-click dedup guard on draft & CRUD submissions
    const IDEMPOTENT_PATH_RE = /^\/admin\/(change-requests(?:\/\d+\/resubmit)?|buildings(?:\/\d+)?|offices(?:\/\d+)?|plots(?:\/split|\/merge|\/\d+)?|subplots\/\d+|stations\/[a-z]+)$/i;
    router.use(async (req, res, next) => {
        if (!['POST', 'PUT', 'PATCH'].includes(req.method) || !IDEMPOTENT_PATH_RE.test(req.path)) {
            return next();
        }
        const token = extractTokenFromRequest(req) || String(req.ip || 'anon');
        const clientKey = String(req.headers['x-idempotency-key'] || '').trim();
        const bodyHash = sha256Hex(JSON.stringify(req.body || {}));
        const dedupKey = `${token.slice(0, 16)}:${req.method}:${req.path}:${clientKey || bodyHash}`;

        const cached = idempotencyResults.get(dedupKey);
        if (cached && Date.now() < cached.expiresAtMs) {
            return res.status(cached.status).json({ ...(cached.body || {}), deduplicated: true });
        }
        const pending = idempotencyInFlight.get(dedupKey);
        if (pending) {
            try {
                const outcome = await pending;
                return res.status(outcome.status).json({ ...(outcome.body || {}), deduplicated: true });
            } catch (e) {
                return res.status(503).json({ error: 'Concurrent identical request failed.' });
            }
        }

        let resolveFlight;
        const flightPromise = new Promise((resolve) => { resolveFlight = resolve; });
        idempotencyInFlight.set(dedupKey, flightPromise);

        const origJson = res.json.bind(res);
        res.json = (body) => {
            const status = res.statusCode || 200;
            if (status >= 200 && status < 400) {
                idempotencyResults.set(dedupKey, { status, body, expiresAtMs: Date.now() + 4000 });
            }
            resolveFlight({ status, body });
            idempotencyInFlight.delete(dedupKey);
            return origJson(body);
        };
        res.on('close', () => {
            if (idempotencyInFlight.has(dedupKey)) {
                resolveFlight({ status: res.statusCode || 500, body: { error: 'Request aborted' } });
                idempotencyInFlight.delete(dedupKey);
            }
        });
        next();
    });

    function safeCompareHex(a, b) {
        if (!a || !b || a.length !== 64 || b.length !== 64) return false;
        try {
            return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
        } catch (e) {
            return false;
        }
    }

    function generateToken(bytes = 32) {
        return crypto.randomBytes(bytes).toString('hex');
    }

    function extractTokenFromRequest(req) {
        const authHeader = req.headers['authorization'] || '';
        const headerToken = req.headers['x-admin-token'] || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');
        if (headerToken) return String(headerToken).trim();
        if (req.body && typeof req.body === 'object' && req.body.token) return String(req.body.token).trim();
        return '';
    }

    async function verifySessionAsync(token) {
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
                `SELECT expires_at, revoked, user_id, role, base_role, switched_role, station_id, email
                 FROM admin_sessions WHERE token = ? LIMIT 1`,
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
                role: row.switched_role || row.role || 'super_admin',
                baseRole: row.base_role || row.role || 'super_admin',
                switchedRole: row.switched_role || null,
                stationId: row.station_id || null,
                email: row.email || null
            };
            activeSessions.set(token, sess);
            return sess;
        } catch (e) {
            return null;
        }
    }

    async function authenticateSession(req, res, next) {
        await initReady;
        const token = extractTokenFromRequest(req);
        const sess = await verifySessionAsync(token);
        if (sess) {
            req.adminToken = token;
            req.adminUser = sess;
            return next();
        }
        return res.status(401).json({ error: 'Unauthorized: Valid iGUIDE login session required.' });
    }

    // Propagate a role / station-scope change to every live session of the target user
    // (DB rows + in-memory cache) so their next request and poll reflect the new access profile.
    async function syncUserLiveSessions(targetId, roleSlug, stationScope) {
        try {
            await query(
                `UPDATE admin_sessions SET role = ?, base_role = ?, switched_role = NULL, station_id = ? WHERE user_id = ? AND revoked = 0`,
                [roleSlug, roleSlug, stationScope, targetId]
            );
        } catch (_) { }
        for (const [tok, sess] of activeSessions.entries()) {
            if (Number(sess.userId) === Number(targetId)) {
                sess.role = roleSlug;
                sess.baseRole = roleSlug;
                sess.switchedRole = null;
                sess.stationId = stationScope;
                activeSessions.set(tok, sess);
            }
        }
        rbac.invalidateRbacCache(targetId);
    }

    // Privacy-safe client label (no IP address, no raw user-agent string exposed to the portal)
    function friendlyDeviceLabel(ua) {
        const s = String(ua || '');
        if (!s) return 'Unknown device';
        let browser = 'Browser';
        if (/Edg\//.test(s)) browser = 'Edge';
        else if (/OPR\/|Opera/.test(s)) browser = 'Opera';
        else if (/Chrome\//.test(s)) browser = 'Chrome';
        else if (/Firefox\//.test(s)) browser = 'Firefox';
        else if (/Safari\//.test(s)) browser = 'Safari';
        let os = 'Unknown OS';
        if (/Windows NT 10/.test(s)) os = 'Windows 10/11';
        else if (/Windows/.test(s)) os = 'Windows';
        else if (/Android/.test(s)) os = 'Android';
        else if (/iPhone|iPad|iPod/.test(s)) os = 'iOS';
        else if (/Mac OS X/.test(s)) os = 'macOS';
        else if (/Linux/.test(s)) os = 'Linux';
        const kind = /Mobile|Android|iPhone|iPod/.test(s) ? 'Mobile' : (/iPad|Tablet/.test(s) ? 'Tablet' : 'Desktop');
        return `${browser} • ${os} • ${kind}`;
    }

    async function issueOtpAndEmail(user, purpose = 'login') {
        const otp = String(crypto.randomInt(100000, 999999));
        const otpHash = sha256Hex(otp);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        await query(
            `UPDATE admin_users SET otp_hash = ?, otp_expires_at = ?, otp_attempts = 0 WHERE id = ?`,
            [otpHash, expiresAt, user.id]
        );
        const otpToken = generateToken(24);
        const mapStore = purpose === 'reset' ? pendingResetOtpTokens : pendingOtpTokens;
        mapStore.set(otpToken, { userId: user.id, verified: false, expiresAtMs: Date.now() + 10 * 60 * 1000 });
        const targetEmail = user.email || (process.env.ADMIN_EMAIL || '').trim();
        let mailResult = { sent: false, mode: 'console' };
        if (targetEmail) {
            const label = purpose === 'reset' ? 'Password Reset Code' : 'Login Verification Code';
            const targetRole = user.role_slug || user.role || 'administrator';
            mailResult = await sendMailSafe({
                to: targetEmail,
                subject: `[iGUIDE] Your ${label}: ${otp}`,
                text: `Hello ${user.full_name || 'User'},\n\nYour 6-digit iGUIDE ${label.toLowerCase()} is: ${otp}\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
                html: buildOtpSecurityEmail({
                    userName: user.full_name || user.first_name || 'User',
                    role: targetRole,
                    otp,
                    purpose
                })
            });
        }
        return { otpToken, maskedEmail: maskEmail(targetEmail), mailMode: mailResult.mode };
    }

    router.authenticateSession = authenticateSession;
    router.authorize = authorize;
    router.verifyAdminTokenAsync = verifySessionAsync;
    router.initReady = initReady;

    // Extract clean human-readable facility / plot / office name (never raw "CR #63" as the primary label)
    function extractCrTargetName(summary = '', payloadJson = null, fallbackId = '') {
        let parsed = null;
        if (payloadJson && typeof payloadJson === 'object') parsed = payloadJson;
        else if (typeof payloadJson === 'string' && payloadJson.trim()) {
            try { parsed = JSON.parse(payloadJson); } catch (_) { }
        }
        const fromPayload = parsed && (parsed.name || parsed.office_name || parsed.plot_name || parsed.title || parsed.station_name);
        if (fromPayload && String(fromPayload).trim()) return String(fromPayload).trim();

        const raw = String(summary || '').trim();
        const quoted = raw.match(/"([^"]{2,120})"/);
        if (quoted && quoted[1]) return quoted[1].trim();
        const stripped = raw
            .replace(/^(Update|Create|Add|Delete|Remove|Edit|Split|Merge)\s+(Building|Facility|Plot|Agricultural Plot|Office|Internal Office|Station|Photo|Image)\s*:?\s*/i, '')
            .replace(/^["']|["']$/g, '')
            .trim();
        if (stripped) return stripped;
        return fallbackId ? `Request #${fallbackId}` : 'Campus Record';
    }

    // Unified Live System Sync: Bell Notification + Workflow Email for ALL Visual Editors
    // (Footprints, Plots, Roads, Trees, Pills, Boundaries, Kiosk Pin & Drone Offset)
    router.notifyVisualEditorSaved = async ({
        stationId = 'lares',
        editorLabel = 'Visual Editor',
        targetTable = 'geometry',
        actorEmail = 'GIS Editor',
        actorUserId = null,
        summaryText = '',
        req = null
    } = {}) => {
        try {
            await initReady;
            const st = String(stationId || 'lares').toLowerCase();
            const stLabel = `DA-${st.toUpperCase()}`;
            const title = `${editorLabel} Updated — ${stLabel}`;
            const message = summaryText || `${actorEmail} saved updated ${editorLabel.toLowerCase()} geometry for ${stLabel}.`;

            // Notify all concerned Reviewers, GIS Editors, Administrators, and Super Admins for this station
            const recipients = await rbac.findConcernedUsers({
                roles: ['reviewer', 'gis_editor', 'administrator', 'super_admin'],
                stationId: st
            });
            const portalUrl = req ? `${getPublicBaseUrl(req)}/login` : '/admin.html';

            // 1. Insert ALL real-time in-app bell notifications first (< 20ms total)
            const emailTargets = [];
            for (const u of recipients) {
                if (actorUserId && Number(u.id) === Number(actorUserId)) continue;
                await rbac.notifyUser(u.id, {
                    type: 'geometry_sync',
                    title,
                    message,
                    station_id: st,
                    link_tab: u.role_slug === 'reviewer' ? 'review-queue' : 'dashboard',
                    target_table: targetTable,
                    target_id: st
                });
                if (u.email && ['reviewer', 'administrator'].includes(u.role_slug)) {
                    emailTargets.push(u);
                }
            }
            await logAudit('VISUAL_EDITOR_SAVE', targetTable, st, message, actorEmail);

            // 2. Dispatch Live System Sync emails concurrently in the background (never blocks bell notifications)
            if (emailTargets.length > 0) {
                Promise.allSettled(emailTargets.map(u => sendMailSafe({
                    to: u.email,
                    subject: `[iGUIDE Live Sync] ${title}`,
                    text: `Hello ${u.full_name || 'Team'},\n\n${message}\n\nStation: ${stLabel}\nVisual Editor: ${editorLabel}\nUpdated By: ${actorEmail}\n\nInspect on iGUIDE Portal:\n${portalUrl}`,
                    html: buildWorkflowEmail({
                        role: u.role_slug || 'reviewer',
                        headerTitle: `🌿 iGUIDE Live Geometry Sync`,
                        roleBadgeText: `${editorLabel} • ${stLabel}`,
                        greeting: `Hello ${u.full_name || 'Team'},`,
                        introText: `An authenticated Visual Editor geometry save was synced live on ${stLabel}:`,
                        details: [
                            { label: 'Visual Editor', value: editorLabel },
                            { label: 'Station', value: stLabel },
                            { label: 'Summary', value: message },
                            { label: 'Updated By', value: actorEmail }
                        ],
                        ctaLabel: 'Open iGUIDE Portal',
                        ctaUrl: portalUrl
                    })
                }))).catch(() => {});
            }
        } catch (err) {
            console.warn('[Visual Editor Sync Notify] warning:', err.message);
        }
    };

    // Backward-compatible alias for road-only callers
    router.notifyRoadNetworkSaved = async ({ stationId = 'lares', actorEmail = 'GIS Editor', actorUserId = null, roadCount = 0, entranceCount = 0, req = null } = {}) => {
        const detail = `${actorEmail} saved ${roadCount} road path${roadCount === 1 ? '' : 's'} & ${entranceCount} entrance${entranceCount === 1 ? '' : 's'} in Road Drawer.`;
        return router.notifyVisualEditorSaved({
            stationId,
            editorLabel: 'Road & Entrance Network',
            targetTable: 'roads',
            actorEmail,
            actorUserId,
            summaryText: detail,
            req
        });
    };

    // =========================================================================
    // 1. PUBLIC DATABASE BOOTSTRAP API (`GET /api/bootstrap`)
    // =========================================================================
    router.get('/bootstrap', async (req, res) => {
        await initReady;
        const stationId = (req.query.station || 'lares').toLowerCase();
        const acceptsGzip = String(req.headers['accept-encoding'] || '').toLowerCase().includes('gzip');
        const sendCachedBootstrap = (entry, cacheStatus) => {
            res.setHeader('X-Cache', cacheStatus);
            res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=30');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Vary', 'Accept-Encoding');
            if (acceptsGzip && entry.gzipBytes) {
                res.setHeader('Content-Encoding', 'gzip');
                res.setHeader('Content-Length', String(entry.gzipBytes.length));
                return res.end(entry.gzipBytes);
            }
            res.setHeader('Content-Length', String(entry.jsonBytes.length));
            return res.end(entry.jsonBytes);
        };

        const now = Date.now();
        const cached = bootstrapCache.get(stationId);
        if (cached && now < cached.expiresAtMs) {
            return sendCachedBootstrap(cached, 'HIT');
        }
        try {
            let inflight = bootstrapInFlight.get(stationId);
            if (!inflight) {
                inflight = (async () => {
                    const allStations = await query(`
                        SELECT station_id, name, label, subtitle, full_name, province, status,
                               kiosk_pin_lng, kiosk_pin_lat, drone_offset_dx, drone_offset_dy,
                               default_center_lng, default_center_lat, default_zoom, default_pitch, default_bearing,
                               mbtiles_filename, welcome_tags, quick_tags, filter_descriptions
                        FROM stations
                        ORDER BY FIELD(station_id, 'lares', 'qares', 'rares', 'cares')
                    `);
                    const station = allStations.find(s => s.station_id === stationId) || allStations[0] || null;

                    const [buildings, images, offices, entrances, plots, subplots] = await Promise.all([
                        query(`
                            SELECT * FROM buildings
                            WHERE station_id = ? AND is_visible = 1
                              AND (
                                (footprint_geojson IS NOT NULL AND LENGTH(TRIM(footprint_geojson)) > 0)
                                OR (marker_lng IS NOT NULL AND marker_lat IS NOT NULL AND marker_lng != 0 AND marker_lat != 0)
                              )
                            ORDER BY CASE WHEN building_num IS NULL THEN 1 ELSE 0 END, building_num ASC, id ASC
                        `, [stationId]),
                        query(`SELECT * FROM building_images WHERE station_id = ? ORDER BY is_primary DESC, display_order ASC, id ASC`, [stationId]),
                        query(`SELECT * FROM building_offices WHERE station_id = ? ORDER BY display_order ASC, id ASC`, [stationId]),
                        query(`SELECT * FROM building_entrances WHERE station_id = ?`, [stationId]),
                        query(`
                            SELECT * FROM agricultural_plots
                            WHERE station_id = ?
                              AND (
                                (polygon_geojson IS NOT NULL AND LENGTH(TRIM(polygon_geojson)) > 0)
                                OR (center_lng IS NOT NULL AND center_lat IS NOT NULL AND center_lng != 0 AND center_lat != 0)
                              )
                            ORDER BY id ASC
                        `, [stationId]),
                        query(`SELECT * FROM plot_subplots WHERE station_id = ? ORDER BY display_order ASC, id ASC`, [stationId])
                    ]);

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
                    const spByPlot = {};
                    for (const sp of subplots) {
                        if (!spByPlot[sp.parent_plot_code]) spByPlot[sp.parent_plot_code] = [];
                        spByPlot[sp.parent_plot_code].push(sp);
                    }

                    const payload = {
                        station,
                        allStations,
                        buildings: buildings.map(b => ({
                            ...b,
                            facility_status: b.facility_status || 'Existing',
                            images: imgByBldg[b.building_code] || [],
                            offices: ofcByBldg[b.building_code] || [],
                            entrances: entByBldg[b.building_code] || []
                        })),
                        plots: plots.map(p => ({
                            ...p,
                            facility_status: p.facility_status || 'Existing',
                            subPlots: spByPlot[p.plot_code] || []
                        }))
                    };
                    const jsonBytes = Buffer.from(JSON.stringify(payload), 'utf8');
                    const gzipBytes = zlib.gzipSync(jsonBytes, { level: 6 });
                    const cacheEntry = { payload, jsonBytes, gzipBytes, expiresAtMs: Date.now() + 15000 };
                    bootstrapCache.set(stationId, cacheEntry);
                    return cacheEntry;
                })().finally(() => {
                    bootstrapInFlight.delete(stationId);
                });
                bootstrapInFlight.set(stationId, inflight);
            }

            const cacheEntry = await inflight;
            return sendCachedBootstrap(cacheEntry, 'MISS');
        } catch (err) {
            if (err && (err.code === 'POOL_ENQUEUELIMIT' || String(err.message || '').includes('Queue limit reached'))) {
                res.setHeader('Retry-After', '2');
                return res.status(503).json({ error: 'Database queue busy, please retry.' });
            }
            console.error('[Bootstrap API Error]:', err.message);
            res.status(500).json({ error: 'Database bootstrap temporarily unavailable.' });
        }
    });

    // =========================================================================
    // 2. ONBOARDING, UNIQUE PASSWORD AUTH, FORGOT PASSWORD & RBAC VERIFY
    // =========================================================================
    router.post('/auth/check-email', async (req, res) => {
        await initReady;
        const cleanEmail = String((req.body && req.body.email) || '').trim().toLowerCase();
        if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.json({ valid: false, available: false, reason: 'invalid_format' });
        }
        try {
            const rows = await query(`SELECT id FROM admin_users WHERE LOWER(email) = ? LIMIT 1`, [cleanEmail]);
            res.json({ valid: true, available: rows.length === 0 });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/auth/signup', async (req, res) => {
        await initReady;
        const b = req.body || {};
        const firstName = String(b.first_name || '').trim();
        const lastName = String(b.last_name || '').trim();
        const position = String(b.position || b.job_title || '').trim();
        const division = String(b.division || '').trim();
        const officeSection = String(b.office_section || '').trim();
        const cleanEmail = String(b.email || '').trim().toLowerCase();
        const rawOfficeName = String(b.office_name || '').trim();
        const officeName = rawOfficeName || (
            division
                ? (officeSection && officeSection !== 'None' ? `${division} — ${officeSection}` : division)
                : ''
        );
        const responsibilities = String(b.responsibilities || position || officeName || '').trim();
        const requestedStation = String(b.station_id || 'lares').trim().toLowerCase();
        const password = String(b.password || '');
        const confirmPassword = String(b.password_confirmation ?? b.confirm_password ?? password);

        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'First Name and Last Name are required.' });
        }
        if (!position) {
            return res.status(400).json({ error: 'Position is required.' });
        }
        if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ error: 'Please provide a valid email address.' });
        }
        if (!officeName) {
            return res.status(400).json({ error: 'Please select your Division and Office / Section.' });
        }
        if (!VALID_STATIONS.has(requestedStation)) {
            return res.status(400).json({ error: 'Please select a valid Research Station.' });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match.' });
        }
        const pwCheck = validateUniquePassword(password, { email: cleanEmail, firstName, lastName });
        if (!pwCheck.valid) {
            return res.status(400).json({ error: pwCheck.error, checks: pwCheck.checks });
        }

        const fullName = [firstName, lastName].filter(Boolean).join(' ');
        try {
            const existing = await query(`SELECT id, approval_status FROM admin_users WHERE LOWER(email) = ? LIMIT 1`, [cleanEmail]);
            if (existing.length > 0) {
                return res.status(409).json({ error: 'This email address is already registered.' });
            }

            const result = await query(`
                INSERT INTO admin_users (
                    username_sha256, password_sha256, email, full_name, first_name, middle_name, last_name,
                    job_title, role, station_id, office_name, responsibilities, approval_status, is_active
                ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'reviewer', ?, ?, ?, 'pending', 0)
            `, [
                sha256Hex(cleanEmail),
                hashPasswordScrypt(password),
                cleanEmail,
                fullName,
                firstName,
                lastName,
                position,
                requestedStation,
                officeName,
                responsibilities
            ]);

            const loginUrl = `${getPublicBaseUrl(req)}/login`;
            const admins = await rbac.findConcernedUsers({ roles: ['administrator', 'super_admin'] });
            for (const adm of admins) {
                await rbac.notifyUser(adm.id, {
                    type: 'signup_pending',
                    title: 'New Sign-Up Awaiting Approval',
                    message: `${fullName} (${position} • ${officeName}) requested portal access.`,
                    station_id: requestedStation,
                    link_tab: 'admin-reviewers',
                    target_table: 'admin_users',
                    target_id: result.insertId
                });
                if (adm.email) {
                    await sendMailSafe({
                        to: adm.email,
                        subject: `[iGUIDE Access Request] ${fullName} (${position})`,
                        text: `Hello ${adm.full_name || 'Administrator'},\n\nA new internal account registration is waiting for your approval:\n\nName: ${fullName}\nPosition: ${position}\nEmail: ${cleanEmail}\nStation: DA-${requestedStation.toUpperCase()}\nDivision / Office: ${officeName}\n\nOpen ${loginUrl} to Approve, Assign Role & Station, or Deny.`,
                        html: buildWorkflowEmail({
                            role: adm.role_slug || 'administrator',
                            headerTitle: '🌿 iGUIDE Access Request',
                            roleBadgeText: 'New Staff Sign-Up',
                            greeting: `Hello ${adm.full_name || 'Administrator'},`,
                            introText: 'A new internal registration is waiting for role assignment and approval:',
                            details: [
                                { label: 'Applicant', value: fullName },
                                { label: 'Position', value: position },
                                { label: 'Email', value: cleanEmail },
                                { label: 'Division / Office', value: officeName },
                                { label: 'Station', value: `DA-${requestedStation.toUpperCase()}` }
                            ],
                            ctaLabel: 'Review & Assign Role',
                            ctaUrl: loginUrl
                        })
                    });
                }
            }
            await logAudit('USER_SIGNUP', 'admin_users', cleanEmail, `New sign-up request from ${fullName} (${position} • ${officeName})`, cleanEmail);
            res.json({
                success: true,
                approvalStatus: 'pending',
                message: 'Account submitted! Your request is waiting for Administrator approval and role assignment.'
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/auth/forgot-password', async (req, res) => {
        await initReady;
        const cleanEmail = String((req.body && req.body.email) || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
            return res.status(400).json({ error: 'Enter a valid email address.' });
        }
        try {
            const rows = await query(`SELECT * FROM admin_users WHERE LOWER(email) = ? LIMIT 1`, [cleanEmail]);
            const user = rows && rows[0];
            if (!user) {
                return res.status(404).json({ error: 'No account found with that email address.' });
            }
            if (user.approval_status === 'pending') {
                return res.status(403).json({ error: 'Your account is still waiting for Administrator approval.' });
            }
            if (user.approval_status === 'not_approved') {
                return res.status(403).json({ error: 'Your sign-up request was not approved by the Administrator.' });
            }
            if (Number(user.is_active) === 0) {
                return res.status(403).json({ error: 'Your account is currently disabled. Contact an Administrator.' });
            }
            const otpInfo = await issueOtpAndEmail(user, 'reset');
            res.json({
                success: true,
                resetToken: otpInfo.otpToken,
                maskedEmail: otpInfo.maskedEmail,
                mailMode: otpInfo.mailMode
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/auth/reset-password', async (req, res) => {
        await initReady;
        const { resetToken, otp, new_password, password_confirmation } = req.body || {};
        const pending = pendingResetOtpTokens.get(String(resetToken || ''));
        if (!pending || Date.now() > pending.expiresAtMs) {
            pendingResetOtpTokens.delete(String(resetToken || ''));
            return res.status(401).json({ error: 'Reset session expired. Please request a new code.' });
        }
        try {
            const rows = await query(`SELECT * FROM admin_users WHERE id = ? LIMIT 1`, [pending.userId]);
            const user = rows && rows[0];
            if (!user || !user.otp_hash || !user.otp_expires_at || new Date(user.otp_expires_at).getTime() < Date.now()) {
                return res.status(401).json({ error: 'OTP expired or invalid. Request a new reset code.' });
            }
            if (Number(user.otp_attempts || 0) >= 5) {
                pendingResetOtpTokens.delete(String(resetToken || ''));
                return res.status(429).json({ error: 'Too many invalid OTP attempts.' });
            }
            if (!safeCompareHex(sha256Hex(String(otp || '').trim()), String(user.otp_hash).toLowerCase())) {
                await query(`UPDATE admin_users SET otp_attempts = otp_attempts + 1 WHERE id = ?`, [user.id]);
                return res.status(401).json({ error: 'Invalid 6-digit verification code.' });
            }
            if (String(new_password || '') !== String(password_confirmation || new_password || '')) {
                return res.status(400).json({ error: 'Passwords do not match.' });
            }
            const pwCheck = validateUniquePassword(new_password, {
                email: user.email || '',
                firstName: user.first_name || '',
                lastName: user.last_name || ''
            });
            if (!pwCheck.valid) {
                return res.status(400).json({ error: pwCheck.error, checks: pwCheck.checks });
            }

            pendingResetOtpTokens.delete(String(resetToken || ''));
            await query(
                `UPDATE admin_users SET password_sha256 = ?, otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0 WHERE id = ?`,
                [hashPasswordScrypt(new_password), user.id]
            );
            await query(`UPDATE admin_sessions SET revoked = 1 WHERE user_id = ?`, [user.id]);
            for (const [tok, sess] of activeSessions.entries()) {
                if (sess.userId === user.id) activeSessions.delete(tok);
            }
            rbac.invalidateRbacCache(user.id);
            await logAudit('PASSWORD_RESET', 'admin_users', user.email || user.id, 'User reset password via 6-digit Gmail OTP', user.email || 'user');
            res.json({ success: true, message: 'Password updated cleanly! You can now Sign In.' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/login', async (req, res) => {
        await initReady;
        const ip = req.headers['cf-connecting-ip'] || req.ip || req.connection?.remoteAddress || 'unknown';
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

        const { username, email, password } = req.body || {};
        const identifier = String(username || email || '').trim();
        const lowerIdent = identifier.toLowerCase();
        const inputUserSha256 = sha256Hex(identifier);
        const inputPassSha256 = sha256Hex(password);

        let matchedUser = null;
        try {
            const candidates = await query(
                `SELECT * FROM admin_users WHERE LOWER(email) = ? OR LOWER(username_sha256) = ? LIMIT 5`,
                [lowerIdent, inputUserSha256.toLowerCase()]
            );
            for (const u of candidates) {
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

        if (!matchedUser) {
            record.count += 1;
            loginAttempts.set(ip, record);
            await rbac.logLoginAttempt({ email: lowerIdent, req, loginStatus: 'failed_password' });
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        loginAttempts.delete(ip);
        const approvalStatus = matchedUser.approval_status || 'approved';
        if (approvalStatus === 'pending') {
            await rbac.logLoginAttempt({
                userId: matchedUser.id,
                email: matchedUser.email || lowerIdent,
                fullName: matchedUser.full_name,
                req,
                loginStatus: 'blocked_pending'
            });
            return res.status(403).json({
                error: 'Waiting for Administrator approval. You will receive an email with your assigned role once approved.',
                approvalStatus: 'pending'
            });
        }
        if (approvalStatus === 'not_approved') {
            await rbac.logLoginAttempt({
                userId: matchedUser.id,
                email: matchedUser.email || lowerIdent,
                fullName: matchedUser.full_name,
                req,
                loginStatus: 'blocked_not_approved'
            });
            return res.status(403).json({
                error: matchedUser.rejection_reason
                    ? `Your sign-up request was not approved: ${matchedUser.rejection_reason}`
                    : 'Your sign-up request was not approved by the Administrator.',
                approvalStatus: 'not_approved'
            });
        }
        if (Number(matchedUser.is_active) === 0) {
            await rbac.logLoginAttempt({
                userId: matchedUser.id,
                email: matchedUser.email || lowerIdent,
                fullName: matchedUser.full_name,
                req,
                loginStatus: 'blocked_disabled'
            });
            return res.status(403).json({
                error: 'Your account is currently disabled. Contact an Administrator.',
                approvalStatus: 'disabled'
            });
        }

        try {
            const otpQuota = checkAndConsumeOtpQuota(matchedUser.email || lowerIdent);
            if (!otpQuota.allowed) {
                res.setHeader('Retry-After', String(otpQuota.waitSec));
                return res.status(429).json({
                    error: `OTP cooldown active. Please wait ${otpQuota.waitSec}s or use your existing 6-digit code.`,
                    retryAfterSeconds: otpQuota.waitSec
                });
            }
            const ctx = await rbac.loadUserRbacContext(matchedUser.id);
            const otpInfo = await issueOtpAndEmail(matchedUser, 'login');
            await rbac.logLoginAttempt({
                userId: matchedUser.id,
                email: matchedUser.email || lowerIdent,
                fullName: matchedUser.full_name,
                roleUsed: ctx.effectiveRole,
                actingStation: ctx.stationScope,
                req,
                loginStatus: 'otp_sent'
            });
            return res.json({
                success: true,
                step: 'otp',
                otpToken: otpInfo.otpToken,
                maskedEmail: otpInfo.maskedEmail,
                mailMode: otpInfo.mailMode,
                role: ctx.effectiveRole,
                stationId: ctx.stationScope
            });
        } catch (mailErr) {
            return res.status(500).json({ error: 'Failed to dispatch login OTP: ' + mailErr.message });
        }
    });

    router.post('/admin/verify-otp', async (req, res) => {
        await initReady;
        const { otpToken, otp } = req.body || {};
        const pending = pendingOtpTokens.get(String(otpToken || ''));
        if (!pending || Date.now() > pending.expiresAtMs) {
            pendingOtpTokens.delete(String(otpToken || ''));
            return res.status(401).json({ error: 'OTP session expired. Please sign in again.' });
        }

        try {
            const rows = await query(`SELECT * FROM admin_users WHERE id = ? AND is_active = 1 AND approval_status = 'approved' LIMIT 1`, [pending.userId]);
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
            if (!safeCompareHex(sha256Hex(String(otp || '').trim()), String(user.otp_hash).toLowerCase())) {
                await query(`UPDATE admin_users SET otp_attempts = otp_attempts + 1 WHERE id = ?`, [user.id]);
                return res.status(401).json({ error: 'Invalid 6-digit verification code.' });
            }

            pendingOtpTokens.delete(String(otpToken || ''));
            await query(`UPDATE admin_users SET otp_hash = NULL, otp_expires_at = NULL, otp_attempts = 0, last_login_at = NOW() WHERE id = ?`, [user.id]);

            const ctx = await rbac.loadUserRbacContext(user.id);
            const token = generateToken(32);
            const expiresAtMs = Date.now() + SESSION_TTL_MS;
            const sessObj = {
                expiresAtMs,
                revoked: false,
                userId: user.id,
                role: ctx.baseRole,
                baseRole: ctx.baseRole,
                switchedRole: null,
                stationScope: ctx.stationScope,
                stationId: ctx.stationScope === 'all' ? 'lares' : ctx.stationScope,
                email: user.email || null
            };
            activeSessions.set(token, sessObj);
            await query(
                `INSERT INTO admin_sessions (token, username_sha256, user_id, role, base_role, switched_role, station_id, email, expires_at, revoked)
                 VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, 0)`,
                [token, user.username_sha256, user.id, ctx.baseRole, ctx.baseRole, ctx.stationScope, sessObj.email, new Date(expiresAtMs)]
            );
            await rbac.logLoginAttempt({
                userId: user.id,
                email: sessObj.email,
                fullName: user.full_name,
                roleUsed: ctx.baseRole,
                actingStation: ctx.stationScope,
                req,
                loginStatus: 'success'
            });
            await logAudit('USER_LOGIN', 'admin_users', sessObj.email || `id:${user.id}`, `${ctx.baseRole} signed in via 2-Step Gmail OTP`, sessObj.email || 'user');

            let parsedUiPrefs = {};
            try {
                if (user.ui_preferences_json) parsedUiPrefs = JSON.parse(user.ui_preferences_json) || {};
            } catch (_) {}

            res.json({
                success: true,
                token,
                expiresAt: expiresAtMs,
                role: ctx.effectiveRole,
                baseRole: ctx.baseRole,
                roleName: ctx.roleName,
                roleColor: ctx.colorHex,
                stationScope: ctx.stationScope,
                stationId: ctx.stationScope,
                email: sessObj.email,
                fullName: user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'User',
                jobTitle: user.job_title || '',
                officeName: user.office_name || '',
                responsibilities: user.responsibilities || '',
                permissions: Array.from(ctx.permissions),
                uiPreferences: parsedUiPrefs
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/resend-otp', async (req, res) => {
        const { otpToken } = req.body || {};
        const pending = pendingOtpTokens.get(String(otpToken || ''));
        if (!pending) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
        try {
            const rows = await query(`SELECT * FROM admin_users WHERE id = ? AND is_active = 1 LIMIT 1`, [pending.userId]);
            if (!rows || !rows[0]) return res.status(401).json({ error: 'Account not found.' });
            const otpQuota = checkAndConsumeOtpQuota(rows[0].email || `uid:${rows[0].id}`);
            if (!otpQuota.allowed) {
                res.setHeader('Retry-After', String(otpQuota.waitSec));
                return res.status(429).json({
                    error: `Please wait ${otpQuota.waitSec}s before requesting another OTP code.`,
                    retryAfterSeconds: otpQuota.waitSec
                });
            }
            pendingOtpTokens.delete(String(otpToken || ''));
            const otpInfo = await issueOtpAndEmail(rows[0], 'login');
            res.json({ success: true, otpToken: otpInfo.otpToken, maskedEmail: otpInfo.maskedEmail, mailMode: otpInfo.mailMode });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/logout', async (req, res) => {
        const token = extractTokenFromRequest(req);
        if (token) {
            const sess = await verifySessionAsync(token);
            activeSessions.delete(token);
            await query(`UPDATE admin_sessions SET revoked = 1 WHERE token = ?`, [token]).catch(() => {});
            if (sess) {
                logAudit('USER_LOGOUT', 'admin_sessions', sess.email || 'user', 'User signed out cleanly', sess.email || 'user');
            }
        }
        res.json({ success: true });
    });

    router.get('/admin/verify', authenticateSession, async (req, res) => {
        try {
            const ctx = await rbac.loadUserRbacContext(req.adminUser.userId, req.adminUser.switchedRole || null);
            const [uRow] = await query(`SELECT email, full_name, first_name, middle_name, last_name, job_title, office_name, responsibilities, ui_preferences_json FROM admin_users WHERE id = ? LIMIT 1`, [req.adminUser.userId]);
            let parsedUiPrefs = {};
            try {
                if (uRow && uRow.ui_preferences_json) parsedUiPrefs = JSON.parse(uRow.ui_preferences_json) || {};
            } catch (_) {}
            res.json({
                authenticated: true,
                userId: req.adminUser.userId,
                role: ctx.effectiveRole,
                baseRole: ctx.baseRole,
                switchedRole: req.adminUser.switchedRole || null,
                roleName: ctx.roleName,
                roleColor: ctx.colorHex,
                stationScope: ctx.stationScope,
                stationId: ctx.stationScope,
                email: uRow?.email || req.adminUser.email || null,
                fullName: uRow?.full_name || 'User',
                jobTitle: uRow?.job_title || '',
                officeName: uRow?.office_name || '',
                responsibilities: uRow?.responsibilities || '',
                permissions: Array.from(ctx.permissions),
                uiPreferences: parsedUiPrefs
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Save Per-User UI Customizations (Theme, Pagination Limits, Card/Table View Modes, Resized Table Column Widths) to MySQL
    router.put('/admin/preferences', authenticateSession, async (req, res) => {
        try {
            const incoming = (req.body && typeof req.body.preferences === 'object' && req.body.preferences) ? req.body.preferences : (req.body || {});
            const [uRow] = await query(`SELECT ui_preferences_json FROM admin_users WHERE id = ? LIMIT 1`, [req.adminUser.userId]);
            let current = {};
            try {
                if (uRow && uRow.ui_preferences_json) current = JSON.parse(uRow.ui_preferences_json) || {};
            } catch (_) {}
            const merged = { ...current, ...incoming };
            const jsonStr = JSON.stringify(merged);
            if (jsonStr.length > 60000) {
                return res.status(413).json({ error: 'Preferences payload too large.' });
            }
            await query(`UPDATE admin_users SET ui_preferences_json = ? WHERE id = ?`, [jsonStr, req.adminUser.userId]);
            res.json({ success: true, uiPreferences: merged });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Super Admin Single-Account Live Role Switcher (retains 'all' station access!)
    router.post('/admin/switch-role', authenticateSession, async (req, res) => {
        try {
            const baseCtx = await rbac.loadUserRbacContext(req.adminUser.userId, null);
            if (baseCtx.baseRole !== 'super_admin') {
                return res.status(403).json({ error: 'Forbidden: Only Super Admin can switch roles.' });
            }
            const targetRole = String((req.body && req.body.targetRole) || 'super_admin').trim().toLowerCase();
            if (!ROLE_DEFS.some(r => r.slug === targetRole)) {
                return res.status(400).json({ error: 'Invalid target role.' });
            }
            const switched = targetRole === 'super_admin' ? null : targetRole;
            req.adminUser.switchedRole = switched;
            req.adminUser.role = targetRole;
            activeSessions.set(req.adminToken, req.adminUser);

            await query(`UPDATE admin_sessions SET switched_role = ?, role = ? WHERE token = ?`, [switched, targetRole, req.adminToken]);
            rbac.invalidateRbacCache(req.adminUser.userId);
            const tokPrefix = `${req.adminToken.slice(0, 16)}:`;
            for (const k of idempotencyResults.keys()) {
                if (k.startsWith(tokPrefix)) idempotencyResults.delete(k);
            }
            const newCtx = await rbac.loadUserRbacContext(req.adminUser.userId, switched);
            await logAudit('SUPER_ADMIN_ROLE_SWITCH', 'rbac', targetRole, `Super Admin switched view to "${targetRole}" (stationScope=${newCtx.stationScope})`, req.adminUser.email || 'super_admin');

            res.json({
                success: true,
                role: newCtx.effectiveRole,
                baseRole: newCtx.baseRole,
                switchedRole: switched,
                roleName: newCtx.roleName,
                roleColor: newCtx.colorHex,
                stationScope: newCtx.stationScope,
                permissions: Array.from(newCtx.permissions)
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =========================================================================
    // 3. TARGETED IN-APP NOTIFICATIONS (`GET/POST /api/notifications*`)
    // =========================================================================
    router.get('/notifications', authenticateSession, async (req, res) => {
        try {
            const rows = await query(
                `SELECT * FROM notifications WHERE recipient_user_id = ? ORDER BY id DESC LIMIT 40`,
                [req.adminUser.userId]
            );
            const unreadCount = rows.filter(r => Number(r.is_read) === 0).length;
            let account = null;
            try {
                const baseCtx = await rbac.loadUserRbacContext(req.adminUser.userId, null);
                account = { baseRole: baseCtx.baseRole, roleName: baseCtx.roleName, stationScope: baseCtx.stationScope };
            } catch (_) { }

            const stationScope = String(req.adminUser.stationScope || 'all').toLowerCase();
            const reqStation = String(req.query.station || 'lares').toLowerCase();
            const stationId = stationScope !== 'all'
                ? stationScope
                : (VALID_STATIONS.has(reqStation) ? reqStation : 'lares');

            let queueCounts = {
                stationId,
                pendingUsers: 0,
                pendingReviews: 0,
                approvedPublish: 0,
                needsRevision: 0
            };
            try {
                const [pendingSignupsRows, crRows] = await Promise.all([
                    query(`SELECT COUNT(*) AS cnt FROM admin_users WHERE approval_status = 'pending'`),
                    query(
                        `SELECT status, COUNT(*) AS cnt FROM change_requests WHERE station_id = ? AND status IN ('pending', 'approved', 'rejected') GROUP BY status`,
                        [stationId]
                    )
                ]);
                const crByStatus = {};
                (crRows || []).forEach(r => { crByStatus[String(r.status || '')] = Number(r.cnt || 0); });
                queueCounts = {
                    stationId,
                    pendingUsers: Number(pendingSignupsRows?.[0]?.cnt || 0),
                    pendingReviews: Number(crByStatus.pending || 0),
                    approvedPublish: Number(crByStatus.approved || 0),
                    needsRevision: Number(crByStatus.rejected || 0)
                };
            } catch (_) { }

            res.json({ unreadCount, notifications: rows, account, queueCounts });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/notifications/:id/read', authenticateSession, async (req, res) => {
        try {
            await query(`UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_user_id = ?`, [req.params.id, req.adminUser.userId]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/notifications/read-all', authenticateSession, async (req, res) => {
        try {
            await query(`UPDATE notifications SET is_read = 1 WHERE recipient_user_id = ?`, [req.adminUser.userId]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =========================================================================
    // 4. USER & ACCESS MANAGEMENT + LOGIN AUDIT LOGS (Administrator / Super Admin)
    // =========================================================================
    router.get('/admin/users', authenticateSession, authorize('users:view'), async (req, res) => {
        const statusFilter = String(req.query.status || 'all').toLowerCase();
        try {
            let whereClause = '';
            if (statusFilter === 'pending') whereClause = `WHERE u.approval_status = 'pending'`;
            else if (statusFilter === 'approved') whereClause = `WHERE u.approval_status = 'approved' AND u.is_active = 1`;
            else if (statusFilter === 'not_approved') whereClause = `WHERE u.approval_status = 'not_approved'`;
            else if (statusFilter === 'disabled') whereClause = `WHERE u.approval_status = 'approved' AND u.is_active = 0`;

            const rows = await query(`
                SELECT u.id, u.email, u.full_name, u.first_name, u.middle_name, u.last_name,
                       u.job_title, u.role, u.station_id, u.office_name, u.responsibilities,
                       u.approval_status, u.rejection_reason, u.approved_by, u.approved_at,
                       u.last_login_at, u.is_active, COALESCE(u.is_test, 0) AS is_test, u.created_at, u.updated_at,
                       COALESCE(r.slug, u.role) AS role_slug,
                       COALESCE(r.name, u.role) AS role_name,
                       COALESCE(r.color_hex, '#10b981') AS role_color,
                       COALESCE(ur.station_scope, u.station_id, 'lares') AS station_scope
                FROM admin_users u
                LEFT JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN roles r ON r.id = ur.role_id
                ${whereClause}
                ORDER BY FIELD(u.approval_status, 'pending', 'approved', 'not_approved'), u.id ASC
            `);
            res.json({ roles: ROLE_DEFS, users: rows });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/users/:id/approve', authenticateSession, authorize('users:approve_assign'), async (req, res) => {
        const targetId = Number(req.params.id);
        const b = req.body || {};
        const roleSlug = String(b.role_slug || b.role || 'reviewer').trim().toLowerCase();
        const stationScope = String(b.station_scope || b.station_id || 'lares').trim().toLowerCase();
        const jobTitle = String(b.job_title || b.position || '').trim();
        const officeName = String(b.office_name || '').trim();
        const responsibilities = String(b.responsibilities || '').trim();

        if (!ROLE_DEFS.some(r => r.slug === roleSlug)) {
            return res.status(400).json({ error: 'Invalid role selected.' });
        }
        if (roleSlug === 'super_admin') {
            return res.status(403).json({ error: 'The Super Admin role cannot be assigned from the portal.' });
        }
        if (stationScope !== 'all' && !VALID_STATIONS.has(stationScope)) {
            return res.status(400).json({ error: 'Invalid station assignment.' });
        }

        try {
            const [targetUser] = await query(`SELECT * FROM admin_users WHERE id = ? LIMIT 1`, [targetId]);
            if (!targetUser) return res.status(404).json({ error: 'User not found.' });
            const [roleRow] = await query(`SELECT id, name FROM roles WHERE slug = ? LIMIT 1`, [roleSlug]);
            if (!roleRow) return res.status(400).json({ error: 'Role definition not found.' });

            const effStation = (roleSlug === 'administrator' || roleSlug === 'super_admin') ? 'all' : stationScope;
            await query(`
                UPDATE admin_users SET
                    role = ?,
                    station_id = ?,
                    job_title = COALESCE(NULLIF(?, ''), job_title),
                    office_name = COALESCE(NULLIF(?, ''), office_name),
                    responsibilities = COALESCE(NULLIF(?, ''), responsibilities),
                    approval_status = 'approved',
                    rejection_reason = NULL,
                    approved_by = ?,
                    approved_at = NOW(),
                    is_active = 1
                WHERE id = ?
            `, [roleSlug, effStation, jobTitle, officeName, responsibilities, req.adminUser.email || 'admin', targetId]);

            await query(`DELETE FROM user_roles WHERE user_id = ?`, [targetId]);
            await query(`INSERT INTO user_roles (user_id, role_id, station_scope) VALUES (?, ?, ?)`, [targetId, roleRow.id, effStation]);

            await syncUserLiveSessions(targetId, roleSlug, effStation);

            await rbac.notifyUser(targetId, {
                type: 'account_approved',
                title: 'Account Approved',
                message: `Your account was approved as ${roleRow.name} (${effStation === 'all' ? 'All Stations' : 'DA-' + effStation.toUpperCase()}).`,
                station_id: effStation === 'all' ? null : effStation,
                link_tab: 'dashboard',
                target_table: 'admin_users',
                target_id: targetId
            });

            const loginUrl = `${getPublicBaseUrl(req)}/login`;
            if (targetUser.email) {
                const stationLabel = effStation === 'all' ? 'All Research Stations' : `DA-${effStation.toUpperCase()}`;
                const approvedPosition = jobTitle || targetUser.job_title || '—';
                const rawScopeNotes = String(responsibilities || targetUser.responsibilities || '').trim();
                // Only surface scope notes when they add information beyond the Position itself
                const approvedScopeNotes = (rawScopeNotes && rawScopeNotes.toLowerCase() !== String(approvedPosition).trim().toLowerCase()) ? rawScopeNotes : '';
                await sendMailSafe({
                    to: targetUser.email,
                    subject: `[iGUIDE] Your Account Is Approved — Ready to Sign In`,
                    text: `Hello ${targetUser.full_name || targetUser.first_name || 'User'},\n\nGreat news! Your iGUIDE account has been approved by the Administrator.\n\nAssigned Role: ${roleRow.name}\nAssigned Station: ${stationLabel}\nPosition: ${approvedPosition}\nOffice / Division: ${officeName || targetUser.office_name || '—'}${approvedScopeNotes ? '\nResponsibilities: ' + approvedScopeNotes : ''}\n\nYou can now sign in here:\n${loginUrl}`,
                    html: buildWorkflowEmail({
                        role: roleSlug,
                        headerTitle: '🌿 iGUIDE Access Approved',
                        roleBadgeText: roleRow.name,
                        greeting: `Hello ${targetUser.full_name || targetUser.first_name || 'User'},`,
                        introText: 'Your iGUIDE portal registration has been approved and configured with the access profile below:',
                        details: [
                            { label: 'Assigned Role', value: roleRow.name },
                            { label: 'Position', value: approvedPosition },
                            { label: 'Station', value: stationLabel },
                            { label: 'Office / Division', value: officeName || targetUser.office_name || '—' },
                            ...(approvedScopeNotes ? [{ label: 'Responsibilities', value: approvedScopeNotes }] : [])
                        ],
                        ctaLabel: 'Sign In to iGUIDE Portal',
                        ctaUrl: loginUrl,
                        noteText: 'You will receive a 6-digit Gmail OTP verification code each time you sign in.'
                    })
                });
            }

            await logAudit('APPROVE_USER', 'admin_users', targetUser.email || targetId, `Approved ${targetUser.email} as ${roleSlug} (${effStation})`, req.adminUser.email || 'admin');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/users/:id/deny', authenticateSession, authorize('users:approve_assign'), async (req, res) => {
        const targetId = Number(req.params.id);
        const reason = String((req.body && req.body.reason) || '').trim();
        try {
            const [targetUser] = await query(`SELECT * FROM admin_users WHERE id = ? LIMIT 1`, [targetId]);
            if (!targetUser) return res.status(404).json({ error: 'User not found.' });
            if (targetUser.id === 1) return res.status(403).json({ error: 'Cannot deny the primary Super Admin account.' });

            await query(
                `UPDATE admin_users SET approval_status = 'not_approved', rejection_reason = ?, is_active = 0 WHERE id = ?`,
                [reason || 'Registration declined by Administrator.', targetId]
            );
            await query(`UPDATE admin_sessions SET revoked = 1 WHERE user_id = ?`, [targetId]);
            rbac.invalidateRbacCache(targetId);

            if (targetUser.email) {
                await sendMailSafe({
                    to: targetUser.email,
                    subject: `[iGUIDE] Sign-Up Request Status Update`,
                    text: `Hello ${targetUser.full_name || 'Applicant'},\n\nYour iGUIDE portal sign-up request was not approved at this time.\n${reason ? 'Note from Administrator: ' + reason : ''}\n\nPlease contact MIS DA-CALABARZON if you believe this is in error.`,
                    html: buildWorkflowEmail({
                        role: 'denied',
                        headerTitle: 'iGUIDE Registration Update',
                        roleBadgeText: 'Not Approved',
                        greeting: `Hello ${targetUser.full_name || 'Applicant'},`,
                        introText: 'Your iGUIDE portal registration request was declined by the Administrator at this time.',
                        details: [
                            { label: 'Status', value: 'Not Approved' },
                            { label: 'Note', value: reason || 'Registration declined by Administrator.' }
                        ],
                        warningText: 'Please contact MIS DA-CALABARZON if you believe this is an error.'
                    })
                });
            }
            await logAudit('DENY_USER', 'admin_users', targetUser.email || targetId, `Marked sign-up ${targetUser.email} as not_approved`, req.adminUser.email || 'admin');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/users/:id', authenticateSession, authorize('users:manage_roles'), async (req, res) => {
        const targetId = Number(req.params.id);
        const b = req.body || {};
        try {
            const [targetUser] = await query(`SELECT * FROM admin_users WHERE id = ? LIMIT 1`, [targetId]);
            if (!targetUser) return res.status(404).json({ error: 'User not found.' });
            if (targetId === 1 && b.is_active === false) {
                return res.status(403).json({ error: 'Cannot disable primary Super Admin account.' });
            }

            const roleSlug = (b.role_slug || b.role) ? String(b.role_slug || b.role).toLowerCase() : null;
            const prevCtx = await rbac.loadUserRbacContext(targetId, null).catch(() => null);
            const prevRole = (prevCtx && prevCtx.baseRole) || targetUser.role;
            const prevScope = (prevCtx && prevCtx.stationScope) || targetUser.station_id || 'lares';

            if ((roleSlug || b.station_scope) && (prevRole === 'super_admin' || targetId === 1)) {
                return res.status(403).json({ error: 'The Super Admin account role cannot be changed from the portal.' });
            }

            let newRole = prevRole;
            let newScope = prevScope;
            if (roleSlug) {
                if (!ROLE_DEFS.some(r => r.slug === roleSlug)) return res.status(400).json({ error: 'Invalid role_slug.' });
                if (roleSlug === 'super_admin') {
                    return res.status(403).json({ error: 'The Super Admin role cannot be assigned from the portal.' });
                }
                const [roleRow] = await query(`SELECT id FROM roles WHERE slug = ? LIMIT 1`, [roleSlug]);
                const scope = roleSlug === 'administrator'
                    ? 'all'
                    : String(b.station_scope || targetUser.station_id || 'lares').toLowerCase();
                if (scope !== 'all' && !VALID_STATIONS.has(scope)) return res.status(400).json({ error: 'Invalid station assignment.' });
                await query(`UPDATE admin_users SET role = ?, station_id = ? WHERE id = ?`, [roleSlug, scope, targetId]);
                if (roleRow) {
                    await query(`DELETE FROM user_roles WHERE user_id = ?`, [targetId]);
                    await query(`INSERT INTO user_roles (user_id, role_id, station_scope) VALUES (?, ?, ?)`, [targetId, roleRow.id, scope]);
                }
                newRole = roleSlug;
                newScope = scope;
            } else if (b.station_scope) {
                const sc = String(b.station_scope).toLowerCase();
                if (sc !== 'all' && !VALID_STATIONS.has(sc)) return res.status(400).json({ error: 'Invalid station assignment.' });
                await query(`UPDATE admin_users SET station_id = ? WHERE id = ?`, [sc, targetId]);
                await query(`UPDATE user_roles SET station_scope = ? WHERE user_id = ?`, [sc, targetId]);
                newScope = sc;
            }

            const accessChanged = (newRole !== prevRole) || (newScope !== prevScope);
            if (accessChanged) {
                await syncUserLiveSessions(targetId, newRole, newScope);
                const [newRoleRow] = await query(`SELECT name FROM roles WHERE slug = ? LIMIT 1`, [newRole]).catch(() => []);
                const roleLabel = (newRoleRow && newRoleRow.name) || newRole;
                const scopeLabel = newScope === 'all' ? 'All Stations' : `DA-${String(newScope).toUpperCase()}`;
                await rbac.notifyUser(targetId, {
                    type: 'role_changed',
                    title: 'Your Role Was Updated',
                    message: `An Administrator changed your portal access to ${roleLabel} (${scopeLabel}). Your workspace will refresh to apply it.`,
                    station_id: newScope === 'all' ? null : newScope,
                    link_tab: 'dashboard',
                    target_table: 'admin_users',
                    target_id: targetId
                });
            }

            if (b.job_title !== undefined || b.office_name !== undefined || b.responsibilities !== undefined || b.is_active !== undefined || b.is_test !== undefined) {
                await query(`
                    UPDATE admin_users SET
                        job_title = COALESCE(?, job_title),
                        office_name = COALESCE(?, office_name),
                        responsibilities = COALESCE(?, responsibilities),
                        is_active = COALESCE(?, is_active),
                        is_test = COALESCE(?, is_test)
                    WHERE id = ?
                `, [
                    b.job_title !== undefined ? b.job_title : null,
                    b.office_name !== undefined ? b.office_name : null,
                    b.responsibilities !== undefined ? b.responsibilities : null,
                    b.is_active !== undefined ? (b.is_active ? 1 : 0) : null,
                    b.is_test !== undefined ? (b.is_test ? 1 : 0) : null,
                    targetId
                ]);
            }

            if (b.is_active === false || b.is_active === 0) {
                await query(`UPDATE admin_sessions SET revoked = 1 WHERE user_id = ?`, [targetId]);
                for (const [tok, sess] of activeSessions.entries()) {
                    if (sess.userId === targetId) activeSessions.delete(tok);
                }
            }
            rbac.invalidateRbacCache(targetId);
            await logAudit('UPDATE_USER', 'admin_users', targetUser.email || targetId, `Updated access profile for ${targetUser.email}`, req.adminUser.email || 'admin');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    const NON_SUPER_AUDIT_WHERE = `
        a.action <> 'SUPER_ADMIN_ROLE_SWITCH'
        AND LOWER(COALESCE(a.actor_base_role, '')) <> 'super_admin'
        AND LOWER(COALESCE(a.admin_username, '')) NOT IN ('super_admin', 'superadmin')
        AND LOWER(COALESCE(a.summary, '')) NOT LIKE 'super_admin %'
        AND NOT EXISTS (
            SELECT 1 FROM admin_users su
            WHERE su.role = 'super_admin'
              AND su.email IS NOT NULL
              AND LOWER(su.email) = LOWER(a.admin_username)
        )
    `;

    const NON_SUPER_LOGIN_WHERE = `
        LOWER(COALESCE(l.role_used, '')) <> 'super_admin'
        AND (l.user_id IS NULL OR NOT EXISTS (
            SELECT 1 FROM admin_users su
            WHERE su.id = l.user_id AND su.role = 'super_admin'
        ))
        AND NOT EXISTS (
            SELECT 1 FROM admin_users su2
            WHERE su2.role = 'super_admin'
              AND su2.email IS NOT NULL
              AND LOWER(su2.email) = LOWER(l.email)
        )
    `;

    function parseLogPagination(q, defaultLimit = 10) {
        const rawPage = parseInt(q?.page, 10);
        const rawLimit = parseInt(q?.limit, 10);
        const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
        const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(5, rawLimit)) : defaultLimit;
        return { page, limit };
    }

    async function fetchPaginatedAuditLogs({ isSuperAdmin, includeTest = false, page = 1, limit = 10, search = '', action = '' } = {}) {
        const clauses = [];
        const params = [];
        if (!isSuperAdmin) clauses.push(NON_SUPER_AUDIT_WHERE);
        if (!includeTest) {
            clauses.push(`COALESCE(a.is_test, 0) = 0 AND NOT EXISTS (SELECT 1 FROM admin_users tu WHERE tu.is_test = 1 AND (tu.id = a.actor_user_id OR (tu.email IS NOT NULL AND LOWER(tu.email) = LOWER(a.admin_username))))`);
        }
        const cleanAction = String(action || '').trim();
        if (cleanAction) {
            clauses.push('a.action = ?');
            params.push(cleanAction);
        }
        const cleanSearch = String(search || '').trim();
        if (cleanSearch) {
            const like = `%${cleanSearch}%`;
            clauses.push('(a.admin_username LIKE ? OR a.actor_display_name LIKE ? OR a.acting_label LIKE ? OR a.action LIKE ? OR a.target_table LIKE ? OR a.summary LIKE ?)');
            params.push(like, like, like, like, like, like);
        }
        const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const [cntRow] = await query(`SELECT COUNT(*) AS cnt FROM admin_audit_logs a ${whereSql}`, params);
        const total = Number(cntRow?.cnt || 0);
        const totalPages = Math.max(1, Math.ceil(total / limit));
        const safePage = Math.min(page, totalPages);
        const offset = (safePage - 1) * limit;
        const items = await query(
            `SELECT a.* FROM admin_audit_logs a ${whereSql} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );
        return {
            items,
            total,
            page: safePage,
            limit,
            totalPages,
            includeTest: Boolean(includeTest),
            scope: isSuperAdmin ? 'all' : 'below_super_admin'
        };
    }

    router.get('/admin/login-logs', authenticateSession, authorize('logins:view'), async (req, res) => {
        try {
            const isSuperAdmin = req.adminUser.role === 'super_admin';
            const { page, limit } = parseLogPagination(req.query, 15);
            const cleanStatus = String(req.query.status || '').trim();
            const cleanSearch = String(req.query.search || '').trim();

            const baseClauses = [];
            const baseParams = [];
            if (!isSuperAdmin) baseClauses.push(NON_SUPER_LOGIN_WHERE);
            const baseWhereSql = baseClauses.length ? `WHERE ${baseClauses.join(' AND ')}` : '';

            const [sumRow] = await query(
                `SELECT
                    COUNT(*) AS totalAll,
                    SUM(CASE WHEN l.login_status = 'success' THEN 1 ELSE 0 END) AS verified,
                    SUM(CASE WHEN l.login_status IN ('failed_password', 'blocked_pending', 'blocked_not_approved', 'blocked_disabled') THEN 1 ELSE 0 END) AS blockedOrFailed
                 FROM user_login_logs l ${baseWhereSql}`,
                baseParams
            );

            const filterClauses = [...baseClauses];
            const filterParams = [...baseParams];
            if (cleanStatus) {
                filterClauses.push('l.login_status = ?');
                filterParams.push(cleanStatus);
            }
            if (cleanSearch) {
                const like = `%${cleanSearch}%`;
                filterClauses.push('(l.email LIKE ? OR l.full_name LIKE ? OR l.role_used LIKE ? OR l.acting_station LIKE ? OR l.login_status LIKE ?)');
                filterParams.push(like, like, like, like, like);
            }
            const filterWhereSql = filterClauses.length ? `WHERE ${filterClauses.join(' AND ')}` : '';

            const [cntRow] = await query(`SELECT COUNT(*) AS cnt FROM user_login_logs l ${filterWhereSql}`, filterParams);
            const total = Number(cntRow?.cnt || 0);
            const totalPages = Math.max(1, Math.ceil(total / limit));
            const safePage = Math.min(page, totalPages);
            const offset = (safePage - 1) * limit;

            const rawItems = await query(
                `SELECT l.id, l.user_id, l.email, l.full_name, l.role_used, l.acting_station, l.login_status, l.user_agent, l.created_at
                 FROM user_login_logs l ${filterWhereSql} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
                [...filterParams, limit, offset]
            );
            // Privacy & Data Handling policy: IP addresses and raw user-agent strings are never sent to the portal
            const items = rawItems.map(({ user_agent, ...rest }) => ({ ...rest, client_device: friendlyDeviceLabel(user_agent) }));

            res.json({
                items,
                total,
                page: safePage,
                limit,
                totalPages,
                scope: isSuperAdmin ? 'all' : 'below_super_admin',
                summary: {
                    totalAll: Number(sumRow?.totalAll || 0),
                    verified: Number(sumRow?.verified || 0),
                    blockedOrFailed: Number(sumRow?.blockedOrFailed || 0)
                }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/admin/audit-logs', authenticateSession, authorize('audit:view'), async (req, res) => {
        try {
            const isSuperAdmin = req.adminUser.baseRole === 'super_admin' || req.adminUser.role === 'super_admin';
            const includeTest = req.query.includeTest === '1' || req.query.includeTest === 'true';
            const { page, limit } = parseLogPagination(req.query, 10);
            const result = await fetchPaginatedAuditLogs({
                isSuperAdmin,
                includeTest,
                page,
                limit,
                search: req.query.search || '',
                action: req.query.action || ''
            });
            res.json(result);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Compatibility reviewer routes mapped cleanly to normalized user queries
    router.get('/admin/reviewers', authenticateSession, authorize('users:view'), async (req, res) => {
        try {
            const rows = await query(`SELECT id, email, full_name, role, station_id, office_name, responsibilities, approval_status, is_active, updated_at FROM admin_users WHERE role = 'reviewer' ORDER BY station_id ASC, id ASC`);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =========================================================================
    // 5. GOVERNANCE: CHANGE REQUESTS, REVISE LOOP, STATION REVIEWER & PUBLISH
    // =========================================================================
    async function stageChangeRequest({
        req,
        stationId,
        targetTable,
        targetId,
        action,
        summary,
        previousObj,
        payloadObj,
        saveAsDraft = false,
        deleteReason = null
    }) {
        const st = String(stationId || 'lares').toLowerCase();
        const act = String(action || 'UPDATE').toUpperCase();
        const tbl = String(targetTable || 'buildings');
        const tId = String(targetId || 'general');
        const actor = phase1.formatActorAuditMeta(req.adminUser);

        // 1.1 Always capture an authoritative server-side "before" snapshot & base_version
        let authoritativePrev = previousObj || null;
        let baseVersion = 1;
        if (act !== 'CREATE') {
            try {
                const captured = await phase1.captureFullRecordSnapshot(query, {
                    stationId: st,
                    targetTable: tbl,
                    targetId: tId,
                    buildingCode: payloadObj?.building_code || previousObj?.building_code || null
                });
                if (captured.snapshot) {
                    authoritativePrev = captured.snapshot;
                    baseVersion = Number(captured.version || 1);
                }
            } catch (_) { }
        }

        const draftGroupKey = `${st}::${tbl}::${tId}`;
        const existingDraftRows = actor.userId
            ? await query(
                `SELECT * FROM change_requests
                 WHERE status = 'draft' AND station_id = ? AND target_table = ? AND target_id = ? AND submitted_by_user_id = ?
                 ORDER BY id DESC LIMIT 1`,
                [st, tbl, tId, actor.userId]
            )
            : [];
        const existingDraft = existingDraftRows[0] || null;

        let crId = null;
        const nextStatus = saveAsDraft ? 'draft' : 'pending';
        const cleanDeleteReason = deleteReason ? String(deleteReason).trim() : null;

        if (existingDraft) {
            let mergedPayload = payloadObj || {};
            try {
                const prevDraftPayload = existingDraft.payload_json ? JSON.parse(existingDraft.payload_json) : {};
                if (prevDraftPayload && typeof prevDraftPayload === 'object' && !Array.isArray(prevDraftPayload)) {
                    mergedPayload = { ...prevDraftPayload, ...(payloadObj || {}) };
                }
            } catch (_) { }
            await query(`
                UPDATE change_requests SET
                    action = ?,
                    summary = ?,
                    payload_json = ?,
                    status = ?,
                    delete_reason = COALESCE(?, delete_reason),
                    actor_base_role = ?,
                    actor_effective_role = ?,
                    submitted_by_name = ?,
                    updated_at = NOW()
                WHERE id = ?
            `, [
                act,
                summary || existingDraft.summary || `Update ${tbl} (${tId})`,
                JSON.stringify(mergedPayload),
                nextStatus,
                cleanDeleteReason,
                actor.baseRole,
                actor.effectiveRole,
                actor.displayName,
                existingDraft.id
            ]);
            crId = existingDraft.id;
        } else {
            const result = await query(`
                INSERT INTO change_requests (
                    station_id, target_table, target_id, action, summary,
                    previous_json, payload_json, status, base_version, delete_reason, draft_group_key,
                    submitted_by_email, submitted_by_user_id, submitted_by_name,
                    actor_base_role, actor_effective_role
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                st,
                tbl,
                tId,
                act,
                summary || `Update ${tbl} (${tId})`,
                authoritativePrev ? JSON.stringify(authoritativePrev) : null,
                JSON.stringify(payloadObj || {}),
                nextStatus,
                baseVersion,
                cleanDeleteReason,
                draftGroupKey,
                actor.email || 'editor',
                actor.userId || null,
                actor.displayName,
                actor.baseRole,
                actor.effectiveRole
            ]);
            crId = result.insertId;
        }

        if (saveAsDraft) {
            await logAudit('SAVE_DRAFT_CHANGE_REQUEST', 'change_requests', crId, `Saved draft #${crId} (${st.toUpperCase()} ${tbl}:${tId}): ${summary}`, req.adminUser);
            return { id: crId, draft: true, baseVersion, notifiedReviewers: 0 };
        }

        const portalUrl = `${getPublicBaseUrl(req)}/login`;
        const reviewers = await rbac.findConcernedUsers({ roles: ['reviewer', 'super_admin'], stationId: st });
        let notified = 0;
        for (const rev of reviewers) {
            const crTargetName = extractCrTargetName(summary, payloadObj, crId);
            await rbac.notifyUser(rev.id, {
                type: 'review_needed',
                title: `Review Needed: ${crTargetName}`,
                message: `${summary} (DA-${st.toUpperCase()})`,
                station_id: st,
                link_tab: 'review-queue',
                target_table: 'change_requests',
                target_id: crId
            });
            if (rev.email && rev.role_slug === 'reviewer') {
                queueBackgroundMail({
                    to: rev.email,
                    subject: `[iGUIDE Review Needed] DA-${st.toUpperCase()}: ${summary}`,
                    text: `Hello ${rev.full_name || 'Reviewer'},\n\nA CRUD change request for DA-${st.toUpperCase()} needs your review:\n\nSummary: ${summary}\nModule: ${tbl} (${tId})\nSubmitted By: ${actor.displayName}\n\nOpen iGUIDE to Approve or Deny with a comment:\n${portalUrl}`,
                    html: buildWorkflowEmail({
                        role: rev.role_slug || 'reviewer',
                        headerTitle: '🌿 iGUIDE Review Queue',
                        roleBadgeText: `Station Reviewer • DA-${st.toUpperCase()}`,
                        greeting: `Hello ${rev.full_name || 'Reviewer'},`,
                        introText: `A new change request for DA-${st.toUpperCase()} is awaiting your review:`,
                        details: [
                            { label: 'Request #', value: `#${crId}` },
                            { label: 'Summary', value: summary },
                            { label: 'Module', value: `${tbl} (${tId})` },
                            { label: 'Submitted By', value: actor.displayName }
                        ],
                        ctaLabel: 'Open Review Queue',
                        ctaUrl: portalUrl
                    })
                });
            }
            notified++;
        }
        await logAudit('SUBMIT_CHANGE_REQUEST', 'change_requests', crId, `Submitted ${st.toUpperCase()} Request #${crId}: ${summary}`, req.adminUser);
        return { id: crId, draft: false, baseVersion, notifiedReviewers: notified };
    }

    router.get('/admin/change-requests', authenticateSession, authorize('reviews:view'), async (req, res) => {
        const stationScope = req.adminUser.stationScope;
        const stationParam = req.query.station ? String(req.query.station).toLowerCase() : null;
        try {
            let rows;
            if (stationScope !== 'all') {
                rows = await query(`SELECT * FROM change_requests WHERE station_id = ? ORDER BY id DESC LIMIT 120`, [stationScope]);
            } else if (stationParam) {
                rows = await query(`SELECT * FROM change_requests WHERE station_id = ? ORDER BY id DESC LIMIT 120`, [stationParam]);
            } else {
                rows = await query(`SELECT * FROM change_requests ORDER BY id DESC LIMIT 120`);
            }
            // Hide other users' private drafts; keep caller's own drafts (or all for Super Admin)
            const filtered = rows.filter(r => r.status !== 'draft' || req.adminUser.baseRole === 'super_admin' || Number(r.submitted_by_user_id) === Number(req.adminUser.userId));
            const enriched = await phase1.attachConflictMetadata(query, filtered);
            const sanitized = await sanitizeChangeRequestPrivacy(enriched, req.adminUser);
            res.json(sanitized);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/change-requests/:id/submit-draft', authenticateSession, authorize('buildings:draft_change'), async (req, res) => {
        const id = Number(req.params.id);
        try {
            const [cr] = await query(`SELECT * FROM change_requests WHERE id = ? LIMIT 1`, [id]);
            if (!cr) return res.status(404).json({ error: 'Draft request not found.' });
            if (cr.status !== 'draft') return res.status(400).json({ error: 'Only draft requests can be submitted for review.' });
            if (req.adminUser.baseRole !== 'super_admin' && Number(cr.submitted_by_user_id) !== Number(req.adminUser.userId)) {
                return res.status(403).json({ error: 'You can only submit your own draft.' });
            }
            const nextSummary = req.body?.summary ? String(req.body.summary).trim() : cr.summary;
            await query(`UPDATE change_requests SET status = 'pending', summary = ?, updated_at = NOW() WHERE id = ?`, [nextSummary, id]);
            const reviewers = await rbac.findConcernedUsers({ roles: ['reviewer', 'super_admin'], stationId: cr.station_id });
            for (const rev of reviewers) {
                const crTargetName = extractCrTargetName(nextSummary, cr.payload_json, id);
                await rbac.notifyUser(rev.id, {
                    type: 'review_needed',
                    title: `Review Needed: ${crTargetName}`,
                    message: `${nextSummary} (DA-${cr.station_id.toUpperCase()})`,
                    station_id: cr.station_id,
                    link_tab: 'review-queue',
                    target_table: 'change_requests',
                    target_id: id
                });
            }
            await logAudit('SUBMIT_CHANGE_REQUEST', 'change_requests', id, `Submitted grouped draft Request #${id}: ${nextSummary}`, req.adminUser);
            res.json({ success: true, id, status: 'pending' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/change-requests/:id/withdraw', authenticateSession, authorize('buildings:draft_change'), async (req, res) => {
        const id = Number(req.params.id);
        try {
            const [cr] = await query(`SELECT * FROM change_requests WHERE id = ? LIMIT 1`, [id]);
            if (!cr) return res.status(404).json({ error: 'Change request not found.' });
            if (!['draft', 'pending'].includes(cr.status)) {
                return res.status(400).json({ error: `Cannot withdraw a request in "${cr.status}" status.` });
            }
            if (req.adminUser.baseRole !== 'super_admin' && Number(cr.submitted_by_user_id) !== Number(req.adminUser.userId)) {
                return res.status(403).json({ error: 'You can only withdraw your own submission.' });
            }
            await query(`UPDATE change_requests SET status = 'withdrawn', updated_at = NOW() WHERE id = ?`, [id]);
            await logAudit('WITHDRAW_CHANGE_REQUEST', 'change_requests', id, `Withdrew Request #${id}: ${cr.summary}`, req.adminUser);
            res.json({ success: true, id, status: 'withdrawn' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/change-requests/:id/reveal-identity', authenticateSession, async (req, res) => {
        if (req.adminUser.baseRole !== 'super_admin') {
            return res.status(403).json({ error: 'Only Super Admin can reveal submitter or reviewer identities.' });
        }
        const password = String(req.body?.password || '');
        if (!password) {
            return res.status(400).json({ error: 'Please enter your Super Admin login password.' });
        }
        try {
            const [adminRow] = await query(`SELECT id, email, password_sha256 FROM admin_users WHERE id = ? LIMIT 1`, [req.adminUser.userId]);
            if (!adminRow) {
                return res.status(403).json({ error: 'Super Admin account could not be verified.' });
            }
            const inputPassSha256 = sha256Hex(password);
            const passMatches = String(adminRow.password_sha256 || '').startsWith('scrypt$')
                ? verifyPasswordScrypt(password, adminRow.password_sha256)
                : safeCompareHex(inputPassSha256, String(adminRow.password_sha256 || '').toLowerCase());
            if (!passMatches) {
                return res.status(403).json({ error: 'Incorrect password. Please enter your Super Admin login password.' });
            }
            const id = Number(req.params.id);
            const [cr] = await query(
                `SELECT id, summary, station_id, submitted_by_user_id, submitted_by_name, submitted_by_email, reviewed_by_user_id, reviewed_by_name, reviewed_by_email FROM change_requests WHERE id = ? LIMIT 1`,
                [id]
            );
            if (!cr) return res.status(404).json({ error: 'Change request not found.' });

            const lookupName = async (userId, email, fallbackName) => {
                if (fallbackName && !String(fallbackName).includes('@')) return fallbackName;
                if (!userId && !email) return null;
                const [u] = await query(
                    userId ? `SELECT first_name, last_name FROM admin_users WHERE id = ? LIMIT 1` : `SELECT first_name, last_name FROM admin_users WHERE LOWER(email) = ? LIMIT 1`,
                    [userId || String(email).toLowerCase()]
                );
                const full = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '';
                return full || fallbackName || null;
            };

            const subName = await lookupName(cr.submitted_by_user_id, cr.submitted_by_email, cr.submitted_by_name);
            const revName = await lookupName(cr.reviewed_by_user_id, cr.reviewed_by_email, cr.reviewed_by_name);

            await logAudit('REVEAL_CR_IDENTITY', 'change_requests', id, `Super Admin revealed submitter/reviewer identity for Request #${id}`, req.adminUser);
            res.json({
                success: true,
                id,
                submitted_by_name: subName,
                submitted_by_email: cr.submitted_by_email || null,
                reviewed_by_name: revName,
                reviewed_by_email: cr.reviewed_by_email || null
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/change-requests/:id/rebase', authenticateSession, authorize('reviews:view'), async (req, res) => {
        const id = Number(req.params.id);
        try {
            const [cr] = await query(`SELECT * FROM change_requests WHERE id = ? LIMIT 1`, [id]);
            if (!cr) return res.status(404).json({ error: 'Change request not found.' });
            if (!['draft', 'pending', 'rejected'].includes(cr.status)) {
                return res.status(400).json({ error: `Cannot rebase a request in "${cr.status}" status.` });
            }
            const captured = await phase1.captureFullRecordSnapshot(query, {
                stationId: cr.station_id,
                targetTable: cr.target_table,
                targetId: cr.target_id
            });
            if (!captured.snapshot) {
                return res.status(404).json({ error: 'Live target record no longer exists; cannot rebase.' });
            }
            await query(
                `UPDATE change_requests SET previous_json = ?, base_version = ?, updated_at = NOW() WHERE id = ?`,
                [JSON.stringify(captured.snapshot), captured.version, id]
            );
            await logAudit('REBASE_CHANGE_REQUEST', 'change_requests', id, `Rebased Request #${id} onto live version v${captured.version}`, req.adminUser);
            res.json({ success: true, id, baseVersion: captured.version });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/change-requests/:id/undo-publish', authenticateSession, authorize('changes:publish'), async (req, res) => {
        const id = Number(req.params.id);
        try {
            const result = await runInTransaction(pool, async (txQuery) => {
                const [cr] = await txQuery(`SELECT * FROM change_requests WHERE id = ? FOR UPDATE`, [id]);
                if (!cr) {
                    const err = new Error('Change request not found.');
                    err.statusCode = 404;
                    throw err;
                }
                if (cr.status !== 'published' || cr.undone_at) {
                    const err = new Error('This request cannot be undone (not published or already undone).');
                    err.statusCode = 400;
                    throw err;
                }
                if (!phase1.isWithinUndoWindow(cr.published_at)) {
                    const err = new Error('Undo window expired: published changes can only be undone within 24 hours.');
                    err.statusCode = 400;
                    throw err;
                }
                const snapRaw = cr.published_snapshot_json || cr.previous_json;
                if (!snapRaw) {
                    const err = new Error('No pre-publish snapshot available to undo this change.');
                    err.statusCode = 400;
                    throw err;
                }
                const preSnap = JSON.parse(snapRaw);
                const origAction = String(cr.action || 'UPDATE').toUpperCase();
                const undoAction = origAction === 'CREATE' ? 'DELETE' : (origAction === 'DELETE' ? 'CREATE' : 'UPDATE');
                await applyCrudOperation(txQuery, rootDir, {
                    stationId: cr.station_id,
                    targetTable: cr.target_table,
                    targetId: cr.target_id,
                    action: undoAction,
                    payload: preSnap,
                    actorEmail: req.adminUser.email || 'administrator'
                });
                const nextVer = await phase1.bumpEntityVersion(txQuery, {
                    stationId: cr.station_id,
                    targetTable: cr.target_table,
                    targetId: cr.target_id
                });
                await phase1.recordEntityVersion(txQuery, {
                    stationId: cr.station_id,
                    targetTable: cr.target_table,
                    targetId: cr.target_id,
                    versionNum: nextVer,
                    action: 'UNDO_PUBLISH',
                    summary: `Undid publish of Request #${cr.id}: ${cr.summary}`,
                    snapshot: preSnap,
                    changeRequestId: cr.id,
                    source: 'undo',
                    adminUser: req.adminUser
                });
                await txQuery(
                    `UPDATE change_requests SET status = 'undone', undone_at = NOW(), undone_by_email = ? WHERE id = ?`,
                    [req.adminUser.email || 'administrator', cr.id]
                );
                return { cr, version: nextVer };
            });
            invalidatePublicCache(`UNDO_PUBLISH Request #${id}`);
            await logAudit('UNDO_PUBLISH', 'change_requests', id, `Undid published Request #${id} (${result.cr.target_table}:${result.cr.target_id})`, req.adminUser);
            res.json({ success: true, id, version: result.version });
        } catch (err) {
            res.status(err.statusCode || 500).json({ error: err.message });
        }
    });

    router.get('/admin/versions', authenticateSession, authorize('buildings:read'), async (req, res) => {
        const stationId = req.adminUser.stationScope !== 'all'
            ? req.adminUser.stationScope
            : String(req.query.station || 'lares').toLowerCase();
        const targetTable = String(req.query.target_table || '').trim();
        const targetId = String(req.query.target_id || '').trim();
        try {
            const clauses = ['station_id = ?'];
            const params = [stationId];
            if (targetTable) { clauses.push('target_table = ?'); params.push(targetTable); }
            if (targetId) { clauses.push('target_id = ?'); params.push(targetId); }
            const rows = await query(
                `SELECT * FROM record_versions WHERE ${clauses.join(' AND ')} ORDER BY id DESC LIMIT 60`,
                params
            );
            res.json({ stationId, versions: rows });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/versions/:id/restore', authenticateSession, authorize('buildings:draft_change'), async (req, res) => {
        const verId = Number(req.params.id);
        try {
            const [ver] = await query(`SELECT * FROM record_versions WHERE id = ? LIMIT 1`, [verId]);
            if (!ver) return res.status(404).json({ error: 'Version record not found.' });
            if (req.adminUser.stationScope !== 'all' && ver.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Version belongs to another station.' });
            }
            const snap = JSON.parse(ver.snapshot_json || '{}');
            const summary = `Restore ${ver.target_table} (${ver.target_id}) to version v${ver.version_num}`;

            if (hasDirectPublish(req) && ['stations', 'buildings', 'building_offices', 'agricultural_plots'].includes(ver.target_table)) {
                await applyCrudOperation(query, rootDir, {
                    stationId: ver.station_id,
                    targetTable: ver.target_table,
                    targetId: ver.target_id,
                    action: 'UPDATE',
                    payload: snap,
                    actorEmail: req.adminUser.email || 'admin'
                });
                const nextVer = await phase1.bumpEntityVersion(query, {
                    stationId: ver.station_id,
                    targetTable: ver.target_table,
                    targetId: ver.target_id
                });
                await phase1.recordEntityVersion(query, {
                    stationId: ver.station_id,
                    targetTable: ver.target_table,
                    targetId: ver.target_id,
                    versionNum: nextVer,
                    action: 'RESTORE',
                    summary,
                    snapshot: snap,
                    source: 'restore',
                    adminUser: req.adminUser
                });
                invalidatePublicCache(`RESTORE Version #${verId}`);
                await logAudit('RESTORE_VERSION', ver.target_table, ver.target_id, `${summary} (now v${nextVer})`, req.adminUser);
                return res.json({ success: true, published: true, version: nextVer });
            }

            const staged = await stageChangeRequest({
                req,
                stationId: ver.station_id,
                targetTable: ver.target_table,
                targetId: ver.target_id,
                action: 'UPDATE',
                summary,
                payloadObj: snap
            });
            await logAudit('REQUEST_RESTORE_VERSION', ver.target_table, ver.target_id, `Queued audited restore from v${ver.version_num} as Request #${staged.id}`, req.adminUser);
            res.json({ success: true, queuedForReview: true, changeRequestId: staged.id });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/change-requests', authenticateSession, authorize('buildings:draft_change', { checkStation: true }), async (req, res) => {
        const { station_id, target_table, target_id, action, summary, previous_json, payload_json } = req.body || {};
        if (!summary) return res.status(400).json({ error: 'Summary is required.' });
        try {
            const staged = await stageChangeRequest({
                req,
                stationId: station_id || req.adminUser.stationId || 'lares',
                targetTable: target_table || 'buildings',
                targetId: target_id || 'general',
                action: action || 'UPDATE',
                summary,
                previousObj: typeof previous_json === 'string' ? JSON.parse(previous_json) : previous_json,
                payloadObj: typeof payload_json === 'string' ? JSON.parse(payload_json) : (payload_json || {})
            });
            res.json({ success: true, id: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/change-requests/:id/resubmit', authenticateSession, authorize('buildings:draft_change'), async (req, res) => {
        const id = Number(req.params.id);
        const body = req.body || {};
        const summary = body.summary;
        const payload_json = body.payload_json !== undefined ? body.payload_json : body.payload;
        try {
            const [cr] = await query(`SELECT * FROM change_requests WHERE id = ? LIMIT 1`, [id]);
            if (!cr) return res.status(404).json({ error: 'Change request not found.' });
            if (req.adminUser.stationScope !== 'all' && cr.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Station scope mismatch.' });
            }
            if (cr.status !== 'rejected') {
                return res.status(400).json({ error: 'Only denied / revision-needed requests can be resubmitted.' });
            }
            const nextPayloadStr = payload_json
                ? (typeof payload_json === 'string' ? payload_json : JSON.stringify(payload_json))
                : cr.payload_json;
            const nextSummary = summary ? String(summary).trim() : cr.summary;

            await query(`
                UPDATE change_requests SET
                    summary = ?,
                    payload_json = ?,
                    status = 'pending',
                    revision_count = revision_count + 1,
                    reviewed_by_email = NULL,
                    reviewed_at = NULL
                WHERE id = ?
            `, [nextSummary, nextPayloadStr, id]);

            const reviewers = await rbac.findConcernedUsers({ roles: ['reviewer', 'super_admin'], stationId: cr.station_id });
            const portalUrl = `${getPublicBaseUrl(req)}/login`;
            for (const rev of reviewers) {
                const crTargetName = extractCrTargetName(nextSummary, nextPayloadStr, id);
                await rbac.notifyUser(rev.id, {
                    type: 'review_needed',
                    title: `Revised & Resubmitted: ${crTargetName}`,
                    message: `${req.adminUser.email || 'GIS Editor'} updated and resubmitted ${crTargetName} for review.`,
                    station_id: cr.station_id,
                    link_tab: 'review-queue',
                    target_table: 'change_requests',
                    target_id: id
                });
                if (rev.email && rev.role_slug === 'reviewer') {
                    await sendMailSafe({
                        to: rev.email,
                        subject: `[iGUIDE Resubmitted Request #${id}] DA-${cr.station_id.toUpperCase()}: ${nextSummary}`,
                        text: `Hello ${rev.full_name || 'Reviewer'},\n\nChange Request #${id} has been revised by ${req.adminUser.email || 'GIS Editor'} and is ready for re-review.\n\nSummary: ${nextSummary}\nOpen ${portalUrl} to review.`,
                        html: buildWorkflowEmail({
                            role: rev.role_slug || 'reviewer',
                            headerTitle: '🌿 iGUIDE Re-Review Needed',
                            roleBadgeText: `Station Reviewer • Request #${id}`,
                            greeting: `Hello ${rev.full_name || 'Reviewer'},`,
                            introText: `Change Request #${id} has been revised and resubmitted for your review:`,
                            details: [
                                { label: 'Station', value: `DA-${cr.station_id.toUpperCase()}` },
                                { label: 'Summary', value: nextSummary },
                                { label: 'Revised By', value: req.adminUser.email || 'GIS Editor' }
                            ],
                            ctaLabel: 'Review Updated Request',
                            ctaUrl: portalUrl
                        })
                    });
                }
            }
            await logAudit('RESUBMIT_CHANGE_REQUEST', 'change_requests', id, `Revised & resubmitted Request #${id}`, req.adminUser.email || 'editor');
            res.json({ success: true, id });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/change-requests/:id/publish', authenticateSession, authorize('changes:publish'), async (req, res) => {
        const crId = Number(req.params.id);
        const overrideReason = String(req.body?.override_reason || req.body?.overrideReason || '').trim();
        try {
            const { cr, txResult, selfOverrideUsed } = await runInTransaction(pool, async (txQuery) => {
                const [lockedCr] = await txQuery(`SELECT * FROM change_requests WHERE id = ? FOR UPDATE`, [crId]);
                if (!lockedCr) {
                    const err = new Error('Change request not found.');
                    err.statusCode = 404;
                    throw err;
                }
                if (lockedCr.status !== 'approved') {
                    const err = new Error(
                        lockedCr.status === 'published'
                            ? 'Change request has already been published by another request.'
                            : 'Change request must be approved by Station Reviewer before publishing.'
                    );
                    err.statusCode = lockedCr.status === 'published' ? 409 : 400;
                    throw err;
                }

                // 1.4 Self-publish guard (Super Admin can override only with written reason)
                const selfCheck = phase1.evaluateSelfActionGuard({
                    submittedByUserId: lockedCr.submitted_by_user_id,
                    submittedByEmail: lockedCr.submitted_by_email,
                    actorUser: req.adminUser,
                    overrideReason,
                    actionLabel: 'publish'
                });
                if (!selfCheck.allowed) {
                    const err = new Error(selfCheck.error);
                    err.statusCode = selfCheck.statusCode || 403;
                    throw err;
                }

                // Capture pre-publish live snapshot for 24h Undo Publish
                let prePublishSnapshot = null;
                try {
                    const snap = await phase1.captureFullRecordSnapshot(txQuery, {
                        stationId: lockedCr.station_id,
                        targetTable: lockedCr.target_table,
                        targetId: lockedCr.target_id
                    });
                    prePublishSnapshot = snap.snapshot;
                } catch (_) { }

                let parsedPayload = {};
                try {
                    parsedPayload = lockedCr.payload_json ? JSON.parse(lockedCr.payload_json) : {};
                } catch (e) {
                    const err = new Error('Invalid payload_json stored on change request.');
                    err.statusCode = 400;
                    throw err;
                }

                // Geometry Publish Gate: block publishing unmapped buildings or plots onto public map
                if (lockedCr.target_table === 'buildings' && lockedCr.action !== 'DELETE') {
                    let existingBldg = null;
                    if (lockedCr.action === 'UPDATE') {
                        const byNumId = /^\d+$/.test(String(lockedCr.target_id));
                        const [found] = await txQuery(
                            byNumId ? `SELECT * FROM buildings WHERE id = ? LIMIT 1` : `SELECT * FROM buildings WHERE station_id = ? AND building_code = ? LIMIT 1`,
                            byNumId ? [Number(lockedCr.target_id)] : [lockedCr.station_id, String(lockedCr.target_id)]
                        );
                        existingBldg = found || null;
                    } else if (parsedPayload.building_code) {
                        const [foundByCode] = await txQuery(
                            `SELECT * FROM buildings WHERE station_id = ? AND building_code = ? LIMIT 1`,
                            [lockedCr.station_id, String(parsedPayload.building_code)]
                        );
                        existingBldg = foundByCode || null;
                    }
                    const mergedBldg = { ...(existingBldg || {}), ...parsedPayload };
                    if (!hasBuildingGeometry(mergedBldg)) {
                        const err = new Error('Cannot Publish Live: this building has no mapped footprint or coordinates yet. Trace its footprint in draw.html first.');
                        err.statusCode = 400;
                        throw err;
                    }
                    parsedPayload.is_visible = 1;
                } else if (lockedCr.target_table === 'agricultural_plots' && ['CREATE', 'UPDATE'].includes(String(lockedCr.action || '').toUpperCase())) {
                    let existingPlot = null;
                    if (lockedCr.action === 'UPDATE') {
                        const [found] = await txQuery(`SELECT * FROM agricultural_plots WHERE id = ? LIMIT 1`, [Number(lockedCr.target_id)]);
                        existingPlot = found || null;
                    } else if (parsedPayload.plot_code) {
                        const [foundByCode] = await txQuery(
                            `SELECT * FROM agricultural_plots WHERE station_id = ? AND plot_code = ? LIMIT 1`,
                            [lockedCr.station_id, String(parsedPayload.plot_code)]
                        );
                        existingPlot = foundByCode || null;
                    }
                    const mergedPlot = { ...(existingPlot || {}), ...parsedPayload };
                    if (!hasPlotGeometry(mergedPlot)) {
                        const err = new Error('Cannot Publish Live: this agricultural plot has no mapped polygon or coordinates yet.');
                        err.statusCode = 400;
                        throw err;
                    }
                }

                const pubMeta = phase1.formatActorAuditMeta(req.adminUser);
                const updRes = await txQuery(
                    `UPDATE change_requests SET status = 'published', published_by_email = ?, published_by_name = ?, published_at = NOW(), published_snapshot_json = ?, override_reason = COALESCE(?, override_reason) WHERE id = ? AND status = 'approved'`,
                    [
                        pubMeta.email,
                        pubMeta.displayName,
                        prePublishSnapshot ? JSON.stringify(prePublishSnapshot) : lockedCr.previous_json,
                        selfCheck.overridden ? selfCheck.overrideReason : null,
                        lockedCr.id
                    ]
                );
                if (!updRes || Number(updRes.affectedRows) !== 1) {
                    const err = new Error('Concurrent publish conflict: request was already claimed.');
                    err.statusCode = 409;
                    throw err;
                }

                let applyResult = null;
                if (parsedPayload && Object.keys(parsedPayload).length > 0 && ['stations', 'buildings', 'building_images', 'building_offices', 'agricultural_plots', 'plot_subplots'].includes(lockedCr.target_table)) {
                    applyResult = await applyCrudOperation(txQuery, rootDir, {
                        stationId: lockedCr.station_id,
                        targetTable: lockedCr.target_table,
                        targetId: lockedCr.target_id,
                        action: lockedCr.action,
                        payload: parsedPayload,
                        actorEmail: pubMeta.email
                    });
                    const newVer = await phase1.bumpEntityVersion(txQuery, {
                        stationId: lockedCr.station_id,
                        targetTable: lockedCr.target_table,
                        targetId: lockedCr.target_id
                    });
                    const postSnap = await phase1.captureFullRecordSnapshot(txQuery, {
                        stationId: lockedCr.station_id,
                        targetTable: lockedCr.target_table,
                        targetId: lockedCr.target_id
                    });
                    await phase1.recordEntityVersion(txQuery, {
                        stationId: lockedCr.station_id,
                        targetTable: lockedCr.target_table,
                        targetId: lockedCr.target_id,
                        versionNum: newVer,
                        action: lockedCr.action,
                        summary: lockedCr.summary,
                        snapshot: postSnap.snapshot || parsedPayload,
                        changeRequestId: lockedCr.id,
                        source: 'portal',
                        adminUser: req.adminUser
                    });
                } else {
                    const ver = await bumpDataVersion(txQuery);
                    applyResult = { applied: false, note: 'Text-only change marked published', dataVersion: ver };
                }
                return { cr: lockedCr, txResult: applyResult, selfOverrideUsed: selfCheck.overridden ? selfCheck.overrideReason : '' };
            });

            invalidatePublicCache(`PUBLISH Request #${cr.id}`);

            // Notify submitting GIS Editor & Station Reviewer(s) (deduplicated if same userId)
            const pubTargetName = extractCrTargetName(cr.summary, cr.payload_json, cr.id);
            const publishedNotifiedIds = new Set();
            if (cr.submitted_by_user_id) {
                publishedNotifiedIds.add(Number(cr.submitted_by_user_id));
                await rbac.notifyUser(cr.submitted_by_user_id, {
                    type: 'change_published',
                    title: `Published Live: ${pubTargetName}`,
                    message: `Administrator published "${pubTargetName}" to the live public map.`,
                    station_id: cr.station_id,
                    link_tab: 'admin-reviews',
                    target_table: 'change_requests',
                    target_id: cr.id
                });
            }
            if (cr.submitted_by_email) {
                queueBackgroundMail({
                    to: cr.submitted_by_email,
                    subject: `[iGUIDE Published] DA-${cr.station_id.toUpperCase()} Request #${cr.id} is now live`,
                    text: `Hello,\n\nYour approved change "${cr.summary}" (Request #${cr.id}) has been published to the live system by ${req.adminUser.email || 'Administrator'}.`,
                    html: buildWorkflowEmail({
                        role: 'gis_editor',
                        headerTitle: '🌿 iGUIDE Change Published',
                        roleBadgeText: `Live on DA-${cr.station_id.toUpperCase()}`,
                        greeting: 'Hello,',
                        introText: 'Your approved change request has been published live to the public iGUIDE map:',
                        details: [
                            { label: 'Request #', value: `Request #${cr.id}` },
                            { label: 'Station', value: `DA-${cr.station_id.toUpperCase()}` },
                            { label: 'Summary', value: cr.summary },
                            { label: 'Published By', value: req.adminUser.email || 'Administrator' }
                        ]
                    })
                });
            }
            if (cr.reviewed_by_user_id && !publishedNotifiedIds.has(Number(cr.reviewed_by_user_id))) {
                publishedNotifiedIds.add(Number(cr.reviewed_by_user_id));
                await rbac.notifyUser(cr.reviewed_by_user_id, {
                    type: 'change_published',
                    title: `Published Live: ${pubTargetName}`,
                    message: `"${pubTargetName}" was published to DA-${cr.station_id.toUpperCase()}.`,
                    station_id: cr.station_id,
                    link_tab: 'review-queue',
                    target_table: 'change_requests',
                    target_id: cr.id
                });
            }

            const overrideNote = selfOverrideUsed ? ` [Super Admin Self-Override: ${selfOverrideUsed}]` : '';
            await logAudit('PUBLISH_CHANGE_REQUEST', 'change_requests', cr.id, `Published Request #${cr.id} (${cr.target_table}:${cr.target_id}) to live DB${overrideNote}`, req.adminUser);
            res.json({ success: true, ...txResult });
        } catch (err) {
            res.status(err.statusCode || 500).json({ error: err.message });
        }
    });

    router.get('/review/requests', authenticateSession, authorize('reviews:view'), async (req, res) => {
        const stationId = req.adminUser.stationScope !== 'all'
            ? req.adminUser.stationScope
            : (req.query.station || 'lares').toLowerCase();
        try {
            const rows = await query(
                `SELECT * FROM change_requests WHERE station_id = ? AND status <> 'draft' ORDER BY FIELD(status, 'pending', 'rejected', 'approved', 'published', 'denied', 'withdrawn', 'undone'), id DESC`,
                [stationId]
            );
            const enriched = await phase1.attachConflictMetadata(query, rows);
            const sanitized = await sanitizeChangeRequestPrivacy(enriched, req.adminUser);
            res.json({ stationId, requests: sanitized });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/review/requests/:id/decide', authenticateSession, authorize('reviews:decide', { checkStation: true }), async (req, res) => {
        const { decision, comment, override_reason, overrideReason } = req.body || {};
        if (!['approved', 'rejected', 'denied'].includes(decision)) {
            return res.status(400).json({ error: 'Decision must be approved, rejected (request revision), or denied (close without revision).' });
        }
        const cleanComment = String(comment || '').trim();
        const cleanOverride = String(override_reason || overrideReason || '').trim();
        if ((decision === 'rejected' || decision === 'denied') && !cleanComment) {
            return res.status(400).json({ error: 'A review comment explaining the reason is required when requesting revision or denying.' });
        }
        try {
            const { cr, overrideNotes } = await runInTransaction(pool, async (txQuery) => {
                const [lockedCr] = await txQuery(`SELECT * FROM change_requests WHERE id = ? FOR UPDATE`, [req.params.id]);
                if (!lockedCr) {
                    const err = new Error('Change request not found.');
                    err.statusCode = 404;
                    throw err;
                }
                if (req.adminUser.stationScope !== 'all' && lockedCr.station_id !== req.adminUser.stationScope) {
                    const err = new Error('Forbidden: You can only review your assigned Research Station.');
                    err.statusCode = 403;
                    throw err;
                }
                if (lockedCr.status !== 'pending') {
                    const err = new Error(`Change request already ${lockedCr.status}.`);
                    err.statusCode = 409;
                    throw err;
                }

                const collectedOverrides = [];
                if (decision === 'approved') {
                    // 1.4 Self-approval guard
                    const selfCheck = phase1.evaluateSelfActionGuard({
                        submittedByUserId: lockedCr.submitted_by_user_id,
                        submittedByEmail: lockedCr.submitted_by_email,
                        actorUser: req.adminUser,
                        overrideReason: cleanOverride,
                        actionLabel: 'approve'
                    });
                    if (!selfCheck.allowed) {
                        const err = new Error(selfCheck.error);
                        err.statusCode = selfCheck.statusCode || 403;
                        throw err;
                    }
                    if (selfCheck.overridden) collectedOverrides.push(`Self-override: ${selfCheck.overrideReason}`);

                    // 1.2 Stale base_version guard
                    const snap = await phase1.captureFullRecordSnapshot(txQuery, {
                        stationId: lockedCr.station_id,
                        targetTable: lockedCr.target_table,
                        targetId: lockedCr.target_id
                    });
                    const staleCheck = phase1.evaluateStaleBaseGuard({
                        baseVersion: lockedCr.base_version,
                        liveVersion: snap.version,
                        action: lockedCr.action,
                        overrideReason: cleanOverride
                    });
                    if (!staleCheck.allowed) {
                        const err = new Error(staleCheck.error);
                        err.statusCode = staleCheck.statusCode || 409;
                        throw err;
                    }
                    if (staleCheck.overridden) collectedOverrides.push(`Stale-base override: ${staleCheck.overrideReason}`);
                }

                const revMeta = phase1.formatActorAuditMeta(req.adminUser);
                const overrideText = collectedOverrides.length ? collectedOverrides.join(' | ') : null;
                const upd = await txQuery(
                    `UPDATE change_requests SET status = ?, reviewer_comment = ?, reviewed_by_email = ?, reviewed_by_user_id = ?, reviewed_by_name = ?, override_reason = COALESCE(?, override_reason), reviewed_at = NOW() WHERE id = ? AND status = 'pending'`,
                    [decision, cleanComment, revMeta.email, revMeta.userId, revMeta.displayName, overrideText, lockedCr.id]
                );
                if (!upd || Number(upd.affectedRows) !== 1) {
                    const err = new Error('Concurrent decision conflict: request already updated.');
                    err.statusCode = 409;
                    throw err;
                }
                return { cr: lockedCr, overrideNotes: overrideText };
            });
            const auditExtra = overrideNotes ? ` [${overrideNotes}]` : '';
            await logAudit(`REVIEW_${decision.toUpperCase()}`, 'change_requests', cr.id, `${cr.station_id.toUpperCase()} #${cr.id} ${decision}: ${cleanComment}${auditExtra}`, req.adminUser);

            const portalUrl = `${getPublicBaseUrl(req)}/login`;
            // 1. Always notify the submitting GIS Editor
            const decTargetName = extractCrTargetName(cr.summary, cr.payload_json, cr.id);
            if (cr.submitted_by_user_id) {
                const notifType = decision === 'approved' ? 'review_approved' : (decision === 'denied' ? 'review_denied' : 'review_rejected');
                const notifTitle = decision === 'approved'
                    ? `Approved: ${decTargetName}`
                    : (decision === 'denied' ? `Denied (Closed): ${decTargetName}` : `Revision Needed: ${decTargetName}`);
                const notifMsg = decision === 'approved'
                    ? `"${decTargetName}" was approved and forwarded to Administrator for publishing.`
                    : (decision === 'denied' ? `Request closed without revision: ${cleanComment}` : `Reviewer feedback: ${cleanComment}`);
                await rbac.notifyUser(cr.submitted_by_user_id, {
                    type: notifType,
                    title: notifTitle,
                    message: notifMsg,
                    station_id: cr.station_id,
                    link_tab: 'admin-reviews',
                    target_table: 'change_requests',
                    target_id: cr.id
                });
            }
            if (cr.submitted_by_email) {
                const isApproved = decision === 'approved';
                queueBackgroundMail({
                    to: cr.submitted_by_email,
                    subject: `[iGUIDE ${isApproved ? 'Approved' : 'Changes Requested'}] DA-${cr.station_id.toUpperCase()} Request #${cr.id}`,
                    text: `Hello,\n\nStation Reviewer ${req.adminUser.email || ''} marked your change request #${cr.id} as ${decision.toUpperCase()}.\n\nSummary: ${cr.summary}\nComment: ${cleanComment || '(None)'}\n\nOpen iGUIDE Portal: ${portalUrl}`,
                    html: buildWorkflowEmail({
                        role: isApproved ? 'gis_editor' : 'denied',
                        headerTitle: isApproved ? '🌿 Change Request Approved' : 'Revision Requested',
                        roleBadgeText: isApproved ? `GIS Editor • Request #${cr.id}` : `Needs Revision • Request #${cr.id}`,
                        greeting: 'Hello,',
                        introText: isApproved
                            ? `Station Reviewer approved Change Request #${cr.id} and forwarded it for publishing:`
                            : `Station Reviewer requested changes on Request #${cr.id}:`,
                        details: [
                            { label: 'Station', value: `DA-${cr.station_id.toUpperCase()}` },
                            { label: 'Summary', value: cr.summary },
                            { label: 'Reviewer', value: req.adminUser.email || 'Reviewer' },
                            { label: 'Comment', value: cleanComment || '(Approved)' }
                        ],
                        ctaLabel: isApproved ? 'View Status in Portal' : 'Revise & Resubmit',
                        ctaUrl: portalUrl
                    })
                });
            }

            // 2. If Approved, notify Administrator(s) for Publish!
            let adminNotified = 0;
            if (decision === 'approved') {
                const admins = await rbac.findConcernedUsers({ roles: ['administrator', 'super_admin'] });
                for (const adm of admins) {
                    await rbac.notifyUser(adm.id, {
                        type: 'review_approved',
                        title: `Ready to Publish: ${decTargetName}`,
                        message: `Reviewer approved "${decTargetName}" (DA-${cr.station_id.toUpperCase()}). Click to inspect and Publish live.`,
                        station_id: cr.station_id,
                        link_tab: 'admin-reviews',
                        target_table: 'change_requests',
                        target_id: cr.id
                    });
                    if (adm.email && adm.role_slug === 'administrator') {
                        queueBackgroundMail({
                            to: adm.email,
                            subject: `[iGUIDE Ready to Publish] DA-${cr.station_id.toUpperCase()}: ${cr.summary}`,
                            text: `Hello ${adm.full_name || 'Administrator'},\n\nChange Request #${cr.id} for DA-${cr.station_id.toUpperCase()} was APPROVED by Reviewer (${req.adminUser.email || 'Reviewer'}) and is ready to Publish:\n\nSummary: ${cr.summary}\nComment: ${cleanComment || '(Approved)'}\n\nOpen ${portalUrl} to Publish live.`,
                            html: buildWorkflowEmail({
                                role: adm.role_slug || 'administrator',
                                headerTitle: '🌿 Ready to Publish Live',
                                roleBadgeText: `DA-${cr.station_id.toUpperCase()} • Request #${cr.id}`,
                                greeting: `Hello ${adm.full_name || 'Administrator'},`,
                                introText: `Change Request #${cr.id} was approved by Station Reviewer and is queued for publishing:`,
                                details: [
                                    { label: 'Station', value: `DA-${cr.station_id.toUpperCase()}` },
                                    { label: 'Summary', value: cr.summary },
                                    { label: 'Reviewed By', value: req.adminUser.email || 'Reviewer' },
                                    { label: 'Comment', value: cleanComment || '(Approved)' }
                                ],
                                ctaLabel: 'Inspect & Publish Live',
                                ctaUrl: portalUrl
                            })
                        });
                        adminNotified++;
                    }
                }
            }
            res.json({ success: true, adminNotified });
        } catch (err) {
            res.status(err.statusCode || 500).json({ error: err.message });
        }
    });

    // Station Reviewer & Administrator proactive "Suggest Change / Recommend Update" -> routed to station GIS Editor(s)
    router.post('/review/suggest-change', authenticateSession, authorize('reviews:suggest', { checkStation: true }), async (req, res) => {
        const b = req.body || {};
        const stationId = String(b.station_id || req.adminUser.stationId || 'lares').trim().toLowerCase();
        const entityType = String(b.entity_type || '').trim().toLowerCase(); // 'building' | 'office' | 'plot'
        const entityId = String(b.entity_id || '').trim();
        const fieldKey = String(b.field_key || 'description').trim();
        const fieldLabel = String(b.field_label || fieldKey).trim();
        const suggestedValue = b.suggested_value !== undefined && b.suggested_value !== null ? String(b.suggested_value).trim() : '';
        const concernNote = String(b.concern_note || '').trim();

        if (!['building', 'office', 'plot'].includes(entityType) || !entityId) {
            return res.status(400).json({ error: 'Valid entity_type (building, office, plot) and entity_id are required.' });
        }
        if (!suggestedValue && !concernNote) {
            return res.status(400).json({ error: 'Please enter the suggested text or explain the concern.' });
        }

        try {
            let targetTable = 'buildings';
            let targetRow = null;
            let resolvedTargetId = entityId;
            let entityName = String(b.entity_name || entityId).trim();

            if (entityType === 'building') {
                targetTable = 'buildings';
                const rows = await query(
                    `SELECT * FROM buildings WHERE station_id = ? AND (building_code = ? OR id = ?) LIMIT 1`,
                    [stationId, entityId, Number(entityId) || -1]
                );
                targetRow = rows[0] || null;
                if (targetRow) {
                    resolvedTargetId = String(targetRow.id);
                    entityName = targetRow.name || entityName;
                }
            } else if (entityType === 'office') {
                targetTable = 'building_offices';
                const rows = await query(`SELECT * FROM building_offices WHERE id = ? LIMIT 1`, [Number(entityId) || -1]);
                targetRow = rows[0] || null;
                if (targetRow) {
                    resolvedTargetId = String(targetRow.id);
                    entityName = targetRow.office_name || entityName;
                }
            } else if (entityType === 'plot') {
                targetTable = 'agricultural_plots';
                const rows = await query(
                    `SELECT * FROM agricultural_plots WHERE station_id = ? AND (id = ? OR plot_code = ?) LIMIT 1`,
                    [stationId, Number(entityId) || -1, entityId]
                );
                targetRow = rows[0] || null;
                if (targetRow) {
                    resolvedTargetId = String(targetRow.id);
                    entityName = targetRow.zone_name || entityName;
                }
            }

            if (!targetRow) {
                return res.status(404).json({ error: 'Target record could not be found in the station database.' });
            }

            const prevObj = { ...targetRow };
            const payloadObj = { ...targetRow };
            if (fieldKey && fieldKey !== 'general' && fieldKey !== 'photo' && suggestedValue) {
                payloadObj[fieldKey] = fieldKey === 'tree_or_plant_count' ? (Number(suggestedValue) || suggestedValue) : suggestedValue;
            }

            const typeTitle = entityType === 'building' ? 'Building' : (entityType === 'office' ? 'Office' : 'Plot');
            const summary = `Update ${typeTitle} "${entityName}" (${fieldLabel})`;
            const formattedComment = `[Reviewer Suggestion — ${fieldLabel}]${concernNote ? ': ' + concernNote : ''}${suggestedValue ? ' | Suggested text: "' + suggestedValue + '"' : ''}`;

            const gisEditors = await rbac.findConcernedUsers({ roles: ['gis_editor', 'super_admin'], stationId });
            const primaryEditor = gisEditors[0] || null;

            const result = await query(`
                INSERT INTO change_requests (
                    station_id, target_table, target_id, action, summary,
                    previous_json, payload_json, status,
                    submitted_by_email, submitted_by_user_id,
                    reviewed_by_email, reviewed_by_user_id, reviewer_comment, reviewed_at
                ) VALUES (?, ?, ?, 'UPDATE', ?, ?, ?, 'rejected', ?, ?, ?, ?, ?, NOW())
            `, [
                stationId,
                targetTable,
                resolvedTargetId,
                summary,
                JSON.stringify(prevObj),
                JSON.stringify(payloadObj),
                primaryEditor ? primaryEditor.email : (req.adminUser.email || 'gis_editor'),
                primaryEditor ? primaryEditor.id : (req.adminUser.userId || null),
                req.adminUser.email || 'reviewer',
                req.adminUser.userId || null,
                formattedComment
            ]);

            const crId = result.insertId;
            const notifyTargets = gisEditors.length ? gisEditors : await rbac.findConcernedUsers({ roles: ['administrator', 'super_admin'], stationId });
            for (const ed of notifyTargets) {
                if (Number(ed.id) === Number(req.adminUser.userId)) continue;
                await rbac.notifyUser(ed.id, {
                    type: 'review_rejected',
                    title: `Suggested Edit: ${entityName}`,
                    message: `Reviewer suggested updating ${fieldLabel}: ${concernNote || suggestedValue}`,
                    station_id: stationId,
                    link_tab: 'admin-reviews',
                    target_table: 'change_requests',
                    target_id: crId
                });
            }

            await logAudit('REVIEWER_SUGGEST_CHANGE', 'change_requests', crId, `Reviewer suggested change on ${entityName} (${fieldLabel})`, req.adminUser.email || 'reviewer');
            res.json({ success: true, id: crId, notifiedEditors: notifyTargets.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/review/station-overview', authenticateSession, authorize('reviews:view'), async (req, res) => {
        const stationId = req.adminUser.stationScope !== 'all'
            ? req.adminUser.stationScope
            : (req.query.station || 'lares').toLowerCase();
        try {
            const [station] = await query(`SELECT * FROM stations WHERE station_id = ? LIMIT 1`, [stationId]);
            const buildings = await query(`SELECT * FROM buildings WHERE station_id = ? ORDER BY CASE WHEN building_num IS NULL THEN 1 ELSE 0 END, building_num ASC, id ASC`, [stationId]);
            const images = await query(`SELECT * FROM building_images WHERE station_id = ? ORDER BY is_primary DESC, display_order ASC, id ASC`, [stationId]);
            const offices = await query(`SELECT * FROM building_offices WHERE station_id = ? ORDER BY display_order ASC, id ASC`, [stationId]);
            const plots = await query(`SELECT * FROM agricultural_plots WHERE station_id = ? ORDER BY id ASC`, [stationId]);
            const subplots = await query(`SELECT * FROM plot_subplots WHERE station_id = ? ORDER BY display_order ASC, id ASC`, [stationId]);
            const roads = await query(`SELECT feature_code, road_type, name, building_code, geometry_geojson FROM road_features WHERE station_id = ? ORDER BY id ASC`, [stationId]);
            const pendingRequestsRaw = await query(`SELECT id, station_id, target_table, target_id, action, summary, status, submitted_by_user_id, submitted_by_email, created_at FROM change_requests WHERE station_id = ? AND status = 'pending' ORDER BY id DESC`, [stationId]);
            const pendingRequests = await sanitizeChangeRequestPrivacy(pendingRequestsRaw, req.adminUser);
            const [treeCnt] = await query(`SELECT COUNT(*) AS cnt FROM campus_trees WHERE station_id = ?`, [stationId]);

            const imgByBldg = {};
            images.forEach(img => {
                if (!imgByBldg[img.building_code]) imgByBldg[img.building_code] = [];
                imgByBldg[img.building_code].push(img);
            });
            const spByPlot = {};
            subplots.forEach(sp => {
                if (!spByPlot[sp.parent_plot_code]) spByPlot[sp.parent_plot_code] = [];
                spByPlot[sp.parent_plot_code].push(sp);
            });

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
                    roads: roads.length,
                    pendingReviews: pendingRequests.length
                },
                buildings: buildings.map(b => ({ ...b, images: imgByBldg[b.building_code] || [] })),
                offices,
                plots: plots.map(p => ({ ...p, subPlots: spByPlot[p.plot_code] || [] })),
                roads,
                pendingRequests
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =========================================================================
    // 6. FACT-CHECKED DASHBOARD OVERVIEW & DISK ASSET SYNC
    // =========================================================================
    router.get('/admin/dashboard', authenticateSession, authorize('dashboard:view'), async (req, res) => {
        const stationId = req.adminUser.stationScope !== 'all'
            ? req.adminUser.stationScope
            : (req.query.station || 'lares').toLowerCase();
        try {
            const stations = await query(`SELECT station_id, name, label, subtitle, province, status, kiosk_pin_lng, kiosk_pin_lat, mbtiles_filename, updated_at FROM stations ORDER BY FIELD(station_id, 'lares', 'qares', 'rares', 'cares')`);

            const [bldgRows] = [await query(`SELECT building_code, building_num, model_glb_url, facility_status FROM buildings WHERE station_id = ?`, [stationId])];
            const numberedBuildings = bldgRows.filter(b => b.building_num !== null && b.building_num !== undefined).length;
            const utilityFacilities = bldgRows.length - numberedBuildings;
            const groupedBaseIds = new Set(bldgRows.map(b => String(b.building_code || '').split('.')[0]));

            const [imgCnt] = await query(`SELECT COUNT(*) AS cnt FROM building_images WHERE station_id = ?`, [stationId]);
            const [ofcCnt] = await query(`SELECT COUNT(*) AS cnt FROM building_offices WHERE station_id = ?`, [stationId]);
            const [entCnt] = await query(`SELECT COUNT(*) AS cnt FROM building_entrances WHERE station_id = ?`, [stationId]);
            const [roadEntCnt] = await query(`SELECT COUNT(*) AS cnt FROM road_features WHERE station_id = ? AND road_type = 'entrance'`, [stationId]);
            const [plotCnt] = await query(`SELECT COUNT(*) AS cnt FROM agricultural_plots WHERE station_id = ?`, [stationId]);
            const [subPlotCnt] = await query(`SELECT COUNT(*) AS cnt FROM plot_subplots WHERE station_id = ?`, [stationId]);
            const [treeCnt] = await query(`SELECT COUNT(*) AS cnt FROM campus_trees WHERE station_id = ?`, [stationId]);
            const [roadCnt] = await query(`SELECT COUNT(*) AS cnt FROM road_features WHERE station_id = ?`, [stationId]);

            const [pendingSignupsRow] = await query(`SELECT COUNT(*) AS cnt FROM admin_users WHERE approval_status = 'pending'`);
            const [crPendingRow] = await query(`SELECT COUNT(*) AS cnt FROM change_requests WHERE status = 'pending' ${req.adminUser.stationScope !== 'all' ? 'AND station_id = ?' : ''}`, req.adminUser.stationScope !== 'all' ? [stationId] : []);
            const [crApprovedRow] = await query(`SELECT COUNT(*) AS cnt FROM change_requests WHERE status = 'approved'`);
            const [crRejectedRow] = await query(`SELECT COUNT(*) AS cnt FROM change_requests WHERE status = 'rejected' AND station_id = ?`, [stationId]);

            let diskWebpCount = 0;
            try {
                const imgDir = path.join(rootDir, 'images');
                if (fs.existsSync(imgDir)) {
                    const validCodes = new Set(bldgRows.map(b => String(b.building_code)));
                    const allFiles = fs.readdirSync(imgDir).filter(f => f.toLowerCase().endsWith('.webp'));
                    diskWebpCount = allFiles.filter(f => {
                        const base = f.replace(/\.webp$/i, '');
                        const lower = base.toLowerCase();
                        if (lower.startsWith('zone_') || lower.startsWith('gate_') || lower.endsWith('_marker')) return false;
                        if (stationId === 'rares') return lower.startsWith('rares_') && validCodes.has(base);
                        if (stationId === 'qares') return lower.startsWith('qares_') && validCodes.has(base);
                        if (stationId === 'lares') {
                            if (lower.startsWith('rares_') || lower.startsWith('qares_')) return false;
                            let bCode = base.replace(/_(inside|side|angle)$/, '');
                            if (bCode === 'corn_casava_building') bCode = 'corn/casava_building';
                            if (/^plot18_screenhouse_[678]$/.test(bCode)) bCode = 'plot18_greenhouse_complex';
                            return validCodes.has(bCode) || Number(imgCnt.cnt || 0) > 0;
                        }
                        return false;
                    }).length;
                }
            } catch (e) {}

            const customGlbCount = bldgRows.filter(b => {
                const cleanPath = String(b.model_glb_url || '').split('?')[0].trim().replace(/^\/+/, '');
                return Boolean(cleanPath && fs.existsSync(path.join(rootDir, cleanPath)));
            }).length;
            const needsRevisionRaw = await query(
                `SELECT id, station_id, target_table, target_id, summary, reviewer_comment, revision_count, submitted_by_user_id, submitted_by_email, reviewed_at
                 FROM change_requests WHERE status = 'rejected' AND station_id = ? ORDER BY id DESC LIMIT 10`,
                [stationId]
            );
            const needsRevisionItems = await sanitizeChangeRequestPrivacy(needsRevisionRaw, req.adminUser);
            const isSuperAdmin = req.adminUser.role === 'super_admin';
            const canViewAudit = (req.adminUser.permissions || []).includes('audit:view');
            const canViewLogins = (req.adminUser.permissions || []).includes('logins:view');
            const auditResult = canViewAudit
                ? await fetchPaginatedAuditLogs({ isSuperAdmin, page: 1, limit: 10 })
                : { items: [], total: 0, page: 1, limit: 10, totalPages: 1, scope: 'none' };
            const recentLogins = canViewLogins
                ? await query(
                    `SELECT l.* FROM user_login_logs l ${!isSuperAdmin ? `WHERE ${NON_SUPER_LOGIN_WHERE}` : ''} ORDER BY l.id DESC LIMIT 15`
                )
                : [];

            res.json({
                stationId,
                stations,
                counts: {
                    buildings: bldgRows.length,
                    numberedBuildings,
                    utilityFacilities,
                    groupedFacilities: groupedBaseIds.size,
                    customGlbCount,
                    images: imgCnt.cnt,
                    diskWebpCount,
                    offices: ofcCnt.cnt,
                    entrances: Math.max(Number(entCnt.cnt || 0), Number(roadEntCnt.cnt || 0)),
                    buildingEntrances: entCnt.cnt,
                    roadEntrances: roadEntCnt.cnt,
                    plots: plotCnt.cnt,
                    totalPhysicalPlots: stationId === 'lares' ? 45 : plotCnt.cnt,
                    subplots: subPlotCnt.cnt,
                    trees: treeCnt.cnt,
                    roads: roadCnt.cnt
                },
                governance: {
                    pendingSignups: pendingSignupsRow.cnt,
                    pendingReviews: crPendingRow.cnt,
                    readyToPublish: crApprovedRow.cnt,
                    rejectedNeedsRevision: crRejectedRow.cnt
                },
                needsRevisionItems,
                auditLogs: auditResult.items,
                auditTotal: auditResult.total,
                auditPage: auditResult.page,
                auditLimit: auditResult.limit,
                auditTotalPages: auditResult.totalPages,
                auditScope: isSuperAdmin ? 'all' : (canViewAudit ? 'below_super_admin' : 'none'),
                recentLogins
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/reconcile-assets', authenticateSession, authorize('system:reconcile_assets'), async (req, res) => {
        try {
            const report = await reconcileDiskAssets(query, rootDir);
            await logAudit('RECONCILE_ASSETS', 'building_images', 'images', `Synced ${report.inserted} disk .webp files into MySQL`, req.adminUser.email || 'admin');
            res.json({ success: true, ...report });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =========================================================================
    // 7. CRUD MODULES (Auto-Routes: Direct Publish for Admin / Review Queue for GIS Editor)
    // =========================================================================
    function hasDirectPublish(req) {
        return Array.isArray(req.adminUser?.permissions) && req.adminUser.permissions.includes('changes:publish') && !(req.body && req.body.submitForReview);
    }

    router.get('/admin/stations', authenticateSession, authorize('buildings:read'), async (req, res) => {
        try {
            const rows = await query(`SELECT * FROM stations ORDER BY FIELD(station_id, 'lares', 'qares', 'rares', 'cares')`);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/stations/:stationId', authenticateSession, authorize('station:edit_pin', { checkStation: true }), async (req, res) => {
        const sId = req.params.stationId.toLowerCase();
        const b = req.body || {};
        try {
            if (b.status !== undefined && b.status !== 'live' && b.status !== 'under_development') {
                return res.status(400).json({ error: 'Invalid station status. Must be "live" or "under_development".' });
            }
            const [prev] = await query(`SELECT * FROM stations WHERE station_id = ? LIMIT 1`, [sId]);
            const statusChanged = b.status !== undefined && (!prev || b.status !== prev.status);
            if (statusChanged) {
                if (!(req.adminUser.permissions || []).includes('station:toggle_status')) {
                    return res.status(403).json({ error: 'Only Super Admin can toggle live deployment status.' });
                }
            }
            if (b.require_publish_for_map_editors !== undefined) {
                if (!(req.adminUser.permissions || []).includes('changes:publish')) {
                    return res.status(403).json({ error: 'Only Administrator or Super Admin can change the map-editor publish gate.' });
                }
                await query(
                    `UPDATE stations SET require_publish_for_map_editors = ? WHERE station_id = ?`,
                    [b.require_publish_for_map_editors ? 1 : 0, sId]
                );
            }
            if (hasDirectPublish(req)) {
                await applyCrudOperation(query, rootDir, {
                    stationId: sId,
                    targetTable: 'stations',
                    targetId: sId,
                    action: 'UPDATE',
                    payload: b,
                    actorEmail: req.adminUser.email || 'admin'
                });
                const nextVer = await phase1.bumpEntityVersion(query, { stationId: sId, targetTable: 'stations', targetId: sId });
                const [updated] = await query(`SELECT * FROM stations WHERE station_id = ?`, [sId]);
                await phase1.recordEntityVersion(query, {
                    stationId: sId, targetTable: 'stations', targetId: sId,
                    versionNum: nextVer, action: 'UPDATE',
                    summary: statusChanged
                        ? `Set DA-${sId.toUpperCase()} visibility to ${b.status === 'live' ? 'Live on Public Map' : 'Under Development'}`
                        : `Updated station settings & kiosk pin (${sId.toUpperCase()})`,
                    snapshot: updated || b, source: 'portal', adminUser: req.adminUser
                });
                const auditSummary = statusChanged
                    ? `Set DA-${sId.toUpperCase()} visibility to ${b.status === 'live' ? 'Live on Public Map' : 'Under Development'}`
                    : `Updated station ${sId}`;
                await logAudit('UPDATE_STATION', 'stations', sId, auditSummary, req.adminUser);
                return res.json({ success: true, published: true, station: updated });
            }
            const staged = await stageChangeRequest({
                req,
                stationId: sId,
                targetTable: 'stations',
                targetId: sId,
                action: 'UPDATE',
                summary: b.review_summary || `Update Kiosk Pin & Metadata for DA-${sId.toUpperCase()}`,
                previousObj: prev || null,
                payloadObj: b
            });
            res.json({ success: true, queuedForReview: true, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/admin/models', authenticateSession, authorize('buildings:read'), (req, res) => {
        try {
            const modelsDir = path.join(rootDir, 'models');
            if (!fs.existsSync(modelsDir)) return res.json([]);
            const files = fs.readdirSync(modelsDir)
                .filter(f => f.toLowerCase().endsWith('.glb'))
                .sort((a, b) => a.localeCompare(b))
                .map(f => {
                    let sizeKb = 0;
                    try { sizeKb = Math.round(fs.statSync(path.join(modelsDir, f)).size / 1024); } catch (_) {}
                    return { url: `models/${f}`, filename: f, sizeKb };
                });
            res.json(files);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Buildings CRUD
    router.get('/admin/buildings', authenticateSession, authorize('buildings:read'), async (req, res) => {
        const stationId = req.adminUser.stationScope !== 'all'
            ? req.adminUser.stationScope
            : (req.query.station || 'lares').toLowerCase();
        try {
            const buildings = await query(`SELECT * FROM buildings WHERE station_id = ? ORDER BY CASE WHEN building_num IS NULL THEN 1 ELSE 0 END, building_num ASC, id ASC`, [stationId]);
            const images = await query(`SELECT * FROM building_images WHERE station_id = ? ORDER BY is_primary DESC, display_order ASC, id ASC`, [stationId]);
            const offices = await query(`SELECT * FROM building_offices WHERE station_id = ? ORDER BY display_order ASC, id ASC`, [stationId]);

            const imgMap = {};
            images.forEach(img => { (imgMap[img.building_code] ||= []).push(img); });
            const ofcMap = {};
            offices.forEach(o => { (ofcMap[o.building_code] ||= []).push(o); });

            res.json(buildings.map(b => {
                const cleanPath = String(b.model_glb_url || '').split('?')[0].trim().replace(/^\/+/, '');
                return {
                    ...b,
                    facility_status: b.facility_status || 'Existing',
                    has_geometry: hasBuildingGeometry(b),
                    has_footprint: hasValidGeoGeometry(b.footprint_geojson),
                    model_exists: Boolean(cleanPath && fs.existsSync(path.join(rootDir, cleanPath))),
                    images: imgMap[b.building_code] || [],
                    offices: ofcMap[b.building_code] || []
                };
            }));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/buildings', authenticateSession, authorize('buildings:draft_change', { checkStation: true }), async (req, res) => {
        const b = req.body || {};
        const stationId = (b.station_id || req.adminUser.stationId || 'lares').toLowerCase();
        const bCode = String(b.building_code || `bldg_${Date.now()}`).trim();
        const hasGeom = hasBuildingGeometry(b);
        const wantsSaveDraft = Boolean(b.saveAsDraft);
        try {
            if (!hasGeom && hasDirectPublish(req) && !wantsSaveDraft) {
                return res.status(400).json({
                    error: 'Cannot Publish Live: this building has no mapped footprint or coordinates yet. Trace its footprint in draw.html (or save an Unmapped Draft hidden from the map first) before publishing.'
                });
            }
            if (wantsSaveDraft && Array.isArray(req.adminUser?.permissions) && req.adminUser.permissions.includes('changes:publish')) {
                const draftPayload = { ...b, building_code: bCode, is_visible: 0 };
                const out = await applyCrudOperation(query, rootDir, {
                    stationId, targetTable: 'buildings', targetId: bCode, action: 'CREATE', payload: draftPayload, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('DRAFT_BUILDING', 'buildings', bCode, `Saved unmapped draft "${b.name || bCode}" (hidden until mapped in draw.html)`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: false, draft: true, unmapped: !hasGeom, id: out.id, building_code: bCode });
            }
            if (hasDirectPublish(req)) {
                const out = await applyCrudOperation(query, rootDir, {
                    stationId, targetTable: 'buildings', targetId: bCode, action: 'CREATE', payload: { ...b, building_code: bCode, is_visible: 1 }, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('CREATE_BUILDING', 'buildings', bCode, `Created building "${b.name}" in ${stationId.toUpperCase()}`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: true, id: out.id, building_code: bCode });
            }
            const staged = await stageChangeRequest({
                req, stationId, targetTable: 'buildings', targetId: bCode, action: 'CREATE',
                summary: b.review_summary || `Add New Building "${b.name || bCode}" (${b.facility_status || 'Existing'})`,
                previousObj: null, payloadObj: { ...b, station_id: stationId, building_code: bCode, is_visible: hasGeom ? 1 : 0 }
            });
            res.json({ success: true, queuedForReview: true, unmapped: !hasGeom, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/buildings/:id', authenticateSession, authorize('buildings:draft_change', { checkStation: true }), async (req, res) => {
        const id = Number(req.params.id);
        const b = req.body || {};
        const wantsSaveDraft = Boolean(b.saveAsDraft);
        try {
            const [prev] = await query(`SELECT * FROM buildings WHERE id = ? LIMIT 1`, [id]);
            if (!prev) return res.status(404).json({ error: 'Building not found.' });
            if (req.adminUser.stationScope !== 'all' && prev.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Building belongs to another station.' });
            }
            const hasGeomAfter = hasBuildingGeometry({ ...prev, ...b });
            if (!hasGeomAfter && hasDirectPublish(req) && !wantsSaveDraft) {
                return res.status(400).json({
                    error: 'Cannot Publish Live: this building still lacks mapped geometry or coordinates. Trace its footprint in draw.html before publishing live.'
                });
            }
            if (wantsSaveDraft && Array.isArray(req.adminUser?.permissions) && req.adminUser.permissions.includes('changes:publish')) {
                const draftPayload = { ...b, is_visible: 0 };
                await applyCrudOperation(query, rootDir, {
                    stationId: prev.station_id, targetTable: 'buildings', targetId: id, action: 'UPDATE', payload: draftPayload, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('DRAFT_BUILDING', 'buildings', prev.building_code, `Updated unmapped draft "${b.name || prev.name}"`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: false, draft: true, unmapped: !hasGeomAfter });
            }
            if (hasDirectPublish(req)) {
                const pubPayload = { ...b };
                if (hasGeomAfter && (prev.is_visible === 0 || b.is_visible === undefined)) {
                    pubPayload.is_visible = 1;
                }
                await applyCrudOperation(query, rootDir, {
                    stationId: prev.station_id, targetTable: 'buildings', targetId: id, action: 'UPDATE', payload: pubPayload, actorEmail: req.adminUser.email || 'admin'
                });
                const nextVer = await phase1.bumpEntityVersion(query, { stationId: prev.station_id, targetTable: 'buildings', targetId: id });
                const postSnap = await phase1.captureFullRecordSnapshot(query, { stationId: prev.station_id, targetTable: 'buildings', targetId: id });
                await phase1.recordEntityVersion(query, {
                    stationId: prev.station_id, targetTable: 'buildings', targetId: id,
                    versionNum: nextVer, action: 'UPDATE', summary: `Updated building "${b.name || prev.name}"`,
                    snapshot: postSnap.snapshot || pubPayload, source: 'portal', adminUser: req.adminUser
                });
                await logAudit('UPDATE_BUILDING', 'buildings', prev.building_code, `Updated building "${b.name}"`, req.adminUser);
                return res.json({ success: true, published: true, version: nextVer });
            }
            const staged = await stageChangeRequest({
                req, stationId: prev.station_id, targetTable: 'buildings', targetId: id, action: 'UPDATE',
                summary: b.review_summary || `Update Building "${b.name || prev.name}"`,
                payloadObj: b,
                saveAsDraft: wantsSaveDraft
            });
            res.json({ success: true, queuedForReview: !wantsSaveDraft, draft: wantsSaveDraft, unmapped: !hasGeomAfter, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/admin/buildings/:id', authenticateSession, authorize('buildings:draft_change', { checkStation: true }), async (req, res) => {
        const id = Number(req.params.id);
        const delCheck = phase1.validateDeleteReason(req.body?.delete_reason || req.body?.reason || req.query?.reason);
        if (!delCheck.valid) return res.status(400).json({ error: delCheck.error });
        try {
            const [prev] = await query(`SELECT * FROM buildings WHERE id = ? LIMIT 1`, [id]);
            if (!prev) return res.status(404).json({ error: 'Building not found.' });
            if (req.adminUser.stationScope !== 'all' && prev.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Building belongs to another station.' });
            }
            if (hasDirectPublish(req)) {
                const snap = await phase1.captureFullRecordSnapshot(query, { stationId: prev.station_id, targetTable: 'buildings', targetId: id });
                await phase1.recordEntityVersion(query, {
                    stationId: prev.station_id, targetTable: 'buildings', targetId: id,
                    versionNum: snap.version, action: 'DELETE', summary: `Deleted "${prev.name}" (Reason: ${delCheck.reason})`,
                    snapshot: snap.snapshot || prev, source: 'portal', adminUser: req.adminUser
                });
                await applyCrudOperation(query, rootDir, {
                    stationId: prev.station_id, targetTable: 'buildings', targetId: id, action: 'DELETE', payload: prev, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('DELETE_BUILDING', 'buildings', prev.building_code, `Deleted building "${prev.name}" — Reason: ${delCheck.reason}`, req.adminUser);
                return res.json({ success: true, published: true });
            }
            const staged = await stageChangeRequest({
                req, stationId: prev.station_id, targetTable: 'buildings', targetId: id, action: 'DELETE',
                summary: `Delete Building "${prev.name}" (${prev.building_code})`,
                previousObj: prev, payloadObj: { id, building_code: prev.building_code, name: prev.name, delete_reason: delCheck.reason },
                deleteReason: delCheck.reason
            });
            res.json({ success: true, queuedForReview: true, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Lightweight WebP disk upload (stages file on disk without creating a separate Change Request)
    router.post('/admin/upload-webp', authenticateSession, authorize('buildings:draft_change', { checkStation: true }), async (req, res) => {
        const b = req.body || {};
        if (!b.base64_data || !b.filename) {
            return res.status(400).json({ error: 'base64_data and filename are required' });
        }
        try {
            const rawData = String(b.base64_data);
            const base64Clean = rawData.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
            const buf = Buffer.from(base64Clean, 'base64');
            if (buf.length > 15 * 1024 * 1024) {
                return res.status(413).json({ error: 'Uploaded WebP photo exceeds the 15 MB safety limit.' });
            }
            // Verify authentic WebP RIFF/WEBP container header (Rule 10: strictly WebP in images/)
            const isWebpHeader = buf.length >= 12
                && buf.subarray(0, 4).toString('ascii') === 'RIFF'
                && buf.subarray(8, 12).toString('ascii') === 'WEBP';
            if (!isWebpHeader) {
                return res.status(400).json({ error: 'Uploaded photo must be converted to WebP format before saving.' });
            }
            const safeBase = String(b.filename).replace(/[^a-zA-Z0-9_-]/g, '_').replace(/\.(webp|jpg|jpeg|png)$/i, '') || 'facility_photo';
            const outName = `${safeBase}_${Date.now()}.webp`;
            fs.writeFileSync(path.join(rootDir, 'images', outName), buf);
            return res.json({ success: true, image_webp_url: `images/${outName}`, bytes: buf.length });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    });

    // Building Images CRUD
    router.post('/admin/building-images', authenticateSession, authorize('buildings:draft_change', { checkStation: true }), async (req, res) => {
        const b = req.body || {};
        const stationId = (b.station_id || req.adminUser.stationId || 'lares').toLowerCase();
        if (!b.building_code) return res.status(400).json({ error: 'building_code is required' });
        try {
            // Write uploaded file on receipt so CR payload references a clean .webp path (not giant base64 blob)
            let finalUrl = b.image_webp_url || '';
            if (b.base64_data && b.filename && !finalUrl) {
                const base64Clean = String(b.base64_data).replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
                const buf = Buffer.from(base64Clean, 'base64');
                if (buf.length > 15 * 1024 * 1024) {
                    return res.status(413).json({ error: 'Uploaded WebP photo exceeds the 15 MB safety limit.' });
                }
                const isWebpHeader = buf.length >= 12
                    && buf.subarray(0, 4).toString('ascii') === 'RIFF'
                    && buf.subarray(8, 12).toString('ascii') === 'WEBP';
                if (!isWebpHeader) {
                    return res.status(400).json({ error: 'Uploaded photo must be converted to WebP format before saving.' });
                }
                const safeBase = String(b.filename).replace(/[^a-zA-Z0-9_-]/g, '_').replace(/\.(webp|jpg|jpeg|png)$/i, '') || 'facility_photo';
                const outName = `${safeBase}_${Date.now()}.webp`;
                fs.writeFileSync(path.join(rootDir, 'images', outName), buf);
                finalUrl = `images/${outName}`;
            }
            const payload = { ...b, base64_data: undefined, image_webp_url: finalUrl, station_id: stationId };
            if (hasDirectPublish(req)) {
                const out = await applyCrudOperation(query, rootDir, {
                    stationId, targetTable: 'building_images', targetId: b.building_code, action: 'CREATE', payload, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('ADD_BUILDING_IMAGE', 'building_images', b.building_code, `Added photo "${finalUrl}" to ${b.building_code}`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: true, id: out.id, image_webp_url: finalUrl });
            }
            const staged = await stageChangeRequest({
                req, stationId, targetTable: 'building_images', targetId: b.building_code, action: 'CREATE',
                summary: `Add Photo "${b.caption || 'Facility View'}" (${finalUrl}) to ${b.building_code}`,
                previousObj: null, payloadObj: payload
            });
            res.json({ success: true, queuedForReview: true, image_webp_url: finalUrl, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Reorder building photos (swap 1st/2nd/etc.) & persist gallery display mode ('slider' | 'carousel')
    router.post('/admin/building-images/reorder', authenticateSession, authorize('buildings:draft_change', { checkStation: true }), async (req, res) => {
        const b = req.body || {};
        const stationId = String(b.station_id || req.adminUser.stationId || 'lares').toLowerCase();
        const buildingCode = String(b.building_code || '').trim();
        const orderedIds = Array.isArray(b.ordered_ids) ? b.ordered_ids.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
        const galleryMode = (b.gallery_mode === 'carousel' || b.gallery_mode === 'slider') ? b.gallery_mode : null;

        if (!buildingCode) return res.status(400).json({ error: 'building_code is required' });
        try {
            if (orderedIds.length > 0) {
                for (let idx = 0; idx < orderedIds.length; idx++) {
                    const imgId = orderedIds[idx];
                    await query(
                        `UPDATE building_images SET display_order = ?, is_primary = ? WHERE id = ? AND station_id = ? AND building_code = ?`,
                        [idx, idx === 0 ? 1 : 0, imgId, stationId, buildingCode]
                    );
                }
            }
            if (galleryMode) {
                const modeKey = `gallery_mode_${stationId}_${buildingCode}`;
                await query(
                    'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
                    [modeKey, galleryMode]
                );
            }
            await query("INSERT INTO settings (`key`, `value`) VALUES ('data_version', '2') ON DUPLICATE KEY UPDATE `value` = CAST(COALESCE(NULLIF(`value`, ''), '1') AS UNSIGNED) + 1");
            invalidatePublicCache(`reorder-images-${stationId}`);
            await logAudit('REORDER_BUILDING_IMAGES', 'building_images', buildingCode, `Reordered ${orderedIds.length} photo(s) on ${buildingCode}${galleryMode ? ' (mode: ' + galleryMode + ')' : ''}`, req.adminUser.email || 'editor');
            res.json({ success: true, ordered_ids: orderedIds, gallery_mode: galleryMode });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/admin/building-gallery-mode', authenticateSession, authorize('buildings:read'), async (req, res) => {
        const stationId = String(req.query.station || req.adminUser.stationId || 'lares').toLowerCase();
        const buildingCode = String(req.query.building_code || '').trim();
        if (!buildingCode) return res.json({ gallery_mode: 'slider' });
        try {
            const [row] = await query('SELECT `value` FROM settings WHERE `key` = ? LIMIT 1', [`gallery_mode_${stationId}_${buildingCode}`]);
            res.json({ gallery_mode: (row && row.value === 'carousel') ? 'carousel' : 'slider' });
        } catch (_) {
            res.json({ gallery_mode: 'slider' });
        }
    });

    router.put('/admin/building-images/:id', authenticateSession, authorize('buildings:draft_change', { checkStation: true }), async (req, res) => {
        const id = Number(req.params.id);
        const b = req.body || {};
        try {
            const [row] = await query(`SELECT * FROM building_images WHERE id = ?`, [id]);
            if (!row) return res.status(404).json({ error: 'Image not found' });
            if (req.adminUser.stationScope !== 'all' && row.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Image belongs to another station.' });
            }
            if (hasDirectPublish(req)) {
                await applyCrudOperation(query, rootDir, {
                    stationId: row.station_id, targetTable: 'building_images', targetId: id, action: 'UPDATE', payload: b, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('UPDATE_BUILDING_IMAGE', 'building_images', id, `Updated photo #${id}`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: true });
            }
            const staged = await stageChangeRequest({
                req, stationId: row.station_id, targetTable: 'building_images', targetId: id, action: 'UPDATE',
                summary: `Update Photo #${id} metadata on ${row.building_code}`,
                previousObj: row, payloadObj: b
            });
            res.json({ success: true, queuedForReview: true, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/admin/building-images/:id', authenticateSession, authorize('buildings:draft_change', { checkStation: true }), async (req, res) => {
        const id = Number(req.params.id);
        const delCheck = phase1.validateDeleteReason(req.body?.delete_reason || req.body?.reason || req.query?.reason);
        if (!delCheck.valid) return res.status(400).json({ error: delCheck.error });
        try {
            const [row] = await query(`SELECT * FROM building_images WHERE id = ?`, [id]);
            if (!row) return res.status(404).json({ error: 'Image not found' });
            if (req.adminUser.stationScope !== 'all' && row.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Image belongs to another station.' });
            }
            if (hasDirectPublish(req)) {
                await applyCrudOperation(query, rootDir, {
                    stationId: row.station_id, targetTable: 'building_images', targetId: id, action: 'DELETE', payload: row, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('DELETE_BUILDING_IMAGE', 'building_images', row.building_code, `Removed photo "${row.image_webp_url}" — Reason: ${delCheck.reason}`, req.adminUser);
                return res.json({ success: true, published: true });
            }
            const staged = await stageChangeRequest({
                req, stationId: row.station_id, targetTable: 'building_images', targetId: id, action: 'DELETE',
                summary: `Remove Photo "${row.image_webp_url}" from ${row.building_code}`,
                previousObj: row, payloadObj: { id, building_code: row.building_code, image_webp_url: row.image_webp_url, delete_reason: delCheck.reason },
                deleteReason: delCheck.reason
            });
            res.json({ success: true, queuedForReview: true, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Internal Offices CRUD
    router.get('/admin/offices', authenticateSession, authorize('offices:read'), async (req, res) => {
        const stationId = req.adminUser.stationScope !== 'all'
            ? req.adminUser.stationScope
            : (req.query.station || 'lares').toLowerCase();
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
            res.json(await query(sql, params));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/offices', authenticateSession, authorize('offices:draft_change', { checkStation: true }), async (req, res) => {
        const b = normalizeOfficePayload(req.body || {});
        const stationId = (b.station_id || req.adminUser.stationId || 'lares').toLowerCase();
        if (!b.building_code || !b.office_name) {
            return res.status(400).json({ error: 'building_code and office_name are required' });
        }
        try {
            if (hasDirectPublish(req)) {
                const out = await applyCrudOperation(query, rootDir, {
                    stationId, targetTable: 'building_offices', targetId: b.building_code, action: 'CREATE', payload: b, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('CREATE_OFFICE', 'building_offices', b.building_code, `Added office "${b.office_name}"`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: true, id: out.id });
            }
            const staged = await stageChangeRequest({
                req, stationId, targetTable: 'building_offices', targetId: b.building_code, action: 'CREATE',
                summary: `Add Office "${b.office_name}" to ${b.building_code}`,
                previousObj: null, payloadObj: { ...b, station_id: stationId }
            });
            res.json({ success: true, queuedForReview: true, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/offices/:id', authenticateSession, authorize('offices:draft_change', { checkStation: true }), async (req, res) => {
        const id = Number(req.params.id);
        const b = normalizeOfficePayload(req.body || {});
        try {
            const [prev] = await query(`SELECT * FROM building_offices WHERE id = ? LIMIT 1`, [id]);
            if (!prev) return res.status(404).json({ error: 'Office not found.' });
            if (req.adminUser.stationScope !== 'all' && prev.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Office belongs to another station.' });
            }
            if (hasDirectPublish(req)) {
                await applyCrudOperation(query, rootDir, {
                    stationId: prev.station_id, targetTable: 'building_offices', targetId: id, action: 'UPDATE', payload: b, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('UPDATE_OFFICE', 'building_offices', id, `Updated office "${b.office_name || prev.office_name}"`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: true });
            }
            const staged = await stageChangeRequest({
                req, stationId: prev.station_id, targetTable: 'building_offices', targetId: id, action: 'UPDATE',
                summary: `Update Office "${b.office_name || prev.office_name}" (${prev.building_code})`,
                previousObj: prev, payloadObj: b
            });
            res.json({ success: true, queuedForReview: true, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/admin/offices/:id', authenticateSession, authorize('offices:draft_change', { checkStation: true }), async (req, res) => {
        const id = Number(req.params.id);
        const delCheck = phase1.validateDeleteReason(req.body?.delete_reason || req.body?.reason || req.query?.reason);
        if (!delCheck.valid) return res.status(400).json({ error: delCheck.error });
        try {
            const [prev] = await query(`SELECT * FROM building_offices WHERE id = ? LIMIT 1`, [id]);
            if (!prev) return res.status(404).json({ error: 'Office not found.' });
            if (req.adminUser.stationScope !== 'all' && prev.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Office belongs to another station.' });
            }
            if (hasDirectPublish(req)) {
                await phase1.recordEntityVersion(query, {
                    stationId: prev.station_id, targetTable: 'building_offices', targetId: id,
                    versionNum: Number(prev.version || 1), action: 'DELETE', summary: `Removed office "${prev.office_name}" (Reason: ${delCheck.reason})`,
                    snapshot: prev, source: 'portal', adminUser: req.adminUser
                });
                await applyCrudOperation(query, rootDir, {
                    stationId: prev.station_id, targetTable: 'building_offices', targetId: id, action: 'DELETE', payload: prev, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('DELETE_OFFICE', 'building_offices', prev.building_code, `Removed office "${prev.office_name}" — Reason: ${delCheck.reason}`, req.adminUser);
                return res.json({ success: true, published: true });
            }
            const staged = await stageChangeRequest({
                req, stationId: prev.station_id, targetTable: 'building_offices', targetId: id, action: 'DELETE',
                summary: `Remove Office "${prev.office_name}" from ${prev.building_code}`,
                previousObj: prev, payloadObj: { id, office_name: prev.office_name, building_code: prev.building_code, delete_reason: delCheck.reason },
                deleteReason: delCheck.reason
            });
            res.json({ success: true, queuedForReview: true, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Agricultural Plots, Split/Merge & Plot History CRUD
    router.get('/admin/plots', authenticateSession, authorize('plots:read'), async (req, res) => {
        const stationId = req.adminUser.stationScope !== 'all'
            ? req.adminUser.stationScope
            : (req.query.station || 'lares').toLowerCase();
        try {
            const plots = await query(`SELECT * FROM agricultural_plots WHERE station_id = ? ORDER BY id ASC`, [stationId]);
            const subplots = await query(`SELECT * FROM plot_subplots WHERE station_id = ? ORDER BY display_order ASC, id ASC`, [stationId]);
            const historyRows = await query(`SELECT * FROM plot_history WHERE station_id = ? ORDER BY id DESC LIMIT 120`, [stationId]);
            const spMap = {};
            subplots.forEach(sp => { (spMap[sp.parent_plot_code] ||= []).push(sp); });
            const histMap = {};
            historyRows.forEach(h => { (histMap[h.plot_code] ||= []).push(h); });

            res.json(plots.map(p => ({
                ...p,
                facility_status: p.facility_status || 'Existing',
                has_geometry: hasPlotGeometry(p),
                has_polygon: hasValidGeoGeometry(p.polygon_geojson),
                subPlots: spMap[p.plot_code] || [],
                history: histMap[p.plot_code] || []
            })));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/admin/plots/:code/history', authenticateSession, authorize('plots:read'), async (req, res) => {
        const stationId = req.adminUser.stationScope !== 'all'
            ? req.adminUser.stationScope
            : (req.query.station || 'lares').toLowerCase();
        try {
            const rows = await query(`SELECT * FROM plot_history WHERE station_id = ? AND plot_code = ? ORDER BY id DESC`, [stationId, req.params.code]);
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/plots', authenticateSession, authorize('plots:draft_change', { checkStation: true }), async (req, res) => {
        const b = req.body || {};
        const stationId = (b.station_id || req.adminUser.stationId || 'lares').toLowerCase();
        const plotCode = String(b.plot_code || `plot_${Date.now()}`).trim();
        const hasGeom = hasPlotGeometry(b);
        const wantsSaveDraft = Boolean(b.saveAsDraft);
        try {
            if (!hasGeom && hasDirectPublish(req) && !wantsSaveDraft) {
                return res.status(400).json({
                    error: 'Cannot Publish Live: this agricultural plot has no mapped polygon or center coordinates yet. Map its geometry (or save an Unmapped Draft hidden from the public map) before publishing.'
                });
            }
            if (wantsSaveDraft && Array.isArray(req.adminUser?.permissions) && req.adminUser.permissions.includes('changes:publish')) {
                const out = await applyCrudOperation(query, rootDir, {
                    stationId, targetTable: 'agricultural_plots', targetId: plotCode, action: 'CREATE', payload: { ...b, plot_code: plotCode }, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('DRAFT_PLOT', 'agricultural_plots', plotCode, `Saved unmapped plot draft "${b.zone_name}" (hidden until polygon is mapped)`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: false, draft: true, unmapped: !hasGeom, id: out.id, plot_code: plotCode });
            }
            if (hasDirectPublish(req)) {
                const out = await applyCrudOperation(query, rootDir, {
                    stationId, targetTable: 'agricultural_plots', targetId: plotCode, action: 'CREATE', payload: { ...b, plot_code: plotCode }, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('CREATE_PLOT', 'agricultural_plots', plotCode, `Created plot "${b.zone_name}"`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: true, id: out.id, plot_code: plotCode });
            }
            const staged = await stageChangeRequest({
                req, stationId, targetTable: 'agricultural_plots', targetId: plotCode, action: 'CREATE',
                summary: `Create Plot Zone "${b.zone_name}" (${b.plot_number || plotCode})`,
                previousObj: null, payloadObj: { ...b, station_id: stationId, plot_code: plotCode }
            });
            res.json({ success: true, queuedForReview: true, unmapped: !hasGeom, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/plots/:id', authenticateSession, authorize('plots:draft_change', { checkStation: true }), async (req, res) => {
        const id = Number(req.params.id);
        const b = req.body || {};
        const wantsSaveDraft = Boolean(b.saveAsDraft);
        try {
            const [prev] = await query(`SELECT * FROM agricultural_plots WHERE id = ? LIMIT 1`, [id]);
            if (!prev) return res.status(404).json({ error: 'Plot not found.' });
            if (req.adminUser.stationScope !== 'all' && prev.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Plot belongs to another station.' });
            }
            const hasGeomAfter = hasPlotGeometry({ ...prev, ...b });
            if (!hasGeomAfter && hasDirectPublish(req) && !wantsSaveDraft) {
                return res.status(400).json({
                    error: 'Cannot Publish Live: this agricultural plot still lacks mapped polygon or coordinates. Map its geometry before publishing live.'
                });
            }
            if (wantsSaveDraft && Array.isArray(req.adminUser?.permissions) && req.adminUser.permissions.includes('changes:publish')) {
                await applyCrudOperation(query, rootDir, {
                    stationId: prev.station_id, targetTable: 'agricultural_plots', targetId: id, action: 'UPDATE', payload: b, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('DRAFT_PLOT', 'agricultural_plots', prev.plot_code, `Updated unmapped plot draft "${b.zone_name || prev.zone_name}"`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: false, draft: true, unmapped: !hasGeomAfter });
            }
            if (hasDirectPublish(req)) {
                await applyCrudOperation(query, rootDir, {
                    stationId: prev.station_id, targetTable: 'agricultural_plots', targetId: id, action: 'UPDATE', payload: b, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('UPDATE_PLOT', 'agricultural_plots', prev.plot_code, `Updated plot "${b.zone_name}"`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: true });
            }
            const staged = await stageChangeRequest({
                req, stationId: prev.station_id, targetTable: 'agricultural_plots', targetId: id, action: 'UPDATE',
                summary: `Update Plot "${b.zone_name || prev.zone_name}" (Crop: ${b.current_crop || 'N/A'})`,
                previousObj: prev, payloadObj: b
            });
            res.json({ success: true, queuedForReview: true, unmapped: !hasGeomAfter, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/admin/plots/:id', authenticateSession, authorize('plots:draft_change', { checkStation: true }), async (req, res) => {
        const id = Number(req.params.id);
        const delCheck = phase1.validateDeleteReason(req.body?.delete_reason || req.body?.reason || req.query?.reason);
        if (!delCheck.valid) return res.status(400).json({ error: delCheck.error });
        try {
            const [prev] = await query(`SELECT * FROM agricultural_plots WHERE id = ? LIMIT 1`, [id]);
            if (!prev) return res.status(404).json({ error: 'Plot not found.' });
            if (req.adminUser.stationScope !== 'all' && prev.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Plot belongs to another station.' });
            }
            if (hasDirectPublish(req)) {
                const snap = await phase1.captureFullRecordSnapshot(query, { stationId: prev.station_id, targetTable: 'agricultural_plots', targetId: id });
                await phase1.recordEntityVersion(query, {
                    stationId: prev.station_id, targetTable: 'agricultural_plots', targetId: id,
                    versionNum: snap.version, action: 'DELETE', summary: `Deleted plot "${prev.zone_name}" (Reason: ${delCheck.reason})`,
                    snapshot: snap.snapshot || prev, source: 'portal', adminUser: req.adminUser
                });
                await applyCrudOperation(query, rootDir, {
                    stationId: prev.station_id, targetTable: 'agricultural_plots', targetId: id, action: 'DELETE', payload: prev, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('DELETE_PLOT', 'agricultural_plots', prev.plot_code, `Deleted plot "${prev.zone_name}" — Reason: ${delCheck.reason}`, req.adminUser);
                return res.json({ success: true, published: true });
            }
            const staged = await stageChangeRequest({
                req, stationId: prev.station_id, targetTable: 'agricultural_plots', targetId: id, action: 'DELETE',
                summary: `Delete Plot "${prev.zone_name}" (${prev.plot_code})`,
                previousObj: prev, payloadObj: { id, plot_code: prev.plot_code, zone_name: prev.zone_name, delete_reason: delCheck.reason },
                deleteReason: delCheck.reason
            });
            res.json({ success: true, queuedForReview: true, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Split a single plot out of a combined multi-plot zone OR Merge individual plots back into a combined zone
    router.post('/admin/plots/:id/split', authenticateSession, authorize('plots:split_merge', { checkStation: true }), async (req, res) => {
        const parentId = Number(req.params.id);
        const b = req.body || {};
        try {
            const [parent] = await query(`SELECT * FROM agricultural_plots WHERE id = ? LIMIT 1`, [parentId]);
            if (!parent) return res.status(404).json({ error: 'Combined plot zone not found.' });
            if (req.adminUser.stationScope !== 'all' && parent.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Plot belongs to another station.' });
            }
            const splitNum = String(b.split_plot_number || '').trim();
            if (!splitNum) return res.status(400).json({ error: 'split_plot_number is required (e.g. "Plot 8").' });
            const payload = { ...b, parent_plot_id: parentId };

            if (hasDirectPublish(req)) {
                const out = await runInTransaction(pool, (txQuery) =>
                    applyCrudOperation(txQuery, rootDir, {
                        stationId: parent.station_id, targetTable: 'agricultural_plots', targetId: parentId, action: 'SPLIT', payload, actorEmail: req.adminUser.email || 'admin'
                    })
                );
                await logAudit('SPLIT_PLOT', 'agricultural_plots', out.plot_code, `Split "${splitNum}" from "${parent.zone_name}"`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: true, ...out });
            }
            const staged = await stageChangeRequest({
                req, stationId: parent.station_id, targetTable: 'agricultural_plots', targetId: parentId, action: 'SPLIT',
                summary: `Split ${splitNum} from "${parent.zone_name}" (${parent.plot_number || parent.plot_code})`,
                previousObj: parent, payloadObj: payload
            });
            res.json({ success: true, queuedForReview: true, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/admin/plots/merge', authenticateSession, authorize('plots:split_merge', { checkStation: true }), async (req, res) => {
        const b = req.body || {};
        const targetId = Number(b.target_plot_id);
        if (!targetId) return res.status(400).json({ error: 'target_plot_id is required.' });
        try {
            const [target] = await query(`SELECT * FROM agricultural_plots WHERE id = ? LIMIT 1`, [targetId]);
            if (!target) return res.status(404).json({ error: 'Target zone not found.' });
            if (req.adminUser.stationScope !== 'all' && target.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Plot belongs to another station.' });
            }
            if (hasDirectPublish(req)) {
                const out = await runInTransaction(pool, (txQuery) =>
                    applyCrudOperation(txQuery, rootDir, {
                        stationId: target.station_id, targetTable: 'agricultural_plots', targetId, action: 'MERGE', payload: b, actorEmail: req.adminUser.email || 'admin'
                    })
                );
                await logAudit('MERGE_PLOTS', 'agricultural_plots', target.plot_code, `Merged plots into "${b.merged_zone_name || target.zone_name}"`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: true, ...out });
            }
            const staged = await stageChangeRequest({
                req, stationId: target.station_id, targetTable: 'agricultural_plots', targetId, action: 'MERGE',
                summary: `Merge plots into "${b.merged_zone_name || target.zone_name}"`,
                previousObj: target, payloadObj: b
            });
            res.json({ success: true, queuedForReview: true, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/admin/subplots/:id', authenticateSession, authorize('plots:draft_change', { checkStation: true }), async (req, res) => {
        const id = Number(req.params.id);
        const b = req.body || {};
        try {
            const [prev] = await query(`SELECT * FROM plot_subplots WHERE id = ? LIMIT 1`, [id]);
            if (!prev) return res.status(404).json({ error: 'Sub-plot not found.' });
            if (req.adminUser.stationScope !== 'all' && prev.station_id !== req.adminUser.stationScope) {
                return res.status(403).json({ error: 'Forbidden: Sub-plot belongs to another station.' });
            }
            if (hasDirectPublish(req)) {
                await applyCrudOperation(query, rootDir, {
                    stationId: prev.station_id, targetTable: 'plot_subplots', targetId: id, action: 'UPDATE', payload: b, actorEmail: req.adminUser.email || 'admin'
                });
                await logAudit('UPDATE_SUBPLOT', 'plot_subplots', id, `Updated sub-plot "${b.name}"`, req.adminUser.email || 'admin');
                return res.json({ success: true, published: true });
            }
            const staged = await stageChangeRequest({
                req, stationId: prev.station_id, targetTable: 'plot_subplots', targetId: id, action: 'UPDATE',
                summary: `Update Screenhouse Sub-Plot "${b.name || prev.name}"`,
                previousObj: prev, payloadObj: b
            });
            res.json({ success: true, queuedForReview: true, changeRequestId: staged.id, notifiedReviewers: staged.notifiedReviewers });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // =========================================================================
    // 6. SUPER-ADMIN SAFE CAPACITY & STRESS SELF-DIAGNOSTICS
    // =========================================================================
    router.post('/admin/diagnostics/burst-test', authenticateSession, authorize('rbac:switch_role'), async (req, res) => {
        if (req.adminUser.baseRole !== 'super_admin') {
            return res.status(403).json({ error: 'Only Super Admin accounts can execute live diagnostics.' });
        }
        const http = require('http');
        const b = req.body || {};
        const station = ['lares', 'qares', 'rares', 'cares'].includes(String(b.station || '').toLowerCase())
            ? String(b.station).toLowerCase()
            : 'lares';
        const total = Math.max(10, Math.min(1000, Number(b.totalRequests || 500)));
        const concurrency = Math.max(5, Math.min(250, Number(b.concurrency || 100)));
        const localPort = Number(req.socket?.localPort || process.env.PORT || 8080);

        const memBefore = process.memoryUsage();
        const t0Db = process.hrtime.bigint();
        let dbPingMs = null;
        try {
            await query('SELECT 1 AS ok');
            dbPingMs = Number(process.hrtime.bigint() - t0Db) / 1e6;
        } catch (e) {
            return res.status(500).json({ error: 'MySQL ping failed: ' + e.message });
        }

        const runBatch = (pathUrl) => new Promise((resolve) => {
            const latencies = [];
            const statusCounts = {};
            let sent = 0;
            let completed = 0;
            const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency });
            const wallStart = process.hrtime.bigint();

            function next() {
                if (sent >= total) return;
                sent += 1;
                const reqStart = process.hrtime.bigint();
                const r = http.get({
                    hostname: '127.0.0.1',
                    port: localPort,
                    path: pathUrl,
                    agent,
                    headers: { 'Accept-Encoding': 'gzip' }
                }, (resp) => {
                    resp.resume();
                    resp.on('end', () => {
                        const code = String(resp.statusCode || 0);
                        statusCounts[code] = (statusCounts[code] || 0) + 1;
                        latencies.push(Number(process.hrtime.bigint() - reqStart) / 1e6);
                        completed += 1;
                        if (completed === total) finish();
                        else next();
                    });
                });
                r.on('error', () => {
                    statusCounts.ERR = (statusCounts.ERR || 0) + 1;
                    latencies.push(Number(process.hrtime.bigint() - reqStart) / 1e6);
                    completed += 1;
                    if (completed === total) finish();
                    else next();
                });
            }

            function finish() {
                agent.destroy();
                latencies.sort((a, c) => a - c);
                const pick = (p) => Number((latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] || 0).toFixed(1));
                const wallMs = Number((Number(process.hrtime.bigint() - wallStart) / 1e6).toFixed(1));
                const rps = wallMs > 0 ? Math.round((total / wallMs) * 1000) : 0;
                resolve({ total, concurrency, wallMs, rps, p50Ms: pick(0.5), p95Ms: pick(0.95), p99Ms: pick(0.99), maxMs: pick(1.0), statusCounts });
            }

            const initialWorkers = Math.min(concurrency, total);
            for (let i = 0; i < initialWorkers; i++) next();
        });

        try {
            const [bootstrapBench, versionBench] = await Promise.all([
                runBatch(`/api/bootstrap?station=${encodeURIComponent(station)}`),
                runBatch('/api/version')
            ]);
            const memAfter = process.memoryUsage();
            res.json({
                success: true,
                station,
                executedAt: new Date().toISOString(),
                dbPingMs: Number(dbPingMs.toFixed(2)),
                poolConfig: req.app?.locals?.getDbPoolConfig ? req.app.locals.getDbPoolConfig() : { connectionLimit: 25, queueLimit: 250 },
                memoryMb: {
                    rssBefore: Number((memBefore.rss / 1048576).toFixed(1)),
                    rssAfter: Number((memAfter.rss / 1048576).toFixed(1)),
                    heapUsed: Number((memAfter.heapUsed / 1048576).toFixed(1))
                },
                cacheEntries: bootstrapCache.size,
                mailQueueDepth: mailQueue.length,
                benchmarks: {
                    bootstrap: bootstrapBench,
                    version: versionBench
                }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
