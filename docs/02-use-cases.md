# DA-LARES Interactive 3D Campus Wayfinding System — Use Cases

**Document Purpose:** Complete catalog of user and administrator workflows supported by the DA-LARES Wayfinding System, grounded in the actual functions and files in the codebase and consistent with [`docs/00-system-overview.md`](file:///c:/Users/LGU-SanPedro/Downloads/map/docs/00-system-overview.md) and [`docs/01-modules.md`](file:///c:/Users/LGU-SanPedro/Downloads/map/docs/01-modules.md).

---

## Actors and Use Cases Summary Table

| Use Case ID | Title | Primary Actor(s) | Goal | Status |
| :--- | :--- | :--- | :--- | :--- |
| **UC-01** | Browse for a Building, Gate, or Agricultural Plot | Campus Visitor, DA Staff | Visually explore the 3D campus map or directory list and inspect a facility's photos, services, and sub-plots. | `IMPLEMENTED` |
| **UC-02** | Search for a Building, Internal Office, or Category | Campus Visitor, DA Staff | Quickly find which building houses a specific division, office, laboratory, conference hall, or crop zone. | `IMPLEMENTED` |
| **UC-03** | Get Walking Directions at the Kiosk | Campus Visitor | Compute and view the shortest pedestrian route and turn-by-turn steps from the lobby kiosk to a destination. | `IMPLEMENTED` |
| **UC-04** | Watch the Route Walkthrough and Change Its Speed or Camera View | Campus Visitor | Preview the walk in 3D using the animated avatar and adjust playback speed (`1x`–`6x`) or camera angle. | `IMPLEMENTED` |
| **UC-05** | Take the Route to a Phone via QR Code | Campus Visitor | Transfer a selected building or active walking route from the kiosk screen to a personal smartphone. | `IMPLEMENTED` |
| **UC-06** | Navigate by Live GPS on the Phone | Campus Visitor | Walk outdoors across the compound with real-time GPS tracking, compass heading, and automatic off-route rerouting. | `IMPLEMENTED` |
| **UC-07** | Replay or Cancel a Route | Campus Visitor | Restart the animated walking preview from the beginning or exit navigation to look for another destination. | `IMPLEMENTED` |
| **UC-08** | Arrive at the Destination | Campus Visitor | Receive visual (and mobile haptic) confirmation upon reaching the destination, followed by automatic or manual reset. | `IMPLEMENTED` |
| **UC-09** | Idle / Screensaver Auto-Reset | System Timer (triggered after Visitor leaves) | Automatically clear abandoned sessions after 45 seconds of inactivity and enter a 3D attract loop with 5-minute thermal rest. | `IMPLEMENTED` |
| **UC-10** | Customize Map Layers, Lighting, 1-Finger Orbit, and Performance | Campus Visitor, DA Staff, Administrator | Toggle 3D layers, switch Drone vs. Mapbox 3D views, enable 1-Finger Orbit accessibility mode, or select Eco/High performance. | `IMPLEMENTED` |
| **UC-11** | Switch Research Station (DA-LARES / DA-QARES) | DA Staff, Administrator | Switch the active campus between DA-LARES (Lipa City) and DA-QARES (Tiaong, Quezon). | `PARTIAL` |
| **UC-12** | Admin Updates (Move Kiosk Pin, Calibrate Drone Map, Edit Colors & Geometry) | Administrator, IT / Maintainer | Reposition the `"You Are Here"` pin, align 3D models to drone imagery, customize roof/badge colors, or edit polygons and roads. | `PARTIAL` |

---

## Detailed Use Case Specifications

### UC-01: Browse for a Building, Gate, or Agricultural Plot

- **ID:** `UC-01`
- **Title:** Browse for a Building, Gate, or Agricultural Plot
- **Actor:** Campus Visitor, DA Staff
- **Goal:** Explore the 3D campus map or left-hand directory to view a building's 3D architecture, ground-truth photographs, *"How to Spot It"* description, internal offices, or agricultural field plot boundaries.
- **Preconditions:** The application is open on the kiosk (`http://localhost:8080`) or a mobile browser. If the Welcome Modal (`#welcome-modal`) is visible, the user taps **Proceed to Campus Map** (`dismissWelcomeModal()` in `js/app.js:461`).
- **Main Steps:**
  1. The user scrolls the left directory list (`#directory-list`, populated with the **39 numbered buildings** by `buildDirectory()` in `js/sidebar.js:235`) or pans/zooms the 3D map canvas (`#map`).
  2. The user taps a building card in the directory or taps a numbered pin (`1`–`39`) / 3D building on the map.
  3. The system calls `showBuildingPanel(buildingId)` (`js/building-panel.js:65`), which slides open the right-hand detail drawer (`#building-panel`), highlights the building footprint (`setBuildingHighlight()` in `js/map-setup.js`), flies the camera to the building (`pitch: 54°`, `zoom: 19.6` on kiosk), and starts a gentle 3D inspection orbit (`orbitBuilding()` in `js/idle.js:184`).
  4. The drawer displays the building's hero photo (`images/*`), view-angle switcher chips (`BUILDING_EXTRA_VIEWS`), **How to Spot It** (`visualLandmark`), **What's Inside & Services** (`keyServices`), internal office chips (`renderBuildingOfficesHTML()`), **Get Directions** button, and **Walk with your Phone** QR card.
  5. *(Optional)* The user taps **Enlarge** on the photo to open the full-screen photo lightbox (`openPhotoLightbox()` in `js/phone-ui.js:1164`).
- **Alternative Paths:**
  - **A1 — Browsing an Agricultural Plot Zone:** If the user toggles **Crop Plots** on or selects `Agri-Eco Trial Sites` / `Orchard & Plantation` in the filter dropdown and taps one of the **23 commodity zones** (e.g., *TC Makapuno & Banana Screenhouse (Plot 17)* or *Coffee Orchard (Plot 22)*), `selectPlotZone(zoneId)` (`js/plot-layers.js`) and `showPlotPanel(zoneId)` (`js/building-panel.js:654`) highlight the zone perimeter, illuminate internal sub-plot cut lines, and display clickable sub-plot cards (such as *Screenhouse 1–5* or *LARES Water Tank* and *Plot 22 Comfort Room*).
  - **A2 — Browsing a Compound Gate:** If the user taps one of the **3 standalone gates** (`Main Entrance`, `Main Exit`, `Back Gate Entrance / Exit`), `selectStandaloneGate(gateId)` (`js/walker.js:120`) flies to the gate marker and opens its detail drawer.
  - **A3 — Browsing on a Smartphone:** In Phone Mode (`isPhoneMode() === true`), tapping a building calls `showPhoneBuildingDetails(buildingId)` (`js/phone-ui.js:567`), expanding the mobile bottom sheet (`#phone-bottom-sheet`) to the `half` snap stop.
- **Result:** The selected building, gate, or field plot is centered and orbiting in 3D with its complete visual and service details displayed.
- **Modules Involved:** `js/app.js`, `js/sidebar.js`, `js/building-panel.js`, `js/map-setup.js`, `js/markers.js`, `js/plot-layers.js`, `js/idle.js`, `js/phone-ui.js`, `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`.
- **Status:** `IMPLEMENTED`

---

### UC-02: Search for a Building, Internal Office, or Category

- **ID:** `UC-02`
- **Title:** Search for a Building, Internal Office, or Category
- **Actor:** Campus Visitor, DA Staff
- **Goal:** Locate a destination by typing a building name, division acronym (e.g., `BAC`, `CASHIER`, `PMED`, `RAED`, `RSBSA`), service keyword (e.g., `soil`, `seed`, `comfort room`), or by selecting one of the **7 official facility categories**.
- **Preconditions:** The directory sidebar (kiosk) or bottom sheet directory (phone) is visible.
- **Main Steps:**
  1. The user taps the search input (`#search-input` on kiosk or `#phone-search-input` on phone) and types a query (e.g., `"Cashier"` or `"BAC"`), or clicks the **Filter** button (`toggleCategoryDropdown()` in `js/sidebar.js:65`) and chooses one of the 7 categories (`infrastructure`, `trial_sites`, `orchard`, `office`, `laboratory`, `conference`, `digital_agri`).
  2. `buildDirectory(filter, category)` (`js/sidebar.js:235`) or `renderPhoneDirectory(query)` (`js/phone-ui.js:354`) evaluates every building name, `BUILDING_OFFICES` entry (`47` offices), `EMBEDDED_CONFERENCE_HALLS` (`3` halls), `BUILDING_WAYFINDING_INFO` description, and `FIELD_COMMODITY_ZONES` (`23` plot zones).
  3. Matching buildings and plots are listed immediately. If the user searched for an internal office (e.g., `"Cashier"` inside `ored_building`), a highlighted green office pill (`🏢 Cashier`) appears directly beneath the parent building card.
  4. When the user taps the result, `showBuildingPanel(buildingId, targetOffice)` opens the building drawer and highlights the searched office chip inside the drawer (`state.activeSearchedOffice`).
- **Alternative Paths:**
  - **A1 — Unnumbered Utility Amenities (`plot22_water_tank`, `plot22_comfort_room`):** By default (with no search text and `All Types` selected), these 2 unnumbered Plot 22 utilities are hidden from the main 39-building directory (`LARES BUILDINGS (39)`). When the user selects **Agri Infrastructure / Facilities** (`infrastructure`) or types `"water"` / `"comfort room"` / `"cr"`, they appear in the filtered results (`js/sidebar.js:338-341`, `js/phone-ui.js:406-409`).
  - **A2 — No Matches Found:** If no building, office, or plot matches the query, the directory displays a `"No matching facilities or offices found"` message with a button to clear filters.
- **Result:** The user identifies the exact parent building housing the searched office or category and opens its wayfinding drawer.
- **Modules Involved:** `js/sidebar.js`, `js/phone-ui.js`, `js/building-panel.js`, `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`.
- **Status:** `IMPLEMENTED`

---

### UC-03: Get Walking Directions at the Kiosk

- **ID:** `UC-03`
- **Title:** Get Walking Directions at the Kiosk
- **Actor:** Campus Visitor
- **Goal:** Calculate the shortest pedestrian route from the `"📍 You Are Here"` kiosk pin to a target building or plot and view step-by-step walking instructions.
- **Preconditions:** `roads.json` is loaded and `state.ROAD_GRAPH` (2,678 nodes) is built (`buildRoadGraph()` in `js/routing.js:76`). A building or plot is selected, or the user taps a route trigger.
- **Main Steps:**
  1. In the Building Detail Drawer (`#building-panel`), the user taps the green **Get Directions** button (`onclick="navigateTo(selectedBuildingId)"`).
  2. `navigateTo(buildingId)` (`js/walker.js:115`) stops any active inspection orbit, closes the right detail drawer, locks map markers to show only the origin and destination (`setRouteMarkerLock()` in `js/markers.js`), and calls `computeRouteFromKiosk(building)` (`js/routing.js:1012`).
  3. `computeRouteFromKiosk()` snaps the kiosk coordinates (`state.KIOSK_COORDS`, defaulting to Argosino Hall `[121.1664336, 13.9581208]`) and the building's entrance coordinates (`roads.json` `type === 'entrance'`) to `state.ROAD_GRAPH` and runs `findShortestPath()` (Dijkstra's algorithm).
  4. `drawRoute()` (`js/routing.js:1087`) draws the glowing green path and directional arrows on the 3D map.
  5. `buildSteps()` (`js/steps.js:65`) computes total distance in meters, estimated walking time (at $72\text{ m/min}$), and turn-by-turn instructions referencing nearby campus buildings (e.g., *"Turn right at MIS / RAFIS Building"*), rendering them in the left Route Directions panel (`#route-info`) alongside the **Take route on your phone** QR code (`updateRouteQR()`).
- **Alternative Paths:**
  - **A1 — Routing to an Agricultural Plot Zone:** Tapping **Get Directions to Plot** in a plot drawer (`navigateToPlotZone(zoneId)` in `js/plot-layers.js`) creates a temporary target at the plot zone's nearest road access point and runs `navigateTo()`.
- **Result:** The shortest walking path is highlighted on the 3D map, the step-by-step directions panel is open on the left, and the 3D walkthrough begins automatically.
- **Modules Involved:** `js/walker.js`, `js/routing.js`, `js/steps.js`, `js/markers.js`, `js/qr.js`, `js/occlusion.js`.
- **Status:** `IMPLEMENTED`

---

### UC-04: Watch the Route Walkthrough and Change Its Speed or Camera View

- **ID:** `UC-04`
- **Title:** Watch the Route Walkthrough and Change Its Speed or Camera View
- **Actor:** Campus Visitor
- **Goal:** Watch the animated 3D walker travel from the kiosk to the destination, speed up long walks, or switch camera angles to inspect intersections.
- **Preconditions:** A route is active (`UC-03`).
- **Main Steps:**
  1. Immediately after `navigateTo()` computes the route, `createWalkerMarker()` (`js/walker.js`) places the 3D animated claymation walker at the start of the path and begins moving it along `state.currentRouteCoords` on every animation frame.
  2. As the walker advances:
     - The walked portion of the green route line is trimmed behind the walker (`turf.lineSliceAlong`).
     - Any 3D building blocking the camera's view of the walker automatically turns semi-transparent (`updateOcclusion()` in `js/occlusion.js`).
     - The active turn instruction in `#steps-list` and the top maneuver banner (`#live-turn-hud`) update in real time (`updateActiveStep()` in `js/steps.js`).
  3. To speed up the preview, the user taps one of the **SPEED** buttons (`1x`, `2x`, `4x`, or `6x`) in `#route-info` (`setRouteSpeed(multiplier)` in `js/walker.js:762`).
  4. To change the camera perspective, the user taps one of the floating bottom-right **CAMERA** pills (`setCameraMode(mode)` in `js/walker.js:788`):
     - **Side View** (`follow`): Follows the walker closely in 3D (`pitch: 58°`, `zoom: 19.3`).
     - **Top View** (`overview`): Fits the entire route from above (`pitch: 0°`).
     - **Unlocked** (`free`): Lets the user pan, zoom, and rotate freely around the map while the walker continues moving.
  5. *(Optional)* The user clicks any individual step in `#steps-list` (`focusRouteStep(idx)` in `js/steps.js:1580`) to fly the camera directly to that turn corner.
- **Alternative Paths:**
  - **A1 — User Manually Drags the Map During Follow Mode:** If the user touches and drags the map canvas while in `Side View` (`follow`), the camera automatically switches to `Unlocked` (`free`) mode so it does not fight the user's finger.
- **Result:** The visitor previews the entire walk at their preferred speed and camera angle before leaving the kiosk lobby.
- **Modules Involved:** `js/walker.js`, `js/steps.js`, `js/occlusion.js`, `js/map-setup.js`.
- **Status:** `IMPLEMENTED`

---

### UC-05: Take the Route to a Phone via QR Code

- **ID:** `UC-05`
- **Title:** Take the Route to a Phone via QR Code
- **Actor:** Campus Visitor
- **Goal:** Scan the kiosk's QR code with a smartphone camera to open the exact destination and walking route on the phone without typing or installing an app.
- **Preconditions:** The kiosk server (`server.js`) has an active Cloudflare HTTPS tunnel (`GET /api/tunnel` returns `https://*.trycloudflare.com`) or a configured LAN/domain URL, and either a building drawer (`#building-panel`) or an active route (`#route-info`) is open on the kiosk.
- **Main Steps:**
  1. The kiosk displays a QR code card (`updateBuildingQR()` or `updateRouteQR()` in `js/qr.js`) encoding `<tunnel_url>/?dest=<buildingId>&mode=phone` (plus `&office=<name>` if an office was searched).
  2. *(Optional)* If the visitor is standing a few steps back from the kiosk, they tap **Tap QR to Enlarge** (`openQRZoomModal()` in `js/qr.js:186`) to display an extra-large QR modal (`#qr-zoom-modal`) with a 25-second auto-close countdown.
  3. The visitor opens their smartphone's built-in camera app, points it at the QR code, and taps the link banner that appears.
  4. The smartphone browser loads the HTTPS URL through the Cloudflare tunnel.
  5. On load, `detectAppMode()` (`js/mode.js:14`) activates **Phone Mode** (`mode-phone`), and `checkMobileURLDestination()` (`js/qr.js:325`) reads `?dest=<buildingId>`, automatically computing the route from the kiosk to that destination and opening the mobile route sheet (`updatePhoneRouteUI()` in `js/phone-nav.js:26`).
- **Alternative Paths:**
  - **A1 — Cloudflare Quick Tunnel Temporarily Rate-Limited or Reconnecting:** If the tunnel was restarting when scanned, `server.js` auto-restarts `cloudflared` within 5 seconds and `fetchActiveTunnelUrl()` refreshes the QR code on the kiosk every 8 seconds.
  - **A2 — Offline SVG Fallback:** If the kiosk cannot reach `quickchart.io` to render the QR image, `onerror` triggers `buildFallbackQRSvgDataUri()` (`js/qr.js:73`) to show a clean fallback notice card instead of a broken image icon.
- **Result:** The visitor's smartphone opens directly into the mobile wayfinding view with the target route loaded and ready for live GPS navigation.
- **Modules Involved:** `js/qr.js`, `js/mode.js`, `js/phone-ui.js`, `js/phone-nav.js`, `js/walker.js`, `server.js`.
- **Status:** `IMPLEMENTED`

---

### UC-06: Navigate by Live GPS on the Phone

- **ID:** `UC-06`
- **Title:** Navigate by Live GPS on the Phone
- **Actor:** Campus Visitor (walking outdoors with a smartphone)
- **Goal:** Follow real-time GPS location and compass orientation along the campus road network until arriving at the destination building.
- **Preconditions:** The visitor has opened a route on their smartphone over HTTPS (`UC-05` or by selecting a building in Phone Mode and tapping **Get Directions**).
- **Main Steps:**
  1. `navigateTo()` in Phone Mode displays the GPS permission prompt card (`promptPhoneGPSPermission()` in `js/gps.js:21`).
  2. The visitor taps **Use My Live GPS**, invoking `startPhoneLiveGPS()` (`js/gps.js:146`), which requests `navigator.geolocation.watchPosition` (`enableHighAccuracy: true`) and compass orientation (`DeviceOrientationEvent.requestPermission()` on iOS or event listeners on Android).
  3. As the visitor walks outdoors across DA-LARES:
     - `handlePhoneGPSUpdate()` (`js/gps.js:252`) verifies the visitor is within $500\text{ m}$ of the campus center and that GPS accuracy is $\le 60\text{ m}$.
     - It snaps the visitor's coordinates to the nearest point on the route (`turf.nearestPointOnLine`), glides the blue user marker (`animateLiveGPSMarkerTo()`), and slices the route (`turf.lineSliceAlong`) so only the remaining path ahead is drawn.
     - `handleDeviceOrientation()` (`js/gps.js:464`) rotates the blue compass cone (`#user-gps-cone`) and smoothly aligns the 3D map bearing with the visitor's physical heading.
     - `updatePhoneLiveNavUI()` (`js/phone-nav.js:93`) updates the top banner (`#phone-top-nav-hud`) with the next turn icon, distance to turn (`"Now"` when $\le 10\text{ m}$), primary instruction, `"Then: ..."` preview, and remaining minutes/meters.
- **Alternative Paths:**
  - **A1 — Visitor Walks Off-Route ($> 28\text{ m}$ from path):** If `distToRoute > 28` meters and at least 6 seconds have elapsed since the last reroute (`js/gps.js:339`), `rerouteFromLivePosition([lng, lat])` (`js/gps.js:495`) automatically computes a brand-new shortest path from the visitor's current GPS position to the destination, updates the step list, and shows a `"🔄 Rerouting from your current location..."` toast.
  - **A2 — Visitor Denies GPS Permission or Is $> 500\text{ m}$ Outside Campus:** If permission is denied (`error.code === 1`) or `distFromCenter > 500` (`js/gps.js:272`), the app displays a friendly toast explaining why live GPS is paused and automatically keeps the animated route walkthrough active so the visitor can still study the route.
  - **A3 — Visitor Pans the Map Manually:** If the visitor drags the map with their finger during live GPS tracking, camera auto-follow pauses (`state.isPhoneCameraFollowing = false`) and a floating **Recenter** button (`#phone-recenter-fab`) appears; tapping it calls `recenterPhoneCamera()` (`js/gps.js:560`) to re-lock onto the user's GPS dot.
- **Result:** The visitor is guided turn-by-turn across the compound using live satellite positioning and compass heading.
- **Modules Involved:** `js/gps.js`, `js/phone-nav.js`, `js/phone-ui.js`, `js/routing.js`, `js/steps.js`, `js/walker.js`.
- **Status:** `IMPLEMENTED`

---

### UC-07: Replay or Cancel a Route

- **ID:** `UC-07`
- **Title:** Replay or Cancel a Route
- **Actor:** Campus Visitor
- **Goal:** Watch the walking animation again from the start, or exit the active route to return to the campus directory.
- **Preconditions:** A route is currently active or has just finished on the kiosk or smartphone.
- **Main Steps (Replay on Kiosk):**
  1. The visitor taps the **Replay Walk** button (`#replay-route-btn`) at the bottom of the left directions panel (`#route-info`).
  2. `replayRoute()` (`js/walker.js:840`) cancels any arrival countdown (`clearArrivedCountdown()`), resets the walker avatar to the starting kiosk pin, restores the full route line, and restarts the walkthrough animation from Step 1.
- **Main Steps (Cancel / Exit Route):**
  1. On the kiosk, the visitor taps **Exit Route** (`exitRouteMode()` in `js/walker.js:856` or `closeRouteAndReset()` in `js/routing.js:1265`). On a phone, the visitor taps **End Route** (`exitPhoneRoute()` in `js/phone-nav.js:264`).
  2. The system stops the walker animation and/or live GPS watcher (`stopPhoneLiveGPS()`), removes the route layers and walker marker (`clearRoute()`), restores all building markers (`setRouteMarkerLock(null)`), resets building occlusion (`resetOcclusion()`), hides the turn-by-turn HUD, and flies the camera back to the default campus overview.
- **Alternative Paths:**
  - **A1 — Selecting a Different Building While a Route Is Active:** If the user opens the sidebar and taps a different building while a route is running, `navigateTo()` cleanly clears the previous route and starts the new one.
- **Result:** The route is either replayed from the beginning or cleanly exited back to the main directory view.
- **Modules Involved:** `js/walker.js`, `js/routing.js`, `js/phone-nav.js`, `js/gps.js`, `js/markers.js`, `js/occlusion.js`.
- **Status:** `IMPLEMENTED`

---

### UC-08: Arrive at the Destination

- **ID:** `UC-08`
- **Title:** Arrive at the Destination
- **Actor:** Campus Visitor
- **Goal:** See a clear visual confirmation that the route has reached the target building, inspect the destination in 3D, and either stay on the building or return to the overview.
- **Preconditions:** Either the kiosk walker reaches the final coordinate of `state.currentRouteCoords`, or the smartphone's live GPS position comes within **$12\text{ m}$** of the destination (`remainingTotal <= 12` in `js/gps.js:392`).
- **Main Steps (Kiosk Walkthrough Arrival):**
  1. When the animated walker reaches the end of the path (`progress >= 1` in `js/walker.js`), the system displays the top `#arrived-banner` notification (`"Arrived — You have arrived at <Building Name>"`, automatically switching from a compact 1-line title to a 2-line subtitle layout when the building name exceeds 32 characters).
  2. The camera smoothly transitions into a 3D inspection orbit around the destination building (`orbitBuilding()`), and `startArrivedCountdown()` (`js/walker.js:904`) starts a **10-second** auto-return countdown badge (`#arrived-countdown-bar`).
  3. When the 10-second countdown finishes, the system automatically clears the route, opens the destination building's detail drawer (`showBuildingPanel()`), or resets if idle.
- **Main Steps (Phone Live GPS Arrival):**
  1. When the visitor walks within $12\text{ m}$ of the destination entrance (`js/gps.js:392`), `triggerPhoneArrival()` (`js/phone-nav.js:211`) vibrates the smartphone (`navigator.vibrate([200, 100, 200])`), stops GPS tracking (`stopPhoneLiveGPS()`), hides the top maneuver HUD, and shows the `#phone-arrival-banner` card with the destination name and a button to view building details or finish.
- **Alternative Paths:**
  - **A1 — Visitor Cancels Auto-Return Countdown on Kiosk:** If the visitor taps **Stay Here** or interacts with the map during the 10-second arrival countdown, `clearArrivedCountdown()` cancels the timer so they can continue inspecting the destination.
- **Result:** The visitor receives unmistakable confirmation of arrival and sees the building's 3D structure and photo details.
- **Modules Involved:** `js/walker.js`, `js/phone-nav.js`, `js/gps.js`, `js/idle.js`, `js/building-panel.js`.
- **Status:** `IMPLEMENTED`

---

### UC-09: Idle / Screensaver Auto-Reset

- **ID:** `UC-09`
- **Title:** Idle / Screensaver Auto-Reset
- **Actor:** System Timer (triggered automatically when a Campus Visitor walks away from the kiosk)
- **Goal:** Return the unattended kiosk to a clean, welcoming state so the next visitor does not walk up to someone else's finished route or open modal, while protecting the kiosk hardware from overheating during long idle periods.
- **Preconditions:** The app is running in Kiosk Mode (`isKioskMode() === true`), and no touch, mouse, scroll, or keyboard event has occurred for **45 seconds** (`IDLE_TIMEOUT = 45000` in `js/data/config.js:56`).
- **Main Steps:**
  1. Every user interaction calls `resetIdle()` (`js/idle.js:285`), which resets a 45-second timer.
  2. When 45 seconds pass without interaction (and no route walkthrough is actively mid-walk, `state.walkAnimFrame === null`):
     - `resetIdle()` closes any open QR zoom modal (`closeQRZoomModal()`), photo lightbox (`closePhotoLightbox()`), building detail drawer (`closeBuildingPanel()`), and active route (`closeRouteAndReset()`).
     - Clears any search text in `#search-input` and resets category filtering to `'all'` (`filterByCategory('all')`).
     - Flies the camera smoothly back to the station's default 3D overview (`getActiveStationDefaultView()`) and starts a continuous 30 FPS orbital rotation (`startIdleRotation()` in `js/idle.js:232`).
  3. If the kiosk remains untouched for **5 continuous minutes** of idle rotation (`MAX_CONTINUOUS_ORBIT_MS = 300000` ms in `js/idle.js:230`), the animation loop automatically pauses (`stopIdleRotation()`) to enter **Thermal Eco-Rest Mode**, dropping GPU load to near zero until the next visitor touches the screen.
- **Alternative Paths:**
  - **A1 — Visitor Touches the Screen During Idle Orbit:** Any touch or mouse event immediately invokes `stopIdleRotation()` and `resetIdle()`, restoring full interactive control.
  - **A2 — QR Zoom Modal Left Open:** If a visitor opens the enlarged QR modal (`openQRZoomModal()`) and walks away after scanning, a dedicated **25-second** countdown (`resetQRAutoExitCountdown()` in `js/qr.js:217`) automatically closes the modal and exits the route early.
- **Result:** The kiosk stays clean and ready for the next visitor while preventing GPU thermal throttling over 24/7 operation.
- **Modules Involved:** `js/idle.js`, `js/qr.js`, `js/routing.js`, `js/building-panel.js`, `js/sidebar.js`, `js/data/config.js`.
- **Status:** `IMPLEMENTED`

---

### UC-10: Customize Map View, Lighting, 1-Finger Orbit, and Performance Profile

- **ID:** `UC-10`
- **Title:** Customize Map View, Lighting, 1-Finger Orbit, and Performance Profile
- **Actor:** Campus Visitor, DA Staff, Administrator
- **Goal:** Switch between the high-resolution Drone Aerial View and Mapbox 3D Standard View, toggle map layers or label density, enable 1-finger accessibility orbiting, or tune GPU/battery performance.
- **Preconditions:** The map canvas is loaded in Kiosk or Phone Mode.
- **Main Steps:**
  1. **Switch Base Map Style (Drone vs. Mapbox 3D):** The user taps the **Aerial Drone** / **Mapbox 3D** style toggle button (`switchMapStyle()` in `js/map-setup.js:888`), switching between the local $10.29\text{ GB}$ drone orthomosaic (`LARES v1.mbtiles`) and Mapbox Standard 3D terrain.
  2. **Enable 1-Finger Orbit Accessibility Mode:** The user taps the **3D Orbit** joystick button in the floating camera toolbar (`toggleOneFingerOrbitMode()` in `js/orbit-control.js:18`). Single-finger dragging now rotates and tilts the 3D camera (`pitch` and `bearing`) instead of panning, allowing one-handed or single-finger 3D inspection. Tapping the button again restores normal 1-finger panning.
  3. **Open Map Settings Popover:** The user taps the gear icon (`toggleMapSettingsPanel()` in `js/map-settings.js:211`) to:
     - Toggle visibility of **3D Buildings**, **Facility Numbers**, **Crop Plots**, or **Campus Boundary** (`handleLayerToggle()`).
     - Switch marker pins between **Full Labels** and **Compact Numbers** (`setLabelDisplayMode()`).
     - Switch 3D sun lighting between **Dawn**, **Day**, **Dusk**, and **Night** (`setLightingPreset()` $\rightarrow$ `applyTimePreset()` in `js/map-setup.js:970`).
     - Select a **Performance Profile** (`setPerformanceProfile()` in `js/performance.js:146`): `⚡ Auto`, `🌿 Kiosk Eco` (or `🔋 Battery Saver` on mobile), or `💎 High`.
- **Alternative Paths:**
  - **A1 — Automatic Low-FPS Fallback:** If the profile is set to `Auto` and `startFrameRateMonitor()` (`js/performance.js:218`) detects 3 consecutive checks below **26 FPS**, the system automatically activates `lowPerformanceMode`, lowering pixel ratio to `1.0x` and hiding 3D trees without requiring user intervention.
- **Result:** The map visual style, layer visibility, touch accessibility, and rendering workload immediately match the user's or device's needs.
- **Modules Involved:** `js/map-setup.js`, `js/map-settings.js`, `js/orbit-control.js`, `js/performance.js`, `js/plot-layers.js`.
- **Status:** `IMPLEMENTED`

---

### UC-11: Switch Research Station (DA-LARES / DA-QARES)

- **ID:** `UC-11`
- **Title:** Switch Research Station (DA-LARES / DA-QARES)
- **Actor:** DA Staff, Administrator
- **Goal:** Switch the map, directory, drone orthomosaic, and road network between **DA-LARES (Lipa City, Batangas)** and **DA-QARES (Tiaong, Quezon)**.
- **Preconditions:** The user is in Kiosk Mode and clicks the station header dropdown at the top of the left sidebar (`#station-selector-btn`).
- **Main Steps:**
  1. The user clicks the **DA-LARES (Lipa)** header card (`toggleStationDropdown()` in `js/sidebar.js:108`) and selects **DA-QARES (Tiaong)** (`switchActiveStation('qares')` in `js/app.js:210`).
  2. `switchActiveStation()` clears any active route or open drawer, updates `state.currentStationId = 'qares'`, swaps the active road network to `qares_roads.json` (31 features), rebuilds the routing graph (`buildRoadGraph()`), loads the 48 QARES building footprints (`GET /api/qares/buildings`), switches the offline drone tile source to `/api/qares/tiles/{z}/{x}/{y}` (`QARES v1.mbtiles`, $234.30\text{ MB}$), places the QARES `"You Are Here"` pin (`state.QARES_KIOSK_COORDS`), updates the sidebar directory, and flies the camera to Tiaong, Quezon.
- **Alternative Paths:**
  - **A1 — Switching Back to DA-LARES:** Selecting **DA-LARES (Lipa)** in the dropdown calls `switchActiveStation('lares')`, restoring the 39 numbered LARES buildings, 48 custom 3D `.glb` models, 23 plot zones, and $10.29\text{ GB}$ LARES drone orthomosaic.
- **Result:** The application transitions between the two research stations without reloading the page.
- **Modules Involved:** `js/app.js`, `js/sidebar.js`, `js/map-setup.js`, `js/routing.js`, `js/idle.js`, `js/data/stations.js`, `server.js`.
- **Status:** `PARTIAL` (DA-LARES is $100\%$ complete in 3D; DA-QARES has drone imagery, 48 2D/extruded footprints, and routing, but no bespoke 3D `.glb` models, internal office directory, or plot zones yet).

---

### UC-12: Admin Updates (Move the Kiosk Pin, Calibrate Drone Imagery, Edit Colors & Edit Building Data)

- **ID:** `UC-12`
- **Title:** Admin Updates (Move the Kiosk Pin, Calibrate Drone Imagery, Edit Colors & Edit Building Data)
- **Actor:** System Administrator, IT / Maintainer
- **Goal:** Update the physical `"You Are Here"` kiosk location, fine-tune the alignment between 3D models and aerial drone imagery, customize building roof/badge colors, or edit building footprints, roads, plots, and trees.
- **Preconditions:** The administrator opens the app via `start_admin.bat` (`http://localhost:8080/?admin=1`), presses `Alt + Shift + A` (`toggleAdminMode()` in `js/app.js:354`), or opens one of the standalone authoring pages (`draw.html`, `road_draw.html`, `plot_draw.html`, `tree_draw.html`).
- **Main Steps:**
  1. **Move the Kiosk Pin (`js/idle.js:14-120`):**
     - In Admin Mode, the `"📍 You Are Here 🔓 (Drag to move)"` badge turns yellow and draggable.
     - The admin drags the pin to the new kiosk lobby position and releases it.
     - `repositionActiveKioskPin(newCoords)` sends `POST /api/pin` (or `POST /api/qares/pin`), which saves the new coordinates to `pin.json` and the MySQL `settings` table (`key = 'kiosk_pin'`) and shows a confirmation toast.
  2. **Edit Building Roof & Marker Badge Colors (`js/building-panel.js:1508-1635`):**
     - With Admin Mode active, the admin opens any building drawer to reveal the **Customize Building Colors** section, picks a new Roof Color or Badge Color (`previewColor()`), and clicks **Save Colors** (`saveCurrentColor()`).
     - The app sends `POST /api/colors` to `server.js`, persisting the colors to `colors.json` and the MySQL `building_colors` table.
  3. **Calibrate Drone Orthomosaic Alignment (`js/drone-calibration.js`):**
     - The admin clicks the **Drone Calibration** button in the top-right toolbar (or presses `Alt + Shift + D`) to open `#drone-calibration-hud`.
     - Using the East/West (`dx`) and North/South (`dy`) sliders or nudge arrows, the admin shifts all 3D models, footprints, markers, and boundaries in real time (`applyDroneOffset()`) and clicks **Save Offset** (`saveDroneOffsetToServer()` $\rightarrow$ `POST /api/drone-offset`), which writes to `drone_offset.json` and MySQL.
  4. **Edit Building, Road, Plot, or Tree Geometry (Standalone Editors):**
     - The maintainer opens `http://localhost:8080/draw.html` (buildings), `/road_draw.html` (roads & entrances), `/plot_draw.html` (agricultural plots), or `/tree_draw.html` (3D trees), edits the shapes over the drone map, and clicks **Save**, triggering `POST /api/buildings`, `POST /api/roads`, `POST /api/plots/sync`, or `POST /api/trees` to update the corresponding `.json` and `js/data/*.js` files on disk.
- **Alternative Paths:**
  - **A1 — MySQL Database Service Is Stopped:** When the admin saves a pin, color, or drone offset while MySQL is offline, `server.js` catches the DB error and still writes the update to `pin.json`, `colors.json`, or `drone_offset.json` so no work is lost.
- **Result:** Updated kiosk pin coordinates, color schemes, drone alignment offsets, or campus geometries are persisted on the server and reflected on reload.
- **Modules Involved:** `js/app.js`, `js/idle.js`, `js/building-panel.js`, `js/drone-calibration.js`, `draw.html`, `road_draw.html`, `plot_draw.html`, `tree_draw.html`, `server.js`.
- **Status:** `PARTIAL` (Works locally, but lacks password authentication on admin mode and write API endpoints, and adding a brand-new building to the searchable directory still requires updating metadata tables in `js/data/buildings.js` and `js/data/descriptions.js`; see `docs/03-limitations-and-roadmap.md`).

---

## Verification — Files Read to Produce This Document

- `docs/00-system-overview.md`, `docs/01-modules.md`
- `index.html`, `server.js`, `start_admin.bat`
- `js/app.js`, `js/mode.js`, `js/map-setup.js`, `js/markers.js`, `js/plot-layers.js`, `js/occlusion.js`, `js/orbit-control.js`
- `js/sidebar.js`, `js/building-panel.js`, `js/map-settings.js`
- `js/routing.js`, `js/steps.js`, `js/walker.js`, `js/idle.js`
- `js/qr.js`, `js/phone-ui.js`, `js/phone-nav.js`, `js/gps.js`
- `js/performance.js`, `js/drone-calibration.js`
- `js/data/config.js`, `js/data/state.js`, `js/data/stations.js`, `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`
- `draw.html`, `road_draw.html`, `plot_draw.html`, `tree_draw.html`

