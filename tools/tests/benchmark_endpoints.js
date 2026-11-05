const http = require('http');

const endpoints = [
    '/',
    '/index.html',
    '/buildings.json',
    '/roads.json',
    '/trees.json',
    '/qares_roads.json',
    '/api/colors',
    '/14/13706/7550.png',
    '/qares/14/13715/7551.png'
];

function testEndpoint(ep) {
    return new Promise(resolve => {
        const t0 = process.hrtime.bigint();
        http.get('http://localhost:8080' + ep, res => {
            let bytes = 0;
            res.on('data', chunk => { bytes += chunk.length; });
            res.on('end', () => {
                const dtMs = Number(process.hrtime.bigint() - t0) / 1e6;
                resolve({ ep, status: res.statusCode, dtMs, bytes });
            });
        }).on('error', err => {
            resolve({ ep, status: 'ERROR', error: err.message });
        });
    });
}

(async () => {
    console.log('Testing server endpoints on http://localhost:8080:');
    for (const ep of endpoints) {
        const r = await testEndpoint(ep);
        if (r.status === 'ERROR') {
            console.error(`[ERR] ${r.ep}: ${r.error}`);
        } else {
            console.log(`[${r.status}] ${r.ep.padEnd(28)} : ${r.dtMs.toFixed(2).padStart(6)} ms  (${(r.bytes / 1024).toFixed(1).padStart(6)} KB)`);
        }
    }
})();
