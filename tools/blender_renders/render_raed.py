import socket
import json

code = '''
import bpy, math

# Isolate RAED objects
for obj in bpy.data.objects:
    if obj.type in ['CAMERA', 'LIGHT']:
        continue
    if obj.name.startswith("RAED_"):
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

# Configure Lighting
sun = bpy.data.objects.get("Sun_Light")
if not sun:
    s_data = bpy.data.lights.new(name="Sun_Light", type='SUN')
    sun = bpy.data.objects.new("Sun_Light", object_data=s_data)
    bpy.context.scene.collection.objects.link(sun)
sun.data.energy = 4.2
sun.location = (8.0, -18.0, 18.0)
sun.rotation_euler = (math.radians(50), math.radians(12), math.radians(-25))

bpy.context.scene.render.resolution_x = 1080
bpy.context.scene.render.resolution_y = 675

# 1. Front Elevation View matching IMG_3811 (Looking down approach path)
cam.location = (0.0, -22.5, 2.8)
cam.rotation_euler = (math.radians(84), 0, 0)
cam.data.lens = 32
bpy.context.scene.render.filepath = r'c:\\Users\\LGU-SanPedro\\Downloads\\map\\raed_render_front.png'
bpy.ops.render.render(write_still=True)

# 2. Perspective 3/4 View matching IMG_3812 (South-West corner & side wall)
cam.location = (-19.5, -20.0, 5.5)
cam.rotation_euler = (math.radians(76), 0, math.radians(-42))
cam.data.lens = 30
bpy.context.scene.render.filepath = r'c:\\Users\\LGU-SanPedro\\Downloads\\map\\raed_render_sw.png'
bpy.ops.render.render(write_still=True)

# 3. Canopy & Signboard Close-up
cam.location = (0.0, -13.5, 2.4)
cam.rotation_euler = (math.radians(86), 0, 0)
cam.data.lens = 35
bpy.context.scene.render.filepath = r'c:\\Users\\LGU-SanPedro\\Downloads\\map\\raed_render_canopy_close.png'
bpy.ops.render.render(write_still=True)

print('All 3 RAED renders finished!')
'''

s = socket.socket()
s.settimeout(15.0)
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
