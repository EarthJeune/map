"""
render_post_harvest_preview.py — Render beauty shot previews of the newly built Post Harvest Laboratory Building.
"""

import bpy
import math
import os

def render_preview():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.film_transparent = True
    
    # World background
    if not scene.world:
        scene.world = bpy.data.worlds.new("PreviewWorld")
    scene.world.use_nodes = True
    bg_node = scene.world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs['Color'].default_value = (0.94, 0.95, 0.98, 1.0)
        bg_node.inputs['Strength'].default_value = 1.0

    # Clean old preview lights & cameras
    for obj in list(bpy.data.objects):
        if obj.name.startswith("Preview_") or obj.name.startswith("Sun"):
            bpy.data.objects.remove(obj, do_unlink=True)
            
    # Sunlight
    sun_data = bpy.data.lights.new(name="Preview_Sun_Data", type='SUN')
    sun_data.energy = 2.5
    sun_data.color = (1.0, 0.98, 0.94)
    sun_obj = bpy.data.objects.new("Preview_Sun", sun_data)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(-35))
    
    # Fill light
    fill_data = bpy.data.lights.new(name="Preview_Fill_Data", type='SUN')
    fill_data.energy = 1.2
    fill_data.color = (0.85, 0.90, 0.98)
    fill_obj = bpy.data.objects.new("Preview_Fill", fill_data)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(65), math.radians(-25), math.radians(145))

    # Camera
    cam_data = bpy.data.cameras.new(name="Preview_Cam_Data")
    cam_obj = bpy.data.objects.new("Preview_Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    
    out_dir = r"C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\b6d2da97-aefb-4be7-8790-50927e71af8b"
    
    # Shot 1: Front Elevation Beauty Shot (IMG_3797 ground-truth angle)
    # Looking at the front facade at Y = -13.50m from South (Y = -27.0m)
    cam_data.lens = 35.0
    cam_obj.location = (0.0, -28.0, 4.2)
    cam_obj.rotation_euler = (math.radians(85), 0, 0)
    p1 = os.path.join(out_dir, "post_harvest_front_elevation.png")
    scene.render.filepath = p1
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 1 to: {p1}")
    
    # Shot 2: Dynamic 3/4 Perspective from Front-Left showing Barrel Roof curve, Portico, and Side Buttresses
    cam_data.lens = 32.0
    cam_obj.location = (-18.0, -28.0, 9.5)
    cam_obj.rotation_euler = (math.radians(74), 0, math.radians(-32))
    p2 = os.path.join(out_dir, "post_harvest_3quarter_view.png")
    scene.render.filepath = p2
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 2 to: {p2}")

    # Shot 3: Close-up of Arched Entrance Portico, Stone Pillars, 3D Signage & Steps
    cam_data.lens = 42.0
    cam_obj.location = (0.0, -22.5, 3.2)
    cam_obj.rotation_euler = (math.radians(85), 0, 0)
    p3 = os.path.join(out_dir, "post_harvest_portico_closeup.png")
    scene.render.filepath = p3
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 3 to: {p3}")

    # Shot 4: Side Elevation along Left Wall showing buttresses, windows & AC units (IMG_3798)
    cam_data.lens = 30.0
    cam_obj.location = (-19.0, -8.0, 4.0)
    cam_obj.rotation_euler = (math.radians(82), 0, math.radians(-90))
    p4 = os.path.join(out_dir, "post_harvest_side_elevation.png")
    scene.render.filepath = p4
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 4 to: {p4}")

render_preview()
