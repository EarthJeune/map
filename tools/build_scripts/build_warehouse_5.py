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
# MATERIALS (Ground-truth from '5 Front View.jpg', '5 Front Vieww.jpg',
# '5 Left part of the building Vieww.jpg', '5 Side View.jpg', and drone '768a0d78.jpg')
# ==============================================================================
mat_wall_cream = make_mat("WH5_WallWarmCream", (0.89, 0.84, 0.71, 1.0), roughness=0.78)
mat_pilaster = make_mat("WH5_PilasterCream", (0.86, 0.81, 0.68, 1.0), roughness=0.80)
mat_plinth = make_mat("WH5_PlinthGrey", (0.48, 0.47, 0.44, 1.0), roughness=0.86)
mat_canopy_top = make_mat("WH5_CanopyWeatheredTop", (0.32, 0.31, 0.30, 1.0), roughness=0.90)
mat_canopy_edge = make_mat("WH5_CanopyEdgeCream", (0.84, 0.80, 0.68, 1.0), roughness=0.78)

# Rich Forest-Green Corrugated Metal Roof & Box Fascia ('768a0d78.jpg', '5 Front View.jpg')
mat_roof_green1 = make_mat("WH5_RoofEmerald1", (0.17, 0.39, 0.28, 1.0), roughness=0.52, metallic=0.20)
mat_roof_green2 = make_mat("WH5_RoofEmerald2", (0.20, 0.43, 0.31, 1.0), roughness=0.56, metallic=0.18)
mat_fascia_green = make_mat("WH5_BoxFasciaDarkGreen", (0.09, 0.25, 0.16, 1.0), roughness=0.45, metallic=0.22)

# Roll-Up Steel Shutter Doors, Windows, Breeze Blocks & Exhaust Fans
mat_shutter_galv = make_mat("WH5_ShutterGalv", (0.64, 0.66, 0.68, 1.0), roughness=0.42, metallic=0.55)
mat_shutter_dark = make_mat("WH5_ShutterGroove", (0.42, 0.44, 0.46, 1.0), roughness=0.50, metallic=0.45)
mat_door_void = make_mat("WH5_DoorwayDark", (0.07, 0.08, 0.08, 1.0), roughness=0.92)
mat_win_frame = make_mat("WH5_WinFrameWhite", (0.93, 0.94, 0.93, 1.0), roughness=0.42)
mat_win_glass = make_mat("WH5_WinGlassDark", (0.14, 0.20, 0.22, 1.0), roughness=0.20, metallic=0.25)
mat_vent_void = make_mat("WH5_VentSlotDark", (0.16, 0.18, 0.17, 1.0), roughness=0.88)
mat_hood_metal = make_mat("WH5_ExhaustHoodMetal", (0.62, 0.60, 0.57, 1.0), roughness=0.50, metallic=0.45)
mat_hood_rust = make_mat("WH5_ExhaustHoodRust", (0.46, 0.28, 0.19, 1.0), roughness=0.72, metallic=0.30)

# Official DA Project Tarpaulin Billboard ('5 Front View.jpg' & '5 Side View.jpg')
mat_tarp_white = make_mat("WH5_TarpWhite", (0.94, 0.95, 0.97, 1.0), roughness=0.45)
mat_tarp_blue = make_mat("WH5_TarpHeaderBlue", (0.18, 0.30, 0.52, 1.0), roughness=0.50)
mat_pipe_galv = make_mat("WH5_PipeGalv", (0.74, 0.76, 0.78, 1.0), roughness=0.35, metallic=0.65)

# ==============================================================================
# EXACT 12-VERTEX GEOMETRY IN TRUE 341.05 DEG FRAME
# Center: [121.16721999, 13.96006949], Mapbox rotation = 341.05 deg (compass 161.05 deg SSE)
#   Main Hall:
#     X_LEFT  = -11.58 m   to   X_RIGHT = +12.57 m  (Width  = 24.15 m)
#     Y_FRONT =  -9.35 m   to   Y_REAR  = +10.05 m  (Depth  = 19.40 m, Ridge Y = +0.35 m)
#   South Front Cantilevered Loading Canopy (w5[1]..w5[4]):
#     X = -5.68 m to +0.54 m (Width = 6.22 m), Y = -9.35 m to -11.81 m (Proj = 2.46 m)
#   West Side Cantilevered Loading Canopy (w5[8]..w5[11]):
#     X = -11.58 m to -14.36 m (Proj = 2.78 m), Y = -2.82 m to +2.62 m (Width = 5.44 m)
# ==============================================================================
X_LEFT = -11.58
X_RIGHT = 12.57
W = X_RIGHT - X_LEFT             # 24.15 m
CX = (X_LEFT + X_RIGHT) / 2.0    # +0.495 m

Y_FRONT = -9.35
Y_REAR = 10.05
D = Y_REAR - Y_FRONT             # 19.40 m
CY = (Y_FRONT + Y_REAR) / 2.0    # +0.35 m (Exact ridge line!)

H_LEDGE = 3.70                   # Concrete eyebrow sun-ledge height
H_EAVE = 4.60                    # Main wall eave height
H_APEX = 6.20                    # Symmetrical East-West gable ridge height
PARAPET_UP = 0.16                # West & East gable parapet coping rise above roof

root = bpy.data.objects.new("WH5_Root", None)
bpy.context.collection.objects.link(root)

# 1. Main Warehouse Structural Body & Foundation Plinth
create_box("WH5_FoundationPlinth", (CX, CY, 0.12), (W + 0.08, D + 0.08, 0.24), mat=mat_plinth, parent=root)
create_box("WH5_MainBody", (CX, CY, H_EAVE / 2.0), (W, D, H_EAVE), mat=mat_wall_cream, parent=root)

# Symmetrical Gable End Walls + Concrete Parapet Copings on West (X_LEFT) & East (X_RIGHT) ('5 Side View.jpg')
gable_faces = [(0, 2, 1), (3, 4, 5), (0, 3, 5, 2), (2, 5, 4, 1), (0, 1, 4, 3)]
# Main interior gable fill spanning X_LEFT to X_RIGHT
main_gable_verts = [
    (X_LEFT + 0.24, Y_FRONT, H_EAVE),
    (X_LEFT + 0.24, Y_REAR, H_EAVE),
    (X_LEFT + 0.24, CY, H_APEX),
    (X_RIGHT - 0.24, Y_FRONT, H_EAVE),
    (X_RIGHT - 0.24, Y_REAR, H_EAVE),
    (X_RIGHT - 0.24, CY, H_APEX),
]
create_prism("WH5_MainGableCore", main_gable_verts, gable_faces, mat=mat_wall_cream, parent=root)

# West & East Gable Parapet Walls (0.26m thick, rising PARAPET_UP above roof slope)
for tag, x0, x1 in [("WestParapet", X_LEFT - 0.02, X_LEFT + 0.24), ("EastParapet", X_RIGHT - 0.24, X_RIGHT + 0.02)]:
    p_verts = [
        (x0, Y_FRONT - 0.04, H_EAVE + PARAPET_UP),
        (x0, Y_REAR + 0.04, H_EAVE + PARAPET_UP),
        (x0, CY, H_APEX + PARAPET_UP),
        (x1, Y_FRONT - 0.04, H_EAVE + PARAPET_UP),
        (x1, Y_REAR + 0.04, H_EAVE + PARAPET_UP),
        (x1, CY, H_APEX + PARAPET_UP),
    ]
    create_prism(f"WH5_{tag}", p_verts, gable_faces, mat=mat_pilaster, parent=root)
    # Vertical base down to H_EAVE at corners
    create_box(f"WH5_{tag}_Base", ((x0 + x1) / 2.0, CY, H_EAVE + PARAPET_UP / 2.0), (x1 - x0, D + 0.08, PARAPET_UP), mat=mat_pilaster, parent=root)

# Structural Concrete Pilasters on West, East, Front & Rear Walls ('5 Left part of the building Vieww.jpg')
for py in [Y_FRONT + 0.22, -2.95, 2.75, Y_REAR - 0.22]:
    pz_top = H_EAVE + (1.0 - abs(py - CY) / (D / 2.0)) * (H_APEX - H_EAVE) + PARAPET_UP - 0.05
    if py in [Y_FRONT + 0.22, Y_REAR - 0.22]:
        pz_top = H_EAVE
    create_box(f"WH5_WestPilaster_{py:.1f}", (X_LEFT - 0.06, py, pz_top / 2.0), (0.16, 0.44, pz_top), mat=mat_pilaster, parent=root)
    create_box(f"WH5_EastPilaster_{py:.1f}", (X_RIGHT + 0.06, py, pz_top / 2.0), (0.16, 0.44, pz_top), mat=mat_pilaster, parent=root)

# Horizontal relief belt beam across West & East gable walls at Z = 3.55m
create_box("WH5_WestBeltBeam", (X_LEFT - 0.03, CY, 3.55), (0.08, D, 0.24), mat=mat_pilaster, parent=root)
create_box("WH5_EastBeltBeam", (X_RIGHT + 0.03, CY, 3.55), (0.08, D, 0.24), mat=mat_pilaster, parent=root)

# ==============================================================================
# 2. RICH FOREST-GREEN GABLE ROOF & DOUBLE-STEPPED DARK GREEN BOX FASCIAS
# ==============================================================================
HALF_D = D / 2.0 + 0.35
RISE = H_APEX - H_EAVE
PITCH = math.atan2(RISE, D / 2.0)
SLOPE_LEN = math.hypot(HALF_D, HALF_D * math.tan(PITCH))
ROOF_W = W - 0.44  # Nestled cleanly between West and East parapet copings

num_roof_panels = 20
panel_w = ROOF_W / num_roof_panels
for i in range(num_roof_panels):
    px = (X_LEFT + 0.22) + (i + 0.5) * panel_w
    rmat = mat_roof_green1 if (i % 2 == 0) else mat_roof_green2
    # South Slope (Y from CY - HALF_D to CY)
    s_mid_y = CY - HALF_D / 2.0
    s_mid_z = H_APEX - (HALF_D / 2.0) * math.tan(PITCH) + 0.04
    create_box(f"WH5_RoofSouth_{i}", (px, s_mid_y, s_mid_z), (panel_w * 0.994, SLOPE_LEN, 0.045), rot=(PITCH, 0, 0), mat=rmat, parent=root)
    # North Slope (Y from CY to CY + HALF_D)
    n_mid_y = CY + HALF_D / 2.0
    create_box(f"WH5_RoofNorth_{i}", (px, n_mid_y, s_mid_z), (panel_w * 0.994, SLOPE_LEN, 0.045), rot=(-PITCH, 0, 0), mat=rmat, parent=root)

# Central Green Ridge Cap
create_box("WH5_RidgeCap", (CX, CY, H_APEX + 0.06), (ROOF_W + 0.04, 0.36, 0.05), mat=mat_fascia_green, parent=root)

# Double-Stepped Dark Forest-Green Box Fascia & Gutter on South (Front) and North (Rear) Eaves ('5 Side View.jpg')
for side_sign, ey in [(-1, Y_FRONT), (1, Y_REAR)]:
    create_box(f"WH5_BoxFasciaLow_{side_sign}", (CX, ey + side_sign * 0.22, H_EAVE - 0.14), (W + 0.04, 0.44, 0.28), mat=mat_fascia_green, parent=root)
    create_box(f"WH5_BoxFasciaHigh_{side_sign}", (CX, ey + side_sign * 0.30, H_EAVE + 0.08), (W + 0.08, 0.56, 0.24), mat=mat_fascia_green, parent=root)

# ==============================================================================
# 3. SOUTH FRONT FACADE: CANTILEVERED CONCRETE LOADING CANOPY, ROLL-UP SHUTTER,
#    EYEBROW SUN-LEDGE, BREEZE-BLOCK VENTS, RIBBON WINDOWS & DA BILLBOARD
# ==============================================================================
FCAN_X0 = -5.68
FCAN_X1 = 0.54
FCAN_W = FCAN_X1 - FCAN_X0       # 6.22 m
FCAN_CX = (FCAN_X0 + FCAN_X1) / 2.0  # -2.57 m (Exact entrance_5 X!)
FCAN_Y0 = -11.81                 # Exact w5[2]/w5[3] front drip line!
FCAN_Y1 = Y_FRONT
FCAN_D = FCAN_Y1 - FCAN_Y0       # 2.46 m
FCAN_CY = (FCAN_Y0 + FCAN_Y1) / 2.0

# Upward-sloping cantilevered concrete canopy slab (Z = 3.72m at wall rising to Z = 4.18m at front edge, matching '5 Front View.jpg')
fcan_z_wall = 3.72
fcan_z_tip = 4.18
fcan_pitch = math.atan2(fcan_z_tip - fcan_z_wall, FCAN_D)
fcan_len = math.hypot(FCAN_D, fcan_z_tip - fcan_z_wall)
fcan_mid_z = (fcan_z_wall + fcan_z_tip) / 2.0

# Cream underside & fascia slab + weathered dark concrete top layer (matching '768a0d78.jpg')
create_box("WH5_FrontCanopySlab", (FCAN_CX, FCAN_CY, fcan_mid_z), (FCAN_W, fcan_len, 0.18), rot=(-fcan_pitch, 0, 0), mat=mat_canopy_edge, parent=root)
create_box("WH5_FrontCanopyTop", (FCAN_CX, FCAN_CY, fcan_mid_z + 0.095), (FCAN_W - 0.08, fcan_len - 0.08, 0.02), rot=(-fcan_pitch, 0, 0), mat=mat_canopy_top, parent=root)

# Two Triangular Concrete Side Cheek Bracket Fins supporting the Front Canopy ('5 Front View.jpg')
fin_faces = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (0, 2, 5, 3)]
for fin_tag, fx in [("Left", FCAN_X0 + 0.11), ("Right", FCAN_X1 - 0.11)]:
    f_verts = [
        (fx - 0.11, FCAN_Y1, 2.95),
        (fx - 0.11, FCAN_Y1, fcan_z_wall),
        (fx - 0.11, FCAN_Y0 + 0.08, fcan_z_tip - 0.05),
        (fx + 0.11, FCAN_Y1, 2.95),
        (fx + 0.11, FCAN_Y1, fcan_z_wall),
        (fx + 0.11, FCAN_Y0 + 0.08, fcan_z_tip - 0.05),
    ]
    create_prism(f"WH5_FrontCanopyFin_{fin_tag}", f_verts, fin_faces, mat=mat_wall_cream, parent=root)

# Front Concrete Landing Apron beneath Front Canopy (strictly inside w5[1]..w5[4])
create_box("WH5_FrontDockApron", (FCAN_CX, FCAN_CY, 0.07), (FCAN_W, FCAN_D, 0.14), mat=mat_plinth, parent=root)

# Large Galvanized Roll-Up Steel Shutter Door under Front Canopy (X = -4.60m to -1.20m, H = 3.20m)
FSHUT_CX = -2.90
FSHUT_W = 3.40
FSHUT_H = 3.15
create_box("WH5_FrontShutterPanel", (FSHUT_CX, Y_FRONT - 0.03, FSHUT_H / 2.0 + 0.05), (FSHUT_W, 0.06, FSHUT_H), mat=mat_shutter_galv, parent=root)
# Horizontal shutter slats + Top Roller Housing Box
for sl_i in range(14):
    sz = 0.18 + sl_i * (FSHUT_H / 14.0)
    create_box(f"WH5_FrontShutterSlat_{sl_i}", (FSHUT_CX, Y_FRONT - 0.065, sz), (FSHUT_W - 0.06, 0.015, 0.04), mat=mat_shutter_dark, parent=root)
create_box("WH5_FrontShutterBox", (FSHUT_CX, Y_FRONT - 0.18, FSHUT_H + 0.24), (FSHUT_W + 0.12, 0.36, 0.40), mat=mat_wall_cream, parent=root)

# Recessed Dark Pedestrian Entrance Doorway right of Front Roll-Up Shutter (X = -0.15m, '5 Front View.jpg')
create_box("WH5_FrontPedDoor", (-0.15, Y_FRONT - 0.01, 1.12), (0.96, 0.08, 2.20), mat=mat_door_void, parent=root)

# Concrete Eyebrow Sun-Ledges & Breeze-Block Clerestory Ventilation Grilles Left & Right of Front Canopy
for seg_tag, sx0, sx1 in [("Left", X_LEFT + 0.24, FCAN_X0), ("Right", FCAN_X1, X_RIGHT - 0.24)]:
    seg_w = sx1 - sx0
    seg_cx = (sx0 + sx1) / 2.0
    # Concrete eyebrow ledge at Z = H_LEDGE (3.70m)
    create_box(f"WH5_EyebrowLedge_{seg_tag}", (seg_cx, Y_FRONT - 0.22, H_LEDGE), (seg_w, 0.48, 0.12), mat=mat_pilaster, parent=root)
    # Breeze-block dark horizontal ventilation band with vertical cream dividers (Z = 3.90m to 4.24m)
    vent_w = seg_w - 0.80
    create_box(f"WH5_BreezeBand_{seg_tag}", (seg_cx, Y_FRONT - 0.02, 4.07), (vent_w, 0.06, 0.32), mat=mat_vent_void, parent=root)
    create_box(f"WH5_BreezeMidBar_{seg_tag}", (seg_cx, Y_FRONT - 0.055, 4.07), (vent_w, 0.02, 0.04), mat=mat_wall_cream, parent=root)
    num_vdivs = max(4, int(vent_w / 0.55))
    for vd_i in range(num_vdivs + 1):
        vdx = (seg_cx - vent_w / 2.0) + vd_i * (vent_w / num_vdivs)
        create_box(f"WH5_BreezeVert_{seg_tag}_{vd_i}", (vdx, Y_FRONT - 0.055, 4.07), (0.05, 0.02, 0.34), mat=mat_wall_cream, parent=root)

# Horizontal White-Framed Clerestory Ribbon Windows on Front Facade ('5 Front View.jpg' & '5 Front Vieww.jpg')
def build_ribbon_window(tag, wx, wy, ww, wh, wz, panes=4):
    create_box(f"WH5_WinFrame_{tag}", (wx, wy - 0.02, wz), (ww + 0.08, 0.06, wh + 0.08), mat=mat_win_frame, parent=root)
    create_box(f"WH5_WinGlass_{tag}", (wx, wy - 0.04, wz), (ww, 0.04, wh), mat=mat_win_glass, parent=root)
    for p_i in range(1, panes):
        mx = (wx - ww / 2.0) + p_i * (ww / panes)
        create_box(f"WH5_WinMul_{tag}_{p_i}", (mx, wy - 0.055, wz), (0.04, 0.03, wh + 0.04), mat=mat_win_frame, parent=root)

# Front-left 2-pane window + Front-right two 4-pane ribbon windows
build_ribbon_window("FrontLeft", -7.25, Y_FRONT, 1.50, 0.56, 2.68, panes=2)
build_ribbon_window("FrontRight1", 3.65, Y_FRONT, 3.20, 0.56, 2.68, panes=4)
build_ribbon_window("FrontRight2", 9.15, Y_FRONT, 3.20, 0.56, 2.68, panes=4)

# Attached Official DA Project Tarpaulin Billboard on Front-Left Wall ('5 Front View.jpg', '5 Side View.jpg')
TARP_X = -9.15
TARP_Y = Y_FRONT - 0.42
create_box("WH5_ProjectTarp", (TARP_X, TARP_Y, 2.15), (2.35, 0.04, 2.25), mat=mat_tarp_white, parent=root)
create_box("WH5_ProjectTarpHdr", (TARP_X, TARP_Y - 0.025, 3.05), (2.15, 0.015, 0.28), mat=mat_tarp_blue, parent=root)
for leg_dx in [-1.10, 1.10]:
    create_cyl(f"WH5_TarpPost_{leg_dx}", (TARP_X + leg_dx, TARP_Y - 0.02, 1.65), 0.022, 3.30, vertices=8, mat=mat_pipe_galv, parent=root)
    create_cyl(f"WH5_TarpBrace_{leg_dx}", (TARP_X + leg_dx, TARP_Y - 0.52, 0.95), 0.020, 2.05, rot=(math.radians(-28), 0, 0), vertices=8, mat=mat_pipe_galv, parent=root)

# ==============================================================================
# 4. WEST SIDE LOADING CANOPY, SECOND ROLL-UP SHUTTER & 4 GABLE EXHAUST FAN HOODS
#    ('5 Left part of the building Vieww.jpg' & drone '768a0d78.jpg')
# ==============================================================================
WCAN_X0 = -14.36                 # Exact w5[9]/w5[10] West edge!
WCAN_X1 = X_LEFT                 # -11.58 m
WCAN_W = WCAN_X1 - WCAN_X0       # 2.78 m projection
WCAN_CX = (WCAN_X0 + WCAN_X1) / 2.0
WCAN_Y0 = -2.82                  # Exact w5[10]/w5[11]
WCAN_Y1 = 2.62                   # Exact w5[8]/w5[9]
WCAN_LEN = WCAN_Y1 - WCAN_Y0     # 5.44 m width
WCAN_CY = (WCAN_Y0 + WCAN_Y1) / 2.0  # -0.10 m

# Flat Cantilevered Concrete Canopy at Z = 3.55m + Dock Apron
create_box("WH5_WestCanopySlab", (WCAN_CX, WCAN_CY, 3.55), (WCAN_W, WCAN_LEN, 0.18), mat=mat_canopy_edge, parent=root)
create_box("WH5_WestCanopyTop", (WCAN_CX, WCAN_CY, 3.65), (WCAN_W - 0.06, WCAN_LEN - 0.06, 0.02), mat=mat_canopy_top, parent=root)
create_box("WH5_WestDockApron", (WCAN_CX, WCAN_CY, 0.07), (WCAN_W, WCAN_LEN, 0.14), mat=mat_plinth, parent=root)
# Side concrete brackets under West canopy
for wby in [WCAN_Y0 + 0.12, WCAN_Y1 - 0.12]:
    create_box(f"WH5_WestCanopyBracket_{wby:.1f}", (WCAN_CX + 0.25, wby, 3.30), (WCAN_W - 0.50, 0.20, 0.34), mat=mat_wall_cream, parent=root)

# Second Galvanized Steel Roll-Up Shutter Door under West Canopy ('5 Left part of the building Vieww.jpg')
WSHUT_W = 3.30
WSHUT_H = 3.05
create_box("WH5_WestShutterPanel", (X_LEFT - 0.03, WCAN_CY, WSHUT_H / 2.0 + 0.05), (0.06, WSHUT_W, WSHUT_H), mat=mat_shutter_galv, parent=root)
for sl_i in range(13):
    sz = 0.18 + sl_i * (WSHUT_H / 13.0)
    create_box(f"WH5_WestShutterSlat_{sl_i}", (X_LEFT - 0.065, WCAN_CY, sz), (0.015, WSHUT_W - 0.06, 0.04), mat=mat_shutter_dark, parent=root)
create_box("WH5_WestShutterBox", (X_LEFT - 0.18, WCAN_CY, WSHUT_H + 0.22), (0.36, WSHUT_W + 0.10, 0.36), mat=mat_wall_cream, parent=root)

# Twin Industrial Exhaust Fan Hoods on BOTH West Gable AND East Gable ('5 Left part Vieww.jpg' & '768a0d78.jpg')
for side_tag, gx, dir_s in [("West", X_LEFT, -1), ("East", X_RIGHT, 1)]:
    for fan_idx, fy in enumerate([CY - 0.72, CY + 0.52]):
        fz = 4.65
        # Square fan box housing
        create_box(f"WH5_{side_tag}FanBox_{fan_idx}", (gx + dir_s * 0.20, fy, fz), (0.36, 0.92, 0.92), mat=mat_hood_metal, parent=root)
        # Dark circular fan opening
        create_cyl(f"WH5_{side_tag}FanCircle_{fan_idx}", (gx + dir_s * 0.39, fy, fz), 0.36, 0.04, rot=(0, math.pi/2, 0), vertices=14, mat=mat_door_void, parent=root)
        # Sloped weather hood visor above fan
        create_box(f"WH5_{side_tag}FanVisor_{fan_idx}", (gx + dir_s * 0.38, fy, fz + 0.44), (0.68, 0.96, 0.06), rot=(0, dir_s * 0.38, 0), mat=mat_hood_rust, parent=root)

# Join all WH5 mesh objects into a single optimized multi-material mesh under root
bpy.ops.object.select_all(action='DESELECT')
mesh_objs = [o for o in bpy.data.objects if o.name.startswith("WH5_") and o.type == 'MESH']
if mesh_objs:
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = "WH5_CombinedMesh"

# Export to models/warehouse_5.glb
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.name.startswith("WH5_"):
        obj.select_set(True)

export_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_5.glb"
bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True
)
print(f"Successfully exported {export_path}")

