const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

const regex = /(?:src|href)=["']([^"']+)["']/g;
let match;
const localAssets = [];

while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    if (!url.startsWith('http') && !url.startsWith('//') && !url.startsWith('#') && !url.startsWith('data:')) {
        const cleanPath = url.split('?')[0];
        localAssets.push({ raw: url, clean: cleanPath });
    }
}

console.log('Total local assets referenced in index.html:', localAssets.length);
let missing = 0;
localAssets.forEach(a => {
    if (!fs.existsSync(a.clean)) {
        console.error('MISSING ASSET:', a.raw, '->', a.clean);
        missing++;
    }
});
if (missing === 0) {
    console.log('All local assets in index.html exist!');
}
