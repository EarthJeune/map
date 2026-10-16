"""
render_ored_beauty.py — Verification renders of the ORED Building model.
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
    bg.inputs["Color"].default_value = (0.70, 0.82, 0.95, 1.0)
    bg.inputs["Strength"].default_value = 0.90


def render_view(cam_loc, cam_rot, out_path, lens=38):
    cam = bpy.data.objects.get("ORED_Cam")
    if not cam:
        cam = bpy.data.objects.new("ORED_Cam", bpy.data.cameras.new("ORED_Cam_Data"))
        bpy.context.scene.collection.objects.link(cam)
    cam.location = cam_loc
    cam.rotation_euler = [math.radians(r) for r in cam_rot]
    cam.data.lens = lens
    cam.data.clip_start = 0.1
    cam.data.clip_end = 300.0
    bpy.context.scene.camera = cam

    sun = bpy.data.objects.get("ORED_Sun")
    if not sun:
        sun = bpy.data.objects.new("ORED_Sun", bpy.data.lights.new("ORED_Sun_Data", type='SUN'))
        bpy.context.scene.collection.objects.link(sun)
    sun.data.energy = 2.0
    sun.data.color = (1.0, 0.98, 0.94)
    sun.rotation_euler = (math.radians(45), math.radians(20), math.radians(-35))

    fill = bpy.data.objects.get("ORED_Fill")
    if not fill:
        fill = bpy.data.objects.new("ORED_Fill", bpy.data.lights.new("ORED_Fill_Data", type='SUN'))
        bpy.context.scene.collection.objects.link(fill)
    fill.data.energy = 0.70
    fill.data.color = (0.75, 0.85, 1.0)
    fill.rotation_euler = (math.radians(55), math.radians(-30), math.radians(140))

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


# 1. Front elevation (matches IMG_3808)
render_view((0.0, -31.0, 3.6), (86.0, 0.0, 0.0), r"c:\Users\LGU-SanPedro\Downloads\map\ored_render_front.png", lens=35)

# 2. Entrance portico & 3D signage close-up
render_view((0.0, -20.5, 3.2), (87.5, 0.0, 0.0), r"c:\Users\LGU-SanPedro\Downloads\map\ored_render_entrance.png", lens=45)

# 3. 3/4 front-south perspective showing South 5-bay elevation (matches IMG_3809)
render_view((24.0, -27.0, 8.5), (78.0, 0.0, 42.0), r"c:\Users\LGU-SanPedro\Downloads\map\ored_render_south.png", lens=32)

# 4. 3/4 front-north perspective showing North elevation & link awning (matches IMG_3807 / 3806)
render_view((-24.0, -27.0, 8.5), (78.0, 0.0, -42.0), r"c:\Users\LGU-SanPedro\Downloads\map\ored_render_north.png", lens=32)

# 5. Direct elevation close-up of connecting canopy & pillars (matches IMG_3806)
render_view((-22.0, 7.5, 2.8), (87.5, 0.0, -90.0), r"c:\Users\LGU-SanPedro\Downloads\map\ored_render_canopy_close.png", lens=36)
