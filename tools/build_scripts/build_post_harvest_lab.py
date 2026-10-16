"""
build_post_harvest_lab.py — Authentic Bespoke 3D Architectural Model of the
Post Harvest Laboratory Building (laboratory_building)
Department of Agriculture - Southern Tagalog Integrated Agricultural Research Center (DA-LARES)

Modeled strictly from ground-truth field photographs:
1. IMG_3797.jpg (Front Elevation Beauty Shot):
   - Signature barrel-vaulted curved arched roof with forest green metal sheeting and fascia
   - Sweeping arched entrance portico echoing the main roof contour
   - 2 Prominent heavy pillars clad in warm orange-brown rust stacked stone / split-face brick veneer with stone caps
   - 3D raised white capital lettering: "POST HARVEST AND FOOD PROCESSING FACILITY"
   - Stone veneer plinth skirting (height ~0.95m) wrapping around entire building base
   - Double commercial glass entrance doors with aluminum stiles, transom, and vertical silver handles
   - Symmetrical wide window bays with aluminum frames, dark glass, and white vertical security grilles
   - Large framed official DA-BAR / DA-RFO IVA project signboard on the right front wall
   - Raised terracotta-tiled porch landing with 3-tier tiled entrance steps
2. IMG_3798.jpg (Side Elevation & Buttresses):
   - Continuous barrel vault roof running full length of the building
   - Regular structural wall pilaster buttresses along the flanks
   - Side windows with white security grilles
   - Multiple wall-mounted AC condenser units under eaves with wall brackets

Strict constraints:
- File size budget <= 300 KB
- Strictly zero external turf slabs, outside trees, road slabs, or curbs
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
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, loc, radius, depth, mat, segments=12, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius,
        depth=depth,
        vertices=segments,
        location=loc,
        rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_post_harvest_lab():
    print("====================================================")
    print(" Building Authentic 3D Model: Post Harvest Lab")
    print("====================================================")
    
    # Clean ALL old mesh/curve objects to prevent any ghost building overlap
    for obj in list(bpy.data.objects):
        if obj.type in ['MESH', 'CURVE', 'EMPTY', 'LIGHT', 'CAMERA']:
            bpy.data.objects.remove(obj, do_unlink=True)
            
    # Materials
    mat_wall_white     = create_mat("PH_WallWhite", (0.92, 0.93, 0.94), roughness=0.75) # Clean White Painted Stucco
    mat_stone_veneer   = create_mat("PH_StoneVeneer", (0.70, 0.38, 0.22), roughness=0.88) # Warm Terracotta-Rust Stacked Stone
    mat_stone_dark     = create_mat("PH_StoneDark", (0.50, 0.26, 0.16), roughness=0.85) # Stone Shadow / Accent Course
    mat_stone_cap      = create_mat("PH_StoneCap", (0.78, 0.76, 0.74), roughness=0.70) # Concrete Pillar Coping Cap
    mat_concrete       = create_mat("PH_Concrete", (0.68, 0.69, 0.70), roughness=0.85) # Base foundation
    mat_tile_terracotta= create_mat("PH_TileTerracotta", (0.64, 0.32, 0.22), roughness=0.55) # Terracotta Porch Tiles
    mat_roof_green     = create_mat("PH_RoofGreen", (0.18, 0.35, 0.22), roughness=0.45) # Signature Forest Green Metal Roof
    mat_fascia_green   = create_mat("PH_FasciaGreen", (0.12, 0.25, 0.15), roughness=0.40) # Dark Green Fascia Trim
    mat_soffit_white   = create_mat("PH_SoffitWhite", (0.88, 0.89, 0.90), roughness=0.80) # Under-eave white ceiling
    mat_glass          = create_mat("PH_Glass", (0.10, 0.14, 0.18), roughness=0.35, metallic=0.0, specular=0.25) # Deep Dark Non-Washed Glass
    mat_frame_alum     = create_mat("PH_FrameAlum", (0.80, 0.82, 0.84), roughness=0.45, metallic=0.4, specular=0.5) # Silver Anodized Aluminum Frames
    mat_grille_white   = create_mat("PH_GrilleWhite", (0.96, 0.96, 0.96), roughness=0.50) # White Security Bars
    mat_door_stile     = create_mat("PH_DoorStile", (0.86, 0.88, 0.90), roughness=0.35, metallic=0.5, specular=0.5) # Commercial Door Stiles
    mat_handle_dark    = create_mat("PH_HandleDark", (0.22, 0.24, 0.26), roughness=0.40, metallic=0.6) # Dark Handle Pulls
    mat_sign_board     = create_mat("PH_SignBoard", (0.95, 0.95, 0.95), roughness=0.40) # Large Framed Project Sign
    mat_sign_header    = create_mat("PH_SignHeader", (0.15, 0.38, 0.22), roughness=0.45) # Green Project Header Bar
    mat_sign_text      = create_mat("PH_SignText", (0.12, 0.14, 0.16), roughness=0.60) # Project description text
    mat_letter_white   = create_mat("PH_LetterWhite", (0.98, 0.98, 0.98), roughness=0.25) # 3D Raised White Lettering
    mat_sign_plate     = create_mat("PH_SignPlate", (0.85, 0.86, 0.88), roughness=0.45) # Backer plate for letters
    mat_seal_gold      = create_mat("PH_SealGold", (0.86, 0.70, 0.24), roughness=0.40, metallic=0.5) # DA / BAR Official Seals
    mat_ac_metal       = create_mat("PH_ACMetal", (0.88, 0.89, 0.90), roughness=0.40, metallic=0.5) # AC Compressor
    mat_bracket_dark   = create_mat("PH_BracketDark", (0.22, 0.24, 0.26), roughness=0.50, metallic=0.6) # AC Brackets & Frames

    root = bpy.data.objects.new("PostHarvestLab_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # Footprint: Width = 14.50m (X: -7.25 to +7.25), Depth = 27.00m (Y: -13.50 to +13.50)
    # Front facade faces South-Southeast at Y = -13.50m
    W = 14.50
    D = 27.00
    x_half = W / 2.0 # 7.25m
    y_half = D / 2.0 # 13.50m
    
    EAVE_Z = 3.80      # Height at eaves / side walls
    ROOF_PEAK_Z = 6.00 # Peak height of barrel vault curve
    SKIRT_H = 0.95     # Height of stacked stone plinth
    WALL_H = EAVE_Z
    
    # -----------------------------------------------------------------
    # 1. Continuous Stone Plinth Skirt (Around entire perimeter, height 0.95m)
    # -----------------------------------------------------------------
    # Front Stone Skirt
    create_box("PH_Plinth_Front", (0.0, -y_half + 0.12, SKIRT_H / 2.0), (W, 0.24, SKIRT_H), mat_stone_veneer, root)
    # Back Stone Skirt
    create_box("PH_Plinth_Back",  (0.0,  y_half - 0.12, SKIRT_H / 2.0), (W, 0.24, SKIRT_H), mat_stone_veneer, root)
    # Left Stone Skirt
    create_box("PH_Plinth_Left",  (-x_half + 0.12, 0.0, SKIRT_H / 2.0), (0.24, D, SKIRT_H), mat_stone_veneer, root)
    # Right Stone Skirt
    create_box("PH_Plinth_Right", ( x_half - 0.12, 0.0, SKIRT_H / 2.0), (0.24, D, SKIRT_H), mat_stone_veneer, root)
    
    # Stone plinth top coping trim
    create_box("PH_Plinth_Cap_Front", (0.0, -y_half + 0.12, SKIRT_H + 0.02), (W + 0.04, 0.26, 0.04), mat_stone_cap, root)
    create_box("PH_Plinth_Cap_Left",  (-x_half + 0.12, 0.0, SKIRT_H + 0.02), (0.26, D + 0.04, 0.04), mat_stone_cap, root)
    create_box("PH_Plinth_Cap_Right", ( x_half - 0.12, 0.0, SKIRT_H + 0.02), (0.26, D + 0.04, 0.04), mat_stone_cap, root)

    # -----------------------------------------------------------------
    # 2. Main Solid Walls (Side & Front/Back)
    # -----------------------------------------------------------------
    wall_upper_h = EAVE_Z - SKIRT_H
    wall_upper_cz = SKIRT_H + wall_upper_h / 2.0
    # Left and Right vertical side walls
    create_box("PH_Wall_Left",  (-x_half + 0.12, 0.0, wall_upper_cz), (0.24, D, wall_upper_h), mat_wall_white, root)
    create_box("PH_Wall_Right", ( x_half - 0.12, 0.0, wall_upper_cz), (0.24, D, wall_upper_h), mat_wall_white, root)

    # Watertight Barrel-Vault Gable Walls (Front & Rear from Z = SKIRT_H to curved roof peak)
    def build_watertight_arched_wall(name, y_pos, facing_front=True):
        mesh = bpy.data.meshes.new(f"{name}_Mesh")
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = root
        obj.data.materials.append(mat_wall_white)
        
        bm = bmesh.new()
        segs = 28
        for i in range(segs):
            u0 = i / float(segs)
            u1 = (i + 1) / float(segs)
            x0 = -x_half + u0 * W
            x1 = -x_half + u1 * W
            z0 = EAVE_Z + (ROOF_PEAK_Z - EAVE_Z) * (1.0 - (2.0 * u0 - 1.0) ** 2)
            z1 = EAVE_Z + (ROOF_PEAK_Z - EAVE_Z) * (1.0 - (2.0 * u1 - 1.0) ** 2)
            
            # 4 vertices per quad panel: base left, base right, top right, top left
            v_bl = bm.verts.new((x0, y_pos, SKIRT_H))
            v_br = bm.verts.new((x1, y_pos, SKIRT_H))
            v_tr = bm.verts.new((x1, y_pos, z1))
            v_tl = bm.verts.new((x0, y_pos, z0))
            if facing_front:
                bm.faces.new((v_bl, v_br, v_tr, v_tl))
            else:
                bm.faces.new((v_bl, v_tl, v_tr, v_br))
        bm.to_mesh(mesh)
        bm.free()
        return obj

    build_watertight_arched_wall("PH_Gable_Front", -y_half + 0.12, facing_front=True)
    build_watertight_arched_wall("PH_Gable_Back",   y_half - 0.12, facing_front=False)

    # -----------------------------------------------------------------
    # 3. Signature Barrel-Vaulted Green Metal Roof
    # -----------------------------------------------------------------
    ROOF_W = W + 1.20 # 15.70m (overhang 0.60m each side)
    ROOF_D = D + 1.40 # 28.40m (overhang 0.70m front and rear)
    r_x_half = ROOF_W / 2.0
    r_y_min = -y_half - 0.70
    r_y_max =  y_half + 0.70
    r_eave_z = EAVE_Z - 0.05
    r_peak_z = ROOF_PEAK_Z + 0.12
    
    roof_mesh = bpy.data.meshes.new("PH_BarrelRoof_Mesh")
    roof_obj = bpy.data.objects.new("PH_BarrelRoof", roof_mesh)
    bpy.context.scene.collection.objects.link(roof_obj)
    roof_obj.parent = root
    roof_obj.data.materials.append(mat_roof_green)
    
    bm_roof = bmesh.new()
    roof_segs = 32
    v_front_arc = []
    v_back_arc = []
    
    for i in range(roof_segs + 1):
        u = i / float(roof_segs)
        vx = -r_x_half + u * ROOF_W
        vz = r_eave_z + (r_peak_z - r_eave_z) * (1.0 - (2.0 * u - 1.0) ** 2)
        v_front_arc.append(bm_roof.verts.new((vx, r_y_min, vz)))
        v_back_arc.append(bm_roof.verts.new((vx, r_y_max, vz)))
        
    for i in range(roof_segs):
        bm_roof.faces.new((v_front_arc[i], v_front_arc[i+1], v_back_arc[i+1], v_back_arc[i]))
        
    bm_roof.to_mesh(roof_mesh)
    bm_roof.free()

    # Front & Rear Arched Green Fascia Boards
    def build_curved_fascia(name, y_pos, facing_dir=-1):
        f_mesh = bpy.data.meshes.new(f"{name}_Mesh")
        f_obj = bpy.data.objects.new(name, f_mesh)
        bpy.context.scene.collection.objects.link(f_obj)
        f_obj.parent = root
        f_obj.data.materials.append(mat_fascia_green)
        
        bm_f = bmesh.new()
        f_thick = 0.20
        for i in range(roof_segs):
            u0 = i / float(roof_segs)
            u1 = (i + 1) / float(roof_segs)
            x0 = -r_x_half + u0 * ROOF_W
            x1 = -r_x_half + u1 * ROOF_W
            z0 = r_eave_z + (r_peak_z - r_eave_z) * (1.0 - (2.0 * u0 - 1.0) ** 2)
            z1 = r_eave_z + (r_peak_z - r_eave_z) * (1.0 - (2.0 * u1 - 1.0) ** 2)
            
            va = bm_f.verts.new((x0, y_pos, z0))
            vb = bm_f.verts.new((x1, y_pos, z1))
            vc = bm_f.verts.new((x1, y_pos, z1 - f_thick))
            vd = bm_f.verts.new((x0, y_pos, z0 - f_thick))
            if facing_dir == -1:
                bm_f.faces.new((va, vb, vc, vd))
            else:
                bm_f.faces.new((va, vd, vc, vb))
        bm_f.to_mesh(f_mesh)
        bm_f.free()
        return f_obj

    build_curved_fascia("PH_Fascia_Front", r_y_min, facing_dir=-1)
    build_curved_fascia("PH_Fascia_Back",  r_y_max, facing_dir=1)

    # Side Eaves Gutters & Fascia (running along Left and Right edges)
    create_box("PH_Fascia_Left",  (-r_x_half, 0.0, r_eave_z - 0.10), (0.08, ROOF_D, 0.20), mat_fascia_green, root)
    create_box("PH_Fascia_Right", ( r_x_half, 0.0, r_eave_z - 0.10), (0.08, ROOF_D, 0.20), mat_fascia_green, root)

    # -----------------------------------------------------------------
    # 4. Arched Entrance Portico & Stacked Stone Pillars (IMG_3797)
    # -----------------------------------------------------------------
    portico_w = 4.80
    portico_d = 2.40
    p_x_half = portico_w / 2.0
    p_y_front = -y_half - portico_d # -15.90m
    p_pillar_cx = 2.00
    p_eave_z = 3.35
    p_peak_z = 4.50
    
    # Two Prominent Stacked Stone Pillars with Horizontal Joint Bands & Coping Caps (IMG_3797)
    pillar_w = 0.70
    pillar_d = 0.70
    pillar_h = p_eave_z
    
    for px, side in [(-p_pillar_cx, "L"), (p_pillar_cx, "R")]:
        py = p_y_front + pillar_d/2.0
        # Main stone body
        create_box(f"PH_Portico_Pillar_{side}", (px, py, pillar_h / 2.0), (pillar_w, pillar_d, pillar_h), mat_stone_veneer, root)
        # Horizontal stacked stone relief bands (giving authentic stone texture)
        for band_i, bz in enumerate([0.90, 1.80, 2.70]):
            create_box(f"PH_PillarBand_{side}_{band_i}", (px, py, bz), (pillar_w + 0.02, pillar_d + 0.02, 0.04), mat_stone_dark, root)
        # Base stone plinth
        create_box(f"PH_PillarBase_{side}", (px, py, 0.12), (pillar_w + 0.08, pillar_d + 0.08, 0.24), mat_stone_dark, root)
        # Concrete coping cap at top of pillar
        create_box(f"PH_PillarCap_{side}", (px, py, pillar_h + 0.04), (pillar_w + 0.10, pillar_d + 0.10, 0.08), mat_stone_cap, root)

    # Horizontal Arch Entablature Beam across pillars
    beam_h = 0.45
    create_box("PH_Portico_ArchBeam", (0.0, p_y_front + pillar_d/2.0, p_eave_z - beam_h/2.0), (portico_w + pillar_w, pillar_d - 0.10, beam_h), mat_wall_white, root)

    # Arched Portico Roof Canopy (echoing main roof curve)
    p_roof_w = portico_w + 0.70 # 5.50m
    p_roof_x_half = p_roof_w / 2.0
    p_roof_mesh = bpy.data.meshes.new("PH_PorticoRoof_Mesh")
    p_roof_obj = bpy.data.objects.new("PH_PorticoRoof", p_roof_mesh)
    bpy.context.scene.collection.objects.link(p_roof_obj)
    p_roof_obj.parent = root
    p_roof_obj.data.materials.append(mat_roof_green)
    
    bm_p = bmesh.new()
    p_segs = 24
    p_v_front = []
    p_v_back = []
    for i in range(p_segs + 1):
        u = i / float(p_segs)
        vx = -p_roof_x_half + u * p_roof_w
        vz = p_eave_z + (p_peak_z - p_eave_z) * (1.0 - (2.0 * u - 1.0) ** 2)
        p_v_front.append(bm_p.verts.new((vx, p_y_front - 0.15, vz)))
        p_v_back.append(bm_p.verts.new((vx, -y_half + 0.05, vz)))
        
    for i in range(p_segs):
        bm_p.faces.new((p_v_front[i], p_v_front[i+1], p_v_back[i+1], p_v_back[i]))
    bm_p.to_mesh(p_roof_mesh)
    bm_p.free()

    # Portico Arched Green Fascia Trim
    p_f_mesh = bpy.data.meshes.new("PH_PorticoFascia_Mesh")
    p_f_obj = bpy.data.objects.new("PH_PorticoFascia", p_f_mesh)
    bpy.context.scene.collection.objects.link(p_f_obj)
    p_f_obj.parent = root
    p_f_obj.data.materials.append(mat_fascia_green)
    
    bm_pf = bmesh.new()
    pf_h = 0.16
    for i in range(p_segs):
        u0 = i / float(p_segs)
        u1 = (i + 1) / float(p_segs)
        x0 = -p_roof_x_half + u0 * p_roof_w
        x1 = -p_roof_x_half + u1 * p_roof_w
        z0 = p_eave_z + (p_peak_z - p_eave_z) * (1.0 - (2.0 * u0 - 1.0) ** 2)
        z1 = p_eave_z + (p_peak_z - p_eave_z) * (1.0 - (2.0 * u1 - 1.0) ** 2)
        va = bm_pf.verts.new((x0, p_y_front - 0.15, z0))
        vb = bm_pf.verts.new((x1, p_y_front - 0.15, z1))
        vc = bm_pf.verts.new((x1, p_y_front - 0.15, z1 - pf_h))
        vd = bm_pf.verts.new((x0, p_y_front - 0.15, z0 - pf_h))
        bm_pf.faces.new((va, vb, vc, vd))
    bm_pf.to_mesh(p_f_mesh)
    bm_pf.free()

    # Solid Vertical Arched Portico Tympanum / Signage Face (White stucco wall)
    p_tymp_mesh = bpy.data.meshes.new("PH_PorticoTympanum_Mesh")
    p_tymp_obj = bpy.data.objects.new("PH_PorticoTympanum", p_tymp_mesh)
    bpy.context.scene.collection.objects.link(p_tymp_obj)
    p_tymp_obj.parent = root
    p_tymp_obj.data.materials.append(mat_wall_white)
    
    bm_pt = bmesh.new()
    for i in range(p_segs):
        u0 = i / float(p_segs)
        u1 = (i + 1) / float(p_segs)
        x0 = -p_x_half + u0 * portico_w
        x1 = -p_x_half + u1 * portico_w
        z0 = p_eave_z + (p_peak_z - p_eave_z) * (1.0 - (2.0 * u0 - 1.0) ** 2) - 0.02
        z1 = p_eave_z + (p_peak_z - p_eave_z) * (1.0 - (2.0 * u1 - 1.0) ** 2) - 0.02
        
        v_b0 = bm_pt.verts.new((x0, p_y_front + 0.10, p_eave_z - 0.35))
        v_b1 = bm_pt.verts.new((x1, p_y_front + 0.10, p_eave_z - 0.35))
        v_t1 = bm_pt.verts.new((x1, p_y_front + 0.10, z1))
        v_t0 = bm_pt.verts.new((x0, p_y_front + 0.10, z0))
        bm_pt.faces.new((v_b0, v_b1, v_t1, v_t0))
    bm_pt.to_mesh(p_tymp_mesh)
    bm_pt.free()

    # Contrasting Signage Panel Plate for Raised 3D Lettering (IMG_3797)
    plate_w = 4.20
    plate_h = 0.95
    plate_z = 3.65
    mat_sign_green = create_mat("PH_SignGreen", (0.12, 0.28, 0.16), roughness=0.40) # Official DA Green Backer
    create_box("PH_SignPlate", (0.0, p_y_front + 0.07, plate_z), (plate_w, 0.03, plate_h), mat_sign_green, root)

    # 3D Raised White Signage Lettering on Green Backer Plate:
    # "POST HARVEST AND FOOD" (Line 1)
    # "PROCESSING FACILITY"  (Line 2)
    create_box("PH_SignText_Line1", (0.0, p_y_front + 0.05, plate_z + 0.16), (3.80, 0.04, 0.18), mat_letter_white, root)
    create_box("PH_SignText_Line2", (0.0, p_y_front + 0.05, plate_z - 0.14), (3.30, 0.04, 0.18), mat_letter_white, root)
    
    # Official Circular Emblem Seals above text (DA seal & BAR seal)
    create_cylinder("PH_Seal_L", (-0.75, p_y_front + 0.05, plate_z + 0.52), 0.18, 0.03, mat_seal_gold, segments=14, rot=(math.radians(90), 0, 0), parent=root)
    create_cylinder("PH_Seal_R", ( 0.75, p_y_front + 0.05, plate_z + 0.52), 0.18, 0.03, mat_seal_gold, segments=14, rot=(math.radians(90), 0, 0), parent=root)

    # -----------------------------------------------------------------
    # 5. Entrance Porch Landing, Steps & Double Commercial Glass Doors
    # -----------------------------------------------------------------
    porch_w = 4.40
    porch_d = 2.60
    porch_h = 0.45
    porch_y = -y_half - porch_d / 2.0
    # Concrete base plinth
    create_box("PH_Porch_Plinth", (0.0, porch_y, porch_h / 2.0), (porch_w, porch_d, porch_h), mat_concrete, root)
    # Terracotta tile surface cap
    create_box("PH_Porch_Tiles",  (0.0, porch_y, porch_h + 0.01), (porch_w - 0.06, porch_d - 0.06, 0.02), mat_tile_terracotta, root)
    
    # 3-Tier Entrance Steps (Terracotta Tiled, directly leading to ground level)
    step_w = 2.60
    step_tread = 0.35
    s1_y = -y_half - porch_d - step_tread/2.0
    s2_y = s1_y - step_tread
    create_box("PH_Step_1", (0.0, s1_y, 0.15), (step_w, step_tread, 0.30), mat_tile_terracotta, root)
    create_box("PH_Step_2", (0.0, s2_y, 0.075), (step_w, step_tread, 0.15), mat_tile_terracotta, root)

    # Commercial Double Glass Entrance Doors (Centered at X = 0, Y = -y_half)
    d_w = 2.00
    d_h = 2.30
    d_z = porch_h + d_h / 2.0
    # Door Recess / Dark interior backing
    create_box("PH_Door_Recess", (0.0, -y_half + 0.06, d_z), (d_w + 0.08, 0.12, d_h + 0.35), mat_stone_dark, root)
    # Aluminum Outer Storefront Frame
    create_box("PH_Door_Frame", (0.0, -y_half - 0.01, d_z), (d_w, 0.06, d_h), mat_frame_alum, root)
    
    # Left & Right Commercial Door Leaves (with perimeter stiles and clear center glass)
    dl_w = d_w / 2.0 - 0.04
    stile_w = 0.07
    for dx, side in [(-d_w/4.0, "L"), (d_w/4.0, "R")]:
        # Glass panel
        create_box(f"PH_Door_{side}_Glass", (dx, -y_half - 0.015, d_z), (dl_w - 0.02, 0.02, d_h - 0.04), mat_glass, root)
        # Left stile
        create_box(f"PH_Door_{side}_StileL", (dx - dl_w/2.0 + stile_w/2.0, -y_half - 0.02, d_z), (stile_w, 0.04, d_h - 0.04), mat_door_stile, root)
        # Right stile
        create_box(f"PH_Door_{side}_StileR", (dx + dl_w/2.0 - stile_w/2.0, -y_half - 0.02, d_z), (stile_w, 0.04, d_h - 0.04), mat_door_stile, root)
        # Top rail
        create_box(f"PH_Door_{side}_TopRail", (dx, -y_half - 0.02, d_z + d_h/2.0 - 0.05), (dl_w, 0.04, 0.08), mat_door_stile, root)
        # Bottom kickplate
        create_box(f"PH_Door_{side}_Kick", (dx, -y_half - 0.02, porch_h + 0.12), (dl_w, 0.045, 0.22), mat_door_stile, root)
        
    # Vertical Tubular Handles
    create_box("PH_Door_L_Handle", (-0.08, -y_half - 0.05, porch_h + 1.05), (0.03, 0.04, 0.45), mat_handle_dark, root)
    create_box("PH_Door_R_Handle", ( 0.08, -y_half - 0.05, porch_h + 1.05), (0.03, 0.04, 0.45), mat_handle_dark, root)
    
    # Transom Glass above doors
    create_box("PH_Door_Transom", (0.0, -y_half - 0.01, porch_h + d_h + 0.20), (d_w - 0.08, 0.03, 0.32), mat_glass, root)

    # -----------------------------------------------------------------
    # 6. Symmetrical Front Window Bays with Security Grilles (IMG_3797)
    # -----------------------------------------------------------------
    def build_window_bay(name, x, y, width, height, z_center, rot_y=False):
        # Outer Frame
        f_size = (0.08, width, height) if rot_y else (width, 0.08, height)
        f_pos = (x - 0.02, y, z_center) if rot_y else (x, y - 0.02, z_center)
        create_box(f"{name}_Frame", f_pos, f_size, mat_frame_alum, root)
        
        # Glass
        g_size = (0.04, width - 0.08, height - 0.08) if rot_y else (width - 0.08, 0.04, height - 0.08)
        g_pos = (x - 0.02, y, z_center) if rot_y else (x, y - 0.02, z_center)
        create_box(f"{name}_Glass", g_pos, g_size, mat_glass, root)
        
        # Window Sill (White concrete)
        s_size = (0.12, width + 0.12, 0.06) if rot_y else (width + 0.12, 0.12, 0.06)
        s_pos = (x - 0.05, y, z_center - height/2.0 - 0.03) if rot_y else (x, y - 0.05, z_center - height/2.0 - 0.03)
        create_box(f"{name}_Sill", s_pos, s_size, mat_wall_white, root)

        # Single BMesh for all security grille bars in this window (drastically reduces GLTF node count!)
        g_mesh = bpy.data.meshes.new(f"{name}_Grille_Mesh")
        g_obj = bpy.data.objects.new(f"{name}_Grille", g_mesh)
        bpy.context.scene.collection.objects.link(g_obj)
        g_obj.parent = root
        g_obj.data.materials.append(mat_grille_white)
        
        bm_g = bmesh.new()
        n_bars = max(4, int(width / 0.45))
        bw = 0.024
        bh = height - 0.06
        for b_i in range(n_bars):
            offset = -width/2.0 + (b_i + 0.5) * (width / n_bars)
            if not rot_y:
                bx = x + offset
                by = y - 0.048
                b_min = (bx - bw/2.0, by - bw/2.0, z_center - bh/2.0)
                b_max = (bx + bw/2.0, by + bw/2.0, z_center + bh/2.0)
            else:
                bx = x - 0.048
                by = y + offset
                b_min = (bx - bw/2.0, by - bw/2.0, z_center - bh/2.0)
                b_max = (bx + bw/2.0, by + bw/2.0, z_center + bh/2.0)
                
            # Add 8 vertices for the bar cube
            v = [
                bm_g.verts.new((b_min[0], b_min[1], b_min[2])),
                bm_g.verts.new((b_max[0], b_min[1], b_min[2])),
                bm_g.verts.new((b_max[0], b_max[1], b_min[2])),
                bm_g.verts.new((b_min[0], b_max[1], b_min[2])),
                bm_g.verts.new((b_min[0], b_min[1], b_max[2])),
                bm_g.verts.new((b_max[0], b_min[1], b_max[2])),
                bm_g.verts.new((b_max[0], b_max[1], b_max[2])),
                bm_g.verts.new((b_min[0], b_max[1], b_max[2]))
            ]
            bm_g.faces.new((v[0], v[1], v[2], v[3]))
            bm_g.faces.new((v[4], v[7], v[6], v[5]))
            bm_g.faces.new((v[0], v[4], v[5], v[1]))
            bm_g.faces.new((v[1], v[5], v[6], v[2]))
            bm_g.faces.new((v[2], v[6], v[7], v[3]))
            bm_g.faces.new((v[3], v[7], v[4], v[0]))
            
        bm_g.to_mesh(g_mesh)
        bm_g.free()

    win_front_z = 2.10
    win_front_h = 1.45
    win_front_w = 3.60
    
    # Left Wing Window (IMG_3797)
    build_window_bay("PH_Win_FrontL", -4.60, -y_half + 0.12, win_front_w, win_front_h, win_front_z)
    
    # Right Wing Window (IMG_3797)
    build_window_bay("PH_Win_FrontR",  4.60, -y_half + 0.12, win_front_w, win_front_h, win_front_z)

    # -----------------------------------------------------------------
    # 7. Official Framed Project Signboard on Right Front Facade (IMG_3797)
    # -----------------------------------------------------------------
    # "EXPANDING THE OPERATION OF ARANGKADA IBI CALABARZON..."
    # Mounted in front of the right window/wall section
    sign_w = 2.60
    sign_h = 1.30
    sign_x = 4.60
    sign_y = -y_half - 0.06
    sign_z = 2.15
    create_box("PH_ProjSign_Backer", (sign_x, sign_y, sign_z), (sign_w, 0.06, sign_h), mat_bracket_dark, root)
    create_box("PH_ProjSign_Face",   (sign_x, sign_y - 0.02, sign_z), (sign_w - 0.06, 0.03, sign_h - 0.06), mat_sign_board, root)
    create_box("PH_ProjSign_Header", (sign_x, sign_y - 0.03, sign_z + sign_h/2.0 - 0.14), (sign_w - 0.12, 0.02, 0.20), mat_sign_header, root)
    create_box("PH_ProjSign_Text",   (sign_x, sign_y - 0.03, sign_z - 0.08), (sign_w - 0.18, 0.02, 0.45), mat_sign_text, root)

    # -----------------------------------------------------------------
    # 8. Side Pilaster Buttresses, Windows & AC Units (IMG_3798)
    # -----------------------------------------------------------------
    # 5 bays along each 27m flank (stations at Y = -9.0m, -4.5m, 0.0m, +4.5m, +9.0m)
    side_station_ys = [-9.0, -4.5, 0.0, 4.5, 9.0]
    buttress_w = 0.28
    buttress_d = 0.42
    buttress_h = EAVE_Z
    
    for idx, s_y in enumerate(side_station_ys):
        # Left wall buttress
        create_box(f"PH_Buttress_L_{idx}", (-x_half - buttress_w/2.0 + 0.12, s_y, buttress_h / 2.0), (buttress_w, buttress_d, buttress_h), mat_wall_white, root)
        create_box(f"PH_ButtressPlinth_L_{idx}", (-x_half - buttress_w/2.0 + 0.12, s_y, SKIRT_H / 2.0), (buttress_w + 0.04, buttress_d + 0.04, SKIRT_H), mat_stone_veneer, root)
        # Right wall buttress
        create_box(f"PH_Buttress_R_{idx}", ( x_half + buttress_w/2.0 - 0.12, s_y, buttress_h / 2.0), (buttress_w, buttress_d, buttress_h), mat_wall_white, root)
        create_box(f"PH_ButtressPlinth_R_{idx}", ( x_half + buttress_w/2.0 - 0.12, s_y, SKIRT_H / 2.0), (buttress_w + 0.04, buttress_d + 0.04, SKIRT_H), mat_stone_veneer, root)

    # Side Windows (4 bays per flank between buttresses)
    win_bays_y = [-6.75, -2.25, 2.25, 6.75]
    for idx, w_y in enumerate(win_bays_y):
        build_window_bay(f"PH_Win_SideL_{idx}", -x_half + 0.12, w_y, 2.80, 1.35, 2.20, rot_y=True)
        build_window_bay(f"PH_Win_SideR_{idx}",  x_half - 0.12, w_y, 2.80, 1.35, 2.20, rot_y=True)

    # Wall-Mounted Outdoor AC Condenser Units under eaves (IMG_3798)
    ac_stations = [(-x_half - 0.28, -4.5, 3.20), (-x_half - 0.28, 0.0, 3.20), (-x_half - 0.28, 4.5, 3.20)]
    for idx, (ac_x, ac_y, ac_z) in enumerate(ac_stations):
        # Wall bracket
        create_box(f"PH_AC_Bracket_{idx}", (ac_x + 0.14, ac_y, ac_z - 0.25), (0.24, 0.50, 0.30), mat_bracket_dark, root)
        # AC Unit
        create_box(f"PH_AC_Unit_{idx}", (ac_x, ac_y, ac_z), (0.35, 0.75, 0.55), mat_ac_metal, root)
        # Circular Fan
        create_cylinder(f"PH_AC_Fan_{idx}", (ac_x - 0.18, ac_y, ac_z), 0.18, 0.04, mat_bracket_dark, segments=12, rot=(0, math.radians(90), 0), parent=root)

    # -----------------------------------------------------------------
    # 9. Rear Wall (North Facade) Door & Windows
    # -----------------------------------------------------------------
    create_box("PH_RearDoor_Frame", (0.0, y_half - 0.03, SKIRT_H + 1.10), (1.10, 0.08, 2.20), mat_frame_alum, root)
    create_box("PH_RearDoor_Panel", (0.0, y_half - 0.03, SKIRT_H + 1.10), (1.00, 0.05, 2.10), mat_wall_white, root)
    build_window_bay("PH_Win_RearL", -4.00, y_half - 0.12, 2.80, 1.35, 2.20)
    build_window_bay("PH_Win_RearR",  4.00, y_half - 0.12, 2.80, 1.35, 2.20)

    # -----------------------------------------------------------------
    # 10. WebGL GLB Export
    # -----------------------------------------------------------------
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    
    glb_out = r"c:\Users\LGU-SanPedro\Downloads\map\models\laboratory_building.glb"
    bpy.ops.export_scene.gltf(
        filepath=glb_out,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )
    file_size_kb = os.path.getsize(glb_out) / 1024.0
    print(f"Exported Post Harvest Lab GLB to {glb_out} (Size: {file_size_kb:.1f} KB)")
    return root

build_post_harvest_lab()
