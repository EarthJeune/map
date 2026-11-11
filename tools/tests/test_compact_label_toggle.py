import asyncio
import json
import subprocess
import urllib.request
import base64
import os
import websockets

async def run_test():
    port = 9248
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        f'--remote-debugging-port={port}',
        '--window-size=1200,900',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?station=rares'
    ])

    try:
        await asyncio.sleep(3.0)
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{port}/json').read())
        target_tab = next(t for t in tabs if t.get('type') == 'page')
        ws_url = target_tab['webSocketDebuggerUrl']

        async with websockets.connect(ws_url) as ws:
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
                res = await call_cdp('Page.captureScreenshot', {'format': 'png'})
                img_data = base64.b64decode(res['data'])
                with open(filepath, 'wb') as f:
                    f.write(img_data)
                print(f"Saved screenshot: {filepath}")

            print("Waiting for map and markers...")
            for _ in range(40):
                ready = await eval_js("Boolean(window.map && window.map.loaded() && document.querySelectorAll('.bldg-map-marker').length > 0)")
                if ready:
                    break
                await asyncio.sleep(0.5)

            marker_count = await eval_js("document.querySelectorAll('.bldg-map-marker').length")
            print(f"Total building markers on map: {marker_count}")

            # 1. Switch to Compact Number mode
            print("Switching to Compact Number mode...")
            await eval_js("if (typeof window.setLabelDisplayMode === 'function') window.setLabelDisplayMode('compact');")
            await asyncio.sleep(0.5)

            is_compact = await eval_js("document.body.classList.contains('label-mode-compact')")
            print(f"Body has label-mode-compact: {is_compact}")

            # Check visibility of first marker before toggle
            first_disp = await eval_js("window.getComputedStyle(document.querySelector('.bldg-map-marker')).display")
            print(f"First marker display in Compact mode (ON): {first_disp}")

            # 2. Toggle Building Labels OFF
            print("Toggling Building Labels OFF...")
            await eval_js("if (typeof window.handleLayerToggle === 'function') window.handleLayerToggle('numbers', false);")
            await asyncio.sleep(0.5)

            labels_hidden = await eval_js("document.body.classList.contains('labels-hidden')")
            state_markers_visible = await eval_js("(window.state && window.state.markersVisible)")
            print(f"document.body.classList.contains('labels-hidden'): {labels_hidden}")
            print(f"window.state.markersVisible: {state_markers_visible}")

            # Check all markers computed display
            visible_markers = await eval_js("""
                Array.from(document.querySelectorAll('.bldg-map-marker')).filter(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                }).length
            """)
            print(f"Number of visible building markers when toggled OFF in Compact mode: {visible_markers}")

            screenshot_dir = r"C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d"
            await take_screenshot(os.path.join(screenshot_dir, "rares_compact_labels_off_verified.png"))

            # 3. Toggle Building Labels back ON
            print("Toggling Building Labels back ON...")
            await eval_js("if (typeof window.handleLayerToggle === 'function') window.handleLayerToggle('numbers', true);")
            await asyncio.sleep(0.5)

            visible_markers_after_on = await eval_js("""
                Array.from(document.querySelectorAll('.bldg-map-marker')).filter(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden';
                }).length
            """)
            print(f"Number of visible building markers after toggling back ON: {visible_markers_after_on}")
            await take_screenshot(os.path.join(screenshot_dir, "rares_compact_labels_on_verified.png"))

            # Now test LARES station as well
            print("\nTesting LARES station...")
            await eval_js("if (typeof window.switchStation === 'function') window.switchStation('lares');")
            await asyncio.sleep(3.0)

            # In LARES, switch to Compact and toggle OFF
            await eval_js("if (typeof window.setLabelDisplayMode === 'function') window.setLabelDisplayMode('compact');")
            await eval_js("if (typeof window.handleLayerToggle === 'function') window.handleLayerToggle('numbers', false);")
            await asyncio.sleep(0.5)

            lares_visible_markers = await eval_js("""
                Array.from(document.querySelectorAll('.bldg-map-marker')).filter(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                }).length
            """)
            print(f"LARES visible markers when toggled OFF in Compact mode: {lares_visible_markers}")

            if visible_markers == 0 and lares_visible_markers == 0:
                print("SUCCESS: Building labels are 100% hidden when toggled off in Compact Number mode!")
            else:
                print(f"FAILURE: Some markers were still visible! (RARES: {visible_markers}, LARES: {lares_visible_markers})")

    finally:
        proc.terminate()
        proc.wait()

if __name__ == '__main__':
    asyncio.run(run_test())

