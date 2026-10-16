import socket
import json

s = socket.socket()
s.settimeout(5.0)
s.connect(('127.0.0.1', 9876))
s.sendall(json.dumps({"type": "get_scene_info"}).encode('utf-8') + b'\n')
data = s.recv(4096)
print(data.decode('utf-8'))
s.close()
