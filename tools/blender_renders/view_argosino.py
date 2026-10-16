import socket
import json
import time

code = '''
import bpy
import math
import mathutils
from mathutils import Vector

for obj in bpy.data.objects:
    if obj.name.startswith("Argosino_"):
        obj.hide_viewport = False
        obj.hide_render = False
    else:
        obj.hide_viewport = True
        obj.hide_render = True

for window in bpy.context.window_manager.windows:
    screen = window.screen
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    space.shading.use_scene_lights = True
                    space.shading.use_scene_world = True
                    
                    r3d = space.region_3d
                    r3d.view_perspective = 'PERSP'
                    # View 1: Exact Front Facade Elevation (matching user's screenshot)
                    # Looking from -Y to +Y: Left is -X (main hall), Right is +X (entrance porch & canopy!)
                    r3d.view_location = Vector((0.0, 0.0, 2.0))
                    r3d.view_distance = 28.0
                    r3d.view_rotation = mathutils.Euler((math.radians(82), 0, 0)).to_quaternion()

print("Viewport set to Front Facade (Entrance on Right)!")
'''

s = socket.socket()
s.settimeout(10.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({'type': 'execute_code', 'params': {'code': code}}).encode('utf-8') + b'\n')
res = s.recv(4096)
print("Front View:", res.decode('utf-8'))
s.close()

time.sleep(0.5)

# Screenshot 1: Front Elevation
s = socket.socket()
s.settimeout(10.0)
s.connect(('127.0.0.1', 9876))
req = {
    "type": "get_viewport_screenshot",
    "params": {
        "filepath": r"c:\Users\LGU-SanPedro\Downloads\map\argosino_front_facade.png"
    }
}
s.sendall(json.dumps(req).encode('utf-8') + b'\n')
data = s.recv(4096)
print("Screenshot 1 Result:", data.decode('utf-8', errors='ignore'))
s.close()

# View 2: Close-up on the Kiosk & Porch
code_kiosk = '''
import bpy
import math
import mathutils
from mathutils import Vector

for window in bpy.context.window_manager.windows:
    screen = window.screen
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    r3d = space.region_3d
                    r3d.view_perspective = 'PERSP'
                    # Kiosk is at X ~ 4.8, Y ~ -6.3, Z ~ 1.2
                    r3d.view_location = Vector((4.8, -6.0, 1.3))
                    r3d.view_distance = 3.6
                    # Looking slightly angled at the kiosk face and plaque
                    r3d.view_rotation = mathutils.Euler((math.radians(80), 0, math.radians(-15))).to_quaternion()

print("Viewport set to Kiosk Close-up!")
'''

s = socket.socket()
s.settimeout(10.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({'type': 'execute_code', 'params': {'code': code_kiosk}}).encode('utf-8') + b'\n')
res = s.recv(4096)
print("Kiosk View:", res.decode('utf-8'))
s.close()

time.sleep(0.5)

# Screenshot 2: Kiosk Close-up
s = socket.socket()
s.settimeout(10.0)
s.connect(('127.0.0.1', 9876))
req = {
    "type": "get_viewport_screenshot",
    "params": {
        "filepath": r"c:\Users\LGU-SanPedro\Downloads\map\argosino_kiosk_closeup.png"
    }
}
s.sendall(json.dumps(req).encode('utf-8') + b'\n')
data = s.recv(4096)
print("Screenshot 2 Result:", data.decode('utf-8', errors='ignore'))
s.close()
