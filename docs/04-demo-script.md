# DA-LARES Interactive 3D Campus Wayfinding System — 10-Minute Live Demo Script

**Target Audience:** DA CALABARZON (Region IV-A) Supervisors, Division/Station Staff, and IT Personnel  
**Total Duration:** 10 Minutes (plus Q&A)  
**Presenter Setup:** Laptop or Touchscreen connected to the projector running `http://localhost:8080`, plus a smartphone with camera ready to scan the on-screen QR code.

---

## Pre-Demo Checklist (5 Minutes Before Presenting)

1. **Start the Server & Kiosk View:** Double-click `start_kiosk.bat` (or run `node server.js` and open `http://localhost:8080` in Edge/Chrome at full screen `F11`).
2. **Verify the Welcome Screen:** Ensure the **Welcome to DA-LARES** modal is visible over the stationary 3D aerial view (`index.html`).
3. **Pre-Test the QR Tunnel:** Scan the QR code once on your phone before the meeting starts and leave that mobile tab open in a background browser tab (this also serves as your instant backup if venue Wi-Fi/cellular lags during the live scan).
4. **Open a Second Browser Tab for Mobile Projection (Optional):** Keep `http://localhost:8080/?dest=rnd_building&mode=phone` open in a second browser tab sized to a narrow phone window (`400px` wide via DevTools `F12` Device Toolbar) so the audience on the projector can clearly see what the smartphone screen looks like.

---

## Minute-by-Minute Live Demo Script (10 Minutes)

### Minute 0:00 – 1:30 | Segment 1: Welcome Fly-In & 3D Campus Overview
- **What Is on Screen:** The initial **Welcome Modal** (`#welcome-modal`) over the high-angle campus view.
- **What to Click:**
  1. Point out the station branding (**DASH — DA-LARES Lipa Agricultural Research & Experiment Station**).
  2. Click the green **Proceed to Campus Map** button (`dismissWelcomeModal()`).
  3. Let the 3D camera perform its smooth fly-in down to the compound overview, showing the `📍 You Are Here` pin at **Argosino Hall** (`[121.1664336, 13.9581208]`), the **39 numbered building pins**, the **48 custom 3D building models**, and the **131 3D trees** sitting on top of the local **$10.29\text{ GB}$ drone orthomosaic**.
- **What to Say:**
  > *"Good morning/afternoon everyone. Today we are presenting the DA-LARES Interactive 3D Wayfinding System, or DASH. When a farmer, researcher, or guest arrives at Argosino Hall, this is the touchscreen they walk up to. When we tap 'Proceed to Campus Map', the system flies directly into an authentic 3D digital twin of the Lipa compound—combining a 10.29-gigabyte high-resolution drone map stored right on the computer with 48 custom-modeled 3D facilities and 39 numbered directory landmarks."*

---

### Minute 1:30 – 3:30 | Segment 2: Searching for an Internal Office & Inspecting a 3D Building (`UC-01`, `UC-02`)
- **What to Click:**
  1. Click the search box (`#search-input`) in the top-left sidebar and type **`BAC`** (or **`Cashier`** / **`PMED`**).
  2. Point out how the directory immediately filters to **Tanco Hall Building (`#12`)** and **Multi-Purpose Administrative Building (`#22`)**, showing a green badge (`🏢 BAC`) right under the building name.
  3. Clear the search box, click **Filter**, and briefly show the **7 official facility categories** (`Agri Infrastructure`, `Agri-Eco Trial Sites`, `Orchard & Plantation`, `Office Building`, `Research Laboratory`, `Conference & Training`, `Digital Agriculture`). Select **All Types**.
  4. Click **`#9 RAED Building`** (or **`#21 R&D Multipurpose Building`**) in the directory list.
  5. Let the camera fly to the building and orbit smoothly in 3D (`orbitBuilding()`). Point to the right-hand detail drawer (`#building-panel`):
     - Click the **photo view chips** to switch camera angles, then click **Enlarge** (`openPhotoLightbox()`) to show the full-screen ground-truth photo, and close it.
     - Point out the two visitor-friendly cards: **How to Spot It** (visual landmarks like roof color and signage) and **What's Inside & Services**, plus the clickable **internal office chips**.
- **What to Say:**
  > *"Visitors rarely know our building numbers—they usually ask, 'Where is the BAC?' or 'Where do I pay the Cashier?' Typing any office acronym immediately highlights the exact parent building. When we tap a facility like the RAED Building or R&D Building, the camera orbits its 3D model so the visitor sees its actual roof, porch, and signage. On the right, instead of technical jargon, we show real field photos, a 'How to Spot It' guide so they recognize it outdoors, and every office inside."*

---

### Minute 3:30 – 5:00 | Segment 3: Exploring the 23 Agricultural Plot Zones & Screenhouse Sub-Plots (`UC-01`)
- **What to Click:**
  1. In the left sidebar, click **Filter** and select **Agri-Eco Trial Sites** (or click the **Crop Plots** toggle in the Map Settings gear menu).
  2. Scroll to and click **TC Makapuno & Banana Screenhouse (`Plot 17`)** or **Coffee Orchard (`Plot 22`)**.
  3. Show how the map illuminates the exact field boundary and internal sub-plot cut lines (`selectPlotZone()`).
  4. In the right-hand plot drawer (`showPlotPanel()`), click one of the sub-plot cards (e.g., **Screenhouse 1** in Plot 17, or **LARES Water Tank** / **Plot 22 Comfort Room** in Plot 22) to zoom straight to that specific structure.
- **What to Say:**
  > *"Because DA-LARES is an active research station, wayfinding isn't just for office buildings. We mapped all 45 numbered experimental field plots grouped into 23 official commodity zones—from the Citrus and Coffee Orchards to the Corn Seed Production Areas. When a visitor or researcher selects Plot 17 or Plot 22, the map lights up the zone perimeter and lets them tap individual screenhouses or field utilities."*

---

### Minute 5:00 – 7:00 | Segment 4: 3D Walking Directions, X-Ray Building Transparency & Speed Controls (`UC-03`, `UC-04`, `UC-08`)
- **What to Click:**
  1. Select **`#32 LARES Synthetic Fertilizer Storage / LARES Pesticide Storage`** (or **`#25 Regional Soils Laboratory`**) and click the green **Get Directions** button (`navigateTo()`).
  2. Point out the glowing green shortest path computed across the **$2.68\text{ km}$ road and walkway network** (`roads.json`) and the **Turn-by-Turn Directions** list on the left (`buildSteps()`), which uses real campus buildings as turn landmarks (e.g., *"Turn right at MIS / RAFIS Building"*).
  3. Watch the animated walker begin walking. Point out how 3D buildings that stand between the camera and the walker automatically turn into **frosted glass (X-ray occlusion)** so the walker is never hidden behind a roof.
  4. Click the **SPEED** buttons: switch from **`1x`** to **`4x`** or **`6x`** (`setRouteSpeed()`) so the walker reaches the destination during the demo.
  5. Click the bottom-right **CAMERA** pills (**Side View**, **Top View**, **Unlocked**) to demonstrate camera control.
  6. Let the walker finish to show the top **Arrived** banner and the 10-second auto-return countdown (`startArrivedCountdown()`). Click **Replay Walk** (`replayRoute()`) so the route stays onscreen for the QR handoff.
- **What to Say:**
  > *"When the visitor taps 'Get Directions', the system calculates the shortest walking path from Argosino Hall to the exact entrance door of their destination. Notice two details as our animated walker moves: first, every turn instruction names the actual building at that corner; second, whenever a 3D building blocks our line of sight, it automatically fades into frosted glass so you never lose track of the path. Visitors can preview the walk at 1x, 2x, 4x, or 6x speed, or switch between 3D Side View and 2D Top View."*

---

### Minute 7:00 – 8:45 | Segment 5: QR Code Handoff & Live Smartphone GPS Navigation (`UC-05`, `UC-06`)
- **What to Click:**
  1. In the left directions panel (or building drawer), click **Tap QR to Enlarge** (`openQRZoomModal()`) to bring up the large scannable QR code on the projector screen.
  2. Hold up your smartphone (or invite a colleague in the front row to point their phone camera at the projector screen) and scan the QR code.
  3. Switch the projector to your mobile view (or the narrow phone-mode browser tab `?dest=rnd_building&mode=phone`).
  4. Show the **Draggable Bottom Sheet** (`peek`, `half`, `full`), the **Top Turn-by-Turn Maneuver Banner** (`#phone-top-nav-hud`), and the **Use My Live GPS** prompt (`promptPhoneGPSPermission()`).
  5. Explain how live GPS works outdoors on campus (road-snapping blue dot, compass heading cone, automatic rerouting if the user walks $>28\text{ m}$ off path, and safe fallback to simulated preview when tested $>500\text{ m}$ away from the compound).
- **What to Say:**
  > *"Of course, you can't carry the lobby kiosk with you across a 45-plot research station. By tapping 'Enlarge QR', any visitor can scan the screen with their phone's built-in camera—no app download and no campus Wi-Fi password required. Through an encrypted HTTPS tunnel, the exact route opens on their phone in a one-handed mobile interface. Outdoors on campus, tapping 'Use My Live GPS' tracks their live steps along the walkway, rotates the map with their phone's compass, and automatically recalculates the path if they take a wrong turn."*

---

### Minute 8:45 – 10:00 | Segment 6: Accessibility, Hardware Eco Mode & Admin Pin Management (`UC-09`, `UC-10`, `UC-12`)
- **What to Click:**
  1. Return to the main kiosk tab and exit the route (`Exit Route`).
  2. Click the **3D Orbit** accessibility button in the bottom-right toolbar (`toggleOneFingerOrbitMode()`) and drag with a single mouse button / single finger to show how users who cannot do two-finger gestures can still rotate the 3D map. Click it again to return to normal pan.
  3. Click the **Map Settings (Gear)** icon (`toggleMapSettingsPanel()`):
     - Briefly toggle **Dawn / Day / Dusk / Night** lighting (`setLightingPreset()`).
     - Point out the **Kiosk Performance Profile** (`⚡ Auto`, `🌿 Kiosk Eco`, `💎 High`) and mention that on phones this automatically becomes a **Battery Saver** mode.
  4. Press **`Alt + Shift + A`** (`toggleAdminMode()`) to show how an administrator can unlock and drag the yellow **`📍 You Are Here 🔓 (Drag to move)`** pin if the physical kiosk totem is moved to another building lobby, saving immediately to the local database. Press `Alt + Shift + A` again to lock it.
- **What to Say:**
  > *"Finally, we built this for real-world daily operations. For accessibility, there is a 1-Finger Orbit toggle so anyone can rotate the 3D map with a single finger. Under Settings, the system automatically detects the computer's graphics chip—or a phone's battery—and offers an Eco Mode alongside a 45-second idle reset so the kiosk stays cool running 24/7. And if we ever move the physical kiosk to another lobby for an event, an admin simply unlocks the 'You Are Here' pin and drags it to the new spot—every route on campus recalculates from the new location automatically."*

---

## Backup Plan If the Internet or Cloudflare Tunnel Fails During the Demo

| Failure Scenario | What Still Works Locally | Exact Presenter Recovery Step |
| :--- | :--- | :--- |
| **1. Cloudflare Quick Tunnel Is Slow or Blocked by Venue Firewall** | Everything on the presenter laptop (`http://localhost:8080`) works at $100\%$ speed. Only the phone scanning over cellular data is affected. | **Option A (Same Wi-Fi):** Connect the demo laptop and demo phone to the same mobile hotspot, click the green Tunnel badge in Admin Mode (`Alt+Shift+A` $\rightarrow$ click tunnel badge $\rightarrow$ `promptCustomTunnelUrl()` in `js/qr.js:42`), and enter `http://<laptop-LAN-IP>:8080`. The QR code immediately updates to the local hotspot IP.<br>**Option B (On-Screen Phone Simulation):** Switch to your pre-opened second browser tab running `http://localhost:8080/?dest=rnd_building&mode=phone` in mobile responsive view (`400x820`). It runs $100\%$ locally with zero tunnel needed. |
| **2. Venue Internet Drops Completely Mid-Demo** | If the browser tab is **already open**, the $10.29\text{ GB}$ drone map (`LARES v1.mbtiles`), all 48 3D `.glb` models, all 62 photos, directory search, and A*/Dijkstra routing run **100% from local disk** (`localhost:8080`). | **Do NOT press `F5` / Refresh** if internet is completely down (since Mapbox GL JS loads its initial library from CDN on refresh). Stay in the already-open tab, keep the map in **Aerial Drone View** (which reads tiles locally from `LARES v1.mbtiles`), and run Segments 1–4 and 6 normally. |
| **3. Local MySQL Service Is Stopped on Demo Laptop** | $100\%$ of the application still works. | Do nothing—`server.js` automatically falls back to reading/writing `pin.json`, `colors.json`, and `drone_offset.json` on disk without throwing any user-facing errors. |

---

## Likely Questions from the Audience & Factual Answers

### 1. *"Do visitors need to download an app from the App Store or Google Play, or connect to DA Wi-Fi?"*
- **Answer:** **No to both.** The QR code opens directly in the phone's standard web browser (Safari or Chrome) over the visitor's own mobile data (4G/5G) via our HTTPS tunnel, or over compound Wi-Fi if they prefer.

### 2. *"Does the system track or store visitors' personal phone data or GPS locations?"*
- **Answer:** **No.** Zero personal data is collected. When a visitor turns on Live GPS on their phone, the GPS coordinates (`navigator.geolocation.watchPosition` in `js/gps.js`) stay strictly inside their own phone's browser memory to move the blue dot on their screen—those coordinates are **never sent to our server or saved in the database**.

### 3. *"What happens if I scan the QR code while we are in a conference room off-campus (more than 500 meters away from DA-LARES)?"*
- **Answer:** The system checks how far your phone is from the DA-LARES compound (`distFromCenter > 500` meters in `js/gps.js:272`). If you are off-campus, it politely notifies you that you are outside the compound and automatically runs the **animated route walkthrough** from the kiosk pin instead, so you can still preview the campus and route remotely.

### 4. *"Why did the QR code link stop working when I re-opened a tab I scanned yesterday?"*
- **Answer:** Right now, in our development/pre-domain setup, the server uses a free **Cloudflare Quick Tunnel** (`*.trycloudflare.com`), which generates a brand-new temporary web address every time the server restarts. Once we bind the server to a permanent **Cloudflare Named Tunnel / official DA domain** (Phase 2 of our roadmap), the URL will stay permanent.

### 5. *"What if a division moves to a different building or we add a new facility?"*
- **Answer:** Office movements take less than two minutes—an IT maintainer edits a plain text list in `js/data/offices.js` and refreshes the kiosk. For new buildings or roads, the project includes built-in visual browser editors (`draw.html`, `road_draw.html`, `plot_draw.html`, and `tree_draw.html`) where polygons and entrance nodes can be drawn directly over the drone map.

### 6. *"Will the 3D graphics slow down an older office PC or drain a visitor's phone battery?"*
- **Answer:** Every 3D building model was optimized to stay under **$300\text{ kilobytes}$** ($294\text{ KB}$ max). In addition, `js/performance.js` automatically detects older Intel integrated graphics and mobile processors, disables heavy anti-aliasing, and provides a one-tap **Kiosk Eco / Mobile Battery Saver** mode (`1.0x` resolution) plus a 45-second idle reset and 5-minute thermal pause.

### 7. *"Can this system be used for other DA CALABARZON research stations like QARES in Tiaong?"*
- **Answer:** **Yes—the multi-station architecture is already built in.** Using the station dropdown at the top of the sidebar (`js/data/stations.js`), the system can already switch to **DA-QARES (Tiaong, Quezon)**, which has its own $234\text{ MB}$ offline drone map, 48 building footprints, and 31 road segments loaded. Completing custom 3D building models and office directories for QARES is scheduled in Phase 3 of our roadmap.

---

## Verification — Files Read to Produce This Document

- `docs/00-system-overview.md`, `docs/01-modules.md`, `docs/02-use-cases.md`, `docs/03-limitations-and-roadmap.md`
- `index.html`, `server.js`, `start_kiosk.bat`, `start_admin.bat`
- `js/app.js`, `js/sidebar.js`, `js/building-panel.js`, `js/plot-layers.js`, `js/routing.js`, `js/steps.js`, `js/walker.js`, `js/occlusion.js`, `js/qr.js`, `js/gps.js`, `js/phone-ui.js`, `js/phone-nav.js`, `js/orbit-control.js`, `js/map-settings.js`, `js/performance.js`, `js/idle.js`
- `js/data/buildings.js`, `js/data/offices.js`, `js/data/descriptions.js`, `js/data/plots.js`, `js/data/stations.js`

