import asyncio
import json
import subprocess
import urllib.request
import websockets
import base64
import os

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9270

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
        await asyncio.sleep(3.0)
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{PORT}/json').read())
        target = next((t for t in tabs if t.get('type') == 'page' and 'localhost:8080' in t.get('url', '')), None)
        if not target:
            target = next(t for t in tabs if t.get('type') == 'page')

        async with websockets.connect(target['webSocketDebuggerUrl'], max_size=50*1024*1024) as ws:
            msg_id = 1
            async def eval_js(expr):
                nonlocal msg_id
                msg_id += 1
                await ws.send(json.dumps({'id': msg_id, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == msg_id:
                        return msg.get('result', {}).get('result', {}).get('value')

            await asyncio.sleep(2.0)
            await eval_js("if (typeof dismissWelcomeScreen === 'function') dismissWelcomeScreen();")
            await asyncio.sleep(1.0)

            # Start navigation to RAED Building
            await eval_js("navigateTo('raed_building');")
            await asyncio.sleep(1.0)

            # Now toggle / collapse the sidebar menu as the user does
            await eval_js("toggleSidebarMenu();")
            await asyncio.sleep(1.0)

            # Check status of sidebar and toggle button
            info = await eval_js("""
            (function() {
                function rectToObj(r) {
                    if (!r) return null;
                    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
                }
                const sb = document.getElementById('sidebar');
                const btn = document.getElementById('sidebar-toggle-btn');
                return {
                    sidebarClasses: sb ? sb.className : null,
                    sidebarRect: sb ? rectToObj(sb.getBoundingClientRect()) : null,
                    sidebarOverflow: sb ? window.getComputedStyle(sb).overflow : null,
                    btnRect: btn ? rectToObj(btn.getBoundingClientRect()) : null,
                    btnDisplay: btn ? window.getComputedStyle(btn).display : null,
                    btnVisibility: btn ? window.getComputedStyle(btn).visibility : null,
                    windowHeight: window.innerHeight
                };
            })()
            """)
            print("Info at 575x1024 AFTER COLLAPSING during navigation:")
            print(json.dumps(info, indent=2))

            # Capture screenshot
            msg_id += 1
            await ws.send(json.dumps({'id': msg_id, 'method': 'Page.captureScreenshot', 'params': {'format': 'jpeg', 'quality': 80}}))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get('id') == msg_id:
                    data = msg['result']['data']
                    with open('scratch_test_nav_575x1024.jpg', 'wb') as f:
                        f.write(base64.b64decode(data))
                    break
            print("Saved scratch_test_nav_575x1024.jpg")
    finally:
        proc.terminate()

asyncio.run(test())
