import asyncio
import json
import os
import subprocess
import urllib.request
import websockets

async def run_fps_test():
    port = 9249
    edge_path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

    proc = subprocess.Popen([
        edge_path,
        '--headless=new',
        f'--remote-debugging-port={port}',
        '--window-size=1600,900',
        '--disable-gpu',
        '--no-sandbox',
        'http://localhost:8080/?mode=kiosk'
    ])

    try:
        await asyncio.sleep(3.5)
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

            # Wait for mapReady
            for _ in range(40):
                await asyncio.sleep(0.3)
                ready = await eval_js('Boolean(window.mapReady && window.map)')
                if ready:
                    break

            await eval_js("document.getElementById('dash-welcome-modal')?.remove();")
            await asyncio.sleep(1.0)

            # Sample 3 seconds of idle
            res = await eval_js("""
                new Promise(resolve => {
                    const samples = [];
                    let last = performance.now();
                    function loop() {
                        const now = performance.now();
                        samples.push(now - last);
                        last = now;
                        if (samples.length >= 60) {
                            const fps = samples.map(d => 1000 / d);
                            const avg = fps.reduce((a,b)=>a+b,0) / fps.length;
                            resolve({
                                avgFps: Math.round(avg * 10) / 10,
                                samplesCount: samples.length
                            });
                        } else {
                            requestAnimationFrame(loop);
                        }
                    }
                    requestAnimationFrame(loop);
                })
            """)
            print("Idle requestAnimationFrame speed:", res)

            # Check active RAFs and intervals in window
            diag = await eval_js("""
                (() => {
                    return {
                        isIntroAnimating: window.state?.isIntroAnimating,
                        isOrbiting: window.state?.isOrbiting,
                        isIdleRotating: window.state?.isIdleRotating,
                        lowPerformanceMode: window.state?.lowPerformanceMode,
                        pixelRatio: window.devicePixelRatio,
                        mapCenter: window.map ? [window.map.getCenter().lng, window.map.getCenter().lat] : null,
                        mapPitch: window.map ? window.map.getPitch() : null,
                        mapBearing: window.map ? window.map.getBearing() : null,
                        activeLayersCount: window.map ? window.map.getStyle().layers.length : 0
                    };
                })()
            """)
            print("Diagnostic state:", diag)

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except Exception:
            proc.kill()

if __name__ == '__main__':
    asyncio.run(run_fps_test())
