import math

# Centered model corners in Blender:
W = 20.71
D = 27.62

corners_blender = [
    ("Front-Left (P3)",  -W/2, -D/2),
    ("Front-Right (P4)",  W/2, -D/2),
    ("Rear-Right (P1)",   W/2,  D/2),
    ("Rear-Left (P2)",   -W/2,  D/2)
]

R = 254.22
rad = math.radians(R)
mx_c = 0.23
my_c = -4.77

print("Transformed Model Corners vs Polygon in buildings.js (relative to polygon centroid):")
for name, bx, by in corners_blender:
    mx =  bx * math.cos(rad) + by * math.sin(rad) + mx_c
    my = -bx * math.sin(rad) + by * math.cos(rad) + my_c
    print(f"  {name:20s}: Model=({mx:6.2f}, {my:6.2f})")

print("\nActual polygon vertices in buildings.js:")
print("  P3 (Front-Left):  ( 16.33, -10.98)")
print("  P4 (Front-Right): ( 10.70,   8.95)")
print("  P1 (Rear-Right):  (-16.47,   5.14)  [P0 is at (-0.63, 9.24)]")
print("  P2 (Rear-Left):   (-10.29, -18.33)")
