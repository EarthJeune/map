"""
render_prdp_beauty.py — Verification renders of the PRDP Building model.
"""

import bpy
import math

world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (0.68, 0.80, 0.94, 1.0)
    bg.inputs["Strength"].default_value = 0.85


def render_view(cam_loc, cam_rot, out_path, lens=42):
    cam = bpy.data.objects.get("PRDP_Cam")
    if not cam:
        cam = bpy.data.objects.new("PRDP_Cam", bpy.data.cameras.new("PRDP_Cam_Data"))
        bpy.context.scene.collection.objects.link(cam)
    cam.location = cam_loc
    cam.rotation_euler = [math.radians(r) for r in cam_rot]
    cam.data.lens = lens
    cam.data.clip_start = 0.1
    cam.data.clip_end = 300.0
    bpy.context.scene.camera = cam

    sun = bpy.data.objects.get("PRDP_Sun")
    if not sun:
        sun = bpy.data.objects.new("PRDP_Sun", bpy.data.lights.new("PRDP_Sun_Data", type='SUN'))
        bpy.context.scene.collection.objects.link(sun)
    sun.data.energy = 1.9
    sun.data.color = (1.0, 0.98, 0.94)
    sun.rotation_euler = (math.radians(48), math.radians(18), math.radians(-32))

    fill = bpy.data.objects.get("PRDP_Fill")
    if not fill:
        fill = bpy.data.objects.new("PRDP_Fill", bpy.data.lights.new("PRDP_Fill_Data", type='SUN'))
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
    names = [c.name for c in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items]
    scene.view_settings.view_transform = 'AgX' if 'AgX' in names else 'Standard'
    scene.view_settings.look = 'None'
    bpy.ops.render.render(write_still=True)
    print(f"Rendered: {out_path}")


# Front elevation (matches IMG_3801)
render_view((0.0, -40.0, 3.6), (87.0, 0.0, 0.0), r"c:\Users\LGU-SanPedro\Downloads\map\prdp_render_front.png", lens=35)
# 3/4 front-left view along the WSW long side (matches IMG_3802)
render_view((-26.0, -34.0, 9.0), (80.7, 0.0, -37.4), r"c:\Users\LGU-SanPedro\Downloads\map\prdp_render_sw.png", lens=30)
# Entrance + signboard close-up
render_view((0.5, -19.5, 2.6), (89.0, 0.0, 0.0), r"c:\Users\LGU-SanPedro\Downloads\map\prdp_render_entrance.png", lens=45)
