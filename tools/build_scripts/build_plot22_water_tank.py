import socket
import json
import os
import sys

blender_code = r'''
import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix

# 1. Clear existing scene meshes
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in bpy.data.meshes:
    bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    bpy.data.materials.remove(block)

# 2. Material Helper
def create_mat(name, hex_color, roughness=0.5, metallic=0.0):
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

# Materials calibrated to ground-truth field photos IMG_4187 & IMG_4192
mat_steel_dark     = create_mat("WT_SteelStructure", "#565D63", roughness=0.45, metallic=0.75) # Structural steel legs & beams
mat_steel_bright   = create_mat("WT_SteelBright",    "#9DA5AB", roughness=0.35, metallic=0.85) # Ladder, railings, catwalk
mat_tank_stainless = create_mat("WT_TankStainless",  "#B8BFC5", roughness=0.28, metallic=0.90) # Cylindrical water tank
mat_concrete_pier  = create_mat("WT_ConcretePier",   "#888B8D", roughness=0.85, metallic=0.05) # Footing piers
mat_pipe_blue      = create_mat("WT_PipeBlue",       "#1976D2", roughness=0.40, metallic=0.10) # Valve fitting
mat_pipe_grey      = create_mat("WT_PipeGrey",       "#474E54", roughness=0.40, metallic=0.70) # Central riser pipe
mat_sign_board     = create_mat("WT_SignBoard",      "#F2F4F5", roughness=0.30, metallic=0.05) # Signboard face
mat_sign_text      = create_mat("WT_SignText",       "#1A1C1E", roughness=0.20, metallic=0.10) # Dark text
mat_seal_gold      = create_mat("WT_SealGold",       "#E5A93C", roughness=0.35, metallic=0.50) # DA seal medallion
mat_seal_green     = create_mat("WT_SealGreen",      "#1B5E20", roughness=0.40, metallic=0.20) # DA seal green

# Geometry Helpers
def create_box(name, loc, size, mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, loc, radius, depth, vertices=16, rot=(0,0,0), mat=None, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=loc,
        rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cone(name, loc, radius1, radius2, depth, vertices=16, rot=(0,0,0), mat=None, parent=None):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=loc,
        rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_beam_between(name, p1, p2, thickness=0.08, mat=None, parent=None):
    # Vector from p1 to p2
    v1 = Vector(p1)
    v2 = Vector(p2)
    dir_v = v2 - v1
    length = dir_v.length
    if length < 1e-5:
        return None
    mid = (v1 + v2) / 2.0
    
    bpy.ops.mesh.primitive_cube_add(location=(0,0,0))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (thickness / 2.0, thickness / 2.0, length / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    # Orient Z axis along dir_v
    z_axis = Vector((0, 0, 1))
    rot_quat = z_axis.rotation_difference(dir_v.normalized())
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = rot_quat
    obj.location = mid
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=False)
    
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

root = bpy.data.objects.new("plot22_water_tank", None)
bpy.context.collection.objects.link(root)

# -------------------------------------------------------------
# 3. TOWER LEGS & FOOTINGS
# Tower base: 3.40m x 3.40m at ground (Z=0.0)
# Tower top:  2.50m x 2.50m at catwalk (Z=7.80m)
# -------------------------------------------------------------
z_base = 0.0
z_top = 7.80
half_base = 1.70
half_top = 1.25

# 4 Corner positions (Front-Left, Front-Right, Rear-Right, Rear-Left)
# Front is facing -Y (facing road)
leg_corners = [
    # (x_base, y_base, x_top, y_top, name)
    (-half_base, -half_base, -half_top, -half_top, "FL"),
    ( half_base, -half_base,  half_top, -half_top, "FR"),
    ( half_base,  half_base,  half_top,  half_top, "RR"),
    (-half_base,  half_base, -half_top,  half_top, "RL")
]

# Concrete footings at grade
for (xb, yb, xt, yt, cname) in leg_corners:
    create_box(f"Footing_{cname}", (xb, yb, 0.15), (0.45, 0.45, 0.30), mat=mat_concrete_pier, parent=root)
    # Structural steel angle leg
    create_beam_between(f"Leg_{cname}", (xb, yb, 0.30), (xt, yt, z_top), thickness=0.14, mat=mat_steel_dark, parent=root)

# -------------------------------------------------------------
# 4. HORIZONTAL TIE BEAMS & X-BRACING (3 TIERS)
# -------------------------------------------------------------
# Tiers at Z = 2.40m, Z = 5.00m, Z = 7.70m
def get_corner_at_z(c_idx, z_val):
    xb, yb, xt, yt, _ = leg_corners[c_idx]
    t = (z_val - z_base) / (z_top - z_base)
    x = xb + t * (xt - xb)
    y = yb + t * (yt - yb)
    return Vector((x, y, z_val))

tier_heights = [2.40, 5.00, 7.70]
prev_z = 0.30

for tier_idx, z_h in enumerate(tier_heights):
    # 4 horizontal perimeter beams
    for i in range(4):
        p1 = get_corner_at_z(i, z_h)
        p2 = get_corner_at_z((i + 1) % 4, z_h)
        create_beam_between(f"TieBeam_T{tier_idx}_{i}", p1, p2, thickness=0.10, mat=mat_steel_dark, parent=root)
    
    # Diagonal X-bracing on all 4 faces between prev_z and z_h
    # (Skip front lower bay for signboard and ladder)
    for i in range(4):
        p_bl = get_corner_at_z(i, prev_z)
        p_br = get_corner_at_z((i + 1) % 4, prev_z)
        p_tl = get_corner_at_z(i, z_h)
        p_tr = get_corner_at_z((i + 1) % 4, z_h)
        
        # Don't put diagonal across front face (i=0) in bottom tier (tier_idx=0) to keep entrance & sign clear
        if tier_idx == 0 and i == 0:
            continue
            
        create_beam_between(f"XBrace_A_T{tier_idx}_{i}", p_bl, p_tr, thickness=0.04, mat=mat_steel_dark, parent=root)
        create_beam_between(f"XBrace_B_T{tier_idx}_{i}", p_br, p_tl, thickness=0.04, mat=mat_steel_dark, parent=root)
        
    prev_z = z_h

# -------------------------------------------------------------
# 5. CENTRAL WATER RISER PIPE
# -------------------------------------------------------------
# Vertical riser pipe from Z=0.0 to Z=7.80
create_cylinder("RiserPipe", (0, 0, 3.90), radius=0.09, depth=7.80, vertices=16, mat=mat_pipe_grey, parent=root)
# Base valve fitting & connection flange (bright blue per field photo IMG_4187)
create_cylinder("BaseValveFitting", (0, 0, 0.40), radius=0.13, depth=0.35, vertices=16, mat=mat_pipe_blue, parent=root)
create_box("BaseValveHandle", (0.16, 0, 0.40), (0.12, 0.05, 0.10), mat=mat_pipe_blue, parent=root)

# -------------------------------------------------------------
# 6. ACCESS LADDER (UP FRONT-RIGHT LEG)
# -------------------------------------------------------------
# Ladder runs alongside front-right leg from Z=0.50m to Z=8.00m
xb_fr, yb_fr, xt_fr, yt_fr, _ = leg_corners[1]
# Rails offset slightly forward (-Y) from leg
ladder_offset_y = -0.15
rail_l_b = (xb_fr - 0.20, yb_fr + ladder_offset_y, 0.50)
rail_l_t = (xt_fr - 0.20, yt_fr + ladder_offset_y, 8.00)
rail_r_b = (xb_fr + 0.20, yb_fr + ladder_offset_y, 0.50)
rail_r_t = (xt_fr + 0.20, yt_fr + ladder_offset_y, 8.00)

create_beam_between("LadderRail_L", rail_l_b, rail_l_t, thickness=0.04, mat=mat_steel_bright, parent=root)
create_beam_between("LadderRail_R", rail_r_b, rail_r_t, thickness=0.04, mat=mat_steel_bright, parent=root)

# Ladder rungs every 0.30m
num_rungs = int((8.00 - 0.50) / 0.30)
for r_i in range(num_rungs):
    rz = 0.50 + r_i * 0.30
    t = (rz - 0.50) / (8.00 - 0.50)
    p_l = Vector((rail_l_b[0] + t * (rail_l_t[0] - rail_l_b[0]), rail_l_b[1] + t * (rail_l_t[1] - rail_l_b[1]), rz))
    p_r = Vector((rail_r_b[0] + t * (rail_r_t[0] - rail_r_b[0]), rail_r_b[1] + t * (rail_r_t[1] - rail_r_b[1]), rz))
    create_beam_between(f"LadderRung_{r_i}", p_l, p_r, thickness=0.025, mat=mat_steel_bright, parent=root)

# -------------------------------------------------------------
# 7. CATWALK PLATFORM & SAFETY RAILING
# -------------------------------------------------------------
z_catwalk = 7.80
# Catwalk circular base ring (outer diameter 3.60m)
create_cylinder("CatwalkPlatform", (0, 0, z_catwalk), radius=1.80, depth=0.10, vertices=24, mat=mat_steel_bright, parent=root)

# Circular safety handrail at Z = 8.80 (outer ring)
num_posts = 12
for p_i in range(num_posts):
    angle = (2.0 * math.pi / num_posts) * p_i
    # Leave gap where ladder arrives at front-right (around angle ~ 280-320 deg)
    deg = math.degrees(angle)
    if 290 < deg < 330:
        continue
    px = 1.75 * math.cos(angle)
    py = 1.75 * math.sin(angle)
    # Vertical post
    create_beam_between(f"RailingPost_{p_i}", (px, py, z_catwalk), (px, py, z_catwalk + 1.00), thickness=0.035, mat=mat_steel_bright, parent=root)

# Circular top handrail ring (approximated with 12 segments)
for p_i in range(num_posts):
    a1 = (2.0 * math.pi / num_posts) * p_i
    a2 = (2.0 * math.pi / num_posts) * ((p_i + 1) % num_posts)
    deg1 = math.degrees(a1)
    if 290 < deg1 < 330:
        continue
    p1 = (1.75 * math.cos(a1), 1.75 * math.sin(a1), z_catwalk + 1.00)
    p2 = (1.75 * math.cos(a2), 1.75 * math.sin(a2), z_catwalk + 1.00)
    create_beam_between(f"RailingTop_{p_i}", p1, p2, thickness=0.035, mat=mat_steel_bright, parent=root)
    # Mid rail at +0.50m
    pm1 = (1.75 * math.cos(a1), 1.75 * math.sin(a1), z_catwalk + 0.50)
    pm2 = (1.75 * math.cos(a2), 1.75 * math.sin(a2), z_catwalk + 0.50)
    create_beam_between(f"RailingMid_{p_i}", pm1, pm2, thickness=0.03, mat=mat_steel_bright, parent=root)

# -------------------------------------------------------------
# 8. ELEVATED STAINLESS STEEL WATER TANK
# -------------------------------------------------------------
# Bottom conical transition (from R=0.20m at Z=7.50m up to R=1.35m at Z=8.30m)
# In Blender, radius1 is at -depth/2 (Z=7.50m) and radius2 is at +depth/2 (Z=8.30m)
create_cone("TankBottomCone", (0, 0, 7.90), radius1=0.20, radius2=1.35, depth=0.80, vertices=24, mat=mat_tank_stainless, parent=root)

# Main cylindrical tank body: Diameter 2.70m (R=1.35m), Height 2.40m (from Z=8.30m to Z=10.70m)
create_cylinder("TankCylinder", (0, 0, 9.50), radius=1.35, depth=2.40, vertices=24, mat=mat_tank_stainless, parent=root)

# Horizontal rib seams along tank body for authentic ribbed industrial look
for rib_z in [8.80, 9.40, 10.00, 10.60]:
    create_cylinder(f"TankRib_{rib_z}", (0, 0, rib_z), radius=1.37, depth=0.04, vertices=24, mat=mat_steel_bright, parent=root)

# Top conical roof: R=1.35m at -depth/2 (Z=10.70m) tapering up to apex R=0.05m at +depth/2 (Z=11.30m)
create_cone("TankTopRoof", (0, 0, 11.00), radius1=1.35, radius2=0.05, depth=0.60, vertices=24, mat=mat_tank_stainless, parent=root)
# Apex vent cap / finial
create_cylinder("TankApexCap", (0, 0, 11.35), radius=0.18, depth=0.10, vertices=16, mat=mat_steel_bright, parent=root)

# -------------------------------------------------------------
# 9. OFFICIAL MODERNIZATION SIGNBOARD (IMG_4187)
# Located at front face (-Y) between front legs:
# "DEPARTMENT OF AGRICULTURE / REGIONAL FIELD OFFICE IV-A /
#  LARES WATER TANK / MODERNIZATION FY 2026"
# -------------------------------------------------------------
sign_w = 2.40
sign_h = 1.15
sign_z = 1.80
sign_y = -1.72 # Just in front of front legs

# White aluminum sign board
create_box("SignBoard", (0, sign_y, sign_z), (sign_w, 0.04, sign_h), mat=mat_sign_board, parent=root)
# Dark trim border
create_box("SignBorderTop",    (0, sign_y - 0.01, sign_z + sign_h/2.0), (sign_w + 0.04, 0.05, 0.03), mat=mat_steel_dark, parent=root)
create_box("SignBorderBottom", (0, sign_y - 0.01, sign_z - sign_h/2.0), (sign_w + 0.04, 0.05, 0.03), mat=mat_steel_dark, parent=root)
create_box("SignBorderLeft",   (-sign_w/2.0, sign_y - 0.01, sign_z),    (0.03, 0.05, sign_h + 0.04), mat=mat_steel_dark, parent=root)
create_box("SignBorderRight",  ( sign_w/2.0, sign_y - 0.01, sign_z),    (0.03, 0.05, sign_h + 0.04), mat=mat_steel_dark, parent=root)

# Two vertical ground mounting posts anchoring sign to earth
create_cylinder("SignPost_L", (-sign_w * 0.40, sign_y + 0.03, sign_z / 2.0), radius=0.035, depth=sign_z, vertices=12, mat=mat_steel_dark, parent=root)
create_cylinder("SignPost_R", ( sign_w * 0.40, sign_y + 0.03, sign_z / 2.0), radius=0.035, depth=sign_z, vertices=12, mat=mat_steel_dark, parent=root)

# Official Circular DA Seal Medallion on left of sign (x = -0.75)
create_cylinder("SignSeal_Outer", (-0.75, sign_y - 0.025, sign_z + 0.15), radius=0.24, depth=0.015, vertices=20, rot=(math.radians(90), 0, 0), mat=mat_seal_gold, parent=root)
create_cylinder("SignSeal_Inner", (-0.75, sign_y - 0.032, sign_z + 0.15), radius=0.20, depth=0.015, vertices=20, rot=(math.radians(90), 0, 0), mat=mat_seal_green, parent=root)

# 3D Dimensional Text Blocks on Signboard Face
# Line 1: DEPARTMENT OF AGRICULTURE
create_box("Text_DA", (0.22, sign_y - 0.025, sign_z + 0.32), (1.40, 0.012, 0.08), mat=mat_sign_text, parent=root)
# Line 2: REGIONAL FIELD OFFICE IV-A
create_box("Text_RFO", (0.22, sign_y - 0.025, sign_z + 0.20), (1.30, 0.012, 0.07), mat=mat_sign_text, parent=root)
# Line 3: BOLD MAIN TITLE "LARES WATER TANK"
create_box("Text_Title", (0.00, sign_y - 0.025, sign_z - 0.02), (2.05, 0.016, 0.18), mat=mat_sign_text, parent=root)
# Line 4: MODERNIZATION FY 2026
create_box("Text_Sub", (0.00, sign_y - 0.025, sign_z - 0.24), (1.30, 0.012, 0.08), mat=mat_sign_text, parent=root)

# -------------------------------------------------------------
# 10. CLEAN HIERARCHY, JOIN BY MATERIAL & EXPORT
# -------------------------------------------------------------
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        obj.select_set(True)
bpy.context.view_layer.objects.active = [o for o in bpy.data.objects if o.type == 'MESH'][0]

# Join meshes by material to minimize draw calls and keep GLB tiny
materials = list(bpy.data.materials)
for mat in materials:
    mat_objs = [o for o in bpy.context.scene.objects if o.type == 'MESH' and mat.name in [m.name for m in o.data.materials]]
    if len(mat_objs) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in mat_objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = mat_objs[0]
        bpy.ops.object.join()
        bpy.context.active_object.name = f"WT_Combined_{mat.name}"

# Select all meshes and root
bpy.ops.object.select_all(action='SELECT')

out_glb = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot22_water_tank.glb"
os.makedirs(os.path.dirname(out_glb), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_glb,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_materials='EXPORT',
    export_cameras=False,
    export_lights=False
)
file_size = os.path.getsize(out_glb)
print(f"EXPORT_SUCCESS: {out_glb} (Size: {file_size / 1024:.2f} KB)")
'''

def run_script():
    s = socket.socket()
    s.settimeout(60.0)
    s.connect(('127.0.0.1', 9876))
    s.sendall(json.dumps({'type': 'execute_code', 'params': {'code': blender_code}}).encode('utf-8') + b'\n')
    
    data = b""
    while True:
        try:
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
            try:
                res = json.loads(data.decode('utf-8'))
                break
            except ValueError:
                pass
        except Exception as e:
            break
    s.close()
    if 'res' not in locals():
        res = json.loads(data.decode('utf-8'))
    print("Blender response:", res)

if __name__ == '__main__':
    run_script()
