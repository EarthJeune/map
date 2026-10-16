import os
from PIL import Image

src_img = r"Building Images/Tissue Culture/IMG_3837.jpg"
out_img = r"images/tissue_culture_building.jpg"

os.makedirs("images", exist_ok=True)
with Image.open(src_img) as im:
    max_dim = 1920
    w, h = im.size
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        new_size = (int(w * scale), int(h * scale))
        im = im.resize(new_size, Image.Resampling.LANCZOS)
    im.save(out_img, "JPEG", quality=85, optimize=True)

size_kb = os.path.getsize(out_img) / 1024.0
print(f"Optimized drawer photo: {out_img} ({size_kb:.1f} KB)")
