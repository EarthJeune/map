"""
Build script for DA-RARES Staff House C (rares_building_21).
Conforms strictly to the 4-vertex footprint in rares_buildings.json and
rares_entrance_22 (-0.98, +6.73) on the North front.
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

MAT_WALL_YELLOW = make_mat("WallPaleYellow", (0.82, 0.80, 0.54, 1.0), roughness=0.82)
MAT_DADO_GREEN  = make_mat("DadoForestGreen", (0.10, 0.30, 0.18, 1.0), roughness=0.82)
MAT_CONCRETE    = make_mat("ConcreteSteps", (0.48, 0.49, 0.46, 1.0), roughness=0.88)
MAT_ROOF_GI     = make_mat("RoofWeatheredGI", (0.145, 0.042, 0.025, 1.0), roughness=0.52, metallic=0.35)
MAT_FASCIA_GRN  = make_mat("FasciaDarkGreen", (0.14, 0.26, 0.18, 1.0), roughness=0.68)
MAT_SOFFIT      = make_mat("SoffitOlive", (0.52, 0.54, 0.48, 1.0), roughness=0.72)
MAT_RAFTER_WOOD = make_mat("RafterWood", (0.38, 0.32, 0.24, 1.0), roughness=0.85)
MAT_DOOR_WHITE  = make_mat("DoorWhite", (0.86, 0.87, 0.85, 1.0), roughness=0.52)
MAT_DOOR_SCREEN = make_mat("DoorScreenGrey", (0.62, 0.65, 0.68, 1.0), roughness=0.48, metallic=0.25)
MAT_GLASS       = make_mat("GlassDark", (0.09, 0.13, 0.16, 1.0), roughness=0.08, metallic=0.25)
MAT_GRILLE_WHT  = make_mat("GrilleWhite", (0.82, 0.83, 0.80, 1.0), roughness=0.42, metallic=0.35)

# ---------------------------------------------------------------------------
# Footprint & Local Frame
# ---------------------------------------------------------------------------
# Exact (E, N) vertices relative to centroid [121.34125735, 14.57575693]
V_RAW = [
    (-6.99, +5.72),  # v0: NW
    (+5.62, +7.17),  # v1: NE
    (+6.84, -5.78),  # v2: SE
    (-5.47, -7.10),  # v3: SW
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
v_mid = 0.5 * (v_min + v_max)

Z_DADO  = 0.58
Z_EAVE  = 2.80
Z_RIDGE = 4.65

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

def add_gable_prism_ns(name, u0, u_ridge, u1, v0, v1, z_eave, z_ridge, mat):
    """Triangular gable prism with ridge running N-S from v0 to v1."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    s0 = [bm.verts.new((*to_en(u0, v0), z_eave)),
          bm.verts.new((*to_en(u1, v0), z_eave)),
          bm.verts.new((*to_en(u_ridge, v0), z_ridge))]
    s1 = [bm.verts.new((*to_en(u0, v1), z_eave)),
          bm.verts.new((*to_en(u1, v1), z_eave)),
          bm.verts.new((*to_en(u_ridge, v1), z_ridge))]
    bm.faces.new([s0[2], s0[1], s0[0]])
    bm.faces.new([s1[0], s1[1], s1[2]])
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new([s0[i], s0[j], s1[j], s1[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mat)
    return obj

def add_roof_slope_ew(name, u_start, u_end, v0, v1, z_start, z_end, thick, mat):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bot = [
        bm.verts.new((*to_en(u_start, v0), z_start)),
        bm.verts.new((*to_en(u_end, v0), z_end)),
        bm.verts.new((*to_en(u_end, v1), z_end)),
        bm.verts.new((*to_en(u_start, v1), z_start)),
    ]
    top = [
        bm.verts.new((*to_en(u_start, v0), z_start + thick)),
        bm.verts.new((*to_en(u_end, v0), z_end + thick)),
        bm.verts.new((*to_en(u_end, v1), z_end + thick)),
        bm.verts.new((*to_en(u_start, v1), z_start + thick)),
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

def add_pilaster(name, uc, vc, z1=Z_EAVE):
    add_uv_box(name + "_d", uc - 0.22, uc + 0.22, vc - 0.22, vc + 0.22, 0.0, Z_DADO, MAT_DADO_GREEN)
    add_uv_box(name + "_y", uc - 0.22, uc + 0.22, vc - 0.22, vc + 0.22, Z_DADO, z1, MAT_WALL_YELLOW)

# ---------------------------------------------------------------------------
# 1. Main Walls, Dado & Pilasters
# ---------------------------------------------------------------------------
add_uv_box("Wall_Dado", u_min, u_max, v_min, v_max, 0.0, Z_DADO, MAT_DADO_GREEN)
add_uv_box("Wall_Upper", u_min, u_max, v_min, v_max, Z_DADO, Z_EAVE, MAT_WALL_YELLOW)

# Horizontal top beam on North & South gables
add_uv_box("Beam_Gable_N", u_min - 0.02, u_max + 0.02, v_max - 0.10, v_max + 0.05, Z_EAVE - 0.22, Z_EAVE, MAT_WALL_YELLOW)
add_uv_box("Beam_Gable_S", u_min - 0.02, u_max + 0.02, v_min - 0.05, v_min + 0.10, Z_EAVE - 0.22, Z_EAVE, MAT_WALL_YELLOW)

# Corner & bay pilasters
for idx, (pu, pv) in enumerate([
    (u_min + 0.18, v_min + 0.18), (u_max - 0.18, v_min + 0.18),
    (u_min + 0.18, v_max - 0.18), (u_max - 0.18, v_max - 0.18),
    (u_mid - 2.10, v_max - 0.16), (u_mid + 2.10, v_max - 0.16),
    (u_min + 0.16, v_mid), (u_max - 0.16, v_mid),
]):
    add_pilaster(f"Pilaster_{idx}", pu, pv)

# ---------------------------------------------------------------------------
# 2. North Front Gable Facade (v = v_max, Entrance at rares_entrance_22)
# ---------------------------------------------------------------------------
# East-of-center white entrance door + 3 white-grilled windows
door_n_u = u_mid + 2.70
add_uv_box("North_Door_Frame", door_n_u - 0.50, door_n_u + 0.50, v_max - 0.02, v_max + 0.05, 0.0, 2.12, MAT_DOOR_WHITE)
add_uv_box("North_Door_Leaf", door_n_u - 0.44, door_n_u + 0.44, v_max, v_max + 0.06, 0.02, 2.06, MAT_DOOR_WHITE)

add_grilled_window("North_Win_E", u_max - 1.55, v_max + 0.02, 1.55, 1.00, 2.10, facing="N", cols=4, rows=4)
add_grilled_window("North_Win_C", u_mid,        v_max + 0.02, 1.65, 1.05, 2.15, facing="N", cols=4, rows=4)
add_grilled_window("North_Win_W", u_min + 2.00, v_max + 0.02, 1.65, 1.25, 2.20, facing="N", cols=4, rows=4)

# ---------------------------------------------------------------------------
# 3. East Flank (u = u_max, IMG_4430.jpg: White Door on 2 Steps + Window)
# ---------------------------------------------------------------------------
add_uv_box("East_Step_1", u_max, u_max + 1.15, v_mid + 0.80, v_mid + 2.65, 0.0, 0.22, MAT_CONCRETE)
add_uv_box("East_Step_2", u_max, u_max + 0.80, v_mid + 0.90, v_mid + 2.55, 0.22, 0.44, MAT_CONCRETE)
add_uv_box("East_Door", u_max - 0.02, u_max + 0.06, v_mid + 1.25, v_mid + 2.15, 0.44, 2.35, MAT_DOOR_WHITE)
add_grilled_window("East_Win_S", u_max + 0.02, v_mid - 1.85, 1.65, 1.15, 2.20, facing="E", cols=4, rows=4)

# ---------------------------------------------------------------------------
# 4. West Flank (u = u_min, Back.jpg & Right Side Angle.jpg: 3 Grilled Windows)
# ---------------------------------------------------------------------------
add_grilled_window("West_Win_N", u_min - 0.02, v_max - 2.30, 1.95, 1.10, 2.20, facing="W", cols=4, rows=4)
add_grilled_window("West_Win_C", u_min - 0.02, v_mid + 0.30, 1.20, 1.35, 2.20, facing="W", cols=3, rows=3)
add_grilled_window("West_Win_S", u_min - 0.02, v_min + 2.30, 1.95, 1.10, 2.20, facing="W", cols=4, rows=4)

# ---------------------------------------------------------------------------
# 5. South Back Gable (v = v_min, Right Side Angle Close Up.jpg: Screen Door + 2 Steps)
# ---------------------------------------------------------------------------
add_uv_box("South_Step_1", u_mid - 0.80, u_mid + 0.80, v_min - 1.10, v_min, 0.0, 0.22, MAT_CONCRETE)
add_uv_box("South_Step_2", u_mid - 0.65, u_mid + 0.65, v_min - 0.75, v_min, 0.22, 0.44, MAT_CONCRETE)
add_uv_box("South_Screen_Door", u_mid - 0.45, u_mid + 0.45, v_min - 0.05, v_min + 0.02, 0.44, 2.32, MAT_DOOR_SCREEN)

# ---------------------------------------------------------------------------
# 6. N-S Gable Roof with Overhangs & Exposed Rafters
# ---------------------------------------------------------------------------
add_gable_prism_ns("Gable_Yellow_Walls", u_min, u_mid, u_max, v_min, v_max, Z_EAVE - 0.02, Z_RIDGE - 0.05, MAT_WALL_YELLOW)

ov_u = 1.05
ov_v = 0.95
half_w = (u_max - u_min) * 0.5
drop = (Z_RIDGE - Z_EAVE) * ((half_w + ov_u) / half_w)
z_roof_eave = Z_RIDGE - drop

# West & East roof slopes
add_roof_slope_ew("Roof_Slope_W", u_min - ov_u, u_mid, v_min - ov_v, v_max + ov_v, z_roof_eave, Z_RIDGE, 0.06, MAT_ROOF_GI)
add_roof_slope_ew("Roof_Slope_E", u_mid, u_max + ov_u, v_min - ov_v, v_max + ov_v, Z_RIDGE, z_roof_eave, 0.06, MAT_ROOF_GI)

# Ridge cap
add_uv_box("Roof_Ridge", u_mid - 0.12, u_mid + 0.12, v_min - ov_v, v_max + ov_v, Z_RIDGE + 0.02, Z_RIDGE + 0.10, MAT_ROOF_GI)

# Exposed timber rafters along East & West eaves
for i in range(6):
    rv = v_min + (v_max - v_min) * (i / 5.0)
    add_uv_box(f"Rafter_W_{i}", u_min - ov_u + 0.05, u_min, rv - 0.04, rv + 0.04, z_roof_eave - 0.05, Z_EAVE, MAT_RAFTER_WOOD)
    add_uv_box(f"Rafter_E_{i}", u_max, u_max + ov_u - 0.05, rv - 0.04, rv + 0.04, z_roof_eave - 0.05, Z_EAVE, MAT_RAFTER_WOOD)

# ---------------------------------------------------------------------------
# Export GLB
# ---------------------------------------------------------------------------
out_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\rares_staff_house_c.glb"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"EXPORTED: {out_path} ({size_kb:.2f} KB)")
