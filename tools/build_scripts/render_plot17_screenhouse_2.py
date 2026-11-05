"""
render_plot17_screenhouse_2.py — Render beauty shots of Plot 17 Screenhouse 2
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
    TARGET_GLB = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot17_screenhouse_2.glb"
    if os.path.exists(TARGET_GLB):
        # Clear default cube/lights and import the newly built GLB
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)
        print(f"Importing {TARGET_GLB} for beauty renders...")
        bpy.ops.import_scene.gltf(filepath=TARGET_GLB)

    # Shot 1: Front-Left 3/4 Perspective (Front Entrance Door & Stoop + Left Alley Side)
    render_preview(
        os.path.join(OUT_DIR, "sh2_front_perspective.png"),
        cam_loc=mathutils.Vector((-8.2, -15.5, 5.0)),
        target_loc=mathutils.Vector((0.0, -4.0, 1.8))
    )
    
    # Shot 2: Close-Up of Front Entrance Door & Stepped Stoop
    render_preview(
        os.path.join(OUT_DIR, "sh2_door_closeup.png"),
        cam_loc=mathutils.Vector((-1.8, -13.2, 2.1)),
        target_loc=mathutils.Vector((0.0, -9.2, 1.4))
    )

    # Shot 3: Interior Looking Down Central Aisle at Seedling Benches
    render_preview(
        os.path.join(OUT_DIR, "sh2_interior_nursery.png"),
        cam_loc=mathutils.Vector((0.0, -8.6, 1.6)),
        target_loc=mathutils.Vector((0.0, 2.0, 1.2))
    )

    # Shot 4: Aerial 3/4 Overview showing entire length and barrel roof
    render_preview(
        os.path.join(OUT_DIR, "sh2_aerial_overview.png"),
        cam_loc=mathutils.Vector((12.0, -18.0, 14.0)),
        target_loc=mathutils.Vector((0.0, 0.0, 2.0))
    )

main()
