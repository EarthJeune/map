# DA-LARES Interactive 3D Campus Wayfinding System — One-Page Executive Summary

> **Ready for Email or Print Handout — DA CALABARZON Tech Update**

## What It Is (One Sentence)
The **DA-LARES Interactive 3D Campus Wayfinding System (DASH)** is a touchscreen kiosk and mobile web map that guides visitors and staff across the Department of Agriculture — Lipa Agricultural Research and Experiment Station (DA-LARES) in Lipa City, Batangas, using a 3D campus map, animated walking previews, and QR-code smartphone GPS navigation.

## Elevator Pitch
DA-LARES spans dozens of research buildings, laboratories, warehouses, screenhouses, and experimental crop plots where first-time visitors and farmer stakeholders often have to ask guards or staff for directions. This system places an interactive 3D touchscreen directory at the compound lobby where anyone can search for a building, office, or agricultural plot, see what the building looks like, and watch a 3D animated walking preview of the exact route. Visitors can then scan a **QR code** *(a square barcode readable by any smartphone camera)* on the screen to transfer the route to their phone and walk to their destination with live turn-by-turn **GPS** *(Global Positioning System — satellite location tracking on a phone)* guidance.

## The Problem It Solves
- **For Visitors (Farmers, Researchers, Guests, Suppliers):** Eliminates confusion when locating specific divisions, laboratories, bidding rooms, or field trial plots across a large agricultural compound. Visitors see both the walking path and a real photo with a plain-language *"How to Spot It"* description before they start walking.
- **For the Office (DA-LARES & DA CALABARZON Staff):** Reduces repetitive direction-giving at guard houses and reception desks, standardizes official facility and office listings, and provides a modern self-service digital directory for regional summits, trainings, and daily operations.

## Who Uses It and Where
- **On-Site Visitors & Event Participants:** Use the **Standing Touchscreen Kiosk** at the Argosino Hall lobby (`[121.1664336, 13.9581208]`) and carry their **smartphones** outdoors while walking across the DA-LARES compound in Marawoy, Lipa City.
- **DA Staff & Event Organizers:** Look up office locations, conference halls, and experimental crop zones during daily operations and regional briefings.
- **Designated Administrators & IT Maintainers:** Update the `"You Are Here"` kiosk pin, building colors, road segments, and facility records on the local server PC.

## By the Numbers (Verified from Code & Data)

| Metric | Exact Count | Source in Codebase |
| :--- | :--- | :--- |
| **Research Stations in Registry** | **2** (`lares` complete 3D, `qares` partial 2D/extruded) | `STATIONS` in `js/data/stations.js` |
| **DA-LARES Numbered Directory Buildings** | **39** (numbered `1` to `39`) | `BUILDING_DIRECTORY` in `js/data/buildings.js` |
| **Total DA-LARES Building Footprints** | **50** (39 numbered + 9 screenhouse/annex sub-plots + 2 Plot 22 utility amenities) | `LARES_DRAWINGS.features` in `js/data/buildings.js` |
| **Custom 3D Building Models (`.glb`)** | **48** active 3D building entries (**53** `.glb` files in `models/`, all $< 300\text{ KB}$) | `CUSTOM_3D_BUILDINGS` in `js/data/buildings.js`, `models/` |
| **Internal Offices & Operational Units** | **47** offices across **9** buildings + **3** embedded conference halls | `BUILDING_OFFICES` in `js/data/offices.js`, `EMBEDDED_CONFERENCE_HALLS` in `js/sidebar.js` |
| **Facility Categories (Filter Dropdown)** | **7** (`infrastructure`, `trial_sites`, `orchard`, `office`, `laboratory`, `conference`, `digital_agri`) | `BUILDING_CATEGORIES` in `js/data/buildings.js`, `index.html` |
| **Agricultural Field Plots & Zones** | **45** individual plots grouped into **23** official commodity zones (with **9** named sub-plots) | `ALL_PLOT_POLYGONS`, `FIELD_COMMODITY_ZONES` in `js/data/plots.js` |
| **Compound Gates** | **3** (`Main Entrance`, `Main Exit`, `Back Gate Entrance / Exit`) | `STANDALONE_GATES` in `js/data/buildings.js` |
| **Wayfinding Descriptions & Facility Photos** | **53** facility descriptions; **62** image files in `images/` | `BUILDING_WAYFINDING_INFO` in `js/data/descriptions.js`, `images/` |
| **Road & Walkway Network Features (LARES)** | **104** features (**56** road segments, **3** walkways, **45** building entrance points) | `roads.json` |
| **Total Mapped Road & Walkway Length** | **$2,684\text{ m}$ ($2.68\text{ km}$)** subdivided into **2,678** routing graph nodes | `roads.json`, `buildRoadGraph()` in `js/routing.js` |
| **3D Campus Trees** | **131** placed 3D trees using **4** tree model types | `trees.json`, `LARES_TREES` in `js/data/geo.js` |
| **Offline Drone Map Databases (`.mbtiles`)** | **2** (`LARES v1.mbtiles` = $10.29\text{ GB}$; `QARES v1.mbtiles` = $234.30\text{ MB}$) | Project root (`server.js` SQLite tile server) |
| **Active Modular JavaScript Files** | **26** ES modules (**18** in `js/` + **8** in `js/data/`, totaling **32,686** lines) | `js/*.js`, `js/data/*.js` |
| **Core Application Files (Lines of Code)** | `index.html`: **1,234** \| `server.js`: **1,159** \| `css/main.css`: **40,538** (8,919 non-blank) | `index.html`, `server.js`, `css/main.css` |
| **Backend API Endpoints & Database Tables** | **30** unique HTTP routes (**32** registrations) \| **2** MySQL tables + **4** JSON fallbacks | `server.js` (`initDB()`) |
| **Supported Runtime Modes** | **4** (`Kiosk Landscape`, `Kiosk Portrait Totem`, `Mobile Phone`, `Admin Overlay`) | `detectAppMode()` in `js/mode.js`, `initAdminMode()` in `js/app.js` |

## Current Status Summary
- **Works Today (`IMPLEMENTED`):** Complete 3D campus map for DA-LARES with 48 custom 3D building models; offline $10.29\text{ GB}$ drone aerial view; search and category filter across 39 numbered buildings, 47 offices, and 23 agricultural plot zones (Plots 1–45); shortest-path walking directions (`js/routing.js`, `js/steps.js`); animated walker preview (`1x`/`2x`/`4x`/`6x` speed); dynamic 3D building X-ray transparency (`js/occlusion.js`); QR code handoff (`js/qr.js`); live phone GPS & compass navigation (`js/gps.js`, `js/phone-nav.js`); 45-second idle auto-reset & 5-minute thermal eco-rest (`js/idle.js`); adaptive GPU/battery performance profiles (`js/performance.js`); and 3-tier MySQL/JSON/memory data persistence (`server.js`).
- **Partial (`PARTIAL`):** Secondary station support for **DA-QARES (Tiaong, Quezon)** has a station switcher, $234.30\text{ MB}$ drone map, 48 2D/extruded footprints, and 31 road features, but awaits custom 3D `.glb` models, office listings, and plot zones. In-app **Admin & Authoring Tools** (`?admin=1`, `draw.html`, `road_draw.html`, `plot_draw.html`) work locally but require password protection before public internet deployment.
- **Planned (`PLANNED`):** Splitting `css/main.css` into 8 modular stylesheets (`docs/CSS_MODULARIZATION_PLAN.md`), binding a permanent custom domain (`*.da-lares.gov.ph`) via a named Cloudflare tunnel (`docs/DEPLOYMENT_GUIDE.md`), and completing 3D building models for DA-QARES.

---

## Verification — Files Read to Produce This Document

- `docs/00-system-overview.md`
- `index.html`, `server.js`, `package.json`, `css/main.css`
- `js/app.js`, `js/mode.js`, `js/sidebar.js`, `js/routing.js`, `js/steps.js`, `js/walker.js`, `js/occlusion.js`, `js/qr.js`, `js/gps.js`, `js/phone-nav.js`, `js/idle.js`, `js/performance.js`
- `js/data/stations.js`, `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`, `js/data/geo.js`
- `roads.json`, `trees.json`, `buildings.json`, `qares_buildings.json`, `qares_roads.json`
- `docs/DEPLOYMENT_GUIDE.md`, `docs/CSS_MODULARIZATION_PLAN.md`, `docs/SESSION_HANDOFF.md`

