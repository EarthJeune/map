import math
P = [[121.16680637451611, 13.959529650059125], [121.16687660648068, 13.959280111002002],
     [121.16700728643661, 13.959312945578745], [121.16692874215511, 13.95956272483349]]
E = [121.16695571553987, 13.959293634231514]
lat0 = sum(p[1] for p in P) / 4
KX = 111320 * math.cos(math.radians(lat0))
KY = 110574
def m(a, b):
    return ((b[0] - a[0]) * KX, (b[1] - a[1]) * KY)
cx = sum(p[0] for p in P) / 4; cy = sum(p[1] for p in P) / 4
print(f"center [{cx:.8f}, {cy:.8f}]")
for i in range(4):
    a, b = P[i], P[(i + 1) % 4]
    dx, dy = m(a, b)
    L = math.hypot(dx, dy)
    brg = math.degrees(math.atan2(dx, dy)) % 360
    mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    ex, ey = m(mid, E)
    # outward normal (polygon order) — compare with vector from center to mid
    ox, oy = m([cx, cy], mid)
    nrm = math.degrees(math.atan2(ox, oy)) % 360
    print(f"edge P{i}->P{(i+1)%4}: len={L:.2f}m bearing={brg:.1f} outward={nrm:.1f} entrance_dist_to_mid={math.hypot(ex, ey):.2f}m")
ex, ey = m([cx, cy], E)
print("centroid->entrance bearing", math.degrees(math.atan2(ex, ey)) % 360)
# entrance offset along the front face (positive = toward building's right when facing it from outside... print raw)
