#!/usr/bin/env python3
"""
iGUIDE 1,000-Click Headless Browser "Rage-Click" & Chaos Simulator
Tests rapid button spamming on Mobile Map (?mode=phone) and Portal (/login) via Edge CDP.
Usage: python tools/ui_spam_stress.py
"""

import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import tempfile
import time
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
PORT = int(os.environ.get("STRESS_UI_PORT", "18101"))
CDP_PORT = int(os.environ.get("STRESS_CDP_PORT", "19241"))


class SimpleCDP:
    def __init__(self, ws_url):
        host_port, path = ws_url.replace("ws://", "").split("/", 1)
        host, port = host_port.split(":")
        self.sock = socket.create_connection((host, int(port)), timeout=25)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f"GET /{path} HTTP/1.1\r\nHost: {host_port}\r\n"
            f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.sock.recv(4096)
        self.extra = buf.split(b"\r\n\r\n", 1)[1]
        self.msg_id = 0
        self.exceptions = []
        self.console_errors = []

    def _recv_exact(self, n):
        out = bytearray()
        if self.extra:
            take = self.extra[:n]
            out.extend(take)
            self.extra = self.extra[n:]
        while len(out) < n:
            chunk = self.sock.recv(n - len(out))
            if not chunk:
                raise EOFError("WS closed")
            out.extend(chunk)
        return bytes(out)

    def _recv_frame(self):
        while True:
            b1, b2 = self._recv_exact(2)
            op = b1 & 0x0F
            ln = b2 & 0x7F
            if ln == 126:
                ln = struct.unpack("!H", self._recv_exact(2))[0]
            elif ln == 127:
                ln = struct.unpack("!Q", self._recv_exact(8))[0]
            if b2 & 0x80:
                m = self._recv_exact(4)
                data = bytes(b ^ m[i % 4] for i, b in enumerate(self._recv_exact(ln)))
            else:
                data = self._recv_exact(ln)
            if op == 0x8:
                raise EOFError("WS closed")
            if op == 0x9:
                self._send_raw(0xA, data)
                continue
            return data.decode("utf-8", "replace")

    def _send_raw(self, op, data):
        m = os.urandom(4)
        ln = len(data)
        hdr = bytearray([0x80 | op])
        if ln < 126:
            hdr.append(0x80 | ln)
        elif ln < 65536:
            hdr.append(0x80 | 126)
            hdr.extend(struct.pack("!H", ln))
        else:
            hdr.append(0x80 | 127)
            hdr.extend(struct.pack("!Q", ln))
        hdr.extend(m)
        self.sock.sendall(bytes(hdr) + bytes(b ^ m[i % 4] for i, b in enumerate(data)))

    def call(self, method, params=None):
        self.msg_id += 1
        mid = self.msg_id
        self._send_raw(0x1, json.dumps({"id": mid, "method": method, "params": params or {}}).encode())
        while True:
            msg = json.loads(self._recv_frame())
            if msg.get("id") == mid:
                if "error" in msg:
                    raise RuntimeError(str(msg["error"]))
                return msg.get("result", {})
            elif "method" in msg:
                m = msg["method"]
                p = msg.get("params", {})
                if m == "Runtime.exceptionThrown":
                    self.exceptions.append(str(p))
                elif m == "Log.entryAdded" and p.get("entry", {}).get("level") == "error":
                    txt = p["entry"].get("text", "")
                    if "favicon" not in txt.lower():
                        self.console_errors.append(txt)

    def eval(self, expr):
        r = self.call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
        if "exceptionDetails" in r:
            raise RuntimeError(str(r["exceptionDetails"]))
        return r.get("result", {}).get("value")

    def close(self):
        try:
            self.sock.close()
        except Exception:
            pass


def main():
    env = {**os.environ, "PORT": str(PORT), "NO_TUNNEL": "1", "SMTP_USER": "", "SMTP_APP_PASSWORD": ""}
    srv = subprocess.Popen(["node", os.path.join(ROOT, "server.js"), "--no-tunnel"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    profile = tempfile.mkdtemp(prefix="iguide_ui_spam_")
    edge = None
    cdp = None

    try:
        for _ in range(30):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/version", timeout=2) as r:
                    if r.status == 200:
                        break
            except Exception:
                time.sleep(0.25)

        edge = subprocess.Popen([
            EDGE, "--headless=new", "--disable-gpu", "--disable-extensions",
            f"--remote-debugging-port={CDP_PORT}", f"--user-data-dir={profile}",
            "--no-first-run", "--no-default-browser-check", "about:blank"
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        ws_url = None
        for _ in range(30):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{CDP_PORT}/json/list", timeout=2) as r:
                    for pg in json.loads(r.read().decode()):
                        if pg.get("type") == "page":
                            ws_url = pg["webSocketDebuggerUrl"]
                            break
                    if ws_url:
                        break
            except Exception:
                time.sleep(0.25)
        if not ws_url:
            raise RuntimeError("Edge CDP target unavailable")

        cdp = SimpleCDP(ws_url)
        cdp.call("Page.enable")
        cdp.call("Runtime.enable")
        cdp.call("Log.enable")
        cdp.call("Performance.enable")
        cdp.call("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 2, "mobile": True})

        cdp.call("Page.navigate", {"url": f"http://127.0.0.1:{PORT}/?mode=phone&station=lares"})
        for _ in range(45):
            if cdp.eval("Boolean(window.map && window.map.isStyleLoaded && window.map.isStyleLoaded() && document.querySelectorAll('#phone-directory-list .phone-dir-item').length >= 10)"):
                break
            time.sleep(0.4)

        cdp.eval("if(typeof revealMap==='function') revealMap(); if(typeof closeDashWelcomeModal==='function') closeDashWelcomeModal(); const m=document.getElementById('dash-welcome-modal'); if(m) m.style.display='none'; if(typeof setPhoneSheetSnap==='function') setPhoneSheetSnap('half');")
        time.sleep(0.4)

        # 1,000+ rapid mobile clicks in browser
        spam_stats = cdp.eval(r"""
        (async () => {
            const metricsBefore = performance.memory ? performance.memory.usedJSHeapSize : 0;
            let totalClicks = 0;

            // 1. 200x Filter toggle clicks
            const filterBtn = document.getElementById('phone-filter-btn');
            for (let i = 0; i < 200; i++) {
                filterBtn?.click();
                totalClicks++;
            }
            if (typeof closePhoneFilterDropdown === 'function') closePhoneFilterDropdown();

            // 2. 200x Station switcher + close rapid clicks
            const stPill = document.getElementById('phone-station-pill');
            for (let i = 0; i < 100; i++) {
                stPill?.click();
                totalClicks++;
                document.querySelector('.phone-station-modal-close')?.click();
                totalClicks++;
            }

            // 3. 200x Rapid directory card selection clicks (switching buildings repeatedly)
            const items = Array.from(document.querySelectorAll('#phone-directory-list .phone-dir-item')).slice(0, 6);
            for (let i = 0; i < 200; i++) {
                items[i % items.length]?.click();
                totalClicks++;
            }

            // 4. 400x Navigation Route / Speed / Replay / Cancel rapid-tap storm
            const routeBtn = document.getElementById('phone-route-btn');
            const repeatBtn = document.getElementById('phone-repeat-btn');
            const cancelBtn = document.getElementById('phone-cancel-btn');
            const speedPills = Array.from(document.querySelectorAll('.phone-speed-pills .speed-pill'));
            for (let i = 0; i < 100; i++) {
                routeBtn?.click();
                speedPills[i % speedPills.length]?.click();
                repeatBtn?.click();
                cancelBtn?.click();
                totalClicks += 4;
                if (i % 20 === 0) items[0]?.click();
            }
            if (typeof cancelPhoneRoute === 'function') cancelPhoneRoute();

            await new Promise(r => setTimeout(r, 400));
            const metricsAfter = performance.memory ? performance.memory.usedJSHeapSize : 0;
            return {
                totalClicks,
                horizOverflow: document.documentElement.scrollWidth - window.innerWidth,
                gpsActiveAfterCancel: Boolean(window.state?.isMobileGPSActive),
                gpsWatchId: window.state?.gpsWatchId ?? null,
                heapBeforeMb: Number((metricsBefore / 1048576).toFixed(2)),
                heapAfterMb: Number((metricsAfter / 1048576).toFixed(2))
            };
        })()
        """)

        mobile_console_errors = list(cdp.console_errors)

        # Also test /login rapid Sign-In click spam (200x)
        cdp.call("Page.navigate", {"url": f"http://127.0.0.1:{PORT}/login"})
        time.sleep(1.5)
        login_spam = cdp.eval(r"""
        (() => {
            const btn = document.getElementById('login-submit-btn');
            const u = document.getElementById('login-user');
            const p = document.getElementById('login-pass');
            const splash = document.getElementById('admin-splash-screen');
            if (splash) splash.click();
            if (u) u.value = 'nonexistent_chaos@example.com';
            if (p) p.value = 'WrongPass!2026';
            let clicks = 0;
            for (let i = 0; i < 200; i++) {
                btn?.click();
                clicks++;
            }
            return { loginClicks: clicks, btnDisabledOrBusy: Boolean(btn?.disabled || btn?.dataset?.busy === '1') };
        })()
        """)
        time.sleep(0.8)

        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/version", timeout=3) as r:
            server_status = r.status

        failures = []
        if cdp.exceptions:
            failures.append(f"JS exceptions: {cdp.exceptions}")
        if mobile_console_errors:
            failures.append(f"Mobile console errors: {mobile_console_errors}")
        if spam_stats["horizOverflow"] != 0:
            failures.append(f"Horizontal overflow: {spam_stats['horizOverflow']}")
        if spam_stats["gpsWatchId"] is not None:
            failures.append(f"Leaked GPS watchId: {spam_stats['gpsWatchId']}")
        if server_status != 200:
            failures.append(f"Server status after chaos: {server_status}")

        out = {
            "passed": len(failures) == 0,
            "failures": failures,
            "mobileChaos": spam_stats,
            "portalChaos": login_spam,
            "serverStatus": server_status
        }
        print(json.dumps(out, indent=2))
        if failures:
            raise SystemExit(1)
    finally:
        if cdp:
            cdp.close()
        if edge:
            edge.terminate()
        srv.terminate()
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    main()
