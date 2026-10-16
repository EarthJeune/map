"""
build_dormitory.py — Authentic Bespoke 3D Architectural Model of the DA-LARES Dormitory (dorm)

Ground-Truth Photographic Reference:
- IMG_3848.jpg: Front elevation of the Dormitory (2 floors, yellow ground floor, green 2nd floor,
  main entrance door with grid transom and cantilever canopy, wooden bench, signature 2-storey
  open balcony on the left bay with black railings, side of Multi-Purpose Admin on the far left).
- IMG_3849.jpg: Wider front angle showing all 4 front structural bays, windows, and roof profile.
- IMG_3850.jpg: Right flank (East facade) showing wall-mounted AC condenser with canopy hood,
  side windows, concrete landing apron, and vertical pilasters.
- IMG_3890.jpg: Rear elevation confirming the 2nd-floor balcony extends all the way to the back,
  with an exterior steel staircase leading up to the balcony deck, AC units, and rear windows.

Footprint & Orientation:
- Footprint from LARES_DRAWINGS: 14.8m wide (Front/Rear) x 16.3m deep (Sides).
- Centered at origin (0, 0, 0) in Blender.
- Front facade faces South-South-West (bearing ~196.3°).
- Mapbox rotation: 16.3°
- Performance Budget: strictly < 300 KB GLB.
"""

import bpy
import bmesh
import math
import os

TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\dorm.glb"

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)

def create_mat(name, base_color, roughness=0.6, metallic=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*base_color[:3], 1.0)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        if alpha < 1.0:
            if 'Alpha' in bsdf.inputs:
                bsdf.inputs['Alpha'].default_value = alpha
            mat.blend_method = 'BLEND'
    return mat

def create_box(name, loc, size, mat=None, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, loc, radius, depth, mat=None, parent=None, vertices=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=loc,
        rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_dormitory_model():
    clear_scene()

    root = bpy.data.objects.new("dorm", None)
    bpy.context.scene.collection.objects.link(root)

    # -------------------------------------------------------------
    # 1. AUTHENTIC MATERIALS (from field photos IMG_3848, 3849, 3850, 3890)
    # -------------------------------------------------------------
    # Ground floor: Warm pastel buff yellow/cream stucco
    mat_wall_yellow = create_mat("DORM_WallYellow", (0.86, 0.78, 0.54), roughness=0.75)
    # 2nd floor: Apple/mint green stucco
    mat_wall_green = create_mat("DORM_WallGreen", (0.34, 0.65, 0.44), roughness=0.70)
    # Structural columns & mid-floor divider beam: Slate grey
    mat_col_grey = create_mat("DORM_ColGrey", (0.42, 0.44, 0.43), roughness=0.60)
    # Concrete plinth, porch & floor slabs
    mat_concrete = create_mat("DORM_Concrete", (0.72, 0.74, 0.72), roughness=0.80)
    # Metal railings (black horizontal safety bars on balcony)
    mat_rail_black = create_mat("DORM_RailBlack", (0.10, 0.10, 0.10), roughness=0.40, metallic=0.85)
    # Bronze window frames
    mat_bronze = create_mat("DORM_BronzeFrame", (0.14, 0.13, 0.12), roughness=0.35, metallic=0.70)
    # Window glass (reflective tint)
    mat_glass = create_mat("DORM_Glass", (0.12, 0.18, 0.22), roughness=0.08, metallic=0.90, alpha=0.60)
    # Roof: Dark forest green corrugated metal
    mat_roof = create_mat("DORM_RoofGreen", (0.16, 0.38, 0.22), roughness=0.45, metallic=0.15)
    mat_ridge = create_mat("DORM_RidgeGreen", (0.12, 0.30, 0.17), roughness=0.50)
    # White soffits & ceiling under balcony
    mat_soffit = create_mat("DORM_SoffitWhite", (0.92, 0.93, 0.92), roughness=0.55)
    # Fascia board trim (dark green/charcoal)
    mat_fascia = create_mat("DORM_Fascia", (0.12, 0.16, 0.14), roughness=0.60)
    # Entrance wooden door & bench
    mat_wood = create_mat("DORM_Wood", (0.65, 0.50, 0.30), roughness=0.65)
    # AC compressor white & dark grille
    mat_ac_white = create_mat("DORM_ACWhite", (0.92, 0.92, 0.90), roughness=0.35)
    mat_ac_dark = create_mat("DORM_ACDark", (0.20, 0.20, 0.20), roughness=0.50, metallic=0.40)
    mat_sign_white = create_mat("DORM_SignWhite", (0.96, 0.96, 0.96), roughness=0.40)

    # -------------------------------------------------------------
    # 2. ARCHITECTURAL DIMENSIONS
    # -------------------------------------------------------------
    # Footprint dimensions centered at (0, 0):
    # Total Width (Front/Rear): 14.80m (X from -7.40 to +7.40)
    # Total Depth (Sides): 16.30m (Y from -8.15 to +8.15)
    #
    # Front is along -Y (Y = -8.15m)
    # Rear is along +Y (Y = +8.15m)
    # Left side (West, facing Multi-Purpose Admin with Balcony) is along -X (X = -7.40m)
    # Right side (East, with AC condenser & side terrace) is along +X (X = +7.40m)
    #
    # Heights:
    # Z_GROUND = 0.00m
    # Z_PLINTH = 0.40m (ground floor concrete apron & footing)
    # Z_FLOOR1 = 0.40m
    # Z_FLOOR2 = 3.40m (2nd floor slab, thickness 0.25m -> 3.40 to 3.65m)
    # Z_EAVE   = 6.50m (top of walls / eave line)
    # Z_RIDGE  = 8.40m (hip roof apex ridge)
    W = 14.80
    D = 16.30
    X_MIN = -W / 2.0  # -7.40
    X_MAX = +W / 2.0  # +7.40
    Y_FRONT = -D / 2.0 # -8.15
    Y_REAR = +D / 2.0  # +8.15

    Z_PLINTH = 0.40
    Z_SLAB2_BOT = 3.35
    Z_SLAB2_TOP = 3.60
    Z_EAVE = 6.50
    Z_RIDGE = 8.35

    # -------------------------------------------------------------
    # 3. FOUNDATIONS & FLOOR SLABS
    # -------------------------------------------------------------
    # Concrete Plinth Skirt
    create_box("DORM_Plinth", (0.0, 0.0, Z_PLINTH / 2.0), (W + 0.15, D + 0.15, Z_PLINTH), mat_concrete, root)

    # Front Entrance Approach Path & Landing Apron (IMG_3848, 3849):
    # Aligned with Bay 2 entrance door (X in [-3.8, -0.6], extending in front of Y_FRONT)
    create_box("DORM_FrontLanding", (-2.20, Y_FRONT - 0.75, 0.15), (3.60, 1.50, 0.30), mat_concrete, root)
    create_box("DORM_FrontPath", (-2.20, Y_FRONT - 2.50, 0.05), (1.60, 2.00, 0.10), mat_concrete, root)

    # Right Flank Concrete Side Stoop / Terrace (IMG_3850):
    # Located along East wall: X = +7.40, extending out by 1.2m
    create_box("DORM_SideStoop", (X_MAX + 0.60, -2.50, 0.18), (1.20, 3.20, 0.36), mat_concrete, root)
    create_box("DORM_SideStep", (X_MAX + 1.35, -2.50, 0.09), (0.40, 3.00, 0.18), mat_concrete, root)

    # -------------------------------------------------------------
    # 4. EXTERIOR WALLS & STRUCTURAL BAY LAYOUT
    # -------------------------------------------------------------
    # Bay layout along X (Front Facade, total width 14.8m):
    # - Bay 1 (Left / West Balcony Corridor): X in [-7.40, -4.20] (Width = 3.20m)
    #   Open 2-storey exterior balcony/corridor from front to back!
    # - Bay 2 (Mid-Left / Main Entrance): X in [-4.20, -0.60] (Width = 3.60m)
    #   Ground: Entrance door + wooden bench; 2nd: Sliding window + AC
    # - Bay 3 (Mid-Right): X in [-0.60, +3.40] (Width = 4.00m)
    #   Ground: Wall + plant bed; 2nd: Sliding window
    # - Bay 4 (Right / East Flank): X in [+3.40, +7.40] (Width = 4.00m)
    #   Ground: Window with grilles; 2nd: Sliding window
    #
    # Inner corridor wall separating the building interior from Bay 1 balcony:
    # Runs at X = -4.20m from Y_FRONT to Y_REAR!
    X_BALCONY_EDGE = -7.40
    X_CORRIDOR_WALL = -4.20

    # 4.1 ENCLOSED BUILDING BODY (from X = -4.20m to X = +7.40m, Width = 11.60m)
    enc_w = X_MAX - X_CORRIDOR_WALL # 11.60m
    enc_cx = (X_CORRIDOR_WALL + X_MAX) / 2.0 # +1.60m

    # Ground floor body (Yellow stucco Z = 0.40 to 3.35m)
    h_gf = Z_SLAB2_BOT - Z_PLINTH
    create_box("DORM_Body_GF", (enc_cx, 0.0, Z_PLINTH + h_gf / 2.0), (enc_w, D, h_gf), mat_wall_yellow, root)

    # 2nd floor body (Green stucco Z = 3.60 to 6.50m)
    h_2f = Z_EAVE - Z_SLAB2_TOP
    create_box("DORM_Body_2F", (enc_cx, 0.0, Z_SLAB2_TOP + h_2f / 2.0), (enc_w, D, h_2f), mat_wall_green, root)

    # Mid-floor horizontal concrete divider band (Slate grey Z = 3.35 to 3.60m)
    create_box("DORM_DividerBand", (enc_cx, 0.0, (Z_SLAB2_BOT + Z_SLAB2_TOP) / 2.0), (enc_w + 0.12, D + 0.12, Z_SLAB2_TOP - Z_SLAB2_BOT), mat_col_grey, root)

    # -------------------------------------------------------------
    # 5. SIGNATURE 2-STOREY OPEN BALCONY / CORRIDOR (BAY 1, WEST FLANK)
    # -------------------------------------------------------------
    # Runs the FULL DEPTH of the building from Y_FRONT to Y_REAR (16.30m)!
    # Width = 3.20m (X from -7.40 to -4.20m)
    balc_w = X_CORRIDOR_WALL - X_BALCONY_EDGE # 3.20m
    balc_cx = (X_BALCONY_EDGE + X_CORRIDOR_WALL) / 2.0 # -5.80m

    # Ground Floor Breezeway Walkway Floor Slab (Z = 0.40m)
    create_box("DORM_Balcony_Floor_GF", (balc_cx, 0.0, Z_PLINTH / 2.0), (balc_w, D, Z_PLINTH), mat_concrete, root)

    # 2nd Floor Balcony Cantilever Deck (Z = 3.35 to 3.60m)
    create_box("DORM_Balcony_Deck_2F", (balc_cx, 0.0, (Z_SLAB2_BOT + Z_SLAB2_TOP) / 2.0), (balc_w, D, Z_SLAB2_TOP - Z_SLAB2_BOT), mat_concrete, root)
    create_box("DORM_Balcony_Ceiling", (balc_cx, 0.0, Z_EAVE - 0.05), (balc_w, D, 0.10), mat_soffit, root)

    # Balcony Outer Structural Columns (Along X = -7.40m, 5 round/square posts along the length)
    col_y_positions = [-7.95, -4.00, 0.00, +4.00, +7.95]
    for ci, cy in enumerate(col_y_positions):
        # Full height 2-story column
        create_box(f"DORM_Balc_Col_{ci}", (X_BALCONY_EDGE + 0.20, cy, Z_EAVE / 2.0), (0.40, 0.40, Z_EAVE), mat_col_grey, root)

    # Balcony Black Steel Safety Railings (IMG_3848, 3849, 3890):
    # Installed along the front (Y_FRONT), outer side (X_BALCONY_EDGE), and rear (Y_REAR)
    rail_h = 1.05
    rail_mid_z = Z_SLAB2_TOP + rail_h / 2.0

    # Front Balcony Railing (at Y_FRONT)
    create_box("DORM_Rail_Front_Top", (balc_cx, Y_FRONT + 0.08, Z_SLAB2_TOP + rail_h), (balc_w - 0.40, 0.06, 0.06), mat_rail_black, root)
    create_box("DORM_Rail_Front_Mid", (balc_cx, Y_FRONT + 0.08, Z_SLAB2_TOP + rail_h * 0.5), (balc_w - 0.40, 0.04, 0.04), mat_rail_black, root)
    create_box("DORM_Rail_Front_Bot", (balc_cx, Y_FRONT + 0.08, Z_SLAB2_TOP + 0.10), (balc_w - 0.40, 0.04, 0.04), mat_rail_black, root)
    for pi in range(5):
        px = X_BALCONY_EDGE + 0.40 + pi * ((balc_w - 0.80) / 4.0)
        create_cylinder(f"DORM_Rail_Front_Post_{pi}", (px, Y_FRONT + 0.08, rail_mid_z), 0.02, rail_h, mat_rail_black, root)

    # Outer Balcony Railing (along X = -7.40m between columns)
    for seg_i in range(len(col_y_positions) - 1):
        y1 = col_y_positions[seg_i] + 0.20
        y2 = col_y_positions[seg_i + 1] - 0.20
        seg_len = y2 - y1
        seg_cy = (y1 + y2) / 2.0
        create_box(f"DORM_Rail_Outer_Top_{seg_i}", (X_BALCONY_EDGE + 0.15, seg_cy, Z_SLAB2_TOP + rail_h), (0.06, seg_len, 0.06), mat_rail_black, root)
        create_box(f"DORM_Rail_Outer_Mid_{seg_i}", (X_BALCONY_EDGE + 0.15, seg_cy, Z_SLAB2_TOP + rail_h * 0.5), (0.04, seg_len, 0.04), mat_rail_black, root)
        create_box(f"DORM_Rail_Outer_Bot_{seg_i}", (X_BALCONY_EDGE + 0.15, seg_cy, Z_SLAB2_TOP + 0.10), (0.04, seg_len, 0.04), mat_rail_black, root)

    # Rear Balcony Railing (at Y_REAR, IMG_3890)
    create_box("DORM_Rail_Rear_Top", (balc_cx, Y_REAR - 0.08, Z_SLAB2_TOP + rail_h), (balc_w - 0.40, 0.06, 0.06), mat_rail_black, root)
    create_box("DORM_Rail_Rear_Mid", (balc_cx, Y_REAR - 0.08, Z_SLAB2_TOP + rail_h * 0.5), (balc_w - 0.40, 0.04, 0.04), mat_rail_black, root)

    # Rear Exterior Steel Flight of Stairs (IMG_3890):
    # Leads from ground level up to the 2nd-floor balcony deck at the rear-left
    create_box("DORM_Stair_Landing", (balc_cx, Y_REAR + 0.60, Z_SLAB2_TOP), (1.40, 1.20, 0.12), mat_rail_black, root)
    create_box("DORM_Stair_Stringer1", (balc_cx - 0.60, Y_REAR + 1.80, Z_SLAB2_TOP / 2.0), (0.08, 2.60, Z_SLAB2_TOP), mat_rail_black, root, rot=(math.radians(45), 0, 0))
    create_box("DORM_Stair_Stringer2", (balc_cx + 0.60, Y_REAR + 1.80, Z_SLAB2_TOP / 2.0), (0.08, 2.60, Z_SLAB2_TOP), mat_rail_black, root, rot=(math.radians(45), 0, 0))
    for sti in range(8):
        st_z = Z_PLINTH + sti * ((Z_SLAB2_TOP - Z_PLINTH) / 8.0)
        st_y = Y_REAR + 0.60 + (8 - sti) * 0.30
        create_box(f"DORM_Stair_Step_{sti}", (balc_cx, st_y, st_z), (1.10, 0.28, 0.05), mat_rail_black, root)

    # -------------------------------------------------------------
    # 6. STRUCTURAL PILASTERS & DIVIDERS
    # -------------------------------------------------------------
    # Vertical slate grey pilasters on front, right, and rear facades
    front_pilasters_x = [-4.20, -0.60, +3.40, +7.20]
    for pi, px in enumerate(front_pilasters_x):
        create_box(f"DORM_Pilaster_Front_{pi}", (px, Y_FRONT - 0.08, Z_EAVE / 2.0), (0.35, 0.20, Z_EAVE), mat_col_grey, root)

    right_pilasters_y = [Y_FRONT + 0.20, -2.50, +2.50, Y_REAR - 0.20]
    for pi, py in enumerate(right_pilasters_y):
        create_box(f"DORM_Pilaster_Right_{pi}", (X_MAX + 0.08, py, Z_EAVE / 2.0), (0.20, 0.35, Z_EAVE), mat_col_grey, root)

    rear_pilasters_x = [-4.20, -0.60, +3.40, +7.20]
    for pi, px in enumerate(rear_pilasters_x):
        create_box(f"DORM_Pilaster_Rear_{pi}", (px, Y_REAR + 0.08, Z_EAVE / 2.0), (0.35, 0.20, Z_EAVE), mat_col_grey, root)

    # -------------------------------------------------------------
    # 7. DOORS, CANOPY & WINDOWS
    # -------------------------------------------------------------
    # 7.1 MAIN ENTRANCE DOORWAY (Bay 2, X = -2.40m, IMG_3848, 3849)
    # Full height opening with wooden screen doors and multi-pane transoms
    door_w = 1.60
    door_h = 2.40
    door_cx = -2.40
    # Recessed door frame
    create_box("DORM_Door_Frame", (door_cx, Y_FRONT - 0.02, Z_PLINTH + door_h / 2.0), (door_w, 0.12, door_h), mat_bronze, root)
    create_box("DORM_Door_LeafL", (door_cx - 0.40, Y_FRONT - 0.02, Z_PLINTH + door_h / 2.0), (0.75, 0.06, door_h - 0.10), mat_wood, root)
    create_box("DORM_Door_LeafR", (door_cx + 0.40, Y_FRONT - 0.02, Z_PLINTH + door_h / 2.0), (0.75, 0.06, door_h - 0.10), mat_wood, root)

    # Cantilever Entrance Door Canopy Slab (IMG_3848, 3849):
    # Extends forward above the door at Z = 3.20m
    create_box("DORM_Door_Canopy", (door_cx, Y_FRONT - 0.80, 3.20), (2.40, 1.40, 0.12), mat_concrete, root)
    create_box("DORM_Canopy_Fascia", (door_cx, Y_FRONT - 1.50, 3.20), (2.46, 0.06, 0.14), mat_col_grey, root)

    # Official Bulletin / Notice Board on wall left of door (IMG_3848)
    create_box("DORM_NoticeBoard", (door_cx - 1.30, Y_FRONT - 0.05, 2.00), (0.65, 0.04, 0.90), mat_sign_white, root)

    # Outdoor Wooden Garden Bench (IMG_3848, 3849):
    # Sitting in front of Bay 3
    bench_cx = 1.00
    create_box("DORM_Bench_Seat", (bench_cx, Y_FRONT - 0.70, 0.45), (1.50, 0.45, 0.08), mat_wood, root)
    create_box("DORM_Bench_Back", (bench_cx, Y_FRONT - 0.50, 0.75), (1.50, 0.08, 0.50), mat_wood, root)
    create_box("DORM_Bench_LegL", (bench_cx - 0.65, Y_FRONT - 0.70, 0.22), (0.08, 0.40, 0.44), mat_rail_black, root)
    create_box("DORM_Bench_LegR", (bench_cx + 0.65, Y_FRONT - 0.70, 0.22), (0.08, 0.40, 0.44), mat_rail_black, root)

    # 7.2 FRONT WINDOWS (IMG_3848, 3849)
    def create_window(name, cx, y, cz, w, h, facing='Y_NEG', has_grille=False):
        # Frame
        th = 0.08
        if facing in ['Y_NEG', 'Y_POS']:
            create_box(f"{name}_Frame", (cx, y, cz), (w, th, h), mat_bronze, root)
            create_box(f"{name}_Glass", (cx, y, cz), (w - 0.10, 0.02, h - 0.10), mat_glass, root)
            if has_grille:
                for gi in range(4):
                    gz = cz - h/2.0 + (gi + 1) * (h / 5.0)
                    create_box(f"{name}_Grille_{gi}", (cx, y - 0.03, gz), (w - 0.08, 0.02, 0.02), mat_soffit, root)
        else: # X_POS or X_NEG
            create_box(f"{name}_Frame", (cx, y, cz), (th, w, h), mat_bronze, root)
            create_box(f"{name}_Glass", (cx, y, cz), (0.02, w - 0.10, h - 0.10), mat_glass, root)
            if has_grille:
                for gi in range(4):
                    gz = cz - h/2.0 + (gi + 1) * (h / 5.0)
                    create_box(f"{name}_Grille_{gi}", (cx + 0.03, y, gz), (0.02, w - 0.08, 0.02), mat_soffit, root)

    # Ground Floor Front Window (Bay 4, X = +5.30m, with white security grilles, IMG_3848, 3849)
    create_window("DORM_Win_GF_Front_Bay4", 5.30, Y_FRONT - 0.02, 1.80, 1.80, 1.40, facing='Y_NEG', has_grille=True)

    # 2nd Floor Front Windows (Sliding dark bronze windows):
    # Bay 2 (X = -2.40m, above entrance):
    create_window("DORM_Win_2F_Front_Bay2", -2.40, Y_FRONT - 0.02, 5.00, 1.80, 1.30, facing='Y_NEG')
    # Bay 3 (X = +1.40m):
    create_window("DORM_Win_2F_Front_Bay3", +1.40, Y_FRONT - 0.02, 5.00, 1.80, 1.30, facing='Y_NEG')
    # Bay 4 (X = +5.30m):
    create_window("DORM_Win_2F_Front_Bay4", +5.30, Y_FRONT - 0.02, 5.00, 1.80, 1.30, facing='Y_NEG')

    # Front Wall-Mounted Split AC Condenser (Bay 2 under left window, IMG_3848, 3849):
    ac_cx = -2.40
    ac_y = Y_FRONT - 0.35
    ac_z = 3.90
    create_box("DORM_AC_Front_Body", (ac_cx, ac_y, ac_z), (0.85, 0.35, 0.55), mat_ac_white, root)
    create_cylinder("DORM_AC_Front_Fan", (ac_cx + 0.15, ac_y - 0.18, ac_z), 0.20, 0.02, mat_ac_dark, root, rot=(math.radians(90), 0, 0))
    create_box("DORM_AC_Front_BracketL", (ac_cx - 0.35, ac_y + 0.10, ac_z - 0.30), (0.05, 0.40, 0.30), mat_col_grey, root)
    create_box("DORM_AC_Front_BracketR", (ac_cx + 0.35, ac_y + 0.10, ac_z - 0.30), (0.05, 0.40, 0.30), mat_col_grey, root)

    # 7.3 RIGHT FLANK WINDOWS & AC (IMG_3850)
    # Ground floor side window
    create_window("DORM_Win_GF_Right_1", X_MAX + 0.02, -2.50, 1.80, 1.60, 1.20, facing='X_POS')
    # 2nd floor side window
    create_window("DORM_Win_2F_Right_1", X_MAX + 0.02, -2.50, 5.00, 1.60, 1.20, facing='X_POS')
    create_window("DORM_Win_2F_Right_2", X_MAX + 0.02, +2.50, 5.00, 1.60, 1.20, facing='X_POS')

    # Right Flank Split AC Unit with Cantilever Metal Canopy Hood (IMG_3850):
    ac_r_y = 1.00
    create_box("DORM_AC_Right_Body", (X_MAX + 0.35, ac_r_y, 4.00), (0.35, 0.85, 0.55), mat_ac_white, root)
    create_box("DORM_AC_Right_Hood", (X_MAX + 0.50, ac_r_y, 4.55), (0.70, 1.10, 0.05), mat_soffit, root, rot=(0, math.radians(20), 0))

    # 7.4 REAR WINDOWS & AC CONDENSERS (IMG_3890)
    # 2nd floor rear windows
    create_window("DORM_Win_2F_Rear_1", -0.60, Y_REAR + 0.02, 5.00, 1.60, 1.30, facing='Y_POS')
    create_window("DORM_Win_2F_Rear_2", +2.50, Y_REAR + 0.02, 5.00, 1.60, 1.30, facing='Y_POS')
    create_window("DORM_Win_2F_Rear_3", +5.50, Y_REAR + 0.02, 5.00, 1.60, 1.30, facing='Y_POS')
    # Ground floor rear windows
    create_window("DORM_Win_GF_Rear_1", +2.50, Y_REAR + 0.02, 1.80, 1.60, 1.30, facing='Y_POS')
    create_window("DORM_Win_GF_Rear_2", +5.50, Y_REAR + 0.02, 1.80, 1.60, 1.30, facing='Y_POS')

    # Rear AC Condensers on wall (IMG_3890):
    create_box("DORM_AC_Rear_Upper", (1.20, Y_REAR + 0.35, 4.50), (0.85, 0.35, 0.55), mat_ac_white, root)
    create_box("DORM_AC_Rear_Lower", (3.80, Y_REAR + 0.35, 1.20), (0.85, 0.35, 0.55), mat_ac_white, root)

    # -------------------------------------------------------------
    # 8. WATERTIGHT COMPOUND HIPPED ROOF (Dark Forest Green)
    # -------------------------------------------------------------
    # Symmetrical 4-hip corrugated metal roof spanning the entire complex:
    # Overhang = 0.85m on all 4 sides:
    # X from X_MIN - 0.85 (-8.25m) to X_MAX + 0.85 (+8.25m) (Total Roof Width = 16.50m)
    # Y from Y_FRONT - 0.85 (-9.00m) to Y_REAR + 0.85 (+9.00m) (Total Roof Depth = 18.00m)
    #
    # Eave height = Z_EAVE (6.50m)
    # Ridge height = Z_RIDGE (8.35m)
    # Ridge length = 18.00 - 16.50 = 1.50m (centered along Y from -0.75m to +0.75m at X = 0.00m)
    r_w = W + 1.70  # 16.50m
    r_d = D + 1.70  # 18.00m
    rx_min = -r_w / 2.0 # -8.25
    rx_max = +r_w / 2.0 # +8.25
    ry_min = -r_d / 2.0 # -9.00
    ry_max = +r_d / 2.0 # +9.00

    ridge_len = (r_d - r_w) / 2.0 # 0.75m
    ry_ridge_min = -ridge_len
    ry_ridge_max = +ridge_len

    # Build Solid Watertight Roof Mesh
    roof_mesh = bpy.data.meshes.new("DORM_RoofMesh")
    bm = bmesh.new()

    # 4 Eave Corner Vertices
    v_fl = bm.verts.new((rx_min, ry_min, Z_EAVE)) # Front-Left
    v_fr = bm.verts.new((rx_max, ry_min, Z_EAVE)) # Front-Right
    v_rr = bm.verts.new((rx_max, ry_max, Z_EAVE)) # Rear-Right
    v_rl = bm.verts.new((rx_min, ry_max, Z_EAVE)) # Rear-Left

    # 2 Apex Ridge Vertices
    v_ridge_front = bm.verts.new((0.0, ry_ridge_min, Z_RIDGE))
    v_ridge_rear  = bm.verts.new((0.0, ry_ridge_max, Z_RIDGE))

    # 4 Hipped Slopes
    bm.faces.new((v_fl, v_fr, v_ridge_front)) # Front Triangle
    bm.faces.new((v_fr, v_rr, v_ridge_rear, v_ridge_front)) # Right Trapezoid
    bm.faces.new((v_rr, v_rl, v_ridge_rear)) # Rear Triangle
    bm.faces.new((v_rl, v_fl, v_ridge_front, v_ridge_rear)) # Left Trapezoid

    # Watertight Bottom Soffit Ceiling
    bm.faces.new((v_rl, v_rr, v_fr, v_fl))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(roof_mesh)
    bm.free()

    roof_obj = bpy.data.objects.new("DORM_Roof", roof_mesh)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.data.materials.append(mat_roof)
    roof_obj.parent = root

    # Fascia Boards around roof perimeter
    fascia_h = 0.22
    fascia_th = 0.04
    # Front Fascia
    create_box("DORM_Fascia_Front", (0.0, ry_min - fascia_th/2.0, Z_EAVE - fascia_h/2.0), (r_w, fascia_th, fascia_h), mat_fascia, root)
    # Rear Fascia
    create_box("DORM_Fascia_Rear", (0.0, ry_max + fascia_th/2.0, Z_EAVE - fascia_h/2.0), (r_w, fascia_th, fascia_h), mat_fascia, root)
    # Left Fascia
    create_box("DORM_Fascia_Left", (rx_min - fascia_th/2.0, 0.0, Z_EAVE - fascia_h/2.0), (fascia_th, r_d, fascia_h), mat_fascia, root)
    # Right Fascia
    create_box("DORM_Fascia_Right", (rx_max + fascia_th/2.0, 0.0, Z_EAVE - fascia_h/2.0), (fascia_th, r_d, fascia_h), mat_fascia, root)

    # 3D Hip Ridge Caps
    def create_ridge_cap(name, p1, p2, width=0.28, height=0.08):
        cap_mesh = bpy.data.meshes.new(name)
        bm_c = bmesh.new()
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        length = math.hypot(dx, dy)
        if length < 0.001:
            bm_c.free()
            return
        ux = dx / length
        uy = dy / length
        nx = -uy * (width / 2)
        ny =  ux * (width / 2)
        
        v1_l = bm_c.verts.new((p1[0] + nx, p1[1] + ny, p1[2] + 0.01))
        v1_r = bm_c.verts.new((p1[0] - nx, p1[1] - ny, p1[2] + 0.01))
        v1_p = bm_c.verts.new((p1[0],      p1[1],      p1[2] + height))
        
        v2_l = bm_c.verts.new((p2[0] + nx, p2[1] + ny, p2[2] + 0.01))
        v2_r = bm_c.verts.new((p2[0] - nx, p2[1] - ny, p2[2] + 0.01))
        v2_p = bm_c.verts.new((p2[0],      p2[1],      p2[2] + height))
        
        bm_c.faces.new((v1_l, v2_l, v2_p, v1_p))
        bm_c.faces.new((v1_p, v2_p, v2_r, v1_r))
        bm_c.faces.new((v1_l, v1_p, v1_r))
        bm_c.faces.new((v2_l, v2_r, v2_p))
        
        bmesh.ops.recalc_face_normals(bm_c, faces=bm_c.faces)
        bm_c.to_mesh(cap_mesh)
        bm_c.free()
        
        c_obj = bpy.data.objects.new(name, cap_mesh)
        bpy.context.scene.collection.objects.link(c_obj)
        c_obj.data.materials.append(mat_ridge)
        c_obj.parent = root

    # Main Apex Ridge Cap
    create_ridge_cap("DORM_Cap_Apex", (0.0, ry_ridge_min, Z_RIDGE), (0.0, ry_ridge_max, Z_RIDGE))
    # 4 Diagonal Hip Caps
    create_ridge_cap("DORM_Cap_Hip_FL", (rx_min, ry_min, Z_EAVE), (0.0, ry_ridge_min, Z_RIDGE))
    create_ridge_cap("DORM_Cap_Hip_FR", (rx_max, ry_min, Z_EAVE), (0.0, ry_ridge_min, Z_RIDGE))
    create_ridge_cap("DORM_Cap_Hip_RL", (rx_min, ry_max, Z_EAVE), (0.0, ry_ridge_max, Z_RIDGE))
    create_ridge_cap("DORM_Cap_Hip_RR", (rx_max, ry_max, Z_EAVE), (0.0, ry_ridge_max, Z_RIDGE))

    # White PVC Downspouts at Corners (IMG_3850)
    downspouts = [(rx_min, ry_min), (rx_max, ry_min), (rx_max, ry_max), (rx_min, ry_max)]
    for di, (dx, dy) in enumerate(downspouts):
        create_cylinder(f"DORM_Downspout_{di}", (dx, dy, Z_EAVE / 2.0), 0.04, Z_EAVE, mat_soffit, parent=root)

    # -------------------------------------------------------------
    # 9. PERFORMANCE OPTIMIZATION & GLB EXPORT
    # -------------------------------------------------------------
    print("--- Merging Meshes by Material for Web Performance ---")
    mat_map = {}
    mesh_children = [c for c in root.children if c.type == 'MESH']
    for c in mesh_children:
        m_name = c.data.materials[0].name if c.data.materials else "NoMat"
        if m_name not in mat_map:
            mat_map[m_name] = []
        mat_map[m_name].append(c)

    for m_name, objs in mat_map.items():
        if len(objs) > 1:
            bpy.ops.object.select_all(action='DESELECT')
            for o in objs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            bpy.ops.object.join()
            objs[0].name = f"DORM_{m_name}_Merged"

    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

    glb_out = TARGET_GLB
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"✅ Dormitory 3D Architectural Model Exported: {glb_out} ({file_size_kb:.1f} KB)")
    return root

build_dormitory_model()
