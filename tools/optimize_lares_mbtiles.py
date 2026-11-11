"""
DA-LARES MBTiles Optimizer
Extracts Zoom 14 to 21 from the raw 10 GB Agisoft Metashape LARES v1.mbtiles
to match the ~200 MB footprint of QARES v1.mbtiles (223 MB) and RARES v1.mbtiles (206 MB).
"""

import os
import sys
import time
import sqlite3
import argparse

def main():
    parser = argparse.ArgumentParser(description="Optimize LARES v1.mbtiles to ~210 MB (Zoom 14-21)")
    parser.add_argument("--input", default="LARES v1.mbtiles", help="Path to raw input LARES v1.mbtiles")
    parser.add_argument("--output", default="LARES v1_optimized.mbtiles", help="Path to optimized output .mbtiles")
    parser.add_argument("--max-zoom", type=int, default=21, help="Maximum zoom level to retain (default: 21, matching QARES and RARES)")
    args = parser.parse_args()

    input_path = os.path.abspath(args.input)
    output_path = os.path.abspath(args.output)

    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)

    t0 = time.time()
    orig_size_mb = os.path.getsize(input_path) / (1024 * 1024)
    print("=" * 65)
    print("DA-LARES MBTILES OPTIMIZER")
    print(f"Input:     {input_path} ({orig_size_mb:,.2f} MB)")
    print(f"Output:    {output_path}")
    print(f"Max Zoom:  {args.max_zoom} (matching QARES & RARES)")
    print("=" * 65)

    if os.path.exists(output_path):
        os.remove(output_path)

    src_conn = sqlite3.connect(f"file:{input_path}?mode=ro", uri=True)
    src_cur = src_conn.cursor()

    dst_conn = sqlite3.connect(output_path)
    dst_cur = dst_conn.cursor()
    dst_cur.execute("PRAGMA synchronous = OFF;")
    dst_cur.execute("PRAGMA journal_mode = MEMORY;")

    dst_cur.execute("CREATE TABLE metadata (name text, value text);")
    dst_cur.execute("CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);")
    dst_cur.execute("CREATE UNIQUE INDEX tile_index on tiles (zoom_level, tile_column, tile_row);")

    # Copy and update metadata
    src_cur.execute("SELECT name, value FROM metadata")
    meta = dict(src_cur.fetchall())
    meta["minzoom"] = "14"
    meta["maxzoom"] = str(args.max_zoom)
    dst_cur.executemany("INSERT INTO metadata VALUES (?, ?)", list(meta.items()))

    # Copy tiles up to max_zoom
    src_cur.execute(
        "SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles WHERE zoom_level <= ? ORDER BY zoom_level, tile_column, tile_row",
        (args.max_zoom,)
    )
    rows = src_cur.fetchall()
    dst_cur.executemany("INSERT INTO tiles VALUES (?, ?, ?, ?)", rows)
    dst_cur.execute("PRAGMA optimize;")
    dst_conn.commit()

    src_conn.close()
    dst_conn.close()

    new_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    saved_mb = orig_size_mb - new_size_mb
    elapsed = time.time() - t0

    print(f"Copied {len(rows):,d} tiles (Zoom 14 to {args.max_zoom}) in {elapsed:.2f}s")
    print(f"Original Size:  {orig_size_mb:,.2f} MB")
    print(f"Optimized Size: {new_size_mb:,.2f} MB")
    print(f"Space Saved:    {saved_mb:,.2f} MB ({saved_mb / orig_size_mb * 100:.1f}% reduction)")
    print("=" * 65)

if __name__ == "__main__":
    main()

