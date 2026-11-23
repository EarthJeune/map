import asyncio
import json
import subprocess
import urllib.request
import websockets
import base64

EDGE_PATH = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9298

async def run():
    p = subprocess.Popen([
        EDGE_PATH,
        '--headless=new',
        f'--remote-debugging-port={PORT}',
        '--window-size=1280,900',
        '--disable-gpu',
        '--no-sandbox',
        '--force-device-scale-factor=1',
        'http://localhost:8080/'
    ])
    try:
        await asyncio.sleep(2.5)
        tabs = json.loads(urllib.request.urlopen(f'http://localhost:{PORT}/json').read())
        t = next(x for x in tabs if 'localhost:8080' in x.get('url',''))
        async with websockets.connect(t['webSocketDebuggerUrl']) as ws:
            mid = 0
            async def ev(expr):
                nonlocal mid; mid += 1
                await ws.send(json.dumps({'id': mid, 'method': 'Runtime.evaluate', 'params': {'expression': expr, 'returnByValue': True}}))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get('id') == mid: return m.get('result',{}).get('result',{}).get('value')

            async def screenshot(filename):
                nonlocal mid; mid += 1
                await ws.send(json.dumps({'id': mid, 'method': 'Page.captureScreenshot', 'params': {'format': 'jpeg', 'quality': 85}}))
                while True:
                    m = json.loads(await ws.recv())
                    if m.get('id') == mid:
                        data = base64.b64decode(m['result']['data'])
                        with open(filename, 'wb') as f:
                            f.write(data)
                        print(f"Saved screenshot: {filename} ({len(data)} bytes)")
                        return

            await asyncio.sleep(2.0)

            # 1. Check Step 1
            s1 = await ev("""
            ({
                welcomeVisible: document.getElementById('dash-welcome-modal').style.display !== 'none',
                stepIntroVisible: document.getElementById('dash-welcome-step-intro').style.display !== 'none',
                stepStationsVisible: document.getElementById('dash-welcome-step-stations').style.display !== 'none'
            })
            """)
            print("1. Initial Step 1:", json.dumps(s1))

            # 2. Click Proceed to Step 2
            await ev("goToWelcomeStep('stations');")
            await asyncio.sleep(0.5)

            s2 = await ev("""
            ({
                stepStationsVisible: document.getElementById('dash-welcome-step-stations').style.display !== 'none',
                btnText: document.getElementById('dash-proceed-btn').querySelector('span:first-child').textContent.trim(),
                activeCard: document.querySelector('.dash-welcome-station-card.active')?.dataset.station,
                devModalVisible: document.getElementById('station-dev-modal')?.style.display !== 'none'
            })
            """)
            print("2. In Step 2 (Stations):", json.dumps(s2))
            assert s2['btnText'] == 'Explore Campus', f"Expected 'Explore Campus', got {s2['btnText']}"

            # 3. Select DA-QARES card
            print("3. Clicking DA-QARES card...")
            await ev("selectWelcomeStation('qares');")
            await asyncio.sleep(0.5)

            s3 = await ev("""
            ({
                activeCard: document.querySelector('.dash-welcome-station-card.active')?.dataset.station,
                devModalVisible: document.getElementById('station-dev-modal')?.style.display !== 'none',
                welcomeModalVisible: document.getElementById('dash-welcome-modal')?.style.display !== 'none',
                btnText: document.getElementById('dash-proceed-btn').querySelector('span:first-child').textContent.trim()
            })
            """)
            print("3. After selecting QARES:", json.dumps(s3))
            assert s3['activeCard'] == 'qares', "QARES card should be active"
            assert s3['devModalVisible'] is False, "Dev modal (Picture 2) must NOT pop up when selecting a card"
            assert s3['welcomeModalVisible'] is True, "Welcome modal must remain open"
            assert s3['btnText'] == 'Explore Campus', f"Button text must stay 'Explore Campus', got {s3['btnText']}"
            await screenshot("welcome_step2_qares_selected.jpg")

            # 4. Select DA-RARES card
            print("4. Clicking DA-RARES card...")
            await ev("selectWelcomeStation('rares');")
            await asyncio.sleep(0.5)
            s4 = await ev("""
            ({
                activeCard: document.querySelector('.dash-welcome-station-card.active')?.dataset.station,
                devModalVisible: document.getElementById('station-dev-modal')?.style.display !== 'none',
                welcomeModalVisible: document.getElementById('dash-welcome-modal')?.style.display !== 'none'
            })
            """)
            print("4. After selecting RARES:", json.dumps(s4))
            assert s4['activeCard'] == 'rares'
            assert s4['devModalVisible'] is False

            # 5. Select QARES again and click "Explore Campus"
            print("5. Selecting QARES and clicking Explore Campus button...")
            await ev("selectWelcomeStation('qares');")
            await asyncio.sleep(0.3)
            await ev("handleWelcomeProceed();")
            await asyncio.sleep(0.6)

            s5 = await ev("""
            ({
                welcomeModalVisible: document.getElementById('dash-welcome-modal')?.style.display !== 'none',
                devModalVisible: document.getElementById('station-dev-modal')?.style.display !== 'none',
                devModalTitle: document.getElementById('station-dev-title')?.textContent.trim()
            })
            """)
            print("5. After clicking Explore Campus on QARES:", json.dumps(s5))
            assert s5['devModalVisible'] is True, "Dev modal (Picture 2) MUST pop up when clicking Explore Campus on QARES"
            print("DEV MODAL POPPED UP AS EXPECTED:", s5['devModalTitle'])
            await screenshot("welcome_step3_dev_modal_popped_up.jpg")

            # 6. Click Continue on DA-LARES Map
            print("6. Clicking Continue on DA-LARES Map in Dev modal...")
            await ev("closeStationDevModal();")
            await asyncio.sleep(0.5)
            s6 = await ev("""
            ({
                devModalVisible: document.getElementById('station-dev-modal')?.style.display !== 'none',
                currentStationId: state.currentStationId
            })
            """)
            print("6. After closing Dev modal:", json.dumps(s6))
            assert s6['devModalVisible'] is False
            assert s6['currentStationId'] == 'lares'

            print("\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<")
    finally:
        p.terminate()

asyncio.run(run())

