import bpy
import bmesh
import math
import os

# ==============================================================================
# DA-RARES COMMON CR (rares_building_8) - AUTHENTIC 3D MODEL
# Station: Rizal Agricultural Research & Experiment Station (Tanay, Rizal)
# Reference Sources:
#   - Building Images RARES/Common CR/ (Front, Close Up Front, Left Side, Back)
#   - rares_buildings.json exact 4-vertex polygon
#   - rares_roads.json entrance node ([121.34089647, 14.57636993])
# ==============================================================================

bpy.ops.wm.read_factory_settings(use_empty=True)

def create_mat(name, hex_color, roughness=0.7, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    h = hex_color.lstrip('#')
    r, g, b = tuple(int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat

mat_wall      = create_mat("CR_OffWhiteWall",  "#E6E7DC", roughness=0.82)
mat_concrete  = create_mat("CR_ConcreteSlab",  "#B8B5AA", roughness=0.90)
mat_col_tile  = create_mat("CR_ColumnTile",    "#7A7E7F", roughness=0.58)
mat_col_grout = create_mat("CR_ColumnGrout",   "#C5C8C6", roughness=0.75)
mat_soffit    = create_mat("CR_WoodSoffit",    "#6D3E2E", roughness=0.68)
mat_fascia    = create_mat("CR_WhiteFascia",   "#DCE0DC", roughness=0.60)
mat_roof      = create_mat("CR_MetalRoof",     "#6E7B75", roughness=0.48, metallic=0.35)
mat_mesh      = create_mat("CR_BlackMesh",     "#1A1C1A", roughness=0.75, metallic=0.30)
mat_door      = create_mat("CR_WoodDoor",      "#5E3824", roughness=0.55)
mat_trim      = create_mat("CR_DarkBaseTrim",  "#3A332E", roughness=0.65)
mat_sink      = create_mat("CR_WhiteSink",     "#EAECE8", roughness=0.35)
mat_light     = create_mat("CR_TubeLight",     "#F2F5EE", roughness=0.25)
mat_pvc       = create_mat("CR_WhitePVC",      "#DCDED8", roughness=0.50)

# Exact polygon vertices in meters relative to centroid (E=+X, N=+Y) from rares_buildings.json
# v0: NW (-3.29,  3.19)
# v1: SW (-4.15, -1.77)
# v2: SE ( 3.24, -3.26)
# v3: NE ( 4.20,  1.83)
V0 = (-3.29,  3.19)
V1 = (-4.15, -1.77)
V2 = ( 3.24, -3.26)
V3 = ( 4.20,  1.83)

# Local orthogonal basis aligned to front edge (v1 -> v2):
# U = along front (Left -> Right, ~7.54m)
# V = depth (Front -> Back, ~5.03m)
fx, fy = V2[0] - V1[0], V2[1] - V1[1]
W = math.hypot(fx, fy)
ux, uy = fx / W, fy / W
# Inward/back normal (perp to U pointing toward V0/V3)
vx, vy = -uy, ux
D = ((V0[0] - V1[0]) * vx + (V0[1] - V1[1]) * vy + (V3[0] - V2[0]) * vx + (V3[1] - V2[1]) * vy) * 0.5
ROT_Z = math.atan2(uy, ux)

# Origin of local (u, v) frame: midpoint of front edge (V1, V2) -> u in [-W/2, +W/2], v in [0, D]
OX = 0.5 * (V1[0] + V2[0])
OY = 0.5 * (V1[1] + V2[1])

def to_world(u, v, z):
    return (OX + u * ux + v * vx, OY + u * uy + v * vy, z)

def create_box_uv(name, u, v, z, su, sv, sz, mat, tilt_x=0.0):
    bpy.ops.mesh.primitive_cube_add(location=to_world(u, v, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (su / 2.0, sv / 2.0, sz / 2.0)
    obj.rotation_euler = (tilt_x, 0.0, ROT_Z)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj

# Roof elevation as a function of depth v in [0, D]:
# Front (v=0) is HIGH (~3.55m), Back (v=D) is LOW (~2.45m)
Z_FRONT = 3.55
Z_BACK  = 2.45
def roof_z(v):
    return Z_FRONT + (Z_BACK - Z_FRONT) * (v / D)

ROOF_SLOPE_RAD = math.atan2(Z_BACK - Z_FRONT, D)

# 1. CONCRETE FLOOR SLAB / PLINTH + LOW FRONT PLANTER CURB (no plants per Rule 4)
Z_SLAB = 0.22
create_box_uv("CR_FloorSlab", 0.0, D * 0.5, Z_SLAB * 0.5, W, D, Z_SLAB, mat_concrete)
create_box_uv("CR_FrontCurb", 0.0, -0.10, 0.10, W * 0.96, 0.24, 0.20, mat_concrete)

# 2. THREE GREY-TILED FRONT PORCH COLUMNS (Left, Center, Right)
col_v = 0.20
col_w = 0.30
for idx, cu in enumerate((-W * 0.43, 0.0, W * 0.43)):
    col_top = roof_z(col_v) - 0.02
    col_h = col_top - Z_SLAB
    create_box_uv(f"CR_Col_{idx}", cu, col_v, Z_SLAB + col_h * 0.5, col_w, col_w, col_h, mat_col_tile)
    # Subtle horizontal tile grout bands
    for band_z in (0.65, 1.15, 1.65, 2.15, 2.65, 3.15):
        if band_z < col_top - 0.05:
            create_box_uv(f"CR_ColGrout_{idx}_{band_z:.2f}", cu, col_v, band_z, col_w + 0.01, col_w + 0.01, 0.018, mat_col_grout)

# 3. TWO SYMMETRICAL RESTROOM CUBICLES + CENTRAL OPEN WASH ALCOVE
# Porch depth = 1.45m; Cubicles run from v = 1.45m to v = D (5.03m)
V_CUB_FRONT = 1.45
V_CUB_BACK  = D - 0.05
CUB_D = V_CUB_BACK - V_CUB_FRONT
ALCOVE_HALF_W = 0.80  # Central open wash alcove width = 1.60m
CUB_W = (W * 0.92 - 2.0 * ALCOVE_HALF_W) * 0.5
Z_WALL_TOP = 2.35     # White stucco stops at 2.35m; mesh fills up to roof soffit

for side_name, sign in (("Left", -1.0), ("Right", 1.0)):
    cu = sign * (ALCOVE_HALF_W + CUB_W * 0.5)
    # White stucco cubicle block (solid walls up to Z_WALL_TOP)
    wall_h = Z_WALL_TOP - Z_SLAB
    create_box_uv(f"CR_Cubicle_{side_name}", cu, V_CUB_FRONT + CUB_D * 0.5, Z_SLAB + wall_h * 0.5,
                  CUB_W, CUB_D, wall_h, mat_wall)
    # Dark baseboard trim
    create_box_uv(f"CR_BaseTrim_{side_name}", cu, V_CUB_FRONT + CUB_D * 0.5, Z_SLAB + 0.04,
                  CUB_W + 0.02, CUB_D + 0.02, 0.08, mat_trim)

    # Inward-facing wooden restroom door (facing into central wash alcove)
    door_u = sign * ALCOVE_HALF_W
    create_box_uv(f"CR_Door_{side_name}", door_u, V_CUB_FRONT + 0.72, Z_SLAB + 1.05,
                  0.06, 0.86, 2.08, mat_door)

    # Upper black expanded-metal mesh band between Z_WALL_TOP and sloped roof soffit!
    # Build exact sloped mesh prism over each cubicle's footprint
    m = bpy.data.meshes.new(f"CR_Mesh_{side_name}_Mesh")
    o = bpy.data.objects.new(f"CR_Mesh_{side_name}", m)
    bpy.context.collection.objects.link(o)
    bm = bmesh.new()
    u0, u1 = cu - CUB_W * 0.49, cu + CUB_W * 0.49
    v0, v1 = V_CUB_FRONT + 0.02, V_CUB_BACK - 0.02
    pts = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    bv = [bm.verts.new(to_world(pu, pv, Z_WALL_TOP)) for (pu, pv) in pts]
    tv = [bm.verts.new(to_world(pu, pv, roof_z(pv) - 0.02)) for (pu, pv) in pts]
    bm.faces.new(list(reversed(bv)))
    bm.faces.new(tv)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([bv[i], bv[j], tv[j], tv[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(m)
    bm.free()
    o.data.materials.append(mat_mesh)

# 4. CENTRAL WASH ALCOVE BACK WALL + WHITE SINK COUNTER
# Back wall closing the rear of the central alcove
create_box_uv("CR_AlcoveBackWall", 0.0, V_CUB_BACK - 0.12, Z_SLAB + (Z_WALL_TOP - Z_SLAB) * 0.5,
              ALCOVE_HALF_W * 2.0 + 0.10, 0.24, Z_WALL_TOP - Z_SLAB, mat_wall)
# Mesh strip above alcove back wall
alc_mesh_h = max(0.08, roof_z(V_CUB_BACK - 0.12) - Z_WALL_TOP)
create_box_uv("CR_AlcoveBackMesh", 0.0, V_CUB_BACK - 0.12, Z_WALL_TOP + alc_mesh_h * 0.5,
              ALCOVE_HALF_W * 2.0, 0.18, alc_mesh_h, mat_mesh)
# Concrete/white sink counter inside central alcove
create_box_uv("CR_SinkCounter", 0.0, V_CUB_BACK - 0.48, Z_SLAB + 0.78,
              ALCOVE_HALF_W * 1.90, 0.52, 0.10, mat_sink)
create_box_uv("CR_SinkBasin", 0.0, V_CUB_BACK - 0.46, Z_SLAB + 0.87,
              0.52, 0.36, 0.10, mat_sink)

# 5. MONO-PITCH ROOF (Wood-plank soffit + White fascia + Corrugated roof sheet)
# Overhang: +0.55m front, +0.42m left/right, +0.40m back
u_min, u_max = -W * 0.5 - 0.42, W * 0.5 + 0.42
v_min, v_max = -0.55, D + 0.40

def make_sloped_roof_slab(name, z_off, thick, mat):
    m = bpy.data.meshes.new(name + "_Mesh")
    o = bpy.data.objects.new(name, m)
    bpy.context.collection.objects.link(o)
    bm = bmesh.new()
    pts = [(u_min, v_min), (u_max, v_min), (u_max, v_max), (u_min, v_max)]
    bv = [bm.verts.new(to_world(pu, pv, roof_z(pv) + z_off)) for (pu, pv) in pts]
    tv = [bm.verts.new(to_world(pu, pv, roof_z(pv) + z_off + thick)) for (pu, pv) in pts]
    bm.faces.new(list(reversed(bv)))
    bm.faces.new(tv)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([bv[i], bv[j], tv[j], tv[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(m)
    bm.free()
    o.data.materials.append(mat)
    return o

make_sloped_roof_slab("CR_WoodSoffit", -0.02, 0.03, mat_soffit)
make_sloped_roof_slab("CR_WhiteFascia", 0.01, 0.14, mat_fascia)
make_sloped_roof_slab("CR_MetalRoof",   0.15, 0.04, mat_roof)

# Subtle corrugated roof ribs running front-to-back
n_ribs = 14
for i in range(n_ribs):
    ru = u_min + 0.15 + i * ((u_max - u_min - 0.30) / (n_ribs - 1))
    mid_v = 0.5 * (v_min + v_max)
    rib_len = v_max - v_min
    create_box_uv(f"CR_RoofRib_{i}", ru, mid_v, roof_z(mid_v) + 0.20,
                  0.04, rib_len, 0.03, mat_roof, tilt_x=ROOF_SLOPE_RAD)

# 6. PORCH CEILING FLUORESCENT TUBE LIGHT + REAR GUTTER & DOWNSPOUT
create_box_uv("CR_PorchLight", 0.0, 0.72, roof_z(0.72) - 0.04, 1.15, 0.06, 0.05, mat_light)
# Rear gutter along back eave + white PVC downspout on Back-Right corner (Back View Close.jpg)
create_box_uv("CR_RearGutter", 0.0, v_max - 0.05, roof_z(v_max) + 0.05,
              u_max - u_min, 0.10, 0.08, mat_pvc)
create_box_uv("CR_Downspout_BR", W * 0.45, V_CUB_BACK + 0.04, Z_SLAB + 1.15,
              0.08, 0.08, 2.25, mat_pvc)

# Export GLB strictly under 300 KB
os.makedirs("models", exist_ok=True)
out_path = os.path.abspath("models/rares_common_cr.glb")
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"Exported {out_path} ({size_kb:.2f} KB)")

