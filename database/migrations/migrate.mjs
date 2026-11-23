/**
 * Reversible Up/Down Migration Runner for iGUIDE MySQL Database
 * Usage:
 *   node database/migrations/migrate.mjs up
 *   node database/migrations/migrate.mjs down [steps|name]
 *   node database/migrations/migrate.mjs status
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createDbConnection() {
    return mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kiosk',
        multipleStatements: true
    });
}

export async function ensureMigrationsTable(conn) {
    await conn.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
}

export function discoverMigrations(dir = __dirname) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => /^\d{4}_.*\.mjs$/.test(f))
        .sort();
}

export async function getMigrationStatus(conn, dir = __dirname) {
    await ensureMigrationsTable(conn);
    const [rows] = await conn.query(`SELECT name, applied_at FROM schema_migrations ORDER BY name ASC`);
    const appliedMap = new Map(rows.map(r => [r.name, r.applied_at]));
    const files = discoverMigrations(dir);
    return files.map(name => ({
        name,
        applied: appliedMap.has(name),
        appliedAt: appliedMap.get(name) || null
    }));
}

export async function runUp(conn, dir = __dirname, { targetName = null } = {}) {
    await ensureMigrationsTable(conn);
    const statuses = await getMigrationStatus(conn, dir);
    const pending = statuses.filter(s => !s.applied && (!targetName || s.name === targetName));
    const executed = [];

    for (const item of pending) {
        const modUrl = pathToFileURL(path.join(dir, item.name)).href;
        const mod = await import(modUrl);
        if (typeof mod.up !== 'function') {
            throw new Error(`Migration ${item.name} must export an async up(conn) function.`);
        }
        await mod.up(conn);
        await conn.query(`INSERT INTO schema_migrations (name) VALUES (?)`, [item.name]);
        executed.push(item.name);
    }
    return executed;
}

export async function runDown(conn, dir = __dirname, arg = '1') {
    await ensureMigrationsTable(conn);
    const [rows] = await conn.query(`SELECT name FROM schema_migrations ORDER BY name DESC`);
    const appliedNames = rows.map(r => r.name);
    if (appliedNames.length === 0) return [];

    let toRollback = [];
    if (arg && /^\d{4}_.*\.mjs$/.test(String(arg))) {
        if (appliedNames.includes(String(arg))) {
            toRollback = [String(arg)];
        }
    } else {
        const count = Math.max(1, Number.parseInt(String(arg || '1'), 10) || 1);
        toRollback = appliedNames.slice(0, count);
    }

    const rolledBack = [];
    for (const name of toRollback) {
        const modUrl = pathToFileURL(path.join(dir, name)).href;
        const mod = await import(modUrl);
        if (typeof mod.down !== 'function') {
            throw new Error(`Migration ${name} must export an async down(conn) function for rollback.`);
        }
        await mod.down(conn);
        await conn.query(`DELETE FROM schema_migrations WHERE name = ?`, [name]);
        rolledBack.push(name);
    }
    return rolledBack;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    const cmd = String(process.argv[2] || 'status').toLowerCase();
    const arg = process.argv[3];
    const conn = await createDbConnection();
    try {
        if (cmd === 'up') {
            const list = await runUp(conn, __dirname, { targetName: arg || null });
            console.log(list.length ? `Applied migrations: ${list.join(', ')}` : 'All migrations are already up to date.');
        } else if (cmd === 'down') {
            const list = await runDown(conn, __dirname, arg || '1');
            console.log(list.length ? `Rolled back migrations: ${list.join(', ')}` : 'No applied migrations to roll back.');
        } else if (cmd === 'status') {
            const statuses = await getMigrationStatus(conn);
            statuses.forEach(s => console.log(`[${s.applied ? 'APPLIED' : 'PENDING'}] ${s.name}`));
        } else {
            console.error(`Unknown command: ${cmd}. Use up, down [count|name], or status.`);
            process.exitCode = 1;
        }
    } finally {
        await conn.end();
    }
}
