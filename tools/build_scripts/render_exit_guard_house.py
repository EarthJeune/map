"""
render_exit_guard_house.py — Render beauty shots of the Exit Guard House 1 Bahay Kubo Hut
"""

import bpy
import math
import mathutils
import os

def look_at(cam, target):
    loc = cam.location
    direction = target - loc
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()

def render_preview(filepath, cam_loc, target_loc=mathutils.Vector((0, 0, 2.1))):
    scene = bpy.context.scene
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = filepath
    
    # Setup Camera
    cam = bpy.data.objects.get("RenderCamera")
    if not cam:
        cam_data = bpy.data.cameras.new("RenderCamera")
        cam = bpy.data.objects.new("RenderCamera", cam_data)
        scene.collection.objects.link(cam)
        
    cam.location = cam_loc
    look_at(cam, target_loc)
    scene.camera = cam
    
    # Setup Lighting
    for light_name in ["SunLight", "FillLight", "RimLight"]:
        old_l = bpy.data.objects.get(light_name)
        if old_l:
            bpy.data.objects.remove(old_l, do_unlink=True)
            
    sun_data = bpy.data.lights.new(name="SunLight", type='SUN')
    sun_data.energy = 3.5
    sun_data.color = (1.0, 0.96, 0.90)
    sun = bpy.data.objects.new(name="SunLight", object_data=sun_data)
    sun.rotation_euler = (math.radians(50), math.radians(20), math.radians(-35))
    scene.collection.objects.link(sun)
    
    fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
    fill_data.energy = 1.8
    fill_data.color = (0.75, 0.85, 1.0)
    fill = bpy.data.objects.new(name="FillLight", object_data=fill_data)
    fill.rotation_euler = (math.radians(40), math.radians(-30), math.radians(145))
    scene.collection.objects.link(fill)
    
    # World background
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.09, 0.11, 0.15, 1.0) # Sleek studio background
        bg.inputs['Strength'].default_value = 1.0
        
    bpy.ops.render.render(write_still=True)
    print(f"Rendered: {filepath}")

# 1. Front View (facing entrance at -Y, full roof framed)
render_preview(
    r"c:\Users\LGU-SanPedro\Downloads\map\renders\exit_guard_house_front.png",
    cam_loc=mathutils.Vector((0.0, -10.2, 2.7)),
    target_loc=mathutils.Vector((0.0, 0.0, 2.1))
)

# 2. 3/4 Perspective View (full hut & steep roof framed)
render_preview(
    r"c:\Users\LGU-SanPedro\Downloads\map\renders\exit_guard_house_perspective.png",
    cam_loc=mathutils.Vector((7.6, -8.2, 4.3)),
    target_loc=mathutils.Vector((0.0, 0.0, 2.1))
)
