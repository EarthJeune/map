"""
build_rsbsa_building.py — DA-LARES Interactive Campus Map
Bespoke 3D Architectural Builder for the RSBSA Building (rsbsa_building).

100% Watertight FLAT ROOF architecture conforming to:
  1. The user's updated polygon drawing in draw.html (defining the ROOF OUTLINE).
  2. The authentic architectural rule: "the roof is excess more than the building"
     - Roof has a generous cantilever overhang (1.2m to 2.0m) beyond the recessed building walls.
     - White spandrel soffit with dark green fascia wrapping the perimeter (IMG_3835).
     - Front veranda is deep and sheltered under the roof with charcoal soffit and downlights (IMG_3834).
     - Green DRRMIS 2.0 banner hanging from the front eave of the recessed courtyard (IMG_3835).
     - Recessed courtyard wall with 3 tall narrow bronze-framed awning windows and planter box (IMG_3835).
     - Recessed East wall with high wall-mounted LG split AC condenser, red/blue piping, and ground AC (IMG_3835).
     - Stepped rear facade with wide roof overhangs, 2 bathroom louver windows with hoods, and sliding window with hood (IMG_3836).
     - Front facade with 5-step concrete stair, double frosted doors, stacked stone pilasters, cantilever canopy, signboard, and 4-pane commercial windows (IMG_3833).

STRICT CONSTRAINTS:
  - Model file: models/rsbsa_building.glb (under 300 KB).
  - 100% FLAT ROOF: Extruded 3D prism, zero sloped triangles, zero holes, zero light leaks.
  - Zero outside terrain turf slabs, roads, vehicles, or outdoor trees.
"""

import bpy
import bmesh
import math
import os

TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\rsbsa_building.glb"

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)

def get_or_create_material(name, base_color, roughness=0.6, metallic=0.0, emission=None, emission_strength=1.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = base_color
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        if emission:
            if 'Emission Color' in bsdf.inputs:
                bsdf.inputs['Emission Color'].default_value = emission
                bsdf.inputs['Emission Strength'].default_value = emission_strength
            elif 'Emission' in bsdf.inputs:
                bsdf.inputs['Emission'].default_value = emission
    return mat

def create_box(name, loc, size, mat=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2.0, size[1] / 2.0, size[2] / 2.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_extruded_polygon(name, vertices_2d, z_bottom, z_top, mat_top=None, mat_side=None, mat_bottom=None, parent=None):
    """
    Creates a 100% solid, watertight 3D prism by extruding a 2D closed polygon from z_bottom to z_top.
    """
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()

    bottom_bm_verts = [bm.verts.new((x, y, z_bottom)) for x, y in vertices_2d]
    top_bm_verts = [bm.verts.new((x, y, z_top)) for x, y in vertices_2d]
    bm.verts.ensure_lookup_table()
    n = len(vertices_2d)

    try:
        bottom_face = bm.faces.new(reversed(bottom_bm_verts))
        bottom_face.material_index = 0
    except Exception as e:
        print("Bottom face error:", e)

    try:
        top_face = bm.faces.new(top_bm_verts)
        top_face.material_index = 1
    except Exception as e:
        print("Top face error:", e)

    for i in range(n):
        v_b1 = bottom_bm_verts[i]
        v_b2 = bottom_bm_verts[(i + 1) % n]
        v_t2 = top_bm_verts[(i + 1) % n]
        v_t1 = top_bm_verts[i]
        try:
            side_face = bm.faces.new([v_b1, v_b2, v_t2, v_t1])
            side_face.material_index = 2
        except Exception as e:
            print(f"Side face {i} error:", e)

    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    mats = [mat_bottom or mat_side, mat_top or mat_side, mat_side]
    for m in mats:
        obj.data.materials.append(m)

    if parent:
        obj.parent = parent
    return obj

def build_rsbsa_building():
    clear_scene()

    # Materials
    mat_wall = get_or_create_material("RSBSA_WallStucco", (0.84, 0.84, 0.82, 1.0), roughness=0.7)
    mat_plinth_grey = get_or_create_material("RSBSA_PlinthGrey", (0.32, 0.34, 0.36, 1.0), roughness=0.8)
    mat_plinth_white = get_or_create_material("RSBSA_PlinthWhite", (0.92, 0.92, 0.90, 1.0), roughness=0.6)
    
    # Roof Materials (Authentic dark forest green deck + fascia, clean white spandrel soffit)
    mat_roof_deck = get_or_create_material("RSBSA_RoofDeck", (0.16, 0.32, 0.22, 1.0), roughness=0.6)
    mat_roof_fascia = get_or_create_material("RSBSA_RoofFascia", (0.12, 0.26, 0.18, 1.0), roughness=0.5)
    mat_roof_soffit_white = get_or_create_material("RSBSA_RoofSoffitWhite", (0.95, 0.95, 0.93, 1.0), roughness=0.4)
    mat_veranda_soffit = get_or_create_material("RSBSA_VerandaSoffitDark", (0.22, 0.23, 0.25, 1.0), roughness=0.6)

    # Architectural Detail Materials
    mat_stone = get_or_create_material("RSBSA_StoneVeneer", (0.35, 0.33, 0.30, 1.0), roughness=0.9)
    mat_stone_accent = get_or_create_material("RSBSA_StoneDark", (0.22, 0.20, 0.18, 1.0), roughness=0.9)
    mat_bronze = get_or_create_material("RSBSA_BronzeFrame", (0.18, 0.14, 0.10, 1.0), roughness=0.4, metallic=0.7)
    mat_glass = get_or_create_material("RSBSA_CommercialGlass", (0.20, 0.30, 0.32, 1.0), roughness=0.1, metallic=0.2)
    mat_frosted_glass = get_or_create_material("RSBSA_FrostedGlass", (0.75, 0.82, 0.84, 1.0), roughness=0.4)
    mat_glass_back = get_or_create_material("RSBSA_InteriorBacking", (0.05, 0.05, 0.06, 1.0), roughness=0.9)

    mat_metal_silver = get_or_create_material("RSBSA_SilverMetal", (0.75, 0.77, 0.80, 1.0), roughness=0.3, metallic=0.9)
    mat_metal_black = get_or_create_material("RSBSA_BlackRail", (0.08, 0.08, 0.09, 1.0), roughness=0.5, metallic=0.6)
    mat_ac_white = get_or_create_material("RSBSA_ACWhite", (0.92, 0.92, 0.90, 1.0), roughness=0.4)
    mat_ac_grille = get_or_create_material("RSBSA_ACGrille", (0.20, 0.20, 0.22, 1.0), roughness=0.6)
    mat_ac_red = get_or_create_material("RSBSA_ACRedPipe", (0.78, 0.15, 0.12, 1.0), roughness=0.5)
    mat_ac_blue = get_or_create_material("RSBSA_ACBluePipe", (0.15, 0.35, 0.78, 1.0), roughness=0.5)
    mat_banner_green = get_or_create_material("RSBSA_BannerGreen", (0.10, 0.48, 0.20, 1.0), roughness=0.5)
    mat_sign_white = get_or_create_material("RSBSA_SignWhite", (0.96, 0.96, 0.96, 1.0), roughness=0.3)
    mat_sign_green = get_or_create_material("RSBSA_SignGreen", (0.08, 0.38, 0.18, 1.0), roughness=0.4)
    mat_planter_green = get_or_create_material("RSBSA_PlantFoliage", (0.15, 0.40, 0.18, 1.0), roughness=0.8)
    mat_concrete = get_or_create_material("RSBSA_ConcreteStep", (0.72, 0.72, 0.70, 1.0), roughness=0.8)
    mat_light_glow = get_or_create_material("RSBSA_LightGlow", (1.0, 0.95, 0.85, 1.0), roughness=0.3, emission=(1.0, 0.95, 0.85, 1.0), emission_strength=2.0)

    # Root object
    root = bpy.data.objects.new("RSBSA_Root", None)
    bpy.context.collection.objects.link(root)

    # -------------------------------------------------------------
    # 1. ROOF OUTLINE POLYGON (Conforms 1:1 to draw.html)
    # Centered at (0, 0)
    # -------------------------------------------------------------
    roof_poly_2d = [
        (-8.50, -13.50), # R0: Front-Left (SW)
        (+1.20, -13.50), # R1: Front-Right corner of front wing
        (+1.20,  -5.50), # R2: Inner corner of porch recess
        (+8.00,  -5.50), # R3: Corner turning to East flank
        (+8.00,  +3.60), # R4: Northeast corner (Step 1 right)
        (+4.20,  +3.60), # R5: Step 1 inner corner
        (+4.20,  +6.40), # R6: Step 2 peak right
        ( 0.00,  +6.40), # R7: Step 2 peak left
        ( 0.00,  +5.20), # R8: Step 3 inner corner
        (-4.20,  +5.20), # R9: Step 3 left corner
        (-4.20,  +3.60), # R10: Step 4 inner corner
        (-8.50,  +3.60)  # R11: Northwest corner (Step 4 left)
    ]

    # Heights
    Z_GROUND = 0.00
    Z_PLINTH = 0.55
    Z_CEILING = 3.60
    Z_ROOF_TOP = 3.88

    # -------------------------------------------------------------
    # 2. 100% FLAT ROOF SLAB (Z = 3.60m to 3.88m)
    # Extruded directly from the user's draw.html polygon!
    # Top: Dark forest green waterproof deck
    # Perimeter: Dark forest green fascia trim
    # Bottom: White spandrel ceiling soffit
    # ZERO HOLES! ZERO GABLES!
    # -------------------------------------------------------------
    create_extruded_polygon(
        "RSBSA_FlatRoof_Slab",
        roof_poly_2d,
        Z_CEILING,
        Z_ROOF_TOP,
        mat_top=mat_roof_deck,
        mat_side=mat_roof_fascia,
        mat_bottom=mat_roof_soffit_white,
        parent=root
    )

    # Roof curb perimeter (gravel stop)
    create_extruded_polygon(
        "RSBSA_Roof_Curb",
        roof_poly_2d,
        Z_ROOF_TOP,
        Z_ROOF_TOP + 0.08,
        mat_top=mat_roof_deck,
        mat_side=mat_roof_fascia,
        mat_bottom=mat_roof_deck,
        parent=root
    )

    # -------------------------------------------------------------
    # 3. RECESSED BUILDING WALLS ("Roof is excess more than the building")
    # All walls sit recessed inside the roof footprint, creating the
    # authentic deep eaves and covered verandas/walkways:
    #   - Front wall is recessed at Y = -11.50m (2.0m deep covered veranda under roof)
    #   - Recessed courtyard wall is at Y = -4.10m (1.4m overhang with DRRMIS banner on eave)
    #   - East wall is at X = +6.80m (1.2m overhang beyond wall with AC units)
    #   - West wall is at X = -7.70m (0.8m overhang along alleyway)
    #   - Rear walls are recessed 0.8m inside each roof step (Y = +2.80m, +4.40m, +5.60m)
    # -------------------------------------------------------------
    wall_poly_2d = [
        (-7.70, -11.50), # W0: Front-Left (SW) corner of front wall
        (+0.50, -11.50), # W1: Front-Right corner of front wall
        (+0.50,  -4.10), # W2: Veranda recess inner corner
        (+6.80,  -4.10), # W3: Corner turning to East flank
        (+6.80,  +2.80), # W4: Northeast corner of East wing
        (+3.40,  +2.80), # W5: Step 1 inner corner
        (+3.40,  +5.60), # W6: Step 2 peak right
        (-0.70,  +5.60), # W7: Step 2 peak left
        (-0.70,  +4.40), # W8: Step 3 inner corner
        (-3.40,  +4.40), # W9: Step 3 left corner
        (-3.40,  +2.80), # W10: Step 4 inner corner
        (-7.70,  +2.80)  # W11: Northwest corner
    ]

    # Solid Foundation Plinth under walls (Z = 0.00 to 0.55m)
    create_extruded_polygon(
        "RSBSA_Wall_Plinth_Grey",
        wall_poly_2d,
        Z_GROUND,
        0.25,
        mat_top=mat_plinth_grey,
        mat_side=mat_plinth_grey,
        mat_bottom=mat_plinth_grey,
        parent=root
    )
    create_extruded_polygon(
        "RSBSA_Wall_Plinth_White",
        wall_poly_2d,
        0.25,
        Z_PLINTH,
        mat_top=mat_plinth_white,
        mat_side=mat_plinth_white,
        mat_bottom=mat_plinth_white,
        parent=root
    )

    # Solid Main Walls (Z = 0.55m to 3.60m)
    # Extends tightly up to roof ceiling soffit at Z = 3.60m: ZERO HOLES!
    create_extruded_polygon(
        "RSBSA_Main_Walls",
        wall_poly_2d,
        Z_PLINTH,
        Z_CEILING,
        mat_top=mat_wall,
        mat_side=mat_wall,
        mat_bottom=mat_wall,
        parent=root
    )

    # -------------------------------------------------------------
    # 4. COVERED FRONT VERANDA & PORCH (IMG_3833 & IMG_3834)
    # Veranda extends from front wall (Y = -11.50m) forward to roof eave (Y = -13.50m)
    # Porch deck at Z = 0.55m, sheltered completely under the flat roof!
    # Underside of veranda roof has dark charcoal soffit with downlights (IMG_3834)
    # -------------------------------------------------------------
    # Raised Veranda Concrete Deck
    veranda_w = 8.80 # from X = -7.70m to +1.10m
    create_box(
        "RSBSA_Veranda_Deck",
        loc=(-3.30, -12.50, Z_PLINTH / 2.0),
        size=(veranda_w, 2.00, Z_PLINTH),
        mat=mat_concrete,
        parent=root
    )
    # Tiled surface
    create_box(
        "RSBSA_Veranda_Tiles",
        loc=(-3.30, -12.50, Z_PLINTH + 0.01),
        size=(veranda_w - 0.04, 1.96, 0.02),
        mat=mat_plinth_white,
        parent=root
    )

    # Charcoal dark soffit lining under front veranda ceiling (IMG_3834)
    create_box(
        "RSBSA_Veranda_Ceiling_Soffit",
        loc=(-3.65, -12.50, Z_CEILING - 0.01),
        size=(9.70, 2.00, 0.02),
        mat=mat_veranda_soffit,
        parent=root
    )
    # Recessed ceiling downlight fixtures (IMG_3834)
    for dl_x in [-6.50, -4.50, -2.50, -0.50]:
        create_box(f"RSBSA_Ceiling_Downlight_{dl_x}", (dl_x, -12.50, Z_CEILING - 0.02), (0.22, 0.22, 0.02), mat_light_glow, root)

    # Central 5-step concrete stair leading down from veranda (IMG_3833)
    num_steps = 5
    stair_width = 2.60
    stair_run_total = 1.30
    step_tread = stair_run_total / num_steps
    step_riser = Z_PLINTH / num_steps
    for s_idx in range(num_steps):
        z_s = (s_idx + 0.5) * step_riser
        y_s = -13.50 - (num_steps - 1 - s_idx) * step_tread
        create_box(
            f"RSBSA_Stair_Step_{s_idx}",
            loc=(-4.50, y_s, z_s),
            size=(stair_width, step_tread, (s_idx + 1) * step_riser),
            mat=mat_concrete,
            parent=root
        )

    # Veranda black metal picket railing along front edge (IMG_3833 & IMG_3834)
    # Left front railing
    create_box("RSBSA_Rail_Left_Top", (-6.75, -13.46, Z_PLINTH + 0.85), (1.90, 0.04, 0.04), mat_metal_black, root)
    create_box("RSBSA_Rail_Left_Bot", (-6.75, -13.46, Z_PLINTH + 0.12), (1.90, 0.04, 0.03), mat_metal_black, root)
    for px in [-7.50, -7.10, -6.75, -6.40, -6.00]:
        create_box(f"RSBSA_Rail_Left_Pick_{px}", (px, -13.46, Z_PLINTH + 0.48), (0.02, 0.02, 0.72), mat_metal_black, root)
    # Right front railing
    create_box("RSBSA_Rail_Right_Top", (-1.85, -13.46, Z_PLINTH + 0.85), (2.70, 0.04, 0.04), mat_metal_black, root)
    create_box("RSBSA_Rail_Right_Bot", (-1.85, -13.46, Z_PLINTH + 0.12), (2.70, 0.04, 0.03), mat_metal_black, root)
    for px in [-3.00, -2.60, -2.20, -1.80, -1.40, -1.00, -0.60]:
        create_box(f"RSBSA_Rail_Right_Pick_{px}", (px, -13.46, Z_PLINTH + 0.48), (0.02, 0.02, 0.72), mat_metal_black, root)

    # Raised planter box along front-right veranda (IMG_3834)
    create_box("RSBSA_Planter_Box", (+0.30, -13.45, Z_PLINTH / 2.0), (1.40, 0.50, Z_PLINTH), mat_plinth_white, root)
    create_box("RSBSA_Planter_Bush", (+0.30, -13.45, Z_PLINTH + 0.25), (1.30, 0.40, 0.40), mat_planter_green, root)

    # -------------------------------------------------------------
    # 5. RECESSED FRONT ENTRANCE FACADE (IMG_3833)
    # On the recessed front wall at Y = -11.50m
    # -------------------------------------------------------------
    # Solid black interior backplate behind entrance doors to prevent any holes
    create_box("RSBSA_Door_Backplate", (-4.50, -11.48, Z_PLINTH + 1.25), (2.10, 0.02, 2.50), mat_glass_back, root)

    # Commercial double frosted doors (bronze frame, silver handles)
    create_box("RSBSA_Door_Frame", (-4.50, -11.52, Z_PLINTH + 1.25), (1.95, 0.08, 2.45), mat_bronze, root)
    create_box("RSBSA_Door_Glass_L", (-4.95, -11.53, Z_PLINTH + 1.10), (0.80, 0.02, 1.90), mat_frosted_glass, root)
    create_box("RSBSA_Door_Glass_R", (-4.05, -11.53, Z_PLINTH + 1.10), (0.80, 0.02, 1.90), mat_frosted_glass, root)
    create_box("RSBSA_Door_Transom", (-4.50, -11.53, Z_PLINTH + 2.25), (1.75, 0.02, 0.35), mat_frosted_glass, root)
    create_box("RSBSA_Door_Handle_L", (-4.60, -11.57, Z_PLINTH + 1.05), (0.03, 0.04, 0.50), mat_metal_silver, root)
    create_box("RSBSA_Door_Handle_R", (-4.40, -11.57, Z_PLINTH + 1.05), (0.03, 0.04, 0.50), mat_metal_silver, root)

    # Flanking Stacked Stone Veneer Pilasters (IMG_3833)
    create_box("RSBSA_Pilaster_Left", (-5.70, -11.58, (Z_PLINTH + Z_CEILING) / 2.0), (0.50, 0.22, Z_CEILING - Z_PLINTH), mat_stone, root)
    create_box("RSBSA_Pilaster_Right", (-3.30, -11.58, (Z_PLINTH + Z_CEILING) / 2.0), (0.50, 0.22, Z_CEILING - Z_PLINTH), mat_stone, root)
    for zb in [1.2, 1.8, 2.4, 3.0]:
        create_box(f"RSBSA_Stone_Band_L_{zb}", (-5.70, -11.59, Z_PLINTH + zb), (0.52, 0.23, 0.04), mat_stone_accent, root)
        create_box(f"RSBSA_Stone_Band_R_{zb}", (-3.30, -11.59, Z_PLINTH + zb), (0.52, 0.23, 0.04), mat_stone_accent, root)

    # Solid White Concrete Entrance Canopy Slab over doors
    create_box("RSBSA_Entrance_Canopy", (-4.50, -12.10, 3.12), (3.30, 1.30, 0.16), mat_plinth_white, root)

    # Official RSBSA Office Signage Board above doors (IMG_3833)
    create_box("RSBSA_Sign_Board", (-4.50, -11.56, 3.38), (2.60, 0.04, 0.36), mat_sign_white, root)
    create_box("RSBSA_Sign_TextBand", (-4.50, -11.58, 3.38), (2.50, 0.02, 0.26), mat_sign_green, root)

    # Large 4-Pane Commercial Sliding Windows (Left & Right of doors, IMG_3833)
    # Left front window (West)
    create_box("RSBSA_Win_FrontL_Back", (-6.80, -11.48, Z_PLINTH + 1.25), (1.60, 0.02, 1.60), mat_glass_back, root)
    create_box("RSBSA_Win_FrontL_Frame", (-6.80, -11.52, Z_PLINTH + 1.25), (1.55, 0.06, 1.55), mat_bronze, root)
    create_box("RSBSA_Win_FrontL_Glass", (-6.80, -11.53, Z_PLINTH + 1.25), (1.45, 0.02, 1.45), mat_glass, root)
    create_box("RSBSA_Win_FrontL_MullV", (-6.80, -11.54, Z_PLINTH + 1.25), (0.04, 0.04, 1.45), mat_bronze, root)
    create_box("RSBSA_Win_FrontL_MullH", (-6.80, -11.54, Z_PLINTH + 1.25), (1.45, 0.04, 0.04), mat_bronze, root)

    # Right front window (East)
    create_box("RSBSA_Win_FrontR_Back", (-1.40, -11.48, Z_PLINTH + 1.25), (3.20, 0.02, 1.60), mat_glass_back, root)
    create_box("RSBSA_Win_FrontR_Frame", (-1.40, -11.52, Z_PLINTH + 1.25), (3.15, 0.06, 1.55), mat_bronze, root)
    create_box("RSBSA_Win_FrontR_Glass", (-1.40, -11.53, Z_PLINTH + 1.25), (3.05, 0.02, 1.45), mat_glass, root)
    for mx in [-2.15, -1.40, -0.65]:
        create_box(f"RSBSA_Win_FrontR_MullV_{mx}", (mx, -11.54, Z_PLINTH + 1.25), (0.04, 0.04, 1.45), mat_bronze, root)
    create_box("RSBSA_Win_FrontR_MullH", (-1.40, -11.54, Z_PLINTH + 1.25), (3.05, 0.04, 0.04), mat_bronze, root)

    # -------------------------------------------------------------
    # 6. RECESSED COURTYARD & DRRMIS 2.0 BANNER (IMG_3835)
    # Roof eave extends to Y = -5.50m!
    # Wall is recessed at Y = -4.10m (1.40m deep white spandrel overhang)
    # Features:
    #   - Green DRRMIS 2.0 banner hanging from front eave beam at Y = -5.50m
    #   - 3 tall narrow bronze-framed awning windows on the wall
    #   - Concrete planter box at the wall base
    # -------------------------------------------------------------
    # Green DRRMIS 2.0 banner hanging from the front roof eave beam (IMG_3835)
    create_box("RSBSA_DRRMIS_Banner", (+4.00, -5.52, 3.25), (2.80, 0.04, 0.60), mat_banner_green, root)
    create_box("RSBSA_DRRMIS_Text", (+4.00, -5.54, 3.25), (2.60, 0.02, 0.40), mat_sign_white, root)

    # 3 tall narrow bronze-framed awning windows on recessed wall (Y = -4.10m)
    for idx, wx in enumerate([+2.20, +3.60, +5.00]):
        create_box(f"RSBSA_Win_Narrow_Back_{idx}", (wx, -4.08, Z_PLINTH + 1.20), (0.80, 0.02, 1.80), mat_glass_back, root)
        create_box(f"RSBSA_Win_Narrow_Frame_{idx}", (wx, -4.12, Z_PLINTH + 1.20), (0.75, 0.06, 1.75), mat_bronze, root)
        create_box(f"RSBSA_Win_Narrow_Glass_{idx}", (wx, -4.13, Z_PLINTH + 1.20), (0.65, 0.02, 1.65), mat_glass, root)
        # 3 stacked horizontal panes (IMG_3835)
        create_box(f"RSBSA_Win_Narrow_H1_{idx}", (wx, -4.14, Z_PLINTH + 0.65), (0.65, 0.03, 0.03), mat_bronze, root)
        create_box(f"RSBSA_Win_Narrow_H2_{idx}", (wx, -4.14, Z_PLINTH + 1.75), (0.65, 0.03, 0.03), mat_bronze, root)

    # Concrete planter box at base of 3 windows (IMG_3835)
    create_box("RSBSA_Courtyard_Planter", (+3.60, -4.35, Z_PLINTH / 2.0), (3.80, 0.45, Z_PLINTH), mat_plinth_white, root)
    create_box("RSBSA_Courtyard_Bush", (+3.60, -4.35, Z_PLINTH + 0.20), (3.70, 0.35, 0.35), mat_planter_green, root)

    # -------------------------------------------------------------
    # 7. EAST FLANK WALL & AC CONDENSERS (IMG_3835)
    # Roof eave extends to X = +8.00m!
    # East wall is recessed at X = +6.80m (1.20m wide white spandrel overhang!)
    # Features:
    #   - High wall-mounted LG split AC condenser on steel shelf brackets
    #   - Red and blue insulated refrigerant piping running down wall
    #   - Ground-level split AC condenser on concrete equipment pad
    # -------------------------------------------------------------
    ac_wall_y = -0.50
    ac_wall_z = 2.45
    # High wall-mounted LG split AC condenser (mounted on wall at X = +6.80m)
    create_box("RSBSA_AC_Wall_Body", (+7.15, ac_wall_y, ac_wall_z), (0.50, 0.90, 0.65), mat_ac_white, root)
    create_box("RSBSA_AC_Wall_Grille", (+7.41, ac_wall_y - 0.10, ac_wall_z), (0.02, 0.45, 0.45), mat_ac_grille, root)
    create_box("RSBSA_AC_Wall_Logo", (+7.41, ac_wall_y + 0.25, ac_wall_z + 0.18), (0.02, 0.12, 0.12), mat_ac_red, root)
    # Steel cantilever shelf brackets
    create_box("RSBSA_AC_Bracket_1", (+7.00, ac_wall_y - 0.35, ac_wall_z - 0.38), (0.45, 0.05, 0.12), mat_metal_black, root)
    create_box("RSBSA_AC_Bracket_2", (+7.00, ac_wall_y + 0.35, ac_wall_z - 0.38), (0.45, 0.05, 0.12), mat_metal_black, root)

    # Red & Blue insulated refrigerant lines running down the wall (IMG_3835)
    pipe_y = ac_wall_y + 0.20
    pipe_len = ac_wall_z - 0.55
    create_box("RSBSA_AC_Pipe_Red", (+6.85, pipe_y - 0.03, (ac_wall_z + 0.55) / 2.0), (0.03, 0.03, pipe_len), mat_ac_red, root)
    create_box("RSBSA_AC_Pipe_Blue", (+6.85, pipe_y + 0.03, (ac_wall_z + 0.55) / 2.0), (0.03, 0.03, pipe_len), mat_ac_blue, root)

    # Ground-level split AC condenser on concrete pad (IMG_3835)
    ac_gnd_y = -2.60
    create_box("RSBSA_AC_Gnd_Pad", (+7.20, ac_gnd_y, 0.10), (0.65, 1.05, 0.20), mat_concrete, root)
    create_box("RSBSA_AC_Gnd_Body", (+7.20, ac_gnd_y, 0.55), (0.45, 0.85, 0.65), mat_ac_white, root)
    create_box("RSBSA_AC_Gnd_Grille", (+7.43, ac_gnd_y - 0.08, 0.55), (0.02, 0.42, 0.42), mat_ac_grille, root)

    # -------------------------------------------------------------
    # 8. STEPPED REAR FACADE (IMG_3836)
    # Walls are recessed 0.80m under each stepped roof eave:
    #   - West wing: 2 bathroom louver windows with sloped hoods
    #   - Mid wing: 2-panel sliding window with sloped hood
    #   - Corner PVC downspouts
    # -------------------------------------------------------------
    # 2 Bathroom louver windows on West wing (IMG_3836)
    for idx, bx in enumerate([-6.40, -4.60]):
        create_box(f"RSBSA_Win_Bath_Back_{idx}", (bx, +2.78, Z_PLINTH + 1.45), (0.65, 0.02, 0.65), mat_glass_back, root)
        create_box(f"RSBSA_Win_Bath_Frame_{idx}", (bx, +2.82, Z_PLINTH + 1.45), (0.60, 0.06, 0.60), mat_bronze, root)
        create_box(f"RSBSA_Win_Bath_Glass_{idx}", (bx, +2.83, Z_PLINTH + 1.45), (0.50, 0.02, 0.50), mat_frosted_glass, root)
        create_box(f"RSBSA_Win_Bath_Hood_{idx}", (bx, +2.95, Z_PLINTH + 1.85), (0.80, 0.25, 0.06), mat_plinth_white, root)

    # 2-Panel sliding window on Mid wing (Y = +4.40m, IMG_3836)
    create_box("RSBSA_Win_RearMid_Back", (-2.00, +4.38, Z_PLINTH + 1.25), (1.55, 0.02, 1.25), mat_glass_back, root)
    create_box("RSBSA_Win_RearMid_Frame", (-2.00, +4.42, Z_PLINTH + 1.25), (1.50, 0.06, 1.20), mat_bronze, root)
    create_box("RSBSA_Win_RearMid_Glass", (-2.00, +4.43, Z_PLINTH + 1.25), (1.40, 0.02, 1.10), mat_glass, root)
    create_box("RSBSA_Win_RearMid_Mull", (-2.00, +4.44, Z_PLINTH + 1.25), (0.04, 0.04, 1.10), mat_bronze, root)
    create_box("RSBSA_Win_RearMid_Hood", (-2.00, +4.56, Z_PLINTH + 1.92), (1.70, 0.28, 0.06), mat_plinth_white, root)

    # Corner PVC vertical downspouts running from roof soffit to grade along walls
    downspout_corners = [
        (-7.75, +2.85),
        (+6.85, +2.85),
        (+3.45, +5.65),
        (-0.65, +5.65)
    ]
    for idx, (dx, dy) in enumerate(downspout_corners):
        create_box(
            f"RSBSA_Downspout_{idx}",
            (dx, dy, (Z_CEILING + Z_GROUND) / 2.0),
            (0.08, 0.08, Z_CEILING - Z_GROUND),
            mat_plinth_white,
            root
        )

    # -------------------------------------------------------------
    # 9. BATCH MERGE BY MATERIAL (Performance & Strict Size Budget)
    # -------------------------------------------------------------
    bpy.ops.object.select_all(action='DESELECT')
    for obj in list(root.children):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root.children[0] if root.children else None

    mat_groups = {}
    for obj in list(root.children):
        if obj.type == 'MESH':
            mat_name = obj.data.materials[0].name if obj.data.materials else "NoMat"
            if len(obj.data.materials) > 1:
                continue
            mat_groups.setdefault(mat_name, []).append(obj)

    for mat_name, objs in mat_groups.items():
        if len(objs) > 1:
            bpy.ops.object.select_all(action='DESELECT')
            for o in objs:
                o.select_set(True)
            bpy.context.view_layer.objects.active = objs[0]
            bpy.ops.object.join()
            merged = bpy.context.active_object
            merged.name = f"RSBSA_Merged_{mat_name}"
            merged.parent = root

    # -------------------------------------------------------------
    # 10. EXPORT TO GLB
    # -------------------------------------------------------------
    os.makedirs(os.path.dirname(TARGET_GLB), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=TARGET_GLB,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True
    )

    size_kb = os.path.getsize(TARGET_GLB) / 1024.0
    print(f"✅ Successfully exported RSBSA Building model:")
    print(f"   Target: {TARGET_GLB}")
    print(f"   Size:   {size_kb:.1f} KB (budget: <= 300 KB)")

build_rsbsa_building()
