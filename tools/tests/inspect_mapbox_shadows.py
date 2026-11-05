import asyncio
import json
import subprocess
import urllib.request
import websockets
import base64
import os

async def run():
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        '--remote-debugging-port=9235',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen('http://localhost:9235/json').read())
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

            for _ in range(25):
                await asyncio.sleep(0.25)
                if await eval_js('window.state && window.state.mapReady'):
                    break

            await eval_js('const btn = document.getElementById("dash-proceed-btn"); if (btn) btn.click(); const modal = document.getElementById("dash-welcome-modal"); if (modal) modal.style.display = "none";')
            await asyncio.sleep(1.0)

            # Switch to QARES
            await eval_js('switchResearchStation("qares")')
            await asyncio.sleep(1.0)

            # Match exact view from user screenshot:
            await eval_js('window.state.map.jumpTo({ center: [121.3712, 13.9430], zoom: 17.2, pitch: 0, bearing: 0 })')
            await asyncio.sleep(1.0)

            # 1. Satellite mode (google)
            print('1. In Satellite mode (google):')
            await screenshot('tools/tests/view_satellite.png')

            # 2. Mapbox mode
            print('2. Switching to Mapbox mode:')
            await eval_js('selectMapStyle("mapbox")')
            await asyncio.sleep(3.0)
            await eval_js('window.state.map.jumpTo({ center: [121.3712, 13.9430], zoom: 17.2, pitch: 0, bearing: 0 })')
            await asyncio.sleep(1.0)
            await screenshot('tools/tests/view_mapbox.png')

            # Check 3d shadows and lighting
            info = await eval_js('''(() => {
                const map = window.state.map;
                const layers = map.getStyle().layers;
                return {
                    pitch: map.getPitch(),
                    bearing: map.getBearing(),
                    zoom: map.getZoom(),
                    center: map.getCenter(),
                    lightPreset: map.getConfigProperty ? map.getConfigProperty('basemap', 'lightPreset') : null,
                    qaresLayers: layers.filter(l => l.id.includes('qares') || l.id.includes('boundary') || l.id.includes('mask') || l.type === 'fill-extrusion').map(l => ({
                        id: l.id,
                        type: l.type,
                        slot: l.slot,
                        paint: l.paint
                    }))
                };
            })()''')

            print('Map state:')
            print(' - Pitch:', info['pitch'])
            print(' - Bearing:', info['bearing'])
            print(' - Zoom:', info['zoom'])
            print(' - Center:', info['center'])
            print(' - LightPreset:', info['lightPreset'])
            print('\nLayers:')
            for l in info['qaresLayers']:
                print(f" - {l['id']} ({l['type']}, slot={l.get('slot')}): {json.dumps(l.get('paint', {}))}")

    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(run())
