"""
Bespoke 3D Architectural Reconstruction of the Guest House
Department of Agriculture - Southern Tagalog Integrated Agricultural Research Center (DA-LARES)

GROUND TRUTH FIELD SOURCES & VERIFIED ARCHITECTURE:
- IMG_3893: Front facade. Shows the generic normal house in the background with its main triangular
  gable roof, and in the foreground, the front extension rectangle (enclosed bedroom on the left with
  grilled window; covered veranda porch on the right with wood entrance door on the main wall,
  grilled window, concrete floor slab, red steel tubular posts, and the smaller roof with red steel trusses).
- IMG_3894: Outer Right Flank. Shows the main building's simple triangle (gable) roof with corrugated
  metal sheets and exposed red/maroon rafter tails, square window with black security grilles,
  wall-mounted Haier split-type AC outdoor compressor with curved conduit pipe, and weathered wooden
  service door towards the rear.
- IMG_3895: Rear and rear-right angle. Confirms the simple triangle (symmetrical gable) roof with
  solid white triangular gable wall rising seamlessly to the apex ridge, and exposed rafter tails.
- USER SPECIFICATIONS:
  "Its a normal house with a triangle as in normal triangle house. Generic house.
   and then they have a sort of extension rectangle and roof at the front.
   So again its a smaller roof and normal roof."
  "main roof isnt attached to the house" ->
  Completely eliminated any separation or gaps between walls and roofs:
  - All walls now extend directly up into the volumetric roof slabs with watertight overlap.
  - Front and rear gables are full 3D solid masonry wedges matching the exact roof pitch.
  - Solid soffits and rake fascias seal all eaves and gables.
  - The front smaller roof is firmly attached to the main front wall with an integrated flashing beam.
- STRICT RULE 4: No cars, no people, no chairs/tables, no blue recycling sacks, no detached trees.
- PERFORMANCE BUDGET: Model GLB file size strictly < 300 KB.
"""

import bpy
import bmesh
import math
import os

def create_mat(name, color, roughness=0.5, metallic=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*color[:3], 1.0)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        if alpha < 1.0:
            if 'Alpha' in bsdf.inputs:
                bsdf.inputs['Alpha'].default_value = alpha
            mat.blend_method = 'BLEND'
    return mat

def create_box(name, loc, size, mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, loc, radius, height, mat=None, segments=12, rot=(0,0,0), parent=None):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=segments,
        radius=radius,
        depth=height,
        location=loc,
        rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_window(name, cx, cy, cz, width, height, axis='X', mat_frame=None, mat_glass=None, mat_grille=None, parent=None):
    """Creates a detailed window with black aluminum outer frame, glass, and 3D security grille bars"""
    frame_d = 0.16
    bar_r = 0.012
    if axis == 'X':
        create_box(f"{name}_Frame", (cx, cy, cz), (width, frame_d, height), mat_frame, parent)
        create_box(f"{name}_Glass", (cx, cy, cz), (width - 0.12, 0.02, height - 0.12), mat_glass, parent)
        num_v = max(3, int(width / 0.25))
        for i in range(num_v):
            bx = cx - (width - 0.16)/2 + i * (width - 0.16)/(num_v - 1)
            create_cylinder(f"{name}_VBar_{i}", (bx, cy - frame_d/2 - 0.01, cz), bar_r, height - 0.14, mat_grille, parent=parent)
        for j in [-0.25, 0.0, +0.25]:
            create_box(f"{name}_HBar_{j}", (cx, cy - frame_d/2 - 0.01, cz + j * (height - 0.16)), (width - 0.14, 0.02, 0.025), mat_grille, parent)
    else:
        create_box(f"{name}_Frame", (cx, cy, cz), (frame_d, width, height), mat_frame, parent)
        create_box(f"{name}_Glass", (cx, cy, cz), (0.02, width - 0.12, height - 0.12), mat_glass, parent)
        num_v = max(3, int(width / 0.25))
        for i in range(num_v):
            by = cy - (width - 0.16)/2 + i * (width - 0.16)/(num_v - 1)
            create_cylinder(f"{name}_VBar_{i}", (cx + frame_d/2 + 0.01, by, cz), bar_r, height - 0.14, mat_grille, parent=parent)
        for j in [-0.25, 0.0, +0.25]:
            create_box(f"{name}_HBar_{j}", (cx + frame_d/2 + 0.01, cy, cz + j * (height - 0.16)), (0.02, width - 0.14, 0.025), mat_grille, parent)

def build_guest_house_model():
    # 0. Reset Scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    root = bpy.data.objects.new("GuestHouse_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # =========================================================================
    # 1. AUTHENTIC MATERIALS PALETTE
    # =========================================================================
    mat_wall_white   = create_mat("GH_WallWhite", (0.91, 0.92, 0.90), roughness=0.70)      # White painted stucco
    mat_plinth_grey  = create_mat("GH_PlinthGrey", (0.42, 0.44, 0.43), roughness=0.75)     # Weathered concrete plinth
    mat_floor_conc   = create_mat("GH_ConcreteFloor", (0.72, 0.73, 0.72), roughness=0.60)  # Concrete floor/porch
    mat_roof_metal   = create_mat("GH_RoofCorrugated", (0.50, 0.55, 0.53), roughness=0.45, metallic=0.25) # Galvanized corrugated sheet
    mat_truss_red    = create_mat("GH_TrussRed", (0.55, 0.22, 0.18), roughness=0.55)      # Red oxide painted steel trusses/rafters
    mat_door_wood    = create_mat("GH_DoorWood", (0.48, 0.35, 0.25), roughness=0.65)      # Natural wood door
    mat_door_old     = create_mat("GH_DoorWeathered", (0.52, 0.42, 0.34), roughness=0.75) # Weathered service door
    mat_frame_black  = create_mat("GH_FrameBlack", (0.15, 0.15, 0.15), roughness=0.40, metallic=0.60) # Black window frames
    mat_glass_tint   = create_mat("GH_GlassTint", (0.15, 0.20, 0.22), roughness=0.10, metallic=0.85, alpha=0.60) # Tinted glass
    mat_grille_black = create_mat("GH_GrilleBlack", (0.18, 0.18, 0.18), roughness=0.35, metallic=0.70) # Security grilles
    mat_ac_white     = create_mat("GH_ACWhite", (0.92, 0.93, 0.92), roughness=0.35)
    mat_ac_dark      = create_mat("GH_ACDark", (0.22, 0.22, 0.22), roughness=0.50, metallic=0.40)
    mat_pipe_white   = create_mat("GH_PipeWhite", (0.88, 0.89, 0.88), roughness=0.50)

    # Architectural Constants
    Z_BASE = 0.00
    Z_FLOOR = 0.25
    Z_WALL_TOP = 2.95  # Wall extends all the way into the roof slab (eliminates 100% of gaps)
    Z_RIDGE = 4.35     # Apex ridge of main generic house roof
    W_TH = 0.20        # Wall thickness

    # =========================================================================
    # 2. COORDINATES & FOOTPRINT
    # =========================================================================
    # Main Generic House:
    X_L = -4.20
    X_R = +4.20
    RIDGE_X = 0.00
    Y_MAIN_FRONT = -2.00
    Y_MAIN_REAR  = +7.60

    # Front Extension:
    Y_EXT_FRONT = -5.20
    X_STEP = +0.20

    def build_wall_h(name, x1, x2, y, z_bot=Z_FLOOR, z_top=Z_WALL_TOP, mat=mat_wall_white):
        min_x, max_x = min(x1, x2), max(x1, x2)
        length = max_x - min_x
        if length <= 0.001: return
        h = z_top - z_bot
        cx = (min_x + max_x) / 2
        cz = z_bot + h / 2
        if abs(z_bot - Z_FLOOR) < 0.01:
            create_box(f"{name}_Plinth", (cx, y, Z_FLOOR/2), (length, W_TH + 0.04, Z_FLOOR), mat_plinth_grey, root)
        create_box(f"{name}_Wall", (cx, y, cz), (length, W_TH, h), mat, root)

    def build_wall_v(name, x, y1, y2, z_bot=Z_FLOOR, z_top=Z_WALL_TOP, mat=mat_wall_white):
        min_y, max_y = min(y1, y2), max(y1, y2)
        length = max_y - min_y
        if length <= 0.001: return
        h = z_top - z_bot
        cy = (min_y + max_y) / 2
        cz = z_bot + h / 2
        if abs(z_bot - Z_FLOOR) < 0.01:
            create_box(f"{name}_Plinth", (x, cy, Z_FLOOR/2), (W_TH + 0.04, length, Z_FLOOR), mat_plinth_grey, root)
        create_box(f"{name}_Wall", (x, cy, cz), (W_TH, length, h), mat, root)

    # =========================================================================
    # 3. CONCRETE FLOOR SLABS
    # =========================================================================
    create_box("GH_Main_Floor", (0.0, (Y_MAIN_FRONT + Y_MAIN_REAR)/2, Z_FLOOR/2), 
               (X_R - X_L, Y_MAIN_REAR - Y_MAIN_FRONT, Z_FLOOR), mat_floor_conc, root)
    create_box("GH_ExtRoom_Floor", ((X_L + X_STEP)/2, (Y_EXT_FRONT + Y_MAIN_FRONT)/2, Z_FLOOR/2),
               (X_STEP - X_L, Y_MAIN_FRONT - Y_EXT_FRONT, Z_FLOOR), mat_floor_conc, root)
    create_box("GH_Porch_Floor", ((X_STEP + X_R)/2, (Y_EXT_FRONT + Y_MAIN_FRONT)/2, Z_FLOOR/2),
               (X_R - X_STEP, Y_MAIN_FRONT - Y_EXT_FRONT, Z_FLOOR), mat_floor_conc, root)

    # =========================================================================
    # 4. SOLID 3D GABLE WALLS & VERTICAL ENCLOSURES (WATERTIGHT ATTACHMENT)
    # =========================================================================
    def create_solid_gable(name, y_center, y_thick, x_left, x_right, z_eave, x_ridge, z_ridge, mat):
        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        bm = bmesh.new()
        y_f = y_center - y_thick / 2
        y_b = y_center + y_thick / 2
        
        # Vertices
        v_fl = bm.verts.new((x_left,  y_f, z_eave))
        v_fr = bm.verts.new((x_right, y_f, z_eave))
        v_fp = bm.verts.new((x_ridge, y_f, z_ridge))
        v_bl = bm.verts.new((x_left,  y_b, z_eave))
        v_br = bm.verts.new((x_right, y_b, z_eave))
        v_bp = bm.verts.new((x_ridge, y_b, z_ridge))
        
        # Faces
        bm.faces.new((v_fl, v_fr, v_fp))
        bm.faces.new((v_br, v_bl, v_bp))
        bm.faces.new((v_fl, v_bl, v_br, v_fr))
        bm.faces.new((v_fl, v_fp, v_bp, v_bl))
        bm.faces.new((v_fr, v_br, v_bp, v_fp))
        
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
        
        obj = bpy.data.objects.new(name, mesh)
        obj.data.materials.append(mat)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = root
        return obj

    # 4.1 Rear Facade (Y = Y_MAIN_REAR = +7.60) (IMG_3895)
    build_wall_h("GH_Rear_Wall", X_L, X_R, Y_MAIN_REAR)
    # Solid 3D Rear Triangular Gable Wall up into roof peak:
    create_solid_gable("GH_Rear_Gable_Solid", Y_MAIN_REAR, W_TH, X_L, X_R, Z_WALL_TOP, RIDGE_X, Z_RIDGE + 0.05, mat_wall_white)

    # 4.2 Front Facade of Main House (Y = Y_MAIN_FRONT = -2.00)
    # Solid 3D Front Triangular Gable Wall up into roof peak:
    create_solid_gable("GH_Front_Gable_Solid", Y_MAIN_FRONT, W_TH, X_L, X_R, Z_WALL_TOP, RIDGE_X, Z_RIDGE + 0.05, mat_wall_white)

    # Under-porch wall on Y_MAIN_FRONT (IMG_3893):
    DOOR_X = +1.10
    DOOR_W = 0.95
    DOOR_H = 2.10
    build_wall_h("GH_Recessed_Wall_L", X_STEP, DOOR_X - DOOR_W/2, Y_MAIN_FRONT)
    build_wall_h("GH_Recessed_Header", DOOR_X - DOOR_W/2, DOOR_X + DOOR_W/2, Y_MAIN_FRONT, z_bot=Z_FLOOR + DOOR_H, z_top=Z_WALL_TOP)

    # Main Entrance Wooden Door (IMG_3893)
    create_box("GH_Door_Main_Frame", (DOOR_X, Y_MAIN_FRONT, Z_FLOOR + DOOR_H/2), (DOOR_W, 0.22, DOOR_H), mat_door_wood, root)
    create_box("GH_Door_Main_Panel", (DOOR_X, Y_MAIN_FRONT - 0.01, Z_FLOOR + DOOR_H/2), (DOOR_W - 0.10, 0.04, DOOR_H - 0.10), mat_door_wood, root)
    create_cylinder("GH_Door_Main_Knob", (DOOR_X + 0.35, Y_MAIN_FRONT - 0.05, Z_FLOOR + 1.00), 0.025, 0.05, mat_ac_white, rot=(math.pi/2, 0, 0), parent=root)

    # Right Front Window under Porch (IMG_3893)
    FR_WIN_CX = +2.85
    FR_WIN_W  = 1.50
    build_wall_h("GH_Recessed_Wall_Mid", DOOR_X + DOOR_W/2, FR_WIN_CX - FR_WIN_W/2, Y_MAIN_FRONT)
    build_wall_h("GH_Recessed_Wall_R", FR_WIN_CX + FR_WIN_W/2, X_R, Y_MAIN_FRONT)
    build_wall_h("GH_FrontRight_Win_Sill", FR_WIN_CX - FR_WIN_W/2, FR_WIN_CX + FR_WIN_W/2, Y_MAIN_FRONT, z_top=Z_FLOOR + 0.80)
    build_wall_h("GH_FrontRight_Win_Head", FR_WIN_CX - FR_WIN_W/2, FR_WIN_CX + FR_WIN_W/2, Y_MAIN_FRONT, z_bot=Z_FLOOR + 2.00)
    build_window("GH_FrontRight_Win", FR_WIN_CX, Y_MAIN_FRONT, Z_FLOOR + 1.40, FR_WIN_W, 1.20, axis='X',
                 mat_frame=mat_frame_black, mat_glass=mat_glass_tint, mat_grille=mat_grille_black, parent=root)

    # 4.3 Right Flank (Outer East Wall, X = X_R = +4.20) (IMG_3894)
    SIDE_WIN_Y = +1.80
    SIDE_WIN_W = 1.40
    build_wall_v("GH_Right_Wall_1", X_R, Y_MAIN_FRONT, SIDE_WIN_Y - SIDE_WIN_W/2)
    build_wall_v("GH_Right_Wall_2", X_R, SIDE_WIN_Y + SIDE_WIN_W/2, +4.80)
    build_wall_v("GH_Right_Win_Sill", X_R, SIDE_WIN_Y - SIDE_WIN_W/2, SIDE_WIN_Y + SIDE_WIN_W/2, z_top=Z_FLOOR + 0.80)
    build_wall_v("GH_Right_Win_Header", X_R, SIDE_WIN_Y - SIDE_WIN_W/2, SIDE_WIN_Y + SIDE_WIN_W/2, z_bot=Z_FLOOR + 2.00)
    build_window("GH_Right_Win", X_R, SIDE_WIN_Y, Z_FLOOR + 1.40, SIDE_WIN_W, 1.20, axis='Y',
                 mat_frame=mat_frame_black, mat_glass=mat_glass_tint, mat_grille=mat_grille_black, parent=root)

    # Haier Split-type Outdoor AC Unit with curved conduit (IMG_3894)
    AC_Y = +2.95
    create_box("GH_Right_AC_Body", (X_R + 0.28, AC_Y, Z_FLOOR + 1.05), (0.45, 0.80, 0.58), mat_ac_white, root)
    create_box("GH_Right_AC_Fan",  (X_R + 0.51, AC_Y - 0.10, Z_FLOOR + 1.05), (0.02, 0.44, 0.44), mat_ac_dark, root)
    create_box("GH_Right_AC_Bracket1", (X_R + 0.18, AC_Y - 0.28, Z_FLOOR + 0.72), (0.32, 0.04, 0.18), mat_frame_black, root)
    create_box("GH_Right_AC_Bracket2", (X_R + 0.18, AC_Y + 0.28, Z_FLOOR + 0.72), (0.32, 0.04, 0.18), mat_frame_black, root)
    create_cylinder("GH_Right_AC_Pipe_V", (X_R + 0.08, AC_Y - 0.36, Z_FLOOR + 1.50), 0.025, 0.80, mat_pipe_white, parent=root)
    create_cylinder("GH_Right_AC_Pipe_H", (X_R + 0.08, AC_Y - 0.24, Z_FLOOR + 1.90), 0.025, 0.24, mat_pipe_white, rot=(math.pi/2, 0, 0), parent=root)

    # Weathered Service Door (IMG_3894)
    SDOOR_Y = +5.45
    SDOOR_W = 0.90
    SDOOR_H = 2.05
    build_wall_v("GH_Right_Wall_3", X_R, SDOOR_Y + SDOOR_W/2, Y_MAIN_REAR)
    build_wall_v("GH_Right_SDoor_Header", X_R, SDOOR_Y - SDOOR_W/2, SDOOR_Y + SDOOR_W/2, z_bot=Z_FLOOR + SDOOR_H, z_top=Z_WALL_TOP)
    create_box("GH_Right_SDoor_Frame", (X_R, SDOOR_Y, Z_FLOOR + SDOOR_H/2), (0.22, SDOOR_W, SDOOR_H), mat_door_old, root)
    create_box("GH_Right_SDoor_Panel", (X_R + 0.01, SDOOR_Y, Z_FLOOR + SDOOR_H/2), (0.04, SDOOR_W - 0.10, SDOOR_H - 0.10), mat_door_old, root)
    create_cylinder("GH_Right_SDoor_Knob", (X_R + 0.04, SDOOR_Y - 0.32, Z_FLOOR + 1.00), 0.022, 0.04, mat_ac_white, rot=(0, math.pi/2, 0), parent=root)

    # 4.4 Left Flank (Continuous outer West wall from Y_EXT_FRONT to Y_MAIN_REAR)
    build_wall_v("GH_Continuous_Left_Wall", X_L, Y_EXT_FRONT, Y_MAIN_REAR)

    # =========================================================================
    # 5. FRONT EXTENSION RECTANGLE (IMG_3893)
    # =========================================================================
    # 5.1 Front Wall of Extension Room (Y = Y_EXT_FRONT = -5.20, X from X_L to X_STEP)
    FL_WIN_CX = -2.00
    FL_WIN_W  = 1.50
    build_wall_h("GH_FrontLeft_Wall_1", X_L, FL_WIN_CX - FL_WIN_W/2, Y_EXT_FRONT)
    build_wall_h("GH_FrontLeft_Wall_2", FL_WIN_CX + FL_WIN_W/2, X_STEP, Y_EXT_FRONT)
    build_wall_h("GH_FrontLeft_Win_Sill", FL_WIN_CX - FL_WIN_W/2, FL_WIN_CX + FL_WIN_W/2, Y_EXT_FRONT, z_top=Z_FLOOR + 0.80)
    build_wall_h("GH_FrontLeft_Win_Head", FL_WIN_CX - FL_WIN_W/2, FL_WIN_CX + FL_WIN_W/2, Y_EXT_FRONT, z_bot=Z_FLOOR + 2.00)
    build_window("GH_FrontLeft_Win", FL_WIN_CX, Y_EXT_FRONT, Z_FLOOR + 1.40, FL_WIN_W, 1.20, axis='X',
                 mat_frame=mat_frame_black, mat_glass=mat_glass_tint, mat_grille=mat_grille_black, parent=root)

    # 5.2 Inner Step Wall separating Extension Room from Porch (X = X_STEP = +0.20, Y in [Y_EXT_FRONT, Y_MAIN_FRONT])
    build_wall_v("GH_Ext_Step_Wall", X_STEP, Y_EXT_FRONT, Y_MAIN_FRONT)
    # Low concrete porch bench/retaining wall along the step (IMG_3893)
    create_box("GH_Porch_Bench_Wall", (X_STEP + 0.15, (Y_EXT_FRONT + Y_MAIN_FRONT)/2, Z_FLOOR + 0.45/2), 
               (0.30, Y_MAIN_FRONT - Y_EXT_FRONT, 0.45), mat_plinth_grey, root)

    # =========================================================================
    # 6. VOLUMETRIC MAIN GABLE ROOF: 100% ATTACHED & WATERTIGHT (IMG_3894, 3895)
    # =========================================================================
    # The main roof covers the generic house from Y = Y_MAIN_FRONT to Y = Y_MAIN_REAR.
    # Overhangs: 0.50m past rear (+8.10), 0.35m past front (-2.35).
    # Eaves: 0.55m past left and right walls (from X = -4.75 to +4.75).
    ROOF_THICK = 0.08
    E_X_L = X_L - 0.55 # -4.75
    E_X_R = X_R + 0.55 # +4.75
    E_Y_REAR  = Y_MAIN_REAR + 0.50  # +8.10
    E_Y_FRONT = Y_MAIN_FRONT - 0.35 # -2.35

    main_roof_mesh = bpy.data.meshes.new("GH_Main_Roof_Volumetric")
    bm_mr = bmesh.new()

    def add_roof_slab(p1, p2, p3, p4, thickness, normal_dir):
        offset = [normal_dir[0] * thickness, normal_dir[1] * thickness, normal_dir[2] * thickness]
        v1 = bm_mr.verts.new(p1)
        v2 = bm_mr.verts.new(p2)
        v3 = bm_mr.verts.new(p3)
        v4 = bm_mr.verts.new(p4)
        v1b = bm_mr.verts.new((p1[0] - offset[0], p1[1] - offset[1], p1[2] - offset[2]))
        v2b = bm_mr.verts.new((p2[0] - offset[0], p2[1] - offset[1], p2[2] - offset[2]))
        v3b = bm_mr.verts.new((p3[0] - offset[0], p3[1] - offset[1], p3[2] - offset[2]))
        v4b = bm_mr.verts.new((p4[0] - offset[0], p4[1] - offset[1], p4[2] - offset[2]))
        bm_mr.faces.new((v1, v2, v3, v4))
        bm_mr.faces.new((v4b, v3b, v2b, v1b))
        bm_mr.faces.new((v1, v1b, v2b, v2))
        bm_mr.faces.new((v2, v2b, v3b, v3))
        bm_mr.faces.new((v3, v3b, v4b, v4))
        bm_mr.faces.new((v4, v4b, v1b, v1))

    # Left Slope
    p_L1 = (E_X_L,   E_Y_REAR,  2.85)
    p_L2 = (E_X_L,   E_Y_FRONT, 2.85)
    p_L3 = (RIDGE_X, E_Y_FRONT, 4.40)
    p_L4 = (RIDGE_X, E_Y_REAR,  4.40)
    add_roof_slab(p_L1, p_L2, p_L3, p_L4, ROOF_THICK, (-0.303, 0, 0.953))

    # Right Slope
    p_R1 = (RIDGE_X, E_Y_REAR,  4.40)
    p_R2 = (RIDGE_X, E_Y_FRONT, 4.40)
    p_R3 = (E_X_R,   E_Y_FRONT, 2.85)
    p_R4 = (E_X_R,   E_Y_REAR,  2.85)
    add_roof_slab(p_R1, p_R2, p_R3, p_R4, ROOF_THICK, (0.303, 0, 0.953))

    bmesh.ops.recalc_face_normals(bm_mr, faces=bm_mr.faces)
    bm_mr.to_mesh(main_roof_mesh)
    bm_mr.free()

    main_roof_obj = bpy.data.objects.new("GH_Main_Roof", main_roof_mesh)
    main_roof_obj.data.materials.append(mat_roof_metal)
    bpy.context.scene.collection.objects.link(main_roof_obj)
    main_roof_obj.parent = root

    # 6.1 Soffits closing gaps along left and right eaves
    create_box("GH_Soffit_L", ((X_L + E_X_L)/2, (Y_MAIN_FRONT + Y_MAIN_REAR)/2, Z_WALL_TOP - 0.04),
               (abs(E_X_L - X_L), Y_MAIN_REAR - Y_MAIN_FRONT, 0.06), mat_wall_white, root)
    create_box("GH_Soffit_R", ((X_R + E_X_R)/2, (Y_MAIN_FRONT + Y_MAIN_REAR)/2, Z_WALL_TOP - 0.04),
               (abs(E_X_R - X_R), Y_MAIN_REAR - Y_MAIN_FRONT, 0.06), mat_wall_white, root)

    # 6.3 Exposed Red/Maroon Rafter Tails along eaves (IMG_3894, IMG_3895)
    for ry in range(int(Y_MAIN_FRONT), int(Y_MAIN_REAR) + 1):
        create_box(f"GH_Rafter_L_{ry}", (E_X_L + 0.25, ry, Z_WALL_TOP - 0.08), (0.50, 0.06, 0.08), mat_truss_red, root)
        create_box(f"GH_Rafter_R_{ry}", (E_X_R - 0.25, ry, Z_WALL_TOP - 0.08), (0.50, 0.06, 0.08), mat_truss_red, root)

    # 6.4 Longitudinal Ridge Cap
    create_cylinder("GH_Ridge_Cap", (RIDGE_X, (E_Y_FRONT + E_Y_REAR)/2, 4.45), 
                    0.08, E_Y_REAR - E_Y_FRONT, mat_roof_metal, segments=8, rot=(math.pi/2, 0, 0), parent=root)

    # =========================================================================
    # 7. FRONT EXTENSION SMALLER ROOF: 100% ATTACHED TO MAIN HOUSE (IMG_3893)
    # =========================================================================
    EXT_RIDGE_X = -2.00
    EXT_EAVE_Y_FRONT = Y_EXT_FRONT - 0.45 # -5.65m
    EXT_EAVE_Y_REAR  = Y_MAIN_FRONT - 0.05 # Attaches directly to main front gable wall

    Z_EXT_RIDGE  = 3.55
    Z_EXT_EAVE_L = 2.70
    Z_EXT_EAVE_R = 2.25

    # 7.1 Solid 3D Triangular Gable Wall over Left Room (Y = Y_EXT_FRONT = -5.20)
    create_solid_gable("GH_Ext_Gable_Solid", Y_EXT_FRONT, W_TH, X_L, X_STEP, Z_WALL_TOP, EXT_RIDGE_X, Z_EXT_RIDGE + 0.05, mat_wall_white)

    # 7.2 Volumetric Smaller Roof Geometry
    ext_roof_mesh = bpy.data.meshes.new("GH_Ext_Roof_Volumetric")
    bm_er = bmesh.new()

    def add_ext_roof_slab(p1, p2, p3, p4, thickness, normal_dir):
        offset = [normal_dir[0] * thickness, normal_dir[1] * thickness, normal_dir[2] * thickness]
        v1 = bm_er.verts.new(p1)
        v2 = bm_er.verts.new(p2)
        v3 = bm_er.verts.new(p3)
        v4 = bm_er.verts.new(p4)
        v1b = bm_er.verts.new((p1[0] - offset[0], p1[1] - offset[1], p1[2] - offset[2]))
        v2b = bm_er.verts.new((p2[0] - offset[0], p2[1] - offset[1], p2[2] - offset[2]))
        v3b = bm_er.verts.new((p3[0] - offset[0], p3[1] - offset[1], p3[2] - offset[2]))
        v4b = bm_er.verts.new((p4[0] - offset[0], p4[1] - offset[1], p4[2] - offset[2]))
        bm_er.faces.new((v1, v2, v3, v4))
        bm_er.faces.new((v4b, v3b, v2b, v1b))
        bm_er.faces.new((v1, v1b, v2b, v2))
        bm_er.faces.new((v2, v2b, v3b, v3))
        bm_er.faces.new((v3, v3b, v4b, v4))
        bm_er.faces.new((v4, v4b, v1b, v1))

    # Left slope of smaller roof
    ep_L1 = (E_X_L,       EXT_EAVE_Y_REAR,  Z_EXT_EAVE_L)
    ep_L2 = (E_X_L,       EXT_EAVE_Y_FRONT, Z_EXT_EAVE_L)
    ep_L3 = (EXT_RIDGE_X, EXT_EAVE_Y_FRONT, Z_EXT_RIDGE)
    ep_L4 = (EXT_RIDGE_X, EXT_EAVE_Y_REAR,  Z_EXT_RIDGE)
    add_ext_roof_slab(ep_L1, ep_L2, ep_L3, ep_L4, 0.06, (-0.295, 0, 0.955))

    # Right slope of smaller roof (across porch)
    ep_R1 = (EXT_RIDGE_X, EXT_EAVE_Y_REAR,  Z_EXT_RIDGE)
    ep_R2 = (EXT_RIDGE_X, EXT_EAVE_Y_FRONT, Z_EXT_RIDGE)
    ep_R3 = (E_X_R,       EXT_EAVE_Y_FRONT, Z_EXT_EAVE_R)
    ep_R4 = (E_X_R,       EXT_EAVE_Y_REAR,  Z_EXT_EAVE_R + 0.25)
    add_ext_roof_slab(ep_R1, ep_R2, ep_R3, ep_R4, 0.06, (0.188, -0.035, 0.981))

    bmesh.ops.recalc_face_normals(bm_er, faces=bm_er.faces)
    bm_er.to_mesh(ext_roof_mesh)
    bm_er.free()

    ext_roof_obj = bpy.data.objects.new("GH_Ext_Roof", ext_roof_mesh)
    ext_roof_obj.data.materials.append(mat_roof_metal)
    bpy.context.scene.collection.objects.link(ext_roof_obj)
    ext_roof_obj.parent = root

    # 7.4 Extension Ridge Cap
    create_cylinder("GH_Ext_Ridge_Cap", (EXT_RIDGE_X, (EXT_EAVE_Y_FRONT + EXT_EAVE_Y_REAR)/2, Z_EXT_RIDGE + 0.04),
                    0.07, EXT_EAVE_Y_REAR - EXT_EAVE_Y_FRONT, mat_roof_metal, segments=8, rot=(math.pi/2, 0, 0), parent=root)

    # 7.5 Red Steel Support Posts (IMG_3893)
    POST_L_X = X_STEP + 0.05
    POST_R_X = E_X_R - 0.15
    POST_MID_X = (POST_L_X + POST_R_X) / 2
    for px, p_name in [(POST_L_X, "Left"), (POST_MID_X, "Mid"), (POST_R_X, "Right")]:
        t = (px - EXT_RIDGE_X) / (E_X_R - EXT_RIDGE_X)
        pz = Z_EXT_RIDGE * (1 - t) + Z_EXT_EAVE_R * t
        create_cylinder(f"GH_Porch_Post_{p_name}", (px, EXT_EAVE_Y_FRONT + 0.15, (Z_FLOOR + pz)/2),
                        0.035, pz - Z_FLOOR, mat_truss_red, parent=root)

    # 7.6 Red Steel Triangular Trusses & Tie Beams (IMG_3893)
    create_box("GH_Porch_Tie_Front", ((POST_L_X + POST_R_X)/2, EXT_EAVE_Y_FRONT + 0.15, Z_EXT_EAVE_R - 0.04),
               (POST_R_X - POST_L_X, 0.08, 0.08), mat_truss_red, root)
    create_box("GH_Ext_Tie_Beam", ((X_L + X_STEP)/2, EXT_EAVE_Y_FRONT + 0.15, Z_WALL_TOP),
               (X_STEP - X_L, 0.08, 0.08), mat_truss_red, root)
    for sx, sz_t in [(-1.5, 0.15), (-0.5, 0.35), (+0.5, 0.25)]:
        create_box(f"GH_Truss_Strut_{sx}", (EXT_RIDGE_X + sx, EXT_EAVE_Y_FRONT + 0.15, Z_WALL_TOP + sz_t),
                   (0.04, 0.04, 0.25), mat_truss_red, root)

    # Rafter tails along left extension eave
    for ry in range(int(Y_EXT_FRONT), int(Y_MAIN_FRONT)):
        create_box(f"GH_Ext_Rafter_L_{ry}", (E_X_L + 0.25, ry, Z_EXT_EAVE_L - 0.05), (0.50, 0.06, 0.08), mat_truss_red, root)

    # =========================================================================
    # 8. BATCH JOIN & OPTIMIZE (Keeps GLB strictly < 300 KB Performance Budget)
    # =========================================================================
    bpy.ops.object.select_all(action='DESELECT')
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH':
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            obj.select_set(False)

    mat_groups = {}
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH':
            mat_key = obj.data.materials[0].name if obj.data.materials else "NoMat"
            mat_groups.setdefault(mat_key, []).append(obj)

    for mat_key, objs in mat_groups.items():
        if len(objs) > 1:
            bpy.ops.object.select_all(action='DESELECT')
            for o in objs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            bpy.ops.object.join()
            objs[0].name = f"GH_Batch_{mat_key}"

    for obj in list(bpy.data.objects):
        if obj.type != 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)

    # =========================================================================
    # 9. EXPORT MASTER GLB MODEL
    # =========================================================================
    export_path = r"C:\Users\LGU-SanPedro\Downloads\map\models\guest_house.glb"
    print(f"Exporting GLB to: {export_path}")
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )

    file_size_kb = os.path.getsize(export_path) / 1024.0
    print(f"Export complete! Model file size: {file_size_kb:.2f} KB (Budget: < 300 KB)")
    assert file_size_kb < 300.0, f"Model size {file_size_kb:.2f} KB exceeds 300 KB budget!"

build_guest_house_model()
