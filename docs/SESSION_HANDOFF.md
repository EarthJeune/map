# Session Handoff — DA-LARES / DA-QARES Interactive Map

> **Read this first in a new chat**, together with [AGENTS.md](../AGENTS.md) (master project rules + 3D building status matrix).  
> Last updated: **2026-10-26**

---

## 1. How to resume in a new conversation

Paste this into the new chat:

```
Read AGENTS.md and docs/SESSION_HANDOFF.md in c:\Users\LGU-SanPedro\Downloads\map
before doing anything. Start immediately with Section 2 ("Active Priority Tasks for the Next Conversation").
```

Runtime:
- Start the local server: `node server.js` → `http://localhost:8080/`
- Kiosk: `start_kiosk.bat` / `start_kiosk_silent.vbs`; admin: `start_admin.bat`
- Blender MCP (3D modeling) listens on TCP `127.0.0.1:9876`

---

## 2. 🎯 Active Priority Tasks for the Next Conversation

### 2.1 Layer Visibility: Sync QARES 3D Buildings with Toggle
- **Requirement:** When turning off the "3D Buildings" switch in **Layers → Layer Visibility** (`#layer-buildings-toggle`), the buildings in QARES must also vanish completely.
- **Current Behavior:** In [js/map-setup.js](file:///c:/Users/LGU-SanPedro/Downloads/map/js/map-setup.js), `toggleBuildings()` handles layers, but QARES 3D extrusions (`qares-footprints-3d` and `qares-footprints-roofs`) and QARES DOM building markers must be fully synchronized so toggling off hides both LARES and QARES 3D models and pins simultaneously.

### 2.2 Full-Stack Performance & Lag Optimization Pass
- **Requirement:** The user reported noticeable screen lag and stuttering during interaction. Perform a comprehensive performance pass:
  - **DOM Marker Frustum Virtualization:** Only keep markers within the active camera viewport mounted/visible; set `display: none` on off-screen pins to cut layout recalculations.
  - **Event Listener Throttling:** Throttle high-frequency camera movement (`pitch`, `rotate`, `zoom`, `move`) and mouse/touch drag handlers using `requestAnimationFrame`.
  - **Three.js Resource Management:** Verify draw calls, geometry batching, and memory disposal on station transitions to lock rendering at a smooth **60 FPS**.
  - **Tile Cache & Texture Limits:** Ensure MBTiles raster tile cache is capped to prevent GPU memory saturation on kiosk hardware.

### 2.3 Explanation & Fix for the "21,537m / ~270 min walk" Route Calculation Bug
- **Bug Breakdown:** When browsing DA-QARES and selecting a facility (e.g., *Research Building*), the navigation route banner displayed:
  `📏 21537m  🚶 ~270 min walk` (~21.5 km).
- **Root Cause Analysis:** In [js/routing.js](file:///c:/Users/LGU-SanPedro/Downloads/map/js/routing.js), `calculateRoute()` defaults the origin coordinate to `KIOSK_COORDS` (`[121.16649613, 13.95809898]`), which is the **physical kiosk at DA-LARES in Lipa City**. Because QARES is located in **Tiaong, Quezon**, the router was calculating a cross-province line from Lipa to Tiaong (~21.5 km)!
- **Action Plan:**
  - Make `calculateRoute()` dynamically detect `state.currentStationId`.
  - If `lares`: start from `STATIONS.lares.kioskCoords` (`[121.16649613, 13.95809898]`).
  - If `qares`: start from `STATIONS.qares.kioskCoords` (`[121.3713315, 13.9432268]`).
  - Ensure pathfinding graph traversal switches to `qares_roads.json` when browsing QARES.

### 2.4 Implement QGIS QARES Boundaries (`QARES Boundaries.geojson`)
- **Requirement:** Mirror the authentic QGIS boundary architecture established in LARES into QARES.
- **Source File:** [QARES Boundaries.geojson](file:///c:/Users/LGU-SanPedro/Downloads/map/QARES%20Boundaries.geojson) contains two distinct polygon features:
  1. `"Front"` (6 vertices along Maharlika Highway, encompassing main entrance and front offices)
  2. `"Flint"` (12 vertices encompassing the upper agricultural research fields)
- **The Split Boundary Context:** The two parcels are physically separated by the **PNR Railway Track / corridor**, which is not owned by DA and is therefore omitted from the deeded QGIS polygon.

### 2.5 QARES Boundary Drop Shadow & Train Track Handling
- **Requirement:** Replicate the high-contrast boundary casing and ambient drop shadow used in LARES, tailored for QARES's split boundaries.
- **Design Considerations & Alternatives for the Train Track Gap:**
  - *Option A (Authentic Dual Casing - Recommended):* Render the ambient drop shadow and neon casing around both `"Front"` and `"Flint"` polygons independently. The railway corridor remains a natural neutral divider, accurately reflecting actual property boundaries.
  - *Option B (Railway Corridor Connector):* Draw a subtle dashed or hatched railway track corridor connecting the two boundary segments, visually explaining why the property is split into two halves.
  - *Option C (Compound MultiPolygon Shadow):* Combine both parcels into a single MultiPolygon in Mapbox with an outer ambient shadow wrapping the exterior perimeter.

### 2.6 Add Entrance Option for Automated Weather Station in `draw.html`
- **Requirement:** Add `automated_weather_station` (Automated Weather Station) to the entrance point assignment dropdown in [draw.html](file:///c:/Users/LGU-SanPedro/Downloads/map/draw.html).
- **Purpose:** Allows plotting the entrance coordinate node directly at the AWS perimeter swing gate (`[121.16855139, 13.96006960]`) and linking it to the pedestrian graph in [roads.json](file:///c:/Users/LGU-SanPedro/Downloads/map/roads.json), so the 3D claymation walker avatar can route visitors directly to and through the AWS gate.

---

## 3. 🎯 Completed Facility Status: Automated Weather Station (`automated_weather_station`) — ✅ COMPLETE

The authentic 3D architectural model for the Automated Weather Station has been successfully built, textured, exported, and registered:

- **Facility Name:** Automated Weather Station
- **Campus Station:** **DA-LARES** (Lipa City, Batangas)
- **ID Name:** `automated_weather_station`
- **Model Output Target:** [models/automated_weather_station.glb](file:///c:/Users/LGU-SanPedro/Downloads/map/models/automated_weather_station.glb) (**$269.96\text{ KB}$**, strictly under the $300\text{ KB}$ budget per Rule 2)
- **Registration:**
  - `CUSTOM_3D_BUILDINGS` in [js/data/buildings.js](file:///c:/Users/LGU-SanPedro/Downloads/map/js/data/buildings.js)
  - Centroid: `[121.16855139, 13.96006960]`, Rotation: **$342.4^\circ$** (entrance gate facing road), Cachebuster: `?v=4`
  - Registered in `KNOWN_BUILDING_NAMES`, `CUSTOM_BUILDING_CENTERS`, `BUILDING_CATEGORIES` (`service`), `BUILDING_TYPES` (`Meteorological Monitoring Station`)
  - Strictly standalone: zero entries in `offices.js` per Rule 6
- **Forensic Component Mapping:**
  - **Perimeter Fence ($3.28\text{ m} \times 3.28\text{ m}$):** Galvanized tubular frame, 4 corner posts + front divider post, 45° cranked outrigger barbed wire arms with 3 continuous strands, left swing gate with barrel hinges, chain & brass padlock, welded wire mesh panels, and perimeter concrete plinth curb.
  - **Base & Tripod:** Square concrete equipment pad ($1.15\text{ m} \times 1.15\text{ m} \times 0.10\text{ m}$), tripod with 2 front legs spreading wide ($215^\circ$ & $325^\circ$) keeping front entrance wide open, 1 rear leg ($90^\circ$ / $+Y$), horizontal spreader struts with wing-nut slider collar, and stamped footing pads.
  - **Middle Solar Structure (`IMG_4003`):** Genuine Davis Solar Power Kit weatherized cabinet tilted back $28^\circ$ facing directly towards front gate; rectified 4-row $\times$ 14-col monocrystalline solar cell texture with silver grid lines and busbars; embossed "DAVIS" badge; 5 water drainage notch teeth along bottom lip; dual side snap-latches on right side; bottom cable gland & black wire tail; underside galvanized steel mounting bracket bolted with 2 hex nuts to box underside, diagonal strut plate, and mast U-bolt clamp collar with through-bolt.
  - **Cable Spool:** Coiled wire donut spool on mast directly above the solar box bound with zip ties.
  - **Top Sensor Suite (Davis Vantage Pro2 ISS):** Rain collector cone, 12 vertical bird deterrent spikes around collar rim, 5-tier radiation shield louvers suspended below, upper transmitter box with textured solar face on left, mast clamp saddle, anemometer S-curved arm tube extending right, aerodynamic wind direction vane with "DAVIS" fin on top, and 3 hemispherical wind cups below.
  - **Auxiliary Transmitter (`IMG_4002`):** Short vertical pipe post at front-left of concrete pad, Davis sensor transmitter box with textured solar face and "DAVIS" logo, top U-bolt bracket, side snap-latches, and looped cable coil around base of pipe.

---

## 4. Project rules that apply to this work (summary — AGENTS.md is the source of truth)

| # | Rule |
|---|------|
| 1 | Model / register / verify **one building at a time** |
| 2 | Every `models/*.glb` must be **< 300 KB** |
| 3 | **No autonomous browser subagent** unless the user explicitly asks (headless Edge CDP scripts in `scratch/` are used for verification instead) |
| 4 | No outdoor props (lawns, roads, trees, vehicles, lamps) in building models |
| 5 | Main entrance faces the `roads.json` entrance node for that `buildingId` |
| 6 | Never invent offices; only the 7 listed buildings have entries in `js/data/offices.js` |
| 7 | **Category filter chips are QARES-only.** Never show them in the LARES directory |

---

## 5. Multi-station architecture (LARES + QARES)

| Station | Data files | Drawing tools |
|---|---|---|
| **DA-LARES** (Lipa) | `buildings.json`, `roads.json`, `trees.json`, `js/data/buildings.js` | `draw.html`, `road_draw.html`, `plot_draw.html` |
| **DA-QARES** (Tiaong, Quezon) | `qares_buildings.json`, `qares_roads.json`, `qares_boundary.json`, `qares_pin.json`, `qares_ortho.png`, `QARES v1.mbtiles` | `qares_draw.html`, `qares_road_draw.html` (also QARES mode inside `draw.html`) |

- Station registry: [js/data/stations.js](../js/data/stations.js)
- Switching / QARES layers / directory / category filter: [js/stations.js](../js/stations.js)
- Save endpoints with timestamped backups (`archive/backups/`): `/api/qares/buildings`, `/api/qares/roads` in [server.js](../server.js)
- QARES center: `[121.37178, 13.94658]`
- Kiosk Default: Map startup ALWAYS boots to **DA-LARES (Lipa)** unless `?station=qares` is explicitly in the URL.

---

## 6. Key technical notes / gotchas

- **Mapbox Standard style:** any custom layer needs `slot` (`bottom` / `middle` / `top`). 3D extrusions also need `fill-extrusion-emissive-strength` (~0.35).
- **`window.map` is shadowed** by the `<div id="map">` element. Use `state.map` from [js/data/state.js](../js/data/state.js) (or `window.state.map`).
- **Style switches remove all custom layers.** Always make layer creation idempotent and separate from source creation.
- **CDP via Python:** use `websockets` (not `websocket-client`, which isn't installed), pass `max_size=10*1024*1024` for screenshots, launch Edge with `--no-first-run --no-default-browser-check`, and choose the tab by URL.
- Color definitions live in **three places** — keep them in sync when adding colors/categories:
  1. `QARES_COLORS` + `FILTER_COLOR_SETS` in `qares_draw.html`
  2. `QARES_COLORS` + `FILTER_COLOR_SETS` in `draw.html`
  3. `QARES_COLORS_DEF` in `js/stations.js` (kiosk directory)

---

## 7. Open items / next steps

- [ ] **Task 2.1:** Fix QARES 3D buildings toggle desynchronization (`#layer-buildings-toggle`).
- [ ] **Task 2.2:** Full-stack kiosk performance & lag optimization pass.
- [ ] **Task 2.3:** Fix station origin in `js/routing.js` (resolving 21,537m route calculation bug).
- [ ] **Task 2.4:** Integrate `QARES Boundaries.geojson` (Front & Flint polygons) into `qares_boundary.json`.
- [ ] **Task 2.5:** Add boundary drop shadow for QARES and decide railway corridor representation.
- [ ] **Task 2.6:** Add Automated Weather Station to entrance node dropdown in `draw.html`.
- [ ] **MIS-RAFIS Building** is still marked 🔄 *Existing* in the AGENTS.md matrix (pending authentic rebuild).
