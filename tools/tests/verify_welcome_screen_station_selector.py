import asyncio
import json
import os
import subprocess
import urllib.request
import websockets
import base64

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9260
ARTIFACTS_DIR = r'C:\Users\LGU-SanPedro\.gemini\antigravity\brain\0945f2fe-cc9b-48f2-820c-f986ce3c6a9d'

async def capture_welcome_screen():
    print("=== Testing 4-Station Welcome Screen Over 3D Aerial View ===")
    
    proc = subprocess.Popen([
        EDGE_PATH,
        '--headless=new',
        f'--remote-debugging-port={PORT}',
        '--window-size=1920,1080',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])
    
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{PORT}/json').read())
        target_tab = next((t for t in tabs if t.get('type') == 'page' and 'localhost:8080' in t.get('url', '')), None)
        if not target_tab:
            target_tab = next(t for t in tabs if t.get('type') == 'page')
        print(f"Connected to tab: {target_tab['url']}")
        
        async with websockets.connect(target_tab['webSocketDebuggerUrl'], max_size=20*1024*1024) as ws:
            msg_id = 100
            async def send_cmd(method, params=None):
                nonlocal msg_id
                msg_id += 1
                curr_id = msg_id
                await ws.send(json.dumps({'id': curr_id, 'method': method, 'params': params or {}}))
                while True:
                    raw = await ws.recv()
                    msg = json.loads(raw)
                    if msg.get('id') == curr_id:
                        res = msg.get('result', {})
                        if 'exceptionDetails' in res:
                            print("JS Exception:", res['exceptionDetails'])
                        return res

            async def eval_js(expr):
                res = await send_cmd('Runtime.evaluate', {'expression': expr, 'returnByValue': True})
                return res.get('result', {}).get('value')

            # Wait for map & welcome modal
            print("1. Waiting for live map & welcome modal...")
            for _ in range(40):
                await asyncio.sleep(0.3)
                ready = await eval_js('Boolean(window.state && window.state.mapReady)')
                modal_vis = await eval_js('Boolean(document.getElementById("dash-welcome-modal") && document.getElementById("dash-welcome-modal").style.display === "flex")')
                if ready and modal_vis:
                    break

            # Verify the 4 station cards
            station_cards = await eval_js('''
                Array.from(document.querySelectorAll(".dash-welcome-station-card")).map(c => ({
                    station: c.dataset.station,
                    isActive: c.classList.contains("active"),
                    code: c.querySelector(".dash-wsc-code") ? c.querySelector(".dash-wsc-code").textContent.trim() : null,
                    province: c.querySelector(".dash-wsc-province") ? c.querySelector(".dash-wsc-province").textContent.trim() : null,
                    badge: c.querySelector(".dash-wsc-badge") ? c.querySelector(".dash-wsc-badge").textContent.trim() : null
                }))
            ''')
            print(f"2. Found {len(station_cards)} station cards:")
            for sc in station_cards:
                print(f"   - [{sc['station']}] {sc['code']} ({sc['province']}) | Badge: {sc['badge']} | Active: {sc['isActive']}")

            assert len(station_cards) == 4, f"Expected 4 station cards, got {len(station_cards)}"
            assert any(sc['station'] == 'lares' and sc['isActive'] for sc in station_cards), "DA-LARES should be active initially"

            # Check proceed button text
            btn_text = await eval_js('document.getElementById("dash-proceed-btn").textContent.trim()')
            print(f"3. Proceed Button Text: '{btn_text}'")

            # Let 3D map finish initial tile load under the modal
            await asyncio.sleep(2.0)

            # Capture Desktop Welcome Screen (SS-01 visual!)
            print("4. Capturing Desktop 1920x1080 Welcome Screen with 4 Stations...")
            shot_res = await send_cmd('Page.captureScreenshot', {'format': 'jpeg', 'quality': 90})
            shot_data = base64.b64decode(shot_res['data'])
            ss01_path = os.path.join(ARTIFACTS_DIR, 'SS-01_welcome_4_stations_desktop.jpg')
            with open(ss01_path, 'wb') as f:
                f.write(shot_data)
            print(f"   Saved SS-01 Desktop artifact to: {ss01_path}")

            # Test Portrait Viewport (1080x1920 Kiosk)
            print("5. Switching viewport to Portrait Kiosk (1080x1920)...")
            await send_cmd('Emulation.setDeviceMetricsOverride', {
                'width': 1080,
                'height': 1920,
                'deviceScaleFactor': 1,
                'mobile': False
            })
            await asyncio.sleep(1.0)
            shot_portrait = await send_cmd('Page.captureScreenshot', {'format': 'jpeg', 'quality': 90})
            shot_pdata = base64.b64decode(shot_portrait['data'])
            portrait_path = os.path.join(ARTIFACTS_DIR, 'SS-01_welcome_4_stations_portrait_kiosk.jpg')
            with open(portrait_path, 'wb') as f:
                f.write(shot_pdata)
            print(f"   Saved SS-01 Portrait Kiosk artifact to: {portrait_path}")

            # Test Mobile Viewport (412x915 Mobile)
            print("6. Switching viewport to Mobile (412x915)...")
            await send_cmd('Emulation.setDeviceMetricsOverride', {
                'width': 412,
                'height': 915,
                'deviceScaleFactor': 1,
                'mobile': True
            })
            await asyncio.sleep(1.0)
            shot_mobile = await send_cmd('Page.captureScreenshot', {'format': 'jpeg', 'quality': 90})
            shot_mdata = base64.b64decode(shot_mobile['data'])
            mobile_path = os.path.join(ARTIFACTS_DIR, 'SS-01_welcome_4_stations_mobile.jpg')
            with open(mobile_path, 'wb') as f:
                f.write(shot_mdata)
            print(f"   Saved SS-01 Mobile artifact to: {mobile_path}")

            # Test clicking a station card (e.g. DA-RARES)
            print("7. Testing interaction: clicking DA-RARES station card...")
            await eval_js('window.handleWelcomeSelectStation("rares")')
            await asyncio.sleep(0.8)
            
            welcome_disp = await eval_js('document.getElementById("dash-welcome-modal").style.display')
            dev_modal_disp = await eval_js('document.getElementById("station-dev-modal") ? document.getElementById("station-dev-modal").style.display : "none"')
            print(f"   Welcome modal display after click: {welcome_disp}")
            print(f"   Station Dev Modal display: {dev_modal_disp}")
            assert welcome_disp == 'none', "Welcome modal should close upon selecting a station"
            print("   [PASS] 4-Station Welcome Screen verification 100% COMPLETE!")

    finally:
        proc.kill()
        print("Edge process terminated.")

if __name__ == '__main__':
    asyncio.run(capture_welcome_screen())
