"""
build_ored_building.py — Authentic Bespoke 3D Model of the DA-LARES ORED Building
(Department of Agriculture - Regional Field Office No. IV-A CALABARZON, Office of the Regional Executive Director)

Ground-Truth Photographic Reference:
1. IMG_3808 (Front Elevation, West facade facing the roads.json entrance node):
   - 1-storey sage/mint green concrete structure with raised plinth base.
   - Deep entrance portico with architectural grey parapet canopy.
   - Bold white lettering on the canopy fascia:
       "DEPARTMENT OF AGRICULTURE"
       "REGIONAL FIELD OFFICE NO. IV-A (CALABARZON)"
       "LARES, MARAWOY, LIPA CITY, BATANGAS 4217"
     with circular DA logo medallion on the left (white round badge with gold rim and green seal).
   - Elevated entrance porch with cream/beige tiled floor and 4 wide concrete steps.
   - Flanking planter curb walls and large informational bulletin boards on the facade.
   - Aluminum-framed dark glass double entrance doors with sidelights and transoms.
   - Split-type AC compressor unit mounted on front wall.
2. IMG_3807 & IMG_3806 (Left Side, North facade & Breezeway Link):
   - Blue-slate vertical pilasters / corner column accents.
   - Multiple office window bays with window-mounted AC units.
   - Toward the east: authentic carport / walkway link canopy connecting to Admin Building (IMG_3806):
     - Thick rectangular concrete pillars with dark maroon base and warm cream upper shafts.
     - Heavy structural header beam carrying the sloped green corrugated metal roof.
     - Green fascia trim and transverse rafters underneath.
     - Extends across the breezeway to flush-join the 2-storey Admin Building.
3. IMG_3809 (Right Side, South facade):
   - Full 5-bay elevation divided by blue-slate pilasters.
   - Raised foundation with decorative ventilation breeze blocks along the crawlspace.
   - Large multi-pane office windows with dark frames and transoms.
   - 3 window-mounted AC units protruding from windows, plus wall-mounted split AC compressor.
   - Exterior metal maintenance ladder near the southeast corner.
   - Low-pitch dark green hip roof with two-tier green fascia and white soffit.

Orientation: Front entrance faces West (roads.json entrance at [121.16607695, 13.95878132]).
In Blender: Front entrance is modeled along -Y.
Mapbox rotation: 90.0° (West).
Performance Budget: strictly < 300 KB GLB.
Strictly ZERO external outdoor props (no trees, grass slabs, streetlamps, curbs, or vehicles).
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


def create_text_mesh(name, loc, text, size, mat, rot=(0, 0, 0), parent=None, align='CENTER', res=1):
    c_data = bpy.data.curves.new(name=name + "_Data", type='FONT')
    c_data.body = text
    c_data.size = size
    c_data.extrude = 0.008
    c_data.resolution_u = res
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
def build_ored_building():
    print("=====================================================================")
    print(" Building Authentic ORED Building with Detailed Connecting Canopy    ")
    print("=====================================================================")

    # Clear previous objects
    for obj in list(bpy.data.objects):
        if obj.type in ['MESH', 'CURVE', 'FONT', 'LIGHT', 'EMPTY', 'CAMERA']:
            bpy.data.objects.remove(obj, do_unlink=True)
    for m in list(bpy.data.meshes):
        bpy.data.meshes.remove(m)
    for c in list(bpy.data.curves):
        bpy.data.curves.remove(c)

    root = bpy.data.objects.new("ORED_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # -----------------------------------------------------------------------
    # PBR Materials
    # -----------------------------------------------------------------------
    mat_wall_green     = create_mat("Mat_ORED_WallGreen",     (0.42, 0.65, 0.48), roughness=0.75)
    mat_base_cream     = create_mat("Mat_ORED_BaseCream",     (0.83, 0.80, 0.73), roughness=0.85)
    mat_pilaster_slate = create_mat("Mat_ORED_PilasterSlate", (0.33, 0.40, 0.46), roughness=0.65)
    mat_portico_grey   = create_mat("Mat_ORED_PorticoGrey",   (0.42, 0.45, 0.47), roughness=0.55)
    mat_portico_top    = create_mat("Mat_ORED_PorticoTop",    (0.36, 0.39, 0.41), roughness=0.50)
    mat_portico_soffit = create_mat("Mat_ORED_PorticoSoffit", (0.92, 0.93, 0.92), roughness=0.80)
    mat_porch_tile     = create_mat("Mat_ORED_PorchTile",     (0.78, 0.73, 0.65), roughness=0.45)
    mat_steps_conc     = create_mat("Mat_ORED_StepsConc",     (0.68, 0.69, 0.67), roughness=0.80)
    mat_stone_cap      = create_mat("Mat_ORED_StoneCap",      (0.28, 0.30, 0.30), roughness=0.60)
    mat_frame_dark     = create_mat("Mat_ORED_FrameDark",     (0.12, 0.13, 0.14), roughness=0.50, metallic=0.4)
    mat_frame_highlight= create_mat("Mat_ORED_FrameHi",       (0.25, 0.26, 0.28), roughness=0.45, metallic=0.5)
    mat_glass          = create_mat("Mat_ORED_Glass",          (0.12, 0.16, 0.18), roughness=0.15, metallic=0.35, specular=0.9)
    mat_interior       = create_mat("Mat_ORED_Interior",       (0.12, 0.13, 0.14), roughness=0.90)
    mat_roof_green     = create_mat("Mat_ORED_RoofGreen",     (0.12, 0.28, 0.18), roughness=0.45, metallic=0.55)
    mat_roof_cap       = create_mat("Mat_ORED_RoofCap",       (0.09, 0.22, 0.13), roughness=0.50, metallic=0.5)
    mat_fascia_green   = create_mat("Mat_ORED_FasciaGreen",   (0.08, 0.22, 0.13), roughness=0.60)
    mat_soffit         = create_mat("Mat_ORED_Soffit",         (0.91, 0.92, 0.90), roughness=0.85)
    mat_sign_white     = create_mat("Mat_ORED_SignWhite",     (0.96, 0.96, 0.96), roughness=0.35, specular=0.6)
    mat_seal_white     = create_mat("Mat_ORED_SealWhite",     (0.95, 0.95, 0.94), roughness=0.35)
    mat_seal_gold      = create_mat("Mat_ORED_SealGold",      (0.88, 0.72, 0.15), roughness=0.35, metallic=0.6)
    mat_seal_green     = create_mat("Mat_ORED_SealGreen",     (0.10, 0.45, 0.20), roughness=0.40)
    mat_banner_white   = create_mat("Mat_ORED_BannerWhite",   (0.94, 0.94, 0.93), roughness=0.50)
    mat_banner_accent  = create_mat("Mat_ORED_BannerAccent",  (0.12, 0.42, 0.26), roughness=0.50)
    mat_banner_line    = create_mat("Mat_ORED_BannerLine",    (0.65, 0.72, 0.68), roughness=0.60)
    mat_ac_case        = create_mat("Mat_ORED_ACCase",        (0.88, 0.88, 0.86), roughness=0.50)
    mat_ac_grille      = create_mat("Mat_ORED_ACGrille",      (0.22, 0.23, 0.24), roughness=0.60)
    mat_vent_block     = create_mat("Mat_ORED_VentBlock",     (0.38, 0.36, 0.33), roughness=0.85)
    mat_awning_roof    = create_mat("Mat_ORED_AwningRoof",    (0.13, 0.30, 0.19), roughness=0.45, metallic=0.55)
    mat_awning_fascia  = create_mat("Mat_ORED_AwningFascia",  (0.08, 0.22, 0.13), roughness=0.55)
    mat_maroon         = create_mat("Mat_ORED_Maroon",        (0.42, 0.10, 0.09), roughness=0.80)
    mat_metal_steel    = create_mat("Mat_ORED_Steel",         (0.25, 0.27, 0.28), roughness=0.55, metallic=0.7)

    # -----------------------------------------------------------------------
    # Dimensions & Geometry
    # -----------------------------------------------------------------------
    # HX = 9.84 matches Admin Building depth (19.68 m) so both buildings
    # and their North & South facades are perfectly parallel!
    HX = 9.84       # half-width along X (19.68 m total across North-South in Mapbox)
    HY = 10.575     # half-depth along Y (21.15 m total across East-West in Mapbox)

    BASE_H = 0.65   # raised crawlspace plinth height
    WALL_H = 3.25   # wall height from base top
    EAVE_Z = BASE_H + WALL_H  # 3.90 m
    RIDGE_Z = 5.75  # hip roof ridge height

    # -----------------------------------------------------------------------
    # 1. Foundation Base & Crawlspace Skirting
    # -----------------------------------------------------------------------
    create_box("ORED_Base_Plinth", (0, 0, BASE_H / 2.0),
               (2 * HX, 2 * HY, BASE_H), mat_base_cream, root)

    create_box("ORED_Base_Trim", (0, 0, BASE_H - 0.02),
               (2 * HX + 0.08, 2 * HY + 0.08, 0.04), mat_base_cream, root)

    vent_rects_south = []
    bay_y_centers = [-8.0, -4.0, 0.0, 4.0, 8.0]
    for by in bay_y_centers:
        vent_rects_south.append((by - 1.2, by + 1.2, 0.18, 0.42))
    create_quads("ORED_VentBlocks_South", vent_rects_south, 'YZ', HX + 0.005, 1, mat_vent_block, root)

    vent_rects_north = []
    for by in bay_y_centers[:4]:
        vent_rects_north.append((by - 1.2, by + 1.2, 0.18, 0.42))
    create_quads("ORED_VentBlocks_North", vent_rects_north, 'YZ', -HX - 0.005, -1, mat_vent_block, root)

    # -----------------------------------------------------------------------
    # 2. Main Building Exterior Walls (Ground Floor)
    # -----------------------------------------------------------------------
    wall_z = BASE_H + WALL_H / 2.0

    # East wall (Rear)
    create_box("ORED_Wall_East", (0, HY - 0.10, wall_z),
               (2 * HX, 0.20, WALL_H), mat_wall_green, root)

    # North wall (Left side)
    create_box("ORED_Wall_North", (-HX + 0.10, 0, wall_z),
               (0.20, 2 * HY, WALL_H), mat_wall_green, root)

    # South wall (Right side)
    create_box("ORED_Wall_South", (HX - 0.10, 0, wall_z),
               (0.20, 2 * HY, WALL_H), mat_wall_green, root)

    # West wall (Front facade - outer flanks outside entrance recess)
    left_flank_cx = (-HX + -3.7) / 2.0
    left_flank_w  = HX - 3.7
    create_box("ORED_Wall_Front_Left", (left_flank_cx, -HY + 0.10, wall_z),
               (left_flank_w, 0.20, WALL_H), mat_wall_green, root)

    right_flank_cx = (3.7 + HX) / 2.0
    create_box("ORED_Wall_Front_Right", (right_flank_cx, -HY + 0.10, wall_z),
               (left_flank_w, 0.20, WALL_H), mat_wall_green, root)

    lintel_h = EAVE_Z - 3.25
    lintel_z = 3.25 + lintel_h / 2.0
    create_box("ORED_Wall_Front_Lintel", (0, -HY + 0.10, lintel_z),
               (7.4, 0.20, lintel_h), mat_wall_green, root)

    create_box("ORED_Interior_Back", (0, -HY + 0.60, BASE_H + 1.5),
               (7.0, 0.10, 3.0), mat_interior, root)

    # -----------------------------------------------------------------------
    # 3. Structural Pilasters & Bay Accents (Blue-Slate)
    # -----------------------------------------------------------------------
    p_w = 0.44
    p_d = 0.44
    pilaster_h = WALL_H + 0.05
    pilaster_z = BASE_H + pilaster_h / 2.0

    corners = [
        ("NW", -HX + p_w/2, -HY + p_d/2),
        ("SW", -HX + p_w/2,  HY - p_d/2),
        ("NE",  HX - p_w/2, -HY + p_d/2),
        ("SE",  HX - p_w/2,  HY - p_d/2)
    ]
    for cname, cx, cy in corners:
        create_box(f"ORED_Pilaster_Corner_{cname}", (cx, cy, pilaster_z),
                   (p_w, p_d, pilaster_h), mat_pilaster_slate, root)

    south_pilaster_ys = [-6.35, -2.12, 2.12, 6.35]
    for i, py in enumerate(south_pilaster_ys):
        create_box(f"ORED_Pilaster_South_{i}", (HX + 0.06, py, pilaster_z),
                   (0.20, 0.42, pilaster_h), mat_pilaster_slate, root)

    for i, py in enumerate(south_pilaster_ys):
        create_box(f"ORED_Pilaster_North_{i}", (-HX - 0.06, py, pilaster_z),
                   (0.20, 0.42, pilaster_h), mat_pilaster_slate, root)

    create_box("ORED_Pilaster_Front_L", (-3.7 - 0.10, -HY - 0.06, pilaster_z),
               (0.40, 0.20, pilaster_h), mat_pilaster_slate, root)
    create_box("ORED_Pilaster_Front_R", ( 3.7 + 0.10, -HY - 0.06, pilaster_z),
               (0.40, 0.20, pilaster_h), mat_pilaster_slate, root)

    # -----------------------------------------------------------------------
    # 4. Front Entrance Portico, Canopy & 3D Signage (IMG_3808)
    # -----------------------------------------------------------------------
    porch_y_front = -12.75
    porch_depth   = abs(porch_y_front - (-HY))
    porch_cy      = (-HY + porch_y_front) / 2.0
    porch_cx      = 0.0
    porch_w       = 7.4

    create_box("ORED_Porch_Slab", (porch_cx, porch_cy, BASE_H / 2.0),
               (porch_w, porch_depth, BASE_H), mat_base_cream, root)

    create_box("ORED_Porch_Tile", (porch_cx, porch_cy, BASE_H + 0.01),
               (porch_w - 0.08, porch_depth - 0.08, 0.02), mat_porch_tile, root)

    num_steps = 4
    step_tread = 0.35
    step_riser = BASE_H / num_steps
    stairs_w   = 6.0
    for s in range(num_steps):
        sz = (num_steps - s - 1) * step_riser + step_riser / 2.0
        sy = porch_y_front - (s + 0.5) * step_tread
        sh = (num_steps - s) * step_riser
        create_box(f"ORED_Step_{s}", (0, sy, sh / 2.0),
                   (stairs_w, step_tread, sh), mat_steps_conc, root)

    planter_w = 0.70
    planter_d = porch_depth + num_steps * step_tread + 0.3
    planter_cy = (-HY + (porch_y_front - num_steps * step_tread)) / 2.0
    planter_h = BASE_H + 0.35
    create_box("ORED_Planter_L", (-3.7 + planter_w/2, planter_cy, planter_h / 2.0),
               (planter_w, planter_d, planter_h), mat_base_cream, root)
    create_box("ORED_Planter_L_Cap", (-3.7 + planter_w/2, planter_cy, planter_h + 0.02),
               (planter_w + 0.06, planter_d + 0.06, 0.04), mat_stone_cap, root)

    create_box("ORED_Planter_R", (3.7 - planter_w/2, planter_cy, planter_h / 2.0),
               (planter_w, planter_d, planter_h), mat_base_cream, root)
    create_box("ORED_Planter_R_Cap", (3.7 - planter_w/2, planter_cy, planter_h + 0.02),
               (planter_w + 0.06, planter_d + 0.06, 0.04), mat_stone_cap, root)

    canopy_y_front = -13.25
    canopy_depth   = abs(canopy_y_front - (-HY))
    canopy_cy      = (-HY + canopy_y_front) / 2.0
    canopy_w       = 7.90

    create_box("ORED_Canopy_Slab", (0, canopy_cy, 3.40),
               (canopy_w, canopy_depth, 0.16), mat_portico_soffit, root)

    parapet_h = 1.05
    parapet_z = 3.35 + parapet_h / 2.0
    parapet_t = 0.16

    create_box("ORED_Canopy_FrontFascia", (0, canopy_y_front - parapet_t/2, parapet_z),
               (canopy_w, parapet_t, parapet_h), mat_portico_grey, root)

    create_box("ORED_Canopy_SideFascia_L", (-canopy_w/2 + parapet_t/2, canopy_cy, parapet_z),
               (parapet_t, canopy_depth, parapet_h), mat_portico_grey, root)
    create_box("ORED_Canopy_SideFascia_R", ( canopy_w/2 - parapet_t/2, canopy_cy, parapet_z),
               (parapet_t, canopy_depth, parapet_h), mat_portico_grey, root)

    create_box("ORED_Canopy_TopLedge", (0, canopy_cy, parapet_z + parapet_h/2 + 0.02),
               (canopy_w + 0.08, canopy_depth + 0.08, 0.04), mat_portico_top, root)

    light_mat = create_mat("Mat_ORED_Downlight", (1.0, 0.95, 0.85), roughness=0.2, emission=(1.0, 0.95, 0.85, 2.0))
    downlight_rects = []
    for lx in [-2.2, 0.0, 2.2]:
        for ly in [-11.4, -12.4]:
            downlight_rects.append((lx - 0.12, lx + 0.12, ly - 0.12, ly + 0.12))
    # Downlight quads on canopy underside
    mesh_dl = bpy.data.meshes.new("ORED_Downlights_Mesh")
    obj_dl = bpy.data.objects.new("ORED_Downlights", mesh_dl)
    bpy.context.scene.collection.objects.link(obj_dl)
    bm_dl = bmesh.new()
    for (x0, x1, y0, y1) in downlight_rects:
        pts = [(x0, y0, 3.31), (x1, y0, 3.31), (x1, y1, 3.31), (x0, y1, 3.31)]
        bm_dl.faces.new([bm_dl.verts.new(p) for p in pts])
    bm_dl.normal_update()
    bm_dl.to_mesh(mesh_dl)
    bm_dl.free()
    obj_dl.data.materials.append(light_mat)
    obj_dl.parent = root

    sign_y = canopy_y_front - parapet_t - 0.005
    rot_front = (math.radians(90), 0, 0)

    seal_x = -2.85
    seal_z = parapet_z + 0.05
    create_cylinder("ORED_DA_Seal_GoldRim", (seal_x, sign_y, seal_z), 0.38, 0.015,
                    mat_seal_gold, segments=16, rot=rot_front, parent=root)
    create_cylinder("ORED_DA_Seal_WhiteDisc", (seal_x, sign_y - 0.004, seal_z), 0.35, 0.015,
                    mat_seal_white, segments=16, rot=rot_front, parent=root)
    create_cylinder("ORED_DA_Seal_GreenRing", (seal_x, sign_y - 0.008, seal_z), 0.27, 0.015,
                    mat_seal_green, segments=16, rot=rot_front, parent=root)
    create_cylinder("ORED_DA_Seal_GoldCenter", (seal_x, sign_y - 0.012, seal_z), 0.16, 0.015,
                    mat_seal_gold, segments=12, rot=rot_front, parent=root)

    text_cx = 0.70
    create_text_mesh("ORED_Sign_Line1", (text_cx, sign_y, parapet_z + 0.22),
                     "DEPARTMENT OF AGRICULTURE", 0.23, mat_sign_white,
                     rot=rot_front, parent=root, align='CENTER', res=0)

    create_text_mesh("ORED_Sign_Line2", (text_cx, sign_y, parapet_z - 0.04),
                     "REGIONAL FIELD OFFICE NO. IV-A (CALABARZON)", 0.15, mat_sign_white,
                     rot=rot_front, parent=root, align='CENTER', res=0)

    create_text_mesh("ORED_Sign_Line3", (text_cx, sign_y, parapet_z - 0.26),
                     "LARES, MARAWOY, LIPA CITY, BATANGAS 4217", 0.12, mat_sign_white,
                     rot=rot_front, parent=root, align='CENTER', res=0)

    # -----------------------------------------------------------------------
    # 5. Front Entrance Glazing & Doors (Under Portico)
    # -----------------------------------------------------------------------
    door_y = -HY - 0.02
    create_quads("ORED_Entrance_Glass", [
        (-1.0, 1.0, BASE_H, BASE_H + 2.2),
        (-2.8, -1.0, BASE_H + 0.8, BASE_H + 2.2),
        ( 1.0,  2.8, BASE_H + 0.8, BASE_H + 2.2),
        (-2.8,  2.8, BASE_H + 2.25, BASE_H + 2.7)
    ], 'XZ', door_y, -1, mat_glass, root)

    create_quads("ORED_Entrance_Frames", [
        (-2.85, 2.85, BASE_H, BASE_H + 0.06),
        (-2.85, 2.85, BASE_H + 2.2, BASE_H + 2.26),
        (-2.85, 2.85, BASE_H + 2.7, BASE_H + 2.76),
        (-2.85, -2.79, BASE_H, BASE_H + 2.76),
        ( 2.79,  2.85, BASE_H, BASE_H + 2.76),
        (-1.03, -0.97, BASE_H, BASE_H + 2.2),
        ( 0.97,  1.03, BASE_H, BASE_H + 2.2),
        (-0.03,  0.03, BASE_H, BASE_H + 2.2),
        (-2.8, -1.0, BASE_H, BASE_H + 0.8),
        ( 1.0,  2.8, BASE_H, BASE_H + 0.8)
    ], 'XZ', door_y - 0.005, -1, mat_frame_dark, root)

    create_quads("ORED_Entrance_FrameHi", [
        (-0.02, 0.02, BASE_H + 0.06, BASE_H + 2.19)
    ], 'XZ', door_y - 0.01, -1, mat_frame_highlight, root)

    create_box("ORED_Door_Handle_L", (-0.15, door_y - 0.03, BASE_H + 1.0),
               (0.20, 0.03, 0.03), mat_sign_white, root)
    create_box("ORED_Door_Handle_R", ( 0.15, door_y - 0.03, BASE_H + 1.0),
               (0.20, 0.03, 0.03), mat_sign_white, root)

    banner_y = -HY - 0.015
    create_box("ORED_Banner_Left_BG", (-6.2, banner_y, BASE_H + 1.6),
               (3.4, 0.02, 1.8), mat_banner_white, root)
    create_box("ORED_Banner_Left_Header", (-6.2, banner_y - 0.01, BASE_H + 2.3),
               (3.2, 0.02, 0.22), mat_banner_accent, root)
    create_quads("ORED_Banner_Left_Blocks", [
        (-7.6, -6.6, BASE_H + 1.0, BASE_H + 2.0),
        (-6.4, -5.8, BASE_H + 1.3, BASE_H + 2.0),
        (-5.6, -4.8, BASE_H + 0.9, BASE_H + 2.0)
    ], 'XZ', banner_y - 0.012, -1, mat_banner_line, root)

    create_box("ORED_Banner_Right_BG", (6.2, banner_y, BASE_H + 1.6),
               (3.4, 0.02, 1.8), mat_banner_white, root)
    create_box("ORED_Banner_Right_Header", (6.2, banner_y - 0.01, BASE_H + 2.3),
               (3.2, 0.02, 0.22), mat_banner_accent, root)
    create_quads("ORED_Banner_Right_Blocks", [
        (4.8, 5.8, BASE_H + 0.9, BASE_H + 2.0),
        (6.0, 7.0, BASE_H + 1.1, BASE_H + 2.0),
        (7.1, 7.7, BASE_H + 1.3, BASE_H + 2.0)
    ], 'XZ', banner_y - 0.012, -1, mat_banner_line, root)

    create_box("ORED_AC_Front_Body", (4.8, banner_y - 0.22, BASE_H + 0.45),
               (0.85, 0.38, 0.60), mat_ac_case, root)
    create_cylinder("ORED_AC_Front_Fan", (4.8, banner_y - 0.42, BASE_H + 0.45),
                    0.22, 0.02, mat_ac_grille, segments=16, rot=(math.radians(90), 0, 0), parent=root)

    # -----------------------------------------------------------------------
    # 6. South Facade Windows & Fenestration (IMG_3809)
    # -----------------------------------------------------------------------
    south_window_rects_glass = []
    south_window_rects_frame = []
    win_z0 = BASE_H + 0.95
    win_z1 = BASE_H + 2.55
    win_w  = 2.60

    bay_win_ys = [-8.35, -4.24, 0.0, 4.24]
    for wy in bay_win_ys:
        y0 = wy - win_w / 2.0
        y1 = wy + win_w / 2.0
        south_window_rects_glass.append((y0, y1, win_z0, win_z1))
        south_window_rects_frame.append((y0 - 0.05, y1 + 0.05, win_z0 - 0.05, win_z0))
        south_window_rects_frame.append((y0 - 0.05, y1 + 0.05, win_z1, win_z1 + 0.05))
        south_window_rects_frame.append((y0 - 0.05, y0, win_z0, win_z1))
        south_window_rects_frame.append((y1, y1 + 0.05, win_z0, win_z1))
        south_window_rects_frame.append((y0, y1, win_z1 - 0.45, win_z1 - 0.40))
        m1 = y0 + win_w / 3.0
        m2 = y0 + 2 * win_w / 3.0
        south_window_rects_frame.append((m1 - 0.02, m1 + 0.02, win_z0, win_z1))
        south_window_rects_frame.append((m2 - 0.02, m2 + 0.02, win_z0, win_z1))

    create_quads("ORED_WinGlass_South", south_window_rects_glass, 'YZ', HX + 0.02, 1, mat_glass, root)
    create_quads("ORED_WinFrame_South", south_window_rects_frame, 'YZ', HX + 0.025, 1, mat_frame_dark, root)

    ac_protrude_ys = [-8.35, -4.24, 4.24]
    for i, acy in enumerate(ac_protrude_ys):
        create_box(f"ORED_AC_Win_South_{i}", (HX + 0.28, acy - 0.6, win_z0 + 0.35),
                   (0.48, 0.60, 0.42), mat_ac_case, root)
        create_quads(f"ORED_AC_Win_Grille_{i}", [(acy - 0.85, acy - 0.35, win_z0 + 0.18, win_z0 + 0.52)],
                     'YZ', HX + 0.525, 1, mat_ac_grille, root)

    create_box("ORED_AC_Split_South", (HX + 0.22, 1.2, BASE_H + 0.45),
               (0.36, 0.85, 0.60), mat_ac_case, root)
    create_cylinder("ORED_AC_Split_South_Fan", (HX + 0.41, 1.2, BASE_H + 0.45),
                    0.22, 0.02, mat_ac_grille, segments=16, rot=(0, math.radians(90), 0), parent=root)

    # Exterior maintenance steel ladder near Southeast corner (IMG_3809)
    lad_x = HX + 0.18
    lad_y = 8.8
    lad_z0 = BASE_H
    lad_z1 = EAVE_Z + 0.3
    create_cylinder("ORED_Ladder_Rail_L", (lad_x, lad_y - 0.25, (lad_z0 + lad_z1)/2.0),
                    0.025, lad_z1 - lad_z0, mat_metal_steel, segments=8, parent=root)
    create_cylinder("ORED_Ladder_Rail_R", (lad_x, lad_y + 0.25, (lad_z0 + lad_z1)/2.0),
                    0.025, lad_z1 - lad_z0, mat_metal_steel, segments=8, parent=root)
    num_rungs = 10
    for r in range(num_rungs):
        rz = lad_z0 + (r + 1) * ((lad_z1 - lad_z0) / (num_rungs + 1))
        create_box(f"ORED_Ladder_Rung_{r}", (lad_x, lad_y, rz),
                   (0.04, 0.50, 0.03), mat_metal_steel, root)

    # -----------------------------------------------------------------------
    # 7. North Facade Windows & Detailed Link Canopy (IMG_3806 & IMG_3807)
    # -----------------------------------------------------------------------
    north_window_rects_glass = []
    north_window_rects_frame = []
    for wy in bay_win_ys[:3]:
        y0 = wy - win_w / 2.0
        y1 = wy + win_w / 2.0
        north_window_rects_glass.append((y0, y1, win_z0, win_z1))
        north_window_rects_frame.append((y0 - 0.05, y1 + 0.05, win_z0 - 0.05, win_z0))
        north_window_rects_frame.append((y0 - 0.05, y1 + 0.05, win_z1, win_z1 + 0.05))
        north_window_rects_frame.append((y0 - 0.05, y0, win_z0, win_z1))
        north_window_rects_frame.append((y1, y1 + 0.05, win_z0, win_z1))
        north_window_rects_frame.append((y0, y1, win_z1 - 0.45, win_z1 - 0.40))
        m1 = y0 + win_w / 3.0
        m2 = y0 + 2 * win_w / 3.0
        north_window_rects_frame.append((m1 - 0.02, m1 + 0.02, win_z0, win_z1))
        north_window_rects_frame.append((m2 - 0.02, m2 + 0.02, win_z0, win_z1))

    create_quads("ORED_WinGlass_North", north_window_rects_glass, 'YZ', -HX - 0.02, -1, mat_glass, root)
    create_quads("ORED_WinFrame_North", north_window_rects_frame, 'YZ', -HX - 0.025, -1, mat_frame_dark, root)

    for i, acy in enumerate([-8.35, -4.24]):
        create_box(f"ORED_AC_Win_North_{i}", (-HX - 0.28, acy - 0.6, win_z0 + 0.35),
                   (0.48, 0.60, 0.42), mat_ac_case, root)
        create_quads(f"ORED_AC_Win_Grille_N_{i}", [(acy - 0.85, acy - 0.35, win_z0 + 0.18, win_z0 + 0.52)],
                     'YZ', -HX - 0.525, -1, mat_ac_grille, root)

    # --- BESPOKE DETAILED CONNECTING LINK CANOPY / CARPORT (IMG_3806) ---
    # As ground-truthed in IMG_3806:
    # A sloped corrugated dark green canopy that covers the breezeway and extends
    # to seamlessly meet the Admin Building!
    # Pitch: Slopes DOWNWARDS from wall attachment (3.30m) down to outer eave (2.45m),
    # perfectly parallel and aligned with the Admin Building canopy!
    awn_y0   = 3.40
    awn_y1   = HY + 0.75  # extends across breezeway to meet Admin Building!
    awn_len  = awn_y1 - awn_y0
    awn_cy   = (awn_y0 + awn_y1) / 2.0
    awn_proj = 2.40       # MATCH ADMIN: 2.40 m projection outward along -X into driveway!
    awn_cx   = -HX - awn_proj / 2.0
    awn_z_hi = 3.30       # MATCH ADMIN: 3.30 m wall attachment height!
    awn_z_lo = 2.45       # MATCH ADMIN: 2.45 m outer eave height!
    awn_rot_y = math.atan2(awn_z_hi - awn_z_lo, awn_proj)
    slope_hypot = math.hypot(awn_proj, awn_z_hi - awn_z_lo) # ~2.547 m

    # 1. Solid sloped canopy roof slab (sloping DOWNWARDS into -X: rot=(0, -awn_rot_y, 0))
    create_box("ORED_Link_Awning_Roof", (awn_cx, awn_cy, (awn_z_hi + awn_z_lo) / 2.0),
               (slope_hypot + 0.12, awn_len, 0.07), mat_awning_roof, root,
               rot=(0, -awn_rot_y, 0))

    # 2. Corrugated ribs on canopy roof top running down the slope (IMG_3806 & IMG_3805)
    num_ribs = 14
    for r_k in range(num_ribs):
        ry = awn_y0 + 0.20 + r_k * ((awn_len - 0.40) / max(num_ribs - 1, 1))
        create_box(f"ORED_Link_Rib_{r_k}", (awn_cx, ry, (awn_z_hi + awn_z_lo) / 2.0 + 0.04),
                   (slope_hypot + 0.14, 0.045, 0.025), mat_roof_cap, root,
                   rot=(0, -awn_rot_y, 0))

    # 3. Outer dark green fascia beam along front eave (facing -X)
    f_x = -HX - awn_proj - 0.04
    create_box("ORED_Link_Awning_Fascia", (f_x, awn_cy, awn_z_lo),
               (0.08, awn_len + 0.10, 0.22), mat_awning_fascia, root)

    # 4. West return fascia (facing -Y)
    create_box("ORED_Link_Awning_Fascia_West", (awn_cx, awn_y0 - 0.04, (awn_z_hi + awn_z_lo) / 2.0),
               (slope_hypot + 0.10, 0.08, 0.20), mat_awning_fascia, root,
               rot=(0, -awn_rot_y, 0))

    # 5. Heavy structural horizontal header beam directly carrying rafters & canopy
    beam_x = -HX - awn_proj + 0.22
    beam_z = awn_z_lo - 0.08 # ~2.37 m, sits directly under rafters
    beam_h = 0.22
    create_box("ORED_Link_Awning_HeaderBeam", (beam_x, awn_cy, beam_z),
               (0.28, awn_len, beam_h), mat_base_cream, root)

    # 6. Transverse structural roof rafters / joists spanning from wall to header beam
    rafter_ys = [awn_y0 + 0.3, (awn_y0 + awn_cy) / 2.0, awn_cy, (awn_cy + awn_y1) / 2.0, awn_y1 - 0.3]
    for r_i, ry in enumerate(rafter_ys):
        create_box(f"ORED_Link_Rafter_{r_i}", (awn_cx, ry, (awn_z_hi + awn_z_lo) / 2.0 - 0.05),
                   (slope_hypot - 0.05, 0.10, 0.10), mat_awning_fascia, root,
                   rot=(0, -awn_rot_y, 0))

    # 7. Sturdy Architectural Concrete Pillars (IMG_3806):
    # Thick columns with dark maroon skirting base and warm cream upper shaft
    col_x = beam_x
    col_w = 0.38
    col_d = 0.36
    base_h = 0.65
    shaft_top_z = beam_z - beam_h / 2.0 # 2.37 - 0.11 = 2.26 m (touches bottom of header beam!)
    col_upper_h = max(shaft_top_z - base_h, 0.5)

    # 3 substantial pillars along the outer drive:
    pillar_ys = [awn_y0 + 0.45, (awn_y0 + awn_y1) / 2.0, awn_y1 - 0.45]
    for p_idx, py in enumerate(pillar_ys):
        # Dark maroon foundation base
        create_box(f"ORED_Awning_PillarBase_{p_idx}", (col_x, py, base_h / 2.0),
                   (col_w + 0.05, col_d + 0.05, base_h), mat_maroon, root)
        # Warm cream concrete shaft
        create_box(f"ORED_Awning_PillarShaft_{p_idx}", (col_x, py, base_h + col_upper_h / 2.0),
                   (col_w, col_d, col_upper_h), mat_base_cream, root)

    # -----------------------------------------------------------------------
    # 8. East Facade (Rear Wall) Windows
    # -----------------------------------------------------------------------
    east_window_rects_glass = []
    east_window_rects_frame = []
    for ex in [-5.0, 0.0, 5.0]:
        x0 = ex - win_w / 2.0
        x1 = ex + win_w / 2.0
        east_window_rects_glass.append((x0, x1, win_z0, win_z1))
        east_window_rects_frame.append((x0 - 0.05, x1 + 0.05, win_z0 - 0.05, win_z0))
        east_window_rects_frame.append((x0 - 0.05, x1 + 0.05, win_z1, win_z1 + 0.05))
        east_window_rects_frame.append((x0 - 0.05, x0, win_z0, win_z1))
        east_window_rects_frame.append((x1, x1 + 0.05, win_z0, win_z1))
        east_window_rects_frame.append((x0, x1, win_z1 - 0.45, win_z1 - 0.40))
        m1 = x0 + win_w / 3.0
        m2 = x0 + 2 * win_w / 3.0
        east_window_rects_frame.append((m1 - 0.02, m1 + 0.02, win_z0, win_z1))
        east_window_rects_frame.append((m2 - 0.02, m2 + 0.02, win_z0, win_z1))

    create_quads("ORED_WinGlass_East", east_window_rects_glass, 'XZ', HY + 0.02, 1, mat_glass, root)
    create_quads("ORED_WinFrame_East", east_window_rects_frame, 'XZ', HY + 0.025, 1, mat_frame_dark, root)

    # -----------------------------------------------------------------------
    # 9. Main Hip Roof Structure & Fascia
    # -----------------------------------------------------------------------
    OVERHANG = 0.85
    RHX = HX + OVERHANG  # 10.30 m
    RHY = HY + OVERHANG  # 11.425 m

    roof_obj, ridge_len, ridge_is_y = create_hip_roof(
        "ORED_Main_Roof", RHX, RHY, EAVE_Z, RIDGE_Z,
        mat_roof_green, mat_soffit, parent=root
    )

    f_h = 0.28
    f_t = 0.08
    f_z = EAVE_Z - f_h / 2.0 + 0.02

    create_box("ORED_Fascia_North", (-RHX - f_t/2.0, 0, f_z),
               (f_t, 2 * RHY + 2 * f_t, f_h), mat_fascia_green, root)
    create_box("ORED_Fascia_South", ( RHX + f_t/2.0, 0, f_z),
               (f_t, 2 * RHY + 2 * f_t, f_h), mat_fascia_green, root)
    create_box("ORED_Fascia_West", (0, -RHY - f_t/2.0, f_z),
               (2 * RHX, f_t, f_h), mat_fascia_green, root)
    create_box("ORED_Fascia_East", (0,  RHY + f_t/2.0, f_z),
               (2 * RHX, f_t, f_h), mat_fascia_green, root)

    cap_w = 0.26
    cap_h = 0.06
    cap_z = 0.025

    if ridge_is_y:
        create_beam_between("ORED_RidgeCap", (0, -ridge_len, RIDGE_Z + cap_z),
                            (0, ridge_len, RIDGE_Z + cap_z), cap_w, cap_h, mat_roof_cap, root)
        hip_corners = [
            (-RHX, -RHY, -ridge_len),
            ( RHX, -RHY, -ridge_len),
            ( RHX,  RHY,  ridge_len),
            (-RHX,  RHY,  ridge_len)
        ]
        for i, (hx_c, hy_c, ry) in enumerate(hip_corners):
            create_beam_between(f"ORED_HipCap_{i}", (hx_c, hy_c, EAVE_Z + cap_z),
                                (0, ry, RIDGE_Z + cap_z), cap_w, cap_h, mat_roof_cap, root)
    else:
        create_beam_between("ORED_RidgeCap", (-ridge_len, 0, RIDGE_Z + cap_z),
                            (ridge_len, 0, RIDGE_Z + cap_z), cap_w, cap_h, mat_roof_cap, root)
        hip_corners = [
            (-RHX, -RHY, -ridge_len),
            ( RHX, -RHY,  ridge_len),
            ( RHX,  RHY,  ridge_len),
            (-RHX,  RHY, -ridge_len)
        ]
        for i, (hx_c, hy_c, rx) in enumerate(hip_corners):
            create_beam_between(f"ORED_HipCap_{i}", (hx_c, hy_c, EAVE_Z + cap_z),
                                (rx, 0, RIDGE_Z + cap_z), cap_w, cap_h, mat_roof_cap, root)

    rib_w = 0.04
    rib_h = 0.02
    slope_dz = RIDGE_Z - EAVE_Z
    for side, sx in [("N", -1), ("S", 1)]:
        for k in range(1, 5):
            t = k / 5.0
            x = sx * RHX * (1 - t)
            z = EAVE_Z + slope_dz * t + 0.015
            half_y = ridge_len + (RHY - ridge_len) * (1 - t)
            create_beam_between(f"ORED_Rib_{side}_{k}", (x, -half_y, z), (x, half_y, z),
                                rib_w, rib_h, mat_roof_cap, root)

    # -----------------------------------------------------------------------
    # 10. GLB Export
    # -----------------------------------------------------------------------
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\ored_building.glb"
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
    print(f" Successfully Exported ORED Building GLB: {glb_out}")
    print(f" GLB File Size: {size_kb:.1f} KB (Budget: <= 300 KB)")
    print(f"=====================================================================")
    return root


# Execute build when run in Blender
build_ored_building()
