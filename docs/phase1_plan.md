# Phase 1: Modularization Plan

## Current State
- `index.html`: 9,288 lines, 458 KB monolith
  - Lines 25–3886: **CSS** (~3,860 lines)
  - Lines 3887–4350: **HTML body** (~464 lines)
  - Lines 4351–9285: **JavaScript** (~4,934 lines in one `<script>` block)
- 65 inline `onclick=` handlers in HTML
- All JS shares a single global scope

## Target Structure
```
map/
├── css/
│   └── main.css                  # All CSS extracted (3,860 lines)
├── js/
│   ├── app.js                    # Entry point — initializes everything
│   ├── data/
│   │   ├── buildings.js          # LARES_DRAWINGS, BUILDING_DIRECTORY, KNOWN_BUILDING_NAMES, etc.
│   │   ├── geo.js                # DA_LARES_OUTER_PERIMETER, LARES_COMPOUND_OUTLINE, LARES_BOUNDARY, LARES_TREES
│   │   └── config.js             # CENTER, VIEWS, SECTION_COLORS, MAPBOX_VIEW_PRESET, etc.
│   ├── map-setup.js              # Map init, setupLayers, setupMapboxStandardLayers, style toggles
│   ├── markers.js                # createMarkers, removeMarkers, section badges, entrance arrow
│   ├── sidebar.js                # buildDirectory, filterDirectory, sidebar toggle, settings chips
│   ├── building-panel.js         # showBuildingPanel, closeBuildingPanel, color picker
│   ├── routing.js                # Road graph, pathfinding, computeRouteFromKiosk, drawRoute, clearRoute
│   ├── walker.js                 # Walker animation, camera modes, speed, arrival countdown
│   ├── steps.js                  # buildSteps, renderStepsList, turn-by-turn
│   ├── phone-ui.js               # Phone bottom sheet, gestures, phone directory, phone building details
│   ├── phone-nav.js              # Phone animated route, phone GPS nav, phone arrival
│   ├── gps.js                    # GPS tracking, user marker, compass, heading, accuracy circle
│   ├── qr.js                     # QR code generation, mobile URL builder
│   └── idle.js                   # Idle timer, orbit animation
├── index.html                    # Shell: <head>, <body> markup, <script type="module" src="js/app.js">
└── ...existing files
```

## Step-by-Step Execution

### Step 1: Extract CSS → `css/main.css`
- Copy lines 26–3885 (contents between `<style>` tags) to `css/main.css`
- Replace `<style>...</style>` with `<link rel="stylesheet" href="css/main.css">`
- **Commit**: "phase1: extract CSS to css/main.css"

### Step 2: Extract data constants → `js/data/`
- `config.js`: CENTER, SECTION_COLORS, SECTION_PASTEL_COLORS, MAPBOX_VIEW_PRESET, DEFAULT_MAP_VIEW, INTRO_*, VIEWS, SAVED_MAIN_KIOSK_COORDS, IDLE_TIMEOUT, BUILDING_PHOTOS
- `buildings.js`: LARES_DRAWINGS, KNOWN_BUILDING_NAMES, CUSTOM_BUILDING_CENTERS, BUILDING_DIRECTORY construction
- `geo.js`: DA_LARES_OUTER_PERIMETER, LARES_COMPOUND_OUTLINE, LARES_TREES, LARES_BOUNDARY
- **Commit**: "phase1: extract data constants to js/data/"

### Step 3: Extract core map setup → `js/map-setup.js`
- Map creation, setupLayers, setupMapboxStandardLayers, ensureTreeIconLoaded, renderTreesLayer
- Style toggle functions: toggleMapboxView, setMapStyleMode, toggleBuildings, toggleTrees, toggleBoundary
- revealMap, intro animation
- **Commit**: "phase1: extract map setup to js/map-setup.js"

### Step 4: Extract markers → `js/markers.js`
- createMarkers, removeMarkers, updateMarkerZoomState
- renderSectionBadges, removeSectionBadges, createEntranceArrowMarker
- **Commit**: "phase1: extract markers to js/markers.js"

### Step 5: Extract sidebar → `js/sidebar.js`
- buildDirectory, filterDirectory
- toggleSidebarMenu, collapseSidebarMenu, openSidebarMenu
- toggleSettingChip, isNavigationActive
- **Commit**: "phase1: extract sidebar to js/sidebar.js"

### Step 6: Extract routing → `js/routing.js`
- buildRoadGraph, findNearestNode, findShortestPath
- computeRouteFromKiosk, drawRoute, clearRoute, smoothRouteCoords
- closeRouteAndReset, exitRouteMode, declutterLabelsForRoute, restoreLabels
- **Commit**: "phase1: extract routing to js/routing.js"

### Step 7: Extract walker + steps → `js/walker.js` + `js/steps.js`
- Walker: animation loop, camera modes, speed control, arrival countdown
- Steps: buildSteps, renderStepsList, focusRouteStep, highlightActiveStep, updateLiveNavigation
- **Commit**: "phase1: extract walker and steps"

### Step 8: Extract building panel → `js/building-panel.js`
- showBuildingPanel, closeBuildingPanel, navigateTo, getDirections, replayRoute
- Color picker: openColorPicker, closeColorPicker, saveColorPicker, syncColorInputs, useEyeDropper
- **Commit**: "phase1: extract building panel"

### Step 9: Extract phone UI → `js/phone-ui.js` + `js/phone-nav.js`
- phone-ui: sheet gestures, snap, directory, building details, gallery, lightbox, welcome modal
- phone-nav: startPhoneAnimatedRoute, replayPhoneRoute, cancelPhoneRoute, phone arrival
- **Commit**: "phase1: extract phone UI modules"

### Step 10: Extract GPS → `js/gps.js`
- GPS tracking, user marker, compass/heading, accuracy circle
- startPhoneLiveGPS, stopPhoneLiveGPS, handleGPSPositionUpdate
- computeAndDrawRouteFromGPS, recalculateRouteFromPoint
- GPS error handling, permission card, tap-to-place
- Auto-recenter, touch tracking
- **Commit**: "phase1: extract GPS module"

### Step 11: Extract QR + idle → `js/qr.js` + `js/idle.js`
- QR: getMobileNavigationUrl, updateBuildingQR
- Idle: resetIdle, startIdleRotation, stopIdleRotation, orbitBuilding, stopOrbit
- Kiosk marker: createKioskMarker
- **Commit**: "phase1: extract QR and idle modules"

### Step 12: Create app.js entry point + wire inline handlers
- app.js imports all modules, calls init sequence
- Replace 65 inline onclick handlers with addEventListener in app.js
- handleUrlParameters moves to app.js
- initPhoneSheetGestures called from app.js
- **Commit**: "phase1: create app.js entry point, remove inline handlers"

### Step 13: Slim down index.html shell
- Remove the `<script>` block entirely  
- Add `<script type="module" src="js/app.js"></script>`
- Final verification — no behavior change
- **Commit**: "phase1: index.html is now a thin shell"

## Key Constraint
> **Zero visual or functional changes.** Every step must produce identical behavior.

## Approach for Shared State
Since many modules share state (e.g., `map`, `selectedBuildingId`, `activeRoute`), I'll use a shared state object:

```js
// js/data/state.js
export const state = {
    map: null,
    selectedBuildingId: null,
    activeRoute: null,
    // ... all mutable state
};
```

All modules import from `state.js` and read/write through it. This replaces the implicit global scope sharing.
