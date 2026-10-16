import socket
import json

code = '''
import bpy
import math
import mathutils
from mathutils import Vector

# Find 3D Viewport space
for window in bpy.context.window_manager.windows:
    screen = window.screen
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    # Set shading to Material Preview
                    space.shading.type = 'MATERIAL'
                    space.shading.use_scene_lights = True
                    space.shading.use_scene_world = True
                    
                    # Set view to front-left perspective (looking at front door & left wall with AC)
                    r3d = space.region_3d
                    r3d.view_perspective = 'PERSP'
                    r3d.view_distance = 22.0
                    r3d.view_location = Vector((0.0, -2.5, 2.5))
                    # View from South-West (front is South, left is West)
                    # Euler rotation: pitch ~ 25 deg down, yaw ~ 35 deg from south
                    r3d.view_rotation = mathutils.Euler((math.radians(65), 0, math.radians(-35))).to_quaternion()

print("Viewport configured to Material Preview facing front-left facade!")
'''

s = socket.socket()
s.settimeout(5.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({"type": "execute_code", "params": {"code": code}}).encode('utf-8') + b'\n')
data = s.recv(4096)
print(data.decode('utf-8'))
s.close()
