import bpy
import bmesh
import math
import json
import os
from mathutils import Vector

# ==============================================================================
# Build Script: Mushroom Laboratory (rares_building_22)
# Station: DA-RARES (Tanay, Rizal)
# References: Building Images RARES/Mushroom Laboratory/*
# ==============================================================================

REPO_ROOT = r"c:\Users\LGU-SanPedro\Downloads\map"
RARES_BUILDINGS_JSON = os.path.join(REPO_ROOT, "rares_buildings.json")
OUTPUT_GLB = os.path.join(REPO_ROOT, "models", "rares_mushroom_laboratory.glb")


def make_mat(name, rgba, roughness=0.70, metallic=0.0):
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
    feat = next(ft for ft in data["features"] if ft["properties"].get("id") == "rares_building_22")
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


def add_gable_prism_ew(name, u0, u1, v_min, v_mid, v_max, z_eave, z_ridge, origin, u_dir, v_dir, mat):
    bm = bmesh.new()
    # Profile at u0 and u1: triangle (v_min, z_eave) -> (v_max, z_eave) -> (v_mid, z_ridge)
    p_w0 = origin + u_dir * u0 + v_dir * v_min
    p_w1 = origin + u_dir * u0 + v_dir * v_max
    p_wm = origin + u_dir * u0 + v_dir * v_mid
    p_e0 = origin + u_dir * u1 + v_dir * v_min
    p_e1 = origin + u_dir * u1 + v_dir * v_max
    p_em = origin + u_dir * u1 + v_dir * v_mid

    vw0 = bm.verts.new((p_w0.x, p_w0.y, z_eave))
    vw1 = bm.verts.new((p_w1.x, p_w1.y, z_eave))
    vwm = bm.verts.new((p_wm.x, p_wm.y, z_ridge))
    ve0 = bm.verts.new((p_e0.x, p_e0.y, z_eave))
    ve1 = bm.verts.new((p_e1.x, p_e1.y, z_eave))
    vem = bm.verts.new((p_em.x, p_em.y, z_ridge))

    bm.faces.new([vw0, vw1, vwm])
    bm.faces.new([ve1, ve0, vem])
    bm.faces.new([vw0, ve0, vem, vwm])
    bm.faces.new([vw1, vwm, vem, ve1])
    bm.faces.new([vw0, vw1, ve1, ve0])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return create_mesh_obj(name, bm, mat)


def add_roof_slope_ns(name, u0, u1, v_start, v_end, z_start, z_end, thick, origin, u_dir, v_dir, mat):
    bm = bmesh.new()
    p00 = origin + u_dir * u0 + v_dir * v_start
    p10 = origin + u_dir * u1 + v_dir * v_start
    p11 = origin + u_dir * u1 + v_dir * v_end
    p01 = origin + u_dir * u0 + v_dir * v_end

    b = [
        bm.verts.new((p00.x, p00.y, z_start)),
        bm.verts.new((p10.x, p10.y, z_start)),
        bm.verts.new((p11.x, p11.y, z_end)),
        bm.verts.new((p01.x, p01.y, z_end)),
    ]
    t = [
        bm.verts.new((p00.x, p00.y, z_start + thick)),
        bm.verts.new((p10.x, p10.y, z_start + thick)),
        bm.verts.new((p11.x, p11.y, z_end + thick)),
        bm.verts.new((p01.x, p01.y, z_end + thick)),
    ]
    bm.faces.new(b[::-1])
    bm.faces.new(t)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([b[i], b[j], t[j], t[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return create_mesh_obj(name, bm, mat)


def add_grilled_window(name, u_c, v_c, along_u, width, z0, z1, sign, origin, u_dir, v_dir, mat_glass, mat_grille):
    if along_u:
        va = v_c if sign > 0 else v_c - 0.05
        vb = v_c + 0.05 if sign > 0 else v_c
        add_uv_box(name + "_Glass", u_c - width / 2, u_c + width / 2, va, vb, z0, z1, origin, u_dir, v_dir, mat_glass)
        gva = vb - 0.01 if sign > 0 else va - 0.03
        gvb = vb + 0.03 if sign > 0 else va + 0.01
        # Perimeter + 2 vertical + 3 horizontal grille bars
        add_uv_box(name + "_GrT", u_c - width / 2, u_c + width / 2, gva, gvb, z1 - 0.03, z1, origin, u_dir, v_dir, mat_grille)
        add_uv_box(name + "_GrB", u_c - width / 2, u_c + width / 2, gva, gvb, z0, z0 + 0.03, origin, u_dir, v_dir, mat_grille)
        for k in range(5):
            uk = u_c - width / 2 + width * (k / 4.0)
            add_uv_box(f"{name}_GrV_{k}", uk - 0.015, uk + 0.015, gva, gvb, z0, z1, origin, u_dir, v_dir, mat_grille)
        for h in range(1, 4):
            zh = z0 + (z1 - z0) * (h / 4.0)
            add_uv_box(f"{name}_GrH_{h}", u_c - width / 2, u_c + width / 2, gva, gvb, zh - 0.012, zh + 0.012, origin, u_dir, v_dir, mat_grille)
    else:
        ua = u_c if sign > 0 else u_c - 0.05
        ub = u_c + 0.05 if sign > 0 else u_c
        add_uv_box(name + "_Glass", ua, ub, v_c - width / 2, v_c + width / 2, z0, z1, origin, u_dir, v_dir, mat_glass)
        gua = ub - 0.01 if sign > 0 else ua - 0.03
        gub = ub + 0.03 if sign > 0 else ua + 0.01
        add_uv_box(name + "_GrT", gua, gub, v_c - width / 2, v_c + width / 2, z1 - 0.03, z1, origin, u_dir, v_dir, mat_grille)
        add_uv_box(name + "_GrB", gua, gub, v_c - width / 2, v_c + width / 2, z0, z0 + 0.03, origin, u_dir, v_dir, mat_grille)
        for k in range(5):
            vk = v_c - width / 2 + width * (k / 4.0)
            add_uv_box(f"{name}_GrV_{k}", gua, gub, vk - 0.015, vk + 0.015, z0, z1, origin, u_dir, v_dir, mat_grille)
        for h in range(1, 4):
            zh = z0 + (z1 - z0) * (h / 4.0)
            add_uv_box(f"{name}_GrH_{h}", gua, gub, v_c - width / 2, v_c + width / 2, zh - 0.012, zh + 0.012, origin, u_dir, v_dir, mat_grille)


def build_model():
    clear_scene()
    poly = load_footprint()
    # v0=NW, v1=NE, v2=SE, v3=SW
    v0, v1, v2, v3 = poly
    u_dir = (v1 - v0).normalized()  # West -> East
    v_dir = Vector((u_dir.y, -u_dir.x, 0.0))  # North -> South? Wait: u_dir is ~(+1, +0.1), so (-u_dir.y, u_dir.x) is North!
    v_dir = Vector((-u_dir.y, u_dir.x, 0.0))  # South -> North
    origin = Vector((0.0, 0.0, 0.0))

    us = [p.dot(u_dir) for p in poly]
    vs = [p.dot(v_dir) for p in poly]
    u_min, u_max = min(us), max(us)
    v_min, v_max = min(vs), max(vs)
    v_mid = 0.5 * (v_min + v_max)

    # Materials
    mat_wall_cream = make_mat("WallCreamYellow", (0.62, 0.58, 0.30, 1.0), roughness=0.80)
    mat_dado_green = make_mat("DadoForestGreen", (0.035, 0.12, 0.055, 1.0), roughness=0.72)
    mat_concrete   = make_mat("ConcreteStoop", (0.44, 0.45, 0.43, 1.0), roughness=0.88)
    mat_roof       = make_mat("RoofWeatheredGI", (0.14, 0.12, 0.11, 1.0), roughness=0.55, metallic=0.40)
    mat_fascia_grn = make_mat("FasciaDarkGreen", (0.04, 0.14, 0.06, 1.0), roughness=0.65)
    mat_rafter     = make_mat("RafterTimber", (0.28, 0.22, 0.16, 1.0), roughness=0.85)
    mat_door_brn   = make_mat("DoorDarkBrown", (0.09, 0.05, 0.03, 1.0), roughness=0.50)
    mat_glass      = make_mat("WindowGlass", (0.05, 0.07, 0.08, 1.0), roughness=0.10, metallic=0.35)
    mat_grille     = make_mat("WindowGrille", (0.48, 0.50, 0.48, 1.0), roughness=0.45, metallic=0.60)
    mat_sign_white = make_mat("SignPanelWhite", (0.82, 0.83, 0.82, 1.0), roughness=0.45)
    mat_sign_org   = make_mat("SignAccentOrange", (0.65, 0.32, 0.06, 1.0), roughness=0.50)
    mat_steel_post = make_mat("SignSteelPost", (0.38, 0.40, 0.41, 1.0), roughness=0.40, metallic=0.75)

    Z_DADO = 0.42
    Z_EAVE = 2.85
    Z_RIDGE = 4.45

    # --------------------------------------------------------------------------
    # 1. MAIN WALLS (Dado + Cream Upper + Gable Triangles)
    # --------------------------------------------------------------------------
    add_prism_poly("Wall_Dado", poly, 0.0, Z_DADO, mat_dado_green)
    add_prism_poly("Wall_Upper", poly, Z_DADO, Z_EAVE, mat_wall_cream)
    add_gable_prism_ew("Gable_Walls", u_min, u_max, v_min, v_mid, v_max, Z_EAVE - 0.02, Z_RIDGE - 0.04, origin, u_dir, v_dir, mat_wall_cream)

    # Structural Pilasters (4 on North & South dividing into 3 bays; center on East & West)
    bay_us = [u_min + (u_max - u_min) * (i / 3.0) for i in range(4)]
    for i, pu in enumerate(bay_us):
        # North pilasters
        add_uv_box(f"Pilaster_N_{i}", pu - 0.16, pu + 0.16, v_max - 0.02, v_max + 0.12, 0.0, Z_DADO, origin, u_dir, v_dir, mat_dado_green)
        add_uv_box(f"Pilaster_N_U_{i}", pu - 0.16, pu + 0.16, v_max - 0.02, v_max + 0.12, Z_DADO, Z_EAVE, origin, u_dir, v_dir, mat_wall_cream)
        # South pilasters
        add_uv_box(f"Pilaster_S_{i}", pu - 0.16, pu + 0.16, v_min - 0.12, v_min + 0.02, 0.0, Z_DADO, origin, u_dir, v_dir, mat_dado_green)
        add_uv_box(f"Pilaster_S_U_{i}", pu - 0.16, pu + 0.16, v_min - 0.12, v_min + 0.02, Z_DADO, Z_EAVE, origin, u_dir, v_dir, mat_wall_cream)

    # East & West center pilasters
    for side, (ua, ub) in [("E", (u_max - 0.02, u_max + 0.10)), ("W", (u_min - 0.10, u_min + 0.02))]:
        add_uv_box(f"Pilaster_{side}_D", ua, ub, v_mid - 0.16, v_mid + 0.16, 0.0, Z_DADO, origin, u_dir, v_dir, mat_dado_green)
        add_uv_box(f"Pilaster_{side}_U", ua, ub, v_mid - 0.16, v_mid + 0.16, Z_DADO, Z_RIDGE - 0.08, origin, u_dir, v_dir, mat_wall_cream)

    # --------------------------------------------------------------------------
    # 2. E-W GABLE ROOF + OVERHANGS + EXPOSED RAFTERS + DARK GREEN FASCIA
    # --------------------------------------------------------------------------
    ov_u = 0.65
    ov_v = 0.72
    half_v = 0.5 * (v_max - v_min)
    drop = (Z_RIDGE - Z_EAVE) * ((half_v + ov_v) / half_v)
    z_roof_eave = Z_RIDGE - drop

    add_roof_slope_ns("Roof_Slope_N", u_min - ov_u, u_max + ov_u, v_mid, v_max + ov_v, Z_RIDGE, z_roof_eave, 0.06, origin, u_dir, v_dir, mat_roof)
    add_roof_slope_ns("Roof_Slope_S", u_min - ov_u, u_max + ov_u, v_min - ov_v, v_mid, z_roof_eave, Z_RIDGE, 0.06, origin, u_dir, v_dir, mat_roof)
    add_uv_box("Roof_Ridge", u_min - ov_u, u_max + ov_u, v_mid - 0.12, v_mid + 0.12, Z_RIDGE + 0.02, Z_RIDGE + 0.09, origin, u_dir, v_dir, mat_roof)

    # Dark green fascia boards on North & South eaves
    add_uv_box("Fascia_N", u_min - ov_u, u_max + ov_u, v_max + ov_v - 0.04, v_max + ov_v + 0.02, z_roof_eave - 0.10, z_roof_eave + 0.06, origin, u_dir, v_dir, mat_fascia_grn)
    add_uv_box("Fascia_S", u_min - ov_u, u_max + ov_u, v_min - ov_v - 0.02, v_min - ov_v + 0.04, z_roof_eave - 0.10, z_roof_eave + 0.06, origin, u_dir, v_dir, mat_fascia_grn)

    # Exposed timber rafters along North & South eaves
    for i in range(9):
        ru = u_min + (u_max - u_min) * (i / 8.0)
        add_uv_box(f"Rafter_N_{i}", ru - 0.04, ru + 0.04, v_max, v_max + ov_v - 0.04, z_roof_eave - 0.04, Z_EAVE, origin, u_dir, v_dir, mat_rafter)
        add_uv_box(f"Rafter_S_{i}", ru - 0.04, ru + 0.04, v_min - ov_v + 0.04, v_min, z_roof_eave - 0.04, Z_EAVE, origin, u_dir, v_dir, mat_rafter)

    # --------------------------------------------------------------------------
    # 3. NORTH (FRONT) FACADE (Door + Stoop + 3 Grilled Windows + Signboard)
    # --------------------------------------------------------------------------
    # East Bay (Bay 1, right-most in u from +2.5 to u_max): Window on East side + Door toward center
    bay1_c = 0.5 * (bay_us[2] + bay_us[3])
    bay2_c = 0.5 * (bay_us[1] + bay_us[2])
    bay3_c = 0.5 * (bay_us[0] + bay_us[1])

    # Door in East bay (toward center pilaster bay_us[2])
    door_u = bay_us[2] + 0.85
    add_uv_box("Front_Door_Frame", door_u - 0.50, door_u + 0.50, v_max - 0.02, v_max + 0.06, 0.26, 2.32, origin, u_dir, v_dir, mat_door_brn)
    add_uv_box("Front_Door_Lower", door_u - 0.44, door_u + 0.44, v_max, v_max + 0.04, 0.28, 1.28, origin, u_dir, v_dir, mat_door_brn)
    add_uv_box("Front_Door_Glass", door_u - 0.40, door_u + 0.40, v_max, v_max + 0.04, 1.32, 2.24, origin, u_dir, v_dir, mat_glass)

    # Elevated Concrete Entrance Stoop in front of Bay 1 door & window
    add_uv_box("Front_Stoop", bay_us[2] + 0.15, bay_us[3] - 0.45, v_max, v_max + 1.15, 0.0, 0.26, origin, u_dir, v_dir, mat_concrete)

    # Bay 1 Window (East of door)
    add_grilled_window("Front_Win_E", bay_us[3] - 1.55, v_max, True, 1.85, 1.05, 2.25, +1, origin, u_dir, v_dir, mat_glass, mat_grille)
    # Bay 2 Center Window + MUSHROOM PRODUCTION Signboard on steel posts
    add_grilled_window("Front_Win_C", bay2_c, v_max, True, 2.20, 1.05, 2.25, +1, origin, u_dir, v_dir, mat_glass, mat_grille)
    sign_u = bay2_c + 0.15
    sign_v = v_max + 0.36
    add_uv_box("Sign_Post_L", sign_u - 0.52, sign_u - 0.48, sign_v - 0.02, sign_v + 0.02, 0.0, 1.92, origin, u_dir, v_dir, mat_steel_post)
    add_uv_box("Sign_Post_R", sign_u + 0.48, sign_u + 0.52, sign_v - 0.02, sign_v + 0.02, 0.0, 1.92, origin, u_dir, v_dir, mat_steel_post)
    add_uv_box("Sign_Board", sign_u - 0.62, sign_u + 0.62, sign_v - 0.03, sign_v + 0.03, 1.08, 1.92, origin, u_dir, v_dir, mat_sign_white)
    add_uv_box("Sign_Stripe", sign_u + 0.34, sign_u + 0.60, sign_v - 0.035, sign_v + 0.035, 1.10, 1.90, origin, u_dir, v_dir, mat_sign_org)

    # Bay 3 Window (West bay)
    add_grilled_window("Front_Win_W", bay3_c, v_max, True, 2.20, 1.05, 2.25, +1, origin, u_dir, v_dir, mat_glass, mat_grille)

    # --------------------------------------------------------------------------
    # 4. EAST, WEST & SOUTH WINDOWS
    # --------------------------------------------------------------------------
    # East gable wall window (North-East half, seen in Left Side View.jpg)
    add_grilled_window("East_Win_N", u_max, v_mid + 1.95, False, 2.35, 1.05, 2.25, +1, origin, u_dir, v_dir, mat_glass, mat_grille)
    # West gable wall window
    add_grilled_window("West_Win_N", u_min, v_mid + 1.85, False, 2.15, 1.05, 2.25, -1, origin, u_dir, v_dir, mat_glass, mat_grille)
    # South rear wall windows
    add_grilled_window("South_Win_E", bay1_c, v_min, True, 2.15, 1.05, 2.25, -1, origin, u_dir, v_dir, mat_glass, mat_grille)
    add_grilled_window("South_Win_W", bay3_c, v_min, True, 2.15, 1.05, 2.25, -1, origin, u_dir, v_dir, mat_glass, mat_grille)

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
