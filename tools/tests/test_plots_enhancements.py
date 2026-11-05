import asyncio
import json
import subprocess
import urllib.request
import websockets

async def test():
    port = 9243
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

            # Wait for mapReady and plots layer
            print("1. Waiting for map & plot layers...")
            for _ in range(40):
                await asyncio.sleep(0.3)
                ready = await eval_js('Boolean(window.mapReady && window.map && window.map.getSource("plots-group-source"))')
                if ready:
                    break

            # 1. Assert plot layers and markers exist
            layers_val = await eval_js("""
            (() => {
                const m = window.map;
                return {
                    hasSource: Boolean(m.getSource('plots-group-source')),
                    hasFill: Boolean(m.getLayer('plots-group-fill')),
                    hasCasing: Boolean(m.getLayer('plots-group-casing')),
                    hasCuts: Boolean(m.getLayer('plots-internal-cuts')),
                    markerCount: document.querySelectorAll('.plot-map-marker').length
                };
            })()
            """)
            print("Layer Status:", layers_val)
            assert layers_val.get("hasSource") and layers_val.get("hasFill") and layers_val.get("hasCasing") and layers_val.get("hasCuts")
            assert layers_val.get("markerCount") == 22, f"Expected 22 markers, got {layers_val.get('markerCount')}"
            print("[PASS] 22 Plot markers and all Mapbox layers initialized.")

            # 2. Check Citrus Orchard marker indicator
            citrus_val = await eval_js("""
            (() => {
                const citrus = document.querySelector('.plot-map-marker[data-zone-id="zone_citrus_orchard"]');
                if (!citrus) return null;
                return {
                    name: citrus.querySelector('.plot-marker-name')?.textContent,
                    range: citrus.querySelector('.plot-marker-range')?.textContent
                };
            })()
            """)
            print("Citrus Marker Content:", citrus_val)
            assert "Citrus Orchard" in citrus_val.get("name", "")
            assert "7 Plots" in citrus_val.get("range", "")
            print("[PASS] Multiple plots indicator verified ('Plots 6–12 • 7 Plots').")

            # 3. Test Toggle Agricultural Plots Switch OFF
            await eval_js("window.handleLayerToggle('plots', false);")
            await asyncio.sleep(0.3)
            off_opacity = await eval_js("JSON.stringify(window.map.getPaintProperty('plots-group-fill', 'fill-opacity'))")
            print("Fill opacity paint property when OFF:", off_opacity)
            assert "0.001" in str(off_opacity)
            print("[PASS] Agricultural Plots OFF correctly turns off idle highlights.")

            # 4. Turn plots back ON
            await eval_js("window.handleLayerToggle('plots', true);")
            await asyncio.sleep(0.3)
            on_opacity = await eval_js("JSON.stringify(window.map.getPaintProperty('plots-group-fill', 'fill-opacity'))")
            print("Fill opacity paint property when ON:", on_opacity)
            assert "0.16" in str(on_opacity)
            print("[PASS] Agricultural Plots ON correctly restores highlights.")

            # 5. Test Click on Citrus Orchard -> opens #building-panel
            await eval_js("window.selectPlotZone('zone_citrus_orchard');")
            await asyncio.sleep(0.5)
            panel_val = await eval_js("""
            (() => {
                const panel = document.getElementById('building-panel');
                return {
                    isActive: Boolean(panel && panel.classList.contains('active')),
                    title: document.getElementById('bp-title')?.textContent,
                    sub: document.getElementById('bp-subtitle')?.textContent,
                    subChipCount: document.querySelectorAll('.sub-plot-chip').length
                };
            })()
            """)
            print("Drawer Status upon Plot Selection:", panel_val)
            assert panel_val.get("isActive") is True
            assert panel_val.get("title") == "Citrus Orchard"
            assert "m²" in panel_val.get("sub", "") or "ha" in panel_val.get("sub", ""), f"Subtitle should include area: {panel_val.get('sub')}"
            assert panel_val.get("subChipCount") == 7, f"Expected 7 sub chips, got {panel_val.get('subChipCount')}"
            print("[PASS] Plot Drawer displays estimated size, sub-plot count, and 7 interactive sub-plot chips.")

            # 6. Test Compact Number mode
            await eval_js("window.setLabelDisplayMode('compact');")
            await asyncio.sleep(0.3)
            is_compact = await eval_js("Boolean(document.body.classList.contains('label-mode-compact'))")
            assert is_compact is True
            print("[PASS] Compact mode successfully activated and synchronized with plots.")

            print("\nALL 6/6 TEST SUITE ASSERTIONS PASSED!")

    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(test())
