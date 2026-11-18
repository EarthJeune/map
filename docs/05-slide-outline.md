# DA-CALABARZON Interactive 3D Research Station Mapping & Wayfinding System — Presentation Slide Outline (15 Slides)

**Presentation Title:** DA-CALABARZON Interactive 3D Research Station Mapping, Wayfinding & Plot Intelligence System — Tech Update *(System name: to be decided.)*  
**Audience:** DA CALABARZON (Region IV-A) Supervisors, Division/Station Staff, Researchers, and IT Colleagues  
**Note:** Internal security hardening recommendations are intentionally excluded from these presentation slides and documented in `docs/03-limitations-and-roadmap.md`.

---

## Slide-by-Slide Outline (15 Slides)

### Slide 1: Title & Regional Vision — A Unified 3D Interactive Map for All DA-CALABARZON Research Stations
- **Bullets:**
  - A unified interactive 3D mapping and wayfinding platform connecting all four regional research stations across DA-CALABARZON.
  - Interactive Welcome Screen features a 4-station selector overlaid directly on the live 3D aerial view, allowing visitors and staff to immediately choose where they are or where they want to go.
  - Deployed for universal access across on-site touch kiosks, desktop browsers, and smartphones with zero app downloads.
  - The flagship Lipa City station is presented today as the first fully completed campus, with additional stations in active progress.
- **Speaker notes:**
  - When visitors, researchers, or station staff open the portal or approach an on-site touch kiosk, they are immediately greeted by an interactive 4-station selector overlaid over the live 3D aerial view, serving all four regional research stations: the Lipa Agricultural Research & Experiment Station (DA-LARES in Lipa City, Batangas), the Quezon Agricultural Research & Experiment Station (DA-QARES in Tiaong, Quezon), the Rizal Agricultural Research & Experiment Station (DA-RARES in Tanay, Rizal), and the Cavite Agricultural Research & Experiment Station (DA-CARES in Naic, Cavite).
  - Users can select their current location or target station with a single tap, immediately teleporting to that campus with smooth camera choreography.
  - The system is built on a single unified web codebase (`index.html`, modular ES JavaScript in `js/`, modular stylesheets in `css/`, and local server scripts in `server.js`).
  - Flagship DA-LARES is fully mapped and operational today, while DA-QARES, DA-RARES, and DA-CARES display official "Station Under Development" previews on the public portal while their authentic 3D models and field surveys advance.
- **Visual to Show:** **Screenshot `SS-01`** (Welcome Modal showing the 4-station selector over the 3D aerial view of DA-LARES plus the "Station Under Development" preview).

---

### Slide 2: Dual Purpose — Built for Both Campus Visitors AND Station Workers
- **Bullets:**
  - Visitors and stakeholders can quickly locate administrative offices, laboratories, and service desks by name or acronym.
  - Agricultural researchers and field personnel gain an interactive directory of experimental field plots and facilities.
  - Station supervisors can review active crop varieties, plant counts, and designated crop cycles across every plot.
  - Replaces static printed campus tarpaulins with a dynamic visual guide that accompanies visitors outdoors.
- **Speaker notes:**
  - Visitors rarely know building numbers and instead search for divisions like Bids and Awards, Cashier, or Soil Chemistry; the system connects those services directly to physical doorways.
  - For station researchers, agronomists, and farm superintendents, the platform acts as an operational field management tool covering 45 experimental agricultural plots across 23 official commodity zones.
  - Agronomic fields stored in the relational database include planted crop variety, tree count, planting cycle (perennial, annual, monthly trial), plot operational status, and worker field notes.
- **Visual to Show:** **Screenshot `SS-02`** (Full 3D Campus Overview showing the density of numbered facilities and surrounding agricultural plots).

---

### Slide 3: Flagship Campus at a Glance — System Metrics
- **Bullets:**
  - Covers fifty mapped building footprints powered by lightweight bespoke 3D architectural models.
  - Features forty-seven verified internal offices and units across nine multi-office facilities.
  - Maps forty-five experimental agricultural plots organized into twenty-three commodity zones.
  - Includes a pedestrian network connecting forty-three facility entrances over high-resolution drone imagery.
- **Speaker notes:**
  - Exact counts are verified in `docs/numbers.md` and `docs/technical-fact-sheet.md`: 50 LARES footprints (39 numbered facilities, 9 screenhouses, and 2 Plot 22 utilities); 148 total buildings across all stations in the database.
  - The 3D models are custom-built from ground-truth field photographs and strictly maintained under 300 KB each (totaling 54 GLB models in `models/`).
  - High-resolution drone orthomosaics are streamed from local SQLite MBTiles archives (210.66 MB for LARES, reduced by 98% from raw drone data).
  - The routing network comprises 101 road and entrance features in `roads.json`, building an in-memory graph of 2,668 nodes with 43 of 43 entrances fully connected across 2.68 kilometers of paths.
- **Visual to Show:** **"By the Numbers" Infographic Table** (from Section 1 of `docs/00-system-overview.md`).

---

### Slide 4: Dual Basemap Modes & Visual Perspectives — Photorealistic Drone Aerial View vs. Mapbox 3D Standard Mode
- **Bullets:**
  - Provides two distinct, instant-switch visual mapping modes tailored for field inspection and public wayfinding.
  - **Aerial Drone View Mode:** Renders bespoke sub-centimeter drone orthomosaics streamed offline from local MBTiles, revealing real vegetation, tree canopies, plot soils, and paved paths.
  - **Mapbox 3D Standard Mode:** Offers a clean, high-contrast 3D vector basemap with stylized terrain, roads, and standardized lighting for high-glare outdoor environments.
  - Preserves camera coordinates, pitch angle, active pedestrian navigation routes, and custom 3D architectural models seamlessly during live basemap switching.
- **Speaker notes:**
  - Handled dynamically by `js/map-setup.js` (`selectMapStyle('drone')` vs. `selectMapStyle('mapbox')`) and integrated into the top-right toolbar and `js/map-settings.js`.
  - Presenters and visitors can toggle between the two modes anytime using the quick-action button on the top-right toolbar (amber drone icon for Aerial Drone View, sky blue icon for Mapbox View).
  - In Drone mode, the system streams high-resolution drone orthomosaics from local SQLite MBTiles archives (`LARES v1.mbtiles` at 210.66 MB), bypassing external internet bandwidth while presenting authentic agricultural field reality.
  - In Mapbox Standard mode, the engine switches to vector cartography, offering high legibility and sharp contrast for outdoor kiosk users under direct sunlight or low-bandwidth connections.
  - In addition to basemap styles, the visual system provides multi-mode customization: **Camera Perspectives** (Top View 2D planimetric vs. Side View 3D tilted horizon), **Lighting Atmosphere** (Dawn, Day, Dusk, Night dynamic solar illumination), and **Facility Label Modes** (Full Pill View vs. Compact Number Badge).
- **Visual to Show:** **Screenshot `SS-02B`** (Side-by-side composite comparison of DA-LARES in Aerial Drone View vs. Mapbox 3D Standard View from the exact same camera angle).

---

### Slide 5: Omnichannel Access — Web, Lobby Kiosk, and Smartphone
- **Bullets:**
  - A single responsive codebase automatically adapts its interface for touch kiosks, desktop computers, and smartphones.
  - Remote visitors can explore campus grounds, search office directories, and preview walking paths before arriving.
  - On-site visitors browse interactive lobby displays and transfer directions to their mobile devices via QR codes.
  - Responsive touch controls provide an intuitive experience without requiring any special software installation.
- **Speaker notes:**
  - Device modes are governed by `js/mode.js` across four configurations: Public Desktop Web / Kiosk Landscape, Kiosk Portrait Totem (`index.html` on portrait hardware), Mobile Phone Mode (`?mode=phone`), and Authenticated Admin Mode (`/admin`).
  - Public online access allows farmers, suppliers, and regional guests to look up destinations from home or office before visiting.
  - At the station entrance or lobby (Argosino Hall), the touchscreen kiosk offers instant wayfinding, while scanning the screen handoff QR code opens the exact destination on the user's phone browser.
- **Visual to Show:** **System Context Diagram** (from Section 4 of `docs/00-system-overview.md`) or side-by-side **Screenshots `SS-02` (Web/Kiosk) and `SS-09` (Phone)**.

---

### Slide 6: Smart Directory — Acronym Search and Facility Categories
- **Bullets:**
  - Search filters instantly recognize common administrative acronyms and division abbreviations.
  - Matching offices are displayed as highlighted badges directly beneath their parent facilities.
  - Seven distinct facility categories enable quick browsing across offices, laboratories, orchards, and infrastructure.
  - Campus infrastructure and service amenities appear seamlessly when relevant searches or filters are applied.
- **Speaker notes:**
  - Handled by `js/sidebar.js` and `js/data/offices.js`. Typing acronyms such as BAC, PMED, CASHIER, or RSBSA immediately filters the directory and reveals an office badge (`BAC`, `Cashier`) beneath the host building card.
  - The seven verified categories are: Agri Infrastructure (16 facilities), Agri-Eco Trial Sites (10), Orchard and Plantation (11), Office Buildings (11), Research Laboratories (10), Conference and Training (1), and Digital Agriculture (1).
  - Unnumbered field utilities like the LARES Water Tank and Comfort Room are cleanly omitted from the primary numbered building list (`1`–`39`) but surface automatically upon typing matching search terms or filtering by Agri Infrastructure.
- **Visual to Show:** **Screenshot `SS-03`** (Sidebar search for `"BAC"` or `"Cashier"` showing matched office badges and the 7-category filter dropdown).

---

### Slide 7: Visual Guidance — Building Cards and Real Photography
- **Bullets:**
  - Selecting any facility smoothly centers the 3D view and presents clear visual landmark descriptions.
  - Each facility card explains distinctive architectural cues such as roof shapes, entrance signs, and wall colors.
  - Real campus photographs provide visual confirmation from multiple exterior angles.
  - Detail panels display complete lists of divisions and services located inside each structure.
- **Speaker notes:**
  - Driven by `js/building-panel.js` and `js/data/descriptions.js`. Selecting a building triggers a camera flight to 54° pitch and engages an automated orbit inspection loop.
  - All 63 facility photos in `images/` are stored in optimized WebP format, featuring multi-angle switcher chips (Front Facade, Side Angle, Signage) and full-screen lightbox zoom.
  - Description copy offers two-tier guidance: "How to Spot It" highlights physical architectural cues (roof geometry, paint colors, front verandas), while "What's Inside and Services" details divisions, conference halls, and public service windows.
- **Visual to Show:** **Screenshot `SS-04`** (`#9 RAED Building` or `#21 R&D Multipurpose Building` selected with 3D model centered and right-hand detail drawer open).

---

### Slide 8: Agricultural Plot Intelligence — Research Fields and Crop Tracking
- **Bullets:**
  - Integrates complete digital boundaries for experimental crop plots and research screenhouses.
  - Displays real-time field information including active crop varieties, tree tallies, and designated planting cycles.
  - Differentiates perennial fruit orchards from annual row crops and short-term trial plots.
  - Provides agricultural workers and supervisors with a centralized visual tool for tracking field operations.
- **Speaker notes:**
  - Implemented in `js/plot-layers.js` and `js/data/plots.js`, backed by the `agricultural_plots` and `plot_subplots` database tables.
  - Covers 45 numbered agricultural plots organized into 23 official commodity zones (including Citrus Orchard, Coffee Orchard, Corn Seed Production, Cassava, and Screenhouse complexes).
  - Tapping a plot illuminates its perimeter boundary, reveals internal division lines, and displays live agronomic fields (`current_crop`, `tree_count`, `planting_cycle`, `plot_status`, and `worker_notes`).
  - Screenhouses in Plot 17 (Screenhouses 1–5) and Plot 18 (Screenhouses 6–9) are mapped as interactive sub-plots that zoom the camera and update drawer details.
- **Visual to Show:** **Screenshot `SS-05`** (*TC Makapuno & Banana Screenhouse — Plot 17* or *Coffee Orchard — Plot 22* illuminated on the drone map with live agronomic fields and sub-plot cards in the drawer).

---

### Slide 9: Pedestrian Wayfinding — Landmark-Based Turn Instructions
- **Bullets:**
  - A high-density walking graph accurately calculates the shortest accessible route between any two campus points.
  - Route instructions use visible building landmarks rather than abstract compass directions.
  - Every entrance node connects directly to the compound walkway system for seamless navigation.
  - Users can preview turns in advance by tapping individual maneuvers along the calculated path.
- **Speaker notes:**
  - Managed by `js/routing.js` and `js/steps.js`. The pathfinding engine runs Dijkstra's shortest-path algorithm over 2.68 kilometers of surveyed roads and walkways in `roads.json`.
  - The graph subdivides road polylines into 2,668 accessible nodes, connecting all 43 building entrance nodes directly to the pedestrian network.
  - Instructions use human landmark phrasing (e.g., *"Turn right at MIS / RAFIS Building — 36 m"*) calculated by detecting the closest building polygon adjacent to each turn vertex.
  - Tapping any turn step in the sidebar list flies the 3D camera directly to that intersection so visitors can preview turns before walking.
- **Visual to Show:** **Screenshot `SS-06`** (Active route from Argosino Hall to a laboratory showing the green route path, step-by-step landmark list, and QR card).

---

### Slide 10: Interactive Previews — Animated Walking and Dynamic Building Transparency
- **Bullets:**
  - An animated figure demonstrates the walking route across the 3D campus in real time.
  - Buildings automatically become translucent whenever they obstruct the view of the pedestrian pathway.
  - Adjustable preview speeds and camera perspectives let visitors inspect routes from multiple viewpoints.
  - Clear arrival indicators confirm reaching the destination before automatically returning to the main view.
- **Speaker notes:**
  - Handled by `js/walker.js` and `js/occlusion.js`. The 3D avatar traverses the path while trimming the completed trail behind it and synchronizing the top turn banner.
  - Occlusion logic casts a ray from the camera to the walker; any 3D building intersecting this line of sight automatically shifts to 25% frosted-glass opacity so the avatar and pathway remain visible.
  - Controls include 1x, 2x, 4x, and 6x playback speeds, Top View and Side View presets, and a 10-second countdown arrival banner that cleanly returns the camera to overview mode.
- **Visual to Show:** **Screenshot `SS-07`** (Close-up of the walker mid-route with an obstructing 3D building rendered translucent and preview controls visible).

---

### Slide 11: Mobile Navigation — Live Smartphone Positioning and Privacy
- **Bullets:**
  - Visitors can scan an on-screen QR code to open their calculated walking route on their phone.
  - Real-time location tracking snaps the user's position to the campus footpath network and recalculates if they step off path.
  - The map server does not receive or store the visitor's GPS location; location is used on the phone only to draw the position and directions.
  - Third-party map and font services receive the usual web requests.
- **Speaker notes:**
  - Governed by `js/qr.js`, `js/gps.js`, and `js/phone-nav.js`. The QR code encodes destination and origin parameters over HTTPS.
  - The mobile view tracks GPS position with road-snapping, rotates a directional view cone using the device compass, and counts down distance to destination.
  - If a visitor diverges more than 28 meters from the path, the engine automatically recomputes a fresh route; upon arriving within 12 meters, haptic vibration alerts the user.
  - Privacy: The map server does not receive or store the visitor's GPS location. Location is used on the phone only to draw the position and directions. Third-party map and font services receive the usual web requests.
- **Visual to Show:** **Screenshots `SS-08` (Enlarged QR Modal on Kiosk) and `SS-09` (Mobile Phone Live Navigation View)** side by side.

---

### Slide 12: System Architecture — Relational Database and Offline Drone Imagery
- **Bullets:**
  - Built on a modular frontend architecture paired with a local backend server and relational database.
  - High-resolution drone orthomosaics are streamed locally from compact spatial data archives.
  - Dedicated 3D scene layers isolate individual research stations to provide smooth station switching.
  - Automatic local fallbacks ensure core mapping and wayfinding continue operating when the database is unavailable.
- **Speaker notes:**
  - Technical architecture detailed in `docs/00-system-overview.md` and `docs/technical-fact-sheet.md`: 27 ES JavaScript modules, 8 domain CSS stylesheets, Mapbox GL JS, Turf.js, and a Node.js Express server (`server.js`).
  - The local database (`kiosk`) consists of 11 core relational tables (`stations`, `buildings`, `building_images`, `building_offices`, `building_entrances`, `agricultural_plots`, `plot_subplots`, `campus_trees`, `road_features`, `admin_audit_logs`, and `admin_users`).
  - Drone tiles are read locally from SQLite MBTiles files via `server.js` with an in-memory cache of 300 tiles, ensuring fast loading without external map bandwidth dependencies.
  - If database services are temporarily offline, the server automatically serves cached local GeoJSON files (`pin.json`, `colors.json`, `drone_offset.json`) to keep the public map fully responsive.
- **Visual to Show:** **4-Layer Architecture Diagram** (from Section 5 of `docs/00-system-overview.md`).

---

### Slide 13: Operational Reliability — Adaptive Performance and Kiosk Management
- **Bullets:**
  - The rendering engine automatically detects hardware capabilities and adjusts graphics quality to prevent lag.
  - Dedicated power-saving profiles reduce thermal load to ensure dependable twenty-four-seven kiosk operation.
  - Inactive kiosk sessions reset automatically after forty-five seconds to welcome the next visitor.
  - Accessible one-finger orbit controls enable comfortable interaction on touchscreens and mobile devices.
- **Speaker notes:**
  - Governed by `js/performance.js`, `js/idle.js`, and `js/orbit-control.js`.
  - The 3-Tier Adaptive Performance Controller inspects the GPU and CPU on startup. On integrated graphics, it automatically disables expensive full-screen blur filters while preserving crisp text. If active frame rates drop below 45, 34, or 25 FPS during animations, canvas resolution scales dynamically (1.00x, 0.85x, 0.75x) to maintain smooth motion.
  - The idle controller resets abandoned routes after 45 seconds of inactivity and suspends continuous 3D camera rotation after 5 minutes of stillness to prevent overheating.
  - For visitors with limited motor dexterity, the 1-Finger Orbit toggle allows rotating the 3D campus using a single touch or drag rather than two-finger pinch-rotations.
- **Visual to Show:** **Screenshot `SS-10`** (Map Settings popover showing Basemap Mode options, Layer Toggles, Full Pill vs. Compact Number mode, Dawn/Day/Dusk/Night Lighting, and Performance Profiles).

---

### Slide 14: Password-Protected Admin Portal & Regional Station Expansion
- **Bullets:**
  - Authorized staff can update campus facility records, photos, and agricultural plots through a password-protected portal.
  - Interactive map tools allow administrators to calibrate station starting pins and adjust campus boundaries.
  - Changes saved in the admin portal update open public map views immediately without requiring a page refresh.
  - Secondary research stations can be maintained in development mode and switched live with a single click as field surveys finish.
- **Speaker notes:**
  - The admin portal (`/admin` via `admin.html` and `database/admin_api.js`) provides an authenticated web interface for station supervisors, IT staff, and farm superintendents.
  - Administrative features include updating station deployment statuses, repositioning the "You Are Here" kiosk pin, managing building descriptions and photo galleries, organizing internal offices, and updating agricultural plot records.
  - Updates saved in the portal broadcast across browser contexts via `BroadcastChannel`, allowing open kiosk displays and public map tabs to reflect changes in real time.
  - Standalone browser geometry editors (`draw.html`, `road_draw.html`, `plot_draw.html`, `pill_adjust.html`) permit visual digitizing of building footprints, roads, and agricultural zones directly over drone imagery.
- **Visual to Show:** **Screenshot `SS-11`** (Web Admin Portal showing station switcher, KPI metric cards, and kiosk pin editor).

---

### Slide 15: Implementation Roadmap
- **Bullets:**
  - Official system name: **iGUIDE** (*Interactive Geospatial Unified Information Directory and Explorer*).
  - The initial launch phase is actively delivering the flagship campus map alongside the Admin & Station Reviewer portals (`/admin` + `/review` with 2-step Gmail OTP).
  - The second phase will bind a permanent custom government domain and establish privacy-safe analytics.
  - The third phase will expand custom 3D models and verified directories to the remaining regional research stations.
- **Speaker notes:**
  - Official system name: **iGUIDE** (*Interactive Geospatial Unified Information Directory and Explorer*).
  - Roadmap status:
    - **Phase 1 (IN PROGRESS):** Flagship DA-LARES deployment, kiosk touch totem integration, MySQL database with Admin & Station Reviewer approval workflow, adaptive GPU controller, and development gating for secondary stations.
    - **Phase 2 (Months 1–2):** Transitioning from temporary tunnel URLs to a permanent custom domain via Cloudflare Named Tunnel, alongside privacy-safe daily usage counters.
    - **Phase 3 (Months 3–6):** Delivery of remaining 3D building models, photo surveys, and directories for DA-RARES, DA-QARES, and DA-CARES.
- **Visual to Show:** **3-Phase Roadmap Table** (from Section 6 of `docs/03-limitations-and-roadmap.md`).

---

## Screenshot Capture Checklist & Reproduction Steps

Capture the following **13 screenshots** at `1920x1080` (for Web/Kiosk slides) and `400x840` (for Mobile Phone slides) with `node server.js` running at `http://localhost:8080`:

| Screenshot ID | Slide(s) | Target State to Capture | Exact Steps to Reproduce |
| :--- | :---: | :--- | :--- |
| **`SS-01`** | Slide 1 | **Welcome Modal, 4-Station Selector & Under-Dev Modal** | 1. Open `http://localhost:8080/?deployed=1` in a browser window (`1920x1080`).<br>2. Click the station dropdown to show all 4 stations (`DA-LARES`, `DA-QARES`, `DA-RARES`, `DA-CARES`), and capture the **"Station Under Development"** modal when selecting QARES/RARES/CARES. |
| **`SS-02`** | Slides 2, 5 | **Default 3D Campus Overview & Directory** | 1. Click **Proceed to Campus Map** on DA-LARES and wait 4 seconds for the 3D fly-in to settle.<br>2. Ensure the left sidebar shows `LARES BUILDINGS (39)` and the `📍 You Are Here` pin is visible at Argosino Hall.<br>3. Capture the full window. |
| **`SS-02B`** | Slide 4 | **Dual Basemap Modes (Aerial Drone View vs. Mapbox 3D Standard)** | 1. In DA-LARES, capture the campus in default **Aerial Drone View Mode** showing the high-resolution orthomosaic.<br>2. Click the map layer switcher in the top-right toolbar (or Map Settings) to toggle to **Mapbox View Mode**.<br>3. Capture side-by-side comparison from identical camera angle (`[121.1663, 13.9587]`, zoom 18.2, pitch 52°, bearing 165°). |
| **`SS-03`** | Slide 6 | **Office Acronym Search & Category Filter** | 1. In the left sidebar search box (`#search-input`), type **`BAC`** (or **`Cashier`**) so matching buildings display the green office badge beneath their title.<br>2. Click the **Filter** button next to the search bar so the 7-category dropdown menu is open.<br>3. Capture the left half of the screen or full window. |
| **`SS-04`** | Slide 7 | **3D Building Inspection & Detail Drawer** | 1. Clear the search bar and click **`#9 RAED Building`** (or **`#21 R&D Multipurpose Building`**).<br>2. Wait 2 seconds for the camera to center on the 3D model at 54° pitch.<br>3. Ensure the right-hand drawer shows the `.webp` hero photo, **How to Spot It**, **What's Inside**, office chips, and QR code.<br>4. Capture the full window. |
| **`SS-05`** | Slide 8 | **Agricultural Plot Zone & Sub-Plots (Visitor & Worker View)** | 1. Click **Filter** → select **Agri-Eco Trial Sites** (or **Orchard & Plantation**).<br>2. Click **TC Makapuno & Banana Screenhouse (`Plot 17`)** or **Coffee Orchard (`Plot 22`)**.<br>3. Wait for the camera to frame the illuminated plot perimeter and sub-plot cut lines, with the live agronomic fields and sub-plot cards visible in the right drawer.<br>4. Capture the full window. |
| **`SS-06`** | Slide 9 | **Active Pedestrian Route & Turn-by-Turn Steps** | 1. Select **`#32 LARES Synthetic Fertilizer Storage / LARES Pesticide Storage`** (or **`#25 Regional Soils Laboratory`**) and click **Get Directions**.<br>2. Click **`Top View`** in the bottom-right camera bar so the entire green route and landmark turn list (`#route-info`) are clearly visible.<br>3. Capture the full window. |
| **`SS-07`** | Slide 10 | **Animated Walker, X-Ray Occlusion & Arrival Banner** | 1. On an active route, click **`Side View`** and set speed to **`2x`**.<br>2. Capture a frame as the walker passes behind a 3D building that has turned semi-transparent (frosted glass), or as the walker arrives at `#32` showing the top **Arrived** notification banner. |
| **`SS-08`** | Slide 11 | **Enlarged QR Code Handoff Modal** | 1. With a building drawer or active route open, click **Tap QR to Enlarge** (`openQRZoomModal()`).<br>2. Capture the centered high-contrast QR modal (`#qr-zoom-modal`) showing the destination name and step instructions. |
| **`SS-09`** | Slides 5, 11 | **Mobile Phone Route & Live GPS HUD (`400x840`)** | 1. Open `http://localhost:8080/?dest=rnd_building&mode=phone` in a window sized to `400x840` (Chrome/Edge DevTools Device Toolbar: *iPhone 14 Pro*).<br>2. Capture the mobile view showing the top turn-by-turn maneuver banner (`#phone-top-nav-hud`), the 3D route, the **Use My Live GPS** prompt card, and the bottom sheet. |
| **`SS-10`** | Slide 13 | **Map Settings, Label Modes, Lighting & Performance Profile** | 1. Return to the Kiosk view (`1920x1080`) and click the **Gear (Map Settings)** button in the top-right toolbar.<br>2. Capture the open settings popover showing Layer Toggles, **Full Pill View / Compact Number**, **Dawn/Day/Dusk/Night** buttons, and **Performance Profile**. |
| **`SS-11`** | Slide 14 | **Web Admin Portal (`admin.html`)** | 1. Open `http://localhost:8080/admin` (`1920x1080`) pre-authenticated.<br>2. Capture the **Dashboard & Multi-Station Status Overview** showing the KPI cards, the 4 DA-CALABARZON Research Stations table with status badges and Edit Pin buttons (no login screen or audit log on screen). |
| **`SS-12`** | Slide 14 | **Multi-Station Authoring Suite (`road_draw.html` / `pill_adjust.html`)** | 1. Open `http://localhost:8080/road_draw.html` or `http://localhost:8080/pill_adjust.html` (`1920x1080`).<br>2. Zoom into the central compound showing the green road segments, dashed walkways, and building entrance/pill nodes over the drone map.<br>3. Capture the full window. |

---

## Verification — Files Read to Produce This Document

- `docs/00-system-overview.md`, `docs/00-one-page-summary.md`, `docs/01-modules.md`, `docs/02-use-cases.md`, `docs/03-limitations-and-roadmap.md`, `docs/04-demo-script.md`, `docs/numbers.md`, `docs/technical-fact-sheet.md`
- `index.html`, `server.js`, `database/admin_api.js`, `admin.html`
- `js/app.js`, `js/stations.js`, `js/mode.js`, `js/sidebar.js`, `js/building-panel.js`, `js/plot-layers.js`, `js/routing.js`, `js/steps.js`, `js/walker.js`, `js/occlusion.js`, `js/qr.js`, `js/gps.js`, `js/phone-ui.js`, `js/phone-nav.js`, `js/orbit-control.js`, `js/map-settings.js`, `js/performance.js`, `js/idle.js`
- `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`, `js/data/stations.js`
