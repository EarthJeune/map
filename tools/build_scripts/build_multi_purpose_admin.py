"""
Bespoke 3D Architectural Reconstruction of the Multi-Purpose Administrative Building
Department of Agriculture - Southern Tagalog Integrated Agricultural Research Center (DA-LARES)

GROUND TRUTH FIELD SOURCES & VERIFIED ARCHITECTURE:
- draw.html / buildings.js: Exact 10-vertex footprint with the 2.08m 90° left-flank step.
- IMG_3843: Front-Left RAED FMR Unit 4-panel commercial tinted glass storefront,
  bronze frame, centered sliding doors with vertical white pull handles, and official
  green/white "RAED FMR UNIT" sign plaque mounted inside behind the glass.
- IMG_3844: Front approach view into courtyard opening, steps, covered walkway, continuous roof.
- IMG_3845: Front-Right Veranda, 4-panel commercial sliding glass doors, white vertical pickets.
- IMG_3846: Outer Right Flank (facing Dormitory), corner window, grilled windows, window AC with hood,
  split AC unit on brackets with conduit pipe.
- IMG_3847: Right Flank rear terrace with white railing running straight into the darkness of the breezeway
  towards the black security gate / blockage closing off the breezeway.
- IMG_3855 & IMG_3889: Outer Left Flank, raised planter box, grilled window, window AC with hood.
- IMG_3899: Closer look at the left edge showing the 90° OUTWARD STEP (~2.08m), 90° eave turn & gutter.
- IMG_3900: Stepped rear-left section with 4-step exterior stairs, white pipe handrails, elevated service door,
  grilled window, white soffit, and looking down the rear corridor to that same blockage in the darkness!
- IMG_3901 & IMG_3902: Front entrance steps of RAED FMR Unit leading down to the campus road/driveway,
  flanked by white protective railing.
- IMG_3903: Front-Right Veranda entrance with ONE wide step tiled with grey hexagonal pavers,
  white scrollwork/picket railings, leading to commercial sliding doors.
- IMG_3896 & IMG_3897: Courtyard interior, covered walkway soffit with square black downlights,
  sunken garden bed enclosed by white railing, iconic vertical grey plumbing vent pipe with 180° elbow,
  and continuous watertight compound hip roof with valleys (E_Y_C = -0.40m, zero holes).
- STRICT RULE 4: No outdoor chairs, no detached external terrain slabs, no fake cylinder props.
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

def build_multi_purpose_admin_model():
    # 0. Reset Scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    root = bpy.data.objects.new("MultiPurposeAdmin_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # =========================================================================
    # 1. AUTHENTIC MATERIALS PALETTE
    # =========================================================================
    mat_wall_green    = create_mat("MP_WallGreen", (0.42, 0.58, 0.44), roughness=0.68)      # Sage Green stucco (IMG_3843-3847)
    mat_wall_inner    = create_mat("MP_WallInnerGreen", (0.40, 0.55, 0.42), roughness=0.70)
    mat_plinth_grey   = create_mat("MP_PlinthGrey", (0.35, 0.36, 0.37), roughness=0.75)   # Foundation plinth skirt
    mat_concrete      = create_mat("MP_ConcreteFloor", (0.76, 0.77, 0.75), roughness=0.60)    # Concrete floors/porches/steps
    mat_hex_tile      = create_mat("MP_HexTileGrey", (0.68, 0.70, 0.71), roughness=0.65)      # Hexagonal paver tiles (IMG_3845, 3903)
    mat_fascia        = create_mat("MP_FasciaBrown", (0.24, 0.18, 0.14), roughness=0.55)        # Dark Brown slatted trim
    mat_soffit        = create_mat("MP_SoffitWhite", (0.92, 0.93, 0.92), roughness=0.50)        # White ceiling soffit
    mat_roof          = create_mat("MP_RoofGreen", (0.18, 0.38, 0.24), roughness=0.45, metallic=0.15) # Corrugated green metal
    mat_ridge         = create_mat("MP_RidgeGreen", (0.14, 0.30, 0.19), roughness=0.50)
    mat_bronze_frame  = create_mat("MP_BronzeFrame", (0.16, 0.15, 0.14), roughness=0.35, metallic=0.70) # Dark bronze aluminum
    mat_glass         = create_mat("MP_GlassTint", (0.15, 0.22, 0.20), roughness=0.08, metallic=0.90, alpha=0.55) # Tinted glass
    mat_railing_white = create_mat("MP_RailingWhite", (0.95, 0.96, 0.95), roughness=0.30, metallic=0.25) # White painted steel
    mat_gate_black    = create_mat("MP_GateBlack", (0.12, 0.12, 0.12), roughness=0.40, metallic=0.85)     # Black steel security blockage
    mat_ac_white      = create_mat("MP_ACWhite", (0.92, 0.93, 0.92), roughness=0.35)
    mat_ac_dark       = create_mat("MP_ACDark", (0.22, 0.22, 0.22), roughness=0.50, metallic=0.40)
    mat_pipe_grey     = create_mat("MP_PipeGrey", (0.45, 0.48, 0.47), roughness=0.60, metallic=0.30)        # Plumbing vent pipe
    mat_sign_white    = create_mat("MP_SignWhite", (0.96, 0.97, 0.96), roughness=0.40)
    mat_sign_green    = create_mat("MP_SignGreen", (0.10, 0.40, 0.18), roughness=0.50)

    # Architectural Constants
    Z_BASE = 0.00
    Z_FLOOR = 0.38
    Z_EAVE = 3.10
    Z_RIDGE = 4.55
    WALL_H = Z_EAVE - Z_FLOOR # 2.72m
    WALL_MID_Z = Z_FLOOR + WALL_H / 2
    W_TH = 0.20 # wall thickness

    # =========================================================================
    # 2. EXACT 10-VERTEX GEOMETRY
    # =========================================================================
    # Coordinate system:
    # Front faces -Y (facing road_30 and fmr entrance)
    # Rear faces +Y
    # Left Wing (RAED FMR Unit) is in -X
    # Right Wing (Veranda / Dormitory side) is in +X
    X_L_FRONT = -6.45  # Outer left wall of front FMR section
    X_L_REAR  = -8.30  # Outer left wall of stepped-out rear section (2.08m step!)
    X_L_INNER = +0.62  # Inner left wall along courtyard walkway
    X_R_INNER = +3.52  # Inner right wall along courtyard
    X_R_OUTER = +10.52 # Outer right wall facing Dormitory

    Y_FRONT_L = -6.35  # RAED FMR Front (Longest projection forward)
    Y_FRONT_R = -4.40  # Right Veranda Front (Shorter than Left, Longer than Courtyard)
    Y_COURT   = +0.35  # Courtyard Rear Wall (Shortest / Recessed)
    Y_STEP    = +2.15  # 90° Outward Step line on Left Wing
    Y_REAR    = +8.25  # Rear Wall

    def build_solid_wall_h(name, x1, x2, y, z_bot=Z_FLOOR, z_top=Z_EAVE, mat=mat_wall_green):
        min_x, max_x = min(x1, x2), max(x1, x2)
        length = max_x - min_x
        if length <= 0.001: return
        h = z_top - z_bot
        cz = z_bot + h / 2
        cx = (min_x + max_x) / 2
        if abs(z_bot - Z_FLOOR) < 0.01:
            create_box(f"{name}_Plinth", (cx, y, Z_FLOOR/2), (length, W_TH + 0.04, Z_FLOOR), mat_plinth_grey, root)
        create_box(f"{name}_Wall", (cx, y, cz), (length, W_TH, h), mat, root)

    def build_solid_wall_v(name, x, y1, y2, z_bot=Z_FLOOR, z_top=Z_EAVE, mat=mat_wall_green):
        min_y, max_y = min(y1, y2), max(y1, y2)
        length = max_y - min_y
        if length <= 0.001: return
        h = z_top - z_bot
        cz = z_bot + h / 2
        cy = (min_y + max_y) / 2
        if abs(z_bot - Z_FLOOR) < 0.01:
            create_box(f"{name}_Plinth", (x, cy, Z_FLOOR/2), (W_TH + 0.04, length, Z_FLOOR), mat_plinth_grey, root)
        create_box(f"{name}_Wall", (x, cy, cz), (W_TH, length, h), mat, root)

    # Floor Slabs inside building footprint
    create_box("MP_Floor_LeftFront",   ((X_L_FRONT + X_L_INNER)/2, (Y_FRONT_L + Y_STEP)/2, Z_FLOOR/2), (X_L_INNER - X_L_FRONT, Y_STEP - Y_FRONT_L, Z_FLOOR), mat_concrete, root)
    create_box("MP_Floor_LeftRear",    ((X_L_REAR + X_L_INNER)/2,  (Y_STEP + Y_REAR)/2,    Z_FLOOR/2), (X_L_INNER - X_L_REAR,  Y_REAR - Y_STEP,    Z_FLOOR), mat_concrete, root)
    create_box("MP_Floor_RearConnect", ((X_L_INNER + X_R_INNER)/2, (Y_COURT + Y_REAR)/2,   Z_FLOOR/2), (X_R_INNER - X_L_INNER, Y_REAR - Y_COURT,   Z_FLOOR), mat_concrete, root)
    create_box("MP_Floor_RightWing",   ((X_R_INNER + X_R_OUTER)/2, (Y_FRONT_R + Y_REAR)/2, Z_FLOOR/2), (X_R_OUTER - X_R_INNER, Y_REAR - Y_FRONT_R, Z_FLOOR), mat_concrete, root)

    # =========================================================================
    # 3. FRONT-LEFT FACADE: RAED FMR UNIT COMMERCIAL GLASS STOREFRONT (IMG_3843, 3901)
    # =========================================================================
    FMR_DOOR_X1 = X_L_FRONT + 0.95 # -5.50
    FMR_DOOR_X2 = X_L_INNER - 0.85 # -0.23
    FMR_DOOR_W  = FMR_DOOR_X2 - FMR_DOOR_X1 # 5.27m
    FMR_DOOR_CX = (FMR_DOOR_X1 + FMR_DOOR_X2) / 2
    FMR_DOOR_H  = 2.25
    FMR_DOOR_Z  = Z_FLOOR + FMR_DOOR_H / 2

    # Left solid corner wall
    build_solid_wall_h("MP_FMR_Corner_L", X_L_FRONT, FMR_DOOR_X1, Y_FRONT_L)
    # Right solid corner wall
    build_solid_wall_h("MP_FMR_Corner_R", FMR_DOOR_X2, X_L_INNER, Y_FRONT_L)
    # Header beam above the storefront
    build_solid_wall_h("MP_FMR_Header", FMR_DOOR_X1, FMR_DOOR_X2, Y_FRONT_L, z_bot=Z_FLOOR + FMR_DOOR_H, z_top=Z_EAVE)

    # 3.1 Storefront Bronze Outer Frame & Tinted Commercial Glass Panels
    create_box("MP_FMR_Frame_Outer", (FMR_DOOR_CX, Y_FRONT_L, FMR_DOOR_Z), (FMR_DOOR_W, 0.08, FMR_DOOR_H), mat_bronze_frame, root)
    create_box("MP_FMR_Glass_Panels", (FMR_DOOR_CX, Y_FRONT_L, FMR_DOOR_Z), (FMR_DOOR_W - 0.08, 0.02, FMR_DOOR_H - 0.08), mat_glass, root)

    # 3.2 4-Panel Mullions (Fixed side panels, center sliding doors)
    for m_idx, mx in enumerate([FMR_DOOR_X1 + FMR_DOOR_W*0.25, FMR_DOOR_CX, FMR_DOOR_X1 + FMR_DOOR_W*0.75]):
        create_box(f"MP_FMR_Mullion_{m_idx}", (mx, Y_FRONT_L, FMR_DOOR_Z), (0.05, 0.09, FMR_DOOR_H), mat_bronze_frame, root)
    create_box("MP_FMR_KickRail_Bot", (FMR_DOOR_CX, Y_FRONT_L, Z_FLOOR + 0.08), (FMR_DOOR_W - 0.08, 0.085, 0.14), mat_bronze_frame, root)

    # 3.3 Vertical White/Silver Commercial Door Pull Handles (IMG_3843, IMG_3901)
    create_box("MP_FMR_PullHandle_L", (FMR_DOOR_CX - 0.07, Y_FRONT_L - 0.06, Z_FLOOR + 1.05), (0.025, 0.04, 0.32), mat_railing_white, root)
    create_box("MP_FMR_PullHandle_R", (FMR_DOOR_CX + 0.07, Y_FRONT_L - 0.06, Z_FLOOR + 1.05), (0.025, 0.04, 0.32), mat_railing_white, root)

    # 3.4 Official "RAED FMR UNIT" Sign Plaque (Mounted inside behind glass, IMG_3843)
    create_box("MP_FMR_Sign_Base", (FMR_DOOR_CX, Y_FRONT_L + 0.04, Z_FLOOR + 1.70), (1.10, 0.02, 0.42), mat_sign_white, root)
    create_box("MP_FMR_Sign_Green", (FMR_DOOR_CX, Y_FRONT_L + 0.03, Z_FLOOR + 1.70), (1.02, 0.025, 0.36), mat_sign_green, root)

    # =========================================================================
    # 4. FRONT-LEFT PORCH & 4 STEPS LEADING TO ROAD (IMG_3843, 3901, 3902)
    # =========================================================================
    PORCH_DEPTH = 1.40
    PORCH_Y_FRONT = Y_FRONT_L - PORCH_DEPTH # -7.75
    create_box("MP_FMR_Porch_Landing", ((X_L_FRONT + X_L_INNER)/2, (Y_FRONT_L + PORCH_Y_FRONT)/2, Z_FLOOR/2), (X_L_INNER - X_L_FRONT, PORCH_DEPTH, Z_FLOOR), mat_concrete, root)

    STAIR_X_MIN = X_L_INNER - 1.50 # -0.88
    STAIR_X_MAX = X_L_INNER        # +0.62 (stair width = 1.50m)
    RAIL_W = STAIR_X_MIN - X_L_FRONT # 5.57m

    create_box("MP_FMR_Rail_Front_Top", (X_L_FRONT + RAIL_W/2, PORCH_Y_FRONT + 0.02, Z_FLOOR + 0.85), (RAIL_W, 0.04, 0.04), mat_railing_white, root)
    create_box("MP_FMR_Rail_Front_Bot", (X_L_FRONT + RAIL_W/2, PORCH_Y_FRONT + 0.02, Z_FLOOR + 0.10), (RAIL_W, 0.04, 0.04), mat_railing_white, root)
    for px in [-6.40, -5.30, -4.20, -3.10, -2.00, -0.90]:
        create_cylinder(f"MP_FMR_Picket_{px:.1f}", (px, PORCH_Y_FRONT + 0.02, Z_FLOOR + 0.45), 0.02, 0.82, mat_railing_white, parent=root)
    create_box("MP_FMR_Rail_Left_Top", (X_L_FRONT + 0.02, (Y_FRONT_L + PORCH_Y_FRONT)/2, Z_FLOOR + 0.85), (0.04, PORCH_DEPTH, 0.04), mat_railing_white, root)
    create_box("MP_FMR_Rail_Left_Bot", (X_L_FRONT + 0.02, (Y_FRONT_L + PORCH_Y_FRONT)/2, Z_FLOOR + 0.10), (0.04, PORCH_DEPTH, 0.04), mat_railing_white, root)

    # 4.1 THE 4 CONCRETE STEPS LEADING TO ROAD (IMG_3901, IMG_3902)
    stair_cx = (STAIR_X_MIN + STAIR_X_MAX) / 2
    stair_w  = STAIR_X_MAX - STAIR_X_MIN
    for s_i in range(4):
        step_z = Z_FLOOR * (1.0 - (s_i + 1) * 0.22)
        step_y = PORCH_Y_FRONT - (s_i + 1) * 0.30
        create_box(f"MP_FMR_RoadStep_{s_i+1}", (stair_cx, step_y, step_z / 2), (stair_w, 0.30, step_z), mat_concrete, root)

    # 4.2 Sloped Handrail along the outer side of the 4 steps (IMG_3901, IMG_3902)
    create_box("MP_FMR_StepRail_Slope", (STAIR_X_MAX - 0.02, PORCH_Y_FRONT - 0.65, Z_FLOOR * 0.5 + 0.50), (0.04, 1.35, 0.04), mat_railing_white, root)
    create_cylinder("MP_FMR_StepRail_Post1", (STAIR_X_MAX - 0.02, PORCH_Y_FRONT - 0.05, Z_FLOOR + 0.45), 0.022, 0.85, mat_railing_white, parent=root)
    create_cylinder("MP_FMR_StepRail_Post2", (STAIR_X_MAX - 0.02, PORCH_Y_FRONT - 1.25, 0.45), 0.022, 0.85, mat_railing_white, parent=root)

    # =========================================================================
    # 5. FRONT-RIGHT FACADE: VERANDA & SLIDING DOORS (IMG_3845, 3903)
    # =========================================================================
    VER_DOOR_X1 = X_R_INNER + 1.10 # +4.62
    VER_DOOR_X2 = X_R_OUTER - 1.10 # +9.42
    VER_DOOR_W  = VER_DOOR_X2 - VER_DOOR_X1 # 4.80m
    VER_DOOR_CX = (VER_DOOR_X1 + VER_DOOR_X2) / 2
    VER_DOOR_H  = 2.25
    VER_DOOR_Z  = Z_FLOOR + VER_DOOR_H / 2

    # Left solid corner column
    build_solid_wall_h("MP_Ver_Corner_L", X_R_INNER, VER_DOOR_X1, Y_FRONT_R)
    # Right solid corner column
    build_solid_wall_h("MP_Ver_Corner_R", VER_DOOR_X2, X_R_OUTER, Y_FRONT_R)
    # Header beam above sliding doors
    build_solid_wall_h("MP_Ver_Header", VER_DOOR_X1, VER_DOOR_X2, Y_FRONT_R, z_bot=Z_FLOOR + VER_DOOR_H, z_top=Z_EAVE)

    # 5.1 4-Panel Commercial Sliding Glass Doors (IMG_3845, IMG_3903)
    create_box("MP_Ver_Frame_Outer", (VER_DOOR_CX, Y_FRONT_R, VER_DOOR_Z), (VER_DOOR_W, 0.08, VER_DOOR_H), mat_bronze_frame, root)
    create_box("MP_Ver_Glass_Panels", (VER_DOOR_CX, Y_FRONT_R, VER_DOOR_Z), (VER_DOOR_W - 0.08, 0.02, VER_DOOR_H - 0.08), mat_glass, root)
    for v_idx, vx in enumerate([VER_DOOR_X1 + VER_DOOR_W*0.25, VER_DOOR_CX, VER_DOOR_X1 + VER_DOOR_W*0.75]):
        create_box(f"MP_Ver_Mullion_{v_idx}", (vx, Y_FRONT_R, VER_DOOR_Z), (0.05, 0.09, VER_DOOR_H), mat_bronze_frame, root)

    # 5.2 Raised Veranda Floor Landing (IMG_3845, IMG_3903)
    VER_DEPTH = 1.40
    VER_Y_FRONT = Y_FRONT_R - VER_DEPTH # -5.80
    create_box("MP_Ver_Floor_Landing", ((X_R_INNER + X_R_OUTER)/2, (Y_FRONT_R + VER_Y_FRONT)/2, Z_FLOOR/2), (X_R_OUTER - X_R_INNER, VER_DEPTH, Z_FLOOR), mat_concrete, root)

    # 5.3 White Railing around Veranda Front & Outer Right Flank (IMG_3845, IMG_3903)
    VER_RAIL_X1 = X_R_INNER + 2.60 # +6.12
    VER_RAIL_W  = X_R_OUTER - VER_RAIL_X1 # 4.40m
    create_box("MP_Ver_Rail_Front_Top", (VER_RAIL_X1 + VER_RAIL_W/2, VER_Y_FRONT + 0.02, Z_FLOOR + 0.85), (VER_RAIL_W, 0.04, 0.04), mat_railing_white, root)
    create_box("MP_Ver_Rail_Front_Bot", (VER_RAIL_X1 + VER_RAIL_W/2, VER_Y_FRONT + 0.02, Z_FLOOR + 0.10), (VER_RAIL_W, 0.04, 0.04), mat_railing_white, root)
    for px in [6.2, 7.3, 8.4, 9.5, 10.4]:
        create_cylinder(f"MP_Ver_Picket_{px:.1f}", (px, VER_Y_FRONT + 0.02, Z_FLOOR + 0.45), 0.02, 0.82, mat_railing_white, parent=root)
    create_box("MP_Ver_Rail_Right_Top", (X_R_OUTER - 0.02, (Y_FRONT_R + VER_Y_FRONT)/2, Z_FLOOR + 0.85), (0.04, VER_DEPTH, 0.04), mat_railing_white, root)
    create_box("MP_Ver_Rail_Right_Bot", (X_R_OUTER - 0.02, (Y_FRONT_R + VER_Y_FRONT)/2, Z_FLOOR + 0.10), (0.04, VER_DEPTH, 0.04), mat_railing_white, root)

    # 5.4 THE ONE WIDE HEXAGONAL-PAVER STEP (IMG_3903)
    step_hex_w = 2.50
    step_hex_cx = X_R_INNER + 1.25
    create_box("MP_Ver_Step_HexTile", (step_hex_cx, VER_Y_FRONT - 0.25, 0.20 / 2), (step_hex_w, 0.50, 0.20), mat_hex_tile, root)
    create_box("MP_Ver_Rail_StepSide_Top", (X_R_INNER + 0.05, (Y_FRONT_R + VER_Y_FRONT)/2, Z_FLOOR + 0.85), (0.04, VER_DEPTH, 0.04), mat_railing_white, root)
    create_box("MP_Ver_Rail_StepSide_Bot", (X_R_INNER + 0.05, (Y_FRONT_R + VER_Y_FRONT)/2, Z_FLOOR + 0.10), (0.04, VER_DEPTH, 0.04), mat_railing_white, root)
    create_cylinder("MP_Ver_Rail_StepSide_Post", (X_R_INNER + 0.05, VER_Y_FRONT, Z_FLOOR + 0.45), 0.025, 0.85, mat_railing_white, parent=root)

    # =========================================================================
    # 6. CENTRAL COURTYARD: WALKWAY, VENT PIPE & SUNKEN GARDEN (IMG_3844, 3896, 3897)
    # =========================================================================
    CDOOR_Y1 = -5.50
    CDOOR_Y2 = -0.50
    CDOOR_LEN = CDOOR_Y2 - CDOOR_Y1 # 5.0m
    CDOOR_CY  = (CDOOR_Y1 + CDOOR_Y2) / 2
    build_solid_wall_v("MP_Court_InnerWall_Front", X_L_INNER, Y_FRONT_L, CDOOR_Y1, mat=mat_wall_inner)
    build_solid_wall_v("MP_Court_InnerWall_Rear",  X_L_INNER, CDOOR_Y2, Y_COURT,   mat=mat_wall_inner)
    build_solid_wall_v("MP_Court_InnerWall_Header", X_L_INNER, CDOOR_Y1, CDOOR_Y2, z_bot=Z_FLOOR + 2.25, z_top=Z_EAVE, mat=mat_wall_inner)
    create_box("MP_Court_Door_Frame", (X_L_INNER, CDOOR_CY, Z_FLOOR + 1.125), (0.08, CDOOR_LEN, 2.25), mat_bronze_frame, root)
    create_box("MP_Court_Door_Glass", (X_L_INNER, CDOOR_CY, Z_FLOOR + 1.125), (0.02, CDOOR_LEN - 0.08, 2.15), mat_glass, root)
    for my in [CDOOR_Y1 + CDOOR_LEN*0.25, CDOOR_CY, CDOOR_Y1 + CDOOR_LEN*0.75]:
        create_box(f"MP_Court_Mullion_{my:.2f}", (X_L_INNER, my, Z_FLOOR + 1.125), (0.09, 0.05, 2.25), mat_bronze_frame, root)

    C_WALK_W = 1.30
    create_box("MP_Court_Walkway_Floor", (X_L_INNER + C_WALK_W/2, (Y_FRONT_L + Y_COURT)/2, Z_FLOOR/2), (C_WALK_W, Y_COURT - Y_FRONT_L, Z_FLOOR), mat_concrete, root)

    RAIL_COURT_X = X_L_INNER + C_WALK_W
    create_box("MP_Court_Rail_Top", (RAIL_COURT_X, (Y_FRONT_L + Y_COURT)/2, Z_FLOOR + 0.85), (0.04, Y_COURT - Y_FRONT_L, 0.04), mat_railing_white, root)
    create_box("MP_Court_Rail_Bot", (RAIL_COURT_X, (Y_FRONT_L + Y_COURT)/2, Z_FLOOR + 0.10), (0.04, Y_COURT - Y_FRONT_L, 0.04), mat_railing_white, root)
    for ry in [-5.8, -4.3, -2.8, -1.3]:
        create_cylinder(f"MP_Court_Post_{ry:.1f}", (RAIL_COURT_X, ry, Z_FLOOR + 0.45), 0.022, 0.82, mat_railing_white, parent=root)

    # Plumbing Vent Pipe with 180° Goose-neck Return Elbow (IMG_3896, IMG_3897)
    create_cylinder("MP_Vent_Pipe_Vert", (RAIL_COURT_X + 0.05, -0.60, 1.45), 0.055, 2.90, mat_pipe_grey, segments=12, parent=root)
    create_cylinder("MP_Vent_Pipe_Elbow", (RAIL_COURT_X + 0.05, -0.60, 2.92), 0.070, 0.18, mat_pipe_grey, segments=12, parent=root)
    create_cylinder("MP_Vent_Pipe_Return", (RAIL_COURT_X + 0.05, -0.50, 2.85), 0.050, 0.18, mat_pipe_grey, segments=12, rot=(math.pi/2, 0, 0), parent=root)

    # Courtyard Rear Wall Window (IMG_3896, IMG_3897)
    build_solid_wall_h("MP_Court_RearWall", X_L_INNER, X_R_INNER, Y_COURT, mat=mat_wall_inner)
    create_box("MP_Court_RearWin_Frame", ((X_L_INNER + X_R_INNER)/2, Y_COURT - 0.01, Z_FLOOR + 1.40), (2.20, 0.06, 1.10), mat_bronze_frame, root)
    create_box("MP_Court_RearWin_Glass", ((X_L_INNER + X_R_INNER)/2, Y_COURT - 0.01, Z_FLOOR + 1.40), (2.10, 0.02, 1.00), mat_glass, root)
    create_box("MP_Court_RearWin_Grille", ((X_L_INNER + X_R_INNER)/2, Y_COURT - 0.03, Z_FLOOR + 1.40), (2.10, 0.02, 1.00), mat_railing_white, root)

    build_solid_wall_v("MP_Court_RightInnerWall", X_R_INNER, Y_COURT, Y_FRONT_R, mat=mat_wall_inner)

    # =========================================================================
    # 7. OUTER LEFT FLANK & THE 2.08m 90° OUTWARD STEP (IMG_3855, 3889, 3899)
    # =========================================================================
    # 7.1 Front Section ($X = X_L\_FRONT = -6.45$, $Y$ from $Y\_FRONT\_L = -6.35$ to $Y\_STEP = +2.15$)
    build_solid_wall_v("MP_Left_FrontWall", X_L_FRONT, Y_FRONT_L, Y_STEP)
    create_box("MP_Left_Planter_Bed", (X_L_FRONT - 0.35, -2.10, 0.20), (0.55, 6.40, 0.40), mat_plinth_grey, root)
    create_box("MP_Left_Win1_Frame", (X_L_FRONT, -2.00, Z_FLOOR + 1.40), (0.24, 2.20, 1.20), mat_bronze_frame, root)
    create_box("MP_Left_Win1_Glass", (X_L_FRONT, -2.00, Z_FLOOR + 1.40), (0.20, 2.10, 1.10), mat_glass, root)
    create_box("MP_Left_Win1_Grille", (X_L_FRONT - 0.11, -2.00, Z_FLOOR + 1.40), (0.02, 2.10, 1.10), mat_railing_white, root)
    create_box("MP_Left_AC1_Body", (X_L_FRONT - 0.30, -0.20, Z_FLOOR + 1.60), (0.50, 0.65, 0.45), mat_ac_white, root)
    create_box("MP_Left_AC1_Hood", (X_L_FRONT - 0.33, -0.20, Z_FLOOR + 1.86), (0.60, 0.75, 0.05), mat_ac_white, root)

    # 7.2 THE 2.08m 90° OUTWARD STEP WALL (IMG_3899)
    build_solid_wall_h("MP_Left_90DegStepWall", X_L_REAR, X_L_FRONT, Y_STEP)

    # 7.3 Stepped-out Rear-Left Wall ($X = X_L\_REAR = -8.30$, $Y$ from $Y\_STEP = +2.15$ to $Y\_REAR = +8.25$)
    build_solid_wall_v("MP_Left_RearSteppedWall", X_L_REAR, Y_STEP, Y_REAR)
    create_box("MP_Left_Win2_Frame", (X_L_REAR, +4.50, Z_FLOOR + 1.40), (0.24, 1.80, 1.20), mat_bronze_frame, root)
    create_box("MP_Left_Win2_Glass", (X_L_REAR, +4.50, Z_FLOOR + 1.40), (0.20, 1.70, 1.10), mat_glass, root)
    create_box("MP_Left_Win2_Grille", (X_L_REAR - 0.11, +4.50, Z_FLOOR + 1.40), (0.02, 1.70, 1.10), mat_railing_white, root)
    create_box("MP_Left_AC2_Body", (X_L_REAR - 0.28, +6.30, Z_FLOOR + 1.55), (0.45, 0.60, 0.40), mat_ac_white, root)
    create_box("MP_Left_VentWin_Frame", (X_L_REAR, +7.40, Z_FLOOR + 1.75), (0.24, 0.65, 0.65), mat_bronze_frame, root)
    create_box("MP_Left_VentWin_Grille", (X_L_REAR - 0.11, +7.40, Z_FLOOR + 1.75), (0.02, 0.58, 0.58), mat_railing_white, root)

    # =========================================================================
    # 8. REAR ARCHITECTURE: SERVICE PORCH, CONTINUOUS WALKWAY & BREEZEWAY BLOCKAGE (IMG_3847, 3900)
    # =========================================================================
    # User instructions:
    # "The back looks like image 3847. the railing that go straight to darkness to the blockage in that darkness.
    # in 3900 you can see the blockage at the back to these stairs."

    # 8.1 Continuous Raised Concrete Walkway along Rear from Left Porch to Breezeway Blockage
    REAR_WALK_DEPTH = 1.40
    REAR_WALK_Y2 = Y_REAR + REAR_WALK_DEPTH # +9.65
    create_box("MP_Rear_Walkway_Floor", ((X_L_REAR + X_R_OUTER)/2, (Y_REAR + REAR_WALK_Y2)/2, Z_FLOOR/2), (X_R_OUTER - X_L_REAR, REAR_WALK_DEPTH, Z_FLOOR), mat_concrete, root)

    # 8.2 Rear Main Wall ($Y = Y_REAR = +8.25$)
    build_solid_wall_h("MP_Rear_MainWall", X_L_REAR, X_R_OUTER, Y_REAR)

    # 8.3 Elevated Rear Service Door with Brown Frame & White Aluminum Screen Door (IMG_3900)
    DOOR_REAR_CX = -6.50
    create_box("MP_Rear_ServiceDoor_Frame", (DOOR_REAR_CX, Y_REAR + 0.01, Z_FLOOR + 1.05), (1.05, 0.24, 2.10), mat_fascia, root)
    create_box("MP_Rear_ServiceDoor_Screen", (DOOR_REAR_CX, Y_REAR + 0.12, Z_FLOOR + 1.05), (0.95, 0.02, 1.95), mat_railing_white, root)

    # 8.4 Rear Grilled Window next to service door (IMG_3900)
    create_box("MP_Rear_Win_Frame", (-4.60, Y_REAR, Z_FLOOR + 1.40), (1.40, 0.24, 1.10), mat_bronze_frame, root)
    create_box("MP_Rear_Win_Glass", (-4.60, Y_REAR, Z_FLOOR + 1.40), (1.30, 0.20, 1.00), mat_glass, root)
    create_box("MP_Rear_Win_Grille", (-4.60, Y_REAR + 0.11, Z_FLOOR + 1.40), (1.30, 0.02, 1.00), mat_railing_white, root)

    # 8.5 The 4 Concrete Steps at Rear-Left Porch (IMG_3900)
    # Stepping down from the walkway (Z = 0.38) towards +Y (back yard)
    STAIR_REAR_X1 = -7.50
    STAIR_REAR_X2 = -5.50
    STAIR_REAR_W  = STAIR_REAR_X2 - STAIR_REAR_X1 # 2.00m
    STAIR_REAR_CX = (STAIR_REAR_X1 + STAIR_REAR_X2) / 2
    for s_i in range(4):
        s_z = Z_FLOOR * (1.0 - (s_i + 1) * 0.22)
        s_y = REAR_WALK_Y2 + (s_i + 1) * 0.28
        create_box(f"MP_Rear_Step_{s_i+1}", (STAIR_REAR_CX, s_y, s_z / 2), (STAIR_REAR_W, 0.28, max(0.06, s_z)), mat_concrete, root)

    # Real Sloped Handrails down the 4 steps with vertical posts (IMG_3900)
    # Left sloped rail
    create_box("MP_Rear_StairRail_L_Slope", (STAIR_REAR_X1 + 0.02, REAR_WALK_Y2 + 0.56, Z_FLOOR * 0.5 + 0.45), (0.04, 1.30, 0.04), mat_railing_white, root)
    create_cylinder("MP_Rear_StairPost_L_Bot", (STAIR_REAR_X1 + 0.02, REAR_WALK_Y2 + 1.12, 0.45), 0.022, 0.85, mat_railing_white, parent=root)
    create_cylinder("MP_Rear_StairPost_L_Top", (STAIR_REAR_X1 + 0.02, REAR_WALK_Y2 + 0.05, Z_FLOOR + 0.45), 0.022, 0.85, mat_railing_white, parent=root)
    # Right sloped rail
    create_box("MP_Rear_StairRail_R_Slope", (STAIR_REAR_X2 - 0.02, REAR_WALK_Y2 + 0.56, Z_FLOOR * 0.5 + 0.45), (0.04, 1.30, 0.04), mat_railing_white, root)
    create_cylinder("MP_Rear_StairPost_R_Bot", (STAIR_REAR_X2 - 0.02, REAR_WALK_Y2 + 1.12, 0.45), 0.022, 0.85, mat_railing_white, parent=root)
    create_cylinder("MP_Rear_StairPost_R_Top", (STAIR_REAR_X2 - 0.02, REAR_WALK_Y2 + 0.05, Z_FLOOR + 0.45), 0.022, 0.85, mat_railing_white, parent=root)

    # 8.6 Continuous White Protective Railing along the Rear Walkway into the Breezeway (IMG_3847, IMG_3900)
    # Left porch side rail
    create_box("MP_Rear_Rail_FarLeft_Top", (X_L_REAR + 0.02, (Y_REAR + REAR_WALK_Y2)/2, Z_FLOOR + 0.85), (0.04, REAR_WALK_DEPTH, 0.04), mat_railing_white, root)
    create_box("MP_Rear_Rail_FarLeft_Bot", (X_L_REAR + 0.02, (Y_REAR + REAR_WALK_Y2)/2, Z_FLOOR + 0.10), (0.04, REAR_WALK_DEPTH, 0.04), mat_railing_white, root)
    create_cylinder("MP_Rear_Post_FarLeft", (X_L_REAR + 0.02, REAR_WALK_Y2, Z_FLOOR + 0.45), 0.022, 0.85, mat_railing_white, parent=root)

    # Walkway railing from right side of stairs (X = -5.50) all the way along the rear to the blockage gate (X = X_R_OUTER = +10.52)
    RAIL_REAR_X1 = STAIR_REAR_X2 # -5.50
    RAIL_REAR_X2 = X_R_OUTER     # +10.52
    RAIL_REAR_LEN = RAIL_REAR_X2 - RAIL_REAR_X1 # 16.02m
    RAIL_REAR_CX  = (RAIL_REAR_X1 + RAIL_REAR_X2) / 2
    create_box("MP_Rear_Walkway_Rail_Top", (RAIL_REAR_CX, REAR_WALK_Y2 - 0.02, Z_FLOOR + 0.85), (RAIL_REAR_LEN, 0.04, 0.04), mat_railing_white, root)
    create_box("MP_Rear_Walkway_Rail_Bot", (RAIL_REAR_CX, REAR_WALK_Y2 - 0.02, Z_FLOOR + 0.10), (RAIL_REAR_LEN, 0.04, 0.04), mat_railing_white, root)
    for rx in [-4.0, -1.5, +1.0, +3.5, +6.0, +8.5, +10.4]:
        create_cylinder(f"MP_Rear_Walkway_Post_{rx:.1f}", (rx, REAR_WALK_Y2 - 0.02, Z_FLOOR + 0.45), 0.022, 0.85, mat_railing_white, parent=root)


    # =========================================================================
    # 9. RIGHT FLANK (FACING DORMITORY) (IMG_3846, IMG_3847)
    # =========================================================================
    build_solid_wall_v("MP_Right_OuterWall", X_R_OUTER, Y_FRONT_R, Y_REAR)

    # 9.1 Corner Window next to Veranda (IMG_3846)
    create_box("MP_Right_CornerWin_Frame", (X_R_OUTER, -3.20, Z_FLOOR + 1.40), (0.24, 1.40, 1.20), mat_bronze_frame, root)
    create_box("MP_Right_CornerWin_Glass", (X_R_OUTER, -3.20, Z_FLOOR + 1.40), (0.20, 1.30, 1.10), mat_glass, root)

    # 9.2 Grilled Window (IMG_3846)
    create_box("MP_Right_Win1_Frame", (X_R_OUTER, -1.20, Z_FLOOR + 1.40), (0.24, 1.60, 1.20), mat_bronze_frame, root)
    create_box("MP_Right_Win1_Glass", (X_R_OUTER, -1.20, Z_FLOOR + 1.40), (0.20, 1.50, 1.10), mat_glass, root)
    create_box("MP_Right_Win1_Grille", (X_R_OUTER + 0.11, -1.20, Z_FLOOR + 1.40), (0.02, 1.50, 1.10), mat_railing_white, root)

    # 9.3 Window AC Unit with White Metal Hood (IMG_3846)
    create_box("MP_Right_AC1_Body", (X_R_OUTER + 0.30, +0.60, Z_FLOOR + 1.60), (0.50, 0.65, 0.45), mat_ac_white, root)
    create_box("MP_Right_AC1_Hood", (X_R_OUTER + 0.33, +0.60, Z_FLOOR + 1.86), (0.60, 0.75, 0.05), mat_ac_white, root)

    # 9.4 Split AC Unit on Cantilever Brackets with Conduit Pipe (IMG_3846, IMG_3847)
    create_box("MP_Right_SplitAC_Body", (X_R_OUTER + 0.28, +2.80, Z_FLOOR + 1.70), (0.45, 0.85, 0.60), mat_ac_white, root)
    create_box("MP_Right_SplitAC_Fan",  (X_R_OUTER + 0.51, +2.80, Z_FLOOR + 1.70), (0.02, 0.45, 0.45), mat_ac_dark, root)
    create_box("MP_Right_Bracket_1",    (X_R_OUTER + 0.20, +2.50, Z_FLOOR + 1.25), (0.35, 0.04, 0.30), mat_bronze_frame, root)
    create_box("MP_Right_Bracket_2",    (X_R_OUTER + 0.20, +3.10, Z_FLOOR + 1.25), (0.35, 0.04, 0.30), mat_bronze_frame, root)
    create_cylinder("MP_Right_AC_Pipe", (X_R_OUTER + 0.08, +2.40, Z_FLOOR + 0.90), 0.025, 1.60, mat_pipe_grey, parent=root)

    # 9.5 Long Horizontal Ribbon Window with White Security Grille (IMG_3847)
    create_box("MP_Right_RibbonWin_Frame", (X_R_OUTER, +5.00, Z_FLOOR + 1.55), (0.24, 2.50, 0.65), mat_bronze_frame, root)
    create_box("MP_Right_RibbonWin_Glass", (X_R_OUTER, +5.00, Z_FLOOR + 1.55), (0.20, 2.40, 0.55), mat_glass, root)
    create_box("MP_Right_RibbonWin_Grille", (X_R_OUTER + 0.11, +5.00, Z_FLOOR + 1.55), (0.02, 2.40, 0.55), mat_railing_white, root)

    # 9.6 Raised Terrace with White Railing leading straight to the breezeway blockage (IMG_3847)
    TERRACE_LEN = 3.60
    create_box("MP_Floor_RightTerrace", (X_R_OUTER - 0.70, Y_REAR - TERRACE_LEN/2, Z_FLOOR/2), (1.40, TERRACE_LEN, Z_FLOOR), mat_concrete, root)
    create_box("MP_Terrace_Rail_Top", (X_R_OUTER + 0.02, Y_REAR - TERRACE_LEN/2, Z_FLOOR + 0.85), (0.04, TERRACE_LEN, 0.04), mat_railing_white, root)
    create_box("MP_Terrace_Rail_Bot", (X_R_OUTER + 0.02, Y_REAR - TERRACE_LEN/2, Z_FLOOR + 0.10), (0.04, TERRACE_LEN, 0.04), mat_railing_white, root)

    # =========================================================================
    # 10. AUTHENTIC 100% WATERTIGHT COMPOUND HIP ROOF (SEAMLESS, ZERO HOLES)
    # =========================================================================
    OV = 0.75
    E_Z = Z_EAVE   # 3.10m
    R_Z = Z_RIDGE  # 4.55m

    # Eave Perimeter Coordinates:
    E_X_LF = X_L_FRONT - OV  # -7.20
    E_X_LR = X_L_REAR  - OV  # -9.05
    E_X_LI = X_L_INNER + OV  # +1.37
    E_X_RI = X_R_INNER - OV  # +2.77
    E_X_RO = X_R_OUTER + OV  # +11.27

    E_Y_FL = Y_FRONT_L - OV  # -7.10
    E_Y_FR = Y_FRONT_R - OV  # -5.15
    E_Y_C  = Y_COURT   - OV  # -0.40 (OVERHANG PROJECTS INTO COURTYARD TOWARDS -Y!)
    E_Y_S  = Y_STEP    - OV  # +1.40 (OVERHANG PROJECTS TOWARDS -Y!)
    E_Y_RR = Y_REAR    + OV  # +9.00

    # Ridge Lines:
    R_X_L = (E_X_LF + E_X_LI) / 2  # -2.915m
    R_X_R = (E_X_RI + E_X_RO) / 2  # +7.020m

    R_Y_FL = -3.80   # Left wing front ridge apex
    R_Y_FR = -1.80   # Right wing front ridge apex
    R_Y_RR = +5.80   # Rear transverse ridge line

    roof_mesh = bpy.data.meshes.new("MP_Roof_Mesh")
    bm = bmesh.new()

    # 1. Eave boundary vertices:
    v_e_FL_O = bm.verts.new((E_X_LF, E_Y_FL, E_Z)) # Front-Left Outer
    v_e_FL_I = bm.verts.new((E_X_LI, E_Y_FL, E_Z)) # Front-Left Inner
    v_e_CL   = bm.verts.new((E_X_LI, E_Y_C,  E_Z)) # Courtyard Inner-Left Corner (+1.37, -0.40)
    v_e_CR   = bm.verts.new((E_X_RI, E_Y_C,  E_Z)) # Courtyard Inner-Right Corner (+2.77, -0.40)
    v_e_FR_I = bm.verts.new((E_X_RI, E_Y_FR, E_Z)) # Front-Right Inner
    v_e_FR_O = bm.verts.new((E_X_RO, E_Y_FR, E_Z)) # Front-Right Outer
    v_e_RR_O = bm.verts.new((E_X_RO, E_Y_RR, E_Z)) # Rear-Right Outer
    v_e_RR_R = bm.verts.new((R_X_R,    E_Y_RR, E_Z)) # Rear Hip Apex Right
    v_e_RR_L = bm.verts.new((R_X_L,    E_Y_RR, E_Z)) # Rear Hip Apex Left
    v_e_RL_O = bm.verts.new((E_X_LR, E_Y_RR, E_Z)) # Rear-Left Outer
    v_e_S_O  = bm.verts.new((E_X_LR, E_Y_S,  E_Z)) # Step Outer (-9.05, 1.40)
    v_e_S_I  = bm.verts.new((E_X_LF, E_Y_S,  E_Z)) # Step Inner (-7.20, 1.40)

    # 2. Ridge vertices:
    v_r_FL = bm.verts.new((R_X_L, R_Y_FL, R_Z)) # Left front apex
    v_r_RL = bm.verts.new((R_X_L, R_Y_RR, R_Z)) # Left rear junction
    v_r_FR = bm.verts.new((R_X_R, R_Y_FR, R_Z)) # Right front apex
    v_r_RR = bm.verts.new((R_X_R, R_Y_RR, R_Z)) # Right rear junction

    # Courtyard Valley vertices on the ridges:
    Y_VAL_L = min(R_Y_RR - 0.20, E_Y_C + (E_X_LI - R_X_L)) # +3.885m
    v_r_VL  = bm.verts.new((R_X_L, Y_VAL_L, R_Z))
    Y_VAL_R = min(R_Y_RR - 0.20, E_Y_C + (R_X_R - E_X_RI)) # +3.850m
    v_r_VR  = bm.verts.new((R_X_R, Y_VAL_R, R_Z))

    bm.verts.ensure_lookup_table()

    # 3. Create Continuous Watertight Sloping Faces (Zero gaps, zero holes):
    # Left Wing Front Hip
    bm.faces.new((v_e_FL_O, v_e_FL_I, v_r_FL))
    # Left Wing Inner Front Slope
    bm.faces.new((v_e_FL_I, v_e_CL, v_r_VL, v_r_FL))
    # Left Wing Outer Front Slope (Coplanar with ridge from eave X = -7.20 up to ridge X = -2.915)
    bm.faces.new((v_e_FL_O, v_r_FL, v_r_VL, v_e_S_I))
    bm.faces.new((v_e_S_I, v_r_VL, v_r_RL))

    # Left Wing 90-deg Step Triangular Slope (IMG_3899, Top View.jpg: valley from v_e_S_I to v_r_RL, hip from v_e_S_O to v_r_RL)
    bm.faces.new((v_e_S_I, v_r_RL, v_e_S_O))
    # Left Wing Stepped-out Rear Flank Outer Slope
    bm.faces.new((v_e_S_O, v_r_RL, v_e_RL_O))

    # Courtyard Middle Connecting Roof (SEAMLESS VALLEY GUTTERS, IMG_3844, 3896, 3897)
    bm.faces.new((v_e_CL, v_e_CR, v_r_VR, v_r_VL))
    bm.faces.new((v_r_VL, v_r_VR, v_r_RR, v_r_RL))

    # Right Wing Inner Front Slope
    bm.faces.new((v_e_CR, v_e_FR_I, v_r_FR, v_r_VR))
    # Right Wing Front Hip
    bm.faces.new((v_e_FR_I, v_e_FR_O, v_r_FR))
    # Right Wing Outer Slope
    bm.faces.new((v_e_FR_O, v_e_RR_O, v_r_RR, v_r_FR))

    # Rear Slopes
    bm.faces.new((v_e_RR_O, v_e_RR_R, v_r_RR))
    bm.faces.new((v_e_RR_R, v_e_RR_L, v_r_RL, v_r_RR))
    bm.faces.new((v_e_RR_L, v_e_RL_O, v_r_RL))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(roof_mesh)
    bm.free()

    roof_obj = bpy.data.objects.new("MP_Roof_Compound", roof_mesh)
    roof_obj.data.materials.append(mat_roof)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.parent = root

    # 10.1 3D Dimensional Ridge Caps
    create_cylinder("MP_RidgeCap_Left",  (R_X_L, (R_Y_FL + R_Y_RR)/2, R_Z + 0.04), 0.07, R_Y_RR - R_Y_FL, mat_ridge, segments=8, rot=(math.pi/2, 0, 0), parent=root)
    create_cylinder("MP_RidgeCap_Right", (R_X_R, (R_Y_FR + R_Y_RR)/2, R_Z + 0.04), 0.07, R_Y_RR - R_Y_FR, mat_ridge, segments=8, rot=(math.pi/2, 0, 0), parent=root)
    create_cylinder("MP_RidgeCap_Rear",  ((R_X_L + R_X_R)/2, R_Y_RR, R_Z + 0.04), 0.07, R_X_R - R_X_L, mat_ridge, segments=8, rot=(0, math.pi/2, 0), parent=root)

    # 10.2 Dark Brown Fascia Boards & Continuous Perimeter Gutters
    F_H = 0.22
    def build_fascia_h(name, x1, x2, y):
        min_x, max_x = min(x1, x2), max(x1, x2)
        create_box(name, ((min_x + max_x)/2, y, E_Z - F_H/2), (max_x - min_x, 0.05, F_H), mat_fascia, root)

    def build_fascia_v(name, x, y1, y2):
        min_y, max_y = min(y1, y2), max(y1, y2)
        create_box(name, (x, (min_y + max_y)/2, E_Z - F_H/2), (0.05, max_y - min_y, F_H), mat_fascia, root)

    build_fascia_h("MP_Fascia_FL",     E_X_LF, E_X_LI, E_Y_FL)
    build_fascia_v("MP_Fascia_CL",     E_X_LI, E_Y_FL, E_Y_C)
    build_fascia_h("MP_Fascia_CR",     E_X_LI, E_X_RI, E_Y_C) # Courtyard rear eave at Y = -0.40
    build_fascia_v("MP_Fascia_CiR",    E_X_RI, E_Y_C,  E_Y_FR)
    build_fascia_h("MP_Fascia_FR",     E_X_RI, E_X_RO, E_Y_FR)
    build_fascia_v("MP_Fascia_OR",     E_X_RO, E_Y_FR, E_Y_RR)
    build_fascia_h("MP_Fascia_Rear",   E_X_LR, E_X_RO, E_Y_RR)
    build_fascia_v("MP_Fascia_OLR",    E_X_LR, E_Y_S,  E_Y_RR)
    build_fascia_h("MP_Fascia_Step",   E_X_LR, E_X_LF, E_Y_S) # 90° STEP FASCIA (IMG_3899)
    build_fascia_v("MP_Fascia_OLF",    E_X_LF, E_Y_FL, E_Y_S)

    # 10.3 Solid White Eave Soffits
    def build_soffit_h(name, x1, x2, y_mid, depth):
        min_x, max_x = min(x1, x2), max(x1, x2)
        create_box(name, ((min_x + max_x)/2, y_mid, E_Z - 0.01), (max_x - min_x, depth, 0.02), mat_soffit, root)

    def build_soffit_v(name, x_mid, y1, y2, width):
        min_y, max_y = min(y1, y2), max(y1, y2)
        create_box(name, (x_mid, (min_y + max_y)/2, E_Z - 0.01), (width, max_y - min_y, 0.02), mat_soffit, root)

    build_soffit_h("MP_Soffit_FL",   E_X_LF, E_X_LI, (E_Y_FL + Y_FRONT_L)/2, OV)
    build_soffit_h("MP_Soffit_FR",   E_X_RI, E_X_RO, (E_Y_FR + Y_FRONT_R)/2, OV)
    build_soffit_h("MP_Soffit_Rear", E_X_LR, E_X_RO, (E_Y_RR + Y_REAR)/2,    OV)
    build_soffit_v("MP_Soffit_OLR",  (E_X_LR + X_L_REAR)/2, E_Y_S, Y_REAR,  OV)
    build_soffit_h("MP_Soffit_Step", E_X_LR, X_L_FRONT, (E_Y_S + Y_STEP)/2,  OV)
    build_soffit_v("MP_Soffit_OLF",  (E_X_LF + X_L_FRONT)/2, Y_FRONT_L, E_Y_S, OV)
    build_soffit_v("MP_Soffit_OR",   (E_X_RO + X_R_OUTER)/2, Y_FRONT_R, Y_REAR, OV)
    build_soffit_v("MP_Soffit_CL",   (E_X_LI + X_L_INNER)/2, Y_FRONT_L, E_Y_C, OV)
    build_soffit_h("MP_Soffit_CR",   E_X_LI, E_X_RI, (E_Y_C + Y_COURT)/2, OV)
    build_soffit_v("MP_Soffit_CiR",  (E_X_RI + X_R_INNER)/2, E_Y_C, Y_FRONT_R, OV)

    # Flush square downlights in courtyard walkway ceiling (IMG_3896)
    for dly in [-5.2, -3.6, -2.0, -0.6]:
        create_box(f"MP_Downlight_{dly:.1f}", ((X_L_INNER + E_X_LI)/2, dly, E_Z - 0.03), (0.16, 0.16, 0.03), mat_ac_dark, root)

    # =========================================================================
    # 11. BATCH JOIN & OPTIMIZE (Keeps GLB strictly < 300 KB Performance Budget)
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
            objs[0].name = f"MP_Batch_{mat_key}"

    for obj in list(bpy.data.objects):
        if obj.type != 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)

    # =========================================================================
    # 12. EXPORT MASTER GLB MODEL
    # =========================================================================
    export_path = r"C:\Users\LGU-SanPedro\Downloads\map\models\multi_purpose_administrative_building.glb"
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

build_multi_purpose_admin_model()
