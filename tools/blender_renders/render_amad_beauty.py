"""
render_amad_beauty.py — Render calibrated beauty shots of the rebuilt AMAD Building with natural outdoor lighting and reflections.
"""

import bpy
import math

# 1. Setup outdoor sky world background for realistic reflections
world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs["Color"].default_value = (0.65, 0.78, 0.92, 1.0) # Soft blue sky
    bg_node.inputs["Strength"].default_value = 0.85

def render_view(cam_loc, cam_rot, out_path, lens=40):
    cam = bpy.data.objects.get("Beauty_Cam")
    if not cam:
        cam_data = bpy.data.cameras.new("Beauty_Cam_Data")
        cam = bpy.data.objects.new("Beauty_Cam", cam_data)
        bpy.context.scene.collection.objects.link(cam)
    cam.location = cam_loc
    cam.rotation_euler = [math.radians(r) for r in cam_rot]
    cam.data.lens = lens
    cam.data.clip_start = 0.1
    cam.data.clip_end = 250.0
    bpy.context.scene.camera = cam
    
    # Sun light with natural outdoor intensity
    sun = bpy.data.objects.get("Beauty_Sun")
    if not sun:
        sun_data = bpy.data.lights.new("Beauty_Sun_Data", type='SUN')
        sun = bpy.data.objects.new("Beauty_Sun", sun_data)
        bpy.context.scene.collection.objects.link(sun)
    sun.data.energy = 1.8
    sun.data.color = (1.0, 0.98, 0.94)
    sun.rotation_euler = (math.radians(45), math.radians(20), math.radians(-30))
    
    # Soft sky fill
    fill = bpy.data.objects.get("Beauty_Fill")
    if not fill:
        fill_data = bpy.data.lights.new("Beauty_Fill_Data", type='SUN')
        fill = bpy.data.objects.new("Beauty_Fill", fill_data)
        bpy.context.scene.collection.objects.link(fill)
    fill.data.energy = 0.6
    fill.data.color = (0.75, 0.85, 1.0)
    fill.rotation_euler = (math.radians(60), math.radians(-30), math.radians(150))
    
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

# Front Facade View (perfectly framed matching IMG_3814)
render_view((0.0, -23.5, 4.2), (84.5, 0.0, 0.0), r"c:\Users\LGU-SanPedro\Downloads\map\amad_render_front_calibrated.png", lens=48)

# 3/4 Southwest Perspective View (showing front mirrored glass, hipped roof, and side elevation matching IMG_3815)
render_view((-17.0, -21.0, 8.5), (71.0, 0.0, -38.0), r"c:\Users\LGU-SanPedro\Downloads\map\amad_render_sw_calibrated.png", lens=38)
