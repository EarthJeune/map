import asyncio
import json
import subprocess
import urllib.request
import websockets
import os

async def run():
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        '--remote-debugging-port=9242',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen('http://localhost:9242/json').read())
        target_tab = next(t for t in tabs if t.get('type') == 'page')
        ws_url = target_tab['webSocketDebuggerUrl']
        async with websockets.connect(ws_url) as ws:
            logs = []
            async def eval_js(expr):
                await ws.send(json.dumps({'id': 10, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('method') == 'Runtime.consoleAPICalled':
                        args = [str(a.get('value', a)) for a in msg['params'].get('args', [])]
                        logs.append(f"[{msg['params']['type']}] " + " ".join(args))
                    elif msg.get('method') == 'Runtime.exceptionThrown':
                        logs.append(f"[EXCEPTION] {json.dumps(msg['params'])}")
                    elif msg.get('id') == 10:
                        return msg.get('result', {}).get('result', {}).get('value')

            await ws.send(json.dumps({'id': 1, 'method': 'Runtime.enable'}))

            for _ in range(40):
                await asyncio.sleep(0.2)
                ready = await eval_js('window.state && window.state.mapReady')
                if ready:
                    break

            await eval_js('const btn = document.getElementById("dash-proceed-btn"); if (btn) btn.click(); const modal = document.getElementById("dash-welcome-modal"); if (modal) modal.style.display = "none";')
            await asyncio.sleep(0.5)

            # Switch station to QARES
            print("Switching to QARES...")
            await eval_js('switchResearchStation("qares")')
            await asyncio.sleep(4.0)

            state_info = await eval_js('''(() => {
                const map = window.state.map;
                const c = map.getCenter();
                return {
                    center: [c.lng, c.lat],
                    zoom: map.getZoom(),
                    pitch: map.getPitch(),
                    bearing: map.getBearing(),
                    bounds: map.getMaxBounds(),
                    styleMode: window.state.currentMapStyleMode,
                    currentStationId: window.state.currentStationId,
                    qaresLayers: map.getStyle().layers.filter(l => l.id.includes('qares')).map(l => ({
                        id: l.id,
                        visibility: map.getLayoutProperty(l.id, 'visibility')
                    }))
                };
            })()''')

            print("\n--- Map Telemetry after switch ---")
            print(json.dumps(state_info, indent=2))

            print("\n--- Captured Console Logs & Exceptions ---")
            for l in logs:
                print(l)

    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(run())
