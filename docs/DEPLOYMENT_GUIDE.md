# 🏛️ DA-LARES Interactive Campus Map — Pre-Deployment & Deployment Master Guide

**Target System:** DA-LARES 3D Interactive Wayfinding & Touch Kiosk System  
**Station Focus:** DA-LARES Main Campus (Lipa City, Batangas)  
**Host Target:** Dedicated 24/7 Always-On Server PC + Web Domain  
**Last Updated:** October 2026  

---

## 📋 Table of Contents
1. [Executive Summary & Deployment Strategy](#1-executive-summary--deployment-strategy)
2. [Campus Completeness & Pre-Deployment Audit](#2-campus-completeness--pre-deployment-audit)
3. [Offline Drone Orthomosaic MBTiles Engine](#3-offline-drone-orthomosaic-mbtiles-engine)
4. [Database Resilience Architecture](#4-database-resilience-architecture)
5. [Security & Admin Mode Governance](#5-security--admin-mode-governance)
6. [Domain Roadmap: Pre-Domain vs. Official Domain](#6-domain-roadmap-pre-domain-vs-official-domain)
7. [24/7 Server PC Operating System & Hardware Configuration](#7-247-server-pc-operating-system--hardware-configuration)
8. [Step-by-Step Server Migration & Launch Runbook](#8-step-by-step-server-migration--launch-runbook)

---

## 1. Executive Summary & Deployment Strategy

The **DA-LARES Interactive 3D Wayfinding System** is transitioning from local development into production deployment. 

### Key Strategic Decisions:
- **Sole Campus Focus:** 100% focused on **DA-LARES (Lipa City)** to ensure flawless completion, full stability, and zero bugs ahead of on-site kiosk deployment.
- **Hosting Model:** The system will run on a **dedicated, always-on (24/7) Windows Server PC** connected to the campus network, and will eventually be mapped to an official public domain (e.g., `https://map.da-lares.gov.ph`).
- **Client Endpoints:**
  1. **Physical Touch Kiosks (Lobbies):** Full-screen touch totems running in locked Chromium kiosk mode (`?mode=kiosk`).
  2. **Visitor Mobile Devices:** Visitors scanning on-screen QR codes navigate via mobile web (`?mode=phone`) with live GPS and turn-by-turn guidance.
  3. **Multi-Kiosk Scaling:** Future kiosks placed in other buildings can simply open the domain link without running individual servers.

---

## 2. Campus Completeness & Pre-Deployment Audit

Every major pillar of the DA-LARES campus has been completed and verified:

| System Component | Status | Production Specification |
|---|:---:|---|
| **3D Building Models** | ✅ 30 / 30 Complete | Every single facility has an authentic, bespoke 3D GLB model under the **300 KB budget** (entire campus model footprint is only **~4.9 MB**). |
| **A* Pedestrian Road Network** | ✅ 34 Entrances | Connected road graph in `roads.json` linking all 30 buildings to the Argosino Hall kiosk pin. |
| **Animated Walker Avatar** | ✅ Complete | Dynamic claymation walker with turn-by-turn distance countdowns, step highlighting, and arrival celebration. |
| **Two-Tier Wayfinding Info** | ✅ Complete | Human-centered cards in `js/data/descriptions.js`: Visual Landmark (*"How to Spot It"*) + Key Services (*"What's Inside"*) + Clickable Office Chips. |
| **Intro Menu Flow** | ✅ Optimized | The background camera remains **100% stationary** when the Welcome modal loads; the signature 3D fly-in plays **only once** upon clicking *"Proceed to Campus Map"*. |
| **Kiosk Auto-Reset** | ✅ Complete | Inactivity timeout auto-resets active routes, collapses panels, and returns to the "You Are Here" pin with a 5-minute thermal eco-rest loop. |

---

## 3. Offline Drone Orthomosaic MBTiles Engine

The campus aerial drone layer uses high-resolution photogrammetric tile pyramids packaged in SQLite MBTiles databases.

### 📍 Storage & File Locations
Both `.mbtiles` files must be placed directly inside the `map/` application root folder:
- **`LARES v1.mbtiles`** — **10.28 GB** (Ultra-high-resolution drone imagery for DA-LARES Lipa campus).
- **`QARES v1.mbtiles`** — **234 MB** (DA-QARES Tiaong compound raster).

### ⚡ Automatic Path Discovery in `server.js`
The server uses `path.join(__dirname, 'LARES v1.mbtiles')`. Placing the file inside `map/` ensures:
- The server detects the drone tiles immediately on **any PC**, regardless of the Windows username (e.g. `Administrator`, `DA-Server`).
- Prepared SQLite queries (`SELECT tile_data FROM tiles...`) deliver **sub-millisecond tile streaming** with zero external internet required.

### 🛑 Git Backup Rules (`.gitignore`)
- Because GitHub has a **100 MB hard limit per file**, `*.mbtiles` is explicitly excluded in `.gitignore` (line 27).
- **Git Backups:** Pushing to GitHub backs up all code, 3D models (`models/*.glb`), JSON files, HTML, and CSS (< 50 MB total).
- **MBTiles Transfer:** The 10.28 GB `.mbtiles` file must be copied manually to the Server PC via a **USB 3.0 external drive** (formatted in NTFS or exFAT) or high-speed local network share.

> [!WARNING]
> If moving or copying `LARES v1.mbtiles` on Windows, you must temporarily stop `node server.js` first; otherwise, Windows will show a *"File In Use by Node.js JavaScript Runtime"* lock error.

---

## 4. Database Architecture, Live Portal & Backups

The application runs on **Node.js + Express (`server.js`)** backed by the **MySQL `kiosk` database** (for RBAC auth, `/login` governance, facility records, offices, `.webp` photos, agricultural plots, plot split/merge history, audit logs, and live `data_version` kiosk sync).

> [!IMPORTANT]
> **Production MySQL Is Required:** Do NOT disable MySQL on the live Server PC. The multi-role Portal (`/login`), Reviewer approval queue, and auto-syncing 3D status layers read from MySQL `kiosk`.

### 🔑 Separating Live Data vs. Local Development Code
When users and lobby kiosks are **live in production**, keep these two environments strictly isolated:
- **Your Laptop (Local Dev):** Has its own local MySQL, `NO_TUNNEL=1`, `LOCK_STATIC_DISK_EDITORS=0`, and **blank `SMTP_APP_PASSWORD`** (so local test OTPs print to terminal instead of emailing real DA personnel). Do all code updates and MCP Blender `.glb` modeling here first.
- **Live Server PC (24/7 Production):** Keeps its own `.env` (never committed), its own live MySQL `kiosk` data, uploaded `images/`, and `*.mbtiles` files. Set **`LOCK_STATIC_DISK_EDITORS=1`** in the Server PC's `.env` so browser visual geometry editors cannot overwrite Git-tracked `.json`/`.js` files directly on disk while day-to-day MySQL edits in `/login` remain 100% live!

### 💾 Mandatory Pre-Deploy Backup (`scripts/backup_before_deploy.ps1`)
Before running `git pull` on the live Server PC, always take a 1-command snapshot first:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup_before_deploy.ps1
```
This exports `kiosk_db.sql` (`mysqldump`), copies `images/`, and saves runtime `.json` files into `..\iguide_backups\<timestamp>\`. Never run `git reset --hard` or `git clean -fd` on the live Server PC.

---

## 5. Security, `/login` Governance & Cache-Busting

1. **Public Map (`/`) is Read-Only:** Visitors & lobby kiosks cannot access admin mode (`state.isAdmin` is permanently `false` on `/`). Public users can explore 3D campuses and filter by **Existing / Under Construction / Proposed** status.
2. **Role-Gated Spatial Portal (`/login`):** All live content edits run through **Super Admin / Administrator / Reviewer / GIS Editor** accounts with 2-step email OTP verification (`Draft -> Station Reviewer Approve -> Administrator Publish`).
3. **Zero-Reload Public Sync:** Publishing changes in `/login` bumps `settings.data_version` and broadcasts `iguide_db_sync` so open kiosks/phones live-update within 30 seconds.
4. **Asset Cache-Busting on Code Deploys:** Whenever you modify `js/` or `css/` files locally and deploy to the server, bump the `?v=...` query parameters in `index.html` and `admin.html` so kiosk & mobile browsers immediately fetch updated modules.

---

## 6. Domain Roadmap: Pre-Domain vs. Official Domain

- **Pre-Domain / Quick Tunnel:** Leave `PUBLIC_BASE_URL=` blank in `.env`; `server.js` starts a Cloudflare Tunnel automatically unless `NO_TUNNEL=1`.
- **Official Domain (`https://map.da-lares.gov.ph`):** Set `PUBLIC_BASE_URL=https://map.da-lares.gov.ph` in `.env` cleanly without modifying application code.

---

## 7. 24/7 Server PC Operating System & Hardware Configuration

Because the Server PC will run continuously without shutting down, configure the following Windows settings:

### ⚙️ Windows Power & Sleep Settings (Crucial)
1. Open **Settings $\to$ System $\to$ Power & Sleep** (or `powercfg.cpl`).
2. Set **"When plugged in, PC goes to sleep after"** $\to$ **Never**.
3. Set **"Turn off display after"** $\to$ **Never** (if the kiosk display is connected directly to this PC).
4. In Advanced Power Settings:
   - Hard disk $\to$ Turn off hard disk after $\to$ **0 minutes (Never)**.
   - PCI Express $\to$ Link State Power Management $\to$ **Off**.

### 🛡️ Windows Firewall Configuration
Allow incoming traffic so local network devices and mobile phones can connect:
```powershell
New-NetFirewallRule -DisplayName "DA-LARES Kiosk Server (Port 8080)" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

### 🔄 Thermal & Memory Management
- **Eco-Rest Mode:** The frontend automatically throttles animation after 5 minutes of idle time to keep GPU and CPU temperatures cold.
- **Node Server Watchdog:** Use a resilient launch script that automatically restarts the Node server if it ever stops.

---

## 8. Step-by-Step Server Migration Runbook (Multi-System Server PC)

> 💡 **Shared / Existing Server PC Note:** Because this Server PC already hosts other active systems and services, prerequisites (Node.js, network connectivity, power plans) are already configured. You can skip initial OS setup and start **directly from Step 2 onwards**.

### ⚠️ Multi-System Coexistence & Port Check
Before launching, verify if port `8080` is free or if an existing system on the server uses it:
```cmd
netstat -ano | findstr :8080
```
- If port `8080` is free, proceed with the default `PORT=8080`.
- If port `8080` is occupied by another system, simply change `PORT=8085` (or any free port like `8090`) in `.env`. Our server, local LAN URLs, and tunnels automatically adapt to the custom port.

---

### Step 2: Copy Project Files into an Isolated Directory
1. Copy the `map/` folder into its own isolated folder on the Server PC (e.g., `C:\DA-LARES-Map\` or `D:\DA-LARES-Map\`). This ensures complete sandboxing from other existing systems.
2. Open terminal/Command Prompt in that folder and install project dependencies:
   ```cmd
   npm install
   ```

### Step 3: Copy the 10 GB Drone MBTiles File
1. Copy `LARES v1.mbtiles` (10.28 GB) from your USB drive directly into `C:\DA-LARES-Map\`.
2. Confirm the file name matches `LARES v1.mbtiles` exactly.

### Step 4: Configure Environment (`.env`)
Copy [.env.example](../.env.example) to `.env` in the project root on the Server PC and set your live production values:
```env
PORT=8080

# Live MySQL database on Server PC
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=your-strong-db-password
DB_NAME=kiosk

# Prevent browser disk-geometry overwrites from conflicting with Git code deploys
LOCK_STATIC_DISK_EDITORS=1

# When official domain is ready:
# PUBLIC_BASE_URL=https://map.da-lares.gov.ph
```
Then initialize database tables & seed default records if this is a brand-new server:
```cmd
node database/migrate_and_seed.mjs
```

### Step 5: Test Server Startup
In Command Prompt:
```cmd
node server.js
```
Confirm you see:
```
[MBTiles] Loading DA-LARES drone orthomosaic from: ...\LARES v1.mbtiles
[MBTiles] DA-LARES database opened successfully in read-only mode.
Kiosk Backend Server running at http://localhost:8080
[Cloudflare Tunnel Active] Public URL: https://...
```

### Step 6: Configure Hands-Free Auto-Boot on Power-On
To make the kiosk automatically boot if the building ever has a power interruption:
1. Press `Win + R`, type **`shell:startup`**, and hit Enter.
2. Create a shortcut to [start_kiosk_silent.vbs](start_kiosk_silent.vbs) inside the Startup folder.
3. **Done!** Whenever the PC turns on, it will silently launch the Node backend and open the borderless hardware-accelerated kiosk screen.

---

*DA-LARES Interactive Campus Map Project • Department of Agriculture Lipa Agricultural Research and Experiment Station (Lipa City, Batangas)*
