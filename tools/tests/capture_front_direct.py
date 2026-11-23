import asyncio
import json
import subprocess
import urllib.request
import websockets
import base64

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9297

async def main():
    p = subprocess.Popen([
        EDGE_PATH,
        '--headless=new',
        f'--remote-debugging-port={PORT}',
        '--window-size=1280,800',
        '--no-sandbox',
        '--force-device-scale-factor=1',
        'http://localhost:8080/?station=rares'
    ])
    try:
        await asyncio.sleep(3.0)
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{PORT}/json').read())
        t = next(x for x in tabs if 'localhost:8080' in x.get('url',''))
        async with websockets.connect(t['webSocketDebuggerUrl']) as ws:
            mid = 0
            async def ev(expr):
                nonlocal mid; mid += 1
                await ws.send(json.dumps({'id': mid, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get('id') == mid: return m.get('result',{}).get('result',{}).get('value')

            async def screenshot(filename):
                nonlocal mid; mid += 1
                await ws.send(json.dumps({'id': mid, 'method': 'Page.captureScreenshot', 'params': {'format': 'jpeg', 'quality': 95}}))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get('id') == mid:
                        data = base64.b64decode(m['result']['data'])
                        with open(filename, 'wb') as f:
                            f.write(data)
                        print(f"Saved screenshot: {filename} ({len(data)} bytes)")
                        return

            await asyncio.sleep(2.0)
            await ev('if (typeof closeDashWelcomeModal === "function") closeDashWelcomeModal();')
            await ev('const m = document.getElementById("dash-welcome-modal"); if (m) m.remove();')
            await ev('const b = document.getElementById("station-dev-modal"); if (b) b.remove();')
            await ev('document.getElementById("sidebar").style.display = "none";')
            await ev('document.querySelectorAll(".mapboxgl-marker").forEach(el => el.style.display = "none");')
            await asyncio.sleep(1.0)

            # Direct FRONT FACADE view from garden facing the portico & arched RARES sign
            await ev('''
                map.jumpTo({
                    center: [121.34062777, 14.57621614],
                    zoom: 21.0,
                    pitch: 58,
                    bearing: 160.0
                });
            ''')
            await asyncio.sleep(2.0)
            await screenshot('live_admin_front_direct.jpg')
            print("Front direct captured!")
    finally:
        p.terminate()

if __name__ == '__main__':
    asyncio.run(main())

