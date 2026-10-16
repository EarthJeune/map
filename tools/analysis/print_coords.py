import json

with open('js/data/buildings.js', 'r', encoding='utf-8') as f:
    txt = f.read()

# Let's extract ored and admin coords
import re

for b_id in ['ored_building', 'admin_building']:
    m = re.search(r'\"id\":\s*\"' + b_id + r'\"[\s\S]*?\"coordinates\":\s*(\[\[\[[\s\S]*?\]\]\])', txt)
    if m:
        coords = json.loads(m.group(1))[0]
        print(f"=== {b_id} ===")
        for i, c in enumerate(coords):
            print(f"  P{i}: lon={c[0]:.8f}, lat={c[1]:.8f}")
