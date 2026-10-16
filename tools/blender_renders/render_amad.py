import socket
import json

code = '''
import bpy, math

# Isolate AMAD Building objects
for obj in bpy.data.objects:
    if obj.type in ['CAMERA', 'LIGHT']:
        continue
    if obj.name.startswith("AMAD_"):
        obj.hide_viewport = False
        obj.hide_render = False
    else:
        obj.hide_viewport = True
        obj.hide_render = True

cam = bpy.data.objects.get('Camera')
if not cam:
    cd = bpy.data.cameras.new('Camera')
    cam = bpy.data.objects.new('Camera', cd)
    bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

# Set World ambient daylight
world = bpy.context.scene.world
if not world:
    world = bpy.data.worlds.new("AMAD_World")
    bpy.context.scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs['Color'].default_value = (0.75, 0.82, 0.90, 1.0) # Soft daylight sky
    bg_node.inputs['Strength'].default_value = 1.2

# Configure Sun Lighting
sun = bpy.data.objects.get("Sun_Light")
if not sun:
    s_data = bpy.data.lights.new(name="Sun_Light", type='SUN')
    sun = bpy.data.objects.new("Sun_Light", object_data=s_data)
    bpy.context.scene.collection.objects.link(sun)
sun.data.energy = 3.8
sun.location = (6.0, -16.0, 18.0)
sun.rotation_euler = (math.radians(52), math.radians(10), math.radians(-20))

bpy.context.scene.render.resolution_x = 1080
bpy.context.scene.render.resolution_y = 675

# 1. Front View matching IMG_3814 (From front lawn looking at entrance, windows, DA seal, roof)
cam.location = (0.0, -18.5, 3.0)
cam.rotation_euler = (math.radians(84), 0, 0)
cam.data.lens = 32
bpy.context.scene.render.filepath = r'c:\\Users\\LGU-SanPedro\\Downloads\\map\\amad_render_front.png'
bpy.ops.render.render(write_still=True)

# 2. 3/4 Perspective View matching IMG_3815 (From SW driveway approach showing side windows, A/C, lamp, roof)
cam.location = (-16.5, -17.5, 4.2)
cam.rotation_euler = (math.radians(80), 0, math.radians(-42))
cam.data.lens = 30
bpy.context.scene.render.filepath = r'c:\\Users\\LGU-SanPedro\\Downloads\\map\\amad_render_sw.png'
bpy.ops.render.render(write_still=True)

# 3. Entrance & Signboard Close-Up
cam.location = (0.0, -11.5, 2.5)
cam.rotation_euler = (math.radians(86), 0, 0)
cam.data.lens = 34
bpy.context.scene.render.filepath = r'c:\\Users\\LGU-SanPedro\\Downloads\\map\\amad_render_entrance_close.png'
bpy.ops.render.render(write_still=True)

print('All 3 AMAD renders finished!')
'''

s = socket.socket()
s.settimeout(30.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({'type': 'execute_code', 'params': {'code': code}}).encode('utf-8') + b'\n')
data = b""
while True:
    try:
        chunk = s.recv(4096)
        if not chunk:
            break
        data += chunk
        if b'\n' in data:
            break
    except Exception:
        break
s.close()
print(data.decode('utf-8', errors='ignore'))
