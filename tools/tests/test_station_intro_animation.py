import asyncio
import json
import subprocess
import urllib.request
import websockets

async def test():
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        '--remote-debugging-port=9237',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen('http://localhost:9237/json').read())
        target_tab = next(t for t in tabs if t.get('type') == 'page')
        ws_url = target_tab['webSocketDebuggerUrl']
        async with websockets.connect(ws_url) as ws:
            async def eval_js(expr):
                await ws.send(json.dumps({'id': 10, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == 10:
                        return msg.get('result', {}).get('result', {}).get('value')

            # Wait for map ready
            for _ in range(30):
                await asyncio.sleep(0.25)
                if await eval_js('window.state && window.state.mapReady'):
                    break

            await eval_js('const btn = document.getElementById("dash-proceed-btn"); if (btn) btn.click(); const modal = document.getElementById("dash-welcome-modal"); if (modal) modal.style.display = "none";')
            await asyncio.sleep(1.0)

            print('=== Test 1: Switch to QARES and observe intro animation ===')
            await eval_js('switchResearchStation("qares")')
            
            # Check curtain status immediately
            await asyncio.sleep(0.15)
            c_active = await eval_js('document.getElementById("station-transition-curtain").classList.contains("active")')
            print(' - Curtain active at t=150ms:', c_active)

            # Wait for curtain dismiss & intro start (around 450ms)
            await asyncio.sleep(0.4)
            c_dismissed = not await eval_js('document.getElementById("station-transition-curtain").classList.contains("active")')
            is_intro = await eval_js('window.state.isIntroAnimating')
            print(' - Curtain dismissed at t=550ms:', c_dismissed)
            print(' - isIntroAnimating active:', is_intro)

            # Sample camera during Phase 1 (zoom in)
            await asyncio.sleep(1.5)
            cam1 = await eval_js('({ center: window.state.map.getCenter(), zoom: window.state.map.getZoom(), pitch: window.state.map.getPitch() })')
            print(' - Camera at t=2.0s (mid fly-in): Zoom:', round(cam1['zoom'], 2), 'Pitch:', round(cam1['pitch'], 1))

            # Sample camera after Phase 2 (tilt into 3D)
            await asyncio.sleep(4.5)
            cam2 = await eval_js('({ center: window.state.map.getCenter(), zoom: window.state.map.getZoom(), pitch: window.state.map.getPitch(), bearing: window.state.map.getBearing() })')
            print(' - Camera at t=6.5s (final 3D): Zoom:', round(cam2['zoom'], 2), 'Pitch:', round(cam2['pitch'], 1), 'Bearing:', round(cam2['bearing'], 1))

            assert cam2['pitch'] > 45, f"Expected 3D pitch > 45, got {cam2['pitch']}"
            assert abs(cam2['bearing'] - 25) < 3, f"Expected QARES bearing ~25, got {cam2['bearing']}"
            print(' QARES INTRO ANIMATION VERIFIED!')

            print('\n=== Test 2: Switch back to LARES and observe intro animation ===')
            await eval_js('switchResearchStation("lares")')
            await asyncio.sleep(0.55)
            is_intro_lares = await eval_js('window.state.isIntroAnimating')
            print(' - isIntroAnimating active on LARES:', is_intro_lares)

            await asyncio.sleep(6.0)
            cam3 = await eval_js('({ center: window.state.map.getCenter(), zoom: window.state.map.getZoom(), pitch: window.state.map.getPitch(), bearing: window.state.map.getBearing() })')
            print(' - Camera on LARES final 3D: Zoom:', round(cam3['zoom'], 2), 'Pitch:', round(cam3['pitch'], 1), 'Bearing:', round(cam3['bearing'], 1))

            assert cam3['pitch'] > 45, f"Expected 3D pitch > 45, got {cam3['pitch']}"
            assert abs(cam3['bearing'] - 165) < 3, f"Expected LARES bearing ~165, got {cam3['bearing']}"
            print(' LARES INTRO ANIMATION VERIFIED!')

            print('\nALL STATION INTRO ANIMATIONS TESTED & VERIFIED WITH ZERO ERRORS!')

    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(test())
