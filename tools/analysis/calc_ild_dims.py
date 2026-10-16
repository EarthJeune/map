import json
import math

# Vertex coordinates from buildings.js:
# V0: [121.16609037376128, 13.959375646074022] (NE / NW?)
# V1: [121.16599668352882, 13.959348374508338] (NW)
# V2: [121.16604653858764, 13.959196657983284] (SW)
# V3: [121.166138021628,   13.959223902828015] (SE)

# Centroid:
lons = [121.16609037376128, 121.16599668352882, 121.16604653858764, 121.166138021628]
lats = [13.959375646074022, 13.959348374508338, 13.959196657983284, 13.959223902828015]
c_lon = sum(lons) / 4.0
c_lat = sum(lats) / 4.0
print(f"Centroid: [{c_lon:.8f}, {c_lat:.8f}]")

m_lat = 110574.0
m_lon = 111320.0 * math.cos(math.radians(c_lat))

# Local coords relative to centroid (X=East, Y=North in meters):
local_pts = []
for lon, lat in zip(lons, lats):
    x = (lon - c_lon) * m_lon
    y = (lat - c_lat) * m_lat
    local_pts.append((x, y))

for i, (x, y) in enumerate(local_pts):
    print(f"V{i}: X={x:+.2f}m, Y={y:+.2f}m")

# Edge 3 is from V3 to V0:
# V3 is (+7.57, -6.89) -> South-East corner
# V0 is (+2.43, +9.90) -> North-East corner
# Edge 3 vector: dx = -5.14, dy = 16.79
# Bearing of Edge 3:
dx = local_pts[0][0] - local_pts[3][0]
dy = local_pts[0][1] - local_pts[3][1]
edge3_len = math.hypot(dx, dy)
edge3_bearing = (math.degrees(math.atan2(dx, dy)) + 360) % 360
print(f"Edge 3 (V3->V0, East facade): length={edge3_len:.2f}m, bearing={edge3_bearing:.2f}°")

# Normal to Edge 3 (facing outwards to the East):
outward_normal_bearing = (edge3_bearing + 90) % 360
print(f"Outward normal of East facade: {outward_normal_bearing:.2f}°")

# Edge 2 (V2->V3, South facade):
# V2 is (-2.32, -9.89) -> South-West corner
# V3 is (+7.57, -6.89) -> South-East corner
dx2 = local_pts[3][0] - local_pts[2][0]
dy2 = local_pts[3][1] - local_pts[2][1]
edge2_len = math.hypot(dx2, dy2)
edge2_bearing = (math.degrees(math.atan2(dx2, dy2)) + 360) % 360
print(f"Edge 2 (V2->V3, South facade): length={edge2_len:.2f}m, bearing={edge2_bearing:.2f}°")

# Entrance node:
ent_lon, ent_lat = 121.16613265691541, 13.959236206863665
ent_x = (ent_lon - c_lon) * m_lon
ent_y = (ent_lat - c_lat) * m_lat
print(f"Entrance node relative to centroid: X={ent_x:+.2f}m, Y={ent_y:+.2f}m")
