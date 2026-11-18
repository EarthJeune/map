"""
Build script for DA-RARES Staff House A (rares_building_15).
Conforms strictly to the 8-vertex footprint in rares_buildings.json and
rares_entrance_15 (+0.49, +3.85) on the North front porch.
"""
import math
import os
import sys
import bpy
import bmesh
from mathutils import Vector, Matrix

# ---------------------------------------------------------------------------
# Clear scene
# ---------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------------------------------------------------------------------
# Materials (PBR)
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

MAT_WALL_BLUE   = make_mat("WallSlateBlue", (0.28, 0.36, 0.44, 1.0), roughness=0.82)
MAT_TRIM_WHITE  = make_mat("TrimCreamWhite", (0.86, 0.87, 0.83, 1.0), roughness=0.72)
MAT_BAND_GREY   = make_mat("RevealGrey", (0.36, 0.41, 0.46, 1.0), roughness=0.78)
MAT_CONCRETE    = make_mat("ConcreteApron", (0.50, 0.51, 0.49, 1.0), roughness=0.88)
MAT_STEP_TILE   = make_mat("StepTileGrey", (0.44, 0.45, 0.44, 1.0), roughness=0.55)
MAT_ROOF_MAROON = make_mat("RoofMaroon", (0.34, 0.08, 0.09, 1.0), roughness=0.45, metallic=0.35)
MAT_SOFFIT      = make_mat("SoffitWhite", (0.82, 0.83, 0.81, 1.0), roughness=0.65)
MAT_GLASS       = make_mat("GlassDark", (0.09, 0.15, 0.20, 1.0), roughness=0.08, metallic=0.25)
MAT_FRAME_WHITE = make_mat("FrameWhite", (0.90, 0.91, 0.90, 1.0), roughness=0.35, metallic=0.20)
MAT_DOOR_DARK   = make_mat("DoorDark", (0.10, 0.11, 0.12, 1.0), roughness=0.45, metallic=0.15)
MAT_STEEL       = make_mat("GalvSteel", (0.58, 0.60, 0.62, 1.0), roughness=0.35, metallic=0.80)
MAT_AC_WHITE    = make_mat("ACUnitWhite", (0.88, 0.88, 0.86, 1.0), roughness=0.40, metallic=0.10)
MAT_AC_GRILLE   = make_mat("ACGrilleDark", (0.14, 0.15, 0.16, 1.0), roughness=0.55, metallic=0.30)

# ---------------------------------------------------------------------------
# Footprint & Local Frame
# ---------------------------------------------------------------------------
# Exact (E, N) vertices from rares_buildings.json relative to centroid
V_RAW = [
    ( 3.88, -8.44),  # v0: SE
    ( 5.32,  1.26),  # v1: NE main
    ( 4.91,  1.29),  # v2: E porch base
    ( 5.12,  3.11),  # v3: NE porch corner
    (-3.93,  4.40),  # v4: NW porch corner
    (-4.23,  2.64),  # v5: W porch base
    (-4.80,  2.71),  # v6: NW main
    (-6.27, -6.97),  # v7: SW
]

# Local basis aligned to South edge (v7 -> v0)
v7_vec = Vector((V_RAW[7][0], V_RAW[7][1]))
v0_vec = Vector((V_RAW[0][0], V_RAW[0][1]))
dir_u = (v0_vec - v7_vec).normalized()          # +u = East-ish along building width
dir_v = Vector((-dir_u.y, dir_u.x))             # +v = North-ish toward front entrance

def to_uv(e, n):
    p = Vector((e, n))
    return (p.dot(dir_u), p.dot(dir_v))

def to_en(u, v):
    p = dir_u * u + dir_v * v
    return (p.x, p.y)

UV_VERTS = [to_uv(e, n) for (e, n) in V_RAW]
# Compute main body bounds in (u, v)
# Main body: v0, v1, v6, v7
u_west = min(UV_VERTS[6][0], UV_VERTS[7][0])
u_east = max(UV_VERTS[0][0], UV_VERTS[1][0])
v_south = min(UV_VERTS[0][1], UV_VERTS[7][1])
v_north_main = 0.5 * (UV_VERTS[1][1] + UV_VERTS[6][1])
v_north_porch = 0.5 * (UV_VERTS[3][1] + UV_VERTS[4][1])
u_porch_w = 0.5 * (UV_VERTS[4][0] + UV_VERTS[5][0])
u_porch_e = 0.5 * (UV_VERTS[2][0] + UV_VERTS[3][0])

# ---------------------------------------------------------------------------
# Mesh Helpers
# ---------------------------------------------------------------------------
def add_uv_box(name, u0, u1, v0, v1, z0, z1, mat):
    """Create a box aligned to the local (u, v, z) building frame."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    corners_uv = [
        (u0, v0), (u1, v0), (u1, v1), (u0, v1)
    ]
    bot = [bm.verts.new((*to_en(u, v), z0)) for (u, v) in corners_uv]
    top = [bm.verts.new((*to_en(u, v), z1)) for (u, v) in corners_uv]

    bm.faces.new([bot[3], bot[2], bot[1], bot[0]])  # bottom
    bm.faces.new([top[0], top[1], top[2], top[3]])  # top
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([bot[i], bot[j], top[j], top[i]])

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mat)
    return obj

def add_poly_prism(name, pts_en, z0, z1, mat):
    """Extrude an arbitrary CCW 2D polygon in (E, N) from z0 to z1."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    bot = [bm.verts.new((e, n, z0)) for (e, n) in pts_en]
    top = [bm.verts.new((e, n, z1)) for (e, n) in pts_en]
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(top)
    n_pts = len(pts_en)
    for i in range(n_pts):
        j = (i + 1) % n_pts
        bm.faces.new([bot[i], bot[j], top[j], top[i]])

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mat)
    return obj

def add_sloped_uv_prism(name, u0, u1, v0, v1, z_fn_bot, z_fn_top, mat):
    """Create a watertight prism in (u, v) where z varies linearly with (u, v)."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    corners_uv = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    bot = [bm.verts.new((*to_en(u, v), z_fn_bot(u, v))) for (u, v) in corners_uv]
    top = [bm.verts.new((*to_en(u, v), z_fn_top(u, v))) for (u, v) in corners_uv]
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

def add_pilaster(name, uc, vc, w_u, w_v, z0, z1):
    """White pilaster with two horizontal grey reveal bands."""
    add_uv_box(name, uc - w_u*0.5, uc + w_u*0.5, vc - w_v*0.5, vc + w_v*0.5, z0, z1, MAT_TRIM_WHITE)
    for bz in (1.05, 2.15):
        if z0 < bz < z1 - 0.1:
            add_uv_box(f"{name}_band_{bz:.2f}",
                       uc - w_u*0.5 - 0.008, uc + w_u*0.5 + 0.008,
                       vc - w_v*0.5 - 0.008, vc + w_v*0.5 + 0.008,
                       bz, bz + 0.06, MAT_BAND_GREY)

def add_window_uv(name, u_center, v_center, width, z0, z1, facing="N", panes=3, tiers=3):
    """Window with white outer frame, mullions, and dark reflective glass."""
    depth = 0.08
    if facing in ("N", "S"):
        u0, u1 = u_center - width * 0.5, u_center + width * 0.5
        v0, v1 = v_center - depth * 0.5, v_center + depth * 0.5
        add_uv_box(name + "_glass", u0 + 0.03, u1 - 0.03, v0 + 0.01, v1 - 0.01, z0 + 0.03, z1 - 0.03, MAT_GLASS)
        # Outer frame
        add_uv_box(name + "_f_bot", u0, u1, v0, v1, z0, z0 + 0.05, MAT_FRAME_WHITE)
        add_uv_box(name + "_f_top", u0, u1, v0, v1, z1 - 0.05, z1, MAT_FRAME_WHITE)
        add_uv_box(name + "_f_l", u0, u0 + 0.05, v0, v1, z0, z1, MAT_FRAME_WHITE)
        add_uv_box(name + "_f_r", u1 - 0.05, u1, v0, v1, z0, z1, MAT_FRAME_WHITE)
        for p in range(1, panes):
            up = u0 + (u1 - u0) * (p / panes)
            add_uv_box(f"{name}_mull_{p}", up - 0.02, up + 0.02, v0, v1, z0, z1, MAT_FRAME_WHITE)
        for t in range(1, tiers):
            zt = z0 + (z1 - z0) * (t / tiers)
            add_uv_box(f"{name}_tier_{t}", u0, u1, v0, v1, zt - 0.02, zt + 0.02, MAT_FRAME_WHITE)
    else:
        v0, v1 = v_center - width * 0.5, v_center + width * 0.5
        u0, u1 = u_center - depth * 0.5, u_center + depth * 0.5
        add_uv_box(name + "_glass", u0 + 0.01, u1 - 0.01, v0 + 0.03, v1 - 0.03, z0 + 0.03, z1 - 0.03, MAT_GLASS)
        add_uv_box(name + "_f_bot", u0, u1, v0, v1, z0, z0 + 0.05, MAT_FRAME_WHITE)
        add_uv_box(name + "_f_top", u0, u1, v0, v1, z1 - 0.05, z1, MAT_FRAME_WHITE)
        add_uv_box(name + "_f_l", u0, u1, v0, v0 + 0.05, z0, z1, MAT_FRAME_WHITE)
        add_uv_box(name + "_f_r", u0, u1, v1 - 0.05, v1, z0, z1, MAT_FRAME_WHITE)
        for p in range(1, panes):
            vp = v0 + (v1 - v0) * (p / panes)
            add_uv_box(f"{name}_mull_{p}", u0, u1, vp - 0.02, vp + 0.02, z0, z1, MAT_FRAME_WHITE)
        for t in range(1, tiers):
            zt = z0 + (z1 - z0) * (t / tiers)
            add_uv_box(f"{name}_tier_{t}", u0, u1, v0, v1, zt - 0.02, zt + 0.02, MAT_FRAME_WHITE)

def add_ac_unit(name, u_center, v_center, z_bot, facing="E"):
    """Wall-mounted split AC condenser unit with dark fan grille."""
    w, d, h = 0.78, 0.30, 0.54
    if facing == "E":
        add_uv_box(name + "_body", u_center, u_center + d, v_center - w*0.5, v_center + w*0.5, z_bot, z_bot + h, MAT_AC_WHITE)
        add_uv_box(name + "_grille", u_center + d - 0.02, u_center + d + 0.02, v_center - w*0.35, v_center + 0.12, z_bot + 0.06, z_bot + h - 0.06, MAT_AC_GRILLE)
    elif facing == "S":
        add_uv_box(name + "_body", u_center - w*0.5, u_center + w*0.5, v_center - d, v_center, z_bot, z_bot + h, MAT_AC_WHITE)
        add_uv_box(name + "_grille", u_center - w*0.35, u_center + 0.12, v_center - d - 0.02, v_center - d + 0.02, z_bot + 0.06, z_bot + h - 0.06, MAT_AC_GRILLE)

# ---------------------------------------------------------------------------
# 1. Foundation Plinth & Perimeter Concrete Apron
# ---------------------------------------------------------------------------
# Perimeter concrete walkway apron strictly hugging the building footprint (0.45m margin)
apron_pts = []
for (e, n) in V_RAW:
    # Outward offset from centroid (0, 0)
    vec = Vector((e, n))
    out = vec.normalized() * 0.48
    apron_pts.append((e + out.x, n + out.y))
add_poly_prism("Apron_Walkway", apron_pts, 0.0, 0.10, MAT_CONCRETE)

# Raised porch floor slab (v2-v3-v4-v5 + main body plinth)
add_poly_prism("Plinth_Footprint", V_RAW, 0.0, 0.45, MAT_CONCRETE)

# ---------------------------------------------------------------------------
# 2. Main Enclosed Building Body (z = 0.45 to 3.20m)
# ---------------------------------------------------------------------------
# Main body exact quad (v0, v1, v6, v7)
main_pts = [V_RAW[0], V_RAW[1], V_RAW[6], V_RAW[7]]
add_poly_prism("Main_Body_Walls", main_pts, 0.45, 3.20, MAT_WALL_BLUE)

# Continuous upper concrete fascia/eave beam around main body (z = 3.02 to 3.22m)
eave_main_pts = []
for (e, n) in main_pts:
    u, v = to_uv(e, n)
    du = 0.45 if u > 0 else -0.45
    dv = 0.45 if v > 0 else -0.45
    eave_main_pts.append(to_en(u + du, v + dv))
add_poly_prism("Main_Concrete_Eave", eave_main_pts, 3.02, 3.22, MAT_TRIM_WHITE)

# ---------------------------------------------------------------------------
# 3. North Front Covered Porch (v2-v3-v4-v5)
# ---------------------------------------------------------------------------
# Flat concrete porch canopy slab (z = 3.00 to 3.26m) extending over porch + 0.45m overhang
porch_roof_pts = [
    to_en(u_porch_e + 0.45, v_north_main - 0.10),
    to_en(u_porch_e + 0.45, v_north_porch + 0.45),
    to_en(u_porch_w - 0.45, v_north_porch + 0.45),
    to_en(u_porch_w - 0.45, v_north_main - 0.10),
]
add_poly_prism("Porch_Concrete_Canopy", porch_roof_pts, 3.00, 3.26, MAT_TRIM_WHITE)
# Dark grey soffit underside of porch canopy
add_uv_box("Porch_Canopy_Soffit", u_porch_w - 0.35, u_porch_e + 0.35, v_north_main, v_north_porch + 0.35, 2.98, 3.01, MAT_BAND_GREY)

# 3 White Porch Columns (West corner, Center-West, East corner)
col_v = v_north_porch - 0.22
col_us = [u_porch_w + 0.22, 0.5 * (u_porch_w + u_porch_e) - 0.45, u_porch_e - 0.22]
for idx, cu in enumerate(col_us):
    add_pilaster(f"Porch_Col_{idx}", cu, col_v, 0.42, 0.42, 0.45, 3.00)

# Left (East) porch low parapet wall + horizontal white railings
add_uv_box("Porch_East_Parapet", col_us[1] + 0.20, col_us[2] - 0.20, col_v - 0.08, col_v + 0.08, 0.45, 1.05, MAT_WALL_BLUE)
add_uv_box("Porch_East_Cap", col_us[1] + 0.20, col_us[2] - 0.20, col_v - 0.10, col_v + 0.10, 1.05, 1.11, MAT_TRIM_WHITE)
add_uv_box("Porch_East_Rail_1", col_us[1] + 0.20, col_us[2] - 0.20, col_v - 0.03, col_v + 0.03, 1.25, 1.30, MAT_TRIM_WHITE)
add_uv_box("Porch_East_Rail_2", col_us[1] + 0.20, col_us[2] - 0.20, col_v - 0.03, col_v + 0.03, 1.45, 1.50, MAT_TRIM_WHITE)

# Low concrete planter box in front of East porch bay (no plants/rocks per Rule 4)
add_uv_box("Planter_East_Front", col_us[1] + 0.25, col_us[2] + 0.20, v_north_porch, v_north_porch + 0.55, 0.10, 0.55, MAT_WALL_BLUE)
add_uv_box("Planter_East_Rim", col_us[1] + 0.23, col_us[2] + 0.22, v_north_porch - 0.02, v_north_porch + 0.57, 0.55, 0.60, MAT_TRIM_WHITE)

# Right (West) porch entrance steps (3 wide tiled steps on North front + West wrap)
# Aligned with rares_entrance_15 at (+0.49, +3.85)
step_u0, step_u1 = u_porch_w + 0.35, col_us[1] - 0.20
for s in range(3):
    z_top = 0.15 + (s + 1) * 0.10
    v_ext = v_north_porch + (2 - s) * 0.34
    add_uv_box(f"Front_Step_{s}", step_u0, step_u1, v_north_porch - 0.05, v_ext, 0.10, z_top, MAT_STEP_TILE)

# West-side wrap steps (seen in Right Side View.jpg)
for s in range(3):
    z_top = 0.15 + (s + 1) * 0.10
    u_ext = u_porch_w - (2 - s) * 0.34
    add_uv_box(f"West_Porch_Step_{s}", u_ext, u_porch_w + 0.05, v_north_main + 0.20, col_v - 0.22, 0.10, z_top, MAT_STEP_TILE)

# Two corner concrete planter boxes flanking the West porch steps (no plants per Rule 4)
add_uv_box("Planter_NW_Corner", u_porch_w - 0.60, u_porch_w + 0.25, col_v - 0.20, v_north_porch + 0.35, 0.10, 0.62, MAT_WALL_BLUE)
add_uv_box("Planter_W_Main", u_west - 0.55, u_west + 0.05, v_north_main - 0.50, v_north_main + 0.20, 0.10, 0.62, MAT_WALL_BLUE)

# Galvanized steel wire-mesh security railing across porch entrance & West side
add_uv_box("Porch_Gate_TopRail", step_u0, col_us[1] - 0.20, col_v - 0.02, col_v + 0.02, 1.32, 1.36, MAT_STEEL)
add_uv_box("Porch_Gate_BotRail", step_u0, col_us[1] - 0.20, col_v - 0.02, col_v + 0.02, 0.50, 0.54, MAT_STEEL)
add_uv_box("Porch_West_TopRail", u_porch_w + 0.18, u_porch_w + 0.22, v_north_main + 0.15, col_v - 0.20, 1.32, 1.36, MAT_STEEL)

# Front Facade (North main wall at v_north_main): Double glass entrance doors + flanking 3-tier windows
u_door_c = 0.5 * (step_u0 + step_u1)
add_uv_box("Front_Door_Frame", u_door_c - 0.90, u_door_c + 0.90, v_north_main - 0.05, v_north_main + 0.06, 0.45, 2.55, MAT_FRAME_WHITE)
add_uv_box("Front_Door_Glass_L", u_door_c - 0.82, u_door_c - 0.03, v_north_main - 0.02, v_north_main + 0.07, 0.52, 2.48, MAT_GLASS)
add_uv_box("Front_Door_Glass_R", u_door_c + 0.03, u_door_c + 0.82, v_north_main - 0.02, v_north_main + 0.07, 0.52, 2.48, MAT_GLASS)
# Adjacent 3-tier porch windows
add_window_uv("Front_Win_1", u_door_c + 1.85, v_north_main + 0.02, 0.68, 0.75, 2.50, facing="N", panes=1, tiers=3)
add_window_uv("Front_Win_2", u_door_c + 2.75, v_north_main + 0.02, 0.68, 0.75, 2.50, facing="N", panes=1, tiers=3)
add_window_uv("Front_Win_3", u_door_c + 3.65, v_north_main + 0.02, 0.68, 0.75, 2.50, facing="N", panes=1, tiers=3)
# Corner wraparound glass window near West porch
add_window_uv("Front_Corner_Win_N", u_west + 0.85, v_north_main + 0.02, 1.35, 1.05, 2.55, facing="N", panes=2, tiers=1)

# ---------------------------------------------------------------------------
# 4. Corner Pilasters & Flank Facades
# ---------------------------------------------------------------------------
# Four main body corner pilasters
add_pilaster("Pilaster_NW", u_west, v_north_main, 0.52, 0.52, 0.45, 3.05)
add_pilaster("Pilaster_NE", u_east, v_north_main, 0.52, 0.52, 0.45, 3.05)
add_pilaster("Pilaster_SW", u_west, v_south, 0.52, 0.52, 0.45, 3.05)
add_pilaster("Pilaster_SE", u_east, v_south, 0.52, 0.52, 0.45, 3.05)

# WEST FLANK (u = u_west, seen in Right Side View.jpg):
# 3 tall stacked 3-tier windows, mid pilaster, high 3-pane horizontal bathroom window
for i, dv in enumerate((1.55, 2.45, 3.35)):
    add_window_uv(f"West_TallWin_{i}", u_west - 0.02, v_north_main - dv, 0.68, 0.75, 2.50, facing="W", panes=1, tiers=3)
add_pilaster("Pilaster_W_Mid", u_west, v_north_main - 4.30, 0.42, 0.48, 0.45, 3.05)
add_window_uv("West_Bath_HighWin", u_west - 0.02, v_south + 2.20, 1.80, 2.15, 2.65, facing="W", panes=3, tiers=1)

# SOUTH WALL (v = v_south, seen in Roof design.jpg & Back Side View from Right Side.jpg):
# Dark rear exit door on 2 steps, small 2-pane vent window, and 3 tall windows
add_uv_box("South_Door_Step_1", u_west + 1.60, u_west + 3.00, v_south - 0.65, v_south, 0.10, 0.25, MAT_STEP_TILE)
add_uv_box("South_Door_Step_2", u_west + 1.70, u_west + 2.90, v_south - 0.40, v_south, 0.25, 0.45, MAT_STEP_TILE)
add_uv_box("South_Exit_Door", u_west + 1.85, u_west + 2.75, v_south - 0.06, v_south + 0.04, 0.45, 2.50, MAT_DOOR_DARK)
add_window_uv("South_Vent_Win", u_west + 3.90, v_south - 0.02, 0.90, 1.85, 2.45, facing="S", panes=2, tiers=1)
for i, du in enumerate((5.40, 6.30, 7.20)):
    add_window_uv(f"South_TallWin_{i}", u_west + du, v_south - 0.02, 0.68, 0.75, 2.50, facing="S", panes=1, tiers=3)

# EAST FLANK (u = u_east, seen in Back Side View from Left Side.jpg):
# 2 wall-mounted TCL split AC condenser units + 2-pane sliding window between them
add_ac_unit("East_AC_1", u_east, v_south + 2.20, 1.75, facing="E")
add_window_uv("East_Mid_Win", u_east + 0.02, v_south + 4.80, 1.40, 1.25, 2.35, facing="E", panes=2, tiers=1)
add_ac_unit("East_AC_2", u_east, v_north_main - 2.30, 1.75, facing="E")

# ---------------------------------------------------------------------------
# 5. Upper Mono-Pitch / Shed Roof (rising toward North Front)
# ---------------------------------------------------------------------------
# Roof spans main body + 0.65m overhangs on E, W, S, N
ru0, ru1 = u_west - 0.65, u_east + 0.65
rv0, rv1 = v_south - 0.65, v_north_main + 0.65

# Slopes UP from South (z = 3.40m) to North (z = 4.35m)
def roof_z_bot(u, v):
    t = (v - rv0) / (rv1 - rv0)
    return 3.38 + t * 0.95

def roof_z_top(u, v):
    return roof_z_bot(u, v) + 0.14

# Clerestory wall infill between flat eave (3.20m) and sloped roof soffit (3.38m..4.33m)
add_sloped_uv_prism("Roof_Clerestory_Infill", u_west + 0.02, u_east - 0.02, v_south + 0.02, v_north_main - 0.02,
                    lambda u, v: 3.18, roof_z_bot, MAT_WALL_BLUE)

# White ribbed soffit slab
add_sloped_uv_prism("Roof_Soffit_Slab", ru0 + 0.04, ru1 - 0.04, rv0 + 0.04, rv1 - 0.04,
                    roof_z_bot, lambda u, v: roof_z_bot(u, v) + 0.05, MAT_SOFFIT)

# Maroon metal roof deck + fascia
add_sloped_uv_prism("Roof_Maroon_Deck", ru0, ru1, rv0, rv1,
                    lambda u, v: roof_z_bot(u, v) + 0.04, roof_z_top, MAT_ROOF_MAROON)

# ---------------------------------------------------------------------------
# Export GLB
# ---------------------------------------------------------------------------
out_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\rares_staff_house_a.glb"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"EXPORTED: {out_path} ({size_kb:.2f} KB)")
