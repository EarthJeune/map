import json

data = open('js/data/geo.js', 'r', encoding='utf-8').read()
start = data.find('export const LARES_MASK = ') + len('export const LARES_MASK = ')
end = data.find(';\n\nexport const QARES_MASK')
mask_json = json.loads(data[start:end])
hole = mask_json['features'][0]['geometry']['coordinates'][1]

xs = [p[0] for p in hole]
ys = [p[1] for p in hole]
min_x, max_x = min(xs), max(xs)
min_y, max_y = min(ys), max(ys)
w, h = 800, 600

def to_screen(p):
    sx = (p[0] - min_x) / (max_x - min_x) * (w - 40) + 20
    sy = (max_y - p[1]) / (max_y - min_y) * (h - 40) + 20
    return f"{sx:.1f},{sy:.1f}"

pts = " ".join([to_screen(p) for p in hole])
svg = f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" style="background:#111"><polygon points="{pts}" fill="#22c55e" fill-opacity="0.3" stroke="#22c55e" stroke-width="2"/></svg>'
open('tools/mask.svg', 'w').write(svg)
print('Saved tools/mask.svg')
