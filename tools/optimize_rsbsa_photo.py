import os
from PIL import Image

src = r"Building Images/RSBSA Building/IMG_3833.jpg"
dst = r"images/rsbsa_building.jpg"

with Image.open(src) as img:
    # Resize max 1920px
    img.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
    img.save(dst, "JPEG", quality=85, optimize=True)

size_kb = os.path.getsize(dst) / 1024.0
print(f"Optimized drawer photo saved to {dst}: {size_kb:.1f} KB")
