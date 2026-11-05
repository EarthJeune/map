"""
build_plot18_screenhouse_9.py — Master Architectural Rebuild of Screenhouse 9 & Potting Headhouse Complex
Conforms strictly to ground-truth photos:
- IMG_4185: Front approach, corrugated iron walls, double steel mesh gate, dark fascia, steel angle trusses.
- IMG_4186: Interior potting shed, utility room, white tiled sink & faucet, monobloc chair, potting benches.
- 9 Front View.jpg: Curved hoop arches, horizontal tie beams, diagonal truss struts, longitudinal purlins.
- Aerial Drone Orthophoto (media_1793162654115.jpg): Inverted 'V' red hip trim, small house with roof hatch in NW corner, raised nursery tables, external water drum.

Performance Budget: Strictly < 300 KB.
"""

import bpy
import bmesh
import math
import os

TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot18_screenhouse_9.glb"
os.makedirs(os.path.dirname(TARGET_GLB), exist_ok=True)

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
    for m in list(bpy.data.materials): bpy.data.materials.remove(m)
    for c in list(bpy.data.curves): bpy.data.curves.remove(c)
    for l in list(bpy.data.lights): bpy.data.lights.remove(l)
    for c in list(bpy.data.cameras): bpy.data.cameras.remove(c)

def make_mat(name, color, roughness=0.6, metallic=0.0, alpha=1.0, blend_method='OPAQUE'):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*color[:3], 1.0)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        if alpha < 1.0:
            if 'Alpha' in bsdf.inputs:
                bsdf.inputs['Alpha'].default_value = alpha
            mat.blend_method = 'BLEND'
            mat.show_transparent_back = True
        else:
            mat.blend_method = blend_method
    return mat

def create_box(name, loc, size, mat=None, rot=(0,0,0), parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0]/2.0, size[1]/2.0, size[2]/2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, loc, radius, depth, rot=(0,0,0), mat=None, parent=None, vertices=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_pipe_polyline(name, points, radius=0.024, mat=None, parent=None, resolution=1):
    curve_data = bpy.data.curves.new(name=f"{name}_curve", type='CURVE')
    curve_data.dimensions = '3D'
    curve_data.fill_mode = 'FULL'
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = resolution
    
    polyline = curve_data.splines.new('POLY')
    polyline.points.add(len(points) - 1)
    for i, pt in enumerate(points):
        polyline.points[i].co = (pt[0], pt[1], pt[2], 1.0)
        
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_barrel_mesh(name, half_w, length_y, z_eave, z_apex, y_start, y_end, mat=None, parent=None, x_segs=14, y_segs=8):
    rise = z_apex - z_eave
    R = (rise**2 + half_w**2) / (2.0 * rise)
    center_z = z_apex - R
    theta_max = math.asin(half_w / R)

    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    verts = []
    length = y_end - y_start
    y_step = length / y_segs

    for j in range(y_segs + 1):
        cur_y = y_start + j * y_step
        for i in range(x_segs + 1):
            t = -theta_max + 2.0 * theta_max * (i / x_segs)
            vx = R * math.sin(t)
            vz = center_z + R * math.cos(t)
            verts.append((vx, cur_y, vz))

    faces = []
    for j in range(y_segs):
        for i in range(x_segs):
            v0 = j * (x_segs + 1) + i
            v1 = j * (x_segs + 1) + (i + 1)
            v2 = (j + 1) * (x_segs + 1) + (i + 1)
            v3 = (j + 1) * (x_segs + 1) + i
            faces.append((v0, v1, v2, v3))

    mesh.from_pydata(verts, [], faces)
    mesh.update()

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(mesh)
    bm.free()

    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_master_model():
    clear_scene()

    # Materials Palette
    mat_plinth        = make_mat("SH9_PlinthConcrete", (0.55, 0.55, 0.53), roughness=0.82)
    mat_floor         = make_mat("SH9_FloorSlab", (0.65, 0.65, 0.63), roughness=0.72)
    mat_plaster       = make_mat("SH9_PlasterWall", (0.76, 0.75, 0.73), roughness=0.85)
    mat_corrugated    = make_mat("SH9_AgedCorrugated", (0.42, 0.44, 0.42), roughness=0.55, metallic=0.62)
    mat_dark_fascia   = make_mat("SH9_DarkFascia", (0.22, 0.18, 0.16), roughness=0.65)
    mat_soffit        = make_mat("SH9_SoffitWhite", (0.88, 0.88, 0.86), roughness=0.75)
    mat_red_trim      = make_mat("SH9_RedHipTrim", (0.48, 0.22, 0.18), roughness=0.60, metallic=0.35)
    mat_rusty_roof    = make_mat("SH9_RustyRedRoof", (0.50, 0.20, 0.16), roughness=0.55, metallic=0.35)
    mat_steel_frame   = make_mat("SH9_DarkSteelTruss", (0.20, 0.21, 0.23), roughness=0.42, metallic=0.85)
    mat_silver_pipe   = make_mat("SH9_SilverGalvPipe", (0.68, 0.70, 0.72), roughness=0.35, metallic=0.88)
    mat_mesh          = make_mat("SH9_GreenhouseMesh", (0.80, 0.84, 0.83), roughness=0.45, metallic=0.25, alpha=0.32)
    mat_gate_mesh     = make_mat("SH9_GateWireMesh", (0.22, 0.24, 0.25), roughness=0.55, metallic=0.75, alpha=1.0)
    mat_timber        = make_mat("SH9_TimberWood", (0.40, 0.28, 0.18), roughness=0.82)
    mat_seedlings     = make_mat("SH9_SeedlingCanopy", (0.15, 0.52, 0.15), roughness=0.85)
    mat_white_tiles   = make_mat("SH9_WhiteTiles", (0.94, 0.95, 0.96), roughness=0.18)
    mat_white_plastic = make_mat("SH9_WhitePlastic", (0.92, 0.93, 0.94), roughness=0.32)
    mat_dark_hatch    = make_mat("SH9_VentHatch", (0.12, 0.12, 0.14), roughness=0.55)

    root = bpy.data.objects.new("Plot18_Screenhouse_9_Root", None)
    bpy.context.collection.objects.link(root)

    # Dimensions
    shed_w = 7.42
    shed_d = 6.40
    shed_y_min = 1.65
    shed_y_max = 8.05
    shed_y_mid = (shed_y_min + shed_y_max) / 2.0

    trellis_w = 6.12
    trellis_l = 15.15
    trellis_y_min = -13.50
    trellis_y_max = 1.65
    trellis_y_mid = (trellis_y_min + trellis_y_max) / 2.0

    # ========================================================
    # PART 1: THE BIG HOUSE / COVERED POTTING SHED (NORTH)
    # ========================================================
    # 1.1 Foundation & Concrete Floor
    create_box("Shed_Floor_Slab", (0.0, shed_y_mid, 0.10), (shed_w, shed_d, 0.20), mat_floor, parent=root)

    curb_t = 0.16
    curb_h = 0.40
    create_box("Shed_Curb_West", (-shed_w/2.0 + curb_t/2.0, shed_y_mid, curb_h/2.0), (curb_t, shed_d, curb_h), mat_plinth, parent=root)
    create_box("Shed_Curb_East", ( shed_w/2.0 - curb_t/2.0, shed_y_mid, curb_h/2.0), (curb_t, shed_d, curb_h), mat_plinth, parent=root)
    create_box("Shed_Curb_Front_L", (-2.60, shed_y_max - curb_t/2.0, curb_h/2.0), (2.22, curb_t, curb_h), mat_plinth, parent=root)
    create_box("Shed_Curb_Front_R", ( 2.60, shed_y_max - curb_t/2.0, curb_h/2.0), (2.22, curb_t, curb_h), mat_plinth, parent=root)
    create_box("Shed_Entrance_Threshold", (0.0, shed_y_max + 0.15, 0.08), (3.00, 0.35, 0.16), mat_plinth, parent=root)

    # 1.2 Vertical Corrugated Iron Walls with Relief Texture (IMG_4185)
    wall_h = 2.85
    wall_z = 0.40 + wall_h / 2.0
    create_box("Shed_Wall_West", (-shed_w/2.0 + 0.04, shed_y_mid, wall_z), (0.08, shed_d, wall_h), mat_corrugated, parent=root)
    create_box("Shed_Wall_East", ( shed_w/2.0 - 0.04, shed_y_mid, wall_z), (0.08, shed_d, wall_h), mat_corrugated, parent=root)

    front_y = shed_y_max - 0.04
    create_box("Shed_Wall_Front_L", (-2.60, front_y, wall_z), (2.22, 0.08, wall_h), mat_corrugated, parent=root)
    create_box("Shed_Wall_Front_R", ( 2.60, front_y, wall_z), (2.22, 0.08, wall_h), mat_corrugated, parent=root)

    # Vertical corrugation fluting ribs on front panels
    for fx in [-3.50, -3.20, -2.90, -2.60, -2.30, -2.00, -1.70,
                1.70,  2.00,  2.30,  2.60,  2.90,  3.20,  3.50]:
        create_box(f"Shed_Rib_{fx:.2f}", (fx, front_y + 0.045, wall_z), (0.04, 0.015, wall_h), mat_corrugated, parent=root)

    # Gateway Structural Frame
    post_size = 0.10
    create_box("Shed_Gate_Post_L", (-1.50, shed_y_max, 1.625), (post_size, post_size, 3.25), mat_steel_frame, parent=root)
    create_box("Shed_Gate_Post_R", ( 1.50, shed_y_max, 1.625), (post_size, post_size, 3.25), mat_steel_frame, parent=root)
    create_box("Shed_Gate_Lintel", (0.0, shed_y_max, 3.20), (3.10, post_size, 0.10), mat_steel_frame, parent=root)

    # Authentic Open-Mesh Double Gates (IMG_4185 & IMG_4186)
    # Clear gateway between posts: X in [-1.45, 1.45] (width 2.90m)
    # Left Leaf (closed in doorway plane): X in [-1.45, -0.03], Y = 8.05
    # Right Leaf (swung 90 deg open inward along right side): X = 1.43, Y in [6.63, 8.05]
    tube_d = 0.036
    gate_h = 1.92
    gate_z_bot = 0.16
    gate_z_top = gate_z_bot + gate_h
    gate_z_mid = (gate_z_bot + gate_z_top) / 2.0
    gate_w = 1.42

    # --- LEFT GATE LEAF (Closed in the front doorway) ---
    lx_min = -1.45
    lx_max = -0.03
    lx_center = (lx_min + lx_max) / 2.0

    # Perimeter Outer Frame
    create_box("Gate_L_Stile_Hinge",   (lx_min + tube_d/2.0, shed_y_max, gate_z_mid), (tube_d, tube_d, gate_h), mat_steel_frame, parent=root)
    create_box("Gate_L_Stile_Meeting", (lx_max - tube_d/2.0, shed_y_max, gate_z_mid), (tube_d, tube_d, gate_h), mat_steel_frame, parent=root)
    create_box("Gate_L_Rail_Top",      (lx_center, shed_y_max, gate_z_top - tube_d/2.0), (gate_w, tube_d, tube_d), mat_steel_frame, parent=root)
    create_box("Gate_L_Rail_Bot",      (lx_center, shed_y_max, gate_z_bot + tube_d/2.0), (gate_w, tube_d, tube_d), mat_steel_frame, parent=root)
    create_box("Gate_L_Rail_Mid",      (lx_center, shed_y_max, 1.10), (gate_w, tube_d, tube_d), mat_steel_frame, parent=root)

    # 8 Vertical Steel Security Pickets (Authentic see-through security grille)
    for px in [-1.28, -1.13, -0.98, -0.83, -0.68, -0.53, -0.38, -0.23]:
        create_box(f"Gate_L_Picket_{px:.2f}", (px, shed_y_max, gate_z_mid), (0.016, 0.016, gate_h - tube_d * 2.0), mat_steel_frame, parent=root)

    # Horizontal Grille Wire Ties (Midway in lower & upper bays)
    create_box("Gate_L_Wire_Bot", (lx_center, shed_y_max, 0.62), (gate_w - tube_d * 2.0, 0.012, 0.012), mat_steel_frame, parent=root)
    create_box("Gate_L_Wire_Top", (lx_center, shed_y_max, 1.58), (gate_w - tube_d * 2.0, 0.012, 0.012), mat_steel_frame, parent=root)

    # Center Slide Bolt Latch & Padlock Loop
    create_box("Gate_L_Slide_Bolt", (lx_max - 0.02, shed_y_max + 0.03, 1.10), (0.08, 0.03, 0.03), mat_silver_pipe, parent=root)

    # --- RIGHT GATE LEAF (Swung 90 deg Open Inward along Right Wall) ---
    # Aligned parallel along X = 1.43m, extending from Y = 8.05m down to Y = 6.63m
    ry_max = shed_y_max
    ry_min = shed_y_max - gate_w # 6.63
    ry_center = (ry_min + ry_max) / 2.0
    rx_pos = 1.43

    # Perimeter Outer Frame
    create_box("Gate_R_Stile_Hinge",    (rx_pos, ry_max - tube_d/2.0, gate_z_mid), (tube_d, tube_d, gate_h), mat_steel_frame, parent=root)
    create_box("Gate_R_Stile_Swinging", (rx_pos, ry_min + tube_d/2.0, gate_z_mid), (tube_d, tube_d, gate_h), mat_steel_frame, parent=root)
    create_box("Gate_R_Rail_Top",       (rx_pos, ry_center, gate_z_top - tube_d/2.0), (tube_d, gate_w, tube_d), mat_steel_frame, parent=root)
    create_box("Gate_R_Rail_Bot",       (rx_pos, ry_center, gate_z_bot + tube_d/2.0), (tube_d, gate_w, tube_d), mat_steel_frame, parent=root)
    create_box("Gate_R_Rail_Mid",       (rx_pos, ry_center, 1.10), (tube_d, gate_w, tube_d), mat_steel_frame, parent=root)

    # 8 Vertical Steel Security Pickets (Authentic see-through security grille)
    for py in [6.80, 6.95, 7.10, 7.25, 7.40, 7.55, 7.70, 7.85]:
        create_box(f"Gate_R_Picket_{py:.2f}", (rx_pos, py, gate_z_mid), (0.016, 0.016, gate_h - tube_d * 2.0), mat_steel_frame, parent=root)

    # Horizontal Grille Wire Ties (Midway in lower & upper bays)
    create_box("Gate_R_Wire_Bot", (rx_pos, ry_center, 0.62), (0.012, gate_w - tube_d * 2.0, 0.012), mat_steel_frame, parent=root)
    create_box("Gate_R_Wire_Top", (rx_pos, ry_center, 1.58), (0.012, gate_w - tube_d * 2.0, 0.012), mat_steel_frame, parent=root)

    # Wall Hinge Brackets
    create_box("Gate_R_Hinge_Top", (rx_pos + 0.02, ry_max - 0.02, gate_z_top - 0.15), (0.04, 0.03, 0.08), mat_steel_frame, parent=root)
    create_box("Gate_R_Hinge_Bot", (rx_pos + 0.02, ry_max - 0.02, gate_z_bot + 0.15), (0.04, 0.03, 0.08), mat_steel_frame, parent=root)

    # 1.3 Steel Hip Roof Trusses Underneath (IMG_4185 & IMG_4186)
    # Strictly contained under the 4-hip roof (Z <= 4.12m at apex, Z <= 3.20m at eaves)
    # Perimeter Top Tie Beams (Wall Plates)
    create_box("Shed_TieBeam_Front", (0.0, shed_y_max, 3.20), (shed_w - 0.10, 0.08, 0.08), mat_steel_frame, parent=root)
    create_box("Shed_TieBeam_Rear",  (0.0, shed_y_min, 3.20), (shed_w - 0.10, 0.08, 0.08), mat_steel_frame, parent=root)
    create_box("Shed_TieBeam_West",  (-shed_w/2.0 + 0.04, shed_y_mid, 3.20), (0.08, shed_d, 0.08), mat_steel_frame, parent=root)
    create_box("Shed_TieBeam_East",  ( shed_w/2.0 - 0.04, shed_y_mid, 3.20), (0.08, shed_d, 0.08), mat_steel_frame, parent=root)

    # Center Transverse Tie Beam & King Post Truss (Under Ridge at Y = 4.85m)
    create_box("Shed_Truss_Tie_Transverse", (0.0, shed_y_mid, 3.20), (shed_w - 0.10, 0.07, 0.07), mat_steel_frame, parent=root)
    create_box("Shed_Truss_Center_KingPost", (0.0, shed_y_mid, 3.65), (0.07, 0.07, 0.90), mat_steel_frame, parent=root)
    create_pipe_polyline("Shed_Truss_Strut_W", [(-shed_w/2.0 + 0.40, shed_y_mid, 3.20), (0.0, shed_y_mid, 4.12)], radius=0.022, mat=mat_steel_frame, parent=root)
    create_pipe_polyline("Shed_Truss_Strut_E", [( shed_w/2.0 - 0.40, shed_y_mid, 3.20), (0.0, shed_y_mid, 4.12)], radius=0.022, mat=mat_steel_frame, parent=root)

    # Longitudinal Bottom Tie Beam & Longitudinal Struts
    create_box("Shed_Truss_Tie_Longitudinal", (0.0, shed_y_mid, 3.20), (0.07, shed_d - 0.10, 0.07), mat_steel_frame, parent=root)
    create_pipe_polyline("Shed_Truss_Strut_Front", [(0.0, shed_y_max - 0.50, 3.20), (0.0, shed_y_mid, 4.12)], radius=0.022, mat=mat_steel_frame, parent=root)
    create_pipe_polyline("Shed_Truss_Strut_Rear",  [(0.0, shed_y_min + 0.50, 3.20), (0.0, shed_y_mid, 4.12)], radius=0.022, mat=mat_steel_frame, parent=root)

    # 4 Corner Hip Rafter Pipes (Connecting corners to apex ridge)
    create_pipe_polyline("Shed_Truss_HipRafter_FL", [(-shed_w/2.0 + 0.30, shed_y_max - 0.30, 3.20), (-0.45, shed_y_mid, 4.12)], radius=0.024, mat=mat_steel_frame, parent=root)
    create_pipe_polyline("Shed_Truss_HipRafter_FR", [( shed_w/2.0 - 0.30, shed_y_max - 0.30, 3.20), ( 0.45, shed_y_mid, 4.12)], radius=0.024, mat=mat_steel_frame, parent=root)
    create_pipe_polyline("Shed_Truss_HipRafter_RL", [(-shed_w/2.0 + 0.30, shed_y_min + 0.30, 3.20), (-0.45, shed_y_mid, 4.12)], radius=0.024, mat=mat_steel_frame, parent=root)
    create_pipe_polyline("Shed_Truss_HipRafter_RR", [( shed_w/2.0 - 0.30, shed_y_min + 0.30, 3.20), ( 0.45, shed_y_mid, 4.12)], radius=0.024, mat=mat_steel_frame, parent=root)

    # 1.4 Interior Potting Shed Features (IMG_4186)
    # Utility Room Cubicle (West side)
    u_w = 2.30
    u_d = 2.90
    u_h = 2.50
    u_x = -shed_w/2.0 + u_w/2.0 + 0.20 # -2.41
    u_y = shed_y_min + u_d/2.0 + 0.80   # 3.90
    create_box("Shed_Utility_Room_Body", (u_x, u_y, 0.20 + u_h/2.0), (u_w, u_d, u_h), mat_plaster, parent=root)
    create_box("Shed_Utility_Room_Roof", (u_x, u_y, 0.20 + u_h + 0.05), (u_w + 0.10, u_d + 0.10, 0.10), mat_plinth, parent=root)

    u_door_y = u_y - 0.45
    create_box("Shed_Utility_Door_Frame", (u_x + u_w/2.0, u_door_y, 0.20 + 1.05), (0.08, 0.85, 2.10), mat_steel_frame, parent=root)
    create_box("Shed_Utility_Door_Panel", (u_x + u_w/2.0 - 0.02, u_door_y, 0.20 + 1.00), (0.04, 0.77, 2.00), mat_timber, parent=root)

    u_win_y = u_y + 0.80
    create_box("Shed_Utility_Win_Frame", (u_x + u_w/2.0, u_win_y, 0.20 + 1.55), (0.08, 0.80, 0.90), mat_steel_frame, parent=root)
    for gy in [-0.24, -0.08, 0.08, 0.24]:
        create_cylinder(f"Shed_Utility_Win_Bar_{gy}", (u_x + u_w/2.0, u_win_y + gy, 0.20 + 1.55), radius=0.012, depth=0.82, mat=mat_steel_frame, parent=root)

    # White-Tiled Wash Sink & Backsplash (IMG_4186)
    sink_w = 1.30
    sink_d = 0.70
    sink_h = 0.85
    sink_x = u_x
    sink_y = u_y + u_d/2.0 + sink_d/2.0 + 0.02
    create_box("Shed_Sink_Base", (sink_x, sink_y, 0.20 + sink_h/2.0), (sink_w, sink_d, sink_h), mat_plinth, parent=root)
    create_box("Shed_Sink_Top_Tiles", (sink_x, sink_y, 0.20 + sink_h + 0.03), (sink_w + 0.06, sink_d + 0.06, 0.06), mat_white_tiles, parent=root)
    create_box("Shed_Sink_Backsplash", (sink_x, sink_y - sink_d/2.0 + 0.03, 0.20 + sink_h + 0.20), (sink_w, 0.06, 0.35), mat_white_tiles, parent=root)
    create_cylinder("Shed_Sink_Faucet", (sink_x, sink_y - sink_d/4.0, 0.20 + sink_h + 0.16), radius=0.015, depth=0.20, mat=mat_silver_pipe, parent=root)

    # Monobloc Chair outside room
    chair_x = u_x + u_w/2.0 + 0.45
    chair_y = u_door_y + 0.85
    create_box("Shed_Chair_Seat", (chair_x, chair_y, 0.20 + 0.42), (0.45, 0.45, 0.05), mat_white_plastic, parent=root)
    create_box("Shed_Chair_Back", (chair_x + 0.20, chair_y, 0.20 + 0.72), (0.05, 0.42, 0.55), mat_white_plastic, parent=root)
    for cx_off in [-0.18, 0.18]:
        for cy_off in [-0.18, 0.18]:
            create_cylinder(f"Shed_Chair_Leg_{cx_off}_{cy_off}", (chair_x + cx_off, chair_y + cy_off, 0.20 + 0.20), radius=0.018, depth=0.40, mat=mat_white_plastic, parent=root)

    # Potting Soil Work Bench (East side)
    bench_w = 1.25
    bench_d = 3.10
    bench_h = 0.85
    create_box("Shed_Bench_Frame", (2.10, shed_y_mid, 0.20 + bench_h/2.0), (bench_w, bench_d, bench_h), mat_steel_frame, parent=root)
    create_box("Shed_Bench_PlankTop", (2.10, shed_y_mid, 0.20 + bench_h + 0.03), (bench_w + 0.05, bench_d + 0.05, 0.06), mat_timber, parent=root)

    # Rear Shed Support Posts & Open Portal
    create_box("Shed_Rear_Post_L", (-1.50, shed_y_min, 1.625), (post_size, post_size, 3.25), mat_steel_frame, parent=root)
    create_box("Shed_Rear_Post_R", ( 1.50, shed_y_min, 1.625), (post_size, post_size, 3.25), mat_steel_frame, parent=root)
    create_box("Shed_Rear_Lintel", (0.0, shed_y_min, 3.20), (3.10, post_size, 0.10), mat_steel_frame, parent=root)

    # 1.5 100% WATERTIGHT 4-HIP ROOF (conforming to aerial drone orthophoto)
    EAVE_OVERHANG = 0.45
    r_xmin = -shed_w/2.0 - EAVE_OVERHANG # -4.16
    r_xmax =  shed_w/2.0 + EAVE_OVERHANG # +4.16
    r_ymin = shed_y_min - EAVE_OVERHANG  # 1.20
    r_ymax = shed_y_max + EAVE_OVERHANG  # 8.50

    Z_EAVE_BOT = 3.25
    FASCIA_H   = 0.18
    Z_EAVE_TOP = Z_EAVE_BOT + FASCIA_H # 3.43
    Z_RIDGE    = 4.28

    # Solid Soffit Ceiling Slab
    create_box("Shed_Roof_Soffit_Slab", (0.0, shed_y_mid, Z_EAVE_BOT + 0.02), (r_xmax - r_xmin, r_ymax - r_ymin, 0.04), mat_soffit, parent=root)

    # Fascia Boards
    f_thick = 0.05
    create_box("Shed_Fascia_Front", (0.0, r_ymax - f_thick/2.0, Z_EAVE_BOT + FASCIA_H/2.0), (r_xmax - r_xmin, f_thick, FASCIA_H), mat_dark_fascia, parent=root)
    create_box("Shed_Fascia_Rear",  (0.0, r_ymin + f_thick/2.0, Z_EAVE_BOT + FASCIA_H/2.0), (r_xmax - r_xmin, f_thick, FASCIA_H), mat_dark_fascia, parent=root)
    create_box("Shed_Fascia_West",  (r_xmin + f_thick/2.0, shed_y_mid, Z_EAVE_BOT + FASCIA_H/2.0), (f_thick, r_ymax - r_ymin, FASCIA_H), mat_dark_fascia, parent=root)
    create_box("Shed_Fascia_East",  (r_xmax - f_thick/2.0, shed_y_mid, Z_EAVE_BOT + FASCIA_H/2.0), (f_thick, r_ymax - r_ymin, FASCIA_H), mat_dark_fascia, parent=root)

    # 4-Hip Roof Solid Surface Mesh (bmesh)
    # Symmetrical 4-Hip Roof with East-West Center Ridge
    ridge_w = 0.55
    roof_mesh = bpy.data.meshes.new("SH9_Shed_Roof_Surface")
    bm = bmesh.new()

    v_fl = bm.verts.new((r_xmin, r_ymax, Z_EAVE_TOP)) # Front Left (NW)
    v_fr = bm.verts.new((r_xmax, r_ymax, Z_EAVE_TOP)) # Front Right (NE)
    v_rr = bm.verts.new((r_xmax, r_ymin, Z_EAVE_TOP)) # Rear Right (SE)
    v_rl = bm.verts.new((r_xmin, r_ymin, Z_EAVE_TOP)) # Rear Left (SW)

    v_rw = bm.verts.new((-ridge_w, shed_y_mid, Z_RIDGE)) # Ridge West
    v_re = bm.verts.new(( ridge_w, shed_y_mid, Z_RIDGE)) # Ridge East

    bm.faces.new((v_fl, v_fr, v_re, v_rw)) # North Hip Slope (Front)
    bm.faces.new((v_fr, v_rr, v_re))       # East Hip Slope (Right)
    bm.faces.new((v_rr, v_rl, v_rw, v_re)) # South Hip Slope (Rear)
    bm.faces.new((v_rl, v_fl, v_rw))       # West Hip Slope (Left)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(roof_mesh)
    bm.free()

    roof_obj = bpy.data.objects.new("Shed_Hip_Roof_Mesh", roof_mesh)
    bpy.context.collection.objects.link(roof_obj)
    roof_obj.parent = root
    roof_obj.data.materials.append(mat_corrugated)

    # Sleek Folded Metal Ridge & Hip Flashing Caps (Realistic 5.2cm diameter profile)
    cap_r = 0.026
    cap_z_lift = 0.015
    create_pipe_polyline("Shed_Ridge_Cap", [(-ridge_w, shed_y_mid, Z_RIDGE + cap_z_lift), (ridge_w, shed_y_mid, Z_RIDGE + cap_z_lift)], radius=cap_r, mat=mat_red_trim, parent=root)
    create_pipe_polyline("Shed_Hip_Cap_FL", [(r_xmin, r_ymax, Z_EAVE_TOP + cap_z_lift), (-ridge_w, shed_y_mid, Z_RIDGE + cap_z_lift)], radius=cap_r, mat=mat_red_trim, parent=root)
    create_pipe_polyline("Shed_Hip_Cap_FR", [(r_xmax, r_ymax, Z_EAVE_TOP + cap_z_lift), ( ridge_w, shed_y_mid, Z_RIDGE + cap_z_lift)], radius=cap_r, mat=mat_red_trim, parent=root)
    create_pipe_polyline("Shed_Hip_Cap_RL", [(r_xmin, r_ymin, Z_EAVE_TOP + cap_z_lift), (-ridge_w, shed_y_mid, Z_RIDGE + cap_z_lift)], radius=cap_r, mat=mat_red_trim, parent=root)
    create_pipe_polyline("Shed_Hip_Cap_RR", [(r_xmax, r_ymin, Z_EAVE_TOP + cap_z_lift), ( ridge_w, shed_y_mid, Z_RIDGE + cap_z_lift)], radius=cap_r, mat=mat_red_trim, parent=root)

    # ========================================================
    # PART 2: THE SMALL HOUSE INSIDE GREENHOUSE (NW CORNER)
    # ========================================================
    sh_w = 2.30
    sh_d = 3.15
    sh_x = -trellis_w/2.0 + sh_w/2.0 + 0.10 # -1.86
    sh_y = trellis_y_max - sh_d/2.0 - 0.10   # -0.02
    sh_h = 2.15

    create_box("Small_House_Plinth", (sh_x, sh_y, 0.175), (sh_w, sh_d, 0.35), mat_plinth, parent=root)
    create_box("Small_House_Walls",  (sh_x, sh_y, 0.35 + sh_h/2.0), (sh_w, sh_d, sh_h), mat_plaster, parent=root)

    # Doorway facing East central greenhouse aisle
    sh_door_x = sh_x + sh_w/2.0
    sh_door_y = sh_y - 0.35
    create_box("Small_House_Door_Frame", (sh_door_x, sh_door_y, 0.35 + 1.00), (0.08, 0.85, 2.00), mat_steel_frame, parent=root)
    create_box("Small_House_Door_Leaf",  (sh_door_x - 0.02, sh_door_y, 0.35 + 0.98), (0.04, 0.77, 1.90), mat_soffit, parent=root)

    # South Window facing nursery beds
    sh_win_x = sh_x
    sh_win_y = sh_y - sh_d/2.0
    create_box("Small_House_Win_Frame", (sh_win_x, sh_win_y, 0.35 + 1.30), (0.90, 0.08, 0.85), mat_steel_frame, parent=root)
    create_box("Small_House_Win_Hood",  (sh_win_x, sh_win_y - 0.10, 0.35 + 1.75), (1.00, 0.22, 0.05), mat_plinth, parent=root)

    # Sloped Rusty Red Corrugated Roof
    sh_rx = sh_w + 0.30
    sh_ry = sh_d + 0.30
    sh_z_base = 0.35 + sh_h
    create_box("Small_House_Roof_Slab", (sh_x, sh_y, sh_z_base + 0.06), (sh_rx, sh_ry, 0.08), mat_rusty_roof, rot=(0, math.radians(-3.5), 0), parent=root)
    create_box("Small_House_Roof_Fascia", (sh_x, sh_y, sh_z_base + 0.02), (sh_rx + 0.02, sh_ry + 0.02, 0.06), mat_dark_fascia, rot=(0, math.radians(-3.5), 0), parent=root)

    # Signature Dark Square Roof Hatch (drone photo)
    create_box("Small_House_Roof_Hatch", (sh_x + 0.30, sh_y + 0.40, sh_z_base + 0.16), (0.65, 0.65, 0.12), mat_dark_hatch, parent=root)

    # ========================================================
    # PART 3: SCREENHOUSE 9 HOOP TRELLIS NURSERY (SOUTH)
    # ========================================================
    # 3.1 Foundation Curb Wall
    t_curb_h = 0.40
    t_curb_t = 0.16
    create_box("Trellis_Curb_South", (0.0, trellis_y_min + t_curb_t/2.0, t_curb_h/2.0), (trellis_w, t_curb_t, t_curb_h), mat_plinth, parent=root)
    create_box("Trellis_Curb_West",  (-trellis_w/2.0 + t_curb_t/2.0, trellis_y_mid, t_curb_h/2.0), (t_curb_t, trellis_l, t_curb_h), mat_plinth, parent=root)
    create_box("Trellis_Curb_East",  ( trellis_w/2.0 - t_curb_t/2.0, trellis_y_mid, t_curb_h/2.0), (t_curb_t, trellis_l, t_curb_h), mat_plinth, parent=root)

    # 3.2 TRUE CURVED HOOP ARCH TRUSSES (9 Front View.jpg)
    half_arch_w = trellis_w / 2.0 - 0.10 # 2.96m
    z_post_top  = 1.95
    z_arch_apex = 3.45
    rise = z_arch_apex - z_post_top
    R_arch = (rise**2 + half_arch_w**2) / (2.0 * rise)
    z_center = z_arch_apex - R_arch
    theta_max = math.asin(half_arch_w / R_arch)

    arch_ys = [-13.20, -11.10, -9.00, -6.90, -4.80, -2.70, -0.60, 1.45]

    for idx, ay in enumerate(arch_ys):
        create_cylinder(f"Hoop_Post_L_{idx}", (-half_arch_w, ay, (0.40 + z_post_top)/2.0), radius=0.026, depth=z_post_top - 0.40, mat=mat_steel_frame, parent=root)
        create_cylinder(f"Hoop_Post_R_{idx}", ( half_arch_w, ay, (0.40 + z_post_top)/2.0), radius=0.026, depth=z_post_top - 0.40, mat=mat_steel_frame, parent=root)
        create_box(f"Hoop_TieBeam_{idx}", (0.0, ay, z_post_top), (half_arch_w * 2.0, 0.05, 0.05), mat_steel_frame, parent=root)

        num_arc_pts = 10
        arc_points = []
        for p_idx in range(num_arc_pts):
            t = -theta_max + (2.0 * theta_max) * (p_idx / (num_arc_pts - 1))
            px = R_arch * math.sin(t)
            pz = z_center + R_arch * math.cos(t)
            arc_points.append((px, ay, pz))
        create_pipe_polyline(f"Hoop_CurvedArch_{idx}", arc_points, radius=0.024, mat=mat_steel_frame, parent=root)

        create_cylinder(f"Hoop_KingPost_{idx}", (0.0, ay, (z_post_top + z_arch_apex)/2.0), radius=0.018, depth=z_arch_apex - z_post_top, mat=mat_steel_frame, parent=root)
        create_pipe_polyline(f"Hoop_Strut_L_{idx}", [(-1.50, ay, z_post_top), (-1.85, ay, 2.75)], radius=0.016, mat=mat_steel_frame, parent=root)
        create_pipe_polyline(f"Hoop_Strut_R_{idx}", [( 1.50, ay, z_post_top), ( 1.85, ay, 2.75)], radius=0.016, mat=mat_steel_frame, parent=root)

    # Longitudinal Purlin Pipes
    y_purlin_start = trellis_y_min + 0.15
    y_purlin_end   = trellis_y_max - 0.10
    create_pipe_polyline("Purlin_Apex", [(0.0, y_purlin_start, z_arch_apex), (0.0, y_purlin_end, z_arch_apex)], radius=0.022, mat=mat_steel_frame, parent=root)
    create_pipe_polyline("Purlin_Shoulder_L", [(-2.10, y_purlin_start, 2.85), (-2.10, y_purlin_end, 2.85)], radius=0.020, mat=mat_steel_frame, parent=root)
    create_pipe_polyline("Purlin_Shoulder_R", [( 2.10, y_purlin_start, 2.85), ( 2.10, y_purlin_end, 2.85)], radius=0.020, mat=mat_steel_frame, parent=root)

    # 3.3 CURVED AGRICULTURAL INSECT SCREEN CANOPY
    build_barrel_mesh("Trellis_Curved_Mesh_Roof", half_arch_w + 0.04, trellis_l, z_post_top, z_arch_apex + 0.03,
                      trellis_y_min, trellis_y_max, mat=mat_mesh, parent=root, x_segs=12, y_segs=8)

    sw_h = z_post_top - 0.40
    create_box("Trellis_Mesh_Wall_West",  (-half_arch_w, trellis_y_mid, 0.40 + sw_h/2.0), (0.02, trellis_l, sw_h), mat_mesh, parent=root)
    create_box("Trellis_Mesh_Wall_East",  ( half_arch_w, trellis_y_mid, 0.40 + sw_h/2.0), (0.02, trellis_l, sw_h), mat_mesh, parent=root)
    create_box("Trellis_Mesh_Wall_South", (0.0, trellis_y_min + 0.02, 0.40 + sw_h/2.0), (half_arch_w * 2.0, 0.02, sw_h), mat_mesh, parent=root)

    # 3.4 Interior Walkway & Raised Seedling Tables
    create_box("Nursery_Walkway", (0.0, trellis_y_mid, 0.05), (1.10, trellis_l - 0.40, 0.10), mat_floor, parent=root)

    tbl_w = 1.80
    tbl_l = 1.45
    tbl_h = 0.75
    tbl_ys = [-12.20, -10.20, -8.20, -6.20, -4.20, -2.20, -0.20]

    for t_idx, ty in enumerate(tbl_ys):
        # East Column Tables (all 7 bays)
        tx_e = 1.80
        create_box(f"Table_East_Frame_{t_idx}", (tx_e, ty, tbl_h/2.0), (tbl_w, tbl_l, tbl_h), mat_steel_frame, parent=root)
        create_box(f"Table_East_Bed_{t_idx}",   (tx_e, ty, tbl_h + 0.03), (tbl_w - 0.06, tbl_l - 0.06, 0.06), mat_timber, parent=root)
        create_box(f"Table_East_Crop_{t_idx}",  (tx_e, ty, tbl_h + 0.14), (tbl_w - 0.12, tbl_l - 0.12, 0.16), mat_seedlings, parent=root)

        # West Column Tables (only for bays south of the small house: ty <= -2.5m)
        if ty <= -2.50:
            tx_w = -1.80
            create_box(f"Table_West_Frame_{t_idx}", (tx_w, ty, tbl_h/2.0), (tbl_w, tbl_l, tbl_h), mat_steel_frame, parent=root)
            create_box(f"Table_West_Bed_{t_idx}",   (tx_w, ty, tbl_h + 0.03), (tbl_w - 0.06, tbl_l - 0.06, 0.06), mat_timber, parent=root)
            create_box(f"Table_West_Crop_{t_idx}",  (tx_w, ty, tbl_h + 0.14), (tbl_w - 0.12, tbl_l - 0.12, 0.16), mat_seedlings, parent=root)


    # 3.5 External Amenities (West Flank)
    tank_x = -4.10
    tank_y = -5.50
    create_box("Water_Tank_Stand", (tank_x, tank_y, 0.55), (0.95, 0.95, 1.10), mat_steel_frame, parent=root)
    create_cylinder("Water_Tank_Drum", (tank_x, tank_y, 1.60), radius=0.45, depth=0.95, mat=mat_white_plastic, parent=root)
    create_box("Water_Pump_Base", (tank_x, -7.50, 0.15), (0.75, 1.10, 0.30), mat_plinth, parent=root)

    # ========================================================
    # 4. OPTIMIZED BATCH JOIN & EXPORT
    # ========================================================
    bpy.ops.object.select_all(action='DESELECT')
    mat_groups = {}
    for obj in list(bpy.context.scene.objects):
        if obj.type == 'MESH':
            mname = obj.data.materials[0].name if obj.data.materials else "Default"
            if mname not in mat_groups:
                mat_groups[mname] = []
            mat_groups[mname].append(obj)

    final_objs = []
    for mname, objs in mat_groups.items():
        if not objs:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        active = objs[0]
        bpy.context.view_layer.objects.active = active
        if len(objs) > 1:
            bpy.ops.object.join()
        active.name = f"SH9_{mname}"
        
        try:
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.remove_doubles(threshold=0.005)
            bpy.ops.object.mode_set(mode='OBJECT')
        except Exception:
            pass
            
        final_objs.append(active)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in final_objs:
        obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=TARGET_GLB,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )

    size_bytes = os.path.getsize(TARGET_GLB)
    size_kb = size_bytes / 1024.0
    print("====================================================")
    print(f" Master Rebuild Complete: {TARGET_GLB}")
    print(f" File Size: {size_kb:.2f} KB ({size_bytes} bytes)")
    print("====================================================")
    assert size_bytes < 300 * 1024, f"Model exceeded 300KB budget: {size_bytes} > 307200"

build_master_model()
