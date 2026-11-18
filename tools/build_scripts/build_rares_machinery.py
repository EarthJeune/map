import bpy
import math
import os

# ==============================================================================
# DA-RARES MACHINERY SHED (rares_building_11) - AUTHENTIC 3D MODEL
# Station: Rizal Agricultural Research & Experiment Station (Tanay, Rizal)
# Reference Sources:
#   - Building Images RARES/Machinery Shed/ (5 photos)
#   - rares_buildings.json exact 4-vertex polygon (13.30 m x 11.93 m)
#   - rares_roads.json entrance node ([121.34069087, 14.57579889]) on West front
# ==============================================================================

bpy.ops.wm.read_factory_settings(use_empty=True)

def create_mat(name, hex_color, roughness=0.7, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    h = hex_color.lstrip('#')
    r, g, b = tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat

mat_concrete   = create_mat("Mach_Concrete",    "#A29E92", roughness=0.90)
mat_pedestal   = create_mat("Mach_Pedestal",    "#949184", roughness=0.92)
mat_steel_grey = create_mat("Mach_SteelGrey",   "#7B8079", roughness=0.58, metallic=0.45)
mat_steel_rust = create_mat("Mach_SteelRust",   "#5C382E", roughness=0.68, metallic=0.35)
mat_roof_galv  = create_mat("Mach_RoofGalv",    "#ADB3AE", roughness=0.42, metallic=0.50)
mat_fascia     = create_mat("Mach_WhiteFascia", "#CFD4CE", roughness=0.55)
mat_pvc        = create_mat("Mach_WhitePVC",    "#DCDED8", roughness=0.50)
mat_gen_yellow = create_mat("Mach_GenYellow",   "#C99E2C", roughness=0.50, metallic=0.20)
mat_mill_red   = create_mat("Mach_MillRed",     "#9B332A", roughness=0.52, metallic=0.25)
mat_mill_grey  = create_mat("Mach_MillGrey",    "#7A7E82", roughness=0.48, metallic=0.35)
mat_husk_orng  = create_mat("Mach_HuskOrange",  "#AE4B26", roughness=0.58, metallic=0.25)

# Exact 4-vertex polygon in meters relative to centroid (E=+X, N=+Y) from rares_buildings.json
# v0: (-4.54,  7.77) NNW
# v1: (-7.21, -5.26) SSW
# v2: ( 4.43, -7.89) SSE
# v3: ( 7.32,  5.38) NNE
V0 = (-4.54,  7.77)
V1 = (-7.21, -5.26)
V2 = ( 4.43, -7.89)
V3 = ( 7.32,  5.38)

# Local orthogonal basis aligned to West front edge (V0 -> V1):
# +V = North -> South along front (0 to 13.30m)
# +U = West -> East depth (0 to 11.93m)
fx, fy = V1[0] - V0[0], V1[1] - V0[1]
L = math.hypot(fx, fy)
vx, vy = fx / L, fy / L
ux, uy = -vy, vx   # +U points ENE (into shed from West front)
D = ((V3[0] - V0[0]) * ux + (V3[1] - V0[1]) * uy + (V2[0] - V1[0]) * ux + (V2[1] - V1[1]) * uy) * 0.5
ROT_Z = math.atan2(uy, ux)

OX, OY = V0[0], V0[1]
def to_world(u, v, z):
    return (OX + u * ux + v * vx, OY + u * uy + v * vy, z)

def create_box_uv(name, u, v, z, su, sv, sz, mat, tilt_u=0.0, tilt_v=0.0):
    bpy.ops.mesh.primitive_cube_add(location=to_world(u, v, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (su / 2.0, sv / 2.0, sz / 2.0)
    obj.rotation_euler = (tilt_v, tilt_u, ROT_Z)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj

# Split along V:
#   North bay (v in [0.0, 6.7]): lower low-slope galvalume roof + concrete floor slab
#   South bay (v in [6.7, 13.3]): higher rusty-truss gable roof with partial missing roof sheets
V_MID = 6.70

# 1. CONCRETE FLOOR SLAB (under North bay) + CONCRETE COLUMN PEDESTALS
create_box_uv("Mach_FloorSlab", D * 0.5, V_MID * 0.5, 0.07, D, V_MID, 0.14, mat_concrete)

# Column grid: U in [0.25, D*0.5, D-0.25], V in [0.25, V_MID, L-0.25]
U_COLS = (0.28, D * 0.5, D - 0.28)
V_COLS = (0.28, V_MID, L - 0.28)

Z_FLAT_N = 2.75
Z_FLAT_M = 3.05
def flat_z(v):
    return Z_FLAT_N + (Z_FLAT_M - Z_FLAT_N) * (v / V_MID)

Z_GABLE_EAVE  = 3.15
Z_GABLE_RIDGE = 4.35

for iu, cu in enumerate(U_COLS):
    for iv, cv in enumerate(V_COLS):
        # Concrete pedestal at base
        create_box_uv(f"Mach_Ped_{iu}_{iv}", cu, cv, 0.45, 0.36, 0.36, 0.90, mat_pedestal)
        # Steel pipe column
        if iv <= 1:
            col_top = flat_z(cv) - 0.10
            c_mat = mat_steel_grey
        else:
            col_top = Z_GABLE_EAVE
            c_mat = mat_steel_rust
        col_h = col_top - 0.90
        create_box_uv(f"Mach_Post_{iu}_{iv}", cu, cv, 0.90 + col_h * 0.5, 0.10, 0.10, col_h, c_mat)

# 2. NORTH FLAT / LOW-SLOPE ROOF BAY (v in [0.0, 6.70])
# Longitudinal open-web trusses along U_COLS + cross trusses along V_COLS
for iu, cu in enumerate(U_COLS):
    # Top & bottom chords of open-web truss along V (0 to V_MID)
    tilt_v = math.atan2(Z_FLAT_M - Z_FLAT_N, V_MID)
    for off_z in (-0.22, 0.0):
        create_box_uv(f"Mach_NorthTrussChord_{iu}_{off_z}", cu, V_MID * 0.5, 0.5 * (Z_FLAT_N + Z_FLAT_M) + off_z,
                      0.07, V_MID, 0.05, mat_steel_grey, tilt_v=-tilt_v)
    # Diagonal web struts
    for k in range(8):
        kv = 0.40 + k * ((V_MID - 0.80) / 7.0)
        create_box_uv(f"Mach_NorthWeb_{iu}_{k}", cu, kv, flat_z(kv) - 0.11, 0.04, 0.04, 0.22, mat_steel_grey)

# Cross open-web trusses at v = 0.28 and v = V_MID
for iv, cv in enumerate((0.28, V_MID)):
    cz = flat_z(cv)
    create_box_uv(f"Mach_NorthCrossTop_{iv}", D * 0.5, cv, cz, D, 0.07, 0.05, mat_steel_grey)
    create_box_uv(f"Mach_NorthCrossBot_{iv}", D * 0.5, cv, cz - 0.22, D, 0.07, 0.05, mat_steel_grey)

# Galvalume corrugated roof sheet over North bay + NW PVC gutter & downspout (Front Far.jpg)
OVH_N = 0.45
tot_vn = V_MID + OVH_N
tilt_vn = math.atan2(Z_FLAT_M - Z_FLAT_N, V_MID)
create_box_uv("Mach_NorthRoof", D * 0.5, V_MID * 0.5 - OVH_N * 0.5, 0.5 * (Z_FLAT_N + Z_FLAT_M) + 0.06,
              D + 0.80, tot_vn, 0.05, mat_roof_galv, tilt_v=-tilt_vn)
create_box_uv("Mach_NorthFascia_W", -0.40, V_MID * 0.5 - OVH_N * 0.5, 0.5 * (Z_FLAT_N + Z_FLAT_M) + 0.02,
              0.04, tot_vn, 0.14, mat_fascia, tilt_v=-tilt_vn)
create_box_uv("Mach_NorthGutter", D * 0.5, -OVH_N, Z_FLAT_N - 0.02, D + 0.80, 0.10, 0.09, mat_pvc)
create_box_uv("Mach_NorthDownspout", 0.18, -0.05, 1.35, 0.08, 0.08, 2.70, mat_pvc)

# 3. SOUTH HIGHER GABLE ROOF BAY (v in [6.70, 13.30])
# Note: Ridge runs West-to-East (along U) OR North-to-South (along V)?
# Look at Front.jpg & Back.jpg:
#   In Front.jpg (facing East from West road): we see the GABLE TRIANGLE facing us on the right (South) bay!
#   That means the RIDGE runs West-to-East (along U), and the two roof slopes face North (v=V_MID) and South (v=L)!
V_GABLE_LEN = L - V_MID   # 6.60m
V_GABLE_HALF = V_GABLE_LEN * 0.5
V_GABLE_MID = V_MID + V_GABLE_HALF
slope_ang = math.atan2(Z_GABLE_RIDGE - Z_GABLE_EAVE, V_GABLE_HALF)

# 3 rusty-brown steel gable trusses along U (at u = 0.28, D*0.5, D-0.28)
for iu, cu in enumerate(U_COLS):
    # Horizontal bottom chord
    create_box_uv(f"Mach_GableChord_{iu}", cu, V_GABLE_MID, Z_GABLE_EAVE, 0.07, V_GABLE_LEN, 0.06, mat_steel_rust)
    # King post
    create_box_uv(f"Mach_GableKing_{iu}", cu, V_GABLE_MID, 0.5 * (Z_GABLE_EAVE + Z_GABLE_RIDGE),
                  0.06, 0.06, Z_GABLE_RIDGE - Z_GABLE_EAVE, mat_steel_rust)
    # Sloped top rafters (North & South halves)
    rafter_len = math.hypot(V_GABLE_HALF, Z_GABLE_RIDGE - Z_GABLE_EAVE)
    for sgn, sname in ((-1.0, "N"), (1.0, "S")):
        create_box_uv(f"Mach_GableRafter_{iu}_{sname}", cu, V_GABLE_MID + sgn * V_GABLE_HALF * 0.5,
                      0.5 * (Z_GABLE_EAVE + Z_GABLE_RIDGE), 0.06, rafter_len, 0.06,
                      mat_steel_rust, tilt_v=sgn * slope_ang)

# Purlins running West-to-East across the gable slopes
for p in range(-3, 4):
    pv = V_GABLE_MID + p * (V_GABLE_HALF / 3.5)
    pz = Z_GABLE_RIDGE - abs(p) * ((Z_GABLE_RIDGE - Z_GABLE_EAVE) / 3.5) + 0.03
    create_box_uv(f"Mach_Purlin_{p}", D * 0.5, pv, pz, D + 0.80, 0.05, 0.05, mat_steel_rust)

# Corrugated roof sheets on South gable (with authentic missing sheet openings on front-west slope per Front.jpg!)
slope_len = (V_GABLE_HALF + 0.45) / math.cos(slope_ang)
drop_z = 0.45 * math.tan(slope_ang)
cz_slope = 0.5 * (Z_GABLE_RIDGE + (Z_GABLE_EAVE - drop_z)) + 0.07
# South slope: mostly intact across East & middle (u from 2.2 to D+0.40)
create_box_uv("Mach_SouthRoof_S", 0.5 * (2.2 + D + 0.40), V_GABLE_MID + (V_GABLE_HALF + 0.45) * 0.5,
              cz_slope, (D + 0.40) - 2.2, slope_len, 0.04, mat_roof_galv, tilt_v=slope_ang)
# North slope: partial sheets (middle-east intact, front-west missing exposing trusses!)
create_box_uv("Mach_SouthRoof_N1", 0.5 * (3.8 + D + 0.40), V_GABLE_MID - (V_GABLE_HALF + 0.45) * 0.5,
              cz_slope, (D + 0.40) - 3.8, slope_len, 0.04, mat_roof_galv, tilt_v=-slope_ang)
create_box_uv("Mach_SouthRoof_N2", 1.2, V_GABLE_MID - V_GABLE_HALF * 0.35,
              Z_GABLE_RIDGE - 0.30, 2.8, slope_len * 0.45, 0.04, mat_roof_galv, tilt_v=-slope_ang)

# 4. CLEAN STATIONARY MACHINERY INSIDE SHED (Front.jpg, Front inside (2).jpg, Back.jpg)
# Yellow diesel generator (KY22T)
create_box_uv("Mach_Generator", D * 0.58, 4.20, 0.14 + 0.52, 1.55, 0.85, 1.04, mat_gen_yellow)
# Red & grey rice mill / huller unit
create_box_uv("Mach_RiceMillBody", D * 0.34, 5.45, 0.14 + 0.72, 1.15, 1.05, 1.44, mat_mill_grey)
create_box_uv("Mach_RiceMillTop",  D * 0.34, 5.45, 0.14 + 1.52, 0.75, 0.75, 0.32, mat_mill_red)
# Orange husker / sheller in South bay
create_box_uv("Mach_Husker", D * 0.70, 8.60, 0.65, 1.45, 1.15, 1.25, mat_husk_orng)

# Export GLB strictly under 300 KB
os.makedirs("models", exist_ok=True)
out_path = os.path.abspath("models/rares_machinery.glb")
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"Exported {out_path} ({size_kb:.2f} KB)")
