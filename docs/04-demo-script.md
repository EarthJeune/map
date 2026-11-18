# iGUIDE — 10-Minute Live Demo Script

**Target Audience:** DA CALABARZON (Region IV-A) Supervisors, Division/Station Staff, Researchers, and IT Personnel  
**System:** **iGUIDE** (*Interactive Geospatial Unified Information Directory and Explorer*)  
**Total Duration:** 10 Minutes (plus Q&A)  
**Presenter Setup:** Laptop or Touchscreen connected to the projector running the system (showing both public web / kiosk mode and the `?deployed=1` *"Station Under Development"* modal), plus a smartphone ready to scan the on-screen QR code.

---

## Pre-Demo Checklist (5 Minutes Before Presenting)

1. **Start the Server & Kiosk View:** Double-click `start_kiosk.bat` (or run `node server.js` and open `http://localhost:8080/?deployed=1` in Edge/Chrome at full screen `F11` so selecting secondary stations demonstrates the public *"Under Development"* modal).
2. **Verify the Welcome Screen:** Ensure the **Welcome Modal** (`#welcome-modal`) is visible over the stationary 3D aerial view (`index.html`).
3. **Pre-Test the QR Tunnel:** Scan the QR code once on your phone before the meeting starts and leave that mobile tab open in a background browser tab (this also serves as your instant backup if venue Wi-Fi/cellular lags during the live scan).
4. **Open a Second Browser Tab for Mobile Projection (Optional):** Keep `http://localhost:8080/?dest=rnd_building&mode=phone` open in a second browser tab sized to a narrow phone window (`400px` wide via DevTools `F12` Device Toolbar) so the audience on the projector can clearly see what the smartphone screen looks like.
5. **Verify Offline Interaction vs. Fresh Reload (`LIM-01` Check):** Load the page with the network connected, disconnect the network, test map interaction (confirming that local drone tiles, 3D models, `.webp` photos, search, and Dijkstra routing continue working in the already-open tab), then reconnect the network and test a page reload (confirming that CDN scripts `mapbox-gl.js`, `@turf/turf@6.5.0`, and Google Fonts load cleanly).

---

## Minute-by-Minute Live Demo Script (10 Minutes)

### Minute 0:00 – 1:45 | Segment 1: Regional Multi-Station Vision, Public Web Access & DA-LARES Flagship Fly-In (`UC-11`)
- **What Is on Screen:** The initial **Welcome Modal** (`#welcome-modal`) over the high-angle campus view.
- **What to Click:**
  1. Point out the **Select Station** dropdown on the Welcome Screen (`#welcome-station-dropdown`) or top-left sidebar showing all **4 DA-CALABARZON Research Stations**: **DA-LARES (Lipa, Batangas)**, **DA-QARES (Tiaong, Quezon)**, **DA-RARES (Tanay, Rizal)**, and **DA-CARES (Naic, Cavite)**.
  2. Click **DA-RARES** or **DA-QARES** to briefly show the **"Station Under Development"** modal (`#station-dev-modal`), then click **Stay on DA-LARES**.
  3. Click the green **Proceed to Campus Map** button (`dismissWelcomeModal()`).
  4. Let the 3D camera perform its smooth fly-in down to the DA-LARES compound overview, showing the `📍 You Are Here` pin at **Argosino Hall** (`[121.1664336, 13.9581208]`), the **39 numbered building pins**, the **49 custom 3D building models**, and the **131 3D trees** sitting on top of the local **210.66 MB drone orthomosaic**.
- **What to Say:**
  > *"Good morning/afternoon everyone. Today we are presenting our interactive 3D mapping and wayfinding platform for **all four DA-CALABARZON Research Stations**—DA-LARES in Lipa, DA-QARES in Tiaong, DA-RARES in Tanay, and DA-CARES in Naic. Once deployed, **anyone can search and explore this system online**, in addition to using it on our lobby touchscreen kiosk and via smartphone GPS. Today we are presenting **DA-LARES** first because this is where we started and completed 49 custom 3D building models, 47 office listings, and 45 field plots, while QARES, RARES, and CARES are displayed as 'Under Development' during this initial launch. And importantly, we built this not just for first-time visitors asking for directions, but also for **our own station workers and researchers**."*

---

### Minute 1:45 – 3:30 | Segment 2: Searching for an Internal Office & Inspecting a 3D Building (`UC-01`, `UC-02`)
- **What to Click:**
  1. Click the search box (`#search-input`) in the top-left sidebar and type **`BAC`** (or **`Cashier`** / **`PMED`**).
  2. Point out how the directory immediately filters to **Tanco Hall Building (`#12`)** and **Multi-Purpose Administrative Building (`#22`)**, showing a green badge (`🏢 BAC`) right under the building name.
  3. Clear the search box, click **Filter**, and briefly show the **7 official facility categories** (`Agri Infrastructure`, `Agri-Eco Trial Sites`, `Orchard & Plantation`, `Office Building`, `Research Laboratory`, `Conference & Training`, `Digital Agriculture`). Select **All Types**.
  4. Click **`#9 RAED Building`** (or **`#21 R&D Multipurpose Building`**) in the directory list.
  5. Let the camera fly to the building and orbit smoothly in 3D (`orbitBuilding()`). Point to the right-hand detail drawer (`#building-panel`):
      - Click the **photo view chips** to switch camera angles, then click **Enlarge** (`openPhotoLightbox()`) to show the full-screen `.webp` ground-truth photo, and close it.
      - Point out the two visitor-friendly cards: **How to Spot It** (visual landmarks like roof color and signage) and **What's Inside & Services**, plus the clickable **internal office chips**.
- **What to Say:**
  > *"Whether someone is searching our map online before visiting or standing at the lobby kiosk, they rarely know building numbers—they ask, 'Where is the BAC?' or 'Where is the Cashier?' Typing any office acronym immediately highlights the parent building. When we tap a facility like RAED or the R&D Building, the camera orbits its custom 3D model while the right drawer shows fast-loading WebP field photos, a 'How to Spot It' guide so they recognize it outdoors, and every verified office inside."*

---

### Minute 3:30 – 5:15 | Segment 3: For Both Visitors & Station Workers — The 45 Agricultural Plots & Live MySQL Agronomic Intelligence (`UC-01`)
- **What to Click:**
  1. In the left sidebar, click **Filter** and select **Agri-Eco Trial Sites** or **Orchard & Plantation** (or toggle **Agricultural Plots** in the Map Settings menu).
  2. Scroll to and click **TC Makapuno & Banana Screenhouse (`Plot 17`)** or **Coffee Orchard (`Plot 22`)** or **Citrus Orchard (`Plots 6–12`)**.
  3. Show how the map illuminates the exact field boundary and internal sub-plot cut lines (`selectPlotZone()`).
  4. In the right-hand plot drawer (`showPlotPanel()`), point out the live MySQL agronomic fields (**Current Planted Crop**, **Tree/Plant Count**, **Planting Cycle**: *Perennial / Annual / Monthly-Seasonal*, and **Plot Status**), and click one of the sub-plot cards (e.g., **Screenhouse 1** in Plot 17, or **LARES Water Tank** / **Plot 22 Comfort Room** in Plot 22) to zoom straight to that structure.
- **What to Say:**
  > *"Here is why this system is equally important for **our own station workers, researchers, and farm superintendents**—not just visitors. We mapped all **45 numbered experimental field plots** grouped into **23 official commodity zones**, including individual screenhouses in Plots 17 and 18 and field utilities in Plot 22. Backed by our 11-table MySQL database, workers can inspect any plot—and even search directly by crop name—to see **what specific crop or variety is currently planted**, **the exact tree or plant count**, and whether that plot is designated for **perennial orchards, annual crops, or monthly/seasonal trials**."*

---

### Minute 5:15 – 7:00 | Segment 4: 3D Walking Directions, X-Ray Building Transparency & Speed Controls (`UC-03`, `UC-04`, `UC-08`)
- **What to Click:**
  1. Select **`#32 LARES Synthetic Fertilizer Storage / LARES Pesticide Storage`** (or **`#25 Regional Soils Laboratory`**) and click the green **Get Directions** button (`navigateTo()`).
  2. Point out the glowing green shortest path computed across the **2.68 km road and walkway network** (`roads.json`) and the **Turn-by-Turn Directions** list on the left (`buildSteps()`), which uses real campus buildings as turn landmarks (e.g., *"Turn right at MIS / RAFIS Building"*).
  3. Watch the animated walker begin walking. Point out how 3D buildings that stand between the camera and the walker automatically turn into **frosted glass (X-ray occlusion)** so the walker is never hidden behind a roof.
  4. Click the **SPEED** buttons: switch from **`1x`** to **`4x`** or **`6x`** (`setRouteSpeed()`) so the walker reaches the destination during the demo.
  5. Click the bottom-right **CAMERA** pills (**Side View**, **Top View**, **Unlocked**) to demonstrate camera control.
  6. Let the walker finish to show the top **Arrived** banner and the 10-second auto-return countdown (`startArrivedCountdown()`). Click **Replay Walk** (`replayRoute()`) so the route stays onscreen for the QR handoff.
- **What to Say:**
  > *"When a visitor or worker taps 'Get Directions', the system calculates the shortest walking path along our 2.68-kilometer road network right to the entrance door or plot access point. Notice two details as our animated walker moves: first, every turn instruction names the actual building at that corner; second, whenever a 3D building blocks our line of sight, it automatically fades into frosted glass so you never lose track of the path. Users can preview the walk at 1x, 2x, 4x, or 6x speed."*

---

### Minute 7:00 – 8:45 | Segment 5: QR Code Handoff & Live Smartphone GPS Navigation (`UC-05`, `UC-06`)
- **What to Click:**
  1. In the left directions panel (or building drawer), click **Tap QR to Enlarge** (`openQRZoomModal()`) to bring up the large scannable QR code on the projector screen.
  2. Hold up your smartphone (or invite a colleague in the front row to point their phone camera at the projector screen) and scan the QR code.
  3. Switch the projector to your mobile view (or the narrow phone-mode browser tab `?dest=rnd_building&mode=phone`).
  4. Show the **Draggable Bottom Sheet** (`peek`, `half`, `full`), the **Top Turn-by-Turn Maneuver Banner** (`#phone-top-nav-hud`), and the **Use My Live GPS** prompt (`promptPhoneGPSPermission()`).
  5. Explain how live GPS works outdoors on campus (road-snapping blue dot, compass heading cone, automatic rerouting if the user walks >28 m off path, and automatic fallback to simulated preview when someone searches the map online from home >500 m away).
- **What to Say:**
  > *"On-site at the compound, visitors don't have to memorize the map on the kiosk. By tapping 'Enlarge QR', anyone can scan the screen with their phone camera—no app download required. The exact route opens on their phone in a mobile interface. Outdoors on campus, tapping 'Use My Live GPS' tracks their live steps along the walkway, rotates the map with their phone's compass, and automatically recalculates the path if they take a wrong turn. And if someone searches our deployed website from home, it automatically plays the animated route preview instead."*

---

### Minute 8:45 – 10:00 | Segment 6: Accessibility, 3-Tier Adaptive GPU Engine & Web Admin Portal (`UC-09`, `UC-10`, `UC-12`)
- **What to Click:**
  1. Return to the main kiosk tab and exit the route (`Exit Route`).
  2. Click the **3D Orbit** accessibility button in the bottom-right toolbar (`toggleOneFingerOrbitMode()`) and drag with a single mouse button / single finger to show how users who cannot do two-finger gestures can still rotate the 3D map. Click it again to return to normal pan.
  3. Click the **Map Settings (Gear)** icon (`toggleMapSettingsPanel()`):
      - Show the **Basemap Layer Mode**: click **Mapbox View** to switch to the clean 3D vector cartography mode, then click **Aerial Drone View** to demonstrate returning seamlessly to the authentic sub-centimeter drone orthomosaic without losing camera position or 3D buildings.
      - Show the **Layer Visibility** toggles (**3D Buildings**, **Building Labels**, **Perimeter Boundary**, **Agricultural Plots**) and **Label Display Mode** (**Full Pill View** vs. **Compact Number**).
      - Briefly toggle **Dawn / Day / Dusk / Night** lighting (`setLightingPreset()`).
      - Point out the **Performance Profile** (`Auto — Adaptive`, `Kiosk Eco`, `High`) and how `Auto (Adaptive)` automatically enables `Eco-Tuned` mode on integrated GPUs.
  4. Switch to the open **`http://localhost:8080/admin`** tab (pre-logged into the password-protected admin portal). Briefly show the **Dashboard & Status** KPI cards, the interactive **"`You Are Here` Pin & Station"** satellite map editor, the **Multi-Photo `.webp` Uploader**, **Internal Offices**, and **Agricultural Plots & Crops**—explaining how any save in `/admin` immediately updates the live 3D map and search bar via `BroadcastChannel` without reloading.
- **What to Say:**
  > *"Finally, we built this for real-world daily operations. For accessibility, there is a 1-Finger Orbit toggle so anyone can rotate the 3D map with a single finger, plus Full Pill and Compact Number label modes. Under Settings, our 3-Tier Adaptive Performance Engine automatically detects integrated GPUs and tunes rendering to keep frame rates smooth, paired with a 45-second idle reset so the kiosk stays cool running 24/7. And through our password-protected admin portal—backed by an 11-table MySQL database—staff can drag the 'You Are Here' pin, upload new WebP photos, manage internal offices, or update planted crops and tree counts with instant live synchronization across the map."*

---

## Backup Plan If the Internet or Cloudflare Tunnel Fails During the Demo

| Failure Scenario | What Still Works Locally | Exact Presenter Recovery Step |
| :--- | :--- | :--- |
| **1. Cloudflare Tunnel Is Slow or Blocked by Venue Firewall** | Everything on the presenter laptop (`http://localhost:8080`) works at full speed. Only the phone scanning over cellular data is affected. | **Option A (Same Wi-Fi):** Connect the demo laptop and demo phone to the same mobile hotspot and open `http://<laptop-LAN-IP>:8080/?dest=rnd_building&mode=phone`.<br>**Option B (On-Screen Phone Simulation):** Switch to your pre-opened second browser tab running `http://localhost:8080/?dest=rnd_building&mode=phone` in mobile responsive view (`400x820`). |
| **2. Venue Internet Drops Completely Mid-Demo** | If the browser tab is **already open** (so CDN libraries `mapbox-gl.js`, `@turf/turf@6.5.0`, and Google Fonts are already in memory — `LIM-01`), the 210.66 MB drone map (`LARES v1.mbtiles`), all 54 3D `.glb` models, all 63 `.webp` photos, directory search, and Dijkstra routing are served locally from `localhost:8080`. A fresh page reload requires internet access to fetch the CDN libraries and Mapbox base styles. | **Do NOT press `F5` / Refresh** if internet is completely down. Stay in the already-open tab, keep the map in **Aerial Drone View** (which reads tiles locally from `LARES v1.mbtiles`), and run Segments 1–4 and 6 normally. |
| **3. Local MySQL Service Is Stopped on Demo Laptop** | All public map features continue working. | Do nothing—`server.js` automatically falls back to reading/writing local JSON files (`pin.json`, `colors.json`, `drone_offset.json`) and in-memory defaults without throwing any user-facing errors. |

---

## Likely Questions from the Audience & Factual Answers

### 1. *"Why are we presenting DA-LARES today while QARES, RARES, and CARES say 'Under Development'?"*
- **Answer:** The platform was architected from day one for **all four DA-CALABARZON research stations** (`stations` MySQL table, `js/data/stations.js`, `js/stations.js`). We started with **DA-LARES** as our flagship pilot station and completed its 49 custom 3D building models, 47 office listings, 45 field plots, and 2.68 km routing graph. While we have already onboarded the drone maps and footprints for **DA-RARES** (206.54 MB MBTiles, 45 footprints, 45 plots, custom 3D Guard House) and **DA-QARES** (223.44 MB MBTiles, 53 footprints, 31 roads), gating them as *"Under Development"* in public deployed mode ensures that anyone searching the live system today gets a verified experience on DA-LARES—and administrators can unlock each station with a single click in `/admin` once its 3D models are complete.

### 2. *"How do station workers and researchers use this differently from visitors?"*
- **Answer:** Visitors primarily use the system to find offices, buildings, and walking routes. For **station workers, researchers, and farm superintendents**, the **Agricultural Plots** module (covering Plots 1–45 across 23 commodity zones and backed by the `agricultural_plots` MySQL table) serves as a live operational field map. Clicking any plot shows workers **what specific crop or variety is currently planted there**, the **exact tree or plant count**, **plot status**, and whether that plot is designated for **perennial orchards, annual crops, or monthly/seasonal trials**—all editable in real time via `/admin` and searchable in the map's search bar.

### 3. *"Can anyone search this system online, or do they have to be standing at the kiosk?"*
- **Answer:** **Anyone can search and use it online.** Once deployed, the web map is publicly accessible from any desktop computer, tablet, or smartphone browser—so farmers, guests, and staff can look up buildings, offices, and plots from anywhere, in addition to using the lobby touchscreen kiosk and QR-code GPS handoff on-site.

### 4. *"Does the system track or store visitors' personal phone data or GPS locations?"*
- **Answer:** **No.** Zero personal data is collected. When a visitor turns on Live GPS on their phone, the GPS coordinates (`navigator.geolocation.watchPosition` in `js/gps.js`) stay strictly inside their own phone's browser memory to move the blue dot on their screen—those coordinates are **never sent to our server or saved in the database**.

### 5. *"Will the 3D graphics and photos slow down an older office PC or mobile data connection?"*
- **Answer:** Every 3D building model is strictly under **300 kilobytes**, and all **63** campus photographs were converted to high-efficiency **`.webp`** format (`tools/convert_photos_to_webp.py`). Furthermore, `js/performance.js` automatically detects older Intel integrated graphics and mobile processors, disables heavy anti-aliasing, and provides a one-tap **Kiosk Eco / Mobile Battery Saver** mode (`1.0x` resolution) plus a 45-second idle reset and 5-minute thermal pause.

---

## Verification — Files Read to Produce This Document

- `docs/00-system-overview.md`, `docs/01-modules.md`, `docs/02-use-cases.md`, `docs/03-limitations-and-roadmap.md`
- `index.html`, `server.js`, `start_kiosk.bat`, `start_admin.bat`
- `js/app.js`, `js/stations.js`, `js/sidebar.js`, `js/building-panel.js`, `js/plot-layers.js`, `js/routing.js`, `js/steps.js`, `js/walker.js`, `js/occlusion.js`, `js/qr.js`, `js/gps.js`, `js/phone-ui.js`, `js/phone-nav.js`, `js/orbit-control.js`, `js/map-settings.js`, `js/performance.js`, `js/idle.js`
- `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`, `js/data/stations.js`
