import socket
import json

code = '''
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
                    # Use studio lighting for bright, crisp architectural preview
                    space.shading.use_scene_lights = False
                    space.shading.use_scene_world = False
                    space.shading.studio_light = 'city.exr' if 'city.exr' in [s.name for s in bpy.context.preferences.studio_lights] else space.shading.studio_light
                    
                    # Zoom in closer to front-left corner
                    r3d = space.region_3d
                    r3d.view_perspective = 'PERSP'
                    r3d.view_distance = 16.5
                    r3d.view_location = Vector((-0.5, -4.0, 2.0))
                    # Angle matching IMG_3786 (corner view)
                    r3d.view_rotation = mathutils.Euler((math.radians(70), 0, math.radians(-38))).to_quaternion()

print("Studio lighting & close-up view set!")
'''

s = socket.socket()
s.settimeout(5.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({"type": "execute_code", "params": {"code": code}}).encode('utf-8') + b'\n')
data = s.recv(4096)
print(data.decode('utf-8'))
s.close()
