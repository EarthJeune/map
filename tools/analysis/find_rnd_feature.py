import json

with open('js/data/buildings.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

collecting = False
json_lines = []
for line in lines:
    if 'const LARES_DRAWINGS =' in line:
        collecting = True
        json_lines.append(line.split('=', 1)[1])
        continue
    if collecting:
        if 'export const KNOWN_BUILDING_NAMES' in line:
            break
        json_lines.append(line)

raw_json = "".join(json_lines).strip()
if raw_json.endswith(';'):
    raw_json = raw_json[:-1]

data = json.loads(raw_json)
print("Features count:", len(data['features']))

for feat in data['features']:
    props = feat.get('properties', {})
    geom = feat.get('geometry', {})
    coords = geom.get('coordinates', [[]])[0]
    if coords and isinstance(coords[0], list):
        cx = sum(p[0] for p in coords) / len(coords)
        cy = sum(p[1] for p in coords) / len(coords)
        dist = ((cx - 121.16690031)**2 + (cy - 13.95820001)**2)**0.5
        if dist < 0.0003:
            print(f"Feature id: {feat.get('id')}, properties: {props}, centroid: [{cx:.8f}, {cy:.8f}], dist: {dist*111320:.1f}m")
