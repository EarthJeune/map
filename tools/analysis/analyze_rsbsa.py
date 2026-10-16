import math

# Coordinates from buildings.js
poly = [
    [121.16712863149047, 13.958602976415904],
    [121.16709427668661, 13.958605255659563],
    [121.16708544869255, 13.958457596038713],
    [121.16723389844793, 13.958448478893047],
    [121.16724616804947, 13.95862664463047],
    [121.16716772280569, 13.958633729723985],
    [121.1671677093882,  13.9586194022162],
    [121.16712949973015, 13.958621326987853],
    [121.16712863149047, 13.958602976415904]
]

# Entrance node
ent = [121.16711790628972, 13.958452956115806]

# Centroid calculation
lons = [p[0] for p in poly[:-1]]
lats = [p[1] for p in poly[:-1]]
c_lon = sum(lons) / len(lons)
c_lat = sum(lats) / len(lats)

print(f"Centroid: [{c_lon:.8f}, {c_lat:.8f}]")
print(f"Entrance: [{ent[0]:.8f}, {ent[1]:.8f}]")

# Conversion to meters at Lipa City (lat ~ 13.9585)
lat_mid = math.radians(c_lat)
m_per_deg_lat = 111132.954 - 559.822 * math.cos(2 * lat_mid) + 1.175 * math.cos(4 * lat_mid)
m_per_deg_lon = 111412.84 * math.cos(lat_mid) - 93.5 * math.cos(3 * lat_mid)

print(f"Scale: 1 deg lon = {m_per_deg_lon:.2f} m, 1 deg lat = {m_per_deg_lat:.2f} m")

# Project poly to meters relative to centroid
poly_m = [((p[0] - c_lon) * m_per_deg_lon, (p[1] - c_lat) * m_per_deg_lat) for p in poly]
ent_m = ((ent[0] - c_lon) * m_per_deg_lon, (ent[1] - c_lat) * m_per_deg_lat)

print("\n--- Polygon vertices in meters relative to centroid (X=East, Y=North) ---")
for i, pt in enumerate(poly_m):
    print(f"P{i}: ({pt[0]:.2f}, {pt[1]:.2f})")

min_x = min(p[0] for p in poly_m)
max_x = max(p[0] for p in poly_m)
min_y = min(p[1] for p in poly_m)
max_y = max(p[1] for p in poly_m)

width = max_x - min_x
depth = max_y - min_y
print(f"\nBounding Box: Width (E-W) = {width:.2f} m, Depth (N-S) = {depth:.2f} m")
print(f"Entrance relative to centroid: X = {ent_m[0]:.2f} m, Y = {ent_m[1]:.2f} m")

# Compass bearing from centroid to entrance
# In navigation: 0 = North, 90 = East, 180 = South, 270 = West
d_lon = ent[0] - c_lon
d_lat = ent[1] - c_lat
dx = ent_m[0]
dy = ent_m[1]

bearing = (math.degrees(math.atan2(dx, dy)) + 360) % 360
print(f"Compass bearing from centroid to entrance: {bearing:.2f}°")

# South facade edge bearing: from P2 (SW) to P3 (SE)
p2 = poly_m[2]
p3 = poly_m[3]
edge_dx = p3[0] - p2[0]
edge_dy = p3[1] - p2[1]
edge_len = math.hypot(edge_dx, edge_dy)
edge_angle = math.degrees(math.atan2(edge_dy, edge_dx))
print(f"South Facade (Front) Length = {edge_len:.2f} m, Heading angle = {edge_angle:.2f}° (Relative to East)")
