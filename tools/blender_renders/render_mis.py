import socket
import json

render_code = '''
import bpy

scene = bpy.context.scene
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = r"c:\\Users\\LGU-SanPedro\\Downloads\\map\\mis_rafis_render.png"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderEngine.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'

# Render still image
bpy.ops.render.render(write_still=True)
print("Render complete!")
'''

s = socket.socket()
s.settimeout(30.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({"type": "execute_code", "params": {"code": render_code}}).encode('utf-8') + b'\n')

# Wait for response
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
        print("Timeout or finished:", e)
        break

print(data.decode('utf-8', errors='ignore'))
s.close()
