"""
render_cguard_preview.py — Multi-angle verification renderer for CGuard Building.
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
    glb_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\seaguard_building.glb"
    bpy.ops.import_scene.gltf(filepath=glb_path)
            
    # Sunlight (key light)
    sun_data = bpy.data.lights.new(name="Preview_Sun_Data", type='SUN')
    sun_data.energy = 2.6
    sun_data.color = (1.0, 0.98, 0.94)
    sun_obj = bpy.data.objects.new("Preview_Sun", sun_data)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(52), math.radians(22), math.radians(-38))
    
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
    
    # Shot 1: Front Elevation & Signboard Overview (matches IMG_3868)
    cam_data.lens = 28.0
    cam_obj.location = (1.5, -17.5, 3.2)
    cam_obj.rotation_euler = (math.radians(82), 0, math.radians(-5))
    p1 = os.path.join(out_dir, "cguard_front_overview_3868.png")
    scene.render.filepath = p1
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 1 to: {p1}")
    
    # Shot 2: Veranda Walkway Close-up (matches IMG_3867)
    cam_data.lens = 28.0
    cam_obj.location = (-1.0, -4.2, 1.45)
    cam_obj.rotation_euler = (math.radians(88), 0, math.radians(92))
    p2 = os.path.join(out_dir, "cguard_veranda_walkway_3867.png")
    scene.render.filepath = p2
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 2 to: {p2}")

    # Shot 3: 3/4 Perspective Beauty Shot
    cam_data.lens = 35.0
    cam_obj.location = (14.0, -16.0, 7.5)
    cam_obj.rotation_euler = (math.radians(66), 0, math.radians(40))
    p3 = os.path.join(out_dir, "cguard_perspective_beauty.png")
    scene.render.filepath = p3
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 3 to: {p3}")

    # Shot 4: User Perspective View (Matching user's screenshot)
    cam_data.lens = 25.0
    cam_obj.location = (-11.2, -8.2, 2.1)
    cam_obj.rotation_euler = (math.radians(82), 0, math.radians(-54))
    p4 = os.path.join(out_dir, "cguard_user_angle.png")
    scene.render.filepath = p4
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 4 to: {p4}")

render_preview()
