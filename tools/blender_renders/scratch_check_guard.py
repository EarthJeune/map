import math

coords = [
    [121.16589070369986, 13.958339758938124],
    [121.1657850236358, 13.958340012677056],
    [121.1657855574004, 13.958248967233274],
    [121.16589212875692, 13.958254478291408]
]

avg_lon = sum(c[0] for c in coords) / len(coords)
avg_lat = sum(c[1] for c in coords) / len(coords)
print(f"Centroid: [{avg_lon:.8f}, {avg_lat:.8f}]")

m_per_deg_lat = 110574.0
m_per_deg_lon = 111320.0 * math.cos(math.radians(avg_lat))

p0, p1, p2, p3 = coords

# Edge 1: p1 -> p0 (North edge: from NW to NE)
dx0 = (p0[0] - p1[0]) * m_per_deg_lon
dy0 = (p0[1] - p1[1]) * m_per_deg_lat
print(f"NW -> NE (p1 -> p0): len={math.hypot(dx0, dy0):.2f}m, angle={math.degrees(math.atan2(dy0, dx0)):.2f}°")

# Edge 2: p2 -> p1 (West edge: from SW to NW)
dx1 = (p1[0] - p2[0]) * m_per_deg_lon
dy1 = (p1[1] - p2[1]) * m_per_deg_lat
print(f"SW -> NW (p2 -> p1): len={math.hypot(dx1, dy1):.2f}m, angle={math.degrees(math.atan2(dy1, dx1)):.2f}°")

# Edge 3: p3 -> p2 (South edge: from SE to SW)
dx2 = (p2[0] - p3[0]) * m_per_deg_lon
dy2 = (p2[1] - p3[1]) * m_per_deg_lat
print(f"SE -> SW (p3 -> p2): len={math.hypot(dx2, dy2):.2f}m, angle={math.degrees(math.atan2(dy2, dx2)):.2f}°")

# Edge 4: p0 -> p3 (East edge: from NE to SE)
dx3 = (p3[0] - p0[0]) * m_per_deg_lon
dy3 = (p3[1] - p0[1]) * m_per_deg_lat
print(f"NE -> SE (p0 -> p3): len={math.hypot(dx3, dy3):.2f}m, angle={math.degrees(math.atan2(dy3, dx3)):.2f}°")
