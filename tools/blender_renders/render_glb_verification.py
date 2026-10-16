import bpy
import math
import os

# Reset scene to clean slate
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import the exported GLB model
glb_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\guard_house.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)

# Set world background to neutral outdoor light grey
world = bpy.data.worlds.new("OutdoorWorld")
bpy.context.scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs['Color'].default_value = (0.75, 0.80, 0.85, 1.0)
    bg_node.inputs['Strength'].default_value = 1.0

# Add Sun light
s_data = bpy.data.lights.new(name="Sun_Light", type='SUN')
sun = bpy.data.objects.new("Sun_Light", object_data=s_data)
bpy.context.scene.collection.objects.link(sun)
sun.data.energy = 3.5
sun.location = (6.0, -10.0, 14.0)
sun.rotation_euler = (math.radians(52), math.radians(10), math.radians(-25))

# Add soft fill light
f_data = bpy.data.lights.new(name="Fill_Light", type='SUN')
fill = bpy.data.objects.new("Fill_Light", object_data=f_data)
bpy.context.scene.collection.objects.link(fill)
fill.data.energy = 1.2
fill.rotation_euler = (math.radians(35), math.radians(-20), math.radians(120))

# Setup Camera
cam_data = bpy.data.cameras.new('Camera')
cam = bpy.data.objects.new('Camera', cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
bpy.context.scene.render.resolution_x = 1080
bpy.context.scene.render.resolution_y = 720

# 1. Matching user screenshot elevated front view
# Target is around (0.55, 0, 1.0)
cam.location = (0.55, -11.5, 7.8)
cam.rotation_euler = (math.radians(56), 0, 0)
cam.data.lens = 32
out1 = r"c:\Users\LGU-SanPedro\Downloads\map\guard_house_user_view.png"
bpy.context.scene.render.filepath = out1
bpy.ops.render.render(write_still=True)
print("Rendered:", out1)

# 2. 3/4 perspective elevated view
cam.location = (-6.5, -7.5, 4.5)
cam.rotation_euler = (math.radians(64), 0, math.radians(-42))
cam.data.lens = 32
out2 = r"c:\Users\LGU-SanPedro\Downloads\map\guard_house_clean_perspective.png"
bpy.context.scene.render.filepath = out2
bpy.ops.render.render(write_still=True)
print("Rendered:", out2)

# 3. Right flank view (where the wall and tall sign were previously located)
cam.location = (7.0, -3.5, 3.2)
cam.rotation_euler = (math.radians(70), 0, math.radians(60))
cam.data.lens = 35
out3 = r"c:\Users\LGU-SanPedro\Downloads\map\guard_house_right_flank.png"
bpy.context.scene.render.filepath = out3
bpy.ops.render.render(write_still=True)
print("Rendered:", out3)
