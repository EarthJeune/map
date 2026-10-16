"""
render_ored_admin_field_view.py — Verify accurate height comparison between ORED and Admin
Matching user Field Photograph (Image 3) and Map View (Image 2).
"""

import bpy
import math
import os

# Clear scene
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
for m in list(bpy.data.meshes):
    bpy.data.meshes.remove(m)
for mat in list(bpy.data.materials):
    bpy.data.materials.remove(mat)

world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (0.65, 0.78, 0.92, 1.0)
    bg.inputs["Strength"].default_value = 1.0

# 1. Import ORED GLB
ored_glb = r"c:\Users\LGU-SanPedro\Downloads\map\models\ored_building.glb"
pre_ored = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=ored_glb)
ored_objs = [o for o in bpy.data.objects if o not in pre_ored]

ored_anchor = bpy.data.objects.new("Anchor_ORED", None)
bpy.context.scene.collection.objects.link(ored_anchor)
ored_anchor.location = (0, 0, 0)
ored_anchor.rotation_euler = (0, 0, math.radians(-90)) # Mapbox rot 90 deg clockwise -> -90 deg Z in Blender

for o in ored_objs:
    if not o.parent:
        o.parent = ored_anchor

# 2. Import Admin GLB
admin_glb = r"c:\Users\LGU-SanPedro\Downloads\map\models\admin_building.glb"
pre_admin = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=admin_glb)
admin_objs = [o for o in bpy.data.objects if o not in pre_admin]

admin_anchor = bpy.data.objects.new("Anchor_Admin", None)
bpy.context.scene.collection.objects.link(admin_anchor)
admin_anchor.location = (16.65, 0, 0) # 16.65m East
admin_anchor.rotation_euler = (0, 0, 0)

for o in admin_objs:
    if not o.parent:
        o.parent = admin_anchor

# Lighting matching outdoor daylight
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun_Data", type='SUN'))
bpy.context.scene.collection.objects.link(sun)
sun.data.energy = 3.0
sun.data.color = (1.0, 0.98, 0.95)
sun.rotation_euler = (math.radians(50), math.radians(20), math.radians(-35))

fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill_Data", type='SUN'))
bpy.context.scene.collection.objects.link(fill)
fill.data.energy = 1.2
fill.data.color = (0.75, 0.85, 1.0)
fill.rotation_euler = (math.radians(60), math.radians(-30), math.radians(140))

# Camera
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam_Data"))
bpy.context.scene.collection.objects.link(cam)
cam.data.clip_start = 0.1
cam.data.clip_end = 500.0
bpy.context.scene.camera = cam

scene = bpy.context.scene
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'

# Render 1: Front South Elevation matching Image 2 & Image 3
# Looking from South (-Y) looking North (+Y)
cam.location = (7.5, -34.0, 4.2)
cam.rotation_euler = (math.radians(85.0), 0.0, 0.0)
cam.data.lens = 42
out1 = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\ored_admin_south_field_match.png"
scene.render.filepath = out1
bpy.ops.render.render(write_still=True)
print("Rendered South elevation:", out1)

# Render 2: 3/4 Perspective from South-West matching Image 1
cam.location = (-12.0, -32.0, 16.0)
cam.rotation_euler = (math.radians(65.0), 0.0, math.radians(-25.0))
cam.data.lens = 35
out2 = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\ored_admin_perspective_match.png"
scene.render.filepath = out2
bpy.ops.render.render(write_still=True)
print("Rendered Perspective:", out2)
