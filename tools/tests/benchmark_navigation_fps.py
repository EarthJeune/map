import asyncio
import json
import os
import subprocess
import urllib.request
import websockets

async def run_benchmark():
    port = 9247
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

            # Dismiss welcome modal
            await eval_js("document.getElementById('dash-welcome-modal')?.remove();")
            await asyncio.sleep(0.5)

            # Start FPS sampler
            await eval_js("""
                (() => {
                    window._fpsSamples = [];
                    window._lastFrameTime = performance.now();
                    window._fpsSamplerActive = true;
                    function sampleFrame() {
                        if (!window._fpsSamplerActive) return;
                        const now = performance.now();
                        const dt = now - window._lastFrameTime;
                        window._lastFrameTime = now;
                        if (dt > 0) window._fpsSamples.push(dt);
                        requestAnimationFrame(sampleFrame);
                    }
                    requestAnimationFrame(sampleFrame);
                })()
            """)

            # Navigate to ORED building at 2x speed (exact user scenario)
            print("Starting navigation to ORED building at 2x speed...")
            await eval_js("""
                (() => {
                    if (window.navigateTo) {
                        window.navigateTo('ored_building');
                    }
                    if (window.setRouteSpeed) {
                        window.setRouteSpeed(2);
                    }
                })()
            """)

            # Let it walk for 6 seconds while sampling frame times
            await asyncio.sleep(6.0)

            # Retrieve frame statistics
            stats = await eval_js("""
                (() => {
                    window._fpsSamplerActive = false;
                    const samples = window._fpsSamples.slice(20); // discard initial spike
                    if (samples.length === 0) return null;
                    const fpsValues = samples.map(dt => 1000 / dt);
                    fpsValues.sort((a,b) => a - b);
                    const avgFps = fpsValues.reduce((a,b) => a + b, 0) / fpsValues.length;
                    const minFps = fpsValues[0];
                    const p1Fps = fpsValues[Math.floor(fpsValues.length * 0.01)] || minFps;
                    const p5Fps = fpsValues[Math.floor(fpsValues.length * 0.05)] || minFps;
                    const p50Fps = fpsValues[Math.floor(fpsValues.length * 0.50)] || avgFps;
                    const longFrames = samples.filter(dt => dt > 33.3).length;
                    const veryLongFrames = samples.filter(dt => dt > 66.6).length;
                    return {
                        totalFrames: samples.length,
                        avgFps: Math.round(avgFps * 10) / 10,
                        p50Fps: Math.round(p50Fps * 10) / 10,
                        p5Fps: Math.round(p5Fps * 10) / 10,
                        p1Fps: Math.round(p1Fps * 10) / 10,
                        minFps: Math.round(minFps * 10) / 10,
                        longFramesCount: longFrames,
                        veryLongFramesCount: veryLongFrames,
                        longFramePct: Math.round((longFrames / samples.length) * 1000) / 10
                    };
                })()
            """)

            print("\n=== BASELINE NAVIGATION PERFORMANCE BENCHMARK ===")
            print(json.dumps(stats, indent=2))

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except Exception:
            proc.kill()

if __name__ == '__main__':
    asyncio.run(run_benchmark())
