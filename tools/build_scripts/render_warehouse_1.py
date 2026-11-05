import socket
import json
import os

render_code = r'''
import bpy
import math

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Import GLB
glb_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\warehouse_1.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)

# Set up clean white world lighting
world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("RenderWorld")
    bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs['Color'].default_value = (0.92, 0.94, 0.96, 1.0)
    bg.inputs['Strength'].default_value = 1.0

# Add sun light
bpy.ops.object.light_add(type='SUN', location=(10, -15, 20))
sun = bpy.context.active_object
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(50), math.radians(15), math.radians(-35))

# Add fill light
bpy.ops.object.light_add(type='SUN', location=(-15, 10, 15))
fill = bpy.context.active_object
fill.data.energy = 1.2
fill.rotation_euler = (math.radians(60), math.radians(-20), math.radians(120))

# Create camera
bpy.ops.object.camera_add()
cam = bpy.context.active_object
bpy.context.scene.camera = cam

# Set render settings
scene = bpy.context.scene
scene.render.resolution_x = 1000
scene.render.resolution_y = 750
scene.render.image_settings.file_format = 'PNG'

# 1. Front View (Looking at East facade from -Y towards +Y)
# Front wall is at Y = -4.955, Door is at X = -1.95
cam.location = (-1.95, -12.5, 3.2)
cam.rotation_euler = (math.radians(82), 0, 0)
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_1_front.png"
bpy.ops.render.render(write_still=True)
print("Rendered front view")

# 2. Isometric 3/4 View (South-East angle)
cam.location = (-9.5, -12.0, 7.5)
cam.rotation_euler = (math.radians(65), 0, math.radians(-40))
scene.render.filepath = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\preview_warehouse_1_iso.png"
bpy.ops.render.render(write_still=True)
print("Rendered isometric view")
'''

s = socket.socket()
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({"type": "execute_code", "params": {"code": render_code}}).encode('utf-8') + b'\n')
data = s.recv(4096)
print(data.decode('utf-8', errors='ignore'))
s.close()

