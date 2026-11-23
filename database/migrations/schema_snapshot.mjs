/**
 * Schema Snapshot Backup Utility for iGUIDE MySQL Database
 * Exports SHOW CREATE TABLE DDL for all live tables to database/backups/.
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const BACKUP_DIR = path.join(ROOT_DIR, 'database', 'backups');

export async function exportSchemaSnapshot(outPath = null) {
    const dbName = process.env.DB_NAME || 'kiosk';
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: dbName
    });

    try {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
        const targetPath = outPath || path.join(BACKUP_DIR, 'schema_baseline_latest.sql');
        const [tableRows] = await conn.query(`SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'`);
        const tableNames = tableRows.map(r => Object.values(r)[0]).filter(Boolean);

        const chunks = [
            `-- iGUIDE MySQL Schema Backup`,
            `-- Database: ${dbName}`,
            `-- Exported at: ${new Date().toISOString()}`,
            `-- Tables (${tableNames.length}): ${tableNames.join(', ')}`,
            ``,
            `SET FOREIGN_KEY_CHECKS = 0;`,
            ``
        ];

        const tableCounts = {};
        for (const tbl of tableNames) {
            const [createRows] = await conn.query(`SHOW CREATE TABLE \`${tbl.replace(/`/g, '')}\``);
            const ddl = createRows[0]?.['Create Table'] || createRows[0]?.['Create View'] || '';
            const [cntRows] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${tbl.replace(/`/g, '')}\``);
            tableCounts[tbl] = Number(cntRows[0]?.cnt || 0);
            chunks.push(`-- Table: ${tbl} (${tableCounts[tbl]} rows)`);
            chunks.push(`${ddl};`);
            chunks.push('');
        }

        chunks.push(`SET FOREIGN_KEY_CHECKS = 1;`);
        chunks.push('');

        fs.writeFileSync(targetPath, chunks.join('\n'), 'utf8');
        return { path: targetPath, dbName, tables: tableNames, tableCounts };
    } finally {
        await conn.end();
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    exportSchemaSnapshot()
        .then((res) => {
            console.log(`Schema backup written to ${res.path}`);
            console.log(`Tables (${res.tables.length}):`, res.tableCounts);
        })
        .catch((err) => {
            console.error('Schema backup failed:', err.message);
            process.exit(1);
        });
}
