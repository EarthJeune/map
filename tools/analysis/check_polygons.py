import re
import json
import math

with open('js/data/buildings.js', 'r', encoding='utf-8') as f:
    content = f.read()

# find LARES_DRAWINGS
start = content.find('const LARES_DRAWINGS =')
brace_start = content.find('{', start)
# find end of geojson
# Let's extract features
match_ored = re.search(r'\{\s*"id":\s*"[^"]*",\s*"type":\s*"Feature",\s*"properties":\s*\{[^}]*"id":\s*"ored_building"[^}]*\},\s*"geometry":\s*(\{[^}]+\})', content, re.DOTALL)
match_admin = re.search(r'\{\s*"id":\s*"[^"]*",\s*"type":\s*"Feature",\s*"properties":\s*\{[^}]*"id":\s*"admin_building"[^}]*\},\s*"geometry":\s*(\{[^}]+\})', content, re.DOTALL)

def analyze(geom_str, name):
    geom = json.loads(geom_str)
    ring = geom['coordinates'][0]
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)
    # convert to meters relative to cx, cy
    # 1 deg lat = 111320 m, 1 deg lon = 111320 * cos(lat) m
    lat_scale = 111320.0
    lon_scale = 111320.0 * math.cos(math.radians(cy))
    pts_m = [((p[0] - cx) * lon_scale, (p[1] - cy) * lat_scale) for p in ring]
    min_x = min(p[0] for p in pts_m)
    max_x = max(p[0] for p in pts_m)
    min_y = min(p[1] for p in pts_m)
    max_y = max(p[1] for p in pts_m)
    print(f"=== {name} ===")
    print(f"Centroid: [{cx:.8f}, {cy:.8f}]")
    print(f"Width (E-W): {max_x - min_x:.2f} m, Depth (N-S): {max_y - min_y:.2f} m")
    print(f"Points (lon, lat): {ring}")
    return cx, cy, pts_m

if match_ored:
    c_ored = analyze(match_ored.group(1), "ORED")
if match_admin:
    c_admin = analyze(match_admin.group(1), "ADMIN")

# Check relative position in meters
lat_scale = 111320.0
lon_scale = 111320.0 * math.cos(math.radians(c_ored[1]))
dx = (c_admin[0] - c_ored[0]) * lon_scale
dy = (c_admin[1] - c_ored[1]) * lat_scale
print(f"Distance from ORED center to ADMIN center: dx={dx:.2f} m (East), dy={dy:.2f} m (North), total={math.hypot(dx, dy):.2f} m")
