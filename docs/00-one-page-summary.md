# DA-CALABARZON Interactive 3D Research Station Mapping & Wayfinding System — One-Page Executive Summary

> **Ready for Email or Print Handout — DA CALABARZON Tech Update**  
> *(Note: "DASH" is the current working project title; see official system branding proposals for the final standalone brand identity.)*

## What It Is (One Sentence)
The **DA-CALABARZON Interactive 3D Research Station Mapping & Wayfinding System** (working title: **DASH**) is a publicly searchable web platform, lobby touchscreen kiosk, and mobile GPS navigation system created for **all DA-CALABARZON Research Stations**—launching first with the fully completed **DA-LARES** campus in Lipa City, Batangas (while **DA-QARES**, **DA-RARES**, and **DA-CARES** are under active development)—to guide visitors and empower station workers with interactive facility, office, and agricultural plot intelligence.

## Elevator Pitch
Agricultural research stations across CALABARZON span dozens of specialized buildings, laboratories, screenhouses, and experimental crop plots where visitors often struggle to find offices and station personnel need a unified visual map of facilities and field trials. Deployed online so **anyone can search and explore it from any browser**, as well as running on an on-site lobby touchscreen kiosk, this system lets users search for any building, internal office, or agricultural plot, view real ground-truth photos and *"How to Spot It"* guides, and watch a 3D animated walking preview of the exact route. Visitors on-site can scan a **QR code** *(a square barcode readable by any smartphone camera)* to transfer the route to their phone with live turn-by-turn **GPS** *(Global Positioning System — satellite location tracking on a phone)* guidance, while station workers and researchers can inspect agricultural plots—laying the foundation for tracking planted varieties, tree counts, and annual versus monthly/seasonal crop cycles.

## The Problem It Solves
- **For Visitors & Public Stakeholders (Farmers, Researchers, Guests, Suppliers):** Eliminates confusion both before arriving (by searching the deployed web map online) and on-site at the compound. Visitors see the exact walking path, a custom 3D model, real WebP photographs, and plain-language *"How to Spot It"* visual landmarks before they start walking.
- **For DA Station Workers, Researchers & Management:** Serves as an operational campus and **agricultural field plot reference** across the station's 45 experimental plots (23 commodity zones)—enabling staff to locate trial sites, screenhouses, and field utilities today, and expanding to track what crop/variety is planted in each plot, exact tree counts, and whether plots are dedicated to **annual/perennial orchards** or **monthly/seasonal crop trials**.
- **For the Office (DA-LARES & DA CALABARZON Staff):** Reduces repetitive direction-giving at guard houses and reception desks, standardizes official facility and office directories, and provides a unified regional platform ready to scale across all four CALABARZON research stations.

## Who Uses It and Where
- **Anyone Online (Public Web Deployment):** Farmers, stakeholders, researchers, and guests can search and explore the deployed interactive map from home, office, or mobile device before visiting.
- **On-Site Visitors & Event Participants:** Use the **Standing Touchscreen Kiosk** at the Argosino Hall lobby (`[121.1664336, 13.9581208]`) and carry their **smartphones** outdoors with live GPS navigation across the DA-LARES compound in Marawoy, Lipa City.
- **DA Station Workers, Researchers & Farm Superintendents:** Use the web map on desktops, tablets, or phones to inspect agricultural field plots (Plots 1–45), screenhouse sub-plots, laboratories, and internal offices during daily station operations and briefings.
- **Designated Administrators & IT Maintainers:** Use Admin Mode and the built-in browser authoring tools to update the `"You Are Here"` pin, building colors, road networks, facility pills, and plot records.

## By the Numbers (Verified from Code & Data)

| Metric | Exact Count | Source in Codebase |
| :--- | :--- | :--- |
| **DA-CALABARZON Research Stations Supported** | **4** (`DA-LARES` presented live; `DA-QARES`, `DA-RARES`, `DA-CARES` gated as *Under Development* in deployed mode) | `STATIONS` in `js/data/stations.js`, `js/stations.js` |
| **DA-LARES Numbered Directory Buildings** | **39** (numbered `1` to `39`) | `BUILDING_DIRECTORY` in `js/data/buildings.js` |
| **Total DA-LARES Building Footprints** | **50** (39 numbered + 9 screenhouse/annex sub-plots + 2 Plot 22 utility amenities) | `LARES_DRAWINGS.features` in `js/data/buildings.js` |
| **Custom 3D Building Models (`.glb`)** | **49** active LARES 3D model entries + **1** RARES Guard House (**54** `.glb` files in `models/`, all < 300 KB) | `CUSTOM_3D_BUILDINGS` in `js/data/buildings.js`, `rares_buildings.json`, `models/` |
| **Internal Offices & Operational Units** | **47** verified offices across **9** multi-office buildings + **3** embedded conference halls | `BUILDING_OFFICES` in `js/data/offices.js`, `EMBEDDED_CONFERENCE_HALLS` in `js/sidebar.js` |
| **Facility Categories (Filter Dropdown)** | **7** (`infrastructure`, `trial_sites`, `orchard`, `office`, `laboratory`, `conference`, `digital_agri`) | `BUILDING_CATEGORIES` in `js/data/buildings.js`, `index.html` |
| **Agricultural Field Plots & Zones (LARES)** | **45** individual plots grouped into **23** official commodity zones (with **9** named screenhouse/utility sub-plots) | `ALL_PLOT_POLYGONS`, `FIELD_COMMODITY_ZONES` in `js/data/plots.js` |
| **Compound Gates (LARES)** | **3** (`Main Entrance`, `Main Exit`, `Back Gate Entrance / Exit`) | `STANDALONE_GATES` in `js/data/buildings.js` |
| **Wayfinding Descriptions & Optimized Photos** | **53** facility descriptions; **63** optimized `.webp` photos in `images/` | `BUILDING_WAYFINDING_INFO` in `js/data/descriptions.js`, `images/*.webp` |
| **Road & Walkway Network Features (LARES)** | **104** features (**56** road segments, **3** walkways, **45** building entrance points) | `roads.json` |
| **Total Mapped Road & Walkway Length (LARES)** | **2,684 m (2.68 km)** subdivided into **2,678** routing graph nodes (**45/45 entrances 100% reachable**) | `roads.json`, `buildRoadGraph()` in `js/routing.js` |
| **3D Campus Trees (LARES)** | **131** placed 3D trees using **4** tree model types | `trees.json`, `LARES_TREES` in `js/data/geo.js` |
| **Offline Drone Map Databases (`.mbtiles`)** | **3** (`LARES v1.mbtiles` = 210.66 MB; `QARES v1.mbtiles` = 223.44 MB; `RARES v1.mbtiles` = 206.54 MB — 640.64 MB total) | Project root (`server.js` SQLite tile server) |
| **Active Modular JavaScript & CSS Files** | **27** ES modules (**19** in `js/` + **8** in `js/data/`) \| **8** modular CSS files (`css/*.css`, **9,852** lines) | `js/*.js`, `js/data/*.js`, `css/*.css` |
| **Core Application Files (Lines of Code)** | `index.html`: **1,246** \| `server.js`: **1,310** \| **8** Authoring Tools (`draw.html`, `road_draw.html`, `plot_draw.html`, `pill_adjust.html`, etc.) | `index.html`, `server.js`, root `*.html` |
| **Backend API Endpoints & Database Tables** | **36** HTTP routes in Express \| **2** MySQL tables + **4** local JSON fallbacks | `server.js` (`initDB()`) |
| **Supported Runtime Modes** | **4** (`Kiosk Landscape` / Public Desktop Web, `Kiosk Portrait Totem`, `Mobile Phone`, `Admin Overlay`) | `detectAppMode()` in `js/mode.js`, `initAdminMode()` in `js/app.js` |

## Current Status Summary
- **Complete & Presented Live Today (`DA-LARES Flagship`):** Full 3D interactive map for **DA-LARES** publicly searchable on the web and running on the lobby kiosk; 49 custom 3D building models on station-isolated WebGL layers; offline 210.66 MB high-resolution drone aerial view (Zoom 14–21); instant search and 7-category filtering across 39 numbered buildings, 47 offices, and 23 agricultural plot zones (Plots 1–45); 100%-verified shortest-path pedestrian routing (`js/routing.js`, `js/steps.js`); animated walker preview (`1x`/`2x`/`4x`/`6x` speed); dynamic 3D building X-ray transparency (`js/occlusion.js`); QR code handoff (`js/qr.js`); live phone GPS & compass navigation (`js/gps.js`, `js/phone-nav.js`); 45-second idle auto-reset & 5-minute thermal eco-rest (`js/idle.js`); adaptive GPU/battery performance profiles (`js/performance.js`); 8-file modular CSS architecture (`css/*.css`); 100% WebP image optimization (`images/*.webp`); and 3-tier MySQL/JSON/memory data persistence (`server.js`).
- **Regional Multi-Station Rollout (`Under Development` Mode Active):** The station selector includes **DA-QARES (Tiaong, Quezon)**, **DA-RARES (Tanay, Rizal)**, and **DA-CARES (Naic, Cavite)**. In public deployed mode (`isDeployedMode()` in `js/stations.js`), selecting QARES, RARES, or CARES automatically presents an official **"Station Under Development"** modal (`showStationDevModal()`) while their drone orthomosaics, footprints, roads, and 3D models are being completed on the local authoring workstation.
- **Next Expansion Roadmap (`Agronomic Plot Intelligence & Regional Scaling`):** Expanding the **Agricultural Plots** module for station workers and researchers to display live/updated crop records per plot (current planted crop/variety, exact tree counts, planting dates, and classification of **annual/perennial plots** vs. **monthly/seasonal trial plots**), binding an official permanent government domain, and completing full 3D models and directories for DA-QARES, DA-RARES, and DA-CARES.

---

## Verification — Files Read to Produce This Document

- `docs/00-system-overview.md`
- `index.html`, `server.js`, `package.json`, `css/main.css` (`css/*.css`)
- `js/app.js`, `js/mode.js`, `js/stations.js`, `js/sidebar.js`, `js/routing.js`, `js/steps.js`, `js/walker.js`, `js/occlusion.js`, `js/qr.js`, `js/gps.js`, `js/phone-nav.js`, `js/idle.js`, `js/performance.js`
- `js/data/stations.js`, `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`, `js/data/geo.js`
- `roads.json`, `trees.json`, `buildings.json`, `qares_buildings.json`, `qares_roads.json`, `rares_buildings.json`, `rares_roads.json`, `rares_plots.json`
- `docs/DEPLOYMENT_GUIDE.md`, `docs/CSS_MODULARIZATION_PLAN.md`, `docs/SESSION_HANDOFF.md`
