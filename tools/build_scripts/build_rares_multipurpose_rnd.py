"""
Build script for DA-RARES Multipurpose R&D Building (rares_building_17).
Conforms strictly to the 8-vertex footprint in rares_buildings.json and
rares_entrance_17 (-3.59, +0.86) on the West grand stairs/portico facade.
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

MAT_WALL_WHITE  = make_mat("WallWhite", (0.86, 0.87, 0.84, 1.0), roughness=0.80)
MAT_MINT_GREEN  = make_mat("TrimMintGreen", (0.42, 0.72, 0.42, 1.0), roughness=0.70)
MAT_TEAL_BASE   = make_mat("BaseTealGreen", (0.14, 0.43, 0.35, 1.0), roughness=0.75)
MAT_CONCRETE    = make_mat("ConcreteGrey", (0.50, 0.51, 0.49, 1.0), roughness=0.88)
MAT_VERANDA_WOOD= make_mat("VerandaTileWood", (0.52, 0.40, 0.28, 1.0), roughness=0.58)
MAT_STAIR_GREEN = make_mat("RearStairGreen", (0.18, 0.50, 0.36, 1.0), roughness=0.65)
MAT_ROOF_RED    = make_mat("RoofCrimsonRed", (0.52, 0.14, 0.16, 1.0), roughness=0.42, metallic=0.35)
MAT_SOFFIT      = make_mat("SoffitCream", (0.78, 0.77, 0.71, 1.0), roughness=0.68)
MAT_GUTTER      = make_mat("GutterSilver", (0.72, 0.74, 0.75, 1.0), roughness=0.32, metallic=0.65)
MAT_FRAME_DARK  = make_mat("FrameDarkBronze", (0.09, 0.09, 0.10, 1.0), roughness=0.35, metallic=0.30)
MAT_GLASS       = make_mat("GlassDark", (0.07, 0.12, 0.16, 1.0), roughness=0.06, metallic=0.30)
MAT_DOOR_WOOD   = make_mat("RearDoorWood", (0.36, 0.24, 0.15, 1.0), roughness=0.65)
MAT_STEEL       = make_mat("StainlessSteel", (0.75, 0.77, 0.79, 1.0), roughness=0.22, metallic=0.88)
MAT_AC_WHITE    = make_mat("ACWhite", (0.88, 0.88, 0.86, 1.0), roughness=0.40)

# ---------------------------------------------------------------------------
# Footprint & Local Frame
# ---------------------------------------------------------------------------
# Exact (E, N) vertices relative to centroid [121.34102373, 14.57611083]
V_RAW = [
    (-1.64,  +6.77),  # v0: NW recessed inner
    (-3.48,  +7.25),  # v1: NW portico outer
    (-6.39,  -4.91),  # v2: SW portico outer
    (-4.36,  -5.33),  # v3: SW recessed inner
    (-5.52, -10.02),  # v4: SW main
    (+8.39, -13.33),  # v5: SE main
    (+13.49, +8.20),  # v6: NE main
    (-0.50, +11.37),  # v7: NW main
]

# Local basis aligned to South main edge (v4 -> v5)
v4_vec = Vector(V_RAW[4])
v5_vec = Vector(V_RAW[5])
dir_u = (v5_vec - v4_vec).normalized()  # +u = East-ish (back)
dir_v = Vector((-dir_u.y, dir_u.x))     # +v = North-ish (left when facing front)

def to_uv(e, n):
    p = Vector((e, n))
    return (p.dot(dir_u), p.dot(dir_v))

def to_en(u, v):
    p = dir_u * u + dir_v * v
    return (p.x, p.y)

UV_VERTS = [to_uv(e, n) for (e, n) in V_RAW]
# Main block bounds (v4, v5, v6, v7)
u_main_w = 0.5 * (UV_VERTS[4][0] + UV_VERTS[7][0])
u_main_e = 0.5 * (UV_VERTS[5][0] + UV_VERTS[6][0])
v_main_s = 0.5 * (UV_VERTS[4][1] + UV_VERTS[5][1])
v_main_n = 0.5 * (UV_VERTS[6][1] + UV_VERTS[7][1])
# Portico outer bounds (v1, v2)
u_port_w = 0.5 * (UV_VERTS[1][0] + UV_VERTS[2][0])
v_port_s = UV_VERTS[2][1]
v_port_n = UV_VERTS[1][1]
v_port_mid = 0.5 * (v_port_s + v_port_n)

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

def add_hip_roof(name, u0, u1, v0, v1, z_eave, z_ridge, ridge_v0, ridge_v1, mat):
    """Watertight hip roof with N-S ridge along u_mid from ridge_v0 to ridge_v1."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    um = 0.5 * (u0 + u1)
    c0 = bm.verts.new((*to_en(u0, v0), z_eave))
    c1 = bm.verts.new((*to_en(u1, v0), z_eave))
    c2 = bm.verts.new((*to_en(u1, v1), z_eave))
    c3 = bm.verts.new((*to_en(u0, v1), z_eave))
    r0 = bm.verts.new((*to_en(um, ridge_v0), z_ridge))
    r1 = bm.verts.new((*to_en(um, ridge_v1), z_ridge))
    # Bottom cap
    bm.faces.new([c3, c2, c1, c0])
    # 4 roof slopes
    bm.faces.new([c0, c1, r0])
    bm.faces.new([c1, c2, r1, r0])
    bm.faces.new([c2, c3, r1])
    bm.faces.new([c3, c0, r0, r1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mat)
    return obj

def add_portico_gable_hip(name, u0, u1, v0, v1, z_eave, z_peak, mat):
    """Projecting West portico hip roof joining into main roof."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    vm = 0.5 * (v0 + v1)
    um = u0 + 4.5  # joins back into main roof slope
    c0 = bm.verts.new((*to_en(u0, v0), z_eave))
    c1 = bm.verts.new((*to_en(u1, v0), z_eave))
    c2 = bm.verts.new((*to_en(u1, v1), z_eave))
    c3 = bm.verts.new((*to_en(u0, v1), z_eave))
    p0 = bm.verts.new((*to_en(um, vm), z_peak))
    bm.faces.new([c3, c2, c1, c0])
    bm.faces.new([c3, c0, p0])      # West front hip triangle
    bm.faces.new([c0, c1, p0])      # South slope
    bm.faces.new([c2, c3, p0])      # North slope
    bm.faces.new([c1, c2, p0])      # East back join
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mat)
    return obj

def add_window(name, u_c, v_c, width, z0, z1, facing="E", panes=2):
    d = 0.08
    if facing in ("E", "W"):
        v0, v1 = v_c - width*0.5, v_c + width*0.5
        u0, u1 = u_c - d*0.5, u_c + d*0.5
        add_uv_box(name + "_g", u0+0.01, u1-0.01, v0+0.03, v1-0.03, z0+0.03, z1-0.03, MAT_GLASS)
        add_uv_box(name + "_fb", u0, u1, v0, v1, z0, z0+0.05, MAT_FRAME_DARK)
        add_uv_box(name + "_ft", u0, u1, v0, v1, z1-0.05, z1, MAT_FRAME_DARK)
        add_uv_box(name + "_fl", u0, u1, v0, v0+0.05, z0, z1, MAT_FRAME_DARK)
        add_uv_box(name + "_fr", u0, u1, v1-0.05, v1, z0, z1, MAT_FRAME_DARK)
        for p in range(1, panes):
            vp = v0 + (v1 - v0)*(p/panes)
            add_uv_box(f"{name}_m{p}", u0, u1, vp-0.02, vp+0.02, z0, z1, MAT_FRAME_DARK)
    else:
        u0, u1 = u_c - width*0.5, u_c + width*0.5
        v0, v1 = v_c - d*0.5, v_c + d*0.5
        add_uv_box(name + "_g", u0+0.03, u1-0.03, v0+0.01, v1-0.01, z0+0.03, z1-0.03, MAT_GLASS)
        add_uv_box(name + "_fb", u0, u1, v0, v1, z0, z0+0.05, MAT_FRAME_DARK)
        add_uv_box(name + "_ft", u0, u1, v0, v1, z1-0.05, z1, MAT_FRAME_DARK)
        add_uv_box(name + "_fl", u0, u0+0.05, v0, v1, z0, z1, MAT_FRAME_DARK)
        add_uv_box(name + "_fr", u1-0.05, u1, v0, v1, z0, z1, MAT_FRAME_DARK)
        for p in range(1, panes):
            up = u0 + (u1 - u0)*(p/panes)
            add_uv_box(f"{name}_m{p}", up-0.02, up+0.02, v0, v1, z0, z1, MAT_FRAME_DARK)

def add_railing_uv(name, u0, u1, v0, v1, z_base, height=0.88, posts=4):
    add_uv_box(name + "_top", u0, u1, v0, v1, z_base + height - 0.04, z_base + height, MAT_STEEL)
    add_uv_box(name + "_mid", u0, u1, v0, v1, z_base + height*0.5, z_base + height*0.5 + 0.03, MAT_STEEL)
    for i in range(posts):
        t = i / max(1, posts - 1)
        up = u0 + (u1 - u0)*t
        vp = v0 + (v1 - v0)*t
        add_uv_box(f"{name}_p{i}", up - 0.025, up + 0.025, vp - 0.025, vp + 0.025, z_base, z_base + height, MAT_STEEL)

# ---------------------------------------------------------------------------
# 1. Main 2-Storey Building Block (Z = 0.0 to 6.80m)
# ---------------------------------------------------------------------------
Z_VERANDA = 1.25
Z_F2_SLAB = 3.90
Z_EAVE    = 6.80

add_uv_box("Main_Body", u_main_w, u_main_e, v_main_s, v_main_n, 0.0, Z_EAVE, MAT_WALL_WHITE)

# Mint-green horizontal belt between 1st & 2nd floor
add_uv_box("Main_Mid_Belt", u_main_w - 0.02, u_main_e + 0.02, v_main_s - 0.02, v_main_n + 0.02, Z_F2_SLAB, Z_F2_SLAB + 0.30, MAT_MINT_GREEN)

# 4 Mint-green corner pilasters
for idx, (pu, pv) in enumerate([(u_main_w, v_main_s), (u_main_e, v_main_s), (u_main_e, v_main_n), (u_main_w, v_main_n)]):
    add_uv_box(f"Corner_Pilaster_{idx}", pu - 0.24, pu + 0.24, pv - 0.24, pv + 0.24, 0.0, Z_EAVE, MAT_MINT_GREEN)

# Teal-green base trim along West facade at veranda level
add_uv_box("West_Base_Trim", u_main_w - 0.03, u_main_w + 0.02, v_main_s, v_main_n, Z_VERANDA, Z_VERANDA + 0.16, MAT_TEAL_BASE)

# ---------------------------------------------------------------------------
# 2. West Portico, Veranda, 2nd-Floor Balcony & Grand Front Stairs
# ---------------------------------------------------------------------------
# Veranda raised concrete deck (spanning full portico + South bottom balcony + North ramp start)
add_uv_box("Veranda_Base_Plinth", u_port_w, u_main_w, v_main_s, v_main_n, 0.0, Z_VERANDA - 0.05, MAT_CONCRETE)
add_uv_box("Veranda_Wood_Deck", u_port_w - 0.02, u_main_w, v_port_s, v_main_n, Z_VERANDA - 0.05, Z_VERANDA, MAT_VERANDA_WOOD)

# South bottom balcony (Right Side of Front has bottom balcony.jpg)
add_uv_box("South_Balcony_Deck", u_port_w, u_main_w, v_main_s, v_port_s, Z_VERANDA - 0.05, Z_VERANDA, MAT_CONCRETE)
add_uv_box("South_Balcony_Post", u_port_w - 0.10, u_port_w + 0.25, v_main_s - 0.10, v_main_s + 0.25, 0.0, Z_VERANDA + 1.05, MAT_MINT_GREEN)
add_railing_uv("South_Balcony_Rail_W", u_port_w, u_port_w + 0.04, v_main_s + 0.10, v_port_s, Z_VERANDA, 0.90, 4)
add_railing_uv("South_Balcony_Rail_S", u_port_w + 0.10, u_main_w, v_main_s + 0.02, v_main_s + 0.06, Z_VERANDA, 0.90, 3)

# 2nd-floor balcony deck & mint-green fascia beam
add_uv_box("Portico_F2_Slab", u_port_w - 0.04, u_main_w, v_port_s, v_port_n, Z_F2_SLAB - 0.06, Z_F2_SLAB + 0.30, MAT_MINT_GREEN)
add_uv_box("Portico_F2_Deck", u_port_w, u_main_w, v_port_s + 0.05, v_port_n - 0.05, Z_F2_SLAB + 0.28, Z_F2_SLAB + 0.32, MAT_VERANDA_WOOD)

# 3 Mint-green portico columns (v_port_s, v_port_mid, v_port_n)
for idx, cv in enumerate((v_port_s + 0.22, v_port_mid, v_port_n - 0.22)):
    add_uv_box(f"Portico_Col_{idx}", u_port_w, u_port_w + 0.42, cv - 0.21, cv + 0.21, Z_VERANDA, Z_EAVE, MAT_MINT_GREEN)

# 2nd-floor stainless steel balcony railings
add_railing_uv("F2_Balcony_Rail_S", u_port_w + 0.18, u_port_w + 0.22, v_port_s + 0.40, v_port_mid - 0.20, Z_F2_SLAB + 0.30, 0.90, 4)
add_railing_uv("F2_Balcony_Rail_N", u_port_w + 0.18, u_port_w + 0.22, v_port_mid + 0.20, v_port_n - 0.40, Z_F2_SLAB + 0.30, 0.90, 4)

# Grand wide concrete front stairs (8 steps, centered on portico)
stair_v0, stair_v1 = v_port_s + 0.70, v_port_n - 0.70
n_steps = 8
for s in range(n_steps):
    z_top = Z_VERANDA * ((s + 1) / n_steps)
    u_ext = u_port_w - (n_steps - s) * 0.38
    add_uv_box(f"Grand_Stair_{s}", u_ext, u_port_w + 0.05, stair_v0, stair_v1, 0.0, z_top, MAT_CONCRETE)

# Sloped side handrails on Grand Stairs (simplified horizontal-stepped rail bars)
add_railing_uv("Stair_Rail_S", u_port_w - n_steps*0.38, u_port_w, stair_v0, stair_v0 + 0.04, 0.45, 0.85, 4)
add_railing_uv("Stair_Rail_N", u_port_w - n_steps*0.38, u_port_w, stair_v1 - 0.04, stair_v1, 0.45, 0.85, 4)

# Portico Ground & 2nd-Floor Double Sliding Glass Doors
for idx, dv in enumerate((-2.80, +2.80)):
    add_window(f"Portico_G_Door_{idx}", u_main_w - 0.02, v_port_mid + dv, 2.20, Z_VERANDA, Z_VERANDA + 2.15, facing="W", panes=2)
    add_window(f"Portico_F2_Door_{idx}", u_main_w - 0.02, v_port_mid + dv, 2.20, Z_F2_SLAB + 0.30, Z_F2_SLAB + 2.40, facing="W", panes=2)

# South-West recessed wing windows + AC unit
add_window("SW_High_Ribbon", u_main_w - 0.02, v_main_s + 2.50, 2.20, Z_VERANDA + 1.45, Z_VERANDA + 1.80, facing="W", panes=3)
add_window("SW_F2_Win_1", u_main_w - 0.02, v_main_s + 1.75, 1.35, Z_F2_SLAB + 0.95, Z_F2_SLAB + 2.15, facing="W", panes=2)
add_window("SW_F2_Win_2", u_main_w - 0.02, v_main_s + 3.45, 1.35, Z_F2_SLAB + 0.95, Z_F2_SLAB + 2.15, facing="W", panes=2)
add_uv_box("SW_AC_Unit", u_main_w - 0.34, u_main_w, v_port_s - 0.95, v_port_s - 0.15, Z_F2_SLAB + 0.55, Z_F2_SLAB + 1.15, MAT_AC_WHITE)

# North-West recessed wing high vent window
add_window("NW_High_Ribbon", u_main_w - 0.02, v_main_n - 2.30, 1.60, Z_VERANDA + 1.45, Z_VERANDA + 1.80, facing="W", panes=3)

# ---------------------------------------------------------------------------
# 3. North, South & East Rear Facade Details
# ---------------------------------------------------------------------------
# South flank (v = v_main_s)
add_window("South_F2_Win_1", u_main_w + 3.10, v_main_s - 0.02, 1.35, Z_F2_SLAB + 0.95, Z_F2_SLAB + 2.15, facing="S", panes=2)
add_window("South_F2_Win_2", u_main_e - 2.80, v_main_s - 0.02, 1.35, Z_F2_SLAB + 0.95, Z_F2_SLAB + 2.15, facing="S", panes=2)

# North flank (v = v_main_n)
add_window("North_G_Ribbon_1", u_main_w + 3.20, v_main_n + 0.02, 1.80, Z_VERANDA + 1.40, Z_VERANDA + 1.75, facing="N", panes=3)
add_window("North_G_Ribbon_2", u_main_e - 3.20, v_main_n + 0.02, 1.80, Z_VERANDA + 1.40, Z_VERANDA + 1.75, facing="N", panes=3)
add_window("North_F2_Win_1", u_main_w + 3.10, v_main_n + 0.02, 1.35, Z_F2_SLAB + 0.95, Z_F2_SLAB + 2.15, facing="N", panes=2)
add_window("North_F2_Win_2", u_main_e - 2.80, v_main_n + 0.02, 1.35, Z_F2_SLAB + 0.95, Z_F2_SLAB + 2.15, facing="N", panes=2)

# East Rear Facade (u = u_main_e): 6 upper-floor windows + 2 rear doors w/ green steps + ground windows
v_span = v_main_n - v_main_s
for i in range(6):
    vc = v_main_s + v_span * ((i + 0.75) / 6.5)
    add_window(f"East_F2_Win_{i}", u_main_e + 0.02, vc, 1.35, Z_F2_SLAB + 0.95, Z_F2_SLAB + 2.15, facing="E", panes=2)

# Two rear exit doors with green concrete steps
for idx, vc in enumerate((v_main_s + 5.80, v_main_n - 5.80)):
    add_uv_box(f"East_Rear_Door_{idx}", u_main_e - 0.02, u_main_e + 0.05, vc - 0.45, vc + 0.45, Z_VERANDA, Z_VERANDA + 2.10, MAT_DOOR_WOOD)
    for s in range(4):
        z_top = Z_VERANDA * ((s + 1) / 4.0)
        u_ext = u_main_e + (4 - s) * 0.30
        add_uv_box(f"East_Step_{idx}_{s}", u_main_e, u_ext, vc - 0.65, vc + 0.65, 0.0, z_top, MAT_STAIR_GREEN)

# Ground-floor East windows & corner ribbon vents
add_window("East_G_Win_1", u_main_e + 0.02, v_main_s + 8.50, 1.75, Z_VERANDA + 0.65, Z_VERANDA + 1.85, facing="E", panes=2)
add_window("East_G_Win_2", u_main_e + 0.02, v_main_n - 8.50, 1.75, Z_VERANDA + 0.65, Z_VERANDA + 1.85, facing="E", panes=2)
add_window("East_Ribbon_S", u_main_e + 0.02, v_main_s + 2.80, 2.40, Z_VERANDA + 1.45, Z_VERANDA + 1.80, facing="E", panes=4)
add_window("East_Ribbon_N", u_main_e + 0.02, v_main_n - 2.40, 1.60, Z_VERANDA + 1.45, Z_VERANDA + 1.80, facing="E", panes=3)

# ---------------------------------------------------------------------------
# 4. Crimson-Red Hip Roof + Portico Pediment + Soffits & Gutters
# ---------------------------------------------------------------------------
ov = 0.72
# Soffit slab under main eaves
add_uv_box("Main_Soffit", u_main_w - ov, u_main_e + ov, v_main_s - ov, v_main_n + ov, Z_EAVE - 0.05, Z_EAVE + 0.04, MAT_SOFFIT)
add_uv_box("Portico_Soffit", u_port_w - ov, u_main_w, v_port_s - ov, v_port_n + ov, Z_EAVE - 0.05, Z_EAVE + 0.04, MAT_SOFFIT)

# Main hip roof (N-S ridge)
add_hip_roof("Main_Hip_Roof", u_main_w - ov, u_main_e + ov, v_main_s - ov, v_main_n + ov,
             Z_EAVE + 0.04, 9.25, v_main_s + 6.5, v_main_n - 6.5, MAT_ROOF_RED)

# Projecting West portico roof joining main roof
add_portico_gable_hip("Portico_Hip_Roof", u_port_w - ov, u_main_w + 1.2, v_port_s - ov, v_port_n + ov,
                      Z_EAVE + 0.04, 8.70, MAT_ROOF_RED)

# Silver perimeter gutters
add_uv_box("Gutter_E", u_main_e + ov - 0.05, u_main_e + ov + 0.08, v_main_s - ov, v_main_n + ov, Z_EAVE, Z_EAVE + 0.12, MAT_GUTTER)
add_uv_box("Gutter_S", u_main_w - ov, u_main_e + ov, v_main_s - ov - 0.08, v_main_s - ov + 0.05, Z_EAVE, Z_EAVE + 0.12, MAT_GUTTER)
add_uv_box("Gutter_N", u_main_w - ov, u_main_e + ov, v_main_n + ov - 0.05, v_main_n + ov + 0.08, Z_EAVE, Z_EAVE + 0.12, MAT_GUTTER)
add_uv_box("Gutter_Port_W", u_port_w - ov - 0.08, u_port_w - ov + 0.05, v_port_s - ov, v_port_n + ov, Z_EAVE, Z_EAVE + 0.12, MAT_GUTTER)

# ---------------------------------------------------------------------------
# Export GLB
# ---------------------------------------------------------------------------
out_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\rares_multipurpose_rnd.glb"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"EXPORTED: {out_path} ({size_kb:.2f} KB)")
