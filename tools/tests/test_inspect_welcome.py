import asyncio
import json
import os
import subprocess
import urllib.request
import websockets

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9255

async def main():
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
        target = next((t for t in tabs if t.get('type') == 'page' and 'localhost:8080' in t.get('url', '')), None)
        if not target:
            target = next(t for t in tabs if t.get('type') == 'page')
        print(f"Target tab: {target['url']}")

        async with websockets.connect(target['webSocketDebuggerUrl']) as ws:
            async def eval_js(expr):
                await ws.send(json.dumps({'id': 10, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    msg = json.loads(await ws.recv())
                    if msg.get('id') == 10:
                        res = msg.get('result', {})
                        if 'exceptionDetails' in res:
                            print("JS Exception:", res['exceptionDetails'])
                        return res.get('result', {}).get('value')

            # Wait 2 seconds for app init
            await asyncio.sleep(2.0)
            url = await eval_js('window.location.href')
            print("Page URL:", url)
            modal_exists = await eval_js('Boolean(document.getElementById("dash-welcome-modal"))')
            print("Modal element exists in DOM:", modal_exists)
            modal_disp = await eval_js('document.getElementById("dash-welcome-modal") ? document.getElementById("dash-welcome-modal").style.display : null')
            print("Modal style.display:", modal_disp)
            cards_count = await eval_js('document.querySelectorAll(".dash-welcome-station-card").length')
            print("Cards count:", cards_count)
            card_names = await eval_js('Array.from(document.querySelectorAll(".dash-welcome-station-card")).map(c => c.dataset.station)')
            print("Card station IDs:", card_names)

    finally:
        proc.kill()

if __name__ == '__main__':
    asyncio.run(main())

