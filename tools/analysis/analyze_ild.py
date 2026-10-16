import json
import math

with open('js/data/buildings.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
m = re.search(r'"id":\s*"ild_building".*?"coordinates":\s*(\[\[\[.*?\]\]\])', text, re.DOTALL)
poly = json.loads(m.group(1))[0]
m_lat = 110574.0
m_lon = 111320.0 * math.cos(math.radians(13.959))
print("Vertices:")
for i, p in enumerate(poly):
    print(f"  V{i}: {p}")

print("\nEdges:")
for i in range(len(poly)-1):
    dx = (poly[i+1][0] - poly[i][0]) * m_lon
    dy = (poly[i+1][1] - poly[i][1]) * m_lat
    l = math.hypot(dx, dy)
    b = (math.degrees(math.atan2(dx, dy)) + 360) % 360
    print(f"  Edge {i} (V{i}->V{i+1}): len={l:.2f}m, bearing={b:.1f} deg")

# Entrance node in roads.json:
ent = [121.16613265691541, 13.959236206863665]
print(f"\nEntrance: {ent}")
for i, p in enumerate(poly[:-1]):
    dist = math.hypot((ent[0]-p[0])*m_lon, (ent[1]-p[1])*m_lat)
    print(f"  Dist to V{i}: {dist:.2f}m")
