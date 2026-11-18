import bpy
import bmesh
import math
import os

# ==============================================================================
# DA-RARES NURSERY / STORAGE AREA FOR HYDROPONICS (rares_building_12)
# Station: Rizal Agricultural Research & Experiment Station (Tanay, Rizal)
# Reference Sources:
#   - Building Images RARES/Nursery Storage Area for Hydroponics/ (3 photos)
#   - rares_buildings.json exact 4-vertex polygon (4.19 m x 5.98 m)
#   - rares_roads.json entrance node ([121.34066450, 14.57569875]) on West front
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

mat_uv_film   = create_mat("Hydro_UVFilm",     "#D6DDD8", roughness=0.38, alpha=0.82)
mat_mesh      = create_mat("Hydro_ScreenMesh", "#9CA39B", roughness=0.75, alpha=0.55)
mat_black_net = create_mat("Hydro_BlackNet",   "#1C201D", roughness=0.88)
mat_steel     = create_mat("Hydro_GalvPipe",   "#9AA29E", roughness=0.40, metallic=0.60)
mat_curb      = create_mat("Hydro_CHBCurb",    "#8E8C83", roughness=0.92)
mat_table     = create_mat("Hydro_Table",      "#C6C5BA", roughness=0.75)
mat_drum      = create_mat("Hydro_BlueDrum",   "#215CA8", roughness=0.45)

# Exact 4-vertex polygon in meters relative to centroid (E=+X, N=+Y) from rares_buildings.json
# v0: ( 3.32,  1.35) ENE
# v1: ( 2.54, -2.68) ESE
# v2: (-3.36, -1.39) WSW
# v3: (-2.50,  2.71) WNW
V0 = ( 3.32,  1.35)
V1 = ( 2.54, -2.68)
V2 = (-3.36, -1.39)
V3 = (-2.50,  2.71)

# Local orthogonal basis aligned to West front edge (V2 -> V3):
# +U = across width (South -> North along front, 4.19m) -> u in [-W/2, +W/2]
# +V = depth (West front -> East back, 5.98m) -> v in [0, D]
fx, fy = V3[0] - V2[0], V3[1] - V2[1]
W = math.hypot(fx, fy)
ux, uy = fx / W, fy / W
vx, vy = uy, -ux   # +V points ENE (into tunnel from West front)
D = ((V0[0] - V3[0]) * vx + (V0[1] - V3[1]) * vy + (V1[0] - V2[0]) * vx + (V1[1] - V2[1]) * vy) * 0.5
ROT_Z = math.atan2(uy, ux)

OX, OY = 0.5 * (V2[0] + V3[0]), 0.5 * (V2[1] + V3[1])
def to_world(u, v, z):
    return (OX + u * ux + v * vx, OY + u * uy + v * vy, z)

def create_box_uv(name, u, v, z, su, sv, sz, mat):
    bpy.ops.mesh.primitive_cube_add(location=to_world(u, v, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (su / 2.0, sv / 2.0, sz / 2.0)
    obj.rotation_euler = (0.0, 0.0, ROT_Z)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj

HALF_W = W * 0.5
Z_SPRING = 1.15
Z_APEX   = 2.85
V_SPLIT  = D * 0.45   # Front 45% = white UV film + mesh; Back 55% = black shade net

# Profile points (u, z) for the hoop-house cross-section (10 arc segments)
def hoop_profile(n_arc=10, inset=0.0):
    pts = [(-HALF_W + inset, 0.0), (-HALF_W + inset, Z_SPRING)]
    rx = HALF_W - inset
    rz = Z_APEX - Z_SPRING - inset
    for i in range(1, n_arc):
        ang = math.pi * (1.0 - i / n_arc)
        pts.append((rx * math.cos(ang), Z_SPRING + rz * math.sin(ang)))
    pts.append((HALF_W - inset, Z_SPRING))
    pts.append((HALF_W - inset, 0.0))
    return pts

PROF = hoop_profile(10)

def make_tunnel_shell(name, v0, v1, prof, mat, cap_start=False, cap_end=False):
    m = bpy.data.meshes.new(name + "_Mesh")
    o = bpy.data.objects.new(name, m)
    bpy.context.collection.objects.link(o)
    bm = bmesh.new()
    ring0 = [bm.verts.new(to_world(u, v0, z)) for (u, z) in prof]
    ring1 = [bm.verts.new(to_world(u, v1, z)) for (u, z) in prof]
    for i in range(len(prof) - 1):
        bm.faces.new([ring0[i], ring0[i+1], ring1[i+1], ring1[i]])
    if cap_start:
        bm.faces.new(list(reversed(ring0)))
    if cap_end:
        bm.faces.new(ring1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(m)
    bm.free()
    o.data.materials.append(mat)
    return o

# 1. TWO-TONE HOOP-HOUSE SHELL (Side View.jpg)
# Front half (white UV plastic film) + Front end mesh/film cap
make_tunnel_shell("Hydro_FrontShell", 0.0, V_SPLIT, PROF, mat_uv_film, cap_start=True, cap_end=False)
# Back half (black shade cloth) + Rear end cap
make_tunnel_shell("Hydro_BackShell", V_SPLIT, D, PROF, mat_black_net, cap_start=False, cap_end=True)

# 2. FRONT END WALL DETAILS (Front.jpg): CHB curb + Center screen door + Door frame + Flap
# Low CHB curb on left and right of front doorway
create_box_uv("Hydro_CurbL", -HALF_W * 0.62, 0.05, 0.14, 1.35, 0.16, 0.28, mat_curb)
create_box_uv("Hydro_CurbR",  HALF_W * 0.62, 0.05, 0.14, 1.35, 0.16, 0.28, mat_curb)

# Center screen swing door + steel frame + upper rain flap
DOOR_W, DOOR_H = 1.05, 1.85
create_box_uv("Hydro_DoorFrameL", -DOOR_W * 0.5, -0.02, DOOR_H * 0.5, 0.04, 0.05, DOOR_H, mat_steel)
create_box_uv("Hydro_DoorFrameR",  DOOR_W * 0.5, -0.02, DOOR_H * 0.5, 0.04, 0.05, DOOR_H, mat_steel)
create_box_uv("Hydro_DoorFrameT",  0.0,          -0.02, DOOR_H,       DOOR_W + 0.04, 0.05, 0.04, mat_steel)
create_box_uv("Hydro_DoorFrameM",  0.0,          -0.02, DOOR_H * 0.5, DOOR_W, 0.04, 0.03, mat_steel)
create_box_uv("Hydro_DoorMesh",    0.0,          -0.01, DOOR_H * 0.5, DOOR_W - 0.04, 0.02, DOOR_H - 0.04, mat_mesh)
create_box_uv("Hydro_DoorFlap",    0.0,          -0.04, DOOR_H + 0.04, DOOR_W + 0.12, 0.04, 0.18, mat_uv_film)

# Horizontal side & front steel rail bars
create_box_uv("Hydro_FrontBarL", -HALF_W * 0.62, -0.01, 1.02, 1.40, 0.03, 0.03, mat_steel)
create_box_uv("Hydro_FrontBarR",  HALF_W * 0.62, -0.01, 1.02, 1.40, 0.03, 0.03, mat_steel)

# 3. GALVANIZED STEEL ARCHED RIBS & LONGITUDINAL PURLINS
PROF_IN = hoop_profile(10, inset=0.04)
for idx, rv in enumerate((0.03, V_SPLIT, D * 0.72, D - 0.03)):
    m = bpy.data.meshes.new(f"Hydro_Rib_{idx}_Mesh")
    o = bpy.data.objects.new(f"Hydro_Rib_{idx}", m)
    bpy.context.collection.objects.link(o)
    bm = bmesh.new()
    for i in range(len(PROF_IN) - 1):
        u0, z0 = PROF_IN[i]
        u1, z1 = PROF_IN[i + 1]
        v_a = bm.verts.new(to_world(u0, rv - 0.02, z0))
        v_b = bm.verts.new(to_world(u1, rv - 0.02, z1))
        v_c = bm.verts.new(to_world(u1, rv + 0.02, z1))
        v_d = bm.verts.new(to_world(u0, rv + 0.02, z0))
        bm.faces.new([v_a, v_b, v_c, v_d])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(m)
    bm.free()
    o.data.materials.append(mat_steel)

# Ridge purlin + 2 side purlins
create_box_uv("Hydro_RidgePurlin", 0.0, D * 0.5, Z_APEX - 0.05, 0.04, D, 0.04, mat_steel)
create_box_uv("Hydro_SidePurlinL", -HALF_W + 0.04, D * 0.5, Z_SPRING, 0.04, D, 0.04, mat_steel)
create_box_uv("Hydro_SidePurlinR",  HALF_W - 0.04, D * 0.5, Z_SPRING, 0.04, D, 0.04, mat_steel)

# 4. INTERIOR STORAGE SHELF, WORK TABLE & NUTRIENT DRUMS (Inside.jpg)
create_box_uv("Hydro_BackShelf", 0.0, D - 0.55, 1.05, W * 0.78, 0.65, 0.06, mat_table)
create_box_uv("Hydro_WorkTable", -0.65, D * 0.55, 0.72, 1.10, 0.85, 0.05, mat_table)
create_box_uv("Hydro_Drum1", -1.25, 1.65, 0.45, 0.55, 0.55, 0.88, mat_drum)
create_box_uv("Hydro_Drum2",  1.15, 2.25, 0.45, 0.55, 0.55, 0.88, mat_drum)

# Export GLB strictly under 300 KB
os.makedirs("models", exist_ok=True)
out_path = os.path.abspath("models/rares_hydro_storage.glb")
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"Exported {out_path} ({size_kb:.2f} KB)")
