import bpy
import bmesh
import math
import os

TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\rsl_building.glb"

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

def create_prism(name, v1, v2, v3, thickness_y, mat=None, parent=None):
    """Watertight triangular prism extrusion along Y axis with outwards-recalculated normals."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    y_half = thickness_y / 2.0
    verts = [
        (v1[0], -y_half, v1[1]),
        (v2[0], -y_half, v2[1]),
        (v3[0], -y_half, v3[1]),
        (v1[0],  y_half, v1[1]),
        (v2[0],  y_half, v2[1]),
        (v3[0],  y_half, v3[1]),
    ]
    faces = [
        (0, 2, 1),
        (3, 4, 5),
        (0, 1, 4, 3),
        (1, 2, 5, 4),
        (2, 0, 3, 5),
    ]
    mesh.from_pydata(verts, [], faces)
    
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mesh.update()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_rsl_building():
    clear_scene()

    # Materials calibrated to ground-truth field photographs (IMG_3852, IMG_3853, IMG_3854)
    # Warm cream / beige stucco finish
    mat_wall_cream = get_or_create_material("RSL_WallCream", (0.92, 0.88, 0.76, 1.0), roughness=0.68)
    # Foundation plinth skirt (weathered grey concrete)
    mat_plinth_grey = get_or_create_material("RSL_PlinthGrey", (0.55, 0.53, 0.49, 1.0), roughness=0.85)
    # Concrete steps & entrance landing
    mat_concrete_steps = get_or_create_material("RSL_ConcreteSteps", (0.70, 0.68, 0.64, 1.0), roughness=0.75)
    
    # Roof: Weathered galvanized corrugated metal (silver-grey)
    mat_roof_metal = get_or_create_material("RSL_RoofMetal", (0.64, 0.66, 0.68, 1.0), roughness=0.45, metallic=0.6)
    # White metal fascia board and gutter trim
    mat_fascia_white = get_or_create_material("RSL_FasciaWhite", (0.88, 0.89, 0.90, 1.0), roughness=0.40)
    # Vented white soffit panels
    mat_soffit_white = get_or_create_material("RSL_SoffitWhite", (0.82, 0.82, 0.80, 1.0), roughness=0.55)
    
    # Entrance canopy: Corrugated forest green sheet roof & dark trims
    mat_canopy_green = get_or_create_material("RSL_CanopyGreen", (0.10, 0.26, 0.16, 1.0), roughness=0.45, metallic=0.3)
    mat_canopy_trim = get_or_create_material("RSL_CanopyTrim", (0.18, 0.18, 0.20, 1.0), roughness=0.50, metallic=0.5)
    mat_bracket_dark = get_or_create_material("RSL_BracketDark", (0.15, 0.15, 0.16, 1.0), roughness=0.40, metallic=0.8)

    # Commercial Windows & Doors
    mat_frame_white = get_or_create_material("RSL_FrameWhite", (0.94, 0.94, 0.94, 1.0), roughness=0.25)
    mat_bronze_door = get_or_create_material("RSL_BronzeDoor", (0.14, 0.12, 0.10, 1.0), roughness=0.35, metallic=0.75)
    mat_glass_tint = get_or_create_material("RSL_GlassTinted", (0.08, 0.16, 0.22, 1.0), roughness=0.08, metallic=0.35)
    mat_glass_back = get_or_create_material("RSL_GlassBacking", (0.03, 0.03, 0.04, 1.0), roughness=0.95)
    mat_grille_white = get_or_create_material("RSL_GrilleWhite", (0.96, 0.96, 0.96, 1.0), roughness=0.30)
    mat_silver_handle = get_or_create_material("RSL_SilverHandle", (0.85, 0.86, 0.88, 1.0), roughness=0.20, metallic=0.9)

    # 3D Lettering & Mechanicals
    mat_sign_text = get_or_create_material("RSL_SignLettering", (0.12, 0.14, 0.16, 1.0), roughness=0.25, metallic=0.7)
    mat_ac_beige = get_or_create_material("RSL_ACBeige", (0.86, 0.84, 0.78, 1.0), roughness=0.50)
    mat_ac_grille = get_or_create_material("RSL_ACGrille", (0.18, 0.18, 0.20, 1.0), roughness=0.60)
    mat_pipe_pvc = get_or_create_material("RSL_PipePVC", (0.88, 0.88, 0.86, 1.0), roughness=0.40)
    mat_electric_box = get_or_create_material("RSL_ElectricBox", (0.50, 0.52, 0.54, 1.0), roughness=0.50, metallic=0.5)

    # Root object
    root = bpy.data.objects.new("RSL_Root", None)
    bpy.context.collection.objects.link(root)

    # DIMENSIONS & COORDINATES
    W = 20.70
    D = 27.60
    X_LEFT = -W / 2.0   # -10.35m
    X_RIGHT = W / 2.0   # +10.35m
    Y_FRONT = -D / 2.0  # -13.80m
    Y_REAR = D / 2.0    # +13.80m

    H_PLINTH = 0.40     # Plinth skirt height
    H_EAVE = 3.45       # Main wall eave height
    H_RIDGE = 5.20      # Centered apex ridge height

    # 1. FOUNDATION PLINTH SKIRT
    PLINTH_EXP = 0.05
    create_box("RSL_PlinthSkirt", 
               (0.0, 0.0, H_PLINTH / 2.0),
               (W + PLINTH_EXP * 2, D + PLINTH_EXP * 2, H_PLINTH),
               mat=mat_plinth_grey, parent=root)

    # 2. MAIN EXTERIOR WALLS (Solid rectangle up to eave level)
    wall_h = H_EAVE - H_PLINTH
    create_box("RSL_MainWalls",
               (0.0, 0.0, H_PLINTH + wall_h / 2.0),
               (W, D, wall_h),
               mat=mat_wall_cream, parent=root)

    # 3. SOLID ATTACHED SYMMETRICAL GABLE WALLS (100% attached, zero gaps)
    # Front triangular gable wall sitting directly on top of front wall at Y_FRONT
    gable_front = create_prism("RSL_GableFrontWall",
                               v1=(X_LEFT, H_EAVE),
                               v2=(0.00, H_RIDGE),
                               v3=(X_RIGHT, H_EAVE),
                               thickness_y=0.25,
                               mat=mat_wall_cream, parent=root)
    gable_front.location.y = Y_FRONT + 0.125

    # Rear triangular gable wall sitting directly on top of rear wall at Y_REAR
    gable_rear = create_prism("RSL_GableRearWall",
                              v1=(X_LEFT, H_EAVE),
                              v2=(0.00, H_RIDGE),
                              v3=(X_RIGHT, H_EAVE),
                              thickness_y=0.25,
                              mat=mat_wall_cream, parent=root)
    gable_rear.location.y = Y_REAR - 0.125

    # 4. ENTRANCE PORCH & STEPS (Aligned with ground truth photos IMG_3853, IMG_3854)
    LANDING_W = 3.40
    LANDING_D = 1.60
    LANDING_H = 0.45
    landing_y = Y_FRONT - LANDING_D / 2.0  # -14.60m
    create_box("RSL_EntranceLanding",
               (-4.00, landing_y, LANDING_H / 2.0),
               (LANDING_W, LANDING_D, LANDING_H),
               mat=mat_concrete_steps, parent=root)

    # 3 Steps leading down from landing
    STEP_D = 0.32
    STEP_H = LANDING_H / 3.0  # 0.15m per step
    for s in range(3):
        cur_h = LANDING_H - (s + 1) * STEP_H
        cur_y = Y_FRONT - LANDING_D - (s + 0.5) * STEP_D
        create_box(f"RSL_Step_{s+1}",
                   (-4.00, cur_y, (cur_h + STEP_H) / 2.0),
                   (LANDING_W + 0.20, STEP_D, cur_h + STEP_H),
                   mat=mat_concrete_steps, parent=root)

    # Concrete apron pathway skirt in front of landing
    create_box("RSL_EntranceApronWalk",
               (-4.00, Y_FRONT - LANDING_D - 3 * STEP_D - 0.40, 0.05),
               (LANDING_W + 0.60, 0.80, 0.10),
               mat=mat_plinth_grey, parent=root)

    # 5. COMMERCIAL DOUBLE GLASS DOORS WITH TRANSOM
    DOOR_W = 1.90
    DOOR_H = 2.40
    # Outer dark bronze door surround frame
    create_box("RSL_DoorOuterFrame",
               (-4.00, Y_FRONT - 0.04, H_PLINTH + DOOR_H / 2.0),
               (DOOR_W + 0.12, 0.08, DOOR_H + 0.12),
               mat=mat_bronze_door, parent=root)
    # Glass backing
    create_box("RSL_DoorGlassBack",
               (-4.00, Y_FRONT - 0.02, H_PLINTH + DOOR_H / 2.0),
               (DOOR_W, 0.03, DOOR_H),
               mat=mat_glass_back, parent=root)
    # Tinted glass panels
    create_box("RSL_DoorGlassLeft",
               (-4.45, Y_FRONT - 0.06, H_PLINTH + 0.95),
               (0.80, 0.02, 1.80),
               mat=mat_glass_tint, parent=root)
    create_box("RSL_DoorGlassRight",
               (-3.55, Y_FRONT - 0.06, H_PLINTH + 0.95),
               (0.80, 0.02, 1.80),
               mat=mat_glass_tint, parent=root)
    # Transom glass above doors
    create_box("RSL_DoorTransom",
               (-4.00, Y_FRONT - 0.06, H_PLINTH + 2.12),
               (1.78, 0.02, 0.42),
               mat=mat_glass_tint, parent=root)
    # Center mullion and transom divider
    create_box("RSL_DoorStileCenter",
               (-4.00, Y_FRONT - 0.07, H_PLINTH + 0.95),
               (0.08, 0.03, 1.90),
               mat=mat_bronze_door, parent=root)
    create_box("RSL_DoorMidRail",
               (-4.00, Y_FRONT - 0.07, H_PLINTH + 1.88),
               (DOOR_W, 0.03, 0.08),
               mat=mat_bronze_door, parent=root)
    # Silver push bars
    create_box("RSL_DoorHandleLeft",
               (-4.12, Y_FRONT - 0.09, H_PLINTH + 1.05),
               (0.03, 0.04, 0.40),
               mat=mat_silver_handle, parent=root)
    create_box("RSL_DoorHandleRight",
               (-3.88, Y_FRONT - 0.09, H_PLINTH + 1.05),
               (0.03, 0.04, 0.40),
               mat=mat_silver_handle, parent=root)

    # 6. ENTRANCE CANOPY AWNING (Forest Green Corrugated Sheet with Dark Trim)
    # Clean, strictly attached architecture: zero loose wires, zero poked-through struts
    AWN_W = 3.50
    AWN_PROJ = 1.55
    AWN_Z_WALL = 3.12
    AWN_Z_EAVE = 2.62
    awn_center_x = -4.00
    awn_center_y = Y_FRONT - AWN_PROJ / 2.0
    awn_center_z = (AWN_Z_WALL + AWN_Z_EAVE) / 2.0
    awn_angle = math.atan2(AWN_Z_WALL - AWN_Z_EAVE, AWN_PROJ)
    awn_hypot = math.hypot(AWN_PROJ, AWN_Z_WALL - AWN_Z_EAVE)

    # Clean canopy green roof panel
    awn_panel = create_box("RSL_AwningSheet",
                           (awn_center_x, awn_center_y, awn_center_z),
                           (AWN_W, awn_hypot, 0.04),
                           mat=mat_canopy_green, parent=root)
    awn_panel.rotation_euler = (awn_angle, 0, 0)

    # Awning perimeter dark fascia trim
    create_box("RSL_AwningFrontBeam",
               (awn_center_x, Y_FRONT - AWN_PROJ, AWN_Z_EAVE),
               (AWN_W + 0.06, 0.06, 0.12),
               mat=mat_canopy_trim, parent=root)
    
    # Left and Right side sloping fascia trims
    for side, sx in [("Left", awn_center_x - AWN_W / 2.0), ("Right", awn_center_x + AWN_W / 2.0)]:
        side_beam = create_box(f"RSL_AwningSideBeam_{side}",
                               (sx, awn_center_y, awn_center_z),
                               (0.06, awn_hypot, 0.10),
                               mat=mat_canopy_trim, parent=root)
        side_beam.rotation_euler = (awn_angle, 0, 0)

    # Architectural support knee brackets at outer edges (connecting wall to front corner)
    BRACKET_DROP = 0.50
    diag_len = math.hypot(AWN_PROJ, BRACKET_DROP)
    diag_ang = math.atan2(BRACKET_DROP, AWN_PROJ)
    for bx in [awn_center_x - AWN_W / 2.0 + 0.03, awn_center_x + AWN_W / 2.0 - 0.03]:
        # Diagonal strut from wall at Z = (AWN_Z_EAVE - BRACKET_DROP) to front corner at Z = AWN_Z_EAVE
        strut = create_box(f"RSL_BracketStrut_{bx:.2f}",
                           (bx, Y_FRONT - AWN_PROJ / 2.0, AWN_Z_EAVE - BRACKET_DROP / 2.0),
                           (0.04, diag_len, 0.04),
                           mat=mat_bracket_dark, parent=root)
        strut.rotation_euler = (-diag_ang, 0, 0)
        # Vertical wall anchor bar
        create_box(f"RSL_BracketWall_{bx:.2f}",
                   (bx, Y_FRONT + 0.01, AWN_Z_EAVE - BRACKET_DROP / 2.0),
                   (0.04, 0.03, BRACKET_DROP),
                   mat=mat_bracket_dark, parent=root)



    # 7. AUTHENTIC LABORATORY WINDOW BUILDER
    def create_authentic_window(name, center_x, wall_y, sill_z, width, height, num_panes=3, facing='FRONT'):
        win_root = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(win_root)
        win_root.parent = root

        center_z = sill_z + height / 2.0
        T_FRAME = 0.05
        FRAME_W = 0.06

        if facing == 'FRONT':
            # Dark tinted glass backing
            create_box(f"{name}_GlassBack",
                       (center_x, wall_y - 0.02, center_z),
                       (width, 0.02, height),
                       mat=mat_glass_tint, parent=win_root)
            
            # Outer white frame
            create_box(f"{name}_FrameTop",
                       (center_x, wall_y - 0.03, center_z + height / 2.0 - FRAME_W / 2.0),
                       (width, T_FRAME, FRAME_W),
                       mat=mat_frame_white, parent=win_root)
            create_box(f"{name}_FrameBottom",
                       (center_x, wall_y - 0.03, center_z - height / 2.0 + FRAME_W / 2.0),
                       (width, T_FRAME, FRAME_W),
                       mat=mat_frame_white, parent=win_root)
            create_box(f"{name}_FrameLeft",
                       (center_x - width / 2.0 + FRAME_W / 2.0, wall_y - 0.03, center_z),
                       (FRAME_W, T_FRAME, height),
                       mat=mat_frame_white, parent=win_root)
            create_box(f"{name}_FrameRight",
                       (center_x + width / 2.0 - FRAME_W / 2.0, wall_y - 0.03, center_z),
                       (FRAME_W, T_FRAME, height),
                       mat=mat_frame_white, parent=win_root)

            # Vertical mullion dividers
            for p in range(1, num_panes):
                px = center_x - width / 2.0 + p * (width / num_panes)
                create_box(f"{name}_Mullion_{p}",
                           (px, wall_y - 0.03, center_z),
                           (FRAME_W * 0.8, T_FRAME, height - FRAME_W * 2),
                           mat=mat_frame_white, parent=win_root)

            # White horizontal security grille bars
            for g in range(6):
                gz = sill_z + (g + 0.5) * (height / 6.0)
                create_box(f"{name}_Grille_{g+1}",
                           (center_x, wall_y - 0.045, gz),
                           (width - FRAME_W * 2, 0.015, 0.02),
                           mat=mat_grille_white, parent=win_root)

            # Concrete window sill ledge underneath
            create_box(f"{name}_Sill",
                       (center_x, wall_y - 0.05, sill_z - 0.04),
                       (width + 0.16, 0.12, 0.07),
                       mat=mat_plinth_grey, parent=win_root)

        elif facing == 'RIGHT':
            create_box(f"{name}_GlassBack",
                       (center_x + 0.02, wall_y, center_z),
                       (0.02, width, height),
                       mat=mat_glass_tint, parent=win_root)
            create_box(f"{name}_FrameTop",
                       (center_x + 0.03, wall_y, center_z + height / 2.0 - FRAME_W / 2.0),
                       (T_FRAME, width, FRAME_W),
                       mat=mat_frame_white, parent=win_root)
            create_box(f"{name}_FrameBottom",
                       (center_x + 0.03, wall_y, center_z - height / 2.0 + FRAME_W / 2.0),
                       (T_FRAME, width, FRAME_W),
                       mat=mat_frame_white, parent=win_root)
            create_box(f"{name}_FrameFront",
                       (center_x + 0.03, wall_y - width / 2.0 + FRAME_W / 2.0, center_z),
                       (T_FRAME, FRAME_W, height),
                       mat=mat_frame_white, parent=win_root)
            create_box(f"{name}_FrameRear",
                       (center_x + 0.03, wall_y + width / 2.0 - FRAME_W / 2.0, center_z),
                       (T_FRAME, FRAME_W, height),
                       mat=mat_frame_white, parent=win_root)

            for p in range(1, num_panes):
                py = wall_y - width / 2.0 + p * (width / num_panes)
                create_box(f"{name}_Mullion_{p}",
                           (center_x + 0.03, py, center_z),
                           (T_FRAME, FRAME_W * 0.8, height - FRAME_W * 2),
                           mat=mat_frame_white, parent=win_root)

            for g in range(6):
                gz = sill_z + (g + 0.5) * (height / 6.0)
                create_box(f"{name}_Grille_{g+1}",
                           (center_x + 0.045, wall_y, gz),
                           (0.015, width - FRAME_W * 2, 0.02),
                           mat=mat_grille_white, parent=win_root)

            create_box(f"{name}_Sill",
                       (center_x + 0.05, wall_y, sill_z - 0.04),
                       (0.12, width + 0.16, 0.07),
                       mat=mat_plinth_grey, parent=win_root)

        elif facing == 'LEFT':
            create_box(f"{name}_GlassBack",
                       (center_x - 0.02, wall_y, center_z),
                       (0.02, width, height),
                       mat=mat_glass_tint, parent=win_root)
            create_box(f"{name}_FrameTop",
                       (center_x - 0.03, wall_y, center_z + height / 2.0 - FRAME_W / 2.0),
                       (T_FRAME, width, FRAME_W),
                       mat=mat_frame_white, parent=win_root)
            create_box(f"{name}_FrameBottom",
                       (center_x - 0.03, wall_y, center_z - height / 2.0 + FRAME_W / 2.0),
                       (T_FRAME, width, FRAME_W),
                       mat=mat_frame_white, parent=win_root)
            create_box(f"{name}_FrameFront",
                       (center_x - 0.03, wall_y - width / 2.0 + FRAME_W / 2.0, center_z),
                       (T_FRAME, FRAME_W, height),
                       mat=mat_frame_white, parent=win_root)
            create_box(f"{name}_FrameRear",
                       (center_x - 0.03, wall_y + width / 2.0 - FRAME_W / 2.0, center_z),
                       (T_FRAME, FRAME_W, height),
                       mat=mat_frame_white, parent=win_root)

            for p in range(1, num_panes):
                py = wall_y - width / 2.0 + p * (width / num_panes)
                create_box(f"{name}_Mullion_{p}",
                           (center_x - 0.03, py, center_z),
                           (T_FRAME, FRAME_W * 0.8, height - FRAME_W * 2),
                           mat=mat_frame_white, parent=win_root)

            for g in range(6):
                gz = sill_z + (g + 0.5) * (height / 6.0)
                create_box(f"{name}_Grille_{g+1}",
                           (center_x - 0.045, wall_y, gz),
                           (0.015, width - FRAME_W * 2, 0.02),
                           mat=mat_grille_white, parent=win_root)

            create_box(f"{name}_Sill",
                       (center_x - 0.05, wall_y, sill_z - 0.04),
                       (0.12, width + 0.16, 0.07),
                       mat=mat_plinth_grey, parent=win_root)

        return win_root

    # 8. FRONT FACADE WINDOWS (IMG_3853)
    create_authentic_window("RSL_FrontWin1", center_x=-8.00, wall_y=Y_FRONT, sill_z=1.45, width=2.20, height=1.35, num_panes=3)
    create_authentic_window("RSL_FrontWin2", center_x=-0.80, wall_y=Y_FRONT, sill_z=1.45, width=2.20, height=1.35, num_panes=3)
    create_authentic_window("RSL_FrontWin3", center_x=6.20, wall_y=Y_FRONT, sill_z=1.45, width=3.60, height=1.35, num_panes=4)

    # 9. THROUGH-WALL WINDOW AC UNIT (Mounted in left pane of Window 3 at X = 4.80m)
    ac_win_x = 4.80
    create_box("RSL_WinAC_Body",
               (ac_win_x, Y_FRONT - 0.22, 1.45 + 0.35),
               (0.65, 0.45, 0.45),
               mat=mat_ac_beige, parent=root)
    create_box("RSL_WinAC_Grille",
               (ac_win_x, Y_FRONT - 0.45, 1.45 + 0.35),
               (0.60, 0.04, 0.40),
               mat=mat_ac_grille, parent=root)
    create_box("RSL_WinAC_Hood",
               (ac_win_x, Y_FRONT - 0.24, 1.45 + 0.60),
               (0.72, 0.50, 0.04),
               mat=mat_bracket_dark, parent=root)

    # 10. GROUND SPLIT AC CONDENSER (Next to entrance at X = -2.00m)
    create_box("RSL_GroundAC_Pad",
               (-1.95, Y_FRONT - 0.45, 0.05),
               (0.85, 0.55, 0.10),
               mat=mat_plinth_grey, parent=root)
    create_box("RSL_GroundAC_Body",
               (-1.95, Y_FRONT - 0.45, 0.42),
               (0.78, 0.38, 0.64),
               mat=mat_ac_beige, parent=root)
    create_cylinder("RSL_GroundAC_Fan",
                    (-1.95, Y_FRONT - 0.65, 0.42),
                    radius=0.22, depth=0.03, rot=(math.radians(90), 0, 0),
                    mat=mat_ac_grille, parent=root)
    create_cylinder("RSL_GroundAC_Pipe",
                    (-1.60, Y_FRONT - 0.22, 0.70),
                    radius=0.03, depth=0.55, rot=(0, 0, 0),
                    mat=mat_bracket_dark, parent=root)

    # 11. 3D DIMENSIONAL FACILITY SIGNAGE ON FRONT WALL (IMG_3853)
    def create_3d_text_line(name, text_body, center_x, center_z, size=0.22, extrude=0.03):
        try:
            curve = bpy.data.curves.new(type="FONT", name=f"{name}_Curve")
            curve.body = text_body
            curve.size = size
            curve.extrude = extrude
            curve.resolution_u = 1
            curve.align_x = 'CENTER'
            curve.align_y = 'CENTER'

            text_obj = bpy.data.objects.new(name, curve)
            bpy.context.scene.collection.objects.link(text_obj)
            text_obj.parent = root
            text_obj.location = (center_x, Y_FRONT - 0.02, center_z)
            text_obj.rotation_euler = (math.radians(90), 0, 0)
            text_obj.data.materials.append(mat_sign_text)

            # Convert to mesh for batch joining
            bpy.context.view_layer.objects.active = text_obj
            text_obj.select_set(True)
            bpy.ops.object.convert(target='MESH')
            text_obj.select_set(False)
            return text_obj
        except Exception as e:
            print(f"Text fallback for {text_body}: {e}")
            return create_box(name, (center_x, Y_FRONT - 0.03, center_z), (len(text_body) * 0.22, 0.03, size), mat=mat_sign_text, parent=root)

    create_3d_text_line("RSL_Sign_L1_REGIONAL", "REGIONAL", center_x=2.20, center_z=2.85, size=0.22)
    create_3d_text_line("RSL_Sign_L2_SOILS", "SOILS", center_x=2.20, center_z=2.56, size=0.22)
    create_3d_text_line("RSL_Sign_L3_LABORATORY", "LABORATORY", center_x=2.20, center_z=2.27, size=0.22)

    # 12. CLEAN FLUSH UTILITIES ON FRONT RIGHT (NO excess conduits or loose wirings)
    create_box("RSL_ElectricPanel",
               (9.40, Y_FRONT - 0.05, 1.95),
               (0.40, 0.10, 0.60),
               mat=mat_electric_box, parent=root)
    create_cylinder("RSL_Downspout_FR",
                    (10.15, Y_FRONT - 0.05, H_EAVE / 2.0),
                    radius=0.045, depth=H_EAVE, mat=mat_pipe_pvc, parent=root)

    # 13. RIGHT FLANK FACADE WINDOWS & UTILITIES (IMG_3852)
    create_authentic_window("RSL_RightWin1", center_x=X_RIGHT, wall_y=-8.50, sill_z=1.45, width=3.20, height=1.35, num_panes=4, facing='RIGHT')
    create_authentic_window("RSL_RightWin2", center_x=X_RIGHT, wall_y=-2.50, sill_z=2.15, width=1.30, height=0.75, num_panes=2, facing='RIGHT')
    create_authentic_window("RSL_RightWin3", center_x=X_RIGHT, wall_y=3.00, sill_z=1.45, width=2.00, height=1.35, num_panes=2, facing='RIGHT')
    
    create_box("RSL_RightAC_Body",
               (X_RIGHT + 0.28, 3.00, 0.95),
               (0.40, 0.85, 0.58),
               mat=mat_ac_beige, parent=root)
    create_cylinder("RSL_RightAC_Fan",
                    (X_RIGHT + 0.49, 3.00, 0.95),
                    radius=0.20, depth=0.03, rot=(0, math.radians(90), 0),
                    mat=mat_ac_grille, parent=root)
    for by in [2.70, 3.30]:
        create_box(f"RSL_RightAC_Bracket_{by:.1f}",
                   (X_RIGHT + 0.20, by, 0.65),
                   (0.38, 0.05, 0.15),
                   mat=mat_bracket_dark, parent=root)

    create_authentic_window("RSL_RightWin4", center_x=X_RIGHT, wall_y=8.00, sill_z=1.45, width=1.00, height=1.35, num_panes=1, facing='RIGHT')
    create_cylinder("RSL_Downspout_RR",
                    (X_RIGHT + 0.05, Y_REAR - 0.10, H_EAVE / 2.0),
                    radius=0.045, depth=H_EAVE, mat=mat_pipe_pvc, parent=root)

    # 14. LEFT FLANK FACADE WINDOWS (IMG_3854)
    create_authentic_window("RSL_LeftWin1", center_x=X_LEFT, wall_y=-8.50, sill_z=1.45, width=2.40, height=1.35, num_panes=3, facing='LEFT')
    create_authentic_window("RSL_LeftWin2", center_x=X_LEFT, wall_y=-2.00, sill_z=1.45, width=2.40, height=1.35, num_panes=3, facing='LEFT')
    create_authentic_window("RSL_LeftWin3", center_x=X_LEFT, wall_y=4.50, sill_z=1.45, width=2.40, height=1.35, num_panes=3, facing='LEFT')
    create_authentic_window("RSL_LeftWin4", center_x=X_LEFT, wall_y=10.00, sill_z=1.45, width=1.80, height=1.35, num_panes=2, facing='LEFT')

    create_box("RSL_LeftAC_Body",
               (X_LEFT - 0.28, -5.00, 1.20),
               (0.40, 0.85, 0.58),
               mat=mat_ac_beige, parent=root)
    create_cylinder("RSL_LeftAC_Fan",
                    (X_LEFT - 0.49, -5.00, 1.20),
                    radius=0.20, depth=0.03, rot=(0, math.radians(90), 0),
                    mat=mat_ac_grille, parent=root)

    # 15. REAR WALL SERVICE DOOR & WINDOWS (Y = Y_REAR = +13.80m)
    create_box("RSL_RearDoor",
               (0.00, Y_REAR + 0.02, H_PLINTH + 1.10),
               (1.10, 0.06, 2.20),
               mat=mat_bronze_door, parent=root)
    create_authentic_window("RSL_RearWin1", center_x=-5.50, wall_y=Y_REAR, sill_z=1.45, width=2.40, height=1.35, num_panes=3, facing='FRONT')
    create_authentic_window("RSL_RearWin2", center_x=5.50, wall_y=Y_REAR, sill_z=1.45, width=2.40, height=1.35, num_panes=3, facing='FRONT')

    # 16. NORMAL SYMMETRICAL TRIANGULAR GABLE ROOF (Watertight, 100% attached)
    ROOF_OH = 0.80
    X_ROOF_L = X_LEFT - ROOF_OH    # -11.15m
    X_ROOF_R = X_RIGHT + ROOF_OH   # +11.15m
    Y_ROOF_F = Y_FRONT - ROOF_OH   # -14.60m
    Y_ROOF_R = Y_REAR + ROOF_OH    # +14.60m
    ROOF_LEN_Y = D + ROOF_OH * 2    # 29.20m

    ROOF_HALF_SPAN = X_ROOF_R       # 11.15m
    ROOF_RISE = H_RIDGE - H_EAVE    # 5.20 - 3.45 = 1.75m
    roof_angle = math.atan2(ROOF_RISE, ROOF_HALF_SPAN)
    roof_slope_w = math.hypot(ROOF_HALF_SPAN, ROOF_RISE)
    ROOF_THICK = 0.08

    # Left Roof Slab (slopes down from X = 0 to X = -11.15m)
    roof_left = create_box("RSL_RoofSlab_Left",
                           (-ROOF_HALF_SPAN / 2.0, 0.0, (H_RIDGE + H_EAVE) / 2.0),
                           (roof_slope_w, ROOF_LEN_Y, ROOF_THICK),
                           mat=mat_roof_metal, parent=root)
    roof_left.rotation_euler = (0, -roof_angle, 0)

    # Right Roof Slab (slopes down from X = 0 to X = +11.15m)
    roof_right = create_box("RSL_RoofSlab_Right",
                            (ROOF_HALF_SPAN / 2.0, 0.0, (H_RIDGE + H_EAVE) / 2.0),
                            (roof_slope_w, ROOF_LEN_Y, ROOF_THICK),
                            mat=mat_roof_metal, parent=root)
    roof_right.rotation_euler = (0, roof_angle, 0)

    # Ridge Cap along apex at X = 0.0m
    create_box("RSL_RoofRidgeCap",
               (0.00, 0.0, H_RIDGE + ROOF_THICK / 2.0),
               (0.40, ROOF_LEN_Y + 0.04, 0.06),
               mat=mat_roof_metal, parent=root)

    # 17. FASCIA BOARDS (White Metal Trim forming inverted 'V' at gables and along eaves)
    FASCIA_H = 0.22
    FASCIA_T = 0.06

    # Eave fascias (horizontal along sides)
    create_box("RSL_Fascia_LeftEave",
               (X_ROOF_L - FASCIA_T / 2.0, 0.0, H_EAVE + FASCIA_H / 2.0 - 0.04),
               (FASCIA_T, ROOF_LEN_Y + 0.04, FASCIA_H),
               mat=mat_fascia_white, parent=root)
    create_box("RSL_Fascia_RightEave",
               (X_ROOF_R + FASCIA_T / 2.0, 0.0, H_EAVE + FASCIA_H / 2.0 - 0.04),
               (FASCIA_T, ROOF_LEN_Y + 0.04, FASCIA_H),
               mat=mat_fascia_white, parent=root)

    # Front Gable Fascia Rakes (forming inverted 'V' at front)
    fascia_fl = create_box("RSL_Fascia_FrontLeftRake",
                           (-ROOF_HALF_SPAN / 2.0, Y_ROOF_F - FASCIA_T / 2.0, (H_RIDGE + H_EAVE) / 2.0),
                           (roof_slope_w, FASCIA_T, FASCIA_H),
                           mat=mat_fascia_white, parent=root)
    fascia_fl.rotation_euler = (0, -roof_angle, 0)

    fascia_fr = create_box("RSL_Fascia_FrontRightRake",
                           (ROOF_HALF_SPAN / 2.0, Y_ROOF_F - FASCIA_T / 2.0, (H_RIDGE + H_EAVE) / 2.0),
                           (roof_slope_w, FASCIA_T, FASCIA_H),
                           mat=mat_fascia_white, parent=root)
    fascia_fr.rotation_euler = (0, roof_angle, 0)

    # Rear Gable Fascia Rakes (forming inverted 'V' at rear)
    fascia_rl = create_box("RSL_Fascia_RearLeftRake",
                           (-ROOF_HALF_SPAN / 2.0, Y_ROOF_R + FASCIA_T / 2.0, (H_RIDGE + H_EAVE) / 2.0),
                           (roof_slope_w, FASCIA_T, FASCIA_H),
                           mat=mat_fascia_white, parent=root)
    fascia_rl.rotation_euler = (0, -roof_angle, 0)

    fascia_rr = create_box("RSL_Fascia_RearRightRake",
                           (ROOF_HALF_SPAN / 2.0, Y_ROOF_R + FASCIA_T / 2.0, (H_RIDGE + H_EAVE) / 2.0),
                           (roof_slope_w, FASCIA_T, FASCIA_H),
                           mat=mat_fascia_white, parent=root)
    fascia_rr.rotation_euler = (0, roof_angle, 0)

    # 18. WHITE SOFFIT PANELS (Full underside enclosure)
    SOFFIT_T = 0.04
    # Horizontal side eave soffits
    create_box("RSL_Soffit_LeftEave",
               (X_LEFT - ROOF_OH / 2.0, 0.0, H_EAVE - SOFFIT_T / 2.0),
               (ROOF_OH, ROOF_LEN_Y, SOFFIT_T),
               mat=mat_soffit_white, parent=root)
    create_box("RSL_Soffit_RightEave",
               (X_RIGHT + ROOF_OH / 2.0, 0.0, H_EAVE - SOFFIT_T / 2.0),
               (ROOF_OH, ROOF_LEN_Y, SOFFIT_T),
               mat=mat_soffit_white, parent=root)

    # Sloping front gable overhang soffits
    soffit_fl = create_box("RSL_Soffit_FrontLeft",
                           (-ROOF_HALF_SPAN / 2.0, Y_FRONT - ROOF_OH / 2.0, (H_RIDGE + H_EAVE) / 2.0 - 0.04),
                           (roof_slope_w, ROOF_OH, SOFFIT_T),
                           mat=mat_soffit_white, parent=root)
    soffit_fl.rotation_euler = (0, -roof_angle, 0)

    soffit_fr = create_box("RSL_Soffit_FrontRight",
                           (ROOF_HALF_SPAN / 2.0, Y_FRONT - ROOF_OH / 2.0, (H_RIDGE + H_EAVE) / 2.0 - 0.04),
                           (roof_slope_w, ROOF_OH, SOFFIT_T),
                           mat=mat_soffit_white, parent=root)
    soffit_fr.rotation_euler = (0, roof_angle, 0)

    # Sloping rear gable overhang soffits
    soffit_rl = create_box("RSL_Soffit_RearLeft",
                           (-ROOF_HALF_SPAN / 2.0, Y_REAR + ROOF_OH / 2.0, (H_RIDGE + H_EAVE) / 2.0 - 0.04),
                           (roof_slope_w, ROOF_OH, SOFFIT_T),
                           mat=mat_soffit_white, parent=root)
    soffit_rl.rotation_euler = (0, -roof_angle, 0)

    soffit_rr = create_box("RSL_Soffit_RearRight",
                           (ROOF_HALF_SPAN / 2.0, Y_REAR + ROOF_OH / 2.0, (H_RIDGE + H_EAVE) / 2.0 - 0.04),
                           (roof_slope_w, ROOF_OH, SOFFIT_T),
                           mat=mat_soffit_white, parent=root)
    soffit_rr.rotation_euler = (0, roof_angle, 0)

    # Side eave gutters
    create_box("RSL_Gutter_Left",
               (X_ROOF_L - FASCIA_T - 0.05, 0.0, H_EAVE + 0.05),
               (0.10, ROOF_LEN_Y, 0.08),
               mat=mat_fascia_white, parent=root)
    create_box("RSL_Gutter_Right",
               (X_ROOF_R + FASCIA_T + 0.05, 0.0, H_EAVE + 0.05),
               (0.10, ROOF_LEN_Y, 0.08),
               mat=mat_fascia_white, parent=root)

    print("RSL Building procedural construction complete!")
    
    # BATCH JOIN BY MATERIAL & EXPORT GLB
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
        active.name = f"RSL_Batch_{mname}"
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
    print(f"GLB export complete! File size: {size_kb:.1f} KB (budget: 300 KB)")
    return size_kb

build_rsl_building()
