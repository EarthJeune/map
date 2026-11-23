import asyncio
import json
import subprocess
import urllib.request
import websockets

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9287

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
        async with websockets.connect(target['webSocketDebuggerUrl']) as ws:
            msg_id = 1
            async def eval_js(expr):
                nonlocal msg_id
                msg_id += 1
                await ws.send(json.dumps({'id': msg_id, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get('id') == msg_id:
                        return m.get('result', {}).get('result', {}).get('value')

            await asyncio.sleep(3.0)
            await eval_js("if (typeof closeDashWelcomeModal === 'function') closeDashWelcomeModal();")
            await eval_js("if (typeof handleDashWelcomeProceed === 'function') handleDashWelcomeProceed();")
            await asyncio.sleep(1.0)

            # Instrument loadRARESData
            await eval_js("""
            (function() {
                window.__loadRARESLogs = [];
                window.__loadRARESErrors = [];
                const orig = window.loadRARESData;
                window.loadRARESData = function() {
                    window.__loadRARESLogs.push({
                        time: Date.now(),
                        styleLoaded: map.isStyleLoaded(),
                        styleName: map.getStyle() ? map.getStyle().name : 'none',
                        stack: new Error().stack
                    });
                    try {
                        orig.apply(this, arguments);
                        window.__loadRARESLogs.push({
                            time: Date.now(),
                            status: 'done',
                            hasLayer: !!map.getLayer('rares-ortho-layer')
                        });
                    } catch(e) {
                        window.__loadRARESErrors.push(e.message + '\n' + e.stack);
                    }
                };
            })()
            """)

            print('1. Switch to Mapbox')
            await eval_js("selectMapStyle('mapbox');")
            await asyncio.sleep(4.0)

            print('2. Switch to Google')
            await eval_js("selectMapStyle('google');")
            await asyncio.sleep(5.0)

            res = await eval_js("""
            (function() {
                return {
                    logs: window.__loadRARESLogs,
                    errors: window.__loadRARESErrors,
                    hasLayer: !!map.getLayer('rares-ortho-layer'),
                    hasMask: !!map.getLayer('rares-mask-layer'),
                    styleLoaded: map.isStyleLoaded(),
                    layers: map.getStyle().layers.map(l => l.id)
                };
            })()
            """)
            print(json.dumps(res, indent=2))
    finally:
        proc.terminate()

asyncio.run(test())
