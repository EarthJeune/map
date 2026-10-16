import bpy
import math

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='c:/Users/LGU-SanPedro/Downloads/map/models/admin_building.glb')

# Ensure camera
cam_data = bpy.data.cameras.new("DebugCam")
cam_obj = bpy.data.objects.new("DebugCam", cam_data)
bpy.context.scene.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

# Camera facing South entrance (similar to user screenshot 1)
# User is at south-west looking at south entrance
cam_obj.location = (-1.5, -16.0, 3.2)
cam_obj.rotation_euler = (math.radians(82), 0, math.radians(-10))
cam_data.lens = 35

# Lighting
light_data = bpy.data.lights.new(name="Sun", type='SUN')
light_data.energy = 3.0
light_obj = bpy.data.objects.new(name="Sun", object_data=light_data)
bpy.context.scene.collection.objects.link(light_obj)
light_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(-30))

# Render settings
bpy.context.scene.render.resolution_x = 1280
bpy.context.scene.render.resolution_y = 720
bpy.context.scene.render.filepath = 'c:/Users/LGU-SanPedro/Downloads/map/scratch/debug_south_1.png'
bpy.ops.render.render(write_still=True)
print("Render 1 saved.")

# Render 2: side view similar to screenshot 2
cam_obj.location = (6.0, -12.5, 3.2)
cam_obj.rotation_euler = (math.radians(88), 0, math.radians(65))
bpy.context.scene.render.filepath = 'c:/Users/LGU-SanPedro/Downloads/map/scratch/debug_south_2.png'
bpy.ops.render.render(write_still=True)
print("Render 2 saved.")
