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

# 1. Front Facade Overview
code_front = '''
import bpy, math, mathutils
from mathutils import Vector

for obj in bpy.data.objects:
    if obj.name.startswith("Argosino_"):
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
                    r3d = space.region_3d
                    r3d.view_perspective = 'PERSP'
                    r3d.view_location = Vector((0.0, -1.0, 2.2))
                    r3d.view_distance = 28.0
                    r3d.view_rotation = mathutils.Euler((math.radians(82), 0, 0)).to_quaternion()
'''
send_blender_code(code_front)
time.sleep(0.4)
take_screenshot(r"c:\Users\LGU-SanPedro\Downloads\map\argosino_front_facade.png")

# 2. View matching IMG_3791 (Kiosk with swivel chair, plaque, and way to the left)
code_3791 = '''
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
                    # Look at kiosk (7.2, -3.4), chair (6.3, -3.4), plaque (5.6, -2.2) and way to left (X < 5.0)
                    r3d.view_location = Vector((6.5, -3.2, 1.45))
                    r3d.view_distance = 4.4
                    r3d.view_rotation = mathutils.Euler((math.radians(85), 0, math.radians(-5))).to_quaternion()
'''
send_blender_code(code_3791)
time.sleep(0.4)
take_screenshot(r"c:\Users\LGU-SanPedro\Downloads\map\argosino_kiosk_3791.png")

# 3. View matching IMG_3792 (Looking down the corridor to the glass doors)
code_3792 = '''
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
                    # Corridor is X = 3.7. Looking straight +Y at doors at Y = 0.2
                    r3d.view_location = Vector((3.7, -1.8, 1.5))
                    r3d.view_distance = 4.2
                    r3d.view_rotation = mathutils.Euler((math.radians(88), 0, 0)).to_quaternion()
'''
send_blender_code(code_3792)
time.sleep(0.4)
take_screenshot(r"c:\Users\LGU-SanPedro\Downloads\map\argosino_corridor_3792.png")

# 4. Veranda Overview (Isometric)
code_overview = '''
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
                    r3d.view_location = Vector((6.8, -4.5, 2.0))
                    r3d.view_distance = 13.0
                    r3d.view_rotation = mathutils.Euler((math.radians(72), 0, math.radians(-24))).to_quaternion()
'''
send_blender_code(code_overview)
time.sleep(0.4)
take_screenshot(r"c:\Users\LGU-SanPedro\Downloads\map\argosino_veranda_overview.png")

print("All screenshots updated!")
