import math

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

# Let's use tilt = 2.4°
tilt = 2.4
rad = math.radians(-tilt)
c, s = math.cos(rad), math.sin(rad)

pts = []
for lng, lat in coords:
    dx = (lng - avg_lng) * m_per_deg_lng
    dy = (lat - avg_lat) * m_per_deg_lat
    lx = dx * c - dy * s
    ly = dx * s + dy * c
    pts.append((lx, ly))

print(f'Centroid: [{avg_lng:.8f}, {avg_lat:.8f}], Tilt: {tilt}°')
print('=' * 70)
for i in range(len(pts)):
    p1 = pts[i]
    p2 = pts[(i+1)%len(pts)]
    dx = p2[0] - p1[0]
    dy = p2[1] - p1[1]
    dist = math.hypot(dx, dy)
    angle = (math.degrees(math.atan2(dx, dy)) + 360) % 360
    # Determine compass direction
    dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N']
    d_name = dirs[int((angle + 22.5) // 45)]
    print(f'Edge V{i:2d}->V{(i+1)%len(pts):2d}: length={dist:5.2f}m, dx={dx:+5.2f}m, dy={dy:+5.2f}m, dir={d_name:2s} ({angle:5.1f}°)')
    print(f'   from ({p1[0]:+5.2f}, {p1[1]:+5.2f}) to ({p2[0]:+5.2f}, {p2[1]:+5.2f})')
