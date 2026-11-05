import asyncio
import json
import os
import subprocess
import urllib.request
import websockets

async def run_profile():
    port = 9248
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        f'--remote-debugging-port={port}',
        '--window-size=1600,900',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])

    try:
        await asyncio.sleep(3.5)
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{port}/json').read())
        target_tab = next(t for t in tabs if t.get('type') == 'page')
        ws_url = target_tab['webSocketDebuggerUrl']

        async with websockets.connect(ws_url) as ws:
            req_id = 0
            async def eval_js(expr):
                nonlocal req_id
                req_id += 1
                curr_id = req_id
                await ws.send(json.dumps({'id': curr_id, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == curr_id:
                        return msg.get('result', {}).get('result', {}).get('value')

            # Wait for mapReady
            for _ in range(40):
                await asyncio.sleep(0.3)
                ready = await eval_js('Boolean(window.mapReady && window.map)')
                if ready:
                    break

            await eval_js("document.getElementById('dash-welcome-modal')?.remove();")
            await asyncio.sleep(0.5)

            # Instrument routing & occlusion functions
            await eval_js("""
                (() => {
                    window._profileTimes = {
                        turfAlong: 0,
                        lineSlice: 0,
                        setData: 0,
                        jumpTo: 0,
                        occlusion: 0,
                        liveNav: 0,
                        counts: 0
                    };
                })()
            """)

            # Start navigation
            await eval_js("""
                (() => {
                    window.navigateTo('ored_building');
                    window.setRouteSpeed(2);
                })()
            """)

            await asyncio.sleep(4.0)

            # Check profile times
            times = await eval_js("""
                (() => {
                    return window._profileTimes;
                })()
            """)
            print("Times:", times)

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except Exception:
            proc.kill()

if __name__ == '__main__':
    asyncio.run(run_profile())
