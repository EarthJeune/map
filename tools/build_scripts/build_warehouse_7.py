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


def create_cyl(name, center, radius, depth, rot=(0, 0, 0), vertices=10, mat=None, parent=None):
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
# MATERIALS (Linear-RGB calibrated to '7 Front View.jpg', '7 Small building.jpg',
# '7 small building in left and Large building in right.jpg', '7 View from the right.jpg',
# and aerial drone close-up 'acb29c17.png')
# ==============================================================================
# Main High-Bay Warehouse: Soft Pastel Mint-Green Stucco & Pilasters
mat_main_mint = make_mat("WH7_MainWallMint", (0.62, 0.78, 0.63, 1.0), roughness=0.78)
mat_main_pilaster = make_mat("WH7_MainPilasterMint", (0.66, 0.81, 0.66, 1.0), roughness=0.76)
mat_dock_recess = make_mat("WH7_DockWallWarm", (0.64, 0.72, 0.52, 1.0), roughness=0.80)
mat_gable_pale = make_mat("WH7_GableUpperPale", (0.68, 0.73, 0.71, 1.0), roughness=0.82)
mat_plinth_conc = make_mat("WH7_ConcretePlinth", (0.32, 0.33, 0.31, 1.0), roughness=0.88)

# Attached Western Single-Story Annex: Vibrant Fresh Apple / Lime-Green Stucco ('7 Small building.jpg')
mat_annex_lime = make_mat("WH7_AnnexLimeGreen", (0.21, 0.62, 0.14, 1.0), roughness=0.74)
mat_annex_fascia_olive = make_mat("WH7_AnnexOliveTrim", (0.34, 0.36, 0.18, 1.0), roughness=0.68)
mat_annex_door_green = make_mat("WH7_AnnexDoorDarkGreen", (0.04, 0.20, 0.11, 1.0), roughness=0.52)

# Forest-Green Corrugated Roof, 8 Bright Orange Fiberglass Skylights & Pale Sage Corner Patch ('acb29c17.png')
mat_roof_green1 = make_mat("WH7_RoofForestGreen1", (0.035, 0.18, 0.085, 1.0), roughness=0.52, metallic=0.20)
mat_roof_green2 = make_mat("WH7_RoofForestGreen2", (0.048, 0.22, 0.105, 1.0), roughness=0.55, metallic=0.18)
mat_roof_annex = mat_roof_green2
mat_roof_patch = make_mat("WH7_RoofSageCreamPatch", (0.48, 0.58, 0.42, 1.0), roughness=0.54, metallic=0.18)
mat_roof_rust = make_mat("WH7_RoofEaveRust", (0.22, 0.08, 0.04, 1.0), roughness=0.72, metallic=0.25)
mat_fascia_dark = make_mat("WH7_FasciaDarkGreen", (0.020, 0.12, 0.060, 1.0), roughness=0.45, metallic=0.24)

mat_skylight_orange = make_mat("WH7_SkylightOrange", (0.95, 0.13, 0.015, 1.0), roughness=0.30)
mat_skylight_pale = make_mat("WH7_SkylightSunBleach", (0.94, 0.44, 0.16, 1.0), roughness=0.34)

# Cantilevered Steel-Truss Loading Canopy, Roll-Up Shutter, Breeze Blocks, Windows & Downspouts
mat_steel_truss = make_mat("WH7_CanopySteelDark", (0.08, 0.10, 0.09, 1.0), roughness=0.50, metallic=0.55)
mat_canopy_soffit = make_mat("WH7_CanopyUnderGalv", (0.45, 0.48, 0.49, 1.0), roughness=0.46, metallic=0.45)
mat_shutter_galv = make_mat("WH7_ShutterGalv", (0.50, 0.53, 0.56, 1.0), roughness=0.40, metallic=0.58)
mat_shutter_dark = make_mat("WH7_ShutterSlatDark", (0.22, 0.24, 0.26, 1.0), roughness=0.50, metallic=0.48)

mat_breeze_conc = make_mat("WH7_BreezeBlockConc", (0.64, 0.63, 0.59, 1.0), roughness=0.84)
mat_void_dark = make_mat("WH7_DarkVoid", (0.02, 0.025, 0.025, 1.0), roughness=0.92)
mat_win_frame_blk = make_mat("WH7_WinFrameBlack", (0.03, 0.035, 0.04, 1.0), roughness=0.38, metallic=0.40)
mat_win_glass = make_mat("WH7_WinGlassTinted", (0.06, 0.10, 0.12, 1.0), roughness=0.16, metallic=0.30)

mat_pipe_green = make_mat("WH7_DownspoutLime", (0.24, 0.58, 0.18, 1.0), roughness=0.42)
mat_pipe_orange = make_mat("WH7_DownspoutTerracotta", (0.58, 0.20, 0.09, 1.0), roughness=0.46)
mat_stainless = make_mat("WH7_StainlessTank", (0.68, 0.71, 0.74, 1.0), roughness=0.25, metallic=0.82)

# ==============================================================================
# EXACT 12-VERTEX GEOMETRY IN TRUE 340.65 DEG FRAME
# Center: [121.16755299, 13.96019860], Mapbox rotation = 340.65 deg (front normal 160.65 deg SSE)
#   1. Main High-Bay Warehouse (v[3], v[8], v[9], v[10]):
#      X_MAIN_L = -7.88 m  to  X_MAIN_R = +12.32 m  (Width  = 20.20 m, CX = +2.22 m)
#      Y_MAIN_F = -7.75 m  to  Y_MAIN_R =  +7.85 m  (Depth  = 15.60 m, CY = +0.05 m)
#   2. South Cantilevered Steel-Truss Loading Canopy & Dock (v[4]..v[7]):
#      X_CAN_L  = -2.68 m  to  X_CAN_R  =  +2.32 m  (Width  =  5.00 m, CX = -0.18 m)
#      Y_CAN_F  =-11.58 m  to  Y_CAN_R  =  -7.75 m  (Proj   =  3.83 m)
#   3. Attached Western Lime-Green Single-Story Annex (v[0], v[1], v[2], v[11]):
#      Roof: X = -14.14 m to -7.88 m (Width = 6.26 m), Y = -2.55 m to +7.66 m (Depth = 10.21 m)
#      Wall: X = -13.30 m to -7.88 m (0.84 m sheltered West eave overhang, matching '7 Small building.jpg')
# ==============================================================================
X_MAIN_L = -7.88
X_MAIN_R = 12.32
W_MAIN = X_MAIN_R - X_MAIN_L             # 20.20 m
CX_MAIN = (X_MAIN_L + X_MAIN_R) / 2.0    # +2.22 m

Y_MAIN_F = -7.75
Y_MAIN_R = 7.85
D_MAIN = Y_MAIN_R - Y_MAIN_F             # 15.60 m
CY_MAIN = (Y_MAIN_F + Y_MAIN_R) / 2.0    # +0.05 m (Exact East-West Gable Ridge!)

H_EAVE = 5.35
H_APEX = 6.75
PARAPET_UP = 0.16

root = bpy.data.objects.new("WH7_Root", None)
bpy.context.collection.objects.link(root)

# ==============================================================================
# 1. MAIN HIGH-BAY MINT-GREEN WAREHOUSE BODY, GABLE PARAPETS & 4-BAY PILASTERS
# ==============================================================================
create_box("WH7_MainPlinth", (CX_MAIN, CY_MAIN, 0.12), (W_MAIN + 0.08, D_MAIN + 0.08, 0.24), mat=mat_plinth_conc, parent=root)
create_box("WH7_MainBody", (CX_MAIN, CY_MAIN, H_EAVE / 2.0), (W_MAIN, D_MAIN, H_EAVE), mat=mat_main_mint, parent=root)

# Warm recessed wall panel inside Bay 2 loading dock under canopy ('7 Front View.jpg')
create_box("WH7_DockBayWall", (-0.18, Y_MAIN_F - 0.01, 2.15), (4.65, 0.04, 4.10), mat=mat_dock_recess, parent=root)

# Gable End Walls + Concrete Parapet Copings on West (X_MAIN_L) and East (X_MAIN_R)
gable_faces = [(0, 2, 1), (3, 4, 5), (0, 3, 5, 2), (2, 5, 4, 1), (0, 1, 4, 3)]
core_gable_verts = [
    (X_MAIN_L + 0.24, Y_MAIN_F, H_EAVE),
    (X_MAIN_L + 0.24, Y_MAIN_R, H_EAVE),
    (X_MAIN_L + 0.24, CY_MAIN, H_APEX),
    (X_MAIN_R - 0.24, Y_MAIN_F, H_EAVE),
    (X_MAIN_R - 0.24, Y_MAIN_R, H_EAVE),
    (X_MAIN_R - 0.24, CY_MAIN, H_APEX),
]
create_prism("WH7_MainGableCore", core_gable_verts, gable_faces, mat=mat_main_mint, parent=root)

# Subtle pale off-white/mint upper North half of West Gable ('7 small building in left...jpg')
north_gable_verts = [
    (X_MAIN_L - 0.01, CY_MAIN, 3.60),
    (X_MAIN_L - 0.01, Y_MAIN_R, 3.60),
    (X_MAIN_L - 0.01, Y_MAIN_R, H_EAVE),
    (X_MAIN_L - 0.01, CY_MAIN, H_APEX),
    (X_MAIN_L + 0.12, CY_MAIN, 3.60),
    (X_MAIN_L + 0.12, Y_MAIN_R, 3.60),
    (X_MAIN_L + 0.12, Y_MAIN_R, H_EAVE),
    (X_MAIN_L + 0.12, CY_MAIN, H_APEX),
]
north_gable_faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 4, 7, 3), (3, 7, 6, 2), (2, 6, 5, 1), (0, 1, 5, 4)]
create_prism("WH7_WestGableNorthPale", north_gable_verts, north_gable_faces, mat=mat_gable_pale, parent=root)

for tag, x0, x1 in [("WestParapet", X_MAIN_L - 0.02, X_MAIN_L + 0.22), ("EastParapet", X_MAIN_R - 0.22, X_MAIN_R + 0.02)]:
    p_verts = [
        (x0, Y_MAIN_F - 0.03, H_EAVE + PARAPET_UP),
        (x0, Y_MAIN_R + 0.03, H_EAVE + PARAPET_UP),
        (x0, CY_MAIN, H_APEX + PARAPET_UP),
        (x1, Y_MAIN_F - 0.03, H_EAVE + PARAPET_UP),
        (x1, Y_MAIN_R + 0.03, H_EAVE + PARAPET_UP),
        (x1, CY_MAIN, H_APEX + PARAPET_UP),
    ]
    create_prism(f"WH7_{tag}", p_verts, gable_faces, mat=mat_main_pilaster, parent=root)
    create_box(f"WH7_{tag}_Base", ((x0 + x1) / 2.0, CY_MAIN, H_EAVE + PARAPET_UP / 2.0), (x1 - x0, D_MAIN + 0.06, PARAPET_UP), mat=mat_main_pilaster, parent=root)

# 5 Vertical Structural Pilasters dividing South & North Walls into 4 Bays ('7 Front View.jpg')
PILASTER_XS = [-7.67, -2.68, 2.32, 7.32, 12.11]
for p_idx, px in enumerate(PILASTER_XS):
    create_box(f"WH7_FrontPilaster_{p_idx}", (px, Y_MAIN_F - 0.06, H_EAVE / 2.0), (0.42, 0.14, H_EAVE), mat=mat_main_pilaster, parent=root)
    create_box(f"WH7_RearPilaster_{p_idx}", (px, Y_MAIN_R + 0.06, H_EAVE / 2.0), (0.42, 0.14, H_EAVE), mat=mat_main_pilaster, parent=root)

# Horizontal Concrete Belt Tie-Beam & Upper Eave Spandrel across South, North, West & East Walls
for sy_sign, wy in [(-1, Y_MAIN_F), (1, Y_MAIN_R)]:
    create_box(f"WH7_HorizBelt_{sy_sign}", (CX_MAIN, wy + sy_sign * 0.045, 3.68), (W_MAIN, 0.10, 0.34), mat=mat_main_pilaster, parent=root)
    create_box(f"WH7_UpperSpandrel_{sy_sign}", (CX_MAIN, wy + sy_sign * 0.045, 5.12), (W_MAIN, 0.10, 0.28), mat=mat_main_pilaster, parent=root)

for sx_sign, wx in [(-1, X_MAIN_L), (1, X_MAIN_R)]:
    create_box(f"WH7_GableBelt_{sx_sign}", (wx + sx_sign * 0.045, CY_MAIN, 3.68), (0.10, D_MAIN, 0.34), mat=mat_main_pilaster, parent=root)
    # Center ridge pilaster on West & East Gable walls ('7 small building...jpg')
    create_box(f"WH7_GableCenterPilaster_{sx_sign}", (wx + sx_sign * 0.055, CY_MAIN, (H_APEX + PARAPET_UP) / 2.0), (0.12, 0.40, H_APEX + PARAPET_UP), mat=mat_main_pilaster, parent=root)

# Vertical Painted Lime-Green & Terracotta-Orange PVC Downspouts on Front Pilasters ('7 Front View.jpg', '7 View from the right.jpg')
create_cyl("WH7_Downspout_P0_Green", (-7.67, Y_MAIN_F - 0.16, 2.62), 0.048, 5.24, vertices=8, mat=mat_pipe_green, parent=root)
create_cyl("WH7_Downspout_P1_OrangeTop", (-2.68, Y_MAIN_F - 0.16, 4.72), 0.042, 1.05, vertices=8, mat=mat_pipe_orange, parent=root)
create_cyl("WH7_Downspout_P2_OrangeTop", (2.32, Y_MAIN_F - 0.16, 4.72), 0.042, 1.05, vertices=8, mat=mat_pipe_orange, parent=root)
create_cyl("WH7_Downspout_P3_Green", (7.32, Y_MAIN_F - 0.16, 2.62), 0.048, 5.24, vertices=8, mat=mat_pipe_green, parent=root)
create_cyl("WH7_Downspout_P4_Orange", (12.11, Y_MAIN_F - 0.16, 2.62), 0.048, 5.24, vertices=8, mat=mat_pipe_orange, parent=root)

# ==============================================================================
# 2. FOREST-GREEN GABLE ROOF WITH EXACTLY 8 ORANGE FIBERGLASS SKYLIGHTS &
#    SOUTH-EAST PALE SAGE-CREAM ROOF PATCH (1:1 WITH DRONE 'acb29c17.png')
# ==============================================================================
HALF_D = D_MAIN / 2.0 + 0.32             # 8.12 m eave-to-ridge projection
RISE = H_APEX - H_EAVE                   # 1.40 m
PITCH = math.atan2(RISE, D_MAIN / 2.0)   # ~10.18 deg
SLOPE_LEN = math.hypot(HALF_D, HALF_D * math.tan(PITCH))
ROOF_W = W_MAIN - 0.40                   # Nestled cleanly between West & East parapets (-7.68 to +12.12)

num_panels = 14
panel_w = ROOF_W / num_panels
for i in range(num_panels):
    px = (X_MAIN_L + 0.20) + (i + 0.5) * panel_w
    rmat = mat_roof_green1 if (i % 2 == 0) else mat_roof_green2
    s_mid_y = CY_MAIN - HALF_D / 2.0
    s_mid_z = H_APEX - (HALF_D / 2.0) * math.tan(PITCH) + 0.04
    create_box(f"WH7_RoofSouth_{i}", (px, s_mid_y, s_mid_z), (panel_w * 0.994, SLOPE_LEN, 0.04), rot=(PITCH, 0, 0), mat=rmat, parent=root)

    n_mid_y = CY_MAIN + HALF_D / 2.0
    create_box(f"WH7_RoofNorth_{i}", (px, n_mid_y, s_mid_z), (panel_w * 0.994, SLOPE_LEN, 0.04), rot=(-PITCH, 0, 0), mat=rmat, parent=root)

# Central Dark Forest-Green Ridge Cap + South/North Dark-Green Box Fascia & Gutter
create_box("WH7_MainRidgeCap", (CX_MAIN, CY_MAIN, H_APEX + 0.06), (ROOF_W + 0.04, 0.36, 0.045), mat=mat_fascia_dark, parent=root)
for sy_sign, ey in [(-1, Y_MAIN_F), (1, Y_MAIN_R)]:
    create_box(f"WH7_BoxFascia_{sy_sign}", (CX_MAIN, ey + sy_sign * 0.20, H_EAVE - 0.02), (W_MAIN + 0.06, 0.42, 0.30), mat=mat_fascia_dark, parent=root)
    create_box(f"WH7_BoxFasciaLip_{sy_sign}", (CX_MAIN, ey + sy_sign * 0.32, H_EAVE + 0.08), (W_MAIN + 0.08, 0.24, 0.16), mat=mat_fascia_dark, parent=root)

# Signature Pale Sage-Cream Repaired Corrugated Roof Patch at South-East Corner ('acb29c17.png')
PATCH_X0, PATCH_X1 = 9.65, 12.10
PATCH_W = PATCH_X1 - PATCH_X0            # 2.45 m
PATCH_CX = (PATCH_X0 + PATCH_X1) / 2.0
PATCH_DIST_TOP = 2.15                    # Starts 2.15m South of ridge
PATCH_DIST_BOT = HALF_D - 0.02           # Extends down to South eave (8.10m South of ridge)
patch_horiz = PATCH_DIST_BOT - PATCH_DIST_TOP
patch_mid_d = (PATCH_DIST_TOP + PATCH_DIST_BOT) / 2.0
patch_slen = patch_horiz / math.cos(PITCH)
patch_cy = CY_MAIN - patch_mid_d
patch_cz = H_APEX - patch_mid_d * math.tan(PITCH) + 0.052
create_box("WH7_SouthEastSagePatch", (PATCH_CX, patch_cy, patch_cz), (PATCH_W, patch_slen, 0.024), rot=(PITCH, 0, 0), mat=mat_roof_patch, parent=root)

# EXACTLY 8 Rectangular Bright Orange Fiberglass Skylights (4 North Slope, 4 South Slope, 'acb29c17.png')
SKYLIGHT_XS = [-4.55, -0.15, 4.85, 8.95]
SKY_W = 1.08
SKY_SLOPE_LEN = 2.65
SKY_MID_DIST = 3.92                      # Distance from central ridge (CY_MAIN)

for sk_i, sk_x in enumerate(SKYLIGHT_XS):
    # North Slope Skylight (vivid safety orange)
    ny = CY_MAIN + SKY_MID_DIST
    nz = H_APEX - SKY_MID_DIST * math.tan(PITCH) + 0.055
    create_box(f"WH7_SkylightNorth_{sk_i}", (sk_x, ny, nz), (SKY_W, SKY_SLOPE_LEN, 0.025), rot=(-PITCH, 0, 0), mat=mat_skylight_orange, parent=root)

    # South Slope Skylight (vivid safety orange with sun-bleached pale center highlight strips matching 'acb29c17.png')
    sy = CY_MAIN - SKY_MID_DIST
    sz = H_APEX - SKY_MID_DIST * math.tan(PITCH) + 0.055
    create_box(f"WH7_SkylightSouth_{sk_i}", (sk_x, sy, sz), (SKY_W, SKY_SLOPE_LEN, 0.025), rot=(PITCH, 0, 0), mat=mat_skylight_orange, parent=root)
    for st_dx in (-0.24, 0.22):
        create_box(
            f"WH7_SkylightSouthBleach_{sk_i}_{st_dx:.2f}",
            (sk_x + st_dx, sy, sz + 0.006),
            (0.22, SKY_SLOPE_LEN - 0.08, 0.018),
            rot=(PITCH, 0, 0),
            mat=mat_skylight_pale,
            parent=root
        )

# ==============================================================================
# 3. PIERCED CONCRETE BREEZE-BLOCK VENTILATION BANDS & WEST/EAST EXHAUST FANS
# ==============================================================================
def build_breeze_grille_y(tag, cx, wy, dir_y, gw=2.32, gh=0.38, gz=1.52, cols=8):
    # Recessed dark void + concrete perimeter & 2x8 block grid ('7 Front View.jpg', '7 View from the right.jpg')
    create_box(f"WH7_BreezeVoid_{tag}", (cx, wy + dir_y * 0.015, gz), (gw, 0.05, gh), mat=mat_void_dark, parent=root)
    for r_z in [gz - gh / 2.0, gz, gz + gh / 2.0]:
        create_box(f"WH7_BreezeHBar_{tag}_{r_z:.2f}", (cx, wy + dir_y * 0.035, r_z), (gw + 0.06, 0.035, 0.042), mat=mat_breeze_conc, parent=root)
    for c_i in range(cols + 1):
        vx = (cx - gw / 2.0) + c_i * (gw / cols)
        create_box(f"WH7_BreezeVBar_{tag}_{c_i}", (vx, wy + dir_y * 0.035, gz), (0.045, 0.035, gh + 0.04), mat=mat_breeze_conc, parent=root)


def build_breeze_grille_x(tag, wx, cy, dir_x, gw=2.32, gh=0.38, gz=1.52, cols=8):
    create_box(f"WH7_BreezeVoidX_{tag}", (wx + dir_x * 0.015, cy, gz), (0.05, gw, gh), mat=mat_void_dark, parent=root)
    for r_z in [gz - gh / 2.0, gz, gz + gh / 2.0]:
        create_box(f"WH7_BreezeHBarX_{tag}_{r_z:.2f}", (wx + dir_x * 0.035, cy, r_z), (0.035, gw + 0.06, 0.042), mat=mat_breeze_conc, parent=root)
    for c_i in range(cols + 1):
        vy = (cy - gw / 2.0) + c_i * (gw / cols)
        create_box(f"WH7_BreezeVBarX_{tag}_{c_i}", (wx + dir_x * 0.035, vy, gz), (0.035, 0.045, gh + 0.04), mat=mat_breeze_conc, parent=root)


# South Front Bays 1, 3, 4 (Bay 2 holds the Roll-Up Shutter Door!)
build_breeze_grille_y("FrontBay1", -5.18, Y_MAIN_F, -1)
build_breeze_grille_y("FrontBay3",  4.82, Y_MAIN_F, -1)
build_breeze_grille_y("FrontBay4",  9.72, Y_MAIN_F, -1)

# North Rear Bays 1..4 (optimized 5-col grilles for GLB size headroom)
for nb_i, nbx in enumerate([-5.18, -0.18, 4.82, 9.72]):
    build_breeze_grille_y(f"RearBay{nb_i}", nbx, Y_MAIN_R, 1, cols=5)

# Exposed South-West Main Wall (Y = -7.75 to -2.55, '7 small building in left...jpg') & East Wall
build_breeze_grille_x("WestSouthBay", X_MAIN_L, -5.15, -1, gw=2.20, cols=8)
build_breeze_grille_x("EastSouthBay", X_MAIN_R, -4.10,  1, gw=2.32, cols=5)
build_breeze_grille_x("EastNorthBay", X_MAIN_R,  4.20,  1, gw=2.32, cols=5)

# High Industrial Exhaust Fans with Green Corrugated Sheet Weather Hoods ('7 small building...jpg' & 'acb29c17.png')
for fy_idx, fy in enumerate([-3.95, 4.05]):
    fz = 4.65
    # West Gable Exhaust Fans (2 fans visible in '7 small building in left...jpg')
    create_box(f"WH7_WestFanFrame_{fy_idx}", (X_MAIN_L - 0.03, fy, fz), (0.08, 0.86, 0.86), mat=mat_breeze_conc, parent=root)
    create_cyl(f"WH7_WestFanCircle_{fy_idx}", (X_MAIN_L - 0.06, fy, fz), 0.35, 0.04, rot=(0, math.pi / 2.0, 0), vertices=12, mat=mat_void_dark, parent=root)
    create_box(f"WH7_WestFanVisor_{fy_idx}", (X_MAIN_L - 0.38, fy, fz + 0.44), (0.78, 1.05, 0.04), rot=(0, -0.32, 0), mat=mat_roof_green1, parent=root)

for ef_idx, efy in enumerate([-4.60, 0.05, 4.70]):
    efz = 4.65
    # East Gable Green Weather Hoods (3 green tabs visible along right edge of 'acb29c17.png'!)
    create_box(f"WH7_EastFanFrame_{ef_idx}", (X_MAIN_R + 0.03, efy, efz), (0.08, 0.86, 0.86), mat=mat_breeze_conc, parent=root)
    create_cyl(f"WH7_EastFanCircle_{ef_idx}", (X_MAIN_R + 0.06, efy, efz), 0.35, 0.04, rot=(0, math.pi / 2.0, 0), vertices=12, mat=mat_void_dark, parent=root)
    create_box(f"WH7_EastFanVisor_{ef_idx}", (X_MAIN_R + 0.38, efy, efz + 0.44), (0.78, 1.05, 0.04), rot=(0, 0.32, 0), mat=mat_roof_green1, parent=root)

# ==============================================================================
# 4. SOUTH CANTILEVERED STEEL-TRUSS LOADING CANOPY, ELEVATED CONCRETE RAMP &
#    GALVANIZED ROLL-UP SHUTTER DOOR (v[4]..v[7], '7 Front View.jpg')
# ==============================================================================
CAN_X0, CAN_X1 = -2.68, 2.32
CAN_W = CAN_X1 - CAN_X0                  # 5.00 m
CAN_CX = (CAN_X0 + CAN_X1) / 2.0         # -0.18 m (Aligned with entrance_7 X = -0.09 m!)
CAN_Y0, CAN_Y1 = -11.58, Y_MAIN_F
CAN_D = CAN_Y1 - CAN_Y0                  # 3.83 m
CAN_CY = (CAN_Y0 + CAN_Y1) / 2.0         # -9.665 m

# Elevated Concrete Loading Dock Platform / Ramp strictly inside v[4]..v[7] ('7 small building...jpg')
dock_verts = [
    (CAN_X0, CAN_Y1, 0.0),
    (CAN_X1, CAN_Y1, 0.0),
    (CAN_X1, CAN_Y0, 0.0),
    (CAN_X0, CAN_Y0, 0.0),
    (CAN_X0, CAN_Y1, 0.50),
    (CAN_X1, CAN_Y1, 0.50),
    (CAN_X1, CAN_Y1 - 1.35, 0.48),
    (CAN_X0, CAN_Y1 - 1.35, 0.48),
    (CAN_X1, CAN_Y0, 0.08),
    (CAN_X0, CAN_Y0, 0.08),
]
dock_faces = [
    (0, 1, 2, 3),
    (4, 5, 6, 7),
    (7, 6, 8, 9),
    (3, 2, 8, 9),
    (1, 5, 6), (1, 6, 8, 2),
    (0, 7, 4), (0, 3, 9, 7),
]
create_prism("WH7_LoadingDockRamp", dock_verts, dock_faces, mat=mat_plinth_conc, parent=root)

# Commercial Galvanized Steel Roll-Up Shutter Door above Loading Dock ('7 Front View.jpg')
SHUT_W = 3.48
SHUT_H = 3.12
SHUT_Z0 = 0.50
create_box("WH7_ShutterPanel", (CAN_CX, Y_MAIN_F - 0.04, SHUT_Z0 + SHUT_H / 2.0), (SHUT_W, 0.06, SHUT_H), mat=mat_shutter_galv, parent=root)
for sl_i in range(14):
    sz = SHUT_Z0 + 0.14 + sl_i * (SHUT_H / 14.0)
    create_box(f"WH7_ShutterSlat_{sl_i}", (CAN_CX, Y_MAIN_F - 0.075, sz), (SHUT_W - 0.06, 0.015, 0.042), mat=mat_shutter_dark, parent=root)

# Cantilevered Steel-Truss Loading Canopy (Z = 4.26m at wall, sloping gently down to Z = 4.10m at front edge)
can_z_wall = 4.26
can_z_tip = 4.10
can_pitch = math.atan2(can_z_wall - can_z_tip, CAN_D)
can_slen = math.hypot(CAN_D, can_z_wall - can_z_tip)
can_mid_z = (can_z_wall + can_z_tip) / 2.0

# Forest-green corrugated top roof sheet + galvanized underside soffit + dark fascia perimeter frame
create_box("WH7_CanopyTopGreen", (CAN_CX, CAN_CY, can_mid_z + 0.03), (CAN_W, can_slen, 0.03), rot=(can_pitch, 0, 0), mat=mat_roof_annex, parent=root)
create_box("WH7_CanopyUnderGalv", (CAN_CX, CAN_CY, can_mid_z + 0.005), (CAN_W - 0.08, can_slen - 0.08, 0.02), rot=(can_pitch, 0, 0), mat=mat_canopy_soffit, parent=root)
create_box("WH7_CanopyFrontFascia", (CAN_CX, CAN_Y0 + 0.03, can_z_tip - 0.03), (CAN_W + 0.04, 0.06, 0.16), mat=mat_fascia_dark, parent=root)
for cs_x in (CAN_X0 + 0.03, CAN_X1 - 0.03):
    create_box(f"WH7_CanopySideFascia_{cs_x:.2f}", (cs_x, CAN_CY, can_mid_z - 0.03), (0.06, can_slen, 0.16), rot=(can_pitch, 0, 0), mat=mat_fascia_dark, parent=root)

# Exposed Steel Rafters, Transverse Purlins & Diagonal Steel Knee-Brace Struts ('7 Front View.jpg')
for rx in [CAN_X0 + 0.14, CAN_CX, CAN_X1 - 0.14]:
    create_box(f"WH7_CanopyRafter_{rx:.2f}", (rx, CAN_CY, can_mid_z - 0.06), (0.065, can_slen - 0.08, 0.085), rot=(can_pitch, 0, 0), mat=mat_steel_truss, parent=root)

for p_i in range(6):
    pf = (p_i + 0.5) / 6.0
    py = CAN_Y1 - pf * CAN_D
    pz = can_z_wall - pf * (can_z_wall - can_z_tip) - 0.03
    create_box(f"WH7_CanopyPurlin_{p_i}", (CAN_CX, py, pz), (CAN_W - 0.12, 0.055, 0.055), mat=mat_steel_truss, parent=root)

# Diagonal Steel Knee-Brace Struts on Left & Right edges of Canopy ('7 Front View.jpg' & '7 small building...jpg')
for kb_x in (CAN_X0 + 0.14, CAN_X1 - 0.14):
    y_a, z_a = CAN_Y1 - 0.05, 3.32
    y_b, z_b = CAN_Y1 - 2.65, can_z_wall - (2.65 / CAN_D) * (can_z_wall - can_z_tip) - 0.08
    kb_len = math.hypot(y_b - y_a, z_b - z_a)
    kb_ang = math.atan2(z_b - z_a, abs(y_b - y_a))
    create_box(
        f"WH7_CanopyKneeBrace_{kb_x:.2f}",
        (kb_x, (y_a + y_b) / 2.0, (z_a + z_b) / 2.0),
        (0.06, kb_len, 0.065),
        rot=(-kb_ang, 0, 0),
        mat=mat_steel_truss,
        parent=root
    )
    # Horizontal mid tie strut in triangular bracket
    create_box(f"WH7_CanopyTieStrut_{kb_x:.2f}", (kb_x, CAN_Y1 - 0.75, 3.74), (0.05, 1.45, 0.05), mat=mat_steel_truss, parent=root)

# ==============================================================================
# 5. ATTACHED WESTERN VIBRANT LIME-GREEN SINGLE-STORY ANNEX (v[0], v[1], v[2], v[11])
#    ('7 Small building.jpg', '7 small building in left...jpg', & drone 'acb29c17.png')
# ==============================================================================
ANX_ROOF_X0 = -14.14
ANX_WALL_X0 = -13.30                     # 0.84 m sheltered West eave overhang ('7 Small building.jpg')
ANX_X1 = X_MAIN_L                        # -7.88 m (Abuts Main Warehouse West Wall seamlessly!)
ANX_WALL_W = ANX_X1 - ANX_WALL_X0        # 5.42 m
ANX_WALL_CX = (ANX_WALL_X0 + ANX_X1) / 2.0  # -10.59 m

ANX_Y0 = -2.55                           # Exact v[1]/v[2] South front wall!
ANX_Y1 = 7.66                            # Exact v[0]/v[11] North rear wall!
ANX_D = ANX_Y1 - ANX_Y0                  # 10.21 m
ANX_CY = (ANX_Y0 + ANX_Y1) / 2.0         # +2.555 m

ANX_H = 3.28                             # Main lime-green wall height below olive fascia

create_box("WH7_AnnexPlinth", (ANX_WALL_CX, ANX_CY, 0.08), (ANX_WALL_W + 0.06, ANX_D + 0.06, 0.16), mat=mat_plinth_conc, parent=root)
create_box("WH7_AnnexBody", (ANX_WALL_CX, ANX_CY, ANX_H / 2.0), (ANX_WALL_W, ANX_D, ANX_H), mat=mat_annex_lime, parent=root)

# Weathered pale rear-west wall section visible under West overhang in '7 Small building.jpg'
create_box("WH7_AnnexWestRearPale", (ANX_WALL_X0 - 0.01, ANX_CY + 2.35, ANX_H / 2.0), (0.04, 5.10, ANX_H - 0.10), mat=mat_gable_pale, parent=root)

# Stepped Olive-Khaki Upper Fascia / Parapet Band along South Front of Annex ('7 Small building.jpg')
create_box("WH7_AnnexFrontOliveBand", (ANX_WALL_CX, ANX_Y0 - 0.03, ANX_H + 0.15), (ANX_WALL_W + 0.06, 0.12, 0.30), mat=mat_annex_fascia_olive, parent=root)
create_box("WH7_AnnexFrontCapLip", (ANX_WALL_CX, ANX_Y0 - 0.05, ANX_H + 0.31), (ANX_WALL_W + 0.10, 0.16, 0.05), mat=mat_fascia_dark, parent=root)

# Gentle West-Sloping Green Corrugated Shed Roof over Annex (X = -7.88m at Z = 3.52m down to X = -14.14m at Z = 3.24m)
ANX_ROOF_W = ANX_X1 - ANX_ROOF_X0        # 6.26 m
ANX_ROOF_CX = (ANX_ROOF_X0 + ANX_X1) / 2.0  # -11.01 m
anx_z_east = 3.52
anx_z_west = 3.24
anx_pitch = math.atan2(anx_z_east - anx_z_west, ANX_ROOF_W)
anx_slen = math.hypot(ANX_ROOF_W, anx_z_east - anx_z_west)
anx_mid_z = (anx_z_east + anx_z_west) / 2.0

create_box("WH7_AnnexRoofTop", (ANX_ROOF_CX, ANX_CY, anx_mid_z), (anx_slen, ANX_D + 0.12, 0.038), rot=(0, -anx_pitch, 0), mat=mat_roof_annex, parent=root)
create_box("WH7_AnnexRoofSoffit", ((ANX_ROOF_X0 + ANX_WALL_X0) / 2.0, ANX_CY, anx_z_west + 0.02), (ANX_WALL_X0 - ANX_ROOF_X0, ANX_D + 0.04, 0.018), rot=(0, -anx_pitch, 0), mat=mat_canopy_soffit, parent=root)

# Subtle rust-weathered patches along West eave edge of Annex roof ('acb29c17.png' far-left edge)
for ar_y in [-1.8, 0.2, 2.3, 6.2]:
    create_box(f"WH7_AnnexWestRust_{ar_y:.1f}", (ANX_ROOF_X0 + 0.22, ar_y, anx_z_west + 0.03), (0.42, 1.15, 0.018), rot=(0, -anx_pitch, 0), mat=mat_roof_rust, parent=root)

# Dark-Green West Eave Fascia, Exposed Overhang Rafters & Lime-Green PVC Gutter + Return Downspout ('7 Small building.jpg')
create_box("WH7_AnnexWestFascia", (ANX_ROOF_X0 + 0.02, ANX_CY, anx_z_west - 0.03), (0.04, ANX_D + 0.16, 0.16), mat=mat_fascia_dark, parent=root)
create_cyl("WH7_AnnexWestGutter", (ANX_ROOF_X0 - 0.03, ANX_CY, anx_z_west - 0.06), 0.045, ANX_D + 0.14, rot=(math.pi / 2.0, 0, 0), vertices=8, mat=mat_pipe_green, parent=root)
# Horizontal return leader pipe at South-West eave + vertical lime-green downspout on SW corner ('7 Small building.jpg')
create_cyl("WH7_AnnexLeaderReturn", ((ANX_ROOF_X0 + ANX_WALL_X0) / 2.0, ANX_Y0 + 0.08, 3.06), 0.038, 0.88, rot=(0, math.pi / 2.0 - 0.12, 0), vertices=8, mat=mat_pipe_green, parent=root)
create_cyl("WH7_AnnexSWDownspout", (ANX_WALL_X0 - 0.05, ANX_Y0 + 0.08, 1.54), 0.040, 3.08, vertices=8, mat=mat_pipe_green, parent=root)

for or_y in [-2.35, 0.15, 2.65, 5.15, 7.45]:
    create_box(f"WH7_AnnexOverhangRafter_{or_y:.2f}", ((ANX_ROOF_X0 + ANX_WALL_X0) / 2.0, or_y, anx_z_west - 0.03), (0.84, 0.05, 0.07), rot=(0, -anx_pitch, 0), mat=mat_steel_truss, parent=root)

# Dark Forest-Green Pedestrian Door on South Wall of Annex ('7 Small building.jpg')
DOOR_X = -11.82
create_box("WH7_AnnexDoorFrame", (DOOR_X, ANX_Y0 - 0.02, 1.07), (0.98, 0.06, 2.14), mat=mat_win_frame_blk, parent=root)
create_box("WH7_AnnexDoorLeaf", (DOOR_X, ANX_Y0 - 0.035, 1.06), (0.90, 0.04, 2.08), mat=mat_annex_door_green, parent=root)
create_cyl("WH7_AnnexDoorknob", (DOOR_X + 0.36, ANX_Y0 - 0.07, 0.98), 0.025, 0.05, rot=(math.pi / 2.0, 0, 0), vertices=8, mat=mat_stainless, parent=root)

# Black-Framed 2-Panel Sliding Window on South Wall of Annex ('7 Small building.jpg')
WIN_S_X = -9.58
WIN_Z = 1.48
create_box("WH7_AnnexFrontWinFrame", (WIN_S_X, ANX_Y0 - 0.025, WIN_Z), (1.18, 0.06, 1.14), mat=mat_win_frame_blk, parent=root)
create_box("WH7_AnnexFrontWinGlass", (WIN_S_X, ANX_Y0 - 0.04, WIN_Z), (1.06, 0.04, 1.02), mat=mat_win_glass, parent=root)
create_box("WH7_AnnexFrontWinMullion", (WIN_S_X, ANX_Y0 - 0.05, WIN_Z), (0.04, 0.03, 1.06), mat=mat_win_frame_blk, parent=root)

# Two Black-Framed Sliding Windows on West Flank Wall of Annex ('7 Small building.jpg')
for w_idx, wy_pos in enumerate([0.15, 4.10]):
    create_box(f"WH7_AnnexWestWinFrame_{w_idx}", (ANX_WALL_X0 - 0.025, wy_pos, WIN_Z), (0.06, 1.16, 1.14), mat=mat_win_frame_blk, parent=root)
    create_box(f"WH7_AnnexWestWinGlass_{w_idx}", (ANX_WALL_X0 - 0.04, wy_pos, WIN_Z), (0.04, 1.04, 1.02), mat=mat_win_glass, parent=root)
    create_box(f"WH7_AnnexWestWinMullion_{w_idx}", (ANX_WALL_X0 - 0.05, wy_pos, WIN_Z), (0.03, 0.04, 1.06), mat=mat_win_frame_blk, parent=root)

# Cylindrical Stainless-Steel Rooftop Tank / Turbine Vent on Annex Roof ('7 Small building.jpg')
create_cyl("WH7_AnnexRoofStainlessTank", (-11.65, 1.85, 3.62), 0.23, 0.48, vertices=12, mat=mat_stainless, parent=root)
create_cyl("WH7_AnnexRoofTankCap", (-11.65, 1.85, 3.88), 0.25, 0.04, vertices=12, mat=mat_stainless, parent=root)

# Join all WH7 mesh objects into a single optimized multi-material mesh
bpy.ops.object.select_all(action='DESELECT')
mesh_objs = [o for o in bpy.data.objects if o.name.startswith("WH7_") and o.type == 'MESH']
if mesh_objs:
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = "WH7_CombinedMesh"

# Export to models/warehouse_7.glb
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.name.startswith("WH7_"):
        obj.select_set(True)

export_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_7.glb"
bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True
)
print(f"Successfully exported {export_path}")
