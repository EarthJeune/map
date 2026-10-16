import re
import json

with open('js/data/buildings.js', 'r', encoding='utf-8') as f:
    text = f.read()

for b_id in ['f2c2_building', 'seaguard_building', 'ild_building', 'lares_building']:
    m = re.search(rf'"id":\s*"{b_id}".*?"coordinates":\s*(\[\[\[.*?\]\]\])', text, re.DOTALL)
    if m:
        poly = json.loads(m.group(1))[0]
        lons = [p[0] for p in poly]
        lats = [p[1] for p in poly]
        print(f"{b_id:20s}: lon [{min(lons):.8f}, {max(lons):.8f}], lat [{min(lats):.8f}, {max(lats):.8f}]")
        print(f"  Centroid: [{(min(lons)+max(lons))/2:.8f}, {(min(lats)+max(lats))/2:.8f}]")
