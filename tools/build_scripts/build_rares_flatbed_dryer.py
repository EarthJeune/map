import bpy
import bmesh
import math
import os
from mathutils import Vector

# ==============================================================================
# DA-RARES FLATBED DRYER 3D ARCHITECTURAL MODEL GENERATOR (CALIBRATED V6)
# Station: Rizal Agricultural Research & Experiment Station (Tanay, Rizal)
# Building ID: rares_building_5 ("Flatbed Dryer")
#
# Ground Truth Reference Analysis:
# - Building Images RARES/Flatbed Dryer/:
#   * Front.jpg: View looking WEST directly into open front canopy from road.
#     - Right side (North, +X): Abuts Chemical Storage with concrete dividing wall.
#       Brick furnace base, cylindrical heat-exchange drum, and vertical stainless
#       exhaust chimney with rain cowl are positioned on this North side right next
#       to Chemical Storage!
#     - Left side (South, -X): Open towards green lawn/garden with round steel columns.
#       Rectangular grain drying bed with cream metal sheet walls is positioned
#       in this South bay!
#     - Back wall (West, +Y): The East wall of Seed Storage (mint green with 2 dark vents).
#     - Front (East, -Y): Open entrance under steel gable truss facing road & rares_entrance_5.
# - Survey Polygon:
#   * Span along local X (South-North): 7.30 m (-X = South/Lawn, +X = North/Chemical Storage)
#   * Depth along local Y (East-West): 8.80 m (-Y = East/Road, +Y = West/Seed Storage)
#   * Mapbox Rotation: 283.5 degrees (Front faces East towards road & rares_entrance_5)
#   * Model File: models/rares_flatbed_dryer.glb (< 300 KB budget)
# ==============================================================================

# 1. Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# 2. Material Helper
def create_mat(name, hex_color, roughness=0.6, metallic=0.0):
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

# Calibrated materials strictly from field photographs
mat_wall_mint     = create_mat("RFD_WallMint",       "#75A36A", roughness=0.82) # Soft mint green stucco (back wall)
mat_wall_dark     = create_mat("RFD_WallDarkGreen",  "#183C25", roughness=0.85) # Dark forest green base wainscot skirt
mat_wall_part     = create_mat("RFD_WallPartition",  "#7B9C75", roughness=0.88) # Weathered pale green concrete partition
mat_roof_green    = create_mat("RFD_RoofGreen",      "#3A5E3F", roughness=0.65, metallic=0.15) # Corrugated green metal roof
mat_roof_ridge    = create_mat("RFD_RoofRidge",      "#28462C", roughness=0.60, metallic=0.20) # Ridge cap
mat_roof_rust     = create_mat("RFD_RoofRust",       "#5C4A38", roughness=0.75, metallic=0.10) # Weathered/rusted roof edges
mat_concrete      = create_mat("RFD_Concrete",       "#858D88", roughness=0.90) # Concrete floor slab
mat_steel_frame   = create_mat("RFD_SteelFrame",     "#8A969E", roughness=0.55, metallic=0.45) # Industrial grey steel posts & trusses
mat_stainless     = create_mat("RFD_Stainless",      "#D2DBE0", roughness=0.25, metallic=0.80) # Stainless exhaust chimney pipe & cowl
mat_bin_cream     = create_mat("RFD_BinCream",       "#D8D6C8", roughness=0.65) # Off-white/cream drying bed sheet metal panels
mat_bin_floor     = create_mat("RFD_BinFloor",       "#8C8B82", roughness=0.80, metallic=0.25) # Perforated steel grain floor
mat_brick         = create_mat("RFD_Brick",          "#8E4634", roughness=0.85) # Red/terracotta furnace brick base
mat_drum_steel    = create_mat("RFD_DrumSteel",      "#655648", roughness=0.65, metallic=0.45) # Heat-treated oxidized furnace drum
mat_blower_blue   = create_mat("RFD_BlowerBlue",     "#1D4E89", roughness=0.50, metallic=0.20) # Blue industrial blower/duct
mat_vent_dark     = create_mat("RFD_VentDark",       "#141B20", roughness=0.90) # Dark rear ventilation openings
mat_sign_white    = create_mat("RFD_SignWhite",      "#F6F8FA", roughness=0.35) # Signboard face
mat_sign_border   = create_mat("RFD_SignBorder",     "#0E3817", roughness=0.50) # Dark green border trim
mat_sign_text     = create_mat("RFD_SignText",       "#0E3817", roughness=0.50) # Dark green 3D text
mat_sign_gold     = create_mat("RFD_SignGold",       "#DCA032", roughness=0.40, metallic=0.50) # Gold DA emblem

# Primitive box helper
def create_box(name, loc, size, mat=None, rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    return obj

# Primitive cylinder helper
def create_cylinder(name, loc, radius, depth, mat=None, rot=(0,0,0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    return obj

# ==============================================================================
# 3. AUTHENTIC DIMENSIONS STRICTLY CONFORMING TO GROUND-TRUTH & SURVEY POLYGON
# ==============================================================================
# In local coordinates:
# X axis: X_MIN = -3.65 m (South, Lawn), X_MAX = +3.65 m (North, Chemical Storage)
# Y axis: Y_FRONT = -4.40 m (East, Road & Entrance), Y_REAR = +4.40 m (West, Seed Storage)
# Z axis: Height (Z = 0 is ground)
W = 7.30            # Span along X (South-North width)
D = 8.80            # Depth along Y (East-West length)
H_SLAB = 0.15       # Concrete slab height
H_EAVE = 3.25       # Eave height of canopy posts
H_APEX = 4.45       # Ridge apex height (centered at X = 0.0)
H_CHIMNEY = 6.20    # Top of stainless exhaust chimney

X_MIN = -W / 2.0    # -3.65 m (South side open towards green lawn)
X_MAX = W / 2.0     # +3.65 m (North side abuts Chemical Storage)
Y_FRONT = -D / 2.0  # -4.40 m (East front facing road & rares_entrance_5)
Y_REAR = D / 2.0    # +4.40 m (West rear wall attached to Seed Storage)

# ==============================================================================
# A. CONCRETE FLOOR SLAB / PLINTH
# ==============================================================================
create_box("RFD_Concrete_Slab",
           (0.0, 0.0, H_SLAB / 2.0),
           (W + 0.20, D + 0.20, H_SLAB),
           mat_concrete)

# Front entrance concrete apron step aligned with road entrance
create_box("RFD_Entrance_Apron",
           (0.0, Y_FRONT - 0.40, H_SLAB / 2.0),
           (W * 0.80, 0.80, H_SLAB),
           mat_concrete)

# ==============================================================================
# B. ENCLOSED REAR BACK WALL (West wall attached to Seed Storage)
# ==============================================================================
# Lower dark green wainscot skirt (Z: 0.15 -> 1.05)
create_box("RFD_Rear_Wainscot",
           (0.0, Y_REAR - 0.11, (0.15 + 1.05) / 2.0),
           (W, 0.22, 1.05 - 0.15),
           mat_wall_dark)

# Upper mint green wall body (Z: 1.05 -> 3.25)
create_box("RFD_Rear_WallUpper",
           (0.0, Y_REAR - 0.11, (1.05 + H_EAVE) / 2.0),
           (W, 0.22, H_EAVE - 1.05),
           mat_wall_mint)

# Triangular gable apex wall at the rear closing to roof
def build_rear_triangular_gable():
    mesh = bpy.data.meshes.new("RFD_Rear_Gable_Mesh")
    obj = bpy.data.objects.new("RFD_Rear_Gable", mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    
    y_b = Y_REAR - 0.22
    y_f = Y_REAR
    v0 = bm.verts.new((X_MIN, y_b, H_EAVE))
    v1 = bm.verts.new((X_MAX, y_b, H_EAVE))
    v2 = bm.verts.new((0.0,   y_b, H_APEX))
    
    v3 = bm.verts.new((X_MIN, y_f, H_EAVE))
    v4 = bm.verts.new((X_MAX, y_f, H_EAVE))
    v5 = bm.verts.new((0.0,   y_f, H_APEX))
    
    bm.faces.new([v0, v1, v2])
    bm.faces.new([v5, v4, v3])
    bm.faces.new([v0, v2, v5, v3])
    bm.faces.new([v2, v1, v4, v5])
    bm.faces.new([v1, v0, v3, v4])
    
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mat_wall_mint)
    return obj

build_rear_triangular_gable()

# Structural concrete pilasters along the back wall
for px in [-2.40, 0.0, 2.40]:
    create_box(f"RFD_Rear_Pilaster_{px}",
               (px, Y_REAR - 0.13, (0.15 + H_EAVE) / 2.0),
               (0.28, 0.26, H_EAVE - 0.15),
               mat_wall_mint)

# 2 High horizontal rectangular dark ventilation openings on back wall per Front.jpg
for vx in [-1.75, 1.75]:
    create_box(f"RFD_Rear_Vent_{vx}",
               (vx, Y_REAR - 0.23, 2.70),
               (1.60, 0.06, 0.38),
               mat_vent_dark)

# ==============================================================================
# C. NORTH PARTITION WALL (Separating Flatbed Dryer from Chemical Storage at X_MAX)
# ==============================================================================
# Solid weathered concrete wall along X_MAX from Y = -2.0 to Y_REAR
create_box("RFD_North_Partition_Wall",
           (X_MAX - 0.10, (Y_REAR - 2.00) / 2.0, (0.15 + 2.85) / 2.0),
           (0.20, Y_REAR + 2.00, 2.85 - 0.15),
           mat_wall_part)

# ==============================================================================
# D. STEEL TUBULAR SUPPORT COLUMNS (Round pipe posts supporting canopy)
# ==============================================================================
col_coords = [
    ("FS", X_MIN + 0.15, Y_FRONT + 0.15),
    ("MS", X_MIN + 0.15, 0.0),
    ("RS", X_MIN + 0.15, Y_REAR - 0.25),
    ("FN", X_MAX - 0.15, Y_FRONT + 0.15),
    ("MN", X_MAX - 0.15, 0.0),
    ("RN", X_MAX - 0.15, Y_REAR - 0.25),
]

for name, cx, cy in col_coords:
    create_cylinder(f"RFD_Column_{name}",
                    (cx, cy, (0.15 + H_EAVE) / 2.0),
                    radius=0.065,
                    depth=H_EAVE - 0.15,
                    mat=mat_steel_frame,
                    vertices=12)
    create_box(f"RFD_Column_Base_{name}",
               (cx, cy, 0.15 + 0.10),
               (0.24, 0.24, 0.20),
               mat_concrete)

# Longitudinal eave beams connecting column tops at Z = H_EAVE
create_box("RFD_EaveBeam_South",
           (X_MIN + 0.15, 0.0, H_EAVE),
           (0.12, D, 0.12),
           mat_steel_frame)

create_box("RFD_EaveBeam_North",
           (X_MAX - 0.15, 0.0, H_EAVE),
           (0.12, D, 0.12),
           mat_steel_frame)

create_box("RFD_Ridge_Beam",
           (0.0, 0.0, H_APEX),
           (0.12, D + 0.40, 0.12),
           mat_steel_frame)

# ==============================================================================
# E. OPEN-WEB TRIANGULAR STEEL TRUSSES (Front, Middle, Rear)
# ==============================================================================
def create_truss(name, y_pos):
    create_box(f"RFD_Truss_{name}_BottomChord",
               (0.0, y_pos, H_EAVE),
               (W - 0.10, 0.09, 0.09),
               mat_steel_frame)
    hyp_len = math.hypot(W / 2.0, H_APEX - H_EAVE)
    angle_z = math.atan2(H_APEX - H_EAVE, W / 2.0)
    create_box(f"RFD_Truss_{name}_Rafter_South",
               (-W / 4.0, y_pos, (H_EAVE + H_APEX) / 2.0),
               (hyp_len, 0.09, 0.09),
               mat_steel_frame,
               rot=(0.0, -angle_z, 0.0))
    create_box(f"RFD_Truss_{name}_Rafter_North",
               (W / 4.0, y_pos, (H_EAVE + H_APEX) / 2.0),
               (hyp_len, 0.09, 0.09),
               mat_steel_frame,
               rot=(0.0, angle_z, 0.0))
    create_box(f"RFD_Truss_{name}_KingPost",
               (0.0, y_pos, (H_EAVE + H_APEX) / 2.0),
               (0.08, 0.08, H_APEX - H_EAVE),
               mat_steel_frame)
    for sx in [-1.80, 1.80]:
        h_local = H_EAVE + (H_APEX - H_EAVE) * (1.0 - abs(sx) / (W / 2.0))
        create_box(f"RFD_Truss_{name}_Strut_{sx}",
                   (sx, y_pos, (H_EAVE + h_local) / 2.0),
                   (0.07, 0.07, h_local - H_EAVE),
                   mat_steel_frame)

create_truss("Front", Y_FRONT + 0.15)
create_truss("Mid",   0.0)

# Intermediate longitudinal roof purlins
angle_z = math.atan2(H_APEX - H_EAVE, W / 2.0)
for purlin_frac in [0.33, 0.67]:
    for sign in [-1.0, 1.0]:
        px = sign * (W / 2.0) * (1.0 - purlin_frac)
        pz = H_EAVE + (H_APEX - H_EAVE) * purlin_frac
        create_box(f"RFD_Purlin_{sign}_{purlin_frac}",
                   (px, 0.0, pz),
                   (0.06, D + 0.40, 0.06),
                   mat_steel_frame)

# ==============================================================================
# F. GABLE CORRUGATED METAL ROOF SLABS
# ==============================================================================
OVERHANG_X = 0.35
OVERHANG_Y = 0.40
ROOF_W = (W / 2.0) + OVERHANG_X
ROOF_D = D + (OVERHANG_Y * 2.0)
hyp_roof = math.hypot(ROOF_W, H_APEX - H_EAVE)

# South roof slope (sloping towards open lawn)
create_box("RFD_Roof_Slope_South",
           (-ROOF_W / 2.0, 0.0, (H_EAVE + H_APEX) / 2.0 + 0.06),
           (hyp_roof, ROOF_D, 0.08),
           mat_roof_green,
           rot=(0.0, -angle_z, 0.0))

# North roof slope (sloping towards Chemical Storage)
create_box("RFD_Roof_Slope_North",
           (ROOF_W / 2.0, 0.0, (H_EAVE + H_APEX) / 2.0 + 0.06),
           (hyp_roof, ROOF_D, 0.08),
           mat_roof_green,
           rot=(0.0, angle_z, 0.0))

# Central Ridge Cap
create_box("RFD_Roof_RidgeCap",
           (0.0, 0.0, H_APEX + 0.12),
           (0.44, ROOF_D + 0.05, 0.06),
           mat_roof_ridge)

# Steel fascia rake trims (Front & Rear)
for y_fascia in [Y_FRONT - OVERHANG_Y, Y_REAR + OVERHANG_Y]:
    create_box(f"RFD_Fascia_South_{y_fascia}",
               (-ROOF_W / 2.0, y_fascia, (H_EAVE + H_APEX) / 2.0 + 0.06),
               (hyp_roof, 0.06, 0.12),
               mat_roof_rust,
               rot=(0.0, -angle_z, 0.0))
    create_box(f"RFD_Fascia_North_{y_fascia}",
               (ROOF_W / 2.0, y_fascia, (H_EAVE + H_APEX) / 2.0 + 0.06),
               (hyp_roof, 0.06, 0.12),
               mat_roof_rust,
               rot=(0.0, angle_z, 0.0))

# ==============================================================================
# G. THE FLATBED GRAIN DRYING BED (South bay, negative X per Front.jpg)
# ==============================================================================
BIN_W = 3.10   # Bin width along X
BIN_D = 5.60   # Bin depth along Y
BIN_H = 0.90   # Bin wall height
BIN_CX = -1.75 # Centered in South bay (negative X, towards lawn)
BIN_CY = 0.60  # Centered towards rear half

# Concrete footing pad under bin
create_box("RFD_Bin_Footing",
           (BIN_CX, BIN_CY, H_SLAB + 0.06),
           (BIN_W + 0.20, BIN_D + 0.20, 0.12),
           mat_concrete)

# Bin outer walls (North, South, East, West)
WALL_THICK = 0.08
# Front (East) bin wall
create_box("RFD_Bin_Wall_Front",
           (BIN_CX, BIN_CY - BIN_D / 2.0 + WALL_THICK / 2.0, H_SLAB + BIN_H / 2.0),
           (BIN_W, WALL_THICK, BIN_H),
           mat_bin_cream)

# Rear (West) bin wall
create_box("RFD_Bin_Wall_Rear",
           (BIN_CX, BIN_CY + BIN_D / 2.0 - WALL_THICK / 2.0, H_SLAB + BIN_H / 2.0),
           (BIN_W, WALL_THICK, BIN_H),
           mat_bin_cream)

# South bin wall (facing lawn)
create_box("RFD_Bin_Wall_South",
           (BIN_CX - BIN_W / 2.0 + WALL_THICK / 2.0, BIN_CY, H_SLAB + BIN_H / 2.0),
           (WALL_THICK, BIN_D, BIN_H),
           mat_bin_cream)

# North bin wall (facing center aisle)
create_box("RFD_Bin_Wall_North",
           (BIN_CX + BIN_W / 2.0 - WALL_THICK / 2.0, BIN_CY, H_SLAB + BIN_H / 2.0),
           (WALL_THICK, BIN_D, BIN_H),
           mat_bin_cream)

# Perforated grain floor inside bin
create_box("RFD_Bin_Floor",
           (BIN_CX, BIN_CY, H_SLAB + 0.45),
           (BIN_W - WALL_THICK * 2.0, BIN_D - WALL_THICK * 2.0, 0.05),
           mat_bin_floor)

# Top perimeter rim flange / rail
for bx, bsize in [
    ((BIN_CX, BIN_CY - BIN_D / 2.0), (BIN_W, 0.10, 0.05)),
    ((BIN_CX, BIN_CY + BIN_D / 2.0), (BIN_W, 0.10, 0.05)),
    ((BIN_CX - BIN_W / 2.0, BIN_CY), (0.10, BIN_D, 0.05)),
    ((BIN_CX + BIN_W / 2.0, BIN_CY), (0.10, BIN_D, 0.05)),
]:
    create_box("RFD_Bin_Rim",
               (bx[0], bx[1], H_SLAB + BIN_H + 0.02),
               bsize,
               mat_steel_frame)

# Cleanout hatch on front (East) of drying bin
create_box("RFD_Bin_Hatch",
           (BIN_CX, BIN_CY - BIN_D / 2.0 - 0.02, H_SLAB + 0.25),
           (0.60, 0.04, 0.35),
           mat_steel_frame)

# ==============================================================================
# H. BURNER & FURNACE SYSTEM (North bay next to Chemical Storage at positive X)
# ==============================================================================
FURN_CX = 1.85   # North bay center X (positive X, abutting Chemical Storage)
FURN_CY = -1.20  # Y position of burner near front

# Brick combustion chamber base
create_box("RFD_Furnace_Brick_Base",
           (FURN_CX, FURN_CY, (H_SLAB + 0.85) / 2.0),
           (1.25, 1.25, 0.85 - H_SLAB),
           mat_brick)

# Concrete lintel/top slab on brick base
create_box("RFD_Furnace_Brick_Top",
           (FURN_CX, FURN_CY, 0.85 + 0.04),
           (1.30, 1.30, 0.08),
           mat_concrete)

# Metal fuel feed door / hopper facing front (East)
create_box("RFD_Furnace_FeedDoor",
           (FURN_CX, FURN_CY - 0.64, 0.50),
           (0.55, 0.06, 0.45),
           mat_steel_frame)

# Large horizontal cylindrical heat-exchange drum behind brick burner
DRUM_R = 0.50
DRUM_LEN = 2.40
DRUM_CY = FURN_CY + 1.85
create_cylinder("RFD_Furnace_HeatDrum",
                (FURN_CX, DRUM_CY, H_SLAB + 0.65 + DRUM_R),
                radius=DRUM_R,
                depth=DRUM_LEN,
                mat=mat_drum_steel,
                rot=(math.radians(90), 0.0, 0.0),
                vertices=18)

# Drum steel support cradles / saddles
for dy in [DRUM_CY - 0.90, DRUM_CY + 0.90]:
    create_box(f"RFD_Drum_Cradle_{dy}",
               (FURN_CX, dy, (H_SLAB + 0.65) / 2.0),
               (1.10, 0.18, 0.65 - H_SLAB),
               mat_concrete)

# Blue industrial blower / transition duct connecting drum across to bin plenum
create_box("RFD_Blower_Housing",
           (FURN_CX - 0.75, DRUM_CY, H_SLAB + 0.45),
           (0.65, 0.85, 0.65),
           mat_blower_blue)

# Tapered transition duct entering bin North wall
bin_wall_n_x = BIN_CX + BIN_W / 2.0 # -1.75 + 1.55 = -0.20
blower_out_x = FURN_CX - 0.75 - 0.325 # 1.85 - 0.75 - 0.325 = 0.775
duct_center_x = (blower_out_x + bin_wall_n_x) / 2.0
duct_len_x = abs(bin_wall_n_x - blower_out_x)
create_box("RFD_Plenum_Duct",
           (duct_center_x, DRUM_CY, H_SLAB + 0.35),
           (duct_len_x, 0.75, 0.45),
           mat_blower_blue)

# ==============================================================================
# I. VERTICAL STAINLESS STEEL EXHAUST CHIMNEY & TOP RAIN COWL
# ==============================================================================
CHIM_X = FURN_CX - 0.10 # Centered over brick furnace flue outlet (positive X, North)
CHIM_Y = FURN_CY
CHIM_R = 0.18
CHIM_BOTTOM = 0.90
CHIM_TOP = H_CHIMNEY

# Vertical chimney pipe
create_cylinder("RFD_Chimney_Pipe",
                (CHIM_X, CHIM_Y, (CHIM_BOTTOM + CHIM_TOP) / 2.0),
                radius=CHIM_R,
                depth=CHIM_TOP - CHIM_BOTTOM,
                mat=mat_stainless,
                vertices=16)

# Roof flashing collar where chimney penetrates North roof slope
z_penetrate = H_EAVE + (H_APEX - H_EAVE) * (1.0 - abs(CHIM_X) / (W / 2.0))
create_cylinder("RFD_Chimney_RoofCollar",
                (CHIM_X, CHIM_Y, z_penetrate + 0.06),
                radius=CHIM_R + 0.08,
                depth=0.14,
                mat=mat_steel_frame,
                vertices=16)

# Conical rain cowl / Chinese hat at top of chimney
bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=CHIM_R + 0.16, radius2=0.0, depth=0.18, location=(CHIM_X, CHIM_Y, CHIM_TOP + 0.16))
cone_cowl = bpy.context.active_object
cone_cowl.name = "RFD_Chimney_RainCowl"
cone_cowl.data.materials.append(mat_stainless)

# Cowl vertical support brackets
for i in range(3):
    ang = i * (2.0 * math.pi / 3.0)
    bx = CHIM_X + math.cos(ang) * (CHIM_R + 0.04)
    by = CHIM_Y + math.sin(ang) * (CHIM_R + 0.04)
    create_cylinder(f"RFD_Chimney_Bracket_{i}",
                    (bx, by, CHIM_TOP + 0.07),
                    radius=0.015,
                    depth=0.14,
                    mat=mat_stainless,
                    vertices=8)

# ==============================================================================
# J. OFFICIAL FACILITY SIGNBOARD ("FLATBED DRYER")
# ==============================================================================
# Mounted on front canopy truss at Z = H_EAVE + 0.35 m
SIGN_Y = Y_FRONT + 0.08
SIGN_Z = H_EAVE + 0.35
SIGN_W = 3.20
SIGN_H = 0.50

# Signboard backing plaque
create_box("RFD_Sign_Backing",
           (0.0, SIGN_Y, SIGN_Z),
           (SIGN_W, 0.06, SIGN_H),
           mat_sign_white)

# Dark green border trim
create_box("RFD_Sign_BorderTop",    (0.0, SIGN_Y - 0.02, SIGN_Z + SIGN_H / 2.0), (SIGN_W + 0.04, 0.04, 0.04), mat_sign_border)
create_box("RFD_Sign_BorderBottom", (0.0, SIGN_Y - 0.02, SIGN_Z - SIGN_H / 2.0), (SIGN_W + 0.04, 0.04, 0.04), mat_sign_border)
create_box("RFD_Sign_BorderLeft",   (-SIGN_W / 2.0, SIGN_Y - 0.02, SIGN_Z), (0.04, 0.04, SIGN_H), mat_sign_border)
create_box("RFD_Sign_BorderRight",  (SIGN_W / 2.0, SIGN_Y - 0.02, SIGN_Z), (0.04, 0.04, SIGN_H), mat_sign_border)

# Circular DA Leaf Sprout Emblem Plaque on left side of signboard (South, negative X)
create_cylinder("RFD_Sign_Emblem",
                (-1.20, SIGN_Y - 0.035, SIGN_Z),
                radius=0.16,
                depth=0.03,
                mat=mat_sign_gold,
                rot=(math.radians(90), 0.0, 0.0),
                vertices=20)

# 3D Lettering "FLATBED DRYER"
create_box("RFD_Sign_Text",
           (0.30, SIGN_Y - 0.035, SIGN_Z),
           (2.00, 0.02, 0.20),
           mat_sign_text)

# ==============================================================================
# EXPORT TO GLB
# ==============================================================================
out_glb_dir = r"c:\Users\LGU-SanPedro\Downloads\map\models"
os.makedirs(out_glb_dir, exist_ok=True)
out_glb_path = os.path.join(out_glb_dir, "rares_flatbed_dryer.glb")

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=out_glb_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_materials='EXPORT',
    export_yup=True
)

file_size_kb = os.path.getsize(out_glb_path) / 1024.0
print(f"SUCCESS: Exported DA-RARES Flatbed Dryer to {out_glb_path}")
print(f"Model File Size: {file_size_kb:.2f} KB (Performance budget <= 300 KB: {'PASS' if file_size_kb <= 300 else 'FAIL'})")
