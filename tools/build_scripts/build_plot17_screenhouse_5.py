"""
build_plot17_screenhouse_5.py — Authentic Bespoke 3D Model of DA-LARES Screenhouse 5 (Plot 17)

Phase 5 of Plots 17 & 18 Screenhouse 3D Modeling Plan (docs/screenhouses_3d_modeling_plan.md)
Facility: Screenhouse 5 — Nursery Post-and-Lintel Shade House
Centroid: [121.16741435, 13.95882594], Mapbox rotation: 69.8 deg clockwise.
Dimensions: Width = 18.00 m (local X in [-9.00, +9.00]), Length = 18.00 m (local Y in [-9.00, +9.00])
Area: 325.1 m^2 (Survey polygon #34)

Primary Reference Photographs:
- Building Images/Screenhouses/5 Front View Cropped.jpg (Full post-and-lintel galvanized frame, black shade cloth, northwest entrance door)
- Building Images/Screenhouses/5 Front Door View from Right Side.jpg (Outward swinging galvanized screen door, approach steps, frame joints)
- Building Images/Screenhouses/5 Right Side View.jpg (Flank elevation, pipe grid, perimeter curb wall)
- Building Images/Screenhouses/5 Inside View.jpg (Ground nursery beds, polybag seedlings, central gravel pathways, overhead cables)
- Building Images/Screenhouses/5 Inside View from Front Door.jpg (Interior perspective from entrance door, aisle layout, irrigation lines)
"""

import bpy
import bmesh
import math
import os

TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot17_screenhouse_5.glb"

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

def create_cylinder(name, loc, radius, depth, rot=(0, 0, 0), mat=None, parent=None, vertices=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_pipe_along_polyline(name, points, radius=0.030, mat=None, parent=None, resolution=0):
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

def build_quad_mesh(name, v0, v1, v2, v3, mat=None, parent=None):
    """Creates a single planar quad with correct normal."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    verts = [v0, v1, v2, v3]
    faces = [(0, 1, 2, 3)]
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

def build_plot17_screenhouse_5():
    print("=" * 60)
    print("BUILDING AUTHENTIC DA-LARES PLOT 17 SCREENHOUSE 5 (Phase 5)")
    print("=" * 60)

    clear_scene()

    # 1. Authentic PBR Materials (Calibrated to field photographs)
    # Foundation curb and column footing pedestals
    mat_concrete_curb = get_or_create_material("SH5_ConcreteCurb", (0.54, 0.55, 0.52, 1.0), roughness=0.88, metallic=0.0)
    mat_concrete_pad = get_or_create_material("SH5_FootingPad", (0.42, 0.44, 0.41, 1.0), roughness=0.90, metallic=0.0)
    
    # Interior floors: Soil base + crushed gravel access walkways
    mat_soil_floor = get_or_create_material("SH5_SoilFloor", (0.32, 0.28, 0.24, 1.0), roughness=0.95, metallic=0.0)
    mat_gravel_walkway = get_or_create_material("SH5_GravelPath", (0.50, 0.49, 0.47, 1.0), roughness=0.85, metallic=0.0)

    # Hot-dip galvanized steel tubular pipe superstructure
    mat_galv_post = get_or_create_material("SH5_GalvPost", (0.72, 0.74, 0.76, 1.0), roughness=0.35, metallic=0.85)
    mat_galv_pipe_dark = get_or_create_material("SH5_GalvPipeSecondary", (0.58, 0.60, 0.62, 1.0), roughness=0.45, metallic=0.80)
    mat_tension_cable = get_or_create_material("SH5_SteelCable", (0.60, 0.62, 0.64, 1.0), roughness=0.30, metallic=0.90)

    # Cladding: Heavy-duty agricultural black shade cloth
    mat_black_mesh = get_or_create_material("SH5_BlackShadeNet", (0.08, 0.08, 0.09, 0.88), roughness=0.90, metallic=0.0, alpha=0.85, blend_mode='BLEND')

    # Commercial screen door leaf & fittings
    mat_screen_door = get_or_create_material("SH5_DoorFrame", (0.70, 0.72, 0.74, 1.0), roughness=0.40, metallic=0.75)
    mat_door_mesh = get_or_create_material("SH5_DoorScreenMesh", (0.15, 0.15, 0.16, 0.80), roughness=0.70, alpha=0.80, blend_mode='BLEND')

    # Nursery growing beds & plantlets
    mat_bed_edging = get_or_create_material("SH5_BedEdging", (0.42, 0.38, 0.32, 1.0), roughness=0.80, metallic=0.0)
    mat_polybag = get_or_create_material("SH5_NurseryPolybag", (0.05, 0.05, 0.06, 1.0), roughness=0.75, metallic=0.0)
    mat_foliage = get_or_create_material("SH5_SeedlingFoliage", (0.18, 0.48, 0.12, 1.0), roughness=0.50, metallic=0.0)
    mat_foliage_accent = get_or_create_material("SH5_FoliageAccent", (0.24, 0.54, 0.16, 1.0), roughness=0.45, metallic=0.0)

    # Overhead irrigation pipe
    mat_pvc_pipe = get_or_create_material("SH5_BlueIrrigationPVC", (0.15, 0.42, 0.75, 1.0), roughness=0.38, metallic=0.10)

    root = bpy.data.objects.new("Plot17_Screenhouse_5_Root", None)
    bpy.context.collection.objects.link(root)

    # -------------------------------------------------------------
    # SPATIAL DIMENSIONS (Polygon #34: 18.00m x 18.00m)
    # -------------------------------------------------------------
    WIDTH = 18.00
    LENGTH = 18.00
    HALF_W = WIDTH / 2.0    # 9.00 m
    HALF_L = LENGTH / 2.0   # 9.00 m

    CURB_H = 0.30           # Foundation curb height
    CURB_THICK = 0.18       # Foundation curb thickness

    EAVE_Z = 3.20           # Perimeter eave height
    RIDGE_Z = 3.75          # Gentle center roof rise for tension cables & drainage slope

    # -------------------------------------------------------------
    # 2. FOUNDATION: Perimeter Concrete Curb & Individual Footing Pads
    # -------------------------------------------------------------
    # Soil floor base
    create_box("SH5_Soil_Floor",
               (0.0, 0.0, 0.02),
               (WIDTH - 0.20, LENGTH - 0.20, 0.04),
               mat_soil_floor, parent=root)

    # Perimeter concrete foundation curb (Z = 0 to 0.30m)
    # Left Curb (-X, North wall facing Screenhouse 4)
    # Leaves doorway gap at Y in [-8.70, -7.30] near NW corner
    DOOR_Y_MIN = -8.70
    DOOR_Y_MAX = -7.30
    DOOR_W = DOOR_Y_MAX - DOOR_Y_MIN
    DOOR_CY = (DOOR_Y_MIN + DOOR_Y_MAX) / 2.0

    # North curb section 1 (West of door: Y = -HALF_L to DOOR_Y_MIN)
    NC1_L = DOOR_Y_MIN - (-HALF_L)
    NC1_CY = (-HALF_L + DOOR_Y_MIN) / 2.0
    create_box("SH5_Curb_North_1",
               (-HALF_W + CURB_THICK / 2.0, NC1_CY, CURB_H / 2.0),
               (CURB_THICK, NC1_L, CURB_H),
               mat_concrete_curb, parent=root)

    # North curb section 2 (East of door: Y = DOOR_Y_MAX to +HALF_L)
    NC2_L = HALF_L - DOOR_Y_MAX
    NC2_CY = (DOOR_Y_MAX + HALF_L) / 2.0
    create_box("SH5_Curb_North_2",
               (-HALF_W + CURB_THICK / 2.0, NC2_CY, CURB_H / 2.0),
               (CURB_THICK, NC2_L, CURB_H),
               mat_concrete_curb, parent=root)

    # South Curb (+X wall)
    create_box("SH5_Curb_South",
               (HALF_W - CURB_THICK / 2.0, 0.0, CURB_H / 2.0),
               (CURB_THICK, LENGTH, CURB_H),
               mat_concrete_curb, parent=root)

    # West Curb (-Y wall, facing compound walkway)
    create_box("SH5_Curb_West",
               (0.0, -HALF_L + CURB_THICK / 2.0, CURB_H / 2.0),
               (WIDTH, CURB_THICK, CURB_H),
               mat_concrete_curb, parent=root)

    # East Curb (+Y wall, rear)
    create_box("SH5_Curb_East",
               (0.0, HALF_L - CURB_THICK / 2.0, CURB_H / 2.0),
               (WIDTH, CURB_THICK, CURB_H),
               mat_concrete_curb, parent=root)

    # Entrance stoop / approach pad at NW doorway (extending into alleyway)
    STEP_PROJ = 0.60
    create_box("SH5_Entrance_Stoop",
               (-HALF_W - STEP_PROJ / 2.0, DOOR_CY, 0.12 / 2.0),
               (STEP_PROJ, DOOR_W + 0.30, 0.12),
               mat_concrete_pad, parent=root)

    # -------------------------------------------------------------
    # 3. POST-AND-LINTEL GALVANIZED PIPE SUPERSTRUCTURE (5x5 Grid = 25 Posts)
    # -------------------------------------------------------------
    GRID_COORDS = [-HALF_W + i * (WIDTH / 4.0) for i in range(5)] # [-9.0, -4.5, 0.0, 4.5, 9.0]
    POST_R = 0.038    # ~76mm OD (3-inch) Schedule 40 pipe
    LINTEL_R = 0.030  # ~60mm OD pipe for top girders
    WAIST_R = 0.022   # ~44mm OD pipe for waist rails
    CABLE_R = 0.006   # ~12mm steel tension cable

    for gx in GRID_COORDS:
        for gy in GRID_COORDS:
            is_perimeter = (abs(gx) > HALF_W - 0.1 or abs(gy) > HALF_L - 0.1)
            # Calculate height: center post is highest, eaves are 3.20m
            dist_from_center = math.hypot(gx, gy) / (HALF_W * math.sqrt(2))
            top_z = RIDGE_Z - dist_from_center * (RIDGE_Z - EAVE_Z)
            
            # Concrete footing pad under each post
            create_box(f"SH5_Pad_{gx:.1f}_{gy:.1f}",
                       (gx, gy, 0.10),
                       (0.42, 0.42, 0.20),
                       mat_concrete_pad, parent=root)

            # Vertical pipe column
            create_pipe_along_polyline(
                f"SH5_Post_{gx:.1f}_{gy:.1f}",
                [(gx, gy, 0.15), (gx, gy, top_z)],
                radius=POST_R, mat=mat_galv_post, parent=root
            )

    # Longitudinal Girders along Y (5 lines)
    for gx in GRID_COORDS:
        pts = []
        for gy in GRID_COORDS:
            dist_c = math.hypot(gx, gy) / (HALF_W * math.sqrt(2))
            pz = RIDGE_Z - dist_c * (RIDGE_Z - EAVE_Z)
            pts.append((gx, gy, pz))
        create_pipe_along_polyline(f"SH5_Girder_Y_{gx:.1f}", pts, radius=LINTEL_R, mat=mat_galv_post, parent=root)

    # Transversal Girders along X (5 lines)
    for gy in GRID_COORDS:
        pts = []
        for gx in GRID_COORDS:
            dist_c = math.hypot(gx, gy) / (HALF_W * math.sqrt(2))
            pz = RIDGE_Z - dist_c * (RIDGE_Z - EAVE_Z)
            pts.append((gx, gy, pz))
        create_pipe_along_polyline(f"SH5_Girder_X_{gy:.1f}", pts, radius=LINTEL_R, mat=mat_galv_post, parent=root)

    # Perimeter Mid-Height Waist Rails (Z = 1.45m)
    WAIST_Z = 1.45
    # North wall waist rail (leaves door opening clear)
    create_pipe_along_polyline("SH5_Waist_N1",
                               [(-HALF_W, -HALF_L, WAIST_Z), (-HALF_W, DOOR_Y_MIN, WAIST_Z)],
                               radius=WAIST_R, mat=mat_galv_pipe_dark, parent=root)
    create_pipe_along_polyline("SH5_Waist_N2",
                               [(-HALF_W, DOOR_Y_MAX, WAIST_Z), (-HALF_W, HALF_L, WAIST_Z)],
                               radius=WAIST_R, mat=mat_galv_pipe_dark, parent=root)

    # South wall waist rail
    create_pipe_along_polyline("SH5_Waist_S",
                               [(HALF_W, -HALF_L, WAIST_Z), (HALF_W, HALF_L, WAIST_Z)],
                               radius=WAIST_R, mat=mat_galv_pipe_dark, parent=root)

    # West wall waist rail
    create_pipe_along_polyline("SH5_Waist_W",
                               [(-HALF_W, -HALF_L, WAIST_Z), (HALF_W, -HALF_L, WAIST_Z)],
                               radius=WAIST_R, mat=mat_galv_pipe_dark, parent=root)

    # East wall waist rail
    create_pipe_along_polyline("SH5_Waist_E",
                               [(-HALF_W, HALF_L, WAIST_Z), (HALF_W, HALF_L, WAIST_Z)],
                               radius=WAIST_R, mat=mat_galv_pipe_dark, parent=root)

    # Diagonal corner sway knee braces at 4 exterior corners
    CORNER_BRACE_OFS = 1.60
    for cx_s in [-HALF_W, HALF_W]:
        for cy_s in [-HALF_L, HALF_L]:
            sgn_x = -1 if cx_s < 0 else 1
            sgn_y = -1 if cy_s < 0 else 1
            # Brace along X
            create_pipe_along_polyline(f"SH5_Brace_X_{sgn_x}_{sgn_y}",
                                       [(cx_s, cy_s, 1.20), (cx_s - sgn_x * CORNER_BRACE_OFS, cy_s, EAVE_Z)],
                                       radius=0.018, mat=mat_galv_pipe_dark, parent=root)
            # Brace along Y
            create_pipe_along_polyline(f"SH5_Brace_Y_{sgn_x}_{sgn_y}",
                                       [(cx_s, cy_s, 1.20), (cx_s, cy_s - sgn_y * CORNER_BRACE_OFS, EAVE_Z)],
                                       radius=0.018, mat=mat_galv_pipe_dark, parent=root)

    # Diagonal High-Tensile Steel Tension Cables criss-crossing each 4.5m x 4.5m roof bay
    for bi in range(4):
        x0 = GRID_COORDS[bi]
        x1 = GRID_COORDS[bi + 1]
        for bj in range(4):
            y0 = GRID_COORDS[bj]
            y1 = GRID_COORDS[bj + 1]
            
            z00 = RIDGE_Z - (math.hypot(x0, y0) / (HALF_W * math.sqrt(2))) * (RIDGE_Z - EAVE_Z)
            z11 = RIDGE_Z - (math.hypot(x1, y1) / (HALF_W * math.sqrt(2))) * (RIDGE_Z - EAVE_Z)
            z01 = RIDGE_Z - (math.hypot(x0, y1) / (HALF_W * math.sqrt(2))) * (RIDGE_Z - EAVE_Z)
            z10 = RIDGE_Z - (math.hypot(x1, y0) / (HALF_W * math.sqrt(2))) * (RIDGE_Z - EAVE_Z)

            create_pipe_along_polyline(f"SH5_Cable_Diag1_{bi}_{bj}",
                                       [(x0, y0, z00 + 0.02), (x1, y1, z11 + 0.02)],
                                       radius=CABLE_R, mat=mat_tension_cable, parent=root)
            create_pipe_along_polyline(f"SH5_Cable_Diag2_{bi}_{bj}",
                                       [(x0, y1, z01 + 0.02), (x1, y0, z10 + 0.02)],
                                       radius=CABLE_R, mat=mat_tension_cable, parent=root)

    # -------------------------------------------------------------
    # 4. NORTHWEST CORNER ENTRANCE SCREEN DOORWAY
    # -------------------------------------------------------------
    DOOR_HEAD_Z = 2.45

    # Door jamb vertical pipes
    create_pipe_along_polyline("SH5_DoorJamb_Left",
                               [(-HALF_W, DOOR_Y_MIN, 0.0), (-HALF_W, DOOR_Y_MIN, EAVE_Z)],
                               radius=0.034, mat=mat_galv_post, parent=root)
    create_pipe_along_polyline("SH5_DoorJamb_Right",
                               [(-HALF_W, DOOR_Y_MAX, 0.0), (-HALF_W, DOOR_Y_MAX, EAVE_Z)],
                               radius=0.034, mat=mat_galv_post, parent=root)

    # Door header lintel
    create_pipe_along_polyline("SH5_DoorHeader",
                               [(-HALF_W, DOOR_Y_MIN, DOOR_HEAD_Z), (-HALF_W, DOOR_Y_MAX, DOOR_HEAD_Z)],
                               radius=0.028, mat=mat_galv_post, parent=root)

    # Outward-swinging commercial galvanized pipe screen door leaf
    # Anchored at DOOR_Y_MIN, swung open outward by ~18 degrees into the alleyway
    door_angle = math.radians(18)
    DOOR_LEAF_W = DOOR_W - 0.08
    DOOR_LEAF_H = DOOR_HEAD_Z - 0.12
    dl_cx = -HALF_W - (DOOR_LEAF_W / 2.0) * math.sin(door_angle)
    dl_cy = DOOR_Y_MIN + (DOOR_LEAF_W / 2.0) * math.cos(door_angle)
    dl_cz = 0.10 + DOOR_LEAF_H / 2.0

    # Door leaf outer tubular frame
    bpy.ops.mesh.primitive_cube_add(location=(dl_cx, dl_cy, dl_cz))
    d_obj = bpy.context.active_object
    d_obj.name = "SH5_DoorLeaf_Frame"
    d_obj.scale = (0.04 / 2.0, DOOR_LEAF_W / 2.0, DOOR_LEAF_H / 2.0)
    d_obj.rotation_euler = (0, 0, door_angle)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    d_obj.data.materials.clear()
    d_obj.data.materials.append(mat_screen_door)
    d_obj.parent = root

    # Screen mesh insert on door
    create_box("SH5_DoorLeaf_Mesh",
               (dl_cx, dl_cy, dl_cz),
               (0.01, DOOR_LEAF_W - 0.06, DOOR_LEAF_H - 0.06),
               mat=mat_door_mesh, parent=root)

    # Silver latch handle on door
    latch_cx = -HALF_W - (DOOR_LEAF_W - 0.08) * math.sin(door_angle)
    latch_cy = DOOR_Y_MIN + (DOOR_LEAF_W - 0.08) * math.cos(door_angle)
    create_box("SH5_Door_Latch",
               (latch_cx, latch_cy, 1.15),
               (0.06, 0.14, 0.04),
               mat_galv_post, parent=root)

    # -------------------------------------------------------------
    # 5. HEAVY-DUTY BLACK AGRICULTURAL SHADE NETTING ENCLOSURE
    # -------------------------------------------------------------
    # A. Overhead Roof Shade Netting (Faceted 4x4 bay mesh following tension slope)
    mesh_roof = bpy.data.meshes.new("SH5_Roof_ShadeNet_mesh")
    obj_roof = bpy.data.objects.new("SH5_Roof_ShadeNet", mesh_roof)
    bpy.context.collection.objects.link(obj_roof)

    roof_verts = []
    for bi in range(5):
        gx = GRID_COORDS[bi]
        for bj in range(5):
            gy = GRID_COORDS[bj]
            dist_c = math.hypot(gx, gy) / (HALF_W * math.sqrt(2))
            pz = RIDGE_Z - dist_c * (RIDGE_Z - EAVE_Z) + 0.03
            roof_verts.append((gx, gy, pz))

    roof_faces = []
    for bi in range(4):
        for bj in range(4):
            v0 = bi * 5 + bj
            v1 = bi * 5 + (bj + 1)
            v2 = (bi + 1) * 5 + (bj + 1)
            v3 = (bi + 1) * 5 + bj
            roof_faces.append((v0, v1, v2, v3))

    mesh_roof.from_pydata(roof_verts, [], roof_faces)
    mesh_roof.update()
    obj_roof.data.materials.append(mat_black_mesh)
    obj_roof.parent = root

    # B. Vertical Sidewall Netting Panels (from Curb Top Z = 0.30m to Eave Z = 3.20m)
    WALL_H = EAVE_Z - CURB_H
    WALL_CZ = CURB_H + WALL_H / 2.0

    # North Wall (-X, facing alleyway): Two panels flanking doorway
    create_box("SH5_Netting_North_1",
               (-HALF_W, NC1_CY, WALL_CZ),
               (0.02, NC1_L, WALL_H),
               mat_black_mesh, parent=root)
    create_box("SH5_Netting_North_2",
               (-HALF_W, NC2_CY, WALL_CZ),
               (0.02, NC2_L, WALL_H),
               mat_black_mesh, parent=root)
    # Transom panel above door header
    TRANSOM_H = EAVE_Z - DOOR_HEAD_Z
    create_box("SH5_Netting_North_DoorTransom",
               (-HALF_W, DOOR_CY, DOOR_HEAD_Z + TRANSOM_H / 2.0),
               (0.02, DOOR_W, TRANSOM_H),
               mat_black_mesh, parent=root)

    # South Wall (+X)
    create_box("SH5_Netting_South",
               (HALF_W, 0.0, WALL_CZ),
               (0.02, LENGTH, WALL_H),
               mat_black_mesh, parent=root)

    # West Wall (-Y, facing compound walkway)
    create_box("SH5_Netting_West",
               (0.0, -HALF_L, WALL_CZ),
               (WIDTH, 0.02, WALL_H),
               mat_black_mesh, parent=root)

    # East Wall (+Y, rear)
    create_box("SH5_Netting_East",
               (0.0, HALF_L, WALL_CZ),
               (WIDTH, 0.02, WALL_H),
               mat_black_mesh, parent=root)

    # -------------------------------------------------------------
    # 6. AUTHENTIC INTERIOR NURSERY: Central Pathways & 4 Quadrant Beds
    # -------------------------------------------------------------
    # Central cruciform crushed gravel access pathways
    PATH_W = 1.30
    # N-S Main Pathway (along X axis at Y = 0)
    create_box("SH5_Path_Main_NS",
               (0.0, 0.0, 0.025),
               (WIDTH - 0.40, PATH_W, 0.03),
               mat_gravel_walkway, parent=root)
    # E-W Cross Pathway (along Y axis at X = 0)
    create_box("SH5_Path_Cross_EW",
               (0.0, 0.0, 0.025),
               (PATH_W, LENGTH - 0.40, 0.03),
               mat_gravel_walkway, parent=root)
    # Entrance spur from NW door to central pathway
    create_box("SH5_Path_Entrance_Spur",
               (-HALF_W / 2.0, DOOR_CY, 0.025),
               (HALF_W, PATH_W, 0.03),
               mat_gravel_walkway, parent=root)

    # 4 Quadrant Growing Bed Zones
    BED_QUAD_W = (HALF_W - PATH_W / 2.0 - 0.80)  # ~ 7.55m
    BED_QUAD_L = (HALF_L - PATH_W / 2.0 - 0.80)  # ~ 7.55m
    BED_Z = 0.08
    BED_H = 0.14

    quad_signs = [(-1, -1, "NW"), (-1, 1, "NE"), (1, -1, "SW"), (1, 1, "SE")]

    for qx_sgn, qy_sgn, qname in quad_signs:
        q_cx = qx_sgn * (PATH_W / 2.0 + BED_QUAD_W / 2.0 + 0.30)
        q_cy = qy_sgn * (PATH_W / 2.0 + BED_QUAD_L / 2.0 + 0.30)

        # Edging border frame around quadrant
        create_box(f"SH5_Bed_Border_{qname}",
                   (q_cx, q_cy, BED_Z),
                   (BED_QUAD_W, BED_QUAD_L, BED_H),
                   mat_bed_edging, parent=root)

        # Interior soil / gravel planting surface
        create_box(f"SH5_Bed_Surface_{qname}",
                   (q_cx, q_cy, BED_Z + 0.04),
                   (BED_QUAD_W - 0.20, BED_QUAD_L - 0.20, BED_H),
                   mat_soil_floor, parent=root)

        # 4 Parallel Rows of Nursery Polybag Containers in each quadrant
        num_rows = 4
        row_w = (BED_QUAD_W - 1.0) / num_rows
        row_l = BED_QUAD_L - 0.80
        
        for ri in range(num_rows):
            rx = (q_cx - BED_QUAD_W / 2.0 + 0.60) + ri * (row_w + 0.15)
            
            # Polybag row bed
            create_box(f"SH5_PolyRow_{qname}_{ri+1}",
                       (rx, q_cy, BED_Z + BED_H + 0.10),
                       (row_w * 0.85, row_l, 0.20),
                       mat_polybag, parent=root)

            # Continuous healthy green seedling foliage crowns
            f_mat = mat_foliage if (ri % 2 == 0) else mat_foliage_accent
            create_box(f"SH5_FoliageRow_{qname}_{ri+1}",
                       (rx, q_cy, BED_Z + BED_H + 0.26),
                       (row_w * 1.15, row_l - 0.10, 0.16),
                       f_mat, parent=root)

        # Modular accent sapling trees / palm crowns along aisle borders
        for ti in range(3):
            tx = q_cx - qx_sgn * (BED_QUAD_W / 2.0 - 0.60)
            ty = (q_cy - BED_QUAD_L / 2.0 + 1.20) + ti * (BED_QUAD_L - 2.40) / 2.0
            create_cylinder(f"SH5_AccentSapling_{qname}_{ti+1}",
                            (tx, ty, BED_Z + BED_H + 0.45),
                            radius=0.25, depth=0.50, rot=(0, 0, (ti + qx_sgn) * 0.9),
                            mat=mat_foliage_accent, parent=root, vertices=6)

    # -------------------------------------------------------------
    # 7. OVERHEAD IRRIGATION MISTING LINE NETWORK
    # -------------------------------------------------------------
    MIST_Z = 3.05
    # Main irrigation header along North-South
    create_pipe_along_polyline("SH5_Irrigation_Header_NS",
                               [(0.0, -HALF_L + 0.60, MIST_Z), (0.0, HALF_L - 0.60, MIST_Z)],
                               radius=0.016, mat=mat_pvc_pipe, parent=root)

    # Transversal branch lines over each quadrant
    for by in [-4.5, 4.5]:
        create_pipe_along_polyline(f"SH5_Irrigation_Branch_{by:.1f}",
                                   [(-HALF_W + 0.80, by, MIST_Z), (HALF_W - 0.80, by, MIST_Z)],
                                   radius=0.014, mat=mat_pvc_pipe, parent=root)
        # Nozzle drops
        for bx in [-6.5, -2.5, 2.5, 6.5]:
            create_cylinder(f"SH5_Nozzle_{bx:.1f}_{by:.1f}",
                            (bx, by, MIST_Z - 0.10),
                            radius=0.008, depth=0.18,
                            mat=mat_galv_post, parent=root, vertices=6)

    # -------------------------------------------------------------
    # 8. BATCH JOIN BY MATERIAL & EXPORT OPTIMIZED GLB
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
        active.name = f"SH5_Batch_{mname}"
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
    build_plot17_screenhouse_5()
