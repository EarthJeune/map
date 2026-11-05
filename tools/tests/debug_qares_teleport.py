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
        '--remote-debugging-port=9241',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen('http://localhost:9241/json').read())
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

            # Listen to console logs
            await ws.send(json.dumps({'id': 1, 'method': 'Runtime.enable'}))

            for _ in range(30):
                await asyncio.sleep(0.25)
                if await eval_js('window.state && window.state.mapReady'):
                    break

            await eval_js('const btn = document.getElementById("dash-proceed-btn"); if (btn) btn.click(); const modal = document.getElementById("dash-welcome-modal"); if (modal) modal.style.display = "none";')
            await asyncio.sleep(1.0)

            print('[Initial Station]:', await eval_js('window.state.currentStationId'))
            print('[Initial View]:', await eval_js('(() => { const c = window.state.map.getCenter(); return { lng: c.lng, lat: c.lat, zoom: window.state.map.getZoom(), pitch: window.state.map.getPitch() }; })()'))

            # Trigger switch to QARES
            print('\n--- Clicking QARES Switch ---')
            await eval_js('switchResearchStation("qares")')

            # Track camera position every 300ms for 8 seconds
            for i in range(25):
                await asyncio.sleep(0.3)
                cam = await eval_js('''(() => {
                    if (!window.state || !window.state.map) return null;
                    const c = window.state.map.getCenter();
                    return {
                        t: ('''+str(i*0.3)+'''),
                        lng: c.lng,
                        lat: c.lat,
                        zoom: window.state.map.getZoom(),
                        pitch: window.state.map.getPitch(),
                        bearing: window.state.map.getBearing(),
                        bounds: window.state.map.getMaxBounds(),
                        isIntroAnimating: window.state.isIntroAnimating,
                        styleMode: window.state.currentMapStyleMode,
                        qaresBuildingsCount: document.querySelectorAll(".bldg-map-marker").length
                    };
                })()''')
                print(f"t={cam['t']:.1f}s | Center: [{cam['lng']:.5f}, {cam['lat']:.5f}] | Zoom: {cam['zoom']:.2f} | Pitch: {cam['pitch']:.1f} | Bounds: {cam['bounds']} | Intro: {cam['isIntroAnimating']}")

            snap_path = os.path.join(ARTIFACT_DIR, 'qares_teleport_debug.png')
            await screenshot(snap_path)
            print('[Saved final screenshot]:', snap_path)

    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(run())
