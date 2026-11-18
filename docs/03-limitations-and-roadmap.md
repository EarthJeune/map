# iGUIDE — Limitations, Security Review & Roadmap

> [!IMPORTANT]
> **Audience Notice:** This document is strictly for the **IT Maintainer, Project Developers, and Supervisors** to guide pre-deployment hardening, regional station rollout, and agronomic feature expansion. **Do not put the internal security hardening items listed in Section 1 onto public presentation slides.**

---

## 1. Security Hardening Audit for Public Web Deployment

Because the system is deployed so **anyone can search and access it online** (and so on-site visitors can open QR code links on their smartphones over mobile data), the Express server (`server.js` + `database/admin_api.js`) has been hardened against public inspection and unauthorized access.

| ID | Security Item & Code Citation | Status | Implemented Protection / Remaining Action |
| :--- | :--- | :---: | :--- |
| **SEC-01** | **Hashed Admin Authentication & CRUD API (`database/admin_api.js`):** All `/api/admin/*` CRUD endpoints (`PUT /api/admin/stations/:id`, `POST/PUT/DELETE /api/admin/buildings*`, `POST/DELETE /api/admin/buildings/:id/images`, `POST/PUT/DELETE /api/admin/offices*`, `PUT /api/admin/plots/:id`) require a valid server session (`requireAdminAuth`). | **`RESOLVED (IMPLEMENTED)`** | Credentials in the MySQL `admin_users` table (`username_sha256` and `password_sha256`) are verified via constant-time `crypto.timingSafeEqual`, backed by `HttpOnly; SameSite=Strict` cookies and a 5-attempt / 60-second brute-force rate limiter. |
| **SEC-02** | **Retired Public `Alt + Shift + A` Shortcut (`js/app.js`):** Previously, pressing `Alt + Shift + A` or `Alt + Click` on the public map could toggle client-side admin mode. | **`RESOLVED (IMPLEMENTED)`** | Completely removed `Alt + Shift + A` and `Alt + Click` from `js/app.js` and blocked `?admin=1` on non-localhost public domains. All administration is now conducted through the dedicated `/admin` portal (`admin.html`) requiring authenticated credentials. |
| **SEC-03** | **Source Code, Secret & Database Path Firewall (`server.js`):** Prevent users who open DevTools (*Inspect Element*) from downloading backend source code, `.env` secrets, or raw `.mbtiles` databases. | **`RESOLVED (IMPLEMENTED)`** | Added an Express security firewall in `server.js` that returns `403 Forbidden` for `/server.js`, `/package.json`, `/package-lock.json`, `/.env*`, `/database/*`, `/app/*`, `/tools/*`, `/docs/*`, and extensions `.mbtiles`, `.bat`, `.ps1`, `.vbs`, `.py`, `.sql`, `.sh`, `.bak*`, plus `X-Content-Type-Options: nosniff` and `X-Frame-Options: SAMEORIGIN`. |
| **SEC-04** | **Mapbox Public Token URL Referrer Restrictions (`js/data/config.js`):** `MAPBOX_ACCESS_TOKEN` (`pk.*`) is used by the browser to initialize Mapbox GL JS. | **MEDIUM (Dashboard Config)** | In the Mapbox Account Dashboard, configure **URL Restrictions** on the `pk.*` token (limiting allowed referrers to `http://localhost:8080`, `https://*.trycloudflare.com`, and the official deployed domain). |
| **SEC-05** | **CORS Policy (`app.use(cors())` in `server.js`):** Enables cross-origin reads for public tile/bootstrap requests while `/api/admin/*` enforces `SameSite=Strict` session tokens. | **LOW** | Optionally restrict CORS origins to the official deployed domain once a permanent domain is bound. |
| **SEC-06** | **Salted `scrypt` Passwords & 2-Step Gmail OTP (`database/admin_api.js`):** Station Reviewer accounts and login OTP verification. | **`RESOLVED (IMPLEMENTED)`** | Reviewer passwords use per-user salted `crypto.scrypt`; both Admin & Reviewer logins enforce a 6-digit Gmail OTP (5-minute TTL, max 5 attempts) and Hybrid Split routing (`/admin` localhost-only, `/review` HTTPS). |
| **SEC-07** | **Session Cookie `Secure` Flag over HTTPS:** When accessing `/admin` over external HTTPS tunnels or reverse proxies, session cookies must be protected in transit. | **RECOMMENDED** | Ensure session cookies set `Secure: true` (`cookie: { secure: true, httpOnly: true, sameSite: 'strict' }`) when served over HTTPS connections. |
| **SEC-08** | **Admin Portal Route Access Restrictions:** Public internet visitors should not have access to administrative login endpoints. | **RECOMMENDED** | Restrict `/admin` and `/api/admin/*` to loopback (`localhost` / `127.0.0.1`), or place the administrative route behind Cloudflare Access / Zero Trust with team multi-factor authentication. |

---

## 2. Current Operational Boundaries in Code

These items represent real operational boundaries in the current deployment setup and how the system handles them.

| ID | Operational Boundary & Code Citation | Severity | Resolution / Status |
| :--- | :--- | :---: | :--- |
| **LIM-01** | **Internet Required on Initial Page Load / Refresh:** Although the 640.64 MB drone orthomosaics (`LARES`, `QARES`, `RARES`), 54 `.glb` 3D models, 63 `.webp` photos, and `roads.json` are stored locally, `index.html` loads Mapbox GL JS (`v3.31.0`), Turf.js (`@turf/turf@6.5.0`), and Google Fonts from external CDNs. | **MEDIUM** | Heavy `.glb` models and `.webp` photos now use 24-hour browser caching (`Cache-Control: public, max-age=86400`). For cold boots during a complete internet outage, vendor `mapbox-gl.js` and `turf.min.js` into a local `vendor/` directory. |
| **LIM-02** | **Cloudflare Quick Tunnel Ephemeral URLs vs. Named Domain:** `startCloudflareTunnel()` (`server.js`) runs a free Quick Tunnel (`trycloudflare.com`) when no permanent domain is configured. Quick Tunnels generate a new random URL whenever `server.js` restarts. | **MEDIUM** | Transition to a **Cloudflare Named Tunnel** or cloud reverse proxy bound to a permanent searchable domain (as outlined in `docs/DEPLOYMENT_GUIDE.md`). |
| **LIM-03** | **Secondary Research Stations (`DA-QARES`, `DA-RARES`, `DA-CARES`) Are Gated as "Under Development" for Initial Launch:** In deployed mode (`isDeployedMode()` in `js/stations.js`), selecting a station whose MySQL `status` is `'under_dev'` triggers the **"Station Under Development"** modal (`showStationDevModal()`). | **LOW (By Design & Toggleable in `/admin`)** | Administrators can switch any station between `Live on Public Map` and `Under Development` with a single click in `/admin` (`PUT /api/admin/stations/:id`) as its 3D models are completed. |
| **LIM-04** | **Worker Agronomic Plot Intelligence Database (`agricultural_plots` in MySQL):** Previously planned; now **implemented (51 plot/zone rows)** in the 11-table MySQL `kiosk` database and `/admin` Module 5. | **`RESOLVED (IMPLEMENTED)`** | Staff can now view and update **`current_crop`** (planted crop/variety), **`tree_count`** (exact tree/plant count), **`planting_cycle`** (`perennial`, `annual`, `monthly_seasonal`), **`plot_status`**, and **`worker_notes`** in `/admin`, with instant live sync to the 3D map and search bar. |
| **LIM-05** | **Outdoor-Only Navigation (No Indoor Floor Plans):** The system routes users to each building's exterior entrance node (`roads.json`). For multi-story buildings, `admin_building` groups its 10 offices by `Ground Floor` and `2nd Floor` text headings (`js/data/offices.js`); there are no interactive indoor floor maps. | **LOW** | Keep indoor routing out of scope for phase 1, and optionally add `Ground Floor` / `2nd Floor` floor labels via `/admin` Module 4 (`building_offices.floor_name`). |
| **LIM-06** | **English-Only User Interface & No Voice Readout:** All UI labels, turn-by-turn steps (`js/steps.js`), and wayfinding descriptions (`js/data/descriptions.js`) are written in English, and turn instructions are visual-only (no Web Speech API audio TTS on mobile). | **LOW** | Add an optional English / Tagalog language dictionary for core UI buttons and turn instructions, and an optional mute/unmute Web Speech API (`window.speechSynthesis`) toggle in `js/phone-nav.js`. |

---

## 3. Technical Debt in the Codebase

> [!NOTE]
> **Recently Resolved Technical Debt:**
> - **CSS Modularization (`RESOLVED`):** The formerly monolithic `css/main.css` has been cleanly refactored into **8 domain stylesheets** (`variables.css`, `base.css`, `kiosk.css`, `building-panel.css`, `navigation.css`, `phone.css`, `admin.css`, and `main.css`).
> - **WebP Asset Compression (`RESOLVED`):** All 63 facility and plot images in `images/` have been converted to optimized `.webp` format (`tools/convert_photos_to_webp.py`).
> - **Station-Isolated 3D Model Sources (`RESOLVED`):** Refactored `js/map-setup.js` (`setupStation3DModels`) so each station uses its own isolated Mapbox 3D model source and layer (`lares-3d-models-layer`, `rares-3d-models-layer`, `qares-3d-models-layer`), preventing 3D buildings from vanishing when switching stations.

| ID | Remaining Technical Debt Item & Code Citation | Severity | Suggested Fix |
| :--- | :--- | :---: | :--- |
| **DEBT-01** | **Duplicate `/api/drone-offset` Route Registration in `server.js`:** `GET /api/drone-offset` and `POST /api/drone-offset` are defined twice in `server.js`. Express executes the first JSON-only handler and never reaches the second handler (which includes MySQL persistence). | **MEDIUM** | Delete the first JSON-only `/api/drone-offset` block in `server.js` and keep only the fuller MySQL + JSON fallback implementation. |
| **DEBT-02** | **Regex String Rewriting of JavaScript Source Files in `server.js`:** When `POST /api/buildings`, `POST /api/sync-drawing`, `POST /api/trees`, or `POST /api/plots/sync` runs, the server reads `js/data/buildings.js`, `js/data/geo.js`, or `js/data/plots.js` as raw text and overwrites exported JS constants using regular expressions. | **MEDIUM** | Load dynamic GeoJSON (`buildings.json`, `trees.json`, `plots.json`) via `fetch()` or clean JSON imports rather than mutating `.js` source files with regex on disk. |
| **DEBT-03** | **Global `window.*` Function Mirroring & Legacy Backups:** `js/app.js` attaches 50+ module functions onto `window.*` to support inline `onclick="..."` handlers in `index.html`. Additionally, two backup files (`buildings.js.bak_water_tank` and `plots.js.bak_water_tank`) and `legacy.html` remain in the workspace. | **LOW** | Gradually replace inline `onclick` attributes in `index.html` with `addEventListener` inside each ES module, and move `.bak*` files out of `js/data/`. |
| **DEBT-04** | **Library Version Mismatch Between Main App and Authoring Tools:** `index.html` and `package.json` use Mapbox GL JS `v3.31.0` and `@turf/turf@6.5.0`, while `draw.html`/`road_draw.html`/`plot_draw.html` load Mapbox GL JS `v2.15.0`. | **LOW** | Standardize Mapbox GL JS (`v3.31.0`) across the standalone authoring HTML files. |

---

## 4. Implemented Complete MySQL Database Architecture (11 Tables in `kiosk` + Exact UI Fallbacks)

The system is powered by a normalized **11-table MySQL relational database (`kiosk`)** accessible directly through **phpMyAdmin** (`http://localhost/phpmyadmin/index.php?route=/database/structure&db=kiosk`) and managed via the **DA Spatial Hub Admin Portal (`/admin` — `admin.html`)**, [`database/admin_api.js`](database/admin_api.js), and Laravel migration/controller files ([`database/migrations/2026_11_11_000001_create_da_spatial_hub_tables.php`](database/migrations/2026_11_11_000001_create_da_spatial_hub_tables.php), [`app/Http/Controllers/AdminCrudController.php`](app/Http/Controllers/AdminCrudController.php)).

### Complete 11-Table MySQL Schema (`kiosk` Database)

| # | Table Name | Rows Seeded | What It Stores | Key Columns |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **`stations`** | **4** | The 4 CALABARZON research stations, their live **`"You Are Here"` kiosk pin**, drone alignment offset, public deployment status, and `.mbtiles` archive filename. | `id` (`lares`, `qares`, `rares`, `cares`), `code`, `name`, `short_name`, `location_subtitle`, `status` (`'live'` \| `'under_dev'`), **`kiosk_pin_lng`**, **`kiosk_pin_lat`**, `drone_offset_x`, `drone_offset_y`, `mbtiles_file` |
| **2** | **`buildings`** | **148** *(50 LARES, 53 QARES, 45 RARES)* | All numbered buildings (`1`–`39`), unnumbered utilities (`plot22_water_tank`, `plot22_comfort_room`), screenhouse structures, and compound gates. | `id` (PK), `station_id` (FK), `bldg_num` (`1`–`39` or `NULL`), `name`, `category`, `icon`, `color`, `compact_tag`, `visual_landmark` (*"How to Spot It"*), `key_services` (*"What's Inside"*), `model_file` (`models/*.glb`), `model_lng`, `model_lat`, `model_rotation`, `marker_lng`, `marker_lat`, `footprint_geojson` |
| **3** | **`building_images`** | **63** | Stores **0, 1, or multiple `.webp` pictures** for any building or facility. | `id` (PK), `building_id` (FK), `station_id`, `image_path` (`images/*.webp`), `caption` (`Front`, `Side`, `Signage`), `is_primary` (BOOL), `sort_order` |
| **4** | **`building_offices`** | **47** | Internal offices and divisions inside parent buildings, including floor groupings. | `id` (PK), `building_id` (FK), `station_id`, `floor_name` (`'Ground Floor'`, `'2nd Floor'`, or `NULL`), `title`, `sort_order` |
| **5** | **`building_entrances`** | **43** | Building entrance routing nodes snapped to the pedestrian road graph. | `id` (PK), `station_id` (FK), `building_id` (FK), `name`, `lng`, `lat` |
| **6** | **`agricultural_plots`** | **51** *(23 LARES zones + 28 RARES plots)* | Master commodity zones and field plots (`Plots 1–45`) plus **Live Worker Agronomic Intelligence**. | `id` (PK), `station_id` (FK), `plot_number`, `name`, `category`, `area_sqm`, **`current_crop`** (planted crop/variety), **`tree_count`** (INT), **`planting_cycle`** (`'perennial'` \| `'annual'` \| `'monthly_seasonal'`), **`plot_status`** (`'active'` \| `'fallow'` \| `'preparation'` \| `'harvesting'`), `worker_notes`, `polygon_geojson` |
| **7** | **`plot_subplots`** | **9** | Official screenhouse sub-plots inside Plot 17 (*Screenhouses 1–5*) and Plot 18 (*Screenhouses 6–9*). | `id` (PK), `plot_id` (FK), `station_id`, `name`, `type`, `lng`, `lat`, `sort_order` |
| **8** | **`campus_trees`** | **131** | Placed 3D campus trees across the compound. | `id` (PK), `station_id` (FK), `tree_type` (`1`–`4`), `lng`, `lat`, `scale` |
| **9** | **`road_features`** | **180** *(101 LARES, 31 QARES, 48 RARES)* | Pedestrian routing graph features (`road`, `walkway`, `entrance`). | `id` (PK), `station_id` (FK), `feature_type`, `name`, `building_id`, `properties_json`, `geometry_geojson` |
| **10** | **`admin_audit_logs`** | **Live** | Immutable audit log of every admin login and CRUD modification. | `id` (PK), `admin_user`, `action`, `target_table`, `target_id`, `summary`, `created_at` |
| **11** | **`admin_users`** | **1+** | **Hashed administrator credentials** (`username_sha256` & `password_sha256`; scrypt recommended for production). | `id` (PK), `username_sha256` (`CHAR(64)`), `password_sha256` (`CHAR(64)`), `role` (`'super_admin'`), `is_active`, `last_login_at` |

*(Note: Legacy key-value fallback tables `settings` and `building_colors` are also retained in `kiosk` for backward compatibility.)*

---

### How the System Behaves for Every Edge Case (Empty vs. Single vs. Multiple Rows)

| Scenario / Edge Case | What Is in MySQL | Exact Output in the Map & Drawer UI |
| :--- | :--- | :--- |
| **1. A building has NO internal offices** *(e.g., Argosino Hall, Canteen, Guard House, Warehouses, Laboratories)* | `0` rows in `building_offices` and `offices_status = 'none'` | The **"Offices & Units" section is completely hidden** (`renderBuildingOfficesHTML()` returns `''`). The drawer only shows the building's photo, *"How to Spot It"*, and *"What's Inside & Services"*. |
| **2. A building has offices on 1 floor vs. multiple floors** *(e.g., ORED vs. Admin Building)* | Rows in `building_offices` have `floor_name = NULL` (single floor) or `'Ground Floor'` / `'2nd Floor'` (multi-floor) | If `floor_name` is `NULL`, renders a single clean list of office pills. If `floor_name` has values, automatically groups pills under **`Ground Floor (6 offices)`** and **`2nd Floor (4 offices)`** headers. |
| **3. A new station's building hasn't had its offices surveyed yet** *(e.g., DA-QARES / DA-RARES)* | `offices_status = 'pending'` | Renders a clean info badge: **"Offices information pending update"** without displaying fake or empty office pills. |
| **4. A building has MULTIPLE pictures** *(e.g., Front Facade, Side Angle, Entrance Sign)* | `2` or more rows in `building_images` for that `building_id` | Displays the `is_primary = 1` photo first and automatically shows the **View Angle Switcher Chips** (`[Front Facade] [Side Angle] [Signage]`) at the bottom of the photo so users can switch pictures or enlarge any angle in the Lightbox. |
| **5. A building has ONLY 1 picture** | `1` row in `building_images` | Displays the single `.webp` photo with the **Enlarge** button and **hides** the angle-switcher chip bar so there is no redundant 1-button bar. |
| **6. A building or plot has NO picture yet** | `0` rows in `building_images` | **For a Building:** Shows the clean stylized placeholder card with its category icon and `"<Building Name> (No Photo)"`. **For an Agricultural Plot:** Cleanly hides the image box (`display: none`) so the plot details move seamlessly to the top. |
| **7. An agricultural plot is an Orchard (Trees) vs. a Seasonal Row Crop (Corn/Vegetables)** | `agricultural_plots.tree_count` is `145` (`planting_cycle = 'annual_perennial'`) vs. `tree_count = NULL` (`planting_cycle = 'monthly_seasonal'`) | **If `tree_count > 0`:** Shows the **`🌳 Tree Count: 145 Trees`** badge and **`Annual / Perennial Orchard`** tag. **If `tree_count IS NULL`:** Hides the tree counter and shows **`📅 Cycle: Monthly / Seasonal Trial`** + planted/harvest months. |
| **8. A multi-plot zone has NO sub-plots vs. Screenhouse Sub-Plots** *(e.g., Plots 6–12 Citrus vs. Plot 17 Screenhouses)* | `0` rows in `plot_subplots` vs. `5` rows in `plot_subplots` | **If `0` rows:** Hides the *"Sub-Plots in this Zone"* list (strictly complying with Rule 9—zero fabricated sub-plots). **If `> 0` rows:** Renders clickable sub-plot cards (*Screenhouse 1–5*) that zoom to the sub-plot and swap the drawer photo to that screenhouse's picture. |
| **9. Unnumbered Field Utilities (`plot22_water_tank`, `plot22_comfort_room`)** | `building_number = NULL`, `is_utility_amenity = 1`, `has_marker = 0` | Hidden from the default `LARES BUILDINGS (39)` list so the numbering stays `1`–`39`, but automatically appears when the user searches `"water"` / `"comfort room"` or filters by **Agri Infrastructure**. |

### Full CRUD Operations Matrix (What Admins & Staff Can Create, Read, Update & Delete)

Turning all campus, office, infrastructure, and agricultural plot data into a MySQL database enables complete **CRUD (Create, Read, Update, Delete)** operations through a password-protected Admin Dashboard—eliminating the need to edit `.js` code files:

| Data Domain (MySQL Table) | **C — Create (`POST`)** | **R — Read (`GET`)** | **U — Update (`PUT / PATCH`)** | **D — Delete (`DELETE`)** |
| :--- | :--- | :--- | :--- | :--- |
| **1. Research Stations & `"You Are Here"` Pin (`stations`)** | Register a new DA research station with initial camera coordinates and `.mbtiles` filename. | Load station list, status (`live` vs. `under_development`), and starting pin on map boot. | **Drag & save the `"You Are Here"` kiosk pin**, update drone offset (`dx`, `dy`), or switch a station from `under_development` to `live`. | Remove a temporary or test station entry. |
| **2. Buildings, Utilities & Gates (`buildings`)** | Add a new building, screenhouse, field utility, or gate with its 2D footprint polygon and 3D `.glb` model path. | Load all searchable facilities, 3D model placements, and numbered map pins (`1`–`39`). | Edit building name, sequence number, subtitle (`compact_tag`), *"How to Spot It"*, *"What's Inside"*, category, icon, floating pill coordinates, or 3D rotation. | Delete a demolished structure or test polygon (automatically cascading or unlinking its offices/photos). |
| **3. Facility Multi-Photo Gallery (`building_images`)** | Upload 1 or multiple `.webp` photos for any facility (`POST /api/admin/buildings/:id/images`). | Display primary photo, view-switcher angle chips (`Front`, `Side`, `Signage`), or fallback placeholder. | Change which photo is `is_primary`, rename angle captions, or reorder sort order. | Delete an outdated photo from both MySQL and the `images/` directory. |
| **4. Internal Offices & Units (`building_offices`)** | Add a new division, section, or conference hall inside any building. | Display office pills in the building drawer (or hide the card if `0` offices exist) and match search queries/acronyms. | Rename an office, edit its search acronyms (`BAC`, `GAD`), change its floor (`Ground Floor` / `2nd Floor`), or move an office by changing `building_id`. | Delete a dissolved or merged office unit. |
| **5. Building Entrance Routing Nodes (`building_entrances`)** | Register an entrance coordinate snapped to the campus walkway network. | Connect building destinations to the in-memory pedestrian routing graph. | Adjust entrance latitude and longitude coordinates to match physical doors. | Remove obsolete entrance nodes. |
| **6. Agricultural Plots & Commodity Zones (`agricultural_plots`)** | Register a numbered field plot (`Plots 1–45`) or commodity zone with boundary polygon. | Display plot-level agronomic cards for station workers, researchers, and visitors. | **Update what crop/variety is planted, update exact tree count, toggle `perennial` vs. `monthly_seasonal`, and update planting/harvest cycle or status.** | Delete or reset an obsolete plot record. |
| **7. Screenhouse Sub-Plots (`plot_subplots`)** | Add a clickable sub-plot (e.g. screenhouses in Plots 17 and 18) inside a parent plot. | List sub-plot cards inside the Plot Drawer (or hide the section if `0` sub-plots exist). | Edit sub-plot name, type, or coordinate position. | Delete an obsolete sub-plot card. |
| **8. Placed 3D Campus Trees (`campus_trees`)** | Plant a 3D campus tree with coordinates, type, and scale. | Render 3D trees across the campus grounds in Mapbox GL JS. | Adjust tree type (`1`–`4`), coordinates, or scale multiplier. | Remove a fallen or cleared tree. |
| **9. Road & Pedestrian Routing Network (`road_features`)** | Draw new road segments, walkways, and entrance paths. | Build the in-memory Dijkstra pedestrian routing graph on startup. | Move road vertices, snap entrance connectors, or update segment properties. | Delete a closed road or decommissioned path. |
| **10. Admin Audit Logs (`admin_audit_logs`)** | Automatically logged by `database/admin_api.js` on every admin login and CRUD operation. | Review chronological audit history of who modified any station, building, photo, office, or plot. | *(Immutable audit trail; modifications not permitted for security integrity).* | Prune old archive logs during maintenance. |
| **11. Admin User Authentication (`admin_users`)** | Create authorized administrator accounts with hashed credentials. | Verify login sessions and display active admin user profiles. | Change passwords (hashed) or update user active status and roles. | Revoke or deactivate an administrator account. |

> **What Stays on Disk (Referenced by Path in MySQL):** Binary media files—specifically the **3D `.glb` models** (`models/*.glb`), **optimized `.webp` images** (`images/*.webp`), and **~200 MB `.mbtiles` drone databases** (`LARES v1.mbtiles`)—remain stored as files on disk while MySQL stores their file paths (`model_glb_url`, `image_webp_url`, `mbtiles_filename`). This keeps MySQL queries fast and allows the browser to cache 3D models and WebP images normally.

### Security Architecture & Data Isolation Principles:
1. **MySQL Stays Strictly Local (`127.0.0.1:3306`):** The MySQL server is never exposed to the public internet—only `server.js` on the local machine can query it using credentials stored in `.env`.
2. **Public Visitors Only Get Read-Only JSON (`GET /api/db/bootstrap`):** When anyone searches the map online, the browser calls read-only `GET` endpoints that return public display fields (names, `.webp` image paths, descriptions, plot crop info).
3. **Password-Protected Admin CRUD API (`POST / PUT / DELETE`):** Any `CREATE`, `UPDATE`, or `DELETE` action on the `"You Are Here"` pin, building descriptions, `.webp` photos, internal offices, or plot crop/tree records requires an authenticated server session token (`admin_users`), completely replacing regex file-rewriting (`DEBT-02`).

---

## 5. Completed vs. Planned Features (Next Evolution of the Platform)

1. **11-Table MySQL Database, `/admin` Portal & Live Agronomic Plot CMS (`IMPLEMENTED & LIVE`):** Completed full migration to the 11-table MySQL `kiosk` schema with hashed `admin_users` authentication, multi-photo `.webp` uploads, smart `0 / 1 / 2+` office logic, and live worker plot intelligence (`current_crop`, `tree_count`, `planting_cycle`, `plot_status`, `worker_notes`) with instant `BroadcastChannel` cross-tab sync.
2. **Completing DA-RARES, DA-QARES & DA-CARES (`IN PROGRESS / PLANNED`):**
   - **DA-RARES (Tanay, Rizal):** Drone orthomosaic (`RARES v1.mbtiles`, 206.54 MB), 45 building footprints in MySQL (`rares_buildings.json`), 45 agricultural plots (`rares_plots.json`), road network (`rares_roads.json`), and the custom 3D Guard House model (`rares_guard_house.glb`) are already integrated; remaining buildings (`#2`–`#39`), photos, and wayfinding descriptions are next.
   - **DA-QARES (Tiaong, Quezon):** Drone orthomosaic (`QARES v1.mbtiles`, 223.44 MB), 53 footprints in MySQL (`qares_buildings.json`), and roads (`qares_roads.json`) are integrated; custom 3D `.glb` models, plots, and office directories are next.
   - **DA-CARES (Naic, Cavite):** Aerial drone survey, footprint tracing, road network, and 3D modeling.
3. **Official Searchable Custom Domain & Named Cloudflare Tunnel (`PLANNED` — `docs/DEPLOYMENT_GUIDE.md`):** Binding the server to a permanent searchable domain via a persistent Cloudflare Named Tunnel (`cloudflared service install`) so anyone can find and access the platform online with a permanent URL.
4. **24/7 Windows Service / PM2 Process Daemonization (`PLANNED` — `docs/DEPLOYMENT_GUIDE.md`):** Running `server.js` under `pm2` with `pm2-windows-startup` and configuring Windows Auto-Logon + Power & Sleep locks on the dedicated production kiosk/server PC.

---

## 6. Realistic Three-Phase Roadmap

### Phase 1: Public Deployment, Flagship DA-LARES Launch & 11-Table MySQL `/admin` Portal (`IN PROGRESS`)
- **Deploy DA-LARES Publicly & On-Site (`IMPLEMENTED`):** Launch the complete 3D **DA-LARES** map so it can be searched online by anyone and used on the Argosino Hall touchscreen kiosk and smartphone QR/GPS handoff.
- **11-Table MySQL Database, Web `/admin` Portal & Agronomic Plot CRUD (`IMPLEMENTED`):** Full CRUD for stations, `"You Are Here"` pin, buildings, `.webp` photos, internal offices, and live worker plot records (`current_crop`, `tree_count`, `planting_cycle`) protected by hashed credentials (`admin_users`) and synced live via `BroadcastChannel`.
- **Gate Secondary Stations as "Under Development" (`IMPLEMENTED` in `js/stations.js` & `/admin`):** Keep **DA-QARES**, **DA-RARES**, and **DA-CARES** visible in the station selector while displaying the *"Station Under Development"* modal in public deployed mode (toggleable with one click in `/admin`).
- **Hardened Public Security & 3-Tier Adaptive GPU Engine (`IMPLEMENTED`):** Retired public `Alt+Shift+A` shortcut, added `403 Forbidden` source/secret firewall in `server.js`, and enabled automatic integrated-GPU Eco-Tuning (`js/performance.js`).
- **Gate Secondary Stations as "Under Development" (`IMPLEMENTED` in `js/stations.js` & `/admin`):** Keep **DA-QARES**, **DA-RARES**, and **DA-CARES** visible in the station selector while displaying the *"Station Under Development"* modal in public deployed mode (toggleable with one click in `/admin`).
- **Hardened Public Security & 3-Tier Adaptive GPU Engine (`IMPLEMENTED`):** Retired public `Alt+Shift+A` shortcut, added `403 Forbidden` source/secret firewall in `server.js`, and enabled automatic integrated-GPU Eco-Tuning (`js/performance.js`).

### Phase 2: Permanent Custom Domain & Field Analytics (Months 1–2)
- **Bind Permanent Searchable Domain (`LIM-02`):** Upgrade from the temporary `*.trycloudflare.com` quick tunnel to a permanent custom domain and bundle local JS/QR libraries (`LIM-01`).
- **Add Anonymous Usage Counters (Privacy-Safe):** Log simple daily counts in MySQL (most-searched buildings, plots inspected, routes computed, QR scans) without collecting any personal or GPS data.

### Phase 3: Full Regional Station Rollout — RARES, QARES & CARES (Months 3–6)
- **Unlock DA-RARES (Tanay, Rizal) & DA-QARES (Tiaong, Quezon):** Complete the remaining `< 300 KB` 3D `.glb` building models, `.webp` field photos, and office/plot directories for RARES and QARES, then click **Switch to Live** in `/admin`.
- **Onboard DA-CARES (Naic, Cavite):** Complete drone orthomosaic tiling, footprint mapping, routing graph, and 3D modeling for Cavite.
- **Bilingual (English / Tagalog) & Audio Accessibility (`LIM-06`):** Add a Tagalog language toggle for farmer visitors and optional voice-guided turn announcements on mobile phones.

---

## Verification — Files Read to Produce This Document

- `docs/00-system-overview.md`, `docs/01-modules.md`, `docs/02-use-cases.md`
- `server.js`, `package.json`, `.env.example`, `.gitignore`
- `index.html`, `legacy.html`, `css/*.css`
- `js/app.js`, `js/stations.js`, `js/qr.js`, `js/map-setup.js`, `js/drone-calibration.js`, `js/data/config.js`, `js/data/offices.js`, `js/data/stations.js`, `js/data/plots.js`
- `draw.html`, `road_draw.html`, `plot_draw.html`, `tree_draw.html`, `pill_adjust.html`
- `AGENTS.md`, `docs/DEPLOYMENT_GUIDE.md`, `docs/CSS_MODULARIZATION_PLAN.md`, `docs/SESSION_HANDOFF.md`
