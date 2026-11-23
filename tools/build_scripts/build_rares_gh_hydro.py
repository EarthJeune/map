import bpy
import bmesh
import math
import os

# ==============================================================================
# DA-RARES GREENHOUSE WITH HYDROPONICS (rares_building_13) - AUTHENTIC 3D MODEL
# Station: Rizal Agricultural Research & Experiment Station (Tanay, Rizal)
# Reference Sources:
#   - Building Images RARES/Greenhouse with Hydroponics/ (10 photos)
#   - rares_buildings.json exact 8-vertex polygon (main bay + North vestibule)
#   - rares_roads.json entrance node ([121.34065681, 14.57563166]) at vestibule
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

mat_uv_film  = create_mat("GHH_UVFilm",      "#DCE3DF", roughness=0.35, alpha=0.72)
mat_mesh     = create_mat("GHH_ScreenMesh",  "#AEB5AF", roughness=0.70, alpha=0.38)
mat_steel    = create_mat("GHH_GalvSteel",   "#9AA29E", roughness=0.40, metallic=0.60)
mat_curb     = create_mat("GHH_Concrete",    "#8E8C83", roughness=0.92)
mat_floor    = create_mat("GHH_WeedMat",     "#222523", roughness=0.95)
mat_pvc      = create_mat("GHH_WhitePVC",    "#E8ECE8", roughness=0.35)
mat_lettuce  = create_mat("GHH_Lettuce",     "#4F8A38", roughness=0.75)

# Exact 8-vertex polygon in meters relative to centroid (E=+X, N=+Y) from rares_buildings.json
# Main bay corners:
#   v0: ( 3.70,  1.93) NNE
#   v5: (-2.46,  3.31) NNW
#   v6: (-5.17, -8.72) SSW
#   v7: ( 0.97, -9.96) SSE
# Vestibule corners:
#   v1: ( 1.77,  2.42)
#   v2: ( 1.65,  3.85)
#   v3: ( 0.10,  4.31)
#   v4: (-0.55,  2.87)
V0 = ( 3.70,  1.93)
V5 = (-2.46,  3.31)
V6 = (-5.17, -8.72)
V7 = ( 0.97, -9.96)

# Local orthogonal basis aligned to North front edge (V5 -> V0):
# +U = West -> East across front (6.31m), u in [-W/2, +W/2]
# +V = North front -> South back (12.35m), v in [0, L]
fx, fy = V0[0] - V5[0], V0[1] - V5[1]
W = math.hypot(fx, fy)
ux, uy = fx / W, fy / W
vx, vy = uy, -ux   # +V points SSW (into greenhouse from North front)
L = ((V6[0] - V5[0]) * vx + (V6[1] - V5[1]) * vy + (V7[0] - V0[0]) * vx + (V7[1] - V0[1]) * vy) * 0.5
ROT_Z = math.atan2(uy, ux)

OX, OY = 0.5 * (V5[0] + V0[0]), 0.5 * (V5[1] + V0[1])
def to_world(u, v, z):
    return (OX + u * ux + v * vx, OY + u * uy + v * vy, z)

def create_box_uv(name, u, v, z, su, sv, sz, mat, tilt_u=0.0):
    bpy.ops.mesh.primitive_cube_add(location=to_world(u, v, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (su / 2.0, sv / 2.0, sz / 2.0)
    obj.rotation_euler = (0.0, tilt_u, ROT_Z)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj

HALF_W = W * 0.5
Z_CURB = 0.28
Z_MID  = 1.45   # Transition from lower screen mesh to upper UV film
Z_EAVE = 2.45
Z_APEX = 4.05

# 1. DARK WEED-MAT FLOOR + CONCRETE PERIMETER CURB
create_box_uv("GHH_Floor", 0.0, L * 0.5, 0.04, W - 0.16, L - 0.16, 0.08, mat_floor)
create_box_uv("GHH_CurbW", -HALF_W + 0.08, L * 0.5, Z_CURB * 0.5, 0.16, L, Z_CURB, mat_curb)
create_box_uv("GHH_CurbE",  HALF_W - 0.08, L * 0.5, Z_CURB * 0.5, 0.16, L, Z_CURB, mat_curb)
create_box_uv("GHH_CurbS",  0.0, L - 0.08, Z_CURB * 0.5, W, 0.16, Z_CURB, mat_curb)
create_box_uv("GHH_CurbN",  0.0, 0.08,     Z_CURB * 0.5, W, 0.16, Z_CURB, mat_curb)

# 2. MAIN GREENHOUSE SHELL (Lower Screen Mesh + Upper UV Film + Raised Ridge Vent)
def arch_pts(half_w, z_start, z_apex, n_arc=10):
    pts = []
    rz = z_apex - z_start
    for i in range(n_arc + 1):
        ang = math.pi * (1.0 - i / n_arc)
        pts.append((half_w * math.cos(ang), z_start + rz * math.sin(ang)))
    return pts

def make_extruded_strip(name, v0, v1, prof, mat, cap_start=False, cap_end=False):
    m = bpy.data.meshes.new(name + "_Mesh")
    o = bpy.data.objects.new(name, m)
    bpy.context.collection.objects.link(o)
    bm = bmesh.new()
    r0 = [bm.verts.new(to_world(u, v0, z)) for (u, z) in prof]
    r1 = [bm.verts.new(to_world(u, v1, z)) for (u, z) in prof]
    for i in range(len(prof) - 1):
        bm.faces.new([r0[i], r0[i+1], r1[i+1], r1[i]])
    if cap_start:
        bm.faces.new(list(reversed(r0)))
    if cap_end:
        bm.faces.new(r1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(m)
    bm.free()
    o.data.materials.append(mat)
    return o

# Lower mesh side walls (Z_CURB to Z_MID)
create_box_uv("GHH_MeshSideW", -HALF_W + 0.02, L * 0.5, 0.5 * (Z_CURB + Z_MID), 0.02, L, Z_MID - Z_CURB, mat_mesh)
create_box_uv("GHH_MeshSideE",  HALF_W - 0.02, L * 0.5, 0.5 * (Z_CURB + Z_MID), 0.02, L, Z_MID - Z_CURB, mat_mesh)
create_box_uv("GHH_MeshFront",  0.0, 0.02,     0.5 * (Z_CURB + Z_MID), W, 0.02, Z_MID - Z_CURB, mat_mesh)
create_box_uv("GHH_MeshBack",   0.0, L - 0.02, 0.5 * (Z_CURB + Z_MID), W, 0.02, Z_MID - Z_CURB, mat_mesh)

# Upper UV film side walls (Z_MID to Z_EAVE) + Arched UV film roof (Z_EAVE to Z_APEX)
ARCH_MAIN = [(-HALF_W, Z_MID)] + arch_pts(HALF_W, Z_EAVE, Z_APEX, 12) + [(HALF_W, Z_MID)]
make_extruded_strip("GHH_MainUpperShell", 0.0, L, ARCH_MAIN, mat_uv_film, cap_start=True, cap_end=True)

# Raised arched ridge monitor/vent along full length (Front.jpg, Side View.jpg)
ARCH_VENT = [(-0.75, Z_APEX - 0.08)] + arch_pts(0.75, Z_APEX + 0.05, Z_APEX + 0.45, 6) + [(0.75, Z_APEX - 0.08)]
make_extruded_strip("GHH_RidgeVent", 0.0, L, ARCH_VENT, mat_uv_film, cap_start=True, cap_end=True)

# 3. GALVANIZED STEEL ARCHED RIBS & PURLINS (6 bays)
for idx in range(7):
    rv = 0.06 + idx * ((L - 0.12) / 6.0)
    # Side posts
    create_box_uv(f"GHH_PostW_{idx}", -HALF_W + 0.05, rv, 0.5 * (Z_CURB + Z_EAVE), 0.05, 0.05, Z_EAVE - Z_CURB, mat_steel)
    create_box_uv(f"GHH_PostE_{idx}",  HALF_W - 0.05, rv, 0.5 * (Z_CURB + Z_EAVE), 0.05, 0.05, Z_EAVE - Z_CURB, mat_steel)
# Longitudinal eave & mid-rail pipes
create_box_uv("GHH_RailW_Mid", -HALF_W + 0.04, L * 0.5, Z_MID,  0.04, L, 0.04, mat_steel)
create_box_uv("GHH_RailE_Mid",  HALF_W - 0.04, L * 0.5, Z_MID,  0.04, L, 0.04, mat_steel)
create_box_uv("GHH_RailW_Top", -HALF_W + 0.04, L * 0.5, Z_EAVE, 0.04, L, 0.04, mat_steel)
create_box_uv("GHH_RailE_Top",  HALF_W - 0.04, L * 0.5, Z_EAVE, 0.04, L, 0.04, mat_steel)
create_box_uv("GHH_RidgePipe",  0.0,           L * 0.5, Z_APEX - 0.04, 0.05, L, 0.05, mat_steel)

# 4. PROJECTING NORTH ENTRANCE VESTIBULE (v1-v2-v3-v4, centered at u = -0.30, v in [-1.55, 0.0])
VEST_U = -0.30
VEST_W = 1.65
VEST_D = 1.55
VEST_EAVE = 2.02
VEST_APEX = 2.68
create_box_uv("GHH_VestCurbL", VEST_U - VEST_W * 0.5 + 0.07, -VEST_D * 0.5, 0.14, 0.14, VEST_D, 0.28, mat_curb)
create_box_uv("GHH_VestCurbR", VEST_U + VEST_W * 0.5 - 0.07, -VEST_D * 0.5, 0.14, 0.14, VEST_D, 0.28, mat_curb)
create_box_uv("GHH_VestFloor", VEST_U, -VEST_D * 0.5, 0.05, VEST_W - 0.14, VEST_D, 0.10, mat_curb)

VEST_PROF = [(VEST_U - VEST_W * 0.5, 0.28)] + [
    (VEST_U + u, z) for (u, z) in arch_pts(VEST_W * 0.5, VEST_EAVE, VEST_APEX, 8)
] + [(VEST_U + VEST_W * 0.5, 0.28)]
make_extruded_strip("GHH_VestShell", -VEST_D, 0.0, VEST_PROF, mat_mesh, cap_start=True, cap_end=False)
# Vestibule front door frame
create_box_uv("GHH_VestDoorL", VEST_U - 0.52, -VEST_D - 0.01, 1.00, 0.04, 0.04, 1.96, mat_steel)
create_box_uv("GHH_VestDoorR", VEST_U + 0.52, -VEST_D - 0.01, 1.00, 0.04, 0.04, 1.96, mat_steel)
create_box_uv("GHH_VestDoorT", VEST_U,        -VEST_D - 0.01, 1.98, 1.08, 0.04, 0.04, mat_steel)
create_box_uv("GHH_VestDoorM", VEST_U,        -VEST_D - 0.01, 1.00, 1.04, 0.04, 0.03, mat_steel)

# 5. TWO ROWS OF INTERIOR A-FRAME HYDROPONIC NFT RACKS WITH GREEN LETTUCE (Inside View.jpg)
RACK_LEN = L - 2.0
RACK_CV  = L * 0.5 + 0.2
for idx, ru in enumerate((-1.55, 1.55)):
    # 5 tiers of white PVC NFT channels + lush green lettuce rows on each side of the A-frame
    for tier in range(5):
        tz = 0.35 + tier * 0.38
        spread = 0.72 - tier * 0.14
        for sgn in (-1.0, 1.0):
            tu = ru + sgn * spread
            create_box_uv(f"GHH_NFT_{idx}_{tier}_{sgn}", tu, RACK_CV, tz, 0.14, RACK_LEN, 0.08, mat_pvc)
            create_box_uv(f"GHH_Lettuce_{idx}_{tier}_{sgn}", tu, RACK_CV, tz + 0.09, 0.18, RACK_LEN - 0.2, 0.11, mat_lettuce)

# 6. ELEVATED BLUE POLYETHYLENE WATER TANK ON TAPERED ANGLE-IRON STAND (Back with the Water.HEIC)
# Exact centroid of rares_building_13.1 relative to model origin: (-0.187, -11.221)
mat_tank_blue  = create_mat("GHH_TankBlue",   "#0B5B9A", roughness=0.38, metallic=0.05)
mat_tank_lid   = create_mat("GHH_TankLid",    "#084475", roughness=0.42, metallic=0.05)
mat_pipe_blue  = create_mat("GHH_PipeBlue",   "#1E78C8", roughness=0.35, metallic=0.05)
mat_stand_iron = create_mat("GHH_StandIron",  "#7F8480", roughness=0.62, metallic=0.45)
mat_deck_wood  = create_mat("GHH_StandDeck",  "#8A7961", roughness=0.88, metallic=0.0)
mat_valve_blk  = create_mat("GHH_ValveBlack", "#1D2022", roughness=0.55, metallic=0.2)

TANK_WX, TANK_WY = -0.187, -11.221
# Convert world (TANK_WX, TANK_WY) into greenhouse (u, v) basis so stand aligns cleanly with greenhouse
du_t = (TANK_WX - OX) * ux + (TANK_WY - OY) * uy
dv_t = (TANK_WX - OX) * vx + (TANK_WY - OY) * vy

def add_strut(name, p1, p2, thick, mat):
    dx, dy, dz = p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]
    length = math.sqrt(dx * dx + dy * dy + dz * dz)
    if length < 1e-4:
        return
    mx, my, mz = (p1[0] + p2[0]) * 0.5, (p1[1] + p2[1]) * 0.5, (p1[2] + p2[2]) * 0.5
    bpy.ops.mesh.primitive_cube_add(location=(mx, my, mz))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (thick * 0.5, thick * 0.5, length * 0.5)
    # Orient local +Z along (p2 - p1)
    from mathutils import Vector
    vec = Vector((dx, dy, dz)).normalized()
    quat = vec.to_track_quat('Z', 'Y')
    obj.rotation_euler = quat.to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)

STAND_H = 1.38
HB = 0.72   # Half-width at base (1.44m x 1.44m)
HT = 0.60   # Half-width at top  (1.20m x 1.20m)
b_corners = [
    to_world(du_t - HB, dv_t - HB, 0.0),
    to_world(du_t + HB, dv_t - HB, 0.0),
    to_world(du_t + HB, dv_t + HB, 0.0),
    to_world(du_t - HB, dv_t + HB, 0.0),
]
t_corners = [
    to_world(du_t - HT, dv_t - HT, STAND_H),
    to_world(du_t + HT, dv_t - HT, STAND_H),
    to_world(du_t + HT, dv_t + HT, STAND_H),
    to_world(du_t - HT, dv_t + HT, STAND_H),
]
for i in range(4):
    j = (i + 1) % 4
    # Sloped corner leg
    add_strut(f"GHH_TankLeg_{i}", b_corners[i], t_corners[i], 0.065, mat_stand_iron)
    # Top perimeter rail
    add_strut(f"GHH_TankTopRail_{i}", t_corners[i], t_corners[j], 0.06, mat_stand_iron)
    # Lower perimeter rail (0.18m above ground)
    p_bi = (b_corners[i][0], b_corners[i][1], 0.18)
    p_bj = (b_corners[j][0], b_corners[j][1], 0.18)
    add_strut(f"GHH_TankLowRail_{i}", p_bi, p_bj, 0.05, mat_stand_iron)
    # X-bracing diagonals on each side
    add_strut(f"GHH_TankBraceA_{i}", p_bi, t_corners[j], 0.04, mat_stand_iron)
    add_strut(f"GHH_TankBraceB_{i}", p_bj, t_corners[i], 0.04, mat_stand_iron)

# Top deck platform
create_box_uv("GHH_TankDeck", du_t, dv_t, STAND_H + 0.025, HT * 2.04, HT * 2.04, 0.05, mat_deck_wood)

# Blue cylindrical polyethylene water tank (18-seg smooth low-poly cylinder + 3 rib bands + top rim + lid)
TANK_Z0 = STAND_H + 0.05
TANK_H  = 1.32
TANK_R  = 0.54
bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=TANK_R, depth=TANK_H, location=(TANK_WX, TANK_WY, TANK_Z0 + TANK_H * 0.5))
tank_body = bpy.context.active_object
tank_body.name = "GHH_WaterTankBody"
tank_body.data.materials.append(mat_tank_blue)

# Horizontal reinforcement ribs + flared top rim
for r_idx, rz_frac in enumerate((0.28, 0.55, 0.80)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=TANK_R + 0.025, depth=0.045, location=(TANK_WX, TANK_WY, TANK_Z0 + TANK_H * rz_frac))
    rib = bpy.context.active_object
    rib.name = f"GHH_TankRib_{r_idx}"
    rib.data.materials.append(mat_tank_blue)

bpy.ops.mesh.primitive_cylinder_add(vertices=18, radius=TANK_R + 0.055, depth=0.055, location=(TANK_WX, TANK_WY, TANK_Z0 + TANK_H - 0.02))
rim = bpy.context.active_object
rim.name = "GHH_TankTopRim"
rim.data.materials.append(mat_tank_blue)

# Domed/stepped center lid
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.26, depth=0.10, location=(TANK_WX, TANK_WY, TANK_Z0 + TANK_H + 0.05))
lid = bpy.context.active_object
lid.name = "GHH_TankLid"
lid.data.materials.append(mat_tank_lid)

# Vertical blue PVC inlet/riser pipe running along outer edge of stand & tank + top elbow
pipe_base = to_world(du_t + 0.02, dv_t + TANK_R + 0.07, 0.0)
pipe_top  = to_world(du_t + 0.02, dv_t + TANK_R + 0.07, TANK_Z0 + TANK_H - 0.06)
pipe_in   = to_world(du_t + 0.02, dv_t + TANK_R - 0.08, TANK_Z0 + TANK_H - 0.06)
add_strut("GHH_TankRiserPipe", pipe_base, pipe_top, 0.045, mat_pipe_blue)
add_strut("GHH_TankTopElbow",  pipe_top,  pipe_in,  0.045, mat_pipe_blue)

# Lower outlet valve & pipe toward greenhouse
out_tank = to_world(du_t + TANK_R - 0.02, dv_t - 0.12, TANK_Z0 + 0.10)
out_edge = to_world(du_t + TANK_R + 0.18, dv_t - 0.12, TANK_Z0 + 0.10)
out_drop = to_world(du_t + TANK_R + 0.18, dv_t - 0.12, 0.12)
add_strut("GHH_TankOutPipeH", out_tank, out_edge, 0.038, mat_valve_blk)
add_strut("GHH_TankOutPipeV", out_edge, out_drop, 0.038, mat_valve_blk)

# Export GLB strictly under 300 KB
os.makedirs("models", exist_ok=True)
out_path = os.path.abspath("models/rares_gh_hydro.glb")
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"Exported {out_path} ({size_kb:.2f} KB)")
