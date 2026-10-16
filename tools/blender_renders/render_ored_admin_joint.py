"""
render_ored_admin_joint.py — Renders joint verification views of ORED and Admin Buildings
placed side-by-side at their authentic relative coordinates to verify:
1. Both buildings' North and South walls are parallel and flush.
2. Both canopy roofs have the exact same downward pitch.
3. Both header beams and pillar lines are collinear and parallel.
"""

import bpy
import math
import os

# Clear scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
for m in list(bpy.data.meshes):
    bpy.data.meshes.remove(m)

world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (0.72, 0.83, 0.95, 1.0)
    bg.inputs["Strength"].default_value = 0.90

# Import ORED GLB
ored_glb = r"c:\Users\LGU-SanPedro\Downloads\map\models\ored_building.glb"
bpy.ops.import_scene.gltf(filepath=ored_glb)
ored_root = bpy.context.selected_objects[0] if bpy.context.selected_objects else None
# Find imported root
ored_imported = [o for o in bpy.context.scene.objects if o.name.startswith("ORED") or o.name == "RootNode"]

# Create an empty for ORED at origin, rotated 90 deg clockwise (in Blender Euler: -90 deg around Z)
ored_anchor = bpy.data.objects.new("Anchor_ORED", None)
bpy.context.scene.collection.objects.link(ored_anchor)
ored_anchor.location = (0, 0, 0)
ored_anchor.rotation_euler = (0, 0, math.radians(-90)) # 90 deg clockwise around Z

for o in ored_imported:
    if not o.parent:
        o.parent = ored_anchor

# Import Admin GLB
admin_glb = r"c:\Users\LGU-SanPedro\Downloads\map\models\admin_building.glb"
# Note existing objects
pre_admin = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=admin_glb)
admin_imported = [o for o in bpy.data.objects if o not in pre_admin]

# Admin is offset 16.65 m East (along +X in world space)
admin_anchor = bpy.data.objects.new("Anchor_Admin", None)
bpy.context.scene.collection.objects.link(admin_anchor)
admin_anchor.location = (16.65, 0, 0)
admin_anchor.rotation_euler = (0, 0, 0)

for o in admin_imported:
    if not o.parent:
        o.parent = admin_anchor

# Lighting
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun_Data", type='SUN'))
bpy.context.scene.collection.objects.link(sun)
sun.data.energy = 2.4
sun.data.color = (1.0, 0.98, 0.95)
sun.rotation_euler = (math.radians(45), math.radians(20), math.radians(-35))

fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill_Data", type='SUN'))
bpy.context.scene.collection.objects.link(fill)
fill.data.energy = 0.90
fill.data.color = (0.75, 0.85, 1.0)
fill.rotation_euler = (math.radians(55), math.radians(-30), math.radians(140))

cam = bpy.data.objects.new("Joint_Cam", bpy.data.cameras.new("Joint_Cam_Data"))
bpy.context.scene.collection.objects.link(cam)
cam.data.clip_start = 0.1
cam.data.clip_end = 400.0
bpy.context.scene.camera = cam

scene = bpy.context.scene
scene.render.resolution_x = 1280
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'

def render(loc, rot, path, lens=35):
    cam.location = loc
    cam.rotation_euler = [math.radians(r) for r in rot]
    cam.data.lens = lens
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("Rendered:", path)

# 1. 3/4 Perspective from North-West showing both buildings, matching user screenshot 1
render((5.0, 36.0, 16.0), (70.0, 0.0, 180.0), r"c:\Users\LGU-SanPedro\Downloads\map\joint_render_north_elevation.png", lens=35)

# 2. Side profile looking East along the canopy and front walls from ORED's West end, matching user screenshot 2
render((-14.0, 12.0, 3.5), (86.0, 0.0, -90.0), r"c:\Users\LGU-SanPedro\Downloads\map\joint_render_side_profile.png", lens=45)

# 3. Close-up of the Canopy Link Junction across the breezeway, matching user screenshot 3
render((9.5, 20.0, 5.0), (80.0, 0.0, 180.0), r"c:\Users\LGU-SanPedro\Downloads\map\joint_render_link_close.png", lens=50)

print("All joint verification renders complete!")
