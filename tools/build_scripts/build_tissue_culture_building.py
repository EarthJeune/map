"""
build_tissue_culture_building.py — Authentic Bespoke 3D Model of the DA-LARES
Tissue Culture Laboratory Building (tissue_culture_building)

Ground-Truth Photographic Reference:
1. IMG_3837.jpg (Front / South-East Elevation facing access road & entrance_17):
   - Two-story modern research facility with 4 prominent vertical structural pilasters.
   - Symmetrical gable roof with forest green metal standing-seam panels, continuous dark
     forest green fascia boards, and white vented soffits with 70cm overhangs.
   - Mint green ground floor walls, warm pale cream upper floor walls, slate blue-grey pilasters & beams.
   - Left Bay: Signature two-story commercial glass curtain wall (dark bronze grid with tinted glass).
   - Center Bay: Concrete entrance canopy with dual steel angled tie-rod supports, floodlights,
     commercial double frosted-glass doors, threshold stoop, and 2nd-floor 2-panel window with grilles.
   - Right Bay: Authentic 3D white dimensional lettering "TISSUE CULTURE" & "LABORATORY".
     Ground floor window with white security bars below signage; wide upper floor window with bars.
   - Foundation base skirt in medium concrete grey.

2. IMG_3838.jpg (Left / South-West Flank):
   - Curtain wall wraps 90° around the corner onto the left facade (2 panes wide x 4 panes high).
   - 4 structural column bays along the length with vertical slate blue-grey pilasters.
   - Ground floor windows with horizontal white security bars and ground-mounted split AC units.
   - Upper floor horizontal window sets.
   - Grey PVC downspouts running down pilasters.

3. IMG_3839.jpg (Right / North-East Flank):
   - 4 structural column bays with vertical slate blue-grey pilasters.
   - 4 window sets per floor with white security grilles.
   - Prominent bracket-mounted white LG split AC condenser on 2nd-floor exterior wall (front-right bay).
   - Ground-level AC condensing units along plinth.
   - Continuous grey PVC gutters along the eave with downspouts on every pilaster.

Alignment & Placement:
- Centroid: [121.16711972, 13.95883400]
- Entrance Node: [121.16717532, 13.95874467] (entrance_17)
- Front Facade Compass Normal: 157.6°
- Mapbox rotation: 337.6°
- Performance Budget: Strictly <= 300 KB GLB.
- Zero extraneous outdoor props (no external terrain slabs, trees, curbs, streetlamps, or vehicles).
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
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (*color[:3], 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Specular IOR Level'].default_value = specular
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission[:3], 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission[3] if len(emission) > 3 else 1.0
    out = nodes.new(type='ShaderNodeOutputMaterial')
    mat.node_tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat

def create_box(name, center, size, mat=None, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=center, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, center, radius, depth, mat=None, parent=None, rot=(0, 0, 0), segments=8):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=segments, radius=radius, depth=depth,
        location=center, rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_quads(name, rects, plane='XZ', fixed_coord=0.0, normal_dir=1, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm = bmesh.new()
    for (u0, u1, v0, v1) in rects:
        if plane == 'XZ':
            y = fixed_coord
            if normal_dir >= 0:
                vs = [bm.verts.new((u0, y, v0)), bm.verts.new((u1, y, v0)),
                      bm.verts.new((u1, y, v1)), bm.verts.new((u0, y, v1))]
            else:
                vs = [bm.verts.new((u0, y, v0)), bm.verts.new((u0, y, v1)),
                      bm.verts.new((u1, y, v1)), bm.verts.new((u1, y, v0))]
        elif plane == 'YZ':
            x = fixed_coord
            if normal_dir >= 0:
                vs = [bm.verts.new((x, u0, v0)), bm.verts.new((x, u1, v0)),
                      bm.verts.new((x, u1, v1)), bm.verts.new((x, u0, v1))]
            else:
                vs = [bm.verts.new((x, u0, v0)), bm.verts.new((x, u0, v1)),
                      bm.verts.new((x, u1, v1)), bm.verts.new((x, u1, v0))]
        elif plane == 'XY':
            z = fixed_coord
            if normal_dir >= 0:
                vs = [bm.verts.new((u0, v0, z)), bm.verts.new((u1, v0, z)),
                      bm.verts.new((u1, v1, z)), bm.verts.new((u0, v1, z))]
            else:
                vs = [bm.verts.new((u0, v0, z)), bm.verts.new((u0, v1, z)),
                      bm.verts.new((u1, v1, z)), bm.verts.new((u1, v0, z))]
        bm.faces.new(vs)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_sloped_quad(name, p1, p2, p3, p4, mat=None, parent=None):
    """Creates a quad with four 3D points in counter-clockwise order."""
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm = bmesh.new()
    v1 = bm.verts.new(p1)
    v2 = bm.verts.new(p2)
    v3 = bm.verts.new(p3)
    v4 = bm.verts.new(p4)
    bm.faces.new([v1, v2, v3, v4])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_3d_text(name, text_string, location, size=0.22, extrude=0.03, mat=None, parent=None):
    bpy.ops.object.text_add(location=location)
    txt_obj = bpy.context.active_object
    txt_obj.name = name
    txt_obj.data.body = text_string
    txt_obj.data.size = size
    txt_obj.data.extrude = extrude
    txt_obj.data.resolution_u = 1
    txt_obj.data.align_x = 'CENTER'
    txt_obj.data.align_y = 'CENTER'
    # Stand vertically facing -Y
    txt_obj.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.convert(target='MESH')
    if mat:
        txt_obj.data.materials.append(mat)
    if parent:
        txt_obj.parent = parent
    return txt_obj

# ---------------------------------------------------------------------------
# Main Builder
# ---------------------------------------------------------------------------
def build_tissue_culture():
    print("Building DA-LARES Tissue Culture Laboratory Model...")

    # Clear scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    root = bpy.data.objects.new("Tissue_Culture_Building_Root", None)
    bpy.context.collection.objects.link(root)

    # -----------------------------------------------------------------------
    # Materials
    # -----------------------------------------------------------------------
    mat_mint         = create_mat("Mat_TC_Mint",         (0.36, 0.58, 0.46), roughness=0.65) # Ground floor mint green
    mat_cream        = create_mat("Mat_TC_Cream",        (0.85, 0.81, 0.72), roughness=0.70) # 2nd floor warm cream/ivory
    mat_blue_grey    = create_mat("Mat_TC_BlueGrey",     (0.18, 0.25, 0.33), roughness=0.55) # Structural pilasters & beams
    mat_skirt        = create_mat("Mat_TC_Skirt",        (0.22, 0.24, 0.26), roughness=0.80) # Foundation skirt grey
    mat_roof         = create_mat("Mat_TC_Roof",         (0.04, 0.11, 0.06), roughness=0.45) # Forest green corrugated roof
    mat_fascia       = create_mat("Mat_TC_Fascia",       (0.02, 0.06, 0.03), roughness=0.40) # Dark forest green fascia trim
    mat_soffit       = create_mat("Mat_TC_Soffit",       (0.82, 0.83, 0.84), roughness=0.60) # Vented white soffit
    mat_glass_tint   = create_mat("Mat_TC_Glass_Tint",   (0.05, 0.09, 0.13), roughness=0.08, metallic=0.2, specular=0.9)
    mat_glass_door   = create_mat("Mat_TC_Glass_Door",   (0.65, 0.70, 0.72), roughness=0.30, specular=0.8) # Frosted entrance glass
    mat_aluminum     = create_mat("Mat_TC_Aluminum_Dark",(0.05, 0.06, 0.07), roughness=0.45, metallic=0.7) # Dark bronze frames
    mat_grille_white = create_mat("Mat_TC_Grille_White", (0.92, 0.92, 0.92), roughness=0.40) # White window security bars
    mat_signage      = create_mat("Mat_TC_Signage_White",(1.00, 1.00, 1.00), roughness=0.30, emission=(1.0, 1.0, 1.0, 0.25))
    mat_canopy_conc  = create_mat("Mat_TC_Canopy_Conc",  (0.38, 0.40, 0.42), roughness=0.75) # Entrance canopy concrete
    mat_ac_body      = create_mat("Mat_TC_AC_Body",      (0.88, 0.88, 0.86), roughness=0.35) # AC outdoor units
    mat_ac_grille    = create_mat("Mat_TC_AC_Grille",    (0.12, 0.12, 0.12), roughness=0.60)
    mat_ac_bracket   = create_mat("Mat_TC_AC_Bracket",   (0.15, 0.16, 0.18), roughness=0.50, metallic=0.7)
    mat_lg_red       = create_mat("Mat_TC_LG_Red",       (0.78, 0.08, 0.16), roughness=0.30)
    mat_downspout    = create_mat("Mat_TC_Downspout",    (0.28, 0.30, 0.32), roughness=0.50) # Grey PVC downspouts

    def create_split_ac(name, center, size=(0.32, 0.85, 0.58), face_dir='+X', has_bracket=False):
        gx, gy, gz = center
        gw, gd, gh = size
        # Main casing
        create_box(name + "_Body", center, size, mat_ac_body, root)
        if face_dir == '+X':
            fx = gx + gw / 2.0 + 0.005
            # Circular fan grille
            create_cylinder(name + "_Grille", (fx, gy - 0.12, gz), gh * 0.35, 0.01,
                            mat_ac_grille, root, rot=(0, math.radians(90), 0), segments=10)
            # LG Red Logo Accent
            create_cylinder(name + "_Logo", (fx + 0.002, gy + 0.22, gz), 0.045, 0.012,
                            mat_lg_red, root, rot=(0, math.radians(90), 0), segments=8)
            if has_bracket:
                # Triangular wall brackets underneath
                for by in [gy - gd / 2.0 + 0.08, gy + gd / 2.0 - 0.08]:
                    create_box(f"{name}_Brk_H_{by:.2f}", (gx - 0.04, by, gz - gh / 2.0 - 0.02),
                               (gw + 0.08, 0.04, 0.04), mat_ac_bracket, root)
                    create_box(f"{name}_Brk_V_{by:.2f}", (gx - gw / 2.0 + 0.02, by, gz - gh / 2.0 - 0.16),
                               (0.04, 0.04, 0.32), mat_ac_bracket, root)
                    brk_diag_len = math.hypot(gw, 0.32)
                    brk_diag_ang = math.atan2(gw, 0.32)
                    create_box(f"{name}_Brk_D_{by:.2f}",
                               (gx - 0.02, by, gz - gh / 2.0 - 0.16),
                               (0.03, 0.03, brk_diag_len), mat_ac_bracket, root,
                               rot=(0, brk_diag_ang, 0))
            else:
                for by in [gy - gd / 2.0 + 0.12, gy + gd / 2.0 - 0.12]:
                    create_box(f"{name}_Pad_{by:.2f}", (gx, by, gz - gh / 2.0 - 0.05),
                               (gw - 0.04, 0.14, 0.10), mat_skirt, root)
        elif face_dir == '-X':
            fx = gx - gw / 2.0 - 0.005
            create_cylinder(name + "_Grille", (fx, gy + 0.12, gz), gh * 0.35, 0.01,
                            mat_ac_grille, root, rot=(0, math.radians(90), 0), segments=10)
            create_cylinder(name + "_Logo", (fx - 0.002, gy - 0.22, gz), 0.045, 0.012,
                            mat_lg_red, root, rot=(0, math.radians(90), 0), segments=8)
            if has_bracket:
                for by in [gy - gd / 2.0 + 0.08, gy + gd / 2.0 - 0.08]:
                    create_box(f"{name}_Brk_H_{by:.2f}", (gx + 0.04, by, gz - gh / 2.0 - 0.02),
                               (gw + 0.08, 0.04, 0.04), mat_ac_bracket, root)
            else:
                for by in [gy - gd / 2.0 + 0.12, gy + gd / 2.0 - 0.12]:
                    create_box(f"{name}_Pad_{by:.2f}", (gx, by, gz - gh / 2.0 - 0.05),
                               (gw - 0.04, 0.14, 0.10), mat_skirt, root)

    # -----------------------------------------------------------------------
    # Dimensions & Key Levels
    # -----------------------------------------------------------------------
    HX = 6.40
    HY = 11.40

    SKIRT_H     = 0.40  # Grey foundation base skirt
    GF_CEILING  = 3.25  # Ground floor ceiling level
    BELT_H      = 0.35  # Intermediate floor course beam
    UF_FLOOR    = GF_CEILING + BELT_H # 3.60 m
    UF_CEILING  = 6.30  # Upper floor ceiling level
    EAVE_BEAM_H = 0.30  # Top eave course beam
    EAVE_Z      = UF_CEILING + EAVE_BEAM_H # 6.60 m
    ROOF_APEX_Z = 7.90  # Gable roof ridge apex height

    OVERHANG    = 0.70  # Roof eave overhang

    # -----------------------------------------------------------------------
    # 1. Foundation & Skirt (Z: 0.0 to 0.40 m)
    # -----------------------------------------------------------------------
    create_box("TC_Foundation_Skirt", (0, 0, SKIRT_H / 2.0),
               (2 * HX + 0.15, 2 * HY + 0.15, SKIRT_H), mat_skirt, root)

    # -----------------------------------------------------------------------
    # 2. Main Wall Masses
    # -----------------------------------------------------------------------
    # Ground Floor Walls (Mint Green, Z: 0.40 to 3.25 m)
    gf_h = GF_CEILING - SKIRT_H
    gf_mid_z = SKIRT_H + gf_h / 2.0
    create_box("TC_Walls_GF_Core", (0, 0, gf_mid_z),
               (2 * HX, 2 * HY, gf_h), mat_mint, root)

    # Intermediate Belt Course Beam (Slate Blue-Grey, Z: 3.25 to 3.60 m)
    belt_mid_z = GF_CEILING + BELT_H / 2.0
    create_box("TC_Beam_Intermediate_Belt", (0, 0, belt_mid_z),
               (2 * HX + 0.10, 2 * HY + 0.10, BELT_H), mat_blue_grey, root)

    # Upper Floor Walls (Warm Cream, Z: 3.60 to 6.30 m)
    uf_h = UF_CEILING - UF_FLOOR
    uf_mid_z = UF_FLOOR + uf_h / 2.0
    create_box("TC_Walls_UF_Core", (0, 0, uf_mid_z),
               (2 * HX, 2 * HY, uf_h), mat_cream, root)

    # Eave Course Beam (Slate Blue-Grey, Z: 6.30 to 6.60 m)
    eave_beam_mid_z = UF_CEILING + EAVE_BEAM_H / 2.0
    create_box("TC_Beam_Top_Eave", (0, 0, eave_beam_mid_z),
               (2 * HX + 0.12, 2 * HY + 0.12, EAVE_BEAM_H), mat_blue_grey, root)

    # Gable Pediment End Walls (Above Z=6.60 up to the underside of the roof)
    # Front Gable Triangle at Y = -HY
    # Slope equation from X = 0 (Z = ROOF_APEX_Z) to X = +/-HX (Z = EAVE_Z + (ROOF_APEX_Z - EAVE_Z)*(1 - HX/(HX+OVERHANG)))
    mesh_gf = bpy.data.meshes.new("TC_Gable_Wall_Front_Mesh")
    bm_gf = bmesh.new()
    v_f_bl = bm_gf.verts.new((-HX, -HY, EAVE_Z))
    v_f_br = bm_gf.verts.new(( HX, -HY, EAVE_Z))
    # apex at Y = -HY
    v_f_top = bm_gf.verts.new((0.0, -HY, ROOF_APEX_Z))
    bm_gf.faces.new([v_f_bl, v_f_br, v_f_top])
    bm_gf.to_mesh(mesh_gf)
    bm_gf.free()
    obj_gf = bpy.data.objects.new("TC_Gable_Wall_Front", mesh_gf)
    bpy.context.collection.objects.link(obj_gf)
    obj_gf.data.materials.append(mat_cream)
    obj_gf.parent = root

    # Rear Gable Triangle at Y = +HY
    mesh_gr = bpy.data.meshes.new("TC_Gable_Wall_Rear_Mesh")
    bm_gr = bmesh.new()
    v_r_bl = bm_gr.verts.new((-HX, HY, EAVE_Z))
    v_r_br = bm_gr.verts.new(( HX, HY, EAVE_Z))
    v_r_top = bm_gr.verts.new((0.0, HY, ROOF_APEX_Z))
    bm_gr.faces.new([v_r_br, v_r_bl, v_r_top])
    bm_gr.to_mesh(mesh_gr)
    bm_gr.free()
    obj_gr = bpy.data.objects.new("TC_Gable_Wall_Rear", mesh_gr)
    bpy.context.collection.objects.link(obj_gr)
    obj_gr.data.materials.append(mat_cream)
    obj_gr.parent = root

    # -----------------------------------------------------------------------
    # 3. Structural Pilasters / Columns (Slate Blue-Grey)
    # -----------------------------------------------------------------------
    col_w = 0.50
    col_proj = 0.22
    col_total_h = EAVE_Z - SKIRT_H
    col_mid_z = SKIRT_H + col_total_h / 2.0

    # Front Pilasters (4 across front at Y = -HY - col_proj/2):
    front_col_xs = [-HX + col_w / 2.0, -2.15, 2.15, HX - col_w / 2.0]
    for ci, cx in enumerate(front_col_xs):
        create_box(f"TC_Col_Front_{ci}", (cx, -HY - col_proj / 2.0, col_mid_z),
                   (col_w, col_proj, col_total_h), mat_blue_grey, root)

    # Rear Pilasters (4 across rear at Y = +HY + col_proj/2):
    for ci, cx in enumerate(front_col_xs):
        create_box(f"TC_Col_Rear_{ci}", (cx, HY + col_proj / 2.0, col_mid_z),
                   (col_w, col_proj, col_total_h), mat_blue_grey, root)

    # Side Pilasters along Left and Right
    side_col_ys = [-HY + col_w / 2.0, -5.70, 0.00, 5.70, HY - col_w / 2.0]
    for yi, cy in enumerate(side_col_ys[1:-1]):
        # Left side
        create_box(f"TC_Col_Left_{yi+1}", (-HX - col_proj / 2.0, cy, col_mid_z),
                   (col_proj, col_w, col_total_h), mat_blue_grey, root)
        # Right side
        create_box(f"TC_Col_Right_{yi+1}", (HX + col_proj / 2.0, cy, col_mid_z),
                   (col_proj, col_w, col_total_h), mat_blue_grey, root)

    # -----------------------------------------------------------------------
    # 4. Front Facade Signature Features (IMG_3837)
    # -----------------------------------------------------------------------
    # (A) Two-Story Corner Curtain Wall (Left Bay)
    cw_f_x0, cw_f_x1 = -5.85, -2.45
    cw_f_w = cw_f_x1 - cw_f_x0
    cw_z0, cw_z1 = 0.70, 5.85
    cw_h = cw_z1 - cw_z0

    # Glass surface (Front)
    create_quads("TC_CW_Front_Glass", [
        (cw_f_x0, cw_f_x1, cw_z0, cw_z1)
    ], 'XZ', -HY - 0.02, -1, mat_glass_tint, root)

    # Aluminum Framing Grid (3 cols x 4 rows)
    cw_mullions_f = []
    cw_mullions_f.append((cw_f_x0, cw_f_x1, cw_z0, cw_z0 + 0.06))
    cw_mullions_f.append((cw_f_x0, cw_f_x1, cw_z1 - 0.06, cw_z1))
    cw_mullions_f.append((cw_f_x0, cw_f_x0 + 0.06, cw_z0, cw_z1))
    cw_mullions_f.append((cw_f_x1 - 0.06, cw_f_x1, cw_z0, cw_z1))
    for col_i in [1, 2]:
        mx = cw_f_x0 + col_i * (cw_f_w / 3.0)
        cw_mullions_f.append((mx - 0.03, mx + 0.03, cw_z0, cw_z1))
    for row_i in [1, 2, 3]:
        mz = cw_z0 + row_i * (cw_h / 4.0)
        cw_mullions_f.append((cw_f_x0, cw_f_x1, mz - 0.03, mz + 0.03))

    create_quads("TC_CW_Front_Mullions", cw_mullions_f, 'XZ', -HY - 0.025, -1, mat_aluminum, root)

    # Left Corner Wrap (IMG_3838):
    cw_s_y0, cw_s_y1 = -HY + 0.25, -HY + 2.85
    cw_s_len = cw_s_y1 - cw_s_y0

    create_quads("TC_CW_Side_Glass", [
        (cw_s_y0, cw_s_y1, cw_z0, cw_z1)
    ], 'YZ', -HX - 0.02, -1, mat_glass_tint, root)

    cw_mullions_s = []
    cw_mullions_s.append((cw_s_y0, cw_s_y1, cw_z0, cw_z0 + 0.06))
    cw_mullions_s.append((cw_s_y0, cw_s_y1, cw_z1 - 0.06, cw_z1))
    cw_mullions_s.append((cw_s_y0, cw_s_y0 + 0.06, cw_z0, cw_z1))
    cw_mullions_s.append((cw_s_y1 - 0.06, cw_s_y1, cw_z0, cw_z1))
    s_my = cw_s_y0 + cw_s_len / 2.0
    cw_mullions_s.append((s_my - 0.03, s_my + 0.03, cw_z0, cw_z1))
    for row_i in [1, 2, 3]:
        mz = cw_z0 + row_i * (cw_h / 4.0)
        cw_mullions_s.append((cw_s_y0, cw_s_y1, mz - 0.03, mz + 0.03))

    create_quads("TC_CW_Side_Mullions", cw_mullions_s, 'YZ', -HX - 0.025, -1, mat_aluminum, root)

    # (B) Center Bay Entrance (Ground Floor)
    # Cantilever concrete canopy hood
    canopy_w = 3.40
    canopy_depth = 1.30
    canopy_z = 2.85
    canopy_th = 0.14
    create_box("TC_Canopy_Entrance",
               (0.0, -HY - canopy_depth / 2.0, canopy_z),
               (canopy_w, canopy_depth, canopy_th), mat_canopy_conc, root)

    # Double commercial glass doors (Dark bronze frame with frosted glass panels)
    door_w = 2.10
    door_h = 2.35
    door_z0 = 0.10
    create_quads("TC_Door_Glass", [
        (-door_w / 2.0 + 0.05, door_w / 2.0 - 0.05, door_z0 + 0.05, door_z0 + door_h - 0.05)
    ], 'XZ', -HY - 0.01, -1, mat_glass_door, root)

    create_quads("TC_Door_Frame", [
        (-door_w / 2.0, door_w / 2.0, door_z0, door_z0 + 0.05),
        (-door_w / 2.0, door_w / 2.0, door_z0 + door_h - 0.05, door_z0 + door_h),
        (-door_w / 2.0, -door_w / 2.0 + 0.05, door_z0, door_z0 + door_h),
        (door_w / 2.0 - 0.05, door_w / 2.0, door_z0, door_z0 + door_h),
        (-0.025, 0.025, door_z0, door_z0 + door_h) # Center mullion
    ], 'XZ', -HY - 0.015, -1, mat_aluminum, root)

    # Entrance threshold landing stoop
    create_box("TC_Entrance_Stoop", (0.0, -HY - 0.50, 0.06),
               (2.60, 1.00, 0.12), mat_skirt, root)

    # Center Bay 2nd Floor Window (2-panel jalousie with white security bars)
    w_c2_w = 1.65
    w_c2_h = 1.30
    w_c2_z0 = 4.30
    w_c2_z1 = w_c2_z0 + w_c2_h
    create_quads("TC_Win_Center_UF_Glass", [
        (-w_c2_w / 2.0 + 0.04, w_c2_w / 2.0 - 0.04, w_c2_z0 + 0.04, w_c2_z1 - 0.04)
    ], 'XZ', -HY - 0.01, -1, mat_glass_tint, root)

    create_quads("TC_Win_Center_UF_Frame", [
        (-w_c2_w / 2.0, w_c2_w / 2.0, w_c2_z0, w_c2_z0 + 0.04),
        (-w_c2_w / 2.0, w_c2_w / 2.0, w_c2_z1 - 0.04, w_c2_z1),
        (-w_c2_w / 2.0, -w_c2_w / 2.0 + 0.04, w_c2_z0, w_c2_z1),
        (w_c2_w / 2.0 - 0.04, w_c2_w / 2.0, w_c2_z0, w_c2_z1),
        (-0.02, 0.02, w_c2_z0, w_c2_z1)
    ], 'XZ', -HY - 0.015, -1, mat_aluminum, root)

    grille_bars_c = []
    for bi in range(1, 6):
        bz = w_c2_z0 + bi * (w_c2_h / 6.0)
        grille_bars_c.append((-w_c2_w / 2.0 + 0.04, w_c2_w / 2.0 - 0.04, bz - 0.01, bz + 0.01))
    create_quads("TC_Win_Center_UF_Grille", grille_bars_c, 'XZ', -HY - 0.02, -1, mat_grille_white, root)

    # (C) Right Bay 3D Dimensional Signage & Windows (IMG_3837)
    r_center_x = (2.15 + HX - col_w / 2.0) / 2.0 # ~4.15 m
    sign_y = -HY - 0.03

    # Authentic 3D Text: "TISSUE CULTURE" (top) and "LABORATORY" (bottom)
    create_3d_text("TC_Text_Tissue_Culture", "TISSUE CULTURE",
                   (r_center_x, sign_y, 2.50), size=0.20, extrude=0.03,
                   mat=mat_signage, parent=root)

    create_3d_text("TC_Text_Laboratory", "LABORATORY",
                   (r_center_x, sign_y, 2.18), size=0.19, extrude=0.03,
                   mat=mat_signage, parent=root)

    # Ground floor right window (below signage)
    w_r1_w = 2.25
    w_r1_h = 1.35
    w_r1_z0 = 0.65
    w_r1_z1 = w_r1_z0 + w_r1_h
    create_quads("TC_Win_Right_GF_Glass", [
        (r_center_x - w_r1_w / 2.0 + 0.04, r_center_x + w_r1_w / 2.0 - 0.04,
         w_r1_z0 + 0.04, w_r1_z1 - 0.04)
    ], 'XZ', -HY - 0.01, -1, mat_glass_tint, root)

    create_quads("TC_Win_Right_GF_Frame", [
        (r_center_x - w_r1_w / 2.0, r_center_x + w_r1_w / 2.0, w_r1_z0, w_r1_z0 + 0.04),
        (r_center_x - w_r1_w / 2.0, r_center_x + w_r1_w / 2.0, w_r1_z1 - 0.04, w_r1_z1),
        (r_center_x - w_r1_w / 2.0, r_center_x - w_r1_w / 2.0 + 0.04, w_r1_z0, w_r1_z1),
        (r_center_x + w_r1_w / 2.0 - 0.04, r_center_x + w_r1_w / 2.0, w_r1_z0, w_r1_z1),
        (r_center_x - w_r1_w / 6.0 - 0.02, r_center_x - w_r1_w / 6.0 + 0.02, w_r1_z0, w_r1_z1),
        (r_center_x + w_r1_w / 6.0 - 0.02, r_center_x + w_r1_w / 6.0 + 0.02, w_r1_z0, w_r1_z1)
    ], 'XZ', -HY - 0.015, -1, mat_aluminum, root)

    grille_bars_r1 = []
    for bi in range(1, 6):
        bz = w_r1_z0 + bi * (w_r1_h / 6.0)
        grille_bars_r1.append((r_center_x - w_r1_w / 2.0 + 0.04, r_center_x + w_r1_w / 2.0 - 0.04,
                               bz - 0.01, bz + 0.01))
    create_quads("TC_Win_Right_GF_Grille", grille_bars_r1, 'XZ', -HY - 0.02, -1, mat_grille_white, root)

    # Second floor right window
    w_r2_w = 2.65
    w_r2_h = 1.40
    w_r2_z0 = 4.25
    w_r2_z1 = w_r2_z0 + w_r2_h
    create_quads("TC_Win_Right_UF_Glass", [
        (r_center_x - w_r2_w / 2.0 + 0.04, r_center_x + w_r2_w / 2.0 - 0.04,
         w_r2_z0 + 0.04, w_r2_z1 - 0.04)
    ], 'XZ', -HY - 0.01, -1, mat_glass_tint, root)

    create_quads("TC_Win_Right_UF_Frame", [
        (r_center_x - w_r2_w / 2.0, r_center_x + w_r2_w / 2.0, w_r2_z0, w_r2_z0 + 0.04),
        (r_center_x - w_r2_w / 2.0, r_center_x + w_r2_w / 2.0, w_r2_z1 - 0.04, w_r2_z1),
        (r_center_x - w_r2_w / 2.0, r_center_x - w_r2_w / 2.0 + 0.04, w_r2_z0, w_r2_z1),
        (r_center_x + w_r2_w / 2.0 - 0.04, r_center_x + w_r2_w / 2.0, w_r2_z0, w_r2_z1),
        (r_center_x - w_r2_w / 6.0 - 0.02, r_center_x - w_r2_w / 6.0 + 0.02, w_r2_z0, w_r2_z1),
        (r_center_x + w_r2_w / 6.0 - 0.02, r_center_x + w_r2_w / 6.0 + 0.02, w_r2_z0, w_r2_z1)
    ], 'XZ', -HY - 0.015, -1, mat_aluminum, root)

    grille_bars_r2 = []
    for bi in range(1, 6):
        bz = w_r2_z0 + bi * (w_r2_h / 6.0)
        grille_bars_r2.append((r_center_x - w_r2_w / 2.0 + 0.04, r_center_x + w_r2_w / 2.0 - 0.04,
                               bz - 0.01, bz + 0.01))
    create_quads("TC_Win_Right_UF_Grille", grille_bars_r2, 'XZ', -HY - 0.02, -1, mat_grille_white, root)

    # -----------------------------------------------------------------------
    # 5. Side Facade Windows & AC Units (IMG_3838, IMG_3839)
    # -----------------------------------------------------------------------
    bay_centers_y = [-8.55, -2.85, 2.85, 8.55]

    # (A) Left Side (South-West)
    for bi, by in enumerate(bay_centers_y):
        by_win = -6.80 if bi == 0 else by
        w_s_len = 2.10
        w_s_h = 1.25
        w_s_z0 = 0.85
        w_s_z1 = w_s_z0 + w_s_h

        create_quads(f"TC_Win_Left_GF_{bi}_Glass", [
            (by_win - w_s_len / 2.0 + 0.04, by_win + w_s_len / 2.0 - 0.04,
             w_s_z0 + 0.04, w_s_z1 - 0.04)
        ], 'YZ', -HX - 0.01, -1, mat_glass_tint, root)

        create_quads(f"TC_Win_Left_GF_{bi}_Frame", [
            (by_win - w_s_len / 2.0, by_win + w_s_len / 2.0, w_s_z0, w_s_z0 + 0.04),
            (by_win - w_s_len / 2.0, by_win + w_s_len / 2.0, w_s_z1 - 0.04, w_s_z1),
            (by_win - w_s_len / 2.0, by_win - w_s_len / 2.0 + 0.04, w_s_z0, w_s_z1),
            (by_win + w_s_len / 2.0 - 0.04, by_win + w_s_len / 2.0, w_s_z0, w_s_z1),
            (by_win - 0.02, by_win + 0.02, w_s_z0, w_s_z1)
        ], 'YZ', -HX - 0.015, -1, mat_aluminum, root)

        grille_s = []
        for g_i in range(1, 5):
            gz = w_s_z0 + g_i * (w_s_h / 5.0)
            grille_s.append((by_win - w_s_len / 2.0 + 0.04, by_win + w_s_len / 2.0 - 0.04,
                             gz - 0.01, gz + 0.01))
        create_quads(f"TC_Win_Left_GF_{bi}_Grille", grille_s, 'YZ', -HX - 0.02, -1, mat_grille_white, root)

        if bi > 0:
            w_u_z0 = 4.25
            w_u_z1 = w_u_z0 + w_s_h
            create_quads(f"TC_Win_Left_UF_{bi}_Glass", [
                (by - w_s_len / 2.0 + 0.04, by + w_s_len / 2.0 - 0.04,
                 w_u_z0 + 0.04, w_u_z1 - 0.04)
            ], 'YZ', -HX - 0.01, -1, mat_glass_tint, root)

            create_quads(f"TC_Win_Left_UF_{bi}_Frame", [
                (by - w_s_len / 2.0, by + w_s_len / 2.0, w_u_z0, w_u_z0 + 0.04),
                (by - w_s_len / 2.0, by + w_s_len / 2.0, w_u_z1 - 0.04, w_u_z1),
                (by - w_s_len / 2.0, by - w_s_len / 2.0 + 0.04, w_u_z0, w_u_z1),
                (by + w_s_len / 2.0 - 0.04, by + w_s_len / 2.0, w_u_z0, w_u_z1),
                (by - 0.02, by + 0.02, w_u_z0, w_u_z1)
            ], 'YZ', -HX - 0.015, -1, mat_aluminum, root)

        # (A) Ground-mounted AC units on left side under windows (IMG_3838)
        if bi > 0:
            create_split_ac(f"TC_AC_Left_GF_{bi}",
                            (-HX - 0.18, by, 0.58),
                            size=(0.32, 0.85, 0.58), face_dir='-X', has_bracket=False)

    # (B) Right Side (North-East, IMG_3839)
    for bi, by in enumerate(bay_centers_y):
        w_s_len = 2.20
        w_s_h = 1.25
        w_s_z0 = 0.85
        w_s_z1 = w_s_z0 + w_s_h

        create_quads(f"TC_Win_Right_GF_{bi}_Glass", [
            (by - w_s_len / 2.0 + 0.04, by + w_s_len / 2.0 - 0.04,
             w_s_z0 + 0.04, w_s_z1 - 0.04)
        ], 'YZ', HX + 0.01, 1, mat_glass_tint, root)

        create_quads(f"TC_Win_Right_GF_{bi}_Frame", [
            (by - w_s_len / 2.0, by + w_s_len / 2.0, w_s_z0, w_s_z0 + 0.04),
            (by - w_s_len / 2.0, by + w_s_len / 2.0, w_s_z1 - 0.04, w_s_z1),
            (by - w_s_len / 2.0, by - w_s_len / 2.0 + 0.04, w_s_z0, w_s_z1),
            (by + w_s_len / 2.0 - 0.04, by + w_s_len / 2.0, w_s_z0, w_s_z1),
            (by - 0.02, by + 0.02, w_s_z0, w_s_z1)
        ], 'YZ', HX + 0.015, 1, mat_aluminum, root)

        grille_r = []
        for g_i in range(1, 5):
            gz = w_s_z0 + g_i * (w_s_h / 5.0)
            grille_r.append((by - w_s_len / 2.0 + 0.04, by + w_s_len / 2.0 - 0.04,
                             gz - 0.01, gz + 0.01))
        create_quads(f"TC_Win_Right_GF_{bi}_Grille", grille_r, 'YZ', HX + 0.02, 1, mat_grille_white, root)

        w_u_z0 = 4.25
        w_u_z1 = w_u_z0 + w_s_h
        create_quads(f"TC_Win_Right_UF_{bi}_Glass", [
            (by - w_s_len / 2.0 + 0.04, by + w_s_len / 2.0 - 0.04,
             w_u_z0 + 0.04, w_u_z1 - 0.04)
        ], 'YZ', HX + 0.01, 1, mat_glass_tint, root)

        create_quads(f"TC_Win_Right_UF_{bi}_Frame", [
            (by - w_s_len / 2.0, by + w_s_len / 2.0, w_u_z0, w_u_z0 + 0.04),
            (by - w_s_len / 2.0, by + w_s_len / 2.0, w_u_z1 - 0.04, w_u_z1),
            (by - w_s_len / 2.0, by - w_s_len / 2.0 + 0.04, w_u_z0, w_u_z1),
            (by + w_s_len / 2.0 - 0.04, by + w_s_len / 2.0, w_u_z0, w_u_z1),
            (by - 0.02, by + 0.02, w_u_z0, w_u_z1)
        ], 'YZ', HX + 0.015, 1, mat_aluminum, root)

        # (1) Prominent bracket-mounted 2nd floor LG split unit in front bay 0 (IMG_3839)
        if bi == 0:
            create_split_ac("TC_AC_Right_UF_0",
                            (HX + 0.18, -9.25, 4.85),
                            size=(0.32, 0.85, 0.58), face_dir='+X', has_bracket=True)

        # (2) Ground level AC condenser units under every ground floor window (IMG_3839)
        create_split_ac(f"TC_AC_Right_GF_{bi}",
                        (HX + 0.18, by, 0.58),
                        size=(0.32, 0.85, 0.58), face_dir='+X', has_bracket=False)

    # -----------------------------------------------------------------------
    # 6. Watertight Authentic Roof Structure & Fascia (Zero Gaps / Solid)
    # -----------------------------------------------------------------------
    rx0 = -HX - OVERHANG  # -7.10 m
    rx1 =  HX + OVERHANG  # +7.10 m
    ry0 = -HY - OVERHANG  # -12.10 m
    ry1 =  HY + OVERHANG  # +12.10 m

    # Roof Slopes (Standing seam forest green corrugated panels)
    # Left slope: rx0 (Z = EAVE_Z) -> X = 0 (Z = ROOF_APEX_Z)
    create_sloped_quad("TC_Roof_Slope_Left",
                       (rx0, ry0, EAVE_Z),
                       (0.0, ry0, ROOF_APEX_Z),
                       (0.0, ry1, ROOF_APEX_Z),
                       (rx0, ry1, EAVE_Z),
                       mat=mat_roof, parent=root)

    # Right slope: X = 0 (Z = ROOF_APEX_Z) -> rx1 (Z = EAVE_Z)
    create_sloped_quad("TC_Roof_Slope_Right",
                       (0.0, ry0, ROOF_APEX_Z),
                       (rx1, ry0, EAVE_Z),
                       (rx1, ry1, EAVE_Z),
                       (0.0, ry1, ROOF_APEX_Z),
                       mat=mat_roof, parent=root)

    # Ridge Cap (along X=0 from ry0 to ry1)
    create_box("TC_Roof_Ridge_Cap", (0.0, 0.0, ROOF_APEX_Z + 0.03),
               (0.35, ry1 - ry0 + 0.06, 0.06), mat_fascia, root)

    # -----------------------------------------------------------------------
    # Watertight Gable Fascia Perimeter (Front & Rear)
    # Modeled with exact 3D polygon quads to ensure 100% precision with NO scissor/crossing artifacts!
    # -----------------------------------------------------------------------
    fascia_h = 0.22 # Vertical fascia band height
    fascia_thick = 0.06 # Y thickness

    # Front Gable Fascia at Y = ry0
    # Left Quad (rx0 to 0)
    create_sloped_quad("TC_Fascia_Front_L_Face",
                       (rx0, ry0, EAVE_Z),
                       (0.0, ry0, ROOF_APEX_Z),
                       (0.0, ry0, ROOF_APEX_Z - fascia_h),
                       (rx0, ry0, EAVE_Z - fascia_h),
                       mat=mat_fascia, parent=root)
    # Right Quad (0 to rx1)
    create_sloped_quad("TC_Fascia_Front_R_Face",
                       (0.0, ry0, ROOF_APEX_Z),
                       (rx1, ry0, EAVE_Z),
                       (rx1, ry0, EAVE_Z - fascia_h),
                       (0.0, ry0, ROOF_APEX_Z - fascia_h),
                       mat=mat_fascia, parent=root)

    # Rear Gable Fascia at Y = ry1
    create_sloped_quad("TC_Fascia_Rear_L_Face",
                       (0.0, ry1, ROOF_APEX_Z),
                       (rx0, ry1, EAVE_Z),
                       (rx0, ry1, EAVE_Z - fascia_h),
                       (0.0, ry1, ROOF_APEX_Z - fascia_h),
                       mat=mat_fascia, parent=root)
    create_sloped_quad("TC_Fascia_Rear_R_Face",
                       (rx1, ry1, EAVE_Z),
                       (0.0, ry1, ROOF_APEX_Z),
                       (0.0, ry1, ROOF_APEX_Z - fascia_h),
                       (rx1, ry1, EAVE_Z - fascia_h),
                       mat=mat_fascia, parent=root)

    # Side Horizontal Fascia Boards (Left & Right along eaves)
    create_box("TC_Fascia_Left", (rx0 - fascia_thick / 2.0, 0.0, EAVE_Z - fascia_h / 2.0),
               (fascia_thick, ry1 - ry0, fascia_h), mat_fascia, root)
    create_box("TC_Fascia_Right", (rx1 + fascia_thick / 2.0, 0.0, EAVE_Z - fascia_h / 2.0),
               (fascia_thick, ry1 - ry0, fascia_h), mat_fascia, root)

    # -----------------------------------------------------------------------
    # Under-Eave Soffit Panels (White Vented / Grooved Soffits)
    # -----------------------------------------------------------------------
    soffit_z_offset = 0.03

    # Front Overhang Sloped Soffits (Y from ry0 to -HY)
    create_sloped_quad("TC_Soffit_Front_Left",
                       (rx0, ry0, EAVE_Z - soffit_z_offset),
                       (0.0, ry0, ROOF_APEX_Z - soffit_z_offset),
                       (0.0, -HY, ROOF_APEX_Z - soffit_z_offset),
                       (rx0, -HY, EAVE_Z - soffit_z_offset),
                       mat=mat_soffit, parent=root)

    create_sloped_quad("TC_Soffit_Front_Right",
                       (0.0, ry0, ROOF_APEX_Z - soffit_z_offset),
                       (rx1, ry0, EAVE_Z - soffit_z_offset),
                       (rx1, -HY, EAVE_Z - soffit_z_offset),
                       (0.0, -HY, ROOF_APEX_Z - soffit_z_offset),
                       mat=mat_soffit, parent=root)

    # Rear Overhang Sloped Soffits (Y from HY to ry1)
    create_sloped_quad("TC_Soffit_Rear_Left",
                       (rx0, HY, EAVE_Z - soffit_z_offset),
                       (0.0, HY, ROOF_APEX_Z - soffit_z_offset),
                       (0.0, ry1, ROOF_APEX_Z - soffit_z_offset),
                       (rx0, ry1, EAVE_Z - soffit_z_offset),
                       mat=mat_soffit, parent=root)

    create_sloped_quad("TC_Soffit_Rear_Right",
                       (0.0, HY, ROOF_APEX_Z - soffit_z_offset),
                       (rx1, HY, EAVE_Z - soffit_z_offset),
                       (rx1, ry1, EAVE_Z - soffit_z_offset),
                       (0.0, ry1, ROOF_APEX_Z - soffit_z_offset),
                       mat=mat_soffit, parent=root)

    # Side Overhang Soffits (Under side eaves)
    create_quads("TC_Soffit_Side_Left", [
        (rx0, -HX, -HY, HY)
    ], 'XY', EAVE_Z - soffit_z_offset, -1, mat_soffit, root)

    create_quads("TC_Soffit_Side_Right", [
        (HX, rx1, -HY, HY)
    ], 'XY', EAVE_Z - soffit_z_offset, -1, mat_soffit, root)

    # -----------------------------------------------------------------------
    # 7. PVC Gutters & Downspouts (IMG_3838, IMG_3839)
    # -----------------------------------------------------------------------
    gutter_r = 0.08
    create_cylinder("TC_Gutter_Left", (rx0, 0.0, EAVE_Z - fascia_h + 0.05),
                    gutter_r, ry1 - ry0, mat_downspout, root,
                    rot=(math.radians(90), 0, 0), segments=8)

    create_cylinder("TC_Gutter_Right", (rx1, 0.0, EAVE_Z - fascia_h + 0.05),
                    gutter_r, ry1 - ry0, mat_downspout, root,
                    rot=(math.radians(90), 0, 0), segments=8)

    # Downspouts mounted along the side pilasters
    for cy in side_col_ys:
        create_cylinder(f"TC_Downspout_Left_{cy}",
                        (-HX - col_proj - 0.04, cy, EAVE_Z / 2.0),
                        0.04, EAVE_Z, mat_downspout, root, segments=6)
        create_cylinder(f"TC_Downspout_Right_{cy}",
                        (HX + col_proj + 0.04, cy, EAVE_Z / 2.0),
                        0.04, EAVE_Z, mat_downspout, root, segments=6)

    # -----------------------------------------------------------------------
    # 8. Rear Facade (North-West)
    # -----------------------------------------------------------------------
    create_box("TC_Door_Rear", (0.0, HY + 0.02, 1.15),
               (1.10, 0.04, 2.10), mat_aluminum, root)

    for rx in [-3.50, 3.50]:
        create_quads(f"TC_Win_Rear_UF_{rx}_Glass", [
            (rx - 0.90, rx + 0.90, 4.30, 5.50)
        ], 'XZ', HY + 0.01, 1, mat_glass_tint, root)
        create_quads(f"TC_Win_Rear_UF_{rx}_Frame", [
            (rx - 0.95, rx + 0.95, 4.25, 4.30),
            (rx - 0.95, rx + 0.95, 5.50, 5.55),
            (rx - 0.95, rx - 0.90, 4.25, 5.55),
            (rx + 0.90, rx + 0.95, 4.25, 5.55)
        ], 'XZ', HY + 0.015, 1, mat_aluminum, root)

    # -----------------------------------------------------------------------
    # 9. Mesh Consolidation & Optimization for Performance Budget (<= 300 KB)
    # -----------------------------------------------------------------------
    print("Consolidating meshes by material to minimize draw calls and GLTF node count...")

    bpy.ops.object.select_all(action='DESELECT')
    mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH']

    mat_groups = {}
    for obj in mesh_objs:
        mat_name = obj.data.materials[0].name if obj.data.materials else "No_Mat"
        mat_groups.setdefault(mat_name, []).append(obj)

    consolidated_objs = []
    for mat_name, objs in mat_groups.items():
        if len(objs) == 1:
            objs[0].name = f"TC_Group_{mat_name}"
            consolidated_objs.append(objs[0])
            continue

        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        joined = bpy.context.active_object
        joined.name = f"TC_Group_{mat_name}"
        consolidated_objs.append(joined)

    for obj in consolidated_objs:
        obj.parent = root

    # -----------------------------------------------------------------------
    # 10. Export to GLB
    # -----------------------------------------------------------------------
    os.makedirs("models", exist_ok=True)
    out_glb = os.path.abspath("models/tissue_culture_building.glb")

    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for obj in consolidated_objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root

    print(f"Exporting GLB to: {out_glb}")
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format='GLB',
        use_selection=True,
        export_apply=False,
        export_materials='EXPORT',
        export_yup=True
    )

    size_kb = os.path.getsize(out_glb) / 1024.0
    print(f"Export complete! Model size: {size_kb:.1f} KB (budget: <= 300 KB)")

build_tissue_culture()
