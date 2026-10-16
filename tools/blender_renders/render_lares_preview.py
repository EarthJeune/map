"""
render_lares_preview.py — Render high quality beauty shots of the newly built LARES Building model.
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
    sun_data.energy = 2.4
    sun_data.color = (1.0, 0.98, 0.94)
    sun_obj = bpy.data.objects.new("Preview_Sun", sun_data)
    bpy.context.scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(48), math.radians(15), math.radians(-42))
    
    # Fill light
    fill_data = bpy.data.lights.new(name="Preview_Fill_Data", type='SUN')
    fill_data.energy = 1.0
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
    
    # Shot 1: Dynamic 3/4 Perspective from Front-Right showing Front Facade & Outer Lower Roof Wing
    cam_data.lens = 32.0
    cam_obj.location = (28.0, -42.0, 15.0)
    cam_obj.rotation_euler = (math.radians(72), 0, math.radians(32))
    p1 = os.path.join(out_dir, "lares_building_3quarter_view.png")
    scene.render.filepath = p1
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 1 to: {p1}")
    
    # Shot 2: Ground-Level Entrance Close-up (IMG_3804 Main Entrance & Ramp)
    cam_data.lens = 38.0
    cam_obj.location = (-15.73, -24.5, 3.2)
    cam_obj.rotation_euler = (math.radians(84), 0, 0)
    p2 = os.path.join(out_dir, "lares_building_front_entrance_closeup.png")
    scene.render.filepath = p2
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 2 to: {p2}")
    
    # Shot 2b: 3/4 Ground Perspective of Main Entrance showing Clean Steps
    cam_data.lens = 36.0
    cam_obj.location = (-19.5, -23.0, 3.2)
    cam_obj.rotation_euler = (math.radians(82), 0, math.radians(-15))
    p2b = os.path.join(out_dir, "lares_building_main_entrance_stairs_cleaned.png")
    scene.render.filepath = p2b
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 2b to: {p2b}")
    
    # Shot 3: Outer Right Lower Roof Detail from Side (Image 3860 & Veranda)
    cam_data.lens = 30.0
    cam_obj.location = (38.0, 5.0, 5.2)
    cam_obj.rotation_euler = (math.radians(82), 0, math.radians(88))
    p3 = os.path.join(out_dir, "lares_building_lower_roof_detail.png")
    scene.render.filepath = p3
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 3 to: {p3}")
    
    # Shot 4: Ground-Level Entrance Close-up (IMG_3803 Arched Canopy & Big Doorway)
    cam_data.lens = 36.0
    cam_obj.location = (9.10, -23.5, 3.0)
    cam_obj.rotation_euler = (math.radians(84), 0, 0)
    p4 = os.path.join(out_dir, "lares_building_secondary_entrance_3803.png")
    scene.render.filepath = p4
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 4 to: {p4}")

    # Shot 5: Rear Doorway & Pathway Connection to Cguard (Looking South toward rear exit)
    cam_data.lens = 35.0
    cam_obj.location = (-15.87, 8.5, 3.2)
    cam_obj.rotation_euler = (math.radians(95), 0, math.radians(180))
    p5 = os.path.join(out_dir, "lares_building_rear_doorway_cguard.png")
    scene.render.filepath = p5
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 5 to: {p5}")

    # Shot 6: Perspective view of Rear Doorway showing landing, canopy, and pathway
    cam_data.lens = 32.0
    cam_obj.location = (-21.5, 7.0, 5.0)
    cam_obj.rotation_euler = (math.radians(72), 0, math.radians(-145))
    p6 = os.path.join(out_dir, "lares_building_rear_doorway_perspective.png")
    scene.render.filepath = p6
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 6 to: {p6}")

    # Shot 7: Aerial 3D Overview showing Front Entrance, Rear Exit Door, and Cguard Pathway alignment
    cam_data.lens = 26.0
    cam_obj.location = (-32.0, -8.0, 24.0)
    cam_obj.rotation_euler = (math.radians(52), 0, math.radians(-75))
    p7 = os.path.join(out_dir, "lares_building_corridor_aerial.png")
    scene.render.filepath = p7
    bpy.ops.render.render(write_still=True)
    print(f"Rendered Shot 7 to: {p7}")

render_preview()
