# DA-LARES Campus 3D Building Modeling & Integration Progress

This document tracks the progressive 3D modeling, texturing, optimization, and Mapbox GL JS integration of all authentic buildings across the DA-LARES Lipa City campus.

---

## 🏗️ 3D Pipeline Standards & Workflow

1. **Modeling Process:**
   - Script-driven in Blender 4.x via headless socket server listening on `127.0.0.1:9876`.
   - Script execution helper: `python run_in_blender.py <build_script.py>`.
   - Architecture modeled strictly from ground-truth photographs in `Building Images/<Building_Name>/`.
   - Realistic weathered materials (sage green metal roofs, cream stucco walls, terracotta/maroon plinth skirting, dark timber/charcoal transom bands, aluminum frames).
2. **GLB Export Constraints:**
   - Format: Single self-contained binary GLB (`export_apply=True`, `export_yup=True`).
   - File size budget: Under $300\text{ KB}$ per building for high-speed mobile and totem kiosk loading.
3. **Web Map Integration Requirements:**
   - In [js/data/buildings.js](js/data/buildings.js):
     - Mark `has_3d_model: true` in `LARES_DRAWINGS`.
     - Register in `CUSTOM_3D_BUILDINGS` with center `coords`, compound grid `rotation`, and `scale: [1.0, 1.0, 1.0]`.
     - Add facility description in `BUILDING_DIRECTORY`.
   - In [js/data/offices.js](js/data/offices.js):
     - Register operational units / sections in `BUILDING_OFFICES`.
   - In `images/<building_id>.jpg`:
     - Provide web-optimized (under $800\text{ KB}$) photo from reference images for the info drawer.
4. **Occlusion Handling:**
   - Handled in [js/occlusion.js](js/occlusion.js) with `BASE_NO_3D_MODEL_FILTER` (`['!=', ['get', 'has_3d_model'], true]`) to prevent old extruded boxes from appearing when clicking or panning.
5. **Ground-Truth Entrance Alignment to `roads.json`:**
   - The front facade and main entrance of each 3D building model MUST face directly toward its plotted entrance waypoint in [roads.json](roads.json) (`features[].properties.type === 'entrance' && features[].properties.buildingId === '<building_id>'`).
6. **Strictly Zero Extraneous Outdoor Props:**
   - Models must strictly contain pure architectural elements: walls, roofs, doors, windows, attached entrance porticos/canopies, exterior steps/ramps, and attached signage/AC units.
   - Do NOT model terrain slabs, grass lawns, road pavement, curbs, outdoor lamp posts, outdoor trees, or vehicles. All ground surface and landscaping are handled by the map base layer.

---

## 📊 Campus Buildings Status Matrix

| Building Name | Feature ID | Ref Photos | 3D GLB Model | Size | Map Coords (`[Lon, Lat]`) | Rotation | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Tanco Hall Building** | `tanco_hall_building` | `Building Images/Tanco Hall Building/` | [models/tanco_hall_building.glb](models/tanco_hall_building.glb) | $208.4\text{ KB}$ | `[121.16658948, 13.95824697]` | $198.9^\circ$ | ✅ Completed & Live |
| **Argosino Hall** | `argosino_hall` | `Building Images/Argosino Hall/` (`IMG_3790`-`3792`) | [models/argosino_hall.glb](models/argosino_hall.glb) | $190.2\text{ KB}$ | `[121.16649613, 13.95809898]` | $199.3^\circ$ | ✅ Completed & Live |
| **D.A. Canteen** | `canteen` | `Building Images/Canteen/` (`IMG_3793`, `IMG_3794`) | [models/canteen.glb](models/canteen.glb) | $101.3\text{ KB}$ | `[121.16633558, 13.95823024]` | $198.5^\circ$ | ✅ Completed & Live |
| **RAED Building** | `raed_building` | `Building Images/RAED Building/` (`IMG_3811`, `IMG_3812`) | [models/raed_building.glb](models/raed_building.glb) | $141.1\text{ KB}$ | `[121.16615706, 13.95836713]` | $195.9^\circ$ | ✅ Completed & Live |
| **MIS-RAFIS Building** | `mis_rafis_building` | `Building Images/MIS-RAFIS Building/` | [models/mis_rafis_building.glb](models/mis_rafis_building.glb) | $51.0\text{ KB}$ | `[121.16662514, 13.95893948]` | $164.24^\circ$ | ✅ Initial GLB Active |
| **Guard House** | `guard_house` | `Building Images/Guard House/` (`IMG_3813`) | [models/guard_house.glb](models/guard_house.glb) | $170.0\text{ KB}$ | `[121.16583835, 13.95829580]` | $180.0^\circ$ | ✅ Completed & Live |
| **AMAD Building** | `amad_building` | `Building Images/AMAD Building/` (`IMG_3814`, `IMG_3815`) | [models/amad_building.glb](models/amad_building.glb) | $205.1\text{ KB}$ | `[121.16595901, 13.95914579]` | $341.0^\circ$ | ✅ Completed & Live |
| **PGRC Building** | `pgrc_building` | `Building Images/PGRC Building/` (`IMG_3795`, `IMG_3796`) | [models/pgrc_building.glb](models/pgrc_building.glb) | $269.4\text{ KB}$ | `[121.16688392, 13.95854364]` | $180.0^\circ$ | ✅ Completed & Live |
| **PDRP Building** | `prdp_building` | `Building Images/PDRP Building/` | Queued | - | `[121.16688756, 13.95941620]` | Compound Grid | ⏳ Next in Queue |
| **LARES Building** | `lares_building` | `Building Images/LARES Building/` | Queued | - | `[121.16628000, 13.95910000]` | Compound Grid | ⏳ Queued |
| **Admin Building** | `admin_building` | `Building Images/Admin Building/` | Queued | - | `[121.16610000, 13.95880000]` | Compound Grid | ⏳ Queued |
| **ORED Building** | `ored_building` | `Building Images/ORED Building/` | Queued | - | `[121.16650000, 13.95930000]` | Compound Grid | ⏳ Queued |
| **Post Harvest Lab** | `laboratory_building` | `Building Images/Post Harvest Laboratory Building/` | Queued | - | `[121.16669000, 13.95933000]` | Compound Grid | ⏳ Queued |

---

## 📍 "You Are Here" Interactive Kiosk Coordinates
- **Physical Kiosk Location:** Modeled inside the Veranda Lounge of Argosino Hall (`IMG_3791`).
- **Database (`/api/pin`) & Config ([js/data/config.js](js/data/config.js)):**
  - Lon: `121.16656995`
  - Lat: `13.95810799`
  - Perfectly aligned with the 3D kiosk terminal model inside Argosino Hall veranda.

---

## 🛠️ Blender Automation Tooling
- **Socket Port:** `127.0.0.1:9876`
- **Runner Script:** [run_in_blender.py](run_in_blender.py)
- **Viewport Render Tool:** [clean_beauty_shot.py](clean_beauty_shot.py), [screenshot_blender.py](screenshot_blender.py)
- **Active Build Scripts:**
  - [build_tanco_hall.py](build_tanco_hall.py)
  - [build_argosino_hall.py](build_argosino_hall.py)
  - [build_canteen.py](build_canteen.py)
  - [build_raed_building.py](build_raed_building.py)
  - [build_guard_house.py](build_guard_house.py)
  - [build_amad_building.py](build_amad_building.py)
