import bpy
import bmesh
import math
import os

def create_material(name, color, roughness=0.5, metallic=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color[:3], 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
        if alpha < 1.0:
            mat.blend_method = 'BLEND'
    return mat

def create_box(name, loc, size, mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        if obj.data.materials:
            obj.data.materials[0] = mat
        else:
            obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_and_export_tanco_hall():
    # Remove previous Tanco objects
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Tanco_"):
            bpy.data.objects.remove(obj, do_unlink=True)
    for c in list(bpy.data.curves):
        if c.name.startswith("Tanco_"):
            bpy.data.curves.remove(c, do_unlink=True)

    # Root Empty
    root = bpy.data.objects.new("Tanco_Hall_Building", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (0, 0, 0)

    # --- MATERIALS (Fine-tuned from IMG_3787.jpg and IMG_3788.jpg) ---
    mat_wall = create_material("Mat_Tanco_Wall", (0.91, 0.89, 0.83), roughness=0.88)        # Off-white warm cream
    mat_pilaster = create_material("Mat_Tanco_Pilaster", (0.95, 0.94, 0.90), roughness=0.80) # Accent cream columns
    mat_plinth = create_material("Mat_Tanco_Plinth", (0.58, 0.57, 0.55), roughness=0.92)     # Weathered concrete base
    mat_roof = create_material("Mat_Tanco_Roof", (0.24, 0.38, 0.28), roughness=0.52, metallic=0.12) # Sage green corrugated roof
    mat_fascia = create_material("Mat_Tanco_Fascia", (0.16, 0.12, 0.10), roughness=0.72)    # Dark timber fascia
    mat_glass = create_material("Mat_Tanco_Glass", (0.10, 0.16, 0.20), roughness=0.12, alpha=0.80) # Semi-reflective tinted glass
    mat_frame = create_material("Mat_Tanco_Frame", (0.14, 0.15, 0.16), roughness=0.35, metallic=0.7) # Dark bronze aluminum frame
    mat_sign = create_material("Mat_Tanco_Sign", (0.10, 0.11, 0.13), roughness=0.55)        # Dark fascia sign band
    mat_letters = create_material("Mat_Tanco_Letters", (0.96, 0.96, 0.96), roughness=0.25)  # Clean white 3D letters
    mat_louvers = create_material("Mat_Tanco_Louvers", (0.45, 0.50, 0.54), roughness=0.40, metallic=0.5) # Aluminum jalousies
    mat_ac = create_material("Mat_Tanco_AC", (0.85, 0.84, 0.81), roughness=0.52)           # Off-white AC housing
    mat_ac_grille = create_material("Mat_Tanco_AC_Grille", (0.18, 0.18, 0.18), roughness=0.75) # Dark fan grille
    mat_board = create_material("Mat_Tanco_Board", (0.80, 0.78, 0.72), roughness=0.6)       # Bulletin board paper

    # --- DIMENSIONS ---
    W = 25.6  # Width along X
    D = 11.6  # Depth along Y
    H = 3.3   # Wall height
    PLINTH_H = 0.22

    # 1. Concrete Foundation Plinth & Surround
    create_box("Tanco_Plinth", (0, 0, PLINTH_H / 2), (W + 0.5, D + 0.5, PLINTH_H), mat_plinth, root)
    create_box("Tanco_Base_Trim", (0, 0, PLINTH_H + 0.05), (W + 0.15, D + 0.15, 0.1), mat_pilaster, root)

    # 2. Entrance Recess Geometry
    recess_d = 1.3
    porch_w = 4.8
    create_box("Tanco_Porch_BackWall", (0, -D/2 + recess_d, PLINTH_H + H/2), (porch_w, 0.25, H), mat_wall, root)
    create_box("Tanco_Porch_LeftWall", (-porch_w/2, -D/2 + recess_d/2, PLINTH_H + H/2), (0.25, recess_d, H), mat_wall, root)
    create_box("Tanco_Porch_RightWall", (porch_w/2, -D/2 + recess_d/2, PLINTH_H + H/2), (0.25, recess_d, H), mat_wall, root)
    create_box("Tanco_Porch_Floor", (0, -D/2 + recess_d/2, PLINTH_H / 2), (porch_w, recess_d, PLINTH_H), mat_plinth, root)
    create_box("Tanco_Porch_Ceiling", (0, -D/2 + recess_d/2, PLINTH_H + 2.75), (porch_w, recess_d, 0.15), mat_pilaster, root)

    # 3. Main Exterior Walls (Front Wings)
    fl_w = 10.4
    fl_x = -12.8 + fl_w / 2
    create_box("Tanco_Wall_Front_Left", (fl_x, -D/2, PLINTH_H + H/2), (fl_w, 0.28, H), mat_wall, root)

    fr_w = 10.4
    fr_x = 2.4 + fr_w / 2
    create_box("Tanco_Wall_Front_Right", (fr_x, -D/2, PLINTH_H + H/2), (fr_w, 0.28, H), mat_wall, root)

    create_box("Tanco_Wall_Back", (0, D/2, PLINTH_H + H/2), (W, 0.28, H), mat_wall, root)
    create_box("Tanco_Wall_Left", (-W/2, 0, PLINTH_H + H/2), (0.28, D, H), mat_wall, root)
    create_box("Tanco_Wall_Right", (W/2, 0, PLINTH_H + H/2), (0.28, D, H), mat_wall, root)

    # 4. Corner & Facade Pilasters (Cream Structural Columns)
    col_size = 0.50
    pilaster_locs = [
        (-W/2, -D/2), (W/2, -D/2),
        (-W/2, D/2), (W/2, D/2),
        (-porch_w/2, -D/2), (porch_w/2, -D/2),
        (-7.6, -D/2 - 0.04), (7.6, -D/2 - 0.04),
        (-W/2 - 0.04, 0), (W/2 + 0.04, 0)
    ]
    for i, (cx, cy) in enumerate(pilaster_locs):
        create_box(f"Tanco_Pilaster_{i}", (cx, cy, PLINTH_H + H/2), (col_size, col_size, H), mat_pilaster, root)

    # 5. Entrance Steps (Leading from ground up to porch floor)
    step_depth = 0.5
    step_riser = 0.11
    for s in range(3):
        sw = porch_w + 0.4 + s * 0.4
        sy = -D/2 - (s + 0.5) * step_depth
        sz = (3 - s) * step_riser / 2
        create_box(f"Tanco_Step_{s}", (0, sy, sz), (sw, step_depth, (3 - s) * step_riser), mat_plinth, root)

    # 6. Overhead Signage Beam & 3D Letters
    sign_h = 0.55
    sign_y = -D/2 - 0.08
    sign_z = PLINTH_H + 2.95
    create_box("Tanco_Sign_Beam", (0, sign_y, sign_z), (porch_w + 0.2, 0.22, sign_h), mat_sign, root)
    create_box("Tanco_Sign_BackPlate", (0, sign_y - 0.12, sign_z), (4.5, 0.04, 0.46), mat_sign, root)

    # 3D Text: "ARTURO R. TANCO TRAINING HALL"
    font_curve = bpy.data.curves.new(type="FONT", name="Tanco_Font_Curve")
    font_curve.body = "ARTURO R. TANCO TRAINING HALL"
    font_curve.size = 0.21
    font_curve.extrude = 0.03
    font_curve.align_x = 'CENTER'
    font_curve.align_y = 'CENTER'
    font_obj = bpy.data.objects.new("Tanco_Sign_Text", font_curve)
    bpy.context.scene.collection.objects.link(font_obj)
    font_obj.location = (0, sign_y - 0.15, sign_z)
    font_obj.rotation_euler = (math.radians(90), 0, 0)
    font_obj.data.materials.append(mat_letters)
    font_obj.parent = root

    # Convert font curve to mesh so glTF exporter includes it!
    bpy.context.view_layer.objects.active = font_obj
    font_obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    font_obj.select_set(False)

    # 7. Entrance Double Glass Doors & Transom
    door_w = 2.5
    door_h = 2.25
    door_y = -D/2 + recess_d - 0.08
    door_z = PLINTH_H + door_h / 2
    create_box("Tanco_Door_Frame", (0, door_y, door_z), (door_w + 0.14, 0.12, door_h + 0.1), mat_frame, root)
    create_box("Tanco_Door_Glass_L", (-door_w/4, door_y - 0.02, door_z), (door_w/2 - 0.08, 0.04, door_h - 0.1), mat_glass, root)
    create_box("Tanco_Door_Glass_R", (door_w/4, door_y - 0.02, door_z), (door_w/2 - 0.08, 0.04, door_h - 0.1), mat_glass, root)
    create_box("Tanco_Door_Handle_L", (-0.08, door_y - 0.07, door_z), (0.04, 0.04, 0.55), mat_letters, root)
    create_box("Tanco_Door_Handle_R", (0.08, door_y - 0.07, door_z), (0.04, 0.04, 0.55), mat_letters, root)
    transom_h = 0.45
    create_box("Tanco_Door_Transom", (0, door_y, PLINTH_H + door_h + transom_h/2), (door_w, 0.06, transom_h), mat_glass, root)
    side_w = (porch_w - door_w - 0.4) / 2
    create_box("Tanco_Door_Side_L", (-door_w/2 - side_w/2, door_y, door_z), (side_w, 0.06, door_h), mat_glass, root)
    create_box("Tanco_Door_Side_R", (door_w/2 + side_w/2, door_y, door_z), (side_w, 0.06, door_h), mat_glass, root)

    # 8. Front Ribbon Windows & Air Conditioning Units
    left_wins = [-10.2, -5.0]
    win_w = 3.6
    win_h = 1.35
    win_z = PLINTH_H + 1.85
    win_y = -D/2 - 0.16

    for i, wx in enumerate(left_wins):
        create_box(f"Tanco_Win_FL_{i}_Frame", (wx, win_y, win_z), (win_w, 0.12, win_h), mat_frame, root)
        create_box(f"Tanco_Win_FL_{i}_Glass", (wx, win_y - 0.01, win_z), (win_w - 0.12, 0.04, win_h - 0.12), mat_glass, root)
        for l in range(4):
            lz = win_z - win_h/2 + (l + 0.5) * (win_h / 4)
            create_box(f"Tanco_Win_FL_{i}_Louver_{l}", (wx, win_y - 0.05, lz), (win_w - 0.16, 0.04, 0.05), mat_louvers, root)
        ac_y = win_y - 0.25
        ac_z = PLINTH_H + 0.72
        create_box(f"Tanco_AC_FL_{i}", (wx, ac_y, ac_z), (0.95, 0.42, 0.65), mat_ac, root)
        create_box(f"Tanco_AC_FL_{i}_Grille", (wx, ac_y - 0.22, ac_z), (0.72, 0.03, 0.5), mat_ac_grille, root)

    create_box("Tanco_Bulletin_Frame", (-2.65, win_y - 0.02, PLINTH_H + 1.8), (0.95, 0.06, 1.25), mat_frame, root)
    create_box("Tanco_Bulletin_Surface", (-2.65, win_y - 0.06, PLINTH_H + 1.8), (0.85, 0.02, 1.15), mat_board, root)

    right_wins = [5.0, 10.2]
    for i, wx in enumerate(right_wins):
        create_box(f"Tanco_Win_FR_{i}_Frame", (wx, win_y, win_z), (win_w, 0.12, win_h), mat_frame, root)
        create_box(f"Tanco_Win_FR_{i}_Glass", (wx, win_y - 0.01, win_z), (win_w - 0.12, 0.04, win_h - 0.12), mat_glass, root)
        for l in range(4):
            lz = win_z - win_h/2 + (l + 0.5) * (win_h / 4)
            create_box(f"Tanco_Win_FR_{i}_Louver_{l}", (wx, win_y - 0.05, lz), (win_w - 0.16, 0.04, 0.05), mat_louvers, root)
        ac_y = win_y - 0.25
        ac_z = PLINTH_H + 0.72
        create_box(f"Tanco_AC_FR_{i}", (wx, ac_y, ac_z), (0.95, 0.42, 0.65), mat_ac, root)
        create_box(f"Tanco_AC_FR_{i}_Grille", (wx, ac_y - 0.22, ac_z), (0.72, 0.03, 0.5), mat_ac_grille, root)

    # 9. Side Windows
    side_wins = [-2.8, 2.8]
    for i, wy in enumerate(side_wins):
        create_box(f"Tanco_Win_SideL_{i}_Frame", (-W/2 - 0.16, wy, win_z), (0.12, 2.6, win_h), mat_frame, root)
        create_box(f"Tanco_Win_SideL_{i}_Glass", (-W/2 - 0.17, wy, win_z), (0.04, 2.5, win_h - 0.12), mat_glass, root)
        create_box(f"Tanco_Win_SideR_{i}_Frame", (W/2 + 0.16, wy, win_z), (0.12, 2.6, win_h), mat_frame, root)
        create_box(f"Tanco_Win_SideR_{i}_Glass", (W/2 + 0.17, wy, win_z), (0.04, 2.5, win_h - 0.12), mat_glass, root)

    # 10. Rear Windows
    back_wins = [-8.0, 0.0, 8.0]
    for i, bx in enumerate(back_wins):
        create_box(f"Tanco_Win_Back_{i}_Frame", (bx, D/2 + 0.16, win_z), (3.0, 0.12, win_h), mat_frame, root)
        create_box(f"Tanco_Win_Back_{i}_Glass", (bx, D/2 + 0.17, win_z), (2.88, 0.04, win_h - 0.12), mat_glass, root)

    # 11. HIPPED METAL ROOF (Optimized slope & rise for realistic prominence)
    OVERHANG = 0.95
    ROOF_W = W + 2 * OVERHANG  # 27.5m
    ROOF_D = D + 2 * OVERHANG  # 13.5m
    EAVE_Z = PLINTH_H + H       # 3.52m
    RIDGE_H = 2.45             # 2.45m rise -> Ridge at 5.97m (authentic Philippine pitched hall)
    RIDGE_Z = EAVE_Z + RIDGE_H
    RIDGE_HALF_X = (ROOF_W - ROOF_D) / 2 # 7.0m

    roof_mesh = bpy.data.meshes.new("Tanco_Roof_Mesh")
    bm = bmesh.new()

    v0 = bm.verts.new((-ROOF_W/2, -ROOF_D/2, EAVE_Z)) # Front-Left
    v1 = bm.verts.new(( ROOF_W/2, -ROOF_D/2, EAVE_Z)) # Front-Right
    v2 = bm.verts.new(( ROOF_W/2,  ROOF_D/2, EAVE_Z)) # Back-Right
    v3 = bm.verts.new((-ROOF_W/2,  ROOF_D/2, EAVE_Z)) # Back-Left
    r0 = bm.verts.new((-RIDGE_HALF_X, 0, RIDGE_Z))    # Ridge-Left
    r1 = bm.verts.new(( RIDGE_HALF_X, 0, RIDGE_Z))    # Ridge-Right

    f_front = bm.faces.new((v0, v1, r1, r0))
    f_right = bm.faces.new((v1, v2, r1))
    f_back  = bm.faces.new((v2, v3, r0, r1))
    f_left  = bm.faces.new((v3, v0, r0))

    bm.to_mesh(roof_mesh)
    bm.free()

    roof_obj = bpy.data.objects.new("Tanco_Roof", roof_mesh)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.data.materials.append(mat_roof)
    roof_obj.parent = root

    # 12. Fascia Board & Eave Soffits
    fascia_h = 0.28
    fascia_thick = 0.06
    fascia_z = EAVE_Z - fascia_h / 2

    create_box("Tanco_Fascia_Front", (0, -ROOF_D/2, fascia_z), (ROOF_W + fascia_thick*2, fascia_thick, fascia_h), mat_fascia, root)
    create_box("Tanco_Fascia_Back", (0, ROOF_D/2, fascia_z), (ROOF_W + fascia_thick*2, fascia_thick, fascia_h), mat_fascia, root)
    create_box("Tanco_Fascia_Left", (-ROOF_W/2, 0, fascia_z), (fascia_thick, ROOF_D, fascia_h), mat_fascia, root)
    create_box("Tanco_Fascia_Right", (ROOF_W/2, 0, fascia_z), (fascia_thick, ROOF_D, fascia_h), mat_fascia, root)

    create_box("Tanco_Soffit_Front", (0, -D/2 - OVERHANG/2, EAVE_Z - 0.04), (ROOF_W, OVERHANG, 0.04), mat_pilaster, root)
    create_box("Tanco_Soffit_Back", (0, D/2 + OVERHANG/2, EAVE_Z - 0.04), (ROOF_W, OVERHANG, 0.04), mat_pilaster, root)
    create_box("Tanco_Soffit_Left", (-W/2 - OVERHANG/2, 0, EAVE_Z - 0.04), (OVERHANG, D, 0.04), mat_pilaster, root)
    create_box("Tanco_Soffit_Right", (W/2 + OVERHANG/2, 0, EAVE_Z - 0.04), (OVERHANG, D, 0.04), mat_pilaster, root)

    # 13. Ridge Cap Along Roof Peak
    create_box("Tanco_Ridge_Cap", (0, 0, RIDGE_Z + 0.04), (RIDGE_HALF_X * 2 + 0.4, 0.38, 0.08), mat_fascia, root)

    # 14. Covered Walkway Connector to Argosino Hall
    walk_w = 2.4
    walk_d = 4.2
    walk_h = 2.8
    walk_x = -7.2
    walk_y = D/2 + walk_d / 2
    create_box("Tanco_Walkway_Roof", (walk_x, walk_y, PLINTH_H + walk_h), (walk_w, walk_d, 0.12), mat_roof, root)
    for wy in [D/2 + 1.2, D/2 + 3.2]:
        create_box(f"Tanco_Walkway_Col_L_{wy:.1f}", (walk_x - walk_w/2 + 0.1, wy, (PLINTH_H + walk_h)/2), (0.14, 0.14, PLINTH_H + walk_h), mat_frame, root)
        create_box(f"Tanco_Walkway_Col_R_{wy:.1f}", (walk_x + walk_w/2 - 0.1, wy, (PLINTH_H + walk_h)/2), (0.14, 0.14, PLINTH_H + walk_h), mat_frame, root)

    # --- GLB EXPORT ---
    # Select only Tanco objects
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\tanco_hall_building.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"Exported Tanco Hall GLB to {glb_out} (Size: {file_size_kb:.1f} KB)")
    return root

build_and_export_tanco_hall()
