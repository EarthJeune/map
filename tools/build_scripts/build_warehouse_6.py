import bpy
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


def make_mat(name, rgba, roughness=0.75, metallic=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
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


def create_cone(name, center, r1, r2, depth, rot=(0, 0, 0), vertices=14, mat=None, parent=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=center, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def create_prism(name, verts_3d, faces, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts_3d, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


# ==============================================================================
# MATERIALS (Linear-RGB calibrated to '6 Front View.jpg', '6 Side View.jpg',
# and aerial drone orthophoto '768a0d78.jpg')
# ==============================================================================
mat_concrete = make_mat("WH6_ConcreteSlab", (0.36, 0.35, 0.33, 1.0), roughness=0.88)
mat_pedestal = make_mat("WH6_ConcretePedestal", (0.52, 0.51, 0.48, 1.0), roughness=0.84)
mat_plinth_white = make_mat("WH6_WhiteBlockPlinth", (0.65, 0.65, 0.61, 1.0), roughness=0.80)

# Galvanized Steel Pipe Columns & Chimney Flue Stack
mat_pipe_galv = make_mat("WH6_GalvSteelPipe", (0.48, 0.51, 0.54, 1.0), roughness=0.36, metallic=0.68)
mat_flue_silver = make_mat("WH6_ChimneySilver", (0.64, 0.67, 0.71, 1.0), roughness=0.26, metallic=0.80)

# Rusted Angle-Iron Trusses, Fascia Trim & Roof Corrugated Iron ('768a0d78.jpg', '6 Front View.jpg')
mat_truss_rust = make_mat("WH6_TrussRust", (0.11, 0.042, 0.022, 1.0), roughness=0.76, metallic=0.32)
mat_fascia_rust = make_mat("WH6_FasciaRust", (0.16, 0.052, 0.022, 1.0), roughness=0.72, metallic=0.28)
mat_fascia_flake = make_mat("WH6_FasciaFlakeCream", (0.55, 0.48, 0.38, 1.0), roughness=0.78, metallic=0.10)

mat_roof_rust_dark = make_mat("WH6_RoofOxideRust1", (0.15, 0.024, 0.018, 1.0), roughness=0.64, metallic=0.22)
mat_roof_rust_mid = make_mat("WH6_RoofOxideRust2", (0.19, 0.032, 0.023, 1.0), roughness=0.66, metallic=0.20)
mat_roof_silver = make_mat("WH6_RoofGalvSilver", (0.74, 0.76, 0.78, 1.0), roughness=0.36, metallic=0.55)
mat_roof_under_galv = make_mat("WH6_CeilingGalv", (0.42, 0.44, 0.46, 1.0), roughness=0.48, metallic=0.45)
mat_roof_under_rust = make_mat("WH6_CeilingMottledRust", (0.13, 0.055, 0.036, 1.0), roughness=0.76, metallic=0.25)

# Biomass Furnace, Brick Firebox, Rotary Seed Dryer Drum & Equipment ('6 Side View.jpg')
mat_hopper_rust = make_mat("WH6_HopperRust", (0.18, 0.058, 0.026, 1.0), roughness=0.66, metallic=0.36)
mat_firebrick = make_mat("WH6_FirebrickGrey", (0.44, 0.39, 0.35, 1.0), roughness=0.86)
mat_ash_void = make_mat("WH6_DarkVoid", (0.015, 0.015, 0.016, 1.0), roughness=0.95)
mat_drum_rust = make_mat("WH6_RotaryDrumRust", (0.14, 0.062, 0.032, 1.0), roughness=0.64, metallic=0.40)
mat_drum_patina = make_mat("WH6_RotaryDrumPatina", (0.11, 0.14, 0.10, 1.0), roughness=0.62, metallic=0.36)
mat_hose_black = make_mat("WH6_FlexHoseBlack", (0.025, 0.027, 0.030, 1.0), roughness=0.65)
mat_steel_black = make_mat("WH6_BlackSteelFrame", (0.030, 0.033, 0.036, 1.0), roughness=0.55, metallic=0.50)

# Stored Green Roofing Stack, Yellow Canvas Tarp, Sacks & DA Project Billboard
mat_spare_green = make_mat("WH6_SpareGreenGI", (0.035, 0.14, 0.075, 1.0), roughness=0.48, metallic=0.28)
mat_tarp_yellow = make_mat("WH6_YellowCanvasTarp", (0.52, 0.43, 0.18, 1.0), roughness=0.74)
mat_sack_white = make_mat("WH6_WhiteSack", (0.74, 0.74, 0.71, 1.0), roughness=0.78)
mat_pallet_blue = make_mat("WH6_BluePallet", (0.04, 0.14, 0.36, 1.0), roughness=0.60)

mat_board_white = make_mat("WH6_SignBoardWhite", (0.84, 0.87, 0.90, 1.0), roughness=0.46)
mat_board_ink = make_mat("WH6_SignTextDark", (0.035, 0.048, 0.070, 1.0), roughness=0.60)
mat_board_grid = make_mat("WH6_SignGridGrey", (0.38, 0.41, 0.45, 1.0), roughness=0.55)
mat_da_green = make_mat("WH6_DASealGreen", (0.03, 0.22, 0.07, 1.0), roughness=0.50)
mat_da_gold = make_mat("WH6_DASealGold", (0.64, 0.44, 0.05, 1.0), roughness=0.45)

# ==============================================================================
# EXACT FOOTPRINT GEOMETRY IN TRUE 341.4 DEG FRAME
# Center: [121.16739217, 13.96008658], Mapbox rotation = 341.4 deg (front normal 161.4 deg SSE)
#   Roof Footprint (1:1 match to buildings.json polygon):
#     W = 7.14 m  (X_LEFT = -3.57 m  to  X_RIGHT = +3.57 m, Ridge along X = 0.0 m)
#     D = 8.50 m  (Y_FRONT = -4.25 m to  Y_REAR  = +4.25 m)
# ==============================================================================
W = 7.14
D = 8.50
HALF_W = W / 2.0        # 3.57 m
HALF_D = D / 2.0        # 4.25 m

H_EAVE = 2.48           # Eave height at X = +/-3.57 m
H_APEX = 3.38           # Gable ridge height along X = 0.0 m

COL_X = 2.45            # Structural column lines at X = -2.45 m and +2.45 m (1.12 m cantilevered eaves)
COL_YS = [-3.55, 0.0, 3.55]  # 3 bays along Y

root = bpy.data.objects.new("WH6_Root", None)
bpy.context.collection.objects.link(root)

# ==============================================================================
# 1. CONCRETE FLOOR PAD, 6 SQUARE CONCRETE PEDESTALS & GALVANIZED PIPE COLUMNS
# ==============================================================================
create_box("WH6_ConcreteFloorPad", (0.0, 0.0, 0.05), (5.50, 7.60, 0.10), mat=mat_concrete, parent=root)

# Height of roof slope at X = +/-COL_X
PITCH = math.atan2(H_APEX - H_EAVE, HALF_W)
Z_AT_COL = H_APEX - COL_X * math.tan(PITCH)  # ~2.76 m

for side_tag, cx in [("West", -COL_X), ("East", COL_X)]:
    for b_idx, cy in enumerate(COL_YS):
        # Square concrete footing pedestal ('6 Front View.jpg' & '6 Side View.jpg')
        create_box(f"WH6_Pedestal_{side_tag}_{b_idx}", (cx, cy, 0.21), (0.36, 0.36, 0.42), mat=mat_pedestal, parent=root)
        # Steel baseplate
        create_box(f"WH6_Baseplate_{side_tag}_{b_idx}", (cx, cy, 0.43), (0.20, 0.20, 0.02), mat=mat_truss_rust, parent=root)
        # Round galvanized steel pipe column up to truss chord
        col_h = Z_AT_COL - 0.44
        create_cyl(f"WH6_PipeCol_{side_tag}_{b_idx}", (cx, cy, 0.44 + col_h / 2.0), 0.062, col_h, vertices=10, mat=mat_pipe_galv, parent=root)

# ==============================================================================
# 2. EXPOSED OPEN-WEB RUSTED ANGLE-IRON GABLE TRUSSES & LONGITUDINAL PURLINS
# ==============================================================================
TRUSS_YS = [-3.55, -1.18, 1.18, 3.55]
Z_CHORD = 2.56  # Horizontal bottom tie chord height between X = -2.45 and +2.45
SLOPE_LEN = math.hypot(HALF_W, H_APEX - H_EAVE)

for t_idx, ty in enumerate(TRUSS_YS):
    # Horizontal bottom tie chord spanning between West and East columns
    create_box(f"WH6_TrussTie_{t_idx}", (0.0, ty, Z_CHORD), (COL_X * 2.0 + 0.10, 0.055, 0.055), mat=mat_truss_rust, parent=root)

    # Cantilevered eave outrigger struts (from column top out to eave tip X = +/-3.52m)
    for s_sign in (-1, 1):
        out_x0 = s_sign * COL_X
        out_x1 = s_sign * (HALF_W - 0.06)
        out_dx = out_x1 - out_x0
        out_dz = (H_EAVE - 0.03) - Z_CHORD
        out_len = math.hypot(out_dx, out_dz)
        out_ang = math.atan2(out_dz, abs(out_dx))
        create_box(
            f"WH6_TrussOutrigger_{t_idx}_{s_sign}",
            ((out_x0 + out_x1) / 2.0, ty, (Z_CHORD + H_EAVE - 0.03) / 2.0),
            (out_len, 0.05, 0.05),
            rot=(0, -s_sign * out_ang, 0),
            mat=mat_truss_rust,
            parent=root
        )

    # Left & Right sloped top chords
    create_box(
        f"WH6_TrussTopL_{t_idx}",
        (-HALF_W / 2.0, ty, (H_EAVE + H_APEX) / 2.0 - 0.03),
        (SLOPE_LEN, 0.055, 0.055),
        rot=(0, -PITCH, 0),
        mat=mat_truss_rust,
        parent=root
    )
    create_box(
        f"WH6_TrussTopR_{t_idx}",
        (HALF_W / 2.0, ty, (H_EAVE + H_APEX) / 2.0 - 0.03),
        (SLOPE_LEN, 0.055, 0.055),
        rot=(0, PITCH, 0),
        mat=mat_truss_rust,
        parent=root
    )

    # Center vertical king post + Queen vertical struts at X = +/-1.22m
    king_h = (H_APEX - 0.05) - Z_CHORD
    create_box(f"WH6_TrussKing_{t_idx}", (0.0, ty, Z_CHORD + king_h / 2.0), (0.05, 0.05, king_h), mat=mat_truss_rust, parent=root)
    for s_sign in (-1, 1):
        qx = s_sign * 1.22
        qz_top = H_APEX - abs(qx) * math.tan(PITCH) - 0.04
        qh = qz_top - Z_CHORD
        create_box(f"WH6_TrussQueen_{t_idx}_{s_sign}", (qx, ty, Z_CHORD + qh / 2.0), (0.045, 0.045, qh), mat=mat_truss_rust, parent=root)

        # Diagonal web struts: (0, Z_CHORD) -> (qx, qz_top) and (qx, Z_CHORD) -> (s_sign*COL_X, Z_AT_COL-0.04)
        for d_idx, (x_a, z_a, x_b, z_b) in enumerate([
            (0.0, Z_CHORD + 0.02, qx, qz_top),
            (qx, Z_CHORD + 0.02, s_sign * COL_X, Z_AT_COL - 0.04)
        ]):
            d_len = math.hypot(x_b - x_a, z_b - z_a)
            d_ang = math.atan2(z_b - z_a, abs(x_b - x_a))
            create_box(
                f"WH6_TrussDiag_{t_idx}_{s_sign}_{d_idx}",
                ((x_a + x_b) / 2.0, ty, (z_a + z_b) / 2.0),
                (d_len, 0.04, 0.04),
                rot=(0, s_sign * d_ang, 0),
                mat=mat_truss_rust,
                parent=root
            )

# Longitudinal Rusted Steel Purlins along Y on both roof slopes
for p_frac in [0.10, 0.34, 0.58, 0.80, 0.96]:
    px_abs = p_frac * HALF_W
    pz = H_APEX - px_abs * math.tan(PITCH) - 0.005
    for s_sign in (-1, 1):
        create_box(
            f"WH6_Purlin_{s_sign}_{p_frac:.2f}",
            (s_sign * px_abs, 0.0, pz),
            (0.045, D - 0.08, 0.045),
            rot=(0, s_sign * PITCH, 0),
            mat=mat_truss_rust,
            parent=root
        )

# Longitudinal Tie Beam connecting column tops along X = +/-COL_X
for s_sign in (-1, 1):
    create_box(f"WH6_EaveTieBeam_{s_sign}", (s_sign * COL_X, 0.0, Z_CHORD + 0.06), (0.055, D - 0.60, 0.055), mat=mat_truss_rust, parent=root)

# ==============================================================================
# 3. AUTHENTIC TWO-SLOPE CORRUGATED ROOF MATCHING DRONE PHOTO '768a0d78.jpg'
#    - West (Left) Slope (X < 0): Solid deep oxide rust-brown corrugated iron
#    - East (Right) Slope (X > 0): Exact 5-band alternating oxide rust-brown &
#      bright silver-white galvanized corrugated sheets!
# ==============================================================================
# Thin ceiling underside sheets so interior views ('6 Front View.jpg', '6 Side View.jpg')
# show mottled rusted underside on West and galvanized silver-grey underside on East
create_box(
    "WH6_CeilingUnderWest",
    (-HALF_W / 2.0, 0.0, (H_EAVE + H_APEX) / 2.0 + 0.018),
    (SLOPE_LEN - 0.04, D - 0.04, 0.012),
    rot=(0, -PITCH, 0),
    mat=mat_roof_under_rust,
    parent=root
)
create_box(
    "WH6_CeilingUnderEast",
    (HALF_W / 2.0, 0.0, (H_EAVE + H_APEX) / 2.0 + 0.018),
    (SLOPE_LEN - 0.04, D - 0.04, 0.012),
    rot=(0, PITCH, 0),
    mat=mat_roof_under_galv,
    parent=root
)

# West (Left) Top Roof Panels: 8 corrugated oxide-rust sheets along Y
num_west_sheets = 8
w_sheet_d = D / num_west_sheets
for i in range(num_west_sheets):
    sy = -HALF_D + (i + 0.5) * w_sheet_d
    rmat = mat_roof_rust_dark if (i % 2 == 0) else mat_roof_rust_mid
    create_box(
        f"WH6_RoofWest_{i}",
        (-HALF_W / 2.0, sy, (H_EAVE + H_APEX) / 2.0 + 0.036),
        (SLOPE_LEN, w_sheet_d * 0.992, 0.022),
        rot=(0, -PITCH, 0),
        mat=rmat,
        parent=root
    )

# East (Right) Top Roof Panels: Exact 5 horizontal bands from South (-4.25m) to North (+4.25m) ('768a0d78.jpg')
east_bands = [
    (-4.25, -3.55, mat_roof_rust_dark),   # South front rust band (0.70m)
    (-3.55, -0.35, mat_roof_silver),      # Wide bright silver-white galvanized band around chimney (3.20m)
    (-0.35,  1.55, mat_roof_rust_mid),    # Middle oxide rust band (1.90m)
    ( 1.55,  2.75, mat_roof_silver),      # North-middle bright silver-white galvanized band (1.20m)
    ( 2.75,  4.25, mat_roof_rust_dark),   # North rear oxide rust band (1.50m)
]
for b_idx, (by0, by1, bmat) in enumerate(east_bands):
    bd = by1 - by0
    bcy = (by0 + by1) / 2.0
    create_box(
        f"WH6_RoofEastBand_{b_idx}",
        (HALF_W / 2.0, bcy, (H_EAVE + H_APEX) / 2.0 + 0.036),
        (SLOPE_LEN, bd - 0.012, 0.022),
        rot=(0, PITCH, 0),
        mat=bmat,
        parent=root
    )

# Authentic East-West sheet-overlap rust spots across the wide South-East silver roof band (matching '768a0d78.jpg')
for r_idx, (ry, rx_list) in enumerate([
    (-1.45, [0.45, 1.15, 1.95, 2.75]),
    (-2.60, [0.55, 1.30, 2.15, 2.95]),
]):
    for s_idx, rx in enumerate(rx_list):
        rz = H_APEX - rx * math.tan(PITCH) + 0.046
        create_box(
            f"WH6_SilverRustSpot_{r_idx}_{s_idx}",
            (rx, ry, rz),
            (0.46, 0.22, 0.006),
            rot=(0, PITCH, 0),
            mat=mat_roof_rust_mid,
            parent=root
        )

# Flush Folded Two-Wing Ridge Flashing Cap along X = 0.0 m ('768a0d78.jpg')
for s_sign in (-1, 1):
    rx_c = s_sign * 0.09
    rz_c = H_APEX - abs(rx_c) * math.tan(PITCH) + 0.044
    create_box(
        f"WH6_RidgeWing_{s_sign}",
        (rx_c, 0.0, rz_c),
        (0.20, D + 0.01, 0.014),
        rot=(0, s_sign * PITCH, 0),
        mat=mat_roof_silver,
        parent=root
    )
    for rs_y in [-3.4, -1.1, 0.8, 3.1]:
        create_box(
            f"WH6_RidgeRustPatch_{s_sign}_{rs_y:.1f}",
            (rx_c * 0.85, rs_y, rz_c + 0.004),
            (0.16, 0.65, 0.010),
            rot=(0, s_sign * PITCH, 0),
            mat=mat_roof_rust_mid,
            parent=root
        )

# Heavily Weathered Rusty-Brown Fascia Boards with Flaking Cream Patches ('6 Front View.jpg')
for f_tag, fy in [("Front", -HALF_D - 0.015), ("Rear", HALF_D + 0.015)]:
    for s_sign in (-1, 1):
        create_box(
            f"WH6_GableFascia_{f_tag}_{s_sign}",
            (s_sign * HALF_W / 2.0, fy, (H_EAVE + H_APEX) / 2.0 - 0.01),
            (SLOPE_LEN + 0.04, 0.035, 0.14),
            rot=(0, s_sign * PITCH, 0),
            mat=mat_fascia_rust,
            parent=root
        )
    # Flaking cream/pale paint patches on front fascia matching '6 Front View.jpg'
    if f_tag == "Front":
        for fl_x in [-1.65, -0.35, 0.45, 2.05]:
            fl_z = H_APEX - abs(fl_x) * math.tan(PITCH) - 0.01
            fl_s = -1 if fl_x < 0 else 1
            create_box(
                f"WH6_FasciaFlake_{fl_x:.2f}",
                (fl_x, fy - 0.005, fl_z),
                (0.55, 0.038, 0.11),
                rot=(0, fl_s * PITCH, 0),
                mat=mat_fascia_flake,
                parent=root
            )

for s_sign in (-1, 1):
    create_box(
        f"WH6_SideEaveFascia_{s_sign}",
        (s_sign * (HALF_W + 0.01), 0.0, H_EAVE - 0.02),
        (0.03, D + 0.04, 0.13),
        mat=mat_fascia_rust,
        parent=root
    )

# ==============================================================================
# 4. BIOMASS FURNACE, HOPPER, TALL GALVANIZED CHIMNEY STACK & ROTARY SEED DRYER
#    ('6 Front View.jpg', '6 Side View.jpg', and chimney cap in '768a0d78.jpg')
# ==============================================================================
FURN_X = 1.45
FURN_Y = -2.95

# Brick-lined lower firebox with rusted angle-iron frame ('6 Side View.jpg')
create_box("WH6_FireboxBody", (FURN_X, FURN_Y, 0.41), (0.86, 1.16, 0.62), mat=mat_firebrick, parent=root)
create_box("WH6_FireboxTopPlate", (FURN_X, FURN_Y, 0.73), (0.90, 1.20, 0.035), mat=mat_hopper_rust, parent=root)
# Dark open ash-pit / stoking opening facing South (-Y)
create_box("WH6_FireboxMouth", (FURN_X, FURN_Y - 0.57, 0.38), (0.64, 0.06, 0.44), mat=mat_ash_void, parent=root)
# Rusted corner angle-iron uprights on firebox
for fdx in (-0.42, 0.42):
    for fdy in (-0.57, 0.57):
        create_box(f"WH6_FireboxCorner_{fdx}_{fdy}", (FURN_X + fdx, FURN_Y + fdy, 0.41), (0.05, 0.05, 0.64), mat=mat_hopper_rust, parent=root)
# Horizontal brick-course relief lines on East & West sides of firebox
for bz in [0.22, 0.34, 0.46, 0.58]:
    create_box(f"WH6_BrickJoint_{bz:.2f}", (FURN_X, FURN_Y, bz), (0.875, 1.06, 0.015), mat=mat_truss_rust, parent=root)

# Tapered Funnel + Square Upper Rusted Biomass Fuel Hopper ('6 Front View.jpg' & '6 Side View.jpg')
HOP_Y = -3.12
funnel_verts = [
    (FURN_X - 0.24, HOP_Y - 0.22, 0.74),
    (FURN_X + 0.24, HOP_Y - 0.22, 0.74),
    (FURN_X + 0.24, HOP_Y + 0.22, 0.74),
    (FURN_X - 0.24, HOP_Y + 0.22, 0.74),
    (FURN_X - 0.40, HOP_Y - 0.38, 1.24),
    (FURN_X + 0.40, HOP_Y - 0.38, 1.24),
    (FURN_X + 0.40, HOP_Y + 0.38, 1.24),
    (FURN_X - 0.40, HOP_Y + 0.38, 1.24),
]
funnel_faces = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)]
create_prism("WH6_HopperFunnel", funnel_verts, funnel_faces, mat=mat_hopper_rust, parent=root)
create_box("WH6_HopperUpperBox", (FURN_X, HOP_Y, 1.56), (0.80, 0.76, 0.64), mat=mat_hopper_rust, parent=root)
create_box("WH6_HopperRim", (FURN_X, HOP_Y, 1.89), (0.84, 0.80, 0.03), mat=mat_truss_rust, parent=root)

# Tall Galvanized Silver Chimney Flue Pipe rising through East Roof Slope to Z = 4.95 m!
FLUE_X = 1.45
FLUE_Y = -2.42
FLUE_BASE_Z = 0.74
FLUE_TOP_Z = 4.86
flue_h = FLUE_TOP_Z - FLUE_BASE_Z
create_cyl("WH6_ChimneyStack", (FLUE_X, FLUE_Y, FLUE_BASE_Z + flue_h / 2.0), 0.115, flue_h, vertices=14, mat=mat_flue_silver, parent=root)

# Roof penetration flashing collar at East roof slope
z_roof_flue = H_APEX - FLUE_X * math.tan(PITCH) + 0.045
create_cyl("WH6_ChimneyFlashing", (FLUE_X, FLUE_Y, z_roof_flue), 0.19, 0.08, rot=(0, PITCH, 0), vertices=12, mat=mat_pipe_galv, parent=root)

# Conical Galvanized Chimney Rain Cap & 3 Support Brackets ('6 Front View.jpg')
create_cone("WH6_ChimneyRainCap", (FLUE_X, FLUE_Y, FLUE_TOP_Z + 0.15), 0.25, 0.01, 0.15, vertices=14, mat=mat_flue_silver, parent=root)
for br_ang in [0, 120, 240]:
    rad = math.radians(br_ang)
    bx = FLUE_X + 0.105 * math.cos(rad)
    by = FLUE_Y + 0.105 * math.sin(rad)
    create_box(f"WH6_CapBracket_{br_ang}", (bx, by, FLUE_TOP_Z + 0.05), (0.02, 0.02, 0.14), mat=mat_truss_rust, parent=root)

# Horizontal Cylindrical Rotary Seed / Grain Dryer Drum ('6 Side View.jpg')
DRUM_X = 1.08
DRUM_Y = -0.45
DRUM_LEN = 3.40
DRUM_R = 0.52
DRUM_Z = 0.68

create_cyl("WH6_RotaryDrumMain", (DRUM_X, DRUM_Y, DRUM_Z), DRUM_R, DRUM_LEN, rot=(math.pi / 2.0, 0, 0), vertices=16, mat=mat_drum_rust, parent=root)
# Heat-patinated middle steel band & stiffening rolling rings ('6 Side View.jpg')
create_cyl("WH6_RotaryDrumPatinaBand", (DRUM_X, DRUM_Y - 0.35, DRUM_Z), DRUM_R + 0.006, 1.35, rot=(math.pi / 2.0, 0, 0), vertices=16, mat=mat_drum_patina, parent=root)
for ring_y in [DRUM_Y - 1.65, DRUM_Y - 0.55, DRUM_Y + 0.55, DRUM_Y + 1.62]:
    create_cyl(f"WH6_DrumRing_{ring_y:.2f}", (DRUM_X, ring_y, DRUM_Z), DRUM_R + 0.028, 0.05, rot=(math.pi / 2.0, 0, 0), vertices=16, mat=mat_truss_rust, parent=root)
# Dark interior mouth of rotary drum facing furnace
create_cyl("WH6_DrumFrontVoid", (DRUM_X, DRUM_Y - DRUM_LEN / 2.0 - 0.005, DRUM_Z), DRUM_R - 0.04, 0.03, rot=(math.pi / 2.0, 0, 0), vertices=16, mat=mat_ash_void, parent=root)
# Steel roller cradle stands beneath rotary drum
for cr_y in [DRUM_Y - 1.15, DRUM_Y + 1.10]:
    create_box(f"WH6_DrumCradle_{cr_y:.2f}", (DRUM_X, cr_y, 0.18), (0.92, 0.18, 0.16), mat=mat_steel_black, parent=root)

# Twin Black Flexible Blower/Duct Hoses draping from rear of drum toward East floor edge ('6 Side View.jpg')
for h_idx, hy_off in enumerate([0.75, 0.96]):
    create_cyl(
        f"WH6_FlexHose_{h_idx}",
        (DRUM_X + 0.72, DRUM_Y + hy_off, 0.58),
        0.075,
        1.55,
        rot=(0, math.radians(52), math.radians(-12)),
        vertices=10,
        mat=mat_hose_black,
        parent=root
    )

# ==============================================================================
# 5. OFFICIAL WHITE DA PROJECT BILLBOARD ('6 Front View.jpg' & '6 Side View.jpg')
# ==============================================================================
SIGN_CX = -1.12
SIGN_Y = -3.72
SIGN_W = 2.24
SIGN_H = 1.74
SIGN_Z = 1.62  # Bottom at 0.75m, Top at 2.49m

# Two vertical galvanized pipe posts + top/bottom horizontal pipe bars
for s_dx in (-SIGN_W / 2.0 - 0.03, SIGN_W / 2.0 + 0.03):
    create_cyl(f"WH6_SignPost_{s_dx:.2f}", (SIGN_CX + s_dx, SIGN_Y, 1.26), 0.024, 2.52, vertices=8, mat=mat_pipe_galv, parent=root)
for s_bz in (SIGN_Z - SIGN_H / 2.0 - 0.02, SIGN_Z + SIGN_H / 2.0 + 0.02):
    create_box(f"WH6_SignBar_{s_bz:.2f}", (SIGN_CX, SIGN_Y, s_bz), (SIGN_W + 0.08, 0.035, 0.035), mat=mat_pipe_galv, parent=root)

# White Tarpaulin Board Face
create_box("WH6_SignBoard", (SIGN_CX, SIGN_Y - 0.015, SIGN_Z), (SIGN_W, 0.025, SIGN_H), mat=mat_board_white, parent=root)

# Official Circular DA Green/Gold Seal Medallion at Top-Left of Billboard ('6 Front View.jpg')
SEAL_X = SIGN_CX - SIGN_W / 2.0 + 0.22
SEAL_Z = SIGN_Z + SIGN_H / 2.0 - 0.21
create_cyl("WH6_SignDASealOuter", (SEAL_X, SIGN_Y - 0.03, SEAL_Z), 0.13, 0.012, rot=(math.pi / 2.0, 0, 0), vertices=14, mat=mat_da_green, parent=root)
create_cyl("WH6_SignDASealInner", (SEAL_X, SIGN_Y - 0.034, SEAL_Z), 0.08, 0.012, rot=(math.pi / 2.0, 0, 0), vertices=12, mat=mat_da_gold, parent=root)

# Graphic Typography Header Bars & Project Details Table Grid ('6 Front View.jpg')
hdr_cx = SIGN_CX + 0.14
create_box("WH6_SignHdr1", (hdr_cx, SIGN_Y - 0.03, SIGN_Z + 0.72), (1.58, 0.01, 0.065), mat=mat_board_ink, parent=root)
create_box("WH6_SignHdr2", (hdr_cx, SIGN_Y - 0.03, SIGN_Z + 0.62), (1.18, 0.01, 0.040), mat=mat_board_ink, parent=root)
create_box("WH6_SignHdr3", (hdr_cx, SIGN_Y - 0.03, SIGN_Z + 0.54), (1.42, 0.01, 0.038), mat=mat_board_ink, parent=root)

# Project metadata lines (Project Name, Location, Cost, Contractor)
for l_idx, lz in enumerate([0.38, 0.30, 0.22, 0.14, 0.06]):
    create_box(f"WH6_SignMetaLine_{l_idx}", (SIGN_CX, SIGN_Y - 0.03, SIGN_Z + lz), (1.96, 0.008, 0.022), mat=mat_board_grid, parent=root)

# Project Status Table Box (lower half of billboard)
TBL_Z = SIGN_Z - 0.34
create_box("WH6_SignTableBg", (SIGN_CX, SIGN_Y - 0.028, TBL_Z), (1.98, 0.008, 0.56), mat=mat_board_grid, parent=root)
create_box("WH6_SignTableInner", (SIGN_CX, SIGN_Y - 0.031, TBL_Z), (1.94, 0.008, 0.52), mat=mat_board_white, parent=root)
for row_i in range(4):
    rz = TBL_Z - 0.18 + row_i * 0.12
    create_box(f"WH6_SignTableRow_{row_i}", (SIGN_CX, SIGN_Y - 0.035, rz), (1.94, 0.008, 0.012), mat=mat_board_grid, parent=root)
for col_i in [-0.65, -0.25, 0.15, 0.55]:
    create_box(f"WH6_SignTableCol_{col_i:.2f}", (SIGN_CX + col_i, SIGN_Y - 0.035, TBL_Z), (0.012, 0.008, 0.52), mat=mat_board_grid, parent=root)

# ==============================================================================
# 6. AUTHENTIC INTERIOR EQUIPMENT: SPARE GREEN ROOFING STACK, BLACK STEEL
#    CLEANER FRAME & YELLOW-TARPED SACK STACK ('6 Front View.jpg' & '6 Side View.jpg')
# ==============================================================================
# Off-white concrete block storage plinth behind billboard + stacked green corrugated GI sheets
create_box("WH6_StoragePlinth", (-1.55, -1.65, 0.28), (1.55, 2.50, 0.40), mat=mat_plinth_white, parent=root)
for sh_i in range(4):
    create_box(
        f"WH6_SpareGreenStack_{sh_i}",
        (-1.68 - sh_i * 0.08, -1.60, 0.52 + sh_i * 0.045),
        (1.45, 2.55, 0.032),
        rot=(0, math.radians(-4), math.radians(2)),
        mat=mat_spare_green,
        parent=root
    )

# Rear-center Black Structural Steel Cleaner / Elevator Frame ('6 Side View.jpg')
FRM_X = -0.45
FRM_Y = 1.95
for fx_off in [-0.55, 0.0, 0.55]:
    for fy_off in [-0.45, 0.45]:
        create_box(f"WH6_RearFramePost_{fx_off}_{fy_off}", (FRM_X + fx_off, FRM_Y + fy_off, 1.05), (0.06, 0.06, 1.90), mat=mat_steel_black, parent=root)
create_box("WH6_RearFrameTopX", (FRM_X, FRM_Y - 0.45, 1.96), (1.20, 0.06, 0.07), mat=mat_steel_black, parent=root)
create_box("WH6_RearFrameTopX2", (FRM_X, FRM_Y + 0.45, 1.96), (1.20, 0.06, 0.07), mat=mat_steel_black, parent=root)
create_box("WH6_RearFrameMidBox", (FRM_X, FRM_Y, 1.05), (0.95, 0.78, 0.72), mat=mat_steel_black, parent=root)

# Rear-right Blue Pallet, Stacked White Sacks & Draped Yellow-Khaki Canvas Tarp ('6 Side View.jpg')
TARP_CX = 1.45
TARP_CY = 2.35
create_box("WH6_BluePallet", (TARP_CX, TARP_CY, 0.14), (1.40, 1.75, 0.09), mat=mat_pallet_blue, parent=root)
create_box("WH6_SackBase", (TARP_CX, TARP_CY, 0.42), (1.32, 1.65, 0.46), mat=mat_sack_white, parent=root)

# Low-poly draped yellow canvas tarpaulin prism covering the upper mound
tarp_verts = [
    (TARP_CX - 0.76, TARP_CY - 0.95, 0.18),
    (TARP_CX + 0.78, TARP_CY - 0.95, 0.14),
    (TARP_CX + 0.82, TARP_CY + 0.95, 0.14),
    (TARP_CX - 0.76, TARP_CY + 0.95, 0.18),
    (TARP_CX - 0.56, TARP_CY - 0.68, 0.98),
    (TARP_CX + 0.52, TARP_CY - 0.65, 0.94),
    (TARP_CX + 0.50, TARP_CY + 0.68, 0.92),
    (TARP_CX - 0.54, TARP_CY + 0.70, 0.96),
]
tarp_faces = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)]
create_prism("WH6_YellowTarpMound", tarp_verts, tarp_faces, mat=mat_tarp_yellow, parent=root)

# Join all WH6 mesh objects into a single optimized multi-material mesh
bpy.ops.object.select_all(action='DESELECT')
mesh_objs = [o for o in bpy.data.objects if o.name.startswith("WH6_") and o.type == 'MESH']
if mesh_objs:
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = "WH6_CombinedMesh"

# Export to models/warehouse_6.glb
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.name.startswith("WH6_"):
        obj.select_set(True)

export_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_6.glb"
bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True
)
print(f"Successfully exported {export_path}")
