# DA-LARES Portrait Wayfinding Kiosk UI — Improvement Plan

> **Status:** Drafted / Ready for execution  
> **Target Environment:** Portrait Touchscreen Kiosks (43"–55" Totems & Vertical Displays) & Browser Portrait Mode  
> **Primary Goal:** Transform the portrait interface into a high-visibility, ergonomic, intuitive wayfinding station for visitors at DA-LARES.

---

## 1. Executive Summary & Goals

| Core Problem Area | Current Limitation | Planned Solution |
| :--- | :--- | :--- |
| **Spatial Orientation** | Static dark teal "YOU ARE HERE" pin; sharp black cutoff outside satellite bounds | Pulsing radar beacon on start position; smooth atmosphere/fog horizon blending |
| **Touch Interaction** | Tiny `⋮` and `→` menu icons separated across wide blank space | Explicit, thumb-friendly **"🚶 Directions"** action button & whole-card tap affordance |
| **Discovery & Search** | On-screen typing required; only 5 items visible in 50% split | 1-tap **Category Chips** (Offices, Labs, Facilities, Restrooms) & adaptive drawer height |
| **Screen Hygiene** | Developer coordinates badge & duplicate "Mapbox 3D" buttons visible | Clean kiosk view without debugging noise; unified control bar at bottom |
| **Panel Toggle (Portrait)** | Horizontal `<` / `>` toggle doesn't match vertical bottom drawer | Top-center vertical toggle using **Up (`⌃`)** / **Down (`⌄`)** chevrons |
| **Wayfinding Utility** | Route stays on kiosk once visitor walks away | Prominent **"📲 Take Route on Phone"** QR handoff & auto-reset idle loop |
| **Active Directions UI** | Cramped 2.5-item list, repetitive "at Canteen" text, missing QR handoff | Connected journey timeline, natural landmark phrasing, prominent QR card, streamlined playback |

---

## 2. Phase-by-Phase Roadmap

### Phase 1: Spatial Anchoring & Visual Atmosphere
- **1.1. Pulsing Radar Ring on "YOU ARE HERE" Beacon:**
  - Add an animated CSS concentric ripple (`@keyframes radar-pulse`) around the Tanco Hall starting pin.
  - Upgrade beacon styling to high-contrast emerald/cyan with a soft glow so visitors orient themselves within 1 second.
- **1.2. Smooth Map Perimeter & Fog Horizon:**
  - Configure Mapbox atmosphere/fog parameters (`fog: { 'range': [-1, 2], 'color': '#0a0f1c', 'horizon-blend': 0.3 }`) to eliminate the stark pitch-black satellite border in the top-right corner.
  - Add subtle edge vignetting so the satellite image blends seamlessly into the dark background (`#0a0f1c`).
- **1.3. 3D Label Collision & Decluttering:**
  - Adjust label vertical offsets for dense clusters (e.g. #11 Argosino, #12 Tanco, #17 Multi-Purpose, #18 Dormitory) to prevent overlapping pill markers at default portrait zoom.

---

### Phase 2: Touch Ergonomics, Admin Feature Gating & Card Actions
- **2.1. Remove Three-Dot Menu (`⋮`) & Gate Admin Features:**
  - Remove the three-dot menu (`⋮`) from all visitor list items. Visitors should never see or access developer/admin modals (such as roof/marker color pickers).
  - All admin features (Color Picker, Kiosk Pin Calibration) are strictly gated behind Admin Mode (`?admin=1` or `Alt + Shift + A`). When deployed, admin features are hidden and completely disabled for visitors.
  - Cards render cleanly with the building number, name, subtitle, and an intuitive navigation arrow (`→`), with generous touch targets.
- **2.2. Lock Down "YOU ARE HERE" Beacon (Non-Pressable for Visitors):**
  - Remove the click event and lock emoji (`🔒`) from the visitor beacon.
  - For visitors, the beacon is strictly informative and static: `📍 You Are Here` with `pointer-events: none;` and `draggable: false`.
  - Visitors can no longer accidentally or intentionally click or drag the kiosk pin to corrupt the coordinates.
- **2.3. Ergonomic Tap Targets for Public Touchscreens:**
  - Increase minimum touch target height to 56px–60px for all interactive list items.
  - Whole card tap centers the building and initiates route without needing to hunt for tiny icons.
- **2.4. Vertical Bottom Panel Collapse / Expand Toggle (Up `⌃` / Down `⌄`):**
  - In landscape mode, the sidebar collapses horizontally using `<` and `>`.
  - In **portrait kiosk mode**, the sidebar is a bottom panel. The toggle button (`#sidebar-toggle-btn`) must be positioned at the top-center edge of the bottom sheet.
  - The toggle switches from horizontal (`<` / `>`) to vertical **Up (`⌃`)** and **Down (`⌄`)** chevrons:
    - **When expanded (browsing directory):** Shows a **Down chevron (`⌄`)** to collapse the bottom panel down into a minimal peek bar (revealing almost the entire 3D map).
    - **When collapsed (peek bar):** Shows an **Up chevron (`⌃`)** to slide the panel back up for searching and browsing facilities.
  - Accompanied by a tactile drag handle for smooth swipe gestures on physical touchscreens.
- **2.5. Adaptive Bottom Sheet Height:**
  - Adjust default portrait panel split to 55% directory / 45% map so 6–8 buildings are visible simultaneously without excessive scrolling.

---

### Phase 3: Fast Visitor Discovery & Category Filters
- **3.1. 1-Tap Category Filter Pills:**
  - Insert horizontal quick-filter chips beneath the search bar:
    - 🌐 **All**
    - 🏛️ **Offices** (Admin, ORED, MIS/RAFIS, etc.)
    - 🔬 **Laboratories & R&D** (RSL, PGRC, R&D)
    - 🎓 **Halls & Facilities** (Tanco, Argosino, Dormitory)
    - 🚻 **Services / Restrooms**
- **3.2. Popular Quick-Searches:**
  - Display 3–4 instant quick-search tags below the input (e.g., *"MIS/RAFIS"*, *"Admin"*, *"RSL"*, *"ORED"*) so visitors don't have to summon an on-screen keyboard.

---

### Phase 4: UI Cleanup & Redundancy Removal
- **4.1. Remove Developer Coordinates Badge in Kiosk Mode:**
  - Hide `#coords-badge` (`13.9599° N, 121.1693° E | Zoom 17.0`) in kiosk portrait mode, replacing it with a visitor tip:
    > *"💡 Tap any building or search above to find your way"*
- **4.2. Eliminate Duplicate "Mapbox 3D" Controls:**
  - Remove the floating top-right "Mapbox 3D" button from the map header.
  - Consolidate all view/layer controls into the bottom pill toolbar (`Mapbox 3D`, `Buildings`, `Names`, `Boundary`).

---

### Phase 5: Mobile Route Handoff & Kiosk Idle Loop
- **5.1. Prominent "Send to Phone" QR Callout:**
  - When a building or route is selected, show an instant "📲 Scan with your Phone" corner badge or modal that opens the camera-ready QR code.
  - Allows visitors to carry live turn-by-turn guidance in their pocket.
- **5.2. Kiosk Attract & Idle Auto-Reset:**
  - If no touch interaction occurs for 60 seconds after a route has completed, smoothly return the map to the default overview perspective and reset search filters.
  - Displays a subtle *"Touch to explore DA-LARES"* greeting banner during idle state.

---

### Phase 6: Active Directions Panel Improvements (Portrait Mode)
- **6.1. Connected Journey Timeline (Metro-Line Style):**
  - Replace isolated boxed cards with a sleek, continuous vertical transit timeline:
    - 🟢 **Start Node:** `You Are Here (Tanco Hall)`
    - ⚪ **Turn Waypoints:** Animated progress pulse on active step with clear turn icons (`↰ Turn left`, `↱ Turn right`) and distance badges (`In 13 m`, `In 9 m`).
    - 🏁 **Arrival Node:** `[Building Name] Entrance`
  - Active step glows vibrantly in emerald; passed steps softly dim for clear visual progress.
- **6.2. Natural Landmark Phrasing (Fix "at Canteen" Repetition):**
  - Fix landmark repetition in `js/steps.js`: Instead of repeating `"at Canteen"` on every consecutive turn, deduplicate mentions across adjacent vertices.
  - Context-aware phrasing: *"Pass Canteen on your right"*, *"Continue along main walkway"*, *"Turn right toward AMAD Building"*.
- **6.3. Prominent "Take Route on Phone" QR Card During Navigation:**
  - Display a dedicated, camera-ready QR code card right next to the destination header (`AMAD Building · 153m · ~2 min walk`).
  - Gives visitors instant ability to scan and take the route onto their smartphone before walking away from the kiosk.
- **6.4. Header Space Reclamation & Action Button Consolidation:**
  - In active route mode, hide the static `DA-LARES INTERACTIVE WAYFINDING KIOSK` branding text.
  - Replace with a clean top breadcrumb: `← Back to Directory` (reclaiming ~60px of vertical space).
  - Remove duplicate cancel actions (currently both `← Change Destination` at top and `✕ Cancel` at bottom exist).
  - Bottom controls feature a prominent **[ 🔄 Replay Walk ]** button and secondary **[ ✕ Exit Route ]** button.
- **6.5. Compact Playback Speed Controls & Scrollbar Elimination:**
  - Replace the wide 4-button speed bar (`1x`, `2x`, `4x`, `6x`) with a compact 2-speed toggle pill (`2x Normal` / `4x Fast`).
  - Reclaimed vertical space expands the steps list to show 4–5 full steps simultaneously, eliminating the cramped 2.5-item view and nested dark scrollbar.

---

## 3. Implementation File Map

```
map/
├── css/
│   └── main.css            # Radar pulse animation, category chips, kiosk card button styling
├── js/
│   ├── sidebar.js          # Category filtering logic, redesigned building card DOM markup
│   ├── map-setup.js        # Mapbox fog/atmosphere parameters, label collision adjustments
│   ├── routing.js          # Idle timer reset hook & route handoff triggers
│   └── data/
│       └── buildings.js    # Add category tags ('office', 'lab', 'hall', 'service') to metadata
└── index.html              # Clean up coords badge, add category chips container & QR action button
```

---

## 4. Verification & Testing Checklist

- [ ] **Physical Touch Target Test:** Buttons comfortably pressable with index finger or thumb without miss-taps.
- [ ] **Visual Hierarchy Test:** "YOU ARE HERE" pin immediately identifiable within 1 second of looking at screen.
- [ ] **Category Filter Test:** Tapping "Offices" instantly filters the list and highlights only office pins on the map.
- [ ] **Map Atmosphere Test:** Satellite edge blends into dark theme without harsh pitch-black polygon cutoffs.
- [ ] **Idle Reset Test:** Kiosk returns to default view after inactivity period.
