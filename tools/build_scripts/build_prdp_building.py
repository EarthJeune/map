"""
build_prdp_building.py — Authentic Unified 3D Model of the DA-LARES PRDP Building (Western Half)
Part of the unified PRDP + LARES Agricultural Supplies Storage complex.

Shared Reference:
- Origin: [121.16692287, 13.95933876]
- Mapbox rotation: 341.9 deg
- Local Y-axis: runs along bearing 342.4° (Y < 0 is South towards entrance_16, Y > 0 is North towards Storage).
- Local X-axis: runs along bearing 72.4° (X > 0 faces road_1, X < 0 faces rear trees).
- Shared seam: at Y = +8.35m.
- PRDP bounds: Y in [-8.35, +8.35], X in [-5.50, +5.50].
- Roof: Freshly painted vibrant emerald green (#124729) corrugated hip roof.
  Continuous horizontal main ridge at X = 0, Z = 5.80m running cleanly all the way to Y = +8.35m.
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector

def create_mat(name, color, roughness=0.7, metallic=0.0, specular=0.5):
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

def window_rects(u_c, z0, width, height, panels, rows, frame_t=0.06, bar_t=0.022):
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
    dz = height / (rows + 1)
    for r in range(1, rows + 1):
        y = z0 + r * dz
        grille.append((u0, u1, y - bar_t / 2.0, y + bar_t / 2.0))
    dx = width / 6.0
    for c in range(1, 6):
        x = u0 + c * dx
        grille.append((x - bar_t / 2.0, x + bar_t / 2.0, z0, z1))
    return glass, frames, grille

def build_prdp_building():
    print("=====================================================================")
    print(" Building Calibrated Unified PRDP Building (+X Facing Road)          ")
    print("=====================================================================")

    for obj in list(bpy.data.objects):
        if obj.type in ['MESH', 'CURVE', 'FONT', 'LIGHT', 'EMPTY', 'CAMERA']:
            bpy.data.objects.remove(obj, do_unlink=True)

    root = bpy.data.objects.new("PRDP_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # --- Materials ---
    mat_wall_cream = create_mat("Mat_PRDP_WallCream", (0.91, 0.85, 0.65), roughness=0.88)
    mat_maroon     = create_mat("Mat_PRDP_Maroon",    (0.40, 0.12, 0.15), roughness=0.80)
    mat_tile       = create_mat("Mat_PRDP_Tile",      (0.80, 0.74, 0.66), roughness=0.45)
    mat_frame      = create_mat("Mat_PRDP_Frame",     (0.10, 0.09, 0.09), roughness=0.55, metallic=0.4)
    mat_door_frame = create_mat("Mat_PRDP_DoorFrame", (0.20, 0.13, 0.10), roughness=0.60)
    mat_glass      = create_mat("Mat_PRDP_Glass",     (0.13, 0.15, 0.17), roughness=0.15, metallic=0.35, specular=0.9)
    mat_grille     = create_mat("Mat_PRDP_Grille",    (0.16, 0.16, 0.17), roughness=0.50, metallic=0.6)
    mat_interior   = create_mat("Mat_PRDP_Interior",  (0.07, 0.07, 0.08), roughness=0.90)

    # Fresh vibrant emerald-green corrugated hip roof
    mat_roof       = create_mat("Mat_PRDP_RoofEmerald", (0.07, 0.28, 0.16), roughness=0.52, metallic=0.25)
    mat_ridge      = create_mat("Mat_PRDP_RidgeCap",    (0.06, 0.24, 0.14), roughness=0.48, metallic=0.30)
    mat_fascia     = create_mat("Mat_PRDP_Fascia",      (0.05, 0.20, 0.12), roughness=0.60)
    mat_soffit     = create_mat("Mat_PRDP_Soffit",      (0.92, 0.92, 0.90), roughness=0.85)

    mat_sign_bg    = create_mat("Mat_PRDP_SignBG",    (0.95, 0.95, 0.94), roughness=0.40)
    mat_sign_text  = create_mat("Mat_PRDP_SignText",  (0.10, 0.14, 0.24), roughness=0.50)
    mat_logo_teal  = create_mat("Mat_PRDP_LogoTeal",  (0.05, 0.42, 0.45), roughness=0.45)
    mat_logo_orng  = create_mat("Mat_PRDP_LogoOrange",(0.90, 0.48, 0.12), roughness=0.45)
    mat_logo_navy  = create_mat("Mat_PRDP_LogoNavy",  (0.08, 0.12, 0.30), roughness=0.45)
    mat_da_green   = create_mat("Mat_PRDP_DAGreen",   (0.08, 0.38, 0.16), roughness=0.45)
    mat_da_gold    = create_mat("Mat_PRDP_DAGold",    (0.86, 0.70, 0.20), roughness=0.35, metallic=0.5)
    mat_ac         = create_mat("Mat_PRDP_ACUnit",    (0.86, 0.87, 0.86), roughness=0.45, metallic=0.2)
    mat_ac_dark    = create_mat("Mat_PRDP_ACDark",    (0.12, 0.12, 0.13), roughness=0.60)

    # --- Geometry parameters ---
    Y_FRONT = -8.35                 # South wall facing entrance_16
    Y_SEAM  = +8.35                 # Seam dividing PRDP from Storage
    PRDP_LEN = Y_SEAM - Y_FRONT     # 16.70m
    W_DEPTH  = 11.00                # depth along X: X in [-5.50, +5.50]
    X_REAR   = -5.50                # Wall facing rear trees (West)
    X_ROAD   = +5.50                # Wall facing road_1 (East)

    FLOOR_Z  = 0.35
    BASE_H   = 0.45
    EAVE_Z   = 3.35
    RIDGE_Z  = 5.80
    OVERHANG = 0.75

    # --- 1. Walls & Skirting ---
    yc = (Y_FRONT + Y_SEAM) / 2.0   # 0.0
    create_box("PRDP_Walls", (0.0, yc, EAVE_Z / 2.0), (W_DEPTH, PRDP_LEN, EAVE_Z), mat_wall_cream, root)
    create_box("PRDP_Maroon_Base", (0.0, yc, BASE_H / 2.0), (W_DEPTH + 0.24, PRDP_LEN + 0.24, BASE_H), mat_maroon, root)

    # --- 2. Pilasters ---
    pil_h = EAVE_Z - BASE_H
    pil_z = BASE_H + pil_h / 2.0
    N_BAYS = 4
    BAY = PRDP_LEN / N_BAYS         # ~4.175m

    # Pilasters along road wall (X = X_ROAD + 0.06)
    for i in range(N_BAYS + 1):
        py = Y_FRONT + i * BAY
        py = min(max(py, Y_FRONT + 0.15), Y_SEAM - 0.15)
        create_box(f"PRDP_Pil_Road_{i}", (X_ROAD + 0.06, py, pil_z), (0.12, 0.30, pil_h), mat_wall_cream, root)

    # Pilasters along rear wall (X = X_REAR - 0.06)
    for i in range(N_BAYS + 1):
        py = Y_FRONT + i * BAY
        py = min(max(py, Y_FRONT + 0.15), Y_SEAM - 0.15)
        create_box(f"PRDP_Pil_Rear_{i}", (X_REAR - 0.06, py, pil_z), (0.12, 0.30, pil_h), mat_wall_cream, root)

    # Pilasters on South entrance facade (Y = Y_FRONT - 0.06)
    for px in (-4.20, -1.25, 1.25, 4.20):
        create_box(f"PRDP_Pil_Front_{px:+.1f}", (px, Y_FRONT - 0.06, pil_z), (0.30, 0.12, pil_h), mat_wall_cream, root)

    # --- 3. South Entrance Facade (Y = Y_FRONT, facing entrance_16) ---
    door_xc, door_w, door_top = 0.0, 1.50, 2.60
    dft = 0.09
    yf = Y_FRONT
    # Double door frame
    create_box("PRDP_Door_Frame_T", (door_xc, yf - 0.04, door_top + dft / 2.0), (door_w + 2 * dft, 0.08, dft), mat_door_frame, root)
    create_box("PRDP_Door_Frame_L", (door_xc - door_w / 2.0 - dft / 2.0, yf - 0.04, (FLOOR_Z + door_top) / 2.0), (dft, 0.08, door_top - FLOOR_Z), mat_door_frame, root)
    create_box("PRDP_Door_Frame_R", (door_xc + door_w / 2.0 + dft / 2.0, yf - 0.04, (FLOOR_Z + door_top) / 2.0), (dft, 0.08, door_top - FLOOR_Z), mat_door_frame, root)
    create_box("PRDP_Door_Mullion", (door_xc, yf - 0.04, (FLOOR_Z + door_top) / 2.0), (0.05, 0.08, door_top - FLOOR_Z), mat_door_frame, root)
    create_box("PRDP_Door_Leaf_L", (door_xc - 0.35, yf - 0.02, (FLOOR_Z + door_top) / 2.0), (0.60, 0.03, door_top - FLOOR_Z), mat_glass, root)
    create_box("PRDP_Door_Leaf_R", (door_xc + 0.35, yf - 0.02, (FLOOR_Z + door_top) / 2.0), (0.60, 0.03, door_top - FLOOR_Z), mat_glass, root)

    # Entrance stoop
    create_box("PRDP_Stoop_Riser", (door_xc, yf - 0.45, 0.15), (2.30, 0.90, 0.30), mat_maroon, root)
    create_box("PRDP_Stoop_Tile", (door_xc, yf - 0.42, 0.325), (2.10, 0.84, 0.05), mat_tile, root)

    # South facade windows flanking door
    win_z0, win_h = 1.15, 1.45
    for sx in (-2.75, 2.75):
        g, f, gr = window_rects(sx, win_z0, 2.40, win_h, panels=3, rows=7)
        create_quads(f"PRDP_FrontWin_{sx:+.1f}_Glass", g, 'XZ', yf - 0.012, -1, mat_glass, root)
        create_quads(f"PRDP_FrontWin_{sx:+.1f}_Grille", gr, 'XZ', yf - 0.028, -1, mat_grille, root)
        create_quads(f"PRDP_FrontWin_{sx:+.1f}_Frame", f, 'XZ', yf - 0.040, -1, mat_frame, root)

    # Signboard above the entrance door
    sign_w, sign_h = 3.30, 0.54
    sign_zc = 2.97
    create_box("PRDP_Sign_Panel", (door_xc, yf - 0.04, sign_zc), (sign_w, 0.08, sign_h), mat_sign_bg, root)
    txt_rot = (math.radians(90), 0, 0)
    txt_y = yf - 0.082
    create_text_mesh("PRDP_Text_L1", (-0.35, txt_y, 3.13), "DEPARTMENT OF AGRICULTURE", 0.070, mat_sign_text, txt_rot, root, 'LEFT')
    create_text_mesh("PRDP_Text_L2", (-0.35, txt_y, 3.00), "PHILIPPINE RURAL DEVELOPMENT PROJECT", 0.090, mat_sign_text, txt_rot, root, 'LEFT')
    create_text_mesh("PRDP_Text_L3", (-0.35, txt_y, 2.87), "SCALE-UP | RPCO 4A", 0.068, mat_sign_text, txt_rot, root, 'LEFT')
    create_cylinder("PRDP_Seal_Ring", (-0.95, yf - 0.084, sign_zc), 0.14, 0.008, mat_da_green, 16, rot=txt_rot, parent=root)
    create_cylinder("PRDP_Seal_Core", (-0.95, yf - 0.088, sign_zc), 0.09, 0.008, mat_da_gold, 12, rot=txt_rot, parent=root)

    # --- 4. Road-Facing Facade (X = X_ROAD = +5.50m, facing road_1) ---
    # 4 bays, each with a 2-panel grilled window facing road_1 (+X direction)
    for b in range(N_BAYS):
        by = Y_FRONT + (b + 0.5) * BAY
        g, f, gr = window_rects(by, 1.20, 2.10, 1.35, panels=2, rows=6)
        create_quads(f"PRDP_RoadWin_{b}_Glass", g, 'YZ', X_ROAD + 0.012, 1, mat_glass, root)
        create_quads(f"PRDP_RoadWin_{b}_Grille", gr, 'YZ', X_ROAD + 0.028, 1, mat_grille, root)
        create_quads(f"PRDP_RoadWin_{b}_Frame", f, 'YZ', X_ROAD + 0.040, 1, mat_frame, root)

    # AC Condenser units mounted on road facade
    create_box("PRDP_SplitAC_1", (X_ROAD + 0.28, Y_FRONT + 1.2 * BAY, 1.10), (0.30, 0.82, 0.58), mat_ac, root)
    create_cylinder("PRDP_SplitAC_Fan_1", (X_ROAD + 0.435, Y_FRONT + 1.2 * BAY - 0.10, 1.10), 0.21, 0.01, mat_ac_dark, 14, rot=(0, math.radians(90), 0), parent=root)
    create_box("PRDP_SplitAC_2", (X_ROAD + 0.28, Y_FRONT + 3.1 * BAY, 1.10), (0.30, 0.82, 0.58), mat_ac, root)
    create_cylinder("PRDP_SplitAC_Fan_2", (X_ROAD + 0.435, Y_FRONT + 3.1 * BAY - 0.10, 1.10), 0.21, 0.01, mat_ac_dark, 14, rot=(0, math.radians(90), 0), parent=root)

    # --- 5. ROOF GEOMETRY (Seamless Emerald Green Half) ---
    # Main ridge runs at X = 0, Z = RIDGE_Z (5.80m).
    # Starts at Y = Y_FRONT + (W_DEPTH / 2.0) = -8.35 + 5.50 = -2.85m (front hip vertex)
    # and runs straight all the way to the dividing seam Y = Y_SEAM (+8.35m)!
    # Eaves:
    #   Road eave: X = X_ROAD + OVERHANG = +6.25m, Z = EAVE_Z (3.35m)
    #   Rear eave: X = X_REAR - OVERHANG = -6.25m, Z = EAVE_Z (3.35m)
    #   Front eave: Y = Y_FRONT - OVERHANG = -9.10m, Z = EAVE_Z (3.35m)
    #   Seam eave: terminates flush at Y = Y_SEAM (+8.35m)
    X_EAVE_ROAD = X_ROAD + OVERHANG     # +6.25
    X_EAVE_REAR = X_REAR - OVERHANG     # -6.25
    Y_EAVE_FRONT = Y_FRONT - OVERHANG   # -9.10
    Y_RIDGE_FRONT = Y_FRONT + (W_DEPTH + 2 * OVERHANG) / 2.0  # -2.85

    roof_mesh = bpy.data.meshes.new("PRDP_Roof_Mesh")
    roof_obj = bpy.data.objects.new("PRDP_Roof", roof_mesh)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.parent = root

    bm = bmesh.new()

    # Vertices
    v_rf_road   = bm.verts.new((X_EAVE_ROAD, Y_EAVE_FRONT, EAVE_Z))    # (+6.25, -9.10, 3.35)
    v_rf_rear   = bm.verts.new((X_EAVE_REAR, Y_EAVE_FRONT, EAVE_Z))    # (-6.25, -9.10, 3.35)
    v_seam_road = bm.verts.new((X_EAVE_ROAD, Y_SEAM, EAVE_Z))        # (+6.25, +8.35, 3.35)
    v_seam_rear = bm.verts.new((X_EAVE_REAR, Y_SEAM, EAVE_Z))        # (-6.25, +8.35, 3.35)

    v_ridge_front = bm.verts.new((0.0, Y_RIDGE_FRONT, RIDGE_Z))       # (0.0, -2.85, 5.80)
    v_ridge_seam  = bm.verts.new((0.0, Y_SEAM, RIDGE_Z))              # (0.0, +8.35, 5.80)

    # Faces:
    # 1. South front hip triangle
    bm.faces.new((v_rf_road, v_ridge_front, v_rf_rear))
    # 2. Road slope trapezoid (facing +X)
    bm.faces.new((v_rf_road, v_seam_road, v_ridge_seam, v_ridge_front))
    # 3. Rear slope trapezoid (facing -X)
    bm.faces.new((v_rf_rear, v_ridge_front, v_ridge_seam, v_seam_rear))
    # 4. Internal dividing gable wall at the seam (closes the roof solid at Y = +8.35)
    bm.faces.new((v_seam_road, v_seam_rear, v_ridge_seam))
    # 5. Bottom soffit
    bm.faces.new((v_rf_rear, v_seam_rear, v_seam_road, v_rf_road))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(roof_mesh)
    bm.free()

    roof_obj.data.materials.append(mat_roof)

    # Fascia boards (dark timber eave trims)
    create_box("PRDP_Fascia_Front", (0.0, Y_EAVE_FRONT, EAVE_Z - 0.08), (X_EAVE_ROAD - X_EAVE_REAR + 0.10, 0.05, 0.22), mat_fascia, root)
    create_box("PRDP_Fascia_Road", (X_EAVE_ROAD, (Y_EAVE_FRONT + Y_SEAM) / 2.0, EAVE_Z - 0.08), (0.05, Y_SEAM - Y_EAVE_FRONT, 0.22), mat_fascia, root)
    create_box("PRDP_Fascia_Rear", (X_EAVE_REAR, (Y_EAVE_FRONT + Y_SEAM) / 2.0, EAVE_Z - 0.08), (0.05, Y_SEAM - Y_EAVE_FRONT, 0.22), mat_fascia, root)

    # Ridge cap along main ridge
    create_box("PRDP_RidgeCap", (0.0, (Y_RIDGE_FRONT + Y_SEAM) / 2.0, RIDGE_Z + 0.03), (0.35, Y_SEAM - Y_RIDGE_FRONT, 0.08), mat_ridge, root)

    # --- Export GLB ---
    out_dir = r"c:\Users\LGU-SanPedro\Downloads\map\models"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "prdp_building.glb")

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7
    )

    size_kb = os.path.getsize(out_path) / 1024.0
    print(f"Exported PRDP Building to {out_path} ({size_kb:.1f} KB)")
    assert size_kb < 300.0, f"Model size {size_kb:.1f} KB exceeds budget!"

if __name__ == "__main__":
    build_prdp_building()
