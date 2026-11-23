import json, math

with open('rares_buildings.json') as f:
    bdata = json.load(f)

feat = next(f for f in bdata['features'] if f['properties'].get('id') == 'rares_building_2')
poly_coords = feat['geometry']['coordinates'][0]

# Centroid of polygon
clon = sum(p[0] for p in poly_coords[:-1]) / (len(poly_coords)-1)
clat = sum(p[1] for p in poly_coords[:-1]) / (len(poly_coords)-1)

R_EARTH = 6378137.0
def to_xy(lon, lat):
    x = (lon - clon) * (math.pi / 180.0) * R_EARTH * math.cos(clat * math.pi / 180.0)
    y = (lat - clat) * (math.pi / 180.0) * R_EARTH
    return x, y

xy_target = [to_xy(p[0], p[1]) for p in poly_coords]

# Let's test rotating a model defined in local (x, y):
# Main body: W=20.30 (X from -10.15 to +10.15), D=10.70 (Y from -5.35 to +5.35)
# Porch: X from -2.0 to +2.0, Y from -5.35 to -7.55
# In Mapbox:
# When rotation R is applied to a model point (mx, my):
# Standard Mapbox model transform:
# (wx, wy) = rotate( (mx, my), R )
# where R=0 has mx->East(+X), my->North(+Y)
# If my = -5.35 is South (-Y in world at R=0),
# rotating by R clockwise by theta:
# wx =  mx * cos(theta) + my * sin(theta)
# wy = -mx * sin(theta) + my * cos(theta)
# Let's check theta = 103.5 degrees:

theta = math.radians(103.5)
# If porch is at my = -6.5, mx = 0:
wx = 0 * math.cos(theta) + (-6.5) * math.sin(theta)
wy = -0 * math.sin(theta) + (-6.5) * math.cos(theta)
print(f'Porch in world XY: wx={wx:.2f}m, wy={wy:.2f}m')

# Check entrance XY:
with open('rares_roads.json') as f:
    rdata = json.load(f)
ent = next(f for f in rdata['features'] if f['properties'].get('id') == 'rares_entrance_2')
ex, ey = to_xy(ent['geometry']['coordinates'][0], ent['geometry']['coordinates'][1])
print(f'Actual Entrance in world XY: ex={ex:.2f}m, ey={ey:.2f}m')

