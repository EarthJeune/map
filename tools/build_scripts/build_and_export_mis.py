import socket
import json
import os

blender_code = '''
import bpy
import bmesh
import math
import mathutils
from mathutils import Vector

# 1. Clear existing scene meshes
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type in ['MESH', 'CURVE']:
        obj.select_set(True)
bpy.ops.object.delete()

# Materials function
def create_mat(name, hex_color, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
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

# Palettes accurate to IMG_3783 - IMG_3786
mat_wall = create_mat("MIS_Wall_Green", "#4FA058", roughness=0.7)
mat_plinth = create_mat("MIS_Plinth_Concrete", "#7E8880", roughness=0.85)
mat_fascia = create_mat("MIS_Fascia_Brown", "#663328", roughness=0.5)
mat_roof = create_mat("MIS_Roof_GreenMetal", "#3C5A44", roughness=0.45, metallic=0.15)
mat_door = create_mat("MIS_Door_Dark", "#1E2421", roughness=0.35)
mat_door_handle = create_mat("MIS_Door_Handle", "#D1D5DB", roughness=0.2, metallic=0.8)
mat_frame = create_mat("MIS_Frame_White", "#F8FAF8", roughness=0.25)
mat_glass = create_mat("MIS_Glass_Tint", "#162329", roughness=0.1, metallic=0.6)
mat_ac_white = create_mat("MIS_AC_White", "#E6EAE5", roughness=0.3)
mat_ac_dark = create_mat("MIS_AC_Dark", "#333A36", roughness=0.5)
mat_bracket = create_mat("MIS_Bracket_Metal", "#4B5550", roughness=0.6, metallic=0.4)
mat_step = create_mat("MIS_Walkway_Concrete", "#9CA39B", roughness=0.9)

# Dimensions from GIS polygon
WIDTH = 6.52
LENGTH = 14.80
PLINTH_H = 0.25
WALL_H = 3.25
ROOF_APEX_H = 5.10
OVERHANG = 0.45

# Root empty object
root = bpy.data.objects.new("MIS_RAFIS_Building", None)
bpy.context.collection.objects.link(root)

# 1. Foundation Plinth
bpy.ops.mesh.primitive_cube_add(
    size=1.0,
    location=(0, 0, PLINTH_H / 2.0),
    scale=(WIDTH + 0.12, LENGTH + 0.12, PLINTH_H)
)
plinth = bpy.context.active_object
plinth.name = "MIS_Foundation_Plinth"
plinth.data.materials.append(mat_plinth)
plinth.parent = root

# 2. Main Wall Body
bpy.ops.mesh.primitive_cube_add(
    size=1.0,
    location=(0, 0, PLINTH_H + (WALL_H - PLINTH_H) / 2.0),
    scale=(WIDTH, LENGTH, WALL_H - PLINTH_H)
)
walls = bpy.context.active_object
walls.name = "MIS_Main_Walls"
walls.data.materials.append(mat_wall)
walls.parent = root

# 3. Entrance Walkway / Steps in front
bpy.ops.mesh.primitive_cube_add(
    size=1.0,
    location=(0, -LENGTH / 2.0 - 0.70, 0.10),
    scale=(1.40, 1.40, 0.18)
)
step = bpy.context.active_object
step.name = "MIS_Entrance_Step"
step.data.materials.append(mat_step)
step.parent = root

# 4. Hipped Roof Structure
ro_w = WIDTH + OVERHANG * 2.0
ro_l = LENGTH + OVERHANG * 2.0
eaves_z = WALL_H
apex_z = ROOF_APEX_H
fascia_thickness = 0.18

ridge_half = (ro_l - ro_w) / 2.0

roof_mesh = bpy.data.meshes.new("MIS_Roof_Mesh")
bm = bmesh.new()

v_c0 = bm.verts.new((-ro_w/2, -ro_l/2, eaves_z))
v_c1 = bm.verts.new(( ro_w/2, -ro_l/2, eaves_z))
v_c2 = bm.verts.new(( ro_w/2,  ro_l/2, eaves_z))
v_c3 = bm.verts.new((-ro_w/2,  ro_l/2, eaves_z))

v_r0 = bm.verts.new((0, -ridge_half, apex_z))
v_r1 = bm.verts.new((0,  ridge_half, apex_z))

bm.faces.new((v_c0, v_c1, v_r0))        # Front triangular hip
bm.faces.new((v_c2, v_c3, v_r1))        # Back triangular hip
bm.faces.new((v_c3, v_c0, v_r0, v_r1))  # Left trapezoid
bm.faces.new((v_c1, v_c2, v_r1, v_r0))  # Right trapezoid
bm.faces.new((v_c3, v_c2, v_c1, v_c0))  # Ceiling

bm.normal_update()
bm.to_mesh(roof_mesh)
bm.free()

roof_obj = bpy.data.objects.new("MIS_Roof", roof_mesh)
bpy.context.collection.objects.link(roof_obj)
roof_obj.data.materials.append(mat_roof)
roof_obj.parent = root

# Fascia Trim around eaves
bpy.ops.mesh.primitive_cube_add(
    size=1.0,
    location=(0, 0, eaves_z - fascia_thickness / 2.0),
    scale=(ro_w, ro_l, fascia_thickness)
)
fascia = bpy.context.active_object
fascia.name = "MIS_Roof_Fascia"
fascia.data.materials.append(mat_fascia)
fascia.parent = root

# Ridge Cap
bpy.ops.mesh.primitive_cylinder_add(
    radius=0.10,
    depth=ridge_half * 2.0 + 0.25,
    location=(0, 0, apex_z + 0.04),
    rotation=(math.radians(90), 0, 0)
)
ridge_cap = bpy.context.active_object
ridge_cap.name = "MIS_Ridge_Cap"
ridge_cap.data.materials.append(mat_fascia)
ridge_cap.parent = root

# 5. Windows with high-contrast tinted glass and white grille bars
def build_window(name, pos, is_facing_y=True):
    win_w = 1.35
    win_h = 1.30
    d = 0.04
    
    # Dark tinted glass pane (sits slightly forward on wall face)
    glass_scale = (win_w, d, win_h) if is_facing_y else (d, win_w, win_h)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos, scale=glass_scale)
    g_obj = bpy.context.active_object
    g_obj.name = f"{name}_Glass"
    g_obj.data.materials.append(mat_glass)
    g_obj.parent = root
    
    # White perimeter frame borders
    border_t = 0.05
    offset = 0.02
    
    if is_facing_y:
        # Top & Bottom frame border
        for bz in [-win_h/2.0 + border_t/2.0, win_h/2.0 - border_t/2.0]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pos[0], pos[1] - offset, pos[2] + bz), scale=(win_w + 0.04, d + 0.02, border_t))
            b = bpy.context.active_object
            b.name = f"{name}_Frame_H"
            b.data.materials.append(mat_frame)
            b.parent = root
        # Left & Right frame border
        for bx in [-win_w/2.0 + border_t/2.0, win_w/2.0 - border_t/2.0]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pos[0] + bx, pos[1] - offset, pos[2]), scale=(border_t, d + 0.02, win_h))
            b = bpy.context.active_object
            b.name = f"{name}_Frame_V"
            b.data.materials.append(mat_frame)
            b.parent = root
        # White security grille bars (2 vertical, 2 horizontal)
        for vx in [-win_w*0.22, win_w*0.22]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pos[0] + vx, pos[1] - offset - 0.01, pos[2]), scale=(0.028, 0.02, win_h - 0.1))
            bar = bpy.context.active_object
            bar.name = f"{name}_Bar_V"
            bar.data.materials.append(mat_frame)
            bar.parent = root
        for vz in [-win_h*0.22, win_h*0.22]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pos[0], pos[1] - offset - 0.01, pos[2] + vz), scale=(win_w - 0.1, 0.02, 0.028))
            bar = bpy.context.active_object
            bar.name = f"{name}_Bar_H"
            bar.data.materials.append(mat_frame)
            bar.parent = root
    else:
        # Facing X (left/right walls)
        sign = -1 if pos[0] < 0 else 1
        # Top & Bottom border
        for bz in [-win_h/2.0 + border_t/2.0, win_h/2.0 - border_t/2.0]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pos[0] + sign * offset, pos[1], pos[2] + bz), scale=(d + 0.02, win_w + 0.04, border_t))
            b = bpy.context.active_object
            b.name = f"{name}_Frame_H"
            b.data.materials.append(mat_frame)
            b.parent = root
        # Left & Right border
        for by in [-win_w/2.0 + border_t/2.0, win_w/2.0 - border_t/2.0]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pos[0] + sign * offset, pos[1] + by, pos[2]), scale=(d + 0.02, border_t, win_h))
            b = bpy.context.active_object
            b.name = f"{name}_Frame_V"
            b.data.materials.append(mat_frame)
            b.parent = root
        # Security bars
        for vy in [-win_w*0.22, win_w*0.22]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pos[0] + sign * (offset + 0.01), pos[1] + vy, pos[2]), scale=(0.02, 0.028, win_h - 0.1))
            bar = bpy.context.active_object
            bar.name = f"{name}_Bar_V"
            bar.data.materials.append(mat_frame)
            bar.parent = root
        for vz in [-win_h*0.22, win_h*0.22]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pos[0] + sign * (offset + 0.01), pos[1], pos[2] + vz), scale=(0.02, win_w - 0.1, 0.028))
            bar = bpy.context.active_object
            bar.name = f"{name}_Bar_H"
            bar.data.materials.append(mat_frame)
            bar.parent = root

# 6. Front Entrance Door (Centered at Y = -LENGTH / 2)
front_y = -LENGTH / 2.0 - 0.03
win_z = PLINTH_H + 1.45
door_w = 1.05
door_h = 2.15
door_z = PLINTH_H + door_h / 2.0

# Door outer white casing
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, front_y, door_z), scale=(door_w + 0.14, 0.06, door_h + 0.08))
d_casing = bpy.context.active_object
d_casing.name = "MIS_Door_Casing"
d_casing.data.materials.append(mat_frame)
d_casing.parent = root

# Door dark leaf
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, front_y - 0.02, door_z), scale=(door_w, 0.05, door_h))
d_leaf = bpy.context.active_object
d_leaf.name = "MIS_Door_Leaf"
d_leaf.data.materials.append(mat_door)
d_leaf.parent = root

# Door upper glass panel
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, front_y - 0.03, door_z + 0.40), scale=(door_w - 0.35, 0.04, 0.65))
d_glass = bpy.context.active_object
d_glass.name = "MIS_Door_Glass"
d_glass.data.materials.append(mat_glass)
d_glass.parent = root

# Door handle (metallic)
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.35, front_y - 0.04, door_z - 0.10), scale=(0.04, 0.06, 0.16))
d_handle = bpy.context.active_object
d_handle.name = "MIS_Door_Handle"
d_handle.data.materials.append(mat_door_handle)
d_handle.parent = root

# Front symmetrical windows
build_window("MIS_Front_Win_Left", (-1.95, front_y, win_z), is_facing_y=True)
build_window("MIS_Front_Win_Right", (1.95, front_y, win_z), is_facing_y=True)

# 7. Left Side Facade (X = -WIDTH / 2)
left_x = -WIDTH / 2.0 - 0.03
build_window("MIS_Left_Win_1", (left_x, -5.20, win_z), is_facing_y=False)
build_window("MIS_Left_Win_2", (left_x, -1.20, win_z), is_facing_y=False)
build_window("MIS_Left_Win_3", (left_x, 2.80, win_z), is_facing_y=False)

# Outdoor Aircon Condenser Unit between Win 1 & Win 2
ac_center = (left_x - 0.22, -3.35, PLINTH_H + 1.25)
bpy.ops.mesh.primitive_cube_add(size=1.0, location=ac_center, scale=(0.35, 0.85, 0.60))
ac_box = bpy.context.active_object
ac_box.name = "MIS_AC_Body"
ac_box.data.materials.append(mat_ac_white)
ac_box.parent = root

# AC Fan Grill (dark circular inset)
bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=0.04, location=(ac_center[0] - 0.17, ac_center[1] - 0.10, ac_center[2]), rotation=(0, math.radians(90), 0))
ac_fan = bpy.context.active_object
ac_fan.name = "MIS_AC_Fan"
ac_fan.data.materials.append(mat_ac_dark)
ac_fan.parent = root

# AC Steel Wall Brackets
for by in [-0.28, 0.28]:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(left_x - 0.15, ac_center[1] + by, PLINTH_H + 0.88), scale=(0.32, 0.05, 0.16))
    ac_brk = bpy.context.active_object
    ac_brk.name = f"MIS_AC_Brk"
    ac_brk.data.materials.append(mat_bracket)
    ac_brk.parent = root

# 8. Right Side Windows (X = +WIDTH / 2)
right_x = WIDTH / 2.0 + 0.03
build_window("MIS_Right_Win_1", (right_x, -5.20, win_z), is_facing_y=False)
build_window("MIS_Right_Win_2", (right_x, -1.20, win_z), is_facing_y=False)
build_window("MIS_Right_Win_3", (right_x, 2.80, win_z), is_facing_y=False)
build_window("MIS_Right_Win_4", (right_x, 5.80, win_z), is_facing_y=False)

# 9. Back Facade Door and Window
back_y = LENGTH / 2.0 + 0.03
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, back_y, door_z), scale=(door_w, 0.05, door_h))
b_door = bpy.context.active_object
b_door.name = "MIS_Back_Door"
b_door.data.materials.append(mat_door)
b_door.parent = root
build_window("MIS_Back_Win", (1.80, back_y, win_z), is_facing_y=True)

# Select all MIS objects for export
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.name.startswith("MIS_"):
        obj.select_set(True)

# Export to GLB format
export_path = r"c:\\Users\\LGU-SanPedro\\Downloads\\map\\models\\mis_rafis_building.glb"
bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True
)

print(f"Exported successfully to {export_path}")
'''

s = socket.socket()
s.settimeout(20.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({"type": "execute_code", "params": {"code": blender_code}}).encode('utf-8') + b'\n')

data = b""
while True:
    try:
        chunk = s.recv(4096)
        if not chunk:
            break
        data += chunk
        if b'\n' in data:
            break
    except Exception as e:
        print("Done/timeout:", e)
        break

print(data.decode('utf-8', errors='ignore'))
s.close()
