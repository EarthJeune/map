require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

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

// Initialize MySQL Database
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kiosk',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

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
                const defaultCoords = JSON.stringify([121.16198, 13.958679]);
                connection.query(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('kiosk_pin', ?)`, [defaultCoords]);
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

// API endpoint to get the "You Are Here" pin
app.get('/api/pin', async (req, res) => {
    try {
        const rows = await query(`SELECT \`value\` FROM settings WHERE \`key\` = 'kiosk_pin'`);
        if (rows.length > 0) {
            res.json({ coordinates: JSON.parse(rows[0].value) });
        } else {
            res.json({ coordinates: [121.16198, 13.958679] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API endpoint to update the "You Are Here" pin
app.post('/api/pin', async (req, res) => {
    const coords = req.body.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length !== 2) {
        return res.status(400).json({ error: 'Invalid coordinates format. Expected [lng, lat]' });
    }
    
    try {
        await query(
            `INSERT INTO settings (\`key\`, \`value\`) VALUES ('kiosk_pin', ?) 
             ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`)`, 
            [JSON.stringify(coords)]
        );
        res.json({ success: true, coordinates: coords });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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

// API endpoint to get building colors
app.get('/api/colors', async (req, res) => {
    try {
        const rows = await query(`SELECT building_id, roof_color, number_color FROM building_colors`);
        const colorsObj = {};
        rows.forEach(row => {
            colorsObj[row.building_id] = {
                roof: row.roof_color,
                icon: row.number_color
            };
        });
        res.json(colorsObj);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API endpoint to update building colors
app.post('/api/colors', async (req, res) => {
    const colors = req.body;
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
        res.status(500).json({ error: err.message });
    }
});

// API endpoint to save updated roads.json directly from road drawer tool
app.post('/api/roads', (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.features) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        if (fs.existsSync('roads.json')) {
            fs.copyFileSync('roads.json', 'roads.backup.json');
        }
        fs.writeFileSync('roads.json', JSON.stringify(data, null, 2), 'utf8');
        console.log(`Saved roads.json with ${data.features.length} features.`);
        res.json({ success: true, count: data.features.length });
    } catch (err) {
        console.error('Error saving roads.json:', err);
        res.status(500).json({ error: err.message });
    }
});

// API endpoint to get trees.json
app.get('/api/trees', (req, res) => {
    try {
        const treesPath = path.join(__dirname, 'trees.json');
        if (fs.existsSync(treesPath)) {
            const data = fs.readFileSync(treesPath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            res.json({ type: 'FeatureCollection', features: [] });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API endpoint to save trees.json
app.post('/api/trees', (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.features) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        const treesPath = path.join(__dirname, 'trees.json');
        if (fs.existsSync(treesPath)) {
            fs.copyFileSync(treesPath, path.join(__dirname, 'trees.backup.json'));
        }
        fs.writeFileSync(treesPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`Saved trees.json with ${data.features.length} trees.`);
        res.json({ success: true, count: data.features.length });
    } catch (err) {
        console.error('Error saving trees.json:', err);
        res.status(500).json({ error: err.message });
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
app.post('/api/buildings', (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.features) {
            return res.status(400).json({ error: 'Invalid GeoJSON: features array expected' });
        }
        
        // Automatically preserve has_3d_model: true for all bespoke 3D buildings
        const BUILDINGS_WITH_3D = new Set([
            'mis_rafis_building', 'tanco_hall_building', 'argosino_hall', 'canteen',
            'raed_building', 'guard_house', 'amad_building', 'pgrc_building',
            'prdp_building', 'ored_building', 'admin_building', 'lares_building',
            'laboratory_building', 'f2c2_building', 'ild_building', 'seaguard_building',
            'corn/casava_building', 'rsbsa_building', 'tissue_culture_building',
            'rcpc_building', 'motorpool_barracks', 'rnd_building', 'rsl_building',
            'exit_guard_house_1', 'exit_guard_house_2', 'multi_purpose_administrative_building',
            'dorm', 'guest_house', 'mushroom_laboratory'
        ]);
        for (const f of data.features) {
            if (f.properties && BUILDINGS_WITH_3D.has(f.properties.id)) {
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
        console.log(`Saved buildings to js/data/buildings.js with ${data.features.length} features.`);
        res.json({ success: true, count: data.features.length });
    } catch (err) {
        console.error('Error saving buildings:', err);
        res.status(500).json({ error: err.message });
    }
});


// Serve static files (like index.html, assets, etc.) with no-cache for instant development updates
app.use(express.static(__dirname, {
    etag: false,
    maxAge: 0,
    setHeaders: (res, path) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
}));

// Fallback to index.html for any other route
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let healthCheckInterval = null;

function restartCloudflareTunnel() {
    console.log('[Cloudflare] Tunnel unhealthy or disconnected. Restarting...');
    currentTunnelUrl = '';
    if (tunnelProcess) {
        try { tunnelProcess.kill(); } catch (e) {}
        tunnelProcess = null;
    }
    try {
        execSync('taskkill /F /IM cloudflared.exe 2>NUL', { stdio: 'ignore' });
    } catch (e) {}
    setTimeout(startCloudflareTunnel, 1500);
}

let tunnelRetryDelay = 5000;
let consecutive429Count = 0;
let lastTunnelError = '';

function startCloudflareTunnel() {
    if (process.env.NO_TUNNEL || process.argv.includes('--no-tunnel')) {
        console.log('[Cloudflare] Tunnel disabled via configuration (--no-tunnel or NO_TUNNEL=1).');
        return;
    }

    const cloudflaredExe = path.join(__dirname, 'cloudflared.exe');
    if (!fs.existsSync(cloudflaredExe)) {
        console.log('[Cloudflare] cloudflared.exe not found in directory. Running without public tunnel.');
        return;
    }

    // Terminate any old orphan cloudflared processes so a fresh process generates a valid tunnel
    try {
        execSync('taskkill /F /IM cloudflared.exe 2>NUL', { stdio: 'ignore' });
    } catch (e) {}

    console.log('[Cloudflare] Launching Cloudflare Tunnel for port ' + port + '...');
    currentTunnelUrl = '';
    lastTunnelError = '';
    try {
        tunnelProcess = spawn(cloudflaredExe, ['tunnel', '--url', `http://localhost:${port}`]);

        const parseTunnelOutput = (data) => {
            const str = data.toString();

            // Detect rate limits or errors
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

                // Persist to MySQL settings table
                query(
                    "INSERT INTO settings (`key`, `value`) VALUES ('tunnel_url', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
                    [currentTunnelUrl]
                ).catch(e => console.error('[Cloudflare] Failed to save tunnel URL to DB:', e.message));
            }
        };

        tunnelProcess.stdout.on('data', parseTunnelOutput);
        tunnelProcess.stderr.on('data', parseTunnelOutput);

        tunnelProcess.on('exit', (code) => {
            if (lastTunnelError) {
                console.log(`[Cloudflare] Tunnel note: ${lastTunnelError}`);
            }

            if (lastTunnelError.includes('429')) {
                consecutive429Count++;
                if (consecutive429Count >= 3) {
                    tunnelRetryDelay = 300000; // 5 minutes cooldown
                    console.log(`[Cloudflare] Rate limit persistent (${consecutive429Count}x). Pausing retries for 5 minutes to let Cloudflare cooldown.`);
                    console.log(`[Cloudflare] Local campus map is 100% active at http://localhost:${port}`);
                } else {
                    tunnelRetryDelay = 60000; // 1 minute cooldown
                    console.log(`[Cloudflare] Rate limited (HTTP 429). Waiting 60s for Cloudflare cooldown before retrying...`);
                }
            } else {
                tunnelRetryDelay = Math.min(tunnelRetryDelay * 1.5, 60000);
                console.log(`[Cloudflare] Tunnel exited with code ${code}. Restarting in ${Math.round(tunnelRetryDelay / 1000)}s...`);
            }

            currentTunnelUrl = '';
            tunnelProcess = null;
            setTimeout(startCloudflareTunnel, tunnelRetryDelay);
        });

        tunnelProcess.on('error', (err) => {
            console.error('[Cloudflare] Error launching tunnel:', err.message);
            currentTunnelUrl = '';
        });
    } catch (err) {
        console.error('[Cloudflare] Exception starting tunnel:', err.message);
        currentTunnelUrl = '';
    }

    // Start proactive health check every 45 seconds to keep tunnel alive
    if (!healthCheckInterval) {
        healthCheckInterval = setInterval(async () => {
            if (!currentTunnelUrl) return;
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 6000);
                const res = await fetch(`${currentTunnelUrl}/api/tunnel`, { signal: controller.signal });
                clearTimeout(timeout);
                if (!res.ok) {
                    console.log(`[Cloudflare] Health check status ${res.status}. Restarting tunnel...`);
                    restartCloudflareTunnel();
                }
            } catch (e) {
                console.log(`[Cloudflare] Health check ping failed (${e.message}). Restarting tunnel...`);
                restartCloudflareTunnel();
            }
        }, 45000);
    }
}

// Graceful cleanup
process.on('SIGINT', () => {
    if (tunnelProcess) tunnelProcess.kill();
    process.exit();
});
process.on('SIGTERM', () => {
    if (tunnelProcess) tunnelProcess.kill();
    process.exit();
});

app.listen(port, () => {
    console.log(`Kiosk Backend Server running at http://localhost:${port}`);
    startCloudflareTunnel();
});
