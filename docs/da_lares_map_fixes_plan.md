# Implementation Plan: DA-LARES Map Fixes, Mapbox View Refinement & Camera Logic

This plan addresses four key requirements:
1. **Google Satellite View Fix**: Clean up the dark void mask outside DA-LARES so surrounding satellite imagery no longer bleeds through.
2. **Mapbox View Cleanup**: Completely hide external/basemap buildings and all trees (both 3D native and custom) while keeping roads visible.
3. **QGIS Boundary Distinguisher**: Replace the solid whole-color section ground fills with a distinct, crisp border-like outline tracing the QGIS compound boundary.
4. **Camera Angle Consistency**: Remove forced view resets when switching views so the camera position, pitch, bearing, and zoom remain identical between Google Satellite and Mapbox modes.

---

## User Review Required

> [!IMPORTANT]
> **DA-LARES Border Styling vs Section Ground Fills:**
> Previously, each of the three sections (Section 1, 2, 3) was painted with a solid ground fill (`#22c55e`, `#3b82f6`, `#fbbf24` in Google mode, pastels in Mapbox mode). We will remove these solid fills (setting `fill-opacity` to `0.0`) and instead draw a crisp, multi-tone compound border line (distinct outer casing + vibrant boundary line) along the exact QGIS perimeter of the DA-LARES compound, plus clean interior section division lines.

> [!IMPORTANT]
> **Camera Angle Preservation:**
> When toggling between Google Satellite and Mapbox 3D, the app will no longer forcefully fly to `MAPBOX_VIEW_PRESET`. Whatever angle, pitch, bearing, and zoom you are currently looking at will be seamlessly maintained across both views.

---

## Proposed Changes

### Component 1: Fix Dark Mask Bleed-Through (Google Satellite View)

#### Root Cause Analysis
In `LARES_MASK`, the GeoJSON feature had three separate holes corresponding to Section 1, Section 2, and Section 3. However:
1. **Conflicting Winding Orders**: Hole 1 was wound clockwise (positive area), while Hole 2 and Hole 3 were wound counter-clockwise (negative area). Mapbox's polygon triangulation library (Earcut) treats non-matching winding rings as exterior boundaries or inverts them, resulting in missing or corrupt triangles.
2. **Touching Hole Edges**: Section 1 and Section 2 share a boundary edge; Section 2 and Section 3 share an edge. In computational geometry, holes sharing edges are topologically invalid and create slits.
3. **Coordinate Clamping**: The outer box used `[-180, -90], [180, 90]`. Web Mercator latitude caps at ~85.051129°; latitude ±90° produces `Infinity` in Mercator projection formulas.

#### Solution
Merge the three sections into a single, continuous 21-vertex outer boundary polygon hole wound in uniform clockwise order with valid Web Mercator bounds `[-180, -85.051129]` to `[180, 85.051129]`. This guarantees a 100% solid, glitch-free dark mask that conceals all satellite imagery outside DA-LARES.

#### [MODIFY] [index.html](index.html)
- Update `LARES_MASK` with the unified 21-point compound perimeter.
- Define `LARES_COMPOUND_OUTLINE` GeoJSON for the unified border line.

```diff
-        const LARES_MASK = { "type": "FeatureCollection", "features": [{ "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]], [[121.17223628018202, 13.962432740292197], ...
+        // Unified DA-LARES outer perimeter (21 points, clockwise, single non-self-intersecting ring)
+        const DA_LARES_OUTER_PERIMETER = [
+            [121.166842525948, 13.9573364051248],
+            [121.166707883509, 13.9578186360696],
+            [121.166461009105, 13.9578577275179],
+            [121.166392288608, 13.9580636126542],
+            [121.166092312950, 13.9580302258543],
+            [121.166060788801, 13.9581987146162],
+            [121.165755587077, 13.9581898597885],
+            [121.165758858371, 13.9593963647055],
+            [121.165922492181, 13.9593975992481],
+            [121.166832830366, 13.9596872216149],
+            [121.166721084325, 13.9600224081443],
+            [121.167763155535, 13.9603683427240],
+            [121.167610562783, 13.9608019456220],
+            [121.169996320576, 13.9616301426789],
+            [121.172236280182, 13.9624327402922],
+            [121.172817192248, 13.9609459418294],
+            [121.171500407748, 13.9603168289319],
+            [121.172284643307, 13.9584978533094],
+            [121.171315731289, 13.9582994825750],
+            [121.168753178455, 13.9577200356831],
+            [121.166842525948, 13.9573364051248]
+        ];
+
+        const LARES_MASK = {
+            "type": "FeatureCollection",
+            "features": [{
+                "type": "Feature",
+                "geometry": {
+                    "type": "Polygon",
+                    "coordinates": [
+                        [[-180, -85.051129], [180, -85.051129], [180, 85.051129], [-180, 85.051129], [-180, -85.051129]],
+                        DA_LARES_OUTER_PERIMETER
+                    ]
+                },
+                "properties": {}
+            }]
+        };
```

---

### Component 2: Mapbox View — Hide Other Buildings and Trees, Keep Roads

#### Requirements
- **Other buildings**: Native Mapbox buildings from the basemap outside or around DA-LARES must NOT be shown. Only DA-LARES traced facilities (`3d-drawings` and `3d-drawings-roofs`) are displayed.
- **Trees**: No trees should be shown in Mapbox mode (disable native 3D trees and custom billboard trees).
- **Roads**: Roads must remain visible — both Mapbox basemap roads and custom internal DA-LARES roads from `roads.json`.

#### [MODIFY] [index.html](index.html) (`setupMapboxStandardLayers`)
- Configure standard style basemap to turn off 3D objects, 3D buildings, 3D trees, 3D landmarks, and make 2D basemap buildings transparent:
```javascript
map.setConfigProperty('basemap', 'show3dObjects', false);
map.setConfigProperty('basemap', 'show3dBuildings', false);
map.setConfigProperty('basemap', 'show3dLandmarks', false);
map.setConfigProperty('basemap', 'show3dTrees', false);
map.setConfigProperty('basemap', 'colorBuildings', 'rgba(0,0,0,0)');
map.setConfigProperty('basemap', 'showRoadLabels', true);
```
- Add custom DA-LARES internal roads (`lares-roads-casing` and `lares-roads-fill`) into `setupMapboxStandardLayers()` with slot `'middle'`, so they render crisp on top of the Mapbox standard ground.

---

### Component 3: Distinct QGIS Border Outline (No Whole-Color Fills)

#### Requirements
- Do NOT fill the sections or compound with solid washes of green, blue, or yellow.
- Distinguish the DA-LARES compound using a prominent, stylish border-like outline tracing the QGIS boundary.

#### [MODIFY] [index.html](index.html)
1. In `setupLayers()` and `setupMapboxStandardLayers()`:
   - Set `sec-fill-${fid}` `fill-opacity` to `0.0` (or remove fill rendering so ground imagery/standard map is 100% visible).
2. Add a dedicated compound border layer (`lares-compound-border-casing` and `lares-compound-border-line`):
   - **Outer casing**: width 4px to 6px, dark slate / contrast casing.
   - **Main border line**: width 2.5px to 3.5px, vibrant clean outline (e.g. `#38bdf8` in dark Google mode, `#0284c7` in light Mapbox mode, or section color accents).
3. Section internal dividing lines (`sec-line-${fid}`) styled as clean boundary dividers with width 2px without glow or full fills.

---

### Component 4: Unified Camera Angle Logic When Changing Views

#### Requirements
- Camera angle logic when toggling between Google Satellite and Mapbox view must be the same as Google Maps (seamless).
- Do NOT jerk or fly away to `MAPBOX_VIEW_PRESET`.

#### [MODIFY] [index.html](index.html)
1. Remove `map.flyTo(MAPBOX_VIEW_PRESET)` from `setupMapboxStandardLayers()`.
2. When calling `toggleMapboxView(btn)`, capture current camera parameters (`center`, `zoom`, `pitch`, `bearing`):
```javascript
function toggleMapboxView(btn) {
    const nextMode = (currentMapStyleMode === 'google') ? 'mapbox' : 'google';
    currentMapStyleMode = nextMode;

    const currentCam = {
        center: map.getCenter(),
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing()
    };

    const targetStyle = (nextMode === 'mapbox') 
        ? 'mapbox://styles/mapbox/standard' 
        : 'mapbox://styles/mapbox/satellite-streets-v12';

    map.setStyle(targetStyle);

    map.once('style.load', () => {
        // Guarantee exact camera position is preserved
        map.jumpTo(currentCam);
    });
}
```

---

## Verification Plan

### Automated / Syntax Tests
- Run `node -c server.js` to ensure the server syntax is valid.
- Validate GeoJSON syntax and coordinates using node script.

### Manual Verification
1. Open `http://localhost:8080` in the browser.
2. **Google Satellite View**:
   - Verify that the area outside DA-LARES is 100% solid dark void. No surrounding city imagery, external roads, or bleeding tiles should be visible outside the compound boundary.
   - Verify that the DA-LARES compound has no whole-color fill covering it; instead, only the crisp QGIS border outline marks the compound boundary.
3. **Mapbox View Toggle**:
   - Click "Mapbox 3D".
   - Verify that camera pitch, bearing, zoom, and center DO NOT jump or fly to an arbitrary angle; they remain seamlessly identical to the previous view.
   - Verify that external 3D buildings around the town are GONE.
   - Verify that all trees are GONE.
   - Verify that roads (both Mapbox roads and internal DA-LARES roads) are visible.
   - Verify that DA-LARES custom 3D buildings and numbered labels remain clearly visible.
   - Verify that the DA-LARES compound is distinguished by the QGIS border outline, not a whole-color fill.
4. **Switch Back to Google Sat**:
   - Click "Google Sat".
   - Verify camera orientation stays exact.
   - Dark void mask outside compound remains perfectly clean.
