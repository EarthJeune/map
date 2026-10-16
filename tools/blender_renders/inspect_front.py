import socket
import json

code = '''
import bpy

for o in bpy.data.objects:
    if "Front" in o.name:
        print(f"{o.name}: loc={o.location}, scale={o.scale}")
'''

s = socket.socket()
s.settimeout(5.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({"type": "execute_code", "params": {"code": code}}).encode('utf-8') + b'\n')

data = s.recv(4096)
print(data.decode('utf-8'))
s.close()
