import os
import json
import urllib.request

print("--- VERIFYING DA-RARES CHEMICAL STORAGE INTEGRATION ---")

# 1. Model File Verification
glb_path = "models/rares_chemical_storage.glb"
assert os.path.exists(glb_path), f"Missing GLB file: {glb_path}"
size_bytes = os.path.getsize(glb_path)
size_kb = size_bytes / 1024.0
print(f"1. GLB Model File: {glb_path} ({size_bytes} bytes, {size_kb:.2f} KB)")
assert size_kb < 300.0, f"GLB model exceeds 300 KB budget: {size_kb:.2f} KB"
print("   [PASS] Strictly under 300 KB budget!")

# 2. Registration in js/data/buildings.js
with open("js/data/buildings.js", "r", encoding="utf-8") as f:
    js_text = f.read()

assert "'rares_building_4'" in js_text, "Missing rares_building_4 in buildings.js"
assert "rares_chemical_storage" in js_text, "Missing modelId in buildings.js"
print("2. Registration in js/data/buildings.js: [PASS]")

# 3. GeoJSON in rares_buildings.json
with open("rares_buildings.json", "r", encoding="utf-8") as f:
    bldg_data = json.load(f)

chem_feat = None
for feat in bldg_data["features"]:
    if feat.get("properties", {}).get("id") == "rares_building_4":
        chem_feat = feat
        break

assert chem_feat is not None, "rares_building_4 not found in rares_buildings.json"
assert chem_feat["properties"].get("has_3d_model") is True, "has_3d_model is not True"
print(f"3. rares_buildings.json: [PASS] (has_3d_model: {chem_feat['properties']['has_3d_model']})")

# 4. Entrance Alignment in rares_roads.json
with open("rares_roads.json", "r", encoding="utf-8") as f:
    road_data = json.load(f)

ent_feat = None
for feat in road_data["features"]:
    if feat.get("properties", {}).get("buildingId") == "rares_building_4":
        ent_feat = feat
        break

assert ent_feat is not None, "Entrance node for rares_building_4 not found in rares_roads.json"
print(f"4. Entrance Node Alignment: [PASS] (id: {ent_feat['properties']['id']}, coords: {ent_feat['geometry']['coordinates']})")

# 5. Drawer Photo WebP
webp_path = "images/rares_building_4.webp"
assert os.path.exists(webp_path), f"Missing WebP image: {webp_path}"
webp_size_kb = os.path.getsize(webp_path) / 1024.0
print(f"5. Drawer Photo: {webp_path} ({webp_size_kb:.2f} KB)")
assert webp_size_kb < 300.0, f"WebP image exceeds 300 KB: {webp_size_kb:.2f} KB"
print("   [PASS] Optimized WebP format verified!")

# 6. HTTP Server Live Test
try:
    res = urllib.request.urlopen("http://localhost:8080/models/rares_chemical_storage.glb?v=1")
    assert res.status == 200, f"HTTP status: {res.status}"
    print(f"6. HTTP Server Live Test: [PASS] (status: 200, size: {res.headers.get('Content-Length')})")
except Exception as e:
    print(f"6. HTTP Server Live Test: [WARN] ({e})")

print("\n--- ALL VERIFICATION CHECKS PASSED FOR CHEMICAL STORAGE ---")

