import socket
import json

code = '''
import bpy
import math

cam = bpy.data.objects.get("Camera")
if cam:
    cam.location = (0.5, -4.5, 25.0) # Directly above the building
    cam.rotation_euler = (0, 0, 0) # Top-down
'''

s = socket.socket()
s.settimeout(10.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({'type': 'execute_code', 'params': {'code': code}}).encode('utf-8') + b'\n')
data = s.recv(4096)

req = {
    "type": "get_viewport_screenshot",
    "params": {
        "filepath": r"c:\Users\LGU-SanPedro\Downloads\map\tanco_t_roof_topdown.png"
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
s.close()
print("Topdown screenshot taken!")
