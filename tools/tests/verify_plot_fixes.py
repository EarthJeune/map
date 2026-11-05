import asyncio
import base64
import json
import os
import subprocess
import urllib.request
import websockets

async def run_tests():
    port2 = 9246
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

    print("\n=== TEST 2: Verifying main map index.html with Plot 30 update ===")
    port2 = 9246
    proc2 = subprocess.Popen([
        edge_path,
        '--headless=new',
        f'--remote-debugging-port={port2}',
        '--window-size=1600,900',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])

    try:
        await asyncio.sleep(3.5)
        tabs2 = json.loads(urllib.request.urlopen(f'http://localhost:{port2}/json').read())
        target_tab2 = next(t for t in tabs2 if t.get('type') == 'page')
        ws_url2 = target_tab2['webSocketDebuggerUrl']

        async with websockets.connect(ws_url2) as ws2:
            req_id2 = 0
            async def eval_js2(expr):
                nonlocal req_id2
                req_id2 += 1
                curr_id = req_id2
                await ws2.send(json.dumps({'id': curr_id, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    msg = json.loads(await ws2.recv())
                    if msg.get('id') == curr_id:
                        return msg.get('result', {}).get('result', {}).get('value')

            async def screenshot2(filename):
                nonlocal req_id2
                req_id2 += 1
                curr_id = req_id2
                await ws2.send(json.dumps({'id': curr_id, 'method': 'Page.captureScreenshot', 'params': {'format': 'jpeg', 'quality': 85}}))
                while True:
                    msg = json.loads(await ws2.recv())
                    if msg.get('id') == curr_id:
                        data = base64.b64decode(msg['result']['data'])
                        with open(filename, 'wb') as f:
                            f.write(data)
                        print(f"Saved screenshot: {filename}")
                        break

            # Wait for mapReady and plots layer
            for _ in range(40):
                await asyncio.sleep(0.3)
                ready = await eval_js2('Boolean(window.mapReady && window.map && window.map.getSource("plots-group-source"))')
                if ready:
                    break

            ready = await eval_js2('Boolean(window.mapReady && window.map && window.map.getSource("plots-group-source"))')
            print(f"Main map ready: {ready}")
            assert ready == True, "Main map must be ready"

            # Check geometry of zone_mango_banana_jackfruit in GeoJSON source
            zone_geom = await eval_js2("""
                (() => {
                    const src = window.map.getSource('plots-group-source');
                    if (!src || !src._data) return null;
                    const feat = src._data.features.find(f => f.id === 'zone_mango_banana_jackfruit');
                    if (!feat) return null;
                    return {
                        id: feat.id,
                        name: feat.properties.name,
                        coordsCount: feat.geometry.coordinates[0].length
                    };
                })()
            """)
            print(f"Zone GeoJSON: {zone_geom}")
            assert zone_geom['coordsCount'] == 11, f"Expected 11 coords, got {zone_geom['coordsCount']}"

            # Dismiss welcome modal if present
            await eval_js2("""
                (() => {
                    const modal = document.getElementById('dash-welcome-modal');
                    if (modal) modal.remove();
                })()
            """)
            await asyncio.sleep(0.5)

            # Turn on plots layer if off, fly directly to zone_mango_banana_jackfruit
            await eval_js2("""
                (() => {
                    import('./js/plot-layers.js?v=92').then(m => {
                        m.selectPlotZone('zone_mango_banana_jackfruit');
                    });
                })()
            """)

            await asyncio.sleep(2.0)
            await screenshot2(r'C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d\main_map_plot30_verified.jpg')

    finally:
        proc2.terminate()
        try:
            proc2.wait(timeout=2)
        except Exception:
            proc2.kill()

    print("\nALL VERIFICATIONS PASSED!")

if __name__ == '__main__':
    asyncio.run(run_tests())
