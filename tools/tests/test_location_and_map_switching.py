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
        '--remote-debugging-port=9250',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen('http://localhost:9250/json').read())
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

            async def get_info():
                return await eval_js('''(() => {
                    const map = window.state ? window.state.map : null;
                    if (!map) return null;
                    const c = map.getCenter();
                    const curtain = document.getElementById('station-transition-curtain');
                    const curtainOpacity = curtain ? window.getComputedStyle(curtain).opacity : '0';
                    return {
                        station: window.state.currentStationId,
                        styleMode: window.state.currentMapStyleMode,
                        center: [parseFloat(c.lng.toFixed(5)), parseFloat(c.lat.toFixed(5))],
                        zoom: parseFloat(map.getZoom().toFixed(2)),
                        maxBounds: map.getMaxBounds(),
                        curtainOpacity: curtainOpacity,
                        laresMaskVis: map.getLayer('lares-mask-layer') ? map.getLayoutProperty('lares-mask-layer', 'visibility') : 'missing',
                        qaresMaskVis: map.getLayer('qares-mask-layer') ? map.getLayoutProperty('qares-mask-layer', 'visibility') : 'missing',
                        laresDroneVis: map.getLayer('lares-drone-layer') ? map.getLayoutProperty('lares-drone-layer', 'visibility') : 'missing',
                        qaresOrthoVis: map.getLayer('qares-ortho-layer') ? map.getLayoutProperty('qares-ortho-layer', 'visibility') : 'missing'
                    };
                })()''')

            # Step 1: Initial
            info1 = await get_info()
            print('[Step 1 Initial LARES]:', json.dumps(info1))
            assert info1['station'] == 'lares'
            assert 121.16 <= info1['center'][0] <= 121.17

            # Step 2: Switch to QARES
            print('\n[Step 2] Switching to QARES (Aerial Drone)...')
            await eval_js('switchResearchStation("qares")')
            await asyncio.sleep(2.0)
            info2 = await get_info()
            print('[Step 2 Info]:', json.dumps(info2))
            assert info2['station'] == 'qares'
            assert 121.36 <= info2['center'][0] <= 121.38, f"Expected QARES lng ~121.37, got {info2['center'][0]}"
            assert info2['laresMaskVis'] in ('none', 'missing'), "LARES mask MUST be none at QARES!"
            assert info2['curtainOpacity'] == '0', "Curtain must be dismissed!"

            # Step 3: Switch map style to Mapbox Standard while at QARES
            print('\n[Step 3] Switching to Mapbox 3D while at QARES...')
            await eval_js('selectMapStyle("mapbox")')
            await asyncio.sleep(2.0)
            info3 = await get_info()
            print('[Step 3 Info]:', json.dumps(info3))
            assert info3['styleMode'] == 'mapbox'
            assert info3['qaresMaskVis'] in ('none', 'missing'), "QARES mask must be hidden in Mapbox mode!"
            assert 121.36 <= info3['center'][0] <= 121.38

            # Step 4: Switch to LARES while in Mapbox mode
            print('\n[Step 4] Switching to LARES while in Mapbox 3D...')
            await eval_js('switchResearchStation("lares")')
            await asyncio.sleep(2.0)
            info4 = await get_info()
            print('[Step 4 Info]:', json.dumps(info4))
            assert info4['station'] == 'lares'
            assert 121.16 <= info4['center'][0] <= 121.17, f"Expected LARES lng ~121.166, got {info4['center'][0]}"
            assert info4['qaresMaskVis'] in ('none', 'missing')
            assert info4['curtainOpacity'] == '0'

            # Step 5: Switch back to Aerial Drone while at LARES
            print('\n[Step 5] Switching back to Aerial Drone at LARES...')
            await eval_js('selectMapStyle("google")')
            await asyncio.sleep(2.0)
            info5 = await get_info()
            print('[Step 5 Info]:', json.dumps(info5))
            assert info5['styleMode'] == 'google'
            assert info5['laresDroneVis'] == 'visible'
            assert 121.16 <= info5['center'][0] <= 121.17

            # Step 6: Rapid Station Switching Stress Test (5 switches)
            print('\n[Step 6] Rapid Station Switching Stress Test...')
            for s in ['qares', 'lares', 'qares', 'lares', 'qares']:
                await eval_js(f'switchResearchStation("{s}")')
                await asyncio.sleep(0.18)
            await asyncio.sleep(2.5)
            info6 = await get_info()
            print('[Step 6 Info (ended on QARES)]:', json.dumps(info6))
            assert info6['station'] == 'qares'
            assert 121.36 <= info6['center'][0] <= 121.38, f"Expected QARES lng ~121.37, got {info6['center'][0]}"
            assert info6['curtainOpacity'] == '0'
            assert info6['laresMaskVis'] in ('none', 'missing')

            # Step 7: Rapid Map Style Switching Stress Test (4 switches)
            print('\n[Step 7] Rapid Map Style Switching Stress Test...')
            for m in ['mapbox', 'google', 'mapbox', 'google']:
                await eval_js(f'selectMapStyle("{m}")')
                await asyncio.sleep(0.3)
            await asyncio.sleep(2.5)
            info7 = await get_info()
            print('[Step 7 Info (ended on Google sat at QARES)]:', json.dumps(info7))
            assert info7['styleMode'] == 'google'
            assert 121.36 <= info7['center'][0] <= 121.38

            # Step 8: Switch back to LARES and capture final screenshot
            print('\n[Step 8] Returning to LARES (Clean Final Verification)...')
            await eval_js('switchResearchStation("lares")')
            await asyncio.sleep(2.0)
            info8 = await get_info()
            print('[Step 8 Info]:', json.dumps(info8))
            assert info8['station'] == 'lares'
            assert 121.16 <= info8['center'][0] <= 121.17

            final_snap = os.path.join(ARTIFACT_DIR, 'final_station_switch_verified.png')
            await screenshot(final_snap)
            print('\n>>> ALL 8 VERIFICATION PHASES PASSED WITH ZERO DARKNESS! <<<')
            print(f'Final screenshot saved to: {final_snap}')

    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(run())
