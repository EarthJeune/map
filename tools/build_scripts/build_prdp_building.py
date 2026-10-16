"""
build_prdp_building.py — Authentic Bespoke 3D Model of the DA-LARES PRDP Building
(Philippine Rural Development Project Scale-Up | Regional Project Coordination Office 4A)

Ground-truth references:
1. IMG_3801 (Front Elevation, short SSE end facing the roads.json entrance node):
   - 1-storey white-painted concrete office, maroon/oxblood skirting base
   - Single dark-framed entrance door, slightly left of centre, with a pilaster on its left
   - White PRDP signboard above the door:
       DEPARTMENT OF AGRICULTURE
       PHILIPPINE RURAL DEVELOPMENT PROJECT
       SCALE-UP | Regional Project Coordination Office 4A
     with DA seal on the left and PRDP chevron logos at both ends
   - Two wide 3-panel windows with dark frames and brick-pattern steel security grilles
   - Galvanised grey corrugated HIP roof with dark green fascia trim and white soffit
2. IMG_3802 (Left / WSW long elevation):
   - Long 7-bay elevation with projecting pilasters, one grilled window per bay
   - Front bay painted white, the remaining bays painted warm cream
   - Split-type AC condensers + window-type AC units mounted on the wall
   - Continuous maroon skirting base

Orientation: front entrance facade along -Y (Mapbox rotation = facade normal - 180).
Footprint (roads.json polygon, roof outline): ~14.2 m x 28.7 m.
Pure architecture only — ZERO outdoor props.
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def create_mat(name, color, roughness=0.7, metallic=0.0, specular=0.5):
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    out = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (*color[:3], 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = specular
    elif 'Specular' in bsdf.inputs:
        bsdf.inputs['Specular'].default_value = specular
    mat.node_tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat


def create_box(name, loc, size, mat, parent=None, rot=(0, 0, 0)):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(mesh)
    bm.free()
    obj.location = loc
    obj.scale = size
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def create_cylinder(name, loc, radius, height, mat, segments=16, rot=(0, 0, 0), parent=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=height)
    bm.to_mesh(mesh)
    bm.free()
    obj.location = loc
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def create_text_mesh(name, loc, text, size, mat, rot=(0, 0, 0), parent=None, align='CENTER'):
    """Flat (zero-extrude, low resolution) text to keep the GLB inside the 300 KB budget."""
    c_data = bpy.data.curves.new(name=name + "_Data", type='FONT')
    c_data.body = text
    c_data.size = size
    c_data.extrude = 0.0
    c_data.resolution_u = 1
    c_data.align_x = align
    c_data.align_y = 'CENTER'
    obj = bpy.data.objects.new(name, c_data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return obj


def create_quads(name, rects, plane, coord, outward, mat, parent=None):
    """Batch of flat single-sided quads on a facade plane (cheap detail: grilles, frames, glass).
    plane 'XZ': rect = (x0, x1, z0, z1) at y = coord ; outward = -1 faces -Y, +1 faces +Y
    plane 'YZ': rect = (y0, y1, z0, z1) at x = coord ; outward = -1 faces -X, +1 faces +X
    """
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    for (u0, u1, z0, z1) in rects:
        if plane == 'XZ':
            pts = [(u0, coord, z0), (u1, coord, z0), (u1, coord, z1), (u0, coord, z1)]
        else:
            pts = [(coord, u0, z0), (coord, u1, z0), (coord, u1, z1), (coord, u0, z1)]
        bm.faces.new([bm.verts.new(p) for p in pts])
    bm.normal_update()
    for f in bm.faces:
        comp = f.normal.y if plane == 'XZ' else f.normal.x
        if comp * outward < 0:
            f.normal_flip()
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def create_hip_roof(name, hx, hy, z_eave, z_ridge, mat_top, mat_soffit, parent=None):
    """Closed hip-roof solid: 2 trapezoids + 2 hip triangles + flat soffit underside."""
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    rh = max(hy - hx, 0.0)
    v0 = bm.verts.new((-hx, -hy, z_eave))
    v1 = bm.verts.new((hx, -hy, z_eave))
    v2 = bm.verts.new((hx, hy, z_eave))
    v3 = bm.verts.new((-hx, hy, z_eave))
    r0 = bm.verts.new((0, -rh, z_ridge))
    r1 = bm.verts.new((0, rh, z_ridge))
    bm.faces.new((v0, v1, r0))          # front hip
    bm.faces.new((v1, v2, r1, r0))      # right slope
    bm.faces.new((v2, v3, r1))          # rear hip
    bm.faces.new((v3, v0, r0, r1))      # left slope
    soffit = bm.faces.new((v3, v2, v1, v0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    soffit.material_index = 1
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mat_top)
    obj.data.materials.append(mat_soffit)
    if parent:
        obj.parent = parent
    return obj, rh


def create_beam_between(name, p0, p1, w, h, mat, parent=None):
    """Box beam spanning two 3D points (used for hip/ridge caps)."""
    a, b = Vector(p0), Vector(p1)
    d = b - a
    obj = create_box(name, (a + b) / 2.0, (d.length, w, h), mat, parent)
    obj.rotation_euler = d.to_track_quat('X', 'Z').to_euler()
    return obj


def window_rects(u_c, z0, width, height, panels, rows, frame_t=0.06, bar_t=0.022):
    """Return (glass, frames, grille) rect lists for a dark-framed window with
    a brick-pattern steel security grille (IMG_3801 / IMG_3802)."""
    u0, u1 = u_c - width / 2.0, u_c + width / 2.0
    z1 = z0 + height
    glass = [(u0, u1, z0, z1)]
    frames = [
        (u0 - frame_t, u1 + frame_t, z1, z1 + frame_t),
        (u0 - frame_t, u1 + frame_t, z0 - frame_t, z0),
        (u0 - frame_t, u0, z0, z1),
        (u1, u1 + frame_t, z0, z1),
    ]
    pw = width / panels
    for p in range(1, panels):
        x = u0 + p * pw
        frames.append((x - frame_t / 2.0, x + frame_t / 2.0, z0, z1))
    grille = []
    rh = height / rows
    for r in range(1, rows):
        z = z0 + r * rh
        grille.append((u0, u1, z - bar_t / 2.0, z + bar_t / 2.0))
    # staggered vertical stubs -> brick pattern
    for r in range(rows):
        za, zb = z0 + r * rh, z0 + (r + 1) * rh
        for p in range(panels):
            pa = u0 + p * pw
            fracs = (0.5,) if r % 2 == 0 else (0.25, 0.75)
            for fr in fracs:
                x = pa + fr * pw
                grille.append((x - bar_t / 2.0, x + bar_t / 2.0, za, zb))
    return glass, frames, grille


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------
def build_prdp_building():
    print("=====================================================================")
    print(" Building Authentic PRDP Building (IMG_3801 front / IMG_3802 side)   ")
    print("=====================================================================")

    for obj in list(bpy.data.objects):
        if obj.type in ['MESH', 'CURVE', 'FONT', 'LIGHT', 'EMPTY', 'CAMERA']:
            bpy.data.objects.remove(obj, do_unlink=True)

    root = bpy.data.objects.new("PRDP_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # --- Materials (calibrated from photos) ---
    mat_wall_white = create_mat("Mat_PRDP_WallWhite", (0.86, 0.87, 0.85), roughness=0.88)
    mat_wall_cream = create_mat("Mat_PRDP_WallCream", (0.90, 0.82, 0.58), roughness=0.88)
    mat_maroon     = create_mat("Mat_PRDP_Maroon",    (0.42, 0.10, 0.09), roughness=0.80)
    mat_tile       = create_mat("Mat_PRDP_Tile",      (0.80, 0.74, 0.66), roughness=0.45)
    mat_frame      = create_mat("Mat_PRDP_Frame",     (0.10, 0.09, 0.09), roughness=0.55, metallic=0.4)
    mat_door_frame = create_mat("Mat_PRDP_DoorFrame", (0.20, 0.13, 0.10), roughness=0.60)
    mat_glass      = create_mat("Mat_PRDP_Glass",     (0.13, 0.15, 0.17), roughness=0.15, metallic=0.35, specular=0.9)
    mat_grille     = create_mat("Mat_PRDP_Grille",    (0.16, 0.16, 0.17), roughness=0.50, metallic=0.6)
    mat_interior   = create_mat("Mat_PRDP_Interior",  (0.07, 0.07, 0.08), roughness=0.90)
    mat_roof       = create_mat("Mat_PRDP_RoofGalv",  (0.56, 0.59, 0.61), roughness=0.42, metallic=0.65)
    mat_ridge      = create_mat("Mat_PRDP_RidgeCap",  (0.45, 0.48, 0.50), roughness=0.45, metallic=0.6)
    mat_fascia     = create_mat("Mat_PRDP_Fascia",    (0.07, 0.24, 0.17), roughness=0.60)
    mat_soffit     = create_mat("Mat_PRDP_Soffit",    (0.90, 0.90, 0.88), roughness=0.85)
    mat_sign_bg    = create_mat("Mat_PRDP_SignBG",    (0.95, 0.95, 0.94), roughness=0.40)
    mat_sign_text  = create_mat("Mat_PRDP_SignText",  (0.10, 0.14, 0.24), roughness=0.50)
    mat_logo_teal  = create_mat("Mat_PRDP_LogoTeal",  (0.05, 0.42, 0.45), roughness=0.45)
    mat_logo_orng  = create_mat("Mat_PRDP_LogoOrange",(0.90, 0.48, 0.12), roughness=0.45)
    mat_logo_navy  = create_mat("Mat_PRDP_LogoNavy",  (0.08, 0.12, 0.30), roughness=0.45)
    mat_da_green   = create_mat("Mat_PRDP_DAGreen",   (0.08, 0.38, 0.16), roughness=0.45)
    mat_da_gold    = create_mat("Mat_PRDP_DAGold",    (0.86, 0.70, 0.20), roughness=0.35, metallic=0.5)
    mat_ac         = create_mat("Mat_PRDP_ACUnit",    (0.86, 0.87, 0.86), roughness=0.45, metallic=0.2)
    mat_ac_dark    = create_mat("Mat_PRDP_ACDark",    (0.12, 0.12, 0.13), roughness=0.60)

    # --- Dimensions ---
    W, D = 12.60, 27.00             # wall footprint (roof outline ~14.3 x 28.7 matches polygon)
    hx_w, hy_w = W / 2.0, D / 2.0
    front_y, rear_y = -hy_w, hy_w
    FLOOR_Z = 0.35                  # raised floor level
    BASE_H = 0.45                   # maroon skirting height
    EAVE_Z = 3.35                   # wall top / soffit level
    OVERHANG = 0.85
    RIDGE_Z = EAVE_Z + 2.60         # ~20 deg hip pitch
    N_BAYS = 7
    BAY = D / N_BAYS                # ~3.86 m structural bays (IMG_3802)

    # --- 1. Wall body: front bay white, remainder cream (IMG_3802) ---
    white_y1 = front_y + BAY
    create_box("PRDP_Walls_FrontBay", (0, (front_y + white_y1) / 2.0, EAVE_Z / 2.0),
               (W, BAY, EAVE_Z), mat_wall_white, root)
    create_box("PRDP_Walls_Rear", (0, (white_y1 + rear_y) / 2.0, EAVE_Z / 2.0),
               (W, rear_y - white_y1, EAVE_Z), mat_wall_cream, root)

    # Maroon skirting plinth (proud of pilasters)
    create_box("PRDP_Maroon_Base", (0, 0, BASE_H / 2.0), (W + 0.28, D + 0.28, BASE_H), mat_maroon, root)

    # --- 2. Pilasters ---
    pil_h = EAVE_Z - BASE_H
    pil_z = BASE_H + pil_h / 2.0
    for side, sx in (("W", -1), ("E", 1)):
        for i in range(N_BAYS + 1):
            y = front_y + i * BAY
            y = min(max(y, front_y + 0.15), rear_y - 0.15)
            m = mat_wall_white if i <= 1 else mat_wall_cream
            create_box(f"PRDP_Pilaster_{side}_{i}", (sx * (hx_w + 0.05), y, pil_z), (0.12, 0.32, pil_h), m, root)
    # Front facade: corner returns + pilaster left of the door (IMG_3801)
    for x in (-hx_w + 0.15, hx_w - 0.15, -1.30):
        create_box(f"PRDP_FrontPilaster_{x:+.2f}", (x, front_y - 0.05, pil_z), (0.32, 0.12, pil_h), mat_wall_white, root)
    for x in (-hx_w + 0.15, -2.10, 2.10, hx_w - 0.15):
        create_box(f"PRDP_RearPilaster_{x:+.2f}", (x, rear_y + 0.05, pil_z), (0.32, 0.12, pil_h), mat_wall_cream, root)

    # --- 3. Front facade openings (IMG_3801) ---
    yf_glass, yf_grille, yf_frame = front_y - 0.012, front_y - 0.028, front_y - 0.040
    win_z0, win_h = 1.15, 1.45      # window heads align with door head (IMG_3801)
    glass_r, frame_r, grille_r = [], [], []
    for xc in (-3.35, 3.45):
        g, f, gr = window_rects(xc, win_z0, 3.00, win_h, panels=3, rows=7)
        glass_r += g; frame_r += f; grille_r += gr

    # Entrance door (single dark frame, open doorway look)
    door_xc, door_w, door_top = 0.0, 1.50, 2.60
    interior_r = [(door_xc - door_w / 2.0, door_xc + door_w / 2.0, FLOOR_Z, door_top)]
    dft = 0.09
    door_frame_r = [
        (door_xc - door_w / 2.0 - dft, door_xc + door_w / 2.0 + dft, door_top, door_top + dft),
        (door_xc - door_w / 2.0 - dft, door_xc - door_w / 2.0, FLOOR_Z, door_top),
        (door_xc + door_w / 2.0, door_xc + door_w / 2.0 + dft, FLOOR_Z, door_top),
        (door_xc - 0.05, door_xc + 0.05, FLOOR_Z, door_top),  # meeting stile of the twin leaves
    ]
    # Open white door leaf visible inside (IMG_3801) + notice
    leaf_r = [(door_xc + 0.10, door_xc + 0.62, FLOOR_Z + 0.05, door_top - 0.08)]

    create_quads("PRDP_Front_Glass", glass_r, 'XZ', yf_glass, -1, mat_glass, root)
    create_quads("PRDP_Front_Interior", interior_r, 'XZ', yf_glass, -1, mat_interior, root)
    create_quads("PRDP_Front_DoorLeaf", leaf_r, 'XZ', yf_grille, -1, mat_wall_white, root)
    create_quads("PRDP_Front_Grilles", grille_r, 'XZ', yf_grille, -1, mat_grille, root)
    create_quads("PRDP_Front_Frames", frame_r, 'XZ', yf_frame, -1, mat_frame, root)
    create_quads("PRDP_Front_DoorFrame", door_frame_r, 'XZ', yf_frame, -1, mat_door_frame, root)
    # "NO SMOKING" placard right of door
    create_quads("PRDP_NoSmoking", [(1.05, 1.33, 1.45, 1.80)], 'XZ', yf_frame, -1, mat_sign_bg, root)

    # Entrance stoop (maroon riser + tiled tread)
    create_box("PRDP_Stoop_Riser", (door_xc, front_y - 0.45, 0.15), (2.30, 0.90, 0.30), mat_maroon, root)
    create_box("PRDP_Stoop_Tile", (door_xc, front_y - 0.42, 0.325), (2.10, 0.84, 0.05), mat_tile, root)

    # --- 4. PRDP signboard above the door (IMG_3801) ---
    sign_x0, sign_x1 = -1.15, 2.15
    sign_z0, sign_z1 = 2.70, 3.24
    sign_xc, sign_zc = (sign_x0 + sign_x1) / 2.0, (sign_z0 + sign_z1) / 2.0
    sign_face_y = front_y - 0.07
    create_box("PRDP_Sign_Panel", (sign_xc, front_y - 0.035, sign_zc),
               (sign_x1 - sign_x0, 0.07, sign_z1 - sign_z0), mat_sign_bg, root)
    txt_rot = (math.radians(90), 0, 0)
    txt_y = sign_face_y - 0.006
    text_x = -0.30
    create_text_mesh("PRDP_Text_L1", (text_x, txt_y, 3.13), "DEPARTMENT OF AGRICULTURE", 0.070, mat_sign_text, txt_rot, root, 'LEFT')
    create_text_mesh("PRDP_Text_L2", (text_x, txt_y, 3.00), "PHILIPPINE RURAL DEVELOPMENT PROJECT", 0.092, mat_sign_text, txt_rot, root, 'LEFT')
    create_text_mesh("PRDP_Text_L3", (text_x, txt_y, 2.86), "SCALE-UP | Regional Project Coordination Office 4A", 0.068, mat_sign_text, txt_rot, root, 'LEFT')
    # DA seal + partner seal (left of text)
    for i, sx in enumerate((-0.62, -0.42)):
        create_cylinder(f"PRDP_Seal_Ring_{i}", (sx, sign_face_y - 0.004, sign_zc), 0.10, 0.008,
                        mat_da_green, 16, rot=txt_rot, parent=root)
        create_cylinder(f"PRDP_Seal_Core_{i}", (sx, sign_face_y - 0.010, sign_zc), 0.065, 0.008,
                        mat_da_gold if i == 0 else mat_logo_teal, 12, rot=txt_rot, parent=root)
    # PRDP chevron/triangle logos at both ends
    tri_specs = [((-1.00, 2.84), mat_logo_teal), ((-0.90, 2.84), mat_logo_orng),
                 ((1.88, 3.08), mat_logo_navy), ((2.00, 3.08), mat_logo_teal)]
    for i, ((tx, tz), tm) in enumerate(tri_specs):
        create_cylinder(f"PRDP_Logo_Tri_{i}", (tx, sign_face_y - 0.004, tz), 0.08, 0.008, tm, 3,
                        rot=(math.radians(90), 0, math.radians(0)), parent=root)

    # --- 5. Long side elevations: 1 grilled window per bay (IMG_3802) ---
    side_z0, side_h = 1.20, 1.30
    for side, sx in (("W", -1), ("E", 1)):
        plane_x = sx * hx_w
        g_all, f_all, gr_all = [], [], []
        for i in range(N_BAYS):
            yc = front_y + (i + 0.5) * BAY
            wdt = 1.90 if i == 0 else 1.60
            g, f, gr = window_rects(yc, side_z0, wdt, side_h, panels=2, rows=6)
            g_all += g; f_all += f; gr_all += gr
        create_quads(f"PRDP_Side{side}_Glass", g_all, 'YZ', plane_x + sx * 0.012, sx, mat_glass, root)
        create_quads(f"PRDP_Side{side}_Grilles", gr_all, 'YZ', plane_x + sx * 0.028, sx, mat_grille, root)
        create_quads(f"PRDP_Side{side}_Frames", f_all, 'YZ', plane_x + sx * 0.040, sx, mat_frame, root)

    # --- 6. Rear elevation windows ---
    g_all, f_all, gr_all = [], [], []
    for xc in (-4.20, 0.0, 4.20):
        g, f, gr = window_rects(xc, side_z0, 1.60, side_h, panels=2, rows=6)
        g_all += g; f_all += f; gr_all += gr
    create_quads("PRDP_Rear_Glass", g_all, 'XZ', rear_y + 0.012, 1, mat_glass, root)
    create_quads("PRDP_Rear_Grilles", gr_all, 'XZ', rear_y + 0.028, 1, mat_grille, root)
    create_quads("PRDP_Rear_Frames", f_all, 'XZ', rear_y + 0.040, 1, mat_frame, root)

    # --- 7. Wall-mounted AC units on the WSW elevation (IMG_3802) ---
    wx = -hx_w
    for i, yc in enumerate((front_y + BAY + 0.55, front_y + BAY + 1.45)):
        cz = 1.00
        create_box(f"PRDP_SplitAC_{i}", (wx - 0.30, yc, cz), (0.30, 0.82, 0.58), mat_ac, root)
        create_cylinder(f"PRDP_SplitAC_Fan_{i}", (wx - 0.455, yc - 0.10, cz), 0.21, 0.01, mat_ac_dark, 14,
                        rot=(0, math.radians(90), 0), parent=root)
        create_box(f"PRDP_SplitAC_Bracket_{i}", (wx - 0.22, yc, cz - 0.33), (0.45, 0.70, 0.04), mat_ac_dark, root)
    # Window-type AC units protruding from bay windows
    for i, bay_i in enumerate((2, 4)):
        yc = front_y + (bay_i + 0.5) * BAY + 0.35
        create_box(f"PRDP_WindowAC_{i}", (wx - 0.22, yc, side_z0 + 0.25), (0.45, 0.62, 0.42), mat_ac, root)
        create_quads(f"PRDP_WindowAC_Grille_{i}", [(yc - 0.25, yc + 0.25, side_z0 + 0.08, side_z0 + 0.42)],
                     'YZ', wx - 0.448, -1, mat_ac_dark, root)

    # --- 8. Galvanised corrugated hip roof with green fascia (IMG_3801 / IMG_3802) ---
    rhx, rhy = hx_w + OVERHANG, hy_w + OVERHANG
    _, ridge_half = create_hip_roof("PRDP_Roof", rhx, rhy, EAVE_Z, RIDGE_Z, mat_roof, mat_soffit, root)

    # Fascia band wrapping the eaves
    f_h, f_t = 0.26, 0.06
    f_z = EAVE_Z - 0.06
    create_box("PRDP_Fascia_Front", (0, -rhy - f_t / 2.0, f_z), (2 * rhx + 2 * f_t, f_t, f_h), mat_fascia, root)
    create_box("PRDP_Fascia_Rear", (0, rhy + f_t / 2.0, f_z), (2 * rhx + 2 * f_t, f_t, f_h), mat_fascia, root)
    create_box("PRDP_Fascia_W", (-rhx - f_t / 2.0, 0, f_z), (f_t, 2 * rhy, f_h), mat_fascia, root)
    create_box("PRDP_Fascia_E", (rhx + f_t / 2.0, 0, f_z), (f_t, 2 * rhy, f_h), mat_fascia, root)

    # Ridge + hip caps
    cap_z = 0.04
    create_beam_between("PRDP_RidgeCap", (0, -ridge_half, RIDGE_Z + cap_z), (0, ridge_half, RIDGE_Z + cap_z), 0.30, 0.08, mat_ridge, root)
    for i, (cx, cy, ry) in enumerate(((-rhx, -rhy, -ridge_half), (rhx, -rhy, -ridge_half),
                                      (rhx, rhy, ridge_half), (-rhx, rhy, ridge_half))):
        create_beam_between(f"PRDP_HipCap_{i}", (cx, cy, EAVE_Z + cap_z), (0, ry, RIDGE_Z + cap_z), 0.26, 0.07, mat_ridge, root)

    # Corrugation hint: subtle raised ribs on the two long slopes (few long strips only)
    slope_dz = RIDGE_Z - EAVE_Z
    for side, sx in (("W", -1), ("E", 1)):
        for k in range(1, 6):
            t = k / 6.0
            x = sx * rhx * (1 - t)
            z = EAVE_Z + slope_dz * t + 0.012
            half = ridge_half + (rhy - ridge_half) * (1 - t)
            create_beam_between(f"PRDP_Rib_{side}_{k}", (x, -half, z), (x, half, z), 0.05, 0.02, mat_ridge, root)

    # --- 9. Export ---
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\prdp_building.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=False,
    )
    size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"Exported PRDP Building GLB to {glb_out} (Size: {size_kb:.1f} KB)")
    return root


build_prdp_building()
