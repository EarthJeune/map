# iGUIDE — Use Cases

**Document Purpose:** Complete catalog of public user, visitor, station worker, reviewer, and administrator workflows supported by **iGUIDE** (*Interactive Geospatial Unified Information Directory and Explorer*), grounded in the actual functions and files in the codebase and consistent with [`docs/00-system-overview.md`](docs/00-system-overview.md) and [`docs/01-modules.md`](docs/01-modules.md).

---

## Actors and Use Cases Summary Table

| Use Case ID | Title | Primary Actor(s) | Goal | Status |
| :--- | :--- | :--- | :--- | :--- |
| **UC-01** | Browse a Building, Gate, or Agricultural Plot (Visitor & Worker View) | Public Online User, Campus Visitor, DA Station Worker / Researcher | Visually explore the 3D campus map or directory list online or on-site and inspect a facility's `.webp` photos, services, agricultural plot boundaries, sub-plots, and live MySQL plot crop/tree/cycle records for workers. | `IMPLEMENTED` |
| **UC-02** | Search for a Building, Internal Office, Agricultural Plot, Planted Crop, or Category | Public Online User, Campus Visitor, DA Station Worker | Quickly find which building houses a specific division, office, laboratory, conference hall, or which field plot holds a specific commodity zone or planted crop (`current_crop`). | `IMPLEMENTED` |
| **UC-03** | Get Walking Directions (Online Preview or Lobby Kiosk) | Public Online User, Campus Visitor, DA Station Worker | Compute and view the shortest pedestrian route and landmark turn-by-turn steps from the starting pin to any building or plot entrance. | `IMPLEMENTED` |
| **UC-04** | Watch the 3D Route Walkthrough and Change Speed or Camera View | Public Online User, Campus Visitor | Preview the walk in 3D using the animated avatar with X-ray building transparency and adjust playback speed (`1x`–`6x`) or camera angle. | `IMPLEMENTED` |
| **UC-05** | Take the Route to a Phone via QR Code | Campus Visitor, DA Station Worker | Transfer a selected building, office, or active walking route from the kiosk screen to a personal smartphone. | `IMPLEMENTED` |
| **UC-06** | Navigate by Live GPS on the Phone | Campus Visitor, DA Station Worker | Walk outdoors across the compound with real-time GPS tracking, compass heading, and automatic off-route rerouting. | `IMPLEMENTED` |
| **UC-07** | Replay or Cancel a Route | Public Online User, Campus Visitor | Restart the animated walking preview from the beginning or exit navigation to look for another destination. | `IMPLEMENTED` |
| **UC-08** | Arrive at the Destination | Campus Visitor | Receive visual (and mobile haptic) confirmation upon reaching the destination, followed by automatic or manual reset. | `IMPLEMENTED` |
| **UC-09** | Idle / Screensaver Auto-Reset & Thermal Rest | System Timer (triggered after Visitor leaves Kiosk) | Automatically clear abandoned kiosk sessions after 45 seconds of inactivity and enter a 3D attract loop with 5-minute thermal rest. | `IMPLEMENTED` |
| **UC-10** | Customize Map Layers, Lighting, 1-Finger Orbit, and Performance | Public Online User, Campus Visitor, DA Station Worker, Administrator | Toggle 3D layers, switch Drone vs. Mapbox 3D views, toggle Full Pill vs. Compact Number labels, enable 1-Finger Orbit accessibility mode, or select Auto/Eco/High performance. | `IMPLEMENTED` |
| **UC-11** | Switch Research Station (`DA-LARES`, `DA-QARES`, `DA-RARES`, `DA-CARES`) & View Deployed "Under Development" Notice | Public Online User, DA Staff, Administrator | Switch between the 4 DA-CALABARZON research stations—exploring flagship **DA-LARES** live while viewing the official *"Station Under Development"* modal for stations marked `under_dev` in MySQL (or toggling their live status in `/admin`). | `IMPLEMENTED` |
| **UC-12** | Web `/admin` Portal CRUD, Hashed Login & Live Cross-Tab Sync | Administrator, IT / Maintainer, Farm Superintendent | Sign into `/admin` (`admin.html`) with hashed credentials to manage the 11-table MySQL database (`kiosk`), drag the `"You Are Here"` pin, upload `.webp` photos, edit internal offices, update plot crops/tree counts, and sync open 3D Map tabs in real time. | `IMPLEMENTED` |

---

## Detailed Use Case Specifications

### UC-01: Browse a Building, Gate, or Agricultural Plot (Visitor & Worker View)

- **ID:** `UC-01`
- **Title:** Browse a Building, Gate, or Agricultural Plot (Visitor & Worker View)
- **Actor:** Public Online User, Campus Visitor, DA Station Worker / Researcher
- **Goal:** Explore the 3D campus map or left-hand directory (either by searching the deployed website online or standing at the lobby kiosk) to view a building's 3D architecture, ground-truth `.webp` photographs, *"How to Spot It"* description, internal offices, or agricultural field plot boundaries and sub-plots.
- **Preconditions:** The application is open via the public web URL, on the lobby kiosk (`http://localhost:8080`), or on a smartphone browser. If the Welcome Modal (`#welcome-modal`) is visible, the user taps **Proceed to Campus Map** (`dismissWelcomeModal()` in `js/app.js`).
- **Main Steps:**
  1. The user scrolls the left directory list (`#directory-list`, populated with the **39 numbered buildings** by `buildDirectory()` in `js/sidebar.js`) or pans/zooms the 3D map canvas (`#map`).
  2. The user taps a building card in the directory or taps a numbered pin (`1`–`39`) / 3D building on the map.
  3. The system calls `showBuildingPanel(buildingId)` (`js/building-panel.js`), which slides open the right-hand detail drawer (`#building-panel`), highlights the building footprint (`setBuildingHighlight()` in `js/map-setup.js`), flies the camera to the building (`pitch: 54°`, `zoom: 19.6`), and starts a gentle 3D inspection orbit (`orbitBuilding()` in `js/idle.js`).
  4. The drawer displays the building's optimized `.webp` hero photo (`images/*.webp`), view-angle switcher chips (`BUILDING_EXTRA_VIEWS`), **How to Spot It** (`visualLandmark`), **What's Inside & Services** (`keyServices`), internal office chips (`renderBuildingOfficesHTML()`), **Get Directions** button, and **Walk with your Phone** QR card.
  5. *(Optional)* The user taps **Enlarge** on the photo to open the full-screen photo lightbox (`openPhotoLightbox()` in `js/phone-ui.js`).
- **Alternative Paths:**
  - **A1 — Station Worker or Visitor Inspecting an Agricultural Plot Zone:** If the user toggles **Agricultural Plots** on or selects `Agri-Eco Trial Sites` / `Orchard & Plantation` in the filter dropdown and taps one of the **23 commodity zones** covering **Plots 1–45** (e.g., *TC Makapuno & Banana Screenhouse (Plot 17)*, *Coffee & Citrus Screenhouse (Plot 18)*, or *Coffee Orchard (Plot 22)*), `selectPlotZone(zoneId)` (`js/plot-layers.js`) and `showPlotPanel(zoneId)` (`js/building-panel.js`) highlight the zone perimeter, illuminate internal sub-plot cut lines, and display clickable sub-plot cards (*Screenhouse 1–9*, *LARES Water Tank*, *Plot 22 Comfort Room*). For station workers and researchers, this plot drawer also serves as the interface for upcoming plot-level agronomic intelligence (displaying what crop/variety is currently planted, exact tree counts, and whether the plot is an **Annual/Perennial** orchard or a **Monthly/Seasonal** trial plot).
  - **A2 — Browsing a Compound Gate:** If the user taps one of the **3 standalone gates** (`Main Entrance`, `Main Exit`, `Back Gate Entrance / Exit`), `selectStandaloneGate(gateId)` (`js/walker.js`) flies to the gate marker and opens its detail drawer.
  - **A3 — Browsing on a Smartphone:** In Phone Mode (`isPhoneMode() === true`), tapping a building or plot calls `showPhoneBuildingDetails(buildingId)` or `showPhonePlotDetails(zoneId)` (`js/phone-ui.js`), expanding the mobile bottom sheet (`#phone-bottom-sheet`) to the `half` snap stop.
- **Result:** The selected building, gate, or field plot is centered and orbiting/highlighted in 3D with its complete visual, office, and plot details displayed.
- **Modules Involved:** `js/app.js`, `js/sidebar.js`, `js/building-panel.js`, `js/map-setup.js`, `js/markers.js`, `js/plot-layers.js`, `js/idle.js`, `js/phone-ui.js`, `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`.
- **Status:** `IMPLEMENTED`

---

### UC-02: Search for a Building, Internal Office, Agricultural Plot, or Category

- **ID:** `UC-02`
- **Title:** Search for a Building, Internal Office, Agricultural Plot, or Category
- **Actor:** Public Online User, Campus Visitor, DA Station Worker
- **Goal:** Locate a destination by typing a building name, division acronym (e.g., `BAC`, `CASHIER`, `PMED`, `RAED`, `RSBSA`), service keyword (`soil`, `seed`, `comfort room`), plot number/commodity (`Plot 17`, `Citrus`, `Coffee`, `Corn`), or by selecting one of the **7 official facility categories**.
- **Preconditions:** The directory sidebar (desktop/kiosk) or bottom sheet directory (phone) is visible.
- **Main Steps:**
  1. The user taps the search input (`#search-input` or `#phone-search-input`) and types a query, or clicks the **Filter** button (`toggleCategoryDropdown()` in `js/sidebar.js`) and chooses one of the 7 categories (`infrastructure`, `trial_sites`, `orchard`, `office`, `laboratory`, `conference`, `digital_agri`).
  2. `buildDirectory(filter, category)` (`js/sidebar.js`) or `renderPhoneDirectory(query)` (`js/phone-ui.js`) evaluates every building name, `BUILDING_OFFICES` entry (`47` offices), `EMBEDDED_CONFERENCE_HALLS` (`3` halls), `BUILDING_WAYFINDING_INFO` description, and `FIELD_COMMODITY_ZONES` (`23` plot zones covering Plots 1–45).
  3. Matching buildings and plots are listed immediately. If the user searched for an internal office (e.g., `"Cashier"` inside `ored_building`), a highlighted green office pill (`🏢 Cashier`) appears directly beneath the parent building card.
  4. When the user taps the result, `showBuildingPanel(buildingId, targetOffice)` opens the building drawer and highlights the searched office chip inside the drawer (`state.activeSearchedOffice`).
- **Alternative Paths:**
  - **A1 — Unnumbered Utility Amenities (`plot22_water_tank`, `plot22_comfort_room`):** By default (with no search text and `All Types` selected), these 2 unnumbered Plot 22 utilities are hidden from the main 39-building directory (`LARES BUILDINGS (39)`). When a visitor or worker selects **Agri Infrastructure / Facilities** (`infrastructure`) or types `"water"` / `"comfort room"` / `"cr"`, they appear in the filtered results (`js/sidebar.js`, `js/phone-ui.js`).
  - **A2 — No Matches Found:** If no building, office, or plot matches the query, the directory displays a `"No matching facilities or offices found"` message with a button to clear filters.
- **Result:** The user identifies the exact parent building or agricultural plot zone matching their search and opens its wayfinding drawer.
- **Modules Involved:** `js/sidebar.js`, `js/phone-ui.js`, `js/building-panel.js`, `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`.
- **Status:** `IMPLEMENTED`

---

### UC-03: Get Walking Directions (Online Preview or Lobby Kiosk)

- **ID:** `UC-03`
- **Title:** Get Walking Directions (Online Preview or Lobby Kiosk)
- **Actor:** Public Online User, Campus Visitor, DA Station Worker
- **Goal:** Calculate the shortest pedestrian route from the `"📍 You Are Here"` pin to a target building or agricultural plot and view step-by-step walking instructions.
- **Preconditions:** `roads.json` is loaded and `state.ROAD_GRAPH` (2,668 nodes) is built (`buildRoadGraph()` in `js/routing.js`). A building or plot is selected.
- **Main Steps:**
  1. In the Detail Drawer (`#building-panel`), the user taps the green **Get Directions** button (`onclick="navigateTo(selectedBuildingId)"`).
  2. `navigateTo(buildingId)` (`js/walker.js`) stops any active inspection orbit, closes the right detail drawer, locks map markers to show only the origin and destination (`setRouteMarkerLock()` in `js/markers.js`), and calls `computeRouteFromKiosk(building)` (`js/routing.js`).
  3. `computeRouteFromKiosk()` snaps the starting coordinates (`state.KIOSK_COORDS`, defaulting to Argosino Hall `[121.1664336, 13.9581208]`) and the building's entrance coordinates (`roads.json` `type === 'entrance'`) to `state.ROAD_GRAPH` and runs `findShortestPath()` (Dijkstra's algorithm).
  4. `drawRoute()` (`js/routing.js`) draws the glowing green path and directional arrows on the 3D map.
  5. `buildSteps()` (`js/steps.js`) computes total distance in meters, estimated walking time (at 72 m/min), and turn-by-turn instructions referencing nearby campus buildings (e.g., *"Turn right at MIS / RAFIS Building"*), rendering them in the left Route Directions panel (`#route-info`) alongside the **Take route on your phone** QR code (`updateRouteQR()`).
- **Alternative Paths:**
  - **A1 — Routing to an Agricultural Plot Zone:** Tapping **Get Directions to Plot** in a plot drawer (`navigateToPlotZone(zoneId)` in `js/plot-layers.js`) routes the user or field worker along the road network directly to the plot zone's nearest road access point.
- **Result:** The shortest walking path is highlighted on the 3D map, the step-by-step directions panel is open on the left, and the 3D walkthrough begins automatically.
- **Modules Involved:** `js/walker.js`, `js/routing.js`, `js/steps.js`, `js/markers.js`, `js/qr.js`, `js/occlusion.js`.
- **Status:** `IMPLEMENTED`

---

### UC-04: Watch the 3D Route Walkthrough and Change Speed or Camera View

- **ID:** `UC-04`
- **Title:** Watch the 3D Route Walkthrough and Change Speed or Camera View
- **Actor:** Public Online User, Campus Visitor
- **Goal:** Watch the animated 3D walker travel from the starting point to the destination, speed up long walks, or switch camera angles to inspect intersections.
- **Preconditions:** A route is active (`UC-03`).
- **Main Steps:**
  1. Immediately after `navigateTo()` computes the route, `createWalkerMarker()` (`js/walker.js`) places the 3D animated walker at the start of the path and begins moving it along `state.currentRouteCoords` on every animation frame.
  2. As the walker advances:
      - The walked portion of the green route line is trimmed behind the walker (`turf.lineSliceAlong`).
      - Any 3D building on the active station's 3D layer (`getActive3DModelsLayerId()`) blocking the camera's view of the walker automatically turns semi-transparent (`updateOcclusion()` in `js/occlusion.js`).
      - The active turn instruction in `#steps-list` and the top maneuver banner (`#live-turn-hud`) update in real time (`updateActiveStep()` in `js/steps.js`).
  3. To speed up the preview, the user taps one of the **SPEED** buttons (`1x`, `2x`, `4x`, or `6x`) in `#route-info` (`setRouteSpeed(multiplier)` in `js/walker.js`).
  4. To change the camera perspective, the user taps one of the floating bottom-right **CAMERA** pills (`setCameraMode(mode)` in `js/walker.js`):
      - **Side View** (`follow`): Follows the walker closely in 3D (`pitch: 58°`, `zoom: 19.3`).
      - **Top View** (`overview`): Fits the entire route from above (`pitch: 0°`).
      - **Unlocked** (`free`): Lets the user pan, zoom, and rotate freely around the map while the walker continues moving.
  5. *(Optional)* The user clicks any individual step in `#steps-list` (`focusRouteStep(idx)` in `js/steps.js`) to fly the camera directly to that turn corner.
- **Result:** The user previews the entire walk at their preferred speed and camera angle.
- **Modules Involved:** `js/walker.js`, `js/steps.js`, `js/occlusion.js`, `js/map-setup.js`.
- **Status:** `IMPLEMENTED`

---

### UC-05: Take the Route to a Phone via QR Code

- **ID:** `UC-05`
- **Title:** Take the Route to a Phone via QR Code
- **Actor:** Campus Visitor, DA Station Worker
- **Goal:** Scan the kiosk's QR code with a smartphone camera to open the exact destination and walking route on the phone without typing or installing an app.
- **Preconditions:** The server (`server.js`) has an active HTTPS URL (`GET /api/tunnel`), and either a building drawer (`#building-panel`) or an active route (`#route-info`) is open.
- **Main Steps:**
  1. The screen displays a QR code card (`updateBuildingQR()` or `updateRouteQR()` in `js/qr.js`) encoding `<public_url>/?dest=<buildingId>&mode=phone` (plus `&office=<name>` if an office was searched).
  2. *(Optional)* The user taps **Tap QR to Enlarge** (`openQRZoomModal()` in `js/qr.js`) to display an extra-large QR modal (`#qr-zoom-modal`) with a 25-second auto-close countdown.
  3. The user opens their smartphone's built-in camera app, points it at the QR code, and taps the link banner that appears.
  4. The smartphone browser loads the HTTPS URL.
  5. On load, `detectAppMode()` (`js/mode.js`) activates **Phone Mode** (`mode-phone`), and `checkMobileURLDestination()` (`js/qr.js`) reads `?dest=<buildingId>`, automatically computing the route to that destination and opening the mobile route sheet (`updatePhoneRouteUI()` in `js/phone-nav.js`).
- **Result:** The smartphone opens directly into the mobile wayfinding view with the target route loaded and ready for live GPS navigation.
- **Modules Involved:** `js/qr.js`, `js/mode.js`, `js/phone-ui.js`, `js/phone-nav.js`, `js/walker.js`, `server.js`.
- **Status:** `IMPLEMENTED`

---

### UC-06: Navigate by Live GPS on the Phone

- **ID:** `UC-06`
- **Title:** Navigate by Live GPS on the Phone
- **Actor:** Campus Visitor, DA Station Worker (walking outdoors with a smartphone)
- **Goal:** Follow real-time GPS location and compass orientation along the campus road network until arriving at the destination building or field plot.
- **Preconditions:** The user has opened a route on their smartphone over HTTPS (`UC-05` or by searching the deployed website directly on their phone and tapping **Get Directions**).
- **Main Steps:**
  1. `navigateTo()` in Phone Mode displays the GPS permission prompt card (`promptPhoneGPSPermission()` in `js/gps.js`).
  2. The user taps **Use My Live GPS**, invoking `startPhoneLiveGPS()` (`js/gps.js`), which requests `navigator.geolocation.watchPosition` (`enableHighAccuracy: true`) and compass orientation (`DeviceOrientationEvent`).
  3. As the user walks outdoors across DA-LARES:
      - `handlePhoneGPSUpdate()` (`js/gps.js`) verifies the user is within 500 m of the campus center and that GPS accuracy is ≤ 60 m.
      - It snaps the user's coordinates to the nearest point on the route (`turf.nearestPointOnLine`), glides the blue user marker (`animateLiveGPSMarkerTo()`), and slices the route (`turf.lineSliceAlong`) so only the remaining path ahead is drawn.
      - `handleDeviceOrientation()` (`js/gps.js`) rotates the blue compass cone (`#user-gps-cone`) and smoothly aligns the 3D map bearing with the user's physical heading.
      - `updatePhoneLiveNavUI()` (`js/phone-nav.js`) updates the top banner (`#phone-top-nav-hud`) with the next turn icon, distance to turn (`"Now"` when ≤ 10 m), primary instruction, `"Then: ..."` preview, and remaining minutes/meters.
- **Alternative Paths:**
  - **A1 — User Walks Off-Route (> 28 m from path):** If `distToRoute > 28` meters and at least 6 seconds have elapsed since the last reroute (`js/gps.js`), `rerouteFromLivePosition([lng, lat])` automatically computes a brand-new shortest path from the user's current GPS position to the destination.
  - **A2 — User Searches Online from Off-Campus (> 500 m Outside Compound):** If someone opens the deployed web app from home or another office (`distFromCenter > 500` in `js/gps.js`), the app displays a polite notice that they are outside the compound and automatically keeps the **animated route walkthrough** active so they can still preview the walk remotely.
- **Result:** The user is guided turn-by-turn across the compound using live satellite positioning and compass heading.
- **Modules Involved:** `js/gps.js`, `js/phone-nav.js`, `js/phone-ui.js`, `js/routing.js`, `js/steps.js`, `js/walker.js`.
- **Status:** `IMPLEMENTED`

---

### UC-07: Replay or Cancel a Route

- **ID:** `UC-07`
- **Title:** Replay or Cancel a Route
- **Actor:** Public Online User, Campus Visitor
- **Goal:** Watch the walking animation again from the start, or exit the active route to return to the campus directory.
- **Main Steps (Replay):**
  1. The user taps the **Replay Walk** button (`#replay-route-btn`) at the bottom of the left directions panel (`#route-info`).
  2. `replayRoute()` (`js/walker.js`) cancels any arrival countdown (`clearArrivedCountdown()`), resets the walker avatar to the starting pin, restores the full route line, and restarts the walkthrough animation from Step 1.
- **Main Steps (Cancel / Exit Route):**
  1. On desktop/kiosk, the user taps **Exit Route** (`exitRouteMode()` in `js/walker.js` or `closeRouteAndReset()` in `js/routing.js`). On a phone, the user taps **End Route** (`exitPhoneRoute()` in `js/phone-nav.js`).
  2. The system stops the walker animation and/or live GPS watcher (`stopPhoneLiveGPS()`), removes the route layers and walker marker (`clearRoute()`), restores all building markers (`setRouteMarkerLock(null)`), resets building occlusion (`resetOcclusion()`), hides the turn-by-turn HUD, and flies the camera back to the default campus overview.
- **Result:** The route is either replayed from the beginning or cleanly exited back to the main directory view.
- **Modules Involved:** `js/walker.js`, `js/routing.js`, `js/phone-nav.js`, `js/gps.js`, `js/markers.js`, `js/occlusion.js`.
- **Status:** `IMPLEMENTED`

---

### UC-08: Arrive at the Destination

- **ID:** `UC-08`
- **Title:** Arrive at the Destination
- **Actor:** Campus Visitor
- **Goal:** See a clear visual confirmation that the route has reached the target building, inspect the destination in 3D, and either stay on the building or return to the overview.
- **Main Steps (Walkthrough Arrival):**
  1. When the animated walker reaches the end of the path (`progress >= 1` in `js/walker.js`), the system displays the top `#arrived-banner` notification (`"Arrived — You have arrived at <Building Name>"`).
  2. The camera smoothly transitions into a 3D inspection orbit around the destination building (`orbitBuilding()`), and `startArrivedCountdown()` (`js/walker.js`) starts a **10-second** auto-return countdown badge (`#arrived-countdown-bar`).
- **Main Steps (Phone Live GPS Arrival):**
  1. When the visitor walks within 12 m of the destination entrance (`js/gps.js`), `triggerPhoneArrival()` (`js/phone-nav.js`) vibrates the smartphone (`navigator.vibrate([200, 100, 200])`), stops GPS tracking (`stopPhoneLiveGPS()`), hides the top maneuver HUD, and shows the `#phone-arrival-banner` card.
- **Result:** The visitor receives unmistakable confirmation of arrival and sees the building's 3D structure and photo details.
- **Modules Involved:** `js/walker.js`, `js/phone-nav.js`, `js/gps.js`, `js/idle.js`, `js/building-panel.js`.
- **Status:** `IMPLEMENTED`

---

### UC-09: Idle / Screensaver Auto-Reset & Thermal Rest

- **ID:** `UC-09`
- **Title:** Idle / Screensaver Auto-Reset & Thermal Rest
- **Actor:** System Timer (triggered automatically when a Campus Visitor walks away from the kiosk)
- **Goal:** Return the unattended kiosk to a clean, welcoming state after **45 seconds** of inactivity while protecting the kiosk hardware from overheating during long idle periods.
- **Main Steps:**
  1. Every user interaction calls `resetIdle()` (`js/idle.js`), which resets a 45-second timer.
  2. When 45 seconds pass without interaction (and no route walkthrough is actively mid-walk):
      - `resetIdle()` closes any open QR zoom modal, photo lightbox, building detail drawer, and active route.
      - Clears any search text in `#search-input` and resets category filtering to `'all'`.
      - Flies the camera smoothly back to the station's default 3D overview and starts a continuous 30 FPS orbital rotation (`startIdleRotation()`).
  3. If the kiosk remains untouched for **5 continuous minutes** of idle rotation (`MAX_CONTINUOUS_ORBIT_MS = 300000` ms in `js/idle.js`), the animation loop automatically pauses (`stopIdleRotation()`) to enter **Thermal Eco-Rest Mode**, dropping GPU load to near zero until the next touch.
- **Result:** The kiosk stays clean and ready for the next visitor while preventing GPU thermal throttling over 24/7 operation.
- **Modules Involved:** `js/idle.js`, `js/qr.js`, `js/routing.js`, `js/building-panel.js`, `js/sidebar.js`, `js/data/config.js`.
- **Status:** `IMPLEMENTED`

---

### UC-10: Customize Map Layers, Lighting, 1-Finger Orbit, and Performance Profile

- **ID:** `UC-10`
- **Title:** Customize Map Layers, Lighting, 1-Finger Orbit, and Performance Profile
- **Actor:** Public Online User, Campus Visitor, DA Station Worker, Administrator
- **Goal:** Switch between Drone Aerial View and Mapbox 3D Standard View, toggle map layers or label density, enable 1-finger accessibility orbiting, or tune GPU/battery performance.
- **Main Steps:**
  1. **Switch Base Map Style (Drone vs. Mapbox 3D):** The user taps the **Aerial Drone** / **Mapbox 3D** style toggle button (`switchMapStyle()` in `js/map-setup.js`), switching between the local 210.66 MB drone orthomosaic and Mapbox Standard 3D terrain.
  2. **Enable 1-Finger Orbit Accessibility Mode:** The user taps the **3D Orbit** joystick button (`toggleOneFingerOrbitMode()` in `js/orbit-control.js`) so single-finger dragging rotates and tilts the 3D camera.
  3. **Open Map Settings Popover:** The user taps the gear icon (`toggleMapSettingsPanel()` in `js/map-settings.js`) to:
      - Toggle visibility of **3D Buildings** (across all station-isolated 3D layers), **Building Labels**, **Perimeter Boundary**, or **Agricultural Plots** (`handleLayerToggle()`).
      - Switch marker pins between **Full Pill View** and **Compact Number** (`setLabelDisplayMode()`), both respecting the **Building Labels** visibility toggle.
      - Switch 3D sun lighting between **Dawn**, **Day**, **Dusk**, and **Night** (`setLightingPreset()`).
      - Select a **Performance Profile** (`setPerformanceProfile()` in `js/performance.js`): `⚡ Auto`, `🌿 Kiosk Eco` (or `🔋 Battery Saver` on mobile), or `💎 High`.
- **Result:** The map visual style, layer visibility, touch accessibility, and rendering workload immediately match the user's or device's needs.
- **Modules Involved:** `js/map-setup.js`, `js/map-settings.js`, `js/orbit-control.js`, `js/performance.js`, `js/plot-layers.js`.
- **Status:** `IMPLEMENTED`

---

### UC-11: Switch Research Station (`DA-LARES`, `DA-QARES`, `DA-RARES`, `DA-CARES`) & View Deployed "Under Development" Notice

- **ID:** `UC-11`
- **Title:** Switch Research Station (`DA-LARES`, `DA-QARES`, `DA-RARES`, `DA-CARES`) & View Deployed "Under Development" Notice
- **Actor:** Public Online User, Campus Visitor, DA Staff, Administrator
- **Goal:** Explore the multi-station regional selector covering all **4 DA-CALABARZON Research Stations**, presenting **DA-LARES** live while cleanly informing public users that **DA-QARES**, **DA-RARES**, and **DA-CARES** are currently **Under Development** (and allowing developers on `localhost` to switch directly into QARES/RARES/CARES).
- **Preconditions:** The user clicks the station header dropdown (`#station-selector-btn` in the sidebar or `#welcome-station-dropdown` on the Welcome Screen).
- **Main Steps (Public Deployed Mode — `isDeployedMode() === true`):**
  1. The user clicks the station selector (`toggleStationDropdown()` in `js/sidebar.js`) and sees all 4 regional research stations:
      - **DA-LARES** (Lipa City, Batangas)
      - **DA-QARES** (Tiaong, Quezon)
      - **DA-RARES** (Tanay, Rizal)
      - **DA-CARES** (Naic, Cavite)
  2. If the user selects **DA-QARES**, **DA-RARES**, or **DA-CARES**, `switchActiveStation(stationId)` (`js/stations.js`) checks `isDeployedMode()`, keeps the active map on **DA-LARES**, and opens the **"Station Under Development"** modal (`showStationDevModal(targetStation)` in `js/stations.js`), displaying the station's official full title, location badge, and a message that its interactive 3D campus map is currently under active development.
  3. The user clicks **Stay on DA-LARES** (`closeStationDevModal()`), returning seamlessly to the live DA-LARES map.
- **Alternative Paths:**
  - **A1 — Developer Workstation Mode (`localhost` — `isDeployedMode() === false`):** On the local authoring workstation, selecting **DA-RARES** or **DA-QARES** flies the camera directly to Tanay, Rizal or Tiaong, Quezon, loads the station's `.mbtiles` drone orthomosaic, footprints, plots, and roads, and toggles the station-isolated 3D model layers (`lares-3d-models-layer` ↔ `rares-3d-models-layer` / `qares-3d-models-layer`) with zero data loss when switching back to DA-LARES.
- **Result:** Public users clearly see that the platform serves all 4 DA-CALABARZON research stations while interacting with the completed **DA-LARES** campus (49 custom 3D models, 47 offices, 45 field plots) during the initial launch.
- **Modules Involved:** `js/stations.js`, `js/sidebar.js`, `js/map-setup.js`, `js/data/stations.js`, `server.js`.
- **Status:** `IMPLEMENTED`

---

### UC-12: Web `/admin` Portal CRUD, Hashed Login & Live Cross-Tab Sync

- **ID:** `UC-12`
- **Title:** Web `/admin` Portal CRUD, Hashed Login & Live Cross-Tab Sync
- **Actor:** System Administrator, IT / Maintainer, Farm Superintendent
- **Goal:** Securely manage the 11-table MySQL database (`kiosk`)—including station deployment statuses, the `"You Are Here"` kiosk pin, building descriptions, multi-angle `.webp` photos, internal offices, and live worker plot records (planted crop/variety, tree counts, and perennial/seasonal cycles)—with instant live synchronization across open 3D Map tabs.
- **Preconditions:** The administrator opens `http://localhost:8080/admin` (`admin.html`) and signs in with their username and password, which are verified against hashed credentials in the **`admin_users` MySQL table** (`POST /api/admin/login` in `database/admin_api.js`).
- **Main Steps:**
  1. **Switch Station Status or Move the `"You Are Here"` Kiosk Pin (`/admin` Modules 1 & 2):** Toggle any station between `Live on Public Map` and `Under Development`, or drag the red pin on the interactive satellite map and click **Save Kiosk Pin to MySQL** (`PUT /api/admin/stations/:id`).
  2. **Edit Buildings & Upload Multi-Angle `.webp` Photos (`/admin` Module 3):** Select any building to edit its name, category, *"How to Spot It"*, or *"What's Inside"*, or upload additional `.webp` photos (`POST /api/admin/buildings/:id/images`).
  3. **Manage Internal Offices (`/admin` Module 4):** Add, edit, or delete internal offices (`building_offices`). Buildings with `0` offices automatically hide the Offices card on the public map; `1` office shows a singular header; `2+` offices show a count badge.
  4. **Update Worker Agronomic Plot Intelligence (`/admin` Module 5):** Update any plot's **Planted Crop / Variety (`current_crop`)**, **Tree / Plant Count (`tree_count`)**, **Planting Cycle** (`Perennial`, `Annual`, or `Monthly / Seasonal`), **Status**, and **Worker Notes** (`PUT /api/admin/plots/:id`).
  5. **Real-Time Cross-Tab Sync (`BroadcastChannel`):** Every save in `/admin` fires `notifyLiveMapSync()`, causing any open 3D Map tab (`syncDatabaseBootstrap()` in `js/app.js`) to immediately refresh its directory, live search bar index, and map pins without reloading the page.
  6. **Edit Building, Road, Plot, Pill, or Tree Geometry (Standalone Editors):** Open `draw.html`, `road_draw.html`, `plot_draw.html`, `tree_draw.html`, or `pill_adjust.html` from the `/admin` sidebar to visually edit campus geometries over the drone map.
- **Result:** All database changes are persisted in the 11-table MySQL `kiosk` database (also viewable in phpMyAdmin), logged in `admin_audit_logs`, and reflected instantaneously in open 3D Map tabs.
- **Modules Involved:** `admin.html`, `database/admin_api.js`, `app/Http/Controllers/AdminCrudController.php`, `js/app.js` (`syncDatabaseBootstrap`), `js/drone-calibration.js`, `draw.html`, `road_draw.html`, `plot_draw.html`, `tree_draw.html`, `pill_adjust.html`, `server.js`.
- **Status:** `IMPLEMENTED`

---

## Verification — Files Read to Produce This Document

- `docs/00-system-overview.md`, `docs/01-modules.md`
- `index.html`, `server.js`, `start_admin.bat`
- `js/app.js`, `js/stations.js`, `js/mode.js`, `js/map-setup.js`, `js/markers.js`, `js/plot-layers.js`, `js/occlusion.js`, `js/orbit-control.js`
- `js/sidebar.js`, `js/building-panel.js`, `js/map-settings.js`
- `js/routing.js`, `js/steps.js`, `js/walker.js`, `js/idle.js`
- `js/qr.js`, `js/phone-ui.js`, `js/phone-nav.js`, `js/gps.js`
- `js/performance.js`, `js/drone-calibration.js`
- `js/data/config.js`, `js/data/state.js`, `js/data/stations.js`, `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`
- `draw.html`, `road_draw.html`, `plot_draw.html`, `tree_draw.html`, `pill_adjust.html`
