"""
render_admin_beauty.py — Verification renders of the Admin Building model.
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
    bg.inputs["Color"].default_value = (0.72, 0.83, 0.95, 1.0)
    bg.inputs["Strength"].default_value = 0.90


def render_view(cam_loc, cam_rot, out_path, lens=38):
    cam = bpy.data.objects.get("Admin_Cam")
    if not cam:
        cam = bpy.data.objects.new("Admin_Cam", bpy.data.cameras.new("Admin_Cam_Data"))
        bpy.context.scene.collection.objects.link(cam)
    cam.location = cam_loc
    cam.rotation_euler = [math.radians(r) for r in cam_rot]
    cam.data.lens = lens
    cam.data.clip_start = 0.1
    cam.data.clip_end = 300.0
    bpy.context.scene.camera = cam

    sun = bpy.data.objects.get("Admin_Sun")
    if not sun:
        sun = bpy.data.objects.new("Admin_Sun", bpy.data.lights.new("Admin_Sun_Data", type='SUN'))
        bpy.context.scene.collection.objects.link(sun)
    sun.data.energy = 2.2
    sun.data.color = (1.0, 0.98, 0.94)
    sun.rotation_euler = (math.radians(45), math.radians(20), math.radians(-35))

    fill = bpy.data.objects.get("Admin_Fill")
    if not fill:
        fill = bpy.data.objects.new("Admin_Fill", bpy.data.lights.new("Admin_Fill_Data", type='SUN'))
        bpy.context.scene.collection.objects.link(fill)
    fill.data.energy = 0.80
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


# 1. South elevation (matches IMG_3810: Portico, STIARC gold sign, double doors, 2 storeys)
render_view((0.5, -28.0, 5.0), (83.0, 0.0, 0.0), r"c:\Users\LGU-SanPedro\Downloads\map\admin_render_south.png", lens=35)

# 2. South portico & STIARC sign close-up (matches IMG_3810 entrance)
render_view((1.0, -19.0, 3.2), (86.0, 0.0, 0.0), r"c:\Users\LGU-SanPedro\Downloads\map\admin_render_sign.png", lens=45)

# 3. North elevation (matches IMG_3805: Ramp, ground-floor continuous canopy, 2nd floor windows & ACs)
render_view((0.0, 28.0, 5.0), (97.0, 0.0, 180.0), r"c:\Users\LGU-SanPedro\Downloads\map\admin_render_north.png", lens=35)

# 4. 3/4 perspective North-West showing connecting canopy link that joins ORED (matches IMG_3806)
render_view((-18.0, 24.0, 9.0), (76.0, 0.0, -145.0), r"c:\Users\LGU-SanPedro\Downloads\map\admin_render_link_nw.png", lens=32)

# 5. 3/4 perspective South-West showing 2-storey height and breezeway
render_view((-18.0, -24.0, 9.0), (76.0, 0.0, -35.0), r"c:\Users\LGU-SanPedro\Downloads\map\admin_render_sw.png", lens=32)

# 6. Direct close-up of North Ground-Floor Entrance Doors & Ramp
render_view((0.0, 17.5, 1.7), (88.0, 0.0, 180.0), r"c:\Users\LGU-SanPedro\Downloads\map\admin_render_north_entrance_close.png", lens=45)

# 7. Side profile looking West along canopy & pillars from East (verifying downward slope & pillar connection)
render_view((14.0, 11.5, 2.8), (88.0, 0.0, 90.0), r"c:\Users\LGU-SanPedro\Downloads\map\admin_render_canopy_profile.png", lens=45)
