import bpy
import math
import os

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='c:/Users/LGU-SanPedro/Downloads/map/models/canteen.glb')

# Camera
cam_data = bpy.data.cameras.new("Canteen_Cam")
cam_obj = bpy.data.objects.new("Canteen_Cam", cam_data)
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj
cam_data.lens = 28

# Sun Light
sun_data = bpy.data.lights.new(name="Sun", type='SUN')
sun_data.energy = 4.0
sun_obj = bpy.data.objects.new(name="Sun", object_data=sun_data)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(45), math.radians(18), math.radians(-35))

# Fill Light
fill_data = bpy.data.lights.new(name="Fill", type='SUN')
fill_data.energy = 1.8
fill_obj = bpy.data.objects.new(name="Fill", object_data=fill_data)
bpy.context.scene.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(60), math.radians(-20), math.radians(135))

# World background
world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs['Color'].default_value = (0.88, 0.92, 0.96, 1.0)
    bg_node.inputs['Strength'].default_value = 0.85

bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 720

brain_dir = r"C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\b6d2da97-aefb-4be7-8790-50927e71af8b"

# 1. Matching user screenshot angle (Elevated Front looking at front sidewalk)
cam_obj.location = (0.0, -18.0, 7.5)
cam_obj.rotation_euler = (math.radians(68), 0, 0)
bpy.context.scene.render.filepath = f"{brain_dir}/canteen_fixed_front.png"
bpy.ops.render.render(write_still=True)
print("Render 1 saved (Front View matching screenshot).")

# 2. Left side angle (showing clean left edge with no excess stairs)
cam_obj.location = (-15.0, -15.0, 4.5)
cam_obj.rotation_euler = (math.radians(75), 0, math.radians(-42))
bpy.context.scene.render.filepath = f"{brain_dir}/canteen_fixed_left.png"
bpy.ops.render.render(write_still=True)
print("Render 2 saved (Left side angle).")
