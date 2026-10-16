import socket
import json

code = '''
import bpy

bpy.ops.object.select_all(action='DESELECT')
# Also disable overlays if desired or keep clean
for window in bpy.context.window_manager.windows:
    for area in window.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.overlay.show_overlays = False

print("Deselected and overlays hidden for clean beauty shot!")
'''

s = socket.socket()
s.settimeout(5.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({"type": "execute_code", "params": {"code": code}}).encode('utf-8') + b'\n')
data = s.recv(4096)
print(data.decode('utf-8'))
s.close()
