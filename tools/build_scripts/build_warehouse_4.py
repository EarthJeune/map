import bpy
import bmesh
import math

# Clear existing objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in bpy.data.meshes:
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    if block.users == 0:
        bpy.data.materials.remove(block)


def make_mat(name, rgba, roughness=0.75, metallic=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if alpha < 1.0 and "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
            if hasattr(mat, "blend_method"):
                mat.blend_method = 'BLEND'
    return mat


def create_box(name, center, size, rot=(0, 0, 0), mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=center, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def create_cyl(name, center, radius, depth, rot=(0, 0, 0), vertices=12, mat=None, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


# ==============================================================================
# MATERIALS (Ground-truth from '4 Full VIew.jpg', '4 Front View Middle Part.jpg',
# '4 Left Part 5 Right Part.jpg', '3 Left Part 4 Right Part.jpg', and '5c9b9b80.png')
# ==============================================================================
mat_slab = make_mat("WH4_ConcreteFloor", (0.52, 0.51, 0.48, 1.0), roughness=0.85)
mat_col_conc = make_mat("WH4_ColumnConcrete", (0.76, 0.75, 0.72, 1.0), roughness=0.78)
mat_rear_wall = make_mat("WH4_DarkRearWall", (0.16, 0.17, 0.18, 1.0), roughness=0.88)
mat_truss_steel = make_mat("WH4_TrussSteel", (0.34, 0.33, 0.30, 1.0), roughness=0.60, metallic=0.45)
mat_purlin_dark = make_mat("WH4_PurlinDark", (0.22, 0.21, 0.20, 1.0), roughness=0.65, metallic=0.35)

# Signature Light-Aqua / Mint-Green Corrugated Metal Roof ('5c9b9b80.png' & '4 Full VIew.jpg')
mat_roof_aqua1 = make_mat("WH4_RoofAqua1", (0.56, 0.76, 0.70, 1.0), roughness=0.48, metallic=0.22)
mat_roof_aqua2 = make_mat("WH4_RoofAqua2", (0.52, 0.72, 0.66, 1.0), roughness=0.52, metallic=0.20)
mat_fascia_rust = make_mat("WH4_FasciaRust", (0.46, 0.26, 0.18, 1.0), roughness=0.75, metallic=0.25)
mat_fascia_white = make_mat("WH4_FasciaWhite", (0.90, 0.91, 0.90, 1.0), roughness=0.50)

# Tractors & Agricultural Machinery Materials
mat_mf_red = make_mat("WH4_MasseyRed", (0.76, 0.14, 0.14, 1.0), roughness=0.42)
mat_kubota_orange = make_mat("WH4_KubotaOrange", (0.85, 0.32, 0.12, 1.0), roughness=0.45)
mat_thresher_terra = make_mat("WH4_ThresherTerra", (0.62, 0.28, 0.20, 1.0), roughness=0.65)
mat_mach_green = make_mat("WH4_MachineryGreen", (0.18, 0.48, 0.24, 1.0), roughness=0.50)
mat_canopy_teal = make_mat("WH4_CanopyTeal", (0.16, 0.48, 0.46, 1.0), roughness=0.50)
mat_canopy_white = make_mat("WH4_CanopyWhite", (0.88, 0.88, 0.86, 1.0), roughness=0.50)
mat_grille_silver = make_mat("WH4_GrilleSilver", (0.74, 0.76, 0.78, 1.0), roughness=0.35, metallic=0.65)
mat_chassis_grey = make_mat("WH4_ChassisGrey", (0.32, 0.34, 0.36, 1.0), roughness=0.60, metallic=0.40)
mat_tire_rubber = make_mat("WH4_TireRubber", (0.13, 0.13, 0.14, 1.0), roughness=0.88)
mat_tuktuk_black = make_mat("WH4_KudaBlack", (0.10, 0.11, 0.12, 1.0), roughness=0.40)
mat_tuktuk_gold = make_mat("WH4_KudaGold", (0.78, 0.62, 0.22, 1.0), roughness=0.50)

# ==============================================================================
# EXACT AERIAL DRONE COORDINATE SYSTEM (Rotation = 341.30 deg / Compass 161.30 deg)
# Center: [121.16693149, 13.96003591]
# Exact user polygon vertices in this 341.30 deg frame:
#   w4[0]: (-23.36, +3.61)   w4[7]: (+19.39, +3.59)  -> Rear wall Y = +3.60m!
#   w4[1]: (-23.00, -1.88)   w4[2]: (-8.75, -1.05)   -> Rear wing behind W3
#   w4[3]: (-8.83, -3.31)    w4[4]: (-7.49, -3.36)   -> Left roof step-out tab!
#   w4[5]: (-7.50, -4.36)    w4[6]: (+19.23, -4.34)  -> Front drip edge Y = -4.35m!
# Warehouse 3 in this 341.30 deg frame (rotated by -3.05 deg):
#   w3[2] (NW): (-21.84, -0.49), w3[3] (NE): (-7.71, +0.15), w3[0] (SE): (-7.20, -10.11)
# Warehouse 5 West wall: (+19.13, +3.48) to (+19.27, -3.91)
# ==============================================================================
X_REAR_LEFT = -23.20    # Matches w4[0]/w4[1] West projection visible in drone shot
X_TAB_LEFT = -8.80      # Matches w4[2]/w4[3] vertical flashing step-out tab
X_W3_WALL = -7.50       # Matches w4[4]/w4[5] flush alongside Warehouse 3 East wall
X_EAST_END = 19.20      # Matches w4[6]/w4[7] flush against Warehouse 5 West wall

Y_W3_REAR = -0.15       # Tucks cleanly under Warehouse 3 North eave (-0.49m to +0.15m)
Y_TAB_FRONT = -3.34     # Matches w4[3]/w4[4] step-out tab front edge
Y_REAR = 3.60           # Exact w4[0]..w4[7] continuous North rear line (+3.60m)
Y_BROW_FRONT = -4.35    # Exact w4[5]..w4[6] continuous South front eave line (-4.35m)
Y_SHED_FRONT = -3.55    # Main concrete column & steel truss line (0.80m behind front drip edge)

H_EAVE_FRONT = 2.52     # Front drip edge of mansard brow
H_TRUSS_BOT = 2.55      # Bottom chord of front steel truss
H_TRUSS_TOP = 2.88      # Top chord of front steel truss / main roof break
H_ROOF_REAR = 3.55      # Rear high point of main shed roof

root = bpy.data.objects.new("WH4_Root", None)
bpy.context.collection.objects.link(root)

# ==============================================================================
# PART A: REAR WING BEHIND WAREHOUSE 3 + STEP-OUT FLASHING TAB
# (X = -23.20m to -7.50m, Y = -0.15m to +3.60m, plus tab X = -8.80m..-7.50m to Y = -3.34m)
# ==============================================================================
REAR_EXT_W = X_TAB_LEFT - X_REAR_LEFT  # 14.40 m
REAR_EXT_CX = (X_REAR_LEFT + X_TAB_LEFT) / 2.0
REAR_EXT_D = Y_REAR - Y_W3_REAR        # 3.75 m
REAR_EXT_CY = (Y_W3_REAR + Y_REAR) / 2.0

# Floor slab & enclosed rear storage walls behind Warehouse 3
create_box("WH4_RearExtSlab", (REAR_EXT_CX, (0.20 + Y_REAR) / 2.0, 0.05), (REAR_EXT_W, Y_REAR - 0.20, 0.10), mat=mat_slab, parent=root)
create_box("WH4_RearExtNorthWall", (REAR_EXT_CX, Y_REAR - 0.08, 1.22), (REAR_EXT_W, 0.16, 2.44), mat=mat_rear_wall, parent=root)
create_box("WH4_RearExtWestWall", (X_REAR_LEFT + 0.08, (Y_W3_REAR - 0.80 + Y_REAR) / 2.0, 1.25), (0.16, Y_REAR - (Y_W3_REAR - 0.80), 2.50), mat=mat_rear_wall, parent=root)

# Light-Aqua Corrugated Roof over Rear Wing (sloping from Z = 2.74m under W3's eave down to Z = 2.46m at North rear)
ext_z_south = 2.74
ext_z_north = 2.46
ext_roof_y0 = -1.25     # Extends under W3's West/North overhang matching w4[1] (-1.88) to w4[2] (-1.05)
ext_roof_d = (Y_REAR + 0.15) - ext_roof_y0
ext_pitch = math.atan2(ext_z_south - ext_z_north, ext_roof_d)
ext_slope_len = math.hypot(ext_roof_d, ext_z_south - ext_z_north)
ext_mid_y = (ext_roof_y0 + Y_REAR + 0.15) / 2.0
ext_mid_z = (ext_z_south + ext_z_north) / 2.0

num_ext_sheets = 10
ext_sw = (REAR_EXT_W + 0.16) / num_ext_sheets
for i in range(num_ext_sheets):
    sx = (X_REAR_LEFT - 0.12) + (i + 0.5) * ext_sw
    rmat = mat_roof_aqua1 if (i % 2 == 0) else mat_roof_aqua2
    create_box(f"WH4_RearExtRoof_{i}", (sx, ext_mid_y, ext_mid_z), (ext_sw * 0.992, ext_slope_len, 0.035), rot=(-ext_pitch, 0, 0), mat=rmat, parent=root)

# Left Step-Out Flashing Roof Tab (X = -8.80m to -7.50m, Y = -3.34m to +3.65m, matching w4[2]->w4[3]->w4[4] in drone photo!)
TAB_W = X_W3_WALL - X_TAB_LEFT   # 1.30 m
TAB_CX = (X_TAB_LEFT + X_W3_WALL) / 2.0
TAB_D = (Y_REAR + 0.15) - Y_TAB_FRONT
TAB_CY = (Y_TAB_FRONT + Y_REAR + 0.15) / 2.0
tab_z0 = 2.78
tab_z1 = 3.25
tab_pitch = math.atan2(tab_z1 - tab_z0, TAB_D)
tab_len = math.hypot(TAB_D, tab_z1 - tab_z0)
create_box("WH4_StepTabRoof", (TAB_CX, TAB_CY, (tab_z0 + tab_z1) / 2.0), (TAB_W, tab_len, 0.04), rot=(tab_pitch, 0, 0), mat=mat_roof_aqua2, parent=root)

# ==============================================================================
# PART B: MAIN 4-BAY OPEN TRACTOR & AGRICULTURAL MACHINERY SHED
# (X = -7.50m to +19.20m, width = 26.70m; Y_BROW_FRONT = -4.35m to Y_REAR = +3.60m)
# ==============================================================================
MAIN_W = X_EAST_END - X_W3_WALL      # 26.70 m
MAIN_CX = (X_W3_WALL + X_EAST_END) / 2.0  # +5.85 m
MAIN_D = Y_REAR - Y_SHED_FRONT       # 7.15 m
MAIN_CY = (Y_SHED_FRONT + Y_REAR) / 2.0   # +0.025 m

# Concrete floor slab across the 4 bays (from front drip line Y = -4.35m to rear wall Y = +3.60m)
create_box("WH4_MainSlab", (MAIN_CX, (Y_BROW_FRONT + Y_REAR) / 2.0, 0.05), (MAIN_W, Y_REAR - Y_BROW_FRONT, 0.10), mat=mat_slab, parent=root)

# Dark Concrete Rear Wall (Y = Y_REAR) up to Z = 2.85m, leaving upper ventilation clerestory gap with truss lacing ('4 Front View Middle Part.jpg')
REAR_WALL_H = 2.85
create_box("WH4_MainRearWall", (MAIN_CX, Y_REAR - 0.09, REAR_WALL_H / 2.0), (MAIN_W, 0.18, REAR_WALL_H), mat=mat_rear_wall, parent=root)
# Rear upper steel truss chord & vertical struts along clerestory opening (Z = 2.85m to 3.48m)
create_box("WH4_RearTopChord", (MAIN_CX, Y_REAR - 0.08, H_ROOF_REAR - 0.08), (MAIN_W, 0.08, 0.08), mat=mat_truss_steel, parent=root)
for rx_i in range(18):
    rx = X_W3_WALL + 0.75 + rx_i * (MAIN_W / 18.0)
    create_box(f"WH4_RearClerestoryStrut_{rx_i}", (rx, Y_REAR - 0.08, (REAR_WALL_H + H_ROOF_REAR) / 2.0), (0.05, 0.05, H_ROOF_REAR - REAR_WALL_H), mat=mat_truss_steel, parent=root)

# 5 Square Concrete Columns along Front Bay Line (Y = Y_SHED_FRONT) + Rear Pilasters
bay_cols_x = [
    X_W3_WALL + 0.22,   # Col 0 (-7.46m, right beside Warehouse 3 East wall)
    -0.95,              # Col 1 (between Bay 1 and Bay 2)
    5.75,               # Col 2 (between Bay 2 and Bay 3)
    12.40,              # Col 3 (between Bay 3 and Bay 4)
    X_EAST_END - 0.22   # Col 4 (+18.80m, at East end next to Warehouse 5)
]
for c_idx, cx in enumerate(bay_cols_x):
    create_box(f"WH4_FrontCol_{c_idx}", (cx, Y_SHED_FRONT, H_TRUSS_TOP / 2.0), (0.36, 0.36, H_TRUSS_TOP), mat=mat_col_conc, parent=root)
    create_box(f"WH4_RearPilaster_{c_idx}", (cx, Y_REAR - 0.20, H_ROOF_REAR / 2.0), (0.34, 0.34, H_ROOF_REAR), mat=mat_col_conc, parent=root)

# Continuous Front Open-Web Steel Truss Beam ('4 Full VIew.jpg' & '4 Front View Middle Part.jpg')
create_box("WH4_FrontTrussBot", (MAIN_CX, Y_SHED_FRONT, H_TRUSS_BOT), (MAIN_W, 0.10, 0.06), mat=mat_truss_steel, parent=root)
create_box("WH4_FrontTrussTop", (MAIN_CX, Y_SHED_FRONT, H_TRUSS_TOP), (MAIN_W, 0.10, 0.06), mat=mat_truss_steel, parent=root)
truss_h = H_TRUSS_TOP - H_TRUSS_BOT
truss_cz = (H_TRUSS_BOT + H_TRUSS_TOP) / 2.0
num_web = 36
web_step = MAIN_W / num_web
for w_i in range(num_web + 1):
    wx = X_W3_WALL + w_i * web_step
    create_box(f"WH4_FrontTrussVert_{w_i}", (wx, Y_SHED_FRONT, truss_cz), (0.04, 0.06, truss_h), mat=mat_truss_steel, parent=root)
    if w_i < num_web:
        diag_ang = math.atan2(truss_h, web_step) if (w_i % 2 == 0) else -math.atan2(truss_h, web_step)
        create_box(f"WH4_FrontTrussDiag_{w_i}", (wx + web_step / 2.0, Y_SHED_FRONT, truss_cz), (math.hypot(web_step, truss_h), 0.04, 0.035), rot=(0, diag_ang, 0), mat=mat_truss_steel, parent=root)

# Transverse Steel Roof Trusses & Longitudinal Purlins visible underneath the shed roof
for cx in bay_cols_x:
    t_pitch = math.atan2(H_ROOF_REAR - H_TRUSS_TOP, MAIN_D)
    t_len = math.hypot(MAIN_D, H_ROOF_REAR - H_TRUSS_TOP)
    create_box(f"WH4_CrossTruss_{cx:.1f}", (cx, MAIN_CY, (H_TRUSS_TOP + H_ROOF_REAR) / 2.0 - 0.08), (0.08, t_len, 0.14), rot=(t_pitch, 0, 0), mat=mat_truss_steel, parent=root)

for p_i in range(6):
    py = Y_SHED_FRONT + (p_i + 0.5) * (MAIN_D / 6.0)
    pz = H_TRUSS_TOP + ((py - Y_SHED_FRONT) / MAIN_D) * (H_ROOF_REAR - H_TRUSS_TOP) - 0.04
    create_box(f"WH4_Purlin_{p_i}", (MAIN_CX, py, pz), (MAIN_W, 0.05, 0.06), mat=mat_purlin_dark, parent=root)

# Main Shed Roof Deck + Signature Front Mansard Brow Apron ('5c9b9b80.png', '4 Full VIew.jpg')
# 1) Main Roof Slope from Y_SHED_FRONT (-3.55m, Z = 2.94m) to Y_REAR + 0.12m (+3.72m, Z = 3.58m)
ROOF_Y0 = Y_SHED_FRONT
ROOF_Y1 = Y_REAR + 0.12
ROOF_D = ROOF_Y1 - ROOF_Y0
ROOF_Z0 = H_TRUSS_TOP + 0.06
ROOF_Z1 = H_ROOF_REAR + 0.05
main_pitch = math.atan2(ROOF_Z1 - ROOF_Z0, ROOF_D)
main_slope_len = math.hypot(ROOF_D, ROOF_Z1 - ROOF_Z0)
main_mid_y = (ROOF_Y0 + ROOF_Y1) / 2.0
main_mid_z = (ROOF_Z0 + ROOF_Z1) / 2.0

# 2) Steeply Sloped Front Mansard Brow Apron from Y_BROW_FRONT (-4.35m, Z = 2.52m) up to Y_SHED_FRONT (-3.50m, Z = 2.95m)
BROW_Y0 = Y_BROW_FRONT
BROW_Y1 = Y_SHED_FRONT + 0.05
BROW_D = BROW_Y1 - BROW_Y0
BROW_Z0 = H_EAVE_FRONT
BROW_Z1 = ROOF_Z0 + 0.01
brow_pitch = math.atan2(BROW_Z1 - BROW_Z0, BROW_D)
brow_slope_len = math.hypot(BROW_D, BROW_Z1 - BROW_Z0)
brow_mid_y = (BROW_Y0 + BROW_Y1) / 2.0
brow_mid_z = (BROW_Z0 + BROW_Z1) / 2.0

num_main_sheets = 22
sheet_w = MAIN_W / num_main_sheets
for s_i in range(num_main_sheets):
    sx = X_W3_WALL + (s_i + 0.5) * sheet_w
    rmat = mat_roof_aqua1 if (s_i % 2 == 0) else mat_roof_aqua2
    create_box(f"WH4_MainRoof_{s_i}", (sx, main_mid_y, main_mid_z), (sheet_w * 0.993, main_slope_len, 0.038), rot=(main_pitch, 0, 0), mat=rmat, parent=root)
    create_box(f"WH4_BrowRoof_{s_i}", (sx, brow_mid_y, brow_mid_z), (sheet_w * 0.993, brow_slope_len, 0.035), rot=(brow_pitch, 0, 0), mat=rmat, parent=root)

# Front Eave Fascia Trim: Rusty-brown metal along Bays 1–3, White fascia board along Bay 4 ('4 Left Part 5 Right Part.jpg')
RUST_FASCIA_W = 12.40 - X_W3_WALL
create_box("WH4_FasciaRust", ((X_W3_WALL + 12.40) / 2.0, BROW_Y0 + 0.02, BROW_Z0 - 0.03), (RUST_FASCIA_W, 0.04, 0.14), mat=mat_fascia_rust, parent=root)
WHITE_FASCIA_W = X_EAST_END - 12.40
create_box("WH4_FasciaWhite", ((12.40 + X_EAST_END) / 2.0, BROW_Y0 + 0.02, BROW_Z0 - 0.03), (WHITE_FASCIA_W, 0.04, 0.14), mat=mat_fascia_white, parent=root)

# ==============================================================================
# PART C: AUTHENTIC FARM TRACTORS, VEHICLES & IMPLEMENTS INSIDE BAYS 1–4
# ==============================================================================
def build_tractor(tag, cx, cy, body_mat, canopy_mat, scale_f=1.0, has_front_weights=False):
    # Rear wheels
    rw_r = 0.68 * scale_f
    rw_z = rw_r
    for side in [-1, 1]:
        create_cyl(f"WH4_{tag}_RW_{side}", (cx + side * 0.82 * scale_f, cy + 0.65 * scale_f, rw_z), rw_r, 0.34 * scale_f, rot=(0, math.pi/2, 0), vertices=14, mat=mat_tire_rubber, parent=root)
        create_cyl(f"WH4_{tag}_RRim_{side}", (cx + side * 0.84 * scale_f, cy + 0.65 * scale_f, rw_z), rw_r * 0.58, 0.36 * scale_f, rot=(0, math.pi/2, 0), vertices=12, mat=mat_grille_silver, parent=root)
    # Front wheels
    fw_r = 0.44 * scale_f
    fw_z = fw_r
    for side in [-1, 1]:
        create_cyl(f"WH4_{tag}_FW_{side}", (cx + side * 0.72 * scale_f, cy - 0.95 * scale_f, fw_z), fw_r, 0.24 * scale_f, rot=(0, math.pi/2, 0), vertices=12, mat=mat_tire_rubber, parent=root)
    # Chassis, Engine Hood, Grille & Fenders
    create_box(f"WH4_{tag}_Chassis", (cx, cy - 0.15 * scale_f, 0.68 * scale_f), (0.85 * scale_f, 2.10 * scale_f, 0.42 * scale_f), mat=mat_chassis_grey, parent=root)
    create_box(f"WH4_{tag}_Hood", (cx, cy - 0.45 * scale_f, 1.15 * scale_f), (0.76 * scale_f, 1.45 * scale_f, 0.62 * scale_f), mat=body_mat, parent=root)
    create_box(f"WH4_{tag}_Grille", (cx, cy - 1.18 * scale_f, 1.12 * scale_f), (0.72 * scale_f, 0.06 * scale_f, 0.56 * scale_f), mat=mat_grille_silver, parent=root)
    for side in [-1, 1]:
        create_box(f"WH4_{tag}_Fender_{side}", (cx + side * 0.72 * scale_f, cy + 0.65 * scale_f, 1.32 * scale_f), (0.36 * scale_f, 0.85 * scale_f, 0.14 * scale_f), mat=body_mat, parent=root)
    # Driver seat, Exhaust Pipe & ROPS Canopy
    create_box(f"WH4_{tag}_Seat", (cx, cy + 0.55 * scale_f, 1.38 * scale_f), (0.46 * scale_f, 0.42 * scale_f, 0.28 * scale_f), mat=mat_tire_rubber, parent=root)
    create_cyl(f"WH4_{tag}_Exhaust", (cx - 0.34 * scale_f, cy - 0.55 * scale_f, 1.72 * scale_f), 0.04 * scale_f, 0.95 * scale_f, vertices=8, mat=mat_tire_rubber, parent=root)
    if canopy_mat:
        can_h = 2.28 * scale_f
        for side in [-1, 1]:
            create_cyl(f"WH4_{tag}_ROPS_{side}", (cx + side * 0.58 * scale_f, cy + 0.75 * scale_f, (1.30 * scale_f + can_h) / 2.0), 0.03 * scale_f, can_h - 1.30 * scale_f, vertices=8, mat=mat_tire_rubber, parent=root)
        create_box(f"WH4_{tag}_Canopy", (cx, cy + 0.45 * scale_f, can_h), (1.38 * scale_f, 1.45 * scale_f, 0.08 * scale_f), mat=canopy_mat, parent=root)
    if has_front_weights:
        create_box(f"WH4_{tag}_Weights", (cx, cy - 1.35 * scale_f, 0.68 * scale_f), (0.58 * scale_f, 0.28 * scale_f, 0.32 * scale_f), mat=mat_fascia_rust, parent=root)

# 1. Bay 1 (X = -7.46m to -0.95m): Black/Gold "KUDA" Electric Tuk-Tuk & Motorcycles ('3 Left Part 4 Right Part.jpg')
create_box("WH4_KudaBody", (-5.45, -1.60, 0.92), (1.25, 2.20, 1.35), mat=mat_tuktuk_black, parent=root)
create_box("WH4_KudaRoof", (-5.45, -1.60, 1.65), (1.30, 2.25, 0.08), mat=mat_tuktuk_gold, parent=root)
for kwx, kwy in [(-6.05, -0.85), (-4.85, -0.85), (-5.45, -2.50)]:
    create_cyl(f"WH4_KudaWheel_{kwx}_{kwy}", (kwx, kwy, 0.26), 0.26, 0.14, rot=(0, math.pi/2, 0), vertices=10, mat=mat_tire_rubber, parent=root)

# Two parked motorcycles in Bay 1
for m_idx, (mx, m_mat) in enumerate([(-3.20, mat_mf_red), (-2.05, mat_canopy_teal)]):
    create_box(f"WH4_MotoBody_{m_idx}", (mx, -1.80, 0.62), (0.36, 1.45, 0.45), mat=m_mat, parent=root)
    create_cyl(f"WH4_MotoFW_{m_idx}", (mx, -2.40, 0.28), 0.28, 0.10, rot=(0, math.pi/2, 0), vertices=10, mat=mat_tire_rubber, parent=root)
    create_cyl(f"WH4_MotoRW_{m_idx}", (mx, -1.20, 0.28), 0.28, 0.12, rot=(0, math.pi/2, 0), vertices=10, mat=mat_tire_rubber, parent=root)

# 2. Bay 2 (X = -0.95m to +5.75m): Prominent Red Massey Ferguson 4WD Tractor + Secondary Utility Tractor ('4 Full VIew.jpg')
build_tractor("MasseyRed", 0.95, -2.05, mat_mf_red, mat_canopy_white, scale_f=1.02, has_front_weights=True)
build_tractor("UtilGrey", 3.85, -0.95, mat_chassis_grey, mat_canopy_white, scale_f=0.88, has_front_weights=False)

# 3. Bay 3 (X = +5.75m to +12.40m): Orange Kubota Tractor with Teal Canopy, Green Rack & Terracotta Thresher ('4 Front View Middle Part.jpg')
build_tractor("KubotaOrange", 7.55, -1.35, mat_kubota_orange, mat_canopy_teal, scale_f=0.92, has_front_weights=False)
# Green steel mobile rack next to Kubota
create_box("WH4_GreenRack", (9.45, -1.65, 0.72), (0.85, 1.35, 1.25), mat=mat_mach_green, parent=root)
# Terracotta-Orange Hopper Thresher with white sack chute at X = 11.10m
create_box("WH4_ThresherBody1", (11.10, -1.10, 0.85), (1.15, 1.75, 1.10), mat=mat_thresher_terra, parent=root)
create_box("WH4_ThresherHopper1", (11.10, -1.25, 1.62), (0.95, 0.95, 0.52), mat=mat_thresher_terra, parent=root)
create_box("WH4_ThresherSack1", (11.10, -2.05, 0.55), (0.28, 0.22, 0.85), mat=mat_fascia_white, parent=root)

# 4. Bay 4 (X = +12.40m to +18.80m): Second Hopper Thresher, Green Shredder, Compact Tractor & Utility Trailer ('4 Left Part 5 Right Part.jpg')
create_box("WH4_ThresherBody2", (13.85, -0.95, 0.82), (1.10, 1.65, 1.05), mat=mat_thresher_terra, parent=root)
create_box("WH4_ThresherHopper2", (13.85, -1.10, 1.55), (0.90, 0.85, 0.48), mat=mat_thresher_terra, parent=root)
create_box("WH4_GreenShredder", (15.25, -1.85, 0.68), (0.82, 1.15, 1.10), mat=mat_mach_green, parent=root)
build_tractor("CompactOrange", 16.55, -0.85, mat_kubota_orange, None, scale_f=0.76, has_front_weights=False)
# 2-wheel utility trailer cart at X = 17.85m
create_box("WH4_TrailerBed", (17.85, -2.10, 0.58), (1.25, 1.85, 0.42), mat=mat_chassis_grey, parent=root)
for tw_side in [-0.68, 0.68]:
    create_cyl(f"WH4_TrailerWheel_{tw_side}", (17.85 + tw_side, -2.10, 0.34), 0.34, 0.16, rot=(0, math.pi/2, 0), vertices=12, mat=mat_tire_rubber, parent=root)

# Join all WH4 mesh objects into a single optimized multi-material mesh under root
bpy.ops.object.select_all(action='DESELECT')
mesh_objs = [o for o in bpy.data.objects if o.name.startswith("WH4_") and o.type == 'MESH']
if mesh_objs:
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = "WH4_CombinedMesh"

# Export to models/warehouse_4.glb
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.name.startswith("WH4_"):
        obj.select_set(True)

export_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_4.glb"
bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True
)
print(f"Successfully exported {export_path}")
