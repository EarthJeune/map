import bpy
import bmesh
import math
import os

# ==============================================================================
# DA-RARES VERMICOMPOSTING FACILITY (OLD) (rares_building_9) - AUTHENTIC 3D MODEL
# Station: Rizal Agricultural Research & Experiment Station (Tanay, Rizal)
# Reference Sources:
#   - Building Images RARES/Vermicomposting Facility (Old)/
#   - rares_buildings.json exact 4-vertex polygon (20.37 m x 6.91 m)
#   - rares_roads.json entrance node ([121.34080998, 14.57624649]) at NNW corner
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

mat_concrete  = create_mat("Vermi_Concrete",   "#969388", roughness=0.92)
mat_floor     = create_mat("Vermi_Floor",      "#A29E92", roughness=0.88)
mat_compost   = create_mat("Vermi_Substrate",  "#2B211A", roughness=0.95)
mat_steel     = create_mat("Vermi_SageSteel",  "#849982", roughness=0.62, metallic=0.35)
mat_purlin    = create_mat("Vermi_DarkPurlin", "#5A4438", roughness=0.70, metallic=0.30)
mat_roof_rust = create_mat("Vermi_RoofRust",   "#6E3D34", roughness=0.68, metallic=0.25)
mat_roof_silv = create_mat("Vermi_RoofSilver", "#9B9A93", roughness=0.58, metallic=0.40)
mat_tarp      = create_mat("Vermi_WhiteTarp",  "#CFD4D0", roughness=0.48, metallic=0.05)
mat_mesh      = create_mat("Vermi_ShadeMesh",  "#1D221D", roughness=0.85, alpha=0.36)

# Exact polygon vertices in meters relative to centroid (E=+X, N=+Y) from rares_buildings.json
# v0: NNE ( 5.85,  9.09)
# v1: NNW (-0.88, 10.67)  <-- Entrance corner (rares_entrance_9 at -0.85, +9.75)
# v2: SSW (-5.78, -9.10)
# v3: SSE ( 0.81, -10.66)
V0 = ( 5.85,  9.09)
V1 = (-0.88, 10.67)
V2 = (-5.78, -9.10)
V3 = ( 0.81, -10.66)

# Local orthogonal basis aligned with long axis (North -> South: V1 -> V2):
# U = across width (West -> East: V1 -> V0), ~6.91m
# V = along length (North -> South: V1 -> V2), ~20.37m
lx, ly = V2[0] - V1[0], V2[1] - V1[1]
L = math.hypot(lx, ly)
vx, vy = lx / L, ly / L   # +V points South along building length
ux, uy = vy, -vx          # +U points East across building width (V1 -> V0)
W = ((V0[0] - V1[0]) * ux + (V0[1] - V1[1]) * uy + (V3[0] - V2[0]) * ux + (V3[1] - V2[1]) * uy) * 0.5
ROT_Z = math.atan2(uy, ux)

# Origin at midpoint of North short end (V1, V0) -> u in [-W/2, +W/2], v in [0, L]
OX = 0.5 * (V1[0] + V0[0])
OY = 0.5 * (V1[1] + V0[1])

def to_world(u, v, z):
    return (OX + u * ux + v * vx, OY + u * uy + v * vy, z)

def create_box_uv(name, u, v, z, su, sv, sz, mat, tilt_u=0.0, rot_local_z=0.0):
    bpy.ops.mesh.primitive_cube_add(location=to_world(u, v, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (su / 2.0, sv / 2.0, sz / 2.0)
    # tilt_u rotates around local V axis (tilting along U for gable slopes)
    obj.rotation_euler = (0.0, tilt_u, ROT_Z + rot_local_z)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj

Z_FLOOR = 0.10
Z_KNEE  = 0.68
Z_EAVE  = 2.25
Z_RIDGE = 3.55
HALF_W  = W * 0.5

# 1. CONCRETE FLOOR SLAB
create_box_uv("Vermi_FloorSlab", 0.0, L * 0.5, Z_FLOOR * 0.5, W, L, Z_FLOOR, mat_floor)

# 2. PERIMETER CONCRETE KNEE WALLS (with 2.5m entrance gap at North-West bay near v1)
WALL_T = 0.16
KNEE_H = Z_KNEE - Z_FLOOR
ENT_GAP = 2.60  # Entrance opening at West side, v in [0.15, 2.75]
# West wall: after entrance gap (v from 2.75 to L)
west_len = L - 2.75
create_box_uv("Vermi_Knee_West", -HALF_W + WALL_T * 0.5, 2.75 + west_len * 0.5, Z_FLOOR + KNEE_H * 0.5,
              WALL_T, west_len, KNEE_H, mat_concrete)
# East wall: full length
create_box_uv("Vermi_Knee_East", HALF_W - WALL_T * 0.5, L * 0.5, Z_FLOOR + KNEE_H * 0.5,
              WALL_T, L, KNEE_H, mat_concrete)
# North & South end knee walls
create_box_uv("Vermi_Knee_North", 0.0, WALL_T * 0.5, Z_FLOOR + KNEE_H * 0.5,
              W, WALL_T, KNEE_H, mat_concrete)
create_box_uv("Vermi_Knee_South", 0.0, L - WALL_T * 0.5, Z_FLOOR + KNEE_H * 0.5,
              W, WALL_T, KNEE_H, mat_concrete)

# 3. TUBULAR STEEL FRAME (7 bays along 20.37m length -> 8 truss frames)
N_FRAMES = 8
for i in range(N_FRAMES):
    fv = 0.12 + i * ((L - 0.24) / (N_FRAMES - 1))
    # Left (West) and Right (East) perimeter posts
    for side, su in (("W", -HALF_W + 0.07), ("E", HALF_W - 0.07)):
        create_box_uv(f"Vermi_Post_{side}_{i}", su, fv, Z_EAVE * 0.5, 0.08, 0.08, Z_EAVE, mat_steel)
    # Center column on interior frames (every 2nd frame + ends, matching Inside.jpg)
    if i in (0, 2, 4, 6, 7):
        create_box_uv(f"Vermi_CenterPost_{i}", 0.0, fv, Z_RIDGE * 0.5, 0.07, 0.07, Z_RIDGE, mat_steel)
    # Gable truss: horizontal bottom chord + king post + 2 sloped rafters
    create_box_uv(f"Vermi_Chord_{i}", 0.0, fv, Z_EAVE, W - 0.12, 0.06, 0.06, mat_steel)
    create_box_uv(f"Vermi_King_{i}", 0.0, fv, 0.5 * (Z_EAVE + Z_RIDGE), 0.05, 0.05, Z_RIDGE - Z_EAVE, mat_steel)
    slope_ang = math.atan2(Z_RIDGE - Z_EAVE, HALF_W)
    rafter_len = math.hypot(HALF_W, Z_RIDGE - Z_EAVE)
    for side, sgn in (("W", -1.0), ("E", 1.0)):
        create_box_uv(f"Vermi_Rafter_{side}_{i}", sgn * HALF_W * 0.5, fv, 0.5 * (Z_EAVE + Z_RIDGE),
                      rafter_len, 0.05, 0.06, mat_steel, tilt_u=sgn * slope_ang)

# Longitudinal eave & ridge tie beams
create_box_uv("Vermi_EaveBeam_W", -HALF_W + 0.07, L * 0.5, Z_EAVE, 0.07, L, 0.07, mat_steel)
create_box_uv("Vermi_EaveBeam_E",  HALF_W - 0.07, L * 0.5, Z_EAVE, 0.07, L, 0.07, mat_steel)
create_box_uv("Vermi_RidgeBeam",   0.0,           L * 0.5, Z_RIDGE, 0.07, L, 0.07, mat_steel)

# Open swinging gate frame at NW entrance (angled slightly inward/open like Front photo)
create_box_uv("Vermi_EntryGate", -HALF_W + 0.35, 0.55, 1.35, 0.05, 0.95, 1.85, mat_steel, rot_local_z=0.35)

# 4. TRANSLUCENT SHADE-MESH / WIRE ENCLOSURE PANELS (between knee wall and eave)
MESH_H = Z_EAVE - Z_KNEE
create_box_uv("Vermi_Mesh_West",  -HALF_W + 0.07, 2.75 + west_len * 0.5, Z_KNEE + MESH_H * 0.5,
              0.03, west_len, MESH_H, mat_mesh)
create_box_uv("Vermi_Mesh_East",   HALF_W - 0.07, L * 0.5, Z_KNEE + MESH_H * 0.5,
              0.03, L, MESH_H, mat_mesh)
create_box_uv("Vermi_Mesh_North",  0.0, 0.08, Z_KNEE + MESH_H * 0.5,
              W - 0.16, 0.03, MESH_H, mat_mesh)
create_box_uv("Vermi_Mesh_South",  0.0, L - 0.08, Z_KNEE + MESH_H * 0.5,
              W - 0.16, 0.03, MESH_H, mat_mesh)

# 5. FOUR INTERIOR CONCRETE VERMI-BEDS (Southern two-thirds, v from 6.2m to 19.2m)
BED_V0, BED_V1 = 6.2, 19.2
BED_LEN = BED_V1 - BED_V0
BED_H = 0.65
BED_W = 0.98
for idx, bu in enumerate((-2.35, -0.85, 0.85, 2.35)):
    # Concrete bin outer walls
    create_box_uv(f"Vermi_Bed_{idx}", bu, 0.5 * (BED_V0 + BED_V1), Z_FLOOR + BED_H * 0.5,
                  BED_W, BED_LEN, BED_H, mat_concrete)
    # Dark compost fill top
    create_box_uv(f"Vermi_Compost_{idx}", bu, 0.5 * (BED_V0 + BED_V1), Z_FLOOR + BED_H - 0.04,
                  BED_W - 0.16, BED_LEN - 0.18, 0.09, mat_compost)

# 6. WEATHERED CORRUGATED GABLE ROOF (Rusty brown + weathered silver bands + North-East tarp)
OVH_SIDE = 0.35
OVH_END  = 0.35
slope_ang = math.atan2(Z_RIDGE - Z_EAVE, HALF_W)
roof_run  = HALF_W + OVH_SIDE
slope_len = roof_run / math.cos(slope_ang)
roof_drop = OVH_SIDE * math.tan(slope_ang)
total_len = L + 2.0 * OVH_END

# Build segmented panels along V to capture the authentic weathered striping & white tarp (Back.jpg)
N_PANELS = 12
panel_v_len = total_len / N_PANELS
for sgn, side in ((-1.0, "W"), (1.0, "E")):
    center_u = sgn * (roof_run * 0.5)
    center_z = 0.5 * (Z_RIDGE + (Z_EAVE - roof_drop)) + 0.04
    for p in range(N_PANELS):
        pv = -OVH_END + (p + 0.5) * panel_v_len
        if side == "E" and p < 6:
            # Northern half of East slope has the white plastic tarp cover (Back.jpg)
            p_mat = mat_tarp
        elif p in (1, 4, 7, 9, 11):
            p_mat = mat_roof_silv
        else:
            p_mat = mat_roof_rust
        create_box_uv(f"Vermi_Roof_{side}_{p}", center_u, pv, center_z,
                      slope_len, panel_v_len + 0.01, 0.04, p_mat, tilt_u=sgn * slope_ang)

# Ridge cap
create_box_uv("Vermi_RidgeCap", 0.0, L * 0.5, Z_RIDGE + 0.06, 0.24, total_len, 0.05, mat_roof_rust)

# Export GLB strictly under 300 KB
os.makedirs("models", exist_ok=True)
out_path = os.path.abspath("models/rares_vermicomposting.glb")
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"Exported {out_path} ({size_kb:.2f} KB)")

