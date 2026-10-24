"""
DA-QARES Drone Orthomosaic MBTiles Generator
Converts raw GeoTIFF (QARES.tif) into a high-performance multi-scale MBTiles tile pyramid.
"""

import os
import sys
import math
import io
import time
import sqlite3
import argparse
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile

def num2deg_bounds(xtile, ytile, zoom):
    n = 2.0 ** zoom
    lon_w = xtile / n * 360.0 - 180.0
    lon_e = (xtile + 1) / n * 360.0 - 180.0
    lat_n = math.degrees(math.atan(math.sinh(math.pi * (1.0 - 2.0 * ytile / n))))
    lat_s = math.degrees(math.atan(math.sinh(math.pi * (1.0 - 2.0 * (ytile + 1) / n))))
    return lon_w, lat_s, lon_e, lat_n

def main():
    parser = argparse.ArgumentParser(description="Generate QARES MBTiles from QARES.tif")
    parser.add_argument("--input", default=r"C:\Users\LGU-SanPedro\Downloads\QARES.tif", help="Path to input GeoTIFF")
    parser.add_argument("--output", default=r"QARES v1.mbtiles", help="Output .mbtiles file path")
    parser.add_argument("--min-zoom", type=int, default=14, help="Minimum zoom level")
    parser.add_argument("--max-zoom", type=int, default=21, help="Maximum zoom level")
    args = parser.parse_args()

    input_path = os.path.abspath(args.input)
    output_path = os.path.abspath(args.output)

    if not os.path.exists(input_path):
        print(f"Error: Input file does not exist: {input_path}")
        sys.exit(1)

    print("=" * 65)
    print("DA-QARES DRONE ORTHOMOSAIC MBTILES GENERATOR")
    print(f"Input:    {input_path}")
    print(f"Output:   {output_path}")
    print(f"Zooms:    {args.min_zoom} to {args.max_zoom}")
    print("=" * 65)

    t0 = time.time()
    print("[1/4] Opening GeoTIFF and reading metadata...")
    img = Image.open(input_path)
    W, H = img.size
    print(f"      Dimensions: {W} x {H} pixels ({W*H/1e6:.1f} Megapixels), Mode: {img.mode}")

    # Ground-truth georeferencing tiepoints extracted from GeoTIFF tags
    lon_min = 121.36688765545601
    lat_max = 13.950960439955999
    dx = 5.821160000003062e-07
    dy = 5.685430000000209e-07

    lon_max = lon_min + W * dx
    lat_min = lat_max - H * dy

    print(f"      Bounds: Lon [{lon_min:.6f}, {lon_max:.6f}], Lat [{lat_min:.6f}, {lat_max:.6f}]")
    print(f"      Ground Resolution: ~{dx*108038*100:.1f} cm / pixel")

    print("[2/4] Loading image buffer into memory for sub-millisecond random crops...")
    img.load()
    print(f"      Loaded in {time.time()-t0:.2f}s")

    # Initialize SQLite MBTiles Database
    if os.path.exists(output_path):
        os.remove(output_path)

    conn = sqlite3.connect(output_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA synchronous = OFF;")
    cursor.execute("PRAGMA journal_mode = MEMORY;")
    cursor.execute("PRAGMA cache_size = -64000;")

    cursor.execute("CREATE TABLE metadata (name text, value text);")
    cursor.execute("CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);")
    cursor.execute("CREATE UNIQUE INDEX tile_index on tiles (zoom_level, tile_column, tile_row);")

    # Insert metadata
    metadata = [
        ('name', 'QARES Orthomosaic'),
        ('type', 'overlay'),
        ('version', '1.0.0'),
        ('description', 'High-Resolution DA-QARES Drone Orthomosaic for Interactive Campus Map'),
        ('format', 'png'),
        ('bounds', f"{lon_min:.6f},{lat_min:.6f},{lon_max:.6f},{lat_max:.6f}"),
        ('minzoom', str(args.min_zoom)),
        ('maxzoom', str(args.max_zoom))
    ]
    cursor.executemany("INSERT INTO metadata VALUES (?, ?)", metadata)
    conn.commit()

    print("[3/4] Slicing and encoding tiles across zoom levels...")
    total_saved_tiles = 0
    total_skipped_tiles = 0
    t_start_slicing = time.time()

    for z in range(args.min_zoom, args.max_zoom + 1):
        z_t0 = time.time()
        x_min, y_min = deg2num(lat_max, lon_min, z)
        x_max, y_max = deg2num(lat_min, lon_max, z)

        x_start = min(x_min, x_max)
        x_end = max(x_min, x_max)
        y_start = min(y_min, y_max)
        y_end = max(y_min, y_max)

        z_saved = 0
        z_skipped = 0
        batch = []

        for x in range(x_start, x_end + 1):
            for y in range(y_start, y_end + 1):
                lon_w, lat_s, lon_e, lat_n = num2deg_bounds(x, y, z)

                # Geographic bounds to GeoTIFF pixel coordinates
                px0 = (lon_w - lon_min) / dx
                px1 = (lon_e - lon_min) / dx
                py0 = (lat_max - lat_n) / dy
                py1 = (lat_max - lat_s) / dy

                # Intersection with image rectangle
                src_x0 = max(0.0, min(float(W), px0))
                src_x1 = max(0.0, min(float(W), px1))
                src_y0 = max(0.0, min(float(H), py0))
                src_y1 = max(0.0, min(float(H), py1))

                if src_x1 <= src_x0 or src_y1 <= src_y0:
                    z_skipped += 1
                    continue

                tile_w = px1 - px0
                tile_h = py1 - py0
                dst_x0 = int(round((src_x0 - px0) / tile_w * 256.0))
                dst_x1 = int(round((src_x1 - px0) / tile_w * 256.0))
                dst_y0 = int(round((src_y0 - py0) / tile_h * 256.0))
                dst_y1 = int(round((src_y1 - py0) / tile_h * 256.0))

                dst_w = max(1, dst_x1 - dst_x0)
                dst_h = max(1, dst_y1 - dst_y0)

                # Crop from memory buffer
                crop = img.crop((int(round(src_x0)), int(round(src_y0)), int(round(src_x1)), int(round(src_y1))))

                if dst_x0 == 0 and dst_y0 == 0 and dst_w == 256 and dst_h == 256:
                    tile_img = crop.resize((256, 256), Image.Resampling.BILINEAR)
                else:
                    resized = crop.resize((dst_w, dst_h), Image.Resampling.BILINEAR)
                    tile_img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
                    tile_img.paste(resized, (dst_x0, dst_y0))

                # Check if tile has any non-transparent pixels
                alpha_extrema = tile_img.getchannel('A').getextrema()
                if alpha_extrema[1] == 0:
                    z_skipped += 1
                    continue

                # Encode PNG tile
                buf = io.BytesIO()
                tile_img.save(buf, format='PNG', compress_level=6)
                tile_data = buf.getvalue()

                # TMS convention for MBTiles: tile_row = (1 << z) - 1 - y
                tile_col = x
                tile_row = (1 << z) - 1 - y

                batch.append((z, tile_col, tile_row, tile_data))
                z_saved += 1

                if len(batch) >= 200:
                    cursor.executemany("INSERT INTO tiles VALUES (?, ?, ?, ?)", batch)
                    conn.commit()
                    batch = []

        if batch:
            cursor.executemany("INSERT INTO tiles VALUES (?, ?, ?, ?)", batch)
            conn.commit()

        total_saved_tiles += z_saved
        total_skipped_tiles += z_skipped
        z_elapsed = time.time() - z_t0
        print(f"      Zoom {z:2d}: {z_saved:4d} tiles written, {z_skipped:4d} void tiles skipped ({z_elapsed:.2f}s)")

    print("[4/4] Finalizing MBTiles database...")
    cursor.execute("PRAGMA optimize;")
    conn.commit()
    conn.close()

    total_time = time.time() - t0
    final_size_mb = os.path.getsize(output_path) / (1024 * 1024)

    print("=" * 65)
    print(f"SUCCESS: MBTiles database generated in {total_time:.1f} seconds!")
    print(f"Total Tiles:  {total_saved_tiles:,} tiles")
    print(f"File Size:    {final_size_mb:.2f} MB")
    print(f"Saved To:     {output_path}")
    print("=" * 65)

if __name__ == "__main__":
    main()
