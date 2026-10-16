import bpy
import math

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='c:/Users/LGU-SanPedro/Downloads/map/models/admin_building.glb')

# Camera
cam_data = bpy.data.cameras.new("VerifCam")
cam_obj = bpy.data.objects.new("VerifCam", cam_data)
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj
cam_data.lens = 32

# Lighting: Key Sun + Soft Sky Fill + Porch Ground Bounce
sun_data = bpy.data.lights.new(name="Sun", type='SUN')
sun_data.energy = 3.5
sun_obj = bpy.data.objects.new(name="Sun", object_data=sun_data)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(-30))

fill_data = bpy.data.lights.new(name="Fill", type='SUN')
fill_data.energy = 1.8
fill_obj = bpy.data.objects.new(name="Fill", object_data=fill_data)
bpy.context.scene.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(70), math.radians(-20), math.radians(120))

porch_fill = bpy.data.lights.new(name="PorchFill", type='POINT')
porch_fill.energy = 60.0
porch_fill.shadow_soft_size = 1.0
porch_fill_obj = bpy.data.objects.new(name="PorchFill", object_data=porch_fill)
bpy.context.scene.collection.objects.link(porch_fill_obj)
porch_fill_obj.location = (0.0, -11.5, 1.2)

# World background color
world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs['Color'].default_value = (0.85, 0.90, 0.95, 1.0)
    bg_node.inputs['Strength'].default_value = 0.8

bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 720

brain_dir = r"C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\b6d2da97-aefb-4be7-8790-50927e71af8b"

# 1. User Screenshot 1 Angle (Front 3/4 Perspective)
cam_obj.location = (-1.8, -16.8, 2.7)
cam_obj.rotation_euler = (math.radians(85), 0, math.radians(-12))
bpy.context.scene.render.filepath = f"{brain_dir}/admin_canopy_user_angle_1.png"
bpy.ops.render.render(write_still=True)
print("Render 1 saved.")

# 2. User Screenshot 2 Angle (Side Profile showing clean solid geometry)
cam_obj.location = (5.5, -12.5, 3.2)
cam_obj.rotation_euler = (math.radians(88), 0, math.radians(65))
bpy.context.scene.render.filepath = f"{brain_dir}/admin_canopy_user_angle_2.png"
bpy.ops.render.render(write_still=True)
print("Render 2 saved.")

# 3. Authentic IMG_3810 Full Entrance Beauty Shot
cam_obj.location = (0.8, -17.5, 2.8)
cam_obj.rotation_euler = (math.radians(86), 0, math.radians(5))
bpy.context.scene.render.filepath = f"{brain_dir}/admin_canopy_entrance_3810.png"
bpy.ops.render.render(write_still=True)
print("Render 3 saved.")

# 4. Elevated 3/4 Perspective Overview
cam_obj.location = (7.5, -18.5, 7.0)
cam_obj.rotation_euler = (math.radians(68), 0, math.radians(35))
bpy.context.scene.render.filepath = f"{brain_dir}/admin_canopy_perspective_beauty.png"
bpy.ops.render.render(write_still=True)
print("Render 4 saved.")
