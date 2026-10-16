"""
render_ild_preview.py — High-fidelity beauty shot renderer for the ILD Building model.
"""

import bpy
import math
import os

def render_ild_shots():
    scene = bpy.context.scene
    # Set engine
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    if 'BLENDER_EEVEE_NEXT' in engines:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    elif 'BLENDER_EEVEE' in engines:
        scene.render.engine = 'BLENDER_EEVEE'
    else:
        scene.render.engine = 'CYCLES'

    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.film_transparent = False

    # Sky World
    if not scene.world:
        scene.world = bpy.data.worlds.new("ILD_World")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.84, 0.88, 0.94, 1.0)
        bg.inputs['Strength'].default_value = 1.0

    # Clean old objects
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)

    # Import exported GLB
    glb_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\ild_building.glb"
    bpy.ops.import_scene.gltf(filepath=glb_path)

    # Lighting
    # Key Sun Light
    sun1 = bpy.data.lights.new("Sun_Key", type='SUN')
    sun1.energy = 3.0
    sun1.color = (1.0, 0.98, 0.92)
    sun1_obj = bpy.data.objects.new("Sun_Key", sun1)
    bpy.context.scene.collection.objects.link(sun1_obj)
    sun1_obj.rotation_euler = (math.radians(52), math.radians(20), math.radians(-35))

    # Soft Fill Sun
    sun2 = bpy.data.lights.new("Sun_Fill", type='SUN')
    sun2.energy = 1.2
    sun2.color = (0.85, 0.90, 1.0)
    sun2_obj = bpy.data.objects.new("Sun_Fill", sun2)
    bpy.context.scene.collection.objects.link(sun2_obj)
    sun2_obj.rotation_euler = (math.radians(65), math.radians(-30), math.radians(145))

    # Ground Plane
    bpy.ops.mesh.primitive_plane_add(size=60.0, location=(0.0, 0.0, -0.01))
    ground = bpy.context.active_object
    ground.name = "Ground"
    mat_g = bpy.data.materials.new("Ground_Mat")
    mat_g.use_nodes = True
    mat_g.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.58, 0.60, 0.58, 1.0)
    mat_g.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.85
    ground.data.materials.append(mat_g)

    # Camera
    cam = bpy.data.cameras.new("Render_Cam")
    cam.lens = 24.0 # Wide angle matching mobile camera
    cam_obj = bpy.data.objects.new("Render_Cam", cam)
    bpy.context.scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    out_dir = r"C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\b6d2da97-aefb-4be7-8790-50927e71af8b"

    # Shot 1: Front-Left 3/4 Perspective matching IMG_3864.jpg
    # Photographer standing in front and to the left of the building looking at the high corner,
    # entrance door, sign, windows, and along the front facade
    cam_obj.location = (-13.5, -11.5, 2.2)
    cam_obj.rotation_euler = (math.radians(78), 0.0, math.radians(-52))
    p1 = os.path.join(out_dir, "ild_front_perspective_3864.png")
    scene.render.filepath = p1
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 1 to: {p1}")

    # Shot 2: Close-up on Entrance Door & Sign Plate matching IMG_3865.jpg
    cam.lens = 28.0
    cam_obj.location = (-9.5, -9.0, 1.8)
    cam_obj.rotation_euler = (math.radians(82), 0.0, math.radians(-35))
    p2 = os.path.join(out_dir, "ild_entrance_closeup_3865.png")
    scene.render.filepath = p2
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 2 to: {p2}")

    # Shot 3: High Bird's-Eye Perspective showing roof slope, standing seams & massing
    cam.lens = 35.0
    cam_obj.location = (-16.0, -18.0, 15.0)
    cam_obj.rotation_euler = (math.radians(52), 0.0, math.radians(-42))
    p3 = os.path.join(out_dir, "ild_aerial_beauty.png")
    scene.render.filepath = p3
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 3 to: {p3}")

render_ild_shots()
