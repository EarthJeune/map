# iGUIDE — Hard Drive Transfer & PC Installation Guide (Laragon + Node.js)

This guide matches our exact working setup (**Node.js LTS + Laragon MySQL 8.4 + Cloudflare Named Tunnel**) and documents everything transferred to **`D:\iGUIDE_Transfer\`** along with a step-by-step tutorial to install and run **iGUIDE** (`DA-CALABARZON Interactive 3D Campus Map`) on the target Windows PC.

---

## Part 1: What Is on Your External Hard Drive (`D:\iGUIDE_Transfer\`)

```text
D:\iGUIDE_Transfer\
├── PC_TRANSFER_AND_INSTALL_GUIDE.md   ← This guide
├── map\                               ← Core iGUIDE application files (878 files, ~818.5 MB)
├── database\
│   └── kiosk_backup.sql               ← Live MySQL 'kiosk' database backup (~412.5 KB)
└── installers\                        ← (Optional) Offline installers for Node.js & Laragon
```

### 1. Required Files & Folders Included in `map\`

| Category | Exact Files / Folders | Approx. Size | Why It's Needed |
| :--- | :--- | :---: | :--- |
| **Server & Config** | `server.js`, `package.json`, `package-lock.json`, `manifest.json`, `qrcode.min.js`, `.env` | ~0.3 MB | Core Node.js Express server, dependencies list, and live settings/secrets |
| **Web App & UI** | `js/`, `css/`, `fonts/`, `icons/`, `Main Icon/`, `vendor/`, `database/`, `tools/` | ~6.4 MB | Frontend 3D map engine, `/login` portal, icons, migrations, and scripts |
| **HTML Pages & Editors** | `index.html`, `admin.html`, `draw.html`, `plot_draw.html`, `road_draw.html`, `tree_draw.html`, `pill_adjust.html`, `qares_draw.html`, `qares_road_draw.html`, `qares_boundary_draw.html`, `legacy.html` | ~0.6 MB | Main 3D map, Staff Review Portal (`/login`), and all 5 Visual Map Editors |
| **3D Models & Photos** | `models/` (102 `.glb` files), `images/` (282 `.webp` photos), `qares_ortho.png`, `qares_ortho_thumb.png` | ~101.7 MB | All 3D building models and optimized facility drawer photos |
| **Offline Drone Maps** | `LARES v1.mbtiles`, `QARES v1.mbtiles`, `RARES v1.mbtiles` | ~640.6 MB | High-resolution offline drone orthomosaics for all stations |
| **Campus Geo & Config JSONs** | `buildings.json`, `roads.json`, `colors.json`, `trees.json`, `pin.json`, `drone_offset.json`, `QARES Boundaries.geojson`, `qares_*.json`, `rares_*.json` | ~0.6 MB | Surveyed footprints, walkway routing graphs, boundaries, and pins |
| **Tunnel & Startup Scripts** | `cloudflared.exe`, `start_kiosk.bat`, `start_kiosk_silent.vbs`, `start_admin.bat`, `create_shortcuts.ps1` | ~52.8 MB | Named Cloudflare Tunnel (`iguide.daivcalabarzon.site`) & 1-click launchers |
| **Documentation** | `docs/`, `AGENTS.md` | ~14.8 MB | Setup runbooks and transfer guides |

> **Total Transfer Size:** **~818.9 MB** (already verified on `D:\iGUIDE_Transfer\`).

---

### 2. Folders Intentionally Skipped (Saves ~1.85 GB)

| Skipped Folder | Approx. Size | Why It's Not Needed |
| :--- | :---: | :--- |
| `Building Images/` | 913.9 MB | Raw uncompressed Blender reference photos (all 282 optimized `.webp` photos are already in `images/`) |
| `Building Images RARES/` | 593.5 MB | Raw RARES modeling photos (already converted in `images/`) |
| `renders/` | 131.9 MB | Blender modeling preview screenshots |
| `node_modules/` | 46.0 MB | Rebuilt cleanly on the new PC via `npm install` (ensures `sqlite3` matches the new PC's Node version) |
| `archive/`, `scratch/`, `.agents/`, `.vscode/` | ~55.3 MB | Temporary scripts and old backups |
| `.git/` | 146.7 MB | Only needed on developer laptops (optional if you plan to use `git pull` on the new PC) |

---

### 3. Re-Exporting the MySQL Database Later (Reference Command)

If you ever need a fresh database backup from a Laragon PC before transferring again:

```powershell
# Run in PowerShell on the source PC (Laragon MySQL 8.4)
$dump = (Get-ChildItem "C:\laragon\bin\mysql\*\bin\mysqldump.exe" | Select-Object -First 1).FullName
& $dump -u root -p --single-transaction --routines --triggers --default-character-set=utf8mb4 --result-file="D:\iGUIDE_Transfer\database\kiosk_backup.sql" kiosk
```

---

## Part 2: Step-by-Step Tutorial — Installing iGUIDE on the New PC

### Step 1: Install Prerequisites on the New PC
1. **Install Node.js 20 LTS (Windows 64-bit `.msi`)** from https://nodejs.org/
   - Keep *"Add to PATH"* checked during installation.
2. **Install Laragon (Full)** from https://laragon.org/download/
   - Install to the default path **`C:\laragon`** (includes **MySQL 8.4** and **HeidiSQL** database viewer — matching our exact development setup).
3. Open **Laragon** and click **Start All** (wait until **MySQL** shows green on port `3306`).
4. Verify Node.js in **PowerShell**:
   ```powershell
   node -v
   npm -v
   ```

---

### Step 2: Copy iGUIDE from the Hard Drive to the PC
1. Plug the external hard drive into the new PC (note its drive letter, e.g., `D:\` or `E:\`).
2. Copy `iGUIDE_Transfer\map` to a clean permanent folder on the PC — recommended:
   ```text
   C:\iGUIDE\map
   ```
3. Confirm `C:\iGUIDE\map\.env`, `C:\iGUIDE\map\server.js`, `C:\iGUIDE\map\cloudflared.exe`, and all three `.mbtiles` files (`LARES v1.mbtiles`, `QARES v1.mbtiles`, `RARES v1.mbtiles`) are present.

---

### Step 3: Install Node.js Dependencies
Open **PowerShell** inside `C:\iGUIDE\map` and run:

```powershell
cd C:\iGUIDE\map
npm install
```

This installs Express, MySQL2, SQLite3 (for `.mbtiles` drone maps), Turf.js, Nodemailer, and Three.js.

---

### Step 4: Restore the MySQL Database (`kiosk`) in Laragon

#### Option A — Using PowerShell (Fastest, 1 Command)
```powershell
# Auto-locate Laragon's mysql.exe
$mysql = (Get-ChildItem "C:\laragon\bin\mysql\*\bin\mysql.exe" | Select-Object -First 1).FullName

# 1. Create the 'kiosk' database
& $mysql -u root -e "CREATE DATABASE IF NOT EXISTS kiosk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Import the backup from your hard drive (change D:\ if your drive letter differs)
Get-Content "D:\iGUIDE_Transfer\database\kiosk_backup.sql" -Raw | & $mysql -u root kiosk
```
*(If your Laragon MySQL root account has a password, add `-p` after `-u root`.)*

#### Option B — Using Laragon's Built-In HeidiSQL (Visual UI)
1. In **Laragon**, click the **Database** button (opens **HeidiSQL**).
2. Click **Open** to connect to `127.0.0.1` (`root`).
3. Right-click the server name → **Create new → Database** → Name: **`kiosk`**, Collation: **`utf8mb4_unicode_ci`** → **OK**.
4. Click the **`kiosk`** database → top menu **File → Load SQL file…** → select `D:\iGUIDE_Transfer\database\kiosk_backup.sql` → click the blue **Run (`F9`)** button.

*(After importing, run `npm run migrate` inside `C:\iGUIDE\map` to confirm all migrations are up to date.)*

---

### Step 5: Verify `.env` Settings on the New PC
Open `C:\iGUIDE\map\.env` in Notepad and verify these settings:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=                # Match the new PC's Laragon MySQL root password (blank by default in fresh Laragon)
DB_NAME=kiosk
PORT=4321
PUBLIC_BASE_URL=https://iguide.daivcalabarzon.site
NO_TUNNEL=0                 # Keep 0 on the live server PC; set 1 on any local-only dev laptop
CLOUDFLARE_TUNNEL_TOKEN=... # Keep existing token to publish to https://iguide.daivcalabarzon.site
```

> **Important (Avoid Tunnel Conflicts):** Only **ONE PC** should run `NO_TUNNEL=0` with `CLOUDFLARE_TUNNEL_TOKEN` at a time. Once this New PC goes live, set **`NO_TUNNEL=1`** on your old development laptop so the laptop runs strictly on `http://localhost:4321`.

---

### Step 6: Start iGUIDE & Verify Everything Works
In PowerShell:

```powershell
cd C:\iGUIDE\map
node server.js
```

Wait 3–5 seconds until you see the server listening on port `4321`, then verify in Google Chrome:

1. **Main 3D Campus Map:** `http://localhost:4321/`
2. **Staff & Admin Portal:** `http://localhost:4321/login` (and live at `https://iguide.daivcalabarzon.site/login`)
3. **Tunnel / QR Health Check:** `http://localhost:4321/api/tunnel`
   - Should return `"tunnelUrl": "https://iguide.daivcalabarzon.site"`.
4. **Automated Health Test (Optional):**
   ```powershell
   cd C:\iGUIDE\map
   npm test
   ```
   - All **26/26** automated tests should pass.

---

### Step 7: Auto-Start on Boot & Kiosk Shortcuts (Optional)

- **Included Launchers in `C:\iGUIDE\map\`:**
  - `start_kiosk.bat` — Starts `server.js` and opens Chrome in fullscreen Kiosk mode.
  - `start_kiosk_silent.vbs` — Runs `start_kiosk.bat` silently without a console window.
  - `start_admin.bat` — Opens the `/login` Staff & Admin Portal.
- **Auto-start on Windows Boot (for Server / Lobby Kiosk PC):**
  1. In **Laragon → Menu (gear icon) → General**, check **Run Laragon when Windows starts** and **Start All automatically**.
  2. Press `Win + R`, type `shell:startup`, press **Enter**, and place a shortcut to `C:\iGUIDE\map\start_kiosk_silent.vbs` inside.

---

## Quick Troubleshooting Checklist

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| `ECONNREFUSED 127.0.0.1:3306` | Laragon MySQL is stopped | Open **Laragon** and click **Start All** |
| `Access denied for user 'root'` | MySQL password mismatch | Update `DB_PASSWORD=` in `C:\iGUIDE\map\.env` to match Laragon MySQL |
| Drone map layer is blank | Missing `.mbtiles` or `sqlite3` native build | Confirm all 3 `.mbtiles` files are in `C:\iGUIDE\map\` and re-run `npm install` |
| `iguide.daivcalabarzon.site` shows 502 / offline | Tunnel disabled or missing `cloudflared.exe` | Ensure `cloudflared.exe` is in `C:\iGUIDE\map\`, `NO_TUNNEL=0`, and internet is connected |
| Port `4321` already in use | Another `node server.js` is running | Run `taskkill /F /IM node.exe` in PowerShell, then start `node server.js` again |
