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
# MATERIALS (Ground-truth from '3 Front View Full.jpg', '3 Inside Front View*.jpg',
# '3 Right Side of the building connecting to 4.jpg', and drone photo '5c9b9b80.png')
# ==============================================================================
mat_floor = make_mat("WH3_PolishedConcrete", (0.28, 0.29, 0.29, 1.0), roughness=0.45)
mat_plinth = make_mat("WH3_PlinthOchre", (0.72, 0.60, 0.34, 1.0), roughness=0.80)
mat_wall_yellow = make_mat("WH3_WallWarmYellow", (0.88, 0.80, 0.56, 1.0), roughness=0.78)
mat_wall_cream = make_mat("WH3_WallCream", (0.85, 0.79, 0.62, 1.0), roughness=0.78)
mat_fascia_maroon = make_mat("WH3_FasciaMaroon", (0.48, 0.18, 0.16, 1.0), roughness=0.70)
mat_gutter_green = make_mat("WH3_GutterGreen", (0.12, 0.36, 0.23, 1.0), roughness=0.55, metallic=0.15)
mat_ridge_teal = make_mat("WH3_RidgeTeal", (0.20, 0.48, 0.36, 1.0), roughness=0.55, metallic=0.20)

# Drone photo shows front (South) slope is weathered moss-green with rust streaks,
# and rear (North) slope is heavily rusted reddish-brown corrugated iron
mat_roof_green1 = make_mat("WH3_RoofMossGreen1", (0.27, 0.38, 0.26, 1.0), roughness=0.68, metallic=0.18)
mat_roof_green2 = make_mat("WH3_RoofMossGreen2", (0.33, 0.36, 0.25, 1.0), roughness=0.72, metallic=0.15)
mat_roof_rust1 = make_mat("WH3_RoofRustNorth1", (0.42, 0.25, 0.20, 1.0), roughness=0.74, metallic=0.15)
mat_roof_rust2 = make_mat("WH3_RoofRustNorth2", (0.36, 0.28, 0.22, 1.0), roughness=0.72, metallic=0.15)

mat_screen_mesh = make_mat("WH3_InsectScreen", (0.11, 0.12, 0.12, 1.0), roughness=0.85, alpha=0.72)
mat_screen_dark = make_mat("WH3_UpperGableDark", (0.10, 0.11, 0.10, 1.0), roughness=0.90)
mat_alu_frame = make_mat("WH3_AluFrame", (0.76, 0.78, 0.79, 1.0), roughness=0.35, metallic=0.55)
mat_white_frame = make_mat("WH3_WhiteFrame", (0.90, 0.90, 0.88, 1.0), roughness=0.50)
mat_glass_louver = make_mat("WH3_JalousieGlass", (0.20, 0.26, 0.30, 1.0), roughness=0.25, metallic=0.20)
mat_door_wood = make_mat("WH3_BrownWoodDoor", (0.36, 0.22, 0.15, 1.0), roughness=0.65)
mat_pvc_white = make_mat("WH3_PVCDownspout", (0.88, 0.86, 0.82, 1.0), roughness=0.55)

# Interior & Signage Props
mat_chair_white = make_mat("WH3_MonoblocWhite", (0.86, 0.85, 0.81, 1.0), roughness=0.50)
mat_chair_black = make_mat("WH3_MonoblocBlack", (0.14, 0.15, 0.16, 1.0), roughness=0.50)
mat_sack_white = make_mat("WH3_SeedSackWhite", (0.93, 0.94, 0.95, 1.0), roughness=0.65)
mat_pallet_dark = make_mat("WH3_PalletBase", (0.20, 0.21, 0.22, 1.0), roughness=0.80)
mat_fan_black = make_mat("WH3_FanBlack", (0.12, 0.12, 0.13, 1.0), roughness=0.45, metallic=0.30)
mat_jacket_blue = make_mat("WH3_RaincoatBlue", (0.24, 0.34, 0.62, 1.0), roughness=0.70)
mat_sign_white = make_mat("WH3_SignWhite", (0.95, 0.95, 0.95, 1.0), roughness=0.40)
mat_sign_red = make_mat("WH3_SignRed", (0.78, 0.14, 0.14, 1.0), roughness=0.45)
mat_sign_yellow = make_mat("WH3_SignYellow", (0.92, 0.78, 0.20, 1.0), roughness=0.50)
mat_wood_bench = make_mat("WH3_WoodBench", (0.48, 0.36, 0.24, 1.0), roughness=0.75)

# ==============================================================================
# GEOMETRY DIMENSIONS
# Footprint in buildings.json:
# Width W = 14.12 m along X (X_LEFT = -7.06m West to X_RIGHT = +7.06m East)
# Depth D = 10.33 m along Y (Y_FRONT = -5.165m South to Y_REAR = +5.165m North)
# Front normal faces 158.25 deg SSE -> Mapbox rotation = 338.25 deg
# ==============================================================================
W = 14.12
D = 10.33
X_LEFT = -W / 2.0     # -7.06 m (West)
X_RIGHT = W / 2.0     # +7.06 m (East - connects to Warehouse 4)
Y_FRONT = -D / 2.0    # -5.165 m (South front facing courtyard & entrance_3)
Y_REAR = D / 2.0      # +5.165 m (North rear - abuts Warehouse 4 rear wing)

X_DIV = -0.80         # Division between Left enclosed yellow room and Right screened veranda
Y_PART = 1.80         # Interior screen partition wall inside veranda
H_EAVE = 2.85         # Eave height
H_APEX = 4.30         # Symmetrical East-West gable ridge height at Y = 0.0
WALL_T = 0.16

root = bpy.data.objects.new("WH3_Root", None)
bpy.context.collection.objects.link(root)

# 1. Foundation Floor Slab (strictly confined to building footprint per Rule 4)
create_box("WH3_FloorSlab", (0.0, 0.0, 0.06), (W, D, 0.12), mat=mat_floor, parent=root)

# 2. Left Enclosed Yellow Office / Seed Packing Room (X = -7.06m to -0.80m, Y = -5.165m to +1.80m)
LEFT_W = X_DIV - X_LEFT           # 6.26 m
LEFT_CX = (X_LEFT + X_DIV) / 2.0  # -3.93 m
LEFT_D = Y_PART - Y_FRONT         # 6.965 m
LEFT_CY = (Y_FRONT + Y_PART) / 2.0

# Front yellow wall (Y = Y_FRONT)
create_box("WH3_LeftFrontWall", (LEFT_CX, Y_FRONT + WALL_T / 2.0, H_EAVE / 2.0), (LEFT_W, WALL_T, H_EAVE), mat=mat_wall_yellow, parent=root)
create_box("WH3_LeftFrontPlinth", (LEFT_CX, Y_FRONT + 0.01, 0.14), (LEFT_W, WALL_T + 0.03, 0.24), mat=mat_plinth, parent=root)

# Two 4-bay jalousie windows on the front yellow wall ('3 Front View.jpg')
for wx in [-5.35, -3.25]:
    win_w, win_h, win_z = 1.45, 1.25, 1.65
    create_box(f"WH3_FrontWinRecess_{wx}", (wx, Y_FRONT + 0.02, win_z), (win_w, 0.06, win_h), mat=mat_glass_louver, parent=root)
    # Outer frame & 3 vertical mullions (creating 4 bays)
    for mx in [-win_w/2, -win_w/6, win_w/6, win_w/2]:
        create_box(f"WH3_FrontWinMul_{wx}_{mx:.2f}", (wx + mx, Y_FRONT - 0.005, win_z), (0.035, 0.04, win_h + 0.04), mat=mat_alu_frame, parent=root)
    # Horizontal louver slats / bars
    for row in range(5):
        rz = win_z - win_h/2 + (row + 0.5) * (win_h / 5.0)
        create_box(f"WH3_FrontWinBar_{wx}_{row}", (wx, Y_FRONT - 0.005, rz), (win_w, 0.03, 0.025), mat=mat_alu_frame, parent=root)

# West exterior wall (X = X_LEFT, full depth D) with gable wall up to apex
create_box("WH3_WestWall", (X_LEFT + WALL_T / 2.0, 0.0, H_EAVE / 2.0), (WALL_T, D, H_EAVE), mat=mat_wall_yellow, parent=root)
west_gable_verts = [
    (X_LEFT, Y_FRONT, H_EAVE),
    (X_LEFT, Y_REAR, H_EAVE),
    (X_LEFT, 0.0, H_APEX),
    (X_LEFT + WALL_T, Y_FRONT, H_EAVE),
    (X_LEFT + WALL_T, Y_REAR, H_EAVE),
    (X_LEFT + WALL_T, 0.0, H_APEX),
]
west_gable_faces = [(0, 2, 1), (3, 4, 5), (0, 3, 5, 2), (2, 5, 4, 1), (0, 1, 4, 3)]
create_prism("WH3_WestGable", west_gable_verts, west_gable_faces, mat=mat_wall_yellow, parent=root)

# North rear wall (Y = Y_REAR, full width W)
create_box("WH3_NorthRearWall", (0.0, Y_REAR - WALL_T / 2.0, H_EAVE / 2.0), (W, WALL_T, H_EAVE), mat=mat_wall_cream, parent=root)

# Interior dividing wall at X = X_DIV (-0.80m) facing the screened veranda ('3 Inside Front View.jpg')
create_box("WH3_InnerDivWall", (X_DIV - WALL_T / 2.0, LEFT_CY, H_EAVE / 2.0), (WALL_T, LEFT_D, H_EAVE), mat=mat_wall_yellow, parent=root)
create_box("WH3_InnerDivPlinth", (X_DIV + 0.01, LEFT_CY, 0.14), (0.04, LEFT_D, 0.22), mat=mat_plinth, parent=root)
# Gable partition above X_DIV
div_gable_verts = [
    (X_DIV - WALL_T, Y_FRONT, H_EAVE),
    (X_DIV - WALL_T, Y_REAR, H_EAVE),
    (X_DIV - WALL_T, 0.0, H_APEX),
    (X_DIV, Y_FRONT, H_EAVE),
    (X_DIV, Y_REAR, H_EAVE),
    (X_DIV, 0.0, H_APEX),
]
create_prism("WH3_InnerDivGable", div_gable_verts, west_gable_faces, mat=mat_wall_yellow, parent=root)

# Details on the interior dividing wall (X = X_DIV) visible through the open entrance & screen:
# 2a. 4-bay white-framed window at Y = -3.45m ('3 Inside Front View.jpg')
iw_y, iw_w, iw_h, iw_z = -3.45, 1.55, 1.20, 1.62
create_box("WH3_InnerWinGlass", (X_DIV + 0.01, iw_y, iw_z), (0.04, iw_w, iw_h), mat=mat_glass_louver, parent=root)
for my in [-iw_w/2, -iw_w/6, iw_w/6, iw_w/2]:
    create_box(f"WH3_InnerWinMul_{my:.2f}", (X_DIV + 0.025, iw_y + my, iw_z), (0.04, 0.035, iw_h + 0.04), mat=mat_white_frame, parent=root)
for row in range(4):
    rz = iw_z - iw_h/2 + (row + 0.5) * (iw_h / 4.0)
    create_box(f"WH3_InnerWinBar_{row}", (X_DIV + 0.025, iw_y, rz), (0.03, iw_w, 0.025), mat=mat_white_frame, parent=root)

# 2b. Two brown wooden office/packing doors at Y = -1.15m and Y = +0.75m
for dy in [-1.15, 0.75]:
    create_box(f"WH3_InnerDoor_{dy}", (X_DIV + 0.015, dy, 1.05), (0.05, 0.86, 2.10), mat=mat_door_wood, parent=root)
    create_box(f"WH3_InnerDoorFrameTop_{dy}", (X_DIV + 0.025, dy, 2.12), (0.06, 0.94, 0.05), mat=mat_door_wood, parent=root)

# 2c. Wall Clock, "SEED PRODUCTION" / "PACKING AREA" plaques & schedule whiteboard between the two doors (Y = -0.20m)
create_cyl("WH3_WallClock", (X_DIV + 0.02, -0.20, 2.38), 0.13, 0.04, rot=(0, math.pi/2, 0), vertices=16, mat=mat_sign_red, parent=root)
create_cyl("WH3_WallClockFace", (X_DIV + 0.035, -0.20, 2.38), 0.10, 0.02, rot=(0, math.pi/2, 0), vertices=16, mat=mat_sign_white, parent=root)
# "PACKING AREA" yellow/red sign plaque
create_box("WH3_PackingSign", (X_DIV + 0.02, -0.20, 1.82), (0.02, 0.42, 0.16), mat=mat_sign_yellow, parent=root)
create_box("WH3_PackingSignText", (X_DIV + 0.028, -0.20, 1.82), (0.01, 0.36, 0.07), mat=mat_sign_red, parent=root)
# Schedule whiteboard below
create_box("WH3_ScheduleBoard", (X_DIV + 0.02, -0.20, 1.45), (0.02, 0.46, 0.36), mat=mat_sign_white, parent=root)

# 3. Screened-In Veranda / Seed Staging Hall (X = -0.80m to +7.06m)
# Front and right corner concrete columns ('3 Front View Full.jpg' & '3 Right Side of the building connecting to 4.jpg')
col_h = H_EAVE
# Front-right corner column
create_box("WH3_Col_FR", (X_RIGHT - 0.16, Y_FRONT + 0.16, col_h / 2.0), (0.32, 0.32, col_h), mat=mat_wall_cream, parent=root)
# Right wall intermediate columns at Y = -1.72m and Y = +1.72m
create_box("WH3_Col_RM1", (X_RIGHT - 0.16, -1.72, col_h / 2.0), (0.32, 0.32, col_h), mat=mat_wall_cream, parent=root)
create_box("WH3_Col_RM2", (X_RIGHT - 0.16, 1.72, col_h / 2.0), (0.32, 0.32, col_h), mat=mat_wall_cream, parent=root)
create_box("WH3_Col_RR", (X_RIGHT - 0.16, Y_REAR - 0.16, col_h / 2.0), (0.32, 0.32, col_h), mat=mat_wall_cream, parent=root)
# Continuous upper header lintel beam along Front and Right veranda eaves
create_box("WH3_FrontHeaderBeam", ((X_DIV + X_RIGHT) / 2.0, Y_FRONT + 0.12, H_EAVE - 0.18), (X_RIGHT - X_DIV, 0.24, 0.36), mat=mat_wall_cream, parent=root)
create_box("WH3_RightHeaderBeam", (X_RIGHT - 0.12, 0.0, H_EAVE - 0.18), (0.24, D, 0.36), mat=mat_wall_cream, parent=root)

# 3a. Front Screen Facade (Y = Y_FRONT + 0.04, from X_DIV = -0.80m to X_RIGHT - 0.32 = +6.74m)
# Entrance doorway bay at X = -0.80m to +1.00m (width 1.80m, aligned with entrance_3!)
DOOR_X0 = X_DIV
DOOR_X1 = 1.00
DOOR_H = 2.15
SCREEN_TOP = H_EAVE - 0.36  # 2.49 m

# Transom mesh above entrance doorway
create_box("WH3_DoorTransomMesh", ((DOOR_X0 + DOOR_X1) / 2.0, Y_FRONT + 0.04, (DOOR_H + SCREEN_TOP) / 2.0), (DOOR_X1 - DOOR_X0, 0.02, SCREEN_TOP - DOOR_H), mat=mat_screen_mesh, parent=root)
create_box("WH3_DoorHeaderBar", ((DOOR_X0 + DOOR_X1) / 2.0, Y_FRONT + 0.04, DOOR_H), (DOOR_X1 - DOOR_X0, 0.04, 0.04), mat=mat_alu_frame, parent=root)

# Open Aluminum Screen Door Leaf swung 90 degrees inward against X_DIV wall ('3 Inside Front View.jpg')
open_door_len = 0.95
open_door_cy = Y_FRONT + 0.06 + open_door_len / 2.0
create_box("WH3_OpenDoorMesh", (X_DIV + 0.06, open_door_cy, DOOR_H / 2.0), (0.02, open_door_len, DOOR_H - 0.06), mat=mat_screen_mesh, parent=root)
create_box("WH3_OpenDoorFrameT", (X_DIV + 0.06, open_door_cy, DOOR_H - 0.02), (0.04, open_door_len, 0.04), mat=mat_alu_frame, parent=root)
create_box("WH3_OpenDoorFrameB", (X_DIV + 0.06, open_door_cy, 0.03), (0.04, open_door_len, 0.05), mat=mat_alu_frame, parent=root)
create_box("WH3_OpenDoorMidRail", (X_DIV + 0.06, open_door_cy, 1.05), (0.04, open_door_len, 0.04), mat=mat_alu_frame, parent=root)
create_box("WH3_OpenDoorEdge", (X_DIV + 0.06, Y_FRONT + 0.06 + open_door_len, DOOR_H / 2.0), (0.04, 0.04, DOOR_H), mat=mat_alu_frame, parent=root)

# 4 Fixed Screen Bays from X = 1.00m to X = 6.74m ('3 Front View Full.jpg')
SCREEN_X0 = DOOR_X1
SCREEN_X1 = X_RIGHT - 0.32
SCREEN_W = SCREEN_X1 - SCREEN_X0
create_box("WH3_FrontScreenPanel", ((SCREEN_X0 + SCREEN_X1) / 2.0, Y_FRONT + 0.04, SCREEN_TOP / 2.0 + 0.04), (SCREEN_W, 0.02, SCREEN_TOP - 0.08), mat=mat_screen_mesh, parent=root)

# Vertical aluminum mullions for the 4 bays + top/bottom/mid rails
num_front_bays = 4
for b_i in range(num_front_bays + 1):
    bx = SCREEN_X0 + b_i * (SCREEN_W / num_front_bays)
    create_box(f"WH3_FrontScreenVert_{b_i}", (bx, Y_FRONT + 0.04, SCREEN_TOP / 2.0 + 0.04), (0.04, 0.04, SCREEN_TOP - 0.06), mat=mat_alu_frame, parent=root)
for rz in [0.06, 1.15, SCREEN_TOP]:
    create_box(f"WH3_FrontScreenHoriz_{rz:.2f}", ((SCREEN_X0 + SCREEN_X1) / 2.0, Y_FRONT + 0.04, rz), (SCREEN_W, 0.04, 0.04), mat=mat_alu_frame, parent=root)

# "NO MOTORCYCLE" sign on the first screen bay right of entrance (X = 1.24m, Z = 1.28m)
create_box("WH3_NoMotoPlaque", (1.24, Y_FRONT + 0.015, 1.28), (0.34, 0.015, 0.26), mat=mat_sign_white, parent=root)
create_cyl("WH3_NoMotoRing", (1.24, Y_FRONT + 0.005, 1.27), 0.085, 0.01, rot=(math.pi/2, 0, 0), vertices=16, mat=mat_sign_red, parent=root)
create_cyl("WH3_NoMotoInner", (1.24, Y_FRONT + 0.002, 1.27), 0.065, 0.01, rot=(math.pi/2, 0, 0), vertices=16, mat=mat_sign_white, parent=root)

# Hanging blue raincoat on the rightmost front screen bay (X = 5.95m)
create_box("WH3_BlueRaincoat", (5.95, Y_FRONT + 0.10, 1.02), (0.42, 0.12, 0.82), rot=(0, 0.08, 0), mat=mat_jacket_blue, parent=root)

# 3b. Right (East) Screened Wall connecting to Warehouse 4 ('3 Right Side of the building connecting to 4.jpg')
for bay_y0, bay_y1 in [(Y_FRONT + 0.32, -1.88), (-1.56, 1.56), (1.88, Y_REAR - 0.32)]:
    by_c = (bay_y0 + bay_y1) / 2.0
    by_len = bay_y1 - bay_y0
    create_box(f"WH3_RightScreen_{by_c:.2f}", (X_RIGHT - 0.08, by_c, SCREEN_TOP / 2.0 + 0.04), (0.02, by_len, SCREEN_TOP - 0.08), mat=mat_screen_mesh, parent=root)
    # Center vertical mullion and mid-rail in each bay
    create_box(f"WH3_RightMulV_{by_c:.2f}", (X_RIGHT - 0.08, by_c, SCREEN_TOP / 2.0 + 0.04), (0.04, 0.04, SCREEN_TOP - 0.08), mat=mat_alu_frame, parent=root)
    create_box(f"WH3_RightMulH_{by_c:.2f}", (X_RIGHT - 0.08, by_c, 1.15), (0.04, by_len, 0.04), mat=mat_alu_frame, parent=root)
    create_box(f"WH3_RightPlinth_{by_c:.2f}", (X_RIGHT - 0.08, by_c, 0.12), (0.14, by_len, 0.20), mat=mat_wall_cream, parent=root)

# East Gable Triangle above Right Header Beam (dark framed mesh matching '3 Right Side of the building connecting to 4.jpg')
east_gable_verts = [
    (X_RIGHT - 0.14, Y_FRONT, H_EAVE),
    (X_RIGHT - 0.14, Y_REAR, H_EAVE),
    (X_RIGHT - 0.14, 0.0, H_APEX),
    (X_RIGHT - 0.04, Y_FRONT, H_EAVE),
    (X_RIGHT - 0.14, Y_REAR, H_EAVE),
    (X_RIGHT - 0.04, 0.0, H_APEX),
]
create_prism("WH3_EastGableDark", east_gable_verts, west_gable_faces, mat=mat_screen_dark, parent=root)

# First-Aid White Box with Red Cross on middle right column ('3 Inside Front Vieww.jpg')
create_box("WH3_FirstAidBox", (X_RIGHT - 0.34, -1.72, 1.55), (0.08, 0.24, 0.28), mat=mat_sign_white, parent=root)
create_box("WH3_FirstAidCrossV", (X_RIGHT - 0.385, -1.72, 1.55), (0.01, 0.03, 0.10), mat=mat_sign_red, parent=root)
create_box("WH3_FirstAidCrossH", (X_RIGHT - 0.385, -1.72, 1.55), (0.01, 0.10, 0.03), mat=mat_sign_red, parent=root)

# 3c. Interior Screen Partition Wall at Y = Y_PART (1.80m) & Rear Seed Storage Area ('3 Inside Front Vieww.jpg')
PART_W = (X_RIGHT - 0.32) - X_DIV
PART_CX = (X_DIV + X_RIGHT - 0.32) / 2.0
create_box("WH3_InnerPartMesh", (PART_CX, Y_PART, H_EAVE / 2.0), (PART_W, 0.02, H_EAVE - 0.10), mat=mat_screen_mesh, parent=root)
for px_i in range(6):
    px = X_DIV + px_i * (PART_W / 5.0)
    create_box(f"WH3_InnerPartVert_{px_i}", (px, Y_PART, H_EAVE / 2.0), (0.04, 0.04, H_EAVE - 0.10), mat=mat_white_frame, parent=root)
for pz in [0.95, 2.05, H_EAVE - 0.08]:
    create_box(f"WH3_InnerPartHoriz_{pz:.2f}", (PART_CX, Y_PART, pz), (PART_W, 0.04, 0.04), mat=mat_white_frame, parent=root)

# 4. Authentic Interior Props Visible Through the Screen ('3 Front View Full.jpg', '3 Inside Front Vieww.jpg')
# 4a. Three white monobloc chairs behind the front screen facing inward
for cx in [1.95, 3.15, 4.45]:
    cy = Y_FRONT + 0.65
    create_box(f"WH3_ChairSeat_{cx}", (cx, cy, 0.44), (0.46, 0.46, 0.04), mat=mat_chair_white, parent=root)
    create_box(f"WH3_ChairBack_{cx}", (cx, cy - 0.21, 0.68), (0.46, 0.04, 0.46), mat=mat_chair_white, parent=root)
    for lx, ly in [(-0.20, -0.20), (0.20, -0.20), (-0.20, 0.20), (0.20, 0.20)]:
        create_box(f"WH3_ChairLeg_{cx}_{lx}_{ly}", (cx + lx, cy + ly, 0.22), (0.04, 0.04, 0.44), mat=mat_chair_white, parent=root)

# 4b. Stacked White Seed Sacks on Pallets against the interior partition wall (X = 2.40m to 5.40m, Y = 1.25m)
create_box("WH3_SeedPallet", (3.90, 1.25, 0.08), (3.10, 0.95, 0.12), mat=mat_pallet_dark, parent=root)
for s_i in range(6):
    sx = 2.55 + s_i * 0.52
    for s_row in range(3):
        sz = 0.24 + s_row * 0.24
        create_box(f"WH3_SeedSack_{s_i}_{s_row}", (sx, 1.25, sz), (0.46, 0.72, 0.23), mat=mat_sack_white, parent=root)

# 4c. Industrial Black Tripod Floor Fan at X = 1.45m, Y = 1.20m
create_cyl("WH3_FanCage", (1.45, 1.15, 1.15), 0.28, 0.10, rot=(math.pi/2, 0, 0), vertices=14, mat=mat_fan_black, parent=root)
create_cyl("WH3_FanPole", (1.45, 1.15, 0.60), 0.025, 1.05, vertices=8, mat=mat_alu_frame, parent=root)

# 4d. Wooden bench & table along the right wall ('3 Inside Front Vieww.jpg')
create_box("WH3_RightTable", (X_RIGHT - 0.75, -2.50, 0.74), (0.75, 1.40, 0.05), mat=mat_wood_bench, parent=root)
for tl_y in [-3.10, -1.90]:
    create_box(f"WH3_RightTableLeg_{tl_y}", (X_RIGHT - 0.75, tl_y, 0.37), (0.65, 0.05, 0.74), mat=mat_GutterGreen if False else mat_gutter_green, parent=root)
for bc_y in [-2.85, -2.15]:
    create_box(f"WH3_BlackChair_{bc_y}", (X_RIGHT - 1.35, bc_y, 0.44), (0.44, 0.44, 0.04), mat=mat_chair_black, parent=root)
    create_box(f"WH3_BlackChairBack_{bc_y}", (X_RIGHT - 1.55, bc_y, 0.68), (0.04, 0.44, 0.44), mat=mat_chair_black, parent=root)

# 5. Symmetrical East-West Gable Roof ('5c9b9b80.png', '3 Front View Full.jpg', '3 Right Side of the building connecting to 4.jpg')
# Overhangs: 0.38m on West & East rakes, 0.42m on South & North eaves
ROOF_W = W + 0.76
HALF_D = D / 2.0 + 0.42
RISE = H_APEX - H_EAVE
PITCH = math.atan2(RISE, D / 2.0)
SLOPE_LEN = math.hypot(HALF_D, HALF_D * math.tan(PITCH))
SLOPE_MID_Y = HALF_D / 2.0
SLOPE_MID_Z = H_APEX - (SLOPE_MID_Y * math.tan(PITCH))

num_sheets = 12
sheet_w = ROOF_W / num_sheets
for i in range(num_sheets):
    sx = -ROOF_W / 2.0 + (i + 0.5) * sheet_w
    # South (Front) Slope: Weathered Moss-Green Corrugated Metal
    s_mat = mat_roof_green1 if (i % 2 == 0) else mat_roof_green2
    create_box(f"WH3_RoofSouth_{i}", (sx, -SLOPE_MID_Y, SLOPE_MID_Z + 0.03), (sheet_w * 0.992, SLOPE_LEN, 0.04), rot=(PITCH, 0, 0), mat=s_mat, parent=root)
    # North (Rear) Slope: Rusted Reddish-Brown Corrugated Metal (matching drone photo '5c9b9b80.png')
    n_mat = mat_roof_rust1 if (i % 2 == 0) else mat_roof_rust2
    create_box(f"WH3_RoofNorth_{i}", (sx, SLOPE_MID_Y, SLOPE_MID_Z + 0.03), (sheet_w * 0.992, SLOPE_LEN, 0.04), rot=(-PITCH, 0, 0), mat=n_mat, parent=root)

# Central Teal-Green Ridge Cap running East-West along Y = 0.0
create_box("WH3_RidgeCap", (0.0, 0.0, H_APEX + 0.05), (ROOF_W + 0.04, 0.34, 0.05), mat=mat_ridge_teal, parent=root)

# Maroon Fascia Boards & Forest-Green Gutters along South Front Eave and East/West Gable Rakes
EAVE_Y_FRONT = -(D / 2.0 + 0.42)
EAVE_Z = H_APEX - ((D / 2.0 + 0.42) * math.tan(PITCH))
create_box("WH3_FrontFasciaMaroon", (0.0, EAVE_Y_FRONT + 0.03, EAVE_Z - 0.02), (ROOF_W, 0.04, 0.15), mat=mat_fascia_maroon, parent=root)
create_box("WH3_FrontGutterGreen", (0.0, EAVE_Y_FRONT - 0.02, EAVE_Z + 0.04), (ROOF_W + 0.04, 0.08, 0.12), mat=mat_gutter_green, parent=root)

# East and West Gable Rake Fascias (Maroon lower trim + Green upper flashing matching '3 Right Side of the building connecting to 4.jpg')
for side_x in [-ROOF_W / 2.0, ROOF_W / 2.0]:
    create_box(f"WH3_RakeMaroon_S_{side_x:.2f}", (side_x, -SLOPE_MID_Y, SLOPE_MID_Z - 0.02), (0.05, SLOPE_LEN, 0.14), rot=(PITCH, 0, 0), mat=mat_fascia_maroon, parent=root)
    create_box(f"WH3_RakeGreen_S_{side_x:.2f}", (side_x, -SLOPE_MID_Y, SLOPE_MID_Z + 0.05), (0.07, SLOPE_LEN + 0.04, 0.09), rot=(PITCH, 0, 0), mat=mat_gutter_green, parent=root)
    create_box(f"WH3_RakeMaroon_N_{side_x:.2f}", (side_x, SLOPE_MID_Y, SLOPE_MID_Z - 0.02), (0.05, SLOPE_LEN, 0.14), rot=(-PITCH, 0, 0), mat=mat_fascia_maroon, parent=root)
    create_box(f"WH3_RakeGreen_N_{side_x:.2f}", (side_x, SLOPE_MID_Y, SLOPE_MID_Z + 0.05), (0.07, SLOPE_LEN + 0.04, 0.09), rot=(-PITCH, 0, 0), mat=mat_gutter_green, parent=root)

# White PVC Downspouts at X = X_DIV - 0.15m (center-left) and X = X_RIGHT - 0.16m (front-right corner)
for dx_pipe in [X_DIV - 0.18, X_RIGHT - 0.16]:
    create_cyl(f"WH3_DownspoutVert_{dx_pipe:.2f}", (dx_pipe, Y_FRONT - 0.06, H_EAVE / 2.0), 0.04, H_EAVE - 0.10, vertices=10, mat=mat_pvc_white, parent=root)
    create_cyl(f"WH3_DownspoutElbow_{dx_pipe:.2f}", (dx_pipe, (Y_FRONT + EAVE_Y_FRONT) / 2.0, EAVE_Z - 0.05), 0.04, 0.45, rot=(math.pi/3, 0, 0), vertices=10, mat=mat_pvc_white, parent=root)

# ==============================================================================
# 6. PERIMETER FENCE & SWUNG-OPEN GATE ('3 Front Perimeter Fence.jpg',
#    '3 Right Side of the building connecting to 4.jpg', and user red outline)
# ==============================================================================
mat_fence_post = make_mat("WH3_FencePostConc", (0.58, 0.57, 0.54, 1.0), roughness=0.85)
mat_fence_curb = make_mat("WH3_FenceCurb", (0.68, 0.72, 0.68, 1.0), roughness=0.82)
mat_fence_pipe = make_mat("WH3_FenceGalvPipe", (0.72, 0.74, 0.76, 1.0), roughness=0.40, metallic=0.60)
mat_gate_rust = make_mat("WH3_GateRustFrame", (0.54, 0.34, 0.26, 1.0), roughness=0.72, metallic=0.35)
mat_chainlink = make_mat("WH3_ChainlinkMesh", (0.45, 0.47, 0.48, 1.0), roughness=0.60, metallic=0.40, alpha=0.38)

FENCE_H = 1.68
CURB_H = 0.32
Y_FENCE_FRONT = -9.35   # Connects across to Warehouse 2's NE corner (Y = -9.41m)
X_FENCE_LEFT = -1.92    # Aligned with Warehouse 2's NE corner (X = -1.92m)
X_FENCE_RIGHT = 7.35    # Just outside Warehouse 3's East wall (X = +7.06m)
X_GATE_POST = 2.35      # Concrete gate post at edge of driveway / palay drying zone
Y_FENCE_R_START = -0.50 # Starts alongside East wall of Warehouse 3

# 6a. Concrete Posts along the Perimeter Fence
fence_posts = [
    (X_FENCE_LEFT, Y_FRONT - 0.12),
    (X_FENCE_LEFT, (Y_FRONT + Y_FENCE_FRONT) / 2.0),
    (X_FENCE_LEFT, Y_FENCE_FRONT),
    (X_FENCE_RIGHT, Y_FENCE_R_START),
    (X_FENCE_RIGHT, -2.85),
    (X_FENCE_RIGHT, Y_FRONT),
    (X_FENCE_RIGHT, (Y_FRONT + Y_FENCE_FRONT) / 2.0),
    (X_FENCE_RIGHT, Y_FENCE_FRONT),
    (X_GATE_POST, Y_FENCE_FRONT),
]
for idx, (px, py) in enumerate(fence_posts):
    create_box(f"WH3_FencePost_{idx}", (px, py, FENCE_H / 2.0), (0.20, 0.20, FENCE_H), mat=mat_fence_post, parent=root)

# Helper to build a fence span (low concrete curb + top/mid galvanized pipe rails + chain-link mesh)
def build_fence_span(tag, p1, p2):
    x1, y1 = p1
    x2, y2 = p2
    cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    length = math.hypot(x2 - x1, y2 - y1)
    ang = math.atan2(y2 - y1, x2 - x1)
    # Low concrete curb wall
    create_box(f"WH3_FenceCurb_{tag}", (cx, cy, CURB_H / 2.0), (length, 0.12, CURB_H), rot=(0, 0, ang), mat=mat_fence_curb, parent=root)
    # Top and bottom/mid horizontal galvanized steel pipes
    for pz in [CURB_H + 0.06, 1.02, FENCE_H - 0.06]:
        create_box(f"WH3_FenceRail_{tag}_{pz:.2f}", (cx, cy, pz), (length, 0.035, 0.035), rot=(0, 0, ang), mat=mat_fence_pipe, parent=root)
    # Semi-transparent chain-link mesh panel
    mesh_h = FENCE_H - CURB_H - 0.08
    mesh_z = CURB_H + mesh_h / 2.0
    create_box(f"WH3_FenceMesh_{tag}", (cx, cy, mesh_z), (length - 0.16, 0.015, mesh_h), rot=(0, 0, ang), mat=mat_chainlink, parent=root)

# Left Fence Line (from Warehouse 3 front wall South to Warehouse 2 NE corner)
build_fence_span("LeftSpan", (X_FENCE_LEFT, Y_FRONT), (X_FENCE_LEFT, Y_FENCE_FRONT))
# Right Fence Line (from alongside Warehouse 3 East wall South into courtyard)
build_fence_span("RightSpan1", (X_FENCE_RIGHT, Y_FENCE_R_START), (X_FENCE_RIGHT, Y_FRONT))
build_fence_span("RightSpan2", (X_FENCE_RIGHT, Y_FRONT), (X_FENCE_RIGHT, Y_FENCE_FRONT))
# Front Fence Line (from Front-Right corner post West to Gate Post)
build_fence_span("FrontSpan", (X_FENCE_RIGHT, Y_FENCE_FRONT), (X_GATE_POST, Y_FENCE_FRONT))

# 6b. Swung-Open Tubular Steel Gate Leaf extending South from (X_GATE_POST, Y_FENCE_FRONT) ('3 Front Perimeter Fence.jpg')
GATE_LEN = 2.15
GATE_H = 1.52
GATE_Z0 = 0.12
GATE_CY = Y_FENCE_FRONT - GATE_LEN / 2.0
# Outer rusty tubular frame (top, bottom, mid, hinge vertical, latch vertical, center vertical)
for gz in [GATE_Z0, GATE_Z0 + GATE_H / 2.0, GATE_Z0 + GATE_H]:
    create_box(f"WH3_GateHoriz_{gz:.2f}", (X_GATE_POST - 0.06, GATE_CY, gz), (0.04, GATE_LEN, 0.04), mat=mat_gate_rust, parent=root)
for gy in [Y_FENCE_FRONT - 0.04, GATE_CY, Y_FENCE_FRONT - GATE_LEN]:
    create_box(f"WH3_GateVert_{gy:.2f}", (X_GATE_POST - 0.06, gy, GATE_Z0 + GATE_H / 2.0), (0.04, 0.04, GATE_H), mat=mat_gate_rust, parent=root)
create_box("WH3_GateMesh", (X_GATE_POST - 0.06, GATE_CY, GATE_Z0 + GATE_H / 2.0), (0.015, GATE_LEN - 0.08, GATE_H - 0.08), mat=mat_chainlink, parent=root)

# Tall Galvanized Utility Pole right next to the Concrete Gate Post ('3 Front Perimeter Fence.jpg')
create_cyl("WH3_UtilityPole", (X_GATE_POST - 0.22, Y_FENCE_FRONT - 0.12, 2.35), 0.055, 4.70, vertices=12, mat=mat_fence_pipe, parent=root)

# Join all WH3 mesh objects into a single optimized multi-material mesh under root
bpy.ops.object.select_all(action='DESELECT')
mesh_objs = [o for o in bpy.data.objects if o.name.startswith("WH3_") and o.type == 'MESH']
if mesh_objs:
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = "WH3_CombinedMesh"

# Export to models/warehouse_3.glb
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.name.startswith("WH3_"):
        obj.select_set(True)

export_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_3.glb"
bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True
)
print(f"Successfully exported {export_path}")
