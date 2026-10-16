"""
build_admin_building.py — Authentic Bespoke 3D Model of the DA-LARES Multi-Function Admin Building
(STIARC Multi-Function Administrative Building)

Ground-Truth Photographic Reference:
1. preview_admin_IMG_3805.jpg (Front / North Elevation facing compound road & entrance_8):
   - 2-storey structure (distinctly taller than ORED: eaves ~7.2m, ridge ~9.2m vs ORED eaves 3.9m).
   - Light yellow / cream concrete walls with raised plinth.
   - Ground floor: entrance ramp with stainless steel handrails on East side; large window bays.
   - Continuous corrugated green metal ground-floor canopy roof with green fascia beam.
   - Extends West to flush-connect with ORED's carport canopy across the breezeway (IMG_3806).
   - Second floor: 3 large 4-pane window bays with white frames, protruding window ACs, wall split AC compressor.
   - White PVC downspouts from upper eaves to lower canopy roof.
2. preview_admin_IMG_3806.jpg (Breezeway Link between Admin and ORED):
   - Admin (left, 2 storeys, yellow) clearly taller than ORED (right, 1 storey, green).
   - Ground-floor canopy roof bridges the breezeway between the two buildings.
3. preview_admin_IMG_3810.jpg (South Elevation facing Canteen & entrance_7):
   - 2-storey yellow concrete facade.
   - Prominent cantilevered entrance portico canopy over double doors with green fascia & cream soffit.
   - Double glass doors with aluminum frames & transom.
   - Embossed metallic wall lettering on right:
       "STIARC MULTI-FUNCTION"
       "ADMIN. BLDG."
   - Ground and second-floor window bays with window AC units.
   - West elevation has windows along both floors overlooking the breezeway.

Orientation & Placement:
- In Blender: South entrance (-Y, towards Canteen, entrance_7).
- Mapbox rotation: 0.0° (faces South at entrance_7, North at entrance_8).
- Performance Budget: strictly < 300 KB GLB.
- Zero extraneous outdoor props (no lawn slabs, trees, curbs, streetlamps, or vehicles).
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def create_mat(name, color, roughness=0.7, metallic=0.0, specular=0.5, emission=None):
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
    if emission:
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = (*emission[:3], 1.0)
            bsdf.inputs['Emission Strength'].default_value = emission[3] if len(emission) > 3 else 1.0
        elif 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = (*emission[:3], 1.0)
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


def create_cylinder(name, loc, radius, height, mat, segments=12, rot=(0, 0, 0), parent=None):
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


def create_text_mesh(name, loc, text, size, mat, rot=(0, 0, 0), parent=None, align='CENTER', res=0):
    c_data = bpy.data.curves.new(name=name + "_Data", type='FONT')
    c_data.body = text
    c_data.size = size
    c_data.extrude = 0.010
    c_data.resolution_u = res
    c_data.render_resolution_u = res
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


def create_hip_roof(name, hx, hy, z_eave, z_ridge, mat_top, mat_soffit, parent=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    if hy >= hx:
        rh = max(hy - hx * 0.75, 0.5)
        v0 = bm.verts.new((-hx, -hy, z_eave))
        v1 = bm.verts.new((hx, -hy, z_eave))
        v2 = bm.verts.new((hx, hy, z_eave))
        v3 = bm.verts.new((-hx, hy, z_eave))
        r0 = bm.verts.new((0, -rh, z_ridge))
        r1 = bm.verts.new((0, rh, z_ridge))
        bm.faces.new((v0, v1, r0))
        bm.faces.new((v1, v2, r1, r0))
        bm.faces.new((v2, v3, r1))
        bm.faces.new((v3, v0, r0, r1))
        soffit = bm.faces.new((v3, v2, v1, v0))
        ridge_is_y = True
    else:
        rh = max(hx - hy * 0.75, 0.5)
        v0 = bm.verts.new((-hx, -hy, z_eave))
        v1 = bm.verts.new((hx, -hy, z_eave))
        v2 = bm.verts.new((hx, hy, z_eave))
        v3 = bm.verts.new((-hx, hy, z_eave))
        r0 = bm.verts.new((-rh, 0, z_ridge))
        r1 = bm.verts.new((rh, 0, z_ridge))
        bm.faces.new((v0, v1, r1, r0))
        bm.faces.new((v1, v2, r1))
        bm.faces.new((v2, v3, r0, r1))
        bm.faces.new((v3, v0, r0))
        soffit = bm.faces.new((v3, v2, v1, v0))
        ridge_is_y = False

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    soffit.material_index = 1
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mat_top)
    obj.data.materials.append(mat_soffit)
    if parent:
        obj.parent = parent
    return obj, rh, ridge_is_y


def create_beam_between(name, p0, p1, w, h, mat, parent=None):
    a, b = Vector(p0), Vector(p1)
    d = b - a
    obj = create_box(name, (a + b) / 2.0, (d.length, w, h), mat, parent)
    obj.rotation_euler = d.to_track_quat('X', 'Z').to_euler()
    return obj


# ---------------------------------------------------------------------------
# Main Builder Function
# ---------------------------------------------------------------------------
def build_admin_building():
    print("=====================================================================")
    print(" Building Authentic Admin Building (2-Storey DA-LARES Head Office)   ")
    print("=====================================================================")

    # Clear previous objects and purge mesh blocks
    for obj in list(bpy.data.objects):
        if obj.type in ['MESH', 'CURVE', 'FONT', 'LIGHT', 'EMPTY', 'CAMERA']:
            bpy.data.objects.remove(obj, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    for c in list(bpy.data.curves):
        bpy.data.curves.remove(c)

    root = bpy.data.objects.new("Admin_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # -----------------------------------------------------------------------
    # PBR Materials
    # -----------------------------------------------------------------------
    mat_wall_yellow    = create_mat("Mat_Admin_WallYellow",    (0.93, 0.88, 0.65), roughness=0.75) # Warm pale yellow
    mat_wall_accent    = create_mat("Mat_Admin_WallAccent",    (0.88, 0.83, 0.60), roughness=0.70)
    mat_base_plinth    = create_mat("Mat_Admin_BasePlinth",    (0.80, 0.80, 0.78), roughness=0.85) # Concrete plinth
    mat_belt_course    = create_mat("Mat_Admin_BeltCourse",    (0.86, 0.82, 0.68), roughness=0.70) # Mid-floor band
    mat_roof_green     = create_mat("Mat_Admin_RoofGreen",     (0.12, 0.28, 0.18), roughness=0.45, metallic=0.55)
    mat_roof_cap       = create_mat("Mat_Admin_RoofCap",       (0.09, 0.22, 0.13), roughness=0.50, metallic=0.50)
    mat_fascia_green   = create_mat("Mat_Admin_FasciaGreen",   (0.08, 0.22, 0.13), roughness=0.60)
    mat_soffit         = create_mat("Mat_Admin_Soffit",         (0.91, 0.92, 0.90), roughness=0.85)
    mat_frame_white    = create_mat("Mat_Admin_FrameWhite",    (0.92, 0.92, 0.92), roughness=0.40, metallic=0.25)
    mat_frame_dark     = create_mat("Mat_Admin_FrameDark",     (0.15, 0.15, 0.16), roughness=0.45, metallic=0.50)
    mat_glass          = create_mat("Mat_Admin_Glass",          (0.12, 0.16, 0.18), roughness=0.15, metallic=0.35, specular=0.90)
    mat_interior       = create_mat("Mat_Admin_Interior",       (0.14, 0.14, 0.15), roughness=0.90)
    mat_sign_gold      = create_mat("Mat_Admin_SignGold",      (0.85, 0.72, 0.28), roughness=0.30, metallic=0.80, specular=0.90)
    mat_maroon         = create_mat("Mat_Admin_Maroon",        (0.52, 0.20, 0.22), roughness=0.70)
    mat_ac_case        = create_mat("Mat_Admin_ACCase",        (0.85, 0.86, 0.87), roughness=0.60)
    mat_ac_grille      = create_mat("Mat_Admin_ACGrille",      (0.25, 0.25, 0.26), roughness=0.70)
    mat_downspout      = create_mat("Mat_Admin_Downspout",     (0.88, 0.89, 0.88), roughness=0.50)
    mat_handrail       = create_mat("Mat_Admin_Handrail",      (0.80, 0.82, 0.85), roughness=0.25, metallic=0.90)
    mat_corrugated_rib = create_mat("Mat_Admin_CanopyRib",     (0.09, 0.22, 0.13), roughness=0.50, metallic=0.50)

    # -----------------------------------------------------------------------
    # Footprint & Vertical Architecture (Distinctly Taller 2-Storey)
    # -----------------------------------------------------------------------
    # Footprint matching roads.json & js/data/buildings.js:
    # Width (East-West): 10.70 m -> HX = 5.35 m
    # Depth (North-South): 19.68 m -> HY = 9.84 m
    HX = 5.35
    HY = 9.84

    BASE_H  = 0.40  # Plinth base
    F1_H    = 3.35  # Ground floor height
    SLAB_H  = 0.25  # Intermediate floor slab / belt beam
    F2_H    = 3.20  # Second floor height
    EAVE_Z  = BASE_H + F1_H + SLAB_H + F2_H  # 7.20 m (Taller than ORED eave 3.9m!)
    RIDGE_Z = 9.20  # 9.20 m ridge height (Taller than ORED ridge 5.75m!)

    # 1. Foundation Plinth Base
    create_box("Admin_Base_Plinth", (0, 0, BASE_H / 2.0),
               (2 * HX + 0.30, 2 * HY + 0.30, BASE_H), mat_base_plinth, root)

    # 2. Interior Core
    create_box("Admin_Interior_Core", (0, 0, (BASE_H + EAVE_Z) / 2.0),
               (2 * HX - 0.20, 2 * HY - 0.20, EAVE_Z - BASE_H), mat_interior, root)

    # 3. Main Yellow Exterior Walls
    wall_t = 0.18
    # Ground floor & 2nd floor structural walls
    create_box("Admin_Wall_West", (-HX + wall_t/2.0, 0, (BASE_H + EAVE_Z) / 2.0),
               (wall_t, 2 * HY, EAVE_Z - BASE_H), mat_wall_yellow, root)
    create_box("Admin_Wall_East", ( HX - wall_t/2.0, 0, (BASE_H + EAVE_Z) / 2.0),
               (wall_t, 2 * HY, EAVE_Z - BASE_H), mat_wall_yellow, root)
    create_box("Admin_Wall_South", (0, -HY + wall_t/2.0, (BASE_H + EAVE_Z) / 2.0),
               (2 * HX - 2 * wall_t, wall_t, EAVE_Z - BASE_H), mat_wall_yellow, root)
    create_box("Admin_Wall_North", (0,  HY - wall_t/2.0, (BASE_H + EAVE_Z) / 2.0),
               (2 * HX - 2 * wall_t, wall_t, EAVE_Z - BASE_H), mat_wall_yellow, root)

    # 4. Mid-Floor Architectural Belt Course / Concrete Ledge (Separates 1st & 2nd Floor)
    belt_z = BASE_H + F1_H + SLAB_H / 2.0  # 3.875 m
    create_box("Admin_Belt_North", (0,  HY + 0.04, belt_z),
               (2 * HX + 0.20, 0.12, SLAB_H), mat_belt_course, root)
    create_box("Admin_Belt_South", (0, -HY - 0.04, belt_z),
               (2 * HX + 0.20, 0.12, SLAB_H), mat_belt_course, root)
    create_box("Admin_Belt_West", (-HX - 0.04, 0, belt_z),
               (0.12, 2 * HY, SLAB_H), mat_belt_course, root)
    create_box("Admin_Belt_East", ( HX + 0.04, 0, belt_z),
               (0.12, 2 * HY, SLAB_H), mat_belt_course, root)

    # -----------------------------------------------------------------------
    # SOUTH FACADE (IMG_3810, Facing Canteen, Entrance 7, Y = -HY = -9.84 m)
    # -----------------------------------------------------------------------
    # 5. South Cantilevered Entrance Portico / Canopy (Authentic Airtight Solid Geometry)
    # Prominent rectangular entrance canopy over the main doors (IMG_3810)
    portico_w = 3.10
    portico_x0 = -1.55
    portico_x1 =  1.55
    y_wall = -HY
    portico_proj = 2.50
    y_front = y_wall - portico_proj
    z_soffit = 3.28  # Flat ceiling soffit (~3cm above door frame)
    z_wall = 3.62    # Wall attachment height of roof
    z_eave = 3.40    # Front eave height of roof

    # Multi-material Solid Prism Mesh (watertight, zero gaps)
    mesh_canopy = bpy.data.meshes.new("Admin_Portico_Canopy_Mesh")
    obj_canopy = bpy.data.objects.new("Admin_Portico_Canopy", mesh_canopy)
    bpy.context.scene.collection.objects.link(obj_canopy)
    obj_canopy.parent = root

    obj_canopy.data.materials.append(mat_roof_green)    # mat index 0
    obj_canopy.data.materials.append(mat_fascia_green)  # mat index 1
    obj_canopy.data.materials.append(mat_soffit)        # mat index 2

    bm_c = bmesh.new()
    # Bottom soffit vertices
    vc0 = bm_c.verts.new((portico_x0, y_wall, z_soffit))
    vc1 = bm_c.verts.new((portico_x1, y_wall, z_soffit))
    vc2 = bm_c.verts.new((portico_x1, y_front, z_soffit))
    vc3 = bm_c.verts.new((portico_x0, y_front, z_soffit))

    # Top roof vertices
    vc4 = bm_c.verts.new((portico_x0, y_wall, z_wall))
    vc5 = bm_c.verts.new((portico_x1, y_wall, z_wall))
    vc6 = bm_c.verts.new((portico_x1, y_front, z_eave))
    vc7 = bm_c.verts.new((portico_x0, y_front, z_eave))

    # Faces:
    # 1. Top sloped roof (mat index 0)
    f_top = bm_c.faces.new([vc4, vc7, vc6, vc5])
    f_top.material_index = 0

    # 2. Front fascia (mat index 1)
    f_front = bm_c.faces.new([vc3, vc2, vc6, vc7])
    f_front.material_index = 1

    # 3. West fascia (closed tapered quad, mat index 1)
    f_west = bm_c.faces.new([vc0, vc3, vc7, vc4])
    f_west.material_index = 1

    # 4. East fascia (closed tapered quad, mat index 1)
    f_east = bm_c.faces.new([vc2, vc1, vc5, vc6])
    f_east.material_index = 1

    # 5. Bottom soffit ceiling (mat index 2)
    f_bot = bm_c.faces.new([vc0, vc1, vc2, vc3])
    f_bot.material_index = 2

    # 6. Back face against wall
    f_back = bm_c.faces.new([vc1, vc0, vc4, vc5])
    f_back.material_index = 2

    bm_c.normal_update()
    bm_c.to_mesh(mesh_canopy)
    bm_c.free()

    # Standing seam ribs on canopy roof top running down the slope (IMG_3810)
    rot_slope = math.atan2(z_wall - z_eave, portico_proj)
    hypot_slope = math.hypot(portico_proj, z_wall - z_eave)
    num_portico_ribs = 7
    for r_i in range(num_portico_ribs):
        rx = portico_x0 + 0.15 + r_i * ((portico_w - 0.30) / (num_portico_ribs - 1))
        create_box(f"Admin_Portico_Rib_{r_i}",
                   (rx, (y_wall + y_front) / 2.0, (z_wall + z_eave) / 2.0 + 0.012),
                   (0.035, hypot_slope, 0.024), mat_fascia_green, root,
                   rot=(rot_slope, 0, 0))

    # Underside downlights on porch ceiling
    mat_downlight = create_mat("Mat_Admin_Downlight", (1.0, 0.95, 0.85), roughness=0.2, emission=(1.0, 0.95, 0.85, 2.0))
    for dl_x in [-0.60, 0.60]:
        create_cylinder(f"Admin_Portico_Light_{dl_x}",
                        (dl_x, (y_wall + y_front) / 2.0, z_soffit + 0.005),
                        0.14, 0.02, mat_downlight,
                        segments=12, parent=root)

    # South entrance concrete stoop step
    create_box("Admin_South_Entrance_Step", (0.0, -HY - 0.40, BASE_H / 2.0),
               (2.00, 0.80, BASE_H), mat_base_plinth, root)

    # 6. South Main Entrance Double Doors (Under Portico)
    door_y = -HY - 0.02
    create_quads("Admin_South_Door_Glass", [
        (-0.65, 0.65, BASE_H, BASE_H + 2.25),
        (-0.65, 0.65, BASE_H + 2.30, BASE_H + 2.80)  # Transom
    ], 'XZ', door_y, -1, mat_glass, root)

    create_quads("Admin_South_Door_Frames", [
        (-0.70,  0.70, BASE_H, BASE_H + 0.05),
        (-0.70,  0.70, BASE_H + 2.25, BASE_H + 2.30),
        (-0.70,  0.70, BASE_H + 2.80, BASE_H + 2.85),
        (-0.70, -0.65, BASE_H, BASE_H + 2.85),
        ( 0.65,  0.70, BASE_H, BASE_H + 2.85),
        (-0.03,  0.03, BASE_H, BASE_H + 2.25)
    ], 'XZ', door_y - 0.005, -1, mat_frame_dark, root)

    # 7. Prominent Embossed Metallic Wall Signage (IMG_3810)
    # Right of entrance doors: "STIARC MULTI-FUNCTION" / "ADMIN. BLDG."
    rot_south = (math.radians(90), 0, 0)
    sign_x = 2.45
    sign_y = -HY - 0.015
    create_text_mesh("Admin_Sign_L1", (sign_x, sign_y, BASE_H + 2.00),
                     "STIARC MULTI-FUNCTION", 0.16, mat_sign_gold,
                     rot=rot_south, parent=root, align='CENTER', res=0)
    create_text_mesh("Admin_Sign_L2", (sign_x, sign_y, BASE_H + 1.74),
                     "ADMIN. BLDG.", 0.16, mat_sign_gold,
                     rot=rot_south, parent=root, align='CENTER', res=0)

    # 8. South Facade Window Bays (1st & 2nd Floor, IMG_3810)
    # Ground floor window on left:
    south_win_glass = [
        (-3.80, -1.80, BASE_H + 0.85, BASE_H + 2.50)  # Ground floor left
    ]
    south_win_frame = [
        (-3.85, -1.75, BASE_H + 0.80, BASE_H + 0.85),
        (-3.85, -1.75, BASE_H + 2.50, BASE_H + 2.55),
        (-3.85, -3.80, BASE_H + 0.80, BASE_H + 2.55),
        (-1.80, -1.75, BASE_H + 0.80, BASE_H + 2.55),
        (-2.82, -2.78, BASE_H + 0.80, BASE_H + 2.55)
    ]

    # Second floor windows (3 bays: x = -2.8, +0.5, +3.2)
    f2_win_z0 = belt_z + 0.85  # 4.725 m
    f2_win_z1 = belt_z + 2.45  # 6.325 m
    for wx in [-2.80, 0.50, 3.20]:
        w0 = wx - 1.00
        w1 = wx + 1.00
        south_win_glass.append((w0, w1, f2_win_z0, f2_win_z1))
        south_win_frame.append((w0 - 0.04, w1 + 0.04, f2_win_z0 - 0.04, f2_win_z0))
        south_win_frame.append((w0 - 0.04, w1 + 0.04, f2_win_z1, f2_win_z1 + 0.04))
        south_win_frame.append((w0 - 0.04, w0, f2_win_z0, f2_win_z1))
        south_win_frame.append((w1, w1 + 0.04, f2_win_z0, f2_win_z1))
        south_win_frame.append((wx - 0.02, wx + 0.02, f2_win_z0, f2_win_z1))
        south_win_frame.append((w0, w1, f2_win_z1 - 0.45, f2_win_z1 - 0.40))  # Transom bar

    create_quads("Admin_WinGlass_South", south_win_glass, 'XZ', -HY - 0.02, -1, mat_glass, root)
    create_quads("Admin_WinFrame_South", south_win_frame, 'XZ', -HY - 0.025, -1, mat_frame_white, root)

    # AC units protruding from 2nd floor windows (IMG_3810)
    for i, acx in enumerate([-2.80, 0.50]):
        create_box(f"Admin_AC_South_{i}", (acx, -HY - 0.32, f2_win_z0 + 0.42),
                   (0.68, 0.55, 0.44), mat_ac_case, root)
        create_quads(f"Admin_AC_Grille_S_{i}", [(acx - 0.30, acx + 0.30, f2_win_z0 + 0.24, f2_win_z0 + 0.60)],
                     'XZ', -HY - 0.60, -1, mat_ac_grille, root)

    # South facade PVC downspouts (IMG_3810)
    create_cylinder("Admin_Downspout_S_L", (-HX + 0.25, -HY - 0.08, EAVE_Z / 2.0),
                    0.05, EAVE_Z, mat_downspout, segments=8, parent=root)
    create_cylinder("Admin_Downspout_S_R", ( HX - 0.25, -HY - 0.08, EAVE_Z / 2.0),
                    0.05, EAVE_Z, mat_downspout, segments=8, parent=root)

    # -----------------------------------------------------------------------
    # NORTH FACADE (IMG_3805 & IMG_3806, Facing Compound Road, Entrance 8, Y = +HY = +9.84 m)
    # -----------------------------------------------------------------------
    # 9. Detailed Continuous Ground-Floor Canopy & Carport Link
    # Connects seamlessly to ORED's canopy across the breezeway!
    # Pitch: Slopes DOWNWARDS from wall attachment (3.30m) down to outer eave (2.45m).
    canopy_n_x0 = -6.10   # Overlaps breezeway to join ORED!
    canopy_n_x1 =  4.35   # East edge covering East bay window & ramp entrance
    canopy_n_w  = canopy_n_x1 - canopy_n_x0  # ~10.45 m
    canopy_n_cx = (canopy_n_x0 + canopy_n_x1) / 2.0
    canopy_n_proj = 2.40  # Projects outward along +Y into driveway
    canopy_n_cy = HY + canopy_n_proj / 2.0
    canopy_n_zhi = 3.30   # Wall attachment height below 2nd floor windows
    canopy_n_zlo = 2.45   # Outer eave height (matches ORED canopy eave!)
    canopy_n_rot = math.atan2(canopy_n_zhi - canopy_n_zlo, canopy_n_proj)
    slope_hypot  = math.hypot(canopy_n_proj, canopy_n_zhi - canopy_n_zlo) # ~2.547 m

    # Solid sloped canopy roof slab (sloping DOWNWARDS into +Y: rot=(-canopy_n_rot, 0, 0))
    create_box("Admin_North_Canopy_Roof", (canopy_n_cx, canopy_n_cy, (canopy_n_zhi + canopy_n_zlo) / 2.0),
               (canopy_n_w, slope_hypot + 0.12, 0.07), mat_roof_green, root,
               rot=(-canopy_n_rot, 0, 0))

    # Corrugated standing ribs on North canopy running down the slope (IMG_3805 & 3806)
    num_n_ribs = 16
    for r_i in range(num_n_ribs):
        rx = canopy_n_x0 + 0.25 + r_i * ((canopy_n_w - 0.50) / max(num_n_ribs - 1, 1))
        create_box(f"Admin_Canopy_Rib_{r_i}", (rx, canopy_n_cy, (canopy_n_zhi + canopy_n_zlo) / 2.0 + 0.04),
                   (0.045, slope_hypot + 0.14, 0.025), mat_corrugated_rib, root,
                   rot=(-canopy_n_rot, 0, 0))

    # Outer dark green fascia beam along North eave (facing +Y)
    f_y_n = HY + canopy_n_proj + 0.05
    create_box("Admin_North_Canopy_Fascia", (canopy_n_cx, f_y_n, canopy_n_zlo),
               (canopy_n_w + 0.12, 0.08, 0.22), mat_fascia_green, root)

    # East return fascia
    create_box("Admin_North_Canopy_Fascia_East", (canopy_n_x1 + 0.04, canopy_n_cy, (canopy_n_zhi + canopy_n_zlo) / 2.0),
               (0.08, slope_hypot + 0.10, 0.20), mat_fascia_green, root,
               rot=(-canopy_n_rot, 0, 0))

    # Transverse rafters under North canopy resting on header beam
    rafter_depth = 0.10
    for r_idx, rx in enumerate([-5.50, -3.20, -0.80, 1.60, 3.80]):
        create_box(f"Admin_Canopy_Rafter_{r_idx}", (rx, canopy_n_cy, (canopy_n_zhi + canopy_n_zlo) / 2.0 - 0.05),
                   (0.10, slope_hypot - 0.05, rafter_depth), mat_fascia_green, root,
                   rot=(-canopy_n_rot, 0, 0))

    # Heavy structural horizontal header beam directly carrying the rafters & canopy
    beam_y_n = HY + canopy_n_proj - 0.22
    beam_z_n = canopy_n_zlo - 0.08  # ~2.37 m, sits directly under rafters
    beam_h_n = 0.22
    create_box("Admin_North_Canopy_HeaderBeam", (canopy_n_cx, beam_y_n, beam_z_n),
               (canopy_n_w, 0.28, beam_h_n), mat_belt_course, root)

    # Concrete pillars supporting North canopy (IMG_3805 & IMG_3806):
    # With dark maroon skirting base (0.65m) and cream upper shaft
    col_w = 0.38
    col_d = 0.36
    base_col_h = 0.65
    shaft_top_n = beam_z_n - beam_h_n / 2.0  # 2.37 - 0.11 = 2.26 m (touches bottom of header beam!)
    col_upper_n = max(shaft_top_n - base_col_h, 0.5)

    # 3 substantial pillars supporting header beam: Breezeway (x=-5.5), Mid (x=-0.8), East (x=3.8)
    for p_i, px in enumerate([-5.50, -0.80, 3.80]):
        create_box(f"Admin_Canopy_PillarBase_{p_i}", (px, beam_y_n, base_col_h / 2.0),
                   (col_w + 0.05, col_d + 0.05, base_col_h), mat_maroon, root)
        create_box(f"Admin_Canopy_PillarShaft_{p_i}", (px, beam_y_n, base_col_h + col_upper_n / 2.0),
                   (col_w, col_d, col_upper_n), mat_wall_yellow, root)

    # 10. North Entrance Ramp with Stainless Steel Handrails (IMG_3805)
    # Positioned at the East bay (x = 1.90 to 4.70 m) leading to entrance deck
    ramp_x0 = 1.90
    ramp_x1 = 4.70
    ramp_w  = ramp_x1 - ramp_x0
    ramp_cx = (ramp_x0 + ramp_x1) / 2.0
    ramp_proj = 1.40
    ramp_cy = HY + ramp_proj / 2.0
    # Ramp slab
    create_box("Admin_North_Ramp_Slab", (ramp_cx, ramp_cy, BASE_H / 2.0),
               (ramp_w, ramp_proj, BASE_H), mat_base_plinth, root)
    # Handrails (Stainless steel rails along East and North edges of ramp)
    hr_z = BASE_H + 0.85
    create_cylinder("Admin_Handrail_Post_1", (ramp_x1 - 0.08, ramp_cy + 0.5, hr_z / 2.0),
                    0.025, hr_z, mat_handrail, segments=8, parent=root)
    create_cylinder("Admin_Handrail_Post_2", (ramp_x1 - 0.08, ramp_cy - 0.5, hr_z / 2.0),
                    0.025, hr_z, mat_handrail, segments=8, parent=root)
    create_beam_between("Admin_Handrail_Top", (ramp_x1 - 0.08, HY + 0.1, hr_z),
                        (ramp_x1 - 0.08, HY + ramp_proj - 0.1, hr_z), 0.04, 0.04, mat_handrail, root)
    create_beam_between("Admin_Handrail_Mid", (ramp_x1 - 0.08, HY + 0.1, hr_z - 0.40),
                        (ramp_x1 - 0.08, HY + ramp_proj - 0.1, hr_z - 0.40), 0.03, 0.03, mat_handrail, root)

    # 11. North Facade Ground-Floor Fenestration (IMG_3805 & IMG_3806)
    # Strictly ONE main entrance door located in the MIDDLE part (behind black car).
    # West bay and East bay under the canopy roof are regular multi-pane WINDOW bays!
    north_door_glass = []
    north_door_frame = []
    north_win_glass  = []
    north_win_frame  = []

    # A. SINGLE MAIN ENTRANCE DOOR (Center Bay, x = -1.15 to +1.15 m) (IMG_3805 & 3806)
    # Double aluminum-framed glass entrance doors with upper transom
    north_door_glass.append((-1.10,  1.10, BASE_H + 0.05, BASE_H + 2.20))
    north_door_glass.append((-1.10,  1.10, BASE_H + 2.26, BASE_H + 2.75)) # Transom
    north_door_frame.append((-1.15,  1.15, BASE_H, BASE_H + 0.05))         # Sill threshold
    north_door_frame.append((-1.15,  1.15, BASE_H + 2.20, BASE_H + 2.26))  # Transom bar
    north_door_frame.append((-1.15,  1.15, BASE_H + 2.75, BASE_H + 2.80))  # Header frame
    north_door_frame.append((-1.15, -1.10, BASE_H, BASE_H + 2.80))        # Left jamb
    north_door_frame.append(( 1.10,  1.15, BASE_H, BASE_H + 2.80))        # Right jamb
    north_door_frame.append((-0.03,  0.03, BASE_H + 0.05, BASE_H + 2.20))  # Center door split

    # Door handles on Center Main Entrance
    create_box("Admin_Door_Handle_Center_L", (-0.12, HY + 0.04, BASE_H + 1.05),
               (0.04, 0.06, 0.28), mat_handrail, root)
    create_box("Admin_Door_Handle_Center_R", ( 0.12, HY + 0.04, BASE_H + 1.05),
               (0.04, 0.06, 0.28), mat_handrail, root)

    # Concrete entrance step stoop in front of center door
    create_box("Admin_North_Entrance_Step", (0.00, HY + 0.35, BASE_H / 2.0),
               (2.60, 0.70, BASE_H), mat_base_plinth, root)

    # B. East Bay WINDOW (x = 2.15 to 4.25 m, behind white car & adjacent to ramp in IMG_3805)
    # Window with sill above plinth, under the small roof!
    f1_win_z0 = BASE_H + 0.85  # 1.25 m sill
    f1_win_z1 = BASE_H + 2.45  # 2.85 m head
    east_w0, east_w1 = 2.15, 4.25
    north_win_glass.append((east_w0, east_w1, f1_win_z0, f1_win_z1))
    north_win_frame.append((east_w0 - 0.04, east_w1 + 0.04, f1_win_z0 - 0.04, f1_win_z0))
    north_win_frame.append((east_w0 - 0.04, east_w1 + 0.04, f1_win_z1, f1_win_z1 + 0.04))
    north_win_frame.append((east_w0 - 0.04, east_w0, f1_win_z0, f1_win_z1))
    north_win_frame.append((east_w1, east_w1 + 0.04, f1_win_z0, f1_win_z1))
    east_mid = (east_w0 + east_w1) / 2.0
    north_win_frame.append((east_mid - 0.02, east_mid + 0.02, f1_win_z0, f1_win_z1))
    north_win_frame.append((east_w0, east_w1, f1_win_z1 - 0.40, f1_win_z1 - 0.35)) # Transom

    # C. West Bay WINDOW (x = -4.25 to -2.15 m, with dark green notice/privacy panel in IMG_3806)
    west_w0, west_w1 = -4.25, -2.15
    north_win_glass.append((west_w0, west_w1, f1_win_z0, f1_win_z1))
    north_win_frame.append((west_w0 - 0.04, west_w1 + 0.04, f1_win_z0 - 0.04, f1_win_z0))
    north_win_frame.append((west_w0 - 0.04, west_w1 + 0.04, f1_win_z1, f1_win_z1 + 0.04))
    north_win_frame.append((west_w0 - 0.04, west_w0, f1_win_z0, f1_win_z1))
    north_win_frame.append((west_w1, west_w1 + 0.04, f1_win_z0, f1_win_z1))
    west_mid = (west_w0 + west_w1) / 2.0
    north_win_frame.append((west_mid - 0.02, west_mid + 0.02, f1_win_z0, f1_win_z1))
    north_win_frame.append((west_w0, west_w1, f1_win_z1 - 0.40, f1_win_z1 - 0.35)) # Transom

    # Dark green notice / privacy panel on lower window (IMG_3806)
    create_box("Admin_North_Notice_Board", (west_mid, HY + 0.03, BASE_H + 0.42),
               (west_w1 - west_w0, 0.03, 0.75), mat_roof_green, root)

    # D. Second Floor Windows (3 wide 4-pane bays: wx = -3.2, 0.0, 3.2, IMG_3805)
    for wx in [-3.20, 0.00, 3.20]:
        w0 = wx - 1.25
        w1 = wx + 1.25
        north_win_glass.append((w0, w1, f2_win_z0, f2_win_z1))
        north_win_frame.append((w0 - 0.04, w1 + 0.04, f2_win_z0 - 0.04, f2_win_z0))
        north_win_frame.append((w0 - 0.04, w1 + 0.04, f2_win_z1, f2_win_z1 + 0.04))
        north_win_frame.append((w0 - 0.04, w0, f2_win_z0, f2_win_z1))
        north_win_frame.append((w1, w1 + 0.04, f2_win_z0, f2_win_z1))
        m1 = w0 + 2.50 / 3.0
        m2 = w0 + 2 * 2.50 / 3.0
        north_win_frame.append((m1 - 0.02, m1 + 0.02, f2_win_z0, f2_win_z1))
        north_win_frame.append((m2 - 0.02, m2 + 0.02, f2_win_z0, f2_win_z1))
        north_win_frame.append((w0, w1, f2_win_z1 - 0.45, f2_win_z1 - 0.40))  # Transom

    create_quads("Admin_North_Door_Glass", north_door_glass, 'XZ', HY + 0.02, 1, mat_glass, root)
    create_quads("Admin_North_Door_Frame", north_door_frame, 'XZ', HY + 0.025, 1, mat_frame_dark, root)
    create_quads("Admin_WinGlass_North", north_win_glass, 'XZ', HY + 0.02, 1, mat_glass, root)
    create_quads("Admin_WinFrame_North", north_win_frame, 'XZ', HY + 0.025, 1, mat_frame_white, root)

    # North Entrance Header Signage above the single center door
    rot_north = (math.radians(90), 0, math.radians(180))
    create_text_mesh("Admin_North_Sign", (0.0, HY + 0.03, BASE_H + 2.88),
                     "ADMINISTRATION BUILDING", 0.14, mat_sign_gold,
                     rot=rot_north, parent=root, align='CENTER', res=0)

    # 2nd Floor window AC units & split compressor (IMG_3805)
    for i, acx in enumerate([-3.20, 3.20]):
        create_box(f"Admin_AC_North_{i}", (acx, HY + 0.32, f2_win_z0 + 0.42),
                   (0.68, 0.55, 0.44), mat_ac_case, root)
        create_quads(f"Admin_AC_Grille_N_{i}", [(acx - 0.30, acx + 0.30, f2_win_z0 + 0.24, f2_win_z0 + 0.60)],
                     'XZ', HY + 0.60, 1, mat_ac_grille, root)

    create_box("Admin_AC_Split_North", (1.60, HY + 0.24, f2_win_z0 + 0.70),
               (0.85, 0.38, 0.60), mat_ac_case, root)
    create_cylinder("Admin_AC_Split_Fan", (1.60, HY + 0.44, f2_win_z0 + 0.70),
                    0.22, 0.02, mat_ac_grille, segments=12, rot=(math.radians(90), 0, 0), parent=root)

    # Downspouts discharging onto canopy roof
    for dx in [-1.50, 1.50]:
        create_cylinder(f"Admin_Downspout_N_{dx}", (dx, HY + 0.08, (EAVE_Z + canopy_n_zhi) / 2.0),
                        0.04, EAVE_Z - canopy_n_zhi, mat_downspout, segments=8, parent=root)

    # -----------------------------------------------------------------------
    # WEST ELEVATION (Overlooking Breezeway & ORED Building, X = -HX = -5.35 m)
    # -----------------------------------------------------------------------
    # 12. Breezeway Office Windows (1st & 2nd Floor)
    west_win_glass = []
    west_win_frame = []
    west_win_ys = [-6.5, -2.5, 1.5, 5.5]
    for wy in west_win_ys:
        y0 = wy - 1.10
        y1 = wy + 1.10
        # Ground floor
        west_win_glass.append((y0, y1, BASE_H + 0.85, BASE_H + 2.45))
        west_win_frame.append((y0 - 0.04, y1 + 0.04, BASE_H + 0.80, BASE_H + 0.85))
        west_win_frame.append((y0 - 0.04, y1 + 0.04, BASE_H + 2.45, BASE_H + 2.50))
        west_win_frame.append((y0 - 0.04, y0, BASE_H + 0.80, BASE_H + 2.50))
        west_win_frame.append((y1, y1 + 0.04, BASE_H + 0.80, BASE_H + 2.50))
        west_win_frame.append((wy - 0.02, wy + 0.02, BASE_H + 0.80, BASE_H + 2.50))
        # Second floor
        west_win_glass.append((y0, y1, f2_win_z0, f2_win_z1))
        west_win_frame.append((y0 - 0.04, y1 + 0.04, f2_win_z0 - 0.04, f2_win_z0))
        west_win_frame.append((y0 - 0.04, y1 + 0.04, f2_win_z1, f2_win_z1 + 0.04))
        west_win_frame.append((y0 - 0.04, y0, f2_win_z0, f2_win_z1))
        west_win_frame.append((y1, y1 + 0.04, f2_win_z0, f2_win_z1))
        west_win_frame.append((wy - 0.02, wy + 0.02, f2_win_z0, f2_win_z1))

    create_quads("Admin_WinGlass_West", west_win_glass, 'YZ', -HX - 0.02, -1, mat_glass, root)
    create_quads("Admin_WinFrame_West", west_win_frame, 'YZ', -HX - 0.025, -1, mat_frame_white, root)

    # 2nd Floor window AC units on West breezeway wall
    for i, acy in enumerate([-6.5, 1.5]):
        create_box(f"Admin_AC_West_{i}", (-HX - 0.28, acy, f2_win_z0 + 0.40),
                   (0.48, 0.60, 0.42), mat_ac_case, root)

    # -----------------------------------------------------------------------
    # EAST ELEVATION (Facing Compound East Lawn, X = +HX = +5.35 m)
    # -----------------------------------------------------------------------
    # 13. East Office Windows
    east_win_glass = []
    east_win_frame = []
    for wy in west_win_ys:
        y0 = wy - 1.10
        y1 = wy + 1.10
        # Ground floor
        east_win_glass.append((y0, y1, BASE_H + 0.85, BASE_H + 2.45))
        east_win_frame.append((y0 - 0.04, y1 + 0.04, BASE_H + 0.80, BASE_H + 0.85))
        east_win_frame.append((y0 - 0.04, y1 + 0.04, BASE_H + 2.45, BASE_H + 2.50))
        east_win_frame.append((y0 - 0.04, y0, BASE_H + 0.80, BASE_H + 2.50))
        east_win_frame.append((y1, y1 + 0.04, BASE_H + 0.80, BASE_H + 2.50))
        east_win_frame.append((wy - 0.02, wy + 0.02, BASE_H + 0.80, BASE_H + 2.50))
        # Second floor
        east_win_glass.append((y0, y1, f2_win_z0, f2_win_z1))
        east_win_frame.append((y0 - 0.04, y1 + 0.04, f2_win_z0 - 0.04, f2_win_z0))
        east_win_frame.append((y0 - 0.04, y1 + 0.04, f2_win_z1, f2_win_z1 + 0.04))
        east_win_frame.append((y0 - 0.04, y0, f2_win_z0, f2_win_z1))
        east_win_frame.append((y1, y1 + 0.04, f2_win_z0, f2_win_z1))
        east_win_frame.append((wy - 0.02, wy + 0.02, f2_win_z0, f2_win_z1))

    create_quads("Admin_WinGlass_East", east_win_glass, 'YZ', HX + 0.02, 1, mat_glass, root)
    create_quads("Admin_WinFrame_East", east_win_frame, 'YZ', HX + 0.025, 1, mat_frame_white, root)

    # -----------------------------------------------------------------------
    # 14. Main Two-Storey Hip Roof Structure & Fascia (Eaves 7.2m, Ridge 9.2m)
    # -----------------------------------------------------------------------
    OVERHANG = 0.85
    RHX = HX + OVERHANG  # 6.20 m
    RHY = HY + OVERHANG  # 10.69 m

    roof_obj, ridge_len, ridge_is_y = create_hip_roof(
        "Admin_Main_Roof", RHX, RHY, EAVE_Z, RIDGE_Z,
        mat_roof_green, mat_soffit, parent=root
    )

    f_h = 0.32
    f_t = 0.08
    f_z = EAVE_Z - f_h / 2.0 + 0.02

    create_box("Admin_Fascia_North", (0,  RHY + f_t/2.0, f_z),
               (2 * RHX + 2 * f_t, f_t, f_h), mat_fascia_green, root)
    create_box("Admin_Fascia_South", (0, -RHY - f_t/2.0, f_z),
               (2 * RHX + 2 * f_t, f_t, f_h), mat_fascia_green, root)
    create_box("Admin_Fascia_West", (-RHX - f_t/2.0, 0, f_z),
               (f_t, 2 * RHY, f_h), mat_fascia_green, root)
    create_box("Admin_Fascia_East", ( RHX + f_t/2.0, 0, f_z),
               (f_t, 2 * RHY, f_h), mat_fascia_green, root)

    # Ridge and hip caps
    cap_w = 0.26
    cap_h = 0.05
    cap_z = 0.035
    if ridge_is_y:
        create_box("Admin_RidgeCap", (0, 0, RIDGE_Z + cap_z),
                   (cap_w, 2 * ridge_len, cap_h), mat_roof_cap, root)
        hip_corners = [
            (-RHX, -RHY, -ridge_len),
            ( RHX, -RHY, -ridge_len),
            ( RHX,  RHY,  ridge_len),
            (-RHX,  RHY,  ridge_len)
        ]
        for i, (hx_c, hy_c, ry) in enumerate(hip_corners):
            create_beam_between(f"Admin_HipCap_{i}", (hx_c, hy_c, EAVE_Z + cap_z),
                                (0, ry, RIDGE_Z + cap_z), cap_w, cap_h, mat_roof_cap, root)

    # Subtle corrugated standing seam ribs along the main roof slopes
    rib_w = 0.035
    rib_h = 0.020
    slope_dz = RIDGE_Z - EAVE_Z
    for side, sx in [("W", -1), ("E", 1)]:
        for k in range(1, 4):
            t = k / 4.0
            x = sx * RHX * (1 - t)
            z = EAVE_Z + slope_dz * t + 0.015
            half_y = ridge_len + (RHY - ridge_len) * (1 - t)
            create_beam_between(f"Admin_Rib_{side}_{k}", (x, -half_y, z), (x, half_y, z),
                                rib_w, rib_h, mat_roof_cap, root)

    # -----------------------------------------------------------------------
    # 15. GLB Export
    # -----------------------------------------------------------------------
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\admin_building.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=False
    )

    size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"=====================================================================")
    print(f" Successfully Exported Admin Building GLB: {glb_out}")
    print(f" GLB File Size: {size_kb:.1f} KB (Budget: <= 300 KB)")
    print(f"=====================================================================")
    return root


# Execute build when run in Blender
build_admin_building()
