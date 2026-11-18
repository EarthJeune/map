import asyncio
import json
import subprocess
import urllib.request
import base64
import os
import websockets

async def run_verification():
    port = 9251
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

            # Check if rares_building_2 has 3D model
            bldg_registered = await eval_js("""
                Boolean(window.CUSTOM_3D_BUILDINGS && window.CUSTOM_3D_BUILDINGS['rares_building_2'])
            """)
            print(f"rares_building_2 registered in CUSTOM_3D_BUILDINGS: {bldg_registered}")

            # Check models registered on map
            model_id = await eval_js("window.CUSTOM_3D_BUILDINGS && window.CUSTOM_3D_BUILDINGS['rares_building_2'] && window.CUSTOM_3D_BUILDINGS['rares_building_2'].modelId")
            has_model = await eval_js(f"window.map.hasModel('{model_id}')")
            print(f"Model {model_id} registered on map: {has_model}")

            # 1. Perspective view of Admin Building from the approach walkway (facing ENE / looking at front entrance)
            print("\nJumping camera to Admin Building front entrance view...")
            await eval_js("""
                window.map.jumpTo({
                    center: [121.34062777, 14.57621614],
                    zoom: 19.5,
                    pitch: 58,
                    bearing: 103.5
                });
            """)
            await asyncio.sleep(2.5)

            art_dir = r"C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d"
            await take_screenshot(os.path.join(art_dir, "rares_admin_live_perspective.jpg"))

            # 2. Backside view showing the authentic stepped rear architecture on live map
            print("\nJumping camera to Admin Building backside view...")
            await eval_js("""
                window.map.jumpTo({
                    center: [121.34062777, 14.57621614],
                    zoom: 19.5,
                    pitch: 58,
                    bearing: 283.5
                });
            """)
            await asyncio.sleep(2.5)
            await take_screenshot(os.path.join(art_dir, "rares_admin_live_backside.jpg"))

            # 3. Top-down view matching the orientation of user diagram media_1794447530767_09225256.jpg
            print("\nJumping camera to top-down view aligned with user diagram (bearing 103.5)...")
            await eval_js("""
                window.map.jumpTo({
                    center: [121.34062777, 14.57621614],
                    zoom: 20.2,
                    pitch: 0,
                    bearing: 103.5,
                    offset: [-180, 0]
                });
            """)
            await asyncio.sleep(2.0)
            await take_screenshot(os.path.join(art_dir, "rares_admin_live_topdown_aligned.jpg"))

            # 3b. Standard north-up topdown view
            print("\nJumping camera to standard north-up top-down view...")
            await eval_js("""
                window.map.jumpTo({
                    center: [121.34062777, 14.57621614],
                    zoom: 20.0,
                    pitch: 0,
                    bearing: 0,
                    offset: [-180, 0]
                });
            """)
            await asyncio.sleep(2.0)
            await take_screenshot(os.path.join(art_dir, "rares_admin_live_topdown.jpg"))

            # 4. Open Admin Building detail drawer and capture screenshot
            print("\nOpening Admin Building detail drawer...")
            await eval_js("""
                if (typeof window.showBuildingPanel === 'function') {
                    window.showBuildingPanel('rares_building_2');
                }
            """)
            await asyncio.sleep(2.5)
            await take_screenshot(os.path.join(art_dir, "rares_admin_live_drawer.jpg"))

            print("\nVerification complete! All screenshots captured.")

    finally:
        proc.kill()

if __name__ == '__main__':
    asyncio.run(run_verification())
