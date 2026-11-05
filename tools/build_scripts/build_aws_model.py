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


def build_automated_weather_station():
    clear_scene()

    # 1. MATERIALS (Ground truth calibrated to IMG_3998 - IMG_4008)
    mat_concrete = get_or_create_material("AWS_Concrete", (0.50, 0.49, 0.46, 1.0), roughness=0.85)
    mat_galv_steel = get_or_create_material("AWS_GalvanizedSteel", (0.72, 0.74, 0.75, 1.0), roughness=0.35, metallic=0.75)
    mat_fence_mesh = get_or_create_material("AWS_FenceMesh", (0.58, 0.60, 0.62, 1.0), roughness=0.50, metallic=0.65)
    mat_white_plastic = get_or_create_material("AWS_WhitePlastic", (0.92, 0.93, 0.92, 1.0), roughness=0.35)
    mat_instrument_dark = get_or_create_material("AWS_DarkInstrument", (0.12, 0.13, 0.14, 1.0), roughness=0.45)
    mat_solar_cell = get_or_create_material("AWS_SolarCell", (0.06, 0.09, 0.18, 1.0), roughness=0.15, metallic=0.70)
    mat_metal_wire = get_or_create_material("AWS_MetalWire", (0.65, 0.66, 0.68, 1.0), roughness=0.30, metallic=0.90)

    # Root empty
    root = bpy.data.objects.new("AWS_Root", None)
    bpy.context.collection.objects.link(root)

    # DIMENSIONS & GEOMETRY (Calibrated to buildings.json 3.28m x 3.28m enclosure)
    # Origin (0,0,0) is centered at centroid
    # Front is -Y (Gate side, pointing towards bearing 161.1 deg)
    # Rear is +Y
    # Left is -X
    # Right is +X
    W = 3.28
    D = 3.28
    X_MIN = -W / 2.0  # -1.64
    X_MAX =  W / 2.0  # +1.64
    Y_MIN = -D / 2.0  # -1.64 (Front Gate facade)
    Y_MAX =  D / 2.0  # +1.64 (Rear facade)

    # 2. CONCRETE FOUNDATION CURBS & EQUIPMENT SLAB
    CURB_W = 0.14
    CURB_H = 0.16
    # 4 perimeter curb beams forming the foundation ring
    # North (Rear) curb
    create_box("AWS_Curb_Rear", (0.0, Y_MAX - CURB_W/2.0, CURB_H/2.0), (W, CURB_W, CURB_H), mat=mat_concrete, parent=root)
    # South (Front) curb
    create_box("AWS_Curb_Front", (0.0, Y_MIN + CURB_W/2.0, CURB_H/2.0), (W, CURB_W, CURB_H), mat=mat_concrete, parent=root)
    # West (Left) curb
    create_box("AWS_Curb_Left", (X_MIN + CURB_W/2.0, 0.0, CURB_H/2.0), (CURB_W, D - 2*CURB_W, CURB_H), mat=mat_concrete, parent=root)
    # East (Right) curb
    create_box("AWS_Curb_Right", (X_MAX - CURB_W/2.0, 0.0, CURB_H/2.0), (CURB_W, D - 2*CURB_W, CURB_H), mat=mat_concrete, parent=root)

    # Central Concrete Equipment Pad (IMG_4001: ~1.2m x 1.2m raised pad)
    PAD_SIZE = 1.20
    PAD_H = 0.12
    create_box("AWS_CenterPad", (0.0, 0.0, PAD_H/2.0), (PAD_SIZE, PAD_SIZE, PAD_H), mat=mat_concrete, parent=root)

    # 3. TUBULAR STEEL FENCE CORNER POSTS & RAILS
    POST_R = 0.030    # 60mm diameter
    POST_H = 1.25     # Main vertical post height
    ARM_LEN = 0.30    # 45 deg barbed wire crank arm
    ARM_R = 0.020     # 40mm diameter

    corner_coords = [
        ("FL", X_MIN + CURB_W/2.0, Y_MIN + CURB_W/2.0, (-1, -1)),  # Front-Left
        ("FR", X_MAX - CURB_W/2.0, Y_MIN + CURB_W/2.0, ( 1, -1)),  # Front-Right
        ("RL", X_MIN + CURB_W/2.0, Y_MAX - CURB_W/2.0, (-1,  1)),  # Rear-Left
        ("RR", X_MAX - CURB_W/2.0, Y_MAX - CURB_W/2.0, ( 1,  1)),  # Rear-Right
    ]

    for cname, cx, cy, (dx, dy) in corner_coords:
        # Main vertical post
        create_cylinder(f"AWS_Post_{cname}", (cx, cy, POST_H/2.0), POST_R, POST_H, mat=mat_galv_steel, parent=root)
        # 45-degree cranked outward extension arm for barbed wire (IMG_3998)
        # Angled at 45 degrees outward along diagonal
        arm_angle_z = math.atan2(dy, dx)
        arm_dx = dx * 0.707 * ARM_LEN / 2.0
        arm_dy = dy * 0.707 * ARM_LEN / 2.0
        arm_dz = 0.707 * ARM_LEN / 2.0
        arm_loc = (cx + arm_dx, cy + arm_dy, POST_H + arm_dz)
        # Euler rotation: pitch 45 deg, yaw arm_angle_z
        # Direction vector: (dx*0.707, dy*0.707, 0.707)
        # Cylinder naturally points along Z
        rot_y = math.radians(45) if dx < 0 else math.radians(-45)
        rot_x = math.radians(-45) if dy < 0 else math.radians(45)
        create_cylinder(f"AWS_CrankedArm_{cname}", arm_loc, ARM_R, ARM_LEN,
                        rot=(rot_x * 0.707, rot_y * 0.707, 0), mat=mat_galv_steel, parent=root)

    # Perimeter Barbed Wire Strands (3 continuous strands at crank arms)
    for bwire_idx, bwire_z in enumerate([POST_H + 0.06, POST_H + 0.14, POST_H + 0.22]):
        bw_offset = (bwire_idx + 1) * 0.06
        # Front strand
        create_cylinder(f"AWS_BarbedWire_Front_{bwire_idx}",
                        (0.0, Y_MIN - bw_offset, bwire_z),
                        0.004, W + 2*bw_offset, rot=(0, math.radians(90), 0), mat=mat_metal_wire, parent=root, vertices=4)
        # Rear strand
        create_cylinder(f"AWS_BarbedWire_Rear_{bwire_idx}",
                        (0.0, Y_MAX + bw_offset, bwire_z),
                        0.004, W + 2*bw_offset, rot=(0, math.radians(90), 0), mat=mat_metal_wire, parent=root, vertices=4)
        # Left strand
        create_cylinder(f"AWS_BarbedWire_Left_{bwire_idx}",
                        (X_MIN - bw_offset, 0.0, bwire_z),
                        0.004, D + 2*bw_offset, rot=(math.radians(90), 0, 0), mat=mat_metal_wire, parent=root, vertices=4)
        # Right strand
        create_cylinder(f"AWS_BarbedWire_Right_{bwire_idx}",
                        (X_MAX + bw_offset, 0.0, bwire_z),
                        0.004, D + 2*bw_offset, rot=(math.radians(90), 0, 0), mat=mat_metal_wire, parent=root, vertices=4)

    # Horizontal Tubular Fence Rails (Top & Bottom on Left, Right, Rear)
    RAIL_R = 0.020
    Z_RAIL_BOT = 0.18
    Z_RAIL_TOP = 1.20
    
    # Rear Rails
    create_cylinder("AWS_Rail_Rear_Top", (0.0, Y_MAX - CURB_W/2.0, Z_RAIL_TOP), RAIL_R, W - CURB_W, rot=(0, math.radians(90), 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Rail_Rear_Bot", (0.0, Y_MAX - CURB_W/2.0, Z_RAIL_BOT), RAIL_R, W - CURB_W, rot=(0, math.radians(90), 0), mat=mat_galv_steel, parent=root, vertices=8)
    # Left Rails
    create_cylinder("AWS_Rail_Left_Top", (X_MIN + CURB_W/2.0, 0.0, Z_RAIL_TOP), RAIL_R, D - CURB_W, rot=(math.radians(90), 0, 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Rail_Left_Bot", (X_MIN + CURB_W/2.0, 0.0, Z_RAIL_BOT), RAIL_R, D - CURB_W, rot=(math.radians(90), 0, 0), mat=mat_galv_steel, parent=root, vertices=8)
    # Right Rails
    create_cylinder("AWS_Rail_Right_Top", (X_MAX - CURB_W/2.0, 0.0, Z_RAIL_TOP), RAIL_R, D - CURB_W, rot=(math.radians(90), 0, 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Rail_Right_Bot", (X_MAX - CURB_W/2.0, 0.0, Z_RAIL_BOT), RAIL_R, D - CURB_W, rot=(math.radians(90), 0, 0), mat=mat_galv_steel, parent=root, vertices=8)

    # 4. FRONT FACADE & ACCESS GATE (IMG_3998: Front divided into Left Gate & Right Fixed Panel)
    # Intermediate divider post at X = -0.30
    X_DIVIDER = -0.30
    Y_FRONT = Y_MIN + CURB_W/2.0
    create_cylinder("AWS_Post_FrontDivider", (X_DIVIDER, Y_FRONT, POST_H/2.0), POST_R, POST_H, mat=mat_galv_steel, parent=root, vertices=8)
    
    # Right Fixed Panel Rails (from X_DIVIDER to X_MAX)
    W_FIXED = (X_MAX - CURB_W/2.0) - X_DIVIDER
    X_FIXED_MID = X_DIVIDER + W_FIXED / 2.0
    create_cylinder("AWS_Rail_FrontRight_Top", (X_FIXED_MID, Y_FRONT, Z_RAIL_TOP), RAIL_R, W_FIXED, rot=(0, math.radians(90), 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Rail_FrontRight_Bot", (X_FIXED_MID, Y_FRONT, Z_RAIL_BOT), RAIL_R, W_FIXED, rot=(0, math.radians(90), 0), mat=mat_galv_steel, parent=root, vertices=8)

    # Swing Gate Frame on Left side (from X_MIN to X_DIVIDER)
    GATE_X_MIN = X_MIN + CURB_W/2.0 + 0.05
    GATE_X_MAX = X_DIVIDER - 0.05
    GATE_W = GATE_X_MAX - GATE_X_MIN
    GATE_X_MID = (GATE_X_MIN + GATE_X_MAX) / 2.0
    GATE_Z_BOT = Z_RAIL_BOT + 0.04
    GATE_Z_TOP = Z_RAIL_TOP - 0.04
    GATE_H = GATE_Z_TOP - GATE_Z_BOT
    GATE_Z_MID = (GATE_Z_BOT + GATE_Z_TOP) / 2.0
    GATE_TUBE_R = 0.018

    # Gate outer tubular frame (4 sides)
    create_cylinder("AWS_Gate_TopRail", (GATE_X_MID, Y_FRONT, GATE_Z_TOP), GATE_TUBE_R, GATE_W, rot=(0, math.radians(90), 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Gate_BotRail", (GATE_X_MID, Y_FRONT, GATE_Z_BOT), GATE_TUBE_R, GATE_W, rot=(0, math.radians(90), 0), mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Gate_LeftStile", (GATE_X_MIN, Y_FRONT, GATE_Z_MID), GATE_TUBE_R, GATE_H, mat=mat_galv_steel, parent=root, vertices=8)
    create_cylinder("AWS_Gate_RightStile", (GATE_X_MAX, Y_FRONT, GATE_Z_MID), GATE_TUBE_R, GATE_H, mat=mat_galv_steel, parent=root, vertices=8)

    # Gate Hinges on Left Post & Slide Latch on Right Post (IMG_3998)
    for hz in [GATE_Z_BOT + 0.15, GATE_Z_TOP - 0.15]:
        create_cylinder(f"AWS_Gate_Hinge_{hz:.2f}", (GATE_X_MIN - 0.03, Y_FRONT, hz), 0.015, 0.06, mat=mat_galv_steel, parent=root, vertices=6)
    # Slide bolt lock / latch at center
    create_box("AWS_Gate_Latch", (GATE_X_MAX + 0.03, Y_FRONT, GATE_Z_MID), (0.08, 0.03, 0.04), mat=mat_galv_steel, parent=root)

    # 5. WIRE MESH INFILL PANELS (Rear, Left, Right, Front-Right, Gate)
    # Using 4-sided wire cross section (diamond tube) with step=0.20m for clean appearance and low poly budget
    MESH_BAR_R = 0.003
    MESH_Z_BOT = Z_RAIL_BOT + 0.02
    MESH_Z_TOP = Z_RAIL_TOP - 0.02
    MESH_Z_MID = (MESH_Z_BOT + MESH_Z_TOP) / 2.0
    MESH_H = MESH_Z_TOP - MESH_Z_BOT

    def add_mesh_panel(name_prefix, p1, p2, z_bot, z_top, step=0.20):
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        length = math.hypot(dx, dy)
        angle = math.atan2(dy, dx)
        
        # Horizontal wires
        z = z_bot + step / 2.0
        h_idx = 0
        while z < z_top:
            mx = (p1[0] + p2[0]) / 2.0
            my = (p1[1] + p2[1]) / 2.0
            create_cylinder(f"{name_prefix}_H_{h_idx}", (mx, my, z), MESH_BAR_R, length,
                            rot=(0, math.radians(90), angle), mat=mat_fence_mesh, parent=root, vertices=4)
            z += step
            h_idx += 1
            
        # Vertical wires
        d = step
        v_idx = 0
        while d < length - 0.02:
            vx = p1[0] + math.cos(angle) * d
            vy = p1[1] + math.sin(angle) * d
            create_cylinder(f"{name_prefix}_V_{v_idx}", (vx, vy, (z_bot + z_top) / 2.0), MESH_BAR_R, z_top - z_bot,
                            mat=mat_fence_mesh, parent=root, vertices=4)
            d += step
            v_idx += 1


    # Add mesh for 5 panels
    add_mesh_panel("AWS_Mesh_Rear", (X_MIN + CURB_W/2.0, Y_MAX - CURB_W/2.0), (X_MAX - CURB_W/2.0, Y_MAX - CURB_W/2.0), MESH_Z_BOT, MESH_Z_TOP)
    add_mesh_panel("AWS_Mesh_Left", (X_MIN + CURB_W/2.0, Y_MAX - CURB_W/2.0), (X_MIN + CURB_W/2.0, Y_MIN + CURB_W/2.0), MESH_Z_BOT, MESH_Z_TOP)
    add_mesh_panel("AWS_Mesh_Right", (X_MAX - CURB_W/2.0, Y_MIN + CURB_W/2.0), (X_MAX - CURB_W/2.0, Y_MAX - CURB_W/2.0), MESH_Z_BOT, MESH_Z_TOP)
    add_mesh_panel("AWS_Mesh_FrontRight", (X_DIVIDER, Y_FRONT), (X_MAX - CURB_W/2.0, Y_FRONT), MESH_Z_BOT, MESH_Z_TOP)
    add_mesh_panel("AWS_Mesh_Gate", (GATE_X_MIN, Y_FRONT), (GATE_X_MAX, Y_FRONT), GATE_Z_BOT + 0.02, GATE_Z_TOP - 0.02)

    # 6. CENTRAL INSTRUMENT MAST & TRIPOD (IMG_4001, IMG_4008)
    MAST_X = 0.0
    MAST_Y = 0.0
    MAST_R = 0.025   # 50mm diameter
    MAST_H = 2.45    # Height above ground
    # Central mast tube
    create_cylinder("AWS_Mast_Pole", (MAST_X, MAST_Y, MAST_H/2.0 + PAD_H), MAST_R, MAST_H, mat=mat_galv_steel, parent=root)

    # Tripod Base: 3 tubular legs spreading out to R = 0.45m
    TRIPOD_COLLAR_Z = PAD_H + 0.70
    TRIPOD_SPREAD = 0.45
    TRIPOD_LEG_R = 0.016
    for i, leg_angle in enumerate([math.radians(30), math.radians(150), math.radians(270)]):
        lx = math.cos(leg_angle) * TRIPOD_SPREAD
        ly = math.sin(leg_angle) * TRIPOD_SPREAD
        lz = PAD_H + 0.02
        # Vector from collar (0, 0, TRIPOD_COLLAR_Z) to foot (lx, ly, lz)
        leg_len = math.hypot(lx, ly, TRIPOD_COLLAR_Z - lz)
        leg_mid = (lx / 2.0, ly / 2.0, (TRIPOD_COLLAR_Z + lz) / 2.0)
        # Angles
        tilt = math.atan2(TRIPOD_SPREAD, TRIPOD_COLLAR_Z - lz)
        create_cylinder(f"AWS_Tripod_Leg_{i}", leg_mid, TRIPOD_LEG_R, leg_len,
                        rot=(tilt * math.sin(leg_angle), -tilt * math.cos(leg_angle), 0), mat=mat_galv_steel, parent=root)
        # Footpad anchor plate on concrete
        create_box(f"AWS_Tripod_Foot_{i}", (lx, ly, PAD_H + 0.01), (0.08, 0.08, 0.02), mat=mat_galv_steel, parent=root)
        # Horizontal tie strut at Z = PAD_H + 0.15
        STRUT_Z = PAD_H + 0.15
        strut_r = TRIPOD_SPREAD * (TRIPOD_COLLAR_Z - STRUT_Z) / (TRIPOD_COLLAR_Z - lz)
        sx = math.cos(leg_angle) * strut_r
        sy = math.sin(leg_angle) * strut_r
        create_cylinder(f"AWS_Tripod_Strut_{i}", (sx/2.0, sy/2.0, STRUT_Z), 0.008, strut_r,
                        rot=(0, math.radians(90), leg_angle), mat=mat_galv_steel, parent=root)

    # Collar clamp ring on mast
    create_cylinder("AWS_Tripod_Collar", (0.0, 0.0, TRIPOD_COLLAR_Z), MAST_R + 0.012, 0.06, mat=mat_galv_steel, parent=root)

    # 7. MAIN SOLAR PANEL ASSEMBLY (IMG_4001, IMG_4008: Facing Front -Y with 35 deg tilt)
    SOLAR_Z = PAD_H + 1.35
    SOLAR_W = 0.38   # Width along X
    SOLAR_H = 0.32   # Length along slope
    SOLAR_D = 0.035  # Thickness
    SOLAR_TILT = math.radians(35)  # tilted upward facing -Y

    # Mounting arm / channel from mast
    create_box("AWS_Solar_MountArm", (0.0, -0.06, SOLAR_Z), (0.06, 0.12, 0.04), mat=mat_galv_steel, parent=root)
    # Solar panel bezel housing
    create_box("AWS_Solar_Housing", (0.0, -0.14, SOLAR_Z), (SOLAR_W, SOLAR_H, SOLAR_D),
               rot=(-SOLAR_TILT, 0, 0), mat=mat_white_plastic, parent=root)
    # Solar photovoltaic face
    create_box("AWS_Solar_PVFace", (0.0, -0.14 - 0.005 * math.sin(SOLAR_TILT), SOLAR_Z + 0.005 * math.cos(SOLAR_TILT)),
               (SOLAR_W - 0.03, SOLAR_H - 0.03, 0.01), rot=(-SOLAR_TILT, 0, 0), mat=mat_solar_cell, parent=root)

    # 8. SECONDARY AUXILIARY SENSOR POST & DAVIS TRANSMITTER (IMG_4001, IMG_4002)
    # Located to the left of the tripod on the concrete pad
    AUX_X = -0.42
    AUX_Y = -0.18
    AUX_H = 0.65
    create_cylinder("AWS_Aux_Post", (AUX_X, AUX_Y, PAD_H + AUX_H/2.0), 0.020, AUX_H, mat=mat_galv_steel, parent=root)
    
    # Davis wireless transmitter shelter box mounted on aux post
    BOX_Z = PAD_H + AUX_H - 0.12
    BOX_W = 0.14
    BOX_D = 0.10
    BOX_H = 0.20
    create_box("AWS_Aux_BoxBody", (AUX_X, AUX_Y - 0.06, BOX_Z), (BOX_W, BOX_D, BOX_H), mat=mat_white_plastic, parent=root)
    # Tilted mini solar panel on front of box
    MINI_SOLAR_TILT = math.radians(25)
    create_box("AWS_Aux_MiniSolar", (AUX_X, AUX_Y - 0.11, BOX_Z + 0.02), (BOX_W - 0.03, 0.01, 0.08),
               rot=(-MINI_SOLAR_TILT, 0, 0), mat=mat_solar_cell, parent=root)
    # U-bolt clamp
    create_box("AWS_Aux_Clamp", (AUX_X, AUX_Y - 0.01, BOX_Z + 0.05), (0.06, 0.03, 0.02), mat=mat_galv_steel, parent=root)
    # Coiled black sensor wire around post base
    create_cylinder("AWS_Aux_WireCoil", (AUX_X, AUX_Y, PAD_H + 0.06), 0.035, 0.08, mat=mat_instrument_dark, parent=root)

    # 9. DAVIS VANTAGE PRO2 INTEGRATED SENSOR SUITE (ISS) (IMG_4004, IMG_4008)
    # Mounted at top of central mast: Z from 1.95m to 2.85m
    ISS_BASE_Z = PAD_H + MAST_H - 0.35  # ~2.22m

    # Heavy black UV-resistant composite mounting bracket
    create_box("AWS_ISS_Bracket", (0.0, -0.02, ISS_BASE_Z), (0.16, 0.18, 0.12), mat=mat_instrument_dark, parent=root)

    # Passive Solar Radiation Shield (5 stacked white circular louvered plates)
    SHIELD_Z_START = ISS_BASE_Z - 0.08
    SHIELD_PLATE_H = 0.012
    SHIELD_GAP = 0.024
    for p_idx in range(5):
        pz = SHIELD_Z_START - p_idx * SHIELD_GAP
        pr = 0.12 - p_idx * 0.006  # slightly tapered downward
        # Circular plate with rim
        create_cylinder(f"AWS_Shield_Plate_{p_idx}", (0.0, -0.08, pz), pr, SHIELD_PLATE_H, mat=mat_white_plastic, parent=root)
    # Shield central sensor core
    create_cylinder("AWS_Shield_Core", (0.0, -0.08, SHIELD_Z_START - 2 * SHIELD_GAP), 0.04, 0.14, mat=mat_white_plastic, parent=root)

    # Rain Collector Cone (Tipping Bucket Funnel) directly above radiation shield
    CONE_BASE_Z = ISS_BASE_Z + 0.02
    # Fluted collector base
    create_cylinder("AWS_Rain_Base", (0.0, -0.08, CONE_BASE_Z + 0.05), 0.10, 0.10, mat=mat_instrument_dark, parent=root)
    # Flared collection funnel
    create_cone("AWS_Rain_Funnel", (0.0, -0.08, CONE_BASE_Z + 0.17), 0.13, 0.09, 0.14, mat=mat_instrument_dark, parent=root)
    # Funnel top cylindrical rim
    create_cylinder("AWS_Rain_Rim", (0.0, -0.08, CONE_BASE_Z + 0.25), 0.13, 0.03, mat=mat_instrument_dark, parent=root)

    # Bird Deterrent Spikes (IMG_4004: Ring of thin vertical wires around rim)
    SPIKE_R = 0.13
    SPIKE_H = 0.10
    SPIKE_Z = CONE_BASE_Z + 0.25 + SPIKE_H / 2.0
    for s_idx in range(12):
        s_angle = s_idx * (2 * math.pi / 12)
        sx = math.cos(s_angle) * SPIKE_R
        sy = -0.08 + math.sin(s_angle) * SPIKE_R
        create_cylinder(f"AWS_BirdSpike_{s_idx}", (sx, sy, SPIKE_Z), 0.002, SPIKE_H, mat=mat_metal_wire, parent=root, vertices=4)


    # Weather-resistant Transmitter Shelter Box on ISS bracket (Front-Left)
    ISS_BOX_X = -0.15
    ISS_BOX_Y = -0.08
    ISS_BOX_Z = ISS_BASE_Z + 0.08
    create_box("AWS_ISS_TransmitterBox", (ISS_BOX_X, ISS_BOX_Y, ISS_BOX_Z), (0.12, 0.09, 0.16), mat=mat_white_plastic, parent=root)
    # Tilted solar panel on transmitter box
    create_box("AWS_ISS_SolarPanel", (ISS_BOX_X, ISS_BOX_Y - 0.05, ISS_BOX_Z + 0.01), (0.10, 0.01, 0.12),
               rot=(-math.radians(20), 0, 0), mat=mat_solar_cell, parent=root)

    # Auxiliary Solar / UV sensor cylinder next to rain cone
    create_cylinder("AWS_UV_Sensor", (-0.14, 0.02, ISS_BASE_Z + 0.16), 0.022, 0.05, mat=mat_instrument_dark, parent=root)

    # Anemometer & Wind Vane Support Arm (reaching outward to +X)
    # Curved tubular arm starting from bracket and extending to +X
    ARM_START_X = 0.06
    ARM_END_X = 0.46
    ARM_END_Y = -0.02
    ARM_END_Z = ISS_BASE_Z + 0.25
    ARM_MID_X = (ARM_START_X + ARM_END_X) / 2.0
    ARM_MID_Y = -0.04
    ARM_MID_Z = ISS_BASE_Z + 0.12

    # Segment 1: angled arm from bracket
    seg1_len = math.hypot(ARM_END_X - ARM_START_X, ARM_END_Z - ISS_BASE_Z)
    seg1_rot_y = -math.atan2(ARM_END_Z - ISS_BASE_Z, ARM_END_X - ARM_START_X) + math.radians(90)
    create_cylinder("AWS_Anemo_Arm", (ARM_MID_X, ARM_MID_Y, (ISS_BASE_Z + ARM_END_Z)/2.0),
                    0.012, seg1_len, rot=(0, seg1_rot_y, 0), mat=mat_instrument_dark, parent=root)

    # Anemometer & Wind Vane Sensor Hub (Vertical cylinder at end of arm)
    HUB_X = ARM_END_X
    HUB_Y = ARM_END_Y
    HUB_Z = ARM_END_Z + 0.06
    create_cylinder("AWS_Anemo_Hub", (HUB_X, HUB_Y, HUB_Z), 0.022, 0.12, mat=mat_instrument_dark, parent=root)

    # Wind Direction Vane (Top of hub: Z = HUB_Z + 0.10)
    VANE_Z = HUB_Z + 0.08
    # Counterweight nose
    create_cylinder("AWS_Vane_Counterweight", (HUB_X - 0.08, HUB_Y, VANE_Z), 0.008, 0.06,
                    rot=(0, math.radians(90), 0), mat=mat_instrument_dark, parent=root)
    # Vane shaft
    create_cylinder("AWS_Vane_Shaft", (HUB_X, HUB_Y, VANE_Z), 0.004, 0.28,
                    rot=(0, math.radians(90), 0), mat=mat_instrument_dark, parent=root)
    # Aerodynamic black wind tail fin (IMG_4004)
    create_box("AWS_Vane_TailFin", (HUB_X + 0.14, HUB_Y, VANE_Z + 0.03), (0.10, 0.004, 0.07), mat=mat_instrument_dark, parent=root)

    # 3-Cup Anemometer (Below vane on hub: Z = HUB_Z - 0.04)
    CUP_ROTOR_Z = HUB_Z - 0.04
    create_cylinder("AWS_Cup_Rotor", (HUB_X, HUB_Y, CUP_ROTOR_Z), 0.016, 0.03, mat=mat_instrument_dark, parent=root)
    CUP_ARM_LEN = 0.10
    CUP_R = 0.022
    for c_idx, c_angle in enumerate([0, 2*math.pi/3, 4*math.pi/3]):
        cx = HUB_X + math.cos(c_angle) * (CUP_ARM_LEN / 2.0)
        cy = HUB_Y + math.sin(c_angle) * (CUP_ARM_LEN / 2.0)
        create_cylinder(f"AWS_Cup_Spoke_{c_idx}", (cx, cy, CUP_ROTOR_Z), 0.003, CUP_ARM_LEN,
                        rot=(0, math.radians(90), c_angle), mat=mat_instrument_dark, parent=root)
        # Hemispherical wind cup
        cup_end_x = HUB_X + math.cos(c_angle) * CUP_ARM_LEN
        cup_end_y = HUB_Y + math.sin(c_angle) * CUP_ARM_LEN
        create_cylinder(f"AWS_Cup_Head_{c_idx}", (cup_end_x, cup_end_y, CUP_ROTOR_Z), CUP_R, 0.024,
                        rot=(0, math.radians(90), c_angle + math.radians(90)), mat=mat_instrument_dark, parent=root)

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
    build_automated_weather_station()
