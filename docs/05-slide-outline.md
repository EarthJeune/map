# DA-LARES Interactive 3D Campus Wayfinding System — Presentation Slide Outline (14 Slides)

**Presentation Title:** DASH: DA-LARES Interactive 3D Campus Wayfinding & Mobile GPS System — Tech Update  
**Audience:** DA CALABARZON (Region IV-A) Supervisors, Division/Station Staff, and IT Colleagues  
**Note:** Security hardening items are intentionally excluded from these public slides and kept in [`docs/03-limitations-and-roadmap.md`](file:///c:/Users/LGU-SanPedro/Downloads/map/docs/03-limitations-and-roadmap.md).

---

## Slide-by-Slide Outline (14 Slides)

### Slide 1: Title & Vision — Modernizing Campus Navigation at DA-LARES
- **Bullets:**
  - Introducing **DASH (DA-LARES Interactive 3D Campus Wayfinding System)** for the Lipa Agricultural Research and Experiment Station in Lipa City, Batangas.
  - Combines a **lobby touchscreen kiosk** at Argosino Hall with **QR-code smartphone GPS navigation**—requiring zero mobile app downloads.
  - Guides farmers, researchers, suppliers, and guests across **39 numbered buildings**, **47 internal offices**, and **45 experimental crop plots**.
- **Visual to Show:** **Screenshot `SS-01`** (Welcome Modal over the 3D aerial view of the DA-LARES compound) or a split composite of `SS-01` and `SS-02`.

---

### Slide 2: The Challenge — Why Visitors Need Self-Service Wayfinding
- **Bullets:**
  - **Complex Multi-Hectare Research Compound:** DA-LARES spans dozens of specialized laboratories, offices, warehouses, screenhouses, and orchards spread along **$2.68\text{ km}$** of internal roads and walkways.
  - **Visitors Know Services, Not Building Numbers:** Guests typically ask *"Where is the BAC?"*, *"Where do I submit soil samples?"*, or *"Where is the Cashier?"* rather than asking for Building `#12` or `#25`.
  - **Staff Time Spent Giving Directions:** Guards and front-desk personnel repeatedly stop their work to give verbal directions, especially during regional summits and farmer trainings at Argosino Hall.
  - **Static Signboards Stay Behind:** Traditional tarpaulin maps cannot follow a visitor once they walk out of the lobby.
- **Visual to Show:** **Screenshot `SS-02`** (Full 3D Campus Overview showing the density of the 39 numbered facilities and surrounding agricultural plots).

---

### Slide 3: System at a Glance — By the Numbers
- **Bullets:**
  - **Complete 3D Architectural Coverage:** **50** mapped building footprints at DA-LARES (**39** numbered facilities + **9** screenhouse/annex structures + **2** Plot 22 utility amenities) powered by **48 custom 3D building models** (`< 300 KB` each) and **131 3D trees**.
  - **Searchable Office & Plot Directory:** **47 internal offices/units** across **9** multi-office buildings, **3** embedded conference halls, and **45 agricultural field plots** grouped into **23 official commodity zones**.
  - **100% Verified Pedestrian Network:** **104** mapped road/walkway features (**56** roads, **3** walkways, **45** building entrances) forming a **2,678-node** routing graph where every entrance is verified reachable.
  - **Ultra-Sharp Offline Drone Base Map:** **$10.29\text{ GB}$** high-resolution drone orthomosaic (`LARES v1.mbtiles`) served directly from the local kiosk PC in under 1 millisecond per tile.
- **Visual to Show:** **"By the Numbers" Infographic Table** (from Section 1 of `docs/00-system-overview.md`).

---

### Slide 4: Dual-Mode Experience — Lobby Kiosk + Visitor Smartphone
- **Bullets:**
  - **Single Codebase, Four Adaptive Modes:** Automatically adapts between **Kiosk Landscape**, **Kiosk Portrait Totem**, **Mobile Phone Mode**, and **Admin Mode** (`js/mode.js`).
  - **At the Lobby Kiosk:** Visitors browse the left directory, inspect 3D buildings and photos in the right-hand drawer, and watch an animated 3D route preview from the `"📍 You Are Here"` pin at Argosino Hall.
  - **On the Visitor's Smartphone:** Scanning the on-screen QR code transfers the exact destination and route to the visitor's phone with a thumb-friendly bottom sheet and live GPS tracking.
- **Visual to Show:** **System Context Diagram** (from Section 4 of `docs/00-system-overview.md`) or side-by-side **Screenshots `SS-02` (Kiosk) and `SS-09` (Phone)**.

---

### Slide 5: Smart Directory — Searching by Building, Office Acronym, or Category
- **Bullets:**
  - **Instant Multi-Entity Search (`js/sidebar.js`):** Typing an acronym like `BAC`, `PMED`, `CASHIER`, or `RSBSA` immediately filters to the parent building and displays a highlighted green office pill (`🏢 BAC`) beneath it.
  - **7 Official Facility Categories:** One-tap dropdown filtering across *Agri Infrastructure (16)*, *Agri-Eco Trial Sites (10)*, *Orchard & Plantation (11)*, *Office Buildings (11)*, *Research Laboratories (10)*, *Conference & Training (1)*, and *Digital Agriculture (1)*.
  - **Clean Default Directory:** Keeps the main list focused on the **39 numbered buildings**, while surfacing unnumbered field utilities (like the *LARES Water Tank* and *Plot 22 Comfort Room*) when searched or filtered under *Agri Infrastructure*.
- **Visual to Show:** **Screenshot `SS-03`** (Sidebar search for `"BAC"` or `"Cashier"` showing matched office badges and the 7-category filter dropdown).

---

### Slide 6: Human-Centered Building Cards — "How to Spot It" & Multi-Angle Photos
- **Bullets:**
  - **Authentic 3D Inspection Orbit:** Selecting any facility flies the camera to a $54^\circ$ 3D perspective and smoothly orbits its custom 3D model (`js/idle.js`).
  - **Ground-Truth Field Photography:** Displays **62 real campus photographs** with multi-angle view chips (*Front*, *Side*, *Signage*) and a full-screen pinch-to-zoom lightbox.
  - **Two-Tier Visitor Guidance (`js/data/descriptions.js`):** Replaces technical descriptions with **How to Spot It** (roof color, porch style, visible signage) and **What's Inside & Services**, plus clickable office chips.
- **Visual to Show:** **Screenshot `SS-04`** (`#9 RAED Building` or `#21 R&D Multipurpose Building` selected with 3D model centered and right-hand detail drawer open).

---

### Slide 7: Agricultural Research Plots — 23 Commodity Zones (Plots 1–45)
- **Bullets:**
  - **Complete Field Plot Mapping (`js/data/plots.js`):** Covers all **45 numbered experimental plots** organized into **23 official commodity zones** (Citrus Orchard, Coffee Orchard, Corn Seed Production, Cassava, Vegetable Trials, and Screenhouses).
  - **Clean Overview, Detailed Selection (`js/plot-layers.js`):** Displays clean outer zone perimeters on overview and illuminates internal sub-plot cut lines when a zone is selected.
  - **Screenhouse & Utility Sub-Plots:** Selecting **Plot 17** (*TC Makapuno & Banana Screenhouse*), **Plot 18** (*Coffee & Citrus Screenhouse*), or **Plot 22** (*Coffee Orchard*) lets visitors tap individual screenhouses (`1`–`9`), the *LARES Water Tank*, or the *Plot 22 Comfort Room*.
- **Visual to Show:** **Screenshot `SS-05`** (*TC Makapuno & Banana Screenhouse — Plot 17* or *Coffee Orchard — Plot 22* illuminated on the drone map with sub-plot cards in the drawer).

---

### Slide 8: Pedestrian Routing & Landmark Turn-by-Turn Directions
- **Bullets:**
  - **1-Meter Precision Road Graph (`js/routing.js`):** Subdivides **$2,684\text{ m}$** of compound roads and walkways into **2,678 nodes**, connecting all **45 building entrances** directly to their front doors.
  - **Landmark-Based Turn Instructions (`js/steps.js`):** Translates geometric turns into natural human directions referencing the actual building at each corner (e.g., *"Turn right at MIS / RAFIS Building — 36 m"*).
  - **Interactive Step Inspection:** Tapping any step in the directions list flies the 3D camera directly to that intersection so the visitor can preview the turn before walking.
- **Visual to Show:** **Screenshot `SS-06`** (Active route from Argosino Hall to a warehouse/laboratory showing the glowing green path, step-by-step landmark list, and QR card).

---

### Slide 9: 3D Animated Walkthrough & Smart "X-Ray" Building Transparency
- **Bullets:**
  - **Animated Claymation Walker (`js/walker.js`):** Walks the route in real time while trimming the completed path behind the avatar and updating the top turn banner.
  - **Dynamic Frosted-Glass Occlusion (`js/occlusion.js`):** Whenever a 3D building stands between the camera and the walker, that building automatically fades to **$25\%$ frosted-glass opacity** so the walker and route are never hidden.
  - **Visitor Playback Controls:** Includes **`1x`, `2x`, `4x`, and `6x`** speed buttons, **Side View / Top View / Unlocked** camera modes, **Replay Walk**, and an adaptive arrival banner with a 10-second auto-return countdown.
- **Visual to Show:** **Screenshot `SS-07`** (Close-up of the walker mid-route with an obstructing 3D building rendered translucent and the speed/camera controls visible).

---

### Slide 10: Seamless QR Handoff & Live Smartphone GPS Navigation
- **Bullets:**
  - **Scan and Go (`js/qr.js`):** Every building drawer and route panel displays a live QR code (with a full-screen **Tap QR to Enlarge** modal) that opens the route over HTTPS via our Cloudflare tunnel.
  - **Live GPS Road-Snapping & Compass (`js/gps.js`):** Tracks the visitor's real-time outdoor location, snaps the blue dot to the walkway, rotates a directional cone using the phone's hardware compass, and counts down remaining meters.
  - **Automatic Off-Route Rerouting & Arrival Alert (`js/phone-nav.js`):** Automatically computes a new route if the visitor wanders more than **$28\text{ m}$** off path, vibrates the phone within **$12\text{ m}$** of the entrance, and falls back to simulated preview if opened $>500\text{ m}$ outside the compound.
  - **100% Privacy-First:** Smartphone GPS coordinates are processed strictly inside the visitor's phone browser memory and are **never sent to or stored on the server**.
- **Visual to Show:** **Screenshots `SS-08` (Enlarged QR Modal on Kiosk) and `SS-09` (Mobile Phone Live Navigation View)** side by side.

---

### Slide 11: Architecture & Offline Resilience (Under the Hood)
- **Bullets:**
  - **Modern Zero-Build Modular Stack:** **26 ES JavaScript modules** (`js/` + `js/data/`), **Mapbox GL JS v3.31.0**, **Turf.js**, and a local **Node.js + Express** server (`server.js`) on port `8080`.
  - **Sub-Millisecond Offline Drone Streaming:** Streams the $10.29\text{ GB}$ `LARES v1.mbtiles` SQLite database locally with a 300-tile RAM cache—requiring zero internet bandwidth for aerial drone tiles.
  - **3-Tier Database Fail-Safe:** Settings (`kiosk_pin`, `drone_offset`, `building_colors`) save to **MySQL** first, automatically mirror to local **JSON files** (`pin.json`, `colors.json`), and fall back to **in-memory defaults** so the kiosk never crashes even if the database service stops.
- **Visual to Show:** **4-Layer Architecture Diagram** (from Section 5 of `docs/00-system-overview.md`) or the **3-Tier Database Resilience Flowchart** (from `docs/DEPLOYMENT_GUIDE.md`).

---

### Slide 12: Hardware Optimization, Accessibility & 24/7 Kiosk Operations
- **Bullets:**
  - **Adaptive GPU & Battery Profiles (`js/performance.js`):** Automatically detects integrated Intel HD/UHD graphics or mobile processors, offering **Kiosk Eco Mode** on totems and **Battery Saver Mode** on phones, plus automatic fallback if frame rate dips below 26 FPS.
  - **45-Second Idle Reset & 5-Minute Thermal Eco-Rest (`js/idle.js`):** Automatically clears abandoned routes after 45 seconds of inactivity and pauses 3D rotation after 5 minutes to keep the kiosk PC cool 24/7.
  - **1-Finger Orbit Accessibility (`js/orbit-control.js`):** Includes a dedicated one-finger 3D orbit toggle and Full/Compact label modes (`js/map-settings.js`) so every visitor can navigate comfortably.
- **Visual to Show:** **Screenshot `SS-10`** (Map Settings popover showing Layer Toggles, Dawn/Day/Dusk/Night Lighting, and the Hardware/Battery Performance Profile selector).

---

### Slide 13: Easy Administration & Multi-Station Scalability
- **Bullets:**
  - **Drag-and-Drop "You Are Here" Pin (`js/idle.js`):** If the kiosk totem is relocated to another building for a special event, an administrator unlocks the pin in Admin Mode and drags it to the new spot—all routes recalculate automatically.
  - **Built-In Visual Authoring Suite:** Includes browser-based editors for building footprints (`draw.html`), roads and entrances (`road_draw.html`), agricultural plots (`plot_draw.html`), 3D trees (`tree_draw.html`), and real-time drone alignment (`js/drone-calibration.js`).
  - **Ready for Region IV-A Expansion (`js/data/stations.js`):** Already includes a multi-station switcher with initial aerial drone imagery ($234\text{ MB}$), 48 building footprints, and 31 road segments for **DA-QARES (Tiaong, Quezon)**.
- **Visual to Show:** **Screenshot `SS-11`** (Admin Mode showing the unlocked yellow draggable `"You Are Here"` pin and Drone Calibration HUD) or **`SS-12`** (Road & Entrance Editor `road_draw.html`).

---

### Slide 14: Current Status Summary & Next Steps Roadmap
- **Bullets:**
  - **Complete Today (`IMPLEMENTED`):** Full DA-LARES 3D campus (48 3D models, 39 numbered buildings, 47 offices, 45 field plots, $2.68\text{ km}$ road network, $10.29\text{ GB}$ offline drone map, animated walker, QR handoff, and live phone GPS).
  - **Phase 1 — Pre-Launch Setup (Days 1–3):** Finalize kiosk PC auto-start shortcuts (`start_kiosk.bat`), local library bundling for offline refreshes, and admin write-protection.
  - **Phase 2 — Post-Launch Enhancements (Weeks 2–4):** Bind a permanent custom domain (`map.da-lares.gov.ph`) via a named Cloudflare tunnel, split `css/main.css` into modular stylesheets, and add anonymous usage counters.
  - **Phase 3 — Regional Rollout (Months 2–6):** Complete bespoke 3D building models and office directories for **DA-QARES (Tiaong)** and add an English / Tagalog language toggle for farmer visitors.
- **Visual to Show:** **3-Phase Roadmap Summary Table** (from Section 5 of `docs/03-limitations-and-roadmap.md`, excluding security vulnerability details).

---

## Screenshot Capture Checklist & Reproduction Steps

Capture the following **12 screenshots** at `1920x1080` (for Kiosk slides) and `400x840` (for Mobile Phone slides) with `node server.js` running at `http://localhost:8080`:

| Screenshot ID | Slide(s) | Target State to Capture | Exact Steps to Reproduce |
| :--- | :---: | :--- | :--- |
| **`SS-01`** | Slide 1 | **Welcome Modal & Station Branding** | 1. Open `http://localhost:8080` in a fresh browser window (`1920x1080`).<br>2. Wait 2 seconds for the background aerial map to finish loading.<br>3. Capture the screen with the **Welcome to DA-LARES** modal centered. |
| **`SS-02`** | Slides 2, 4 | **Default 3D Campus Overview & Directory** | 1. Click **Proceed to Campus Map** and wait 4 seconds for the 3D fly-in to settle.<br>2. Ensure the left sidebar shows `LARES BUILDINGS (39)` and the `📍 You Are Here` pin is visible at Argosino Hall.<br>3. Capture the full window. |
| **`SS-03`** | Slide 5 | **Office Acronym Search & Category Filter** | 1. In the left sidebar search box (`#search-input`), type **`BAC`** (or **`Cashier`**) so matching buildings display the green `🏢` office badge beneath their title.<br>2. Click the **Filter** button next to the search bar so the 7-category dropdown menu is open.<br>3. Capture the left half of the screen or full window. |
| **`SS-04`** | Slide 6 | **3D Building Inspection & Detail Drawer** | 1. Clear the search bar and click **`#9 RAED Building`** (or **`#21 R&D Multipurpose Building`**).<br>2. Wait 2 seconds for the camera to center on the 3D model at $54^\circ$ pitch.<br>3. Ensure the right-hand drawer shows the hero photo, **How to Spot It**, **What's Inside**, office chips, and QR code.<br>4. Capture the full window. |
| **`SS-05`** | Slide 7 | **Agricultural Plot Zone & Sub-Plots** | 1. Click **Filter** $\rightarrow$ select **Agri-Eco Trial Sites** (or **Orchard & Plantation**).<br>2. Click **TC Makapuno & Banana Screenhouse (`Plot 17`)** or **Coffee Orchard (`Plot 22`)**.<br>3. Wait for the camera to frame the illuminated plot perimeter and sub-plot cut lines, with the sub-plot cards visible in the right drawer.<br>4. Capture the full window. |
| **`SS-06`** | Slide 8 | **Active Pedestrian Route & Turn-by-Turn Steps** | 1. Select **`#32 LARES Synthetic Fertilizer Storage / LARES Pesticide Storage`** (or **`#25 Regional Soils Laboratory`**) and click **Get Directions**.<br>2. Click **`Top View`** in the bottom-right camera bar so the entire green route and landmark turn list (`#route-info`) are clearly visible.<br>3. Capture the full window. |
| **`SS-07`** | Slide 9 | **Animated Walker, X-Ray Occlusion & Arrival Banner** | 1. On an active route, click **`Side View`** and set speed to **`2x`**.<br>2. Capture a frame as the walker passes behind a 3D building that has turned semi-transparent (frosted glass), or as the walker arrives at `#32` showing the top **Arrived** notification banner. |
| **`SS-08`** | Slide 10 | **Enlarged QR Code Handoff Modal** | 1. With a building drawer or active route open, click **Tap QR to Enlarge** (`openQRZoomModal()`).<br>2. Capture the centered high-contrast QR modal (`#qr-zoom-modal`) showing the destination name and step instructions. |
| **`SS-09`** | Slides 4, 10 | **Mobile Phone Route & Live GPS HUD (`400x840`)** | 1. Open `http://localhost:8080/?dest=rnd_building&mode=phone` in a window sized to `400x840` (Chrome/Edge DevTools Device Toolbar: *iPhone 14 Pro*).<br>2. Capture the mobile view showing the top turn-by-turn maneuver banner (`#phone-top-nav-hud`), the 3D route, the **Use My Live GPS** prompt card, and the bottom sheet. |
| **`SS-10`** | Slide 12 | **Map Settings, Lighting & Performance Profile** | 1. Return to the Kiosk view (`1920x1080`) and click the **Gear (Map Settings)** button in the top-right toolbar.<br>2. Capture the open settings popover showing Layer Toggles, **Dawn/Day/Dusk/Night** buttons, and **Kiosk Performance Profile** (`⚡ Auto`, `🌿 Kiosk Eco`, `💎 High`). |
| **`SS-11`** | Slide 13 | **Admin Mode — Draggable Pin & Drone Calibration HUD** | 1. Open `http://localhost:8080/?admin=1` (or press `Alt + Shift + A`).<br>2. Click the **Drone Calibration** button in the top-right toolbar (or press `Alt + Shift + D`).<br>3. Capture the screen showing both the yellow **`📍 You Are Here 🔓 (Drag to move)`** pin and the floating **Drone Calibration HUD**. |
| **`SS-12`** | Slide 13 | **Road & Entrance Network Editor (`road_draw.html`)** | 1. Open `http://localhost:8080/road_draw.html` (`1920x1080`).<br>2. Zoom into the central compound showing the green road segments, dashed walkways, and building entrance nodes over the drone map.<br>3. Capture the full window. |

---

## Verification — Files Read to Produce This Document

- `docs/00-system-overview.md`, `docs/00-one-page-summary.md`, `docs/01-modules.md`, `docs/02-use-cases.md`, `docs/03-limitations-and-roadmap.md`, `docs/04-demo-script.md`
- `index.html`, `server.js`, `road_draw.html`, `draw.html`, `plot_draw.html`
- `js/app.js`, `js/mode.js`, `js/sidebar.js`, `js/building-panel.js`, `js/plot-layers.js`, `js/routing.js`, `js/steps.js`, `js/walker.js`, `js/occlusion.js`, `js/qr.js`, `js/gps.js`, `js/phone-ui.js`, `js/phone-nav.js`, `js/orbit-control.js`, `js/map-settings.js`, `js/performance.js`, `js/idle.js`, `js/drone-calibration.js`
- `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`, `js/data/stations.js`

