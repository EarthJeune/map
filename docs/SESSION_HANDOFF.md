# Session Handoff — DA-LARES / DA-QARES Interactive Map

> **Read this first in a new chat**, together with [AGENTS.md](../AGENTS.md) (master project rules + 3D building status matrix).  
> Roadmap: [docs/CSS_MODULARIZATION_PLAN.md](CSS_MODULARIZATION_PLAN.md) (post-LARES stylesheet modularization roadmap).  
> Last updated: **2026-11-03**

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

### 📌 Accomplishment Report Split Note (DA-RARES 3D Models)
- **November 1–15 (Phase 1 — 24 of 49):** Admin Building, APCO Rizal Building, Automated Weather Station (AWS), Botanical Concoction Storage, Breeder House, Brooder House, Chemical Storage, Common CR, Farm House, Flatbed Dryer, Greenhouse Hydroponics, Guard House, Hatchery Area, Hydroponics Storage, Low-Cost Greenhouse, Low-Cost Hydroponics, Machinery Shed, Machinery & Equipment Storage, Mini Conference Hall, Multipurpose R&D Building, Mushroom Laboratory, Nursery A, Nursery B, and Office Supply.
- **November 16–30 (Phase 2 — Remaining 25 of 49):** Palay Shed, Poultry House, Pre-Composting Area, Rest Area, Seed Storage, SGPP Complex (AWS, Bays 0–5, Combined Greenhouse, Entrance, Storage), SPIS Solar Irrigation (Array East, Array Mid, Tank), Staff Houses A–D, Vermicomposting (Old & New), and Wood Vinegar.

---

### 2.0.51 Welcome Flow: "Explore Campus" Button & Non-Blocking Station Card Selection — 🏆 Complete
- **User Directive:** *"The button should be Explore campus, then i can select per station. The second picture should only pop up when i click explore campus, not when i select a research station."*
- **Implementation & Interaction Behavior:**
  1. **Non-Blocking Card Selection:**
     - In [index.html](file:///c:/Users/LGU-SanPedro/Downloads/map/index.html#L1234), changed card click handlers to `selectWelcomeStation('<station_id>')`.
     - Tapping any research station card (DA-LARES, DA-QARES, DA-RARES, DA-CARES) now exclusively updates visual selection (highlighting the selected card with `.active` green border/glow and removing `.active` from the others) and sets `selectedWelcomeStationId`.
     - Clicking a card **never** prematurely closes the welcome dialog and **never** triggers the "Campus Under Development" modal (Picture 2).
  2. **Dedicated "Explore Campus" Action Button:**
     - The prominent bottom action button is strictly labeled **`Explore Campus →`** (`#dash-proceed-btn`).
  3. **Conditional Development Warning on "Explore Campus" Click:**
     - When the user clicks **`Explore Campus →`** (`handleWelcomeProceed()`):
       - If the selected station is under development (`qares`, `rares`, `cares` without dev override), the welcome dialog dismisses and the "Campus Under Development" modal (Picture 2: `#station-dev-modal`) pops up, allowing the user to either "Continue on DA-LARES Map" or "Explore Station (Dev)".
       - If the selected station is active (`lares` or dev bypass), the map enters and starts the campus exploration / intro sequence seamlessly.
  4. **Automated Headless CDP Verification:**
     - Verified with `tools/tests/test_welcome_flow_per_station.py`: selecting QARES keeps the welcome modal open with `devModalVisible: false`, and only clicking "Explore Campus" triggers `showStationDevModal('qares')`. Screenshots saved: `welcome_step2_qares_selected.jpg` and `welcome_step3_dev_modal_popped_up.jpg`.

### 2.0.50 DA-RARES Aerial Drone Orthomosaic Style Switch Persistence Fix — 🏆 Complete
- **User Directive:** *"In DA-RARES when i switch to mapbox and then return to aerial drone view, It is only the gmaps view while the aerial drone shot is missing."*
- **Root Cause Identified:**
  1. In `js/map-setup.js` lines 455–466, `setupLayers()` cleans up unused Mapbox base style layers by stripping all layers that do not start with `customPrefixes`:
     `const customPrefixes = ['sec-', 'lares-', 'qares-', 'route-', 'google-', 'drone-', '3d-', 'gps-', 'phone-', 'plots-'];`
     Notice `'rares-'` and `'cares-'` were missing from `customPrefixes`!
     Consequently, every time `setupLayers()` ran during style transition back to `satellite-streets-v12`, it treated `rares-ortho-layer`, `rares-mask-layer`, and all `rares-boundary-*` layers as non-custom Mapbox layers and systematically called `map.removeLayer(layer.id)`, wiping them completely from the map.
  2. In `js/map-setup.js` `selectMapStyle(mode)`, `map.once('style.load')` was registered after calling `map.setStyle(...)`.
- **Solution & Verifications:**
  1. Updated `customPrefixes` in `js/map-setup.js` to include `'rares-'` and `'cares-'`:
     `const customPrefixes = ['sec-', 'lares-', 'qares-', 'rares-', 'cares-', 'route-', 'google-', 'drone-', '3d-', 'gps-', 'phone-', 'plots-'];`
  2. In `selectMapStyle()`, attached `map.once('style.load', ...)` before calling `map.setStyle(...)` to avoid event listener race conditions.
  3. Bumped app cachebuster in `index.html` to `?v=281`.
  4. Executed automated multi-cycle style switch tests (`tools/tests/test_rares_style_switch.py`) via headless CDP:
     - Drone $\rightarrow$ Mapbox 3D $\rightarrow$ Returned Drone $\rightarrow$ Mapbox 3D $\rightarrow$ Returned Drone.
     - Verified live states: `hasOrtho: true`, `orthoVis: "visible"`, `hasMask: true`, `maskVis: "visible"` across all cycles.
     - Verified rendered screenshots: `rares_switch_1_initial_drone.jpg` and `rares_switch_3_returned_drone.jpg` show the high-resolution offline drone imagery rendered seamlessly.

### 2.0.49 DA-RARES Flatbed Dryer (Building 5) Authentic Architectural 3D Modeling & Integration — 🏆 Complete
- **Strategic Context & Ground-Truth Photography:** Converted and analyzed 3 field photographs from `Building Images RARES/Flatbed Dryer/`:
  - `Front.jpg`: Front elevation looking West into open canopy; rectangular grain drying bed in South bay (cream metal walls, perforated floor, cleanout hatch); brick combustion furnace, horizontal heat-exchange drum, and vertical stainless exhaust chimney with rain cowl in North bay abutting Chemical Storage.
  - `Close Front.jpg`: Precision details of furnace hopper, drum support cradles, blower transition duct entering drying bin plenum, and round tubular steel columns with concrete plinths.
  - `Left Side is the Flatbed Dryer, Right side is the Chemical Storage.jpg`: Elevation view from East access road showing Chemical Storage on right (North), Flatbed Dryer on left (South), and Seed Storage directly behind (West).
- **Architectural 3D Modeling Specifications:**
  - Structure dimensions: $7.30\text{ m} \text{ (span along local X)} \times 8.80\text{ m} \text{ (depth along local Y)}$ strictly conforming to survey polygon in `rares_buildings.json`.
  - Open steel canopy with 6 tubular steel pipe columns ($\varnothing 0.13\text{ m}$) on concrete footing plinths, longitudinal eave beams ($H_{eave} = 3.25\text{ m}$), and open-web triangular steel trusses ($H_{apex} = 4.45\text{ m}$).
  - Corrugated green metal roof with central ridge cap and rusted steel fascia rakes.
  - Enclosed West rear wall attached to Seed Storage in two-tone stucco finish (mint green `#75A36A` upper stucco, dark forest green wainscot skirt `#183C25`, $H = 1.05\text{ m}$) with 2 high rectangular dark ventilation openings and triangular gable apex closure.
  - North partition wall abutting Chemical Storage in weathered pale green concrete.
  - South bay: Large rectangular grain drying bed ($3.10\text{ m} \times 5.60\text{ m} \times 0.90\text{ m}$) in cream metal panels with perimeter rim rail, perforated steel floor, and front cleanout hatch.
  - North bay: Brick combustion base ($1.25\text{ m} \times 1.25\text{ m} \times 0.85\text{ m}$) with fuel feed door, horizontal cylindrical heat-exchange drum ($\varnothing 1.00\text{ m} \times 2.40\text{ m}$) on concrete saddles, blue blower housing, and transition plenum duct.
  - Vertical stainless steel exhaust chimney pipe ($\varnothing 0.38\text{ m}$) rising from brick furnace through North roof slope to $Z = 6.20\text{ m}$ with conical rain cowl and brackets.
  - Official 3D facility signboard on front truss with DA gold emblem and text "FLATBED DRYER".
  - Strictly compliant with Rule 4 ("Strictly No Extraneous Outdoor Props"): zero ladders, loose scrap, rocks, or cats.
  - Model file: `models/rares_flatbed_dryer.glb` ($148.8\text{ KB}$, strictly $< 300\text{ KB}$ budget).
  - Aligned directly with `rares_roads.json` entrance node `rares_entrance_5` with calibrated Mapbox rotation $283.5^\circ$.
  - Drawer photo converted to WebP `images/rares_building_5.webp` ($247.7\text{ KB}$, $1440 \times 1080$, quality 80).
- **Active Next Directives in Sequence:**
  1. **Nursery A (`rares_building_6`):** Proceed immediately with authentic 3D modeling from `Building Images RARES/Nursery A/`.

### 2.0.48 Two-Step Welcome Flow: Welcome Intro Menu → 4 Research Stations Selector — 🏆 Complete
- **User Directive:** *"Welcome menu click proceed then it proceeds to Menu of choosing 4 research stations."*
- **Implementation:**
  - **Step 1 (`#dash-welcome-step-intro`):** Displays the official DASH intro & guide cards (*What is DASH?*, *What does our map do?*, *Touch Kiosk & Mobile QR Navigation*), branding, and a single prominent **`Proceed →`** button.
  - **Step 2 (`#dash-welcome-step-stations`):** Clicking `Proceed` smoothly transitions to the 4 Research Stations Selector Menu featuring the interactive cards for DA-LARES (Active Flagship), DA-QARES (Under Dev), DA-RARES (Under Dev), and DA-CARES (Under Dev), plus an `Explore Flagship Campus (DA-LARES) →` primary action and a `← Back to Welcome Guide` return button.
  - Synchronized across desktop, portrait kiosk, and mobile browsers in `index.html`, `js/phone-ui.js`, and `css/main.css`.
  - Automated CDP validation completed and verified in `scratch/test_welcome_flow.py`.

### 2.0.47 Slide Deck Expansion: Dual Basemap Modes (Drone Aerial View vs. Mapbox 3D Standard) — 🏆 Complete
- **Root Cause of Omission:** The initial 14-slide outline focused primarily on database architecture, routing, and directory search, omitting one of the system's most visually compelling features: the live **Dual Basemap Engine** (`Aerial Drone View` vs. `Mapbox 3D Standard Mode`).
- **Full Slide Expansion to 15 Slides:**
  - Added dedicated **Slide 4: Dual Basemap Modes & Visual Perspectives — Photorealistic Drone Aerial View vs. Mapbox 3D Standard Mode** in `docs/05-slide-outline.md`.
  - Details **Aerial Drone View Mode** (photorealistic sub-centimeter offline orthomosaic from local SQLite MBTiles for agricultural plot and canopy inspection) vs. **Mapbox 3D Standard Mode** (high-contrast 3D vector cartography for outdoor kiosk legibility under glare).
  - Explains the one-click instant switch via top-right floating toolbar and Map Settings, preserving camera angle, pitch, bearing, active routes, and 3D buildings seamlessly.
  - Documents secondary visual modes: Camera Perspectives (Top 2D vs. Side 3D), Lighting Presets (Dawn/Day/Dusk/Night), and Label Modes (Full Pill vs. Compact Number).
  - Renumbered subsequent slides (now 15 total slides) and updated `docs/04-demo-script.md` live demo cue.
- **Automated Screenshot Generation (`SS-02B`):** Captured high-resolution side-by-side composite comparison `SS-02B_basemap_modes_comparison.jpg` ($1920 \times 1080 \times 2$) in `tools/tests/test_basemap_modes.py`, saved directly to artifacts directory and added to Screenshot Checklist.
- **Active Next Directives in Sequence:**
  1. **Flatbed Dryer (`rares_building_5`):** Proceed immediately with authentic 3D architectural modeling from `Building Images RARES/Chemical Storage/Left part is the Flatbed while the right part is the Chemical Storage Left part.HEIC`.

### 2.0.46 4-Station Interactive Welcome Screen Selector Over 3D Aerial View — 🏆 Complete
- **Strategic UX Transformation:** Replaced static introductory text cards with an interactive, responsive **4-Station Selector** directly overlaid over the live 3D aerial canvas view (`#dash-welcome-modal`):
  1. **DA-LARES (Lipa City, Batangas):** Active Flagship (glowing `#2bdc39` active border and pulsing green dot, `50 3D Buildings`, `45 Field Plots`, `Live Wayfinding`, "Enter Campus →").
  2. **DA-QARES (Tiaong, Quezon):** Quezon Agricultural Research & Experiment Station • Under Development (sky blue sprout icon, `Boundary Surveyed`, `3D Footprints`, `Drone MBTiles`, "Preview Station →").
  3. **DA-RARES (Tanay, Rizal):** Rizal Agricultural Research & Experiment Station • Under Development (purple trees icon, `Drone Orthomosaic`, `3D Facilities`, `Road Network`, "Preview Station →").
  4. **DA-CARES (Naic, Cavite):** Cavite Agricultural Research & Experiment Station • Under Development (amber leaf icon, `Geospatial Masterplan`, `Regional Center`, `In Progress`, "Preview Station →").
- **Live Interaction & Flow:**
  - Clicking any station card immediately switches/teleports the map to that station or displays the official "Station Under Development" notice on public portals.
  - Selecting `DA-LARES` (or tapping "Explore Flagship Campus (DA-LARES)") smoothly dismisses the modal and initiates the signature cinematic intro fly-in.
  - Dynamically updates active station indicator via `updateWelcomeModalActiveStation()`.
  - Backdrop opacity lightened to `rgba(2, 6, 23, 0.68)` with `backdrop-filter: blur(10px)` so the 3D aerial campus view shines through.
- **Responsive Layout:**
  - Desktop & Kiosk landscape: 2x2 grid ($860\text{px}$ card width).
  - Portrait Totem Kiosk ($1080 \times 1920$): 2x2 grid with large tactile tap targets ($80\text{px}+$ height).
  - Mobile phones ($412 \times 915$): Single-column stack with compact headers, fitting all 4 station cards and proceed button without vertical scrolling.
- **Cache-Busters:** Bumped `css/main.css?v=196` and `js/app.js?v=271` in `index.html`.
- **Slide Alignment:** Updated `docs/05-slide-outline.md` Slide 1 bullets, speaker notes, and verified Screenshot `SS-01`.
- **Active Next Directives in Sequence:**
  1. **Flatbed Dryer (`rares_building_5`):** Proceed immediately with authentic 3D architectural modeling from `Building Images RARES/Chemical Storage/Left part is the Flatbed while the right part is the Chemical Storage Left part.HEIC`.

### 2.0.45 Portrait Kiosk Monitor View UI Fixes (Corner Radius, Panel Sizing, Controls Separation, Folded Menu) — 🏆 Complete
- **Diagnosed and Resolved 4 Physical Monitor Display Issues:**
  1. *Menu Container Corner Radius:* Increased `.sidebar` border radius to `36px`; applied matching `36px` top radii to `.sidebar-header` (with `overflow: hidden`) and `36px` bottom radii to `.directory` and `.route-info`. Prevents square child clipping on large monitors.
  2. *Selected Building/Plot Details Panel Too Small:* Scaled `.building-panel` from cramped `620px` to `min(880px, calc(100vw - 48px))` width and `min(65vh, 1200px)` height. Scaled typography (title $22\text{px}$), photo height to $220\text{px}$, directions button to $60\text{px}$ ($18\text{px}$ bold font), and QR card to $96\text{px} \times 96\text{px}$.
  3. *Camera and Speed Floating Controls Separation:* Moved Speed controls to `bottom: 36px` and Camera controls to `bottom: 108px`, creating a clean, comfortable **$18\text{px}$ vertical gap** (eliminating the previous $0\text{px}$ border touch).
  4. *Folded Menu Visibility & Reopening:* Changed collapsed directory transform from `translateY(calc(100% + 24px))` to `translateY(calc(100% - 16px))`, keeping the top $16\text{px}$ of the rounded container resting above the screen bottom ($40\text{px}$ above bottom) with an inviting $96\text{px} \times 42\text{px}$ tactile green glowing tab `[ ▲ ]` with `pointer-events: auto !important;`. Verified 100% visible and clicks cleanly to reopen.
- **Cache-Buster:** Bumped `css/main.css?v=195` in `index.html`.
- **Automated Verification:** Verified via headless Edge at $1080 \times 1920$ resolution in `tools/tests/verify_monitor_ui_fixes.py` with 5 saved artifact screenshots.
- **Next Directives in Sequence:**
  1. **Chemical Storage (`rares_building_4`):** Proceed immediately with authentic 3D modeling from `Building Images RARES/Chemical Storage/`.
  2. **Flatbed Dryer (`rares_building_5`):** Proceed immediately following Chemical Storage.

### 2.0.44 DA-RARES Seed Storage (Building 3) Authentic Architectural 3D Modeling & Integration — 🏆 Complete
- **Ground-Truth Photography:** 6 converted field photographs from `Building Images RARES/Seed Storage/`:
  - `Front Far.HEIC`, `Front Near.HEIC` (Front North entrance facade, cantilevered concrete canopy, roll-up shutter, pedestrian door, exhaust hoods, ventilation louvers, DA billboard, visitor folding chairs)
  - `Left angle of the Front.HEIC` (Front-left perspective, wall AC unit, clerestory ribbon windows, high parapet wall)
  - `Left is the Chemical Storage, The Right is the Seed Storage.HEIC` (Alleyway between Chemical Storage and Seed Storage)
  - `Right part of the building.HEIC` (East flank facing Flatbed Dryer, pilasters, ribbon windows, parapet)
  - `the left part of the picture is the back...HEIC` (Rear South facade with 2 exhaust hoods, ventilation louvers, and side parapets)
- **Architectural 3D Modeling Specifications:**
  - Warehouse footprint: $16.86\text{ m} \times 20.64\text{ m}$ strictly adhering to polygon in `rares_buildings.json`.
  - Heavy cantilevered concrete entrance canopy ($5.80\text{ m} \times 2.85\text{ m}$, $Z = 3.80\text{ m}$) sheltering commercial metal roll-up door ($W = 3.40\text{ m}$, $H = 3.65\text{ m}$) with overhead mechanism box, adjacent pedestrian service door ($W = 0.95\text{ m}$, $H = 2.15\text{ m}$), and raised entrance apron ($Z = 0.25\text{ m}$).
  - Low-slope gable corrugated metal roof (`#465E4C`, $Z_{APEX} = 6.80\text{ m}$, $Z_{EAVE} = 5.20\text{ m}$) with dark ridge cap.
  - Elevated flank parapets ($Z = 6.20\text{ m}$) along East and West walls with clerestory ribbon window banks.
  - 4 dark angular exhaust hoods ($Z = 4.90\text{ m}$) with two on front North wall and two on rear South wall.
  - Horizontal ventilation louver blocks across front and rear.
  - East wall facing Chemical Storage features an exterior wall-mounted AC condenser on rusty red steel brackets.
  - Front West wall features the official white DA Project Billboard ("REHABILITATION OF ONE(1) UNIT RARES WAREHOUSE IN SUPPORT TO THE IMPLEMENTATION OF RICE PROGRAM FY 2023") with two black visitor folding chairs.
  - Two-tone paint finish: Weathered pale mint green stucco upper walls (`#8CAE88`) and dark forest green base wainscot skirt (`#183C25`, $H = 1.05\text{ m}$).
  - 100% watertight geometry, strictly zero extraneous outdoor props outside building footprint (Rule 4).
- **Performance Budget:** Exported `models/rares_seed_storage.glb` at **$83.07\text{ KB}$** (budget `< 300 KB` — 🏆 Super lightweight!).
- **Map Alignment & UI:** Registered in `js/data/buildings.js` at `[121.34043528, 14.57587020]`, rotation $193.8^\circ$, oriented directly toward `rares_roads.json` entrance node `rares_entrance_4` (`[121.34045884, 14.57596519]`); drawer photo converted to `images/rares_building_3.webp` ($86.6\text{ KB}$, $1440\text{px}$, quality 80); detail drawer verified live with badge 3, subtitle "Certified Seed Storage & Warehouse", and mobile QR navigation.
- **Active Next Tasks in Sequence:**
  1. **Flatbed Dryer (`rares_building_5`):** Model, register, and verify immediately next per user directive.

### 2.0.45 DA-RARES Chemical Storage (Building 4) Authentic Architectural 3D Modeling — 🏆 Complete
- **Ground-Truth Modeling:** Conforming strictly to field photographs in `Building Images RARES/Chemical Storage/` and 4-vertex survey polygon in `rares_buildings.json` ($9.68\text{ m} \times 11.29\text{ m}$).
- **Architectural Features:**
  - Two-tone stucco finish with soft mint green upper walls (`#75A36A`) and dark forest green foundation wainscot skirt (`#183C25`, $H = 1.05\text{ m}$).
  - Symmetrical corrugated green metal gable roof with white fascia rakes and cream soffit ($H_{eave} = 3.30\text{ m}, H_{apex} = 4.80\text{ m}$).
  - Main entrance opening ($2.50\text{ m} \times 2.50\text{ m}$) with dark bronze frame, painted metal roll-up shutter with horizontal ribs, and overhead mechanism hood box.
  - Official facility signboard ($2.80\text{ m} \times 0.65\text{ m}$) with dark green border, 3D extruded lettering `"CHEMICAL STORAGE"`, and centered gold/green DA Leaf Sprout emblem medallion.
  - 2 front windows flanking main entrance with dark frames, glass, and crisp white security grilles (`#F5F7FA`).
  - 2 East flank windows, 2 West flank windows, and 2 rear windows with security grilles.
  - Concrete entrance apron & stoop ($3.40\text{ m} \times 1.30\text{ m}$).
  - 100% watertight roof geometry, strictly zero extraneous outdoor props outside building footprint (Rule 4).
- **Performance Budget:** Exported `models/rares_chemical_storage.glb` at **$114.84\text{ KB}$** (strictly under the $300\text{ KB}$ budget).
- **Map Alignment & UI:** Registered in `js/data/buildings.js` at `[121.34056209, 14.57586902]`, rotation $193.5^\circ$, aligned directly with `rares_roads.json` entrance node `rares_entrance_3` (`[121.34057249, 14.57591978]`); drawer photo verified live with `images/rares_building_4.webp` ($204.5\text{ KB}$); detail drawer verified with badge 4 and subtitle "Agricultural Chemical & Fertilizer Storage".

### 2.0.43 DA-RARES Admin Building (Building 2) Authentic Architectural 3D Modeling & Backside Bump-Out Layout — 🏆 Complete
- **Ground-Truth Layout Conformance:** Strictly conforms to user drone orthomosaic drawing `media_1794447530767_09225256.jpg` and field photographs in `Building Images RARES/Admin Building/`.
- **Photo Name & Zone Mapping (Standing at back facing West):**
  1. *Right Side Back (`Right Side Back.jpg`, `Back Right Side from Left Side.jpg`):* North-East recessed wall ($X \in [-10.14, -3.10]$ at $Y = +5.37\text{ m}$, length $7.04\text{ m}$) with 2 large windows, high square $2\times 2$ ventilation block, and standard symmetrical gable roof eave ($Z = 3.30\text{ m}$).
  2. *Middle Side Back (`Middle Side Back.jpg`):* Middle bump-out ($X \in [-3.10, +2.80]$, length $5.90\text{ m}$) projecting outward by $0.78\text{ m}$ ($Y = +6.15\text{ m}$), 1 large window, raised concrete septic tank platform on ground, vertical plumbing pipe with spigot, and extended lower roof slope ($Z = 2.85\text{ m}$) with vertical cheek fascia closures.
  3. *Back Left Side (`Back Left Side.jpg`):* South-East covered service porch on baseline wall plane ($X \in [+2.80, +10.14]$ at $Y = +5.37\text{ m}$, length $7.34\text{ m}$) with continuous concrete porch platform ($Z = 0.24\text{ m}$) and smooth uninterrupted roof eave overhead (zero roof notches or alcove pockets); features Window 1 ($X = +8.60\text{ m}$), weathered wooden utility work table with blue storage crates, open service doorway ($X = +6.60\text{ m}$) with swung open door panel, blue industrial water drum ($X = +5.60\text{ m}$), and Window 2 ($X = +4.10\text{ m}$) on the same flat wall plane.
- **Symmetrical North & South Gable Ends:** Both gable ends are 100% symmetrical, with apex centered at $Y = 0.0\text{ m}, Z = 4.85\text{ m}$.
- **Performance Budget:** Exported `models/rares_admin_building.glb` at **$232.48\text{ KB}$** (strictly under the $300\text{ KB}$ budget).
- **Map Alignment:** `[121.34062777, 14.57621614]`, rotation $103.5^\circ$, registered with versioned modelId `rares_admin_building_v5` and cache-busted with `?v=5` in `js/data/buildings.js`, perfectly aligned with `rares_roads.json` entrance node `rares_entrance_2` and access walkway `rares_road_13`.

### 2.0.42 Option C Architecture: Dedicated Station-Isolated 3D Building Sources & Layers — 🏆 Complete
- **Issue Investigated:** Switching from DA-LARES to another station (e.g. DA-RARES) and back to DA-LARES caused all 3D buildings in DA-LARES to vanish due to a shared mutable source (`lares-3d-buildings-models-source`) being overwritten via `.setData()`.
- **Architectural Refactor to Option C Implemented:**
  - Fully eliminated runtime GeoJSON swapping and source mutations across all research stations.
  - Implemented dedicated, station-isolated 3D model sources and layers in [js/map-setup.js](js/map-setup.js):
    - **DA-LARES:** `lares-3d-models-source`, `lares-3d-models-layer`, and `lares-3d-models-transparent` (49 models).
    - **DA-RARES:** `rares-3d-models-source`, `rares-3d-models-layer`, and `rares-3d-models-transparent` (`rares_building_1` Guard House).
    - **DA-QARES:** `qares-3d-models-source`, `qares-3d-models-layer`, and `qares-3d-models-transparent`.
  - **Zero `.setData()` Mutation:** Each station's source is populated once with its own isolated static coordinates and models. Station switching is now a 100% pure layout visibility toggle (`visible` / `none`).
  - **Walker Occlusion & Map Settings Integration:**
    - Updated [js/occlusion.js](js/occlusion.js) and [js/map-settings.js](js/map-settings.js) to support station-scoped model layers and transparent companions.
    - Updated [js/drone-calibration.js](js/drone-calibration.js) to reference `lares-3d-models-source`.
  - Bumped cachebuster in [index.html](index.html) to `?v=263`.
- **Automated Verification:**
  - Executed comprehensive automated matrix tests in [`tools/tests/verify_option_c.py`](tools/tests/verify_option_c.py):
    - Verified LARES initial load: `lares-3d-models-source` has 49 models; `lares-3d-models-layer` is `visible`.
    - Switched to RARES: `rares-3d-models-layer` is `visible`; `lares-3d-models-layer` is `none`.
    - Confirmed `lares-3d-models-source` **remained completely intact with 49 features** while camera was in RARES (zero mutation).
    - Switched back to LARES: `lares-3d-models-layer` restored instantly with 0 latency and 0 vanishing.
    - Multi-hop roundtrip (`LARES -> QARES -> RARES -> LARES`) executed with 100% building retention.
    - Verified live screenshots: `option_c_rares_guard_house.jpg` and `option_c_lares_buildings.jpg`.

### 2.0.41 DA-RARES Guard House 3D Integration, Layer Stacking Architecture & 39 Facilities Calibration — 🏆 Complete
- **Issue Investigated:**
  - The authentic 3D architectural model of the DA-RARES Guard House (`models/rares_guard_house.glb`) was not rendering on the map (`?station=rares`).
  - When Building Labels was toggled OFF in Map Display Settings while in Compact Number mode, labels were not hidden.
  - Facilities at DA-RARES required complete re-numbering and renaming to match the official 1..39 master list.
- **Root Causes Discovered & Fixed:**
  1. **Mapbox GL JS 3.x Layer Array Stacking Order:**
     - Non-standard styles (`satellite-streets-v12` / Google Satellite mode) ignore `slot: 'middle'` and composite strictly by layer array order.
     - `loadRARESData()` dynamically appended `rares-ortho-layer` and `rares-mask-layer` to the end of the style layers array, placing the drone orthomosaic raster directly *above* `3d-buildings-models-layer` and occluding the 3D models.
     - **Fix:** Updated `loadRARESData()` in [js/stations.js](js/stations.js) to pass `bldgsModelBeforeId` to `rares-ortho-layer`, `rares-mask-layer`, `rares-footprints-3d`, `rares-plots-fill`, and `rares-plots-line`. Also added `map.moveLayer('3d-buildings-models-layer')` at the conclusion of layer loading so 3D architectural models are guaranteed to sit strictly above all ground rasters, masks, and polygons.
  2. **Startup Layer Suppression Bug ([js/map-setup.js](js/map-setup.js)):**
     - Line 413 checked `if (state.currentStationId && state.currentStationId !== 'lares')` and hid `laresLayers`, which mistakenly included `'3d-buildings-models-layer'`.
     - **Fix:** Removed `'3d-buildings-models-layer'` and `'3d-buildings-translucent-layer'` from `laresLayers` so 3D models remain active across all research stations.
  3. **Compact Number Label Toggle Bug ([js/markers.js](js/markers.js)):**
     - When toggling Building Labels OFF while in Compact Number mode, elements retained inline display rules or lost the hide class.
     - **Fix:** Added `document.body.classList.toggle('labels-hidden', !areMarkersVisible)` and forced `el.style.setProperty('display', 'none', 'important')`. Verified with automated CDP test (`tools/tests/test_compact_label_toggle.py`).
  4. **Pill Marker Placement for Small Structures:**
     - `rares_building_1` had no explicit `marker_coords` in `rares_buildings.json`, falling back to centroid which placed the wide pill directly across the entrance facade.
     - **Fix:** Placed `marker_coords: [121.34054276, 14.576475]` slightly north along the roof ridge/rear.
  5. **Official 39 Facilities Master List & Standalone Calibrator Tool:**
     - Renamed and renumbered all 39 facilities in [rares_buildings.json](rares_buildings.json) to match the official sequence (1. Guard House, 2. Admin Building, 3. Seed Storage, ..., 39. SPIS).
     - Built [pill_adjust.html](pill_adjust.html) interactive drag-and-drop pill calibrator tool (`/pill_adjust.html?station=rares`) enabling seamless visual adjustments without moving building polygon footprints.
- **Verification:**
  - Automated CDP verification test (`tools/tests/verify_rares_guard_house.py`) confirmed layer array indices (`rares-ortho-layer: 16`, `3d-buildings-models-layer: 22`).
  - Captured live screenshots (`rares_guard_house_live_verified.jpg` and `rares_guard_house_live_topdown.jpg`) confirming the 3D terracotta gable Guard House is rendered cleanly in full 3D right at the entrance gate with authentic textures and materials.

### 2.0.40 Multi-Station Standalone Directory Menus & RARES Buildings Integration — 🏆 Complete
- **Issue Investigated:** When viewing DA-RARES, the sidebar directory erroneously showed the LARES buildings directory (`LARES BUILDINGS (39) Lipa City, Batangas` with Guard House A, ORED Building, etc.).
- **Root Cause Identified:**
  - `renderRARESDirectory` in `js/stations.js` targeted non-existent element IDs `dir-list` and `directory-list` instead of `directory` and `phone-directory-list`.
  - `sidebar.js`'s `buildDirectory()` returned early when station was not `lares`, leaving the previously populated `#directory` DOM element untouched.
  - Toggling Admin Mode (`Alt + Shift + A`) also called `buildDirectory()` unconditionally.
- **Definitive Fixes Implemented:**
  - **Standalone Directory Architecture ([js/stations.js](js/stations.js)):**
    - Updated `renderRARESDirectory` to target `#directory` (desktop) and `#phone-directory-list` (mobile).
    - Added dynamic loading from [rares_buildings.json](rares_buildings.json) so traced buildings (currently 33 facilities) render with badges, names, and click-to-fly navigation.
    - Added `filterRARESSearch` for real-time station-isolated search bar filtering.
    - Mounted 3D extrusion footprints (`rares-footprints-3d`) over the drone layer.
  - **Directory Router ([js/sidebar.js](js/sidebar.js)):**
    - `buildDirectory()` now automatically delegates to `renderRARESDirectory()` when `currentStationId === 'rares'` and `renderQARESDirectory()` when `currentStationId === 'qares'`.
    - `filterDirectory()` routes searches directly to the active station's dedicated search function.
  - **Admin Mode Router ([js/app.js](js/app.js)):**
    - `Alt + Shift + A` now refreshes the active station's directory specifically.
    - Added `/api/rares/pin` GET/POST endpoints and `rares_pin.json` persistence.
- **Verification:**
  - Verified across all 3 research stations with `scratch/verify_station_directories.py`.
  - Confirmed 0 leakages: DA-RARES shows `RARES BUILDINGS (33) Tanay, Rizal`, DA-LARES shows `LARES BUILDINGS (39) Lipa City, Batangas`, and DA-QARES shows `QARES BUILDINGS (48) Tiaong, Quezon`.

### 2.0.39 DA-RARES Drone Orthomosaic, Inverted Boundary Mask & Building Drawer Integration — 🏆 Complete
- **Offline Drone Orthomosaic Layer (`RARES v1.mbtiles`):**
  - Generated and placed `RARES v1.mbtiles` (17.5 MB, zooms 14–21) in the map root.
  - Integrated into [server.js](server.js) with MBTiles SQLite streaming at `/api/tiles/rares/:z/:x/:y.png` (bounds: `[121.3366, 14.5727, 121.3421, 14.5773]`).
- **Dissolved Single Boundary & Inverted Dark Mask:**
  - Dissolved 3 parcel polygons from `rares_boundary/` into a single unified outline in [rares_boundary.json](rares_boundary.json).
  - Created `RARES_MASK` inverted world polygon in [js/data/geo.js](js/data/geo.js) with deep dark void fill (`#0b1121`, opacity 1.0) and green neon glowing perimeter boundary lines (`rares-boundary-line`, `casing`, `glow`, `fill`).
  - Wired into [js/stations.js](js/stations.js) and [js/app.js](js/app.js) with smooth station switching.
- **Agricultural Plots Explicitly Suppressed:**
  - Maintained `rares_plots.json` in codebase while strictly leaving plots unrendered on the map per user directive (*"Dont apply the agricultural plots for now and i will be drawing the buildings after you plotted the aerial drone view and outline."*).
- **Interactive Tracing Setup in [draw.html](draw.html):**
  - Added dedicated `DA-RARES (Tanay)` switcher button and URL router (`draw.html?station=rares`).
  - Mounted `rares-drone-layer` and `rares-boundary-line`.
  - Added `/api/rares/buildings` GET & POST endpoints in `server.js` with automated timestamped backups in `archive/backups/`.
  - Initialized [rares_buildings.json](rares_buildings.json) as the single source of truth for traced building footprints.
- **Automated Verification:** Verified via headless CDP in `scratch/verify_rares_integration.py` with zero errors, generating verified artifacts `rares_draw_view.png` and `rares_campus_view.png`.

### 2.0.38 QARES High-Zoom Aerial Drone Hole Resolution — 🏆 Resolved
- **Issue Investigated:** In DA-QARES, zooming in close ($\text{zoom} \ge 20.5$) formed a dark, jagged polygonal "hole" covering central facilities (Magdalo Building #7, Tissue Culture #6, Fertilizer Storage #14, and Guest House #8) through which the darker Google Satellite basemap showed.
- **Root Cause Identified:**
  - `QARES v1.mbtiles` contains pyramid levels 14 to 21 (`maxzoom = 21`). At zoom 22, 0 tiles exist.
  - `js/stations.js` incorrectly declared `maxzoom: 22` on `qares-drone-source`. Mapbox requested zoom 22 tiles at high zoom.
  - `server.js` previously returned a 70-byte transparent 1x1 PNG with HTTP 200 OK for missing tiles, which Mapbox rendered over the zoom 21 drone orthomosaic, punching a transparent hole.
- **Definitive Fixes Implemented:**
  - **Client Overzoom Fix ([js/stations.js](js/stations.js)):** Changed `maxzoom: 22` to `maxzoom: 21` on `qares-drone-source`. Mapbox now automatically overzooms (upsamples) the zoom 21 drone tiles seamlessly at zooms 21.5, 22.0, and 23.0 without requesting zoom 22 tiles.
  - **Backend Defensive Guard ([server.js](server.js)):** Enhanced MBTiles loader to read database `minzoom` and `maxzoom` metadata. Added guard in `handleStationTileRequest` returning `HTTP 204 No Content` for any requests exceeding `st.maxzoom`, preventing transparent tile blanking.
  - **Cachebuster Bump ([index.html](index.html)):** Bumped `js/app.js` to `?v=253`.
- **Verification Across Viewports:**
  - Verified via headless CDP matrix tests at zooms 20.0, 20.5, 21.0, 21.5, and 22.0 on Desktop (`1920x1080`) and Mobile (`390x844`).
  - Dark pixel ratio at zoom 20.5 dropped from $25.80\%$ to $1.83\%$; at zoom 21.5 to $0.09\%$; at zoom 22.0 to $0.00\%$. The drone layer is now completely seamless, continuous, and crisp at all zoom levels.

### 2.0.37 CSS Modularization — Phase 8: Comprehensive Cross-Platform Matrix Testing & Verification — 🏆 Passed
- **Executed Cross-Platform Matrix Test Suite (`scratch/verify_phase8_matrix.py`):** Verified all viewports and display orientations with 0 regressions, 0 linter warnings, and 100% visual parity:
  - **Landscape Desktop Full HD (`1920x1080`):** `phase8_landscape_1920x1080.png` — Map loaded, sidebar flex, building details drawer opens at exact 420px width.
  - **Landscape Desktop Laptop (`1280x800`):** `phase8_landscape_1280x800.png` — Map loaded, sidebar flex, search row and directory list active.
  - **Portrait Touch Kiosk Totem (`1080x1920`):** `phase8_portrait_1080x1920.png` — Map loaded, bottom touch panel styled with 28px border radius, building details drawer opens at 620px width.
  - **Mobile Phone Web (`390x844`):** `phase8_mobile_390x844.png` — Desktop sidebar suppressed, mobile 3-stage bottom sheet docked, top bar visible, all 65 directory facilities verified interactive.
- **Network & Resource Audit:** Confirmed all 8 modular stylesheets (`variables.css`, `base.css`, `kiosk.css`, `building-panel.css`, `navigation.css`, `phone.css`, `admin.css`, and `main.css`) return `HTTP 200 OK` with zero 404s.
- **Console & Runtime Exception Audit:** Confirmed 0 uncaught exceptions or error logs across all tested viewports.
- **CSS Modularization Roadmap Complete:** All 8 phases successfully executed. The modular stylesheet architecture is now fully decoupled, performant, and ready for multi-station scaling (QARES, RARES, CARES).

### 2.0.36 CSS Modularization — Phase 7: Admin & Dev Calibration Overlays Layer (css/admin.css) — ✅ Complete
- **Extracted Admin Architecture to `css/admin.css`:** Extracted 762 lines of admin tools, developer calibration HUDs, and diagnostic overlays into [css/admin.css](css/admin.css), covering:
  - Normal visitor visibility isolation rules (`html:not(.admin-mode) body:not(.admin-mode) .admin-drone-calib-widget, .admin-drone-calib-btn, .drone-calib-hud, .dcal-toast, .msp-admin-only { display: none !important; }`)
  - Admin interactive kiosk marker drag handles (`.kiosk-marker.admin-mode`, `:active`, label pointer events)
  - Admin three-dots context menu trigger (`body.admin-mode .three-dots-btn`)
  - Admin section in Map Display Settings panel (`.msp-admin-only`, `.msp-admin-action-btn`, `.msp-admin-action-arrow`)
  - Diagnostic GPS HUD overlay (`.gps-debug-hud`, `.debug-title`, `.debug-row`)
  - Drone Orthomosaic Alignment HUD window & widgets (`.admin-drone-calib-widget`, `.drone-calib-hud`, `.dcal-*`)
  - Directional D-Pad controls, opacity comparison sliders, calibration readout cards, and action buttons
- **Master Entry Integration:** Added `@import 'admin.css';` at line 7 of [css/main.css](css/main.css) and cleanly pruned 738 lines from `main.css` (reducing it from 5,899 lines down to 5,161 lines).
- **HTML & Parallel Preload:** Added `<link rel="stylesheet" href="css/admin.css?v=193">` and bumped cachebusters to `?v=193` in [index.html](index.html).
- **Automated Cross-Viewport Verification:** Passed automated testing across all 4 modes:
  - **Landscape Desktop (Normal):** `phase7_landscape_desktop_normal.png` — all admin widgets hidden for visitors (`display: none`).
  - **Landscape Desktop (Admin):** `phase7_landscape_desktop_admin.png` — `.admin-drone-calib-widget` `display: flex`, drone calibration HUD window active & interactive.
  - **Portrait Kiosk:** `phase7_portrait_kiosk.png` — admin widgets hidden, kiosk UI 100% stable.
  - **Mobile Phone:** `phase7_mobile_phone.png` — mobile UI 100% stable.

### 2.0.35 CSS Modularization — Phase 6: Mobile Touch UI & Bottom Sheet Layer (css/phone.css) — ✅ Complete
- **Extracted Mobile Touch Layer to `css/phone.css`:** Extracted 2,450 lines of mobile UI architecture into [css/phone.css](css/phone.css), covering:
  - Desktop / Kiosk resets (`.phone-bottom-sheet, .mobile-recenter-btn, .phone-top-bar { display: none !important; }`)
  - Phone 3-snap bottom sheet (`.phone-bottom-sheet`, `.snap-peek`, `.snap-half`, `.snap-full`, `.is-dragging`)
  - Touch drag handle (`.phone-sheet-drag-handle`, `.phone-sheet-handle-pill`)
  - Mobile station banner and switcher modal (`.phone-station-modal-sheet`, `.phone-station-card`, `.psc-*`)
  - Mobile search row & category chips (`.phone-search-row`, `.phone-search-input`)
  - Mobile directory list (`.phone-directory-list`, `.phone-dir-item`, tags & badges)
  - Mobile building details peek panel & scrollable view (`.phone-bldg-header`, `.phone-bldg-scrollable`)
  - Mobile route navigation sheet (`.phone-route-peek-panel`, `.phone-route-step`)
  - Mobile arrived modal & celebratory confetti (`.phone-arrived-modal-card`, `.pam-*`)
  - Mobile GPS permission prompt (`.phone-gps-permission-card`, `.pgpc-*`)
  - Mobile onboarding guide (`.phone-welcome-modal-card`, `.pwm-*`)
  - Mobile right-rail control stack (Map settings, Map layer/drone switcher, 38px circular orbit & fullscreen buttons)
- **Master Entry Integration:** Added `@import 'phone.css';` at line 6 of [css/main.css](css/main.css) and cleanly pruned 2,435 lines from `main.css` (reducing it from 8,334 lines down to 5,899 lines).
- **HTML & Parallel Preload:** Added `<link rel="stylesheet" href="css/phone.css?v=192">` and bumped cachebusters to `?v=192` in [index.html](index.html).
- **Automated Cross-Viewport Verification:** Passed automated testing across all 3 viewports:
  - **Landscape Desktop (`1280x800`):** `phase6_landscape_desktop.png` — phone sheet hidden, top bar hidden, desktop sidebar flex.
  - **Portrait Kiosk (`1080x1920`):** `phase6_portrait_kiosk.png` — phone sheet hidden, top bar hidden, kiosk portrait sidebar flex.
  - **Mobile Phone (`390x844`):** `phase6_mobile_phone.png` — phone sheet flex & docked, phone top bar flex, desktop sidebar hidden, 65 directory facilities verified and interactive.

### 2.0.34 CSS Modularization — Phase 5: Navigation & Live Turn-by-Turn HUD Layer (css/navigation.css) — ✅ Complete
- **Extracted Navigation & HUD to `css/navigation.css`:** Extracted 530 lines of navigation and live tracking architecture into [css/navigation.css](css/navigation.css), covering:
  - `.turn-by-turn-banner`, `.turn-by-turn-banner.active`, `.turn-by-turn-banner.arrived`, `.is-long-dest`
  - `.tbt-icon-wrapper`, `.tbt-content`, `.tbt-distance`, `.tbt-instruction`
  - Floating speed control pills (`.floating-speed-controls`, `.speed-btn`, `.speed-btn.active`)
  - GPS user location puck & animated wave rings (`.user-location-puck`, `.gps-pulse`)
  - Campus destination spotlight beacon (`.destination-spotlight`, `spotlightRipple` keyframes)
  - Sub-plot chip active state styling in drawer
- **Master Entry Integration:** Added `@import 'navigation.css';` at line 5 of [css/main.css](css/main.css) and cleanly pruned 521 lines from `main.css` (down to 8,334 lines).
- **HTML & Parallel Preload:** Added `<link rel="stylesheet" href="css/navigation.css?v=191">` and bumped cachebusters to `?v=191` in [index.html](index.html).
- **Automated Cross-Viewport Verification:** Passed automated testing across all 3 viewports:
  - **Landscape Desktop (`1280x800`):** `phase5_landscape_desktop.png` — `.turn-by-turn-banner` `display: flex`, `top: 24px`, `border-radius: 20px`, `z-index: 120`.
  - **Portrait Kiosk (`1080x1920`):** `phase5_portrait_kiosk.png` — `.turn-by-turn-banner` `display: flex`, `top: 20px`, `border-radius: 18px`, `z-index: 120`.
  - **Mobile Phone (`390x844`):** `phase5_mobile_phone.png` — `.turn-by-turn-banner` `display: none` (managed cleanly via mobile sheet), 0 regressions.

### 2.0.33 CSS Modularization — Phase 4: Building Details Drawer & Gallery (css/building-panel.css) — ✅ Complete
- **Extracted Details Drawer to `css/building-panel.css`:** Extracted 601 lines of building panel architecture into [css/building-panel.css](css/building-panel.css), covering:
  - Slide-out right panel (`.building-panel`, `width: 420px`), active transition
  - Hero image area, cross-fade vignette (`.bp-image-overlay-vignette`), expand hint, multi-view thumbnails bar (`.bp-image-views-bar`, `.bp-view-chip`)
  - Facility metadata rows, wayfinding cards (`.bp-wf-card`, `HOW TO SPOT IT`, `WHAT'S INSIDE & SERVICES`)
  - Action buttons (`.bp-directions-btn`, `.bp-gps-nav-btn`), QR mobile handoff card (`.bp-qr-card`, `.bp-qr-box`)
  - Fullscreen photo lightbox modal (`.photo-lightbox-modal`, `.lightbox-close-btn`, `.lightbox-content`)
- **Master Entry Integration:** Added `@import 'building-panel.css';` at line 4 of [css/main.css](css/main.css) and cleanly pruned 600 lines from `main.css` (down to 8,855 lines).
- **HTML & Parallel Preload:** Added `<link rel="stylesheet" href="css/building-panel.css?v=190">` and bumped cachebusters to `?v=190` in [index.html](index.html).
- **Automated Cross-Viewport Verification:** Passed on Landscape Desktop (`1280x800`), Portrait Kiosk (`1080x1920`), and Mobile Phone (`390x844`) with 0 errors, 0 linter warnings, and exact visual parity.

### 2.0.32 CSS Modularization — Phase 3: Kiosk Desktop Shell & Directory Layer (css/kiosk.css) — ✅ Complete
- **Extracted Kiosk Shell to `css/kiosk.css`:** Extracted 1,519 lines of desktop kiosk sidebar architecture into [css/kiosk.css](css/kiosk.css), covering:
  - `.sidebar`, `.sidebar.visible`, `.sidebar.collapsed`, `.sidebar-toggle-btn`
  - `.station-dropdown-*` flyout menu, transition curtain (`.station-transition-curtain`, `.stc-*`)
  - `.search-container`, flex `.search-row`, `.search-box`, `.search-clear-btn`
  - `.filter-dropdown-*` popover menu and category filter chips (`.kiosk-categories-bar`, `.cat-chip`)
  - `.directory` scroll area, section titles, `.dir-item` cards, plot/conference tags
  - Sidebar route navigation container (`.route-info`, `.route-steps-container`, `.route-step-item`, speed bar, replay/close buttons)
- **Master Entry Integration:** Added `@import 'kiosk.css';` at line 3 of [css/main.css](css/main.css) and cleanly pruned 1,518 lines from `main.css` (down to 9,455 lines).
- **HTML & Parallel Preload:** Added `<link rel="stylesheet" href="css/kiosk.css?v=189">` and bumped cachebusters to `?v=189` in [index.html](index.html).
- **Automated Cross-Viewport Verification:** Passed on Landscape Desktop (`1280x800`), Portrait Kiosk (`1080x1920`), and Mobile Phone (`390x844`) with 0 errors, 0 linter warnings, and exact visual parity.

### 2.0.31 CSS Modularization — Phase 2: Universal Base & Reset Layer (css/base.css) — ✅ Complete
- **Extracted Base & Reset to `css/base.css`:** Extracted universal box-sizing reset (`*, *::before, *::after`), viewport locks (`html, body { overflow: hidden; width: 100%; height: 100%; touch-action: manipulation; }`), typography font-smoothing, modern glassmorphic thin scrollbars, and `.no-scrollbar, .hide-scrollbar` utilities into [css/base.css](css/base.css).
- **Master Entry Integration:** Added `@import 'base.css';` at line 2 of [css/main.css](css/main.css).
- **HTML & Parallel Preload:** Added `<link rel="stylesheet" href="css/base.css?v=188">` and bumped cachebusters to `?v=188` in [index.html](index.html).
- **Cross-Viewport Automated CDP Verification:** Verified on Landscape Desktop (`1280x800`), Portrait Kiosk (`1080x1920`), and Mobile Phone (`390x844`) with 0 errors, 0 linter warnings, and exact visual parity.

### 2.0.30 CSS Modularization — Phase 1: Design Tokens Extraction (css/variables.css) — ✅ Complete
- **Extracted Design Tokens to `css/variables.css`:** Extracted all root custom properties (`:root { ... }`) including core theme colors (`--primary-green: #22c55e`, glassmorphism tints), surface tokens, layout widths (`--sidebar-width: 400px`, `--panel-width: 420px`), safe-area insets (`--safe-top`, `--safe-bottom`), z-index layering tokens (`--z-map` through `--z-curtain`), and claymation/spotlight defaults.
- **Clean Master Entry Integration:** Replaced the legacy inline `:root` declaration in [css/main.css](css/main.css) with `@import 'variables.css';` at line 1.
- **HTML & Cachebusters Updated:** Added `<link rel="stylesheet" href="css/variables.css?v=187">` and bumped [css/main.css](css/main.css) to `?v=187` in [index.html](index.html).
- **Automated Cross-Viewport Verification:** Passed automated testing on all 3 targets:
  - **Landscape Desktop (`1280x800`):** `phase1_landscape_desktop.png` — `--sidebar-width: 400px`, `--primary-green: #22c55e`, 0 errors.
  - **Portrait Kiosk (`1080x1920`):** `phase1_portrait_kiosk.png` — `--portrait-panel-height: 40vh`, 0 errors.
  - **Mobile Phone (`390x844`):** `phase1_mobile_phone.png` — `--sidebar-offset: 0px`, 0 errors.

### 2.0.29 Four Official Stations Alignment (DA-CARES Cavite Integration) — ✅ Complete
- **Aligned 4th Regional Station:** Replaced obsolete placeholder `lardc` (Siniloan, Laguna) with the official 4th Research Station of DA-CALABARZON: **DA-CARES** (**Cavite Agricultural Research and Experiment Station** located in **Naic, Cavite**; NIA Compound, Brgy. Ibayo Silangan, Naic, Cavite; `[120.7925, 14.2965]`).
- **Official 4 Stations of DA-CALABARZON (Region IV-A):**
  1. **DA-LARES:** Lipa Agricultural Research and Experiment Station (Brgy. Marawoy, Lipa City, Batangas) — Active Main Hub.
  2. **DA-QARES:** Quezon Agricultural Research and Experiment Station (Tiaong, Quezon) — Under Development.
  3. **DA-RARES:** Rizal Agricultural Research and Experiment Station (Brgy. Cuyambay, Tanay, Rizal) — Under Development.
  4. **DA-CARES:** Cavite Agricultural Research and Experiment Station (Naic, Cavite) — Under Development.
- **Synchronized Station Registries & UI:**
  - `STATIONS.cares` registered in [js/data/stations.js](js/data/stations.js).
  - Desktop station dropdown flyout updated with `DA-CARES` / `Naic, Cavite (Experiment Station)` in [index.html](index.html).
  - Mobile station modal updated with `DA-CARES` / `Naic, Cavite` / `Cavite Agricultural Research & Experiment Station` in [index.html](index.html).
  - Added `'🍃': 'leaf'` mapping to [js/data/icons.js](js/data/icons.js).
- **Cachebusters Bumped:** `css/main.css?v=186` and `js/app.js?v=252` in [index.html](index.html).

### 2.0.28 Search Bar UI Refinements (Phone Info Button Removal & Desktop Ellipsis Parity) — ✅ Complete
- **Removed Repetitive `i` Button in Phone UI:** Removed `<button class="phone-info-guide-btn">` from the mobile search bar in [index.html](index.html), eliminating duplicate trigger since the top DASH header logo already opens the Welcome Guide.
- **Desktop Search Bar Flex Layout & Ellipsis Parity:**
  - Modernized `.search-box` in [css/main.css](css/main.css) to a clean flexbox container (`display: flex; align-items: center; gap: 10px; padding: 0 14px; border-radius: 14px`), removing hardcoded asymmetrical padding and dead square gaps.
  - Aligned placeholder text with Phone UI: `Search places, plots & offices...` with `text-overflow: ellipsis; white-space: nowrap; overflow: hidden;` preventing clipped letter glyphs like "plac".
- **Cachebusters Bumped:** `css/main.css?v=185` and `js/app.js?v=251` in [index.html](index.html).

### 2.0.27 CSS Problems Linter Warnings Resolved — ✅ Complete
- **Resolved 4 `css(propertyIgnoredDueToDisplay)` Warnings:** Removed redundant `vertical-align: unset !important;` from 4 icon selector rules in [css/main.css](css/main.css) (`.station-item-icon svg`, `.mlo-icon svg`, `.mlm-option-icon svg`, `.psc-icon svg`). Because these elements already have `display: block !important;` and are contained within flexbox-centered wrappers (`display: flex; align-items: center; justify-content: center;`), `vertical-align` was ignored by the CSS engine and triggered linter warnings.
- **Cachebuster Bumped:** `css/main.css?v=184` in [index.html](index.html).

### 2.0.26 Mobile Numbered Pills: Desktop Color Scheme Parity — ✅ Complete
- **Translucent Tinted Wash & Vivid Text:** Mobile directory badges (`.phone-dir-badge`) and building detail header badges (`#phone-bldg-badge`) updated from flat opaque circles with white text to the desktop glassmorphic aesthetic:
  - `background: ${bColor}22` (~13.3% translucent background tint).
  - `color: ${bColor}` (vibrant text and SVG icon stroke matching the building's color).
  - `border: 1px solid ${bColor}44` (subtle matching translucent outline).
- **Modern Squircle Geometry:** Replaced plain circular `border-radius: 50%` with `border-radius: 10px` ($36\text{px} \times 36\text{px}$) for directory badges and `border-radius: 11px` ($38\text{px} \times 38\text{px}$) for building details header badges.
- **QARES Directory & Plots:** Applied the same translucent color scheme across QARES mobile directory in `js/stations.js` and plot zones in `js/phone-ui.js`.
- **Cachebusters Bumped:** `css/main.css?v=183` and `js/app.js?v=250` in `index.html`.

### 2.0.25 Regional Research Stations "Under Development" Protection (Deployment-Gated) — ✅ Complete
- **Strictly Deployment-Gated (`isDeployedMode()`):**
  - **Local Development / Localhost (Current Workspace):** Station switching is 100% unrestricted with zero blocking modals. Developers can freely switch to, inspect, and build `qares` without interruption.
  - **Production / Deployed Environments (`isDeployedMode() === true` or `?deployed=1`):** Other research stations (`qares`, `rares`, `cares`) are protected with the dedicated `#station-dev-modal` ("Campus Under Development") preventing public visitors from accessing unfinished campuses and safely returning them to DA-LARES.
  - **Dev Override:** Developer/Admin preview button (`Explore Station (Dev)`) is available whenever the modal is viewed in development mode.

### 2.0.24 Mobile Right Control Rail Redesign (Parallel 4-Button Stack) — ✅ Complete
- **Suppressed Mapbox Navigation Buttons on Mobile:** Hidden Zoom In (+), Zoom Out (-), and Compass (▲) on mobile viewports and phone mode (.mapboxgl-ctrl-group:has(.mapboxgl-ctrl-zoom-in)).
- **Parallel Right-Side Column Layout:** Clean vertical stack aligned along 
ight: 14px with uniform 38px circular buttons:
  1. Settings (Gear)
  2. Map Layer (Aerial Drone / Mapbox)
  3. Orbit (3D rotate)
  4. Fullscreen (Expand)
- **Synchronous Navigation Gliding:** When turn-by-turn navigation starts, the 4-button column slides from 	op: 14px to 	op: 88px below the HUD banner, maintaining complete visibility and zero overlap.

### 2.0.23 Plot 22 Comfort Room Geometric Highlight Realignment & Zero-Pill Amenities Synchronization — ✅ Complete
- **Root Cause of Diamond/Rhombus Highlight Bug:**
  - The previous GeoJSON polygon for `plot22_comfort_room` inadvertently cross-paired longitude and latitude coordinates across diagonals (`[X0, Y2]`, `[X1, Y3]`, `[X2, Y0]`, `[X3, Y1]`).
  - Instead of placing vertices at the 4 rectangular corner extremities (NE, NW, SW, SE), the vertices lay along the cardinal axes (N, S, E, W), creating a diamond rotated by $45^\circ$ that sliced diagonally across the building.
- **Architectural Solution & Mathematical Realignment:**
  - Derived the exact rectangular footprint matching the 3D model walls ($2.80	ext{ m} 	imes 2.80	ext{ m}$) and foundation plinth, rotated by the authentic $164.2^\circ$ model bearing:
    * NE: `[121.16895513, 13.95976580]`
    * NW: `[121.16892836, 13.95975845]`
    * SW: `[121.16893593, 13.95973248]`
    * SE: `[121.16896270, 13.95973983]`
  - Synchronized across `LARES_DRAWINGS` in [js/data/buildings.js](js/data/buildings.js), `FIELD_COMMODITY_ZONES` in [js/data/plots.js](js/data/plots.js), and [buildings.json](buildings.json).
  - Maintained strictly 39 numbered facilities in the directory; utilities (Water Tank and Comfort Room) display clean emoji badges (`🚰`, `🚻`) without numeric badges (`num: null`).
  - Confirmed `hasMarker: false` eliminates all floating map pills over both utility models.
  - Bumped cachebuster to `v=223` in `index.html`.
  - Verified via Headless Edge CDP (`scratch/verify_final.py`): the neon casing forms a clean rectangular box framing the building foundation and step, with zero diagonal diamond distortion.

### 2.0.20 Building Orbit & Kiosk Pin Restoration (ES Module Canonical Singleton Architecture) — ✅ Complete
- **Root Cause Analysis:**
  - Browser ES module loader treats differing query parameters (e.g. `import './map-setup.js?v=91'` vs `import './map-setup.js'`) as separate modules with independent memory scopes and duplicate top-level executions.
  - Across 48 import statements, fragmented query parameters caused `js/map-setup.js` to execute twice, instantiating **two concurrent `mapboxgl.Map` instances**.
  - One Map instance was mounted to the DOM while `window.orbitBuilding` in `js/idle.js` was controlling the disconnected ghost instance.
  - Furthermore, `js/markers.js` was instantiated five separate times (`?v=111`, `?v=109`, `?v=106`, `?v=105`, and unversioned), causing multiple `kioskMarkerInstance` objects and desynchronized label decluttering loops.
- **Architectural Cleanup & Harmonization:**
  - Standardized all internal relative imports across the entire `js/` directory to clean, canonical ES module specifiers without relative query strings.
  - Cachebusting is strictly governed at the application shell entry point in `index.html` (`js/app.js?v=216`).
  - Total active JS modules in browser reduced from 41 duplicate/fragmented instances to exactly 29 canonical singletons.
  - `server.js` statically serves all assets with `Cache-Control: no-store, no-cache, must-revalidate` so script changes are immediately hot-loaded.
- **Full Verification Across Desktop & Mobile Viewports:**
  - **Desktop Kiosk Mode:**
    * Clicking `(9) RAED Building` smoothly pans and tilts the camera to `[121.16617, 13.95834]`, `zoom: 19.6`, `pitch: 54°`, perfectly centered in the viewport between the left directory and right building drawer.
    * Smooth continuous 3D inspection orbit executes around RAED Building (`bearing` rotates by $+7.37^\circ$ in $1.2\text{s}$).
    * The `📍 YOU ARE HERE` pin remains strictly locked at Argosino Hall (`[121.1664336, 13.9581208]`).
    * Clicking another building (e.g. `(12) Tanco Hall Building`) transitions smoothly to Tanco Hall (`[121.16658, 13.95821]`, `pitch: 54°`).
    * Closing the building panel returns camera cleanly to the default Kiosk overview.
  - **Mobile Phone Mode:**
    * Clicking a building centers camera with mobile calibration (`zoom: 19.1`, `pitch: 48°`) and opens the active `phone-bottom-sheet` with complete photos and action buttons.
  - Verified with live Headless Edge CDP tests: `verified_raed_orbit_centered.jpg`, `verified_tanco_orbit_centered.jpg`, `verified_back_to_kiosk_overview.jpg`, `verified_mobile_raed_sheet.jpg`.

---

### 2.0.15 Differentiated Mobile vs Kiosk Performance Profile System — ✅ Complete
- **Context-Aware Performance Profile Differentiation:**
  - **Kiosk Mode (Desktop / Totem Touchscreen):**
    * Tag: `HARDWARE` (Emerald)
    * Title: `Kiosk Performance Profile`
    * Options: `⚡ Auto (Adaptive)`, `🌿 Kiosk Eco (i3 / i5 GPU)`, `💎 High (Native DPI)`
    * Tuning: Optimized for low-generation Intel HD/UHD graphics (`activePixelRatio: 1.0` in Eco, max 1.5 in High).
    * Storage Key: `da_kiosk_perf_profile`
  - **Mobile Phone Mode (Smartphones / QR Navigation):**
    * Tag: `BATTERY` (Cyan)
    * Title: `Mobile Performance Profile`
    * Options: `⚡ Auto (Balanced)`, `🔋 Battery Saver (Cool & Efficient)`, `💎 High Quality (Retina HD)`
    * Tuning: Calibrated specifically for smartphone thermals and battery lifespan. Eco mode locks rendering to strictly 1.0x to prevent thermal throttling and save up to 60% battery; High mode clamps to `Math.min(nativeDpr, 2.0)` for razor-sharp Retina HD without burning the battery.
    * Storage Key: `da_mobile_perf_profile` (decoupled from kiosk settings so mobile visitor adjustments never impact physical kiosk totems).
- **Dynamic DOM Updates & State Decoupling:**
  - Added `state.mobilePerformanceProfile` and `state.performanceProfile` in `js/data/state.js`.
  - Added dynamic label/tag/icon morphing in `js/performance.js` (`updatePerformanceUI()`).
  - Added dynamic responsiveness in `js/mode.js` (`applyAppModeToDOM()`) when resizing or rotating between mobile and desktop.
  - Bumped cachebusters: `index.html` (`app.js?v=210`), `js/app.js` (`performance.js?v=87`), `js/map-settings.js` (`performance.js?v=87`), `js/map-setup.js` (`performance.js?v=87`).
- **Headless Browser CDP Verification:**
  - Verified Kiosk Mode: `HARDWARE`, `Kiosk Eco (i3/i5 GPU)`, writes to `da_kiosk_perf_profile` (`verified_perf_kiosk_mode.jpg`).
  - Verified Mobile Mode: `BATTERY`, `🔋 Battery Saver (Cool & Efficient)`, writes to `da_mobile_perf_profile`, scrollable viewport (`verified_perf_mobile_scrolled.jpg`).

### 2.0.14 Kiosk Performance Profile Persistence & Desync Fix — ✅ Complete
- **Root Cause Resolution:**
  - Resolved ES Module fragmentation where `js/app.js` imported `./performance.js?v=85` while `js/map-settings.js` and `js/map-setup.js` imported unversioned `./performance.js`, leading to separate module instances in browser memory with independent `currentProfile` variables.
  - Eliminated truthy fallback bug in `updatePerformanceUI()` where `const p = currentProfile || localStorage...` was blocked from reading `localStorage` because `currentProfile` defaulted to `'auto'`.
  - Moved performance profile state into `state.performanceProfile` in `js/data/state.js` as the single shared source of truth across all modules and window contexts.
  - Hardened `localStorage` reads/writes with comprehensive `try...catch` guards to prevent silent execution termination in restricted storage environments.
  - Guarded Mapbox `state.map.getLayer()` calls inside `applyPerformanceProfileClass()` against `Style is not done loading` exceptions.
  - Attached explicit DOM click event listeners with `e.preventDefault()` and `e.stopPropagation()` on `#perf-btn-auto`, `#perf-btn-eco`, and `#perf-btn-high`.
  - Unified all module imports to `./performance.js?v=86` and bumped `app.js?v=209`.
- **End-to-End Automated Headless CDP Verification:**
  - Verified clicking "Kiosk Eco" immediately engages `eco` profile (`Render: 1.00x`), turns `#perf-btn-eco` active, turns `#perf-btn-auto` inactive, persists across idle and frame ticks, survives closing/reopening the panel, and persists across full browser page reloads (`verified_perf_eco_closeup.jpg`).

### 2.0.13 Plot 22 Water Tank & Comfort Room (Sub-Plots) Integration — ✅ Complete
- **Option B Separate 3D Models (<300 KB Budget):**
  - **LARES Water Tank (models/plot22_water_tank.glb, 165.6 KB):** Elevated structural steel water tower with 4 tapered angle legs, 3 tiers of horizontal tie beams, X-bracing, vertical access ladder with rungs, circular perimeter catwalk platform with safety guardrail, bottom conical hopper transition, ribbed cylindrical stainless tank, conical roof with apex finial, central water riser pipe with blue valve, and front 3D modernization project signboard with official DA seal medallion.
  - **Plot 22 Comfort Room (models/plot22_comfort_room.glb, 47.0 KB):** Concrete sanitation & irrigation control facility (.40\text{ m} \times 3.00\text{ m}$); white stucco walls, dark green fascia trim, white ceiling soffits, single-slope shed roof sloping downward to rear, aluminum louver door with frame, threshold, and silver push handle, brass wall dedication plaque, blue water riser pipe, galvanized side piping fixture, concrete entrance step, and freestanding commemorative project marker pedestal with angled DA bronze dedication plaque.
- **Sub-Plot Architecture with Zero Floating Map Pills:**
  - Integrated both facilities under **Coffee Orchard** (zone_coffee_orchard, Plot 22) as sub-plots with hasMarker: false, isSubPlot: true.
  - Excluded plot22_ IDs from generating standalone floating pin pills or directory entries in markers.js, sidebar.js, and phone-ui.js, preserving exactly 39 campus pin markers with zero ghost pills.
  - Interactive sub-plot chips rendered in the Coffee Orchard drawer with two-tier descriptions, coordinates, and multi-view photo carousels (images/plot22_water_tank.jpg, plot22_water_tank_angle.jpg, plot22_comfort_room.jpg, plot22_comfort_room_marker.jpg).
- **Road Graph & Walkway Connectivity:**
  - Plotted entrance nodes entrance_plot22_water_tank and entrance_plot22_comfort_room in 
oads.json.
  - Added dedicated pedestrian walkway spurs (
oad_walkway_water_tank, 
oad_walkway_comfort_room) connecting seamlessly into Pili Drive (
oad_40).
- **Cachebusters Bumped:** uildings.js?v=108, plots.js?v=95, 
oads.json?v=80, pp.js?v=205.

### 2.0.12 Post-Arrival UI Streamlining & Unobstructed 3D View — ✅ Complete
- **Removed Bottom Arrival Popup Card (`#kiosk-arrival-action-bar`):** Eliminated the redundant floating bottom modal that previously covered the lower third of the 3D map upon reaching destinations. Arrival is now cleanly conveyed via the top floating arrival banner (`🏁 Arrived — You have arrived at [Building Name]`) and the left sidebar's arrival card, replay button, and directory exit button.
- **Persistent Camera Controls on Arrival:** Cleaned up `startArrivedCountdown()` in `js/walker.js` so that `.floating-camera-controls` (`CAMERA: 🔒 Locked | 🧭 Side View | 🗺️ Top View`) remains active and accessible on arrival, gently auto-dimming after 5s of inactivity. Visitors can now immediately explore the 3D model perspective without obstructed views.
- **Stylesheet & DOM Decoupling:** Removed obsolete `.kiosk-arrival-action-bar` and `.kaa-*` styles from `css/main.css`, including the rule that forcibly hid the camera controls upon arrival.
- **Cachebusters Bumped:** `css/main.css?v=167`, `walker.js?v=94`, `routing.js?v=95`, `app.js?v=204`.

### 2.0.11 Plot Calibration Drawer & Plot 30 Main Map Synchronization — ✅ Complete
- **Plot Draw Restoration (`plot_draw.html`):** Restored missing `new mapboxgl.Map` and `MapboxDraw` initialization. Resolves freeze on "Loading calibrated squares..." and dark blue screen. All 45 plot chips, 10GB drone orthomosaic raster layer, road lines guide, and polygon drawing controls now initialize and persist immediately.
- **Plot 30 6-Sided Perimeter Integration (`js/data/plots.js`):** Merged user's bespoke 6-sided Plot 30 geometry wrapping the RCPC & Motorpool complex into `zone_mango_banana_jackfruit` (Plots 30–32) for both `FIELD_COMMODITY_ZONES` and `ZONE_POLYGONS` (10-sided seamless outer perimeter, 11 coordinates).
- **Internal Cut Line 15 (`INTERNAL_CUT_LINES`):** Updated shared boundary between Plot 30 and Plot 31 to align with Plot 30's eastern edge (`[121.16777592, 13.95824287]` to `[121.16799713, 13.95763656]`).
- **Plot 31 Snapped Boundary:** Snapped Plot 31's western edge in `ALL_PLOT_POLYGONS` cleanly to Plot 30.
- **Cachebusters Bumped:** `plots.js?v=92`, `plot-layers.js?v=92`, `building-panel.js?v=92`, `routing.js?v=92`, `sidebar.js?v=92`, `map-setup.js?v=92`, `index.html` (`app.js?v=200`).
- **Automated Verification:** Verified via Edge headless CDP (`tools/tests/verify_plot_fixes.py`) with visual screenshot captures for `plot_draw.html` and `index.html?mode=kiosk`.

### 2.0.10 Master Agricultural Plots Reorganization (Plots 1–45 Schedule across 23 Official Zones) — ✅ Complete
- **Reorganization Directive:** Full re-indexing, grouping, and renaming of all 45 agricultural research plots into 23 official master commodity zones based on user-provided ground-truth schedule:
  1. **Plot 1:** `Indigenous Trees` (`zone_indigenous_trees`)
  2. **Plot 2:** `Corn Seed Production Area` (`zone_corn_seed_prod_2`)
  3. **Plot 3:** `Upland Rice Experimental Area` (`zone_upland_rice_exp`)
  4. **Plot 4:** `Vegetables Experimental Area` (`zone_veg_exp`)
  5. **Plot 5:** `CGUARD Corn` (`zone_cguard_corn`)
  6. **Plots 6–12:** `Citrus Orchard` (`zone_citrus_orchard`) — retains AWS (#40) inside Plot 8
  7. **Plots 13–15:** `Corn Seed Production Area` (`zone_corn_seed_prod_13_15`)
  8. **Plot 16:** `Mango Orchard` (`zone_mango_orchard_16`)
  9. **Plot 17:** `TC Makapuno & Banana Screenhouse` (`zone_tc_makapuno_screenhouse`) — strictly preserves 5 3D models & real sub-plot names: Vegetables Screenhouse 1 & 2, Citrus Mother Plants, Embryo Cultured Macapuno Seedlings & TC Banana, and Coffee Seedlings
  10. **Plot 18:** `Coffee & Citrus Screenhouse` (`zone_coffee_citrus_screenhouse`) — strictly preserves 3D models & real sub-plot names: combined Screenhouses 6–8 and Screenhouse 9
  11. **Plot 19:** `Pomelo Orchard` (`zone_pomelo_orchard_19`) — calibrated 8-vertex polygon
  12. **Plots 20–22:** `Coffee Orchard` (`zone_coffee_orchard`)
  13. **Plots 23–25:** `Vegetable Production Area` (`zone_vegetable_production_area`)
  14. **Plots 26–28:** `Fruit Trees & Citrus Orchard` (`zone_fruit_trees_citrus_orchard`)
  15. **Plot 29:** `Tall Makapuno & Cacao` (`zone_tall_makapuno_cacao_29`)
  16. **Plots 30–32:** `Mango, Banana & Jackfruit Trees` (`zone_mango_banana_jackfruit`) — calibrated 7-vertex polygon
  17. **Plots 33–35:** `Dwarf Makapuno` (`zone_dwarf_makapuno`)
  18. **Plots 36–38:** `Cassava Production Area` (`zone_cassava_production_36_38`)
  19. **Plots 39–41:** `Soybean Seeds Production Area` (`zone_soybean_seeds_prod`)
  20. **Plot 42:** `Tall Makapuno & Cacao` (`zone_tall_makapuno_cacao_42`)
  21. **Plot 43:** `Cassava Production Area` (`zone_cassava_production_43`)
  22. **Plot 44:** `Organic Vegetable Production Area` (`zone_organic_veg_prod`)
  23. **Plot 45:** `Mango Orchard` (`zone_mango_orchard_45`)
- **Combined Overview & On-Demand Split Illumination:**
  - In the overview, all grouped zones (e.g. Plots 6–12 Citrus Orchard, Plots 13–15 Corn Seed Production, Plots 36–38 Cassava Production, etc.) render as **single seamless combined rectangles with zero internal lines** via `getPlotsGeoJSON()` returning `ZONE_POLYGONS`.
  - When a zone is clicked/selected, Mapbox feature state `selected: true` dynamically illuminates **only the internal cut lines of that specific zone** with white dashed dividers.
  - When deselected, cut line opacity cleanly returns to `0.0`.
- **Mathematical Exactness & Integrity:**
  - 23 Zone Polygons (`ZONE_POLYGONS`) merged seamlessly from user's `scratch/user_updated_plots.json`.
  - 45 Individual Plot Polygons (`ALL_PLOT_POLYGONS`) synchronized.
  - 22 Internal Dividing Cut Lines (`INTERNAL_CUT_LINES`) rendered with clean dashed boundaries (`rgba(255, 255, 255, 0.45)`).
  - Synchronized baseline `DEFAULT_CALIBRATED_SQUARES` in `plot_draw.html`.
  - Cachebusters bumped across all consumers: `js/data/plots.js?v=88`, `js/plot-layers.js?v=88`, `js/sidebar.js?v=88`, `js/map-setup.js?v=88`, `index.html` (`js/app.js?v=195`).
- **Automated Verification:** Verified via Edge CDP automation (`scratch/verify_combined_and_splits.py`) with 100% pass across overview combined counts, selection illumination, and deselect reset.

---

### 2.0.9 Mapbox Gate Presentation Alignment & Calibrated Plots Sync — ✅ Complete
- **Mapbox-Native Gate Barrier Presentation (Matches User Reference Image 1):**
  - **Eliminated Bulky Pill:** Replaced the heavy black capsule container with the authentic Mapbox Maki `gate` vector symbol (`<svg viewBox="0 0 15 15">`) directly integrated onto the perimeter boundary line crossing the road.
  - **Dual Mode Visuals:**
    - *Mapbox Standard Mode:* Displays clean slate-grey Maki gate icon (`#475569` on `#e2e8f0`) matching Image 1 100%.
    - *Drone / Satellite Mode:* Displays crisp circular badge with dark glassmorphism backing (`rgba(15, 23, 42, 0.85)`) & theme accent ring.
  - **Clean Typography (NO Pill Container):** Name is rendered in Mapbox typography directly on the map surface with native text-halo (`text-shadow`), eliminating bulky dark boxes.
  - **Zero Flinging / Stable Markers:** Root marker translation is controlled exclusively by Mapbox GL JS without CSS transform overrides.
  - **100% Standalone Selection:** Clicking `Main Entrance`, `Main Exit`, or `Back Gate Entrance / Exit` opens the gate details drawer and routes directly to the barrier; Guard House A (#1) remains unselected in both the directory and the map.
  - **Calibrated Barrier Placement:** Shifted `Main Entrance` northward along the compound boundary from `13.958316` to `[121.165745, 13.958380]`, aligning it directly at the physical driveway opening and barrier gate crossing.
- **Calibrated Plot Drawings Synchronization (`plot_draw.html`):**
  - Extracted 45 calibrated field plots directly from user browser storage (`scratch/user_updated_plots.json`).
  - Synchronized updated boundary polygons for:
    - **Plot 17 (`zone_tc_makapuno_screenhouse`)**: Calibrated boundaries updated.
    - **Plot 18 (`zone_coffee_citrus_screenhouse`)**: Calibrated boundaries updated.
    - **Plot 19 (`zone_pummelo_orchard`)**: Upgraded to 8-vertex calibrated polygon.
    - **Plot 30 (`zone_mango_banana_jackfruit`)**: Upgraded to 7-vertex calibrated polygon.
  - Synchronized `ALL_PLOT_POLYGONS` and `ZONE_POLYGONS` in `js/data/plots.js` and updated baseline `DEFAULT_CALIBRATED_SQUARES` in `plot_draw.html`.
  - Cachebusters bumped: `css/main.css?v=166`, `js/app.js?v=193`, `js/markers.js?v=107`, `js/data/plots.js?v=86`.

---

### 2.0.8 Official Screenhouse Real Names & Combined Highlight (Plot 18 Screenhouses 6–8) — ✅ Complete
- **Official Ground-Truth Real Names Configured:**
  - **Screenhouse 1:** `Vegetables Screenhouse 1` (`plot17_screenhouse_1`, Plot 17 Sub-Plot 1)
  - **Screenhouse 2:** `Vegetables Screenhouse 2` (`plot17_screenhouse_2`, Plot 17 Sub-Plot 2)
  - **Screenhouse 3:** `Citrus Mother Plants Screenhouse` (`plot17_screenhouse_3`, Plot 17 Sub-Plot 3)
  - **Screenhouse 4:** `Embryo Cultured Macapuno Seedlings & Tissue Cultured Banana Screenhouse` (`plot17_screenhouse_4`, Plot 17 Sub-Plot 4)
  - **Screenhouse 5:** `Coffee Seedlings Screenhouse` (`plot17_screenhouse_5`, Plot 17 Sub-Plot 5)
  - **Screenhouse 6–8:** `Citrus Seedlings Screenhouse` (`plot18_greenhouse_complex`, Plot 18 Sub-Plot '6-8')
    - **Combined Highlight:** Unifies bays 6, 7, and 8 into one continuous highlight polygon with interactive multi-bay image gallery (West, Center, East bays).
  - **Screenhouse 9:** `Citrus Seedlings Screenhouse` (`plot18_screenhouse_9`, Plot 18 Sub-Plot 9)
- **Files Synchronized:**
  - `js/data/plots.js`: Updated `FIELD_COMMODITY_ZONES` and `ZONE_POLYGONS` sub-plots, labels, names, crops, and descriptions.
  - `js/data/buildings.js`: Updated `LARES_DRAWINGS`, `KNOWN_BUILDING_NAMES`, and `BUILDING_DIRECTORY` descriptions.
  - `js/building-panel.js`: Fixed `zoomToSubPlot` argument escaping for combined plot string identifiers (`'6-8'`).
  - `js/data/descriptions.js`: Synchronized `compactTag` and `keyServices`.
  - `buildings.json`: Updated `name` properties.
  - `index.html`: Cachebuster bumped to `app.js?v=193`.
- **Verification:** Verified in headless Edge CDP; captured high-resolution screenshots for Screenhouse 1, combined Screenhouse 6–8, and Screenhouse 9.

---

### 2.0.7 Warehouse Entrances & Complete 39-Building Pathfinding Graph Integration — ✅ Complete
- **User Action & Requirement:** User drew two new walkway road segments and entrance nodes in `road_draw.html` for **LARES Agricultural Supplies Storage** and **LARES Organic Fertilizer Storage**, which were saved to `roads.json` with temporary properties (`buildingId: "lares_facility"`).
- **Entrances Mapped & Configured in `roads.json`:**
  1. **LARES Agricultural Supplies Storage (`lares_agricultural_supplies_storage`, Building Pin #31):**
     - Assigned Feature 99 (`id: "entrance_9"`) at coordinates `[121.16696259564662, 13.959476573681513]`.
     - Connected via walkway `road_10` to campus main road `road_1`.
  2. **LARES Organic Fertilizer Storage (`lares_organic_fertilizer_storage`, Building Pin #34):**
     - Assigned Feature 97 (`id: "entrance_8"`) at coordinates `[121.16687680710152, 13.959779763606505]`.
     - Connected via walkway `road_9` to campus access road `road_4`.
  3. **LARES Farm Machinery Shed 1 (`lares_farm_machinery_shed_1`, Building Pin #33):**
     - Updated legacy Feature 90 (`id: "entrance_2"`) at coordinates `[121.16691513713585, 13.959707381769292]` from `"warehouse_2"` to `"lares_farm_machinery_shed_1"`.
- **System Synchronization:**
  - `roads.json` cachebuster bumped to `v=77` in `js/app.js` and `js/map-setup.js`.
  - Added `'warehouse_2': 'lares_farm_machinery_shed_1'` safety alias to `aliasMap` in `js/app.js` and `ENTRANCE_OVERRIDES` in `js/routing.js`.
  - Cachebusters bumped in `index.html` (`app.js?v=192`).
- **Comprehensive Audit:** Verified that **all 39 standalone campus buildings** have registered, active entrance nodes in `roads.json` and compute valid routes with zero orphan destinations.

---

### 2.0.5 Sidebar Directory & Map Pin Numbering Desynchronization — ✅ Complete
- **Issue:** In the sidebar directory menu, the numbering jumped from `#30 Automated Weather Station` directly to `#39 Warehouse 1 (Abono)`, whereas on the 3D map viewport the pin on Warehouse 1 displayed `#31` (desync of 8 numbers).
- **Root Cause Diagnosed:**
  - `BUILDING_DIRECTORY` contains 47 items in total, which includes 8 hidden screenhouse sub-plots (`plot17_screenhouse_1` to `plot18_screenhouse_9_headhouse`) at indices 30 to 37.
  - Map markers filtered out sub-plots first, assigning Warehouse 1 index 30 + 1 = `num: 31`.
  - In contrast, the sidebar menu (`js/sidebar.js`) computed `num = dirList.indexOf(b) + 1`, counting the 8 hidden sub-plots, which pushed Warehouse 1 to `num: 39`.
- **Permanent Solution Applied:**
  1. **Canonical `b.num` in `BUILDING_DIRECTORY`:** When `BUILDING_DIRECTORY` is populated in `js/data/buildings.js`, a sequential `buildingCounter` assigns `num` exclusively to standalone facilities ($1\dots38$), setting `num: null` on sub-plots.
  2. **Unified Consumer Modules:**
     - `js/sidebar.js`: Uses `b.num` directly for directory badges.
     - `js/markers.js`: Uses `b.num` directly for map pin badges and popups.
     - `js/phone-ui.js`: Uses `b.num` directly for mobile list and arrival cards.
     - `js/data/buildings.js` (`getBuildingById`): Returns `b.num`.
     - `js/app.js`: URL parameter matching (`?dest=31`) matches `b.num`.
  3. **Cachebusters Bumped:** Unified to `v=98` across all modules and `app.js?v=183` in `index.html`.
- **Verification:** Automated CDP comparison audit of all 38 sidebar items against all 38 map marker pins returned **0 mismatches**; Warehouse 1 is `#31`, through Storage `#38`.

### 2.0.4 Zoom Vanish Bug & Drone Calibration Array Offset Resolution — ✅ Permanent Architectural Fix
- **Issues Addressed:**
  1. **Building Vanishing on Zoom Out:** When zooming out to zoom $\le 18.0$, `lares_agricultural_supplies_storage` completely disappeared from view, leaving only `prdp_building` rendered.
  2. **Warehouse Markers Teleporting to Screenhouses on Refresh:** Warehouse pins (31 to 37) previously jumped southeast onto the Plot 17 & 18 Screenhouses whenever the page reloaded.
  3. **Corrupted Facility Names When Drawing:** Newly drawn shapes in `draw.html` previously defaulted to `admin_building`.
- **Root Causes Diagnosed & Permanent Solutions Applied:**
  1. **Mapbox `geojson-vt` Point Deduplication:** `prdp_building` and `lares_agricultural_supplies_storage` previously shared the identical Point coordinate (`[121.16692287, 13.95933876]`). At zoom levels $\le 18$, Mapbox's tile generator merged coincident points and dropped the second model.
     - *Solution:* Re-centered `models/lares_agricultural_supplies_storage.glb` ($35.2\text{ KB}$) around its own local origin ($Y = 0$), placed its world coordinate at its authentic physical center (`[121.16688145, 13.95946174]`), and added `tolerance: 0, buffer: 0, maxzoom: 24` to `lares-3d-buildings-models-source` in `js/map-setup.js`.
  2. **Drone Calibration Marker Indexing Bug & Module Caching:** `drone-calibration.js`'s `executeLayerShift()` indexed `BUILDING_DIRECTORY[idx]` directly from `state.markers.forEach((m, idx) => ...)`. Since sub-plots were excluded from `state.markers` (38 items) but present in `BUILDING_DIRECTORY` (47 items), index 30 (`warehouse_1`) picked `BUILDING_DIRECTORY[30]` (Screenhouse 1). In addition, `drone-calibration.js` was imported in `js/app.js` without a version query parameter, causing browsers to serve the unpatched cached script on refresh.
     - *Solution:* Fixed `js/drone-calibration.js` to look up by canonical dataset ID (`el.dataset.id`). Updated `js/app.js` to import `./drone-calibration.js?v=97` and unified all modules to cachebuster `v=97` (`app.js?v=182`).
  3. **Draw.html Default Selection:** Changed `draw.html` creation modal from defaulting to `'admin_building'` to an unselected placeholder `-- Select Campus Facility --` with hard validation blocking blank/unassigned submissions.
- **Verification Across All Zoom Levels:**
  - Automated CDP tests confirmed that at Zoom 19.5, 18.0, 17.5, 16.5, and 15.0, both `prdp_building` and `lares_agricultural_supplies_storage` remain 100% rendered with zero vanishing.
  - Marker audit confirmed: Screenhouse pins count = 0; Warehouse 1–7 anchored precisely in the northern operational compound; Storage pin anchored at the eastern PRDP wing.

### 2.0.3 Stale Draw Autosaves & Rogue Map Pin Deduplication — ✅ Permanent Architectural Fix
- **Issue:** Every time the user saved or drew buildings in `draw.html`, old/placeholder pins (such as pins 31-35 labeled "Admin Building" over Plot 17 Screenhouses) reappeared across the campus map.
- **Root Causes Diagnosed & Resolved:**
  1. **Stale `localStorage` Priority in `draw.html`:** `draw.html` loaded stale local storage before fetching server data. When the user saved, the browser's stale polygons were sent to `/api/buildings` and overwrote `buildings.json`.
  2. **Unassigned Dropdown Fallback:** Unassigned polygons in `draw.html` defaulted to `admin_building`.
  3. **No Deduplication in `BUILDING_DIRECTORY`:** `BUILDING_DIRECTORY` in `js/data/buildings.js` previously did a raw `.map()` over all polygons without deduplicating by ID, allowing 16 duplicate "Admin Building" entries and pins.
  4. **Unfiltered Sub-Plots:** Screenhouses in Plot 17 and Plot 18 were missing `isSubPlot: true` and `hasMarker: false` flags in `buildings.json`.
- **4-Layer Permanent Architectural Solution:**
  1. **Strict Deduplication in `js/data/buildings.js`:** `BUILDING_DIRECTORY` now uses `seenBuildingIds = new Set()`. Even if multiple polygons exist with the same ID, only the first instance ever enters the directory or spawns a map pin. All sub-plots (`plot17_*`, `plot18_*`, `*_annex`, `*_headhouse`) are strictly excluded from map pins.
  2. **Automated Centroid Sanitizer in `server.js` (`POST /api/buildings`):** Every incoming payload is matched against known geographic coordinates (Screenhouses 1-5, Greenhouses, Warehouses 1-7, Storage, PRDP, Admin Building). Any mislabeled or duplicate ID is auto-corrected to its canonical identity and sub-plot flags are enforced before writing to disk.
  3. **Self-Healing `draw.html`:** Auto-purges corrupted `localStorage` if more than one `admin_building` exists. Default fallback changed from `'admin_building'` to `'__custom__'`. Sanitizes data before saving to server.
  4. **Database Sanitized:** `buildings.json` and `LARES_DRAWINGS` restored with canonical identities for all 47 features.
- **Verification:** `BUILDING_DIRECTORY` count: 47; Admin Building count: 1 (Pin 3); Screenhouse pins: 0; Live map verified via HTTP server.

### 2.0.2 PRDP Building Resizing & LARES Agricultural Supplies Storage Split & 3D Integration — ✅ Complete
- **Context & User Directive:** Based on drone aerial orthomosaic ground-truth and field photos, the structure previously treated as a single building was split into two distinct, side-by-side structures sharing an internal dividing wall:
  1. **PRDP Building (`prdp_building`)**: Resized to its authentic western half ($16.7\text{ m} \times 12.5\text{ m}$, 4 bays, $W=11.0\text{ m}, D=15.2\text{ m}$, eaves $0.75\text{ m}$). Freshly painted deep emerald-green corrugated hip roof (`#124729`), dark oxblood foundation plinth, 4-bay commercial facade, official signage, and double entrance doors aligned with `entrance_16`. Model: `models/prdp_building.glb` (**$132.1\text{ KB}$**, $<300\text{ KB}$ budget). Center: `[121.16692287, 13.95933876]`, rotation $341.9^\circ$.
  2. **LARES Agricultural Supplies Storage (`lares_agricultural_supplies_storage`)**: Eastern half with 6-vertex L-shaped footprint. Weathered olive/sage green corrugated hip roof (`#4D604B`), L-wing valley rake, dark timber fascia, warm cream stucco walls, maroon foundation skirting; fixed 6-panel wooden door at entrance position "1" on the south wing wall with brass doorknob and concrete step (properly fixed/mounted per user request), through-wall Carrier window AC unit, and 3-panel steel-grilled windows facing east towards `road_1`. Model: `models/lares_agricultural_supplies_storage.glb` (**$68.9\text{ KB}$**, $<300\text{ KB}$ budget). Center: `[121.16690896, 13.95946182]`, rotation $341.9^\circ$. Hero image: `images/lares_agricultural_supplies_storage.jpg` ($284.6\text{ KB}$).
- **Wayfinding & Road Graph Integration:**
  - Entrance node `entrance_49` plotted at `[121.16695385, 13.95945836]` directly at the entrance step of the projecting wing (position "1").
  - Dedicated straight walkway LineString `road_walkway_agri_supplies` connects `entrance_49` directly to `road_1` (`[121.16701192743119, 13.95948585977348]`).
  - Full pathfinding verified from Main Kiosk to `lares_agricultural_supplies_storage`.
- **Data Registration & Rule Compliance:**
  - Feature 46 updated in `buildings.json` and `LARES_DRAWINGS` in `js/data/buildings.js` with `id: 'lares_agricultural_supplies_storage'`, `category: 'infrastructure'`, `type: 'Storage & Logistics Facility'`.
  - Registered in `KNOWN_BUILDING_NAMES`, `CUSTOM_BUILDING_CENTERS`, `BUILDING_CATEGORIES`, `BUILDING_TYPES`, and dynamic `BUILDING_DIRECTORY`.
  - Added two-tier descriptions in `js/data/descriptions.js`.
  - Strictly Rule 6 compliant: Zero entries in `BUILDING_OFFICES` in `js/data/offices.js`.
  - Strictly Rule 4 compliant: Pure architectural structure without external turf, roads, or vehicles.
  - Bumped cachebusters: `app.js?v=175`, `buildings.js?v=89`, `roads.json?v=75`.

### 2.0.0 Phase 1: Warehouse 1 (Abono Storage Facility) 3D Model Integration — ✅ Complete
- **Facility:** Warehouse 1 (`warehouse_1`) — Abono / Fertilizer Storage Facility.
- **Reference Images:** `Building Images/warehouses/1 Front View.jpg`, drone aerial close-up `fe349ae4`.
- **Architectural Specifications:**
  - Compact single-story CMU structure ($6.90\text{ m} \times 9.91\text{ m}$, eaves $3.10\text{ m}$, ridge apex $4.30\text{ m}$) in warm off-white stucco (`#EDE6D4`) with weathered dark grey plinth skirt (`#636561`).
  - 100% Watertight gable roof with authentic $0.40\text{ m}$ eave and $0.35\text{ m}$ rake overhangs, dark brown timber fascia rakes (`#4C3727`), corrugated galvanized metal panels with alternating weathered rust strips, green painted ridge cap (`#2E5638`), and overhead black drop cable from apex.
  - East gable facade features dark charcoal door frame, cream flush door leaf, silver vertical handle/latch, concrete threshold landing pad ($1.40\text{ m} \times 1.40\text{ m}$), and 3D official facility signboard `"ABONO"` with green border frame and bold red lettering.
- **Orientation & Wayfinding Alignment:**
  - Model centered at `[121.16684337, 13.95960904]`, Mapbox rotation $68.15^\circ$ (outward normal of East gable wall), orienting the door and `"ABONO"` sign directly toward `roads.json` entrance node `entrance_42` (`[121.16689, 13.959626]`).
- **Performance Budget:** `models/warehouse_1.glb` is **$86.1\text{ KB}$**, well below the $150\text{ KB}$ target and $< 300\text{ KB}$ budget (Rule 2).
- **Rule Compliance:** Strictly one building at a time (Rule 1); zero extraneous outdoor props/vehicles/lawn (Rule 4); zero fake offices in `offices.js` (Rule 6).
- **Hero Image:** Optimized `images/warehouse_1.jpg` ($258.5\text{ KB}$) for fast mobile and kiosk drawer display.
- **Cachebuster:** Bumped `index.html` to `app.js?v=161`.

### 2.0.1 Warehouse 1–7 Directory, Entrance Orientations & Road Graph Integration — ✅ Complete
- **Background & Identification:** Polygons drawn by the user north of PRDP Building were identified and registered as Warehouses 1 through 7 (warehouse_1 to warehouse_7):
  - **LARES Agricultural Supplies Storage (lares_agricultural_supplies_storage)** (#31): Eastern wing of PRDP complex, faces **East** towards compound lane ([121.166881, 13.959462]).
  - **LARES Synthetic Fertilizer Storage / LARES Pesticide Storage (warehouse_1)** (#32): Masonry storage north of PRDP, faces **East** towards access lane ([121.166890, 13.959626]).
  - **LARES Farm Machinery Shed 1 (lares_farm_machinery_shed_1)** (#33): Open shed north of Warehouse 1 housing combine harvester & Ford tractor, faces **East-North-East** towards internal lane ([121.166871, 13.959707]).
  - **LARES Organic Fertilizer Storage (lares_organic_fertilizer_storage)** (#34): Enclosed fertilizer storage north of Shed 1, faces **East-North-East** towards internal lane ([121.166833, 13.959801]).
  - **LARES Corn Seed Processing Facility (warehouse_3)** (#35): Facility at northwest compound bend with screened packing veranda, faces **South** towards courtyard ([121.166838, 13.959895]).
  - **LARES Farm Machinery Shed 2 (warehouse_4)** (#36): L-shaped machinery complex behind Warehouse 3 housing tractors & threshers, faces **South** towards staging courtyard ([121.166996, 13.960005]).
  - **Rice Banner Warehouse (warehouse_5)** (#37): Large high-bay green-roofed facility with southern loading canopies, faces **South** towards service road ([121.167232, 13.959950]).
  - **Cassava Dryer (warehouse_6)** (#38): Processing facility with rotary dryer & biomass furnace, faces **South** towards service road ([121.167405, 13.960040]).
  - **Corn Banner Warehouse (warehouse_7)** (#39): Multi-bay seed warehouse with skylight monitors and western annex, faces **South** towards service road ([121.167587, 13.960085]).
- **Data & Wayfinding Integration:**
  - **buildings.json & js/data/buildings.js:** Mapped features 38–44 with category infrastructure, height 4.5m, type Storage & Logistics Facility, registered in KNOWN_BUILDING_NAMES, CUSTOM_BUILDING_CENTERS, BUILDING_CATEGORIES, BUILDING_TYPES, and dynamic BUILDING_DIRECTORY.
  - **js/data/descriptions.js:** Added two-tier wayfinding information (compactTag, visualLandmark, keyServices) for all 7 warehouses.
  - **roads.json:** Plotted entrances entrance_42 through entrance_48 aligned with user-specified facing directions. Extended road graph via road_warehouse_access, road_warehouse_east_lane, and dedicated entrance walkway spurs (road_walkway_wh1 to road_walkway_wh7). Full pathfinding verified from Main Kiosk to all 7 warehouses.
  - **Rule 6 Compliance:** Zero entries added in BUILDING_OFFICES in offices.js.
  - **Cachebusters:** Bumped app.js?v=160, roads.json?v=73, and buildings.js?v=76.

### 2.0 Plot Infographics Mode (Suppressed Get Directions & QR Codes) — ✅ Complete
- **Implementation:** Per user instruction, all agricultural field plots and master commodity zones (`FIELD_COMMODITY_ZONES`, Plots 1–45) are designated as infographics-only facilities:
  - **CSS Suppression:** Added `#building-panel.is-plot-panel .bp-actions`, `#bp-directions-btn`, `#bp-gps-nav-btn`, and `#bp-qr-card` with `display: none !important` in [css/main.css](css/main.css).
  - **Panel State Management:** In [js/building-panel.js](js/building-panel.js), `showPlotPanel(zoneId)` applies `is-plot-panel` and hides `.bp-actions` without triggering QR generation. `showBuildingPanel(buildingId)` and `closeBuildingPanel()` cleanly restore `.bp-actions` and QR generation for regular buildings.
  - **Router Guard:** In [js/routing.js](js/routing.js), `getDirections()` now includes a guard returning immediately if `selectedBuildingId` belongs to a plot zone.
  - **Cachebusters:** Bumped [index.html](index.html) to `main.css?v=159` and `app.js?v=159`.

### 2.1 Human-Centered Two-Tier Wayfinding Descriptions & Compact Sidebar Tags — ✅ Complete
- **Implementation:** Replaced database-level technical metadata (`Section: Compound`, `Type: Office Building`, `Coords: ...`) across both Desktop Kiosk and Mobile Web modes with human-centered two-tier wayfinding cards:
  - **Scannable Sidebar Menu:** Displays concise, single-line descriptive badges (e.g. `Executive Hub • 6 offices`, `Conference & Training Hall`, `Agribusiness & Marketing`, `Food & Refreshment Center`).
  - **Two-Tier Detail Card (Desktop & Mobile):**
    - 👁️ **How to Spot It (Visual Landmark):** Physical cues from field photos and 3D models (roof structure, porticos, entrance steps, wings).
    - 🎯 **What's Inside & Key Services:** Plain-language, visitor-relevant services and activities.
    - 🏢 **Interactive Office Chips:** Retained clickable office route pills for designated multi-office complexes (`ored_building`, `admin_building`, `raed_building`, `tanco_hall_building`, `lares_building`, `multi_purpose_administrative_building`, `rnd_building`), strictly omitting them for standalone facilities.
- **Artifacts & Files:** [js/data/descriptions.js](js/data/descriptions.js), [index.html](index.html) (`v=119`), [css/main.css](css/main.css), [js/building-panel.js](js/building-panel.js), [js/sidebar.js](js/sidebar.js), [js/phone-ui.js](js/phone-ui.js). Verified on Desktop and Mobile.

### 2.1 Mapbox View vs. Aerial Drone View & Multiple Scale Controls Resolution — ✅ Complete
- **Root Causes:**
  1. *Duplicate Zoom / Multiple Scale Controls:* `js/app.js` imported `markers.js?v=7`, `routing.js?v=7`, and `map-setup.js?v=3` while 12 other modules imported `markers.js`, `routing.js`, and `map-setup.js` without query strings. Browser ES module resolution treats distinct query strings as separate modules, causing dual module execution and instantiating two concurrent `mapboxgl.Map` instances and two `HeightLimitScaleControl` instances (displaying stacked 10m and 20m scale bars).
  2. *Black Border in Mapbox View:* `lares-mask-layer` and `qares-mask-layer` are global inverted world masks (`[[-180,-85],[180,-85],[180,85],[-180,85]]` with compound cutouts). Previous code kept the mask layer permanently `visible: 'visible'` and only switched `fill-color: #060a12`, covering all surrounding provincial terrain with a pitch-black box.
- **Fixes Applied:**
  1. Stripped all divergent internal query strings from relative ES module imports in [js/app.js](js/app.js).
  2. Wrapped all Mapbox controls (`NavigationControl`, `OrbitControl`, `HeightLimitScaleControl`, `FullscreenControl`) inside a singleton guard `if (!window._mapControlsAdded)` in [js/map-setup.js](js/map-setup.js).
  3. Calibrated mask visibility:
     - **LARES Aerial Drone View:** `lares-mask-layer` is `visible` (vignette black border outside compound), `lares-drone-layer` is `visible`.
     - **LARES Mapbox View:** `lares-mask-layer` is `none`, exposing the full Mapbox standard vector basemap (surrounding highway 421-1, lots, terrain) with zero black border.
     - **QARES Aerial Drone View:** `qares-mask-layer` is `visible` (vignette black border outside compound), `qares-ortho-layer` is `visible`.
     - **QARES Mapbox View:** `qares-mask-layer` is `none`, exposing the full Mapbox standard vector basemap (Maharlika Highway 1, lots, terrain) with 3D buildings, railway, and zero black border.
  4. Cachebuster bumped to `app.js?v=118` in [index.html](index.html). All 4 modes verified via automated CDP testing and visual screenshots.

### 2.2 Full-Stack Performance & Low-End / Legacy PC Optimization Suite — ✅ Complete
- **Background & Requirement:** The system was optimized to guarantee rock-solid, responsive 60 FPS performance across low-end and legacy PCs with limited RAM (2GB–4GB), older dual/quad-core CPUs (Intel Celeron, Core 2 Duo, Haswell/Skylake i3/i5), and integrated graphics (Intel HD Graphics 4000/4400/520/620):
  - **Eliminated Runaway Idle CPU Spinning:** Replaced the infinite 60Hz `fpsLoop` `requestAnimationFrame` recursion in [js/app.js](js/app.js) with an adaptive, idle-sleeping frame meter (`wakeFpsMeter`, `sleepFpsMeter`). The meter actively monitors frame rate during user interactions, camera manipulation, and animations, and automatically sleeps 2 seconds after the camera settles, cutting idle CPU thread utilization to ~0%.
  - **Zero-Cost `body.low-perf-mode` CSS Suite:** Appended zero-overhead GPU rules in [css/main.css](css/main.css) disabling all 40+ `backdrop-filter: blur(...)` and `-webkit-backdrop-filter` shader passes (`none !important`), replacing expensive translucent blurs with sleek opaque high-contrast dark backgrounds (`#0f172a` / `#1e293b`), disabling continuous heavy box-shadow rasterization pulses (`.kiosk-marker-pulse`, `.spotlight-pulse-ring`, `.gps-marker-pulse`, `.stc-shimmer-bar`), and shortening UI transition times to `0.15s`.
  - **Adaptive Hardware Profile & Quality Class Dispatcher:** Extended [js/performance.js](js/performance.js) with `applyPerformanceProfileClass()` hooked into `detectGpuHardware()`, `reportFrameRate()`, and `setPerformanceProfile()`. Automatically engages `body.low-perf-mode` on systems with <= 4 cores, <= 4 GB RAM, software WebGL rendering, or when frame rate drops below 38 FPS.
  - **Page Visibility API (Zero Background Power):** Wired `document.addEventListener('visibilitychange')` in [js/app.js](js/app.js) and [js/idle.js](js/idle.js) to immediately halt the telemetry loop, screensaver rotation loop (`rotateStep`), and idle timers whenever the browser tab is hidden or minimized (`document.hidden === true`), completely eliminating background CPU/GPU drain.
  - **Cachebusters Bumped:** `css/main.css?v=160`, `js/app.js?v=173` in [index.html](index.html).

### 2.3 Explanation & Fix for the "21,537m / ~270 min walk" Route Calculation Bug
- **Bug Breakdown:** When browsing DA-QARES and selecting a facility (e.g., *Research Building*), the navigation route banner displayed:
  `📏 21537m  🚶 ~270 min walk` (~21.5 km).
- **Root Cause Analysis:** In [js/routing.js](js/routing.js), `calculateRoute()` defaults the origin coordinate to `KIOSK_COORDS` (`[121.16649613, 13.95809898]`), which is the **physical kiosk at DA-LARES in Lipa City**. Because QARES is located in **Tiaong, Quezon**, the router was calculating a cross-province line from Lipa to Tiaong (~21.5 km)!
- **Action Plan:**
  - Make `calculateRoute()` dynamically detect `state.currentStationId`.
  - If `lares`: start from `STATIONS.lares.kioskCoords` (`[121.16649613, 13.95809898]`).
  - If `qares`: start from `STATIONS.qares.kioskCoords` (`[121.3713315, 13.9432268]`).
  - Ensure pathfinding graph traversal switches to `qares_roads.json` when browsing QARES.

### 2.4 Implement QGIS QARES Boundaries & Dynamic Inverted Mask Synchronization — ✅ Complete
- **Implementation:** Imported and integrated authentic deeded split parcels (`qares_front` and `qares_flint`) from QGIS into `qares_boundary.json` with neon green boundary lines, outer protective casings, and subtle interior green fill.
- **Bridged Inverted World Mask (`QARES_MASK`):** Generated in [js/data/geo.js](js/data/geo.js) and [js/stations.js](js/stations.js) with 100% solid opacity (`fill-opacity: 1.0`, `fill-color: #060a12` in mapbox / `#0b1121` in satellite), completely eliminating outside bleed from surrounding neighborhoods and Maharlika Highway, while leaving the authentic central railway crossing walkway bridge (`qares_road_6` $\to$ `qares_road_7`) illuminated with high-res drone orthomosaic imagery.
- **Front Boundary Adjustment & Realtime Mask Alignment:** When the Front (southern parcel) northern boundary was moved northward to the PNR railway track via `qares_boundary_draw.html`, the static mask was updated to eliminate the black strip above buildings #27, #28, #30, #31. Implemented runtime `buildQARESMaskFromBoundary()` in [js/stations.js](js/stations.js) and backend `updateQaresMaskInGeoJs()` in [server.js](server.js) so future boundary adjustments automatically update both the live map mask and `js/data/geo.js` with zero blank voids.

### 2.5 QARES Railway Track Cartographic Symbology — ✅ Complete
- **Implementation:** Replaced legacy broken/dashed divider line with an authentic 4-layer railway cartography system in [js/stations.js](js/stations.js):
  1. `qares-railway-ballast`: Crushed gravel bed foundation (`#0f172a`, zoom-interpolated width 6–22px).
  2. `qares-railway-sleepers`: Railroad ties/cross-sleepers (`#94a3b8`, zoom-interpolated width 5–18px, `line-dasharray: [0.35, 1.25]`, `line-cap: butt`).
  3. `qares-railway-rail-left`: Left parallel gleaming metallic steel rail (`#f8fafc`, `line-offset: -1.8` to `-6.5`).
  4. `qares-railway-rail-right`: Right parallel gleaming metallic steel rail (`#f8fafc`, `line-offset: 1.8` to `6.5`).
- The railway track passes across the dark void separating Front and Flint and passes cleanly under the illuminated connecting walkway bridge.

### 2.6 Add Entrance Option for Automated Weather Station in `draw.html`
- **Requirement:** Add `automated_weather_station` (Automated Weather Station) to the entrance point assignment dropdown in [draw.html](draw.html).
- **Purpose:** Allows plotting the entrance coordinate node directly at the AWS perimeter swing gate (`[121.16855139, 13.96006960]`) and linking it to the pedestrian graph in [roads.json](roads.json), so the 3D claymation walker avatar can route visitors directly to and through the AWS gate.

### 2.7 Pitch-Black Darkness on Station & Map Switching — ✅ Fully Resolved
- **Bug Breakdown:**
  When switching between research stations (LARES $\leftrightarrow$ QARES) or when rapidly switching locations and toggling between Aerial Drone and Mapbox 3D views, the screen would unexpectedly plunge into complete pitch-black darkness.
- **Root Cause Forensic Analysis:**
  1. *Dangling Intro Fly-In Callback Clamping:* `playIntroAnimation()` runs a 6.0-second 3-stage cinematic fly-in with asynchronous `map.once('moveend')` listeners and `setTimeout`s. When switching stations before that animation completes, `stopIntroAnimation()` stopped the camera, but Mapbox GL's `map.stop()` emitted a `moveend` event! Because the new station re-set `isIntroAnimating = true`, the previous station's pending `moveend` callback executed `map.setMaxBounds(activeBounds)` where `activeBounds` belonged to the OLD station!
     - When switching QARES $\to$ LARES, QARES bounds `[121.30, 13.88] to [121.44, 14.00]` were applied while the camera was at LARES (`121.166`). Mapbox GL forcibly clamped the camera to QARES's western edge (`121.3000`), 15 kilometers away!
     - At `121.3000`, the inverted `lares-mask-layer` was active, whose only cutout hole is at Lipa (`121.166`). The camera was looking directly at the solid black mask (`#0b1121`), plunging the entire screen into 100% pitch black darkness!
  2. *Asynchronous Switch Cascades & Race Conditions:* `switchResearchStation()` lacked timer handles. Rapid clicks queued multiple interleaved `setTimeout(260ms)` and `setTimeout(120ms)` transitions in parallel, causing curtain desynchronization, contradictory layer toggling, and camera fighting.
  3. *Unfiltered Gesture Bounds Clamping:* Mouse/touch listeners (`'mousedown'`, `'touchstart'`) in `js/map-setup.js` prematurely clamped bounds to the active station before the user's click even initiated the station change.
- **Fixes Applied:**
  1. **Intro Sequence Generation Token (`introSequenceId`):** In [js/map-setup.js](js/map-setup.js), introduced monotonic sequence IDs. When `stopIntroAnimation()` or a new `playIntroAnimation()` runs, previous sequences and timeouts are instantly invalidated and aborted.
  2. **Safe Bounds Clamping Failsafe (`isCoordInStationBounds`):** In [js/map-setup.js](js/map-setup.js), `map.setMaxBounds()` is strictly guarded: bounds are NEVER applied unless `isCoordInStationBounds(map.getCenter(), stationId)` is true. During transitions and intro animations, bounds remain `null` to guarantee zero camera clamping.
  3. **Multi-Timer Cancellation & Unconditional Layer Isolation:** In [js/stations.js](js/stations.js), added `activeStationSwitchTimer`, `activeCurtainDismissTimer`, and `activeStationSwitchSafetyTimer`. Any new switch immediately halts prior sequences, resets bounds, unmounts all markers, and enforces strict mutual exclusion: QARES mask is 100% forced `none` at LARES, and LARES mask is 100% forced `none` at QARES.
  4. **Mapbox 3D Mode Layer Hydration:** Automatically verifies and initializes Mapbox Standard building layers via `setupMapboxStandardLayers()` if switching to LARES in Mapbox mode.
  5. **Verification:** Verified across an automated 8-phase CDP test ([tools/tests/test_location_and_map_switching.py](tools/tests/test_location_and_map_switching.py)) covering cold start, bidirectional switching, Mapbox $\leftrightarrow$ Aerial Drone switching, and rapid 5-switch stress tests. Zero darkness detected across all permutations.
- **Cachebuster:** Bumped `app.js?v=120` in [index.html](index.html).

### 2.9g Plot Zone Selection Camera Lock & Building Orbit Collision Fix — ✅ Complete
- **Bug Breakdown:** When browsing facilities in the left directory search and selecting an agricultural zone (e.g. *Cassava Production* / `zone_cassava_production`), the right details drawer correctly opened, but the 3D map camera remained locked at the previously inspected building (e.g. *R&D Multipurpose Building*), Pin 14 stayed active with its HUD label visible, and the camera failed to glide to the Cassava field plots.
- **Root Cause Analysis:**
  1. *Uninterrupted Orbit Animation Loop:* When inspecting a 3D building, `orbitBuilding()` initiates an animation frame loop (`orbitStep` in [js/idle.js](js/idle.js)) calling `map.setBearing(map.getBearing() + step)` every 16ms. In Mapbox GL JS, any synchronous call to `setBearing()` instantly aborts any in-flight `map.flyTo()` or `map.fitBounds()` transition! Because `selectPlotZone()` never called `stopOrbit()`, the active building orbit aborted the camera flight on frame 1.
  2. *Undecluttered Building Markers:* `selectPlotZone()` never stripped `.active`, `.decluttered-highlight`, or `.decluttered-dest` from `.bldg-map-marker`, leaving the previous building marker highlighted with its active HUD badge.
  3. *Unpadded Viewport Framing:* `selectPlotZone()` did not compute viewport padding for desktop/kiosk (380px left sidebar + 400px right drawer), nor did it use `turf.bbox` to frame multi-hectare agricultural field boundaries.
  4. *Missing Routing Fallback:* In [js/routing.js](js/routing.js), `computeRouteFromKiosk()` returned early with a dummy zero-distance route if the target ID was an agricultural commodity zone instead of a standard building.
- **Fixes Applied:**
  1. **Comprehensive Orbit & Navigation Termination:** In [js/plot-layers.js](js/plot-layers.js), `selectPlotZone()` and `zoomToSubPlot()` now call `stopOrbit()`, `stopIdleRotation()`, `resetIdle()`, and `clearRoute()`.
  2. **Full Marker & UI Cleanup:** `selectPlotZone()` removes `.active` and decluttering classes from all `.bldg-map-marker` elements, closes open marker popups, removes active classes from `.dir-item`, and sets active styling on the clicked plot directory item.
  3. **Viewport-Aware Camera Framing (`fitBounds` & `flyTo`):** Integrated Turf bounding box calculation `turf.bbox(turf.polygon([zone.groupPolygon]))` with responsive padding (`{ top: 70, bottom: 70, left: 390, right: 410 }` on desktop) so that selecting any agricultural zone fits the entire field plot into the viewing corridor between the sidebar and details drawer.
  4. **Bidirectional State Synchronization:** Updated [js/walker.js](js/walker.js) `navigateTo()` and [js/building-panel.js](js/building-panel.js) `showBuildingPanel()` to call `deselectPlotZone()` and `clearSubPlotHighlight()`, guaranteeing clean transitions between buildings and agricultural zones in both directions.
  5. **Routing Support for Plot Zones:** Updated [js/routing.js](js/routing.js) `computeRouteFromKiosk()` to route to `zone.centerCoords`.
  6. **Cachebuster:** Bumped to `v=139` in [index.html](index.html).

### 2.9j Screenhouses Dynamic Hero Image Swap (Alternative 1) — ✅ Complete
- **Feature Overview:** Implemented Alternative 1 (Dynamic Hero Image Swap with Multi-Photo Views) for screenhouses in Plot 17 (*TC Makapuno & Banana Screenhouse*) and Plot 18 (*Coffee & Citrus Screenhouse*).
- **Core Capabilities:**
  1. **Master Zone Establishing Shot:** Opening Plot 17 or Plot 18 immediately displays a web-optimized wide compound establishing shot (`images/zone_tc_makapuno_screenhouse.jpg` / `images/zone_coffee_citrus_screenhouse.jpg`) with an overlay badge: `🏡 TC Makapuno & Banana Screenhouse (Overview)`.
  2. **Sub-Plot Dynamic Image Swap:** Tapping any sub-plot button (e.g. *Screenhouse 1: Hydroponics & NFT Propagation*):
     - The drawer's hero image smoothly cross-fades to Screenhouse 1's authentic photo (`images/plot17_screenhouse_1.jpg`).
     - A sleek glassmorphic overlay badge updates to `📍 Screenhouse 1: Hydroponics & NFT Propagation` with a cyan pulse dot.
     - A photo views switcher bar (`.bp-image-views-bar`) appears with quick-toggle chips: `[📷 Exterior Front]`, `[🌱 NFT Hydroponics]`, `[📐 Left Flank]`.
     - Tapping any view chip smoothly cross-fades the photo and updates the lightbox caption.
  3. **Multi-Photo Lightbox Integration:** Tapping the photo or the `🔍 Enlarge` hint opens the full-screen photo lightbox modal (`openPhotoLightbox`).
  4. **Smart Toggle-Off Reversion:** Tapping the active sub-plot button again smoothly restores the Master Zone establishing overview shot.
  5. **Web-Optimized Image Assets:** Converted and optimized 17 high-resolution ground-truth photographs from `Building Images/Screenhouses/` to 1280px web-ready JPEGs (200KB–350KB each) in `images/`.
- **Files Modified:**
  - [js/data/plots.js](js/data/plots.js): Registered `image` and `images` arrays for `zone_tc_makapuno_screenhouse`, `zone_coffee_citrus_screenhouse`, and all 9 individual screenhouses.
  - [js/building-panel.js](js/building-panel.js): Added unified `setDrawerHeroImage()`, `switchHeroView()`, `setDrawerHeroSubPlot()`, and `restoreDrawerHeroMaster()`.
  - [js/plot-layers.js](js/plot-layers.js): Integrated hero swap into `highlightSubPlot()` and `clearSubPlotHighlight()`.
  - [index.html](index.html): Added `.bp-image-wrapper`, `.bp-image-overlay-vignette`, `.bp-image-badge`, `.bp-image-expand-hint`, and `.bp-image-views-bar`. Bumped cachebuster to `v=145`.
  - [css/main.css](css/main.css): Added styling for hero wrapper, glassmorphic badge, expand hint, and view chips. Pruned 8,998 redundant blank lines (-47.9%).

### 2.9k Phase 2: Screenhouse 2 (`plot17_screenhouse_2`) — ✅ Complete
- **Feature Overview:** Modeled, textured, exported, registered, and verified **Screenhouse 2 (Plot 17)** as part of the DA-LARES screenhouse modernization roadmap.
- **Model Details:**
  - File: [models/plot17_screenhouse_2.glb](models/plot17_screenhouse_2.glb) (**$265.4\text{ KB}$**, strictly under the $300\text{ KB}$ budget).
  - Geometry: $6.22\text{ m} \times 18.78\text{ m}$, two-tier concrete curb plinth, 11 hoop arch trusses, longitudinal purlins, front spider-web gable with inner arch truss, commercial sliding screen door.
  - Interior Nursery: Central weed barrier walkway, two raised seedling hardening propagation benches with wire mesh tops, rows of black nursery polybag pots, lush Makapuno coconut seedling foliage, and blue PVC irrigation piping.
  - Alignment: Calibrated true survey centroid `[121.16733397, 13.95909642]`, Mapbox rotation $69.8^\circ$ (front entrance door facing WSW toward compound walkway).
  - Entrance & Routing: `roads.json` entrance node `entrance_36` (`[121.167258, 13.959074]`) connected via dedicated walkway `road_walkway_sh2` to `road_21`.
  - Sub-Plot Integration: Registered in `CUSTOM_3D_BUILDINGS` with `isSubPlot: true, hasMarker: false` (zero individual floating pin clutter, navigates via Plot 17 drawer sub-plot button and 3D mesh click).
  - Dynamic Hero Integration: Connected to `images/plot17_screenhouse_2.jpg` (exterior) and `images/plot17_screenhouse_2_inside.jpg` (seedling nursery).

### 2.9l Phase 3: Screenhouse 3 (`plot17_screenhouse_3`) — ✅ Complete
- **Feature Overview:** Modeled, textured, exported, registered, and verified **Screenhouse 3 (Plot 17)**.
- **Model Details:**
  - File: [models/plot17_screenhouse_3.glb](models/plot17_screenhouse_3.glb) (**$247.5\text{ KB}$**, strictly under $300\text{ KB}$ budget).
  - Geometry: $6.16\text{ m} \times 18.61\text{ m}$, two-tier concrete curb plinth, 11 oxide-red hoop arch trusses, signature radial sunburst spokes on front entrance gable.
  - Utility Block: Solid concrete entrance room ($2.45\text{ m} \times 2.50\text{ m}$) on right-front corner with wooden plank door, open aluminum screen door, corrugated sheet roof with white monobloc chair, and purple jerrycan on front curb.
  - Alignment: Centroid `[121.16735615, 13.95903957]`, Mapbox rotation $69.8^\circ$.
  - Entrance & Routing: `roads.json` entrance node `entrance_37` (`[121.167262, 13.959005]`) connected via `road_walkway_sh3` to `road_21`.

### 2.9m Phase 4: Screenhouse 4 (`plot17_screenhouse_4`) — ✅ Complete
- **Feature Overview:** Modeled, textured, exported, registered, and verified **Screenhouse 4 (Plot 17)**.
- **Model Details:**
  - File: [models/plot17_screenhouse_4.glb](models/plot17_screenhouse_4.glb) (**$229.1\text{ KB}$**, strictly under $300\text{ KB}$ budget).
  - Geometry: $8.62\text{ m} \times 18.72\text{ m}$, two-tier concrete curb plinth with iconic continuous painted red stripe along lower step apron, 11 hoop arch trusses, heavy-duty black agricultural shade netting enclosure.
  - Doorway & Interior: Right-side entrance doorway with wooden door and eave canopy hood, dual propagation tables, polybag containers, tropical plantlets, and iconic bright blue 55-gallon HDPE water drum in center aisle.
  - Alignment: Calibrated true survey centroid `[121.16738144, 13.95897382]`, Mapbox rotation $69.8^\circ$.
  - Entrance & Routing: `roads.json` entrance node `entrance_38` (`[121.167305, 13.958918]`) connected via `road_walkway_sh4`.

### 2.9n Phase 5: Screenhouse 5 (`plot17_screenhouse_5`) — ✅ Complete
- **Feature Overview:** Modeled, textured, exported, registered, and verified **Screenhouse 5 (Plot 17)** — Nursery Shade House & Seedling Production.
- **Model Details:**
  - File: [models/plot17_screenhouse_5.glb](models/plot17_screenhouse_5.glb) (**$148.5\text{ KB}$**, 152,056 bytes, ultra-clean and well within $300\text{ KB}$ budget).
  - Geometry: $18.00\text{ m} \times 18.06\text{ m}$ (area $325.1\text{ m}^2$) conforming to survey polygon #34. Continuous perimeter concrete curb plinth ($Z = 0.40\text{ m}$), 5x5 grid (25 posts) of round galvanized tubular columns ($Z = 3.20\text{ m}$), welded perimeter & internal lintel beams, diagonal corner knee braces, structural high-tensile roof cable tension grid ($Z_{RIDGE} = 3.65\text{ m}$), full black shade netting enclosure.
  - Entrance: Northwest corner entrance door ($1.40\text{ m} \times 2.20\text{ m}$) with aluminum screen frame and outward swing leaf facing North into the alleyway between Screenhouse 4 and 5.
  - Interior: Central cruciform gravel walkways, four quadrant growing zones with rows of black nursery polybags and tropical saplings/fronds, and overhead central irrigation misting lines.
  - Alignment: Centroid `[121.16741435, 13.95882594]`, Mapbox rotation $69.8^\circ$.
  - Entrance & Routing: `roads.json` entrance node `entrance_39` (`[121.167310, 13.958894]`) connected via `road_walkway_sh5`.
  - Next Active Step: **Phase 6: Plot 18 Research Greenhouse Complex (`plot18_greenhouse_complex`, Bays 6, 7, 8)**.

---

## 3. 🎯 Completed Facility Status: Automated Weather Station (`automated_weather_station`) — ✅ COMPLETE

The authentic 3D architectural model for the Automated Weather Station has been successfully built, textured, exported, and registered:

- **Facility Name:** Automated Weather Station
- **Campus Station:** **DA-LARES** (Lipa City, Batangas)
- **ID Name:** `automated_weather_station`
- **Model Output Target:** [models/automated_weather_station.glb](models/automated_weather_station.glb) (**$269.96\text{ KB}$**, strictly under the $300\text{ KB}$ budget per Rule 2)
- **Registration:**
  - `CUSTOM_3D_BUILDINGS` in [js/data/buildings.js](js/data/buildings.js)
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
| **DA-QARES** (Tiaong, Quezon) | `qares_buildings.json`, `qares_roads.json`, `qares_boundary.json`, `qares_pin.json`, `qares_ortho.png`, `QARES v1.mbtiles` | `qares_draw.html`, `qares_road_draw.html`, `qares_boundary_draw.html` (also QARES mode inside `draw.html`) |

- Station registry: [js/data/stations.js](../js/data/stations.js)
- Switching / QARES layers / directory / category filter: [js/stations.js](../js/stations.js)
- Save endpoints with timestamped backups (`archive/backups/`): `/api/qares/buildings`, `/api/qares/roads`, `/api/qares/boundary` in [server.js](../server.js)
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

- [x] **Task 2.1:** Fix QARES 3D buildings toggle desynchronization (`#layer-buildings-toggle`, `#msp-toggle-buildings`, `#chip-buildings`). Fully synced across both stations.
- [x] **Task 2.2:** Full-stack kiosk performance & lag optimization pass (DOM marker viewport frustum virtualization with 12% buffer padding, rAF throttled camera/coordinate listeners, WebGL DPR clamping, and capped MBTiles LRU cache).
- [x] **Task 2.3:** Fix station origin in `js/routing.js` (station-aware kiosk origin `STATIONS.qares.kioskCoords` and `qaresRoadGraph` completely eliminating 21,537m cross-province route calculation bug).
- [x] **Task 2.4:** Integrate `QARES Boundaries.geojson` (Front & Flint parcels) into `qares_boundary.json` using authentic 18-vertex deeded survey geometry.
- [x] **Task 2.5:** Add authentic boundary glow/casing (Option A) and PNR railway corridor divider line (`#0f172a` casing + `#94a3b8` dashed centerline) for QARES compound.
- [x] **Task 2.6:** Add Automated Weather Station to entrance node dropdown in `road_draw.html` / `draw.html`, with dedicated gate entrance node and walkway connected to `road_40` in `roads.json` (34/34 LARES entrances reachable).
- [x] **MIS-RAFIS Building** confirmed complete (`models/mis_rafis_building.glb`, 109.9 KB, verified in AGENTS.md matrix).
- [x] **Transition Curtain & Station Switch Freeze Fully Resolved:** 
  - **Root Cause 1 (8-Second Thread Lock):** `buildRoadGraph()` in [js/routing.js](js/routing.js) broke roads into 1m chunks (5,250 chunks) and used an $O(N^2)$ brute-force array scan with `turf.distance`. For ~5,000 nodes, it computed $\sim 13,000,000$ geodesic distance calculations synchronously on the UI thread, freezing the browser. Implemented a 5-meter Spatial Hash Grid reducing graph build time from 7,891ms down to 255ms (30x speedup), and cached `state.qaresRoadGraph` so subsequent switches take 0ms.
  - **Root Cause 2 (Mapbox Bounds Clamping):** LARES bounds restricted coordinates to Lipa City (`121.185` max). QARES is at `121.371`. Calling `map.setMaxBounds(null)` synchronously before teleport prevents Mapbox from clamping camera coordinates or throwing bounds errors.
  - **Root Cause 3 (Intro Animation Restored):** The cinematic intro fly-in was previously bypassed. Restored signature two-phase camera animation: behind the curtain the camera positions at `introViews.start` (high top-down birds-eye view) with bounds relaxed across Batangas & Quezon (`[[120.40, 13.30], [122.80, 15.00]]`). As the curtain lifts at 380ms, `playIntroAnimation(null, true)` plays seamlessly: Phase 1 zooms in to the station's "You Are Here" pin in 2D, and Phase 2 tilts up into the station's signature 3D perspective angle (pitch ~52°, bearing 25° for QARES / 165° for LARES).
  - **Root Cause 4 (Deterministic Curtain Dismissal):** Curtain is guaranteed to dismiss within 260ms + 120ms with a 600ms hard safety failsafe and click-to-dismiss bypass.
- [x] **Task 2.7: DA-LARES Agricultural Field Plots & Commodity Zones Enhancement — ✅ Complete:**
  - **45 Sub-Plots Grouped into 22 Commodity Zones:** All 45 field plots grouped into 22 unified commodity zones with single outer boundary casings and zero middle divider lines on overview.
  - **Dynamic Internal Cuts & Interactive Drawer:** Selecting a zone illuminates internal sub-plot dashed cuts, zooms to fit with 22° pitch, and opens the detail drawer showing estimated land area ($m^2$ and ha), sub-plot count, research details, and clickable sub-plot chips.
  - **Dedicated Settings Switch:** Added "Agricultural Plots" boolean switch under Map Settings (Perimeter Boundaries section) to toggle plot highlighting.
  - **Marker Alignment & Zero Teleportation:** Removed `position: relative !important;` from `.plot-map-marker.collapsed`, enforcing `position: absolute !important; top: 0; left: 0;`. Eliminated 600px cumulative DOM flow displacement, seating all 22 badges with $0\text{ px}$ error directly on their plots with zero hover jitter.
- [x] **Task 2.8: Legacy 2D Billboard Tree & Tile Cleanup — ✅ Complete:**
  - **Deleted `tree.png`:** Completely removed dead 2D billboard sprite `tree.png` and pruned unused `ensureTreeIconLoaded()` and `renderTreesLayer()` from [js/map-setup.js](js/map-setup.js). Trees in 3D mode use GLTF models (`models/tree_mango.glb`, etc.).
  - **PWA Manifest Icons Fixed:** Created authentic $192\times 192$ and $512\times 512$ DASH emblems in `icons/` and updated [manifest.json](manifest.json), eliminating Chrome manifest icon errors.
  - **MBTiles 404 Suppression:** Updated [server.js](server.js) to serve a cached $1\times 1$ transparent PNG with HTTP 200 for out-of-bounds tiles, permanently stopping red 404 network console spam.
  - **Cachebuster Bumped:** Updated to `css/main.css?v=127` and `js/app.js?v=127` in [index.html](index.html).
- [x] **Task 2.9: DA-LARES Plots 17 & 18 Screenhouses 3D Modeling (Phase 1: Screenhouse 1) — ✅ Complete:**
  - Created official engineering roadmap: [docs/screenhouses_3d_modeling_plan.md](docs/screenhouses_3d_modeling_plan.md) covering the 7-phase modeling plan.
  - Modeled and exported authentic bespoke 3D model [models/plot17_screenhouse_1.glb](models/plot17_screenhouse_1.glb) ($262.8\text{ KB}$, strictly within the $300\text{ KB}$ performance budget).
  - Authentic ground-truth architectural features: two-tier concrete plinth with entrance steps, perimeter horizontal eave beam, semicircular hoop trusses with king struts and purlins, inner concentric arch gable truss with radial struts, sliding aluminum screen door with handle & latch, semi-translucent white agricultural insect mesh, horizontal black ceiling shade cloth, and interior NFT hydroponic propagation benches with blue PVC manifold & supply risers.
  - Registered across [buildings.json](buildings.json), [js/data/buildings.js](js/data/buildings.js), [js/data/descriptions.js](js/data/descriptions.js), and [roads.json](roads.json) (`entrance_35` + `road_walkway_sh1`).
- [x] **Task 2.9b: Master Commodity Zone & Sub-Plot Hierarchy Integration (Plots 17 & 18) — ✅ Complete:**
  - **Hierarchy Established:**
    - **Plot 17 Zone:** **TC Makapuno & Banana Screenhouse** (`zone_tc_makapuno_screenhouse`) configured with **5 Sub-Plots**: Screenhouses 1, 2, 3, 4, 5.
    - **Plot 18 Zone:** **Coffee & Citrus Screenhouse** (`zone_coffee_citrus_screenhouse`) configured with **4 Sub-Plots**: Screenhouse Bays 6, 7, 8, and Screenhouse 9 (& Potting Headhouse).
  - **Data & UI Updates:**
    - [js/data/plots.js](js/data/plots.js): Updated `FIELD_COMMODITY_ZONES` and `ZONE_POLYGONS` for Plot 17 and Plot 18 with accurate `plotCount`, `plotRange`, authentic building polygons from `buildings.json`, coordinates, and descriptive metadata.
    - [js/building-panel.js](js/building-panel.js): Updated drawer sub-plot renderer to display `sp.label` cleanly (e.g. `Screenhouse 1: Hydroponics & NFT Propagation`), with click-to-zoom passing coordinates and 3D building IDs.
    - [js/plot-layers.js](js/plot-layers.js): Enhanced `zoomToSubPlot(target, centerCoords, buildingId)` to smoothly zoom to screenhouses or focus the 3D model.
    - Cachebusters updated to `plots.js?v=84` and `app.js?v=134`.
- [x] **Task 2.9c: Draw Tool Footprint Archival & Phantom Button Cleanup — ✅ Complete:**
  - **Archived Polygons:** Extracted and safely stored the authentic survey footprints for Screenhouses 2 through 9 into [tools/build_scripts/screenhouses_survey_polygons.json](tools/build_scripts/screenhouses_survey_polygons.json).
  - **Phantom Buttons Removed:** Pruned the 7 placeholder `admin_building` polygons (features 31 to 37) created by tracing in `draw.html` from both [buildings.json](buildings.json) and `LARES_DRAWINGS` in [js/data/buildings.js](js/data/buildings.js).
  - **Result:** Successfully eliminated map buttons (32) through (38) labeled "Admin Building" and restored `BUILDING_DIRECTORY` to active campus facilities.
- [x] **Task 2.9d: Screenhouse Pin Clutter Elimination & Pure Sub-Plot Navigation — ✅ Complete:**
  - **Decision:** As confirmed by the user, screenhouses do not receive individual floating map pins (e.g. `(31) Plot 17 Screenhouse 1`). Instead, navigation and discovery are based entirely on the **Sub-Plots list** inside the Master Plot Zone drawer.
  - **Implementation:**
    - [js/markers.js](js/markers.js): Filtered out sub-plot screenhouse IDs (`plot17_screenhouse_*`, `plot18_screenhouse_*`) from generating numbered floating badges. Map pins terminate cleanly at landmark Pin 30 (`automated_weather_station`).
    - [js/sidebar.js](js/sidebar.js): Screenhouses are excluded from the standalone buildings list to avoid duplicate listings; searching for any screenhouse keyword ("Hydroponics", "NFT", "Screenhouse 1", "Banana") routes directly to its parent commodity zone.
    - [js/data/buildings.js](js/data/buildings.js): Tagged screenhouse building directory entries with `isSubPlot: true` and `hasMarker: false`.
    - **Result:** Keeps the Plot 17 and Plot 18 satellite and 3D views completely uncluttered while maintaining full Three.js 3D model rendering and interactive deep zoom from the Sub-Plot chips.
    - Cachebuster bumped to `app.js?v=136`.
- [x] **Task 2.9e: Permanent Bottom Anchoring of Mapbox Watermark & Scale Controls — ✅ Complete:**
  - **Issue:** In portrait kiosk mode, `.mapboxgl-ctrl-bottom-left` (Mapbox watermark logo) and `.mapboxgl-ctrl-bottom-right` (meters scale bar and attribution) were dynamically lifted up to `calc(var(--portrait-panel-height) + 36px)` or `76px`, floating in the middle of the screen over buildings and roads when the menu was collapsed.
  - **Fix:** In [css/main.css](css/main.css), eliminated variable lifting calculations and permanently anchored `.mapboxgl-ctrl-bottom-left` and `.mapboxgl-ctrl-bottom-right` directly at the bottom edge (`bottom: calc(8px + env(safe-area-inset-bottom, 0px)) !important;`) across all states (open sidebar, collapsed sidebar, active building panel, overview, portrait, landscape) with `transition: none !important;`. The watermark and scale bar now permanently stay at the very bottom edge.
  - Cachebusters bumped to `css/main.css?v=140` and `js/app.js?v=140`.
- [x] **Task 2.9f: Dynamic Spotlight HUD Badge & Selection Glow for Sub-Plots — ✅ Complete:**
  - **Feature Implementation:** Tapping any Sub-Plot button in the Plot Zone drawer (e.g. *Screenhouse 1: Hydroponics & NFT Propagation*) dynamically:
    1. **Floating Spotlight HUD Beacon:** Drops a glassmorphic HUD badge directly above the selected roof (`📍 Screenhouse 1`, with subtitle and downward glowing stem) and pulses a radar ripple ring on the ground plane at its foundation.
    2. **Ground Footprint Glow:** Illuminates the exact survey polygon of the active screenhouse in neon cyan (`#38bdf8`) with high-tech casing (`plots-active-subplot-glow` & `plots-active-subplot-casing`).
    3. **Active Drawer Chip State:** Highlights the tapped chip in the drawer with glowing border, pulse dot, and translateX slide.
    4. **Camera Glide:** Glides smoothly to the selected building at $45^\circ$ perspective pitch ($19.8$ zoom).
    5. **Clean Dismissal:** When deselecting the zone or closing the drawer, the spotlight badge and footprint glow vanish cleanly.
- [x] **Task 2.9h: Building & Plot Zone Details Panel Widened (420px) — ✅ Complete:**
  - **Enhancement:** Increased the desktop `.building-panel` width from $350\text{ px}$ to **$420\text{ px}$** (`max-width: calc(100vw - 32px);`, closed offset `right: -480px;`).
  - **Result:** Provides $+70\text{ px}$ of comfortable horizontal breathing room. Long commodity titles ("TC Makapuno & Banana Screenhouse"), sub-plot names ("Screenhouse 2: Makapuno Hardening & Seedling Propagation"), and multi-plot metrics no longer wrap onto awkward orphaned lines.
- [x] **Task 2.9i: Sub-Plot Cross-Zone Resolution Collision & Toggle Fix — ✅ Complete:**
  - **Issue:** Tapping *Screenhouse 1: Hydroponics & NFT Propagation* in the Plot 17 drawer erroneously generated a spotlight HUD badge titled `📍 Plot 1 - Industrial Starch Cassava` and caused chip selection and camera misalignment.
  - **Root Cause:** In `js/plot-layers.js`, `zoomToSubPlot()` iterated across all commodity zones from index 0 (`zone_cassava_production`) with a loose lookup condition `(buildingId && sp.buildingId === buildingId) || (sp.plotNum == plotNum)`. Because Cassava Plot 1 and Screenhouse 1 both have `plotNum: 1`, the OR condition short-circuited on Cassava, returning Cassava Plot 1 instead of Screenhouse 1.
  - **Fix Applied:**
    1. **Strict Hierarchical Scope:** Updated `zoomToSubPlot(plotNum, centerCoords, buildingId, zoneId)` and `js/building-panel.js` to pass `zone.id` and prioritize matching within the currently open parent zone.
    2. **Strict Building ID Matching:** When `buildingId` is present (e.g. `plot17_screenhouse_1`), it searches strictly by `buildingId` without falling back to generic `plotNum` across unrelated zones.
    3. **Chip Scoping:** In `highlightSubPlot()`, `.sub-plot-chip` active state matches strictly on `buildingId` or `(plotNum && zoneId)`.
    4. **Smart Toggle Support:** Tapping an already selected sub-plot chip now cleanly toggles it off and smoothly frames back out to the parent zone overview.
  - Cachebusters bumped to `css/main.css?v=142` and `js/app.js?v=142`.
- [x] **Task 2.9j: Plot 17 Screenhouse 2 3D Modeling (Phase 2) — ✅ Complete:**
  - Modeled and exported authentic bespoke 3D model [models/plot17_screenhouse_2.glb](models/plot17_screenhouse_2.glb) ($265.4\text{ KB}$, strictly within $300\text{ KB}$ budget).
  - Ground-truth architectural features: 2-tier concrete foundation plinth, 11 structural hoop arch trusses, spider-web front arch truss, sliding aluminum screen door, semi-translucent white insect mesh, ceiling shade cloth, and authentic nursery interior with raised benches, polybag pots, Makapuno coconut palm fronds, and blue PVC irrigation headers.
  - Registered across `buildings.json`, `js/data/buildings.js`, `js/data/descriptions.js`, and `roads.json` (`entrance_36` + `road_walkway_sh2`).
- [x] **Task 2.9l: Plot 17 Screenhouse 4 3D Modeling (Phase 4) — ✅ Complete:**
  - Modeled and exported authentic bespoke 3D model [models/plot17_screenhouse_4.glb](models/plot17_screenhouse_4.glb) ($229.1\text{ KB}$, strictly within $300\text{ KB}$ budget).
  - Ground-truth architectural features: 11 structural semicircular hoop trusses painted oxide red / maroon ($Z = 2.10\text{-}4.10\text{ m}$), front entrance gable web with inner concentric arch and 8 radial sunburst spoke pipes, right-side entrance doorway ($X = 2.50\text{ to } 3.80\text{ m}$) with solid timber jambs, wooden plank door leaf, and corrugated sheet canopy hood, two-tier concrete foundation plinth with iconic continuous **painted red horizontal stripe** along lower footing step apron, heavy-duty black agricultural shade netting enclosure over barrel roof curve, flanks, rear, front gable, and horizontal interior ceiling at eave level; authentic interior with central weed-barrier walkway mat, dual galvanized steel seedling propagation tables, rows of nursery polybag plantlet containers, tropical foliage sprouts, and iconic **bright blue 55-gallon HDPE water drum** in center aisle; overhead irrigation misting line.
  - Registered across `buildings.json`, `js/data/buildings.js`, `js/data/descriptions.js`, and `roads.json` (`entrance_38` at `[121.167286, 13.958918]` + `road_walkway_sh4`).
  - Cachebusters bumped to `v=147` in `index.html`.
- [x] **Task 2.9m: Plot 17 Screenhouse 5 3D Modeling (Phase 5) — ✅ Complete:**
  - Facility: Screenhouse 5 (`plot17_screenhouse_5`) — Nursery Post-and-Lintel Shade House ($18.00\text{ m} \times 18.06\text{ m}$, area $325.1\text{ m}^2$, angle $159.5^\circ$, centroid `[121.16741435, 13.95882594]`).
  - Architecture: Square post-and-lintel galvanized steel pipe shade nursery facility ($18.00\text{ m} \times 18.06\text{ m}$); 5x5 grid of round galvanized steel tubular columns with welded perimeter/internal lintel beams; high-tensile roof cable tension grid; full black agricultural shade netting; northwest corner screen door; interior cruciform gravel walkways and four quadrant growing zones with polybags and tropical saplings; misting lines. Model file: `models/plot17_screenhouse_5.glb` ($148.5\text{ KB}$).
- [x] **Task 2.9n: Plot 18 Research Greenhouse Complex 3D Modeling (Phase 6: Bays 6, 7, 8) — ✅ Complete:**
  - Facility: Plot 18 Research Greenhouse Complex (`plot18_greenhouse_complex`) — Contiguous 3-bay research greenhouse complex containing Screenhouses 6, 7, and 8 ($24.85\text{ m} \times 32.80\text{ m}$, area $815.1\text{ m}^2$, angle $339.5^\circ$, centroid `[121.16761281, 13.95902581]`).
  - Architecture:
    - **Bay 6 (West):** Pointed gothic arch tunnel ($Z_{APEX} = 4.85\text{ m}$, $Z_{EAVE} = 2.40\text{ m}$), heavy-duty black agricultural shade cloth enclosure, high square ventilation louver box with horizontal blades, front concrete entrance vestibule ($1.70\text{ m} \times 1.50\text{ m}$) with door & step, and interior clonal coffee nursery tables.
    - **Bay 7 (Center):** Curved circular steel arch truss bay ($Z_{APEX} = 4.70\text{ m}$, $Z_{EAVE} = 2.40\text{ m}$), continuous diagonal zigzag web lacing, front arch gable shade netting, high square louver box, concrete entrance booth, and 12 interior nursery polybag blocks of certified citrus rootstocks.
    - **Bay 8 (East):** Open-air curved circular steel arch truss propagation bay ($Z_{APEX} = 4.70\text{ m}$), front gable circular fan shroud & frame, low galvanized wire mesh flank skirt, ground propagation beds with scion foliage, and authentic iconic props: blue HDPE 55-gallon water drum barrel, grey nursery barrel, and white monobloc plastic chair.
    - **Valley Gutters:** Continuous galvanized steel U-channels along $X = -4.142\text{ m}$ and $X = +4.142\text{ m}$.
  - Model file: `models/plot18_greenhouse_complex.glb` ($268.89\text{ KB}$, strictly within $300\text{ KB}$ budget).
  - Registrations: `buildings.json`, `js/data/buildings.js`, `roads.json` (`entrance_40` + `road_walkway_gh_complex`), `js/data/descriptions.js`, and `index.html` (cachebusters bumped to `v=151`).
- [x] **Task 2.9p: Details Drawer Dead "White Space" & Placeholder Elimination on Open Plots — ✅ Complete:**
  - **Issue:** Opening standard field plots or orchards (e.g. Plot 19 Pummelo Orchard, Cassava, Rice, Corn, Mango) displayed a 136px empty placeholder box reading `🍈 Pummelo Orchard (Overview) (No Photo)` directly under the header, pushing down wayfinding cards and leaving dead space.
  - **Root Cause:** In Task 2.9j, `restoreDrawerHeroMaster(zone)` fell back to `images/${zone.id}.jpg` for all plots. Because open field plots have no facility photography (`!zone.image`), this triggered `onerror`, which displayed `.bp-image-placeholder` (`display: flex`).
  - **Fix Applied:**
    - Updated `js/building-panel.js` `showPlotPanel()`, `setDrawerHeroImage()`, `setDrawerHeroSubPlot()`, and `restoreDrawerHeroMaster()`: if a plot zone does not have an authentic photo (`!zone.image`), `#bp-image-area` and `.bp-image-placeholder` are set to `display: none` completely.
    - Preserved authentic photo rendering for Plot 17 and Plot 18 screenhouses (`zone.image`), sub-plot photo swaps, and all 3D physical buildings (`#bp-image-area` reset to `display: block` in `showBuildingPanel()`).
    - Cachebusters bumped to `v=152` in `index.html`, `js/app.js`, `js/plot-layers.js`, `js/idle.js`, and `js/routing.js`.
- [x] **Task 2.9q: Suppression of Erroneous Building Pin #31 Over Plot 18 Greenhouse Complex — ✅ Complete:**
  - **Issue:** A floating numbered building button/pin `(31) Plot 18 Research Greenhouse Complex` was erroneously generated directly over the 3D model of Plot 18.
  - **Root Cause:** When `plot18_greenhouse_complex` was registered in `js/data/buildings.js`, line 1751 checked `id.startsWith('plot17_screenhouse') || id.startsWith('plot18_screenhouse')`. Because `plot18_greenhouse_complex` contains `_greenhouse_` instead of `_screenhouse_`, `isSubPlot` evaluated to `false`, causing `markers.js` to assign it building marker number 31 and render a floating pin, violating Rule 8 (Plot 18 screenhouses are sub-plots of the Coffee & Citrus Screenhouse zone, not standalone buildings).
  - **Fix Applied:**
    - Updated [js/data/buildings.js](js/data/buildings.js), [js/markers.js](js/markers.js), [js/sidebar.js](js/sidebar.js), and [js/phone-ui.js](js/phone-ui.js) to filter by `id.startsWith('plot17_') || id.startsWith('plot18_')`.
    - `plot18_greenhouse_complex` is now correctly classified as `isSubPlot: true`, suppressing the extraneous floating button pin so Plot 18 is accessed exclusively via the master zone marker (**☕ Coffee & Citrus Screenhouse**) and its drawer sub-plots list.
    - Cachebusters bumped to `v=153` in `index.html` and `v=75` for `buildings.js`.
- [x] **Task 2.9o: Plot 18 Screenhouse 9 & Potting Headhouse 3D Modeling (Phase 7) — ✅ Complete:**
  - **Facility:** Screenhouse 9 & Potting Headhouse (`plot18_screenhouse_9`) — Sub-Plot 9 of **Coffee & Citrus Screenhouse** (`zone_coffee_citrus_screenhouse`, Plot 18).
  - **Reference Images:** Ground-truth photos provided by user (`IMG_4185` front gate, `IMG_4186` interior covered workspace, `9 Front View.jpg`, and aerial drone top view).
  - **Architecture ($21.58\text{ m} \times 7.42\text{ m}$, area $140.4\text{ m}^2$):**
    - **North Potting Headhouse:** Corrugated hip roof with painted red hip rake trim; corrugated iron side walls; front entrance with open central gateway and double-leaf steel wire mesh swing gate (`IMG_4185`); structural steel angle roof trusses; enclosed concrete utility room with door and security-grilled window; attached white-tiled concrete wash counter & sink with faucet (`IMG_4186`); work table and white chair.
    - **Small House Inside Trellis (NW Corner):** Concrete masonry booth with door opening east onto central aisle; authentic rusty-red corrugated sheet roof with square raised ventilation hatch matching aerial drone top view.
    - **South Hoop Trellis Nursery:** Concrete perimeter curb plinth ($Z = 0.40\text{ m}$); semi-translucent wire mesh perimeter fencing; 8 tubular steel hoop arch frames; central walkway aisle; dual columns of raised propagation benches with dark polybags and green foliage; elevated white HDPE water drum on stand and pump base on west flank.
  - **Performance & Optimization:** Model size is **$135.04\text{ KB}$** (well within $\le 300\text{ KB}$ budget). Joined meshes by material and reduced radial segments to 8 vertices.
  - **Mapbox & Campus Registration:**
    - Model registered in `CUSTOM_3D_BUILDINGS` at `[121.16773388, 13.95925730]`, rotation $339.1^\circ$ (NNW facing compound road, parallel with Greenhouse Complex at $339.5^\circ$), cachebuster `?v=1`.
    - GeoJSON feature added to [buildings.json](buildings.json) and `LARES_DRAWINGS` in [js/data/buildings.js](js/data/buildings.js).
    - Added entrance node `entrance_41` at `[121.167707, 13.959335]` and connecting walkway `road_walkway_sh9` to `road_40` in [roads.json](roads.json).
    - Synchronized centroid and polygon in [js/data/plots.js](js/data/plots.js).
    - Registered wayfinding landmark and services in [js/data/descriptions.js](js/data/descriptions.js).
    - Cachebusters bumped to `v=154` in [index.html](index.html).

### 2.12 Route Walker Avatar Vertical Alignment Resolution — ✅ Complete
- **Issue Reported:** The animated wayfinding farmer avatar was hanging below the green route line with the route line crossing directly over his salakot hat ("the green line should be underneath their feet not above their head").
- **Root Cause Analysis:**
  1. *Marker Flow Displacement:* .dest-pin-marker, .kiosk-marker, and .route-walker-avatar had position: relative instead of position: absolute; top: 0; left: 0;. Because they shared the same mapboxgl-canvas-container parent, the preceding sibling markers (.kiosk-marker 24px + .dest-pin-marker 48px) took up 72px in normal document flow, pushing .route-walker-avatar down by 72px (offsetTop: 72px).
  2. *Wiping of Mapbox Classes:* Code setting walkerEl.className = 'route-walker-avatar ...' during animation state changes stripped .mapboxgl-marker and .mapboxgl-marker-anchor-bottom, preventing Mapbox's absolute positioning rules from taking effect.
  3. When combined with Mapbox's 	ranslate(-50%, -100%), the +72px normal-flow offset caused the hat of the avatar to land on the route line while his body and feet hung down into the parking lots and rooftops.
- **Fixes Applied:**
  1. Changed .route-walker-avatar, .dest-pin-marker, and .kiosk-marker in [css/main.css](css/main.css) to position: absolute; top: 0; left: 0; will-change: transform; so all markers are taken out of document flow and originate cleanly at (0, 0).
  2. Preserved .mapboxgl-marker and .mapboxgl-marker-anchor-bottom across all state changes in [js/routing.js](js/routing.js) and [js/walker.js](js/walker.js).
  3. Calibrated offset: [0, 4] with nchor: 'bottom' so that the contact shadow under the boots (cy="72", 4px above the 76px SVG box bottom) aligns with sub-millimeter precision directly on top of the green route coordinate line.
  4. Verified via headless browser CDP testing: avatar's boots and contact shadow are planted squarely on the green line, with the entire character standing upright above the path.
  5. Bumped cachebusters to =157 in [index.html](index.html) and [css/main.css](css/main.css).


### 2.0.9 Master Agricultural Plots Reorganization & Gate Refinements
- **Master Agricultural Plots Reorganization (Plots 1–45 Schedule across 23 Official Zones):**
  - Conformed all plots to user ground-truth schedule across the 23 verified zones.
  - Grouped zones (e.g. Citrus Orchard 6–12, Corn Seed Production 13–15, Coffee Orchard 20–22, Vegetable Production 23–25, Fruit Trees & Citrus Orchard 26–28, Mango, Banana & Jackfruit Trees 30–32, Dwarf Makapuno 33–35, Cassava Production 36–38, Soybean Seeds 39–41) render as **single seamless combined polygons** on overview (`getPlotsGeoJSON()` returning `ZONE_POLYGONS`).
  - Selecting any zone illuminates only its internal sub-plot cut lines (`INTERNAL_CUT_LINES`).
- **Main Entrance Adjustment (`gate_main_entrance`):**
  - Shifted northward from `[121.165745, 13.958316]` to `[121.165745, 13.958380]` to center cleanly on the asphalt driveway entrance opening.
- **Back Gate Entrance / Exit Adjustment (`gate_back_gate`):**
  - Repositioned from `[121.172486, 13.961669]` to `[121.172504, 13.961645]`, shifting down (-2.6m South) and right (+1.9m East) out of Guard House C's footprint and into the center of the eastern dirt road corridor.
- **Cachebusters Bumped:**
  - `js/markers.js?v=109`, `js/data/buildings.js?v=107`, `js/app.js?v=197`.

- **Restored Rich Screenhouse Sub-Plots (Plots 17 & 18):**
  - Fully restored rich screenhouse sub-plots formatting in [js/data/plots.js](js/data/plots.js) and [js/building-panel.js](js/building-panel.js):
    * `Screenhouse 1: Vegetables Screenhouse 1` — *Protected vegetable cultivation & seedling propagation beds*
    * `Screenhouse 2: Vegetables Screenhouse 2` — *Insect-proof vegetable seedling nursery with protective fine mesh*
    * `Screenhouse 3: Citrus Mother Plants Screenhouse` — *Foundation block & mother tree screenhouse for disease-free citrus budwood*
    * `Screenhouse 4: Embryo Cultured Macapuno Seedlings & Tissue Cultured Banana Screenhouse` — *Acclimatization & hardening nursery for embryo-cultured Makapuno and micropropagated banana*
    * `Screenhouse 5: Coffee Seedlings Screenhouse` — *Galvanized pipe frame nursery shade house for high-quality clonal coffee seedlings*
    * `Screenhouse 6–8: Citrus Seedlings Screenhouse` — *Combined 3-bay research greenhouse complex dedicated to certified disease-free citrus rootstocks and scions*
    * `Screenhouse 9: Citrus Seedlings Screenhouse` — *Curved hoop trellis screenhouse and attached potting headhouse for citrus seedling production*
  - Retained individual photo galleries and interactive tap-to-zoom to individual 3D screenhouse models.
  - All field plots (Plots 1–16, 19–45) strictly retain `subPlots: []` (zero fabricated sub-plots).
- **Cachebusters Bumped:**
  - `js/data/plots.js?v=91`, `js/building-panel.js?v=157`, `js/app.js?v=199`.


### 2.0.16 Mobile UI Synchronization Milestone: Agricultural Plots, Filters, Sub-Plots & Standalone Gates
- **Context & Motivation:** The user observed that the mobile interface (`?mode=phone`, `#phone-bottom-sheet`) had fallen behind the desktop campus updates regarding the 23 official agricultural plot zones, the 7 verified category type filters, standalone compound gates, and sub-plot interactions.
- **Root Cause Analysis:**
  1. *Phone Directory Isolation:* `renderPhoneDirectory` in `js/phone-ui.js` previously iterated only through `BUILDING_DIRECTORY` (ignoring `FIELD_COMMODITY_ZONES`, `EMBEDDED_CONFERENCE_HALLS`, `STANDALONE_GATES`, and `activeTypeFilters`).
  2. *Missing Mobile Filters:* The mobile search container had no filter button or dropdown, while Rule 7 strictly disallows horizontal category chip bars for DA-LARES.
  3. *Hidden Panel Mismatch:* When selecting agricultural plots on mobile (`selectPlotZone`), the code invoked `showPlotPanel()`, which populated `#building-panel` (which has `display: none !important;` in `body.mode-phone`), leaving mobile users with no visual feedback.
  4. *Missing Sub-Plots Container:* `#phone-bldg-scrollable` lacked a sub-plots breakdown card for Plot 17, Plot 18, and Plot 22.
- **Architectural Enhancements Implemented:**
  1. *Mobile Search & Type Filter Bar:*
     - Added `.phone-search-row` in `index.html` featuring `#phone-filter-btn` and `#phone-filter-dropdown` popover modal with backdrop.
     - Implemented the 7 verified DA-LARES categories: `infrastructure`, `trial_sites`, `orchard`, `office`, `laboratory`, `conference`, `digital_agri`.
     - Synced `updateFilterDropdownUI()` across both desktop and mobile buttons/badges and checkboxes in real-time.
  2. *Full 4-Part Mobile Directory:*
     - Upgraded `renderPhoneDirectory()` to display all 65 campus places (39 buildings, 23 agricultural plot zones, 3 compound gates, 3 conference halls) with responsive tags (`.phone-dir-plot-tag`, `.phone-dir-gate-tag`, `.phone-dir-conf-tag`, `.phone-dir-office-tag`).
     - Supports live keyword search and dynamic filtering by active category.
  3. *Dedicated Mobile Plot View (`showPhonePlotDetails`):*
     - Renders plot icon badge (`🌾`, `☕`, etc.), official title, plot range, plot count, and calibrated area ($m^2$ and $ha$).
     - Displays "OVERVIEW & COMMODITY" and "KEY PLOT METRICS" cards while hiding walk routing buttons for plot zones.
     - Supports real-time sub-plot chips for Screenhouses (Plots 17 & 18) and Water Tank & Comfort Room (Plot 22) with direct `zoomToSubPlot` 3D camera fly-in and dynamic photo switching.
  4. *Standalone Gate Support:*
     - `selectStandaloneGate` now opens `#phone-view-bldg` with official access gate details and stationed post information.
  5. *Navigation Reset & Overview FlyTo:*
     - Tapping `✕` in details view cleanly resets plot/sub-plot highlights and smoothly flies the camera back to `getActiveStationDefaultView()`.
- **Verification:**
  - Validated via automated Edge CDP tests capturing `verified_mobile_directory_synced.jpg`, `verified_mobile_filter_dropdown.jpg`, `verified_mobile_filtered_orchards.jpg`, `verified_mobile_search_coffee.jpg`, `verified_mobile_plot22_full_sheet.jpg`, `verified_mobile_watertank_spotlight_focused.jpg`, `verified_mobile_gate1_sheet.jpg`, and `verified_mobile_back_overview.jpg`.
- **Cachebuster Bump:**
  - `app.js?v=212`.


### 2.0.17 Decoupled 3D Buildings & Marker/Pill Visibility System — ✅ Complete
- **Context & Motivation:**
  - The user reported: *"When removing 3d Buildings. The pills should not vanish. When in full pill view, when i turn off building labels, the pills vanishes as well."*
  - Previously, all marker visibility logic across `js/map-settings.js`, `js/map-setup.js`, `js/sidebar.js`, and `js/markers.js` had `state.buildingsVisible !== false` as an explicit prerequisite (`markersShouldShow = isChecked && (state.buildingsVisible !== false)`).
  - Consequently, whenever the user toggled OFF "3D Buildings", all campus building pills (`.bldg-map-marker`) were forcefully hidden with `style.display = 'none'`, leaving an empty 2D map with no way to identify campus facilities. Furthermore, turning on "Building Labels" while 3D buildings was OFF could not restore the markers because `buildingsVisible` blocked them.
- **Architectural Changes & State Decoupling:**
  - **`js/map-settings.js` (`handleLayerToggle`):**
    * Removed DOM marker manipulation completely from `type === 'buildings'`. Toggling 3D buildings on/off now strictly affects 3D architectural extrusions and GLTF model layers (`3d-drawings`, `3d-buildings-models-layer`, etc.) without ever altering `.bldg-map-marker` or `state.markers`.
    * In `type === 'numbers' || type === 'labels'`, decoupled marker visibility from `state.buildingsVisible`: `markersShouldShow = isChecked;`.
  - **`js/map-setup.js` (`toggleBuildings`):**
    * Removed marker hiding logic (`markersShouldShow = state.buildingsVisible && ...`). Toggling buildings now purely updates 3D layers and syncs the UI toggle checkbox.
  - **`js/sidebar.js` (`toggleSettingChip`):**
    * Decoupled chip-based marker toggling: `markersShouldShow = on;`.
  - **`js/markers.js` (`virtualizeMarkers`, `renderMarkers`, `restoreMarkersAfterOrbit`, `declutterMarkersForNavigation`):**
    * Stripped `state.buildingsVisible !== false` checks from marker rendering and virtualization. Virtualization now purely respects `state.markersVisible !== false` and viewport frustum bounds.
- **Behavior in Full Pill View vs Compact Number Mode:**
  - In **Full Pill View** (`label-mode-full`):
    * Toggling OFF "3D Buildings" retains all full pills (`(1) Guard House A`, `(11) Argosino Hall`, etc.) on top of the 2D aerial satellite basemap.
    * Toggling OFF "Building Labels" cleanly hides the marker layer, leaving a completely uncluttered aerial basemap. Toggling it back ON immediately restores the pills even when 3D buildings remain OFF.
  - In **Compact Number Mode** (`label-mode-compact`):
    * Toggling OFF "3D Buildings" retains circular numbered badges (`(1)`, `(11)`, `(12)`, etc.) without models.
- **Cachebuster Updates:**
  - `index.html`: `js/app.js?v=213`
  - `js/app.js`: `markers.js?v=111`, `map-setup.js?v=91`, `sidebar.js?v=84`, `map-settings.js?v=90`
- **Headless Browser CDP Verification:**
  - Verified with `scratch/test_buildings_labels_toggle.py` across Edge CDP:
    * `verified_pills_without_3d_buildings.jpg`: 3D buildings OFF, Full Pill View active, building pills remain 100% visible and interactive over aerial imagery.
    * `verified_labels_toggled_off.jpg`: Building Labels OFF, clean basemap with all markers hidden.
    * `verified_labels_on_3d_off.jpg`: Building Labels turned back ON while 3D buildings is OFF, pills immediately restored.
    * `verified_compact_mode_3d_off.jpg`: Compact Number mode with 3D buildings OFF, circular badges displayed.
    * `verified_3d_off_full_pills_overview.jpg`: Full campus overview with settings modal closed, 3D buildings OFF, and all pills rendered over satellite basemap.


### 2.0.18 LARES Building Pill Alignment & Spatial Centering — ✅ Complete
- **Context & Motivation:**
  - The user requested: *"Move the LARES pill to the right in the direction of the road so its in the middle of the building"*.
  - Previously, `CUSTOM_BUILDING_CENTERS['lares_building']` was set to `[121.16629490, 13.95918766]`. In the campus view, this placed the circular badge `(5)` at the extreme western edge of the main north-south building wing, directly touching `(7) F2C2 Building` and overlapping the `YOU ARE HERE` kiosk marker.
- **Geometric Calibration:**
  - Calibrated the pill position along the road vector ($	heta pprox 162.8^\circ$) by $+8.0\text{ m}$:
    * New Pill Coordinates: `[121.16631686, 13.95911881]`
    * Kept 3D Model Coordinates strictly untouched at `[121.16629490, 13.95918766]` to preserve ground-truth architectural registration.
  - **Results:**
    * In **Full Pill View** (`label-mode-full`): The entire `(5) LARES Building` pill is now symmetrically centered across the width of the green wing roof, with the roof ridge line passing cleanly through the center of the capsule and equal margins to both the western wall and eastern road-facing wall.
    * In **Compact Number Mode** (`label-mode-compact`): The numbered circular badge `(5)` sits centered along the roof ridge line.
    * Completely eliminated visual clutter and marker collision with `YOU ARE HERE` and `(7) F2C2 Building`.
- **Cachebuster Updates:**
  - `js/data/buildings.js?v=112` bumped across 13 consuming modules (`app.js`, `building-panel.js`, `drone-calibration.js`, `gps.js`, `map-setup.js`, `markers.js`, `occlusion.js`, `phone-nav.js`, `phone-ui.js`, `routing.js`, `sidebar.js`, `steps.js`, `walker.js`).
  - `index.html`: `js/app.js?v=214`.
- **Headless Browser CDP Verification:**
  - Verified across Edge CDP (`scratch/verify_lares_pill_final.py`):
    * `verified_lares_pill_centered.jpg`: Direct comparison against user's top-down angle, showing the pill centered on the green roof wing.
    * `verified_lares_compact_centered.jpg`: Compact number badge centered along the roof ridge.
    * `verified_lares_pill_overview.jpg`: 3D angled overview verifying clutter-free marker arrangement.


### 2.0.19 Warehouse 1–8 & Infrastructure Category Filtering Harmonization — ✅ Complete
- **Context & Motivation:**
  - The user reported: *"Filter of warehouses seems to not work because the warehouse 1-8 is not here. Make sure all the filter works and all are appearing right where they belong when choosing a filter."*
  - An inspection of the **Filter by Type Popover Modal** with `[x] Agri Infrastructure / Facilities` active revealed that all 8 Northern Warehouses (`warehouse_1` through `warehouse_7` and `lares_farm_machinery_shed_1` / `lares_organic_fertilizer_storage`) and `lares_agricultural_supplies_storage` were completely absent from the directory list.
- **Root Cause Analysis:**
  - In `BUILDING_CATEGORIES` within `js/data/buildings.js`, the facilities' own names were accidentally assigned as their category string instead of `'infrastructure'` (e.g., `'warehouse_1': 'LARES Synthetic Fertilizer Storage / LARES Pesticide Storage'`, `'lares_farm_machinery_shed_1': 'LARES Farm Machinery Shed 1'`).
  - When the user selected `Agri Infrastructure / Facilities` in the type filter modal, `activeTypeFilters.has(b.category)` evaluated to false for all 8 warehouses and the supplies storage.
  - Furthermore, `plot22_water_tank` and `plot22_comfort_room` had their names and types in `KNOWN_BUILDING_NAMES` and `BUILDING_TYPES` mapped to `'infrastructure'` instead of their proper facility names and functional types.
- **Key Changes Implemented:**
  - **`js/data/buildings.js`:**
    * Fixed `BUILDING_CATEGORIES`: Explicitly mapped `lares_agricultural_supplies_storage`, `warehouse_1`, `lares_farm_machinery_shed_1`, `lares_organic_fertilizer_storage`, `warehouse_3`, `warehouse_4`, `warehouse_5`, `warehouse_6`, `warehouse_7`, `plot22_water_tank`, and `plot22_comfort_room` to `'infrastructure'`.
    * Fixed `KNOWN_BUILDING_NAMES`: Corrected `'plot22_water_tank': 'LARES Water Tank'` and `'plot22_comfort_room': 'Plot 22 Comfort Room'`.
    * Fixed `BUILDING_TYPES`: Added clear functional descriptors with warehouse numbers:
      - `warehouse_1`: `Warehouse 1 • Fertilizer & Pesticide Storage`
      - `lares_farm_machinery_shed_1`: `Warehouse 2 • Machinery Shed`
      - `lares_organic_fertilizer_storage`: `Warehouse 3 • Organic Fertilizer Storage`
      - `warehouse_3`: `Warehouse 4 • Corn Seed Processing`
      - `warehouse_4`: `Warehouse 5 • Machinery Shed`
      - `warehouse_5`: `Warehouse 6 • Rice Banner Warehouse`
      - `warehouse_6`: `Warehouse 7 • Cassava Drying Shed`
      - `warehouse_7`: `Warehouse 8 • Corn Banner Warehouse`
      - `lares_agricultural_supplies_storage`: `Agricultural Storage Facility`
      - `plot22_water_tank`: `Water Supply & Sprinkler Irrigation`
      - `plot22_comfort_room`: `Sanitation & Irrigation Hub`
    * Enhanced `BUILDING_DIRECTORY` descriptions to include "Warehouse 1" through "Warehouse 8" and "Logistics Warehouse" for unified keyword search.
  - **`js/data/descriptions.js`:**
    * Updated `compactTag` across all 8 warehouses with explicit `Warehouse 1 • ...` through `Warehouse 8 • ...` prefixes.
- **Comprehensive Audit across All 7 Filter Categories:**
  1. **Agri Infrastructure / Facilities (`infrastructure`)**: 16 numbered buildings (#1 Guard House A, #10 Canteen, #18 Dormitory, #25 Motorpool Barracks, #26 Guest House, #27 Guard House B, #28 Guard House C, #31 LARES Agricultural Supplies Storage, #32 Warehouse 1, #33 Warehouse 2, #34 Warehouse 3, #35 Warehouse 4, #36 Warehouse 5, #37 Warehouse 6, #38 Warehouse 7, #39 Warehouse 8) + 2 screenhouse master zones (Plot 17 & Plot 18) = 18 items.
  2. **Office Buildings (`office`)**: All 11 verified office buildings (Tanco Hall, Admin, ORED, LARES, RAED, AMAD, F2C2, PRDP, Multi-Purpose Admin, RSBSA, MIS-RAFIS).
  3. **Laboratories (`laboratory`)**: All 10 research laboratories (RSL, PGRC, R&D Multipurpose, Post-Harvest Lab, Tissue Culture, Corn & Cassava, RCPC, Mushroom Lab, ILD, CGuard).
  4. **Conference Hall (`conference`)**: Standalone Argosino Hall + 2 verified embedded conference halls (ORED Conference, R&D Conference Hall) = 3 facilities.
  5. **Digital Agriculture Project (`digital_agri`)**: Automated Weather Station (Pin #30).
  6. **Agricultural Test / Trial Sites (`trial_sites`)**: All 10 field crop variety trial zones.
  7. **Orchard (`orchard`)**: All 11 fruit tree and citrus orchard zones.
  - Searching `"warehouse"` in the directory search input surfaces all 8 warehouses + agricultural supplies storage.
  - Mobile phone directory (`#phone-directory-list`) is 100% in sync with the filter state.
- **Cachebuster Updates:**
  - `js/data/buildings.js?v=113` bumped across all 13 consuming modules (`app.js`, `building-panel.js`, `drone-calibration.js`, `gps.js`, `map-setup.js`, `markers.js`, `occlusion.js`, `phone-nav.js`, `phone-ui.js`, `routing.js`, `sidebar.js`, `steps.js`, `walker.js`).
  - `index.html`: `js/app.js?v=215`.
- **Headless Browser CDP Verification:**
  - Automated test suite `scratch/verify_all_filters_cdp.py` executed with 100% pass across all 9 test suites:
    * `verified_filter_infrastructure_warehouses.jpg`: Live screenshot showing the Type Filter Popover modal with `Agri Infrastructure / Facilities` checked and Warehouses 1–8 appearing cleanly in the directory list.

---

### 🚀 Update: Mobile Walking Directions Overlap & Zoom Controls Fix
- **Problem Statement:** During mobile walking navigation (`body.phone-nav-active` / `body.mode-phone.has-active-route`), the Settings button (`⚙️`, `.map-settings-widget`) was positioned at `top: 86px; right: 14px;`, landing directly over the Mapbox Zoom Controls stack (`.mapboxgl-ctrl-top-right`), completely blocking the Zoom In (`+`) button from user tap interaction.
- **Implemented Fix in `css/main.css`:**
  1. **Settings Cog Suppression:** Set `.map-settings-widget { display: none !important; }` during active route / phone navigation. Settings are deeply administrative (drone calibration, display shadows, 3D sun lighting) and are not needed while walking, immediately eliminating the right-rail collision.
  2. **Controls Rail Shift:** Shifted `.mapboxgl-ctrl-top-right` down from `top: 60px` to `top: calc(var(--safe-top, 0px) + 88px) !important;` with smooth CSS transition (`transition: top 0.3s cubic-bezier(0.16, 1, 0.3, 1)`). This positions Zoom In (`+`), Zoom Out (`-`), Compass (`▲`), Orbit, and Fullscreen with pristine clearance beneath the Top Nav HUD banner ($y = 12..84\text{px}$).
  3. **Drone Aerial Layer Toggle Positioning:** Kept `.map-layer-widget` at `top: calc(var(--safe-top, 0px) + 88px) !important; right: 60px !important;`, floating cleanly to the left of the Zoom In button in a balanced side-by-side arrangement.
  4. **Smooth State Recovery:** When navigation completes or is cancelled via `cancelPhoneRoute()`, the classes are removed, smoothly restoring Settings at `top: 14px; right: 14px;`, Controls at `top: 60px; right: 14px;`, and Layer Toggle at `top: 14px; right: 60px;`.
- **Cachebuster Updates:**
  - `css/main.css?v=176` bumped in `index.html`.
- **Headless Chrome Verification:**
  - Automated CDP test `scratch/test_full_cycle.py` verified exact computed styles across all 3 lifecycle stages:
    * Idle: `settings: flex`, `ctrlTop: 60px`, `layerTop: 14px`
    * Navigating: `settings: none`, `ctrlTop: 88px`, `layerTop: 88px`
    * Restored: `settings: flex`, `ctrlTop: 60px`, `layerTop: 14px`
  - High-res visual artifacts generated:
    * `mobile_nav_preview_clean_zoom.jpg`
    * `mobile_nav_top_right_unblocked.jpg`

---

### 🎥 Update: Mobile Camera View Controls (`Locked` / `Side View` / `Top View`)
- **User Request:** Add the Camera View controls to the mobile navigation interface, floating centered right above the dropped-down bottom route sheet. When the sheet is slid up, the camera controls do not follow the sheet into the screen; they stay firmly anchored at the bottom and fade out so turn-by-turn directions remain 100% clean and readable.
- **Implemented Changes:**
  1. **Mobile Floating Controls (`css/main.css`):**
     * Enabled `.floating-camera-controls.active` on mobile phone mode (`body.mode-phone` and `@media (max-width: 768px)`).
     * Positioned at `bottom: calc(var(--safe-bottom, 0px) + 138px) !important; left: 50% !important; transform: translateX(-50%) !important; z-index: 90 !important;`.
     * Styled with glass-morphic theme (`rgba(15, 23, 42, 0.92)`, blur 16px), compact button dimensions (`height: 32px`, `padding: 0 10px`, `font-size: 11.5px`), and Lucide icons.
  2. **Anchored in Place & Non-Following Behavior (`css/main.css` & `js/phone-ui.js`):**
     * When the user slides the bottom sheet UP to `snap-half` or `snap-full`, the sheet (`z-index: 100`) slides over the camera pill.
     * `.sheet-expanded-hidden` and CSS `:has(#phone-bottom-sheet.snap-half)` smoothly fade out the camera pill (`opacity: 0`, `pointer-events: none`, `transform: translateX(-50%) scale(0.95)`).
     * When sliding back down to `peek`, the camera pill smoothly restores above the menu.
  3. **Module Activation Wiring:**
     * `js/phone-nav.js` and `js/routing.js`: Activated `fcc.classList.add('active')` and called `updateCameraControlsUI()` when virtual walkthrough / phone routes start, and removed upon arrival or cancellation.
- **Cachebuster Updates:**
  - `css/main.css?v=178` and `js/app.js?v=244` in `index.html`.
- **Headless Chrome Verification:**
  - Automated CDP test `scratch/verify_camera_controls_mobile.py` verified:
    * Peek State: `fccVisible: true`, `display: flex`, `bottom: 138px`, `gapToSheet: 14px`.
    * Half Sheet State: `opacity: 0`, `fccY: 513` (stayed firmly anchored in place, zero riding up into the screen).
    * Restored Peek State: `opacity: 1`, `pointer-events: auto`.
  - Verified Screenshots:
    * `mobile_nav_with_camera_view.jpg`
    * `mobile_nav_sheet_half_camera_hidden.jpg`
    * `mobile_nav_sheet_peek_camera_restored.jpg`

---

### 🚧 Update: Regional Research Stations "Under Development" Protection
- **User Directive:** "When deployed make sure that other research stations will be shown as Under Development when they choose it."
- **Implemented Architecture:**
  1. **Station Registry Status (`js/data/stations.js`):**
     * Added `status: 'active'` for `lares` (Lipa City, Batangas).
     * Added `status: 'under_development'` for `qares` (Tiaong, Quezon), `rares` (Tanay, Rizal), and `cares` (Naic, Cavite).
  2. **Badging in Station Selectors (`index.html` & `css/main.css`):**
     * Dropdown list items and mobile station cards now display an amber `Under Dev` badge (`.dev-badge`) for in-development stations, while `lares` retains the green `Active` badge.
  3. **"Under Development" Pop-up Modal (`#station-dev-modal` in `index.html`):**
     * Displays a glass-morphic prompt with glowing construction badge, dynamic station name, full name, and roadmap checklist (3D models, road graph pathfinding, and drone survey).
     * Primary Action: `"Continue on DA-LARES Map"` — cleanly dismisses the modal and keeps visitors on the active DA-LARES compound.
     * Admin Mode Action (`?admin=1`): `"Explore Preview (Admin)"` — allows developers/admins to preview QARES if needed without exposing incomplete data to the general public.
  4. **Selection Intercept (`js/stations.js`):**
     * `switchResearchStation(stationId)` checks `targetStation.status === 'under_development'`. If true, it opens `showStationDevModal(stationId)` and halts the map flyover, keeping the camera safely anchored at DA-LARES.
     * Mobile station selection via `handlePhoneSelectStation(stationId)` routes through the same intercept.
- **Cachebuster Updates:**
  - `css/main.css?v=179` and `js/app.js?v=245` in `index.html`.
- **Headless Chrome CDP Verification:**
  - `scratch/verify_under_development_modal.py` verified 100% pass across both Kiosk and Mobile:
    * `kiosk_station_dropdown_dev.jpg`: Kiosk dropdown showing `Active` on LARES and `Under Dev` on QARES, RARES, LARDC.
    * `kiosk_station_dev_modal.jpg`: Centered Under Development dialog upon clicking QARES on Kiosk.
    * `phone_station_modal_dev.jpg`: Mobile station selection modal showing `Under Dev` cards.
    * `phone_station_dev_modal.jpg`: Centered Under Development dialog upon tapping QARES on mobile.

---

### 🏷️ Update: Compact Number Mode Building Labels Toggle Resolution — ✅ Complete
- **Problem Statement:** When Map Display Settings has **Compact Number** mode active, toggling the **Building Labels** switch OFF (`msp-toggle-markers`) failed to hide the markers. The numbered circle badges remained visible on the map.
- **Root Cause Analysis:**
  - In `css/main.css` (lines 2406 and 2502), `body.label-mode-compact .bldg-map-marker` and `body.label-mode-compact .plot-map-marker` specified `display: flex !important;` and `display: inline-flex !important;`.
  - In CSS specificity rules, any declaration with `!important` in a stylesheet overrides normal inline JavaScript styles (`element.style.display = 'none'`), rendering the toggle ineffective.
- **Implemented Fix:**
  1. **CSS Specificity Clean-Up (`css/main.css`):**
     - Removed `!important` from `display: flex;` on `body.label-mode-compact .bldg-map-marker` and `display: inline-flex;` on `body.label-mode-compact .plot-map-marker`.
     - Added dedicated universal hidden rule:
       ```css
       body.labels-hidden .bldg-map-marker,
       body.labels-hidden .plot-map-marker,
       body.labels-hidden .mapbox-gate-label {
           display: none !important;
           visibility: hidden !important;
           opacity: 0 !important;
           pointer-events: none !important;
       }
       ```
  2. **JavaScript Layer & Display Synchronization:**
     - **`js/map-settings.js` (`handleLayerToggle` & `syncLayerToggleCheckboxes` & `setLabelDisplayMode`):**
       * Toggles `document.body.classList.toggle('labels-hidden', !markersShouldShow)`.
       * Uses `.setProperty('display', 'none', 'important')` when hiding, and `.removeProperty('display')` / `.style.display = ''` when restoring.
     - **`js/sidebar.js` (`toggleSettingChip` for `numbers`):**
       * Toggles `document.body.classList.toggle('labels-hidden', !markersShouldShow)`.
       * Uses `.setProperty('display', 'none', 'important')` on all markers.
     - **`js/markers.js` (`virtualizeMarkers` & `createMarkers`):**
       * In `virtualizeMarkers()`, checks `if (state.markersVisible === false)` and applies `labels-hidden` and `el.style.setProperty('display', 'none', 'important')`.
       * In `createMarkers()`, applies `labels-hidden` and sets `.setProperty('display', 'none', 'important')` if markers are hidden.
- **Automated CDP Test Verification (`tools/tests/test_compact_label_toggle.py`):**
  - Verified across both DA-RARES and DA-LARES stations.
  - When switched to Compact Number and toggled OFF: 0 visible building markers.
  - When toggled back ON: All 39 markers immediately restored.
  - Verified screenshots: `rares_compact_labels_off_verified.png` and `rares_compact_labels_on_verified.png`.
