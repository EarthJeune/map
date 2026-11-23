import asyncio
import json
import subprocess
import urllib.request
import websockets

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9292

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

            # Install tracker
            await ev("""
            (function() {
                window.__timeline = [];
                function record(type, detail) {
                    window.__timeline.push({
                        time: Date.now(),
                        type: type,
                        detail: detail,
                        hasOrtho: !!map.getLayer('rares-ortho-layer'),
                        hasMask: !!map.getLayer('rares-mask-layer')
                    });
                }

                map.on('style.load', () => record('event:style.load', map.getStyle() ? map.getStyle().name : 'none'));
                map.on('styledata', () => record('event:styledata', map.getStyle() ? map.getStyle().name : 'none'));
                
                const origSetStyle = map.setStyle;
                map.setStyle = function(s, opt) {
                    record('call:setStyle', typeof s === 'string' ? s : 'object');
                    return origSetStyle.apply(this, arguments);
                };

                const origRemoveLayer = map.removeLayer;
                map.removeLayer = function(id) {
                    record('call:removeLayer', id);
                    return origRemoveLayer.apply(this, arguments);
                };

                const origAddLayer = map.addLayer;
                map.addLayer = function(layer, beforeId) {
                    record('call:addLayer', (layer ? layer.id : '') + ' before=' + beforeId);
                    return origAddLayer.apply(this, arguments);
                };
            })()
            """)

            print('Step 1: Switch to mapbox')
            await ev("selectMapStyle('mapbox');")
            await asyncio.sleep(3.0)

            print('Step 2: Clear timeline before switching to google')
            await ev("window.__timeline = [];")

            print('Step 3: Switch to google')
            await ev("selectMapStyle('google');")
            await asyncio.sleep(4.0)

            timeline = await ev("window.__timeline")
            print(f"Total events recorded: {len(timeline)}")
            for item in timeline:
                print(f"{item['type']}: {item['detail']} [hasOrtho={item['hasOrtho']}]")

            state_info = await ev("""
            ({
                currentMapStyleMode: state.currentMapStyleMode,
                hasOrtho: !!map.getLayer('rares-ortho-layer'),
                hasMask: !!map.getLayer('rares-mask-layer'),
                orthoVis: map.getLayer('rares-ortho-layer') ? map.getLayoutProperty('rares-ortho-layer', 'visibility') : 'N/A'
            })
            """)
            print('Final State:', json.dumps(state_info, indent=2))
    finally:
        p.terminate()

asyncio.run(run())

