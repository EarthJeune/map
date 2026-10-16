import socket
import json

code = '''
import bpy, math

# Isolate Guard House objects
for obj in bpy.data.objects:
    if obj.type in ['CAMERA', 'LIGHT']:
        continue
    if obj.name.startswith("GH_"):
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
sun.location = (5.0, -12.0, 15.0)
sun.rotation_euler = (math.radians(52), math.radians(10), math.radians(-20))

bpy.context.scene.render.resolution_x = 1080
bpy.context.scene.render.resolution_y = 675

# 1. Front View matching IMG_3813 (Looking from the driveway at porch, tree, gate)
cam.location = (0.6, -9.8, 2.2)
cam.rotation_euler = (math.radians(82), 0, math.radians(-4))
cam.data.lens = 32
bpy.context.scene.render.filepath = r'c:\\Users\\LGU-SanPedro\\Downloads\\map\\guard_house_render_front.png'
bpy.ops.render.render(write_still=True)

# 2. 3/4 Perspective Beauty Shot (Elevated 3/4 view showing hipped roof, tree, and compound gate)
cam.location = (-6.5, -8.5, 4.8)
cam.rotation_euler = (math.radians(68), 0, math.radians(-38))
cam.data.lens = 30
bpy.context.scene.render.filepath = r'c:\\Users\\LGU-SanPedro\\Downloads\\map\\guard_house_render_perspective.png'
bpy.ops.render.render(write_still=True)

# 3. Guard Desk & Inspection Bay Close-Up
cam.location = (1.5, -5.2, 1.6)
cam.rotation_euler = (math.radians(82), 0, math.radians(2))
cam.data.lens = 36
bpy.context.scene.render.filepath = r'c:\\Users\\LGU-SanPedro\\Downloads\\map\\guard_house_render_desk_close.png'
bpy.ops.render.render(write_still=True)

print('All 3 Guard House renders finished!')
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
