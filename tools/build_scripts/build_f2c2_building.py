"""
build_f2c2_building.py — Authentic Bespoke 3D Architectural Model of the
Farm and Fisheries Clustering and Consolidation (F2C2) Building (f2c2_building)
Department of Agriculture - Southern Tagalog Integrated Agricultural Research Center (DA-LARES)

Modeled strictly from ground-truth field photographs:
1. IMG_3863.jpg (Front Facade):
   - Single-story bungalow with warm cream stucco walls and dark burgundy plinth base skirt.
   - Recessed front entrance porch on the right side supported by a square structural pillar (0.35m x 0.35m).
   - Covered entrance landing stoop with true doorway opening (brown frame, open door, interior floor tile).
   - Wide 3-panel horizontal louver/jalousie window with dark bronze framing on the main left front wall.
   - Cantilevered wall-mounted window AC unit on angle iron bracket stand on the far left.
2. IMG_3862.jpg (Right Flank & Alleyway to LARES):
   - Right wall facing LARES rear pathway.
   - "NO SMOKING OR VAPING" official signage plate near corner.
   - Multiple horizontal louver windows with dark bronze frames and sills.
   - Wall-mounted split-type AC condenser unit with wall brackets.
   - Secondary side access doorway with frame and panel.
3. IMG_3861.jpg (Far View):
   - Classic 4-hip corrugated metal roof sloping up to a longitudinal center ridge.
   - Dark maroon/red-brown timber fascia board along all eaves.
   - Generous ~0.75m eaves overhang around entire perimeter.
4. IMG_3870.jpg (Distance view from LARES back entrance):
   - Confirms spatial alignment and alley distance between LARES back porch and F2C2 right flank.

Strict constraints:
- File size budget <= 300 KB
- Strictly zero external turf slabs, outside trees, road slabs, or curbs
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

def create_box(name, loc, size, mat, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
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

def build_f2c2_building():
    print("====================================================")
    print(" Building Authentic 3D Model: F2C2 Building (Retained Past Scale)")
    print("====================================================")
    
    # Clean ALL old mesh/curve objects
    for obj in list(bpy.data.objects):
        if obj.type in ['MESH', 'CURVE', 'EMPTY', 'LIGHT', 'CAMERA']:
            bpy.data.objects.remove(obj, do_unlink=True)
            
    # Materials (curated authentic palette from field photos)
    mat_wall_cream      = create_mat("F2C2_WallCream", (0.93, 0.90, 0.83), roughness=0.85)
    mat_plinth_maroon   = create_mat("F2C2_PlinthMaroon", (0.34, 0.16, 0.15), roughness=0.75)
    mat_fascia_maroon   = create_mat("F2C2_FasciaMaroon", (0.42, 0.16, 0.15), roughness=0.65)
    mat_roof_metal      = create_mat("F2C2_RoofMetal", (0.36, 0.40, 0.46), roughness=0.50, metallic=0.30)
    mat_roof_ridge      = create_mat("F2C2_RoofRidge", (0.24, 0.27, 0.32), roughness=0.60, metallic=0.20)
    mat_soffit          = create_mat("F2C2_Soffit", (0.90, 0.88, 0.84), roughness=0.90)
    mat_concrete_stoop  = create_mat("F2C2_StoopConcrete", (0.70, 0.69, 0.66), roughness=0.80)
    mat_interior_wall   = create_mat("F2C2_InteriorWall", (0.92, 0.90, 0.86), roughness=0.85)
    mat_interior_tile   = create_mat("F2C2_InteriorTile", (0.86, 0.85, 0.82), roughness=0.35)
    mat_frame_bronze    = create_mat("F2C2_FrameBronze", (0.12, 0.11, 0.10), roughness=0.35, metallic=0.70)
    mat_glass_louver    = create_mat("F2C2_GlassLouver", (0.78, 0.85, 0.89), roughness=0.15, alpha=0.85)
    mat_glass_slat      = create_mat("F2C2_GlassSlat", (0.68, 0.76, 0.82), roughness=0.25, metallic=0.40)
    mat_door_wood       = create_mat("F2C2_DoorWood", (0.44, 0.25, 0.16), roughness=0.60)
    mat_door_handle     = create_mat("F2C2_DoorHandle", (0.88, 0.88, 0.88), roughness=0.20, metallic=0.90)
    mat_ac_metal        = create_mat("F2C2_ACMetal", (0.88, 0.88, 0.86), roughness=0.50)
    mat_bracket_dark    = create_mat("F2C2_BracketDark", (0.18, 0.18, 0.18), roughness=0.70, metallic=0.40)
    mat_sign_plate      = create_mat("F2C2_SignPlate", (0.96, 0.96, 0.96), roughness=0.40)
    mat_sign_symbol     = create_mat("F2C2_SignSymbol", (0.82, 0.15, 0.12), roughness=0.40)
    mat_mat_carpet      = create_mat("F2C2_Doormat", (0.26, 0.22, 0.18), roughness=0.90)
    mat_porch_lamp      = create_mat("F2C2_PorchLamp", (1.0, 0.96, 0.88), roughness=0.20, emission_color=(1.0, 0.96, 0.88, 1.0), emission_strength=4.0)

    # Root Empty
    root = bpy.data.objects.new("F2C2_Building_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # -----------------------------------------------------------------
    # Dimensions (Calibrated to newly drawn footprint)
    # Width (X-axis, front facade): 6.76m -> X in [-3.38, +3.38]
    # Length (Y-axis, flanks):     13.16m -> Y in [-6.58, +6.58]
    # Height to eaves:              2.85m
    # Plinth skirt height:          0.25m
    # Recessed porch:
    #   Front X range: [+0.95, +3.38] (width ~2.43m)
    #   Recess depth in Y: from front Y (-6.58) to recessed wall Y (-4.73), depth = 1.85m
    # -----------------------------------------------------------------
    x_half = 6.76 / 2.0   # 3.38
    y_half = 13.16 / 2.0  # 6.58
    H_WALL = 2.85
    H_SKIRT = 0.25
    WALL_THICK = 0.20
    PORCH_X_SPLIT = 0.95   # Left wall ends here, recessed porch starts
    PORCH_Y_BACK = -y_half + 1.85  # Recessed back wall of the porch (-4.73)

    # -----------------------------------------------------------------
    # 1. Foundation Slab & Raised Entry Stoop
    # -----------------------------------------------------------------
    # Main building foundation plinth skirt (dark burgundy)
    create_box("F2C2_Foundation", (0.0, 0.0, H_SKIRT / 2.0), (x_half * 2.0, y_half * 2.0, H_SKIRT), mat_plinth_maroon, root)
    
    # Recessed porch concrete floor (raised 0.04m above skirt level)
    porch_w = x_half - PORCH_X_SPLIT
    porch_d = abs(PORCH_Y_BACK - (-y_half))
    porch_cx = (PORCH_X_SPLIT + x_half) / 2.0
    porch_cy = (-y_half + PORCH_Y_BACK) / 2.0
    create_box("F2C2_Porch_Floor", (porch_cx, porch_cy, H_SKIRT + 0.02), (porch_w - 0.04, porch_d - 0.04, 0.04), mat_concrete_stoop, root)
    
    # Entrance step in front of porch (IMG_3863)
    create_box("F2C2_Porch_Step", (porch_cx, -y_half - 0.12, H_SKIRT / 2.0), (porch_w - 0.40, 0.24, H_SKIRT), mat_concrete_stoop, root)

    # Entry doormat in front of the door (IMG_3863)
    create_box("F2C2_Doormat", (porch_cx + 0.20, PORCH_Y_BACK + 0.50, H_SKIRT + 0.045), (0.75, 0.50, 0.015), mat_mat_carpet, root)

    # -----------------------------------------------------------------
    # 2. Authentic Walls with Cutouts for Door & Windows
    # -----------------------------------------------------------------
    # A. Front-Left Wall (spans X in [-x_half, PORCH_X_SPLIT], at Y = -y_half + WALL_THICK/2)
    fl_w = PORCH_X_SPLIT - (-x_half)
    fl_cx = (-x_half + PORCH_X_SPLIT) / 2.0
    win_w = 2.10
    win_h = 1.25
    win_z_sill = H_SKIRT + 0.60
    win_z_head = win_z_sill + win_h
    win_cx = fl_cx

    # Wall under window (sill to skirt)
    create_box("F2C2_Wall_FL_Sill", (fl_cx, -y_half + WALL_THICK/2.0, (H_SKIRT + win_z_sill)/2.0), 
               (fl_w, WALL_THICK, win_z_sill - H_SKIRT), mat_wall_cream, root)
    # Wall above window (lintel to eave)
    create_box("F2C2_Wall_FL_Lintel", (fl_cx, -y_half + WALL_THICK/2.0, (win_z_head + H_WALL)/2.0), 
               (fl_w, WALL_THICK, H_WALL - win_z_head), mat_wall_cream, root)
    # Wall to left of window
    fl_left_w = (win_cx - win_w/2.0) - (-x_half)
    create_box("F2C2_Wall_FL_Left", ((-x_half + (win_cx - win_w/2.0))/2.0, -y_half + WALL_THICK/2.0, (win_z_sill + win_z_head)/2.0),
               (fl_left_w, WALL_THICK, win_h), mat_wall_cream, root)
    # Wall to right of window
    fl_right_w = PORCH_X_SPLIT - (win_cx + win_w/2.0)
    create_box("F2C2_Wall_FL_Right", (((win_cx + win_w/2.0) + PORCH_X_SPLIT)/2.0, -y_half + WALL_THICK/2.0, (win_z_sill + win_z_head)/2.0),
               (fl_right_w, WALL_THICK, win_h), mat_wall_cream, root)

    # B. Porch Return Wall (running Y from -y_half to PORCH_Y_BACK at X = PORCH_X_SPLIT + WALL_THICK/2)
    create_box("F2C2_Wall_PorchReturn", (PORCH_X_SPLIT + WALL_THICK / 2.0, porch_cy, H_SKIRT + (H_WALL - H_SKIRT) / 2.0),
               (WALL_THICK, porch_d, H_WALL - H_SKIRT), mat_wall_cream, root)

    # C. Recessed Porch Back Wall with True Doorway Opening (IMG_3863)
    door_w = 0.95
    door_h = 2.10
    door_cx = porch_cx + 0.20
    door_z_head = H_SKIRT + door_h

    # Wall to left of door
    pb_left_w = (door_cx - door_w/2.0) - PORCH_X_SPLIT
    create_box("F2C2_Wall_PB_Left", ((PORCH_X_SPLIT + (door_cx - door_w/2.0))/2.0, PORCH_Y_BACK - WALL_THICK/2.0, (H_SKIRT + door_z_head)/2.0),
               (pb_left_w, WALL_THICK, door_h), mat_wall_cream, root)
    # Wall to right of door
    pb_right_w = x_half - (door_cx + door_w/2.0)
    create_box("F2C2_Wall_PB_Right", (((door_cx + door_w/2.0) + x_half)/2.0, PORCH_Y_BACK - WALL_THICK/2.0, (H_SKIRT + door_z_head)/2.0),
               (pb_right_w, WALL_THICK, door_h), mat_wall_cream, root)
    # Wall above door (lintel to eave)
    create_box("F2C2_Wall_PB_Lintel", (porch_cx, PORCH_Y_BACK - WALL_THICK/2.0, (door_z_head + H_WALL)/2.0),
               (porch_w, WALL_THICK, H_WALL - door_z_head), mat_wall_cream, root)

    # D. Left Flank Wall (continuous along full length Y in [-y_half, y_half] at X = -x_half + WALL_THICK/2)
    create_box("F2C2_Wall_Left", (-x_half + WALL_THICK / 2.0, 0.0, H_SKIRT + (H_WALL - H_SKIRT) / 2.0),
               (WALL_THICK, y_half * 2.0, H_WALL - H_SKIRT), mat_wall_cream, root)

    # E. Right Flank Wall (from PORCH_Y_BACK to rear Y = y_half at X = x_half - WALL_THICK/2)
    rf_len = y_half - PORCH_Y_BACK
    rf_cy = (PORCH_Y_BACK + y_half) / 2.0
    create_box("F2C2_Wall_Right", (x_half - WALL_THICK / 2.0, rf_cy, H_SKIRT + (H_WALL - H_SKIRT) / 2.0),
               (WALL_THICK, rf_len, H_WALL - H_SKIRT), mat_wall_cream, root)

    # F. Rear Wall (spans X in [-x_half, x_half] at Y = y_half - WALL_THICK/2)
    create_box("F2C2_Wall_Rear", (0.0, y_half - WALL_THICK / 2.0, H_SKIRT + (H_WALL - H_SKIRT) / 2.0),
               (x_half * 2.0, WALL_THICK, H_WALL - H_SKIRT), mat_wall_cream, root)

    # -----------------------------------------------------------------
    # 3. Square Support Pillar at Front-Right Porch Corner (IMG_3863 & 3862)
    # -----------------------------------------------------------------
    col_x = x_half - 0.22
    col_y = -y_half + 0.22
    col_size = 0.35
    # Plinth base on column
    create_box("F2C2_Column_Plinth", (col_x, col_y, H_SKIRT / 2.0), (col_size + 0.04, col_size + 0.04, H_SKIRT), mat_plinth_maroon, root)
    # Main column shaft extending cleanly to H_WALL
    create_box("F2C2_Column_Shaft", (col_x, col_y, H_SKIRT + (H_WALL - H_SKIRT) / 2.0), (col_size, col_size, H_WALL - H_SKIRT), mat_wall_cream, root)

    # -----------------------------------------------------------------
    # 4. Main Entrance Door inside Porch (IMG_3863)
    # -----------------------------------------------------------------
    # Interior Office Floor Cavity & Walls
    create_box("F2C2_Interior_Floor", (door_cx, PORCH_Y_BACK + 0.80, H_SKIRT + 0.02), (door_w + 0.60, 1.60, 0.04), mat_interior_tile, root)
    create_box("F2C2_Interior_BackWall", (door_cx, PORCH_Y_BACK + 1.60, H_SKIRT + (H_WALL - H_SKIRT)/2.0), (door_w + 0.60, 0.05, H_WALL - H_SKIRT), mat_interior_wall, root)

    # Outer Door Frame (dark bronze/timber) lining the opening
    create_box("F2C2_Door_Frame_L", (door_cx - door_w/2.0 + 0.02, PORCH_Y_BACK - 0.01, H_SKIRT + door_h/2.0), (0.06, 0.08, door_h), mat_frame_bronze, root)
    create_box("F2C2_Door_Frame_R", (door_cx + door_w/2.0 - 0.02, PORCH_Y_BACK - 0.01, H_SKIRT + door_h/2.0), (0.06, 0.08, door_h), mat_frame_bronze, root)
    create_box("F2C2_Door_Frame_T", (door_cx, PORCH_Y_BACK - 0.01, H_SKIRT + door_h - 0.02), (door_w, 0.08, 0.06), mat_frame_bronze, root)
    
    # Door Panel (swung open slightly into room, showing interior tile)
    create_box("F2C2_Door_Panel", (door_cx - door_w/2.0 + 0.15, PORCH_Y_BACK + 0.40, H_SKIRT + door_h / 2.0), (0.04, door_w * 0.90, door_h * 0.96), mat_door_wood, root)
    # Silver door handle lever
    create_box("F2C2_Door_Handle", (door_cx - door_w/2.0 + 0.18, PORCH_Y_BACK + 0.70, H_SKIRT + 1.0), (0.02, 0.06, 0.12), mat_door_handle, root)
    
    # Recessed downlight ceiling lamp under porch soffit
    create_cylinder("F2C2_Porch_Lamp", (porch_cx, porch_cy, H_WALL - 0.02), 0.15, 0.03, mat_porch_lamp, segments=16, parent=root)

    # -----------------------------------------------------------------
    # 5. Multi-Panel Louver Windows with Sills & Louver Blades
    # -----------------------------------------------------------------
    def build_multipanel_louver_window(name, cx, cy, cz, width, height, panels=3, face_dir='-Y'):
        frame_d = 0.08
        mullion_w = 0.05
        
        if face_dir in ['-Y', '+Y']:
            sign = -1.0 if face_dir == '-Y' else 1.0
            create_box(f"{name}_Sill", (cx, cy + sign * 0.04, cz - height/2.0 - 0.03), (width + 0.10, 0.10, 0.05), mat_wall_cream, root)
            create_box(f"{name}_Frame", (cx, cy + sign * 0.02, cz), (width, frame_d, height), mat_frame_bronze, root)
            create_box(f"{name}_Glass", (cx, cy + sign * 0.025, cz), (width - 0.08, 0.02, height - 0.08), mat_glass_louver, root)
            
            panel_w = (width - 0.10 - (panels - 1) * mullion_w) / float(panels)
            for m in range(panels - 1):
                mx = (cx - width/2.0 + 0.05) + (m + 1) * (panel_w + mullion_w) - mullion_w/2.0
                create_box(f"{name}_Mullion_{m}", (mx, cy + sign * 0.035, cz), (mullion_w, frame_d + 0.01, height - 0.06), mat_frame_bronze, root)
                
            slat_count = 6
            for s in range(slat_count):
                sz = cz - height/2.0 + 0.06 + (s + 0.5) * ((height - 0.12) / slat_count)
                create_box(f"{name}_Slat_{s}", (cx, cy + sign * 0.04, sz), (width - 0.10, 0.02, 0.03), mat_glass_slat, root)
                
        else: # '+X' or '-X'
            sign = 1.0 if face_dir == '+X' else -1.0
            create_box(f"{name}_Sill", (cx + sign * 0.04, cy, cz - height/2.0 - 0.03), (0.10, width + 0.10, 0.05), mat_wall_cream, root)
            create_box(f"{name}_Frame", (cx + sign * 0.02, cy, cz), (frame_d, width, height), mat_frame_bronze, root)
            create_box(f"{name}_Glass", (cx + sign * 0.025, cy, cz), (0.02, width - 0.08, height - 0.08), mat_glass_louver, root)
            
            panel_w = (width - 0.10 - (panels - 1) * mullion_w) / float(panels)
            for m in range(panels - 1):
                my = (cy - width/2.0 + 0.05) + (m + 1) * (panel_w + mullion_w) - mullion_w/2.0
                create_box(f"{name}_Mullion_{m}", (cx + sign * 0.035, my, cz), (frame_d + 0.01, mullion_w, height - 0.06), mat_frame_bronze, root)
                
            slat_count = 6
            for s in range(slat_count):
                sz = cz - height/2.0 + 0.06 + (s + 0.5) * ((height - 0.12) / slat_count)
                create_box(f"{name}_Slat_{s}", (cx + sign * 0.04, cy, sz), (0.02, width - 0.10, 0.03), mat_glass_slat, root)

    # Front Main Window (IMG_3863): 3-panel louver window on front-left wall
    win_front_z = (win_z_sill + win_z_head) / 2.0
    build_multipanel_louver_window("F2C2_Win_Front", win_cx, -y_half, win_front_z, win_w, win_h, panels=3, face_dir='-Y')

    # -----------------------------------------------------------------
    # 6. Front Air Conditioning Unit on Stand (IMG_3863)
    # -----------------------------------------------------------------
    ac_x = -x_half + 0.65
    ac_y = -y_half - 0.28
    ac_z = H_SKIRT + 0.45
    ac_w = 0.68
    ac_d = 0.52
    ac_h = 0.48
    create_box("F2C2_AC_Stand_Top", (ac_x, ac_y, ac_z - ac_h/2.0 - 0.02), (ac_w + 0.08, ac_d + 0.06, 0.03), mat_bracket_dark, root)
    create_box("F2C2_AC_Stand_Leg1", (ac_x - ac_w/2.0, ac_y - ac_d/2.0, (ac_z - ac_h/2.0) / 2.0), (0.04, 0.04, ac_z - ac_h/2.0), mat_bracket_dark, root)
    create_box("F2C2_AC_Stand_Leg2", (ac_x + ac_w/2.0, ac_y - ac_d/2.0, (ac_z - ac_h/2.0) / 2.0), (0.04, 0.04, ac_z - ac_h/2.0), mat_bracket_dark, root)
    create_box("F2C2_AC_Body", (ac_x, ac_y, ac_z), (ac_w, ac_d, ac_h), mat_ac_metal, root)
    create_box("F2C2_AC_Grille", (ac_x, ac_y - ac_d/2.0 - 0.015, ac_z), (ac_w * 0.88, 0.02, ac_h * 0.82), mat_bracket_dark, root)
    create_box("F2C2_AC_Hood", (ac_x, ac_y, ac_z + ac_h/2.0 + 0.03), (ac_w + 0.12, ac_d + 0.12, 0.02), mat_fascia_maroon, root)

    # -----------------------------------------------------------------
    # 7. Right Flank Windows, Signage & AC Units (IMG_3862 & 3870)
    # -----------------------------------------------------------------
    sign_y = PORCH_Y_BACK + 0.55
    create_box("F2C2_Sign_Plate", (x_half + 0.015, sign_y, H_SKIRT + 1.20), (0.02, 0.35, 0.25), mat_sign_plate, root)
    create_box("F2C2_Sign_Icon",  (x_half + 0.025, sign_y, H_SKIRT + 1.20), (0.01, 0.15, 0.15), mat_sign_symbol, root)

    build_multipanel_louver_window("F2C2_Win_Right1", x_half, PORCH_Y_BACK + 2.20, H_SKIRT + 1.25, 1.50, 1.20, panels=2, face_dir='+X')

    ac_r_y = PORCH_Y_BACK + 3.60
    ac_r_z = H_SKIRT + 1.10
    create_box("F2C2_AC_Right_Bracket", (x_half + 0.14, ac_r_y, ac_r_z - 0.24), (0.26, 0.65, 0.04), mat_bracket_dark, root)
    create_box("F2C2_AC_Right_Body",    (x_half + 0.20, ac_r_y, ac_r_z), (0.30, 0.72, 0.50), mat_ac_metal, root)
    create_cylinder("F2C2_AC_Right_Fan", (x_half + 0.36, ac_r_y, ac_r_z), 0.16, 0.02, mat_bracket_dark, segments=12, rot=(0, math.radians(90), 0), parent=root)

    build_multipanel_louver_window("F2C2_Win_Right2", x_half, PORCH_Y_BACK + 5.00, H_SKIRT + 1.25, 1.20, 1.20, panels=2, face_dir='+X')

    side_door_y = PORCH_Y_BACK + 6.80
    create_box("F2C2_Door_Side_Frame", (x_half + 0.02, side_door_y, H_SKIRT + 1.05), (0.06, 0.90, 2.10), mat_frame_bronze, root)
    create_box("F2C2_Door_Side_Panel", (x_half + 0.01, side_door_y, H_SKIRT + 1.05), (0.04, 0.82, 2.02), mat_door_wood, root)

    # -----------------------------------------------------------------
    # 8. Left Flank Windows & Rear Wall Windows
    # -----------------------------------------------------------------
    left_win_ys = [-3.20, 0.0, 3.20]
    for idx, ly in enumerate(left_win_ys):
        build_multipanel_louver_window(f"F2C2_Win_Left_{idx}", -x_half, ly, H_SKIRT + 1.25, 1.60, 1.20, panels=2, face_dir='-X')

    create_box("F2C2_Door_Rear_Frame", (-1.20, y_half + 0.02, H_SKIRT + 1.05), (0.90, 0.06, 2.10), mat_frame_bronze, root)
    create_box("F2C2_Door_Rear_Panel", (-1.20, y_half + 0.01, H_SKIRT + 1.05), (0.82, 0.04, 2.02), mat_door_wood, root)
    build_multipanel_louver_window("F2C2_Win_Rear", 1.50, y_half, H_SKIRT + 1.25, 1.60, 1.20, panels=2, face_dir='+Y')

    # -----------------------------------------------------------------
    # 9. Authentic 4-Hip Corrugated Metal Roof (IMG_3861, 3862, 3863)
    # -----------------------------------------------------------------
    EAVE_OVERHANG = 0.75
    roof_x_half = x_half + EAVE_OVERHANG  # 3.795 + 0.75 = 4.545
    roof_y_half = y_half + EAVE_OVERHANG  # 6.625 + 0.75 = 7.375
    
    EAVE_Z = H_WALL - 0.05               # 2.80m
    RIDGE_Z = H_WALL + 1.45              # 4.30m (roof apex height)
    FASCIA_H = 0.22                      # Height of timber fascia board
    
    ridge_y_half = roof_y_half - roof_x_half # 7.375 - 4.545 = 2.83m

    create_box("F2C2_Soffit_Main", (0.0, 0.0, EAVE_Z - 0.02), (roof_x_half * 2.0, roof_y_half * 2.0, 0.04), mat_soffit, root)

    f_thick = 0.05
    create_box("F2C2_Fascia_Front", (0.0, -roof_y_half + f_thick/2.0, EAVE_Z + FASCIA_H/2.0 - 0.04), 
               (roof_x_half * 2.0, f_thick, FASCIA_H), mat_fascia_maroon, root)
    create_box("F2C2_Fascia_Rear", (0.0, roof_y_half - f_thick/2.0, EAVE_Z + FASCIA_H/2.0 - 0.04), 
               (roof_x_half * 2.0, f_thick, FASCIA_H), mat_fascia_maroon, root)
    create_box("F2C2_Fascia_Left", (-roof_x_half + f_thick/2.0, 0.0, EAVE_Z + FASCIA_H/2.0 - 0.04), 
               (f_thick, roof_y_half * 2.0, FASCIA_H), mat_fascia_maroon, root)
    create_box("F2C2_Fascia_Right", (roof_x_half - f_thick/2.0, 0.0, EAVE_Z + FASCIA_H/2.0 - 0.04), 
               (f_thick, roof_y_half * 2.0, FASCIA_H), mat_fascia_maroon, root)

    z_eave = EAVE_Z + FASCIA_H - 0.02
    
    r_mesh = bpy.data.meshes.new("F2C2_Roof_Mesh")
    bm_r = bmesh.new()
    
    v_fl = bm_r.verts.new((-roof_x_half, -roof_y_half, z_eave))
    v_fr = bm_r.verts.new(( roof_x_half, -roof_y_half, z_eave))
    v_rr = bm_r.verts.new(( roof_x_half,  roof_y_half, z_eave))
    v_rl = bm_r.verts.new((-roof_x_half,  roof_y_half, z_eave))
    
    v_rf = bm_r.verts.new((0.0, -ridge_y_half, RIDGE_Z))
    v_rb = bm_r.verts.new((0.0,  ridge_y_half, RIDGE_Z))
    
    bm_r.faces.new((v_fl, v_fr, v_rf))
    bm_r.faces.new((v_fr, v_rr, v_rb, v_rf))
    bm_r.faces.new((v_rr, v_rl, v_rb))
    bm_r.faces.new((v_rl, v_fl, v_rf, v_rb))
    
    bmesh.ops.recalc_face_normals(bm_r, faces=bm_r.faces)
    bm_r.to_mesh(r_mesh)
    bm_r.free()
    
    roof_obj = bpy.data.objects.new("F2C2_Roof_Surface", r_mesh)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.data.materials.append(mat_roof_metal)
    roof_obj.parent = root

    def create_ridge_ribbon(name, p1, p2, width=0.22, height=0.06):
        cap_mesh = bpy.data.meshes.new(f"{name}_Mesh")
        bm = bmesh.new()
        
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        dz = p2[2] - p1[2]
        h_len = math.sqrt(dx*dx + dy*dy)
        if h_len < 1e-4:
            return
        nx = -dy / h_len * (width / 2.0)
        ny =  dx / h_len * (width / 2.0)
        
        v1_l = bm.verts.new((p1[0] + nx, p1[1] + ny, p1[2] + 0.01))
        v1_r = bm.verts.new((p1[0] - nx, p1[1] - ny, p1[2] + 0.01))
        v1_p = bm.verts.new((p1[0],      p1[1],      p1[2] + height))
        
        v2_l = bm.verts.new((p2[0] + nx, p2[1] + ny, p2[2] + 0.01))
        v2_r = bm.verts.new((p2[0] - nx, p2[1] - ny, p2[2] + 0.01))
        v2_p = bm.verts.new((p2[0],      p2[1],      p2[2] + height))
        
        bm.faces.new((v1_l, v2_l, v2_p, v1_p))
        bm.faces.new((v1_p, v2_p, v2_r, v1_r))
        bm.faces.new((v1_l, v1_p, v1_r))
        bm.faces.new((v2_l, v2_r, v2_p))
        
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(cap_mesh)
        bm.free()
        
        c_obj = bpy.data.objects.new(name, cap_mesh)
        bpy.context.scene.collection.objects.link(c_obj)
        c_obj.data.materials.append(mat_roof_ridge)
        c_obj.parent = root

    create_ridge_ribbon("F2C2_Ridge_Center", (0.0, -ridge_y_half, RIDGE_Z), (0.0, ridge_y_half, RIDGE_Z), width=0.26, height=0.07)
    create_ridge_ribbon("F2C2_Hip_FL", (-roof_x_half, -roof_y_half, z_eave), (0.0, -ridge_y_half, RIDGE_Z))
    create_ridge_ribbon("F2C2_Hip_FR", ( roof_x_half, -roof_y_half, z_eave), (0.0, -ridge_y_half, RIDGE_Z))
    create_ridge_ribbon("F2C2_Hip_RL", (-roof_x_half,  roof_y_half, z_eave), (0.0,  ridge_y_half, RIDGE_Z))
    create_ridge_ribbon("F2C2_Hip_RR", ( roof_x_half,  roof_y_half, z_eave), (0.0,  ridge_y_half, RIDGE_Z))

    # -----------------------------------------------------------------
    # 10. WebGL GLB Export
    # -----------------------------------------------------------------
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    
    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\f2c2_building.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"✅ Exported F2C2 Building GLB (Retained Past Scale) to {glb_out} (Size: {file_size_kb:.1f} KB)")
    return root

build_f2c2_building()
