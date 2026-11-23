import asyncio
import json
import os
import subprocess
import urllib.request
import websockets
import base64

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9298

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
                await ws.send(json.dumps({'id': mid, 'method': 'Page.captureScreenshot', 'params': {'format': 'jpeg', 'quality': 90}}))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get('id') == mid:
                        data = base64.b64decode(m['result']['data'])
                        with open(filename, 'wb') as f:
                            f.write(data)
                        print(f"Saved screenshot: {filename} ({len(data)} bytes)")
                        return

            await asyncio.sleep(3.0)
            # Dismiss welcome modal
            await ev('if (typeof closeDashWelcomeModal === "function") closeDashWelcomeModal();')
            await ev('const m = document.getElementById("dash-welcome-modal"); if (m) m.remove();')
            await ev('const b = document.getElementById("station-dev-modal"); if (b) b.remove();')
            await asyncio.sleep(2.0)

            # Center on rares_building_2 [121.34062777, 14.57621614]
            # 1. FRONT VIEW:
            # Building rotation is 103.5 degrees.
            # In Mapbox: Bearing looking towards the FRONT of the building
            await ev('''
                map.flyTo({
                    center: [121.34062777, 14.57621614],
                    zoom: 19.8,
                    pitch: 62,
                    bearing: 13.5,
                    duration: 0
                });
            ''')
            await asyncio.sleep(3.0)
            await screenshot('live_rares_admin_front.jpg')

            # 2. FRONT ANGLED PERSPECTIVE:
            await ev('''
                map.flyTo({
                    center: [121.34062777, 14.57621614],
                    zoom: 20.0,
                    pitch: 65,
                    bearing: 55.0,
                    duration: 0
                });
            ''')
            await asyncio.sleep(2.0)
            await screenshot('live_rares_admin_front_angle.jpg')

            # 3. BACK VIEW (looking at the rear wall from backyard):
            await ev('''
                map.flyTo({
                    center: [121.34062777, 14.57621614],
                    zoom: 19.8,
                    pitch: 62,
                    bearing: 193.5,
                    duration: 0
                });
            ''')
            await asyncio.sleep(2.5)
            await screenshot('live_rares_admin_back.jpg')

            # 4. BACK LEFT SIDE VIEW (South-East angle looking at South gable & service door):
            await ev('''
                map.flyTo({
                    center: [121.34062777, 14.57621614],
                    zoom: 20.2,
                    pitch: 65,
                    bearing: 145.0,
                    duration: 0
                });
            ''')
            await asyncio.sleep(2.0)
            await screenshot('live_rares_admin_back_left_side.jpg')

            print("Captured all live map screenshots!")
    finally:
        p.terminate()

if __name__ == '__main__':
    asyncio.run(main())

