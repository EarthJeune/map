"""
build_plot17_screenhouse_1.py — Authentic Bespoke 3D Model of DA-LARES Screenhouse 1 (Plot 17)

Phase 1 of Plots 17 & 18 Screenhouse 3D Modeling Plan (docs/screenhouses_3d_modeling_plan.md)

Ground-Truth Architectural & Spatial Survey:
- Polygon Feature #30 in buildings.json:
  Center: [121.16731230, 13.95915280], Mapbox rotation: 69.8 deg clockwise.
  Dimensions: Width = 6.31 m (local X in [-3.155, +3.155]), Length = 18.86 m (local Y in [-9.43, +9.43])
- Elevation:
  Lower concrete footing slab: H = 0.25 m
  Upper concrete curb wall: H = 0.40 m (total foundation height Z = 0.65 m)
  Eave horizontal beam height: Z = 2.10 m
  Barrel hoop arch apex ridge: Z = 3.85 m
- Facade Orientations (with rotation = 69.8°):
  - Front entrance (-Y facade, Y = -9.43): faces WSW toward compound access road (Road 21).
    Features center aluminum sliding screen door, stepped concrete entrance stoop, inner arch truss.
  - Rear wall (+Y facade, Y = +9.43): faces ENE toward rear plot boundary.
  - Left flank (-X side, X = -3.155): faces NNW toward open alley / lawn (IMG "1 Left Side View.jpg").
  - Right flank (+X side, X = +3.155): faces SSE toward Screenhouse 2 (IMG "1 Left 2 Right.jpg").
- Interior (IMG "1 Inside View.jpg"):
  - 1.3m central walkway aisle on black weed barrier mat.
  - Left & Right raised NFT hydroponic propagation tables with 6 white PVC growing channels each.
  - Blue PVC supply risers, valves, and manifold lines.
  - Horizontal black shade cloth ceiling at eave level.
"""

import bpy
import bmesh
import math
import os

TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot17_screenhouse_1.glb"

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)
    for block in bpy.data.curves:
        bpy.data.curves.remove(block)

def get_or_create_material(name, base_color, roughness=0.6, metallic=0.0, alpha=1.0, blend_mode='OPAQUE'):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    if blend_mode != 'OPAQUE':
        mat.blend_method = blend_mode
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = base_color
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        if 'Alpha' in bsdf.inputs:
            bsdf.inputs['Alpha'].default_value = alpha
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

def create_cylinder(name, loc, radius, depth, rot=(0, 0, 0), mat=None, parent=None, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_pipe_along_polyline(name, points, radius=0.022, mat=None, parent=None, resolution=2):
    """Creates a smooth tubular pipe along a sequence of (x, y, z) points using a Blender Curve."""
    curve_data = bpy.data.curves.new(name=f"{name}_curve", type='CURVE')
    curve_data.dimensions = '3D'
    curve_data.fill_mode = 'FULL'
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = resolution
    
    polyline = curve_data.splines.new('POLY')
    polyline.points.add(len(points) - 1)
    for i, pt in enumerate(points):
        polyline.points[i].co = (pt[0], pt[1], pt[2], 1.0)
        
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    
    # Convert curve to mesh for consistent joining and GLB export
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_barrel_mesh(name, half_w, length_y, z_eave, z_apex, y_start, y_end, mat=None, parent=None, x_segs=16, y_segs=10):
    """Generates a curved barrel roof mesh with smooth outward normals."""
    rise = z_apex - z_eave
    R = (rise**2 + half_w**2) / (2.0 * rise)
    center_z = z_apex - R
    theta_max = math.asin(half_w / R)

    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    verts = []
    length = y_end - y_start
    y_step = length / y_segs

    for j in range(y_segs + 1):
        cur_y = y_start + j * y_step
        for i in range(x_segs + 1):
            t = -theta_max + 2.0 * theta_max * (i / x_segs)
            vx = R * math.sin(t)
            vz = center_z + R * math.cos(t)
            verts.append((vx, cur_y, vz))

    faces = []
    for j in range(y_segs):
        for i in range(x_segs):
            v0 = j * (x_segs + 1) + i
            v1 = j * (x_segs + 1) + (i + 1)
            v2 = (j + 1) * (x_segs + 1) + (i + 1)
            v3 = (j + 1) * (x_segs + 1) + i
            faces.append((v0, v1, v2, v3))

    mesh.from_pydata(verts, [], faces)
    mesh.update()

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(mesh)
    bm.free()

    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_plot17_screenhouse_1():
    print("=" * 60)
    print("BUILDING AUTHENTIC DA-LARES PLOT 17 SCREENHOUSE 1 (Phase 1)")
    print("=" * 60)

    clear_scene()

    # 1. PBR Materials (Calibrated strictly to field photographs)
    # Concrete base plinth footing (dark weathered concrete with dirt/moss patina)
    mat_concrete_dark = get_or_create_material("SH1_ConcreteFooting", (0.42, 0.43, 0.41, 1.0), roughness=0.90, metallic=0.0)
    # Concrete upper curb wall (weathered grey stucco finish)
    mat_concrete_curb = get_or_create_material("SH1_ConcreteCurb", (0.58, 0.58, 0.55, 1.0), roughness=0.85, metallic=0.0)
    # Interior black ground weed barrier mat
    mat_weed_mat = get_or_create_material("SH1_WeedBarrierMat", (0.18, 0.17, 0.16, 1.0), roughness=0.92, metallic=0.0)
    # Structural galvanized steel pipes and beams
    mat_steel = get_or_create_material("SH1_GalvanizedSteel", (0.64, 0.67, 0.70, 1.0), roughness=0.35, metallic=0.85)
    # Bright silver aluminum for door frame & eave channels
    mat_aluminum = get_or_create_material("SH1_AluminumFrame", (0.82, 0.84, 0.85, 1.0), roughness=0.30, metallic=0.75)
    # Translucent white agricultural insect netting (fine mesh, semi-transparent in daylight)
    mat_insect_net = get_or_create_material("SH1_InsectNettingWhite", (0.94, 0.96, 0.95, 0.45), roughness=0.55, metallic=0.05, alpha=0.45, blend_mode='BLEND')
    # Weathered side mesh (slightly darker/patinated mesh along flanks)
    mat_side_net = get_or_create_material("SH1_InsectNettingSide", (0.68, 0.72, 0.69, 0.55), roughness=0.60, metallic=0.05, alpha=0.55, blend_mode='BLEND')
    # Internal black ceiling shade cloth (IMG "1 Inside View.jpg")
    mat_shade_cloth = get_or_create_material("SH1_CeilingShadeNet", (0.15, 0.16, 0.15, 0.72), roughness=0.85, metallic=0.0, alpha=0.72, blend_mode='BLEND')
    # Hydroponic NFT white PVC channels (gullies)
    mat_nft_pvc = get_or_create_material("SH1_NftChannelsWhite", (0.92, 0.93, 0.93, 1.0), roughness=0.25, metallic=0.05)
    # Fresh green seedling sprouts emerging from NFT channels
    mat_seedlings = get_or_create_material("SH1_SeedlingGreenery", (0.28, 0.56, 0.18, 1.0), roughness=0.50, metallic=0.0)
    # Blue PVC irrigation supply pipes and risers
    mat_blue_pvc = get_or_create_material("SH1_BluePvcIrrigation", (0.08, 0.38, 0.78, 1.0), roughness=0.25, metallic=0.1)

    root = bpy.data.objects.new("Plot17_Screenhouse_1_Root", None)
    bpy.context.collection.objects.link(root)

    # -------------------------------------------------------------
    # SPATIAL DIMENSIONS (Hand-Drawn Polygon #30 in buildings.json)
    # -------------------------------------------------------------
    WIDTH = 6.31
    LENGTH = 18.86
    HALF_W = WIDTH / 2.0   # 3.155 m
    HALF_L = LENGTH / 2.0  # 9.43 m

    FOOTING_H = 0.25       # Lower concrete plinth step
    CURB_H = 0.65          # Upper curb top height
    CURB_THICK = 0.16      # Curb wall thickness
    CURB_HALF_W = HALF_W - 0.15  # 3.005 m
    CURB_HALF_L = HALF_L - 0.15  # 9.28 m

    EAVE_Z = 2.10          # Horizontal eave beam height
    APEX_Z = 3.85          # Roof apex ridge height
    DOOR_W = 1.02          # Center sliding screen door width
    HALF_DW = DOOR_W / 2.0 # 0.51 m

    # -------------------------------------------------------------
    # 2. FOUNDATION: Two-Tier Concrete Plinth & Stepped Entrance Stoop
    # -------------------------------------------------------------
    # A. Lower Concrete Footing Slab (Tier 1: full polygon footprint, Z = 0 to 0.25m)
    create_box("SH1_Footing_Main",
               (0.0, 0.0, FOOTING_H / 2.0),
               (WIDTH, LENGTH, FOOTING_H),
               mat=mat_concrete_dark, parent=root)

    # Extended Front Concrete Entrance Steps (IMG "1 Front View.jpg" & "1 Left Side View.jpg")
    # Step 1 (Lower apron step): extends 0.50m forward
    create_box("SH1_EntranceStep_Lower",
               (0.0, -HALF_L - 0.25, 0.12),
               (2.40, 0.50, 0.12),
               mat=mat_concrete_dark, parent=root)
    # Step 2 (Upper stoop landing): extends 0.25m forward
    create_box("SH1_EntranceStep_Upper",
               (0.0, -HALF_L - 0.125, 0.12 + 0.12 / 2.0),
               (1.80, 0.25, 0.12),
               mat=mat_concrete_curb, parent=root)

    # B. Upper Concrete Curb Wall (Tier 2: set inward by 15cm, Z = 0.25m to 0.65m)
    curb_wall_h = CURB_H - FOOTING_H # 0.40 m
    curb_cz = FOOTING_H + curb_wall_h / 2.0

    # Left Curb Wall (-X, North flank)
    create_box("SH1_Curb_Left",
               (-CURB_HALF_W + CURB_THICK / 2.0, 0.0, curb_cz),
               (CURB_THICK, 2 * CURB_HALF_L, curb_wall_h),
               mat=mat_concrete_curb, parent=root)

    # Right Curb Wall (+X, South flank)
    create_box("SH1_Curb_Right",
               (CURB_HALF_W - CURB_THICK / 2.0, 0.0, curb_cz),
               (CURB_THICK, 2 * CURB_HALF_L, curb_wall_h),
               mat=mat_concrete_curb, parent=root)

    # Rear Curb Wall (+Y, East end)
    create_box("SH1_Curb_Rear",
               (0.0, CURB_HALF_L - CURB_THICK / 2.0, curb_cz),
               (2 * CURB_HALF_W, CURB_THICK, curb_wall_h),
               mat=mat_concrete_curb, parent=root)

    # Front Curb Wall (-Y, West entrance facade): Split into Left & Right Wings with Center Doorway
    front_wing_w = CURB_HALF_W - HALF_DW
    # Front Left Wing
    create_box("SH1_Curb_FrontLeft",
               (-HALF_DW - front_wing_w / 2.0, -CURB_HALF_L + CURB_THICK / 2.0, curb_cz),
               (front_wing_w, CURB_THICK, curb_wall_h),
               mat=mat_concrete_curb, parent=root)
    # Front Right Wing
    create_box("SH1_Curb_FrontRight",
               (HALF_DW + front_wing_w / 2.0, -CURB_HALF_L + CURB_THICK / 2.0, curb_cz),
               (front_wing_w, CURB_THICK, curb_wall_h),
               mat=mat_concrete_curb, parent=root)

    # Entrance Door Threshold Sill inside opening (H = 0.38m, raised threshold)
    create_box("SH1_DoorThresholdSill",
               (0.0, -CURB_HALF_L + CURB_THICK / 2.0, FOOTING_H + 0.12 / 2.0),
               (DOOR_W + 0.04, CURB_THICK, 0.12),
               mat=mat_concrete_curb, parent=root)

    # Interior Floor: Black weed barrier mat covering ground inside curb walls
    create_box("SH1_WeedMatFloor",
               (0.0, 0.0, FOOTING_H + 0.01),
               (2 * CURB_HALF_W - 2 * CURB_THICK, 2 * CURB_HALF_L - 2 * CURB_THICK, 0.02),
               mat=mat_weed_mat, parent=root)

    # -------------------------------------------------------------
    # 3. STRUCTURAL FRAMING: Continuous Eave Beam, Hoop Arches & Gable Trusses
    # -------------------------------------------------------------
    # A. Perimeter Horizontal Eave Beam (C-channel / Box girder at Z = 2.10m)
    beam_w = 0.06
    beam_h = 0.08
    # Front Horizontal Eave Beam
    create_box("SH1_EaveBeam_Front",
               (0.0, -CURB_HALF_L, EAVE_Z),
               (2 * CURB_HALF_W + 0.08, beam_w, beam_h),
               mat=mat_aluminum, parent=root)
    # Rear Horizontal Eave Beam
    create_box("SH1_EaveBeam_Rear",
               (0.0, CURB_HALF_L, EAVE_Z),
               (2 * CURB_HALF_W + 0.08, beam_w, beam_h),
               mat=mat_aluminum, parent=root)
    # Left Horizontal Eave Beam
    create_box("SH1_EaveBeam_Left",
               (-CURB_HALF_W, 0.0, EAVE_Z),
               (beam_w, 2 * CURB_HALF_L, beam_h),
               mat=mat_aluminum, parent=root)
    # Right Horizontal Eave Beam
    create_box("SH1_EaveBeam_Right",
               (CURB_HALF_W, 0.0, EAVE_Z),
               (beam_w, 2 * CURB_HALF_L, beam_h),
               mat=mat_aluminum, parent=root)

    # Base Wiggle-Wire Aluminum Base Trim above concrete curb (Z = 0.67m)
    create_box("SH1_BaseTrim_FrontLeft",
               (-HALF_DW - front_wing_w / 2.0, -CURB_HALF_L, CURB_H + 0.02),
               (front_wing_w, 0.04, 0.04),
               mat=mat_aluminum, parent=root)
    create_box("SH1_BaseTrim_FrontRight",
               (HALF_DW + front_wing_w / 2.0, -CURB_HALF_L, CURB_H + 0.02),
               (front_wing_w, 0.04, 0.04),
               mat=mat_aluminum, parent=root)
    create_box("SH1_BaseTrim_Left",
               (-CURB_HALF_W, 0.0, CURB_H + 0.02),
               (0.04, 2 * CURB_HALF_L, 0.04),
               mat=mat_aluminum, parent=root)
    create_box("SH1_BaseTrim_Right",
               (CURB_HALF_W, 0.0, CURB_H + 0.02),
               (0.04, 2 * CURB_HALF_L, 0.04),
               mat=mat_aluminum, parent=root)

    # B. Semicircular Hoop Arches Geometry
    rise = APEX_Z - EAVE_Z # 1.75 m
    R = (rise**2 + CURB_HALF_W**2) / (2.0 * rise)
    center_z = APEX_Z - R
    theta_max = math.asin(CURB_HALF_W / R)

    # Inner concentric arch for front gable truss (IMG "1 Front View.jpg")
    r_inner = R - 0.40
    center_z_inner = (APEX_Z - 0.40) - r_inner
    theta_max_inner = math.asin(min(0.999, (CURB_HALF_W - 0.40) / r_inner))

    # 11 Structural Hoop Truss Frames along Y
    NUM_HOOPS = 11
    ARC_SEGS = 14
    for k in range(NUM_HOOPS):
        cur_y = -CURB_HALF_L + k * ((2 * CURB_HALF_L) / (NUM_HOOPS - 1))

        # Vertical sidewall posts from curb wall up to eave beam
        for side_sign, sname in [(-1, "Left"), (1, "Right")]:
            sx = side_sign * CURB_HALF_W
            create_pipe_along_polyline(
                f"SH1_Post_{sname}_{k:02d}",
                [(sx, cur_y, CURB_H), (sx, cur_y, EAVE_Z)],
                radius=0.022, mat=mat_steel, parent=root
            )

        # Curved tubular arch
        arc_pts = []
        for s in range(ARC_SEGS + 1):
            t = -theta_max + 2.0 * theta_max * (s / ARC_SEGS)
            ax = R * math.sin(t)
            az = center_z + R * math.cos(t)
            arc_pts.append((ax, cur_y, az))

        create_pipe_along_polyline(f"SH1_Arch_{k:02d}", arc_pts, radius=0.022, mat=mat_steel, parent=root)

        # Horizontal bottom tie strut across eave level for intermediate trusses
        if k % 2 == 0:
            create_pipe_along_polyline(
                f"SH1_Tie_{k:02d}",
                [(-CURB_HALF_W, cur_y, EAVE_Z), (CURB_HALF_W, cur_y, EAVE_Z)],
                radius=0.016, mat=mat_steel, parent=root
            )
            # Vertical king strut from apex to tie
            create_pipe_along_polyline(
                f"SH1_KingStrut_{k:02d}",
                [(0.0, cur_y, EAVE_Z), (0.0, cur_y, APEX_Z)],
                radius=0.016, mat=mat_steel, parent=root
            )

    # C. Longitudinal Purlin Rails running full length
    purlin_configs = [
        ("Ridge", 0.0, APEX_Z - 0.02),
        ("Shoulder_Left", -CURB_HALF_W * 0.72, center_z + R * math.cos(theta_max * 0.72)),
        ("Shoulder_Right", CURB_HALF_W * 0.72, center_z + R * math.cos(theta_max * 0.72)),
        ("Quarter_Left", -CURB_HALF_W * 0.38, center_z + R * math.cos(theta_max * 0.38)),
        ("Quarter_Right", CURB_HALF_W * 0.38, center_z + R * math.cos(theta_max * 0.38)),
    ]
    for pname, px, pz in purlin_configs:
        create_pipe_along_polyline(
            f"SH1_Purlin_{pname}",
            [(px, -CURB_HALF_L, pz), (px, CURB_HALF_L, pz)],
            radius=0.018, mat=mat_steel, parent=root
        )

    # D. Front Entrance Gable Spider Web & Inner Concentric Arch Truss (IMG "1 Front View.jpg")
    # Inner concentric arch curve
    inner_arch_pts = []
    for s in range(ARC_SEGS + 1):
        t = -theta_max_inner + 2.0 * theta_max_inner * (s / ARC_SEGS)
        ix = r_inner * math.sin(t)
        iz = center_z_inner + r_inner * math.cos(t)
        inner_arch_pts.append((ix, -CURB_HALF_L, iz))
    create_pipe_along_polyline("SH1_Front_InnerArch", inner_arch_pts, radius=0.018, mat=mat_steel, parent=root)

    # Vertical King Post above door
    create_pipe_along_polyline(
        "SH1_Front_CenterKingPost",
        [(0.0, -CURB_HALF_L, EAVE_Z), (0.0, -CURB_HALF_L, APEX_Z)],
        radius=0.020, mat=mat_steel, parent=root
    )

    # Vertical Door Jamb Posts (curb up to eave)
    for side_sign, sname in [(-1, "Left"), (1, "Right")]:
        dx = side_sign * HALF_DW
        create_pipe_along_polyline(
            f"SH1_Front_DoorJamb_{sname}",
            [(dx, -CURB_HALF_L, FOOTING_H + 0.12), (dx, -CURB_HALF_L, EAVE_Z)],
            radius=0.024, mat=mat_steel, parent=root
        )
        # Radial diagonal struts connecting door top corners to outer arch
        diag_x = side_sign * (CURB_HALF_W * 0.70)
        t_diag = math.asin(diag_x / R)
        diag_z = center_z + R * math.cos(t_diag)
        create_pipe_along_polyline(
            f"SH1_Front_RadialStrut_{sname}",
            [(dx, -CURB_HALF_L, EAVE_Z), (diag_x, -CURB_HALF_L, diag_z)],
            radius=0.018, mat=mat_steel, parent=root
        )

    # Rear Endwall Bracing (+Y = +CURB_HALF_L)
    create_pipe_along_polyline(
        "SH1_Rear_KingPost",
        [(0.0, CURB_HALF_L, CURB_H), (0.0, CURB_HALF_L, APEX_Z)],
        radius=0.020, mat=mat_steel, parent=root
    )
    for side_sign, sname in [(-1, "Left"), (1, "Right")]:
        rx = side_sign * (CURB_HALF_W * 0.50)
        t_r = math.asin(rx / R)
        rz = center_z + R * math.cos(t_r)
        create_pipe_along_polyline(
            f"SH1_Rear_Post_{sname}",
            [(rx, CURB_HALF_L, CURB_H), (rx, CURB_HALF_L, rz)],
            radius=0.018, mat=mat_steel, parent=root
        )

    # -------------------------------------------------------------
    # 4. SLIDING COMMERCIAL SCREEN DOOR (IMG "1 Front View.jpg")
    # -------------------------------------------------------------
    door_bot_z = FOOTING_H + 0.12
    door_h = EAVE_Z - door_bot_z
    door_mid_z = door_bot_z + 0.90
    d_prof = 0.04

    # Aluminum Framing Stile & Rails
    # Left Stile
    create_box("SH1_Door_Stile_L", (-HALF_DW + d_prof/2.0, -CURB_HALF_L - 0.02, door_bot_z + door_h/2.0), (d_prof, d_prof, door_h), mat=mat_aluminum, parent=root)
    # Right Stile
    create_box("SH1_Door_Stile_R", (HALF_DW - d_prof/2.0, -CURB_HALF_L - 0.02, door_bot_z + door_h/2.0), (d_prof, d_prof, door_h), mat=mat_aluminum, parent=root)
    # Top Rail
    create_box("SH1_Door_Rail_Top", (0.0, -CURB_HALF_L - 0.02, EAVE_Z - d_prof/2.0), (DOOR_W, d_prof, d_prof), mat=mat_aluminum, parent=root)
    # Bottom Rail
    create_box("SH1_Door_Rail_Bot", (0.0, -CURB_HALF_L - 0.02, door_bot_z + d_prof/2.0), (DOOR_W, d_prof, d_prof), mat=mat_aluminum, parent=root)
    # Mid-Waist Divider Rail
    create_box("SH1_Door_Rail_Mid", (0.0, -CURB_HALF_L - 0.02, door_mid_z), (DOOR_W, d_prof, d_prof), mat=mat_aluminum, parent=root)
    # Door Screen Infill Mesh Panels
    create_box("SH1_Door_Mesh_Upper", (0.0, -CURB_HALF_L - 0.02, door_mid_z + (door_h - 0.90)/2.0), (DOOR_W - 2*d_prof, 0.01, door_h - 0.90 - d_prof), mat=mat_insect_net, parent=root)
    create_box("SH1_Door_Mesh_Lower", (0.0, -CURB_HALF_L - 0.02, door_bot_z + 0.45), (DOOR_W - 2*d_prof, 0.01, 0.90 - d_prof), mat=mat_insect_net, parent=root)
    # Door Pull Handle on Left Stile
    create_box("SH1_Door_Handle", (-HALF_DW + 0.08, -CURB_HALF_L - 0.05, door_mid_z), (0.02, 0.04, 0.18), mat=mat_aluminum, parent=root)
    # Brass Padlock / Center Latch Detail
    create_box("SH1_Door_Padlock", (-0.02, -CURB_HALF_L - 0.05, door_mid_z), (0.04, 0.03, 0.05), mat=mat_steel, parent=root)

    # -------------------------------------------------------------
    # 5. INSECT NETTING & SHADE CLOTH CLADDING
    # -------------------------------------------------------------
    # A. Barrel Curved Roof Netting (Semi-translucent white mesh)
    build_barrel_mesh("SH1_Netting_Roof", CURB_HALF_W, 2 * CURB_HALF_L, EAVE_Z, APEX_Z, -CURB_HALF_L, CURB_HALF_L, mat=mat_insect_net, parent=root, x_segs=18, y_segs=12)

    # B. Vertical Sidewall Netting (North & South flanks from curb top Z = 0.65m up to eave Z = 2.10m)
    net_wall_h = EAVE_Z - CURB_H
    net_wall_cz = CURB_H + net_wall_h / 2.0
    # Left Flank (-X, North)
    create_box("SH1_Netting_WallLeft", (-CURB_HALF_W, 0.0, net_wall_cz), (0.01, 2 * CURB_HALF_L, net_wall_h), mat=mat_side_net, parent=root)
    # Right Flank (+X, South)
    create_box("SH1_Netting_WallRight", (CURB_HALF_W, 0.0, net_wall_cz), (0.01, 2 * CURB_HALF_L, net_wall_h), mat=mat_side_net, parent=root)

    # C. Rear Endwall Netting (+Y = +CURB_HALF_L)
    create_box("SH1_Netting_RearLower", (0.0, CURB_HALF_L, net_wall_cz), (2 * CURB_HALF_W, 0.01, net_wall_h), mat=mat_side_net, parent=root)

    # D. Front Entrance Endwall Netting (-Y = -CURB_HALF_L, left & right of screen door)
    create_box("SH1_Netting_FrontFlankLeft",
               (-HALF_DW - front_wing_w / 2.0, -CURB_HALF_L, net_wall_cz),
               (front_wing_w, 0.01, net_wall_h), mat=mat_insect_net, parent=root)
    create_box("SH1_Netting_FrontFlankRight",
               (HALF_DW + front_wing_w / 2.0, -CURB_HALF_L, net_wall_cz),
               (front_wing_w, 0.01, net_wall_h), mat=mat_insect_net, parent=root)

    # E. Semicircular Gable Arc Netting (Front & Rear)
    for gname, gy, gmat in [("Front", -CURB_HALF_L, mat_insect_net), ("Rear", CURB_HALF_L, mat_side_net)]:
        mesh_g = bpy.data.meshes.new(f"SH1_Netting_Gable_{gname}_mesh")
        obj_g = bpy.data.objects.new(f"SH1_Netting_Gable_{gname}", mesh_g)
        bpy.context.collection.objects.link(obj_g)

        verts_g = [(0.0, gy, EAVE_Z)]
        for s in range(ARC_SEGS + 1):
            t = -theta_max + 2.0 * theta_max * (s / ARC_SEGS)
            gx = R * math.sin(t)
            gz = center_z + R * math.cos(t)
            verts_g.append((gx, gy, gz))

        faces_g = []
        for s in range(1, ARC_SEGS + 1):
            if gname == "Front":
                faces_g.append((0, s, s + 1))
            else:
                faces_g.append((0, s + 1, s))

        mesh_g.from_pydata(verts_g, [], faces_g)
        mesh_g.update()
        obj_g.data.materials.append(gmat)
        obj_g.parent = root

    # F. Horizontal Interior Shade Screen (Ceiling screen at eave level Z = 2.08m, IMG "1 Inside View.jpg")
    create_box("SH1_InteriorCeilingShadeNet",
               (0.0, 0.0, EAVE_Z - 0.02),
               (2 * CURB_HALF_W - 0.10, 2 * CURB_HALF_L - 0.20, 0.01),
               mat=mat_shade_cloth, parent=root)

    # -------------------------------------------------------------
    # 6. INTERIOR HYDROPONIC NFT SEEDLING TABLES (IMG "1 Inside View.jpg")
    # -------------------------------------------------------------
    TABLE_W = 2.05
    TABLE_L = 16.50
    TABLE_H = 0.82
    TABLE_CZ = FOOTING_H + (TABLE_H - FOOTING_H) / 2.0

    NUM_CHANNELS = 6
    CHANNEL_W = 0.14
    CHANNEL_H = 0.08
    CHANNEL_PITCH = (TABLE_W - 0.10) / (NUM_CHANNELS - 1)

    for side_sign, tname in [(-1, "Left"), (1, "Right")]:
        tx = side_sign * (HALF_DW + 0.25 + TABLE_W / 2.0)

        # Support Legs & Steel Cross Rails
        num_support_frames = 8
        for fi in range(num_support_frames):
            fy = -TABLE_L/2.0 + fi * (TABLE_L / (num_support_frames - 1))
            # Transverse steel cross-rail under channels
            create_box(f"SH1_Table_{tname}_Rail_{fi}",
                       (tx, fy, TABLE_H - 0.03),
                       (TABLE_W, 0.04, 0.04),
                       mat=mat_steel, parent=root)
            # Two vertical legs down to floor
            for leg_x in [tx - TABLE_W/2.0 + 0.05, tx + TABLE_W/2.0 - 0.05]:
                create_cylinder(f"SH1_Table_{tname}_Leg_{fi}_{leg_x:.2f}",
                                (leg_x, fy, TABLE_CZ),
                                radius=0.018, depth=TABLE_H - FOOTING_H, mat=mat_steel, parent=root)

        # 6 Longitudinal White PVC NFT Hydroponic Channels
        for ci in range(NUM_CHANNELS):
            cx = (tx - TABLE_W/2.0 + 0.05) + ci * CHANNEL_PITCH
            # White PVC square channel
            create_box(f"SH1_Table_{tname}_Channel_{ci}",
                       (cx, 0.0, TABLE_H + CHANNEL_H/2.0),
                       (CHANNEL_W, TABLE_L, CHANNEL_H),
                       mat=mat_nft_pvc, parent=root)

            # Fresh Green Seedling Plant Row emerging from channel holes
            create_box(f"SH1_Table_{tname}_Seedlings_{ci}",
                       (cx, 0.0, TABLE_H + CHANNEL_H + 0.03),
                       (CHANNEL_W * 0.70, TABLE_L - 0.40, 0.06),
                       mat=mat_seedlings, parent=root)

        # Blue PVC Manifold & Water Supply Risers at front of table (IMG "1 Inside View.jpg")
        # Front horizontal distribution header pipe
        create_pipe_along_polyline(
            f"SH1_Irrigation_Header_{tname}",
            [(tx - TABLE_W/2.0 + 0.04, -TABLE_L/2.0, TABLE_H + 0.12), (tx + TABLE_W/2.0 - 0.04, -TABLE_L/2.0, TABLE_H + 0.12)],
            radius=0.016, mat=mat_blue_pvc, parent=root
        )
        # Vertical Blue PVC Riser from floor
        create_pipe_along_polyline(
            f"SH1_Irrigation_Riser_{tname}",
            [(tx - TABLE_W/2.0 + 0.04, -TABLE_L/2.0, FOOTING_H), (tx - TABLE_W/2.0 + 0.04, -TABLE_L/2.0, TABLE_H + 0.12)],
            radius=0.018, mat=mat_blue_pvc, parent=root
        )

    # Overhead Central Irrigation Supply Line along ridge truss
    create_pipe_along_polyline(
        "SH1_Irrigation_OverheadLine",
        [(0.0, -CURB_HALF_L + 0.50, 2.95), (0.0, CURB_HALF_L - 0.50, 2.95)],
        radius=0.016, mat=mat_blue_pvc, parent=root
    )

    # -------------------------------------------------------------
    # 7. BATCH JOIN BY MATERIAL & EXPORT OPTIMIZED GLB
    # -------------------------------------------------------------
    bpy.ops.object.select_all(action='DESELECT')
    mesh_objs = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    mat_map = {}
    for obj in mesh_objs:
        mname = obj.data.materials[0].name if len(obj.data.materials) > 0 else "Default"
        mat_map.setdefault(mname, []).append(obj)

    print(f"Batch joining {len(mesh_objs)} objects across {len(mat_map)} materials...")
    joined_objs = []
    for mname, objs in mat_map.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objs:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        active = bpy.context.active_object
        active.name = f"SH1_Batch_{mname}"
        joined_objs.append(active)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in joined_objs:
        obj.select_set(True)

    os.makedirs(os.path.dirname(TARGET_GLB), exist_ok=True)

    print(f"Exporting to {TARGET_GLB}...")
    bpy.ops.export_scene.gltf(
        filepath=TARGET_GLB,
        use_selection=True,
        export_format='GLB',
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_draco_mesh_compression_enable=False
    )

    size_kb = os.path.getsize(TARGET_GLB) / 1024.0
    print(f"[OK] Screenhouse 1 GLB export complete! File size: {size_kb:.1f} KB (budget: 300 KB)")
    return size_kb

try:
    build_plot17_screenhouse_1()
except Exception as e:
    import traceback
    traceback.print_exc()
    raise e
