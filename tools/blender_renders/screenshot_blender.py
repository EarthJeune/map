import socket
import json

s = socket.socket()
s.settimeout(10.0)
s.connect(('127.0.0.1', 9876))
req = {
    "type": "get_viewport_screenshot",
    "params": {
        "filepath": r"c:\Users\LGU-SanPedro\Downloads\map\mis_rafis_viewport.png"
    }
}
s.sendall(json.dumps(req).encode('utf-8') + b'\n')

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
        print("Done/timeout:", e)
        break

print(data.decode('utf-8', errors='ignore'))
s.close()
