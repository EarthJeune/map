# DA-CALABARZON Interactive 3D Research Station Mapping & Wayfinding System — Technical Fact Sheet

This document contains the detailed system metrics, data breakdown, and source file references for the DA-CALABARZON mapping platform. For an executive overview, see `docs/00-one-page-summary.md`. For authoritative count verification, see `docs/numbers.md`.

---

## Technical Metric Matrix

| Metric | Verified Count | Source Reference | Notes |
| :--- | :---: | :--- | :--- |
| **Research Stations Supported** | **4** | `stations` MySQL table; `js/data/stations.js` | DA-LARES active; DA-QARES, DA-RARES, DA-CARES gated as under development |
| **Numbered Directory Facilities (LARES)** | **39** | `buildings` table; `js/data/buildings.js` | Facilities numbered 1 to 39 in campus directory |
| **Total Mapped Footprints (All Stations)** | **148** | `buildings` table | 50 LARES, 53 QARES, 45 RARES |
| **Custom 3D Building Models (`.glb`)** | **54** | `models/*.glb` | 49 LARES buildings, 1 RARES Guard House, 4 tree models (all < 300 KB) |
| **Active 3D Placements (LARES)** | **49** | `CUSTOM_3D_BUILDINGS` in `js/data/buildings.js` | Placed on station-isolated 3D model layers |
| **Internal Offices & Operational Units** | **47** | `building_offices` table; `js/data/offices.js` | Across 9 multi-office buildings (+ 3 embedded conference halls) |
| **Facility Categories (Filter Menu)** | **7** | `BUILDING_CATEGORIES` in `js/data/buildings.js` | Infrastructure, Trial Sites, Orchard, Office, Laboratory, Conference, Digital Agri |
| **Agricultural Plots & Zones (LARES)** | **45 plots / 23 zones** | `agricultural_plots` table; `js/data/plots.js` | 45 individual plots grouped into 23 official commodity zones |
| **Screenhouse Sub-Plots** | **9** | `plot_subplots` table; `js/data/plots.js` | Screenhouses 1–5 in Plot 17; Screenhouses 6–9 in Plot 18 |
| **Standalone Compound Gates (LARES)** | **3** | `STANDALONE_GATES` in `js/data/buildings.js` | Main Entrance Gate, Main Exit Gate, Back Gate |
| **Wayfinding Descriptions & Photos** | **53 descriptions / 63 photos** | `building_images` table; `images/*.webp` | High-efficiency `.webp` format across all campus photos |
| **Road & Walkway Features (LARES)** | **101 features (43 entrances)** | `roads.json` | 57 road segments, 1 walkway segment, 43 building entrance points |
| **Total Road & Walkway Length (LARES)** | **2.68 km (2,668 nodes)** | `roads.json`; `js/routing.js` | 2,684 m network; 43/43 entrance nodes reachable |
| **3D Campus Trees (LARES)** | **131** | `campus_trees` table; `trees.json` | 4 model variations distributed across compound |
| **Offline Drone Orthomosaics** | **3 archives (640.64 MB)** | `server.js` tile engine | LARES (210.66 MB), QARES (223.44 MB), RARES (206.54 MB) |
| **Frontend ES Modules** | **27 modules** | `js/*.js`, `js/data/*.js` | 19 logic modules + 8 data modules (zero-build architecture) |
| **Modular CSS Stylesheets** | **8 files (9,852 lines)** | `css/*.css` | Structured into domain stylesheets (variables, base, kiosk, panel, nav, phone, admin, main) |
| **HTTP API Endpoints** | **65 route handlers (63 unique)** | `server.js` (43), `database/admin_api.js` (22) | Includes static serving, offline drone MBTiles streaming, and admin CRUD |
| **Relational Database Schema** | **11 core tables (+2 legacy)** | MySQL `kiosk` database | Full relational schema for stations, buildings, offices, plots, images, and user accounts |
| **Supported Runtime Modes** | **4 modes** | `js/mode.js` | Desktop Web / Kiosk Landscape, Kiosk Portrait, Mobile Phone, and Web Admin Portal |

