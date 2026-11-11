# DA-CALABARZON Interactive 3D Research Station Mapping & Wayfinding System — Presentation Slide Outline (14 Slides)

**Presentation Title:** DA-CALABARZON Interactive 3D Research Station Mapping, Wayfinding & Plot Intelligence System — Tech Update *(Working Title: DASH — Official Brand Proposals Included)*  
**Audience:** DA CALABARZON (Region IV-A) Supervisors, Division/Station Staff, Researchers, and IT Colleagues  
**Note:** Internal security hardening items are intentionally excluded from these public slides and kept in [`docs/03-limitations-and-roadmap.md`](file:///c:/Users/LGU-SanPedro/Downloads/map/docs/03-limitations-and-roadmap.md).

---

## Slide-by-Slide Outline (14 Slides)

### Slide 1: Title & Regional Vision — A Unified 3D Interactive Map for All DA-CALABARZON Research Stations
- **Bullets:**
  - Introducing the **Interactive 3D Research Station Mapping, Wayfinding & Plot Intelligence Platform** built for **all four DA-CALABARZON Research Stations** (**DA-LARES**, **DA-QARES**, **DA-RARES**, and **DA-CARES**).
  - **Publicly Searchable Online + On-Site Kiosk + Mobile GPS:** Deployed so **anyone can search it online from any browser**, while also powering the lobby touchscreen kiosk and **QR-code smartphone GPS navigation** with zero app downloads.
  - **Flagship Presentation — DA-LARES First:** Presenting the 100%-complete **DA-LARES (Lipa City, Batangas)** campus today (where development began), while **DA-QARES**, **DA-RARES**, and **DA-CARES** are displayed as **Under Development** for the initial public rollout.
- **Visual to Show:** **Screenshot `SS-01`** (Welcome Modal showing the 4-station selector over the 3D aerial view of DA-LARES) plus the **"Station Under Development"** modal preview.

---

### Slide 2: Dual Purpose — Built for Both Campus Visitors AND Station Workers
- **Bullets:**
  - **For Visitors & Stakeholders (Farmers, Guests, Clients, Suppliers):** Eliminates confusion across multi-hectare stations where visitors know services (*"Where is the BAC?"*, *"Where do I submit soil samples?"*, *"Where is the Cashier?"*) rather than building numbers.
  - **For DA Station Workers, Researchers & Farm Superintendents:** Serves as a unified visual directory of facilities and **45 experimental agricultural plots**—giving workers a spatial map today that will expand to track **what is planted in each plot**, **exact tree counts**, **current crop varieties**, and **which plots are annual/perennial orchards vs. monthly/seasonal trial plots**.
  - **For Station Front Desks & Guard Houses:** Replaces static tarpaulins that cannot follow a visitor outdoors and reduces repetitive direction-giving during summits and trainings.
- **Visual to Show:** **Screenshot `SS-02`** (Full 3D Campus Overview showing the density of the 39 numbered facilities and surrounding 45 agricultural plots).

---

### Slide 3: Flagship DA-LARES at a Glance — Verified By the Numbers
- **Bullets:**
  - **4 Regional Research Stations in Registry:** **DA-LARES** (100% Complete 3D Flagship), **DA-QARES** (Tiaong), **DA-RARES** (Tanay), and **DA-CARES** (Naic) (`js/data/stations.js`, `js/stations.js`).
  - **Complete 3D Architectural Coverage at DA-LARES:** **50** mapped building footprints (**39** numbered facilities + **9** screenhouse/annex structures + **2** Plot 22 utility amenities) powered by **49 custom 3D building models** (`< 300 KB` each), **131 3D trees**, and **63 optimized `.webp` photos**.
  - **Searchable Office & Agricultural Plot Directory:** **47 verified internal offices** across **9** multi-office buildings, **3** embedded conference halls, and **45 agricultural field plots** grouped into **23 official commodity zones**.
  - **100% Verified Pedestrian Network & Offline Drone Map:** **2.68 km** of roads and walkways (**2,678** routing nodes; **45/45 entrances 100% reachable**) over a **210.66 MB** local drone orthomosaic (`LARES v1.mbtiles`, optimized from 210.66 MB).
- **Visual to Show:** **"By the Numbers" Infographic Table** (from Section 1 of `docs/00-system-overview.md`).

---

### Slide 4: Omnichannel Access — Public Online Web + Lobby Kiosk + Smartphone GPS
- **Bullets:**
  - **Single Codebase, Four Adaptive Modes (`js/mode.js`):** Automatically adapts between **Public Desktop Web / Kiosk Landscape**, **Kiosk Portrait Totem**, **Mobile Phone Mode**, and **Admin Mode**.
  - **Online Before Visiting or From Any Office:** Anyone can search the deployed web platform from home or office to inspect buildings, offices, plots, and simulated 3D walking routes.
  - **At the Lobby Kiosk & Outdoors on Campus:** Visitors browse the touchscreen at Argosino Hall and scan the on-screen QR code to carry live GPS turn-by-turn directions on their smartphone.
- **Visual to Show:** **System Context Diagram** (from Section 4 of `docs/00-system-overview.md`) or side-by-side **Screenshots `SS-02` (Web/Kiosk) and `SS-09` (Phone)**.

---

### Slide 5: Smart Directory — Searching by Building, Office Acronym, Plot, or Category
- **Bullets:**
  - **Instant Multi-Entity Search (`js/sidebar.js`):** Typing an acronym like `BAC`, `PMED`, `CASHIER`, or `RSBSA` immediately filters to the parent building and displays a highlighted green office pill (`🏢 BAC`) beneath it.
  - **7 Official Facility Categories:** One-tap dropdown filtering across *Agri Infrastructure (16)*, *Agri-Eco Trial Sites (10)*, *Orchard & Plantation (11)*, *Office Buildings (11)*, *Research Laboratories (10)*, *Conference & Training (1)*, and *Digital Agriculture (1)*.
  - **Clean Default Directory:** Keeps the main list focused on the **39 numbered buildings**, while surfacing unnumbered field utilities (*LARES Water Tank* and *Plot 22 Comfort Room*) when searched or filtered under *Agri Infrastructure*.
- **Visual to Show:** **Screenshot `SS-03`** (Sidebar search for `"BAC"` or `"Cashier"` showing matched office badges and the 7-category filter dropdown).

---

### Slide 6: Human-Centered Building Cards — "How to Spot It" & Optimized WebP Photos
- **Bullets:**
  - **Authentic 3D Inspection Orbit:** Selecting any facility flies the camera to a 54° 3D perspective and smoothly orbits its bespoke 3D model (`js/idle.js`).
  - **100% WebP Field Photography:** Displays **63 real campus photographs** converted to fast-loading `.webp` format (`tools/convert_photos_to_webp.py`) with multi-angle view chips (*Front*, *Side*, *Signage*) and a full-screen lightbox.
  - **Two-Tier Visitor Guidance (`js/data/descriptions.js`):** Provides plain-language **How to Spot It** cues (roof color, porch style, visible signage) and **What's Inside & Services**, plus clickable office chips.
- **Visual to Show:** **Screenshot `SS-04`** (`#9 RAED Building` or `#21 R&D Multipurpose Building` selected with 3D model centered and right-hand detail drawer open).

---

### Slide 7: Agricultural Plots & Worker Field Intelligence — 45 Plots Across 23 Zones
- **Bullets:**
  - **Complete Field Plot Mapping (`js/data/plots.js`, `js/plot-layers.js`):** Covers all **45 numbered experimental plots** organized into **23 official commodity zones** (Citrus Orchard, Coffee Orchard, Corn Seed Production, Cassava, Vegetable Trials, and Screenhouses), illuminating internal sub-plot cut lines and screenhouses (`1`–`9`) on selection.
  - **Built for Station Workers & Researchers:** Allows field staff, researchers, and farm superintendents to visually reference every plot, screenhouse sub-plot, and field utility across the station.
  - **Roadmap for Plot-Level Agronomic Intelligence:** Designed to expand so workers can click any plot to view **what crop/variety is currently planted**, **exact tree counts** per orchard plot, planting dates, and whether a plot is an **Annual / Perennial Orchard Plot** or a **Monthly / Seasonal Trial Plot**.
- **Visual to Show:** **Screenshot `SS-05`** (*TC Makapuno & Banana Screenhouse — Plot 17* or *Coffee Orchard — Plot 22* illuminated on the drone map with sub-plot cards in the drawer).

---

### Slide 8: Pedestrian Routing & Landmark Turn-by-Turn Directions
- **Bullets:**
  - **1-Meter Precision Road Graph (`js/routing.js`):** Subdivides **2,684 m** of compound roads and walkways into **2,678 nodes**, connecting all **45 building entrances** and plot access points directly to the pedestrian network.
  - **Landmark-Based Turn Instructions (`js/steps.js`):** Translates geometric turns into natural human directions referencing the actual building at each corner (e.g., *"Turn right at MIS / RAFIS Building — 36 m"*).
  - **Interactive Step Inspection:** Tapping any step in the directions list flies the 3D camera directly to that intersection so the user can preview the turn before walking.
- **Visual to Show:** **Screenshot `SS-06`** (Active route from Argosino Hall to a warehouse/laboratory showing the glowing green path, step-by-step landmark list, and QR card).

---

### Slide 9: 3D Animated Walkthrough & Smart "X-Ray" Building Transparency
- **Bullets:**
  - **Animated Walker Preview (`js/walker.js`):** Walks the route in real time while trimming the completed path behind the avatar and updating the top turn banner.
  - **Dynamic Frosted-Glass Occlusion (`js/occlusion.js`):** Whenever a 3D building stands between the camera and the walker, that building automatically fades to **25% frosted-glass opacity** so the walker and route are never hidden.
  - **Playback & Camera Controls:** Includes **`1x`, `2x`, `4x`, and `6x`** speed buttons, **Side View / Top View / Unlocked** camera modes, **Replay Walk**, and an adaptive arrival banner with a 10-second auto-return countdown.
- **Visual to Show:** **Screenshot `SS-07`** (Close-up of the walker mid-route with an obstructing 3D building rendered translucent and the speed/camera controls visible).

---

### Slide 10: Seamless QR Handoff & Live Smartphone GPS Navigation
- **Bullets:**
  - **Scan and Go (`js/qr.js`):** Every building drawer and route panel displays a live QR code (with a full-screen **Tap QR to Enlarge** modal) that opens the route over HTTPS.
  - **Live GPS Road-Snapping & Compass (`js/gps.js`):** Tracks the user's real-time outdoor location, snaps the blue dot to the walkway, rotates a directional cone using the phone's hardware compass, and counts down remaining meters.
  - **Automatic Off-Route Rerouting & Remote Preview (`js/phone-nav.js`):** Automatically computes a new route if the visitor wanders more than **28 m** off path, vibrates the phone within **12 m** of the entrance, and automatically plays the simulated walkthrough if opened online >500 m outside the compound.
  - **100% Privacy-First:** Smartphone GPS coordinates are processed strictly inside the user's phone browser memory and are **never sent to or stored on the server**.
- **Visual to Show:** **Screenshots `SS-08` (Enlarged QR Modal on Kiosk) and `SS-09` (Mobile Phone Live Navigation View)** side by side.

---

### Slide 11: Modern Architecture, Station-Isolated 3D Layers & Offline Resilience
- **Bullets:**
  - **Modular Zero-Build Stack:** **27 ES JavaScript modules** (`js/` + `js/data/`), **8 modular CSS stylesheets** (`css/*.css`), **Mapbox GL JS v3.31.0**, **Turf.js**, and a local **Node.js + Express** server (`server.js`).
  - **Station-Isolated 3D Model Architecture (`js/map-setup.js`):** Mounts dedicated, isolated 3D model sources and layers per station (`lares-3d-models-layer`, `rares-3d-models-layer`, `qares-3d-models-layer`) so switching stations is instantaneous and 3D buildings never vanish.
  - **Sub-Millisecond Offline Drone Streaming & 3-Tier Database Fail-Safe:** Streams `.mbtiles` SQLite drone databases locally with a 300-tile RAM cache, and backs up MySQL settings (`kiosk_pin`, `drone_offset`, `building_colors`) to local JSON files and in-memory defaults.
- **Visual to Show:** **4-Layer Architecture Diagram** (from Section 5 of `docs/00-system-overview.md`).

---

### Slide 12: Hardware Optimization, Accessibility & 24/7 Kiosk Operations
- **Bullets:**
  - **Adaptive GPU & Battery Profiles (`js/performance.js`):** Automatically detects integrated Intel HD/UHD graphics or mobile processors, offering **Kiosk Eco Mode** on totems and **Battery Saver Mode** on phones, plus automatic fallback if frame rate dips below 26 FPS.
  - **45-Second Idle Reset & 5-Minute Thermal Eco-Rest (`js/idle.js`):** Automatically clears abandoned routes after 45 seconds of inactivity and pauses 3D rotation after 5 minutes to keep the kiosk PC cool 24/7.
  - **1-Finger Orbit Accessibility & Flexible Labels (`js/orbit-control.js`, `js/map-settings.js`):** Includes a dedicated one-finger 3D orbit toggle and Full Pill / Compact Number label modes.
- **Visual to Show:** **Screenshot `SS-10`** (Map Settings popover showing Layer Toggles, Full Pill vs. Compact Number mode, Dawn/Day/Dusk/Night Lighting, and Performance Profiles).

---

### Slide 13: Easy Administration & Regional Multi-Station Rollout (`QARES`, `RARES`, `CARES`)
- **Bullets:**
  - **Drag-and-Drop "You Are Here" Pin (`js/idle.js`):** If the kiosk totem is relocated to another building for a summit, an administrator unlocks the pin in Admin Mode and drags it to the new spot—all routes recalculate automatically.
  - **8 Built-In Visual Authoring Editors:** Browser-based tools for building footprints (`draw.html`), roads and entrances (`road_draw.html`), agricultural plots (`plot_draw.html`), 3D trees (`tree_draw.html`), floating pill calibration (`pill_adjust.html`), and real-time drone alignment (`js/drone-calibration.js`).
  - **Active Onboarding of QARES, RARES & CARES (`js/stations.js`):** **DA-RARES (Tanay)** already has its 17.5 MB drone orthomosaic, 39 building footprints, 45 plots, roads, and custom 3D Guard House integrated; **DA-QARES (Tiaong)** has its 234 MB drone orthomosaic, 48 footprints, and 31 road features integrated—all cleanly gated behind the **"Station Under Development"** modal on the public site until 100% complete.
- **Visual to Show:** **Screenshot `SS-11`** (Admin Mode / Visual Authoring Suite) or a split view of the **"Station Under Development"** modal alongside the local RARES/QARES development progress.

---

### Slide 14: Official System Branding Proposals & Three-Phase Roadmap
- **Bullets:**
  - **Selecting Our Permanent System Brand (Replacing Tentative "DASH"):** Presenting **3 original standalone system name & acronym proposals** designed to represent all DA-CALABARZON research stations, 3D wayfinding, and plot-level agricultural intelligence.
  - **Phase 1 — Public Deployment & Flagship DA-LARES Launch (Now):** Deploy the system online so anyone can search DA-LARES while QARES, RARES, and CARES display the *"Under Development"* status modal.
  - **Phase 2 — Worker Agronomic Plot Intelligence & Permanent Domain (Months 1–2):** Add plot-level worker data across Plots 1–45 (**what is currently planted**, **tree counts**, **planting schedules**, and **Annual/Perennial vs. Monthly/Seasonal** plot classifications) and bind a permanent custom domain.
  - **Phase 3 — Unlocking DA-RARES, DA-QARES & DA-CARES (Months 3–6):** Complete the remaining `< 300 KB` 3D building models and directories for RARES, QARES, and CARES and unlock them publicly.
- **Visual to Show:** **3 System Name Proposals Comparison Card + 3-Phase Roadmap Table**.

---

## Screenshot Capture Checklist & Reproduction Steps

Capture the following **12 screenshots** at `1920x1080` (for Web/Kiosk slides) and `400x840` (for Mobile Phone slides) with `node server.js` running at `http://localhost:8080`:

| Screenshot ID | Slide(s) | Target State to Capture | Exact Steps to Reproduce |
| :--- | :---: | :--- | :--- |
| **`SS-01`** | Slide 1 | **Welcome Modal, 4-Station Selector & Under-Dev Modal** | 1. Open `http://localhost:8080/?deployed=1` in a browser window (`1920x1080`).<br>2. Click the station dropdown to show all 4 stations (`DA-LARES`, `DA-QARES`, `DA-RARES`, `DA-CARES`), and capture the **"Station Under Development"** modal when selecting QARES/RARES/CARES. |
| **`SS-02`** | Slides 2, 4 | **Default 3D Campus Overview & Directory** | 1. Click **Proceed to Campus Map** on DA-LARES and wait 4 seconds for the 3D fly-in to settle.<br>2. Ensure the left sidebar shows `LARES BUILDINGS (39)` and the `📍 You Are Here` pin is visible at Argosino Hall.<br>3. Capture the full window. |
| **`SS-03`** | Slide 5 | **Office Acronym Search & Category Filter** | 1. In the left sidebar search box (`#search-input`), type **`BAC`** (or **`Cashier`**) so matching buildings display the green `🏢` office badge beneath their title.<br>2. Click the **Filter** button next to the search bar so the 7-category dropdown menu is open.<br>3. Capture the left half of the screen or full window. |
| **`SS-04`** | Slide 6 | **3D Building Inspection & Detail Drawer** | 1. Clear the search bar and click **`#9 RAED Building`** (or **`#21 R&D Multipurpose Building`**).<br>2. Wait 2 seconds for the camera to center on the 3D model at 54° pitch.<br>3. Ensure the right-hand drawer shows the `.webp` hero photo, **How to Spot It**, **What's Inside**, office chips, and QR code.<br>4. Capture the full window. |
| **`SS-05`** | Slide 7 | **Agricultural Plot Zone & Sub-Plots (Visitor & Worker View)** | 1. Click **Filter** → select **Agri-Eco Trial Sites** (or **Orchard & Plantation**).<br>2. Click **TC Makapuno & Banana Screenhouse (`Plot 17`)** or **Coffee Orchard (`Plot 22`)**.<br>3. Wait for the camera to frame the illuminated plot perimeter and sub-plot cut lines, with the sub-plot cards visible in the right drawer.<br>4. Capture the full window. |
| **`SS-06`** | Slide 8 | **Active Pedestrian Route & Turn-by-Turn Steps** | 1. Select **`#32 LARES Synthetic Fertilizer Storage / LARES Pesticide Storage`** (or **`#25 Regional Soils Laboratory`**) and click **Get Directions**.<br>2. Click **`Top View`** in the bottom-right camera bar so the entire green route and landmark turn list (`#route-info`) are clearly visible.<br>3. Capture the full window. |
| **`SS-07`** | Slide 9 | **Animated Walker, X-Ray Occlusion & Arrival Banner** | 1. On an active route, click **`Side View`** and set speed to **`2x`**.<br>2. Capture a frame as the walker passes behind a 3D building that has turned semi-transparent (frosted glass), or as the walker arrives at `#32` showing the top **Arrived** notification banner. |
| **`SS-08`** | Slide 10 | **Enlarged QR Code Handoff Modal** | 1. With a building drawer or active route open, click **Tap QR to Enlarge** (`openQRZoomModal()`).<br>2. Capture the centered high-contrast QR modal (`#qr-zoom-modal`) showing the destination name and step instructions. |
| **`SS-09`** | Slides 4, 10 | **Mobile Phone Route & Live GPS HUD (`400x840`)** | 1. Open `http://localhost:8080/?dest=rnd_building&mode=phone` in a window sized to `400x840` (Chrome/Edge DevTools Device Toolbar: *iPhone 14 Pro*).<br>2. Capture the mobile view showing the top turn-by-turn maneuver banner (`#phone-top-nav-hud`), the 3D route, the **Use My Live GPS** prompt card, and the bottom sheet. |
| **`SS-10`** | Slide 12 | **Map Settings, Label Modes, Lighting & Performance Profile** | 1. Return to the Kiosk view (`1920x1080`) and click the **Gear (Map Settings)** button in the top-right toolbar.<br>2. Capture the open settings popover showing Layer Toggles, **Full Pill View / Compact Number**, **Dawn/Day/Dusk/Night** buttons, and **Performance Profile**. |
| **`SS-11`** | Slide 13 | **Admin Mode — Draggable Pin & Drone Calibration HUD** | 1. Open `http://localhost:8080/?admin=1` (or press `Alt + Shift + A`).<br>2. Click the **Drone Calibration** button in the top-right toolbar (or press `Alt + Shift + D`).<br>3. Capture the screen showing both the yellow **`📍 You Are Here 🔓 (Drag to move)`** pin and the floating **Drone Calibration HUD**. |
| **`SS-12`** | Slide 13 | **Multi-Station Authoring Suite (`road_draw.html` / `pill_adjust.html`)** | 1. Open `http://localhost:8080/road_draw.html` or `http://localhost:8080/pill_adjust.html` (`1920x1080`).<br>2. Zoom into the central compound showing the green road segments, dashed walkways, and building entrance/pill nodes over the drone map.<br>3. Capture the full window. |

---

## Verification — Files Read to Produce This Document

- `docs/00-system-overview.md`, `docs/00-one-page-summary.md`, `docs/01-modules.md`, `docs/02-use-cases.md`, `docs/03-limitations-and-roadmap.md`, `docs/04-demo-script.md`
- `index.html`, `server.js`, `road_draw.html`, `draw.html`, `plot_draw.html`, `pill_adjust.html`
- `js/app.js`, `js/stations.js`, `js/mode.js`, `js/sidebar.js`, `js/building-panel.js`, `js/plot-layers.js`, `js/routing.js`, `js/steps.js`, `js/walker.js`, `js/occlusion.js`, `js/qr.js`, `js/gps.js`, `js/phone-ui.js`, `js/phone-nav.js`, `js/orbit-control.js`, `js/map-settings.js`, `js/performance.js`, `js/idle.js`, `js/drone-calibration.js`
- `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`, `js/data/stations.js`
