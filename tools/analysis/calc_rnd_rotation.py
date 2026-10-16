import math

# Centroid and polygon from buildings.json
poly = [
    [121.16706047324425, 13.958255190798141], # P0 (Rear-Right / NE)
    [121.1669374668499, 13.958290292507968],  # P1 (Front-Right / NW)
    [121.16689324901023, 13.958103267269735], # P2 (Front-Left / SW)
    [121.16701339589048, 13.95807611425154]   # P3 (Rear-Left / SE)
]

avg_lng = sum(p[0] for p in poly) / len(poly)
avg_lat = sum(p[1] for p in poly) / len(poly)
print(f'Centroid: [{avg_lng:.8f}, {avg_lat:.8f}]')

m_per_deg_lng = 108032.76
m_per_deg_lat = 111000.00

# Convert poly to local dx, dy from centroid
pts = []
for lng, lat in poly:
    dx = (lng - avg_lng) * m_per_deg_lng
    dy = (lat - avg_lat) * m_per_deg_lat
    pts.append((dx, dy))

# P1 to P2 is the FRONT FACADE:
dx_front = pts[2][0] - pts[1][0]
dy_front = pts[2][1] - pts[1][1]
front_len = math.hypot(dx_front, dy_front)
front_edge_bearing = (math.degrees(math.atan2(dx_front, dy_front)) + 360) % 360

# Normal to front edge pointing OUTWARDS (towards West/Northwest):
# The front edge goes from P1 to P2 (bearing ~193° South-Southwest)
# Facing outwards to the right of P1->P2 vector:
# Outward normal bearing = 193° + 90° = 283°!
outward_normal = (front_edge_bearing + 90) % 360
print(f'Front edge P1->P2 length: {front_len:.2f}m, bearing: {front_edge_bearing:.1f}°')
print(f'Outward front facade facing direction: {outward_normal:.1f}°')

# In Blender, front facade is modeled facing -Y (180° bearing).
# In Mapbox GL JS, clockwise rotation:
mapbox_rotation = (outward_normal - 180 + 360) % 360
print(f'Optimal Mapbox rotation: {mapbox_rotation:.1f}°')

# Let us rotate the polygon by -mapbox_rotation to see dimensions in Blender local space!
rad = math.radians(-mapbox_rotation)
c, s = math.cos(rad), math.sin(rad)

local_blender = []
for dx, dy in pts:
    lx = dx * c - dy * s
    ly = dx * s + dy * c
    local_blender.append((lx, ly))

print('\n--- Blender Local Coordinates ---')
for i, (lx, ly) in enumerate(local_blender):
    print(f'P{i}: lx={lx:+6.2f}m, ly={ly:+6.2f}m')

xs = [p[0] for p in local_blender]
ys = [p[1] for p in local_blender]
print(f'\nFootprint width (X, length of front): {max(ys)-min(ys):.2f}m, depth (Y): {max(xs)-min(xs):.2f}m')
