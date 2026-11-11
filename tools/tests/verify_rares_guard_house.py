import asyncio
import json
import subprocess
import urllib.request
import base64
import os
import websockets

async def run_verification():
    port = 9249
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        f'--remote-debugging-port={port}',
        '--window-size=1280,800',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?station=rares'
    ])

    try:
        await asyncio.sleep(3.0)
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{port}/json').read())
        target_tab = next(t for t in tabs if t.get('type') == 'page')
        ws_url = target_tab['webSocketDebuggerUrl']

        async with websockets.connect(ws_url, max_size=20*1024*1024) as ws:
            req_id = 0
            async def call_cdp(method, params=None):
                nonlocal req_id
                req_id += 1
                curr_id = req_id
                payload = {'id': curr_id, 'method': method}
                if params:
                    payload['params'] = params
                await ws.send(json.dumps(payload))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == curr_id:
                        return msg.get('result', {})

            async def eval_js(expr):
                res = await call_cdp('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
                return res.get('result', {}).get('value')

            async def take_screenshot(filepath):
                res = await call_cdp('Page.captureScreenshot', {'format': 'jpeg', 'quality': 90})
                img_data = base64.b64decode(res['data'])
                with open(filepath, 'wb') as f:
                    f.write(img_data)
                print(f"Saved screenshot: {filepath}")

            print("Waiting for map and 3D buildings layer...")
            for _ in range(40):
                ready = await eval_js("Boolean(window.map && window.map.loaded() && window.map.getLayer('3d-buildings-models-layer'))")
                if ready:
                    break
                await asyncio.sleep(0.5)

            # Dismiss welcome modal if open
            await eval_js("""
                const modal = document.getElementById('dash-welcome-modal');
                if (modal) {
                    modal.style.display = 'none';
                    modal.remove();
                }
                if (typeof window.closeDashWelcomeModal === 'function') window.closeDashWelcomeModal();
            """)
            await asyncio.sleep(0.5)

            # Stop any running intro animations
            await eval_js("if (typeof window.stopIntroAnimation === 'function') window.stopIntroAnimation();")
            await asyncio.sleep(1.0)

            # Check layer order
            layers = await eval_js("window.map.getStyle().layers.map(l => l.id)")
            print("\nMapbox layers order in style:")
            for i, layer_id in enumerate(layers):
                if any(k in layer_id for k in ['ortho', 'mask', '3d-buildings', 'plots', 'footprint']):
                    vis = await eval_js(f"window.map.getLayoutProperty('{layer_id}', 'visibility') || 'visible'")
                    print(f"  [{i:2d}] {layer_id} (visibility: {vis})")

            # Check if 3d-buildings-models-layer is above rares-ortho-layer
            ortho_idx = layers.index('rares-ortho-layer') if 'rares-ortho-layer' in layers else -1
            bldg_idx = layers.index('3d-buildings-models-layer') if '3d-buildings-models-layer' in layers else -1
            print(f"\nLayer indices: ortho={ortho_idx}, 3d_buildings={bldg_idx}")
            assert bldg_idx > ortho_idx, "3D building layer must be ABOVE ortho raster layer!"

            # Check building data features
            has_guard_house = await eval_js("""
                Boolean(window.map.getSource('rares-footprints-source') && 
                        window.raresBuildingsBaseline && 
                        window.raresBuildingsBaseline.features.some(f => f.properties && f.properties.id === 'rares_building_1' && f.properties.has_3d_model))
            """)
            print(f"Guard House registered with has_3d_model: {has_guard_house}")

            # Camera jump directly to the Guard House at angle
            print("\nJumping camera to Guard House...")
            await eval_js("""
                window.map.jumpTo({
                    center: [121.34054276, 14.57644291],
                    zoom: 19.5,
                    pitch: 58,
                    bearing: 195
                });
            """)
            await asyncio.sleep(2.0)

            # Capture direct view screenshot
            screenshot_path = r"C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d\rares_guard_house_live_verified.jpg"
            await take_screenshot(screenshot_path)

            # Also test top-down view to see roof and surroundings
            await eval_js("""
                window.map.jumpTo({
                    center: [121.34054276, 14.57644291],
                    zoom: 20,
                    pitch: 35,
                    bearing: 15
                });
            """)
            await asyncio.sleep(1.5)
            topdown_path = r"C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d\rares_guard_house_live_topdown.jpg"
            await take_screenshot(topdown_path)

            print("\nVerification complete! All assertions passed.")

    finally:
        proc.kill()

if __name__ == '__main__':
    asyncio.run(run_verification())
