import os
import re
import json
from pathlib import Path
from PIL import Image, ImageOps

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception as e:
    print("Warning: pillow_heif not available:", e)

ROOT = Path(__file__).resolve().parent.parent
SRC_ROOT = ROOT / "Building Images RARES"
OUT_DIR = ROOT / "images"
MANIFEST_PATH = ROOT / "tools" / "rares_photos_manifest.json"

VALID_EXTS = {".heic", ".jpg", ".jpeg", ".png", ".webp"}
MAX_WIDTH = 1440
WEBP_QUALITY = 80

# Exact 1-to-1 mapping from Building Images RARES folders to the 39 singular RARES building codes
FOLDER_MAP = {
    "rares_building_1": "Guard House",
    "rares_building_2": "Admin Building",
    "rares_building_3": "Seed Storage",
    "rares_building_4": "Chemical Storage",
    "rares_building_5": "Flatbed Dryer",
    "rares_building_6": "Nursery A",
    "rares_building_7": "APCO Rizal Building",
    "rares_building_8": "Common CR",
    "rares_building_9": "Vermicomposting Facility (Old)",
    "rares_building_10": "Office Supply Storage",
    "rares_building_11": "Machinery Shed",
    "rares_building_12": "Nursery Storage Area for Hydroponics",
    "rares_building_13": "Greenhouse with Hydroponics",
    "rares_building_14": "Nursery B",
    "rares_building_15": "Staff House A",
    "rares_building_16": "SGPP Storage",
    "rares_building_17": "Multipurpose R&D Building",
    "rares_building_18": "Low Cost Greenhouse",
    "rares_building_19": "Low cost hydroponics facility",
    "rares_building_20": "Staff House B",
    "rares_building_21": "Staff House C",
    "rares_building_22": "Mushroom Laboratory",
    "rares_building_23": "Staff House D",
    "rares_building_24": "Mini Conference Hall",
    "rares_building_25": "Poultry House",
    "rares_building_26": "Farm House",
    "rares_building_27": "Vermicomposting Facility (New)",
    "rares_building_28": "Machinery & Equipment Storage",
    "rares_building_29": "Pre Composting Area",
    "rares_building_30": "Automated Weather Station",
    "rares_building_31": "Rest Area",
    "rares_building_32": "Hatchery Area",
    "rares_building_33": "Multipurpose Palay Shed",
    "rares_building_34": "Botanical Concoction Storage",
    "rares_building_35": "Wood Vinegar Facility",
    "rares_building_36": "SGPP",
    "rares_building_37": "Breeder and Brooder House",
    "rares_building_38": "Breeder and Brooder House",
    "rares_building_39": "SPIS",
}

def sort_key(p: Path):
    low = p.stem.lower()
    if "front" in low:
        pri = 0
    elif "outside" in low or "exterior" in low or "side" in low:
        pri = 1
    elif "back" in low or "rear" in low:
        pri = 2
    elif "inside" in low or "interior" in low:
        pri = 3
    else:
        pri = 2
    return (pri, p.name.lower())

def clean_caption(stem: str, idx: int) -> str:
    return ""

def convert_to_webp(src: Path, dst: Path):
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        if im.width > MAX_WIDTH:
            ratio = MAX_WIDTH / float(im.width)
            im = im.resize((MAX_WIDTH, max(1, int(im.height * ratio))), Image.Resampling.LANCZOS)
        dst.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst, format="WEBP", quality=WEBP_QUALITY, method=4)

def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {}
    converted_cache = {}
    total_files = 0

    for code, folder_name in FOLDER_MAP.items():
        folder = SRC_ROOT / folder_name
        if not folder.is_dir():
            print(f"[WARN] Missing folder for {code}: {folder}")
            manifest[code] = []
            continue

        files = [
            p for p in folder.iterdir()
            if p.is_file()
            and p.suffix.lower() in VALID_EXTS
            and "- copy" not in p.stem.lower()
        ]
        files.sort(key=sort_key)

        entries = []
        for idx, src in enumerate(files, start=1):
            if idx == 1:
                out_name = f"{code}.webp"
            else:
                out_name = f"{code}_{idx}.webp"
            dst = OUT_DIR / out_name
            cache_key = (str(src.resolve()), out_name)
            if cache_key not in converted_cache:
                convert_to_webp(src, dst)
                converted_cache[cache_key] = True
                total_files += 1
            entries.append({
                "image_webp_url": f"images/{out_name}",
                "caption": clean_caption(src.stem, idx),
                "display_order": idx,
                "is_primary": 1 if idx == 1 else 0
            })
        manifest[code] = entries
        print(f"[OK] {code} ({folder_name}): {len(entries)} WebP photos")

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nDone! Converted {total_files} WebP images across {len(manifest)} RARES buildings.")
    print(f"Manifest written to {MANIFEST_PATH}")

if __name__ == "__main__":
    main()
