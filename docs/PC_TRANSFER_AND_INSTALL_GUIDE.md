# iGUIDE — Hard Drive Transfer & PC Installation Guide

This guide lists **exactly which files and folders to copy** from the development machine onto an external hard drive (or USB flash drive), and provides a **step-by-step tutorial** to install and run **iGUIDE** (`DA-CALABARZON Interactive 3D Campus Map`) on a new Windows PC or Lobby Kiosk.

---

## Part 1: What to Copy onto Your External Hard Drive

Create a folder on your external hard drive named **`iGUIDE_Transfer`** with three subfolders:

```text
E:\iGUIDE_Transfer\
├── map\               ← Core iGUIDE application files (~805 MB total)
├── database\          ← Exported MySQL database backup (kiosk_backup.sql)
└── installers\        ← (Optional) Offline installers for Node.js & XAMPP/MySQL
```

### 1. Required Files & Folders to Copy into `E:\iGUIDE_Transfer\map\`

Copy all of the items below from `C:\Users\LGU-SanPedro\Downloads\map\`:

| Category | Exact Files / Folders | Approx. Size | Why It's Needed |
| :--- | :--- | :---: | :--- |
| **Server & Config** | `server.js`, `package.json`, `package-lock.json`, `manifest.json`, `qrcode.min.js`, `.env` | ~0.3 MB | Core Node.js Express server, dependencies list, and live settings/secrets |
| **Web App & UI** | `js/`, `css/`, `fonts/`, `icons/`, `Main Icon/`, `vendor/`, `database/`, `tools/` | ~6.4 MB | Frontend 3D map engine, portal, icons, migrations, and scripts |
| **HTML Pages & Editors** | `index.html`, `admin.html`, `draw.html`, `plot_draw.html`, `road_draw.html`, `tree_draw.html`, `pill_adjust.html`, `qares_draw.html`, `qares_road_draw.html`, `qares_boundary_draw.html`, `legacy.html` | ~0.6 MB | Main 3D map, Staff Review Portal, and all Visual Map Editors |
| **3D Models & Photos** | `models/`, `images/`, `qares_ortho.png`, `qares_ortho_thumb.png` | ~101.7 MB | All `.glb` 3D building models and optimized `.webp` facility photos |
| **Offline Drone Maps** | `LARES v1.mbtiles`, `QARES v1.mbtiles`, `RARES v1.mbtiles` | ~640.6 MB | High-resolution offline drone orthomosaics for all stations |
| **Campus Geo & Config JSONs** | `buildings.json`, `roads.json`, `colors.json`, `trees.json`, `pin.json`, `drone_offset.json`, `QARES Boundaries.geojson`, `qares_boundary.json`, `qares_buildings.json`, `qares_pin.json`, `qares_roads.json`, `rares_boundary.json`, `rares_buildings.json`, `rares_pin.json`, `rares_plots.json`, `rares_roads.json` | ~0.6 MB | Surveyed footprints, walkway routing graphs, boundaries, and pins |
| **Tunnel & Startup Scripts** | `cloudflared.exe`, `start_kiosk.bat`, `start_kiosk_silent.vbs`, `start_admin.bat`, `create_shortcuts.ps1` | ~52.8 MB | Named Cloudflare Tunnel (`iguide.daivcalabarzon.site`) & 1-click launchers |
| **Documentation (Optional)** | `docs/`, `AGENTS.md` | ~14.8 MB | Setup runbooks and transfer guides |

> **Total Required Transfer Size:** **~805 MB** (easily fits on any external hard drive or 2 GB+ USB drive).

---

### 2. Folders You Can SKIP (Saves ~1.85 GB!)

Do **NOT** copy these folders unless you specifically want raw Blender/development archives on the new PC:

| Skip Folder | Approx. Size | Why You Can Skip It |
| :--- | :---: | :--- |
| `Building Images/` | 913.9 MB | Raw uncompressed camera reference photos (optimized `.webp` photos are already in `images/`) |
| `Building Images RARES/` | 593.5 MB | Raw RARES modeling photos (already converted in `images/`) |
| `renders/` | 131.9 MB | Blender modeling preview renders |
| `node_modules/` | 46.0 MB | Rebuilt cleanly on the new PC via `npm install` (ensures `sqlite3` matches the new PC's Node version) |
| `archive/`, `scratch/`, `.agents/`, `.vscode/` | ~55.3 MB | Temporary scratch scripts and old backups |
| `.git/` | 146.7 MB | Only copy if the new PC will be used for Git development; skip for Kiosk/Server PCs |

---

### 3. Export the Live MySQL Database (CRITICAL — Do Before Unplugging!)

All staff accounts, change-request history, published facility updates, and station records live in MySQL database **`kiosk`**.

On the **source PC**, open **PowerShell** and run:

```powershell
# Replace E:\ with your external hard drive letter
mkdir E:\iGUIDE_Transfer\database -Force

# If using XAMPP MySQL:
& "C:\xampp\mysql\bin\mysqldump.exe" -u root kiosk > "E:\iGUIDE_Transfer\database\kiosk_backup.sql"

# OR if MySQL is installed directly in PATH:
mysqldump -u root -p kiosk > "E:\iGUIDE_Transfer\database\kiosk_backup.sql"
```

Verify that `E:\iGUIDE_Transfer\database\kiosk_backup.sql` is created and is **not 0 KB**.

---

### 4. (Recommended) Download Offline Installers onto the Hard Drive

If the new PC has slow or restricted internet, download these two installers ahead of time into `E:\iGUIDE_Transfer\installers\`:
1. **Node.js 20 LTS (Windows 64-bit `.msi`)** — from https://nodejs.org/
2. **XAMPP for Windows (includes MySQL & phpMyAdmin)** — from https://www.apachefriends.org/
3. **Google Chrome** (for Kiosk / 3D WebGL viewing)

---

## Part 2: Step-by-Step Tutorial — Installing iGUIDE on the New PC

### Step 1: Install Prerequisites on the New PC
1. **Install Node.js 20 LTS** — run the `.msi` installer with default options (keep *"Add to PATH"* checked).
2. **Install XAMPP** (or MySQL Server) — install to `C:\xampp`.
3. Open **XAMPP Control Panel** and click **Start** next to **MySQL** (Wait until the `MySQL` label turns green on port `3306`).
4. Verify Node.js works by opening **PowerShell** and running:
   ```powershell
   node -v
   npm -v
   ```
   *(You should see `v20.x.x` or newer.)*

---

### Step 2: Copy the Project Files from the Hard Drive to the PC
1. Plug the external hard drive into the new PC.
2. Copy the `map` folder to a clean permanent path on the PC — recommended:
   ```text
   C:\iGUIDE\map
   ```
   *(Avoid spaces or temporary Desktop/Downloads folders if this PC will run as a server or kiosk.)*
3. Confirm that `C:\iGUIDE\map\.env`, `C:\iGUIDE\map\server.js`, and all three `.mbtiles` files (`LARES v1.mbtiles`, `QARES v1.mbtiles`, `RARES v1.mbtiles`) are inside `C:\iGUIDE\map\`.

---

### Step 3: Install Node.js Packages
Open **PowerShell** inside `C:\iGUIDE\map` and run:

```powershell
cd C:\iGUIDE\map
npm install
```

This installs Express, MySQL2, SQLite3 (for `.mbtiles` drone maps), Turf.js, Nodemailer, and Three.js.

---

### Step 4: Restore the MySQL Database (`kiosk`)

#### Option A — Using PowerShell (Fastest)
```powershell
# 1. Create the 'kiosk' database
& "C:\xampp\mysql\bin\mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS kiosk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Import the backup from your hard drive (adjust E:\ if needed)
Get-Content "E:\iGUIDE_Transfer\database\kiosk_backup.sql" -Raw | & "C:\xampp\mysql\bin\mysql.exe" -u root kiosk
```

#### Option B — Using phpMyAdmin (Browser UI)
1. In XAMPP Control Panel, start both **Apache** and **MySQL**.
2. Open `http://localhost/phpmyadmin` in Chrome.
3. Click **New** (left sidebar) → Database name: **`kiosk`** → Collation: **`utf8mb4_unicode_ci`** → click **Create**.
4. Click **`kiosk`** → open the **Import** tab → choose `E:\iGUIDE_Transfer\database\kiosk_backup.sql` → click **Import**.

*(After importing, run `npm run migrate` inside `C:\iGUIDE\map` to verify all schema migrations are up to date.)*

---

### Step 5: Verify `.env` Settings on the New PC
Open `C:\iGUIDE\map\.env` in Notepad and check these key values:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=                # Match the new PC's MySQL password (blank by default in XAMPP)
DB_NAME=kiosk
PORT=4321
PUBLIC_BASE_URL=https://iguide.daivcalabarzon.site
NO_TUNNEL=0                 # Set to 1 if running OFFLINE/LAN-only without Cloudflare Tunnel
CLOUDFLARE_TUNNEL_TOKEN=... # Keep existing token to publish to https://iguide.daivcalabarzon.site
```

> **Important (Avoid Tunnel Conflicts):** Only **ONE PC** should run `NO_TUNNEL=0` with `CLOUDFLARE_TUNNEL_TOKEN` at a time. If the old PC is still running the tunnel, stop the old PC's server first (or set `NO_TUNNEL=1` on any secondary/offline test PC).

---

### Step 6: Start iGUIDE & Verify Everything Works
In PowerShell:

```powershell
cd C:\iGUIDE\map
node server.js
```

Wait 3–5 seconds until you see the server listening on port `4321`. Then open Google Chrome and test:

1. **Main 3D Campus Map:** `http://localhost:4321/`
2. **Staff & Admin Portal:** `http://localhost:4321/admin.html`
3. **Tunnel / QR Health Check:** `http://localhost:4321/api/tunnel`
   - Should return `"tunnelUrl": "https://iguide.daivcalabarzon.site"` (when online with `NO_TUNNEL=0`).
4. **Automated Health Test (Optional):**
   ```powershell
   npm test
   ```
   - All **26/26** automated checks should pass.

---

### Step 7: Set Up Desktop Shortcuts & Kiosk Auto-Start (Optional)

- **1-Click Launchers (already included in `C:\iGUIDE\map\`):**
  - `start_kiosk.bat` — Starts `server.js` and opens Chrome in fullscreen Kiosk mode.
  - `start_kiosk_silent.vbs` — Launches `start_kiosk.bat` silently without a black console window.
  - `start_admin.bat` — Opens the Staff / Admin Governance Portal.
- **Auto-start on Windows Boot (for Lobby Kiosk PCs):**
  1. Press `Win + R`, type `shell:startup`, and press **Enter**.
  2. Create a shortcut to `C:\iGUIDE\map\start_kiosk_silent.vbs` inside that Startup folder.
  3. In **XAMPP Control Panel → Config (top right)**, check **Autostart of modules: MySQL** so MySQL starts automatically when Windows boots.

---

## Quick Troubleshooting Checklist

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL is not running | Open XAMPP Control Panel and click **Start** on **MySQL** |
| `Access denied for user 'root'` | MySQL password mismatch | Update `DB_PASSWORD=` in `C:\iGUIDE\map\.env` to match MySQL |
| Drone map layer is blank | Missing `.mbtiles` files or `sqlite3` build | Confirm `LARES v1.mbtiles`, `QARES v1.mbtiles`, `RARES v1.mbtiles` are in `C:\iGUIDE\map\` and re-run `npm install` |
| `iguide.daivcalabarzon.site` shows 502 / offline | Tunnel disabled or missing `cloudflared.exe` | Ensure `cloudflared.exe` is in `C:\iGUIDE\map\`, `NO_TUNNEL=0`, and internet is connected |
| Port `4321` already in use | Another `node server.js` is running | Run `taskkill /F /IM node.exe` in PowerShell, then start `node server.js` again |
