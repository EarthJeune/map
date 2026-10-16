import json
import math
import re

with open('js/data/buildings.js', encoding='utf-8') as f:
    text = f.read()

# Find tissue_culture_building feature in LARES_DRAWINGS
start = text.find('"tissue_culture_building"')
if start != -1:
    coords_match = re.search(r'"coordinates":\s*(\[\s*\[\s*\[.*?\]\s*\]\s*\])', text[start:start+1200], re.DOTALL)
    if coords_match:
        coords_str = coords_match.group(1)
        coords = json.loads(coords_str)[0]
        print(f"Polygon has {len(coords)} points:")
        for pt in coords:
            print(" ", pt)
        
        # Calculate centroid
        poly_pts = coords[:-1] if coords[0] == coords[-1] else coords
        lngs = [p[0] for p in poly_pts]
        lats = [p[1] for p in poly_pts]
        c_lng = sum(lngs) / len(lngs)
        c_lat = sum(lats) / len(lats)
        print(f"\nCentroid: [{c_lng:.8f}, {c_lat:.8f}]")
        
        # Dimensions in meters (at lat ~13.958)
        m_per_lat = 111132.0
        m_per_lng = 111132.0 * math.cos(math.radians(c_lat))
        
        # Convert pts to local meters relative to centroid
        local_pts = [((p[0] - c_lng) * m_per_lng, (p[1] - c_lat) * m_per_lat) for p in coords]
        print("\nLocal points (meters from centroid East, North):")
        for i, (lx, ly) in enumerate(local_pts):
            print(f"  P{i}: ({lx:+.2f} m, {ly:+.2f} m)")
            
        # Segment lengths & bearings
        print("\nSegments:")
        for i in range(len(coords) - 1):
            p1 = local_pts[i]
            p2 = local_pts[i+1]
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            dist = math.hypot(dx, dy)
            bearing = (math.degrees(math.atan2(dx, dy)) + 360) % 360
            print(f"  Seg {i}->{i+1}: length = {dist:.2f} m, compass bearing = {bearing:.1f}°")

# Also check entrance points from roads.json
data = json.load(open('roads.json', encoding='utf-8'))
entrances = [f for f in data['features'] if f.get('properties', {}).get('buildingId') == 'tissue_culture_building']
print(f"\nEntrances in roads.json ({len(entrances)}):")
for e in entrances:
    ep = e['geometry']['coordinates']
    dx = (ep[0] - c_lng) * m_per_lng
    dy = (ep[1] - c_lat) * m_per_lat
    dist = math.hypot(dx, dy)
    bearing = (math.degrees(math.atan2(dx, dy)) + 360) % 360
    print(f"  {e['properties']['id']} ({e['properties']['name']}): [{ep[0]:.8f}, {ep[1]:.8f}]")
    print(f"    Vector from centroid: ({dx:+.2f} m, {dy:+.2f} m), dist = {dist:.2f} m, bearing = {bearing:.1f}°")

print("\nSurrounding Points within 40m in roads.json:")
for f in data['features']:
    props = f.get('properties', {})
    geom = f.get('geometry', {})
    if geom.get('type') == 'Point':
        pt = geom['coordinates']
        dist = math.hypot((pt[0]-c_lng)*m_per_lng, (pt[1]-c_lat)*m_per_lat)
        if dist < 40:
            print(f"  {props.get('id')}: {props.get('name') or props.get('type')} at {dist:.1f}m (coords: {pt})")

