import asyncio
import json
import subprocess
import urllib.request
import websockets
import os

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9265

async def test():
    proc = subprocess.Popen([
        EDGE_PATH,
        '--headless=new',
        f'--remote-debugging-port={PORT}',
        '--window-size=1080,1920',
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

            # Wait for map
            await asyncio.sleep(2.0)
            await eval_js("if (typeof dismissWelcomeScreen === 'function') dismissWelcomeScreen();")
            await asyncio.sleep(1.0)

            # Check how route to building is initiated
            start_script = """
            (function() {
                // Find RAED building or any building
                if (typeof window.startNavigationToBuilding === 'function') {
                    window.startNavigationToBuilding('raed_building');
                    return 'startNavigationToBuilding';
                }
                if (typeof window.startWalkingAnimation === 'function') {
                    return 'startWalkingAnimation exists';
                }
                return 'functions: ' + Object.keys(window).filter(k => k.toLowerCase().includes('nav') || k.toLowerCase().includes('route'));
            })()
            """
            print("Start test:", await eval_js(start_script))
            
            # Start route by simulating click or routing function
            res = await eval_js("""
            (function() {
                if (typeof window.navigateTo === 'function') {
                    window.navigateTo('raed_building');
                    return 'navigateTo called';
                }
                if (typeof window.computeRouteFromKiosk === 'function') {
                    window.computeRouteFromKiosk('raed_building');
                    return 'computeRouteFromKiosk called';
                }
                return 'no route func';
            })()
            """)
            print("Route result:", res)
            await asyncio.sleep(1.5)

            # Check status of sidebar and toggle btn
            info = await eval_js("""
            (function() {
                function rectToObj(r) {
                    if (!r) return null;
                    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
                }
                const sb = document.getElementById('sidebar');
                const btn = document.getElementById('sidebar-toggle-btn');
                const icon = document.getElementById('sidebar-toggle-icon');
                return {
                    bodyClasses: document.body.className,
                    sidebarClasses: sb ? sb.className : null,
                    sidebarRect: sb ? rectToObj(sb.getBoundingClientRect()) : null,
                    sidebarOverflow: sb ? window.getComputedStyle(sb).overflow : null,
                    sidebarDisplay: sb ? window.getComputedStyle(sb).display : null,
                    sidebarVisibility: sb ? window.getComputedStyle(sb).visibility : null,
                    btnRect: btn ? rectToObj(btn.getBoundingClientRect()) : null,
                    btnDisplay: btn ? window.getComputedStyle(btn).display : null,
                    btnVisibility: btn ? window.getComputedStyle(btn).visibility : null,
                    btnOpacity: btn ? window.getComputedStyle(btn).opacity : null,
                    btnZIndex: btn ? window.getComputedStyle(btn).zIndex : null,
                    btnTransform: btn ? window.getComputedStyle(btn).transform : null,
                };
            })()
            """)
            print("Active route info:")
            print(json.dumps(info, indent=2))

            # Now collapse the sidebar
            await eval_js("if (typeof window.toggleSidebarMenu === 'function') window.toggleSidebarMenu();")
            await asyncio.sleep(0.5)

            info_collapsed = await eval_js("""
            (function() {
                function rectToObj(r) {
                    if (!r) return null;
                    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
                }
                const sb = document.getElementById('sidebar');
                const btn = document.getElementById('sidebar-toggle-btn');
                return {
                    bodyClasses: document.body.className,
                    sidebarClasses: sb ? sb.className : null,
                    sidebarRect: sb ? rectToObj(sb.getBoundingClientRect()) : null,
                    sidebarOverflow: sb ? window.getComputedStyle(sb).overflow : null,
                    btnRect: btn ? rectToObj(btn.getBoundingClientRect()) : null,
                    btnDisplay: btn ? window.getComputedStyle(btn).display : null,
                    btnVisibility: btn ? window.getComputedStyle(btn).visibility : null,
                };
            })()
            """)
            print("Collapsed during route info:")
            print(json.dumps(info_collapsed, indent=2))
    finally:
        proc.terminate()

asyncio.run(test())
