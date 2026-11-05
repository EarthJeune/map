import socket
import json
import os

blender_code = r'''
import bpy
import math

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Import GLB
glb_path = r"c:\Users\LGU-SanPedro\Downloads\map\models\plot22_water_tank.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)

# Set world background to nice neutral daylight sky
world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (0.75, 0.82, 0.90, 1.0)
    bg.inputs["Strength"].default_value = 1.0

# Add key light (sun)
sun_data = bpy.data.lights.new(name="SunLight", type='SUN')
sun_data.energy = 4.0
sun_data.color = (1.0, 0.98, 0.92)
sun_obj = bpy.data.objects.new(name="Sun", object_data=sun_data)
bpy.context.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(45), math.radians(20), math.radians(-30))

# Add fill light
fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
fill_data.energy = 1.5
fill_data.color = (0.85, 0.90, 1.0)
fill_obj = bpy.data.objects.new(name="Fill", object_data=fill_data)
bpy.context.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(50), math.radians(-30), math.radians(150))

# Add Camera
cam_data = bpy.data.cameras.new(name="Camera")
cam_obj = bpy.data.objects.new(name="Camera", object_data=cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.render.film_transparent = False

# 1. Front Eye-Level Angle (Focusing on Signboard, Ladder, and Tower)
# Center of model is at (0, 0, 5.5)
cam_obj.location = (2.2, -7.5, 3.8)
cam_obj.rotation_euler = (math.radians(72), 0, math.radians(16))

out_img1 = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\render_water_tank_front.jpg"
scene.render.filepath = out_img1
bpy.ops.render.render(write_still=True)
print("RENDER_1_SUCCESS:", out_img1)

# 2. Hero Perspective Angle (Showing full height, catwalk, and tank)
target_empty = bpy.data.objects.new("TargetEmpty", None)
target_empty.location = (0, 0, 5.5)
bpy.context.collection.objects.link(target_empty)

track_con = cam_obj.constraints.new(type='TRACK_TO')
track_con.target = target_empty
track_con.track_axis = 'TRACK_NEGATIVE_Z'
track_con.up_axis = 'UP_Y'

cam_obj.location = (14.0, -16.0, 10.0)

out_img2 = r"c:\Users\LGU-SanPedro\Downloads\map\scratch\render_water_tank_hero.png"
scene.render.filepath = out_img2
bpy.ops.render.render(write_still=True)
print("RENDER_2_SUCCESS:", out_img2)
'''

def run_script():
    s = socket.socket()
    s.settimeout(60.0)
    s.connect(('127.0.0.1', 9876))
    s.sendall(json.dumps({'type': 'execute_code', 'params': {'code': blender_code}}).encode('utf-8') + b'\n')
    
    data = b""
    while True:
        try:
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
            try:
                res = json.loads(data.decode('utf-8'))
                break
            except ValueError:
                pass
        except Exception as e:
            break
    s.close()
    if 'res' not in locals():
        res = json.loads(data.decode('utf-8'))
    print("Blender response:", res)

if __name__ == '__main__':
    run_script()
