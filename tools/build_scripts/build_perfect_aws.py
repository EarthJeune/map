import bpy
import bmesh
import math
import os

TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\automated_weather_station.glb"

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.meshes):
        bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        bpy.data.materials.remove(block)

def get_or_create_material(name, base_color, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next((n for n in nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        bsdf.inputs['Base Color'].default_value = base_color
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
    return mat

def create_box(name, loc, size, mat=None, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, loc, radius, depth, rot=(0, 0, 0), mat=None, parent=None, vertices=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cone(name, loc, radius1, radius2, depth, rot=(0, 0, 0), mat=None, parent=None, vertices=10):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_hemisphere(name, loc, radius, rot=(0, 0, 0), mat=None, parent=None, segments=8, rings=5):
    """Creates a hollow hemispherical cup for anemometer."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings*2, radius=radius)
    verts_to_delete = [v for v in bm.verts if v.co.z < -0.0001]
    bmesh.ops.delete(bm, geom=verts_to_delete, context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = loc
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_funnel(name, loc, r_top, r_bot, r_inner_top, r_inner_bot, height, mat=None, parent=None, segments=12):
    """Creates a hollow conical funnel bowl with rim for rain gauge."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    bm = bmesh.new()
    verts_outer_top = []
    verts_outer_bot = []
    verts_inner_top = []
    verts_inner_bot = []
    
    for i in range(segments):
        a = (2 * math.pi / segments) * i
        ca = math.cos(a)
        sa = math.sin(a)
        verts_outer_top.append(bm.verts.new((ca * r_top, sa * r_top, height / 2.0)))
        verts_outer_bot.append(bm.verts.new((ca * r_bot, sa * r_bot, -height / 2.0)))
        verts_inner_top.append(bm.verts.new((ca * r_inner_top, sa * r_inner_top, height / 2.0)))
        verts_inner_bot.append(bm.verts.new((ca * r_inner_bot, sa * r_inner_bot, -height / 2.0 + 0.02)))
        
    bm.verts.ensure_lookup_table()
    for i in range(segments):
        i_next = (i + 1) % segments
        bm.faces.new([verts_outer_bot[i], verts_outer_bot[i_next], verts_outer_top[i_next], verts_outer_top[i]])
        bm.faces.new([verts_outer_top[i], verts_outer_top[i_next], verts_inner_top[i_next], verts_inner_top[i]])
        bm.faces.new([verts_inner_top[i], verts_inner_top[i_next], verts_inner_bot[i_next], verts_inner_bot[i]])
        
    bm.faces.new(verts_inner_bot)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = loc
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_perfect_weather_station():
    clear_scene()

    # 1. MATERIALS (Forensically calibrated to IMG_3998 - IMG_4008)
    mat_concrete = get_or_create_material("AWS_Concrete", (0.50, 0.49, 0.46, 1.0), roughness=0.85)
    mat_galv_steel = get_or_create_material("AWS_GalvanizedSteel", (0.72, 0.74, 0.75, 1.0), roughness=0.35, metallic=0.75)
    mat_fence_mesh = get_or_create_material("AWS_FenceMesh", (0.58, 0.60, 0.62, 1.0), roughness=0.50, metallic=0.65)
    mat_white_plastic = get_or_create_material("AWS_WhitePlastic", (0.92, 0.93, 0.92, 1.0), roughness=0.35)
    mat_instrument_dark = get_or_create_material("AWS_DarkInstrument", (0.12, 0.13, 0.14, 1.0), roughness=0.45)
    mat_solar_cell = get_or_create_material("AWS_SolarCell", (0.06, 0.09, 0.18, 1.0), roughness=0.15, metallic=0.70)
    mat_metal_wire = get_or_create_material("AWS_MetalWire", (0.65, 0.66, 0.68, 1.0), roughness=0.30, metallic=0.90)

    root = bpy.data.objects.new("AWS_Root", None)
    bpy.context.collection.objects.link(root)

    # 2. FOOTPRINT & FOUNDATION
    # 3.28m x 3.28m square enclosure from buildings.json
    # Front is -Y (facing bearing 161.1 deg)
    W = 3.28
    D = 3.28
    X_MIN = -W / 2.0  # -1.64
    X_MAX =  W / 2.0  # +1.64
    Y_MIN = -D / 2.0  # -1.64 (Front Gate)
    Y_MAX =  D / 2.0  # +1.64 (Rear)

    CURB_W = 0.14
    CURB_H = 0.16
    # 4 concrete perimeter foundation curbs
    create_box("AWS_Curb_Rear", (0.0, Y_MAX - CURB_W/2.0, CURB_H/2.0), (W, CURB_W, CURB_H), mat=mat_concrete, parent=root)
    create_box("AWS_Curb_Front", (0.0, Y_MIN + CURB_W/2.0, CURB_H/2.0), (W, CURB_W, CURB_H), mat=mat_concrete, parent=root)
    create_box("AWS_Curb_Left", (X_MIN + CURB_W/2.0, 0.0, CURB_H/2.0), (CURB_W, D - 2*CURB_W, CURB_H), mat=mat_concrete, parent=root)
    create_box("AWS_Curb_Right", (X_MAX - CURB_W/2.0, 0.0, CURB_H/2.0), (CURB_W, D - 2*CURB_W, CURB_H), mat=mat_concrete, parent=root)

    # Central Concrete Equipment Pad (IMG_4001: ~1.15m x 1.15m x 0.12m)
    PAD_SIZE = 1.15
    PAD_H = 0.12
    create_box("AWS_CenterPad", (0.0, 0.0, PAD_H/2.0), (PAD_SIZE, PAD_SIZE, PAD_H), mat=mat_concrete, parent=root)

    # 3. PERIMETER TUBULAR STEEL FENCE & CRANKED EXTENSION ARMS
    POST_R = 0.030    # 60mm diameter
    POST_H = 1.25     # Main vertical post height
    ARM_LEN = 0.32    # 45 deg barbed wire crank arm
    ARM_R = 0.018

    corners = [
        ("FL", X_MIN + CURB_W/2.0, Y_MIN + CURB_W/2.0, -1, -1),  # Front-Left
        ("FR", X_MAX - CURB_W/2.0, Y_MIN + CURB_W/2.0,  1, -1),  # Front-Right
        ("RL", X_MIN + CURB_W/2.0, Y_MAX - CURB_W/2.0, -1,  1),  # Rear-Left
        ("RR", X_MAX - CURB_W/2.0, Y_MAX - CURB_W/2.0,  1,  1),  # Rear-Right
    ]

    for cname, cx, cy, dx, dy in corners:
        create_cylinder(f"AWS_Post_{cname}", (cx, cy, POST_H/2.0), POST_R, POST_H, mat=mat_galv_steel, parent=root, vertices=8)
        arm_end_x = cx + dx * (ARM_LEN * 0.707)
        arm_end_y = cy + dy * (ARM_LEN * 0.707)
        arm_end_z = POST_H + (ARM_LEN * 0.707)
        arm_mid = ((cx + arm_end_x)/2.0, (cy + arm_end_y)/2.0, (POST_H + arm_end_z)/2.0)
        
        rot_y = math.radians(45) if dx < 0 else math.radians(-45)
        rot_x = math.radians(-45) if dy < 0 else math.radians(45)
        create_cylinder(f"AWS_CrankedArm_{cname}", arm_mid, ARM_R, ARM_LEN,
                        rot=(rot_x * 0.707, rot_y * 0.707, 0), mat=mat_galv_steel, parent=root, vertices=6)

    # 3 Continuous Strands of Barbed Wire (IMG_3998)
    for bwire_idx in range(3):
        t = (bwire_idx + 1) / 3.0
        p_fl = (corners[0][1] + corners[0][3] * ARM_LEN * 0.707 * t, corners[0][2] + corners[0][4] * ARM_LEN * 0.707 * t, POST_H + ARM_LEN * 0.707 * t)
        p_fr = (corners[1][1] + corners[1][3] * ARM_LEN * 0.707 * t, corners[1][2] + corners[1][4] * ARM_LEN * 0.707 * t, POST_H + ARM_LEN * 0.707 * t)
        p_rr = (corners[3][1] + corners[3][3] * ARM_LEN * 0.707 * t, corners[3][2] + corners[3][4] * ARM_LEN * 0.707 * t, POST_H + ARM_LEN * 0.707 * t)
        p_rl = (corners[2][1] + corners[2][3] * ARM_LEN * 0.707 * t, corners[2][2] + corners[2][4] * ARM_LEN * 0.707 * t, POST_H + ARM_LEN * 0.707 * t)

        create_cylinder(f"AWS_BarbedWire_Front_{bwire_idx}", ((p_fl[0]+p_fr[0])/2.0, (p_fl[1]+p_fr[1])/2.0, p_fl[2]),
                        0.003, math.hypot(p_fr[0]-p_fl[0], p_fr[1]-p_fl[1]), rot=(0, math.radians(90), 0), mat=mat_metal_wire, parent=root, vertices=4)
        create_cylinder(f"AWS_BarbedWire_Rear_{bwire_idx}", ((p_rl[0]+p_rr[0])/2.0, (p_rl[1]+p_rr[1])/2.0, p_rl[2]),
                        0.003, math.hypot(p_rr[0]-p_rl[0], p_rr[1]-p_rl[1]), rot=(0, math.radians(90), 0), mat=mat_metal_wire, parent=root, vertices=4)
        create_cylinder(f"AWS_BarbedWire_Left_{bwire_idx}", ((p_fl[0]+p_rl[0])/2.0, (p_fl[1]+p_rl[1])/2.0, p_fl[2]),
                        0.003, math.hypot(p_fl[0]-p_rl[0], p_fl[1]-p_rl[1]), rot=(math.radians(90), 0, 0), mat=mat_metal_wire, parent=root, vertices=4)
        create_cylinder(f"AWS_BarbedWire_Right_{bwire_idx}", ((p_fr[0]+p_rr[0])/2.0, (p_fr[1]+p_rr[1])/2.0, p_fr[2]),
                        0.003, math.hypot(p_fr[0]-p_rr[0], p_fr[1]-p_rr[1]), rot=(math.radians(90), 0, 0), mat=mat_metal_wire, parent=root, vertices=4)

    # Horizontal Tubular Fence Rails (Top & Bottom on Left, Right, Rear)
    RAIL_R = 0.020
    Z_RAIL_BOT = 0.18
    Z_RAIL_TOP = 1.20
    
    create_cylinder("AWS_Rail_Rear_Top", (0.0, Y_MAX - CURB_W/2.0, Z_RAIL_TOP), RAIL_R, W - CURB_W, rot=(0, math.radians(90), 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Rail_Rear_Bot", (0.0, Y_MAX - CURB_W/2.0, Z_RAIL_BOT), RAIL_R, W - CURB_W, rot=(0, math.radians(90), 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Rail_Left_Top", (X_MIN + CURB_W/2.0, 0.0, Z_RAIL_TOP), RAIL_R, D - CURB_W, rot=(math.radians(90), 0, 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Rail_Left_Bot", (X_MIN + CURB_W/2.0, 0.0, Z_RAIL_BOT), RAIL_R, D - CURB_W, rot=(math.radians(90), 0, 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Rail_Right_Top", (X_MAX - CURB_W/2.0, 0.0, Z_RAIL_TOP), RAIL_R, D - CURB_W, rot=(math.radians(90), 0, 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Rail_Right_Bot", (X_MAX - CURB_W/2.0, 0.0, Z_RAIL_BOT), RAIL_R, D - CURB_W, rot=(math.radians(90), 0, 0), mat=mat_galv_steel, parent=root, vertices=8)

    # 4. FRONT ACCESS GATE (IMG_3998, crop_front_gate_3998.jpg)
    X_DIVIDER = -0.30
    Y_FRONT = Y_MIN + CURB_W/2.0
    create_cylinder("AWS_Post_FrontDivider", (X_DIVIDER, Y_FRONT, POST_H/2.0), POST_R, POST_H, mat=mat_galv_steel, parent=root, vertices=8)
    
    # Right Fixed Panel Rails
    W_FIXED = (X_MAX - CURB_W/2.0) - X_DIVIDER
    X_FIXED_MID = X_DIVIDER + W_FIXED / 2.0
    create_cylinder("AWS_Rail_FrontRight_Top", (X_FIXED_MID, Y_FRONT, Z_RAIL_TOP), RAIL_R, W_FIXED, rot=(0, math.radians(90), 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Rail_FrontRight_Bot", (X_FIXED_MID, Y_FRONT, Z_RAIL_BOT), RAIL_R, W_FIXED, rot=(0, math.radians(90), 0), mat=mat_galv_steel, parent=root, vertices=8)

    # Swing Gate on Left side
    GATE_X_MIN = X_MIN + CURB_W/2.0 + 0.05
    GATE_X_MAX = X_DIVIDER - 0.05
    GATE_W = GATE_X_MAX - GATE_X_MIN
    GATE_X_MID = (GATE_X_MIN + GATE_X_MAX) / 2.0
    GATE_Z_BOT = Z_RAIL_BOT + 0.04
    GATE_Z_TOP = Z_RAIL_TOP - 0.04
    GATE_H = GATE_Z_TOP - GATE_Z_BOT
    GATE_Z_MID = (GATE_Z_BOT + GATE_Z_TOP) / 2.0
    GATE_TUBE_R = 0.018

    create_cylinder("AWS_Gate_TopRail", (GATE_X_MID, Y_FRONT, GATE_Z_TOP), GATE_TUBE_R, GATE_W, rot=(0, math.radians(90), 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Gate_BotRail", (GATE_X_MID, Y_FRONT, GATE_Z_BOT), GATE_TUBE_R, GATE_W, rot=(0, math.radians(90), 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Gate_LeftStile", (GATE_X_MIN, Y_FRONT, GATE_Z_MID), GATE_TUBE_R, GATE_H, mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Gate_RightStile", (GATE_X_MAX, Y_FRONT, GATE_Z_MID), GATE_TUBE_R, GATE_H, mat=mat_galv_steel, parent=root, vertices=8)

    # Gate Hinges & Padlock Chain
    for hz in [GATE_Z_BOT + 0.15, GATE_Z_TOP - 0.15]:
        create_cylinder(f"AWS_Gate_Hinge_{hz:.2f}", (GATE_X_MIN - 0.03, Y_FRONT, hz), 0.014, 0.07, mat=mat_galv_steel, parent=root, vertices=6)
    create_cylinder("AWS_Gate_ChainDrop", (GATE_X_MAX + 0.02, Y_FRONT - 0.01, GATE_Z_MID - 0.06), 0.008, 0.16, mat=mat_metal_wire, parent=root, vertices=4)
    create_box("AWS_Gate_Padlock", (GATE_X_MAX + 0.02, Y_FRONT - 0.01, GATE_Z_MID - 0.14), (0.04, 0.02, 0.05), mat=mat_instrument_dark, parent=root)

    # 5. WIRE MESH INFILL PANELS
    MESH_BAR_R = 0.0028
    MESH_Z_BOT = Z_RAIL_BOT + 0.02
    MESH_Z_TOP = Z_RAIL_TOP - 0.02
    def add_mesh_panel(name_prefix, p1, p2, z_bot, z_top, step=0.18):
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        length = math.hypot(dx, dy)
        angle = math.atan2(dy, dx)
        z = z_bot + step / 2.0
        h_idx = 0
        while z < z_top:
            mx = (p1[0] + p2[0]) / 2.0
            my = (p1[1] + p2[1]) / 2.0
            create_cylinder(f"{name_prefix}_H_{h_idx}", (mx, my, z), MESH_BAR_R, length,
                            rot=(0, math.radians(90), angle), mat=mat_fence_mesh, parent=root, vertices=4)
            z += step
            h_idx += 1
        d = step
        v_idx = 0
        while d < length - 0.02:
            vx = p1[0] + math.cos(angle) * d
            vy = p1[1] + math.sin(angle) * d
            create_cylinder(f"{name_prefix}_V_{v_idx}", (vx, vy, (z_bot + z_top) / 2.0), MESH_BAR_R, z_top - z_bot,
                            mat=mat_fence_mesh, parent=root, vertices=4)
            d += step
            v_idx += 1

    add_mesh_panel("AWS_Mesh_Rear", (X_MIN + CURB_W/2.0, Y_MAX - CURB_W/2.0), (X_MAX - CURB_W/2.0, Y_MAX - CURB_W/2.0), MESH_Z_BOT, MESH_Z_TOP)
    add_mesh_panel("AWS_Mesh_Left", (X_MIN + CURB_W/2.0, Y_MAX - CURB_W/2.0), (X_MIN + CURB_W/2.0, Y_MIN + CURB_W/2.0), MESH_Z_BOT, MESH_Z_TOP)
    add_mesh_panel("AWS_Mesh_Right", (X_MAX - CURB_W/2.0, Y_MIN + CURB_W/2.0), (X_MAX - CURB_W/2.0, Y_MAX - CURB_W/2.0), MESH_Z_BOT, MESH_Z_TOP)
    add_mesh_panel("AWS_Mesh_FrontRight", (X_DIVIDER, Y_FRONT), (X_MAX - CURB_W/2.0, Y_FRONT), MESH_Z_BOT, MESH_Z_TOP)
    add_mesh_panel("AWS_Mesh_Gate", (GATE_X_MIN, Y_FRONT), (GATE_X_MAX, Y_FRONT), GATE_Z_BOT + 0.02, GATE_Z_TOP - 0.02)

    # 6. TRIPOD & CENTRAL MAST (crop_base_tripod_4001.jpg)
    MAST_X = 0.0
    MAST_Y = 0.0
    MAST_R = 0.025   # 50mm diameter
    MAST_H = 2.45    # Height above pad
    create_cylinder("AWS_Mast_Pole", (MAST_X, MAST_Y, MAST_H/2.0 + PAD_H), MAST_R, MAST_H, mat=mat_galv_steel, parent=root, vertices=10)

    # Tripod collar clamp at Z = PAD_H + 0.72m
    TRIPOD_COLLAR_Z = PAD_H + 0.72
    create_cylinder("AWS_Tripod_CollarTop", (0.0, 0.0, TRIPOD_COLLAR_Z), MAST_R + 0.014, 0.07, mat=mat_galv_steel, parent=root, vertices=8)
    
    TRIPOD_SPREAD = 0.46
    TRIPOD_LEG_R = 0.016
    leg_angles = [math.radians(90), math.radians(215), math.radians(325)]

    for i, leg_angle in enumerate(leg_angles):
        lx = math.cos(leg_angle) * TRIPOD_SPREAD
        ly = math.sin(leg_angle) * TRIPOD_SPREAD
        lz = PAD_H + 0.015
        leg_len = math.hypot(lx, ly, TRIPOD_COLLAR_Z - lz)
        leg_mid = (lx / 2.0, ly / 2.0, (TRIPOD_COLLAR_Z + lz) / 2.0)
        
        tilt = math.atan2(TRIPOD_SPREAD, TRIPOD_COLLAR_Z - lz)
        create_cylinder(f"AWS_Tripod_Leg_{i}", leg_mid, TRIPOD_LEG_R, leg_len,
                        rot=(tilt * math.sin(leg_angle), -tilt * math.cos(leg_angle), 0), mat=mat_galv_steel, parent=root, vertices=6)
        create_box(f"AWS_Tripod_Foot_{i}", (lx, ly, PAD_H + 0.01), (0.07, 0.07, 0.02), mat=mat_galv_steel, parent=root)
        
        STRUT_Z = PAD_H + 0.16
        strut_r = TRIPOD_SPREAD * (TRIPOD_COLLAR_Z - STRUT_Z) / (TRIPOD_COLLAR_Z - lz)
        sx = math.cos(leg_angle) * strut_r
        sy = math.sin(leg_angle) * strut_r
        create_cylinder(f"AWS_Tripod_Strut_{i}", (sx/2.0, sy/2.0, STRUT_Z), 0.007, strut_r,
                        rot=(0, math.radians(90), leg_angle), mat=mat_galv_steel, parent=root, vertices=4)

    create_cylinder("AWS_Tripod_CollarBot", (0.0, 0.0, PAD_H + 0.16), MAST_R + 0.010, 0.04, mat=mat_galv_steel, parent=root, vertices=8)

    # 7. AUXILIARY SENSOR POST & DAVIS TRANSMITTER (IMG_4002, crop_base_tripod_4001.jpg)
    AUX_X = -0.42
    AUX_Y = -0.16
    AUX_H = 0.65
    create_cylinder("AWS_Aux_Post", (AUX_X, AUX_Y, PAD_H + AUX_H/2.0), 0.018, AUX_H, mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Aux_PostCap", (AUX_X, AUX_Y, PAD_H + AUX_H + 0.01), 0.021, 0.02, mat=mat_galv_steel, parent=root, vertices=8)

    AUX_BOX_Z = PAD_H + AUX_H - 0.10
    AUX_BOX_W = 0.13
    AUX_BOX_D = 0.09
    AUX_BOX_H = 0.18
    create_box("AWS_Aux_BoxBody", (AUX_X, AUX_Y - 0.055, AUX_BOX_Z), (AUX_BOX_W, AUX_BOX_D, AUX_BOX_H), mat=mat_white_plastic, parent=root)
    MINI_SOLAR_TILT = math.radians(25)
    create_box("AWS_Aux_MiniSolar", (AUX_X, AUX_Y - 0.10, AUX_BOX_Z + 0.01), (AUX_BOX_W - 0.02, 0.008, 0.09),
               rot=(-MINI_SOLAR_TILT, 0, 0), mat=mat_solar_cell, parent=root)
    for cz in [AUX_BOX_Z - 0.04, AUX_BOX_Z + 0.04]:
        create_box(f"AWS_Aux_Clip_{cz:.2f}", (AUX_X + AUX_BOX_W/2.0 + 0.008, AUX_Y - 0.055, cz), (0.016, 0.02, 0.016), mat=mat_white_plastic, parent=root)
    create_box("AWS_Aux_Clamp", (AUX_X, AUX_Y - 0.01, AUX_BOX_Z + 0.06), (0.05, 0.02, 0.02), mat=mat_galv_steel, parent=root)
    create_cylinder("AWS_Aux_WireCoil", (AUX_X, AUX_Y, PAD_H + 0.05), 0.045, 0.07, mat=mat_instrument_dark, parent=root, vertices=6)

    # 8. MAIN SOLAR POWER KIT IN THE MIDDLE (GROUND TRUTH: IMG_4003.jpg, IMG_4005.jpg, IMG_4007.jpg)
    # Tilted 30 deg back from vertical, facing directly front (-Y)
    SOLAR_Z = PAD_H + 1.25
    SOLAR_TILT = math.radians(30)
    
    # Create empty parent for solar kit with exact position & tilt
    solar_root = bpy.data.objects.new("AWS_SolarKit_Parent", None)
    bpy.context.collection.objects.link(solar_root)
    solar_root.location = (0.0, -0.16, SOLAR_Z)
    solar_root.rotation_euler = (-SOLAR_TILT, 0, 0)
    solar_root.parent = root

    # Dimensions in local space:
    # Local +Z: UP along face
    # Local -Z: DOWN along face
    # Local +X: RIGHT
    # Local -X: LEFT
    # Local -Y: FRONT (towards sun / viewer)
    # Local +Y: BACK (towards pole)
    SK_W = 0.32
    SK_H = 0.25
    SK_D = 0.09

    # A. Cabinet main white housing (local Y from 0 to SK_D)
    create_box("AWS_SK_Box", (0.0, SK_D / 2.0, 0.0), (SK_W, SK_D, SK_H), mat=mat_white_plastic, parent=solar_root)
    
    # B. Front Solar Photovoltaic Panel (fills the front face from local Y = -0.001 to -0.005)
    create_box("AWS_SK_PVFace", (0.0, -0.003, -0.005), (SK_W - 0.028, 0.006, SK_H - 0.040), mat=mat_solar_cell, parent=solar_root)

    # C. Front Bezel Lip & "DAVIS" Top Bar (IMG_4003.jpg)
    # Top Davis bar
    create_box("AWS_SK_TopBar", (0.0, -0.008, SK_H / 2.0 - 0.015), (SK_W, 0.016, 0.030), mat=mat_white_plastic, parent=solar_root)
    # Bottom lip with drainage notches
    create_box("AWS_SK_BotLip", (0.0, -0.008, -SK_H / 2.0 + 0.010), (SK_W, 0.016, 0.020), mat=mat_white_plastic, parent=solar_root)
    # Left & Right frame bezels
    create_box("AWS_SK_LeftBezel", (-SK_W/2.0 + 0.007, -0.008, 0.0), (0.014, 0.016, SK_H), mat=mat_white_plastic, parent=solar_root)
    create_box("AWS_SK_RightBezel", (SK_W/2.0 - 0.007, -0.008, 0.0), (0.014, 0.016, SK_H), mat=mat_white_plastic, parent=solar_root)

    # D. Side Latches on right side (IMG_4003.jpg)
    for l_z in [-0.05, +0.05]:
        create_box(f"AWS_SK_Latch_{l_z:.2f}", (SK_W/2.0 + 0.010, SK_D/2.0, l_z), (0.018, 0.030, 0.025), mat=mat_white_plastic, parent=solar_root)

    # E. Cable Gland & Exit Wire at bottom right (IMG_4003.jpg)
    create_cylinder("AWS_SK_Gland", (0.08, SK_D/2.0, -SK_H/2.0 - 0.01), 0.008, 0.025, mat=mat_instrument_dark, parent=solar_root, vertices=6)

    # F. Rear Molded Stiffener Ribs on back of cabinet (IMG_4005.jpg, IMG_4006.jpg)
    for rx in [-0.07, +0.07]:
        create_box(f"AWS_SK_Rib_{rx:.2f}", (rx, SK_D + 0.006, 0.0), (0.016, 0.012, SK_H - 0.04), mat=mat_white_plastic, parent=solar_root)

    # G. Authentic Bottom Bent-Steel Cantilever Mounting Bracket (IMG_4003.jpg, IMG_4007.jpg)
    # Bottom mounting flange under cabinet
    create_box("AWS_SK_MountFlange", (0.0, SK_D/2.0, -SK_H/2.0 - 0.008), (0.12, 0.07, 0.016), mat=mat_galv_steel, parent=solar_root)
    for bx in [-0.035, +0.035]:
        create_cylinder(f"AWS_SK_FlangeBolt_{bx:.2f}", (bx, SK_D/2.0, -SK_H/2.0 - 0.018), 0.006, 0.02, mat=mat_galv_steel, parent=solar_root, vertices=6)

    # In world space: diagonal arm from pole clamp up to bottom flange
    POLE_CLAMP_Z = SOLAR_Z - 0.22
    FLANGE_WORLD_Y = -0.16 + (SK_D/2.0) * math.cos(SOLAR_TILT) - (-SK_H/2.0) * math.sin(SOLAR_TILT)
    FLANGE_WORLD_Z = SOLAR_Z + (SK_D/2.0) * math.sin(SOLAR_TILT) + (-SK_H/2.0) * math.cos(SOLAR_TILT)
    
    # Clamp around mast pole
    create_box("AWS_SK_PoleClampPlate", (0.0, -MAST_R - 0.010, POLE_CLAMP_Z), (0.08, 0.02, 0.05), mat=mat_galv_steel, parent=root)
    create_cylinder("AWS_SK_UBolt", (0.0, 0.0, POLE_CLAMP_Z), MAST_R + 0.007, 0.035, mat=mat_galv_steel, parent=root, vertices=8)
    
    # Diagonal bent arm
    diag_arm_len = math.hypot(abs(FLANGE_WORLD_Y - (-MAST_R - 0.015)), FLANGE_WORLD_Z - POLE_CLAMP_Z)
    diag_arm_mid_y = ((-MAST_R - 0.015) + FLANGE_WORLD_Y) / 2.0
    diag_arm_mid_z = (POLE_CLAMP_Z + FLANGE_WORLD_Z) / 2.0
    diag_arm_rot_x = -math.atan2(FLANGE_WORLD_Z - POLE_CLAMP_Z, abs(FLANGE_WORLD_Y - (-MAST_R - 0.015))) + math.radians(90)
    create_box("AWS_SK_DiagBracketArm", (0.0, diag_arm_mid_y, diag_arm_mid_z), (0.08, 0.008, diag_arm_len),
               rot=(diag_arm_rot_x, 0, 0), mat=mat_galv_steel, parent=root)

    # H. Cable Spool / Donut Wrapped on Mast Pole (IMG_4003.jpg, IMG_4006.jpg, IMG_4007.jpg)
    SPOOL_Z = SOLAR_Z + 0.24
    create_cylinder("AWS_WireSpool_Bundle", (0.0, 0.0, SPOOL_Z), 0.048, 0.09, mat=mat_instrument_dark, parent=root, vertices=10)
    create_cylinder("AWS_WireSpool_Tape1", (0.0, 0.0, SPOOL_Z + 0.035), 0.051, 0.018, mat=mat_instrument_dark, parent=root, vertices=10)
    create_cylinder("AWS_WireSpool_Tape2", (0.0, 0.0, SPOOL_Z - 0.035), 0.051, 0.018, mat=mat_instrument_dark, parent=root, vertices=10)
    # Cables running up the pole
    create_cylinder("AWS_Mast_CablesUp", (0.0, MAST_R + 0.003, (SPOOL_Z + 2.10)/2.0), 0.005, 2.10 - SPOOL_Z,
                    mat=mat_instrument_dark, parent=root, vertices=4)

    # 9. DAVIS VANTAGE PRO2 INTEGRATED SENSOR SUITE (ISS)
    # Forensic layout from crop_sensor_head_4004.jpg & crop_rear_sensors_4008.jpg:
    # - Mast pole extends up to Z = 2.45m
    # - Saddle clamp bracket clamps to mast at Z = 2.12m
    # - Main body (rain cone + radiation shield louvers) sits on the LEFT of the pole (X = -0.15m)
    # - Transmitter shelter box sits on the LEFT of the rain cone (X = -0.28m)
    # - S-curved Anemometer arm clamps at pole and sweeps UP & RIGHT to X = +0.46m
    ISS_CLAMP_Z = PAD_H + 2.12
    
    # Saddle U-bolt clamp around mast pole (crop_rear_sensors_4008.jpg)
    create_box("AWS_ISS_MastClamp", (0.0, 0.0, ISS_CLAMP_Z), (0.08, 0.08, 0.08), mat=mat_instrument_dark, parent=root)
    create_box("AWS_ISS_RearClampPlate", (0.0, MAST_R + 0.015, ISS_CLAMP_Z), (0.09, 0.012, 0.06), mat=mat_galv_steel, parent=root)
    for bz_off in [-0.02, 0.02]:
        create_cylinder(f"AWS_ISS_Nut_{bz_off:.2f}", (0.03, MAST_R + 0.025, ISS_CLAMP_Z + bz_off), 0.005, 0.015,
                        rot=(math.radians(90), 0, 0), mat=mat_galv_steel, parent=root, vertices=6)

    BODY_X = -0.15
    BODY_Y = -0.06

    # Black composite cradling shelf connecting clamp to rain cone base (ABOVE the louvers)
    create_box("AWS_ISS_CradleShelf", ((0.0 + BODY_X)/2.0, BODY_Y, ISS_CLAMP_Z + 0.04), (abs(BODY_X), 0.14, 0.05), mat=mat_instrument_dark, parent=root)

    # A. SOLAR RADIATION SHIELD (Temp / Humidity Louvers)
    # Hangs directly underneath the rain cone base!
    LOUVER_Z_START = ISS_CLAMP_Z - 0.02
    LOUVER_GAP = 0.024
    for l_idx in range(5):
        lz = LOUVER_Z_START - l_idx * LOUVER_GAP
        lr = 0.115 - l_idx * 0.004
        create_cone(f"AWS_Louver_{l_idx}", (BODY_X, BODY_Y, lz), lr, lr - 0.015, 0.014, mat=mat_white_plastic, parent=root, vertices=12)
    create_cylinder("AWS_Louver_SensorCore", (BODY_X, BODY_Y, LOUVER_Z_START - 2*LOUVER_GAP), 0.035, 0.12, mat=mat_white_plastic, parent=root, vertices=8)

    # B. RAIN COLLECTOR CONE (Tipping Bucket Funnel)
    RAIN_BASE_Z = ISS_CLAMP_Z + 0.06
    # Rounded dark base dome with vertical ribs
    create_cylinder("AWS_Rain_BaseHousing", (BODY_X, BODY_Y, RAIN_BASE_Z + 0.04), 0.095, 0.08, mat=mat_instrument_dark, parent=root, vertices=12)
    create_cylinder("AWS_Rain_Neck", (BODY_X, BODY_Y, RAIN_BASE_Z + 0.09), 0.055, 0.03, mat=mat_instrument_dark, parent=root, vertices=10)
    
    # Authentic hollow collection funnel with interior cavity!
    FUNNEL_Z = RAIN_BASE_Z + 0.18
    FUNNEL_H = 0.15
    R_TOP_OUTER = 0.115
    R_BOT_OUTER = 0.055
    R_TOP_INNER = 0.105
    R_BOT_INNER = 0.020
    create_funnel("AWS_Rain_FunnelBowl", (BODY_X, BODY_Y, FUNNEL_Z),
                  R_TOP_OUTER, R_BOT_OUTER, R_TOP_INNER, R_BOT_INNER, FUNNEL_H,
                  mat=mat_instrument_dark, parent=root, segments=12)
    create_cylinder("AWS_Rain_TopCollar", (BODY_X, BODY_Y, FUNNEL_Z + FUNNEL_H/2.0 + 0.01), R_TOP_OUTER, 0.022, mat=mat_instrument_dark, parent=root, vertices=12)

    # Bird Spikes ringing the rim (crop_sensor_head_4004.jpg)
    SPIKE_R = R_TOP_OUTER
    SPIKE_H = 0.09
    SPIKE_Z = FUNNEL_Z + FUNNEL_H/2.0 + 0.02 + SPIKE_H/2.0
    for s_idx in range(12):
        s_angle = s_idx * (2 * math.pi / 12)
        sx = BODY_X + math.cos(s_angle) * SPIKE_R
        sy = BODY_Y + math.sin(s_angle) * SPIKE_R
        create_cylinder(f"AWS_BirdSpike_{s_idx}", (sx, sy, SPIKE_Z), 0.0016, SPIKE_H, mat=mat_metal_wire, parent=root, vertices=4)

    # C. TRANSMITTER SHELTER BOX (on left side of ISS, -X)
    TX_X = BODY_X - 0.13
    TX_Y = BODY_Y - 0.02
    TX_Z = ISS_CLAMP_Z + 0.08
    TX_W = 0.11
    TX_D = 0.08
    TX_H = 0.15
    create_box("AWS_ISS_TransmitterBox", (TX_X, TX_Y, TX_Z), (TX_W, TX_D, TX_H), mat=mat_white_plastic, parent=root)
    create_box("AWS_ISS_TxSolar", (TX_X, TX_Y - TX_D/2.0 - 0.004, TX_Z + 0.01), (TX_W - 0.02, 0.008, TX_H - 0.03),
               rot=(-math.radians(20), 0, 0), mat=mat_solar_cell, parent=root)
    create_cylinder("AWS_UVSensor", (TX_X + 0.01, TX_Y + TX_D/2.0 + 0.03, TX_Z + 0.08), 0.020, 0.05, mat=mat_instrument_dark, parent=root, vertices=8)

    # D. ANEMOMETER & WIND VANE ASSEMBLY (Extends to the RIGHT, +X)
    ARM_R = 0.010
    ELBOW_X = 0.32
    ELBOW_Y = -0.02
    ELBOW_Z = ISS_CLAMP_Z + 0.22
    seg1_len = math.hypot(ELBOW_X, ELBOW_Z - ISS_CLAMP_Z)
    seg1_mid = (ELBOW_X / 2.0, ELBOW_Y / 2.0, (ISS_CLAMP_Z + ELBOW_Z) / 2.0)
    seg1_rot_y = -math.atan2(ELBOW_Z - ISS_CLAMP_Z, ELBOW_X) + math.radians(90)
    create_cylinder("AWS_Anemo_ArmRiser", seg1_mid, ARM_R, seg1_len, rot=(0, seg1_rot_y, 0), mat=mat_instrument_dark, parent=root, vertices=6)

    HUB_X = 0.44
    HUB_Y = -0.02
    HUB_Z = ELBOW_Z + 0.04
    seg2_len = math.hypot(HUB_X - ELBOW_X, HUB_Z - ELBOW_Z)
    seg2_mid = ((ELBOW_X + HUB_X)/2.0, (ELBOW_Y + HUB_Y)/2.0, (ELBOW_Z + HUB_Z)/2.0)
    seg2_rot_y = -math.atan2(HUB_Z - ELBOW_Z, HUB_X - ELBOW_X) + math.radians(90)
    create_cylinder("AWS_Anemo_ArmBend", seg2_mid, ARM_R, seg2_len, rot=(0, seg2_rot_y, 0), mat=mat_instrument_dark, parent=root, vertices=6)

    # Vertical sensor hub (crop_sensor_head_4004.jpg)
    create_cylinder("AWS_Anemo_Hub", (HUB_X, HUB_Y, HUB_Z), 0.020, 0.12, mat=mat_instrument_dark, parent=root, vertices=8)

    # Wind Direction Vane (Top of hub)
    VANE_Z = HUB_Z + 0.075
    create_cylinder("AWS_Vane_Nose", (HUB_X - 0.06, HUB_Y, VANE_Z), 0.007, 0.05, rot=(0, math.radians(90), 0), mat=mat_instrument_dark, parent=root, vertices=6)
    create_cylinder("AWS_Vane_Rod", (HUB_X + 0.04, HUB_Y, VANE_Z), 0.004, 0.22, rot=(0, math.radians(90), 0), mat=mat_instrument_dark, parent=root, vertices=4)
    create_box("AWS_Vane_Fin", (HUB_X + 0.14, HUB_Y, VANE_Z + 0.025), (0.11, 0.004, 0.065), mat=mat_instrument_dark, parent=root)

    # 3-Cup Anemometer (Below vane on hub)
    CUP_ROTOR_Z = HUB_Z - 0.04
    create_cylinder("AWS_Cup_RotorHub", (HUB_X, HUB_Y, CUP_ROTOR_Z), 0.015, 0.03, mat=mat_instrument_dark, parent=root, vertices=8)
    CUP_ARM_LEN = 0.09
    CUP_RADIUS = 0.020

    for c_idx, c_angle in enumerate([0, 2*math.pi/3, 4*math.pi/3]):
        spoke_mid_x = HUB_X + math.cos(c_angle) * (CUP_ARM_LEN / 2.0)
        spoke_mid_y = HUB_Y + math.sin(c_angle) * (CUP_ARM_LEN / 2.0)
        create_cylinder(f"AWS_Cup_Spoke_{c_idx}", (spoke_mid_x, spoke_mid_y, CUP_ROTOR_Z), 0.0028, CUP_ARM_LEN,
                        rot=(0, math.radians(90), c_angle), mat=mat_instrument_dark, parent=root, vertices=4)
        
        cup_pos_x = HUB_X + math.cos(c_angle) * CUP_ARM_LEN
        cup_pos_y = HUB_Y + math.sin(c_angle) * CUP_ARM_LEN
        tangent_angle = c_angle + math.pi / 2.0
        rot_cup_x = -math.sin(tangent_angle) * (math.pi / 2.0)
        rot_cup_y =  math.cos(tangent_angle) * (math.pi / 2.0)
        create_hemisphere(f"AWS_Cup_Hemisphere_{c_idx}", (cup_pos_x, cup_pos_y, CUP_ROTOR_Z), CUP_RADIUS,
                          rot=(rot_cup_x, rot_cup_y, 0), mat=mat_instrument_dark, parent=root, segments=8, rings=5)

    # 10. BATCH JOIN BY MATERIAL & EXPORT TO GLB
    bpy.ops.object.select_all(action='DESELECT')
    mesh_objs = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    mat_map = {}
    for obj in mesh_objs:
        mname = obj.data.materials[0].name if len(obj.data.materials) > 0 else "Default"
        mat_map.setdefault(mname, []).append(obj)

    print(f"Batch joining {len(mesh_objs)} objects across {len(mat_map)} materials...")
    joined_objs = []
    for mname, objs in mat_map.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objs:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        active = bpy.context.active_object
        active.name = f"AWS_Batch_{mname}"
        joined_objs.append(active)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in joined_objs:
        obj.select_set(True)

    os.makedirs(os.path.dirname(TARGET_GLB), exist_ok=True)

    print(f"Exporting to {TARGET_GLB}...")
    bpy.ops.export_scene.gltf(
        filepath=TARGET_GLB,
        use_selection=True,
        export_format='GLB',
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_draco_mesh_compression_enable=False
    )

    size_kb = os.path.getsize(TARGET_GLB) / 1024.0
    print(f"GLB export complete! File size: {size_kb:.1f} KB (budget: < 300 KB)")
    return size_kb

if __name__ == "__main__":
    build_perfect_weather_station()
