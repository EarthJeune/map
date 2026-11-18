import bpy
import bmesh
import math
import os
from mathutils import Vector

# ==============================================================================
# DA-RARES CHEMICAL STORAGE 3D ARCHITECTURAL MODEL GENERATOR
# Station: Rizal Agricultural Research & Experiment Station (Tanay, Rizal)
# Building ID: rares_building_4 ("Chemical Storage")
# Ground Truth:
# - Building Images RARES/Chemical Storage/
#   * Front Close.HEIC / chem_storage_front_close.jpg
#   * Front Far.HEIC / chem_storage_front_far.jpg
#   * Left Side angle.HEIC / chem_storage_left_angle.jpg
#   * Left part is the Flatbed while the right part is the Chemical Storage Left part.HEIC
# - rares_buildings.json polygon (4 vertices, 9.68 m x 11.29 m)
# - rares_roads.json entrance node rares_entrance_3 ([121.34057249, 14.57591978])
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
mat_wall_upper    = create_mat("RCS_WallMint",       "#75A36A", roughness=0.82) # Soft mint green stucco
mat_wall_wainscot = create_mat("RCS_WallDarkGreen",  "#183C25", roughness=0.85) # Rich dark forest green base wainscot
mat_roof_green    = create_mat("RCS_RoofGreen",      "#3A5E3F", roughness=0.65, metallic=0.15) # Corrugated green metal roof
mat_roof_ridge    = create_mat("RCS_RoofRidge",      "#28462C", roughness=0.60, metallic=0.20) # Ridge cap
mat_fascia_white  = create_mat("RCS_FasciaWhite",    "#F0F4F2", roughness=0.50) # White metal fascia rakes
mat_soffit_cream  = create_mat("RCS_SoffitCream",    "#D8DECE", roughness=0.85) # Tongue-and-groove soffit ceiling
mat_concrete      = create_mat("RCS_Concrete",       "#858D88", roughness=0.90) # Concrete entrance apron & steps
mat_rollup_door   = create_mat("RCS_RollUpDoor",     "#8E969B", roughness=0.70, metallic=0.25) # Metal roll-up service door
mat_door_frame    = create_mat("RCS_DoorFrame",      "#1E2226", roughness=0.50, metallic=0.30) # Dark bronze frames
mat_door_glass    = create_mat("RCS_DoorGlass",      "#121A20", roughness=0.15, metallic=0.40) # Tinted glass
mat_window_frame  = create_mat("RCS_WindowFrame",    "#252B30", roughness=0.50) # Dark bronze window frames
mat_window_grille = create_mat("RCS_WindowGrille",   "#F5F7FA", roughness=0.40) # White security grilles
mat_sign_white    = create_mat("RCS_SignWhite",      "#F6F8FA", roughness=0.35) # White signboard face
mat_sign_border   = create_mat("RCS_SignBorder",     "#0E3817", roughness=0.50) # Dark green border trim
mat_sign_text     = create_mat("RCS_SignText",       "#0E3817", roughness=0.50) # Dark green 3D text
mat_sign_gold     = create_mat("RCS_SignGold",       "#DCA032", roughness=0.40, metallic=0.50) # Gold DA emblem
mat_metal_silver  = create_mat("RCS_MetalSilver",    "#9EADB8", roughness=0.40, metallic=0.75) # Silver sheet metal doors

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

# ==============================================================================
# 3. DIMENSIONS CONFORMING STRICTLY TO SURVEY POLYGON & FIELD PHOTOGRAPHS
# ==============================================================================
W = 9.68            # Building width along X (exact survey polygon width in rares_buildings.json)
D = 11.29           # Building depth along Y (long axis)
H_BASE = 1.05       # Height of dark green foundation wainscot skirt
H_EAVE = 3.30       # Eave height
H_APEX = 4.80       # Central roof apex height (ridge at X = 0.0)
WALL_T = 0.22       # Wall thickness

X_MIN = -W / 2.0    # -3.20 m (East flank facing Flatbed Dryer)
X_MAX = W / 2.0     # +3.20 m (West flank facing Seed Storage alley)
Y_FRONT = -D / 2.0  # -5.645 m (Front entrance facade facing North courtyard)
Y_REAR = D / 2.0    # +5.645 m (Rear facade facing South)

# ==============================================================================
# A. MONOLITHIC SOLID WATERTIGHT WALLS
# ==============================================================================
H_UPPER = H_EAVE - H_BASE # 2.25 m
Z_BASE_MID = H_BASE / 2.0 # 0.525 m
Z_UPPER_MID = H_BASE + H_UPPER / 2.0 # 2.175 m

# 1. Front Wall (Y = Y_FRONT) strictly per Front Close.jpg:
# Left double door: X in [X_MIN + 0.60, X_MIN + 2.50] (width 1.90 m, height 2.20 m)
# Right solid wall with continuous 9-pane window: X in [X_MIN + 2.50, X_MAX]
W_DOOR = 1.90
H_DOOR = 2.20
X_DOOR_L = X_MIN + 0.60
X_DOOR_R = X_DOOR_L + W_DOOR
X_DOOR_CTR = (X_DOOR_L + X_DOOR_R) / 2.0

# Left jamb wall (X from X_MIN to X_DOOR_L): width 0.50 m
W_JAMB_L = abs(X_DOOR_L - X_MIN) # 0.50 m
X_JAMB_L = (X_MIN + X_DOOR_L) / 2.0
create_box("RCS_Base_Front_Jamb",  (X_JAMB_L, Y_FRONT + WALL_T/2, Z_BASE_MID),  (W_JAMB_L, WALL_T, H_BASE), mat_wall_wainscot)
create_box("RCS_Upper_Front_Jamb", (X_JAMB_L, Y_FRONT + WALL_T/2, Z_UPPER_MID), (W_JAMB_L, WALL_T, H_UPPER), mat_wall_upper)

# Right wall (X from X_DOOR_R to X_MAX): width 4.10 m
W_RIGHT = abs(X_MAX - X_DOOR_R) # 4.10 m
X_RIGHT_CTR = (X_DOOR_R + X_MAX) / 2.0
create_box("RCS_Base_Front_R",  (X_RIGHT_CTR, Y_FRONT + WALL_T/2, Z_BASE_MID),  (W_RIGHT, WALL_T, H_BASE), mat_wall_wainscot)
create_box("RCS_Upper_Front_R", (X_RIGHT_CTR, Y_FRONT + WALL_T/2, Z_UPPER_MID), (W_RIGHT, WALL_T, H_UPPER), mat_wall_upper)

# Header beam above left door (Z from 2.20 m to H_EAVE = 3.30 m):
create_box("RCS_Upper_Front_Header", (X_DOOR_CTR, Y_FRONT + WALL_T/2, (H_DOOR + H_EAVE)/2.0), (W_DOOR, WALL_T, H_EAVE - H_DOOR), mat_wall_upper)

# 2. Rear Wall (Y = Y_REAR)
create_box("RCS_Base_Rear",  (0.0, Y_REAR - WALL_T/2, Z_BASE_MID),  (W, WALL_T, H_BASE), mat_wall_wainscot)
create_box("RCS_Upper_Rear", (0.0, Y_REAR - WALL_T/2, Z_UPPER_MID), (W, WALL_T, H_UPPER), mat_wall_upper)

# 3. Flank Walls (West and East)
D_FLANK = D - WALL_T * 2
create_box("RCS_Base_East",  (X_MIN + WALL_T/2, 0.0, Z_BASE_MID),  (WALL_T, D_FLANK, H_BASE), mat_wall_wainscot)
create_box("RCS_Upper_East", (X_MIN + WALL_T/2, 0.0, Z_UPPER_MID), (WALL_T, D_FLANK, H_UPPER), mat_wall_upper)

create_box("RCS_Base_West",  (X_MAX - WALL_T/2, 0.0, Z_BASE_MID),  (WALL_T, D_FLANK, H_BASE), mat_wall_wainscot)
create_box("RCS_Upper_West", (X_MAX - WALL_T/2, 0.0, Z_UPPER_MID), (WALL_T, D_FLANK, H_UPPER), mat_wall_upper)

# Interior concrete floor slab
create_box("RCS_InteriorFloor", (0.0, 0.0, 0.10), (W - WALL_T*2, D - WALL_T*2, 0.20), mat_concrete)

# ==============================================================================
# B. GABLE END TRIANGLES (SYMMETRICAL ON FRONT AND REAR AT X = 0.0)
# ==============================================================================
def create_symmetrical_gable(name, y_pos, is_front=True):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    t = WALL_T if is_front else -WALL_T
    y1 = y_pos
    y2 = y_pos + t
    z_base = H_EAVE # 3.30 m
    z_apex = H_APEX # 4.80 m

    v0 = bm.verts.new((X_MIN, y1, z_base))
    v1 = bm.verts.new((X_MAX, y1, z_base))
    v2 = bm.verts.new((0.0,   y1, z_apex))

    v3 = bm.verts.new((X_MIN, y2, z_base))
    v4 = bm.verts.new((X_MAX, y2, z_base))
    v5 = bm.verts.new((0.0,   y2, z_apex))

    if is_front:
        bm.faces.new((v0, v1, v2))
        bm.faces.new((v5, v4, v3))
    else:
        bm.faces.new((v2, v1, v0))
        bm.faces.new((v3, v4, v5))

    bm.faces.new((v0, v3, v4, v1))
    bm.faces.new((v1, v4, v5, v2))
    bm.faces.new((v2, v5, v3, v0))

    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat_wall_upper)
    return obj

create_symmetrical_gable("RCS_Gable_Front", Y_FRONT, is_front=True)
create_symmetrical_gable("RCS_Gable_Rear",  Y_REAR,  is_front=False)

# ==============================================================================
# C. 100% WATERTIGHT CORRUGATED GREEN GABLE ROOF
# ==============================================================================
OVERHANG_X = 0.65 # Eave overhang beyond flank walls
OVERHANG_Y = 0.55 # Gable rake overhang beyond front/rear gables

X_ROOF_L = X_MIN - OVERHANG_X # -5.49 m
X_ROOF_R = X_MAX + OVERHANG_X # +5.49 m
Y_ROOF_FRONT = Y_FRONT - OVERHANG_Y # -6.195 m
Y_ROOF_REAR = Y_REAR + OVERHANG_Y   # +6.195 m

ROOF_THICK = 0.08
Z_EAVE_ROOF = H_EAVE - 0.05 # 3.25 m
Z_APEX_ROOF = H_APEX + 0.06 # 4.86 m

# Sloped roof slab helper (Left and Right pitch planes)
def create_roof_pitch(name, x_eave, x_ridge, y1, y2, z_eave, z_ridge, thick):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()

    v0 = bm.verts.new((x_eave,  y1, z_eave))
    v1 = bm.verts.new((x_eave,  y2, z_eave))
    v2 = bm.verts.new((x_ridge, y2, z_ridge))
    v3 = bm.verts.new((x_ridge, y1, z_ridge))

    v4 = bm.verts.new((x_eave,  y1, z_eave - thick))
    v5 = bm.verts.new((x_eave,  y2, z_eave - thick))
    v6 = bm.verts.new((x_ridge, y2, z_ridge - thick))
    v7 = bm.verts.new((x_ridge, y1, z_ridge - thick))

    bm.faces.new((v0, v1, v2, v3)) # Top
    bm.faces.new((v7, v6, v5, v4)) # Bottom
    bm.faces.new((v0, v4, v5, v1)) # Eave edge
    bm.faces.new((v3, v2, v6, v7)) # Ridge edge
    bm.faces.new((v0, v3, v7, v4)) # Front rake edge
    bm.faces.new((v1, v5, v6, v2)) # Rear rake edge

    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat_roof_green)
    return obj

# East Pitch (sloping down to East / X_MIN)
create_roof_pitch("RCS_Roof_Pitch_East", X_ROOF_L, 0.0, Y_ROOF_FRONT, Y_ROOF_REAR, Z_EAVE_ROOF, Z_APEX_ROOF, ROOF_THICK)
# West Pitch (sloping down to West / X_MAX)
create_roof_pitch("RCS_Roof_Pitch_West", X_ROOF_R, 0.0, Y_ROOF_FRONT, Y_ROOF_REAR, Z_EAVE_ROOF, Z_APEX_ROOF, ROOF_THICK)

# Ridge cap along X = 0.0
W_RIDGE = Y_ROOF_REAR - Y_ROOF_FRONT + 0.10
create_box("RCS_Roof_RidgeCap", (0.0, 0.0, Z_APEX_ROOF + 0.04), (0.35, W_RIDGE, 0.06), mat_roof_ridge)

# White fascia rakes on Front and Rear gable ends
def create_gable_fascias(name, y_pos, is_front=True):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    thick = 0.05
    w_rake = 0.18
    t = -0.06 if is_front else 0.06

    # 1. Left rake (from apex down to X_ROOF_L)
    v0 = bm.verts.new((0.0,      y_pos,     Z_APEX_ROOF + 0.02))
    v1 = bm.verts.new((X_ROOF_L, y_pos,     Z_EAVE_ROOF))
    v2 = bm.verts.new((X_ROOF_L, y_pos,     Z_EAVE_ROOF - w_rake))
    v3 = bm.verts.new((0.0,      y_pos,     Z_APEX_ROOF + 0.02 - w_rake))

    v4 = bm.verts.new((0.0,      y_pos + t, Z_APEX_ROOF + 0.02))
    v5 = bm.verts.new((X_ROOF_L, y_pos + t, Z_EAVE_ROOF))
    v6 = bm.verts.new((X_ROOF_L, y_pos + t, Z_EAVE_ROOF - w_rake))
    v7 = bm.verts.new((0.0,      y_pos + t, Z_APEX_ROOF + 0.02 - w_rake))

    bm.faces.new((v0, v1, v2, v3))
    bm.faces.new((v7, v6, v5, v4))
    bm.faces.new((v0, v4, v5, v1))
    bm.faces.new((v2, v6, v7, v3))
    bm.faces.new((v0, v3, v7, v4))
    bm.faces.new((v1, v5, v6, v2))

    # 2. Right rake (from apex down to X_ROOF_R)
    u0 = bm.verts.new((0.0,      y_pos,     Z_APEX_ROOF + 0.02))
    u1 = bm.verts.new((X_ROOF_R, y_pos,     Z_EAVE_ROOF))
    u2 = bm.verts.new((X_ROOF_R, y_pos,     Z_EAVE_ROOF - w_rake))
    u3 = bm.verts.new((0.0,      y_pos,     Z_APEX_ROOF + 0.02 - w_rake))

    u4 = bm.verts.new((0.0,      y_pos + t, Z_APEX_ROOF + 0.02))
    u5 = bm.verts.new((X_ROOF_R, y_pos + t, Z_EAVE_ROOF))
    u6 = bm.verts.new((X_ROOF_R, y_pos + t, Z_EAVE_ROOF - w_rake))
    u7 = bm.verts.new((0.0,      y_pos + t, Z_APEX_ROOF + 0.02 - w_rake))

    bm.faces.new((u0, u3, u2, u1))
    bm.faces.new((u4, u5, u6, u7))
    bm.faces.new((u0, u1, u5, u4))
    bm.faces.new((u3, u7, u6, u2))
    bm.faces.new((u0, u4, u7, u3))
    bm.faces.new((u1, u2, u6, u5))

    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat_fascia_white)
    return obj

create_gable_fascias("RCS_Fascia_Front", Y_ROOF_FRONT, is_front=True)
create_gable_fascias("RCS_Fascia_Rear",  Y_ROOF_REAR,  is_front=False)

# Eave horizontal soffits along East and West sides
create_box("RCS_Soffit_East", (X_MIN - OVERHANG_X / 2.0, 0.0, Z_EAVE_ROOF - 0.05), (OVERHANG_X, D_FLANK + OVERHANG_Y*2, 0.03), mat_soffit_cream)
create_box("RCS_Soffit_West", (X_MAX + OVERHANG_X / 2.0, 0.0, Z_EAVE_ROOF - 0.05), (OVERHANG_X, D_FLANK + OVERHANG_Y*2, 0.03), mat_soffit_cream)

# ==============================================================================
# D. ENTRANCE APPAREL & AUTHENTIC FRONT DOUBLE METAL DOORS
# ==============================================================================
# 1. Concrete Entrance Ramp leading into left double door
create_box("RCS_Entrance_Ramp", (X_DOOR_CTR, Y_FRONT - 0.60, 0.08), (W_DOOR + 0.20, 1.20, 0.16), mat_concrete)

# 2. Authentic Front Double Metal Sheet Doors per Front Close.jpg
create_box("RCS_Door_Frame", (X_DOOR_CTR, Y_FRONT + 0.02, H_DOOR / 2.0), (W_DOOR, 0.08, H_DOOR), mat_door_frame)
create_box("RCS_Door_Leaf_L", (X_DOOR_CTR - W_DOOR/4.0, Y_FRONT + 0.03, H_DOOR / 2.0), (W_DOOR/2.0 - 0.04, 0.03, H_DOOR - 0.06), mat_metal_silver)
create_box("RCS_Door_Leaf_R", (X_DOOR_CTR + W_DOOR/4.0, Y_FRONT + 0.03, H_DOOR / 2.0), (W_DOOR/2.0 - 0.04, 0.03, H_DOOR - 0.06), mat_metal_silver)

# Square embossed panel details on metal doors
for col in range(2):
    px = X_DOOR_CTR - W_DOOR/4.0 + (col * (W_DOOR/2.0))
    for row in range(5):
        pz = 0.30 + row * 0.40
        create_box(f"RCS_Door_Panel_{col}_{row}", (px, Y_FRONT - 0.01, pz), (W_DOOR/2.0 - 0.14, 0.015, 0.32), mat_door_frame)

# ==============================================================================
# E. AUTHENTIC MULTI-PANE WINDOWS
# ==============================================================================
def create_storage_window(name, loc, is_ns=False, w=1.60, h=1.15):
    x, y, z = loc
    d = 0.06
    if is_ns:
        # Window on East/West flank walls (parallel to Y axis)
        create_box(f"{name}_Frame", (x, y, z), (d, w, h), mat_window_frame)
        create_box(f"{name}_Glass", (x, y, z), (0.02, w - 0.08, h - 0.08), mat_door_glass)
        for b in range(3):
            bz = z - h/2 + (h/4) * (b + 1)
            create_box(f"{name}_HBar_{b}", (x - 0.02, y, bz), (0.015, w - 0.08, 0.02), mat_window_grille)
        for v in range(4):
            vy = y - w/2 + (w/5) * (v + 1)
            create_box(f"{name}_VBar_{v}", (x - 0.02, vy, z), (0.015, 0.02, h - 0.08), mat_window_grille)
    else:
        # Window on Front/Rear walls (parallel to X axis)
        create_box(f"{name}_Frame", (x, y, z), (w, d, h), mat_window_frame)
        create_box(f"{name}_Glass", (x, y, z), (w - 0.08, 0.02, h - 0.08), mat_door_glass)
        for b in range(3):
            bz = z - h/2 + (h/4) * (b + 1)
            create_box(f"{name}_HBar_{b}", (x, y - 0.02, bz), (w - 0.08, 0.015, 0.02), mat_window_grille)
        for v in range(4):
            vx = x - w/2 + (w/5) * (v + 1)
            create_box(f"{name}_VBar_{v}", (vx, y - 0.02, z), (0.02, 0.015, h - 0.08), mat_window_grille)

WIN_Z = 2.05

# 1. Front Continuous 9-Pane Window strictly per Front Close.jpg:
# Spans along the right side of the front facade
W_WIN_FRONT = 4.20
X_WIN_FRONT = (X_DOOR_R + X_MAX) / 2.0
create_box("RCS_Win_Front_Frame", (X_WIN_FRONT, Y_FRONT, WIN_Z), (W_WIN_FRONT, 0.06, 1.15), mat_window_frame)
create_box("RCS_Win_Front_Glass", (X_WIN_FRONT, Y_FRONT, WIN_Z), (W_WIN_FRONT - 0.08, 0.02, 1.15 - 0.08), mat_door_glass)
for b in range(3):
    bz = WIN_Z - 1.15/2 + (1.15/4) * (b + 1)
    create_box(f"RCS_Win_Front_HBar_{b}", (X_WIN_FRONT, Y_FRONT - 0.02, bz), (W_WIN_FRONT - 0.08, 0.015, 0.02), mat_window_grille)
for v in range(8):
    vx = X_WIN_FRONT - W_WIN_FRONT/2 + (W_WIN_FRONT/9) * (v + 1)
    create_box(f"RCS_Win_Front_VBar_{v}", (vx, Y_FRONT - 0.02, WIN_Z), (0.02, 0.015, 1.15 - 0.08), mat_window_grille)

# 2. East Flank Windows (facing trees / Flatbed Dryer per Left part is the Flatbed.HEIC):
create_storage_window("RCS_Win_East_1", (X_MIN, -2.60, WIN_Z), is_ns=True)
create_storage_window("RCS_Win_East_2", (X_MIN,  2.60, WIN_Z), is_ns=True)

# 3. West Flank Window (facing Seed Storage alley per Left is Chemical Storage.HEIC):
create_storage_window("RCS_Win_West_1", (X_MAX, -2.60, WIN_Z), is_ns=True)

# ==============================================================================
# F. MESH OPTIMIZATION & EXPORT GLB MODEL
# ==============================================================================
# Join objects by material to minimize nodes and drastically reduce GLB size (< 300 KB budget)
bpy.ops.object.select_all(action='DESELECT')
for mat in bpy.data.materials:
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.data.materials and o.data.materials[0] == mat]
    if len(objs) > 1:
        for o in bpy.context.scene.objects:
            o.select_set(False)
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()

out_dir = r"c:\Users\LGU-SanPedro\Downloads\map\models"
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "rares_chemical_storage.glb")

bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_yup=True
)

size_bytes = os.path.getsize(out_path)
size_kb = size_bytes / 1024.0
print(f"\nExported: {out_path} ({size_bytes} bytes, {size_kb:.2f} KB)")
print("DA-RARES Chemical Storage generation complete!")
