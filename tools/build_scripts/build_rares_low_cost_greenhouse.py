"""
Build script for DA-RARES Low-cost Greenhouse (rares_building_18).
Conforms strictly to the 4-vertex footprint in rares_buildings.json and
rares_entrance_18 / rares_entrance_19 on North and South ends.
"""
import math
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
MAT_ROOF_POLY   = make_mat("TranslucentPoly", (0.86, 0.88, 0.86, 0.42), roughness=0.28, alpha_blend=True)
MAT_SIDE_NET    = make_mat("BlackShadeNet", (0.07, 0.07, 0.07, 0.62), roughness=0.88, alpha_blend=True)
MAT_BENCH_TRAY  = make_mat("BenchTrayWhite", (0.78, 0.77, 0.73, 1.0), roughness=0.55)
MAT_GROWBAG     = make_mat("BlackGrowBag", (0.09, 0.09, 0.10, 1.0), roughness=0.82)
MAT_SOIL        = make_mat("SoilFloor", (0.34, 0.27, 0.20, 1.0), roughness=0.95)

# ---------------------------------------------------------------------------
# Footprint & Local Frame
# ---------------------------------------------------------------------------
# Exact (E, N) vertices relative to centroid [121.34126214, 14.57604238]
V_RAW = [
    (-4.56, +10.50),  # v0: NW
    (+5.56,  +9.75),  # v1: NE
    (+4.76, -10.52),  # v2: SE
    (-5.76,  -9.73),  # v3: SW
]

v3_vec = Vector(V_RAW[3])
v2_vec = Vector(V_RAW[2])
dir_u = (v2_vec - v3_vec).normalized()  # +u = East
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
half_w = 0.5 * (u_max - u_min)

Z_EAVE = 2.15
Z_APEX = 3.45

def arch_z(u):
    """Smooth parabolic arch from Z_EAVE at +/-half_w to Z_APEX at u_mid."""
    t = (u - u_mid) / half_w
    t = max(-1.0, min(1.0, t))
    return Z_EAVE + (Z_APEX - Z_EAVE) * (1.0 - t * t)

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

def add_curved_roof_sheet(name, v0, v1, segs=16, thick=0.02):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    us = [u_min - 0.12 + (u_max - u_min + 0.24) * (i / segs) for i in range(segs + 1)]
    bot_s = [bm.verts.new((*to_en(u, v0), arch_z(u))) for u in us]
    bot_n = [bm.verts.new((*to_en(u, v1), arch_z(u))) for u in us]
    top_s = [bm.verts.new((*to_en(u, v0), arch_z(u) + thick)) for u in us]
    top_n = [bm.verts.new((*to_en(u, v1), arch_z(u) + thick)) for u in us]
    for i in range(segs):
        bm.faces.new([top_s[i], top_s[i+1], top_n[i+1], top_n[i]])
        bm.faces.new([bot_n[i], bot_n[i+1], bot_s[i+1], bot_s[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(MAT_ROOF_POLY)
    return obj

def add_arch_rib(name, vc, segs=14):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    us = [u_min + (u_max - u_min) * (i / segs) for i in range(segs + 1)]
    r = 0.025
    b_s = [bm.verts.new((*to_en(u, vc - r), arch_z(u) - 0.04)) for u in us]
    b_n = [bm.verts.new((*to_en(u, vc + r), arch_z(u) - 0.04)) for u in us]
    t_s = [bm.verts.new((*to_en(u, vc - r), arch_z(u))) for u in us]
    t_n = [bm.verts.new((*to_en(u, vc + r), arch_z(u))) for u in us]
    for i in range(segs):
        bm.faces.new([b_s[i], b_s[i+1], t_s[i+1], t_s[i]])
        bm.faces.new([t_n[i], t_n[i+1], b_n[i+1], b_n[i]])
        bm.faces.new([b_n[i], b_n[i+1], b_s[i+1], b_s[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(MAT_STEEL_PIPE)
    return obj

# ---------------------------------------------------------------------------
# 1. Steel Pipe Frame (9 bays along N-S length)
# ---------------------------------------------------------------------------
n_bays = 8
vs = [v_min + (v_max - v_min) * (i / n_bays) for i in range(n_bays + 1)]

# Vertical posts (West eave, Center ridge, East eave) + curved arch ribs
for idx, vc in enumerate(vs):
    for side, pu in (("W", u_min), ("C", u_mid), ("E", u_max)):
        pz = arch_z(pu)
        add_uv_box(f"Post_{side}_{idx}", pu - 0.03, pu + 0.03, vc - 0.03, vc + 0.03, 0.0, pz, MAT_STEEL_PIPE)
    add_arch_rib(f"Arch_Rib_{idx}", vc)

# Longitudinal purlins (eaves, mid-slopes, ridge)
for idx, pu in enumerate((u_min, u_min + half_w*0.5, u_mid, u_max - half_w*0.5, u_max)):
    pz = arch_z(pu)
    add_uv_box(f"Purlin_{idx}", pu - 0.025, pu + 0.025, v_min, v_max, pz - 0.04, pz, MAT_STEEL_PIPE)

# ---------------------------------------------------------------------------
# 2. Translucent Poly Roof & Black Shade-Net Side Walls
# ---------------------------------------------------------------------------
add_curved_roof_sheet("Poly_Roof_Sheet", v_min - 0.15, v_max + 0.15, segs=16, thick=0.02)

# West & East black shade-netting walls
add_uv_box("Net_Wall_West", u_min - 0.02, u_min + 0.01, v_min, v_max, 0.05, Z_EAVE, MAT_SIDE_NET)
add_uv_box("Net_Wall_East", u_max - 0.01, u_max + 0.02, v_min, v_max, 0.05, Z_EAVE, MAT_SIDE_NET)

# ---------------------------------------------------------------------------
# 3. Interior Raised Gutter Benches & Grow-Bags (4 long rows)
# ---------------------------------------------------------------------------
bench_us = [u_min + 1.5, u_min + 3.8, u_max - 3.8, u_max - 1.5]
bv0, bv1 = v_min + 0.90, v_max - 0.90
for b_idx, bu in enumerate(bench_us):
    # Long tray
    add_uv_box(f"Bench_Tray_{b_idx}", bu - 0.18, bu + 0.18, bv0, bv1, 0.72, 0.78, MAT_BENCH_TRAY)
    # Support legs (6 pairs along length)
    for l_idx in range(6):
        lv = bv0 + (bv1 - bv0) * (l_idx / 5.0)
        add_uv_box(f"Bench_Leg_{b_idx}_{l_idx}", bu - 0.12, bu + 0.12, lv - 0.02, lv + 0.02, 0.0, 0.72, MAT_STEEL_PIPE)
    # Row of black grow-bags
    n_bags = 18
    for g_idx in range(n_bags):
        gv = bv0 + 0.4 + (bv1 - bv0 - 0.8) * (g_idx / (n_bags - 1))
        add_uv_box(f"Bag_{b_idx}_{g_idx}", bu - 0.11, bu + 0.11, gv - 0.11, gv + 0.11, 0.78, 0.98, MAT_GROWBAG)

# ---------------------------------------------------------------------------
# Export GLB
# ---------------------------------------------------------------------------
out_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\rares_low_cost_greenhouse.glb"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"EXPORTED: {out_path} ({size_kb:.2f} KB)")
