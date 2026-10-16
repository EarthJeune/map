"""
build_raed_building.py - Authentic 3D Model of the Regional Agricultural Engineering Division (RAED)
Built strictly from reference photographs:
1. IMG_3811 (Full Front Elevation & Approach Walkway):
   - 4-sided low-pitch hipped roof with weathered sage green corrugated metal sheeting
   - Deep charcoal perimeter fascia boards and wide eave overhang
   - Protruding central entrance portico canopy with integrated official signboard:
     "REGIONAL AGRICULTURAL ENGINEERING DIVISION (RAED)" with DA seal medallion
   - Solid rectangular corner pillars at entrance portico with terracotta plinth skirts
   - Side-mounted AC condenser unit on the left entrance column
   - Full glass aluminum storefront with double entrance doors and transoms
   - Clean entrance stoop landing strictly confined to the portico footprint
   - Symmetrical front facade with 4 large ribbon window bays and dark upper transom bands
   - Window-mounted A/C units with blue drainage pipes along piers
2. IMG_3812 (Side Elevation & Corner Architecture):
   - Solid corner pilasters and terracotta/maroon foundation plinth skirt
   - Upper dark wood-paneled transom band running beneath eaves
   - Side window bays with A/C units
3. STRICT RULE 4 COMPLIANCE:
   - ZERO extraneous outdoor props: No approach pathway, no road curbs, no grass bushes, no red hedge blocks.
"""

import bpy
import bmesh
import math
import os

def create_mat(name, color, roughness=0.7, metallic=0.0, emission_color=None, emission_strength=0.0):
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    node_out = nodes.new(type='ShaderNodeOutputMaterial')
    node_principled = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_principled.inputs['Base Color'].default_value = color if len(color) == 4 else (*color, 1.0)
    node_principled.inputs['Roughness'].default_value = roughness
    node_principled.inputs['Metallic'].default_value = metallic
    if emission_color and emission_strength > 0:
        ec = emission_color if len(emission_color) == 4 else (*emission_color, 1.0)
        node_principled.inputs['Emission Color'].default_value = ec
        node_principled.inputs['Emission Strength'].default_value = emission_strength
    mat.node_tree.links.new(node_principled.outputs['BSDF'], node_out.inputs['Surface'])
    return mat

def create_box(name, loc, size, mat, parent=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = loc
    obj.scale = size
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, loc, radius, height, mat, segments=16, rot=(0,0,0), parent=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=height)
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = loc
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_raed_building():
    print("Building Authentic RAED Building strictly compliant with Rule 4 & reference photos...")
    
    # 1. Clean existing RAED objects
    for obj in list(bpy.data.objects):
        if obj.name.startswith("RAED_"):
            bpy.data.objects.remove(obj, do_unlink=True)
    for c in list(bpy.data.collections):
        if c.name.startswith("RAED_"):
            bpy.data.collections.remove(c)
            
    root = bpy.data.objects.new("RAED_Building", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (0, 0, 0)
    
    # 2. Materials
    # Walls & Architecture (IMG_3811, IMG_3812)
    mat_wall = create_mat("Mat_RAED_Wall", (0.92, 0.89, 0.82), roughness=0.85) # Warm cream masonry
    mat_pilaster = create_mat("Mat_RAED_Pilaster", (0.93, 0.90, 0.84), roughness=0.80) # Sturdy piers
    mat_plinth_skirt = create_mat("Mat_RAED_PlinthSkirt", (0.62, 0.28, 0.22), roughness=0.90) # Terracotta base skirt
    mat_plinth = create_mat("Mat_RAED_Plinth", (0.60, 0.58, 0.55), roughness=0.92) # Concrete slab base
    
    # Upper Wood/Fiber Transom Band beneath eaves (IMG_3811, IMG_3812)
    mat_transom_band = create_mat("Mat_RAED_TransomBand", (0.22, 0.19, 0.17), roughness=0.85) # Deep charcoal/brown
    
    # Roof (IMG_3811, IMG_3812) - Weathered sage green corrugated metal with charcoal fascia
    mat_roof = create_mat("Mat_RAED_Roof", (0.28, 0.42, 0.32), roughness=0.55, metallic=0.15)
    mat_ridge = create_mat("Mat_RAED_Ridge", (0.24, 0.36, 0.28), roughness=0.60)
    mat_fascia = create_mat("Mat_RAED_Fascia", (0.18, 0.16, 0.15), roughness=0.75)
    mat_soffit = create_mat("Mat_RAED_Soffit", (0.22, 0.20, 0.19), roughness=0.85)
    
    # Openings & Fenestration
    mat_frame = create_mat("Mat_RAED_Frame", (0.18, 0.19, 0.20), roughness=0.35, metallic=0.60)
    mat_glass = create_mat("Mat_RAED_Glass", (0.14, 0.22, 0.28), roughness=0.10)
    mat_door_glass = create_mat("Mat_RAED_DoorGlass", (0.18, 0.28, 0.35), roughness=0.10, emission_color=(0.14, 0.22, 0.28), emission_strength=0.3)
    mat_door_frame = create_mat("Mat_RAED_DoorFrame", (0.20, 0.22, 0.24), roughness=0.40, metallic=0.70)
    mat_step_tile = create_mat("Mat_RAED_StepTile", (0.90, 0.90, 0.88), roughness=0.60)
    
    # Equipment & Utilities (IMG_3811, IMG_3812)
    mat_ac_unit = create_mat("Mat_RAED_AC", (0.88, 0.88, 0.86), roughness=0.40)
    mat_drain_pipe = create_mat("Mat_RAED_Pipe", (0.15, 0.35, 0.75), roughness=0.30) # Blue PVC pipe
    mat_ac_bracket = create_mat("Mat_RAED_ACBracket", (0.25, 0.26, 0.28), roughness=0.50, metallic=0.60)
    
    # Entrance Canopy & Signboard Materials (IMG_3811)
    mat_canopy_slab = create_mat("Mat_RAED_CanopySlab", (0.75, 0.74, 0.71), roughness=0.85)
    mat_canopy_fascia = create_mat("Mat_RAED_CanopyFascia", (0.92, 0.89, 0.82), roughness=0.80) # Warm cream matching masonry
    mat_sign_cream = create_mat("Mat_RAED_SignCream", (0.96, 0.94, 0.89), roughness=0.40) # Clean light cream face
    mat_sign_white = create_mat("Mat_RAED_SignWhite", (0.98, 0.98, 0.98), roughness=0.30) # White logo plate
    mat_sign_letters = create_mat("Mat_RAED_SignLetters", (0.85, 0.86, 0.88), roughness=0.20, metallic=0.90) # Polished chrome/stainless 3D letters (IMG_3811)
    mat_sign_shadow = create_mat("Mat_RAED_SignShadow", (0.25, 0.24, 0.22), roughness=0.70) # Subtle relief backing shadow
    mat_da_green = create_mat("Mat_RAED_DAGreen", (0.10, 0.48, 0.22), roughness=0.35) # DA emblem green
    mat_da_gold = create_mat("Mat_RAED_DAGold", (0.86, 0.70, 0.20), roughness=0.35) # DA emblem gold/yellow
    mat_breezeway = create_mat("Mat_RAED_Breezeway", (0.68, 0.82, 0.74), roughness=0.80) # Pale mint green interior vestibule (IMG_3811)
    mat_concrete = create_mat("Mat_RAED_Concrete", (0.72, 0.70, 0.66), roughness=0.90)
    
    # 3. Primary Dimensions
    TOTAL_W = 22.60 # Facade width (along X)
    TOTAL_D = 12.60 # Building depth (along Y)
    WALL_H = 3.40
    PLINTH_H = 0.35
    SKIRT_H = 0.25
    EAVE_Z = PLINTH_H + WALL_H # 3.75m
    RIDGE_H = 2.40
    RIDGE_Z = EAVE_Z + RIDGE_H # 6.15m
    OVERHANG = 1.15
    
    # 4. Foundation Plinth Slab & Terracotta Base Skirting Line (IMG_3811, IMG_3812)
    create_box("RAED_Plinth_Base", (0, 0, PLINTH_H/2), (TOTAL_W + 0.4, TOTAL_D + 0.4, PLINTH_H), mat_plinth, root)
    create_box("RAED_Plinth_Skirt", (0, 0, PLINTH_H + SKIRT_H/2), (TOTAL_W + 0.05, TOTAL_D + 0.05, SKIRT_H), mat_plinth_skirt, root)

    # 5. Main Masonry Wall Body & Dark Upper Transom Band
    band_h = 0.85 # Dark upper wood transom band below eaves
    body_h = WALL_H - SKIRT_H - band_h
    body_z = PLINTH_H + SKIRT_H + body_h/2
    create_box("RAED_Main_Masonry", (0, 0, body_z), (TOTAL_W, TOTAL_D, body_h), mat_wall, root)
    
    # Upper Continuous Charcoal Transom Band (IMG_3811, IMG_3812)
    band_z = EAVE_Z - band_h/2
    create_box("RAED_Upper_TransomBand", (0, 0, band_z), (TOTAL_W + 0.02, TOTAL_D + 0.02, band_h), mat_transom_band, root)

    # 6. Exterior Structural Pilasters / Column Piers (IMG_3811, IMG_3812)
    pil_w = 0.45
    pil_d = 0.45
    # Corner Pilasters
    for px in [-TOTAL_W/2 + pil_w/2, TOTAL_W/2 - pil_w/2]:
        for py in [-TOTAL_D/2 + pil_d/2, TOTAL_D/2 - pil_d/2]:
            create_box(f"RAED_Pilaster_Corner_{px:.1f}_{py:.1f}", (px, py, PLINTH_H + WALL_H/2), (pil_w, pil_d, WALL_H), mat_pilaster, root)

    # Front Intermediate Piers dividing window bays (IMG_3811)
    # 4 intermediate piers on the front: X = -6.6, -2.5, +2.5, +6.6
    for px in [-6.6, -2.5, 2.5, 6.6]:
        create_box(f"RAED_Front_Pier_{px:.1f}", (px, -TOTAL_D/2 - 0.06, PLINTH_H + WALL_H/2), (0.42, 0.16, WALL_H), mat_pilaster, root)

    # -------------------------------------------------------------------------
    # 7. FRONT FACADE (Facing -Y, matching IMG_3811)
    # -------------------------------------------------------------------------
    fy = -TOTAL_D/2 - 0.02
    win_h = 1.35
    win_z = PLINTH_H + 1.65 # Sits right above eye level under the transom band
    
    # Symmetrical Ribbon Window Bays:
    bays = [
        ("Bay1_FarL", -8.8, 3.60, True),  # With A/C unit
        ("Bay2_MidL", -4.55, 3.50, True), # With A/C unit
        ("Bay3_MidR", 4.55, 3.50, False),
        ("Bay4_FarR", 8.8, 3.60, True)   # With A/C unit
    ]
    
    for b_id, bx, bw, has_ac in bays:
        # Window Outer Frame
        create_box(f"RAED_Win_{b_id}_Frame", (bx, fy, win_z), (bw, 0.10, win_h), mat_frame, root)
        # Window Glass Panes (3 panes per bay)
        pane_w = (bw - 0.15) / 3.0
        for pi in range(3):
            px = bx - bw/2 + pane_w/2 + 0.04 + pi * pane_w
            create_box(f"RAED_Win_{b_id}_Glass_{pi}", (px, fy - 0.01, win_z), (pane_w - 0.04, 0.04, win_h - 0.08), mat_glass, root)
            if pi < 2:
                # Vertical Mullion
                mx = bx - bw/2 + (pi + 1) * pane_w
                create_box(f"RAED_Win_{b_id}_Mullion_{pi}", (mx, fy - 0.02, win_z), (0.05, 0.08, win_h), mat_frame, root)
        
        # Window-Mounted A/C Unit in the transom panel directly above window (IMG_3811, IMG_3812)
        if has_ac:
            ac_x = bx + (bw/4 if b_id.endswith("FarR") or b_id.endswith("MidL") else -bw/4)
            ac_z = EAVE_Z - band_h/2
            create_box(f"RAED_AC_{b_id}", (ac_x, fy - 0.12, ac_z), (0.75, 0.38, 0.52), mat_ac_unit, root)
            # Blue PVC condensation drain pipe running vertically down the wall/pier
            create_cylinder(f"RAED_Pipe_{b_id}", (ac_x - 0.32, fy - 0.04, (ac_z + PLINTH_H)/2), 0.025, ac_z - PLINTH_H, mat_drain_pipe, 8, parent=root)

    # -------------------------------------------------------------------------
    # 8. CENTRAL ENTRANCE PORTICO & CANOPY (IMG_3811)
    # -------------------------------------------------------------------------
    canopy_w = 4.80
    canopy_d = 2.60
    canopy_top_z = 3.48 # Connects directly under main roof eave
    canopy_beam_h = 0.48 # Solid fascia beam height (from Z=3.00 to 3.48)
    canopy_beam_z = canopy_top_z - canopy_beam_h/2 # 3.24m
    canopy_front_y = fy - canopy_d
    canopy_center_y = fy - canopy_d/2
    
    # (a) Canopy Flat Concrete Roof Slab
    create_box("RAED_Canopy_RoofSlab", (0, canopy_center_y, canopy_top_z - 0.08), (canopy_w, canopy_d, 0.16), mat_canopy_slab, root)
    
    # (b) Canopy Side Fascias (Left & Right)
    create_box("RAED_Canopy_Fascia_Left", (-canopy_w/2 + 0.08, canopy_center_y, canopy_beam_z), (0.16, canopy_d, canopy_beam_h), mat_canopy_fascia, root)
    create_box("RAED_Canopy_Fascia_Right", (canopy_w/2 - 0.08, canopy_center_y, canopy_beam_z), (0.16, canopy_d, canopy_beam_h), mat_canopy_fascia, root)
    
    # (c) Front Canopy Structural Pillar Columns (IMG_3811):
    # Two solid rectangular concrete columns at the front corners
    col_w = 0.38
    col_d = 0.38
    col_h = canopy_top_z - canopy_beam_h # 3.00m
    col_y = canopy_front_y + col_d/2
    for cx in [-canopy_w/2 + col_w/2, canopy_w/2 - col_w/2]:
        # Terracotta base plinth skirt on columns
        create_box(f"RAED_Canopy_ColSkirt_{cx:.1f}", (cx, col_y, SKIRT_H/2), (col_w + 0.04, col_d + 0.04, SKIRT_H), mat_plinth_skirt, root)
        # Main cream column shaft
        create_box(f"RAED_Canopy_ColShaft_{cx:.1f}", (cx, col_y, (col_h + SKIRT_H)/2), (col_w, col_d, col_h - SKIRT_H), mat_pilaster, root)

    # (d) Side-Mounted AC Condenser Unit on the Left Column (Seen in IMG_3811):
    ac_col_x = -canopy_w/2 - 0.18
    ac_col_y = col_y
    ac_col_z = 1.65
    create_box("RAED_Canopy_AC_Bracket", (ac_col_x + 0.08, ac_col_y, ac_col_z - 0.18), (0.16, 0.40, 0.04), mat_ac_bracket, root)
    create_box("RAED_Canopy_AC_Unit", (ac_col_x, ac_col_y, ac_col_z), (0.32, 0.65, 0.52), mat_ac_unit, root)

    # (e) Entrance Stoop / Landing:
    # Strictly confined under the canopy footprint with white tiled front step riser (Zero outside pathway)
    create_box("RAED_Porch_Landing", (0, canopy_center_y, PLINTH_H/2), (canopy_w + 0.10, canopy_d + 0.10, PLINTH_H), mat_concrete, root)
    # Front tiled step edge riser (IMG_3811 shows white-tiled entrance step)
    step_w = 2.80
    step_d = 0.35
    step_h = 0.18
    create_box("RAED_Porch_StepRiser", (0, canopy_front_y - step_d/2, step_h/2), (step_w, step_d, step_h), mat_step_tile, root)

    # (f) Glazed Commercial Storefront & Entrance Double Doors (IMG_3811):
    door_w = 1.90
    door_h = 2.25
    door_z = PLINTH_H + door_h/2
    # Recessed mint-green vestibule wall
    create_box("RAED_Breezeway_Wall", (0, fy + 0.02, PLINTH_H + WALL_H/2), (4.40, 0.04, WALL_H), mat_breezeway, root)
    # Storefront Outer Frame
    create_box("RAED_Storefront_Frame", (0, fy - 0.01, PLINTH_H + 1.40), (canopy_w - 0.80, 0.08, 2.80), mat_frame, root)
    # Double Glass Doors
    create_box("RAED_Door_Leaf_L", (-door_w/4, fy - 0.02, door_z), (door_w/2 - 0.04, 0.04, door_h - 0.06), mat_door_glass, root)
    create_box("RAED_Door_Leaf_R", (door_w/4, fy - 0.02, door_z), (door_w/2 - 0.04, 0.04, door_h - 0.06), mat_door_glass, root)
    create_box("RAED_Door_Frame_L", (-door_w/4, fy - 0.02, door_z), (door_w/2, 0.05, door_h), mat_door_frame, root)
    create_box("RAED_Door_Frame_R", (door_w/4, fy - 0.02, door_z), (door_w/2, 0.05, door_h), mat_door_frame, root)
    # Storefront Fixed Side Lights
    side_w = (canopy_w - 0.80 - door_w) / 2 # ~1.05m
    create_box("RAED_Storefront_Side_L", (-door_w/2 - side_w/2, fy - 0.02, door_z), (side_w - 0.06, 0.04, door_h - 0.06), mat_glass, root)
    create_box("RAED_Storefront_Side_R", (door_w/2 + side_w/2, fy - 0.02, door_z), (side_w - 0.06, 0.04, door_h - 0.06), mat_glass, root)
    # Upper Transom Glass Ribbon
    transom_h = 2.80 - door_h
    create_box("RAED_Storefront_Transom", (0, fy - 0.02, PLINTH_H + door_h + transom_h/2), (canopy_w - 0.88, 0.04, transom_h - 0.04), mat_glass, root)

    # -------------------------------------------------------------------------
    # 9. AUTHENTIC INTEGRATED FRONT SIGNBOARD (IMG_3811 & user request)
    # Strictly built into the canopy front fascia beam:
    # Warm cream fascia header, architectural top/bottom lips, square white DA logo
    # plaque with vertically oriented circular medallion, and 3D metallic lettering:
    # "REGIONAL AGRICULTURAL ENGINEERING DIVISION (RAED)"
    # -------------------------------------------------------------------------
    sign_w = canopy_w # 4.80m wide
    sign_beam_d = 0.16
    sign_face_y = canopy_front_y - sign_beam_d/2 # ~ fy - 2.68
    
    # (a) Main Front Concrete Fascia Beam Body
    create_box("RAED_Canopy_FrontBeam", (0, sign_face_y, canopy_beam_z), (sign_w, sign_beam_d, canopy_beam_h), mat_canopy_fascia, root)
    
    # (b) Architectural Framing Lips (Top coping ledge and bottom drip lip)
    create_box("RAED_Sign_TopLip", (0, sign_face_y - 0.015, canopy_top_z + 0.01), (sign_w + 0.08, sign_beam_d + 0.04, 0.04), mat_canopy_fascia, root)
    create_box("RAED_Sign_BottomLip", (0, sign_face_y - 0.015, canopy_top_z - canopy_beam_h - 0.01), (sign_w + 0.04, sign_beam_d + 0.04, 0.03), mat_canopy_fascia, root)
    
    # (c) Recessed Signboard Faceplate
    face_w = sign_w - 0.12 # 4.68m
    face_h = canopy_beam_h - 0.06 # 0.42m
    face_y = sign_face_y - sign_beam_d/2 - 0.008
    create_box("RAED_Sign_Faceplate", (0, face_y, canopy_beam_z), (face_w, 0.016, face_h), mat_sign_cream, root)

    # (d) DA / CALABARZON Official Seal Plaque on Left (IMG_3811):
    # Square white plaque board mounted on the fascia
    plaque_size = 0.36
    plaque_x = -face_w/2 + plaque_size/2 + 0.12 # ~ -2.04
    plaque_y = face_y - 0.012
    create_box("RAED_Sign_Plaque", (plaque_x, plaque_y, canopy_beam_z), (plaque_size, 0.016, plaque_size), mat_sign_white, root)
    
    # DA Emblem Relief: MUST BE ROTATED 90 DEG AROUND X TO FACE FRONT -Y (NO HORIZONTAL DISCS!)
    # Outer green seal ring
    emblem_r = 0.14
    emblem_y = plaque_y - 0.012
    create_cylinder("RAED_Sign_SealGreen", (plaque_x, emblem_y, canopy_beam_z), emblem_r, 0.014, mat_da_green, 24, rot=(math.pi/2, 0, 0), parent=root)
    # Inner gold circular field
    create_cylinder("RAED_Sign_SealGold", (plaque_x, emblem_y - 0.004, canopy_beam_z), emblem_r * 0.65, 0.016, mat_da_gold, 20, rot=(math.pi/2, 0, 0), parent=root)

    # (e) 3D Letter Words: "REGIONAL AGRICULTURAL ENGINEERING DIVISION (RAED)"
    # Mounted in a single clean horizontal line across the faceplate (IMG_3811)
    # Spanned cleanly with individual 3D letter cutouts in polished metallic silver/chrome:
    words_data = [
        ("REGIONAL", 0.62),
        ("AGRICULTURAL", 0.95),
        ("ENGINEERING", 0.88),
        ("DIVISION", 0.55),
        ("(RAED)", 0.42)
    ]
    tot_word_w = sum(w for _, w in words_data)
    text_start_x = plaque_x + plaque_size/2 + 0.16 # ~ -1.70
    avail_w = (face_w/2 - 0.12) - text_start_x # ~ 3.92m
    word_gap = (avail_w - tot_word_w) / (len(words_data) - 1)
    letter_y = face_y - 0.014
    letter_h = 0.20
    
    curr_x = text_start_x
    for word_text, word_w in words_data:
        # Subtle drop-shadow / mount base
        create_box(f"RAED_Mount_{word_text}", (curr_x + word_w/2, letter_y + 0.003, canopy_beam_z), (word_w, 0.006, letter_h + 0.02), mat_sign_shadow, root)
        
        # Individual 3D characters for authentic look
        n_chars = len(word_text)
        char_gap = word_w / n_chars
        for ci, ch in enumerate(word_text):
            cx = curr_x + (ci + 0.5) * char_gap
            cw = char_gap * 0.75
            create_box(f"RAED_Char_{word_text}_{ci}_{ch}", (cx, letter_y - 0.005, canopy_beam_z), (cw, 0.012, letter_h), mat_sign_letters, root)
            
        curr_x += word_w + word_gap

    # -------------------------------------------------------------------------
    # 10. SIDE & REAR FACADES (IMG_3812)
    # -------------------------------------------------------------------------
    # West Side Facade (-X)
    for wy in [-3.0, 3.0]:
        create_box(f"RAED_Win_W_{wy:.1f}_F", (-TOTAL_W/2 - 0.02, wy, win_z), (0.10, 3.20, win_h), mat_frame, root)
        create_box(f"RAED_Win_W_{wy:.1f}_G", (-TOTAL_W/2 - 0.03, wy, win_z), (0.04, 3.10, win_h - 0.08), mat_glass, root)
        # Side A/C unit
        create_box(f"RAED_AC_W_{wy:.1f}", (-TOTAL_W/2 - 0.15, wy, EAVE_Z - band_h/2), (0.38, 0.75, 0.52), mat_ac_unit, root)

    # East Side Facade (+X)
    for wy in [-3.0, 3.0]:
        create_box(f"RAED_Win_E_{wy:.1f}_F", (TOTAL_W/2 + 0.02, wy, win_z), (0.10, 3.20, win_h), mat_frame, root)
        create_box(f"RAED_Win_E_{wy:.1f}_G", (TOTAL_W/2 + 0.03, wy, win_z), (0.04, 3.10, win_h - 0.08), mat_glass, root)

    # Rear Facade (+Y)
    for wx in [-6.5, 6.5]:
        create_box(f"RAED_Win_B_{wx:.1f}_F", (wx, TOTAL_D/2 + 0.02, win_z), (3.50, 0.10, win_h), mat_frame, root)
        create_box(f"RAED_Win_B_{wx:.1f}_G", (wx, TOTAL_D/2 + 0.03, win_z), (3.40, 0.04, win_h - 0.08), mat_glass, root)
    create_box("RAED_Door_Rear", (0, TOTAL_D/2 + 0.02, PLINTH_H + 1.15), (1.40, 0.10, 2.30), mat_frame, root)

    # -------------------------------------------------------------------------
    # 11. FOUR-SIDED PYRAMIDAL HIPPED ROOF (IMG_3811, IMG_3812)
    # -------------------------------------------------------------------------
    rx_min = -TOTAL_W/2 - OVERHANG
    rx_max = TOTAL_W/2 + OVERHANG
    ry_min = -TOTAL_D/2 - OVERHANG
    ry_max = TOTAL_D/2 + OVERHANG
    
    total_roof_w = rx_max - rx_min # ~24.9m
    total_roof_d = ry_max - ry_min # ~14.9m
    
    ridge_len = total_roof_w - total_roof_d # ~10.0m
    ridge_x1 = -ridge_len / 2
    ridge_x2 = ridge_len / 2
    ridge_y = 0.0
    
    roof_mesh = bpy.data.meshes.new("RAED_Roof_Mesh")
    bm = bmesh.new()
    
    v_c1 = bm.verts.new((rx_min, ry_min, EAVE_Z))
    v_c2 = bm.verts.new((rx_max, ry_min, EAVE_Z))
    v_c3 = bm.verts.new((rx_max, ry_max, EAVE_Z))
    v_c4 = bm.verts.new((rx_min, ry_max, EAVE_Z))
    
    v_r1 = bm.verts.new((ridge_x1, ridge_y, RIDGE_Z))
    v_r2 = bm.verts.new((ridge_x2, ridge_y, RIDGE_Z))
    
    bm.faces.new((v_c1, v_c2, v_r2, v_r1)) # Front slope
    bm.faces.new((v_c2, v_c3, v_r2))       # Right hip slope
    bm.faces.new((v_c3, v_c4, v_r1, v_r2)) # Back slope
    bm.faces.new((v_c4, v_c1, v_r1))       # Left hip slope
    
    bm.to_mesh(roof_mesh)
    bm.free()
    
    roof_obj = bpy.data.objects.new("RAED_Roof", roof_mesh)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.data.materials.append(mat_roof)
    roof_obj.parent = root
    
    # Deep Charcoal Fascia Boards along all 4 perimeter eaves (IMG_3811, IMG_3812)
    fascia_h = 0.30
    fascia_z = EAVE_Z - fascia_h/2
    fascia_t = 0.06
    
    create_box("RAED_Fascia_Front", (0, ry_min, fascia_z), (total_roof_w, fascia_t, fascia_h), mat_fascia, root)
    create_box("RAED_Fascia_Back", (0, ry_max, fascia_z), (total_roof_w, fascia_t, fascia_h), mat_fascia, root)
    create_box("RAED_Fascia_Left", (rx_min, 0, fascia_z), (fascia_t, total_roof_d, fascia_h), mat_fascia, root)
    create_box("RAED_Fascia_Right", (rx_max, 0, fascia_z), (fascia_t, total_roof_d, fascia_h), mat_fascia, root)
    
    # Central Ridge Cap along roof apex (IMG_3811)
    create_box("RAED_RidgeCap_Main", (0, 0, RIDGE_Z + 0.02), (ridge_len + 0.4, 0.40, 0.05), mat_ridge, root)
    
    # Underside Eave Soffits
    create_box("RAED_Soffit_Front", (0, -TOTAL_D/2 - OVERHANG/2, EAVE_Z - 0.04), (total_roof_w - 0.1, OVERHANG, 0.04), mat_soffit, root)
    create_box("RAED_Soffit_Back", (0, TOTAL_D/2 + OVERHANG/2, EAVE_Z - 0.04), (total_roof_w - 0.1, OVERHANG, 0.04), mat_soffit, root)

    # 12. RULE 4 COMPLIANCE:
    # STRICTLY ZERO OUTDOOR PROPS.
    # No pathway slab, no road curbs, no grass cylinders, no red hedge squares, no external bushes.
    # Architectural building model is completely clean and self-contained!

    # 13. Lighting & Ambience
    for obj in list(bpy.data.objects):
        if obj.name.startswith("RAED_Light_"):
            bpy.data.objects.remove(obj, do_unlink=True)
            
    l_data = bpy.data.lights.new(name="RAED_Light_Data", type='POINT')
    l_data.energy = 85.0
    l_data.color = (1.0, 0.95, 0.88)
    l_obj = bpy.data.objects.new("RAED_Light_0", l_data)
    bpy.context.scene.collection.objects.link(l_obj)
    l_obj.location = (0, canopy_center_y, canopy_top_z - 0.4)
    l_obj.parent = root

    # 14. Export Web-Optimized GLB Scene
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    
    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\raed_building.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"Exported Authentic Clean RAED Building GLB to {glb_out} (Size: {file_size_kb:.1f} KB)")
    return root

build_raed_building()
