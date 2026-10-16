"""
render_campus_duo.py — Verification render of ORED Building and Admin Building side-by-side.
Tests relative scale, height difference (Admin 2 storeys vs ORED 1 storey), and canopy breezeway link.
"""

import bpy
import math

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
# In Mapbox: ORED is at [121.16618375, 13.95877731] with rotation 90.0°
# When rotation is 90°: Blender -Y (front) faces West, +Y (rear) faces East, -X faces North.
# To place both in world coordinates (X = East, Y = North, Z = Up):
bpy.ops.import_scene.gltf(filepath=r"c:\Users\LGU-SanPedro\Downloads\map\models\ored_building.glb")
ored_root = bpy.context.selected_objects[0]
while ored_root.parent:
    ored_root = ored_root.parent
ored_root.name = "ORED_Imported"
ored_root.location = (0, 0, 0)
ored_root.rotation_euler = (0, 0, math.radians(90)) # Rotate so Blender -Y points West, -X points North

# Import Admin GLB
# In Mapbox: Admin is at [121.16633791, 13.95877751] with rotation 0.0°
# Relative position: dx = +16.63 m East, dy = +0.02 m North
# In Admin Blender model: -Y is South, +Y is North, -X is West, +X is East.
# At rotation 0.0°: -Y points South, +Y points North, -X points West, +X points East.
bpy.ops.import_scene.gltf(filepath=r"c:\Users\LGU-SanPedro\Downloads\map\models\admin_building.glb")
admin_root = [o for o in bpy.context.selected_objects if o != ored_root][0]
while admin_root.parent and admin_root.parent != ored_root:
    admin_root = admin_root.parent
admin_root.name = "Admin_Imported"
admin_root.location = (16.63, 0.02, 0)
admin_root.rotation_euler = (0, 0, 0)

# Camera looking from North-West (from parking driveway looking at both buildings & breezeway)
cam = bpy.data.objects.new("Duo_Cam", bpy.data.cameras.new("Duo_Cam_Data"))
bpy.context.scene.collection.objects.link(cam)
cam.location = (8.0, 36.0, 14.0)
cam.rotation_euler = (math.radians(70), math.radians(0), math.radians(180))
cam.data.lens = 32
bpy.context.scene.camera = cam

# Lighting
sun = bpy.data.objects.new("Duo_Sun", bpy.data.lights.new("Duo_Sun_Data", type='SUN'))
bpy.context.scene.collection.objects.link(sun)
sun.data.energy = 2.4
sun.data.color = (1.0, 0.98, 0.94)
sun.rotation_euler = (math.radians(50), math.radians(25), math.radians(-40))

fill = bpy.data.objects.new("Duo_Fill", bpy.data.lights.new("Duo_Fill_Data", type='SUN'))
bpy.context.scene.collection.objects.link(fill)
fill.data.energy = 0.8
fill.data.color = (0.75, 0.85, 1.0)
fill.rotation_euler = (math.radians(55), math.radians(-30), math.radians(140))

scene = bpy.context.scene
scene.render.resolution_x = 1440
scene.render.resolution_y = 810
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\duo_render_north_link.png"
names = [c.name for c in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items]
scene.view_settings.view_transform = 'AgX' if 'AgX' in names else 'Standard'
bpy.ops.render.render(write_still=True)
print("Rendered duo_render_north_link.png")
