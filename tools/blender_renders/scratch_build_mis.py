import socket
import json
import sys

blender_code = '''
import bpy
import bmesh
import math
from mathutils import Vector

# Clear existing mesh objects
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type in ['MESH', 'CURVE']:
        obj.select_set(True)
bpy.ops.object.delete()

# Ensure collections
scene = bpy.context.scene

def create_mat(name, hex_color, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        # Convert hex to linear RGB
        h = hex_color.lstrip('#')
        rgb = tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4))
        # gamma to linear approx
        rgb_lin = [c ** 2.2 for c in rgb] + [1.0]
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = rgb_lin
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
    return mat

# Palette based on reference photos IMG_3783 to IMG_3786
mat_wall = create_mat("MIS_Wall_Green", "#52A35A", roughness=0.65)
mat_plinth = create_mat("MIS_Plinth_Concrete", "#7B857E", roughness=0.85)
mat_fascia = create_mat("MIS_Fascia_Brown", "#68352A", roughness=0.55)
mat_roof = create_mat("MIS_Roof_GreenMetal", "#3D5A46", roughness=0.45, metallic=0.15)
mat_door = create_mat("MIS_Door_Dark", "#1C2420", roughness=0.35)
mat_frame = create_mat("MIS_Frame_White", "#FFFFFF", roughness=0.25)
mat_glass = create_mat("MIS_Glass", "#18262C", roughness=0.1, metallic=0.85)
mat_metal_ac = create_mat("MIS_AC_Metal", "#E2E7E2", roughness=0.35, metallic=0.1)
mat_step = create_mat("MIS_Walkway_Concrete", "#9CA39B", roughness=0.9)

# Building dimensions (derived from GIS polygon: 6.5m width x 14.8m length)
WIDTH = 6.52
LENGTH = 14.80
PLINTH_H = 0.25
WALL_H = 3.20  # total wall height from ground
ROOF_APEX_H = 5.05 # apex height from ground
OVERHANG = 0.45 # roof overhang

# 1. Concrete Plinth / Foundation
bpy.ops.mesh.primitive_cube_add(
    size=1.0,
    location=(0, 0, PLINTH_H / 2.0),
    scale=(WIDTH + 0.1, LENGTH + 0.1, PLINTH_H)
)
plinth = bpy.context.active_object
plinth.name = "MIS_Foundation_Plinth"
plinth.data.materials.append(mat_plinth)

# 2. Main Wall Body
bpy.ops.mesh.primitive_cube_add(
    size=1.0,
    location=(0, 0, PLINTH_H + (WALL_H - PLINTH_H) / 2.0),
    scale=(WIDTH, LENGTH, WALL_H - PLINTH_H)
)
walls = bpy.context.active_object
walls.name = "MIS_Main_Walls"
walls.data.materials.append(mat_wall)

# 3. Entrance Walkway / Steps in front
# Front facade is at Y = -LENGTH / 2 = -7.40
bpy.ops.mesh.primitive_cube_add(
    size=1.0,
    location=(0, -LENGTH / 2.0 - 0.75, 0.10),
    scale=(1.40, 1.50, 0.18)
)
step = bpy.context.active_object
step.name = "MIS_Entrance_Step"
step.data.materials.append(mat_step)

# 4. Hipped Roof Structure
# Overhanging eaves baseline:
ro_w = WIDTH + OVERHANG * 2.0
ro_l = LENGTH + OVERHANG * 2.0
eaves_z = WALL_H
apex_z = ROOF_APEX_H
fascia_thickness = 0.18

# Hipped roof geometry:
# 4 corner eaves points:
# C0: (-ro_w/2, -ro_l/2, eaves_z)
# C1: ( ro_w/2, -ro_l/2, eaves_z)
# C2: ( ro_w/2,  ro_l/2, eaves_z)
# C3: (-ro_w/2,  ro_l/2, eaves_z)
# Ridge line along Y:
# Ridge length = ro_l - ro_w (classic 45 deg hip ends)
ridge_half = (ro_l - ro_w) / 2.0
# R0: (0, -ridge_half, apex_z)
# R1: (0,  ridge_half, apex_z)

roof_mesh = bpy.data.meshes.new("MIS_Roof_Mesh")
bm = bmesh.new()

# Vertices
v_c0 = bm.verts.new((-ro_w/2, -ro_l/2, eaves_z))
v_c1 = bm.verts.new(( ro_w/2, -ro_l/2, eaves_z))
v_c2 = bm.verts.new(( ro_w/2,  ro_l/2, eaves_z))
v_c3 = bm.verts.new((-ro_w/2,  ro_l/2, eaves_z))

v_r0 = bm.verts.new((0, -ridge_half, apex_z))
v_r1 = bm.verts.new((0,  ridge_half, apex_z))

# 4 Hipped roof faces
f_front = bm.faces.new((v_c0, v_c1, v_r0))        # Front triangular hip
f_back  = bm.faces.new((v_c2, v_c3, v_r1))        # Back triangular hip
f_left  = bm.faces.new((v_c3, v_c0, v_r0, v_r1))  # Left trapezoid slope
f_right = bm.faces.new((v_c1, v_c2, v_r1, v_r0))  # Right trapezoid slope

# Bottom ceiling face for solid interior
f_bottom = bm.faces.new((v_c3, v_c2, v_c1, v_c0))

bm.normal_update()
bm.to_mesh(roof_mesh)
bm.free()

roof_obj = bpy.data.objects.new("MIS_Roof", roof_mesh)
bpy.context.collection.objects.link(roof_obj)
roof_obj.data.materials.append(mat_roof)

# 5. Fascia Trim around eaves
# Fascia board hanging down from eaves
bpy.ops.mesh.primitive_cube_add(
    size=1.0,
    location=(0, 0, eaves_z - fascia_thickness / 2.0),
    scale=(ro_w, ro_l, fascia_thickness)
)
fascia = bpy.context.active_object
fascia.name = "MIS_Roof_Fascia"
fascia.data.materials.append(mat_fascia)

# 6. Ridge Cap for roof definition
bpy.ops.mesh.primitive_cylinder_add(
    radius=0.10,
    depth=ridge_half * 2.0 + 0.2,
    location=(0, 0, apex_z + 0.04),
    rotation=(math.radians(90), 0, 0)
)
ridge_cap = bpy.context.active_object
ridge_cap.name = "MIS_Ridge_Cap"
ridge_cap.data.materials.append(mat_fascia)

# Helper function to create windows with white frames, glass, and security grille bars
def create_window(name, pos, rot_y=0, is_facing_y=True):
    win_w = 1.35
    win_h = 1.30
    frame_d = 0.08
    
    # Outer frame
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos, scale=(win_w, frame_d, win_h) if is_facing_y else (frame_d, win_w, win_h))
    frame = bpy.context.active_object
    frame.name = f"{name}_Frame"
    frame.data.materials.append(mat_frame)
    
    # Glass pane
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos, scale=(win_w - 0.12, frame_d * 0.4, win_h - 0.12) if is_facing_y else (frame_d * 0.4, win_w - 0.12, win_h - 0.12))
    glass = bpy.context.active_object
    glass.name = f"{name}_Glass"
    glass.data.materials.append(mat_glass)
    
    # Grille bars (White security bars - characteristic of Philippine govt offices)
    # 2 vertical bars and 2 horizontal bars
    if is_facing_y:
        # vertical bars
        for vx in [-win_w*0.25, win_w*0.25]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pos[0] + vx, pos[1] - 0.02, pos[2]), scale=(0.025, 0.025, win_h - 0.12))
            bar = bpy.context.active_object
            bar.name = f"{name}_VBar"
            bar.data.materials.append(mat_frame)
        # horizontal bars
        for vz in [-win_h*0.25, win_h*0.25]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pos[0], pos[1] - 0.02, pos[2] + vz), scale=(win_w - 0.12, 0.025, 0.025))
            bar = bpy.context.active_object
            bar.name = f"{name}_HBar"
            bar.data.materials.append(mat_frame)
    else:
        # Facing X (sides)
        for vy in [-win_w*0.25, win_w*0.25]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pos[0] - 0.02 if pos[0] < 0 else pos[0] + 0.02, pos[1] + vy, pos[2]), scale=(0.025, 0.025, win_h - 0.12))
            bar = bpy.context.active_object
            bar.name = f"{name}_VBar"
            bar.data.materials.append(mat_frame)
        for vz in [-win_h*0.25, win_h*0.25]:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(pos[0] - 0.02 if pos[0] < 0 else pos[0] + 0.02, pos[1], pos[2] + vz), scale=(0.025, win_w - 0.12, 0.025))
            bar = bpy.context.active_object
            bar.name = f"{name}_HBar"
            bar.data.materials.append(mat_frame)

# 7. Front Facade Elements (Y = -LENGTH / 2 = -7.40)
front_y = -LENGTH / 2.0 - 0.02
win_z = PLINTH_H + 1.45

# Front Door (Centered)
door_w = 1.05
door_h = 2.15
door_z = PLINTH_H + door_h / 2.0
# Door Frame
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, front_y, door_z), scale=(door_w + 0.1, 0.08, door_h + 0.06))
door_frame = bpy.context.active_object
door_frame.name = "MIS_Door_Frame"
door_frame.data.materials.append(mat_frame)

# Door Leaf
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, front_y - 0.02, door_z), scale=(door_w, 0.06, door_h))
door_leaf = bpy.context.active_object
door_leaf.name = "MIS_Door_Leaf"
door_leaf.data.materials.append(mat_door)

# Symmetrical Windows flanking front door (as seen in IMG_3783)
create_window("MIS_Front_Win_Left", (-1.95, front_y, win_z), is_facing_y=True)
create_window("MIS_Front_Win_Right", (1.95, front_y, win_z), is_facing_y=True)

# 8. Left Side Facade Elements (X = -WIDTH / 2 = -3.26) (as seen in IMG_3785 & IMG_3786)
left_x = -WIDTH / 2.0 - 0.02
create_window("MIS_Left_Win_1", (left_x, -5.20, win_z), is_facing_y=False)
create_window("MIS_Left_Win_2", (left_x, -1.20, win_z), is_facing_y=False)
create_window("MIS_Left_Win_3", (left_x, 2.80, win_z), is_facing_y=False)

# AC Outdoor Unit (Condenser) between Win 1 & Win 2
ac_pos = (left_x - 0.22, -3.35, PLINTH_H + 1.25)
bpy.ops.mesh.primitive_cube_add(size=1.0, location=ac_pos, scale=(0.35, 0.85, 0.60))
ac_box = bpy.context.active_object
ac_box.name = "MIS_AC_Unit"
ac_box.data.materials.append(mat_metal_ac)

# AC Wall Bracket
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(left_x - 0.12, -3.35, PLINTH_H + 0.90), scale=(0.28, 0.70, 0.05))
ac_bracket = bpy.context.active_object
ac_bracket.name = "MIS_AC_Bracket"
ac_bracket.data.materials.append(mat_plinth)

# 9. Right Side Facade Windows (X = +WIDTH / 2 = +3.26)
right_x = WIDTH / 2.0 + 0.02
create_window("MIS_Right_Win_1", (right_x, -5.20, win_z), is_facing_y=False)
create_window("MIS_Right_Win_2", (right_x, -1.20, win_z), is_facing_y=False)
create_window("MIS_Right_Win_3", (right_x, 2.80, win_z), is_facing_y=False)
create_window("MIS_Right_Win_4", (right_x, 5.80, win_z), is_facing_y=False)

# 10. Back Facade Door and Window (Y = +LENGTH / 2 = +7.40)
back_y = LENGTH / 2.0 + 0.02
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, back_y, door_z), scale=(door_w, 0.06, door_h))
back_door = bpy.context.active_object
back_door.name = "MIS_Back_Door"
back_door.data.materials.append(mat_door)
create_window("MIS_Back_Win_Right", (1.80, back_y, win_z), is_facing_y=True)

# 11. Adjust Camera and Sun for stunning preview
cam = bpy.data.objects.get("Camera")
if not cam:
    bpy.ops.object.camera_add(location=(-14.0, -18.0, 9.5))
    cam = bpy.context.active_object
else:
    cam.location = (-14.0, -18.0, 9.5)

# Camera rotation targeting building center ~ (0, -2, 2.5)
import mathutils
direction = Vector((0.0, -2.0, 2.2)) - cam.location
rot_quat = direction.to_track_quat('-Z', 'Y')
cam.rotation_euler = rot_quat.to_euler()

# Set camera lens
cam.data.lens = 45

# Sunlight
sun = bpy.data.objects.get("Light")
if not sun:
    bpy.ops.object.light_add(type='SUN', location=(-8.0, -12.0, 15.0))
    sun = bpy.context.active_object
else:
    sun.type = 'SUN'
    sun.location = (-8.0, -12.0, 15.0)
    sun.rotation_euler = (math.radians(45), math.radians(20), math.radians(-35))
    sun.data.energy = 3.5

# Select all MIS objects
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.name.startswith("MIS_"):
        obj.select_set(True)

print("MIS-RAFIS Building generated successfully!")
'''

# Connect to Blender MCP
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(15.0)
s.connect(('127.0.0.1', 9876))

req = {'type': 'execute_code', 'params': {'code': blender_code}}
s.sendall((json.dumps(req) + '\n').encode('utf-8'))

# Receive response
buffer = ""
while True:
    chunk = s.recv(4096).decode('utf-8')
    if not chunk:
        break
    buffer += chunk
    if '\n' in buffer:
        break

s.close()
res = json.loads(buffer.strip())
print("Result:", res)
