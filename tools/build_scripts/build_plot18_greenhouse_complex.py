"""
build_plot18_greenhouse_complex.py — Authentic Bespoke 3D Model of DA-LARES Plot 18 Research Greenhouse Complex

Phase 6 of Plots 17 & 18 Screenhouse 3D Modeling Plan (docs/screenhouses_3d_modeling_plan.md)
Facility: Plot 18 Research Greenhouse Complex — Contiguous Bays 6, 7, and 8
Centroid: [121.16761281, 13.95902581], Mapbox rotation: 339.5 deg (facing NNW).
Dimensions: Total Width = 24.85 m (3 bays x 8.283 m), Total Length = 32.80 m (local Y in [-16.40, +16.40])
Area: 821.5 m^2 (Survey polygon #36 / contiguous bays 6, 7, 8)

Sub-Plot Layout (Ground-Truth):
- Bay 6 (West Bay, X in [-12.425, -4.142], center X = -8.283 m):
  Clonal Coffee Gothic Arch Tunnel fully enclosed in black agricultural shade cloth,
  prominent high-mounted square ventilation louver box, concrete entrance vestibule.
- Bay 7 (Center Bay, X in [-4.142, +4.142], center X = 0.000 m):
  Certified Citrus Rootstock Curved Steel Truss Arch Bay, high ventilation louver box,
  concrete entrance booth, rows of nursery polybag saplings.
- Bay 8 (East Bay, X in [+4.142, +12.425], center X = +8.283 m):
  Coffee & Scion Propagation Open-Air Curved Steel Truss Arch Bay, longitudinal valley gutters,
  propagation beds, water barrels, white monobloc chair.

Primary Reference Photographs:
- Building Images/Screenhouses/6 7 8 Front View.jpg (Three contiguous arch bays facing front entrance lawn)
- Building Images/Screenhouses/6 7 8 Side View.jpg (Flank elevation of Bay 6 black shade cloth tunnel)
- Building Images/Screenhouses/6 Inside View.jpg (Clonal coffee nursery tables under black shade cloth)
- Building Images/Screenhouses/7 Inside View.jpg (Curved steel truss webbing, black divider wall, citrus rootstocks)
- Building Images/Screenhouses/8 Inside View.jpg (Open curved steel trusses, propagation beds, water barrels, white chair)
"""

import bpy
import bmesh
import math
import os

TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot18_greenhouse_complex.glb"

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
    curve_data.resolution_u = 1
    
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

def create_curved_ribbon_mesh(name, pts_left, pts_right, mat=None, parent=None):
    """Creates a continuous quad mesh ribbon between two parallel curves (used for shade cloth canopy)."""
    assert len(pts_left) == len(pts_right)
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    verts = []
    faces = []
    n = len(pts_left)
    for i in range(n):
        verts.append(pts_left[i])
        verts.append(pts_right[i])
    for i in range(n - 1):
        v0 = i * 2
        v1 = i * 2 + 1
        v2 = (i + 1) * 2 + 1
        v3 = (i + 1) * 2
        faces.append((v0, v1, v2, v3))
        
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

def create_arch_gable_mesh(name, arch_pts, eave_z, mat=None, parent=None):
    """Creates a planar vertical gable end face bounded by the arch points and the eave tie line."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    y_val = arch_pts[0][1]
    verts = [(arch_pts[0][0], y_val, eave_z), (arch_pts[-1][0], y_val, eave_z)]
    for pt in reversed(arch_pts):
        verts.append(pt)
        
    face = list(range(len(verts)))
    mesh.from_pydata(verts, [], [face])
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

def build_gothic_arch_points(cx, half_w, z_eave, z_apex, y_val, num_segs=16):
    """Calculates points for a gothic pointed arch formed by two intersecting circular arcs."""
    # Each half arch has center offset outside the opposite side or below
    # Parametric gothic arch: x(t) = cx +/- (half_w * (1 - t^1.4)), z(t) = z_eave + (z_apex - z_eave) * sin(t * pi/2)
    pts = []
    # Left half: from -half_w to 0
    half_n = num_segs // 2
    for i in range(half_n + 1):
        t = i / half_n
        x = cx - half_w * (1.0 - t)
        z = z_eave + (z_apex - z_eave) * math.pow(t, 0.72)
        pts.append((x, y_val, z))
    # Right half: from 0 to +half_w
    for i in range(1, half_n + 1):
        t = 1.0 - (i / half_n)
        x = cx + half_w * (1.0 - t)
        z = z_eave + (z_apex - z_eave) * math.pow(t, 0.72)
        pts.append((x, y_val, z))
    return pts

def build_curved_arch_points(cx, half_w, z_eave, z_apex, y_val, num_segs=16):
    """Calculates points for a circular truss arch spanning cx - half_w to cx + half_w."""
    rise = z_apex - z_eave
    R = (rise**2 + half_w**2) / (2.0 * rise)
    center_z = z_apex - R
    theta_max = math.asin(half_w / R)
    
    pts = []
    for i in range(num_segs + 1):
        t = -theta_max + 2.0 * theta_max * (i / num_segs)
        px = cx + R * math.sin(t)
        pz = center_z + R * math.cos(t)
        pts.append((px, y_val, pz))
    return pts

def build_plot18_greenhouse_complex():
    print("=" * 65)
    print("BUILDING AUTHENTIC DA-LARES PLOT 18 RESEARCH GREENHOUSE COMPLEX (Phase 6)")
    print("=" * 65)

    clear_scene()

    # -------------------------------------------------------------
    # 1. PBR MATERIALS CALIBRATED TO FIELD PHOTOGRAPHS
    # -------------------------------------------------------------
    # Weathered concrete foundation plinth & curb walls
    mat_concrete = get_or_create_material("GH_ConcretePlinth", (0.50, 0.51, 0.49, 1.0), roughness=0.90, metallic=0.0)
    mat_stucco_vestibule = get_or_create_material("GH_VestibuleStucco", (0.55, 0.54, 0.51, 1.0), roughness=0.88, metallic=0.0)
    mat_soil_floor = get_or_create_material("GH_SoilFloor", (0.34, 0.30, 0.25, 1.0), roughness=0.95, metallic=0.0)
    mat_gravel_path = get_or_create_material("GH_GravelPath", (0.60, 0.59, 0.56, 1.0), roughness=0.92, metallic=0.0)

    # Galvanized tubular steel structure (columns, truss chords, purlins, valley gutters)
    mat_galv_steel = get_or_create_material("GH_GalvSteel", (0.70, 0.72, 0.74, 1.0), roughness=0.35, metallic=0.88)
    mat_dark_frame = get_or_create_material("GH_DarkMetalFrame", (0.22, 0.23, 0.25, 1.0), roughness=0.50, metallic=0.60)

    # Black agricultural shade cloth netting (Gothic Tunnel & Gable screens)
    mat_black_shade = get_or_create_material("GH_BlackShadeCloth", (0.12, 0.12, 0.13, 0.88), roughness=0.85, metallic=0.0, alpha=0.88, blend_mode='BLEND')
    mat_black_louver = get_or_create_material("GH_BlackLouverUnit", (0.10, 0.10, 0.11, 1.0), roughness=0.45, metallic=0.50)

    # Nursery polybags, seedling foliage crowns & accent plants
    mat_polybag = get_or_create_material("GH_PolybagContainer", (0.08, 0.08, 0.09, 1.0), roughness=0.80, metallic=0.0)
    mat_foliage = get_or_create_material("GH_CitrusFoliage", (0.18, 0.42, 0.12, 1.0), roughness=0.65, metallic=0.0)
    mat_foliage_accent = get_or_create_material("GH_CoffeeFoliage", (0.24, 0.50, 0.15, 1.0), roughness=0.60, metallic=0.0)

    # Accent props: Blue plastic water drum, grey nursery barrel, white monobloc chair
    mat_blue_drum = get_or_create_material("GH_BlueWaterDrum", (0.15, 0.35, 0.65, 1.0), roughness=0.30, metallic=0.05)
    mat_grey_barrel = get_or_create_material("GH_GreyNurseryBarrel", (0.42, 0.44, 0.45, 1.0), roughness=0.50, metallic=0.10)
    mat_white_chair = get_or_create_material("GH_WhitePlasticChair", (0.92, 0.92, 0.92, 1.0), roughness=0.25, metallic=0.0)

    root = bpy.data.objects.new("Plot18_Greenhouse_Complex_Root", None)
    bpy.context.collection.objects.link(root)

    # -------------------------------------------------------------
    # 2. SPATIAL DIMENSIONS (Contiguous 3-Bay Complex)
    # -------------------------------------------------------------
    TOTAL_W = 24.85
    TOTAL_L = 32.80
    HALF_W = TOTAL_W / 2.0   # 12.425 m
    HALF_L = TOTAL_L / 2.0   # 16.400 m

    BAY_W = TOTAL_W / 3.0    # 8.2833 m per bay
    # Bay Centers along local X:
    CX_6 = -BAY_W            # -8.283 m (West Bay: Gothic Clonal Coffee Tunnel)
    CX_7 = 0.000             #  0.000 m (Center Bay: Citrus Rootstock Curved Truss Bay)
    CX_8 = +BAY_W            # +8.283 m (East Bay: Coffee & Scion Propagation Bay)

    # Longitudinal Bay Intersections (Valley Gutter lines):
    VALLEY_X_67 = -BAY_W / 2.0  # -4.142 m
    VALLEY_X_78 = +BAY_W / 2.0  # +4.142 m

    PLINTH_H = 0.35          # Concrete foundation plinth height
    EAVE_Z = 2.40            # Horizontal eave / valley gutter beam height
    APEX_Z_GOTHIC = 4.85     # Bay 6 gothic apex ridge
    APEX_Z_CURVED = 4.70     # Bays 7 & 8 curved truss arch apex
    TRUSS_DEPTH = 0.35       # Structural truss depth for curved bays

    PIPE_COL_R = 0.038       # 76mm OD main structural column pipe
    PIPE_ARCH_R = 0.026      # 52mm OD arch chord pipe
    PIPE_WEB_R = 0.016       # 32mm OD truss lacing pipe
    PIPE_PUR_R = 0.018       # 36mm OD longitudinal purlin pipe

    # -------------------------------------------------------------
    # 3. CONCRETE FOUNDATION PLINTH & INTERIOR FLOOR
    # -------------------------------------------------------------
    # A. Perimeter Concrete Foundation Plinths (4 outer sides)
    CURB_THICK = 0.22
    # West Plinth (X = -HALF_W)
    create_box("GH_Plinth_West",
               (-HALF_W + CURB_THICK / 2.0, 0.0, PLINTH_H / 2.0),
               (CURB_THICK, TOTAL_L, PLINTH_H),
               mat_concrete, root)
    # East Plinth (X = +HALF_W)
    create_box("GH_Plinth_East",
               (+HALF_W - CURB_THICK / 2.0, 0.0, PLINTH_H / 2.0),
               (CURB_THICK, TOTAL_L, PLINTH_H),
               mat_concrete, root)
    # North Plinth (Front facade at Y = +HALF_L)
    create_box("GH_Plinth_North",
               (0.0, HALF_L - CURB_THICK / 2.0, PLINTH_H / 2.0),
               (TOTAL_W, CURB_THICK, PLINTH_H),
               mat_concrete, root)
    # South Plinth (Rear facade at Y = -HALF_L)
    create_box("GH_Plinth_South",
               (0.0, -HALF_L + CURB_THICK / 2.0, PLINTH_H / 2.0),
               (TOTAL_W, CURB_THICK, PLINTH_H),
               mat_concrete, root)

    # B. Intermediate Longitudinal Column Plinths along Valley Gutters
    create_box("GH_Plinth_Valley_67",
               (VALLEY_X_67, 0.0, PLINTH_H / 2.0),
               (0.20, TOTAL_L - CURB_THICK * 2, PLINTH_H),
               mat_concrete, root)
    create_box("GH_Plinth_Valley_78",
               (VALLEY_X_78, 0.0, PLINTH_H / 2.0),
               (0.20, TOTAL_L - CURB_THICK * 2, PLINTH_H),
               mat_concrete, root)

    # C. Interior Soil / Gravel Floor Slabs for each bay
    for bi, cx in enumerate([CX_6, CX_7, CX_8]):
        bname = f"Bay_{bi+6}"
        create_box(f"GH_Floor_Soil_{bname}",
                   (cx, 0.0, 0.05),
                   (BAY_W - 0.35, TOTAL_L - 0.45, 0.10),
                   mat_soil_floor, root)
        # Central Walkway Aisle through each bay
        create_box(f"GH_Floor_Path_{bname}",
                   (cx, 0.0, 0.07),
                   (1.20, TOTAL_L - 0.50, 0.08),
                   mat_gravel_path, root)

    # -------------------------------------------------------------
    # 4. STRUCTURAL COLUMNS & VALLEY GUTTERS (6 Longitudinal Bays / 7 Frames)
    # -------------------------------------------------------------
    NUM_FRAMES = 7
    BAY_LEN = TOTAL_L / (NUM_FRAMES - 1)  # 5.46 m per bay
    y_frames = [-HALF_L + i * BAY_LEN for i in range(NUM_FRAMES)]

    # 4 Longitudinal Column Lines:
    # 1. West Flank (X = -HALF_W)
    # 2. Valley Gutter 6-7 (X = VALLEY_X_67)
    # 3. Valley Gutter 7-8 (X = VALLEY_X_78)
    # 4. East Flank (X = +HALF_W)
    col_x_lines = [-HALF_W, VALLEY_X_67, VALLEY_X_78, HALF_W]

    for ci, col_x in enumerate(col_x_lines):
        # Vertical steel support posts (6 vertices per cylinder)
        for fi, yf in enumerate(y_frames):
            create_cylinder(f"GH_Col_Line_{ci}_Post_{fi}",
                            (col_x, yf, (PLINTH_H + EAVE_Z) / 2.0),
                            PIPE_COL_R, EAVE_Z - PLINTH_H,
                            mat=mat_galv_steel, parent=root, vertices=6)

        # Longitudinal Eave / Valley Gutter Beams spanning full 32.8m length
        if ci in [1, 2]:
            # Valley Gutter Beam: U-profile galvanized steel sheet channel
            create_box(f"GH_ValleyGutter_{ci}",
                       (col_x, 0.0, EAVE_Z),
                       (0.30, TOTAL_L, 0.10),
                       mat_galv_steel, root)
            # Internal gutter trough bottom
            create_box(f"GH_ValleyGutter_Trough_{ci}",
                       (col_x, 0.0, EAVE_Z + 0.02),
                       (0.22, TOTAL_L, 0.03),
                       mat_dark_frame, root)
        else:
            # Outer Eave Pipe Beam
            create_pipe_along_polyline(f"GH_OuterEaveBeam_{ci}",
                                       [(col_x, -HALF_L, EAVE_Z), (col_x, HALF_L, EAVE_Z)],
                                       radius=PIPE_COL_R, mat=mat_galv_steel, parent=root)

    # -------------------------------------------------------------
    # 5. BAY 6: CLONAL COFFEE GOTHIC ARCH TUNNEL (West Bay)
    # -------------------------------------------------------------
    # A. Structural Gothic Arch Ribs
    bay6_half_w = BAY_W / 2.0  # 4.142 m
    for fi, yf in enumerate(y_frames):
        gothic_pts = build_gothic_arch_points(CX_6, bay6_half_w, EAVE_Z, APEX_Z_GOTHIC, yf, num_segs=6)
        create_pipe_along_polyline(f"GH_Bay6_GothicArch_{fi}",
                                   gothic_pts, radius=PIPE_ARCH_R, mat=mat_galv_steel, parent=root)
        # Horizontal Tie Beam at eave level
        create_pipe_along_polyline(f"GH_Bay6_TieBeam_{fi}",
                                   [(CX_6 - bay6_half_w, yf, EAVE_Z), (CX_6 + bay6_half_w, yf, EAVE_Z)],
                                   radius=PIPE_PUR_R, mat=mat_galv_steel, parent=root)
        # Vertical King Strut to gothic apex
        create_pipe_along_polyline(f"GH_Bay6_KingStrut_{fi}",
                                   [(CX_6, yf, EAVE_Z), (CX_6, yf, APEX_Z_GOTHIC)],
                                   radius=PIPE_PUR_R, mat=mat_galv_steel, parent=root)

    # B. Longitudinal Purlins for Bay 6 (5 continuous lines)
    purlin_offsets = [-2.85, -1.50, 0.00, 1.50, 2.85]
    for pi, poff in enumerate(purlin_offsets):
        pz = EAVE_Z + (APEX_Z_GOTHIC - EAVE_Z) * math.pow(1.0 - abs(poff) / bay6_half_w, 0.72) if abs(poff) > 0 else APEX_Z_GOTHIC
        create_pipe_along_polyline(f"GH_Bay6_Purlin_{pi}",
                                   [(CX_6 + poff, -HALF_L, pz), (CX_6 + poff, HALF_L, pz)],
                                   radius=PIPE_PUR_R, mat=mat_galv_steel, parent=root)

    # C. Black Agricultural Shade Cloth Canopy Mesh (Watertight continuous curved cover)
    for si in range(NUM_FRAMES - 1):
        y0 = y_frames[si]
        y1 = y_frames[si + 1]
        pts_front = build_gothic_arch_points(CX_6, bay6_half_w, EAVE_Z, APEX_Z_GOTHIC, y1, num_segs=6)
        pts_back  = build_gothic_arch_points(CX_6, bay6_half_w, EAVE_Z, APEX_Z_GOTHIC, y0, num_segs=6)
        create_curved_ribbon_mesh(f"GH_Bay6_ShadeCanopy_Seg_{si}", pts_back, pts_front, mat=mat_black_shade, parent=root)

    # West Flank Shade Cloth Enclosure Wall (from Plinth to Eave Z along X = -HALF_W)
    create_box("GH_Bay6_ShadeWall_West",
               (-HALF_W + 0.01, 0.0, (PLINTH_H + EAVE_Z) / 2.0),
               (0.02, TOTAL_L, EAVE_Z - PLINTH_H),
               mat_black_shade, root)

    # Rear Gable Shade Cloth Wall (at Y = -HALF_L)
    create_box("GH_Bay6_RearGable_Base",
               (CX_6, -HALF_L + 0.01, (PLINTH_H + EAVE_Z) / 2.0),
               (BAY_W, 0.02, EAVE_Z - PLINTH_H),
               mat_black_shade, root)
    rear_gothic_pts = build_gothic_arch_points(CX_6, bay6_half_w, EAVE_Z, APEX_Z_GOTHIC, -HALF_L + 0.01, num_segs=8)
    create_arch_gable_mesh("GH_Bay6_RearGable_Arch", rear_gothic_pts, EAVE_Z, mat=mat_black_shade, parent=root)

    # Front Gable Shade Cloth Wall (at Y = +HALF_L)
    create_box("GH_Bay6_FrontGable_Base",
               (CX_6, HALF_L - 0.01, (PLINTH_H + EAVE_Z) / 2.0),
               (BAY_W, 0.02, EAVE_Z - PLINTH_H),
               mat_black_shade, root)
    front_gothic_pts = build_gothic_arch_points(CX_6, bay6_half_w, EAVE_Z, APEX_Z_GOTHIC, HALF_L - 0.01, num_segs=8)
    create_arch_gable_mesh("GH_Bay6_FrontGable_Arch", front_gothic_pts, EAVE_Z, mat=mat_black_shade, parent=root)

    # D. Bay 6 High-Mounted Square Ventilation Louver Box (Front View ground-truth!)
    LOUVER_SIZE = 1.25
    LOUVER_DEPTH = 0.35
    LOUVER_Z = 4.10
    create_box("GH_Bay6_Louver_Box",
               (CX_6, HALF_L + LOUVER_DEPTH / 2.0 - 0.05, LOUVER_Z),
               (LOUVER_SIZE, LOUVER_DEPTH, LOUVER_SIZE),
               mat_black_louver, root)
    # Louver Frame Trim
    create_box("GH_Bay6_Louver_Trim",
               (CX_6, HALF_L + LOUVER_DEPTH, LOUVER_Z),
               (LOUVER_SIZE + 0.08, 0.04, LOUVER_SIZE + 0.08),
               mat_dark_frame, root)
    # Horizontal louver blades
    for li in range(6):
        lz = (LOUVER_Z - LOUVER_SIZE / 2.0 + 0.12) + li * (LOUVER_SIZE - 0.24) / 5.0
        create_box(f"GH_Bay6_Louver_Blade_{li}",
                   (CX_6, HALF_L + LOUVER_DEPTH + 0.01, lz),
                   (LOUVER_SIZE - 0.10, 0.02, 0.06),
                   mat_black_louver, root)

    # E. Bay 6 Concrete Entrance Vestibule Box (Front Ground View)
    VEST6_W = 1.70
    VEST6_L = 1.50
    VEST6_H = 2.30
    VEST6_CX = CX_6 + bay6_half_w - VEST6_W / 2.0 - 0.15  # adjacent to valley gutter
    create_box("GH_Bay6_Vestibule_Body",
               (VEST6_CX, HALF_L + VEST6_L / 2.0 - 0.20, (PLINTH_H + VEST6_H) / 2.0),
               (VEST6_W, VEST6_L, VEST6_H - PLINTH_H),
               mat_stucco_vestibule, root)
    # Vestibule Concrete Roof Slab
    create_box("GH_Bay6_Vestibule_Roof",
               (VEST6_CX, HALF_L + VEST6_L / 2.0 - 0.20, VEST6_H + 0.05),
               (VEST6_W + 0.16, VEST6_L + 0.16, 0.10),
               mat_concrete, root)
    # Commercial Entry Doorway / Door
    create_box("GH_Bay6_Vestibule_Door",
               (VEST6_CX, HALF_L + VEST6_L - 0.18, (PLINTH_H + 2.05) / 2.0),
               (0.95, 0.06, 2.05 - PLINTH_H),
               mat_dark_frame, root)
    create_box("GH_Bay6_Vestibule_Doormat",
               (VEST6_CX, HALF_L + VEST6_L + 0.25, PLINTH_H / 2.0),
               (1.10, 0.60, PLINTH_H),
               mat_concrete, root)

    # F. Bay 6 Interior Clonal Coffee Nursery Tables (6 Inside View.jpg)
    for ti in range(8):
        ty = -HALF_L + 2.20 + ti * 3.60
        for tx_side in [-1.50, 1.50]:
            # Nursery bench frame
            create_box(f"GH_Bay6_Table_{ti}_{tx_side}",
                       (CX_6 + tx_side, ty, 0.85 / 2.0 + 0.10),
                       (1.20, 2.60, 0.85),
                       mat_dark_frame, root)
            # Seedling flats / polybags with green coffee sapling crowns
            create_box(f"GH_Bay6_CoffeeSeedlings_{ti}_{tx_side}",
                       (CX_6 + tx_side, ty, 0.95),
                       (1.10, 2.50, 0.20),
                       mat_foliage_accent, root)

    # -------------------------------------------------------------
    # 6. BAY 7: CITRUS ROOTSTOCK CURVED STEEL TRUSS ARCH BAY (Center Bay)
    # -------------------------------------------------------------
    bay7_half_w = BAY_W / 2.0  # 4.142 m
    for fi, yf in enumerate(y_frames):
        # Top Chord of Curved Truss
        top_pts = build_curved_arch_points(CX_7, bay7_half_w, EAVE_Z, APEX_Z_CURVED, yf, num_segs=6)
        create_pipe_along_polyline(f"GH_Bay7_TopChord_{fi}", top_pts, radius=PIPE_ARCH_R, mat=mat_galv_steel, parent=root)

        # Bottom Chord of Curved Truss (offset down by TRUSS_DEPTH)
        bot_pts = build_curved_arch_points(CX_7, bay7_half_w, EAVE_Z, APEX_Z_CURVED - TRUSS_DEPTH, yf, num_segs=6)
        create_pipe_along_polyline(f"GH_Bay7_BotChord_{fi}", bot_pts, radius=PIPE_ARCH_R * 0.85, mat=mat_galv_steel, parent=root)

        # Continuous Diagonal Zigzag Web Lacing
        zigzag_pts = []
        for wi in range(len(top_pts) - 1):
            zigzag_pts.append(top_pts[wi])
            zigzag_pts.append(bot_pts[wi + 1])
        zigzag_pts.append(top_pts[-1])
        create_pipe_along_polyline(f"GH_Bay7_WebTruss_{fi}", zigzag_pts, radius=PIPE_WEB_R, mat=mat_galv_steel, parent=root)

        # Horizontal Tie Beam at eave level
        create_pipe_along_polyline(f"GH_Bay7_TieBeam_{fi}",
                                   [(CX_7 - bay7_half_w, yf, EAVE_Z), (CX_7 + bay7_half_w, yf, EAVE_Z)],
                                   radius=PIPE_PUR_R, mat=mat_galv_steel, parent=root)

    # Bay 7 Longitudinal Purlins (5 lines)
    purlin_angles = [-2.80, -1.40, 0.00, 1.40, 2.80]
    rise_c = APEX_Z_CURVED - EAVE_Z
    R_c = (rise_c**2 + bay7_half_w**2) / (2.0 * rise_c)
    cz_c = APEX_Z_CURVED - R_c
    for pi, poff in enumerate(purlin_angles):
        pz = cz_c + math.sqrt(max(0.0, R_c**2 - poff**2))
        create_pipe_along_polyline(f"GH_Bay7_Purlin_{pi}",
                                   [(CX_7 + poff, -HALF_L, pz), (CX_7 + poff, HALF_L, pz)],
                                   radius=PIPE_PUR_R, mat=mat_galv_steel, parent=root)

    # Bay 7 Divider Wall (Shade cloth dividing Bay 7 from Bay 6 along VALLEY_X_67)
    create_box("GH_Bay7_Divider_West",
               (VALLEY_X_67 + 0.01, 0.0, (PLINTH_H + EAVE_Z + 0.80) / 2.0),
               (0.02, TOTAL_L, EAVE_Z + 0.80 - PLINTH_H),
               mat_black_shade, root)

    # Front Gable Shade Netting & High Louver Box on Bay 7
    front_curved_pts = build_curved_arch_points(CX_7, bay7_half_w, EAVE_Z, APEX_Z_CURVED, HALF_L - 0.01, num_segs=8)
    create_arch_gable_mesh("GH_Bay7_FrontGable_Net", front_curved_pts, EAVE_Z, mat=mat_black_shade, parent=root)

    create_box("GH_Bay7_Louver_Box",
               (CX_7, HALF_L + LOUVER_DEPTH / 2.0 - 0.05, 4.05),
               (LOUVER_SIZE, LOUVER_DEPTH, LOUVER_SIZE),
               mat_black_louver, root)
    create_box("GH_Bay7_Louver_Trim",
               (CX_7, HALF_L + LOUVER_DEPTH, 4.05),
               (LOUVER_SIZE + 0.08, 0.04, LOUVER_SIZE + 0.08),
               mat_dark_frame, root)
    for li in range(6):
        lz = (4.05 - LOUVER_SIZE / 2.0 + 0.12) + li * (LOUVER_SIZE - 0.24) / 5.0
        create_box(f"GH_Bay7_Louver_Blade_{li}",
                   (CX_7, HALF_L + LOUVER_DEPTH + 0.01, lz),
                   (LOUVER_SIZE - 0.10, 0.02, 0.06),
                   mat_black_louver, root)

    # Small Concrete Entrance Booth / Headhouse on Bay 7 Front
    VEST7_W = 1.60
    VEST7_L = 1.40
    VEST7_H = 2.25
    VEST7_CX = CX_7 - bay7_half_w / 2.0 + 0.30
    create_box("GH_Bay7_Vestibule_Body",
               (VEST7_CX, HALF_L + VEST7_L / 2.0 - 0.20, (PLINTH_H + VEST7_H) / 2.0),
               (VEST7_W, VEST7_L, VEST7_H - PLINTH_H),
               mat_stucco_vestibule, root)
    create_box("GH_Bay7_Vestibule_Roof",
               (VEST7_CX, HALF_L + VEST7_L / 2.0 - 0.20, VEST7_H + 0.04),
               (VEST7_W + 0.14, VEST7_L + 0.14, 0.08),
               mat_concrete, root)
    create_box("GH_Bay7_Vestibule_Door",
               (VEST7_CX, HALF_L + VEST7_L - 0.18, (PLINTH_H + 2.00) / 2.0),
               (0.90, 0.06, 2.00 - PLINTH_H),
               mat_dark_frame, root)

    # Interior Certified Citrus Rootstocks in Polybags (7 Inside View.jpg)
    for side_sgn in [-1.0, 1.0]:
        bed_cx = CX_7 + side_sgn * 2.20
        for bi in range(6):
            by = -HALF_L + 2.50 + bi * 4.80
            create_box(f"GH_Bay7_CitrusPoly_{side_sgn}_{bi}",
                       (bed_cx, by, 0.20),
                       (2.20, 3.80, 0.25),
                       mat_polybag, root)
            create_box(f"GH_Bay7_CitrusCanopy_{side_sgn}_{bi}",
                       (bed_cx, by, 0.55),
                       (2.40, 3.90, 0.45),
                       mat_foliage, root)

    # -------------------------------------------------------------
    # 7. BAY 8: COFFEE & SCION PROPAGATION BAY (East Bay)
    # -------------------------------------------------------------
    bay8_half_w = BAY_W / 2.0  # 4.142 m
    for fi, yf in enumerate(y_frames):
        # Top Chord
        top_pts = build_curved_arch_points(CX_8, bay8_half_w, EAVE_Z, APEX_Z_CURVED, yf, num_segs=6)
        create_pipe_along_polyline(f"GH_Bay8_TopChord_{fi}", top_pts, radius=PIPE_ARCH_R, mat=mat_galv_steel, parent=root)

        # Bottom Chord
        bot_pts = build_curved_arch_points(CX_8, bay8_half_w, EAVE_Z, APEX_Z_CURVED - TRUSS_DEPTH, yf, num_segs=6)
        create_pipe_along_polyline(f"GH_Bay8_BotChord_{fi}", bot_pts, radius=PIPE_ARCH_R * 0.85, mat=mat_galv_steel, parent=root)

        # Continuous Diagonal Zigzag Web Lacing
        zigzag_pts = []
        for wi in range(len(top_pts) - 1):
            zigzag_pts.append(top_pts[wi])
            zigzag_pts.append(bot_pts[wi + 1])
        zigzag_pts.append(top_pts[-1])
        create_pipe_along_polyline(f"GH_Bay8_WebTruss_{fi}", zigzag_pts, radius=PIPE_WEB_R, mat=mat_galv_steel, parent=root)

        # Horizontal Tie Beam
        create_pipe_along_polyline(f"GH_Bay8_TieBeam_{fi}",
                                   [(CX_8 - bay8_half_w, yf, EAVE_Z), (CX_8 + bay8_half_w, yf, EAVE_Z)],
                                   radius=PIPE_PUR_R, mat=mat_galv_steel, parent=root)

    # Bay 8 Longitudinal Purlins (5 lines)
    for pi, poff in enumerate(purlin_angles):
        pz = cz_c + math.sqrt(max(0.0, R_c**2 - poff**2))
        create_pipe_along_polyline(f"GH_Bay8_Purlin_{pi}",
                                   [(CX_8 + poff, -HALF_L, pz), (CX_8 + poff, HALF_L, pz)],
                                   radius=PIPE_PUR_R, mat=mat_galv_steel, parent=root)

    # Bay 8 Front Gable Fan / Vent Frame at apex
    create_box("GH_Bay8_FrontVent_Frame",
               (CX_8, HALF_L, 4.05),
               (1.10, 0.10, 1.10),
               mat_galv_steel, root)
    create_cylinder("GH_Bay8_FanShroud",
                    (CX_8, HALF_L + 0.06, 4.05),
                    0.45, 0.12, rot=(math.radians(90), 0, 0),
                    mat=mat_dark_frame, parent=root, vertices=8)

    # East Outer Flank Wire Mesh Lower Skirt (Z = Plinth to 1.4m along X = +HALF_W)
    create_box("GH_Bay8_EastSkirt",
               (HALF_W - 0.01, 0.0, (PLINTH_H + 1.40) / 2.0),
               (0.02, TOTAL_L, 1.40 - PLINTH_H),
               mat_galv_steel, root)

    # Ground Propagation Beds for Bay 8
    for side_sgn in [-1.0, 1.0]:
        bed_cx = CX_8 + side_sgn * 2.20
        for bi in range(6):
            by = -HALF_L + 2.50 + bi * 4.80
            create_box(f"GH_Bay8_PropBed_{side_sgn}_{bi}",
                       (bed_cx, by, 0.18),
                       (2.10, 3.80, 0.20),
                       mat_polybag, root)
            create_box(f"GH_Bay8_PropFoliage_{side_sgn}_{bi}",
                       (bed_cx, by, 0.45),
                       (2.20, 3.85, 0.35),
                       mat_foliage_accent, root)

    # -------------------------------------------------------------
    # 8. ICONIC ACCENT PROPS (8 Inside View.jpg)
    # -------------------------------------------------------------
    # A. Blue Plastic Water Drum Barrel (Bay 8 foreground)
    DRUM_X = CX_8 + 1.60
    DRUM_Y = HALF_L - 4.50
    create_cylinder("GH_Blue_Drum_Body",
                    (DRUM_X, DRUM_Y, PLINTH_H + 0.45),
                    0.28, 0.88, rot=(0, 0, 0),
                    mat=mat_blue_drum, parent=root, vertices=12)
    create_cylinder("GH_Blue_Drum_Cap",
                    (DRUM_X, DRUM_Y, PLINTH_H + 0.90),
                    0.29, 0.04, rot=(0, 0, 0),
                    mat=mat_dark_frame, parent=root, vertices=12)

    # B. Grey Metal / Plastic Nursery Barrel
    GREY_DRUM_X = CX_8 - 1.80
    GREY_DRUM_Y = HALF_L - 6.20
    create_cylinder("GH_Grey_Drum_Body",
                    (GREY_DRUM_X, GREY_DRUM_Y, PLINTH_H + 0.45),
                    0.26, 0.86, rot=(0, 0, 0),
                    mat=mat_grey_barrel, parent=root, vertices=12)

    # C. White Monobloc Plastic Chair in Foreground (8 Inside View.jpg)
    CHAIR_X = CX_8 - 0.20
    CHAIR_Y = HALF_L - 2.80
    CHAIR_Z = PLINTH_H + 0.02
    # Seat
    create_box("GH_Chair_Seat",
               (CHAIR_X, CHAIR_Y, CHAIR_Z + 0.25),
               (0.44, 0.44, 0.03),
               mat_white_chair, root)
    # 4 legs
    for dx in [-0.18, 0.18]:
        for dy in [-0.18, 0.18]:
            create_box(f"GH_Chair_Leg_{dx}_{dy}",
                       (CHAIR_X + dx, CHAIR_Y + dy, CHAIR_Z + 0.125),
                       (0.035, 0.035, 0.25),
                       mat_white_chair, root)
    # Backrest with round top opening
    create_box("GH_Chair_Back_Top",
               (CHAIR_X, CHAIR_Y + 0.20, CHAIR_Z + 0.60),
               (0.44, 0.03, 0.06),
               mat_white_chair, root)
    create_box("GH_Chair_Back_Bottom",
               (CHAIR_X, CHAIR_Y + 0.20, CHAIR_Z + 0.36),
               (0.44, 0.03, 0.18),
               mat_white_chair, root)
    create_box("GH_Chair_Back_Left",
               (CHAIR_X - 0.19, CHAIR_Y + 0.20, CHAIR_Z + 0.49),
               (0.06, 0.03, 0.16),
               mat_white_chair, root)
    create_box("GH_Chair_Back_Right",
               (CHAIR_X + 0.19, CHAIR_Y + 0.20, CHAIR_Z + 0.49),
               (0.06, 0.03, 0.16),
               mat_white_chair, root)

    # -------------------------------------------------------------
    # 9. BATCH JOIN BY MATERIAL & EXPORT GLB
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
        active.name = f"GH_Batch_{mname}"
        # Weld nearby duplicate vertices
        try:
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.remove_doubles(threshold=0.005)
            bpy.ops.object.mode_set(mode='OBJECT')
        except Exception:
            pass
        print(f"Material {mname}: {len(objs)} objs -> {len(active.data.vertices):,} verts, {len(active.data.polygons):,} faces")
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
    build_plot18_greenhouse_complex()
