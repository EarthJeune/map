import asyncio
import json
import subprocess
import urllib.request
import websockets

async def test():
    port = 9245
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        f'--remote-debugging-port={port}',
        '--window-size=1920,1080',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])

    try:
        await asyncio.sleep(2.5)
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

            print("Waiting for map and plots to load...")
            for _ in range(40):
                await asyncio.sleep(0.3)
                ready = await eval_js('Boolean(window.mapReady && window.map && window.map.getSource("plots-group-source"))')
                if ready:
                    break

            # -------------------------------------------------------------
            # TEST 1: Hover Zero-Teleportation Verification across All Modes
            # -------------------------------------------------------------
            print("\n1. Testing plot marker hover teleportation across modes...")
            
            # Mode A: Overview / Collapsed mode
            await eval_js("window.map.setZoom(16.8); window.updatePlotMarkerLOD();")
            await asyncio.sleep(0.5)

            marker_geo = await eval_js("""
            (() => {
                const marker = document.querySelector('.plot-map-marker[data-zone-id="zone_citrus_orchard"]');
                const badge = marker.querySelector('.plot-marker-badge');
                const rectBefore = badge.getBoundingClientRect();
                
                // Add hover
                marker.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                marker.classList.add('hovered');
                const rectAfter = badge.getBoundingClientRect();

                marker.classList.remove('hovered');
                marker.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

                return {
                    before: { x: rectBefore.x, y: rectBefore.y, w: rectBefore.width, h: rectBefore.height },
                    after: { x: rectAfter.x, y: rectAfter.y, w: rectAfter.width, h: rectAfter.height },
                    dx: Math.abs(rectAfter.x - rectBefore.x),
                    dy: Math.abs(rectAfter.y - rectBefore.y)
                };
            })()
            """)
            print(f"A. Collapsed Mode - Delta shift on hover: dx={marker_geo['dx']:.2f}px, dy={marker_geo['dy']:.2f}px")
            assert marker_geo['dx'] < 1.0, f"Teleportation in collapsed mode! dx={marker_geo['dx']}px"
            assert marker_geo['dy'] < 1.0, f"Teleportation in collapsed mode! dy={marker_geo['dy']}px"

            # Mode B: Settings Compact mode (label-mode-compact)
            await eval_js("document.body.classList.add('label-mode-compact'); window.updatePlotMarkerLOD();")
            await asyncio.sleep(0.3)
            compact_geo = await eval_js("""
            (() => {
                const marker = document.querySelector('.plot-map-marker[data-zone-id="zone_citrus_orchard"]');
                const badge = marker.querySelector('.plot-marker-badge');
                const rectBefore = badge.getBoundingClientRect();
                
                marker.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                marker.classList.add('hovered');
                const rectAfter = badge.getBoundingClientRect();

                marker.classList.remove('hovered');
                marker.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

                return {
                    dx: Math.abs(rectAfter.x - rectBefore.x),
                    dy: Math.abs(rectAfter.y - rectBefore.y)
                };
            })()
            """)
            print(f"B. Compact Mode - Delta shift on hover: dx={compact_geo['dx']:.2f}px, dy={compact_geo['dy']:.2f}px")
            assert compact_geo['dx'] < 1.0, f"Teleportation in compact mode! dx={compact_geo['dx']}px"
            assert compact_geo['dy'] < 1.0, f"Teleportation in compact mode! dy={compact_geo['dy']}px"
            await eval_js("document.body.classList.remove('label-mode-compact'); window.updatePlotMarkerLOD();")
            print("[PASS] Zero teleportation verified across all display modes!")

            # -------------------------------------------------------------
            # TEST 2: Arrival Notification Stays Visible on Outside Touch
            # -------------------------------------------------------------
            print("\n2. Testing arrival notification outside-click behavior...")
            # Trigger arrival countdown
            await eval_js("window.startArrivedCountdown('RAED Building');")
            await asyncio.sleep(0.3)

            bar_status = await eval_js("""
            (() => {
                const bar = document.getElementById('kiosk-arrival-action-bar');
                return {
                    isActive: Boolean(bar && bar.classList.contains('active')),
                    text: document.getElementById('kaa-countdown-text')?.textContent
                };
            })()
            """)
            print("Initial arrival bar status:", bar_status)
            assert bar_status['isActive'] is True, "Arrival bar should be active upon arrival"
            assert "30s" in bar_status['text'], "Initial countdown should mention 30s"

            # Simulate touching/clicking outside (e.g. on the map canvas)
            print("Simulating touch/click on map canvas outside the notification...")
            await eval_js("""
            (() => {
                const mapCanvas = window.map.getCanvas();
                const evt = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 200, clientY: 200 });
                mapCanvas.dispatchEvent(evt);
            })()
            """)
            await asyncio.sleep(0.4)

            # Check bar is STILL active and countdown is paused
            bar_after_click = await eval_js("""
            (() => {
                const bar = document.getElementById('kiosk-arrival-action-bar');
                return {
                    isActive: Boolean(bar && bar.classList.contains('active')),
                    text: document.getElementById('kaa-countdown-text')?.textContent
                };
            })()
            """)
            print("Arrival bar status after clicking outside on map:", bar_after_click)
            assert bar_after_click['isActive'] is True, "Arrival notification vanished when clicking outside! It must stay active."
            assert bar_after_click['text'] == 'Auto-return paused', f"Countdown text expected 'Auto-return paused', got '{bar_after_click['text']}'"
            print("[PASS] Verified: Arrival notification stays active and visible when interacting outside on map!")

            # -------------------------------------------------------------
            # TEST 3: Close button explicitly dismisses the notification
            # -------------------------------------------------------------
            print("\n3. Testing explicit dismiss button (X)...")
            await eval_js("""
            (() => {
                const closeBtn = document.querySelector('.kaa-close-btn');
                if (closeBtn) closeBtn.click();
            })()
            """)
            await asyncio.sleep(0.3)

            bar_closed = await eval_js("Boolean(document.getElementById('kiosk-arrival-action-bar')?.classList.contains('active'))")
            assert bar_closed is False, "Close button should dismiss the notification"
            print("[PASS] Explicit close button dismisses notification cleanly.")

            print("\nALL VERIFICATION ASSERTIONS PASSED!")

    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(test())
