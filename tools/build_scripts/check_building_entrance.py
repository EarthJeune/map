"""
check_building_entrance.py — Helper utility to verify 3D building entrance alignment against roads.json.
"""

import sys
import json
import math
import re

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ALIAS_MAP = {
    'mis_building': 'mis_rafis_building',
    'rafis_building': 'mis_rafis_building',
    'fod_building': 'lares_building',
    'bac_building': 'tanco_hall_building',
    'pmed_building': 'tanco_hall_building',
    'fmr': 'multi_purpose_administrative_building',
    'mis_data_center': 'multi_purpose_administrative_building',
    'vacant': 'multi_purpose_administrative_building'
}

def get_bearing(lon1, lat1, lon2, lat2):
    """Calculate compass bearing from (lon1, lat1) to (lon2, lat2) in degrees (0 = N, 90 = E, 180 = S, 270 = W)."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)
    
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    theta = math.atan2(y, x)
    bearing = (math.degrees(theta) + 360) % 360
    return bearing

def get_distance_meters(lon1, lat1, lon2, lat2):
    """Haversine distance in meters."""
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2.0)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def bearing_to_compass(bearing):
    points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
              "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = round(bearing / (360.0 / len(points))) % len(points)
    return points[idx]

def main():
    target_building = sys.argv[1] if len(sys.argv) > 1 else "pgrc_building"
    print(f"\n=======================================================")
    print(f" Checking Entrance Alignment for: '{target_building}'")
    print(f"=======================================================")
    
    # 1. Load roads.json
    with open('roads.json', 'r', encoding='utf-8') as f:
        road_data = json.load(f)
        
    entrances = []
    for feat in road_data.get('features', []):
        props = feat.get('properties', {})
        if props.get('type') == 'entrance':
            b_id = props.get('buildingId')
            canonical = ALIAS_MAP.get(b_id, b_id)
            if b_id == target_building or canonical == target_building:
                entrances.append((feat['geometry']['coordinates'], b_id))
                
    if not entrances:
        print(f"❌ No entrance nodes found in roads.json for '{target_building}'")
    else:
        print(f"✅ Found {len(entrances)} entrance node(s) in roads.json:")
        for coord, b_id in entrances:
            print(f"   - Building ID: '{b_id}', Coords: {coord}")

    # 2. Extract polygon from js/data/buildings.js
    with open('js/data/buildings.js', 'r', encoding='utf-8') as f:
        b_code = f.read()

    # Search for feature in LARES_DRAWINGS with "id": "<target_building>" in properties
    pattern = rf'properties":\s*\{{[^}}]*?"id":\s*"{re.escape(target_building)}".*?"coordinates":\s*(\[\[\[.*?\]\]\])'
    match = re.search(pattern, b_code, re.DOTALL)
    
    if not match:
        # Fallback search
        pattern = rf'"{re.escape(target_building)}".*?"coordinates":\s*(\[\[\[.*?\]\]\])'
        match = re.search(pattern, b_code, re.DOTALL)
    
    if match:
        coords_str = match.group(1).replace("'", '"')
        polygon = json.loads(coords_str)[0]
        # Polygon centroid
        lons = [p[0] for p in polygon[:-1]]
        lats = [p[1] for p in polygon[:-1]]
        centroid_lon = sum(lons) / len(lons)
        centroid_lat = sum(lats) / len(lats)
        print(f"\n📍 Polygon Centroid: [{centroid_lon:.8f}, {centroid_lat:.8f}]")
        
        # Dimensions approx
        min_lon, max_lon = min(lons), max(lons)
        min_lat, max_lat = min(lats), max(lats)
        width_m = get_distance_meters(min_lon, centroid_lat, max_lon, centroid_lat)
        depth_m = get_distance_meters(centroid_lon, min_lat, centroid_lon, max_lat)
        print(f"📏 Approximate Footprint: Width={width_m:.1f}m (East-West), Depth={depth_m:.1f}m (North-South)")
        
        # Check bearing to entrances
        for coord, b_id in entrances:
            ent_lon, ent_lat = coord[0], coord[1]
            bearing = get_bearing(centroid_lon, centroid_lat, ent_lon, ent_lat)
            dist = get_distance_meters(centroid_lon, centroid_lat, ent_lon, ent_lat)
            compass = bearing_to_compass(bearing)
            print(f"\n🧭 Vector from Centroid -> Entrance:")
            print(f"   Bearing: {bearing:.1f}° ({compass})")
            print(f"   Distance: {dist:.2f} meters")
            print(f"   Interpretation: Entrance is located to the {compass} of the building.")
            print(f"   🎯 Architectural Directive: Front facade/entrance of 3D model MUST face {bearing:.1f}° ({compass}).")
    else:
        print(f"⚠️ Could not automatically parse polygon for '{target_building}' in js/data/buildings.js")

if __name__ == '__main__':
    main()
