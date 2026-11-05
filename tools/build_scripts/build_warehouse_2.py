import bpy
import bmesh
import math

# 1. Clear existing scene meshes & materials
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.meshes):
    bpy.data.meshes.remove(block)
for block in list(bpy.data.materials):
    bpy.data.materials.remove(block)

# 2. Material Helper
def create_mat(name, hex_color, roughness=0.6, metallic=0.0):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        h = hex_color.lstrip('#')
        rgb = tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4))
        rgb_lin = [c ** 2.2 for c in rgb] + [1.0]
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = rgb_lin
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
    return mat

# Ground-Truth Materials (2 Left Part Front View.jpg, 2 Left Side View.jpg, 2 Right Part Front View.jpg, Drone Aerial)
mat_plinth_grey    = create_mat("WH2_PlinthGrey",    "#6E706B", roughness=0.88)
mat_cmu_wall       = create_mat("WH2_CMUWall",       "#989A94", roughness=0.85)
mat_knee_wall      = create_mat("WH2_KneeWall",      "#C8C6BE", roughness=0.80)
mat_knee_weathered = create_mat("WH2_KneeWeathered", "#8D8F88", roughness=0.88)
mat_screen_mesh    = create_mat("WH2_ScreenMesh",    "#1A1C1A", roughness=0.75)
mat_wood_frame     = create_mat("WH2_WoodFrame",     "#B5A892", roughness=0.68)
mat_wood_rafter    = create_mat("WH2_WoodRafter",    "#6E5239", roughness=0.72)
mat_fascia_grey    = create_mat("WH2_FasciaGrey",    "#C2C0B8", roughness=0.65)

# Roof materials matching drone top-down photo (South/Left = Silver-White, North/Right = Deep Rust-Brown)
mat_roof_silver1   = create_mat("WH2_RoofSilver1",   "#D0D3D0", roughness=0.45, metallic=0.50)
mat_roof_silver2   = create_mat("WH2_RoofSilver2",   "#B4B8B4", roughness=0.50, metallic=0.45)
mat_roof_rust1     = create_mat("WH2_RoofRust1",     "#5E3428", roughness=0.70, metallic=0.20)
mat_roof_rust2     = create_mat("WH2_RoofRust2",     "#703F31", roughness=0.68, metallic=0.22)

# Steel pipes & interior dark
mat_steel_pipe     = create_mat("WH2_SteelPipe",     "#B8BEC2", roughness=0.35, metallic=0.80)
mat_interior_dark  = create_mat("WH2_InteriorDark",  "#121312", roughness=0.95)
mat_sack_white     = create_mat("WH2_SackWhite",     "#EAEAE4", roughness=0.60)
mat_pallet_wood    = create_mat("WH2_PalletWood",    "#7C5D3F", roughness=0.75)

# Combine Harvester & Tractor materials (strictly inside Left open shed bays)
mat_harv_white     = create_mat("WH2_HarvWhite",     "#E8E6DC", roughness=0.40)
mat_harv_red       = create_mat("WH2_HarvRed",       "#B82924", roughness=0.45)
mat_harv_orange    = create_mat("WH2_HarvOrange",    "#D94A2B", roughness=0.40)
mat_tractor_blue   = create_mat("WH2_TractorBlue",   "#0E4DA4", roughness=0.35, metallic=0.25)
mat_tire_black     = create_mat("WH2_TireBlack",     "#1C1D1C", roughness=0.85)
mat_rim_cream      = create_mat("WH2_RimCream",      "#DDD8C8", roughness=0.45, metallic=0.30)

# Signboard materials
mat_sign_white     = create_mat("WH2_SignWhite",     "#F8F8F6", roughness=0.30)
mat_sign_text      = create_mat("WH2_SignText",      "#1E3522", roughness=0.35)

# Primitive Helpers
def create_box(name, loc, size, rot=(0, 0, 0), mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rot != (0, 0, 0):
        obj.rotation_euler = rot
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cyl(name, loc, radius, depth, rot=(0, 0, 0), vertices=12, mat=None, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

# Root Object
root = bpy.data.objects.new("WH2_Root", None)
bpy.context.collection.objects.link(root)

# Exact GIS Footprint Dimensions:
# Total Width along X: 22.44 m (X_LEFT = -11.22 m South, X_RIGHT = +11.22 m North)
# Total Depth along Y: 5.80 m (Y_FRONT = -2.90 m East road-facing, Y_REAR = +2.90 m West rear)
W = 22.44
D = 5.80
X_LEFT  = -W / 2.0   # -11.22 m (South end)
X_RIGHT =  W / 2.0   # +11.22 m (North end)
X_SPLIT = -1.20      # Division between Left Open Machinery Shed (-11.22 to -1.20) & Right Enclosed Fertilizer Room (-1.20 to +11.22)
Y_FRONT = -D / 2.0   # -2.90 m (East front facing road)
Y_REAR  =  D / 2.0   # +2.90 m (West rear wall)

# ==============================================================================
# PART 1: COMMON BASE & REAR / SIDE PERIMETER CMU WALLS
# ==============================================================================
H_BASE = 0.12
create_box("WH2_BaseSlab", (0.0, 0.0, H_BASE / 2.0), (W, D, H_BASE), mat=mat_plinth_grey, parent=root)

# Continuous Rear Wall (West side, Y = Y_REAR - 0.10)
H_REAR = 2.52
create_box("WH2_RearWall", (0.0, Y_REAR - 0.08, H_BASE + (H_REAR - H_BASE) / 2.0), (W, 0.16, H_REAR - H_BASE), mat=mat_cmu_wall, parent=root)

# South Side CMU Wall (Left end, X = X_LEFT + 0.08)
create_box("WH2_SouthSideWall", (X_LEFT + 0.08, 0.20, H_BASE + 2.25 / 2.0), (0.16, D - 0.40, 2.25), mat=mat_cmu_wall, parent=root)
# Concrete pier on South-West corner
create_box("WH2_SouthPier", (X_LEFT + 0.14, -0.80, H_BASE + 2.40 / 2.0), (0.28, 0.28, 2.40), mat=mat_knee_wall, parent=root)

# Divider CMU Wall at X_SPLIT = -1.20 m
create_box("WH2_MidDividerWall", (X_SPLIT, 0.0, H_BASE + (H_REAR - H_BASE) / 2.0), (0.16, D, H_REAR - H_BASE), mat=mat_cmu_wall, parent=root)

# ==============================================================================
# PART 2: LEFT / SOUTH SECTION (X = -11.22 to -1.20) — OPEN MACHINERY SHED
# ==============================================================================
SHED_W = X_SPLIT - X_LEFT  # 10.02 m
SHED_CX = (X_LEFT + X_SPLIT) / 2.0  # -6.21 m
Z_SHED_FRONT = 2.92
Z_SHED_REAR  = 2.55
shed_pitch = math.atan2(Z_SHED_FRONT - Z_SHED_REAR, D + 0.40)

# 4 Galvanized Steel Pipe Columns along Front (Y = Y_FRONT + 0.08) and 3 along Middle (Y = 0.0)
pipe_xs = [X_LEFT + 0.15, X_LEFT + 3.45, X_LEFT + 6.75, X_SPLIT - 0.15]
mid_pipe_h = (Z_SHED_FRONT + Z_SHED_REAR) / 2.0 - 0.04
for idx, px in enumerate(pipe_xs):
    create_cyl(f"WH2_FrontPipe_{idx}", (px, Y_FRONT + 0.08, Z_SHED_FRONT / 2.0), 0.035, Z_SHED_FRONT, mat=mat_steel_pipe, parent=root)
    if idx < 3:
        create_cyl(f"WH2_MidPipe_{idx}", (px, 0.0, mid_pipe_h / 2.0), 0.032, mid_pipe_h, mat=mat_steel_pipe, parent=root)

# Horizontal Front & Mid Steel Pipe Header Beams
create_cyl("WH2_FrontHeaderPipe", (SHED_CX, Y_FRONT + 0.08, Z_SHED_FRONT - 0.06), 0.03, SHED_W, rot=(0, math.pi/2, 0), mat=mat_steel_pipe, parent=root)
create_cyl("WH2_MidHeaderPipe",   (SHED_CX, 0.0, (Z_SHED_FRONT + Z_SHED_REAR) / 2.0 - 0.06), 0.03, SHED_W, rot=(0, math.pi/2, 0), mat=mat_steel_pipe, parent=root)

# Timber Rafters sloping front-to-rear (7 rafters across the open shed)
shed_slope_len = math.hypot(D + 0.45, Z_SHED_FRONT - Z_SHED_REAR)
shed_mid_z = (Z_SHED_FRONT + Z_SHED_REAR) / 2.0
for r_idx in range(7):
    rx = X_LEFT + 0.20 + r_idx * (SHED_W - 0.40) / 6.0
    create_box(f"WH2_ShedRafter_{r_idx}", (rx, 0.0, shed_mid_z), (0.06, shed_slope_len, 0.09), rot=(-shed_pitch, 0, 0), mat=mat_wood_rafter, parent=root)

# Timber Purlins running along X
for p_idx in range(5):
    py = Y_FRONT - 0.15 + p_idx * (D + 0.30) / 4.0
    pz = Z_SHED_FRONT - (py - (Y_FRONT - 0.15)) / (D + 0.30) * (Z_SHED_FRONT - Z_SHED_REAR) + 0.04
    create_box(f"WH2_ShedPurlin_{p_idx}", (SHED_CX, py, pz), (SHED_W + 0.20, 0.07, 0.05), rot=(-shed_pitch, 0, 0), mat=mat_wood_rafter, parent=root)

# Left Half Roof Deck: Silver-White / Galvanized Corrugated Metal Sheets (matching drone top-down photo)
num_silver_sheets = 8
sheet_w = (SHED_W + 0.20) / num_silver_sheets
for s_idx in range(num_silver_sheets):
    sx = (X_LEFT - 0.15) + (s_idx + 0.5) * sheet_w
    smat = mat_roof_silver1 if (s_idx % 2 == 0) else mat_roof_silver2
    create_box(f"WH2_RoofSilver_{s_idx}", (sx, 0.0, shed_mid_z + 0.07), (sheet_w * 0.98, shed_slope_len, 0.025), rot=(-shed_pitch, 0, 0), mat=smat, parent=root)

# --- HOUSED EQUIPMENT IN BAY 1 (X = -9.1m): FMWorld Multi-Crop Combine Harvester ---
HX = -9.15
HY = -0.35
# Crawler tracks
create_box("WH2_HarvTrack_L", (HX - 0.72, HY + 0.15, 0.34), (0.32, 2.20, 0.44), mat=mat_tire_black, parent=root)
create_box("WH2_HarvTrack_R", (HX + 0.72, HY + 0.15, 0.34), (0.32, 2.20, 0.44), mat=mat_tire_black, parent=root)
# Main Harvester Body (Cream-White)
create_box("WH2_HarvBody", (HX, HY + 0.30, 1.15), (1.65, 2.40, 1.25), mat=mat_harv_white, parent=root)
# Red Accent Stripe on Harvester Body
create_box("WH2_HarvAccent", (HX, HY + 0.28, 1.05), (1.68, 2.42, 0.22), mat=mat_harv_red, parent=root)
# Front Cutter Header Table & Red Reel (strictly inside Y_FRONT = -2.90m)
create_box("WH2_HarvHeader", (HX, HY - 1.35, 0.52), (2.10, 0.95, 0.55), mat=mat_harv_red, parent=root)
create_cyl("WH2_HarvReel", (HX, HY - 1.55, 0.72), 0.26, 2.00, rot=(0, math.pi/2, 0), mat=mat_harv_red, parent=root)
create_box("WH2_HarvGuard", (HX, HY - 1.20, 1.05), (2.05, 0.05, 0.42), mat=mat_harv_white, parent=root)
# Operator Platform & Signature Orange-Red Tilted Canopy (seen in '2 Left Part Front View.jpg')
create_box("WH2_HarvSeat", (HX - 0.35, HY - 0.35, 1.85), (0.50, 0.50, 0.40), mat=mat_tire_black, parent=root)
create_box("WH2_HarvCanopyPost1", (HX - 0.65, HY - 0.10, 2.15), (0.05, 0.05, 0.85), mat=mat_tire_black, parent=root)
create_box("WH2_HarvCanopyPost2", (HX - 0.05, HY - 0.10, 2.15), (0.05, 0.05, 0.85), mat=mat_tire_black, parent=root)
create_box("WH2_HarvCanopy", (HX - 0.35, HY - 0.35, 2.52), (0.95, 1.15, 0.08), rot=(0.18, 0, 0), mat=mat_harv_orange, parent=root)

# --- HOUSED EQUIPMENT IN BAY 2 (X = -5.1m): Blue Ford Agricultural Tractor ---
TX = -5.10
TY = -0.10
# Rear large agricultural tires
create_cyl("WH2_TracRearTire_L", (TX - 0.78, TY + 0.55, 0.72), 0.60, 0.38, rot=(0, math.pi/2, 0), vertices=16, mat=mat_tire_black, parent=root)
create_cyl("WH2_TracRearRim_L",  (TX - 0.79, TY + 0.55, 0.72), 0.36, 0.40, rot=(0, math.pi/2, 0), vertices=12, mat=mat_rim_cream, parent=root)
create_cyl("WH2_TracRearTire_R", (TX + 0.78, TY + 0.55, 0.72), 0.60, 0.38, rot=(0, math.pi/2, 0), vertices=16, mat=mat_tire_black, parent=root)
create_cyl("WH2_TracRearRim_R",  (TX + 0.79, TY + 0.55, 0.72), 0.36, 0.40, rot=(0, math.pi/2, 0), vertices=12, mat=mat_rim_cream, parent=root)
# Front steerable tires
create_cyl("WH2_TracFrontTire_L", (TX - 0.68, TY - 1.15, 0.48), 0.36, 0.24, rot=(0, math.pi/2, 0), vertices=14, mat=mat_tire_black, parent=root)
create_cyl("WH2_TracFrontTire_R", (TX + 0.68, TY - 1.15, 0.48), 0.36, 0.24, rot=(0, math.pi/2, 0), vertices=14, mat=mat_tire_black, parent=root)
# Blue Tractor Engine Hood, Chassis & Rear Fenders
create_box("WH2_TracHood",    (TX, TY - 0.45, 1.05), (0.82, 1.85, 0.72), mat=mat_tractor_blue, parent=root)
create_box("WH2_TracFenderL", (TX - 0.68, TY + 0.55, 1.28), (0.36, 1.10, 0.18), mat=mat_tractor_blue, parent=root)
create_box("WH2_TracFenderR", (TX + 0.68, TY + 0.55, 1.28), (0.36, 1.10, 0.18), mat=mat_tractor_blue, parent=root)
create_box("WH2_TracSeat",    (TX, TY + 0.45, 1.38), (0.48, 0.48, 0.35), mat=mat_tire_black, parent=root)
# ROPS Frame & White Sun Canopy
create_box("WH2_TracROPS_L",  (TX - 0.52, TY + 0.65, 1.95), (0.06, 0.06, 1.25), mat=mat_tire_black, parent=root)
create_box("WH2_TracROPS_R",  (TX + 0.52, TY + 0.65, 1.95), (0.06, 0.06, 1.25), mat=mat_tire_black, parent=root)
create_box("WH2_TracCanopy",  (TX, TY + 0.35, 2.52), (1.35, 1.45, 0.08), mat=mat_harv_white, parent=root)

# ==============================================================================
# PART 3: RIGHT / NORTH SECTION (X = -1.20 to +11.22) — "ORGANIC FERTILIZER" ROOM
# ==============================================================================
ROOM_W = X_RIGHT - X_SPLIT  # 12.42 m
ROOM_CX = (X_SPLIT + X_RIGHT) / 2.0  # +5.01 m
DOOR_X = 4.85
DOOR_W = 1.18
H_KNEE = 1.18
H_EAVE_R = 2.48
H_REAR_R = 2.68

# North End Wall (X = X_RIGHT - 0.08)
create_box("WH2_NorthEndWall", (X_RIGHT - 0.08, 0.0, H_BASE + (H_EAVE_R - H_BASE) / 2.0), (0.16, D, H_EAVE_R - H_BASE), mat=mat_knee_wall, parent=root)

# Front Concrete Knee Wall (Left of Door: X_SPLIT to DOOR_X - DOOR_W/2)
kw_left_w = (DOOR_X - DOOR_W / 2.0) - X_SPLIT
kw_left_cx = X_SPLIT + kw_left_w / 2.0
create_box("WH2_KneeWall_L", (kw_left_cx, Y_FRONT + 0.08, H_BASE + (H_KNEE - H_BASE) / 2.0), (kw_left_w, 0.16, H_KNEE - H_BASE), mat=mat_knee_wall, parent=root)
# Weathered lower plinth band on knee wall
create_box("WH2_KneePlinth_L", (kw_left_cx, Y_FRONT + 0.07, H_BASE + 0.18), (kw_left_w, 0.17, 0.36), mat=mat_knee_weathered, parent=root)

# Front Concrete Knee Wall (Right of Door: DOOR_X + DOOR_W/2 to X_RIGHT)
kw_right_w = X_RIGHT - (DOOR_X + DOOR_W / 2.0)
kw_right_cx = (DOOR_X + DOOR_W / 2.0) + kw_right_w / 2.0
create_box("WH2_KneeWall_R", (kw_right_cx, Y_FRONT + 0.08, H_BASE + (H_KNEE - H_BASE) / 2.0), (kw_right_w, 0.16, H_KNEE - H_BASE), mat=mat_knee_wall, parent=root)
create_box("WH2_KneePlinth_R", (kw_right_cx, Y_FRONT + 0.07, H_BASE + 0.18), (kw_right_w, 0.17, 0.36), mat=mat_knee_weathered, parent=root)

# Upper Fine Wire-Mesh Screen Clerestory (Z = H_KNEE to H_EAVE_R)
screen_h = H_EAVE_R - H_KNEE  # 1.30 m
screen_cz = H_KNEE + screen_h / 2.0
create_box("WH2_ScreenPanel_L", (kw_left_cx, Y_FRONT + 0.08, screen_cz), (kw_left_w, 0.04, screen_h), mat=mat_screen_mesh, parent=root)
create_box("WH2_ScreenPanel_R", (kw_right_cx, Y_FRONT + 0.08, screen_cz), (kw_right_w, 0.04, screen_h), mat=mat_screen_mesh, parent=root)

# Timber Screen Framing Grid (5 bays on Left of Door, 5 bays on Right of Door, + Mid Horizontal Rail)
# Top & Bottom horizontal timber rails
create_box("WH2_RailBottom_L", (kw_left_cx, Y_FRONT + 0.05, H_KNEE + 0.025), (kw_left_w, 0.06, 0.05), mat=mat_wood_frame, parent=root)
create_box("WH2_RailMid_L",    (kw_left_cx, Y_FRONT + 0.05, screen_cz),      (kw_left_w, 0.06, 0.045), mat=mat_wood_frame, parent=root)
create_box("WH2_RailTop_L",    (kw_left_cx, Y_FRONT + 0.05, H_EAVE_R - 0.03), (kw_left_w, 0.06, 0.06), mat=mat_wood_frame, parent=root)

create_box("WH2_RailBottom_R", (kw_right_cx, Y_FRONT + 0.05, H_KNEE + 0.025), (kw_right_w, 0.06, 0.05), mat=mat_wood_frame, parent=root)
create_box("WH2_RailMid_R",    (kw_right_cx, Y_FRONT + 0.05, screen_cz),      (kw_right_w, 0.06, 0.045), mat=mat_wood_frame, parent=root)
create_box("WH2_RailTop_R",    (kw_right_cx, Y_FRONT + 0.05, H_EAVE_R - 0.03), (kw_right_w, 0.06, 0.06), mat=mat_wood_frame, parent=root)

# Vertical Timber Mullions (Left 5 bays = 6 posts)
for i in range(6):
    mx = X_SPLIT + 0.04 + i * (kw_left_w - 0.08) / 5.0
    create_box(f"WH2_MullionL_{i}", (mx, Y_FRONT + 0.05, screen_cz), (0.05, 0.06, screen_h), mat=mat_wood_frame, parent=root)

# Vertical Timber Mullions (Right 5 bays = 6 posts)
for i in range(6):
    mx = (DOOR_X + DOOR_W / 2.0) + 0.04 + i * (kw_right_w - 0.08) / 5.0
    create_box(f"WH2_MullionR_{i}", (mx, Y_FRONT + 0.05, screen_cz), (0.05, 0.06, screen_h), mat=mat_wood_frame, parent=root)

# Full-Height Open Doorway Frame & Transom Bar at DOOR_X = +4.85 m
create_box("WH2_DoorPost_L", (DOOR_X - DOOR_W / 2.0, Y_FRONT + 0.06, H_BASE + (H_EAVE_R - H_BASE) / 2.0), (0.08, 0.16, H_EAVE_R - H_BASE), mat=mat_wood_frame, parent=root)
create_box("WH2_DoorPost_R", (DOOR_X + DOOR_W / 2.0, Y_FRONT + 0.06, H_BASE + (H_EAVE_R - H_BASE) / 2.0), (0.08, 0.16, H_EAVE_R - H_BASE), mat=mat_wood_frame, parent=root)
create_box("WH2_DoorHeader", (DOOR_X, Y_FRONT + 0.06, H_EAVE_R - 0.22), (DOOR_W, 0.12, 0.07), mat=mat_wood_frame, parent=root)

# Dark Interior Backing & Stacked White Polypropylene Fertilizer Sacks inside Open Doorway (seen in '2 Right Part Front View.jpg')
create_box("WH2_InteriorBackdrop", (DOOR_X, Y_FRONT + 1.45, H_BASE + 1.15), (2.20, 0.08, 2.30), mat=mat_interior_dark, parent=root)
create_box("WH2_InteriorSideL",    (DOOR_X - 1.05, Y_FRONT + 0.75, H_BASE + 1.15), (0.08, 1.40, 2.30), mat=mat_interior_dark, parent=root)
create_box("WH2_InteriorSideR",    (DOOR_X + 1.05, Y_FRONT + 0.75, H_BASE + 1.15), (0.08, 1.40, 2.30), mat=mat_interior_dark, parent=root)

# Wooden Pallet & 2 Columns x 5 Tiers of White Fertilizer Sacks visible inside the doorway
create_box("WH2_FertilizerPallet", (DOOR_X - 0.05, Y_FRONT + 0.85, H_BASE + 0.06), (1.05, 0.80, 0.12), mat=mat_pallet_wood, parent=root)
for col in range(2):
    for tier in range(5):
        sx = DOOR_X - 0.30 + col * 0.50
        sz = H_BASE + 0.16 + tier * 0.15
        create_box(f"WH2_Sack_{col}_{tier}", (sx, Y_FRONT + 0.82, sz), (0.46, 0.68, 0.135), mat=mat_sack_white, parent=root)

# Official White Signboard "ORGANIC FERTILIZER" mounted on the screen rail just right of the doorway
SIGN_X = DOOR_X + DOOR_W / 2.0 + 0.34
SIGN_Z = screen_cz - 0.02
SIGN_W = 0.46
SIGN_H = 0.18
create_box("WH2_SignPlaque", (SIGN_X, Y_FRONT + 0.015, SIGN_Z), (SIGN_W, 0.015, SIGN_H), mat=mat_sign_white, parent=root)

# Real 3D Font Text "ORGANIC\nFERTILIZER"
font_curve = bpy.data.curves.new(type="FONT", name="WH2_SignFont")
font_curve.body = "ORGANIC\nFERTILIZER"
font_curve.size = 0.052
font_curve.space_line = 1.15
font_curve.extrude = 0.002
font_curve.resolution_u = 2
font_curve.align_x = 'CENTER'
font_curve.align_y = 'CENTER'
font_obj = bpy.data.objects.new("WH2_SignTextMesh", font_curve)
bpy.context.collection.objects.link(font_obj)
bpy.context.view_layer.objects.active = font_obj
font_obj.select_set(True)
bpy.ops.object.convert(target='MESH')
font_obj.rotation_euler = (math.pi / 2.0, 0, 0)
font_obj.location = (SIGN_X, Y_FRONT + 0.004, SIGN_Z + 0.012)
font_obj.data.materials.clear()
font_obj.data.materials.append(mat_sign_text)
font_obj.parent = root

# Right Section Roof Deck: Deep Rust-Brown Corrugated Iron Sheets (matching drone top-down photo)
room_pitch = math.atan2(H_REAR_R - H_EAVE_R, D + 0.50)
room_slope_len = math.hypot(D + 0.50, H_REAR_R - H_EAVE_R)
room_mid_z = (H_EAVE_R + H_REAR_R) / 2.0

num_rust_sheets = 10
rust_w = (ROOM_W + 0.15) / num_rust_sheets
for s_idx in range(num_rust_sheets):
    rx = X_SPLIT + (s_idx + 0.5) * rust_w
    rmat = mat_roof_rust1 if (s_idx % 2 == 0) else mat_roof_rust2
    create_box(f"WH2_RoofRust_{s_idx}", (rx, 0.0, room_mid_z + 0.05), (rust_w * 0.99, room_slope_len, 0.035), rot=(room_pitch, 0, 0), mat=rmat, parent=root)

# Continuous Weathered Light-Grey Timber Fascia Board along Front Eave of Right Section (seen in '2 Right Part Front View.jpg')
create_box("WH2_FrontFascia_R", (ROOM_CX, Y_FRONT - 0.22, H_EAVE_R + 0.03), (ROOM_W + 0.15, 0.04, 0.18), mat=mat_fascia_grey, parent=root)

# Join all WH2 mesh objects into a single optimized multi-material mesh under root
bpy.ops.object.select_all(action='DESELECT')
mesh_objs = [o for o in bpy.data.objects if o.name.startswith("WH2_") and o.type == 'MESH']
if mesh_objs:
    for o in mesh_objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objs[0]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = "WH2_CombinedMesh"

# Export all WH2 objects to models/warehouse_2.glb
bpy.ops.object.select_all(action='DESELECT')
count = 0
for obj in bpy.data.objects:
    if obj.name.startswith("WH2_"):
        obj.select_set(True)
        count += 1

print(f"Total WH2 objects to export: {count}")
export_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_2.glb"
bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True
)
print(f"Successfully exported {export_path}")
