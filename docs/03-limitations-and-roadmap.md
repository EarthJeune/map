# DA-LARES Interactive 3D Campus Wayfinding System — Limitations, Security Review & Roadmap

> [!IMPORTANT]
> **Audience Notice:** This document is strictly for the **IT Maintainer, Project Developers, and Supervisors** to guide pre-launch hardening and post-launch planning. **Do not put the security weaknesses listed here onto public presentation slides.**

---

## 1. Security Items That Must Be Fixed Before Public Deployment

Because the system uses a public **Cloudflare HTTPS Tunnel** (`cloudflared` in `server.js:1079`) to let visitors open QR code links on their smartphones over mobile data, the local Express server (`http://localhost:8080`) is reachable from the public internet whenever the tunnel is running. The items below were identified directly in the code and should be resolved before permanent public deployment.

| ID | Security Item & Code Citation | Severity | Suggested Fix |
| :--- | :--- | :---: | :--- |
| **SEC-01** | **Unauthenticated Write API Endpoints Exposed Over Public Tunnel:** All `POST` and `DELETE` endpoints in `server.js` (`POST /api/pin`, `POST /api/qares/pin`, `POST /api/colors`, `POST /api/drone-offset`, `POST /api/tunnel`, `POST /api/drawings`, `DELETE /api/drawings`, `POST /api/sync-drawing`, `POST /api/roads`, `POST /api/trees`, `POST /api/buildings`, `POST /api/plots/sync`, `POST /api/qares/*`) accept requests without checking a password, session cookie, or IP address. Anyone with the active tunnel URL could overwrite `roads.json`, `buildings.json`, `js/data/buildings.js`, or `pin.json`. | **HIGH** | Add an Express middleware in `server.js` that restricts all `POST`/`DELETE` routes and standalone editor pages (`*draw.html`) to either: **1)** loopback requests (`req.ip === '127.0.0.1'` / `'::1'` without `cf-connecting-ip` header), or **2)** a valid `X-Admin-Password` header checked against `process.env.ADMIN_PASSWORD` in `.env`. |
| **SEC-02** | **Client-Side Only Admin Mode Toggle (`?admin=1` / `Alt+Shift+A`):** In `js/app.js:338-415` (`initAdminMode()`, `toggleAdminMode()`), Admin Mode is enabled purely by adding `?admin=1` to the URL or pressing `Alt + Shift + A`, storing `'true'` in `localStorage.getItem('da_admin_mode')`. There is no server-verified PIN or password prompt. | **HIGH** | Prompt the administrator for an admin PIN/password when `toggleAdminMode()` or `?admin=1` is triggered, verify it against a `POST /api/admin/verify` endpoint in `server.js`, and block `?admin=1` when `cf-connecting-ip` is present (remote tunnel visitors). |
| **SEC-03** | **Root Directory Static File Serving (`express.static(__dirname)`):** In `server.js:46`, `app.use(express.static(__dirname, ...))` serves the entire project root directory over HTTP. While Express ignores dotfiles (such as `.env`) by default, visitors with the tunnel URL can download `server.js`, `package.json`, `start_kiosk.bat`, `pin.json`, backup files (`js/data/*.bak*`), and standalone authoring tools (`draw.html`, `road_draw.html`, `plot_draw.html`). | **MEDIUM** | Replace `express.static(__dirname)` with explicit static mounts for public directories only (`/js`, `/css`, `/models`, `/images`) plus an allowlist for root public files (`index.html`, `manifest.json`, `roads.json`, `qares_roads.json`, `trees.json`), blocking access to `server.js`, `*.bat`, `*.ps1`, `*.bak*`, and `*draw.html` from external tunnel requests. |
| **SEC-04** | **Hardcoded Mapbox Public Token Without Verified URL Restrictions:** `MAPBOX_ACCESS_TOKEN` (`pk.*`) is committed directly in `js/data/config.js:4` and inside the standalone `*draw.html` files. While Mapbox `pk.*` tokens are designed to be public in browsers, an unrestricted token copied from client source code can be used on external sites and consume monthly map-load quotas. | **MEDIUM** | In the Mapbox Account Dashboard, configure **URL Restrictions** on the public token (limiting allowed referrers to `http://localhost:8080`, `https://*.trycloudflare.com`, and the future `https://*.da-lares.gov.ph` domain) and rotate the token periodically. |
| **SEC-05** | **Permissive CORS Policy (`app.use(cors())`):** `server.js:24` enables `cors()` for all origins (`*`) across all endpoints. | **LOW** | Restrict CORS to same-origin requests or an explicit allowlist of the kiosk/tunnel origins, especially on state-modifying endpoints. |

---

## 2. Functional Limitations in Current Code

These items represent real operational boundaries or unfinished (`PARTIAL`) features found in the codebase.

| ID | Limitation & Code Citation | Severity | Suggested Fix |
| :--- | :--- | :---: | :--- |
| **LIM-01** | **Internet Required on Initial Page Load / Refresh:** Although the $10.29\text{ GB}$ drone orthomosaic (`LARES v1.mbtiles`), 53 `.glb` 3D models, and `roads.json` are local, `index.html:10-16` loads Mapbox GL JS (`v3.31.0`), Turf.js (`@turf/turf@6`), and Google Fonts from external CDNs, and `js/map-setup.js:69-71` initializes with `mapbox://styles/mapbox/...` cloud styles. Refreshing the kiosk while compound internet is down leaves the map blank. | **HIGH** |Vendor `mapbox-gl.js`, `mapbox-gl.css`, `turf.min.js`, and `Inter` font files into a local `vendor/` directory, and provide a minimal local JSON style specification in `js/map-setup.js` that loads `/api/tiles/{z}/{x}/{y}` when `api.mapbox.com` is unreachable. |
| **LIM-02** | **Cloudflare Free Quick Tunnel Ephemeral URLs & Rate Limits:** `startCloudflareTunnel()` (`server.js:1079`) runs a free Quick Tunnel (`trycloudflare.com`). Quick Tunnels have no uptime SLA, enforce a 200-in-flight request cap (which can cause temporary timeouts if many summit attendees scan the QR code simultaneously), and change URL every time `server.js` restarts (invalidating previously scanned QR tabs on phones). | **MEDIUM** | Transition to a **Cloudflare Named Tunnel** bound to a permanent domain (e.g., `map.da-lares.gov.ph` as outlined in `docs/DEPLOYMENT_GUIDE.md`), and generate a local QR code inside `js/qr.js` using a bundled client library (`qrcode.js`) instead of calling external `https://quickchart.io/qr`. |
| **LIM-03** | **DA-QARES Secondary Station Is Only Partially Modeled (`PARTIAL`):** Switching to **DA-QARES (Tiaong)** via `switchActiveStation('qares')` (`js/app.js:210`) loads `QARES v1.mbtiles` ($234.30\text{ MB}$), 48 2D/extruded polygons (`qares_buildings.json`), and 31 road features (`qares_roads.json`), but QARES has **0 custom 3D `.glb` models**, **0 internal office records** in `js/data/offices.js`, and **0 agricultural plot zones** in `js/data/plots.js`. | **MEDIUM** | Either hide/lock the station dropdown on the public DA-LARES kiosk until QARES 3D modeling is completed, or label DA-QARES in the dropdown as `"Preview (2D Aerial)"` so users know it is a preview. |
| **LIM-04** | **Adding a New Building Requires Manual JS Metadata Edits:** Drawing a new building polygon in `draw.html` (`POST /api/buildings` in `server.js:585`) updates `buildings.json` and `LARES_DRAWINGS` in `js/data/buildings.js`, but does **not** automatically add its category (`BUILDING_CATEGORIES`), sequence number (`BUILDING_ORDER`), photos (`BUILDING_IMAGES`), or descriptions (`js/data/descriptions.js`), nor does it create a routing entrance in `roads.json`. | **MEDIUM** | Follow the 6-step checklist in `docs/00-system-overview.md` (Section 7) when adding facilities, or unify building metadata into a single JSON/database schema editable from one admin form. |
| **LIM-05** | **Outdoor-Only Navigation (No Indoor Floor Plans):** The system routes visitors to each building's exterior entrance node (`roads.json`). For multi-story buildings, only `admin_building` groups its 10 offices by `Ground Floor` and `2nd Floor` text headings (`js/data/offices.js:14-35`); there are no interactive indoor floor maps. | **LOW** | Keep indoor routing out of scope for phase 1, and optionally add `Ground Floor` / `2nd Floor` text groupings to the other 2-story buildings (`tanco_hall_building`, `rnd_building`, `amad_building`, `tissue_culture_building`) in `js/data/offices.js`. |
| **LIM-06** | **English-Only User Interface & No Voice Readout:** All UI labels, turn-by-turn steps (`js/steps.js`), and wayfinding descriptions (`js/data/descriptions.js`) are written in English, and turn instructions are visual-only (no Web Speech API audio TTS on mobile). | **LOW** | Add an optional English / Tagalog language dictionary for core UI buttons and turn instructions, and an optional mute/unmute Web Speech API (`window.speechSynthesis`) toggle in `js/phone-nav.js`. |

---

## 3. Technical Debt in the Codebase

| ID | Technical Debt Item & Code Citation | Severity | Suggested Fix |
| :--- | :--- | :---: | :--- |
| **DEBT-01** | **Monolithic Stylesheet (`css/main.css` — 40,538 Lines):** Although `docs/CSS_MODULARIZATION_PLAN.md` recorded an earlier cleanup to 9,785 lines, `css/main.css` currently has **40,538 total lines** (31,619 blank lines caused by multi-spaced line endings + 8,919 non-blank lines of CSS), combining kiosk, mobile, navigation, and admin styles in one file. | **MEDIUM** | Strip the excess blank lines (`CRLF` double-spacing) and execute the 8-file domain split already designed in `docs/CSS_MODULARIZATION_PLAN.md` (`variables.css`, `base.css`, `kiosk.css`, `building-panel.css`, `navigation.css`, `phone.css`, `admin.css`, `main.css`). |
| **DEBT-02** | **Duplicate `/api/drone-offset` Route Registration in `server.js`:** `GET /api/drone-offset` and `POST /api/drone-offset` are defined at `server.js:194-234` and then defined a second time at `server.js:726-770`. Express always executes the first handler (lines 194–234) and never reaches lines 726–770 (which also includes MySQL persistence). | **MEDIUM** | Delete the first JSON-only `/api/drone-offset` block (`server.js:194-234`) and keep only the fuller MySQL + JSON fallback implementation at `server.js:726-770`. |
| **DEBT-03** | **Regex String Rewriting of JavaScript Source Files in `server.js`:** When `POST /api/buildings` (`server.js:601`), `POST /api/sync-drawing` (`server.js:495`), `POST /api/trees` (`server.js:569`), or `POST /api/plots/sync` (`server.js:625`) runs, the server reads `js/data/buildings.js`, `js/data/geo.js`, or `js/data/plots.js` as raw text and overwrites exported JS constants using regular expressions. | **MEDIUM** | Load dynamic GeoJSON (`buildings.json`, `trees.json`, `plots.json`) via `fetch()` or clean JSON imports rather than mutating `.js` source files with regex on disk. |
| **DEBT-04** | **Global `window.*` Function Mirroring & Legacy Backups:** `js/app.js:625-733` attaches 50+ module functions onto `window.*` to support inline `onclick="..."` handlers in `index.html`. Additionally, two backup files (`buildings.js.bak_water_tank` and `plots.js.bak_water_tank`) and `legacy.html` remain in the workspace. | **LOW** | Gradually replace inline `onclick` attributes in `index.html` with `addEventListener` inside each ES module, and move `.bak*` files out of `js/data/`. |
| **DEBT-05** | **Library Version Mismatch Between Main App and Authoring Tools:** `index.html` loads Mapbox GL JS `v3.31.0` and `@turf/turf@6` from CDN, `draw.html`/`road_draw.html`/`plot_draw.html` load Mapbox GL JS `v2.15.0`, and `package.json` installs `@turf/turf: ^7.4.0` and `three: ^0.186.1`. | **LOW** | Standardize Mapbox GL JS (`v3.31.0`) and Turf.js versions across all HTML files and `package.json`. |

---

## 4. Planned Features (Described in `/docs`, Not Yet in Code)

The following capabilities are documented in existing project guides (`docs/DEPLOYMENT_GUIDE.md`, `docs/CSS_MODULARIZATION_PLAN.md`, `AGENTS.md`) as upcoming work, and are marked **`PLANNED`**:

1. **8-File Modular CSS Architecture (`PLANNED` — `docs/CSS_MODULARIZATION_PLAN.md`):** Splitting `css/main.css` into `variables.css`, `base.css`, `kiosk.css`, `building-panel.css`, `navigation.css`, `phone.css`, `admin.css`, and `main.css`.
2. **Official Custom Domain & Named Cloudflare Tunnel (`PLANNED` — `docs/DEPLOYMENT_GUIDE.md` Section 6):** Binding the 24/7 Server PC to a permanent government/station domain (e.g., `https://map.da-lares.gov.ph`) via a persistent Cloudflare Named Tunnel (`cloudflared service install`).
3. **24/7 Windows Service / PM2 Process Daemonization (`PLANNED` — `docs/DEPLOYMENT_GUIDE.md` Section 7–8):** Running `server.js` under `pm2` with `pm2-windows-startup` and configuring Windows Auto-Logon + Power & Sleep locks on the dedicated production kiosk/server PC.
4. **Full 3D Building Modeling & Directory Expansion for DA-QARES (`PLANNED` — `docs/CSS_MODULARIZATION_PLAN.md` Section 1):** Creating $< 300\text{ KB}$ `.glb` 3D architectural models, office directories, and field plot zones for the Tiaong, Quezon station (`qares`).
5. **Multi-Kiosk Lobby Scaling (`PLANNED` — `docs/DEPLOYMENT_GUIDE.md` Section 1):** Deploying additional touch kiosk totems in other compound buildings (e.g., Admin Building, ORED, or Main Gate) pointing to the central server PC with per-kiosk `"You Are Here"` origin coordinates (`?kiosk=admin`, `?kiosk=gate`).

---

## 5. Realistic Three-Phase Roadmap

### Phase 1: Before Public Launch (1–3 Days — Essential Hardening)
- **Fix `SEC-01` & `SEC-02` (Admin & API Protection):** Add localhost/password middleware to all `POST`/`DELETE` endpoints in `server.js` and disable `?admin=1` / `*draw.html` over external Cloudflare tunnel requests.
- **Fix `SEC-03` & `SEC-04` (Static Asset Lock & Mapbox URL Restriction):** Restrict `express.static` so server code and `.bat` scripts are not publicly downloadable, and enable URL referrer restrictions on the Mapbox token.
- **Fix `DEBT-02` (Deduplicate `/api/drone-offset`):** Remove the duplicate route registration at `server.js:194-234` so drone offset changes persist to both MySQL and `drone_offset.json`.
- **Bundle Local QR Generator & Vendor Core JS (`LIM-01`, `LIM-02`):** Include a lightweight local `qrcode.min.js` in `js/qr.js` and local copies of `mapbox-gl.js` and `turf.min.js` so QR generation and script loading do not depend on third-party CDNs.
- **Configure Kiosk PC Startup (`docs/DEPLOYMENT_GUIDE.md`):** Run `create_shortcuts.ps1`, place the silent kiosk launcher in `shell:startup`, disable Windows sleep/screen-off timers, and lock touch edge-swipe gestures.

### Phase 2: After Launch (Weeks 2–4 — Stability & Maintainability)
- **Upgrade to a Cloudflare Named Tunnel & Custom Domain (`LIM-02`):** Replace the temporary `*.trycloudflare.com` quick tunnel with a fixed `https://map.da-lares.gov.ph` (or agency subdomain) tunnel so QR codes never change URL on restart and have no 200-request cap.
- **Normalize & Modularize `css/main.css` (`DEBT-01`):** Strip excess blank lines and split `css/main.css` into the 8 domain files defined in `docs/CSS_MODULARIZATION_PLAN.md`.
- **Add Floor Groupings for Remaining 2-Story Buildings (`LIM-05`):** Add `Ground Floor` / `2nd Floor` office sub-headings in `js/data/offices.js` for `tanco_hall_building`, `rnd_building`, `amad_building`, and `tissue_culture_building`.
- **Add Anonymous Usage Counters (Privacy-Safe):** Log simple daily counts in MySQL (e.g., most-searched buildings, total routes computed, total QR scans) without collecting any personal or GPS data, giving DA management insight into visitor demand.

### Phase 3: Later Expansion (Months 2–6 — Multi-Station & Accessibility)
- **Complete DA-QARES (Tiaong, Quezon) 3D Campus (`LIM-03`):** Model the QARES buildings in Blender ($< 300\text{ KB}$ `.glb` each), populate QARES offices and wayfinding descriptions, and map QARES experimental plots.
- **Multi-Kiosk Origin Support:** Allow multiple physical kiosks across DA-LARES to pass their own starting pin via URL parameter (e.g., `?origin=guard_house` or `?origin=admin_building`).
- **Bilingual (English / Tagalog) & Audio Accessibility (`LIM-06`):** Add a Tagalog language toggle for farmer visitors and optional voice-guided turn announcements on mobile phones.

---

## Verification — Files Read to Produce This Document

- `docs/00-system-overview.md`, `docs/01-modules.md`, `docs/02-use-cases.md`
- `server.js` (lines 1–1159), `package.json`, `.env.example`, `.gitignore`
- `index.html`, `legacy.html`, `css/main.css`
- `js/app.js`, `js/qr.js`, `js/map-setup.js`, `js/drone-calibration.js`, `js/data/config.js`, `js/data/offices.js`, `js/data/stations.js`
- `draw.html`, `road_draw.html`, `plot_draw.html`, `tree_draw.html`
- `AGENTS.md`, `docs/DEPLOYMENT_GUIDE.md`, `docs/CSS_MODULARIZATION_PLAN.md`, `docs/SESSION_HANDOFF.md`

