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

mat_plinth_grey    = create_mat("FMS1_PlinthGrey",    "#6E706B", roughness=0.88)
mat_cmu_wall       = create_mat("FMS1_CMUWall",       "#989A94", roughness=0.85)
mat_knee_wall      = create_mat("FMS1_KneeWall",      "#C8C6BE", roughness=0.80)
mat_wood_rafter    = create_mat("FMS1_WoodRafter",    "#6E5239", roughness=0.72)
mat_fascia_grey    = create_mat("FMS1_FasciaGrey",    "#C2C0B8", roughness=0.65)
mat_roof_silver1   = create_mat("FMS1_RoofSilver1",   "#D0D3D0", roughness=0.45, metallic=0.50)
mat_roof_silver2   = create_mat("FMS1_RoofSilver2",   "#B4B8B4", roughness=0.50, metallic=0.45)
mat_steel_pipe     = create_mat("FMS1_SteelPipe",     "#B8BEC2", roughness=0.35, metallic=0.80)

# Combine Harvester & Tractor materials
mat_harv_white     = create_mat("FMS1_HarvWhite",     "#E8E6DC", roughness=0.40)
mat_harv_red       = create_mat("FMS1_HarvRed",       "#B82924", roughness=0.45)
mat_harv_orange    = create_mat("FMS1_HarvOrange",    "#D94A2B", roughness=0.40)
mat_tractor_blue   = create_mat("FMS1_TractorBlue",   "#0E4DA4", roughness=0.35, metallic=0.25)
mat_tire_black     = create_mat("FMS1_TireBlack",     "#1C1D1C", roughness=0.85)
mat_rim_cream      = create_mat("FMS1_RimCream",      "#DDD8C8", roughness=0.45, metallic=0.30)

def create_box(name, loc, size, rot=(0, 0, 0), mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rot != (0, 0, 0):
        obj.rotation_euler = rot
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cyl(name, loc, radius, depth, rot=(0, 0, 0), vertices=12, mat=None, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

root = bpy.data.objects.new("FMS1_Root", None)
bpy.context.collection.objects.link(root)

# Dimensions: Width = 10.02 m, Depth = 5.80 m
# Local X in [-5.01, +5.01], Y in [-2.90, +2.90]
W = 10.02
D = 5.80
X_LEFT  = -W / 2.0  # -5.01 m (South end)
X_RIGHT =  W / 2.0  # +5.01 m (North end, adjacent to Organic Fertilizer Storage)
Y_FRONT = -D / 2.0  # -2.90 m (East front facing road)
Y_REAR  =  D / 2.0  # +2.90 m (West rear wall)

H_BASE = 0.12
create_box("FMS1_BaseSlab", (0.0, 0.0, H_BASE / 2.0), (W, D, H_BASE), mat=mat_plinth_grey, parent=root)

# Rear CMU Wall (West side)
H_REAR = 2.52
create_box("FMS1_RearWall", (0.0, Y_REAR - 0.08, H_BASE + (H_REAR - H_BASE) / 2.0), (W, 0.16, H_REAR - H_BASE), mat=mat_cmu_wall, parent=root)

# South Side CMU Wall (Left end, X = X_LEFT + 0.08)
create_box("FMS1_SouthSideWall", (X_LEFT + 0.08, 0.20, H_BASE + 2.25 / 2.0), (0.16, D - 0.40, 2.25), mat=mat_cmu_wall, parent=root)
create_box("FMS1_SouthPier", (X_LEFT + 0.14, -0.80, H_BASE + 2.40 / 2.0), (0.28, 0.28, 2.40), mat=mat_knee_wall, parent=root)

# North Divider CMU Wall (Right end, X = X_RIGHT - 0.08)
create_box("FMS1_NorthWall", (X_RIGHT - 0.08, 0.0, H_BASE + (H_REAR - H_BASE) / 2.0), (0.16, D, H_REAR - H_BASE), mat=mat_cmu_wall, parent=root)

# --- Steel Pipe Columns & Header Beams ---
Z_SHED_FRONT = 2.92
Z_SHED_REAR  = 2.55
shed_pitch = math.atan2(Z_SHED_FRONT - Z_SHED_REAR, D + 0.40)

pipe_xs = [X_LEFT + 0.15, X_LEFT + 3.45, X_LEFT + 6.75, X_RIGHT - 0.15]
mid_pipe_h = (Z_SHED_FRONT + Z_SHED_REAR) / 2.0 - 0.04
for idx, px in enumerate(pipe_xs):
    create_cyl(f"FMS1_FrontPipe_{idx}", (px, Y_FRONT + 0.08, Z_SHED_FRONT / 2.0), 0.035, Z_SHED_FRONT, mat=mat_steel_pipe, parent=root)
    if idx < 3:
        create_cyl(f"FMS1_MidPipe_{idx}", (px, 0.0, mid_pipe_h / 2.0), 0.032, mid_pipe_h, mat=mat_steel_pipe, parent=root)

create_cyl("FMS1_FrontHeaderPipe", (0.0, Y_FRONT + 0.08, Z_SHED_FRONT - 0.06), 0.03, W, rot=(0, math.pi/2, 0), mat=mat_steel_pipe, parent=root)
create_cyl("FMS1_MidHeaderPipe",   (0.0, 0.0, (Z_SHED_FRONT + Z_SHED_REAR) / 2.0 - 0.06), 0.03, W, rot=(0, math.pi/2, 0), mat=mat_steel_pipe, parent=root)

# Timber Rafters sloping front-to-rear (7 rafters)
shed_slope_len = math.hypot(D + 0.45, Z_SHED_FRONT - Z_SHED_REAR)
shed_mid_z = (Z_SHED_FRONT + Z_SHED_REAR) / 2.0
for r_idx in range(7):
    rx = X_LEFT + 0.20 + r_idx * (W - 0.40) / 6.0
    create_box(f"FMS1_ShedRafter_{r_idx}", (rx, 0.0, shed_mid_z), (0.06, shed_slope_len, 0.09), rot=(-shed_pitch, 0, 0), mat=mat_wood_rafter, parent=root)

# Timber Purlins running along X
for p_idx in range(5):
    py = Y_FRONT - 0.15 + p_idx * (D + 0.30) / 4.0
    pz = Z_SHED_FRONT - (py - (Y_FRONT - 0.15)) / (D + 0.30) * (Z_SHED_FRONT - Z_SHED_REAR) + 0.04
    create_box(f"FMS1_ShedPurlin_{p_idx}", (0.0, py, pz), (W + 0.20, 0.07, 0.05), rot=(-shed_pitch, 0, 0), mat=mat_wood_rafter, parent=root)

# Silver-White Corrugated Metal Roof Sheets
num_silver_sheets = 8
sheet_w = (W + 0.20) / num_silver_sheets
for s_idx in range(num_silver_sheets):
    sx = (X_LEFT - 0.10) + (s_idx + 0.5) * sheet_w
    smat = mat_roof_silver1 if (s_idx % 2 == 0) else mat_roof_silver2
    create_box(f"FMS1_RoofSilver_{s_idx}", (sx, 0.0, shed_mid_z + 0.07), (sheet_w * 0.98, shed_slope_len, 0.025), rot=(-shed_pitch, 0, 0), mat=smat, parent=root)

# Equipment Bay 1: FMWorld Multi-Crop Combine Harvester (centered at X = -2.94 m)
HX = -2.94
HY = -0.35
create_box("FMS1_HarvTrack_L", (HX - 0.72, HY + 0.15, 0.34), (0.32, 2.20, 0.44), mat=mat_tire_black, parent=root)
create_box("FMS1_HarvTrack_R", (HX + 0.72, HY + 0.15, 0.34), (0.32, 2.20, 0.44), mat=mat_tire_black, parent=root)
create_box("FMS1_HarvBody",    (HX, HY + 0.30, 1.15), (1.65, 2.40, 1.25), mat=mat_harv_white, parent=root)
create_box("FMS1_HarvAccent",  (HX, HY + 0.28, 1.05), (1.68, 2.42, 0.22), mat=mat_harv_red, parent=root)
create_box("FMS1_HarvHeader",  (HX, HY - 1.35, 0.52), (2.10, 0.95, 0.55), mat=mat_harv_red, parent=root)
create_cyl("FMS1_HarvReel",    (HX, HY - 1.55, 0.72), 0.26, 2.00, rot=(0, math.pi/2, 0), mat=mat_harv_red, parent=root)
create_box("FMS1_HarvGuard",   (HX, HY - 1.20, 1.05), (2.05, 0.05, 0.42), mat=mat_harv_white, parent=root)
create_box("FMS1_HarvSeat",    (HX - 0.35, HY - 0.35, 1.85), (0.50, 0.50, 0.40), mat=mat_tire_black, parent=root)
create_box("FMS1_HarvCanopyPost1", (HX - 0.65, HY - 0.10, 2.15), (0.05, 0.05, 0.85), mat=mat_tire_black, parent=root)
create_box("FMS1_HarvCanopyPost2", (HX - 0.05, HY - 0.10, 2.15), (0.05, 0.05, 0.85), mat=mat_tire_black, parent=root)
create_box("FMS1_HarvCanopy",  (HX - 0.35, HY - 0.35, 2.52), (0.95, 1.15, 0.08), rot=(0.18, 0, 0), mat=mat_harv_orange, parent=root)

# Equipment Bay 2: Blue Ford Agricultural Tractor (centered at X = +1.11 m)
TX = +1.11
TY = -0.10
create_cyl("FMS1_TracRearTire_L", (TX - 0.78, TY + 0.55, 0.72), 0.60, 0.38, rot=(0, math.pi/2, 0), vertices=16, mat=mat_tire_black, parent=root)
create_cyl("FMS1_TracRearRim_L",  (TX - 0.79, TY + 0.55, 0.72), 0.36, 0.40, rot=(0, math.pi/2, 0), vertices=12, mat=mat_rim_cream, parent=root)
create_cyl("FMS1_TracRearTire_R", (TX + 0.78, TY + 0.55, 0.72), 0.60, 0.38, rot=(0, math.pi/2, 0), vertices=16, mat=mat_tire_black, parent=root)
create_cyl("FMS1_TracRearRim_R",  (TX + 0.79, TY + 0.55, 0.72), 0.36, 0.40, rot=(0, math.pi/2, 0), vertices=12, mat=mat_rim_cream, parent=root)
create_cyl("FMS1_TracFrontTire_L", (TX - 0.68, TY - 1.15, 0.48), 0.36, 0.24, rot=(0, math.pi/2, 0), vertices=14, mat=mat_tire_black, parent=root)
create_cyl("FMS1_TracFrontTire_R", (TX + 0.68, TY - 1.15, 0.48), 0.36, 0.24, rot=(0, math.pi/2, 0), vertices=14, mat=mat_tire_black, parent=root)
create_box("FMS1_TracHood",    (TX, TY - 0.45, 1.05), (0.82, 1.85, 0.72), mat=mat_tractor_blue, parent=root)
create_box("FMS1_TracFenderL", (TX - 0.68, TY + 0.55, 1.28), (0.36, 1.10, 0.18), mat=mat_tractor_blue, parent=root)
create_box("FMS1_TracFenderR", (TX + 0.68, TY + 0.55, 1.28), (0.36, 1.10, 0.18), mat=mat_tractor_blue, parent=root)
create_box("FMS1_TracSeat",    (TX, TY + 0.45, 1.38), (0.48, 0.48, 0.35), mat=mat_tire_black, parent=root)
create_box("FMS1_TracROPS_L",  (TX - 0.52, TY + 0.65, 1.95), (0.06, 0.06, 1.25), mat=mat_tire_black, parent=root)
create_box("FMS1_TracROPS_R",  (TX + 0.52, TY + 0.65, 1.95), (0.06, 0.06, 1.25), mat=mat_tire_black, parent=root)
create_box("FMS1_TracCanopy",  (TX, TY + 0.35, 2.52), (1.35, 1.45, 0.08), mat=mat_harv_white, parent=root)

# Join all mesh objects into single optimized multi-material mesh
bpy.ops.object.select_all(action='DESELECT')
mesh_objs = [o for o in bpy.data.objects if o.name.startswith("FMS1_") and o.type == 'MESH']
if mesh_objs:
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = "FMS1_CombinedMesh"

# Export GLB with Draco compression
export_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\lares_farm_machinery_shed_1.glb"
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.name.startswith("FMS1_"):
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

