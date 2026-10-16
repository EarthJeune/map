import math

coords = [
    [121.167566420609, 13.958244403428],
    [121.16758561949331, 13.958200569684877],
    [121.16756706801857, 13.958193705822268],
    [121.16761723326891, 13.958069479065458],
    [121.16754433208325, 13.9580376819019],
    [121.167473649725, 13.958212193259],
]

centroid = [121.16755905, 13.95815967]
rot_deg = 69.8

# Convert lon, lat to local meters
# 1 deg lat ~ 111320 m
# 1 deg lon ~ 111320 * cos(lat) m
lat_ref = centroid[1]
m_per_lat = 111320.0
m_per_lon = 111320.0 * math.cos(math.radians(lat_ref))

local_pts = []
for lon, lat in coords:
    dx = (lon - centroid[0]) * m_per_lon
    dy = (lat - centroid[1]) * m_per_lat
    # rotate by -rot_deg to get building local space
    # In Mapbox, model-rotation: [0, 0, rot] rotates clockwise around +Z.
    # So world vector rotated by -rot gives model local vector:
    # [x_loc]   [ cos(rot)  sin(rot)] [dx]
    # [y_loc] = [-sin(rot)  cos(rot)] [dy]
    ang = math.radians(rot_deg)
    lx = dx * math.cos(ang) + dy * math.sin(ang)
    ly = -dx * math.sin(ang) + dy * math.cos(ang)
    local_pts.append((round(lx, 2), round(ly, 2)))

print("Building Local Footprint Vertices (Meters):")
for i, pt in enumerate(local_pts):
    print(f"Vertex {i}: X = {pt[0]:6.2f}, Y = {pt[1]:6.2f}")
