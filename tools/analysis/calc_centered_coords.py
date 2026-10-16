import math

# Centroid of polygon in buildings.json
coords = [
    (121.16712863149047, 13.958602976415904), # V0
    (121.16709427668661, 13.958605255659563), # V1
    (121.16708544869255, 13.958457596038713), # V2
    (121.16718102037771, 13.958452999197092), # V3
    (121.16718369481902, 13.95852902603135),  # V4
    (121.16724126558347, 13.958524765643844), # V5
    (121.16724256204986, 13.958607397159483), # V6
    (121.16720575207468, 13.958609787134666), # V7
    (121.16720694542758, 13.958630187177228), # V8
    (121.16716772280569, 13.958633729723985), # V9
    (121.1671663160974,  13.9586194022162),   # V10
    (121.16712949973015, 13.958621326987853)  # V11
]

avg_lng = sum(p[0] for p in coords) / len(coords)
avg_lat = sum(p[1] for p in coords) / len(coords)
m_per_deg_lng = 108032.76
m_per_deg_lat = 111000.00

# Let's test with Mapbox rotation = 2.8°
# In Mapbox, model-rotation: [0, 0, rot] rotates clockwise.
# To transform GeoJSON (dx, dy) where dx is East, dy is North:
# Rotated by -rot:
# lx = dx*cos(-rot) - dy*sin(-rot)
# ly = dx*sin(-rot) + dy*cos(-rot)
rot = 2.8
rad = math.radians(-rot)
c, s = math.cos(rad), math.sin(rad)

local_pts = []
for lng, lat in coords:
    dx = (lng - avg_lng) * m_per_deg_lng
    dy = (lat - avg_lat) * m_per_deg_lat
    lx = dx * c - dy * s
    ly = dx * s + dy * c
    local_pts.append((lx, ly))

# Center the local points at the center of the bounding box or centroid:
cx = sum(p[0] for p in local_pts) / len(local_pts)
cy = sum(p[1] for p in local_pts) / len(local_pts)

print(f'Center offset: cx={cx:.3f}, cy={cy:.3f}')
centered = [(p[0] - cx, p[1] - cy) for p in local_pts]

for i, p in enumerate(centered):
    print(f'V{i:2d}: X={p[0]:+6.2f}m, Y={p[1]:+6.2f}m')
