import asyncio
import json
import subprocess
import urllib.request
import websockets

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9289

async def run():
    p = subprocess.Popen([EDGE_PATH, '--headless=new', f'--remote-debugging-port={PORT}', '--disable-gpu', '--no-sandbox', 'http://localhost:8080/?station=rares'])
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
            await ev('window.__warns = []; window.__errors = [];')
            await ev("""
                const origWarn = console.warn;
                console.warn = function() {
                    window.__warns.push(Array.from(arguments).map(a => (a && a.message) ? a.message : String(a)).join(' '));
                    return origWarn.apply(this, arguments);
                };
                const origErr = console.error;
                console.error = function() {
                    window.__errors.push(Array.from(arguments).map(a => (a && a.message) ? a.message : String(a)).join(' '));
                    return origErr.apply(this, arguments);
                };
            """)
            await ev("""
                const orig = window.loadRARESData;
                window.loadRARESData = function() {
                    window.__calls.push({
                        time: Date.now(),
                        styleLoaded: map.isStyleLoaded(),
                        styleName: map.getStyle() ? map.getStyle().name : 'none',
                        stack: (new Error()).stack
                    });
                    return orig.apply(this, arguments);
                };
            """)
            print('Swapping to mapbox...')
            await ev("selectMapStyle('mapbox');")
            await asyncio.sleep(3.0)
            print('Swapping to google...')
            await ev("selectMapStyle('google');")
            await asyncio.sleep(4.0)
            calls = await ev('window.__calls')
            for c in calls or []:
                print('--- CALL ---')
                print('Loaded:', c.get('styleLoaded'), 'Style:', c.get('styleName'))
                print(c.get('stack'))
            warns = await ev('window.__warns')
            print('=== WARNS ===')
            for w in warns or []:
                print(w)
            errs = await ev('window.__errors')
            print('=== ERRORS ===')
            for er in errs or []:
                print(er)
    finally:
        p.terminate()

asyncio.run(run())
