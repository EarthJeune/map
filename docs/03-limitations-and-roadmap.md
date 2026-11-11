# DA-CALABARZON Interactive 3D Research Station Mapping & Wayfinding System — Limitations, Security Review & Roadmap

> [!IMPORTANT]
> **Audience Notice:** This document is strictly for the **IT Maintainer, Project Developers, and Supervisors** to guide pre-deployment hardening, regional station rollout, and agronomic feature expansion. **Do not put the internal security hardening items listed in Section 1 onto public presentation slides.**

---

## 1. Security Hardening Items for Public Web Deployment

Because the system is being deployed so **anyone can search and access it online** (and so on-site visitors can open QR code links on their smartphones over mobile data), the Express server (`server.js`) is reachable from the public internet. The items below were identified directly in the code and should be locked down for public production hosting.

| ID | Security Item & Code Citation | Severity | Suggested Fix |
| :--- | :--- | :---: | :--- |
| **SEC-01** | **Unauthenticated Write API Endpoints Exposed Over Public Web/Tunnel:** All `POST` and `DELETE` endpoints in `server.js` (`POST /api/pin`, `POST /api/qares/pin`, `POST /api/rares/pin`, `POST /api/colors`, `POST /api/drone-offset`, `POST /api/tunnel`, `POST /api/drawings`, `DELETE /api/drawings`, `POST /api/sync-drawing`, `POST /api/roads`, `POST /api/trees`, `POST /api/buildings`, `POST /api/plots/sync`, `POST /api/qares/*`, `POST /api/rares/*`) accept requests without checking a password, session cookie, or IP address. | **HIGH** | Add an Express middleware in `server.js` that restricts all `POST`/`DELETE` routes and standalone editor pages (`*draw.html`, `pill_adjust.html`) to either: **1)** local workstation loopback requests (`req.ip === '127.0.0.1'` / `'::1'` without `cf-connecting-ip` header), or **2)** a valid `X-Admin-Password` header checked against `process.env.ADMIN_PASSWORD` in `.env`. |
| **SEC-02** | **Client-Side Only Admin Mode Toggle (`?admin=1` / `Alt+Shift+A`):** In `js/app.js` (`initAdminMode()`, `toggleAdminMode()`), Admin Mode is enabled by adding `?admin=1` to the URL or pressing `Alt + Shift + A`, storing `'true'` in `localStorage.getItem('da_admin_mode')`. | **HIGH** | Prompt the administrator for an admin PIN/password when `toggleAdminMode()` or `?admin=1` is triggered, verify it against a `POST /api/admin/verify` endpoint in `server.js`, and block `?admin=1` when accessed via the public domain/tunnel. |
| **SEC-03** | **Root Directory Static File Serving (`express.static(__dirname)`):** In `server.js`, `app.use(express.static(__dirname, ...))` serves the project root directory over HTTP. While Express ignores dotfiles (such as `.env`) by default, remote users with the public URL could request `server.js`, `package.json`, `*.bat`, or standalone authoring tools (`draw.html`, `road_draw.html`, `plot_draw.html`, `pill_adjust.html`). | **MEDIUM** | Replace `express.static(__dirname)` with explicit static mounts for public directories only (`/js`, `/css`, `/models`, `/images`) plus an allowlist for root public files (`index.html`, `manifest.json`, `roads.json`, `qares_roads.json`, `rares_roads.json`, `trees.json`), blocking external access to `server.js`, `*.bat`, `*.ps1`, and `*draw.html`. |
| **SEC-04** | **Hardcoded Mapbox Public Token Without Verified URL Restrictions:** `MAPBOX_ACCESS_TOKEN` (`pk.*`) is committed directly in `js/data/config.js:4` and inside the standalone `*draw.html` files. While Mapbox `pk.*` tokens are designed to be public in browsers, an unrestricted token copied from client source code can be used on external sites and consume monthly map-load quotas. | **MEDIUM** | In the Mapbox Account Dashboard, configure **URL Restrictions** on the public token (limiting allowed referrers to `http://localhost:8080`, `https://*.trycloudflare.com`, and the official deployed domain) and rotate the token periodically. |
| **SEC-05** | **Permissive CORS Policy (`app.use(cors())`):** `server.js` enables `cors()` for all origins (`*`) across all endpoints. | **LOW** | Restrict CORS to same-origin requests or an explicit allowlist of the kiosk/deployed origins, especially on state-modifying endpoints. |

---

## 2. Current Operational Boundaries in Code

These items represent real operational boundaries in the current deployment setup and how the system handles them.

| ID | Operational Boundary & Code Citation | Severity | Resolution / Planned Enhancement |
| :--- | :--- | :---: | :--- |
| **LIM-01** | **Internet Required on Initial Page Load / Refresh:** Although the 210.66 MB drone orthomosaic (`LARES v1.mbtiles`), 54 `.glb` 3D models, 63 `.webp` photos, and `roads.json` are stored locally, `index.html` loads Mapbox GL JS (`v3.31.0`), Turf.js (`@turf/turf@6`), and Google Fonts from external CDNs, and `js/map-setup.js` initializes with `mapbox://styles/mapbox/...` cloud styles. Refreshing the local kiosk while compound internet is down leaves the map canvas blank. | **MEDIUM** | Vendor `mapbox-gl.js`, `mapbox-gl.css`, `turf.min.js`, and `Inter` font files into a local `vendor/` directory, and provide a minimal local JSON style specification in `js/map-setup.js` that loads `/api/tiles/{z}/{x}/{y}` when `api.mapbox.com` is unreachable. |
| **LIM-02** | **Cloudflare Quick Tunnel Ephemeral URLs vs. Named Domain:** `startCloudflareTunnel()` (`server.js`) runs a free Quick Tunnel (`trycloudflare.com`) when no permanent domain is configured. Quick Tunnels generate a new random URL whenever `server.js` restarts and have a 200-concurrent-request cap. | **MEDIUM** | Transition to a **Cloudflare Named Tunnel** or cloud reverse proxy bound to a permanent searchable domain (as outlined in `docs/DEPLOYMENT_GUIDE.md`), and bundle a local `qrcode.min.js` generator inside `js/qr.js`. |
| **LIM-03** | **Secondary Research Stations (`DA-QARES`, `DA-RARES`, `DA-CARES`) Are Gated as "Under Development" for Initial Launch:** While **DA-LARES** is 100% complete and presented live, **DA-QARES** (Tiaong), **DA-RARES** (Tanay), and **DA-CARES** (Naic) are still undergoing 3D modeling and directory verification. In deployed mode (`isDeployedMode()` in `js/stations.js`), selecting QARES, RARES, or CARES intentionally triggers the **"Station Under Development"** modal (`showStationDevModal()`) so public users only interact with the finished DA-LARES campus while seeing that the platform covers all 4 CALABARZON stations. | **LOW (By Design)** | Keep `isDeployedMode()` active during the Tech Update deployment so QARES, RARES, and CARES display the clean *"Under Development"* modal publicly, while developers continue building their 3D models locally on `localhost:8080`. |
| **LIM-04** | **Agricultural Plots Currently Display Zone/Plot Boundaries & Names Only (Worker Agronomic Database Next):** The system maps all **45 numbered field plots** across **23 commodity zones** in DA-LARES (`js/data/plots.js`) and **45 field plots** in DA-RARES (`rares_plots.json`), complete with screenhouse and utility sub-plots. However, dynamic agronomic metrics for station workers (tree counts, current planted variety, planting date, and annual vs. monthly/seasonal crop cycle tags) are not yet attached to individual plot drawers. | **MEDIUM** | Expand `js/data/plots.js` and the MySQL database schema to store per-plot agronomic records for station workers: `currentCrop`, `variety`, `treeCount`, `plantingCycle` (`Annual / Perennial` vs. `Monthly / Seasonal`), `datePlanted`, and `plotStatus`. |
| **LIM-05** | **Outdoor-Only Navigation (No Indoor Floor Plans):** The system routes users to each building's exterior entrance node (`roads.json`). For multi-story buildings, `admin_building` groups its 10 offices by `Ground Floor` and `2nd Floor` text headings (`js/data/offices.js`); there are no interactive indoor floor maps. | **LOW** | Keep indoor routing out of scope for phase 1, and add `Ground Floor` / `2nd Floor` text groupings to the other 2-story buildings (`tanco_hall_building`, `rnd_building`, `amad_building`, `tissue_culture_building`) in `js/data/offices.js`. |
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
| **DEBT-04** | **Library Version Mismatch Between Main App and Authoring Tools:** `index.html` loads Mapbox GL JS `v3.31.0` and `@turf/turf@6` from CDN, while `draw.html`/`road_draw.html`/`plot_draw.html` load Mapbox GL JS `v2.15.0`. | **LOW** | Standardize Mapbox GL JS (`v3.31.0`) and Turf.js versions across all HTML files and `package.json`. |

---

## 4. Proposed Complete MySQL Database Architecture (10 Tables + Exact UI Fallbacks)

Currently, the MySQL `kiosk` database only stores two tables (`settings` and `building_colors`). Because all campus buildings now use **bespoke 3D `.glb` architectural models** with authentic roof textures baked in, the `building_colors` table is obsolete—today, the most important live database setting is the **`"You Are Here"` kiosk pin position (`kiosk_pin`)** so the physical kiosk can be moved between lobbies at any time.

However, after scanning every data file in the project (`js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`, `js/building-panel.js`, `roads.json`, `trees.json`), a simple 5- or 6-table database is **not enough** to handle multi-angle building photos, office search aliases/acronyms, embedded conference rooms, 3-level agricultural plot hierarchies (Zones → Plots 1–45 → Screenhouse Sub-Plots), standalone gates, and routing nodes.

Below is the **complete 10-Table MySQL Schema** designed to replace hardcoded `.js` data files while handling every empty/single/multiple data case cleanly.

### Complete 10-Table MySQL Schema (`kiosk` Database)

| # | Table Name | What It Stores | Key Columns |
| :---: | :--- | :--- | :--- |
| **1** | **`stations`** | The 4 CALABARZON research stations, their live **`"You Are Here"` kiosk pin**, drone alignment offset, and camera defaults. | `station_id` (`lares`, `qares`, `rares`, `cares`), `name`, `short_name`, `status` (`live` \| `under_development`), **`kiosk_pin_lng`**, **`kiosk_pin_lat`**, `drone_offset_dx`, `drone_offset_dy`, `default_center_lng`, `default_center_lat`, `default_zoom`, `default_pitch`, `default_bearing`, `mbtiles_filename` |
| **2** | **`menu_categories`** | The 7 Filter Dropdown / Menu Categories, their display titles, icons, and order. | `category_id` (`infrastructure`, `trial_sites`, `orchard`, `office`, `laboratory`, `conference`, `digital_agri`), `display_name`, `icon_name` (Lucide icon or emoji), `badge_color`, `sort_order`, `is_active` |
| **3** | **`facilities`** | All numbered buildings (`1`–`39`), unnumbered utilities (`plot22_water_tank`, `plot22_comfort_room`), screenhouse structures, and compound gates (`Main Entrance`, `Main Exit`, `Back Gate`). | `facility_id` (PK), `station_id` (FK), `building_number` (`1`–`39` or `NULL`), `name`, `facility_type_label` (e.g., `'Division Office Building'`, `'Standalone Conference Hall'`), `category_id` (FK), `icon`, `badge_color`, `compact_tag` (subtitle), `how_to_spot_it` (`visualLandmark`), `whats_inside` (`keyServices`), `offices_status` (`'none'` \| `'active'` \| `'pending'`), `is_sub_plot` (BOOL), `is_utility_amenity` (BOOL), `is_gate` (BOOL), `linked_guard_house_id` (FK for gates), `has_marker` (BOOL), `center_lng`, `center_lat`, `marker_pill_lng`, `marker_pill_lat`, `model_glb_url`, `model_lng`, `model_lat`, `model_rotation`, `model_scale`, `footprint_geojson` |
| **4** | **`facility_offices`** | Internal offices, divisions, and embedded conference halls inside parent buildings, including floor groupings and search acronyms. | `office_id` (PK), `facility_id` (FK), `office_name` (e.g., `'PMED'`, `'Cashier'`), `full_official_name` (e.g., `'Planning, Monitoring and Evaluation Division'`), `search_aliases` (e.g., `'BAC, Bidding, Procurement'`), `floor_label` (`'Ground Floor'`, `'2nd Floor'`, or `NULL`), `is_conference_room` (BOOL — automatically surfaces under the *Conference & Training* filter), `sort_order` |
| **5** | **`entity_photos`** *(Multi-Photo Gallery)* | Stores **0, 1, or multiple `.webp` pictures** for any building, gate, commodity zone, or sub-plot. | `photo_id` (PK), `entity_type` (`'facility'` \| `'commodity_zone'` \| `'sub_plot'`), `entity_id` (FK), `image_webp_url` (e.g., `'images/raed_building.webp'`), `view_label` (e.g., `'Front Facade'`, `'Side View'`, `'Signage'`, `'Interior'`), `is_primary` (BOOL), `sort_order` |
| **6** | **`commodity_zones`** *(Master Plot Groups)* | The 23 official commodity zones (e.g., *Citrus Orchard Plots 6–12*, *TC Makapuno Screenhouse Plot 17*, *Coffee Orchard Plot 22*). | `zone_id` (PK), `station_id` (FK), `zone_name`, `plot_range_label` (e.g., `'Plots 6–12'`), `category_id` (FK), `icon`, `zone_color`, `description`, `area_sqm`, `center_lng`, `center_lat`, `outer_polygon_geojson`, `internal_cut_lines_geojson` |
| **7** | **`agricultural_plots`** *(Individual Plots 1–45 & Worker Data)* | Each individual numbered plot (`Plot 1` to `Plot 45`) and its **Worker Agronomic Intelligence**. | `plot_id` (PK), `station_id` (FK), `zone_id` (FK), `plot_number` (`1`–`45`), **`current_crop`** (e.g., `'Mandarin Citrus'`, `'Yellow Corn'`), **`crop_variety`** (e.g., `'Ladu / Szinkom'`), **`tree_count`** (INT or `NULL` for row crops), **`planting_cycle`** (`'annual_perennial'` \| `'monthly_seasonal'`), **`date_planted`**, **`expected_harvest`**, **`plot_status`** (`'Active / Planted'` \| `'Fallow / Resting'` \| `'Land Preparation'` \| `'Harvesting'`), `worker_notes`, `plot_polygon_geojson`, `updated_at` |
| **8** | **`zone_subplots`** *(Screenhouses & Field Utilities)* | Clickable sub-plots inside a master zone (e.g., *Screenhouses 1–5* in Plot 17, *Screenhouses 6–9* in Plot 18, *Water Tank & CR* in Plot 22). | `subplot_id` (PK), `zone_id` (FK), `linked_facility_id` (FK to `facilities`), `subplot_number_label`, `title`, `details_subtitle`, `center_lng`, `center_lat`, `sort_order` |
| **9** | **`road_network_features`** & **`campus_trees`** | The pedestrian routing graph (`road`, `walkway`, and `entrance` nodes from `roads.json`) and 3D tree placements (`trees.json`). | `feature_id` (PK), `station_id` (FK), `feature_type` (`'road'` \| `'walkway'` \| `'entrance'` \| `'tree'`), `linked_facility_id` (for `entrance` nodes), `tree_model_type` (`1`–`4`), `geometry_geojson` |
| **10** | **`admin_users` & `audit_log`** | Server-side password authentication and change history so only authorized staff can edit the database. | `user_id` (PK), `username`, `password_hash` (bcrypt), `role` (`'super_admin'` \| `'station_admin'` \| `'farm_superintendent'`), `last_login` |

---

### How the System Behaves for Every Edge Case (Empty vs. Single vs. Multiple Rows)

| Scenario / Edge Case | What Is in MySQL | Exact Output in the Map & Drawer UI |
| :--- | :--- | :--- |
| **1. A building has NO internal offices** *(e.g., Argosino Hall, Canteen, Guard House, Warehouses, Laboratories)* | `0` rows in `facility_offices` and `offices_status = 'none'` | The **"Offices & Units" section is completely hidden** (`renderBuildingOfficesHTML()` returns `''`). The drawer only shows the building's photo, *"How to Spot It"*, and *"What's Inside & Services"*. |
| **2. A building has offices on 1 floor vs. multiple floors** *(e.g., ORED vs. Admin Building)* | Rows in `facility_offices` have `floor_label = NULL` (single floor) or `'Ground Floor'` / `'2nd Floor'` (multi-floor) | If `floor_label` is `NULL`, renders a single clean list of office pills. If `floor_label` has values, automatically groups pills under **`Ground Floor (6 offices)`** and **`2nd Floor (4 offices)`** headers. |
| **3. A new station's building hasn't had its offices surveyed yet** *(e.g., DA-QARES / DA-RARES)* | `offices_status = 'pending'` | Renders a clean info badge: **"Offices information pending update"** without displaying fake or empty office pills. |
| **4. A building has MULTIPLE pictures** *(e.g., Front Facade, Side Angle, Entrance Sign)* | `2` or more rows in `entity_photos` for that `facility_id` | Displays the `is_primary = 1` photo first and automatically shows the **View Angle Switcher Chips** (`[Front Facade] [Side Angle] [Signage]`) at the bottom of the photo so users can switch pictures or enlarge any angle in the Lightbox. |
| **5. A building has ONLY 1 picture** | `1` row in `entity_photos` | Displays the single `.webp` photo with the **Enlarge** button and **hides** the angle-switcher chip bar so there is no redundant 1-button bar. |
| **6. A building or plot has NO picture yet** | `0` rows in `entity_photos` | **For a Building:** Shows the clean stylized placeholder card with its category icon and `"<Building Name> (No Photo)"`. **For an Agricultural Plot:** Cleanly hides the image box (`display: none`) so the plot details move seamlessly to the top. |
| **7. An agricultural plot is an Orchard (Trees) vs. a Seasonal Row Crop (Corn/Vegetables)** | `agricultural_plots.tree_count` is `145` (`planting_cycle = 'annual_perennial'`) vs. `tree_count = NULL` (`planting_cycle = 'monthly_seasonal'`) | **If `tree_count > 0`:** Shows the **`🌳 Tree Count: 145 Trees`** badge and **`Annual / Perennial Orchard`** tag. **If `tree_count IS NULL`:** Hides the tree counter and shows **`📅 Cycle: Monthly / Seasonal Trial`** + planted/harvest months. |
| **8. A multi-plot zone has NO sub-plots vs. Screenhouse Sub-Plots** *(e.g., Plots 6–12 Citrus vs. Plot 17 Screenhouses)* | `0` rows in `zone_subplots` vs. `5` rows in `zone_subplots` | **If `0` rows:** Hides the *"Sub-Plots in this Zone"* list (strictly complying with Rule 9—zero fabricated sub-plots). **If `> 0` rows:** Renders clickable sub-plot cards (*Screenhouse 1–5*) that zoom to the sub-plot and swap the drawer photo to that screenhouse's picture. |
| **9. Unnumbered Field Utilities (`plot22_water_tank`, `plot22_comfort_room`)** | `building_number = NULL`, `is_utility_amenity = 1`, `has_marker = 0` | Hidden from the default `LARES BUILDINGS (39)` list so the numbering stays `1`–`39`, but automatically appears when the user searches `"water"` / `"comfort room"` or filters by **Agri Infrastructure**. |

### Full CRUD Operations Matrix (What Admins & Staff Can Create, Read, Update & Delete)

Turning all campus, menu, office, and agricultural plot data into a MySQL database enables complete **CRUD (Create, Read, Update, Delete)** operations through a password-protected Admin Dashboard—eliminating the need to edit `.js` code files:

| Data Domain (MySQL Table) | **C — Create (`POST`)** | **R — Read (`GET`)** | **U — Update (`PUT / PATCH`)** | **D — Delete (`DELETE`)** |
| :--- | :--- | :--- | :--- | :--- |
| **1. Research Stations & `"You Are Here"` Pin (`stations`)** | Register a new DA research station with initial camera coordinates and `.mbtiles` filename. | Load station list, status (`live` vs. `under_development`), and starting pin on map boot. | **Drag & save the `"You Are Here"` kiosk pin**, update drone offset (`dx`, `dy`), or switch a station from `under_development` to `live`. | Remove a temporary or test station entry. |
| **2. Menu & Filter Categories (`menu_categories`)** | Add a new filter category with a custom display name, icon, and badge color. | Populate the sidebar Filter Dropdown and mobile category chips dynamically. | Rename a category, change its SVG/emoji icon, change its badge color, or reorder how categories appear in the menu. | Delete or hide (`is_active = 0`) an unused category. |
| **3. Buildings, Utilities & Gates (`facilities`)** | Add a new building, screenhouse, field utility, or gate with its 2D footprint polygon and 3D `.glb` model path. | Load all searchable facilities, 3D model placements, and numbered map pins (`1`–`39`). | Edit building name, sequence number, subtitle (`compact_tag`), *"How to Spot It"*, *"What's Inside"*, category, icon, floating pill coordinates, or 3D rotation. | Delete a demolished structure or test polygon (automatically cascading or unlinking its offices/photos). |
| **4. Internal Offices & Units (`facility_offices`)** | Add a new division, section, or conference hall inside any building. | Display office pills in the building drawer (or hide the card if `0` offices exist) and match search queries/acronyms. | Rename an office, edit its search acronyms (`BAC`, `GAD`), change its floor (`Ground Floor` / `2nd Floor`), or **move an office to a different building** by changing `facility_id`. | Delete a dissolved or merged office unit. |
| **5. Multi-Angle Photo Gallery (`entity_photos`)** | Upload 1 or multiple photos for a building or plot (auto-converted by `server.js` to `.webp` and saved in `images/`). | Display the primary photo, view-switcher angle chips (if `>= 2` photos), or fallback placeholder (if `0` photos). | Change which photo is `is_primary`, rename angle labels (`Front Facade`, `Side View`, `Signage`), or reorder chips. | Delete an outdated photo from both MySQL and the `images/` folder. |
| **6. Master Commodity Zones (`commodity_zones`)** | Create a new multi-plot agricultural zone with outer boundary polygon and cut lines. | Render the 23 agricultural zones on the map and in the directory filter. | Rename a commodity zone, change its plot range label, icon, color, or boundary vertices. | Delete a retired commodity zone. |
| **7. Individual Agricultural Plots 1–45 (`agricultural_plots`)** | Register a numbered field plot (`Plot 1`–`45`) inside a commodity zone. | Display plot-level agronomic cards for station workers and researchers. | **Update what crop/variety is planted, update the exact tree count, toggle `Annual / Perennial` vs. `Monthly / Seasonal`, and update planting/harvest months or `Fallow` status.** | Delete or reset an obsolete plot record. |
| **8. Zone Sub-Plots (`zone_subplots`)** | Add a clickable sub-plot card (e.g., a new screenhouse or field utility) inside a master zone. | List sub-plot cards inside the Plot Drawer (or hide the section if `0` sub-plots exist). | Edit the sub-plot title, subtitle details, or linked building ID. | Delete a sub-plot card. |
| **9. Roads, Entrances & 3D Trees (`road_network_features`)** | Draw new road segments, walkways, building entrance nodes, or 3D trees in the visual editor. | Build the in-memory Dijkstra routing graph (`buildRoadGraph()`) and 3D tree layer on startup. | Move road vertices, snap entrance nodes, or change 3D tree scale/type. | Delete a closed walkway, old entrance node, or removed tree. |
| **10. Admin Users & Security (`admin_users`)** | Create accounts for IT Admins and Farm Superintendents with role-based permissions. | Verify login sessions and view the audit log of who updated a building or plot. | Change passwords or update user roles (`super_admin` vs. `farm_superintendent`). | Revoke/delete an admin user account. |

> **What Stays on Disk (Referenced by Path in MySQL):** Binary media files—specifically the **3D `.glb` models** (`models/*.glb`), **optimized `.webp` images** (`images/*.webp`), and **~200 MB `.mbtiles` drone databases** (`LARES v1.mbtiles`)—remain stored as files on disk while MySQL stores their file paths (`model_glb_url`, `image_webp_url`, `mbtiles_filename`). This keeps MySQL queries under 15 milliseconds and allows the browser to cache 3D models and WebP images normally.

### Why This Database Architecture Never Leaks:
1. **MySQL Stays Strictly Local (`127.0.0.1:3306`):** The MySQL server is never exposed to the public internet—only `server.js` on the local machine can query it using credentials stored in `.env`.
2. **Public Visitors Only Get Read-Only JSON (`GET /api/bootstrap`):** When anyone searches the map online, the browser calls read-only `GET` endpoints that return public display fields (names, `.webp` image paths, descriptions, plot crop info).
3. **Password-Protected Admin CRUD API (`POST / PUT / DELETE`):** Any `CREATE`, `UPDATE`, or `DELETE` action on the `"You Are Here"` pin, menu categories, building descriptions, `.webp` photos, or plot tree counts requires a valid server session token (`admin_users`), completely replacing regex file-rewriting (`DEBT-02`).

---

## 5. Planned Features (Next Evolution of the Platform)

The following capabilities represent the planned next steps for the system across DA-CALABARZON:

1. **Database-Driven Menu, Facility & Agronomic Plot CMS (`PLANNED`):** Migrating static `.js` metadata into the 6-table MySQL schema above so staff can update descriptions, `.webp` photos, menu icons, office assignments, and **worker-facing plot intelligence**:
   - **Current Planted Crop & Variety:** What specific commodity or accession is currently planted in Plots 1–45.
   - **Tree Inventory & Count:** Exact number of bearing/non-bearing trees per orchard plot (e.g., Citrus, Coffee, Mango, Avocado, Rambutan, Lanzones, Durian, Cacao).
   - **Cropping Cycle Classification:** Clear visual tags distinguishing **Annual / Perennial Plots** (long-term orchards and plantations) from **Monthly / Seasonal Trial Plots** (corn, cassava, vegetables, and rotational trials), plus planting and expected harvest months.
2. **Completing DA-RARES, DA-QARES & DA-CARES (`IN PROGRESS / PLANNED`):**
   - **DA-RARES (Tanay, Rizal):** Drone orthomosaic (`RARES v1.mbtiles`), 39 numbered building footprints (`rares_buildings.json`), 45 agricultural plots (`rares_plots.json`), road network (`rares_roads.json`), and the custom 3D Guard House model (`rares_guard_house.glb`) are already integrated; remaining buildings (`#2`–`#39`), photos, and wayfinding descriptions are next.
   - **DA-QARES (Tiaong, Quezon):** Drone orthomosaic (`QARES v1.mbtiles`), 48 footprints (`qares_buildings.json`), and roads (`qares_roads.json`) are integrated; custom 3D `.glb` models, plots, and office directories are next.
   - **DA-CARES (Naic, Cavite):** Aerial drone survey, footprint tracing, road network, and 3D modeling.
3. **Official Searchable Custom Domain & Named Cloudflare Tunnel (`PLANNED` — `docs/DEPLOYMENT_GUIDE.md`):** Binding the server to a permanent searchable domain via a persistent Cloudflare Named Tunnel (`cloudflared service install`) so anyone can find and access the platform online with a permanent URL.
4. **24/7 Windows Service / PM2 Process Daemonization (`PLANNED` — `docs/DEPLOYMENT_GUIDE.md`):** Running `server.js` under `pm2` with `pm2-windows-startup` and configuring Windows Auto-Logon + Power & Sleep locks on the dedicated production kiosk/server PC.

---

## 6. Realistic Three-Phase Roadmap

### Phase 1: Public Deployment & Flagship DA-LARES Launch (Current Tech Update)
- **Deploy DA-LARES Publicly & On-Site:** Launch the complete 3D **DA-LARES** map so it can be searched online by anyone and used on the Argosino Hall touchscreen kiosk and smartphone QR/GPS handoff.
- **Gate Secondary Stations as "Under Development" (`IMPLEMENTED` in `js/stations.js`):** Keep **DA-QARES**, **DA-RARES**, and **DA-CARES** visible in the station selector to showcase the regional 4-station platform, while automatically displaying the *"Station Under Development"* modal in public deployed mode.
- **Lock Down Public Write Endpoints (`SEC-01`–`SEC-04`):** Add localhost/password middleware to `POST`/`DELETE` routes in `server.js`, restrict `express.static`, and apply Mapbox URL referrer restrictions.

### Phase 2: Worker Agronomic Plot Intelligence & Permanent Domain (Months 1–2)
- **Launch Plot Agronomic Data for Station Workers (`LIM-04`):** Add plot-level agronomic cards for station staff showing **what is currently planted**, **tree counts per plot**, **planting dates**, and **Annual/Perennial vs. Monthly/Seasonal** plot classifications across Plots 1–45.
- **Bind Permanent Searchable Domain (`LIM-02`):** Upgrade from the temporary `*.trycloudflare.com` quick tunnel to a permanent custom domain and bundle local JS/QR libraries (`LIM-01`).
- **Add Anonymous Usage Counters (Privacy-Safe):** Log simple daily counts in MySQL (most-searched buildings, plots inspected, routes computed, QR scans) without collecting any personal or GPS data.

### Phase 3: Full Regional Station Rollout — RARES, QARES & CARES (Months 3–6)
- **Unlock DA-RARES (Tanay, Rizal) & DA-QARES (Tiaong, Quezon):** Complete the remaining `< 300 KB` 3D `.glb` building models, `.webp` field photos, and office/plot directories for RARES and QARES, then unlock them in public deployed mode.
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
