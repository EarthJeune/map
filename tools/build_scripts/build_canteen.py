"""
build_canteen.py - Authentic 3D Model of D.A. Canteen
Built strictly from reference photographs:
1. IMG_3793 (Front Elevation):
   - 4-sided Hipped Roof with weathered sage green corrugated metal sheeting
   - Deep charcoal/dark brown fascia boards and perimeter eave overhang
   - Warm cream/beige masonry walls with terracotta base plinth skirt
   - Prominent "D.A. CANTEEN" acrylic signboard with bold navy blue lettering above the right window
   - Double glass sliding entrance door with "OPEN" badge and transom glass
   - Horizontal clerestory ribbon windows on the left
   - Selecta ice cream promotional banner under display window
   - Concrete sidewalk, lawn, and square stepping stones
2. IMG_3794 (South-West Corner Elevation):
   - High clerestory ribbon window running along the side wall
   - Corner concrete access steps with 3 risers
   - Corner pilasters and landscape hedge bushes
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

def create_cylinder(name, loc, radius, height, mat, segments=16, parent=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=height)
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = loc
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_canteen():
    print("Building Authentic D.A. Canteen from IMG_3793 & IMG_3794...")
    
    # 1. Clean existing Canteen objects
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Canteen_"):
            bpy.data.objects.remove(obj, do_unlink=True)
    for c in list(bpy.data.collections):
        if c.name.startswith("Canteen_"):
            bpy.data.collections.remove(c)
            
    root = bpy.data.objects.new("Canteen_Building", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (0, 0, 0)
    
    # 2. Materials
    # Walls & Architecture (IMG_3793, IMG_3794)
    mat_wall = create_mat("Mat_Can_Wall", (0.92, 0.89, 0.82), roughness=0.85)
    mat_pilaster = create_mat("Mat_Can_Pilaster", (0.95, 0.93, 0.88), roughness=0.80)
    mat_plinth_skirt = create_mat("Mat_Can_PlinthSkirt", (0.62, 0.28, 0.22), roughness=0.90) # Red base skirt line
    mat_plinth = create_mat("Mat_Can_Plinth", (0.58, 0.57, 0.54), roughness=0.92) # Concrete slab base
    
    # Roof (IMG_3793, IMG_3794) - Weathered sage green corrugated metal with charcoal fascia
    mat_roof = create_mat("Mat_Can_Roof", (0.28, 0.42, 0.32), roughness=0.55, metallic=0.15)
    mat_ridge = create_mat("Mat_Can_Ridge", (0.24, 0.36, 0.28), roughness=0.60)
    mat_fascia = create_mat("Mat_Can_Fascia", (0.18, 0.16, 0.15), roughness=0.75)
    mat_soffit = create_mat("Mat_Can_Soffit", (0.22, 0.20, 0.19), roughness=0.85)
    
    # Openings & Fenestration (Dark green-bronze frames matching IMG_3793 & IMG_3794)
    mat_frame = create_mat("Mat_Can_Frame", (0.14, 0.30, 0.20), roughness=0.45, metallic=0.40)
    mat_door_frame = create_mat("Mat_Can_DoorFrame", (0.80, 0.82, 0.85), roughness=0.30, metallic=0.85) # Brushed aluminum
    mat_glass = create_mat("Mat_Can_Glass", (0.15, 0.22, 0.28), roughness=0.10)
    mat_door_glass = create_mat("Mat_Can_DoorGlass", (0.18, 0.28, 0.35), roughness=0.10, emission_color=(0.14, 0.22, 0.28), emission_strength=0.5)
    
    # Signage & Posters (IMG_3793)
    mat_sign_board = create_mat("Mat_Can_SignBoard", (0.96, 0.96, 0.98), roughness=0.20)
    mat_sign_text = create_mat("Mat_Can_SignText", (0.06, 0.22, 0.60), roughness=0.30, emission_color=(0.06, 0.22, 0.60), emission_strength=0.9) # Navy Blue
    mat_poster = create_mat("Mat_Can_Poster", (0.06, 0.22, 0.55), roughness=0.45, emission_color=(0.06, 0.20, 0.50), emission_strength=0.6) # Selecta Navy Banner
    mat_poster_gold = create_mat("Mat_Can_PosterGold", (0.95, 0.78, 0.15), roughness=0.35, emission_color=(0.95, 0.78, 0.15), emission_strength=0.8) # Selecta Gold/Yellow
    mat_open_badge = create_mat("Mat_Can_OpenBadge", (0.15, 0.65, 0.25), roughness=0.30, emission_color=(0.15, 0.70, 0.25), emission_strength=1.2)
    mat_pot = create_mat("Mat_Can_Pot", (0.35, 0.20, 0.15), roughness=0.85)
    
    # Sidewalk, Stepping Stones & Landscaping
    mat_concrete = create_mat("Mat_Can_Concrete", (0.72, 0.70, 0.66), roughness=0.90)
    mat_hedge = create_mat("Mat_Can_Hedge", (0.18, 0.38, 0.18), roughness=0.70)
    
    # 3. Dimensions
    TOTAL_W = 13.20 # Along X (facade width)
    TOTAL_D = 12.00 # Along Y (building depth)
    WALL_H = 3.35
    PLINTH_H = 0.35
    SKIRT_H = 0.22
    EAVE_Z = PLINTH_H + WALL_H # 3.70m
    RIDGE_H = 2.45
    RIDGE_Z = EAVE_Z + RIDGE_H # 6.15m
    OVERHANG = 1.15
    
    # 4. Foundation Plinth Slab & Terracotta Skirt Line (IMG_3793, IMG_3794)
    create_box("Canteen_Plinth_Base", (0, 0, PLINTH_H/2), (TOTAL_W + 0.4, TOTAL_D + 0.4, PLINTH_H), mat_plinth, root)
    create_box("Canteen_Plinth_Skirt", (0, 0, PLINTH_H + SKIRT_H/2), (TOTAL_W + 0.05, TOTAL_D + 0.05, SKIRT_H), mat_plinth_skirt, root)

    # 5. Main Masonry Body
    body_z = PLINTH_H + SKIRT_H + (WALL_H - SKIRT_H)/2
    body_h = WALL_H - SKIRT_H
    create_box("Canteen_Main_Masonry", (0, 0, body_z), (TOTAL_W, TOTAL_D, body_h), mat_wall, root)

    # Corner Pilasters / Architectural Column Piers (IMG_3793, IMG_3794)
    pil_w = 0.42
    pil_d = 0.42
    for px in [-TOTAL_W/2 + pil_w/2, TOTAL_W/2 - pil_w/2]:
        for py in [-TOTAL_D/2 + pil_d/2, TOTAL_D/2 - pil_d/2]:
            create_box(f"Canteen_Pilaster_{px:.1f}_{py:.1f}", (px, py, PLINTH_H + WALL_H/2), (pil_w, pil_d, WALL_H), mat_pilaster, root)

    # Intermediate Wall Piers
    for px in [-0.9, 5.1]:
        create_box(f"Canteen_Pier_F_{px:.1f}", (px, -TOTAL_D/2 - 0.04, PLINTH_H + WALL_H/2), (0.36, 0.12, WALL_H), mat_pilaster, root)

    # -------------------------------------------------------------------------
    # 6. FRONT FACADE (Facing -Y, matching IMG_3793)
    # -------------------------------------------------------------------------
    fy = -TOTAL_D/2 - 0.02
    
    # (a) Left Horizontal Clerestory Ribbon Window Band (IMG_3793: from X = -5.8 to X = -1.1)
    ribbon_w = 4.70
    ribbon_h = 0.95
    ribbon_cx = -3.45
    ribbon_z = PLINTH_H + 2.65
    create_box("Canteen_WinRibbon_Frame", (ribbon_cx, fy, ribbon_z), (ribbon_w, 0.10, ribbon_h), mat_frame, root)
    create_box("Canteen_WinRibbon_Glass", (ribbon_cx, fy - 0.01, ribbon_z), (ribbon_w - 0.08, 0.04, ribbon_h - 0.08), mat_glass, root)
    # 4 Vertical Mullions dividing ribbon window
    for mi in range(4):
        mx = ribbon_cx - ribbon_w/2 + 0.95 + mi * 0.95
        create_box(f"Canteen_WinRibbon_Mullion_{mi}", (mx, fy - 0.02, ribbon_z), (0.05, 0.08, ribbon_h), mat_frame, root)

    # (b) Entrance Single Glass Aluminum Door (IMG_3793: center at X = 1.35)
    door_w = 1.15
    door_h = 2.20
    door_cx = 1.35
    door_z = PLINTH_H + door_h/2
    # Aluminum Outer Door Frame
    create_box("Canteen_Door_Frame", (door_cx, fy, door_z), (door_w, 0.10, door_h), mat_door_frame, root)
    # Glass Door Leaf
    create_box("Canteen_Door_Glass", (door_cx, fy - 0.01, door_z), (door_w - 0.12, 0.04, door_h - 0.14), mat_door_glass, root)
    # Vertical Door Handle Bar (Silver Aluminum)
    create_box("Canteen_Door_Handle", (door_cx - 0.42, fy - 0.04, PLINTH_H + 1.10), (0.04, 0.05, 0.55), mat_door_frame, root)
    # "OPEN" Sign Badge on Door Glass (IMG_3793)
    create_box("Canteen_Door_OpenSign", (door_cx, fy - 0.03, PLINTH_H + 1.45), (0.28, 0.02, 0.18), mat_open_badge, root)
    # Transom Window above door (IMG_3793)
    create_box("Canteen_Door_Transom_F", (door_cx, fy, PLINTH_H + door_h + 0.28), (door_w, 0.08, 0.48), mat_frame, root)
    create_box("Canteen_Door_Transom_G", (door_cx, fy - 0.01, PLINTH_H + door_h + 0.28), (door_w - 0.08, 0.04, 0.42), mat_door_glass, root)

    # (c) Display Window to Left of Door with Selecta Poster (IMG_3793: from X = -0.7 to X = 0.5)
    win_left_w = 1.25
    win_left_h = 1.35
    win_left_cx = -0.10
    win_left_z = PLINTH_H + 2.35
    create_box("Canteen_WinLeft_Frame", (win_left_cx, fy, win_left_z), (win_left_w, 0.10, win_left_h), mat_frame, root)
    create_box("Canteen_WinLeft_Glass", (win_left_cx, fy - 0.01, win_left_z), (win_left_w - 0.08, 0.04, win_left_h - 0.08), mat_glass, root)
    # Selecta Ice Cream Promotional Poster Banner below window (IMG_3793)
    poster_w = win_left_w - 0.06
    poster_h = 0.85
    poster_z = PLINTH_H + 1.15
    create_box("Canteen_Selecta_Poster", (win_left_cx, fy - 0.02, poster_z), (poster_w, 0.02, poster_h), mat_poster, root)
    create_box("Canteen_Selecta_Stripe", (win_left_cx, fy - 0.03, poster_z + 0.15), (poster_w - 0.2, 0.015, 0.18), mat_poster_gold, root)

    # (d) Large Display Window to Right of Door (IMG_3793: from X = 2.2 to X = 4.8)
    win_right_w = 2.55
    win_right_h = 1.35
    win_right_cx = 3.55
    win_right_z = PLINTH_H + 1.95
    create_box("Canteen_WinRight_Frame", (win_right_cx, fy, win_right_z), (win_right_w, 0.10, win_right_h), mat_frame, root)
    create_box("Canteen_WinRight_Glass", (win_right_cx, fy - 0.01, win_right_z), (win_right_w - 0.08, 0.04, win_right_h - 0.08), mat_glass, root)
    create_box("Canteen_WinRight_Mullion", (win_right_cx, fy - 0.02, win_right_z), (0.06, 0.08, win_right_h), mat_frame, root)

    # Potted Plant beside entrance apron (IMG_3793)
    create_cylinder("Canteen_Plant_Pot", (0.55, -TOTAL_D/2 - 0.40, PLINTH_H + 0.25), 0.22, 0.45, mat_pot, 12, root)
    create_box("Canteen_Plant_Leaves", (0.55, -TOTAL_D/2 - 0.40, PLINTH_H + 0.65), (0.55, 0.55, 0.45), mat_hedge, root)
    create_box("Canteen_WinRight_Mullion", (win_right_cx, fy - 0.02, win_right_z), (0.06, 0.08, win_right_h), mat_frame, root)

    # (e) OFFICIAL "D.A. CANTEEN" ACRYLIC SIGNBOARD (Mounted directly above the right window, IMG_3793)
    sign_w = 2.45
    sign_h = 0.48
    sign_cx = win_right_cx # 3.60m
    sign_z = PLINTH_H + 2.92 # Directly above window frame
    # Signboard Backing Plate (Clean white acrylic)
    create_box("Canteen_Sign_Board", (sign_cx, fy - 0.03, sign_z), (sign_w, 0.03, sign_h), mat_sign_board, root)
    create_box("Canteen_Sign_Border", (sign_cx, fy - 0.02, sign_z), (sign_w + 0.06, 0.02, sign_h + 0.06), mat_frame, root)
    # Embossed Bold Blue Lettering: "D.A. CANTEEN"
    # Modeled as clean 3D typography plates on the board face
    letters = [
        ("D", sign_cx - 0.96, 0.14),
        ("Dot1", sign_cx - 0.81, 0.04),
        ("A", sign_cx - 0.66, 0.14),
        ("Dot2", sign_cx - 0.51, 0.04),
        ("C", sign_cx - 0.28, 0.14),
        ("A2", sign_cx - 0.08, 0.14),
        ("N", sign_cx + 0.12, 0.14),
        ("T", sign_cx + 0.32, 0.14),
        ("E", sign_cx + 0.52, 0.14),
        ("E2", sign_cx + 0.72, 0.14),
        ("N2", sign_cx + 0.92, 0.14)
    ]
    for l_id, lx, lw in letters:
        lh = 0.26 if not l_id.startswith("Dot") else 0.06
        lz = sign_z if not l_id.startswith("Dot") else sign_z - 0.08
        create_box(f"Canteen_Sign_Letter_{l_id}", (lx, fy - 0.05, lz), (lw, 0.02, lh), mat_sign_text, root)

    # -------------------------------------------------------------------------
    # 7. SIDE & REAR FENESTRATION (IMG_3794)
    # -------------------------------------------------------------------------
    # West Side Facade (-X, facing approach steps in IMG_3794)
    # High ribbon clerestory windows along the side wall
    for wy in [-3.0, 0.0, 3.0]:
        create_box(f"Canteen_Win_W_{wy:.1f}_F", (-TOTAL_W/2 - 0.02, wy, PLINTH_H + 2.65), (0.10, 2.20, 0.95), mat_frame, root)
        create_box(f"Canteen_Win_W_{wy:.1f}_G", (-TOTAL_W/2 - 0.03, wy, PLINTH_H + 2.65), (0.04, 2.10, 0.85), mat_glass, root)

    # East Side Facade (+X, facing Tanco Hall)
    for wy in [-2.5, 2.5]:
        create_box(f"Canteen_Win_E_{wy:.1f}_F", (TOTAL_W/2 + 0.02, wy, PLINTH_H + 2.65), (0.10, 2.20, 0.95), mat_frame, root)
        create_box(f"Canteen_Win_E_{wy:.1f}_G", (TOTAL_W/2 + 0.03, wy, PLINTH_H + 2.65), (0.04, 2.10, 0.85), mat_glass, root)

    # Rear Facade (+Y, service entrance)
    for wx in [-3.5, 3.5]:
        create_box(f"Canteen_Win_B_{wx:.1f}_F", (wx, TOTAL_D/2 + 0.02, PLINTH_H + 2.20), (1.80, 0.10, 1.20), mat_frame, root)
        create_box(f"Canteen_Win_B_{wx:.1f}_G", (wx, TOTAL_D/2 + 0.03, PLINTH_H + 2.20), (1.70, 0.04, 1.10), mat_glass, root)
    create_box("Canteen_Door_Rear", (0, TOTAL_D/2 + 0.02, PLINTH_H + 1.10), (1.10, 0.10, 2.10), mat_frame, root)

    # -------------------------------------------------------------------------
    # 8. FOUR-SIDED HIPPED ROOF (IMG_3793, IMG_3794)
    # -------------------------------------------------------------------------
    # Authentic weathered sage green corrugated pyramidal hipped roof
    rx_min = -TOTAL_W/2 - OVERHANG
    rx_max = TOTAL_W/2 + OVERHANG
    ry_min = -TOTAL_D/2 - OVERHANG
    ry_max = TOTAL_D/2 + OVERHANG
    
    # Short central ridge peak
    ridge_len = (rx_max - rx_min) - (ry_max - ry_min)
    if ridge_len < 1.6:
        ridge_len = 2.0
    ridge_x1 = -ridge_len / 2
    ridge_x2 = ridge_len / 2
    ridge_y = 0.0
    
    roof_mesh = bpy.data.meshes.new("Canteen_Roof_Mesh")
    bm = bmesh.new()
    
    v_c1 = bm.verts.new((rx_min, ry_min, EAVE_Z))
    v_c2 = bm.verts.new((rx_max, ry_min, EAVE_Z))
    v_c3 = bm.verts.new((rx_max, ry_max, EAVE_Z))
    v_c4 = bm.verts.new((rx_min, ry_max, EAVE_Z))
    
    v_r1 = bm.verts.new((ridge_x1, ridge_y, RIDGE_Z))
    v_r2 = bm.verts.new((ridge_x2, ridge_y, RIDGE_Z))
    
    bm.faces.new((v_c1, v_c2, v_r2, v_r1)) # Front slope (facing front entrance)
    bm.faces.new((v_c2, v_c3, v_r2))       # Right hip slope
    bm.faces.new((v_c3, v_c4, v_r1, v_r2)) # Back slope
    bm.faces.new((v_c4, v_c1, v_r1))       # Left hip slope
    
    bm.to_mesh(roof_mesh)
    bm.free()
    
    roof_obj = bpy.data.objects.new("Canteen_Roof", roof_mesh)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.data.materials.append(mat_roof)
    roof_obj.parent = root
    
    # Deep Charcoal Fascia Boards along all 4 perimeter eaves (IMG_3793, IMG_3794)
    fascia_h = 0.28
    fascia_z = EAVE_Z - fascia_h/2
    fascia_t = 0.06
    total_roof_w = rx_max - rx_min
    total_roof_d = ry_max - ry_min
    
    create_box("Canteen_Fascia_Front", (0, ry_min, fascia_z), (total_roof_w, fascia_t, fascia_h), mat_fascia, root)
    create_box("Canteen_Fascia_Back", (0, ry_max, fascia_z), (total_roof_w, fascia_t, fascia_h), mat_fascia, root)
    create_box("Canteen_Fascia_Left", (rx_min, 0, fascia_z), (fascia_t, total_roof_d, fascia_h), mat_fascia, root)
    create_box("Canteen_Fascia_Right", (rx_max, 0, fascia_z), (fascia_t, total_roof_d, fascia_h), mat_fascia, root)
    
    # Ridge Cap along peak (IMG_3793)
    create_box("Canteen_RidgeCap_Main", (0, 0, RIDGE_Z + 0.02), (ridge_len + 0.4, 0.35, 0.05), mat_ridge, root)
    
    # Underside Eave Soffits (IMG_3793)
    create_box("Canteen_Soffit_F", (0, -TOTAL_D/2 - OVERHANG/2, EAVE_Z - 0.04), (total_roof_w - 0.1, OVERHANG, 0.04), mat_soffit, root)
    create_box("Canteen_Soffit_B", (0, TOTAL_D/2 + OVERHANG/2, EAVE_Z - 0.04), (total_roof_w - 0.1, OVERHANG, 0.04), mat_soffit, root)

    # -------------------------------------------------------------------------
    # 9. CONCRETE SIDEWALK, STEPPING STONES & ACCESS STEPS (IMG_3793, IMG_3794)
    # -------------------------------------------------------------------------
    # Front Sidewalk Apron Walkway (IMG_3793) - Confined to building width
    walk_w = TOTAL_W
    walk_d = 1.60
    walk_cy = -TOTAL_D/2 - walk_d/2 - 0.05
    create_box("Canteen_Sidewalk_Front", (0, walk_cy, 0.08), (walk_w, walk_d, 0.16), mat_concrete, root)


    # Low Foundation Hedge Shrubs along front perimeter (IMG_3793, IMG_3794)
    hedge_w = 0.45
    hedge_h = 0.55
    hedge_z = PLINTH_H + hedge_h/2
    for hx in [-5.2, -4.2, -3.2, -2.2, 2.6, 3.6, 4.6, 5.6]:
        create_box(f"Canteen_Hedge_{hx:.1f}", (hx, -TOTAL_D/2 - 0.35, hedge_z), (0.85, hedge_w, hedge_h), mat_hedge, root)

    # 10. Warm Interior Downlights (adds life shining through windows and glass door)
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Canteen_Light_"):
            bpy.data.objects.remove(obj, do_unlink=True)
            
    l_data = bpy.data.lights.new(name="Canteen_Light_Data", type='POINT')
    l_data.energy = 85.0
    l_data.color = (1.0, 0.94, 0.86)
    l_obj = bpy.data.objects.new("Canteen_Light_0", l_data)
    bpy.context.scene.collection.objects.link(l_obj)
    l_obj.location = (door_cx, -2.5, EAVE_Z - 0.3)
    l_obj.parent = root

    # 11. Export GLB Scene
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    
    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\canteen.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"Exported Authentic D.A. Canteen GLB to {glb_out} (Size: {file_size_kb:.1f} KB)")
    return root

build_canteen()

