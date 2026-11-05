const fs = require('fs');

const content = fs.readFileSync('js/data/buildings.js', 'utf8');
const modelMatches = [...content.matchAll(/modelUrl:\s*['"]([^'"]+)['"]/g)];

console.log(`Found ${modelMatches.length} 3D model entries in CUSTOM_3D_BUILDINGS:`);

let totalSize = 0;
let errors = 0;

modelMatches.forEach(m => {
    const rawUrl = m[1];
    const filePath = rawUrl.split('?')[0];
    if (!fs.existsSync(filePath)) {
        console.error(`MISSING MODEL: ${filePath}`);
        errors++;
        return;
    }
    const stat = fs.statSync(filePath);
    const sizeKb = stat.size / 1024;
    totalSize += stat.size;

    // Check GLB header (first 4 bytes should be 'glTF' => 0x46546C67 in little endian or 0x67, 0x6C, 0x54, 0x46)
    const buf = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    const magic = buf.toString('utf8');

    const ok = sizeKb <= 300 && magic === 'glTF';
    if (!ok) {
        console.error(`ISSUE with ${filePath}: Size=${sizeKb.toFixed(1)} KB (Budget <= 300 KB), Header='${magic}'`);
        errors++;
    } else {
        // console.log(`✓ ${filePath.padEnd(35)} : ${sizeKb.toFixed(1).padStart(5)} KB [valid glTF]`);
    }
});

console.log(`\nAudited ${modelMatches.length} models.`);
console.log(`Total 3D model footprint: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
console.log(`Errors / Budget violations: ${errors}`);
