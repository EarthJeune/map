import bpy
import math
import os

# ==============================================================================
# DA-RARES NURSERY A (rares_building_6) - AUTHENTIC 3D MODEL
# Station: Rizal Agricultural Research & Experiment Station (Tanay, Rizal)
# Reference Sources:
#   - Building Images RARES/Nursery A/ (7 HEIC field photographs)
#   - rares_buildings.json polygon (23.95 m x 22.55 m)
#   - rares_roads.json entrance node ([121.34052889, 14.57554763], SE corner / front-left)
# ==============================================================================

bpy.ops.wm.read_factory_settings(use_empty=True)

def create_mat(name, hex_color, roughness=0.7, metallic=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    h = hex_color.lstrip('#')
    r, g, b = tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = 'BLEND'
        mat.show_transparent_back = False
    return mat

mat_concrete  = create_mat("RNA_Concrete",   "#878E88", roughness=0.90)
mat_gi_pipe   = create_mat("RNA_GIPipe",     "#9AA3AA", roughness=0.45, metallic=0.65)
mat_shade_net = create_mat("RNA_ShadeNet",   "#16191D", roughness=0.88, alpha=0.68)
mat_net_fold  = create_mat("RNA_NetFold",    "#1C2026", roughness=0.90, alpha=0.82)
mat_ground    = create_mat("RNA_GroundMat",  "#B49E76", roughness=0.92)
mat_soil      = create_mat("RNA_SoilBed",    "#4A3D31", roughness=0.95)
mat_foliage_a = create_mat("RNA_FoliageA",   "#346B2E", roughness=0.80)
mat_foliage_b = create_mat("RNA_FoliageB",   "#46823B", roughness=0.78)
mat_tarp      = create_mat("RNA_CreamTarp",  "#E3DAB8", roughness=0.65, alpha=0.88)
mat_crate     = create_mat("RNA_BlueCrate",  "#2458B8", roughness=0.55)

def create_box(name, loc, scale, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (scale[0] / 2.0, scale[1] / 2.0, scale[2] / 2.0)
    obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj

def create_cyl(name, p1, p2, radius, mat, vertices=8):
    dx, dy, dz = p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]
    length = math.sqrt(dx*dx + dy*dy + dz*dz)
    if length < 1e-4:
        return None
    mid = ((p1[0] + p2[0]) / 2.0, (p1[1] + p2[1]) / 2.0, (p1[2] + p2[2]) / 2.0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=mid)
    obj = bpy.context.active_object
    obj.name = name
    # Align Z axis to vector (dx, dy, dz)
    phi = math.atan2(dy, dx)
    theta = math.acos(max(-1.0, min(1.0, dz / length)))
    obj.rotation_euler = (0.0, theta, phi)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj

# Dimensions conforming strictly to rares_buildings.json (23.95 m x 22.55 m)
W = 23.95   # X-axis width (East road facade: left=SSW/-X, right=NNE/+X)
D = 22.55   # Y-axis depth (front=East/-Y, rear=West/+Y)
H = 2.85    # Eave post height

X_MIN, X_MAX = -W / 2.0, W / 2.0
Y_FRONT, Y_REAR = -D / 2.0, D / 2.0

# 1. INTERIOR WOVEN GROUNDSHEET FLOOR
create_box("GroundSheet", (0.0, 0.0, 0.02), (W - 0.30, D - 0.30, 0.04), mat_ground)

# 2. CONCRETE PERIMETER CURB (with entrance gap on front-left bay: x in [-9.2, -6.2])
CURB_H = 0.24
CURB_T = 0.18
# Rear curb
create_box("Curb_Rear", (0.0, Y_REAR - CURB_T/2, CURB_H/2), (W, CURB_T, CURB_H), mat_concrete)
# Left curb
create_box("Curb_Left", (X_MIN + CURB_T/2, 0.0, CURB_H/2), (CURB_T, D, CURB_H), mat_concrete)
# Right curb
create_box("Curb_Right", (X_MAX - CURB_T/2, 0.0, CURB_H/2), (CURB_T, D, CURB_H), mat_concrete)
# Front curb split around entrance opening [-9.2, -6.2]
ent_x1, ent_x2 = -9.20, -6.20
seg1_w = ent_x1 - X_MIN
create_box("Curb_Front_Left", (X_MIN + seg1_w/2, Y_FRONT + CURB_T/2, CURB_H/2), (seg1_w, CURB_T, CURB_H), mat_concrete)
seg2_w = X_MAX - ent_x2
create_box("Curb_Front_Right", (ent_x2 + seg2_w/2, Y_FRONT + CURB_T/2, CURB_H/2), (seg2_w, CURB_T, CURB_H), mat_concrete)

# 3. GALVANIZED STEEL GI PIPE FRAME (5x5 post grid + top purlins + knee braces)
nx, ny = 5, 5
xs = [X_MIN + 0.12 + i * (W - 0.24) / (nx - 1) for i in range(nx)]
ys = [Y_FRONT + 0.12 + j * (D - 0.24) / (ny - 1) for j in range(ny)]

def roof_z(x, y):
    # Subtle 0.25m camber toward the center ridge
    nx_norm = abs(x) / (W / 2.0)
    return H + 0.25 * (1.0 - nx_norm * nx_norm)

for i, x in enumerate(xs):
    for j, y in enumerate(ys):
        rz = roof_z(x, y)
        create_cyl(f"Post_{i}_{j}", (x, y, 0.0), (x, y, rz), 0.042, mat_gi_pipe, vertices=8)
        # Diagonal knee braces at perimeter posts (authentic detail from Middle Front.jpg)
        if i == 0 or i == nx - 1 or j == 0 or j == ny - 1:
            if i < nx - 1:
                create_cyl(f"BraceX1_{i}_{j}", (x, y, rz - 0.65), (x + 0.65, y, rz), 0.024, mat_gi_pipe, vertices=6)
            if i > 0:
                create_cyl(f"BraceX2_{i}_{j}", (x, y, rz - 0.65), (x - 0.65, y, rz), 0.024, mat_gi_pipe, vertices=6)
            if j < ny - 1:
                create_cyl(f"BraceY1_{i}_{j}", (x, y, rz - 0.65), (x, y + 0.65, rz), 0.024, mat_gi_pipe, vertices=6)
            if j > 0:
                create_cyl(f"BraceY2_{i}_{j}", (x, y, rz - 0.65), (x, y - 0.65, rz), 0.024, mat_gi_pipe, vertices=6)

# Horizontal top beams along X and Y
for j, y in enumerate(ys):
    for i in range(nx - 1):
        create_cyl(f"BeamX_{i}_{j}", (xs[i], y, roof_z(xs[i], y)), (xs[i+1], y, roof_z(xs[i+1], y)), 0.035, mat_gi_pipe, vertices=6)
for i, x in enumerate(xs):
    rz = roof_z(x, 0.0)
    create_cyl(f"BeamY_{i}", (x, Y_FRONT + 0.12, rz), (x, Y_REAR - 0.12, rz), 0.035, mat_gi_pipe, vertices=6)

# Entrance portal lintel pipe
create_cyl("Ent_Post_L", (ent_x1, Y_FRONT + 0.12, 0.0), (ent_x1, Y_FRONT + 0.12, H), 0.042, mat_gi_pipe, vertices=8)
create_cyl("Ent_Post_R", (ent_x2, Y_FRONT + 0.12, 0.0), (ent_x2, Y_FRONT + 0.12, H), 0.042, mat_gi_pipe, vertices=8)
create_cyl("Ent_Lintel", (ent_x1, Y_FRONT + 0.12, 2.25), (ent_x2, Y_FRONT + 0.12, 2.25), 0.032, mat_gi_pipe, vertices=6)

# 4. BLACK HORTICULTURAL SHADE NET (Roof + 4 Perimeter Walls with Entrance Opening)
# Roof net: 2 sloped halves meeting at gentle center ridge
half_w = W / 2.0
slope_len = math.hypot(half_w, 0.25)
slope_ang = math.atan2(0.25, half_w)
create_box("Net_Roof_L", (-half_w / 2.0, 0.0, H + 0.13), (slope_len, D, 0.025), mat_shade_net, rot=(0.0, -slope_ang, 0.0))
create_box("Net_Roof_R", ( half_w / 2.0, 0.0, H + 0.13), (slope_len, D, 0.025), mat_shade_net, rot=(0.0,  slope_ang, 0.0))

# Perimeter shade net walls (from curb top 0.22m to eave H)
wall_h = H - 0.20
wall_zc = 0.20 + wall_h / 2.0
create_box("Net_Wall_Rear",  (0.0, Y_REAR - 0.06, wall_zc), (W - 0.12, 0.025, wall_h), mat_shade_net)
create_box("Net_Wall_Left",  (X_MIN + 0.06, 0.0, wall_zc),  (0.025, D - 0.12, wall_h), mat_shade_net)
create_box("Net_Wall_Right", (X_MAX - 0.06, 0.0, wall_zc),  (0.025, D - 0.12, wall_h), mat_shade_net)

# Front shade net split around entrance opening [ent_x1, ent_x2]
create_box("Net_Front_L", (X_MIN + seg1_w/2, Y_FRONT + 0.06, wall_zc), (seg1_w - 0.06, 0.025, wall_h), mat_shade_net)
create_box("Net_Front_R", (ent_x2 + seg2_w/2, Y_FRONT + 0.06, wall_zc), (seg2_w - 0.06, 0.025, wall_h), mat_shade_net)
# Rolled-up net valance above entrance opening
create_box("Net_Front_Header", ((ent_x1 + ent_x2)/2, Y_FRONT + 0.06, 2.55), (ent_x2 - ent_x1, 0.08, 0.56), mat_net_fold)
# Gathered net curtain on right post of entrance (visible in Close up front entrance.jpg)
create_box("Net_Entrance_Curtain", (ent_x2 - 0.18, Y_FRONT + 0.10, 1.15), (0.36, 0.12, 2.10), mat_net_fold)

# 5. AUTHENTIC INTERIOR NURSERY BEDS, SEEDLINGS, SUSPENDED TARP & CRATES
# Suspended cream plastic tarp inside front-left bay (visible in Close up front entrance.jpg)
create_box("Interior_Cream_Tarp", (-7.6, -6.2, 2.05), (3.8, 5.2, 0.04), mat_tarp, rot=(0.08, 0.22, 0.0))

# Nursery seedling beds (rows of polybags & plants inside)
bed_configs = [
    (-6.5,  3.5, 4.2, 10.5, mat_foliage_a),
    ( 0.0,  4.0, 4.6, 11.0, mat_foliage_b),
    ( 6.8,  2.5, 4.4, 12.5, mat_foliage_a),
    ( 6.8, -5.8, 4.2,  4.8, mat_foliage_b),
    ( 0.0, -6.5, 4.4,  4.2, mat_foliage_a),
]
for idx, (bx, by, bw, bd, fmat) in enumerate(bed_configs):
    create_box(f"Bed_Soil_{idx}",  (bx, by, 0.11), (bw, bd, 0.14), mat_soil)
    create_box(f"Bed_Plant_{idx}", (bx, by, 0.36), (bw - 0.25, bd - 0.25, 0.36), fmat)

# Blue agricultural crates on the groundsheet (Inside View 1.jpg)
create_box("Blue_Crate_1", (-1.8, -0.5, 0.22), (0.55, 0.38, 0.32), mat_crate, rot=(0, 0, 0.3))
create_box("Blue_Crate_2", (-3.2,  1.2, 0.22), (0.55, 0.38, 0.32), mat_crate, rot=(0, 0, -0.2))

# Export GLB strictly under 300 KB
os.makedirs("models", exist_ok=True)
out_path = os.path.abspath("models/rares_nursery_a.glb")
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"Exported {out_path} ({size_kb:.2f} KB)")

