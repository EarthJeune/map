import json

with open('roads.json', 'r') as f:
    roads = json.load(f)

print('=== POINTS NEAR ORED/ADMIN ===')
for f in roads['features']:
    props = f.get('properties', {})
    geom = f.get('geometry', {})
    if geom.get('type') == 'Point':
        lon, lat = geom.get('coordinates', [0, 0])
        if 121.1658 <= lon <= 121.1666 and 13.9585 <= lat <= 13.9592:
            print(f"Point {props.get('type')}: {props.get('name')} | bId: {props.get('buildingId')} | coords: [{lon:.8f}, {lat:.8f}]")

print('\n=== LINES NEAR ORED/ADMIN ===')
for f in roads['features']:
    props = f.get('properties', {})
    geom = f.get('geometry', {})
    if geom.get('type') == 'LineString':
        coords = geom.get('coordinates', [])
        if any(121.1658 <= p[0] <= 121.1666 and 13.9585 <= p[1] <= 13.9592 for p in coords):
            print(f"Line: {props.get('highway', props.get('name', 'road'))} | points: {len(coords)}")
            for c in coords:
                print(f"   [{c[0]:.8f}, {c[1]:.8f}]")
