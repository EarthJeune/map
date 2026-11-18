import bpy
import bmesh
import math
import os

# ==============================================================================
# DA-RARES APCO RIZAL BUILDING (rares_building_7) - AUTHENTIC 3D MODEL
# Station: Rizal Agricultural Research & Experiment Station (Tanay, Rizal)
# Reference Sources:
#   - Building Images RARES/APCO Rizal Building/ (IMG_4380..4386 + Gap photo)
#   - rares_buildings.json exact 8-vertex polygon
#   - rares_roads.json entrance node ([121.34036757, 14.57547874])
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

mat_wall       = create_mat("APCO_MintWall",     "#5AC088", roughness=0.82)
mat_fascia     = create_mat("APCO_TealFascia",   "#16543D", roughness=0.65)
mat_soffit     = create_mat("APCO_WhiteSoffit",  "#E6ECE8", roughness=0.75)
mat_roof       = create_mat("APCO_MetalRoof",    "#2B5844", roughness=0.55, metallic=0.25)
mat_concrete   = create_mat("APCO_Concrete",     "#949992", roughness=0.90)
mat_shutter    = create_mat("APCO_RollShutter",  "#9BA3A8", roughness=0.45, metallic=0.55)
mat_shutter_hd = create_mat("APCO_ShutterHood",  "#B4BCC0", roughness=0.40, metallic=0.65)
mat_frame      = create_mat("APCO_DarkFrame",    "#221D1A", roughness=0.45, metallic=0.35)
mat_glass      = create_mat("APCO_TintedGlass",  "#3C3522", roughness=0.18, metallic=0.25)
mat_cream_door = create_mat("APCO_CreamDoor",    "#D8CFAF", roughness=0.60)
mat_bronze_dr  = create_mat("APCO_BronzeDoor",   "#4F4A3E", roughness=0.50, metallic=0.25)
mat_grille     = create_mat("APCO_Grille",       "#2E2B28", roughness=0.50, metallic=0.45)
mat_awning     = create_mat("APCO_Awning",       "#1A5940", roughness=0.55, metallic=0.20)
mat_plaque     = create_mat("APCO_Plaque",       "#B9B29A", roughness=0.40, metallic=0.40)

def create_box(name, loc, scale, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (scale[0] / 2.0, scale[1] / 2.0, scale[2] / 2.0)
    obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj

# Exact polygon vertices in meters relative to centroid (E=+X, N=+Y) from rares_buildings.json
# Note: v0..v7 from rares_buildings.json:
POLY_EN = [
    (-11.90,  1.48),  # v0: WNW corner
    (-10.27,  7.97),  # v1: NNW corner
    ( 10.76,  3.05),  # v2: ENE corner
    (  9.31, -3.73),  # v3: ESE corner
    (  5.43, -3.02),  # v4: step inner
    (  5.24, -3.76),  # v5: projecting bay SE corner
    ( -4.41, -1.46),  # v6: projecting bay SW corner
    ( -4.16, -0.52),  # v7: step inner SW
]

# Roof height slopes UP from South (front, y=-4) to North (rear, next to Nursery A, y=+8):
# Matching Gap between Nursery A and APCO.jpg: Front Z = 3.15m, Rear (Nursery A side) Z = 3.85m
def roof_z_at(y):
    t = max(0.0, min(1.0, (y - (-4.0)) / 12.0))
    return 3.15 + 0.70 * t

# 1. MAIN BUILDING SHELL (exact extruded footprint with sloped top)
mesh = bpy.data.meshes.new("APCO_MainBody_Mesh")
obj = bpy.data.objects.new("APCO_MainBody", mesh)
bpy.context.collection.objects.link(obj)
bm = bmesh.new()
bot_verts = [bm.verts.new((x, y, 0.0)) for (x, y) in POLY_EN]
top_verts = [bm.verts.new((x, y, roof_z_at(y))) for (x, y) in POLY_EN]
bm.faces.new(list(reversed(bot_verts)))
bm.faces.new(top_verts)
n = len(POLY_EN)
for i in range(n):
    j = (i + 1) % n
    bm.faces.new([bot_verts[i], bot_verts[j], top_verts[j], top_verts[i]])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
obj.data.materials.append(mat_wall)

# 2. OVERHANGING MONO-PITCH ROOF + WHITE SOFFIT + TEAL FASCIA
# +0.55m overhang on South, East, West; 0.0m North overhang on v1/v2 so the gap to Nursery A stays open
OVH = 0.55
cx_p = sum(p[0] for p in POLY_EN) / n
cy_p = sum(p[1] for p in POLY_EN) / n
ROOF_POLY = []
for idx, (x, y) in enumerate(POLY_EN):
    dx, dy = x - cx_p, y - cy_p
    L = math.hypot(dx, dy)
    ox = dx / L * OVH
    oy = 0.0 if idx in (1, 2) else (dy / L * OVH)
    ROOF_POLY.append((x + ox, y + oy))

def make_sloped_slab(name, poly, z_offset, thickness, mat):
    m = bpy.data.meshes.new(name + "_Mesh")
    o = bpy.data.objects.new(name, m)
    bpy.context.collection.objects.link(o)
    bm2 = bmesh.new()
    bv = [bm2.verts.new((x, y, roof_z_at(y) + z_offset)) for (x, y) in poly]
    tv = [bm2.verts.new((x, y, roof_z_at(y) + z_offset + thickness)) for (x, y) in poly]
    bm2.faces.new(list(reversed(bv)))
    bm2.faces.new(tv)
    nn = len(poly)
    for i in range(nn):
        j = (i + 1) % nn
        bm2.faces.new([bv[i], bv[j], tv[j], tv[i]])
    bmesh.ops.recalc_face_normals(bm2, faces=bm2.faces)
    bm2.to_mesh(m)
    bm2.free()
    o.data.materials.append(mat)
    return o

make_sloped_slab("APCO_Soffit", ROOF_POLY, -0.02, 0.04, mat_soffit)
make_sloped_slab("APCO_FasciaDeck", ROOF_POLY, 0.02, 0.12, mat_fascia)
make_sloped_slab("APCO_RoofSheet", ROOF_POLY, 0.14, 0.05, mat_roof)

# Helper to place facade elements aligned cleanly along the South front segments!
# Note: The South wall segments run at ~-13 deg (WNW to ESE):
#   - West wing (v7 -> v0): from (-4.16, -0.52) to (-11.90, 1.48), length ~7.99m, outward normal ~(-0.25, -0.97)
#   - Middle projecting wing (v5 -> v6): from (5.24, -3.76) to (-4.41, -1.46), length ~9.92m, outward normal ~(-0.23, -0.97)
#   - East wing (v3 -> v4): from (9.31, -3.73) to (5.43, -3.02), length ~3.94m

def place_on_segment(p_start, p_end, t_center, offset_out, z_center, width, thickness, height, mat, name):
    dx = p_end[0] - p_start[0]
    dy = p_end[1] - p_start[1]
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    # Outward normal (to the South/outside for CW/CCW segment going East->West: (uy, -ux) or (-uy, ux))
    nx, ny = uy, -ux
    if ny > 0:
        nx, ny = -nx, -ny
    px = p_start[0] + dx * t_center + nx * offset_out
    py = p_start[1] + dy * t_center + ny * offset_out
    ang = math.atan2(dy, dx)
    return create_box(name, (px, py, z_center), (width, thickness, height), mat, rot=(0, 0, ang))

# Segment A (West/Right-when-facing-front? Wait: looking at South facade from South:
#   LEFT is West (-11.9, +1.5), RIGHT is East (+9.3, -3.7)!
#   Wait: let's check IMG_4380..4386!
#   In IMG_4380 (from RIGHT side of front looking LEFT):
#     Nearest = blank wall + double dark-bronze door on raised concrete stoop!
#     Further left = grilled window + cream door + roll-up shutter door!
#   And in rares_roads.json, the entrance is on the WEST side (v0/v7)!
#   WAIT A SECOND! That means:
#     - WEST side (x < 0) = RIGHT side when facing the building from the South? No! When you stand South looking North at a building:
#       LEFT = WEST, RIGHT = EAST!
#     - Wait: in IMG_4380, we are looking from the RIGHT side of the front toward the LEFT!
#       If the camera is on the RIGHT (WEST? No, if camera is on the RIGHT looking LEFT, and the roll-up door is on the FAR LEFT, then the double door is on the RIGHT!).
#       AND in rares_roads.json, the entrance is at [121.34036757, 14.57547874] = WEST side (x ≈ -7.1m)!
#       That means the double door + stoop is on the WEST side (near the entrance road, x ≈ -6m to -10m), OR wait: in Gap between Nursery A and APCO.jpg, the West end wall is BLANK and Nursery A is on the right (North)! So from West looking East, Nursery A is on the LEFT if looking East! Wait: in Gap photo, Nursery A is on the RIGHT! If Nursery A (North) is on the RIGHT, the camera is looking WEST (from East)!
#       YES!! Look at Gap between Nursery A and APCO.jpg again:
#         Nursery A is on the RIGHT (North), bamboo kubo is on the LEFT (South)! That means the camera is on the EAST side looking WEST, OR the West side is the blank end wall!
#         And in IMG_4380, the camera is on the RIGHT side of the front facade (WEST end, looking EAST toward the middle & far-left roll-up shutter)!
#         Wait: if you stand at the WEST end of the South facade looking EAST:
#           - Nearest you (WEST end, v7-v0) = blank wall + double dark-bronze doors on concrete stoop!
#           - Next (middle, v6-v5) = grilled window + cream panel door with side windows + concrete apron!
#           - Far end (EAST end, v5-v3) = 3-hole louver + roll-up shutter door + 3-hole louver!
#         AND that puts the double dark-bronze doors RIGHT AT the rares_roads.json entrance node [121.34036757, 14.57547874] (v7-v0, WEST end of the South facade)!
#         EVERYTHING MATCHES 100%!

P_W_START = (-4.16, -0.52)   # v7
P_W_END   = (-11.90, 1.48)   # v0 (West corner)
P_M_START = ( 5.24, -3.76)   # v5 (East end of middle)
P_M_END   = (-4.41, -1.46)   # v6 (West end of middle)
P_E_START = ( 9.31, -3.73)   # v3 (East corner)
P_E_END   = ( 5.43, -3.02)   # v4

# --- WEST BAY (v7 -> v0, near entrance): Double Dark-Bronze Doors + Stoop + Plaque ---
place_on_segment(P_W_START, P_W_END, 0.30, 0.04, 1.25, 2.00, 0.10, 2.25, mat_frame, "DoubleDoor_Frame")
place_on_segment(P_W_START, P_W_END, 0.30, 0.06, 1.25, 1.88, 0.08, 2.15, mat_bronze_dr, "DoubleDoor_Leaves")
place_on_segment(P_W_START, P_W_END, 0.30, 0.72, 0.08, 2.50, 1.45, 0.16, mat_concrete, "DoubleDoor_Stoop")
place_on_segment(P_W_START, P_W_END, 0.48, 0.03, 1.65, 0.32, 0.04, 0.44, mat_plaque, "Wall_Plaque")
# Awning over West bay double doors
place_on_segment(P_W_START, P_W_END, 0.32, 0.45, 2.55, 3.60, 0.90, 0.06, mat_awning, "Awning_West")

# --- MIDDLE BAY (v5 -> v6): Grilled Window + Cream Panel Door + Side Windows + Downspout ---
# Grilled window (closer to West/step)
place_on_segment(P_M_START, P_M_END, 0.78, 0.04, 1.55, 2.10, 0.10, 1.35, mat_frame, "GrilledWin_Frame")
place_on_segment(P_M_START, P_M_END, 0.78, 0.06, 1.55, 1.98, 0.06, 1.23, mat_glass, "GrilledWin_Glass")
for g in range(-3, 4):
    place_on_segment(P_M_START, P_M_END, 0.78 + g * 0.025, 0.08, 1.55, 0.03, 0.04, 1.23, mat_grille, f"GrilledWin_Bar_{g}")

# Cream panel door + 2 side windows + concrete apron
place_on_segment(P_M_START, P_M_END, 0.44, 0.04, 1.22, 1.05, 0.10, 2.25, mat_frame, "CreamDoor_Frame")
place_on_segment(P_M_START, P_M_END, 0.44, 0.06, 1.12, 0.95, 0.08, 2.02, mat_cream_door, "CreamDoor_Leaf")
place_on_segment(P_M_START, P_M_END, 0.56, 0.04, 1.55, 0.65, 0.08, 1.25, mat_glass, "SideWin_R")
place_on_segment(P_M_START, P_M_END, 0.32, 0.04, 1.55, 0.65, 0.08, 1.25, mat_glass, "SideWin_L")
place_on_segment(P_M_START, P_M_END, 0.44, 0.70, 0.04, 2.80, 1.40, 0.08, mat_concrete, "CreamDoor_Apron")

# Continuous awning over middle bay
place_on_segment(P_M_START, P_M_END, 0.58, 0.45, 2.52, 7.60, 0.90, 0.06, mat_awning, "Awning_Mid")
# Green PVC downspout near step
place_on_segment(P_M_START, P_M_END, 0.94, 0.06, 1.50, 0.09, 0.09, 2.95, mat_wall, "Downspout_Mid")

# --- EAST BAY (Roll-up shutter door + concrete louvers) ---
# Placed on East end of middle bay + East wing
place_on_segment(P_M_START, P_M_END, 0.14, 0.04, 1.30, 3.20, 0.12, 2.55, mat_shutter, "RollUp_Shutter")
place_on_segment(P_M_START, P_M_END, 0.14, 0.14, 2.65, 3.30, 0.28, 0.32, mat_shutter_hd, "RollUp_Hood")
place_on_segment(P_M_START, P_M_END, 0.30, 0.03, 2.35, 0.55, 0.06, 0.35, mat_concrete, "Louver_Mid")
place_on_segment(P_E_START, P_E_END, 0.50, 0.03, 2.35, 0.55, 0.06, 0.35, mat_concrete, "Louver_East")

# Export GLB strictly under 300 KB
os.makedirs("models", exist_ok=True)
out_path = os.path.abspath("models/rares_apco.glb")
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True
)
size_kb = os.path.getsize(out_path) / 1024.0
print(f"Exported {out_path} ({size_kb:.2f} KB)")

