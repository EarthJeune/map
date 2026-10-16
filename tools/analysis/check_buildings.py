import json
import re
import math

with open('js/data/buildings.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's find all features
features = re.findall(r'\{\s*"type":\s*"Feature",\s*"id":\s*"([^"]+)",.*?geometry":\s*\{\s*"type":\s*"Polygon",\s*"coordinates":\s*(\[\[\[.*?\]\]\])', content, re.DOTALL)

for b_id, coords_str in features:
    if 'ored' in b_id.lower() or 'admin' in b_id.lower():
        coords = json.loads(coords_str)[0]
        lons = [p[0] for p in coords]
        lats = [p[1] for p in coords]
        cx = sum(lons) / len(lons)
        cy = sum(lats) / len(lats)
        print(f"Building: {b_id}")
        print(f"  Centroid: [{cx:.8f}, {cy:.8f}]")
        print(f"  Min Lon: {min(lons):.8f}, Max Lon: {max(lons):.8f}")
        print(f"  Min Lat: {min(lats):.8f}, Max Lat: {max(lats):.8f}")
        # Dimensions in meters approx
        # 1 deg lat ~ 111,000m, 1 deg lon ~ 111,000 * cos(13.96 deg) ~ 107,700m
        width_m = (max(lons) - min(lons)) * 107700
        height_m = (max(lats) - min(lats)) * 111000
        print(f"  Approx Footprint Bounding Box Size: {width_m:.1f}m (E-W) x {height_m:.1f}m (N-S)")
        print(f"  Coordinates: {coords}")
        print()
