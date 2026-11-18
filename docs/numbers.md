# DA-CALABARZON Mapping System — Canonical System Numbers & Metrics

This reference document establishes the single source of truth for all metrics and counts across the project documentation. Every figure below is verified directly from code, data files, or database queries.

---

## 1. Summary of Canonical Counts

| Metric | Verified Count | Scope & Details | Command / Query to Reproduce |
| :--- | :---: | :--- | :--- |
| **Research Stations** | **4** | DA-LARES (Lipa), DA-QARES (Tiaong), DA-RARES (Tanay), DA-CARES (Naic) | `SELECT COUNT(*) FROM stations;` |
| **MySQL Database Tables** | **11 core** *(+2 legacy = 13)* | 11 active tables in `kiosk` schema + 2 legacy fallback tables (`settings`, `building_colors`) | `SHOW TABLES;` |
| **Mapped Buildings (All Stations)** | **148** | 50 LARES + 53 QARES + 45 RARES | `SELECT COUNT(*) FROM buildings;` |
| **Numbered Directory Facilities (LARES)** | **39** | Facilities numbered 1 to 39 in the user directory | `SELECT COUNT(*) FROM buildings WHERE station_id='lares' AND bldg_num IS NOT NULL;` |
| **Total Building Footprints (LARES)** | **50** | 39 numbered + 9 screenhouse/annex structures + 2 Plot 22 utility amenities | `SELECT COUNT(*) FROM buildings WHERE station_id='lares';` |
| **Custom 3D Building Models (`.glb`)** | **54** | 49 LARES buildings + 1 RARES Guard House + 4 tree models (all under 300 KB) | `node -e "console.log(fs.readdirSync('models').filter(f=>f.endsWith('.glb')).length);"` |
| **Active LARES 3D Placements** | **49** | Registered entries in `CUSTOM_3D_BUILDINGS` | `node -e "import('./js/data/buildings.js').then(b=>console.log(Object.keys(b.CUSTOM_3D_BUILDINGS).length));"` |
| **Verified Internal Offices (LARES)** | **47** | Across 9 multi-office buildings (+ 3 embedded conference halls) | `SELECT COUNT(*) FROM building_offices WHERE station_id='lares';` |
| **Buildings Housing Internal Offices (LARES)** | **9** | Multi-office facilities (`tanco`, `admin`, `ored`, `lares`, `raed`, `multi_purpose`, `mis_rafis`, `rsbsa`, `rnd`) | `SELECT COUNT(DISTINCT building_id) FROM building_offices;` |
| **Building Images (`.webp`)** | **63** | Optimized `.webp` facility photographs | `SELECT COUNT(*) FROM building_images;` |
| **Building Entrance Nodes (LARES)** | **43** | Exterior doorway routing nodes snapped to walkways | `SELECT COUNT(*) FROM building_entrances WHERE station_id='lares';` |
| **Commodity Zones (LARES)** | **23** | Official agricultural commodity zones | `node -e "import('./js/data/plots.js').then(p=>console.log(p.FIELD_COMMODITY_ZONES.length));"` |
| **Individual Field Plots (LARES)** | **45** | Numbered agricultural field plots (Plots 1–45) | `node -e "import('./js/data/plots.js').then(p=>console.log(p.ALL_PLOT_POLYGONS.length));"` |
| **Agricultural Plots in Database** | **51** | 23 LARES zones + 28 RARES plots with agronomic attributes | `SELECT COUNT(*) FROM agricultural_plots;` |
| **Screenhouse Sub-Plots** | **9** | Screenhouses 1–5 (Plot 17) and 6–9 (Plot 18) | `SELECT COUNT(*) FROM plot_subplots;` |
| **Campus Trees (LARES)** | **131** | Placed 3D trees across campus | `SELECT COUNT(*) FROM campus_trees;` |
| **Road & Walkway Features (LARES)** | **101** | 57 road segments, 1 walkway segment, 43 entrance nodes | `node -e "console.log(JSON.parse(fs.readFileSync('roads.json')).features.length);"` |
| **Road Features in Database (All Stations)** | **180** | 101 LARES + 31 QARES + 48 RARES | `SELECT COUNT(*) FROM road_features;` |
| **Routing Graph Nodes (LARES)** | **2,668** | 1-meter segmented routing graph nodes (43/43 entrances reachable) | `node tools/tests/test_routing_graph.js` |
| **Total Road & Walkway Length (LARES)** | **2.68 km** | 2,684 meters across campus pedestrian network | `node tools/tests/test_routing_graph.js` |
| **Standalone Compound Gates (LARES)** | **3** | Main Entrance Gate, Main Exit Gate, Back Gate | `node -e "import('./js/data/buildings.js').then(b=>console.log(Object.keys(b.STANDALONE_GATES).length));"` |
| **Wayfinding Descriptions** | **53** | Visual landmark and service descriptions | `node -e "import('./js/data/descriptions.js').then(d=>console.log(Object.keys(d.BUILDING_WAYFINDING_INFO).length));"` |
| **Facility Categories (Filter Menu)** | **7** | Infrastructure, Trial Sites, Orchard, Office, Laboratory, Conference, Digital Agri | `node -e "import('./js/data/buildings.js').then(b=>console.log(Object.keys(b.BUILDING_CATEGORIES).length));"` |
| **Offline Drone MBTiles Archives** | **3** | LARES (210.66 MB), QARES (223.44 MB), RARES (206.54 MB) = 640.64 MB total | `node -e "['LARES v1.mbtiles','QARES v1.mbtiles','RARES v1.mbtiles'].forEach(f=>console.log(f, fs.statSync(f).size/(1024*1024)));"` |
| **Frontend ES Modules** | **27** | 19 modules in `js/` + 8 data modules in `js/data/` | `Get-ChildItem js\*.js, js\data\*.js` |
| **Modular CSS Files** | **8** | Domain stylesheets in `css/` (9,852 total lines) | `Get-ChildItem css\*.css` |

---

## 2. HTTP Routes Reconciliation (36 vs. 54 vs. 65)

Historical documents mentioned **36** or **54** HTTP routes. The exact reconciliation is as follows:

| Component | Route Handlers Count | Unique Endpoints Count | Explanation |
| :--- | :---: | :---: | :--- |
| **`server.js`** | **43** | **41** | Contains 43 `app.get/post/put/delete` declarations. Two are duplicate declarations (`GET /api/drone-offset` and `POST /api/drone-offset` declared in both simple JSON and MySQL blocks), leaving 41 unique route patterns. In early development before adding versioning and multi-station tile routes, `server.js` had **36** routes. |
| **`database/admin_api.js`** | **22** | **22** | Dedicated management and bootstrap API mounted under `/api` (`/api/bootstrap`, `/api/admin/login`, `/api/admin/stations`, `/api/admin/buildings`, `/api/admin/offices`, `/api/admin/plots`, etc.). Early drafts estimated 18 routes (36 + 18 = **54**). |
| **Combined System Total** | **65** | **63** | Total active Express HTTP route handlers currently registered in the runtime. |

### Verification Command
Run the verification script:
```bash
node tools/count_metrics.mjs
```

---

## 3. MySQL Schema Structure (The Real 11 Core Tables)

The real MySQL schema consists of **11 core relational tables** plus 2 legacy fallback tables:

1. **`stations`** (4 rows): Research station registry, coordinates, kiosk pins, and active status.
2. **`buildings`** (148 rows): All mapped facility footprints across LARES, QARES, and RARES.
3. **`building_images`** (63 rows): Facility `.webp` photographs with angle tags and primary flags.
4. **`building_offices`** (47 rows): Internal division/unit directory with floor assignments.
5. **`building_entrances`** (43 rows): Pedestrian entrance doorway coordinates snapped to roads.
6. **`agricultural_plots`** (51 rows): Field plots and commodity zones with crop, tree count, and cycle data.
7. **`plot_subplots`** (9 rows): Named screenhouse sub-plots inside Plots 17 and 18.
8. **`campus_trees`** (131 rows): 3D campus tree positions and models.
9. **`road_features`** (180 rows): Roads, walkways, and entrance vectors across all stations.
10. **`admin_audit_logs`**: Immutable timestamped change history for admin actions.
11. **`admin_users`** (1 row): Administrative user accounts with hashed credentials.
*(Legacy support tables: `settings` (6 rows) and `building_colors` (46 rows)).*

