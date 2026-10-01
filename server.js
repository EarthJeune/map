require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

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

// API endpoint to get the current public tunnel URL
app.get('/api/tunnel', async (req, res) => {
    if (currentTunnelUrl) {
        return res.json({ url: currentTunnelUrl });
    }
    try {
        const rows = await query("SELECT `value` FROM settings WHERE `key` = 'tunnel_url'");
        if (rows.length > 0) {
            res.json({ url: rows[0].value });
        } else {
            res.json({ url: 'https://studio-comprehensive-mariah-styles.trycloudflare.com' });
        }
    } catch (err) {
        res.json({ url: 'https://studio-comprehensive-mariah-styles.trycloudflare.com' });
    }
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

function startCloudflareTunnel() {
    const cloudflaredExe = path.join(__dirname, 'cloudflared.exe');
    if (!fs.existsSync(cloudflaredExe)) {
        console.log('[Cloudflare] cloudflared.exe not found in directory. Running without public tunnel.');
        return;
    }

    console.log('[Cloudflare] Launching Cloudflare Tunnel for port ' + port + '...');
    try {
        tunnelProcess = spawn(cloudflaredExe, ['tunnel', '--url', `http://localhost:${port}`]);

        const parseTunnelOutput = (data) => {
            const str = data.toString();
            const match = str.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
            if (match && match[0] && match[0] !== currentTunnelUrl) {
                currentTunnelUrl = match[0];
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
            console.log(`[Cloudflare] Tunnel exited with code ${code}. Restarting in 5s...`);
            tunnelProcess = null;
            setTimeout(startCloudflareTunnel, 5000);
        });

        tunnelProcess.on('error', (err) => {
            console.error('[Cloudflare] Error launching tunnel:', err.message);
        });
    } catch (err) {
        console.error('[Cloudflare] Exception starting tunnel:', err.message);
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
