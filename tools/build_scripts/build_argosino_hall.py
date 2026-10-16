"""
build_argosino_hall.py - Re-built with authentic dual-space layout matching:
1. IMG_3791 (Veranda Kiosk Lounge):
   - Kiosk facing entrance with barred window behind it
   - Swivel desk chair to the left of the kiosk
   - Commemorative gold/navy plaque on the wall to the left of the chair
   - "A way to the left" (open portal leading into the entrance corridor)
   - Presentation whiteboard with white glossy face and conference cantilever chairs to the right
2. IMG_3792 (Entrance Corridor down that way to the left):
   - Straight ahead down the corridor: Double glass entrance doors with posters & transom
   - Right wall: Shared wall with the veranda (plaque corner, window, chair)
   - Left side: Low half-wall open to the outside garden and plants
3. Front Elevation:
   - Main masonry hall on the left with 3 ribbon windows
   - Covered entrance veranda on the right with the corridor on its left side and lounge on its right
   - Walkway connector canopy ("Blue Small Roof") branching off to the right towards Tanco Hall
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

def create_kiosk(name, loc, rot_z, parent, mat_chassis, mat_screen, mat_logo, mat_badge, mat_gold):
    """
    Builds the authentic standing interactive kiosk as photographed in IMG_3791.
    """
    kiosk_group = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(kiosk_group)
    kiosk_group.location = loc
    kiosk_group.rotation_euler = (0, 0, rot_z)
    if parent:
        kiosk_group.parent = parent

    # 1. Base Plate (flat steel floor base)
    base_w = 0.94
    base_d = 0.60
    base_h = 0.035
    create_box(f"{name}_BasePlate", (0, 0, base_h/2), (base_w, base_d, base_h), mat_chassis, kiosk_group)

    # 2. Sleek Continuous Monolith Chassis with 45-degree Chamfered Top Shoulders
    mesh = bpy.data.meshes.new(f"{name}_Body_Mesh")
    bm = bmesh.new()
    
    hw = 0.80 / 2 # 0.40m half-width
    hd = 0.24 / 2 # 0.12m half-depth
    z_bot = base_h
    z_chamfer = 1.54
    z_top = 1.82
    chamfer_inset = 0.16
    
    # Front vertices (Y = +hd)
    vf1 = bm.verts.new((-hw, hd, z_bot))
    vf2 = bm.verts.new((hw, hd, z_bot))
    vf3 = bm.verts.new((hw, hd, z_chamfer))
    vf4 = bm.verts.new((hw - chamfer_inset, hd, z_top))
    vf5 = bm.verts.new((-hw + chamfer_inset, hd, z_top))
    vf6 = bm.verts.new((-hw, hd, z_chamfer))
    
    # Back vertices (Y = -hd)
    vb1 = bm.verts.new((-hw, -hd, z_bot))
    vb2 = bm.verts.new((hw, -hd, z_bot))
    vb3 = bm.verts.new((hw, -hd, z_chamfer))
    vb4 = bm.verts.new((hw - chamfer_inset, -hd, z_top))
    vb5 = bm.verts.new((-hw + chamfer_inset, -hd, z_top))
    vb6 = bm.verts.new((-hw, -hd, z_chamfer))
    
    # Faces
    bm.faces.new((vf1, vf2, vf3, vf4, vf5, vf6)) # Front
    bm.faces.new((vb6, vb5, vb4, vb3, vb2, vb1)) # Back
    bm.faces.new((vf1, vb1, vb2, vf2))             # Bottom
    bm.faces.new((vf2, vb2, vb3, vf3))             # Right side
    bm.faces.new((vf3, vb3, vb4, vf4))             # Right chamfer
    bm.faces.new((vf4, vb4, vb5, vf5))             # Top flat
    bm.faces.new((vf5, vb5, vb6, vf6))             # Left chamfer
    bm.faces.new((vf6, vb6, vb1, vf1))             # Left side
    
    bm.to_mesh(mesh)
    bm.free()
    
    body_obj = bpy.data.objects.new(f"{name}_Body", mesh)
    bpy.context.scene.collection.objects.link(body_obj)
    body_obj.data.materials.append(mat_chassis)
    body_obj.parent = kiosk_group

    # 3. Top Header: Department of Agriculture Seal (IMG_3791)
    logo_z = 1.67
    logo_y = hd + 0.008
    ring_obj = create_cylinder(f"{name}_DALogoRing", (0, logo_y, logo_z), radius=0.054, height=0.008, mat=mat_gold, segments=24, parent=kiosk_group)
    ring_obj.rotation_euler = (math.radians(90), 0, 0)
    logo_obj = create_cylinder(f"{name}_DALogoDisc", (0, logo_y + 0.004, logo_z), radius=0.048, height=0.008, mat=mat_logo, segments=24, parent=kiosk_group)
    logo_obj.rotation_euler = (math.radians(90), 0, 0)

    # 4. Portrait Touchscreen (Glowing Interactive UI from IMG_3791)
    screen_w = 0.54
    screen_h = 0.92
    screen_z = 1.05
    screen_y = hd + 0.006
    
    create_box(f"{name}_ScreenBezel", (0, screen_y, screen_z), (screen_w + 0.04, 0.012, screen_h + 0.04), mat_chassis, kiosk_group)
    create_box(f"{name}_ScreenGlass", (0, screen_y + 0.006, screen_z), (screen_w, 0.006, screen_h), mat_screen, kiosk_group)
    
    mat_clock = create_mat("Mat_Arg_Kiosk_Clock", (0.08, 0.16, 0.28), roughness=0.2, emission_color=(0.15, 0.35, 0.65), emission_strength=2.5)
    create_box(f"{name}_ClockBar", (0, screen_y + 0.010, screen_z + screen_h/2 - 0.045), (screen_w - 0.02, 0.004, 0.07), mat_clock, kiosk_group)
    
    mat_banner = create_mat("Mat_Arg_Kiosk_Banner", (0.12, 0.68, 0.30), roughness=0.25, emission_color=(0.18, 0.85, 0.38), emission_strength=3.0)
    create_box(f"{name}_Banner", (0, screen_y + 0.010, screen_z + screen_h/2 - 0.135), (screen_w - 0.02, 0.004, 0.09), mat_banner, kiosk_group)
    
    mat_ui_cards = create_mat("Mat_Arg_Kiosk_Cards", (0.88, 0.94, 0.98), roughness=0.15, emission_color=(0.85, 0.92, 0.98), emission_strength=1.8)
    create_box(f"{name}_UICards", (0, screen_y + 0.010, screen_z - 0.05), (screen_w - 0.02, 0.004, 0.58), mat_ui_cards, kiosk_group)
    
    mat_dock = create_mat("Mat_Arg_Kiosk_Dock", (0.06, 0.14, 0.26), roughness=0.3, emission_color=(0.10, 0.24, 0.45), emission_strength=2.0)
    create_box(f"{name}_UIDock", (0, screen_y + 0.010, screen_z - screen_h/2 + 0.035), (screen_w - 0.02, 0.004, 0.05), mat_dock, kiosk_group)

    # 5. Lower Cabinet Panel: Circular MIS System Badge (IMG_3791)
    badge_z = 0.32
    badge_y = hd + 0.006
    badge_ring = create_cylinder(f"{name}_BadgeRing", (0, badge_y, badge_z), radius=0.092, height=0.006, mat=mat_gold, segments=24, parent=kiosk_group)
    badge_ring.rotation_euler = (math.radians(90), 0, 0)
    badge_disc = create_cylinder(f"{name}_BadgeDisc", (0, badge_y + 0.003, badge_z), radius=0.084, height=0.006, mat=mat_badge, segments=24, parent=kiosk_group)
    badge_disc.rotation_euler = (math.radians(90), 0, 0)

    return kiosk_group

def create_swivel_chair(name, loc, parent, mat_chair, mat_frame):
    """Office swivel desk chair photographed next to kiosk in IMG_3791."""
    chair_group = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(chair_group)
    chair_group.location = loc
    if parent:
        chair_group.parent = parent
        
    create_cylinder(f"{name}_Base_Hub", (0, 0, 0.08), radius=0.06, height=0.08, mat=mat_frame, segments=12, parent=chair_group)
    for sp in range(5):
        ang = sp * (2 * math.pi / 5)
        bx = 0.20 * math.cos(ang)
        by = 0.20 * math.sin(ang)
        create_box(f"{name}_Spoke_{sp}", (bx, by, 0.06), (0.04, 0.38, 0.03), mat_frame, chair_group)
        bpy.data.objects.get(f"{name}_Spoke_{sp}").rotation_euler = (0, 0, ang)
        create_cylinder(f"{name}_Wheel_{sp}", (bx * 1.8, by * 1.8, 0.03), radius=0.025, height=0.03, mat=mat_frame, segments=8, parent=chair_group)
        
    create_cylinder(f"{name}_Stem", (0, 0, 0.24), radius=0.035, height=0.24, mat=mat_frame, segments=12, parent=chair_group)
    create_box(f"{name}_Seat", (0, 0, 0.44), (0.48, 0.46, 0.08), mat_chair, chair_group)
    create_box(f"{name}_Back", (0, 0.21, 0.76), (0.44, 0.05, 0.52), mat_chair, chair_group)
    create_box(f"{name}_Arm_L", (-0.26, 0, 0.60), (0.04, 0.32, 0.03), mat_frame, chair_group)
    create_box(f"{name}_Arm_R", (0.26, 0, 0.60), (0.04, 0.32, 0.03), mat_frame, chair_group)
    return chair_group

def build_argosino_hall():
    print("Building Authentic Argosino Hall (IMG_3791 Lounge + IMG_3792 Corridor to the Left)...")
    
    # 1. Clean existing Argosino objects and materials
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Argosino_"):
            bpy.data.objects.remove(obj, do_unlink=True)
    for c in list(bpy.data.collections):
        if c.name.startswith("Argosino_"):
            bpy.data.collections.remove(c)
            
    root = bpy.data.objects.new("Argosino_Hall", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (0, 0, 0)
    
    # 2. Materials
    mat_wall = create_mat("Mat_Arg_Wall", (0.93, 0.91, 0.84), roughness=0.85)
    mat_pilaster = create_mat("Mat_Arg_Pilaster", (0.97, 0.96, 0.92), roughness=0.80)
    mat_plinth = create_mat("Mat_Arg_Plinth", (0.58, 0.57, 0.54), roughness=0.92)
    mat_tile = create_mat("Mat_Arg_Tile", (0.68, 0.29, 0.18), roughness=0.45)
    # Argosino Hall: Green metal roof with authentic RED sides/fascia (IMG_3790)
    mat_roof = create_mat("Mat_Arg_Roof", (0.25, 0.40, 0.30), roughness=0.52, metallic=0.15)
    mat_fascia = create_mat("Mat_Arg_Fascia", (0.52, 0.15, 0.12), roughness=0.70) # RED sides/fascia
    mat_ridge = create_mat("Mat_Arg_Ridge", (0.48, 0.13, 0.11), roughness=0.65)   # RED trim/ridge cap
    # Covered Walkway Connector from Tanco Hall
    mat_walkway_roof = create_mat("Mat_Arg_Walkway_Roof", (0.25, 0.40, 0.30), roughness=0.50, metallic=0.15)
    mat_walkway_fascia = create_mat("Mat_Arg_Walkway_Fascia", (0.18, 0.32, 0.22), roughness=0.65)
    mat_soffit = create_mat("Mat_Arg_Soffit", (0.94, 0.94, 0.92), roughness=0.85)
    mat_glass = create_mat("Mat_Arg_Glass", (0.12, 0.18, 0.24), roughness=0.10)
    mat_door_glass = create_mat("Mat_Arg_DoorGlass", (0.18, 0.28, 0.36), roughness=0.10, emission_color=(0.15, 0.25, 0.35), emission_strength=0.8)
    mat_frame = create_mat("Mat_Arg_Frame", (0.15, 0.16, 0.17), roughness=0.35, metallic=0.7)
    mat_grille = create_mat("Mat_Arg_Grille", (0.88, 0.88, 0.88), roughness=0.30, metallic=0.8) # White/silver security bars
    mat_col = create_mat("Mat_Arg_Col", (0.94, 0.92, 0.86), roughness=0.80)
    
    mat_kiosk_chassis = create_mat("Mat_Arg_Kiosk_Body", (0.08, 0.09, 0.11), roughness=0.30, metallic=0.5)
    mat_kiosk_screen = create_mat("Mat_Arg_Kiosk_Screen", (0.14, 0.55, 0.98), roughness=0.10, emission_color=(0.14, 0.60, 1.0), emission_strength=3.5)
    mat_kiosk_logo = create_mat("Mat_Arg_Kiosk_Logo", (0.18, 0.52, 0.24), roughness=0.3, emission_color=(0.20, 0.65, 0.30), emission_strength=1.5)
    mat_kiosk_badge = create_mat("Mat_Arg_Kiosk_Badge", (0.14, 0.45, 0.82), roughness=0.3, emission_color=(0.18, 0.55, 0.95), emission_strength=2.0)
    mat_gold = create_mat("Mat_Arg_Gold", (0.94, 0.80, 0.25), roughness=0.20, metallic=0.90) # Polished brass/gold
    mat_plaque = create_mat("Mat_Arg_Plaque", (0.05, 0.10, 0.30), roughness=0.25, metallic=0.3) # Deep navy blue board
    mat_poster = create_mat("Mat_Arg_Poster", (0.92, 0.89, 0.78), roughness=0.5, emission_color=(0.90, 0.87, 0.75), emission_strength=0.8)
    mat_pot = create_mat("Mat_Arg_Pot", (0.24, 0.35, 0.24), roughness=0.65)
    mat_leaf1 = create_mat("Mat_Arg_Leaf_Green", (0.18, 0.52, 0.18), roughness=0.6)
    mat_leaf2 = create_mat("Mat_Arg_Leaf_Red", (0.72, 0.20, 0.12), roughness=0.6)
    mat_post = create_mat("Mat_Arg_Post", (0.15, 0.16, 0.18), roughness=0.40, metallic=0.75)
    mat_chair = create_mat("Mat_Arg_Chair", (0.12, 0.12, 0.14), roughness=0.7)
    mat_board = create_mat("Mat_Arg_Board", (0.98, 0.98, 0.98), roughness=0.10, emission_color=(0.95, 0.95, 0.95), emission_strength=0.8) # Glossy white board
    
    # 3. Overall Building Dimensions
    TOTAL_W = 22.4 # Along X
    TOTAL_D = 15.6 # Along Y
    WALL_H = 3.65
    PLINTH_H = 0.35
    EAVE_Z = PLINTH_H + WALL_H
    OVERHANG = 1.10
    
    # 4. Concrete Foundation Plinth
    create_box("Argosino_Plinth_Main", (0, 0, PLINTH_H/2), (TOTAL_W + 0.3, TOTAL_D + 0.3, PLINTH_H), mat_plinth, root)

    # 5. VERANDA & CORRIDOR FLOOR FOOTPRINT ON RIGHT SIDE (+X)
    vx_min = 2.4
    vx_max = TOTAL_W/2 # 11.2
    vy_min = -TOTAL_D/2 # -7.8
    vy_lounge_back = -2.2
    vy_door = 0.2
    
    tile_h = 0.10
    
    # Lounge Floor (from X = 5.0 to 11.2, Y = -7.8 to -2.2)
    fl_w = vx_max - 5.0 # 6.2m
    fl_d = vy_lounge_back - vy_min # 5.6m
    fl_cx = (5.0 + vx_max) / 2 # 8.1
    fl_cy = (vy_min + vy_lounge_back) / 2 # -5.0
    create_box("Argosino_Veranda_Floor", (fl_cx, fl_cy, PLINTH_H + tile_h/2), (fl_w, fl_d, tile_h), mat_tile, root)
    create_box("Argosino_Veranda_Ceiling", (fl_cx, fl_cy, EAVE_Z - 0.05), (fl_w, fl_d, 0.10), mat_soffit, root)
    
    # Corridor Floor (from X = 2.4 to 5.0, extending deeper from Y = -7.8 to vy_door = 0.2)
    corr_w = 5.0 - 2.4 # 2.6m
    corr_d = vy_door - vy_min # 8.0m
    corr_cx = (2.4 + 5.0) / 2 # 3.7
    corr_cy = (vy_min + vy_door) / 2 # -3.8
    create_box("Argosino_Corridor_Floor", (corr_cx, corr_cy, PLINTH_H + tile_h/2), (corr_w, corr_d, tile_h), mat_tile, root)
    create_box("Argosino_Corridor_Ceiling", (corr_cx, corr_cy, EAVE_Z - 0.05), (corr_w, corr_d, 0.10), mat_soffit, root)
    create_box("Argosino_Veranda_Curb", (fl_cx, fl_cy, PLINTH_H + 0.04), (fl_w + 0.20, fl_d + 0.20, 0.08), mat_plinth, root)

    # -------------------------------------------------------------------------
    # 6. SPACE B: THE ENTRANCE CORRIDOR / BREEZEWAY (IMG_3792)
    # -------------------------------------------------------------------------
    # (a) Left Half-Wall Parapet (open to garden above 0.95m, IMG_3792)
    parapet_h = 0.95
    create_box("Argosino_Corridor_Parapet", (2.4, corr_cy, PLINTH_H + parapet_h/2), (0.24, corr_d, parapet_h), mat_wall, root)
    create_box("Argosino_Corridor_Parapet_Cap", (2.4, corr_cy, PLINTH_H + parapet_h + 0.02), (0.32, corr_d + 0.05, 0.05), mat_plinth, root)
    # Columns along the left breezeway
    create_box("Argosino_Col_Corr_Front", (2.4, vy_min + 0.25, PLINTH_H + WALL_H/2), (0.36, 0.36, WALL_H), mat_col, root)
    create_box("Argosino_Col_Corr_Mid", (2.4, -3.8, PLINTH_H + WALL_H/2), (0.36, 0.36, WALL_H), mat_col, root)
    create_box("Argosino_Col_Corr_Back", (2.4, vy_door - 0.18, PLINTH_H + WALL_H/2), (0.36, 0.36, WALL_H), mat_col, root)
    create_box("Argosino_Corridor_HeaderBeam_L", (2.4, corr_cy, EAVE_Z - 0.20), (0.24, corr_d, 0.40), mat_wall, root)

    # (b) Straight Ahead: Double Glass Entrance Doors (IMG_3792: "Ang Bagong Pananaw sa Agrikultura")
    door_w = 2.40
    door_h = 2.50
    door_cx = corr_cx # 3.7
    door_y = vy_door
    door_z = PLINTH_H + door_h/2
    # Frame posts & lintel
    create_box("Argosino_Door_Post_L", (door_cx - door_w/2 + 0.06, door_y, door_z), (0.12, 0.14, door_h), mat_frame, root)
    create_box("Argosino_Door_Post_R", (door_cx + door_w/2 - 0.06, door_y, door_z), (0.12, 0.14, door_h), mat_frame, root)
    create_box("Argosino_Door_Mullion", (door_cx, door_y, door_z), (0.08, 0.14, door_h), mat_frame, root)
    create_box("Argosino_Door_Lintel", (door_cx, door_y, PLINTH_H + door_h - 0.06), (door_w, 0.14, 0.12), mat_frame, root)
    # Glass Panels
    create_box("Argosino_Door_Glass_L", (door_cx - door_w/4, door_y - 0.01, door_z), (door_w/2 - 0.10, 0.04, door_h - 0.15), mat_door_glass, root)
    create_box("Argosino_Door_Glass_R", (door_cx + door_w/4, door_y - 0.01, door_z), (door_w/2 - 0.10, 0.04, door_h - 0.15), mat_door_glass, root)
    # Transom Window above doors
    create_box("Argosino_Door_Transom", (door_cx, door_y, PLINTH_H + door_h + 0.42), (door_w, 0.10, 0.70), mat_door_glass, root)
    # Posters on doors (IMG_3792: "Ang Bagong Pananaw sa Agrikultura")
    create_box("Argosino_Door_Poster_L", (door_cx - door_w/4, door_y - 0.04, door_z), (0.75, 0.02, 1.25), mat_poster, root)
    create_box("Argosino_Door_Poster_R", (door_cx + door_w/4, door_y - 0.04, door_z), (0.75, 0.02, 1.25), mat_poster, root)

    # (c) Right Wall of the Corridor (from Y = -2.2 deeper to Y = vy_door = 0.2)
    r_wall_d = vy_door - vy_lounge_back # 2.4m
    r_wall_cy = (vy_lounge_back + vy_door) / 2 # -1.0
    create_box("Argosino_Corridor_Wall_R", (5.0, r_wall_cy, PLINTH_H + WALL_H/2), (0.24, r_wall_d, WALL_H), mat_wall, root)

    # -------------------------------------------------------------------------
    # 7. SPACE A: THE VERANDA KIOSK & PRESENTATION LOUNGE (IMG_3791)
    # -------------------------------------------------------------------------
    # Back Wall Masonry from X = 5.0 to 11.2 (front surface at Y = vy_lounge_back = -2.20)
    create_box("Argosino_Lounge_BackWall", (fl_cx, vy_lounge_back + 0.12, PLINTH_H + WALL_H/2), (fl_w, 0.24, WALL_H), mat_wall, root)

    # Overhead Lintel across the open way to the corridor (at Y = -2.2, X = 2.4 to 5.0)
    create_box("Argosino_Passage_Lintel", (corr_cx, vy_lounge_back + 0.12, EAVE_Z - 0.20), (corr_w, 0.24, 0.40), mat_wall, root)

    # Commemorative Plaque (IMG_3791, on the back wall at X = 5.6, Y = -2.2, facing -Y):
    # Authentic Gold Outer Frame with Deep Navy Blue Center Board & Gold Lettering Lines
    plaque_w = 0.85
    plaque_h = 1.20
    plaque_x = 5.60
    plaque_y = vy_lounge_back # -2.20
    plaque_z = PLINTH_H + 2.05
    create_box("Argosino_Plaque_Frame", (plaque_x, plaque_y - 0.02, plaque_z), (plaque_w + 0.08, 0.03, plaque_h + 0.08), mat_gold, root)
    create_box("Argosino_Plaque_Board", (plaque_x, plaque_y - 0.03, plaque_z), (plaque_w, 0.02, plaque_h), mat_plaque, root)
    # Gold decorative top crest & text bars on plaque
    create_box("Argosino_Plaque_Crest", (plaque_x, plaque_y - 0.045, plaque_z + plaque_h/2 - 0.12), (0.22, 0.015, 0.12), mat_gold, root)
    for ti in range(4):
        create_box(f"Argosino_Plaque_Line_{ti}", (plaque_x, plaque_y - 0.045, plaque_z + 0.15 - ti * 0.12), (0.65 - ti * 0.08, 0.015, 0.04), mat_gold, root)

    # Barred Window (behind the kiosk, centered at X = 7.2, Y = -2.2)
    win_w = 2.20
    win_h = 1.50
    win_x = 7.20
    win_y = vy_lounge_back
    win_z = PLINTH_H + 1.90
    create_box("Argosino_Veranda_Win_Frame", (win_x, win_y - 0.01, win_z), (win_w, 0.14, win_h), mat_frame, root)
    create_box("Argosino_Veranda_Win_Glass", (win_x, win_y - 0.02, win_z), (win_w - 0.1, 0.04, win_h - 0.1), mat_glass, root)
    # 12 Vertical Security Bars (in front of glass, fully visible in lounge!)
    for b in range(12):
        bx = win_x - win_w/2 + 0.12 + b * ((win_w - 0.24) / 11)
        create_box(f"Argosino_Win_Bar_{b}", (bx, win_y - 0.05, win_z), (0.03, 0.02, win_h - 0.06), mat_grille, root)

    # The Authentic Standing Interactive Kiosk ("You are Here", IMG_3791)
    kiosk_loc = (7.2, -3.4, PLINTH_H + tile_h)
    create_kiosk("Argosino_Kiosk", kiosk_loc, math.radians(180), root,
                 mat_kiosk_chassis, mat_kiosk_screen, mat_kiosk_logo, mat_kiosk_badge, mat_gold)

    # Office Swivel Desk Chair (directly to the left of the kiosk, between kiosk and plaque, IMG_3791)
    create_swivel_chair("Argosino_SwivelChair", (6.3, -3.4, PLINTH_H + tile_h), root, mat_chair, mat_frame)

    # Presentation Whiteboard (to the right of kiosk, IMG_3790, IMG_3791)
    wb_x = 9.4
    wb_y = vy_lounge_back - 0.50
    create_box("Argosino_Whiteboard_Frame", (wb_x, wb_y, PLINTH_H + tile_h + 1.45), (2.4, 0.06, 1.3), mat_frame, root)
    # White glossy magnetic face placed in front of frame
    create_box("Argosino_Whiteboard_Face", (wb_x, wb_y - 0.04, PLINTH_H + tile_h + 1.45), (2.3, 0.02, 1.2), mat_board, root)
    create_box("Argosino_Whiteboard_Tray", (wb_x, wb_y - 0.08, PLINTH_H + tile_h + 0.82), (2.3, 0.08, 0.03), mat_frame, root)
    for sx in [wb_x - 1.0, wb_x + 1.0]:
        create_box(f"Argosino_WB_Leg_{sx:.1f}", (sx, wb_y, PLINTH_H + tile_h + 0.75), (0.06, 0.45, 1.5), mat_frame, root)
        
    # 4 Cantilever Conference Chairs in front of whiteboard
    for ci, cx in enumerate([wb_x - 0.9, wb_x - 0.3, wb_x + 0.3, wb_x + 0.9]):
        create_box(f"Argosino_Chair_Seat_{ci}", (cx, wb_y - 1.1, PLINTH_H + tile_h + 0.48), (0.44, 0.44, 0.08), mat_chair, root)
        create_box(f"Argosino_Chair_Back_{ci}", (cx, wb_y - 0.9, PLINTH_H + tile_h + 0.82), (0.42, 0.06, 0.45), mat_chair, root)
        create_box(f"Argosino_Chair_Leg_{ci}", (cx, wb_y - 1.1, PLINTH_H + tile_h + 0.24), (0.36, 0.36, 0.46), mat_frame, root)

    # Structural Columns for Lounge
    create_box("Argosino_Col_Corner", (vx_max - 0.25, vy_min + 0.25, PLINTH_H + WALL_H/2), (0.38, 0.38, WALL_H), mat_col, root)
    create_box("Argosino_Col_FrontMid", (5.0, vy_min + 0.25, PLINTH_H + WALL_H/2), (0.38, 0.38, WALL_H), mat_col, root)
    create_box("Argosino_Col_SideMid", (vx_max - 0.25, fl_cy, PLINTH_H + WALL_H/2), (0.38, 0.38, WALL_H), mat_col, root)

    # Potted Croton Plants along Veranda Edge (IMG_3789, IMG_3790)
    for pi, (px, py) in enumerate([
        (6.2, vy_min + 0.4),
        (8.2, vy_min + 0.4),
        (vx_max - 0.4, fl_cy - 1.2),
        (vx_max - 0.4, fl_cy + 1.2)
    ]):
        create_cylinder(f"Argosino_Pot_{pi}", (px, py, PLINTH_H + 0.25), radius=0.24, height=0.48, mat=mat_pot, segments=12, parent=root)
        create_cylinder(f"Argosino_Plant_G_{pi}", (px, py, PLINTH_H + 0.65), radius=0.38, height=0.55, mat=mat_leaf1, segments=8, parent=root)
        create_cylinder(f"Argosino_Plant_R_{pi}", (px, py, PLINTH_H + 0.82), radius=0.28, height=0.45, mat=mat_leaf2, segments=6, parent=root)

    # -------------------------------------------------------------------------
    # 8. MAIN ENCLOSED BUILDING WINGS
    # -------------------------------------------------------------------------
    main_w = TOTAL_W/2 + 2.4 # 13.6m
    main_cx = -TOTAL_W/2 + main_w/2 # -4.4m
    create_box("Argosino_Wall_MainHall", (main_cx, 0, PLINTH_H + WALL_H/2), (main_w, TOTAL_D, WALL_H), mat_wall, root)

    br_w = vx_max - 2.4 # 8.8m
    br_d = TOTAL_D/2 - vy_door # 7.6m
    br_cx = (2.4 + vx_max) / 2 # 6.8m
    br_cy = vy_door + br_d/2 # 4.0m
    create_box("Argosino_Wall_BackRightWing", (br_cx, br_cy, PLINTH_H + WALL_H/2), (br_w, br_d, WALL_H), mat_wall, root)

    # 9. Main Building Windows & Pilasters
    for wx in [-9.5, -5.5, -1.5]:
        wy = -TOTAL_D/2 - 0.02
        wz = PLINTH_H + 1.95
        create_box(f"Argosino_Win_F_{wx:.1f}_F", (wx, wy, wz), (1.8, 0.10, 1.3), mat_frame, root)
        create_box(f"Argosino_Win_F_{wx:.1f}_G", (wx, wy, wz), (1.7, 0.04, 1.2), mat_glass, root)
        for l in range(3):
            create_box(f"Argosino_Win_F_{wx:.1f}_Grl_{l}", (wx, wy - 0.02, wz - 0.4 + l * 0.4), (1.7, 0.02, 0.04), mat_grille, root)

    for wy in [-4.5, -1.5, 1.5, 4.5]:
        wx = -TOTAL_W/2 - 0.02
        wz = PLINTH_H + 1.95
        create_box(f"Argosino_Win_W_{wy:.1f}_F", (wx, wy, wz), (0.10, 1.8, 1.3), mat_frame, root)
        create_box(f"Argosino_Win_W_{wy:.1f}_G", (wx, wy, wz), (0.04, 1.7, 1.2), mat_glass, root)

    for wx in [-8.0, -4.0, 0.0, 4.0, 8.0]:
        wy = TOTAL_D/2 + 0.02
        wz = PLINTH_H + 1.95
        create_box(f"Argosino_Win_B_{wx:.1f}_F", (wx, wy, wz), (1.8, 0.10, 1.3), mat_frame, root)
        create_box(f"Argosino_Win_B_{wx:.1f}_G", (wx, wy, wz), (1.7, 0.04, 1.2), mat_glass, root)

    for wy in [1.8, 4.8]:
        wx = TOTAL_W/2 + 0.02
        wz = PLINTH_H + 1.95
        create_box(f"Argosino_Win_E_{wy:.1f}_F", (wx, wy, wz), (0.10, 1.8, 1.3), mat_frame, root)
        create_box(f"Argosino_Win_E_{wy:.1f}_G", (wx, wy, wz), (0.04, 1.7, 1.2), mat_glass, root)

    for px in [-TOTAL_W/2, -7.5, -3.5, 0.5]:
        create_box(f"Argosino_Pilaster_F_{px:.1f}", (px, -TOTAL_D/2 - 0.08, PLINTH_H + WALL_H/2), (0.42, 0.18, WALL_H), mat_pilaster, root)
    for px in [-TOTAL_W/2, -TOTAL_W/4, 0, TOTAL_W/4, TOTAL_W/2]:
        create_box(f"Argosino_Pilaster_B_{px:.1f}", (px, TOTAL_D/2 + 0.08, PLINTH_H + WALL_H/2), (0.42, 0.18, WALL_H), mat_pilaster, root)

    # 10. Four-Sided Hipped (Pyramidal) Roof (Brown Outline on Satellite)
    RIDGE_H = 3.20
    RIDGE_Z = EAVE_Z + RIDGE_H
    rx_min = -TOTAL_W/2 - OVERHANG
    rx_max = TOTAL_W/2 + OVERHANG
    ry_min = -TOTAL_D/2 - OVERHANG
    ry_max = TOTAL_D/2 + OVERHANG
    
    ridge_len = (rx_max - rx_min) - (ry_max - ry_min)
    if ridge_len < 3.0:
        ridge_len = 5.0
    ridge_x1 = -ridge_len / 2
    ridge_x2 = ridge_len / 2
    ridge_y = 0.0
    
    roof_mesh = bpy.data.meshes.new("Argosino_Roof_Mesh")
    bm = bmesh.new()
    
    v_c1 = bm.verts.new((rx_min, ry_min, EAVE_Z))
    v_c2 = bm.verts.new((rx_max, ry_min, EAVE_Z))
    v_c3 = bm.verts.new((rx_max, ry_max, EAVE_Z))
    v_c4 = bm.verts.new((rx_min, ry_max, EAVE_Z))
    
    v_r1 = bm.verts.new((ridge_x1, ridge_y, RIDGE_Z))
    v_r2 = bm.verts.new((ridge_x2, ridge_y, RIDGE_Z))
    
    bm.faces.new((v_c1, v_c2, v_r2, v_r1)) # Front slope
    bm.faces.new((v_c2, v_c3, v_r2))       # Right hip
    bm.faces.new((v_c3, v_c4, v_r1, v_r2)) # Back slope
    bm.faces.new((v_c4, v_c1, v_r1))       # Left hip
    
    bm.to_mesh(roof_mesh)
    bm.free()
    
    roof_obj = bpy.data.objects.new("Argosino_Roof", roof_mesh)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.data.materials.append(mat_roof)
    roof_obj.parent = root
    
    fascia_h = 0.30
    fascia_z = EAVE_Z - fascia_h/2
    fascia_t = 0.08
    total_roof_w = rx_max - rx_min
    total_roof_d = ry_max - ry_min
    
    create_box("Argosino_Fascia_Front", (0, ry_min, fascia_z), (total_roof_w, fascia_t, fascia_h), mat_fascia, root)
    create_box("Argosino_Fascia_Back", (0, ry_max, fascia_z), (total_roof_w, fascia_t, fascia_h), mat_fascia, root)
    create_box("Argosino_Fascia_Left", (rx_min, 0, fascia_z), (fascia_t, total_roof_d, fascia_h), mat_fascia, root)
    create_box("Argosino_Fascia_Right", (rx_max, 0, fascia_z), (fascia_t, total_roof_d, fascia_h), mat_fascia, root)
    create_box("Argosino_RidgeCap_Main", (0, 0, RIDGE_Z + 0.03), (ridge_len + 0.5, 0.38, 0.06), mat_ridge, root)

    # 11. Walkway Connector Canopy ("Blue Small Roof", satellite sketch on the far right)
    canopy_w = 2.50
    canopy_d = 5.20
    canopy_h = 2.75
    canopy_cx = vx_max - canopy_w/2 # 9.95m - On the FAR RIGHT, exactly matching the blue box in satellite sketch
    canopy_cy = vy_min - canopy_d/2 + 0.4
    
    create_box("Argosino_Connector_Roof", (canopy_cx, canopy_cy, PLINTH_H + canopy_h), (canopy_w, canopy_d, 0.12), mat_walkway_roof, root)
    create_box("Argosino_Connector_Fascia_L", (canopy_cx - canopy_w/2, canopy_cy, PLINTH_H + canopy_h - 0.08), (0.05, canopy_d, 0.18), mat_walkway_fascia, root)
    create_box("Argosino_Connector_Fascia_R", (canopy_cx + canopy_w/2, canopy_cy, PLINTH_H + canopy_h - 0.08), (0.05, canopy_d, 0.18), mat_walkway_fascia, root)
    
    for py in [vy_min - 1.2, vy_min - 2.8, vy_min - 4.4]:
        for px in [canopy_cx - canopy_w/2 + 0.15, canopy_cx + canopy_w/2 - 0.15]:
            create_box(f"Argosino_Connector_Post_{px:.1f}_{py:.1f}", (px, py, (PLINTH_H + canopy_h)/2), (0.12, 0.12, PLINTH_H + canopy_h), mat_post, root)

    # 12. Warm Ceiling Downlights
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Argosino_Light_"):
            bpy.data.objects.remove(obj, do_unlink=True)
            
    # Light 1: In Corridor above Space B
    l1_data = bpy.data.lights.new(name="Argosino_Light_Data_0", type='POINT')
    l1_data.energy = 90.0
    l1_data.color = (1.0, 0.95, 0.88)
    l1_obj = bpy.data.objects.new("Argosino_Light_0", l1_data)
    bpy.context.scene.collection.objects.link(l1_obj)
    l1_obj.location = (corr_cx, -3.5, EAVE_Z - 0.20)
    l1_obj.parent = root
    
    # Light 2: In Lounge above Kiosk & Whiteboard
    l2_data = bpy.data.lights.new(name="Argosino_Light_Data_1", type='POINT')
    l2_data.energy = 95.0
    l2_data.color = (1.0, 0.95, 0.88)
    l2_obj = bpy.data.objects.new("Argosino_Light_1", l2_data)
    bpy.context.scene.collection.objects.link(l2_obj)
    l2_obj.location = (7.5, -3.8, EAVE_Z - 0.20)
    l2_obj.parent = root

    # 13. Export GLB
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    
    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\argosino_hall.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"Exported Corrected Argosino Hall GLB to {glb_out} (Size: {file_size_kb:.1f} KB)")
    return root

build_argosino_hall()
