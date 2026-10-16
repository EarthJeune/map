import bpy
import math
import os

# Import GLB or inspect current scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

glb_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\rnd_building.glb"
if os.path.exists(glb_path):
    bpy.ops.import_scene.gltf(filepath=glb_path)

# Set camera to view front facade (looking at front from -Y)
cam_data = bpy.data.cameras.new("RenderCam")
cam_obj = bpy.data.objects.new("RenderCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_obj.location = (0.0, -22.0, 5.5)
cam_obj.rotation_euler = (math.radians(82), 0, 0)

# Add sunlight
light_data = bpy.data.lights.new("Sun", type='SUN')
light_data.energy = 3.5
light_obj = bpy.data.objects.new("Sun", light_data)
bpy.context.collection.objects.link(light_obj)
light_obj.rotation_euler = (math.radians(45), math.radians(25), math.radians(-30))

# World background
world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs['Color'].default_value = (0.7, 0.8, 0.95, 1.0)
    bg.inputs['Strength'].default_value = 1.0

# Render settings
bpy.context.scene.render.engine = 'BLENDER_EEVEE'
bpy.context.scene.render.resolution_x = 1024
bpy.context.scene.render.resolution_y = 600

out_path = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\rnd_current_preview.png"
bpy.context.scene.render.filepath = out_path
bpy.ops.render.render(write_still=True)
print(f"Render saved to {out_path}")
