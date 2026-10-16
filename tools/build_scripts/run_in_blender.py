import socket
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def run_script(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        code = f.read()

    s = socket.socket()
    s.settimeout(60.0)
    s.connect(('127.0.0.1', 9876))
    s.sendall(json.dumps({'type': 'execute_code', 'params': {'code': code}}).encode('utf-8') + b'\n')
    
    data = b""
    while True:
        try:
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
            try:
                res = json.loads(data.decode('utf-8'))
                break
            except ValueError:
                pass
        except Exception as e:
            break
    s.close()
    if 'res' not in locals():
        res = json.loads(data.decode('utf-8'))
    print("Full response:", res)

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'build_tanco_hall.py'
    run_script(target)
