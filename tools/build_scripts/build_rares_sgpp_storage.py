"""
Build script for DA-RARES SGPP Storage (rares_building_16).
Conforms strictly to the 4-vertex footprint in rares_buildings.json and
rares_entrance_16 (+0.76, +3.85) on the North front.
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

MAT_WALL_WHITE  = make_mat("WallWeatheredWhite", (0.76, 0.77, 0.74, 1.0), roughness=0.88)
MAT_BASE_SKIRT  = make_mat("WallBaseSkirt", (0.52, 0.50, 0.46, 1.0), roughness=0.92)
MAT_GABLE_NET   = make_mat("GableBlackNet", (0.09, 0.10, 0.09, 1.0), roughness=0.90)
MAT_ROOF_GI     = make_mat("RoofCorrugatedGI", (0.24, 0.19, 0.15, 1.0), roughness=0.58, metallic=0.42)
MAT_RAFTER_WOOD = make_mat("RafterWood", (0.36, 0.30, 0.24, 1.0), roughness=0.85)
MAT_DOOR_GREY   = make_mat("DoorPaintedGrey", (0.54, 0.57, 0.55, 1.0), roughness=0.55, metallic=0.20)
MAT_FRAME_WOOD  = make_mat("VentFrameWood", (0.42, 0.36, 0.29, 1.0), roughness=0.82)
MAT_KNOB_STEEL  = make_mat("KnobSteel", (0.72, 0.74, 0.75, 1.0), roughness=0.25, metallic=0.85)

# ---------------------------------------------------------------------------
# Footprint & Local Frame
# ---------------------------------------------------------------------------
# Exact (E, N) vertices relative to centroid [121.34094060, 14.57575305]
V_RAW = [
    ( 4.35,  3.43),  # v0: NE
    (-3.10,  4.50),  # v1: NW
    (-4.42, -3.41),  # v2: SW
    ( 3.17, -4.52),  # v3: SE
]

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
u_min = min(p[0] for p in UV_VERTS)
u_max = max(p[0] for p in UV_VERTS)
v_min = min(p[1] for p in UV_VERTS)
v_max = max(p[1] for p in UV_VERTS)
u_mid = 0.5 * (u_min + u_max)
v_mid = 0.5 * (v_min + v_max)

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

def add_gable_prism(name, u0, u_ridge, u1, v0, v1, z_eave, z_ridge, mat):
    """Triangular gable prism running along v from v0 to v1."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    s0 = [bm.verts.new((*to_en(u0, v0), z_eave)),
          bm.verts.new((*to_en(u1, v0), z_eave)),
          bm.verts.new((*to_en(u_ridge, v0), z_ridge))]
    s1 = [bm.verts.new((*to_en(u0, v1), z_eave)),
          bm.verts.new((*to_en(u1, v1), z_eave)),
          bm.verts.new((*to_en(u_ridge, v1), z_ridge))]
    bm.faces.new([s0[2], s0[1], s0[0]])
    bm.faces.new([s1[0], s1[1], s1[2]])
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new([s0[i], s0[j], s1[j], s1[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mat)
    return obj

def add_roof_slope(name, u_start, u_end, v0, v1, z_start, z_end, thick, mat):
    """Sloped roof slab from (u_start, z_start) to (u_end, z_end)."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bot = [
        bm.verts.new((*to_en(u_start, v0), z_start)),
        bm.verts.new((*to_en(u_end, v0), z_end)),
        bm.verts.new((*to_en(u_end, v1), z_end)),
        bm.verts.new((*to_en(u_start, v1), z_start)),
    ]
    top = [
        bm.verts.new((*to_en(u_start, v0), z_start + thick)),
        bm.verts.new((*to_en(u_end, v0), z_end + thick)),
        bm.verts.new((*to_en(u_end, v1), z_end + thick)),
        bm.verts.new((*to_en(u_start, v1), z_start + thick)),
    ]
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

# ---------------------------------------------------------------------------
# 1. Main Walls, Weathered Skirt, Pilasters & Top Beam
# ---------------------------------------------------------------------------
Z_EAVE = 2.55
Z_RIDGE = 3.65

# Base weathered skirt
add_uv_box("Base_Skirt", u_min - 0.01, u_max + 0.01, v_min - 0.01, v_max + 0.01, 0.0, 0.22, MAT_BASE_SKIRT)

# Main rectangular concrete stucco body
add_uv_box("Main_Walls", u_min, u_max, v_min, v_max, 0.22, Z_EAVE, MAT_WALL_WHITE)

# Top concrete lintel beam rim
add_uv_box("Top_Beam", u_min - 0.02, u_max + 0.02, v_min - 0.02, v_max + 0.02, Z_EAVE - 0.14, Z_EAVE, MAT_WALL_WHITE)

# 4 Corner pilasters + 2 mid-flank pilasters (seen in Gap photo)
pilaster_coords = [
    (u_min + 0.18, v_min + 0.18),
    (u_max - 0.18, v_min + 0.18),
    (u_min + 0.18, v_max - 0.18),
    (u_max - 0.18, v_max - 0.18),
    (u_min + 0.16, v_mid),
    (u_max - 0.16, v_mid),
]
for i, (pu, pv) in enumerate(pilaster_coords):
    add_uv_box(f"Pilaster_{i}", pu - 0.20, pu + 0.20, pv - 0.20, pv + 0.20, 0.0, Z_EAVE, MAT_WALL_WHITE)

# ---------------------------------------------------------------------------
# 2. North Front Entrance Door (Flush grey door on West-of-center)
# ---------------------------------------------------------------------------
door_uc = u_mid - 1.15
add_uv_box("Front_Door_Frame", door_uc - 0.52, door_uc + 0.52, v_max - 0.02, v_max + 0.04, 0.0, 2.12, MAT_WALL_WHITE)
add_uv_box("Front_Door_Leaf", door_uc - 0.45, door_uc + 0.45, v_max - 0.01, v_max + 0.05, 0.02, 2.05, MAT_DOOR_GREY)
add_uv_box("Front_Door_Knob", door_uc + 0.32, door_uc + 0.39, v_max + 0.05, v_max + 0.10, 0.98, 1.05, MAT_KNOB_STEEL)

# ---------------------------------------------------------------------------
# 3. West & East Flank High Screened Vent Windows (Gap photo)
# ---------------------------------------------------------------------------
for side_name, u_wall, sign in (("West", u_min, -1.0), ("East", u_max, 1.0)):
    for idx, vc in enumerate((v_mid - 1.85, v_mid + 1.85)):
        u0 = u_wall - 0.02 if sign > 0 else u_wall - 0.05
        u1 = u_wall + 0.05 if sign > 0 else u_wall + 0.02
        # Wood frame
        add_uv_box(f"{side_name}_Vent_Frame_{idx}", u0, u1, vc - 0.92, vc + 0.92, 1.85, 2.40, MAT_FRAME_WOOD)
        # Black screen interior
        add_uv_box(f"{side_name}_Vent_Screen_{idx}", u0 - 0.01 * sign, u1 + 0.01 * sign, vc - 0.85, vc + 0.85, 1.91, 2.34, MAT_GABLE_NET)

# ---------------------------------------------------------------------------
# 4. Gable Shade-Net Infill & Gable Corrugated Roof with Exposed Rafters
# ---------------------------------------------------------------------------
# Dark shade-net triangular gable infill (Z_EAVE to Z_RIDGE)
add_gable_prism("Gable_Black_Net", u_min + 0.02, u_mid, u_max - 0.02, v_min + 0.02, v_max - 0.02, Z_EAVE - 0.02, Z_RIDGE - 0.04, MAT_GABLE_NET)

# Roof overhangs: 0.48m on North/South gables, 0.40m on East/West eaves
ov_u = 0.40
ov_v = 0.48
half_span = (u_max - u_min) * 0.5
slope_drop = (Z_RIDGE - Z_EAVE) * ((half_span + ov_u) / half_span)
z_roof_eave = Z_RIDGE - slope_drop

# West roof slope & East roof slope
add_roof_slope("Roof_West_Slope", u_min - ov_u, u_mid, v_min - ov_v, v_max + ov_v, z_roof_eave, Z_RIDGE, 0.05, MAT_ROOF_GI)
add_roof_slope("Roof_East_Slope", u_mid, u_max + ov_u, v_min - ov_v, v_max + ov_v, Z_RIDGE, z_roof_eave, 0.05, MAT_ROOF_GI)

# Ridge cap
add_uv_box("Roof_Ridge_Cap", u_mid - 0.12, u_mid + 0.12, v_min - ov_v, v_max + ov_v, Z_RIDGE + 0.02, Z_RIDGE + 0.09, MAT_ROOF_GI)

# Exposed rafters along North & South gable overhangs (7 rafters each side)
for end_name, rv0, rv1 in (("North", v_max, v_max + ov_v - 0.04), ("South", v_min - ov_v + 0.04, v_min)):
    for i in range(1, 7):
        t = i / 7.0
        # West slope rafter
        ru_w = u_mid - t * (half_span + ov_u - 0.05)
        rz_w = Z_RIDGE - t * slope_drop - 0.07
        add_uv_box(f"Rafter_{end_name}_W_{i}", ru_w - 0.03, ru_w + 0.03, rv0, rv1, rz_w, rz_w + 0.07, MAT_RAFTER_WOOD)
        # East slope rafter
        ru_e = u_mid + t * (half_span + ov_u - 0.05)
        rz_e = Z_RIDGE - t * slope_drop - 0.07
        add_uv_box(f"Rafter_{end_name}_E_{i}", ru_e - 0.03, ru_e + 0.03, rv0, rv1, rz_e, rz_e + 0.07, MAT_RAFTER_WOOD)

# ---------------------------------------------------------------------------
# Export GLB
# ---------------------------------------------------------------------------
out_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\rares_sgpp_storage.glb"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"EXPORTED: {out_path} ({size_kb:.2f} KB)")
