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
    bg.inputs["Color"].default_value = (0.75, 0.85, 0.95, 1.0)
    bg.inputs["Strength"].default_value = 1.0

# 1. Import ORED GLB
ored_glb = r"c:\Users\LGU-SanPedro\Downloads\map\models\ored_building.glb"
pre_ored = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=ored_glb)
ored_objs = [o for o in bpy.data.objects if o not in pre_ored]

ored_anchor = bpy.data.objects.new("Anchor_ORED", None)
bpy.context.scene.collection.objects.link(ored_anchor)
ored_anchor.location = (0, 0, 0)
# In Mapbox: rotation = 90.0 deg clockwise -> in Blender Euler: -90 deg around Z
ored_anchor.rotation_euler = (0, 0, math.radians(-90))

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
# Mapbox coords offset: dx = 16.65 m (East)
admin_anchor.location = (16.65, 0, 0)
admin_anchor.rotation_euler = (0, 0, 0)

for o in admin_objs:
    if not o.parent:
        o.parent = admin_anchor

# Lighting
sun = bpy.data.lights.new("Sun", type='SUN')
sun.energy = 3.5
sun.color = (1.0, 0.98, 0.95)
sun_obj = bpy.data.objects.new("Sun", sun)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(-45))

fill = bpy.data.lights.new("Fill", type='SUN')
fill.energy = 1.8
fill.color = (0.85, 0.92, 1.0)
fill_obj = bpy.data.objects.new("Fill", fill)
bpy.context.scene.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(60), math.radians(-30), math.radians(135))

# Camera setup helper
cam_data = bpy.data.cameras.new("Joint_Cam")
cam_obj = bpy.data.objects.new("Joint_Cam", cam_data)
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') else 'BLENDER_EEVEE'
bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 960

center = (8.325, 0, 4.0)

# 1. TOP-DOWN VIEW (matching user's screenshot)
cam_obj.location = (8.325, 0, 32.0)
cam_obj.rotation_euler = (0, 0, math.radians(-90)) # Looking straight down
bpy.context.scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\ored_admin_topdown.png"
bpy.ops.render.render(write_still=True)
print("Rendered topdown view.")

# 2. SOUTH ELEVATION VIEW (showing height difference & open alleyway)
cam_obj.location = (8.325, -28.0, 5.5)
cam_obj.rotation_euler = (math.radians(85), 0, 0)
bpy.context.scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\ored_admin_south.png"
bpy.ops.render.render(write_still=True)
print("Rendered south view.")

# 3. NORTH ELEVATION VIEW (showing carport connecting canopy)
cam_obj.location = (8.325, 28.0, 5.5)
cam_obj.rotation_euler = (math.radians(95), 0, math.radians(180))
bpy.context.scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\ored_admin_north.png"
bpy.ops.render.render(write_still=True)
print("Rendered north view.")
