/**
 * Normalized Permission-Matrix RBAC, Security Validation & Targeted Notifications
 * Separates Authentication (AuthN) from Authorization (AuthZ) with in-memory permission caching.
 */

const crypto = require('crypto');

const ROLE_DEFS = [
    {
        slug: 'visitor',
        name: 'Visitor Preview',
        description: 'External public map viewer (Visitor, Stakeholder, Employee, Management)',
        color_hex: '#14b8a6',
        is_internal: 0
    },
    {
        slug: 'reviewer',
        name: 'Station Reviewer',
        description: 'Researcher assigned to one Research Station to Approve, Deny, or Comment on CRUD changes',
        color_hex: '#f59e0b',
        is_internal: 1
    },
    {
        slug: 'gis_editor',
        name: 'GIS Editor',
        description: 'Edits CRUD modules (queued for review) and operates internal Visual Editors',
        color_hex: '#0ea5e9',
        is_internal: 1
    },
    {
        slug: 'administrator',
        name: 'Administrator (MIS Supt.)',
        description: 'Approves sign-ups, assigns roles/stations/offices/duties, and publishes approved changes live',
        color_hex: '#10b981',
        is_internal: 1
    },
    {
        slug: 'super_admin',
        name: 'Super Admin',
        description: 'System overseer across all stations with single-account live role switching',
        color_hex: '#a855f7',
        is_internal: 1
    }
];

const PERMISSION_DEFS = [
    ['map:view_public', 'map', 'view_public', 'View public 3D campus map'],
    ['dashboard:view', 'dashboard', 'view', 'View station telemetry and portal overview'],
    ['audit:view', 'audit', 'view', 'View system audit logs'],
    ['logins:view', 'logins', 'view', 'View user login audit logs'],
    ['station:edit_pin', 'station', 'edit_pin', 'Update Kiosk You Are Here pin and station metadata'],
    ['station:toggle_status', 'station', 'toggle_status', 'Switch station between Live and Under Development'],
    ['buildings:read', 'buildings', 'read', 'Read building directory and gallery records'],
    ['buildings:draft_change', 'buildings', 'draft_change', 'Create, update, or delete building/photo drafts'],
    ['offices:read', 'offices', 'read', 'Read internal building offices'],
    ['offices:draft_change', 'offices', 'draft_change', 'Create, update, or delete internal office drafts'],
    ['plots:read', 'plots', 'read', 'Read agricultural plots, crops, and history'],
    ['plots:draft_change', 'plots', 'draft_change', 'Create or update agricultural plot drafts'],
    ['plots:split_merge', 'plots', 'split_merge', 'Split single plots from combined zones or merge zones'],
    ['editors:use_visual', 'editors', 'use_visual', 'Use internal GIS Visual Editors and geometry saves'],
    ['reviews:view', 'reviews', 'view', 'View CRUD change requests'],
    ['reviews:decide', 'reviews', 'decide', 'Approve or Deny CRUD change requests with comments'],
    ['reviews:suggest', 'reviews', 'suggest', 'Recommend facility/directory updates to GIS Editor'],
    ['changes:publish', 'changes', 'publish', 'Publish approved changes or direct Admin edits to live DB'],
    ['users:view', 'users', 'view', 'View internal user directory and approval statuses'],
    ['users:approve_assign', 'users', 'approve_assign', 'Approve or deny user sign-ups and assign roles/offices/duties'],
    ['users:manage_roles', 'users', 'manage_roles', 'Edit user roles, station scopes, and active status'],
    ['rbac:switch_role', 'rbac', 'switch_role', 'Switch active effective role on the same overseer account'],
    ['system:reconcile_assets', 'system', 'reconcile_assets', 'Reconcile disk .webp assets with MySQL tables']
];

const ROLE_PERMISSION_MAP = {
    visitor: ['map:view_public'],
    reviewer: [
        'map:view_public', 'dashboard:view',
        'buildings:read', 'offices:read', 'plots:read',
        'reviews:view', 'reviews:decide', 'reviews:suggest'
    ],
    gis_editor: [
        'map:view_public', 'dashboard:view',
        'station:edit_pin',
        'buildings:read', 'buildings:draft_change',
        'offices:read', 'offices:draft_change',
        'plots:read', 'plots:draft_change', 'plots:split_merge',
        'editors:use_visual',
        'reviews:view'
    ],
    administrator: [
        'map:view_public', 'dashboard:view', 'audit:view', 'logins:view',
        'buildings:read', 'offices:read', 'plots:read',
        'reviews:view', 'reviews:suggest', 'changes:publish',
        'users:view', 'users:approve_assign', 'users:manage_roles',
        'system:reconcile_assets'
    ],
    super_admin: PERMISSION_DEFS.map(p => p[0])
};

const VALID_STATIONS = new Set(['lares', 'qares', 'rares', 'cares']);
const SPECIAL_CHARS_REGEX = /[@$!%*?&]/;

/**
 * Enforce the 4 FarmVault/iGUIDE unique password rules plus personal-data anti-reuse checks.
 */
function validateUniquePassword(password, { email = '', firstName = '', lastName = '' } = {}) {
    const pw = String(password || '');
    const checks = {
        minLength: pw.length >= 10,
        uppercase: /[A-Z]/.test(pw),
        number: /[0-9]/.test(pw),
        special: SPECIAL_CHARS_REGEX.test(pw),
        noSpaces: !/\s/.test(pw)
    };
    if (!checks.noSpaces) {
        return { valid: false, checks, error: 'Password cannot contain spaces.' };
    }
    if (!checks.minLength || !checks.uppercase || !checks.number || !checks.special) {
        return {
            valid: false,
            checks,
            error: 'Password must be 10+ characters with at least 1 uppercase letter, 1 number, and 1 special character (@$!%*?&).'
        };
    }
    const lowerPw = pw.toLowerCase();
    const localPart = String(email || '').split('@')[0].trim().toLowerCase();
    if (localPart && localPart.length >= 4 && lowerPw.includes(localPart)) {
        return { valid: false, checks, error: 'Choose a unique password that does not contain your email address.' };
    }
    const fn = String(firstName || '').trim().toLowerCase();
    const ln = String(lastName || '').trim().toLowerCase();
    if ((fn && fn.length >= 3 && lowerPw.includes(fn)) || (ln && ln.length >= 3 && lowerPw.includes(ln))) {
        return { valid: false, checks, error: 'Choose a unique password that does not include your first or last name.' };
    }
    return { valid: true, checks, error: null };
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

/**
 * Initialize normalized RBAC tables, user approval/profile fields, login history,
 * notifications, plot history, and facility_status columns cleanly (idempotent).
 */
async function initRbacSchemaAndSeed(query) {
    // 1. Ensure `admin_users` exists with full identity, approval & profile columns
    await query(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username_sha256 CHAR(64) NOT NULL UNIQUE,
            password_sha256 VARCHAR(255) NOT NULL,
            role VARCHAR(50) DEFAULT 'super_admin',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const userCols = await query(`SHOW COLUMNS FROM admin_users`);
    const uCols = new Set((userCols || []).map(c => c.Field));
    const userMigrations = [
        ['email', 'ALTER TABLE admin_users ADD COLUMN email VARCHAR(190) NULL UNIQUE'],
        ['full_name', 'ALTER TABLE admin_users ADD COLUMN full_name VARCHAR(150) NULL'],
        ['first_name', 'ALTER TABLE admin_users ADD COLUMN first_name VARCHAR(80) NULL'],
        ['middle_name', 'ALTER TABLE admin_users ADD COLUMN middle_name VARCHAR(80) NULL'],
        ['last_name', 'ALTER TABLE admin_users ADD COLUMN last_name VARCHAR(80) NULL'],
        ['job_title', 'ALTER TABLE admin_users ADD COLUMN job_title VARCHAR(120) NULL'],
        ['station_id', 'ALTER TABLE admin_users ADD COLUMN station_id VARCHAR(32) NULL'],
        ['office_name', 'ALTER TABLE admin_users ADD COLUMN office_name VARCHAR(150) NULL'],
        ['responsibilities', 'ALTER TABLE admin_users ADD COLUMN responsibilities TEXT NULL'],
        ['approval_status', "ALTER TABLE admin_users ADD COLUMN approval_status ENUM('pending','approved','not_approved') NOT NULL DEFAULT 'approved'"],
        ['rejection_reason', 'ALTER TABLE admin_users ADD COLUMN rejection_reason TEXT NULL'],
        ['approved_by', 'ALTER TABLE admin_users ADD COLUMN approved_by VARCHAR(190) NULL'],
        ['approved_at', 'ALTER TABLE admin_users ADD COLUMN approved_at DATETIME NULL'],
        ['last_login_at', 'ALTER TABLE admin_users ADD COLUMN last_login_at DATETIME NULL'],
        ['otp_hash', 'ALTER TABLE admin_users ADD COLUMN otp_hash CHAR(64) NULL'],
        ['otp_expires_at', 'ALTER TABLE admin_users ADD COLUMN otp_expires_at DATETIME NULL'],
        ['otp_attempts', 'ALTER TABLE admin_users ADD COLUMN otp_attempts TINYINT NOT NULL DEFAULT 0'],
        ['is_active', 'ALTER TABLE admin_users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1'],
        ['ui_preferences_json', 'ALTER TABLE admin_users ADD COLUMN ui_preferences_json TEXT NULL'],
        ['created_at', 'ALTER TABLE admin_users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP']
    ];
    for (const [col, ddl] of userMigrations) {
        if (!uCols.has(col)) {
            await query(ddl).catch(() => {});
        }
    }
    await query(`ALTER TABLE admin_users MODIFY COLUMN password_sha256 VARCHAR(255) NOT NULL`).catch(() => {});

    // Retain ONLY Super Admin ejlayola@gmail.com in initial seed (remove temp pre-seeded reviewer rows)
    const envUserSha = (process.env.ADMIN_USERNAME_SHA256 || (process.env.ADMIN_USERNAME ? sha256Hex(process.env.ADMIN_USERNAME) : '')).toLowerCase();
    const envPassSha = (process.env.ADMIN_PASSWORD_SHA256 || (process.env.ADMIN_PASSWORD ? sha256Hex(process.env.ADMIN_PASSWORD) : '')).toLowerCase();
    const superEmail = (process.env.ADMIN_EMAIL || 'ejlayola@gmail.com').trim().toLowerCase();
        if (envUserSha && envPassSha) {
        await query(`
            INSERT INTO admin_users (id, username_sha256, password_sha256, email, full_name, first_name, middle_name, last_name, job_title, role, station_id, approval_status, is_active)
            VALUES (1, ?, ?, ?, 'Earth Jeune Layola', 'Earth Jeune', NULL, 'Layola', 'Computer Programmer I', 'super_admin', 'all', 'approved', 1)
            ON DUPLICATE KEY UPDATE
                username_sha256 = VALUES(username_sha256),
                password_sha256 = VALUES(password_sha256),
                email = COALESCE(email, VALUES(email)),
                role = 'super_admin',
                approval_status = 'approved',
                is_active = 1
        `, [envUserSha, envPassSha, superEmail]);
    }
    await query(`
        UPDATE admin_users
        SET email = ?,
            full_name = CASE
                WHEN full_name IS NULL OR TRIM(full_name) = '' OR full_name IN ('MIS Administrator', 'Super Admin Overseer')
                    THEN 'Earth Jeune Layola'
                ELSE full_name
            END,
            first_name = 'Earth Jeune',
            middle_name = NULL,
            last_name = COALESCE(NULLIF(TRIM(last_name), ''), 'Layola'),
            job_title = COALESCE(NULLIF(TRIM(job_title), ''), 'Computer Programmer I'),
            station_id = 'all',
            role = 'super_admin',
            approval_status = 'approved',
            is_active = 1
        WHERE id = 1
    `, [superEmail]).catch(() => {});

    // Purge any pre-seeded temp reviewer email so future accounts enter strictly via Sign Up -> Approval
    const tempEmail = (process.env.TEMP_REVIEWER_EMAIL || 'jeuneastre@gmail.com').trim().toLowerCase();
    if (tempEmail && tempEmail !== superEmail) {
        await query(`DELETE FROM admin_users WHERE id != 1 AND LOWER(email) = ?`, [tempEmail]).catch(() => {});
    }

    // 2. Normalized RBAC tables: `roles`, `permissions`, `role_permissions`, `user_roles`
    await query(`
        CREATE TABLE IF NOT EXISTS roles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            description VARCHAR(255) NULL,
            color_hex VARCHAR(20) DEFAULT '#10b981',
            is_internal TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await query(`
        CREATE TABLE IF NOT EXISTS permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(100) NOT NULL UNIQUE,
            resource VARCHAR(60) NOT NULL,
            action VARCHAR(60) NOT NULL,
            description VARCHAR(255) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await query(`
        CREATE TABLE IF NOT EXISTS role_permissions (
            role_id INT NOT NULL,
            permission_id INT NOT NULL,
            PRIMARY KEY (role_id, permission_id),
            CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
            CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await query(`
        CREATE TABLE IF NOT EXISTS user_roles (
            user_id INT NOT NULL,
            role_id INT NOT NULL,
            station_scope VARCHAR(32) NOT NULL DEFAULT 'lares',
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, role_id),
            CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
            CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Seed roles & permissions idempotently
    for (const r of ROLE_DEFS) {
        await query(
            `INSERT INTO roles (slug, name, description, color_hex, is_internal) VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), color_hex = VALUES(color_hex), is_internal = VALUES(is_internal)`,
            [r.slug, r.name, r.description, r.color_hex, r.is_internal]
        );
    }
    for (const [code, resource, action, desc] of PERMISSION_DEFS) {
        await query(
            `INSERT INTO permissions (code, resource, action, description) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE resource = VALUES(resource), action = VALUES(action), description = VALUES(description)`,
            [code, resource, action, desc]
        );
    }

    const roleRows = await query(`SELECT id, slug FROM roles`);
    const permRows = await query(`SELECT id, code FROM permissions`);
    const roleIdBySlug = Object.fromEntries(roleRows.map(r => [r.slug, r.id]));
    const permIdByCode = Object.fromEntries(permRows.map(p => [p.code, p.id]));

    for (const [slug, codes] of Object.entries(ROLE_PERMISSION_MAP)) {
        const rid = roleIdBySlug[slug];
        if (!rid) continue;
        // Re-sync exact permission set per role
        await query(`DELETE FROM role_permissions WHERE role_id = ?`, [rid]);
        for (const code of codes) {
            const pid = permIdByCode[code];
            if (pid) {
                await query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [rid, pid]);
            }
        }
    }

    // Ensure super_admin id=1 is mapped in user_roles
    if (roleIdBySlug.super_admin) {
        await query(
            `INSERT INTO user_roles (user_id, role_id, station_scope) VALUES (1, ?, 'all')
             ON DUPLICATE KEY UPDATE station_scope = 'all'`,
            [roleIdBySlug.super_admin]
        ).catch(() => {});
    }

    // 3. Extend `admin_sessions` to support base_role + switched_role on the same overseer account
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
    const sCols = new Set((sessCols || []).map(c => c.Field));
    const sessMigrations = [
        ['user_id', 'ALTER TABLE admin_sessions ADD COLUMN user_id INT NULL'],
        ['role', "ALTER TABLE admin_sessions ADD COLUMN role VARCHAR(32) DEFAULT 'super_admin'"],
        ['base_role', "ALTER TABLE admin_sessions ADD COLUMN base_role VARCHAR(32) NULL"],
        ['switched_role', 'ALTER TABLE admin_sessions ADD COLUMN switched_role VARCHAR(32) NULL'],
        ['station_id', 'ALTER TABLE admin_sessions ADD COLUMN station_id VARCHAR(32) NULL'],
        ['email', 'ALTER TABLE admin_sessions ADD COLUMN email VARCHAR(190) NULL']
    ];
    for (const [col, ddl] of sessMigrations) {
        if (!sCols.has(col)) await query(ddl).catch(() => {});
    }
    await query(`DELETE FROM admin_sessions WHERE revoked = 1 OR expires_at < NOW()`).catch(() => {});

    // 4. `user_login_logs` table — never lose track of who signed in or was blocked
    await query(`
        CREATE TABLE IF NOT EXISTS user_login_logs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            email VARCHAR(190) NULL,
            full_name VARCHAR(150) NULL,
            role_used VARCHAR(50) NULL,
            acting_station VARCHAR(32) NULL,
            ip_address VARCHAR(64) NULL,
            user_agent VARCHAR(255) NULL,
            login_status ENUM('success','otp_sent','blocked_pending','blocked_not_approved','blocked_disabled','failed_password') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_login_user (user_id, created_at),
            INDEX idx_login_status (login_status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 5. `notifications` table — targeted in-app alerts linking directly to tabs & items
    await query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            recipient_user_id INT NOT NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(180) NOT NULL,
            message TEXT NOT NULL,
            station_id VARCHAR(32) NULL,
            link_tab VARCHAR(64) NULL,
            target_table VARCHAR(64) NULL,
            target_id VARCHAR(120) NULL,
            is_read TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notif_user_read (recipient_user_id, is_read, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 6. `plot_history` table — tracks split, merge, crop, status & zone transitions for singular vs combined plots
    await query(`
        CREATE TABLE IF NOT EXISTS plot_history (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            station_id VARCHAR(50) NOT NULL,
            plot_code VARCHAR(100) NOT NULL,
            plot_number VARCHAR(50) NULL,
            event_type ENUM('SPLIT','MERGE','CROP_CHANGE','STATUS_CHANGE','ZONE_RENAME','CREATED') NOT NULL,
            previous_zone_code VARCHAR(100) NULL,
            new_zone_code VARCHAR(100) NULL,
            summary VARCHAR(255) NOT NULL,
            details_json LONGTEXT NULL,
            changed_by VARCHAR(190) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ph_station_plot (station_id, plot_code, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 7. Extend `change_requests` with revision tracking & publish attribution
    await query(`
        CREATE TABLE IF NOT EXISTS change_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            station_id VARCHAR(32) NOT NULL,
            target_table VARCHAR(64) NOT NULL,
            target_id VARCHAR(120) NOT NULL,
            action VARCHAR(32) NOT NULL DEFAULT 'UPDATE',
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
    await query(`ALTER TABLE change_requests MODIFY COLUMN action VARCHAR(32) NOT NULL DEFAULT 'UPDATE'`).catch(() => {});
    const crCols = await query(`SHOW COLUMNS FROM change_requests`);
    const crColSet = new Set((crCols || []).map(c => c.Field));
    const crMigrations = [
        ['submitted_by_user_id', 'ALTER TABLE change_requests ADD COLUMN submitted_by_user_id INT NULL'],
        ['reviewed_by_user_id', 'ALTER TABLE change_requests ADD COLUMN reviewed_by_user_id INT NULL'],
        ['published_by_email', 'ALTER TABLE change_requests ADD COLUMN published_by_email VARCHAR(190) NULL'],
        ['published_at', 'ALTER TABLE change_requests ADD COLUMN published_at DATETIME NULL'],
        ['revision_count', 'ALTER TABLE change_requests ADD COLUMN revision_count INT NOT NULL DEFAULT 0']
    ];
    for (const [col, ddl] of crMigrations) {
        if (!crColSet.has(col)) await query(ddl).catch(() => {});
    }

    // 8. Add `facility_status` (`Existing` default, `Under Construction`, `Proposed`) to buildings & plots
    const bCols = await query(`SHOW COLUMNS FROM buildings`);
    if (!new Set((bCols || []).map(c => c.Field)).has('facility_status')) {
        await query(`ALTER TABLE buildings ADD COLUMN facility_status ENUM('Existing','Under Construction','Proposed') NOT NULL DEFAULT 'Existing' AFTER status`).catch(async () => {
            await query(`ALTER TABLE buildings ADD COLUMN facility_status ENUM('Existing','Under Construction','Proposed') NOT NULL DEFAULT 'Existing'`).catch(() => {});
        });
    }
    const pCols = await query(`SHOW COLUMNS FROM agricultural_plots`);
    if (!new Set((pCols || []).map(c => c.Field)).has('facility_status')) {
        await query(`ALTER TABLE agricultural_plots ADD COLUMN facility_status ENUM('Existing','Under Construction','Proposed') NOT NULL DEFAULT 'Existing' AFTER status`).catch(() => {});
    }

    const oCols = await query(`SHOW COLUMNS FROM building_offices`).catch(() => []);
    if (!new Set((oCols || []).map(c => c.Field)).has('room_number')) {
        await query(`ALTER TABLE building_offices ADD COLUMN room_number VARCHAR(64) NULL AFTER floor_or_room`).catch(async () => {
            await query(`ALTER TABLE building_offices ADD COLUMN room_number VARCHAR(64) NULL`).catch(() => {});
        });
    }

    // 9. Station UI metadata & persistent `settings.data_version`
    const stCols = await query(`SHOW COLUMNS FROM stations`);
    const stColSet = new Set((stCols || []).map(c => c.Field));
    if (!stColSet.has('welcome_tags')) await query(`ALTER TABLE stations ADD COLUMN welcome_tags TEXT NULL`).catch(() => {});
    if (!stColSet.has('quick_tags')) await query(`ALTER TABLE stations ADD COLUMN quick_tags TEXT NULL`).catch(() => {});
    if (!stColSet.has('filter_descriptions')) await query(`ALTER TABLE stations ADD COLUMN filter_descriptions TEXT NULL`).catch(() => {});

    await query(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('data_version', ?)`, [new Date().toISOString()]).catch(() => {});

    return { roleIdBySlug, permIdByCode };
}

/**
 * Create an RBAC permission cache + middleware factory backed by MySQL `roles`, `permissions`, `role_permissions`, `user_roles`.
 */
function createRbacManager(query, logAudit) {
    const permCache = new Map(); // cacheKey `${userId}:${effectiveRole}` -> { permissions: Set, stationScope, colorHex, expiresAt }
    const CACHE_TTL_MS = 2 * 60 * 1000;

    function invalidateRbacCache(userId = null) {
        if (userId === null || userId === undefined) {
            permCache.clear();
            return;
        }
        const prefix = `${userId}:`;
        for (const key of permCache.keys()) {
            if (key.startsWith(prefix)) permCache.delete(key);
        }
    }

    async function loadUserRbacContext(userId, overrideRoleSlug = null) {
        const key = `${userId}:${overrideRoleSlug || 'base'}`;
        const hit = permCache.get(key);
        if (hit && hit.expiresAt > Date.now()) {
            return hit;
        }

        // Load base role + station scope from user_roles (with admin_users fallback)
        const urRows = await query(`
            SELECT r.slug AS role_slug, r.name AS role_name, r.color_hex, ur.station_scope
            FROM user_roles ur
            JOIN roles r ON r.id = ur.role_id
            WHERE ur.user_id = ?
            LIMIT 1
        `, [userId]);

        let baseRole = urRows[0]?.role_slug;
        let stationScope = urRows[0]?.station_scope;
        if (!baseRole) {
            const [uRow] = await query(`SELECT role, station_id FROM admin_users WHERE id = ? LIMIT 1`, [userId]);
            baseRole = (uRow && uRow.role) ? uRow.role : 'visitor';
            stationScope = (baseRole === 'super_admin' || baseRole === 'administrator') ? 'all' : ((uRow && uRow.station_id) || 'lares');
        }

        const effectiveRole = (baseRole === 'super_admin' && overrideRoleSlug) ? overrideRoleSlug : baseRole;
        const [effRoleRow] = await query(`SELECT id, slug, name, color_hex FROM roles WHERE slug = ? LIMIT 1`, [effectiveRole]);
        const permRows = effRoleRow
            ? await query(`SELECT p.code FROM permissions p JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id = ?`, [effRoleRow.id])
            : [];

        // Crucial Policy: Super Admin maintains 'all' stations even when switched into GIS Editor or Reviewer
        const effectiveStationScope = (baseRole === 'super_admin' || effectiveRole === 'administrator')
            ? 'all'
            : (stationScope || 'lares');

        const [uMetaRow] = await query(`SELECT full_name, is_test FROM admin_users WHERE id = ? LIMIT 1`, [userId]).catch(() => []);

        const ctx = {
            baseRole,
            effectiveRole,
            roleName: effRoleRow ? effRoleRow.name : effectiveRole,
            colorHex: effRoleRow ? effRoleRow.color_hex : '#10b981',
            stationScope: effectiveStationScope,
            fullName: uMetaRow?.full_name || '',
            isTest: Number(uMetaRow?.is_test || 0) ? 1 : 0,
            permissions: new Set(permRows.map(p => p.code)),
            expiresAt: Date.now() + CACHE_TTL_MS
        };
        permCache.set(key, ctx);
        return ctx;
    }

    function resolveTargetStation(req, stationParam = null) {
        if (stationParam && VALID_STATIONS.has(stationParam)) return stationParam;
        const fromReq = req.params?.stationId || req.body?.station_id || req.body?.station || req.query?.station || '';
        const clean = String(fromReq).trim().toLowerCase();
        return VALID_STATIONS.has(clean) ? clean : null;
    }

    /**
     * Express Authorization Middleware factory: authorize('resource:action', { checkStation: true, stationParam: 'lares' })
     */
    function authorize(permissionCode, options = {}) {
        return async (req, res, next) => {
            try {
                if (!req.adminUser || !req.adminUser.userId) {
                    return res.status(401).json({ error: 'Unauthorized: Sign-in required.' });
                }
                const ctx = await loadUserRbacContext(req.adminUser.userId, req.adminUser.switchedRole || null);
                req.adminUser.baseRole = ctx.baseRole;
                req.adminUser.role = ctx.effectiveRole;
                req.adminUser.stationScope = ctx.stationScope;
                req.adminUser.stationId = ctx.stationScope === 'all' ? (req.adminUser.stationId || 'lares') : ctx.stationScope;
                req.adminUser.permissions = Array.from(ctx.permissions);
                req.adminUser.roleColor = ctx.colorHex;
                if (ctx.fullName) req.adminUser.fullName = ctx.fullName;
                req.adminUser.isTest = ctx.isTest || 0;

                if (permissionCode && !ctx.permissions.has(permissionCode)) {
                    logAudit('RBAC_FORBIDDEN', 'rbac', permissionCode, `403 denied ${req.adminUser.email || req.adminUser.userId} (role=${ctx.effectiveRole}) on ${req.method} ${req.originalUrl}`, req.adminUser.email || 'user');
                    return res.status(403).json({
                        error: `Access Denied: Missing permission "${permissionCode}" for role "${ctx.roleName}".`
                    });
                }

                if (options.checkStation) {
                    const targetStation = resolveTargetStation(req, options.stationParam || null) || options.defaultStation || null;
                    if (ctx.stationScope !== 'all' && targetStation && targetStation !== ctx.stationScope) {
                        logAudit('RBAC_STATION_FORBIDDEN', 'rbac', targetStation, `403 station lock blocked ${req.adminUser.email} (assigned=${ctx.stationScope}, attempted=${targetStation})`, req.adminUser.email || 'user');
                        return res.status(403).json({
                            error: `Forbidden: Your account is locked to DA-${ctx.stationScope.toUpperCase()} and cannot modify DA-${targetStation.toUpperCase()}.`
                        });
                    }
                }
                next();
            } catch (err) {
                console.error('[RBAC Authorize Error]:', err.message);
                return res.status(500).json({ error: 'Authorization check failed.' });
            }
        };
    }

    async function notifyUser(userId, payload) {
        if (!userId) return;
        try {
            await query(
                `INSERT INTO notifications (recipient_user_id, type, title, message, station_id, link_tab, target_table, target_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    payload.type || 'info',
                    payload.title || 'iGUIDE Notification',
                    payload.message || '',
                    payload.station_id || null,
                    payload.link_tab || null,
                    payload.target_table || null,
                    payload.target_id ? String(payload.target_id) : null
                ]
            );
        } catch (e) {
            console.warn('[Notifications] Insert warning:', e.message);
        }
    }

    async function findConcernedUsers({ roles = [], stationId = null } = {}) {
        if (!roles.length) return [];
        const placeholders = roles.map(() => '?').join(',');
        const rows = await query(`
            SELECT DISTINCT u.id, u.email, u.full_name, u.first_name, u.last_name, r.slug AS role_slug, ur.station_scope
            FROM admin_users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON r.id = ur.role_id
            WHERE u.is_active = 1
              AND u.approval_status = 'approved'
              AND r.slug IN (${placeholders})
              ${stationId ? `AND (ur.station_scope = 'all' OR ur.station_scope = ?)` : ''}
        `, stationId ? [...roles, stationId] : roles);
        return rows || [];
    }

    async function logLoginAttempt({ userId = null, email = null, fullName = null, roleUsed = null, actingStation = null, req = null, loginStatus }) {
        try {
            const rawIp = req ? (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || '') : '';
            const ip = String(rawIp).split(',')[0].trim().slice(0, 64);
            const ua = req ? String(req.headers['user-agent'] || '').slice(0, 250) : '';
            await query(
                `INSERT INTO user_login_logs (user_id, email, full_name, role_used, acting_station, ip_address, user_agent, login_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, email, fullName, roleUsed, actingStation, ip || null, ua || null, loginStatus]
            );
        } catch (e) {
            console.warn('[LoginLog] Notice:', e.message);
        }
    }

    return {
        invalidateRbacCache,
        loadUserRbacContext,
        authorize,
        resolveTargetStation,
        notifyUser,
        findConcernedUsers,
        logLoginAttempt
    };
}

module.exports = {
    ROLE_DEFS,
    PERMISSION_DEFS,
    ROLE_PERMISSION_MAP,
    VALID_STATIONS,
    validateUniquePassword,
    sha256Hex,
    hashPasswordScrypt,
    verifyPasswordScrypt,
    initRbacSchemaAndSeed,
    createRbacManager
};
