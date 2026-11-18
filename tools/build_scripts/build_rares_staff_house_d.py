"""
Build script for DA-RARES Staff House D (rares_building_23).
Two-wing split-level opposing mono-pitch roof layout conforming to the 7-vertex
footprint in rares_buildings.json and rares_entrance_25 (-5.06, +0.64) on the West front.
"""
import os
import bpy
import bmesh
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------
def make_mat(name, rgba, roughness=0.75, metallic=0.0, alpha_blend=False):
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

MAT_WALL_YELLOW = make_mat("WallCreamYellow", (0.83, 0.80, 0.56, 1.0), roughness=0.82)
MAT_DADO_GREEN  = make_mat("DadoDarkGreen", (0.09, 0.27, 0.16, 1.0), roughness=0.84)
MAT_CONCRETE    = make_mat("ConcreteSlab", (0.48, 0.49, 0.47, 1.0), roughness=0.88)
MAT_ROOF_GI     = make_mat("RoofCorrugatedGI", (0.34, 0.36, 0.32, 1.0), roughness=0.52, metallic=0.45)
MAT_FASCIA_GRN  = make_mat("FasciaGreen", (0.14, 0.32, 0.20, 1.0), roughness=0.68)
MAT_SOFFIT      = make_mat("SoffitCream", (0.78, 0.77, 0.71, 1.0), roughness=0.72)
MAT_DOOR_WOOD   = make_mat("DoorWood", (0.38, 0.25, 0.15, 1.0), roughness=0.65)
MAT_DOOR_WHITE  = make_mat("DoorWhite", (0.84, 0.85, 0.82, 1.0), roughness=0.55)
MAT_GLASS       = make_mat("GlassDark", (0.08, 0.12, 0.15, 1.0), roughness=0.08, metallic=0.25)
MAT_GRILLE_DARK = make_mat("GrilleDarkSteel", (0.16, 0.17, 0.18, 1.0), roughness=0.45, metallic=0.55)
MAT_STEEL_PIPE  = make_mat("SteelPost", (0.58, 0.60, 0.62, 1.0), roughness=0.35, metallic=0.80)
MAT_SHADE_NET   = make_mat("PorchShadeNet", (0.08, 0.08, 0.08, 0.65), roughness=0.88, alpha_blend=True)

# ---------------------------------------------------------------------------
# Footprint & Local Frame
# ---------------------------------------------------------------------------
# Exact (E, N) vertices relative to centroid [121.34180481, 14.57600488]
V_RAW = [
    (+1.44, +5.32),  # v0: N central spine
    (-4.03, +6.00),  # v1: NW corner
    (-5.63, -4.14),  # v2: SW corner
    (+0.02, -5.06),  # v3: S central spine
    (+3.04, -5.45),  # v4: SE corner
    (+4.04, +1.46),  # v5: NE corner of East wing
    (+1.12, +1.87),  # v6: recessed NE inner corner
]

# Local basis aligned to v2 -> v3 (West-to-East)
v2_vec = Vector(V_RAW[2])
v3_vec = Vector(V_RAW[3])
dir_u = (v3_vec - v2_vec).normalized()  # +u = East
dir_v = Vector((-dir_u.y, dir_u.x))     # +v = North

def to_uv(e, n):
    p = Vector((e, n))
    return (p.dot(dir_u), p.dot(dir_v))

def to_en(u, v):
    p = dir_u * u + dir_v * v
    return (p.x, p.y)

UV_VERTS = [to_uv(e, n) for (e, n) in V_RAW]
# West wing bounds (v0, v1, v2, v3)
u_w = 0.5 * (UV_VERTS[1][0] + UV_VERTS[2][0])
u_sp = 0.5 * (UV_VERTS[0][0] + UV_VERTS[3][0])
v_s = 0.5 * (UV_VERTS[2][1] + UV_VERTS[3][1])
v_n = 0.5 * (UV_VERTS[0][1] + UV_VERTS[1][1])
# East wing bounds (v3, v4, v5, v6)
u_e = 0.5 * (UV_VERTS[4][0] + UV_VERTS[5][0])
v_e_n = 0.5 * (UV_VERTS[5][1] + UV_VERTS[6][1])
v_e_s = UV_VERTS[4][1]

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

def add_sloped_uv_prism(name, u0, u1, v0, v1, z_fn_bot, z_fn_top, mat):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    corners = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    bot = [bm.verts.new((*to_en(u, v), z_fn_bot(u, v))) for (u, v) in corners]
    top = [bm.verts.new((*to_en(u, v), z_fn_top(u, v))) for (u, v) in corners]
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

def add_grilled_window(name, u_c, v_c, width, z0, z1, facing="W", cols=4, rows=4):
    d = 0.06
    if facing in ("N", "S"):
        u0, u1 = u_c - width*0.5, u_c + width*0.5
        v0, v1 = v_c - d*0.5, v_c + d*0.5
        add_uv_box(name + "_g", u0+0.02, u1-0.02, v0+0.01, v1-0.01, z0+0.02, z1-0.02, MAT_GLASS)
        add_uv_box(name + "_fb", u0, u1, v0, v1, z0, z0+0.03, MAT_GRILLE_DARK)
        add_uv_box(name + "_ft", u0, u1, v0, v1, z1-0.03, z1, MAT_GRILLE_DARK)
        add_uv_box(name + "_fl", u0, u0+0.03, v0, v1, z0, z1, MAT_GRILLE_DARK)
        add_uv_box(name + "_fr", u1-0.03, u1, v0, v1, z0, z1, MAT_GRILLE_DARK)
        for c in range(1, cols):
            uc = u0 + (u1 - u0)*(c/cols)
            add_uv_box(f"{name}_vc{c}", uc-0.012, uc+0.012, v0, v1, z0, z1, MAT_GRILLE_DARK)
        for r in range(1, rows):
            zr = z0 + (z1 - z0)*(r/rows)
            add_uv_box(f"{name}_hr{r}", u0, u1, v0, v1, zr-0.012, zr+0.012, MAT_GRILLE_DARK)
    else:
        v0, v1 = v_c - width*0.5, v_c + width*0.5
        u0, u1 = u_c - d*0.5, u_c + d*0.5
        add_uv_box(name + "_g", u0+0.01, u1-0.01, v0+0.02, v1-0.02, z0+0.02, z1-0.02, MAT_GLASS)
        add_uv_box(name + "_fb", u0, u1, v0, v1, z0, z0+0.03, MAT_GRILLE_DARK)
        add_uv_box(name + "_ft", u0, u1, v0, v1, z1-0.03, z1, MAT_GRILLE_DARK)
        add_uv_box(name + "_fl", u0, u1, v0, v0+0.03, z0, z1, MAT_GRILLE_DARK)
        add_uv_box(name + "_fr", u0, u1, v1-0.03, v1, z0, z1, MAT_GRILLE_DARK)
        for c in range(1, cols):
            vc = v0 + (v1 - v0)*(c/cols)
            add_uv_box(f"{name}_vc{c}", u0, u1, vc-0.012, vc+0.012, z0, z1, MAT_GRILLE_DARK)
        for r in range(1, rows):
            zr = z0 + (z1 - z0)*(r/rows)
            add_uv_box(f"{name}_hr{r}", u0, u1, v0, v1, zr-0.012, zr+0.012, MAT_GRILLE_DARK)

# ---------------------------------------------------------------------------
# 1. West Wing (v0-v1-v2-v3): Tall Mono-Pitch Roof rising West -> Spine
# ---------------------------------------------------------------------------
Z_DADO = 0.55

def west_z(u, v):
    t = (u - u_w) / (u_sp - u_w)
    return 2.65 + t * 1.65  # 2.65m at West eave -> 4.30m at Spine

add_uv_box("West_Dado", u_w, u_sp, v_s, v_n, 0.0, Z_DADO, MAT_DADO_GREEN)
add_sloped_uv_prism("West_Body", u_w, u_sp, v_s, v_n, lambda u, v: Z_DADO, west_z, MAT_WALL_YELLOW)

# West Wing Roof with overhangs (0.80m W, 0.70m N/S, 0.10m Spine)
add_sloped_uv_prism("West_Soffit", u_w - 0.80, u_sp + 0.05, v_s - 0.70, v_n + 0.70,
                    lambda u, v: west_z(u, v) - 0.05, west_z, MAT_SOFFIT)
add_sloped_uv_prism("West_Roof", u_w - 0.82, u_sp + 0.08, v_s - 0.72, v_n + 0.72,
                    west_z, lambda u, v: west_z(u, v) + 0.12, MAT_ROOF_GI)
# Green fascia along West eave & North/South rakes
add_uv_box("West_Fascia_W", u_w - 0.84, u_w - 0.78, v_s - 0.72, v_n + 0.72, 2.30, 2.52, MAT_FASCIA_GRN)

# West Front Facade (v1 -> v2, aligned with rares_entrance_25)
# Concrete landing slab at entrance door
add_uv_box("Front_Landing_Slab", u_w - 1.35, u_w, v_s + 2.80, v_s + 5.60, 0.0, 0.12, MAT_CONCRETE)
# Wooden front door
add_uv_box("Front_Door", u_w - 0.05, u_w + 0.03, v_s + 4.10, v_s + 5.00, 0.12, 2.15, MAT_DOOR_WOOD)
# 3 Grilled windows on West Front
add_grilled_window("Front_Win_N", u_w - 0.02, v_n - 2.65, 2.35, 1.05, 2.15, facing="W", cols=5, rows=4)
add_grilled_window("Front_Win_S1", u_w - 0.02, v_s + 2.75, 1.45, 1.15, 2.15, facing="W", cols=3, rows=4)
add_grilled_window("Front_Win_S2", u_w - 0.02, v_s + 0.95, 1.05, 1.25, 2.15, facing="W", cols=2, rows=3)

# Corner pilaster at NW
add_uv_box("Pilaster_NW_D", u_w - 0.04, u_w + 0.42, v_n - 0.42, v_n + 0.04, 0.0, Z_DADO, MAT_DADO_GREEN)
add_uv_box("Pilaster_NW_Y", u_w - 0.04, u_w + 0.42, v_n - 0.42, v_n + 0.04, Z_DADO, 2.68, MAT_WALL_YELLOW)

# Attached West Front Shade-Net Canopy on 3 steel posts (Front.jpg & Front Close up.jpg)
can_u0, can_u1 = u_w - 2.55, u_w - 0.75
can_v0, can_v1 = v_s + 1.20, v_n - 2.20
add_sloped_uv_prism("Front_Shade_Net", can_u0, can_u1, can_v0, can_v1,
                    lambda u, v: 2.05 + ((u - can_u0)/(can_u1 - can_u0))*0.35,
                    lambda u, v: 2.07 + ((u - can_u0)/(can_u1 - can_u0))*0.35, MAT_SHADE_NET)
for idx, pv in enumerate((can_v0 + 0.25, 0.5*(can_v0 + can_v1), can_v1 - 0.25)):
    add_uv_box(f"Canopy_Post_{idx}", can_u0, can_u0 + 0.06, pv - 0.03, pv + 0.03, 0.0, 2.06, MAT_STEEL_PIPE)

# West Wing North Wall (v0 -> v1, Left Side of the Building.jpg)
add_grilled_window("WestWing_North_Win", u_w + 1.65, v_n + 0.02, 1.85, 1.05, 2.15, facing="N", cols=4, rows=4)
# West Wing South Wall (v2 -> v3, Back.jpg)
add_grilled_window("WestWing_South_Win", 0.5*(u_w + u_sp), v_s - 0.02, 1.55, 1.15, 2.15, facing="S", cols=4, rows=4)

# ---------------------------------------------------------------------------
# 2. East Wing (v3-v4-v5-v6): Lower Opposing Mono-Pitch Roof Spine -> East
# ---------------------------------------------------------------------------
def east_z(u, v):
    t = (u - u_sp) / (u_e - u_sp)
    return 3.72 - t * 1.12  # 3.72m at Spine -> 2.60m at East eave

add_uv_box("East_Dado", u_sp, u_e, v_e_s, v_e_n, 0.0, Z_DADO, MAT_DADO_GREEN)
add_sloped_uv_prism("East_Body", u_sp, u_e, v_e_s, v_e_n, lambda u, v: Z_DADO, east_z, MAT_WALL_YELLOW)

# Green upper spine fascia strip seen in IMG_4458.jpg & Right angle of back.jpg
add_uv_box("Spine_Fascia_Band", u_sp - 0.05, u_sp + 0.08, v_e_s - 0.65, v_e_n + 0.65, 3.65, 3.92, MAT_FASCIA_GRN)

# East Wing Roof with overhangs
add_sloped_uv_prism("East_Soffit", u_sp - 0.05, u_e + 0.72, v_e_s - 0.65, v_e_n + 0.65,
                    lambda u, v: east_z(u, v) - 0.05, east_z, MAT_SOFFIT)
add_sloped_uv_prism("East_Roof", u_sp - 0.08, u_e + 0.75, v_e_s - 0.68, v_e_n + 0.68,
                    east_z, lambda u, v: east_z(u, v) + 0.12, MAT_ROOF_GI)

# NE Recessed Awning in v0-v6 notch (IMG_4458.jpg)
add_sloped_uv_prism("NE_Recess_Awning", u_sp - 0.05, u_e + 0.25, v_e_n, v_e_n + 1.55,
                    lambda u, v: 2.35 + ((v_e_n + 1.55 - v)/1.55)*0.55,
                    lambda u, v: 2.42 + ((v_e_n + 1.55 - v)/1.55)*0.55, MAT_ROOF_GI)
add_grilled_window("NE_Win_Recessed", u_sp + 1.55, v_e_n + 0.02, 1.55, 1.10, 2.05, facing="N", cols=4, rows=3)
add_grilled_window("NE_Win_Spine", u_sp + 0.02, v_e_n + 1.65, 2.15, 1.05, 2.05, facing="E", cols=5, rows=4)

# East Flank Window (Right angle of back.jpg)
add_grilled_window("East_Flank_Win", u_e + 0.02, 0.5*(v_e_s + v_e_n), 1.95, 1.05, 2.15, facing="E", cols=4, rows=4)

# South Rear Porch Awning & Door (Right angle of back.jpg)
add_uv_box("South_Rear_Door", u_sp + 0.65, u_sp + 1.45, v_e_s - 0.05, v_e_s + 0.02, 0.10, 2.10, MAT_DOOR_WHITE)
add_grilled_window("South_Rear_Vent", u_sp + 1.95, v_e_s - 0.02, 0.65, 1.55, 2.05, facing="S", cols=2, rows=2)
add_sloped_uv_prism("South_Porch_Awning", u_sp - 0.05, u_sp + 2.35, v_e_s - 1.35, v_e_s,
                    lambda u, v: 2.25 + ((v - (v_e_s - 1.35))/1.35)*0.50,
                    lambda u, v: 2.32 + ((v - (v_e_s - 1.35))/1.35)*0.50, MAT_ROOF_GI)
add_uv_box("South_Awning_Post", u_sp + 2.25, u_sp + 2.31, v_e_s - 1.30, v_e_s - 1.24, 0.0, 2.26, MAT_STEEL_PIPE)

# ---------------------------------------------------------------------------
# Export GLB
# ---------------------------------------------------------------------------
out_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\rares_staff_house_d.glb"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"EXPORTED: {out_path} ({size_kb:.2f} KB)")

