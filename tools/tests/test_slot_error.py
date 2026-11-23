import asyncio
import json
import subprocess
import urllib.request
import websockets

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9291

async def run():
    p = subprocess.Popen([
        EDGE_PATH,
        '--headless=new',
        f'--remote-debugging-port={PORT}',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?station=rares'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{PORT}/json').read())
        t = next(x for x in tabs if 'localhost:8080' in x.get('url',''))
        async with websockets.connect(t['webSocketDebuggerUrl']) as ws:
            mid = 0
            async def ev(expr):
                nonlocal mid; mid += 1
                await ws.send(json.dumps({'id': mid, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get('id') == mid: return m.get('result',{}).get('result',{}).get('value')
            
            await asyncio.sleep(3.0)
            await ev('if (typeof closeDashWelcomeModal === "function") closeDashWelcomeModal();')
            await ev('if (typeof handleDashWelcomeProceed === "function") handleDashWelcomeProceed();')
            await asyncio.sleep(1.0)

            print('Switching to mapbox...')
            await ev("selectMapStyle('mapbox');")
            await asyncio.sleep(4.0)

            print('Switching to google...')
            await ev("selectMapStyle('google');")
            await asyncio.sleep(5.0)

            res = await ev("""
            (function() {
                const bldgsModelBeforeId = map.getLayer('rares-3d-models-layer') ? 'rares-3d-models-layer' : (map.getLayer('3d-buildings-models-layer') ? '3d-buildings-models-layer' : undefined);
                const isMapbox = (state.currentMapStyleMode === 'mapbox');
                let err1 = null;
                try {
                    map.addLayer({
                        id: 'test-ortho-layer-slot',
                        type: 'raster',
                        source: 'rares-drone-source',
                        slot: 'bottom',
                        paint: { 'raster-opacity': 1.0 }
                    }, bldgsModelBeforeId);
                } catch(e) {
                    err1 = e.message;
                }

                let err2 = null;
                try {
                    map.addLayer({
                        id: 'test-ortho-layer-noslot',
                        type: 'raster',
                        source: 'rares-drone-source',
                        paint: { 'raster-opacity': 1.0 }
                    }, bldgsModelBeforeId);
                } catch(e) {
                    err2 = e.message;
                }

                return {
                    currentMapStyleMode: state.currentMapStyleMode,
                    styleName: map.getStyle() ? map.getStyle().name : null,
                    bldgsModelBeforeId: bldgsModelBeforeId,
                    hasRaresOrtho: !!map.getLayer('rares-ortho-layer'),
                    hasRaresMask: !!map.getLayer('rares-mask-layer'),
                    errWithSlot: err1,
                    errWithoutSlot: err2,
                    hasTestNoSlot: !!map.getLayer('test-ortho-layer-noslot')
                };
            })()
            """)
            print(json.dumps(res, indent=2))
    finally:
        p.terminate()

asyncio.run(run())

