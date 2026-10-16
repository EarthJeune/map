"""
build_amad_building.py — Authentic Bespoke 3D Model of the DA-LARES AMAD Building
(Technology Commercialization Building - Agribusiness and Marketing Assistance Division)

Authentic ground-truth architectural model built directly from field photos:
1. IMG_3814 (Front Facade):
   - Symmetrical 3-bay modern pavilion architecture
   - Spanish terracotta clay tiled hipped roof with deep cantilevered eaves
   - Deep mahogany/crimson perimeter fascia board trim and grooved soffit underside
   - Rich warm terracotta-brown stacked-slate stone veneer plinth skirt and entrance piers
   - Two large curtain-wall panoramic MIRROR / reflective glass bays:
     * Full-height dark-tinted reflective mirror glass panels reflecting sky and environment
     * Dark bronze aluminum perimeter frames and vertical mullions
     * Interior vertical blinds clearly visible behind the glass
   - Center recessed entrance bay:
     * Flanked by massive stacked stone columns/piers with projecting coping caps
     * Recessed double commercial mirrored glass doors with handles, kickplates, and notice decals
     * 3-tier concrete entry steps / stoop
     * Architrave beam with bold, clearly legible 3D signage:
       "TECHNOLOGY COMMERCIALIZATION BUILDING"
   - Official Department of Agriculture circular seal emblem on the right upper frieze
   - Freestanding directory sign stand in front of the right window
2. IMG_3815 (Side Facade & Driveway Approach):
   - Stacked slate stone skirting wrapping around the building perimeter
   - Side elevation curtain wall with mirrored glass bays and dark mullions
   - Ground/wall-mounted air conditioning condenser unit with protective grille
   - Pure architecture: Strictly ZERO extraneous outdoor props (no lawn slabs, trees, cars, or road pavement)
"""

import bpy
import bmesh
import math
import os

def create_mat(name, color, roughness=0.7, metallic=0.0, specular=0.5, alpha=1.0):
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
    
    # Alpha for transparent/tinted materials
    if alpha < 1.0:
        if 'Alpha' in node_principled.inputs:
            node_principled.inputs['Alpha'].default_value = alpha
        if hasattr(mat, 'blend_method'):
            mat.blend_method = 'BLEND'
        
    if 'Specular IOR Level' in node_principled.inputs:
        node_principled.inputs['Specular IOR Level'].default_value = specular
    elif 'Specular' in node_principled.inputs:
        node_principled.inputs['Specular'].default_value = specular
        
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

def create_text_mesh(name, loc, text, size, mat, rot=(0,0,0), parent=None):
    c_data = bpy.data.curves.new(name=name + "_Data", type='FONT')
    c_data.body = text
    c_data.size = size
    c_data.extrude = 0.02
    c_data.resolution_u = 2
    c_data.align_x = 'CENTER'
    c_data.align_y = 'CENTER'
    obj = bpy.data.objects.new(name, c_data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
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
    bm.faces.new((v4, v5, v6, v7)) # Top ridge cap
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

def build_amad_building():
    print("=====================================================================")
    print(" Rebuilding Authentic AMAD Building with Full Mirrored Glass Layout ")
    print("=====================================================================")
    
    # 1. Clean existing AMAD objects
    for obj in list(bpy.data.objects):
        if obj.name.startswith("AMAD_"):
            bpy.data.objects.remove(obj, do_unlink=True)
    for c in list(bpy.data.collections):
        if c.name.startswith("AMAD_"):
            bpy.data.collections.remove(c)
            
    root = bpy.data.objects.new("AMAD_Root", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (0, 0, 0)
    
    # 2. Materials calibrated strictly to Field Photos (IMG_3814 & IMG_3815)
    # Stucco wall: Warm cream
    mat_wall = create_mat("Mat_AMAD_Wall", (0.86, 0.84, 0.78), roughness=0.85)
    
    # Stacked slate stone veneer: Rich deep warm earthy terracotta/slate brown (IMG_3814)
    mat_stone_dark = create_mat("Mat_AMAD_StoneDark", (0.18, 0.07, 0.04), roughness=0.92)
    mat_stone_mid  = create_mat("Mat_AMAD_StoneMid",  (0.26, 0.11, 0.06), roughness=0.90)
    mat_stone_light= create_mat("Mat_AMAD_StoneLight",(0.34, 0.15, 0.08), roughness=0.88)
    mat_stone_cap  = create_mat("Mat_AMAD_StoneCap",  (0.55, 0.52, 0.46), roughness=0.85) # Precast concrete caps & steps
    
    # *** MIRROR GLASS & BLINDS *** (Requested by User!)
    # Outer reflective mirror glass layer: Tinted emerald-charcoal with high specular reflection and semi-transparency
    mat_mirror_glass = create_mat("Mat_AMAD_MirrorGlass", (0.05, 0.10, 0.12), roughness=0.03, metallic=0.70, specular=1.0, alpha=0.58)
    # Door mirror glass (darker tinted reflective mirror glass)
    mat_door_mirror  = create_mat("Mat_AMAD_DoorMirror",  (0.04, 0.08, 0.10), roughness=0.04, metallic=0.75, specular=1.0, alpha=0.88)
    # Dark bronze aluminum curtain-wall framing
    mat_frame_dark   = create_mat("Mat_AMAD_DarkFrame",   (0.06, 0.06, 0.07), roughness=0.35, metallic=0.85)
    
    # Interior vertical blinds (clearly visible through tinted mirror glass! IMG_3814)
    mat_blinds       = create_mat("Mat_AMAD_Blinds",      (0.80, 0.84, 0.78), roughness=0.55)
    mat_blinds_shade = create_mat("Mat_AMAD_BlindsShade", (0.55, 0.60, 0.54), roughness=0.65)
    
    # Roof Materials: Deep authentic weathered Mediterranean terracotta clay red (IMG_3814)
    mat_roof_tile  = create_mat("Mat_AMAD_RoofTile",  (0.28, 0.07, 0.03), roughness=0.82, metallic=0.02)
    mat_roof_ridge = create_mat("Mat_AMAD_RoofRidge", (0.22, 0.05, 0.02), roughness=0.80, metallic=0.04)
    mat_roof_fascia= create_mat("Mat_AMAD_Fascia",    (0.18, 0.04, 0.03), roughness=0.82) # Rich dark mahogany fascia
    mat_soffit     = create_mat("Mat_AMAD_Soffit",    (0.80, 0.78, 0.72), roughness=0.85)
    
    # Signage & Seals
    mat_sign_bg    = create_mat("Mat_AMAD_SignBG",    (0.84, 0.82, 0.76), roughness=0.65)
    mat_sign_text  = create_mat("Mat_AMAD_SignText",  (0.02, 0.08, 0.10), roughness=0.15, metallic=0.70) # Deep bold dark teal letters
    mat_da_green   = create_mat("Mat_AMAD_DAGreen",   (0.06, 0.36, 0.14), roughness=0.45)
    mat_da_white   = create_mat("Mat_AMAD_DAWhite",   (0.95, 0.95, 0.92), roughness=0.35)
    mat_notice     = create_mat("Mat_AMAD_Notice",    (0.92, 0.92, 0.88), roughness=0.40)
    mat_sign_stand = create_mat("Mat_AMAD_SignStand", (0.20, 0.21, 0.22), roughness=0.35, metallic=0.85)
    mat_ac_metal   = create_mat("Mat_AMAD_ACMetal",   (0.78, 0.78, 0.76), roughness=0.55, metallic=0.40)
    
    # 3. Overall Dimensions & Proportions (Compact, Authentic Ratios)
    TOTAL_W = 13.20  # East-West width
    TOTAL_D = 14.40  # North-South depth
    PLINTH_H = 0.38  # Ground floor plinth height
    WALL_H = 3.30    # Wall height to roof eave
    EAVE_Z = PLINTH_H + WALL_H # 3.68m
    OVERHANG = 1.25  # Spanish roof cantilever
    
    front_y = -TOTAL_D / 2.0  # -7.20m (facing South toward compound entrance)
    
    # 4. Plinth Foundation & Stepped Multi-Course Slate Stone Veneer Skirt
    create_box("AMAD_Plinth_Base", (0, 0, PLINTH_H / 2.0), (TOTAL_W + 0.16, TOTAL_D + 0.16, PLINTH_H), mat_stone_cap, root)
    
    # Stacked slate stone skirting along the entire perimeter with 3 distinct horizontal relief courses
    SKIRT_H = 0.52
    skirt_z0 = PLINTH_H
    course_h = SKIRT_H / 3.0
    stone_mats = [mat_stone_dark, mat_stone_mid, mat_stone_light]
    for ci in range(3):
        cz = skirt_z0 + (ci + 0.5) * course_h
        c_proj = 0.10 if ci == 1 else 0.06
        create_box(f"AMAD_StoneSkirt_C{ci}", (0, 0, cz), (TOTAL_W + c_proj, TOTAL_D + c_proj, course_h), stone_mats[ci % 3], root)
    # Projecting precast concrete stone cap sill above the skirt
    create_box("AMAD_StoneSkirt_Cap", (0, 0, skirt_z0 + SKIRT_H + 0.025), (TOTAL_W + 0.12, TOTAL_D + 0.12, 0.05), mat_stone_cap, root)
    
    # 5. Main Building Core
    body_h = WALL_H - SKIRT_H
    body_z = skirt_z0 + SKIRT_H + body_h / 2.0
    create_box("AMAD_Main_Core", (0, 0, body_z), (TOTAL_W, TOTAL_D, body_h), mat_wall, root)
    
    # 6. Symmetrical 3-Bay Front Facade Layout (IMG_3814)
    glass_bot_z = skirt_z0 + SKIRT_H + 0.05  # ~0.95m above ground
    glass_top_z = EAVE_Z - 0.65             # ~3.03m above ground
    glass_h = glass_top_z - glass_bot_z     # ~2.08m tall panoramic glazing
    glass_mid_z = (glass_bot_z + glass_top_z) / 2.0
    
    # A. CENTER ENTRANCE BAY
    center_w = 4.00
    pier_w, pier_d = 0.62, 0.45
    pier_h = glass_top_z - PLINTH_H
    pier_xs = [-center_w / 2.0, center_w / 2.0]
    
    for px_idx, px in enumerate(pier_xs):
        p_name = f"AMAD_Pier_{'L' if px < 0 else 'R'}"
        # Multi-tiered slate stone courses on the entrance piers
        p_layers = 6
        layer_h = pier_h / p_layers
        for li in range(p_layers):
            lz = PLINTH_H + (li + 0.5) * layer_h
            l_proj = 0.03 if (li % 2 == 1) else 0.0
            create_box(f"{p_name}_L{li}", (px, front_y - 0.10, lz), (pier_w + l_proj, pier_d + l_proj, layer_h), stone_mats[li % 3], root)
        # Projecting stone coping cap on each pier
        create_box(f"{p_name}_Cap", (px, front_y - 0.10, glass_top_z + 0.04), (pier_w + 0.10, pier_d + 0.10, 0.08), mat_stone_cap, root)
        
    # Concrete Entry Stoop (3 wide tiered steps in front of double doors)
    stoop_w = 3.60
    create_box("AMAD_Stoop_Step1", (0, front_y - 0.55, 0.12 / 2.0), (stoop_w + 0.40, 0.45, 0.12), mat_stone_cap, root)
    create_box("AMAD_Stoop_Step2", (0, front_y - 0.32, 0.12 + 0.12 / 2.0), (stoop_w + 0.20, 0.35, 0.12), mat_stone_cap, root)
    create_box("AMAD_Stoop_Step3", (0, front_y - 0.12, 0.24 + 0.12 / 2.0), (stoop_w, 0.30, 0.12), mat_stone_cap, root)
    
    # Recessed Double Commercial Mirrored Glass Entrance Doors
    door_w, door_h = 2.30, 2.20
    door_frame_th = 0.08
    door_mid_z = PLINTH_H + door_h / 2.0
    door_y = front_y - 0.02
    
    create_box("AMAD_Door_Header", (0, door_y, PLINTH_H + door_h), (door_w + 0.08, door_frame_th, door_frame_th), mat_frame_dark, root)
    create_box("AMAD_Door_Jamb_L", (-door_w / 2.0, door_y, door_mid_z), (door_frame_th, door_frame_th, door_h), mat_frame_dark, root)
    create_box("AMAD_Door_Jamb_R", ( door_w / 2.0, door_y, door_mid_z), (door_frame_th, door_frame_th, door_h), mat_frame_dark, root)
    create_box("AMAD_Door_Center_Post", (0, door_y, door_mid_z), (0.05, door_frame_th, door_h), mat_frame_dark, root)
    
    # Double Mirrored Glass Door Panes
    pane_w = (door_w - 0.14) / 2.0
    create_box("AMAD_Door_Mirror_L", (-door_w / 4.0, door_y - 0.01, door_mid_z), (pane_w, 0.02, door_h - 0.14), mat_door_mirror, root)
    create_box("AMAD_Door_Mirror_R", ( door_w / 4.0, door_y - 0.01, door_mid_z), (pane_w, 0.02, door_h - 0.14), mat_door_mirror, root)
    
    # Door Pull Handles & Dark Kickplates
    create_box("AMAD_Door_Handle_L", (-0.14, door_y - 0.05, PLINTH_H + 1.10), (0.04, 0.06, 0.45), mat_sign_stand, root)
    create_box("AMAD_Door_Handle_R", ( 0.14, door_y - 0.05, PLINTH_H + 1.10), (0.04, 0.06, 0.45), mat_sign_stand, root)
    create_box("AMAD_Door_Kickplate_L", (-door_w / 4.0, door_y - 0.02, PLINTH_H + 0.15), (pane_w, 0.03, 0.26), mat_frame_dark, root)
    create_box("AMAD_Door_Kickplate_R", ( door_w / 4.0, door_y - 0.02, PLINTH_H + 0.15), (pane_w, 0.03, 0.26), mat_frame_dark, root)
    
    # Official Door Notice Paper Advisory Plaques
    create_box("AMAD_Door_Notice_L", (-0.45, door_y - 0.025, PLINTH_H + 1.30), (0.32, 0.005, 0.24), mat_notice, root)
    create_box("AMAD_Door_Notice_R", ( 0.45, door_y - 0.025, PLINTH_H + 1.20), (0.28, 0.005, 0.20), mat_notice, root)

    # Entrance Transom Architrave Signage Beam:
    # "TECHNOLOGY COMMERCIALIZATION BUILDING"
    sign_beam_h = 0.54
    sign_beam_z = (glass_top_z + EAVE_Z) / 2.0 # 3.35m - perfectly aligned with frieze!
    create_box("AMAD_Sign_Beam", (0, front_y - 0.06, sign_beam_z), (center_w - 0.12, 0.12, sign_beam_h), mat_sign_bg, root)
    create_text_mesh("AMAD_Sign_Text", (0, front_y - 0.135, sign_beam_z), "TECHNOLOGY COMMERCIALIZATION BUILDING", 0.165, mat_sign_text, rot=(math.radians(90), 0, 0), parent=root)
    
    # B. LEFT & RIGHT PANORAMIC CURTAIN WALL MIRROR BAYS (IMG_3814)
    # Each bay is 4.00m wide with 3 wide mirrored glass panels and dark bronze aluminum frames
    bay_w = 4.00
    bay_centers_x = [-4.35, 4.35]
    
    for b_idx, bx in enumerate(bay_centers_x):
        b_side = "L" if bx < 0 else "R"
        b_name = f"AMAD_MirrorBay_{b_side}"
        
        # Outer Bronze Curtain-Wall Perimeter Frame
        frame_d = 0.08
        create_box(f"{b_name}_Frame_Top", (bx, front_y - 0.04, glass_top_z), (bay_w + 0.08, frame_d, frame_d), mat_frame_dark, root)
        create_box(f"{b_name}_Frame_Bot", (bx, front_y - 0.04, glass_bot_z), (bay_w + 0.08, frame_d, frame_d), mat_frame_dark, root)
        create_box(f"{b_name}_Frame_L", (bx - bay_w / 2.0, front_y - 0.04, glass_mid_z), (frame_d, frame_d, glass_h), mat_frame_dark, root)
        create_box(f"{b_name}_Frame_R", (bx + bay_w / 2.0, front_y - 0.04, glass_mid_z), (frame_d, frame_d, glass_h), mat_frame_dark, root)
        
        # 2 Intermediate Vertical Mullions dividing into 3 panoramic panes
        m1_x = bx - bay_w / 6.0
        m2_x = bx + bay_w / 6.0
        create_box(f"{b_name}_Mullion_1", (m1_x, front_y - 0.04, glass_mid_z), (0.05, frame_d, glass_h), mat_frame_dark, root)
        create_box(f"{b_name}_Mullion_2", (m2_x, front_y - 0.04, glass_mid_z), (0.05, frame_d, glass_h), mat_frame_dark, root)
        
        # Interior Vertical Blinds (visible through the mirror glass!)
        create_box(f"{b_name}_Blinds_Back", (bx, front_y + 0.02, glass_mid_z), (bay_w - 0.04, 0.015, glass_h - 0.04), mat_blinds, root)
        slat_count = 14
        slat_spacing = (bay_w - 0.08) / slat_count
        for si in range(slat_count):
            sx = bx - bay_w / 2.0 + 0.04 + (si + 0.5) * slat_spacing
            create_box(f"{b_name}_Slat_{si}", (sx, front_y + 0.015, glass_mid_z), (0.018, 0.01, glass_h - 0.06), mat_blinds_shade, root)
            
        # *** AUTHENTIC FRONT MIRRORED GLASS SURFACE ***
        # Tinted reflective mirror glass sitting in front of the blinds
        create_box(f"{b_name}_Mirror_Glass", (bx, front_y - 0.02, glass_mid_z), (bay_w - 0.02, 0.015, glass_h - 0.02), mat_mirror_glass, root)

    # C. OFFICIAL DEPARTMENT OF AGRICULTURE SEAL EMBLEM (Right Upper Wall Frieze, IMG_3814)
    # Scaled to fit comfortably inside the frieze band
    seal_x = 4.35
    seal_z = (glass_top_z + EAVE_Z) / 2.0 # 3.35m
    seal_r = 0.27
    create_cylinder("AMAD_DA_Seal_Base", (seal_x, front_y - 0.04, seal_z), seal_r, 0.03, mat_da_white, 24, rot=(math.radians(90), 0, 0), parent=root)
    create_cylinder("AMAD_DA_Seal_GreenRing", (seal_x, front_y - 0.056, seal_z), seal_r * 0.92, 0.02, mat_da_green, 24, rot=(math.radians(90), 0, 0), parent=root)
    create_cylinder("AMAD_DA_Seal_InnerPlate", (seal_x, front_y - 0.070, seal_z), seal_r * 0.72, 0.02, mat_da_white, 20, rot=(math.radians(90), 0, 0), parent=root)
    create_box("AMAD_DA_Seal_CenterEmblem", (seal_x, front_y - 0.082, seal_z), (seal_r * 1.1, 0.01, seal_r * 1.1), mat_da_green, root)

    # D. Strictly no external freestanding props (directory stand removed)

    # 7. Side Facade Architecture (Left Side / West Driveway, IMG_3815)
    side_x = -TOTAL_W / 2.0 # -6.60m
    
    # Panoramic Side Mirrored Glass Bay
    side_bay_w = 4.40
    side_bay_y = -1.80
    side_frame_d = 0.08
    
    create_box("AMAD_Side_Frame_Top", (side_x - 0.04, side_bay_y, glass_top_z), (side_frame_d, side_bay_w + 0.08, side_frame_d), mat_frame_dark, root)
    create_box("AMAD_Side_Frame_Bot", (side_x - 0.04, side_bay_y, glass_bot_z), (side_frame_d, side_bay_w + 0.08, side_frame_d), mat_frame_dark, root)
    create_box("AMAD_Side_Frame_Front", (side_x - 0.04, side_bay_y - side_bay_w / 2.0, glass_mid_z), (side_frame_d, side_frame_d, glass_h), mat_frame_dark, root)
    create_box("AMAD_Side_Frame_Rear", (side_x - 0.04, side_bay_y + side_bay_w / 2.0, glass_mid_z), (side_frame_d, side_frame_d, glass_h), mat_frame_dark, root)
    create_box("AMAD_Side_Mullion_1", (side_x - 0.04, side_bay_y - side_bay_w / 6.0, glass_mid_z), (side_frame_d, 0.05, glass_h), mat_frame_dark, root)
    create_box("AMAD_Side_Mullion_2", (side_x - 0.04, side_bay_y + side_bay_w / 6.0, glass_mid_z), (side_frame_d, 0.05, glass_h), mat_frame_dark, root)
    
    # Side Blinds & Side Mirrored Glass
    create_box("AMAD_Side_Blinds", (side_x + 0.02, side_bay_y, glass_mid_z), (0.015, side_bay_w - 0.04, glass_h - 0.04), mat_blinds, root)
    create_box("AMAD_Side_Mirror_Glass", (side_x - 0.02, side_bay_y, glass_mid_z), (0.015, side_bay_w - 0.02, glass_h - 0.02), mat_mirror_glass, root)
    
    # Air Conditioning Condenser Unit (IMG_3815)
    ac_x = side_x - 0.38
    ac_y = 1.30
    ac_z = PLINTH_H + 0.42
    create_box("AMAD_AC_Base", (ac_x, ac_y, PLINTH_H + 0.05), (0.42, 0.85, 0.10), mat_stone_cap, root)
    create_box("AMAD_AC_Cabinet", (ac_x, ac_y, ac_z), (0.38, 0.80, 0.62), mat_ac_metal, root)
    create_cylinder("AMAD_AC_FanGrille", (ac_x - 0.20, ac_y - 0.10, ac_z), 0.20, 0.03, mat_frame_dark, 14, rot=(0, math.radians(90), 0), parent=root)
    create_cylinder("AMAD_AC_Conduit", (ac_x + 0.14, ac_y - 0.28, (ac_z + EAVE_Z) / 2.0), 0.025, EAVE_Z - ac_z, mat_wall, 8, parent=root)

    # 8. Spanish Terracotta Clay Hipped Roof Structure (IMG_3814 & IMG_3815)
    roof_w = TOTAL_W + 2 * OVERHANG # 15.70m
    roof_d = TOTAL_D + 2 * OVERHANG # 16.90m
    roof_h = 2.50                   # Authentic 27-degree Mediterranean pitch!
    peak_w = 3.40                   # Apex ridge width
    peak_d = 4.60                   # Apex ridge depth
    
    # Grooved Under-Eave Soffit Underside
    create_box("AMAD_Roof_Soffit", (0, 0, EAVE_Z - 0.04), (roof_w, roof_d, 0.08), mat_soffit, root)
    
    # Deep Mahogany Perimeter Fascia Board Trim
    create_box("AMAD_Roof_Fascia", (0, 0, EAVE_Z + 0.09), (roof_w + 0.14, roof_d + 0.14, 0.22), mat_roof_fascia, root)
    
    # 4-Sided Hipped Terracotta Clay Tiled Roof
    create_hipped_roof("AMAD_Roof_Tiles", (0, 0, EAVE_Z + 0.18), roof_w, roof_d, peak_w, peak_d, roof_h, mat_roof_tile, root)
    
    # Terracotta Apex Ridge Cap
    create_box("AMAD_Apex_Ridge", (0, 0, EAVE_Z + 0.18 + roof_h + 0.04), (peak_w + 0.16, peak_d + 0.16, 0.09), mat_roof_ridge, root)
    
    # 4 Hipped Ridge Caps sloping along the 4 hip ridges
    hw_b, hd_b = roof_w / 2.0, roof_d / 2.0
    hw_p, hd_p = peak_w / 2.0, peak_d / 2.0
    hip_corners = [
        ((-hw_b, -hd_b), (-hw_p, -hd_p)), # Front-Left
        (( hw_b, -hd_b), ( hw_p, -hd_p)), # Front-Right
        (( hw_b,  hd_b), ( hw_p,  hd_p)), # Rear-Right
        ((-hw_b,  hd_b), (-hw_p,  hd_p))  # Rear-Left
    ]
    for h_i, (b_pt, p_pt) in enumerate(hip_corners):
        p_start = (b_pt[0], b_pt[1], EAVE_Z + 0.18)
        p_end   = (p_pt[0], p_pt[1], EAVE_Z + 0.18 + roof_h)
        create_ridge_bar(f"AMAD_HipCap_{h_i}", p_start, p_end, 0.20, 0.08, mat_roof_ridge, root)

    # 9. Lighting in Foyer
    for obj in list(bpy.data.objects):
        if obj.name.startswith("AMAD_Light_"):
            bpy.data.objects.remove(obj, do_unlink=True)
            
    l_data = bpy.data.lights.new(name="AMAD_Light_Data", type='POINT')
    l_data.energy = 50.0
    l_data.color = (1.0, 0.95, 0.88)
    l_obj = bpy.data.objects.new("AMAD_Light_0", l_data)
    bpy.context.scene.collection.objects.link(l_obj)
    l_obj.location = (0, front_y + 1.20, EAVE_Z - 0.30)
    l_obj.parent = root

    # 10. WebGL GLB Export
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    
    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\amad_building.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"Exported Rebuilt AMAD Building GLB to {glb_out} (Size: {file_size_kb:.1f} KB)")
    return root

build_amad_building()
