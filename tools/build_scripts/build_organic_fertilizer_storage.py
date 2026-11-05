import bpy
import bmesh
import math
import os

# 1. Clear existing scene meshes & materials
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.meshes):
    bpy.data.meshes.remove(block)
for block in list(bpy.data.materials):
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

mat_plinth_grey     = create_mat("OFS_PlinthGrey",     "#6E706B", roughness=0.88)
mat_cmu_wall        = create_mat("OFS_CMUWall",        "#989A94", roughness=0.85)
mat_knee_wall       = create_mat("OFS_KneeWall",       "#C8C6BE", roughness=0.80)
mat_knee_weathered  = create_mat("OFS_KneeWeathered",  "#9B9990", roughness=0.88)
mat_wood_frame      = create_mat("OFS_WoodFrame",      "#5E432B", roughness=0.75)
mat_fascia_grey     = create_mat("OFS_FasciaGrey",     "#C2C0B8", roughness=0.65)
mat_screen_mesh     = create_mat("OFS_ScreenMesh",     "#2B3032", roughness=0.40, metallic=0.30)
mat_roof_rust1      = create_mat("OFS_RoofRust1",      "#7C3E2B", roughness=0.82)
mat_roof_rust2      = create_mat("OFS_RoofRust2",      "#613222", roughness=0.85)
mat_sign_white      = create_mat("OFS_SignWhite",      "#F2F0E8", roughness=0.45)
mat_sign_text       = create_mat("OFS_SignText",       "#1A3828", roughness=0.30)
mat_sack_white      = create_mat("OFS_SackWhite",      "#ECEBE4", roughness=0.70)
mat_pallet_wood     = create_mat("OFS_PalletWood",     "#9A7B56", roughness=0.85)
mat_interior_dark   = create_mat("OFS_InteriorDark",   "#1A1A18", roughness=0.95)

# Helper geometry builders
def create_box(name, loc, size, rot=(0,0,0), mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

# Dimensions of LARES Organic Fertilizer Storage
# Width: 12.42 m (-6.21 to +6.21 m)
# Depth: 5.80 m (-2.90 to +2.90 m)
W = 12.42
D = 5.80
X_LEFT = -W / 2.0   # -6.21 m (West/Left partition wall)
X_RIGHT = W / 2.0   # +6.21 m (East/Right exterior end wall)
Y_FRONT = -D / 2.0  # -2.90 m (South front facade)
Y_REAR  =  D / 2.0  # +2.90 m (North rear wall)

H_BASE   = 0.20
H_KNEE   = 1.18
H_EAVE_R = 2.48
H_REAR_R = 2.68

DOOR_X = 4.85 - 5.01  # -0.16 m
DOOR_W = 1.18

root = bpy.data.objects.new("OFS_Root", None)
bpy.context.collection.objects.link(root)

# 1. Base Concrete Foundation Slab
create_box("OFS_BaseSlab", (0.0, 0.0, H_BASE / 2.0), (W, D, H_BASE), mat=mat_plinth_grey, parent=root)

# 2. Rear CMU Wall (North side, Y = Y_REAR - 0.08)
rear_h = H_REAR_R - H_BASE
create_box("OFS_RearWall", (0.0, Y_REAR - 0.08, H_BASE + rear_h / 2.0), (W, 0.16, rear_h), mat=mat_cmu_wall, parent=root)

# 3. Left Partition Wall (X = X_LEFT + 0.08, adjacent to Machinery Shed)
side_h = (H_EAVE_R + H_REAR_R) / 2.0 - H_BASE
create_box("OFS_LeftWall", (X_LEFT + 0.08, 0.0, H_BASE + side_h / 2.0), (0.16, D, side_h), mat=mat_cmu_wall, parent=root)

# 4. Right Exterior End Wall (X = X_RIGHT - 0.08)
create_box("OFS_RightWall", (X_RIGHT - 0.08, 0.0, H_BASE + (H_EAVE_R - H_BASE) / 2.0), (0.16, D, H_EAVE_R - H_BASE), mat=mat_knee_wall, parent=root)

# 5. Front Concrete Knee Wall (Left of Door: X_LEFT to DOOR_X - DOOR_W/2)
kw_left_w = (DOOR_X - DOOR_W / 2.0) - X_LEFT
kw_left_cx = X_LEFT + kw_left_w / 2.0
create_box("OFS_KneeWall_L", (kw_left_cx, Y_FRONT + 0.08, H_BASE + (H_KNEE - H_BASE) / 2.0), (kw_left_w, 0.16, H_KNEE - H_BASE), mat=mat_knee_wall, parent=root)
create_box("OFS_KneePlinth_L", (kw_left_cx, Y_FRONT + 0.07, H_BASE + 0.18), (kw_left_w, 0.17, 0.36), mat=mat_knee_weathered, parent=root)

# Front Concrete Knee Wall (Right of Door: DOOR_X + DOOR_W/2 to X_RIGHT)
kw_right_w = X_RIGHT - (DOOR_X + DOOR_W / 2.0)
kw_right_cx = (DOOR_X + DOOR_W / 2.0) + kw_right_w / 2.0
create_box("OFS_KneeWall_R", (kw_right_cx, Y_FRONT + 0.08, H_BASE + (H_KNEE - H_BASE) / 2.0), (kw_right_w, 0.16, H_KNEE - H_BASE), mat=mat_knee_wall, parent=root)
create_box("OFS_KneePlinth_R", (kw_right_cx, Y_FRONT + 0.07, H_BASE + 0.18), (kw_right_w, 0.17, 0.36), mat=mat_knee_weathered, parent=root)

# 6. Upper Wire-Mesh Screen Clerestory (Z = H_KNEE to H_EAVE_R)
screen_h = H_EAVE_R - H_KNEE
screen_cz = H_KNEE + screen_h / 2.0
create_box("OFS_ScreenPanel_L", (kw_left_cx, Y_FRONT + 0.08, screen_cz), (kw_left_w, 0.04, screen_h), mat=mat_screen_mesh, parent=root)
create_box("OFS_ScreenPanel_R", (kw_right_cx, Y_FRONT + 0.08, screen_cz), (kw_right_w, 0.04, screen_h), mat=mat_screen_mesh, parent=root)

# 7. Timber Screen Framing Grid
create_box("OFS_RailBottom_L", (kw_left_cx, Y_FRONT + 0.05, H_KNEE + 0.025), (kw_left_w, 0.06, 0.05), mat=mat_wood_frame, parent=root)
create_box("OFS_RailMid_L",    (kw_left_cx, Y_FRONT + 0.05, screen_cz),      (kw_left_w, 0.06, 0.045), mat=mat_wood_frame, parent=root)
create_box("OFS_RailTop_L",    (kw_left_cx, Y_FRONT + 0.05, H_EAVE_R - 0.03), (kw_left_w, 0.06, 0.06), mat=mat_wood_frame, parent=root)

create_box("OFS_RailBottom_R", (kw_right_cx, Y_FRONT + 0.05, H_KNEE + 0.025), (kw_right_w, 0.06, 0.05), mat=mat_wood_frame, parent=root)
create_box("OFS_RailMid_R",    (kw_right_cx, Y_FRONT + 0.05, screen_cz),      (kw_right_w, 0.06, 0.045), mat=mat_wood_frame, parent=root)
create_box("OFS_RailTop_R",    (kw_right_cx, Y_FRONT + 0.05, H_EAVE_R - 0.03), (kw_right_w, 0.06, 0.06), mat=mat_wood_frame, parent=root)

# Vertical Timber Mullions (Left 5 bays = 6 posts)
for i in range(6):
    mx = X_LEFT + 0.04 + i * (kw_left_w - 0.08) / 5.0
    create_box(f"OFS_MullionL_{i}", (mx, Y_FRONT + 0.05, screen_cz), (0.05, 0.06, screen_h), mat=mat_wood_frame, parent=root)

# Vertical Timber Mullions (Right 5 bays = 6 posts)
for i in range(6):
    mx = (DOOR_X + DOOR_W / 2.0) + 0.04 + i * (kw_right_w - 0.08) / 5.0
    create_box(f"OFS_MullionR_{i}", (mx, Y_FRONT + 0.05, screen_cz), (0.05, 0.06, screen_h), mat=mat_wood_frame, parent=root)

# 8. Open Doorway Frame & Transom Bar
create_box("OFS_DoorPost_L", (DOOR_X - DOOR_W / 2.0, Y_FRONT + 0.06, H_BASE + (H_EAVE_R - H_BASE) / 2.0), (0.08, 0.16, H_EAVE_R - H_BASE), mat=mat_wood_frame, parent=root)
create_box("OFS_DoorPost_R", (DOOR_X + DOOR_W / 2.0, Y_FRONT + 0.06, H_BASE + (H_EAVE_R - H_BASE) / 2.0), (0.08, 0.16, H_EAVE_R - H_BASE), mat=mat_wood_frame, parent=root)
create_box("OFS_DoorHeader", (DOOR_X, Y_FRONT + 0.06, H_EAVE_R - 0.22), (DOOR_W, 0.12, 0.07), mat=mat_wood_frame, parent=root)

# 9. Interior Backdrop & Stacked White Fertilizer Sacks
create_box("OFS_InteriorBackdrop", (DOOR_X, Y_FRONT + 1.45, H_BASE + 1.15), (2.20, 0.08, 2.30), mat=mat_interior_dark, parent=root)
create_box("OFS_InteriorSideL",    (DOOR_X - 1.05, Y_FRONT + 0.75, H_BASE + 1.15), (0.08, 1.40, 2.30), mat=mat_interior_dark, parent=root)
create_box("OFS_InteriorSideR",    (DOOR_X + 1.05, Y_FRONT + 0.75, H_BASE + 1.15), (0.08, 1.40, 2.30), mat=mat_interior_dark, parent=root)

create_box("OFS_FertilizerPallet", (DOOR_X - 0.05, Y_FRONT + 0.85, H_BASE + 0.06), (1.05, 0.80, 0.12), mat=mat_pallet_wood, parent=root)
for col in range(2):
    for tier in range(5):
        sx = DOOR_X - 0.30 + col * 0.50
        sz = H_BASE + 0.16 + tier * 0.15
        create_box(f"OFS_Sack_{col}_{tier}", (sx, Y_FRONT + 0.82, sz), (0.46, 0.68, 0.135), mat=mat_sack_white, parent=root)

# 10. Official White Signboard "ORGANIC FERTILIZER"
SIGN_X = DOOR_X + DOOR_W / 2.0 + 0.34
SIGN_Z = screen_cz - 0.02
SIGN_W = 0.46
SIGN_H = 0.18
create_box("OFS_SignPlaque", (SIGN_X, Y_FRONT + 0.015, SIGN_Z), (SIGN_W, 0.015, SIGN_H), mat=mat_sign_white, parent=root)

font_curve = bpy.data.curves.new(type="FONT", name="OFS_SignFont")
font_curve.body = "ORGANIC\nFERTILIZER"
font_curve.size = 0.052
font_curve.space_line = 1.15
font_curve.extrude = 0.002
font_curve.resolution_u = 2
font_curve.align_x = 'CENTER'
font_curve.align_y = 'CENTER'
font_obj = bpy.data.objects.new("OFS_SignTextMesh", font_curve)
bpy.context.collection.objects.link(font_obj)
bpy.context.view_layer.objects.active = font_obj
font_obj.select_set(True)
bpy.ops.object.convert(target='MESH')
font_obj.rotation_euler = (math.pi / 2.0, 0, 0)
font_obj.location = (SIGN_X, Y_FRONT + 0.004, SIGN_Z + 0.012)
font_obj.data.materials.clear()
font_obj.data.materials.append(mat_sign_text)
font_obj.parent = root

# 11. Roof: Corrugated Rust-Brown Iron Sheets
room_pitch = math.atan2(H_REAR_R - H_EAVE_R, D + 0.50)
room_slope_len = math.hypot(D + 0.50, H_REAR_R - H_EAVE_R)
room_mid_z = (H_EAVE_R + H_REAR_R) / 2.0

num_rust_sheets = 10
rust_w = (W + 0.15) / num_rust_sheets
for s_idx in range(num_rust_sheets):
    rx = X_LEFT + (s_idx + 0.5) * rust_w
    rmat = mat_roof_rust1 if (s_idx % 2 == 0) else mat_roof_rust2
    create_box(f"OFS_RoofRust_{s_idx}", (rx, 0.0, room_mid_z + 0.05), (rust_w * 0.99, room_slope_len, 0.035), rot=(room_pitch, 0, 0), mat=rmat, parent=root)

# 12. Continuous Timber Fascia Board along Front Eave
create_box("OFS_FrontFascia", (0.0, Y_FRONT - 0.22, H_EAVE_R + 0.03), (W + 0.15, 0.04, 0.18), mat=mat_fascia_grey, parent=root)

# 13. Join all OFS mesh objects into an optimized mesh
bpy.ops.object.select_all(action='DESELECT')
mesh_objs = [o for o in bpy.data.objects if o.name.startswith("OFS_") and o.type == 'MESH']
if mesh_objs:
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = "OFS_CombinedMesh"

# 14. Export GLB with Draco compression
export_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\lares_organic_fertilizer_storage.glb"
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.name.startswith("OFS_"):
        obj.select_set(True)

bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=7
)

size_kb = os.path.getsize(export_path) / 1024.0
print(f"Successfully exported {export_path} ({size_kb:.1f} KB)")

