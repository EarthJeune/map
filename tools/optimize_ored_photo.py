from PIL import Image
import os

src = r"Building Images/ORED Building/IMG_3808.jpg"
dst = r"images/ored_building.jpg"

img = Image.open(src)
# Convert if needed
if img.mode != 'RGB':
    img = img.convert('RGB')

# Downscale to max 1920 on longest edge
max_dim = 1920
w, h = img.size
if max(w, h) > max_dim:
    scale = max_dim / float(max(w, h))
    new_w, new_h = int(w * scale), int(h * scale)
    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

# Save with progressive JPEG quality 85
img.save(dst, 'JPEG', quality=85, optimize=True)
size_kb = os.path.getsize(dst) / 1024.0
print(f"Created {dst} - Dimensions: {img.size}, Size: {size_kb:.1f} KB")
