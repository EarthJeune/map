import asyncio
import json
import subprocess
import urllib.request
import base64
import os
import websockets

async def run_verification():
    port = 9253
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        f'--remote-debugging-port={port}',
        '--window-size=1080,1920',
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

            async def take_screenshot(filepath):
                res = await call_cdp('Page.captureScreenshot', {'format': 'jpeg', 'quality': 90})
                img_data = base64.b64decode(res['data'])
                with open(filepath, 'wb') as f:
                    f.write(img_data)
                print(f"Saved screenshot: {filepath}")

            print("Waiting for map and kiosk-portrait...")
            for _ in range(40):
                ready = await eval_js("Boolean(window.map && window.map.loaded() && document.body.classList.contains('kiosk-portrait'))")
                if ready:
                    break
                await asyncio.sleep(0.5)

            # Ensure idle timer doesn't interfere
            await eval_js("if (window.idleTimer) clearTimeout(window.idleTimer);")

            # --- TEST 1: Corner Radius of Directory Menu ---
            print("\n--- TEST 1: Corner Radius of Directory Menu ---")
            sidebar_styles = await eval_js("""
                (() => {
                    const sb = document.querySelector('.sidebar');
                    const sbH = document.querySelector('.sidebar-header');
                    const dir = document.querySelector('.directory');
                    const cs = window.getComputedStyle(sb);
                    const csH = window.getComputedStyle(sbH);
                    const csD = window.getComputedStyle(dir);
                    return {
                        sidebar_borderRadius: cs.borderRadius,
                        header_tlRadius: csH.borderTopLeftRadius,
                        header_trRadius: csH.borderTopRightRadius,
                        dir_blRadius: csD.borderBottomLeftRadius,
                        dir_brRadius: csD.borderBottomRightRadius
                    };
                })()
            """)
            print("Computed radius styles:", json.dumps(sidebar_styles, indent=2))
            await take_screenshot("C:/Users/LGU-SanPedro/.gemini/antigravity/brain/0945f2fe-cc9b-48f2-820c-f986ce3c6a9d/fix1_directory_corner_radius.jpg")

            # --- TEST 2: Building Details Panel Size ---
            print("\n--- TEST 2: Selected Building Details Panel Size ---")
            await eval_js("""
                (() => {
                    // Open Post Harvest Laboratory Building
                    window.showBuildingDetails('laboratory_building');
                })()
            """)
            await asyncio.sleep(1.0)
            bp_styles = await eval_js("""
                (() => {
                    const bp = document.getElementById('building-panel');
                    const rect = bp.getBoundingClientRect();
                    const cs = window.getComputedStyle(bp);
                    const title = document.getElementById('bp-title');
                    const titleCs = window.getComputedStyle(title);
                    const btn = document.querySelector('.bp-directions-btn');
                    const btnCs = window.getComputedStyle(btn);
                    const img = document.getElementById('bp-real-image');
                    const imgCs = window.getComputedStyle(img);
                    return {
                        width: rect.width,
                        height: rect.height,
                        maxWidth: cs.maxWidth,
                        borderRadius: cs.borderRadius,
                        titleFontSize: titleCs.fontSize,
                        btnHeight: btnCs.height,
                        btnFontSize: btnCs.fontSize,
                        imageHeight: imgCs.height
                    };
                })()
            """)
            print("Building panel dimensions and typography:", json.dumps(bp_styles, indent=2))
            await take_screenshot("C:/Users/LGU-SanPedro/.gemini/antigravity/brain/0945f2fe-cc9b-48f2-820c-f986ce3c6a9d/fix2_building_panel_enlarged.jpg")

            # --- TEST 3: Camera and Speed Controls Separation ---
            print("\n--- TEST 3: Camera and Speed Controls Separation ---")
            await eval_js("""
                (() => {
                    // Start navigation to building
                    window.navigateTo('laboratory_building');
                    window.getDirections();
                })()
            """)
            await asyncio.sleep(2.0)
            # Collapse the sidebar during route (to match Picture 3)
            await eval_js("""
                (() => {
                    window.collapseSidebarMenu();
                })()
            """)
            await asyncio.sleep(1.0)
            controls_gap = await eval_js("""
                (() => {
                    const cam = document.getElementById('floating-camera-controls');
                    const spd = document.getElementById('floating-speed-controls');
                    if (!cam || !spd) return { error: 'controls element not found' };
                    const camRect = cam.getBoundingClientRect();
                    const spdRect = spd.getBoundingClientRect();
                    return {
                        camClass: cam.className,
                        spdClass: spd.className,
                        camBottom: window.innerHeight - camRect.bottom,
                        camTop: window.innerHeight - camRect.top,
                        camHeight: camRect.height,
                        spdBottom: window.innerHeight - spdRect.bottom,
                        spdTop: window.innerHeight - spdRect.top,
                        spdHeight: spdRect.height,
                        verticalGapPx: (window.innerHeight - camRect.bottom) - (window.innerHeight - spdRect.top)
                    };
                })()
            """)
            print("Camera & Speed controls positioning and vertical gap:", json.dumps(controls_gap, indent=2))
            await take_screenshot("C:/Users/LGU-SanPedro/.gemini/antigravity/brain/0945f2fe-cc9b-48f2-820c-f986ce3c6a9d/fix3_camera_speed_separation.jpg")

            # --- TEST 4: Folded Menu Visibility & Reopening ---
            print("\n--- TEST 4: Folded Directory Menu Visibility & Reopening ---")
            # Exit route mode to return to directory
            await eval_js("window.exitRouteMode();")
            await asyncio.sleep(1.0)
            # Fold directory menu
            await eval_js("window.collapseSidebarMenu();")
            await asyncio.sleep(0.8)
            folded_info = await eval_js("""
                (() => {
                    const sb = document.getElementById('sidebar');
                    const btn = document.getElementById('sidebar-toggle-btn');
                    const sbRect = sb.getBoundingClientRect();
                    const btnRect = btn.getBoundingClientRect();
                    return {
                        sidebarBottom: window.innerHeight - sbRect.bottom,
                        sidebarTopFromBottom: window.innerHeight - sbRect.top,
                        btnBottomFromWindowBottom: window.innerHeight - btnRect.bottom,
                        btnTopFromWindowBottom: window.innerHeight - btnRect.top,
                        btnWidth: btnRect.width,
                        btnHeight: btnRect.height,
                        isBtnVisible: (btnRect.bottom <= window.innerHeight && btnRect.top >= 0),
                        isBtnClickable: window.getComputedStyle(btn).pointerEvents
                    };
                })()
            """)
            print("Folded toggle button metrics:", json.dumps(folded_info, indent=2))
            await take_screenshot("C:/Users/LGU-SanPedro/.gemini/antigravity/brain/0945f2fe-cc9b-48f2-820c-f986ce3c6a9d/fix4_menu_folded_state.jpg")

            # Click toggle button to verify it pops up again!
            print("Clicking toggle button to reopen menu...")
            await eval_js("""
                (() => {
                    document.getElementById('sidebar-toggle-btn').click();
                })()
            """)
            await asyncio.sleep(0.8)
            reopened_info = await eval_js("""
                (() => {
                    const sb = document.getElementById('sidebar');
                    return {
                        isCollapsed: sb.classList.contains('collapsed'),
                        hasCollapsedBodyClass: document.body.classList.contains('sidebar-collapsed')
                    };
                })()
            """)
            print("Reopened state:", json.dumps(reopened_info, indent=2))
            await take_screenshot("C:/Users/LGU-SanPedro/.gemini/antigravity/brain/0945f2fe-cc9b-48f2-820c-f986ce3c6a9d/fix4_menu_reopened_state.jpg")

    finally:
        proc.kill()

if __name__ == '__main__':
    asyncio.run(run_verification())
