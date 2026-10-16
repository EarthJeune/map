import socket
import json
import time

def send_blender_code(code):
    s = socket.socket()
    s.settimeout(10.0)
    s.connect(('127.0.0.1', 9876))
    req = {'type': 'execute_code', 'params': {'code': code}}
    s.sendall(json.dumps(req).encode('utf-8') + b'\n')
    data = b""
    while True:
        try:
            chunk = s.recv(4096)
            if not chunk or b'\n' in chunk:
                data += chunk
                break
            data += chunk
        except Exception:
            break
    s.close()
    return data.decode('utf-8', errors='ignore')

def take_screenshot(filepath):
    s = socket.socket()
    s.settimeout(10.0)
    s.connect(('127.0.0.1', 9876))
    req = {'type': 'get_viewport_screenshot', 'params': {'filepath': filepath}}
    s.sendall(json.dumps(req).encode('utf-8') + b'\n')
    data = s.recv(4096)
    s.close()
    return data.decode('utf-8', errors='ignore')

# Corridor shot capturing left half-wall, doors straight ahead, and right doorway to lounge
code_corridor = '''
import bpy, math, mathutils
from mathutils import Vector

for window in bpy.context.window_manager.windows:
    for area in window.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    r3d = space.region_3d
                    r3d.view_perspective = 'PERSP'
                    # Camera inside corridor looking towards doors
                    r3d.view_location = Vector((3.8, -1.8, 1.5))
                    r3d.view_distance = 4.2
                    r3d.view_rotation = mathutils.Euler((math.radians(88), 0, math.radians(-3))).to_quaternion()
'''
send_blender_code(code_corridor)
time.sleep(0.4)
take_screenshot(r"c:\Users\LGU-SanPedro\Downloads\map\argosino_corridor_3792.png")
print("Perfect corridor shot captured!")
