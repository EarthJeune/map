"""
build_guard_house.py - Authentic 3D Model of the DA-LARES Guard House (Main Entrance Security Outpost)
Built strictly from field photograph reference:
1. IMG_3813 (Full Front & Driveway Approach):
   - Single-story security post with pale avocado / sage green masonry walls
   - Foundation concrete plinth with terracotta / reddish base skirt
   - Weathered corrugated metal hipped roof with moss patina and dark fascia boards
   - Extended front open covered porch / overhang supported by a round metal vertical post
   - Right inspection station: wide service window opening, counter, DA notice posters,
     "BAWAL ANG RED TAPE" sign, mounted red fire extinguisher, storage shelves
   - Front duty desk: white monobloc table, duty logbook, blue document tray, desk fan,
     and white monobloc chairs with duty security officer
   - Left side: security access door, plate badge "17702", side louver window,
     blue 5-gallon water dispenser jug, stack of recycled rubber tires
   - Right side: DA perimeter concrete boundary wall and dark green steel security gate
     with background overhead walkway structure and yellow safety bollards
   - Left side: large shading mango tree with leafy branches overhanging the roof
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

def create_hipped_roof(name, loc, base_w, base_d, peak_w, peak_d, height, mat, parent=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    
    bm = bmesh.new()
    hw_b, hd_b = base_w / 2.0, base_d / 2.0
    hw_p, hd_p = peak_w / 2.0, peak_d / 2.0
    
    v0 = bm.verts.new((-hw_b, -hd_b, 0.0))
    v1 = bm.verts.new(( hw_b, -hd_b, 0.0))
    v2 = bm.verts.new(( hw_b,  hd_b, 0.0))
    v3 = bm.verts.new((-hw_b,  hd_b, 0.0))
    
    v4 = bm.verts.new((-hw_p, -hd_p, height))
    v5 = bm.verts.new(( hw_p, -hd_p, height))
    v6 = bm.verts.new(( hw_p,  hd_p, height))
    v7 = bm.verts.new((-hw_p,  hd_p, height))
    
    bm.faces.new((v0, v1, v5, v4)) # Front slope
    bm.faces.new((v1, v2, v6, v5)) # Right slope
    bm.faces.new((v2, v3, v7, v6)) # Rear slope
    bm.faces.new((v3, v0, v4, v7)) # Left slope
    bm.faces.new((v4, v5, v6, v7)) # Top ridge
    bm.faces.new((v3, v2, v1, v0)) # Bottom cap
    
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = loc
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_ridge_bar(name, p1, p2, width, thickness, mat, parent=None):
    dx, dy, dz = p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2]
    length = math.sqrt(dx*dx + dy*dy + dz*dz)
    mid = ((p1[0]+p2[0])/2.0, (p1[1]+p2[1])/2.0, (p1[2]+p2[2])/2.0)
    yaw = math.atan2(dy, dx)
    pitch = -math.atan2(dz, math.hypot(dx, dy))
    obj = create_box(name, mid, (length, width, thickness), mat, parent)
    obj.rotation_euler = (0, pitch, yaw)
    return obj

def build_guard_house():
    print("Building Authentic DA-LARES Guard House from IMG_3813...")
    
    # 1. Clean existing Guard House objects
    for obj in list(bpy.data.objects):
        if obj.name.startswith("GH_"):
            bpy.data.objects.remove(obj, do_unlink=True)
    for c in list(bpy.data.collections):
        if c.name.startswith("GH_"):
            bpy.data.collections.remove(c)
            
    root = bpy.data.objects.new("GH_Root", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (0, 0, 0)
    
    # 2. Authentic Materials from IMG_3813
    mat_wall = create_mat("Mat_GH_Wall", (0.42, 0.58, 0.38), roughness=0.85) # Avocado / sage green masonry
    mat_wall_accent = create_mat("Mat_GH_WallAccent", (0.36, 0.50, 0.32), roughness=0.85) # Sage green trim
    mat_plinth_skirt = create_mat("Mat_GH_PlinthSkirt", (0.64, 0.22, 0.18), roughness=0.88) # Terracotta/reddish bottom skirt
    mat_concrete = create_mat("Mat_GH_Concrete", (0.58, 0.57, 0.54), roughness=0.92) # Concrete plinth & driveway pavement
    mat_roof_metal = create_mat("Mat_GH_RoofMetal", (0.28, 0.36, 0.28), roughness=0.75, metallic=0.20) # Weathered corrugated zinc with green patina
    mat_roof_ridge = create_mat("Mat_GH_RoofRidge", (0.24, 0.30, 0.24), roughness=0.70, metallic=0.25) # Ridge cap darker green
    mat_roof_fascia = create_mat("Mat_GH_Fascia", (0.20, 0.24, 0.20), roughness=0.80) # Charcoal fascia board
    mat_metal_post = create_mat("Mat_GH_Post", (0.32, 0.38, 0.32), roughness=0.60, metallic=0.50) # Painted steel pipe post
    mat_metal_dark = create_mat("Mat_GH_DarkMetal", (0.18, 0.20, 0.18), roughness=0.50, metallic=0.70) # Door frame, grilles
    mat_white_plastic = create_mat("Mat_GH_WhitePlastic", (0.92, 0.92, 0.91), roughness=0.45) # White monobloc table & chairs
    mat_fire_ext = create_mat("Mat_GH_FireExt", (0.86, 0.12, 0.10), roughness=0.35, metallic=0.10) # Red fire extinguisher
    mat_water_blue = create_mat("Mat_GH_WaterBlue", (0.12, 0.52, 0.88), roughness=0.20, metallic=0.0) # Blue 5-gal water container
    mat_gate_green = create_mat("Mat_GH_GateGreen", (0.16, 0.30, 0.18), roughness=0.60, metallic=0.40) # Perimeter gate green metal
    mat_yellow_bollard = create_mat("Mat_GH_BollardYellow", (0.88, 0.72, 0.12), roughness=0.50) # Safety yellow bollard
    mat_tire_black = create_mat("Mat_GH_TireBlack", (0.15, 0.15, 0.15), roughness=0.90) # Black rubber tires
    mat_bark = create_mat("Mat_GH_Bark", (0.28, 0.22, 0.17), roughness=0.95) # Mango tree bark
    mat_foliage_1 = create_mat("Mat_GH_Foliage1", (0.18, 0.38, 0.14), roughness=0.85) # Deep mango leaves
    mat_foliage_2 = create_mat("Mat_GH_Foliage2", (0.24, 0.44, 0.18), roughness=0.85) # Vibrant canopy leaves
    mat_poster = create_mat("Mat_GH_Poster", (0.95, 0.95, 0.90), roughness=0.50) # Notice boards / posters
    mat_poster_red = create_mat("Mat_GH_PosterRed", (0.80, 0.20, 0.18), roughness=0.50) # "BAWAL ANG RED TAPE" banner
    mat_glass = create_mat("Mat_GH_Glass", (0.75, 0.85, 0.88), roughness=0.15, metallic=0.10) # Glass window
    mat_guard_uniform = create_mat("Mat_GH_GuardUniform", (0.60, 0.76, 0.88), roughness=0.70) # Light blue security shirt
    mat_guard_pants = create_mat("Mat_GH_GuardPants", (0.14, 0.18, 0.24), roughness=0.85) # Navy blue trousers
    mat_walkway_white = create_mat("Mat_GH_WalkwayWhite", (0.88, 0.88, 0.86), roughness=0.50) # Overhead walkway bridge
    
    # Dimensions (aligned with polygon ~10m x 8m footprint)
    PLINTH_H = 0.25
    WALL_H = 2.65
    EAVE_Z = PLINTH_H + WALL_H # 2.90m
    
    # 3. Foundation Plinth & Concrete Apron
    plinth_w, plinth_d = 7.6, 6.0
    create_box("GH_Plinth", (0.4, -0.4, PLINTH_H / 2.0), (plinth_w, plinth_d, PLINTH_H), mat_concrete, root)
    
    # Driveway road curb along front (Y = -3.4m)
    create_box("GH_RoadCurb", (0.4, -3.42, 0.10), (plinth_w + 1.2, 0.25, 0.20), mat_concrete, root)
    
    # 4. Main Enclosed Security Office (Left Side)
    room_w, room_d = 3.6, 4.0
    room_cx, room_cy = -1.1, 0.5
    
    # Terracotta skirting band along bottom perimeter of room
    create_box("GH_Room_Skirt", (room_cx, room_cy, PLINTH_H + 0.12), (room_w + 0.04, room_d + 0.04, 0.24), mat_plinth_skirt, root)
    # Main masonry walls
    create_box("GH_Room_Body", (room_cx, room_cy, PLINTH_H + WALL_H / 2.0), (room_w, room_d, WALL_H), mat_wall, root)
    
    # Left Wall Louver Window (IMG_3813)
    create_box("GH_Win_Frame_L", (room_cx - room_w / 2.0 - 0.02, room_cy - 0.4, PLINTH_H + 1.50), (0.06, 1.20, 1.00), mat_metal_dark, root)
    create_box("GH_Win_Glass_L", (room_cx - room_w / 2.0 - 0.01, room_cy - 0.4, PLINTH_H + 1.50), (0.02, 1.10, 0.90), mat_glass, root)
    for l_idx in range(5):
        lz = PLINTH_H + 1.10 + l_idx * 0.20
        create_box(f"GH_Win_Slat_{l_idx}", (room_cx - room_w / 2.0 - 0.04, room_cy - 0.4, lz), (0.05, 1.12, 0.04), mat_metal_dark, root)
        
    # Front Security Entrance Door (Left side of front facade, IMG_3813)
    door_w, door_h = 0.95, 2.10
    door_x = room_cx + 0.60
    door_y = room_cy - room_d / 2.0 - 0.02
    create_box("GH_Door_Frame", (door_x, door_y, PLINTH_H + door_h / 2.0), (door_w + 0.08, 0.06, door_h + 0.08), mat_metal_dark, root)
    create_box("GH_Door_Panel", (door_x, door_y, PLINTH_H + door_h / 2.0), (door_w, 0.04, door_h), mat_wall_accent, root)
    
    # License Plate Badge "17702" and Signage Plaque beside door (IMG_3813)
    create_box("GH_Sign_Badge", (door_x - 0.65, door_y - 0.02, PLINTH_H + 1.55), (0.28, 0.02, 0.16), mat_poster, root)
    create_box("GH_Sign_DA_Seal", (door_x - 0.65, door_y - 0.02, PLINTH_H + 1.80), (0.24, 0.02, 0.24), mat_poster, root)
    
    # 5. Right Open Inspection Station / Counter Bay (IMG_3813)
    station_w, station_d = 3.6, 2.0
    station_cx = 2.4
    station_cy = 0.5
    
    create_box("GH_Station_BackWall", (station_cx, station_cy + station_d / 2.0 - 0.10, PLINTH_H + WALL_H / 2.0), (station_w, 0.20, WALL_H), mat_wall, root)
    create_box("GH_Station_RightWall", (station_cx + station_w / 2.0 - 0.10, station_cy, PLINTH_H + WALL_H / 2.0), (0.20, station_d, WALL_H), mat_wall, root)
    create_box("GH_Station_Skirt_R", (station_cx + station_w / 2.0 - 0.08, station_cy, PLINTH_H + 0.12), (0.24, station_d + 0.04, 0.24), mat_plinth_skirt, root)

    # Service Window Counter Wall
    counter_y = station_cy - station_d / 2.0
    create_box("GH_Counter_Base", (station_cx, counter_y, PLINTH_H + 0.50), (station_w - 0.2, 0.18, 1.00), mat_wall, root)
    create_box("GH_Counter_Ledge", (station_cx, counter_y - 0.05, PLINTH_H + 1.02), (station_w, 0.35, 0.06), mat_concrete, root)
    
    # Wide Service Opening / Sliding Window
    create_box("GH_Service_Frame", (station_cx, counter_y, PLINTH_H + 1.75), (2.4, 0.08, 1.35), mat_metal_dark, root)
    create_box("GH_Service_Glass", (station_cx, counter_y, PLINTH_H + 1.75), (2.3, 0.02, 1.25), mat_glass, root)
    
    # Notice Boards & Posters on counter window ("BAWAL ANG RED TAPE", IMG_3813)
    create_box("GH_Poster_RedTape_BG", (station_cx - 0.50, counter_y - 0.03, PLINTH_H + 1.75), (0.65, 0.02, 0.85), mat_poster, root)
    create_box("GH_Poster_RedTape_Banner", (station_cx - 0.50, counter_y - 0.04, PLINTH_H + 2.05), (0.60, 0.02, 0.18), mat_poster_red, root)
    create_box("GH_Poster_Notice", (station_cx + 0.55, counter_y - 0.03, PLINTH_H + 1.65), (0.55, 0.02, 0.65), mat_poster, root)
    
    # Mounted Fire Extinguisher (Bright red cylinder on wall, IMG_3813)
    ext_x = station_cx + 1.25
    ext_y = counter_y - 0.08
    ext_z = PLINTH_H + 1.50
    create_cylinder("GH_FireExt_Body", (ext_x, ext_y, ext_z), 0.09, 0.55, mat_fire_ext, 12, parent=root)
    create_cylinder("GH_FireExt_Top", (ext_x, ext_y, ext_z + 0.30), 0.04, 0.10, mat_metal_dark, 8, parent=root)
    create_box("GH_FireExt_Bracket", (ext_x, ext_y + 0.06, ext_z), (0.12, 0.04, 0.35), mat_metal_dark, root)
    
    # Interior storage shelves behind the counter (visible in IMG_3813)
    create_box("GH_Storage_Shelf", (station_cx + 0.90, station_cy + 0.40, PLINTH_H + 0.80), (0.80, 0.45, 1.20), mat_concrete, root)
    create_box("GH_Storage_Packages", (station_cx + 0.90, station_cy + 0.40, PLINTH_H + 1.20), (0.70, 0.35, 0.40), mat_poster, root)

    # 6. Front Covered Porch Canopy & Post
    canopy_w = 4.4
    canopy_d = 2.6
    canopy_cx = 1.9
    canopy_cy = -1.1
    
    create_box("GH_Canopy_Beam_Front", (canopy_cx, canopy_cy - canopy_d / 2.0, EAVE_Z), (canopy_w, 0.16, 0.28), mat_roof_fascia, root)
    create_box("GH_Canopy_Beam_Right", (canopy_cx + canopy_w / 2.0, canopy_cy, EAVE_Z), (0.16, canopy_d, 0.28), mat_roof_fascia, root)
    
    # Round Steel Pipe Vertical Post supporting the porch overhang (IMG_3813)
    post_x = canopy_cx - 0.65 # At X = 1.25m
    post_y = canopy_cy - canopy_d / 2.0 + 0.15 # Near front edge
    create_cylinder("GH_Porch_Post", (post_x, post_y, (PLINTH_H + EAVE_Z) / 2.0), 0.06, EAVE_Z - PLINTH_H, mat_metal_post, 16, parent=root)
    create_cylinder("GH_Porch_Post_Base", (post_x, post_y, PLINTH_H + 0.04), 0.12, 0.08, mat_metal_dark, 12, parent=root)

    # 7. Authentic Guard Station Furniture & Duty Security Officer (IMG_3813)
    desk_x = 1.65
    desk_y = -1.70
    desk_z = PLINTH_H + 0.72
    desk_w, desk_d = 1.30, 0.75
    create_box("GH_Desk_Top", (desk_x, desk_y, desk_z), (desk_w, desk_d, 0.05), mat_white_plastic, root)
    for dx in [-desk_w/2 + 0.08, desk_w/2 - 0.08]:
        for dy in [-desk_d/2 + 0.08, desk_d/2 - 0.08]:
            create_cylinder(f"GH_Desk_Leg_{dx:.1f}_{dy:.1f}", (desk_x + dx, desk_y + dy, PLINTH_H + 0.35), 0.025, 0.68, mat_white_plastic, 8, parent=root)
            
    # Props on Desk:
    # 1. Security Logbook / Ledger (open register for visitor logging)
    create_box("GH_Logbook_Cover", (desk_x - 0.25, desk_y, desk_z + 0.035), (0.36, 0.28, 0.02), mat_guard_pants, root)
    create_box("GH_Logbook_Pages", (desk_x - 0.25, desk_y, desk_z + 0.045), (0.34, 0.26, 0.02), mat_poster, root)
    # 2. Blue Document Sorter / File Tray (IMG_3813)
    create_box("GH_FileTray", (desk_x + 0.30, desk_y - 0.05, desk_z + 0.08), (0.28, 0.34, 0.12), mat_water_blue, root)
    # 3. Oscillating Desk Fan behind desk
    create_cylinder("GH_Fan_Base", (desk_x + 0.35, desk_y + 0.25, desk_z + 0.02), 0.10, 0.04, mat_metal_dark, 12, parent=root)
    create_cylinder("GH_Fan_Pole", (desk_x + 0.35, desk_y + 0.25, desk_z + 0.15), 0.02, 0.22, mat_metal_dark, 8, parent=root)
    create_cylinder("GH_Fan_Cage", (desk_x + 0.35, desk_y + 0.22, desk_z + 0.28), 0.14, 0.06, mat_metal_dark, 12, rot=(math.radians(85), 0, 0), parent=root)

    # White Monobloc Chairs:
    chair1_x, chair1_y = desk_x - 0.10, desk_y + 0.45
    chair_seat_z = PLINTH_H + 0.45
    create_box("GH_Chair1_Seat", (chair1_x, chair1_y, chair_seat_z), (0.45, 0.45, 0.04), mat_white_plastic, root)
    create_box("GH_Chair1_Back", (chair1_x, chair1_y + 0.20, chair_seat_z + 0.24), (0.42, 0.04, 0.44), mat_white_plastic, root)
    for cdx in [-0.18, 0.18]:
        for cdy in [-0.18, 0.18]:
            create_cylinder(f"GH_Chair1_Leg_{cdx:.1f}_{cdy:.1f}", (chair1_x + cdx, chair1_y + cdy, PLINTH_H + 0.22), 0.02, 0.42, mat_white_plastic, 6, parent=root)

    # Stylized Seated Duty Security Officer (IMG_3813):
    guard_x, guard_y = chair1_x, chair1_y - 0.05
    # Legs / Trousers
    create_box("GH_Guard_Legs", (guard_x, guard_y, PLINTH_H + 0.30), (0.34, 0.38, 0.35), mat_guard_pants, root)
    # Torso (Light Blue Uniform Shirt)
    create_box("GH_Guard_Torso", (guard_x, guard_y, PLINTH_H + 0.72), (0.36, 0.26, 0.45), mat_guard_uniform, root)
    # Arms resting on desk
    create_box("GH_Guard_Arms", (guard_x, guard_y - 0.20, desk_z + 0.05), (0.32, 0.25, 0.08), mat_guard_uniform, root)
    # Head & Security Cap
    create_cylinder("GH_Guard_Head", (guard_x, guard_y, PLINTH_H + 1.05), 0.10, 0.20, mat_concrete, 10, parent=root)
    create_cylinder("GH_Guard_Cap", (guard_x, guard_y, PLINTH_H + 1.16), 0.12, 0.08, mat_guard_pants, 10, parent=root)

    # Spare White Visitor Monobloc Chair (Left porch, IMG_3813)
    chair2_x, chair2_y = 0.35, -1.85
    create_box("GH_Chair2_Seat", (chair2_x, chair2_y, chair_seat_z), (0.45, 0.45, 0.04), mat_white_plastic, root)
    create_box("GH_Chair2_Back", (chair2_x, chair2_y + 0.20, chair_seat_z + 0.24), (0.42, 0.04, 0.44), mat_white_plastic, root)
    for cdx in [-0.18, 0.18]:
        for cdy in [-0.18, 0.18]:
            create_cylinder(f"GH_Chair2_Leg_{cdx:.1f}_{cdy:.1f}", (chair2_x + cdx, chair2_y + cdy, PLINTH_H + 0.22), 0.02, 0.42, mat_white_plastic, 6, parent=root)

    # 5-Gallon Blue Water Dispenser Jug beside entrance door (IMG_3813)
    jug_x = room_cx - 0.95
    jug_y = room_cy - room_d / 2.0 - 0.15
    create_box("GH_Water_Stand", (jug_x, jug_y, PLINTH_H + 0.25), (0.35, 0.35, 0.50), mat_metal_dark, root)
    create_cylinder("GH_Water_Bottle", (jug_x, jug_y, PLINTH_H + 0.75), 0.14, 0.48, mat_water_blue, 14, parent=root)
    create_cylinder("GH_Water_Cap", (jug_x, jug_y, PLINTH_H + 1.01), 0.04, 0.06, mat_white_plastic, 8, parent=root)

    # Left Yard Props: Stack of 3 recycled tires & green container (IMG_3813)
    tire_x, tire_y = -3.40, -1.10
    for t_i in range(3):
        tz = 0.12 + t_i * 0.22
        create_cylinder(f"GH_Tire_{t_i}", (tire_x, tire_y, tz), 0.32, 0.20, mat_tire_black, 14, parent=root)
        create_cylinder(f"GH_Tire_Hole_{t_i}", (tire_x, tire_y, tz), 0.18, 0.21, mat_concrete, 10, parent=root)
    create_box("GH_Green_Bin", (tire_x + 0.55, tire_y - 0.10, 0.30), (0.35, 0.35, 0.60), mat_wall_accent, root)

    # 8. Main Weathered Corrugated Metal Hipped Roof System (Seamless over Porch & Room)
    # The roof spans across the entire room & porch overhang
    total_roof_w = 7.80
    total_roof_d = 5.60
    roof_cx = 0.55
    roof_cy = 0.15
    roof_h = 1.45
    
    # Charcoal perimeter fascia trim
    create_box("GH_Roof_Fascia", (roof_cx, roof_cy, EAVE_Z + 0.08), (total_roof_w + 0.14, total_roof_d + 0.14, 0.18), mat_roof_fascia, root)
    
    # 4-Sided Hipped Corrugated Metal Roof
    create_hipped_roof("GH_Main_Roof", (roof_cx, roof_cy, EAVE_Z + 0.17), total_roof_w, total_roof_d, 2.60, 0.60, roof_h, mat_roof_metal, root)
    
    # Ridge Cap along the peak apex
    create_box("GH_Ridge_Cap_Top", (roof_cx, roof_cy, EAVE_Z + 0.17 + roof_h + 0.03), (2.70, 0.24, 0.06), mat_roof_ridge, root)
    
    # 4 Hipped Ridge Caps sloping along the 4 hip ridges
    peak_w, peak_d = 2.60, 0.60
    hw_b, hd_b = total_roof_w / 2.0, total_roof_d / 2.0
    hw_p, hd_p = peak_w / 2.0, peak_d / 2.0
    hip_corners = [
        ((-hw_b, -hd_b), (-hw_p, -hd_p)), # Front-Left
        (( hw_b, -hd_b), ( hw_p, -hd_p)), # Front-Right
        (( hw_b,  hd_b), ( hw_p,  hd_p)), # Rear-Right
        ((-hw_b,  hd_b), (-hw_p,  hd_p))  # Rear-Left
    ]
    for h_i, (b_pt, p_pt) in enumerate(hip_corners):
        p_start = (roof_cx + b_pt[0], roof_cy + b_pt[1], EAVE_Z + 0.17)
        p_end = (roof_cx + p_pt[0], roof_cy + p_pt[1], EAVE_Z + 0.17 + roof_h)
        create_ridge_bar(f"GH_Hip_Cap_{h_i}", p_start, p_end, 0.14, 0.04, mat_roof_ridge, root)



    # 11. Warm Security Porch Downlight
    for obj in list(bpy.data.objects):
        if obj.name.startswith("GH_Light_"):
            bpy.data.objects.remove(obj, do_unlink=True)
            
    l_data = bpy.data.lights.new(name="GH_Light_Data", type='POINT')
    l_data.energy = 32.0
    l_data.color = (1.0, 0.95, 0.88)
    l_obj = bpy.data.objects.new("GH_Light_0", l_data)
    bpy.context.scene.collection.objects.link(l_obj)
    l_obj.location = (canopy_cx, canopy_cy - 0.20, EAVE_Z - 0.45)
    l_obj.parent = root

    # 12. Export Web-Optimized GLB Scene
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    
    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\guard_house.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"Exported Authentic Guard House GLB to {glb_out} (Size: {file_size_kb:.1f} KB)")
    return root

build_guard_house()
