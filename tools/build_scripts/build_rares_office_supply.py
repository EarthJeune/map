import bpy
import bmesh
import math
import os

# ==============================================================================
# DA-RARES OFFICE SUPPLY STORAGE (rares_building_10) - AUTHENTIC 3D MODEL
# Station: Rizal Agricultural Research & Experiment Station (Tanay, Rizal)
# Reference Sources:
#   - Building Images RARES/Office Supply Storage/ (9 photos)
#   - rares_buildings.json exact 6-vertex L-shaped polygon
#   - rares_roads.json entrance node ([121.34069606, 14.57592076])
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

mat_green_wall  = create_mat("OSS_GreenWall",    "#1F5E3B", roughness=0.84)
mat_cream_wall  = create_mat("OSS_CreamWall",    "#DCD2A2", roughness=0.84)
mat_raw_conc    = create_mat("OSS_RawConcrete",  "#8F8E85", roughness=0.92)
mat_apron       = create_mat("OSS_Apron",        "#9B978C", roughness=0.90)
mat_roof_rust   = create_mat("OSS_RoofRust",     "#6E3C32", roughness=0.65, metallic=0.25)
mat_roof_silver = create_mat("OSS_RoofSilver",   "#A4A9A6", roughness=0.52, metallic=0.40)
mat_fascia_rust = create_mat("OSS_FasciaRust",   "#684638", roughness=0.75, metallic=0.20)
mat_timber      = create_mat("OSS_TimberRafter", "#5C4738", roughness=0.80)
mat_mesh        = create_mat("OSS_DarkMesh",     "#222522", roughness=0.70, metallic=0.35)
mat_door_sheet  = create_mat("OSS_DoorSheet",    "#C9CCC8", roughness=0.55, metallic=0.20)
mat_wood_door   = create_mat("OSS_WoodDoor",     "#63493B", roughness=0.72)
mat_frosted     = create_mat("OSS_FrostedGlass", "#AEB5B2", roughness=0.30, metallic=0.10)
mat_frame       = create_mat("OSS_DarkFrame",    "#3A2C24", roughness=0.55, metallic=0.25)
mat_louver      = create_mat("OSS_BreezeBlock",  "#7F7E74", roughness=0.88)

# Exact 6-vertex L-polygon in meters relative to centroid (E=+X, N=+Y) from rares_buildings.json
# v0: ( 2.84, -12.16) SSE
# v1: (-6.57,  -9.86) SSW
# v2: (-3.42,   2.98) WNW projecting corner
# v3: (-1.10,   2.34) inner step corner
# v4: ( 0.57,   9.32) NNW
# v5: ( 7.67,   7.37) NNE
V0 = ( 2.84, -12.16)
V1 = (-6.57,  -9.86)
V2 = (-3.42,   2.98)
V3 = (-1.10,   2.34)
V4 = ( 0.57,   9.32)
V5 = ( 7.67,   7.37)

# Local orthogonal basis aligned to West front edge (V1 -> V2):
# +V = along length (South -> North, ~76.2 deg, length ~20.4m total)
# +U = across width (West -> East, ~-13.8 deg, width ~9.69m)
lx, ly = V2[0] - V1[0], V2[1] - V1[1]
L_MAIN = math.hypot(lx, ly)   # 13.22m
vx, vy = lx / L_MAIN, ly / L_MAIN
ux, uy = vy, -vx              # +U points ESE (into building from West front)
ROT_Z = math.atan2(uy, ux)

OX, OY = V1[0], V1[1]
def to_world(u, v, z):
    return (OX + u * ux + v * vx, OY + u * uy + v * vy, z)

def create_box_uv(name, u, v, z, su, sv, sz, mat, tilt_u=0.0):
    bpy.ops.mesh.primitive_cube_add(location=to_world(u, v, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (su / 2.0, sv / 2.0, sz / 2.0)
    obj.rotation_euler = (0.0, tilt_u, ROT_Z)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj

W_MAIN  = 9.69   # V1 -> V0
STEP_U  = 2.41   # V2 -> V3
V_BREEZE_END = 15.20
V_TOTAL = 20.40  # V1 -> V4 along V
Z_FLOOR = 0.16
Z_EAVE  = 2.90
Z_RIDGE = 4.15
Z_CREAM_EAVE  = 2.65
Z_CREAM_RIDGE = 3.70

# 1. FLOOR SLABS + FRONT CONCRETE APRON (along V1->V2, Front.jpg)
create_box_uv("OSS_MainFloor", W_MAIN * 0.5, L_MAIN * 0.5, Z_FLOOR * 0.5, W_MAIN, L_MAIN, Z_FLOOR, mat_apron)
create_box_uv("OSS_NorthFloor", STEP_U + (W_MAIN - STEP_U) * 0.5, 0.5 * (L_MAIN + V_TOTAL), Z_FLOOR * 0.5,
              W_MAIN - STEP_U, V_TOTAL - L_MAIN, Z_FLOOR, mat_apron)
# Front sloped apron in front of green facade (u in [-1.5, 0.0], v in [0, L_MAIN])
create_box_uv("OSS_FrontApron", -0.85, L_MAIN * 0.5, 0.05, 1.70, L_MAIN, 0.10, mat_apron, tilt_u=0.06)
# 2-step concrete stoop at South front wood door (v ~ 1.6)
create_box_uv("OSS_FrontStoop", -0.35, 1.65, 0.12, 0.70, 1.25, 0.14, mat_raw_conc)

# 2. MAIN DARK-GREEN WING (v in [0, 13.22], u in [0, 9.69])
WALL_H = Z_EAVE - Z_FLOOR
# Front West wall (u = 0.12, full length 13.22m)
create_box_uv("OSS_Wall_WestFront", 0.12, L_MAIN * 0.5, Z_FLOOR + WALL_H * 0.5, 0.24, L_MAIN, WALL_H, mat_green_wall)
# 4 structural pilasters on front facade (Front.jpg)
for idx, pv in enumerate((0.15, 4.40, 8.60, L_MAIN - 0.15)):
    create_box_uv(f"OSS_Pilaster_{idx}", 0.04, pv, Z_FLOOR + WALL_H * 0.5, 0.14, 0.26, WALL_H, mat_green_wall)

# North step wall of main wing (v = 13.10, u from 0 to STEP_U+0.2)
create_box_uv("OSS_Wall_GreenNorthStep", (STEP_U + 0.20) * 0.5, L_MAIN - 0.12, Z_FLOOR + WALL_H * 0.5,
              STEP_U + 0.20, 0.24, WALL_H, mat_green_wall)
# 5x4 concrete breeze-block grid on North step wall (Left Side Front.jpg)
create_box_uv("OSS_Breeze_GreenStep", STEP_U * 0.5 + 0.10, L_MAIN + 0.01, 1.85, 1.45, 0.06, 1.15, mat_louver)

# South end wall: partial enclosed West half (u from 0 to 5.4) + open covered bay on SE (Right Side of Building.jpg)
create_box_uv("OSS_Wall_SouthWest", 2.70, 0.12, Z_FLOOR + WALL_H * 0.5, 5.40, 0.24, WALL_H, mat_green_wall)
# Small horizontal 2-pane sliding window + small high vent on South-West wall (Right Side of the Building.jpg)
create_box_uv("OSS_SouthWin_Frame", 2.20, -0.01, 1.65, 1.25, 0.06, 0.55, mat_frame)
create_box_uv("OSS_SouthWin_Glass", 2.20, -0.02, 1.65, 1.15, 0.04, 0.45, mat_frosted)
create_box_uv("OSS_SouthVent",      4.60, -0.01, 2.25, 0.45, 0.06, 0.45, mat_louver)

# Green square concrete pillars supporting the SE open covered storage bay (Right Side of the Building.jpg, IMG_4313.jpg)
for pname, pu, pv in (("CornerSE", W_MAIN - 0.20, 0.20),
                      ("MidSouth", 7.35, 0.20),
                      ("EastMid",  W_MAIN - 0.20, 4.40),
                      ("EastBay",  W_MAIN - 0.20, 8.20)):
    create_box_uv(f"OSS_Pillar_{pname}", pu, pv, Z_FLOOR + WALL_H * 0.5, 0.34, 0.34, WALL_H, mat_green_wall)
# Top tie beam over open SE bay
create_box_uv("OSS_OpenBeam_S", 7.50, 0.20, Z_EAVE - 0.15, 4.40, 0.30, 0.30, mat_green_wall)
create_box_uv("OSS_OpenBeam_E", W_MAIN - 0.20, 4.20, Z_EAVE - 0.15, 0.30, 8.20, 0.30, mat_green_wall)

# Solid interior enclosing green walls behind the SE open covered bay (Right Side of the Building.jpg, IMG_4313.jpg)
create_box_uv("OSS_InteriorWall_U", 5.30, 4.15, Z_FLOOR + WALL_H * 0.5, 0.24, 8.20, WALL_H, mat_green_wall)
create_box_uv("OSS_InteriorWall_V", 7.45, 8.20, Z_FLOOR + WALL_H * 0.5, 4.40, 0.24, WALL_H, mat_green_wall)
# Concrete platform & cylindrical metal tank tucked inside the SE open bay corner (IMG_4313.jpg)
create_box_uv("OSS_BayPlatform", 7.60, 7.35, Z_FLOOR + 0.32, 2.80, 1.35, 0.64, mat_raw_conc)
create_box_uv("OSS_BayTank",     8.65, 7.35, Z_FLOOR + 1.22, 0.85, 0.85, 1.15, mat_door_sheet)

# Raw concrete East rear bay (v in [8.20, 13.22], u = W_MAIN - 0.12) with 6x6 breeze-block grid (IMG_4312.jpg)
create_box_uv("OSS_Wall_EastRaw", W_MAIN - 0.12, 10.70, Z_FLOOR + WALL_H * 0.5, 0.24, 5.02, WALL_H, mat_raw_conc)
create_box_uv("OSS_Breeze_EastRaw", W_MAIN + 0.01, 10.70, 1.65, 0.06, 2.50, 1.50, mat_louver)

# Front West Facade Doors & Window (Front.jpg, Right Side Front.jpg)
# 1) South bay: Single weathered wood door (v ~ 1.65)
create_box_uv("OSS_FrontWoodDoor_Frame", -0.01, 1.65, Z_FLOOR + 1.12, 0.08, 1.05, 2.24, mat_frame)
create_box_uv("OSS_FrontWoodDoor_Leaf",  -0.02, 1.65, Z_FLOOR + 1.10, 0.06, 0.94, 2.16, mat_wood_door)
# 2) Middle bay: 3-panel grilled window (v ~ 6.10)
create_box_uv("OSS_FrontWin_Frame", -0.01, 6.10, 1.65, 0.08, 1.65, 1.25, mat_frame)
create_box_uv("OSS_FrontWin_Glass", -0.02, 6.10, 1.65, 0.05, 1.52, 1.12, mat_frosted)
for g in range(-3, 4):
    create_box_uv(f"OSS_FrontWin_Bar_{g}", -0.04, 6.10 + g * 0.21, 1.65, 0.03, 0.03, 1.12, mat_mesh)
# 3) North bay: Double steel-mesh / sheet-metal storage doors (v ~ 10.60)
create_box_uv("OSS_DoubleDoor_Frame", -0.01, 10.60, Z_FLOOR + 1.10, 0.08, 2.10, 2.20, mat_frame)
create_box_uv("OSS_DoubleDoor_Bot",   -0.03, 10.60, Z_FLOOR + 0.55, 0.06, 1.98, 1.05, mat_door_sheet)
create_box_uv("OSS_DoubleDoor_Top",   -0.03, 10.60, Z_FLOOR + 1.62, 0.06, 1.98, 1.05, mat_mesh)

# Gable end fill triangles for Main Green Wing (v = 0.12 and v = 13.10)
def add_gable_triangle(name, u_left, u_right, v_pos, z_base, z_peak, mat):
    m = bpy.data.meshes.new(name + "_Mesh")
    o = bpy.data.objects.new(name, m)
    bpy.context.collection.objects.link(o)
    bm = bmesh.new()
    u_mid = 0.5 * (u_left + u_right)
    pts = [(u_left, v_pos - 0.12, z_base), (u_right, v_pos - 0.12, z_base), (u_mid, v_pos - 0.12, z_peak),
           (u_left, v_pos + 0.12, z_base), (u_right, v_pos + 0.12, z_base), (u_mid, v_pos + 0.12, z_peak)]
    vs = [bm.verts.new(to_world(*p)) for p in pts]
    bm.faces.new([vs[0], vs[1], vs[2]])
    bm.faces.new([vs[5], vs[4], vs[3]])
    bm.faces.new([vs[0], vs[2], vs[5], vs[3]])
    bm.faces.new([vs[2], vs[1], vs[4], vs[5]])
    bm.faces.new([vs[1], vs[0], vs[3], vs[4]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(m)
    bm.free()
    o.data.materials.append(mat)

add_gable_triangle("OSS_MainGable_S", 0.0, W_MAIN, 0.12, Z_EAVE, Z_RIDGE, mat_green_wall)
add_gable_triangle("OSS_MainGable_N", 0.0, W_MAIN, L_MAIN - 0.12, Z_EAVE, Z_RIDGE, mat_green_wall)

# 3. CONNECTING BREEZEWAY (v in [13.22, 15.20], u in [STEP_U, W_MAIN])
# Recessed double steel-mesh door on steps at u = STEP_U (Left Side Front.jpg)
create_box_uv("OSS_Breeze_Steps", STEP_U - 0.35, 14.20, 0.15, 0.70, 2.00, 0.30, mat_raw_conc)
create_box_uv("OSS_Breeze_DoorBot", STEP_U + 0.05, 14.20, 0.85, 0.06, 1.80, 1.05, mat_door_sheet)
create_box_uv("OSS_Breeze_DoorTop", STEP_U + 0.05, 14.20, 1.85, 0.06, 1.80, 1.00, mat_mesh)
# Rear East wire-mesh cage wall (IMG_4312.jpg)
create_box_uv("OSS_Breeze_EastMesh", W_MAIN - 0.10, 14.20, Z_FLOOR + WALL_H * 0.5, 0.06, 2.00, WALL_H, mat_mesh)

# 4. RECESSED CREAM / PALE-YELLOW NORTH WING (v in [15.20, 20.40], u in [STEP_U, W_MAIN])
CREAM_W = W_MAIN - STEP_U
CREAM_L = V_TOTAL - V_BREEZE_END
CREAM_H = Z_CREAM_EAVE - Z_FLOOR
CREAM_CU = STEP_U + CREAM_W * 0.5
CREAM_CV = V_BREEZE_END + CREAM_L * 0.5

create_box_uv("OSS_CreamBlock", CREAM_CU, CREAM_CV, Z_FLOOR + CREAM_H * 0.5,
              CREAM_W, CREAM_L, CREAM_H, mat_cream_wall)
add_gable_triangle("OSS_CreamGable_N", STEP_U, W_MAIN, V_TOTAL - 0.12, Z_CREAM_EAVE, Z_CREAM_RIDGE, mat_cream_wall)

# West door ("OFFICE SUPPLY STORAGE") + 2-step stoop + 4-slot vent block (Left Side Front Close up.jpg)
create_box_uv("OSS_Cream_Stoop", STEP_U - 0.38, 17.50, 0.14, 0.76, 1.30, 0.28, mat_raw_conc)
create_box_uv("OSS_Cream_DoorFrame", STEP_U - 0.01, 17.50, Z_FLOOR + 1.05, 0.06, 1.05, 2.10, mat_frame)
create_box_uv("OSS_Cream_DoorGlass", STEP_U - 0.02, 17.50, Z_FLOOR + 1.05, 0.04, 0.94, 1.98, mat_frosted)
create_box_uv("OSS_Cream_VentW", STEP_U - 0.01, 15.95, 2.05, 0.05, 0.95, 0.42, mat_louver)
# North & East 4-slot vent blocks (Left SIde of the Building.jpg, IMG_4311.jpg)
create_box_uv("OSS_Cream_VentN", CREAM_CU, V_TOTAL + 0.01, 2.10, 0.95, 0.05, 0.42, mat_louver)
create_box_uv("OSS_Cream_VentE", W_MAIN + 0.01, CREAM_CV, 2.05, 0.05, 0.95, 0.42, mat_louver)

# 5. GABLE ROOFS FOR BOTH WINGS (Rusty brown main roof + Silver-grey cream wing roof)
def add_gable_roof(name, u_left, u_right, v_start, v_end, z_eave, z_ridge, ovh_u, ovh_v, mat_sheet, mat_fascia):
    half_w = 0.5 * (u_right - u_left)
    u_mid  = 0.5 * (u_left + u_right)
    slope_ang = math.atan2(z_ridge - z_eave, half_w)
    run_u = half_w + ovh_u
    slope_len = run_u / math.cos(slope_ang)
    drop_z = ovh_u * math.tan(slope_ang)
    tot_v = (v_end - v_start) + 2.0 * ovh_v
    cv = 0.5 * (v_start + v_end)
    cz = 0.5 * (z_ridge + (z_eave - drop_z)) + 0.04
    for sgn, sname in ((-1.0, "W"), (1.0, "E")):
        cu = u_mid + sgn * (run_u * 0.5)
        create_box_uv(f"{name}_{sname}", cu, cv, cz, slope_len, tot_v, 0.05, mat_sheet, tilt_u=sgn * slope_ang)
        # Fascia edge strip
        create_box_uv(f"{name}_Fascia_{sname}", u_mid + sgn * run_u, cv, z_eave - drop_z + 0.02,
                      0.04, tot_v, 0.14, mat_fascia)
    create_box_uv(f"{name}_Ridge", u_mid, cv, z_ridge + 0.05, 0.22, tot_v, 0.05, mat_sheet)

# Main wing + breezeway rusty-brown corrugated roof (v from 0 to 15.20)
add_gable_roof("OSS_RoofMain", 0.0, W_MAIN, 0.0, V_BREEZE_END, Z_EAVE, Z_RIDGE, 0.65, 0.45, mat_roof_rust, mat_fascia_rust)
# Cream North wing slightly lower silver-grey corrugated roof (v from 15.10 to 20.40)
add_gable_roof("OSS_RoofCream", STEP_U, W_MAIN, V_BREEZE_END - 0.10, V_TOTAL, Z_CREAM_EAVE, Z_CREAM_RIDGE, 0.50, 0.45, mat_roof_silver, mat_fascia_rust)

# Export GLB strictly under 300 KB
os.makedirs("models", exist_ok=True)
out_path = os.path.abspath("models/rares_office_supply.glb")
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"Exported {out_path} ({size_kb:.2f} KB)")

