"""
build_plot17_screenhouse_3.py — Authentic Bespoke 3D Model of DA-LARES Screenhouse 3 (Plot 17)

Phase 3 of Plots 17 & 18 Screenhouse 3D Modeling Plan (docs/screenhouses_3d_modeling_plan.md)
Facility: Screenhouse 3 — Banana Hardening Screenhouse with Attached Concrete Utility Vestibule
Centroid: [121.16735615, 13.95903957], Mapbox rotation: 69.8 deg clockwise.
Dimensions: Width = 6.16 m (local X in [-3.08, +3.08]), Length = 18.61 m (local Y in [-9.305, +9.305])

Primary Reference Photographs:
- Building Images/Screenhouses/3 Front View.jpg (Front red sunburst radial spokes, concrete vestibule, chair on roof)
- Building Images/Screenhouses/3 Slightly Side View.jpg (Angle showing alleyway, open interior, vestibule side opening)
- Building Images/Screenhouses/3 Left 4 Right.jpg (Alleyway detail, vestibule wooden and screen doors, black mesh on flank)
"""

import bpy
import bmesh
import math
import os

TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot17_screenhouse_3.glb"

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

def create_cylinder(name, loc, radius, depth, rot=(0, 0, 0), mat=None, parent=None, vertices=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_pipe_along_polyline(name, points, radius=0.022, mat=None, parent=None, resolution=1):
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

def build_arch_polyline(half_w, z_eave, z_apex, y_pos, num_segs=16):
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

def build_quad_mesh(name, v0, v1, v2, v3, mat=None, parent=None, double_sided=True):
    """Creates a simple single planar quad with correct normal."""
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

def build_plot17_screenhouse_3():
    print("=" * 60)
    print("BUILDING AUTHENTIC DA-LARES PLOT 17 SCREENHOUSE 3 (Phase 3)")
    print("=" * 60)

    clear_scene()

    # 1. Authentic PBR Materials (Calibrated to field photographs)
    # Sturdy weathered concrete plinth & foundation
    mat_concrete_dark = get_or_create_material("SH3_ConcreteFooting", (0.38, 0.40, 0.37, 1.0), roughness=0.92, metallic=0.0)
    mat_concrete_curb = get_or_create_material("SH3_ConcreteCurb", (0.54, 0.55, 0.52, 1.0), roughness=0.88, metallic=0.0)
    mat_soil_floor = get_or_create_material("SH3_SoilFloor", (0.32, 0.28, 0.24, 1.0), roughness=0.95, metallic=0.0)

    # Concrete Utility Vestibule walls & roof
    mat_vestibule_wall = get_or_create_material("SH3_VestibuleStucco", (0.50, 0.50, 0.47, 1.0), roughness=0.90, metallic=0.0)
    mat_vestibule_roof = get_or_create_material("SH3_CorrugatedRoof", (0.45, 0.47, 0.48, 1.0), roughness=0.55, metallic=0.70)
    mat_wood_door = get_or_create_material("SH3_WoodPlankDoor", (0.56, 0.42, 0.29, 1.0), roughness=0.70, metallic=0.05)
    mat_screen_door = get_or_create_material("SH3_ScreenDoorMesh", (0.78, 0.80, 0.82, 0.85), roughness=0.40, metallic=0.60, alpha=0.85, blend_mode='BLEND')

    # Signature oxide red / maroon painted tubular steel frame
    mat_red_steel = get_or_create_material("SH3_OxideRedSteel", (0.60, 0.16, 0.14, 1.0), roughness=0.35, metallic=0.85)
    mat_red_steel_dark = get_or_create_material("SH3_OxideRedDark", (0.46, 0.12, 0.10, 1.0), roughness=0.45, metallic=0.80)

    # Enclosures: Black shade net on right flank & rear, light white mesh skirt on left
    mat_black_mesh = get_or_create_material("SH3_BlackShadeNet", (0.10, 0.10, 0.11, 0.82), roughness=0.85, metallic=0.0, alpha=0.82, blend_mode='BLEND')
    mat_white_mesh_skirt = get_or_create_material("SH3_WhiteMeshSkirt", (0.86, 0.88, 0.86, 0.45), roughness=0.60, metallic=0.05, alpha=0.45, blend_mode='BLEND')

    # Accent props: White plastic monobloc chair on roof, purple jerrycan on curb
    mat_white_chair = get_or_create_material("SH3_WhitePlasticChair", (0.95, 0.95, 0.95, 1.0), roughness=0.25, metallic=0.0)
    mat_purple_can = get_or_create_material("SH3_PurpleJerrycan", (0.55, 0.18, 0.52, 1.0), roughness=0.35, metallic=0.0)

    root = bpy.data.objects.new("Plot17_Screenhouse_3_Root", None)
    bpy.context.collection.objects.link(root)

    # -------------------------------------------------------------
    # SPATIAL DIMENSIONS (Polygon #32 in screenhouses_survey_polygons.json)
    # -------------------------------------------------------------
    WIDTH = 6.16
    LENGTH = 18.61
    HALF_W = WIDTH / 2.0    # 3.08 m
    HALF_L = LENGTH / 2.0   # 9.305 m

    FOOTING_H = 0.25        # Lower concrete plinth apron
    CURB_H = 0.65           # Upper curb top height
    CURB_THICK = 0.16       # Curb wall thickness
    CURB_HALF_W = HALF_W - 0.12  # 2.96 m
    CURB_HALF_L = HALF_L - 0.12  # 9.185 m

    EAVE_Z = 2.10           # Horizontal eave beam height
    APEX_Z = 3.85           # Roof hoop apex ridge height

    # -------------------------------------------------------------
    # 2. FOUNDATION: Two-Tier Concrete Plinth & Extended Entrance Steps
    # -------------------------------------------------------------
    # A. Lower Concrete Footing Slab (Tier 1: full polygon footprint, Z = 0 to 0.25m)
    create_box("SH3_Footing_Main",
               (0.0, 0.0, FOOTING_H / 2.0),
               (WIDTH, LENGTH, FOOTING_H),
               mat_concrete_dark, root)

    # Front Entrance Step (lower step extending forward at -Y)
    STEP1_DEPTH = 0.45
    create_box("SH3_Entrance_Step1",
               (0.0, -HALF_L - STEP1_DEPTH / 2.0, 0.13 / 2.0),
               (WIDTH * 0.95, STEP1_DEPTH, 0.13),
               mat_concrete_dark, root)

    # Intermediate Step
    STEP2_DEPTH = 0.30
    create_box("SH3_Entrance_Step2",
               (0.0, -HALF_L - STEP2_DEPTH / 2.0, (0.13 + 0.25) / 2.0),
               (WIDTH * 0.90, STEP2_DEPTH, 0.12),
               mat_concrete_dark, root)

    # B. Upper Concrete Curb Walls (Z = 0.25m to 0.65m)
    # Left Curb Wall (X = -HALF_W + CURB_THICK/2)
    create_box("SH3_Curb_Left",
               (-HALF_W + CURB_THICK / 2.0, 0.0, (FOOTING_H + CURB_H) / 2.0),
               (CURB_THICK, LENGTH, CURB_H - FOOTING_H),
               mat_concrete_curb, root)

    # Rear Curb Wall (Y = +HALF_L - CURB_THICK/2)
    create_box("SH3_Curb_Rear",
               (0.0, HALF_L - CURB_THICK / 2.0, (FOOTING_H + CURB_H) / 2.0),
               (WIDTH, CURB_THICK, CURB_H - FOOTING_H),
               mat_concrete_curb, root)

    # Right Curb Wall (from behind vestibule to rear)
    VEST_L = 2.50
    create_box("SH3_Curb_Right_Rear",
               (HALF_W - CURB_THICK / 2.0, (-HALF_L + VEST_L + HALF_L) / 2.0, (FOOTING_H + CURB_H) / 2.0),
               (CURB_THICK, LENGTH - VEST_L, CURB_H - FOOTING_H),
               mat_concrete_curb, root)

    # Front-Left Curb Wall (from X = -HALF_W to the vestibule edge)
    VEST_W = 2.45
    VEST_X_LEFT = HALF_W - VEST_W  # 3.08 - 2.45 = 0.63 m
    FRONT_LEFT_W = HALF_W + VEST_X_LEFT  # from -3.08 to +0.63 = 3.71 m
    FRONT_LEFT_CX = (-HALF_W + VEST_X_LEFT) / 2.0
    create_box("SH3_Curb_Front_Left",
               (FRONT_LEFT_CX, -HALF_L + CURB_THICK / 2.0, (FOOTING_H + CURB_H) / 2.0),
               (FRONT_LEFT_W, CURB_THICK, CURB_H - FOOTING_H),
               mat_concrete_curb, root)

    # C. Interior Soil Floor
    create_box("SH3_Soil_Floor",
               (0.0, 0.0, FOOTING_H + 0.02),
               (WIDTH - CURB_THICK * 2, LENGTH - CURB_THICK * 2, 0.04),
               mat_soil_floor, root)

    # -------------------------------------------------------------
    # 3. CONCRETE UTILITY VESTIBULE (Right-Front Corner, IMG_3888 / 3 Front View.jpg)
    # -------------------------------------------------------------
    # Dimensions: X from VEST_X_LEFT (0.63m) to HALF_W (3.08m), Y from -HALF_L (-9.305m) to -HALF_L + VEST_L (-6.805m)
    VEST_WALL_THICK = 0.15
    VEST_EAVE_Z = 2.25
    VEST_ROOF_Z = 2.38

    # A. Vestibule Left Wall (separating vestibule from screenhouse interior, with doorway)
    # Solid wall section behind door
    create_box("SH3_Vest_Wall_Left_Rear",
               (VEST_X_LEFT + VEST_WALL_THICK / 2.0, -HALF_L + VEST_L - 0.60, (CURB_H + VEST_EAVE_Z) / 2.0),
               (VEST_WALL_THICK, 1.20, VEST_EAVE_Z - CURB_H),
               mat_vestibule_wall, root)
    # Lintel above interior door
    create_box("SH3_Vest_Wall_Left_Lintel",
               (VEST_X_LEFT + VEST_WALL_THICK / 2.0, -HALF_L + 0.65, (2.05 + VEST_EAVE_Z) / 2.0),
               (VEST_WALL_THICK, 1.30, VEST_EAVE_Z - 2.05),
               mat_vestibule_wall, root)

    # B. Vestibule Rear Wall
    create_box("SH3_Vest_Wall_Rear",
               ((VEST_X_LEFT + HALF_W) / 2.0, -HALF_L + VEST_L - VEST_WALL_THICK / 2.0, (CURB_H + VEST_EAVE_Z) / 2.0),
               (VEST_W, VEST_WALL_THICK, VEST_EAVE_Z - CURB_H),
               mat_vestibule_wall, root)

    # C. Vestibule Right Outer Wall (facing alleyway between SH3 and SH4)
    create_box("SH3_Vest_Wall_Right",
               (HALF_W - VEST_WALL_THICK / 2.0, -HALF_L + VEST_L / 2.0, (CURB_H + VEST_EAVE_Z) / 2.0),
               (VEST_WALL_THICK, VEST_L, VEST_EAVE_Z - CURB_H),
               mat_vestibule_wall, root)

    # D. Vestibule Front Wall (with entrance doorway)
    # Door opening from X = 1.05 to X = 2.05 (width 1.00m, height 2.05m)
    # Left pillar of front wall
    create_box("SH3_Vest_Front_Pillar_L",
               ((VEST_X_LEFT + 1.05) / 2.0, -HALF_L + VEST_WALL_THICK / 2.0, (CURB_H + VEST_EAVE_Z) / 2.0),
               (1.05 - VEST_X_LEFT, VEST_WALL_THICK, VEST_EAVE_Z - CURB_H),
               mat_vestibule_wall, root)
    # Right pillar of front wall
    create_box("SH3_Vest_Front_Pillar_R",
               ((2.05 + HALF_W) / 2.0, -HALF_L + VEST_WALL_THICK / 2.0, (CURB_H + VEST_EAVE_Z) / 2.0),
               (HALF_W - 2.05, VEST_WALL_THICK, VEST_EAVE_Z - CURB_H),
               mat_vestibule_wall, root)
    # Lintel above front door
    create_box("SH3_Vest_Front_Lintel",
               (1.55, -HALF_L + VEST_WALL_THICK / 2.0, (2.05 + VEST_EAVE_Z) / 2.0),
               (1.00, VEST_WALL_THICK, VEST_EAVE_Z - 2.05),
               mat_vestibule_wall, root)

    # E. Doors: Wooden Plank Door & Aluminum Screen Door
    # Wooden panel door (horizontal planks, slightly recessed)
    create_box("SH3_Wood_Door",
               (1.55, -HALF_L + VEST_WALL_THICK * 0.70, (CURB_H + 2.05) / 2.0),
               (0.96, 0.04, 2.05 - CURB_H),
               mat_wood_door, root)
    # Horizontal plank grooves / relief battens
    for dz in [0.95, 1.30, 1.65]:
        create_box(f"SH3_Wood_Door_Batten_{dz}",
                   (1.55, -HALF_L + VEST_WALL_THICK * 0.70 - 0.025, dz),
                   (0.94, 0.015, 0.03),
                   mat_wood_door, root)
    # Metallic doorknob / latch
    create_cylinder("SH3_Door_Knob",
                    (1.15, -HALF_L + VEST_WALL_THICK * 0.70 - 0.04, 1.25),
                    0.022, 0.04, rot=(math.radians(90), 0, 0),
                    mat=get_or_create_material("SH3_MetalHardware", (0.8, 0.8, 0.82, 1.0), roughness=0.3, metallic=0.9), parent=root)

    # Outer Screen Door (hinged on right pillar, swung slightly open or forward frame)
    SCREEN_DOOR_W = 0.96
    SCREEN_DOOR_H = 2.02 - CURB_H
    create_box("SH3_Screen_Door_Frame_Outer",
               (2.05 + 0.40, -HALF_L - 0.15, (CURB_H + 2.02) / 2.0),
               (0.04, SCREEN_DOOR_W, SCREEN_DOOR_H),
               mat_screen_door, root)
    # Wire mesh panel in screen door
    create_box("SH3_Screen_Door_Mesh",
               (2.05 + 0.40, -HALF_L - 0.15, (CURB_H + 2.02) / 2.0),
               (0.01, SCREEN_DOOR_W - 0.08, SCREEN_DOOR_H - 0.08),
               mat_screen_door, root)

    # F. Vestibule Corrugated Sheet Roof (sloping back slightly)
    create_box("SH3_Vest_Corrugated_Roof",
               ((VEST_X_LEFT + HALF_W) / 2.0, -HALF_L + VEST_L / 2.0, VEST_ROOF_Z),
               (VEST_W + 0.20, VEST_L + 0.20, 0.06),
               mat_vestibule_roof, root)
    # Roof fascia trim
    create_box("SH3_Vest_Roof_Fascia_Front",
               ((VEST_X_LEFT + HALF_W) / 2.0, -HALF_L - 0.08, VEST_ROOF_Z - 0.03),
               (VEST_W + 0.22, 0.04, 0.08),
               mat_vestibule_roof, root)

    # G. The Iconic White Plastic Monobloc Chair on Vestibule Roof (3 Front View.jpg)
    CHAIR_X = 1.75
    CHAIR_Y = -HALF_L + 1.25
    CHAIR_Z = VEST_ROOF_Z + 0.03
    # Seat
    create_box("SH3_Roof_Chair_Seat",
               (CHAIR_X, CHAIR_Y, CHAIR_Z + 0.25),
               (0.42, 0.42, 0.03),
               mat_white_chair, root)
    # 4 legs
    for dx in [-0.18, 0.18]:
        for dy in [-0.18, 0.18]:
            create_box(f"SH3_Roof_Chair_Leg_{dx}_{dy}",
                       (CHAIR_X + dx, CHAIR_Y + dy, CHAIR_Z + 0.125),
                       (0.035, 0.035, 0.25),
                       mat_white_chair, root)
    # Backrest with vertical slats
    create_box("SH3_Roof_Chair_Back_Top",
               (CHAIR_X, CHAIR_Y + 0.19, CHAIR_Z + 0.58),
               (0.42, 0.03, 0.05),
               mat_white_chair, root)
    for bx in [-0.14, 0.0, 0.14]:
        create_box(f"SH3_Roof_Chair_Back_Slat_{bx}",
                   (CHAIR_X + bx, CHAIR_Y + 0.19, CHAIR_Z + 0.42),
                   (0.04, 0.02, 0.32),
                   mat_white_chair, root)

    # H. Purple Jerrycan / Water Container on Front Curb (3 Front View.jpg)
    create_box("SH3_Purple_Jerrycan",
               (2.45, -HALF_L - 0.16, CURB_H + 0.20),
               (0.24, 0.18, 0.40),
               mat_purple_can, root)
    create_cylinder("SH3_Jerrycan_Cap",
                    (2.45, -HALF_L - 0.16, CURB_H + 0.41),
                    0.028, 0.03, rot=(0, 0, 0),
                    mat=mat_purple_can, parent=root)

    # -------------------------------------------------------------
    # 4. STRUCTURAL RED STEEL FRAME (Oxide Red Painted Tubular Truss)
    # -------------------------------------------------------------
    PIPE_R = 0.024   # 48mm OD structural steel pipe
    PUR_R = 0.018    # 36mm OD purlin pipe
    
    # A. Perimeter Vertical Corner & Intermediate Posts (Z = CURB_H to EAVE_Z)
    NUM_BAYS = 10
    BAY_LEN = LENGTH / NUM_BAYS  # ~1.861 m
    y_posts = [-HALF_L + i * BAY_LEN for i in range(NUM_BAYS + 1)]

    # Left Wall Posts (X = -HALF_W)
    for i, yp in enumerate(y_posts):
        create_cylinder(f"SH3_Post_Left_{i}",
                        (-HALF_W + PIPE_R, yp, (CURB_H + EAVE_Z) / 2.0),
                        PIPE_R, EAVE_Z - CURB_H,
                        mat=mat_red_steel, parent=root)

    # Right Wall Posts (X = +HALF_W, only behind vestibule where frame is exposed)
    for i, yp in enumerate(y_posts):
        if yp > -HALF_L + VEST_L - 0.1:
            create_cylinder(f"SH3_Post_Right_{i}",
                            (HALF_W - PIPE_R, yp, (CURB_H + EAVE_Z) / 2.0),
                            PIPE_R, EAVE_Z - CURB_H,
                            mat=mat_red_steel, parent=root)

    # Intermediate Vestibule Junction Post (at X = VEST_X_LEFT, Y = -HALF_L)
    create_cylinder("SH3_Post_Vest_Junction",
                    (VEST_X_LEFT, -HALF_L, (CURB_H + EAVE_Z) / 2.0),
                    PIPE_R, EAVE_Z - CURB_H,
                    mat=mat_red_steel, parent=root)

    # B. Horizontal Perimeter Eave Beams (Z = EAVE_Z)
    # Left Eave Beam
    create_pipe_along_polyline("SH3_Eave_Beam_Left",
                               [(-HALF_W, -HALF_L, EAVE_Z), (-HALF_W, HALF_L, EAVE_Z)],
                               radius=PIPE_R, mat=mat_red_steel, parent=root)
    # Right Eave Beam
    create_pipe_along_polyline("SH3_Eave_Beam_Right",
                               [(HALF_W, -HALF_L, EAVE_Z), (HALF_W, HALF_L, EAVE_Z)],
                               radius=PIPE_R, mat=mat_red_steel, parent=root)
    # Front Horizontal Tie Beam (at Z = EAVE_Z spanning full width)
    create_pipe_along_polyline("SH3_Front_Tie_Beam",
                               [(-HALF_W, -HALF_L, EAVE_Z), (HALF_W, -HALF_L, EAVE_Z)],
                               radius=PIPE_R, mat=mat_red_steel, parent=root)
    # Rear Horizontal Tie Beam
    create_pipe_along_polyline("SH3_Rear_Tie_Beam",
                               [(-HALF_W, HALF_L, EAVE_Z), (HALF_W, HALF_L, EAVE_Z)],
                               radius=PIPE_R, mat=mat_red_steel, parent=root)

    # C. 11 Structural Semicircular Hoop Arch Trusses
    for i, yp in enumerate(y_posts):
        arch_pts = build_arch_polyline(HALF_W, EAVE_Z, APEX_Z, yp, num_segs=18)
        create_pipe_along_polyline(f"SH3_Hoop_Arch_{i}",
                                   arch_pts, radius=PIPE_R, mat=mat_red_steel, parent=root)
        # Horizontal bottom tie strut on intermediate hoops (connecting left & right at eave level)
        if 0 < i < NUM_BAYS:
            create_pipe_along_polyline(f"SH3_Hoop_Tie_{i}",
                                       [(-HALF_W, yp, EAVE_Z), (HALF_W, yp, EAVE_Z)],
                                       radius=PUR_R, mat=mat_red_steel, parent=root)
            # Vertical king strut
            create_pipe_along_polyline(f"SH3_King_Strut_{i}",
                                       [(0.0, yp, EAVE_Z), (0.0, yp, APEX_Z)],
                                       radius=PUR_R, mat=mat_red_steel, parent=root)

    # D. Longitudinal Purlin Pipes Running Full Length
    # Central Ridge Purlin (X = 0, Z = APEX_Z)
    create_pipe_along_polyline("SH3_Purlin_Ridge",
                               [(0.0, -HALF_L, APEX_Z), (0.0, HALF_L, APEX_Z)],
                               radius=PUR_R, mat=mat_red_steel, parent=root)
    # Upper Shoulder Purlins (X = +/- 1.65m, Z ~ 3.52m)
    create_pipe_along_polyline("SH3_Purlin_Upper_L",
                               [(-1.65, -HALF_L, 3.52), (-1.65, HALF_L, 3.52)],
                               radius=PUR_R, mat=mat_red_steel, parent=root)
    create_pipe_along_polyline("SH3_Purlin_Upper_R",
                               [(1.65, -HALF_L, 3.52), (1.65, HALF_L, 3.52)],
                               radius=PUR_R, mat=mat_red_steel, parent=root)
    # Lower Shoulder Purlins (X = +/- 2.50m, Z ~ 2.85m)
    create_pipe_along_polyline("SH3_Purlin_Lower_L",
                               [(-2.50, -HALF_L, 2.85), (-2.50, HALF_L, 2.85)],
                               radius=PUR_R, mat=mat_red_steel, parent=root)
    create_pipe_along_polyline("SH3_Purlin_Lower_R",
                               [(2.50, -HALF_L, 2.85), (2.50, HALF_L, 2.85)],
                               radius=PUR_R, mat=mat_red_steel, parent=root)

    # -------------------------------------------------------------
    # 5. THE SIGNATURE RADIAL SUNBURST SPOKES (Front Gable, Y = -HALF_L)
    # -------------------------------------------------------------
    # As captured in 3 Front View.jpg:
    # An inner concentric arch springs from the tie beam, and 12-14 radial spokes fan out to the outer rim!
    INNER_W = 1.70   # Half-width of inner arch
    INNER_APEX = 3.05 # Apex of inner arch
    inner_arch_pts = build_arch_polyline(INNER_W, EAVE_Z, INNER_APEX, -HALF_L, num_segs=12)
    create_pipe_along_polyline("SH3_Front_Inner_Arch",
                               inner_arch_pts, radius=PIPE_R, mat=mat_red_steel, parent=root)

    # Central Vertical King Post
    create_pipe_along_polyline("SH3_Front_King_Post",
                               [(0.0, -HALF_L, EAVE_Z), (0.0, -HALF_L, APEX_Z)],
                               radius=PIPE_R, mat=mat_red_steel, parent=root)

    # Radial Sunburst Spokes radiating from inner arch to outer arch
    # Calculate outer arch points corresponding to angle
    outer_rise = APEX_Z - EAVE_Z
    outer_R = (outer_rise**2 + HALF_W**2) / (2.0 * outer_rise)
    outer_cz = APEX_Z - outer_R
    outer_theta_max = math.asin(HALF_W / outer_R)

    inner_rise = INNER_APEX - EAVE_Z
    inner_R = (inner_rise**2 + INNER_W**2) / (2.0 * inner_rise)
    inner_cz = INNER_APEX - inner_R
    inner_theta_max = math.asin(INNER_W / inner_R)

    # 12 radial spokes (6 on left, 6 on right)
    NUM_SPOKES_SIDE = 6
    for s in range(1, NUM_SPOKES_SIDE + 1):
        frac = s / (NUM_SPOKES_SIDE + 0.5)
        # Left side spoke
        t_in = -inner_theta_max * frac
        t_out = -outer_theta_max * frac
        p_in_l = (inner_R * math.sin(t_in), -HALF_L, inner_cz + inner_R * math.cos(t_in))
        p_out_l = (outer_R * math.sin(t_out), -HALF_L, outer_cz + outer_R * math.cos(t_out))
        create_pipe_along_polyline(f"SH3_Sunburst_Spoke_L_{s}",
                                   [p_in_l, p_out_l], radius=0.016, mat=mat_red_steel, parent=root)
        
        # Bottom spoke connecting inner arch footing to tie beam
        if s <= 2:
            p_tie = (-INNER_W * frac, -HALF_L, EAVE_Z)
            create_pipe_along_polyline(f"SH3_Inner_Tie_Spoke_L_{s}",
                                       [p_tie, p_in_l], radius=0.016, mat=mat_red_steel, parent=root)

        # Right side spoke
        t_in_r = inner_theta_max * frac
        t_out_r = outer_theta_max * frac
        p_in_r = (inner_R * math.sin(t_in_r), -HALF_L, inner_cz + inner_R * math.cos(t_in_r))
        p_out_r = (outer_R * math.sin(t_out_r), -HALF_L, outer_cz + outer_R * math.cos(t_out_r))
        create_pipe_along_polyline(f"SH3_Sunburst_Spoke_R_{s}",
                                   [p_in_r, p_out_r], radius=0.016, mat=mat_red_steel, parent=root)
        
        if s <= 2:
            p_tie_r = (INNER_W * frac, -HALF_L, EAVE_Z)
            create_pipe_along_polyline(f"SH3_Inner_Tie_Spoke_R_{s}",
                                       [p_tie_r, p_in_r], radius=0.016, mat=mat_red_steel, parent=root)

    # -------------------------------------------------------------
    # 6. ENCLOSURES: Black Shade Cloth & Light Mesh Skirt
    # -------------------------------------------------------------
    # Right Wall: Black shade net (from rear of vestibule to building rear, Z = CURB_H to EAVE_Z)
    RIGHT_WALL_START_Y = -HALF_L + VEST_L
    build_quad_mesh("SH3_Right_Shade_Net",
                    (HALF_W, RIGHT_WALL_START_Y, CURB_H),
                    (HALF_W, HALF_L, CURB_H),
                    (HALF_W, HALF_L, EAVE_Z),
                    (HALF_W, RIGHT_WALL_START_Y, EAVE_Z),
                    mat_black_mesh, root)

    # Rear Wall: Black shade net enclosure
    build_quad_mesh("SH3_Rear_Shade_Net_Lower",
                    (-HALF_W, HALF_L, CURB_H),
                    (HALF_W, HALF_L, CURB_H),
                    (HALF_W, HALF_L, EAVE_Z),
                    (-HALF_W, HALF_L, EAVE_Z),
                    mat_black_mesh, root)

    # Rear Gable Arch Shade Net
    rear_mesh = bpy.data.meshes.new("SH3_Rear_Gable_Net_mesh")
    rear_obj = bpy.data.objects.new("SH3_Rear_Gable_Net", rear_mesh)
    bpy.context.collection.objects.link(rear_obj)
    rear_arch_pts = build_arch_polyline(HALF_W, EAVE_Z, APEX_Z, HALF_L, num_segs=16)
    r_verts = [(0.0, HALF_L, EAVE_Z)] + rear_arch_pts
    r_faces = []
    for f_idx in range(len(rear_arch_pts) - 1):
        r_faces.append((0, f_idx + 1, f_idx + 2))
    rear_mesh.from_pydata(r_verts, [], r_faces)
    rear_mesh.update()
    rear_obj.data.materials.append(mat_black_mesh)
    rear_obj.parent = root

    # Left Wall: Lower white insect net skirt (Z = CURB_H to 1.35m)
    build_quad_mesh("SH3_Left_Mesh_Skirt",
                    (-HALF_W, -HALF_L, CURB_H),
                    (-HALF_W, HALF_L, CURB_H),
                    (-HALF_W, HALF_L, 1.35),
                    (-HALF_W, -HALF_L, 1.35),
                    mat_white_mesh_skirt, root)

    # -------------------------------------------------------------
    # 7. INTERIOR EQUIPMENT: Banana Hardening Bench & Rear Scaffolding
    # -------------------------------------------------------------
    # Rear staging bench / frame (Y = 6.0m to 8.5m, X = -2.2m to 2.2m)
    mat_galv_bench = get_or_create_material("SH3_GalvanizedBench", (0.62, 0.65, 0.67, 1.0), roughness=0.4, metallic=0.8)
    for by in [6.2, 7.5, 8.6]:
        # Bench leg frames
        create_cylinder(f"SH3_Bench_Leg_L_{by}", (-1.8, by, (FOOTING_H + 0.85) / 2.0), 0.02, 0.85 - FOOTING_H, mat=mat_galv_bench, parent=root)
        create_cylinder(f"SH3_Bench_Leg_R_{by}", (1.8, by, (FOOTING_H + 0.85) / 2.0), 0.02, 0.85 - FOOTING_H, mat=mat_galv_bench, parent=root)
        create_pipe_along_polyline(f"SH3_Bench_Cross_{by}", [(-1.8, by, 0.85), (1.8, by, 0.85)], radius=0.018, mat=mat_galv_bench, parent=root)

    # Longitudinal bench rails
    create_pipe_along_polyline("SH3_Bench_Rail_L", [(-1.8, 6.0, 0.85), (-1.8, 8.8, 0.85)], radius=0.018, mat=mat_galv_bench, parent=root)
    create_pipe_along_polyline("SH3_Bench_Rail_R", [(1.8, 6.0, 0.85), (1.8, 8.8, 0.85)], radius=0.018, mat=mat_galv_bench, parent=root)
    # Wire mesh bench top
    create_box("SH3_Bench_Mesh_Top", (0.0, 7.4, 0.86), (3.6, 2.8, 0.02), mat=mat_galv_bench, parent=root)

    # -------------------------------------------------------------
    # 8. EXPORT TO GLB
    # -------------------------------------------------------------
    print(f"Exporting GLB to: {TARGET_GLB}...")
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=TARGET_GLB,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )

    size_bytes = os.path.getsize(TARGET_GLB)
    print(f"SUCCESS! Exported model size: {size_bytes} bytes ({size_bytes / 1024.0:.2f} KB)")
    assert size_bytes < 300 * 1024, f"Model exceeded budget: {size_bytes} > 300KB"

build_plot17_screenhouse_3()
