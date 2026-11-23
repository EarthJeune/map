import asyncio
import json
import subprocess
import urllib.request
import websockets

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9286

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

            async def eval_js(expr):
                r = await send_cmd('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
                return r.get('result', {}).get('value')

            await asyncio.sleep(3.0)
            await eval_js("if (typeof closeDashWelcomeModal === 'function') closeDashWelcomeModal();")
            await eval_js("if (typeof handleDashWelcomeProceed === 'function') handleDashWelcomeProceed();")
            await asyncio.sleep(1.0)

            # Switch to mapbox
            print('--- 1. SELECT MAPBOX ---')
            await eval_js("selectMapStyle('mapbox');")
            await asyncio.sleep(4.0)

            # Switch back to google
            print('--- 2. SELECT GOOGLE ---')
            await eval_js("selectMapStyle('google');")
            await asyncio.sleep(5.0)

            # Check exact state of layers
            check = await eval_js("""
            (function() {
                const res = {};
                res.styleLoaded = map.isStyleLoaded();
                res.hasSource = !!map.getSource('rares-drone-source');
                res.hasLayer = !!map.getLayer('rares-ortho-layer');
                res.layers = map.getStyle().layers.map(l => l.id);
                
                // Try adding it directly and see what error it throws
                try {
                    const bldgsModelBeforeId = map.getLayer('rares-3d-models-layer') ? 'rares-3d-models-layer' : (map.getLayer('3d-buildings-models-layer') ? '3d-buildings-models-layer' : undefined);
                    res.beforeId = bldgsModelBeforeId;
                    map.addLayer({
                        id: 'rares-ortho-layer-test',
                        type: 'raster',
                        source: 'rares-drone-source',
                        slot: 'bottom',
                        paint: { 'raster-opacity': 1.0 }
                    }, bldgsModelBeforeId);
                    res.testLayerAdded = true;
                } catch(err) {
                    res.testLayerAdded = false;
                    res.testError = err.message;
                }
                return res;
            })()
            """)
            print('CHECK AFTER RETURN TO GOOGLE:')
            print('styleLoaded:', check.get('styleLoaded'))
            print('hasSource:', check.get('hasSource'))
            print('hasLayer:', check.get('hasLayer'))
            print('beforeId:', check.get('beforeId'))
            print('testLayerAdded:', check.get('testLayerAdded'))
            print('testError:', check.get('testError'))
            print('Total layers:', len(check.get('layers', [])))

    finally:
        proc.terminate()

asyncio.run(test())

