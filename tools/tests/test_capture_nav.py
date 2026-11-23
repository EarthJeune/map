import asyncio
import json
import subprocess
import urllib.request
import websockets
import base64

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9277

async def test():
    proc = subprocess.Popen([
        EDGE_PATH,
        '--headless=new',
        f'--remote-debugging-port={PORT}',
        '--window-size=575,1024',
        '--disable-gpu',
        '--no-sandbox',
        '--force-device-scale-factor=1',
        'http://localhost:8080/?mode=kiosk&station=lares'
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
            await send_cmd('Emulation.setDeviceMetricsOverride', {
                'width': 575,
                'height': 1024,
                'deviceScaleFactor': 1,
                'mobile': False
            })

            await send_cmd('Page.reload')
            await asyncio.sleep(3.0)

            async def eval_js(expr):
                r = await send_cmd('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
                return r.get('result', {}).get('value')

            # Dismiss welcome
            await eval_js("if (typeof closeDashWelcomeModal === 'function') closeDashWelcomeModal();")
            await eval_js("if (typeof handleDashWelcomeProceed === 'function') handleDashWelcomeProceed();")
            await asyncio.sleep(0.5)

            # Step 1: Fold menu in explore mode
            await eval_js("collapseSidebarMenu();")
            await asyncio.sleep(0.5)

            # Step 2: Select RAED Building
            await eval_js("navigateTo('raed_building');")
            await asyncio.sleep(1.0)

            # Step 3: Click Get Directions
            await eval_js("getDirections();")
            await asyncio.sleep(1.5)

            # Capture Screenshot during navigation
            res = await send_cmd('Page.captureScreenshot', {'format': 'jpeg', 'quality': 85})
            with open('SS_nav_folded_menu_fixed.jpg', 'wb') as f:
                f.write(base64.b64decode(res['data']))
            print("Saved SS_nav_folded_menu_fixed.jpg")

            # Step 4: Arrived state
            await eval_js("if (typeof startArrivedCountdown === 'function') startArrivedCountdown();")
            await asyncio.sleep(0.5)

            res2 = await send_cmd('Page.captureScreenshot', {'format': 'jpeg', 'quality': 85})
            with open('SS_nav_arrived_folded_menu_fixed.jpg', 'wb') as f:
                f.write(base64.b64decode(res2['data']))
            print("Saved SS_nav_arrived_folded_menu_fixed.jpg")

    finally:
        proc.terminate()

asyncio.run(test())

