"""
render_corn_preview.py — Multi-angle verification renderer for Corn & Cassava Facility.
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
    
    if not scene.world:
        scene.world = bpy.data.worlds.new("PreviewWorld")
    scene.world.use_nodes = True
    bg_node = scene.world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs['Color'].default_value = (0.94, 0.95, 0.98, 1.0)
        bg_node.inputs['Strength'].default_value = 1.0

    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
            
    # Import the exported GLB model
    glb_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\corn_casava_building.glb"
    bpy.ops.import_scene.gltf(filepath=glb_path)
            
    # Sunlight (key light from South-East)
    sun_data = bpy.data.lights.new(name="Preview_Sun_Data", type='SUN')
    sun_data.energy = 2.6
    sun_data.color = (1.0, 0.98, 0.94)
    sun_obj = bpy.data.objects.new("Preview_Sun", sun_data)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(-35))
    
    # Fill light
    fill_data = bpy.data.lights.new(name="Preview_Fill_Data", type='SUN')
    fill_data.energy = 1.15
    fill_data.color = (0.88, 0.92, 0.98)
    fill_obj = bpy.data.objects.new("Preview_Fill", fill_data)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.rotation_euler = (math.radians(65), math.radians(-25), math.radians(145))

    # Camera
    cam_data = bpy.data.cameras.new(name="Preview_Cam_Data")
    cam_obj = bpy.data.objects.new("Preview_Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    
    out_dir = r"C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\b6d2da97-aefb-4be7-8790-50927e71af8b"
    
    # Shot 1: Front Elevation (matches IMG_3831)
    cam_data.lens = 30.0
    cam_obj.location = (0.0, -15.5, 2.5)
    cam_obj.rotation_euler = (math.radians(84), 0, 0)
    p1 = os.path.join(out_dir, "corn_front_elevation_3831.png")
    scene.render.filepath = p1
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 1 to: {p1}")
    
    # Shot 2: Left Flank View (matches IMG_3832)
    # Looking from West (-X) towards East (+X) along the left flank
    cam_data.lens = 28.0
    cam_obj.location = (-14.5, 0.0, 2.2)
    cam_obj.rotation_euler = (math.radians(84), 0, math.radians(-90))
    p2 = os.path.join(out_dir, "corn_left_flank_3832.png")
    scene.render.filepath = p2
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 2 to: {p2}")

    # Shot 3: 3/4 Perspective Beauty Shot (Front-Left View, connecting 3831 & 3832)
    cam_data.lens = 32.0
    cam_obj.location = (-13.0, -14.0, 6.5)
    cam_obj.rotation_euler = (math.radians(68), 0, math.radians(-42))
    p3 = os.path.join(out_dir, "corn_perspective_beauty.png")
    scene.render.filepath = p3
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 3 to: {p3}")

    # Shot 4: User Perspective Close-up (Matching the user's screenshot view)
    cam_data.lens = 26.0
    cam_obj.location = (-3.8, -11.5, 2.1)
    cam_obj.rotation_euler = (math.radians(82), 0, math.radians(-22))
    p4 = os.path.join(out_dir, "corn_user_angle.png")
    scene.render.filepath = p4
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 4 to: {p4}")

render_preview()
