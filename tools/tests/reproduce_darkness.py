import asyncio
import json
import subprocess
import urllib.request
import websockets
import base64
import os

ARTIFACT_DIR = r'C:\Users\LGU-SanPedro\.gemini\antigravity-ide\brain\ff627781-c64f-4830-bce7-fdd70763aee1'

async def run():
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        '--remote-debugging-port=9245',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen('http://localhost:9245/json').read())
        target_tab = next(t for t in tabs if t.get('type') == 'page')
        ws_url = target_tab['webSocketDebuggerUrl']
        async with websockets.connect(ws_url) as ws:
            async def eval_js(expr):
                await ws.send(json.dumps({'id': 10, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == 10:
                        return msg.get('result', {}).get('result', {}).get('value')

            async def screenshot(filename):
                await ws.send(json.dumps({'id': 11, 'method': 'Page.captureScreenshot'}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == 11:
                        data = base64.b64decode(msg['result']['data'])
                        with open(filename, 'wb') as f:
                            f.write(data)
                        break

            # wait ready
            for _ in range(30):
                await asyncio.sleep(0.2)
                if await eval_js('window.state && window.state.mapReady'):
                    break

            await eval_js('const btn = document.getElementById("dash-proceed-btn"); if (btn) btn.click(); const modal = document.getElementById("dash-welcome-modal"); if (modal) modal.style.display = "none";')
            await asyncio.sleep(1.0)

            async def check_state(label):
                data = await eval_js('''(() => {
                    const map = window.state ? window.state.map : null;
                    if (!map) return { error: 'No map' };
                    const curtain = document.getElementById('station-transition-curtain');
                    const curtainActive = curtain ? curtain.classList.contains('active') : false;
                    const curtainOpacity = curtain ? window.getComputedStyle(curtain).opacity : 'none';
                    const c = map.getCenter();
                    
                    // Check layer visibilities
                    const layers = ['lares-mask-layer', 'qares-mask-layer', 'google-satellite-layer', 'lares-drone-layer', 'qares-ortho-layer', '3d-buildings-models-layer', 'qares-footprints-3d'];
                    const layerStates = {};
                    layers.forEach(l => {
                        const layer = map.getLayer(l);
                        if (!layer) layerStates[l] = 'missing';
                        else layerStates[l] = map.getLayoutProperty(l, 'visibility') || 'default-visible';
                    });

                    return {
                        station: window.state.currentStationId,
                        styleMode: window.state.currentMapStyleMode,
                        center: [c.lng, c.lat],
                        zoom: map.getZoom(),
                        pitch: map.getPitch(),
                        bearing: map.getBearing(),
                        maxBounds: map.getMaxBounds(),
                        curtainActive,
                        curtainOpacity,
                        layerStates
                    };
                })()''')
                print(f"\n--- State at {label} ---")
                print(json.dumps(data, indent=2))
                return data

            # Initial
            await check_state('1. Initial LARES')
            await screenshot(os.path.join(ARTIFACT_DIR, 'test_switch_1_initial.png'))

            # Switch to QARES
            print("\n>>> Switching to QARES...")
            await eval_js('switchResearchStation("qares")')
            await asyncio.sleep(1.5)
            await check_state('2. After switch to QARES (1.5s)')
            await screenshot(os.path.join(ARTIFACT_DIR, 'test_switch_2_qares.png'))

            # Switch back to LARES
            print("\n>>> Switching back to LARES...")
            await eval_js('switchResearchStation("lares")')
            await asyncio.sleep(1.5)
            await check_state('3. After switch back to LARES (1.5s)')
            await screenshot(os.path.join(ARTIFACT_DIR, 'test_switch_3_lares.png'))

            # Switch to QARES again
            print("\n>>> Switching to QARES (2nd time)...")
            await eval_js('switchResearchStation("qares")')
            await asyncio.sleep(1.5)
            await check_state('4. After QARES 2nd time (1.5s)')
            await screenshot(os.path.join(ARTIFACT_DIR, 'test_switch_4_qares2.png'))

            # Switch map style to Mapbox while at QARES
            print("\n>>> Switching map style to Mapbox at QARES...")
            await eval_js('selectMapStyle("mapbox")')
            await asyncio.sleep(2.0)
            await check_state('5. QARES in Mapbox Mode')
            await screenshot(os.path.join(ARTIFACT_DIR, 'test_switch_5_qares_mapbox.png'))

            # Switch back to LARES while in Mapbox mode
            print("\n>>> Switching to LARES while in Mapbox Mode...")
            await eval_js('switchResearchStation("lares")')
            await asyncio.sleep(1.5)
            await check_state('6. LARES in Mapbox Mode')
            await screenshot(os.path.join(ARTIFACT_DIR, 'test_switch_6_lares_mapbox.png'))

            # Switch map style back to Google (Drone) while at LARES
            print("\n>>> Switching map style to Google (Drone) at LARES...")
            await eval_js('selectMapStyle("google")')
            await asyncio.sleep(2.0)
            await check_state('7. LARES back in Google Mode')
            await screenshot(os.path.join(ARTIFACT_DIR, 'test_switch_7_lares_google.png'))

            # Rapid switching test
            print("\n>>> Rapid switching test (switching quickly)...")
            await eval_js('switchResearchStation("qares")')
            await asyncio.sleep(0.1)
            await eval_js('switchResearchStation("lares")')
            await asyncio.sleep(0.1)
            await eval_js('switchResearchStation("qares")')
            await asyncio.sleep(2.0)
            await check_state('8. After rapid switching ending on QARES')
            await screenshot(os.path.join(ARTIFACT_DIR, 'test_switch_8_rapid.png'))

    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(run())
