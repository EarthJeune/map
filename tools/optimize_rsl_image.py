from PIL import Image
import os

src = r"Building Images\RSL Building\IMG_3853.jpg"
dst = r"images\rsl_building.jpg"

im = Image.open(src)
print(f"Original photo: {im.size}, format: {im.format}")

# Resize if wider than 1920
max_dim = 1920
if im.width > max_dim or im.height > max_dim:
    ratio = min(max_dim / im.width, max_dim / im.height)
    new_size = (int(im.width * ratio), int(im.height * ratio))
    im = im.resize(new_size, Image.Resampling.LANCZOS)
    print(f"Resized to {new_size}")

# Save optimized jpeg
im.save(dst, "JPEG", quality=85, optimize=True)
size_kb = os.path.getsize(dst) / 1024.0
print(f"Saved {dst}: {size_kb:.1f} KB (budget: 800 KB)")
