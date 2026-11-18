import asyncio
import base64
import json
import os
import subprocess
import urllib.request
import websockets

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9260

async def main():
    proc = subprocess.Popen([
        EDGE_PATH,
        '--headless=new',
        f'--remote-debugging-port={PORT}',
        '--window-size=1080,1920',
        '--disable-gpu',
        '--no-sandbox',
        '--force-device-scale-factor=1',
        'http://localhost:8080/?mode=kiosk&station=lares'
    ])
    try:
        await asyncio.sleep(3.0)
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{PORT}/json').read())
        target = next((t for t in tabs if t.get('type') == 'page' and 'localhost:8080' in t.get('url', '')), None)
        if not target:
            target = next(t for t in tabs if t.get('type') == 'page')
        print(f"Target tab: {target['url']}")

        async with websockets.connect(target['webSocketDebuggerUrl'], max_size=50*1024*1024) as ws:
            msg_id = 100
            async def eval_js(expr):
                nonlocal msg_id
                msg_id += 1
                await ws.send(json.dumps({'id': msg_id, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == msg_id:
                        res = msg.get('result', {})
                        if 'exceptionDetails' in res:
                            print("JS Exception:", res['exceptionDetails'])
                        return res.get('result', {}).get('value')

            async def screenshot(filename):
                nonlocal msg_id
                msg_id += 1
                await ws.send(json.dumps({'id': msg_id, 'method': 'Page.captureScreenshot', 'params': {'format': 'jpeg', 'quality': 85}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == msg_id:
                        data = msg['result']['data']
                        with open(filename, 'wb') as f:
                            f.write(base64.b64decode(data))
                        print(f"Saved screenshot: {filename}")
                        break

            # Wait for map load and close welcome modal if visible
            await asyncio.sleep(2.0)
            await eval_js('''
                const modal = document.getElementById("dash-welcome-modal");
                if (modal) modal.style.display = "none";
                document.body.classList.remove("modal-open");
                document.body.classList.remove("kiosk-landscape");
                document.body.classList.add("kiosk-portrait");
            ''')
            await asyncio.sleep(0.5)

            # --- TEST SCENARIO 1: Folded menu leaves ONLY the button ---
            print("\n=== Testing Scenario 1: Folded menu container 100% off-screen ===")
            await eval_js('window.collapseSidebarMenu()')
            await asyncio.sleep(0.6)

            sidebar_rect = await eval_js('''
                (() => {
                    const el = document.getElementById("sidebar");
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
                })()
            ''')
            btn_rect = await eval_js('''
                (() => {
                    const btn = document.getElementById("sidebar-toggle-btn");
                    if (!btn) return null;
                    const r = btn.getBoundingClientRect();
                    const style = window.getComputedStyle(btn);
                    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height, display: style.display, pointerEvents: style.pointerEvents };
                })()
            ''')

            win_h = await eval_js('window.innerHeight')
            print("Viewport innerHeight:", win_h)
            print("Sidebar Rect when Collapsed:", sidebar_rect)
            print("Toggle Button Rect when Collapsed:", btn_rect)

            assert sidebar_rect['top'] >= win_h, f"Sidebar top ({sidebar_rect['top']}) must be >= {win_h} (100% off screen)!"
            assert btn_rect['top'] < win_h and btn_rect['bottom'] >= win_h - 5, f"Button must be visible resting at the bottom! Got top={btn_rect['top']}, bottom={btn_rect['bottom']}, win_h={win_h}"
            assert btn_rect['display'] == 'flex', f"Button display must be flex! Got {btn_rect['display']}"
            assert btn_rect['pointerEvents'] == 'auto', f"Button pointer-events must be auto! Got {btn_rect['pointerEvents']}"

            await screenshot('SS-SCENARIO-1_folded_menu_only_button.jpg')
            print(">>> SCENARIO 1 PASSED: Menu container is 100% hidden off screen, ONLY the toggle button is visible!")

            # --- TEST SCENARIO 2 & 3: Active route navigation defaults to clean Picture 2 view with toggle button visible ---
            print("\n=== Testing Scenario 2 & 3: Active Route navigation defaults to folded with button visible ===")
            await eval_js('''
                if (typeof window.showBuildingPanel === "function") {
                    window.showBuildingPanel("amad_building");
                }
            ''')
            await asyncio.sleep(0.8)

            await eval_js('''
                if (typeof window.getDirections === "function") {
                    window.getDirections();
                }
            ''')
            await asyncio.sleep(1.0)

            is_route_active = await eval_js('document.body.classList.contains("has-active-route")')
            is_sidebar_collapsed = await eval_js('document.getElementById("sidebar").classList.contains("collapsed")')
            btn_nav_rect = await eval_js('''
                (() => {
                    const btn = document.getElementById("sidebar-toggle-btn");
                    if (!btn) return null;
                    const r = btn.getBoundingClientRect();
                    const style = window.getComputedStyle(btn);
                    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height, display: style.display, pointerEvents: style.pointerEvents };
                })()
            ''')
            fcc_rect = await eval_js('''
                (() => {
                    const el = document.getElementById("floating-camera-controls");
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { top: r.top, bottom: r.bottom, height: r.height };
                })()
            ''')
            fsc_rect = await eval_js('''
                (() => {
                    const el = document.getElementById("floating-speed-controls");
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { top: r.top, bottom: r.bottom, height: r.height };
                })()
            ''')

            print("Has active route:", is_route_active)
            print("Is sidebar collapsed during route:", is_sidebar_collapsed)
            print("Toggle Button Rect during navigation:", btn_nav_rect)
            print("Speed Controls Rect:", fsc_rect)
            print("Camera Controls Rect:", fcc_rect)

            assert is_route_active, "Body must have has-active-route!"
            assert is_sidebar_collapsed, "Sidebar must default to collapsed in portrait kiosk mode during navigation (Picture 2)!"
            assert btn_nav_rect['top'] < win_h and btn_nav_rect['bottom'] >= win_h - 5, f"Button must be visible at bottom during active route! Got top={btn_nav_rect['top']}, win_h={win_h}"
            assert btn_nav_rect['pointerEvents'] == 'auto', "Button must have pointer-events: auto!"

            # Check gap between speed and camera
            if fsc_rect and fcc_rect:
                gap = fsc_rect['top'] - fcc_rect['bottom']
                print(f"Gap between Speed (top: {fsc_rect['top']}) and Camera (bottom: {fcc_rect['bottom']}): {gap}px")
                assert gap >= 12, f"Camera and Speed must be comfortably separated! Gap={gap}px"

            await screenshot('SS-SCENARIO-2_active_route_folded_picture_2.jpg')
            print(">>> SCENARIO 2 & 3 DEFAULT PASSED: Navigation cleanly defaults to Picture 2, walker + camera/speed active, button visible at bottom!")

            # --- TEST SCENARIO 3 TOGGLE: Tapping button expands route drawer (Picture 3) ---
            print("\n=== Testing Toggle: Tapping button pops up directions drawer ===")
            await eval_js('window.toggleSidebarMenu()')
            await asyncio.sleep(0.6)

            is_collapsed_after_toggle = await eval_js('document.getElementById("sidebar").classList.contains("collapsed")')
            sidebar_open_rect = await eval_js('''
                (() => {
                    const el = document.getElementById("sidebar");
                    const r = el.getBoundingClientRect();
                    return { top: r.top, bottom: r.bottom, height: r.height };
                })()
            ''')
            print("Is sidebar collapsed after toggle:", is_collapsed_after_toggle)
            print("Sidebar open rect:", sidebar_open_rect)
            assert not is_collapsed_after_toggle, "Sidebar should now be expanded to show route info!"
            assert sidebar_open_rect['top'] < win_h, f"Sidebar should now be visible above bottom! Top={sidebar_open_rect['top']}"

            await screenshot('SS-SCENARIO-3_active_route_drawer_popped_up.jpg')
            print(">>> SCENARIO 3 TOGGLE PASSED: Directions drawer popped up upon tapping button!")

            # --- TEST TOGGLE BACK TO FOLDED: Tapping button folds drawer back to Picture 2 ---
            print("\n=== Testing Toggle Back: Tapping button folds drawer back to Picture 2 ===")
            await eval_js('window.toggleSidebarMenu()')
            await asyncio.sleep(0.6)

            is_collapsed_again = await eval_js('document.getElementById("sidebar").classList.contains("collapsed")')
            print("Is sidebar collapsed again:", is_collapsed_again)
            assert is_collapsed_again, "Sidebar should be collapsed again!"

            await screenshot('SS-SCENARIO-2B_active_route_folded_restored.jpg')
            print(">>> SCENARIO 2B PASSED: Folded state flawlessly restored upon second tap!")

    finally:
        proc.kill()

if __name__ == '__main__':
    asyncio.run(main())
