"""
build_lares_building.py — Authentic Bespoke 3D Model of the DA-LARES Main Building (LARES Building)
Department of Agriculture - Southern Tagalog Integrated Agricultural Research Center (DA-LARES)

Authentic ground-truth architectural model built directly from field photos & aerial geometry:
1. IMG_3804 (Front-Left Facade & Main Entrance):
   - Rectangular concrete signage canopy: "LIPA AGRICULTURAL RESEARCH AND EXPERIMENT STATION (LARES)"
   - Raised concrete porch and inclined access ramp aligning with roads.json entrance node
   - Double commercial glass entrance doors with aluminum frame and transom
   - Pale yellow stucco walls with dark maroon base trim
   - Wide window bays with white vertical security grilles
2. IMG_3803 (Front-Right Facade):
   - Secondary entrance with arched curved green awning canopy over glass double doors
   - Continuous horizontal window banks with white security grilles
   - Window AC condenser unit mounted beneath window near corner
3. IMG_3816 (Far-Left Exterior Flank):
   - Perpendicular side wall with "TRICHOGRAMMA" and "TISSUE CULTURE LAB" wall signage
   - Side windows with white security grilles, eaves, gutters, and rainwater tank
4. IMG_3800 / IMG_3860 & Veranda Photos (Outer-Right Lower Roof Extension along 3800):
   - Attached lower roof extension running along the entire outer right (East) flank
   - Structural red-painted steel angle trusses mounted beneath the main roof eaves
   - Round tubular steel pipe columns / support posts at regular bays
   - Weathered corrugated metal lower roof plane
   - Raised concrete veranda floor, tiled entrance steps, doorway, and horizontal pipe railings
5. Main L-Shaped Body & Hipped Green Metal Roof:
   - Full L-shaped footprint (Horizontal Front Wing 52.4m x 14.6m, Vertical Rear Wing 38.8m x 10.0m)
   - Continuous hipped green corrugated metal roof covering the entire main body
   - Ridge caps along all peaks, hips, and inner valley
   - Perimeter fascia boards and gutters
   - Strictly ZERO external props (no lawn slabs, outside trees, driveways, or curbs)
   - File size budget strictly <= 300 KB
"""

import bpy
import bmesh
import math
import os

def create_mat(name, color, roughness=0.7, metallic=0.0, specular=0.5, alpha=1.0):
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    node_out = nodes.new(type='ShaderNodeOutputMaterial')
    node_principled = nodes.new(type='ShaderNodeBsdfPrincipled')
    
    c = (*color[:3], alpha)
    node_principled.inputs['Base Color'].default_value = c
    node_principled.inputs['Roughness'].default_value = roughness
    node_principled.inputs['Metallic'].default_value = metallic
    
    if alpha < 1.0:
        if 'Alpha' in node_principled.inputs:
            node_principled.inputs['Alpha'].default_value = alpha
        if hasattr(mat, 'blend_method'):
            mat.blend_method = 'BLEND'
            
    if 'Specular IOR Level' in node_principled.inputs:
        node_principled.inputs['Specular IOR Level'].default_value = specular
    elif 'Specular' in node_principled.inputs:
        node_principled.inputs['Specular'].default_value = specular
        
    mat.node_tree.links.new(node_principled.outputs['BSDF'], node_out.inputs['Surface'])
    return mat

def create_box(name, loc, size, mat, parent=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = loc
    obj.scale = size
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, loc, radius, height, mat, segments=12, rot=(0,0,0), parent=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=height)
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = loc
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_wedge_ramp(name, x_min, x_max, y_start, y_end, z_start, z_end, mat, parent=None):
    """Creates a rectangular ramp/wedge along Y."""
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    
    bm = bmesh.new()
    v0 = bm.verts.new((x_min, y_start, 0.0))
    v1 = bm.verts.new((x_max, y_start, 0.0))
    v2 = bm.verts.new((x_max, y_start, z_start))
    v3 = bm.verts.new((x_min, y_start, z_start))
    
    v4 = bm.verts.new((x_min, y_end, 0.0))
    v5 = bm.verts.new((x_max, y_end, 0.0))
    v6 = bm.verts.new((x_max, y_end, z_end))
    v7 = bm.verts.new((x_min, y_end, z_end))
    
    bm.faces.new((v0, v1, v2, v3))
    bm.faces.new((v5, v4, v7, v6))
    bm.faces.new((v0, v4, v5, v1))
    bm.faces.new((v3, v2, v6, v7))
    bm.faces.new((v0, v3, v7, v4))
    bm.faces.new((v1, v5, v6, v2))
    
    bm.to_mesh(mesh)
    bm.free()
    
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_ridge_bar(name, p1, p2, width, height, mat, parent=None):
    """Creates a box bar between 3D points p1 and p2."""
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    dz = p2[2] - p1[2]
    length = math.sqrt(dx*dx + dy*dy + dz*dz)
    if length < 1e-4:
        return None
    mid = ((p1[0]+p2[0])/2.0, (p1[1]+p2[1])/2.0, (p1[2]+p2[2])/2.0)
    
    obj = create_box(name, mid, (width, length, height), mat, parent)
    rot_z = -math.atan2(dx, dy)
    horiz_len = math.sqrt(dx*dx + dy*dy)
    rot_x = math.atan2(dz, horiz_len)
    obj.rotation_euler = (rot_x, 0, rot_z)
    return obj

def create_arched_canopy(name, center_x, base_y, depth, base_z, width, rise, mat_cover, mat_frame, root, segments=8):
    """Creates a curved barrel-vault canopy with supporting arched frames."""
    mesh = bpy.data.meshes.new(name + "_Cover_Mesh")
    obj = bpy.data.objects.new(name + "_Cover", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = root
    obj.data.materials.append(mat_cover)
    
    bm = bmesh.new()
    verts_front = []
    verts_back = []
    for i in range(segments + 1):
        u = i / segments # 0.0 to 1.0
        vx = (center_x - width / 2.0) + u * width
        vz = base_z + rise * (1.0 - (2.0 * u - 1.0) ** 2)
        verts_front.append(bm.verts.new((vx, base_y - depth, vz)))
        verts_back.append(bm.verts.new((vx, base_y, vz)))
        
    for i in range(segments):
        bm.faces.new((verts_front[i], verts_front[i+1], verts_back[i+1], verts_back[i]))
        
    bm.to_mesh(mesh)
    bm.free()
    
    # Red steel tubular perimeter frames & tie beams:
    create_box(f"{name}_TieL", (center_x - width/2.0, base_y - depth/2.0, base_z), (0.05, depth, 0.05), mat_frame, root)
    create_box(f"{name}_TieR", (center_x + width/2.0, base_y - depth/2.0, base_z), (0.05, depth, 0.05), mat_frame, root)
    create_box(f"{name}_BraceL", (center_x - width/2.0, base_y - depth/2.0, base_z - 0.35), (0.05, depth * 0.7, 0.05), mat_frame, root)
    create_box(f"{name}_BraceR", (center_x + width/2.0, base_y - depth/2.0, base_z - 0.35), (0.05, depth * 0.7, 0.05), mat_frame, root)
    return obj

def build_lares_building():
    print("====================================================")
    print(" Building Authentic 3D Model: LARES Building")
    print("====================================================")
    
    # Clean ALL old mesh/curve objects to prevent any ghost building overlap
    for obj in list(bpy.data.objects):
        if obj.type in ['MESH', 'CURVE', 'EMPTY']:
            bpy.data.objects.remove(obj, do_unlink=True)
            
    # Materials
    mat_wall_yellow   = create_mat("LARES_WallYellow", (0.90, 0.86, 0.74), roughness=0.82) # Pale Cream/Yellow Stucco
    mat_wall_maroon   = create_mat("LARES_WallMaroon", (0.36, 0.12, 0.15), roughness=0.75) # Deep Maroon Plinth Skirt
    mat_wall_white    = create_mat("LARES_WallWhite", (0.92, 0.92, 0.92), roughness=0.70) # White trim/columns
    mat_concrete      = create_mat("LARES_Concrete", (0.62, 0.63, 0.64), roughness=0.85) # Steps & walkways
    mat_roof_green    = create_mat("LARES_RoofGreen", (0.22, 0.35, 0.25), roughness=0.45) # Main Green Hipped Roof
    mat_roof_ridge    = create_mat("LARES_RoofRidge", (0.16, 0.26, 0.19), roughness=0.40) # Darker Ridge Cap Tiles
    mat_roof_lower    = create_mat("LARES_RoofLower", (0.42, 0.32, 0.28), roughness=0.55) # Weathered Corrugated Metal
    mat_truss_red     = create_mat("LARES_TrussRed", (0.55, 0.18, 0.14), roughness=0.50, metallic=0.2) # Oxide Red Steel Trusses
    mat_pipe_gray     = create_mat("LARES_PipeGray", (0.50, 0.54, 0.56), roughness=0.35, metallic=0.7) # Steel Support Columns & Rails
    mat_glass         = create_mat("LARES_Glass", (0.05, 0.08, 0.12), roughness=0.15, metallic=0.1, specular=0.85) # Rich Dark Tinted Reflective Glass
    mat_frame_dark    = create_mat("LARES_FrameDark", (0.18, 0.19, 0.20), roughness=0.50, metallic=0.4) # Dark Aluminum Window Frames
    mat_grille_white  = create_mat("LARES_GrilleWhite", (0.95, 0.95, 0.95), roughness=0.50) # Security Grilles
    mat_sign_board    = create_mat("LARES_SignBoard", (0.95, 0.95, 0.95), roughness=0.40) # Signage face
    mat_sign_green    = create_mat("LARES_SignGreen", (0.15, 0.32, 0.18), roughness=0.40) # Green sign text
    mat_blue_plastic  = create_mat("LARES_BlueDrum", (0.08, 0.30, 0.65), roughness=0.45) # Rainwater drum
    mat_ac_metal      = create_mat("LARES_ACMetal", (0.85, 0.86, 0.88), roughness=0.40, metallic=0.5)
    mat_frame_alum    = create_mat("LARES_FrameAlum", (0.28, 0.30, 0.32), roughness=0.40, metallic=0.7) # Anodized Aluminum Perimeter Frame
    mat_door_stile    = create_mat("LARES_DoorStile", (0.88, 0.90, 0.92), roughness=0.30, metallic=0.8) # Silver Door Stiles & Kickplates
    mat_canopy_poly   = create_mat("LARES_CanopyPoly", (0.10, 0.38, 0.20), roughness=0.30) # Emerald Green Arched Canopy
    mat_bulletin_green= create_mat("LARES_BulletinGreen", (0.06, 0.28, 0.14), roughness=0.55) # Green Bulletin Board
    mat_bulletin_white= create_mat("LARES_BulletinWhite", (0.95, 0.95, 0.95), roughness=0.40) # Bulletin Board Header Banner
    mat_door_poster   = create_mat("LARES_DoorPoster", (0.80, 0.22, 0.18), roughness=0.60) # Anti Red Tape Door Poster

    root = bpy.data.objects.new("LARES_Building_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # Architectural Dimensioning (orthogonalized to GIS centroid & entrance node):
    # Front Wing:
    # X: -29.20 to +13.20 (42.40m wide), merges with vertical wing to +23.20m (total front 52.40m)
    # Y: -15.28 (front) to -0.68 (rear), depth = 14.60m
    # Vertical Rear Wing (Right leg of L):
    # X: +13.20 to +23.20 (10.00m wide)
    # Y: -15.28 to +23.50 (38.78m deep)
    # Wall height: 3.60m, Plinth skirt: 0.45m
    
    WALL_H = 3.60
    SKIRT_H = 0.45
    
    # -----------------------------------------------------------------
    # 1. Main L-Shaped Walls & Plinth Skirt
    # -----------------------------------------------------------------
    # Block A: Horizontal Front Wing (X: -29.20 to 13.20, Y: -15.28 to -0.68)
    wA_x_min, wA_x_max = -29.20, 13.20
    wA_y_min, wA_y_max = -15.28, -0.68
    wA_cx = (wA_x_min + wA_x_max) / 2.0
    wA_cy = (wA_y_min + wA_y_max) / 2.0
    wA_w = wA_x_max - wA_x_min
    wA_d = wA_y_max - wA_y_min
    
    # Plinth Skirt (Maroon)
    create_box("LARES_Plinth_FrontWing", (wA_cx, wA_cy, SKIRT_H / 2.0), (wA_w, wA_d, SKIRT_H), mat_wall_maroon, root)
    # Main Wall Body (Yellow)
    create_box("LARES_Wall_FrontWing", (wA_cx, wA_cy, SKIRT_H + (WALL_H - SKIRT_H) / 2.0), (wA_w, wA_d, WALL_H - SKIRT_H), mat_wall_yellow, root)

    # Block B: Vertical Rear Wing (X: 13.20 to 23.20, Y: -15.28 to 23.50)
    wB_x_min, wB_x_max = 13.20, 23.20
    wB_y_min, wB_y_max = -15.28, 23.50
    wB_cx = (wB_x_min + wB_x_max) / 2.0
    wB_cy = (wB_y_min + wB_y_max) / 2.0
    wB_w = wB_x_max - wB_x_min
    wB_d = wB_y_max - wB_y_min
    
    # Plinth Skirt (Maroon)
    create_box("LARES_Plinth_RearWing", (wB_cx, wB_cy, SKIRT_H / 2.0), (wB_w, wB_d, SKIRT_H), mat_wall_maroon, root)
    # Main Wall Body (Yellow)
    create_box("LARES_Wall_RearWing", (wB_cx, wB_cy, SKIRT_H + (WALL_H - SKIRT_H) / 2.0), (wB_w, wB_d, WALL_H - SKIRT_H), mat_wall_yellow, root)

    # -----------------------------------------------------------------
    # 2. Main L-Shaped Hipped Roof Structure (Green Metal)
    # -----------------------------------------------------------------
    ROOF_EAVE_Z = WALL_H
    ROOF_PEAK_Z = WALL_H + 2.05 # 5.65m peak
    OVERHANG = 0.65
    
    # 6 Eave Boundary Vertices:
    e_sw = (-29.20 - OVERHANG, -15.28 - OVERHANG, ROOF_EAVE_Z) # 0: Front-Left (SW)
    e_se = ( 23.20 + OVERHANG, -15.28 - OVERHANG, ROOF_EAVE_Z) # 1: Front-Right (SE)
    e_ne = ( 23.20 + OVERHANG,  23.50 + OVERHANG, ROOF_EAVE_Z) # 2: Rear-Right (NE)
    e_nn = ( 13.20 - OVERHANG,  23.50 + OVERHANG, ROOF_EAVE_Z) # 3: Rear-Inner (NN)
    e_ic = ( 13.20 - OVERHANG,  -0.68 + OVERHANG, ROOF_EAVE_Z) # 4: Inside Corner (IC)
    e_nw = (-29.20 - OVERHANG,  -0.68 + OVERHANG, ROOF_EAVE_Z) # 5: Rear-Left (NW)
    
    # 3 Ridge Vertices:
    r_ridge_y = -7.98 # Centerline Y of front wing
    r_ridge_x = 18.20 # Centerline X of vertical rear wing
    
    r_w = (-21.90, r_ridge_y, ROOF_PEAK_Z) # West Hip Peak
    r_j = (r_ridge_x, r_ridge_y, ROOF_PEAK_Z) # Intersection Valley/Hip Junction
    r_n = (r_ridge_x, 18.50, ROOF_PEAK_Z) # North Hip Peak
    
    r_mesh = bpy.data.meshes.new("LARES_MainRoof_Mesh")
    r_obj = bpy.data.objects.new("LARES_MainRoof", r_mesh)
    bpy.context.scene.collection.objects.link(r_obj)
    r_obj.parent = root
    r_obj.data.materials.append(mat_roof_green)
    
    bm_r = bmesh.new()
    verts = [
        bm_r.verts.new(e_sw), # 0
        bm_r.verts.new(e_se), # 1
        bm_r.verts.new(e_ne), # 2
        bm_r.verts.new(e_nn), # 3
        bm_r.verts.new(e_ic), # 4
        bm_r.verts.new(e_nw), # 5
        bm_r.verts.new(r_w),  # 6
        bm_r.verts.new(r_j),  # 7
        bm_r.verts.new(r_n)   # 8
    ]
    
    # Clean, watertight manifold 6-face hipped roof topology:
    bm_r.faces.new((verts[0], verts[6], verts[5]))           # Face 0: West hip capping left wing
    bm_r.faces.new((verts[0], verts[1], verts[7], verts[6])) # Face 1: Front slope along entire front facade
    bm_r.faces.new((verts[5], verts[6], verts[7], verts[4])) # Face 2: Rear-West slope of front wing
    bm_r.faces.new((verts[1], verts[2], verts[8], verts[7])) # Face 3: East slope of vertical rear wing
    bm_r.faces.new((verts[2], verts[3], verts[8]))           # Face 4: North hip capping vertical rear wing
    bm_r.faces.new((verts[3], verts[4], verts[7], verts[8])) # Face 5: Inner courtyard slope & valley
    
    bm_r.to_mesh(r_mesh)
    bm_r.free()

    # Ridge & Hip Caps (Dark Green / Ridge Tiles)
    cap_w, cap_h = 0.22, 0.08
    # Main horizontal ridge
    create_ridge_bar("LARES_Ridge_Horiz", r_w, r_j, cap_w, cap_h, mat_roof_ridge, root)
    # Main vertical ridge
    create_ridge_bar("LARES_Ridge_Vert",  r_j, r_n, cap_w, cap_h, mat_roof_ridge, root)
    # West hips
    create_ridge_bar("LARES_Hip_SW", e_sw, r_w, cap_w, cap_h, mat_roof_ridge, root)
    create_ridge_bar("LARES_Hip_NW", e_nw, r_w, cap_w, cap_h, mat_roof_ridge, root)
    # East-Front hip
    create_ridge_bar("LARES_Hip_SE", e_se, r_j, cap_w, cap_h, mat_roof_ridge, root)
    # North hips
    create_ridge_bar("LARES_Hip_NE", e_ne, r_n, cap_w, cap_h, mat_roof_ridge, root)
    create_ridge_bar("LARES_Hip_NN", e_nn, r_n, cap_w, cap_h, mat_roof_ridge, root)
    # Inside Corner Valley Gutter
    create_ridge_bar("LARES_Valley_IC", e_ic, r_j, cap_w, cap_h, mat_roof_ridge, root)

    # Perimeter Fascia Boards (White) around the roof eaves
    fascia_thick = 0.16
    fascia_h = 0.22
    # Front Fascia
    create_box("LARES_Fascia_Front", ((e_sw[0]+e_se[0])/2.0, e_sw[1], ROOF_EAVE_Z - fascia_h/2.0), (e_se[0]-e_sw[0], fascia_thick, fascia_h), mat_wall_white, root)
    # West Fascia
    create_box("LARES_Fascia_West", (e_sw[0], (e_sw[1]+e_nw[1])/2.0, ROOF_EAVE_Z - fascia_h/2.0), (fascia_thick, e_nw[1]-e_sw[1], fascia_h), mat_wall_white, root)
    # North-West Fascia
    create_box("LARES_Fascia_NorthWest", ((e_nw[0]+e_ic[0])/2.0, e_nw[1], ROOF_EAVE_Z - fascia_h/2.0), (e_ic[0]-e_nw[0], fascia_thick, fascia_h), mat_wall_white, root)
    # Inner-Corner Fascia
    create_box("LARES_Fascia_InnerCorner", (e_ic[0], (e_ic[1]+e_nn[1])/2.0, ROOF_EAVE_Z - fascia_h/2.0), (fascia_thick, e_nn[1]-e_ic[1], fascia_h), mat_wall_white, root)
    # North Fascia
    create_box("LARES_Fascia_North", ((e_nn[0]+e_ne[0])/2.0, e_ne[1], ROOF_EAVE_Z - fascia_h/2.0), (e_ne[0]-e_nn[0], fascia_thick, fascia_h), mat_wall_white, root)
    # East Fascia
    create_box("LARES_Fascia_East", (e_se[0], (e_se[1]+e_ne[1])/2.0, ROOF_EAVE_Z - fascia_h/2.0), (fascia_thick, e_ne[1]-e_se[1], fascia_h), mat_wall_white, root)

    # -----------------------------------------------------------------
    # 3. Outer-Right Lower Roof & Veranda along 3800 (Image 3860 Reference)
    # -----------------------------------------------------------------
    # Runs along the East wall of the vertical wing: X = 23.20m to 26.30m
    # Y runs from -14.00m to 23.20m (length: 37.20m)
    # Attached at Z = 3.08m (under eaves), slopes down to Z = 2.38m at outer edge (X = 26.30m)
    
    vr_x_in  = 23.20
    vr_x_out = 26.30
    vr_y_min = -14.00
    vr_y_max = 23.20
    vr_w = vr_x_out - vr_x_in # 3.10m
    vr_len = vr_y_max - vr_y_min # 37.20m
    vr_z_in = 3.08
    vr_z_out = 2.38
    
    # Raised Veranda Concrete Plinth (Z = 0.0 to 0.25)
    create_box("LARES_Veranda_Plinth", ((vr_x_in + vr_x_out - 0.2)/2.0, (vr_y_min + vr_y_max)/2.0, 0.125), (vr_w - 0.2, vr_len, 0.25), mat_concrete, root)
    
    # Corrugated Lower Roof Sheet (Pitched)
    r_low_mesh = bpy.data.meshes.new("LARES_LowerRoof_Mesh")
    r_low_obj = bpy.data.objects.new("LARES_LowerRoof", r_low_mesh)
    bpy.context.scene.collection.objects.link(r_low_obj)
    r_low_obj.parent = root
    r_low_obj.data.materials.append(mat_roof_lower)
    
    bm_low = bmesh.new()
    lv1 = bm_low.verts.new((vr_x_in,  vr_y_min, vr_z_in))
    lv2 = bm_low.verts.new((vr_x_out, vr_y_min, vr_z_out))
    lv3 = bm_low.verts.new((vr_x_out, vr_y_max, vr_z_out))
    lv4 = bm_low.verts.new((vr_x_in,  vr_y_max, vr_z_in))
    bm_low.faces.new((lv1, lv2, lv3, lv4))
    bm_low.to_mesh(r_low_mesh)
    bm_low.free()

    # Red Structural Steel Trusses & Tubular Steel Posts (Image 3860)
    n_bays = 10
    station_ys = [vr_y_min + i * (vr_len / n_bays) for i in range(n_bays + 1)]
    
    for idx, s_y in enumerate(station_ys):
        # Vertical tubular pipe column on outer edge (X = vr_x_out - 0.08)
        col_x = vr_x_out - 0.08
        col_h = vr_z_out
        create_cylinder(f"LARES_Post_{idx}", (col_x, s_y, col_h / 2.0), 0.045, col_h, mat_pipe_gray, segments=10, parent=root)
        
        # Red triangular angle truss under the roof (Image 3860)
        # Bottom horizontal tie beam
        create_box(f"LARES_TieBeam_{idx}", ((vr_x_in + col_x)/2.0, s_y, vr_z_out - 0.04), (col_x - vr_x_in, 0.06, 0.06), mat_truss_red, root)
        # Diagonal web strut
        mid_x = (vr_x_in + col_x) / 2.0
        create_box(f"LARES_WebStrut_{idx}", (mid_x, s_y, (vr_z_in + vr_z_out)/2.0 - 0.20), (0.05, 0.05, 0.40), mat_truss_red, root)
        
        # Balustrade railing between columns (except at doorway station)
        if idx < n_bays and idx != 6:
            next_y = station_ys[idx + 1]
            mid_bay_y = (s_y + next_y) / 2.0
            bay_len = next_y - s_y
            # Top rail (Z = 0.95m)
            create_box(f"LARES_RailTop_{idx}", (col_x, mid_bay_y, 0.95), (0.04, bay_len, 0.04), mat_pipe_gray, root)
            # Mid rail (Z = 0.55m)
            create_box(f"LARES_RailMid_{idx}", (col_x, mid_bay_y, 0.55), (0.03, bay_len, 0.03), mat_pipe_gray, root)

    # Veranda Doorway & Tiled Entrance Steps at station 6 (Photo 3 under trees)
    door_y = station_ys[6] # around Y = 8.32m
    create_box("LARES_Veranda_DoorFrame", (vr_x_in + 0.02, door_y, 1.30), (0.06, 1.20, 2.10), mat_frame_dark, root)
    create_box("LARES_Veranda_DoorLeaf",  (vr_x_in + 0.02, door_y, 1.30), (0.04, 1.10, 2.00), mat_wall_white, root)
    create_box("LARES_Veranda_Step1", (vr_x_out + 0.40, door_y, 0.08), (1.00, 1.50, 0.16), mat_concrete, root)
    create_box("LARES_Veranda_Step2", (vr_x_out + 0.15, door_y, 0.18), (0.50, 1.50, 0.14), mat_concrete, root)

    # -----------------------------------------------------------------
    # 4. Front-Left Facade & Main LARES Entrance (IMG_3804)
    # -----------------------------------------------------------------
    # Centered at X = -15.73m, matching roads.json entrance node!
    ent_x = -15.73
    front_y = -15.28
    
    # Raised Porch Landing (Z = 0.25m, width 4.60m)
    create_box("LARES_MainEnt_Porch", (ent_x, front_y - 1.10, 0.125), (4.60, 2.20, 0.25), mat_concrete, root)
    
    # Front Entrance Steps (IMG_3804)
    create_box("LARES_MainEnt_Step", (ent_x + 1.15, front_y - 2.40, 0.06), (2.10, 0.50, 0.12), mat_concrete, root)

    # Rectangular Concrete Canopy (IMG_3804)
    canopy_w = 4.60
    canopy_d = 2.20
    canopy_z = 3.35
    create_box("LARES_MainCanopy_Slab", (ent_x, front_y - canopy_d/2.0, canopy_z), (canopy_w, canopy_d, 0.32), mat_wall_white, root)
    
    # Signage Plaque on Canopy Face: "LIPA AGRICULTURAL RESEARCH AND EXPERIMENT STATION (LARES)"
    sign_face_z = canopy_z
    sign_face_y = front_y - canopy_d - 0.02
    create_box("LARES_MainSign_Backer", (ent_x, sign_face_y, sign_face_z), (canopy_w - 0.20, 0.04, 0.24), mat_sign_board, root)
    create_box("LARES_MainSign_TextGreen", (ent_x, sign_face_y - 0.02, sign_face_z), (canopy_w - 0.40, 0.02, 0.12), mat_sign_green, root)
    
    # UNDER CANOPY (IMG_3804):
    # Left side: Large Green Bulletin / Program Board ("Strengthening Agricultural Extension Services...")
    board_x = ent_x - 1.15
    board_z = 1.85
    create_box("LARES_Bulletin_Frame", (board_x, front_y - 0.02, board_z), (1.75, 0.06, 1.20), mat_frame_dark, root)
    create_box("LARES_Bulletin_Face",  (board_x, front_y - 0.03, board_z), (1.68, 0.04, 1.12), mat_bulletin_green, root)
    create_box("LARES_Bulletin_Header",(board_x, front_y - 0.04, board_z + 0.42), (1.60, 0.03, 0.20), mat_bulletin_white, root)

    # Right side: The Entrance Doorway (IMG_3804)
    door1_x = ent_x + 1.10
    door1_w = 1.60
    door1_h = 2.40
    create_box("LARES_MainDoor_Frame", (door1_x, front_y - 0.02, 0.25 + door1_h/2.0), (door1_w, 0.08, door1_h), mat_frame_dark, root)
    create_box("LARES_MainDoor_Glass", (door1_x, front_y - 0.025, 0.25 + door1_h/2.0), (door1_w - 0.14, 0.03, door1_h - 0.12), mat_glass, root)
    create_box("LARES_MainDoor_Poster", (door1_x - 0.15, front_y - 0.035, 0.25 + 1.25), (0.50, 0.02, 0.65), mat_door_poster, root)

    # -----------------------------------------------------------------
    # 5. Front-Right Facade & Secondary Arched Entrance (IMG_3803)
    # -----------------------------------------------------------------
    # Mapped directly to roads.json 2nd entrance node: [121.16642659876118, 13.959105917002347] -> X = 9.10m!
    ent2_x = 9.10
    
    # 1. Wide Concrete Entry Porch Landing & Steps (IMG_3803)
    create_box("LARES_SecEnt_Landing", (ent2_x, front_y - 0.90, 0.125), (4.40, 1.80, 0.25), mat_concrete, root)
    create_box("LARES_SecEnt_Step",    (ent2_x, front_y - 2.05, 0.06),  (3.60, 0.50, 0.12), mat_concrete, root)
    
    # 2. THE BIG DOORWAY (IMG_3803: Wide Commercial Glass Storefront System)
    # Overall dimensions: width 3.80m, height 2.55m
    sw_w = 3.80
    sw_h = 2.55
    sw_z = 0.25 + sw_h / 2.0
    
    # Outer Aluminum Storefront Frame
    create_box("LARES_Storefront_Perimeter", (ent2_x, front_y - 0.02, sw_z), (sw_w, 0.08, sw_h), mat_frame_alum, root)
    
    # Transom Divider Bar across top (at Z = 0.25 + 2.05 = 2.30m)
    transom_z = 0.25 + 2.05
    door_panel_h = 2.05
    transom_h = sw_h - door_panel_h # 0.50m
    create_box("LARES_Storefront_TransomBar", (ent2_x, front_y - 0.025, transom_z), (sw_w - 0.08, 0.06, 0.06), mat_frame_alum, root)
    
    # 3 Top Glass Transom Panels
    t_panel_w = (sw_w - 0.16) / 3.0
    for t_i in range(3):
        tx = ent2_x - (sw_w - 0.16)/2.0 + (t_i + 0.5) * t_panel_w
        create_box(f"LARES_Storefront_TransomGlass_{t_i}", (tx, front_y - 0.025, transom_z + transom_h/2.0), (t_panel_w - 0.04, 0.03, transom_h - 0.06), mat_glass, root)

    # Sidelight Left: Fixed commercial glass window panel (width 0.90m)
    side_w = 0.90
    side_l_x = ent2_x - (sw_w / 2.0) + side_w / 2.0 + 0.04
    create_box("LARES_Storefront_SideL_Frame", (side_l_x, front_y - 0.025, 0.25 + door_panel_h/2.0), (side_w, 0.06, door_panel_h), mat_frame_alum, root)
    create_box("LARES_Storefront_SideL_Glass", (side_l_x, front_y - 0.025, 0.25 + door_panel_h/2.0), (side_w - 0.08, 0.03, door_panel_h - 0.10), mat_glass, root)
    
    # Center Double Commercial Glass Doors (two 0.95m wide doors, total 1.90m)
    door_leaf_w = 0.95
    door_l_x = ent2_x - door_leaf_w / 2.0
    door_r_x = ent2_x + door_leaf_w / 2.0
    # Left Door Leaf
    create_box("LARES_Storefront_DoorL_Frame", (door_l_x, front_y - 0.035, 0.25 + door_panel_h/2.0), (door_leaf_w - 0.02, 0.06, door_panel_h - 0.04), mat_door_stile, root)
    create_box("LARES_Storefront_DoorL_Glass", (door_l_x, front_y - 0.040, 0.25 + door_panel_h/2.0), (door_leaf_w - 0.16, 0.03, door_panel_h - 0.18), mat_glass, root)
    create_box("LARES_Storefront_DoorL_Kick",  (door_l_x, front_y - 0.042, 0.25 + 0.10), (door_leaf_w - 0.04, 0.065, 0.18), mat_door_stile, root)
    create_box("LARES_Storefront_DoorL_Handle", (door_l_x + 0.38, front_y - 0.07, 0.25 + 1.00), (0.04, 0.04, 0.40), mat_pipe_gray, root)
    # Right Door Leaf
    create_box("LARES_Storefront_DoorR_Frame", (door_r_x, front_y - 0.035, 0.25 + door_panel_h/2.0), (door_leaf_w - 0.02, 0.06, door_panel_h - 0.04), mat_door_stile, root)
    create_box("LARES_Storefront_DoorR_Glass", (door_r_x, front_y - 0.040, 0.25 + door_panel_h/2.0), (door_leaf_w - 0.16, 0.03, door_panel_h - 0.18), mat_glass, root)
    create_box("LARES_Storefront_DoorR_Kick",  (door_r_x, front_y - 0.042, 0.25 + 0.10), (door_leaf_w - 0.04, 0.065, 0.18), mat_door_stile, root)
    create_box("LARES_Storefront_DoorR_Handle", (door_r_x - 0.38, front_y - 0.07, 0.25 + 1.00), (0.04, 0.04, 0.40), mat_pipe_gray, root)

    # Sidelight Right: Fixed commercial glass window panel (width 0.90m)
    side_r_x = ent2_x + (sw_w / 2.0) - side_w / 2.0 - 0.04
    create_box("LARES_Storefront_SideR_Frame", (side_r_x, front_y - 0.025, 0.25 + door_panel_h/2.0), (side_w, 0.06, door_panel_h), mat_frame_alum, root)
    create_box("LARES_Storefront_SideR_Glass", (side_r_x, front_y - 0.025, 0.25 + door_panel_h/2.0), (side_w - 0.08, 0.03, door_panel_h - 0.10), mat_glass, root)

    # 3. Arched Green Polycarbonate Canopy (IMG_3803)
    create_arched_canopy("LARES_ArchedCanopy", ent2_x, front_y, depth=1.90, base_z=3.00, width=4.10, rise=0.45, mat_cover=mat_canopy_poly, mat_frame=mat_truss_red, root=root)

    # 4. Authentic Props around Entrance 2 (IMG_3803)
    # AC Compressor unit on wall to left of canopy (IMG_3803)
    create_box("LARES_SecEnt_AC", (5.80, front_y - 0.35, 0.70), (0.80, 0.45, 0.60), mat_ac_metal, root)
    # Blue drum on right side near porch (IMG_3803)
    create_cylinder("LARES_SecEnt_BlueDrum", (11.60, front_y - 0.70, 0.45), 0.30, 0.90, mat_blue_plastic, segments=12, parent=root)
    # Window awning over LARES_Win_FR1 (IMG_3803: red frame with green sheet metal shade)
    create_box("LARES_Win_FR1_Awning", (15.00, front_y - 0.70, 2.85), (5.10, 1.30, 0.06), mat_roof_green, root)
    create_box("LARES_Win_FR1_ArmL",   (12.55, front_y - 0.65, 2.55), (0.05, 1.20, 0.55), mat_truss_red, root)
    create_box("LARES_Win_FR1_ArmR",   (17.45, front_y - 0.65, 2.55), (0.05, 1.20, 0.55), mat_truss_red, root)

    # -----------------------------------------------------------------
    # 6. Window Bays with Security Grilles (IMG_3804, 3803, 3800)
    # -----------------------------------------------------------------
    def add_window_bay(name, x, y, width, height, z_center, rot_y=False):
        if not rot_y:
            create_box(f"{name}_Frame", (x, y - 0.02, z_center), (width, 0.08, height), mat_frame_dark, root)
            create_box(f"{name}_Glass", (x, y - 0.02, z_center), (width - 0.10, 0.04, height - 0.10), mat_glass, root)
            n_bars = max(3, int(width / 0.65))
            for b_i in range(n_bars):
                bx = x - width/2.0 + (b_i + 0.5) * (width / n_bars)
                create_box(f"{name}_Bar_{b_i}", (bx, y - 0.045, z_center), (0.024, 0.024, height - 0.08), mat_grille_white, root)
        else:
            create_box(f"{name}_Frame", (x - 0.02, y, z_center), (0.08, width, height), mat_frame_dark, root)
            create_box(f"{name}_Glass", (x - 0.02, y, z_center), (0.04, width - 0.10, height - 0.10), mat_glass, root)
            n_bars = max(3, int(width / 0.65))
            for b_i in range(n_bars):
                by = y - width/2.0 + (b_i + 0.5) * (width / n_bars)
                create_box(f"{name}_Bar_{b_i}", (x - 0.045, by, z_center), (0.024, 0.024, height - 0.08), mat_grille_white, root)

    win_z = 2.05
    win_h = 1.35
    
    # Front-Left Windows
    add_window_bay("LARES_Win_FL1", -26.00, front_y, 4.00, win_h, win_z)
    add_window_bay("LARES_Win_FL2", -20.80, front_y, 3.60, win_h, win_z)
    
    # Front-Mid Windows (between Entrance 1 at -15.73m and Entrance 2 at 9.10m)
    add_window_bay("LARES_Win_FM1", -10.50, front_y, 4.20, win_h, win_z)
    add_window_bay("LARES_Win_FM2",  -4.50, front_y, 4.60, win_h, win_z)
    add_window_bay("LARES_Win_FM3",   2.40, front_y, 4.80, win_h, win_z)
    
    # Front-Right Windows (between Entrance 2 at 9.10m and Corner at 23.20m)
    add_window_bay("LARES_Win_FR1",  15.00, front_y, 4.80, win_h, win_z)
    add_window_bay("LARES_Win_FR2",  20.80, front_y, 2.80, win_h, win_z)
    
    # Air Conditioning Unit under Window FR3 (IMG_3800)
    ac_x = 20.80
    ac_y = front_y - 0.38
    create_box("LARES_AC_Compressor", (ac_x, ac_y, 0.85), (0.85, 0.45, 0.65), mat_ac_metal, root)
    create_cylinder("LARES_AC_FanGrille", (ac_x, ac_y - 0.24, 0.85), 0.22, 0.04, mat_frame_dark, segments=12, rot=(math.radians(90), 0, 0), parent=root)

    # -----------------------------------------------------------------
    # 7. Far-Left Exterior Flank & Lab Signboards (IMG_3816)
    # -----------------------------------------------------------------
    flank_x = -29.20
    add_window_bay("LARES_Win_Side1", flank_x, -4.50, 3.20, win_h, win_z, rot_y=True)
    add_window_bay("LARES_Win_Side2", flank_x, -11.00, 3.20, win_h, win_z, rot_y=True)
    
    # Signboards on Left Wall (IMG_3816)
    create_box("LARES_Sign_Tricho", (flank_x - 0.05, -7.20, 1.65), (0.04, 1.40, 0.65), mat_sign_board, root)
    create_box("LARES_Sign_TrichoText", (flank_x - 0.08, -7.20, 1.65), (0.02, 1.25, 0.20), mat_sign_green, root)
    create_box("LARES_Sign_Tissue", (flank_x - 0.05, -2.20, 2.05), (0.04, 1.30, 0.50), mat_sign_board, root)
    
    # Blue Rainwater Drum Asset (IMG_3816)
    drum_x = flank_x - 0.45
    drum_y = -7.80
    create_cylinder("LARES_Drum_Plastic", (drum_x, drum_y, 0.50), 0.32, 1.00, mat_blue_plastic, segments=14, parent=root)
    create_cylinder("LARES_Drum_Rim",     (drum_x, drum_y, 0.98), 0.33, 0.05, mat_frame_dark, segments=14, parent=root)

    # -----------------------------------------------------------------
    # 8. Rear Corridor Door & Pathway Connection to Cguard & Annexes (Ground-Truth Photo)
    # -----------------------------------------------------------------
    # Pathway road_1 crosses the North/rear wall of the front wing at X = -15.87m, Y = -0.68m
    # Connecting directly from the front main entrance corridor out to Cguard, ILD, and F2C2.
    rear_door_x = -15.87
    rear_wall_y = -0.68
    
    # 1. Raised Tiled Landing Porch (Photo: Slate green tile surface, elevated concrete plinth, no excess walkway square)
    mat_tile_slate = create_mat("LARES_SlateTile", (0.34, 0.44, 0.38), roughness=0.60)
    landing_w = 2.50
    landing_d = 1.80
    landing_h = 0.28
    # Concrete plinth
    create_box("LARES_RearEnt_Plinth", (rear_door_x, rear_wall_y + landing_d/2.0, landing_h/2.0), (landing_w, landing_d, landing_h), mat_concrete, root)
    # Slate green tile surface cap
    create_box("LARES_RearEnt_Tiles", (rear_door_x, rear_wall_y + landing_d/2.0, landing_h + 0.01), (landing_w - 0.06, landing_d - 0.06, 0.02), mat_tile_slate, root)
    
    # 2. Stainless Steel Safety Railing on Right Edge of Landing (Photo: Right-hand safety rail)
    rail_x = rear_door_x + landing_w/2.0 - 0.06
    rail_y1 = rear_wall_y + 0.30
    rail_y2 = rear_wall_y + landing_d - 0.15
    rail_mid_y = (rail_y1 + rail_y2) / 2.0
    rail_len = rail_y2 - rail_y1
    # Vertical posts
    create_cylinder("LARES_RearRail_Post1", (rail_x, rail_y1, landing_h + 0.42), 0.025, 0.85, mat_pipe_gray, segments=8, parent=root)
    create_cylinder("LARES_RearRail_Post2", (rail_x, rail_y2, landing_h + 0.42), 0.025, 0.85, mat_pipe_gray, segments=8, parent=root)
    # Top & Mid horizontal rails
    create_box("LARES_RearRail_Top", (rail_x, rail_mid_y, landing_h + 0.85), (0.04, rail_len, 0.04), mat_pipe_gray, root)
    create_box("LARES_RearRail_Mid", (rail_x, rail_mid_y, landing_h + 0.45), (0.03, rail_len, 0.03), mat_pipe_gray, root)

    # 3. Flanking Concrete Pilasters framing doorway bay
    create_box("LARES_RearPilaster_L", (rear_door_x - 1.05, rear_wall_y + 0.10, WALL_H / 2.0), (0.35, 0.25, WALL_H), mat_wall_yellow, root)
    create_box("LARES_RearPilaster_R", (rear_door_x + 1.05, rear_wall_y + 0.10, WALL_H / 2.0), (0.35, 0.25, WALL_H), mat_wall_yellow, root)

    # 4. Double Commercial Glass Exit Doors (Photo: Double swing aluminum glass doors)
    rd_w = 1.70
    rd_h = 2.30
    rd_z = landing_h + rd_h / 2.0
    # Outer Frame
    create_box("LARES_RearDoor_Frame", (rear_door_x, rear_wall_y + 0.02, rd_z), (rd_w, 0.08, rd_h), mat_frame_alum, root)
    # Left Door Leaf
    rd_leaf_w = rd_w / 2.0 - 0.03
    rd_l_x = rear_door_x - rd_w/4.0
    rd_r_x = rear_door_x + rd_w/4.0
    create_box("LARES_RearDoor_L_Stile", (rd_l_x, rear_wall_y + 0.03, rd_z), (rd_leaf_w, 0.05, rd_h - 0.06), mat_door_stile, root)
    create_box("LARES_RearDoor_L_Glass", (rd_l_x, rear_wall_y + 0.03, rd_z), (rd_leaf_w - 0.14, 0.02, rd_h - 0.20), mat_glass, root)
    create_box("LARES_RearDoor_L_Handle", (rd_l_x + rd_leaf_w/2.0 - 0.06, rear_wall_y + 0.06, landing_h + 1.05), (0.03, 0.04, 0.35), mat_pipe_gray, root)
    # Right Door Leaf
    create_box("LARES_RearDoor_R_Stile", (rd_r_x, rear_wall_y + 0.03, rd_z), (rd_leaf_w, 0.05, rd_h - 0.06), mat_door_stile, root)
    create_box("LARES_RearDoor_R_Glass", (rd_r_x, rear_wall_y + 0.03, rd_z), (rd_leaf_w - 0.14, 0.02, rd_h - 0.20), mat_glass, root)
    create_box("LARES_RearDoor_R_Handle", (rd_r_x - rd_leaf_w/2.0 + 0.06, rear_wall_y + 0.06, landing_h + 1.05), (0.03, 0.04, 0.35), mat_pipe_gray, root)

    # 5. Wall-Mounted Carrier AC Outdoor Unit to the right of doorway (Photo)
    ac_rear_x = rear_door_x + 1.55
    ac_rear_y = rear_wall_y + 0.35
    ac_rear_z = 2.45
    # Wall brackets
    create_box("LARES_RearAC_BracketL", (ac_rear_x - 0.30, rear_wall_y + 0.15, ac_rear_z - 0.35), (0.04, 0.32, 0.25), mat_pipe_gray, root)
    create_box("LARES_RearAC_BracketR", (ac_rear_x + 0.30, rear_wall_y + 0.15, ac_rear_z - 0.35), (0.04, 0.32, 0.25), mat_pipe_gray, root)
    # Compressor Box
    create_box("LARES_RearAC_Unit", (ac_rear_x, ac_rear_y, ac_rear_z), (0.80, 0.38, 0.58), mat_ac_metal, root)
    # Circular Fan Grille
    create_cylinder("LARES_RearAC_Fan", (ac_rear_x - 0.08, ac_rear_y + 0.20, ac_rear_z), 0.20, 0.03, mat_frame_dark, segments=12, rot=(math.radians(90), 0, 0), parent=root)

    # 6. Flush Ceiling Ventilation Louver under eaves above door (Photo)
    create_box("LARES_Rear_CeilingVent", (rear_door_x, rear_wall_y + 0.15, WALL_H - 0.12), (0.80, 0.35, 0.04), mat_frame_dark, root)

    # 7. Rear Windows with security grilles flanking entrance
    add_window_bay("LARES_Win_RearL", rear_door_x - 2.80, rear_wall_y, 2.60, win_h, win_z)
    add_window_bay("LARES_Win_RearR", rear_door_x + 3.10, rear_wall_y, 2.60, win_h, win_z)

    # -----------------------------------------------------------------
    # 9. WebGL GLB Export
    # -----------------------------------------------------------------
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    
    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\lares_building.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"Exported Rebuilt LARES Building GLB to {glb_out} (Size: {file_size_kb:.1f} KB)")
    return root

build_lares_building()
