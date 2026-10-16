"""
optimize_ild_photo.py — Optimize front reference photo for building info drawer.
"""

from PIL import Image
import os

src = r"Building Images\ILD Building\IMG_3864.jpg"
dst = r"images\ild_building.jpg"

img = Image.open(src)
print("Source size:", img.size)

# Resize to max 1920 width while maintaining aspect ratio
max_w = 1920
if img.width > max_w:
    ratio = max_w / float(img.width)
    new_h = int(img.height * ratio)
    img = img.resize((max_w, new_h), Image.Resampling.LANCZOS)
    print(f"Resized to: {img.size}")

img.save(dst, "JPEG", quality=88, optimize=True)
size_kb = os.path.getsize(dst) / 1024.0
print(f"✅ Saved drawer photo to {dst} (Size: {size_kb:.1f} KB)")
