"""
build_agricultural_supplies_storage.py — Authentic Unified 3D Model of the DA-LARES Agricultural Supplies Storage (Eastern Half)
Part of the unified PRDP + LARES Agricultural Supplies Storage complex.

Shared Reference:
- Origin: [121.16692287, 13.95933876]
- Mapbox rotation: 341.9 deg
- Local Y-axis: runs along bearing 342.4° (Y < 0 is South towards entrance_16, Y > 0 is North towards Storage).
- Local X-axis: runs along bearing 72.4° (X > 0 faces road_1, X < 0 faces rear trees).
- Shared seam: at Y = +8.35m.
- Storage bounds: Y in [+8.35, +20.41], X in [-5.50, +7.47].
- Roof: Weathered olive/sage green (#4D604B) corrugated hip roof with dark timber fascia.
  Continuous horizontal main ridge at X = 0, Z = 5.80m starting flush at Y = +8.35m.
  100% Watertight, closed geometry with zero holes.
- Road-facing facade (+X): Contains fixed 6-panel wooden door, concrete step, Carrier window AC unit,
  and 3-panel horizontal sliding glass window with security grilles facing road_1.
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

def build_agricultural_supplies_storage():
    print("=====================================================================")
    print(" Building Calibrated Unified Storage Building (+X Facing Road)       ")
    print("=====================================================================")

    for obj in list(bpy.data.objects):
        if obj.type in ['MESH', 'CURVE', 'FONT', 'LIGHT', 'EMPTY', 'CAMERA']:
            bpy.data.objects.remove(obj, do_unlink=True)

    root = bpy.data.objects.new("Storage_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # --- Materials (weathered olive roof + warm cream stucco + maroon base) ---
    mat_wall_cream = create_mat("Mat_Storage_WallCream", (0.91, 0.85, 0.65), roughness=0.88)
    mat_maroon     = create_mat("Mat_Storage_Maroon",    (0.40, 0.12, 0.15), roughness=0.80)
    mat_door       = create_mat("Mat_Storage_WoodDoor",  (0.82, 0.84, 0.85), roughness=0.60)
    mat_door_frame = create_mat("Mat_Storage_DoorFrame", (0.22, 0.15, 0.12), roughness=0.65)
    mat_door_panel = create_mat("Mat_Storage_DoorPanel", (0.75, 0.77, 0.78), roughness=0.55)
    mat_brass      = create_mat("Mat_Storage_Brass",     (0.85, 0.75, 0.35), roughness=0.30, metallic=0.8)
    mat_tile       = create_mat("Mat_Storage_Tile",      (0.80, 0.74, 0.66), roughness=0.45)
    mat_frame      = create_mat("Mat_Storage_Frame",     (0.12, 0.11, 0.11), roughness=0.55, metallic=0.4)
    mat_glass      = create_mat("Mat_Storage_Glass",     (0.13, 0.15, 0.17), roughness=0.15, metallic=0.35, specular=0.9)
    mat_grille     = create_mat("Mat_Storage_Grille",    (0.16, 0.16, 0.17), roughness=0.50, metallic=0.6)
    mat_interior   = create_mat("Mat_Storage_Interior",  (0.07, 0.07, 0.08), roughness=0.90)

    # Weathered olive/sage green corrugated hip roof
    mat_roof       = create_mat("Mat_Storage_RoofOlive", (0.28, 0.34, 0.26), roughness=0.65, metallic=0.20)
    mat_ridge      = create_mat("Mat_Storage_RidgeCap",  (0.24, 0.30, 0.22), roughness=0.60, metallic=0.25)
    mat_fascia     = create_mat("Mat_Storage_Fascia",    (0.28, 0.18, 0.12), roughness=0.75) # dark timber fascia
    mat_soffit     = create_mat("Mat_Storage_Soffit",    (0.92, 0.92, 0.90), roughness=0.85)
    mat_ac         = create_mat("Mat_Storage_ACUnit",    (0.88, 0.89, 0.88), roughness=0.45, metallic=0.2)
    mat_ac_dark    = create_mat("Mat_Storage_ACDark",    (0.15, 0.15, 0.16), roughness=0.60)

    # --- Geometry parameters ---
    Y_SEAM = +8.35                  # Seam dividing Storage from PRDP
    Y_NORTH = +20.41                # North end wall of Storage
    LEN_TOTAL = Y_NORTH - Y_SEAM    # 12.06m

    X_REAR      = -5.50             # Rear wall (aligns flush with PRDP)
    X_ROAD_MAIN = +5.50             # Recessed front wall (aligns flush with PRDP)
    W_MAIN      = X_ROAD_MAIN - X_REAR # 11.00m

    # Projecting wing along road (+X direction):
    Y_WING_START = +11.58           # Recessed notch is from Y = +8.35 to +11.58 (3.23m)
    X_ROAD_WING  = +7.47            # Wing projects out 1.97m toward road_1 in +X
    W_WING_STEP  = X_ROAD_WING - X_ROAD_MAIN # 1.97m
    LEN_WING     = Y_NORTH - Y_WING_START    # 8.83m

    FLOOR_Z  = 0.35
    BASE_H   = 0.45
    EAVE_Z   = 3.35
    RIDGE_Z  = 5.80
    OVERHANG = 0.75

    # --- 1. Walls & Foundation ---
    # Main block: X in [-5.50, +5.50], Y in [+8.35, +20.41]
    yc_main = (Y_SEAM + Y_NORTH) / 2.0
    create_box("Storage_Wall_Main", (0.0, yc_main, EAVE_Z / 2.0), (W_MAIN, LEN_TOTAL, EAVE_Z), mat_wall_cream, root)
    create_box("Storage_Base_Main", (0.0, yc_main, BASE_H / 2.0), (W_MAIN + 0.24, LEN_TOTAL + 0.24, BASE_H), mat_maroon, root)

    # Projecting wing block: X in [+5.50, +7.47], Y in [+11.58, +20.41]
    xc_wing = (X_ROAD_MAIN + X_ROAD_WING) / 2.0
    yc_wing = (Y_WING_START + Y_NORTH) / 2.0
    create_box("Storage_Wall_Wing", (xc_wing, yc_wing, EAVE_Z / 2.0), (W_WING_STEP, LEN_WING, EAVE_Z), mat_wall_cream, root)
    create_box("Storage_Base_Wing", (xc_wing, yc_wing, BASE_H / 2.0), (W_WING_STEP + 0.24, LEN_WING + 0.24, BASE_H), mat_maroon, root)

    # --- 2. Structural Pilasters ---
    pil_h = EAVE_Z - BASE_H
    pil_z = BASE_H + pil_h / 2.0

    # Pilasters on the projecting wing road facade (X = X_ROAD_WING + 0.06)
    for py in (Y_WING_START + 0.15, (Y_WING_START + Y_NORTH) / 2.0, Y_NORTH - 0.15):
        create_box(f"Storage_Pil_Wing_{py:+.1f}", (X_ROAD_WING + 0.06, py, pil_z), (0.12, 0.30, pil_h), mat_wall_cream, root)

    # Pilaster on recessed notch road wall (X = X_ROAD_MAIN + 0.06, Y = +9.96)
    create_box("Storage_Pil_Recess", (X_ROAD_MAIN + 0.06, (Y_SEAM + Y_WING_START) / 2.0, pil_z), (0.12, 0.30, pil_h), mat_wall_cream, root)

    # Pilasters on rear wall (X = X_REAR - 0.06)
    for py in (Y_SEAM + 0.15, (Y_SEAM + Y_NORTH) / 2.0, Y_NORTH - 0.15):
        create_box(f"Storage_Pil_Rear_{py:+.1f}", (X_REAR - 0.06, py, pil_z), (0.12, 0.30, pil_h), mat_wall_cream, root)

    # Pilasters on North end wall (Y = Y_NORTH + 0.06)
    for px in (-4.50, -1.50, 2.50, 6.50):
        create_box(f"Storage_Pil_North_{px:+.1f}", (px, Y_NORTH + 0.06, pil_z), (0.30, 0.12, pil_h), mat_wall_cream, root)

    # --- 3. Openings on the Road-Facing Facade (+X Direction) ---
    # A. Recessed Bay (X = X_ROAD_MAIN, Y in [+8.35, +11.58]):
    yc_rec = (Y_SEAM + Y_WING_START) / 2.0
    g, f, gr = window_rects(yc_rec - 0.50, 1.25, 1.60, 1.30, panels=2, rows=6)
    create_quads("Storage_RecWin_Glass", g, 'YZ', X_ROAD_MAIN + 0.012, 1, mat_glass, root)
    create_quads("Storage_RecWin_Grille", gr, 'YZ', X_ROAD_MAIN + 0.028, 1, mat_grille, root)
    create_quads("Storage_RecWin_Frame", f, 'YZ', X_ROAD_MAIN + 0.040, 1, mat_frame, root)
    create_box("Storage_Recess_ACBox", (X_ROAD_MAIN + 0.05, yc_rec + 0.75, 1.60), (0.10, 0.50, 0.45), mat_ac_dark, root)

    # B. South-facing step of the wing (Y = Y_WING_START, X in [+5.50, +7.47]):
    # Solid return wall

    # C. Projecting Wing Facade (X = X_ROAD_WING = +7.47m, facing road_1):
    # From south to north along the wing:
    # 1. 3-panel horizontal sliding window with security grilles
    win_yc = Y_WING_START + 2.40
    g, f, gr = window_rects(win_yc, 1.15, 2.70, 1.40, panels=3, rows=7)
    create_quads("Storage_WingWin_Glass", g, 'YZ', X_ROAD_WING + 0.012, 1, mat_glass, root)
    create_quads("Storage_WingWin_Grille", gr, 'YZ', X_ROAD_WING + 0.028, 1, mat_grille, root)
    create_quads("Storage_WingWin_Frame", f, 'YZ', X_ROAD_WING + 0.040, 1, mat_frame, root)

    # 2. Fixed 6-panel wooden entrance door (properly mounted per user instruction)
    door_yc = Y_WING_START + 5.50
    door_w, door_top = 1.05, 2.50
    dft = 0.08
    # Door frame
    create_box("Storage_Door_Frame_T", (X_ROAD_WING + 0.04, door_yc, door_top + dft / 2.0), (0.08, door_w + 2 * dft, dft), mat_door_frame, root)
    create_box("Storage_Door_Frame_L", (X_ROAD_WING + 0.04, door_yc - door_w / 2.0 - dft / 2.0, (FLOOR_Z + door_top) / 2.0), (0.08, dft, door_top - FLOOR_Z), mat_door_frame, root)
    create_box("Storage_Door_Frame_R", (X_ROAD_WING + 0.04, door_yc + door_w / 2.0 + dft / 2.0, (FLOOR_Z + door_top) / 2.0), (0.08, dft, door_top - FLOOR_Z), mat_door_frame, root)

    # Solid fixed 6-panel wooden door leaf
    leaf_w = door_w - 0.02
    leaf_h = door_top - FLOOR_Z - 0.02
    create_box("Storage_Door_Leaf", (X_ROAD_WING + 0.02, door_yc, FLOOR_Z + leaf_h / 2.0), (0.04, leaf_w, leaf_h), mat_door, root)

    # 6 Raised molded panels on door leaf (2 cols along Y x 3 rows along Z)
    for col, py in ((-1, -0.22), (1, 0.22)):
        for row, pz in ((0, FLOOR_Z + 0.35), (1, FLOOR_Z + 1.05), (2, FLOOR_Z + 1.75)):
            create_box(f"Storage_Door_Panel_{col}_{row}", (X_ROAD_WING + 0.045, door_yc + py, pz), (0.015, 0.28, 0.52), mat_door_panel, root)

    # Brass doorknob
    create_cylinder("Storage_Doorknob", (X_ROAD_WING + 0.06, door_yc + 0.36, FLOOR_Z + 0.95), 0.032, 0.04, mat_brass, 12, rot=(0, math.radians(90), 0), parent=root)

    # Concrete entrance step aligned directly with the door facing road_1 (+X)
    create_box("Storage_Entrance_Step", (X_ROAD_WING + 0.45, door_yc, 0.12), (0.80, 1.60, 0.24), mat_tile, root)

    # 3. Carrier through-wall window AC unit
    ac_yc = door_yc + 1.35
    create_box("Storage_WindowAC", (X_ROAD_WING + 0.20, ac_yc, 1.85), (0.42, 0.65, 0.44), mat_ac, root)
    create_quads("Storage_WindowAC_Grille", [(ac_yc - 0.26, ac_yc + 0.26, 1.68, 2.02)], 'YZ', X_ROAD_WING + 0.415, 1, mat_ac_dark, root)

    # --- 4. ROOF GEOMETRY (100% Watertight, Weathered Olive Hip Roof) ---
    roof_mesh = bpy.data.meshes.new("Storage_Roof_Mesh")
    roof_obj = bpy.data.objects.new("Storage_Roof", roof_mesh)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.parent = root

    bm = bmesh.new()

    X_E_REAR = -6.25
    X_E_REC  = +6.25
    X_E_WING = +8.22
    Y_E_SEAM = +8.35
    Y_E_REC  = +11.58
    Y_E_RET  = +11.00
    Y_E_N    = +21.16

    # Eave perimeter vertices:
    v_e_seam_rear = bm.verts.new((X_E_REAR, Y_E_SEAM, EAVE_Z))
    v_e_n_rear    = bm.verts.new((X_E_REAR, Y_E_N, EAVE_Z))
    v_e_n_main    = bm.verts.new((0.0, Y_E_N, EAVE_Z))
    v_e_n_wing    = bm.verts.new((X_E_WING, Y_E_N, EAVE_Z))
    v_e_w_front   = bm.verts.new((X_E_WING, Y_E_RET, EAVE_Z))
    v_e_w_in      = bm.verts.new((X_E_REC, Y_E_RET, EAVE_Z))
    v_e_seam_road = bm.verts.new((X_E_REC, Y_E_SEAM, EAVE_Z))

    # Ridge / Apex vertices:
    v_r_seam      = bm.verts.new((0.0, Y_E_SEAM, RIDGE_Z))
    v_r_north     = bm.verts.new((0.0, +14.91, RIDGE_Z))
    v_r_wing      = bm.verts.new((+3.80, +15.50, 5.30)) # Wing ridge apex extending toward road (+X)

    # Roof slope faces:
    # 1. Internal seam dividing gable (closes the roof solid at Y = +8.35, perfectly matches PRDP)
    bm.faces.new((v_e_seam_rear, v_e_seam_road, v_r_seam))

    # 2. Main rear slope (facing -X, quad)
    bm.faces.new((v_e_seam_rear, v_r_seam, v_r_north, v_e_n_rear))

    # 3. North hip slope (rear half, triangle)
    bm.faces.new((v_e_n_rear, v_r_north, v_e_n_main))

    # 4. North hip slope (wing half, quad)
    bm.faces.new((v_e_n_main, v_r_north, v_r_wing, v_e_n_wing))

    # 5. Wing road-facing slope (facing +X, triangle)
    bm.faces.new((v_e_n_wing, v_r_wing, v_e_w_front))

    # 6. Wing south slope (slopes from wing ridge down to south wing eave and inside corner, triangle)
    bm.faces.new((v_e_w_front, v_r_wing, v_e_w_in))

    # 7. Valley / transition slope between wing ridge and main ridge (quad)
    bm.faces.new((v_e_w_in, v_r_wing, v_r_north, v_r_seam))

    # 8. Recessed front slope from seam to inside corner (quad)
    bm.faces.new((v_e_seam_road, v_r_seam, v_e_w_in))

    # 9. Bottom soffit (fully seals underside)
    bm.faces.new((v_e_seam_rear, v_e_n_rear, v_e_n_main, v_e_n_wing, v_e_w_front, v_e_w_in, v_e_seam_road))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(roof_mesh)
    bm.free()

    roof_obj.data.materials.append(mat_roof)

    # Fascia boards (dark timber trims along eaves)
    create_box("Storage_Fascia_Rear", (X_E_REAR, (Y_E_SEAM + Y_E_N) / 2.0, EAVE_Z - 0.08), (0.05, Y_E_N - Y_E_SEAM, 0.22), mat_fascia, root)
    create_box("Storage_Fascia_North", ((X_E_REAR + X_E_WING) / 2.0, Y_E_N, EAVE_Z - 0.08), (X_E_WING - X_E_REAR + 0.10, 0.05, 0.22), mat_fascia, root)
    create_box("Storage_Fascia_WingFront", (X_E_WING, (Y_E_RET + Y_E_N) / 2.0, EAVE_Z - 0.08), (0.05, Y_E_N - Y_E_RET, 0.22), mat_fascia, root)
    create_box("Storage_Fascia_WingSouth", ((X_E_REC + X_E_WING) / 2.0, Y_E_RET, EAVE_Z - 0.08), (X_E_WING - X_E_REC, 0.05, 0.22), mat_fascia, root)
    create_box("Storage_Fascia_Recess", (X_E_REC, (Y_E_SEAM + Y_E_RET) / 2.0, EAVE_Z - 0.08), (0.05, Y_E_RET - Y_E_SEAM, 0.22), mat_fascia, root)

    # Ridge cap along main ridge
    create_box("Storage_RidgeCap_Main", (0.0, (Y_E_SEAM + 14.91) / 2.0, RIDGE_Z + 0.03), (0.35, 14.91 - Y_E_SEAM, 0.08), mat_ridge, root)

    # --- Shift all geometry by -14.38m so local (0, 0, 0) corresponds to Storage centroid ---
    Y_CENTER = 14.38
    bpy.ops.object.select_all(action='DESELECT')
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH':
            obj.parent = None
            obj.location.y -= Y_CENTER
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
        elif obj.type == 'EMPTY':
            bpy.data.objects.remove(obj, do_unlink=True)

    # --- Export GLB ---
    out_dir = r"c:\Users\LGU-SanPedro\Downloads\map\models"
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "lares_agricultural_supplies_storage.glb")

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
    print(f"Exported Storage Building to {out_path} ({size_kb:.1f} KB)")
    assert size_kb < 300.0, f"Model size {size_kb:.1f} KB exceeds budget!"

if __name__ == "__main__":
    build_agricultural_supplies_storage()
