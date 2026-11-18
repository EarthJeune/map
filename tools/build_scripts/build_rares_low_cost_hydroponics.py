"""
Build script for DA-RARES Low-cost Hydroponics Facility (rares_building_19).
Conforms strictly to the 4-vertex footprint in rares_buildings.json and
rares_entrance_20 (-0.27, -2.32) on the South front.
"""
import os
import bpy
import bmesh
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------
def make_mat(name, rgba, roughness=0.5, metallic=0.0, alpha_blend=False):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if alpha_blend:
            bsdf.inputs["Alpha"].default_value = rgba[3]
            m.blend_method = "BLEND"
    return m

MAT_STEEL_PIPE  = make_mat("GalvPipe", (0.56, 0.58, 0.60, 1.0), roughness=0.35, metallic=0.80)
MAT_POLY_SHEET  = make_mat("TranslucentPoly", (0.86, 0.88, 0.87, 0.44), roughness=0.25, alpha_blend=True)
MAT_BLACK_NET   = make_mat("BlackShadeNet", (0.07, 0.07, 0.07, 0.68), roughness=0.88, alpha_blend=True)
MAT_NFT_STAND   = make_mat("BlackPalletStand", (0.12, 0.12, 0.13, 1.0), roughness=0.78)
MAT_PVC_WHITE   = make_mat("PVCWhite", (0.88, 0.88, 0.86, 1.0), roughness=0.35)
MAT_PVC_BLUE    = make_mat("PVCBlue", (0.10, 0.36, 0.72, 1.0), roughness=0.40)
MAT_LEAF_GREEN  = make_mat("HydroCropGreen", (0.24, 0.54, 0.18, 1.0), roughness=0.72)
MAT_GROWBAG     = make_mat("BlackGrowBag", (0.09, 0.09, 0.10, 1.0), roughness=0.82)

# ---------------------------------------------------------------------------
# Footprint & Local Frame
# ---------------------------------------------------------------------------
# Exact (E, N) vertices relative to centroid [121.34122749, 14.57588399]
V_RAW = [
    (-2.65, +2.14),  # v0: NW
    (-2.26, -2.37),  # v1: SW
    (+2.70, -2.20),  # v2: SE
    (+2.22, +2.43),  # v3: NE
]

v1_vec = Vector(V_RAW[1])
v2_vec = Vector(V_RAW[2])
dir_u = (v2_vec - v1_vec).normalized()  # +u = East
dir_v = Vector((-dir_u.y, dir_u.x))     # +v = North

def to_uv(e, n):
    p = Vector((e, n))
    return (p.dot(dir_u), p.dot(dir_v))

def to_en(u, v):
    p = dir_u * u + dir_v * v
    return (p.x, p.y)

UV_VERTS = [to_uv(e, n) for (e, n) in V_RAW]
u_min = min(p[0] for p in UV_VERTS)
u_max = max(p[0] for p in UV_VERTS)
v_min = min(p[1] for p in UV_VERTS)
v_max = max(p[1] for p in UV_VERTS)
u_mid = 0.5 * (u_min + u_max)

# Asymmetric curved lean-to profile: (u, z) control points from West ground (u_min) to East high eave (u_max)
w_span = u_max - u_min
PROFILE_PTS = [
    (u_min,               0.00),
    (u_min + 0.12*w_span, 1.35),
    (u_min + 0.28*w_span, 1.85),
    (u_min + 0.52*w_span, 2.18),
    (u_min + 0.78*w_span, 2.40),
    (u_max,               2.55),
]

# ---------------------------------------------------------------------------
# Mesh Helpers
# ---------------------------------------------------------------------------
def add_uv_box(name, u0, u1, v0, v1, z0, z1, mat):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    corners = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    bot = [bm.verts.new((*to_en(u, v), z0)) for (u, v) in corners]
    top = [bm.verts.new((*to_en(u, v), z1)) for (u, v) in corners]
    bm.faces.new([bot[3], bot[2], bot[1], bot[0]])
    bm.faces.new([top[0], top[1], top[2], top[3]])
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([bot[i], bot[j], top[j], top[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mat)
    return obj

def add_curved_sheet(name, v0, v1, thick=0.015):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bot_s = [bm.verts.new((*to_en(u, v0), z)) for (u, z) in PROFILE_PTS]
    bot_n = [bm.verts.new((*to_en(u, v1), z)) for (u, z) in PROFILE_PTS]
    top_s = [bm.verts.new((*to_en(u, v0), z + thick)) for (u, z) in PROFILE_PTS]
    top_n = [bm.verts.new((*to_en(u, v1), z + thick)) for (u, z) in PROFILE_PTS]
    for i in range(len(PROFILE_PTS) - 1):
        bm.faces.new([top_s[i], top_s[i+1], top_n[i+1], top_n[i]])
        bm.faces.new([bot_n[i], bot_n[i+1], bot_s[i+1], bot_s[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(MAT_POLY_SHEET)
    return obj

def add_rib(name, vc):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    r = 0.02
    b_s = [bm.verts.new((*to_en(u, vc - r), z - 0.03)) for (u, z) in PROFILE_PTS]
    b_n = [bm.verts.new((*to_en(u, vc + r), z - 0.03)) for (u, z) in PROFILE_PTS]
    t_s = [bm.verts.new((*to_en(u, vc - r), z)) for (u, z) in PROFILE_PTS]
    t_n = [bm.verts.new((*to_en(u, vc + r), z)) for (u, z) in PROFILE_PTS]
    for i in range(len(PROFILE_PTS) - 1):
        bm.faces.new([b_s[i], b_s[i+1], t_s[i+1], t_s[i]])
        bm.faces.new([t_n[i], t_n[i+1], b_n[i+1], b_n[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(MAT_STEEL_PIPE)
    return obj

# ---------------------------------------------------------------------------
# 1. Steel Frame, Translucent Curved Poly Roof & East Shade-Net Wall
# ---------------------------------------------------------------------------
n_bays = 4
vs = [v_min + (v_max - v_min) * (i / n_bays) for i in range(n_bays + 1)]
for idx, vc in enumerate(vs):
    add_rib(f"Curved_Rib_{idx}", vc)
    add_uv_box(f"East_Post_{idx}", u_max - 0.03, u_max + 0.03, vc - 0.03, vc + 0.03, 0.0, 2.55, MAT_STEEL_PIPE)

# Longitudinal purlins
for idx, (pu, pz) in enumerate(PROFILE_PTS):
    add_uv_box(f"Purlin_{idx}", pu - 0.02, pu + 0.02, v_min, v_max, max(0.0, pz - 0.03), pz + 0.01, MAT_STEEL_PIPE)

# Translucent polyethylene sheet over curved roof + upper East valance
add_curved_sheet("Poly_Canopy", v_min - 0.08, v_max + 0.08)
add_uv_box("East_Poly_Valance", u_max - 0.01, u_max + 0.02, v_min, v_max, 2.00, 2.55, MAT_POLY_SHEET)

# East vertical black shade-net wall
add_uv_box("East_Black_Net", u_max - 0.01, u_max + 0.02, v_min, v_max, 0.0, 2.00, MAT_BLACK_NET)

# ---------------------------------------------------------------------------
# 2. Central Hydroponic NFT Pipe Table (5 white PVC pipes on 3 black stands)
# ---------------------------------------------------------------------------
table_u0, table_u1 = u_mid - 0.45, u_mid + 0.75
table_v0, table_v1 = v_min + 0.50, v_max - 0.50

# 3 Black pallet support stands
for idx, sv in enumerate((table_v0 + 0.15, 0.5*(table_v0 + table_v1), table_v1 - 0.15)):
    add_uv_box(f"NFT_Stand_{idx}", table_u0, table_u1, sv - 0.08, sv + 0.08, 0.0, 0.85, MAT_NFT_STAND)

# 5 White 4-inch PVC NFT pipes + small green crops
for p_idx in range(5):
    pu = table_u0 + 0.10 + (table_u1 - table_u0 - 0.20) * (p_idx / 4.0)
    add_uv_box(f"NFT_Pipe_{p_idx}", pu - 0.055, pu + 0.055, table_v0, table_v1, 0.85, 0.96, MAT_PVC_WHITE)
    # Green hydroponic leafy crops along the pipe
    for c_idx in range(10):
        cv = table_v0 + 0.25 + (table_v1 - table_v0 - 0.50) * (c_idx / 9.0)
        add_uv_box(f"Crop_{p_idx}_{c_idx}", pu - 0.04, pu + 0.04, cv - 0.05, cv + 0.05, 0.96, 1.12, MAT_LEAF_GREEN)

# Blue front irrigation manifold pipe
add_uv_box("NFT_Blue_Manifold", table_u0, table_u1, table_v0 - 0.08, table_v0 - 0.03, 0.75, 0.80, MAT_PVC_BLUE)
# White return collector pipe at back
add_uv_box("NFT_Return_Pipe", table_u0, table_u1, table_v1, table_v1 + 0.10, 0.74, 0.84, MAT_PVC_WHITE)

# ---------------------------------------------------------------------------
# 3. Side Seedling Benches (West & East edges)
# ---------------------------------------------------------------------------
for side, bu in (("W", u_min + 0.85), ("E", u_max - 0.45)):
    add_uv_box(f"Side_Bench_{side}", bu - 0.18, bu + 0.18, table_v0, table_v1, 0.42, 0.48, MAT_PVC_WHITE)
    for g_idx in range(8):
        gv = table_v0 + 0.20 + (table_v1 - table_v0 - 0.40) * (g_idx / 7.0)
        add_uv_box(f"Side_Bag_{side}_{g_idx}", bu - 0.09, bu + 0.09, gv - 0.09, gv + 0.09, 0.48, 0.64, MAT_GROWBAG)

# ---------------------------------------------------------------------------
# Export GLB
# ---------------------------------------------------------------------------
out_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\rares_low_cost_hydroponics.glb"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"EXPORTED: {out_path} ({size_kb:.2f} KB)")

