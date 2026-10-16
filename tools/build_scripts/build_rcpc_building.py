"""
build_rcpc_building.py — Authentic Bespoke 3D Model of the DA-LARES RCPC Building
(Regional Crop Protection Center - RCPC CALABARZON)

Ground-Truth Architectural Alignment & Directives:
1. Exact Footprint & Alignment from Field Photos (IMG_3840 & IMG_3841) & buildings.json:
   - Front facade: IMG_3841 (width = 14.0 m along local X in [-7.0, +7.0], at Y = -13.55, facing -Y / WSW).
   - Right facade: IMG_3840 (length = 27.1 m along local Y in [-13.55, +13.55], at X = -7.00, facing -X / NNW toward campus road).
   - Left facade: length = 27.1 m along local Y, at X = +7.00 (facing +X / SSE).
   - Rear facade: width = 14.0 m along local X, at Y = +13.55 (facing +Y / ENE).
   - Local centroid: [121.16755343, 13.95830711], Mapbox rotation: 69.8 deg clockwise.
   - Roads.json entrance node: [121.16752302, 13.95838533] aligns directly with the central
     entrance portico on the right facade (-X side, Y = 0.0).

2. Architectural Layout:
   - Right Facade (IMG_3840, X = -7.00):
     * 5 bays separated by 6 vertical cream pilasters.
     * Bay 1 (Y ~ +10.84): Large 4-panel commercial window with concrete hood.
     * Bay 2 (Y ~ +5.42): Two narrower 2-panel laboratory windows with concrete hoods.
     * Bay 3 (Y ~ 0.00): Main Entrance Portico:
       - Dark navy canopy box with two vertical support posts down to landing.
       - Official 3D white text "RCPC CALABARZON" + circular DA logo medallion.
       - Commercial double glass doors with dark bronze aluminum frame, handles, and glass transom.
       - Elevated teal-tiled entrance landing with 4 front steps descending toward -X.
       - Sloping concrete ADA ramp extending toward -Y (in front of Bay 4) with 3-tier stainless steel tubular handrails.
     * Pilaster at Y = -2.71: Stacked wall-mounted split AC outdoor condenser units with fan grilles & LG badges.
     * Bay 4 (Y ~ -5.42): Large 4-panel commercial window with concrete hood (behind ADA ramp).
     * Bay 5 (Y ~ -10.84): Large 4-panel commercial window with concrete hood.
   - Front Facade (IMG_3841, Y = -13.55):
     * Left Bay (X ~ -3.50, adjacent to right facade corner): Large 4-panel commercial window with concrete eyebrow hood.
     * Center pilaster (X = 0.00).
     * Right Bay (X ~ +3.50): Elevated entrance door with dark green leaf, glass transom, concrete hood,
       6-step teal stair, concrete cheek wall on the right, and stainless steel handrail.
   - Left & Rear Facades: Symmetrical research laboratory windows and white PVC downspouts.
   - Rooftop: Parapet wall with cream coping cap and waterproof membrane flat roof.

3. Performance Budget:
   - Consolidated PBR meshes joined by material to stay strictly under 300 KB (target ~210 KB).
"""

import bpy
import bmesh
import math
from mathutils import Vector
import os

# ---------------------------------------------------------------------------
# Helper: Material Builder
# ---------------------------------------------------------------------------
def create_mat(name, color, roughness=0.5, metallic=0.0, specular=0.5, emission=None):
    mat = bpy.data.materials.get(name)
    if mat:
        bpy.data.materials.remove(mat, do_unlink=True)
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        if 'Specular IOR Level' in bsdf.inputs:
            bsdf.inputs['Specular IOR Level'].default_value = specular
        elif 'Specular' in bsdf.inputs:
            bsdf.inputs['Specular'].default_value = specular
        if emission:
            if 'Emission Color' in bsdf.inputs:
                bsdf.inputs['Emission Color'].default_value = (emission[0], emission[1], emission[2], 1.0)
            if 'Emission Strength' in bsdf.inputs and len(emission) > 3:
                bsdf.inputs['Emission Strength'].default_value = emission[3]
    return mat

# ---------------------------------------------------------------------------
# Helper: Geometry Generators
# ---------------------------------------------------------------------------
def create_box(name, center, size, mat, parent=None, rot=(0, 0, 0)):
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(mesh)
    bm.free()

    obj.scale = size
    obj.location = center
    obj.rotation_euler = rot

    if mat:
        obj.data.materials.append(mat)
    return obj

def create_cylinder(name, center, radius, depth, mat, segments=16, parent=None, rot=(0, 0, 0)):
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent

    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=depth)
    bm.to_mesh(mesh)
    bm.free()

    obj.location = center
    obj.rotation_euler = rot

    if mat:
        obj.data.materials.append(mat)
    return obj


def create_pipe_between(name, p1, p2, radius, mat=None, parent=None, segments=12):
    v1 = Vector(p1)
    v2 = Vector(p2)
    diff = v2 - v1
    length = diff.length
    if length < 1e-4:
        return None
    center = (v1 + v2) * 0.5
    direction = diff.normalized()
    
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
        
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=length)
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = center
    rot_quat = Vector((0.0, 0.0, 1.0)).rotation_difference(direction)
    obj.rotation_euler = rot_quat.to_euler()
    if mat:
        obj.data.materials.append(mat)
    return obj

def create_wedge(name, p0, p1, p2, p3, p4, p5, mat, parent=None):
    """Creates a triangular prism/wedge (for ramps)."""
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent

    bm = bmesh.new()
    verts = [bm.verts.new(p) for p in [p0, p1, p2, p3, p4, p5]]
    # 2 triangle ends
    bm.faces.new([verts[0], verts[1], verts[2]])
    bm.faces.new([verts[5], verts[4], verts[3]])
    # 3 quad sides
    bm.faces.new([verts[0], verts[3], verts[4], verts[1]])
    bm.faces.new([verts[1], verts[4], verts[5], verts[2]])
    bm.faces.new([verts[2], verts[5], verts[3], verts[0]])

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    if mat:
        obj.data.materials.append(mat)
    return obj

# ---------------------------------------------------------------------------
# Master Builder: RCPC Building
# ---------------------------------------------------------------------------
def build_rcpc_building():
    print("=====================================================================")
    print(" Building Authentic RCPC Building (DA-LARES Crop Protection Center)  ")
    print("=====================================================================")

    # Clear existing scene
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)

    root = bpy.data.objects.new("RCPC_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # -----------------------------------------------------------------------
    # Dimensions & Spatial Setup
    # -----------------------------------------------------------------------
    WIDTH_X  = 14.00  # Front facade width (along X from -7.00 to +7.00)
    LENGTH_Y = 27.10  # Right facade length (along Y from -13.55 to +13.55)
    WALL_H   = 3.80   # Main wall height
    PARAPET_H= 0.95   # Parapet wall height above horizontal beam
    TOTAL_H  = WALL_H + PARAPET_H # 4.75 m total height
    FLOOR_Z  = 0.90   # Raised finished floor level (6 steps on front, 4 steps on right)
    BASE_SKIRT_H = 0.50 # Dark teal foundation skirt

    X_RIGHT  = -WIDTH_X / 2.0  # -7.00 m (Right facade facing -X / NNW)
    X_LEFT   =  WIDTH_X / 2.0  # +7.00 m (Left facade facing +X / SSE)
    Y_FRONT  = -LENGTH_Y / 2.0 # -13.55 m (Front facade facing -Y / WSW)
    Y_REAR   =  LENGTH_Y / 2.0 # +13.55 m (Rear facade facing +Y / ENE)

    # -----------------------------------------------------------------------
    # Materials Definition
    # -----------------------------------------------------------------------
    # Rich Tropical Sea-Green / Teal Wall Stucco (IMG_3840 & IMG_3841)
    mat_teal_wall       = create_mat("RCPC_TealWall", (0.09, 0.44, 0.42), roughness=0.55, specular=0.25)
    mat_teal_dark_skirt = create_mat("RCPC_TealSkirt", (0.05, 0.28, 0.26), roughness=0.65, specular=0.20)
    mat_cream_pilaster  = create_mat("RCPC_CreamPilaster", (0.88, 0.87, 0.82), roughness=0.45, specular=0.35)
    mat_navy_canopy     = create_mat("RCPC_NavyCanopy", (0.10, 0.14, 0.20), roughness=0.35, specular=0.60)
    mat_sign_white      = create_mat("RCPC_SignWhite", (0.96, 0.96, 0.96), roughness=0.20, specular=0.80, emission=(1.0, 1.0, 1.0, 0.25))
    mat_da_green        = create_mat("RCPC_DAGreen", (0.08, 0.48, 0.18), roughness=0.30, specular=0.50)
    mat_da_gold         = create_mat("RCPC_DAGold", (0.92, 0.72, 0.12), roughness=0.30, metallic=0.60)
    mat_aluminum_dark   = create_mat("RCPC_AluminumDark", (0.14, 0.14, 0.15), roughness=0.35, metallic=0.70)
    mat_glass_tint      = create_mat("RCPC_GlassTint", (0.16, 0.26, 0.30), roughness=0.10, specular=0.95)
    mat_glass_frosted   = create_mat("RCPC_GlassFrosted", (0.75, 0.84, 0.86), roughness=0.30, specular=0.80)
    mat_hood_concrete   = create_mat("RCPC_HoodConcrete", (0.84, 0.85, 0.83), roughness=0.50)
    mat_stair_teal      = create_mat("RCPC_StairTeal", (0.08, 0.38, 0.35), roughness=0.50)
    mat_stair_nosing    = create_mat("RCPC_StairNosing", (0.90, 0.89, 0.85), roughness=0.40)
    mat_stainless       = create_mat("RCPC_Stainless", (0.85, 0.88, 0.90), roughness=0.20, metallic=0.95)
    mat_front_door_green= create_mat("RCPC_DoorGreen", (0.10, 0.28, 0.20), roughness=0.40)
    mat_roof_membrane   = create_mat("RCPC_RoofMembrane", (0.60, 0.62, 0.63), roughness=0.80)
    mat_ac_case         = create_mat("RCPC_ACCase", (0.86, 0.86, 0.84), roughness=0.35)
    mat_ac_grille       = create_mat("RCPC_ACGrille", (0.25, 0.25, 0.25), roughness=0.50)
    mat_downspout       = create_mat("RCPC_Downspout", (0.88, 0.87, 0.83), roughness=0.40)

    # -----------------------------------------------------------------------
    # 1. Base Skirt & Main Walls Body
    # -----------------------------------------------------------------------
    # Dark Teal Foundation Damp Skirt (0 to BASE_SKIRT_H)
    create_box("RCPC_Base_Skirt",
               (0, 0, BASE_SKIRT_H / 2.0),
               (WIDTH_X + 0.04, LENGTH_Y + 0.04, BASE_SKIRT_H),
               mat_teal_dark_skirt, root)

    # Main Teal Wall Mass (BASE_SKIRT_H to WALL_H)
    main_wall_h = WALL_H - BASE_SKIRT_H
    create_box("RCPC_Main_Walls",
               (0, 0, BASE_SKIRT_H + main_wall_h / 2.0),
               (WIDTH_X, LENGTH_Y, main_wall_h),
               mat_teal_wall, root)

    # Parapet Teal Walls (WALL_H to TOTAL_H)
    create_box("RCPC_Parapet_Front",
               (0, Y_FRONT + 0.15, WALL_H + PARAPET_H / 2.0),
               (WIDTH_X, 0.30, PARAPET_H),
               mat_teal_wall, root)
    create_box("RCPC_Parapet_Rear",
               (0, Y_REAR - 0.15, WALL_H + PARAPET_H / 2.0),
               (WIDTH_X, 0.30, PARAPET_H),
               mat_teal_wall, root)
    create_box("RCPC_Parapet_Right",
               (X_RIGHT + 0.15, 0, WALL_H + PARAPET_H / 2.0),
               (0.30, LENGTH_Y - 0.60, PARAPET_H),
               mat_teal_wall, root)
    create_box("RCPC_Parapet_Left",
               (X_LEFT - 0.15, 0, WALL_H + PARAPET_H / 2.0),
               (0.30, LENGTH_Y - 0.60, PARAPET_H),
               mat_teal_wall, root)

    # Parapet Coping Cap (Cream continuous rim on top)
    coping_thick = 0.08
    coping_w = 0.42
    coping_z = TOTAL_H + coping_thick / 2.0
    create_box("RCPC_Coping_Front", (0, Y_FRONT + 0.15, coping_z), (WIDTH_X + 0.12, coping_w, coping_thick), mat_cream_pilaster, root)
    create_box("RCPC_Coping_Rear",  (0, Y_REAR - 0.15, coping_z),  (WIDTH_X + 0.12, coping_w, coping_thick), mat_cream_pilaster, root)
    create_box("RCPC_Coping_Right", (X_RIGHT + 0.15, 0, coping_z), (coping_w, LENGTH_Y + 0.12, coping_thick), mat_cream_pilaster, root)
    create_box("RCPC_Coping_Left",  (X_LEFT - 0.15, 0, coping_z),  (coping_w, LENGTH_Y + 0.12, coping_thick), mat_cream_pilaster, root)

    # Waterproof Roof Flat Membrane inside parapet
    create_box("RCPC_Roof_Membrane",
               (0, 0, WALL_H + 0.02),
               (WIDTH_X - 0.60, LENGTH_Y - 0.60, 0.04),
               mat_roof_membrane, root)

    # -----------------------------------------------------------------------
    # 2. Horizontal Cream Divide Beam
    # -----------------------------------------------------------------------
    beam_h = 0.32
    beam_d = 0.08
    beam_z = WALL_H - beam_h / 2.0
    create_box("RCPC_Beam_Front", (0, Y_FRONT - beam_d / 2.0, beam_z), (WIDTH_X + 0.16, beam_d, beam_h), mat_cream_pilaster, root)
    create_box("RCPC_Beam_Rear",  (0, Y_REAR + beam_d / 2.0, beam_z),  (WIDTH_X + 0.16, beam_d, beam_h), mat_cream_pilaster, root)
    create_box("RCPC_Beam_Right", (X_RIGHT - beam_d / 2.0, 0, beam_z), (beam_d, LENGTH_Y + 0.16, beam_h), mat_cream_pilaster, root)
    create_box("RCPC_Beam_Left",  (X_LEFT + beam_d / 2.0, 0, beam_z),  (beam_d, LENGTH_Y + 0.16, beam_h), mat_cream_pilaster, root)

    # -----------------------------------------------------------------------
    # 3. Vertical Cream Pilasters / Structural Columns
    # -----------------------------------------------------------------------
    col_size = 0.45
    col_h = TOTAL_H
    col_z = col_h / 2.0
    # 4 Corner Pilasters
    for cx, cy in [(X_RIGHT, Y_FRONT), (X_LEFT, Y_FRONT), (X_RIGHT, Y_REAR), (X_LEFT, Y_REAR)]:
        create_box(f"RCPC_CornerCol_{cx:.1f}_{cy:.1f}", (cx, cy, col_z), (col_size, col_size, col_h), mat_cream_pilaster, root)

    # Front Facade Center Pilaster (divides front into 2 bays, IMG_3841)
    create_box("RCPC_Front_CenterCol", (0, Y_FRONT - 0.04, col_z), (0.42, 0.12, col_h), mat_cream_pilaster, root)

    # Rear Facade Center Pilaster
    create_box("RCPC_Rear_CenterCol", (0, Y_REAR + 0.04, col_z), (0.42, 0.12, col_h), mat_cream_pilaster, root)

    # Right Facade Pilasters (5 bays -> 4 intermediate columns at Y = -8.13, -2.71, +2.71, +8.13)
    right_cols_y = [-8.13, -2.71, 2.71, 8.13]
    for rci, rcy in enumerate(right_cols_y):
        create_box(f"RCPC_RightCol_{rci}", (X_RIGHT - 0.04, rcy, col_z), (0.12, 0.42, col_h), mat_cream_pilaster, root)

    # Left Facade Pilasters (4 intermediate columns)
    for lci, lcy in enumerate(right_cols_y):
        create_box(f"RCPC_LeftCol_{lci}", (X_LEFT + 0.04, lcy, col_z), (0.12, 0.42, col_h), mat_cream_pilaster, root)

    # -----------------------------------------------------------------------
    # 4. Right Facade Architecture (IMG_3840 — Length 27.1 m at X = -7.00, Facing -X / NNW)
    # Bay 1 (Y ~ +10.84): Large 4-panel commercial window
    # Bay 2 (Y ~ +5.42):  Two narrower 2-panel laboratory windows
    # Bay 3 (Y ~ 0.00):   Main Entrance Portico ("RCPC CALABARZON"), steps & ramp
    # Bay 4 (Y ~ -5.42):  Large 4-panel commercial window (with AC units on col at Y=-2.71)
    # Bay 5 (Y ~ -10.84): Large 4-panel commercial window (with ADA ramp end)
    # -----------------------------------------------------------------------
    def build_right_window(prefix, center_y, width=3.80, height=1.65, num_panes=4):
        win_z = 1.15 + height / 2.0
        # Dark frame outer
        create_box(f"{prefix}_Frame_Top", (X_RIGHT - 0.02, center_y, 1.15 + height), (0.06, width, 0.05), mat_aluminum_dark, root)
        create_box(f"{prefix}_Frame_Bot", (X_RIGHT - 0.02, center_y, 1.15),          (0.06, width, 0.05), mat_aluminum_dark, root)
        create_box(f"{prefix}_Frame_L",   (X_RIGHT - 0.02, center_y - width / 2.0, win_z), (0.06, 0.05, height), mat_aluminum_dark, root)
        create_box(f"{prefix}_Frame_R",   (X_RIGHT - 0.02, center_y + width / 2.0, win_z), (0.06, 0.05, height), mat_aluminum_dark, root)
        # Vertical mullions
        pane_w = width / num_panes
        for pi in range(1, num_panes):
            create_box(f"{prefix}_Mullion_{pi}", (X_RIGHT - 0.025, center_y - width / 2.0 + pi * pane_w, win_z), (0.05, 0.04, height), mat_aluminum_dark, root)
        # Transom horizontal bar
        create_box(f"{prefix}_Transom_Bar", (X_RIGHT - 0.025, center_y, 1.15 + height * 0.68), (0.05, width, 0.04), mat_aluminum_dark, root)
        # Glass
        create_box(f"{prefix}_Glass", (X_RIGHT - 0.01, center_y, win_z), (0.02, width - 0.08, height - 0.08), mat_glass_tint, root)
        # Concrete Eyebrow Hood
        hood_proj = 0.45
        hood_h = 0.08
        create_box(f"{prefix}_Hood", (X_RIGHT - hood_proj / 2.0, center_y, 1.15 + height + 0.10),
                   (hood_proj, width + 0.35, hood_h), mat_hood_concrete, root)

    # Bay 1 Window (Left in IMG_3840, near Rear corner)
    build_right_window("RCPC_Win_R_Bay1", center_y=10.84, width=3.80, num_panes=4)

    # Bay 2: Two narrower windows side by side (IMG_3840)
    build_right_window("RCPC_Win_R_Bay2A", center_y=6.40, width=1.60, height=1.50, num_panes=2)
    build_right_window("RCPC_Win_R_Bay2B", center_y=4.44, width=1.60, height=1.50, num_panes=2)

    # Bay 4 Window (Right in IMG_3840, behind ADA ramp)
    build_right_window("RCPC_Win_R_Bay4", center_y=-5.42, width=3.80, num_panes=4)

    # Bay 5 Window (Far Right in IMG_3840, near Front corner)
    build_right_window("RCPC_Win_R_Bay5", center_y=-10.84, width=3.80, num_panes=4)

    # Stacked Outdoor AC Condenser Units on Pilaster at Y = -2.71 (IMG_3840)
    ac_col_y = -2.71
    ac_w = 0.88
    ac_d = 0.36
    ac_h = 0.58
    for ai, az in enumerate([1.55, 2.45]):
        # Metal Wall Brackets
        create_box(f"RCPC_AC_{ai}_Bkt1", (X_RIGHT - ac_d / 2.0, ac_col_y - 0.28, az - ac_h / 2.0 - 0.04), (ac_d, 0.04, 0.04), mat_aluminum_dark, root)
        create_box(f"RCPC_AC_{ai}_Bkt2", (X_RIGHT - ac_d / 2.0, ac_col_y + 0.28, az - ac_h / 2.0 - 0.04), (ac_d, 0.04, 0.04), mat_aluminum_dark, root)
        # AC White Casing
        create_box(f"RCPC_AC_{ai}_Case", (X_RIGHT - ac_d / 2.0 - 0.04, ac_col_y, az), (ac_d, ac_w, ac_h), mat_ac_case, root)
        # Front Circular Fan Grille
        create_cylinder(f"RCPC_AC_{ai}_Fan", (X_RIGHT - ac_d - 0.05, ac_col_y - 0.15, az), 0.20, 0.02, mat_ac_grille, segments=16, parent=root, rot=(0, math.radians(90), 0))
        # LG Red Badge
        create_cylinder(f"RCPC_AC_{ai}_Logo", (X_RIGHT - ac_d - 0.055, ac_col_y + 0.28, az + 0.18), 0.035, 0.01, mat_sign_white, segments=12, parent=root, rot=(0, math.radians(90), 0))

    # -----------------------------------------------------------------------
    # Main Entrance Portico (Bay 3, Y = 0.0, IMG_3840)
    # Direct alignment with roads.json entrance node [121.16752302, 13.95838533]
    # -----------------------------------------------------------------------
    port_y = 0.0
    port_w = 3.60
    port_proj = 1.90
    port_h = 0.40
    port_z = 3.40

    # Dark Navy Solid Canopy Box projecting toward -X
    create_box("RCPC_Portico_Canopy",
               (X_RIGHT - port_proj / 2.0, port_y, port_z),
               (port_proj, port_w, port_h), mat_navy_canopy, root)

    # Two Vertical Support Columns from Canopy Outer Corners to Landing
    col_out_x = X_RIGHT - port_proj + 0.15
    for c_yi, col_y in enumerate([port_y - port_w / 2.0 + 0.20, port_y + port_w / 2.0 - 0.20]):
        # Teal base pedestal
        create_box(f"RCPC_Portico_Pedestal_{c_yi}", (col_out_x, col_y, FLOOR_Z / 2.0), (0.28, 0.28, FLOOR_Z), mat_stair_teal, root)
        # Round support post
        post_h = (port_z - port_h / 2.0) - FLOOR_Z
        create_cylinder(f"RCPC_Portico_Post_{c_yi}", (col_out_x, col_y, FLOOR_Z + post_h / 2.0), 0.06, post_h, mat_cream_pilaster, segments=12, parent=root)

    # Circular White DA Logo Medallion on Sign Fascia (Left side of text in IMG_3840, so at +Y)
    sign_face_x = X_RIGHT - port_proj - 0.02
    create_cylinder("RCPC_Logo_Base", (sign_face_x, port_y + 1.25, port_z), 0.14, 0.03, mat_sign_white, segments=16, parent=root, rot=(0, math.radians(90), 0))
    create_cylinder("RCPC_Logo_Ring", (sign_face_x - 0.015, port_y + 1.25, port_z), 0.11, 0.02, mat_da_green, segments=16, parent=root, rot=(0, math.radians(90), 0))
    create_cylinder("RCPC_Logo_Gold", (sign_face_x - 0.025, port_y + 1.25, port_z), 0.06, 0.02, mat_da_gold, segments=12, parent=root, rot=(0, math.radians(90), 0))

    # Crisp 3D Text: "RCPC CALABARZON"
    try:
        font_curve = bpy.data.curves.new(type="FONT", name="RCPC_Sign_Text_Curve")
        font_curve.body = "RCPC CALABARZON"
        font_curve.size = 0.20
        font_curve.extrude = 0.02
        font_curve.resolution_u = 2
        font_curve.align_x = 'LEFT'
        font_curve.align_y = 'CENTER'

        font_obj = bpy.data.objects.new("RCPC_Sign_Text", font_curve)
        bpy.context.scene.collection.objects.link(font_obj)
        font_obj.parent = root
        font_obj.location = (sign_face_x - 0.02, port_y + 0.95, port_z)
        font_obj.rotation_euler = (math.radians(90), 0, math.radians(-90))
        font_obj.data.materials.append(mat_sign_white)

        # Convert text to mesh
        bpy.context.view_layer.objects.active = font_obj
        font_obj.select_set(True)
        bpy.ops.object.convert(target='MESH')
        font_obj.select_set(False)
    except Exception as e:
        print(f"Text creation fallback: {e}")
        create_box("RCPC_Sign_Text_Fallback", (sign_face_x - 0.02, port_y - 0.15, port_z), (0.02, 2.20, 0.18), mat_sign_white, root)

    # Double Commercial Glass Doors & Transom
    door_w = 1.80
    door_h = 2.15
    create_box("RCPC_MainDoor_Frame", (X_RIGHT - 0.02, port_y, FLOOR_Z + door_h / 2.0),
               (0.08, door_w + 0.08, door_h + 0.06), mat_aluminum_dark, root)
    create_box("RCPC_MainDoor_Leaf_L", (X_RIGHT - 0.02, port_y + door_w / 4.0, FLOOR_Z + door_h / 2.0),
               (0.04, door_w / 2.0 - 0.03, door_h), mat_glass_frosted, root)
    create_box("RCPC_MainDoor_Leaf_R", (X_RIGHT - 0.02, port_y - door_w / 4.0, FLOOR_Z + door_h / 2.0),
               (0.04, door_w / 2.0 - 0.03, door_h), mat_glass_frosted, root)
    # Door push/pull bars (stainless)
    create_cylinder("RCPC_MainDoor_Bar_L", (X_RIGHT - 0.06, port_y + 0.08, FLOOR_Z + 1.05), 0.015, 0.40, mat_stainless, parent=root)
    create_cylinder("RCPC_MainDoor_Bar_R", (X_RIGHT - 0.06, port_y - 0.08, FLOOR_Z + 1.05), 0.015, 0.40, mat_stainless, parent=root)
    # Glass Transom above Door
    create_box("RCPC_MainDoor_Transom", (X_RIGHT - 0.02, port_y, FLOOR_Z + door_h + 0.28),
               (0.04, door_w, 0.45), mat_glass_tint, root)

    # Entrance Landing Slab (FLOOR_Z = 0.90 m)
    landing_w = port_w + 0.40  # 4.00 m
    landing_proj = port_proj + 0.20 # 2.10 m
    create_box("RCPC_Landing_Slab",
               (X_RIGHT - landing_proj / 2.0, port_y, FLOOR_Z / 2.0),
               (landing_proj, landing_w, FLOOR_Z), mat_stair_teal, root)
    # Landing Surface Tile
    create_box("RCPC_Landing_Tile",
               (X_RIGHT - landing_proj / 2.0, port_y, FLOOR_Z + 0.01),
               (landing_proj - 0.04, landing_w - 0.04, 0.02), mat_stair_nosing, root)

    # 4 Central Entrance Steps (descending straight forward along -X toward the road)
    # Centered directly on double glass doors at port_y = 0.00
    num_steps_main = 4
    step_rise = FLOOR_Z / num_steps_main # 0.225 m
    step_run  = 0.32
    step_w    = 2.80 # Spans Y in [-1.40, +1.40], framed cleanly between canopy columns
    for si in range(num_steps_main):
        sz = (si + 1) * step_rise
        s_depth = (num_steps_main - si) * step_run
        sx = X_RIGHT - landing_proj - s_depth / 2.0
        # Teal step body centered at port_y = 0.00
        create_box(f"RCPC_MainStep_{si}", (sx, port_y, sz - step_rise / 2.0), (s_depth, step_w, step_rise), mat_stair_teal, root)
        # Cream nosing trim
        create_box(f"RCPC_MainStep_Nosing_{si}", (X_RIGHT - landing_proj - (num_steps_main - si - 1) * step_run - 0.02, port_y, sz),
                   (0.04, step_w, 0.02), mat_stair_nosing, root)

    # ADA Accessibility Ramp (slopes from grade Z=0 at Y=-6.80 up to landing Z=0.90 at Y=-1.80)
    ramp_y_start = -6.80  # Ground level
    ramp_y_end   = -1.80  # Landing level
    ramp_len     = ramp_y_end - ramp_y_start # 5.00 m
    ramp_w       = 1.30
    ramp_x_inner = X_RIGHT # -7.00 m
    ramp_x_outer = ramp_x_inner - ramp_w # -8.30 m
    ramp_rail_x  = ramp_x_outer + 0.05   # -8.25 m

    # Create solid sloping ramp wedge
    p0 = (ramp_x_inner, ramp_y_start, 0.0)
    p1 = (ramp_x_outer, ramp_y_start, 0.0)
    p2 = (ramp_x_inner, ramp_y_end,   FLOOR_Z)
    p3 = (ramp_x_outer, ramp_y_end,   FLOOR_Z)
    p4 = (ramp_x_inner, ramp_y_end,   0.0)
    p5 = (ramp_x_outer, ramp_y_end,   0.0)
    create_wedge("RCPC_Ramp_Slope_Wedge", p0, p1, p2, p4, p3, p5, mat_stair_teal, root)

    # Stainless Steel Tubular Posts along Ramp Outer Edge (Firmly anchored on slope surface)
    ramp_posts_y = [-6.75, -5.50, -4.25, -3.00, -1.80]
    for rpi, rpy in enumerate(ramp_posts_y):
        frac = (rpy - ramp_y_start) / ramp_len
        post_base_z = frac * FLOOR_Z
        create_pipe_between(f"RCPC_Ramp_Post_{rpi}",
                            (ramp_rail_x, rpy, post_base_z),
                            (ramp_rail_x, rpy, post_base_z + 0.90),
                            radius=0.024, mat=mat_stainless, parent=root)

    # 3 Continuous Sloping Horizontal Handrail Pipes (0.30, 0.60, 0.90 above ramp slope)
    for tier_z in [0.30, 0.60, 0.90]:
        z_start = 0.00 + tier_z + (( -6.75 - ramp_y_start ) / ramp_len) * FLOOR_Z
        z_end   = FLOOR_Z + tier_z
        create_pipe_between(f"RCPC_Ramp_Rail_Tier_{tier_z:.2f}",
                            (ramp_rail_x, -6.75, z_start),
                            (ramp_rail_x, ramp_y_end, z_end),
                            radius=0.020, mat=mat_stainless, parent=root)

    # Landing Safety Railings:
    # 1. North Edge (Y = +1.95 m, along X from -7.05 to col_out_x = -8.75)
    north_rail_y = port_y + landing_w / 2.0 - 0.05
    col_north_y = port_y + port_w / 2.0 - 0.20 # +1.60
    create_pipe_between("RCPC_Landing_Post_N0", (X_RIGHT - 0.08, north_rail_y, FLOOR_Z), (X_RIGHT - 0.08, north_rail_y, FLOOR_Z + 0.90), 0.024, mat_stainless, root)
    create_pipe_between("RCPC_Landing_Post_N1", (col_out_x, north_rail_y, FLOOR_Z), (col_out_x, north_rail_y, FLOOR_Z + 0.90), 0.024, mat_stainless, root)
    for ltz in [0.45, 0.90]:
        create_pipe_between(f"RCPC_Landing_Rail_N_{ltz:.2f}",
                            (X_RIGHT - 0.08, north_rail_y, FLOOR_Z + ltz),
                            (col_out_x, north_rail_y, FLOOR_Z + ltz),
                            0.020, mat_stainless, root)
        create_pipe_between(f"RCPC_Landing_Rail_N_Ret_{ltz:.2f}",
                            (col_out_x, north_rail_y, FLOOR_Z + ltz),
                            (col_out_x, col_north_y + 0.15, FLOOR_Z + ltz),
                            0.020, mat_stainless, root)

    # 2. Connection from Ramp Top Post (-8.25, -1.80) to South Canopy Column (-8.75, -1.60)
    col_south_y = port_y - port_w / 2.0 + 0.20 # -1.60
    for ltz in [0.45, 0.90]:
        create_pipe_between(f"RCPC_Landing_Rail_Ramp_Conn_{ltz:.2f}",
                            (ramp_rail_x, ramp_y_end, FLOOR_Z + ltz),
                            (col_out_x, col_south_y - 0.15, FLOOR_Z + ltz),
                            0.020, mat_stainless, root)

    # -----------------------------------------------------------------------
    # 5. Front Facade Architecture (IMG_3841 — Width 14.0 m at Y = -13.55, Facing -Y / WSW)
    # Left Bay (X ~ -3.50, adjacent to right facade corner): Large 4-panel commercial window
    # Right Bay (X ~ +3.50): Elevated entrance door, 6-step stair & stainless rail
    # -----------------------------------------------------------------------
    # Left Bay Window (IMG_3841)
    win_f_cx = -3.50
    win_f_w  = 4.40
    win_f_h  = 1.65
    win_f_cz = 1.15 + win_f_h / 2.0

    create_box("RCPC_Win_F_Glass", (win_f_cx, Y_FRONT - 0.01, win_f_cz), (win_f_w - 0.08, 0.02, win_f_h - 0.08), mat_glass_tint, root)
    create_box("RCPC_Win_F_Frame_Top", (win_f_cx, Y_FRONT - 0.02, 1.15 + win_f_h), (win_f_w, 0.06, 0.05), mat_aluminum_dark, root)
    create_box("RCPC_Win_F_Frame_Bot", (win_f_cx, Y_FRONT - 0.02, 1.15),          (win_f_w, 0.06, 0.05), mat_aluminum_dark, root)
    create_box("RCPC_Win_F_Frame_L",   (win_f_cx - win_f_w / 2.0, Y_FRONT - 0.02, win_f_cz), (0.05, 0.06, win_f_h), mat_aluminum_dark, root)
    create_box("RCPC_Win_F_Frame_R",   (win_f_cx + win_f_w / 2.0, Y_FRONT - 0.02, win_f_cz), (0.05, 0.06, win_f_h), mat_aluminum_dark, root)
    # 4 panes -> 3 vertical mullions
    for fmi in range(1, 4):
        create_box(f"RCPC_Win_F_Mullion_{fmi}", (win_f_cx - win_f_w / 2.0 + fmi * (win_f_w / 4.0), Y_FRONT - 0.025, win_f_cz), (0.04, 0.05, win_f_h), mat_aluminum_dark, root)
    # Horizontal transom
    create_box("RCPC_Win_F_Transom", (win_f_cx, Y_FRONT - 0.025, 1.15 + win_f_h * 0.68), (win_f_w, 0.05, 0.04), mat_aluminum_dark, root)
    # Continuous concrete eyebrow hood
    create_box("RCPC_Win_F_Hood", (win_f_cx, Y_FRONT - 0.22, 1.15 + win_f_h + 0.10), (win_f_w + 0.40, 0.45, 0.08), mat_hood_concrete, root)

    # Right Bay: Elevated Entrance Door (IMG_3841)
    door_f_x = 3.50
    door_f_w = 1.25
    door_f_h = 2.20
    door_f_cz = FLOOR_Z + door_f_h / 2.0

    create_box("RCPC_FrontDoor_Frame", (door_f_x, Y_FRONT - 0.02, door_f_cz), (door_f_w + 0.08, 0.08, door_f_h + 0.06), mat_aluminum_dark, root)
    create_box("RCPC_FrontDoor_Leaf",  (door_f_x, Y_FRONT - 0.02, door_f_cz), (door_f_w, 0.04, door_f_h), mat_front_door_green, root)
    create_box("RCPC_FrontDoor_Transom", (door_f_x, Y_FRONT - 0.02, FLOOR_Z + door_f_h + 0.22), (door_f_w, 0.04, 0.35), mat_glass_tint, root)
    # Concrete Eyebrow Hood above Door
    create_box("RCPC_FrontDoor_Hood", (door_f_x, Y_FRONT - 0.22, FLOOR_Z + door_f_h + 0.45), (door_f_w + 0.40, 0.45, 0.08), mat_hood_concrete, root)

    # 6-Step Concrete Stair leading to Front Door (IMG_3841)
    num_steps_front = 6
    step_rise_front = FLOOR_Z / num_steps_front # 0.15 m
    step_run_front  = 0.28
    stair_w_front   = 1.70
    stair_total_run = num_steps_front * step_run_front # 1.68 m

    # Teal Painted Steps with Cream Tile Nosings
    for si in range(num_steps_front):
        sz = (si + 1) * step_rise_front
        sdepth = (num_steps_front - si) * step_run_front
        sy = Y_FRONT - sdepth / 2.0
        create_box(f"RCPC_FrontStep_{si}", (door_f_x, sy, sz - step_rise_front / 2.0),
                   (stair_w_front, sdepth, step_rise_front), mat_stair_teal, root)
        create_box(f"RCPC_FrontStep_Nosing_{si}", (door_f_x, Y_FRONT - (num_steps_front - si) * step_run_front + 0.02, sz),
                   (stair_w_front, 0.04, 0.02), mat_stair_nosing, root)

    # Solid Concrete Cheek Wall on the Right Side of Front Stair (IMG_3841)
    cheek_x = door_f_x + stair_w_front / 2.0 + 0.08
    cheek_w = 0.16
    create_box("RCPC_FrontCheekWall", (cheek_x, Y_FRONT - stair_total_run / 2.0, FLOOR_Z / 2.0),
               (cheek_w, stair_total_run, FLOOR_Z), mat_stair_teal, root)

    # Stainless Steel Tubular Handrail on Right Cheek Wall (IMG_3841)
    # 3 vertical posts anchored on cheek wall / stair
    y_post_top = Y_FRONT - 0.12
    y_post_mid = Y_FRONT - stair_total_run / 2.0
    y_post_bot = Y_FRONT - stair_total_run + 0.10

    z_post_top = FLOOR_Z
    z_post_mid = FLOOR_Z / 2.0
    z_post_bot = 0.15

    create_pipe_between("RCPC_Front_Rail_Post_Top", (cheek_x, y_post_top, z_post_top), (cheek_x, y_post_top, z_post_top + 0.90), 0.022, mat_stainless, root)
    create_pipe_between("RCPC_Front_Rail_Post_Mid", (cheek_x, y_post_mid, z_post_mid), (cheek_x, y_post_mid, z_post_mid + 0.90), 0.022, mat_stainless, root)
    create_pipe_between("RCPC_Front_Rail_Post_Bot", (cheek_x, y_post_bot, z_post_bot), (cheek_x, y_post_bot, z_post_bot + 0.90), 0.022, mat_stainless, root)

    # Sloping Handrail (Top Tier at +0.90 m above posts, running down along -Y)
    create_pipe_between("RCPC_Front_Rail_Sloping_Top",
                        (cheek_x, y_post_top, z_post_top + 0.90),
                        (cheek_x, y_post_bot, z_post_bot + 0.90),
                        0.022, mat_stainless, root)

    # Sloping Guardrail (Mid Tier at +0.45 m above posts)
    create_pipe_between("RCPC_Front_Rail_Sloping_Mid",
                        (cheek_x, y_post_top, z_post_top + 0.45),
                        (cheek_x, y_post_bot, z_post_bot + 0.45),
                        0.018, mat_stainless, root)

    # -----------------------------------------------------------------------
    # 6. Left & Rear Facades Architecture
    # -----------------------------------------------------------------------
    # Left Facade (+X, 27.1 m long at X = +7.00): 5 research laboratory windows
    left_win_y = [-10.84, -5.42, 0.00, 5.42, 10.84]
    for lwi, lwy in enumerate(left_win_y):
        lw_z = 1.15 + 1.65 / 2.0
        create_box(f"RCPC_Win_L_{lwi}_Glass", (X_LEFT + 0.01, lwy, lw_z), (0.02, 3.60, 1.55), mat_glass_tint, root)
        create_box(f"RCPC_Win_L_{lwi}_Frame_Top", (X_LEFT + 0.02, lwy, 1.15 + 1.65), (0.06, 3.70, 0.05), mat_aluminum_dark, root)
        create_box(f"RCPC_Win_L_{lwi}_Frame_Bot", (X_LEFT + 0.02, lwy, 1.15),          (0.06, 3.70, 0.05), mat_aluminum_dark, root)
        create_box(f"RCPC_Win_L_{lwi}_Hood", (X_LEFT + 0.22, lwy, 1.15 + 1.65 + 0.10), (0.45, 4.00, 0.08), mat_hood_concrete, root)

    # Rear Facade (+Y, 14.0 m wide at Y = +13.55): 2 large laboratory windows with hoods
    for rwi, rwx in enumerate([-3.50, 3.50]):
        rw_z = 1.15 + 1.65 / 2.0
        create_box(f"RCPC_Win_Rear_{rwi}_Glass", (rwx, Y_REAR + 0.01, rw_z), (4.20 - 0.08, 0.02, 1.55), mat_glass_tint, root)
        create_box(f"RCPC_Win_Rear_{rwi}_Frame_Top", (rwx, Y_REAR + 0.02, 1.15 + 1.65), (4.20, 0.06, 0.05), mat_aluminum_dark, root)
        create_box(f"RCPC_Win_Rear_{rwi}_Frame_Bot", (rwx, Y_REAR + 0.02, 1.15),          (4.20, 0.06, 0.05), mat_aluminum_dark, root)
        create_box(f"RCPC_Win_Rear_{rwi}_Hood", (rwx, Y_REAR + 0.22, 1.15 + 1.65 + 0.10), (4.50, 0.45, 0.08), mat_hood_concrete, root)

    # Rainwater Downspouts at Corners (Cream PVC)
    for dx, dy in [(X_RIGHT + 0.12, Y_FRONT + 0.12), (X_LEFT - 0.12, Y_FRONT + 0.12),
                   (X_RIGHT + 0.12, Y_REAR - 0.12),  (X_LEFT - 0.12, Y_REAR - 0.12)]:
        create_cylinder(f"RCPC_Downspout_{dx:.1f}_{dy:.1f}", (dx, dy, TOTAL_H / 2.0),
                        0.045, TOTAL_H, mat_downspout, segments=8, parent=root)

    # -----------------------------------------------------------------------
    # 7. Mesh Optimization & Consolidation (Budget: <= 300 KB)
    # -----------------------------------------------------------------------
    mat_map = {}
    mesh_children = [c for c in root.children if c.type == 'MESH']
    for c in mesh_children:
        m_name = c.data.materials[0].name if c.data.materials else "NoMat"
        if m_name not in mat_map:
            mat_map[m_name] = []
        mat_map[m_name].append(c)

    for m_name, objs in mat_map.items():
        if len(objs) > 1:
            bpy.ops.object.select_all(action='DESELECT')
            for o in objs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            bpy.ops.object.join()
            objs[0].name = f"RCPC_{m_name}_Merged"

    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\rcpc_building.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        use_selection=True,
        export_format='GLB',
        export_apply=True
    )

    size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"[OK] Successfully exported RCPC Building to {glb_out} ({size_kb:.1f} KB)")
    if size_kb <= 300.0:
        print(f"[PASS] Model size is strictly within the 300 KB budget!")
    else:
        print(f"[WARNING] Model size ({size_kb:.1f} KB) exceeds 300 KB budget!")

build_rcpc_building()
