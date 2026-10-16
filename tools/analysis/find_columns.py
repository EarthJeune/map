from PIL import Image
import numpy as np

img = Image.open('scratch/preview_Top_View_rnd.jpg')
w, h = img.size
print('Preview size:', w, h)

# In preview (1280 x 959), let's inspect the corner columns:
# Corner columns:
# Top-Left corner: around x=260, y=260
# Top-Right corner: around x=1000, y=260
# Bottom-Left corner: around x=260, y=680
# Bottom-Right corner: around x=1000, y=680

# Let's inspect small patches around these estimates
arr = np.array(img)
print("Pixel at (260, 260):", arr[260, 260])
print("Pixel at (990, 260):", arr[260, 990])
print("Pixel at (260, 680):", arr[680, 260])
print("Pixel at (990, 680):", arr[680, 990])

# Let's find exact coordinates of the 4 corner columns in preview
# Columns are light grey/blue ([190, 205, 220] or similar)
for name, (px, py) in [('TL', (260, 260)), ('TR', (990, 260)), ('BL', (260, 680)), ('BR', (990, 680))]:
    patch = arr[py-30:py+30, px-30:px+30]
    # Brightest pixel in patch
    brightness = patch.sum(axis=2)
    min_b, max_b = brightness.min(), brightness.max()
    by, bx = np.unravel_index(np.argmax(brightness), brightness.shape)
    actual_x = px - 30 + bx
    actual_y = py - 30 + by
    print(f'{name} column at: ({actual_x}, {actual_y})')
