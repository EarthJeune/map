import socket
import json

code = '''
import bpy

# Set camera to frame Tanco_Hall_Building
empty = bpy.data.objects.get("Tanco_Hall_Building")
cam = bpy.data.objects.get("Camera")
if empty and cam:
    cam.location = (-12.0, -22.0, 10.0)
    # Point at (0, -2, 2)
    import mathutils
    direction = mathutils.Vector((0, -2, 2)) - cam.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam.rotation_euler = rot_quat.to_euler()

# Select only Tanco objects
for obj in bpy.context.scene.objects:
    obj.select_set(obj.name.startswith("Tanco_"))
'''

s = socket.socket()
s.settimeout(10.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({'type': 'execute_code', 'params': {'code': code}}).encode('utf-8') + b'\n')
data = s.recv(4096)
print("Code result:", data.decode('utf-8'))

req = {
    "type": "get_viewport_screenshot",
    "params": {
        "filepath": r"c:\Users\LGU-SanPedro\Downloads\map\tanco_hall_viewport.png"
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
