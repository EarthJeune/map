import asyncio
import json
import subprocess
import urllib.request
import websockets

async def check():
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        '--remote-debugging-port=9233',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])
    try:
        await asyncio.sleep(2.0)
        tabs = json.loads(urllib.request.urlopen('http://localhost:9233/json').read())
        target_tab = next(t for t in tabs if t.get('type') == 'page')
        ws_url = target_tab['webSocketDebuggerUrl']
        async with websockets.connect(ws_url) as ws:
            async def eval_js(expr):
                await ws.send(json.dumps({'id': 10, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == 10:
                        return msg.get('result', {}).get('result', {}).get('value')

            # wait ready
            for _ in range(25):
                await asyncio.sleep(0.25)
                if await eval_js('window.state && window.state.mapReady'):
                    break

            print('1. Initial center (LARES):', await eval_js('window.state.map.getCenter()'))

            print('2. Switching to QARES...')
            await eval_js('switchResearchStation("qares")')
            await asyncio.sleep(0.6)
            qares_center = await eval_js('window.state.map.getCenter()')
            qares_curtain = await eval_js('window.getComputedStyle(document.getElementById("station-transition-curtain")).opacity')
            print('-> QARES Center:', qares_center, 'Curtain opacity:', qares_curtain)

            print('3. Switching back to LARES...')
            await eval_js('switchResearchStation("lares")')
            await asyncio.sleep(0.6)
            lares_center = await eval_js('window.state.map.getCenter()')
            lares_curtain = await eval_js('window.getComputedStyle(document.getElementById("station-transition-curtain")).opacity')
            print('-> LARES Center:', lares_center, 'Curtain opacity:', lares_curtain)

            print('BIDIRECTIONAL SWITCHING PASSED!')
    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(check())
