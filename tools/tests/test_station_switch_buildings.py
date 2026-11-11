import asyncio
import json
import subprocess
import urllib.request
import base64
import websockets

async def test_reproduce():
    port = 9250
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        f'--remote-debugging-port={port}',
        '--window-size=1280,800',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?station=lares'
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

            print("Waiting for LARES to load...")
            for _ in range(40):
                ready = await eval_js("Boolean(window.map && window.map.loaded() && window.map.getLayer('3d-buildings-models-layer'))")
                if ready:
                    break
                await asyncio.sleep(0.5)

            # Dismiss modal
            await eval_js("""
                const m = document.getElementById('dash-welcome-modal');
                if (m) { m.style.display = 'none'; m.remove(); }
                if (typeof window.closeDashWelcomeModal === 'function') window.closeDashWelcomeModal();
                if (typeof window.stopIntroAnimation === 'function') window.stopIntroAnimation();
            """)
            await asyncio.sleep(1.0)

            # Initial LARES state
            features_cnt = await eval_js("window.map.getSource('lares-3d-buildings-models-source') ? window.map.getSource('lares-3d-buildings-models-source')._data.features.length : 0")
            bldg_vis = await eval_js("window.map.getLayoutProperty('3d-buildings-models-layer', 'visibility')")
            print(f"[Initial LARES] 3D Models source feature count: {features_cnt}, layer visibility: {bldg_vis}")

            # Switch to RARES
            print("\nSwitching station to RARES...")
            await eval_js("window.switchResearchStation('rares', true);")
            await asyncio.sleep(3.0)

            rares_cnt = await eval_js("window.map.getSource('lares-3d-buildings-models-source') ? window.map.getSource('lares-3d-buildings-models-source')._data.features.length : 0")
            rares_vis = await eval_js("window.map.getLayoutProperty('3d-buildings-models-layer', 'visibility')")
            print(f"[In RARES] 3D Models source feature count: {rares_cnt}, layer visibility: {rares_vis}")

            # Switch back to LARES
            print("\nSwitching station back to LARES...")
            await eval_js("window.switchResearchStation('lares', true);")
            await asyncio.sleep(3.0)

            back_cnt = await eval_js("window.map.getSource('lares-3d-buildings-models-source') ? window.map.getSource('lares-3d-buildings-models-source')._data.features.length : 0")
            back_vis = await eval_js("window.map.getLayoutProperty('3d-buildings-models-layer', 'visibility')")
            back_drawings = await eval_js("window.map.getLayoutProperty('3d-drawings', 'visibility')")
            print(f"[Back in LARES] 3D Models source feature count: {back_cnt}, layer visibility: {back_vis}")
            print(f"[Back in LARES] 3d-drawings visibility: {back_drawings}")

            assert back_cnt >= 40, f"Expected at least 40 LARES 3D models, got {back_cnt}!"

            # Camera jump to Tanco Hall / Admin Building in LARES
            print("\nFraming Tanco Hall & Admin Building in LARES...")
            await eval_js("""
                window.map.jumpTo({
                    center: [121.16645, 13.9584],
                    zoom: 18.5,
                    pitch: 55,
                    bearing: 25
                });
            """)
            await asyncio.sleep(2.0)

            res = await call_cdp('Page.captureScreenshot', {'format': 'jpeg', 'quality': 90})
            img_data = base64.b64decode(res['data'])
            screenshot_path = r"C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d\lares_buildings_restored_after_switch.jpg"
            with open(screenshot_path, 'wb') as f:
                f.write(img_data)
            print(f"Saved screenshot: {screenshot_path}")

            print("\nAll station switch building retention tests PASSED successfully!")

    finally:
        proc.kill()

if __name__ == '__main__':
    asyncio.run(test_reproduce())
