import os
import sys
import json
import time
import urllib.request
import glob

def run_audit():
    print("============================================================")
    print("      DA-LARES / DASH SYSTEM OPTIMIZATION & HEALTH AUDIT    ")
    print("============================================================\n")
    
    # 1. Endpoint Testing
    print("--- 1. CRITICAL SERVER ENDPOINTS LATENCY & STATUS ---")
    endpoints = [
        "http://localhost:8080/index.html",
        "http://localhost:8080/buildings.json",
        "http://localhost:8080/roads.json",
        "http://localhost:8080/trees.json",
        "http://localhost:8080/qares_buildings.json",
        "http://localhost:8080/qares_roads.json",
        "http://localhost:8080/js/app.js",
        "http://localhost:8080/css/main.css",
        "http://localhost:8080/Main%20Icon/DASH_Logo_animated.svg",
        "http://localhost:8080/api/tiles/18/223788/117972.png"
    ]
    all_ep_ok = True
    for ep in endpoints:
        t0 = time.time()
        try:
            req = urllib.request.Request(ep, method="HEAD")
            with urllib.request.urlopen(req, timeout=3) as resp:
                elapsed = int((time.time() - t0) * 1000)
                status = resp.status
                size = resp.headers.get("Content-Length", "?")
                print(f"  [PASS] {status} ({elapsed:3d}ms) {ep.split('/')[-1]} [size: {size} B]")
        except Exception as e:
            all_ep_ok = False
            print(f"  [FAIL] {ep}: {e}")

    # 2. 3D GLB Models Performance Budget (< 300 KB)
    print("\n--- 2. 3D GLB MODEL SIZE AUDIT (BUDGET: < 300 KB) ---")
    model_files = sorted(glob.glob("models/*.glb"))
    over_budget = []
    total_model_size = 0
    for mf in model_files:
        sz = os.path.getsize(mf)
        total_model_size += sz
        sz_kb = sz / 1024.0
        status = "PASS" if sz_kb <= 300.0 else "OVER BUDGET"
        if status != "PASS":
            over_budget.append((mf, sz_kb))
        print(f"  [{status:4s}] {os.path.basename(mf):40s} : {sz_kb:6.1f} KB")
    
    print(f"\n  Total GLB Models: {len(model_files)}")
    print(f"  Total Asset Footprint: {total_model_size / (1024*1024):.2f} MB")
    if not over_budget:
        print("  All GLB models strictly comply with Rule 2 (< 300 KB)!")
    else:
        print(f"  WARNING: {len(over_budget)} models exceed 300 KB: {over_budget}")

    # 3. GeoJSON Integrity & Validity
    print("\n--- 3. GEOJSON INTEGRITY & ENTITY COUNTS ---")
    geo_files = ["buildings.json", "roads.json", "trees.json", "qares_buildings.json", "qares_roads.json"]
    for gf in geo_files:
        if os.path.exists(gf):
            try:
                with open(gf, "r", encoding="utf-8") as f:
                    data = json.load(f)
                features = data.get("features", [])
                print(f"  [VALID] {gf:22s} : {len(features):4d} features | {os.path.getsize(gf)/1024:.1f} KB")
            except Exception as e:
                print(f"  [INVALID] {gf}: {e}")
        else:
            print(f"  [MISSING] {gf}")

    # 4. JavaScript Modules Audit
    print("\n--- 4. JAVASCRIPT MODULES & CODEBASE FOOTPRINT ---")
    js_files = sorted(glob.glob("js/**/*.js", recursive=True))
    total_js_lines = 0
    total_js_bytes = 0
    for jf in js_files:
        sz = os.path.getsize(jf)
        total_js_bytes += sz
        with open(jf, "r", encoding="utf-8", errors="ignore") as f:
            lines = len(f.readlines())
        total_js_lines += lines
    print(f"  Total ES Modules : {len(js_files)} files")
    print(f"  Total JS Lines   : {total_js_lines:,} lines")
    print(f"  Total JS Size    : {total_js_bytes/1024:.1f} KB (Unminified)")

    # 5. CSS Audit
    print("\n--- 5. CSS DESIGN SYSTEM & STYLES AUDIT ---")
    css_file = "css/main.css"
    if os.path.exists(css_file):
        sz = os.path.getsize(css_file)
        with open(css_file, "r", encoding="utf-8", errors="ignore") as f:
            lines = len(f.readlines())
        print(f"  {css_file} : {lines:,} lines | {sz/1024:.1f} KB")

    print("\n============================================================")
    print("                     AUDIT COMPLETE                         ")
    print("============================================================")

if __name__ == "__main__":
    run_audit()
