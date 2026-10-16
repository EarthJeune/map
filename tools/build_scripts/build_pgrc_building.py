"""
build_pgrc_building.py — Authentic Bespoke 3D Model of the DA-LARES PGRC Building
(Plant Genetic Resources Center)

Authentic ground-truth architectural model built directly from field photos (IMG_3795 & IMG_3796):
1. IMG_3796 (Front Elevation):
   - Full-width cantilevered front porch portico canopy with warm ochre/cream fascia band (#ded4af)
   - Raised mint/sage green signboard banner with chrome 3D relief text:
     "PLANT GENETIC"
     "RESOURCES CENTER"
     flanked by official Department of Agriculture seal on left and agency emblem on right
   - Symmetrical ground floor facade with signature sage-green walls (#558f6b):
     * Center double commercial glass entrance doors with white outer trim, dark sash, and silver handles
     * Official stainless steel dedication plaque mounted to the right of the doors
     * Left bay: 3 vertical picture windows with white outer trim and dark inner frames
     * Right bay: 3 vertical picture windows with white outer trim and dark inner frames
   - Polished light-grey tiled porch floor with 3-tier concrete entry steps
   - Approach access walkway ramp on the left with dual stainless steel tubular safety handrails
   - Upper level clerestory with 3 horizontal dark ribbon louvered vents
   - Wide overhanging sage-green metal roof with white soffits
2. IMG_3795 (Side Elevation & Sloped Roofline):
   - Mono-pitch / shed roofline sloping continuously from front peak to rear eaves
   - Continuous unified building walls matching the roof slope (ZERO gaps, ZERO hollow slots)
   - Roof cleanly caps the building (ZERO excess protruding boxes)
   - Left elevation vertical windows with white outer trim
   - Wall-mounted split AC condenser unit with mounting brackets, fan grille, and refrigerant conduit
   - Pure architecture: Strictly ZERO outside props
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

def create_cylinder(name, loc, radius, height, mat, segments=16, rot=(0,0,0), parent=None):
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

def create_text_mesh(name, loc, text, size, mat, rot=(0,0,0), parent=None):
    c_data = bpy.data.curves.new(name=name + "_Data", type='FONT')
    c_data.body = text
    c_data.size = size
    c_data.extrude = 0.02
    c_data.resolution_u = 2
    c_data.align_x = 'CENTER'
    c_data.align_y = 'CENTER'
    obj = bpy.data.objects.new(name, c_data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    return obj

def create_sloped_body(name, width, depth, z_bot, z_front, z_rear, mat, parent=None):
    """Creates a seamless single-piece solid wedge building body with sloped roofline."""
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    
    bm = bmesh.new()
    hw = width / 2.0
    hd = depth / 2.0
    
    # 8 vertices: bottom 4 at z_bot, top 4 following the shed slope
    v0 = bm.verts.new((-hw, -hd, z_bot))
    v1 = bm.verts.new(( hw, -hd, z_bot))
    v2 = bm.verts.new(( hw,  hd, z_bot))
    v3 = bm.verts.new((-hw,  hd, z_bot))
    
    v4 = bm.verts.new((-hw, -hd, z_front))
    v5 = bm.verts.new(( hw, -hd, z_front))
    v6 = bm.verts.new(( hw,  hd, z_rear))
    v7 = bm.verts.new((-hw,  hd, z_rear))
    
    # 6 Faces with correct outward normals
    bm.faces.new((v0, v1, v5, v4)) # Front
    bm.faces.new((v1, v2, v6, v5)) # Right
    bm.faces.new((v2, v3, v7, v6)) # Rear
    bm.faces.new((v3, v0, v4, v7)) # Left
    bm.faces.new((v4, v5, v6, v7)) # Top (sloped roofline)
    bm.faces.new((v3, v2, v1, v0)) # Bottom
    
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = (0, 0, 0)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_sloped_roof(name, width, y_front, y_rear, z_front_soffit, z_rear_soffit, thickness, mat, parent=None):
    """Creates a mono-pitch sloped roof slab resting perfectly flush on top of walls."""
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    
    bm = bmesh.new()
    hw = width / 2.0
    
    # 8 vertices: 4 on soffit (bottom), 4 on top roof deck
    v0 = bm.verts.new((-hw, y_front, z_front_soffit))
    v1 = bm.verts.new(( hw, y_front, z_front_soffit))
    v2 = bm.verts.new(( hw, y_rear,  z_rear_soffit))
    v3 = bm.verts.new((-hw, y_rear,  z_rear_soffit))
    
    v4 = bm.verts.new((-hw, y_front, z_front_soffit + thickness))
    v5 = bm.verts.new(( hw, y_front, z_front_soffit + thickness))
    v6 = bm.verts.new(( hw, y_rear,  z_rear_soffit + thickness))
    v7 = bm.verts.new((-hw, y_rear,  z_rear_soffit + thickness))
    
    bm.faces.new((v0, v1, v5, v4)) # Front fascia
    bm.faces.new((v1, v2, v6, v5)) # Right fascia
    bm.faces.new((v2, v3, v7, v6)) # Rear fascia
    bm.faces.new((v3, v0, v4, v7)) # Left fascia
    bm.faces.new((v4, v5, v6, v7)) # Top metal deck
    bm.faces.new((v3, v2, v1, v0)) # Bottom soffit
    
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = (0, 0, 0)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_pgrc_building():
    print("=====================================================================")
    print(" Building Pure Architecture PGRC Building (Seamless Gapless Model)  ")
    print("=====================================================================")
    
    # 1. Clean ALL previous objects from the scene to prevent cross-building overlap
    for obj in list(bpy.data.objects):
        if obj.type in ['MESH', 'CURVE', 'LIGHT', 'EMPTY']:
            bpy.data.objects.remove(obj, do_unlink=True)
            
    root = bpy.data.objects.new("PGRC_Root", None)
    bpy.context.scene.collection.objects.link(root)
    root.location = (0, 0, 0)
    
    # 2. Materials calibrated directly from field photos (IMG_3795 & IMG_3796)
    mat_wall_green = create_mat("Mat_PGRC_WallGreen", (0.33, 0.56, 0.42), roughness=0.85) # DA mint/sage green (#558f6b)
    mat_wall_trim  = create_mat("Mat_PGRC_WallTrim",  (0.88, 0.84, 0.73), roughness=0.75) # Warm cream/ochre frieze band
    mat_trim_white = create_mat("Mat_PGRC_TrimWhite", (0.92, 0.93, 0.91), roughness=0.55) # Clean white window & door surround
    mat_plinth     = create_mat("Mat_PGRC_Plinth",    (0.68, 0.70, 0.67), roughness=0.88) # Foundation concrete plinth
    mat_floor_tile = create_mat("Mat_PGRC_FloorTile", (0.75, 0.78, 0.76), roughness=0.30, specular=0.85) # Polished grey ceramic tiles
    
    # Porch Canopy
    mat_canopy_fascia = create_mat("Mat_PGRC_CanopyFascia", (0.87, 0.83, 0.69), roughness=0.78) # Cream/ochre fascia (#ded4af)
    mat_canopy_soffit = create_mat("Mat_PGRC_CanopySoffit", (0.88, 0.89, 0.87), roughness=0.75)
    mat_canopy_col    = create_mat("Mat_PGRC_CanopyCol",    (0.88, 0.90, 0.88), roughness=0.45, metallic=0.35)
    
    # Signboard Banner & 3D Typography
    mat_sign_bg      = create_mat("Mat_PGRC_SignBG",      (0.32, 0.58, 0.44), roughness=0.60) # Mint/sage green sign field
    mat_sign_text    = create_mat("Mat_PGRC_SignText",    (0.96, 0.97, 0.95), roughness=0.20, metallic=0.75, specular=1.0) # Chrome/silver 3D letters
    mat_da_gold      = create_mat("Mat_PGRC_DAGold",      (0.86, 0.70, 0.20), roughness=0.30, metallic=0.60)
    mat_da_green     = create_mat("Mat_PGRC_DAGreen",     (0.08, 0.38, 0.16), roughness=0.45)
    mat_da_white     = create_mat("Mat_PGRC_DAWhite",     (0.95, 0.95, 0.93), roughness=0.30)
    mat_plaque_metal = create_mat("Mat_PGRC_PlaqueMetal", (0.80, 0.82, 0.83), roughness=0.25, metallic=0.85) # Dedication plaque
    
    # Windows & Doors
    mat_glass_tint = create_mat("Mat_PGRC_GlassTint", (0.07, 0.12, 0.14), roughness=0.03, metallic=0.70, specular=1.0, alpha=0.60)
    mat_frame_dark = create_mat("Mat_PGRC_DarkFrame", (0.10, 0.10, 0.11), roughness=0.40, metallic=0.85)
    mat_spandrel   = create_mat("Mat_PGRC_Spandrel",  (0.86, 0.83, 0.74), roughness=0.75)
    mat_louver     = create_mat("Mat_PGRC_Louver",    (0.11, 0.12, 0.13), roughness=0.65, metallic=0.60)
    
    # Handrail & Hardware
    mat_handrail   = create_mat("Mat_PGRC_Handrail",  (0.80, 0.82, 0.84), roughness=0.18, metallic=0.95)
    mat_ac_metal   = create_mat("Mat_PGRC_ACMetal",   (0.74, 0.75, 0.73), roughness=0.45, metallic=0.40)
    
    # Metal Sloped Roof
    mat_roof_metal  = create_mat("Mat_PGRC_RoofMetal",  (0.26, 0.42, 0.33), roughness=0.65, metallic=0.25) # Sage-green corrugated roof
    mat_roof_fascia = create_mat("Mat_PGRC_RoofFascia", (0.18, 0.30, 0.23), roughness=0.70)
    mat_roof_soffit = create_mat("Mat_PGRC_RoofSoffit", (0.84, 0.85, 0.83), roughness=0.80)
    
    # 3. Footprint Dimensions (Calibrated to roads.json polygon)
    TOTAL_W = 14.40  # East-West width
    TOTAL_D = 12.20  # North-South depth
    PLINTH_H = 0.35  # Ground foundation level
    
    front_y = -TOTAL_D / 2.0  # -6.10m (facing South toward entrance_19)
    rear_y  =  TOTAL_D / 2.0  # +6.10m
    
    # 4. Foundation Plinth Slab
    create_box("PGRC_Plinth_Base", (0, 0, PLINTH_H / 2.0), (TOTAL_W + 0.16, TOTAL_D + 0.16, PLINTH_H), mat_plinth, root)
    create_box("PGRC_Belt_Trim", (0, 0, PLINTH_H + 0.04), (TOTAL_W + 0.06, TOTAL_D + 0.06, 0.08), mat_wall_trim, root)
    
    # 5. Seamless Unified Sloped Building Walls (GAPLESS SINGLE PIECE)
    # Front wall top matches roofline peak: Z = 5.50m
    # Rear wall top matches roofline eave: Z = 3.80m
    # Left and right side walls slope linearly from front to rear (IMG_3795)
    Z_FRONT_WALL = 5.50
    Z_REAR_WALL  = 3.80
    create_sloped_body("PGRC_Main_Walls", TOTAL_W, TOTAL_D, PLINTH_H, Z_FRONT_WALL, Z_REAR_WALL, mat_wall_green, root)
    
    # Warm cream band wrapping across the front facade above canopy level
    canopy_bot_z = PLINTH_H + 2.85 # 3.20m
    canopy_h = 0.75
    canopy_mid_z = canopy_bot_z + canopy_h / 2.0 # 3.575m
    create_box("PGRC_Frieze_Band", (0, front_y - 0.02, canopy_bot_z + canopy_h + 0.15), (TOTAL_W + 0.04, 0.05, 0.30), mat_wall_trim, root)
    
    # 6. Symmetrical Front Facade Openings (Ground Floor under portico, IMG_3796)
    # A. CENTER DOUBLE ENTRANCE DOORS
    door_w, door_h = 2.15, 2.30
    door_mid_z = PLINTH_H + door_h / 2.0
    door_y = front_y - 0.02
    
    # Clean white outer perimeter frame (IMG_3796)
    create_box("PGRC_Door_WhiteTrim", (0, door_y, door_mid_z), (door_w + 0.22, 0.04, door_h + 0.14), mat_trim_white, root)
    # Dark aluminum door casing
    create_box("PGRC_Door_Frame_Top", (0, door_y - 0.02, PLINTH_H + door_h), (door_w + 0.04, 0.08, 0.08), mat_frame_dark, root)
    create_box("PGRC_Door_Jamb_L", (-door_w / 2.0, door_y - 0.02, door_mid_z), (0.08, 0.08, door_h), mat_frame_dark, root)
    create_box("PGRC_Door_Jamb_R", ( door_w / 2.0, door_y - 0.02, door_mid_z), (0.08, 0.08, door_h), mat_frame_dark, root)
    create_box("PGRC_Door_Post", (0, door_y - 0.02, door_mid_z), (0.05, 0.08, door_h), mat_frame_dark, root)
    
    door_pane_w = (door_w - 0.14) / 2.0
    create_box("PGRC_Door_Glass_L", (-door_w / 4.0, door_y - 0.03, door_mid_z), (door_pane_w, 0.02, door_h - 0.12), mat_glass_tint, root)
    create_box("PGRC_Door_Glass_R", ( door_w / 4.0, door_y - 0.03, door_mid_z), (door_pane_w, 0.02, door_h - 0.12), mat_glass_tint, root)
    create_box("PGRC_Door_Kick_L", (-door_w / 4.0, door_y - 0.04, PLINTH_H + 0.14), (door_pane_w, 0.03, 0.24), mat_frame_dark, root)
    create_box("PGRC_Door_Kick_R", ( door_w / 4.0, door_y - 0.04, PLINTH_H + 0.14), (door_pane_w, 0.03, 0.24), mat_frame_dark, root)
    create_box("PGRC_Door_Handle_L", (-0.12, door_y - 0.06, PLINTH_H + 1.05), (0.03, 0.05, 0.35), mat_handrail, root)
    create_box("PGRC_Door_Handle_R", ( 0.12, door_y - 0.06, PLINTH_H + 1.05), (0.03, 0.05, 0.35), mat_handrail, root)
    
    # Official Stainless Steel Dedication Plaque mounted to right of entrance doors (IMG_3796)
    create_box("PGRC_Dedication_Plaque", (1.50, door_y - 0.03, PLINTH_H + 1.48), (0.42, 0.025, 0.55), mat_plaque_metal, root)
    
    # B. LEFT & RIGHT VERTICAL WINDOW BAYS (3 on Left, 3 on Right)
    win_w = 1.15
    win_h = 2.05
    win_z0 = PLINTH_H + 0.45
    win_mid_z = win_z0 + win_h / 2.0
    spandrel_h = 0.65
    glass_h = win_h - spandrel_h
    glass_mid_z = win_z0 + spandrel_h + glass_h / 2.0
    spandrel_mid_z = win_z0 + spandrel_h / 2.0
    
    win_xs = [-5.85, -4.10, -2.35, 2.35, 4.10, 5.85]
    for w_idx, wx in enumerate(win_xs):
        pfx = f"PGRC_Win_{w_idx}"
        create_box(f"{pfx}_WhiteTrim", (wx, front_y - 0.015, win_mid_z), (win_w + 0.16, 0.03, win_h + 0.16), mat_trim_white, root)
        create_box(f"{pfx}_Frame_Top", (wx, front_y - 0.035, win_z0 + win_h), (win_w + 0.04, 0.05, 0.05), mat_frame_dark, root)
        create_box(f"{pfx}_Frame_Bot", (wx, front_y - 0.035, win_z0), (win_w + 0.04, 0.05, 0.05), mat_frame_dark, root)
        create_box(f"{pfx}_Frame_L", (wx - win_w / 2.0, front_y - 0.035, win_mid_z), (0.05, 0.05, win_h), mat_frame_dark, root)
        create_box(f"{pfx}_Frame_R", (wx + win_w / 2.0, front_y - 0.035, win_mid_z), (0.05, 0.05, win_h), mat_frame_dark, root)
        create_box(f"{pfx}_Mullion", (wx, front_y - 0.035, win_z0 + spandrel_h), (win_w, 0.04, 0.04), mat_frame_dark, root)
        create_box(f"{pfx}_Spandrel", (wx, front_y - 0.025, spandrel_mid_z), (win_w - 0.04, 0.02, spandrel_h - 0.04), mat_spandrel, root)
        create_box(f"{pfx}_Glass", (wx, front_y - 0.02, glass_mid_z), (win_w - 0.04, 0.015, glass_h - 0.04), mat_glass_tint, root)
        
    # 7. Cantilevered Porch Portico Canopy (IMG_3796)
    PORTICO_D = 2.80
    portico_y_mid = front_y - PORTICO_D / 2.0
    portico_front_y = front_y - PORTICO_D
    
    # Elevated tiled porch floor slab
    create_box("PGRC_Porch_Floor", (0, portico_y_mid, PLINTH_H / 2.0), (TOTAL_W + 0.08, PORTICO_D, PLINTH_H), mat_floor_tile, root)
    create_box("PGRC_Porch_Curb", (0, portico_front_y - 0.04, PLINTH_H / 2.0), (TOTAL_W + 0.16, 0.08, PLINTH_H), mat_plinth, root)
    
    # 3-tier concrete entry steps centered at front
    step_w = 3.20
    create_box("PGRC_Step_1", (0, portico_front_y - 0.65, 0.11 / 2.0), (step_w + 0.40, 0.45, 0.11), mat_plinth, root)
    create_box("PGRC_Step_2", (0, portico_front_y - 0.38, 0.11 + 0.11 / 2.0), (step_w + 0.20, 0.35, 0.11), mat_plinth, root)
    create_box("PGRC_Step_3", (0, portico_front_y - 0.15, 0.22 + 0.11 / 2.0), (step_w, 0.30, 0.11), mat_plinth, root)
    
    # Concrete Approach Ramp on Left Side with stainless steel handrails
    ramp_x = -TOTAL_W / 2.0 - 0.60
    ramp_w = 1.30
    ramp_d = 4.20
    ramp_y = portico_front_y + ramp_d / 2.0
    create_box("PGRC_Ramp_Slab", (ramp_x, ramp_y, PLINTH_H / 2.0), (ramp_w, ramp_d, PLINTH_H), mat_plinth, root)
    
    rail_posts_y = [ramp_y - ramp_d / 2.0 + 0.2, ramp_y, ramp_y + ramp_d / 2.0 - 0.2]
    for r_idx, rpy in enumerate(rail_posts_y):
        create_cylinder(f"PGRC_Rail_Post_L_{r_idx}", (ramp_x - ramp_w / 2.0 + 0.05, rpy, PLINTH_H + 0.85 / 2.0), 0.025, 0.85, mat_handrail, 12, parent=root)
        create_cylinder(f"PGRC_Rail_Post_R_{r_idx}", (ramp_x + ramp_w / 2.0 - 0.05, rpy, PLINTH_H + 0.85 / 2.0), 0.025, 0.85, mat_handrail, 12, parent=root)
    create_box("PGRC_Rail_Top_L", (ramp_x - ramp_w / 2.0 + 0.05, ramp_y, PLINTH_H + 0.85), (0.04, ramp_d - 0.2, 0.04), mat_handrail, root)
    create_box("PGRC_Rail_Mid_L", (ramp_x - ramp_w / 2.0 + 0.05, ramp_y, PLINTH_H + 0.45), (0.03, ramp_d - 0.2, 0.03), mat_handrail, root)
    
    # Tubular white columns supporting canopy near front corners
    col_xs = [-6.70, 6.70]
    for c_idx, cx in enumerate(col_xs):
        create_cylinder(f"PGRC_Canopy_Col_{c_idx}", (cx, portico_front_y + 0.25, PLINTH_H + (2.85) / 2.0), 0.09, 2.85, mat_canopy_col, 16, parent=root)
        
    create_box("PGRC_Canopy_Soffit", (0, portico_y_mid, canopy_bot_z - 0.02), (TOTAL_W + 0.40, PORTICO_D + 0.20, 0.04), mat_canopy_soffit, root)
    create_box("PGRC_Canopy_Fascia_Front", (0, portico_front_y - 0.06, canopy_mid_z), (TOTAL_W + 0.60, 0.12, canopy_h), mat_canopy_fascia, root)
    create_box("PGRC_Canopy_Fascia_Left",  (-TOTAL_W / 2.0 - 0.24, portico_y_mid, canopy_mid_z), (0.12, PORTICO_D + 0.20, canopy_h), mat_canopy_fascia, root)
    create_box("PGRC_Canopy_Fascia_Right", ( TOTAL_W / 2.0 + 0.24, portico_y_mid, canopy_mid_z), (0.12, PORTICO_D + 0.20, canopy_h), mat_canopy_fascia, root)
    create_box("PGRC_Canopy_Top_Deck", (0, portico_y_mid, canopy_bot_z + canopy_h + 0.02), (TOTAL_W + 0.48, PORTICO_D + 0.16, 0.04), mat_plinth, root)
    
    # Raised Sage-Green Signboard Banner Centered on Portico Fascia (IMG_3796)
    sign_w, sign_h = 7.40, 0.58
    sign_y = portico_front_y - 0.13
    sign_z = canopy_mid_z
    create_box("PGRC_Sign_Banner", (0, sign_y, sign_z), (sign_w, 0.04, sign_h), mat_sign_bg, root)
    create_box("PGRC_Sign_Border_Top", (0, sign_y - 0.015, sign_z + sign_h / 2.0), (sign_w + 0.04, 0.02, 0.03), mat_trim_white, root)
    create_box("PGRC_Sign_Border_Bot", (0, sign_y - 0.015, sign_z - sign_h / 2.0), (sign_w + 0.04, 0.02, 0.03), mat_trim_white, root)
    
    # 3D Chrome Text on Banner:
    # "PLANT GENETIC"
    # "RESOURCES CENTER"
    create_text_mesh("PGRC_Text_L1", (0, sign_y - 0.035, sign_z + 0.13), "PLANT GENETIC", 0.25, mat_sign_text, rot=(math.radians(90), 0, 0), parent=root)
    create_text_mesh("PGRC_Text_L2", (0, sign_y - 0.035, sign_z - 0.13), "RESOURCES CENTER", 0.25, mat_sign_text, rot=(math.radians(90), 0, 0), parent=root)
    
    # Official Agency Seals Flanking Signboard (IMG_3796 / pgrc_sign_crop)
    seal_r = 0.22
    seal_xs = [-sign_w / 2.0 + 0.44, sign_w / 2.0 - 0.44]
    for s_idx, sx in enumerate(seal_xs):
        create_cylinder(f"PGRC_Seal_Base_{s_idx}", (sx, sign_y - 0.03, sign_z), seal_r, 0.03, mat_da_white, 20, rot=(math.radians(90), 0, 0), parent=root)
        create_cylinder(f"PGRC_Seal_Ring_{s_idx}", (sx, sign_y - 0.045, sign_z), seal_r * 0.90, 0.02, mat_da_green, 20, rot=(math.radians(90), 0, 0), parent=root)
        create_cylinder(f"PGRC_Seal_Inner_{s_idx}", (sx, sign_y - 0.055, sign_z), seal_r * 0.70, 0.02, mat_da_gold if s_idx == 1 else mat_da_white, 16, rot=(math.radians(90), 0, 0), parent=root)
        create_box(f"PGRC_Seal_Core_{s_idx}", (sx, sign_y - 0.065, sign_z), (seal_r * 1.0, 0.01, seal_r * 1.0), mat_da_green, root)
        
    # 8. Front Upper Clerestory Louvered Ribbon Vents (Integrated on seamless front wall, IMG_3796)
    ribbon_w = 3.20
    ribbon_h = 0.65
    ribbon_z = 4.60
    ribbon_xs = [-4.30, 0.0, 4.30]
    for rb_idx, rbx in enumerate(ribbon_xs):
        r_name = f"PGRC_Clerestory_{rb_idx}"
        create_box(f"{r_name}_Frame_Top", (rbx, front_y - 0.04, ribbon_z + ribbon_h / 2.0), (ribbon_w + 0.06, 0.06, 0.06), mat_frame_dark, root)
        create_box(f"{r_name}_Frame_Bot", (rbx, front_y - 0.04, ribbon_z - ribbon_h / 2.0), (ribbon_w + 0.06, 0.06, 0.06), mat_frame_dark, root)
        create_box(f"{r_name}_Frame_L", (rbx - ribbon_w / 2.0, front_y - 0.04, ribbon_z), (0.06, 0.06, ribbon_h), mat_frame_dark, root)
        create_box(f"{r_name}_Frame_R", (rbx + ribbon_w / 2.0, front_y - 0.04, ribbon_z), (0.06, 0.06, ribbon_h), mat_frame_dark, root)
        louver_count = 5
        l_spacing = ribbon_h / (louver_count + 1)
        for li in range(louver_count):
            lz = ribbon_z - ribbon_h / 2.0 + (li + 1) * l_spacing
            create_box(f"{r_name}_Slat_{li}", (rbx, front_y - 0.03, lz), (ribbon_w - 0.04, 0.04, 0.035), mat_louver, root)
            
    # 9. Authentic Sloped Metal Shed/Mono-Pitch Roof (IMG_3795)
    # Rests flush on the top of the walls with 0.9m eaves, ZERO excess protruding geometry
    OVERHANG_SIDE  = 0.90
    OVERHANG_FRONT = 1.00
    OVERHANG_REAR  = 0.90
    
    roof_w = TOTAL_W + 2 * OVERHANG_SIDE
    roof_y_front = front_y - OVERHANG_FRONT
    roof_y_rear  = rear_y + OVERHANG_REAR
    
    # Calculate exact soffit z along the wall slope
    # Slope m = (Z_REAR_WALL - Z_FRONT_WALL) / TOTAL_D = (3.80 - 5.50) / 12.20 = -0.13934426
    m_slope = (Z_REAR_WALL - Z_FRONT_WALL) / TOTAL_D
    z_front_soffit = Z_FRONT_WALL + m_slope * (roof_y_front - front_y) # 5.50 + (-0.13934) * (-1.00) = 5.64m
    z_rear_soffit  = Z_FRONT_WALL + m_slope * (roof_y_rear - front_y)  # 5.50 + (-0.13934) * (13.10) = 3.67m
    roof_thickness = 0.18
    
    # Roof Soffit & Main Metal Deck
    create_sloped_roof("PGRC_Roof_Soffit", roof_w, roof_y_front, roof_y_rear, z_front_soffit - 0.03, z_rear_soffit - 0.03, 0.04, mat_roof_soffit, root)
    create_sloped_roof("PGRC_Roof_Metal", roof_w, roof_y_front, roof_y_rear, z_front_soffit, z_rear_soffit, roof_thickness, mat_roof_metal, root)
    create_sloped_roof("PGRC_Roof_Fascia_Cap", roof_w + 0.08, roof_y_front - 0.04, roof_y_rear + 0.04, z_front_soffit + roof_thickness - 0.02, z_rear_soffit + roof_thickness - 0.02, 0.05, mat_roof_fascia, root)
    
    # 10. Left Elevation Architecture & Utilities (West Wall, IMG_3795)
    side_x = -TOTAL_W / 2.0
    side_win_w = 1.10
    side_win_ys = [-4.20, -2.50]
    for sw_idx, swy in enumerate(side_win_ys):
        pfx = f"PGRC_SideWin_{sw_idx}"
        create_box(f"{pfx}_WhiteTrim", (side_x - 0.015, swy, win_mid_z), (0.03, side_win_w + 0.16, win_h + 0.16), mat_trim_white, root)
        create_box(f"{pfx}_Frame_Top", (side_x - 0.035, swy, win_z0 + win_h), (0.05, side_win_w + 0.04, 0.05), mat_frame_dark, root)
        create_box(f"{pfx}_Frame_Bot", (side_x - 0.035, swy, win_z0), (0.05, side_win_w + 0.04, 0.05), mat_frame_dark, root)
        create_box(f"{pfx}_Spandrel",  (side_x - 0.025, swy, spandrel_mid_z), (0.02, side_win_w - 0.04, spandrel_h - 0.04), mat_spandrel, root)
        create_box(f"{pfx}_Glass",     (side_x - 0.02, swy, glass_mid_z), (0.015, side_win_w - 0.04, glass_h - 0.04), mat_glass_tint, root)
        
    # Wall-Mounted Split AC Condenser Unit (IMG_3795)
    ac_x = side_x - 0.32
    ac_y = 0.40
    ac_z = PLINTH_H + 1.85
    create_box("PGRC_AC_Bracket_L", (ac_x + 0.15, ac_y - 0.30, ac_z - 0.35), (0.35, 0.04, 0.08), mat_frame_dark, root)
    create_box("PGRC_AC_Bracket_R", (ac_x + 0.15, ac_y + 0.30, ac_z - 0.35), (0.35, 0.04, 0.08), mat_frame_dark, root)
    create_box("PGRC_AC_Cabinet", (ac_x, ac_y, ac_z), (0.36, 0.82, 0.60), mat_ac_metal, root)
    create_cylinder("PGRC_AC_FanGrille", (ac_x - 0.19, ac_y - 0.12, ac_z), 0.20, 0.03, mat_frame_dark, 14, rot=(0, math.radians(90), 0), parent=root)
    create_cylinder("PGRC_AC_Conduit", (ac_x + 0.16, ac_y - 0.28, (ac_z + canopy_bot_z) / 2.0), 0.025, canopy_bot_z - ac_z, mat_wall_trim, 8, parent=root)
    
    # 11. Right Elevation Windows (East Wall)
    east_x = TOTAL_W / 2.0
    east_win_ys = [-4.20, -2.50]
    for ew_idx, ewy in enumerate(east_win_ys):
        pfx = f"PGRC_EastWin_{ew_idx}"
        create_box(f"{pfx}_WhiteTrim", (east_x + 0.015, ewy, win_mid_z), (0.03, side_win_w + 0.16, win_h + 0.16), mat_trim_white, root)
        create_box(f"{pfx}_Frame_Top", (east_x + 0.035, ewy, win_z0 + win_h), (0.05, side_win_w + 0.04, 0.05), mat_frame_dark, root)
        create_box(f"{pfx}_Frame_Bot", (east_x + 0.035, ewy, win_z0), (0.05, side_win_w + 0.04, 0.05), mat_frame_dark, root)
        create_box(f"{pfx}_Spandrel",  (east_x + 0.025, ewy, spandrel_mid_z), (0.02, side_win_w - 0.04, spandrel_h - 0.04), mat_spandrel, root)
        create_box(f"{pfx}_Glass",     (east_x + 0.02, ewy, glass_mid_z), (0.015, side_win_w - 0.04, glass_h - 0.04), mat_glass_tint, root)

    # 12. Rear Elevation (North Wall)
    rear_win_xs = [-4.20, 0.0, 4.20]
    for rw_idx, rwx in enumerate(rear_win_xs):
        pfx = f"PGRC_RearWin_{rw_idx}"
        create_box(f"{pfx}_WhiteTrim", (rwx, rear_y + 0.015, win_mid_z), (side_win_w + 0.16, 0.03, win_h + 0.16), mat_trim_white, root)
        create_box(f"{pfx}_Frame_Top", (rwx, rear_y + 0.035, win_z0 + win_h), (side_win_w + 0.04, 0.05, 0.05), mat_frame_dark, root)
        create_box(f"{pfx}_Frame_Bot", (rwx, rear_y + 0.035, win_z0), (side_win_w + 0.04, 0.05, 0.05), mat_frame_dark, root)
        create_box(f"{pfx}_Spandrel",  (rwx, rear_y + 0.025, spandrel_mid_z), (side_win_w - 0.04, 0.02, spandrel_h - 0.04), mat_spandrel, root)
        create_box(f"{pfx}_Glass",     (rwx, rear_y + 0.02, glass_mid_z), (side_win_w - 0.04, 0.015, glass_h - 0.04), mat_glass_tint, root)

    # 13. Entrance Porch Lighting
    for obj in list(bpy.data.objects):
        if obj.name.startswith("PGRC_Light_"):
            bpy.data.objects.remove(obj, do_unlink=True)
            
    l_data = bpy.data.lights.new(name="PGRC_Light_Data", type='POINT')
    l_data.energy = 60.0
    l_data.color = (1.0, 0.96, 0.90)
    l_obj = bpy.data.objects.new("PGRC_Light_0", l_data)
    bpy.context.scene.collection.objects.link(l_obj)
    l_obj.location = (0, portico_y_mid, canopy_bot_z - 0.35)
    l_obj.parent = root

    # 14. WebGL GLB Export
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    
    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\pgrc_building.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"Exported Seamless Authentic PGRC Building GLB to {glb_out} (Size: {file_size_kb:.1f} KB)")
    return root

build_pgrc_building()
