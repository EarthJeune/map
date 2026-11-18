import bpy
import bmesh
import math
import os
from mathutils import Vector

# ==============================================================================
# DA-RARES SEED STORAGE 3D ARCHITECTURAL MODEL GENERATOR
# Station: Rizal Agricultural Research & Experiment Station (Tanay, Rizal)
# Building ID: rares_building_3 ("Seed Storage")
# Ground Truth: Building Images RARES/Seed Storage/
# - Front Far.HEIC, Front Near.HEIC
# - Left angle of the Front.HEIC
# - Left is the Chemical Storage, The Right is the Seed Storage.HEIC
# - Right part of the building.HEIC
# - the left part of the picture is the back of the building...
# ==============================================================================

# 1. Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# 2. Material Helper
def create_mat(name, hex_color, roughness=0.6, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        h = hex_color.lstrip('#')
        rgb = tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4))
        rgb_lin = [c ** 2.2 for c in rgb] + [1.0]
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = rgb_lin
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
    return mat

# Calibrated materials strictly from field photographs
mat_wall_upper    = create_mat("RSS_WallMint",       "#8CAE88", roughness=0.82) # Weathered pale mint green stucco
mat_wall_wainscot = create_mat("RSS_WallDarkGreen",  "#183C25", roughness=0.85) # Rich dark forest green base wainscot
mat_roof_green    = create_mat("RSS_RoofGreen",      "#465E4C", roughness=0.65, metallic=0.15) # Corrugated green metal roof
mat_roof_ridge    = create_mat("RSS_RoofRidge",      "#304435", roughness=0.60, metallic=0.20) # Ridge cap
mat_fascia_green  = create_mat("RSS_FasciaGreen",    "#1B3822", roughness=0.75) # Dark green timber fascia boards
mat_concrete      = create_mat("RSS_Concrete",       "#858D88", roughness=0.90) # Concrete entrance canopy & foundation
mat_rollup_metal  = create_mat("RSS_RollUpDoor",     "#6C7F8E", roughness=0.95, metallic=0.0) # Diffuse matte slate galvanized metal shutter (prevents shadow acne / moiré)
mat_rollup_box    = create_mat("RSS_RollUpBox",      "#8A9AA5", roughness=0.85, metallic=0.0) # Overhead mechanism box
mat_door_frame    = create_mat("RSS_DoorFrame",      "#1E2226", roughness=0.50, metallic=0.30) # Dark bronze door frames & rails
mat_window_frame  = create_mat("RSS_WindowFrame",    "#252B30", roughness=0.50) # Dark window frames
mat_window_glass  = create_mat("RSS_WindowGlass",    "#121A20", roughness=0.15, metallic=0.40) # Tinted clerestory glass
mat_louver_dark   = create_mat("RSS_LouverDark",     "#202B24", roughness=0.85) # Concrete ventilation louvers
mat_hood_dark     = create_mat("RSS_HoodDark",       "#2A3035", roughness=0.60, metallic=0.50) # Dark hooded exhaust boxes
mat_sign_white    = create_mat("RSS_SignWhite",      "#F6F8FA", roughness=0.35) # DA project billboard face
mat_sign_border   = create_mat("RSS_SignBorder",     "#0E3817", roughness=0.50) # DA project billboard frame & text
mat_ac_metal      = create_mat("RSS_ACMetal",        "#D2CCC2", roughness=0.55, metallic=0.30) # Split AC condenser casing
mat_bracket_rust  = create_mat("RSS_BracketRust",    "#633420", roughness=0.75, metallic=0.50) # Steel AC support brackets

# Primitive box helper
def create_box(name, loc, size, mat=None, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    return obj

# Primitive cylinder helper
def create_cylinder(name, loc, radius, depth, mat=None, rot=(0,0,0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    return obj

# 3. Dimensions (m) strictly conforming to polygon & field photos
W = 16.86           # Building width along X
D = 20.64           # Building depth along Y
H_BASE = 1.05       # Wainscot height
H_WALL = 5.20       # Main wall / eave height
H_PARAPET = 6.20    # Flank parapet height
H_APEX = 6.80       # Central roof apex height
WALL_T = 0.25       # Wall thickness

X_MIN = -W / 2.0    # -8.43 m (West flank facing Chemical Storage)
X_MAX = W / 2.0     # +8.43 m (East flank facing Flatbed Dryer)
Y_FRONT = -D / 2.0  # -10.32 m (Front entrance facade facing courtyard)
Y_REAR = D / 2.0    # +10.32 m (Rear facade)

# ==============================================================================
# A. MONOLITHIC SOLID WATERTIGHT WALLS
# ==============================================================================
# 1. Wainscot Base (Z = 0.0 to 1.05 m)
Z_BASE_MID = H_BASE / 2.0
# Front Base (wainscot Z = 0.0 to 1.05 m):
# Symmetrical front facade flanking the central roll-up shutter (X in [-1.70, +1.70]):
# Left wing: X in [-8.43, -1.70] (width 6.73 m, center -5.065 m)
create_box("RSS_Base_Front_L",    (-5.065, Y_FRONT + WALL_T/2, Z_BASE_MID), (6.73, WALL_T, H_BASE), mat_wall_wainscot)
# Right wing: X in [1.70, 8.43] (width 6.73 m, center +5.065 m)
create_box("RSS_Base_Front_R",    ( 5.065, Y_FRONT + WALL_T/2, Z_BASE_MID), (6.73, WALL_T, H_BASE), mat_wall_wainscot)
create_box("RSS_Base_Rear",       ( 0.0,   Y_REAR - WALL_T/2,  Z_BASE_MID), (W,    WALL_T, H_BASE), mat_wall_wainscot)
create_box("RSS_Base_West",       (X_MIN + WALL_T/2, 0.0,      Z_BASE_MID), (WALL_T, D - WALL_T*2, H_BASE), mat_wall_wainscot)
create_box("RSS_Base_East",       (X_MAX - WALL_T/2, 0.0,      Z_BASE_MID), (WALL_T, D - WALL_T*2, H_BASE), mat_wall_wainscot)

# 2. Upper Stucco Walls (Z = 1.05 m to 5.20 m)
H_UPPER = H_WALL - H_BASE # 4.15 m
Z_UPPER_MID = H_BASE + H_UPPER / 2.0 # 3.125 m

# Front Upper Wall:
# Left wing: X in [-8.43, -1.70] (width 6.73 m)
create_box("RSS_Upper_Front_L",    (-5.065, Y_FRONT + WALL_T/2, Z_UPPER_MID), (6.73, WALL_T, H_UPPER), mat_wall_upper)
# Right wing: X in [1.70, 8.43] (width 6.73 m)
create_box("RSS_Upper_Front_R",    ( 5.065, Y_FRONT + WALL_T/2, Z_UPPER_MID), (6.73, WALL_T, H_UPPER), mat_wall_upper)
# Wall above roll-up shutter opening (Z = 3.55 m to 5.20 m, height 1.65 m):
create_box("RSS_Upper_Front_AboveRollup", (0.00, Y_FRONT + WALL_T/2, (3.55 + H_WALL)/2.0), (3.40, WALL_T, H_WALL - 3.55), mat_wall_upper)

# Rear Upper Wall:
create_box("RSS_Upper_Rear", (0.0, Y_REAR - WALL_T/2, Z_UPPER_MID), (W, WALL_T, H_UPPER), mat_wall_upper)

# West Upper Wall (with ribbon window openings):
create_box("RSS_Upper_West", (X_MIN + WALL_T/2, 0.0, Z_UPPER_MID), (WALL_T, D - WALL_T*2, H_UPPER), mat_wall_upper)

# East Upper Wall:
create_box("RSS_Upper_East", (X_MAX - WALL_T/2, 0.0, Z_UPPER_MID), (WALL_T, D - WALL_T*2, H_UPPER), mat_wall_upper)

# 3. Flank Parapet Walls (Z = 5.20 m to 6.20 m) along West and East sides
H_PAR = H_PARAPET - H_WALL # 1.00 m
Z_PAR_MID = H_WALL + H_PAR / 2.0 # 5.70 m
create_box("RSS_Parapet_West", (X_MIN + 0.18, 0.0, Z_PAR_MID), (0.36, D, H_PAR), mat_wall_upper)
create_box("RSS_Parapet_East", (X_MAX - 0.18, 0.0, Z_PAR_MID), (0.36, D, H_PAR), mat_wall_upper)

# Overhang beam lip along flank parapet tops (Front to Rear)
create_box("RSS_Parapet_Lip_West", (X_MIN + 0.22, 0.0, H_PARAPET + 0.05), (0.44, D + 0.20, 0.10), mat_wall_upper)
create_box("RSS_Parapet_Lip_East", (X_MAX - 0.22, 0.0, H_PARAPET + 0.05), (0.44, D + 0.20, 0.10), mat_wall_upper)

# Floor slab
create_box("RSS_InteriorFloor", (0.0, 0.0, 0.10), (W - WALL_T*2, D - WALL_T*2, 0.20), mat_concrete)

# ==============================================================================
# B. GABLE END TRIANGLES (FRONT & REAR)
# ==============================================================================
def create_gable_end(name, y_pos, is_front=True):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    t = WALL_T if is_front else -WALL_T
    x_l = X_MIN
    x_r = X_MAX
    xm  = 0.0
    z_bot = H_WALL
    z_top = H_APEX

    v0 = bm.verts.new((x_l, y_pos,     z_bot))
    v1 = bm.verts.new((x_r, y_pos,     z_bot))
    v2 = bm.verts.new((xm,  y_pos,     z_top))
    v3 = bm.verts.new((x_l, y_pos + t, z_bot))
    v4 = bm.verts.new((x_r, y_pos + t, z_bot))
    v5 = bm.verts.new((xm,  y_pos + t, z_top))

    bm.faces.new((v0, v1, v2) if is_front else (v0, v2, v1))
    bm.faces.new((v3, v5, v4) if is_front else (v3, v4, v5))
    bm.faces.new((v0, v3, v4, v1))
    bm.faces.new((v0, v2, v5, v3))
    bm.faces.new((v1, v4, v5, v2))

    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat_wall_upper)
    return obj

create_gable_end("RSS_Gable_Front", Y_FRONT, is_front=True)
create_gable_end("RSS_Gable_Rear",  Y_REAR,  is_front=False)

# Front and Rear Gable Rake Coping Beams
def create_gable_rake_coping(name, y_pos):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    w_lip = 0.32
    h_lip = 0.14
    dy = 0.16

    # Left rake: (X_MIN, y_pos, H_WALL) to (0, y_pos, H_APEX)
    # Right rake: (0, y_pos, H_APEX) to (X_MAX, y_pos, H_WALL)
    v0_l = bm.verts.new((X_MIN - 0.10, y_pos - dy/2, H_WALL))
    v1_l = bm.verts.new((0.0,          y_pos - dy/2, H_APEX + 0.05))
    v2_l = bm.verts.new((0.0,          y_pos + dy/2, H_APEX + 0.05))
    v3_l = bm.verts.new((X_MIN - 0.10, y_pos + dy/2, H_WALL))

    v4_l = bm.verts.new((X_MIN - 0.10, y_pos - dy/2, H_WALL + h_lip))
    v5_l = bm.verts.new((0.0,          y_pos - dy/2, H_APEX + 0.05 + h_lip))
    v6_l = bm.verts.new((0.0,          y_pos + dy/2, H_APEX + 0.05 + h_lip))
    v7_l = bm.verts.new((X_MIN - 0.10, y_pos + dy/2, H_WALL + h_lip))

    bm.faces.new((v0_l, v1_l, v2_l, v3_l))
    bm.faces.new((v7_l, v6_l, v5_l, v4_l))
    bm.faces.new((v0_l, v4_l, v5_l, v1_l))
    bm.faces.new((v2_l, v6_l, v7_l, v3_l))
    bm.faces.new((v0_l, v3_l, v7_l, v4_l))
    bm.faces.new((v1_l, v5_l, v6_l, v2_l))

    # Right rake:
    v0_r = bm.verts.new((0.0,          y_pos - dy/2, H_APEX + 0.05))
    v1_r = bm.verts.new((X_MAX + 0.10, y_pos - dy/2, H_WALL))
    v2_r = bm.verts.new((X_MAX + 0.10, y_pos + dy/2, H_WALL))
    v3_r = bm.verts.new((0.0,          y_pos + dy/2, H_APEX + 0.05))

    v4_r = bm.verts.new((0.0,          y_pos - dy/2, H_APEX + 0.05 + h_lip))
    v5_r = bm.verts.new((X_MAX + 0.10, y_pos - dy/2, H_WALL + h_lip))
    v6_r = bm.verts.new((X_MAX + 0.10, y_pos + dy/2, H_WALL + h_lip))
    v7_r = bm.verts.new((0.0,          y_pos + dy/2, H_APEX + 0.05 + h_lip))

    bm.faces.new((v0_r, v1_r, v2_r, v3_r))
    bm.faces.new((v7_r, v6_r, v5_r, v4_r))
    bm.faces.new((v0_r, v4_r, v5_r, v1_r))
    bm.faces.new((v2_r, v6_r, v7_r, v3_r))
    bm.faces.new((v0_r, v3_r, v7_r, v4_r))
    bm.faces.new((v1_r, v5_r, v6_r, v2_r))

    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat_wall_upper)
    return obj

create_gable_rake_coping("RSS_RakeCoping_Front", Y_FRONT - 0.02)
create_gable_rake_coping("RSS_RakeCoping_Rear",  Y_REAR  + 0.02)

# ==============================================================================
# C. CORRUGATED GABLE ROOF & RIDGE CAP
# ==============================================================================
ROOF_THICK = 0.08
def create_roof_slope(name, x_eave, x_apex, is_left=True):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    dx = x_apex - x_eave
    dz = H_APEX - H_WALL
    length = math.hypot(dx, dz)
    nx = -dz / length * ROOF_THICK
    nz =  dx / length * ROOF_THICK
    if not is_left:
        nx = -nx
        nz = -nz

    y0 = Y_FRONT + 0.05
    y1 = Y_REAR  - 0.05

    v0 = bm.verts.new((x_eave, y0, H_WALL))
    v1 = bm.verts.new((x_eave, y1, H_WALL))
    v2 = bm.verts.new((x_apex, y1, H_APEX))
    v3 = bm.verts.new((x_apex, y0, H_APEX))

    v4 = bm.verts.new((x_eave + nx, y0, H_WALL + nz))
    v5 = bm.verts.new((x_eave + nx, y1, H_WALL + nz))
    v6 = bm.verts.new((x_apex + nx, y1, H_APEX + nz))
    v7 = bm.verts.new((x_apex + nx, y0, H_APEX + nz))

    bm.faces.new((v0, v1, v2, v3))
    bm.faces.new((v7, v6, v5, v4))
    bm.faces.new((v0, v4, v5, v1))
    bm.faces.new((v2, v6, v7, v3))
    bm.faces.new((v0, v3, v7, v4))
    bm.faces.new((v1, v5, v6, v2))

    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat_roof_green)
    return obj

create_roof_slope("RSS_Roof_West", X_MIN + 0.35, 0.0, is_left=True)
create_roof_slope("RSS_Roof_East", X_MAX - 0.35, 0.0, is_left=False)

# Ridge cap
create_box("RSS_Roof_RidgeCap", (0.0, 0.0, H_APEX + 0.05), (0.40, D + 0.10, 0.08), mat_roof_ridge)

# ==============================================================================
# D. FRONT ENTRANCE CANOPY & ROLL-UP SHUTTER GATE
# ==============================================================================
# Cantilevered Concrete Entrance Canopy (Front Far.HEIC, Front Near.HEIC)
# Centered directly above the main roll-up shutter gate (X = 0.00 m)
CANOPY_W = 4.80
CANOPY_PROJ = 2.85
CANOPY_Y_END = Y_FRONT - CANOPY_PROJ # -13.17 m
CANOPY_Z = 3.90
CANOPY_T = 0.18

# Canopy roof slab
create_box("RSS_Canopy_Slab", (0.00, (Y_FRONT + CANOPY_Y_END)/2, CANOPY_Z), (CANOPY_W, CANOPY_PROJ, CANOPY_T), mat_concrete)

# Cantilever cheek walls supporting canopy on left and right
CHEEK_T = 0.22
CHEEK_H = 1.20
create_box("RSS_Canopy_Cheek_L", (-CANOPY_W/2 + CHEEK_T/2, (Y_FRONT + CANOPY_Y_END)/2, CANOPY_Z - CHEEK_H/2 + CANOPY_T/2),
           (CHEEK_T, CANOPY_PROJ, CHEEK_H), mat_concrete)
create_box("RSS_Canopy_Cheek_R", ( CANOPY_W/2 - CHEEK_T/2, (Y_FRONT + CANOPY_Y_END)/2, CANOPY_Z - CHEEK_H/2 + CANOPY_T/2),
           (CHEEK_T, CANOPY_PROJ, CHEEK_H), mat_concrete)

# Front lip / fascia on canopy front edge
create_box("RSS_Canopy_FrontLip", (0.00, CANOPY_Y_END - 0.03, CANOPY_Z + 0.05), (CANOPY_W + 0.04, 0.06, 0.28), mat_concrete)

# Concrete entrance apron / threshold ramp on ground
create_box("RSS_Entrance_Apron", (0.00, (Y_FRONT + CANOPY_Y_END)/2, 0.08), (CANOPY_W + 0.40, CANOPY_PROJ + 0.40, 0.16), mat_concrete)

# Commercial Roll-Up Shutter Door (Width 3.40 m, Height 3.55 m, Center X = 0.00 m)
# High-quality solid diffuse gate strictly non-coplanar to prevent shadow acne / moire artifacts
ROLLUP_W = 3.40
ROLLUP_H = 3.55
ROLLUP_X = 0.00

# Side guide rails / tracks (left and right jambs)
create_box("RSS_RollUp_Rail_L", (-ROLLUP_W/2.0 - 0.03, Y_FRONT - 0.03, ROLLUP_H/2.0), (0.06, 0.08, ROLLUP_H), mat_door_frame)
create_box("RSS_RollUp_Rail_R", ( ROLLUP_W/2.0 + 0.03, Y_FRONT - 0.03, ROLLUP_H/2.0), (0.06, 0.08, ROLLUP_H), mat_door_frame)

# Roll-up door panel recessed inside opening with clean solid thickness
create_box("RSS_RollUp_Door", (ROLLUP_X, Y_FRONT + 0.02, ROLLUP_H/2.0), (ROLLUP_W, 0.06, ROLLUP_H), mat_rollup_metal)

# Bottom metal seal / lift bar
create_box("RSS_RollUp_BottomBar", (ROLLUP_X, Y_FRONT - 0.03, 0.08), (ROLLUP_W - 0.02, 0.05, 0.16), mat_door_frame)

# Overhead Mechanism Box
create_box("RSS_RollUp_Box", (ROLLUP_X, Y_FRONT - 0.08, ROLLUP_H + 0.18), (ROLLUP_W + 0.20, 0.22, 0.36), mat_rollup_box)

# Lamp / switch box centered above mechanism box
create_box("RSS_RollUp_Lamp", (ROLLUP_X, Y_FRONT - 0.03, ROLLUP_H + 0.42), (0.16, 0.06, 0.12), mat_louver_dark)
# Strictly NO excess pedestrian door under canopy (ground-truth facility has single roll-up gate only)

# ==============================================================================
# E. EXHAUST FAN HOODS & VENTILATION LOUVER BANDS
# ==============================================================================
# Angular Hooded Exhaust Fan Boxes (2 on Front, 2 on Rear)
def create_exhaust_hood(name, x, y, z, is_front=True):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    hw = 0.45
    hh = 0.50
    hd = 0.45
    dy = -hd if is_front else hd

    # Back wall quad against building
    v0 = bm.verts.new((x - hw, y, z - hh))
    v1 = bm.verts.new((x + hw, y, z - hh))
    v2 = bm.verts.new((x + hw, y, z + hh))
    v3 = bm.verts.new((x - hw, y, z + hh))

    # Front outer edge quad sloping downwards
    v4 = bm.verts.new((x - hw, y + dy, z - hh + 0.10))
    v5 = bm.verts.new((x + hw, y + dy, z - hh + 0.10))
    v6 = bm.verts.new((x + hw, y + dy, z + hh - 0.25))
    v7 = bm.verts.new((x - hw, y + dy, z + hh - 0.25))

    bm.faces.new((v0, v1, v2, v3) if not is_front else (v0, v3, v2, v1))
    bm.faces.new((v4, v5, v6, v7) if is_front else (v4, v7, v6, v5))
    bm.faces.new((v0, v1, v5, v4))
    bm.faces.new((v2, v3, v7, v6))
    bm.faces.new((v0, v4, v7, v3))
    bm.faces.new((v1, v2, v6, v5))

    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat_hood_dark)
    return obj

# 2 Front Hoods above canopy
create_exhaust_hood("RSS_Hood_Front_L", -1.10, Y_FRONT - 0.02, 4.90, is_front=True)
create_exhaust_hood("RSS_Hood_Front_R",  0.40, Y_FRONT - 0.02, 4.90, is_front=True)

# 2 Rear Hoods
create_exhaust_hood("RSS_Hood_Rear_L",  -1.10, Y_REAR + 0.02, 4.90, is_front=False)
create_exhaust_hood("RSS_Hood_Rear_R",   0.40, Y_REAR + 0.02, 4.90, is_front=False)

# Horizontal Ventilation Louver Blocks (Front & Rear at Z = 4.35 m)
VENT_Z = 4.35
VENT_H = 0.35
# Front Louvers (Left wing and Right wing)
create_box("RSS_Vent_Front_L", ((X_MIN - 2.80)/2, Y_FRONT - 0.01, VENT_Z), (abs(X_MIN) - 2.80 - 0.40, 0.06, VENT_H), mat_louver_dark)
create_box("RSS_Vent_Front_R", ((X_MAX + 1.80)/2, Y_FRONT - 0.01, VENT_Z), (X_MAX - 1.80 - 0.40, 0.06, VENT_H), mat_louver_dark)

# Rear Louver Band across rear facade
create_box("RSS_Vent_Rear_L", (-4.50, Y_REAR + 0.01, VENT_Z), (6.50, 0.06, VENT_H), mat_louver_dark)
create_box("RSS_Vent_Rear_R", ( 4.50, Y_REAR + 0.01, VENT_Z), (6.50, 0.06, VENT_H), mat_louver_dark)

# ==============================================================================
# F. CLERESTORY RIBBON WINDOWS (WEST & EAST SIDES)
# ==============================================================================
WIN_Z = 3.60
WIN_H = 0.85
WIN_W = 2.40

# West Wall Windows (3 bays)
for i, wy in enumerate([-6.0, 0.0, 6.0]):
    create_box(f"RSS_Win_West_{i}_Frame", (X_MIN - 0.02, wy, WIN_Z), (0.08, WIN_W, WIN_H), mat_window_frame)
    create_box(f"RSS_Win_West_{i}_Glass", (X_MIN - 0.02, wy, WIN_Z), (0.02, WIN_W - 0.10, WIN_H - 0.10), mat_window_glass)

# East Wall Windows (3 bays)
for j, ey in enumerate([-6.0, 0.0, 6.0]):
    create_box(f"RSS_Win_East_{j}_Frame", (X_MAX + 0.02, ey, WIN_Z), (0.08, WIN_W, WIN_H), mat_window_frame)
    create_box(f"RSS_Win_East_{j}_Glass", (X_MAX + 0.02, ey, WIN_Z), (0.02, WIN_W - 0.10, WIN_H - 0.10), mat_window_glass)

# ==============================================================================
# G. WALL-MOUNTED AC CONDENSER & BRACKETS (WEST WALL, FACING CHEMICAL STORAGE)
# ==============================================================================
AC_X = X_MIN - 0.35 # Projecting out towards Chemical Storage
AC_Y = -8.20
AC_Z = 3.40
AC_W = 0.45
AC_D = 0.90
AC_H = 0.65

# AC Condenser Casing
create_box("RSS_AC_Unit", (AC_X, AC_Y, AC_Z), (AC_W, AC_D, AC_H), mat_ac_metal)

# Steel Angle Brackets
create_box("RSS_AC_Bracket_1", (AC_X, AC_Y - 0.30, AC_Z - AC_H/2 - 0.15), (AC_W + 0.20, 0.06, 0.30), mat_bracket_rust)
create_box("RSS_AC_Bracket_2", (AC_X, AC_Y + 0.30, AC_Z - AC_H/2 - 0.15), (AC_W + 0.20, 0.06, 0.30), mat_bracket_rust)

# ==============================================================================
# H. DA PROJECT BILLBOARD & VISITOR CHAIRS (FRONT FACADE)
# ==============================================================================
SIGN_W = 3.20
SIGN_H = 2.00
SIGN_X = 5.00
SIGN_Y = Y_FRONT - 0.02
SIGN_Z = 2.40

# Billboard Border Frame backing
create_box("RSS_Sign_Border", (SIGN_X, SIGN_Y, SIGN_Z), (SIGN_W + 0.08, 0.02, SIGN_H + 0.08), mat_sign_border)

# Billboard White Face (projecting slightly in front of border)
create_box("RSS_Sign_Face",   (SIGN_X, SIGN_Y - 0.015, SIGN_Z), (SIGN_W, 0.015, SIGN_H), mat_sign_white)

# Text and emblem simulated with clean architectural relief plates
create_box("RSS_Sign_Header", (SIGN_X, SIGN_Y - 0.025, SIGN_Z + 0.70), (2.40, 0.01, 0.18), mat_sign_border)
create_box("RSS_Sign_Title",  (SIGN_X, SIGN_Y - 0.025, SIGN_Z + 0.35), (2.80, 0.01, 0.22), mat_sign_border)
for line in range(4):
    create_box(f"RSS_Sign_Line_{line}", (SIGN_X, SIGN_Y - 0.025, SIGN_Z - 0.10 - line * 0.18), (2.80, 0.01, 0.06), mat_sign_border)
# Strictly NO outdoor folding chairs per Rule 4

# ==============================================================================
# I. STRUCTURAL PILASTERS / BUTTRESSES
# ==============================================================================
PIL_T = 0.38
PIL_PROJ = 0.18

# 4 Front Pilasters (flanking the facade bays, outside the canopy and billboard)
for px in [X_MIN + PIL_T/2, -3.60, 2.60, X_MAX - PIL_T/2]:
    create_box(f"RSS_Pilaster_Front_Base_{px:.1f}",  (px, Y_FRONT - PIL_PROJ/2, H_BASE/2), (PIL_T, PIL_PROJ, H_BASE), mat_wall_wainscot)
    create_box(f"RSS_Pilaster_Front_Upper_{px:.1f}", (px, Y_FRONT - PIL_PROJ/2, H_BASE + (H_WALL - H_BASE)/2), (PIL_T, PIL_PROJ, H_WALL - H_BASE), mat_wall_upper)

# 4 Rear Pilasters
for rx in [X_MIN + PIL_T/2, -3.60, 2.60, X_MAX - PIL_T/2]:
    create_box(f"RSS_Pilaster_Rear_Base_{rx:.1f}",  (rx, Y_REAR + PIL_PROJ/2, H_BASE/2), (PIL_T, PIL_PROJ, H_BASE), mat_wall_wainscot)
    create_box(f"RSS_Pilaster_Rear_Upper_{rx:.1f}", (rx, Y_REAR + PIL_PROJ/2, H_BASE + (H_WALL - H_BASE)/2), (PIL_T, PIL_PROJ, H_WALL - H_BASE), mat_wall_upper)

# Side Pilasters on West and East
for py in [-4.0, 4.0]:
    create_box(f"RSS_Pilaster_West_Base_{py:.1f}",  (X_MIN - PIL_PROJ/2, py, H_BASE/2), (PIL_PROJ, PIL_T, H_BASE), mat_wall_wainscot)
    create_box(f"RSS_Pilaster_West_Upper_{py:.1f}", (X_MIN - PIL_PROJ/2, py, H_BASE + (H_WALL - H_BASE)/2), (PIL_PROJ, PIL_T, H_WALL - H_BASE), mat_wall_upper)
    create_box(f"RSS_Pilaster_East_Base_{py:.1f}",  (X_MAX + PIL_PROJ/2, py, H_BASE/2), (PIL_PROJ, PIL_T, H_BASE), mat_wall_wainscot)
    create_box(f"RSS_Pilaster_East_Upper_{py:.1f}", (X_MAX + PIL_PROJ/2, py, H_BASE + (H_WALL - H_BASE)/2), (PIL_PROJ, PIL_T, H_WALL - H_BASE), mat_wall_upper)

# ==============================================================================
# J. OPTIMIZATION & EXPORT (BUDGET < 300 KB)
# ==============================================================================
print("Joining objects by material for optimal draw calls and file size...")

bpy.ops.object.select_all(action='DESELECT')
material_groups = {}
for obj in list(bpy.context.scene.objects):
    if obj.type == 'MESH':
        mat_key = obj.data.materials[0].name if len(obj.data.materials) > 0 else "None"
        material_groups.setdefault(mat_key, []).append(obj)

for mat_key, objs in material_groups.items():
    if len(objs) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        objs[0].name = f"RSS_Joined_{mat_key}"

bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.context.scene.objects:
    if obj.type == 'MESH':
        obj.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

out_dir = r"c:\Users\LGU-SanPedro\Downloads\map\models"
os.makedirs(out_dir, exist_ok=True)
glb_path = os.path.join(out_dir, "rares_seed_storage.glb")

bpy.ops.export_scene.gltf(
    filepath=glb_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_yup=True
)

file_size_kb = os.path.getsize(glb_path) / 1024.0
print(f"Exported: {glb_path}")
print(f"File size: {file_size_kb:.2f} KB (Budget: <300 KB)")
if file_size_kb < 300.0:
    print("SUCCESS: Performance budget satisfied!")
else:
    print("WARNING: Exceeds 300 KB budget!")

