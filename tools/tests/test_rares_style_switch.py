import asyncio
import json
import os
import subprocess
import urllib.request
import websockets
import base64

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9295

async def test_multi_switch():
    p = subprocess.Popen([
        EDGE_PATH,
        '--headless=new',
        f'--remote-debugging-port={PORT}',
        '--window-size=1280,800',
        '--disable-gpu',
        '--no-sandbox',
        '--force-device-scale-factor=1',
        'http://localhost:8080/?station=rares'
    ])
    try:
        await asyncio.sleep(2.5)
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
                await ws.send(json.dumps({'id': mid, 'method': 'Page.captureScreenshot', 'params': {'format': 'jpeg', 'quality': 85}}))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get('id') == mid:
                        data = base64.b64decode(m['result']['data'])
                        with open(filename, 'wb') as f:
                            f.write(data)
                        print(f"Saved screenshot: {filename} ({len(data)} bytes)")
                        return

            await asyncio.sleep(3.0)
            await ev('if (typeof closeDashWelcomeModal === "function") closeDashWelcomeModal();')
            await ev('if (typeof handleDashWelcomeProceed === "function") handleDashWelcomeProceed();')
            await asyncio.sleep(1.5)

            # Check initial state
            init_state = await ev("""
            ({
                mode: state.currentMapStyleMode,
                hasOrtho: !!map.getLayer('rares-ortho-layer'),
                orthoVis: map.getLayer('rares-ortho-layer') ? map.getLayoutProperty('rares-ortho-layer', 'visibility') : null,
                hasMask: !!map.getLayer('rares-mask-layer'),
                maskVis: map.getLayer('rares-mask-layer') ? map.getLayoutProperty('rares-mask-layer', 'visibility') : null
            })
            """)
            print("1. Initial state (Drone):", json.dumps(init_state))
            await screenshot("rares_switch_1_initial_drone.jpg")

            # Switch to Mapbox
            print("2. Switching to Mapbox 3D...")
            await ev("selectMapStyle('mapbox');")
            await asyncio.sleep(3.5)
            mapbox_state = await ev("""
            ({
                mode: state.currentMapStyleMode,
                hasOrtho: !!map.getLayer('rares-ortho-layer'),
                orthoVis: map.getLayer('rares-ortho-layer') ? map.getLayoutProperty('rares-ortho-layer', 'visibility') : null,
                hasMask: !!map.getLayer('rares-mask-layer'),
                maskVis: map.getLayer('rares-mask-layer') ? map.getLayoutProperty('rares-mask-layer', 'visibility') : null
            })
            """)
            print("2. Switched to Mapbox:", json.dumps(mapbox_state))
            await screenshot("rares_switch_2_mapbox.jpg")

            # Switch back to Aerial Drone
            print("3. Switching back to Aerial Drone...")
            await ev("selectMapStyle('google');")
            await asyncio.sleep(3.5)
            return_drone_state = await ev("""
            ({
                mode: state.currentMapStyleMode,
                hasOrtho: !!map.getLayer('rares-ortho-layer'),
                orthoVis: map.getLayer('rares-ortho-layer') ? map.getLayoutProperty('rares-ortho-layer', 'visibility') : null,
                hasMask: !!map.getLayer('rares-mask-layer'),
                maskVis: map.getLayer('rares-mask-layer') ? map.getLayoutProperty('rares-mask-layer', 'visibility') : null
            })
            """)
            print("3. Returned to Aerial Drone:", json.dumps(return_drone_state))
            await screenshot("rares_switch_3_returned_drone.jpg")

            # Switch to Mapbox second time
            print("4. Switching to Mapbox second time...")
            await ev("selectMapStyle('mapbox');")
            await asyncio.sleep(3.5)
            mapbox_state2 = await ev("""
            ({
                mode: state.currentMapStyleMode,
                hasOrtho: !!map.getLayer('rares-ortho-layer'),
                orthoVis: map.getLayer('rares-ortho-layer') ? map.getLayoutProperty('rares-ortho-layer', 'visibility') : null
            })
            """)
            print("4. Switched to Mapbox second time:", json.dumps(mapbox_state2))

            # Switch back to Aerial Drone second time
            print("5. Switching back to Aerial Drone second time...")
            await ev("selectMapStyle('google');")
            await asyncio.sleep(3.5)
            return_drone_state2 = await ev("""
            ({
                mode: state.currentMapStyleMode,
                hasOrtho: !!map.getLayer('rares-ortho-layer'),
                orthoVis: map.getLayer('rares-ortho-layer') ? map.getLayoutProperty('rares-ortho-layer', 'visibility') : null,
                hasMask: !!map.getLayer('rares-mask-layer'),
                maskVis: map.getLayer('rares-mask-layer') ? map.getLayoutProperty('rares-mask-layer', 'visibility') : null
            })
            """)
            print("5. Returned to Aerial Drone second time:", json.dumps(return_drone_state2))
            await screenshot("rares_switch_5_returned_drone_again.jpg")

    finally:
        p.terminate()

asyncio.run(test_multi_switch())
