import math

tanco = [
    [121.16645777915858, 13.958236278758307],
    [121.1665684430089,  13.958197579173877],
    [121.16652547355153, 13.958212605634591],
    [121.16651118216596, 13.958171543054751],
    [121.16661347206384, 13.95813924924791],
    [121.16662672013472, 13.958177199433386],
    [121.16668794029891, 13.958155790500783],
    [121.16672233552981, 13.95825894519453],
    [121.16649200125431, 13.958335957113334]
]

argosino = [
    [121.16641560813127, 13.958201716580504],
    [121.16662388986407, 13.958135960277133],
    [121.16657500083846, 13.957999497741426],
    [121.16637000694192, 13.958058727450336]
]

entrance_9 = [121.16660991196164, 13.958299358655267]

# Reference origin: entrance_9
ref_lon, ref_lat = entrance_9
m_per_deg_lat = 110574.0
m_per_deg_lon = 111320.0 * math.cos(math.radians(ref_lat))

def to_m(pt):
    return ((pt[0] - ref_lon) * m_per_deg_lon, (pt[1] - ref_lat) * m_per_deg_lat)

print("=== TANCO HALL VERTICES (meters from entrance_9) ===")
for i, pt in enumerate(tanco):
    x, y = to_m(pt)
    print(f"T{i}: x={x:+.2f}m (E), y={y:+.2f}m (N)  [lon={pt[0]:.7f}, lat={pt[1]:.7f}]")

print("\n=== ARGOSINO HALL VERTICES (meters from entrance_9) ===")
for i, pt in enumerate(argosino):
    x, y = to_m(pt)
    print(f"A{i}: x={x:+.2f}m (E), y={y:+.2f}m (N)")

print("\n=== TANCO HALL EDGES ===")
for i in range(len(tanco)):
    p1 = to_m(tanco[i])
    p2 = to_m(tanco[(i+1)%len(tanco)])
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    dist = math.hypot(dx, dy)
    b = (math.degrees(math.atan2(dx, dy)) + 360) % 360
    print(f"Edge T{i}->T{(i+1)%len(tanco)}: len={dist:5.2f}m, bearing={b:5.1f} deg")

print("\n=== ARGOSINO HALL EDGES ===")
for i in range(len(argosino)):
    p1 = to_m(argosino[i])
    p2 = to_m(argosino[(i+1)%len(argosino)])
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    dist = math.hypot(dx, dy)
    b = (math.degrees(math.atan2(dx, dy)) + 360) % 360
    print(f"Edge A{i}->A{(i+1)%len(argosino)}: len={dist:5.2f}m, bearing={b:5.1f} deg")
