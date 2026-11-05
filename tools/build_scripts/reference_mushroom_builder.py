import bpy
import bmesh
import math
import os

TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\mushroom_laboratory.glb"

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
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_cylinder(name, loc, radius, depth, rot=(0, 0, 0), mat=None, parent=None, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.clear()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_prism_along_x(name, v1, v2, v3, thickness_x, mat=None, parent=None):
    """Watertight triangular prism extrusion along X axis with outwards-recalculated normals.
    v1, v2, v3 are (y, z) pairs defining the triangle in the YZ plane.
    """
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    x_half = thickness_x / 2.0
    verts = [
        (-x_half, v1[0], v1[1]),
        (-x_half, v2[0], v2[1]),
        (-x_half, v3[0], v3[1]),
        ( x_half, v1[0], v1[1]),
        ( x_half, v2[0], v2[1]),
        ( x_half, v3[0], v3[1]),
    ]
    faces = [
        (0, 1, 2),
        (3, 5, 4),
        (0, 3, 4, 1),
        (1, 4, 5, 2),
        (2, 5, 3, 0),
    ]
    mesh.from_pydata(verts, [], faces)
    
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mesh.update()
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def build_mushroom_laboratory():
    clear_scene()

    # Materials calibrated to ground-truth field photographs (IMG_3904, IMG_3905, IMG_3906, IMG_3907)
    # Warm pale cream / off-white stucco finish
    mat_wall_cream = get_or_create_material("ML_WallCream", (0.92, 0.90, 0.84, 1.0), roughness=0.70)
    # Weathered foundation concrete plinth skirt
    mat_plinth_grey = get_or_create_material("ML_PlinthGrey", (0.55, 0.53, 0.50, 1.0), roughness=0.85)
    # Concrete steps & threshold landing
    mat_concrete_steps = get_or_create_material("ML_ConcreteSteps", (0.68, 0.66, 0.62, 1.0), roughness=0.80)
    
    # Roof: Dark forest green / teal corrugated metal sheet & trim
    mat_roof_teal = get_or_create_material("ML_RoofTeal", (0.12, 0.28, 0.22, 1.0), roughness=0.40, metallic=0.25)
    # Matching dark teal metal fascia boards and rakes
    mat_fascia_teal = get_or_create_material("ML_FasciaTeal", (0.10, 0.24, 0.18, 1.0), roughness=0.40, metallic=0.25)
    # White eave soffit underside panels
    mat_soffit_white = get_or_create_material("ML_SoffitWhite", (0.88, 0.88, 0.86, 1.0), roughness=0.50)
    
    # Main Entrance Timber Door & Trims
    mat_door_brown = get_or_create_material("ML_DoorDarkBrown", (0.20, 0.12, 0.08, 1.0), roughness=0.45)
    mat_door_frame = get_or_create_material("ML_DoorFrame", (0.14, 0.10, 0.07, 1.0), roughness=0.35)
    mat_door_panel = get_or_create_material("ML_DoorPanel", (0.24, 0.15, 0.10, 1.0), roughness=0.50)
    mat_metal_silver = get_or_create_material("ML_MetalSilver", (0.82, 0.83, 0.85, 1.0), roughness=0.25, metallic=0.85)
    
    # Windows & Security Grilles
    mat_win_frame = get_or_create_material("ML_WinFrame", (0.18, 0.16, 0.14, 1.0), roughness=0.30, metallic=0.7)
    mat_glass_tint = get_or_create_material("ML_GlassTinted", (0.10, 0.18, 0.22, 1.0), roughness=0.08, metallic=0.4)
    mat_grille_white = get_or_create_material("ML_GrilleWhite", (0.92, 0.92, 0.92, 1.0), roughness=0.30)
    
    # Signboard & Dedication Plaque
    mat_sign_plate = get_or_create_material("ML_SignPlate", (0.94, 0.95, 0.94, 1.0), roughness=0.35)
    mat_sign_green = get_or_create_material("ML_SignGreen", (0.08, 0.24, 0.14, 1.0), roughness=0.30)
    mat_plaque_silver = get_or_create_material("ML_PlaqueSilver", (0.82, 0.83, 0.85, 1.0), roughness=0.20, metallic=0.85)
    mat_plaque_dark = get_or_create_material("ML_PlaqueDark", (0.12, 0.12, 0.14, 1.0), roughness=0.40)

    # Mechanical AC Unit
    mat_ac_casing = get_or_create_material("ML_ACCasing", (0.86, 0.85, 0.82, 1.0), roughness=0.45)
    mat_ac_louver = get_or_create_material("ML_ACLouver", (0.22, 0.22, 0.24, 1.0), roughness=0.50)
    mat_ac_bracket = get_or_create_material("ML_ACBracket", (0.35, 0.35, 0.38, 1.0), roughness=0.40, metallic=0.7)

    # Root object
    root = bpy.data.objects.new("MushroomLab_Root", None)
    bpy.context.collection.objects.link(root)

    # DIMENSIONS & GEOMETRY (Calibrated to buildings.json 4-vertex footprint & roads.json entrance)
    # Width along X (front facade width): 8.70 m
    # Depth along Y (front to back): 8.20 m
    W = 8.70
    D = 8.20
    X_LEFT = -W / 2.0    # -4.35 m
    X_RIGHT = W / 2.0    # +4.35 m
    Y_FRONT = -D / 2.0   # -4.10 m (facing entrance)
    Y_REAR = D / 2.0     # +4.10 m
    
    H_PLINTH = 0.35      # Foundation plinth skirt
    H_EAVE = 2.90        # Main exterior wall eave height
    H_RIDGE = 3.85       # Centered apex ridge height at Y = 0.0

    # 1. FOUNDATION PLINTH SKIRT (Grey concrete skirt slightly expanded for authentic ground trim)
    PLINTH_EXP = 0.04
    create_box("ML_PlinthSkirt",
               (0.0, 0.0, H_PLINTH / 2.0),
               (W + PLINTH_EXP * 2, D + PLINTH_EXP * 2, H_PLINTH),
               mat=mat_plinth_grey, parent=root)

    # 2. MAIN EXTERIOR WALLS (Solid rectangular bungalow body up to eave level)
    wall_h = H_EAVE - H_PLINTH
    create_box("ML_MainWalls",
               (0.0, 0.0, H_PLINTH + wall_h / 2.0),
               (W, D, wall_h),
               mat=mat_wall_cream, parent=root)

    # 3. SOLID ATTACHED SYMMETRICAL GABLE WALLS (100% Watertight, Zero Gaps)
    # The ridge runs along X at Y = 0.0. The left and right ends are triangular gable walls!
    # Left triangular gable wall sitting directly on top of left wall at X_LEFT:
    gable_left = create_prism_along_x("ML_GableLeftWall",
                                      v1=(Y_FRONT, H_EAVE),
                                      v2=(0.00, H_RIDGE),
                                      v3=(Y_REAR, H_EAVE),
                                      thickness_x=0.25,
                                      mat=mat_wall_cream, parent=root)
    gable_left.location.x = X_LEFT + 0.125

    # Right triangular gable wall sitting directly on top of right wall at X_RIGHT:
    gable_right = create_prism_along_x("ML_GableRightWall",
                                       v1=(Y_FRONT, H_EAVE),
                                       v2=(0.00, H_RIDGE),
                                       v3=(Y_REAR, H_EAVE),
                                       thickness_x=0.25,
                                       mat=mat_wall_cream, parent=root)
    gable_right.location.x = X_RIGHT - 0.125

    # 4. ROOF STRUCTURE & FASCIAS (Transversal Gable with Front and Rear Downward Slopes)
    OVERHANG_FRONT = 0.50
    OVERHANG_SIDE = 0.40
    ROOF_THICKNESS = 0.06
    
    roof_w = W + OVERHANG_SIDE * 2  # Total roof width along X
    
    # Front slope: from ridge (Y=0, Z=H_RIDGE) down to front eave (Y=Y_FRONT - OVERHANG_FRONT, Z=H_EAVE)
    slope_front_len = math.hypot(abs(Y_FRONT) + OVERHANG_FRONT, H_RIDGE - H_EAVE)
    angle_front = math.atan2(H_RIDGE - H_EAVE, abs(Y_FRONT) + OVERHANG_FRONT)
    
    # Front Roof Slab
    mid_y_f = (0.0 + (Y_FRONT - OVERHANG_FRONT)) / 2.0
    mid_z_f = (H_RIDGE + H_EAVE) / 2.0
    roof_f = create_box("ML_RoofSlopeFront",
                        (0.0, mid_y_f, mid_z_f),
                        (roof_w, slope_front_len, ROOF_THICKNESS),
                        mat=mat_roof_teal, parent=root)
    roof_f.rotation_euler = (angle_front, 0.0, 0.0)

    # Front Soffit Panel (white ceiling underneath eave overhang)
    soffit_f = create_box("ML_SoffitFront",
                          (0.0, Y_FRONT - OVERHANG_FRONT / 2.0, H_EAVE - 0.04),
                          (W, OVERHANG_FRONT, 0.03),
                          mat=mat_soffit_white, parent=root)

    # Front Horizontal Fascia Eave Cap
    fascia_f = create_box("ML_FasciaFront",
                          (0.0, Y_FRONT - OVERHANG_FRONT, H_EAVE + 0.02),
                          (roof_w + 0.04, 0.05, 0.16),
                          mat=mat_fascia_teal, parent=root)

    # Rear slope: from ridge (Y=0, Z=H_RIDGE) down to rear eave (Y=Y_REAR + OVERHANG_FRONT, Z=H_EAVE)
    mid_y_r = (0.0 + (Y_REAR + OVERHANG_FRONT)) / 2.0
    mid_z_r = (H_RIDGE + H_EAVE) / 2.0
    roof_r = create_box("ML_RoofSlopeRear",
                        (0.0, mid_y_r, mid_z_r),
                        (roof_w, slope_front_len, ROOF_THICKNESS),
                        mat=mat_roof_teal, parent=root)
    roof_r.rotation_euler = (-angle_front, 0.0, 0.0)

    # Rear Soffit Panel
    soffit_r = create_box("ML_SoffitRear",
                          (0.0, Y_REAR + OVERHANG_FRONT / 2.0, H_EAVE - 0.04),
                          (W, OVERHANG_FRONT, 0.03),
                          mat=mat_soffit_white, parent=root)

    # Rear Horizontal Fascia Eave Cap
    fascia_r = create_box("ML_FasciaRear",
                          (0.0, Y_REAR + OVERHANG_FRONT, H_EAVE + 0.02),
                          (roof_w + 0.04, 0.05, 0.16),
                          mat=mat_fascia_teal, parent=root)

    # Apex Ridge Cap running along X
    create_box("ML_RoofRidgeCap",
               (0.0, 0.0, H_RIDGE + 0.035),
               (roof_w + 0.06, 0.28, 0.05),
               mat=mat_fascia_teal, parent=root)

    # Left & Right Gable Fascia Rakes (inclined bargeboards along roof slopes)
    rake_len = slope_front_len + 0.08
    for side_x, side_name in [(X_LEFT - OVERHANG_SIDE, "Left"), (X_RIGHT + OVERHANG_SIDE, "Right")]:
        # Front-half rake
        r_f = create_box(f"ML_FasciaRake_{side_name}_Front",
                         (side_x, mid_y_f, mid_z_f + 0.01),
                         (0.05, rake_len, 0.16),
                         mat=mat_fascia_teal, parent=root)
        r_f.rotation_euler = (angle_front, 0.0, 0.0)
        
        # Rear-half rake
        r_r = create_box(f"ML_FasciaRake_{side_name}_Rear",
                         (side_x, mid_y_r, mid_z_r + 0.01),
                         (0.05, rake_len, 0.16),
                         mat=mat_fascia_teal, parent=root)
        r_r.rotation_euler = (-angle_front, 0.0, 0.0)

        # White side soffit
        create_box(f"ML_SoffitSide_{side_name}",
                   (side_x + (OVERHANG_SIDE/2.0 if side_name == "Left" else -OVERHANG_SIDE/2.0), 0.0, H_EAVE - 0.04),
                   (OVERHANG_SIDE, D, 0.03),
                   mat=mat_soffit_white, parent=root)

    # 5. FRONT ENTRANCE FACADE (Facing -Y towards entrance node)
    # Centered entrance door: width 1.05m, height 2.15m
    DOOR_W = 1.05
    DOOR_H = 2.15
    DOOR_X = 0.0
    door_y = Y_FRONT - 0.01

    # Entrance Landing Concrete Step Threshold
    STEP_W = 1.35
    STEP_D = 0.45
    STEP_H = 0.12
    create_box("ML_EntranceStep",
               (DOOR_X, Y_FRONT - STEP_D / 2.0, STEP_H / 2.0),
               (STEP_W, STEP_D, STEP_H),
               mat=mat_concrete_steps, parent=root)
    # Red-brown tile threshold edge
    create_box("ML_EntranceThresholdTile",
               (DOOR_X, Y_FRONT - 0.08, STEP_H + 0.01),
               (DOOR_W + 0.08, 0.14, 0.02),
               mat=mat_door_brown, parent=root)

    # Dark Door Frame
    create_box("ML_DoorOuterFrame",
               (DOOR_X, door_y, H_PLINTH + DOOR_H / 2.0),
               (DOOR_W + 0.10, 0.08, DOOR_H + 0.05),
               mat=mat_door_frame, parent=root)

    # Main Door Leaf (Dark brown timber)
    create_box("ML_DoorLeaf",
               (DOOR_X, door_y - 0.02, H_PLINTH + DOOR_H / 2.0),
               (DOOR_W, 0.04, DOOR_H),
               mat=mat_door_brown, parent=root)

    # Raised decorative door panels (4 recessed/raised panels & carved middle strip)
    panel_w = (DOOR_W - 0.22) / 2.0  # ~0.41m
    # Top panels
    for px in [-panel_w / 2.0 - 0.03, panel_w / 2.0 + 0.03]:
        create_box(f"ML_DoorPanel_Top_{px:.2f}",
                   (DOOR_X + px, door_y - 0.035, H_PLINTH + 1.62),
                   (panel_w, 0.015, 0.65),
                   mat=mat_door_panel, parent=root)
    # Carved floral center strip
    create_box("ML_DoorPanel_CenterStrip",
               (DOOR_X, door_y - 0.035, H_PLINTH + 1.15),
               (DOOR_W - 0.12, 0.015, 0.14),
               mat=mat_door_panel, parent=root)
    # Bottom panels
    for px in [-panel_w / 2.0 - 0.03, panel_w / 2.0 + 0.03]:
        create_box(f"ML_DoorPanel_Bottom_{px:.2f}",
                   (DOOR_X + px, door_y - 0.035, H_PLINTH + 0.58),
                   (panel_w, 0.015, 0.80),
                   mat=mat_door_panel, parent=root)
    # Metallic Door Knob
    create_cylinder("ML_DoorKnob",
                    (DOOR_X + DOOR_W / 2.0 - 0.10, door_y - 0.045, H_PLINTH + 1.05),
                    radius=0.03, depth=0.05, rot=(math.pi/2, 0, 0),
                    mat=mat_metal_silver, parent=root)

    # 6. OVERHEAD SIGNBOARD ("•MUSHROOM LABORATORY•")
    SIGN_W = 1.60
    SIGN_H = 0.22
    SIGN_Z = H_PLINTH + DOOR_H + 0.18
    # Signboard Backing Plaque
    create_box("ML_SignboardBacking",
               (DOOR_X, Y_FRONT - 0.025, SIGN_Z),
               (SIGN_W, 0.04, SIGN_H),
               mat=mat_sign_plate, parent=root)
    # Green border rim
    create_box("ML_SignboardBorder",
               (DOOR_X, Y_FRONT - 0.035, SIGN_Z),
               (SIGN_W - 0.04, 0.01, SIGN_H - 0.04),
               mat=mat_door_frame, parent=root)
    # White inner field
    create_box("ML_SignboardInner",
               (DOOR_X, Y_FRONT - 0.04, SIGN_Z),
               (SIGN_W - 0.08, 0.01, SIGN_H - 0.08),
               mat=mat_sign_plate, parent=root)
    # Dark green central embossed title strip
    create_box("ML_SignboardTextBar",
               (DOOR_X, Y_FRONT - 0.045, SIGN_Z),
               (SIGN_W - 0.18, 0.008, 0.08),
               mat=mat_sign_green, parent=root)

    # 7. OFFICIAL DEDICATION PLAQUE (Right of door per IMG_3905 & IMG_3906)
    PLAQUE_W = 0.55
    PLAQUE_H = 0.75
    PLAQUE_X = DOOR_X + 1.05
    PLAQUE_Z = 1.60
    # Silver Metallic Plate
    create_box("ML_DedicationPlaque",
               (PLAQUE_X, Y_FRONT - 0.02, PLAQUE_Z),
               (PLAQUE_W, 0.025, PLAQUE_H),
               mat=mat_plaque_silver, parent=root)
    # Engraved dark header band with DA seals representation
    create_box("ML_PlaqueHeaderBand",
               (PLAQUE_X, Y_FRONT - 0.032, PLAQUE_Z + PLAQUE_H/2.0 - 0.08),
               (PLAQUE_W - 0.08, 0.005, 0.06),
               mat=mat_plaque_dark, parent=root)
    # Engraved text horizontal relief lines
    for line_idx in range(7):
        lz = PLAQUE_Z + 0.18 - line_idx * 0.065
        lw = (PLAQUE_W - 0.12) if line_idx % 2 == 0 else (PLAQUE_W - 0.22)
        create_box(f"ML_PlaqueTextLine_{line_idx}",
                   (PLAQUE_X, Y_FRONT - 0.032, lz),
                   (lw, 0.005, 0.02),
                   mat=mat_plaque_dark, parent=root)

    # 8. WINDOW BUILDER HELPER (Commercial frame, tinted glass, white security grilles)
    def add_window(name, loc, size, orientation="FRONT"):
        """Creates an authentic laboratory window with white security grilles.
        size is (width, height)
        orientation: FRONT/REAR (grille along X), LEFT/RIGHT (grille along Y)
        """
        w, h = size
        cx, cy, cz = loc
        
        if orientation in ["FRONT", "REAR"]:
            thick_y = 0.06
            # Window Frame
            create_box(f"{name}_Frame", (cx, cy, cz), (w, thick_y, h), mat=mat_win_frame, parent=root)
            # Tinted Glass Pane
            create_box(f"{name}_Glass", (cx, cy, cz), (w - 0.08, thick_y - 0.02, h - 0.08), mat=mat_glass_tint, parent=root)
            # Center Vertical Muntin Divider
            create_box(f"{name}_Muntin", (cx, cy - 0.015, cz), (0.04, thick_y, h - 0.06), mat=mat_win_frame, parent=root)
            # Exterior White Security Grille (Horizontal bars)
            grille_y = cy - 0.035 if orientation == "FRONT" else cy + 0.035
            create_box(f"{name}_GrilleFrame", (cx, grille_y, cz), (w + 0.04, 0.02, h + 0.04), mat=mat_grille_white, parent=root)
            # 4 Horizontal Grille Bars
            for bi in range(4):
                bz = cz - h/2.0 + 0.12 + bi * ((h - 0.24) / 3.0)
                create_cylinder(f"{name}_BarH_{bi}", (cx, grille_y, bz), radius=0.009, depth=w + 0.02, rot=(0, math.pi/2, 0), mat=mat_grille_white, parent=root)
            # 3 Vertical Grille Bars
            for vi in [-w/3.0, 0.0, w/3.0]:
                create_cylinder(f"{name}_BarV_{vi:.2f}", (cx + vi, grille_y, cz), radius=0.009, depth=h + 0.02, rot=(0, 0, 0), mat=mat_grille_white, parent=root)
                
        else: # LEFT / RIGHT
            thick_x = 0.06
            # Window Frame
            create_box(f"{name}_Frame", (cx, cy, cz), (thick_x, w, h), mat=mat_win_frame, parent=root)
            # Tinted Glass Pane
            create_box(f"{name}_Glass", (cx, cy, cz), (thick_x - 0.02, w - 0.08, h - 0.08), mat=mat_glass_tint, parent=root)
            # Center Divider
            create_box(f"{name}_Muntin", (cx + (-0.015 if orientation=="LEFT" else 0.015), cy, cz), (thick_x, 0.04, h - 0.06), mat=mat_win_frame, parent=root)
            # Exterior White Security Grille
            grille_x = cx - 0.035 if orientation == "LEFT" else cx + 0.035
            create_box(f"{name}_GrilleFrame", (grille_x, cy, cz), (0.02, w + 0.04, h + 0.04), mat=mat_grille_white, parent=root)
            # Horizontal bars
            for bi in range(4):
                bz = cz - h/2.0 + 0.12 + bi * ((h - 0.24) / 3.0)
                create_cylinder(f"{name}_BarH_{bi}", (grille_x, cy, bz), radius=0.009, depth=w + 0.02, rot=(math.pi/2, 0, 0), mat=mat_grille_white, parent=root)
            # Vertical bars
            for vi in [-w/3.0, 0.0, w/3.0]:
                create_cylinder(f"{name}_BarV_{vi:.2f}", (grille_x, cy + vi, cz), radius=0.009, depth=h + 0.02, rot=(0, 0, 0), mat=mat_grille_white, parent=root)

    # FRONT WINDOWS (Flanking the center door)
    WIN_W = 1.35
    WIN_H = 1.15
    WIN_Z = 1.65
    add_window("ML_FrontWin_Left", (-2.65, Y_FRONT - 0.01, WIN_Z), (WIN_W, WIN_H), orientation="FRONT")
    add_window("ML_FrontWin_Right", (+2.70, Y_FRONT - 0.01, WIN_Z), (WIN_W, WIN_H), orientation="FRONT")

    # Foundation Concrete Planter Curb along Front (IMG_3905)
    create_box("ML_FrontPlanter_Left",
               (-2.65, Y_FRONT - 0.25, 0.20),
               (2.80, 0.40, 0.40),
               mat=mat_concrete_steps, parent=root)
    create_box("ML_FrontPlanter_Right",
               (+2.70, Y_FRONT - 0.25, 0.20),
               (2.80, 0.40, 0.40),
               mat=mat_concrete_steps, parent=root)

    # 9. LEFT FACADE (IMG_3907: Two windows + Wall-mounted Aircon Unit)
    SIDE_WIN_W = 1.15
    add_window("ML_LeftWin_Front", (X_LEFT + 0.01, -1.80, WIN_Z), (SIDE_WIN_W, WIN_H), orientation="LEFT")
    add_window("ML_LeftWin_Rear", (X_LEFT + 0.01, +1.80, WIN_Z), (SIDE_WIN_W, WIN_H), orientation="LEFT")

    # Wall-Mounted Aircon Unit on Left Wall (adjacent to rear window per IMG_3907)
    AC_W = 0.62   # along Y
    AC_D = 0.48   # projecting outward along X
    AC_H = 0.44   # height
    AC_X = X_LEFT - AC_D / 2.0 - 0.02
    AC_Y = +2.85
    AC_Z = 1.70
    # AC Metal Housing Casing
    create_box("ML_AirconCasing",
               (AC_X, AC_Y, AC_Z),
               (AC_D, AC_W, AC_H),
               mat=mat_ac_casing, parent=root)
    # AC Front-Face Dark Louver Grill
    create_box("ML_AirconGrille",
               (AC_X - AC_D/2.0 - 0.01, AC_Y, AC_Z),
               (0.02, AC_W - 0.06, AC_H - 0.06),
               mat=mat_ac_louver, parent=root)
    # AC Triangular Heavy-Duty Wall Brackets underneath
    for by_offset in [-AC_W/2.0 + 0.06, AC_W/2.0 - 0.06]:
        create_box(f"ML_AirconBracket_{by_offset:.2f}",
                   (X_LEFT - AC_D/2.0, AC_Y + by_offset, AC_Z - AC_H/2.0 - 0.10),
                   (AC_D, 0.04, 0.18),
                   mat=mat_ac_bracket, parent=root)

    # 10. RIGHT FACADE (IMG_3904: Two windows)
    add_window("ML_RightWin_Front", (X_RIGHT - 0.01, -1.80, WIN_Z), (SIDE_WIN_W, WIN_H), orientation="RIGHT")
    add_window("ML_RightWin_Rear", (X_RIGHT - 0.01, +1.80, WIN_Z), (SIDE_WIN_W, WIN_H), orientation="RIGHT")

    # 11. BATCH JOIN BY MATERIAL & EXPORT GLB
    bpy.ops.object.select_all(action='DESELECT')
    mesh_objs = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    mat_map = {}
    for obj in mesh_objs:
        mname = obj.data.materials[0].name if len(obj.data.materials) > 0 else "Default"
        mat_map.setdefault(mname, []).append(obj)

    print(f"Batch joining {len(mesh_objs)} objects across {len(mat_map)} materials...")
    joined_objs = []
    for mname, objs in mat_map.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objs:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        active = bpy.context.active_object
        active.name = f"ML_Batch_{mname}"
        joined_objs.append(active)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in joined_objs:
        obj.select_set(True)
    
    os.makedirs(os.path.dirname(TARGET_GLB), exist_ok=True)

    print(f"Exporting to {TARGET_GLB}...")
    bpy.ops.export_scene.gltf(
        filepath=TARGET_GLB,
        use_selection=True,
        export_format='GLB',
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_draco_mesh_compression_enable=False
    )

    size_kb = os.path.getsize(TARGET_GLB) / 1024.0
    print(f"GLB export complete! File size: {size_kb:.1f} KB (budget: 300 KB)")
    return size_kb

if __name__ == "__main__":
    build_mushroom_laboratory()
