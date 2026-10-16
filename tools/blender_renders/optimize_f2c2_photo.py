"""
optimize_f2c2_photo.py — Optimize front reference photo for building info drawer.
"""

from PIL import Image
import os

src = r"Building Images\F2C2 Building\IMG_3863.jpg"
dst = r"images\f2c2_building.jpg"

img = Image.open(src)
print(f"Original size: {img.size}")

# Resize if wider than 1920px
max_dim = 1920
if max(img.size) > max_dim:
    scale = max_dim / float(max(img.size))
    new_size = (int(img.size[0] * scale), int(img.size[1] * scale))
    img = img.resize(new_size, Image.Resampling.LANCZOS)
    print(f"Resized to: {img.size}")

img.save(dst, "JPEG", quality=85, optimize=True)
size_kb = os.path.getsize(dst) / 1024.0
print(f"Saved optimized photo to {dst} ({size_kb:.1f} KB)")
