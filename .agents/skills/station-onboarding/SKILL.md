---
name: station-onboarding
description: >-
  Standardized blueprint and runbook for onboarding, surveying, and integrating new
  DA-CALABARZON research stations (DA-QARES, DA-RARES, DA-CARES) into DASH. Guides the
  entire lifecycle: boundary surveying, inverted world masks, offline drone MBTiles
  integration, footprint drawing tools, station-aware pathfinding routing graph, intro
  fly-in camera sequences, and dual-shell (desktop kiosk & mobile) UI synchronization.
---

# Station Onboarding Blueprint — DA-CALABARZON Spatial Hub (DASH)

This skill provides the mandatory step-by-step procedure for onboarding any regional agricultural research and experiment station into the **Department of Agriculture Spatial Hub (DASH)** interactive wayfinding system.

Every new station (such as **DA-RARES** in Tanay, Rizal or **DA-CARES** in Naic, Cavite) must follow this 8-stage protocol to prevent regression bugs (camera clamping, cross-province routing lines, desynchronized masks, UI thread freezing).

---

## 🗺️ Stage 1: Station Registry & Geodetic Anchors

### File: `js/data/stations.js`
Register the station object under `STATIONS.<stationId>` with all required metadata:

```javascript
export const STATIONS = {
    // ...
    rares: {
        id: 'rares',
        name: 'DA-RARES',
        label: 'DA-RARES (Tanay)',
        sub: 'Rizal Agricultural Research & Experiment Station',
        fullName: 'Rizal Agricultural Research and Experiment Station',
        province: 'Tanay, Rizal',
        status: 'under_development', // change to 'active' when launched
        icon: '🌿',
        center: [/* lng */, /* lat */],
        zoom: 18.2,
        pitch: 52,
        bearing: 30, // Station-specific signature viewing angle
        introStartZoom: 16.8,
        introTarget2DZoom: 19.5,
        bounds: [
            [/* sw_lng */, /* sw_lat */],
            [/* ne_lng */, /* ne_lat */]
        ],
        kioskCoords: [/* lng */, /* lat */], // Physical totem location
        buildingsFile: '<station>_buildings.json',
        roadsFile: '<station>_roads.json',
        boundaryFile: '<station>_boundary.json',
        hasDrone: true
    }
};
```

> [!IMPORTANT]
> **Signature Viewing Angle (`pitch` & `bearing`):** Every campus has an authentic architectural axis (e.g. facing north-northeast toward the main gate). Calibrate `pitch` ($45^\circ\text{–}55^\circ$) and `bearing` to showcase the station's primary facade.

---

## 💾 Stage 2: Backend Persistence & Offline Drone Tile Server

### File: `server.js`
Ensure the backend server has registered endpoints for the station's data files and SQLite MBTiles database:

1. **Station Data API Routes:**
   - `GET /api/<stationId>/pin` and `POST /api/<stationId>/pin`
   - `GET /api/<stationId>/roads` and `POST /api/<stationId>/roads` (with automatic timestamped backups)
   - `GET /api/<stationId>/buildings` and `POST /api/<stationId>/buildings`
   - `GET /api/<stationId>/boundary` and `POST /api/<stationId>/boundary`
2. **Offline MBTiles Registration:**
   - Register tile database in `STATION_MBTILES`:
     ```javascript
     const <stationId>Candidates = [
         process.env.<STATION_ID>_MBTILES_PATH,
         path.join(__dirname, '<STATION_NAME> v1.mbtiles'),
         path.join(os.homedir(), 'Downloads', '<STATION_NAME> v1.mbtiles')
     ].filter(Boolean);
     initStationMbtiles('<stationId>', <stationId>Candidates, '<STATION_FULL_NAME>');
     ```
   - Register streaming tile endpoints:
     - `GET /api/tiles/<stationId>/:z/:x/:y.png`
     - `GET /api/tiles/<stationId>/:z/:x/:y`

---

## 📐 Stage 3: Deeded Boundary Surveying & Inverted World Mask

### Files: `<stationId>_boundary.json` & `js/data/geo.js`
1. **Deeded Property Parcels:**
   - Obtain official deeded survey boundaries or QGIS boundary layers.
   - Save clean MultiPolygon / Polygon GeoJSON features in `<stationId>_boundary.json`.
2. **Inverted World Mask (`<STATION>_MASK`):**
   - The map displays a non-destructive dark vignette outside the campus boundary to eliminate visual distraction from surrounding neighborhoods.
   - Construct a hollow Polygon where:
     - Ring 0 is the massive outer world boundary (`[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]`).
     - Rings 1..N are the interior station boundary holes (reversed winding order).
   - Export `<STATION>_MASK` in `js/data/geo.js`.
3. **Layer Isolation:**
   - In `js/stations.js`, ensure the mask layer is strictly isolated (`setLayoutProperty('<station>-mask-layer', 'visibility', isActive ? 'visible' : 'none')`) so adjacent stations never overlap.

---

## 🛠️ Stage 4: Authoring & Surveying Tools Setup

### Files: `<stationId>_draw.html`, `<stationId>_road_draw.html`, `<stationId>_boundary_draw.html`
Deploy standalone browser-based authoring tools calibrated to the new station coordinates:
1. **Building Footprint Drawer (`<stationId>_draw.html`):**
   - Pre-centered on `STATIONS.<stationId>.center`.
   - Wired to `GET /api/<stationId>/buildings` and `POST /api/<stationId>/buildings`.
2. **Road Network Drawer (`<stationId>_road_draw.html`):**
   - Pre-centered on `STATIONS.<stationId>.center`.
   - Wired to `GET /api/<stationId>/roads` and `POST /api/<stationId>/roads`.
   - Configured with entrance node selector.
3. **Boundary Drawer (`<stationId>_boundary_draw.html`):**
   - Wired to `GET /api/<stationId>/boundary` and `POST /api/<stationId>/boundary`.

---

## 🚶 Stage 5: Station-Aware Road Graph & Walkway Routing

### Files: `<stationId>_roads.json` & `js/routing.js`
1. **Station-Isolated Kiosk Origin:**
   - `calculateRoute()` MUST detect `state.currentStationId` and set origin to `STATIONS[currentStationId].kioskCoords`.
   - Never fallback to hardcoded `KIOSK_COORDS` of another station (prevents the 21.5 km cross-province routing bug).
2. **Spatial Hash Grid Traversal:**
   - Use the 5-meter Spatial Hash Grid in `buildRoadGraph()` to prevent $O(N^2)$ thread freezes during road network parsing.
   - Cache `state.<stationId>RoadGraph` so subsequent route queries execute in $< 5\text{ms}$.

---

## 🎬 Stage 6: Cinematic Signature Intro Fly-in Sequence

### Files: `js/map-setup.js` & `js/stations.js`
Every station switch must execute the signature two-phase camera fly-in:
1. **Bounds Relax Failsafe:**
   - Before camera flight, call `map.setMaxBounds(null)` to prevent Mapbox bounds clamping.
2. **Phase 1: High-Altitude Birds-Eye Zoom:**
   - Start at high altitude (`zoom: introStartZoom`, `pitch: 0`, top-down).
   - Glide smoothly into the station's "You Are Here" totem pin (`zoom: introTarget2DZoom`).
3. **Phase 2: 3D Perspective Tilt-up:**
   - Tilt camera upward into the station's signature `pitch` ($50^\circ\text{–}55^\circ$) and `bearing`.
4. **Transition Curtain Synchronization:**
   - Curtain displays during teleport and initial map hydration.
   - Guaranteed dismissal within $260\text{ms} + 120\text{ms}$ with hard 600ms safety timeout.

---

## 🏢 Stage 7: Facility Directory & Category Filtering Sync

### Files: `js/data/buildings.js`, `index.html`, `js/sidebar.js`, `js/phone-ui.js`
1. **Ground-Truth Building Footprints & Metadata:**
   - Official building numbers and facility names.
   - Strictly NO invented offices or hypothetical units (Rule 6).
2. **Category Filtering Alignment:**
   - Map facilities to the official categories (`infrastructure`, `trial_sites`, `orchard`, `office`, `laboratory`, `conference`, `digital_agri`).
3. **Dual-Shell Synchronized UI:**
   - Desktop sidebar station switcher flyout (`#station-dropdown-flyout`).
   - Mobile action sheet modal (`.phone-station-modal-sheet`).
   - Update cachebusters across all modified files.

---

## 🧪 Stage 8: Quality Gates & Automated Cross-Platform Matrix Testing

### Script: `scratch/verify_<stationId>_matrix.py`
Before concluding onboarding, execute an automated CDP test matrix across 4 targets:
1. **Landscape Full HD ($1920 \times 1080$):** Desktop Kiosk shell, sidebar, drawer, and 3D canvas.
2. **Landscape Laptop ($1280 \times 800$):** Compact web layout, search, and category filter.
3. **Portrait Touch Kiosk Totem ($1080 \times 1920$):** 40vh bottom touch panel, 28px border radius, touch targets $\ge 44\text{px}$.
4. **Mobile Web Smartphone ($390 \times 844$):** 3-snap bottom sheet (`peek`, `half`, `full`), top station pill, right rail stack.
5. **Console & Network Audit:** 0 uncaught JS exceptions, HTTP 200 on all assets, 0 missing tiles.

