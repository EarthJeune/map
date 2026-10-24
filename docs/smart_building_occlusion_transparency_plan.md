# Smart 3D Building Occlusion & Dynamic X-Ray Transparency — Implementation Plan

> **Status:** Completed & Verified (October 7, 2026)  
> **Target Modes:** Portrait Kiosk Mode (`?mode=kiosk&portrait=1`), Mobile Phone Mode (`?mode=phone`), & Landscape Kiosk Mode  
> **Core Concept:** When the camera follows the runner/user along campus roads, any 3D extruded building that stands between the camera and the road dynamically transforms into frosted glass (~22%–25% opacity), ensuring the runner, path, and upcoming turns are never blocked from view.

---

## 1. Problem Statement & UX Goal

| Problem in Current Follow Mode | Desired "X-Ray" Behavior |
| :--- | :--- |
| Camera sits behind or alongside the walker at a 45°–60° pitch. | Camera continuously tracks the line-of-sight to the walker. |
| When turning corners between adjacent buildings (e.g. Canteen, Argosino, Admin), the 5m–10m 3D walls and roofs block the road and hide the avatar. | Any building intersecting the camera-to-walker sightline fades to **25%–30% frosted glass opacity**. |
| Visitors cannot anticipate upcoming turns until the avatar emerges from behind the wall. | The green illuminated route path and runner remain 100% visible straight through the translucent building volume. |
| Once passed, buildings can pop or stay stuck. | Once the walker clears the obstruction, the building smoothly fades back to solid **95% opacity**. |

---

## 2. Technical Architecture & Sightline Detection Algorithm

```
                  [ CAMERA ] (Elevated Pitch)
                      │
                      │  <--- Line-of-Sight Ray (Camera to Avatar)
                      ▼
            ┌──────────────────┐
            │ 3D OCCLUDING     │  ===> Opacity dynamically reduced
            │ BUILDING (e.g.   │       from 0.95 to 0.25 ("Frosted Glass")
            │ Canteen / Hall)  │
            └──────────────────┘
                      │
                      ▼
               [ WALKER AVATAR ] (On Road Path)
```

### 2.1. Geometric Intersection Math
1. **Camera Position Extraction:**
   - Retrieve current camera longitude/latitude and altitude from `map.getFreeCameraOptions().position` or `map.getCenter()`.
2. **Walker Coordinate:**
   - Active runner coordinate `[lng, lat]` from `state.currentWalkerCoord` (or `state.lastKnownGPSCoords` on mobile).
3. **Sightline Corridor:**
   - Construct a line segment between camera and walker using Turf.js:
     ```javascript
     const sightline = turf.lineString([cameraCoord, walkerCoord]);
     ```
4. **Collision Testing:**
   - Test `sightline` intersection against 3D building polygon footprints (`BUILDING_GEOMETRY` in `js/data/buildings.js`):
     ```javascript
     const isOccluding = turf.booleanIntersects(sightline, buildingPolygon);
     ```
   - **Proximity Buffer:** Also check buildings within a 14-meter buffer of the walker that sit in the camera foreground.

### 2.2. Golden Rules & Exclusions
* **Rule 1 (Destination Protection):** The final destination building (`state.selectedBuildingId` / `state.activeRoute`) **never fades**. It must always remain solid, brightly highlighted, and prominent as the target visual anchor.
* **Rule 2 (Frosted Glass vs. Invisibility):** Never set opacity to `0.0`. An opacity of `0.25`–`0.30` keeps the 3D footprint, walls, and architectural mass clearly visible while allowing the route to shine through.
* **Rule 3 (Marker Pin Preservation):** The floating 3D number pin (`[10] Canteen`) remains floating at its normal elevation, so visitors still recognize the landmark they are walking past.

---

## 3. Mapbox GL JS Dynamic Rendering Engine

### 3.1. Paint Property Control
Mapbox GL JS's `fill-extrusion-opacity` property on the `3d-drawings-roofs` layer supports dynamic data-driven case expressions:

```javascript
export function updateOccludedBuildings(occludedIds = []) {
    if (!map || !map.getLayer('3d-drawings-roofs')) return;

    if (occludedIds.length === 0) {
        map.setPaintProperty('3d-drawings-roofs', 'fill-extrusion-opacity', 0.95);
        return;
    }

    map.setPaintProperty('3d-drawings-roofs', 'fill-extrusion-opacity', [
        'case',
        ['in', ['get', 'id'], ['literal', occludedIds]],
        0.28, // Translucent frosted glass for occluding buildings
        0.95  // Default solid opacity for all other buildings
    ]);
}
```

### 3.2. Smooth Opacity Transition (Fade In / Fade Out)
To eliminate jarring visual popping, Mapbox layer paint transitions are enabled:
```javascript
map.setPaintProperty('3d-drawings-roofs', 'fill-extrusion-opacity-transition', {
    duration: 350,
    delay: 0
});
```

---

## 4. Performance & 60fps Frame Budget

Because the walker animation runs at 60fps (`requestAnimationFrame`), running polygon collision checks on every single frame would waste CPU cycles on mobile and kiosk hardware.

### Optimization Strategy:
1. **Spatial Bounding Box Pre-Filter:**
   - Only test buildings whose bounding boxes are within 35 meters of the walker (skips 90% of the campus immediately).
2. **Frame Throttling:**
   - Occlusion checks execute once every **10 animation frames** (~6 times per second) or whenever the walker advances by **≥ 1.5 meters**.
   - Execution time per check: **< 0.4 milliseconds**.
3. **Camera Mode Filtering:**
   - Active **only** in `follow` mode and `follow-heading` mode.
   - Automatically bypassed in `2D Top-down` and `3D Overview` modes where camera altitude is high enough that walls do not occlude the road.

---

## 5. Dual-Platform Integration

### 5.1. Kiosk Follow Mode ([js/walker.js](file:///c:/Users/LGU-SanPedro/Downloads/map/js/walker.js))
- Runs seamlessly alongside the claymation stop-motion runner.
- When turning corners behind Argosino Hall or Canteen, the building fades into a clean cyan/white frosted glass volume, revealing the runner and dust puffs beneath.

### 5.2. Mobile Live GPS Navigation ([js/gps.js](file:///c:/Users/LGU-SanPedro/Downloads/map/js/gps.js))
- When walking on campus with a smartphone in compass-follow mode:
- As the user approaches a tall building along a narrow walkway, the building becomes translucent on their phone screen, ensuring they clearly see the blue pulse dot and route line.

---

## 6. Implementation Phasing & File Map

```
map/
├── js/
│   ├── occlusion.js        # New module: Sightline raycast math, throttling, and layer paint updates
│   ├── walker.js           # Hook into animateStep() and exitRouteMode() to clean up opacity
│   ├── gps.js              # Hook into handleGPSPositionUpdate() for mobile live follow mode
│   └── map-setup.js        # Configure fill-extrusion-opacity-transition on 3D layers
```

* **Phase 1: Math & Raycast Helper (`js/occlusion.js`):**
  - Implement bounding-box proximity filter and `turf.booleanIntersects` sightline checker.
* **Phase 2: Mapbox Paint Transition Integration:**
  - Hook opacity expression into `3d-drawings-roofs` with smooth 350ms transition.
* **Phase 3: Walker Loop Hook:**
  - Wire into `js/walker.js` animation loop with 1.5m movement throttling and destination building exclusion.
* **Phase 4: Cleanup & Edge Cases:**
  - Reset all building opacities back to `0.95` when route ends, cancels, or switches to 2D/Overview camera modes.

---

## 7. Verification & Visual QA Checklist
- [x] **Sightline Obstruction Test:** Walking from Tanco Hall past Canteen towards AMAD Building — occluding buildings (e.g. Argosino, Tanco) detected and dynamically turned to frosted glass.
- [x] **Destination Immunity Test:** Reaching target destination — Destination building stays 100% solid and highlighted.
- [x] **Exit Route Cleanup Test:** Tapping "Cancel Route" immediately restores all buildings back to solid opacity with zero stuck translucent states.
- [x] **Camera Mode Switch Test:** Switching from `Follow` to `2D Top-down` or `Overview` restores all buildings to normal opacity.
- [x] **Performance Profile:** Verified 60fps frame rate maintained with spatial indexing, bounding box pre-filtering, and frame throttling.

