import bpy
import bmesh
import math
import json
import os
from mathutils import Vector

# ==============================================================================
# Build Script: Farm House (rares_building_26)
# Station: DA-RARES (Tanay, Rizal)
# References: Building Images RARES/Farm House/IMG_3434-3435 + aerial drone view
# ==============================================================================

REPO_ROOT = r"c:\Users\LGU-SanPedro\Downloads\map"
RARES_BUILDINGS_JSON = os.path.join(REPO_ROOT, "rares_buildings.json")
OUTPUT_GLB = os.path.join(REPO_ROOT, "models", "rares_farm_house.glb")


def make_mat(name, rgba, roughness=0.78, metallic=0.0):
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
    feat = next(ft for ft in data["features"] if ft["properties"].get("id") == "rares_building_26")
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


def add_gable_prism_ns(name, u_min, u_mid, u_max, v0, v1, z_eave, z_ridge, origin, u_dir, v_dir, mat):
    bm = bmesh.new()
    ps0 = origin + u_dir * u_min + v_dir * v0
    ps1 = origin + u_dir * u_max + v_dir * v0
    psm = origin + u_dir * u_mid + v_dir * v0
    pn0 = origin + u_dir * u_min + v_dir * v1
    pn1 = origin + u_dir * u_max + v_dir * v1
    pnm = origin + u_dir * u_mid + v_dir * v1

    vs0 = bm.verts.new((ps0.x, ps0.y, z_eave))
    vs1 = bm.verts.new((ps1.x, ps1.y, z_eave))
    vsm = bm.verts.new((psm.x, psm.y, z_ridge))
    vn0 = bm.verts.new((pn0.x, pn0.y, z_eave))
    vn1 = bm.verts.new((pn1.x, pn1.y, z_eave))
    vnm = bm.verts.new((pnm.x, pnm.y, z_ridge))

    bm.faces.new([vs0, vs1, vsm])
    bm.faces.new([vn1, vn0, vnm])
    bm.faces.new([vs0, vn0, vnm, vsm])
    bm.faces.new([vs1, vsm, vnm, vn1])
    bm.faces.new([vs0, vs1, vn1, vn0])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return create_mesh_obj(name, bm, mat)


def add_sloped_sheet(name, u0, u1, v0, v1, z00, z10, z11, z01, thick, origin, u_dir, v_dir, mat):
    bm = bmesh.new()
    p00 = origin + u_dir * u0 + v_dir * v0
    p10 = origin + u_dir * u1 + v_dir * v0
    p11 = origin + u_dir * u1 + v_dir * v1
    p01 = origin + u_dir * u0 + v_dir * v1
    b = [
        bm.verts.new((p00.x, p00.y, z00)),
        bm.verts.new((p10.x, p10.y, z10)),
        bm.verts.new((p11.x, p11.y, z11)),
        bm.verts.new((p01.x, p01.y, z01)),
    ]
    t = [
        bm.verts.new((p00.x, p00.y, z00 + thick)),
        bm.verts.new((p10.x, p10.y, z10 + thick)),
        bm.verts.new((p11.x, p11.y, z11 + thick)),
        bm.verts.new((p01.x, p01.y, z01 + thick)),
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
    # Align local frame to main South edge: p6=(-6.43, -5.57) -> p5=(1.34, -7.89)
    p6 = poly[6]
    p5 = poly[5]
    u_dir = (p5 - p6).normalized()  # East-ish
    v_dir = Vector((-u_dir.y, u_dir.x, 0.0))  # North-ish
    origin = Vector((0.0, 0.0, 0.0))

    us = [p.dot(u_dir) for p in poly]
    vs = [p.dot(v_dir) for p in poly]
    u_min_all, u_max_all = min(us), max(us)
    v_min_all, v_max_all = min(vs), max(vs)

    # Main house core (centered around East-Center block)
    mu0, mu1 = -4.2, 4.0
    mv0, mv1 = -4.6, 3.6
    mu_mid = 0.5 * (mu0 + mu1)

    # Materials
    mat_wall_white = make_mat("WeatheredWhiteStucco", (0.64, 0.62, 0.57, 1.0), roughness=0.86)
    mat_concrete   = make_mat("RawConcrete", (0.42, 0.41, 0.38, 1.0), roughness=0.90)
    mat_roof_rust  = make_mat("RustyRedBrownGI", (0.16, 0.055, 0.035, 1.0), roughness=0.58, metallic=0.35)
    mat_roof_galv  = make_mat("WeatheredSilverGI", (0.48, 0.49, 0.47, 1.0), roughness=0.48, metallic=0.55)
    mat_tarp_cream = make_mat("PorchTarpCream", (0.60, 0.54, 0.40, 1.0), roughness=0.82)
    mat_timber     = make_mat("TimberPosts", (0.24, 0.16, 0.10, 1.0), roughness=0.88)
    mat_door_dark  = make_mat("DarkDoorway", (0.07, 0.06, 0.05, 1.0), roughness=0.75)
    mat_glass      = make_mat("WindowGlass", (0.05, 0.07, 0.08, 1.0), roughness=0.10, metallic=0.35)
    mat_grille     = make_mat("WindowGrille", (0.50, 0.52, 0.50, 1.0), roughness=0.45, metallic=0.55)

    Z_EAVE = 2.65
    Z_RIDGE = 3.95

    # --------------------------------------------------------------------------
    # 1. MAIN HOUSE ENCLOSED VOLUME (White weathered stucco + Rusty Red-Brown Roof)
    # --------------------------------------------------------------------------
    add_uv_box("Main_Plinth", mu0 - 0.10, mu1 + 0.10, mv0 - 0.10, mv1 + 0.10, 0.0, 0.25, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Main_Walls", mu0, mu1, mv0, mv1, 0.25, Z_EAVE, origin, u_dir, v_dir, mat_wall_white)
    add_gable_prism_ns("Main_Gable", mu0, mu_mid, mu1, mv0, mv1, Z_EAVE - 0.02, Z_RIDGE - 0.04, origin, u_dir, v_dir, mat_wall_white)

    # Main rusty reddish-brown corrugated GI gable roof (N-S ridge)
    ov_u = 0.55
    ov_v = 0.45
    half_u = 0.5 * (mu1 - mu0)
    drop = (Z_RIDGE - Z_EAVE) * ((half_u + ov_u) / half_u)
    z_re = Z_RIDGE - drop
    add_sloped_sheet("Main_Roof_W", mu0 - ov_u, mu_mid, mv0 - ov_v, mv1 + ov_v, z_re, Z_RIDGE, Z_RIDGE, z_re, 0.05, origin, u_dir, v_dir, mat_roof_rust)
    add_sloped_sheet("Main_Roof_E", mu_mid, mu1 + ov_u, mv0 - ov_v, mv1 + ov_v, Z_RIDGE, z_re, z_re, Z_RIDGE, 0.05, origin, u_dir, v_dir, mat_roof_rust)
    add_uv_box("Main_Ridge", mu_mid - 0.12, mu_mid + 0.12, mv0 - ov_v, mv1 + ov_v, Z_RIDGE + 0.02, Z_RIDGE + 0.08, origin, u_dir, v_dir, mat_roof_rust)

    # --------------------------------------------------------------------------
    # 2. SOUTH REAR LEAN-TO EXTENSION (Silvery-grey GI roof seen in drone view)
    # --------------------------------------------------------------------------
    sv0 = mv0 - 2.60
    sv1 = mv0
    add_uv_box("South_Ext_Walls", mu0 + 0.15, mu1 - 0.15, sv0, sv1, 0.0, 2.25, origin, u_dir, v_dir, mat_wall_white)
    add_sloped_sheet("South_Ext_Roof", mu0 - 0.30, mu1 + 0.30, sv0 - 0.35, sv1 + 0.25, 2.05, 2.05, 2.55, 2.55, 0.04, origin, u_dir, v_dir, mat_roof_galv)

    # --------------------------------------------------------------------------
    # 3. NORTH-WEST / NORTH FRONT OPEN PORCH & TARP CANOPY (IMG_3434)
    # --------------------------------------------------------------------------
    pu0 = -6.8
    pu1 = 3.2
    pv0 = mv1
    pv1 = mv1 + 3.2

    # Low concrete parapet curb around front porch
    add_uv_box("Porch_Slab", pu0, pu1, pv0, pv1, 0.0, 0.18, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Porch_Curb_Front", pu0, pu1, pv1 - 0.18, pv1, 0.18, 0.58, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Porch_Curb_W", pu0, pu0 + 0.18, pv0, pv1, 0.18, 0.58, origin, u_dir, v_dir, mat_concrete)

    # Timber porch posts
    for idx, xu in enumerate([pu0 + 0.15, -3.5, -0.5, 2.8]):
        add_uv_box(f"Porch_Post_{idx}", xu - 0.07, xu + 0.07, pv1 - 0.16, pv1 - 0.02, 0.18, 2.05, origin, u_dir, v_dir, mat_timber)

    # Sloped porch canopy: East half corrugated GI, West/Center half cream tarp canopy (IMG_3434)
    add_sloped_sheet("Porch_Roof_GI", -0.5, pu1 + 0.35, pv0 - 0.10, pv1 + 0.35, 2.45, 2.45, 1.98, 1.98, 0.04, origin, u_dir, v_dir, mat_roof_rust)
    add_sloped_sheet("Porch_Canopy_Tarp", pu0 - 0.25, -0.45, pv0 - 0.10, pv1 + 0.35, 2.38, 2.38, 1.92, 1.92, 0.05, origin, u_dir, v_dir, mat_tarp_cream)

    # Front Doorway & Grilled Window on North wall of main house
    add_uv_box("Front_Door", 1.2, 2.15, mv1 - 0.02, mv1 + 0.05, 0.18, 2.15, origin, u_dir, v_dir, mat_door_dark)
    add_uv_box("Front_Win_Glass", 2.5, 3.7, mv1 - 0.02, mv1 + 0.04, 1.05, 2.05, origin, u_dir, v_dir, mat_glass)
    add_uv_box("Front_Win_Grille", 2.5, 3.7, mv1 + 0.03, mv1 + 0.06, 1.53, 1.56, origin, u_dir, v_dir, mat_grille)

    # Side Wing (West projection seen in 10-vertex polygon)
    add_uv_box("West_Wing", -6.8, mu0, 0.2, mv1, 0.0, 2.35, origin, u_dir, v_dir, mat_wall_white)
    add_sloped_sheet("West_Wing_Roof", -7.1, mu0 + 0.2, 0.0, mv1 + 0.2, 2.30, 2.60, 2.60, 2.30, 0.04, origin, u_dir, v_dir, mat_roof_rust)

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
