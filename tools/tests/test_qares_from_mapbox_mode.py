import asyncio
import json
import subprocess
import urllib.request
import websockets
import base64
import os

ARTIFACT_DIR = r'C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\ff627781-c64f-4830-bce7-fdd70763aee1'

async def run():
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        '--remote-debugging-port=9244',
        '--disable-gpu',
        '--no-sandbox',
        '--window-size=1600,900',
        'http://localhost:8080/?mode=kiosk'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen('http://localhost:9244/json').read())
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

            for _ in range(40):
                await asyncio.sleep(0.2)
                if await eval_js('window.state && window.state.mapReady'):
                    break

            await eval_js('const btn = document.getElementById("dash-proceed-btn"); if (btn) btn.click(); const modal = document.getElementById("dash-welcome-modal"); if (modal) modal.style.display = "none";')
            await asyncio.sleep(1.0)

            # 1. Switch to Mapbox mode in LARES
            print("1. Switching to Mapbox mode in LARES...")
            await eval_js('selectMapStyle("mapbox")')
            await asyncio.sleep(1.5)

            # 2. Now switch to QARES while ALREADY in Mapbox mode
            print("2. Switching to QARES while in Mapbox mode...")
            await eval_js('switchResearchStation("qares")')
            await asyncio.sleep(6.5)

            snap = os.path.join(ARTIFACT_DIR, 'qares_from_mapbox_mode.png')
            await screenshot(snap)
            telemetry = await eval_js('''(() => {
                const map = window.state.map;
                const c = map.getCenter();
                return {
                    center: [c.lng, c.lat],
                    zoom: map.getZoom(),
                    pitch: map.getPitch(),
                    bearing: map.getBearing(),
                    style: window.state.currentMapStyleMode,
                    station: window.state.currentStationId,
                    qaresLayers: map.getStyle().layers.filter(l => l.id.includes('qares')).map(l => ({
                        id: l.id,
                        visibility: map.getLayoutProperty(l.id, 'visibility')
                    }))
                };
            })()''')
            print("Telemetry:", json.dumps(telemetry, indent=2))

    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(run())
