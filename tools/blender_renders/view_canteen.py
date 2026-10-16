import socket
import json
import time

def send_blender(payload):
    s = socket.socket()
    s.settimeout(10.0)
    s.connect(('127.0.0.1', 9876))
    s.sendall(json.dumps(payload).encode('utf-8') + b'\n')
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
    return json.loads(data.decode('utf-8'))

def capture_shots():
    # Shot 1: Front Elevation (Distance 21.0, pitch 82 deg)
    code_front = '''
import bpy
import math
import mathutils
from mathutils import Vector

bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.name.startswith("Canteen_"):
        obj.hide_viewport = False
        obj.hide_render = False
    else:
        obj.hide_viewport = True
        obj.hide_render = True

for window in bpy.context.window_manager.windows:
    for area in window.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    space.shading.use_scene_lights = True
                    space.shading.use_scene_world = True
                    space.overlay.show_overlays = False
                    
                    r3d = space.region_3d
                    r3d.view_perspective = 'PERSP'
                    r3d.view_location = Vector((0.0, -3.5, 2.3))
                    r3d.view_distance = 19.5
                    r3d.view_rotation = mathutils.Euler((math.radians(82), 0, 0)).to_quaternion()
'''
    send_blender({'type': 'execute_code', 'params': {'code': code_front}})
    time.sleep(0.4)
    send_blender({'type': 'get_viewport_screenshot', 'params': {'filepath': r'c:\Users\LGU-SanPedro\Downloads\map\canteen_front_elevation.png'}})
    print("Captured Front Elevation!")

    # Shot 2: Close-up on Entrance, "D.A. CANTEEN" sign & Selecta poster
    code_sign = '''
import bpy
import math
import mathutils
from mathutils import Vector

for window in bpy.context.window_manager.windows:
    for area in window.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    r3d = space.region_3d
                    r3d.view_location = Vector((2.0, -5.5, 2.2))
                    r3d.view_distance = 7.5
                    r3d.view_rotation = mathutils.Euler((math.radians(84), 0, 0)).to_quaternion()
'''
    send_blender({'type': 'execute_code', 'params': {'code': code_sign}})
    time.sleep(0.4)
    send_blender({'type': 'get_viewport_screenshot', 'params': {'filepath': r'c:\Users\LGU-SanPedro\Downloads\map\canteen_sign_close.png'}})
    print("Captured Sign Close-up!")

    # Shot 3: South-West Corner View (Steps + Clerestory Ribbon, matching IMG_3794)
    code_corner = '''
import bpy
import math
import mathutils
from mathutils import Vector

for window in bpy.context.window_manager.windows:
    for area in window.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    r3d = space.region_3d
                    r3d.view_location = Vector((-2.5, -3.0, 2.2))
                    r3d.view_distance = 19.0
                    r3d.view_rotation = mathutils.Euler((math.radians(72), 0, math.radians(-42))).to_quaternion()
'''
    send_blender({'type': 'execute_code', 'params': {'code': code_corner}})
    time.sleep(0.4)
    send_blender({'type': 'get_viewport_screenshot', 'params': {'filepath': r'c:\Users\LGU-SanPedro\Downloads\map\canteen_corner_steps.png'}})
    print("Captured SW Corner Steps!")

    # Shot 4: Elevated Aerial View (4-sided Hip Roof & Full Geometry)
    code_aerial = '''
import bpy
import math
import mathutils
from mathutils import Vector

for window in bpy.context.window_manager.windows:
    for area in window.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    r3d = space.region_3d
                    r3d.view_location = Vector((0.0, 0.0, 2.5))
                    r3d.view_distance = 25.0
                    r3d.view_rotation = mathutils.Euler((math.radians(48), 0, math.radians(-35))).to_quaternion()
'''
    send_blender({'type': 'execute_code', 'params': {'code': code_aerial}})
    time.sleep(0.4)
    send_blender({'type': 'get_viewport_screenshot', 'params': {'filepath': r'c:\Users\LGU-SanPedro\Downloads\map\canteen_aerial_roof.png'}})
    print("Captured Aerial Roof!")

if __name__ == '__main__':
    capture_shots()
