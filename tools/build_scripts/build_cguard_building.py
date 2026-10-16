"""
build_cguard_building.py — Master-Quality Authentic 3D Architectural Model of the
CALABARZON CGUARD Crop Research & Varietal Laboratory (seaguard_building)
Department of Agriculture - Southern Tagalog Integrated Agricultural Research Center (DA-LARES)

Strictly modeled from field photographs:
- IMG_3866.jpg, IMG_3867.jpg, IMG_3868.jpg:
  - 100% airtight, zero-hole contiguous wall geometry along all facades.
  - Entrance door with wooden lower panel, upper glass inspection window, threshold, rubber doormat.
  - Multi-tier wire shoe rack and blue shoe rack outside the door.
  - Large 3-panel glass louver windows with sloped concrete sills and authentic black wrought-iron security grilles.
  - High transom vent window near North pillar.
  - Large framed cork bulletin board with yellow corn research poster sheets.
  - Large official tarpaulin research project billboard:
    "Improvement of Open-Pollinated Yellow and Glutinous Corn Varieties and Development of Yellow Varietal Hybrid in Region IV-A".
  - North-West corner pillar with official "NO PARKING" and "NO MOTORCYCLE PARKING" signs.
  - Freestanding CALABARZON CGUARD signboard with DA logo.
  - Continuous western veranda walkway with raised concrete slab and corrugated canopy awning supported by round steel posts and timber rafters.
  - Watertight corrugated metal gable roof with continuous enclosed ceiling soffit slab and thick ridge capping.
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

def create_cylinder(name, loc, radius, depth, mat, segments=8, rot=(0, 0, 0), parent=None):
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

def build_cguard_building():
    print("====================================================")
    print(" Master Rebuild: CGuard Building (seaguard_building)")
    print("====================================================")
    
    # Clean ALL old mesh/curve objects
    for obj in list(bpy.data.objects):
        if obj.type in ['MESH', 'CURVE', 'EMPTY', 'LIGHT', 'CAMERA']:
            bpy.data.objects.remove(obj, do_unlink=True)
            
    # Materials (curated authentic palette from field photos)
    mat_wall_cream       = create_mat("CG_WallCream", (0.92, 0.89, 0.82), roughness=0.85)
    mat_wall_pilaster    = create_mat("CG_WallPilaster", (0.88, 0.85, 0.78), roughness=0.80)
    mat_plinth_maroon    = create_mat("CG_PlinthMaroon", (0.36, 0.16, 0.14), roughness=0.75) # Maroon foundation skirting
    mat_concrete_walk    = create_mat("CG_WalkConcrete", (0.72, 0.71, 0.68), roughness=0.85)
    mat_sill_concrete    = create_mat("CG_SillConcrete", (0.58, 0.57, 0.55), roughness=0.85)
    mat_fascia_wood      = create_mat("CG_FasciaWood", (0.32, 0.22, 0.16), roughness=0.70)
    mat_roof_metal       = create_mat("CG_RoofMetal", (0.42, 0.32, 0.28), roughness=0.55, metallic=0.35) # Reddish-brown corrugated gable
    mat_roof_ridge       = create_mat("CG_RoofRidge", (0.28, 0.22, 0.20), roughness=0.60, metallic=0.25)
    mat_soffit_white     = create_mat("CG_SoffitWhite", (0.92, 0.92, 0.90), roughness=0.85)
    mat_awning_corrug    = create_mat("CG_AwningMetal", (0.48, 0.50, 0.52), roughness=0.45, metallic=0.40) # Galvanized awning
    mat_steel_post       = create_mat("CG_SteelPost", (0.25, 0.26, 0.28), roughness=0.40, metallic=0.75)
    mat_timber_rafter    = create_mat("CG_TimberRafter", (0.40, 0.26, 0.16), roughness=0.75)
    mat_door_wood        = create_mat("CG_DoorWood", (0.48, 0.28, 0.18), roughness=0.55)
    mat_door_glass       = create_mat("CG_DoorGlass", (0.65, 0.75, 0.82), roughness=0.10, alpha=0.80)
    mat_door_frame       = create_mat("CG_DoorFrame", (0.16, 0.14, 0.12), roughness=0.35, metallic=0.60)
    mat_window_glass     = create_mat("CG_WindowGlass", (0.55, 0.65, 0.72), roughness=0.15, alpha=0.82)
    mat_grille_black     = create_mat("CG_GrilleBlack", (0.10, 0.10, 0.10), roughness=0.50, metallic=0.70) # Iron security bars
    mat_doormat          = create_mat("CG_Doormat", (0.18, 0.18, 0.18), roughness=0.95)
    mat_shoerack_metal   = create_mat("CG_ShoeRackMetal", (0.80, 0.82, 0.85), roughness=0.25, metallic=0.90)
    mat_shoerack_blue    = create_mat("CG_ShoeRackBlue", (0.12, 0.45, 0.80), roughness=0.50)
    mat_cork_board       = create_mat("CG_CorkBoard", (0.65, 0.50, 0.32), roughness=0.90)
    mat_poster_yellow    = create_mat("CG_PosterYellow", (0.95, 0.92, 0.65), roughness=0.40)
    mat_billboard_bg     = create_mat("CG_BillboardBg", (0.96, 0.96, 0.96), roughness=0.35)
    mat_billboard_green  = create_mat("CG_BillboardGreen", (0.08, 0.38, 0.20), roughness=0.45)
    mat_sign_nopark      = create_mat("CG_SignNoPark", (0.95, 0.95, 0.95), roughness=0.35)
    mat_sign_redcircle   = create_mat("CG_SignRedCircle", (0.85, 0.12, 0.10), roughness=0.40)
    mat_cguard_sign_bg   = create_mat("CG_CGuardSignBg", (0.96, 0.96, 0.96), roughness=0.30)
    mat_cguard_sign_logo = create_mat("CG_CGuardSignLogo", (0.10, 0.30, 0.65), roughness=0.35)

    root = bpy.data.objects.new("CGuard_Building_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # -----------------------------------------------------------------
    # Dimensions (Calibrated to newly drawn footprint)
    # Total length (X-axis, North-South): 15.75m -> X in [-7.875, +7.875]
    # Total width (Y-axis, East-West):   10.64m -> Y in [-5.32,  +5.32]
    # Enclosed main building:
    #   X in [-7.875, +7.875] (length 15.75m)
    #   Y in [-3.32,  +5.32]  (width 8.64m)
    # Veranda walkway & canopy awning along West facade:
    #   Y in [-5.32, -3.32]   (depth 2.00m)
    # Heights:
    #   Plinth / Skirt: 0.25m
    #   Eaves Height:   3.25m (distinctly higher than F2C2)
    #   Ridge Apex:     4.85m
    # -----------------------------------------------------------------
    X_LEN = 15.75
    x_half = X_LEN / 2.0  # 7.875m

    Y_MAIN_FRONT = -3.32  # West wall of enclosed building
    Y_MAIN_BACK  =  5.32  # East wall of enclosed building
    Y_AWNING_TIP = -5.32  # Outer western edge of veranda walkway
    
    main_w = Y_MAIN_BACK - Y_MAIN_FRONT # 8.64m
    main_cy = (Y_MAIN_FRONT + Y_MAIN_BACK) / 2.0 # +1.00m
    
    H_SKIRT = 0.25
    H_WALL  = 3.25
    H_RIDGE = 4.85
    WALL_T  = 0.22

    # =================================================================
    # 1. FOUNDATION SLABS & VERANDA WALKWAY
    # =================================================================
    # Main building foundation plinth skirt (maroon band)
    create_box("CG_Foundation_Main", (0.0, main_cy, H_SKIRT / 2.0), (X_LEN, main_w, H_SKIRT), mat_plinth_maroon, root)

    # Floor slab interior
    create_box("CG_Floor_Slab", (0.0, main_cy, H_SKIRT + 0.02), (X_LEN - 0.10, main_w - 0.10, 0.04), mat_plinth_maroon, root)

    # Veranda walkway slab (concrete finish, raised 0.20m above ground)
    walk_w = abs(Y_MAIN_FRONT - Y_AWNING_TIP) # 2.00m
    walk_cy = (Y_MAIN_FRONT + Y_AWNING_TIP) / 2.0 # -4.32m
    create_box("CG_Veranda_Slab", (0.0, walk_cy, 0.20 / 2.0), (X_LEN, walk_w, 0.20), mat_concrete_walk, root)

    # =================================================================
    # 2. WEST FACADE WALL (FRONT) — 100% AIRTIGHT MATHEMATICAL PARTITIONS
    # =================================================================
    # Wall line is at Y = Y_MAIN_FRONT, normal facing -Y (West)
    Y_WEST = Y_MAIN_FRONT + WALL_T / 2.0

    def add_west_seg(name, x1, x2, z1, z2):
        w = abs(x2 - x1)
        h = abs(z2 - z1)
        if w < 1e-4 or h < 1e-4:
            return
        cx = (x1 + x2) / 2.0
        cz = (z1 + z2) / 2.0
        create_box(name, (cx, Y_WEST, cz), (w, WALL_T, h), mat_wall_cream, root)

    # 1. North-West Structural Corner Pillar (terminates building per user request)
    pillar_w = 0.45
    pillar_cx = -x_half + pillar_w / 2.0 # -7.65
    create_box("CG_NorthEnd_Pillar", (pillar_cx, Y_MAIN_FRONT + 0.18, H_WALL / 2.0), 
               (pillar_w, 0.36, H_WALL), mat_wall_pilaster, root)

    # "NO PARKING" & "NO MOTORCYCLE PARKING" signs on North pillar (IMG_3868)
    sign_y = Y_MAIN_FRONT - 0.01
    create_box("CG_Sign_NoPark_Plate", (pillar_cx, sign_y, H_SKIRT + 1.45), (0.28, 0.02, 0.22), mat_sign_nopark, root)
    create_box("CG_Sign_NoPark_Icon",  (pillar_cx, sign_y - 0.005, H_SKIRT + 1.45), (0.16, 0.01, 0.16), mat_sign_redcircle, root)
    create_box("CG_Sign_NoMoto_Plate", (pillar_cx, sign_y, H_SKIRT + 1.10), (0.28, 0.02, 0.22), mat_sign_nopark, root)
    create_box("CG_Sign_NoMoto_Icon",  (pillar_cx, sign_y - 0.005, H_SKIRT + 1.10), (0.16, 0.01, 0.16), mat_sign_redcircle, root)

    # 2. Pier 1 (Pillar to Vent Window): X in [-7.425, -7.10]
    add_west_seg("CG_Wall_W_P1", -7.425, -7.10, H_SKIRT, H_WALL)

    # 3. High Vent Window Opening: X in [-7.10, -6.50] (w = 0.60m)
    #    Sill below: Z in [0.25, 2.10]
    add_west_seg("CG_Wall_W_Vent_Sill", -7.10, -6.50, H_SKIRT, 2.10)
    #    Lintel above: Z in [2.60, 3.25]
    add_west_seg("CG_Wall_W_Vent_Lintel", -7.10, -6.50, 2.60, H_WALL)

    # 4. Pier 2 (Vent Window to Door): X in [-6.50, -6.20]
    add_west_seg("CG_Wall_W_P2", -6.50, -6.20, H_SKIRT, H_WALL)

    # 5. Entrance Doorway Opening: X in [-6.20, -5.15] (w = 1.05m)
    #    Door opening: Z in [0.25, 2.40] (h = 2.15m)
    #    Lintel above Door: Z in [2.40, 3.25]
    add_west_seg("CG_Wall_W_Door_Lintel", -6.20, -5.15, 2.40, H_WALL)

    # 6. Pier 3 (Door to Window 1): X in [-5.15, -4.75]
    add_west_seg("CG_Wall_W_P3", -5.15, -4.75, H_SKIRT, H_WALL)

    # 7. Window 1 Opening (Main Louver Window): X in [-4.75, -2.55] (w = 2.20m)
    #    Sill below: Z in [0.25, 1.05]
    add_west_seg("CG_Wall_W_Win1_Sill", -4.75, -2.55, H_SKIRT, 1.05)
    #    Lintel above: Z in [2.35, 3.25]
    add_west_seg("CG_Wall_W_Win1_Lintel", -4.75, -2.55, 2.35, H_WALL)

    # 8. Pier 4 (Wall behind Cork Bulletin Board): X in [-2.55, -0.60] (w = 1.95m)
    add_west_seg("CG_Wall_W_P4", -2.55, -0.60, H_SKIRT, H_WALL)

    # 9. Intermediate Pilaster 1: X in [-0.60, -0.20] (w = 0.40m)
    add_west_seg("CG_Wall_W_Pilaster1_Base", -0.60, -0.20, H_SKIRT, H_WALL)
    create_box("CG_Pilaster_1_Proj", (-0.40, Y_MAIN_FRONT + 0.06, (H_SKIRT + H_WALL)/2.0),
               (0.40, 0.12, H_WALL - H_SKIRT), mat_wall_pilaster, root)

    # 10. Pier 5 (Wall behind Tarpaulin Billboard): X in [-0.20, +2.80] (w = 3.00m)
    add_west_seg("CG_Wall_W_P5", -0.20, 2.80, H_SKIRT, H_WALL)

    # 11. Intermediate Pilaster 2: X in [+2.80, +3.20] (w = 0.40m)
    add_west_seg("CG_Wall_W_Pilaster2_Base", 2.80, 3.20, H_SKIRT, H_WALL)
    create_box("CG_Pilaster_2_Proj", (3.00, Y_MAIN_FRONT + 0.06, (H_SKIRT + H_WALL)/2.0),
               (0.40, 0.12, H_WALL - H_SKIRT), mat_wall_pilaster, root)

    # 12. Window 2 Opening: X in [+3.20, +5.40] (w = 2.20m)
    #     Sill below: Z in [0.25, 1.05]
    add_west_seg("CG_Wall_W_Win2_Sill", 3.20, 5.40, H_SKIRT, 1.05)
    #     Lintel above: Z in [2.35, 3.25]
    add_west_seg("CG_Wall_W_Win2_Lintel", 3.20, 5.40, 2.35, H_WALL)

    # 13. Pier 6 (Window 2 to South Corner): X in [+5.40, +7.475] (w = 2.075m)
    add_west_seg("CG_Wall_W_P6", 5.40, 7.475, H_SKIRT, H_WALL)

    # 14. South-West End Pilaster: X in [+7.475, +7.875] (w = 0.40m)
    add_west_seg("CG_Wall_W_SouthPilaster_Base", 7.475, 7.875, H_SKIRT, H_WALL)
    create_box("CG_SouthEnd_Pillar", (7.675, Y_MAIN_FRONT + 0.06, (H_SKIRT + H_WALL)/2.0),
               (0.40, 0.12, H_WALL - H_SKIRT), mat_wall_pilaster, root)

    # =================================================================
    # 3. EAST REAR WALL (+Y) — 100% AIRTIGHT PARTITIONS
    # =================================================================
    Y_EAST = Y_MAIN_BACK - WALL_T / 2.0

    def add_east_seg(name, x1, x2, z1, z2):
        w = abs(x2 - x1)
        h = abs(z2 - z1)
        if w < 1e-4 or h < 1e-4:
            return
        cx = (x1 + x2) / 2.0
        cz = (z1 + z2) / 2.0
        create_box(name, (cx, Y_EAST, cz), (w, WALL_T, h), mat_wall_cream, root)

    add_east_seg("CG_Wall_E_P1", -x_half, -4.75, H_SKIRT, H_WALL)
    add_east_seg("CG_Wall_E_Sill1", -4.75, -2.55, H_SKIRT, 1.15)
    add_east_seg("CG_Wall_E_Lintel1", -4.75, -2.55, 2.35, H_WALL)
    add_east_seg("CG_Wall_E_P2", -2.55, -0.20, H_SKIRT, H_WALL)
    add_east_seg("CG_Wall_E_Sill2", -0.20, 2.00, H_SKIRT, 1.15)
    add_east_seg("CG_Wall_E_Lintel2", -0.20, 2.00, 2.35, H_WALL)
    add_east_seg("CG_Wall_E_P3", 2.00, 3.20, H_SKIRT, H_WALL)
    add_east_seg("CG_Wall_E_Sill3", 3.20, 5.40, H_SKIRT, 1.15)
    add_east_seg("CG_Wall_E_Lintel3", 3.20, 5.40, 2.35, H_WALL)
    add_east_seg("CG_Wall_E_P4", 5.40, x_half, H_SKIRT, H_WALL)

    # =================================================================
    # 4. NORTH & SOUTH GABLE END WALLS
    # =================================================================
    # North Gable Wall at X = -x_half (-7.875m)
    create_box("CG_Wall_North_Base", (-x_half + WALL_T/2.0, main_cy, (H_SKIRT + H_WALL)/2.0),
               (WALL_T, main_w, H_WALL - H_SKIRT), mat_wall_cream, root)

    # South Gable Wall at X = +x_half (+7.875m, facing F2C2)
    create_box("CG_Wall_South_Base", ( x_half - WALL_T/2.0, main_cy, (H_SKIRT + H_WALL)/2.0),
               (WALL_T, main_w, H_WALL - H_SKIRT), mat_wall_cream, root)

    # =================================================================
    # 5. ENTRANCE DOOR & SHOE RACKS (IMG_3867)
    # =================================================================
    door_cx = (-6.20 + -5.15) / 2.0 # -5.675
    door_w  = 1.05
    door_h  = 2.15
    door_cz = H_SKIRT + door_h / 2.0 # 1.325
    door_y  = Y_MAIN_FRONT

    # Dark aluminum door frame fitting snugly into the opening
    df_t = 0.05
    create_box("CG_Door_Frame_L", (door_cx - door_w/2.0 + df_t/2.0, door_y + 0.03, door_cz), (df_t, 0.08, door_h), mat_door_frame, root)
    create_box("CG_Door_Frame_R", (door_cx + door_w/2.0 - df_t/2.0, door_y + 0.03, door_cz), (df_t, 0.08, door_h), mat_door_frame, root)
    create_box("CG_Door_Frame_T", (door_cx, door_y + 0.03, H_SKIRT + door_h - df_t/2.0), (door_w, 0.08, df_t), mat_door_frame, root)

    # Door Lower Wood Panel
    d_panel_h = 0.90
    create_box("CG_Door_Panel_Wood", (door_cx, door_y + 0.03, H_SKIRT + d_panel_h / 2.0), (door_w - df_t*2.0, 0.04, d_panel_h), mat_door_wood, root)
    # Mid-rail bar
    create_box("CG_Door_MidRail", (door_cx, door_y + 0.02, H_SKIRT + d_panel_h), (door_w - df_t*2.0, 0.06, 0.06), mat_door_frame, root)
    # Door Upper Glass Inspection Window
    d_glass_h = door_h - d_panel_h - df_t - 0.06
    d_glass_cz = H_SKIRT + d_panel_h + 0.06 + d_glass_h / 2.0
    create_box("CG_Door_Glass", (door_cx, door_y + 0.03, d_glass_cz), (door_w - df_t*2.0, 0.015, d_glass_h), mat_door_glass, root)
    # Research notice placard on door
    create_box("CG_Door_Notice", (door_cx, door_y - 0.01, H_SKIRT + 1.45), (0.24, 0.005, 0.32), mat_billboard_bg, root)

    # Entrance Doormat (Black rubber grid)
    create_box("CG_Doormat", (door_cx, door_y - 0.45, 0.20 + 0.01), (0.90, 0.55, 0.015), mat_doormat, root)

    # Shoe Racks outside door (IMG_3867)
    sr_x = door_cx - 0.80
    create_box("CG_ShoeRack_Wire", (sr_x, door_y - 0.35, 0.20 + 0.95/2.0), (0.35, 0.40, 0.95), mat_shoerack_metal, root)
    create_box("CG_ShoeRack_Blue", (sr_x, door_y - 0.80, 0.20 + 0.65/2.0), (0.35, 0.35, 0.65), mat_shoerack_blue, root)

    # =================================================================
    # 6. AUTHENTIC LOUVER WINDOWS & WROUGHT-IRON SECURITY GRILLES
    # =================================================================
    def create_louver_window_with_grille(name, x1, x2, z1, z2, y_pos=Y_MAIN_FRONT):
        w = abs(x2 - x1)
        h = abs(z2 - z1)
        cx = (x1 + x2) / 2.0
        cz = (z1 + z2) / 2.0

        # Concrete window sill
        create_box(f"{name}_Sill", (cx, y_pos - 0.04, z1 - 0.03), (w + 0.12, 0.28, 0.06), mat_sill_concrete, root)

        # Outer perimeter frame
        f_t, f_d = 0.05, 0.08
        create_box(f"{name}_Frame_L", (x1 + f_t/2.0, y_pos + 0.03, cz), (f_t, f_d, h), mat_door_frame, root)
        create_box(f"{name}_Frame_R", (x2 - f_t/2.0, y_pos + 0.03, cz), (f_t, f_d, h), mat_door_frame, root)
        create_box(f"{name}_Frame_T", (cx, y_pos + 0.03, z2 - f_t/2.0), (w, f_d, f_t), mat_door_frame, root)
        create_box(f"{name}_Frame_B", (cx, y_pos + 0.03, z1 + f_t/2.0), (w, f_d, f_t), mat_door_frame, root)

        # 2 Vertical mullions dividing into 3 equal louver panels (IMG_3867)
        panel_w = (w - f_t * 4.0) / 3.0
        m1_x = x1 + f_t + panel_w + f_t / 2.0
        m2_x = x2 - f_t - panel_w - f_t / 2.0
        create_box(f"{name}_Mullion_1", (m1_x, y_pos + 0.03, cz), (f_t, f_d - 0.01, h - f_t*2.0), mat_door_frame, root)
        create_box(f"{name}_Mullion_2", (m2_x, y_pos + 0.03, cz), (f_t, f_d - 0.01, h - f_t*2.0), mat_door_frame, root)

        # Glass Panes for the 3 panels
        glass_h = h - f_t * 2.0
        create_box(f"{name}_Glass_P1", (x1 + f_t + panel_w/2.0, y_pos + 0.03, cz), (panel_w, 0.015, glass_h), mat_window_glass, root)
        create_box(f"{name}_Glass_P2", (cx, y_pos + 0.03, cz), (panel_w, 0.015, glass_h), mat_window_glass, root)
        create_box(f"{name}_Glass_P3", (x2 - f_t - panel_w/2.0, y_pos + 0.03, cz), (panel_w, 0.015, glass_h), mat_window_glass, root)

        # External Wrought-Iron Security Grille (Grid pattern, IMG_3867)
        g_y = y_pos - 0.06
        # Perimeter iron rim
        create_box(f"{name}_Grille_Rim_T", (cx, g_y, z2 - 0.01), (w + 0.06, 0.02, 0.02), mat_grille_black, root)
        create_box(f"{name}_Grille_Rim_B", (cx, g_y, z1 + 0.01), (w + 0.06, 0.02, 0.02), mat_grille_black, root)
        create_box(f"{name}_Grille_Rim_L", (x1 - 0.02, g_y, cz), (0.02, 0.02, h), mat_grille_black, root)
        create_box(f"{name}_Grille_Rim_R", (x2 + 0.02, g_y, cz), (0.02, 0.02, h), mat_grille_black, root)
        # 5 Horizontal iron bars
        for hi in range(5):
            hz = z1 + (h / 6.0) * (hi + 1)
            create_box(f"{name}_Grille_HBar_{hi}", (cx, g_y, hz), (w, 0.015, 0.015), mat_grille_black, root)
        # 4 Vertical iron bars
        for vi in range(4):
            vx = x1 + (w / 5.0) * (vi + 1)
            create_box(f"{name}_Grille_VBar_{vi}", (vx, g_y, cz), (0.015, 0.015, h), mat_grille_black, root)

    # Window 1 (between door and bulletin board)
    create_louver_window_with_grille("CG_Win_West1", -4.75, -2.55, 1.05, 2.35)

    # Window 2 (South half of facade)
    create_louver_window_with_grille("CG_Win_West2", 3.20, 5.40, 1.05, 2.35)

    # Transom Vent Window near North Pillar (IMG_3868)
    vw_x1, vw_x2 = -7.10, -6.50
    vw_z1, vw_z2 = 2.10, 2.60
    vw_w = vw_x2 - vw_x1
    vw_h = vw_z2 - vw_z1
    vw_cx = (vw_x1 + vw_x2) / 2.0
    vw_cz = (vw_z1 + vw_z2) / 2.0
    create_box("CG_VentWin_Frame", (vw_cx, Y_MAIN_FRONT + 0.03, vw_cz), (vw_w, 0.06, vw_h), mat_door_frame, root)
    create_box("CG_VentWin_Glass", (vw_cx, Y_MAIN_FRONT + 0.03, vw_cz), (vw_w - 0.08, 0.015, vw_h - 0.08), mat_window_glass, root)

    # East Wall Windows (3 matching louver windows)
    def create_louver_window_east(name, x1, x2, z1, z2):
        w = abs(x2 - x1)
        h = abs(z2 - z1)
        cx = (x1 + x2) / 2.0
        cz = (z1 + z2) / 2.0
        create_box(f"{name}_Sill", (cx, Y_MAIN_BACK + 0.04, z1 - 0.03), (w + 0.12, 0.28, 0.06), mat_sill_concrete, root)
        f_t, f_d = 0.05, 0.08
        create_box(f"{name}_Frame", (cx, Y_MAIN_BACK - 0.03, cz), (w, f_d, h), mat_door_frame, root)
        create_box(f"{name}_Glass", (cx, Y_MAIN_BACK - 0.03, cz), (w - f_t*2.0, 0.015, h - f_t*2.0), mat_window_glass, root)

    create_louver_window_east("CG_Win_East1", -4.75, -2.55, 1.15, 2.35)
    create_louver_window_east("CG_Win_East2", -0.20, 2.00, 1.15, 2.35)
    create_louver_window_east("CG_Win_East3", 3.20, 5.40, 1.15, 2.35)

    # =================================================================
    # 7. BULLETIN BOARD & RESEARCH BILLBOARD (IMG_3866, 3867, 3868)
    # =================================================================
    # Large Cork Bulletin Board with Yellow Corn research posters (IMG_3867)
    # Spans X in [-2.45, -0.70] (width 1.75m, height 1.10m, Z in [1.00, 2.10])
    cb_x1, cb_x2 = -2.45, -0.70
    cb_w = cb_x2 - cb_x1 # 1.75m
    cb_h = 1.10
    cb_cx = (cb_x1 + cb_x2) / 2.0 # -1.575
    cb_cz = 1.00 + cb_h / 2.0 # 1.55
    cb_y  = Y_MAIN_FRONT - 0.015

    create_box("CG_Cork_Rim", (cb_cx, cb_y, cb_cz), (cb_w + 0.06, 0.02, cb_h + 0.06), mat_fascia_wood, root)
    create_box("CG_Cork_Surface", (cb_cx, cb_y - 0.005, cb_cz), (cb_w, 0.012, cb_h), mat_cork_board, root)
    # 4 Yellow Research Paper Posters pinned to cork board
    create_box("CG_Poster_1", (cb_cx - 0.40, cb_y - 0.012, cb_cz + 0.24), (0.70, 0.005, 0.42), mat_poster_yellow, root)
    create_box("CG_Poster_2", (cb_cx + 0.40, cb_y - 0.012, cb_cz + 0.24), (0.70, 0.005, 0.42), mat_poster_yellow, root)
    create_box("CG_Poster_3", (cb_cx - 0.40, cb_y - 0.012, cb_cz - 0.24), (0.70, 0.005, 0.42), mat_poster_yellow, root)
    create_box("CG_Poster_4", (cb_cx + 0.40, cb_y - 0.012, cb_cz - 0.24), (0.70, 0.005, 0.42), mat_poster_yellow, root)

    # Large Tarpaulin Project Billboard (IMG_3866 & 3868)
    # Mounted on Pier 5 (X in [-0.10, +2.70], width 2.80m, height 1.35m)
    bb_x1, bb_x2 = -0.10, 2.70
    bb_w = bb_x2 - bb_x1 # 2.80m
    bb_h = 1.35
    bb_cx = (bb_x1 + bb_x2) / 2.0 # 1.30
    bb_cz = 0.95 + bb_h / 2.0 # 1.625
    bb_y  = Y_MAIN_FRONT - 0.015

    create_box("CG_Billboard_Base", (bb_cx, bb_y, bb_cz), (bb_w, 0.015, bb_h), mat_billboard_bg, root)
    create_box("CG_Billboard_Header", (bb_cx, bb_y - 0.006, bb_cz + bb_h/2.0 - 0.18), (bb_w * 0.98, 0.008, 0.32), mat_billboard_green, root)

    # Freestanding CALABARZON CGUARD Laboratory Signboard (IMG_3868)
    fs_x = -7.00
    fs_y = Y_AWNING_TIP - 0.70
    create_box("CG_FS_Sign_Plate", (fs_x, fs_y, 0.65), (1.60, 0.06, 0.85), mat_cguard_sign_bg, root)
    create_box("CG_FS_Sign_Header", (fs_x, fs_y - 0.035, 0.85), (1.50, 0.01, 0.26), mat_cguard_sign_logo, root)
    create_cylinder("CG_FS_Post_L", (fs_x - 0.70, fs_y, 0.45), radius=0.03, depth=0.90, mat=mat_steel_post, parent=root)
    create_cylinder("CG_FS_Post_R", (fs_x + 0.70, fs_y, 0.45), radius=0.03, depth=0.90, mat=mat_steel_post, parent=root)

    # =================================================================
    # 8. VERANDA WALKWAY CANOPY AWNING & POSTS (IMG_3866, 3867, 3868)
    # =================================================================
    aw_y_back  = Y_MAIN_FRONT + 0.08 # Anchored to wall at Y = -3.24
    aw_y_front = Y_AWNING_TIP - 0.20 # Outer eave at Y = -5.52
    aw_z_back  = 2.70 # Slope starts at 2.70m
    aw_z_front = 2.20 # Outer eave height at 2.20m

    # Galvanized Corrugated Metal Awning Mesh
    awning_mesh = bpy.data.meshes.new("CG_Awning_Mesh")
    bm_a = bmesh.new()

    v_aw_bl = bm_a.verts.new((-x_half - 0.20, aw_y_back,  aw_z_back))
    v_aw_br = bm_a.verts.new(( x_half + 0.20, aw_y_back,  aw_z_back))
    v_aw_fr = bm_a.verts.new(( x_half + 0.20, aw_y_front, aw_z_front))
    v_aw_fl = bm_a.verts.new((-x_half - 0.20, aw_y_front, aw_z_front))

    bm_a.faces.new((v_aw_bl, v_aw_br, v_aw_fr, v_aw_fl))
    bmesh.ops.recalc_face_normals(bm_a, faces=bm_a.faces)
    bm_a.to_mesh(awning_mesh)
    bm_a.free()

    awning_obj = bpy.data.objects.new("CG_Awning_Surface", awning_mesh)
    bpy.context.scene.collection.objects.link(awning_obj)
    awning_obj.data.materials.append(mat_awning_corrug)
    awning_obj.parent = root

    # Timber rafters supporting awning underneath (IMG_3867)
    rafter_xs = [-7.0, -5.0, -3.0, -1.0, 1.0, 3.0, 5.0, 7.0]
    r_dy = aw_y_front - aw_y_back
    r_dz = aw_z_front - aw_z_back
    r_len = math.sqrt(r_dy*r_dy + r_dz*r_dz)
    r_rot_x = math.atan2(r_dz, r_dy)

    for idx, rx in enumerate(rafter_xs):
        create_box(f"CG_Awning_Rafter_{idx}", 
                   (rx, (aw_y_back + aw_y_front)/2.0, (aw_z_back + aw_z_front)/2.0 - 0.05), 
                   (0.06, r_len, 0.06), mat_timber_rafter, root, rot=(r_rot_x, 0, 0))

    # Round steel support posts along the outer edge of the walkway
    post_y = Y_AWNING_TIP + 0.15
    post_xs = [-7.0, -4.5, -2.0, 0.5, 3.0, 5.5, 7.5]
    for idx, px in enumerate(post_xs):
        create_cylinder(f"CG_Walk_Post_{idx}", (px, post_y, (0.20 + 2.25)/2.0),
                        radius=0.04, depth=2.05, mat=mat_steel_post, parent=root)

    # =================================================================
    # 9. 100% WATERTIGHT GABLE ROOF & ENCLOSED CEILING SOFFIT
    # =================================================================
    # Solid enclosed ceiling slab over entire main building (Zero holes, zero light leaks)
    create_box("CG_Ceiling_Soffit", (0.0, main_cy, H_WALL + 0.02),
               (X_LEN + 0.10, main_w + 0.10, 0.04), mat_soffit_white, root)

    # Corrugated Gable Roof
    r_x1 = -x_half - 0.45
    r_x2 =  x_half + 0.45
    r_y_ridge = main_cy   # +1.00m
    r_y_west  = Y_MAIN_FRONT - 0.45 # -3.77m
    r_y_east  = Y_MAIN_BACK  + 0.45 # +5.77m
    r_z_ridge = H_RIDGE   # 4.85m
    r_z_eave  = H_WALL    # 3.25m

    roof_mesh = bpy.data.meshes.new("CG_GableRoof_Mesh")
    bm_r = bmesh.new()

    v_r_north = bm_r.verts.new((r_x1, r_y_ridge, r_z_ridge))
    v_r_south = bm_r.verts.new((r_x2, r_y_ridge, r_z_ridge))
    v_w_north = bm_r.verts.new((r_x1, r_y_west, r_z_eave))
    v_w_south = bm_r.verts.new((r_x2, r_y_west, r_z_eave))
    v_e_north = bm_r.verts.new((r_x1, r_y_east, r_z_eave))
    v_e_south = bm_r.verts.new((r_x2, r_y_east, r_z_eave))

    bm_r.faces.new((v_r_north, v_r_south, v_w_south, v_w_north)) # West slope
    bm_r.faces.new((v_r_south, v_r_north, v_e_north, v_e_south)) # East slope

    bmesh.ops.recalc_face_normals(bm_r, faces=bm_r.faces)
    bm_r.to_mesh(roof_mesh)
    bm_r.free()

    roof_obj = bpy.data.objects.new("CG_GableRoof_Surface", roof_mesh)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.data.materials.append(mat_roof_metal)
    roof_obj.parent = root

    # Ridge Cap Ribbon
    create_box("CG_Roof_RidgeCap", (0.0, r_y_ridge, r_z_ridge + 0.03), (r_x2 - r_x1, 0.28, 0.06), mat_roof_ridge, root)

    # Solid Gable Pediment Triangles (North & South)
    def build_gable_pediment(name, gx, sign=1):
        p_mesh = bpy.data.meshes.new(f"{name}_Mesh")
        bm_p = bmesh.new()
        v_top = bm_p.verts.new((gx, r_y_ridge, r_z_ridge))
        v_w   = bm_p.verts.new((gx, Y_MAIN_FRONT, r_z_eave))
        v_e   = bm_p.verts.new((gx, Y_MAIN_BACK,  r_z_eave))
        if sign > 0:
            bm_p.faces.new((v_w, v_e, v_top))
        else:
            bm_p.faces.new((v_e, v_w, v_top))
        bmesh.ops.recalc_face_normals(bm_p, faces=bm_p.faces)
        bm_p.to_mesh(p_mesh)
        bm_p.free()
        p_obj = bpy.data.objects.new(name, p_mesh)
        bpy.context.scene.collection.objects.link(p_obj)
        p_obj.data.materials.append(mat_wall_cream)
        p_obj.parent = root

    build_gable_pediment("CG_Gable_North", -x_half, sign=-1)
    build_gable_pediment("CG_Gable_South",  x_half, sign=1)

    # =================================================================
    # 10. GLB EXPORT & OPTIMIZATION (Consolidate by Material)
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
            objs[0].name = f"CG_{m_name}_Merged"

    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\seaguard_building.glb"
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

build_cguard_building()
