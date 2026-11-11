import asyncio
import json
import subprocess
import urllib.request
import base64
import websockets

async def verify_option_c():
    port = 9252
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

            async def take_screenshot(filepath):
                res = await call_cdp('Page.captureScreenshot', {'format': 'jpeg', 'quality': 90})
                img_data = base64.b64decode(res['data'])
                with open(filepath, 'wb') as f:
                    f.write(img_data)
                print(f"Saved screenshot: {filepath}")

            print("Waiting for map to initialize...")
            for _ in range(40):
                ready = await eval_js("Boolean(window.map && window.map.loaded() && window.map.getLayer('lares-3d-models-layer'))")
                if ready:
                    break
                await asyncio.sleep(0.5)

            await eval_js("""
                const m = document.getElementById('dash-welcome-modal');
                if (m) { m.style.display = 'none'; m.remove(); }
                if (typeof window.closeDashWelcomeModal === 'function') window.closeDashWelcomeModal();
                if (typeof window.stopIntroAnimation === 'function') window.stopIntroAnimation();
            """)
            await asyncio.sleep(1.0)

            # Step 1: Verify Initial LARES State
            print("\n--- STEP 1: Verifying Initial LARES State ---")
            lares_source_cnt = await eval_js("window.map.getSource('lares-3d-models-source') ? window.map.getSource('lares-3d-models-source')._data.features.length : 0")
            lares_layer_vis = await eval_js("window.map.getLayoutProperty('lares-3d-models-layer', 'visibility')")
            rares_layer_vis_init = await eval_js("window.map.getLayer('rares-3d-models-layer') ? window.map.getLayoutProperty('rares-3d-models-layer', 'visibility') : 'none'")
            print(f"LARES 3D Source feature count: {lares_source_cnt}")
            print(f"LARES 3D Layer visibility: {lares_layer_vis}")
            print(f"RARES 3D Layer visibility (should be none): {rares_layer_vis_init}")
            assert lares_source_cnt >= 40, f"Expected >= 40 LARES models, got {lares_source_cnt}"
            assert lares_layer_vis == 'visible', f"Expected visible, got {lares_layer_vis}"

            # Step 2: Switch to RARES
            print("\n--- STEP 2: Switching to RARES ---")
            await eval_js("window.switchResearchStation('rares', true);")
            await asyncio.sleep(3.0)

            rares_source_cnt = await eval_js("window.map.getSource('rares-3d-models-source') ? window.map.getSource('rares-3d-models-source')._data.features.length : 0")
            rares_layer_vis = await eval_js("window.map.getLayoutProperty('rares-3d-models-layer', 'visibility')")
            lares_layer_vis_in_rares = await eval_js("window.map.getLayoutProperty('lares-3d-models-layer', 'visibility')")
            lares_source_cnt_in_rares = await eval_js("window.map.getSource('lares-3d-models-source')._data.features.length")

            print(f"RARES 3D Source feature count: {rares_source_cnt}")
            print(f"RARES 3D Layer visibility: {rares_layer_vis}")
            print(f"LARES 3D Layer visibility in RARES (must be none): {lares_layer_vis_in_rares}")
            print(f"LARES 3D Source feature count while in RARES (MUST REMAIN INTACT >= 40): {lares_source_cnt_in_rares}")

            assert rares_source_cnt >= 1, f"Expected >= 1 RARES model, got {rares_source_cnt}"
            assert rares_layer_vis == 'visible', f"Expected RARES visible, got {rares_layer_vis}"
            assert lares_layer_vis_in_rares == 'none', f"Expected LARES hidden, got {lares_layer_vis_in_rares}"
            assert lares_source_cnt_in_rares >= 40, "LARES source must NOT be mutated when in RARES!"

            # Camera jump to Guard House in RARES and capture screenshot
            await eval_js("""
                window.map.jumpTo({
                    center: [121.34054276, 14.57644291],
                    zoom: 19.5,
                    pitch: 58,
                    bearing: 195
                });
            """)
            await asyncio.sleep(1.5)
            await take_screenshot(r"C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d\option_c_rares_guard_house.jpg")

            # Step 3: Switch back to LARES
            print("\n--- STEP 3: Switching back to LARES ---")
            await eval_js("window.switchResearchStation('lares', true);")
            await asyncio.sleep(3.0)

            lares_source_cnt_back = await eval_js("window.map.getSource('lares-3d-models-source')._data.features.length")
            lares_layer_vis_back = await eval_js("window.map.getLayoutProperty('lares-3d-models-layer', 'visibility')")
            rares_layer_vis_back = await eval_js("window.map.getLayoutProperty('rares-3d-models-layer', 'visibility')")

            print(f"Back in LARES, LARES 3D Source feature count: {lares_source_cnt_back}")
            print(f"Back in LARES, LARES 3D Layer visibility: {lares_layer_vis_back}")
            print(f"Back in LARES, RARES 3D Layer visibility (must be none): {rares_layer_vis_back}")

            assert lares_source_cnt_back >= 40, f"Expected >= 40, got {lares_source_cnt_back}"
            assert lares_layer_vis_back == 'visible', f"Expected visible, got {lares_layer_vis_back}"
            assert rares_layer_vis_back == 'none', f"Expected none, got {rares_layer_vis_back}"

            # Camera jump to Tanco Hall in LARES and capture screenshot
            await eval_js("""
                window.map.jumpTo({
                    center: [121.16645, 13.9584],
                    zoom: 18.5,
                    pitch: 55,
                    bearing: 25
                });
            """)
            await asyncio.sleep(1.5)
            await take_screenshot(r"C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d\option_c_lares_buildings.jpg")

            # Step 4: Multi-hop QARES roundtrip
            print("\n--- STEP 4: Multi-hop QARES roundtrip (LARES -> QARES -> RARES -> LARES) ---")
            await eval_js("window.switchResearchStation('qares', true);")
            await asyncio.sleep(2.0)
            lares_vis_in_qares = await eval_js("window.map.getLayoutProperty('lares-3d-models-layer', 'visibility')")
            rares_vis_in_qares = await eval_js("window.map.getLayoutProperty('rares-3d-models-layer', 'visibility')")
            assert lares_vis_in_qares == 'none' and rares_vis_in_qares == 'none', "Both 3D layers must be none in QARES"

            await eval_js("window.switchResearchStation('rares', true);")
            await asyncio.sleep(2.0)
            assert await eval_js("window.map.getLayoutProperty('rares-3d-models-layer', 'visibility')") == 'visible'

            await eval_js("window.switchResearchStation('lares', true);")
            await asyncio.sleep(2.0)
            assert await eval_js("window.map.getLayoutProperty('lares-3d-models-layer', 'visibility')") == 'visible'
            assert await eval_js("window.map.getSource('lares-3d-models-source')._data.features.length") >= 40

            print("\n🌟 ALL OPTION C VERIFICATION CHECKS PASSED FLAWLESSLY! 🌟")

    finally:
        proc.kill()

if __name__ == '__main__':
    asyncio.run(verify_option_c())

