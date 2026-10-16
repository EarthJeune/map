"""
build_corn_casava_building.py — Master-Quality Authentic 3D Architectural Model of the
Corn & Cassava Facility / Regional Corn & Cassava Program Office (corn/casava_building)
Department of Agriculture - Southern Tagalog Integrated Agricultural Research Center (DA-LARES)

Strictly modeled from field photographs:
- IMG_3831.jpg (Front Facade — South View):
  - Left wing: Warm pastel yellow stucco, grey plinth base, rich varnished brown wood door with 4 horizontal recessed panels, brass/silver knob, white sign plate.
  - Left window: Inset reveal, sloped concrete sill, 4 horizontal louver/mullion slats, dark bronze frame, tinted glass.
  - Center: Structural column at porch corner, recessed entrance alcove (~1.1m deep). Tiled porch floor with ceramic tile pattern and threshold step.
  - Commercial glass entrance door in alcove with dark bronze frame, full glass pane, transom, horizontal push bar, official facility signboard above:
    "OFFICE OF THE REGIONAL CORN/CASSAVA PROGRAM".
  - Narrow vertical window and through-wall AC unit beside glass door in alcove.
  - Right wing: Projecting front wall, large 2-panel bronze sliding window with concrete sill.
  - Upper AC unit mounted above window with metal weather hood.
  - Raised concrete planter box in front of right wall with dark soil, broadleaf plants, and flowering shrubbery.
- IMG_3832.jpg (West Flank View — Facing PGRC):
  - Three 2-panel bronze sliding windows with concrete sills.
  - Two through-the-wall AC units with metal hoods.
  - White PVC downspouts with curved elbows from eaves gutter.
  - Dark teal fascia boards and generous eave overhangs.
  - Watertight, hole-free 4-hip corrugated metal roof in dark forest green.
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

def create_box(name, loc, size, mat, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
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

def build_corn_casava_model():
    print("====================================================")
    print(" Master Rebuild: Corn & Cassava Facility (corn/casava_building)")
    print("====================================================")
    
    # Clean ALL old mesh/curve objects
    for obj in list(bpy.data.objects):
        if obj.type in ['MESH', 'CURVE', 'EMPTY', 'LIGHT', 'CAMERA']:
            bpy.data.objects.remove(obj, do_unlink=True)
            
    # Materials (curated authentic palette from ground-truth field photos)
    mat_wall_yellow      = create_mat("CC_WallYellow", (0.95, 0.89, 0.63), roughness=0.82) # Warm pastel yellow stucco
    mat_wall_alcove      = create_mat("CC_WallAlcove", (0.91, 0.85, 0.60), roughness=0.85) # Slightly shaded yellow inside alcove
    mat_plinth_grey      = create_mat("CC_PlinthGrey", (0.28, 0.29, 0.31), roughness=0.75) # Dark grey foundation skirt
    mat_roof_green       = create_mat("CC_RoofGreen", (0.10, 0.29, 0.22), roughness=0.45, metallic=0.30) # Forest green metal roof
    mat_roof_ridge       = create_mat("CC_RoofRidge", (0.07, 0.20, 0.15), roughness=0.55, metallic=0.25)
    mat_fascia_teal      = create_mat("CC_FasciaTeal", (0.09, 0.23, 0.19), roughness=0.60) # Dark teal fascia trim
    mat_gutter_teal      = create_mat("CC_GutterTeal", (0.07, 0.19, 0.15), roughness=0.40, metallic=0.50)
    mat_soffit_white     = create_mat("CC_SoffitWhite", (0.93, 0.93, 0.90), roughness=0.85)
    mat_stoop_tile       = create_mat("CC_StoopTile", (0.78, 0.80, 0.82), roughness=0.30) # Ceramic tiled porch landing
    mat_frame_bronze     = create_mat("CC_FrameBronze", (0.13, 0.12, 0.11), roughness=0.30, metallic=0.80) # Dark bronze/black aluminum
    mat_frame_white      = create_mat("CC_FrameWhite", (0.90, 0.90, 0.88), roughness=0.40) # White aluminum frame
    mat_door_glass       = create_mat("CC_DoorGlass", (0.60, 0.72, 0.80), roughness=0.08, alpha=0.75)
    mat_wood_door        = create_mat("CC_WoodDoor", (0.42, 0.24, 0.12), roughness=0.55) # Natural varnished teak wood
    mat_wood_recess      = create_mat("CC_WoodRecess", (0.32, 0.18, 0.08), roughness=0.65) # Darker grooves in wood door
    mat_door_knob        = create_mat("CC_DoorKnob", (0.85, 0.85, 0.88), roughness=0.25, metallic=0.90) # Silver knob
    mat_window_glass     = create_mat("CC_WindowGlass", (0.50, 0.60, 0.68), roughness=0.10, alpha=0.82)
    mat_sill_concrete    = create_mat("CC_SillConcrete", (0.55, 0.54, 0.52), roughness=0.85) # Grey concrete window sill
    mat_ac_cabinet       = create_mat("CC_ACCabinet", (0.88, 0.88, 0.86), roughness=0.45)
    mat_ac_grille        = create_mat("CC_ACGrille", (0.22, 0.22, 0.24), roughness=0.70)
    mat_planter_concrete = create_mat("CC_PlanterConcrete", (0.62, 0.62, 0.60), roughness=0.85)
    mat_planter_soil     = create_mat("CC_PlanterSoil", (0.18, 0.15, 0.12), roughness=0.95)
    mat_foliage_broad    = create_mat("CC_FoliageBroad", (0.18, 0.44, 0.14), roughness=0.60) # Broadleaf green plants
    mat_foliage_bush     = create_mat("CC_FoliageBush", (0.12, 0.35, 0.10), roughness=0.75)
    mat_flower_white     = create_mat("CC_FlowerWhite", (0.95, 0.95, 0.92), roughness=0.50)
    mat_pvc_pipe         = create_mat("CC_PVCPipe", (0.92, 0.91, 0.88), roughness=0.35)
    mat_sign_bg          = create_mat("CC_SignBg", (0.96, 0.94, 0.88), roughness=0.35)
    mat_sign_red         = create_mat("CC_SignRed", (0.62, 0.12, 0.10), roughness=0.30) # Official red text/border

    root = bpy.data.objects.new("CornCasava_Building_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # -----------------------------------------------------------------
    # Dimensions: Calibrated to ground-truth polygon & field photos
    # Body: 10.60m (East-West, X) x 10.80m (North-South, Y)
    # X in [-5.30, +5.30]
    # Y in [-5.40, +5.40]
    # Front facade along -Y (South). Left flank along -X (West).
    # -----------------------------------------------------------------
    X_TOTAL = 10.60
    Y_TOTAL = 10.80
    x_min, x_max = -X_TOTAL / 2.0, X_TOTAL / 2.0 # -5.30 to +5.30
    y_min, y_max = -Y_TOTAL / 2.0, Y_TOTAL / 2.0 # -5.40 to +5.40

    H_SKIRT = 0.20
    H_WALL  = 3.00 # Wall height to soffit
    WALL_T  = 0.20 # Standard concrete block wall thickness

    # =================================================================
    # 1. FOUNDATION SLAB & SKIRT (100% Watertight Base)
    # =================================================================
    create_box("CC_Foundation_Main", (0.0, 0.0, H_SKIRT / 2.0), 
               (X_TOTAL, Y_TOTAL, H_SKIRT), mat_plinth_grey, root)

    create_box("CC_Floor_Slab", (0.0, 0.0, H_SKIRT + 0.02), 
               (X_TOTAL - 0.10, Y_TOTAL - 0.10, 0.04), mat_plinth_grey, root)

    # =================================================================
    # 2. FRONT FACADE WALLS (SOUTH, -Y) — AIRTIGHT ZERO-HOLE PARTITIONING
    # =================================================================
    Y_FRONT = y_min # -5.40
    Y_ALCOVE = -4.30 # Recessed alcove wall
    
    def add_wall_seg(name, x1, x2, y_cen, z1, z2, thick=WALL_T, mat=mat_wall_yellow):
        w = abs(x2 - x1)
        h = abs(z2 - z1)
        if w < 1e-4 or h < 1e-4:
            return
        cx = (x1 + x2) / 2.0
        cz = (z1 + z2) / 2.0
        create_box(name, (cx, y_cen, cz), (w, thick, h), mat, root)

    # --- Section A: Left Wing (X: -5.30 to -0.60) ---
    add_wall_seg("CC_Wall_S_A1", -5.30, -4.70, Y_FRONT + WALL_T/2.0, H_SKIRT, H_WALL)
    add_wall_seg("CC_Wall_S_Lintel_Door1", -4.70, -3.75, Y_FRONT + WALL_T/2.0, 2.35, H_WALL)
    add_wall_seg("CC_Wall_S_A2", -3.75, -2.90, Y_FRONT + WALL_T/2.0, H_SKIRT, H_WALL)
    add_wall_seg("CC_Wall_S_Sill_Win1", -2.90, -1.40, Y_FRONT + WALL_T/2.0, H_SKIRT, 1.00)
    add_wall_seg("CC_Wall_S_Lintel_Win1", -2.90, -1.40, Y_FRONT + WALL_T/2.0, 2.25, H_WALL)
    add_wall_seg("CC_Wall_S_A3", -1.40, -0.60, Y_FRONT + WALL_T/2.0, H_SKIRT, H_WALL)

    # --- Corner Porch Structural Column ---
    col_w = 0.35
    col_cx = -0.60 + col_w / 2.0 # -0.425
    col_cy = Y_FRONT + col_w / 2.0 # -5.225
    create_box("CC_Porch_Column", (col_cx, col_cy, H_WALL / 2.0), 
               (col_w, col_w, H_WALL), mat_wall_yellow, root)

    # --- Section B: Center Recessed Porch Alcove (Recess depth = 1.10m) ---
    ret_l_len = abs(Y_ALCOVE - (Y_FRONT + col_w))
    ret_l_cy  = ((Y_FRONT + col_w) + Y_ALCOVE) / 2.0
    create_box("CC_Alcove_Return_L", (col_cx, ret_l_cy, (H_SKIRT + H_WALL)/2.0),
               (WALL_T, ret_l_len, H_WALL - H_SKIRT), mat_wall_yellow, root)

    # Recessed North Wall of Alcove (at Y = -4.30)
    add_wall_seg("CC_Wall_Alcove_B1", -0.25, -0.15, Y_ALCOVE + WALL_T/2.0, H_SKIRT, H_WALL, mat=mat_wall_alcove)
    add_wall_seg("CC_Wall_Alcove_Lintel_Door2", -0.15, 0.85, Y_ALCOVE + WALL_T/2.0, 2.36, H_WALL, mat=mat_wall_alcove)
    add_wall_seg("CC_Wall_Alcove_B2", 0.85, 0.95, Y_ALCOVE + WALL_T/2.0, H_SKIRT, H_WALL, mat=mat_wall_alcove)
    add_wall_seg("CC_Wall_Alcove_Sill_WinN", 0.95, 1.55, Y_ALCOVE + WALL_T/2.0, H_SKIRT, 1.00, mat=mat_wall_alcove)
    add_wall_seg("CC_Wall_Alcove_Div_AC", 0.95, 1.55, Y_ALCOVE + WALL_T/2.0, 2.15, 2.25, mat=mat_wall_alcove)
    add_wall_seg("CC_Wall_Alcove_Lintel_AC", 0.95, 1.55, Y_ALCOVE + WALL_T/2.0, 2.70, H_WALL, mat=mat_wall_alcove)
    add_wall_seg("CC_Wall_Alcove_B3", 1.55, 1.60, Y_ALCOVE + WALL_T/2.0, H_SKIRT, H_WALL, mat=mat_wall_alcove)

    # Right Return Wall of Alcove (running North-South from Y = -4.30 to Y = -5.40 at X = +1.60)
    ret_r_len = abs(Y_FRONT - Y_ALCOVE)
    ret_r_cy  = (Y_FRONT + Y_ALCOVE) / 2.0
    create_box("CC_Alcove_Return_R", (1.60 - WALL_T/2.0, ret_r_cy, (H_SKIRT + H_WALL)/2.0),
               (WALL_T, ret_r_len, H_WALL - H_SKIRT), mat_wall_yellow, root)

    # Porch Header Beam
    beam_w = abs(1.60 - (-0.60))
    beam_cx = (-0.60 + 1.60) / 2.0
    create_box("CC_Porch_Header_Beam", (beam_cx, Y_FRONT + WALL_T/2.0, (2.65 + H_WALL)/2.0),
               (beam_w, WALL_T, H_WALL - 2.65), mat_wall_yellow, root)

    # Porch Covered Ceiling
    create_box("CC_Porch_Ceiling", (beam_cx, (Y_FRONT + Y_ALCOVE)/2.0, H_WALL - 0.02),
               (beam_w, abs(Y_FRONT - Y_ALCOVE), 0.04), mat_soffit_white, root)

    # --- Section C: Right Wing (X: +1.60 to +5.30, Y = -5.40) ---
    add_wall_seg("CC_Wall_S_C1", 1.60, 2.30, Y_FRONT + WALL_T/2.0, H_SKIRT, H_WALL)
    add_wall_seg("CC_Wall_S_Sill_Win2", 2.30, 4.30, Y_FRONT + WALL_T/2.0, H_SKIRT, 1.00)
    add_wall_seg("CC_Wall_S_Lintel_Win2", 2.30, 4.30, Y_FRONT + WALL_T/2.0, 2.30, H_WALL)
    add_wall_seg("CC_Wall_S_C2", 4.30, 5.30, Y_FRONT + WALL_T/2.0, H_SKIRT, H_WALL)

    # =================================================================
    # 3. WEST FLANK WALLS (-X, IMG_3832) — AIRTIGHT PARTITIONING
    # =================================================================
    X_WEST = x_min + WALL_T / 2.0 # -5.20
    
    def add_west_seg(name, y1, y2, z1, z2):
        w = abs(y2 - y1)
        h = abs(z2 - z1)
        if w < 1e-4 or h < 1e-4:
            return
        cy = (y1 + y2) / 2.0
        cz = (z1 + z2) / 2.0
        create_box(name, (X_WEST, cy, cz), (WALL_T, w, h), mat_wall_yellow, root)

    add_west_seg("CC_Wall_W_P1", -5.40, -4.00, H_SKIRT, H_WALL)
    add_west_seg("CC_Wall_W_Sill_W1", -4.00, -2.50, H_SKIRT, 1.15)
    add_west_seg("CC_Wall_W_Lintel_W1", -4.00, -2.50, 2.30, H_WALL)
    add_west_seg("CC_Wall_W_P2_a", -2.50, -1.80, H_SKIRT, H_WALL)
    add_west_seg("CC_Wall_W_AC1_Sill", -1.80, -1.15, H_SKIRT, 1.45)
    add_west_seg("CC_Wall_W_AC1_Lintel", -1.80, -1.15, 1.95, H_WALL)
    add_west_seg("CC_Wall_W_P2_b", -1.15, -0.50, H_SKIRT, H_WALL)
    add_west_seg("CC_Wall_W_Sill_W2", -0.50, 1.00, H_SKIRT, 1.15)
    add_west_seg("CC_Wall_W_Lintel_W2", -0.50, 1.00, 2.30, H_WALL)
    add_west_seg("CC_Wall_W_P3_a", 1.00, 1.65, H_SKIRT, H_WALL)
    add_west_seg("CC_Wall_W_AC2_Sill", 1.65, 2.30, H_SKIRT, 1.45)
    add_west_seg("CC_Wall_W_AC2_Lintel", 1.65, 2.30, 1.95, H_WALL)
    add_west_seg("CC_Wall_W_P3_b", 2.30, 2.80, H_SKIRT, H_WALL)
    add_west_seg("CC_Wall_W_Sill_W3", 2.80, 4.20, H_SKIRT, 1.15)
    add_west_seg("CC_Wall_W_Lintel_W3", 2.80, 4.20, 2.30, H_WALL)
    add_west_seg("CC_Wall_W_P4", 4.20, 5.40, H_SKIRT, H_WALL)

    # =================================================================
    # 4. EAST FLANK (+X) & REAR (NORTH, +Y) WALLS — AIRTIGHT
    # =================================================================
    X_EAST = x_max - WALL_T / 2.0
    def add_east_seg(name, y1, y2, z1, z2):
        w = abs(y2 - y1)
        h = abs(z2 - z1)
        if w < 1e-4 or h < 1e-4:
            return
        cy = (y1 + y2) / 2.0
        cz = (z1 + z2) / 2.0
        create_box(name, (X_EAST, cy, cz), (WALL_T, w, h), mat_wall_yellow, root)

    add_east_seg("CC_Wall_E_P1", -5.40, -2.50, H_SKIRT, H_WALL)
    add_east_seg("CC_Wall_E_Sill1", -2.50, -1.00, H_SKIRT, 1.15)
    add_east_seg("CC_Wall_E_Lintel1", -2.50, -1.00, 2.30, H_WALL)
    add_east_seg("CC_Wall_E_P2", -1.00, 1.50, H_SKIRT, H_WALL)
    add_east_seg("CC_Wall_E_Sill2", 1.50, 3.00, H_SKIRT, 1.15)
    add_east_seg("CC_Wall_E_Lintel2", 1.50, 3.00, 2.30, H_WALL)
    add_east_seg("CC_Wall_E_P3", 3.00, 5.40, H_SKIRT, H_WALL)

    Y_REAR = y_max - WALL_T / 2.0
    def add_north_seg(name, x1, x2, z1, z2):
        w = abs(x2 - x1)
        h = abs(z2 - z1)
        if w < 1e-4 or h < 1e-4:
            return
        cx = (x1 + x2) / 2.0
        cz = (z1 + z2) / 2.0
        create_box(name, (cx, Y_REAR, cz), (w, WALL_T, h), mat_wall_yellow, root)

    add_north_seg("CC_Wall_N_P1", -5.30, -3.50, H_SKIRT, H_WALL)
    add_north_seg("CC_Wall_N_Sill1", -3.50, -2.00, H_SKIRT, 1.15)
    add_north_seg("CC_Wall_N_Lintel1", -3.50, -2.00, 2.30, H_WALL)
    add_north_seg("CC_Wall_N_P2", -2.00, 2.00, H_SKIRT, H_WALL)
    add_north_seg("CC_Wall_N_Sill2", 2.00, 3.50, H_SKIRT, 1.15)
    add_north_seg("CC_Wall_N_Lintel2", 2.00, 3.50, 2.30, H_WALL)
    add_north_seg("CC_Wall_N_P3", 3.50, 5.30, H_SKIRT, H_WALL)

    # =================================================================
    # 5. BESPOKE DOORS & ARCHITECTURAL HARDWARE (IMG_3831)
    # =================================================================
    # --- Door 1: Front-Left Natural Varnished Wood Door ---
    d1_cx = (-4.70 + -3.75) / 2.0 # -4.225
    d1_w  = 0.95
    d1_h  = 2.15
    d1_cz = H_SKIRT + d1_h / 2.0
    d1_y  = Y_FRONT

    casing_t = 0.05
    create_box("CC_Door1_Casing_L", (d1_cx - d1_w/2.0 - casing_t/2.0, d1_y - 0.01, d1_cz), (casing_t, 0.04, d1_h + casing_t), mat_soffit_white, root)
    create_box("CC_Door1_Casing_R", (d1_cx + d1_w/2.0 + casing_t/2.0, d1_y - 0.01, d1_cz), (casing_t, 0.04, d1_h + casing_t), mat_soffit_white, root)
    create_box("CC_Door1_Casing_T", (d1_cx, d1_y - 0.01, H_SKIRT + d1_h + casing_t/2.0), (d1_w + casing_t*2.0, 0.04, casing_t), mat_soffit_white, root)

    frame_w = 0.06
    create_box("CC_Door1_Frame_L", (d1_cx - d1_w/2.0 + frame_w/2.0, d1_y + 0.04, d1_cz), (frame_w, 0.08, d1_h), mat_wood_recess, root)
    create_box("CC_Door1_Frame_R", (d1_cx + d1_w/2.0 - frame_w/2.0, d1_y + 0.04, d1_cz), (frame_w, 0.08, d1_h), mat_wood_recess, root)
    create_box("CC_Door1_Frame_T", (d1_cx, d1_y + 0.04, H_SKIRT + d1_h - frame_w/2.0), (d1_w, 0.08, frame_w), mat_wood_recess, root)

    leaf_w = d1_w - frame_w * 2.0
    leaf_h = d1_h - frame_w
    leaf_cz = H_SKIRT + leaf_h / 2.0
    create_box("CC_Door1_Leaf", (d1_cx, d1_y + 0.04, leaf_cz), (leaf_w, 0.05, leaf_h), mat_wood_door, root)

    panel_h = (leaf_h - 0.20) / 4.0
    for pi in range(4):
        p_z = H_SKIRT + 0.10 + panel_h * (pi + 0.5)
        create_box(f"CC_Door1_Panel_{pi}", (d1_cx, d1_y + 0.018, p_z), 
                   (leaf_w - 0.12, 0.015, panel_h - 0.06), mat_wood_recess, root)

    knob_x = d1_cx + leaf_w/2.0 - 0.08
    knob_z = H_SKIRT + 1.00
    create_cylinder("CC_Door1_Knob", (knob_x, d1_y - 0.01, knob_z), radius=0.028, depth=0.04, mat=mat_door_knob, rot=(math.radians(90), 0, 0), parent=root)
    create_box("CC_Door1_Placard", (d1_cx, d1_y + 0.012, H_SKIRT + 1.55), (0.16, 0.005, 0.08), mat_soffit_white, root)

    # --- Door 2: Center Commercial Glass Entrance Door (in Recessed Alcove) ---
    d2_cx = (-0.15 + 0.85) / 2.0 # +0.35
    d2_w  = 1.00
    d2_h  = 2.20
    d2_cz = 0.16 + d2_h / 2.0
    d2_y  = Y_ALCOVE

    stoop_w = 2.40
    stoop_d = 1.60
    stoop_cx = 0.45
    stoop_cy = Y_FRONT - 0.40
    create_box("CC_Porch_Stoop_Main", (stoop_cx, stoop_cy, 0.16 / 2.0), 
               (stoop_w, stoop_d, 0.16), mat_stoop_tile, root)
    create_box("CC_Porch_Stoop_Step", (stoop_cx, stoop_cy - stoop_d/2.0 - 0.15, 0.08 / 2.0), 
               (stoop_w - 0.30, 0.30, 0.08), mat_stoop_tile, root)

    al_t = 0.06
    create_box("CC_Door2_Frame_L", (d2_cx - d2_w/2.0 + al_t/2.0, d2_y + 0.03, d2_cz), (al_t, 0.08, d2_h), mat_frame_bronze, root)
    create_box("CC_Door2_Frame_R", (d2_cx + d2_w/2.0 - al_t/2.0, d2_y + 0.03, d2_cz), (al_t, 0.08, d2_h), mat_frame_bronze, root)
    create_box("CC_Door2_Frame_T", (d2_cx, d2_y + 0.03, 0.16 + d2_h - al_t/2.0), (d2_w, 0.08, al_t), mat_frame_bronze, root)
    create_box("CC_Door2_Frame_B", (d2_cx, d2_y + 0.03, 0.16 + al_t/2.0), (d2_w, 0.08, al_t), mat_frame_bronze, root)
    create_box("CC_Door2_Transom_Rail", (d2_cx, d2_y + 0.03, 1.95), (d2_w - al_t*2.0, 0.06, 0.05), mat_frame_bronze, root)

    g_low_h = (1.95 - 0.025) - (0.16 + al_t)
    g_low_cz = (0.16 + al_t + 1.95 - 0.025) / 2.0
    create_box("CC_Door2_Glass_Main", (d2_cx, d2_y + 0.03, g_low_cz), (d2_w - al_t*2.0, 0.015, g_low_h), mat_door_glass, root)

    g_up_h = (0.16 + d2_h - al_t) - (1.95 + 0.025)
    g_up_cz = (1.95 + 0.025 + 0.16 + d2_h - al_t) / 2.0
    create_box("CC_Door2_Glass_Transom", (d2_cx, d2_y + 0.03, g_up_cz), (d2_w - al_t*2.0, 0.015, g_up_h), mat_door_glass, root)

    create_cylinder("CC_Door2_Handle", (d2_cx, d2_y - 0.02, 1.05), radius=0.018, depth=d2_w - 0.25, mat=mat_frame_bronze, rot=(0, math.radians(90), 0), parent=root)
    create_box("CC_Door2_HBracket_L", (d2_cx - (d2_w - 0.25)/2.0 + 0.04, d2_y + 0.005, 1.05), (0.03, 0.04, 0.03), mat_frame_bronze, root)
    create_box("CC_Door2_HBracket_R", (d2_cx + (d2_w - 0.25)/2.0 - 0.04, d2_y + 0.005, 1.05), (0.03, 0.04, 0.03), mat_frame_bronze, root)

    # Official Facility Signboard
    sign_w = 1.15
    sign_h = 0.24
    sign_cz = 0.16 + d2_h + sign_h/2.0 + 0.08
    create_box("CC_Sign_Rim", (d2_cx, d2_y - 0.01, sign_cz), (sign_w + 0.04, 0.03, sign_h + 0.04), mat_frame_bronze, root)
    create_box("CC_Sign_Backing", (d2_cx, d2_y - 0.02, sign_cz), (sign_w, 0.015, sign_h), mat_sign_bg, root)
    create_box("CC_Sign_RedBorder", (d2_cx, d2_y - 0.028, sign_cz), (sign_w - 0.06, 0.005, sign_h - 0.06), mat_sign_red, root)
    create_box("CC_Sign_TextInner", (d2_cx, d2_y - 0.032, sign_cz), (sign_w - 0.10, 0.005, sign_h - 0.10), mat_sign_bg, root)
    create_box("CC_Sign_TextLines", (d2_cx, d2_y - 0.036, sign_cz), (sign_w - 0.18, 0.005, 0.08), mat_sign_red, root)

    # =================================================================
    # 6. BESPOKE WINDOWS & AC UNITS (IMG_3831 & IMG_3832)
    # =================================================================
    def create_sliding_window_south(name, x1, x2, z1, z2, y_pos=Y_FRONT, has_louvers=False):
        w = abs(x2 - x1)
        h = abs(z2 - z1)
        cx = (x1 + x2) / 2.0
        cz = (z1 + z2) / 2.0

        sill_d = 0.28
        create_box(f"{name}_Sill", (cx, y_pos - 0.04, z1 - 0.03), (w + 0.12, sill_d, 0.06), mat_sill_concrete, root)

        f_t = 0.05
        f_d = 0.08
        create_box(f"{name}_Frame_L", (x1 + f_t/2.0, y_pos + 0.04, cz), (f_t, f_d, h), mat_frame_bronze, root)
        create_box(f"{name}_Frame_R", (x2 - f_t/2.0, y_pos + 0.04, cz), (f_t, f_d, h), mat_frame_bronze, root)
        create_box(f"{name}_Frame_T", (cx, y_pos + 0.04, z2 - f_t/2.0), (w, f_d, f_t), mat_frame_bronze, root)
        create_box(f"{name}_Frame_B", (cx, y_pos + 0.04, z1 + f_t/2.0), (w, f_d, f_t), mat_frame_bronze, root)
        create_box(f"{name}_Mullion_V", (cx, y_pos + 0.04, cz), (f_t, f_d - 0.01, h - f_t*2.0), mat_frame_bronze, root)

        glass_w = (w - f_t * 3.0) / 2.0
        glass_h = h - f_t * 2.0
        g_left_x  = x1 + f_t + glass_w / 2.0
        g_right_x = x2 - f_t - glass_w / 2.0
        create_box(f"{name}_Glass_L", (g_left_x, y_pos + 0.04, cz), (glass_w, 0.015, glass_h), mat_window_glass, root)
        create_box(f"{name}_Glass_R", (g_right_x, y_pos + 0.04, cz), (glass_w, 0.015, glass_h), mat_window_glass, root)

        if has_louvers:
            num_louvers = 4
            for li in range(num_louvers):
                lz = z1 + f_t + (li + 0.5) * (glass_h / num_louvers)
                create_box(f"{name}_Louver_{li}", (cx, y_pos + 0.02, lz), (w - f_t*2.0, 0.025, 0.025), mat_frame_bronze, root)

    create_sliding_window_south("CC_Win_Front1", -2.90, -1.40, 1.00, 2.25, Y_FRONT, has_louvers=True)
    create_sliding_window_south("CC_Win_Front2", 2.30, 4.30, 1.00, 2.30, Y_FRONT, has_louvers=False)

    wn_cx = (0.95 + 1.55) / 2.0
    wn_w  = 0.60
    wn_h  = 1.15
    wn_cz = 1.00 + wn_h / 2.0
    create_box("CC_Win_Alcove_Sill", (wn_cx, Y_ALCOVE - 0.02, 1.00 - 0.02), (wn_w + 0.06, 0.18, 0.04), mat_sill_concrete, root)
    create_box("CC_Win_Alcove_Frame", (wn_cx, Y_ALCOVE + 0.03, wn_cz), (wn_w, 0.06, wn_h), mat_frame_white, root)
    create_box("CC_Win_Alcove_MidRail", (wn_cx, Y_ALCOVE + 0.02, wn_cz), (wn_w - 0.08, 0.05, 0.04), mat_frame_white, root)
    create_box("CC_Win_Alcove_Glass", (wn_cx, Y_ALCOVE + 0.03, wn_cz), (wn_w - 0.08, 0.015, wn_h - 0.08), mat_window_glass, root)

    def create_ac_unit(name, cx, cy, cz, rot_y_axis=False):
        if not rot_y_axis:
            create_box(f"{name}_Cabinet", (cx, cy, cz), (0.58, 0.44, 0.42), mat_ac_cabinet, root)
            create_box(f"{name}_Grille", (cx - 0.08, cy - 0.225, cz), (0.38, 0.02, 0.36), mat_ac_grille, root)
            create_box(f"{name}_Control", (cx + 0.18, cy - 0.225, cz), (0.14, 0.02, 0.36), mat_ac_cabinet, root)
            create_box(f"{name}_Hood", (cx, cy - 0.08, cz + 0.215), (0.64, 0.36, 0.03), mat_frame_bronze, root)
        else:
            create_box(f"{name}_Cabinet", (cx, cy, cz), (0.44, 0.58, 0.42), mat_ac_cabinet, root)
            create_box(f"{name}_Grille", (cx - 0.225, cy - 0.08, cz), (0.02, 0.38, 0.36), mat_ac_grille, root)
            create_box(f"{name}_Control", (cx - 0.225, cy + 0.18, cz), (0.02, 0.14, 0.36), mat_ac_cabinet, root)
            create_box(f"{name}_Hood", (cx - 0.08, cy, cz + 0.215), (0.36, 0.64, 0.03), mat_frame_bronze, root)

    create_ac_unit("CC_AC_Alcove", wn_cx, Y_ALCOVE - 0.10, 2.475, rot_y_axis=False)
    create_ac_unit("CC_AC_FrontRight", 2.70, Y_FRONT - 0.10, 2.575, rot_y_axis=False)

    def create_sliding_window_west(name, y1, y2, z1, z2):
        w = abs(y2 - y1)
        h = abs(z2 - z1)
        cy = (y1 + y2) / 2.0
        cz = (z1 + z2) / 2.0

        create_box(f"{name}_Sill", (x_min - 0.04, cy, z1 - 0.03), (0.28, w + 0.12, 0.06), mat_sill_concrete, root)
        f_t, f_d = 0.05, 0.08
        create_box(f"{name}_Frame_L", (x_min + 0.04, y1 + f_t/2.0, cz), (f_d, f_t, h), mat_frame_bronze, root)
        create_box(f"{name}_Frame_R", (x_min + 0.04, y2 - f_t/2.0, cz), (f_d, f_t, h), mat_frame_bronze, root)
        create_box(f"{name}_Frame_T", (x_min + 0.04, cy, z2 - f_t/2.0), (f_d, w, f_t), mat_frame_bronze, root)
        create_box(f"{name}_Frame_B", (x_min + 0.04, cy, z1 + f_t/2.0), (f_d, w, f_t), mat_frame_bronze, root)
        create_box(f"{name}_Mullion", (x_min + 0.04, cy, cz), (f_d - 0.01, f_t, h - f_t*2.0), mat_frame_bronze, root)
        g_w = (w - f_t * 3.0) / 2.0
        g_h = h - f_t * 2.0
        create_box(f"{name}_Glass_1", (x_min + 0.04, y1 + f_t + g_w/2.0, cz), (0.015, g_w, g_h), mat_window_glass, root)
        create_box(f"{name}_Glass_2", (x_min + 0.04, y2 - f_t - g_w/2.0, cz), (0.015, g_w, g_h), mat_window_glass, root)

    create_sliding_window_west("CC_Win_West1", -4.00, -2.50, 1.15, 2.30)
    create_ac_unit("CC_AC_West1", x_min - 0.10, -1.475, 1.70, rot_y_axis=True)
    create_sliding_window_west("CC_Win_West2", -0.50, 1.00, 1.15, 2.30)
    create_ac_unit("CC_AC_West2", x_min - 0.10, 1.975, 1.70, rot_y_axis=True)
    create_sliding_window_west("CC_Win_West3", 2.80, 4.20, 1.15, 2.30)

    def create_sliding_window_east(name, y1, y2, z1, z2):
        w = abs(y2 - y1)
        h = abs(z2 - z1)
        cy = (y1 + y2) / 2.0
        cz = (z1 + z2) / 2.0
        create_box(f"{name}_Sill", (x_max + 0.04, cy, z1 - 0.03), (0.28, w + 0.12, 0.06), mat_sill_concrete, root)
        f_t, f_d = 0.05, 0.08
        create_box(f"{name}_Frame", (x_max - 0.04, cy, cz), (f_d, w, h), mat_frame_bronze, root)
        create_box(f"{name}_Glass", (x_max - 0.04, cy, cz), (0.015, w - f_t*2.0, h - f_t*2.0), mat_window_glass, root)

    create_sliding_window_east("CC_Win_East1", -2.50, -1.00, 1.15, 2.30)
    create_sliding_window_east("CC_Win_East2", 1.50, 3.00, 1.15, 2.30)

    def create_sliding_window_north(name, x1, x2, z1, z2):
        w = abs(x2 - x1)
        h = abs(z2 - z1)
        cx = (x1 + x2) / 2.0
        cz = (z1 + z2) / 2.0
        create_box(f"{name}_Sill", (cx, y_max + 0.04, z1 - 0.03), (w + 0.12, 0.28, 0.06), mat_sill_concrete, root)
        f_t, f_d = 0.05, 0.08
        create_box(f"{name}_Frame", (cx, y_max - 0.04, cz), (w, f_d, h), mat_frame_bronze, root)
        create_box(f"{name}_Glass", (cx, y_max - 0.04, cz), (w - f_t*2.0, 0.015, h - f_t*2.0), mat_window_glass, root)

    create_sliding_window_north("CC_Win_North1", -3.50, -2.00, 1.15, 2.30)
    create_sliding_window_north("CC_Win_North2", 2.00, 3.50, 1.15, 2.30)

    # =================================================================
    # 7. CONCRETE PLANTER BOX & DETAILED FOLIAGE (IMG_3831)
    # =================================================================
    pb_x1, pb_x2 = 1.80, 4.80
    pb_w = pb_x2 - pb_x1
    pb_d = 0.85
    pb_h = 0.45
    pb_cx = (pb_x1 + pb_x2) / 2.0
    pb_cy = Y_FRONT - pb_d / 2.0
    wall_pt = 0.10

    create_box("CC_Planter_Wall_F", (pb_cx, Y_FRONT - pb_d + wall_pt/2.0, pb_h/2.0), (pb_w, wall_pt, pb_h), mat_planter_concrete, root)
    create_box("CC_Planter_Wall_L", (pb_x1 + wall_pt/2.0, pb_cy, pb_h/2.0), (wall_pt, pb_d, pb_h), mat_planter_concrete, root)
    create_box("CC_Planter_Wall_R", (pb_x2 - wall_pt/2.0, pb_cy, pb_h/2.0), (wall_pt, pb_d, pb_h), mat_planter_concrete, root)
    create_box("CC_Planter_Coping_F", (pb_cx, Y_FRONT - pb_d + wall_pt/2.0, pb_h + 0.015), (pb_w + 0.04, wall_pt + 0.04, 0.03), mat_planter_concrete, root)
    create_box("CC_Planter_Coping_L", (pb_x1 + wall_pt/2.0, pb_cy, pb_h + 0.015), (wall_pt + 0.04, pb_d + 0.04, 0.03), mat_planter_concrete, root)
    create_box("CC_Planter_Coping_R", (pb_x2 - wall_pt/2.0, pb_cy, pb_h + 0.015), (wall_pt + 0.04, pb_d + 0.04, 0.03), mat_planter_concrete, root)

    soil_w = pb_w - wall_pt * 2.0
    soil_d = pb_d - wall_pt
    soil_cy = Y_FRONT - pb_d/2.0 + wall_pt/2.0
    create_box("CC_Planter_Soil", (pb_cx, soil_cy, pb_h - 0.06), (soil_w, soil_d, 0.10), mat_planter_soil, root)

    broad_xs = [2.10, 2.45, 2.80]
    for b_idx, bx in enumerate(broad_xs):
        create_box(f"CC_Plant_Stem_{b_idx}", (bx, soil_cy, pb_h + 0.15), (0.05, 0.05, 0.30), mat_foliage_broad, root)
        for leaf_angle in [-35, 0, 40]:
            create_box(f"CC_Plant_Leaf_{b_idx}_{leaf_angle}", 
                       (bx + math.sin(math.radians(leaf_angle))*0.12, soil_cy + math.cos(math.radians(leaf_angle))*0.10, pb_h + 0.35),
                       (0.24, 0.16, 0.28), mat_foliage_broad, root, rot=(math.radians(20), math.radians(leaf_angle), 0))

    shrub_cx = 3.85
    shrub_cy = soil_cy
    create_box("CC_Shrub_Cluster_1", (shrub_cx - 0.30, shrub_cy, pb_h + 0.28), (0.65, 0.50, 0.45), mat_foliage_bush, root)
    create_box("CC_Shrub_Cluster_2", (shrub_cx + 0.30, shrub_cy, pb_h + 0.32), (0.70, 0.55, 0.50), mat_foliage_bush, root)
    flower_coords = [
        (shrub_cx - 0.20, shrub_cy - 0.15, pb_h + 0.45),
        (shrub_cx + 0.15, shrub_cy - 0.18, pb_h + 0.52),
        (shrub_cx + 0.40, shrub_cy + 0.10, pb_h + 0.48),
        (shrub_cx - 0.45, shrub_cy + 0.08, pb_h + 0.40)
    ]
    for f_idx, fc in enumerate(flower_coords):
        create_box(f"CC_Flower_{f_idx}", fc, (0.08, 0.08, 0.08), mat_flower_white, root)

    # =================================================================
    # 8. PVC DOWNSPOUT PIPES (IMG_3832)
    # =================================================================
    p1_x = x_min - 0.04
    p1_y = -4.70
    create_cylinder("CC_Downspout_W1_Pipe", (p1_x, p1_y, (H_SKIRT + H_WALL)/2.0),
                    radius=0.04, depth=H_WALL - H_SKIRT, mat=mat_pvc_pipe, segments=12, parent=root)
    create_box("CC_Downspout_W1_Hopper", (p1_x - 0.05, p1_y, H_WALL - 0.06), (0.16, 0.12, 0.12), mat_pvc_pipe, root)
    for b_z in [H_SKIRT + 0.80, H_SKIRT + 2.00]:
        create_box(f"CC_Downspout_W1_Clamp_{b_z:.1f}", (p1_x + 0.02, p1_y, b_z), (0.04, 0.10, 0.03), mat_frame_bronze, root)

    p2_y = 3.50
    create_cylinder("CC_Downspout_W2_Pipe", (p1_x, p2_y, (H_SKIRT + H_WALL)/2.0),
                    radius=0.04, depth=H_WALL - H_SKIRT, mat=mat_pvc_pipe, segments=12, parent=root)
    create_box("CC_Downspout_W2_Hopper", (p1_x - 0.05, p2_y, H_WALL - 0.06), (0.16, 0.12, 0.12), mat_pvc_pipe, root)

    # =================================================================
    # 9. 100% WATERTIGHT 4-HIP ROOF & ENCLOSED SOFFIT SYSTEM
    # =================================================================
    EAVE_OVERHANG = 0.70
    rx_half = (X_TOTAL / 2.0) + EAVE_OVERHANG # 6.00m
    ry_half = (Y_TOTAL / 2.0) + EAVE_OVERHANG # 6.10m

    Z_WALL_TOP = H_WALL      # 3.00m
    Z_SOFFIT   = Z_WALL_TOP  # 3.00m
    FASCIA_H   = 0.24        # 24cm vertical fascia board
    Z_EAVE_TOP = Z_SOFFIT + FASCIA_H # 3.24m
    Z_RIDGE    = 4.40        # 4.40m apex ridge height

    # Solid continuous soffit slab (zero holes, zero light leaks)
    create_box("CC_Soffit_Slab", (0.0, 0.0, Z_SOFFIT + 0.02),
               (rx_half * 2.0, ry_half * 2.0, 0.04), mat_soffit_white, root)

    # Fascia boards (dark teal timber fascia around all 4 sides)
    f_thick = 0.05
    create_box("CC_Fascia_Front", (0.0, -ry_half + f_thick/2.0, Z_SOFFIT + FASCIA_H/2.0), 
               (rx_half * 2.0, f_thick, FASCIA_H), mat_fascia_teal, root)
    create_box("CC_Fascia_Rear",  (0.0,  ry_half - f_thick/2.0, Z_SOFFIT + FASCIA_H/2.0), 
               (rx_half * 2.0, f_thick, FASCIA_H), mat_fascia_teal, root)
    create_box("CC_Fascia_Left",  (-rx_half + f_thick/2.0, 0.0, Z_SOFFIT + FASCIA_H/2.0), 
               (f_thick, ry_half * 2.0, FASCIA_H), mat_fascia_teal, root)
    create_box("CC_Fascia_Right", ( rx_half - f_thick/2.0, 0.0, Z_SOFFIT + FASCIA_H/2.0), 
               (f_thick, ry_half * 2.0, FASCIA_H), mat_fascia_teal, root)

    # Eave Gutters
    gut_w = 0.12
    gut_h = 0.10
    create_box("CC_Gutter_Front", (0.0, -ry_half - gut_w/2.0, Z_SOFFIT + gut_h/2.0), (rx_half*2.0 + gut_w*2.0, gut_w, gut_h), mat_gutter_teal, root)
    create_box("CC_Gutter_Rear",  (0.0,  ry_half + gut_w/2.0, Z_SOFFIT + gut_h/2.0), (rx_half*2.0 + gut_w*2.0, gut_w, gut_h), mat_gutter_teal, root)
    create_box("CC_Gutter_Left",  (-rx_half - gut_w/2.0, 0.0, Z_SOFFIT + gut_h/2.0), (gut_w, ry_half*2.0, gut_h), mat_gutter_teal, root)
    create_box("CC_Gutter_Right", ( rx_half + gut_w/2.0, 0.0, Z_SOFFIT + gut_h/2.0), (gut_w, ry_half*2.0, gut_h), mat_gutter_teal, root)

    # 4-Hip Roof Solid Surface Mesh
    ridge_y = 1.20
    roof_mesh = bpy.data.meshes.new("CC_Roof_Surface_Mesh")
    bm = bmesh.new()

    v_fl = bm.verts.new((-rx_half, -ry_half, Z_EAVE_TOP))
    v_fr = bm.verts.new(( rx_half, -ry_half, Z_EAVE_TOP))
    v_rr = bm.verts.new(( rx_half,  ry_half, Z_EAVE_TOP))
    v_rl = bm.verts.new((-rx_half,  ry_half, Z_EAVE_TOP))

    v_rf = bm.verts.new((0.0, -ridge_y, Z_RIDGE))
    v_rb = bm.verts.new((0.0,  ridge_y, Z_RIDGE))

    bm.faces.new((v_fl, v_fr, v_rf))          # South Slope
    bm.faces.new((v_fr, v_rr, v_rb, v_rf))    # East Slope
    bm.faces.new((v_rr, v_rl, v_rb))          # North Slope
    bm.faces.new((v_rl, v_fl, v_rf, v_rb))    # West Slope

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(roof_mesh)
    bm.free()

    roof_obj = bpy.data.objects.new("CC_Roof_Surface", roof_mesh)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.data.materials.append(mat_roof_green)
    roof_obj.parent = root

    # Hip Ridge Capping Tiles
    def create_ridge_cap(name, p1, p2, width=0.28, height=0.08):
        cap_mesh = bpy.data.meshes.new(f"{name}_Mesh")
        bm_c = bmesh.new()
        
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        h_len = math.sqrt(dx*dx + dy*dy)
        if h_len < 1e-4:
            return
        nx = -dy / h_len * (width / 2.0)
        ny =  dx / h_len * (width / 2.0)
        
        v1_l = bm_c.verts.new((p1[0] + nx, p1[1] + ny, p1[2] + 0.01))
        v1_r = bm_c.verts.new((p1[0] - nx, p1[1] - ny, p1[2] + 0.01))
        v1_p = bm_c.verts.new((p1[0],      p1[1],      p1[2] + height))
        
        v2_l = bm_c.verts.new((p2[0] + nx, p2[1] + ny, p2[2] + 0.01))
        v2_r = bm_c.verts.new((p2[0] - nx, p2[1] - ny, p2[2] + 0.01))
        v2_p = bm_c.verts.new((p2[0],      p2[1],      p2[2] + height))
        
        bm_c.faces.new((v1_l, v2_l, v2_p, v1_p))
        bm_c.faces.new((v1_p, v2_p, v2_r, v1_r))
        bm_c.faces.new((v1_l, v1_p, v1_r))
        bm_c.faces.new((v2_l, v2_r, v2_p))
        
        bmesh.ops.recalc_face_normals(bm_c, faces=bm_c.faces)
        bm_c.to_mesh(cap_mesh)
        bm_c.free()
        
        c_obj = bpy.data.objects.new(name, cap_mesh)
        bpy.context.scene.collection.objects.link(c_obj)
        c_obj.data.materials.append(mat_roof_ridge)
        c_obj.parent = root

    create_ridge_cap("CC_Ridge_Center", (0.0, -ridge_y, Z_RIDGE), (0.0, ridge_y, Z_RIDGE), width=0.30, height=0.08)
    create_ridge_cap("CC_Hip_FL", (-rx_half, -ry_half, Z_EAVE_TOP), (0.0, -ridge_y, Z_RIDGE))
    create_ridge_cap("CC_Hip_FR", ( rx_half, -ry_half, Z_EAVE_TOP), (0.0, -ridge_y, Z_RIDGE))
    create_ridge_cap("CC_Hip_RL", (-rx_half,  ry_half, Z_EAVE_TOP), (0.0,  ridge_y, Z_RIDGE))
    create_ridge_cap("CC_Hip_RR", ( rx_half,  ry_half, Z_EAVE_TOP), (0.0,  ridge_y, Z_RIDGE))

    # =================================================================
    # 10. GLB EXPORT & OPTIMIZATION (Merge by Material)
    # =================================================================
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
            objs[0].name = f"CC_{m_name}_Merged"

    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    
    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\corn_casava_building.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"✅ Master Rebuild Exported: {glb_out} ({file_size_kb:.1f} KB)")
    return root

build_corn_casava_model()
