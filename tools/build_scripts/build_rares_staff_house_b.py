"""
Build script for DA-RARES Staff House B (rares_building_20).
Conforms strictly to the 4-vertex footprint in rares_buildings.json and
rares_entrance_21 (-0.65, +5.07) on the North front.
"""
import os
import bpy
import bmesh
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------
def make_mat(name, rgba, roughness=0.75, metallic=0.0):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return m

MAT_WALL_MINT   = make_mat("WallMintGreen", (0.45, 0.78, 0.49, 1.0), roughness=0.80)
MAT_DADO_DARK   = make_mat("DadoForestGreen", (0.11, 0.32, 0.16, 1.0), roughness=0.82)
MAT_STRIPE_WHT  = make_mat("StripeWhite", (0.88, 0.89, 0.87, 1.0), roughness=0.72)
MAT_CONCRETE    = make_mat("ConcretePorch", (0.48, 0.49, 0.47, 1.0), roughness=0.88)
MAT_ROOF_GI     = make_mat("RoofWeatheredGI", (0.055, 0.095, 0.050, 1.0), roughness=0.50, metallic=0.35)
MAT_FASCIA_GRN  = make_mat("FasciaDarkGreen", (0.14, 0.28, 0.18, 1.0), roughness=0.65)
MAT_SOFFIT      = make_mat("SoffitOliveGrey", (0.56, 0.58, 0.52, 1.0), roughness=0.70)
MAT_DOOR_WHITE  = make_mat("DoorWhite", (0.86, 0.87, 0.85, 1.0), roughness=0.50)
MAT_GLASS       = make_mat("GlassDark", (0.09, 0.13, 0.16, 1.0), roughness=0.08, metallic=0.25)
MAT_GRILLE_WHT  = make_mat("GrilleWhite", (0.84, 0.85, 0.82, 1.0), roughness=0.40, metallic=0.35)
MAT_AC_WHITE    = make_mat("ACUnitWhite", (0.86, 0.86, 0.84, 1.0), roughness=0.42)
MAT_AC_GRILLE   = make_mat("ACGrilleDark", (0.18, 0.19, 0.20, 1.0), roughness=0.60)

# ---------------------------------------------------------------------------
# Footprint & Local Frame
# ---------------------------------------------------------------------------
# Exact (E, N) vertices relative to centroid [121.34110878, 14.57575607]
V_RAW = [
    (+6.67, -4.11),  # v0: SE
    (+5.59, +5.61),  # v1: NE
    (-6.66, +4.06),  # v2: NW
    (-5.59, -5.56),  # v3: SW
]

v3_vec = Vector(V_RAW[3])
v0_vec = Vector(V_RAW[0])
dir_u = (v0_vec - v3_vec).normalized()  # +u = East
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
v_mid = 0.5 * (v_min + v_max)

Z_DADO   = 1.15
Z_STRIPE = 1.30
Z_EAVE   = 2.85
Z_RIDGE  = 4.20

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

def add_gable_prism_ew(name, u0, u1, v0, v_ridge, v1, z_eave, z_ridge, mat):
    """Triangular gable prism with ridge running E-W from u0 to u1."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    s0 = [bm.verts.new((*to_en(u0, v0), z_eave)),
          bm.verts.new((*to_en(u0, v1), z_eave)),
          bm.verts.new((*to_en(u0, v_ridge), z_ridge))]
    s1 = [bm.verts.new((*to_en(u1, v0), z_eave)),
          bm.verts.new((*to_en(u1, v1), z_eave)),
          bm.verts.new((*to_en(u1, v_ridge), z_ridge))]
    bm.faces.new([s0[0], s0[1], s0[2]])
    bm.faces.new([s1[2], s1[1], s1[0]])
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new([s0[i], s0[j], s1[j], s1[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mat)
    return obj

def add_roof_slope_ns(name, u0, u1, v_start, v_end, z_start, z_end, thick, mat):
    """Sloped roof slab from (v_start, z_start) to (v_end, z_end)."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bot = [
        bm.verts.new((*to_en(u0, v_start), z_start)),
        bm.verts.new((*to_en(u1, v_start), z_start)),
        bm.verts.new((*to_en(u1, v_end), z_end)),
        bm.verts.new((*to_en(u0, v_end), z_end)),
    ]
    top = [
        bm.verts.new((*to_en(u0, v_start), z_start + thick)),
        bm.verts.new((*to_en(u1, v_start), z_start + thick)),
        bm.verts.new((*to_en(u1, v_end), z_end + thick)),
        bm.verts.new((*to_en(u0, v_end), z_end + thick)),
    ]
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

def add_grilled_window(name, u_c, v_c, width, z0, z1, facing="N", cols=4, rows=4):
    d = 0.06
    if facing in ("N", "S"):
        u0, u1 = u_c - width*0.5, u_c + width*0.5
        v0, v1 = v_c - d*0.5, v_c + d*0.5
        add_uv_box(name + "_g", u0+0.02, u1-0.02, v0+0.01, v1-0.01, z0+0.02, z1-0.02, MAT_GLASS)
        # Perimeter frame
        add_uv_box(name + "_fb", u0, u1, v0, v1, z0, z0+0.03, MAT_GRILLE_WHT)
        add_uv_box(name + "_ft", u0, u1, v0, v1, z1-0.03, z1, MAT_GRILLE_WHT)
        add_uv_box(name + "_fl", u0, u0+0.03, v0, v1, z0, z1, MAT_GRILLE_WHT)
        add_uv_box(name + "_fr", u1-0.03, u1, v0, v1, z0, z1, MAT_GRILLE_WHT)
        for c in range(1, cols):
            uc = u0 + (u1 - u0)*(c/cols)
            add_uv_box(f"{name}_vc{c}", uc-0.012, uc+0.012, v0, v1, z0, z1, MAT_GRILLE_WHT)
        for r in range(1, rows):
            zr = z0 + (z1 - z0)*(r/rows)
            add_uv_box(f"{name}_hr{r}", u0, u1, v0, v1, zr-0.012, zr+0.012, MAT_GRILLE_WHT)
    else:
        v0, v1 = v_c - width*0.5, v_c + width*0.5
        u0, u1 = u_c - d*0.5, u_c + d*0.5
        add_uv_box(name + "_g", u0+0.01, u1-0.01, v0+0.02, v1-0.02, z0+0.02, z1-0.02, MAT_GLASS)
        add_uv_box(name + "_fb", u0, u1, v0, v1, z0, z0+0.03, MAT_GRILLE_WHT)
        add_uv_box(name + "_ft", u0, u1, v0, v1, z1-0.03, z1, MAT_GRILLE_WHT)
        add_uv_box(name + "_fl", u0, u1, v0, v0+0.03, z0, z1, MAT_GRILLE_WHT)
        add_uv_box(name + "_fr", u0, u1, v1-0.03, v1, z0, z1, MAT_GRILLE_WHT)
        for c in range(1, cols):
            vc = v0 + (v1 - v0)*(c/cols)
            add_uv_box(f"{name}_vc{c}", u0, u1, vc-0.012, vc+0.012, z0, z1, MAT_GRILLE_WHT)
        for r in range(1, rows):
            zr = z0 + (z1 - z0)*(r/rows)
            add_uv_box(f"{name}_hr{r}", u0, u1, v0, v1, zr-0.012, zr+0.012, MAT_GRILLE_WHT)

def add_pilaster(name, uc, vc):
    add_uv_box(name + "_d", uc - 0.22, uc + 0.22, vc - 0.22, vc + 0.22, 0.0, Z_DADO, MAT_DADO_DARK)
    add_uv_box(name + "_s", uc - 0.22, uc + 0.22, vc - 0.22, vc + 0.22, Z_DADO, Z_STRIPE, MAT_STRIPE_WHT)
    add_uv_box(name + "_m", uc - 0.22, uc + 0.22, vc - 0.22, vc + 0.22, Z_STRIPE, Z_EAVE, MAT_WALL_MINT)

# ---------------------------------------------------------------------------
# 1. Main Walls (Dark Green Dado, White Stripe, Mint Green Upper) & Pilasters
# ---------------------------------------------------------------------------
add_uv_box("Wall_Dado", u_min, u_max, v_min, v_max, 0.0, Z_DADO, MAT_DADO_DARK)
add_uv_box("Wall_Stripe", u_min, u_max, v_min, v_max, Z_DADO, Z_STRIPE, MAT_STRIPE_WHT)
add_uv_box("Wall_Upper", u_min, u_max, v_min, v_max, Z_STRIPE, Z_EAVE, MAT_WALL_MINT)

# Corner & intermediate pilasters
for idx, (pu, pv) in enumerate([
    (u_min + 0.18, v_min + 0.18), (u_max - 0.18, v_min + 0.18),
    (u_min + 0.18, v_max - 0.18), (u_max - 0.18, v_max - 0.18),
    (u_min + 0.16, v_mid), (u_max - 0.16, v_mid),
    (u_mid - 2.30, v_max - 0.16), (u_mid + 2.30, v_max - 0.16),
    (u_mid - 2.30, v_min + 0.16), (u_mid + 2.30, v_min + 0.16),
]):
    add_pilaster(f"Pilaster_{idx}", pu, pv)

# ---------------------------------------------------------------------------
# 2. North Front Facade (v = v_max, Entrance at rares_entrance_21)
# ---------------------------------------------------------------------------
# Low concrete front entrance slab
add_uv_box("Front_Porch_Slab", u_mid - 3.60, u_mid - 0.50, v_max, v_max + 1.25, 0.0, 0.14, MAT_CONCRETE)

# White 6-panel entrance door
door_u = u_mid - 1.55
add_uv_box("Front_Door_Frame", door_u - 0.52, door_u + 0.52, v_max - 0.02, v_max + 0.05, 0.14, 2.22, MAT_DOOR_WHITE)
add_uv_box("Front_Door_Leaf", door_u - 0.45, door_u + 0.45, v_max, v_max + 0.07, 0.16, 2.16, MAT_DOOR_WHITE)

# 3 Large White-Grilled Front Windows
add_grilled_window("Front_Win_W", u_min + 1.75, v_max + 0.02, 1.95, 1.32, 2.42, facing="N", cols=4, rows=4)
add_grilled_window("Front_Win_C", u_mid + 0.55, v_max + 0.02, 1.95, 1.32, 2.42, facing="N", cols=4, rows=4)
add_grilled_window("Front_Win_E", u_max - 1.75, v_max + 0.02, 1.95, 1.32, 2.42, facing="N", cols=4, rows=4)

# ---------------------------------------------------------------------------
# 3. West Flank (Right Side.jpg: White Door on 2 Concrete Steps)
# ---------------------------------------------------------------------------
add_uv_box("West_Step_1", u_min - 1.05, u_min, v_mid - 2.45, v_mid - 0.55, 0.0, 0.18, MAT_CONCRETE)
add_uv_box("West_Step_2", u_min - 0.65, u_min, v_mid - 2.25, v_mid - 0.75, 0.18, 0.36, MAT_CONCRETE)
add_uv_box("West_Door", u_min - 0.06, u_min + 0.02, v_mid - 1.95, v_mid - 1.05, 0.36, 2.32, MAT_DOOR_WHITE)

# ---------------------------------------------------------------------------
# 4. East Flank (IMG_4425.jpg: 1 Large Grilled Window)
# ---------------------------------------------------------------------------
add_grilled_window("East_Win_N", u_max + 0.02, v_mid + 2.15, 2.20, 1.32, 2.42, facing="E", cols=4, rows=4)

# ---------------------------------------------------------------------------
# 5. South Back Wall (Back.jpg: 2 Large Windows, High Vent, 2 Window ACs)
# ---------------------------------------------------------------------------
add_grilled_window("South_Win_W", u_min + 1.85, v_min - 0.02, 2.40, 1.32, 2.42, facing="S", cols=5, rows=4)
add_grilled_window("South_Win_E", u_max - 1.85, v_min - 0.02, 2.40, 1.32, 2.42, facing="S", cols=5, rows=4)
add_grilled_window("South_Vent_C", u_mid, v_min - 0.02, 0.80, 1.95, 2.42, facing="S", cols=2, rows=2)

# 2 Window-mounted AC units below dado
for idx, acu in enumerate((u_min + 2.10, u_max - 2.10)):
    add_uv_box(f"South_AC_{idx}", acu - 0.35, acu + 0.35, v_min - 0.42, v_min, 0.75, 1.22, MAT_AC_WHITE)
    add_uv_box(f"South_AC_G_{idx}", acu - 0.30, acu + 0.30, v_min - 0.44, v_min - 0.41, 0.80, 1.16, MAT_AC_GRILLE)

# ---------------------------------------------------------------------------
# 6. E-W Gable Roof with Deep Overhangs & Soffits
# ---------------------------------------------------------------------------
# Mint-green gable end triangles
add_gable_prism_ew("Gable_Walls", u_min, u_max, v_min, v_mid, v_max, Z_EAVE - 0.02, Z_RIDGE - 0.05, MAT_WALL_MINT)

# Deep overhangs: 1.30m on North/South eaves, 0.85m on East/West gables
ov_u = 0.85
ov_v = 1.30
half_d = (v_max - v_min) * 0.5
drop = (Z_RIDGE - Z_EAVE) * ((half_d + ov_v) / half_d)
z_roof_eave = Z_RIDGE - drop

# Flat soffits under North & South overhangs
add_uv_box("Soffit_N", u_min - ov_u, u_max + ov_u, v_max, v_max + ov_v, z_roof_eave - 0.04, z_roof_eave + 0.02, MAT_SOFFIT)
add_uv_box("Soffit_S", u_min - ov_u, u_max + ov_u, v_min - ov_v, v_min, z_roof_eave - 0.04, z_roof_eave + 0.02, MAT_SOFFIT)

# North & South roof slopes
add_roof_slope_ns("Roof_Slope_N", u_min - ov_u, u_max + ov_u, v_mid, v_max + ov_v, Z_RIDGE, z_roof_eave, 0.06, MAT_ROOF_GI)
add_roof_slope_ns("Roof_Slope_S", u_min - ov_u, u_max + ov_u, v_min - ov_v, v_mid, z_roof_eave, Z_RIDGE, 0.06, MAT_ROOF_GI)

# Dark green fascia boards along North & South eaves
add_uv_box("Fascia_N", u_min - ov_u, u_max + ov_u, v_max + ov_v - 0.04, v_max + ov_v + 0.02, z_roof_eave - 0.10, z_roof_eave + 0.06, MAT_FASCIA_GRN)
add_uv_box("Fascia_S", u_min - ov_u, u_max + ov_u, v_min - ov_v - 0.02, v_min - ov_v + 0.04, z_roof_eave - 0.10, z_roof_eave + 0.06, MAT_FASCIA_GRN)

# Ridge cap
add_uv_box("Roof_Ridge", u_min - ov_u, u_max + ov_u, v_mid - 0.12, v_mid + 0.12, Z_RIDGE + 0.02, Z_RIDGE + 0.10, MAT_ROOF_GI)

# ---------------------------------------------------------------------------
# Export GLB
# ---------------------------------------------------------------------------
out_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\rares_staff_house_b.glb"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"EXPORTED: {out_path} ({size_kb:.2f} KB)")
