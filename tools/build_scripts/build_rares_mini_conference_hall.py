import bpy
import bmesh
import math
import json
import os
from mathutils import Vector, Matrix

# ==============================================================================
# Build Script: Mini Conference Hall (rares_building_24 + rares_building_24.1)
# Station: DA-RARES (Tanay, Rizal)
# References: Building Images RARES/Mini Conference Hall/*
# ==============================================================================

REPO_ROOT = r"c:\Users\LGU-SanPedro\Downloads\map"
RARES_BUILDINGS_JSON = os.path.join(REPO_ROOT, "rares_buildings.json")
OUTPUT_GLB = os.path.join(REPO_ROOT, "models", "rares_mini_conference_hall.glb")


def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def make_mat(name, hex_rgb, roughness=0.65, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    r = srgb_to_linear(((hex_rgb >> 16) & 0xFF) / 255.0)
    g = srgb_to_linear(((hex_rgb >> 8) & 0xFF) / 255.0)
    b = srgb_to_linear((hex_rgb & 0xFF) / 255.0)
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_footprints():
    with open(RARES_BUILDINGS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    f24 = next(ft for ft in data["features"] if ft["properties"].get("id") == "rares_building_24")
    f24_1 = next(ft for ft in data["features"] if ft["properties"].get("id") == "rares_building_24.1")

    ring0 = f24["geometry"]["coordinates"][0]
    pts0 = ring0[:-1] if ring0[0] == ring0[-1] else ring0
    cx = sum(p[0] for p in pts0) / len(pts0)
    cy = sum(p[1] for p in pts0) / len(pts0)
    kx = 111320.0 * math.cos(math.radians(cy))
    ky = 110540.0

    def to_local(ring):
        pts = ring[:-1] if ring[0] == ring[-1] else ring
        return [Vector(((p[0] - cx) * kx, (p[1] - cy) * ky, 0.0)) for p in pts]

    return to_local(f24["geometry"]["coordinates"][0]), to_local(f24_1["geometry"]["coordinates"][0])


def create_mesh_obj(name, bm, mat):
    mesh = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_box_uv(name, u0, u1, v0, v1, z0, z1, origin, u_dir, v_dir, mat):
    bm = bmesh.new()
    pts = [
        origin + u_dir * u0 + v_dir * v0,
        origin + u_dir * u1 + v_dir * v0,
        origin + u_dir * u1 + v_dir * v1,
        origin + u_dir * u0 + v_dir * v1,
    ]
    bot = [bm.verts.new((p.x, p.y, z0)) for p in pts]
    top = [bm.verts.new((p.x, p.y, z1)) for p in pts]
    bm.faces.new(bot[::-1])
    bm.faces.new(top)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([bot[i], bot[j], top[j], top[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return create_mesh_obj(name, bm, mat)


def add_prism_poly(name, poly_pts, z0, z1, mat):
    bm = bmesh.new()
    bot = [bm.verts.new((p.x, p.y, z0)) for p in poly_pts]
    top = [bm.verts.new((p.x, p.y, z1)) for p in poly_pts]
    bm.faces.new(bot[::-1])
    bm.faces.new(top)
    n = len(poly_pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([bot[i], bot[j], top[j], top[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return create_mesh_obj(name, bm, mat)


def add_sloped_roof(name, u0, u1, v0, v1, z_u0, z_u1, thickness, origin, u_dir, v_dir, mat_top, mat_soffit, mat_fascia):
    # Top corrugated deck
    bm_top = bmesh.new()
    p00 = origin + u_dir * u0 + v_dir * v0
    p10 = origin + u_dir * u1 + v_dir * v0
    p11 = origin + u_dir * u1 + v_dir * v1
    p01 = origin + u_dir * u0 + v_dir * v1

    b = [
        bm_top.verts.new((p00.x, p00.y, z_u0)),
        bm_top.verts.new((p10.x, p10.y, z_u1)),
        bm_top.verts.new((p11.x, p11.y, z_u1)),
        bm_top.verts.new((p01.x, p01.y, z_u0)),
    ]
    t = [
        bm_top.verts.new((p00.x, p00.y, z_u0 + 0.05)),
        bm_top.verts.new((p10.x, p10.y, z_u1 + 0.05)),
        bm_top.verts.new((p11.x, p11.y, z_u1 + 0.05)),
        bm_top.verts.new((p01.x, p01.y, z_u0 + 0.05)),
    ]
    bm_top.faces.new(b[::-1])
    bm_top.faces.new(t)
    for i in range(4):
        j = (i + 1) % 4
        bm_top.faces.new([b[i], b[j], t[j], t[i]])
    bmesh.ops.recalc_face_normals(bm_top, faces=bm_top.faces)
    create_mesh_obj(name + "_Deck", bm_top, mat_top)

    # Corrugated ribs along u_dir
    bm_ribs = bmesh.new()
    num_ribs = max(4, int((v1 - v0) / 0.35))
    for k in range(num_ribs + 1):
        vk = v0 + (v1 - v0) * (k / num_ribs)
        rw = 0.04
        q00 = origin + u_dir * u0 + v_dir * (vk - rw)
        q10 = origin + u_dir * u1 + v_dir * (vk - rw)
        q11 = origin + u_dir * u1 + v_dir * (vk + rw)
        q01 = origin + u_dir * u0 + v_dir * (vk + rw)
        rb = [
            bm_ribs.verts.new((q00.x, q00.y, z_u0 + 0.05)),
            bm_ribs.verts.new((q10.x, q10.y, z_u1 + 0.05)),
            bm_ribs.verts.new((q11.x, q11.y, z_u1 + 0.05)),
            bm_ribs.verts.new((q01.x, q01.y, z_u0 + 0.05)),
        ]
        rt = [
            bm_ribs.verts.new((q00.x, q00.y, z_u0 + 0.085)),
            bm_ribs.verts.new((q10.x, q10.y, z_u1 + 0.085)),
            bm_ribs.verts.new((q11.x, q11.y, z_u1 + 0.085)),
            bm_ribs.verts.new((q01.x, q01.y, z_u0 + 0.085)),
        ]
        bm_ribs.faces.new(rt)
        for i in range(4):
            j = (i + 1) % 4
            bm_ribs.faces.new([rb[i], rb[j], rt[j], rt[i]])
    bmesh.ops.recalc_face_normals(bm_ribs, faces=bm_ribs.faces)
    create_mesh_obj(name + "_Ribs", bm_ribs, mat_top)

    # Soffit underside
    bm_sof = bmesh.new()
    sb = [
        bm_sof.verts.new((p00.x, p00.y, z_u0 - thickness)),
        bm_sof.verts.new((p10.x, p10.y, z_u1 - thickness)),
        bm_sof.verts.new((p11.x, p11.y, z_u1 - thickness)),
        bm_sof.verts.new((p01.x, p01.y, z_u0 - thickness)),
    ]
    st = [
        bm_sof.verts.new((p00.x, p00.y, z_u0)),
        bm_sof.verts.new((p10.x, p10.y, z_u1)),
        bm_sof.verts.new((p11.x, p11.y, z_u1)),
        bm_sof.verts.new((p01.x, p01.y, z_u0)),
    ]
    bm_sof.faces.new(sb[::-1])
    bm_sof.faces.new(st)
    bmesh.ops.recalc_face_normals(bm_sof, faces=bm_sof.faces)
    create_mesh_obj(name + "_Soffit", bm_sof, mat_soffit)

    # White fascia perimeter
    bm_fas = bmesh.new()
    fb = [
        bm_fas.verts.new((p00.x, p00.y, z_u0 - thickness)),
        bm_fas.verts.new((p10.x, p10.y, z_u1 - thickness)),
        bm_fas.verts.new((p11.x, p11.y, z_u1 - thickness)),
        bm_fas.verts.new((p01.x, p01.y, z_u0 - thickness)),
    ]
    ft = [
        bm_fas.verts.new((p00.x, p00.y, z_u0 + 0.02)),
        bm_fas.verts.new((p10.x, p10.y, z_u1 + 0.02)),
        bm_fas.verts.new((p11.x, p11.y, z_u1 + 0.02)),
        bm_fas.verts.new((p01.x, p01.y, z_u0 + 0.02)),
    ]
    for i in range(4):
        j = (i + 1) % 4
        bm_fas.faces.new([fb[i], fb[j], ft[j], ft[i]])
    bmesh.ops.recalc_face_normals(bm_fas, faces=bm_fas.faces)
    create_mesh_obj(name + "_Fascia", bm_fas, mat_fascia)


def add_3panel_window(name, u_center, v_center, along_u, width, z0, z1, depth_out, origin, u_dir, v_dir, mat_frame, mat_glass):
    # Outer frame
    if along_u:
        # Window on South/North wall (runs along u, projects in v)
        v_a = v_center - depth_out if depth_out < 0 else v_center
        v_b = v_center if depth_out < 0 else v_center + depth_out
        add_box_uv(name + "_Frame", u_center - width / 2, u_center + width / 2, v_a, v_b, z0, z1, origin, u_dir, v_dir, mat_frame)
        # 3 glass panes recessed slightly inside frame
        pane_w = (width - 0.20) / 3.0
        for i in range(3):
            uc = u_center - width / 2 + 0.10 + pane_w * (i + 0.5)
            gv_a = v_a - 0.01 if depth_out < 0 else v_b - 0.04
            gv_b = v_a + 0.04 if depth_out < 0 else v_b + 0.01
            add_box_uv(f"{name}_Glass_{i}", uc - pane_w / 2 + 0.025, uc + pane_w / 2 - 0.025, gv_a, gv_b, z0 + 0.06, z1 - 0.06, origin, u_dir, v_dir, mat_glass)
    else:
        # Window on West/East wall (runs along v, projects in u)
        u_a = u_center - depth_out if depth_out > 0 else u_center
        u_b = u_center if depth_out > 0 else u_center - depth_out
        # Wait: standardize u_a < u_b
        ua = min(u_center, u_center + depth_out)
        ub = max(u_center, u_center + depth_out)
        add_box_uv(name + "_Frame", ua, ub, v_center - width / 2, v_center + width / 2, z0, z1, origin, u_dir, v_dir, mat_frame)
        pane_w = (width - 0.20) / 3.0
        gua = ua - 0.01 if depth_out < 0 else ub - 0.04
        gub = ua + 0.04 if depth_out < 0 else ub + 0.01
        for i in range(3):
            vc = v_center - width / 2 + 0.10 + pane_w * (i + 0.5)
            add_box_uv(f"{name}_Glass_{i}", gua, gub, vc - pane_w / 2 + 0.025, vc + pane_w / 2 - 0.025, z0 + 0.06, z1 - 0.06, origin, u_dir, v_dir, mat_glass)


def add_ac_unit(name, u_c, v_c, along_u, sign, z_base, origin, u_dir, v_dir, mat_white, mat_dark):
    if along_u:
        # Mounted on South (sign=-1) or North (sign=+1) wall
        va = v_c if sign > 0 else v_c - 0.34
        vb = v_c + 0.34 if sign > 0 else v_c
        add_box_uv(name + "_Body", u_c - 0.44, u_c + 0.44, va, vb, z_base, z_base + 0.58, origin, u_dir, v_dir, mat_white)
        ga = vb - 0.02 if sign > 0 else va - 0.01
        gb = vb + 0.01 if sign > 0 else va + 0.02
        add_box_uv(name + "_Grill", u_c - 0.35, u_c + 0.05, ga, gb, z_base + 0.08, z_base + 0.50, origin, u_dir, v_dir, mat_dark)
    else:
        ua = u_c if sign > 0 else u_c - 0.34
        ub = u_c + 0.34 if sign > 0 else u_c
        add_box_uv(name + "_Body", ua, ub, v_c - 0.44, v_c + 0.44, z_base, z_base + 0.58, origin, u_dir, v_dir, mat_white)


def build_model():
    clear_scene()
    poly_main, poly_cr = load_footprints()

    # Main footprint vertices: v0=SE, v1=SW, v2=NW, v3=NE
    v0, v1, v2, v3 = poly_main
    u_dir = (v0 - v1).normalized()  # West -> East
    v_dir = Vector((-u_dir.y, u_dir.x, 0.0))  # South -> North
    origin = Vector((0.0, 0.0, 0.0))

    # Project main vertices to (u, v) to get exact extents
    us = [p.dot(u_dir) for p in poly_main]
    vs = [p.dot(v_dir) for p in poly_main]
    u_min, u_max = min(us), max(us)
    v_min, v_max = min(vs), max(vs)

    # Materials
    mat_wall = make_mat("MintStucco", 0xC4DFB6, roughness=0.78)
    mat_tile = make_mat("GreyTile", 0x8C9194, roughness=0.55)
    mat_concrete = make_mat("Concrete", 0xB4B6B6, roughness=0.85)
    mat_roof = make_mat("DarkMetalRoof", 0x2B2E30, roughness=0.45, metallic=0.35)
    mat_fascia = make_mat("WhiteFascia", 0xECEEEE, roughness=0.50)
    mat_soffit = make_mat("WoodSoffit", 0xA8866C, roughness=0.70)
    mat_frame = make_mat("BronzeFrame", 0x1E2022, roughness=0.35, metallic=0.50)
    mat_glass = make_mat("DarkGlass", 0x18232A, roughness=0.06, metallic=0.35)
    mat_door_grey = make_mat("GreyDoor", 0x6A6E72, roughness=0.55)
    mat_steel = make_mat("StainlessSteel", 0xC8CCCE, roughness=0.22, metallic=0.90)
    mat_white = make_mat("PureWhite", 0xF2F3F3, roughness=0.40)
    mat_mirror = make_mat("MirrorGlass", 0xCFD4D6, roughness=0.03, metallic=0.95)
    mat_louver = make_mat("BlackLouver", 0x141516, roughness=0.60)

    # --------------------------------------------------------------------------
    # 1. MAIN HALL PLINTH & WALLS (Exact rares_buildings.json footprint)
    # --------------------------------------------------------------------------
    add_prism_poly("Main_Plinth", poly_main, 0.0, 0.35, mat_concrete)
    add_prism_poly("Main_Walls", poly_main, 0.35, 3.15, mat_wall)

    # Clerestory step wall infill (from u = +0.10 to u_max, Z = 3.15 to 3.85 tapering to 3.30)
    bm_clere = bmesh.new()
    u_step = 0.10
    p_sw = origin + u_dir * u_step + v_dir * v_min
    p_se = origin + u_dir * u_max + v_dir * v_min
    p_ne = origin + u_dir * u_max + v_dir * v_max
    p_nw = origin + u_dir * u_step + v_dir * v_max
    zb = 3.10
    zt_w = 3.82
    zt_e = 3.28
    cb = [
        bm_clere.verts.new((p_sw.x, p_sw.y, zb)),
        bm_clere.verts.new((p_se.x, p_se.y, zb)),
        bm_clere.verts.new((p_ne.x, p_ne.y, zb)),
        bm_clere.verts.new((p_nw.x, p_nw.y, zb)),
    ]
    ct = [
        bm_clere.verts.new((p_sw.x, p_sw.y, zt_w)),
        bm_clere.verts.new((p_se.x, p_se.y, zt_e)),
        bm_clere.verts.new((p_ne.x, p_ne.y, zt_e)),
        bm_clere.verts.new((p_nw.x, p_nw.y, zt_w)),
    ]
    bm_clere.faces.new(cb[::-1])
    bm_clere.faces.new(ct)
    for i in range(4):
        j = (i + 1) % 4
        bm_clere.faces.new([cb[i], cb[j], ct[j], ct[i]])
    bmesh.ops.recalc_face_normals(bm_clere, faces=bm_clere.faces)
    create_mesh_obj("Main_Clerestory_Infill", bm_clere, mat_wall)

    # --------------------------------------------------------------------------
    # 2. SPLIT-LEVEL MONO-PITCH ROOFS
    # --------------------------------------------------------------------------
    # Front (West) roof: slopes UP gently from West (3.15) to center step (3.52)
    add_sloped_roof(
        "Roof_Front",
        u_min - 0.60, 0.22,
        v_min - 0.45, v_max + 0.45,
        3.15, 3.52, 0.20,
        origin, u_dir, v_dir,
        mat_roof, mat_soffit, mat_fascia
    )
    # Rear (East) roof: steps up at u = +0.05 (3.86) and slopes DOWN to East (3.26)
    add_sloped_roof(
        "Roof_Rear",
        0.05, u_max + 0.65,
        v_min - 0.45, v_max + 0.45,
        3.86, 3.26, 0.20,
        origin, u_dir, v_dir,
        mat_roof, mat_soffit, mat_fascia
    )

    # --------------------------------------------------------------------------
    # 3. WEST FRONT FACADE (Main Entrance facing rares_entrance_24)
    # --------------------------------------------------------------------------
    # Center Grey-Tiled Entrance Bay
    add_box_uv("Front_Center_TileBay", u_min - 0.10, u_min + 0.02, -1.65, 1.65, 0.35, 3.05, origin, u_dir, v_dir, mat_tile)

    # Double Frameless Dark Glass Doors + Stainless Pull Handles + Transom
    add_box_uv("Front_Door_Frame", u_min - 0.14, u_min - 0.06, -0.95, 0.95, 0.45, 2.65, origin, u_dir, v_dir, mat_frame)
    add_box_uv("Front_Door_GlassL", u_min - 0.13, u_min - 0.09, -0.88, -0.02, 0.47, 2.30, origin, u_dir, v_dir, mat_glass)
    add_box_uv("Front_Door_GlassR", u_min - 0.13, u_min - 0.09, 0.02, 0.88, 0.47, 2.30, origin, u_dir, v_dir, mat_glass)
    add_box_uv("Front_Door_Transom", u_min - 0.13, u_min - 0.09, -0.88, 0.88, 2.34, 2.60, origin, u_dir, v_dir, mat_glass)
    add_box_uv("Front_Door_HandleL", u_min - 0.19, u_min - 0.13, -0.16, -0.11, 1.05, 1.75, origin, u_dir, v_dir, mat_steel)
    add_box_uv("Front_Door_HandleR", u_min - 0.19, u_min - 0.13, 0.11, 0.16, 1.05, 1.75, origin, u_dir, v_dir, mat_steel)

    # Elevated Entrance Landing + 4 Concrete Steps + Low White Cheek Walls
    add_box_uv("Front_Landing", u_min - 0.95, u_min, -1.35, 1.35, 0.0, 0.45, origin, u_dir, v_dir, mat_concrete)
    for s in range(4):
        step_u0 = u_min - 0.95 - 0.32 * (s + 1)
        step_u1 = u_min - 0.95 - 0.32 * s
        step_z = 0.45 - 0.09 * (s + 1)
        add_box_uv(f"Front_Step_{s}", step_u0, step_u1, -1.25, 1.25, 0.0, step_z, origin, u_dir, v_dir, mat_concrete)

    # Low flanking cheek walls with white top caps
    for side, (cv0, cv1) in enumerate([(-1.45, -1.25), (1.25, 1.45)]):
        add_box_uv(f"Front_CheekWall_{side}", u_min - 2.25, u_min - 0.05, cv0, cv1, 0.0, 0.62, origin, u_dir, v_dir, mat_white)

    # Flanking 3-Panel Windows + Grey-Tiled Planter Boxes (no plants per Rule 4)
    for idx, vc in enumerate([-3.95, 3.95]):
        add_3panel_window(f"Front_Win_{idx}", u_min, vc, False, 2.60, 1.05, 2.50, -0.08, origin, u_dir, v_dir, mat_frame, mat_glass)
        add_box_uv(f"Front_Planter_{idx}", u_min - 0.55, u_min, vc - 1.50, vc + 1.50, 0.0, 0.62, origin, u_dir, v_dir, mat_tile)

    # --------------------------------------------------------------------------
    # 4. NORTH (LEFT) FLANK
    # --------------------------------------------------------------------------
    # Wide horizontal black louver vent high on North wall
    add_box_uv("North_Louver_Vent", -1.40, 1.30, v_max - 0.02, v_max + 0.06, 2.52, 2.96, origin, u_dir, v_dir, mat_louver)
    # Wall-mounted split AC unit on North wall toward East
    add_ac_unit("North_AC", 2.10, v_max, True, +1, 2.15, origin, u_dir, v_dir, mat_white, mat_louver)

    # --------------------------------------------------------------------------
    # 5. SOUTH (RIGHT) FLANK
    # --------------------------------------------------------------------------
    # 3-panel window toward East rear + Split AC unit above/beside it
    add_3panel_window("South_Win", 2.35, v_min, True, 2.20, 1.25, 2.50, -0.08, origin, u_dir, v_dir, mat_frame, mat_glass)
    add_ac_unit("South_AC", 2.35, v_min, True, -1, 2.58, origin, u_dir, v_dir, mat_white, mat_louver)

    # --------------------------------------------------------------------------
    # 6. EAST (BACK) FACADE (Rear Grey Exit Door)
    # --------------------------------------------------------------------------
    add_box_uv("East_RearDoor_Frame", u_max - 0.02, u_max + 0.06, -2.95, -1.95, 0.35, 2.48, origin, u_dir, v_dir, mat_frame)
    add_box_uv("East_RearDoor_Leaf", u_max - 0.01, u_max + 0.04, -2.90, -2.00, 0.37, 2.43, origin, u_dir, v_dir, mat_door_grey)
    add_box_uv("East_RearDoor_Glass", u_max, u_max + 0.05, -2.75, -2.55, 1.40, 2.15, origin, u_dir, v_dir, mat_glass)
    add_box_uv("East_RearDoor_Step", u_max, u_max + 0.55, -3.10, -1.80, 0.0, 0.35, origin, u_dir, v_dir, mat_concrete)

    # --------------------------------------------------------------------------
    # 7. NORTH-EAST CR WING (rares_building_24.1) + VANITY ALCOVE
    # --------------------------------------------------------------------------
    cr_us = [p.dot(u_dir) for p in poly_cr]
    cr_vs = [p.dot(v_dir) for p in poly_cr]
    cr_u0, cr_u1 = min(cr_us), max(cr_us)
    cr_v0, cr_v1 = min(cr_vs), max(cr_vs)

    add_prism_poly("CR_Plinth", poly_cr, 0.0, 0.25, mat_concrete)
    add_prism_poly("CR_Walls", poly_cr, 0.25, 2.75, mat_wall)

    # CR Lower Mono-Pitch Roof (overhangs South side to shelter the vanity sink alcove!)
    add_sloped_roof(
        "Roof_CR",
        u_max - 0.15, cr_u1 + 0.55,
        cr_v0 - 1.15, cr_v1 + 0.45,
        2.95, 2.75, 0.18,
        origin, u_dir, v_dir,
        mat_roof, mat_soffit, mat_fascia
    )

    # Vanity Counter + Vessel Sink + Wall Mirror on South wall of CR wing (alcove)
    van_u0, van_u1 = u_max + 0.05, u_max + 1.85
    add_box_uv("CR_Vanity_Counter", van_u0, van_u1, cr_v0 - 0.55, cr_v0 + 0.02, 0.78, 0.88, origin, u_dir, v_dir, mat_white)
    add_box_uv("CR_Vanity_Sink", van_u0 + 0.65, van_u0 + 1.15, cr_v0 - 0.42, cr_v0 - 0.08, 0.88, 1.00, origin, u_dir, v_dir, mat_white)
    add_box_uv("CR_Vanity_Mirror", van_u0 + 0.05, van_u1 - 0.05, cr_v0 - 0.04, cr_v0 + 0.01, 1.05, 2.00, origin, u_dir, v_dir, mat_mirror)

    # Two CR Doors on East wall of CR wing + Restroom Icon Plaques + Minimal Apron
    add_box_uv("CR_Apron", cr_u1, cr_u1 + 0.60, cr_v0 - 0.15, cr_v1 + 0.15, 0.0, 0.25, origin, u_dir, v_dir, mat_concrete)
    for idx, dv in enumerate([cr_v0 + 1.45, cr_v0 + 4.15]):
        add_box_uv(f"CR_DoorFrame_{idx}", cr_u1 - 0.02, cr_u1 + 0.06, dv - 0.48, dv + 0.48, 0.25, 2.32, origin, u_dir, v_dir, mat_frame)
        add_box_uv(f"CR_DoorLeaf_{idx}", cr_u1 - 0.01, cr_u1 + 0.04, dv - 0.43, dv + 0.43, 0.27, 2.27, origin, u_dir, v_dir, mat_door_grey)
        # Small restroom sign plaque between/next to doors
        add_box_uv(f"CR_Plaque_{idx}", cr_u1, cr_u1 + 0.03, dv - 0.62, dv - 0.52, 1.48, 1.62, origin, u_dir, v_dir, mat_frame)

    # Export GLB
    os.makedirs(os.path.dirname(OUTPUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_GLB,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
    )
    size_kb = os.path.getsize(OUTPUT_GLB) / 1024.0
    print(f"EXPORTED: {OUTPUT_GLB} ({size_kb:.2f} KB)")


if __name__ == "__main__":
    build_model()

