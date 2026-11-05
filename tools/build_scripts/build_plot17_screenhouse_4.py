"""
build_plot17_screenhouse_4.py — Authentic Bespoke 3D Model of DA-LARES Screenhouse 4 (Plot 17)

Phase 4 of Plots 17 & 18 Screenhouse 3D Modeling Plan (docs/screenhouses_3d_modeling_plan.md)
Facility: Screenhouse 4 — High-Density Black Shade Net Hardening Nursery
Centroid: [121.16736242, 13.95897517], Mapbox rotation: 69.8 deg clockwise.
Dimensions: Width = 8.62 m (local X in [-4.31, +4.31]), Length = 18.72 m (local Y in [-9.36, +9.36])

Primary Reference Photographs:
- Building Images/Screenhouses/4 Front View.jpg (Wider profile, radial sunburst red arch, concrete curb with iconic red stripe, right entrance door, black shade net cladding)
- Building Images/Screenhouses/4 Inside View.jpg (Slatted seedling propagation tables, nursery polybags with seedlings, iconic blue 55-gallon water drum in center aisle)
- Building Images/Screenhouses/4 Inside Vieww.jpg (Interior nursery arrangement, horizontal shade cloth at eave level)
- Building Images/Screenhouses/4 Inside Viewww.jpg (Side table propagation details)
- Building Images/Screenhouses/3 Left 4 Right.jpg (Alleyway between SH3 and SH4, flank mesh details)
"""

import bpy
import bmesh
import math
import os

TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot17_screenhouse_4.glb"

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

def create_pipe_along_polyline(name, points, radius=0.024, mat=None, parent=None, resolution=0):
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
    
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_arch_polyline(half_w, z_eave, z_apex, y_pos, num_segs=12):
    """Calculates points for a circular arch springing from -half_w to +half_w."""
    rise = z_apex - z_eave
    R = (rise**2 + half_w**2) / (2.0 * rise)
    center_z = z_apex - R
    theta_max = math.asin(half_w / R)
    
    pts = []
    for i in range(num_segs + 1):
        t = -theta_max + 2.0 * theta_max * (i / num_segs)
        px = R * math.sin(t)
        pz = center_z + R * math.cos(t)
        pts.append((px, y_pos, pz))
    return pts

def build_barrel_mesh(name, half_w, z_eave, z_apex, y_start, y_end, mat=None, parent=None, x_segs=16, y_segs=10):
    """Generates a curved barrel roof mesh with smooth outward normals as a single unified object."""
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

def build_gable_fan_mesh(name, half_w, z_eave, z_apex, y_pos, is_front=True, mat=None, parent=None, num_segs=16):
    """Builds a single unified triangular fan mesh for the curved arch gable."""
    rise = z_apex - z_eave
    R = (rise**2 + half_w**2) / (2.0 * rise)
    center_z = z_apex - R
    theta_max = math.asin(half_w / R)

    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    verts = [(0.0, y_pos, z_eave)]
    for s in range(num_segs + 1):
        t = -theta_max + 2.0 * theta_max * (s / num_segs)
        vx = R * math.sin(t)
        vz = center_z + R * math.cos(t)
        verts.append((vx, y_pos, vz))

    faces = []
    for s in range(1, num_segs + 1):
        if is_front:
            faces.append((0, s, s + 1))
        else:
            faces.append((0, s + 1, s))

    mesh.from_pydata(verts, [], faces)
    mesh.update()

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_plot17_screenhouse_4():
    print("=" * 60)
    print("BUILDING AUTHENTIC DA-LARES PLOT 17 SCREENHOUSE 4 (Phase 4)")
    print("=" * 60)

    clear_scene()

    # 1. Authentic PBR Materials (Calibrated to field ground-truth)
    # Sturdy weathered concrete plinth & foundation
    mat_concrete_dark = get_or_create_material("SH4_ConcreteFooting", (0.38, 0.40, 0.37, 1.0), roughness=0.92, metallic=0.0)
    mat_concrete_curb = get_or_create_material("SH4_ConcreteCurb", (0.54, 0.55, 0.52, 1.0), roughness=0.88, metallic=0.0)
    mat_soil_floor = get_or_create_material("SH4_SoilFloor", (0.32, 0.28, 0.24, 1.0), roughness=0.95, metallic=0.0)
    mat_weed_mat = get_or_create_material("SH4_WeedBarrierMat", (0.12, 0.12, 0.13, 1.0), roughness=0.90, metallic=0.0)
    mat_grass_tufts = get_or_create_material("SH4_SoilGrass", (0.24, 0.42, 0.17, 1.0), roughness=0.85, metallic=0.0)

    # Iconic painted red stripe along the foundation plinth / lower footing apron
    mat_red_stripe = get_or_create_material("SH4_RedFootingStripe", (0.72, 0.15, 0.13, 1.0), roughness=0.65, metallic=0.05)

    # Signature oxide red / maroon painted tubular steel frame & sunburst spokes
    mat_red_steel = get_or_create_material("SH4_OxideRedSteel", (0.62, 0.16, 0.14, 1.0), roughness=0.35, metallic=0.85)
    mat_red_steel_dark = get_or_create_material("SH4_OxideRedDark", (0.48, 0.12, 0.10, 1.0), roughness=0.45, metallic=0.80)

    # Cladding: Heavy-duty black agricultural shade netting
    mat_black_mesh = get_or_create_material("SH4_BlackShadeNet", (0.08, 0.08, 0.09, 0.88), roughness=0.90, metallic=0.0, alpha=0.85, blend_mode='BLEND')
    
    # Door materials: Weathered wood / aluminum framed door leaf & canopy hood
    mat_wood_door = get_or_create_material("SH4_WoodDoorLeaf", (0.54, 0.40, 0.28, 1.0), roughness=0.75, metallic=0.05)
    mat_hood_sheet = get_or_create_material("SH4_CanopyHood", (0.50, 0.52, 0.54, 1.0), roughness=0.55, metallic=0.70)

    # Nursery table & crop materials
    mat_galv_steel = get_or_create_material("SH4_GalvanizedSteel", (0.65, 0.68, 0.70, 1.0), roughness=0.42, metallic=0.80)
    mat_polybag = get_or_create_material("SH4_NurseryPolybag", (0.05, 0.05, 0.06, 1.0), roughness=0.75, metallic=0.0)
    mat_foliage = get_or_create_material("SH4_SeedlingFoliage", (0.18, 0.48, 0.12, 1.0), roughness=0.50, metallic=0.0)

    # Center aisle landmark: Iconic 55-gallon bright blue plastic water drum
    mat_blue_drum = get_or_create_material("SH4_BlueWaterDrum", (0.08, 0.35, 0.80, 1.0), roughness=0.28, metallic=0.05)
    mat_black_plastic = get_or_create_material("SH4_BlackPlasticLid", (0.10, 0.10, 0.10, 1.0), roughness=0.50, metallic=0.0)

    # Overhead irrigation pipe
    mat_pvc_pipe = get_or_create_material("SH4_BlueIrrigationPVC", (0.15, 0.42, 0.75, 1.0), roughness=0.38, metallic=0.10)

    root = bpy.data.objects.new("Plot17_Screenhouse_4_Root", None)
    bpy.context.collection.objects.link(root)

    # -------------------------------------------------------------
    # SPATIAL DIMENSIONS (Polygon #33 in survey data)
    # -------------------------------------------------------------
    WIDTH = 8.62
    LENGTH = 18.72
    HALF_W = WIDTH / 2.0    # 4.31 m
    HALF_L = LENGTH / 2.0   # 9.36 m

    FOOTING_H = 0.25        # Lower concrete plinth apron
    CURB_H = 0.65           # Upper curb top height
    CURB_THICK = 0.18       # Curb wall thickness

    EAVE_Z = 2.10           # Horizontal eave beam height
    APEX_Z = 4.10           # Roof hoop apex ridge height (rise = 2.00 m)

    # -------------------------------------------------------------
    # 2. FOUNDATION: Two-Tier Concrete Plinth with Painted Red Stripe
    # -------------------------------------------------------------
    # A. Lower Concrete Footing Slab (Z = 0 to 0.25m)
    create_box("SH4_Footing_Main",
               (0.0, 0.0, FOOTING_H / 2.0),
               (WIDTH, LENGTH, FOOTING_H),
               mat_concrete_dark, root)

    # B. Iconic Painted Red Horizontal Stripe along Lower Footing Apron
    STRIPE_H = 0.16
    STRIPE_Z = 0.06 + STRIPE_H / 2.0
    STRIPE_THICK = 0.02

    # Front red stripe (facing compound road at -Y)
    create_box("SH4_RedStripe_Front",
               (0.0, -HALF_L - STRIPE_THICK / 2.0, STRIPE_Z),
               (WIDTH, STRIPE_THICK, STRIPE_H),
               mat_red_stripe, root)

    # Left flank red stripe (-X)
    create_box("SH4_RedStripe_Left",
               (-HALF_W - STRIPE_THICK / 2.0, 0.0, STRIPE_Z),
               (STRIPE_THICK, LENGTH, STRIPE_H),
               mat_red_stripe, root)

    # Right flank red stripe (+X)
    create_box("SH4_RedStripe_Right",
               (HALF_W + STRIPE_THICK / 2.0, 0.0, STRIPE_Z),
               (STRIPE_THICK, LENGTH, STRIPE_H),
               mat_red_stripe, root)

    # C. Front Entrance Approach Concrete Steps at Right Doorway
    DOOR_X_MIN = 2.50
    DOOR_X_MAX = 3.80
    DOOR_W = DOOR_X_MAX - DOOR_X_MIN
    DOOR_CX = (DOOR_X_MIN + DOOR_X_MAX) / 2.0

    STEP1_DEPTH = 0.50
    create_box("SH4_Entrance_Step1",
               (DOOR_CX, -HALF_L - STEP1_DEPTH / 2.0, 0.13 / 2.0),
               (DOOR_W + 0.40, STEP1_DEPTH, 0.13),
               mat_concrete_dark, root)

    STEP2_DEPTH = 0.30
    create_box("SH4_Entrance_Step2",
               (DOOR_CX, -HALF_L - STEP2_DEPTH / 2.0, (0.13 + 0.25) / 2.0),
               (DOOR_W + 0.30, STEP2_DEPTH, 0.12),
               mat_concrete_dark, root)

    # D. Upper Concrete Curb Walls (Z = 0.25m to 0.65m)
    # Left Curb Wall (X = -HALF_W + CURB_THICK/2)
    create_box("SH4_Curb_Left",
               (-HALF_W + CURB_THICK / 2.0, 0.0, (FOOTING_H + CURB_H) / 2.0),
               (CURB_THICK, LENGTH, CURB_H - FOOTING_H),
               mat_concrete_curb, root)

    # Right Curb Wall (X = +HALF_W - CURB_THICK/2)
    create_box("SH4_Curb_Right",
               (HALF_W - CURB_THICK / 2.0, 0.0, (FOOTING_H + CURB_H) / 2.0),
               (CURB_THICK, LENGTH, CURB_H - FOOTING_H),
               mat_concrete_curb, root)

    # Rear Curb Wall (Y = +HALF_L - CURB_THICK/2)
    create_box("SH4_Curb_Rear",
               (0.0, HALF_L - CURB_THICK / 2.0, (FOOTING_H + CURB_H) / 2.0),
               (WIDTH, CURB_THICK, CURB_H - FOOTING_H),
               mat_concrete_curb, root)

    # Front Curb Wall Left Section (from X = -HALF_W to DOOR_X_MIN)
    FRONT_LEFT_W = (HALF_W + DOOR_X_MIN)
    FRONT_LEFT_CX = (-HALF_W + DOOR_X_MIN) / 2.0
    create_box("SH4_Curb_Front_Left",
               (FRONT_LEFT_CX, -HALF_L + CURB_THICK / 2.0, (FOOTING_H + CURB_H) / 2.0),
               (FRONT_LEFT_W, CURB_THICK, CURB_H - FOOTING_H),
               mat_concrete_curb, root)

    # Front Curb Wall Right Section (from DOOR_X_MAX to +HALF_W)
    FRONT_RIGHT_W = (HALF_W - DOOR_X_MAX)
    FRONT_RIGHT_CX = (DOOR_X_MAX + HALF_W) / 2.0
    create_box("SH4_Curb_Front_Right",
               (FRONT_RIGHT_CX, -HALF_L + CURB_THICK / 2.0, (FOOTING_H + CURB_H) / 2.0),
               (FRONT_RIGHT_W, CURB_THICK, CURB_H - FOOTING_H),
               mat_concrete_curb, root)

    # E. Interior Flooring
    create_box("SH4_Soil_Floor",
               (0.0, 0.0, FOOTING_H + 0.02),
               (WIDTH - CURB_THICK * 2, LENGTH - CURB_THICK * 2, 0.04),
               mat_soil_floor, root)

    # Central black weed-barrier walkway mat
    AISLE_W = 1.40
    create_box("SH4_Weed_Mat_Walkway",
               (0.0, 0.0, FOOTING_H + 0.03),
               (AISLE_W, LENGTH - CURB_THICK * 2 - 0.20, 0.02),
               mat_weed_mat, root)

    # Natural low grass patches along soil borders
    create_box("SH4_Soil_Grass_Left",
               (-HALF_W + CURB_THICK + 0.60, 0.0, FOOTING_H + 0.025),
               (1.10, LENGTH - CURB_THICK * 2 - 0.40, 0.02),
               mat_grass_tufts, root)
    create_box("SH4_Soil_Grass_Right",
               (HALF_W - CURB_THICK - 0.60, 0.0, FOOTING_H + 0.025),
               (1.10, LENGTH - CURB_THICK * 2 - 0.40, 0.02),
               mat_grass_tufts, root)

    # -------------------------------------------------------------
    # 3. RED TUBULAR STEEL SUPERSTRUCTURE (11 Semicircular Hoop Arches)
    # -------------------------------------------------------------
    NUM_ARCHES = 11
    arch_y_coords = [-HALF_L + i * (LENGTH / (NUM_ARCHES - 1)) for i in range(NUM_ARCHES)]

    PIPE_R_MAIN = 0.026   # ~52mm OD pipe for arches
    PIPE_R_PURLIN = 0.020 # ~40mm OD pipe for purlins and bracing
    PIPE_R_SPOKE = 0.016  # ~32mm OD for radial sunburst spokes

    rise = APEX_Z - EAVE_Z
    R_circle = (rise**2 + HALF_W**2) / (2.0 * rise)
    Z_center = APEX_Z - R_circle

    for idx, ay in enumerate(arch_y_coords):
        arch_pts = build_arch_polyline(HALF_W, EAVE_Z, APEX_Z, ay, num_segs=12)
        create_pipe_along_polyline(f"SH4_Arch_{idx+1}", arch_pts, radius=PIPE_R_MAIN, mat=mat_red_steel, parent=root, resolution=1)

        # Vertical leg posts (from curb top Z=0.65m to eave Z=2.10m)
        create_pipe_along_polyline(f"SH4_Leg_L_{idx+1}",
                                   [(-HALF_W, ay, CURB_H), (-HALF_W, ay, EAVE_Z)],
                                   radius=PIPE_R_MAIN, mat=mat_red_steel, parent=root)
        create_pipe_along_polyline(f"SH4_Leg_R_{idx+1}",
                                   [(HALF_W, ay, CURB_H), (HALF_W, ay, EAVE_Z)],
                                   radius=PIPE_R_MAIN, mat=mat_red_steel, parent=root)

        # Horizontal collar tie beam across arch at Z = 2.20m
        TIE_Z = 2.20
        dz = TIE_Z - Z_center
        tie_half_x = math.sqrt(max(0.0, R_circle**2 - dz**2))

        create_pipe_along_polyline(f"SH4_TieBeam_{idx+1}",
                                   [(-tie_half_x, ay, TIE_Z), (tie_half_x, ay, TIE_Z)],
                                   radius=PIPE_R_PURLIN, mat=mat_red_steel_dark, parent=root)

        # King post from collar tie to arch apex
        create_pipe_along_polyline(f"SH4_KingPost_{idx+1}",
                                   [(0.0, ay, TIE_Z), (0.0, ay, APEX_Z)],
                                   radius=PIPE_R_PURLIN, mat=mat_red_steel_dark, parent=root)

    # -------------------------------------------------------------
    # 4. LONGITUDINAL PURLINS & PERIMETER GIRDERS
    # -------------------------------------------------------------
    # Apex Ridge Purlin
    create_pipe_along_polyline("SH4_Purlin_Apex",
                               [(0.0, -HALF_L, APEX_Z), (0.0, HALF_L, APEX_Z)],
                               radius=PIPE_R_PURLIN, mat=mat_red_steel, parent=root)

    # Upper Shoulder Purlins (X = +/- 2.50m)
    dz_up = math.sqrt(max(0.0, R_circle**2 - 2.50**2))
    z_up = Z_center + dz_up
    create_pipe_along_polyline("SH4_Purlin_Shoulder_L",
                               [(-2.50, -HALF_L, z_up), (-2.50, HALF_L, z_up)],
                               radius=PIPE_R_PURLIN, mat=mat_red_steel_dark, parent=root)
    create_pipe_along_polyline("SH4_Purlin_Shoulder_R",
                               [(2.50, -HALF_L, z_up), (2.50, HALF_L, z_up)],
                               radius=PIPE_R_PURLIN, mat=mat_red_steel_dark, parent=root)

    # Mid Shoulder Purlins (X = +/- 3.65m)
    dz_mid = math.sqrt(max(0.0, R_circle**2 - 3.65**2))
    z_mid = Z_center + dz_mid
    create_pipe_along_polyline("SH4_Purlin_Mid_L",
                               [(-3.65, -HALF_L, z_mid), (-3.65, HALF_L, z_mid)],
                               radius=PIPE_R_PURLIN, mat=mat_red_steel_dark, parent=root)
    create_pipe_along_polyline("SH4_Purlin_Mid_R",
                               [(3.65, -HALF_L, z_mid), (3.65, HALF_L, z_mid)],
                               radius=PIPE_R_PURLIN, mat=mat_red_steel_dark, parent=root)

    # Eave Girders (X = +/- HALF_W, Z = EAVE_Z)
    create_pipe_along_polyline("SH4_Girder_Eave_L",
                               [(-HALF_W, -HALF_L, EAVE_Z), (-HALF_W, HALF_L, EAVE_Z)],
                               radius=PIPE_R_MAIN, mat=mat_red_steel, parent=root)
    create_pipe_along_polyline("SH4_Girder_Eave_R",
                               [(HALF_W, -HALF_L, EAVE_Z), (HALF_W, HALF_L, EAVE_Z)],
                               radius=PIPE_R_MAIN, mat=mat_red_steel, parent=root)

    # -------------------------------------------------------------
    # 5. FRONT ENTRANCE GABLE WEB & RADIAL SUNBURST SPOKES
    # -------------------------------------------------------------
    INNER_HALF_W = 2.45
    INNER_APEX_Z = 3.35
    inner_arch_pts = build_arch_polyline(INNER_HALF_W, EAVE_Z, INNER_APEX_Z, -HALF_L, num_segs=12)
    create_pipe_along_polyline("SH4_Front_Inner_Arch", inner_arch_pts, radius=PIPE_R_PURLIN, mat=mat_red_steel, parent=root)

    # 8 radial sunburst spokes connecting Inner Arch to Outer Arch Rim
    num_spokes = 8
    for s_idx in range(num_spokes):
        frac = (s_idx + 0.5) / num_spokes
        t_spoke = -0.869 + 2.0 * 0.869 * frac
        ox = R_circle * math.sin(t_spoke)
        oz = Z_center + R_circle * math.cos(t_spoke)
        
        inner_rise = INNER_APEX_Z - EAVE_Z
        inner_R = (inner_rise**2 + INNER_HALF_W**2) / (2.0 * inner_rise)
        inner_Zc = INNER_APEX_Z - inner_R
        inner_theta_max = math.asin(INNER_HALF_W / inner_R)
        t_in = -inner_theta_max + 2.0 * inner_theta_max * frac
        ix = inner_R * math.sin(t_in)
        iz = inner_Zc + inner_R * math.cos(t_in)

        create_pipe_along_polyline(f"SH4_Sunburst_Spoke_{s_idx+1}",
                                   [(ix, -HALF_L, iz), (ox, -HALF_L, oz)],
                                   radius=PIPE_R_SPOKE, mat=mat_red_steel, parent=root)

    # -------------------------------------------------------------
    # 6. RIGHT-SIDE ENTRANCE DOORWAY & CANOPY HOOD
    # -------------------------------------------------------------
    DOOR_HEAD_Z = 2.10

    # Door jambs
    create_cylinder("SH4_DoorJamb_Left",
                    (DOOR_X_MIN, -HALF_L, (CURB_H + DOOR_HEAD_Z) / 2.0),
                    radius=0.035, depth=DOOR_HEAD_Z - CURB_H,
                    mat=mat_wood_door, parent=root)

    create_cylinder("SH4_DoorJamb_Right",
                    (DOOR_X_MAX, -HALF_L, (CURB_H + DOOR_HEAD_Z) / 2.0),
                    radius=0.035, depth=DOOR_HEAD_Z - CURB_H,
                    mat=mat_wood_door, parent=root)

    # Door header lintel
    create_box("SH4_DoorHeader",
               (DOOR_CX, -HALF_L, DOOR_HEAD_Z + 0.03),
               (DOOR_W + 0.10, 0.08, 0.06),
               mat_wood_door, root)

    # Weathered wooden panel door leaf (slightly ajar at ~15 deg angle)
    DOOR_LEAF_W = DOOR_W - 0.08
    DOOR_LEAF_H = DOOR_HEAD_Z - FOOTING_H - 0.04
    door_angle = math.radians(15)
    dl_cx = DOOR_X_MIN + (DOOR_LEAF_W / 2.0) * math.cos(door_angle)
    dl_cy = -HALF_L - (DOOR_LEAF_W / 2.0) * math.sin(door_angle)
    dl_cz = FOOTING_H + 0.02 + DOOR_LEAF_H / 2.0

    bpy.ops.mesh.primitive_cube_add(location=(dl_cx, dl_cy, dl_cz))
    door_obj = bpy.context.active_object
    door_obj.name = "SH4_DoorLeaf"
    door_obj.scale = (DOOR_LEAF_W / 2.0, 0.04 / 2.0, DOOR_LEAF_H / 2.0)
    door_obj.rotation_euler = (0, 0, -door_angle)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    door_obj.data.materials.clear()
    door_obj.data.materials.append(mat_wood_door)
    door_obj.parent = root

    # Overhead entrance canopy hood (slanted corrugated metal hood projecting forward)
    HOOD_PROJ = 0.50
    HOOD_W = DOOR_W + 0.35
    HOOD_SLOPE = 0.10
    create_box("SH4_Canopy_Hood",
               (DOOR_CX, -HALF_L - HOOD_PROJ / 2.0, DOOR_HEAD_Z + 0.12),
               (HOOD_W, HOOD_PROJ, 0.03),
               mat_hood_sheet, root)

    # -------------------------------------------------------------
    # 7. HEAVY-DUTY BLACK SHADE NET CLADDING
    # -------------------------------------------------------------
    # A. Barrel Curved Roof Netting (Unified single mesh!)
    build_barrel_mesh("SH4_Roof_BlackShadeNet", HALF_W, EAVE_Z, APEX_Z, -HALF_L, HALF_L,
                      mat=mat_black_mesh, parent=root, x_segs=16, y_segs=10)

    # B. Vertical Sidewall Netting (Flanks from curb top Z=0.65m up to eave Z=2.10m)
    net_wall_h = EAVE_Z - CURB_H
    net_wall_cz = CURB_H + net_wall_h / 2.0
    create_box("SH4_FlankMesh_Left",
               (-HALF_W, 0.0, net_wall_cz),
               (0.02, LENGTH, net_wall_h),
               mat_black_mesh, root)
    create_box("SH4_FlankMesh_Right",
               (HALF_W, 0.0, net_wall_cz),
               (0.02, LENGTH, net_wall_h),
               mat_black_mesh, root)

    # C. Rear Endwall Netting (+Y = +HALF_L)
    create_box("SH4_RearMesh_Lower",
               (0.0, HALF_L, net_wall_cz),
               (WIDTH, 0.02, net_wall_h),
               mat_black_mesh, root)
    build_gable_fan_mesh("SH4_RearMesh_GableFan", HALF_W, EAVE_Z, APEX_Z, HALF_L,
                         is_front=False, mat=mat_black_mesh, parent=root, num_segs=16)

    # D. Front Entrance Endwall Netting (-Y = -HALF_L)
    # Left and right lower sections flanking entrance doorway
    create_box("SH4_FrontMesh_Lower_Left",
               (FRONT_LEFT_CX, -HALF_L, net_wall_cz),
               (FRONT_LEFT_W, 0.02, net_wall_h),
               mat_black_mesh, root)
    create_box("SH4_FrontMesh_Lower_Right",
               (FRONT_RIGHT_CX, -HALF_L, net_wall_cz),
               (FRONT_RIGHT_W, 0.02, net_wall_h),
               mat_black_mesh, root)
    # Front upper gable arch fan
    build_gable_fan_mesh("SH4_FrontMesh_GableFan", HALF_W, EAVE_Z, APEX_Z, -HALF_L,
                         is_front=True, mat=mat_black_mesh, parent=root, num_segs=16)

    # E. Horizontal Interior Ceiling Shade Screen at Eave Level (Z = 2.15m)
    create_box("SH4_InteriorCeilingShadeNet",
               (0.0, 0.0, EAVE_Z + 0.02),
               (WIDTH - 0.20, LENGTH - 0.40, 0.01),
               mat_black_mesh, root)

    # -------------------------------------------------------------
    # 8. AUTHENTIC INTERIOR NURSERY: Tables, Polybag Rows, Sprouts & Blue Drum
    # -------------------------------------------------------------
    TABLE_H = 0.82
    TABLE_W = 2.40
    TABLE_TOP_THICK = 0.04
    TABLE_CZ = FOOTING_H + (TABLE_H - FOOTING_H) / 2.0

    # Left Nursery Propagation Table (Running full length along -X)
    LEFT_TABLE_CX = -HALF_W + CURB_THICK + TABLE_W / 2.0 + 0.15  # ~ -2.60m
    LEFT_TABLE_L = LENGTH - CURB_THICK * 2 - 1.20                # ~ 17.1m
     # Wire-mesh slatted tabletop
    create_box("SH4_TableTop_Left",
               (LEFT_TABLE_CX, 0.0, FOOTING_H + TABLE_H),
               (TABLE_W, LEFT_TABLE_L, TABLE_TOP_THICK),
               mat=mat_galv_steel, parent=root)

    # Longitudinal lip angles
    create_box("SH4_Table_Left_LipL", (LEFT_TABLE_CX - TABLE_W / 2.0 + 0.02, 0.0, FOOTING_H + TABLE_H + 0.02), (0.04, LEFT_TABLE_L, 0.04), mat=mat_galv_steel, parent=root)
    create_box("SH4_Table_Left_LipR", (LEFT_TABLE_CX + TABLE_W / 2.0 - 0.02, 0.0, FOOTING_H + TABLE_H + 0.02), (0.04, LEFT_TABLE_L, 0.04), mat=mat_galv_steel, parent=root)

    # Table vertical support legs along left side
    num_leg_frames = 7
    for lp in range(num_leg_frames):
        ly = -LEFT_TABLE_L / 2.0 + lp * (LEFT_TABLE_L / (num_leg_frames - 1))
        create_box(f"SH4_Table_Left_Frame_{lp+1}",
                   (LEFT_TABLE_CX, ly, FOOTING_H + TABLE_H - 0.03),
                   (TABLE_W, 0.04, 0.04),
                   mat=mat_galv_steel, parent=root)
        create_cylinder(f"SH4_Table_Left_LegOut_{lp+1}",
                        (LEFT_TABLE_CX - TABLE_W / 2.0 + 0.06, ly, TABLE_CZ),
                        radius=0.020, depth=TABLE_H - FOOTING_H, mat=mat_galv_steel, parent=root, vertices=8)
        create_cylinder(f"SH4_Table_Left_LegIn_{lp+1}",
                        (LEFT_TABLE_CX + TABLE_W / 2.0 - 0.06, ly, TABLE_CZ),
                        radius=0.020, depth=TABLE_H - FOOTING_H, mat=mat_galv_steel, parent=root, vertices=8)

    # Right Nursery Propagation Table (Starts behind the entrance door clearance)
    RIGHT_TABLE_CX = HALF_W - CURB_THICK - TABLE_W / 2.0 - 0.15  # ~ +2.60m
    RIGHT_TABLE_Y_START = -HALF_L + 3.20                         # Leave front entry porch clear
    RIGHT_TABLE_Y_END = HALF_L - CURB_THICK - 0.50
    RIGHT_TABLE_L = RIGHT_TABLE_Y_END - RIGHT_TABLE_Y_START
    RIGHT_TABLE_CY = (RIGHT_TABLE_Y_START + RIGHT_TABLE_Y_END) / 2.0

    create_box("SH4_TableTop_Right",
               (RIGHT_TABLE_CX, RIGHT_TABLE_CY, FOOTING_H + TABLE_H),
               (TABLE_W, RIGHT_TABLE_L, TABLE_TOP_THICK),
               mat=mat_galv_steel, parent=root)

    create_box("SH4_Table_Right_LipL", (RIGHT_TABLE_CX - TABLE_W / 2.0 + 0.02, RIGHT_TABLE_CY, FOOTING_H + TABLE_H + 0.02), (0.04, RIGHT_TABLE_L, 0.04), mat=mat_galv_steel, parent=root)
    create_box("SH4_Table_Right_LipR", (RIGHT_TABLE_CX + TABLE_W / 2.0 - 0.02, RIGHT_TABLE_CY, FOOTING_H + TABLE_H + 0.02), (0.04, RIGHT_TABLE_L, 0.04), mat=mat_galv_steel, parent=root)

    num_r_frames = 6
    for rp in range(num_r_frames):
        ry = RIGHT_TABLE_Y_START + rp * (RIGHT_TABLE_L / (num_r_frames - 1))
        create_box(f"SH4_Table_Right_Frame_{rp+1}",
                   (RIGHT_TABLE_CX, ry, FOOTING_H + TABLE_H - 0.03),
                   (TABLE_W, 0.04, 0.04),
                   mat=mat_galv_steel, parent=root)
        create_cylinder(f"SH4_Table_Right_LegOut_{rp+1}",
                        (RIGHT_TABLE_CX + TABLE_W / 2.0 - 0.06, ry, TABLE_CZ),
                        radius=0.020, depth=TABLE_H - FOOTING_H, mat=mat_galv_steel, parent=root, vertices=8)
        create_cylinder(f"SH4_Table_Right_LegIn_{rp+1}",
                        (RIGHT_TABLE_CX - TABLE_W / 2.0 + 0.06, ry, TABLE_CZ),
                        radius=0.020, depth=TABLE_H - FOOTING_H, mat=mat_galv_steel, parent=root, vertices=8)

    # Continuous Makapuno/Seedling Nursery Polybag Bed Rows
    NUM_POT_ROWS = 5
    POT_ROW_W = 0.28
    POT_H = 0.20
    POT_PITCH = (TABLE_W - 0.20) / (NUM_POT_ROWS - 1)

    for pi in range(NUM_POT_ROWS):
        # Left table polybag rows + foliage beds
        plx = (LEFT_TABLE_CX - TABLE_W / 2.0 + 0.15) + pi * POT_PITCH
        create_box(f"SH4_PolybagRow_L_{pi+1}",
                   (plx, 0.0, FOOTING_H + TABLE_H + POT_H / 2.0),
                   (POT_ROW_W, LEFT_TABLE_L - 0.30, POT_H),
                   mat=mat_polybag, parent=root)
        create_box(f"SH4_FoliageRow_L_{pi+1}",
                   (plx, 0.0, FOOTING_H + TABLE_H + POT_H + 0.07),
                   (POT_ROW_W * 1.25, LEFT_TABLE_L - 0.20, 0.12),
                   mat=mat_foliage, parent=root)

        # Right table polybag rows + foliage beds
        prx = (RIGHT_TABLE_CX - TABLE_W / 2.0 + 0.15) + pi * POT_PITCH
        create_box(f"SH4_PolybagRow_R_{pi+1}",
                   (prx, RIGHT_TABLE_CY, FOOTING_H + TABLE_H + POT_H / 2.0),
                   (POT_ROW_W, RIGHT_TABLE_L - 0.30, POT_H),
                   mat=mat_polybag, parent=root)
        create_box(f"SH4_FoliageRow_R_{pi+1}",
                   (prx, RIGHT_TABLE_CY, FOOTING_H + TABLE_H + POT_H + 0.07),
                   (POT_ROW_W * 1.25, RIGHT_TABLE_L - 0.20, 0.12),
                   mat=mat_foliage, parent=root)

    # Accent plantlet crowns (modular shoots along aisle edge for high visual realism)
    for ai in range(8):
        ay_left = -LEFT_TABLE_L / 2.0 + 1.0 + ai * (LEFT_TABLE_L - 2.0) / 7.0
        create_cylinder(f"SH4_AccentPlant_L_{ai+1}",
                        (LEFT_TABLE_CX + TABLE_W / 2.0 - 0.20, ay_left, FOOTING_H + TABLE_H + POT_H + 0.12),
                        radius=0.10, depth=0.18, rot=(0, 0, ai * 0.8), mat=mat_foliage, parent=root, vertices=6)

    # -------------------------------------------------------------
    # 9. SIGNATURE BLUE 55-GALLON WATER DRUM IN AISLE
    # -------------------------------------------------------------
    DRUM_X = 0.0
    DRUM_Y = -4.20
    DRUM_R = 0.30
    DRUM_H = 0.92
    DRUM_Z = FOOTING_H + 0.04 + DRUM_H / 2.0

    create_cylinder("SH4_Blue_Drum_Body",
                    (DRUM_X, DRUM_Y, DRUM_Z),
                    radius=DRUM_R, depth=DRUM_H,
                    mat=mat_blue_drum, parent=root, vertices=16)

    create_cylinder("SH4_Blue_Drum_Ring_Upper",
                    (DRUM_X, DRUM_Y, DRUM_Z + DRUM_H * 0.22),
                    radius=DRUM_R + 0.015, depth=0.04,
                    mat=mat_blue_drum, parent=root, vertices=16)

    create_cylinder("SH4_Blue_Drum_Ring_Lower",
                    (DRUM_X, DRUM_Y, DRUM_Z - DRUM_H * 0.22),
                    radius=DRUM_R + 0.015, depth=0.04,
                    mat=mat_blue_drum, parent=root, vertices=16)

    create_cylinder("SH4_Drum_Lid",
                    (DRUM_X, DRUM_Y, DRUM_Z + DRUM_H / 2.0 + 0.02),
                    radius=DRUM_R + 0.01, depth=0.04,
                    mat=mat_black_plastic, parent=root, vertices=16)

    create_cylinder("SH4_Drum_Bung1",
                    (DRUM_X + 0.15, DRUM_Y, DRUM_Z + DRUM_H / 2.0 + 0.045),
                    radius=0.035, depth=0.02,
                    mat=mat_black_plastic, parent=root, vertices=8)
    create_cylinder("SH4_Drum_Bung2",
                    (DRUM_X - 0.15, DRUM_Y, DRUM_Z + DRUM_H / 2.0 + 0.045),
                    radius=0.035, depth=0.02,
                    mat=mat_black_plastic, parent=root, vertices=8)

    # -------------------------------------------------------------
    # 10. OVERHEAD IRRIGATION MISTING LINE
    # -------------------------------------------------------------
    MIST_Z = 3.65
    create_pipe_along_polyline("SH4_Irrigation_MainLine",
                               [(0.0, -HALF_L + 0.20, MIST_Z), (0.0, HALF_L - 0.20, MIST_Z)],
                               radius=0.016, mat=mat_pvc_pipe, parent=root)

    for my_idx, my in enumerate(arch_y_coords[1:-1]):
        create_cylinder(f"SH4_Mister_Drop_{my_idx+1}",
                        (0.0, my, MIST_Z - 0.10),
                        radius=0.008, depth=0.20,
                        mat=mat_galv_steel, parent=root, vertices=6)

    # -------------------------------------------------------------
    # BATCH JOIN BY MATERIAL & EXPORT GLB
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
        active.name = f"SH4_Batch_{mname}"
        joined_objs.append(active)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in joined_objs:
        obj.select_set(True)

    os.makedirs(os.path.dirname(TARGET_GLB), exist_ok=True)
    print(f"Exporting GLB to: {TARGET_GLB}...")
    bpy.ops.export_scene.gltf(
        filepath=TARGET_GLB,
        use_selection=True,
        export_format='GLB',
        export_apply=True,
        export_yup=True
    )

    size_bytes = os.path.getsize(TARGET_GLB)
    size_kb = size_bytes / 1024.0
    print(f"SUCCESS! Exported model size: {size_bytes:,} bytes ({size_kb:.2f} KB)")
    assert size_bytes < 300 * 1024, f"Model exceeded budget: {size_bytes} > 300KB"

if __name__ == "__main__":
    build_plot17_screenhouse_4()
