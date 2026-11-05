"""
Bespoke Authentic 3D Automated Weather Station (AWS) Generator for DA-LARES.
Based strictly on ground-truth field photographs:
- IMG_3998 to IMG_4008 in 'Building Images/AWS/'
- High-resolution forensic crops in 'scratch/aws_crops/'
- Texture-mapped authentic Davis Solar Kit face from IMG_4003 ('scratch/davis_solar_kit_face_texture.png')
- Texture-mapped authentic Davis Transmitter face from IMG_4002 ('scratch/davis_tx_face_texture.png')

Strict adherence to:
- Rule 1: Strictly one building at a time.
- Rule 2: Performance budget strictly under 300 KB.
- Rule 4: No extraneous outdoor props (no lawn, no external terrain, pure compound structure only).
- Rule 6: Strictly standalone research station (no offices in offices.js).
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector, Euler, Matrix

def run():
    print("=== STARTING PERFECT AWS GENERATOR V2 ===")
    
    # 1. Clean scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for col in bpy.data.collections:
        bpy.data.collections.remove(col)
    
    main_col = bpy.data.collections.new("AutomatedWeatherStation")
    bpy.context.scene.collection.children.link(main_col)
    
    # 2. Setup PBR Materials
    def get_or_create_material(name, base_color, metallic=0.0, roughness=0.5):
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        nodes.clear()
        
        node_output = nodes.new(type='ShaderNodeOutputMaterial')
        node_principled = nodes.new(type='ShaderNodeBsdfPrincipled')
        node_principled.inputs['Base Color'].default_value = base_color
        node_principled.inputs['Metallic'].default_value = metallic
        node_principled.inputs['Roughness'].default_value = roughness
        
        mat.node_tree.links.new(node_principled.outputs['BSDF'], node_output.inputs['Surface'])
        return mat
    
    # Materials
    mat_concrete = get_or_create_material("AWS_Concrete", (0.58, 0.60, 0.58, 1.0), 0.0, 0.85)
    mat_galvanized = get_or_create_material("AWS_GalvanizedSteel", (0.75, 0.77, 0.76, 1.0), 0.7, 0.35)
    mat_fence_pipe = get_or_create_material("AWS_FencePipe", (0.80, 0.83, 0.82, 1.0), 0.5, 0.45)
    mat_wire_mesh = get_or_create_material("AWS_WireMesh", (0.65, 0.67, 0.65, 1.0), 0.6, 0.4)
    mat_plastic_white = get_or_create_material("AWS_PlasticWhite", (0.91, 0.92, 0.90, 1.0), 0.05, 0.3)
    mat_plastic_black = get_or_create_material("AWS_PlasticBlack", (0.12, 0.13, 0.14, 1.0), 0.1, 0.45)
    mat_black_rubber = get_or_create_material("AWS_BlackRubber", (0.08, 0.08, 0.09, 1.0), 0.0, 0.8)
    mat_brass_lock = get_or_create_material("AWS_BrassLock", (0.78, 0.65, 0.22, 1.0), 0.85, 0.3)
    
    # Textured Material for Solar Kit Face (IMG_4003)
    solar_tex_path = os.path.abspath("scratch/davis_solar_kit_face_texture.jpg")
    mat_solar_kit = bpy.data.materials.new(name="AWS_SolarKitTextured")
    mat_solar_kit.use_nodes = True
    sk_nodes = mat_solar_kit.node_tree.nodes
    sk_nodes.clear()
    sk_out = sk_nodes.new(type='ShaderNodeOutputMaterial')
    sk_bsdf = sk_nodes.new(type='ShaderNodeBsdfPrincipled')
    sk_bsdf.inputs['Roughness'].default_value = 0.25
    sk_bsdf.inputs['Metallic'].default_value = 0.05
    
    if os.path.exists(solar_tex_path):
        sk_img = sk_nodes.new(type='ShaderNodeTexImage')
        sk_img.image = bpy.data.images.load(solar_tex_path)
        mat_solar_kit.node_tree.links.new(sk_img.outputs['Color'], sk_bsdf.inputs['Base Color'])
    else:
        sk_bsdf.inputs['Base Color'].default_value = (0.12, 0.18, 0.28, 1.0)
    mat_solar_kit.node_tree.links.new(sk_bsdf.outputs['BSDF'], sk_out.inputs['Surface'])
    
    # Textured Material for Transmitter Units (IMG_4002)
    tx_tex_path = os.path.abspath("scratch/davis_tx_face_texture.jpg")
    mat_tx_textured = bpy.data.materials.new(name="AWS_TxTextured")
    mat_tx_textured.use_nodes = True
    tx_nodes = mat_tx_textured.node_tree.nodes
    tx_nodes.clear()
    tx_out = tx_nodes.new(type='ShaderNodeOutputMaterial')
    tx_bsdf = tx_nodes.new(type='ShaderNodeBsdfPrincipled')
    tx_bsdf.inputs['Roughness'].default_value = 0.3
    tx_bsdf.inputs['Metallic'].default_value = 0.05
    
    if os.path.exists(tx_tex_path):
        tx_img = tx_nodes.new(type='ShaderNodeTexImage')
        tx_img.image = bpy.data.images.load(tx_tex_path)
        mat_tx_textured.node_tree.links.new(tx_img.outputs['Color'], tx_bsdf.inputs['Base Color'])
    else:
        tx_bsdf.inputs['Base Color'].default_value = (0.15, 0.20, 0.25, 1.0)
    mat_tx_textured.node_tree.links.new(tx_bsdf.outputs['BSDF'], tx_out.inputs['Surface'])
    
    created_objects = []
    
    # ---------------------------------------------------------
    # Helper functions
    # ---------------------------------------------------------
    def add_cylinder(name, radius, depth, location, rotation=(0,0,0), vertices=8, material=None):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=vertices,
            radius=radius,
            depth=depth,
            location=location,
            rotation=rotation
        )
        obj = bpy.context.active_object
        obj.name = name
        if material:
            obj.data.materials.append(material)
        created_objects.append(obj)
        return obj

    def add_box(name, size, location, rotation=(0,0,0), material=None):
        bpy.ops.mesh.primitive_cube_add(
            size=1.0,
            location=location,
            rotation=rotation
        )
        obj = bpy.context.active_object
        obj.name = name
        obj.scale = size
        bpy.ops.object.transform_apply(scale=True)
        if material:
            obj.data.materials.append(material)
        created_objects.append(obj)
        return obj

    # =========================================================
    # 1. FOUNDATION CURB & EQUIPMENT PAD (IMG_3998, IMG_4001)
    # =========================================================
    # Low concrete perimeter curb
    curb_w = 3.28
    curb_t = 0.14
    curb_h = 0.12
    # 4 curb beams around compound perimeter
    add_box("Curb_Front", (curb_w, curb_t, curb_h), (0.0, -curb_w/2 + curb_t/2, curb_h/2), material=mat_concrete)
    add_box("Curb_Back", (curb_w, curb_t, curb_h), (0.0, curb_w/2 - curb_t/2, curb_h/2), material=mat_concrete)
    add_box("Curb_Left", (curb_t, curb_w - 2*curb_t, curb_h), (-curb_w/2 + curb_t/2, 0.0, curb_h/2), material=mat_concrete)
    add_box("Curb_Right", (curb_t, curb_w - 2*curb_t, curb_h), (curb_w/2 - curb_t/2, 0.0, curb_h/2), material=mat_concrete)
    
    # Center square equipment pad for the tripod
    pad_size = 1.15
    pad_h = 0.10
    add_box("EquipmentPad", (pad_size, pad_size, pad_h), (0.0, 0.0, pad_h/2), material=mat_concrete)
    
    # =========================================================
    # 2. PERIMETER FENCE & GATE (IMG_3998, IMG_3999)
    # =========================================================
    post_r = 0.038
    post_h = 1.35
    f_half = 1.55
    
    # Corner posts (NW, NE, SE, SW)
    corner_locs = [
        (-f_half, -f_half), # SW (Front-Left)
        (f_half, -f_half),  # SE (Front-Right)
        (f_half, f_half),   # NE (Rear-Right)
        (-f_half, f_half)   # NW (Rear-Left)
    ]
    
    for i, (px, py) in enumerate(corner_locs):
        add_cylinder(f"Post_Corner_{i}", post_r, post_h, (px, py, post_h/2 + curb_h), vertices=8, material=mat_fence_pipe)
        
        # 45-degree angled barbed wire cranked outrigger arm (IMG_3998, IMG_4007)
        # Angled outward from the center
        ang_z = math.atan2(py, px)
        arm_len = 0.38
        arm_r = 0.022
        # Cranked arm pointing up and outward
        dx = math.cos(ang_z) * arm_len * 0.5 * 0.707
        dy = math.sin(ang_z) * arm_len * 0.5 * 0.707
        dz = arm_len * 0.5 * 0.707
        
        # Pitch 45 deg, yaw ang_z
        rot = Euler((math.sin(ang_z) * math.radians(-45), math.cos(ang_z) * math.radians(45), 0), 'XYZ')
        add_cylinder(f"Arm_Corner_{i}", arm_r, arm_len, (px + dx, py + dy, post_h + curb_h + dz), rotation=rot, vertices=6, material=mat_fence_pipe)
    
    # Front divider post between swing gate and fixed panel
    div_x = 0.0
    div_y = -f_half
    add_cylinder("Post_Divider", post_r, post_h, (div_x, div_y, post_h/2 + curb_h), vertices=8, material=mat_fence_pipe)
    # Divider barbed wire arm (cranked outward toward -Y)
    div_arm_rot = Euler((math.radians(45), 0, 0), 'XYZ')
    add_cylinder("Arm_Divider", 0.022, 0.38, (div_x, div_y - 0.13, post_h + curb_h + 0.13), rotation=div_arm_rot, vertices=6, material=mat_fence_pipe)
    
    # Horizontal top & bottom rails
    rail_r = 0.026
    # Left wall rails
    add_cylinder("Rail_Left_Top", rail_r, 2*f_half, (-f_half, 0.0, post_h + curb_h - 0.04), rotation=(math.radians(90), 0, 0), vertices=6, material=mat_fence_pipe)
    add_cylinder("Rail_Left_Bot", rail_r, 2*f_half, (-f_half, 0.0, curb_h + 0.08), rotation=(math.radians(90), 0, 0), vertices=6, material=mat_fence_pipe)
    # Right wall rails
    add_cylinder("Rail_Right_Top", rail_r, 2*f_half, (f_half, 0.0, post_h + curb_h - 0.04), rotation=(math.radians(90), 0, 0), vertices=6, material=mat_fence_pipe)
    add_cylinder("Rail_Right_Bot", rail_r, 2*f_half, (f_half, 0.0, curb_h + 0.08), rotation=(math.radians(90), 0, 0), vertices=6, material=mat_fence_pipe)
    # Rear wall rails
    add_cylinder("Rail_Rear_Top", rail_r, 2*f_half, (0.0, f_half, post_h + curb_h - 0.04), rotation=(0, math.radians(90), 0), vertices=6, material=mat_fence_pipe)
    add_cylinder("Rail_Rear_Bot", rail_r, 2*f_half, (0.0, f_half, curb_h + 0.08), rotation=(0, math.radians(90), 0), vertices=6, material=mat_fence_pipe)
    # Front right fixed panel rails
    add_cylinder("Rail_FrontR_Top", rail_r, f_half, (f_half/2, -f_half, post_h + curb_h - 0.04), rotation=(0, math.radians(90), 0), vertices=6, material=mat_fence_pipe)
    add_cylinder("Rail_FrontR_Bot", rail_r, f_half, (f_half/2, -f_half, curb_h + 0.08), rotation=(0, math.radians(90), 0), vertices=6, material=mat_fence_pipe)
    
    # Front Left Swing Gate (IMG_3998)
    gate_w = f_half - 0.06
    gate_h = post_h - 0.16
    gate_cx = -f_half/2 - 0.02
    gate_y = -f_half
    gate_cz = curb_h + 0.08 + gate_h/2
    gate_pipe_r = 0.022
    # Gate rectangular frame
    add_cylinder("Gate_Top", gate_pipe_r, gate_w, (gate_cx, gate_y, curb_h + post_h - 0.08), rotation=(0, math.radians(90), 0), vertices=6, material=mat_fence_pipe)
    add_cylinder("Gate_Bot", gate_pipe_r, gate_w, (gate_cx, gate_y, curb_h + 0.12), rotation=(0, math.radians(90), 0), vertices=6, material=mat_fence_pipe)
    add_cylinder("Gate_Left", gate_pipe_r, gate_h, (-f_half + 0.05, gate_y, gate_cz), vertices=6, material=mat_fence_pipe)
    add_cylinder("Gate_Right", gate_pipe_r, gate_h, (-0.05, gate_y, gate_cz), vertices=6, material=mat_fence_pipe)
    
    # Gate barrel hinges on SW post
    add_cylinder("Gate_Hinge_Top", 0.018, 0.08, (-f_half + 0.02, gate_y, curb_h + post_h - 0.20), vertices=6, material=mat_galvanized)
    add_cylinder("Gate_Hinge_Bot", 0.018, 0.08, (-f_half + 0.02, gate_y, curb_h + 0.25), vertices=6, material=mat_galvanized)
    
    # Gate chain wrap & brass padlock on center divider post (IMG_3998, IMG_4008)
    add_cylinder("Gate_Chain", 0.020, 0.16, (-0.02, gate_y - 0.02, curb_h + post_h/2), rotation=(0, math.radians(90), 0), vertices=6, material=mat_galvanized)
    add_box("Gate_Padlock", (0.04, 0.03, 0.05), (-0.02, gate_y - 0.04, curb_h + post_h/2 - 0.03), material=mat_brass_lock)
    
    # 3 Strands of Barbed Wire running across cranked outriggers (IMG_3998)
    # Using 4-sided wire extrusions for optimal performance budget
    strand_offsets = [0.08, 0.18, 0.28]
    # Perimeter points for barbed wire
    bw_corners = [
        (-f_half - 0.13, -f_half - 0.13), # SW
        (f_half + 0.13, -f_half - 0.13),  # SE
        (f_half + 0.13, f_half + 0.13),   # NE
        (-f_half - 0.13, f_half + 0.13)   # NW
    ]
    for s_idx, s_dz in enumerate(strand_offsets):
        s_z = post_h + curb_h + s_dz
        for c_idx in range(4):
            p1 = bw_corners[c_idx]
            p2 = bw_corners[(c_idx + 1) % 4]
            mx = (p1[0] + p2[0]) / 2
            my = (p1[1] + p2[1]) / 2
            length = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
            ang = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
            add_box(f"BarbedStrand_{s_idx}_{c_idx}", (length, 0.005, 0.005), (mx, my, s_z), rotation=(0, 0, ang), material=mat_galvanized)

    # Infill Wire Mesh Panels (Galvanized Welded Wire Mesh)
    # Lightweight diamond bars spaced 0.25m for optimal size budget
    mesh_step = 0.25
    mesh_z_bot = curb_h + 0.12
    mesh_z_top = curb_h + post_h - 0.06
    mesh_h = mesh_z_top - mesh_z_bot
    mesh_cz = (mesh_z_bot + mesh_z_top) / 2
    
    # Left wall mesh
    lx = -f_half
    for y_bar in range(int(-f_half/mesh_step), int(f_half/mesh_step)):
        by = y_bar * mesh_step
        add_box(f"Mesh_L_v_{y_bar}", (0.004, 0.004, mesh_h), (lx, by, mesh_cz), material=mat_wire_mesh)
    for z_bar in range(1, int(mesh_h/mesh_step)):
        bz = mesh_z_bot + z_bar * mesh_step
        add_box(f"Mesh_L_h_{z_bar}", (0.004, 2*f_half, 0.004), (lx, 0.0, bz), material=mat_wire_mesh)
        
    # Right wall mesh
    rx = f_half
    for y_bar in range(int(-f_half/mesh_step), int(f_half/mesh_step)):
        by = y_bar * mesh_step
        add_box(f"Mesh_R_v_{y_bar}", (0.004, 0.004, mesh_h), (rx, by, mesh_cz), material=mat_wire_mesh)
    for z_bar in range(1, int(mesh_h/mesh_step)):
        bz = mesh_z_bot + z_bar * mesh_step
        add_box(f"Mesh_R_h_{z_bar}", (0.004, 2*f_half, 0.004), (rx, 0.0, bz), material=mat_wire_mesh)
        
    # Rear wall mesh
    ry = f_half
    for x_bar in range(int(-f_half/mesh_step), int(f_half/mesh_step)):
        bx = x_bar * mesh_step
        add_box(f"Mesh_B_v_{x_bar}", (0.004, 0.004, mesh_h), (bx, ry, mesh_cz), material=mat_wire_mesh)
    for z_bar in range(1, int(mesh_h/mesh_step)):
        bz = mesh_z_bot + z_bar * mesh_step
        add_box(f"Mesh_B_h_{z_bar}", (2*f_half, 0.004, 0.004), (0.0, ry, bz), material=mat_wire_mesh)

    # Front fixed panel mesh
    fy = -f_half
    for x_bar in range(0, int(f_half/mesh_step)):
        bx = x_bar * mesh_step + 0.05
        add_box(f"Mesh_FR_v_{x_bar}", (0.004, 0.004, mesh_h), (bx, fy, mesh_cz), material=mat_wire_mesh)
    for z_bar in range(1, int(mesh_h/mesh_step)):
        bz = mesh_z_bot + z_bar * mesh_step
        add_box(f"Mesh_FR_h_{z_bar}", (f_half, 0.004, 0.004), (f_half/2, fy, bz), material=mat_wire_mesh)

    # Swing Gate mesh
    for x_bar in range(int(-f_half/mesh_step), 0):
        bx = x_bar * mesh_step + 0.08
        add_box(f"Mesh_Gate_v_{x_bar}", (0.004, 0.004, mesh_h - 0.04), (bx, fy, mesh_cz), material=mat_wire_mesh)
    for z_bar in range(1, int(mesh_h/mesh_step)):
        bz = mesh_z_bot + z_bar * mesh_step
        add_box(f"Mesh_Gate_h_{z_bar}", (gate_w - 0.04, 0.004, 0.004), (gate_cx, fy, bz), material=mat_wire_mesh)

    # =========================================================
    # 3. CENTRAL MAST & TRIPOD (IMG_4001, IMG_4002)
    # =========================================================
    # Weathered galvanized mast pipe
    mast_r = 0.024
    mast_h = 2.40
    mast_cz = pad_h + mast_h/2
    add_cylinder("Center_Mast", mast_r, mast_h, (0.0, 0.0, mast_cz), vertices=8, material=mat_galvanized)
    
    # Tripod apex collar on mast
    collar_z = pad_h + 0.62
    add_cylinder("Tripod_Apex_Collar", 0.038, 0.08, (0.0, 0.0, collar_z), vertices=8, material=mat_galvanized)
    
    # Spreader slider collar on mast
    slider_z = pad_h + 0.28
    add_cylinder("Tripod_Slider_Collar", 0.036, 0.06, (0.0, 0.0, slider_z), vertices=8, material=mat_galvanized)
    # Collar clamp bolt with wing nut
    add_box("Collar_Thumb_Bolt", (0.06, 0.02, 0.02), (0.03, 0.0, slider_z), material=mat_galvanized)
    
    # 3 Tripod legs:
    # Authentically oriented per IMG_4001:
    # 2 legs in front spreading outward (front-left and front-right), leaving entrance wide open
    # 1 leg in rear pointing straight back (+Y)
    leg_angles = [
        math.radians(215),  # Front-Left
        math.radians(325),  # Front-Right
        math.radians(90)    # Rear (+Y)
    ]
    foot_radius = 0.44
    leg_r = 0.016
    for idx, ang in enumerate(leg_angles):
        foot_x = math.cos(ang) * foot_radius
        foot_y = math.sin(ang) * foot_radius
        foot_z = pad_h
        
        # Leg tube vector from collar to foot
        dx = foot_x - 0.0
        dy = foot_y - 0.0
        dz = foot_z - collar_z
        leg_len = math.sqrt(dx*dx + dy*dy + dz*dz)
        mid_x = foot_x / 2
        mid_y = foot_y / 2
        mid_z = (collar_z + foot_z) / 2
        
        # Pitch and Yaw
        pitch = math.atan2(math.hypot(dx, dy), -dz)
        yaw = math.atan2(dy, dx)
        rot = Euler((0, pitch, yaw), 'ZXY')
        add_cylinder(f"Tripod_Leg_{idx}", leg_r, leg_len, (mid_x, mid_y, mid_z), rotation=rot, vertices=6, material=mat_galvanized)
        
        # Horizontal spreader brace from slider collar to leg
        spreader_target_x = foot_x * 0.55
        spreader_target_y = foot_y * 0.55
        s_mid_x = spreader_target_x / 2
        s_mid_y = spreader_target_y / 2
        s_len = math.hypot(spreader_target_x, spreader_target_y)
        s_rot = Euler((0, math.radians(90), yaw), 'ZXY')
        add_box(f"Tripod_Spreader_{idx}", (s_len, 0.015, 0.005), (s_mid_x, s_mid_y, slider_z), rotation=(0, 0, yaw), material=mat_galvanized)
        
        # Stamped metal footing pad bolted to concrete pad
        add_box(f"Tripod_Foot_{idx}", (0.06, 0.06, 0.008), (foot_x, foot_y, pad_h + 0.004), material=mat_galvanized)
        add_cylinder(f"Foot_Bolt_{idx}", 0.006, 0.02, (foot_x, foot_y, pad_h + 0.014), vertices=6, material=mat_galvanized)

    # =========================================================
    # 4. LOWER AUXILIARY TRANSMITTER UNIT (IMG_4001, IMG_4002)
    # =========================================================
    # Short vertical galvanized pipe post at front-left of equipment pad
    tx_post_x = -0.38
    tx_post_y = -0.35
    tx_post_h = 0.68
    add_cylinder("Aux_Tx_Post", 0.022, tx_post_h, (tx_post_x, tx_post_y, pad_h + tx_post_h/2), vertices=8, material=mat_galvanized)
    
    # Davis transmitter enclosure box (IMG_4002)
    # Box body
    tx_box_w = 0.16
    tx_box_h = 0.22
    tx_box_d = 0.09
    tx_box_z = pad_h + 0.44
    add_box("Aux_Tx_Body", (tx_box_w, tx_box_d, tx_box_h), (tx_post_x, tx_post_y - 0.05, tx_box_z), material=mat_plastic_white)
    
    # Angled solar panel front face with authentic Davis texture
    # Create quad with exact UV mapping [0, 1] x [0, 1]
    def create_textured_quad(name, size_w, size_h, location, rotation, material):
        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        bm = bmesh.new()
        hw = size_w / 2
        hh = size_h / 2
        # Quad vertices in XY plane
        v1 = bm.verts.new((-hw, 0.0, -hh))
        v2 = bm.verts.new((hw, 0.0, -hh))
        v3 = bm.verts.new((hw, 0.0, hh))
        v4 = bm.verts.new((-hw, 0.0, hh))
        face = bm.faces.new((v1, v2, v3, v4))
        
        # UV Layer
        uv_layer = bm.loops.layers.uv.new()
        face.loops[0][uv_layer].uv = (0.0, 0.0)
        face.loops[1][uv_layer].uv = (1.0, 0.0)
        face.loops[2][uv_layer].uv = (1.0, 1.0)
        face.loops[3][uv_layer].uv = (0.0, 1.0)
        
        bm.to_mesh(mesh)
        bm.free()
        
        obj = bpy.data.objects.new(name, mesh)
        obj.location = location
        obj.rotation_euler = rotation
        obj.data.materials.append(material)
        bpy.context.scene.collection.objects.link(obj)
        created_objects.append(obj)
        return obj

    # Flush front face for aux tx (facing -Y)
    create_textured_quad("Aux_Tx_SolarFace", tx_box_w * 0.94, tx_box_h * 0.94, 
                         (tx_post_x, tx_post_y - 0.05 - tx_box_d/2 - 0.004, tx_box_z), 
                         Euler((0, 0, 0)), mat_tx_textured)
    
    # Side snap-latches on transmitter box (IMG_4002)
    add_box("Aux_Tx_Latch_Top", (0.015, 0.035, 0.02), (tx_post_x + tx_box_w/2 + 0.006, tx_post_y - 0.05, tx_box_z + 0.05), material=mat_plastic_white)
    add_box("Aux_Tx_Latch_Bot", (0.015, 0.035, 0.02), (tx_post_x + tx_box_w/2 + 0.006, tx_post_y - 0.05, tx_box_z - 0.05), material=mat_plastic_white)
    # Pole clamp backing plate & hex nuts (IMG_4002)
    add_box("Aux_Tx_Clamp_Plate", (0.08, 0.01, 0.035), (tx_post_x, tx_post_y + 0.02, tx_box_z + 0.08), material=mat_galvanized)
    add_cylinder("Aux_Tx_Nut1", 0.006, 0.015, (tx_post_x - 0.025, tx_post_y + 0.03, tx_box_z + 0.08), rotation=(math.radians(90), 0, 0), vertices=6, material=mat_galvanized)
    add_cylinder("Aux_Tx_Nut2", 0.006, 0.015, (tx_post_x + 0.025, tx_post_y + 0.03, tx_box_z + 0.08), rotation=(math.radians(90), 0, 0), vertices=6, material=mat_galvanized)
    
    # Coiled wire loop around base of auxiliary pipe (IMG_4002)
    add_cylinder("Aux_Tx_Wire_Coil", 0.065, 0.04, (tx_post_x, tx_post_y, pad_h + 0.03), vertices=8, material=mat_black_rubber)

    # =========================================================
    # 5. MIDDLE SOLAR-LIKE STRUCTURE (IMG_4003, IMG_4001, IMG_4008)
    # =========================================================
    # Genuine Davis Solar Power Kit weatherized cabinet
    # Dimensions: 0.32m W x 0.25m H x 0.10m D
    # Tilted back 28 deg from vertical, facing directly -Y (front gate)
    solar_tilt = math.radians(-28)
    solar_center_z = pad_h + 1.25
    solar_center_y = -0.14
    
    # Parent root empty / transform for easy local coordinate placement
    solar_root = bpy.data.objects.new("SolarKit_Root", None)
    solar_root.location = (0.0, solar_center_y, solar_center_z)
    solar_root.rotation_euler = Euler((solar_tilt, 0, 0), 'XYZ')
    bpy.context.scene.collection.objects.link(solar_root)
    created_objects.append(solar_root)
    
    # Enclosure main box body (deep weatherized tub)
    sk_w = 0.32
    sk_h = 0.25
    sk_d = 0.10
    
    sk_body = add_box("SolarKit_Body", (sk_w, sk_d, sk_h), (0.0, 0.0, 0.0), material=mat_plastic_white)
    sk_body.parent = solar_root
    
    # Textured front solar face quad with Davis logo and cell grid (IMG_4003)
    sk_face = create_textured_quad("SolarKit_FrontFace", sk_w, sk_h,
                                   (0.0, -sk_d/2 - 0.004, 0.0), Euler((0,0,0)), mat_solar_kit)
    sk_face.parent = solar_root
    
    # Plastic snap latches on right side (IMG_4003)
    sk_latch1 = add_box("SolarKit_Latch_Top", (0.022, 0.045, 0.035), (sk_w/2 + 0.010, -0.01, sk_h * 0.25), material=mat_plastic_white)
    sk_latch1.parent = solar_root
    sk_latch2 = add_box("SolarKit_Latch_Bot", (0.022, 0.045, 0.035), (sk_w/2 + 0.010, -0.01, -sk_h * 0.25), material=mat_plastic_white)
    sk_latch2.parent = solar_root
    # Padlock eyelet tab at bottom right (IMG_4003)
    sk_eyelet = add_box("SolarKit_EyeletTab", (0.016, 0.03, 0.025), (sk_w/2 + 0.008, -0.02, -sk_h/2 + 0.02), material=mat_plastic_white)
    sk_eyelet.parent = solar_root
    
    # Left side molded barrel hinges (IMG_4003)
    sk_hinge1 = add_cylinder("SolarKit_Hinge_Top", 0.012, 0.05, (-sk_w/2 - 0.006, 0.0, sk_h * 0.25), vertices=6, material=mat_plastic_white)
    sk_hinge1.parent = solar_root
    sk_hinge2 = add_cylinder("SolarKit_Hinge_Bot", 0.012, 0.05, (-sk_w/2 - 0.006, 0.0, -sk_h * 0.25), vertices=6, material=mat_plastic_white)
    sk_hinge2.parent = solar_root
    
    # Bottom cable gland fitting & black cable emerging (IMG_4003)
    sk_gland = add_cylinder("SolarKit_Gland", 0.012, 0.03, (0.08, 0.01, -sk_h/2 - 0.015), vertices=6, material=mat_plastic_black)
    sk_gland.parent = solar_root
    sk_wire_tail = add_cylinder("SolarKit_WireTail", 0.005, 0.12, (0.08, 0.03, -sk_h/2 - 0.06), rotation=(math.radians(30), 0, 0), vertices=6, material=mat_black_rubber)
    sk_wire_tail.parent = solar_root

    # Underside Galvanized Steel Mounting Bracket (IMG_4003, IMG_4008)
    # 1. Top horizontal mounting flange bolted under box bottom
    sk_mount_flange = add_box("SolarKit_Flange_Top", (0.14, 0.05, 0.008), (0.0, 0.0, -sk_h/2 - 0.004), material=mat_galvanized)
    sk_mount_flange.parent = solar_root
    # 2 Hex bolts & nuts on the bracket flange (IMG_4003)
    sk_bolt1 = add_cylinder("SolarKit_FlangeBolt1", 0.008, 0.02, (-0.035, -0.01, -sk_h/2 - 0.012), vertices=6, material=mat_galvanized)
    sk_bolt1.parent = solar_root
    sk_bolt2 = add_cylinder("SolarKit_FlangeBolt2", 0.008, 0.02, (0.035, -0.01, -sk_h/2 - 0.012), vertices=6, material=mat_galvanized)
    sk_bolt2.parent = solar_root
    
    # 2. Diagonal cantilever strut plate sloping down and back to the mast collar
    bracket_collar_z = pad_h + 1.05
    bracket_top_world = solar_root.matrix_world @ Vector((0.0, 0.0, -sk_h/2))
    b_dz = bracket_collar_z - bracket_top_world.z
    b_dy = 0.0 - bracket_top_world.y
    b_mid_z = (bracket_collar_z + bracket_top_world.z) / 2
    b_mid_y = bracket_top_world.y + b_dy / 2
    b_len = math.hypot(b_dy, b_dz)
    b_ang = math.atan2(b_dy, -b_dz)
    add_box("SolarKit_StrutPlate", (0.10, 0.008, b_len), (0.0, b_mid_y, b_mid_z), rotation=(b_ang, 0, 0), material=mat_galvanized)
    
    # 3. Mast Clamp Collar & U-bolt (IMG_4003, IMG_4008)
    add_box("SolarKit_CollarPlate", (0.12, 0.008, 0.06), (0.0, -mast_r - 0.004, bracket_collar_z), material=mat_galvanized)
    # Rounded U-bolt passing around mast (IMG_4003)
    add_cylinder("SolarKit_UBolt_Ring", 0.028, 0.015, (0.0, 0.0, bracket_collar_z), rotation=(math.radians(90), 0, 0), vertices=8, material=mat_galvanized)
    # Horizontal through-bolt on mast below collar (IMG_4003)
    add_cylinder("SolarKit_ThroughBolt", 0.006, 0.08, (0.0, 0.0, bracket_collar_z - 0.05), rotation=(0, math.radians(90), 0), vertices=6, material=mat_galvanized)
    
    # Coiled Wire Donut / Spool on Mast above Solar Box (IMG_4003, IMG_4004)
    spool_z = pad_h + 1.55
    spool_r_outer = 0.08
    spool_depth = 0.06
    # Donut coil cylinder
    add_cylinder("Wire_Spool_Donut", spool_r_outer, spool_depth, (0.0, 0.0, spool_z), rotation=(math.radians(90), 0, 0), vertices=12, material=mat_black_rubber)
    # Zip ties binding the wire coil (IMG_4003)
    add_cylinder("Wire_Spool_Tie1", spool_r_outer + 0.004, 0.012, (0.0, -0.02, spool_z), rotation=(math.radians(90), 0, 0), vertices=8, material=mat_plastic_black)
    add_cylinder("Wire_Spool_Tie2", spool_r_outer + 0.004, 0.012, (0.0, 0.02, spool_z), rotation=(math.radians(90), 0, 0), vertices=8, material=mat_plastic_black)

    # =========================================================
    # 6. TOP SENSOR SUITE (DAVIS VANTAGE PRO2 ISS)
    # (IMG_4004, IMG_4006, IMG_4007)
    # =========================================================
    iss_base_z = pad_h + 2.12
    
    # Mast clamp cradle / shelf (black UV plastic)
    add_box("ISS_Clamp_Saddle", (0.16, 0.12, 0.08), (-0.04, 0.0, iss_base_z), material=mat_plastic_black)
    
    # Rain Collector Funnel (sitting to the LEFT of the mast: X = -0.16)
    rain_x = -0.16
    rain_y = 0.0
    rain_cone_h = 0.22
    rain_top_r = 0.115
    rain_neck_r = 0.048
    
    # Upper conical funnel bowl
    bpy.ops.mesh.primitive_cone_add(
        vertices=12,
        radius1=rain_top_r,
        radius2=rain_neck_r,
        depth=rain_cone_h,
        location=(rain_x, rain_y, iss_base_z + rain_cone_h/2 + 0.08)
    )
    cone_obj = bpy.context.active_object
    cone_obj.name = "ISS_RainFunnel"
    cone_obj.data.materials.append(mat_plastic_black)
    created_objects.append(cone_obj)
    
    # Upper cylindrical rim collar
    rim_h = 0.04
    rim_z = iss_base_z + rain_cone_h + 0.08 + rim_h/2
    add_cylinder("ISS_RainCollar", rain_top_r + 0.004, rim_h, (rain_x, rain_y, rim_z), vertices=12, material=mat_plastic_black)
    
    # 12 Vertical Bird Deterrent Spikes along rim collar (IMG_4004)
    spike_h = 0.12
    spike_r = 0.0015
    for spk_i in range(12):
        spk_ang = spk_i * (2 * math.pi / 12)
        spk_x = rain_x + math.cos(spk_ang) * (rain_top_r + 0.002)
        spk_y = rain_y + math.sin(spk_ang) * (rain_top_r + 0.002)
        add_cylinder(f"ISS_BirdSpike_{spk_i}", spike_r, spike_h, (spk_x, spk_y, rim_z + rim_h/2 + spike_h/2), vertices=4, material=mat_galvanized)
        
    # Rain cone cylindrical base housing
    add_cylinder("ISS_RainBase", rain_neck_r + 0.035, 0.08, (rain_x, rain_y, iss_base_z + 0.04), vertices=12, material=mat_plastic_black)
    
    # 5-Tier Solar Radiation Shield Louvers (IMG_4004, IMG_4006)
    # Suspended directly below the rain cone base
    louver_r = 0.105
    for l_idx in range(5):
        lz = iss_base_z - 0.02 - l_idx * 0.028
        bpy.ops.mesh.primitive_cone_add(
            vertices=12,
            radius1=louver_r - l_idx*0.004,
            radius2=louver_r - 0.015 - l_idx*0.004,
            depth=0.018,
            location=(rain_x, rain_y, lz)
        )
        l_obj = bpy.context.active_object
        l_obj.name = f"ISS_Louver_{l_idx}"
        l_obj.data.materials.append(mat_plastic_white)
        created_objects.append(l_obj)
        
    # Upper Transmitter Housing with Angled Solar Face (IMG_4004)
    # Sits on the far LEFT of the rain cone (X = -0.32)
    iss_tx_x = -0.30
    iss_tx_y = -0.02
    iss_tx_z = iss_base_z + 0.05
    iss_tx_w = 0.09
    iss_tx_h = 0.15
    iss_tx_d = 0.06
    add_box("ISS_Tx_Body", (iss_tx_w, iss_tx_d, iss_tx_h), (iss_tx_x, iss_tx_y, iss_tx_z), material=mat_plastic_white)
    # Flush solar face on transmitter
    create_textured_quad("ISS_Tx_SolarFace", iss_tx_w * 0.94, iss_tx_h * 0.92,
                         (iss_tx_x, iss_tx_y - iss_tx_d/2 - 0.004, iss_tx_z),
                         Euler((0, 0, 0)), mat_tx_textured)
    # Bracket arm connecting tx to rain cone
    add_box("ISS_Tx_Bracket", (0.08, 0.02, 0.015), (rain_x - 0.08, rain_y, iss_base_z + 0.08), material=mat_plastic_black)

    # Anemometer S-Curved Arm Tube extending to the RIGHT (+X) (IMG_4004, IMG_4006)
    # Curving outward and up to X = +0.42, Z = iss_base_z + 0.32
    arm_segments = [
        # (x, y, z) waypoints for smooth S-curve
        (0.02, 0.0, iss_base_z + 0.04),
        (0.12, 0.0, iss_base_z + 0.10),
        (0.24, 0.0, iss_base_z + 0.20),
        (0.35, 0.0, iss_base_z + 0.30),
        (0.42, 0.0, iss_base_z + 0.34)
    ]
    arm_tube_r = 0.010
    for seg_i in range(len(arm_segments) - 1):
        p1 = Vector(arm_segments[seg_i])
        p2 = Vector(arm_segments[seg_i + 1])
        diff = p2 - p1
        mid = (p1 + p2) / 2
        seg_len = diff.length
        seg_pitch = math.atan2(math.hypot(diff.x, diff.y), diff.z)
        seg_yaw = math.atan2(diff.y, diff.x)
        seg_rot = Euler((0, seg_pitch, seg_yaw), 'ZXY')
        add_cylinder(f"ISS_AnemoArm_{seg_i}", arm_tube_r, seg_len, (mid.x, mid.y, mid.z), rotation=seg_rot, vertices=6, material=mat_plastic_black)
        
    # Anemometer Hub at the end of the arm
    anemo_x = 0.42
    anemo_y = 0.0
    anemo_z = iss_base_z + 0.34
    add_cylinder("ISS_Anemo_Hub", 0.020, 0.12, (anemo_x, anemo_y, anemo_z), vertices=8, material=mat_plastic_black)
    
    # Wind Direction Vane on TOP of hub (IMG_4004)
    vane_z = anemo_z + 0.07
    # Counterweight nose (pointed bullet forward)
    add_cylinder("ISS_Vane_Nose", 0.008, 0.06, (anemo_x - 0.04, anemo_y, vane_z), rotation=(0, math.radians(90), 0), vertices=6, material=mat_plastic_black)
    # Central pivot shaft
    add_cylinder("ISS_Vane_Shaft", 0.005, 0.12, (anemo_x, anemo_y, vane_z), rotation=(0, math.radians(90), 0), vertices=6, material=mat_plastic_black)
    # Davis aerodynamic trapezoidal tail fin (IMG_4004)
    add_box("ISS_Vane_Fin", (0.08, 0.004, 0.06), (anemo_x + 0.06, anemo_y, vane_z + 0.015), material=mat_plastic_black)
    
    # 3-Cup Anemometer Rotating Hub BELOW the vane (IMG_4004)
    cups_z = anemo_z - 0.03
    add_cylinder("ISS_Cup_Rotor", 0.015, 0.025, (anemo_x, anemo_y, cups_z), vertices=8, material=mat_plastic_black)
    
    # 3 Radial spokes and hollow hemispherical cups
    cup_spoke_len = 0.065
    cup_radius = 0.022
    for cup_i in range(3):
        c_ang = cup_i * (2 * math.pi / 3) + math.radians(20)
        cx = anemo_x + math.cos(c_ang) * cup_spoke_len
        cy = anemo_y + math.sin(c_ang) * cup_spoke_len
        # Spoke arm
        add_cylinder(f"ISS_Cup_Spoke_{cup_i}", 0.003, cup_spoke_len,
                     (anemo_x + math.cos(c_ang)*cup_spoke_len/2, anemo_y + math.sin(c_ang)*cup_spoke_len/2, cups_z),
                     rotation=(0, math.radians(90), c_ang), vertices=4, material=mat_plastic_black)
        # Hollow hemispherical cup (using open cylinder / hemisphere)
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=8,
            radius=cup_radius,
            depth=0.018,
            location=(cx, cy, cups_z),
            rotation=(math.radians(90), 0, c_ang + math.radians(90))
        )
        cup_obj = bpy.context.active_object
        cup_obj.name = f"ISS_Cup_{cup_i}"
        cup_obj.data.materials.append(mat_plastic_black)
        created_objects.append(cup_obj)

    # Sensor wiring running from ISS down along mast into spool
    add_cylinder("ISS_Down_Wire", 0.005, 0.60, (0.015, 0.015, iss_base_z - 0.28), vertices=4, material=mat_black_rubber)

    print(f"Total objects created: {len(created_objects)}")
    
    # =========================================================
    # 7. BATCH JOIN BY MATERIAL FOR OPTIMAL GLB PERFORMANCE
    # =========================================================
    # Clear parent relationships before join to prevent transform compounding
    bpy.ops.object.select_all(action='DESELECT')
    for obj in created_objects:
        if obj.type == 'MESH':
            # Apply all transforms to mesh data
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            # Remove parent while maintaining world transform
            matrix_world = obj.matrix_world.copy()
            obj.parent = None
            obj.matrix_world = matrix_world
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            obj.select_set(False)

    # Group mesh objects by material name
    mat_groups = {}
    for obj in created_objects:
        if obj.type == 'MESH':
            mat_name = obj.data.materials[0].name if obj.data.materials else "None"
            mat_groups.setdefault(mat_name, []).append(obj)
            
    joined_objects = []
    for mat_name, objs in mat_groups.items():
        if not objs:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        joined_obj = bpy.context.active_object
        joined_obj.name = f"AWS_{mat_name}"
        joined_objects.append(joined_obj)
        print(f"Joined {len(objs)} objects into {joined_obj.name}")
        
    # Remove any empty objects
    for obj in list(bpy.data.objects):
        if obj.type == 'EMPTY':
            bpy.data.objects.remove(obj, do_unlink=True)

    # =========================================================
    # 8. EXPORT TO GLB
    # =========================================================
    export_path = os.path.abspath("models/automated_weather_station.glb")
    os.makedirs(os.path.dirname(export_path), exist_ok=True)
    
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    
    file_size_kb = os.path.getsize(export_path) / 1024.0
    print(f"=== EXPORT SUCCESSFUL ===")
    print(f"File: {export_path}")
    print(f"Size: {file_size_kb:.2f} KB (Performance budget: < 300 KB)")
    
    return file_size_kb

if __name__ == '__main__':
    run()
