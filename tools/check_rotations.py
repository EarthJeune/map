import re

with open('js/data/buildings.js', 'r', encoding='utf-8') as f:
    text = f.read()

matches = re.findall(r"'(\w+)':\s*\{[^}]*modelId:\s*'(\w+)'[^}]*rotation:\s*([0-9\.\-]+)", text)
for m in matches[:20]:
    print(f"{m[0]:30} | {m[1]:25} | rot={m[2]}")

