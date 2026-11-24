require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const phase1 = require('./database/phase1_safety');
const { computeGeometryDiff } = require('./database/geometry_diff');

const app = express();
const port = process.env.PORT || 8080;
const SERVER_BOOT_ID = Date.now().toString(36);
const APP_VERSION = '2.6.7';

app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)');
    next();
});

// Lightweight native gzip compression for JSON API payloads > 1KB (faster mobile loads, zero extra npm deps)
app.use((req, res, next) => {
    const acceptEnc = String(req.headers['accept-encoding'] || '').toLowerCase();
    if (!acceptEnc.includes('gzip')) return next();
    const origJson = res.json.bind(res);
    res.json = (body) => {
        try {
            const raw = JSON.stringify(body);
            if (!raw || raw.length < 1024 || res.headersSent) {
                return origJson(body);
            }
            zlib.gzip(Buffer.from(raw, 'utf8'), { level: 6 }, (err, zipped) => {
                if (err || res.headersSent) return origJson(body);
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Content-Encoding', 'gzip');
                res.setHeader('Vary', 'Accept-Encoding');
                res.setHeader('Content-Length', String(zipped.length));
                res.end(zipped);
            });
            return res;
        } catch (e) {
            return origJson(body);
        }
    };
    next();
});

app.use(cors());
app.use(express.json({ limit: '25mb' }));

function getLocalIpAddress() {
    try {
        const nets = os.networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    return net.address;
                }
            }
        }
    } catch (e) {}
    return '127.0.0.1';
}

// Initialize MySQL Database with bounded queue limit to prevent crash/memory exhaustion under burst traffic
const DB_POOL_LIMIT = Math.max(10, Number(process.env.DB_POOL_LIMIT || 25));
const DB_QUEUE_LIMIT = Math.max(50, Number(process.env.DB_QUEUE_LIMIT || 250));
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kiosk',
    waitForConnections: true,
    connectionLimit: DB_POOL_LIMIT,
    queueLimit: DB_QUEUE_LIMIT,
    connectTimeout: 10000
});
app.locals.getDbPoolConfig = () => ({ connectionLimit: DB_POOL_LIMIT, queueLimit: DB_QUEUE_LIMIT });

// Test connection and initialize table
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL database', err.message);
    } else {
        console.log('Connected to MySQL database "kiosk".');
        
        // Create tables
        const createSettingsTable = `
            CREATE TABLE IF NOT EXISTS settings (
                \`key\` VARCHAR(255) PRIMARY KEY,
                \`value\` TEXT
            )
        `;
        const createColorsTable = `
            CREATE TABLE IF NOT EXISTS building_colors (
                building_id VARCHAR(255) PRIMARY KEY,
                roof_color VARCHAR(50),
                number_color VARCHAR(50)
            )
        `;
        
        connection.query(createSettingsTable, (err) => {
            if (!err) {
                const defaultCoords = JSON.stringify([121.16643361549615, 13.958120847881375]);
                connection.query(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('kiosk_pin', ?)`, [defaultCoords]);
                const defaultQARESCoords = JSON.stringify([121.3713315, 13.9432268]);
                connection.query(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('qares_kiosk_pin', ?)`, [defaultQARESCoords]);
                connection.query(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('drawing_counter', '3')`);
                
                connection.query(createColorsTable, (err2) => {
                    if (err2) console.error('Error creating building_colors table:', err2);
                    connection.release();
                });
            } else {
                console.error('Error creating table:', err);
                connection.release();
            }
        });
    }
});

// Helper for queries
function query(sql, params) {
    return new Promise((resolve, reject) => {
        pool.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

// 10-Table MySQL RBAC, Onboarding & CRUD Router (instantiated early so geometry routes reuse RBAC)
const createAdminApiRouter = require('./database/admin_api');
const {
    bumpDataVersion,
    hasValidGeoGeometry,
    hasFiniteLngLat,
    computeGeoCentroid
} = require('./database/publish_engine');
const adminApiRouter = createAdminApiRouter(pool, __dirname);

function computeGeometryCentroidLngLat(geometry) {
    return computeGeoCentroid(geometry);
}

async function syncDrawnBuildingsToDb(stationId, features, actorEmail = 'draw.html') {
    const summary = { createdCodes: [], updatedCount: 0, promotedVisibleCount: 0 };
    if (!Array.isArray(features) || features.length === 0) return summary;
    const validStatuses = new Set(['Existing', 'Under Construction', 'Proposed']);
    try {
        for (const f of features) {
            const p = (f && f.properties) || {};
            const code = String(p.building_code || p.id || '').trim();
            if (!code || !hasValidGeoGeometry(f.geometry)) continue;
            const hasExplicitMc = Array.isArray(p.marker_coords) && p.marker_coords.length >= 2 && hasFiniteLngLat(p.marker_coords[0], p.marker_coords[1]);
            const mc = hasExplicitMc
                ? [Number(Number(p.marker_coords[0]).toFixed(8)), Number(Number(p.marker_coords[1]).toFixed(8))]
                : computeGeoCentroid(f.geometry);
            if (!mc) continue;

            const fpJson = JSON.stringify(f.geometry);
            const heightVal = (Number.isFinite(Number(p.height)) && Number(p.height) > 0) ? Number(p.height) : 5.0;
            const bName = String(p.name || code).trim() || code;

            const [existing] = await query(
                `SELECT id, name, category, pin_color, roof_color, is_visible, footprint_geojson, marker_lng, marker_lat
                 FROM buildings WHERE station_id = ? AND building_code = ? LIMIT 1`,
                [stationId, code]
            );

            if (existing) {
                const wasUnmappedDraft = Number(existing.is_visible) === 0
                    && (!existing.footprint_geojson || !String(existing.footprint_geojson).trim())
                    && !hasFiniteLngLat(existing.marker_lng, existing.marker_lat);
                const nextVisible = wasUnmappedDraft ? 1 : Number(existing.is_visible ?? 1);
                if (wasUnmappedDraft) summary.promotedVisibleCount++;

                const nextName = (existing.name === code && bName !== code) ? bName : existing.name;
                if (stationId === 'qares') {
                    const nextCat = p.category || p.filter_type || existing.category || 'Buildings';
                    const nextPin = p.color || p.user_color || existing.pin_color || '#ef4444';
                    const nextRoof = p.roof_color || p.user_roof_color || existing.roof_color || '#334155';
                    await query(
                        `UPDATE buildings SET name = ?, category = ?, pin_color = ?, roof_color = ?, marker_lng = ?, marker_lat = ?, footprint_geojson = ?, height = ?, is_visible = ? WHERE id = ?`,
                        [nextName, nextCat, nextPin, nextRoof, mc[0], mc[1], fpJson, heightVal, nextVisible, existing.id]
                    );
                } else {
                    await query(
                        `UPDATE buildings SET name = ?, marker_lng = ?, marker_lat = ?, footprint_geojson = ?, height = ?, is_visible = ? WHERE id = ?`,
                        [nextName, mc[0], mc[1], fpJson, heightVal, nextVisible, existing.id]
                    );
                }
                summary.updatedCount++;
            } else {
                const defaultSection = stationId === 'qares' ? 'Tiaong Compound' : (stationId === 'rares' ? 'Tanay Compound' : 'Compound');
                const defaultPin = stationId === 'qares' ? '#ef4444' : (stationId === 'rares' ? '#22c55e' : '#10b981');
                const bCat = String(p.category || p.filter_type || (stationId === 'qares' ? 'Buildings' : 'infrastructure')).trim();
                const bType = String(p.type || p.type_label || (stationId === 'lares' ? 'Infrastructure Facility' : 'Station Facility')).trim();
                const bPin = p.color || p.pin_color || defaultPin;
                const bRoof = p.roof_color || p.roofColor || '#334155';
                const bDesc = String(p.description || '').trim();
                const isSub = (p.isSubPlot || /^plot1[78]_|^plot22_/.test(code)) ? 1 : 0;
                const hasMkr = (p.hasMarker === false || isSub) ? 0 : 1;
                const fStatus = validStatuses.has(p.facility_status) ? p.facility_status : 'Existing';

                await query(
                    `INSERT INTO buildings (
                        station_id, building_code, building_num, name, category, type_label, section,
                        icon, pin_color, roof_color, description, marker_lng, marker_lat,
                        footprint_geojson, height, is_subplot, has_marker, is_visible, facility_status
                    ) VALUES (?, ?, NULL, ?, ?, ?, ?, '🏢', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                    [stationId, code, bName, bCat, bType, defaultSection, bPin, bRoof, bDesc, mc[0], mc[1], fpJson, heightVal, isSub, hasMkr, fStatus]
                );
                summary.createdCodes.push(code);
            }
        }

        if (summary.createdCodes.length > 0 || summary.promotedVisibleCount > 0) {
            try {
                await query(
                    `INSERT INTO admin_audit_logs (admin_username, action, target_table, target_id, summary) VALUES (?, 'SYNC_DRAWINGS_TO_DB', 'buildings', ?, ?)`,
                    [
                        actorEmail || 'draw.html',
                        stationId,
                        `Synced draw.html -> MySQL (${stationId.toUpperCase()}): ${summary.createdCodes.length} created [${summary.createdCodes.slice(0, 6).join(', ')}], ${summary.updatedCount} updated`
                    ]
                );
            } catch (_) {}
        }

        await bumpDataVersion(query);
        if (typeof adminApiRouter.invalidatePublicCache === 'function') {
            adminApiRouter.invalidatePublicCache(`draw-sync-${stationId}`);
        }
    } catch (err) {
        console.warn(`[${stationId.toUpperCase()}] Non-fatal DB building sync warning:`, err.message);
    }
    return summary;
}
const requireVisualEditor = (stationParam = null, defaultStation = null) => [
    adminApiRouter.authenticateSession,
    adminApiRouter.authorize('editors:use_visual', { checkStation: true, stationParam, defaultStation }),
    (req, res, next) => {
        res.on('finish', () => {
            if (res.statusCode < 200 || res.statusCode >= 300) return;
            if (typeof adminApiRouter.notifyVisualEditorSaved !== 'function') return;

            const p = String(req.path || '').toLowerCase();
            const body = req.body || {};
            const feats = Array.isArray(body.features) ? body.features : null;
            const st = String(
                stationParam ||
                (req.query && req.query.station) ||
                body.station ||
                body.station_id ||
                (req.adminUser && req.adminUser.stationId) ||
                defaultStation ||
                'lares'
            ).toLowerCase();
            const actorEmail = (req.adminUser && req.adminUser.email) || 'GIS Editor';
            const actorUserId = (req.adminUser && req.adminUser.userId) || null;

            let editorLabel = 'Visual Geometry Editor';
            let targetTable = 'geometry';
            let summaryText = '';

            if (p.includes('/roads')) {
                editorLabel = 'Roads & Entrances';
                targetTable = 'roads';
                const roadCnt = feats ? feats.filter(f => f && f.geometry && f.geometry.type === 'LineString').length : 0;
                const entCnt = feats ? feats.filter(f => f && f.geometry && f.geometry.type === 'Point').length : 0;
                summaryText = `${actorEmail} saved ${roadCnt} road path${roadCnt === 1 ? '' : 's'} & ${entCnt} entrance${entCnt === 1 ? '' : 's'} in Road Drawer.`;
            } else if (p.includes('/buildings')) {
                const ref = String(req.headers.referer || '').toLowerCase();
                const isPill = ref.includes('pill_adjust');
                editorLabel = isPill ? 'Map Pills & Labels' : 'Building Footprints';
                targetTable = 'buildings';
                summaryText = `${actorEmail} saved ${feats ? feats.length : 0} ${isPill ? 'building label/pill positions' : 'building footprints'} for DA-${st.toUpperCase()}.`;
            } else if (p.includes('/plots')) {
                editorLabel = 'Agricultural Plot Boundaries';
                targetTable = 'agricultural_plots';
                summaryText = `${actorEmail} saved ${feats ? feats.length : 0} agricultural plot polygons for DA-${st.toUpperCase()}.`;
            } else if (p.includes('/trees')) {
                editorLabel = '3D Trees & Vegetation';
                targetTable = 'trees';
                summaryText = `${actorEmail} saved ${feats ? feats.length : 0} tree placements for DA-${st.toUpperCase()}.`;
            } else if (p.includes('/boundary')) {
                editorLabel = 'Station Campus Boundary';
                targetTable = 'stations';
                summaryText = `${actorEmail} updated the campus perimeter boundary for DA-${st.toUpperCase()}.`;
            } else if (p.includes('/pin')) {
                editorLabel = 'Kiosk "You Are Here" Pin';
                targetTable = 'stations';
                summaryText = `${actorEmail} updated the Kiosk "You Are Here" pin location for DA-${st.toUpperCase()}.`;
            } else if (p.includes('/drone-offset')) {
                editorLabel = 'Aerial Orthophoto Calibration';
                targetTable = 'stations';
                summaryText = `${actorEmail} updated the aerial drone overlay alignment for DA-${st.toUpperCase()}.`;
            } else if (p.includes('/colors')) {
                editorLabel = 'Building Color Palette';
                targetTable = 'buildings';
                summaryText = `${actorEmail} updated building pin/roof colors for DA-${st.toUpperCase()}.`;
            }

            adminApiRouter.notifyVisualEditorSaved({
                stationId: st,
                editorLabel,
                targetTable,
                actorEmail,
                actorUserId,
                summaryText,
                req
            });

            if (!req._mapEditorQueuedForPublish) {
                const actorMeta = phase1.formatActorAuditMeta(req.adminUser || { email: actorEmail, userId: actorUserId });
                phase1.recordEntityVersion(query, {
                    stationId: st,
                    targetTable,
                    targetId: p || editorLabel,
                    versionNum: 1,
                    action: 'MAP_EDITOR_SAVE',
                    summary: summaryText,
                    snapshot: req.body || {},
                    source: 'map_editor',
                    adminUser: req.adminUser || { email: actorEmail, userId: actorUserId }
                }).catch(() => {});
                query(
                    `INSERT INTO admin_audit_logs (
                        admin_username, action, target_table, target_id, summary,
                        actor_user_id, actor_display_name, actor_base_role, actor_effective_role, acting_label, is_test
                     ) VALUES (?, 'MAP_EDITOR_SAVE', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        actorMeta.email, targetTable, p || st, summaryText,
                        actorMeta.userId, actorMeta.displayName, actorMeta.baseRole,
                        actorMeta.effectiveRole, actorMeta.actingLabel, actorMeta.isTest
                    ]
                ).catch(() => {});
            }
        });
        next();
    }
];

const requireDiskGeometryWrite = (stationParam = null, defaultStation = null) => [
    ...requireVisualEditor(stationParam, defaultStation),
    async (req, res, next) => {
        if (process.env.LOCK_STATIC_DISK_EDITORS === '1') {
            return res.status(403).json({
                error: 'Static disk geometry editing is locked in live production (LOCK_STATIC_DISK_EDITORS=1). Edit geometry locally and deploy via Git.'
            });
        }
        try {
            const st = String(stationParam || req.query?.station || req.body?.station || defaultStation || 'lares').toLowerCase();
            const rows = await query(`SELECT require_publish_for_map_editors FROM stations WHERE station_id = ? LIMIT 1`, [st]);
            const gateOn = Number(rows?.[0]?.require_publish_for_map_editors || 0) === 1;
            const hasDirectPub = Array.isArray(req.adminUser?.permissions) && req.adminUser.permissions.includes('changes:publish');
            if (gateOn && !hasDirectPub) {
                req._mapEditorQueuedForPublish = true;
                const actor = phase1.formatActorAuditMeta(req.adminUser);
                const summary = `Map editor update (${req.path}) for DA-${st.toUpperCase()}`;
                const ins = await query(
                    `INSERT INTO change_requests (
                        station_id, target_table, target_id, action, summary,
                        previous_json, payload_json, status,
                        submitted_by_email, submitted_by_user_id, submitted_by_name,
                        actor_base_role, actor_effective_role
                     ) VALUES (?, 'map_geometry', ?, 'UPDATE', ?, NULL, ?, 'approved', ?, ?, ?, ?, ?)`,
                    [
                        st, req.path, summary, JSON.stringify(req.body || {}),
                        actor.email, actor.userId, actor.displayName,
                        actor.baseRole, actor.effectiveRole
                    ]
                );
                await query(
                    `INSERT INTO admin_audit_logs (
                        admin_username, action, target_table, target_id, summary,
                        actor_user_id, actor_display_name, actor_base_role, actor_effective_role, acting_label, is_test
                     ) VALUES (?, 'MAP_EDITOR_QUEUED', 'map_geometry', ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        actor.email, String(ins.insertId), `Queued ${summary} for Administrator publish`,
                        actor.userId, actor.displayName, actor.baseRole,
                        actor.effectiveRole, actor.actingLabel, actor.isTest
                    ]
                ).catch(() => {});
                return res.json({
                    success: true,
                    queuedForPublish: true,
                    changeRequestId: ins.insertId,
                    message: 'Map editor changes queued for Administrator publish.'
                });
            }
        } catch (_) { }
        next();
    }
];

// API endpoint to get the "You Are Here" pin (supports ?station=lares or ?station=qares)
app.get('/api/pin', async (req, res) => {
    const station = req.query.station;
    const isQares = (station === 'qares');
    const key = isQares ? 'qares_kiosk_pin' : 'kiosk_pin';
    const fallbackFile = isQares ? 'qares_pin.json' : 'pin.json';
    const defaultCoords = isQares ? [121.3713315, 13.9432268] : [121.16643361549615, 13.958120847881375];

    try {
        const rows = await query(`SELECT \`value\` FROM settings WHERE \`key\` = ?`, [key]);
        if (rows.length > 0) {
            return res.json({ coordinates: JSON.parse(rows[0].value), station: isQares ? 'qares' : 'lares' });
        }
    } catch (err) {}

    try {
        const filePath = path.join(__dirname, fallbackFile);
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.coordinates) return res.json({ coordinates: data.coordinates, station: isQares ? 'qares' : 'lares' });
        }
    } catch (e) {}

    res.json({ coordinates: defaultCoords, station: isQares ? 'qares' : 'lares' });
});

// Dedicated endpoint to get QARES kiosk pin
app.get('/api/qares/pin', async (req, res) => {
    try {
        const rows = await query(`SELECT \`value\` FROM settings WHERE \`key\` = 'qares_kiosk_pin'`);
        if (rows.length > 0) {
            return res.json({ coordinates: JSON.parse(rows[0].value), station: 'qares' });
        }
    } catch (err) {}

    try {
        const filePath = path.join(__dirname, 'qares_pin.json');
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.coordinates) return res.json({ coordinates: data.coordinates, station: 'qares' });
        }
    } catch (e) {}

    res.json({ coordinates: [121.3713315, 13.9432268], station: 'qares' });
});

// Dedicated endpoint to get RARES kiosk pin
app.get('/api/rares/pin', async (req, res) => {
    try {
        const rows = await query(`SELECT \`value\` FROM settings WHERE \`key\` = 'rares_kiosk_pin'`);
        if (rows.length > 0) {
            return res.json({ coordinates: JSON.parse(rows[0].value), station: 'rares' });
        }
    } catch (err) {}

    try {
        const filePath = path.join(__dirname, 'rares_pin.json');
        if (fs.existsSync(filePath)) {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.coordinates) return res.json({ coordinates: data.coordinates, station: 'rares' });
        }
    } catch (e) {}

    res.json({ coordinates: [121.3393, 14.5750], station: 'rares' });
});

// API endpoint to update the "You Are Here" pin (supports station in body or query)
app.post('/api/pin', ...requireVisualEditor(null, 'lares'), async (req, res) => {
    const coords = req.body.coordinates;
    const station = req.body.station || req.query.station;
    const isQares = (station === 'qares');
    const key = isQares ? 'qares_kiosk_pin' : 'kiosk_pin';
    const fallbackFile = isQares ? 'qares_pin.json' : 'pin.json';

    if (!coords || !Array.isArray(coords) || coords.length !== 2) {
        return res.status(400).json({ error: 'Invalid coordinates format. Expected [lng, lat]' });
    }
    
    try {
        await query(
            `INSERT INTO settings (\`key\`, \`value\`) VALUES (?, ?) 
             ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, 
            [key, JSON.stringify(coords)]
        );
    } catch (err) {
        console.warn('Notice: Could not persist pin to DB, using JSON fallback:', err.message);
    }

    try {
        fs.writeFileSync(path.join(__dirname, fallbackFile), JSON.stringify({ station: isQares ? 'qares' : 'lares', coordinates: coords }, null, 2), 'utf8');
    } catch (e) {}

    res.json({ success: true, coordinates: coords, station: isQares ? 'qares' : 'lares' });
});

// Dedicated endpoint to update QARES kiosk pin
app.post('/api/qares/pin', ...requireVisualEditor('qares'), async (req, res) => {
    const coords = req.body.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length !== 2) {
        return res.status(400).json({ error: 'Invalid coordinates format. Expected [lng, lat]' });
    }

    try {
        await query(
            `INSERT INTO settings (\`key\`, \`value\`) VALUES ('qares_kiosk_pin', ?) 
             ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, 
            [JSON.stringify(coords)]
        );
    } catch (err) {
        console.warn('Notice: Could not persist QARES pin to DB, using JSON fallback:', err.message);
    }

    try {
        fs.writeFileSync(path.join(__dirname, 'qares_pin.json'), JSON.stringify({ station: 'qares', coordinates: coords }, null, 2), 'utf8');
    } catch (e) {}

    res.json({ success: true, coordinates: coords, station: 'qares' });
});

// Dedicated endpoint to update RARES kiosk pin
app.post('/api/rares/pin', ...requireVisualEditor('rares'), async (req, res) => {
    const coords = req.body.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length !== 2) {
        return res.status(400).json({ error: 'Invalid coordinates format. Expected [lng, lat]' });
    }

    try {
        await query(
            `INSERT INTO settings (\`key\`, \`value\`) VALUES ('rares_kiosk_pin', ?) 
             ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, 
            [JSON.stringify(coords)]
        );
    } catch (err) {
        console.warn('Notice: Could not persist RARES pin to DB, using JSON fallback:', err.message);
    }

    try {
        fs.writeFileSync(path.join(__dirname, 'rares_pin.json'), JSON.stringify({ station: 'rares', coordinates: coords }, null, 2), 'utf8');
    } catch (e) {}

    console.log(`[RARES] Saved Kiosk Pin to [${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}]`);
    res.json({ success: true, coordinates: coords, station: 'rares' });
});

// API endpoint to get drone orthomosaic calibration offset
app.get('/api/drone-offset', async (req, res) => {
    try {
        const rows = await query("SELECT `value` FROM settings WHERE `key` = 'drone_offset'");
        if (rows && rows.length > 0) {
            return res.json(JSON.parse(rows[0].value));
        }
    } catch (err) {}

    try {
        const offsetFile = path.join(__dirname, 'drone_offset.json');
        if (fs.existsSync(offsetFile)) {
            const data = JSON.parse(fs.readFileSync(offsetFile, 'utf8'));
            return res.json(data);
        }
    } catch (e) {}

    res.json({ dx: 0, dy: 0, autoApply: true });
});

// API endpoint to save drone orthomosaic calibration offset
app.post('/api/drone-offset', ...requireVisualEditor(null, 'lares'), async (req, res) => {
    const { dx, dy, autoApply } = req.body;
    const payload = {
        dx: (typeof dx === 'number' && !isNaN(dx)) ? dx : 0,
        dy: (typeof dy === 'number' && !isNaN(dy)) ? dy : 0,
        autoApply: autoApply !== false
    };

    try {
        await query(
            "INSERT INTO settings (`key`, `value`) VALUES ('drone_offset', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
            [JSON.stringify(payload)]
        );
    } catch (err) {}

    try {
        fs.writeFileSync(path.join(__dirname, 'drone_offset.json'), JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {}

    res.json({ success: true, ...payload });
});


let currentTunnelUrl = '';
let tunnelProcess = null;

// API endpoint to get the current public tunnel URL and local LAN URL
app.get('/api/tunnel', async (req, res) => {
    const localIp = getLocalIpAddress();
    const localUrl = `http://${localIp}:${port}`;

    if (currentTunnelUrl) {
        return res.json({ 
            url: currentTunnelUrl, 
            tunnelUrl: currentTunnelUrl, 
            localUrl: localUrl, 
            localIp: localIp 
        });
    }

    // Never return stale DB URLs if the tunnel is restarting; fallback to reliable local LAN URL
    res.json({ 
        url: localUrl, 
        tunnelUrl: null, 
        localUrl: localUrl, 
        localIp: localIp 
    });
});

// API endpoint to get building colors (with local colors.json fallback)
app.get('/api/colors', async (req, res) => {
    const fallbackPath = path.join(__dirname, 'colors.json');
    try {
        const rows = await query(`SELECT building_id, roof_color, number_color FROM building_colors`);
        const colorsObj = {};
        rows.forEach(row => {
            colorsObj[row.building_id] = {
                roof: row.roof_color,
                icon: row.number_color
            };
        });
        try {
            fs.writeFileSync(fallbackPath, JSON.stringify(colorsObj, null, 2), 'utf8');
        } catch (e) {}
        return res.json(colorsObj);
    } catch (err) {
        try {
            if (fs.existsSync(fallbackPath)) {
                const cached = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
                return res.json(cached);
            }
        } catch (e) {}
        return res.json({});
    }
});

// API endpoint to update building colors
app.post('/api/colors', ...requireVisualEditor(), async (req, res) => {
    const colors = req.body;
    const fallbackPath = path.join(__dirname, 'colors.json');
    try {
        fs.writeFileSync(fallbackPath, JSON.stringify(colors, null, 2), 'utf8');
    } catch (e) {}
    try {
        // Iterate through the colors object and upsert each into the building_colors table
        for (const [building_id, colorData] of Object.entries(colors)) {
            const roof = colorData.roof || null;
            const icon = colorData.icon || null;
            await query(
                `INSERT INTO building_colors (building_id, roof_color, number_color) VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE roof_color = VALUES(roof_color), number_color = VALUES(number_color)`, 
                [building_id, roof, icon]
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.json({ success: true, fallback: true });
    }
});

function readJsonFileSafe(absPath, fallback = { type: 'FeatureCollection', features: [] }) {
    try {
        if (fs.existsSync(absPath)) return JSON.parse(fs.readFileSync(absPath, 'utf8'));
    } catch (_) {}
    return fallback;
}

function readLaresBuildingsGeoSafe() {
    try {
        const filePath = path.join(__dirname, 'js', 'data', 'buildings.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const startMarker = 'export const LARES_DRAWINGS = ';
        const endMarker = 'export const KNOWN_BUILDING_NAMES';
        const startIndex = content.indexOf(startMarker);
        const nextIndex = content.indexOf(endMarker, startIndex);
        if (startIndex !== -1 && nextIndex !== -1) {
            const jsonPart = content.substring(startIndex + startMarker.length, content.lastIndexOf(';', nextIndex)).trim();
            return JSON.parse(jsonPart);
        }
    } catch (_) {}
    return readJsonFileSafe(path.join(__dirname, 'buildings.json'));
}

/**
 * Intercepts visual map editor saves for GIS Editors (or Super Admin requesting review)
 * and queues a feature-level diff Change Request for Station Reviewer approval.
 * Returns true if the request was handled (queued or no-op), false to proceed with direct write.
 */
async function maybeQueueVisualEditorForReview(req, res, { editorType, stationId, relFilePath, prevGeo, nextGeo }) {
    const user = req.adminUser || {};
    const effectiveRole = String(user.role || user.baseRole || '').toLowerCase();
    const explicitReview = req.headers['x-submit-for-review'] === '1' || req.body?._submitForReview === true;
    const mustQueue = effectiveRole !== 'super_admin' || explicitReview;
    if (!mustQueue) return false;

    const cleanNext = {
        type: 'FeatureCollection',
        ...(nextGeo.station ? { station: nextGeo.station } : {}),
        ...(nextGeo.name ? { name: nextGeo.name } : {}),
        features: Array.isArray(nextGeo.features) ? nextGeo.features : []
    };
    const diff = computeGeometryDiff(editorType, prevGeo, cleanNext);
    if (diff.totalChanges === 0) {
        res.json({ success: true, noChanges: true, queued: false, message: 'No geometry changes detected to submit.' });
        return true;
    }

    const targetId = `${diff.editorType}:${stationId}`;
    const summary = `${diff.summaryText} (DA-${stationId.toUpperCase()})`;
    const previousPayload = {
        editor_type: diff.editorType,
        station_id: stationId,
        file_path: relFilePath,
        feature_count: Array.isArray(prevGeo?.features) ? prevGeo.features.length : 0,
        geojson: prevGeo
    };
    const nextPayload = {
        editor_type: diff.editorType,
        station_id: stationId,
        file_path: relFilePath,
        feature_count: cleanNext.features.length,
        diff_summary: diff,
        geojson: cleanNext
    };

    const ins = await query(
        `INSERT INTO change_requests (
            station_id, target_table, target_id, action, summary,
            previous_json, payload_json, status, submitted_by, submitted_by_email, submitted_by_role
        ) VALUES (?, 'map_geometry', ?, 'UPDATE', ?, ?, ?, 'pending', ?, ?, ?)`,
        [
            stationId,
            targetId,
            summary,
            JSON.stringify(previousPayload),
            JSON.stringify(nextPayload),
            user.fullName || user.email || 'GIS Editor',
            user.email || 'editor',
            effectiveRole || 'gis_editor'
        ]
    );
    const crId = ins.insertId;

    // Notify assigned Station Reviewers & Super Admins in-app
    try {
        const recipients = await query(
            `SELECT id FROM admin_users WHERE is_active = 1 AND approval_status = 'approved'
             AND (role = 'super_admin' OR (role = 'reviewer' AND (station_id = ? OR station_id = 'all')))`,
            [stationId]
        );
        for (const r of recipients) {
            if (user.id && Number(r.id) === Number(user.id)) continue;
            await query(
                `INSERT INTO notifications (recipient_user_id, station_id, type, title, message, link_tab, target_table, target_id)
                 VALUES (?, ?, 'change_request', ?, ?, 'review-queue', 'map_geometry', ?)`,
                [
                    r.id,
                    stationId,
                    `Map Edit Pending Review — ${diff.editorTitle}`,
                    `${summary} (Request #${crId}) is ready for visual diff review.`,
                    String(crId)
                ]
            );
        }
    } catch (nErr) {
        console.warn('[MapGeometryQueue] Notification skipped:', nErr.message);
    }

    res.json({
        success: true,
        queued: true,
        published: false,
        changeRequestId: crId,
        editorType: diff.editorType,
        diffSummary: diff.summaryText,
        totalChanges: diff.totalChanges
    });
    return true;
}

// API endpoint to save updated roads.json directly from road drawer tool
app.post('/api/roads', ...requireDiskGeometryWrite('lares'), async (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.features) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        const prevGeo = readJsonFileSafe(path.join(__dirname, 'roads.json'));
        if (await maybeQueueVisualEditorForReview(req, res, { editorType: 'roads', stationId: 'lares', relFilePath: 'roads.json', prevGeo, nextGeo: data })) return;
        if (fs.existsSync('roads.json')) {
            fs.copyFileSync('roads.json', 'roads.backup.json');
            try {
                const bDir = path.join(__dirname, 'archive', 'backups');
                if (!fs.existsSync(bDir)) fs.mkdirSync(bDir, { recursive: true });
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                fs.copyFileSync('roads.json', path.join(bDir, `roads_backup_${ts}.json`));
            } catch (errBak) {}
        }
        fs.writeFileSync('roads.json', JSON.stringify(data, null, 2), 'utf8');
        console.log(`Saved roads.json with ${data.features.length} features.`);
        res.json({ success: true, count: data.features.length });
    } catch (err) {
        console.error('Error saving roads.json:', err);
        res.status(500).json({ error: err.message });
    }
});

// =========================================================================
// API ENDPOINTS FOR QARES (Quezon Agricultural Research & Experiment Station)
// =========================================================================
app.get('/api/qares/roads', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'qares_roads.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({ type: 'FeatureCollection', name: 'QARES Roads & Walkways', features: [] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/qares/roads', ...requireDiskGeometryWrite('qares'), async (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.features) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        const filePath = path.join(__dirname, 'qares_roads.json');
        const prevGeo = readJsonFileSafe(filePath);
        if (await maybeQueueVisualEditorForReview(req, res, { editorType: 'roads', stationId: 'qares', relFilePath: 'qares_roads.json', prevGeo, nextGeo: data })) return;
        if (fs.existsSync(filePath)) {
            try {
                const bDir = path.join(__dirname, 'archive', 'backups');
                if (!fs.existsSync(bDir)) fs.mkdirSync(bDir, { recursive: true });
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                fs.copyFileSync(filePath, path.join(bDir, `qares_roads_backup_${ts}.json`));
            } catch (e) {}
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[QARES] Saved qares_roads.json with ${data.features.length} features.`);
        res.json({ success: true, count: data.features.length });
    } catch (err) {
        console.error('Error saving qares_roads.json:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/qares/buildings', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'qares_buildings.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({ type: 'FeatureCollection', name: 'QARES Buildings', features: [] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/qares/buildings', ...requireDiskGeometryWrite('qares'), async (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.features) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        const filePath = path.join(__dirname, 'qares_buildings.json');
        const prevGeo = readJsonFileSafe(filePath);
        if (await maybeQueueVisualEditorForReview(req, res, { editorType: 'buildings', stationId: 'qares', relFilePath: 'qares_buildings.json', prevGeo, nextGeo: data })) return;
        if (fs.existsSync(filePath)) {
            try {
                const bDir = path.join(__dirname, 'archive', 'backups');
                if (!fs.existsSync(bDir)) fs.mkdirSync(bDir, { recursive: true });
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                fs.copyFileSync(filePath, path.join(bDir, `qares_buildings_backup_${ts}.json`));
            } catch (e) {}
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        const syncRes = await syncDrawnBuildingsToDb('qares', data.features, req.adminUser?.email);
        console.log(`[QARES] Saved qares_buildings.json with ${data.features.length} buildings (+${syncRes.createdCodes.length} created in MySQL).`);
        res.json({ success: true, count: data.features.length, createdCodes: syncRes.createdCodes, updatedCount: syncRes.updatedCount });
    } catch (err) {
        console.error('Error saving qares_buildings.json:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/qares/boundary', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'qares_boundary.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({ type: 'FeatureCollection', name: 'QARES Official Deeded Survey Boundaries', features: [] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/qares/boundary', ...requireDiskGeometryWrite('qares'), (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.features) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        const filePath = path.join(__dirname, 'qares_boundary.json');
        if (fs.existsSync(filePath)) {
            try {
                const bDir = path.join(__dirname, 'archive', 'backups');
                if (!fs.existsSync(bDir)) fs.mkdirSync(bDir, { recursive: true });
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                fs.copyFileSync(filePath, path.join(bDir, `qares_boundary_backup_${ts}.json`));
            } catch (e) {}
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[QARES] Saved qares_boundary.json with ${data.features.length} features.`);

        // Automatically sync QARES_MASK in js/data/geo.js
        updateQaresMaskInGeoJs(data);

        res.json({ success: true, count: data.features.length });
    } catch (err) {
        console.error('Error saving qares_boundary.json:', err);
        res.status(500).json({ error: err.message });
    }
});

function updateQaresMaskInGeoJs(boundaryGeoJson) {
    try {
        let front = null;
        let flint = null;
        for (const f of boundaryGeoJson.features) {
            const id = (f.properties && f.properties.id) || f.id;
            if (id === 'qares_front' && f.geometry && f.geometry.type === 'Polygon') {
                front = f.geometry.coordinates[0];
            }
            if (id === 'qares_flint' && f.geometry && f.geometry.type === 'Polygon') {
                flint = f.geometry.coordinates[0];
            }
        }
        if (!front || !flint) return;

        const bridgeEastNorth = [121.37061209525696, 13.944254361703344];
        const bridgeEastMid   = [121.3705593874083, 13.944142160808177];
        const bridgeWestNorth = [121.37047394506597, 13.94430713756418];
        const bridgeWestMid1  = [121.37042437050941, 13.944201606477387];
        const bridgeWestMid2  = [121.37042414140082, 13.944201113871262];

        function lineIntersect(p1, p2, p3, p4) {
            const xd = [p1[0] - p2[0], p3[0] - p4[0]];
            const yd = [p1[1] - p2[1], p3[1] - p4[1]];
            const div = xd[0] * yd[1] - xd[1] * yd[0];
            if (div === 0) return null;
            const d1 = p1[0] * p2[1] - p1[1] * p2[0];
            const d2 = p3[0] * p4[1] - p3[1] * p4[0];
            return [(d1 * xd[1] - xd[0] * d2) / div, (d1 * yd[1] - yd[0] * d2) / div];
        }

        const eastIntersect = lineIntersect(front[2], front[3], bridgeEastMid, bridgeEastNorth) || [121.37051705867479, 13.944052054016835];
        const westIntersect = lineIntersect(front[3], front[4], [121.37037, 13.94408], bridgeWestNorth) || [121.370380891412, 13.944103798967703];

        const hole = [
            front[0],
            front[1],
            front[2],
            eastIntersect,
            bridgeEastMid,
            bridgeEastNorth
        ];

        for (let i = 1; i < flint.length - 1; i++) {
            hole.push(flint[i]);
        }
        hole.push(flint[0]);

        hole.push(bridgeWestNorth);
        hole.push(bridgeWestMid1);
        hole.push(bridgeWestMid2);
        hole.push(westIntersect);

        for (let i = 4; i < front.length; i++) {
            hole.push(front[i]);
        }

        const maskObj = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
                        hole
                    ]
                },
                properties: {
                    station: 'qares',
                    description: 'DA-QARES Compound Vignette Mask with Walkway Bridge'
                }
            }]
        };

        const geoPath = path.join(__dirname, 'js', 'data', 'geo.js');
        if (fs.existsSync(geoPath)) {
            let geoContent = fs.readFileSync(geoPath, 'utf8');
            const maskRegex = /export const QARES_MASK = \{.*?\};/s;
            if (maskRegex.test(geoContent)) {
                geoContent = geoContent.replace(maskRegex, `export const QARES_MASK = ${JSON.stringify(maskObj)};`);
                fs.writeFileSync(geoPath, geoContent, 'utf8');
                console.log('[QARES] Automatically synced QARES_MASK in js/data/geo.js');
            }
        }
    } catch (e) {
        console.warn('[QARES] Notice updating geo.js mask:', e);
    }
}

app.get('/api/rares/buildings', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'rares_buildings.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({ type: 'FeatureCollection', station: 'rares', name: 'RARES Buildings', features: [] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/rares/buildings', ...requireDiskGeometryWrite('rares'), async (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.features) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        const filePath = path.join(__dirname, 'rares_buildings.json');
        const prevGeo = readJsonFileSafe(filePath);
        if (await maybeQueueVisualEditorForReview(req, res, { editorType: 'buildings', stationId: 'rares', relFilePath: 'rares_buildings.json', prevGeo, nextGeo: data })) return;
        if (fs.existsSync(filePath)) {
            try {
                const bDir = path.join(__dirname, 'archive', 'backups');
                if (!fs.existsSync(bDir)) fs.mkdirSync(bDir, { recursive: true });
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                fs.copyFileSync(filePath, path.join(bDir, `rares_buildings_backup_${ts}.json`));
            } catch (e) {}
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        const syncRes = await syncDrawnBuildingsToDb('rares', data.features, req.adminUser?.email);
        console.log(`[RARES] Saved rares_buildings.json with ${data.features.length} buildings (+${syncRes.createdCodes.length} created in MySQL).`);
        res.json({ success: true, count: data.features.length, createdCodes: syncRes.createdCodes, updatedCount: syncRes.updatedCount });
    } catch (err) {
        console.error('Error saving rares_buildings.json:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/rares/boundary', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'rares_boundary.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({ type: 'FeatureCollection', station: 'rares', name: 'DA-RARES Boundary', features: [] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/rares/boundary', ...requireDiskGeometryWrite('rares'), (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.features) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        const filePath = path.join(__dirname, 'rares_boundary.json');
        if (fs.existsSync(filePath)) {
            try {
                const bDir = path.join(__dirname, 'archive', 'backups');
                if (!fs.existsSync(bDir)) fs.mkdirSync(bDir, { recursive: true });
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                fs.copyFileSync(filePath, path.join(bDir, `rares_boundary_backup_${ts}.json`));
            } catch (e) {}
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[RARES] Saved rares_boundary.json with ${data.features.length} features.`);

        // Automatically sync RARES_MASK in js/data/geo.js
        updateRaresMaskInGeoJs(data);

        res.json({ success: true, count: data.features.length });
    } catch (err) {
        console.error('Error saving rares_boundary.json:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/rares/roads', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'rares_roads.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({ type: 'FeatureCollection', station: 'rares', name: 'DA-RARES Roads & Walkways', features: [] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/rares/roads', ...requireDiskGeometryWrite('rares'), async (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.features) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        const filePath = path.join(__dirname, 'rares_roads.json');
        const prevGeo = readJsonFileSafe(filePath);
        if (await maybeQueueVisualEditorForReview(req, res, { editorType: 'roads', stationId: 'rares', relFilePath: 'rares_roads.json', prevGeo, nextGeo: data })) return;
        if (fs.existsSync(filePath)) {
            try {
                const bDir = path.join(__dirname, 'archive', 'backups');
                if (!fs.existsSync(bDir)) fs.mkdirSync(bDir, { recursive: true });
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                fs.copyFileSync(filePath, path.join(bDir, `rares_roads_backup_${ts}.json`));
            } catch (e) {}
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[RARES] Saved rares_roads.json with ${data.features.length} features.`);
        res.json({ success: true, count: data.features.length });
    } catch (err) {
        console.error('Error saving rares_roads.json:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/rares/plots', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'rares_plots.json');
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({ type: 'FeatureCollection', station: 'rares', name: 'DA-RARES Agricultural Plots', features: [] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/rares/plots', ...requireDiskGeometryWrite('rares'), async (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.features) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        const filePath = path.join(__dirname, 'rares_plots.json');
        const prevGeo = readJsonFileSafe(filePath);
        if (await maybeQueueVisualEditorForReview(req, res, { editorType: 'plots', stationId: 'rares', relFilePath: 'rares_plots.json', prevGeo, nextGeo: data })) return;
        if (fs.existsSync(filePath)) {
            try {
                const bDir = path.join(__dirname, 'archive', 'backups');
                if (!fs.existsSync(bDir)) fs.mkdirSync(bDir, { recursive: true });
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                fs.copyFileSync(filePath, path.join(bDir, `rares_plots_backup_${ts}.json`));
            } catch (e) {}
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[RARES] Saved rares_plots.json with ${data.features.length} plots.`);
        res.json({ success: true, count: data.features.length });
    } catch (err) {
        console.error('Error saving rares_plots.json:', err);
        res.status(500).json({ error: err.message });
    }
});

function updateRaresMaskInGeoJs(boundaryGeoJson) {
    try {
        if (!boundaryGeoJson || !boundaryGeoJson.features || !boundaryGeoJson.features[0]) return;
        const coords = boundaryGeoJson.features[0].geometry.coordinates[0];
        if (!coords || !Array.isArray(coords)) return;

        const maskObj = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]],
                        coords
                    ]
                },
                properties: {
                    station: 'rares',
                    description: 'DA-RARES Compound Vignette Mask'
                }
            }]
        };

        const geoPath = path.join(__dirname, 'js', 'data', 'geo.js');
        if (fs.existsSync(geoPath)) {
            let geoContent = fs.readFileSync(geoPath, 'utf8');
            const maskRegex = /export const RARES_MASK = \{.*?\};/s;
            if (maskRegex.test(geoContent)) {
                geoContent = geoContent.replace(maskRegex, `export const RARES_MASK = ${JSON.stringify(maskObj)};`);
            } else {
                geoContent += `\nexport const RARES_MASK = ${JSON.stringify(maskObj)};\n`;
            }
            fs.writeFileSync(geoPath, geoContent, 'utf8');
            console.log('[RARES] Automatically synced RARES_MASK in js/data/geo.js');
        }
    } catch (e) {
        console.warn('[RARES] Notice updating geo.js mask:', e);
    }
}

function getTreesPathForStation(stationRaw) {
    const clean = String(stationRaw || 'lares').trim().toLowerCase();
    if (clean === 'qares') return { station: 'qares', file: path.join(__dirname, 'qares_trees.json'), backup: path.join(__dirname, 'qares_trees.backup.json') };
    if (clean === 'rares') return { station: 'rares', file: path.join(__dirname, 'rares_trees.json'), backup: path.join(__dirname, 'rares_trees.backup.json') };
    if (clean === 'cares') return { station: 'cares', file: path.join(__dirname, 'cares_trees.json'), backup: path.join(__dirname, 'cares_trees.backup.json') };
    return { station: 'lares', file: path.join(__dirname, 'trees.json'), backup: path.join(__dirname, 'trees.backup.json') };
}

// API endpoint to get station-scoped trees GeoJSON (defaults to DA-LARES trees.json)
app.get('/api/trees', (req, res) => {
    try {
        const rawStation = String(req.query.station || 'lares').trim().toLowerCase();
        if (!['lares', 'qares', 'rares', 'cares'].includes(rawStation)) {
            return res.status(400).json({ error: 'Invalid station parameter' });
        }
        const { station, file } = getTreesPathForStation(rawStation);
        if (fs.existsSync(file)) {
            const data = fs.readFileSync(file, 'utf8');
            const parsed = JSON.parse(data);
            return res.json(parsed);
        }
        return res.json({ type: 'FeatureCollection', station, features: [] });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// API endpoint to save station-scoped trees GeoJSON (RBAC + station-locked)
app.post('/api/trees', ...requireDiskGeometryWrite(null, 'lares'), async (req, res) => {
    try {
        const rawStation = String(req.body?.station_id || req.body?.station || req.query?.station || 'lares').trim().toLowerCase();
        if (!['lares', 'qares', 'rares', 'cares'].includes(rawStation)) {
            return res.status(400).json({ error: 'Invalid station identifier' });
        }
        const data = req.body;
        if (!data || !Array.isArray(data.features)) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        const { station, file, backup } = getTreesPathForStation(rawStation);
        const relFile = path.relative(__dirname, file).replace(/\\/g, '/');
        const prevGeo = readJsonFileSafe(file);
        if (await maybeQueueVisualEditorForReview(req, res, { editorType: 'trees', stationId: station, relFilePath: relFile, prevGeo, nextGeo: data })) return;
        if (fs.existsSync(file)) {
            fs.copyFileSync(file, backup);
        }
        const outPayload = { type: 'FeatureCollection', station, features: data.features };
        fs.writeFileSync(file, JSON.stringify(outPayload, null, 2), 'utf8');
        console.log(`Saved ${path.basename(file)} (${station}) with ${data.features.length} trees.`);
        return res.json({ success: true, station, count: data.features.length });
    } catch (err) {
        console.error('Error saving trees GeoJSON:', err);
        return res.status(500).json({ error: err.message });
    }
});

// API endpoint to get buildings GeoJSON from js/data/buildings.js
app.get('/api/buildings', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'js', 'data', 'buildings.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const startMarker = 'export const LARES_DRAWINGS = ';
        const startIndex = content.indexOf(startMarker);
        if (startIndex === -1) {
            return res.status(500).json({ error: 'Could not find LARES_DRAWINGS in buildings.js' });
        }
        const endMarker = 'export const KNOWN_BUILDING_NAMES';
        const nextIndex = content.indexOf(endMarker, startIndex);
        const jsonPart = content.substring(startIndex + startMarker.length, content.lastIndexOf(';', nextIndex)).trim();
        const data = JSON.parse(jsonPart);
        res.json(data);
    } catch (err) {
        console.error('Error fetching buildings:', err);
        res.status(500).json({ error: err.message });
    }
});

// API endpoint to save buildings GeoJSON directly to js/data/buildings.js and buildings.json
app.post('/api/buildings', ...requireDiskGeometryWrite('lares'), async (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.features) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        const prevGeo = readLaresBuildingsGeoSafe();
        if (await maybeQueueVisualEditorForReview(req, res, { editorType: 'buildings', stationId: 'lares', relFilePath: 'buildings.json', prevGeo, nextGeo: data })) return;
        
        // Automatically preserve has_3d_model: true for all bespoke 3D buildings
        const BUILDINGS_WITH_3D = new Set([
            'mis_rafis_building', 'tanco_hall_building', 'argosino_hall', 'canteen',
            'raed_building', 'guard_house', 'amad_building', 'pgrc_building',
            'prdp_building', 'lares_agricultural_supplies_storage', 'ored_building', 'admin_building', 'lares_building',
            'laboratory_building', 'f2c2_building', 'ild_building', 'seaguard_building',
            'corn/casava_building', 'rsbsa_building', 'tissue_culture_building',
            'rcpc_building', 'motorpool_barracks', 'rnd_building', 'rsl_building',
            'exit_guard_house_1', 'exit_guard_house_2', 'multi_purpose_administrative_building',
            'dorm', 'guest_house', 'mushroom_laboratory', 'warehouse_1', 'lares_farm_machinery_shed_1', 'lares_organic_fertilizer_storage', 'warehouse_3', 'warehouse_4', 'warehouse_5', 'warehouse_6', 'warehouse_7'
        ]);

        // Geo-centroid matching dictionary for known campus structures to prevent stale browser autosaves from corrupting facility identities
        const KNOWN_GEO_FACILITIES = [
            { id: 'admin_building', name: 'Admin Building', center: [121.166338, 13.958735], category: 'office', isSubPlot: false, hasMarker: true },
            { id: 'plot17_screenhouse_1', name: 'Plot 17 Screenhouse 1', center: [121.167294, 13.959152], category: 'trial_sites', isSubPlot: true, hasMarker: false },
            { id: 'plot17_screenhouse_2', name: 'Plot 17 Screenhouse 2', center: [121.167348, 13.959108], category: 'trial_sites', isSubPlot: true, hasMarker: false },
            { id: 'plot17_screenhouse_3', name: 'Plot 17 Screenhouse 3', center: [121.167370, 13.959051], category: 'trial_sites', isSubPlot: true, hasMarker: false },
            { id: 'plot17_screenhouse_4', name: 'Plot 17 Screenhouse 4', center: [121.167362, 13.958975], category: 'trial_sites', isSubPlot: true, hasMarker: false },
            { id: 'plot17_screenhouse_5', name: 'Plot 17 Screenhouse 5', center: [121.167424, 13.958847], category: 'trial_sites', isSubPlot: true, hasMarker: false },
            { id: 'plot18_greenhouse_complex', name: 'Plot 18 Research Greenhouse Complex', center: [121.167581, 13.959046], category: 'trial_sites', isSubPlot: true, hasMarker: false },
            { id: 'plot18_screenhouse_9', name: 'Screenhouse 9 & Potting Headhouse', center: [121.167742, 13.959223], category: 'trial_sites', isSubPlot: true, hasMarker: false },
            { id: 'plot18_screenhouse_9_headhouse', name: 'Screenhouse 9 Headhouse', center: [121.167711, 13.959295], category: 'trial_sites', isSubPlot: true, hasMarker: false },
            { id: 'plot22_water_tank', name: 'LARES Water Tank', center: [121.168991, 13.959770], category: 'infrastructure', isSubPlot: true, hasMarker: false },
            { id: 'plot22_comfort_room', name: 'Plot 22 Comfort Room', center: [121.168946, 13.959749], category: 'infrastructure', isSubPlot: true, hasMarker: false },
            { id: 'warehouse_1', name: 'LARES Synthetic Fertilizer Storage / LARES Pesticide Storage', center: [121.166837, 13.959600], category: 'infrastructure', isSubPlot: false, hasMarker: true },
            { id: 'lares_farm_machinery_shed_1', name: 'LARES Farm Machinery Shed 1', center: [121.166871, 13.959707], category: 'infrastructure', isSubPlot: false, hasMarker: true },
            { id: 'lares_organic_fertilizer_storage', name: 'LARES Organic Fertilizer Storage', center: [121.166833, 13.959801], category: 'infrastructure', isSubPlot: false, hasMarker: true },
            { id: 'warehouse_3', name: 'LARES Corn Seed Processing Facility', center: [121.166836, 13.959944], category: 'infrastructure', isSubPlot: false, hasMarker: true },
            { id: 'warehouse_4', name: 'LARES Farm Machinery Shed 2', center: [121.166872, 13.960008], category: 'infrastructure', isSubPlot: false, hasMarker: true },
            { id: 'warehouse_5', name: 'Rice Banner Warehouse', center: [121.167183, 13.960020], category: 'infrastructure', isSubPlot: false, hasMarker: true },
            { id: 'warehouse_6', name: 'Cassava Dryer', center: [121.167383, 13.960092], category: 'infrastructure', isSubPlot: false, hasMarker: true },
            { id: 'warehouse_7', name: 'Corn Banner Warehouse', center: [121.167564, 13.960170], category: 'infrastructure', isSubPlot: false, hasMarker: true },
            { id: 'warehouse_7_annex', name: 'Warehouse 7 Annex', center: [121.167451, 13.960198], category: 'infrastructure', isSubPlot: false, hasMarker: false },
            { id: 'lares_agricultural_supplies_storage', name: 'LARES Agricultural Supplies Storage', center: [121.166915, 13.959457], category: 'infrastructure', isSubPlot: false, hasMarker: true },
            { id: 'prdp_building', name: 'PRDP Building', center: [121.166907, 13.959350], category: 'infrastructure', isSubPlot: false, hasMarker: true }
        ];

        function getCentroid(coords) {
            const pts = coords && coords[0] ? coords[0] : [];
            if (!pts.length) return [0, 0];
            let lng = 0, lat = 0;
            pts.forEach(c => { lng += c[0]; lat += c[1]; });
            return [lng / pts.length, lat / pts.length];
        }

        function distM(c1, c2) {
            const dx = (c1[0] - c2[0]) * 111000 * Math.cos(c1[1] * Math.PI / 180);
            const dy = (c1[1] - c2[1]) * 111000;
            return Math.hypot(dx, dy);
        }

        // Sanitize incoming features: restore canonical IDs and prevent duplicate dummy pills
        for (const f of data.features) {
            f.properties = f.properties || {};
            if (f.geometry && f.geometry.coordinates) {
                const c = getCentroid(f.geometry.coordinates);
                for (const kf of KNOWN_GEO_FACILITIES) {
                    if (distM(c, kf.center) < 10) {
                        // Strict canonical enforcement: auto-correct corrupted or mismatched IDs
                        f.properties.id = kf.id;
                        f.properties.name = kf.name;
                        f.properties.category = kf.category;
                        f.properties.isSubPlot = kf.isSubPlot;
                        f.properties.hasMarker = kf.hasMarker;
                        break;
                    }
                }
            }
            if (BUILDINGS_WITH_3D.has(f.properties.id)) {
                f.properties.has_3d_model = true;
            }
        }

        // Also save standalone buildings.json
        fs.writeFileSync(path.join(__dirname, 'buildings.json'), JSON.stringify(data, null, 2), 'utf8');
        
        const filePath = path.join(__dirname, 'js', 'data', 'buildings.js');
        const backupPath = path.join(__dirname, 'js', 'data', 'buildings.backup.js');
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Backup original buildings.js
        fs.writeFileSync(backupPath, content, 'utf8');
        
        const startMarker = 'export const LARES_DRAWINGS = ';
        const startIndex = content.indexOf(startMarker);
        if (startIndex === -1) {
            return res.status(500).json({ error: 'Could not find LARES_DRAWINGS in buildings.js' });
        }
        
        const endMarker = 'export const KNOWN_BUILDING_NAMES';
        const nextIndex = content.indexOf(endMarker, startIndex);
        if (nextIndex === -1) {
            return res.status(500).json({ error: 'Could not find KNOWN_BUILDING_NAMES in buildings.js' });
        }
        
        const before = content.substring(0, startIndex + startMarker.length);
        const after = content.substring(nextIndex);
        
        const formattedData = JSON.stringify(data, null, 4);
        const newContent = `${before}${formattedData};\n\n${after}`;
        
        fs.writeFileSync(filePath, newContent, 'utf8');
        const syncRes = await syncDrawnBuildingsToDb('lares', data.features, req.adminUser?.email);
        console.log(`Saved buildings to js/data/buildings.js with ${data.features.length} features (+${syncRes.createdCodes.length} created in MySQL).`);
        res.json({ success: true, count: data.features.length, createdCodes: syncRes.createdCodes, updatedCount: syncRes.updatedCount });
    } catch (err) {
        console.error('Error saving buildings:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// OFFLINE DRONE ORTHOMOSAIC MBTILES TILE SERVER
// Multi-station high-performance streaming of DA-LARES and DA-QARES orthophoto tiles
// ============================================================================
const TILE_CACHE_MAX = 300;

const stationsDb = {
    lares: { db: null, stmt: null, cache: new Map(), label: 'DA-LARES' },
    qares: { db: null, stmt: null, cache: new Map(), label: 'DA-QARES' },
    rares: { db: null, stmt: null, cache: new Map(), label: 'DA-RARES' }
};

const laresCandidates = [
    process.env.MBTILES_PATH,
    path.join(__dirname, 'LARES v1.mbtiles'),
    path.join(os.homedir(), 'Downloads', 'LARES v1.mbtiles'),
    'C:\\Users\\LGU-SanPedro\\Downloads\\LARES v1.mbtiles'
].filter(Boolean);

const qaresCandidates = [
    process.env.QARES_MBTILES_PATH,
    path.join(__dirname, 'QARES v1.mbtiles'),
    path.join(os.homedir(), 'Downloads', 'QARES v1.mbtiles'),
    'C:\\Users\\LGU-SanPedro\\Downloads\\QARES v1.mbtiles'
].filter(Boolean);

const raresCandidates = [
    process.env.RARES_MBTILES_PATH,
    path.join(__dirname, 'RARES v1.mbtiles'),
    path.join(os.homedir(), 'Downloads', 'RARES v1.mbtiles'),
    'C:\\Users\\LGU-SanPedro\\Downloads\\RARES v1.mbtiles'
].filter(Boolean);

function initStationMbtiles(stationKey, candidates, label) {
    for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).size > 1024) {
            console.log(`[MBTiles] Loading ${label} drone orthomosaic from: ${candidate}`);
            const db = new sqlite3.Database(candidate, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    console.error(`[MBTiles] Error opening ${label} MBTiles database:`, err.message);
                } else {
                    console.log(`[MBTiles] ${label} database opened successfully in read-only mode.`);
                    try { db.configure('busyTimeout', 3000); } catch (e) {}
                    db.run('PRAGMA query_only = 1;');
                    db.run('PRAGMA cache_size = -64000;');
                    db.run('PRAGMA mmap_size = 536870912;');
                    const stmt = db.prepare(
                        'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?'
                    );
                    stationsDb[stationKey].db = db;
                    stationsDb[stationKey].stmt = stmt;
                    db.all('SELECT name, value FROM metadata WHERE name IN ("minzoom", "maxzoom")', (mErr, rows) => {
                        if (!mErr && rows) {
                            rows.forEach(r => {
                                if (r.name === 'minzoom') stationsDb[stationKey].minzoom = parseInt(r.value, 10);
                                if (r.name === 'maxzoom') stationsDb[stationKey].maxzoom = parseInt(r.value, 10);
                            });
                            console.log(`[MBTiles] ${label} zoom range: minzoom=${stationsDb[stationKey].minzoom}, maxzoom=${stationsDb[stationKey].maxzoom}`);
                        }
                    });
                    console.log(`[MBTiles] ${label} prepared statement ready. Sub-millisecond tile serving active.`);
                }
            });
            break;
        }
    }
}

initStationMbtiles('lares', laresCandidates, 'DA-LARES');
initStationMbtiles('qares', qaresCandidates, 'DA-QARES');
initStationMbtiles('rares', raresCandidates, 'DA-RARES');

const TRANSPARENT_1X1_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==', 'base64');

function handleStationTileRequest(stationKey, req, res) {
    const st = stationsDb[stationKey];
    if (!st || !st.stmt) {
        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': TRANSPARENT_1X1_PNG.length,
            'Cache-Control': 'public, max-age=86400, immutable',
            'Access-Control-Allow-Origin': '*'
        });
        return res.end(TRANSPARENT_1X1_PNG);
    }

    const z = parseInt(req.params.z, 10);
    const x = parseInt(req.params.x, 10);
    const y = parseInt(req.params.y, 10);

    if (isNaN(z) || isNaN(x) || isNaN(y)) {
        return res.status(400).end();
    }

    const cacheKey = `${z}/${x}/${y}`;
    if (st.cache.has(cacheKey)) {
        const cachedData = st.cache.get(cacheKey);
        st.cache.delete(cacheKey);
        st.cache.set(cacheKey, cachedData);

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': cachedData.length,
            'Cache-Control': 'public, max-age=86400, immutable',
            'Access-Control-Allow-Origin': '*'
        });
        return res.end(cachedData);
    }

    // Convert XYZ Slippy Map tile row to TMS tile row: tile_row = (1 << z) - 1 - y
    const tileRow = (1 << z) - 1 - y;

    st.stmt.get([z, x, tileRow], (err, row) => {
        if (err || !row || !row.tile_data) {
            // When requested zoom exceeds dataset maxzoom, return 204 No Content so Mapbox overzooms parent tiles cleanly
            if (st.maxzoom && z > st.maxzoom) {
                return res.status(204).end();
            }
            // Return transparent 1x1 PNG instead of 404 to avoid browser console error spam
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': TRANSPARENT_1X1_PNG.length,
                'Cache-Control': 'public, max-age=86400, immutable',
                'Access-Control-Allow-Origin': '*'
            });
            return res.end(TRANSPARENT_1X1_PNG);
        }

        if (st.cache.size >= TILE_CACHE_MAX) {
            const oldestKey = st.cache.keys().next().value;
            st.cache.delete(oldestKey);
        }
        st.cache.set(cacheKey, row.tile_data);

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': row.tile_data.length,
            'Cache-Control': 'public, max-age=86400, immutable',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(row.tile_data);
    });
}

// RARES tile endpoints
app.get('/api/tiles/rares/:z/:x/:y.png', (req, res) => handleStationTileRequest('rares', req, res));
app.get('/api/tiles/rares/:z/:x/:y', (req, res) => handleStationTileRequest('rares', req, res));

// QARES tile endpoints
app.get('/api/tiles/qares/:z/:x/:y.png', (req, res) => handleStationTileRequest('qares', req, res));
app.get('/api/tiles/qares/:z/:x/:y', (req, res) => handleStationTileRequest('qares', req, res));

// LARES tile endpoints & legacy backward-compatible routes
app.get('/api/tiles/lares/:z/:x/:y.png', (req, res) => handleStationTileRequest('lares', req, res));
app.get('/api/tiles/lares/:z/:x/:y', (req, res) => handleStationTileRequest('lares', req, res));
app.get('/api/tiles/:z/:x/:y.png', (req, res) => handleStationTileRequest('lares', req, res));
app.get('/api/tiles/:z/:x/:y', (req, res) => handleStationTileRequest('lares', req, res));

app.get('/api/tiles-metadata/:station', (req, res) => {
    const station = req.params.station || 'lares';
    const st = stationsDb[station];
    if (!st || !st.db) return res.status(404).json({ error: `MBTiles database for ${station} not loaded` });
    st.db.all('SELECT name, value FROM metadata', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const meta = {};
        rows.forEach(r => { meta[r.name] = r.value; });
        res.json(meta);
    });
});

app.get('/api/tiles-metadata', (req, res) => {
    const st = stationsDb.lares;
    if (!st || !st.db) return res.status(404).json({ error: 'MBTiles database not loaded' });
    st.db.all('SELECT name, value FROM metadata', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const meta = {};
        rows.forEach(r => { meta[r.name] = r.value; });
        res.json(meta);
    });
});

// Optional Server-Level Kill Switch (ENABLE_PORTAL=false disables all /login and /api/admin/* endpoints)
// Remote HTTPS access is permitted and secured via Token Auth + 2-Step Gmail OTP + Normalized RBAC.
const PORTAL_ENABLED = String(process.env.ENABLE_PORTAL ?? process.env.ENABLE_ADMIN ?? 'true').toLowerCase() !== 'false';
app.use((req, res, next) => {
    const lowerPath = decodeURIComponent(req.path || '').toLowerCase();
    const isPortalRoute =
        lowerPath === '/login' || lowerPath === '/login/' ||
        lowerPath === '/admin' || lowerPath === '/admin/' || lowerPath === '/admin.html' ||
        lowerPath === '/review' || lowerPath === '/review/' ||
        lowerPath.startsWith('/api/admin') ||
        lowerPath.startsWith('/api/review') ||
        lowerPath.startsWith('/api/auth');
    if (isPortalRoute && !PORTAL_ENABLED) {
        return res.status(403).json({ error: 'iGUIDE Portal is disabled on this server' });
    }
    next();
});

// Tiered sliding-window IP rate limiters for auth & burst protection
function createRateLimiter({ windowMs, max, label }) {
    const hits = new Map();
    const timer = setInterval(() => {
        const now = Date.now();
        for (const [k, rec] of hits.entries()) {
            if (now > rec.resetAt) hits.delete(k);
        }
    }, Math.max(15000, windowMs));
    if (typeof timer.unref === 'function') timer.unref();

    return (req, res, next) => {
        const ip = String(req.headers['cf-connecting-ip'] || req.ip || req.connection?.remoteAddress || 'unknown');
        const now = Date.now();
        let rec = hits.get(ip);
        if (!rec || now > rec.resetAt) {
            rec = { count: 0, resetAt: now + windowMs };
            hits.set(ip, rec);
        }
        rec.count += 1;
        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - rec.count)));
        if (rec.count > max) {
            const retrySec = Math.max(1, Math.ceil((rec.resetAt - now) / 1000));
            res.setHeader('Retry-After', String(retrySec));
            return res.status(429).json({
                error: `Too many requests on ${label}. Please wait ${retrySec}s before retrying.`,
                retryAfterSeconds: retrySec
            });
        }
        next();
    };
}

const authBurstLimiter = createRateLimiter({ windowMs: 15000, max: 35, label: 'authentication' });
const adminWriteBurstLimiter = createRateLimiter({ windowMs: 10000, max: 250, label: 'admin writes' });

app.use(['/api/admin/login', '/api/admin/resend-otp', '/api/admin/verify-otp', '/api/auth/signup', '/api/auth/check-email', '/api/auth/forgot-password', '/api/auth/reset-password'], authBurstLimiter);
app.use(['/api/admin', '/api/review'], (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return adminWriteBurstLimiter(req, res, next);
    }
    next();
});

// Mount 10-Table MySQL RBAC, Onboarding & CRUD API Router
app.use('/api', adminApiRouter);

// Graceful 503 handler if MySQL queue saturates under extreme flood
app.use('/api', (err, req, res, next) => {
    if (err && (err.code === 'POOL_ENQUEUELIMIT' || String(err.message || '').includes('Queue limit reached'))) {
        res.setHeader('Retry-After', '2');
        return res.status(503).json({ error: 'Database queue saturated by burst load. Please retry shortly.' });
    }
    next(err);
});

// Live Application & Database Version Endpoint (short 3s RAM cache + invalidated on publish)
let versionCachePayload = null;
let versionCacheExpiresAt = 0;
let versionInFlightPromise = null;
if (typeof adminApiRouter.onCacheInvalidated === 'function') {
    adminApiRouter.onCacheInvalidated(() => {
        versionCachePayload = null;
        versionCacheExpiresAt = 0;
    });
}

app.get('/api/version', async (req, res) => {
    const now = Date.now();
    if (versionCachePayload && now < versionCacheExpiresAt) {
        return res.json(versionCachePayload);
    }
    try {
        if (!versionInFlightPromise) {
            versionInFlightPromise = (async () => {
                let dbUpdatedAt = null;
                try {
                    const vRows = await query("SELECT `value` FROM settings WHERE `key` = 'data_version' LIMIT 1");
                    if (vRows && vRows[0] && vRows[0].value) {
                        dbUpdatedAt = vRows[0].value;
                    } else {
                        const rows = await query(`SELECT MAX(created_at) AS latest FROM admin_audit_logs`);
                        if (rows && rows[0] && rows[0].latest) {
                            dbUpdatedAt = rows[0].latest;
                        }
                    }
                } catch (e) {}
                const payload = {
                    version: APP_VERSION,
                    bootId: SERVER_BOOT_ID,
                    dbUpdatedAt,
                    diskEditorsLocked: process.env.LOCK_STATIC_DISK_EDITORS === '1'
                };
                versionCachePayload = payload;
                versionCacheExpiresAt = Date.now() + 3000;
                return payload;
            })().finally(() => {
                versionInFlightPromise = null;
            });
        }
        const payload = await versionInFlightPromise;
        res.json(payload);
    } catch (err) {
        if (err && (err.code === 'POOL_ENQUEUELIMIT' || String(err.message || '').includes('Queue limit reached'))) {
            res.setHeader('Retry-After', '2');
            return res.status(503).json({ error: 'Server busy, please retry.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Canonical iGUIDE Login & Portal Route (/login); redirect legacy /admin & /review cleanly
app.get(['/login', '/login/'], (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});
app.get(['/admin', '/admin/', '/review', '/review/'], (req, res) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(302, '/login' + qs);
});

// Permanently redirect legacy URLs to upgraded modern 3D map
app.get(['/legacy.html', '/legacy'], (req, res) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, '/' + qs);
});

// Security Guard: Block Inspect-Element / Direct URL access to backend source code, credentials, and raw MBTiles
const BLOCKED_PATH_PREFIXES = [
    '/database', '/app', '/config', '/routes', '/tools', '/docs', '/archive', '/renders',
    '/scratch', '/scripts', '/building images', '/building images rares',
    '/.env', '/.git', '/.vscode', '/.agents', '/node_modules'
];
const BLOCKED_EXACT_FILES = new Set([
    '/server.js', '/artisan', '/package.json', '/package-lock.json', '/composer.json',
    '/AGENTS.md', '/README.md', '/dash_preview.html', '/.gitignore', '/.env.example'
]);
const BLOCKED_EXTENSIONS = /\.(env|mbtiles|php|py|mjs|sh|bat|ps1|vbs|cmd|exe|sql|log|bak|blend|blend1)$/i;

app.use((req, res, next) => {
    const reqPath = decodeURIComponent(req.path || '');
    const lowerPath = reqPath.toLowerCase();
    if (
        lowerPath.includes('..') ||
        BLOCKED_EXACT_FILES.has(reqPath) ||
        BLOCKED_EXACT_FILES.has(lowerPath) ||
        BLOCKED_EXTENSIONS.test(lowerPath) ||
        lowerPath.endsWith('.backup.json') ||
        BLOCKED_PATH_PREFIXES.some(prefix => lowerPath === prefix || lowerPath.startsWith(prefix + '/'))
    ) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
});

// Serve static files with Smart Tiered HTTP Caching:
// - 3D GLB models, WebP photos, and fonts are cached with ETag + 24h max-age for zero-lag reloads
// - HTML, JS, CSS, and JSON validate via ETag on each load so code/data updates take effect immediately
app.use(express.static(__dirname, {
    dotfiles: 'deny',
    etag: true,
    setHeaders: (res, filePath) => {
        if (/\.(webp|png|jpg|jpeg|svg|woff2|ico)$/i.test(filePath)) {
            res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        } else {
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
            res.set('CDN-Cache-Control', 'no-store');
            res.set('Cloudflare-CDN-Cache-Control', 'no-store');
        }
    }
}));

// Fallback to index.html for any other route
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let healthCheckInterval = null;
let fallbackTunnelProcess = null;
let cloudflareCooldownUntil = 0;
let tunnelRetryDelay = 5000;
let consecutive429Count = 0;
let lastTunnelError = '';

function startFallbackTunnel() {
    if (fallbackTunnelProcess) return;
    if (process.env.NO_TUNNEL || process.argv.includes('--no-tunnel')) return;

    console.log('[Tunnel Fallback] Launching secure public tunnel via localhost.run for port ' + port + '...');
    try {
        fallbackTunnelProcess = spawn('ssh', [
            '-R', `80:localhost:${port}`,
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'ServerAliveInterval=30',
            '-o', 'ExitOnForwardFailure=yes',
            'nokey@localhost.run'
        ]);

        fallbackTunnelProcess.stdout.on('data', (data) => {
            const str = data.toString();
            const match = str.match(/https:\/\/[a-z0-9]+\.lhr\.life/i);
            if (match && match[0] && match[0] !== currentTunnelUrl) {
                currentTunnelUrl = match[0];
                console.log('\n======================================================');
                console.log(`[Public Tunnel Active - localhost.run Fallback]`);
                console.log(`Public URL: ${currentTunnelUrl}`);
                console.log('======================================================\n');

                query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('tunnel_url', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
                    [currentTunnelUrl]
                ).catch(e => console.error('[Tunnel] Failed to save tunnel URL to DB:', e.message));
            }
        });

        fallbackTunnelProcess.stderr.on('data', () => {});

        fallbackTunnelProcess.on('exit', (code) => {
            console.log(`[Tunnel Fallback] Exited with code ${code}.`);
            fallbackTunnelProcess = null;
            // If Cloudflare is still cooling down and we don't have another tunnel, restart fallback after 5s
            if (!currentTunnelUrl || currentTunnelUrl.includes('.lhr.life')) {
                currentTunnelUrl = '';
                setTimeout(startFallbackTunnel, 5000);
            }
        });

        fallbackTunnelProcess.on('error', (err) => {
            console.error('[Tunnel Fallback] Error:', err.message);
            fallbackTunnelProcess = null;
        });
    } catch (e) {
        console.error('[Tunnel Fallback] Exception starting ssh tunnel:', e.message);
    }
}

let tunnelStartTimer = null;

function restartCloudflareTunnel() {
    console.log('[Cloudflare] Tunnel unhealthy or disconnected. Restarting...');
    currentTunnelUrl = '';
    if (tunnelStartTimer) {
        clearTimeout(tunnelStartTimer);
        tunnelStartTimer = null;
    }
    if (tunnelProcess) {
        const oldProc = tunnelProcess;
        tunnelProcess = null;
        try { oldProc.kill(); } catch (e) {}
    }
    try {
        execSync('taskkill /F /IM cloudflared.exe 2>NUL', { stdio: 'ignore' });
    } catch (e) {}
    tunnelStartTimer = setTimeout(startCloudflareTunnel, 1500);
}

function startCloudflareTunnel() {
    if (tunnelStartTimer) {
        clearTimeout(tunnelStartTimer);
        tunnelStartTimer = null;
    }
    const noTunnelVal = String(process.env.NO_TUNNEL || '').trim().toLowerCase();
    const tunnelDisabled = ['1', 'true', 'yes'].includes(noTunnelVal) || process.argv.includes('--no-tunnel');
    if (tunnelDisabled) {
        console.log('[Cloudflare] Tunnel disabled via configuration (--no-tunnel or NO_TUNNEL=1).');
        return;
    }

    // If Cloudflare is currently in a 429 rate-limit cooldown, don't spam it!
    if (Date.now() < cloudflareCooldownUntil) {
        const remainingMin = Math.ceil((cloudflareCooldownUntil - Date.now()) / 60000);
        console.log(`[Cloudflare] In rate-limit cooldown (${remainingMin}m remaining). Keeping fallback tunnel active.`);
        startFallbackTunnel();
        return;
    }

    const cloudflaredExe = path.join(__dirname, 'cloudflared.exe');
    if (!fs.existsSync(cloudflaredExe)) {
        console.log('[Cloudflare] cloudflared.exe not found in directory. Using fallback tunnel.');
        startFallbackTunnel();
        return;
    }

    try {
        execSync('taskkill /F /IM cloudflared.exe 2>NUL', { stdio: 'ignore' });
    } catch (e) {}

    const namedToken = String(process.env.CLOUDFLARE_TUNNEL_TOKEN || '').trim();
    const publicNamedUrl = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
    let namedBannerPrinted = false;

    console.log(namedToken
        ? `[Cloudflare] Launching Named Tunnel for port ${port}${publicNamedUrl ? ` (${publicNamedUrl})` : ''}...`
        : `[Cloudflare] Launching Cloudflare Tunnel for port ${port}...`);
    lastTunnelError = '';
    try {
        const cfArgs = namedToken
            ? ['tunnel', 'run', '--token', namedToken]
            : ['tunnel', '--url', `http://localhost:${port}`];
        const spawnedProc = spawn(cloudflaredExe, cfArgs);
        tunnelProcess = spawnedProc;

        const parseTunnelOutput = (data) => {
            const str = data.toString();

            if (namedToken && !namedBannerPrinted && /Registered tunnel connection/i.test(str)) {
                namedBannerPrinted = true;
                currentTunnelUrl = publicNamedUrl || 'https://iguide.daivcalabarzon.site';
                tunnelRetryDelay = 5000;
                consecutive429Count = 0;
                console.log('\n======================================================');
                console.log('[Cloudflare Named Tunnel Active]');
                console.log(`Public URL: ${currentTunnelUrl}`);
                console.log(`Portal URL: ${currentTunnelUrl}/login`);
                console.log(`Local Host: http://localhost:${port}`);
                console.log('======================================================\n');
                query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('tunnel_url', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
                    [currentTunnelUrl]
                ).catch(e => console.error('[Cloudflare] Failed to save tunnel URL to DB:', e.message));
            }

            if (str.includes('429')) {
                lastTunnelError = 'Cloudflare free quick tunnel rate limit reached (HTTP 429 Too Many Requests).';
            } else if (str.toLowerCase().includes('error') || str.toLowerCase().includes('fail')) {
                const lines = str.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length > 0) lastTunnelError = lines[lines.length - 1];
            }

            const match = str.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
            if (match && match[0] && match[0] !== currentTunnelUrl) {
                currentTunnelUrl = match[0];
                tunnelRetryDelay = 5000;
                consecutive429Count = 0;
                console.log('\n======================================================');
                console.log(`[Cloudflare Tunnel Active]`);
                console.log(`Public URL: ${currentTunnelUrl}`);
                console.log('======================================================\n');

                if (fallbackTunnelProcess) {
                    try { fallbackTunnelProcess.kill(); } catch (e) {}
                    fallbackTunnelProcess = null;
                }

                query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('tunnel_url', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
                    [currentTunnelUrl]
                ).catch(e => console.error('[Cloudflare] Failed to save tunnel URL to DB:', e.message));
            }
        };

        spawnedProc.stdout.on('data', parseTunnelOutput);
        spawnedProc.stderr.on('data', parseTunnelOutput);

        spawnedProc.on('exit', (code) => {
            // Ignore stale exit events from a process already replaced/killed by restartCloudflareTunnel()
            if (tunnelProcess !== spawnedProc) return;
            tunnelProcess = null;

            if (lastTunnelError) {
                console.log(`[Cloudflare] Tunnel note: ${lastTunnelError}`);
            }

            if (lastTunnelError.includes('429')) {
                consecutive429Count++;
                cloudflareCooldownUntil = Date.now() + 15 * 60 * 1000;
                console.log(`[Cloudflare] Rate limited (HTTP 429). Pausing Cloudflare retries for 15 minutes to allow cooldown.`);
                console.log(`[Cloudflare] Engaging immediate fallback tunnel...`);
                startFallbackTunnel();
                if (!tunnelStartTimer) tunnelStartTimer = setTimeout(startCloudflareTunnel, 15 * 60 * 1000);
            } else {
                tunnelRetryDelay = Math.min(tunnelRetryDelay * 1.5, 60000);
                console.log(`[Cloudflare] Tunnel exited with code ${code}. Restarting in ${Math.round(tunnelRetryDelay / 1000)}s...`);
                if (!tunnelStartTimer) tunnelStartTimer = setTimeout(startCloudflareTunnel, tunnelRetryDelay);
            }

            if (!currentTunnelUrl.includes('.lhr.life')) {
                currentTunnelUrl = '';
            }
        });

        spawnedProc.on('error', (err) => {
            if (tunnelProcess !== spawnedProc) return;
            console.error('[Cloudflare] Error launching tunnel:', err.message);
            tunnelProcess = null;
            startFallbackTunnel();
        });
    } catch (err) {
        console.error('[Cloudflare] Exception starting tunnel:', err.message);
        tunnelProcess = null;
        startFallbackTunnel();
    }

    if (!healthCheckInterval) {
        healthCheckInterval = setInterval(async () => {
            if (!currentTunnelUrl) return;
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 6000);
                const res = await fetch(`${currentTunnelUrl}/api/tunnel`, { signal: controller.signal });
                clearTimeout(timeout);
                if (!res.ok) {
                    console.log(`[Tunnel] Health check status ${res.status}. Restarting...`);
                    restartCloudflareTunnel();
                }
            } catch (e) {
                // If ping fails on Cloudflare, try restart
                if (currentTunnelUrl.includes('trycloudflare.com')) {
                    console.log(`[Cloudflare] Health check ping failed (${e.message}). Restarting...`);
                    restartCloudflareTunnel();
                }
            }
        }, 45000);
    }
}

// Graceful cleanup
function cleanupAndExit() {
    for (const k of Object.keys(stationsDb)) {
        try { if (stationsDb[k].stmt) stationsDb[k].stmt.finalize(); } catch (e) {}
        try { if (stationsDb[k].db) stationsDb[k].db.close(); } catch (e) {}
    }
    try { if (tunnelProcess) tunnelProcess.kill(); } catch (e) {}
    try { if (fallbackTunnelProcess) fallbackTunnelProcess.kill(); } catch (e) {}
    process.exit();
}
process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);

app.listen(port, () => {
    console.log(`Kiosk Backend Server running at http://localhost:${port}`);
    startCloudflareTunnel();
});
