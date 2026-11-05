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
        '--remote-debugging-port=9243',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen('http://localhost:9243/json').read())
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

            print("Switching to QARES...")
            await eval_js('switchResearchStation("qares")')

            for sec in [0.5, 1.5, 3.0, 5.0, 7.0]:
                await asyncio.sleep(sec if sec == 0.5 else (sec - prev_sec))
                prev_sec = sec
                snap = os.path.join(ARTIFACT_DIR, f'qares_frame_{sec}s.png')
                await screenshot(snap)
                telemetry = await eval_js('''(() => {
                    const c = window.state.map.getCenter();
                    return {
                        center: [c.lng, c.lat],
                        zoom: window.state.map.getZoom(),
                        pitch: window.state.map.getPitch(),
                        bearing: window.state.map.getBearing(),
                        style: window.state.currentMapStyleMode,
                        curtainActive: document.getElementById('station-transition-curtain').classList.contains('active')
                    };
                })()''')
                print(f"t={sec}s:", json.dumps(telemetry))

    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(run())
