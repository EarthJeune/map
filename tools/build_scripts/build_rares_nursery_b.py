import bpy
import bmesh
import math
import os

# ==============================================================================
# DA-RARES NURSERY B (rares_building_14) - AUTHENTIC 3D MODEL
# Station: Rizal Agricultural Research & Experiment Station (Tanay, Rizal)
# Reference Sources:
#   - Building Images RARES/Nursery B/ (Front, Front Door, Inside View)
#   - rares_buildings.json exact 4-vertex polygon (18.21 m x 18.15 m)
#   - rares_roads.json entrance node ([121.34080112, 14.57559908]) on North front
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
    return mat

mat_concrete  = create_mat("NB_Concrete",   "#8A887E", roughness=0.92)
mat_earth     = create_mat("NB_EarthFloor", "#8C7452", roughness=0.95)
mat_steel     = create_mat("NB_GalvSteel",  "#8E9692", roughness=0.45, metallic=0.55)
mat_roof_net  = create_mat("NB_RoofNet",    "#5A605C", roughness=0.75, alpha=0.48)
mat_wall_net  = create_mat("NB_WallNet",    "#252A26", roughness=0.85, alpha=0.35)
mat_polybag   = create_mat("NB_Polybag",    "#1C1E1C", roughness=0.88)
mat_seedling  = create_mat("NB_Seedling",   "#4D8834", roughness=0.78)

# Exact 4-vertex polygon in meters relative to centroid (E=+X, N=+Y) from rares_buildings.json
# v0: (-7.05,  10.83) NNW
# v1: (-10.86, -6.92) SSW
# v2: ( 7.18, -10.81) SSE
# v3: (10.73,   6.90) NNE
V0 = (-7.05,  10.83)
V1 = (-10.86, -6.92)
V2 = ( 7.18, -10.81)
V3 = (10.73,   6.90)

# Local orthogonal basis aligned to North front edge (V0 -> V3):
# +U = West -> East along front (18.21m), u in [-W/2, +W/2]
# +V = North front -> South back (18.15m), v in [0, D]
fx, fy = V3[0] - V0[0], V3[1] - V0[1]
W = math.hypot(fx, fy)
ux, uy = fx / W, fy / W
vx, vy = uy, -ux   # +V points SSW (into nursery from North front)
D = ((V1[0] - V0[0]) * vx + (V1[1] - V0[1]) * vy + (V2[0] - V3[0]) * vx + (V2[1] - V3[1]) * vy) * 0.5
ROT_Z = math.atan2(uy, ux)

OX, OY = 0.5 * (V0[0] + V3[0]), 0.5 * (V0[1] + V3[1])
def to_world(u, v, z):
    return (OX + u * ux + v * vx, OY + u * uy + v * vy, z)

def create_box_uv(name, u, v, z, su, sv, sz, mat, tilt_u=0.0, rot_local_z=0.0):
    bpy.ops.mesh.primitive_cube_add(location=to_world(u, v, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (su / 2.0, sv / 2.0, sz / 2.0)
    obj.rotation_euler = (0.0, tilt_u, ROT_Z + rot_local_z)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj

HALF_W  = W * 0.5
Z_KNEE  = 0.55
Z_EAVE  = 2.55
Z_RIDGE = 3.85

# 1. EARTHY FLOOR + PERIMETER CONCRETE KNEE WALLS (with 1.65m entrance gap at North front u~+1.8m)
create_box_uv("NB_Floor", 0.0, D * 0.5, 0.03, W - 0.16, D - 0.16, 0.06, mat_earth)
create_box_uv("NB_Knee_W", -HALF_W + 0.09, D * 0.5, Z_KNEE * 0.5, 0.18, D, Z_KNEE, mat_concrete)
create_box_uv("NB_Knee_E",  HALF_W - 0.09, D * 0.5, Z_KNEE * 0.5, 0.18, D, Z_KNEE, mat_concrete)
create_box_uv("NB_Knee_S",  0.0, D - 0.09, Z_KNEE * 0.5, W, 0.18, Z_KNEE, mat_concrete)

# Front North knee wall split around gate at u in [1.0, 2.65] (aligned with rares_entrance_14)
GATE_U0, GATE_U1 = 1.00, 2.65
front_l_len = GATE_U0 - (-HALF_W)
front_r_len = HALF_W - GATE_U1
create_box_uv("NB_Knee_NL", -HALF_W + front_l_len * 0.5, 0.09, Z_KNEE * 0.5, front_l_len, 0.18, Z_KNEE, mat_concrete)
create_box_uv("NB_Knee_NR",  GATE_U1 + front_r_len * 0.5, 0.09, Z_KNEE * 0.5, front_r_len, 0.18, Z_KNEE, mat_concrete)

# Open swinging screen gate leaf (Front Door.jpg)
create_box_uv("NB_EntryGate", GATE_U0 + 0.12, -0.55, 1.10, 0.04, 1.45, 2.15, mat_steel, rot_local_z=-0.18)

# 2. GALVANIZED STEEL COLUMN GRID (5 x 5) & GABLE ROOF TRUSSES
slope_ang = math.atan2(Z_RIDGE - Z_EAVE, HALF_W)
rafter_len = math.hypot(HALF_W, Z_RIDGE - Z_EAVE)

for iu in range(5):
    cu = -HALF_W + 0.10 + iu * ((W - 0.20) / 4.0)
    col_top = Z_RIDGE - abs(cu) * ((Z_RIDGE - Z_EAVE) / HALF_W)
    for iv in range(5):
        cv = 0.10 + iv * ((D - 0.20) / 4.0)
        # Interior footing pad
        if 0 < iu < 4 and 0 < iv < 4:
            create_box_uv(f"NB_Pad_{iu}_{iv}", cu, cv, 0.08, 0.24, 0.24, 0.16, mat_concrete)
        create_box_uv(f"NB_Post_{iu}_{iv}", cu, cv, col_top * 0.5, 0.06, 0.06, col_top, mat_steel)
    # Longitudinal purlin / beam along V at each column line
    create_box_uv(f"NB_LongBeam_{iu}", cu, D * 0.5, col_top, 0.05, D, 0.05, mat_steel)

# 5 Gable cross-trusses
for iv in range(5):
    cv = 0.10 + iv * ((D - 0.20) / 4.0)
    create_box_uv(f"NB_Chord_{iv}", 0.0, cv, Z_EAVE, W - 0.20, 0.05, 0.05, mat_steel)
    for sgn, sname in ((-1.0, "W"), (1.0, "E")):
        create_box_uv(f"NB_Rafter_{iv}_{sname}", sgn * HALF_W * 0.5, cv, 0.5 * (Z_EAVE + Z_RIDGE),
                      rafter_len, 0.05, 0.05, mat_steel, tilt_u=sgn * slope_ang)

# 3. TRANSLUCENT SHADE-NETTING SIDE WALLS & GABLE ROOF
WALL_H = Z_EAVE - Z_KNEE
create_box_uv("NB_Net_W", -HALF_W + 0.08, D * 0.5, Z_KNEE + WALL_H * 0.5, 0.02, D, WALL_H, mat_wall_net)
create_box_uv("NB_Net_E",  HALF_W - 0.08, D * 0.5, Z_KNEE + WALL_H * 0.5, 0.02, D, WALL_H, mat_wall_net)
create_box_uv("NB_Net_S",  0.0, D - 0.08, Z_KNEE + WALL_H * 0.5, W, 0.02, WALL_H, mat_wall_net)
create_box_uv("NB_Net_NL", -HALF_W + front_l_len * 0.5, 0.08, Z_KNEE + WALL_H * 0.5, front_l_len, 0.02, WALL_H, mat_wall_net)
create_box_uv("NB_Net_NR",  GATE_U1 + front_r_len * 0.5, 0.08, Z_KNEE + WALL_H * 0.5, front_r_len, 0.02, WALL_H, mat_wall_net)

for sgn, sname in ((-1.0, "W"), (1.0, "E")):
    create_box_uv(f"NB_RoofNet_{sname}", sgn * HALF_W * 0.5, D * 0.5, 0.5 * (Z_EAVE + Z_RIDGE) + 0.03,
                  rafter_len, D, 0.03, mat_roof_net, tilt_u=sgn * slope_ang)

# 4. INTERIOR NURSERY SEEDLING BEDS (Left & Right bays with central aisle, Inside View.jpg)
BED_LEN = D - 2.2
for bu in (-6.6, -4.4, 4.4, 6.6):
    create_box_uv(f"NB_PolyBase_{bu}", bu, D * 0.5, 0.14, 1.35, BED_LEN, 0.16, mat_polybag)
    create_box_uv(f"NB_Seedling_{bu}", bu, D * 0.5, 0.30, 1.40, BED_LEN - 0.1, 0.18, mat_seedling)

# Export GLB strictly under 300 KB
os.makedirs("models", exist_ok=True)
out_path = os.path.abspath("models/rares_nursery_b.glb")
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"Exported {out_path} ({size_kb:.2f} KB)")
