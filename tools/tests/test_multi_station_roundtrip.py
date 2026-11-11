import asyncio
import json
import subprocess
import urllib.request
import websockets

async def test_full_roundtrip():
    port = 9251
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        f'--remote-debugging-port={port}',
        '--window-size=1280,800',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?station=lares'
    ])

    try:
        await asyncio.sleep(3.0)
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{port}/json').read())
        target_tab = next(t for t in tabs if t.get('type') == 'page')
        ws_url = target_tab['webSocketDebuggerUrl']

        async with websockets.connect(ws_url, max_size=20*1024*1024) as ws:
            req_id = 0
            async def call_cdp(method, params=None):
                nonlocal req_id
                req_id += 1
                curr_id = req_id
                payload = {'id': curr_id, 'method': method}
                if params:
                    payload['params'] = params
                await ws.send(json.dumps(payload))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == curr_id:
                        return msg.get('result', {})

            async def eval_js(expr):
                res = await call_cdp('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
                return res.get('result', {}).get('value')

            for _ in range(40):
                ready = await eval_js("Boolean(window.map && window.map.loaded() && window.map.getLayer('3d-buildings-models-layer'))")
                if ready:
                    break
                await asyncio.sleep(0.5)

            await eval_js("""
                const m = document.getElementById('dash-welcome-modal');
                if (m) { m.style.display = 'none'; m.remove(); }
                if (typeof window.closeDashWelcomeModal === 'function') window.closeDashWelcomeModal();
                if (typeof window.stopIntroAnimation === 'function') window.stopIntroAnimation();
            """)
            await asyncio.sleep(1.0)

            # Roundtrip 1: LARES -> QARES -> LARES
            print("Testing LARES -> QARES -> LARES...")
            await eval_js("window.switchResearchStation('qares', true);")
            await asyncio.sleep(2.5)
            qares_vis = await eval_js("window.map.getLayoutProperty('3d-buildings-models-layer', 'visibility')")
            print(f"In QARES, 3d-buildings-models-layer visibility: {qares_vis}")

            await eval_js("window.switchResearchStation('lares', true);")
            await asyncio.sleep(2.5)
            cnt1 = await eval_js("window.map.getSource('lares-3d-buildings-models-source')._data.features.length")
            print(f"Back in LARES from QARES, 3D feature count: {cnt1}")
            assert cnt1 >= 40, f"Expected >= 40, got {cnt1}"

            # Roundtrip 2: LARES -> RARES -> QARES -> LARES
            print("\nTesting LARES -> RARES -> QARES -> LARES...")
            await eval_js("window.switchResearchStation('rares', true);")
            await asyncio.sleep(2.5)
            rares_cnt = await eval_js("window.map.getSource('lares-3d-buildings-models-source')._data.features.length")
            print(f"In RARES, 3D feature count: {rares_cnt}")
            assert rares_cnt == 1, f"Expected 1 in RARES, got {rares_cnt}"

            await eval_js("window.switchResearchStation('qares', true);")
            await asyncio.sleep(2.5)

            await eval_js("window.switchResearchStation('lares', true);")
            await asyncio.sleep(2.5)
            cnt2 = await eval_js("window.map.getSource('lares-3d-buildings-models-source')._data.features.length")
            print(f"Back in LARES from multi-hop, 3D feature count: {cnt2}")
            assert cnt2 >= 40, f"Expected >= 40, got {cnt2}"

            print("\nAll multi-station roundtrip tests passed with 100% success!")

    finally:
        proc.kill()

if __name__ == '__main__':
    asyncio.run(test_full_roundtrip())

