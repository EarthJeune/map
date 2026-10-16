import socket
import json

code = '''
import bpy
import math
import mathutils

cam = bpy.data.objects.get("Camera")
if cam:
    cam.location = (0.0, -18.0, 3.8) # Right in front of entrance, slightly elevated
    cam.rotation_euler = (math.radians(82), 0, 0) # Looking slightly up/forward at entrance

# Add Sun light for natural daylight illumination
sun = bpy.data.objects.get("Sun_Light")
if not sun:
    sun_data = bpy.data.lights.new(name="Sun_Light", type='SUN')
    sun_data.energy = 3.5
    sun_data.color = (1.0, 0.98, 0.95)
    sun = bpy.data.objects.new("Sun_Light", sun_data)
    bpy.context.scene.collection.objects.link(sun)
sun.location = (10, -15, 20)
sun.rotation_euler = (math.radians(45), math.radians(20), math.radians(25))

# Also ensure world ambient lighting is bright enough
world = bpy.context.scene.world
if world and world.use_nodes:
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.7, 0.8, 0.9, 1.0)
        bg.inputs["Strength"].default_value = 0.8
'''

s = socket.socket()
s.settimeout(10.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({'type': 'execute_code', 'params': {'code': code}}).encode('utf-8') + b'\n')
data = s.recv(4096)
print("Setup result:", data.decode('utf-8'))

req = {
    "type": "get_viewport_screenshot",
    "params": {
        "filepath": r"c:\Users\LGU-SanPedro\Downloads\map\tanco_hall_front.png"
    }
}
s.sendall(json.dumps(req).encode('utf-8') + b'\n')

data = b""
while True:
    try:
        chunk = s.recv(4096)
        if not chunk:
            break
        data += chunk
        if b'\n' in data:
            break
    except Exception as e:
        break
print("Screenshot result:", data.decode('utf-8', errors='ignore'))
s.close()
