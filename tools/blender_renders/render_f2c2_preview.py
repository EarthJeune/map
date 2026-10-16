"""
render_f2c2_preview.py — High-fidelity beauty shot renderer for the F2C2 Building model.
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

    # Clean old preview lights & cameras & meshes
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
            
    # Import the exported GLB model
    glb_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\f2c2_building.glb"
    bpy.ops.import_scene.gltf(filepath=glb_path)
            
    # Sunlight (key light)
    sun_data = bpy.data.lights.new(name="Preview_Sun_Data", type='SUN')
    sun_data.energy = 2.5
    sun_data.color = (1.0, 0.98, 0.94)
    sun_obj = bpy.data.objects.new("Preview_Sun", sun_data)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(-35))
    
    # Fill light
    fill_data = bpy.data.lights.new(name="Preview_Fill_Data", type='SUN')
    fill_data.energy = 1.1
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
    
    # Shot 1: Front Elevation & Porch View (matches IMG_3863)
    cam_data.lens = 32.0
    cam_obj.location = (0.5, -14.5, 2.2)
    cam_obj.rotation_euler = (math.radians(85), 0, math.radians(0))
    p1 = os.path.join(out_dir, "f2c2_front_elevation_3863.png")
    scene.render.filepath = p1
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 1 to: {p1}")
    
    # Shot 2: Right Flank & Alley View (matches IMG_3862 & IMG_3870)
    cam_data.lens = 30.0
    cam_obj.location = (9.5, -6.5, 2.4)
    cam_obj.rotation_euler = (math.radians(82), 0, math.radians(55))
    p2 = os.path.join(out_dir, "f2c2_right_flank_alley_3862.png")
    scene.render.filepath = p2
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 2 to: {p2}")

    # Shot 3: Far 3/4 Perspective Beauty Shot (matches IMG_3861)
    cam_data.lens = 35.0
    cam_obj.location = (11.0, -17.5, 7.5)
    cam_obj.rotation_euler = (math.radians(68), 0, math.radians(30))
    p3 = os.path.join(out_dir, "f2c2_perspective_beauty_3861.png")
    scene.render.filepath = p3
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 3 to: {p3}")

render_preview()
