import asyncio
import json
import subprocess
import urllib.request
import base64
import os
import websockets

async def run_verification():
    port = 9257
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

            # Clear cache and disable cache for fresh load
            await call_cdp('Network.enable')
            await call_cdp('Network.clearBrowserCache')
            await call_cdp('Network.setCacheDisabled', {'cacheDisabled': True})

            # Reload page with cache disabled
            await call_cdp('Page.reload', {'ignoreCache': True})
            await asyncio.sleep(2.0)

            print("Waiting for map and RARES 3D buildings layer...")
            for i in range(50):
                ready = await eval_js("Boolean(window.map && window.map.loaded() && (window.map.getLayer('rares-3d-models-layer') || window.map.getLayer('3d-buildings-models-layer')))")
                if ready:
                    print(f"Map ready at iteration {i}")
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

            # Hide all markers so 3D architectural geometry is 100% unobstructed
            await eval_js("""
                let s = document.getElementById('hide-markers-test');
                if (!s) {
                    s = document.createElement('style');
                    s.id = 'hide-markers-test';
                    s.innerHTML = '.mapboxgl-marker { display: none !important; }';
                    document.head.appendChild(s);
                }
            """)
            await asyncio.sleep(0.5)

            art_dir = r"C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d"

            # 1. Perspective view looking straight into the open front canopy from East (bearing 283.5)
            print("\n1. Capturing front view looking into open canopy from road...")
            await eval_js("""
                window.map.jumpTo({
                    center: [121.34053816, 14.57578799],
                    zoom: 20.0,
                    pitch: 50,
                    bearing: 283.5,
                    offset: [-180, 0]
                });
            """)
            await asyncio.sleep(3.0)
            await take_screenshot(os.path.join(art_dir, "rares_flatbed_live_front.jpg"))

            # 2. Angle showing Flatbed Dryer + Chemical Storage + Seed Storage integration
            print("\n2. Capturing perspective view showing Flatbed Dryer and Chemical Storage...")
            await eval_js("""
                window.map.jumpTo({
                    center: [121.340550, 14.575825],
                    zoom: 19.5,
                    pitch: 54,
                    bearing: 215.0,
                    offset: [-180, 0]
                });
            """)
            await asyncio.sleep(2.5)
            await take_screenshot(os.path.join(art_dir, "rares_flatbed_and_chem_shared.jpg"))

            # 3. Top-down view showing alignment with drone footprint
            print("\n3. Capturing top-down aerial footprint view...")
            await eval_js("""
                window.map.jumpTo({
                    center: [121.34053816, 14.57578799],
                    zoom: 20.0,
                    pitch: 0,
                    bearing: 0,
                    offset: [-180, 0]
                });
            """)
            await asyncio.sleep(2.5)
            await take_screenshot(os.path.join(art_dir, "rares_flatbed_live_topdown.jpg"))

            # 4. Open drawer via window.showBuildingPanel('rares_building_5')
            print("\n4. Opening detail drawer for rares_building_5...")
            await eval_js("""
                if (typeof window.showBuildingPanel === 'function') {
                    window.showBuildingPanel('rares_building_5');
                }
            """)
            await asyncio.sleep(2.5)
            await take_screenshot(os.path.join(art_dir, "rares_flatbed_live_drawer.jpg"))

            print("\nAll live verification captures complete!")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()

if __name__ == '__main__':
    asyncio.run(run_verification())
