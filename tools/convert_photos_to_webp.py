#!/usr/bin/env python3
"""
Convert Photos to WebP — DA Campus Wayfinding & Kiosk System
=============================================================
Scans the `images/` directory for any JPG/JPEG/PNG photos, converts them
to optimized WebP format (max width: 1440px, quality: 80, method: 6),
and safely removes the uncompressed originals after confirming WebP generation.
"""

import os
import sys
import shutil
from PIL import Image

MAX_WIDTH = 1440
QUALITY = 80
METHOD = 6

def convert_photos(target_dir='images', backup_dir=os.path.join('archive', 'images_jpg_backup')):
    if not os.path.exists(target_dir):
        print(f"Error: Target directory '{target_dir}' does not exist.")
        return 1

    os.makedirs(backup_dir, exist_ok=True)

    candidates = [
        f for f in sorted(os.listdir(target_dir))
        if f.lower().endswith(('.jpg', '.jpeg', '.png'))
        and not f.endswith('mapbox_gate_icon.svg')
    ]

    if not candidates:
        print(f"All photos in '{target_dir}' are already WebP! (0 non-WebP found)")
        return 0

    print(f"Found {len(candidates)} non-WebP image(s) to convert in '{target_dir}'...")
    total_saved = 0

    for f in candidates:
        in_fp = os.path.join(target_dir, f)
        base_name = os.path.splitext(f)[0]
        out_fp = os.path.join(target_dir, f"{base_name}.webp")
        orig_size = os.path.getsize(in_fp)

        # Backup original
        shutil.copy2(in_fp, os.path.join(backup_dir, f))

        with Image.open(in_fp) as im:
            if im.width > MAX_WIDTH:
                new_h = int(im.height * (MAX_WIDTH / im.width))
                im_res = im.resize((MAX_WIDTH, new_h), Image.Resampling.LANCZOS)
            else:
                im_res = im

            if im_res.mode in ('RGBA', 'LA') or (im_res.mode == 'P' and 'transparency' in im_res.info):
                im_res.save(out_fp, 'WEBP', quality=QUALITY, method=METHOD)
            else:
                im_res.convert('RGB').save(out_fp, 'WEBP', quality=QUALITY, method=METHOD)

        new_size = os.path.getsize(out_fp)
        saved = orig_size - new_size
        total_saved += saved
        print(f"  {f} ({orig_size/1024:.1f} KB) -> {base_name}.webp ({new_size/1024:.1f} KB, saved {saved/1024:.1f} KB)")

        # Remove original from target_dir
        os.remove(in_fp)

    print(f"\nDone! Converted {len(candidates)} photo(s). Total disk space saved: {total_saved/(1024*1024):.2f} MB.")
    return 0

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'images'
    sys.exit(convert_photos(target))

