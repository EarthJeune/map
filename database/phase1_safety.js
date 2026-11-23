/**
 * Phase 1 Logic & Safety Core Helpers (CommonJS, directly testable in Node)
 * - Authoritative full-record snapshot capture (1.1)
 * - Optimistic locking version bump & conflict detection (1.2)
 * - Role accountability metadata & Super Admin acting-as formatting (1.4)
 * - Self-approval/publish guard with logged Super Admin override (1.4)
 * - Version history recording & 24h undo eligibility (1.5 & 1.6)
 * - Destructive delete reason validation (1.7)
 */

const ROLE_DISPLAY_LABELS = {
    super_admin: 'Super Admin',
    administrator: 'Administrator',
    gis_editor: 'GIS Editor',
    reviewer: 'Reviewer',
    visitor: 'Visitor'
};

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatRoleLabel(roleSlug) {
    const slug = String(roleSlug || '').trim().toLowerCase();
    return ROLE_DISPLAY_LABELS[slug] || slug || 'User';
}

function formatActorAuditMeta(adminUser = null) {
    const u = adminUser && typeof adminUser === 'object' ? adminUser : {};
    const baseRole = String(u.baseRole || u.role || 'admin').trim().toLowerCase();
    const effectiveRole = String(u.role || u.effectiveRole || baseRole).trim().toLowerCase();
    const actingLabel = (baseRole === 'super_admin' && effectiveRole && effectiveRole !== 'super_admin')
        ? `Super Admin acting as ${formatRoleLabel(effectiveRole)}`
        : formatRoleLabel(effectiveRole);
    return {
        userId: u.userId ? Number(u.userId) : null,
        email: String(u.email || u.username || 'system').trim(),
        displayName: String(u.fullName || u.full_name || u.email || 'System').trim(),
        baseRole,
        effectiveRole,
        actingLabel,
        isTest: Number(u.isTest ?? u.is_test ?? 0) ? 1 : 0
    };
}

function evaluateSelfActionGuard({ submittedByUserId, submittedByEmail, actorUser, overrideReason = '', actionLabel = 'approve or publish' }) {
    const actor = actorUser && typeof actorUser === 'object' ? actorUser : {};
    const subId = submittedByUserId ? Number(submittedByUserId) : null;
    const actId = actor.userId ? Number(actor.userId) : null;
    const subEmail = String(submittedByEmail || '').trim().toLowerCase();
    const actEmail = String(actor.email || '').trim().toLowerCase();

    const isSameUser = (subId !== null && actId !== null && subId === actId)
        || (subId === null && subEmail && actEmail && subEmail === actEmail);

    if (!isSameUser) {
        return { allowed: true, overridden: false, overrideReason: '' };
    }

    const baseRole = String(actor.baseRole || actor.role || '').trim().toLowerCase();
    const cleanReason = String(overrideReason || '').trim();
    if (baseRole === 'super_admin') {
        if (cleanReason.length < 3) {
            return {
                allowed: false,
                statusCode: 403,
                code: 'SELF_ACTION_OVERRIDE_REQUIRED',
                error: `You submitted this request. Super Admin can override only with a written reason explaining why you need to ${actionLabel} your own submission.`
            };
        }
        return { allowed: true, overridden: true, overrideReason: cleanReason };
    }

    return {
        allowed: false,
        statusCode: 403,
        code: 'SELF_ACTION_BLOCKED',
        error: `You cannot ${actionLabel} your own submission. Another reviewer or administrator must process it.`
    };
}

function evaluateStaleBaseGuard({ baseVersion, liveVersion, action = 'UPDATE', overrideReason = '' }) {
    const act = String(action || 'UPDATE').toUpperCase();
    if (act === 'CREATE') {
        return { allowed: true, stale: false, overridden: false, overrideReason: '' };
    }
    const baseV = Number(baseVersion || 1);
    const liveV = Number(liveVersion || 1);
    if (!Number.isFinite(liveV) || liveV <= baseV) {
        return { allowed: true, stale: false, overridden: false, overrideReason: '' };
    }
    const cleanReason = String(overrideReason || '').trim();
    if (cleanReason.length >= 3) {
        return { allowed: true, stale: true, overridden: true, overrideReason: cleanReason };
    }
    return {
        allowed: false,
        statusCode: 409,
        code: 'STALE_BASE_VERSION',
        error: `This request was based on version v${baseV}, but the live record is now at v${liveV}. Rebase the request first or provide a written override note.`
    };
}

function validateDeleteReason(reason) {
    const clean = String(reason || '').trim();
    if (clean.length < 3) {
        return {
            valid: false,
            error: 'A written reason is required before deleting this record.'
        };
    }
    return { valid: true, reason: clean };
}

function isWithinUndoWindow(publishedAt, nowMs = Date.now()) {
    if (!publishedAt) return false;
    const ts = new Date(publishedAt).getTime();
    if (!Number.isFinite(ts)) return false;
    const age = nowMs - ts;
    return age >= 0 && age <= UNDO_WINDOW_MS;
}

async function captureFullRecordSnapshot(queryFn, { stationId, targetTable, targetId, buildingCode = null }) {
    const st = String(stationId || 'lares').toLowerCase();
    const tbl = String(targetTable || '').toLowerCase();

    if (tbl === 'buildings' || tbl === 'building_images') {
        let bldg = null;
        if (tbl === 'buildings') {
            const isNum = /^\d+$/.test(String(targetId));
            const rows = await queryFn(
                isNum
                    ? `SELECT * FROM buildings WHERE id = ? LIMIT 1`
                    : `SELECT * FROM buildings WHERE station_id = ? AND building_code = ? LIMIT 1`,
                isNum ? [Number(targetId)] : [st, String(targetId)]
            );
            bldg = rows[0] || null;
        } else {
            let code = buildingCode;
            if (!code && /^\d+$/.test(String(targetId))) {
                const imgRows = await queryFn(`SELECT * FROM building_images WHERE id = ? LIMIT 1`, [Number(targetId)]);
                if (imgRows[0]) code = imgRows[0].building_code;
            }
            if (code) {
                const rows = await queryFn(
                    `SELECT * FROM buildings WHERE station_id = ? AND building_code = ? LIMIT 1`,
                    [st, String(code)]
                );
                bldg = rows[0] || null;
            }
        }
        if (!bldg) return { record: null, snapshot: null, version: 1 };
        const [imgs, offices, modeRows] = await Promise.all([
            queryFn(
                `SELECT id, image_webp_url, caption, display_order, is_primary
                 FROM building_images WHERE station_id = ? AND building_code = ?
                 ORDER BY is_primary DESC, display_order ASC, id ASC`,
                [bldg.station_id, bldg.building_code]
            ),
            queryFn(
                `SELECT id, office_name, floor_or_room, room_number, office_desc, display_order
                 FROM building_offices WHERE station_id = ? AND building_code = ?
                 ORDER BY display_order ASC, id ASC`,
                [bldg.station_id, bldg.building_code]
            ),
            queryFn(
                'SELECT `value` FROM settings WHERE `key` = ? LIMIT 1',
                [`gallery_mode_${bldg.station_id}_${bldg.building_code}`]
            )
        ]);
        const modeVal = modeRows?.[0]?.value;
        const snapshot = {
            ...bldg,
            images: imgs || [],
            offices: offices || [],
            gallery_mode: (modeVal === 'carousel' || modeVal === 'slider') ? modeVal : 'slider'
        };
        return { record: bldg, snapshot, version: Number(bldg.version || 1) };
    }

    if (tbl === 'building_offices') {
        const rows = await queryFn(`SELECT * FROM building_offices WHERE id = ? LIMIT 1`, [Number(targetId) || -1]);
        const office = rows[0] || null;
        if (!office) return { record: null, snapshot: null, version: 1 };
        return { record: office, snapshot: { ...office }, version: Number(office.version || 1) };
    }

    if (tbl === 'agricultural_plots' || tbl === 'plot_subplots') {
        let plot = null;
        const isNum = /^\d+$/.test(String(targetId));
        if (tbl === 'agricultural_plots') {
            const rows = await queryFn(
                isNum
                    ? `SELECT * FROM agricultural_plots WHERE id = ? LIMIT 1`
                    : `SELECT * FROM agricultural_plots WHERE station_id = ? AND plot_code = ? LIMIT 1`,
                isNum ? [Number(targetId)] : [st, String(targetId)]
            );
            plot = rows[0] || null;
        } else if (isNum) {
            const subRows = await queryFn(`SELECT * FROM plot_subplots WHERE id = ? LIMIT 1`, [Number(targetId)]);
            if (subRows[0]?.parent_plot_id) {
                const rows = await queryFn(`SELECT * FROM agricultural_plots WHERE id = ? LIMIT 1`, [subRows[0].parent_plot_id]);
                plot = rows[0] || null;
            }
        }
        if (!plot) return { record: null, snapshot: null, version: 1 };
        const [subplots, history] = await Promise.all([
            queryFn(`SELECT * FROM plot_subplots WHERE parent_plot_id = ? ORDER BY id ASC`, [plot.id]),
            queryFn(`SELECT * FROM plot_history WHERE plot_id = ? ORDER BY id DESC LIMIT 20`, [plot.id])
        ]);
        const snapshot = {
            ...plot,
            subPlots: subplots || [],
            history: history || []
        };
        return { record: plot, snapshot, version: Number(plot.version || 1) };
    }

    if (tbl === 'stations') {
        const rows = await queryFn(`SELECT * FROM stations WHERE station_id = ? LIMIT 1`, [String(targetId || st)]);
        const station = rows[0] || null;
        if (!station) return { record: null, snapshot: null, version: 1 };
        return { record: station, snapshot: { ...station }, version: Number(station.version || 1) };
    }

    return { record: null, snapshot: null, version: 1 };
}

async function bumpEntityVersion(queryFn, { stationId, targetTable, targetId }) {
    const st = String(stationId || 'lares').toLowerCase();
    const tbl = String(targetTable || '').toLowerCase();
    const isNum = /^\d+$/.test(String(targetId));

    if (tbl === 'buildings') {
        if (isNum) {
            await queryFn(`UPDATE buildings SET version = COALESCE(version, 1) + 1 WHERE id = ?`, [Number(targetId)]);
            const [r] = await queryFn(`SELECT version FROM buildings WHERE id = ? LIMIT 1`, [Number(targetId)]);
            return Number(r?.version || 1);
        }
        await queryFn(`UPDATE buildings SET version = COALESCE(version, 1) + 1 WHERE station_id = ? AND building_code = ?`, [st, String(targetId)]);
        const [r] = await queryFn(`SELECT version FROM buildings WHERE station_id = ? AND building_code = ? LIMIT 1`, [st, String(targetId)]);
        return Number(r?.version || 1);
    }
    if (tbl === 'building_offices' && isNum) {
        await queryFn(`UPDATE building_offices SET version = COALESCE(version, 1) + 1 WHERE id = ?`, [Number(targetId)]);
        const [r] = await queryFn(`SELECT version FROM building_offices WHERE id = ? LIMIT 1`, [Number(targetId)]);
        return Number(r?.version || 1);
    }
    if (tbl === 'agricultural_plots') {
        if (isNum) {
            await queryFn(`UPDATE agricultural_plots SET version = COALESCE(version, 1) + 1 WHERE id = ?`, [Number(targetId)]);
            const [r] = await queryFn(`SELECT version FROM agricultural_plots WHERE id = ? LIMIT 1`, [Number(targetId)]);
            return Number(r?.version || 1);
        }
        await queryFn(`UPDATE agricultural_plots SET version = COALESCE(version, 1) + 1 WHERE station_id = ? AND plot_code = ?`, [st, String(targetId)]);
        const [r] = await queryFn(`SELECT version FROM agricultural_plots WHERE station_id = ? AND plot_code = ? LIMIT 1`, [st, String(targetId)]);
        return Number(r?.version || 1);
    }
    if (tbl === 'stations') {
        await queryFn(`UPDATE stations SET version = COALESCE(version, 1) + 1 WHERE station_id = ?`, [String(targetId || st)]);
        const [r] = await queryFn(`SELECT version FROM stations WHERE station_id = ? LIMIT 1`, [String(targetId || st)]);
        return Number(r?.version || 1);
    }
    return 1;
}

async function recordEntityVersion(queryFn, {
    stationId,
    targetTable,
    targetId,
    versionNum = 1,
    action = 'UPDATE',
    summary = '',
    snapshot = {},
    changeRequestId = null,
    source = 'portal',
    adminUser = null
}) {
    const actor = formatActorAuditMeta(adminUser);
    try {
        const snapStr = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot || {});
        const res = await queryFn(
            `INSERT INTO record_versions (
                station_id, target_table, target_id, version_num, action, summary,
                snapshot_json, change_request_id, source,
                actor_user_id, actor_email, actor_display_name, actor_base_role, actor_effective_role
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                String(stationId || 'lares').toLowerCase(),
                String(targetTable || 'unknown'),
                String(targetId || 'general'),
                Number(versionNum || 1),
                String(action || 'UPDATE').toUpperCase(),
                String(summary || '').slice(0, 250),
                snapStr,
                changeRequestId ? Number(changeRequestId) : null,
                String(source || 'portal'),
                actor.userId,
                actor.email,
                actor.displayName,
                actor.baseRole,
                actor.effectiveRole
            ]
        );
        return res?.insertId || null;
    } catch (err) {
        console.warn('[RecordVersion] Failed to write version history:', err.message);
        return null;
    }
}

async function attachConflictMetadata(queryFn, requests = []) {
    if (!Array.isArray(requests) || requests.length === 0) return [];

    // Group open requests by (station_id, target_table, target_id)
    const openStatuses = new Set(['draft', 'pending', 'approved', 'rejected']);
    const openByKey = new Map();
    const versionLookups = new Map();

    for (const r of requests) {
        const key = `${String(r.station_id || '').toLowerCase()}::${String(r.target_table || '').toLowerCase()}::${String(r.target_id || '')}`;
        if (openStatuses.has(String(r.status || '').toLowerCase())) {
            if (!openByKey.has(key)) openByKey.set(key, []);
            openByKey.get(key).push(r);
        }
        if (['buildings', 'building_offices', 'agricultural_plots', 'stations'].includes(String(r.target_table || '').toLowerCase())) {
            versionLookups.set(key, { stationId: r.station_id, targetTable: r.target_table, targetId: r.target_id });
        }
    }

    const liveVersionByKey = new Map();
    for (const [key, spec] of versionLookups.entries()) {
        try {
            const snap = await captureFullRecordSnapshot(queryFn, spec);
            liveVersionByKey.set(key, Number(snap.version || 1));
        } catch (_) {
            liveVersionByKey.set(key, 1);
        }
    }

    const nowMs = Date.now();
    return requests.map(r => {
        const key = `${String(r.station_id || '').toLowerCase()}::${String(r.target_table || '').toLowerCase()}::${String(r.target_id || '')}`;
        const siblings = (openByKey.get(key) || [])
            .filter(other => Number(other.id) !== Number(r.id))
            .map(other => ({
                id: other.id,
                status: other.status,
                summary: other.summary,
                submitted_by_name: other.submitted_by_name || other.submitted_by_email || 'Editor'
            }));
        const baseVersion = Number(r.base_version || 1);
        const liveVersion = liveVersionByKey.has(key) ? liveVersionByKey.get(key) : baseVersion;
        const isOpen = openStatuses.has(String(r.status || '').toLowerCase());
        const isStaleBase = isOpen && String(r.action || '').toUpperCase() !== 'CREATE' && liveVersion > baseVersion;
        const canUndoPublish = String(r.status || '').toLowerCase() === 'published'
            && !r.undone_at
            && Boolean(r.published_snapshot_json)
            && isWithinUndoWindow(r.published_at, nowMs);

        return {
            ...r,
            base_version: baseVersion,
            live_version: liveVersion,
            is_stale_base: isStaleBase,
            conflicts: siblings,
            can_undo_publish: canUndoPublish
        };
    });
}

module.exports = {
    ROLE_DISPLAY_LABELS,
    UNDO_WINDOW_MS,
    formatRoleLabel,
    formatActorAuditMeta,
    evaluateSelfActionGuard,
    evaluateStaleBaseGuard,
    validateDeleteReason,
    isWithinUndoWindow,
    captureFullRecordSnapshot,
    bumpEntityVersion,
    recordEntityVersion,
    attachConflictMetadata
};
