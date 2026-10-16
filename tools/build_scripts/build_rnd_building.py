"""
build_rnd_building.py — DA-LARES Interactive Campus Map
Bespoke 3D Architectural Builder for the R&D Multipurpose Building (rnd_building).

Authentic architecture built strictly from ground-truth field photographs & aerial drone shot:
  - 6 vertical structural pilasters dividing the front facade into EXACTLY 5 BAYS:
    - Bay 1 (Far Left): Ground floor commercial curtain window behind stainless ADA ramp rail;
      2nd floor 2 tall narrow windows with concrete eyebrow hood and upper cream band.
    - Bay 2 (Mid-Left): Ground floor commercial curtain window behind ADA ramp rail;
      2nd floor 2 tall narrow windows with high wall-mounted window AC unit above right window.
    - Bay 3 (Center - Entrance Tower):
      - Symmetrically centered at X = 0.0m, protruding forward by 0.85m.
      - 100% clad in horizontal stacked stone veneer tile on front and side cheeks with textural relief banding.
      - Ground floor: centered commercial double glass doors with push bars, transom & sidelights,
        cantilevered concrete canopy slab, and concrete entrance landing apron.
      - 2nd floor: prominent 4-pane wide x 3-tier high commercial curtain window with reflective glass and bronze mullions.
      - Elevated stone parapet rising higher than adjacent roofline to match pilaster crowns.
    - Bay 4 (Mid-Right):
      - Ground floor: SOLID green stucco wall with official round DA seal medallion,
        3D dimensional lettering "R&D Multipurpose Building", and 2 side seal medallions.
      - 2nd floor: 1 small ventilation window on left + 1 tall narrow window on right.
    - Bay 5 (Far Right):
      - Ground floor: large commercial curtain window.
      - 2nd floor: 2 tall narrow windows with concrete eyebrow hood.
  - Open rooftop balcony deck:
    - Perimeter parapet wall in cream with crisp white coping caps.
    - 6 pilaster crowns rising 0.50m above roofline with beveled capitals.
    - Horizontal tubular safety handrails installed between pilasters.
    - Rear-middle rectangular stairwell headhouse doorway structure leading onto the balcony.
    - Center skylight hatch and rear-right utility enclosure.
  - Left flank fire escape:
    - 2nd-floor steel exit door, cantilevered steel platform, vertical ladder, and rooftop balcony cage.
    - Carrier split AC units on cantilever brackets.

STRICT CONSTRAINTS:
  - Model file: models/rnd_building.glb (under 300 KB).
  - Open rooftop balcony deck with stairwell doorway headhouse (NOT a hipped roof!).
  - Pure architecture only: zero outside lawn slabs, roads, vehicles, or outdoor trees.
"""

import bpy
import bmesh
import math
import os

TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\rnd_building.glb"

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)

def get_or_create_material(name, base_color, roughness=0.6, metallic=0.0, emission=None, emission_strength=1.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = base_color
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        if emission:
            if 'Emission Color' in bsdf.inputs:
                bsdf.inputs['Emission Color'].default_value = emission
                bsdf.inputs['Emission Strength'].default_value = emission_strength
            elif 'Emission' in bsdf.inputs:
                bsdf.inputs['Emission'].default_value = emission
    return mat

def create_box(name, loc, size, mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, loc, radius, depth, rot=(0, 0, 0), mat=None, parent=None, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_rnd_building():
    clear_scene()

    # Materials carefully calibrated to the vibrant field photos
    # Vibrant tropical apple/mint green stucco
    mat_wall_green = get_or_create_material("RND_WallMintGreen", (0.24, 0.64, 0.42, 1.0), roughness=0.60)
    # Warm buff yellow / cream upper wall band
    mat_wall_cream = get_or_create_material("RND_WallCream", (0.88, 0.80, 0.54, 1.0), roughness=0.65)
    # Slate blue-grey structural columns & mid-floor beam
    mat_beam_blue = get_or_create_material("RND_BeamSlateBlue", (0.40, 0.47, 0.54, 1.0), roughness=0.55)
    # Concrete plinth skirt
    mat_plinth_grey = get_or_create_material("RND_PlinthGrey", (0.62, 0.59, 0.52, 1.0), roughness=0.85)
    
    # Horizontal stacked slate / ledger stone veneer tiles for center tower
    mat_stone_base = get_or_create_material("RND_StoneBase", (0.46, 0.43, 0.40, 1.0), roughness=0.85)
    mat_stone_dark = get_or_create_material("RND_StoneDark", (0.28, 0.26, 0.24, 1.0), roughness=0.88)
    mat_stone_light = get_or_create_material("RND_StoneLight", (0.58, 0.55, 0.50, 1.0), roughness=0.85)
    
    # Rooftop concrete deck & crisp coping caps
    mat_balcony_deck = get_or_create_material("RND_BalconyDeckConcrete", (0.46, 0.45, 0.43, 1.0), roughness=0.85)
    mat_parapet_cap = get_or_create_material("RND_ParapetCap", (0.84, 0.85, 0.86, 1.0), roughness=0.45)

    # Windows & Frames
    mat_bronze = get_or_create_material("RND_BronzeFrame", (0.12, 0.11, 0.10, 1.0), roughness=0.35, metallic=0.7)
    mat_glass_tint = get_or_create_material("RND_GlassTinted", (0.10, 0.22, 0.28, 1.0), roughness=0.08, metallic=0.35)
    mat_glass_back = get_or_create_material("RND_GlassBacking", (0.04, 0.04, 0.05, 1.0), roughness=0.95)

    # Metal & Details
    mat_steel_stair = get_or_create_material("RND_SteelFireEscape", (0.28, 0.26, 0.24, 1.0), roughness=0.5, metallic=0.8)
    mat_railing_silver = get_or_create_material("RND_RailingSilver", (0.82, 0.84, 0.86, 1.0), roughness=0.20, metallic=0.9)
    mat_metal_white = get_or_create_material("RND_MetalWhite", (0.92, 0.92, 0.90, 1.0), roughness=0.40)
    mat_grille_dark = get_or_create_material("RND_GrilleDark", (0.16, 0.16, 0.18, 1.0), roughness=0.60)
    mat_sign_text = get_or_create_material("RND_SignText", (0.10, 0.16, 0.12, 1.0), roughness=0.30)
    mat_seal_green = get_or_create_material("RND_SealGreen", (0.08, 0.42, 0.18, 1.0), roughness=0.40)
    mat_seal_gold = get_or_create_material("RND_SealGold", (0.86, 0.68, 0.16, 1.0), roughness=0.25, metallic=0.8)
    mat_seal_blue = get_or_create_material("RND_SealBlue", (0.12, 0.38, 0.58, 1.0), roughness=0.30)

    # Root object
    root = bpy.data.objects.new("RND_Root", None)
    bpy.context.collection.objects.link(root)

    # -------------------------------------------------------------
    # DIMENSIONS & COORDINATES (from Top View rnd.jpg & buildings.json)
    # Width (Front/Rear): 21.20m (X from -10.60m to +10.60m)
    # Depth (Sides): 13.50m (Y from -6.75m to +6.75m)
    # -------------------------------------------------------------
    W = 21.20
    D = 13.50
    X_MIN = -W / 2.0  # -10.60
    X_MAX = +W / 2.0  # +10.60
    Y_FRONT = -D / 2.0 # -6.75 (facing entrance walkway / road)
    Y_REAR = +D / 2.0  # +6.75

    Z_GROUND = 0.00
    Z_PLINTH = 0.40
    Z_FLOOR2 = 3.50
    Z_HOOD = 6.10
    Z_DECK = 6.80
    Z_PARAPET = 7.85
    Z_COLUMN_CAP = 8.35

    # -------------------------------------------------------------
    # 1. CORE BUILDING MASS & PLINTH
    # -------------------------------------------------------------
    # Foundation Plinth (Concrete skirt from 0 to 0.40m)
    create_box(
        "RND_Plinth_Base",
        loc=(0.0, 0.0, Z_PLINTH / 2.0),
        size=(W + 0.16, D + 0.16, Z_PLINTH),
        mat=mat_plinth_grey,
        parent=root
    )

    # Ground Floor Walls (Mint green stucco Z = 0.40 to 3.50m)
    create_box(
        "RND_GroundFloor_Body",
        loc=(0.0, 0.0, (Z_PLINTH + Z_FLOOR2) / 2.0),
        size=(W, D, Z_FLOOR2 - Z_PLINTH),
        mat=mat_wall_green,
        parent=root
    )

    # Horizontal Floor Divider Beam (Slate blue-grey band Z = 3.35 to 3.60m)
    create_box(
        "RND_MidFloor_Beam",
        loc=(0.0, 0.0, 3.475),
        size=(W + 0.12, D + 0.12, 0.25),
        mat=mat_beam_blue,
        parent=root
    )

    # 2nd Floor Walls Lower Portion (Mint green stucco Z = 3.50 to 6.10m)
    create_box(
        "RND_Floor2_Green",
        loc=(0.0, 0.0, (Z_FLOOR2 + Z_HOOD) / 2.0),
        size=(W, D, Z_HOOD - Z_FLOOR2),
        mat=mat_wall_green,
        parent=root
    )

    # Continuous Horizontal Eyebrow Hood / Sunshade along facade (Z = 6.05 to 6.15m)
    create_box(
        "RND_Eyebrow_Front_Left",
        loc=((-10.025 - 2.625) / 2.0, Y_FRONT - 0.25, 6.10),
        size=(7.40, 0.50, 0.10),
        mat=mat_parapet_cap,
        parent=root
    )
    create_box(
        "RND_Eyebrow_Front_Right",
        loc=((2.625 + 10.025) / 2.0, Y_FRONT - 0.25, 6.10),
        size=(7.40, 0.50, 0.10),
        mat=mat_parapet_cap,
        parent=root
    )

    # 2nd Floor Upper Portion & Parapet Base (Warm buff yellow/cream band Z = 6.10 to 6.80m)
    create_box(
        "RND_Floor2_Cream",
        loc=(0.0, 0.0, (Z_HOOD + Z_DECK) / 2.0),
        size=(W, D, Z_DECK - Z_HOOD),
        mat=mat_wall_cream,
        parent=root
    )

    # Rooftop Balcony Slab (Weathered concrete deck resting solidly on top from Z = 6.80m to 6.85m)
    # Physical separation guarantees 0% coplanar Z-fighting with the yellow wall mass below!
    create_box(
        "RND_Rooftop_Balcony_Floor",
        loc=(0.0, 0.0, Z_DECK + 0.025),
        size=(W - 0.20, D - 0.20, 0.05),
        mat=mat_balcony_deck,
        parent=root
    )

    # -------------------------------------------------------------
    # 2. STRUCTURAL PILASTERS / COLUMNS: EXACTLY 5 BAYS (6 PILASTERS)
    # Calibrated to photos:
    #   Pilaster 0: -10.30m (Left corner)
    #   Pilaster 1:  -6.40m (Between Bay 1 and Bay 2)
    #   Pilaster 2:  -2.35m (Left flank of Center Tower Bay 3)
    #   Pilaster 3:  +2.35m (Right flank of Center Tower Bay 3)
    #   Pilaster 4:  +6.40m (Between Bay 4 and Bay 5)
    #   Pilaster 5: +10.30m (Right corner)
    # -------------------------------------------------------------
    col_w = 0.55
    col_d = 0.35
    col_h = Z_COLUMN_CAP - Z_GROUND

    x_cols = [-10.30, -6.40, -2.35, +2.35, +6.40, +10.30]

    # Front columns (Y = -6.75m, projecting forward)
    for idx, cx in enumerate(x_cols):
        create_box(
            f"RND_Col_Front_{idx}",
            loc=(cx, Y_FRONT - col_d / 2.0, col_h / 2.0),
            size=(col_w, col_d, col_h),
            mat=mat_beam_blue,
            parent=root
        )
        # Beveled capital projecting above parapet
        create_box(
            f"RND_ColCap_Front_{idx}",
            loc=(cx, Y_FRONT - col_d / 2.0, Z_COLUMN_CAP + 0.08),
            size=(col_w + 0.10, col_d + 0.10, 0.16),
            mat=mat_parapet_cap,
            parent=root
        )

    # Rear columns (Y = +6.75m, projecting backward)
    for idx, cx in enumerate(x_cols):
        create_box(
            f"RND_Col_Rear_{idx}",
            loc=(cx, Y_REAR + col_d / 2.0, col_h / 2.0),
            size=(col_w, col_d, col_h),
            mat=mat_beam_blue,
            parent=root
        )
        create_box(
            f"RND_ColCap_Rear_{idx}",
            loc=(cx, Y_REAR + col_d / 2.0, Z_COLUMN_CAP + 0.08),
            size=(col_w + 0.10, col_d + 0.10, 0.16),
            mat=mat_parapet_cap,
            parent=root
        )

    # Side intermediate columns (Y = 0.0m)
    # Left side (X = -10.60m)
    create_box("RND_Col_Left_Mid", (X_MIN - col_d / 2.0, 0.0, col_h / 2.0), (col_d, col_w, col_h), mat_beam_blue, root)
    create_box("RND_ColCap_Left_Mid", (X_MIN - col_d / 2.0, 0.0, Z_COLUMN_CAP + 0.08), (col_d + 0.10, col_w + 0.10, 0.16), mat_parapet_cap, root)
    # Right side (X = +10.60m)
    create_box("RND_Col_Right_Mid", (X_MAX + col_d / 2.0, 0.0, col_h / 2.0), (col_d, col_w, col_h), mat_beam_blue, root)
    create_box("RND_ColCap_Right_Mid", (X_MAX + col_d / 2.0, 0.0, Z_COLUMN_CAP + 0.08), (col_d + 0.10, col_w + 0.10, 0.16), mat_parapet_cap, root)

    # -------------------------------------------------------------
    # 3. ROOFTOP OPEN BALCONY PARAPET & SAFETY RAILING
    # Perimeter parapet wall (Z = 6.80 to 7.85m) in warm buff cream
    # Horizontal steel safety railing installed between pilasters (Z = 7.85 to 8.25m)
    # -------------------------------------------------------------
    parapet_h = Z_PARAPET - Z_DECK
    parapet_thick = 0.22

    # Front parapet walls (left and right of center tower)
    create_box("RND_Parapet_Front_L", ((-10.30 - 2.35) / 2.0, Y_FRONT + parapet_thick / 2.0, Z_DECK + parapet_h / 2.0), (7.95, parapet_thick, parapet_h), mat_wall_cream, root)
    create_box("RND_Parapet_Front_R", ((2.35 + 10.30) / 2.0, Y_FRONT + parapet_thick / 2.0, Z_DECK + parapet_h / 2.0), (7.95, parapet_thick, parapet_h), mat_wall_cream, root)

    # Rear parapet wall
    create_box("RND_Parapet_Rear", (0.0, Y_REAR - parapet_thick / 2.0, Z_DECK + parapet_h / 2.0), (W, parapet_thick, parapet_h), mat_wall_cream, root)
    # Left parapet wall
    create_box("RND_Parapet_Left", (X_MIN + parapet_thick / 2.0, 0.0, Z_DECK + parapet_h / 2.0), (parapet_thick, D, parapet_h), mat_wall_cream, root)
    # Right parapet wall
    create_box("RND_Parapet_Right", (X_MAX - parapet_thick / 2.0, 0.0, Z_DECK + parapet_h / 2.0), (parapet_thick, D, parapet_h), mat_wall_cream, root)

    # Coping caps along parapet top
    create_box("RND_Coping_Front_L", ((-10.30 - 2.35) / 2.0, Y_FRONT, Z_PARAPET + 0.02), (8.05, parapet_thick + 0.08, 0.05), mat_parapet_cap, root)
    create_box("RND_Coping_Front_R", ((2.35 + 10.30) / 2.0, Y_FRONT, Z_PARAPET + 0.02), (8.05, parapet_thick + 0.08, 0.05), mat_parapet_cap, root)
    create_box("RND_Coping_Rear", (0.0, Y_REAR, Z_PARAPET + 0.02), (W + 0.08, parapet_thick + 0.08, 0.05), mat_parapet_cap, root)
    create_box("RND_Coping_Left", (X_MIN, 0.0, Z_PARAPET + 0.02), (parapet_thick + 0.08, D + 0.08, 0.05), mat_parapet_cap, root)
    create_box("RND_Coping_Right", (X_MAX, 0.0, Z_PARAPET + 0.02), (parapet_thick + 0.08, D + 0.08, 0.05), mat_parapet_cap, root)

    # Horizontal safety pipe handrails on top of parapet between all pilasters
    for idx in range(5):
        if idx == 2:
            continue # Center tower has its own elevated stone parapet
        x1 = x_cols[idx] + col_w / 2.0
        x2 = x_cols[idx + 1] - col_w / 2.0
        cx = (x1 + x2) / 2.0
        rw = x2 - x1
        create_box(f"RND_Rail_Front_{idx}_Top", (cx, Y_FRONT, Z_PARAPET + 0.22), (rw, 0.04, 0.04), mat_railing_silver, root)
        create_box(f"RND_Rail_Front_{idx}_Mid", (cx, Y_FRONT, Z_PARAPET + 0.11), (rw, 0.03, 0.03), mat_railing_silver, root)

    # Rear double pipe rails across all 5 bays
    for idx in range(5):
        x1 = x_cols[idx] + col_w / 2.0
        x2 = x_cols[idx + 1] - col_w / 2.0
        cx = (x1 + x2) / 2.0
        rw = x2 - x1
        create_box(f"RND_Rail_Rear_{idx}_Top", (cx, Y_REAR, Z_PARAPET + 0.22), (rw, 0.04, 0.04), mat_railing_silver, root)
        create_box(f"RND_Rail_Rear_{idx}_Mid", (cx, Y_REAR, Z_PARAPET + 0.11), (rw, 0.03, 0.03), mat_railing_silver, root)

    # -------------------------------------------------------------
    # 4. ROOFTOP STAIRWELL HEADHOUSE / DOORWAY STRUCTURE (Drone Top View)
    # Rear-middle rectangular headhouse: Centered in Section 3, Y in [+2.00m, +6.75m]
    # Height Z = 6.80m to 9.35m
    # -------------------------------------------------------------
    head_w = 4.20
    head_d = 4.75
    head_cx = 0.05
    head_cy = Y_REAR - head_d / 2.0
    head_z_top = 9.35
    head_h = head_z_top - Z_DECK

    create_box(
        "RND_StairHead_Body",
        loc=(head_cx, head_cy, Z_DECK + head_h / 2.0),
        size=(head_w, head_d, head_h),
        mat=mat_wall_cream,
        parent=root
    )
    create_box(
        "RND_StairHead_Roof",
        loc=(head_cx, head_cy, head_z_top + 0.08),
        size=(head_w + 0.30, head_d + 0.30, 0.16),
        mat=mat_balcony_deck,
        parent=root
    )

    # Doorway through the balcony (facing South onto the open rooftop deck)
    door_wall_y = head_cy - head_d / 2.0
    create_box("RND_StairDoor_Back", (head_cx, door_wall_y + 0.02, Z_DECK + 1.10), (1.10, 0.02, 2.20), mat_glass_back, root)
    # 4 perimeter frame borders
    create_box("RND_StairDoor_FrT", (head_cx, door_wall_y - 0.02, Z_DECK + 2.15), (1.10, 0.05, 0.08), mat_bronze, root)
    create_box("RND_StairDoor_FrB", (head_cx, door_wall_y - 0.02, Z_DECK + 0.04), (1.10, 0.05, 0.08), mat_bronze, root)
    create_box("RND_StairDoor_FrL", (head_cx - 0.52, door_wall_y - 0.02, Z_DECK + 1.10), (0.08, 0.05, 2.15), mat_bronze, root)
    create_box("RND_StairDoor_FrR", (head_cx + 0.52, door_wall_y - 0.02, Z_DECK + 1.10), (0.08, 0.05, 2.15), mat_bronze, root)
    create_box("RND_StairDoor_Panel", (head_cx, door_wall_y - 0.03, Z_DECK + 1.10), (0.95, 0.02, 2.05), mat_metal_white, root)
    create_box("RND_StairDoor_Handle", (head_cx + 0.35, door_wall_y - 0.05, Z_DECK + 1.05), (0.03, 0.05, 0.20), mat_railing_silver, root)
    create_box("RND_StairDoor_Hood", (head_cx, door_wall_y - 0.20, Z_DECK + 2.25), (1.30, 0.40, 0.08), mat_parapet_cap, root)

    # Center Skylight / Hatch on rooftop deck
    create_box("RND_Roof_Center_Hatch", (0.05, 0.0, Z_DECK + 0.15), (1.20, 1.20, 0.30), mat_grille_dark, root)

    # Rear-Right Rooftop Concrete Enclosure / Tank Base
    create_box("RND_Roof_Tank_Base", (+8.80, +5.20, Z_DECK + 0.75), (2.40, 2.20, 1.50), mat_parapet_cap, root)

    # AC Condenser Units sitting inside front parapet on deck
    create_box("RND_Roof_AC_1", (-1.20, Y_FRONT + 0.55, Z_DECK + 0.40), (0.85, 0.45, 0.65), mat_metal_white, root)
    create_box("RND_Roof_AC_2", (+1.80, Y_FRONT + 0.55, Z_DECK + 0.40), (0.85, 0.45, 0.65), mat_metal_white, root)

    # -------------------------------------------------------------
    # 5. BAY 3: THE CENTER ENTRANCE TOWER (X = -2.075m to +2.075m, W = 4.15m)
    # Authentic architecture matching new close-up & wide field photos:
    #   - 100% clad in horizontal stacked stone veneer tile on all 3 visible faces.
    #   - Multi-tonal horizontal stone tile courses creating rich realistic ledger texture!
    #   - Protrudes forward by 0.85m to Y = -7.60m.
    #   - Ground floor: Centered double commercial aluminum glass entrance doors,
    #     concrete landing apron, and cantilevered concrete canopy slab.
    #   - 2nd floor: Prominent 4-pane wide x 3-tier high bronze curtain window.
    #   - Elevated stone parapet rising to Z = 8.55m with white coping cap.
    # -------------------------------------------------------------
    tower_w = 4.15
    tower_cx = 0.00
    tower_d = 0.85
    tower_y_front = Y_FRONT - tower_d # -7.60m
    tower_z_top = 8.55 # Matches pilaster height!

    # Tower main mass (stacked stone base)
    create_box(
        "RND_Tower_Body_Stone",
        loc=(tower_cx, (Y_FRONT + tower_y_front) / 2.0, (Z_PLINTH + tower_z_top) / 2.0),
        size=(tower_w, tower_d, tower_z_top - Z_PLINTH),
        mat=mat_stone_base,
        parent=root
    )

    # Textural horizontal ledger stone relief courses (interspersed multi-tonal strips)
    stone_strip_heights = [1.20, 2.40, 3.80, 7.20, 7.80]
    for s_idx, sz in enumerate(stone_strip_heights):
        s_mat = mat_stone_dark if s_idx % 2 == 0 else mat_stone_light
        create_box(
            f"RND_StoneStrip_F_{s_idx}",
            loc=(tower_cx, tower_y_front - 0.015, sz),
            size=(tower_w + 0.02, 0.03, 0.16),
            mat=s_mat,
            parent=root
        )
        create_box(
            f"RND_StoneStrip_L_{s_idx}",
            loc=(tower_cx - tower_w / 2.0 - 0.015, (Y_FRONT + tower_y_front) / 2.0, sz),
            size=(0.03, tower_d + 0.02, 0.16),
            mat=s_mat,
            parent=root
        )
        create_box(
            f"RND_StoneStrip_R_{s_idx}",
            loc=(tower_cx + tower_w / 2.0 + 0.015, (Y_FRONT + tower_y_front) / 2.0, sz),
            size=(0.03, tower_d + 0.02, 0.16),
            mat=s_mat,
            parent=root
        )

    # Tower elevated parapet coping cap
    create_box(
        "RND_Tower_Coping",
        loc=(tower_cx, (Y_FRONT + tower_y_front) / 2.0, tower_z_top + 0.05),
        size=(tower_w + 0.16, tower_d + 0.16, 0.10),
        mat=mat_parapet_cap,
        parent=root
    )

    # Ground floor concrete entrance landing apron (flush with ground)
    create_box(
        "RND_Tower_Landing",
        loc=(tower_cx, tower_y_front - 0.60, 0.08),
        size=(tower_w + 0.40, 1.20, 0.16),
        mat=mat_plinth_grey,
        parent=root
    )

    # Double Commercial Entrance Doors centered on tower front
    door_w = 2.20
    door_h = 2.45
    door_z = Z_PLINTH + door_h / 2.0 # 0.40 + 1.225 = 1.625m
    create_box("RND_Tower_Door_Back", (tower_cx, tower_y_front + 0.02, door_z), (door_w, 0.02, door_h), mat_glass_back, root)
    create_box("RND_Tower_Door_GlassL", (tower_cx - 0.52, tower_y_front - 0.02, door_z - 0.15), (0.95, 0.02, 2.00), mat_glass_tint, root)
    create_box("RND_Tower_Door_GlassR", (tower_cx + 0.52, tower_y_front - 0.02, door_z - 0.15), (0.95, 0.02, 2.00), mat_glass_tint, root)
    create_box("RND_Tower_Door_TransomGlass", (tower_cx, tower_y_front - 0.02, door_z + 1.05), (2.05, 0.02, 0.35), mat_glass_tint, root)
    
    # Entrance door bronze perimeter borders and center divider
    create_box("RND_Tower_Door_FrT", (tower_cx, tower_y_front - 0.03, door_z + door_h / 2.0), (door_w + 0.08, 0.06, 0.08), mat_bronze, root)
    create_box("RND_Tower_Door_FrB", (tower_cx, tower_y_front - 0.03, door_z - door_h / 2.0 + 0.04), (door_w + 0.08, 0.06, 0.08), mat_bronze, root)
    create_box("RND_Tower_Door_FrL", (tower_cx - door_w / 2.0 - 0.02, tower_y_front - 0.03, door_z), (0.08, 0.06, door_h), mat_bronze, root)
    create_box("RND_Tower_Door_FrR", (tower_cx + door_w / 2.0 + 0.02, tower_y_front - 0.03, door_z), (0.08, 0.06, door_h), mat_bronze, root)
    create_box("RND_Tower_Door_FrMidV", (tower_cx, tower_y_front - 0.03, door_z - 0.15), (0.06, 0.06, 2.00), mat_bronze, root)
    create_box("RND_Tower_Door_FrTransomH", (tower_cx, tower_y_front - 0.03, door_z + 0.85), (door_w, 0.06, 0.06), mat_bronze, root)
    
    # Stainless vertical push bars
    create_box("RND_Tower_Door_HandleL", (tower_cx - 0.08, tower_y_front - 0.06, 1.45), (0.03, 0.04, 0.60), mat_railing_silver, root)
    create_box("RND_Tower_Door_HandleR", (tower_cx + 0.08, tower_y_front - 0.06, 1.45), (0.03, 0.04, 0.60), mat_railing_silver, root)

    # Cantilevered Entrance Canopy Slab over double doors (Z = 3.20m to 3.40m)
    canopy_w = 3.50
    canopy_d = 0.95
    canopy_z = 3.30
    create_box(
        "RND_Tower_Canopy",
        loc=(tower_cx, tower_y_front - canopy_d / 2.0, canopy_z),
        size=(canopy_w, canopy_d, 0.20),
        mat=mat_parapet_cap,
        parent=root
    )

    # 2nd Floor Large Commercial Curtain Window (4 Panes Wide x 3 Tiers High)
    win3_w = 3.30
    win3_h = 2.40
    win3_z = 5.65 # from Z = 4.45m to 6.85m
    create_box("RND_Tower_Win_Back", (tower_cx, tower_y_front + 0.02, win3_z), (win3_w, 0.02, win3_h), mat_glass_back, root)
    create_box("RND_Tower_Win_Glass", (tower_cx, tower_y_front - 0.02, win3_z), (win3_w, 0.02, win3_h), mat_glass_tint, root)
    
    # Outer bronze borders (Top, Bottom, Left, Right)
    create_box("RND_Tower_Win_FrT", (tower_cx, tower_y_front - 0.035, win3_z + win3_h / 2.0), (win3_w + 0.10, 0.06, 0.08), mat_bronze, root)
    create_box("RND_Tower_Win_FrB", (tower_cx, tower_y_front - 0.035, win3_z - win3_h / 2.0), (win3_w + 0.10, 0.06, 0.08), mat_bronze, root)
    create_box("RND_Tower_Win_FrL", (tower_cx - win3_w / 2.0, tower_y_front - 0.035, win3_z), (0.08, 0.06, win3_h), mat_bronze, root)
    create_box("RND_Tower_Win_FrR", (tower_cx + win3_w / 2.0, tower_y_front - 0.035, win3_z), (0.08, 0.06, win3_h), mat_bronze, root)

    # 3 vertical divider mullions (creating 4 equal vertical glass panes across)
    for mx in [-0.825, 0.00, +0.825]:
        create_box(f"RND_Tower_Win_MullV_{mx}", (tower_cx + mx, tower_y_front - 0.035, win3_z), (0.05, 0.05, win3_h), mat_bronze, root)

    # 2 horizontal divider transoms (creating 3 horizontal tiers)
    for tz in [win3_z - 0.50, win3_z + 0.50]:
        create_box(f"RND_Tower_Win_MullH_{tz}", (tower_cx, tower_y_front - 0.035, tz), (win3_w, 0.05, 0.05), mat_bronze, root)

    # -------------------------------------------------------------
    # 6. GROUND FLOOR FACADE ELEMENTS ACROSS BAYS 1, 2, 4, 5
    #   Bay 1 (X = -8.35m): Large commercial curtain window + ADA rail
    #   Bay 2 (X = -4.375m): Large commercial curtain window + ADA rail
    #   Bay 4 (X = +4.375m): SOLID GREEN WALL with DA Seal, 3D text & 2 seals
    #   Bay 5 (X = +8.35m): Large commercial curtain window
    # -------------------------------------------------------------
    cw_h = 2.45
    cw_z = Z_PLINTH + cw_h / 2.0 # 0.40 + 1.225 = 1.625m

    # Helper function to create commercial window with outer frame & interior mullions
    def create_commercial_window(name, cx, width):
        create_box(f"{name}_Back", (cx, Y_FRONT + 0.02, cw_z), (width, 0.02, cw_h), mat_glass_back, root)
        create_box(f"{name}_Glass", (cx, Y_FRONT - 0.02, cw_z), (width, 0.02, cw_h), mat_glass_tint, root)
        # Perimeter bronze borders
        create_box(f"{name}_FrT", (cx, Y_FRONT - 0.03, cw_z + cw_h / 2.0), (width + 0.08, 0.06, 0.08), mat_bronze, root)
        create_box(f"{name}_FrB", (cx, Y_FRONT - 0.03, cw_z - cw_h / 2.0), (width + 0.08, 0.06, 0.08), mat_bronze, root)
        create_box(f"{name}_FrL", (cx - width / 2.0, Y_FRONT - 0.03, cw_z), (0.08, 0.06, cw_h), mat_bronze, root)
        create_box(f"{name}_FrR", (cx + width / 2.0, Y_FRONT - 0.03, cw_z), (0.08, 0.06, cw_h), mat_bronze, root)
        # 3 vertical mullions dividing into 4 panes
        pane_w = width / 4.0
        for i in [-1.5, -0.5, 0.5, 1.5]:
            pass
        for i in range(1, 4):
            mx = cx - width / 2.0 + i * pane_w
            create_box(f"{name}_MullV_{i}", (mx, Y_FRONT - 0.035, cw_z), (0.05, 0.05, cw_h), mat_bronze, root)
        # 1 horizontal transom
        create_box(f"{name}_MullH", (cx, Y_FRONT - 0.035, cw_z + 0.55), (width, 0.05, 0.05), mat_bronze, root)

    # Bay 1 Curtain Window
    create_commercial_window("RND_CW_Bay1", -8.35, 3.20)

    # Bay 2 Curtain Window
    create_commercial_window("RND_CW_Bay2", -4.375, 3.35)

    # Bay 5 Curtain Window
    create_commercial_window("RND_CW_Bay5", +8.35, 3.20)

    # Stainless steel ADA ramp handrails running across Bay 1 & Bay 2
    create_box("RND_Ramp_Handrail", (-6.35, Y_FRONT - 1.15, Z_PLINTH + 0.85), (7.40, 0.03, 0.03), mat_railing_silver, root)
    create_box("RND_Ramp_Midrail", (-6.35, Y_FRONT - 1.15, Z_PLINTH + 0.45), (7.40, 0.02, 0.02), mat_railing_silver, root)
    for rx in [-9.80, -8.10, -6.40, -4.70, -3.00]:
        create_box(f"RND_Ramp_Post_{rx}", (rx, Y_FRONT - 1.15, (Z_PLINTH + 0.85) / 2.0), (0.03, 0.03, Z_PLINTH + 0.85), mat_railing_silver, root)

    # -------------------------------------------------------------
    # BAY 4 GROUND FLOOR: SOLID GREEN WALL & OFFICIAL SIGNAGE
    # Features:
    #   - Left: Official DA Circular Seal Medallion (Green/Gold/White)
    #   - Center: 3D Dimensional Cutout Lettering:
    #       "R&D"
    #       "Multipurpose"
    #       "Building"
    #   - Right: Two Circular Medallions side-by-side (Green/Gold & Blue/Gold)
    # -------------------------------------------------------------
    sign_cx = +4.45
    # Left DA Circular Seal Medallion
    create_cylinder("RND_Seal_Left_Green", (sign_cx - 0.95, Y_FRONT - 0.02, 2.30), radius=0.22, depth=0.04, rot=(math.radians(90), 0, 0), mat=mat_seal_green, parent=root, vertices=16)
    create_cylinder("RND_Seal_Left_Gold", (sign_cx - 0.95, Y_FRONT - 0.03, 2.30), radius=0.17, depth=0.05, rot=(math.radians(90), 0, 0), mat=mat_seal_gold, parent=root, vertices=16)

    # 3D Dimensional Lettering Plaque Bars (clean PBR extruded representations)
    create_box("RND_Sign_Line1_Text", (sign_cx, Y_FRONT - 0.03, 2.15), (0.85, 0.03, 0.16), mat_sign_text, root)
    create_box("RND_Sign_Line2_Text", (sign_cx, Y_FRONT - 0.03, 1.85), (1.45, 0.03, 0.15), mat_sign_text, root)
    create_box("RND_Sign_Line3_Text", (sign_cx, Y_FRONT - 0.03, 1.55), (1.15, 0.03, 0.15), mat_sign_text, root)

    # Right Two Circular Seal Medallions side-by-side
    create_cylinder("RND_Seal_Right1", (sign_cx + 1.05, Y_FRONT - 0.02, 2.25), radius=0.19, depth=0.04, rot=(math.radians(90), 0, 0), mat=mat_seal_gold, parent=root, vertices=16)
    create_cylinder("RND_Seal_Right2", (sign_cx + 1.45, Y_FRONT - 0.02, 2.25), radius=0.19, depth=0.04, rot=(math.radians(90), 0, 0), mat=mat_seal_blue, parent=root, vertices=16)

    # -------------------------------------------------------------
    # 7. 2ND FLOOR WINDOWS ACROSS BAYS 1, 2, 4, 5
    # Detailed window configurations:
    #   Bay 1: 2 tall narrow windows at X = -9.10m, -7.60m
    #   Bay 2: 2 tall narrow windows at X = -5.15m, -3.60m
    #          + Window AC unit mounted in cream band directly above -3.60m!
    #   Bay 4: 1 small window at X = +3.35m, 1 tall narrow window at X = +5.15m
    #   Bay 5: 2 tall narrow windows at X = +7.60m, +9.10m
    # -------------------------------------------------------------
    tall_win_h = 2.00
    tall_win_w = 0.70
    tall_win_z = Z_FLOOR2 + 1.25 # Z = 4.75m

    def create_tall_narrow_window(name, wx):
        # Dark solid backing
        create_box(f"{name}_Back", (wx, Y_FRONT + 0.02, tall_win_z), (tall_win_w, 0.02, tall_win_h), mat_glass_back, root)
        # Tinted reflective glass
        create_box(f"{name}_Glass", (wx, Y_FRONT - 0.02, tall_win_z), (tall_win_w, 0.02, tall_win_h), mat_glass_tint, root)
        # Outer bronze frame borders
        create_box(f"{name}_FrT", (wx, Y_FRONT - 0.03, tall_win_z + tall_win_h / 2.0), (tall_win_w + 0.06, 0.05, 0.06), mat_bronze, root)
        create_box(f"{name}_FrB", (wx, Y_FRONT - 0.03, tall_win_z - tall_win_h / 2.0), (tall_win_w + 0.06, 0.05, 0.06), mat_bronze, root)
        create_box(f"{name}_FrL", (wx - tall_win_w / 2.0, Y_FRONT - 0.03, tall_win_z), (0.06, 0.05, tall_win_h), mat_bronze, root)
        create_box(f"{name}_FrR", (wx + tall_win_w / 2.0, Y_FRONT - 0.03, tall_win_z), (0.06, 0.05, tall_win_h), mat_bronze, root)
        # 2 horizontal pane transoms
        for ty in [tall_win_z - 0.35, tall_win_z + 0.35]:
            create_box(f"{name}_Mull_{ty:.2f}", (wx, Y_FRONT - 0.035, ty), (tall_win_w, 0.03, 0.03), mat_bronze, root)

    tall_windows = [
        ("RND_Win_Bay1_L", -9.10),
        ("RND_Win_Bay1_R", -7.60),
        ("RND_Win_Bay2_L", -5.15),
        ("RND_Win_Bay2_R", -3.60),
        ("RND_Win_Bay4_R", +5.15),
        ("RND_Win_Bay5_L", +7.60),
        ("RND_Win_Bay5_R", +9.10),
    ]

    for wname, wx in tall_windows:
        create_tall_narrow_window(wname, wx)

    # Bay 4 Small Window on Left (near pilaster, X = +3.35m, shorter 2-pane window)
    small_win_w = 0.60
    small_win_h = 1.20
    small_win_z = Z_FLOOR2 + 1.55 # Z = 5.05m
    create_box("RND_Win_Bay4_Small_Back", (+3.35, Y_FRONT + 0.02, small_win_z), (small_win_w, 0.02, small_win_h), mat_glass_back, root)
    create_box("RND_Win_Bay4_Small_Glass", (+3.35, Y_FRONT - 0.02, small_win_z), (small_win_w, 0.02, small_win_h), mat_glass_tint, root)
    create_box("RND_Win_Bay4_Small_FrT", (+3.35, Y_FRONT - 0.03, small_win_z + small_win_h / 2.0), (small_win_w + 0.06, 0.05, 0.06), mat_bronze, root)
    create_box("RND_Win_Bay4_Small_FrB", (+3.35, Y_FRONT - 0.03, small_win_z - small_win_h / 2.0), (small_win_w + 0.06, 0.05, 0.06), mat_bronze, root)
    create_box("RND_Win_Bay4_Small_FrL", (+3.35 - small_win_w / 2.0, Y_FRONT - 0.03, small_win_z), (0.06, 0.05, small_win_h), mat_bronze, root)
    create_box("RND_Win_Bay4_Small_FrR", (+3.35 + small_win_w / 2.0, Y_FRONT - 0.03, small_win_z), (0.06, 0.05, small_win_h), mat_bronze, root)
    create_box("RND_Win_Bay4_Small_Mull", (+3.35, Y_FRONT - 0.035, small_win_z), (small_win_w, 0.03, 0.03), mat_bronze, root)

    # Window AC unit in Bay 2 mounted high in the cream wall band above the right window (X = -3.60m)
    create_box("RND_AC_Bay2_Body", (-3.60, Y_FRONT - 0.25, 6.55), (0.70, 0.55, 0.45), mat_metal_white, root)
    create_box("RND_AC_Bay2_Grille", (-3.60, Y_FRONT - 0.53, 6.55), (0.60, 0.02, 0.35), mat_grille_dark, root)

    # -------------------------------------------------------------
    # 8. LEFT FLANK STEEL FIRE ESCAPE STAIRCASE (IMG_3830)
    # Located on Left wall (X = -10.60m) in the Front bay (Y between -6.75m and 0.0m)
    # Features:
    #   - 2nd-floor steel exit door & cantilevered steel platform with handrails at Y = -2.80m
    #   - Steel vertical ladder extending up to rooftop balcony at Y = -2.80m
    #   - Rooftop safety railing cage on the balcony
    # -------------------------------------------------------------
    ladder_x = X_MIN - 0.65 # -11.25m
    platform_y = -2.80

    # 2nd floor steel exit doorway (X = -10.60m)
    create_box("RND_FireDoor_Back", (X_MIN + 0.02, platform_y, Z_FLOOR2 + 1.15), (0.02, 1.00, 2.10), mat_glass_back, root)
    create_box("RND_FireDoor_FrT", (X_MIN - 0.02, platform_y, Z_FLOOR2 + 2.15), (0.06, 1.05, 0.08), mat_bronze, root)
    create_box("RND_FireDoor_FrL", (X_MIN - 0.02, platform_y - 0.50, Z_FLOOR2 + 1.15), (0.06, 0.08, 2.10), mat_bronze, root)
    create_box("RND_FireDoor_FrR", (X_MIN - 0.02, platform_y + 0.50, Z_FLOOR2 + 1.15), (0.06, 0.08, 2.10), mat_bronze, root)
    create_box("RND_FireDoor_Leaf", (X_MIN - 0.03, platform_y, Z_FLOOR2 + 1.15), (0.02, 0.85, 1.95), mat_metal_white, root)

    # 2nd Floor Cantilevered Steel Landing Platform
    create_box("RND_FirePlatform_Floor", (ladder_x + 0.30, platform_y, Z_FLOOR2 + 0.05), (1.10, 1.40, 0.08), mat_steel_stair, root)
    # Platform safety railings (3 sides)
    create_box("RND_FirePlatform_Rail_Outer", (ladder_x - 0.23, platform_y, Z_FLOOR2 + 0.95), (0.04, 1.40, 0.04), mat_steel_stair, root)
    create_box("RND_FirePlatform_Rail_South", (ladder_x + 0.30, platform_y - 0.68, Z_FLOOR2 + 0.95), (1.10, 0.04, 0.04), mat_steel_stair, root)
    create_box("RND_FirePlatform_Rail_North", (ladder_x + 0.30, platform_y + 0.68, Z_FLOOR2 + 0.95), (1.10, 0.04, 0.04), mat_steel_stair, root)

    # Vertical Steel Ladder to Rooftop Balcony (Z = 3.50m to 7.85m)
    ladder_h = Z_PARAPET - Z_FLOOR2
    create_box("RND_Ladder_Stringer_L", (ladder_x - 0.15, platform_y - 0.25, (Z_FLOOR2 + Z_PARAPET) / 2.0), (0.04, 0.04, ladder_h), mat_steel_stair, root)
    create_box("RND_Ladder_Stringer_R", (ladder_x - 0.15, platform_y + 0.25, (Z_FLOOR2 + Z_PARAPET) / 2.0), (0.04, 0.04, ladder_h), mat_steel_stair, root)
    for r_idx in range(9):
        rz = Z_FLOOR2 + 0.40 + r_idx * 0.45
        create_box(f"RND_Ladder_Rung_{r_idx}", (ladder_x - 0.15, platform_y, rz), (0.03, 0.46, 0.03), mat_steel_stair, root)

    # Rooftop Safety Railing Cage on Balcony (IMG_3830 & Top View)
    create_box("RND_RoofCage_Rail_Outer", (ladder_x - 0.15, platform_y, Z_PARAPET + 0.90), (0.04, 1.10, 0.04), mat_steel_stair, root)
    create_box("RND_RoofCage_Rail_South", (X_MIN - 0.35, platform_y - 0.53, Z_PARAPET + 0.90), (0.80, 0.04, 0.04), mat_steel_stair, root)
    create_box("RND_RoofCage_Rail_North", (X_MIN - 0.35, platform_y + 0.53, Z_PARAPET + 0.90), (0.80, 0.04, 0.04), mat_steel_stair, root)

    # -------------------------------------------------------------
    # 9. LEFT FLANK WINDOWS & AC UNITS (IMG_3830)
    # Ground floor: 2 large security-grilled windows, 2 Carrier split ACs
    # 2nd floor: 2 windows with concrete hoods, window AC units
    # -------------------------------------------------------------
    # Ground floor large grilled windows
    for idx, wy in enumerate([-3.40, +4.00]):
        create_box(f"RND_Win_LeftGnd_Back_{idx}", (X_MIN + 0.02, wy, Z_PLINTH + 1.10), (0.02, 2.20, 1.40), mat_glass_back, root)
        create_box(f"RND_Win_LeftGnd_Glass_{idx}", (X_MIN - 0.02, wy, Z_PLINTH + 1.10), (0.02, 2.15, 1.35), mat_glass_tint, root)
        create_box(f"RND_Win_LeftGnd_FrT_{idx}", (X_MIN - 0.03, wy, Z_PLINTH + 1.75), (0.06, 2.25, 0.08), mat_bronze, root)
        create_box(f"RND_Win_LeftGnd_FrB_{idx}", (X_MIN - 0.03, wy, Z_PLINTH + 0.45), (0.06, 2.25, 0.08), mat_bronze, root)
        create_box(f"RND_Win_LeftGnd_FrL_{idx}", (X_MIN - 0.03, wy - 1.10, Z_PLINTH + 1.10), (0.06, 0.08, 1.40), mat_bronze, root)
        create_box(f"RND_Win_LeftGnd_FrR_{idx}", (X_MIN - 0.03, wy + 1.10, Z_PLINTH + 1.10), (0.06, 0.08, 1.40), mat_bronze, root)
        # White security grille bars
        create_box(f"RND_Win_LeftGnd_Grille_{idx}", (X_MIN - 0.05, wy, Z_PLINTH + 1.10), (0.02, 2.05, 1.25), mat_metal_white, root)

    # Carrier split AC condenser units mounted on cantilever wall brackets (IMG_3830)
    for idx, ay in enumerate([-1.40, -5.60]):
        create_box(f"RND_AC_Left_Bkt1_{idx}", (X_MIN - 0.20, ay - 0.35, Z_PLINTH + 1.65), (0.45, 0.05, 0.12), mat_steel_stair, root)
        create_box(f"RND_AC_Left_Bkt2_{idx}", (X_MIN - 0.20, ay + 0.35, Z_PLINTH + 1.65), (0.45, 0.05, 0.12), mat_steel_stair, root)
        create_box(f"RND_AC_Left_Body_{idx}", (X_MIN - 0.35, ay, Z_PLINTH + 2.05), (0.45, 0.85, 0.65), mat_metal_white, root)
        create_box(f"RND_AC_Left_Grille_{idx}", (X_MIN - 0.58, ay - 0.10, Z_PLINTH + 2.05), (0.02, 0.42, 0.42), mat_grille_dark, root)

    # 2nd floor windows on Left flank (with sloped concrete hoods)
    for idx, wy in enumerate([-1.20, +3.20]):
        create_box(f"RND_Win_Left2nd_Back_{idx}", (X_MIN + 0.02, wy, Z_FLOOR2 + 1.25), (0.02, 0.70, 1.30), mat_glass_back, root)
        create_box(f"RND_Win_Left2nd_Glass_{idx}", (X_MIN - 0.02, wy, Z_FLOOR2 + 1.25), (0.02, 0.65, 1.25), mat_glass_tint, root)
        create_box(f"RND_Win_Left2nd_FrT_{idx}", (X_MIN - 0.03, wy, Z_FLOOR2 + 1.90), (0.06, 0.75, 0.06), mat_bronze, root)
        create_box(f"RND_Win_Left2nd_FrB_{idx}", (X_MIN - 0.03, wy, Z_FLOOR2 + 0.60), (0.06, 0.75, 0.06), mat_bronze, root)
        create_box(f"RND_Win_Left2nd_FrL_{idx}", (X_MIN - 0.03, wy - 0.35, Z_FLOOR2 + 1.25), (0.06, 0.06, 1.30), mat_bronze, root)
        create_box(f"RND_Win_Left2nd_FrR_{idx}", (X_MIN - 0.03, wy + 0.35, Z_FLOOR2 + 1.25), (0.06, 0.06, 1.30), mat_bronze, root)
        # Concrete hood
        create_box(f"RND_Win_Left2nd_Hood_{idx}", (X_MIN - 0.18, wy, Z_FLOOR2 + 1.95), (0.35, 0.90, 0.06), mat_parapet_cap, root)
        # Window AC unit next to window
        create_box(f"RND_AC_Left2nd_{idx}", (X_MIN - 0.25, wy + 0.80, Z_FLOOR2 + 1.65), (0.45, 0.55, 0.42), mat_metal_white, root)

    # Small awning bathroom window on 2nd floor rear bay (IMG_3830)
    create_box("RND_Win_Left2nd_Bath", (X_MIN - 0.02, +5.20, Z_FLOOR2 + 1.80), (0.06, 0.55, 0.55), mat_bronze, root)

    # High AC unit near front corner (IMG_3830)
    create_box("RND_AC_Left2nd_FrontCorner", (X_MIN - 0.25, -5.50, Z_FLOOR2 + 2.50), (0.45, 0.55, 0.42), mat_metal_white, root)

    # -------------------------------------------------------------
    # 10. REAR & RIGHT FLANK FENESTRATION (Watertight balance)
    # -------------------------------------------------------------
    # Rear windows along rear wall (Y = +6.75m)
    for rx in [-8.35, -4.375, +4.375, +8.35]:
        create_box(f"RND_RearWin_Back_{rx}", (rx, Y_REAR - 0.02, Z_FLOOR2 + 1.25), (1.60, 0.02, 1.40), mat_glass_back, root)
        create_box(f"RND_RearWin_Glass_{rx}", (rx, Y_REAR + 0.02, Z_FLOOR2 + 1.25), (1.55, 0.02, 1.35), mat_glass_tint, root)
        create_box(f"RND_RearWin_FrT_{rx}", (rx, Y_REAR + 0.03, Z_FLOOR2 + 1.95), (1.65, 0.06, 0.08), mat_bronze, root)
        create_box(f"RND_RearWin_FrB_{rx}", (rx, Y_REAR + 0.03, Z_FLOOR2 + 0.55), (1.65, 0.06, 0.08), mat_bronze, root)

    # Right flank windows (X = +10.60m)
    for ry in [-2.50, +3.00]:
        create_box(f"RND_Win_Right_Back_{ry}", (X_MAX - 0.02, ry, Z_FLOOR2 + 1.25), (0.02, 1.20, 1.30), mat_glass_back, root)
        create_box(f"RND_Win_Right_Glass_{ry}", (X_MAX + 0.02, ry, Z_FLOOR2 + 1.25), (0.02, 1.15, 1.25), mat_glass_tint, root)
        create_box(f"RND_Win_Right_FrT_{ry}", (X_MAX + 0.03, ry, Z_FLOOR2 + 1.90), (0.06, 1.25, 0.08), mat_bronze, root)
        create_box(f"RND_Win_Right_FrB_{ry}", (X_MAX + 0.03, ry, Z_FLOOR2 + 0.60), (0.06, 1.25, 0.08), mat_bronze, root)
        create_box(f"RND_Win_Right_Hood_{ry}", (X_MAX + 0.18, ry, Z_FLOOR2 + 1.95), (0.35, 1.40, 0.06), mat_parapet_cap, root)

    # -------------------------------------------------------------
    # 11. BATCH MERGE BY MATERIAL (Performance & Strict Size Budget)
    # -------------------------------------------------------------
    bpy.ops.object.select_all(action='DESELECT')
    for obj in list(root.children):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root.children[0] if root.children else None

    mat_groups = {}
    for obj in list(root.children):
        if obj.type == 'MESH':
            mat_name = obj.data.materials[0].name if obj.data.materials else "NoMat"
            if len(obj.data.materials) > 1:
                continue
            mat_groups.setdefault(mat_name, []).append(obj)

    for mat_name, objs in mat_groups.items():
        if len(objs) > 1:
            bpy.ops.object.select_all(action='DESELECT')
            for o in objs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            bpy.ops.object.join()
            merged = bpy.context.active_object
            merged.name = f"RND_Merged_{mat_name}"
            merged.parent = root

    # -------------------------------------------------------------
    # 12. EXPORT TO GLB
    # -------------------------------------------------------------
    os.makedirs(os.path.dirname(TARGET_GLB), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=TARGET_GLB,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )

    size_kb = os.path.getsize(TARGET_GLB) / 1024.0
    print(f"✅ Successfully exported R&D Building model:")
    print(f"   Target: {TARGET_GLB}")
    print(f"   Size:   {size_kb:.1f} KB (budget: <= 300 KB)")

build_rnd_building()
