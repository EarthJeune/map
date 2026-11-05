"""
render_plot17_screenhouse_1.py — Render beauty shots of Plot 17 Screenhouse 1
"""

import bpy
import math
import mathutils
import os

OUT_DIR = r"c:\Users\LGU-SanPedro\Downloads\map\scratch"
os.makedirs(OUT_DIR, exist_ok=True)

def look_at(cam, target):
    loc = cam.location
    direction = target - loc
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()

def render_preview(filepath, cam_loc, target_loc=mathutils.Vector((0, 0, 1.8))):
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
    for light_name in ["SunLight", "FillLight"]:
        old_l = bpy.data.objects.get(light_name)
        if old_l:
            bpy.data.objects.remove(old_l, do_unlink=True)
            
    sun_data = bpy.data.lights.new(name="SunLight", type='SUN')
    sun_data.energy = 3.5
    sun_data.color = (1.0, 0.98, 0.92)
    sun = bpy.data.objects.new(name="SunLight", object_data=sun_data)
    sun.rotation_euler = (math.radians(50), math.radians(25), math.radians(-45))
    scene.collection.objects.link(sun)
    
    fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
    fill_data.energy = 2.0
    fill_data.color = (0.75, 0.85, 1.0)
    fill = bpy.data.objects.new(name="FillLight", object_data=fill_data)
    fill.rotation_euler = (math.radians(40), math.radians(-30), math.radians(135))
    scene.collection.objects.link(fill)
    
    # World background
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs['Color'].default_value = (0.08, 0.10, 0.13, 1.0)
        bg.inputs['Strength'].default_value = 1.0
        
    bpy.ops.render.render(write_still=True)
    print(f"Rendered: {filepath}")

def main():
    # Shot 1: Front-Left 3/4 Perspective (Front Entrance Door & Stoop + Left/North Side)
    # Model center is at (0, 0, 1.8), front is at Y = -9.43, left is at X = -3.155
    render_preview(
        os.path.join(OUT_DIR, "sh1_front_perspective.png"),
        cam_loc=mathutils.Vector((-8.5, -16.0, 5.2)),
        target_loc=mathutils.Vector((0.0, -4.0, 1.8))
    )
    
    # Shot 2: Close-Up of Front Entrance Door & Foundation
    render_preview(
        os.path.join(OUT_DIR, "sh1_door_closeup.png"),
        cam_loc=mathutils.Vector((-2.0, -13.5, 2.2)),
        target_loc=mathutils.Vector((0.0, -9.43, 1.6))
    )

try:
    main()
except Exception as e:
    import traceback
    traceback.print_exc()
    raise e
