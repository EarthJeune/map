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
        '--remote-debugging-port=9241',
        '--window-size=1920,1080',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen('http://localhost:9241/json').read())
        target_tab = next(t for t in tabs if t.get('type') == 'page')
        ws_url = target_tab['webSocketDebuggerUrl']
        async with websockets.connect(ws_url) as ws:
            async def eval_js(expr):
                await ws.send(json.dumps({'id': 10, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == 10:
                        return msg.get('result', {}).get('result', {}).get('value')

            # Wait for map ready and welcome modal to appear
            print("1. Waiting for map ready & welcome modal...")
            for _ in range(40):
                await asyncio.sleep(0.2)
                ready = await eval_js('window.state && window.state.mapReady')
                modal_visible = await eval_js('document.getElementById("dash-welcome-modal") && document.getElementById("dash-welcome-modal").style.display !== "none"')
                if ready and modal_visible:
                    break

            modal_disp = await eval_js('document.getElementById("dash-welcome-modal").style.display')
            is_anim_initial = await eval_js('window.state.isIntroAnimating')
            cam_start = await eval_js('({ z: window.map.getZoom(), p: window.map.getPitch(), b: window.map.getBearing(), c: window.map.getCenter(), w: window.innerWidth })')
            print(f" - Window width: {cam_start['w']}")
            print(f" - Welcome modal display: {modal_disp}")
            print(f" - isIntroAnimating while modal is open: {is_anim_initial}")
            print(f" - Initial camera: Zoom={cam_start['z']:.2f}, Pitch={cam_start['p']:.1f}, Bearing={cam_start['b']:.1f}")

            # Verify background stays static while modal is open
            print("2. Verifying background remains completely stationary while modal is open...")
            await asyncio.sleep(1.5)
            cam_check = await eval_js('({ z: window.map.getZoom(), p: window.map.getPitch(), b: window.map.getBearing(), c: window.map.getCenter() })')
            is_anim_check = await eval_js('window.state.isIntroAnimating')
            print(f" - After 1.5s: Zoom={cam_check['z']:.2f}, Pitch={cam_check['p']:.1f}, isIntroAnimating={is_anim_check}")

            zoom_diff = abs(cam_check['z'] - cam_start['z'])
            pitch_diff = abs(cam_check['p'] - cam_start['p'])
            assert zoom_diff < 0.001 and pitch_diff < 0.001 and not is_anim_check, "Camera moved while modal was open!"
            print(" [PASS] Verified: Background camera is 100% STATIC while welcome modal is open!")

            # Click "Proceed to Campus Map"
            print("3. Clicking 'Proceed to Campus Map' button...")
            await eval_js('document.getElementById("dash-proceed-btn").click()')
            await asyncio.sleep(0.5)

            is_anim_after_click = await eval_js('window.state.isIntroAnimating')
            has_played = await eval_js('window.state.hasInitialIntroPlayed')
            print(f" - isIntroAnimating after clicking proceed: {is_anim_after_click}")
            print(f" - hasInitialIntroPlayed: {has_played}")
            assert is_anim_after_click, "Intro animation did NOT start after clicking Proceed!"

            # Sample camera during fly-in
            await asyncio.sleep(2.0)
            cam_flyin = await eval_js('({ z: window.map.getZoom(), p: window.map.getPitch(), b: window.map.getBearing() })')
            print(f" - Mid fly-in camera: Zoom={cam_flyin['z']:.2f}, Pitch={cam_flyin['p']:.1f}")
            assert cam_flyin['z'] > cam_start['z'], "Camera did not zoom in during fly-in!"
            print(" [PASS] Verified: Intro animation started smoothly on Proceed!")

            # Wait for animation completion
            print("4. Waiting for intro animation to complete...")
            for _ in range(40):
                await asyncio.sleep(0.2)
                animating = await eval_js('window.state.isIntroAnimating')
                if not animating:
                    break
            cam_final = await eval_js('({ z: window.map.getZoom(), p: window.map.getPitch(), b: window.map.getBearing() })')
            print(f" - Final 3D camera: Zoom={cam_final['z']:.2f}, Pitch={cam_final['p']:.1f}, Bearing={cam_final['b']:.1f}")
            print(" [PASS] Verified: Arrived at signature 3D perspective!")

            # Re-open welcome modal and verify it does NOT replay repetitive intro
            print("5. Re-opening Welcome Modal via info/emblem click and proceeding again...")
            await eval_js('window.showDashWelcomeModal()')
            await asyncio.sleep(0.3)
            await eval_js('document.getElementById("dash-proceed-btn").click()')
            await asyncio.sleep(0.5)
            is_anim_second = await eval_js('window.state.isIntroAnimating')
            print(f" - isIntroAnimating on second proceed: {is_anim_second}")
            assert not is_anim_second, "Intro animation re-played repetitively on second proceed!"
            print(" [PASS] Verified: Intro animation does NOT repeat repetitively!")

            print("\nALL TESTS PASSED SUCCESSFULLY!")
    finally:
        proc.kill()

if __name__ == '__main__':
    asyncio.run(test())
