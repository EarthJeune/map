import json, math

with open('buildings.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

rsbsa = None
for feat in data['features']:
    if feat.get('properties', {}).get('id') == 'rsbsa_building':
        rsbsa = feat
        break

coords = rsbsa['geometry']['coordinates'][0]
print(f'Total vertices in polygon (including closing): {len(coords)}')

# Compute centroid
# Simple average of unique vertices
unique_pts = coords[:-1]
avg_lng = sum(p[0] for p in unique_pts) / len(unique_pts)
avg_lat = sum(p[1] for p in unique_pts) / len(unique_pts)
print(f'Centroid: [{avg_lng:.8f}, {avg_lat:.8f}]')

# Convert to meters relative to centroid
# At lat ~13.9585:
# 1 deg lat = 110574 m
# 1 deg lng = 111320 * cos(lat) m
lat_mid = avg_lat
m_per_deg_lat = 111000.0 # roughly
m_per_deg_lng = 111320.0 * math.cos(math.radians(lat_mid))

print(f'Meters per deg: lng={m_per_deg_lng:.2f}, lat={m_per_deg_lat:.2f}')

local_pts_unrotated = []
for i, (lng, lat) in enumerate(unique_pts):
    dx = (lng - avg_lng) * m_per_deg_lng
    dy = (lat - avg_lat) * m_per_deg_lat
    local_pts_unrotated.append((dx, dy))
    print(f'V{i:2d}: lng={lng:.8f}, lat={lat:.8f} -> dx={dx:+6.2f}m, dy={dy:+6.2f}m')

# Check roads.json entrance coordinate
with open('roads.json', 'r', encoding='utf-8') as f:
    roads = json.load(f)

entrance_pt = None
for feat in roads['features']:
    props = feat.get('properties', {})
    if props.get('type') == 'entrance' and props.get('buildingId') == 'rsbsa_building':
        entrance_pt = feat['geometry']['coordinates']
        print(f'Entrance in roads.json: {entrance_pt}')
        edx = (entrance_pt[0] - avg_lng) * m_per_deg_lng
        edy = (entrance_pt[1] - avg_lat) * m_per_deg_lat
        print(f'Entrance relative to centroid: edx={edx:+6.2f}m, edy={edy:+6.2f}m')
        bearing = (math.degrees(math.atan2(edx, edy)) + 360) % 360
        print(f'Entrance bearing from centroid: {bearing:.1f}°')
