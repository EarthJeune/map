# DA-LARES Campus Warehouse Complex — 3D Wayfinding & Modeling Master Plan

> **Strategic Directive:** Complete architectural documentation, ground-truth field analysis, and phased 3D modeling implementation plan for the **7-Warehouse Complex** situated along the northern agricultural operations boundary of the DA-LARES Campus in Lipa City, Batangas.
>
> **Applicable Rules:**
> - **Rule 1 (Strictly One Building at a Time):** Each warehouse is modeled, verified, exported, and registered individually before proceeding to the next.
> - **Rule 2 (Performance Budget):** Every GLB file in `models/warehouse_*.glb` MUST remain strictly under **300 KB**.
> - **Rule 4 (No Extraneous Outdoor Props):** Strictly confine models to structural building architecture (foundations, walls, roofs, eaves, doors, windows, attached canopies, vents, and attached signage). Never model standalone terrain slabs, roads, outdoor lawns, or vehicles.
> - **Rule 6 (Standalone Facilities):** Standalone facility categories; strictly zero fabricated offices in `js/data/offices.js`.

---

## 🏛️ 1. Warehouse Master Directory & Ground-Truth Identity

| Warehouse ID | Map Name | Ground-Truth Verified Name | Official Sign / Source | Facing | Footprint Geometry (from `buildings.json`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `warehouse_1` | **Warehouse 1** | **Abono Storage Facility** | Sign: `"ABONO"` (`1 Front View.jpg`) | **East (Right in aerial, `~68.2°`)** | East-West Gable ($~10.2\text{ m} \times 6.5\text{ m}$) |
| `warehouse_2` | **Warehouse 2** | **Organic Fertilizer & Machinery Shed** | Sign: `"ORGANIC FERTILIZER"` (`2 Right Part Front View.jpg`) | **East (Right in aerial, `~71.0°`)** | North-South Shed ($~28.0\text{ m} \times 8.2\text{ m}$) |
| `warehouse_3` | **Warehouse 3** | **Seed Production & Packing Facility** | Signs: `"SEED PRODUCTION"`, `"PACKING AREA"` (`3 Inside Front View.jpg`) | **South (Bottom in aerial, `~161.0°`)** | East-West Gable & Porch ($~18.5\text{ m} \times 12.0\text{ m}$) |
| `warehouse_4` | **Warehouse 4** | **Tractor & Implement Motorpool Shed** | 6-Bay Machinery Staging Shed (`4 Full VIew.jpg`) | **South (Bottom in aerial, `~161.0°`)** | East-West Open Shed ($~32.0\text{ m} \times 7.2\text{ m}$) |
| `warehouse_5` | **Warehouse 5** | **LARES Central Warehouse** | Billboard: `"REHABILITATION OF LARES WAREHOUSE"` (`5 Front View.jpg`) | **South (Bottom in aerial, `~161.0°`)** | 2-Storey High-Bay ($~25.5\text{ m} \times 18.0\text{ m}$) |
| `warehouse_6` | **Warehouse 6** | **Rice Seed Warehouse & Dryer Shed** | Billboard: `"REHABILITATION / IMPROVEMENT OF RICE SEED WAREHOUSE"` | **South (Bottom in aerial, `~161.0°`)** | Steel Pavilion Shed ($~6.5\text{ m} \times 9.0\text{ m}$) |
| `warehouse_7` | **Warehouse 7** | **Crop & Seed Distribution Center & Annex** | High-Bay with 8 Orange Skylights & attached Lime-Green Annex | **South (Bottom in aerial, `~161.0°`)** | High-Bay & Annex ($~24.5\text{ m} \times 16.5\text{ m} + \text{annex}$) |

---

## 📷 2. Comprehensive Ground-Truth Image Catalog (All 25 Images)

### Warehouse 1: Abono Storage Facility
- **`1 Front View.jpg`**:
  - *Subject:* South facade of Warehouse 1 (standalone southernmost building on west boundary).
  - *Orientation:* Faces **South** toward the southern trial plots access driveway.
  - *Architecture:* Single-story compact storage warehouse, off-white CMU stucco walls with weathered base skirt.
  - *Roof:* Corrugated galvanized iron gable roof with dark brown timber fascia boards.
  - *Doors & Signage:* Centered double swing wooden doors in dark olive/teal paint with official painted board directly above: **`"ABONO"`**.
  - *Operational Context:* Parked heavy tractor disc harrow implements in front.

### Warehouse 2: Organic Fertilizer & Machinery Shed
- **`2 Left Part Front View.jpg`**:
  - *Subject:* Southern open machinery bay of Warehouse 2.
  - *Orientation:* Faces **East** toward the central vehicle turnaround and grain drying pad.
  - *Structure:* Open-sided carport structure with structural round steel pipe posts supporting horizontal timber purlins and rafters.
  - *Roof:* Weathered corrugated iron sheet roof sloping forward.
  - *Machinery Housed:* Shelters high-value DA equipment: **FMWorld Combine Harvester** (red/white/blue track drive), **Ford/New Holland farm tractor** (blue with ROPS canopy), and rotary tilling equipment.
- **`2 Left Side View.jpg`**:
  - *Subject:* South flank perspective looking north through the open machinery bays.
  - *Features:* Details the open timber rafter framing, gravel floor, stored disc plows, and the structural transition into the northern enclosed unit.
- **`2 Right Part Front View.jpg`**:
  - *Subject:* Northern enclosed bay of Warehouse 2.
  - *Orientation:* Faces **East**.
  - *Structure:* Enclosed CMU block room integrated under the main roof; open wire-mesh clerestory frieze between wall top and eaves for airflow.
  - *Signage & Interior:* Official white-on-green signboard above the open door: **`"ORGANIC FERTILIZER"`**. Stacked white polypropylene fertilizer sacks visible inside.

### Warehouse 3: Seed Production & Packing Facility
- **`3 Front Perimeter Fence.jpg`**:
  - *Subject:* Southwest approach, showing chain-link perimeter fence with steel pipe gate, orange grain handcart, rotavator, and adjacent concrete drying pad.
- **`3 Front View Full.jpg`**:
  - *Subject:* Full South facade of Warehouse 3.
  - *Orientation:* Faces **South**.
  - *Architecture:* Dual-zone structure:
    - *West Zone:* Enclosed pale yellow stucco laboratory/processing hall with two large steel casement multi-pane industrial windows protected by security grilles.
    - *East Zone:* Deep staging veranda completely enclosed from waist-height to eaves with fine insect/wire-mesh screening and white Monobloc chairs.
  - *Roof:* East-west corrugated gable roof with dark green fascia trim, red gutter drip edge, and sloping lower eave awning over the veranda.
- **`3 Front View.jpg`**:
  - *Subject:* Closer south perspective showing the raised concrete plinth, screened porch doorway, and parked white utility pickup truck.
- **`3 Inside Front View.jpg`**:
  - *Subject:* Interior corridor of the screened veranda.
  - *Signage:* Two official signs mounted on overhead structural timber beams: **`"SEED PRODUCTION"`** (left) and **`"PACKING AREA"`** (right), with wooden doors to climate-controlled storage rooms.
- **`3 Inside Front Vieww.jpg`**:
  - *Subject:* Main interior processing hall featuring exposed welded steel roof trusses, high wire-mesh partition security cages, palletized white seed bags, and industrial ventilation floor fans.

### Warehouse 3 & 4 Transition
- **`3 Left Part 4 Right Part.jpg`**:
  - *Subject:* Junction where Warehouse 3 terminates on its east wall and Warehouse 4 begins.
  - *Boundary:* Warehouse 3's yellow wall and green roof meet Warehouse 4's open concrete pillar shed; a tall slender papaya tree marks the physical dividing line.
- **`3 Right Side of the building connecting to 4.jpg`**:
  - *Subject:* Close-up seam showing the seamless roof and foundation abutment between Warehouse 3 and Warehouse 4.

### Warehouse 4: Tractor & Farm Implement Motorpool Shed
- **`4 Front View Middle Part.jpg`**:
  - *Subject:* Middle structural bays of Warehouse 4.
  - *Orientation:* Faces **South** toward the concrete apron.
  - *Architecture:* Open-sided high-clearance staging shed with heavy square cream concrete pillars and steel roof trusses.
  - *Contents:* Houses orange Kubota tractors, mechanical threshers, towed grain trailers, disc plows, and rotary tillers.
- **`4 Full VIew.jpg`**:
  - *Subject:* Wide panoramic view of the continuous 6-bay open shed structure spanning east-west with its signature mint-green corrugated roof.
- **`4 Left Part 5 Right Part.jpg`**:
  - *Subject:* Structural connection between Warehouse 4 (left) and Warehouse 5 (right).
  - *Connection:* Warehouse 4's mint-green roof terminates and ties directly into the two-story west exterior concrete wall of Warehouse 5. Warehouse 5's wall shows high industrial exhaust fan hoods and a ground roll-up shutter.

### Warehouse 5: LARES Central Warehouse
- **`5 Front View.jpg`**:
  - *Subject:* Main South entrance and loading portico of Warehouse 5.
  - *Orientation:* Faces **South** toward the primary campus road.
  - *Architecture:* Massive two-story industrial high-bay warehouse in pale butter-yellow stucco.
  - *Entrance:* Heavy cantilevered concrete portico canopy, commercial galvanized roll-up shutter door, pedestrian side door, and upper clerestory louvers.
  - *Official Billboard:* Prominent official DA billboard: **`"DEPARTMENT OF AGRICULTURE - REGIONAL FIELD OFFICE NO. 4A / REHABILITATION OF LARES WAREHOUSE"`**.
- **`5 Front Vieww.jpg`**:
  - *Subject:* Wider south perspective showing the front portico, roadway, and a decommissioned white pickup cab on the eastern apron.
- **`5 Left part of the building View.jpg`**:
  - *Subject:* Western exterior wall adjacent to Warehouse 4.
  - *Features:* Two high-mounted industrial exhaust fan louver hoods, ground roll-up shutter, and exterior staging of a motorized rotary trommel drum separator on a steel chassis.
- **`5 Left part of the building Vieww.jpg`**:
  - *Subject:* Alternate perspective of the western elevation, trommel drum, and structural junction with Warehouse 4.
- **`5 Side View.jpg`**:
  - *Subject:* Southeast perspective showing the forest-green gable roof, dark green fascia trim, clerestory wall vents, and DA project billboard.

### Warehouse 6: Rice Seed Warehouse & Mechanical Dryer Shed
- **`6 Front View.jpg`**:
  - *Subject:* South approach to Warehouse 6.
  - *Orientation:* Faces **South**.
  - *Architecture:* Freestanding open steel-framed pavilion shed on concrete footings with corrugated steel gable roof.
  - *Official Billboard:* **`"DEPARTMENT OF AGRICULTURE - REGIONAL FIELD OFFICE NO. 4A / REHABILITATION / IMPROVEMENT OF RICE SEED WAREHOUSE"`** (Contractor: GLR Construction).
- **`6 Side View.jpg`**:
  - *Subject:* Mechanical rice drying equipment housed under the shed.
  - *Features:* Brick-lined biomass combustion furnace burner with rectangular fuel hopper, large horizontal cylindrical drum, tall vertical stainless steel exhaust chimney penetrating the roof, and flexible ductwork leading to grain drying beds.

### Warehouse 7: Crop & Seed Distribution Center & Western Annex
- **`7 Front View.jpg`**:
  - *Subject:* South truck loading dock of Warehouse 7.
  - *Orientation:* Faces **South**.
  - *Architecture:* Grand modern high-bay industrial warehouse in pale mint-green stucco with dark forest green roof fascia and vertical green downspouts.
  - *Loading Dock:* Heavy cantilevered steel truss loading canopy over an elevated concrete ramp, galvanized commercial roll-up door, lower decorative concrete breeze-block ventilation louvers, and attached lower annex on the left. White Isuzu light truck parked on the ramp.
- **`7 small building in left and Large building in right.jpg`**:
  - *Subject:* Structural junction between the main warehouse (right) and attached lower annex (left).
  - *Features:* Main warehouse west gable wall with two high exhaust fan hoods; attached single-story annex in bright lime-green stucco with black-framed sliding window and green pedestrian door.
- **`7 Small building.jpg`**:
  - *Subject:* Close-up of the western attached annex showing bright lime-green front wall, dark green door, south window, two west-flank sliding windows with bronze frames, and stainless steel roof tank/vent.
- **`7 View from the right.jpg`**:
  - *Subject:* Southeast perspective showing the 4 structural wall bays, cantilevered loading canopy at the second bay, lower concrete breeze-block ventilation bands in the two right bays, and green roof trim.

---

## 🗺️ 3. Campus Spatial Layout & Structural Interconnections

```
===================================================================================================================
                                              DA-LARES NORTH PERIMETER
===================================================================================================================

     +-----------------------+ +-----------------------------------+ +-----------------------+
     |      WAREHOUSE 3      |=|            WAREHOUSE 4            |=|      WAREHOUSE 5      |
     | Seed Production & Pkg | |    Tractor & Implement Motorpool  | |   LARES Central Whse  |
     | (Yellow, Casement Win,| |    (6-Bay Open Concrete Pillars,  | | (2-Storey Butter-Yell,|
     |  Screened Porch)      | |     Continuous Mint-Green Roof)   | |  Cantilever Portico,  |
     +-----------+-----------+ +-----------------------------------+ |  Roll-Up Shutter)     |
                 |                                                   +-----------+-----------+
                 | (rear corridor link)                                          |
     +-----------+-----------+                                                   |
     |      WAREHOUSE 2      |                                                   |
     | Org. Fertilizer & Shed|                                                   |   +-------------+   +-------------------+
     | (Harvester & Tractor  |                                                   |   | WAREHOUSE 6 |   |    WAREHOUSE 7    |
     |  Open Shed + CMU Room)|                                                   |   | Dryer Shed  |   | (8 Skylights,     |
     +-----------+-----------+               CONCRETE STAGING APRON              |   | (Furnace,   |   |  Loading Canopy)  |
                 |                       & AGRICULTURAL GRAIN DRYING COURT       |   |  Chimney)   |   |   +-----------+   |
                 |                                                               |   +-------------+   |   | W. Annex  |   |
     +-----------+-----------+                                                   |                     |   | Lime Green|   |
     |      WAREHOUSE 1      |                                                   |                     |   +-----------+   |
     | Abono Storage Facility|                                                   |                     +---------+---------+
     | (Compact Gable, Olive |                                                   |                               |
     |  Door, Sign "ABONO")  |                                                   |                               |
     +-----------+-----------+                                                   |                               |
                 |                                                               |                               |
                 v                                                               v                               v
           ACCESS DRIVEWAY                                            INTERNAL CAMPUS ROADWAY          EAST PERIMETER ACCESS
```

### Drone Roof Verification (Ground-Truth Aerials)
1. **WH 1:** Standalone east-west gable roof ($10.2\text{ m} \times 6.5\text{ m}$), weathered corrugated metal with painted green bands.
2. **WH 2:** Long north-south rectangular structure ($28.0\text{ m} \times 8.2\text{ m}$). Southern half has weathered grey/white corrugated roof; northern half has reddish-brown rusted corrugated roof.
3. **WH 3:** East-west gable roof ($18.5\text{ m} \times 12.0\text{ m}$) with weathered green/rust corrugated sheets, lower eave awning over south screened porch.
4. **WH 4:** Continuous mint-green painted corrugated roof ($32.0\text{ m} \times 7.2\text{ m}$) spanning 6 bays east-west.
5. **WH 5:** Massive high-bay green gable roof ($25.5\text{ m} \times 18.0\text{ m}$) with prominent projecting south entrance portico.
6. **WH 6:** Small rectangular pavilion roof ($6.5\text{ m} \times 9.0\text{ m}$) with central stainless chimney penetration.
7. **WH 7:** Massive green gable roof ($24.5\text{ m} \times 16.5\text{ m}$) featuring **exactly 8 rectangular orange skylights** (4 on north pitch, 4 on south pitch), a projecting south loading dock canopy, and a lower shed-roof western annex.

---

## 🚀 4. Phased Implementation Roadmap

In strict compliance with **Rule 1 (Strictly One Building at a Time)**, the 7 warehouses will be implemented in sequential phases:

```mermaid
flowchart LR
    P1["Phase 1: WH 1<br>Abono Storage"] --> P2["Phase 2: WH 2<br>Fertilizer & Machinery"]
    P2 --> P3["Phase 3: WH 3<br>Seed Prod & Packing"]
    P3 --> P4["Phase 4: WH 4<br>Implement Motorpool"]
    P4 --> P5["Phase 5: WH 5<br>LARES Central Whse"]
    P5 --> P6["Phase 6: WH 6<br>Rice Seed Dryer"]
    P6 --> P7["Phase 7: WH 7<br>Distribution & Annex"]
```

### **Phase 1: Warehouse 1 (Abono Storage Facility)**
- **Target Model:** `models/warehouse_1.glb` (Budget: $< 150\text{ KB}$)
- **Architectural Specs:**
  - Compact single-story CMU structure ($10.2\text{ m} \times 6.5\text{ m}$, height $4.2\text{ m}$).
  - Off-white textured masonry walls with weathered grey base plinth.
  - Corrugated iron gable roof with dark brown timber fascia rakes.
  - Centered double swing wooden doors in dark olive finish.
  - 3D dimensional facility signboard directly above doors: `"ABONO"`.
  - Concrete threshold stoop aligned with `roads.json` entrance node facing South.
- **Verification Steps:**
  - Export GLB $\le 150\text{ KB}$.
  - Register in `js/data/buildings.js` and set `has_3d_model: true` in `buildings.json`.
  - Verify entrance node in `roads.json` and test waypoint routing in Mapbox view.

### **Phase 2: Warehouse 2 (Organic Fertilizer & Farm Machinery Shed)**
- **Target Model:** `models/warehouse_2.glb` (Budget: $< 220\text{ KB}$)
- **Architectural Specs:**
  - Long north-south rectangular structure ($28.0\text{ m} \times 8.2\text{ m}$, height $4.5\text{ m}$).
  - Southern open machinery shed: round steel pipe columns, timber roof purlins, weathered white/grey corrugated roof.
  - Northern enclosed fertilizer room: concrete block walls, open wire-mesh clerestory frieze, open door, sign `"ORGANIC FERTILIZER"`, stacked white sacks inside.
  - Entrance oriented facing East.

### **Phase 3: Warehouse 3 (Seed Production & Packing Facility)**
- **Target Model:** `models/warehouse_3.glb` (Budget: $< 250\text{ KB}$)
- **Architectural Specs:**
  - Dual-zone building ($18.5\text{ m} \times 12.0\text{ m}$, height $4.8\text{ m}$).
  - West enclosed laboratory: pale yellow walls, dark steel multi-pane casement windows with security grilles.
  - East covered veranda: raised concrete plinth, waist-to-eave fine wire-mesh screen framing, entrance door.
  - Signs: `"SEED PRODUCTION"` and `"PACKING AREA"`.
  - Main entrance oriented facing South.

### **Phase 4: Warehouse 4 (Tractor & Farm Implement Motorpool Shed)**
- **Target Model:** `models/warehouse_4.glb` (Budget: $< 200\text{ KB}$)
- **Architectural Specs:**
  - Long 6-bay open-sided staging shed ($32.0\text{ m} \times 7.2\text{ m}$, height $4.6\text{ m}$).
  - Heavy square concrete pillars in cream stucco, welded steel roof trusses, continuous mint-green corrugated roof.
  - West wall abutting Warehouse 3; East end anchoring into Warehouse 5.
  - Open bays oriented facing South toward the staging apron.

### **Phase 5: Warehouse 5 (LARES Central Warehouse)**
- **Target Model:** `models/warehouse_5.glb` (Budget: $< 280\text{ KB}$)
- **Architectural Specs:**
  - Massive 2-story high-bay structure ($25.5\text{ m} \times 18.0\text{ m}$, height $7.8\text{ m}$).
  - Pale butter-yellow stucco walls with vertical pilasters.
  - Projecting heavy cantilevered concrete entrance portico on South facade.
  - Commercial galvanized roll-up shutter door + pedestrian side door + clerestory louvers.
  - West wall features 2 high industrial exhaust fan hoods and roll-up door.
  - Official project billboard: `"REHABILITATION OF LARES WAREHOUSE"`.

### **Phase 6: Warehouse 6 (Rice Seed Warehouse & Mechanical Dryer Shed)**
- **Target Model:** `models/warehouse_6.glb` (Budget: $< 180\text{ KB}$)
- **Architectural Specs:**
  - Freestanding open steel pavilion shed ($6.5\text{ m} \times 9.0\text{ m}$, height $4.8\text{ m}$).
  - Open structural steel frame, corrugated gable roof with central roof penetration.
  - Mechanical rice dryer unit: brick burner base, rectangular fuel hopper, horizontal cylindrical furnace drum, tall vertical stainless steel exhaust chimney pipe.
  - Official billboard: `"REHABILITATION / IMPROVEMENT OF RICE SEED WAREHOUSE"`.

### **Phase 7: Warehouse 7 (Crop & Seed Distribution Center & Western Annex)**
- **Target Model:** `models/warehouse_7.glb` (Budget: $< 280\text{ KB}$)
- **Architectural Specs:**
  - Grand modern high-bay warehouse ($24.5\text{ m} \times 16.5\text{ m}$, height $7.6\text{ m}$).
  - Pale mint-green stucco walls with 4 structural bays and dark green fascia trim.
  - Gable roof featuring **exactly 8 rectangular orange skylights** (4 north pitch, 4 south pitch).
  - South cantilevered steel truss loading canopy over concrete ramp and roll-up shutter door.
  - Lower decorative concrete breeze-block ventilation louvers.
  - Attached single-story western annex ($8.0\text{ m} \times 5.5\text{ m}$, height $3.6\text{ m}$) in vibrant lime-green stucco, black sliding window, and green door.

