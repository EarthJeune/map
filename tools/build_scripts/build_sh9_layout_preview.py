"""
build_sh9_layout_preview.py — 3D Architectural Layout Generator for Screenhouse 9 Complex
Conforms strictly to user's ground-truth photos (IMG_4185, IMG_4186, and Aerial Top View).
Renders orthographic top-down, axonometric 3D, and front approach layout views.
"""

import bpy
import bmesh
import math
import os

OUTPUT_DIR = r"C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for m in bpy.data.meshes: bpy.data.meshes.remove(m)
    for m in bpy.data.materials: bpy.data.materials.remove(m)
    for l in bpy.data.lights: bpy.data.lights.remove(l)
    for c in bpy.data.cameras: bpy.data.cameras.remove(c)

def make_mat(name, color, roughness=0.6, metallic=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*color[:3], 1.0)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        if alpha < 1.0:
            if 'Alpha' in bsdf.inputs:
                bsdf.inputs['Alpha'].default_value = alpha
            mat.blend_method = 'BLEND'
    return mat

def create_box(name, loc, size, mat=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0]/2, size[1]/2, size[2]/2)
    bpy.ops.object.transform_apply(scale=True)
    if mat:
        obj.data.materials.append(mat)
    return obj

def create_cylinder(name, loc, radius, depth, rot=(0,0,0), mat=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    if mat:
        obj.data.materials.append(mat)
    return obj

def build_sh9_layout():
    clear_scene()

    # Materials Palette
    mat_ground = make_mat("Ground", (0.28, 0.35, 0.22), roughness=0.9)
    mat_concrete = make_mat("Concrete", (0.65, 0.65, 0.63), roughness=0.7)
    mat_aged_metal = make_mat("AgedCorrugated", (0.42, 0.44, 0.42), roughness=0.5, metallic=0.6)
    mat_red_trim = make_mat("RedTrim", (0.68, 0.18, 0.14), roughness=0.4, metallic=0.1)
    mat_small_roof = make_mat("RustyRedRoof", (0.55, 0.22, 0.18), roughness=0.5, metallic=0.3)
    mat_steel_frame = make_mat("SteelTruss", (0.25, 0.26, 0.28), roughness=0.4, metallic=0.8)
    mat_mesh = make_mat("WireMesh", (0.8, 0.85, 0.85), roughness=0.5, metallic=0.5, alpha=0.35)
    mat_wood_bench = make_mat("TimberBench", (0.45, 0.32, 0.22), roughness=0.8)
    mat_green_plants = make_mat("GreenSeedlings", (0.15, 0.55, 0.15), roughness=0.8)
    mat_white_sink = make_mat("WhiteTiles", (0.92, 0.94, 0.96), roughness=0.2)
    mat_white_drum = make_mat("WhiteHDPE", (0.88, 0.90, 0.92), roughness=0.4)
    mat_hatch = make_mat("DarkHatch", (0.15, 0.15, 0.18), roughness=0.5)

    # 1. Base Ground Slab
    create_box("TerrainSlab", (0, 10.8, -0.05), (14.0, 26.0, 0.1), mat_ground)

    # Coordinate convention:
    # Y = 0 to Y = 15.2 m : Greenhouse Trellis (Screenhouse 9)
    # Y = 15.2 to Y = 21.6 m : Big House / Covered Potting Shed
    # X = 0 is central axis running along length
    # Z = 0 is grade

    # ========================================================
    # PART 1: THE BIG HOUSE / COVERED POTTING SHED (Y = 15.2 to 21.6)
    # Width = 7.42 m, Depth = 6.40 m, Height = 3.6 m (eave) to 4.5 m (apex)
    # ========================================================
    shed_w = 7.42
    shed_d = 6.40
    shed_y_min = 15.20
    shed_y_max = 21.60
    shed_y_mid = (shed_y_min + shed_y_max) / 2

    # Concrete plinth / floor slab
    create_box("Shed_Concrete_Floor", (0, shed_y_mid, 0.10), (shed_w, shed_d, 0.20), mat_concrete)

    # Corrugated iron flank walls (West & East)
    # West wall (X = -shed_w/2)
    create_box("Shed_Wall_West", (-shed_w/2 + 0.05, shed_y_mid, 1.8), (0.10, shed_d, 3.4), mat_aged_metal)
    # East wall (X = +shed_w/2)
    create_box("Shed_Wall_East", (shed_w/2 - 0.05, shed_y_mid, 1.8), (0.10, shed_d, 3.4), mat_aged_metal)

    # Front wall sections (leaving center open for double steel gate matching IMG_4185)
    # Front Left wall (X = -shed_w/2 to -1.5)
    create_box("Shed_Front_Left", (-2.6, shed_y_max - 0.05, 1.8), (2.2, 0.10, 3.4), mat_aged_metal)
    # Front Right wall (X = 1.5 to shed_w/2)
    create_box("Shed_Front_Right", (2.6, shed_y_max - 0.05, 1.8), (2.2, 0.10, 3.4), mat_aged_metal)

    # Steel gate posts & double gate frame (IMG_4185)
    create_box("Shed_Gate_Post_L", (-1.5, shed_y_max, 1.6), (0.12, 0.12, 3.2), mat_steel_frame)
    create_box("Shed_Gate_Post_R", (1.5, shed_y_max, 1.6), (0.12, 0.12, 3.2), mat_steel_frame)
    # Center gate leaves
    create_box("Shed_Gate_Leaf_L", (-0.75, shed_y_max, 1.0), (1.45, 0.04, 1.8), mat_steel_frame)
    create_box("Shed_Gate_Leaf_R", (0.75, shed_y_max, 1.0), (1.45, 0.04, 1.8), mat_steel_frame)

    # Concrete Enclosed Utility Room inside Shed (Left side, matching IMG_4186)
    # Dimensions: 2.4m wide x 3.0m deep x 2.6m high
    room_w = 2.4
    room_d = 3.0
    room_x = -shed_w/2 + room_w/2 + 0.3
    room_y = shed_y_min + room_d/2 + 0.8
    create_box("Shed_Utility_Room_Body", (room_x, room_y, 1.4), (room_w, room_d, 2.6), mat_concrete)
    # Utility room door opening (facing East / center of shed)
    create_box("Shed_Utility_Door", (room_x + room_w/2, room_y - 0.5, 1.1), (0.05, 0.85, 2.0), mat_wood_bench)
    # Utility room window with security grilles
    create_box("Shed_Utility_Window", (room_x + room_w/2, room_y + 0.8, 1.6), (0.05, 0.70, 0.9), mat_steel_frame)

    # White-tiled outdoor concrete sink / preparation counter (attached to front of utility room, IMG_4186)
    create_box("Shed_Sink_Base", (room_x, room_y + room_d/2 + 0.45, 0.45), (1.4, 0.7, 0.9), mat_concrete)
    create_box("Shed_Sink_Top", (room_x, room_y + room_d/2 + 0.45, 0.92), (1.45, 0.75, 0.08), mat_white_sink)

    # White plastic monobloc chair outside utility room (IMG_4186)
    create_box("Shed_Chair", (room_x + room_w/2 + 0.5, room_y + 0.8, 0.45), (0.45, 0.45, 0.8), mat_white_drum)

    # Potting work bench in shed right side
    create_box("Shed_Work_Bench", (2.0, shed_y_mid, 0.5), (1.2, 3.2, 0.9), mat_wood_bench)

    # Structural Roof:
    # 4 Steel angle roof trusses spanning X = -shed_w/2 to +shed_w/2
    for ty in [shed_y_min + 0.2, shed_y_min + 2.2, shed_y_min + 4.2, shed_y_max - 0.2]:
        create_box(f"Shed_Truss_Tie_{ty}", (0, ty, 3.2), (shed_w, 0.08, 0.08), mat_steel_frame)
        create_box(f"Shed_Truss_King_{ty}", (0, ty, 3.75), (0.08, 0.08, 1.1), mat_steel_frame)

    # Hip Roof Surface with signature red ridge trim (as seen in drone top view)
    # Left hip slope
    create_box("Shed_Roof_Slope_L", (-shed_w/4, shed_y_mid, 3.8), (shed_w/2 + 0.3, shed_d + 0.4, 0.05), mat_aged_metal)
    # Right hip slope
    create_box("Shed_Roof_Slope_R", (shed_w/4, shed_y_mid, 3.8), (shed_w/2 + 0.3, shed_d + 0.4, 0.05), mat_aged_metal)
    # Iconic Red Hip Rake Trim (inverted V visible from aerial view)
    create_box("Shed_Red_Rake_L", (-shed_w/4, shed_y_max - 1.6, 4.0), (shed_w/2 + 0.2, 0.25, 0.08), mat_red_trim)
    create_box("Shed_Red_Rake_R", (shed_w/4, shed_y_max - 1.6, 4.0), (shed_w/2 + 0.2, 0.25, 0.08), mat_red_trim)
    create_box("Shed_Red_Ridge", (0, shed_y_min + 1.8, 4.15), (0.28, 3.6, 0.08), mat_red_trim)

    # ========================================================
    # PART 2: SMALL HOUSE INSIDE GREENHOUSE (NW CORNER)
    # Dimensions: 2.5m wide x 3.2m deep x 2.4m high
    # Rusty red corrugated roof with dark square hatch (aerial top view)
    # ========================================================
    sh_w = 2.40
    sh_d = 3.20
    sh_x = -3.05 + sh_w/2 + 0.15
    sh_y = 15.20 - sh_d/2 - 0.20

    # Concrete walls
    create_box("Small_House_Body", (sh_x, sh_y, 1.2), (sh_w, sh_d, 2.3), mat_concrete)
    # Rusty red corrugated metal roof
    create_box("Small_House_Roof", (sh_x, sh_y, 2.4), (sh_w + 0.3, sh_d + 0.3, 0.10), mat_small_roof)
    # Dark square hatch on top (clearly seen in aerial photo)
    create_box("Small_House_Roof_Hatch", (sh_x + 0.3, sh_y + 0.4, 2.48), (0.7, 0.7, 0.08), mat_hatch)
    # Doorway facing East into greenhouse central aisle
    create_box("Small_House_Door", (sh_x + sh_w/2, sh_y - 0.4, 1.0), (0.05, 0.8, 1.9), mat_wood_bench)

    # ========================================================
    # PART 3: SCREENHOUSE 9 TRELLIS NURSERY (Y = 0 to 15.20)
    # Width = 6.12 m, Length = 15.20 m
    # ========================================================
    trellis_w = 6.12
    trellis_l = 15.20
    trellis_y_mid = trellis_l / 2

    # Concrete perimeter foundation curb wall
    # South wall (Y = 0)
    create_box("Trellis_Curb_South", (0, 0.1, 0.2), (trellis_w, 0.20, 0.4), mat_concrete)
    # West wall (X = -trellis_w/2)
    create_box("Trellis_Curb_West", (-trellis_w/2 + 0.1, trellis_y_mid, 0.2), (0.20, trellis_l, 0.4), mat_concrete)
    # East wall (X = +trellis_w/2)
    create_box("Trellis_Curb_East", (trellis_w/2 - 0.1, trellis_y_mid, 0.2), (0.20, trellis_l, 0.4), mat_concrete)

    # Wire mesh screen perimeter fencing (semi-translucent)
    create_box("Trellis_Mesh_West", (-trellis_w/2 + 0.05, trellis_y_mid, 1.3), (0.05, trellis_l, 2.0), mat_mesh)
    create_box("Trellis_Mesh_East", (trellis_w/2 - 0.05, trellis_y_mid, 1.3), (0.05, trellis_l, 2.0), mat_mesh)
    create_box("Trellis_Mesh_South", (0, 0.05, 1.3), (trellis_w, 0.05, 2.0), mat_mesh)

    # Steel Pipe Hoop Arches along length (spaced every 1.8 m)
    for i, ay in enumerate([1.2, 3.0, 4.8, 6.6, 8.4, 10.2, 12.0, 13.8]):
        # Post Left
        create_cylinder(f"Trellis_Post_L_{i}", (-trellis_w/2 + 0.15, ay, 1.3), radius=0.03, depth=2.2, mat=mat_steel_frame)
        # Post Right
        create_cylinder(f"Trellis_Post_R_{i}", (trellis_w/2 - 0.15, ay, 1.3), radius=0.03, depth=2.2, mat=mat_steel_frame)
        # Overhead Trellis Cross Beam
        create_box(f"Trellis_Cross_Beam_{i}", (0, ay, 2.45), (trellis_w - 0.3, 0.06, 0.06), mat_steel_frame)
        # Arched hoop rib
        create_cylinder(f"Trellis_Rib_Center_{i}", (0, ay, 2.85), radius=0.025, depth=trellis_w - 0.8, rot=(0, math.pi/2, 0), mat=mat_steel_frame)

    # Central gravel walkway aisle (X = 0, width = 1.2 m)
    create_box("Trellis_Walkway_Mat", (0, trellis_y_mid, 0.03), (1.1, trellis_l - 0.4, 0.04), mat_concrete)

    # Dual Columns of Raised Seedling Propagation Tables
    # West Column (X = -1.85 m) & East Column (X = +1.85 m)
    # 6 table bays running down the length
    table_ys = [1.2, 3.2, 5.2, 7.2, 9.2, 11.2, 13.2]
    table_w = 1.90
    table_l = 1.50
    table_h = 0.75

    for idx, ty in enumerate(table_ys):
        # East side table (present for all bays)
        create_box(f"Table_E_Legs_{idx}", (1.85, ty, table_h/2), (table_w, table_l, table_h), mat_wood_bench)
        create_box(f"Table_E_Plants_{idx}", (1.85, ty, table_h + 0.12), (table_w - 0.1, table_l - 0.1, 0.22), mat_green_plants)

        # West side table (only for bays NOT occupied by the small house, i.e. ty <= 10.0)
        if ty <= 10.0:
            create_box(f"Table_W_Legs_{idx}", (-1.85, ty, table_h/2), (table_w, table_l, table_h), mat_wood_bench)
            create_box(f"Table_W_Plants_{idx}", (-1.85, ty, table_h + 0.12), (table_w - 0.1, table_l - 0.1, 0.22), mat_green_plants)

    # Outside Props (West of Trellis, clearly seen in top view):
    # Water Tank Drum (white cylindrical drum on steel stand) at X = -4.2, Y = 6.0
    create_box("Water_Tank_Stand", (-4.2, 6.0, 0.6), (1.0, 1.0, 1.2), mat_steel_frame)
    create_cylinder("Water_Tank_Drum", (-4.2, 6.0, 1.6), radius=0.45, depth=0.9, mat=mat_white_drum)
    # Water pump base
    create_box("Water_Pump_Base", (-4.2, 4.0, 0.15), (0.8, 1.2, 0.3), mat_concrete)

    # ========================================================
    # LIGHTING SETUP
    # ========================================================
    sun_data = bpy.data.lights.new(name="SunLight", type='SUN')
    sun_data.energy = 4.2
    sun_data.color = (1.0, 0.98, 0.92)
    sun_obj = bpy.data.objects.new("SunLight", sun_data)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(-35))

    fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
    fill_data.energy = 1.8
    fill_data.color = (0.75, 0.85, 1.0)
    fill_obj = bpy.data.objects.new("FillLight", fill_data)
    bpy.context.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(-40), math.radians(35), math.radians(140))

    # Environment
    bpy.context.scene.world.use_nodes = True
    bg = bpy.context.scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.08, 0.11, 0.16, 1.0)
        bg.inputs['Strength'].default_value = 0.8

    # Render settings
    bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    bpy.context.scene.render.resolution_x = 1440
    bpy.context.scene.render.resolution_y = 1080
    bpy.context.scene.render.film_transparent = False

    # ========================================================
    # CAMERA 1: TOP-DOWN ORTHOGRAPHIC LAYOUT (Matches Drone Aerial View)
    # ========================================================
    cam1_data = bpy.data.cameras.new("Cam_Top_Orthographic")
    cam1_data.type = 'ORTHO'
    cam1_data.ortho_scale = 26.0
    cam1_obj = bpy.data.objects.new("Cam_Top_Orthographic", cam1_data)
    bpy.context.collection.objects.link(cam1_obj)
    cam1_obj.location = (0.0, 11.0, 30.0)
    cam1_obj.rotation_euler = (0, 0, 0)

    bpy.context.scene.camera = cam1_obj
    out_top = os.path.join(OUTPUT_DIR, "sh9_layout_top_view.png")
    bpy.context.scene.render.filepath = out_top
    bpy.ops.render.render(write_still=True)
    print("Rendered:", out_top)

    # ========================================================
    # CAMERA 2: 3D AXONOMETRIC / ISOMETRIC PERSPECTIVE (Shows Gate, Shed, Room, Trellis)
    # ========================================================
    cam2_data = bpy.data.cameras.new("Cam_Axonometric")
    cam2_data.type = 'PERSP'
    cam2_data.lens = 45.0
    cam2_obj = bpy.data.objects.new("Cam_Axonometric", cam2_data)
    bpy.context.collection.objects.link(cam2_obj)
    cam2_obj.location = (-18.0, 32.0, 18.0)
    # Look at center of complex (0, 11, 1.5)
    dx = 0.0 - cam2_obj.location.x
    dy = 11.0 - cam2_obj.location.y
    dz = 1.5 - cam2_obj.location.z
    dist = math.hypot(dx, dy)
    pitch = math.atan2(-dz, dist)
    yaw = math.atan2(dx, -dy)
    cam2_obj.rotation_euler = (math.radians(65), 0, math.radians(-140))

    bpy.context.scene.camera = cam2_obj
    out_axono = os.path.join(OUTPUT_DIR, "sh9_layout_axonometric.png")
    bpy.context.scene.render.filepath = out_axono
    bpy.ops.render.render(write_still=True)
    print("Rendered:", out_axono)

    # ========================================================
    # CAMERA 3: FRONT ENTRANCE APPROACH (Matches IMG_4185)
    # ========================================================
    cam3_data = bpy.data.cameras.new("Cam_Front_Approach")
    cam3_data.type = 'PERSP'
    cam3_data.lens = 32.0
    cam3_obj = bpy.data.objects.new("Cam_Front_Approach", cam3_data)
    bpy.context.collection.objects.link(cam3_obj)
    cam3_obj.location = (0.0, 26.5, 1.8)
    cam3_obj.rotation_euler = (math.radians(88), 0, math.radians(180))

    bpy.context.scene.camera = cam3_obj
    out_front = os.path.join(OUTPUT_DIR, "sh9_layout_front_view.png")
    bpy.context.scene.render.filepath = out_front
    bpy.ops.render.render(write_still=True)
    print("Rendered:", out_front)

build_sh9_layout()
