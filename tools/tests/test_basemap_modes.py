import asyncio
import json
import os
import subprocess
import urllib.request
import websockets
import base64

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9265
ARTIFACTS_DIR = r'C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d'

async def test_basemap_modes():
    print("=== Testing Drone Aerial View vs. Mapbox 3D Standard Mode ===")
    
    proc = subprocess.Popen([
        EDGE_PATH,
        '--headless=new',
        f'--remote-debugging-port={PORT}',
        '--window-size=1920,1080',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])
    
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{PORT}/json').read())
        target = next((t for t in tabs if t.get('type') == 'page' and 'localhost:8080' in t.get('url', '')), None)
        if not target:
            target = next(t for t in tabs if t.get('type') == 'page')
            
        async with websockets.connect(target['webSocketDebuggerUrl'], max_size=20*1024*1024) as ws:
            msg_id = 0
            async def send_cmd(method, params=None):
                nonlocal msg_id
                msg_id += 1
                curr_id = msg_id
                await ws.send(json.dumps({'id': curr_id, 'method': method, 'params': params or {}}))
                while True:
                    raw = await ws.recv()
                    msg = json.loads(raw)
                    if msg.get('id') == curr_id:
                        return msg.get('result', {})

            async def eval_js(expr):
                res = await send_cmd('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
                return res.get('result', {}).get('value')

            # Wait for map & dismiss welcome modal
            print("1. Waiting for map ready & dismissing welcome modal...")
            for _ in range(40):
                await asyncio.sleep(0.3)
                ready = await eval_js('Boolean(window.state && window.state.mapReady)')
                if ready:
                    break

            await eval_js('window.handleWelcomeSelectStation("lares")')
            await asyncio.sleep(3.5) # Let intro animation settle

            # Stop intro if still animating and set a stable overview perspective
            await eval_js('''
                if (window.map) {
                    window.map.stop();
                    window.map.easeTo({
                        center: [121.1663, 13.9587],
                        zoom: 18.2,
                        pitch: 52,
                        bearing: 165,
                        duration: 0
                    });
                }
            ''')
            await asyncio.sleep(1.5)

            # 1. Capture Drone Aerial View Mode (Default)
            print("2. Capturing Mode 1: Aerial Drone View (Photorealistic Orthomosaic)...")
            shot1 = await send_cmd('Page.captureScreenshot', {'format': 'jpeg', 'quality': 90})
            drone_path = os.path.join(ARTIFACTS_DIR, 'basemap_mode_drone_aerial.jpg')
            with open(drone_path, 'wb') as f:
                f.write(base64.b64decode(shot1['data']))
            print(f"   Saved Drone Aerial View to: {drone_path}")

            # 2. Switch to Mapbox 3D Standard View Mode
            print("3. Switching to Mode 2: Mapbox 3D Standard View Mode...")
            await eval_js('window.selectMapStyle("mapbox")')
            await asyncio.sleep(3.5) # Wait for Mapbox style to load and 3D buildings to re-render

            current_mode = await eval_js('window.state.currentMapStyleMode')
            print(f"   Active map style mode: {current_mode}")

            shot2 = await send_cmd('Page.captureScreenshot', {'format': 'jpeg', 'quality': 90})
            mapbox_path = os.path.join(ARTIFACTS_DIR, 'basemap_mode_mapbox_standard.jpg')
            with open(mapbox_path, 'wb') as f:
                f.write(base64.b64decode(shot2['data']))
            print(f"   Saved Mapbox 3D Standard View to: {mapbox_path}")

            # 3. Create side-by-side composite comparison
            print("4. Creating side-by-side comparison artifact...")
            from PIL import Image
            im_drone = Image.open(drone_path)
            im_mapbox = Image.open(mapbox_path)
            
            w, h = im_drone.size
            comp = Image.new('RGB', (w * 2, h))
            comp.paste(im_drone, (0, 0))
            comp.paste(im_mapbox, (w, 0))
            
            comp_path = os.path.join(ARTIFACTS_DIR, 'SS-02B_basemap_modes_comparison.jpg')
            comp.save(comp_path, 'JPEG', quality=88)
            print(f"   Saved side-by-side comparison to: {comp_path}")
            print("=== Basemap Modes Test Successful! ===")

    finally:
        proc.kill()

if __name__ == '__main__':
    asyncio.run(test_basemap_modes())

