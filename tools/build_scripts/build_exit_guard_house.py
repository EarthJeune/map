"""
build_exit_guard_house.py — Authentic 3D Bahay Kubo Guard Hut for DA-LARES Exit Guard House 1 & 2
Built strictly from reference photo IMG_3885.jpg:
- Authentic Filipino bamboo & nipa guard outpost (Bahay Kubo)
- Elevated bamboo floor on 6 sturdy concrete footing pads and bamboo stilt posts
- Front bamboo entrance step / stoop
- 4 heavy natural round bamboo corner posts + 2 intermediate doorway posts with node rings
- Half-wall railings with authentic diagonal herringbone / chevron bamboo weave slats
- Wide polished dark timber writing counter / inspection desk with logbook & penholder
- Built-in interior wooden L-bench seating along rear and right walls
- Multi-tiered steep thatched nipa / cogon grass roof with drooping eave fringes, 4 hip caps, and apex crown cap
- Deep weathered moss-green thatch finish matching IMG_3885.jpg
- Strictly the pure hut only (no outdoor props, no trees, no vehicles, no ground turf)
"""

import bpy
import bmesh
import math
import mathutils
import os

def create_mat(name, color, roughness=0.7, metallic=0.0):
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    node_out = nodes.new(type='ShaderNodeOutputMaterial')
    node_principled = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_principled.inputs['Base Color'].default_value = color if len(color) == 4 else (*color, 1.0)
    node_principled.inputs['Roughness'].default_value = roughness
    node_principled.inputs['Metallic'].default_value = metallic
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

def create_hipped_roof(name, loc, base_w, base_d, peak_w, peak_d, height, mat, parent=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    
    bm = bmesh.new()
    hw_b, hd_b = base_w / 2.0, base_d / 2.0
    hw_p, hd_p = peak_w / 2.0, peak_d / 2.0
    
    # 4 Base verts
    v0 = bm.verts.new((-hw_b, -hd_b, 0.0))
    v1 = bm.verts.new(( hw_b, -hd_b, 0.0))
    v2 = bm.verts.new(( hw_b,  hd_b, 0.0))
    v3 = bm.verts.new((-hw_b,  hd_b, 0.0))
    
    # 4 Peak verts
    v4 = bm.verts.new((-hw_p, -hd_p, height))
    v5 = bm.verts.new(( hw_p, -hd_p, height))
    v6 = bm.verts.new(( hw_p,  hd_p, height))
    v7 = bm.verts.new((-hw_p,  hd_p, height))
    
    # Faces
    bm.faces.new((v0, v3, v2, v1)) # Bottom cap
    bm.faces.new((v0, v1, v5, v4)) # Front slope (-Y)
    bm.faces.new((v1, v2, v6, v5)) # Right slope (+X)
    bm.faces.new((v2, v3, v7, v6)) # Rear slope (+Y)
    bm.faces.new((v3, v0, v4, v7)) # Left slope (-X)
    bm.faces.new((v4, v5, v6, v7)) # Top ridge cap
    
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = loc
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_exit_guard_house():
    # 1. Clean existing scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0: bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0: bpy.data.materials.remove(block)
        
    print("Building Refined Authentic Bahay Kubo Guard Hut for Exit Guard House...")
    
    # 2. Materials Setup
    # Golden honey bamboo poles
    mat_bamboo = create_mat("Mat_Bamboo", (0.75, 0.55, 0.32), roughness=0.58)
    # Darker aged bamboo / node rings / frame sills
    mat_bamboo_dark = create_mat("Mat_Bamboo_Dark", (0.44, 0.30, 0.16), roughness=0.72)
    # Bamboo slatted floor
    mat_floor = create_mat("Mat_Bamboo_Floor", (0.68, 0.53, 0.34), roughness=0.65)
    # Woven sawali / amakan wall panel backing
    mat_sawali = create_mat("Mat_Sawali", (0.78, 0.64, 0.44), roughness=0.80)
    # Polished dark timber counter / desk / bench
    mat_counter = create_mat("Mat_Timber_Counter", (0.34, 0.22, 0.12), roughness=0.48)
    # Weathered forest/moss green nipa/cogon grass thatch (from IMG_3885)
    mat_thatch = create_mat("Mat_Thatch_Roof", (0.16, 0.27, 0.19), roughness=0.92)
    # Thatch lower tier & fringe
    mat_thatch_fringe = create_mat("Mat_Thatch_Fringe", (0.14, 0.24, 0.17), roughness=0.95)
    # Thatch hip ridge cap & crown
    mat_thatch_ridge = create_mat("Mat_Thatch_Ridge", (0.11, 0.19, 0.13), roughness=0.96)
    # Weathered concrete stilt footing pads
    mat_concrete = create_mat("Mat_Concrete_Base", (0.55, 0.54, 0.51), roughness=0.90)

    root = bpy.data.objects.new("Exit_Guard_House_Hut", None)
    bpy.context.scene.collection.objects.link(root)

    # 3. Overall Dimensions:
    # Floor: 3.30m width (X), 2.70m depth (Y)
    # Floor height: Z = 0.42m
    hw = 1.65  # half-width
    hd = 1.35  # half-depth
    
    # 4. Corner Footings & Stilt Legs
    corners = [
        (-hw + 0.16, -hd + 0.16),
        ( hw - 0.16, -hd + 0.16),
        ( hw - 0.16,  hd - 0.16),
        (-hw + 0.16,  hd - 0.16),
    ]
    
    # Concrete footing pads on the ground
    for i, (cx, cy) in enumerate(corners):
        create_box(f"FootingPad_{i}", (cx, cy, 0.08), (0.34, 0.34, 0.16), mat_concrete, root)
        create_cylinder(f"StiltLeg_{i}", (cx, cy, 0.27), 0.09, 0.26, mat_bamboo_dark, segments=12, parent=root)
        
    # Intermediate front door footing pads & stilts
    door_hw = 0.48
    create_box("FootingPad_DoorL", (-door_hw, -hd + 0.16, 0.08), (0.26, 0.26, 0.16), mat_concrete, root)
    create_cylinder("StiltLeg_DoorL", (-door_hw, -hd + 0.16, 0.27), 0.08, 0.26, mat_bamboo_dark, segments=12, parent=root)
    create_box("FootingPad_DoorR", ( door_hw, -hd + 0.16, 0.08), (0.26, 0.26, 0.16), mat_concrete, root)
    create_cylinder("StiltLeg_DoorR", ( door_hw, -hd + 0.16, 0.27), 0.08, 0.26, mat_bamboo_dark, segments=12, parent=root)

    # 5. Under-floor Bamboo Support Sills
    create_box("FloorSill_Front", (0, -hd + 0.16, 0.38), (hw * 2, 0.15, 0.09), mat_bamboo_dark, root)
    create_box("FloorSill_Rear",  (0,  hd - 0.16, 0.38), (hw * 2, 0.15, 0.09), mat_bamboo_dark, root)
    create_box("FloorSill_Left",  (-hw + 0.16, 0, 0.38), (0.15, hd * 2, 0.09), mat_bamboo_dark, root)
    create_box("FloorSill_Right", ( hw - 0.16, 0, 0.38), (0.15, hd * 2, 0.09), mat_bamboo_dark, root)
    create_box("FloorSill_Mid",   (0, 0, 0.38), (hw * 2, 0.13, 0.09), mat_bamboo_dark, root)

    # 6. Slatted Bamboo Floor Deck ($Z = 0.42\text{ m}$)
    create_box("FloorRim_Front", (0, -hd - 0.02, 0.42), (hw * 2 + 0.08, 0.07, 0.08), mat_bamboo, root)
    create_box("FloorRim_Rear",  (0,  hd + 0.02, 0.42), (hw * 2 + 0.08, 0.07, 0.08), mat_bamboo, root)
    create_box("FloorRim_Left",  (-hw - 0.02, 0, 0.42), (0.07, hd * 2 + 0.08, 0.08), mat_bamboo, root)
    create_box("FloorRim_Right", ( hw + 0.02, 0, 0.42), (0.07, hd * 2 + 0.08, 0.08), mat_bamboo, root)
    
    create_box("FloorDeck_Base", (0, 0, 0.415), (hw * 2 - 0.04, hd * 2 - 0.04, 0.04), mat_floor, root)
    num_slats = 16
    slat_spacing = (hd * 2 - 0.10) / num_slats
    for s in range(num_slats):
        sy = -hd + 0.05 + s * slat_spacing + slat_spacing * 0.5
        create_box(f"FloorSlat_{s}", (0, sy, 0.438), (hw * 2 - 0.06, slat_spacing * 0.78, 0.012), mat_bamboo, root)

    # Attached front entrance step / stoop ($Z = 0.0$ to $0.21\text{ m}$)
    create_box("EntranceStep_Pad", (0, -hd - 0.28, 0.06), (1.10, 0.45, 0.12), mat_concrete, root)
    create_box("EntranceStep_Deck", (0, -hd - 0.28, 0.21), (1.00, 0.40, 0.06), mat_bamboo, root)

    # 7. Main Vertical Bamboo Corner Posts
    post_h = 2.03
    post_z = 0.42 + post_h / 2.0
    for i, (cx, cy) in enumerate(corners):
        create_cylinder(f"MainPost_{i}", (cx, cy, post_z), 0.09, post_h, mat_bamboo, segments=14, parent=root)
        for nz in [0.80, 1.30, 1.85, 2.30]:
            create_cylinder(f"PostNode_{i}_{nz}", (cx, cy, nz), 0.098, 0.028, mat_bamboo_dark, segments=14, parent=root)

    # 2 Front Intermediate Posts framing the doorway
    for sign_x, name in [(-1, "L"), (1, "R")]:
        px = sign_x * door_hw
        py = -hd + 0.16
        create_cylinder(f"DoorPost_{name}", (px, py, post_z), 0.08, post_h, mat_bamboo, segments=12, parent=root)
        for nz in [0.80, 1.30, 1.85, 2.30]:
            create_cylinder(f"DoorPostNode_{name}_{nz}", (px, py, nz), 0.086, 0.028, mat_bamboo_dark, segments=12, parent=root)

    # 8. Roof Eave Header Ring Beams ($Z = 2.43\text{ m}$)
    header_z = 2.43
    create_box("HeaderBeam_Front", (0, -hd + 0.16, header_z), (hw * 2 + 0.12, 0.15, 0.11), mat_bamboo_dark, root)
    create_box("HeaderBeam_Rear",  (0,  hd - 0.16, header_z), (hw * 2 + 0.12, 0.15, 0.11), mat_bamboo_dark, root)
    create_box("HeaderBeam_Left",  (-hw + 0.16, 0, header_z), (0.15, hd * 2 + 0.12, 0.11), mat_bamboo_dark, root)
    create_box("HeaderBeam_Right", ( hw - 0.16, 0, header_z), (0.15, hd * 2 + 0.12, 0.11), mat_bamboo_dark, root)
    
    # Internal cross tie beam & rafter collar
    create_box("CrossTie_Center", (0, 0, header_z + 0.06), (hw * 2 - 0.20, 0.11, 0.08), mat_bamboo, root)

    # 9. Lower Half-Walls / Railings ($Z = 0.42\text{ m}$ to $1.28\text{ m}$)
    rail_bottom_z = 0.49
    rail_mid_z = 0.88
    counter_top_z = 1.28
    panel_h = counter_top_z - rail_bottom_z

    def add_chevron_slats(panel_name, cx, cy, w, h, z_base, is_x_aligned=True):
        """Adds authentic vertical and diagonal bamboo slats on the panel."""
        num_slats = 8
        step = w / num_slats
        for d in range(num_slats):
            offset_pos = -w/2.0 + (d + 0.5) * step
            if is_x_aligned:
                create_box(f"{panel_name}_Slat_{d}", (cx + offset_pos, cy, z_base + h/2.0), (0.045, 0.045, h * 0.90), mat_bamboo, root)
            else:
                create_box(f"{panel_name}_Slat_{d}", (cx, cy + offset_pos, z_base + h/2.0), (0.045, 0.045, h * 0.90), mat_bamboo, root)

    # A. Rear Wall (continuous)
    rear_y = hd - 0.16
    create_box("RailBottom_Rear", (0, rear_y, rail_bottom_z), (hw * 2 - 0.32, 0.07, 0.06), mat_bamboo_dark, root)
    create_box("RailMid_Rear",    (0, rear_y, rail_mid_z),    (hw * 2 - 0.32, 0.06, 0.05), mat_bamboo_dark, root)
    create_box("Sawali_Rear",     (0, rear_y, rail_bottom_z + panel_h / 2.0), (hw * 2 - 0.32, 0.035, panel_h - 0.04), mat_sawali, root)
    add_chevron_slats("RearSawali", 0, rear_y, hw * 2 - 0.32, panel_h - 0.04, rail_bottom_z, is_x_aligned=True)
    create_box("Counter_Rear",    (0, rear_y, counter_top_z), (hw * 2 - 0.15, 0.24, 0.04), mat_counter, root)

    # B. Left Flank Wall (continuous)
    left_x = -hw + 0.16
    create_box("RailBottom_Left", (left_x, 0, rail_bottom_z), (0.07, hd * 2 - 0.32, 0.06), mat_bamboo_dark, root)
    create_box("RailMid_Left",    (left_x, 0, rail_mid_z),    (0.06, hd * 2 - 0.32, 0.05), mat_bamboo_dark, root)
    create_box("Sawali_Left",     (left_x, 0, rail_bottom_z + panel_h / 2.0), (0.035, hd * 2 - 0.32, panel_h - 0.04), mat_sawali, root)
    add_chevron_slats("LeftSawali", left_x, 0, hd * 2 - 0.32, panel_h - 0.04, rail_bottom_z, is_x_aligned=False)
    create_box("Counter_Left",    (left_x, 0, counter_top_z), (0.24, hd * 2 - 0.15, 0.04), mat_counter, root)

    # C. Right Flank Wall (duty guard's inspection window & wide counter)
    right_x = hw - 0.16
    create_box("RailBottom_Right", (right_x, 0, rail_bottom_z), (0.07, hd * 2 - 0.32, 0.06), mat_bamboo_dark, root)
    create_box("RailMid_Right",    (right_x, 0, rail_mid_z),    (0.06, hd * 2 - 0.32, 0.05), mat_bamboo_dark, root)
    create_box("Sawali_Right",     (right_x, 0, rail_bottom_z + panel_h / 2.0), (0.035, hd * 2 - 0.32, panel_h - 0.04), mat_sawali, root)
    add_chevron_slats("RightSawali", right_x, 0, hd * 2 - 0.32, panel_h - 0.04, rail_bottom_z, is_x_aligned=False)
    create_box("Counter_Right",    (right_x + 0.04, 0, counter_top_z), (0.30, hd * 2 - 0.15, 0.04), mat_counter, root)

    # D. Front Facade (centered entrance opening)
    front_y = -hd + 0.16
    # Front-Left section
    fl_w = (-door_hw) - (-hw + 0.16)
    fl_cx = (-hw + 0.16) + fl_w / 2.0
    create_box("RailBottom_FrontL", (fl_cx, front_y, rail_bottom_z), (fl_w, 0.07, 0.06), mat_bamboo_dark, root)
    create_box("RailMid_FrontL",    (fl_cx, front_y, rail_mid_z),    (fl_w, 0.06, 0.05), mat_bamboo_dark, root)
    create_box("Sawali_FrontL",     (fl_cx, front_y, rail_bottom_z + panel_h / 2.0), (fl_w - 0.02, 0.035, panel_h - 0.04), mat_sawali, root)
    add_chevron_slats("FrontLSawali", fl_cx, front_y, fl_w - 0.02, panel_h - 0.04, rail_bottom_z, is_x_aligned=True)
    create_box("Counter_FrontL",    (fl_cx, front_y, counter_top_z), (fl_w + 0.04, 0.24, 0.04), mat_counter, root)

    # Front-Right section (with the diagonal slats clearly visible in IMG_3885)
    fr_w = (hw - 0.16) - door_hw
    fr_cx = door_hw + fr_w / 2.0
    create_box("RailBottom_FrontR", (fr_cx, front_y, rail_bottom_z), (fr_w, 0.07, 0.06), mat_bamboo_dark, root)
    create_box("RailMid_FrontR",    (fr_cx, front_y, rail_mid_z),    (fr_w, 0.06, 0.05), mat_bamboo_dark, root)
    create_box("Sawali_FrontR",     (fr_cx, front_y, rail_bottom_z + panel_h / 2.0), (fr_w - 0.02, 0.035, panel_h - 0.04), mat_sawali, root)
    add_chevron_slats("FrontRSawali", fr_cx, front_y, fr_w - 0.02, panel_h - 0.04, rail_bottom_z, is_x_aligned=True)
    create_box("Counter_FrontR",    (fr_cx, front_y, counter_top_z), (fr_w + 0.04, 0.24, 0.04), mat_counter, root)

    # Doorway low threshold sill
    create_box("DoorThreshold_Sill", (0, front_y, 0.46), (door_hw * 2, 0.11, 0.07), mat_bamboo, root)

    # 10. Built-in Interior Amenities
    # Rear bench seating
    create_box("Bench_Rear", (0, hd - 0.40, 0.80), (hw * 2 - 0.40, 0.40, 0.04), mat_counter, root)
    create_box("BenchLeg_RL", (-hw + 0.45, hd - 0.40, 0.60), (0.07, 0.34, 0.38), mat_bamboo_dark, root)
    create_box("BenchLeg_RR", ( hw - 0.45, hd - 0.40, 0.60), (0.07, 0.34, 0.38), mat_bamboo_dark, root)
    
    # Right-hand bench seating
    create_box("Bench_Right", (hw - 0.40, 0, 0.80), (0.38, hd * 2 - 0.84, 0.04), mat_counter, root)
    
    # Duty logbook and penholder on right counter (IMG_3885)
    create_box("DutyLogbook", (hw - 0.14, -0.20, counter_top_z + 0.025), (0.24, 0.18, 0.02), mat_concrete, root)
    create_box("DutyPenHolder", (hw - 0.14, 0.10, counter_top_z + 0.04), (0.07, 0.07, 0.07), mat_bamboo_dark, root)

    # 11. Multi-Tiered Steep Thatched Nipa / Cogon Grass Pavilion Roof
    # Replicating the steep, organic weathered-green thatch roof from IMG_3885:
    roof_base_w = 4.10
    roof_base_d = 3.50
    roof_peak_w = 0.50
    roof_peak_d = 0.20
    roof_eave_z = 2.20
    roof_apex_z = 3.85
    roof_h = roof_apex_z - roof_eave_z  # 1.65m steep rise

    # Main solid hipped thatch volume
    create_hipped_roof("ThatchRoof_Main", (0, 0, roof_eave_z), roof_base_w, roof_base_d, roof_peak_w, roof_peak_d, roof_h, mat_thatch, root)

    # Secondary lower thatch tier / overhang skirt (gives organic depth to thatch)
    tier2_w = roof_base_w + 0.14
    tier2_d = roof_base_d + 0.14
    tier2_h = 0.45
    tier2_z = roof_eave_z - 0.15
    create_hipped_roof("ThatchRoof_Tier2", (0, 0, tier2_z), tier2_w, tier2_d, roof_base_w * 0.75, roof_base_d * 0.75, tier2_h, mat_thatch_fringe, root)

    # Drooping thatch eave fringes all around
    fringe_h = 0.24
    fringe_z = tier2_z - fringe_h + 0.06
    create_box("ThatchFringe_Front", (0, -tier2_d / 2.0 - 0.02, fringe_z + fringe_h / 2.0), (tier2_w + 0.08, 0.09, fringe_h), mat_thatch_fringe, root)
    create_box("ThatchFringe_Rear",  (0,  tier2_d / 2.0 + 0.02, fringe_z + fringe_h / 2.0), (tier2_w + 0.08, 0.09, fringe_h), mat_thatch_fringe, root)
    create_box("ThatchFringe_Left",  (-tier2_w / 2.0 - 0.02, 0, fringe_z + fringe_h / 2.0), (0.09, tier2_d + 0.08, fringe_h), mat_thatch_fringe, root)
    create_box("ThatchFringe_Right", ( tier2_w / 2.0 + 0.02, 0, fringe_z + fringe_h / 2.0), (0.09, tier2_d + 0.08, fringe_h), mat_thatch_fringe, root)

    # 4 Thatched Hip Ridge Runners using mathutils to_track_quat for exact alignment
    hip_endpoints = [
        (mathutils.Vector((-roof_base_w / 2.0, -roof_base_d / 2.0, roof_eave_z)), mathutils.Vector((-roof_peak_w / 2.0, -roof_peak_d / 2.0, roof_apex_z))),
        (mathutils.Vector(( roof_base_w / 2.0, -roof_base_d / 2.0, roof_eave_z)), mathutils.Vector(( roof_peak_w / 2.0, -roof_peak_d / 2.0, roof_apex_z))),
        (mathutils.Vector(( roof_base_w / 2.0,  roof_base_d / 2.0, roof_eave_z)), mathutils.Vector(( roof_peak_w / 2.0,  roof_peak_d / 2.0, roof_apex_z))),
        (mathutils.Vector((-roof_base_w / 2.0,  roof_base_d / 2.0, roof_eave_z)), mathutils.Vector((-roof_peak_w / 2.0,  roof_peak_d / 2.0, roof_apex_z))),
    ]
    for i, (p1, p2) in enumerate(hip_endpoints):
        mid = (p1 + p2) * 0.5
        v = p2 - p1
        length = v.length
        rot_euler = v.to_track_quat('Z', 'Y').to_euler()
        create_cylinder(f"ThatchHipCap_{i}", (mid.x, mid.y, mid.z), 0.085, length, mat_thatch_ridge, segments=8, rot=rot_euler, parent=root)

    # Apex Thatch Crown Cap & Binding
    create_box("ThatchRidge_Cap", (0, 0, roof_apex_z + 0.06), (roof_peak_w + 0.24, roof_peak_d + 0.18, 0.14), mat_thatch_ridge, root)
    create_cylinder("ThatchPeak_Crown", (0, 0, roof_apex_z + 0.18), 0.14, 0.18, mat_thatch, segments=12, parent=root)

    # 12. Batch & Combine Meshes by Material for Optimal WebGL Draw Calls
    print("Batching meshes by material...")
    bpy.ops.object.select_all(action='DESELECT')
    
    mesh_objs = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    mat_groups = {}
    for obj in mesh_objs:
        m_name = obj.data.materials[0].name if obj.data.materials else "Mat_Default"
        if m_name not in mat_groups:
            mat_groups[m_name] = []
        mat_groups[m_name].append(obj)
        
    batched_objs = []
    for m_name, objs in mat_groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        joined = bpy.context.active_object
        joined.name = f"Hut_Batch_{m_name}"
        joined.parent = root
        batched_objs.append(joined)

    # 13. Export GLB
    out_dir = r"c:\Users\LGU-SanPedro\Downloads\map\models"
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "exit_guard_house_1.glb")
    
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for b in batched_objs:
        b.select_set(True)
    bpy.context.view_layer.objects.active = root
    
    bpy.ops.export_scene.gltf(
        filepath=out_file,
        use_selection=True,
        export_format='GLB',
        export_apply=True,
        export_yup=True
    )
    
    size_kb = os.path.getsize(out_file) / 1024.0
    print(f"✅ Successfully exported Exit Guard House 1 GLB to: {out_file} ({size_kb:.1f} KB)")
    return out_file

build_exit_guard_house()
