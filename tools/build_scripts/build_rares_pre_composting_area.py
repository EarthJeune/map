import bpy
import bmesh
import math
import json
import os
from mathutils import Vector

# ==============================================================================
# Build Script: Pre-composting Area (rares_building_29)
# Station: DA-RARES (Tanay, Rizal)
# References: Building Images RARES/Pre Composting Area/IMG_3439-3440
# ==============================================================================

REPO_ROOT = r"c:\Users\LGU-SanPedro\Downloads\map"
RARES_BUILDINGS_JSON = os.path.join(REPO_ROOT, "rares_buildings.json")
OUTPUT_GLB = os.path.join(REPO_ROOT, "models", "rares_pre_composting_area.glb")


def make_mat(name, rgba, roughness=0.75, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def load_footprint():
    with open(RARES_BUILDINGS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    feat = next(ft for ft in data["features"] if ft["properties"].get("id") == "rares_building_29")
    ring = feat["geometry"]["coordinates"][0]
    pts = ring[:-1] if ring[0] == ring[-1] else ring
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    kx = 111320.0 * math.cos(math.radians(cy))
    ky = 110540.0
    return [Vector(((p[0] - cx) * kx, (p[1] - cy) * ky, 0.0)) for p in pts]


def create_mesh_obj(name, bm, mat):
    mesh = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def add_uv_box(name, u0, u1, v0, v1, z0, z1, origin, u_dir, v_dir, mat):
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


def add_beam_3d(name, p0, p1, half_w, half_h, mat):
    bm = bmesh.new()
    d = (p1 - p0).normalized()
    side = Vector((-d.y, d.x, 0.0))
    if side.length < 1e-4:
        side = Vector((1.0, 0.0, 0.0))
    side.normalize()
    up = d.cross(side).normalized()
    offs = [
        -side * half_w - up * half_h,
        side * half_w - up * half_h,
        side * half_w + up * half_h,
        -side * half_w + up * half_h,
    ]
    v0s = [bm.verts.new(p0 + o) for o in offs]
    v1s = [bm.verts.new(p1 + o) for o in offs]
    bm.faces.new(v0s[::-1])
    bm.faces.new(v1s)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([v0s[i], v0s[j], v1s[j], v1s[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return create_mesh_obj(name, bm, mat)


def add_roof_slope(name, u_start, u_end, v0, v1, z_start, z_end, thick, origin, u_dir, v_dir, mat):
    bm = bmesh.new()
    p00 = origin + u_dir * u_start + v_dir * v0
    p10 = origin + u_dir * u_end + v_dir * v0
    p11 = origin + u_dir * u_end + v_dir * v1
    p01 = origin + u_dir * u_start + v_dir * v1
    b = [
        bm.verts.new((p00.x, p00.y, z_start)),
        bm.verts.new((p10.x, p10.y, z_end)),
        bm.verts.new((p11.x, p11.y, z_end)),
        bm.verts.new((p01.x, p01.y, z_start)),
    ]
    t = [
        bm.verts.new((p00.x, p00.y, z_start + thick)),
        bm.verts.new((p10.x, p10.y, z_end + thick)),
        bm.verts.new((p11.x, p11.y, z_end + thick)),
        bm.verts.new((p01.x, p01.y, z_start + thick)),
    ]
    bm.faces.new(b[::-1])
    bm.faces.new(t)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([b[i], b[j], t[j], t[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return create_mesh_obj(name, bm, mat)


def build_model():
    clear_scene()
    poly = load_footprint()
    # v0=SE, v1=NE, v2=NW, v3=SW
    v0, v1, v2, v3 = poly
    u_dir = (v2 - v1).normalized()  # SE/NE -> NW width (~6.9m)
    v_dir = (v1 - v0).normalized()  # SW/SE -> NE/NW length (~7.3m, front at v_max)
    origin = Vector((0.0, 0.0, 0.0))

    us = [p.dot(u_dir) for p in poly]
    vs = [p.dot(v_dir) for p in poly]
    u_min, u_max = min(us), max(us)
    v_min, v_max = min(vs), max(vs)
    u_mid = 0.5 * (u_min + u_max)

    # Materials
    mat_concrete = make_mat("WeatheredConcrete", (0.50, 0.48, 0.44, 1.0), roughness=0.90)
    mat_compost  = make_mat("CompostFill", (0.11, 0.09, 0.06, 1.0), roughness=0.95)
    mat_truss    = make_mat("RustedSteelTruss", (0.24, 0.14, 0.10, 1.0), roughness=0.65, metallic=0.45)
    mat_roof_top = make_mat("TerracottaRustGI", (0.38, 0.14, 0.08, 1.0), roughness=0.55, metallic=0.35)
    mat_sign_bg  = make_mat("SignWhite", (0.85, 0.86, 0.86, 1.0), roughness=0.40)
    mat_sign_blu = make_mat("SignBlueText", (0.04, 0.18, 0.55, 1.0), roughness=0.45)
    mat_sign_grn = make_mat("SignGreenText", (0.04, 0.28, 0.08, 1.0), roughness=0.45)
    mat_ceramic  = make_mat("WhiteCeramicSink", (0.88, 0.89, 0.89, 1.0), roughness=0.20)

    Z_SLAB = 0.22
    Z_COL_TOP = 2.95
    Z_RIDGE = 4.25

    # --------------------------------------------------------------------------
    # 1. CONCRETE FLOOR SLAB, 6 COLUMNS & PERIMETER TIE-BEAMS
    # --------------------------------------------------------------------------
    add_uv_box("Floor_Slab", u_min, u_max, v_min, v_max, 0.0, Z_SLAB, origin, u_dir, v_dir, mat_concrete)

    col_us = [u_min + 0.35, u_max - 0.35]
    col_vs = [v_min + 0.35, 0.5 * (v_min + v_max), v_max - 0.35]
    for i, cu in enumerate(col_us):
        for j, cv in enumerate(col_vs):
            add_uv_box(f"Col_{i}_{j}", cu - 0.14, cu + 0.14, cv - 0.14, cv + 0.14, Z_SLAB, Z_COL_TOP, origin, u_dir, v_dir, mat_concrete)

    # Perimeter concrete tie-beams
    add_uv_box("Beam_Front", col_us[0] - 0.14, col_us[1] + 0.14, col_vs[2] - 0.14, col_vs[2] + 0.14, Z_COL_TOP - 0.28, Z_COL_TOP, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Beam_Rear", col_us[0] - 0.14, col_us[1] + 0.14, col_vs[0] - 0.14, col_vs[0] + 0.14, Z_COL_TOP - 0.28, Z_COL_TOP, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Beam_SideL", col_us[0] - 0.14, col_us[0] + 0.14, col_vs[0] - 0.14, col_vs[2] + 0.14, Z_COL_TOP - 0.28, Z_COL_TOP, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Beam_SideR", col_us[1] - 0.14, col_us[1] + 0.14, col_vs[0] - 0.14, col_vs[2] + 0.14, Z_COL_TOP - 0.28, Z_COL_TOP, origin, u_dir, v_dir, mat_concrete)

    # --------------------------------------------------------------------------
    # 2. EXPOSED RUSTED STEEL GABLE TRUSSES & CORRUGATED GABLE ROOF
    # --------------------------------------------------------------------------
    for j, tv in enumerate(col_vs):
        p_l = origin + u_dir * col_us[0] + v_dir * tv + Vector((0, 0, Z_COL_TOP))
        p_r = origin + u_dir * col_us[1] + v_dir * tv + Vector((0, 0, Z_COL_TOP))
        p_m = origin + u_dir * u_mid + v_dir * tv + Vector((0, 0, Z_COL_TOP))
        p_top = origin + u_dir * u_mid + v_dir * tv + Vector((0, 0, Z_RIDGE))
        add_beam_3d(f"Truss_King_{j}", p_m, p_top, 0.025, 0.025, mat_truss)
        add_beam_3d(f"Truss_RafterL_{j}", p_l, p_top, 0.03, 0.03, mat_truss)
        add_beam_3d(f"Truss_RafterR_{j}", p_r, p_top, 0.03, 0.03, mat_truss)
        p_ml = 0.5 * (p_l + p_m)
        p_mr = 0.5 * (p_r + p_m)
        p_tl = 0.5 * (p_l + p_top)
        p_tr = 0.5 * (p_r + p_top)
        add_beam_3d(f"Truss_WebL1_{j}", p_ml, p_tl, 0.02, 0.02, mat_truss)
        add_beam_3d(f"Truss_WebL2_{j}", p_m, p_tl, 0.02, 0.02, mat_truss)
        add_beam_3d(f"Truss_WebR1_{j}", p_mr, p_tr, 0.02, 0.02, mat_truss)
        add_beam_3d(f"Truss_WebR2_{j}", p_m, p_tr, 0.02, 0.02, mat_truss)

    ov_u = 0.65
    ov_v = 0.50
    half_u = 0.5 * (col_us[1] - col_us[0])
    drop = (Z_RIDGE - Z_COL_TOP) * ((half_u + ov_u) / half_u)
    z_re = Z_RIDGE - drop
    add_roof_slope("Roof_Slope_L", col_us[0] - ov_u, u_mid, v_min - ov_v, v_max + ov_v, z_re, Z_RIDGE, 0.05, origin, u_dir, v_dir, mat_roof_top)
    add_roof_slope("Roof_Slope_R", u_mid, col_us[1] + ov_u, v_min - ov_v, v_max + ov_v, Z_RIDGE, z_re, 0.05, origin, u_dir, v_dir, mat_roof_top)
    add_uv_box("Roof_Ridge", u_mid - 0.12, u_mid + 0.12, v_min - ov_v, v_max + ov_v, Z_RIDGE + 0.02, Z_RIDGE + 0.08, origin, u_dir, v_dir, mat_roof_top)

    # --------------------------------------------------------------------------
    # 3. CONCRETE PRE-DECOMPOSTING BINS + SIGNBOARD + LAVATORY SINK
    # --------------------------------------------------------------------------
    bu0, bu1 = u_mid - 2.15, u_mid + 2.15
    bv0, bv1 = v_min + 0.85, v_max - 1.10
    bv_mid = 0.5 * (bv0 + bv1)
    wt = 0.20

    # Outer bin walls + center partition
    add_uv_box("Bin_Front", bu0, bu1, bv1 - wt, bv1, Z_SLAB, 1.12, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Bin_Rear", bu0, bu1, bv0, bv0 + wt, Z_SLAB, 1.12, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Bin_SideL", bu0, bu0 + wt, bv0, bv1, Z_SLAB, 1.12, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Bin_SideR", bu1 - wt, bu1, bv0, bv1, Z_SLAB, 1.12, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Bin_MidPart", bu0 + wt, bu1 - wt, bv_mid - 0.10, bv_mid + 0.10, Z_SLAB, 1.12, origin, u_dir, v_dir, mat_concrete)

    # Organic compost fill inside the 2 bays
    add_uv_box("Bin_Fill_Front", bu0 + wt, bu1 - wt, bv_mid + 0.10, bv1 - wt, Z_SLAB, 0.78, origin, u_dir, v_dir, mat_compost)
    add_uv_box("Bin_Fill_Rear", bu0 + wt, bu1 - wt, bv0 + wt, bv_mid - 0.10, Z_SLAB, 0.78, origin, u_dir, v_dir, mat_compost)

    # "PRE-DECOMPOSTING AREA" signboard on front bin wall
    add_uv_box("Bin_Sign_Bg", u_mid - 0.95, u_mid + 0.95, bv1, bv1 + 0.03, 0.58, 0.84, origin, u_dir, v_dir, mat_sign_bg)
    add_uv_box("Bin_Sign_Txt", u_mid - 0.85, u_mid + 0.85, bv1 + 0.01, bv1 + 0.035, 0.65, 0.77, origin, u_dir, v_dir, mat_sign_blu)

    # Front-left Lavatory sink & "LAVATORY" sign on front-left column (u_min side)
    lu = col_us[0] - 0.38
    lv = col_vs[2] - 0.15
    add_uv_box("Lavatory_Stand", lu - 0.04, lu + 0.04, lv - 0.04, lv + 0.04, 0.0, 0.82, origin, u_dir, v_dir, mat_truss)
    add_uv_box("Lavatory_Basin", lu - 0.22, lu + 0.22, lv - 0.18, lv + 0.18, 0.82, 0.98, origin, u_dir, v_dir, mat_ceramic)
    add_uv_box("Lavatory_Sign_Bg", col_us[0] - 0.45, col_us[0] + 0.45, col_vs[2] + 0.14, col_vs[2] + 0.17, 1.55, 1.78, origin, u_dir, v_dir, mat_sign_bg)
    add_uv_box("Lavatory_Sign_Txt", col_us[0] - 0.36, col_us[0] + 0.36, col_vs[2] + 0.15, col_vs[2] + 0.175, 1.62, 1.71, origin, u_dir, v_dir, mat_sign_grn)

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
