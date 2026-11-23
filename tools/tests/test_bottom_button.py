import asyncio
import json
import subprocess
import urllib.request
import websockets

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9276

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

            inspect_script = """
            (function() {
                const btn = document.getElementById('sidebar-toggle-btn');
                const sb = document.getElementById('sidebar');
                const bp = document.getElementById('building-panel');
                const btnR = btn ? btn.getBoundingClientRect() : null;
                const sbR = sb ? sb.getBoundingClientRect() : null;
                const bpR = bp ? bp.getBoundingClientRect() : null;
                const elemAtCenter = document.elementFromPoint(575/2, 1010);
                return {
                    windowH: window.innerHeight,
                    bodyClasses: document.body.className,
                    sbClasses: sb ? sb.className : null,
                    bpClasses: bp ? bp.className : null,
                    btnRect: btnR ? { top: Math.round(btnR.top), bottom: Math.round(btnR.bottom), left: Math.round(btnR.left), height: Math.round(btnR.height), width: Math.round(btnR.width) } : null,
                    sbRect: sbR ? { top: Math.round(sbR.top), bottom: Math.round(sbR.bottom), height: Math.round(sbR.height) } : null,
                    btnVisible: btn ? (window.getComputedStyle(btn).display !== 'none' && window.getComputedStyle(btn).visibility !== 'hidden' && parseFloat(window.getComputedStyle(btn).opacity) > 0) : false,
                    btnOpacity: btn ? window.getComputedStyle(btn).opacity : null,
                    btnDisplay: btn ? window.getComputedStyle(btn).display : null,
                    btnVisibility: btn ? window.getComputedStyle(btn).visibility : null,
                    elemAtBottomCenter: elemAtCenter ? (elemAtCenter.id || elemAtCenter.className || elemAtCenter.tagName) : null
                };
            })()
            """

            # Step 1: User folds menu in explore mode
            print("--- STEP 1: Fold menu in explore mode ---")
            await eval_js("collapseSidebarMenu();")
            await asyncio.sleep(0.5)
            print(json.dumps(await eval_js(inspect_script), indent=2))

            # Step 2: User selects building on map (opens drawer)
            print("--- STEP 2: Select RAED Building ---")
            await eval_js("navigateTo('raed_building');")
            await asyncio.sleep(1.0)
            print(json.dumps(await eval_js(inspect_script), indent=2))

            # Step 3: User clicks Get Directions in drawer
            print("--- STEP 3: Click Get Directions ---")
            await eval_js("getDirections();")
            await asyncio.sleep(1.0)
            print(json.dumps(await eval_js(inspect_script), indent=2))

            # Step 4: Arrived state
            print("--- STEP 4: Arrived state ---")
            await eval_js("if (typeof startArrivedCountdown === 'function') startArrivedCountdown();")
            await asyncio.sleep(0.5)
            print(json.dumps(await eval_js(inspect_script), indent=2))

    finally:
        proc.terminate()

asyncio.run(test())
