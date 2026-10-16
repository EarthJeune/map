import bpy
import bmesh
import math
import os

def build_motorpool_barracks():
    # -----------------------------------------------------------------------
    # Clear existing scene
    # -----------------------------------------------------------------------
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)

    # -----------------------------------------------------------------------
    # Helper: Material Builder
    # -----------------------------------------------------------------------
    def create_mat(name, color, roughness=0.5, metallic=0.0, specular=0.5):
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs['Base Color'].default_value = (*color, 1.0)
            bsdf.inputs['Roughness'].default_value = roughness
            bsdf.inputs['Metallic'].default_value = metallic
            if 'Specular IOR Level' in bsdf.inputs:
                bsdf.inputs['Specular IOR Level'].default_value = specular
            elif 'Specular' in bsdf.inputs:
                bsdf.inputs['Specular'].default_value = specular
        return mat

    def create_box(name, center, size, mat, parent=None, rot=(0, 0, 0)):
        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        if parent:
            obj.parent = parent

        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bm.to_mesh(mesh)
        bm.free()

        obj.scale = size
        obj.location = center
        obj.rotation_euler = rot

        if mat:
            obj.data.materials.append(mat)
        return obj

    def create_cylinder(name, center, radius, depth, mat, segments=16, parent=None, rot=(0, 0, 0)):
        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        if parent:
            obj.parent = parent

        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                              radius1=radius, radius2=radius, depth=depth)
        bm.to_mesh(mesh)
        bm.free()

        obj.location = center
        obj.rotation_euler = rot

        if mat:
            obj.data.materials.append(mat)
        return obj

    def create_extruded_prism(name, profile_pts_2d, x_min, x_max, mat, parent=None):
        """
        Creates a watertight solid by extruding a 2D polygon profile (in Y-Z space) along X from x_min to x_max.
        profile_pts_2d: list of (y, z) tuples in counter-clockwise order.
        """
        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        if parent:
            obj.parent = parent

        bm = bmesh.new()
        n = len(profile_pts_2d)
        # Profile at x_max
        v_max = [bm.verts.new((x_max, y, z)) for y, z in profile_pts_2d]
        # Profile at x_min
        v_min = [bm.verts.new((x_min, y, z)) for y, z in profile_pts_2d]

        # Face at x_max
        bm.faces.new(v_max)
        # Face at x_min (reversed winding for outward normal)
        bm.faces.new(reversed(v_min))

        # Side quads connecting corresponding edges
        for i in range(n):
            i_next = (i + 1) % n
            bm.faces.new([v_max[i], v_max[i_next], v_min[i_next], v_min[i]])

        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()

        if mat:
            obj.data.materials.append(mat)
        return obj

    root = bpy.data.objects.new("MB_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # -----------------------------------------------------------------------
    # Dimensions & Key Boundary Planes
    # -----------------------------------------------------------------------
    X_NORTH = -8.35
    X_SOUTH = 11.85
    X_SPLIT = 2.40
    X_REAR_STEP = -3.25

    Y_FRONT = -6.40
    Y_APRON = -7.40
    Y_PORCH_BACK = -4.60

    Y_REAR_NORTH = 4.10
    Y_REAR_SOUTH = 2.20

    Z_GROUND = 0.00
    Z_SLAB   = 0.35
    WALL_EAVE_H = 3.20
    PARAPET_H_LEFT = 3.80
    PARAPET_H_MID  = 3.50
    ROOF_RIDGE_H = 4.45
    PORCH_EAVE_H = 2.65

    # -----------------------------------------------------------------------
    # Materials
    # -----------------------------------------------------------------------
    mat_wall_stucco     = create_mat("MB_WallStucco", (0.82, 0.80, 0.72), roughness=0.65, specular=0.20)
    mat_concrete_grey   = create_mat("MB_ConcreteGrey", (0.58, 0.58, 0.56), roughness=0.60, specular=0.25)
    mat_concrete_slab   = create_mat("MB_ConcreteSlab", (0.66, 0.67, 0.65), roughness=0.55, specular=0.25)
    mat_roof_corrugated = create_mat("MB_RoofCorrugated", (0.68, 0.71, 0.74), roughness=0.35, metallic=0.75, specular=0.80)
    mat_roof_porch_rust = create_mat("MB_RoofPorchRust", (0.48, 0.40, 0.36), roughness=0.55, metallic=0.55, specular=0.50)
    mat_steel_dark      = create_mat("MB_SteelDark", (0.18, 0.18, 0.20), roughness=0.35, metallic=0.85)
    mat_glass_louver    = create_mat("MB_GlassLouver", (0.28, 0.38, 0.42), roughness=0.15, specular=0.90)
    mat_door_service    = create_mat("MB_DoorService", (0.32, 0.36, 0.38), roughness=0.50)
    mat_porch_posts     = create_mat("MB_PorchPosts", (0.34, 0.30, 0.26), roughness=0.45, metallic=0.30)

    # -----------------------------------------------------------------------
    # 1. Floor Slabs
    # -----------------------------------------------------------------------
    len_north = X_REAR_STEP - X_NORTH
    cx_north = (X_NORTH + X_REAR_STEP) / 2.0
    w_north = Y_REAR_NORTH - Y_APRON
    cy_north = (Y_APRON + Y_REAR_NORTH) / 2.0
    create_box("MB_Floor_Slab_North", (cx_north, cy_north, Z_SLAB / 2.0),
               (len_north, w_north, Z_SLAB), mat_concrete_slab, root)

    len_south = X_SOUTH - X_REAR_STEP
    cx_south = (X_REAR_STEP + X_SOUTH) / 2.0
    w_south = Y_REAR_SOUTH - Y_APRON
    cy_south = (Y_APRON + Y_REAR_SOUTH) / 2.0
    create_box("MB_Floor_Slab_South", (cx_south, cy_south, Z_SLAB / 2.0),
               (len_south, w_south, Z_SLAB), mat_concrete_slab, root)

    # -----------------------------------------------------------------------
    # 2. Main Walls Architecture — North Enclosed Barracks (X: -8.35 to +2.40)
    # -----------------------------------------------------------------------
    len_enclosed = X_SPLIT - X_NORTH
    cx_enclosed  = (X_NORTH + X_SPLIT) / 2.0
    wall_h_enc   = WALL_EAVE_H - Z_SLAB

    # North Firewall at X = X_NORTH (-8.35 m): Solid wall sealing against RCPC
    w_north_wall = Y_REAR_NORTH - Y_FRONT
    cy_north_wall = (Y_FRONT + Y_REAR_NORTH) / 2.0
    create_box("MB_Wall_North_Firewall_Base", (X_NORTH + 0.10, cy_north_wall, Z_SLAB + wall_h_enc / 2.0),
               (0.20, w_north_wall, wall_h_enc), mat_concrete_grey, root)

    # North Firewall Attic Triangular Gable (completely sealing the attic):
    gable_pts_north = [
        (Y_FRONT, WALL_EAVE_H),
        (-1.15, ROOF_RIDGE_H),
        (Y_REAR_NORTH, WALL_EAVE_H)
    ]
    create_extruded_prism("MB_Wall_North_Firewall_Gable", gable_pts_north, X_NORTH, X_NORTH + 0.20, mat_concrete_grey, root)

    # Front Main Wall (Y = Y_FRONT = -6.40, X: -8.35 to +2.40):
    create_box("MB_Wall_Front_Enclosed", (cx_enclosed, Y_FRONT + 0.10, Z_SLAB + wall_h_enc / 2.0),
               (len_enclosed, 0.20, wall_h_enc), mat_wall_stucco, root)

    # Corner Column on Left Front (IMG_3842):
    create_box("MB_Col_Front_Left", (X_NORTH + 0.18, Y_FRONT + 0.05, Z_SLAB + (PARAPET_H_LEFT - Z_SLAB) / 2.0),
               (0.36, 0.36, PARAPET_H_LEFT - Z_SLAB), mat_concrete_grey, root)

    # Dividing Wall at X = X_SPLIT (+2.40):
    w_div = Y_REAR_SOUTH - Y_FRONT
    cy_div = (Y_FRONT + Y_REAR_SOUTH) / 2.0
    create_box("MB_Wall_Dividing", (X_SPLIT - 0.10, cy_div, Z_SLAB + wall_h_enc / 2.0),
               (0.20, w_div, wall_h_enc), mat_wall_stucco, root)

    # Dividing Wall Attic Gable (seals barracks attic from porch):
    gable_pts_split = [
        (Y_FRONT, WALL_EAVE_H),
        (-1.15, ROOF_RIDGE_H),
        (Y_REAR_SOUTH, 3.35),
        (Y_REAR_SOUTH, WALL_EAVE_H)
    ]
    create_extruded_prism("MB_Wall_Dividing_Gable", gable_pts_split, X_SPLIT - 0.20, X_SPLIT, mat_wall_stucco, root)

    # Curved Cheek Knee-Wall dividing front wall from open porch (IMG_3842):
    create_box("MB_CheekWall_Porch", (X_SPLIT - 0.10, Y_FRONT - 0.35, Z_SLAB + 0.45),
               (0.20, 0.70, 0.90), mat_wall_stucco, root)

    # -----------------------------------------------------------------------
    # 3. Rear Walls & Step Geometry
    # -----------------------------------------------------------------------
    # Rear Wall North segment (Y = Y_REAR_NORTH = +4.10, X: -8.35 to -3.25):
    create_box("MB_Wall_Rear_North", (cx_north, Y_REAR_NORTH - 0.10, Z_SLAB + wall_h_enc / 2.0),
               (len_north, 0.20, wall_h_enc), mat_wall_stucco, root)

    # Step Wall at X = X_REAR_STEP (-3.25 m) between Y_REAR_SOUTH (+2.20) and Y_REAR_NORTH (+4.10):
    step_wall_pts = [
        (Y_REAR_SOUTH, Z_SLAB),
        (Y_REAR_SOUTH, 3.68),
        (Y_REAR_NORTH, WALL_EAVE_H),
        (Y_REAR_NORTH, Z_SLAB)
    ]
    create_extruded_prism("MB_Wall_Rear_Step", step_wall_pts, X_REAR_STEP, X_REAR_STEP + 0.20, mat_wall_stucco, root)

    # Rear Wall Mid segment (Y = Y_REAR_SOUTH = +2.20, X: -3.25 to +2.40):
    mid_rear_len = X_SPLIT - X_REAR_STEP
    mid_rear_cx  = (X_REAR_STEP + X_SPLIT) / 2.0
    create_box("MB_Wall_Rear_Mid", (mid_rear_cx, Y_REAR_SOUTH - 0.10, Z_SLAB + (3.35 - Z_SLAB) / 2.0),
               (mid_rear_len, 0.20, 3.35 - Z_SLAB), mat_wall_stucco, root)

    # Rear Wall South segment (Workshop Porch Room, Y = Y_REAR_SOUTH = +2.20, X: +2.40 to +11.85):
    len_porch = X_SOUTH - X_SPLIT
    cx_porch  = (X_SPLIT + X_SOUTH) / 2.0
    create_box("MB_Wall_Rear_Porch", (cx_porch, Y_REAR_SOUTH - 0.10, Z_SLAB + (3.35 - Z_SLAB) / 2.0),
               (len_porch, 0.20, 3.35 - Z_SLAB), mat_wall_stucco, root)

    # South End Wall (at X = X_SOUTH = +11.85, Y: -4.60 to +2.20):
    south_wall_pts = [
        (Y_PORCH_BACK, Z_SLAB),
        (Y_PORCH_BACK, 2.82),
        (Y_REAR_SOUTH, 3.35),
        (Y_REAR_SOUTH, Z_SLAB)
    ]
    create_extruded_prism("MB_Wall_South_End", south_wall_pts, X_SOUTH - 0.20, X_SOUTH, mat_wall_stucco, root)

    # -----------------------------------------------------------------------
    # 4. Open Workshop Porch / Barracks Bay (X: +2.40 to +11.85, IMG_3842)
    # -----------------------------------------------------------------------
    # Recessed Back Wall of Porch (Y = Y_PORCH_BACK = -4.60):
    create_box("MB_Wall_Porch_Back", (cx_porch, Y_PORCH_BACK + 0.10, Z_SLAB + (2.82 - Z_SLAB) / 2.0),
               (len_porch, 0.20, 2.82 - Z_SLAB), mat_wall_stucco, root)

    # Porch Door & Window
    create_box("MB_Porch_Door", (X_SPLIT + 2.20, Y_PORCH_BACK - 0.02, Z_SLAB + 1.05),
               (0.95, 0.04, 2.10), mat_door_service, root)
    create_box("MB_Porch_Win_Glass", (X_SPLIT + 5.50, Y_PORCH_BACK - 0.02, Z_SLAB + 1.25),
               (1.60, 0.04, 1.20), mat_glass_louver, root)

    # Structural Front Posts supporting the Porch Roof along Y = Y_FRONT (-6.40):
    post_xs = [X_SPLIT, X_SPLIT + 3.10, X_SPLIT + 6.20, X_SOUTH]
    for pi, px in enumerate(post_xs):
        create_cylinder(f"MB_Porch_Post_{pi}", (px, Y_FRONT + 0.10, Z_SLAB + (PORCH_EAVE_H - Z_SLAB) / 2.0),
                        0.065, PORCH_EAVE_H - Z_SLAB, mat_porch_posts, segments=12, parent=root)

    # Horizontal Timber Eave Beam along front of porch:
    create_box("MB_Porch_Eave_Beam", (cx_porch, Y_FRONT + 0.10, PORCH_EAVE_H - 0.06),
               (len_porch + 0.20, 0.12, 0.12), mat_porch_posts, root)

    # Workshop Equipment (Bench, Tanks, Motorcycle)
    create_box("MB_WorkBench_Top", (X_SPLIT + 1.80, Y_FRONT + 0.90, Z_SLAB + 0.85), (1.50, 0.80, 0.08), mat_porch_posts, root)
    create_box("MB_WorkBench_Leg1", (X_SPLIT + 1.15, Y_FRONT + 0.60, Z_SLAB + 0.40), (0.10, 0.10, 0.80), mat_porch_posts, root)
    create_box("MB_WorkBench_Leg2", (X_SPLIT + 2.45, Y_FRONT + 0.60, Z_SLAB + 0.40), (0.10, 0.10, 0.80), mat_porch_posts, root)
    create_box("MB_WorkBench_Leg3", (X_SPLIT + 1.15, Y_FRONT + 1.20, Z_SLAB + 0.40), (0.10, 0.10, 0.80), mat_porch_posts, root)
    create_box("MB_WorkBench_Leg4", (X_SPLIT + 2.45, Y_FRONT + 1.20, Z_SLAB + 0.40), (0.10, 0.10, 0.80), mat_porch_posts, root)

    create_cylinder("MB_GasTank_1", (X_SPLIT + 2.65, Y_FRONT + 0.85, Z_SLAB + 0.70), 0.12, 1.30, mat_steel_dark, segments=12, parent=root)
    create_cylinder("MB_GasTank_2", (X_SPLIT + 2.95, Y_FRONT + 0.85, Z_SLAB + 0.60), 0.11, 1.10, mat_steel_dark, segments=12, parent=root)

    moto_x = X_SPLIT + 4.80
    moto_y = Y_FRONT + 1.10
    create_box("MB_Moto_Body", (moto_x, moto_y, Z_SLAB + 0.55), (1.40, 0.45, 0.50), mat_steel_dark, root)
    create_cylinder("MB_Moto_Wheel_F", (moto_x - 0.55, moto_y, Z_SLAB + 0.30), 0.28, 0.08, mat_steel_dark, segments=12, parent=root, rot=(math.radians(90), 0, 0))
    create_cylinder("MB_Moto_Wheel_R", (moto_x + 0.55, moto_y, Z_SLAB + 0.30), 0.28, 0.08, mat_steel_dark, segments=12, parent=root, rot=(math.radians(90), 0, 0))

    # -----------------------------------------------------------------------
    # 5. Front Enclosed Facade Openings
    # -----------------------------------------------------------------------
    win1_x = -5.80
    win1_w = 1.65
    win1_h = 1.25
    win1_cz = Z_SLAB + 1.05 + win1_h / 2.0
    create_box("MB_Win1_Frame_T", (win1_x, Y_FRONT - 0.02, Z_SLAB + 1.05 + win1_h), (win1_w, 0.05, 0.04), mat_steel_dark, root)
    create_box("MB_Win1_Frame_B", (win1_x, Y_FRONT - 0.02, Z_SLAB + 1.05),          (win1_w, 0.05, 0.04), mat_steel_dark, root)
    create_box("MB_Win1_Frame_L", (win1_x - win1_w / 2.0, Y_FRONT - 0.02, win1_cz), (0.04, 0.05, win1_h), mat_steel_dark, root)
    create_box("MB_Win1_Frame_R", (win1_x + win1_w / 2.0, Y_FRONT - 0.02, win1_cz), (0.04, 0.05, win1_h), mat_steel_dark, root)
    create_box("MB_Win1_CenterMullion", (win1_x, Y_FRONT - 0.02, win1_cz), (0.04, 0.05, win1_h), mat_steel_dark, root)
    create_box("MB_Win1_Glass", (win1_x, Y_FRONT - 0.01, win1_cz), (win1_w - 0.06, 0.02, win1_h - 0.06), mat_glass_louver, root)

    win2_x = -3.20
    create_box("MB_Win2_Frame_T", (win2_x, Y_FRONT - 0.02, Z_SLAB + 1.05 + win1_h), (win1_w, 0.05, 0.04), mat_steel_dark, root)
    create_box("MB_Win2_Frame_B", (win2_x, Y_FRONT - 0.02, Z_SLAB + 1.05),          (win1_w, 0.05, 0.04), mat_steel_dark, root)
    create_box("MB_Win2_Frame_L", (win2_x - win1_w / 2.0, Y_FRONT - 0.02, win1_cz), (0.04, 0.05, win1_h), mat_steel_dark, root)
    create_box("MB_Win2_Frame_R", (win2_x + win1_w / 2.0, Y_FRONT - 0.02, win1_cz), (0.04, 0.05, win1_h), mat_steel_dark, root)
    create_box("MB_Win2_CenterMullion", (win2_x, Y_FRONT - 0.02, win1_cz), (0.04, 0.05, win1_h), mat_steel_dark, root)
    create_box("MB_Win2_Glass", (win2_x, Y_FRONT - 0.01, win1_cz), (win1_w - 0.06, 0.02, win1_h - 0.06), mat_glass_louver, root)

    door_x = -0.70
    door_w = 0.95
    door_h = 2.10
    door_cz = Z_SLAB + door_h / 2.0
    create_box("MB_Door_Frame", (door_x, Y_FRONT - 0.02, door_cz), (door_w + 0.08, 0.06, door_h + 0.04), mat_steel_dark, root)
    create_box("MB_Door_Leaf",  (door_x, Y_FRONT - 0.02, door_cz), (door_w, 0.04, door_h), mat_door_service, root)

    # Parapet Walls on Front
    len_par_left = -1.80 - X_NORTH
    cx_par_left = (X_NORTH + -1.80) / 2.0
    par_h_left = PARAPET_H_LEFT - WALL_EAVE_H
    create_box("MB_Parapet_Left", (cx_par_left, Y_FRONT + 0.10, WALL_EAVE_H + par_h_left / 2.0),
               (len_par_left, 0.22, par_h_left), mat_concrete_grey, root)
    create_box("MB_Parapet_Left_Cap", (cx_par_left, Y_FRONT + 0.10, PARAPET_H_LEFT + 0.03),
               (len_par_left + 0.10, 0.28, 0.06), mat_concrete_grey, root)

    len_par_mid = X_SPLIT - (-1.80)
    cx_par_mid = (-1.80 + X_SPLIT) / 2.0
    par_h_mid = PARAPET_H_MID - WALL_EAVE_H
    create_box("MB_Parapet_Mid", (cx_par_mid, Y_FRONT + 0.10, WALL_EAVE_H + par_h_mid / 2.0),
               (len_par_mid, 0.22, par_h_mid), mat_concrete_grey, root)
    create_box("MB_Parapet_Mid_Cap", (cx_par_mid, Y_FRONT + 0.10, PARAPET_H_MID + 0.03),
               (len_par_mid + 0.10, 0.28, 0.06), mat_concrete_grey, root)

    # Awning on Front
    awning_proj = 0.95
    awning_len  = len_enclosed + 0.20
    awning_slope_pitch = math.atan2(0.30, awning_proj)
    awning_hypot = math.hypot(awning_proj, 0.30)
    create_box("MB_Awning_Sheet",
               (cx_enclosed, Y_FRONT - awning_proj / 2.0, 3.05),
               (awning_len, awning_hypot, 0.03),
               mat_roof_corrugated, root, rot=(-awning_slope_pitch, 0, 0))

    bkt_xs = [-7.60, -5.80, -4.00, -2.20, -0.40, 1.40]
    for bi, bx in enumerate(bkt_xs):
        create_cylinder(f"MB_Awning_Bkt_{bi}",
                        (bx, Y_FRONT - awning_proj / 2.0, 2.75),
                        0.018, awning_hypot, mat_steel_dark, segments=8, parent=root,
                        rot=(math.radians(90) - awning_slope_pitch, 0, 0))
        create_box(f"MB_Awning_Bar_{bi}", (bx, Y_FRONT - awning_proj / 2.0, 3.15),
                   (0.04, awning_proj, 0.04), mat_steel_dark, root)

    # -----------------------------------------------------------------------
    # 6. Watertight Roof Architecture — Zero Holes, Zero Origami Glitches
    # -----------------------------------------------------------------------
    # A. North Barracks Roof (X: -8.35 to +2.40):
    # 1. North Section Roof Volume (X: -8.35 to -3.25):
    north_roof_profile = [
        (Y_FRONT, WALL_EAVE_H),
        (-1.15, ROOF_RIDGE_H),
        (Y_REAR_NORTH, WALL_EAVE_H),
        (Y_REAR_NORTH, WALL_EAVE_H - 0.05),
        (Y_FRONT, WALL_EAVE_H - 0.05)
    ]
    create_extruded_prism("MB_Roof_North_Volume", north_roof_profile, X_NORTH, X_REAR_STEP, mat_roof_corrugated, root)

    # 2. Mid Section Roof Volume (X: -3.25 to +2.40):
    mid_roof_profile = [
        (Y_FRONT, WALL_EAVE_H),
        (-1.15, ROOF_RIDGE_H),
        (Y_REAR_SOUTH, 3.35),
        (Y_REAR_SOUTH, WALL_EAVE_H - 0.05),
        (Y_FRONT, WALL_EAVE_H - 0.05)
    ]
    create_extruded_prism("MB_Roof_Mid_Volume", mid_roof_profile, X_REAR_STEP, X_SPLIT, mat_roof_corrugated, root)

    # B. Workshop Porch Lower Corrugated Iron Roof (South Block, X: +2.40 to +11.85):
    porch_roof_profile = [
        (Y_FRONT - 0.25, PORCH_EAVE_H + 0.05),
        (Y_REAR_SOUTH + 0.15, 3.38),
        (Y_REAR_SOUTH + 0.15, 3.30),
        (Y_FRONT - 0.25, PORCH_EAVE_H - 0.03)
    ]
    create_extruded_prism("MB_Roof_Porch_Volume", porch_roof_profile, X_SPLIT, X_SOUTH + 0.15, mat_roof_porch_rust, root)

    # Porch Front Timber Fascia Board:
    create_box("MB_Porch_Fascia_Front",
               ((X_SPLIT + X_SOUTH + 0.15) / 2.0, Y_FRONT - 0.25, PORCH_EAVE_H),
               (len_porch + 0.15, 0.04, 0.15), mat_porch_posts, root)

    # Porch South Timber Bargeboard / Gable Trim:
    south_barge_pts = [
        (Y_FRONT - 0.26, PORCH_EAVE_H - 0.08),
        (Y_REAR_SOUTH + 0.16, 3.25),
        (Y_REAR_SOUTH + 0.16, 3.42),
        (Y_FRONT - 0.26, PORCH_EAVE_H + 0.08)
    ]
    create_extruded_prism("MB_Porch_Barge_South", south_barge_pts, X_SOUTH + 0.13, X_SOUTH + 0.17, mat_porch_posts, root)

    # -----------------------------------------------------------------------
    # 7. Mesh Optimization & Consolidation (Budget: <= 300 KB)
    # -----------------------------------------------------------------------
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
            objs[0].name = f"MB_{m_name}_Merged"

    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\motorpool_barracks.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        use_selection=True,
        export_format='GLB',
        export_apply=True
    )

    size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"[OK] Successfully exported Motorpool Barracks to {glb_out} ({size_kb:.1f} KB)")
    if size_kb <= 300.0:
        print(f"[PASS] Model size is strictly within the 300 KB budget!")
    else:
        print(f"[WARNING] Model size ({size_kb:.1f} KB) exceeds 300 KB budget!")

# Call directly at module level
build_motorpool_barracks()
