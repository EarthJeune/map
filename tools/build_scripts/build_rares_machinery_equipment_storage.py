import bpy
import bmesh
import math
import json
import os
from mathutils import Vector

# ==============================================================================
# Build Script: Machinery & Equipment Storage (rares_building_28)
# Station: DA-RARES (Tanay, Rizal)
# References: Building Images RARES/Machinery & Equipment Storage/IMG_3437-3438
# ==============================================================================

REPO_ROOT = r"c:\Users\LGU-SanPedro\Downloads\map"
RARES_BUILDINGS_JSON = os.path.join(REPO_ROOT, "rares_buildings.json")
OUTPUT_GLB = os.path.join(REPO_ROOT, "models", "rares_machinery_equipment_storage.glb")


def make_mat(name, rgba, roughness=0.60, metallic=0.0):
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
    feat = next(ft for ft in data["features"] if ft["properties"].get("id") == "rares_building_28")
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


def add_sloped_roof(name, u0, u1, v0, v1, z_v0, z_v1, thick, origin, u_dir, v_dir, mat):
    bm = bmesh.new()
    p00 = origin + u_dir * u0 + v_dir * v0
    p10 = origin + u_dir * u1 + v_dir * v0
    p11 = origin + u_dir * u1 + v_dir * v1
    p01 = origin + u_dir * u0 + v_dir * v1
    b = [
        bm.verts.new((p00.x, p00.y, z_v0)),
        bm.verts.new((p10.x, p10.y, z_v0)),
        bm.verts.new((p11.x, p11.y, z_v1)),
        bm.verts.new((p01.x, p01.y, z_v1)),
    ]
    t = [
        bm.verts.new((p00.x, p00.y, z_v0 + thick)),
        bm.verts.new((p10.x, p10.y, z_v0 + thick)),
        bm.verts.new((p11.x, p11.y, z_v1 + thick)),
        bm.verts.new((p01.x, p01.y, z_v1 + thick)),
    ]
    bm.faces.new(b[::-1])
    bm.faces.new(t)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([b[i], b[j], t[j], t[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return create_mesh_obj(name, bm, mat)


def add_mesh_panel_uv(name, u0, u1, v0, v1, z0, z1, along_u, origin, u_dir, v_dir, mat_frame, mat_wire):
    # Outer frame
    if along_u:
        vm = 0.5 * (v0 + v1)
        add_uv_box(name + "_F_B", u0, u1, v0, v1, z0, z0 + 0.04, origin, u_dir, v_dir, mat_frame)
        add_uv_box(name + "_F_T", u0, u1, v0, v1, z1 - 0.04, z1, origin, u_dir, v_dir, mat_frame)
        add_uv_box(name + "_F_L", u0, u0 + 0.04, v0, v1, z0, z1, origin, u_dir, v_dir, mat_frame)
        add_uv_box(name + "_F_R", u1 - 0.04, u1, v0, v1, z0, z1, origin, u_dir, v_dir, mat_frame)
        # Combined bmesh for wire grid to keep primitive count minimal
        bm = bmesh.new()
        nx = max(4, int((u1 - u0) / 0.35))
        nz = max(4, int((z1 - z0) / 0.35))
        for k in range(1, nx):
            uk = u0 + (u1 - u0) * (k / nx)
            pts = [
                origin + u_dir * (uk - 0.008) + v_dir * (vm - 0.008),
                origin + u_dir * (uk + 0.008) + v_dir * (vm - 0.008),
                origin + u_dir * (uk + 0.008) + v_dir * (vm + 0.008),
                origin + u_dir * (uk - 0.008) + v_dir * (vm + 0.008),
            ]
            bot = [bm.verts.new((p.x, p.y, z0 + 0.04)) for p in pts]
            top = [bm.verts.new((p.x, p.y, z1 - 0.04)) for p in pts]
            for i in range(4):
                j = (i + 1) % 4
                bm.faces.new([bot[i], bot[j], top[j], top[i]])
        for h in range(1, nz):
            zh = z0 + (z1 - z0) * (h / nz)
            pts = [
                origin + u_dir * (u0 + 0.04) + v_dir * (vm - 0.008),
                origin + u_dir * (u1 - 0.04) + v_dir * (vm - 0.008),
                origin + u_dir * (u1 - 0.04) + v_dir * (vm + 0.008),
                origin + u_dir * (u0 + 0.04) + v_dir * (vm + 0.008),
            ]
            bot = [bm.verts.new((p.x, p.y, zh - 0.008)) for p in pts]
            top = [bm.verts.new((p.x, p.y, zh + 0.008)) for p in pts]
            for i in range(4):
                j = (i + 1) % 4
                bm.faces.new([bot[i], bot[j], top[j], top[i]])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        create_mesh_obj(name + "_Grid", bm, mat_wire)
    else:
        um = 0.5 * (u0 + u1)
        add_uv_box(name + "_F_B", u0, u1, v0, v1, z0, z0 + 0.04, origin, u_dir, v_dir, mat_frame)
        add_uv_box(name + "_F_T", u0, u1, v0, v1, z1 - 0.04, z1, origin, u_dir, v_dir, mat_frame)
        add_uv_box(name + "_F_L", u0, u1, v0, v0 + 0.04, z0, z1, origin, u_dir, v_dir, mat_frame)
        add_uv_box(name + "_F_R", u0, u1, v1 - 0.04, v1, z0, z1, origin, u_dir, v_dir, mat_frame)
        bm = bmesh.new()
        ny = max(4, int((v1 - v0) / 0.35))
        nz = max(4, int((z1 - z0) / 0.35))
        for k in range(1, ny):
            vk = v0 + (v1 - v0) * (k / ny)
            pts = [
                origin + u_dir * (um - 0.008) + v_dir * (vk - 0.008),
                origin + u_dir * (um + 0.008) + v_dir * (vk - 0.008),
                origin + u_dir * (um + 0.008) + v_dir * (vk + 0.008),
                origin + u_dir * (um - 0.008) + v_dir * (vk + 0.008),
            ]
            bot = [bm.verts.new((p.x, p.y, z0 + 0.04)) for p in pts]
            top = [bm.verts.new((p.x, p.y, z1 - 0.04)) for p in pts]
            for i in range(4):
                j = (i + 1) % 4
                bm.faces.new([bot[i], bot[j], top[j], top[i]])
        for h in range(1, nz):
            zh = z0 + (z1 - z0) * (h / nz)
            pts = [
                origin + u_dir * (um - 0.008) + v_dir * (v0 + 0.04),
                origin + u_dir * (um + 0.008) + v_dir * (v0 + 0.04),
                origin + u_dir * (um + 0.008) + v_dir * (v1 - 0.04),
                origin + u_dir * (um - 0.008) + v_dir * (v1 - 0.04),
            ]
            bot = [bm.verts.new((p.x, p.y, zh - 0.008)) for p in pts]
            top = [bm.verts.new((p.x, p.y, zh + 0.008)) for p in pts]
            for i in range(4):
                j = (i + 1) % 4
                bm.faces.new([bot[i], bot[j], top[j], top[i]])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        create_mesh_obj(name + "_Grid", bm, mat_wire)


def build_model():
    clear_scene()
    poly = load_footprint()
    # v0=SE, v1=NE, v2=NW, v3=SW
    v0, v1, v2, v3 = poly
    u_dir = (v2 - v1).normalized()  # NE -> NW (along front wall)
    v_dir = (v1 - v0).normalized()  # SE -> NE (toward front entrance)
    origin = Vector((0.0, 0.0, 0.0))

    us = [p.dot(u_dir) for p in poly]
    vs = [p.dot(v_dir) for p in poly]
    u_min, u_max = min(us), max(us)
    v_min, v_max = min(vs), max(vs)
    u_mid = 0.5 * (u_min + u_max)

    # Materials
    mat_concrete = make_mat("ConcreteFloor", (0.48, 0.47, 0.44, 1.0), roughness=0.90)
    mat_steel    = make_mat("SteelPipeGrey", (0.24, 0.25, 0.22, 1.0), roughness=0.48, metallic=0.65)
    mat_wire     = make_mat("WireMeshDark", (0.14, 0.14, 0.13, 1.0), roughness=0.45, metallic=0.75)
    mat_roof     = make_mat("CorrugatedGI", (0.20, 0.21, 0.20, 1.0), roughness=0.50, metallic=0.55)
    mat_plaque   = make_mat("PlaqueWhite", (0.82, 0.85, 0.86, 1.0), roughness=0.40)
    mat_light    = make_mat("SolarLampBody", (0.12, 0.13, 0.14, 1.0), roughness=0.40, metallic=0.50)

    Z_CURB = 0.25
    Z_WALL_TOP = 2.45
    Z_F_TRUSS_TOP = 2.95
    Z_R_TRUSS_TOP = 2.55

    # --------------------------------------------------------------------------
    # 1. CONCRETE SLAB & LOW PERIMETER CURBS
    # --------------------------------------------------------------------------
    add_uv_box("Floor_Slab", u_min, u_max, v_min, v_max, 0.0, 0.12, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Curb_Rear", u_min, u_max, v_min, v_min + 0.18, 0.12, Z_CURB, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Curb_SideL", u_min, u_min + 0.18, v_min, v_max, 0.12, Z_CURB, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Curb_SideR", u_max - 0.18, u_max, v_min, v_max, 0.12, Z_CURB, origin, u_dir, v_dir, mat_concrete)
    add_uv_box("Curb_Front_R", u_mid, u_max, v_max - 0.18, v_max, 0.12, Z_CURB, origin, u_dir, v_dir, mat_concrete)

    # --------------------------------------------------------------------------
    # 2. 6 STEEL PIPE COLUMNS & WARREN WEB TRUSSES
    # --------------------------------------------------------------------------
    col_us = [u_min + 0.12, u_mid, u_max - 0.12]
    col_vs = [v_min + 0.12, v_max - 0.12]
    for i, cu in enumerate(col_us):
        add_cylinder_z(f"Col_F_{i}", cu, col_vs[1], 0.055, 0.12, Z_F_TRUSS_TOP, origin, u_dir, v_dir, mat_steel)
        add_cylinder_z(f"Col_R_{i}", cu, col_vs[0], 0.055, 0.12, Z_R_TRUSS_TOP, origin, u_dir, v_dir, mat_steel)

    # Front & Rear horizontal trusses
    for side, (tv, z_bot, z_top) in [("F", (col_vs[1], Z_WALL_TOP, Z_F_TRUSS_TOP)), ("R", (col_vs[0], Z_WALL_TOP - 0.25, Z_R_TRUSS_TOP))]:
        add_uv_box(f"Truss_{side}_Bot", col_us[0], col_us[2], tv - 0.03, tv + 0.03, z_bot, z_bot + 0.05, origin, u_dir, v_dir, mat_steel)
        add_uv_box(f"Truss_{side}_Top", col_us[0], col_us[2], tv - 0.03, tv + 0.03, z_top - 0.05, z_top, origin, u_dir, v_dir, mat_steel)
        n_diag = 10
        for d in range(n_diag):
            ua = col_us[0] + (col_us[2] - col_us[0]) * (d / n_diag)
            ub = col_us[0] + (col_us[2] - col_us[0]) * ((d + 1) / n_diag)
            p_a = origin + u_dir * ua + v_dir * tv + Vector((0, 0, z_bot if d % 2 == 0 else z_top))
            p_b = origin + u_dir * ub + v_dir * tv + Vector((0, 0, z_top if d % 2 == 0 else z_bot))
            add_beam_3d(f"Truss_{side}_Diag_{d}", p_a, p_b, 0.018, 0.018, mat_steel)

    # --------------------------------------------------------------------------
    # 3. MONO-PITCH CORRUGATED GI ROOF & SOLAR FLOODLIGHTS
    # --------------------------------------------------------------------------
    add_sloped_roof("Roof_Deck", u_min - 0.45, u_max + 0.45, v_min - 0.40, v_max + 0.45, Z_R_TRUSS_TOP, Z_F_TRUSS_TOP + 0.08, 0.05, origin, u_dir, v_dir, mat_roof)

    # Two solar floodlights at front corners
    for idx, su in enumerate([col_us[0] + 0.25, col_us[2] - 0.25]):
        add_cylinder_z(f"Solar_Mast_{idx}", su, col_vs[1] + 0.10, 0.025, Z_F_TRUSS_TOP, Z_F_TRUSS_TOP + 0.55, origin, u_dir, v_dir, mat_steel, segs=8)
        add_uv_box(f"Solar_Head_{idx}", su - 0.14, su + 0.14, col_vs[1] + 0.08, col_vs[1] + 0.36, Z_F_TRUSS_TOP + 0.50, Z_F_TRUSS_TOP + 0.56, origin, u_dir, v_dir, mat_light)

    # --------------------------------------------------------------------------
    # 4. WIRE-MESH CAGE WALLS & FRONT DOUBLE GATE
    # --------------------------------------------------------------------------
    # Front Right fixed mesh panel + plaque
    add_mesh_panel_uv("Mesh_Front_R", u_mid + 0.06, col_us[2] - 0.06, col_vs[1] - 0.02, col_vs[1] + 0.02, Z_CURB, Z_WALL_TOP, True, origin, u_dir, v_dir, mat_steel, mat_wire)
    add_uv_box("Plaque_R", u_mid + 0.35, u_mid + 0.75, col_vs[1] + 0.01, col_vs[1] + 0.03, 1.35, 1.50, origin, u_dir, v_dir, mat_plaque)

    # Front Left double wire-mesh gate (partially swung open / closed look) + plaque
    add_mesh_panel_uv("Gate_Front_L", col_us[0] + 0.06, u_mid - 0.06, col_vs[1] - 0.02, col_vs[1] + 0.02, 0.14, Z_WALL_TOP, True, origin, u_dir, v_dir, mat_steel, mat_wire)
    add_uv_box("Plaque_L", col_us[0] + 0.75, col_us[0] + 1.15, col_vs[1] + 0.01, col_vs[1] + 0.03, 1.25, 1.40, origin, u_dir, v_dir, mat_plaque)

    # Rear, Left & Right perimeter mesh walls
    add_mesh_panel_uv("Mesh_Rear", col_us[0] + 0.06, col_us[2] - 0.06, col_vs[0] - 0.02, col_vs[0] + 0.02, Z_CURB, Z_WALL_TOP - 0.25, True, origin, u_dir, v_dir, mat_steel, mat_wire)
    add_mesh_panel_uv("Mesh_Side_L", col_us[0] - 0.02, col_us[0] + 0.02, col_vs[0] + 0.06, col_vs[1] - 0.06, Z_CURB, Z_WALL_TOP - 0.15, False, origin, u_dir, v_dir, mat_steel, mat_wire)
    add_mesh_panel_uv("Mesh_Side_R", col_us[2] - 0.02, col_us[2] + 0.02, col_vs[0] + 0.06, col_vs[1] - 0.06, Z_CURB, Z_WALL_TOP - 0.15, False, origin, u_dir, v_dir, mat_steel, mat_wire)

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
