"""
render_pgrc_beauty.py — Render calibrated beauty shots of the authentic bespoke PGRC Building.
"""

import bpy
import math

# 1. Setup outdoor sky world background
world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs["Color"].default_value = (0.68, 0.80, 0.94, 1.0)
    bg_node.inputs["Strength"].default_value = 0.85

def render_view(cam_loc, cam_rot, out_path, lens=42):
    cam = bpy.data.objects.get("PGRC_Cam")
    if not cam:
        cam_data = bpy.data.cameras.new("PGRC_Cam_Data")
        cam = bpy.data.objects.new("PGRC_Cam", cam_data)
        bpy.context.scene.collection.objects.link(cam)
    cam.location = cam_loc
    cam.rotation_euler = [math.radians(r) for r in cam_rot]
    cam.data.lens = lens
    cam.data.clip_start = 0.1
    cam.data.clip_end = 250.0
    bpy.context.scene.camera = cam
    
    # Sun light with natural outdoor lighting
    sun = bpy.data.objects.get("PGRC_Sun")
    if not sun:
        sun_data = bpy.data.lights.new("PGRC_Sun_Data", type='SUN')
        sun = bpy.data.objects.new("PGRC_Sun", sun_data)
        bpy.context.scene.collection.objects.link(sun)
    sun.data.energy = 1.9
    sun.data.color = (1.0, 0.98, 0.94)
    sun.rotation_euler = (math.radians(48), math.radians(18), math.radians(-32))
    
    # Soft sky fill
    fill = bpy.data.objects.get("PGRC_Fill")
    if not fill:
        fill_data = bpy.data.lights.new("PGRC_Fill_Data", type='SUN')
        fill = bpy.data.objects.new("PGRC_Fill", fill_data)
        bpy.context.scene.collection.objects.link(fill)
    fill.data.energy = 0.65
    fill.data.color = (0.75, 0.85, 1.0)
    fill.rotation_euler = (math.radians(60), math.radians(-25), math.radians(145))
    
    scene = bpy.context.scene
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = out_path
    
    scene.view_settings.view_transform = 'AgX' if 'AgX' in [c.name for c in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items] else 'Standard'
    scene.view_settings.look = 'None'
    
    bpy.ops.render.render(write_still=True)
    print(f"Rendered: {out_path}")

# Front Facade View (matching IMG_3796)
render_view((0.0, -25.5, 5.2), (84.0, 0.0, 0.0), r"c:\Users\LGU-SanPedro\Downloads\map\pgrc_render_front.png", lens=46)

# 3/4 Southwest Perspective View (matching IMG_3795 showing slope of roof, portico canopy, AC unit)
render_view((-21.0, -21.0, 9.5), (71.0, 0.0, -42.0), r"c:\Users\LGU-SanPedro\Downloads\map\pgrc_render_sw.png", lens=38)

# Close-up Portico & 3D Signage View
render_view((0.0, -15.8, 3.8), (86.0, 0.0, 0.0), r"c:\Users\LGU-SanPedro\Downloads\map\pgrc_render_entrance.png", lens=52)
