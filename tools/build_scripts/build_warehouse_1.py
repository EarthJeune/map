import socket
import json
import os

blender_code = r'''
import bpy
import bmesh
import math
from mathutils import Vector

# 1. Clear existing scene meshes
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in bpy.data.meshes:
    bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    bpy.data.materials.remove(block)

# 2. Material Helper
def create_mat(name, hex_color, roughness=0.6, metallic=0.0):
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

# Materials calibrated to ground-truth field photograph '1 Front View.jpg' & aerial drone photo
mat_wall_cream     = create_mat("WH1_WallCream",     "#EDE6D4", roughness=0.75)
mat_plinth_grey    = create_mat("WH1_PlinthGrey",    "#636561", roughness=0.88)
mat_roof_metal     = create_mat("WH1_RoofMetal",     "#7A7872", roughness=0.55, metallic=0.4)
mat_roof_rust      = create_mat("WH1_RoofRust",      "#6E4735", roughness=0.70, metallic=0.2)
mat_ridge_green    = create_mat("WH1_RidgeGreen",    "#2E5638", roughness=0.45, metallic=0.25)
mat_fascia_brown   = create_mat("WH1_FasciaBrown",   "#4C3727", roughness=0.65)
mat_door_cream     = create_mat("WH1_DoorCream",     "#DDD6C1", roughness=0.45)
mat_door_frame     = create_mat("WH1_DoorFrame",     "#2B2C2B", roughness=0.35, metallic=0.6)
mat_door_handle    = create_mat("WH1_DoorHandle",    "#D0D2D0", roughness=0.20, metallic=0.9)
mat_sign_base      = create_mat("WH1_SignBase",      "#FAFAFA", roughness=0.30)
mat_sign_border    = create_mat("WH1_SignBorder",    "#1B5E20", roughness=0.40)
mat_sign_red       = create_mat("WH1_SignRed",       "#D32F2F", roughness=0.30)
mat_stoop_concrete = create_mat("WH1_StoopConcrete", "#828480", roughness=0.85)
mat_cable_black    = create_mat("WH1_CableBlack",    "#181A18", roughness=0.80)

# Primitive Helpers
def create_box(name, loc, size, mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
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

def create_prism_y(name, v1, v2, v3, thickness_y, y_center, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    y_half = thickness_y / 2.0
    y_min = y_center - y_half
    y_max = y_center + y_half
    
    verts = [
        (v1[0], y_min, v1[1]),
        (v2[0], y_min, v2[1]),
        (v3[0], y_min, v3[1]),
        (v1[0], y_max, v1[1]),
        (v2[0], y_max, v2[1]),
        (v3[0], y_max, v3[1]),
    ]
    faces = [
        (0, 2, 1),
        (3, 4, 5),
        (0, 1, 4, 3),
        (1, 2, 5, 4),
        (2, 0, 3, 5),
    ]
    mesh.from_pydata(verts, [], faces)
    
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mesh.update()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

# Dimensions calibrated to GIS polygon:
# Width (gable width along X): 6.90 m
# Depth (length along ridge Y): 9.91 m
W = 6.90
D = 9.91

X_LEFT = -W / 2.0   # -3.45 m (South side)
X_RIGHT = W / 2.0   # +3.45 m (North side)
Y_FRONT = -D / 2.0  # -4.955 m (East front facade facing internal road)
Y_REAR = D / 2.0    # +4.955 m (West rear facade)

H_PLINTH = 0.25
H_EAVE = 3.10
H_RIDGE = 4.30

# Root empty object
root = bpy.data.objects.new("WH1_Root", None)
bpy.context.collection.objects.link(root)

# 1. Foundation Plinth Skirt
PLINTH_EXP = 0.05
create_box("WH1_Plinth",
           (0.0, 0.0, H_PLINTH / 2.0),
           (W + PLINTH_EXP * 2, D + PLINTH_EXP * 2, H_PLINTH),
           mat=mat_plinth_grey, parent=root)

# 2. Main Walls up to Eave level
wall_h = H_EAVE - H_PLINTH
create_box("WH1_MainWalls",
           (0.0, 0.0, H_PLINTH + wall_h / 2.0),
           (W, D, wall_h),
           mat=mat_wall_cream, parent=root)

# 3. Solid Attached Triangular Gable Walls (Watertight, 0 gaps)
GABLE_THICK = 0.20
# Front Gable Wall (East)
create_prism_y("WH1_GableFront",
               v1=(X_LEFT, H_EAVE),
               v2=(0.0, H_RIDGE),
               v3=(X_RIGHT, H_EAVE),
               thickness_y=GABLE_THICK,
               y_center=Y_FRONT + GABLE_THICK / 2.0,
               mat=mat_wall_cream, parent=root)

# Rear Gable Wall (West)
create_prism_y("WH1_GableRear",
               v1=(X_LEFT, H_EAVE),
               v2=(0.0, H_RIDGE),
               v3=(X_RIGHT, H_EAVE),
               thickness_y=GABLE_THICK,
               y_center=Y_REAR - GABLE_THICK / 2.0,
               mat=mat_wall_cream, parent=root)

# 4. Watertight Gable Roof with authentic overhangs
OVERHANG_EAVE = 0.40  # Beyond left/right walls
OVERHANG_RAKE = 0.35  # Beyond front/rear gable walls
ROOF_THICK = 0.08

X_ROOF_LEFT = X_LEFT - OVERHANG_EAVE   # -3.85 m
X_ROOF_RIGHT = X_RIGHT + OVERHANG_EAVE # +3.85 m
Y_ROOF_FRONT = Y_FRONT - OVERHANG_RAKE # -5.305 m
Y_ROOF_REAR = Y_REAR + OVERHANG_RAKE   # +5.305 m
ROOF_LEN = Y_ROOF_REAR - Y_ROOF_FRONT

dx_pitch = abs(X_ROOF_LEFT)
dz_pitch = H_RIDGE - H_EAVE
slope_len = math.sqrt(dx_pitch**2 + dz_pitch**2)
pitch_angle = math.atan2(dz_pitch, dx_pitch)

# Left roof slope slab (South pitch)
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
roof_left = bpy.context.active_object
roof_left.name = "WH1_RoofLeft"
roof_left.scale = (slope_len / 2.0, ROOF_LEN / 2.0, ROOF_THICK / 2.0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
roof_left.rotation_euler = (0, -pitch_angle, 0)
roof_left.location = (X_ROOF_LEFT / 2.0, 0.0, (H_EAVE + H_RIDGE) / 2.0 + ROOF_THICK / 2.0)
roof_left.data.materials.clear()
roof_left.data.materials.append(mat_roof_metal)
roof_left.parent = root

# Right roof slope slab (North pitch)
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
roof_right = bpy.context.active_object
roof_right.name = "WH1_RoofRight"
roof_right.scale = (slope_len / 2.0, ROOF_LEN / 2.0, ROOF_THICK / 2.0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
roof_right.rotation_euler = (0, pitch_angle, 0)
roof_right.location = (X_ROOF_RIGHT / 2.0, 0.0, (H_EAVE + H_RIDGE) / 2.0 + ROOF_THICK / 2.0)
roof_right.data.materials.clear()
roof_right.data.materials.append(mat_roof_metal)
roof_right.parent = root

# Green Painted Ridge Cap along apex (prominent in aerial drone photos)
create_box("WH1_RidgeCap",
           (0.0, 0.0, H_RIDGE + ROOF_THICK + 0.035),
           (0.32, ROOF_LEN + 0.02, 0.06),
           mat=mat_ridge_green, parent=root)

# Timber Fascia Boards on Front Gable (Inverted V rake)
FASCIA_THICK = 0.04
FASCIA_DEPTH = 0.16

bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
fascia_fl = bpy.context.active_object
fascia_fl.name = "WH1_FasciaFrontLeft"
fascia_fl.scale = (slope_len / 2.0, FASCIA_THICK / 2.0, FASCIA_DEPTH / 2.0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
fascia_fl.rotation_euler = (0, -pitch_angle, 0)
fascia_fl.location = (X_ROOF_LEFT / 2.0, Y_ROOF_FRONT + FASCIA_THICK / 2.0, (H_EAVE + H_RIDGE) / 2.0)
fascia_fl.data.materials.clear()
fascia_fl.data.materials.append(mat_fascia_brown)
fascia_fl.parent = root

bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
fascia_fr = bpy.context.active_object
fascia_fr.name = "WH1_FasciaFrontRight"
fascia_fr.scale = (slope_len / 2.0, FASCIA_THICK / 2.0, FASCIA_DEPTH / 2.0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
fascia_fr.rotation_euler = (0, pitch_angle, 0)
fascia_fr.location = (X_ROOF_RIGHT / 2.0, Y_ROOF_FRONT + FASCIA_THICK / 2.0, (H_EAVE + H_RIDGE) / 2.0)
fascia_fr.data.materials.clear()
fascia_fr.data.materials.append(mat_fascia_brown)
fascia_fr.parent = root

# Rear Fascia Rakes
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
fascia_rl = bpy.context.active_object
fascia_rl.name = "WH1_FasciaRearLeft"
fascia_rl.scale = (slope_len / 2.0, FASCIA_THICK / 2.0, FASCIA_DEPTH / 2.0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
fascia_rl.rotation_euler = (0, -pitch_angle, 0)
fascia_rl.location = (X_ROOF_LEFT / 2.0, Y_ROOF_REAR - FASCIA_THICK / 2.0, (H_EAVE + H_RIDGE) / 2.0)
fascia_rl.data.materials.clear()
fascia_rl.data.materials.append(mat_fascia_brown)
fascia_rl.parent = root

bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
fascia_rr = bpy.context.active_object
fascia_rr.name = "WH1_FasciaRearRight"
fascia_rr.scale = (slope_len / 2.0, FASCIA_THICK / 2.0, FASCIA_DEPTH / 2.0)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
fascia_rr.rotation_euler = (0, pitch_angle, 0)
fascia_rr.location = (X_ROOF_RIGHT / 2.0, Y_ROOF_REAR - FASCIA_THICK / 2.0, (H_EAVE + H_RIDGE) / 2.0)
fascia_rr.data.materials.clear()
fascia_rr.data.materials.append(mat_fascia_brown)
fascia_rr.parent = root

# Eave Fascias along Left & Right sides
create_box("WH1_FasciaEaveLeft",
           (X_ROOF_LEFT + FASCIA_THICK / 2.0, 0.0, H_EAVE),
           (FASCIA_THICK, ROOF_LEN, FASCIA_DEPTH),
           mat=mat_fascia_brown, parent=root)

create_box("WH1_FasciaEaveRight",
           (X_ROOF_RIGHT - FASCIA_THICK / 2.0, 0.0, H_EAVE),
           (FASCIA_THICK, ROOF_LEN, FASCIA_DEPTH),
           mat=mat_fascia_brown, parent=root)

# Alternating Weathered Metal & Rust Corrugation Strips (Matching Drone Aerials)
# Segmented panels across the Y length (9 bands matching drone photo)
num_bands = 9
sec_len = ROOF_LEN / num_bands
norm_offset = ROOF_THICK / 2.0 + 0.008
for s_idx in range(num_bands):
    y_pos = Y_ROOF_FRONT + (s_idx + 0.5) * sec_len
    # Alternate rust and galvanized silver-grey metal as seen in drone roof shot
    strip_mat = mat_roof_rust if (s_idx % 2 == 0) else mat_roof_metal
    
    # Left pitch overlay strip (offset along roof surface normal)
    nx_l = -math.sin(pitch_angle) * norm_offset
    nz_l =  math.cos(pitch_angle) * norm_offset
    create_box(f"WH1_RoofStripL_{s_idx}",
               (X_ROOF_LEFT / 2.0 + nx_l, y_pos, (H_EAVE + H_RIDGE) / 2.0 + ROOF_THICK / 2.0 + nz_l),
               (slope_len * 0.99, sec_len * 0.92, 0.012),
               mat=strip_mat, parent=root)
    bpy.context.active_object.rotation_euler = (0, -pitch_angle, 0)
    
    # Right pitch overlay strip (offset along roof surface normal)
    nx_r =  math.sin(pitch_angle) * norm_offset
    nz_r =  math.cos(pitch_angle) * norm_offset
    create_box(f"WH1_RoofStripR_{s_idx}",
               (X_ROOF_RIGHT / 2.0 + nx_r, y_pos, (H_EAVE + H_RIDGE) / 2.0 + ROOF_THICK / 2.0 + nz_r),
               (slope_len * 0.99, sec_len * 0.92, 0.012),
               mat=strip_mat, parent=root)
    bpy.context.active_object.rotation_euler = (0, pitch_angle, 0)

# 5. Front Entrance Door (Located on left side of East Gable Wall: X = -1.95 m)
DOOR_X = -1.95
DOOR_W = 1.05
DOOR_H = 2.10
DOOR_Z = H_PLINTH + DOOR_H / 2.0

# 3-Piece Door Frame (Dark charcoal frame)
FRAME_TH = 0.04
FRAME_DP = 0.04

# Left frame post
create_box("WH1_DoorFrame_L",
           (DOOR_X - DOOR_W / 2.0 - FRAME_TH / 2.0, Y_FRONT - FRAME_DP / 2.0, DOOR_Z),
           (FRAME_TH, FRAME_DP, DOOR_H),
           mat=mat_door_frame, parent=root)
# Right frame post
create_box("WH1_DoorFrame_R",
           (DOOR_X + DOOR_W / 2.0 + FRAME_TH / 2.0, Y_FRONT - FRAME_DP / 2.0, DOOR_Z),
           (FRAME_TH, FRAME_DP, DOOR_H),
           mat=mat_door_frame, parent=root)
# Top frame header
create_box("WH1_DoorFrame_T",
           (DOOR_X, Y_FRONT - FRAME_DP / 2.0, H_PLINTH + DOOR_H + FRAME_TH / 2.0),
           (DOOR_W + FRAME_TH * 2.0, FRAME_DP, FRAME_TH),
           mat=mat_door_frame, parent=root)

# Door leaf (Warm pale cream matching field photo)
create_box("WH1_DoorLeaf",
           (DOOR_X, Y_FRONT - 0.015, DOOR_Z),
           (DOOR_W, 0.025, DOOR_H),
           mat=mat_door_cream, parent=root)

# Door handle & lock hasp on right edge of leaf
create_box("WH1_DoorHandle",
           (DOOR_X + DOOR_W / 2.0 - 0.08, Y_FRONT - 0.035, H_PLINTH + 1.02),
           (0.04, 0.02, 0.12),
           mat=mat_door_handle, parent=root)

# 6. Official Signboard: "ABONO" (Mounted directly on upper door leaf per '1 Front View.jpg')
SIGN_W = 0.56
SIGN_H = 0.16
SIGN_Z = H_PLINTH + 1.52  # Upper middle of the door leaf

# Sign base plaque (white)
create_box("WH1_SignBase",
           (DOOR_X, Y_FRONT - 0.032, SIGN_Z),
           (SIGN_W, 0.014, SIGN_H),
           mat=mat_sign_base, parent=root)

# Sign border frame (green)
create_box("WH1_SignBorderTop",
           (DOOR_X, Y_FRONT - 0.040, SIGN_Z + SIGN_H / 2.0 - 0.008),
           (SIGN_W, 0.01, 0.016), mat=mat_sign_border, parent=root)
create_box("WH1_SignBorderBottom",
           (DOOR_X, Y_FRONT - 0.040, SIGN_Z - SIGN_H / 2.0 + 0.008),
           (SIGN_W, 0.01, 0.016), mat=mat_sign_border, parent=root)
create_box("WH1_SignBorderLeft",
           (DOOR_X - SIGN_W / 2.0 + 0.008, Y_FRONT - 0.040, SIGN_Z),
           (0.016, 0.01, SIGN_H), mat=mat_sign_border, parent=root)
create_box("WH1_SignBorderRight",
           (DOOR_X + SIGN_W / 2.0 - 0.008, Y_FRONT - 0.040, SIGN_Z),
           (0.016, 0.01, SIGN_H), mat=mat_sign_border, parent=root)

# 3D Lettering "ABONO" in bold red (Flawless standard English orientations)
def build_letter_a(cx, cy, cz, h=0.085, w=0.060, th=0.012):
    create_box("WH1_A_L", (cx - w/2.8, cy, cz), (th, th, h), mat=mat_sign_red, parent=root)
    create_box("WH1_A_R", (cx + w/2.8, cy, cz), (th, th, h), mat=mat_sign_red, parent=root)
    create_box("WH1_A_T", (cx, cy, cz + h/2.0 - th/2.0), (w*0.75, th, th), mat=mat_sign_red, parent=root)
    create_box("WH1_A_M", (cx, cy, cz), (w*0.75, th, th), mat=mat_sign_red, parent=root)

def build_letter_b(cx, cy, cz, h=0.085, w=0.060, th=0.012):
    create_box("WH1_B_S", (cx - w/2.8, cy, cz), (th, th, h), mat=mat_sign_red, parent=root)
    create_box("WH1_B_T", (cx, cy, cz + h/2.0 - th/2.0), (w*0.7, th, th), mat=mat_sign_red, parent=root)
    create_box("WH1_B_M", (cx, cy, cz), (w*0.7, th, th), mat=mat_sign_red, parent=root)
    create_box("WH1_B_B", (cx, cy, cz - h/2.0 + th/2.0), (w*0.7, th, th), mat=mat_sign_red, parent=root)
    create_box("WH1_B_R1", (cx + w/2.8, cy, cz + h/4.0), (th, th, h/2.0), mat=mat_sign_red, parent=root)
    create_box("WH1_B_R2", (cx + w/2.8, cy, cz - h/4.0), (th, th, h/2.0), mat=mat_sign_red, parent=root)

def build_letter_o(cx, cy, cz, h=0.085, w=0.060, th=0.012):
    create_box("WH1_O_L", (cx - w/2.6, cy, cz), (th, th, h), mat=mat_sign_red, parent=root)
    create_box("WH1_O_R", (cx + w/2.6, cy, cz), (th, th, h), mat=mat_sign_red, parent=root)
    create_box("WH1_O_T", (cx, cy, cz + h/2.0 - th/2.0), (w*0.8, th, th), mat=mat_sign_red, parent=root)
    create_box("WH1_O_B", (cx, cy, cz - h/2.0 + th/2.0), (w*0.8, th, th), mat=mat_sign_red, parent=root)

def build_letter_n(cx, cy, cz, h=0.085, w=0.060, th=0.012):
    create_box("WH1_N_L", (cx - w/2.6, cy, cz), (th, th, h), mat=mat_sign_red, parent=root)
    create_box("WH1_N_R", (cx + w/2.6, cy, cz), (th, th, h), mat=mat_sign_red, parent=root)
    # Diagonal from top-left (cx - w/2.6, cz + h/2.0) to bottom-right (cx + w/2.6, cz - h/2.0)
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    n_diag = bpy.context.active_object
    n_diag.name = "WH1_N_Diag"
    diag_len = math.sqrt((w*0.8)**2 + h**2)
    n_diag.scale = (th / 2.0, th / 2.0, diag_len / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Rotation angle: negative so it slopes from top-left to bottom-right!
    n_diag.rotation_euler = (0, -math.atan2(w*0.8, h), 0)
    n_diag.location = (cx, cy, cz)
    n_diag.data.materials.clear()
    n_diag.data.materials.append(mat_sign_red)
    n_diag.parent = root

spacing = 0.082
text_y = Y_FRONT - 0.048
build_letter_a(DOOR_X - spacing * 2.0, text_y, SIGN_Z)
build_letter_b(DOOR_X - spacing * 1.0, text_y, SIGN_Z)
build_letter_o(DOOR_X,                 text_y, SIGN_Z)
build_letter_n(DOOR_X + spacing * 1.0, text_y, SIGN_Z)
build_letter_o(DOOR_X + spacing * 2.0, text_y, SIGN_Z)

# 7. Entrance Concrete Walkway / Landing Stoop
create_box("WH1_EntranceWalkway",
           (DOOR_X, Y_FRONT - 0.70, 0.06),
           (1.40, 1.40, 0.12),
           mat=mat_stoop_concrete, parent=root)

# 8. Authentic Overhead Cable / Wire (Dropping from apex to left eave as seen in IMG '1 Front View.jpg')
create_box("WH1_OverheadWire",
           ((X_ROOF_LEFT + 0.0) / 2.0, Y_ROOF_FRONT + 0.02, (H_RIDGE + H_EAVE) / 2.0 + 0.15),
           (abs(X_ROOF_LEFT) * 0.95, 0.015, 0.015),
           mat=mat_cable_black, parent=root)
bpy.context.active_object.rotation_euler = (0, -pitch_angle, 0)

# Select all WH1 objects for export
bpy.ops.object.select_all(action='DESELECT')
count = 0
for obj in bpy.data.objects:
    if obj.name.startswith("WH1_"):
        obj.select_set(True)
        count += 1

print(f"Total WH1 objects to export: {count}")

# Export to GLB
export_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_1.glb"
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
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({"type": "execute_code", "params": {"code": blender_code}}).encode('utf-8') + b'\n')
data = s.recv(4096)
print(data.decode('utf-8', errors='ignore'))
s.close()
