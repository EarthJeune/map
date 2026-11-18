# DA-LARES Drone Orthophoto Integration Plan

## 1. Overview & Objective
Enhance the **DA-LARES 3D Kiosk Map** by overlaying high-resolution drone orthophoto imagery directly over the Google Satellite basemap. The custom imagery will render seamlessly beneath 3D buildings, road networks, section boundaries, and interactive markers.

---

## 2. Drone Capture Status

| Drone Shot / Section | Status | Notes |
| :--- | :--- | :--- |
| **A1 & A2** | ✅ Captured | High-res drone shots available (overlapping) |
| **B1 & B2** | ✅ Captured | High-res drone shots available (overlapping) |
| **C1** | ⏳ Pending | Postponed due to rain. Map will seamlessly fall back to **Google Satellite** for C1 until captured. |

> [!NOTE]  
> Overlapping coverage between A1, A2, B1, and B2 is expected and beneficial for photogrammetry. Mapbox GL JS handles multi-layer overlays naturally.

---

## 3. Supported File Formats & Workflows

Choose **one** of the following workflows based on how you export the imagery from QGIS / WebODM / Photo Editor:

### Option A: Standard PNG / JPG Images + 4 Corner Coordinates (Quickest)
* **Formats:** `.png` (recommended for transparent cutouts) or `.jpg`.
* **How it works:** Provide the image file along with its 4 corner geographical coordinates:
  - Top-Left `[lng, lat]`
  - Top-Right `[lng, lat]`
  - Bottom-Right `[lng, lat]`
  - Bottom-Left `[lng, lat]`

### Option B: MBTiles (`.mbtiles`) Container File
* **Format:** `.mbtiles` (SQLite tile package created via QGIS / WebODM).
* **Workflows:**
  1. **Mapbox Studio Cloud (Recommended):** Drag & drop `.mbtiles` into Mapbox Studio as a custom Tileset (`mapbox://<user>.<tileset_id>`).
  2. **Local Node Server:** Serve the `.mbtiles` container locally via `server.js`.

### Option C: XYZ Tile Folder (`z/x/y.png` or `.jpg`)
* **Format:** Folder of 256x256 image tiles generated via QGIS (*Render Raster Tiles (XYZ)*).
* **How it works:** Placed in `./tiles/` and served locally without loading huge single files into memory.

---

## 4. Current Code Preparation & Integration Status

All required code architecture has been implemented:

1. **Configuration Preset (`js/data/config.js`)**:
   - `CUSTOM_DRONE_OVERLAY` structure defined with toggle `enabled: true/false`, URL, and coordinates.
2. **Rendering Layer Pipeline (`js/map-setup.js`)**:
   - `drone-orthophoto` source & `drone-orthophoto-layer` added directly above `google-satellite-layer` and below 3D buildings, paths, and labels.
3. **QR Code Handoff & Server Integration**:
   - Cloudflare Tunnel and local LAN IP (`http://172.16.168.203:8080`) verified and operational for mobile phone navigation.

---

## 5. Next Steps when Drone Files Are Ready

1. Drop the exported image file(s) into `images\`.
2. Provide the 4 corner bounding coordinates from QGIS / drone metadata (or tileset ID).
3. Set `CUSTOM_DRONE_OVERLAY.enabled = true` in `js/data/config.js`.
4. Refresh the map (**Ctrl + Shift + R**) to display the high-res drone ground view!
