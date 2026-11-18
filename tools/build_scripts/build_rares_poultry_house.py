import bpy
import bmesh
import math
import json
import os
from mathutils import Vector

# ==============================================================================
# Build Script: Poultry House (rares_building_25)
# Station: DA-RARES (Tanay, Rizal)
# References: Building Images RARES/Poultry House/IMG_3426-3430
# ==============================================================================

REPO_ROOT = r"c:\Users\LGU-SanPedro\Downloads\map"
RARES_BUILDINGS_JSON = os.path.join(REPO_ROOT, "rares_buildings.json")
OUTPUT_GLB = os.path.join(REPO_ROOT, "models", "rares_poultry_house.glb")


def make_mat(name, rgba, roughness=0.80, metallic=0.0):
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
    feat = next(ft for ft in data["features"] if ft["properties"].get("id") == "rares_building_25")
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


def add_corrugated_roof(name, u0, u1, v0, v1, z_u0, z_u1, thick, origin, u_dir, v_dir, mat, ribs_along_u=True):
    add_sloped_sheet(name + "_Deck", u0, u1, v0, v1, z_u0, z_u1, z_u1, z_u0, thick, origin, u_dir, v_dir, mat)
    if ribs_along_u:
        n = max(4, int((v1 - v0) / 0.25))
        for k in range(n + 1):
            vk = v0 + (v1 - v0) * (k / n)
            add_sloped_sheet(f"{name}_Rib_{k}", u0, u1, vk - 0.03, vk + 0.03, z_u0 + thick, z_u1 + thick, z_u1 + thick, z_u0 + thick, 0.03, origin, u_dir, v_dir, mat)


def build_model():
    clear_scene()
    poly = load_footprint()
    # v0=SE, v1=SW, v2=NW, v3=NE
    v0, v1, v2, v3 = poly
    u_dir = (v0 - v1).normalized()  # West -> East (front entrance at u_max)
    v_dir = Vector((-u_dir.y, u_dir.x, 0.0))  # South -> North
    origin = Vector((0.0, 0.0, 0.0))

    us = [p.dot(u_dir) for p in poly]
    vs = [p.dot(v_dir) for p in poly]
    u_min, u_max = min(us), max(us)
    v_min, v_max = min(vs), max(vs)

    # Materials
    mat_timber     = make_mat("RusticTimber", (0.24, 0.16, 0.10, 1.0), roughness=0.90)
    mat_ply_dark   = make_mat("DarkWeatheredPly", (0.12, 0.10, 0.09, 1.0), roughness=0.88)
    mat_ply_white  = make_mat("WhiteWeatheredBoard", (0.58, 0.56, 0.50, 1.0), roughness=0.82)
    mat_roof_wavy  = make_mat("WeatheredCementRoof", (0.36, 0.34, 0.30, 1.0), roughness=0.80)
    mat_roof_rust  = make_mat("RustyGIRoof", (0.28, 0.16, 0.11, 1.0), roughness=0.68, metallic=0.30)
    mat_net_rear   = make_mat("ShadeNetRear", (0.09, 0.10, 0.09, 1.0), roughness=0.92)
    mat_louver     = make_mat("WoodLouver", (0.30, 0.22, 0.15, 1.0), roughness=0.88)

    # --------------------------------------------------------------------------
    # 1. MAIN OPEN-FRONT TIMBER SHED (Center & North portion)
    # --------------------------------------------------------------------------
    shed_v0 = v_min + 1.05
    shed_v1 = v_max

    # Timber log posts (3 along East front, 3 along West rear)
    for idx, pv in enumerate([shed_v0 + 0.10, 0.5 * (shed_v0 + shed_v1), shed_v1 - 0.12]):
        add_uv_box(f"Post_E_{idx}", u_max - 0.18, u_max - 0.04, pv - 0.07, pv + 0.07, 0.0, 2.38, origin, u_dir, v_dir, mat_timber)
        add_uv_box(f"Post_W_{idx}", u_min + 0.04, u_min + 0.18, pv - 0.07, pv + 0.07, 0.0, 2.02, origin, u_dir, v_dir, mat_timber)

    # Top longitudinal beams & cross purlins
    add_uv_box("Beam_E", u_max - 0.18, u_max - 0.04, shed_v0, shed_v1, 2.32, 2.44, origin, u_dir, v_dir, mat_timber)
    add_uv_box("Beam_W", u_min + 0.04, u_min + 0.18, shed_v0, shed_v1, 1.96, 2.08, origin, u_dir, v_dir, mat_timber)
    for idx, pv in enumerate([shed_v0 + 0.10, 0.5 * (shed_v0 + shed_v1), shed_v1 - 0.12]):
        add_sloped_sheet(f"CrossBeam_{idx}", u_min, u_max, pv - 0.05, pv + 0.05, 2.02, 2.38, 2.38, 2.02, 0.10, origin, u_dir, v_dir, mat_timber)

    # Main wavy asbestos/cement roof (slopes gently down from East 2.48m to West 2.12m)
    add_corrugated_roof("Main_Roof", u_min - 0.35, u_max + 0.40, shed_v0 - 0.20, shed_v1 + 0.25, 2.12, 2.48, 0.05, origin, u_dir, v_dir, mat_roof_wavy)

    # North side rusty GI enclosure + lower lean-to roof extension
    add_uv_box("North_GI_Wall", u_min + 0.08, u_max - 0.12, shed_v1 - 0.06, shed_v1, 0.0, 1.80, origin, u_dir, v_dir, mat_roof_rust)
    add_sloped_sheet("North_LeanTo_Roof", u_min - 0.20, u_max + 0.15, shed_v1 - 0.10, shed_v1 + 0.45, 2.05, 2.25, 1.95, 1.75, 0.04, origin, u_dir, v_dir, mat_roof_rust)

    # West rear dark shade-net & weathered plywood enclosure
    add_uv_box("West_Rear_Net", u_min, u_min + 0.05, shed_v0 + 0.10, shed_v1 - 0.05, 0.0, 1.98, origin, u_dir, v_dir, mat_net_rear)
    add_uv_box("West_Rear_Board", u_min + 0.05, u_min + 0.09, shed_v0 + 0.20, shed_v0 + 1.40, 0.0, 1.85, origin, u_dir, v_dir, mat_ply_white)

    # --------------------------------------------------------------------------
    # 2. ATTACHED SOUTH-SIDE RAISED POULTRY COOP BOX (IMG_3426, IMG_3429)
    # --------------------------------------------------------------------------
    coop_u0 = u_min + 0.15
    coop_u1 = u_max - 0.25
    coop_v0 = v_min
    coop_v1 = shed_v0 + 0.55

    # 4 corner support legs elevating the coop ~0.38m off ground
    for idx, (cu, cv) in enumerate([
        (coop_u0 + 0.06, coop_v0 + 0.06),
        (coop_u1 - 0.06, coop_v0 + 0.06),
        (coop_u1 - 0.06, coop_v1 - 0.06),
        (coop_u0 + 0.06, coop_v1 - 0.06),
    ]):
        add_uv_box(f"Coop_Leg_{idx}", cu - 0.05, cu + 0.05, cv - 0.05, cv + 0.05, 0.0, 0.40, origin, u_dir, v_dir, mat_timber)

    # Coop box body (dark weathered plywood facing North into shed, white panel on South)
    add_uv_box("Coop_Box", coop_u0, coop_u1, coop_v0 + 0.04, coop_v1, 0.38, 1.78, origin, u_dir, v_dir, mat_ply_dark)
    add_uv_box("Coop_South_Panel", coop_u0 + 0.15, coop_u1 - 0.10, coop_v0, coop_v0 + 0.05, 0.42, 1.55, origin, u_dir, v_dir, mat_ply_white)

    # Wooden horizontal louver panel on East face of coop (IMG_3426, IMG_3429)
    for k in range(6):
        zk = 0.48 + k * 0.16
        add_uv_box(f"Coop_East_Louver_{k}", coop_u1, coop_u1 + 0.05, coop_v0 + 0.18, coop_v1 - 0.18, zk, zk + 0.10, origin, u_dir, v_dir, mat_louver)

    # Coop sloped rusty GI lean-to roof (slopes down toward South v_min)
    add_sloped_sheet("Coop_Roof", coop_u0 - 0.25, coop_u1 + 0.30, coop_v0 - 0.25, coop_v1 + 0.15, 1.52, 1.52, 1.98, 1.98, 0.04, origin, u_dir, v_dir, mat_roof_rust)

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
