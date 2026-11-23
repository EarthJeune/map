import json

with open("rares_buildings.json", "r", encoding="utf-8") as f:
    bdata = json.load(f)

for feat in bdata["features"]:
    p = feat["properties"]
    print(p.get("id"), " | ", p.get("name"), " | ", p.get("num"), " | ", p.get("marker_coords"))

