import math
import numpy as np

# Coordinates of unique vertices in order
pts = [
    (-4.41, +3.16),  # V0
    (-8.12, +3.41),  # V1
    (-9.07, -12.98), # V2
    (+1.25, -13.49), # V3
    (+1.54, -5.05),  # V4
    (+7.76, -5.52),  # V5
    (+7.90, +3.65),  # V6
    (+3.92, +3.91),  # V7
    (+4.05, +6.18),  # V8
    (-0.18, +6.57),  # V9
    (-0.34, +4.98),  # V10
    (-4.31, +5.19)   # V11
]

# Let's inspect the angle of the main walls:
# West wall: V1 to V2
dx_west = pts[2][0] - pts[1][0]
dy_west = pts[2][1] - pts[1][1]
angle_west = math.degrees(math.atan2(dx_west, dy_west))
print(f'West wall (V1 -> V2): dx={dx_west:.2f}, dy={dy_west:.2f}, length={math.hypot(dx_west, dy_west):.2f}m, angle={angle_west:.2f}° from North')

# Front wall: V2 to V3
dx_front = pts[3][0] - pts[2][0]
dy_front = pts[3][1] - pts[2][1]
angle_front = math.degrees(math.atan2(dx_front, dy_front))
print(f'Front wall (V2 -> V3): dx={dx_front:.2f}, dy={dy_front:.2f}, length={math.hypot(dx_front, dy_front):.2f}m, angle={angle_front:.2f}° from North')

# East wall: V5 to V6
dx_east = pts[6][0] - pts[5][0]
dy_east = pts[6][1] - pts[5][1]
angle_east = math.degrees(math.atan2(dx_east, dy_east))
print(f'East wall (V5 -> V6): dx={dx_east:.2f}, dy={dy_east:.2f}, length={math.hypot(dx_east, dy_east):.2f}m, angle={angle_east:.2f}° from North')

# Let's find the optimal building rotation theta so that walls align with local axes!
# Front wall should be along local X axis (perpendicular to Y).
# If building rotation is theta:
# Front wall angle is ~ 92.8° (almost exactly East!).
# West wall angle is ~ -176.7° (almost exactly South!).
# East wall angle is ~ 0.9° (almost exactly North!).
# This means the building is aligned almost perfectly with Cardinal directions with a slight tilt of ~2.5° to 3.5°!
# Let's calculate the average tilt angle relative to North:
# West wall goes South: (180 - 176.67) = +3.33° clockwise
# East wall goes North: +0.87° clockwise
# Front wall goes East: (92.84 - 90) = +2.84° clockwise
avg_tilt = (3.33 + 0.87 + 2.84) / 3.0
print(f'Average building tilt: {avg_tilt:.2f}° clockwise!')

# If Mapbox rotation is avg_tilt (e.g. 3.0° or 3.6°),
# let us rotate the vertices by -avg_tilt so they are cleanly aligned to local Blender X and Y!
rot_rad = math.radians(-avg_tilt)
cos_r, sin_r = math.cos(rot_rad), math.sin(rot_rad)

print('\n--- Local Rotated Coordinates (tilt = {:.2f}°) ---'.format(avg_tilt))
local_aligned = []
for i, (x, y) in enumerate(pts):
    lx = x * cos_r - y * sin_r
    ly = x * sin_r + y * cos_r
    local_aligned.append((lx, ly))
    print(f'V{i:2d}: lx={lx:+6.2f}m, ly={ly:+6.2f}m')

# Check bounding box
xs = [p[0] for p in local_aligned]
ys = [p[1] for p in local_aligned]
print(f'Bounding Box in local coords: X=[{min(xs):.2f}, {max(xs):.2f}] (width={max(xs)-min(xs):.2f}m), Y=[{min(ys):.2f}, {max(ys):.2f}] (length={max(ys)-min(ys):.2f}m)')
