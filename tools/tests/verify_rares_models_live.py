import asyncio
import json
import subprocess
import urllib.request
import websockets
import base64

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9278

async def test():
    proc = subprocess.Popen([
        EDGE_PATH,
        '--headless=new',
        f'--remote-debugging-port={PORT}',
        '--window-size=1280,800',
        '--disable-gpu',
        '--no-sandbox',
        '--force-device-scale-factor=1',
        'http://localhost:8080/?station=rares'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{PORT}/json').read())
        target = next((t for t in tabs if t.get('type') == 'page' and 'localhost:8080' in t.get('url', '')), None)
        if not target:
            target = next(t for t in tabs if t.get('type') == 'page')

        async with websockets.connect(target['webSocketDebuggerUrl'], max_size=50*1024*1024) as ws:
            msg_id = 1
            async def send_cmd(method, params=None):
                nonlocal msg_id
                msg_id += 1
                payload = {'id': msg_id, 'method': method}
                if params:
                    payload['params'] = params
                await ws.send(json.dumps(payload))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get('id') == msg_id:
                        return m.get('result', {})

            await send_cmd('Network.enable')
            await send_cmd('Network.setCacheDisabled', {'cacheDisabled': True})
            await send_cmd('Page.reload')
            await asyncio.sleep(3.5)

            async def eval_js(expr):
                r = await send_cmd('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
                return r.get('result', {}).get('value')

            await eval_js("if (typeof closeDashWelcomeModal === 'function') closeDashWelcomeModal();")
            await eval_js("if (typeof handleDashWelcomeProceed === 'function') handleDashWelcomeProceed();")
            await asyncio.sleep(1.0)

            # 1. Fly to Gap between Seed Storage and Chemical Storage
            await eval_js("""
            (function() {
                if (typeof map !== 'undefined') {
                    map.flyTo({
                        center: [121.34051, 14.57587],
                        zoom: 19.5,
                        pitch: 55,
                        bearing: 15,
                        duration: 0
                    });
                }
            })()
            """)
            await asyncio.sleep(2.5)

            # Capture screenshot of Seed Storage vs Chemical Storage Gap
            res1 = await send_cmd('Page.captureScreenshot', {'format': 'jpeg', 'quality': 85})
            with open('rares_seed_chem_gap_live.jpg', 'wb') as f:
                f.write(base64.b64decode(res1['data']))
            print("Saved rares_seed_chem_gap_live.jpg")

            # 2. Fly to Rear Left of Admin Building
            await eval_js("""
            (function() {
                if (typeof map !== 'undefined') {
                    map.flyTo({
                        center: [121.34062, 14.57622],
                        zoom: 19.5,
                        pitch: 60,
                        bearing: 200,
                        duration: 0
                    });
                }
            })()
            """)
            await asyncio.sleep(2.5)

            res2 = await send_cmd('Page.captureScreenshot', {'format': 'jpeg', 'quality': 85})
            with open('rares_admin_rear_live.jpg', 'wb') as f:
                f.write(base64.b64decode(res2['data']))
            print("Saved rares_admin_rear_live.jpg")

    finally:
        proc.terminate()

asyncio.run(test())

