import json
import math

# Coordinates from ORED feature
coords = [
    [121.16609240883548, 13.958807099193109],
    [121.1660758849967,  13.958806787707687],
    [121.16607857900766, 13.958742749084891],
    [121.16609517490525, 13.958742148231039],
    [121.16609675197009, 13.958692250865056],
    [121.16629161959395, 13.958692104292254],
    [121.16628829357154, 13.958862513653244],
    [121.1660915937573,  13.958862343852445]
]

# Roads entrance node for ored_building:
with open('roads.json', 'r', encoding='utf-8') as f:
    roads = json.load(f)

ored_ent = None
for f in roads['features']:
    props = f.get('properties', {})
    if props.get('type') == 'entrance' and props.get('buildingId') == 'ored_building':
        ored_ent = f['geometry']['coordinates']
        break

# Centroid of main rectangle (excluding portico tab or polygon centroid)
# Main rectangle:
# West: 121.166094, East: 121.166290
# South: 13.958692, North: 13.958862
main_center_lon = (121.166094 + 121.166290) / 2.0
main_center_lat = (13.958692 + 13.958862) / 2.0

# Overall polygon centroid
poly_center_lon = sum(p[0] for p in coords) / len(coords)
poly_center_lat = sum(p[1] for p in coords) / len(coords)

def haversine(lon1, lat1, lon2, lat2):
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2.0)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2.0)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def bearing(lon1, lat1, lon2, lat2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlam = math.radians(lon2 - lon1)
    y = math.sin(dlam) * math.cos(phi2)
    x = math.cos(phi1)*math.sin(phi2) - math.sin(phi1)*math.cos(phi2)*math.cos(dlam)
    return (math.degrees(math.atan2(y, x)) + 360) % 360

width_ew = haversine(121.166094, main_center_lat, 121.166290, main_center_lat)
depth_ns = haversine(main_center_lon, 13.958692, main_center_lon, 13.958862)

print(f"Main Rect Centroid: [{main_center_lon:.8f}, {main_center_lat:.8f}]")
print(f"Polygon Centroid:   [{poly_center_lon:.8f}, {poly_center_lat:.8f}]")
print(f"Dimensions: Width (East-West) = {width_ew:.2f} m, Depth (North-South) = {depth_ns:.2f} m")

if ored_ent:
    print(f"Entrance node: {ored_ent}")
    b_from_main = bearing(main_center_lon, main_center_lat, ored_ent[0], ored_ent[1])
    d_from_main = haversine(main_center_lon, main_center_lat, ored_ent[0], ored_ent[1])
    print(f"Bearing from Main Centroid to Entrance: {b_from_main:.2f} deg, Dist: {d_from_main:.2f} m")
