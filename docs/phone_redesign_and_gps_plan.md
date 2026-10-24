# Implementation Plan: Phone (< 600px) Redesign & Live GPS Navigation

## Goal Description
Redesign the phone experience (viewport under 600px) of the DA-LARES wayfinding map into a mobile-native web application with a 3-state bottom sheet, live GPS navigation with road snapping and off-route recalculation, uncluttered 3D camera angles, and high-contrast ergonomics. The desktop and landscape kiosk layouts, routing graph, and turn-by-turn generator remain completely preserved.

---

## User Review Required

> [!IMPORTANT]
> **Preservation of Desktop & Kiosk Modes**: All phone-specific changes will be strictly gated under `@media screen and (max-width: 600px)` and runtime `isPhoneMode()` checks. The desktop, landscape kiosk, and portrait standing kiosk layouts will not be modified or regressed.

> [!NOTE]
> **HTTPS & Sensor Simulation**: Live GPS requires HTTPS (`trycloudflare.com` tunnel or localhost). For browser testing, Chrome/Edge DevTools **Sensors panel** will be used to simulate GPS movement along compound walkways.

---

## Proposed Architecture & Component Design

```
+-------------------------------------------------------------+
|                          FULL-SCREEN MAP                    |
|                                                             |
|   [+ / - / 🧭 Compass] (Top-Right, Unobstructed)            |
|                                                             |
|   3D Campus Buildings (Pitch: ~45°, Widened Field of View)  |
|   Smoothed Road Route (Chevrons + Casing + Destination Pin) |
|   Blue User GPS Dot + Soft Accuracy Circle + Heading Cone   |
|   Dashed Connector to Snapped Road Point                    |
|                                                             |
|                                  [🚶]                       |
|                                  [🧭] Vertical Camera Pill  |
|                                  [🗺️] (Hidden at Full Sheet)|
|   [🎯 Re-center Button]          [🎯]                       |
|                                                             |
|   (Mapbox Attribution & Logo visible at bottom-left)        |
+-------------------------------------------------------------+
| ===================== MOBILE BOTTOM SHEET ================= |
|                 [ ---- Drag Handle ---- ]                   |
|                                                             |
|  STATE A: Directory & Search (Peek: 90px | Half | Full)     |
|  STATE B: Building Details (Image, Type, Route & GPS btns)  |
|  STATE C: Live GPS Route (Step, Remaining m, Repeat/Cancel) |
|  STATE D: Arrived Card (Arrived at [Name], Repeat, Done)    |
+-------------------------------------------------------------+
```

---

## Detailed Implementation Breakdown

### 1. Phone Layout & Bottom Sheet System (< 600px)
- **Map Container**: Full screen (`100vw`, `100dvh`), eliminating the desktop sidebar and backdrop on viewports under 600px.
- **3-Snap Height Bottom Sheet (`#phone-bottom-sheet`)**:
  - **Peek** (`~90px`): Shows drag handle + search bar (or current navigation step during route).
  - **Half** (`50dvh`): Shows building directory, building details, or active route summary.
  - **Full** (`92dvh`): Full scrollable directory, full steps list, or building overview.
- **Touch Gestures**: Smooth touch drag with velocity thresholding and snap physics; tapping the handle cycles between peek and half.
- **Safe-Area Insets**: Full support for `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` so content is never obscured by browser chrome or the iOS home indicator.

### 2. Building Details Sheet
- **Conditional Image**: Check if real building photo exists (`images/{id}.jpg`). If missing or error, hide the photo placeholder entirely to preserve vertical space.
- **Clean Meta Information**:
  - Remove the **Coords** row completely on phone.
  - Replace **Section** with a useful building type or description if one exists; otherwise hide the row.
- **Sticky Action Buttons**: Pinned to the bottom of the sheet with `min-height: 48px` and 44px+ touch targets:
  - Primary button: `[ 🧭 Route on map ]`
  - Secondary button: `[ 📍 Guide me live (GPS) ]` (visible only on touch devices with `navigator.geolocation` in secure context).
- **Badge Contrast**: High-contrast text color logic (`#0f172a` on light/yellow badges like #12 Argosino Hall, `#ffffff` on dark badges).

### 3. Route Mode & Arrival Card on Phone
- **Active Navigation View inside Bottom Sheet**:
  - Primary step in large bold text (`19px`) with remaining meters to turn.
  - Next step preview in smaller muted text (`13px`).
  - Swiping sheet to half/full reveals the complete turn-by-turn steps list.
  - Action buttons: Always-reachable `[ 🔄 Repeat ]` and `[ ✕ Cancel ]` pinned to the bottom.
- **Arrival State**:
  - When within 15m of destination, show a compact **"Arrived at [Building Name]"** card directly inside the bottom sheet.
  - Action buttons: `[ 🔄 Repeat ]` and `[ ✓ Done ]`.
  - Tapping **Done** stops GPS tracking, clears the route, and returns to the search overview.
  - Removes the oversized top-screen banner on phones.

### 4. Live GPS Engine with Road Snapping & Off-Route Handling
- **Location Acquisition**:
  - Request `navigator.geolocation.watchPosition` with `enableHighAccuracy: true`.
  - Ignore fixes with accuracy > 50m. First fix under 30m starts route.
  - Display user as a blue dot (`#2563eb`) with soft accuracy circle (radius = reported accuracy) and a directional heading cone when compass/motion is available.
- **Road Snapping**:
  - Use `turf.nearestPointOnLine` against `ROAD_NETWORK` to snap the user's position to the campus road graph.
  - Draw a short dashed connector line (`#38bdf8`) from raw GPS to the snapped point.
  - Calculate the route from the snapped point to the destination entrance.
- **Live Distance & Step Progression**:
  - No simulated camera-walk animation in GPS mode; the camera follows the real walker.
  - Project position onto route line using `turf.nearestPointOnLine` and read its location to calculate distance walked.
  - Update remaining distance (rounded to nearest 5m) and highlight the current step in real time.
- **Dynamic Camera Follow**:
  - Follows user with pitch set to ~45° and bearing set to compass heading or road segment bearing.
  - If user drags/pans the map manually, pause follow mode and display a floating `[ 🎯 Re-center ]` button.
- **Off-Route Detection**:
  - If user is > 25m from the route line for 3 consecutive GPS fixes, display *"Recalculating..."* and regenerate the route from their new snapped location to the destination.
  - Throttled to maximum once every 10 seconds.
- **Outside Compound Detection**:
  - Use `turf.booleanPointInPolygon` against `LARES_BOUNDARY`.
  - If outside, show: *"You're outside DA-LARES. Head to the Guard House entrance."* Route from Guard House entrance to destination. Automatically switch to live GPS routing once user enters the boundary.
- **Permissions & Fallback**:
  - Educational explanation before browser permission dialog.
  - If denied or times out (15s): offer *"Pick your starting building"* manual picker.

### 5. Map Controls, Attribution & Camera Tuning
- **Mapbox Attribution Protection**:
  - Mapbox logo and copyright notices in bottom-left corner remain unobstructed. Bottom sheet padding and controls offset above the attribution zone.
- **Vertical Camera Toolbar**:
  - Transform bottom camera bar on phone into a vertical floating pill docked to the right edge: `[ 🚶 Follow ]`, `[ 🧭 3D ]`, `[ 🗺️ 2D ]`, `[ 🎯 Free ]`.
  - Automatically hides when the bottom sheet is dragged to full height.
- **Camera Tuning & Label Decluttering**:
  - Default phone pitch set to ~45° with a wider zoom/framing so the top empty void is minimized.
  - Label collision detection: hide lower-priority labels that overlap. During active route, strictly limit visible labels to destination, turn landmarks, and buildings within 40m corridor.

### 6. Route Line Smoothing & Styling
- Apply line smoothing to the road route coordinates (bezier curve smoothing on vertices that do not compromise road network alignment).
- Preserve high-contrast casing (`#020617`), emerald route glow (`#22c55e`), direction chevrons, and animated destination flag marker.

---

## File Changes Overview

| File | Type | Changes |
| :--- | :--- | :--- |
| `index.html` | [MODIFY] | Add 3-snap bottom sheet HTML & CSS (< 600px); add mobile vertical camera stack; implement live GPS tracking, road snapping, and off-route recalculation; update label decluttering and Mapbox attribution clearance. |

---

## Verification Plan

### Automated / Syntax Verification
- Run Node.js syntax validation on all script tags in `index.html`.
- Verify HTTP & HTTPS server responses.

### Manual Verification Matrix
1. **Mobile Viewport 390×844 (iPhone 14) & 375×667 (iPhone SE)**:
   - Verify full-screen map without desktop sidebar.
   - Verify 3-snap bottom sheet (peek: 90px, half: 50%, full: 92%) with smooth drag handle.
   - Verify building details: placeholder image hidden when no photo, Coords row removed, badge contrast fixed.
   - Verify action buttons pinned to bottom of sheet.
2. **GPS Simulation (Chrome DevTools Sensors Panel)**:
   - Simulate GPS location inside DA-LARES near Guard House.
   - Tap "Guide me live (GPS)" to Argosino Hall.
   - Verify dashed connector to road and green route from snapped position.
   - Simulate movement along road: verify route trims behind user, remaining distance updates, and banner updates.
   - Move off-route by > 25m: verify "Recalculating..." triggers within 10s.
   - Simulate arrival (< 15m): verify "Arrived at Argosino Hall" card appears in bottom sheet.
   - Tap "Done": verify route and GPS tracking cleanly stop.
3. **Outside Compound Test**:
   - Set location 2km away from Lipa City: verify outside compound notice and Guard House entrance routing.
4. **Desktop & Kiosk Regression**:
   - Verify standard desktop layout (1440×900) and portrait kiosk layout (1080×1920) remain identical to previous build.
