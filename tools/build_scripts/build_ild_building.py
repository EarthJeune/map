"""
build_ild_building.py — Authentic Bespoke 3D Architectural Model of the
Integrated Laboratories Division (ILD) Building (ild_building)
Department of Agriculture - Southern Tagalog Integrated Agricultural Research Center (DA-LARES)

Modeled strictly from ground-truth field photographs:
1. IMG_3864.jpg (Front-Left 3/4 Perspective):
   - Single-story modern laboratory building in fresh, saturated apple-green stucco finish.
   - Distinctive mono-pitch / shed roof design sloping down towards the North and West,
     with the high apex at the prominent South-East (Front-Left) corner column (5.15m height).
   - Deep overhanging roof eaves with crisp white soffits and pale slate-blue fascia boards.
   - Front entrance single-swing commercial wood door with horizontal slat pattern and
     official sign plate: "INTEGRATED LABORATORIES DIVISION (ILD)".
   - Black ribbed rubber grid doormat on the entrance stoop.
   - 2-panel dark bronze aluminum sliding windows with dark tinted glass.
   - Left end wall (facing South) with matching 2-panel sliding window.
   - Continuous horizontal architectural relief beam / lintel band running around the building.
2. IMG_3865.jpg (Front Facade & AC Installations):
   - Wall-mounted through-the-wall window AC units with front louvers and drainage catch basin.
   - Intermediate structural column with elevated outdoor split-type AC condenser enclosed
     inside a protective steel angle-iron security cage with vertical security bars.
   - Attached sloping corrugated metal canopy awning supported by diagonal steel cantilever struts.
   - High-voltage power connection insulators and conduit lines.

Strict constraints:
- File size budget <= 300 KB
- Strictly zero external turf slabs, outside trees, road slabs, or curbs
"""

import bpy
import bmesh
import math
import os

def create_mat(name, color, roughness=0.7, metallic=0.0, specular=0.5, alpha=1.0, emission_color=(0,0,0,1), emission_strength=0.0):
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    node_out = nodes.new(type='ShaderNodeOutputMaterial')
    node_principled = nodes.new(type='ShaderNodeBsdfPrincipled')
    
    c = (*color[:3], alpha)
    node_principled.inputs['Base Color'].default_value = c
    node_principled.inputs['Roughness'].default_value = roughness
    node_principled.inputs['Metallic'].default_value = metallic
    
    if alpha < 1.0:
        if 'Alpha' in node_principled.inputs:
            node_principled.inputs['Alpha'].default_value = alpha
        if hasattr(mat, 'blend_method'):
            mat.blend_method = 'BLEND'
            
    if 'Specular IOR Level' in node_principled.inputs:
        node_principled.inputs['Specular IOR Level'].default_value = specular
    elif 'Specular' in node_principled.inputs:
        node_principled.inputs['Specular'].default_value = specular

    if emission_strength > 0.0:
        if 'Emission Color' in node_principled.inputs:
            node_principled.inputs['Emission Color'].default_value = emission_color
        elif 'Emission' in node_principled.inputs:
            node_principled.inputs['Emission'].default_value = emission_color
        if 'Emission Strength' in node_principled.inputs:
            node_principled.inputs['Emission Strength'].default_value = emission_strength
        
    mat.node_tree.links.new(node_principled.outputs['BSDF'], node_out.inputs['Surface'])
    return mat

def create_box(name, loc, size, mat, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, loc, radius, depth, mat, segments=12, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=depth,
        vertices=segments,
        location=loc,
        rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_ild_building():
    print("====================================================")
    print(" Building Authentic 3D Model: ILD Building")
    print("====================================================")
    
    # Clean ALL old mesh/curve objects
    for obj in list(bpy.data.objects):
        if obj.type in ['MESH', 'CURVE', 'EMPTY', 'LIGHT', 'CAMERA']:
            bpy.data.objects.remove(obj, do_unlink=True)
            
    # Materials (curated authentic palette from ground-truth field photos)
    mat_wall_green       = create_mat("ILD_WallGreen",       (0.24, 0.65, 0.32), roughness=0.75) # Saturated apple green
    mat_wall_beam        = create_mat("ILD_WallBeam",        (0.19, 0.54, 0.26), roughness=0.70) # Horizontal relief band
    mat_plinth_concrete  = create_mat("ILD_PlinthConcrete",  (0.66, 0.68, 0.65), roughness=0.85) # Plinth base & stoop
    mat_fascia_blue      = create_mat("ILD_FasciaBlue",      (0.32, 0.48, 0.52), roughness=0.55) # Slate blue fascia trim
    mat_soffit_white     = create_mat("ILD_SoffitWhite",     (0.93, 0.94, 0.92), roughness=0.85) # Crisp white roof soffit
    mat_roof_metal       = create_mat("ILD_RoofMetal",       (0.44, 0.48, 0.52), roughness=0.45, metallic=0.35) # Galv metal roof
    mat_roof_rib         = create_mat("ILD_RoofRib",         (0.32, 0.36, 0.40), roughness=0.50, metallic=0.40) # Seam ribs
    mat_frame_bronze     = create_mat("ILD_FrameBronze",     (0.12, 0.11, 0.10), roughness=0.35, metallic=0.70) # Dark bronze frames
    mat_glass_tinted     = create_mat("ILD_GlassTinted",     (0.12, 0.16, 0.18), roughness=0.15, alpha=0.92) # Tinted window glass
    mat_door_wood        = create_mat("ILD_DoorWood",        (0.22, 0.13, 0.09), roughness=0.60) # Dark chocolate wood door
    mat_door_groove      = create_mat("ILD_DoorGroove",      (0.12, 0.08, 0.06), roughness=0.75) # Horizontal grooves
    mat_metal_chrome     = create_mat("ILD_MetalChrome",     (0.88, 0.88, 0.90), roughness=0.20, metallic=0.90) # Door lever handle
    mat_sign_white       = create_mat("ILD_SignWhite",       (0.96, 0.97, 0.96), roughness=0.30, emission_color=(0.96, 0.97, 0.96, 1.0), emission_strength=1.2) # Sign plate
    mat_sign_blue        = create_mat("ILD_SignBlue",        (0.06, 0.18, 0.48), roughness=0.40) # Official sign text
    mat_doormat_black    = create_mat("ILD_DoormatBlack",    (0.10, 0.10, 0.10), roughness=0.95) # Rubber grid doormat
    mat_ac_metal         = create_mat("ILD_ACMetal",         (0.90, 0.91, 0.89), roughness=0.45) # White AC body
    mat_ac_grille        = create_mat("ILD_ACGrille",        (0.22, 0.24, 0.25), roughness=0.65) # Louver intake grille
    mat_cage_dark        = create_mat("ILD_CageDark",        (0.16, 0.16, 0.16), roughness=0.55, metallic=0.80) # Steel security cage
    mat_awning_green     = create_mat("ILD_AwningGreen",     (0.48, 0.62, 0.38), roughness=0.55, metallic=0.20) # Sloping canopy
    mat_bracket_steel    = create_mat("ILD_BracketSteel",    (0.15, 0.15, 0.15), roughness=0.50, metallic=0.85) # Struts

    # Root Empty
    root = bpy.data.objects.new("ILD_Building_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # -----------------------------------------------------------------
    # Footprint Dimensions (from ground-truth roads.json & aerial geometry)
    # Length along X (East facade): 17.55m -> X in [-8.775, +8.775]
    # Width along Y (South flank):  10.33m -> Y in [-5.165, +5.165]
    # Front entrance facade is at Y = -5.165m
    # -----------------------------------------------------------------
    X_LEN = 17.55
    Y_WID = 10.33
    x_min, x_max = -X_LEN / 2.0, X_LEN / 2.0
    y_min, y_max = -Y_WID / 2.0, Y_WID / 2.0

    # Roof Plane Function:
    # High point at Front-Left (x_min, y_min) = 5.15m
    # Slopes down along X by 1.30m over 17.55m
    # Slopes down along Y by 1.00m over 10.33m
    Z_PEAK = 5.15
    SLOPE_X = -1.30 / X_LEN
    SLOPE_Y = -1.00 / Y_WID

    def get_roof_z(x, y):
        return Z_PEAK + SLOPE_X * (x - x_min) + SLOPE_Y * (y - y_min)

    # -----------------------------------------------------------------
    # 1. Concrete Foundation Plinth Base
    # -----------------------------------------------------------------
    plinth_h = 0.15
    create_box(
        "ILD_Plinth_Base",
        (0.0, 0.0, plinth_h / 2.0),
        (X_LEN + 0.12, Y_WID + 0.12, plinth_h),
        mat_plinth_concrete,
        root
    )

    # -----------------------------------------------------------------
    # 2. Exterior Walls (Constructed with exact sloping top profile)
    # -----------------------------------------------------------------
    bm_wall = bmesh.new()
    wall_mesh = bpy.data.meshes.new("ILD_Walls_Mesh")

    # Lower boundary vertices (at Z = plinth_h)
    v_fl_b = bm_wall.verts.new((x_min, y_min, plinth_h))
    v_fr_b = bm_wall.verts.new((x_max, y_min, plinth_h))
    v_br_b = bm_wall.verts.new((x_max, y_max, plinth_h))
    v_bl_b = bm_wall.verts.new((x_min, y_max, plinth_h))

    # Upper boundary vertices (at wall top beneath roof soffit)
    v_fl_t = bm_wall.verts.new((x_min, y_min, get_roof_z(x_min, y_min)))
    v_fr_t = bm_wall.verts.new((x_max, y_min, get_roof_z(x_max, y_min)))
    v_br_t = bm_wall.verts.new((x_max, y_max, get_roof_z(x_max, y_max)))
    v_bl_t = bm_wall.verts.new((x_min, y_max, get_roof_z(x_min, y_max)))

    # Faces
    bm_wall.faces.new((v_fl_b, v_fr_b, v_fr_t, v_fl_t)) # Front Wall (Y = y_min)
    bm_wall.faces.new((v_fr_b, v_br_b, v_br_t, v_fr_t)) # Right Wall (X = x_max)
    bm_wall.faces.new((v_br_b, v_bl_b, v_bl_t, v_br_t)) # Back Wall (Y = y_max)
    bm_wall.faces.new((v_bl_b, v_fl_b, v_fl_t, v_bl_t)) # Left Wall (X = x_min)
    bm_wall.faces.new((v_fl_t, v_fr_t, v_br_t, v_bl_t)) # Ceiling Cap

    bm_wall.to_mesh(wall_mesh)
    bm_wall.free()
    wall_obj = bpy.data.objects.new("ILD_Main_Walls", wall_mesh)
    bpy.context.scene.collection.objects.link(wall_obj)
    wall_obj.data.materials.append(mat_wall_green)
    wall_obj.parent = root

    # -----------------------------------------------------------------
    # 3. Horizontal Relief Belt / Lintel Band (Photo: Horizontal line)
    # -----------------------------------------------------------------
    beam_z = 2.45
    beam_h = 0.12
    beam_d = 0.05
    create_box("ILD_Relief_Front", (0.0, y_min - beam_d/2.0, beam_z), (X_LEN + 0.02, beam_d, beam_h), mat_wall_beam, root)
    create_box("ILD_Relief_Left", (x_min - beam_d/2.0, 0.0, beam_z), (beam_d, Y_WID + 0.02, beam_h), mat_wall_beam, root)
    create_box("ILD_Relief_Right", (x_max + beam_d/2.0, 0.0, beam_z), (beam_d, Y_WID + 0.02, beam_h), mat_wall_beam, root)
    create_box("ILD_Relief_Back", (0.0, y_max + beam_d/2.0, beam_z), (X_LEN + 0.02, beam_d, beam_h), mat_wall_beam, root)

    # -----------------------------------------------------------------
    # 4. Prominent Structural Columns / Pilasters
    # -----------------------------------------------------------------
    col_w = 0.42
    col_proj = 0.14
    
    def add_corner_pilaster(name, cx, cy):
        top_z = get_roof_z(cx, cy)
        h = top_z - plinth_h
        mid_z = plinth_h + h / 2.0
        ox = math.copysign(col_proj / 2.0, cx)
        oy = math.copysign(col_proj / 2.0, cy)
        create_box(name, (cx + ox, cy + oy, mid_z), (col_w, col_w, h), mat_wall_green, root)

    add_corner_pilaster("ILD_Col_FrontLeft",  x_min, y_min) # High apex corner!
    add_corner_pilaster("ILD_Col_FrontRight", x_max, y_min)
    add_corner_pilaster("ILD_Col_BackRight",  x_max, y_max)
    add_corner_pilaster("ILD_Col_BackLeft",   x_min, y_max)

    # Intermediate Column on Front Facade (at X = +0.80m, supports AC cage)
    mid_col_x = 0.80
    mid_col_z = get_roof_z(mid_col_x, y_min)
    mid_col_h = mid_col_z - plinth_h
    create_box(
        "ILD_Col_FrontMid",
        (mid_col_x, y_min - col_proj / 2.0, plinth_h + mid_col_h / 2.0),
        (col_w, col_proj * 2.0, mid_col_h),
        mat_wall_green,
        root
    )

    # Intermediate Column on Back Facade (at X = +0.80m)
    mid_back_z = get_roof_z(mid_col_x, y_max)
    mid_back_h = mid_back_z - plinth_h
    create_box(
        "ILD_Col_BackMid",
        (mid_col_x, y_max + col_proj / 2.0, plinth_h + mid_back_h / 2.0),
        (col_w, col_proj * 2.0, mid_back_h),
        mat_wall_green,
        root
    )

    # -----------------------------------------------------------------
    # 5. Overhanging Mono-Pitch Roof (Soffit, Fascia, Metal Surface & Ribs)
    # -----------------------------------------------------------------
    eave_overhang = 0.78
    rx_min = x_min - eave_overhang
    rx_max = x_max + eave_overhang
    ry_min = y_min - eave_overhang
    ry_max = y_max + eave_overhang

    roof_slab_t = 0.08

    # Create Roof Mesh
    bm_roof = bmesh.new()
    roof_mesh = bpy.data.meshes.new("ILD_Roof_Mesh")

    # Soffit (bottom of roof slab)
    v_rf_fl_b = bm_roof.verts.new((rx_min, ry_min, get_roof_z(rx_min, ry_min)))
    v_rf_fr_b = bm_roof.verts.new((rx_max, ry_min, get_roof_z(rx_max, ry_min)))
    v_rf_br_b = bm_roof.verts.new((rx_max, ry_max, get_roof_z(rx_max, ry_max)))
    v_rf_bl_b = bm_roof.verts.new((rx_min, ry_max, get_roof_z(rx_min, ry_max)))

    # Roof Top (offset upward along Z by roof_slab_t)
    v_rf_fl_t = bm_roof.verts.new((rx_min, ry_min, get_roof_z(rx_min, ry_min) + roof_slab_t))
    v_rf_fr_t = bm_roof.verts.new((rx_max, ry_min, get_roof_z(rx_max, ry_min) + roof_slab_t))
    v_rf_br_t = bm_roof.verts.new((rx_max, ry_max, get_roof_z(rx_max, ry_max) + roof_slab_t))
    v_rf_bl_t = bm_roof.verts.new((rx_min, ry_max, get_roof_z(rx_min, ry_max) + roof_slab_t))

    bm_roof.faces.new((v_rf_fl_b, v_rf_bl_b, v_rf_br_b, v_rf_fr_b)) # Bottom soffit (0)
    bm_roof.faces.new((v_rf_fl_t, v_rf_fr_t, v_rf_br_t, v_rf_bl_t)) # Top metal sheet (1)
    bm_roof.faces.new((v_rf_fl_b, v_rf_fr_b, v_rf_fr_t, v_rf_fl_t)) # Front eave face (2)
    bm_roof.faces.new((v_rf_fr_b, v_rf_br_b, v_rf_br_t, v_rf_fr_t)) # Right eave face (3)
    bm_roof.faces.new((v_rf_br_b, v_rf_bl_b, v_rf_bl_t, v_rf_br_t)) # Back eave face (4)
    bm_roof.faces.new((v_rf_bl_b, v_rf_fl_b, v_rf_fl_t, v_rf_bl_t)) # Left eave face (5)

    bm_roof.to_mesh(roof_mesh)
    bm_roof.free()
    roof_obj = bpy.data.objects.new("ILD_Roof_Slab", roof_mesh)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.data.materials.append(mat_roof_metal)    # slot 0
    roof_obj.data.materials.append(mat_soffit_white)   # slot 1
    roof_obj.data.materials.append(mat_fascia_blue)    # slot 2
    
    # Assign slot indices
    roof_obj.data.polygons[0].material_index = 1 # Soffit white
    roof_obj.data.polygons[1].material_index = 0 # Top metal
    roof_obj.data.polygons[2].material_index = 2 # Front fascia
    roof_obj.data.polygons[3].material_index = 2 # Right fascia
    roof_obj.data.polygons[4].material_index = 2 # Back fascia
    roof_obj.data.polygons[5].material_index = 2 # Left fascia
    roof_obj.parent = root

    # Standing Seam Ribs running along the slope flush against the roof surface
    rib_spacing = 0.85
    num_ribs = int((rx_max - rx_min) / rib_spacing)
    dy = ry_max - ry_min
    dz = SLOPE_Y * dy
    rib_len = math.hypot(dy, dz)
    pitch_angle = math.atan2(dz, dy) # negative angle (slopes down towards back)
    roll_angle = -math.atan2(SLOPE_X, 1.0) # compensates for slope along X

    for i in range(1, num_ribs):
        rib_x = rx_min + i * rib_spacing
        if rib_x >= rx_max - 0.10:
            continue
        mid_z = get_roof_z(rib_x, 0.0) + roof_slab_t + 0.015
        rib_obj = create_box(
            f"ILD_Roof_Rib_{i}",
            (rib_x, 0.0, mid_z),
            (0.025, rib_len, 0.03),
            mat_roof_rib,
            root
        )
        rib_obj.rotation_euler = (pitch_angle, roll_angle, 0.0)

    # -----------------------------------------------------------------
    # 6. Main Entrance Door & Signage (Front Facade near Front-Left)
    # -----------------------------------------------------------------
    door_x = -7.15
    door_w = 1.05
    door_h = 2.15
    door_z = plinth_h + door_h / 2.0

    # Door Frame (Dark Bronze)
    create_box(
        "ILD_Door_Frame",
        (door_x, y_min - 0.01, door_z),
        (door_w + 0.08, 0.08, door_h + 0.06),
        mat_frame_bronze,
        root
    )

    # Door Panel (Dark chocolate wood with horizontal slat grooves)
    create_box(
        "ILD_Door_Panel",
        (door_x, y_min - 0.02, door_z),
        (door_w, 0.05, door_h),
        mat_door_wood,
        root
    )

    # Horizontal grooves on door panel (4 horizontal groove strips)
    for gi in range(1, 5):
        gz = plinth_h + gi * (door_h / 5.0)
        create_box(
            f"ILD_Door_Groove_{gi}",
            (door_x, y_min - 0.035, gz),
            (door_w - 0.04, 0.015, 0.015),
            mat_door_groove,
            root
        )

    # Door Lever Handle (Stainless steel, at Z = 1.05m)
    create_cylinder(
        "ILD_Door_KnobStem",
        (door_x + door_w / 2.0 - 0.12, y_min - 0.06, plinth_h + 1.05),
        radius=0.015, depth=0.06,
        mat=mat_metal_chrome,
        rot=(math.radians(90), 0, 0),
        parent=root
    )
    create_box(
        "ILD_Door_Lever",
        (door_x + door_w / 2.0 - 0.07, y_min - 0.09, plinth_h + 1.05),
        (0.12, 0.02, 0.025),
        mat_metal_chrome,
        root
    )

    # Official Sign Plate: "INTEGRATED LABORATORIES DIVISION (ILD)"
    sign_w = 0.44
    sign_h = 0.28
    sign_z = plinth_h + 1.48
    create_box(
        "ILD_Door_SignPlate",
        (door_x, y_min - 0.038, sign_z),
        (sign_w, 0.015, sign_h),
        mat_sign_white,
        root
    )
    create_box(
        "ILD_Door_SignBorder",
        (door_x, y_min - 0.046, sign_z),
        (sign_w - 0.04, 0.005, sign_h - 0.04),
        mat_sign_blue,
        root
    )
    create_box(
        "ILD_Door_SignInner",
        (door_x, y_min - 0.048, sign_z),
        (sign_w - 0.06, 0.005, sign_h - 0.06),
        mat_sign_white,
        root
    )

    # Entrance Doormat (Black rubber grid doormat on concrete walkway)
    create_box(
        "ILD_Entrance_Doormat",
        (door_x, y_min - 0.45, plinth_h + 0.01),
        (0.95, 0.65, 0.02),
        mat_doormat_black,
        root
    )

    # -----------------------------------------------------------------
    # 7. Sliding Aluminum Windows
    # -----------------------------------------------------------------
    def add_window(name, wx, wy, wz, ww, wh, is_front=True):
        f_thick = 0.06
        if is_front:
            create_box(f"{name}_Frame", (wx, wy - 0.01, wz), (ww, f_thick, wh), mat_frame_bronze, root)
            pw = ww / 2.0 - 0.02
            create_box(f"{name}_PaneL", (wx - ww / 4.0, wy - 0.01, wz), (pw, 0.03, wh - 0.04), mat_frame_bronze, root)
            create_box(f"{name}_GlassL", (wx - ww / 4.0, wy - 0.01, wz), (pw - 0.06, 0.015, wh - 0.10), mat_glass_tinted, root)
            create_box(f"{name}_PaneR", (wx + ww / 4.0, wy, wz), (pw, 0.03, wh - 0.04), mat_frame_bronze, root)
            create_box(f"{name}_GlassR", (wx + ww / 4.0, wy, wz), (pw - 0.06, 0.015, wh - 0.10), mat_glass_tinted, root)
            create_box(f"{name}_Sill", (wx, wy - 0.05, wz - wh / 2.0 - 0.02), (ww + 0.10, 0.12, 0.04), mat_plinth_concrete, root)
        else:
            create_box(f"{name}_Frame", (wx - 0.01, wy, wz), (f_thick, ww, wh), mat_frame_bronze, root)
            pw = ww / 2.0 - 0.02
            create_box(f"{name}_PaneL", (wx - 0.01, wy - ww / 4.0, wz), (0.03, pw, wh - 0.04), mat_frame_bronze, root)
            create_box(f"{name}_GlassL", (wx - 0.01, wy - ww / 4.0, wz), (0.015, pw - 0.06, wh - 0.10), mat_glass_tinted, root)
            create_box(f"{name}_PaneR", (wx, wy + ww / 4.0, wz), (0.03, pw, wh - 0.04), mat_frame_bronze, root)
            create_box(f"{name}_GlassR", (wx, wy + ww / 4.0, wz), (0.015, pw - 0.06, wh - 0.10), mat_glass_tinted, root)
            create_box(f"{name}_Sill", (wx - 0.05, wy, wz - wh / 2.0 - 0.02), (0.12, ww + 0.10, 0.04), mat_plinth_concrete, root)

    win_w, win_h = 1.45, 1.25
    win_z = plinth_h + 1.65

    # Front Windows (Y = y_min)
    add_window("ILD_Win_F1", -5.10, y_min, win_z, win_w, win_h, is_front=True) # Next to door
    add_window("ILD_Win_F2", -1.40, y_min, win_z, win_w, win_h, is_front=True) # Before mid column
    add_window("ILD_Win_F3",  3.10, y_min, win_z, win_w, win_h, is_front=True) # Past mid column
    add_window("ILD_Win_F4",  6.20, y_min, win_z, win_w, win_h, is_front=True) # Far front

    # Left Window (South Wall, X = x_min)
    add_window("ILD_Win_Left", x_min, 0.0, win_z, win_w, win_h, is_front=False)

    # Back Windows (Y = y_max)
    for bi, bx in enumerate([-5.10, -1.40, 3.10, 6.20]):
        create_box(f"ILD_Win_B{bi}_Frame", (bx, y_max + 0.01, win_z), (win_w, 0.06, win_h), mat_frame_bronze, root)
        create_box(f"ILD_Win_B{bi}_Glass", (bx, y_max + 0.01, win_z), (win_w - 0.08, 0.02, win_h - 0.08), mat_glass_tinted, root)

    # -----------------------------------------------------------------
    # 8. Air Conditioning Units & Protective Steel Security Cage
    # -----------------------------------------------------------------
    def add_window_ac(name, ac_x, ac_y, ac_z):
        ac_w, ac_h, ac_d = 0.68, 0.44, 0.58
        create_box(f"{name}_Body", (ac_x, ac_y - ac_d / 2.0, ac_z), (ac_w, ac_d, ac_h), mat_ac_metal, root)
        create_box(f"{name}_Grille", (ac_x, ac_y - ac_d - 0.005, ac_z), (ac_w - 0.06, 0.01, ac_h - 0.06), mat_ac_grille, root)
        create_cylinder(f"{name}_Pipe", (ac_x + ac_w / 2.0 - 0.05, ac_y - 0.04, (ac_z - ac_h / 2.0 + plinth_h) / 2.0), 0.012, (ac_z - ac_h / 2.0 - plinth_h), mat_ac_metal, parent=root)

    # Window AC 1 (between Win_F1 and Win_F2)
    add_window_ac("ILD_AC_Unit1", -3.25, y_min, plinth_h + 1.70)
    create_box("ILD_AC1_CatchBasin", (-3.25, y_min - 0.35, plinth_h + 0.06), (0.35, 0.30, 0.12), mat_plinth_concrete, root)

    # Window AC 2 (at X = +4.70m)
    add_window_ac("ILD_AC_Unit2", 4.70, y_min, plinth_h + 1.70)

    # Split-Type AC Condenser inside Protective Steel Security Cage (Mounted on mid column)
    cage_x = mid_col_x
    cage_y = y_min - col_proj
    cage_z = plinth_h + 2.50
    cage_w, cage_h, cage_d = 0.95, 0.72, 0.52

    # Cage outer framing (Steel angles)
    # Top & bottom rims
    create_box("ILD_ACCage_TopRim", (cage_x, cage_y - cage_d / 2.0, cage_z + cage_h / 2.0), (cage_w, cage_d, 0.04), mat_cage_dark, root)
    create_box("ILD_ACCage_BotRim", (cage_x, cage_y - cage_d / 2.0, cage_z - cage_h / 2.0), (cage_w, cage_d, 0.04), mat_cage_dark, root)
    # 4 Corner angle posts
    for cx in [-cage_w/2.0 + 0.02, cage_w/2.0 - 0.02]:
        for cy in [-0.02, -cage_d + 0.02]:
            create_box(f"ILD_ACCage_Post_{cx:.2f}_{cy:.2f}", (cage_x + cx, cage_y + cy, cage_z), (0.04, 0.04, cage_h), mat_cage_dark, root)
    # Vertical security bars along front face
    num_bars = 7
    for bi in range(1, num_bars):
        bx = -cage_w/2.0 + bi * (cage_w / num_bars)
        create_cylinder(f"ILD_ACCage_Bar_{bi}", (cage_x + bx, cage_y - cage_d + 0.02, cage_z), 0.008, cage_h - 0.08, mat_cage_dark, segments=8, parent=root)

    # Inner AC Condenser Unit
    create_box("ILD_ACCage_Condenser", (cage_x, cage_y - cage_d / 2.0, cage_z), (cage_w - 0.16, cage_d - 0.14, cage_h - 0.14), mat_ac_metal, root)
    create_cylinder(
        "ILD_ACCage_Fan",
        (cage_x + 0.10, cage_y - cage_d + 0.08, cage_z),
        radius=0.18, depth=0.03,
        mat=mat_ac_grille,
        rot=(math.radians(90), 0, 0),
        parent=root
    )
    # Diagonal wall mounting brackets
    create_box("ILD_ACCage_BracketL", (cage_x - cage_w / 2.0 + 0.06, cage_y - cage_d / 2.0, cage_z - cage_h / 2.0 - 0.18), (0.04, cage_d * 0.8, 0.36), mat_bracket_steel, root)
    create_box("ILD_ACCage_BracketR", (cage_x + cage_w / 2.0 - 0.06, cage_y - cage_d / 2.0, cage_z - cage_h / 2.0 - 0.18), (0.04, cage_d * 0.8, 0.36), mat_bracket_steel, root)

    # -----------------------------------------------------------------
    # 9. Attached Cantilevered Canopy / Awning (North end of Front Facade)
    # -----------------------------------------------------------------
    awn_x_min = 6.80
    awn_x_max = 8.75
    awn_w = awn_x_max - awn_x_min
    awn_proj = 1.35
    awn_z_wall = plinth_h + 3.10
    awn_z_edge = plinth_h + 2.45
    awn_mid_z = (awn_z_wall + awn_z_edge) / 2.0
    awn_len = math.hypot(awn_proj, awn_z_wall - awn_z_edge)
    awn_pitch = math.atan2(awn_z_wall - awn_z_edge, awn_proj)

    awn_obj = create_box(
        "ILD_Awning_Roof",
        ((awn_x_min + awn_x_max) / 2.0, y_min - awn_proj / 2.0, awn_mid_z),
        (awn_w, awn_len, 0.04),
        mat_awning_green,
        root
    )
    awn_obj.rotation_euler = (awn_pitch, 0, 0)

    # Corrugated ribs on awning
    for ai in range(5):
        ax = awn_x_min + 0.15 + ai * ((awn_w - 0.30) / 4.0)
        create_box(
            f"ILD_Awning_Rib_{ai}",
            (ax, y_min - awn_proj / 2.0, awn_mid_z + 0.015),
            (0.02, awn_len, 0.02),
            mat_roof_rib,
            root
        ).rotation_euler = (awn_pitch, 0, 0)

    # Diagonal support steel struts
    for sx in [awn_x_min + 0.20, awn_x_max - 0.20]:
        create_box(
            f"ILD_Awning_Strut_{sx:.1f}",
            (sx, y_min - awn_proj / 2.0, awn_mid_z - 0.20),
            (0.04, awn_len * 0.9, 0.04),
            mat_bracket_steel,
            root
        ).rotation_euler = (awn_pitch, 0, 0)

    # -----------------------------------------------------------------
    # 10. WebGL GLB Export
    # -----------------------------------------------------------------
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    
    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\ild_building.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"Exported ILD Building GLB to {glb_out} (Size: {file_size_kb:.1f} KB)")
    return root

build_ild_building()
