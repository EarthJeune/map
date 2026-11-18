import bpy
import bmesh
import math
import json
import os
from mathutils import Vector

# ==============================================================================
# Build Script: Vermicomposting Facility (New) (rares_building_27)
# Station: DA-RARES (Tanay, Rizal)
# References: Building Images RARES/Vermicomposting Facility (New)/IMG_3436.HEIC
# ==============================================================================

REPO_ROOT = r"c:\Users\LGU-SanPedro\Downloads\map"
RARES_BUILDINGS_JSON = os.path.join(REPO_ROOT, "rares_buildings.json")
OUTPUT_GLB = os.path.join(REPO_ROOT, "models", "rares_vermicomposting_new.glb")


def make_mat(name, rgba, roughness=0.65, metallic=0.0):
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
    feat = next(ft for ft in data["features"] if ft["properties"].get("id") == "rares_building_27")
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


def add_cylinder_z(name, u_c, v_c, radius, z0, z1, origin, u_dir, v_dir, mat, segs=10):
    bm = bmesh.new()
    center = origin + u_dir * u_c + v_dir * v_c
    bot = []
    top = []
    for i in range(segs):
        a = 2.0 * math.pi * i / segs
        p = center + u_dir * (radius * math.cos(a)) + v_dir * (radius * math.sin(a))
        bot.append(bm.verts.new((p.x, p.y, z0)))
        top.append(bm.verts.new((p.x, p.y, z1)))
    bm.faces.new(bot[::-1])
    bm.faces.new(top)
    for i in range(segs):
        j = (i + 1) % segs
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
    # v0=SW, v1=SE, v2=NE, v3=NW
    v0, v1, v2, v3 = poly
    u_dir = (v1 - v0).normalized()  # NW -> SE width (~5.55m)
    v_dir = (v3 - v0).normalized()  # SW -> NE length (~7.23m, front gable at v_max)
    origin = Vector((0.0, 0.0, 0.0))

    us = [p.dot(u_dir) for p in poly]
    vs = [p.dot(v_dir) for p in poly]
    u_min, u_max = min(us), max(us)
    v_min, v_max = min(vs), max(vs)
    u_mid = 0.5 * (u_min + u_max)

    # Materials
    mat_concrete = make_mat("ConcreteBeds", (0.52, 0.51, 0.47, 1.0), roughness=0.88)
    mat_compost  = make_mat("DarkCompostSoil", (0.10, 0.08, 0.06, 1.0), roughness=0.95)
    mat_steel    = make_mat("OliveGreenSteel", (0.14, 0.18, 0.13, 1.0), roughness=0.45, metallic=0.65)
    mat_roof     = make_mat("WeatheredGreenGI", (0.15, 0.18, 0.14, 1.0), roughness=0.52, metallic=0.45)
    mat_sign_bg  = make_mat("SignBoardWhite", (0.82, 0.83, 0.78, 1.0), roughness=0.45)
    mat_sign_txt = make_mat("SignTextGreen", (0.04, 0.24, 0.08, 1.0), roughness=0.45)

    Z_PIER = 0.85
    Z_EAVE = 2.65
    Z_RIDGE = 3.85

    # --------------------------------------------------------------------------
    # 1. CONCRETE PIERS & GREEN STEEL PIPE COLUMNS (3 per side)
    # --------------------------------------------------------------------------
    col_us = [u_min + 0.22, u_max - 0.22]
    col_vs = [v_min + 0.25, 0.5 * (v_min + v_max), v_max - 0.25]
    for i, cu in enumerate(col_us):
        for j, cv in enumerate(col_vs):
            add_uv_box(f"Pier_{i}_{j}", cu - 0.16, cu + 0.16, cv - 0.16, cv + 0.16, 0.0, Z_PIER, origin, u_dir, v_dir, mat_concrete)
            add_cylinder_z(f"Col_{i}_{j}", cu, cv, 0.055, Z_PIER, Z_EAVE, origin, u_dir, v_dir, mat_steel)

    # Longitudinal eave beams
    for i, cu in enumerate(col_us):
        add_uv_box(f"EaveBeam_{i}", cu - 0.04, cu + 0.04, v_min + 0.15, v_max - 0.15, Z_EAVE - 0.08, Z_EAVE, origin, u_dir, v_dir, mat_steel)

    # --------------------------------------------------------------------------
    # 2. EXPOSED STEEL GABLE TRUSSES (Front, Middle, Rear)
    # --------------------------------------------------------------------------
    for j, tv in enumerate(col_vs):
        p_l = origin + u_dir * col_us[0] + v_dir * tv + Vector((0, 0, Z_EAVE))
        p_r = origin + u_dir * col_us[1] + v_dir * tv + Vector((0, 0, Z_EAVE))
        p_m = origin + u_dir * u_mid + v_dir * tv + Vector((0, 0, Z_EAVE))
        p_top = origin + u_dir * u_mid + v_dir * tv + Vector((0, 0, Z_RIDGE))
        add_beam_3d(f"Truss_Chord_{j}", p_l, p_r, 0.03, 0.03, mat_steel)
        add_beam_3d(f"Truss_King_{j}", p_m, p_top, 0.025, 0.025, mat_steel)
        add_beam_3d(f"Truss_RafterL_{j}", p_l, p_top, 0.03, 0.03, mat_steel)
        add_beam_3d(f"Truss_RafterR_{j}", p_r, p_top, 0.03, 0.03, mat_steel)
        # Diagonal web struts
        p_ml = 0.5 * (p_l + p_m)
        p_mr = 0.5 * (p_r + p_m)
        p_tl = 0.5 * (p_l + p_top)
        p_tr = 0.5 * (p_r + p_top)
        add_beam_3d(f"Truss_WebL1_{j}", p_ml, p_tl, 0.02, 0.02, mat_steel)
        add_beam_3d(f"Truss_WebL2_{j}", p_m, p_tl, 0.02, 0.02, mat_steel)
        add_beam_3d(f"Truss_WebR1_{j}", p_mr, p_tr, 0.02, 0.02, mat_steel)
        add_beam_3d(f"Truss_WebR2_{j}", p_m, p_tr, 0.02, 0.02, mat_steel)

    # --------------------------------------------------------------------------
    # 3. GABLE CORRUGATED ROOF + FRONT HANGING SIGNBOARD
    # --------------------------------------------------------------------------
    ov_u = 0.55
    ov_v = 0.45
    half_u = 0.5 * (col_us[1] - col_us[0])
    drop = (Z_RIDGE - Z_EAVE) * ((half_u + ov_u) / half_u)
    z_re = Z_RIDGE - drop
    add_roof_slope("Roof_Slope_L", u_min - ov_u, u_mid, v_min - ov_v, v_max + ov_v, z_re, Z_RIDGE, 0.04, origin, u_dir, v_dir, mat_roof)
    add_roof_slope("Roof_Slope_R", u_mid, u_max + ov_u, v_min - ov_v, v_max + ov_v, Z_RIDGE, z_re, 0.04, origin, u_dir, v_dir, mat_roof)
    add_uv_box("Roof_Ridge", u_mid - 0.10, u_mid + 0.10, v_min - ov_v, v_max + ov_v, Z_RIDGE + 0.02, Z_RIDGE + 0.07, origin, u_dir, v_dir, mat_roof)

    # Front hanging signboard: "VERMICOMPOSTING FACILITY"
    sv = col_vs[2]
    add_uv_box("Front_Sign_Panel", u_mid - 1.15, u_mid + 1.15, sv - 0.02, sv + 0.02, Z_EAVE - 0.36, Z_EAVE - 0.06, origin, u_dir, v_dir, mat_sign_bg)
    add_uv_box("Front_Sign_TextBar", u_mid - 0.95, u_mid + 0.95, sv - 0.025, sv + 0.025, Z_EAVE - 0.25, Z_EAVE - 0.16, origin, u_dir, v_dir, mat_sign_txt)

    # --------------------------------------------------------------------------
    # 4. TWO PARALLEL RAISED CONCRETE VERMI-BEDS INSIDE PAVILION
    # --------------------------------------------------------------------------
    bed_v0 = v_min + 0.50
    bed_v1 = v_max - 0.65
    for idx, (bu0, bu1) in enumerate([(u_min + 0.42, u_min + 1.62), (u_min + 1.82, u_min + 3.02)]):
        # Concrete outer walls & dark compost bed fill
        add_uv_box(f"Bed_Base_{idx}", bu0, bu1, bed_v0, bed_v1, 0.0, 0.72, origin, u_dir, v_dir, mat_concrete)
        add_uv_box(f"Bed_Compost_{idx}", bu0 + 0.14, bu1 - 0.14, bed_v0 + 0.14, bed_v1 - 0.14, 0.55, 0.74, origin, u_dir, v_dir, mat_compost)

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
