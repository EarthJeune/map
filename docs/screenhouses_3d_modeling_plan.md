# DA-LARES Plots 17 & 18 Screenhouses 3D Modeling Plan

## 📌 Executive Summary
This document establishes the official engineering and architectural roadmap for modeling, texturing, optimizing, and integrating the agricultural screenhouses and research propagation facilities across **Plot 17** and **Plot 18** at the Department of Agriculture - Southern Tagalog Integrated Agricultural Research Center (DA-LARES).

All 3D models are based directly on:
1. **High-Resolution Drone Orthomosaic Footprints:** Hand-traced curb walls from `draw.html` saved in `buildings.json`.
2. **Ground-Truth Field Photographs:** High-resolution field photography in `Building Images/Screenhouses/` (24 photos).
3. **Numbering & Orientation Diagram:** Photographer vantage point map (`media_1793088104083.jpg`).

---

## 🌾 Master Commodity Zone & Sub-Plot Hierarchy

As established by the strategic facility hierarchy:
- **Plot 17 Master Commodity Zone:** **TC Makapuno & Banana Screenhouse** (`zone_tc_makapuno_screenhouse`)
  - **Sub-Plots:** The individual research screenhouses located within Plot 17:
    - **Screenhouse 1** (`plot17_screenhouse_1`): Tissue-Cultured Makapuno & Banana Hydroponic NFT Propagation Facility.
    - **Screenhouse 2** (`plot17_screenhouse_2`): Makapuno Hardening & Seedling Propagation Screenhouse.
    - **Screenhouse 3** (`plot17_screenhouse_3`): Banana Hardening Screenhouse with Concrete Utility Vestibule.
    - **Screenhouse 4** (`plot17_screenhouse_4`): High-Density Black Shade Net Hardening Nursery.
    - **Screenhouse 5** (`plot17_screenhouse_5`): Large Nursery Post-and-Lintel Shade House.
- **Plot 18 Master Commodity Zone:** **Coffee & Citrus Screenhouse** (`zone_coffee_citrus_screenhouse`)
  - **Sub-Plots:** The individual research facilities located within Plot 18:
    - **Bays 6, 7 & 8** (`plot18_greenhouse_complex`): Contiguous Multi-Bay Clonal Coffee & Citrus Scions Research Complex (Gothic Tunnel & Curved Truss Bays).
    - **Screenhouse 9** (`plot18_screenhouse_9`): Tall Hoop Trellis Screenhouse & Attached Potting Headhouse.

---

## 🧭 Spatial Layout & 4-Sided Orientation Logic

Each structure in the drawing is a 4-sided polygon (rectangle or square) with four distinct sides: **Top (North)**, **Bottom (South)**, **Left (West)**, and **Right (East)**.

The placement of the numbers (1 to 9) on the polygon indicates the **Front Facade / Camera Shooting Position**:

```
                  TOP SIDE (North)
             ┌───[5]───┐    ┌───[6]───┬───[7]───┬───[8]───┐
             │         │    │         │         │         │
             │         │    │         │         │         │
             └─────────┘    │         │         │         │
                            │         │         │         │
 LEFT SIDE                  │         │         │         │
  (West)                    └─────────┴─────────┴─────────┘
┌──────────┐
[1]        │                                ┌──────────┐
├──────────┤                                │          │
[2]        │                                │          │
├──────────┤                                │          │
[3]        │                                └───[9]────┘
├──────────┤                                BOTTOM SIDE
[4]        │                                  (South)
└──────────┘
```

### Side Groups:
- **LEFT SIDE (West) $\rightarrow$ Structures 1, 2, 3, 4:** Front entrances and primary facades face the Western compound road.
- **TOP SIDE (North) $\rightarrow$ Structures 5, 6, 7, 8:** Front entrances and primary facades face North.
- **BOTTOM SIDE (South) $\rightarrow$ Structure 9:** Front hoop trellis entrance faces South, with the attached utility/potting headhouse located immediately to the North.

---

## 📊 Ground-Truth Survey & Dimensions Matrix

| No. | Feature ID | Name | Dimensions | Area | Angle | Center Coordinates | Primary Photo References |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `plot17_screenhouse_1` | Screenhouse 1 (Plot 17) | $6.31\text{ m} \times 18.86\text{ m}$ | $119.0\text{ m}^2$ | $159.5^\circ$ | `[121.16729384, 13.95915233]` | `1 Front View.jpg`, `1 Left Side View.jpg`, `1 Inside View.jpg`, `1 Left 2 Right.jpg` |
| **2** | `plot17_screenhouse_2` | Screenhouse 2 (Plot 17) | $6.22\text{ m} \times 18.78\text{ m}$ | $116.8\text{ m}^2$ | $159.6^\circ$ | `[121.16733397, 13.95909642]` | `2 Front View.jpg`, `2 Inside View.jpg`, `1 Left 2 Right.jpg` |
| **3** | `plot17_screenhouse_3` | Screenhouse 3 (Plot 17) | $6.19\text{ m} \times 18.73\text{ m}$ | $115.9\text{ m}^2$ | $159.6^\circ$ | `[121.16735615, 13.95903957]` | `3 Front View.jpg`, `3 Slightly Side View.jpg`, `3 Left 4 Right.jpg` |
| **4** | `plot17_screenhouse_4` | Screenhouse 4 (Plot 17) | $8.62\text{ m} \times 18.72\text{ m}$ | $161.4\text{ m}^2$ | $159.3^\circ$ | `[121.16738144, 13.95897382]` | `4 Front View.jpg`, `4 Inside View.jpg`, `3 Left 4 Right.jpg` |
| **5** | `plot17_screenhouse_5` | Screenhouse 5 (Plot 17) | $18.00\text{ m} \times 18.06\text{ m}$ | $325.1\text{ m}^2$ | $159.5^\circ$ | `[121.16742406, 13.95884694]` | `5 Front View Cropped.jpg`, `5 Right Side View.jpg`, `5 Inside View.jpg` |
| **6-8**| `plot18_greenhouse_complex` | Plot 18 Research Greenhouse Complex (Bays 6, 7, 8) | $24.87\text{ m} \times 33.03\text{ m}$ | $821.5\text{ m}^2$ | $159.6^\circ$ | `[121.16761281, 13.95902581]` | `6 7 8 Front View.jpg`, `6 7 8 Side View.jpg`, `6 Inside View.jpg`, `7 Inside View.jpg`, `8 Inside View.jpg` |
| **9** | `plot18_screenhouse_9` | Screenhouse 9 & Potting Headhouse | Trellis: $6.26\text{ m} \times 15.14\text{ m}$<br>Shed: $6.31\text{ m} \times 7.45\text{ m}$ | $141.8\text{ m}^2$ | $160.2^\circ$ | Trellis: `[121.16774217, 13.95922324]`<br>Shed: `[121.16771100, 13.95929475]` | `9 Front View.jpg`, drone orthomosaic |

---

## 🛠️ Phased Execution Plan

### Phase 1: Screenhouse 1 (`plot17_screenhouse_1`) — ✅ Complete
- **Status:** Complete & Fully Registered
- **Model File:** [models/plot17_screenhouse_1.glb](file:///c:/Users/LGU-SanPedro/Downloads/map/models/plot17_screenhouse_1.glb) ($262.8\text{ KB}$, strictly under $300\text{ KB}$ budget).
- **Map Alignment:** Coords `[121.16731230, 13.95915280]`, Rotation $69.8^\circ$ (front entrance faces WSW compound road).
- **Entrance & Wayfinding:** `roads.json` entrance node `entrance_35` at `[121.16722, 13.959124]` with dedicated connector walkway `road_walkway_sh1` to `road_21`.
- **Architectural Features Modeled:**
  - Two-tier concrete base: lower dark footing plinth ($Z = 0\text{-}0.25\text{ m}$) with extended entrance step, upper concrete curb wall ($Z = 0.25\text{-}0.65\text{ m}$) with raised door threshold.
  - Continuous perimeter horizontal aluminum eave beam ($Z = 2.10\text{ m}$) and base wiggle-wire trim.
  - Semicircular hoop arch trusses ($Z = 2.10\text{-}3.85\text{ m}$) with bottom tie struts, king struts, and longitudinal purlins.
  - Authentic front entrance gable web with inner concentric arch truss and radial diagonal struts matching `1 Front View.jpg`.
  - Centered commercial sliding screen door with aluminum frame, mid-rail waist bar, latch, and handle.
  - Semi-translucent white insect mesh cladding (`alpha = 0.45`, double-sided) and horizontal black ceiling shade cloth at eave level.
  - Authentic interior: central weed barrier mat walkway, two raised steel propagation tables with 6 white PVC NFT hydroponic channels each, green seedling sprouts, and blue PVC supply risers with manifolds.

### Phase 2: Screenhouse 2 (`plot17_screenhouse_2`) — ✅ Complete
- **Status:** Complete & Fully Registered
- **Model File:** [models/plot17_screenhouse_2.glb](file:///c:/Users/LGU-SanPedro/Downloads/map/models/plot17_screenhouse_2.glb) ($265.4\text{ KB}$, strictly under $300\text{ KB}$ budget).
- **Map Alignment:** Coords `[121.16733397, 13.95909642]`, Rotation $69.8^\circ$ (front entrance faces WSW compound access walkway).
- **Entrance & Wayfinding:** `roads.json` entrance node `entrance_36` at `[121.167258, 13.959074]` with dedicated connector walkway `road_walkway_sh2` to `road_21`.
- **Architectural Features Modeled:**
  - Semicircular barrel hoop arch research facility ($6.22\text{ m} \times 18.78\text{ m}$) paired side-by-side with Screenhouse 1.
  - Two-tier concrete foundation plinth ($Z = 0.25\text{ m}$ lower footing apron + $Z = 0.40\text{ m}$ upper curb wall, total $0.65\text{ m}$) with extended front entrance steps and raised threshold sill.
  - Perimeter horizontal aluminum eave beam ($Z = 2.10\text{ m}$) and base wiggle-wire trim.
  - 11 structural hoop arch trusses ($Z = 2.10\text{-}3.85\text{ m}$) with bottom tie struts, king struts, and longitudinal purlins.
  - Front entrance gable spider-web truss with inner concentric arch and radial diagonal struts matching `2 Front View.jpg`.
  - Commercial sliding screen door with aluminum framing, mid-rail waist bar, latch, and pull handle.
  - Semi-translucent white agricultural insect mesh cladding (`alpha = 0.45`, double-sided) and horizontal black ceiling shade cloth at eave level.
  - Authentic interior: central weed barrier mat walkway, two raised seedling hardening benches with wire mesh tops, rows of black nursery polybag seedling pots, vibrant green Makapuno coconut foliage fronds, blue PVC irrigation headers and risers, and central overhead misting line.
  - Connected with Dynamic Hero Image Swap (Alternative 1) supporting both exterior and nursery interior views.

### Phase 3: Screenhouse 3 (`plot17_screenhouse_3`) — ✅ Complete
- **Status:** Complete & Fully Registered
- **Model File:** [models/plot17_screenhouse_3.glb](file:///c:/Users/LGU-SanPedro/Downloads/map/models/plot17_screenhouse_3.glb) ($247.5\text{ KB}$, strictly under $300\text{ KB}$ budget).
- **Map Alignment:** Coords `[121.16735615, 13.95903957]`, Rotation $69.8^\circ$ (front entrance faces WSW compound walkway).
- **Entrance & Wayfinding:** `roads.json` entrance node `entrance_37` at `[121.167262, 13.959005]` with dedicated connector walkway `road_walkway_sh3` to `road_21`.
- **Architectural Features Modeled:**
  - Semicircular hoop arch research facility ($6.16\text{ m} \times 18.61\text{ m}$) with two-tier concrete foundation plinth ($Z = 0.25\text{ m}$ lower footing apron + $Z = 0.40\text{ m}$ upper curb wall, total $0.65\text{ m}$) and extended front entrance steps.
  - 11 structural semicircular hoop trusses painted oxide red / maroon ($Z = 2.10\text{-}3.85\text{ m}$) with longitudinal ridge and shoulder purlins.
  - Iconic radial sunburst spokes on front entrance gable radiating outward from inner concentric arch ($R = 1.70\text{ m}$) to outer arch rim matching `3 Front View.jpg`.
  - Solid concrete entrance utility vestibule room ($2.45\text{ m} \times 2.50\text{ m}$) on right-front corner with weathered stucco finish, horizontal wooden plank door with metallic latch/doorknob, aluminum screen door leaf swung open, corrugated sheet roof with white monobloc chair resting on top, purple jerrycan on front curb, and side interior access doorway.
  - Black shade cloth netting enclosing right flank and rear gable; lower white insect mesh skirt on left flank.
  - Interior soil floor and rear galvanized staging bench.
  - Connected with Dynamic Hero Image Swap (Alternative 1) supporting both exterior and side view angles.

### Phase 4: Screenhouse 4 (`plot17_screenhouse_4`) — ✅ Complete
- **Status:** Complete & Fully Registered
- **Model File:** [models/plot17_screenhouse_4.glb](file:///c:/Users/LGU-SanPedro/Downloads/map/models/plot17_screenhouse_4.glb) ($229.1\text{ KB}$, strictly under $300\text{ KB}$ budget).
- **Map Alignment:** Coords `[121.16738144, 13.95897382]`, Rotation $69.8^\circ$ (front entrance faces WSW compound walkway).
- **Entrance & Wayfinding:** `roads.json` entrance node `entrance_38` at `[121.167305, 13.958918]` with dedicated connector walkway `road_walkway_sh4` to compound road network.
- **Architectural Features Modeled:**
  - High-density black shade net hardening nursery ($8.62\text{ m} \times 18.72\text{ m}$) with wider architectural footprint.
  - Two-tier concrete foundation plinth ($Z = 0.25\text{ m}$ lower footing apron + $Z = 0.40\text{ m}$ upper curb wall, total $0.65\text{ m}$) with iconic continuous **painted red horizontal stripe** along the lower footing step apron matching `4 Front View.jpg`.
  - 11 structural semicircular hoop trusses painted oxide red / maroon ($Z = 2.10\text{-}4.10\text{ m}$) with longitudinal ridge and shoulder purlins.
  - Front entrance gable web with inner concentric arch ($R = 2.45\text{ m}$) and 8 radial sunburst spoke pipes.
  - Right-side entrance doorway ($X = 2.50\text{ to } 3.80\text{ m}$) with solid jambs, weathered wooden plank door leaf, and corrugated sheet eave canopy hood.
  - Complete heavy-duty black agricultural shade netting enclosure over barrel roof curve, flanks, rear, front gable, and horizontal interior ceiling at eave level.
  - Authentic interior with central weed-barrier walkway mat, dual galvanized steel seedling propagation tables, rows of nursery polybag plantlet containers, tropical foliage sprouts, and iconic **bright blue 55-gallon HDPE water drum** in center aisle.
  - Overhead irrigation misting line with spray nozzles.
  - Connected with Dynamic Hero Image Swap (Alternative 1) supporting both exterior and inside nursery views.

### Phase 5: Screenhouse 5 (`plot17_screenhouse_5`) — ✅ Complete
- **Status:** Complete & Fully Registered
- **Model File:** [models/plot17_screenhouse_5.glb](file:///c:/Users/LGU-SanPedro/Downloads/map/models/plot17_screenhouse_5.glb) ($148.5\text{ KB}$, strictly under $300\text{ KB}$ budget).
- **Map Alignment:** Coords `[121.16741435, 13.95882594]`, Rotation $69.8^\circ$ (NW corner entrance faces North toward the alleyway between Screenhouse 4 and 5).
- **Entrance & Wayfinding:** `roads.json` entrance node `entrance_39` at `[121.167310, 13.958894]` with dedicated connector walkway `road_walkway_sh5` to compound road network.
- **Architectural Features Modeled:**
  - Square post-and-lintel galvanized steel pipe shade nursery facility ($18.00\text{ m} \times 18.06\text{ m}$, area $325.1\text{ m}^2$) conforming accurately to survey polygon #34.
  - Continuous perimeter concrete curb foundation plinth ($Z = 0.40\text{ m}$) with corner footing pads and extended front approach stoop.
  - 5x5 grid (25 posts) of round galvanized steel tubular columns ($Z = 3.20\text{ m}$) with welded perimeter and internal lintel beams and diagonal corner knee braces.
  - Structural high-tensile roof cable tension grid with gentle pitch roof ridge ($Z = 3.65\text{ m}$).
  - Full black agricultural shade netting enclosure over roof deck and all 4 vertical perimeter walls.
  - Northwest corner entrance door ($1.40\text{ m} \times 2.20\text{ m}$) with aluminum screen frame and outward swing leaf matching `5 Front View.jpg`.
  - Authentic interior featuring central cruciform gravel walkways, four quadrant growing zones with rows of black nursery polybags and tropical saplings/fronds, and overhead central irrigation misting pipes with spray nozzles.
  - Connected with Dynamic Hero Image Swap (Alternative 1) supporting both exterior and inside nursery views.

### Phase 6: Plot 18 Research Greenhouse Complex (`plot18_greenhouse_complex`)
- **Structure:** Unified multi-bay contiguous facility containing Bays 6, 7, and 8.
- **Orientation:** Front triple-gable entrance faces North.
- **Key Features:**
  - **Bay 6 (West):** Enclosed black shade cloth gothic tunnel with roof louver/vent box.
  - **Bay 7 (Center):** Open-air curved steel truss arch with louver box and citrus/coffee rootstock polybag nursery.
  - **Bay 8 (East):** Open-air curved steel truss arch propagation beds.
  - Shared internal valley gutters and support columns.
- **Target Size:** $< 220\text{ KB}$.

### Phase 7: Screenhouse 9 & Potting Shed (`plot18_screenhouse_9`)
- **Structure:** Dual connected structure conforming to hand-drawn polygons #36 & #37.
- **Key Features:**
  - **Front (South):** Tall curved steel hoop trellis frame on concrete curb wall.
  - **Rear (North):** Attached solid concrete utility/potting headhouse with corrugated metal gable roof and red-painted gable fascia trim.
- **Target Size:** $< 180\text{ KB}$.

---

## 📐 Modeling & Engineering Standards
1. **Strictly One Building at a Time:** Model, export, verify, and register each building sequentially.
2. **Performance Budget:** Under $300\text{ KB}$ per GLB model, under 10,000 polygons, clean PBR material nodes.
3. **No Extraneous Outdoor Props:** Strictly confined to authentic foundation curb walls, framing, cladding, doors, and interior benches. Zero external trees, turf slabs, or terrain.
4. **Entrance Alignment:** Main entrances must point directly toward their corresponding road access node in `roads.json`.
