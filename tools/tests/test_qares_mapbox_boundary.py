import asyncio
import json
import subprocess
import urllib.request
import websockets
import base64
import os
import shutil

ARTIFACT_DIR = r'C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\ff627781-c64f-4830-bce7-fdd70763aee1'

async def run():
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        '--remote-debugging-port=9238',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen('http://localhost:9238/json').read())
        target_tab = next(t for t in tabs if t.get('type') == 'page')
        ws_url = target_tab['webSocketDebuggerUrl']
        async with websockets.connect(ws_url) as ws:
            async def eval_js(expr):
                await ws.send(json.dumps({'id': 10, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == 10:
                        return msg.get('result', {}).get('result', {}).get('value')

            async def screenshot(filename):
                await ws.send(json.dumps({'id': 11, 'method': 'Page.captureScreenshot'}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == 11:
                        data = base64.b64decode(msg['result']['data'])
                        with open(filename, 'wb') as f:
                            f.write(data)
                        break

            for _ in range(30):
                await asyncio.sleep(0.25)
                if await eval_js('window.state && window.state.mapReady'):
                    break

            await eval_js('const btn = document.getElementById("dash-proceed-btn"); if (btn) btn.click(); const modal = document.getElementById("dash-welcome-modal"); if (modal) modal.style.display = "none";')
            await asyncio.sleep(1.0)

            # Switch to QARES
            print('[Test] Switching to QARES...')
            await eval_js('switchResearchStation("qares")')
            await asyncio.sleep(2.5)

            # Center on QARES compound
            await eval_js('window.state.map.jumpTo({ center: [121.3712, 13.9430], zoom: 17.5, pitch: 0, bearing: 0 })')
            await asyncio.sleep(1.0)

            # 1. Satellite Mode Check
            sat_vis = await eval_js('''(() => {
                const map = window.state.map;
                return {
                    styleMode: window.state.currentMapStyleMode,
                    line: map.getLayoutProperty('qares-boundary-line', 'visibility'),
                    glow: map.getLayoutProperty('qares-boundary-glow', 'visibility'),
                    casing: map.getLayoutProperty('qares-boundary-casing', 'visibility')
                };
            })()''')
            print('[Satellite Mode Layers]:', json.dumps(sat_vis, indent=2))
            sat_png = os.path.join(ARTIFACT_DIR, 'qares_satellite_boundary.png')
            await screenshot(sat_png)
            print(f'[Test] Saved satellite screenshot: {sat_png}')

            # 2. Mapbox Mode Check
            print('[Test] Switching to Mapbox Mode...')
            await eval_js('selectMapStyle("mapbox")')
            await asyncio.sleep(2.0)
            await eval_js('window.state.map.jumpTo({ center: [121.3712, 13.9430], zoom: 17.5, pitch: 0, bearing: 0 })')
            await asyncio.sleep(1.0)

            mapbox_vis = await eval_js('''(() => {
                const map = window.state.map;
                return {
                    styleMode: window.state.currentMapStyleMode,
                    line: map.getLayoutProperty('qares-boundary-line', 'visibility'),
                    glow: map.getLayoutProperty('qares-boundary-glow', 'visibility'),
                    casing: map.getLayoutProperty('qares-boundary-casing', 'visibility')
                };
            })()''')
            print('[Mapbox Mode Layers]:', json.dumps(mapbox_vis, indent=2))
            mapbox_png = os.path.join(ARTIFACT_DIR, 'qares_mapbox_boundary_noshadow.png')
            await screenshot(mapbox_png)
            print(f'[Test] Saved mapbox screenshot: {mapbox_png}')

            # Assertions
            assert mapbox_vis['styleMode'] == 'mapbox', f"Expected mapbox style mode, got {mapbox_vis['styleMode']}"
            assert mapbox_vis['line'] in ('visible', None), f"Expected qares-boundary-line visible, got {mapbox_vis['line']}"
            assert mapbox_vis['glow'] == 'none', f"Expected qares-boundary-glow 'none', got {mapbox_vis['glow']}"
            assert mapbox_vis['casing'] == 'none', f"Expected qares-boundary-casing 'none', got {mapbox_vis['casing']}"
            print('\n>>> ALL BOUNDARY ASSERTIONS PASSED! Mapbox mode has zero shadow and clean single-stroke outline. <<<')

    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(run())
