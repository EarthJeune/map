import json

# Check buildings.json first
try:
    with open('buildings.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        for feat in data.get('features', []):
            fid = feat.get('properties', {}).get('id')
            if 'rsbsa' in str(fid).lower():
                print('Found in buildings.json:', json.dumps(feat, indent=2))
except Exception as e:
    print('buildings.json error:', e)

# Check js/data/buildings.js
with open('js/data/buildings.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Parse the GeoJSON object inside LARES_DRAWINGS
start_idx = text.find('export const LARES_DRAWINGS = ')
if start_idx != -1:
    brace_idx = text.find('{', start_idx)
    # find where LARES_DRAWINGS ends (semicolon before export const)
    end_idx = text.find(';\n\nexport const', brace_idx)
    if end_idx != -1:
        json_str = text[brace_idx:end_idx]
        try:
            drawings = json.loads(json_str)
            for feat in drawings.get('features', []):
                fid = feat.get('properties', {}).get('id')
                if 'rsbsa' in str(fid).lower():
                    print('Found in LARES_DRAWINGS:', json.dumps(feat, indent=2))
        except Exception as e:
            print('JSON parse error in LARES_DRAWINGS:', e)
