import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testsDir = path.join(__dirname, 'tests');

const files = fs.existsSync(testsDir)
    ? fs.readdirSync(testsDir)
        .filter(f => f.endsWith('.test.mjs'))
        .sort()
        .map(f => path.join(testsDir, f))
    : [];

if (files.length === 0) {
    console.error('No *.test.mjs files found in tools/tests');
    process.exit(1);
}

const res = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(res.status ?? 1);
